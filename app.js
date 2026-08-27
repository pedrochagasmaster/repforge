const KEY="repforge_v1",DRAFT="repforge_draft_v1",PENDING="repforge_pending_v1",NOTIFY_META="repforge_notify_v1";
const PENDING_PREFIX=`${PENDING}:`,DRAFT_PENDING_PREFIX=`${DRAFT}:pending:`,DRAFT_CLOSE_PREFIX=`${DRAFT}:closing:`;
const DRAFT_WRITE_TRANSACTION="draft-write";
const DB="repforge",STORE="kv";
function loadNotifyMeta(){
  try{return JSON.parse(localStorage.getItem(NOTIFY_META)||"{}")||{}}catch{return{}}
}
function saveNotifyMeta(m){localStorage.setItem(NOTIFY_META,JSON.stringify(m))}
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open(DB,1);
  r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(key){const db=await idbOpen();
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
    tx.onsuccess=()=>res(tx.result);tx.onerror=()=>rej(tx.error)})}
  finally{db.close()}}
async function idbSet(key,val){const db=await idbOpen();
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(val,key);
    tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
  finally{db.close()}}
async function idbDel(key){const db=await idbOpen();
  try{return await new Promise((res,rej)=>{
    const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(key);
    tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
  finally{db.close()}}
const STORAGE_REV="_storageRevision",STORAGE_FOLLOWUP="_storageFollowUp",STORAGE_DRAFT_TXN="_storageDraftTransaction";
/* Transient, journal-only: what a shared proposal contributed as its own custom
   definitions, so a rebase against a refreshed head can tell payload data from
   recipient data. Stripped before any snapshot becomes durable. */
const SHARED_IMPORT="_sharedSetupImport";
function cloneSnapshot(s){return s==null?s:JSON.parse(JSON.stringify(s))}
function isPlainStateObject(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null}
function isSafeProgramHistoryEntry(entry){
  if(!isPlainStateObject(entry))return false;
  if(!Object.prototype.hasOwnProperty.call(entry,"program"))return true;
  return Array.isArray(entry.program)&&entry.program.every(isPlainStateObject)}
function isSafeLogRow(entry){
  if(!isPlainStateObject(entry))return false;
  for(const key of ["performedName","performedLibraryId","performedMovementId","performedPrimary","performedSecondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&entry[key]!=null&&typeof entry[key]!=="string")
      return false;
  return true}
function isSafeCustomExercise(entry){
  if(!isPlainStateObject(entry))return false;
  return typeof entry.id==="string"&&entry.id.startsWith(CUSTOM_ID_PREFIX)&&typeof entry.name==="string"}
function isValidStateShape(s){
  try{
    if(!isPlainStateObject(s)||!Array.isArray(s.program)||!s.program.every(isPlainStateObject)||
      !Array.isArray(s.log)||!s.log.every(isSafeLogRow))return false;
    if(Object.prototype.hasOwnProperty.call(s,STORAGE_DRAFT_TXN)&&!pendingDraftTransaction(s))return false;
    // Optional: backups written before custom exercises existed stay importable.
    if(Object.prototype.hasOwnProperty.call(s,"customExercises")&&
      !(Array.isArray(s.customExercises)&&s.customExercises.every(isSafeCustomExercise)))return false;
    if(!Object.prototype.hasOwnProperty.call(s,"programHistory"))return true;
    return Array.isArray(s.programHistory)&&s.programHistory.every(isSafeProgramHistoryEntry)}
  catch{return false}}
function readRevision(s){const n=s?.[STORAGE_REV];return Number.isInteger(n)&&n>=0?n:0}
function stripStorageMeta(s){if(!s||typeof s!=="object")return s;const o=cloneSnapshot(s);delete o[STORAGE_REV];delete o[STORAGE_FOLLOWUP];delete o[STORAGE_DRAFT_TXN];return o}
function exportableState(s){return stripStorageMeta(s)}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(value&&typeof value==="object"){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=canonicalize(value[key]);
    return out}
  return value}
function canonicalPayload(s){return JSON.stringify(canonicalize(stripStorageMeta(s)))}
function snapshotsEqual(a,b){return canonicalPayload(a)===canonicalPayload(b)}
function snapshotSummary(s){
  const log=Array.isArray(s?.log)?s.log:[];
  const sessions=new Set(log.map(r=>r&&r.session).filter(Boolean)).size;
  const dates=log.map(r=>String(r&&r.date||"")).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return{name:String(s?.programMeta?.name||"").trim(),sessions,sets:log.length,lastDate:dates.length?dates[dates.length-1]:""}}
function encodeRawExport(raw){if(raw==null)return"";if(typeof raw==="string")return raw;try{return JSON.stringify(raw,null,2)}catch{return String(raw)}}
function readLocalStatus(){
  try{const raw=localStorage.getItem(KEY);
    if(raw==null)return{status:"absent",raw:null,parsed:null};
    try{const parsed=JSON.parse(raw);
      if(isValidStateShape(parsed))return{status:"valid",raw,parsed};
      return{status:"invalid",raw,parsed}}
    catch{return{status:"invalid",raw,parsed:null}}}
  catch(e){return{status:"failed",raw:null,parsed:null,error:e}}}
async function readIdbStatus(){
  try{const parsed=await idbGet(KEY);
    if(parsed==null)return{status:"absent",raw:null,parsed:null};
    if(isValidStateShape(parsed))return{status:"valid",raw:parsed,parsed};
    return{status:"invalid",raw:parsed,parsed}}
  catch(e){return{status:"failed",raw:null,parsed:null,error:e}}}
function chooseSnapshot(localRead,idbRead){
  const l=localRead?.status,i=idbRead?.status,lv=l==="valid",iv=i==="valid";
  if(l==="absent"&&i==="absent")return{kind:"first-run"};
  if(!lv&&!iv)return{kind:"unresolved",reason:"no-valid",local:localRead,idb:idbRead};
  if(lv&&i==="absent")return{kind:"chosen",snapshot:localRead.parsed,source:"local",heal:"idb"};
  if(iv&&l==="absent")return{kind:"chosen",snapshot:idbRead.parsed,source:"idb",heal:"local"};
  if(lv&&(i==="invalid"||i==="failed"))return{kind:"unresolved",reason:i==="failed"?"valid-plus-failed":"valid-plus-invalid",local:localRead,idb:idbRead};
  if(iv&&(l==="invalid"||l==="failed"))return{kind:"unresolved",reason:l==="failed"?"valid-plus-failed":"valid-plus-invalid",local:localRead,idb:idbRead};
  const localHas=Object.prototype.hasOwnProperty.call(localRead.parsed||{},STORAGE_REV);
  const idbHas=Object.prototype.hasOwnProperty.call(idbRead.parsed||{},STORAGE_REV);
  const equal=snapshotsEqual(localRead.parsed,idbRead.parsed);
  const lr=readRevision(localRead.parsed),ir=readRevision(idbRead.parsed);
  if(equal){
    const localTxn=pendingDraftTransaction(localRead.parsed),idbTxn=pendingDraftTransaction(idbRead.parsed);
    if(lr===ir&&!!localTxn!==!!idbTxn){
      if(localTxn)return{kind:"chosen",snapshot:idbRead.parsed,source:"idb",heal:"local"};
      return{kind:"chosen",snapshot:localRead.parsed,source:"local",heal:"idb"}}
    if(lr!==ir){
      if(lr>ir)return{kind:"chosen",snapshot:localRead.parsed,source:"local",heal:"idb"};
      return{kind:"chosen",snapshot:idbRead.parsed,source:"idb",heal:"local"}}
    if(!localHas||!idbHas){
      const chosen=localHas?localRead:idbRead;
      return{kind:"chosen",snapshot:chosen.parsed,source:chosen===localRead?"local":"idb",migrate:true}}
    return{kind:"chosen",snapshot:idbRead.parsed,source:"idb"}}
  if(lr!==ir){
    if(lr>ir)return{kind:"chosen",snapshot:localRead.parsed,source:"local",heal:"idb"};
    return{kind:"chosen",snapshot:idbRead.parsed,source:"idb",heal:"local"}}
  return{kind:"unresolved",reason:"divergent",local:localRead,idb:idbRead}}
const storageIO={
  writeLocal(data){localStorage.setItem(KEY,JSON.stringify(data))},
  async writeIdb(data){await idbSet(KEY,data)}
};
const STORAGE_LOCK="repforge:state-write";
const PENDING_EFFECT_MAX_RAW=1000000;
const DRAFT_PRECONDITION_MATCH_ONLY="match-only";
const DRAFT_PRECONDITION_ABORT_CHANGED="abort-changed";
const DRAFT_PRECONDITION_ABORT_SAME_DAY="abort-same-day";
const DRAFT_EFFECT_VALID="valid",DRAFT_EFFECT_INVALID="invalid",DRAFT_EFFECT_NONE="none";
let persistTail=Promise.resolve();
let persistHead=null,mutationBase=null;
let storageHealth={localOk:true,idbOk:true,degraded:false,revision:0,lastResult:null};
let storageDegradedToast=false;
function enqueueWrite(op){
  const result=persistTail.then(op);
  persistTail=result.then(()=>undefined,()=>undefined);
  return result}
function flushStorage(){return persistTail}
async function writeSnapshot(snapshot,io){
  if(!io||typeof io.writeLocal!=="function"||typeof io.writeIdb!=="function")
    throw new Error("writeSnapshot requires an explicit adapter");
  const data=cloneSnapshot(snapshot),rev=readRevision(data);
  let localOk=false,idbOk=false;
  try{await io.writeLocal(data);localOk=true}
  catch(e){console.warn("localStorage mirror failed",e)}
  try{await io.writeIdb(data);idbOk=true}
  catch(e){console.warn("idb persist failed",e)}
  const result={revision:rev,localOk,idbOk};
  noteWriteHealth(result);
  return result}
function noteWriteHealth(result){
  const both=!!(result.localOk&&result.idbOk),none=!result.localOk&&!result.idbOk,degraded=!both&&!none;
  storageHealth={revision:result.revision,localOk:!!result.localOk,idbOk:!!result.idbOk,degraded,lastResult:result};
  if(none){storageDegradedToast=false;toast(t("toast.storage_full"),{assertive:true})}
  else if(degraded){if(!storageDegradedToast){storageDegradedToast=true;toast(t("toast.storage_degraded"))}}
  else storageDegradedToast=false;
  const el=$("#storageDegraded");
  if(el){el.textContent=degraded?t("settings.storage.degraded"):"";el.classList.toggle("hidden",!degraded);el.hidden=!degraded}}
function requireAdapter(io,label){
  if(!io||typeof io.writeLocal!=="function"||typeof io.writeIdb!=="function")
    throw new Error(label+" requires an explicit adapter");
  return io}
const CHANGE_MISSING=Symbol("change-missing");
function changeValueEqual(a,b){
  if(a===CHANGE_MISSING||b===CHANGE_MISSING)return a===b;
  return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b))}
function changeObject(v){return!!(v&&typeof v==="object"&&!Array.isArray(v))}
function changeEntityKey(root,value,index){
  if(!value||typeof value!=="object")return`${root}:value:${index}:${JSON.stringify(canonicalize(value))}`;
  if(root==="log")return value.session?`session:${value.session}`:`row:${index}:${JSON.stringify(canonicalize(value))}`;
  if(root==="program"||root==="programHistory"||root==="customExercises")
    return value.id?`id:${value.id}`:`row:${index}:${JSON.stringify(canonicalize(value))}`;
  return null}
function changeGroups(list,root){
  const order=[],map=new Map();
  (Array.isArray(list)?list:[]).forEach((value,index)=>{
    const key=changeEntityKey(root,value,index);
    if(key==null)return;
    if(!map.has(key)){order.push(key);map.set(key,[])}
    map.get(key).push(value)});
  return{order,map}}
function mergeChangedArray(base,proposal,target,root,preferProposal){
  const b=changeGroups(base,root),p=changeGroups(proposal,root),tgt=changeGroups(target,root);
  const order=[...tgt.order],out=new Map([...tgt.map].map(([key,value])=>[key,cloneSnapshot(value)]));
  const remove=key=>{out.delete(key);const i=order.indexOf(key);if(i>=0)order.splice(i,1)};
  for(const key of new Set([...b.order,...p.order])){
    const bv=b.map.has(key)?b.map.get(key):CHANGE_MISSING;
    const pv=p.map.has(key)?p.map.get(key):CHANGE_MISSING;
    const tv=tgt.map.has(key)?tgt.map.get(key):CHANGE_MISSING;
    if(changeValueEqual(pv,bv))continue;
    if(pv===CHANGE_MISSING){
      if(tv!==CHANGE_MISSING&&(changeValueEqual(tv,bv)||preferProposal))remove(key);
      continue}
    if(tv===CHANGE_MISSING){
      if(bv===CHANGE_MISSING||preferProposal){out.set(key,cloneSnapshot(pv));if(!order.includes(key))order.push(key)}
      continue}
    if(bv===CHANGE_MISSING){
      if(preferProposal){out.set(key,cloneSnapshot(pv));if(!order.includes(key))order.push(key)}
      continue}
    if(root==="program"&&bv.length===1&&pv.length===1&&tv.length===1&&
      changeObject(bv[0])&&changeObject(pv[0])&&changeObject(tv[0])){
      const merged=mergeStateValue(bv[0],pv[0],tv[0],[root,key],preferProposal);
      if(merged===CHANGE_MISSING)remove(key);
      else{out.set(key,[merged]);if(!order.includes(key))order.push(key)}
      continue}
    if(changeValueEqual(tv,bv)||preferProposal)out.set(key,cloneSnapshot(pv))}
  return order.flatMap(key=>out.get(key)||[])}
function mergeStateValue(base,proposal,target,path,preferProposal){
  if(changeValueEqual(proposal,base))return target===CHANGE_MISSING?CHANGE_MISSING:cloneSnapshot(target);
  if(changeValueEqual(target,base))return proposal===CHANGE_MISSING?CHANGE_MISSING:cloneSnapshot(proposal);
  const root=path[0];
  if(path.length===1&&Array.isArray(base)&&Array.isArray(proposal)&&Array.isArray(target)&&
    (root==="log"||root==="program"||root==="programHistory"||root==="customExercises"))
    return mergeChangedArray(base,proposal,target,root,preferProposal);
  if(changeObject(base)&&changeObject(proposal)&&changeObject(target)){
    const out={};
    for(const key of new Set([...Object.keys(base),...Object.keys(proposal),...Object.keys(target)])){
      if(path.length===0&&key===STORAGE_REV)continue;
      const bv=Object.prototype.hasOwnProperty.call(base,key)?base[key]:CHANGE_MISSING;
      const pv=Object.prototype.hasOwnProperty.call(proposal,key)?proposal[key]:CHANGE_MISSING;
      const tv=Object.prototype.hasOwnProperty.call(target,key)?target[key]:CHANGE_MISSING;
      const merged=mergeStateValue(bv,pv,tv,path.concat(key),preferProposal);
      if(merged!==CHANGE_MISSING)out[key]=merged}
    return out}
  const chosen=preferProposal?proposal:target;
  return chosen===CHANGE_MISSING?CHANGE_MISSING:cloneSnapshot(chosen)}
function rebaseStateChange(base,proposal,target,{preferProposal=true}={}){
  const merged=mergeStateValue(base,proposal,target,[],preferProposal);
  return merged===CHANGE_MISSING?{}:merged}
function storageSnapshotsEqual(a,b){return changeValueEqual(a,b)}
function resetPersistenceBase(snapshot){
  persistHead=cloneSnapshot(snapshot);
  mutationBase=cloneSnapshot(snapshot)}
async function refreshPersistenceHead(){
  const local=readLocalStatus(),idb=await readIdbStatus();
  const decision=chooseSnapshot(local,idb);
  if(decision.kind==="first-run")return{head:cloneSnapshot(persistHead)};
  if(decision.kind!=="chosen")return{head:cloneSnapshot(persistHead),conflict:true};
  if(pendingDraftTransaction(decision.snapshot))
    return{head:cloneSnapshot(persistHead),conflict:true,draftTransaction:true};
  const disk=cloneSnapshot(decision.snapshot),current=cloneSnapshot(persistHead);
  const diskRev=readRevision(disk),currentRev=readRevision(current);
  if(diskRev>currentRev)return{head:disk};
  if(diskRev<currentRev||storageSnapshotsEqual(disk,current))return{head:current};
  return{head:current,conflict:true}}
function withStorageLock(io,op){
  if(io===storageIO&&navigator.locks?.request)return navigator.locks.request(STORAGE_LOCK,op);
  return op()}
function applyAcceptedSnapshot(base,snapshot){
  const live=rebaseStateChange(base,snapshot,state,{preferProposal:false});
  live[STORAGE_REV]=readRevision(snapshot);
  state=live;
  prog=new Program(state.program);state.program=prog.toJSON();
  mutationBase=cloneSnapshot(snapshot);
  dropMemo.clear();baselineMemo.clear()}
function unversionedSnapshot(snapshot){
  const out=cloneSnapshot(snapshot);
  if(out&&typeof out==="object")delete out[STORAGE_REV];
  return out}
function draftEffectOutcome(effect){
  if(effect==null)return{status:DRAFT_EFFECT_NONE,effect:null};
  if(!isPlainStateObject(effect))return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"shape"};
  if(effect.required!==undefined&&typeof effect.required!=="boolean")
    return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"required"};
  const precondition=effect.precondition??DRAFT_PRECONDITION_MATCH_ONLY;
  if(precondition!==DRAFT_PRECONDITION_MATCH_ONLY&&precondition!==DRAFT_PRECONDITION_ABORT_CHANGED&&
    precondition!==DRAFT_PRECONDITION_ABORT_SAME_DAY)
    return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"precondition"};
  if(effect.kind==="clear-draft"){
    if(precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY&&effect.expectedRaw!==null)
      return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"same-day-clear"};
    if(effect.expectedRaw!==null&&
      (typeof effect.expectedRaw!=="string"||effect.expectedRaw.length>PENDING_EFFECT_MAX_RAW))
      return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"expected-raw"};
    const receipt={kind:"clear-draft",expectedRaw:effect.expectedRaw,precondition};
    if(effect.required===true)receipt.required=true;
    if(precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY){
      if(typeof effect.conflictDay!=="string"||!effect.conflictDay||effect.conflictDay.length>200)
        return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"conflict-day"};
      receipt.conflictDay=effect.conflictDay}
    return{status:DRAFT_EFFECT_VALID,effect:receipt}}
  if(effect.kind==="replace-draft"&&typeof effect.replacementRaw==="string"&&
    effect.replacementRaw.length<=PENDING_EFFECT_MAX_RAW){
    if(typeof effect.expectedRaw!=="string"||effect.expectedRaw.length>PENDING_EFFECT_MAX_RAW)
      return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"expected-raw"};
    const receipt={kind:"replace-draft",expectedRaw:effect.expectedRaw,replacementRaw:effect.replacementRaw,precondition};
    if(effect.required===true)receipt.required=true;
    if(precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY){
      if(typeof effect.conflictDay!=="string"||!effect.conflictDay||effect.conflictDay.length>200)
        return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"conflict-day"};
      receipt.conflictDay=effect.conflictDay}
    return{status:DRAFT_EFFECT_VALID,effect:receipt}}
  return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"kind"}}
function normalizeDraftEffectOutcome(value){
  if(isPlainStateObject(value)&&
    (value.status===DRAFT_EFFECT_VALID||value.status===DRAFT_EFFECT_INVALID||value.status===DRAFT_EFFECT_NONE)){
    if(value.status===DRAFT_EFFECT_VALID)return draftEffectOutcome(value.effect);
    if(value.status===DRAFT_EFFECT_NONE)return{status:DRAFT_EFFECT_NONE,effect:null};
    return{status:DRAFT_EFFECT_INVALID,effect:null,reason:value.reason||"invalid"}}
  return draftEffectOutcome(value)}
function pendingJournalEffect(effect){
  const outcome=normalizeDraftEffectOutcome(effect);
  return outcome.status===DRAFT_EFFECT_VALID?outcome.effect:null}
function draftEffectRequiresCoordination(effect){
  const outcome=normalizeDraftEffectOutcome(effect);
  return outcome.status===DRAFT_EFFECT_VALID&&
    outcome.effect.precondition!==DRAFT_PRECONDITION_MATCH_ONLY}
function pendingDraftTransaction(snapshot){
  const value=snapshot?.[STORAGE_DRAFT_TXN];
  if(!isPlainStateObject(value)||value.version!==1||typeof value.id!=="string"||!value.id)return null;
  const effectOutcome=draftEffectOutcome(value.effect),previous=value.previous;
  if(effectOutcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(effectOutcome)||!isPlainStateObject(previous)||
    Object.prototype.hasOwnProperty.call(previous,STORAGE_DRAFT_TXN)||!isValidStateShape(previous)||
    readRevision(snapshot)<=readRevision(previous))return null;
  return{id:value.id,effect:effectOutcome.effect,previous:cloneSnapshot(previous)}}
function pendingJournalEffectState(effect){
  const outcome=normalizeDraftEffectOutcome(effect),receipt=outcome.effect;
  if(outcome.status!==DRAFT_EFFECT_VALID)return{receipt:null,status:outcome.status};
  try{
    const currentRaw=DraftStore.readCanonicalRaw();
    if(currentRaw===receipt.expectedRaw)return{receipt,currentRaw,status:"exact"};
    if(currentRaw==null)return{receipt,currentRaw,status:"missing"};
    if(receipt.precondition===DRAFT_PRECONDITION_ABORT_CHANGED)
      return{receipt,currentRaw,status:"conflict"};
    if(receipt.precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY){
      try{
        const current=JSON.parse(currentRaw);
        if(current&&typeof current==="object"&&!Array.isArray(current)&&current.__day===receipt.conflictDay)
          return{receipt,currentRaw,status:"conflict"}}
      catch{}}
    return{receipt,currentRaw,status:"mismatch"}}
  catch{
    return{receipt,currentRaw:null,status:receipt.precondition===DRAFT_PRECONDITION_MATCH_ONLY?"mismatch":"conflict"}}}
function applyPendingJournalEffect(effect){
  const checked=pendingJournalEffectState(effect),receipt=checked.receipt;
  if(checked.status===DRAFT_EFFECT_NONE)return{status:DRAFT_EFFECT_NONE,receipt:null};
  if(!receipt)return{status:DRAFT_EFFECT_INVALID,receipt:null};
  if(checked.status!=="exact")return{status:"no-effect",receipt,reason:checked.status};
  return DraftStore.publishCanonical(receipt.kind==="clear-draft"?null:receipt.replacementRaw)
    ?{status:"applied",receipt}:{status:"failed",receipt}}
function pendingDraftPostEffectAccepted(effect){
  const outcome=normalizeDraftEffectOutcome(effect),receipt=outcome.effect;
  if(outcome.status===DRAFT_EFFECT_NONE)return true;
  if(outcome.status!==DRAFT_EFFECT_VALID)return false;
  if(!draftEffectRequiresCoordination(outcome))return true;
  try{
    const currentRaw=DraftStore.readCanonicalRaw();
    if(receipt.kind==="clear-draft"){
      if(currentRaw==null)return true;
      const after=pendingJournalEffectState(receipt);
      return receipt.precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY&&after.status==="mismatch"}
    if(currentRaw===receipt.replacementRaw)return true;
    const after=pendingJournalEffectState(receipt);
    return after.status!=="conflict"&&after.status!=="exact"}
  catch{return false}}
function pendingDraftRelatedState(effect,transactionId,contextFingerprint=null){
  const pending=DraftStore.related(transactionId,contextFingerprint);
  const outcome=normalizeDraftEffectOutcome(effect),expectedRaw=outcome.effect?.expectedRaw;
  const expectedWrites=[],entries=[];
  for(const entry of pending.entries){
    if(outcome.status===DRAFT_EFFECT_VALID&&
      entry.value.transactionId===DRAFT_WRITE_TRANSACTION&&entry.value.raw===expectedRaw)
      expectedWrites.push(entry);
    else entries.push(entry)}
  return{entries,invalid:pending.invalid,expectedWrites}}
function pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint=null){
  const related=()=>pendingDraftRelatedState(effect,transactionId,contextFingerprint);
  let pending=related();
  if(pending.entries.length||pending.invalid.length)return false;
  const accepted=pendingDraftPostEffectAccepted(effect);
  pending=related();
  return accepted&&!pending.entries.length&&!pending.invalid.length}
function pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint=null){
  const outcome=normalizeDraftEffectOutcome(effect);
  if(outcome.status===DRAFT_EFFECT_INVALID)return false;
  if(outcome.status===DRAFT_EFFECT_NONE||!draftEffectRequiresCoordination(outcome))return true;
  if(checked.status==="conflict")return false;
  return pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint)}
function readDraftRaw(){
  return DraftStore.readRaw()}
function consumedDraftClearEffect(expectedRaw){
  return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw,
    precondition:DRAFT_PRECONDITION_MATCH_ONLY})}
function destructiveDraftClearEffect(expectedRaw){
  return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw,
    precondition:DRAFT_PRECONDITION_ABORT_CHANGED})}
function draftPreservationEffect(expectedRaw){
  if(expectedRaw==null)return destructiveDraftClearEffect(null);
  return draftEffectOutcome({required:true,kind:"replace-draft",expectedRaw,replacementRaw:expectedRaw,
    precondition:DRAFT_PRECONDITION_ABORT_CHANGED})}
function draftDayReplacementEffect(oldDay,newDay){
  try{
    const expectedRaw=DraftStore.readRaw();
    if(expectedRaw==null)return draftEffectOutcome({required:true,kind:"clear-draft",expectedRaw:null,
      precondition:DRAFT_PRECONDITION_ABORT_SAME_DAY,conflictDay:oldDay});
    let replacementRaw=expectedRaw;
    try{
      const draft=JSON.parse(expectedRaw);
      if(draft&&typeof draft==="object"&&!Array.isArray(draft)&&draft.__day===oldDay){
        draft.__day=newDay;replacementRaw=JSON.stringify(draft)}}
    catch{}
    return draftEffectOutcome({required:true,kind:"replace-draft",expectedRaw,replacementRaw,
      precondition:DRAFT_PRECONDITION_ABORT_SAME_DAY,conflictDay:oldDay})}
  catch{return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"draft-read"}}}
let pendingJournalSeq=0,pendingJournalClock=0;
function pendingJournalUuid(){
  const uuid=globalThis.crypto?.randomUUID?.();
  if(uuid)return uuid;
  const words=new Uint32Array(4);
  if(globalThis.crypto?.getRandomValues){
    globalThis.crypto.getRandomValues(words);
    return [...words].map(n=>n.toString(36)).join("-")}
  return`${Date.now().toString(36)}-${(++pendingJournalSeq).toString(36)}-${Math.random().toString(36).slice(2)}`}
const pendingJournalWriterId=pendingJournalUuid();
function pendingJournalOrder(){
  const clock=Number.isFinite(globalThis.performance?.timeOrigin)&&Number.isFinite(globalThis.performance?.now?.())
    ?Math.floor((globalThis.performance.timeOrigin+globalThis.performance.now())*1000):Date.now()*1000;
  const at=Math.max(clock,pendingJournalClock+1);
  pendingJournalClock=at;
  return{at,writer:pendingJournalWriterId,seq:++pendingJournalSeq}}
function draftProgramFingerprint(snapshot){
  return JSON.stringify(canonicalize({programMetaId:snapshot?.programMeta?.id||null,
    program:Array.isArray(snapshot?.program)?snapshot.program:[]}))}
function draftContextFingerprint(snapshot){
  return JSON.stringify(canonicalize({programMetaId:snapshot?.programMeta?.id||null,
    program:Array.isArray(snapshot?.program)?snapshot.program:[],
    unit:snapshot?.settings?.unit||"kg",rirMode:snapshot?.settings?.rirMode||"numeric"}))}
function programTransitionPrecondition(snapshot=state){
  return{expectedProgramId:snapshot?.programMeta?.id||null,
    expectedProgramFingerprint:draftProgramFingerprint(snapshot)}}
const DraftStore={
  readCanonicalRaw(){
    try{return localStorage.getItem(DRAFT)}
    catch{return null}},
  publishCanonical(raw){
    if(raw!==null&&typeof raw!=="string")return false;
    try{
      if(raw===null)localStorage.removeItem(DRAFT);
      else localStorage.setItem(DRAFT,raw);
      return true}
    catch{return false}},
  sidecarKeys(transactionId=null){
    const keys=[],prefix=transactionId==null?DRAFT_PENDING_PREFIX:`${DRAFT_PENDING_PREFIX}${transactionId}:`;
    try{for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith(prefix))keys.push(key)}}
    catch{}
    return[...new Set(keys)].sort()},
  decodeSidecar(key,raw){
    try{
      const value=JSON.parse(raw),order=value?.order;
      if(!isPlainStateObject(value)||value.version!==1||typeof value.transactionId!=="string"||
        !value.transactionId||typeof value.writer!=="string"||!value.writer||
        key!==`${DRAFT_PENDING_PREFIX}${value.transactionId}:${value.writer}`||
        !(value.raw===null||typeof value.raw==="string"&&value.raw.length<=PENDING_EFFECT_MAX_RAW)||
        typeof value.programFingerprint!=="string"||
        !Number.isSafeInteger(order?.at)||typeof order?.writer!=="string"||
        !Number.isSafeInteger(order?.seq))return null;
      return{key,raw,value}}
    catch{return null}},
  pending(transactionId=null){
    const entries=[],invalid=[];
    for(const key of this.sidecarKeys(transactionId)){
      let raw;
      try{raw=localStorage.getItem(key)}catch{continue}
      if(raw==null)continue;
      const entry=this.decodeSidecar(key,raw);
      if(!entry)invalid.push({key,raw});
      else if(transactionId==null||entry.value.transactionId===transactionId)entries.push(entry)}
    entries.sort((a,b)=>a.value.order.at-b.value.order.at||
      a.value.order.writer.localeCompare(b.value.order.writer)||
      a.value.order.seq-b.value.order.seq||a.key.localeCompare(b.key));
    return{entries,invalid}},
  related(transactionId=null,contextFingerprint=null){
    const pending=this.pending();
    const entries=pending.entries.filter(entry=>
      transactionId!=null&&entry.value.transactionId===transactionId||
      contextFingerprint!=null&&entry.value.programFingerprint===contextFingerprint);
    const invalid=transactionId==null?[]:pending.invalid.filter(entry=>
      entry.key.startsWith(`${DRAFT_PENDING_PREFIX}${transactionId}:`));
    return{entries,invalid}},
  closingIds(){
    const ids=[];
    try{for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith(DRAFT_CLOSE_PREFIX)&&key.length>DRAFT_CLOSE_PREFIX.length)
        ids.push(key.slice(DRAFT_CLOSE_PREFIX.length))}}
    catch{}
    return[...new Set(ids)].sort()},
  isClosing(transactionId){
    try{return localStorage.getItem(DRAFT_CLOSE_PREFIX+transactionId)!=null}
    catch{return false}},
  beginClose(transactionId){
    if(typeof transactionId!=="string"||!transactionId)return false;
    try{
      localStorage.setItem(DRAFT_CLOSE_PREFIX+transactionId,
        JSON.stringify({version:1,transactionId,writer:pendingJournalWriterId}));
      return true}
    catch{return false}},
  transactionOwned(transactionId){
    if(this.isClosing(transactionId))return true;
    const local=readLocalStatus();
    const transaction=local.status==="valid"?pendingDraftTransaction(local.parsed):null;
    if(transaction?.id===transactionId)return true;
    return readPendingJournal().entries.some(record=>record.journal.id===transactionId)},
  writeTarget(){
    const closing=this.closingIds()[0];
    if(closing)return{id:closing};
    if(!pendingJournalKeys().length)return null;
    const local=readLocalStatus();
    const transaction=local.status==="valid"?pendingDraftTransaction(local.parsed):null;
    if(transaction)return{id:transaction.id};
    const next=readPendingJournal().entries.find(record=>
      record.journal.effectOutcome.status===DRAFT_EFFECT_VALID&&
      draftEffectRequiresCoordination(record.journal.effectOutcome));
    return next?{id:next.journal.id}:null},
  writeSidecar(transactionId,raw){
    if(typeof transactionId!=="string"||!transactionId||
      !(raw===null||typeof raw==="string"&&raw.length<=PENDING_EFFECT_MAX_RAW))return false;
    const order=pendingJournalOrder(),key=`${DRAFT_PENDING_PREFIX}${transactionId}:${pendingJournalWriterId}`;
    const value={version:1,transactionId,writer:pendingJournalWriterId,order,
      programFingerprint:draftContextFingerprint(state),raw};
    try{
      const encoded=JSON.stringify(value);
      localStorage.setItem(key,encoded);
      return this.decodeSidecar(key,encoded)}
    catch{return false}},
  stage(target,raw){
    if(!target||typeof target.id!=="string")return false;
    if(!this.writeSidecar(target.id,raw))return false;
    if(!this.transactionOwned(target.id))return this.promote(target.id).settled;
    return true},
  readRaw(){
    const contextFingerprint=draftContextFingerprint(state);
    const queued=this.pending().entries.filter(entry=>
      entry.value.programFingerprint===contextFingerprint).at(-1);
    return queued?queued.value.raw:this.readCanonicalRaw()},
  publish(raw){
    if(!(raw===null||typeof raw==="string"&&raw.length<=PENDING_EFFECT_MAX_RAW))return false;
    const staged=this.writeSidecar(DRAFT_WRITE_TRANSACTION,raw);
    if(!staged)return false;
    const stable=()=>{
      if(this.writeTarget())return false;
      const local=readLocalStatus();
      return local.status==="valid"&&!pendingDraftTransaction(local.parsed)&&
        draftContextFingerprint(local.parsed)===staged.value.programFingerprint};
    if(!stable())return true;
    if(!this.publishCanonical(raw))return false;
    if(!stable())return true;
    this.clearSidecar(staged);
    return true},
  write(raw){return typeof raw==="string"&&this.publish(raw)},
  remove(){return this.publish(null)},
  clearSidecar(entry){
    try{
      if(localStorage.getItem(entry.key)===entry.raw)localStorage.removeItem(entry.key)}
    catch{}},
  promote(transactionId,contextFingerprint=null){
    const pending=this.related(transactionId,contextFingerprint);
    if(!pending.entries.length&&!pending.invalid.length)
      return{settled:true,hadWrites:false,raw:undefined};
    const latest=pending.entries.at(-1);
    if(latest&&!this.publishCanonical(latest.value.raw))
      return{settled:false,hadWrites:true,raw:latest.value.raw};
    for(const entry of pending.entries)this.clearSidecar(entry);
    for(const invalid of pending.invalid){
      try{if(localStorage.getItem(invalid.key)===invalid.raw)localStorage.removeItem(invalid.key)}
      catch{}}
    const remaining=this.related(transactionId,contextFingerprint);
    return{settled:remaining.entries.length===0&&remaining.invalid.length===0,
      hadWrites:true,raw:latest?.value.raw}},
  restoreEffect(transactionId,effect,contextFingerprint=null){
    const promoted=this.promote(transactionId,contextFingerprint);
    if(!promoted.settled||promoted.hadWrites)return promoted;
    const outcome=normalizeDraftEffectOutcome(effect);
    if(outcome.status!==DRAFT_EFFECT_VALID)return promoted;
    const receipt=outcome.effect;
    const appliedRaw=receipt.kind==="clear-draft"?null:receipt.replacementRaw;
    if(this.readCanonicalRaw()!==appliedRaw)return promoted;
    return{settled:this.publishCanonical(receipt.expectedRaw),hadWrites:false,raw:receipt.expectedRaw}},
  endClose(transactionId,contextFingerprint=null){
    try{localStorage.removeItem(DRAFT_CLOSE_PREFIX+transactionId)}
    catch{return{settled:false,hadWrites:false}}
    return this.promote(transactionId,contextFingerprint)}
};
function pendingJournalKeys(){
  const keys=[];
  try{for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key===PENDING||key?.startsWith(PENDING_PREFIX))keys.push(key)}}
  catch{}
  return[...new Set(keys)]}
function decodePendingJournal(key,raw){
  try{
    const journal=JSON.parse(raw);
    if(!journal||typeof journal.id!=="string"||
      !isValidStateShape(journal.base)||!isValidStateShape(journal.liveBase)||!isValidStateShape(journal.proposal))return null;
    const legacy=key===PENDING,order=journal.order;
    if(!legacy&&(key!==PENDING_PREFIX+journal.id||journal.version!==2||
      !Number.isSafeInteger(order?.at)||typeof order?.writer!=="string"||
      !Number.isSafeInteger(order?.seq)))return null;
    const effectOutcome=legacy?{status:DRAFT_EFFECT_NONE,effect:null}:
      draftEffectOutcome(Object.prototype.hasOwnProperty.call(journal,"effect")?journal.effect:null);
    const expectedProgramFingerprint=typeof journal.expectedProgramFingerprint==="string"&&
      journal.expectedProgramFingerprint.length<=PENDING_EFFECT_MAX_RAW?journal.expectedProgramFingerprint:null;
    if(journal.expectedProgramFingerprint!=null&&!expectedProgramFingerprint)return null;
    const reconcileSessionIds=normalizeJournalSessionIds(journal.reconcileSessionIds);
    const dayRenames=normalizeJournalDayRenames(journal.dayRenames);
    if(reconcileSessionIds==null||dayRenames==null)return null;
    let rollback=null;
    if(Object.prototype.hasOwnProperty.call(journal,"rollback")){
      if(!isValidStateShape(journal.rollback)||
        Object.prototype.hasOwnProperty.call(journal.rollback,STORAGE_DRAFT_TXN))return null;
      rollback=cloneSnapshot(journal.rollback)}
    else if(Object.prototype.hasOwnProperty.call(journal,"rollbackRevision")){
      if(!Number.isInteger(journal.rollbackRevision)||journal.rollbackRevision<0)return null;
      rollback=cloneSnapshot(journal.base);
      rollback[STORAGE_REV]=journal.rollbackRevision}
    return{key,raw,legacy,order:legacy?null:order,journal:{
      id:journal.id,base:unversionedSnapshot(journal.base),liveBase:unversionedSnapshot(journal.liveBase),
      proposal:unversionedSnapshot(journal.proposal),replace:!!journal.replace,
      expectedProgramId:typeof journal.expectedProgramId==="string"&&journal.expectedProgramId?journal.expectedProgramId:null,
      expectedProgramFingerprint,expectedFirstRunEmpty:journal.expectedFirstRunEmpty===true,reconcileSessionIds,dayRenames,
      effectOutcome,effect:effectOutcome.effect,rollback}}}
  catch{return null}}
function readPendingJournal(){
  const entries=[],invalid=[];
  for(const key of pendingJournalKeys()){
    let raw;
    try{raw=localStorage.getItem(key)}catch{continue}
    if(raw==null)continue;
    const record=decodePendingJournal(key,raw);
    if(record)entries.push(record);else invalid.push({key,raw})}
  entries.sort((a,b)=>{
    if(a.legacy!==b.legacy)return a.legacy?-1:1;
    if(a.legacy)return a.journal.id.localeCompare(b.journal.id);
    return a.order.at-b.order.at||a.order.writer.localeCompare(b.order.writer)||
      a.order.seq-b.order.seq||a.journal.id.localeCompare(b.journal.id)});
  return{entries,invalid}}
function normalizeJournalSessionIds(value){
  if(value==null)return[];
  if(!Array.isArray(value)||value.length>1000)return null;
  const ids=[];
  for(const id of value){
    if(typeof id!=="string"||!id||id.length>300)return null;
    if(!ids.includes(id))ids.push(id)}
  return ids}
function normalizeJournalDayRenames(value){
  if(value==null)return[];
  if(!Array.isArray(value)||value.length>100)return null;
  const renames=[];
  for(const entry of value){
    if(!isPlainStateObject(entry)||typeof entry.from!=="string"||!entry.from||
      typeof entry.to!=="string"||!entry.to||entry.from.length>200||entry.to.length>200)return null;
    renames.push({from:entry.from,to:entry.to})}
  return renames}
function writePendingJournal(base,liveBase,proposal,{replace=false,expectedProgramId=null,
  expectedProgramFingerprint=null,expectedFirstRunEmpty=false,reconcileSessionIds=[],dayRenames=[],effectOutcome=null}={}){
  const id=pendingJournalUuid(),key=PENDING_PREFIX+id;
  const journal={version:2,id,order:pendingJournalOrder(),base:unversionedSnapshot(base),liveBase:unversionedSnapshot(liveBase),
    proposal:unversionedSnapshot(proposal),replace:!!replace,expectedProgramId:expectedProgramId||null};
  if(expectedProgramFingerprint)journal.expectedProgramFingerprint=expectedProgramFingerprint;
  if(expectedFirstRunEmpty)journal.expectedFirstRunEmpty=true;
  if(reconcileSessionIds.length)journal.reconcileSessionIds=reconcileSessionIds;
  if(dayRenames.length)journal.dayRenames=dayRenames;
  const outcome=normalizeDraftEffectOutcome(effectOutcome);
  if(outcome.status===DRAFT_EFFECT_VALID)journal.effect=outcome.effect;
  const raw=JSON.stringify(journal);
  try{localStorage.setItem(key,raw);return decodePendingJournal(key,raw)}
  catch(e){console.warn("pending state journal failed",e);return null}}
function armPendingJournalRollback(record,snapshot){
  if(!record||record.legacy||!isValidStateShape(snapshot)||
    Object.prototype.hasOwnProperty.call(snapshot,STORAGE_DRAFT_TXN))return null;
  try{
    if(localStorage.getItem(record.key)!==record.raw)return null;
    const journal=JSON.parse(record.raw),rollback=cloneSnapshot(snapshot);
    journal.rollbackRevision=readRevision(rollback);
    delete journal.rollback;
    if(!storageSnapshotsEqual(unversionedSnapshot(rollback),record.journal.base))
      journal.rollback=rollback;
    const raw=JSON.stringify(journal);
    localStorage.setItem(record.key,raw);
    return decodePendingJournal(record.key,raw)}
  catch(e){console.warn("pending rollback journal failed",e);return null}}
function clearPendingJournal(record){
  if(!record)return true;
  try{
    const current=localStorage.getItem(record.key);
    if(current===record.raw)localStorage.removeItem(record.key);
    return localStorage.getItem(record.key)!==record.raw}
  catch{return false}}
function retainPendingJournal(record){
  if(!record)return false;
  try{
    const current=localStorage.getItem(record.key);
    if(current===record.raw)return true;
    if(current!=null)return false;
    localStorage.setItem(record.key,record.raw);
    return localStorage.getItem(record.key)===record.raw}
  catch{return false}}
function clearPendingJournalById(id){
  if(typeof id!=="string"||!id)return;
  const key=PENDING_PREFIX+id;
  try{
    const raw=localStorage.getItem(key);
    if(raw==null)return;
    const record=decodePendingJournal(key,raw);
    if(record?.journal.id===id)clearPendingJournal(record)}
  catch{}}
function clearAllPendingJournal(){
  const records=readPendingJournal();
  for(const record of [...records.entries,...records.invalid])clearPendingJournal(record)}
function reconcileExplicitLogDayRenames(snapshot,dayRenames){
  if(!Array.isArray(snapshot?.log)||!dayRenames.length)return snapshot;
  for(const {from,to} of dayRenames){
    const sessions=new Set(snapshot.log.filter(row=>row?.day===from&&row.session).map(row=>row.session));
    for(const row of snapshot.log){
      if(row?.day===from||row?.session&&sessions.has(row.session))row.day=to}}
  return snapshot}
function reconcileCandidateLogDays(snapshot,sessionIds){
  if(!Array.isArray(snapshot?.program)||!Array.isArray(snapshot?.log)||!sessionIds.length)return snapshot;
  const currentDays=new Map();
  for(const exercise of snapshot.program){
    if(exercise&&typeof exercise.id==="string"&&exercise.id)currentDays.set(exercise.id,exercise.day)}
  for(const sessionId of sessionIds){
    const rows=snapshot.log.filter(row=>row?.session===sessionId);
    if(!rows.length)continue;
    const sourceDays=[...new Set(rows.map(row=>row.day).filter(day=>typeof day==="string"&&day))];
    const mappedDays=[...new Set(rows.map(row=>currentDays.get(row.exerciseId)).filter(day=>typeof day==="string"&&day))];
    let targetDay=null;
    if(mappedDays.length===1)targetDay=mappedDays[0];
    else if(sourceDays.length===1)targetDay=sourceDays[0];
    else targetDay=sourceDays[0]||mappedDays[0]||null;
    if(targetDay!=null)for(const row of rows)row.day=targetDay}
  return snapshot}
function stateSnapshotForHead(base,liveBase,proposal,head,{replace=false,reconcileSessionIds=[],dayRenames=[],expectedFirstRunEmpty=false,sharedRebaseSeed=null}={}){
  const durableHead=cloneSnapshot(head||base);
  const liveHead=replace?durableHead:rebaseStateChange(base,liveBase,durableHead);
  const snapshot=replace?cloneSnapshot(proposal):rebaseStateChange(liveBase,proposal,liveHead);
  if(replace&&expectedFirstRunEmpty)rebaseSharedSetupSnapshot(snapshot,durableHead,sharedRebaseSeed);
  reconcileExplicitLogDayRenames(snapshot,dayRenames);
  reconcileCandidateLogDays(snapshot,reconcileSessionIds);
  delete snapshot[STORAGE_DRAFT_TXN];
  delete snapshot[SHARED_IMPORT];
  snapshot[STORAGE_REV]=readRevision(durableHead)+1;
  return snapshot}
function pendingJournalSuccessorMatches(record,head){
  const journal=record?.journal,rollback=journal?.rollback;
  if(!journal||!rollback||!head)return false;
  const candidate=stateSnapshotForHead(journal.base,journal.liveBase,journal.proposal,rollback,
    {replace:journal.replace,reconcileSessionIds:journal.reconcileSessionIds,
      dayRenames:journal.dayRenames,expectedFirstRunEmpty:journal.expectedFirstRunEmpty,
      sharedRebaseSeed:journal.id});
  return readRevision(candidate)===readRevision(head)&&storageSnapshotsEqual(candidate,head)}
function preparePendingDraftTransaction(snapshot,previous,effect,id){
  const prepared=cloneSnapshot(snapshot),outcome=normalizeDraftEffectOutcome(effect),receipt=outcome.effect;
  if(outcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(outcome))return prepared;
  const prior=cloneSnapshot(previous);
  delete prior[STORAGE_DRAFT_TXN];
  if(!isValidStateShape(prior))throw new TypeError("draft transaction requires a valid prior state");
  prepared[STORAGE_DRAFT_TXN]={version:1,id:id||pendingJournalUuid(),previous:prior,effect:receipt};
  return prepared}
function finalizedDraftTransactionSnapshot(snapshot){
  const finalized=cloneSnapshot(snapshot);
  delete finalized[STORAGE_DRAFT_TXN];
  return finalized}
function rejectedDraftTransactionSnapshot(snapshot){
  const transaction=pendingDraftTransaction(snapshot);
  if(!transaction)return null;
  const rollback=cloneSnapshot(transaction.previous);
  delete rollback[STORAGE_DRAFT_TXN];
  rollback[STORAGE_REV]=readRevision(snapshot)+1;
  return rollback}
function settlePendingDraftSidecars(transactionId,effect,restoreEffect,contextFingerprint){
  if(restoreEffect)return DraftStore.restoreEffect(transactionId,effect,contextFingerprint);
  let pending=pendingDraftRelatedState(effect,transactionId,contextFingerprint);
  for(const entry of pending.expectedWrites)DraftStore.clearSidecar(entry);
  pending=pendingDraftRelatedState(effect,transactionId,contextFingerprint);
  if(pending.expectedWrites.length)
    return{settled:false,hadWrites:false,conflict:false};
  const promoted=DraftStore.promote(transactionId,contextFingerprint);
  return Object.assign({},promoted,{conflict:promoted.hadWrites})}
function settlePendingDraftRecord(record,{transactionId=record?.journal?.id||null,effect=null,
  restoreEffect=false,allowWrites=false,contextFingerprint=null}={}){
  if(!transactionId){
    return{settled:clearPendingJournal(record),hadWrites:false}}
  const settle=()=>settlePendingDraftSidecars(
    transactionId,effect,restoreEffect,contextFingerprint);
  const blocked=result=>{
    const conflict=!restoreEffect&&!allowWrites&&!!result.conflict;
    return Object.assign({},result,{settled:false,conflict,
      recordRetained:conflict?retainPendingJournal(record):undefined})};
  const first=settle();
  if(!first.settled||!restoreEffect&&!allowWrites&&first.conflict)return blocked(first);
  const cleared=clearPendingJournal(record);
  const second=settle();
  if(!cleared||!second.settled||!restoreEffect&&!allowWrites&&second.conflict)
    return blocked({settled:false,hadWrites:first.hadWrites||second.hadWrites,
      conflict:second.conflict});
  let ended=true;
  try{localStorage.removeItem(DRAFT_CLOSE_PREFIX+transactionId)}
  catch{ended=false}
  const final=settle();
  if(!ended||!final.settled||!restoreEffect&&!allowWrites&&final.conflict)
    return blocked({settled:false,
      hadWrites:first.hadWrites||second.hadWrites||final.hadWrites,
      conflict:final.conflict});
  return{settled:true,hadWrites:first.hadWrites||second.hadWrites||final.hadWrites,
    conflict:false}}
async function compensatePendingDraftTransaction(snapshot,io,transactionId,effect){
  const transaction=pendingDraftTransaction(snapshot);
  const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
  const rollback=rejectedDraftTransactionSnapshot(snapshot);
  const result=rollback?await writeSnapshot(rollback,io):{revision:readRevision(snapshot),localOk:false,idbOk:false};
  const durable=!!(result.localOk||result.idbOk);
  const restored=durable?DraftStore.restoreEffect(transactionId,effect,contextFingerprint):{settled:false};
  return{settled:durable&&restored.settled,snapshot:rollback,result}}
async function settleAppliedDraftTransaction(prepared,finalized,effect,checked,io,provisionalResult){
  const transaction=pendingDraftTransaction(prepared),transactionId=transaction?.id||null;
  const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
  const applied=applyPendingJournalEffect(effect);
  if(!pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint)){
    const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
    return Object.assign({accepted:false,rejected:true},compensation)}
  if(!transaction)return{accepted:true,rejected:false,snapshot:finalized,result:null};
  const result=await writeSnapshot(finalized,io);
  if(!(result.localOk||result.idbOk)){
    const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
    if(compensation.settled)return Object.assign({accepted:false,rejected:true},compensation);
    return{accepted:true,rejected:false,deferred:true,settled:false,snapshot:prepared,
      result:provisionalResult,finalizationResult:result,applied}}
  if(!pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint)){
    const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
    return Object.assign({accepted:false,rejected:true},compensation)}
  return{accepted:true,rejected:false,settled:true,snapshot:finalized,result}}
async function executeDraftTransaction({record=null,transactionId=record?.journal?.id||null,effect=null,
  prepared=null,snapshot=null,io=null,writePrepared=true,preparedResult=null,
  retainRecordOnWriteFailure=false,discard=false}={}){
  const effectOutcome=normalizeDraftEffectOutcome(effect);
  const transaction=prepared&&pendingDraftTransaction(prepared);
  const id=transaction?.id||transactionId;
  const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):
    record?.journal?draftContextFingerprint(record.journal.liveBase):null;
  const coordinated=draftEffectRequiresCoordination(effectOutcome);
  const beginClose=()=>!id||DraftStore.beginClose(id);
  const close=(restoreEffect,allowWrites=false)=>{
    if(!id)return{settled:clearPendingJournal(record),hadWrites:false};
    if(!beginClose())return{settled:false,hadWrites:false,closeFailed:true};
    return settlePendingDraftRecord(record,
      {transactionId:id,effect:effectOutcome,restoreEffect:!!restoreEffect,
        allowWrites:!!allowWrites,contextFingerprint})};
  if(discard){
    const closed=close(false,true);
    return{kind:closed.settled?"discarded":"close-failed",accepted:false,rejected:false,
      settled:closed.settled,closed,snapshot:null,result:null}}
  requireAdapter(io,"executeDraftTransaction");
  if(!prepared||!snapshot)throw new TypeError("executeDraftTransaction requires prepared and final snapshots");
  if(coordinated&&(!id||!beginClose()))
    return{kind:"close-failed",accepted:false,rejected:false,settled:false,
      closeFailed:true,snapshot:prepared,result:preparedResult};
  const preEffectState=pendingJournalEffectState(effectOutcome);
  const preEffectPending=pendingDraftRelatedState(effectOutcome,id,contextFingerprint);
  if(writePrepared&&(preEffectState.status==="conflict"||
    preEffectPending.entries.length||preEffectPending.invalid.length)){
    const closed=close(false,true);
    return{kind:"precondition-rejected",accepted:false,rejected:true,settled:closed.settled,
      closed,snapshot:null,result:null}}
  let result=preparedResult;
  if(writePrepared){
    result=await writeSnapshot(prepared,io);
    if(!(result.localOk||result.idbOk)){
      let closed=null;
      if(retainRecordOnWriteFailure){
        if(coordinated&&id)DraftStore.endClose(id)}
      else closed=close(false,true);
      return{kind:"write-failed",accepted:false,rejected:false,settled:!!closed?.settled,
        closed,snapshot:prepared,result}}}
  const checked=writePrepared?pendingJournalEffectState(effectOutcome):preEffectState;
  const provisionalResult=result||
    {revision:readRevision(prepared),localOk:!writePrepared,idbOk:!writePrepared};
  const settlement=await settleAppliedDraftTransaction(
    prepared,snapshot,effectOutcome,checked,io,provisionalResult);
  if(!settlement.accepted){
    if(settlement.rejected&&settlement.settled){
      const closed=close(true);
      return Object.assign({},settlement,{kind:"rejected",settled:closed.settled,closed})}
    return Object.assign({},settlement,
      {kind:settlement.deferred?"settlement-deferred":"rejected"})}
  if(settlement.deferred)
    return Object.assign({},settlement,{kind:"settlement-deferred"});
  const closed=close(false);
  if(coordinated&&(closed.hadWrites||
    !pendingDraftSettlementAccepted(effectOutcome,id,contextFingerprint))){
    const compensation=await compensatePendingDraftTransaction(prepared,io,id,effectOutcome);
    if(compensation.settled){
      const restored=close(true);
      return Object.assign({kind:"compensated",accepted:false,rejected:true},compensation,
        {settled:restored.settled,closed,restored})}
    if(closed.conflict)
      return Object.assign({kind:"rejected",accepted:false,rejected:true},compensation,{closed});
    /* Compensation could not finish, so which snapshot is durable decides whether
       this transaction counts: the rollback if that write landed, otherwise the
       successor the settlement already wrote. */
    const rolledBack=!!(compensation.result?.localOk||compensation.result?.idbOk);
    return{kind:"close-deferred",accepted:!rolledBack,rejected:rolledBack,deferred:true,settled:false,
      snapshot:rolledBack?compensation.snapshot:snapshot,result:settlement.result||result,closed}}
  if(!closed.settled)
    return{kind:"close-deferred",accepted:true,rejected:false,deferred:true,settled:false,
      snapshot,result:settlement.result||result,closed};
  return{kind:"committed",accepted:true,rejected:false,settled:true,
    snapshot,result:settlement.result||result,closed}}
function enqueueStateChange(base,proposal,io,{replace=false,liveBase=base,expectedProgramId=null,
  expectedProgramFingerprint=null,expectedFirstRunEmpty=false,reconcileSessionIds=[],dayRenames=[],effect=null}={}){
  requireAdapter(io,"enqueueStateChange");
  const frozenBase=cloneSnapshot(base),frozenLiveBase=cloneSnapshot(liveBase);
  const frozenProposal=cloneSnapshot(proposal),frozenEffectOutcome=normalizeDraftEffectOutcome(effect);
  const frozenReconcileSessionIds=normalizeJournalSessionIds(reconcileSessionIds);
  const frozenDayRenames=normalizeJournalDayRenames(dayRenames);
  if(frozenReconcileSessionIds==null||frozenDayRenames==null)
    return Promise.resolve({revision:readRevision(frozenBase),localOk:false,idbOk:false,
      conflict:true,journalMetadataInvalid:true});
  if(frozenEffectOutcome.status===DRAFT_EFFECT_INVALID)
    return Promise.resolve({revision:readRevision(frozenBase),localOk:false,idbOk:false,
      draftConflict:true,effectInvalid:true,effectReason:frozenEffectOutcome.reason});
  const frozenEffect=frozenEffectOutcome.effect;
  let pendingRecord=io===storageIO
    ?writePendingJournal(frozenBase,frozenLiveBase,frozenProposal,
      {replace,expectedProgramId,expectedProgramFingerprint,
        expectedFirstRunEmpty,
        reconcileSessionIds:frozenReconcileSessionIds,dayRenames:frozenDayRenames,
        effectOutcome:frozenEffectOutcome})
    :null;
  if(io===storageIO&&!pendingRecord){
    const failed={revision:readRevision(frozenBase),localOk:false,idbOk:false,journalFailed:true};
    if(frozenEffect?.required===true)failed.draftConflict=true;
    noteWriteHealth(failed);
    return Promise.resolve(failed)}
  const operation=enqueueWrite(()=>withStorageLock(io,async()=>{
    let head=cloneSnapshot(persistHead||frozenBase);
    if(io===storageIO){
      const refreshed=await refreshPersistenceHead();
      if(refreshed.conflict){
        console.warn("storage write blocked by an unresolved concurrent snapshot");
        await executeDraftTransaction({record:pendingRecord,
          transactionId:pendingRecord?.journal.id||null,effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,conflict:true}}
      head=refreshed.head||head}
    const coordinationId=pendingRecord?.journal.id||null;
    if(expectedProgramId&&head?.programMeta?.id!==expectedProgramId){
      await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
        effect:frozenEffectOutcome,discard:true});
      return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true}}
    if(expectedProgramFingerprint&&draftProgramFingerprint(head)!==expectedProgramFingerprint){
      await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
        effect:frozenEffectOutcome,discard:true});
      return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true}}
    if(expectedFirstRunEmpty&&(head?.programMeta?.onboarded||head?.log?.length||head?.programHistory?.length)){
      await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
        effect:frozenEffectOutcome,discard:true});
      return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true,ineligible:true}}
    if(pendingRecord&&draftEffectRequiresCoordination(frozenEffectOutcome)){
      const armed=armPendingJournalRollback(pendingRecord,head);
      if(!armed){
        await executeDraftTransaction({record:pendingRecord,
          transactionId:pendingRecord.journal.id,effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,
          draftConflict:true,journalFailed:true}}
      pendingRecord=armed}
    const snapshot=stateSnapshotForHead(frozenBase,frozenLiveBase,frozenProposal,head,
      {replace,reconcileSessionIds:frozenReconcileSessionIds,dayRenames:frozenDayRenames,
        expectedFirstRunEmpty,sharedRebaseSeed:pendingRecord?.journal.id||coordinationId});
    const prepared=preparePendingDraftTransaction(snapshot,head,frozenEffect,pendingRecord?.journal.id);
    const transactionId=pendingDraftTransaction(prepared)?.id||coordinationId;
    const execution=await executeDraftTransaction({record:pendingRecord,transactionId,
      effect:frozenEffectOutcome,prepared,snapshot,io,writePrepared:true});
    if(execution.kind==="close-failed")
      return{revision:readRevision(head),localOk:false,idbOk:false,draftConflict:true,closeFailed:true};
    if(execution.kind==="precondition-rejected")
      return{revision:readRevision(head),localOk:false,idbOk:false,draftConflict:true};
    if(execution.kind==="write-failed")return execution.result;
    if(execution.kind==="rejected"||execution.kind==="compensated"){
      if(execution.settled&&execution.snapshot){
        persistHead=cloneSnapshot(execution.snapshot);
        applyAcceptedSnapshot(frozenLiveBase,execution.snapshot)}
      return{revision:execution.result?.revision??readRevision(head),localOk:false,idbOk:false,
        draftConflict:!!execution.rejected,compensationPending:!execution.settled,
        compensationLocalOk:!!execution.result?.localOk,compensationIdbOk:!!execution.result?.idbOk}}
    if(execution.kind==="settlement-deferred"){
        persistHead=cloneSnapshot(prepared);
        applyAcceptedSnapshot(frozenLiveBase,snapshot);
        return Object.assign({},execution.result,
          {accepted:true,deferred:true,finalizationPending:true})}
    if(execution.kind==="close-deferred"){
      /* Only the journal record is still outstanding: the snapshot below is
         already durable, so live state has to adopt it. Reporting success while
         the app still renders the pre-transaction program is the worse failure. */
      if(execution.snapshot){
        persistHead=cloneSnapshot(execution.snapshot);
        applyAcceptedSnapshot(frozenLiveBase,execution.snapshot)}
      if(!execution.accepted)
        return{revision:execution.result?.revision??readRevision(head),localOk:false,idbOk:false,
          draftConflict:true,compensationPending:true};
      return Object.assign({},execution.result,
        {accepted:true,deferred:true,finalizationPending:true})}
    if(execution.kind==="committed"){
      persistHead=cloneSnapshot(snapshot);
      applyAcceptedSnapshot(frozenLiveBase,snapshot);
      return execution.result}
    return{revision:readRevision(head),localOk:false,idbOk:false,conflict:true}}));
  return operation}
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const I18N=window.RepForgeI18n;
const t=(k,v)=>I18N?I18N.t(k,v):k;
const tp=(n,w)=>I18N?I18N.tp(n,w):(+n===1?w:w+"s");
const captureEvent=(event,properties)=>{try{return window.RepForgeTelemetry?.capture(event,properties)===true}catch{return false}};
const bootTelemetry=()=>{try{const config=window.__POSTHOG_CONFIG__||{};
  return window.RepForgeTelemetry?.boot({appVersion:config.appVersion||"dev",crypto:window.crypto,
    location:window.location,navigator:window.navigator,releaseChannel:config.releaseChannel||"preview",
    storage:window.localStorage})||null}catch{return null}};
const telemetryPlatformClass=()=>{if(isIOS())return"ios";const ua=navigator.userAgent||"";if(/android/i.test(ua))return"android";if(/windows|macintosh|linux|cros/i.test(ua))return"desktop";return"other"};
const applyI18n=()=>{if(!I18N)return;I18N.applyDom();
  const hard=$("#statsHardSetLede");if(hard)hard.innerHTML=t("stats.completed_hard_sets.lede");
  const langSel=$("#lang");if(langSel){if(state?.settings?.lang)langSel.value=state.settings.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  $$("[data-term]").forEach(b=>{const key=b.dataset.term;b.textContent=t(`glossary.term.${key}`)||key;if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(key,b)}});
};
/* An explicit choice wins; otherwise follow the browser. `setLang` falls back
   to English on anything it does not recognise, so the detected language has to
   be resolved here rather than handed a null and left to that fallback. */
const resolveLang=()=>state?.settings?.lang||I18N.detectLang();
function syncLang(){if(!I18N)return;I18N.setLang(resolveLang());applyI18n()}
function announce(msg,{assertive=false}={}){
  const generation=announce._generation=(announce._generation||0)+1;
  const live=$("#toast");if(!live)return;
  live.setAttribute("role",assertive?"alert":"status");
  live.setAttribute("aria-live",assertive?"assertive":"polite");
  live.setAttribute("aria-atomic","true");
  live.classList.remove("hidden");
  clearTimeout(announce._t);
  const write=()=>{
    live.textContent=msg;
    clearTimeout(announce._t);announce._t=setTimeout(()=>live.classList.add("hidden"),2400)};
  if(live.textContent===msg){
    live.textContent="";
    requestAnimationFrame(()=>{
      if(generation!==announce._generation)return;
      requestAnimationFrame(()=>{
        if(generation!==announce._generation)return;
        write()})})}
  else write()}
const toast=(m,opts)=>announce(m,opts||{});
let activeModal=null;
function modalFocusables(root){
  if(!root)return[];
  const sel='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(sel)].filter(el=>{
    if(el.hasAttribute("hidden")||el.closest("[hidden]"))return false;
    const st=getComputedStyle(el);
    return st.display!=="none"&&st.visibility!=="hidden";
  })}
function snapshotBodyInert(){
  return [...document.body.children].map(el=>({el,inert:!!el.inert}))}
function applyModalInert(keep){
  const allow=new Set(keep.filter(Boolean));
  allow.add($("#announcementHost"));
  for(const child of document.body.children){
    if(allow.has(child)){child.inert=false;continue}
    child.inert=true}}
function restoreBodyInert(snap){
  if(!snap)return;
  for(const {el,inert} of snap){if(el.isConnected)el.inert=inert}}
function detachModalListeners(rec){
  if(!rec)return;
  if(rec.onKey)document.removeEventListener("keydown",rec.onKey,true);
  if(rec.onPointer)document.removeEventListener("pointerdown",rec.onPointer,true)}
function hideModalElement(rec){
  if(!rec?.el)return;
  // A sheet closed out from under a live drag (Escape, a save, a tour step) still
  // carries the thumb's inline transform, and would reopen part-way down.
  if(sheetDrag?.rec===rec){sheetDrag=null;sheetDragRelease(rec)}
  const el=rec.el;
  if(el.tagName==="DIALOG"){if(typeof el.close==="function"&&el.open)el.close()}
  else{el.classList.add("hidden");el.hidden=true}
  rec.scrim?.classList.add("hidden");rec.scrim?.classList.remove("is-open");
  el.classList.remove("is-open");
  document.body.classList.remove("is-sheet-open")}
function canTakeFocus(el){
  if(!(el instanceof Element)||!el.isConnected)return false;
  if(el.hasAttribute("disabled")||el.closest("[disabled]"))return false;
  for(let n=el;n;n=n.parentElement){
    if(n.inert)return false;
    if(n.hidden===true)return false;
    const st=getComputedStyle(n);
    if(st.display==="none"||st.visibility==="hidden")return false}
  return true}
function resolveReturnFocus(target){
  // A callback lets a caller name its return target before the view that owns it
  // has rendered, which is how boot-time dialogs reach a Today control.
  if(typeof target==="function")target=target();
  if(typeof target==="string")target=$(target);
  if(!(target instanceof Element)||!target.isConnected)return null;
  if(canTakeFocus(target))return target;
  const lab=target.closest?.("label")||target.labels?.[0];
  if(lab&&canTakeFocus(lab))return lab;
  return null}
function openModal(el,opts={}){
  if(!el)return false;
  const extras=opts.extras||[];
  if(activeModal&&activeModal.el!==el){
    if(!opts.handoff)return false;
    const opener=opts.returnFocus||activeModal.returnFocus;
    const prevInert=activeModal.prevInert;
    const prev=activeModal;
    detachModalListeners(prev);
    hideModalElement(prev);
    activeModal=null;
    return openModal(el,{...opts,handoff:false,returnFocus:opener,prevInert})}
  if(activeModal&&activeModal.el===el)return true;
  const rec={
    el,scrim:opts.scrim||null,returnFocus:opts.returnFocus||document.activeElement,
    onEscape:opts.onEscape,delayHide:opts.delayHide||0,prevInert:opts.prevInert||snapshotBodyInert(),closing:false
  };
  if(el.tagName==="DIALOG"){if(typeof el.showModal==="function"&&!el.open)el.showModal()}
  else{el.hidden=false;el.classList.remove("hidden")}
  rec.scrim?.classList.remove("hidden");
  applyModalInert([el,rec.scrim,...extras]);
  rec.onKey=e=>{
    if(!activeModal||activeModal.el!==el)return;
    if(e.key==="Escape"){
      e.preventDefault();e.stopPropagation();
      if(typeof rec.onEscape==="function")rec.onEscape();
      return}
    if(e.key!=="Tab")return;
    const stops=modalFocusables(el);
    if(!stops.length){e.preventDefault();return}
    const first=stops[0],last=stops[stops.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    else if(!el.contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus()}};
  rec.onPointer=e=>{
    if(!activeModal||activeModal.el!==el)return;
    const t=e.target instanceof Element?e.target:null;
    if(t&&(el.contains(t)||rec.scrim?.contains(t)))return;
    e.preventDefault();e.stopPropagation()};
  document.addEventListener("keydown",rec.onKey,true);
  document.addEventListener("pointerdown",rec.onPointer,true);
  activeModal=rec;
  const focusEl=typeof opts.initialFocus==="function"?opts.initialFocus():opts.initialFocus;
  const toFocus=focusEl||modalFocusables(el)[0];
  // Modals are fixed overlays, so scrolling one into view only shifts the page
  // beneath them — on iOS that drags the visual viewport and takes the sheet
  // header with it.
  if(toFocus){try{toFocus.focus({preventScroll:true})}catch{try{toFocus.focus()}catch{}}}
  return true}
function closeModal(el){
  const rec=activeModal;
  if(!rec||(el&&rec.el!==el)||rec.closing)return Promise.resolve(false);
  rec.closing=true;
  return new Promise(resolve=>{
    let fallback=null,onEnd=null;
    const finish=()=>{
      if(rec.done)return;rec.done=true;
      if(fallback)clearTimeout(fallback);
      if(onEnd)rec.el.removeEventListener("transitionend",onEnd);
      detachModalListeners(rec);
      hideModalElement(rec);
      restoreBodyInert(rec.prevInert);
      if(activeModal===rec)activeModal=null;
      const target=resolveReturnFocus(rec.returnFocus);
      if(target){
        try{target.focus({preventScroll:true})}catch{try{target.focus()}catch{}}}
      resolve(true)};
    if(rec.delayHide>0){
      rec.el.classList.remove("is-open");
      rec.scrim?.classList.remove("is-open");
      fallback=setTimeout(finish,rec.delayHide);
      onEnd=e=>{if(e.target===rec.el)finish()};
      rec.el.addEventListener("transitionend",onEnd)}
    else finish()})}
function setDisclosure(button,panel,open){
  if(!button||!panel)return;
  const on=!!open;
  button.setAttribute("aria-expanded",on?"true":"false");
  if(panel.id)button.setAttribute("aria-controls",panel.id);
  panel.classList.toggle("is-open",on);
  panel.setAttribute("aria-hidden",on?"false":"true");
  const chev=button.querySelector(".chevron");if(chev)chev.classList.toggle("is-up",on)}
function syncLogModeControls(){
  const list=logMode==="full",full=$("#modeFull"),focus=$("#modeFocus");
  if(full){full.classList.toggle("active",list);full.setAttribute("aria-pressed",list?"true":"false")}
  if(focus){focus.classList.toggle("active",!list);focus.setAttribute("aria-pressed",list?"false":"true")}}
const uid=()=>crypto?.randomUUID?.()||`id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const fmtPlain=v=>Number.isFinite(Number(v))?(Number.isInteger(Number(v))?String(Number(v)):Number(v).toFixed(2).replace(/\.?0+$/,"")):"";
const uiLang=()=>state?.settings?.lang||(typeof I18N!=="undefined"&&I18N?.getLang?.())||"en";
const isPt=()=>uiLang()==="pt";
const locTag=()=>isPt()?"pt-BR":"en-US";
/** Locale-aware display number (PT decimal comma). Not for input values. */
const fmt=v=>{const s=fmtPlain(v);if(!s)return"";return isPt()?s.replace(".",","):s};
const kfmt=v=>{const n=Number(v)||0;
  if(n>=10000){const raw=(n/1000).toFixed(n>=100000?0:1).replace(/\.0$/,"");return (isPt()?raw.replace(".",","):raw)+"k"}
  try{return Math.round(n).toLocaleString(locTag())}catch{return String(Math.round(n))}};
const plural=(n,word)=>`${word}${+n===1?"":"s"}`;
const avg=a=>a.length?a.reduce((s,x)=>s+Number(x||0),0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=[...a].map(Number).sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const sum=a=>a.reduce((s,x)=>s+Number(x||0),0);
function shiftDate(date,n){const d=new Date(`${String(date).slice(0,10)}T12:00:00`);d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
const daysAgo=n=>shiftDate(today(),-n);
function weekStart(date){const d=new Date(`${String(date).slice(0,10)}T12:00:00`),dow=d.getDay(),diff=dow===0?6:dow-1;
  d.setDate(d.getDate()-diff);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function weekRange(date){const start=weekStart(date);return{start,end:shiftDate(start,6)}}
function sessionsInRange(start,end){const ids=new Set();for(const x of state.log){if(String(x.date)>=start&&String(x.date)<=end)ids.add(x.session)}return[...ids]}
window.__repforgeWeek={weekStart,weekRange,sessionsInRange};
const e1rm=(load,reps)=>load>0&&reps>0?load*(1+reps/30):0;
const muscles=s=>String(s||"").split(",").map(x=>x.trim()).filter(Boolean);
const muscleLabel=name=>{const k="muscle."+name,s=t(k);return s===k?name:s};
/* Stored muscle tags are comma-joined English tokens ("Hamstrings,Glutes"); every
   place that shows them to the lifter goes through this. */
const muscleListLabel=s=>muscles(s).map(muscleLabel).join(", ");
// Capacity: what a set demonstrated the lifter COULD have done (ADR 0003).
// RIR credit is capped at hardRir — trustworthy near failure, fantasy far from it.
// TUNABLE: every constant the capacity engine reads lives here. Never inline them.
const CAPACITY={jumpMargin:1,bigJumpMargin:3,pushGap:2,dropClamp:.05,
  baselineSessions:3,temperFloor:.3,temperDamp:.5,temperClamp:.05,temperMinSets:3};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
/** Trusted reps in reserve: negatives floor at 0, blanks keep the conservative 1. */
const capRir=rir=>{const r=rir===""||rir==null?NaN:+rir;
  return Math.min(Number.isFinite(r)?Math.max(r,0):1,+state.settings.hardRir||4)};
const capReps=(reps,rir)=>+reps+capRir(rir);
const capE1rm=(load,reps,rir)=>e1rm(load,capReps(reps,rir));
/** Inverse Epley: reps this capacity-e1RM predicts as performable at a load.
 *  Snapped to 6 decimals so the e1rm round-trip lands exactly on whole reps —
 *  every trigger below compares against integer rep thresholds, and raw float
 *  noise (11 arriving as 10.999999999999995) would silently miss them. */
const repsAtLoad=(cap,load)=>cap>0&&load>0?Math.round(30*(cap/load-1)*1e6)/1e6:0;
const shortDate=d=>{const p=String(d||"").split("-");if(p.length!==3)return String(d||"");
  const day=+p[2],mon=t("month_short."+(+p[1]-1));
  return isPt()?`${day} ${mon}`:`${mon} ${day}`};
/* Day names are stored data: the bundled splits, the onboarding builder and
   "+ Add day" all mint the canonical English `Day N`, and every log row, tab
   and lookup keys off that stored string. Renaming them per locale would
   rewrite the lifter's program on a language switch, so only the display is
   translated, and only for that exact canonical shape — anything typed by hand
   ("Push A", "Dia de perna") is shown back exactly as typed. */
const DEFAULT_DAY_NAME=/^Day\s+(\d+)$/;
const dayLabel=d=>{const s=String(d??"").trim(),m=DEFAULT_DAY_NAME.exec(s);
  return m?t("program.default.day",{n:+m[1]}):String(d??"")};
const download=(text,name,type="text/plain")=>{const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=u;a.download=name;document.body.append(a);a.click();a.remove();URL.revokeObjectURL(u)};
async function shareOrDownload(text,name,type){
  try{if(navigator.canShare){const file=new File([text],name,{type});
    if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:"Taurifer backup"});return}}}catch{}
  download(text,name,type)}
const EFFORT_RIR={easy:3,hard:1,max:0};
const EFFORT_STEPS=["easy","hard","max"];
const isEffortMode=()=>state?.settings?.rirMode==="effort";
/** Bucket a logged RIR into the effort word closest to it. */
const effortForRir=rir=>+rir>=2.5?"easy":+rir<=0.5?"max":"hard";
const effortLabel=e=>t("effort."+e);
/** The same word inside a sentence ("… at hard effort", "… esforço difícil"). */
const effortWord=e=>effortLabel(e).toLocaleLowerCase(locTag());
const effortHint=e=>t("effort.hint."+e);
const EFFORT_TERM={easy:"Easy effort",hard:"Hard effort",max:"Max effort"};
/** The effort a working set is aimed at, read off the program's RIR ceiling. */
const targetEffort=()=>effortForRir(state?.settings?.rirHigh);
/** How a set reads once it is logged: the word in effort mode, else "@RIR". */
const effortOrRirLabel=rir=>isEffortMode()?effortLabel(effortForRir(rir)):`@${fmt(rir)}`;
/** The per-set target line: reps plus the effort or the RIR window behind it. */
const targetText=ex=>isEffortMode()
  ?t("today.target_rest_effort",{min:ex.min,max:ex.max,effort:effortWord(targetEffort())})
  :t("today.target_rest",{min:ex.min,max:ex.max,rir:fmt(state.settings.rirHigh)});
/** The three-way effort picker — the compact radiogroup on a List set row.
 *  Focus states it as a spinner instead; see cursetHtml. */
function effortControlHtml(key,n,val,{confirmed=true}={}){
  return `<div class="effort${confirmed?"":" effort--suggested"}" role="radiogroup" aria-label="${esc(t("log.set_effort_aria",{n}))}">`+
    EFFORT_STEPS.map(e=>{const on=val===e;
      return `<button type="button" class="effort__btn${on?" active":""}" role="radio" aria-checked="${on?"true":"false"}"`+
        ` tabindex="${on?"0":"-1"}" data-eff="${esc(key)}" data-e="${e}">`+
        `<span class="effort__word">${esc(effortLabel(e))}</span></button>`}).join("")+`</div>`}
/** Move a set's effort pick, in every copy of its picker that is on screen —
 *  the List row's radiogroup and the Focus well's spinner alike. */
function setEffortPick(key,eff){
  $$(`.effort__btn[data-eff="${key}"]`).forEach(b=>{const on=b.dataset.e===eff;
    b.classList.toggle("active",on);b.setAttribute("aria-checked",on?"true":"false");b.tabIndex=on?0:-1;
    b.closest(".effort")?.classList.remove("effort--suggested")});
  $$(`[data-effspin="${key}"]`).forEach(el=>{
    el.dataset.e=eff;el.textContent=effortLabel(eff);
    el.setAttribute("aria-valuenow",String(EFFORT_STEPS.indexOf(eff)+1));
    el.setAttribute("aria-valuetext",effortLabel(eff));
    const pop=el.closest(".curset__cell")?.querySelector(".effortpop");
    fillEffortPop(pop,eff,{bump:!!pop?.classList.contains("is-open")})})}

/* ---- Effort explainer ----
   How many reps an effort leaves in the tank ("≈1 left") used to sit as a
   caption under that column's steppers, where it read as permanent chrome and
   stretched the column. It is a pill now: it pops off the word on a tap, and
   goes away on the next tap anywhere. */
const effortPopHtml=(key,eff)=>
  `<div class="effortpop" id="effpop_${esc(key)}" data-effpop="${esc(key)}" role="tooltip">`+
    `<span class="effortpop__hint">${esc(effortHint(eff))}</span>`+
    `<span class="effortpop__arrow" aria-hidden="true"></span></div>`;
/** Write one effort's shorthand into the pill. `bump` replays a small pulse —
 *  the pill is already open and the value under it just moved, so the new
 *  reading should announce itself rather than swap silently. */
function fillEffortPop(pop,eff,{bump=false}={}){
  if(!pop)return;
  const hint=pop.querySelector(".effortpop__hint");
  if(hint)hint.textContent=effortHint(eff);
  if(!bump)return;
  clearTimeout(pop.bumpT);pop.classList.remove("is-bump");void pop.offsetWidth;
  pop.classList.add("is-bump");
  pop.bumpT=setTimeout(()=>pop.classList.remove("is-bump"),420)}
/** Park the card over the word it explains and play it in. */
function openEffortPop(key){
  const spin=$(`[data-effspin="${key}"]`),pop=$(`[data-effpop="${key}"]`);
  if(!spin||!pop)return;
  closeEffortPop({except:pop});
  spin.closest(".curset__cell")?.classList.add("is-active");
  fillEffortPop(pop,spin.dataset.e);
  clearTimeout(pop.closeT);pop.classList.remove("is-closing");
  pop.classList.add("is-open");spin.classList.add("is-open")}
function closeEffortPop({except=null}={}){
  $$(".effortpop.is-open").forEach(pop=>{
    if(pop===except)return;
    pop.classList.remove("is-open");pop.classList.add("is-closing");
    clearTimeout(pop.closeT);pop.closeT=setTimeout(()=>pop.classList.remove("is-closing"),240);
    const spin=$(`[data-effspin="${pop.dataset.effpop}"]`);
    spin?.classList.remove("is-open");
    spin?.closest(".curset__cell")?.classList.remove("is-active")})}
const toggleEffortPop=key=>{
  const pop=$(`[data-effpop="${key}"]`);
  if(pop?.classList.contains("is-open"))closeEffortPop();else openEffortPop(key)};
function glossaryPopover(termKey,anchor){const g=$("#glossary");if(!g)return;
  g.querySelector(".glossary__term").textContent=t(`glossary.term.${termKey}`)||termKey;
  g.querySelector(".glossary__body").textContent=t(`glossary.${termKey}`)||"";
  g.classList.remove("hidden");
  const r=anchor.getBoundingClientRect();g.style.top=`${window.scrollY+r.bottom+6}px`;g.style.left=`${Math.max(8,r.left)}px`}
const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",lang:null,rirMode:"numeric",voiceInputEnabled:false,notify:{enabled:false,timer:true,session:true,unfinished:true,missed:true}};
const normSetting=(v,def,min=0)=>Number.isFinite(+v)&&+v>=min?+v:def;
const normalizeRestSec=v=>{const n=+v;if(!Number.isFinite(n)||n<0)return DEFAULTS.restSec;return Math.round(n)};
const normBool=(v,def)=>typeof v==="boolean"?v:def;
/* A settings blob written by a newer build carries keys this one has no field
   for. Dropping them here does not merely hide them: boot normalization would
   leave live state without them while the mutation base still has them, so the
   next ordinary write offers them back as deletions. Unknown keys therefore ride
   along untouched, and the known fields always win. */
function withUnknownKeys(raw,known){
  if(!isPlainStateObject(raw))return known;
  const out={};
  for(const key of Object.keys(raw))
    if(!Object.prototype.hasOwnProperty.call(known,key))out[key]=cloneSnapshot(raw[key]);
  return Object.assign(out,known)}
function normalizeNotify(n){
  return withUnknownKeys(n,{enabled:!!(n&&n.enabled),timer:n?.timer!==false,session:n?.session!==false,unfinished:n?.unfinished!==false,missed:n?.missed!==false})}
const normalizeSettings=s=>{const lang=I18N?.normalizeLang(s?.lang)||I18N?.detectLang()||"en";return withUnknownKeys(s,{jumpPct:normSetting(s?.jumpPct,DEFAULTS.jumpPct,0),minJump:normSetting(s?.minJump,DEFAULTS.minJump,0.01),rirHigh:normSetting(s?.rirHigh,DEFAULTS.rirHigh,0),hardRir:normSetting(s?.hardRir,DEFAULTS.hardRir,0),restSec:normalizeRestSec(s?.restSec),lastExport:typeof s?.lastExport==="string"?s.lastExport:"",unit:s?.unit==="lb"?"lb":"kg",lang,rirMode:s?.rirMode==="effort"?"effort":"numeric",voiceInputEnabled:normBool(s?.voiceInputEnabled,DEFAULTS.voiceInputEnabled),notify:normalizeNotify(s?.notify)})};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const LB=2.2046226218;
/* Locale keyboards (pt-BR, de, fr, …) put a comma on the decimal pad. HTML
   type=number rejects it on iOS, and unary + / Number() treat "90,5" as NaN.
   parseDec mirrors normalizeCommandText: digit-comma-digit → period. */
const parseDec=v=>{
  if(typeof v==="number")return Number.isFinite(v)?v:NaN;
  if(v==null||v==="")return NaN;
  const n=Number(String(v).trim().replace(/(\d),(\d)/g,"$1.$2"));
  return Number.isFinite(n)?n:NaN};
// Strict F7 parsing (grammar + 1000 kg ceiling) wearing the field-error shape:
// value is canonical kg so the exact lb bound snaps instead of drifting 1 ulp over.
const parseLoadDisplay=raw=>{const p=parseLoadInput(raw);
  if(p.kind==="valid")return{value:p.kg};
  return{field:"load",key:p.kind==="empty"?"toast.enter_weight_before_save_set":"toast.invalid_weight"}};
const parseRepsValue=raw=>{const n=parseDec(raw);if(!Number.isFinite(n)||n<=0||!Number.isInteger(n))return{field:"reps",key:"validation.reps"};return{value:n}};
const parseRirValue=raw=>{const n=parseDec(raw);if(!Number.isFinite(n)||n<0)return{field:"rir",key:"validation.rir"};return{value:n}};
const parseEffortValue=raw=>{const v=String(raw||"");if(!Object.prototype.hasOwnProperty.call(EFFORT_RIR,v))return{field:"effort",key:"validation.effort"};return{value:v}};
const parseOptionalBodyweightDisplay=raw=>{if(raw==null||String(raw).trim()==="")return{value:0};const n=parseDec(raw);if(!Number.isFinite(n)||n<=0)return{field:"bodyweight",key:"validation.bodyweight"};return{value:n}};
const parseCalendarDate=raw=>{const s=String(raw??"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return{field:"date",key:"validation.date"};const y=+s.slice(0,4),m=+s.slice(5,7),d=+s.slice(8,10);const dt=new Date(y,m-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d)return{field:"date",key:"validation.date"};return{value:s}};
const toDisplayUnit=(kg,unit)=>unit==="lb"?(+kg||0)*LB:(+kg||0);
const fromDisplayUnit=(v,unit)=>{const n=parseDec(v),x=Number.isFinite(n)?n:0;return unit==="lb"?x/LB:x};
const isLb=()=>state.settings.unit==="lb";
const toDisplay=kg=>toDisplayUnit(kg,state.settings.unit);
const fromDisplay=v=>fromDisplayUnit(v,state.settings.unit);
const unitLabel=()=>isLb()?"lb":"kg";
/* Typed loads reject exponent notation and anything over 1000 kg after
   one display-unit conversion — a 1e5 commit poisons every derived metric.
   1000 kg is inclusive. The lb display of that bound is 1000*LB; converting
   it back can land 1 ulp over, so only that exact display value snaps to 1000. */
const LOAD_RAW=/^\d+(?:[.,]\d+)?$/,MAX_LOAD_KG=1000,MAX_LOAD_LB=MAX_LOAD_KG*LB;
function parseLoadInput(raw,unit=state.settings.unit){
  const s=String(raw??"").trim();
  if(!s)return{kind:"empty"};
  if(!LOAD_RAW.test(s))return{kind:"invalid"};
  const display=+s.replace(",",".");
  if(!Number.isFinite(display)||!(display>0))return{kind:"invalid"};
  if(unit==="lb"){
    if(display>MAX_LOAD_LB)return{kind:"invalid"};
    if(display===MAX_LOAD_LB)return{kind:"valid",kg:MAX_LOAD_KG};
    const kg=display/LB;
    if(kg>MAX_LOAD_KG)return{kind:"invalid"};
    return{kind:"valid",kg}}
  if(display>MAX_LOAD_KG)return{kind:"invalid"};
  return{kind:"valid",kg:display}}
const loadInputToast=p=>t(p.kind==="empty"?"toast.enter_weight_before_save_set":"toast.invalid_weight");
const unitHintHtml=()=>`<span class="unit-hint">${esc(unitLabel())}</span>`;
const loadHeadHtml=()=>`${esc(t("today.load"))} ${unitHintHtml()}`;
const fmtLoad=kg=>fmt(toDisplay(kg));
const fmtLoadPlain=kg=>fmtPlain(toDisplay(kg));
const term=key=>`<button type="button" class="term" data-term="${esc(key)}">${esc(t(`glossary.term.${key}`)||key)}</button>`;
function resetDraftSessionState(){
  clearUnfinishedWatch();
  lastCommitAt=0;sessionStartedAt=0;
  committed.clear();touched.clear();warmups.clear();skipped.clear();substituted.clear();substitutedRef.clear();
  contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
  const el=$("#unfinishedBanner");
  if(el){el.classList.add("hidden");el.hidden=true}
  delete document.body.dataset.unfinishedPrompt;
}
function clearDraft(){
  DraftStore.remove();
  resetDraftSessionState()}
const loadDraft=()=>{try{return JSON.parse(DraftStore.readRaw()||"{}")}catch{clearDraft();return{}}};
function convertDraftUnitsRaw(raw,oldUnit,newUnit){
  if(raw==null||oldUnit===newUnit)return raw;
  let d;
  try{d=JSON.parse(raw)}
  catch{return raw}
  if(!d||typeof d!=="object")return raw;
  let changed=false;
  const conv=v=>fmtPlain(toDisplayUnit(fromDisplayUnit(v,oldUnit),newUnit));
  for(const k of Object.keys(d)){
    if(k.startsWith("__")||!k.endsWith("_load"))continue;
    const v=d[k];if(v===""||v==null)continue;
    const n=parseDec(v);if(!Number.isFinite(n))continue;
    d[k]=conv(n);changed=true}
  if(Object.prototype.hasOwnProperty.call(d,"__bodyweight")){
    const bw=d.__bodyweight;
    if(bw!==""&&bw!=null){
      const n=parseDec(bw);
      if(Number.isFinite(n)){d.__bodyweight=conv(n);changed=true}}}
  return changed?JSON.stringify(d):raw}
function draftUnitConversionEffect(expectedRaw,oldUnit,newUnit){
  if(oldUnit===newUnit)return null;
  if(expectedRaw==null)return destructiveDraftClearEffect(null);
  return draftEffectOutcome({required:true,kind:"replace-draft",expectedRaw,
    replacementRaw:convertDraftUnitsRaw(expectedRaw,oldUnit,newUnit),
    precondition:DRAFT_PRECONDITION_ABORT_CHANGED})}
const posNum=(v,f=0)=>{const n=parseDec(v);return Math.max(0,Number.isFinite(n)?n:f)};
const isWork=r=>!r.warmup;
const movementToken=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
const loggedMovementName=row=>String(row?.performedName||row?.name||"");
const movementIdKey=id=>String(id||"").startsWith("library:")?String(id):`movement:${id}`;
const liftKey=row=>row?.performedLibraryId?`library:${row.performedLibraryId}`:
  row?.performedMovementId?movementIdKey(row.performedMovementId):`name:${movementToken(loggedMovementName(row))}`;
const exerciseLiftKey=ex=>ex?.libraryId?`library:${ex.libraryId}`:
  ex?.movementId?movementIdKey(ex.movementId):`name:${movementToken(ex?.name)}`;
const exerciseLabel=row=>String(row?.name||row?.performedName||"");
const displayName=row=>loggedMovementName(row);
const currentExerciseForLiftKey=key=>(state.program||[]).find(ex=>exerciseLiftKey(ex)===key)||null;
/* Search-only bridge from a logged row back to what the program calls that
   movement today. History itself never renames what was performed — the row
   keeps its immutable label — but a lifter who renamed a movement still looks
   for old sessions under the new name. Only movement identity crosses:
   `library:<id>`, or the `movement:` id a slot mints and gives up the moment
   the slot is repointed at something else. The structural slot id never does,
   so a replaced slot cannot pull the previous movement's history along. */
function currentMovementNames(){
  const byKey=new Map();
  for(const ex of state.program||[]){
    const key=exerciseLiftKey(ex);
    if(!key||key.startsWith("name:"))continue;
    const name=String(ex?.name||"").trim();
    if(name&&!byKey.has(key))byKey.set(key,name)}
  return byKey}
const currentNameForRow=(row,byKey)=>
  row?.performedLibraryId||row?.performedMovementId?byKey.get(liftKey(row))||"":"";
function exerciseIdentityFromRow(row){
  return{libraryId:row?.performedLibraryId||undefined,movementId:row?.performedMovementId||undefined,
    name:loggedMovementName(row),id:row?.exerciseId,day:row?.day}}
// Muscles for a log row: prefer the immutable performed snapshot. Old rows may
// fall back to their own template snapshot/name, never a reused live slot id.
const rowMuscles=row=>{
  // A swapped set is credited to what was performed. Rows saved before the
  // snapshot existed carry no performedPrimary and keep their template values.
  if(row.performedPrimary!=null||row.performedSecondary!=null)
    return{primary:row.performedPrimary||"",secondary:row.performedSecondary||""};
  if(row.primary!=null||row.secondary!=null)return{primary:row.primary||"",secondary:row.secondary||""};
  const ex=state.program.find(e=>e.name===row.name);
  return ex?{primary:ex.primary,secondary:ex.secondary}:{primary:"",secondary:""}};

/* The bundled programs are minted, not re-read. A program becomes the lifter's
   data the moment it exists, so these names and setup notes are resolved to the
   reader's language when the rows are built and never touched again — the same
   rule `program.beginner_name` already follows, and the reason a later language
   switch leaves an existing program exactly as the lifter left it. Rows carry
   the seed key rather than a literal so the alternates keep keying off it. */
const seedName=k=>t("seed.ex."+k);
const seedNote=k=>t("seed.note."+k);
const defaultAlternates={
  hack_or_pendulum_squat:["leg_press","pendulum_squat"],
  leg_press_45_quad:["hack_squat","belt_squat"],
  incline_converging_chest_press:["flat_chest_press_machine","dumbbell_incline_press"],
  neutral_grip_pulldown:["lat_pulldown","assisted_pull_up"]
};
const STARTER_ROWS=[
["Day 1",1,"hack_or_pendulum_squat",2,4,8,"Quads","Glutes,Adductors"],["Day 1",2,"seated_leg_curl",2,4,8,"Hamstrings",""] ,["Day 1",3,"incline_converging_chest_press",2,4,8,"Chest","Front delts,Triceps"],["Day 1",4,"chest_supported_row",2,4,8,"Mid/upper back","Lats,Rear delts,Biceps"],["Day 1",5,"machine_lateral_raise",2,6,8,"Side delts",""] ,["Day 1",6,"hip_adduction_machine",2,6,8,"Adductors",""] ,
["Day 2",1,"leg_press_45_quad",2,4,8,"Quads","Glutes,Adductors"],["Day 2",2,"smith_rdl_or_hip_hinge",2,4,8,"Hamstrings,Glutes","Spinal erectors"],["Day 2",3,"machine_shoulder_press",2,4,8,"Front delts","Side delts,Triceps"],["Day 2",4,"neutral_grip_pulldown",2,4,8,"Lats","Mid/upper back,Biceps"],["Day 2",5,"pec_deck",2,6,8,"Chest",""] ,["Day 2",6,"machine_preacher_curl",2,6,8,"Biceps",""] ,
["Day 3",1,"leg_extension",2,6,8,"Quads",""] ,["Day 3",2,"lying_or_seated_leg_curl",2,6,8,"Hamstrings",""] ,["Day 3",3,"machine_chest_dip_or_press",2,4,8,"Chest","Front delts,Triceps"],["Day 3",4,"plate_loaded_high_row",2,4,8,"Lats,Mid/upper back","Rear delts,Biceps"],["Day 3",5,"reverse_pec_deck",2,6,8,"Rear delts","Mid/upper back"],["Day 3",6,"cable_pressdown",2,6,8,"Triceps",""]
];
const starterProgram=()=>STARTER_ROWS.map(x=>{
  const ex={id:uid(),day:x[0],order:x[1],name:seedName(x[2]),sets:x[3],min:x[4],max:x[5],primary:x[6],secondary:x[7]};
  if(defaultAlternates[x[2]])ex.alternates=defaultAlternates[x[2]].map(seedName);
  return ex});

const BEGINNER_ROWS=[
["Day 1",1,"leg_press_quad_focus",2,4,8,"Quads","Glutes,Adductors"],
["Day 1",2,"seated_leg_curl",2,4,8,"Hamstrings",""],
["Day 1",3,"chest_press_machine",2,4,8,"Chest","Front delts,Triceps"],
["Day 1",4,"seated_row_machine",2,4,8,"Mid/upper back","Lats,Rear delts,Biceps"],
["Day 1",5,"lateral_raise_machine",2,6,8,"Side delts",""],
["Day 1",6,"hip_adduction_machine",2,6,8,"Adductors",""],
["Day 2",1,"leg_press_glute_focus",2,4,8,"Quads","Glutes,Adductors"],
["Day 2",2,"romanian_deadlift_machine",2,4,8,"Hamstrings,Glutes","Spinal erectors"],
["Day 2",3,"shoulder_press_machine",2,4,8,"Front delts","Side delts,Triceps"],
["Day 2",4,"lat_pulldown",2,4,8,"Lats","Mid/upper back,Biceps"],
["Day 2",5,"chest_fly_machine",2,6,8,"Chest",""],
["Day 2",6,"preacher_curl_machine",2,6,8,"Biceps",""],
["Day 3",1,"leg_extension",2,6,8,"Quads",""],
["Day 3",2,"leg_curl_machine",2,6,8,"Hamstrings",""],
["Day 3",3,"chest_press_flat",2,4,8,"Chest","Front delts,Triceps"],
["Day 3",4,"high_row_machine",2,4,8,"Lats,Mid/upper back","Rear delts,Biceps"],
["Day 3",5,"reverse_fly_machine",2,6,8,"Rear delts","Mid/upper back"],
["Day 3",6,"triceps_pushdown",2,6,8,"Triceps",""]
];
const BEGINNER_ALTERNATES={
  leg_press_quad_focus:["hack_squat_machine","pendulum_squat"],
  lat_pulldown:["assisted_pull_up","neutral_grip_pulldown"]
};
const beginnerProgram=()=>BEGINNER_ROWS.map(x=>{
  const ex={id:uid(),day:x[0],order:x[1],name:seedName(x[2]),sets:x[3],min:x[4],max:x[5],primary:x[6],secondary:x[7],notes:seedNote(x[2])};
  if(BEGINNER_ALTERNATES[x[2]])ex.alternates=BEGINNER_ALTERNATES[x[2]].map(seedName);
  return ex});

/* The single crossing from library entry to program template. Muscles and
   setup notes are copied rather than looked up through libraryId, so the audit
   and every other reader keep reading the template exactly as before — and the
   lifter stays free to edit any of it afterwards without detaching the slot. */
function exerciseFieldsFromLibrary(entry){
  return{name:libraryName(entry),primary:entry.primary||"",secondary:entry.secondary||"",
    notes:entry.notes||"",libraryId:entry.id,displayName:null}}

function normalizeProgressionEnvelope(value){
  const validator=typeof window!=="undefined"?window.RepForgeProgression:null;
  const checked=validator?.validatePrescription?.(value);
  return checked?.ok?cloneSnapshot(checked.value):null}
function progressionIncompatibility(kind,value,checked,source){
  return{version:1,kind,source:source||"state-restore",reason:Array.isArray(checked?.issues)?checked.issues.join("; "):"incompatible",value:cloneSnapshot(value)}
}
function normalizeProgressionRelations(value,program=[],options={}){
  const validator=typeof window!=="undefined"?window.RepForgeProgression:null;
  const checked=validator?.validateRelations?.(value,{slots:program});
  if(!checked?.ok&&options.preserveInvalid&&value!=null&&Array.isArray(options.incompatibilities))
    options.incompatibilities.push(progressionIncompatibility("relations",value,checked,options.source));
  return checked?.ok?cloneSnapshot(checked.value):[]}
function normalizeProgressionModifiers(value,options={}){
  const validator=typeof window!=="undefined"?window.RepForgeProgression:null;
  const checked=validator?.validateModifiers?.(value);
  if(!checked?.ok&&options.preserveInvalid&&value!=null&&Array.isArray(options.incompatibilities))
    options.incompatibilities.push(progressionIncompatibility("modifiers",value,checked,options.source));
  return checked?.ok?cloneSnapshot(checked.value):[]}

/* ============================================================
   Program model
   Exercise — one movement: day, sequence, rep range, muscles.
   Program — the whole split. Single source of truth for editing,
   ordering, day grouping, and the weekly volume audit. Persisted
   as plain objects (see toJSON) so backups stay forward-compatible.
   ============================================================ */
class Exercise{
  constructor(d={}){
    this.id=d.id||uid();
    this.day=String(d.day??"").trim()||"Day 1";
    this.order=Number.isFinite(+d.order)?+d.order:1;
    this.name=String(d.name??"").trim()||"Exercise";
    this.sets=Exercise.posInt(d.sets,2);
    this.min=Exercise.posInt(d.min,4);
    this.max=Math.max(this.min,Exercise.posInt(d.max,8));
    this.primary=String(d.primary??"");
    this.secondary=String(d.secondary??"");
    this.notes=String(d.notes??"").trim();
    this.alternates=Array.isArray(d.alternates)?d.alternates.map(s=>String(s).trim()).filter(Boolean):
      typeof d.alternates==="string"?d.alternates.split(",").map(s=>s.trim()).filter(Boolean):[];
    if(d.libraryId!=null)this.libraryId=String(d.libraryId).trim();
    if(d.movementId!=null&&String(d.movementId).trim())this.movementId=String(d.movementId).trim();
    else if(d.libraryId==null)this.movementId=`slot:${this.id}`;
    // An alias names the machine in front of the lifter ("Hammer Strength row")
    // without claiming the slot is a different movement. Identity stays with
    // libraryId; only the label moves.
    if(d.displayName!=null&&String(d.displayName).trim())this.displayName=String(d.displayName).trim();
    if(d.progressionType!=null)this.progressionType=String(d.progressionType).trim();
    if(d.targetRirStart!=null&&Number.isFinite(+d.targetRirStart))this.targetRirStart=+d.targetRirStart;
    if(d.targetRirEnd!=null&&Number.isFinite(+d.targetRirEnd))this.targetRirEnd=+d.targetRirEnd;
    if(d.minSets!=null&&Number.isFinite(+d.minSets)&&+d.minSets>0)this.minSets=Math.round(+d.minSets);
    if(d.maxSets!=null&&Number.isFinite(+d.maxSets)&&+d.maxSets>0)this.maxSets=Math.round(+d.maxSets);
    if(d.priority!=null)this.priority=String(d.priority).trim();
    if(d.progression!=null){
      const progression=normalizeProgressionEnvelope(d.progression);
      if(progression)this.progression=progression;
      else this.progressionIncompatibility=progressionIncompatibility("prescription",d.progression,null,"program-json");
    }
    if(d.progressionIncompatibility!=null&&!this.progression)
      this.progressionIncompatibility=cloneSnapshot(d.progressionIncompatibility);
  }
  static posInt(v,fallback){const n=Math.round(+v);return Number.isFinite(n)&&n>0?n:fallback}
  /* Resolves a linked slot's label and muscles from the library definition, so
     the stored template can never disagree with the id it carries. name and
     primary/secondary stay written out as plain strings — every reader (volume
     audit, CSV, text export, backups) keeps working unchanged — but for a
     linked slot they are derived, not authored. */
  resolveIdentity(entries){
    if(this.libraryId===undefined)return this;
    const entry=entries?entries(this.libraryId):libraryEntry(this.libraryId);
    if(!entry){
      // The definition is gone (an import referencing an unknown id). Keep the
      // copied strings and drop the link rather than pretend it resolves.
      delete this.libraryId;delete this.displayName;
      return this}
    this.name=this.displayName||libraryName(entry);
    this.primary=entry.primary||"";
    this.secondary=entry.secondary||"";
    return this}
  toJSON(){const o={id:this.id,day:this.day,order:this.order,name:this.name,sets:this.sets,min:this.min,max:this.max,primary:this.primary,secondary:this.secondary,notes:this.notes,alternates:this.alternates};
    if(this.libraryId!==undefined)o.libraryId=this.libraryId;
    if(this.movementId!==undefined)o.movementId=this.movementId;
    if(this.displayName!==undefined)o.displayName=this.displayName;
    if(this.progressionType!==undefined)o.progressionType=this.progressionType;
    if(this.targetRirStart!==undefined)o.targetRirStart=this.targetRirStart;
    if(this.targetRirEnd!==undefined)o.targetRirEnd=this.targetRirEnd;
    if(this.minSets!==undefined)o.minSets=this.minSets;
    if(this.maxSets!==undefined)o.maxSets=this.maxSets;
    if(this.priority!==undefined)o.priority=this.priority;
    if(this.progression!==undefined)o.progression=cloneSnapshot(this.progression);
    if(this.progressionIncompatibility!==undefined)o.progressionIncompatibility=cloneSnapshot(this.progressionIncompatibility);
    return o}
}

class Program{
  /* lookup lets a caller resolve against a snapshot's own custom definitions —
     import and normalizeLoaded work on state that is not live yet. */
  constructor(list=[],lookup=null){const ids=new Set();
    this.exercises=(Array.isArray(list)?list:[]).map(e=>{const ex=new Exercise(e);if(ids.has(ex.id))ex.id=uid();ids.add(ex.id);
      return ex.resolveIdentity(lookup)});
    this.renumber()}
  days(){return [...new Set(this.exercises.map(e=>e.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
  forDay(d){return this.exercises.filter(e=>e.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
  find(id){return this.exercises.find(e=>e.id===id)}
  renumber(){for(const d of this.days())this.forDay(d).forEach((e,i)=>e.order=i+1)}
  toJSON(){return this.exercises.map(e=>e.toJSON())}
  update(id,field,value){const e=this.find(id);if(!e)return;
    if(field==="sets")e.sets=Exercise.posInt(value,e.sets);
    else if(field==="min"){e.min=Exercise.posInt(value,e.min);if(e.max<e.min)e.max=e.min;}
    else if(field==="max"){e.max=Exercise.posInt(value,e.max);if(e.min>e.max)e.min=e.max;}
    else if(field==="alternates")e.alternates=String(value??"").split(",").map(s=>s.trim()).filter(Boolean);
    else if(field==="name"){
      const next=String(value??"").trim();
      // On a linked slot a rename is an alias, never a change of movement: the
      // canonical name comes back if the alias is cleared or matches it.
      if(e.libraryId!==undefined){
        const entry=libraryEntry(e.libraryId);
        if(entry&&next&&next!==libraryName(entry))e.displayName=next;
        else delete e.displayName;
        e.resolveIdentity();
        return}
      e.name=next}
    else if(field==="primary"||field==="secondary"){
      // Muscles are the definition's, not the slot's. A linked slot ignores
      // the edit; the editor disables the field and offers Detach instead.
      if(e.libraryId!==undefined)return;
      e[field]=String(value??"").trim()}
    else if(field==="notes")e.notes=String(value??"").trim();}
  /* Breaks the library link, keeping the movement exactly as it reads today.
     The slot becomes plain editable text — which is what a lifter asking to
     change a canonical movement's muscles actually wants. */
  detachExercise(id){const e=this.find(id);if(!e||e.libraryId===undefined)return null;
    e.movementId=`library:${e.libraryId}`;delete e.libraryId;delete e.displayName;return e}
  addExercise(day,entry=null){const order=Math.max(0,...this.forDay(day).map(e=>e.order))+1;
    const e=new Exercise(Object.assign({day,order,name:t("program.default.exercise"),sets:3,min:6,max:10},
      entry?exerciseFieldsFromLibrary(entry):null));this.exercises.push(e);return e}
  /* Repoints a structural slot at another movement. The slot id stays stable so
     draft inputs and ordering survive; movement history is keyed independently. */
  replaceExercise(id,entry){const e=this.find(id);if(!e||!entry)return null;
    delete e.displayName;delete e.movementId;
    Object.assign(e,exerciseFieldsFromLibrary(entry));
    if(e.max<e.min)e.max=e.min;
    return e}
  removeExercise(id){this.exercises=this.exercises.filter(e=>e.id!==id);this.renumber()}
  move(id,dir){const e=this.find(id);if(!e)return;const list=this.forDay(e.day),i=list.indexOf(e),j=i+dir;
    if(j<0||j>=list.length)return;[list[i].order,list[j].order]=[list[j].order,list[i].order]}
  addDay(){const ds=this.days();let n=ds.length+1,name=`Day ${n}`;while(ds.includes(name))name=`Day ${++n}`;
    this.exercises.push(new Exercise({day:name,order:1,name:t("program.default.exercise"),sets:3,min:6,max:10}));return name}
  renameDay(oldName,newName){const nv=String(newName).trim();if(!nv||nv===oldName)return false;
    if(this.days().includes(nv))return false;
    for(const e of this.exercises)if(e.day===oldName)e.day=nv;this.renumber();return true}
  removeDay(d){this.exercises=this.exercises.filter(e=>e.day!==d)}
  volume(){const m=new Map();for(const e of this.exercises){
    for(const x of muscles(e.primary))addVol(m,x,e.sets,0);
    for(const x of muscles(e.secondary))addVol(m,x,0,e.sets*.5)}return m}
}

const DAY_TYPES={full_body:["squat","hinge","press","pull","delts","arms"],upper:["press","row","pulldown","delts","chest_iso","arms"],
  lower:["squat","hinge","leg_curl","leg_extension","calves"],push:["press","incline_press","shoulder_press","lateral_raise","triceps"],
  pull:["row","pulldown","rear_delt","curl"],legs:["squat","hinge","leg_curl","leg_extension","adduction","calves"]};
const SESSION_BOUNDS={short:[4,5],normal:[5,7],long:[7,9]};
const FILLER_SLOTS=["curl","triceps","lateral_raise","chest_iso","calves","leg_curl"];
/* The exercise library. exercises.js is generated (see tools/README.md) and
   loads before this file; the fallback keeps app.js parseable and the app
   usable if that script is ever missing, rather than throwing at boot. */
const LIBRARY_SOURCE=(typeof window!=="undefined"&&window.RepForgeExercises)||{library:[],legacyIds:{}};
const EXERCISE_LIBRARY=Array.isArray(LIBRARY_SOURCE.library)?LIBRARY_SOURCE.library:[];
const LEGACY_LIBRARY_IDS=LIBRARY_SOURCE.legacyIds||{};
const LIBRARY_BY_ID=new Map(EXERCISE_LIBRARY.map(e=>[e.id,e]));
const SHARED_BUILT_IN_IDS=new Set(EXERCISE_LIBRARY.map(e=>e.id));
const SharedSetup=typeof window!=="undefined"?window.RepForgeSharedSetup:null;

/* Custom exercises a lifter created. They live in state so they survive across
   programs and show up in every picker beside the built-ins; the "custom:"
   prefix keeps their ids from ever colliding with a library id, including a
   library id added by a future regeneration. */
const CUSTOM_ID_PREFIX="custom:";
const isCustomLibraryId=id=>String(id||"").startsWith(CUSTOM_ID_PREFIX);
function customExercises(snapshot=state){
  const list=snapshot?.customExercises;
  return Array.isArray(list)?list:[]}
/* Ids merged into a single entry still sit in saved programs; resolve through
   the alias table before giving up on one. */
function libraryEntry(id,snapshot=state){
  if(id==null)return null;
  const key=String(id);
  if(isCustomLibraryId(key))return customExercises(snapshot).find(e=>e.id===key)||null;
  return LIBRARY_BY_ID.get(key)||LIBRARY_BY_ID.get(LEGACY_LIBRARY_IDS[key])||null}
/* Everything a picker can offer: the lifter's own movements first, because a
   custom entry exists precisely because the library did not have it. */
function pickableExercises(snapshot=state){
  return customExercises(snapshot).filter(e=>!e.archived).concat(EXERCISE_LIBRARY)}
const libraryName=e=>!e?"":(isPt()&&e.namePt)||e.name;
function resolveSplit(daysPerWeek,splitType){
  const n=Math.max(1,Math.min(7,Math.round(+daysPerWeek)||3)),st=splitType||"full_body";
  if(st==="full_body"||st==="machine_only")return Array.from({length:n},()=>"full_body");
  if(st==="upper_lower")return Array.from({length:n},(_,i)=>i%2?"lower":"upper");
  if(st==="ppl"){const c=["push","pull","legs"];return Array.from({length:n},(_,i)=>c[i%3]);}
  if(st==="bro"){const c=n<=3?["push","pull","legs"]:n===4?["push","pull","legs","upper"]:["push","pull","legs","push","pull","legs"];
    return Array.from({length:n},(_,i)=>c[i%c.length]);}
  return Array.from({length:n},()=>"full_body")}
function exerciseSlotsForDay(dayType,answers){return[...(DAY_TYPES[dayType]||DAY_TYPES.full_body)]}
function catalogForSlot(slot,equipment,experience){
  const eq=new Set((equipment||[]).map(s=>String(s).toLowerCase()));
  let pool=EXERCISE_LIBRARY.filter(e=>e.patterns.includes(slot));
  if(eq.size)pool=pool.filter(e=>e.equipment.some(x=>eq.has(String(x).toLowerCase())));
  if(experience==="beginner"){const bf=pool.filter(e=>e.beginnerFriendly);if(bf.length)pool=bf}
  // Rank first, id second: the staple for a slot leads, and the rest stay in a
  // stable order so the same answers keep generating the same program.
  return pool.sort((a,b)=>(a.rank??50)-(b.rank??50)||a.id.localeCompare(b.id))}
function rotateCatalog(pool,occurrence){
  if(!pool.length)return pool;
  const n=pool.length,i=((occurrence%n)+n)%n;
  return i?pool.slice(i).concat(pool.slice(0,i)):pool}
function chooseExercise(slot,equipment,experience,usedIds,occurrence){
  // Rotate the equipment-filtered pool across repeated day types; never reuse a within-day id.
  const pool=rotateCatalog(catalogForSlot(slot,equipment,experience),occurrence||0).filter(e=>!usedIds.has(e.id));
  return pool[0]||null}
/* Whether a day type is worth generating on this equipment. One fillable slot
   used to be enough, which was fine when the catalogue was small: a slot with
   no candidates meant the equipment genuinely could not train that pattern. A
   267-movement library finds a candidate for almost anything — cables alone
   satisfy a lower day through pull-throughs and calf raises — so "any slot" now
   waves through days nobody would want to train. Require enough of the day to
   fill instead, and the wizard keeps steering people to equipment that can
   actually carry the split. */
function dayTypeHasPrimary(dayType,equipment,experience){
  const slots=exerciseSlotsForDay(dayType);
  if(!slots.length)return false;
  const fillable=slots.filter(slot=>catalogForSlot(slot,equipment,experience).length>0).length;
  return fillable*2>=slots.length}
function equipmentSupportsSplit(daysPerWeek,splitType,equipment,experience){
  return resolveSplit(daysPerWeek,splitType).every(dt=>dayTypeHasPrimary(dt,equipment,experience))}
function repScheme(experience,goal,slot){
  let sets=experience==="beginner"?2:3,min=experience==="beginner"?8:6,max=experience==="beginner"?12:10;
  if(goal==="strength"){min=4;max=6;sets=experience==="beginner"?3:4}
  const iso=["lateral_raise","rear_delt","chest_iso","curl","triceps","calves","leg_curl","leg_extension","adduction","delts","arms"];
  if(goal!=="strength"&&iso.includes(slot)){min=Math.max(min,8);max=Math.max(max,12)}
  return{sets,min,max}}
function muscleHit(ex,muscle){const m=muscle.toLowerCase();
  return muscles(ex.primary).concat(muscles(ex.secondary)).some(x=>x.toLowerCase()===m||x.toLowerCase().includes(m))}
function applyPriorityMuscles(program,priorityMuscles,equipment,experience){
  if(!priorityMuscles?.length)return;
  for(const ex of program){
    if(priorityMuscles.some(m=>muscleHit(ex,m)))ex.sets=Math.min(ex.sets+1,5)}
  for(const muscle of priorityMuscles){
    if(program.some(ex=>muscleHit(ex,muscle)))continue;
    const day=program[0]?.day||"Day 1";
    const slot=muscle.includes("Quad")?"leg_extension":muscle.includes("Chest")?"chest_iso":muscle.includes("Bicep")?"curl":
      muscle.includes("Tricep")?"triceps":muscle.includes("Ham")?"leg_curl":muscle.includes("Glute")?"hinge":
      muscle.includes("Lat")||muscle.includes("Back")?"row":muscle.includes("delt")?"lateral_raise":"curl";
    const entry=chooseExercise(slot,equipment,experience,new Set(program.map(e=>e.libraryId)));
    if(!entry)continue;
    const rs=repScheme("intermediate","hypertrophy",slot);
    program.push({id:uid(),day,order:program.filter(e=>e.day===day).length+1,name:libraryName(entry),sets:rs.sets,min:rs.min,max:rs.max,
      primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id})}}
function pickFillerForDay(dayExs,usedIds,equipment,experience,occurrence){
  const have=new Set(dayExs.map(e=>e.libraryId));
  for(const slot of FILLER_SLOTS){
    const entry=chooseExercise(slot,equipment,experience,new Set([...usedIds,...have]),occurrence);
    if(!entry||have.has(entry.id))continue;
    const rs=repScheme(experience,"hypertrophy",slot);
    return{id:uid(),day:dayExs[0].day,order:dayExs.length+1,name:libraryName(entry),sets:rs.sets,min:rs.min,max:rs.max,
      primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id}}
  return null}
function applySessionLength(program,sessionLength,equipment,experience,dayOcc){
  const [lo,hi]=SESSION_BOUNDS[sessionLength]||SESSION_BOUNDS.normal,out=[];
  const days=[...new Set(program.map(e=>e.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  for(const day of days){
    let list=program.filter(e=>e.day===day).sort((a,b)=>a.order-b.order);
    if(list.length>hi)list=list.slice(0,hi);
    const used=new Set(list.map(e=>e.libraryId));
    const occ=dayOcc?.[day]||0;
    while(list.length<lo){const extra=pickFillerForDay(list,used,equipment,experience,occ);if(!extra)break;used.add(extra.libraryId);list.push(extra)}
    list.forEach((e,i)=>{e.order=i+1;out.push(e)})}
  program.length=0;program.push(...out)}
function generateProgramFromOnboarding(answers){
  const a=answers||{},equipment=a.equipment||[],experience=a.experience||"intermediate",goal=a.goal||"hypertrophy";
  const dayTypes=resolveSplit(a.daysPerWeek,a.splitType),program=[],dayOcc={},seen={};
  dayTypes.forEach((dayType,di)=>{
    const occ=seen[dayType]|0;seen[dayType]=occ+1;
    const dayName=`Day ${di+1}`;dayOcc[dayName]=occ;
    const slots=exerciseSlotsForDay(dayType,a),usedIds=new Set();let order=0;
    for(const slot of slots){
      const entry=chooseExercise(slot,equipment,experience,usedIds,occ);if(!entry)continue;
      usedIds.add(entry.id);order++;
      const rs=repScheme(experience,goal,slot);
      program.push({id:uid(),day:dayName,order,name:libraryName(entry),sets:rs.sets,min:rs.min,max:rs.max,
        primary:entry.primary,secondary:entry.secondary||"",notes:entry.notes||"",libraryId:entry.id})}});
  applyPriorityMuscles(program,a.priorityMuscles||[],equipment,experience);
  applySessionLength(program,a.sessionLength||"normal",equipment,experience,dayOcc);
  return program}

let state,prog,day,installPrompt=null,saving=false,editSession=null,volWindow=7;
let restEnd=0,restTick=null,restNotified=false,restAnnounced=false;
// restPaused holds the milliseconds left while the clock is held (null while it
// runs); restLength is the length the current or next rest is armed at.
let restPaused=null,restLength=0;
function announceRestDone(){
  if(restAnnounced)return;
  restAnnounced=true;
  const el=$("#restAnnounce");if(!el)return;
  el.textContent="";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{el.textContent=t("rest.complete")}))}
let unfinishedTimer=null;
let lastCommitAt=0;             // module-level; hydrated from draft at boot
// When the first set of the open session landed. Only ever used to tell the
// lifter how long the session ran, so a resumed draft keeps the original stamp
// and a session that spans a reload still reads as one stretch of work.
let sessionStartedAt=0;         // module-level; hydrated from draft at boot
const UNFINISHED_MS=15*60*1000;

function clearUnfinishedWatch(){
  if(unfinishedTimer){clearTimeout(unfinishedTimer); unfinishedTimer=null}
  if(window.RepForgeNotify) RepForgeNotify.closeTag("repforge-unfinished");
}

function armUnfinishedWatch(delayMs=UNFINISHED_MS){
  clearUnfinishedWatch();
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  unfinishedTimer=setTimeout(onUnfinishedIdle, Math.max(0,delayMs));
}

// Single-reminder guarantee: remember which commit timestamp we already
// prompted for (in repforge_notify_v1), so reopening the app or receiving
// the OS notification does not produce repeat prompts for the same session.
function unfinishedAlreadyPrompted(){
  return loadNotifyMeta().unfinishedPromptedFor===lastCommitAt;
}
function markUnfinishedPrompted(){
  const m=loadNotifyMeta(); m.unfinishedPromptedFor=lastCommitAt; saveNotifyMeta(m);
}

function showUnfinishedPrompt(){
  markUnfinishedPrompted();
  document.body.dataset.unfinishedPrompt="1";
  const el=$("#unfinishedBanner");
  if(!el) return;
  el.classList.remove("hidden");
  el.hidden=false;
  const d=$("#unfinishedDismiss");
  if(d) d.onclick=()=>{ el.classList.add("hidden"); el.hidden=true; };
}

function onUnfinishedIdle(){
  unfinishedTimer=null;
  const draft=loadDraft();
  if(!(draft.__done||[]).length) return;
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  if(unfinishedAlreadyPrompted()) return;
  if(document.visibilityState==="visible") showUnfinishedPrompt();
  else RepForgeNotify.fireOS({title:t("notify.title"),body:t("notify.unfinished.body"),tag:"repforge-unfinished",url:"./index.html"}).then(ok=>{if(ok)markUnfinishedPrompted()});
}

function maybeUnfinishedOnOpen(){
  const draft=loadDraft();
  lastCommitAt=+draft.__lastCommitAt||0;   // hydrate module state from draft
  if(!RepForgeNotify.enabledFor(state.settings,"unfinished")) return;
  const done=(draft.__done||[]).length;
  if(!done||!lastCommitAt) return;
  if(unfinishedAlreadyPrompted()) return;  // single reminder per session
  const elapsed=Date.now()-lastCommitAt;
  if(elapsed>=UNFINISHED_MS) showUnfinishedPrompt();
  else armUnfinishedWatch(UNFINISHED_MS-elapsed);
}
const collapsed=new Set();
const skipped=new Set();
const substituted=new Map();
/* Which library definition a swap pointed at, when it came from the picker.
   The name alone cannot say what was trained: swapping a hack squat slot to a
   lat pulldown has to move the volume too. Kept beside `substituted` rather
   than folded into it so old drafts (name-only) still hydrate. */
const substitutedRef=new Map();
const committed=new Set();
const touched=new Set();
const warmups=new Set();
let contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
function knownExerciseIds(){return new Set((state.program||[]).map(e=>e.id))}
function setKeyExerciseId(k){return String(k).replace(/_\d+$/,"")}
function retainSetKeys(list,known){return (list||[]).filter(k=>known.has(setKeyExerciseId(k)))}
function contextFlagsFromDraft(d){
  const flags=d&&typeof d.__contextTouched==="object"&&d.__contextTouched?d.__contextTouched:{};
  return {day:!!flags.day,date:!!flags.date,sessionNotes:!!flags.sessionNotes,bodyweight:!!flags.bodyweight}}
function hydrateDraftCollections(d){
  const known=knownExerciseIds();
  sessionStartedAt=+d.__startedAt||0;
  committed.clear();retainSetKeys(d.__done,known).forEach(k=>committed.add(k));
  touched.clear();retainSetKeys(d.__touched,known).forEach(k=>touched.add(k));
  warmups.clear();retainSetKeys(d.__warm,known).forEach(k=>warmups.add(k));
  skipped.clear();(d.__skipped||[]).forEach(id=>{if(known.has(id))skipped.add(id)});
  substituted.clear();substitutedRef.clear();
  const subs=d.__substituted&&typeof d.__substituted==="object"?d.__substituted:{};
  const refs=d.__substitutedRef&&typeof d.__substitutedRef==="object"?d.__substitutedRef:{};
  for(const [id,name] of Object.entries(subs)){
    if(!known.has(id))continue;
    const n=String(name||"").trim().slice(0,80);
    if(n)substituted.set(id,n)}
  for(const [id,libId] of Object.entries(refs)){
    if(!substituted.has(id))continue;
    const ref=String(libId||"").trim();
    if(ref&&libraryEntry(ref))substitutedRef.set(id,ref)}
  // Drafts written before substitution references existed saved only a label.
  // Recover an unambiguous library identity so resuming cannot credit the slot.
  const byName=new Map();
  for(const entry of pickableExercises()){
    for(const label of [entry.name,entry.namePt,libraryName(entry)]){
      const key=movementToken(label);if(!key)continue;
      if(!byName.has(key))byName.set(key,entry.id);else if(byName.get(key)!==entry.id)byName.set(key,null)}}
  for(const [id,name] of substituted){
    if(substitutedRef.has(id))continue;
    const ref=byName.get(movementToken(name));if(ref)substitutedRef.set(id,ref)}}
function hydrateWorkoutDraft({restoreDay=false}={}){
  const d=loadDraft();
  hydrateDraftCollections(d);
  contextTouched=contextFlagsFromDraft(d);
  if(restoreDay&&typeof d.__day==="string"&&days().includes(d.__day)) day=d.__day;
  return d}
function applyDraftContextToDom(){
  const d=loadDraft(),dateEl=$("#date"),bwEl=$("#bodyweight"),notesEl=$("#notes");
  if(dateEl) dateEl.value=Object.prototype.hasOwnProperty.call(d,"__date")?d.__date:today();
  if(bwEl) bwEl.value=Object.prototype.hasOwnProperty.call(d,"__bodyweight")?d.__bodyweight:lastBodyweight();
  if(notesEl) notesEl.value=Object.prototype.hasOwnProperty.call(d,"__sessionNotes")?d.__sessionNotes:"";
}
function resetSessionContextFields(){
  contextTouched={day:false,date:false,sessionNotes:false,bodyweight:false};
  const notesEl=$("#notes"),dateEl=$("#date"),bwEl=$("#bodyweight");
  if(notesEl)notesEl.value="";
  if(dateEl)dateEl.value=today();
  if(bwEl)bwEl.value=lastBodyweight();
}
function draftHasSessionWork(d){
  d=d||loadDraft();
  if((d.__done||[]).length||(d.__touched||[]).length||(d.__warm||[]).length) return true;
  if((d.__skipped||[]).length) return true;
  if(d.__substituted&&typeof d.__substituted==="object"&&Object.keys(d.__substituted).length) return true;
  const flags=contextFlagsFromDraft(d);
  if(flags.date||flags.sessionNotes||flags.bodyweight) return true;
  if(Object.prototype.hasOwnProperty.call(d,"__sessionNotes")||Object.prototype.hasOwnProperty.call(d,"__bodyweight")||Object.prototype.hasOwnProperty.call(d,"__date")){
    if(flags.date||flags.sessionNotes||flags.bodyweight) return true}
  return Object.keys(d).some(k=>/_load$/.test(k)&&parseDec(d[k])>0)}
function draftHasProgressInRemovedSets(exerciseId,nextSets,currentSets,d){
  if(nextSets>=currentSets)return false;
  d=d||loadDraft();
  const marked=new Set(["__done","__touched","__warm"].flatMap(k=>Array.isArray(d[k])?d[k]:[]));
  for(let n=nextSets+1;n<=currentSets;n++){
    const key=`${exerciseId}_${n}`;
    if(marked.has(key)||parseDec(d[`${key}_load`])>0)return true}
  return false}
function requestWorkoutDay(nextDay){
  if(!nextDay||nextDay===day) return true;
  if(draftHasProgress()){
    if(!confirm(t("confirm.discard_draft"))){
      return false}
    clearDraft();
    resetSessionContextFields()}
  day=nextDay;
  contextTouched.day=true;
  saveDraft({fromDom:false});
  return true}
function changeRirMode(newMode){
  const old=state.settings.rirMode==="effort"?"effort":"numeric";
  const next=newMode==="effort"?"effort":"numeric";
  if(old===next) return true;
  if(draftHasProgress()){
    $$('input[name="rirMode"]').forEach(r=>{r.checked=old==="effort"?r.value==="effort":r.value!=="effort"});
    toast(t("toast.rir_locked_draft"));
    return false}
  return true}
function applySkipToggle(id){
  if(skipped.has(id)) skipped.delete(id);
  else{skipped.add(id);substituted.delete(id);substitutedRef.delete(id)}
  if(logMode==="focus"){const fl=focusList();focusIndex=Math.min(focusIndex,Math.max(0,fl.length-1))}
  saveDraft();renderWorkout()}
function applyShowAll(){skipped.clear();saveDraft();renderWorkout()}
function applyPredefinedSub(id,name,libraryRef=null){
  const n=String(name||"").trim().slice(0,80);
  if(!n){substituted.delete(id);substitutedRef.delete(id)}
  else{substituted.set(id,n);skipped.delete(id);
    if(libraryRef)substitutedRef.set(id,libraryRef);else substitutedRef.delete(id)}
  saveDraft();renderWorkout()}
function applyCustomSub(id,raw,libraryRef=null){
  const name=String(raw||"").trim().slice(0,80);
  const progName=prog.find(id)?.name;
  if(!name||name===progName){substituted.delete(id);substitutedRef.delete(id)}
  else{substituted.set(id,name);skipped.delete(id);
    if(libraryRef)substitutedRef.set(id,libraryRef);else substitutedRef.delete(id)}
  saveDraft();renderWorkout()}
function sessionExercise(ex){
  if(!ex||!substituted.has(ex.id))return ex;
  const name=substituted.get(ex.id),ref=substitutedRef.get(ex.id),entry=ref?libraryEntry(ref):null;
  if(!entry)return Object.assign({},ex,{name,libraryId:undefined,movementId:`adhoc:${movementToken(name)}`});
  return Object.assign({},ex,exerciseFieldsFromLibrary(entry),{name,libraryId:entry.id})}
/* Mid-session swap. The slot's own movement stays in the list, and picking it
   is how a lifter undoes a swap — the alternative was a "back to X" row that
   means nothing until you already know what X was. */
function openSubstitutePicker(id){
  const ex=prog.find(id);if(!ex)return;
  const byName=new Map(pickableExercises().map(e=>[foldSearch(libraryName(e)),e]));
  const self=(ex.libraryId&&libraryEntry(ex.libraryId))||byName.get(foldSearch(ex.name))||null;
  openExercisePicker({title:t("picker.title_substitute"),subtitle:ex.name,
    onPick:entry=>{
      if(self&&entry.id===self.id)applyPredefinedSub(id,"");
      else applyCustomSub(id,libraryName(entry),entry.id)}})}
function fatigueFlagged(){return exercises().filter(e=>{const r=recommendation(sessionExercise(e));return r.status==="reduce"||r.stalled})}
function applyFatigueTrim(){
  skipped.clear();
  for(const e of fatigueFlagged())skipped.add(e.id);
  saveDraft();renderWorkout();toast(t("toast.trimmed_priority"))}
let logMode="full",focusIndex=0,statsSeg="overview",prFilter="all";
let focusDrag=null,focusFlinging=false;
/** Focus mode — the set being re-opened for edit: {exId,n,snap}. `snap` is the
 *  set as it stood when editing began, so cancelling puts it back untouched. */
let focusEdit=null;
/** Focus mode — the set just committed: {exId,n}. Set on the commit that
 *  logs a set and consumed by the render it triggers, which is the only one
 *  that plays the landing animation. Every later render draws the same card
 *  still, so a re-render for an unrelated reason never replays it. */
let focusLogged=null;
/** True while the card being written is the one that just gained a set. */
const focusIsFresh=(ex,peek)=>!peek&&!!focusLogged&&focusLogged.exId===ex.id;
/** Exercises whose older logged sets the lifter unfolded from behind the
 *  disclosure row. Folding is the default once a session gets long. */
const focusUnfolded=new Set();
/** Sets logged before older rows fold away, and how many stay above the fold. */
const FOCUS_FOLD_MIN=5,FOCUS_FOLD_KEEP=2;
let exView=null;
let workoutActive=false,workoutLeft=false,programEditMode=false,histMonth=null,histQuery="",readyExpanded=false;
let settingsEditRevision=0;
// Today's session lists its first few exercises; the rest sit behind a "+N" row.
const TODAY_EX_PREVIEW=3;let todayExOpen=false;
const STATS_SEG={overview:"segOverview",strength:"segStrength",volume:"segVolume",prs:"segPRs",review:"segReview"};

function migrateLogSnapshot(snapshot){let changed=false;const lookup=snapshotLookup(snapshot.customExercises);
  for(const row of snapshot.log){
  const named=snapshot.program.find(e=>e.name===row.name&&e.day===row.day)||snapshot.program.find(e=>e.name===row.name);
  const slotted=snapshot.program.find(e=>e.id===row.exerciseId);
  const ex=named||(!slotted?.libraryId?slotted:null);
  if(!row.exerciseId&&ex){row.exerciseId=ex.id;changed=true}
  if(row.performedName==null&&row.name){row.performedName=String(row.name);changed=true}
  if(row.performedLibraryId==null&&ex?.libraryId){
    const entry=lookup(ex.libraryId),names=new Set([ex.name,entry?.name,entry?.namePt].map(movementToken).filter(Boolean));
    if(names.has(movementToken(row.name))){row.performedLibraryId=ex.libraryId;changed=true}}
  if(row.performedLibraryId==null&&row.performedMovementId==null&&ex?.movementId){
    row.performedMovementId=ex.movementId;changed=true}
  const performed=row.performedLibraryId?lookup(row.performedLibraryId):null;
  if(performed){
    if(row.performedPrimary==null){row.performedPrimary=performed.primary||"";changed=true}
    if(row.performedSecondary==null){row.performedSecondary=performed.secondary||"";changed=true}}
  else if(row.performedName===row.name){
    if(row.performedPrimary==null&&row.primary!=null){row.performedPrimary=String(row.primary||"");changed=true}
    if(row.performedSecondary==null&&row.secondary!=null){row.performedSecondary=String(row.secondary||"");changed=true}}
  const ld=posNum(row.load),rp=posNum(row.reps),rr=posNum(row.rir);
  if(ld!==row.load||rp!==row.reps||rr!==row.rir){row.load=ld;row.reps=rp;row.rir=rr;changed=true}}
  return changed}
function migrateLog(){return migrateLogSnapshot(state)}
function earliestLogDate(log){if(!log?.length)return null;return log.reduce((min,r)=>!min||String(r.date)<min?r.date:min,null)}
function defaultProgramMeta(log=[]){const now=new Date().toISOString();return{id:uid(),name:"",started:earliestLogDate(log),created:now,updated:now,
  goal:null,experience:null,daysPerWeek:null,splitType:null,equipment:[],priorityMuscles:[],sessionLength:null,
  mesocycleLengthWeeks:6,mesocycleStatus:"active",completedAt:null,onboarded:false,
  progressionRelations:[],progressionModifiers:[],progressionIncompatibilities:[]}}
function buildProgramMeta({name, answers}={}){
  const a=answers||{},now=new Date().toISOString();
  const programName=String(name??"").trim()||t("untitled_program")||"Untitled program";
  return{id:uid(),name:programName,started:today(),created:now,updated:now,
    goal:a.goal??null,experience:a.experience??null,daysPerWeek:a.daysPerWeek??null,splitType:a.splitType??null,
    equipment:Array.isArray(a.equipment)?a.equipment:[],priorityMuscles:Array.isArray(a.priorityMuscles)?a.priorityMuscles:[],
    sessionLength:a.sessionLength??null,mesocycleLengthWeeks:6,mesocycleStatus:"active",completedAt:null,onboarded:true,
    progressionRelations:[],progressionModifiers:[],
    blockPromptDismissedId:null}}
function normalizeProgramMeta(m,log=[],program=[],options={}){const now=new Date().toISOString(),base=defaultProgramMeta(log);
  if(!m||typeof m!=="object")return base;
  const started=typeof m.started==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(m.started)?m.started:(m.started===null?null:base.started);
  const goal=typeof m.goal==="string"?m.goal.trim()||null:m.goal===null?null:base.goal;
  const experience=typeof m.experience==="string"?m.experience.trim()||null:m.experience===null?null:base.experience;
  const daysPerWeek=Number.isFinite(+m.daysPerWeek)?+m.daysPerWeek:m.daysPerWeek===null?null:base.daysPerWeek;
  const splitType=typeof m.splitType==="string"?m.splitType.trim()||null:m.splitType===null?null:base.splitType;
  const equipment=Array.isArray(m.equipment)?m.equipment.map(s=>String(s).trim()).filter(Boolean):base.equipment;
  const priorityMuscles=Array.isArray(m.priorityMuscles)?m.priorityMuscles.map(s=>String(s).trim()).filter(Boolean):base.priorityMuscles;
  const sessionLength=typeof m.sessionLength==="string"?m.sessionLength.trim()||null:m.sessionLength===null?null:base.sessionLength;
  const mesocycleLengthWeeks=Number.isFinite(+m.mesocycleLengthWeeks)&&+m.mesocycleLengthWeeks>0?Math.round(+m.mesocycleLengthWeeks):base.mesocycleLengthWeeks;
  const mesocycleStatus=m.mesocycleStatus==="active"||m.mesocycleStatus==="completed"?m.mesocycleStatus:base.mesocycleStatus;
  const completedAt=typeof m.completedAt==="string"?m.completedAt:m.completedAt===null?null:base.completedAt;
  const onboarded=typeof m.onboarded==="boolean"?m.onboarded:base.onboarded;
  const blockPromptDismissedId=typeof m.blockPromptDismissedId==="string"&&m.blockPromptDismissedId?m.blockPromptDismissedId:null;
  const incompatibilities=Array.isArray(m.progressionIncompatibilities)?cloneSnapshot(m.progressionIncompatibilities):[];
  const progressionOptions={preserveInvalid:options.preserveInvalidProgression===true,incompatibilities,source:options.source};
  const progressionRelations=normalizeProgressionRelations(m.progressionRelations,program,progressionOptions);
  const progressionModifiers=normalizeProgressionModifiers(m.progressionModifiers,progressionOptions);
  return{id:typeof m.id==="string"&&m.id?m.id:base.id,name:typeof m.name==="string"?m.name.trim():"",started,
    created:typeof m.created==="string"?m.created:base.created,updated:typeof m.updated==="string"?m.updated:now,
    goal,experience,daysPerWeek,splitType,equipment,priorityMuscles,sessionLength,mesocycleLengthWeeks,mesocycleStatus,completedAt,onboarded,
    progressionRelations,progressionModifiers,progressionIncompatibilities:incompatibilities,blockPromptDismissedId}}
function isImportableState(s){return isValidStateShape(s)}
/* A custom exercise is a library entry the lifter authored, so it is normalised
   into the same shape the built-ins have — the pickers and the copy-into-template
   path then cannot tell the two apart. */
/* Resolves a library id against a specific custom list plus the built-ins. */
function snapshotLookup(customList){
  const own=new Map((Array.isArray(customList)?customList:[]).map(e=>[e.id,e]));
  return id=>{
    const key=String(id??"");
    if(isCustomLibraryId(key))return own.get(key)||null;
    return LIBRARY_BY_ID.get(key)||LIBRARY_BY_ID.get(LEGACY_LIBRARY_IDS[key])||null}}
function normalizeCustomExercises(list){
  const out=[],seen=new Set();
  for(const entry of Array.isArray(list)?list:[]){
    if(!isPlainStateObject(entry))continue;
    const id=String(entry.id||"");
    if(!id.startsWith(CUSTOM_ID_PREFIX)||seen.has(id))continue;
    const name=String(entry.name??"").trim();
    if(!name)continue;
    seen.add(id);
    const equipment=(Array.isArray(entry.equipment)?entry.equipment:[])
      .map(x=>String(x).trim().toLowerCase()).filter(Boolean);
    const archived=entry.archived===true;
    out.push({id,name,namePt:String(entry.namePt??name).trim()||name,archived,
      equipment:equipment.length?equipment:["machine"],
      primary:String(entry.primary??"").trim(),
      secondary:String(entry.secondary??"").trim(),
      notes:String(entry.notes??"").trim(),
      patterns:[],beginnerFriendly:true,custom:true,
      created:typeof entry.created==="string"?entry.created:new Date().toISOString()})}
  return out}
function normalizeProgramHistory(history,lookup){
  return(Array.isArray(history)?history:[]).map(entry=>{
    const normalized=cloneSnapshot(entry);
    if(Object.prototype.hasOwnProperty.call(normalized,"program"))
      normalized.program=new Program(normalized.program,lookup).toJSON();
    return normalized})}
function normalizeLoaded(s,options={}){
  if(s==null)return{settings:{...DEFAULTS},programMeta:defaultProgramMeta([]),program:starterProgram(),log:[],programHistory:[],customExercises:[],[STORAGE_REV]:0};
  if(!isValidStateShape(s))throw new TypeError("Invalid Taurifer state");
  const customs=normalizeCustomExercises(s.customExercises),lookup=snapshotLookup(customs);
  const out={settings:normalizeSettings(s.settings),programMeta:null,
    program:[],log:cloneSnapshot(s.log),
    programHistory:normalizeProgramHistory(Object.prototype.hasOwnProperty.call(s,"programHistory")?s.programHistory:[],lookup),
    customExercises:customs};
  // Resolved against this snapshot's own custom definitions: during an import
  // or a boot they are not in live state yet.
  out.program=new Program(s.program,lookup).toJSON();
  out.programMeta=normalizeProgramMeta(s.programMeta,s.log,out.program,options);
  out[STORAGE_REV]=readRevision(s);
  if(Object.prototype.hasOwnProperty.call(s,STORAGE_FOLLOWUP))out[STORAGE_FOLLOWUP]=s[STORAGE_FOLLOWUP];
  return out}
function proposalFromImport(incoming){
  if(!isValidStateShape(incoming))throw new TypeError("Invalid Taurifer backup");
  return normalizeLoaded(stripStorageMeta(incoming),{preserveInvalidProgression:true,source:"backup-restore"})}
async function replaceImportedState(incoming,io=storageIO,{discardDraftRaw=readDraftRaw()}={}){
  requireAdapter(io,"replaceImportedState");
  const transition=programTransitionPrecondition(state);
  const proposal=proposalFromImport(incoming);
  delete proposal[STORAGE_FOLLOWUP];
  migrateLogSnapshot(proposal);
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,io,{replace:true,effect,...transition});
  return result}
async function mergeImportedLog(incoming,io=storageIO){
  requireAdapter(io,"mergeImportedLog");
  if(!isValidStateShape(incoming))throw new TypeError("Invalid Taurifer backup");
  const rows=(incoming.log||[]).filter(r=>r&&r.session);
  const have=new Set(state.log.map(r=>r.session));
  const add=rows.filter(r=>!have.has(r.session));
  const added=new Set(add.map(r=>r.session)).size;
  if(!added)return{revision:readRevision(state),localOk:true,idbOk:true,added:0};
  const proposal=cloneSnapshot(state);
  proposal.log=proposal.log.concat(cloneSnapshot(add));
  migrateLogSnapshot(proposal);
  const result=await commitProposedState(proposal,io);
  result.added=added;
  return result}
function applyState(s){return replaceImportedState(s)}
async function persistProgramMeta(partial={}){
  const proposal=cloneSnapshot(state);
  if(!proposal.programMeta)proposal.programMeta=defaultProgramMeta(proposal.log);
  if(partial.name!==undefined)proposal.programMeta.name=String(partial.name??"").trim();
  if(partial.started!==undefined){const v=partial.started;proposal.programMeta.started=v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}
  if(partial.goal!==undefined)proposal.programMeta.goal=partial.goal;
  if(partial.experience!==undefined)proposal.programMeta.experience=partial.experience;
  if(partial.daysPerWeek!==undefined)proposal.programMeta.daysPerWeek=partial.daysPerWeek;
  if(partial.splitType!==undefined)proposal.programMeta.splitType=partial.splitType;
  if(partial.equipment!==undefined)proposal.programMeta.equipment=partial.equipment;
  if(partial.priorityMuscles!==undefined)proposal.programMeta.priorityMuscles=partial.priorityMuscles;
  if(partial.sessionLength!==undefined)proposal.programMeta.sessionLength=partial.sessionLength;
  if(partial.mesocycleStatus!==undefined)proposal.programMeta.mesocycleStatus=partial.mesocycleStatus;
  if(partial.onboarded!==undefined)proposal.programMeta.onboarded=partial.onboarded;
  proposal.programMeta.updated=new Date().toISOString();
  return commitProposedState(proposal)}
/* Creates or edits one of the lifter's own movements. Returns the stored entry
   so a caller can drop it straight into a program slot — creating a custom
   exercise is almost always the first half of "put this in my program". */
async function saveCustomExercise(draft,io=storageIO){
  const name=String(draft?.name??"").trim();
  if(!name)return{result:null,entry:null};
  const id=isCustomLibraryId(draft?.id)?String(draft.id):`${CUSTOM_ID_PREFIX}${uid()}`;
  const existing=customExercises().find(e=>e.id===id);
  const entry={id,name,namePt:name,
    equipment:Array.isArray(draft.equipment)&&draft.equipment.length?draft.equipment:["machine"],
    primary:String(draft.primary??"").trim(),
    secondary:String(draft.secondary??"").trim(),
    notes:String(draft.notes??"").trim(),
    created:existing?.created||new Date().toISOString()};
  const proposal=cloneSnapshot(state);
  const list=Array.isArray(proposal.customExercises)?proposal.customExercises:[];
  proposal.customExercises=normalizeCustomExercises(
    existing?list.map(e=>e.id===id?entry:e):list.concat(entry));
  const result=await commitProposedState(proposal,io);
  return{result,entry:proposal.customExercises.find(e=>e.id===id)||null}}
/* A definition with anything pointing at it — a program slot, an archived
   block, a logged set — is still the meaning of that data, so it is archived
   rather than deleted: hidden from the pickers, intact behind the history. */
function customExerciseInUse(id){
  if((state.program||[]).some(e=>e.libraryId===id))return true;
  if((state.log||[]).some(r=>r.performedLibraryId===id))return true;
  return(state.programHistory||[]).some(h=>(h?.program||[]).some(e=>e.libraryId===id))}
async function deleteCustomExercise(id,io=storageIO){
  if(!isCustomLibraryId(id))return null;
  const proposal=cloneSnapshot(state);
  if(customExerciseInUse(id)){
    const list=customExercises(proposal).map(e=>e.id===id?Object.assign(cloneSnapshot(e),{archived:true}):e);
    if(!list.some(e=>e.id===id))return null;
    proposal.customExercises=list;
    const result=await commitProposedState(proposal,io);
    return result?Object.assign(result,{archived:true}):result}
  proposal.customExercises=customExercises(proposal).filter(e=>e.id!==id);
  return commitProposedState(proposal,io)}
function programAdherence(asOf=today()){const totalDays=prog.days().length;if(!totalDays)return{logged:0,total:0,ratio:0};
  // Inclusive rolling [asOf-6, asOf] — distinct planned days; future rows excluded.
  const end=asOf,start=shiftDate(end,-6),programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const logged=loggedDays.size;return{logged,total:totalDays,ratio:totalDays?logged/totalDays:0}}
window.__repforgeProgramAdherence=programAdherence;
function weeklySnapshot(date=today()){const{start,end}=weekRange(date),weekStart=start,weekEnd=end;
  const completedSessions=sessionsInRange(start,end).length,plannedDays=prog.days().length,programDaySet=new Set(prog.days()),loggedDays=new Set();
  for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(programDaySet.has(x.day))loggedDays.add(x.day)}
  const completedDays=loggedDays.size,adherence=plannedDays?completedDays/plannedDays:0,hr=+state.settings.hardRir;
  let totalWorkingSets=0,totalHardSets=0;for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;
    if(!isWork(x)||!(+x.load>0&&+x.reps>0))continue;totalWorkingSets++;if(+x.rir<=hr)totalHardSets++}
  const prs=detectPRs(state.log).filter(ev=>String(ev.date)>=start&&String(ev.date)<=end);
  const trained=new Map();for(const x of state.log){if(String(x.date)<start||String(x.date)>end)continue;if(!isWork(x)||!(+x.load>0))continue;
    const k=liftKey(x),cur=trained.get(k);if(!cur||String(x.created)>String(cur.created))trained.set(k,{session:x.session,created:x.created})}
  let improvedLifts=0,flatLifts=0,regressedLifts=0,fatigueFlags=0;
  for(const[k,sess]of trained){
    const rows=state.log.filter(r=>r.session===sess.session&&liftKey(r)===k);if(!rows.length)continue;
    const current=currentExerciseForLiftKey(k),ex=current||exerciseIdentityFromRow(rows[0]),cmp=compareExerciseSession(ex,rows);
    if(cmp.status==="improved")improvedLifts++;else if(cmp.status==="flat")flatLifts++;else if(cmp.status==="regressed")regressedLifts++;
    if(current){const r=recommendation(current);if(r.status==="reduce"||r.stalled)fatigueFlags++}}
  let readyToAdd=0;for(const ex of prog.exercises){const st=recommendation(ex).status;if(st==="add"||st==="add2")readyToAdd++}
  let status;if(completedSessions===0)status=t("status.needs_more_data");
  else if(adherence>=.85&&improvedLifts>=flatLifts)status=t("status.on_track");
  else if(adherence>=.65&&prs.length>0)status=t("status.productive_week");
  else if(fatigueFlags>=2)status=t("status.high_fatigue");
  else if(adherence<.5)status=t("status.under_target");
  else status=t("status.rebuilding");
  return{weekStart,weekEnd,plannedDays,completedDays,completedSessions,totalWorkingSets,totalHardSets,prs,improvedLifts,flatLifts,regressedLifts,readyToAdd,status}}
window.__repforgeWeeklySnapshot=weeklySnapshot;
function mesocycleLifecycle(programMeta){
  const meta=programMeta||{},total=+meta.mesocycleLengthWeeks||6,s=meta.started;
  let elapsedWeek=null;
  if(s){const start=new Date(`${s}T12:00:00`),now=new Date(`${today()}T12:00:00`);
    const days=Math.floor((now-start)/86400000);elapsedWeek=days<0?1:Math.floor(days/7)+1}
  const current=elapsedWeek==null?null:Math.min(elapsedWeek,total);
  const overrunWeeks=elapsedWeek==null?0:Math.max(0,elapsedWeek-total);
  const isFinalWeek=elapsedWeek!=null&&elapsedWeek>=total;
  const isComplete=meta.mesocycleStatus==="completed";
  return{elapsedWeek,current,total,overrunWeeks,isFinalWeek,isComplete}}
function programWeek(){return mesocycleLifecycle(state.programMeta).elapsedWeek}
function mesocycleWeek(){return mesocycleLifecycle(state.programMeta)}
function mesocycleWeekCopy(mc,ofKey="today.week_of"){
  if(mc.isComplete)return t("meso.complete");
  if(mc.current==null)return"";
  return mc.isFinalWeek?t("meso.week_ready",{n:mc.current,total:mc.total}):t(ofKey,{n:mc.current,total:mc.total})}
function programWeekContext(name,mc){
  const nm=name||t("untitled_program");
  if(mc.isComplete)return t("log.context.program_complete",{name:nm});
  if(mc.isFinalWeek)return t("log.context.program_week_ready",{name:nm,n:mc.current,total:mc.total});
  if(mc.current!=null)return t("log.context.program_week",{name:nm,n:mc.current,total:mc.total});
  return nm}
function rowMusclesPure(row,program){
  if(row.performedPrimary!=null||row.performedSecondary!=null)
    return{primary:row.performedPrimary||"",secondary:row.performedSecondary||""};
  if(row.primary!=null||row.secondary!=null)return{primary:row.primary||"",secondary:row.secondary||""};
  const ex=(program||[]).find(e=>e.name===row.name);
  return ex?{primary:ex.primary,secondary:ex.secondary}:{primary:"",secondary:""}}
function volMapToObj(m){const o={};for(const[k,v]of m)o[k]={d:v.d,p:v.p};return o}
function sessionsForLog(ex,log){const match=matchLift(ex),m=new Map();
  for(const x of log||[]){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,loads:[],reps:[],rirs:[]});
    const o=m.get(x.session);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir)}
  return[...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),
    avgRir:avg(o.rirs),bestE1rm:Math.max(...o.loads.map((load,index)=>e1rm(load,o.reps[index])))}))
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))}
function previousSessionRowsLog(ex,beforeSessionId,log){const match=matchLift(ex),m=new Map();
  for(const x of log||[]){if(!match(x)||!(+x.load>0)||!isWork(x)||!(+x.reps>0))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,rows:[]});m.get(x.session).rows.push(x)}
  const ordered=[...m.values()].sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)));
  const curIdx=ordered.findIndex(s=>s.session===beforeSessionId);
  if(curIdx<0){const curCreated=(log||[]).find(r=>r.session===beforeSessionId)?.created;if(!curCreated)return ordered.length?ordered.at(-1).rows:[];
    const older=ordered.filter(s=>String(s.created).localeCompare(String(curCreated))<0);return older.length?older.at(-1).rows:[]}
  return curIdx>0?ordered[curIdx-1].rows:[]}
function hardSetsInRange(log,program,started,ended,hardRir){const m=new Map();
  for(const x of log||[]){if(started&&String(x.date)<started)continue;if(ended&&String(x.date)>ended)continue;
    if(!(+x.load>0&&+x.reps>0&&+x.rir<=hardRir)||!isWork(x))continue;
    const mus=rowMusclesPure(x,program);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
function buildBlockReview(programMeta,program,log){const p=new Program(program||[]),days=p.days(),total=programMeta?.mesocycleLengthWeeks||6;
  const started=programMeta?.started||null,ended=today(),hardRir=DEFAULTS.hardRir;
  const plannedSessions=total&&days.length?total*days.length:0;
  const blockRows=(log||[]).filter(r=>!started||r.date&&(String(r.date)>=started&&String(r.date)<=ended));
  const completedSessions=new Set(blockRows.map(r=>r.session)).size;
  const adherenceRatio=plannedSessions?Math.min(completedSessions/plannedSessions,1):0;
  let improvedLifts=0,flatLifts=0,regressedLifts=0,stalledLifts=0;
  for(const ex of p.exercises){const sess=sessionsForLog(ex,log),blockSess=started?sess.filter(s=>String(s.date)>=started&&String(s.date)<=ended):sess;
    if(!blockSess.length)continue;
    const latest=blockSess.at(-1),latestRows=(log||[]).filter(r=>r.session===latest.session&&matchLift(ex)(r));
    const delta=buildSessionDelta(previousSessionRowsLog(ex,latest.session,log),workingRows(latestRows));
    if(delta.status==="improved")improvedLifts++;
    else if(delta.status==="flat")flatLifts++;
    else if(delta.status==="regressed")regressedLifts++;
    if(isStalled(sess))stalledLifts++}
  const prs=detectPRs(log||[]).filter(e=>!started||e.date&&(String(e.date)>=started&&String(e.date)<=ended)).length;
  const plannedMap=p.volume(),plannedHardSetsByMuscle=volMapToObj(plannedMap);
  let totalPlanned=0;for(const[,v]of plannedMap)totalPlanned+=(v.d+v.p)*total;
  const completedMap=hardSetsInRange(log,program,started,ended,hardRir),completedHardSetsByMuscle=volMapToObj(completedMap);
  let totalCompleted=0;for(const[,v]of completedMap)totalCompleted+=v.d+v.p;
  const volumeCompliance=totalPlanned?Math.min(totalCompleted/totalPlanned,1):0;
  const improvedHigh=improvedLifts>=3||(improvedLifts>0&&improvedLifts>=flatLifts+regressedLifts);
  const fatigueHigh=(regressedLifts+flatLifts)>=4||regressedLifts>=2;
  let recommendation;
  if(adherenceRatio<.5)recommendation="repeat_with_simpler_schedule";
  else if(stalledLifts>=3&&fatigueHigh)recommendation="reduce_volume_or_deload";
  else if(improvedHigh&&adherenceRatio>=.8)recommendation="repeat_or_progress";
  else if(volumeCompliance<.6)recommendation="keep_program_improve_completion";
  else recommendation="repeat_with_small_swaps";
  return{programId:programMeta?.id||null,started,ended,plannedSessions,completedSessions,adherenceRatio,
    improvedLifts,flatLifts,regressedLifts,stalledLifts,prs,completedHardSetsByMuscle,plannedHardSetsByMuscle,
    volumeCompliance,recommendation,created:new Date().toISOString()}}
const REC_STRATEGY={repeat_or_progress:"repeat",repeat_with_small_swaps:"repeat_swaps",reduce_volume_or_deload:"reduce_volume",keep_program_improve_completion:"repeat",repeat_with_simpler_schedule:"reduce_volume"};
function blockRecommendationCopy(key){const k=key||"repeat_with_small_swaps";return{line:t(`block_rec.${k}.line`),why:t(`block_rec.${k}.why`)}}
function blockSnapshot(programMeta,log){const review=buildBlockReview(programMeta,prog.toJSON(),log),life=mesocycleLifecycle(programMeta);
  return{...review,weekCurrent:life.current,weekTotal:life.total,elapsedWeek:life.elapsedWeek,
    overrunWeeks:life.overrunWeeks,isFinalWeek:life.isFinalWeek,isComplete:life.isComplete}}
function buildPlainSummary(snapshot){if(!snapshot)return"";
  const parts=[];
  if(snapshot.isComplete)parts.push(t("review.summary.week_complete"));
  else if(snapshot.isFinalWeek&&snapshot.weekCurrent!=null)parts.push(t("review.summary.week_ready",{n:snapshot.weekCurrent,total:snapshot.weekTotal}));
  else if(snapshot.weekCurrent!=null&&snapshot.weekTotal)parts.push(t("review.summary.week",{n:snapshot.weekCurrent,total:snapshot.weekTotal}));
  const ad=snapshot.adherenceRatio??0,adKey=ad>=.8?"solid":ad>=.5?"mixed":"low";
  if(snapshot.plannedSessions)parts.push(t("review.summary.adherence",{status:t(`review.summary.adherence.${adKey}`),done:snapshot.completedSessions,planned:snapshot.plannedSessions}));
  const imp=snapshot.improvedLifts??0,flat=snapshot.flatLifts??0;
  if(imp||flat)parts.push(t("review.summary.lifts",{improved:imp,lifts:tp(imp,"lift"),flatBit:flat?t("review.summary.lifts_flat",{flat}):""}));
  const vol=snapshot.volumeCompliance??0;
  if(vol<.6&&snapshot.plannedSessions)parts.push(t("review.summary.volume",{pct:Math.round(vol*100)}));
  const copy=blockRecommendationCopy(snapshot.recommendation);
  parts.push(copy.line.replace(/^Recommendation:\s*/i,"").trim());
  return parts.join(" ")}
function renderReview(){const el=$("#reviewPanel");if(!el)return;
  if(!state.programMeta?.started){el.innerHTML=`<p class="lede">${esc(t("review.no_start"))}</p>`;return}
  const snap=blockSnapshot(state.programMeta,state.log),pct=Math.round((snap.volumeCompliance||0)*100),summary=buildPlainSummary(snap);
  const weekLine=snap.isComplete?t("meso.complete"):snap.isFinalWeek?t("meso.week_ready",{n:snap.weekCurrent,total:snap.weekTotal}):t("review.week_of",{n:snap.weekCurrent??"—",total:snap.weekTotal});
  el.innerHTML=`<div class="blockprogress"><h4 class="blockprogress__title">${esc(t("review.progress_title"))}</h4>`+
    `<p><b>${esc(weekLine)}</b></p>`+
    `<p><b>${esc(t("review.sessions"))}</b> ${esc(t("review.sessions_completed",{done:snap.completedSessions,planned:snap.plannedSessions}))}</p>`+
    `<p><b>${esc(t("review.lifts"))}</b> ${esc(t("review.lifts_summary",{improved:snap.improvedLifts,flat:snap.flatLifts,stalled:snap.stalledLifts}))}</p>`+
    `<p><b>${esc(t("review.volume"))}</b> ${esc(t("review.volume_planned",{pct}))}</p></div>`+
    `<p class="review__summary">${esc(summary)}</p>`}
function renderBlockReviewPanel(review){const copy=blockRecommendationCopy(review.recommendation),pct=Math.round((review.volumeCompliance||0)*100);
  const meta=state.programMeta||{},started=meta.started?new Date(`${meta.started}T12:00:00`):null;
  const activationProgramId=review.programId||meta.id||null;
  const end=new Date(`${today()}T12:00:00`);
  const range=started?`${started.getDate()} ${t("month_short."+started.getMonth())} – ${end.getDate()} ${t("month_short."+end.getMonth())}`:"";
  const life=mesocycleLifecycle(meta),weeks=life.total||6;
  const hero=life.isComplete?t("dialog.block_review.completed"):life.isFinalWeek&&life.current!=null?t("dialog.block_review.ready",{n:life.current,total:life.total}):life.current!=null?t("today.week_of",{n:life.current,total:life.total}):t("dialog.block_review.title");
  const recKey=review.recommendation||"repeat_with_small_swaps";
  const strategies=[
    {id:"repeat_swaps",title:t("dialog.block_review.repeat_swaps"),cap:t("block_strategy.repeat_swaps.cap")},
    {id:"repeat",title:t("dialog.block_review.repeat"),cap:t("block_strategy.repeat.cap")},
    {id:"increase_volume",title:t("dialog.block_review.increase_volume"),cap:t("block_strategy.increase_volume.cap")},
    {id:"reduce_volume",title:t("dialog.block_review.reduce_volume"),cap:t("block_strategy.reduce_volume.cap")},
    {id:"onboarding",title:t("dialog.block_review.onboarding"),cap:t("block_strategy.onboarding.cap")},
  ];
  const recStrategy=REC_STRATEGY[recKey]||"repeat_swaps";
  $("#blockReviewBody").innerHTML=
    `<p class="blockreview__prog">${esc(meta.name||t("untitled_program"))}</p>`+
    `<h2 class="blockreview__hero">${esc(hero)}</h2>`+
    `<p class="blockreview__range">${esc(t("dialog.block_review.range",{weeks,range}))}</p>`+
    `<div class="blockreview__adherence"><span>${esc(t("review.sessions_completed",{done:review.completedSessions,planned:review.plannedSessions}))}</span><span>${pct}%</span></div>`+
    `<div class="blockreview__bar"><span style="width:${pct}%"></span><i class="blockreview__bar-knob" style="left:${pct}%"></i></div>`+
    `<div class="statrow statrow--4">`+
    `<div class="statrow__cell"><div class="statrow__val">${review.improvedLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.improved"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${review.flatLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.stable"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${review.stalledLifts}</div><div class="statrow__cap">${esc(t("block_review.stalled"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${pct}%</div><div class="statrow__cap">${esc(t("block_review.volume"))}</div></div></div>`+
    `<div class="recblock"><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
    `<div class="recblock__head">${esc(copy.line)}</div>`+
    `<p class="recblock__body"><span class="recblock__why-lab">${esc(t("review.why"))}</span> ${esc(copy.why)}</p>`+
    `<button type="button" class="text-link" id="blockSeeAnalysis">${esc(t("block_review.see_analysis"))}</button></div>`+
    `<p class="section-label">${esc(t("block_review.next_block"))}</p>`+
    `<div id="blockStrategies">${strategies.map(s=>`<button type="button" class="radio-card blockreview__act${s.id===recStrategy?" is-selected is-recommended":""}" data-strategy="${s.id}">`+
      `<span class="radio-card__body"><span class="radio-card__title">${esc(s.title)}${s.id===recStrategy?` <span class="tag-rec">${esc(t("aria.recommended"))}</span>`:""}</span>`+
      `<span class="radio-card__cap">${esc(s.cap)}</span></span><span class="radio-card__mark"></span></button>`).join("")}</div>`+
    `<p class="blockreview__lock">🔒 ${esc(t("block_review.preserved"))}</p>`+
    `<div class="blockreview__sticky"><button type="button" class="btn btn--cta" id="blockStartNext">${esc(t("block_review.start_next"))}</button>`+
    `<button type="button" class="text-link text-link--center text-link--accent" id="blockDecideLater">${esc(t("block_review.decide_later"))}</button></div>`;
  let selected=recStrategy;
  $$("#blockStrategies .blockreview__act").forEach(b=>b.onclick=()=>{selected=b.dataset.strategy;
    $$("#blockStrategies .blockreview__act").forEach(x=>x.classList.toggle("is-selected",x===b))});
  $("#blockStartNext").onclick=()=>finishBlockAndStart(selected,activationProgramId);
  $("#blockDecideLater").onclick=closeBlockReview;
  const anal=$("#blockSeeAnalysis");if(anal)anal.onclick=()=>{
    closeBlockReview();
    navTo("stats");setStatsSeg("review");
    const seg=$(`#statsSeg button[data-seg="review"]`);if(seg)seg.focus()}}
let blockReviewCurrent=null;
let pendingBlockTransition=null;
let onboardingOrigin=null;
let blockCommitInFlight=null;
function closeBlockReview(){
  closeModal($("#blockReview"))}
function successorProgramList(strategy,list){
  const src=cloneSnapshot(list||[]);
  if(strategy==="repeat_swaps")return src.map(e=>e.alternates?.length?{...e,name:e.alternates[0]}:e);
  if(strategy==="increase_volume")return src.map(e=>({...e,sets:Math.min((e.sets||2)+1,e.maxSets||6)}));
  if(strategy==="reduce_volume")return src.map(e=>({...e,sets:Math.max((e.sets||2)-1,1)}));
  return src}
function capturePendingBlock(strategy,review){
  return{oldProgramId:state.programMeta?.id,oldMeta:cloneSnapshot(state.programMeta),oldProgram:cloneSnapshot(prog.toJSON()),
    programFingerprint:draftProgramFingerprint(state),review:cloneSnapshot(review||blockReviewCurrent),strategy}}
function archiveCapturedBlock(proposal,cap){
  if(!cap?.oldProgramId)return proposal;
  const history=Array.isArray(proposal.programHistory)?proposal.programHistory:[];
  if(history.some(h=>h.id===cap.oldProgramId)){proposal.programHistory=history;return proposal}
  history.push({id:cap.oldProgramId,meta:cloneSnapshot(cap.oldMeta),program:cloneSnapshot(cap.oldProgram),
    completedAt:new Date().toISOString(),review:cloneSnapshot(cap.review)});
  proposal.programHistory=history;return proposal}
function blockToast(strategy){
  const msg={repeat:"toast.new_block_same",repeat_swaps:"toast.new_block_swaps",
    increase_volume:"toast.new_block_volume_increased",reduce_volume:"toast.new_block_volume_reduced",onboarding:"toast.new_block_started"};
  toast(t(msg[strategy]||"toast.new_block_started"))}
function blockTransitionResult(kind,result={}){
  const deferred=kind==="deferred"||result.deferred===true;
  const outcomeKind=deferred?"deferred":kind;
  const committed=outcomeKind==="committed";
  const revision=Number.isInteger(result.revision)&&result.revision>=0?result.revision:readRevision(state);
  return{...result,kind:outcomeKind,committed,deferred,duplicate:outcomeKind==="duplicate",
    revision,localOk:(committed||deferred)&&!!result.localOk,idbOk:(committed||deferred)&&!!result.idbOk}}
function commitNextBlock(strategy,io=storageIO,expectedOldId=null){
  requireAdapter(io,"commitNextBlock");
  const liveId=state.programMeta?.id;
  const oldId=expectedOldId||liveId;
  if(!liveId||!oldId)return Promise.resolve(blockTransitionResult("failed"));
  if(blockCommitInFlight?.oldProgramId===oldId)return blockCommitInFlight.promise;
  if(liveId!==oldId)return Promise.resolve(blockTransitionResult("duplicate"));
  const cap=pendingBlockTransition&&pendingBlockTransition.oldProgramId===liveId
    ?pendingBlockTransition:capturePendingBlock(strategy,blockReviewCurrent);
  if(state.programMeta.id!==cap.oldProgramId)return Promise.resolve(blockTransitionResult("duplicate"));
  if(strategy==="onboarding"){
    pendingBlockTransition=cap;
    closeBlockReview();
    startOnboarding("block");
    return Promise.resolve(blockTransitionResult("deferred"))}
  const task=(async()=>{
    const nextProgram=new Program(successorProgramList(strategy,cap.oldProgram)).toJSON();
    let effect=null;
    if(strategy==="reduce_volume"){
      const draftRaw=readDraftRaw();
      let draft={};
      try{const parsed=JSON.parse(draftRaw||"{}");if(isPlainStateObject(parsed))draft=parsed}
      catch{}
      const currentById=new Map(cap.oldProgram.map(ex=>[ex.id,ex]));
      const blocked=nextProgram.some(ex=>{
        const current=currentById.get(ex.id);
        return current&&draftHasProgressInRemovedSets(ex.id,ex.sets,current.sets,draft)});
      effect=draftPreservationEffect(draftRaw);
      if(blocked||effect.status!==DRAFT_EFFECT_VALID){
        toast(t("toast.set_count_locked_draft"));
        return blockTransitionResult("failed",{draftConflict:true})}}
    const proposal=cloneSnapshot(state);
    archiveCapturedBlock(proposal,cap);
    const nextMeta=buildProgramMeta({name:cap.oldMeta?.name,answers:cap.oldMeta||{}});
    proposal.programMeta=nextMeta;
    proposal.program=nextProgram;
    const persisted=await commitProposedState(proposal,io,{expectedProgramId:cap.oldProgramId,
      expectedProgramFingerprint:cap.programFingerprint,effect});
    const kind=persisted.localOk||persisted.idbOk?"committed":persisted.duplicate?"duplicate":"failed";
    const result=blockTransitionResult(kind,persisted);
    if(result.committed){
      pendingBlockTransition=null;day=days()[0]||"Day 1";closeBlockReview();blockToast(strategy);render()}
    return result})();
  blockCommitInFlight={oldProgramId:oldId,promise:task};
  const clear=()=>{if(blockCommitInFlight?.promise===task)blockCommitInFlight=null};
  task.then(clear,clear);
  return task}
function finishBlockAndStart(strategy,expectedOldId){return commitNextBlock(strategy,storageIO,expectedOldId)}
function openBlockReview(review,opts={}){
  blockReviewCurrent=review;renderBlockReviewPanel(review);const d=$("#blockReview");if(!d)return;
  openModal(d,{
    initialFocus:$("#blockReviewClose"),
    returnFocus:opts.returnFocus||document.activeElement,
    onEscape:closeBlockReview,
    handoff:!!opts.handoff,
    prevInert:opts.prevInert
  });
  $("#blockReviewClose").onclick=closeBlockReview}
function promptEndBlock(){
  const d=$("#endBlockConfirm");if(!d)return;
  const opener=$("#endBlock")||document.activeElement;
  openModal(d,{
    initialFocus:$("#endBlockCancel"),
    returnFocus:opener,
    onEscape:()=>closeModal(d)
  });
  $("#endBlockGo").onclick=()=>{
    openBlockReview(buildBlockReview(state.programMeta,state.program,state.log),{handoff:true,returnFocus:opener})};
  $("#endBlockCancel").onclick=()=>closeModal(d)}
async function dismissBlockPrompt(){
  const proposal=cloneSnapshot(state);
  if(!proposal.programMeta)proposal.programMeta=defaultProgramMeta(proposal.log);
  proposal.programMeta.blockPromptDismissedId=proposal.programMeta.id;
  proposal.programMeta.updated=new Date().toISOString();
  const result=await commitProposedState(proposal);
  if(result.localOk||result.idbOk)renderBlockPrompt();
  return result}
function renderBlockPrompt(){const mc=mesocycleWeek();
  const id=state.programMeta?.id;
  const dismissed=!!(id&&state.programMeta?.blockPromptDismissedId===id);
  const show=(mc.isComplete||mc.isFinalWeek)&&!dismissed;
  const body=mc.isComplete?t("meso.complete"):t("meso.week_ready",{n:mc.current,total:mc.total});
  const html=show?`<p><b>${esc(t("review.block_ending"))}</b> ${esc(body)} <button type="button" class="blockprompt__act">${esc(t("review.block_ending.cta"))}</button></p>`+
    `<button type="button" class="blockprompt__dismiss" aria-label="${esc(t("review.block_ending.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`:"";
  for(const sel of["#logBlockBanner","#programBlockBanner"]){const el=$(sel);if(!el)continue;
    el.classList.toggle("hidden",!show);if(show){el.innerHTML=html;
      const btn=el.querySelector(".blockprompt__act");if(btn)btn.onclick=promptEndBlock;
      const dismiss=el.querySelector(".blockprompt__dismiss");if(dismiss)dismiss.onclick=async e=>{e.stopPropagation();await dismissBlockPrompt()}}}}
function programProgressionHealth(){const withHistory=prog.exercises.filter(ex=>sessionsFor(ex).length>0);
  if(!withHistory.length)return null;
  const hot=withHistory.filter(ex=>{const st=recommendation(ex).status;return st==="add"||st==="add2"}).length;
  return{hot,total:withHistory.length,ratio:hot/withHistory.length}}
function programVolumeCompliance(){const planned=prog.volume();let plannedTotal=0;
  for(const [,v] of planned)plannedTotal+=v.d+v.p;if(!plannedTotal)return null;
  const m=completedHardSets(7);let completed=0;for(const [,v] of m)completed+=v.d+v.p;
  return{planned:plannedTotal,completed,ratio:Math.min(completed/plannedTotal,1)}}
function programStatusLabel(adherence,health){
  const hasLog=state.log.some(isWork);if(!hasLog)return t("status.getting_started");
  const adRatio=adherence.ratio,hRatio=health?.ratio??0;
  if(adRatio>=1&&hRatio>=0.4)return t("status.on_track");if(adRatio>=0.5)return t("status.partial_week");return t("status.rebuilding")}
/* Accepts v3, v2, a bare exercise array, and {program:[…]} — every shape
   Taurifer has ever written. customExercises only exists in v3. */
function parseProgramImport(parsed){
  const custom=Array.isArray(parsed?.customExercises)?parsed.customExercises:[];
  if(Array.isArray(parsed))return{exercises:parsed,meta:null,customExercises:[]};
  // A backup files the same metadata under programMeta. Importing one as a
  // program is a partial import by design — but a split's name is part of the
  // split, so it travels with the exercises rather than being reinvented.
  const meta=parsed?.meta??parsed?.programMeta??null;
  if(Array.isArray(parsed?.exercises))return{exercises:parsed.exercises,meta,customExercises:custom};
  if(Array.isArray(parsed?.program))return{exercises:parsed.program,meta,customExercises:custom};
  return null}

/* Merges an import's custom definitions into the lifter's own library.

   An id can already be taken by a different definition — two devices both mint
   "custom:<uuid>", or the same program is imported twice after a local edit. An
   identical definition is reused, a colliding one is minted a fresh id, and the
   templates that referenced it are repointed. Nothing local is overwritten. */
// Random id minting is fine on the live import path but must not run inside a
// replayable reconstruction (a journal successor rebuilt from the same inputs
// has to be byte-identical). Callers on the shared-setup rebase path pass a
// deterministic allocator seeded from the persisted transaction id instead.
const randomCustomIdAllocator=()=>byId=>{
  let id;do{id=`${CUSTOM_ID_PREFIX}${uid()}`}while(byId.has(id));return id};
const deterministicCustomIdAllocator=seed=>{
  const base=String(seed||"shared");let n=0;
  return byId=>{let id;do{n++;id=`${CUSTOM_ID_PREFIX}${base}#${n}`}while(byId.has(id));return id}};
function mergeImportedCustomExercises(incoming,exercises,snapshot,allocate=randomCustomIdAllocator()){
  const normalized=normalizeCustomExercises(incoming);
  if(!normalized.length)return{customExercises:customExercises(snapshot).map(cloneSnapshot),added:0,remapped:0,remap:new Map()};
  const mine=customExercises(snapshot).map(cloneSnapshot);
  const byId=new Map(mine.map(e=>[e.id,e]));
  const sameDefinition=(a,b)=>foldSearch(a.name)===foldSearch(b.name)&&
    a.primary===b.primary&&a.secondary===b.secondary&&
    a.equipment.join(",")===b.equipment.join(",");
  const remap=new Map();
  let added=0,remapped=0;
  for(const entry of normalized){
    const existing=byId.get(entry.id);
    if(existing){
      if(sameDefinition(existing,entry))continue;
      // Same id, different movement: keep theirs, give this one a new identity.
      const minted=Object.assign(cloneSnapshot(entry),{id:allocate(byId)});
      mine.push(minted);byId.set(minted.id,minted);
      remap.set(entry.id,minted.id);added++;remapped++;
      continue}
    // A definition we already hold under another id is reused rather than doubled.
    const twin=mine.find(e=>sameDefinition(e,entry));
    if(twin){if(twin.id!==entry.id)remap.set(entry.id,twin.id);continue}
    mine.push(entry);byId.set(entry.id,entry);added++}
  if(remap.size)
    for(const ex of exercises||[])
      if(ex&&remap.has(ex.libraryId))ex.libraryId=remap.get(ex.libraryId);
  return{customExercises:mine,added,remapped,remap}}
function sharedSettingsPatch(raw){
  return{jumpPct:normSetting(raw?.jumpPct,DEFAULTS.jumpPct,0),
    minJump:normSetting(raw?.minJump,DEFAULTS.minJump,0.01),
    rirHigh:normSetting(raw?.rirHigh,DEFAULTS.rirHigh,0),
    hardRir:normSetting(raw?.hardRir,DEFAULTS.hardRir,0),
    restSec:normalizeRestSec(raw?.restSec),
    unit:raw?.unit==="lb"?"lb":"kg",
    lang:I18N?.normalizeLang(raw?.lang)||"en",
    rirMode:raw?.rirMode==="effort"?"effort":"numeric"}}
function buildSharedProgramMeta(raw,program=[]){
  const now=new Date().toISOString();
  return{id:uid(),name:String(raw?.name||"").trim(),started:today(),created:now,updated:now,
    goal:raw?.goal??null,experience:raw?.experience??null,daysPerWeek:raw?.daysPerWeek??null,
    splitType:raw?.splitType??null,equipment:Array.isArray(raw?.equipment)?[...raw.equipment]:[],
    priorityMuscles:Array.isArray(raw?.priorityMuscles)?[...raw.priorityMuscles]:[],
    sessionLength:raw?.sessionLength??null,mesocycleLengthWeeks:raw?.mesocycleLengthWeeks||6,
    mesocycleStatus:"active",completedAt:null,onboarded:true,
    progressionRelations:normalizeProgressionRelations(raw?.progressionRelations,program),
    progressionModifiers:normalizeProgressionModifiers(raw?.progressionModifiers),
    blockPromptDismissedId:null}}
function proposalFromSharedSetup(payload,baseState=state){
  if(!SharedSetup)throw new TypeError("Shared setup unavailable");
  const checked=SharedSetup.validate(payload,{builtInIds:SHARED_BUILT_IN_IDS});
  if(!checked.ok)throw new TypeError("Invalid shared setup");
  const clean=checked.value,proposal=cloneSnapshot(baseState);
  const exercises=clean.program.exercises.map(ex=>sharedExercise(ex,true));
  const merged=mergeImportedCustomExercises(clean.program.customExercises,exercises,proposal);
  proposal.customExercises=merged.customExercises;
  const lookup=snapshotLookup(proposal.customExercises);
  if(exercises.some(ex=>!lookup(ex.libraryId)))throw new TypeError("Unresolved shared exercise");
  proposal.program=new Program(exercises,lookup).toJSON();
  proposal.programMeta=buildSharedProgramMeta(clean.program.meta,proposal.program);
  proposal.settings={...normalizeSettings(proposal.settings),...sharedSettingsPatch(clean.settings)};
  proposal.log=[];
  proposal.programHistory=[];
  delete proposal[STORAGE_FOLLOWUP];
  delete proposal[STORAGE_DRAFT_TXN];
  // The merge above resolved against the base as it stood when the gate opened.
  // Record what the payload itself contributed so a rebase against a refreshed
  // head can redo that resolution instead of trusting a stale mapping.
  proposal[SHARED_IMPORT]={definitions:normalizeCustomExercises(clean.program.customExercises),
    remap:Object.fromEntries(merged.remap)};
  return proposal}
// Only the definitions the replacement program actually references are payload-
// owned. Everything else in the stale proposal's customExercises is recipient
// state the refreshed head already owns (including deletions and edits), so it
// must never be re-imported.
function referencedCustomDefinitions(snapshot){
  const referenced=new Set((Array.isArray(snapshot?.program)?snapshot.program:[])
    .map(ex=>ex?.libraryId).filter(id=>isCustomLibraryId(id)));
  return customExercises(snapshot).filter(def=>referenced.has(def.id)).map(cloneSnapshot)}
// The head owns every device setting except the eight shared fields, including
// unknown top-level and nested notify keys the recipient may have gained after
// the gate opened; the payload contributes only the allowlisted eight.
function rebaseSharedSettings(head,proposalSettings){
  return{...normalizeSettings(head?.settings),...sharedSettingsPatch(proposalSettings)}}
/* Undoes the gate-time mapping so the payload's own definitions are what gets
   offered to the refreshed head. Without this, a recipient definition the
   proposal had reused (same movement under a different id) would be re-imported
   as payload data — resurrecting it even when the head has since deleted it. */
function sharedPayloadDefinitions(record,exercises){
  const inverse=new Map(Object.entries(record.remap||{})
    .map(([payloadId,proposalId])=>[proposalId,payloadId]));
  if(inverse.size)
    for(const ex of exercises)
      if(ex&&inverse.has(ex.libraryId))ex.libraryId=inverse.get(ex.libraryId);
  const referenced=new Set(exercises.map(ex=>ex?.libraryId).filter(id=>isCustomLibraryId(id)));
  return normalizeCustomExercises(record.definitions).filter(def=>referenced.has(def.id))}
function rebaseSharedSetupSnapshot(snapshot,head,seed){
  if(!snapshot||!head)return snapshot;
  const record=isPlainStateObject(snapshot[SHARED_IMPORT])?snapshot[SHARED_IMPORT]:null;
  delete snapshot[SHARED_IMPORT];
  const exercises=Array.isArray(snapshot.program)?snapshot.program:[];
  snapshot.settings=rebaseSharedSettings(head,snapshot.settings);
  const incoming=record?sharedPayloadDefinitions(record,exercises)
    :referencedCustomDefinitions(snapshot);
  snapshot.customExercises=mergeImportedCustomExercises(
    incoming,exercises,head,deterministicCustomIdAllocator(seed)).customExercises;
  return snapshot}
function save(){return persist()}
function persist(opts={}){
  dropMemo.clear();baselineMemo.clear();
  const base=cloneSnapshot(mutationBase||state);
  const snapshot=cloneSnapshot(state);
  return enqueueStateChange(base,snapshot,storageIO,opts)}
async function commitProposedState(proposal,io=storageIO,opts={}){
  requireAdapter(io,"commitProposedState");
  const base=cloneSnapshot(mutationBase||state);
  const liveBase=cloneSnapshot(state);
  const snapshot=cloneSnapshot(proposal);
  const result=await enqueueStateChange(base,snapshot,io,Object.assign({},opts,{liveBase}));
  if(result.draftConflict&&!result.journalFailed)toast(t("toast.draft_conflict_retry"),{assertive:true});
  return result}
async function deleteTrainingLog(io=storageIO,{discardDraftRaw=readDraftRaw()}={}){
  const proposal=cloneSnapshot(state);
  proposal.log=[];
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,io,{effect});
  if(result.localOk||result.idbOk){
    resetDraftSessionState();render();toast(t("toast.log_deleted"))}
  return result}
window.__repforgeStorage={
  flush:flushStorage,
  chooseSnapshot,
  writeWithAdapter(snapshot,io){
    requireAdapter(io,"writeWithAdapter");
    return enqueueWrite(()=>writeSnapshot(cloneSnapshot(snapshot),io))},
  health(){return Object.assign({},storageHealth)},
  rebaseForTest(base,proposal,target,opts){return rebaseStateChange(base,proposal,target,opts)},
  replaceImport(incoming,io,opts){requireAdapter(io,"replaceImport");return replaceImportedState(incoming,io,opts)},
  mergeImport(incoming,io){requireAdapter(io,"mergeImport");return mergeImportedLog(incoming,io)}}
function days(){return [...new Set(state.program.map(x=>x.day))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))}
function exercises(d=day){return state.program.filter(x=>x.day===d).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name))}
function exerciseNameTokens(ex){
  const names=new Set([ex?.name,ex?.displayName].map(movementToken).filter(Boolean));
  const entry=ex?.libraryId?libraryEntry(ex.libraryId):null;
  for(const label of [entry?.name,entry?.namePt]){const key=movementToken(label);if(key)names.add(key)}
  return names}
function matchLift(ex){const movementId=ex?.movementId?String(ex.movementId):"",
  key=exerciseLiftKey(ex),names=exerciseNameTokens(ex);
  return row=>{
    const rowLibraryId=row?.performedLibraryId?String(row.performedLibraryId):"";
    const rowMovementId=row?.performedMovementId?String(row.performedMovementId):"";
    if(rowLibraryId||rowMovementId)return liftKey(row)===key;
    if(movementId&&ex?.id&&row?.exerciseId===ex.id)return true;
    return names.has(movementToken(loggedMovementName(row)))}}
function last(ex){const match=matchLift(ex);
  const hits=state.log.filter(x=>match(x)&&isWork(x));if(!hits.length)return[];
  const sid=[...hits].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0].session;
  return hits.filter(x=>x.session===sid).sort((a,b)=>a.set-b.set)}
// One entry per past session for this lift, oldest→newest, working sets only (load>0).
function sessionsFor(ex){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,loads:[],reps:[],rirs:[],caps:[],cappedRirs:[]});
    const o=m.get(x.session);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);
    // Capacity twins of the RIR-blind aggregates — the engine reads these, stats keep the originals.
    o.caps.push(capE1rm(+x.load,+x.reps,x.rir));o.cappedRirs.push(capRir(x.rir))}
  return [...m.values()].map(o=>({session:o.session,date:o.date,created:o.created,reps:o.reps,
    med:median(o.loads),top:Math.max(...o.loads),minReps:Math.min(...o.reps),maxReps:Math.max(...o.reps),medReps:median(o.reps),
    avgRir:avg(o.rirs),bestE1rm:Math.max(...o.loads.map((load,index)=>e1rm(load,o.reps[index]))),
    caps:o.caps,bestCap:Math.max(...o.caps),medCap:median(o.caps),medCappedRir:median(o.cappedRirs)}))
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))}
// The lifter's own recent habitual RIR for this lift — a measurement, not a target.
function typicalRir(ex,sess){sess=sess||sessionsFor(ex);
  const recent=sess.slice(-CAPACITY.baselineSessions);
  return recent.length?median(recent.map(s=>s.medCappedRir)):1}
// Memo key for the capacity helpers that walk the whole log: identity plus a cheap
// stamp of the log's shape. persist() clears both memos whenever the log can change.
const capMemoKey=ex=>`${exerciseLiftKey(ex)}|${state.log.length}|${state.log.at(-1)?.created||""}`;
// Recent typical capacity for off-day detection. null until 2 sessions exist.
// Memoized: session freshness asks for every other lift on the day, on every
// keystroke in a committed row — Log-tab speed comes first.
const baselineMemo=new Map();
function capacityBaseline(ex,sess){
  // Only the no-argument form is memoizable; a caller-supplied sess is its own input.
  if(sess)return sess.length<2?null:median(sess.slice(-CAPACITY.baselineSessions).map(s=>s.bestCap));
  const memoKey=capMemoKey(ex);
  if(baselineMemo.has(memoKey))return baselineMemo.get(memoKey);
  const rows=sessionsFor(ex);
  const value=rows.length<2?null:median(rows.slice(-CAPACITY.baselineSessions).map(s=>s.bestCap));
  baselineMemo.set(memoKey,value);return value}
const DELTA_THRESHOLDS={e1rmPct:.01,volumePct:.025,rir:.75};
function workingRows(rows){return(rows||[]).filter(r=>isWork(r)&&+r.load>0&&+r.reps>0)}
function exerciseSessionMetrics(rows){const w=workingRows(rows);if(!w.length)return null;let topLoad=0,topLoadReps=0,totalReps=0,totalVolume=0,bestE1rm=0;const rirs=[];
  for(const r of w){const ld=+r.load,rp=+r.reps;totalReps+=rp;totalVolume+=ld*rp;rirs.push(+r.rir);const em=e1rm(ld,rp);if(em>bestE1rm)bestE1rm=em;if(ld>topLoad||(ld===topLoad&&rp>topLoadReps)){topLoad=ld;topLoadReps=rp}}
  return{topLoad,topLoadReps,totalReps,totalVolume,bestE1rm,avgRir:avg(rirs),workingSets:w.length}}
function previousSessionForExercise(ex,beforeSessionId){const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x)||!(+x.reps>0))continue;
    if(!m.has(x.session))m.set(x.session,{session:x.session,date:x.date,created:x.created,rows:[]});m.get(x.session).rows.push(x)}
  const ordered=[...m.values()].sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)));
  const curIdx=ordered.findIndex(s=>s.session===beforeSessionId);
  if(curIdx<0){const curCreated=state.log.find(r=>r.session===beforeSessionId)?.created;if(!curCreated)return ordered.length?ordered.at(-1).rows:[];
    const older=ordered.filter(s=>String(s.created).localeCompare(String(curCreated))<0);return older.length?older.at(-1).rows:[]}
  return curIdx>0?ordered[curIdx-1].rows:[]}
function buildSessionDelta(prevRows,currentRows){const previous=exerciseSessionMetrics(prevRows),current=exerciseSessionMetrics(currentRows),T=DELTA_THRESHOLDS;
  if(!previous||!current)return{status:"not_comparable",label:t("delta.not_comparable.label"),text:t("delta.not_comparable.text"),metrics:null};
  const loadDelta=current.topLoad-previous.topLoad,repsDelta=current.totalReps-previous.totalReps,volumeDelta=current.totalVolume-previous.totalVolume,
    e1rmDelta=current.bestE1rm-previous.bestE1rm,avgRirDelta=current.avgRir-previous.avgRir,deltas={loadDelta,repsDelta,volumeDelta,e1rmDelta,avgRirDelta};
  let status,label,text;
  if(e1rmDelta>previous.bestE1rm*T.e1rmPct){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(Math.abs(loadDelta)<.01&&repsDelta>0){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(volumeDelta>previous.totalVolume*T.volumePct&&avgRirDelta<=T.rir){status="improved";label=t("delta.improved.label");text=t("delta.improved.text")}
  else if(Math.abs(e1rmDelta)<=previous.bestE1rm*T.e1rmPct&&repsDelta===0&&Math.abs(volumeDelta)<=previous.totalVolume*T.volumePct){status="flat";label=t("delta.flat.label");text=t("delta.flat.text")}
  else if(e1rmDelta<0&&repsDelta<0){status="regressed";label=t("delta.regressed.label");text=t("delta.regressed.text")}
  else{status="changed_load";label=t("delta.changed_load.label");text=t("delta.changed_load.text")}
  return{status,label,text,metrics:{current,previous,deltas}}}
function compareExerciseSession(ex,currentRows){const cur=workingRows(currentRows);
  if(!cur.length)return{status:"not_comparable",label:t("delta.not_comparable.label"),text:t("delta.not_comparable.text"),metrics:null};
  const prev=previousSessionForExercise(ex,cur[0]?.session);
  if(!prev.length)return{status:"new",label:t("delta.new.label"),text:t("delta.new.text"),metrics:null};
  return buildSessionDelta(prev,cur)}
function formatDelta(delta){if(!delta?.metrics)return"";const{deltas}=delta.metrics,{loadDelta,repsDelta,e1rmDelta}=deltas;
  if(Math.abs(loadDelta)<.01&&repsDelta!==0){const s=repsDelta>0?"+":"";return t("delta.reps_same_load",{signed:s+repsDelta})}
  if(Math.abs(e1rmDelta)>=.01){const s=e1rmDelta>0?"+":"";return t("delta.e1rm",{signed:s,delta:Math.round(toDisplay(e1rmDelta)),unit:unitLabel()})}
  const parts=[];if(repsDelta!==0)parts.push(t("delta.reps",{signed:repsDelta>0?"+":"",delta:repsDelta}));if(Math.abs(e1rmDelta)>=.01)parts.push(t("delta.e1rm_labeled",{signed:e1rmDelta>0?"+":"",delta:Math.round(toDisplay(e1rmDelta)),unit:unitLabel()}));
  return parts.length?parts.join(" · "):""}
function sessionDeltaCounts(rows){const byLift=new Map();
  for(const r of rows){if(!isWork(r)||!(+r.load>0)||!(+r.reps>0))continue;
    const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
  const counts={improved:0,flat:0,regressed:0,new:0};
  for(const [,liftRows]of byLift){const row=liftRows[0];
    const ex=exerciseIdentityFromRow(row);
    const d=compareExerciseSession(ex,liftRows);if(d.status in counts)counts[d.status]++}
  return counts}
function formatDeltaCounts(c,{sep=" · "}={}){const parts=[];
  if(c.improved)parts.push(t("delta.count.improved",{n:c.improved}));if(c.flat)parts.push(t("delta.count.flat",{n:c.flat}));
  if(c.regressed)parts.push(t("delta.count.regressed",{n:c.regressed}));if(c.new)parts.push(t("delta.count.new_lifts",{n:c.new,lifts:tp(c.new,"lift")}));
  return parts.join(sep)}
function hasDeltaSummary(c){return c.improved||c.flat||c.regressed||c.new}
function draftRowsForExercise(ex,draft){const warm=new Set(draft.__warm||[]),rows=[];
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;if(warm.has(key))continue;
    const ld=fromDisplay(draft[`${key}_load`]||0),rp=parseDec(draft[`${key}_reps`])||0;if(ld<=0||rp<=0)continue;
    let rir=parseDec(draft[`${key}_rir`]);if(isEffortMode())rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
    else if(!Number.isFinite(rir))rir=1;
    rows.push({exerciseId:ex.id,name:ex.name,day:ex.day,load:ld,reps:rp,rir,warmup:false})}
  return rows}
function deltaPreviewFor(ex,draft){const rows=draftRowsForExercise(ex,draft);if(!workingRows(rows).length)return"";
  const cmp=compareExerciseSession(ex,rows);const fd=cmp.metrics?formatDelta(cmp):"";return fd?t("delta.preview",{delta:fd}):""}
// Stalled = 3+ recent sessions at the same working load with no gain in top-set reps.
function isStalled(sess){if(sess.length<3)return false;const r=sess.slice(-3),l0=r[0].med,rep0=r[0].maxReps;
  return r.every(s=>Math.abs(s.med-l0)<0.01)&&r.every(s=>s.maxReps<=rep0)}
// Recover = grinding near failure AND performance did not improve vs prior session (same/lower load).
function recoverSignal(ex,sess,rirCeiling=0.5){sess=sess||sessionsFor(ex);if(sess.length<2)return false;
  const last=sess.at(-1),prior=sess.at(-2);
  if(last.avgRir==null||!(+last.avgRir<=rirCeiling))return false;
  if(last.maxReps==null||last.medReps==null||prior.maxReps==null||prior.medReps==null)return false;
  if(+last.med-+prior.med>=0.01)return false;
  return +last.maxReps<=+prior.maxReps&&+last.medReps<=+prior.medReps}
function round(v){const raw=+state.settings.minJump;const inc=Number.isFinite(raw)&&raw>0?raw:2.5;return Math.round(v/inc)*inc}
const LOAD_EPS=1e-6;
const sameLoad=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<=LOAD_EPS;
function jump(load,mult){return Math.max(load*(+state.settings.jumpPct||0)*mult/100,+state.settings.minJump||2.5)}
function lastBodyweight(){const rows=state.log.filter(r=>+r.bodyweight>0);
  if(!rows.length)return "";const latest=rows.sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
  return fmt(toDisplay(latest.bodyweight))}
function updateBodyweightField(){const el=$("#bodyweight");if(!el)return;
  el.placeholder=unitLabel();
  const lbl=$("#bodyweightLabel")?.querySelector("span");
  if(lbl)lbl.textContent=t("log.bodyweight_unit",{unit:unitLabel()})}
function focusList(){
  const exs=exercises();
  if(tourActive&&tourPreview?.ignoreSkipped){
    const first=exs[0];
    return first?[first]:[]}
  return exs.filter(e=>!skipped.has(e.id))}
function setWorkoutOverflow(open){const menu=$("#woOverflow");if(!menu)return;
  menu.classList.toggle("hidden",!open);
  $("#woOverflowBtn")?.setAttribute("aria-expanded",open?"true":"false")}
function closeWorkoutOverflow(){setWorkoutOverflow(false)}
function toggleWorkoutOverflow(){setWorkoutOverflow($("#woOverflow")?.classList.contains("hidden"))}
function setLogMode(m){logMode=m;syncLogModeControls();document.body.classList.toggle("is-focus-wo",m==="focus");focusIndex=0;focusEdit=null;closeWorkoutOverflow();renderWorkout()}
function goToLogExercise(exId){
  const ex=prog.find(exId);if(!ex)return;
  if(!requestWorkoutDay(ex.day))return;
  if(logMode==="focus"){
    const fl=focusList(),idx=fl.findIndex(e=>e.id===exId);
    focusIndex=idx>=0?idx:0;
  }
  const logBtn=$('nav button[data-view="log"]');
  if(logBtn){$$("nav button").forEach(x=>{const on=x===logBtn;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")})}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="log"));
  document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-library","is-preview","is-import");
  enterWorkout({});
  const art=$(`#workout [data-ex="${exId}"]`);if(art){collapsed.delete(exId);art.classList.remove("is-collapsed");art.scrollIntoView({behavior:"smooth",block:"center"})}}
function setStatsSeg(seg){if(!STATS_SEG[seg])return;statsSeg=seg;
  $$("#statsSeg button").forEach(b=>{const on=b.dataset.seg===seg;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});
  for(const [k,id] of Object.entries(STATS_SEG)){const el=$("#"+id);if(el)el.classList.toggle("active",k===seg)}
  if(seg==="overview")redrawChart();else if(seg==="strength")renderStrengthDash();else if(seg==="volume")renderVolumeDash();else if(seg==="prs")renderPRTimeline();else if(seg==="review")renderReview()}

// Block (mesocycle) trend — a WEAK signal derived from e1RM across this lift's
// sessions inside the current block. Only tempers aggressiveness / rep targets.
// The regression itself now lives in progression-engine.js and reaches here as
// facts.blockTrend; this file keeps only the sentence it turns into.
function blockTrendNote(trend){
  if(!trend||!trend.dir||trend.sessions<3)return"";
  return t(`rec.block.${trend.dir}`,{sessions:trend.sessions})}
// Recommendation -> RIR-aware double progression, mapped to a temperature/status.
// Primary signal is the previous session; the block trend nudges it weakly.
/* ---- Progression adapter (Plan 046) ----
   The range arithmetic now lives in progression-engine.js, which was
   extracted from exactly this behavior and is locked by 19 parity fixtures.
   Everything below turns app state into that engine's evidence and turns its
   typed result back into the object the Log tab, the per-set suggestions and
   the "why this weight" sheet already read. No arithmetic here, and no second
   engine: the pure module knows nothing about the DOM, storage, i18n, a
   program family, or an entitlement, and nothing here teaches it.

   `range@1` is the only arithmetic strategy. Unsupported imported markers are
   represented as typed manual results rather than silently falling back, so a
   proposed strategy cannot become live by accident. */
/** Raw rows for this lift, grouped and ordered exactly the way sessionsFor
 *  groups and orders them, so the engine's own summaries land on the same
 *  numbers the app used to compute inline. */
function progressionHistory(ex){
  const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{sessionId:x.session,date:x.date,created:x.created,sets:[]});
    m.get(x.session).sets.push({load:+x.load,reps:+x.reps,rir:x.rir==null?null:+x.rir})}
  return[...m.values()]
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))
    .map(s=>({sessionId:s.sessionId,date:s.date,sets:s.sets}))}
/** The engine's closed input. Settings are the lifter's own grid and jump;
 *  context carries only the block, never a family or a program identity. */
function progressionInput(ex,currentSession,freshnessFactor){
  const context={weekNumber:1,blockLength:+state.programMeta?.mesocycleLengthWeeks||6,
    blockStart:state.programMeta?.started||null};
  if(freshnessFactor!=null&&freshnessFactor<1)context.freshnessFactor=freshnessFactor;
  return{engineVersion:1,
    prescription:progressionForExercise(ex),
    relation:null,modifiers:[],
    settings:{minLoadIncrement:(()=>{const raw=+state.settings.minJump;return Number.isFinite(raw)&&raw>0?raw:2.5})(),
      jumpPercent:+state.settings.jumpPct||0,
      hardRir:+state.settings.hardRir||DEFAULTS.hardRir},
    history:progressionHistory(ex),
    currentSession:currentSession||[],
    context}}
/* One engine reason code, one UI status. The heats and copy keys are the
   product's, not the engine's — that is the whole point of the split. */
const RANGE_REASON_UI={
  "range.no_history":{status:"new",reason:"new",heat:.12},
  "range.capacity_top_double":{status:"add2",reason:"cap_top2",heat:1},
  "range.performed_top":{status:"add",reason:"top",heat:.82},
  "range.capacity_top":{status:"add",reason:"cap_top",heat:.82},
  "range.below_floor":{status:"reduce",reason:"below_range",heat:.18},
  "range.stalled":{status:"reduce",reason:"stalled",heat:.3},
  "range.recovery":{status:"hold",reason:"recover",heat:.42},
  "range.capacity_room":{status:"hold",reason:"push_reps",heat:.6},
  "range.room_in_range":{status:"hold",reason:"hold",heat:.48}};
function rangeCopy(ex,reason){
  if(reason==="cap_top2")return{label:t("rec.add2.label"),text:t("rec.add2.text")};
  if(reason==="top"||reason==="cap_top")return{label:t("rec.add.label"),text:t("rec.add.text")};
  if(reason==="below_range")return{label:t("rec.reduce.label"),text:t("rec.reduce.text",{min:ex.min})};
  if(reason==="stalled")return{label:t("rec.stalled.label"),text:t("rec.stalled.text")};
  if(reason==="recover")return{label:t("rec.recover.label"),text:t("rec.recover.text")};
  if(reason==="push_reps")return{label:t("rec.push_reps.label"),text:t("rec.push_reps.text")};
  return{label:t("rec.hold_add_reps.label"),
    text:t(isEffortMode()?"rec.hold_add_reps.text_effort":"rec.hold_add_reps.text")}}
/* Legacy progression markers are compatibility data, not a formula switch.
 * This is the complete alias table: the old double-progression marker is the
 * released range contract. Everything else remains recoverable but executes
 * as a manual envelope until an owner-approved rule exists. */
const LEGACY_PROGRESSION_ALIASES=Object.freeze({double_progression:"range"});
function rangeProgressionProjection(ex){return{schemaVersion:1,modifiers:[],strategy:{id:"range",version:1,params:{workingSets:+ex.sets||1,repMin:+ex.min,repMax:+ex.max}}}}
function progressionForExercise(ex){
  if(ex?.progressionIncompatibility)return{schemaVersion:1,modifiers:[],strategy:{id:"manual",version:1,params:{unsupportedImport:"incompatible_prescription"}}};
  if(ex?.progression)return cloneSnapshot(ex.progression);
  const legacy=typeof ex?.progressionType==="string"?ex.progressionType.trim():"";
  if(legacy&&!Object.prototype.hasOwnProperty.call(LEGACY_PROGRESSION_ALIASES,legacy))
    return{schemaVersion:1,modifiers:[],strategy:{id:"manual",version:1,params:{unsupportedImport:legacy}}};
  return rangeProgressionProjection(ex||{});
}
function recommendation(ex){
  const result=RepForgeProgression.evaluateProgression(progressionInput(ex));
  const codes=result.reasonCodes,facts=result.facts,ui=RANGE_REASON_UI[codes[0]];
  if(result.kind==="manual"||result.kind==="incompatible"||result.kind==="invalid")return{status:"manual",heat:0,label:"",text:"",load:null,stalled:false,block:{dir:null,sessions:0},blockNote:"",pushReps:false,reason:codes[0]};
  // No history, or evidence the locked strategy will not act on: the same
  // "start here" card the app has always drawn, with no invented number.
  if(!ui||ui.reason==="new")return{status:"new",heat:.12,label:t("rec.new.label"),
    text:isEffortMode()
      ?t("rec.new.text_effort",{min:ex.min,max:ex.max,effort:effortWord(targetEffort())})
      :t("rec.new.text",{min:ex.min,max:ex.max,rirHigh:state.settings.rirHigh}),
    load:null,stalled:false,block:{dir:null,sessions:0},blockNote:"",pushReps:true,reason:"new"};
  const copy=rangeCopy(ex,ui.reason);
  const rec={status:ui.status,heat:ui.heat,label:copy.label,text:copy.text,load:facts.targetLoad,
    stalled:ui.reason==="stalled"?true:ui.reason==="below_range"?facts.stalled:false,
    pushReps:facts.pushReps,reason:ui.reason};
  if(facts.jumpMultiplier>0)rec.jumpMult=facts.jumpMultiplier;
  // Weak block tempering: a block that is losing strength should not double-jump.
  if(codes.includes("range.block_tempered")){rec.status="add";rec.heat=.82;rec.label=t("rec.add.label");
    rec.text=t("rec.add.tempered.text");rec.jumpMult=facts.jumpMultiplier;rec.temperedBlock=true}
  const trend={dir:facts.blockTrend.direction,sessions:facts.blockTrend.sessionCount};
  if(facts.blockTrend.ratio!=null)trend.ratio=facts.blockTrend.ratio;
  rec.block=trend;rec.blockNote=blockTrendNote(trend);
  rec.cap=facts.capacityE1rm;rec.typRir=facts.typicalRir;
  // Read-only inputs the "why this weight" sheet narrates; nothing here steers a trigger.
  rec.cr=facts.capacityReps;rec.lastLoad=facts.latestLoad;rec.lastMedReps=facts.latestMedianReps;
  rec.reenterReps=rec.status==="add"||rec.status==="add2"||rec.status==="reduce"||!sameLoad(rec.load,facts.latestLoad);
  return rec;
}
// Re-entry after a load change: the reps this capacity predicts at the NEW load,
// minus the lifter's own habitual RIR, clamped into the range. Replaces the blind
// reset to ex.min — which survives only as the clamp on big percentage jumps.
const reentryReps=(ex,cap,load,typRir)=>clamp(Math.round(repsAtLoad(cap,load)-(+typRir||0)),ex.min,ex.max);
// Base reps target from the previous-session recommendation (no in-session data yet).
// rec.reenterReps is the policy: load-change and snapped-hold recs re-enter on
// capacity; exact-load holds chase one more rep. Hold · recover keeps the prior target.
function baseSetReps(ex,rec,old){
  if(rec.reenterReps)
    return rec.cap>0&&rec.load>0?reentryReps(ex,rec.cap,rec.load,rec.typRir):ex.min;
  const prev=old&&+old.reps>0?+old.reps:null;
  if(prev==null)return ex.min;
  if(!rec.pushReps)return clamp(prev,ex.min,ex.max);
  return clamp(prev+1,ex.min,ex.max)}
// Historical median consecutive-set capacity drop for this lift. Memoized: it walks
// the whole log and setSuggestion runs per set per render — Log-tab speed comes first.
const dropMemo=new Map();
function historicalSetDrop(ex){
  const memoKey=capMemoKey(ex);
  if(dropMemo.has(memoKey))return dropMemo.get(memoKey);
  const match=matchLift(ex),m=new Map();
  for(const x of state.log){if(!match(x)||!(+x.load>0)||!(+x.reps>0)||!isWork(x))continue;
    if(!m.has(x.session))m.set(x.session,{created:x.created,date:x.date,rows:[]});
    m.get(x.session).rows.push(x)}
  const recent=[...m.values()]
    .sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)))
    .slice(-CAPACITY.baselineSessions);
  const drops=[];
  for(const s of recent){const rows=[...s.rows].sort((a,b)=>(+a.set||0)-(+b.set||0));
    for(let i=0;i+1<rows.length;i++){
      const a=capE1rm(+rows[i].load,+rows[i].reps,rows[i].rir),b=capE1rm(+rows[i+1].load,+rows[i+1].reps,rows[i+1].rir);
      if(a>0)drops.push(Math.max(0,(a-b)/a))}}
  const value=drops.length?median(drops):0;
  dropMemo.set(memoKey,value);return value}
// Expected capacity lost per set: observed today first (needs 2+ sets), else this
// lift's recent history, else zero. Clamped so one blow-up set can't run away with it.
function expectedSetDrop(ex,caps){
  const drops=[];
  for(let i=0;i+1<(caps||[]).length;i++)if(caps[i]>0)drops.push(Math.max(0,(caps[i]-caps[i+1])/caps[i]));
  return clamp(drops.length?avg(drops):historicalSetDrop(ex),0,CAPACITY.dropClamp)}
/** Exact-token muscle overlap between two exercise templates — deliberately NOT the
 *  fuzzy includes() the muscle filter uses, so "arms" never matches "forearms".
 *  Primary↔primary full, primary↔secondary half, secondary↔secondary quarter. */
function muscleOverlap(a,b){
  const norm=s=>muscles(s).map(x=>x.toLowerCase());
  const ap=norm(a?.primary),as=norm(a?.secondary),bp=norm(b?.primary),bs=norm(b?.secondary);
  const hits=(x,y)=>x.some(m=>y.includes(m));
  if(hits(ap,bp))return 1;
  if(hits(ap,bs)||hits(as,bp))return .5;
  if(hits(as,bs))return .25;
  return 0}
/** Session freshness: how the lifts already finished today are running against their own
 *  capacity baselines, weighted by muscle overlap over a systemic floor. Temper-only —
 *  it can ease a not-yet-started lift's first set, never boost it (decision 7). */
function sessionFreshness(ex,draft){
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]);
  let wSum=0,wDev=0,setCount=0,contributors=0;
  for(const o of state.program){
    if(!o||o.id===ex.id||o.day!==ex.day)continue;
    const caps=[];
    for(let k=1;k<=(+o.sets||0);k++){const key=`${o.id}_${k}`;
      if(!done.has(key)||warm.has(key))continue;
      const ld=fromDisplay(parseDec(draft[`${key}_load`])||0),rp=parseDec(draft[`${key}_reps`])||0;
      if(!(ld>0&&rp>0))continue;
      let rir;if(isEffortMode())rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
      else{rir=parseDec(draft[`${key}_rir`]);if(!Number.isFinite(rir))rir=1}
      caps.push(capE1rm(ld,rp,rir))}
    if(!caps.length)continue;
    setCount+=caps.length;
    // No baseline (fewer than 2 sessions) means no way to read today as high or low.
    const base=capacityBaseline(o);
    if(!(base>0))continue;
    const dev=clamp((Math.max(...caps)-base)/base,-.5,.5);
    const w=CAPACITY.temperFloor+(1-CAPACITY.temperFloor)*muscleOverlap(ex,o);
    wSum+=w;wDev+=w*dev;contributors++}
  // Evidence gate: too little logged today, or nothing with a baseline, stays silent.
  if(setCount<CAPACITY.temperMinSets||!contributors||!(wSum>0))return 1;
  return clamp(1+CAPACITY.temperDamp*Math.min(wDev/wSum,0),1-CAPACITY.temperClamp,1)}
/** No sets of this lift logged yet today: previous-session recommendation, eased by
 *  session freshness. Freshness moves reps; it only touches load when the tempered
 *  target would otherwise fall out of the bottom of the range. */
function baseSuggestion(ex,rec,draft,old){
  const reps=rec.load!=null?baseSetReps(ex,rec,old):(old&&+old.reps>0?+old.reps:ex.min);
  if(rec.load==null||!(rec.cap>0))return{load:rec.load,reps,src:"base"};
  const factor=sessionFreshness(ex,draft);
  if(!(factor<1))return{load:rec.load,reps,src:"base"};
  const minJ=+state.settings.minJump||2.5,cap=rec.cap*factor;
  let load=rec.load,raw=Math.round(repsAtLoad(cap,load)-(+rec.typRir||0));
  // A deficit deep enough to push the target under the range comes out of the load instead.
  if(raw<ex.min){load=Math.max(round(load-jump(load,1)),minJ);raw=Math.round(repsAtLoad(cap,load)-(+rec.typRir||0))}
  return{load,reps:Math.min(reps,clamp(raw,ex.min,ex.max)),src:"base",tempered:true}}
// Per-set load + reps suggestion, layering three signals:
//  1. previous session (rec.load / baseSetReps) — primary
//  2. current-session performance (completed sets this workout) — strong autoregulation
//  3. block trend (folded into rec) — weak
// In-session prediction is anticipatory: it reads every completed set so far and
// projects the NEXT one, rather than echoing the last set back at the lifter.
function setSuggestion(ex,n,rec,draft,old){
  const minJ=+state.settings.minJump||2.5;
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]);
  // Every completed working set for this lift earlier in THIS session, in order.
  const sets=[];
  for(let k=1;k<n;k++){const key=`${ex.id}_${k}`;
    if(!done.has(key)||warm.has(key))continue;
    const ld=fromDisplay(parseDec(draft[`${key}_load`])||0),rp=parseDec(draft[`${key}_reps`])||0;
    if(!(ld>0&&rp>0))continue;
    let rir;if(isEffortMode())rir=EFFORT_RIR[draft[`${key}_effort`]]??1;
    else{rir=parseDec(draft[`${key}_rir`]);if(!Number.isFinite(rir))rir=1}
    sets.push({load:ld,reps:rp,rir,cap:capE1rm(ld,rp,rir)})}
  if(!sets.length)return baseSuggestion(ex,rec,draft,old);
  const typRir=rec.typRir!=null?rec.typRir:typicalRir(ex);
  const lastSet=sets.at(-1),L=lastSet.load;
  const setDrop=expectedSetDrop(ex,sets.map(s=>s.cap));
  const predCap=lastSet.cap*(1-setDrop);
  const predPerf=repsAtLoad(predCap,L)-typRir;
  if(predPerf>=ex.max+CAPACITY.jumpMargin){const L2=round(L+jump(L,1));
    return{load:L2,reps:reentryReps(ex,predCap,L2,typRir),src:"session-up"}}
  if(predPerf<ex.min){const L2=Math.max(round(L-jump(L,1)),minJ);
    return{load:L2,reps:reentryReps(ex,predCap,L2,typRir),src:"session-down"}}
  const reps=clamp(Math.round(predPerf),ex.min,ex.max);
  // Only call it a downward trend when an anticipated drop actually caused it —
  // a target lowered purely by the typical-RIR subtraction is not a fade.
  return{load:L,reps,src:"session-hold",drop:setDrop>0&&reps<lastSet.reps}}
// One-line summary of how the current session is steering the next unlogged set.
function inSessionNote(ex,draft){
  const done=new Set(draft.__done||[]),warm=new Set(draft.__warm||[]),changed=new Set(draft.__touched||[]);
  const rec=recommendation(ex),u=unitLabel();
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
    if(done.has(key)||warm.has(key)||changed.has(key))continue;
    const sg=setSuggestion(ex,n,rec,draft,null);
    if(sg.src==="session-up")return t("log.insession.up",{set:n,load:fmtLoad(sg.load),unit:u});
    if(sg.src==="session-down")return t("log.insession.down",{set:n,load:fmtLoad(sg.load),unit:u});
    // Name the signal, never the arithmetic: an anticipated fade reads as a trend.
    if(sg.src==="session-hold"&&sg.drop)return t("log.insession.drop",{set:n,load:fmtLoad(sg.load),unit:u,reps:sg.reps});
    if(sg.src==="session-hold")return t("log.insession.hold",{set:n,load:fmtLoad(sg.load),unit:u,reps:sg.reps});
    if(sg.tempered)return t("log.insession.temper");
    if((rec.status==="add"||rec.status==="add2")&&sg.load!=null&&sg.reps>ex.min)
      return t("log.insession.reentry",{load:fmtLoad(sg.load),unit:u,reps:sg.reps})}
  return""}
// On-demand arithmetic behind one recommendation (plan 043). Built at tap time only,
// never during renderWorkout: the Log tab's render path stays free of this work.
// One brain — every number here is a field the engine attached to its own result;
// nothing re-derives a trigger. Returns ordered {label?,text} rows.
function explainRecommendation(ex){
  const rows=[];
  if(!ex)return rows;
  const rec=recommendation(ex),u=unitLabel();
  // A never-trained lift has no history and no arithmetic; the button is hidden there.
  if(rec.status==="new")return rows;
  const prev=last(ex).filter(x=>+x.load>0);
  if(prev.length)rows.push({label:t("why.last"),
    text:prev.map(x=>`${fmtLoad(x.load)}\u00d7${x.reps} ${effortOrRirLabel(x.rir)}`).join(" \u00b7 ")});
  rows.push({text:t(isEffortMode()?"why.showed_effort":"why.showed",
    {cr:Math.round(rec.cr),load:fmtLoad(rec.lastLoad),unit:u,cap:fmt(+state.settings.hardRir||4)})});
  // The tempered line already names both the rule and the tempering, so it stands alone.
  rows.push({text:rec.temperedBlock?t("rec.add.tempered.text")
    :t("why.rule."+rec.reason,{max:ex.max,min:ex.min,cr:Math.round(rec.cr),
      margin:CAPACITY.bigJumpMargin,gap:Math.round(rec.cr-rec.lastMedReps)})});
  const minJ=+state.settings.minJump||2.5,pct=(+state.settings.jumpPct||0)*(rec.jumpMult||1),
    raw=rec.lastLoad*pct/100,
    move={prev:fmtLoad(rec.lastLoad),pct:fmt(pct),step:fmtLoad(minJ),load:fmtLoad(rec.load),unit:u};
  // A small percentage on a light load is dominated by the minJump step; say which one moved it.
  if(rec.reason==="top"||rec.reason==="cap_top"||rec.reason==="cap_top2")
    rows.push({text:t(raw>minJ?"why.load_up":"why.load_up_step",move)});
  else if(rec.reason==="below_range")rows.push({text:t(raw>minJ?"why.load_down":"why.load_down_step",move)});
  else if(sameLoad(rec.load,rec.lastLoad))rows.push({text:t("why.load_hold",{load:fmtLoad(rec.load),unit:u})});
  else rows.push({text:t("why.load_snap",{step:fmtLoad(minJ),load:fmtLoad(rec.load),unit:u})});
  if(rec.reenterReps)rows.push({text:t(isEffortMode()?"why.reps_effort":"why.reps",
    {load:fmtLoad(rec.load),unit:u,pred:Math.round(repsAtLoad(rec.cap,rec.load)),
      typrir:fmt(rec.typRir),reps:reentryReps(ex,rec.cap,rec.load,rec.typRir)})});
  else if(rec.pushReps)rows.push({text:t("why.reps_chase",{min:ex.min,max:ex.max})});
  else rows.push({text:t("why.reps_hold")});
  if(rec.blockNote&&!rec.temperedBlock)rows.push({text:rec.blockNote});
  const note=inSessionNote(ex,loadDraft());
  if(note)rows.push({label:t("why.session"),text:note});
  return rows}
// Re-apply suggestions to one lift's still-untouched sets, in place.
function applySuggestions(ex,draft){const rec=recommendation(ex),prev=last(ex);
  for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
    if(committed.has(key)||touched.has(key)||warmups.has(key))continue;
    const old=prev.find(x=>x.set===n),sg=setSuggestion(ex,n,rec,draft,old);
    if(sg.load!=null){const li=$(`[data-k="${key}_load"]`);if(li)li.value=fmtLoadPlain(sg.load)}
    if(sg.reps!=null){const ri=$(`[data-k="${key}_reps"]`);if(ri)ri.value=sg.reps}}}
const hasCommittedSets=ex=>{for(let n=1;n<=ex.sets;n++)if(committed.has(`${ex.id}_${n}`))return true;return false};
// After a set is committed, re-apply suggestions to still-untouched later sets.
function refreshSuggestions(exId){let ex=prog.find(exId);if(!ex)return;ex=sessionExercise(ex);
  const draft=loadDraft();
  applySuggestions(ex,draft);updateInSessionNote(exId);
  // Session freshness reads the lifts already finished today, so this commit can also
  // move the opening ghosts of lifts on this day that have not been started yet.
  // saveDraft() snapshots every input, so an unrefreshed ghost would freeze as drafted.
  for(const o of exercises(ex.day)){if(o.id===ex.id||hasCommittedSets(o))continue;
    applySuggestions(sessionExercise(o),draft);updateInSessionNote(o.id)}
  saveDraft()}
function updateInSessionNote(exId){const art=$(`#workout [data-ex="${exId}"]`);if(!art)return;
  const ex=sessionExercise(prog.find(exId));if(!ex)return;const text=inSessionNote(ex,loadDraft());
  let el=art.querySelector(".insession");
  if(!text){el?.remove();return}
  if(el){el.textContent=text;return}
  el=document.createElement("div");el.className="insession";el.textContent=text;
  const anchor=art.querySelector(".delta-prev")||art.querySelector(".prev");
  if(anchor)anchor.insertAdjacentElement("afterend",el);
  else{const head=art.querySelector(".sets__head");if(head)head.insertAdjacentElement("beforebegin",el)}}
function fmtClock(s){const sec=Math.max(0,Math.round(Number(s)||0));const m=Math.floor(sec/60);return `${m}:${String(sec%60).padStart(2,"0")}`}
/** Rest reads in two places: the floating bar for List, and the chip in the
 *  workout header for Focus — where it must never sit over a control.
 *  `over` is seconds elapsed past the bell; it drives the overtime styling. */
function paintRest(text,done,over=0){
  paintRestSheet();
  const b=$("#restBar");
  if(b){const el=b.querySelector(".restbar__time");if(el)el.textContent=text;
    b.classList.toggle("is-done",!!done);
    b.classList.toggle("is-over",over>0);
    b.classList.toggle("is-paused",restPaused!=null)}
  const chip=$("#woRest");if(!chip)return;
  const el=chip.querySelector(".wo-rest__time");if(el)el.textContent=text;
  chip.classList.toggle("is-done",!!done);
  chip.classList.toggle("is-over",over>0);
  chip.classList.toggle("is-paused",restPaused!=null);
  const running=chip.classList.contains("is-running");
  if(!running)chip.setAttribute("aria-label",t("focus.rest.start_aria"));
  else if(restPaused!=null)chip.setAttribute("aria-label",t("focus.rest.paused_aria",{time:text}));
  else if(over>0)chip.setAttribute("aria-label",t("focus.rest.over_aria",{time:fmtClock(over)}));
  else chip.setAttribute("aria-label",t(done?"focus.rest.done_aria":"focus.rest.running_aria",{time:text}))}
/** Show or hide the header chip, and keep the floating bar out of Focus. */
function updateRestChrome(){
  const focus=workoutActive&&logMode==="focus";
  const chip=$("#woRest");
  const preview=tourActive&&tourPreview?.showRest;
  const restOn=+state.settings.restSec>0;
  if(chip){
    const on=focus&&(restOn||preview);
    chip.classList.toggle("hidden",!on);
    chip.classList.toggle("is-running",!!restEnd);
    chip.disabled=!!(preview&&!restOn);
    if(preview&&!restOn){
      chip.setAttribute("aria-label",t("tour.rest_preview_aria"));
      let hint=$("#woRestPreviewHint");
      if(!hint){hint=document.createElement("p");hint.id="woRestPreviewHint";hint.className="tour-rest-hint";chip.insertAdjacentElement("afterend",hint)}
      hint.textContent=t("tour.rest_preview_hint");hint.hidden=false}
    else{
      const hint=$("#woRestPreviewHint");if(hint)hint.hidden=true;
      if(!restEnd){chip.classList.remove("is-done","is-over");
        chip.setAttribute("aria-label",t("focus.rest.start_aria"))}}
    if(!restEnd&&!(preview&&!restOn))chip.classList.remove("is-done","is-over","is-paused")}
  const bar=$("#restBar");
  if(bar)bar.classList.toggle("is-shadowed",focus)}
function stopRest(){if(restTick){clearInterval(restTick);restTick=null}restEnd=0;restPaused=null;restAnnounced=false;
  $("#restBar")?.classList.add("hidden");paintRest("—",false);
  updateRestChrome();
  const ra=$("#restAnnounce");if(ra)ra.textContent="";
  if(window.RepForgeNotify)RepForgeNotify.closeTag("repforge-rest")}
/** Past the bell the clock keeps running as a negative count-up, so a glance
 *  says how long the set has been waiting. It stops climbing after an hour —
 *  by then the number has stopped meaning anything. */
const REST_OVERTIME_MAX=60*60;
/** Milliseconds left on the clock: frozen while held, and negative once the
 *  rest has run past the bell. Idle, it reads as the length the next rest
 *  would run for — which is what the sheet shows before anything is armed. */
function restLeftMs(){
  if(restPaused!=null)return restPaused;
  return restEnd?restEnd-Date.now():restPlanSec()*1000}
function restOvertimeSec(){return restEnd?Math.round(-restLeftMs()/1000):0}
/** One-shot side effects at zero: the live-region line, buzz, or OS notice. */
function ringRest(){
  announceRestDone();
  if(restNotified)return;
  restNotified=true;
  if(!window.RepForgeNotify||!RepForgeNotify.enabledFor(state.settings,"timer"))return;
  if(document.visibilityState==="visible")navigator.vibrate?.([200,100,200]);
  else RepForgeNotify.fireOS({title:t("notify.title"),body:t("notify.rest.body"),tag:"repforge-rest",url:"./index.html"})}
function tickRest(){const left=Math.round(restLeftMs()/1000);
  if(left>0){paintRest(fmtClock(left),false);return}
  const over=Math.min(-left,REST_OVERTIME_MAX);
  paintRest(over>0?`-${fmtClock(over)}`:"0:00",true,over);
  if(over>=REST_OVERTIME_MAX&&restTick){clearInterval(restTick);restTick=null}
  ringRest()}
function armRestTick(){clearInterval(restTick);restTick=setInterval(tickRest,250)}
/** Repaint every rest surface from the clock as it stands, without waiting for
 *  the next tick — a held clock has no tick, and a nudged one should read the
 *  new number the moment the button is released. */
function syncRest(){
  if(!restEnd){paintRest("—",false);updateRestChrome();return}
  const left=Math.round(restLeftMs()/1000);
  if(left>0)paintRest(fmtClock(left),false);
  else{const over=Math.min(-left,REST_OVERTIME_MAX);paintRest(over>0?`-${fmtClock(over)}`:"0:00",true,over)}
  updateRestChrome()}
function startRest(sec){const s=sec||restPlanSec();if(s<=0)return;
  restLength=s;restPaused=null;
  restEnd=Date.now()+s*1000;restNotified=false;restAnnounced=false;if(window.RepForgeNotify)RepForgeNotify.closeTag("repforge-rest");
  const ra=$("#restAnnounce");if(ra)ra.textContent="";
  $("#restBar")?.classList.remove("hidden");updateRestChrome();paintRest(fmtClock(s),false);
  armRestTick()}
window.__repforgeRest={
  expire(){
    if(!restEnd)return false;
    restEnd=Date.now()-1;restPaused=null;
    if(restTick){clearInterval(restTick);restTick=null}
    return true}};

/* ---- Rest timer sheet ---- */
/* Tapping a running clock used to end the rest — the one thing a lifter with a
   bar still in hand never means by it. The clock opens this sheet instead, and
   every edit to the rest lives here: hold it, nudge it 30s either way, restart
   it at another length, or end it deliberately. */
const REST_PRESETS=[60,90,180,300];
const REST_NUDGE=30;
const REST_MIN_SEC=15,REST_MAX_SEC=60*60;
let restSheetReturn=null;
/** The length this rest was armed at — the ring's full turn, and the length the
 *  next one starts at until Settings changes the default again. */
function restPlanSec(){
  if(restLength>0)return restLength;
  return normalizeRestSec(state?.settings?.restSec)}
const clampRestSec=s=>Math.min(REST_MAX_SEC,Math.max(REST_MIN_SEC,Math.round(s)||0));
function restPresetSecs(){
  const secs=new Set(REST_PRESETS);
  const dflt=normalizeRestSec(state?.settings?.restSec);
  if(dflt>0)secs.add(dflt);
  return [...secs].sort((a,b)=>a-b)}
function renderRestPresets(){
  const host=$("#restPresets");if(!host)return;
  host.innerHTML=restPresetSecs().map(s=>
    `<button type="button" class="restpreset" data-restpreset="${s}" aria-pressed="false" aria-label="${esc(t("rest.sheet.preset_aria",{time:fmtClock(s)}))}">${esc(fmtClock(s))}</button>`).join("");
  $$("#restPresets [data-restpreset]").forEach(b=>{b.onclick=()=>setRestLength(+b.dataset.restpreset)})}
/** The dial reads remaining-over-armed, so a rest nudged longer keeps a ring
 *  that still means something. */
function paintRestSheet(){
  const sheet=$("#restSheet");if(!sheet||sheet.hidden)return;
  const left=Math.round(restLeftMs()/1000);
  const over=left<0?Math.min(-left,REST_OVERTIME_MAX):0;
  const clock=$("#restSheetClock");
  if(clock)clock.textContent=over>0?`-${fmtClock(over)}`:fmtClock(Math.max(0,left));
  const arc=$("#restDialArc");
  if(arc){
    const c=2*Math.PI*(Number(arc.getAttribute("r"))||0);
    const frac=Math.max(0,Math.min(1,left/Math.max(1,restPlanSec())));
    arc.style.strokeDasharray=String(c);
    arc.style.strokeDashoffset=String(c*(1-frac))}
  const running=!!restEnd&&restPaused==null;
  sheet.classList.toggle("is-idle",!restEnd);
  sheet.classList.toggle("is-paused",restPaused!=null);
  sheet.classList.toggle("is-over",over>0);
  const play=$("#restPlayPause");
  if(play)play.setAttribute("aria-label",t(running?"rest.sheet.pause_aria":restEnd?"rest.sheet.resume_aria":"rest.sheet.start_aria"));
  const armed=restPlanSec();
  $$("#restPresets [data-restpreset]").forEach(b=>{
    const on=+b.dataset.restpreset===armed;
    b.classList.toggle("is-active",on);
    b.setAttribute("aria-pressed",on?"true":"false")});
  const reset=$("#restReset");if(reset)reset.disabled=!restEnd;
  const stop=$("#restStop");if(stop)stop.disabled=!restEnd}
function openRestSheet(){
  const sheet=$("#restSheet"),scrim=$("#restSheetScrim");
  if(!sheet)return;
  restSheetReturn=document.activeElement;
  renderRestPresets();
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:$("#restPlayPause"),
    returnFocus:restSheetReturn,
    onEscape:closeRestSheet,
    scrim,
    delayHide:reducedMotion()?0:280
  });
  paintRestSheet();
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeRestSheet(){
  const sheet=$("#restSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  restSheetReturn=null;
  return closeModal(sheet)}
/** Picking a length restarts the rest at it; idle, it only sets what the next
 *  one will run for. */
function setRestLength(sec){
  const s=clampRestSec(sec);
  restLength=s;
  if(restEnd)startRest(s);
  else syncRest();
  paintRestSheet()}
/** ±30s moves the clock, not the plan — except when the nudge pushes past the
 *  length it was armed at, which becomes the new full turn of the ring. */
function nudgeRest(delta){
  if(!restEnd){setRestLength(restPlanSec()+delta);return}
  const next=Math.min(REST_MAX_SEC*1000,Math.max(-REST_OVERTIME_MAX*1000,restLeftMs()+delta*1000));
  if(restPaused!=null)restPaused=next;else restEnd=Date.now()+next;
  const left=Math.ceil(next/1000);
  if(left>restLength)restLength=Math.min(REST_MAX_SEC,left);
  // Time added past the bell puts the rest back on the clock, so the line, the
  // buzz and the OS notice all have to be able to fire again.
  if(next>0){
    restNotified=false;restAnnounced=false;
    const ra=$("#restAnnounce");if(ra)ra.textContent="";
    if(window.RepForgeNotify)RepForgeNotify.closeTag("repforge-rest");
    if(restPaused==null&&!restTick)armRestTick()}
  syncRest()}
function toggleRestHold(){
  if(!restEnd){startRest(restPlanSec());return}
  if(restPaused!=null){
    restEnd=Date.now()+restPaused;restPaused=null;
    if(restOvertimeSec()<REST_OVERTIME_MAX)armRestTick()}
  else{
    restPaused=restEnd-Date.now();
    if(restTick){clearInterval(restTick);restTick=null}}
  syncRest()}
function resetRest(){if(!restEnd)return;startRest(restPlanSec())}
function endRestFromSheet(){stopRest();closeRestSheet()}
/** Shared visibility handler — rest-timer catch-up + session banner. */
function onAppVisible(){
  if(document.visibilityState!=="visible")return;
  if(restEnd&&restPaused==null&&Date.now()>=restEnd){
    // Background throttling freezes the tick; repaint from the clock, then let
    // the count-up carry on unless it has already run out its overtime.
    tickRest();
    if(!restTick&&restOvertimeSec()<REST_OVERTIME_MAX)armRestTick();
  }
  reconcileNotifyPermission();
  paintNotifyControls();
  updateSessionBanner();
}

function updateSessionBanner(){
  const el=$("#sessionBanner"); if(!el) return;
  const n=state.settings.notify;
  const hide=()=>{el.className="sessionbanner hidden"; el.innerHTML=""; el.onclick=null};
  if(!n||!n.enabled) return hide();
  if(RepForgeSchedule.hasLoggedOn(state.log, today())) return hide();
  if(!state.log.length) return hide();

  const due=RepForgeSchedule.mostOverdueDay(state.log, days(), today());
  if(!due) return hide();

  const meta=loadNotifyMeta();
  const hour=new Date().getHours();
  const usual=RepForgeSchedule.usualHour(state.log);
  const missedOk=!!n.missed && usual!=null && hour>=usual;
  const sessionOk=!!n.session;

  if(!missedOk && !sessionOk) return hide();
  if(!missedOk && meta.sessionBannerDate===today() && meta.sessionBannerDismissed) return hide();
  if(missedOk && meta.missedBannerDate===today() && meta.missedBannerDismissed) return hide();

  const isMissed=missedOk;
  const title=isMissed?t("session_banner.missed.title",{hour:usual}):t("session_banner.today.title",{day:dayLabel(due.day)});
  const body=isMissed?t("session_banner.missed.body",{day:dayLabel(due.day)}):t("session_banner.today.body",{day:dayLabel(due.day)});

  function dismissForToday(){
    const m=loadNotifyMeta();
    if(isMissed){m.missedBannerDate=today(); m.missedBannerDismissed=true}
    else{m.sessionBannerDate=today(); m.sessionBannerDismissed=true}
    saveNotifyMeta(m);
    hide();
  }

  el.className=`sessionbanner${isMissed?" is-missed":""}`;
  el.innerHTML=`<button type="button" class="sessionbanner__act"><p class="sessionbanner__title">${esc(title)}</p><p class="sessionbanner__body">${esc(body)}</p></button>`+
    `<button type="button" class="sessionbanner__close" aria-label="${esc(t("session_banner.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`;
  el.onclick=null;
  el.querySelector(".sessionbanner__close").onclick=e=>{e.stopPropagation();dismissForToday()};
  el.querySelector(".sessionbanner__act").onclick=()=>{
    if(!enterWorkout({day:due.day}))return;
    dismissForToday();
    toast(t("toast.day_ready",{day:dayLabel(due.day)}));
  };
}

function draftHasProgress(){try{const d=JSON.parse(DraftStore.readRaw()||"{}");
  return draftHasSessionWork(d)||!!contextFlagsFromDraft(d).day}catch{return false}}
function setWorkoutActive(on){const was=workoutActive;workoutActive=!!on;
  document.body.classList.toggle("is-workout",workoutActive);
  const dash=$("#todayDash"),shell=$("#workoutShell");
  if(dash)dash.classList.toggle("hidden",workoutActive);
  if(shell)shell.classList.toggle("hidden",!workoutActive);
  if(!workoutActive){document.body.classList.remove("is-focus-wo");closeWorkoutOverflow()}
  updateFocusChrome();
  if(workoutActive!==was)playPanelAnimation(workoutActive?shell:dash,workoutActive?"wo-anim-enter":"wo-anim-leave")}
/** Replay a one-shot CSS animation on a panel that just became visible. */
function playPanelAnimation(el,cls){if(!el)return;
  el.classList.remove("wo-anim-enter","wo-anim-leave");
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend",()=>el.classList.remove(cls),{once:true})}
function updateFocusChrome(){document.body.classList.toggle("is-focus-wo",workoutActive&&logMode==="focus");
  updateRestChrome()}

/* ---- Exercise note sheet ---- */
let exNoteFor=null,exNoteReturn=null;
function openExNoteSheet(exId){
  const ex=prog.find(exId);if(!ex)return;
  const sheet=$("#exNoteSheet"),scrim=$("#exNoteScrim"),ta=$("#exNoteText");
  if(!sheet||!ta)return;
  exNoteFor=exId;exNoteReturn=document.activeElement;
  $("#exNoteFor").textContent=substituted.get(exId)||ex.name;
  ta.value=$(`[data-exnote="${exId}"]`)?.value??(loadDraft().__exnotes?.[exId]??lastExerciseNote(ex));
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:ta,
    returnFocus:exNoteReturn,
    onEscape:closeExNoteSheet,
    scrim,
    delayHide:reducedMotion()?0:280
  });
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open");
    if(ta===document.activeElement)ta.setSelectionRange(ta.value.length,ta.value.length)})}
function closeExNoteSheet(){
  const sheet=$("#exNoteSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  exNoteFor=null;exNoteReturn=null;
  return closeModal(sheet)}
async function saveExNoteSheet(){
  const id=exNoteFor,val=$("#exNoteText")?.value??"";
  if(id){const ta=$(`[data-exnote="${id}"]`);if(ta)ta.value=val;saveDraft()}
  await closeExNoteSheet();
  if(id){
    renderWorkout();
    const trigger=$$("#workout [data-exnote-open]").find(b=>b.dataset.exnoteOpen===id);
    if(trigger){try{trigger.focus({preventScroll:true})}catch{try{trigger.focus()}catch{}}}}}
/* ---- Day picker sheet ---- */
/* Today leads with one day, and a split is rarely trained in order: a machine is
 * taken, a session is swapped, a day is skipped. The picker is how the lifter
 * takes another one from Today, instead of starting the wrong day to reach the
 * day tabs inside the workout. */
/** The day the sheet is armed on: chosen, not yet started. */
let dayPickSelected=null;
/* A default-named day is already numbered by its badge, so "Day 3 / Day 3" is
 * two labels for nothing: the row leads with what that day trains instead. A day
 * the lifter named leads with the name, and keeps the muscles in the line under
 * it. */
function dayPickRowHtml(d,i){
  const named=!DEFAULT_DAY_NAME.test(String(d).trim()),label=dayLabel(d);
  const muscles=dayMuscles(d).map(muscleLabel).join(" · ");
  const count=t("today.exercise_count",{n:exercises(d).length});
  const title=named?label:(muscles||label);
  const sub=named&&muscles?`${muscles} · ${count}`:count;
  const isToday=d===day,chip=t("today.choose_day_current");
  // The badge is a numeral, so the day it stands for is spelled out for anyone
  // who only hears the row.
  const aria=[label,title===label?"":title,sub,isToday?chip:""].filter(Boolean).join(" · ");
  return `<button type="button" class="daypick__row${d===dayPickSelected?" is-selected":""}" data-daypick="${esc(d)}"`+
    ` aria-pressed="${d===dayPickSelected?"true":"false"}" aria-label="${esc(aria)}">`+
    `<span class="daypick__n" aria-hidden="true">${esc(String(i+1))}</span>`+
    `<span class="daypick__main"><span class="daypick__line"><span class="daypick__title">${esc(title)}</span>`+
    (isToday?`<span class="daypick__chip">${esc(chip)}</span>`:"")+
    `</span><span class="daypick__sub">${esc(sub)}</span></span>`+
    `</button>`}
function renderDayPickList(){const list=$("#dayPickList");if(!list)return;
  list.innerHTML=days().map(dayPickRowHtml).join("");
  $$("#dayPickList [data-daypick]").forEach(b=>b.onclick=()=>armPickerDay(b.dataset.daypick))}
/** Arming repaints in place rather than rebuilding the list, so the row the
 *  keyboard is on is still there to keep the focus. */
function paintDayPickList(){
  $$("#dayPickList [data-daypick]").forEach(b=>{
    const on=b.dataset.daypick===dayPickSelected;
    b.classList.toggle("is-selected",on);
    b.setAttribute("aria-pressed",on?"true":"false")})}
function armPickerDay(d){
  if(!d||!days().includes(d))return;
  dayPickSelected=d;
  paintDayPickList()}
function openDayPickSheet(){
  const sheet=$("#dayPickSheet"),scrim=$("#dayPickScrim");
  if(!sheet)return;
  dayPickSelected=day;
  renderDayPickList();
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:$("#dayPickList .daypick__row.is-selected")||$("#dayPickList .daypick__row"),
    onEscape:closeDayPickSheet,
    scrim,
    delayHide:reducedMotion()?0:280
  });
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeDayPickSheet(){
  const sheet=$("#dayPickSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  return closeModal(sheet)}
/** Confirming starts the armed day, exactly as Up next and the session banner
 *  do. The discard prompt is answered while the sheet is still up, so declining
 *  it leaves the picker open on the day already loaded. */
async function confirmPickerDay(){
  const next=dayPickSelected;
  if(!next||!days().includes(next))return;
  if(!requestWorkoutDay(next))return;
  await closeDayPickSheet();
  enterWorkout({day:next,focus:true});
  toast(t("toast.day_ready",{day:dayLabel(next)}))}
/** Keep the sheet above the software keyboard rather than behind it, and inside
 *  the band the keyboard leaves visible so its header stays on screen. */
function trackSheetViewport(){
  const vv=window.visualViewport;if(!vv)return;
  const root=document.documentElement;
  const apply=()=>{const inset=Math.max(0,window.innerHeight-vv.height-vv.offsetTop);
    root.style.setProperty("--kb",`${Math.round(inset)}px`);
    root.style.setProperty("--vvh",`${Math.round(vv.height)}px`)};
  vv.addEventListener("resize",apply);vv.addEventListener("scroll",apply);apply()}
/* ---- Zoom is off everywhere ---- */
/* The layout is already sized to the phone, and it is worked one-handed between
 * sets: a zoom is never asked for and always in the way, because the hand that
 * would pinch back out is holding a dumbbell. `touch-action` in styles.css and
 * the viewport meta take the touch gestures and the focus zoom; these listeners
 * take what neither reaches — iOS Safari's own pinch gestures, a trackpad pinch
 * or ctrl+wheel, and the browser zoom shortcuts. Every one needs `passive:false`
 * to be allowed to cancel. */
function blockZoomGestures(){
  const stop=e=>{if(e.cancelable)e.preventDefault()};
  // Safari reports a pinch as its own gesture, outside `touch-action`.
  for(const type of ["gesturestart","gesturechange","gestureend"])
    document.addEventListener(type,stop,{passive:false});
  // Nothing here is driven by two fingers, so a second one is always a pinch.
  document.addEventListener("touchmove",e=>{if(e.touches.length>1)stop(e)},{passive:false});
  // A trackpad pinch arrives as a wheel event with ctrlKey set, as does ctrl+wheel.
  window.addEventListener("wheel",e=>{if(e.ctrlKey)stop(e)},{passive:false});
  // Ctrl/Cmd with +, -, or 0 — including the numpad keys and the unshifted "=".
  window.addEventListener("keydown",e=>{
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    if(["+","-","=","_","0"].includes(e.key))stop(e)},{passive:false});
}
/* ---- Swipe down to dismiss (every bottom sheet) ---- */
/* The grab handle promises a sheet that can be pushed back down, so the gesture
 * has to answer: the sheet follows the thumb, and past a real commitment it
 * keeps going and closes instead of springing back. A completed swipe runs the
 * sheet's own dismiss — the same one Escape and a tap on the scrim run — so it
 * can never save or copy something a tap wouldn't. */
let sheetDrag=null;
const SHEET_DRAG_LOCK=8;
/** True when the gesture belongs to a scroller inside the sheet: something the
 *  lifter has already scrolled down keeps the drag, and scrolls back up. */
function sheetScrollHeld(target,sheet){
  for(let n=target;n instanceof Element&&n!==sheet;n=n.parentElement){
    if(n.scrollHeight>n.clientHeight+1&&n.scrollTop>0)return true}
  return false}
function sheetDragStart(e){
  if(sheetDrag)return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const rec=activeModal;
  if(!rec||rec.closing||typeof rec.onEscape!=="function")return;
  if(!rec.el?.classList.contains("sheet"))return;
  const target=e.target instanceof Element?e.target:null;
  if(!target||!rec.el.contains(target))return;
  // A mouse inside a text field is selecting, not swiping. A thumb in one has no
  // other use for a downward drag once the field is already at its top.
  if(e.pointerType==="mouse"&&target.closest("input,select,textarea,[contenteditable]"))return;
  if(sheetScrollHeld(target,rec.el))return;
  sheetDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dy:0,live:false,rec,
    vy:0,lastY:e.clientY,lastT:e.timeStamp||performance.now()}}
function sheetDragMove(e){
  if(!sheetDrag||e.pointerId!==sheetDrag.id)return;
  const rec=sheetDrag.rec;
  if(activeModal!==rec||rec.closing){sheetDragEnd();return}
  const dy=e.clientY-sheetDrag.y,dx=e.clientX-sheetDrag.x;
  if(!sheetDrag.live){
    // Upwards or sideways is somebody else's gesture; only a downward push takes
    // the sheet, and only once it has cleared the slop a resting thumb wanders.
    if(dy<=-SHEET_DRAG_LOCK||(Math.abs(dx)>=SHEET_DRAG_LOCK&&Math.abs(dx)>Math.abs(dy))){sheetDrag=null;return}
    if(dy<SHEET_DRAG_LOCK)return;
    sheetDrag.live=true;
    rec.el.classList.add("is-dragging");
    rec.scrim?.classList.add("is-dragging");
    // Anchor where the drag was recognised, so the sheet doesn't jump by the slop.
    sheetDrag.y=e.clientY-SHEET_DRAG_LOCK}
  const now=e.timeStamp||performance.now(),dt=now-sheetDrag.lastT;
  if(dt>0){sheetDrag.vy=(e.clientY-sheetDrag.lastY)/dt;sheetDrag.lastY=e.clientY;sheetDrag.lastT=now}
  sheetDrag.dy=Math.max(0,e.clientY-sheetDrag.y);
  rec.el.style.transform=`translate3d(0,${sheetDrag.dy}px,0)`;
  // The scrim thins as the sheet leaves, so the page behind is already coming back.
  if(rec.scrim)rec.scrim.style.opacity=String(Math.max(0,1-sheetDrag.dy/(rec.el.offsetHeight||1)))}
/** Hand the sheet back to the stylesheet. Dropping the inline transform in the
 *  same tick as the class restores the transition from wherever the thumb left
 *  it, so the sheet either springs back or carries on down — never cuts. */
function sheetDragRelease(rec){
  rec.el.classList.remove("is-dragging");
  rec.el.style.transform="";
  rec.scrim?.classList.remove("is-dragging");
  if(rec.scrim)rec.scrim.style.opacity=""}
function sheetDragEnd(e){
  if(!sheetDrag||(e&&e.pointerId!=null&&e.pointerId!==sheetDrag.id))return;
  const{rec,dy,vy,live}=sheetDrag;sheetDrag=null;
  if(!live)return;
  // The drag ends over whatever the thumb started on, so a button under it must
  // not also fire.
  if(dy>SHEET_DRAG_LOCK)swallowNextClick();
  sheetDragRelease(rec);
  if(activeModal!==rec||rec.closing)return;
  // A deliberate throw counts as much as a long push (0.5px/ms is a flick), and
  // anything short of either is the lifter changing their mind.
  const flick=vy>=.5&&dy>=32;
  if(flick||dy>=Math.min(160,Math.max(64,(rec.el.offsetHeight||0)*.32)))rec.onEscape()}
function focusGo(dir){
  const fl=focusList(),at=fl.length?Math.min(focusIndex,fl.length-1):0,next=at+dir;
  if(next<0||next>=fl.length)return false;
  focusIndex=next;focusEdit=null;renderWorkout();window.scrollTo({top:0});return true}
function focusCanGo(dir){const fl=focusList(),at=fl.length?Math.min(focusIndex,fl.length-1):0;
  return at+dir>=0&&at+dir<fl.length}
function focusCard(){return $("#workout.is-focus .exercise.is-current")}
function focusTrack(){return $("#focusTrack")}
/** How far the track travels to bring a neighbour card into place. */
function focusStep(){const card=focusCard();return (card?.offsetWidth||320)+FOCUS_GAP}
const FOCUS_GAP=14;
const reducedMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
/** Carry the deck one card over, animating the track exactly as a fling does,
 *  then re-render at the new index with the track back at rest. Chevrons, the
 *  Next exercise button, the arrow keys and a completed swipe all land here. */
function focusAnimateTo(dir){
  if(focusFlinging||!focusCanGo(dir))return false;
  const track=focusTrack(),deck=$("#focusDeck");
  if(!track||reducedMotion())return focusGo(dir);
  focusFlinging=true;
  deck?.classList.add("is-swiping");
  track.classList.add("is-settling");
  focusSetTrack(track,-dir*focusStep());
  setTimeout(()=>{
    focusFlinging=false;
    track.classList.remove("is-settling");
    deck?.classList.remove("is-swiping");
    focusGo(dir)},FOCUS_SLIDE_MS);
  return true}
const FOCUS_SLIDE_MS=210;
/** One place that writes the track's transform, so drag, fling and reset agree. */
function focusSetTrack(track,dx){
  if(track)track.style.transform=`translate3d(${dx}px,0,0)`}
function focusDragStart(e){
  if(focusFlinging||!workoutActive||logMode!=="focus")return;
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const el=e.target instanceof Element?e.target:null;
  // Fields keep their caret; every other part of the card is draggable, with the
  // click that follows a real drag swallowed so buttons don't also fire.
  if(el&&el.closest("input,select,textarea,[contenteditable]"))return;
  const card=focusCard(),track=focusTrack();if(!card||!track)return;
  const ledger=card.querySelector(".fcard__ledger");
  focusDrag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:0,axis:null,card,track,
    scrolls:!!ledger&&ledger.scrollHeight>ledger.clientHeight+1,
    vx:0,lastX:e.clientX,lastT:e.timeStamp||performance.now()}}
const DRAG_LOCK=10;
function focusDragMove(e){
  if(!focusDrag||e.pointerId!==focusDrag.id)return;
  const mx=e.clientX-focusDrag.x,my=e.clientY-focusDrag.y;
  if(!focusDrag.axis){
    // A gesture is only surrendered to the scroller when there is something to
    // scroll, and only when it is emphatically vertical. Otherwise it keeps waiting
    // for the horizontal axis to win: a thumb swipe usually starts with a vertical
    // nudge, and the first touch sample of a fast one lands far from the start, so
    // judging on that first sample throws the whole gesture away.
    if(focusDrag.scrolls&&Math.abs(my)>=18&&Math.abs(my)>Math.abs(mx)*2){focusDrag=null;return}
    if(Math.abs(mx)<DRAG_LOCK||Math.abs(mx)<=Math.abs(my))return;
    focusDrag.axis="x";
    focusDrag.card.classList.add("is-dragging");
    $("#focusDeck")?.classList.add("is-swiping");
    // Anchor to where the axis locked so the card doesn't jump by the slop.
    focusDrag.x=e.clientX-Math.sign(mx)*DRAG_LOCK}
  const now=e.timeStamp||performance.now(),dt=now-focusDrag.lastT;
  if(dt>0){focusDrag.vx=(e.clientX-focusDrag.lastX)/dt;focusDrag.lastX=e.clientX;focusDrag.lastT=now}
  const dx=e.clientX-focusDrag.x;
  const blocked=(dx>0&&!focusCanGo(-1))||(dx<0&&!focusCanGo(1));
  focusDrag.dx=blocked?dx*.28:dx;
  // The whole track moves as one, the way a paged view does — card and the
  // stack it sits on together.
  focusSetTrack(focusDrag.track,focusDrag.dx)}
function swallowNextClick(){
  const stop=ev=>{ev.stopPropagation();ev.preventDefault()};
  document.addEventListener("click",stop,{capture:true,once:true});
  setTimeout(()=>document.removeEventListener("click",stop,{capture:true}),350)}
function focusSettle(track,card,deck){
  card?.classList.remove("is-dragging");
  track?.classList.add("is-settling");
  focusSetTrack(track,0);
  setTimeout(()=>{track?.classList.remove("is-settling");deck?.classList.remove("is-swiping")},220)}
function focusDragEnd(e){
  if(!focusDrag||(e&&e.pointerId!=null&&e.pointerId!==focusDrag.id))return;
  const{card,track,dx,axis,vx}=focusDrag;focusDrag=null;
  const deck=$("#focusDeck");
  if(axis!=="x")return;
  if(Math.abs(dx)>8)swallowNextClick();
  const dir=dx<0?1:-1,width=card.offsetWidth||320;
  // A short flick counts as much as a long drag, as long as it kept going the way
  // it was thrown (0.4px/ms is roughly a deliberate flick).
  const flick=Math.abs(vx)>=.4&&Math.sign(vx)===Math.sign(dx)&&Math.abs(dx)>=28;
  const past=Math.abs(dx)>=Math.min(110,Math.max(56,width*.2))||flick;
  if(!past||!focusCanGo(dir)){focusSettle(track,card,deck);return}
  card.classList.remove("is-dragging");
  focusAnimateTo(dir)}
function enterWorkout(opts={}){if(opts.day&&!requestWorkoutDay(opts.day))return false;
  workoutLeft=false;setWorkoutActive(true);
  // Focus layout matches mock 01; List remains the default for broad editing/tests.
  if(opts.focus===true)logMode="focus";
  else if(opts.focus===false)logMode="full";
  syncLogModeControls();
  document.body.classList.toggle("is-focus-wo",logMode==="focus");
  renderTabs();renderWorkout();renderToday();window.scrollTo({top:0});return true}
function leaveWorkout(){workoutLeft=true;focusEdit=null;setWorkoutActive(false);document.body.classList.remove("is-focus-wo");renderToday();window.scrollTo({top:0})}
function dayMuscles(d){const seen=[],exs=exercises(d||day);
  for(const e of exs){const m=String(e.primary||"").split(",")[0].trim();if(m&&!seen.includes(m))seen.push(m);if(seen.length>=3)break}
  return seen}
function formatLongDate(iso){const d=new Date(`${iso}T12:00:00`);if(Number.isNaN(+d))return iso;
  try{const s=d.toLocaleDateString(I18N?.speechLang?.()||state.settings.lang||"en",{weekday:"long",day:"numeric",month:"long"});
    return s?s.charAt(0).toUpperCase()+s.slice(1):s}
  catch{return iso}}
function weekdayLetters(){return isPt()?["S","T","Q","Q","S","S","D"]:["M","T","W","T","F","S","S"]}
/** Sessions saved today, in the order they were logged. */
function sessionsToday(){const iso=today(),by=new Map();
  for(const r of state.log){if(String(r.date)!==iso)continue;
    const k=String(r.session||iso);
    let s=by.get(k);if(!s){s={session:k,day:r.day,rows:[]};by.set(k,s)}
    s.rows.push(r)}
  return [...by.values()]}
/** What today already holds, or null when nothing is logged yet. Today swaps its
 *  whole session block for this: a finished day is not one to start again. */
function todayRecap(week){const sessions=sessionsToday();if(!sessions.length)return null;
  const iso=today(),work=sessions.flatMap(s=>s.rows).filter(isWork);
  const doneDays=[...new Set(sessions.map(s=>s.day).filter(Boolean))];
  // A lift's first appearance sets its bests without beating anything, so only
  // events carrying a delta are records the lifter actually broke today.
  const prLifts=new Set((week?.prs||[])
    .filter(ev=>String(ev.date)===iso&&(ev.deltaLoad!=null||ev.deltaReps!=null||ev.deltaE1rm!=null))
    .map(ev=>ev.liftKey));
  return{sessions,days:doneDays,lastDay:sessions.at(-1).day||day,
    muscles:[...new Set(work.map(r=>String(rowMuscles(r).primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3),
    sets:work.length,volume:sum(work.map(r=>(+r.load||0)*(+r.reps||0))),prs:prLifts.size}}
/** The program day that follows `from`, or null when the split has only one. */
function nextDayAfter(from){const ds=days();if(!ds.length)return null;
  const i=ds.indexOf(from);if(i<0)return ds[0];
  return ds.length>1?ds[(i+1)%ds.length]:null}
/** The program day that follows the last one trained today. */
function dayAfterTrainedToday(){const done=sessionsToday();
  return nextDayAfter(done.length?done.at(-1).day:day)}
function todayDoneHtml(recap){
  return `<div class="today-done">`+
    `<div class="today-session__name today-done__name"><span class="today-done__check" aria-hidden="true"></span>`+
    `${esc(recap.days.join(" · ")||t("today.done_title"))}</div>`+
    (recap.muscles.length?`<div class="today-session__muscles">${esc(recap.muscles.map(muscleLabel).join(" · "))}</div>`:"")+
    `<div class="today-session__meta">${esc(t("today.done_meta",{sets:recap.sets,setword:tp(recap.sets,"set"),vol:kfmt(toDisplay(recap.volume)),unit:unitLabel()}))}</div>`+
    (recap.prs?`<p class="today-done__pr">${esc(recap.prs===1?t("today.done_pr_one"):t("today.done_prs",{n:recap.prs}))}</p>`:"")+
    `<p class="today-done__note">${esc(t("today.done_note"))}</p></div>`}
/** Whichever action Today is currently leading with — the start CTA, or the
 *  recap's review action once the day's session is saved. */
function todayPrimaryControl(){
  for(const sel of["#startWorkout","#reviewTodaySession"]){const el=$(sel);if(el&&canTakeFocus(el))return el}
  return $("#todayDash .page-title")}
/** Today's recap hands off to History, opened on the session it describes. */
function openTodaySessionInHistory(){const done=sessionsToday();if(!done.length)return;
  editSession=done.at(-1).session;histQuery="";
  navTo("history");
  $$("#sessions [data-sess]").find(el=>el.dataset.sess===editSession)?.scrollIntoView({behavior:"smooth",block:"center"})}
// The day's exercises, previewed on Today: sets × rep range per row, the rest
// behind a "+N" disclosure. Tapping a row opens that exercise's page.
function todayExListHtml(exs){if(!exs.length)return"";
  const collapsible=exs.length>TODAY_EX_PREVIEW,extra=exs.length-TODAY_EX_PREVIEW;
  const shown=collapsible&&!todayExOpen?exs.slice(0,TODAY_EX_PREVIEW):exs;
  const rows=shown.map(e=>`<button type="button" class="today-ex" data-exopen="${esc(e.id)}" aria-label="${esc(t("log.open_exercise_aria",{name:e.name}))}">`+
    `<span class="today-ex__name">${esc(e.name)}</span>`+
    `<span class="today-ex__value">${esc(`${e.sets} × ${e.min}–${e.max}`)}<span class="chevron" aria-hidden="true"></span></span></button>`).join("");
  const label=todayExOpen?t("today.fewer_exercises"):extra===1?t("today.more_exercises_one"):t("today.more_exercises",{n:extra});
  const more=collapsible
    ?`<button type="button" class="today-exmore" id="todayExMore" aria-expanded="${todayExOpen?"true":"false"}" aria-controls="todayExList">`+
      `<span>${esc(label)}</span><span class="chevron ${todayExOpen?"is-up":"is-down"}" aria-hidden="true"></span></button>`
    :"";
  return `<div class="today-exlist" id="todayExList">${rows}${more}</div>`}
function renderToday(){const dateEl=$("#todayDate");if(dateEl)dateEl.textContent=formatLongDate(today());
  const week=weeklySnapshot();
  const mc=mesocycleWeek(),nm=state.programMeta?.name,progEl=$("#todayProgram");
  if(progEl){if(nm||mc.current!=null||mc.isComplete){progEl.classList.remove("hidden");
    const segs=mc.total||6,cur=mc.current||0,weekCopy=mesocycleWeekCopy(mc);
    progEl.innerHTML=`<div class="today-prog__name">${esc(nm||t("untitled_program"))}</div>`+
      (weekCopy?`<div class="today-prog__week">${esc(weekCopy)}</div>`:"")+
      `<div class="segbar">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<Math.min(cur,segs)?" is-done":""}${i===Math.min(cur,segs)-1?" is-current":""}"></span>`).join("")}</div>`+
      (week.plannedDays?`<div class="today-prog__done">${esc(t("today.sessions_done",{done:week.completedDays,planned:week.plannedDays}))}</div>`:"")}
    else{progEl.classList.add("hidden");progEl.innerHTML=""}}
  // A saved session means today is spent: Today recaps it instead of offering the
  // day again. An unsaved draft still outranks it — that session is not over.
  const inProgress=draftHasProgress(),recap=inProgress?null:todayRecap(week);
  const sessLabel=$("#todaySessionLabel");if(sessLabel){const key=recap?"today.done_label":"today.session_label";
    sessLabel.setAttribute("data-i18n",key);sessLabel.textContent=t(key)}
  const sess=$("#todaySession");if(sess&&recap)sess.innerHTML=todayDoneHtml(recap);
  else if(sess){const exs=exercises(),mus=dayMuscles(),hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
    sess.innerHTML=`<div class="today-session__name">${esc(dayLabel(day))}</div>`+
      (mus.length?`<div class="today-session__muscles">${esc(mus.map(muscleLabel).join(" · "))}</div>`:"")+
      `<div class="today-session__meta">${esc(t("today.exercise_count",{n:exs.length}))}</div>`+
      (hot?`<button type="button" class="today-ready" id="readyLine"><span class="today-ready__dot" aria-hidden="true"></span>${esc(t("today.ready_to_increase",{n:hot}))}</button>`:"")+
      todayExListHtml(exs)}
    // A one-day split has no other day to offer, so the picker would open onto
    // the day Today already leads with.
    const canPickDay=!recap&&days().length>1;
    for(const[sel,shown]of[["#startWorkout",!recap],["#chooseAnotherDay",canPickDay],["#viewExercises",!recap],["#reviewTodaySession",!!recap],["#logAnotherSession",!!recap]]){
      const el=$(sel);if(el)el.classList.toggle("hidden",!shown)}
    const ready=$("#readyLine");if(ready)ready.onclick=()=>{enterWorkout({focus:true});
      const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");
      if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}
    $$("#todayExList [data-exopen]").forEach(b=>b.onclick=()=>openExerciseView(b.dataset.exopen,"log"));
    const more=$("#todayExMore");if(more)more.onclick=()=>{todayExOpen=!todayExOpen;renderToday()}
  // A draft with logged or filled sets means the session is still open.
  const cta=$("#startWorkout")?.querySelector("span");
  if(cta){const key=inProgress?"today.continue":"today.start";
    cta.setAttribute("data-i18n",key);cta.textContent=t(key)}
  const weekEl=$("#todayWeek");if(weekEl){const w=week,{start}=weekRange(today()),letters=weekdayLetters();
    const trained=new Set(state.log.filter(r=>String(r.date)>=start&&String(r.date)<=today()).map(r=>String(r.date)));
    const cells=letters.map((lab,i)=>{const d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+i);
      const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const isToday=iso===today(),done=trained.has(iso);
      const mark=done?`<span class="week-letters__check">✓</span>`:`<span class="week-letters__dot${isToday?" is-today":""}"></span>`;
      return `<div><div class="week-letters__d">${esc(lab)}</div><div class="week-letters__m">${mark}</div></div>`}).join("");
    weekEl.innerHTML=`<div class="ov-week-line">${esc(t("today.sessions_done",{done:w.completedDays,planned:w.plannedDays}))}</div><div class="week-letters">${cells}</div>`}
  const up=$("#todayUpNext");if(up){const next=nextDayAfter(recap?recap.lastDay:day);
    if(next){const nEx=exercises(next).length;
      up.innerHTML=`<button type="button" class="listrow" id="upNextBtn"><div class="listrow__main"><div class="listrow__title">${esc(dayLabel(next))}</div>`+
        `<div class="listrow__sub">${esc(t("today.exercise_count",{n:nEx}))}</div></div><span class="chevron" aria-hidden="true"></span></button>`;
      $("#upNextBtn").onclick=()=>enterWorkout({day:next})}
    else up.innerHTML=`<p class="lede">${esc(t("today.no_up_next"))}</p>`}
  // The recap above already says today was trained; the footer would only echo it.
  const lastEl=$("#todayLast");if(lastEl&&recap)lastEl.innerHTML="";
  else if(lastEl){const dates=state.log.map(r=>String(r.date)).filter(Boolean).sort();
    if(dates.length){const lastD=dates.at(-1),n=Math.max(0,Math.round((new Date(`${today()}T12:00:00`)-new Date(`${lastD}T12:00:00`))/86400000));
      lastEl.innerHTML=`<span class="today-footer__icon" aria-hidden="true">⏱</span>${esc(n===0?t("today.last_trained_today"):n===1?t("today.last_trained_one"):t("today.last_trained",{n}))}`}
    else lastEl.innerHTML=""}
  const lc=$("#logContext");if(lc){const nm2=state.programMeta?.name,mc2=mesocycleWeek();
    const hasCtx=!!(nm2||mc2.current!=null||mc2.isComplete);
    lc.textContent=hasCtx?programWeekContext(nm2,mc2):t("log.context.today");
    // Kept as a hidden deep-link hook; Today shows the program strip instead.
    lc.classList.add("hidden")}
  // Program strip also jumps to Progress → Review (legacy #logContext affordance).
  const progClick=$("#todayProgram");if(progClick&&!progClick.classList.contains("hidden")){
    progClick.style.cursor="pointer";progClick.onclick=()=>{navTo("stats");setStatsSeg("review")}}
  const woTitle=$("#woDayTitle");if(woTitle)woTitle.textContent=dayLabel(day);
  const woSub=$("#woDaySub");if(woSub){const mc3=mesocycleWeek();
    woSub.textContent=mc3.isComplete?t("meso.complete"):mc3.current!=null?t("today.week_short",{n:mc3.current}):""}
}

function render(){applyI18n();
  // Auto-resume an in-progress session (page reload mid-workout), but never
  // override an explicit leave — otherwise every tab switch re-hides the nav.
  if(!workoutActive&&!workoutLeft&&draftHasProgress())workoutActive=true;
  setWorkoutActive(workoutActive);
  renderToday();renderTabs();renderWorkout();renderStats();renderHistory();renderProgram();renderSettings();renderBlockPrompt();
  updateSessionBanner();
  if(exView&&$("#exercise")?.classList.contains("active"))renderExerciseView()}

function renderTabs(){const ds=days();if(!ds.includes(day))day=ds[0]||"Day 1";
  $("#dayTabs").innerHTML=ds.map(d=>`<button type="button" role="tab" aria-selected="${d===day?"true":"false"}" class="${d===day?"active":""}" data-day="${esc(d)}">${esc(dayLabel(d))}</button>`).join("");
  $$("#dayTabs button").forEach(b=>b.onclick=()=>{if(!requestWorkoutDay(b.dataset.day))return;renderTabs();renderWorkout();renderToday()})}

function setFieldVals(ex,n,r,draft,prev){
  const old=prev.find(x=>x.set===n),draftKg=draft[`${ex.id}_${n}_load`],sg=setSuggestion(ex,n,r,draft,old);
  const kgVal=draftKg!=null?draftKg:(sg.load!=null?fmtLoadPlain(sg.load):(old&&old.load!=null?fmtLoadPlain(old.load):""));
  const repsVal=draft[`${ex.id}_${n}_reps`]??(sg.reps!=null?sg.reps:(old&&old.reps!=null?old.reps:ex.min));
  const key=`${ex.id}_${n}`,isW=warmups.has(key);
  const effortVal=draft[`${key}_effort`]||(old&&old.rir!=null?effortForRir(old.rir):"hard");
  const rirVal=draft[`${key}_rir`]??(old&&old.rir!=null?fmtPlain(old.rir):1);
  return{key,isW,kgVal,repsVal,rirVal,effortVal}}
function setRowHtml(ex,n,r,draft,prev,nextSet){
  const{key,isW,kgVal,repsVal,rirVal,effortVal}=setFieldVals(ex,n,r,draft,prev);
  const effortMode=isEffortMode();
  const cls=`${committed.has(key)?"is-done":(touched.has(key)?"":"is-suggested")}${isW?" is-warmup":""}${n===nextSet?" is-next":""}${effortMode?" has-effort":""}`;
  // Effort takes a line of its own under the numbers: three words never fit the
  // RIR column, and clipping the last of them hides the option that matters.
  const rirInput=effortMode?""
    :`<input data-k="${ex.id}_${n}_rir" type="text" inputmode="decimal" enterkeyhint="next" aria-label="${esc(t("log.set_rir_aria",{n}))}" value="${esc(rirVal)}">`;
  const effortLine=effortMode?effortControlHtml(key,n,effortVal,{confirmed:committed.has(key)||touched.has(key)}):"";
  return `<div class="setrow ${cls}" data-set="${esc(key)}"><button type="button" class="setrow__n" data-warm="${esc(key)}" aria-pressed="${isW?"true":"false"}" title="${esc(t("log.warmup_title"))}">${isW?"W":n}</button>`+
    `<div class="kg"><button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="-1" tabindex="-1" aria-label="${esc(t("log.set_decrease_aria",{n,unit:unitLabel()}))}">−</button>`+
    `<input data-k="${ex.id}_${n}_load" type="text" inputmode="decimal" enterkeyhint="next" aria-label="${esc(t("log.set_unit_aria",{n,unit:unitLabel()}))}" placeholder="${unitLabel()}" value="${esc(kgVal)}">`+
    `<button type="button" class="stepbtn" data-step="${ex.id}_${n}_load" data-dir="1" tabindex="-1" aria-label="${esc(t("log.set_increase_aria",{n,unit:unitLabel()}))}">+</button></div>`+
    `<input data-k="${ex.id}_${n}_reps" type="text" inputmode="numeric" enterkeyhint="next" aria-label="${esc(t("log.set_reps_aria",{n}))}" value="${esc(repsVal)}">`+
    rirInput+
    `<button type="button" class="saveset" data-save="${esc(key)}" aria-pressed="${committed.has(key)?"true":"false"}" aria-label="${esc(t("log.save_set_aria",{n}))}">`+
    `<span class="saveset__label">${esc(t("log.save_set"))}</span></button>`+
    effortLine+`</div>`}

/* ============================================================
   Focus mode
   One full-height card per exercise: a scrolling ledger of what has been
   logged on top, and an attached well underneath that never moves — the
   recommendation, the set being worked on, and the one action that commits it.
   ============================================================ */

/** What a control on a peek copy gets instead of its hooks: the same element,
 *  the same box, no action to fire and no place in the tab order. The peek card
 *  is `inert` as a whole, so this is belt and braces — but it also keeps the
 *  handlers in bindWorkout from ever seeing a neighbour's id. */
const dead=()=>` tabindex="-1"`;
/** Set numbers already committed on this exercise, in order. */
function focusDoneSets(ex){const out=[];
  for(let n=1;n<=ex.sets;n++)if(committed.has(`${ex.id}_${n}`))out.push(n);
  return out}
/** The set the well is working on: the one being edited, else the first unlogged. */
function focusActiveSet(ex){
  if(focusEdit&&focusEdit.exId===ex.id&&focusEdit.n>=1&&focusEdit.n<=ex.sets)return focusEdit.n;
  for(let n=1;n<=ex.sets;n++)if(!committed.has(`${ex.id}_${n}`))return n;
  return 0}
const focusExDone=ex=>focusActiveSet(ex)===0;
/** The load the next set is judged against: this session's last logged set,
 *  falling back to the matching set of the previous session. */
function focusRefLoad(ex,n,draft,prev){
  for(let m=n-1;m>=1;m--){
    if(!committed.has(`${ex.id}_${m}`))continue;
    const v=fromDisplay(draft[`${ex.id}_${m}_load`]);
    if(Number.isFinite(v)&&v>0)return v}
  const old=prev.find(x=>x.set===n)||prev.at(-1);
  return old&&old.load!=null?+old.load:null}
/** The one line above the inputs: what to do with this set, and why. */
function focusCue(ex,n,r,draft,prev,editing){
  if(editing)return{kind:"edit",label:t("focus.cue.editing"),text:t("focus.cue.editing_set",{n,total:ex.sets})};
  const sg=setSuggestion(ex,n,r,draft,prev.find(x=>x.set===n));
  if(sg.load==null)return{kind:"start",label:t("focus.cue.start"),text:t("focus.cue.pick_load",{min:ex.min,max:ex.max})};
  const ref=focusRefLoad(ex,n,draft,prev);
  const move=ref==null||sameLoad(sg.load,ref)?"hold":sg.load>ref?"up":"down";
  const reps=sg.reps!=null?sg.reps:ex.min;
  return{kind:"now",label:t("focus.cue.now"),
    text:`${t(`focus.cue.${move}`,{load:fmtLoad(sg.load),unit:unitLabel()})} · ${t("focus.cue.reps",{reps})}`}}

/** How a logged set reads back in the ledger. */
function focusRowVals(ex,n,r,draft,prev,effortMode){
  const{kgVal,repsVal,rirVal,effortVal}=setFieldVals(ex,n,r,draft,prev);
  const load=(()=>{const v=parseDec(kgVal);return Number.isFinite(v)?fmt(v):kgVal})();
  // A set logged as a word reads back as that word — never as the RIR it maps to.
  const eff=effortMode?effortLabel(effortVal)
    :(()=>{const v=parseDec(rirVal);return Number.isFinite(v)?fmt(v):rirVal})();
  return{load,reps:String(repsVal),eff}}

function focusLedgerRow(ex,n,vals,{effortMode,editing=false,peek=false,fresh=false}){
  const cells=`<span class="ledger__n">${n}</span><span class="ledger__load">${esc(vals.load)}</span><span>${esc(vals.reps)}</span>`+
    `<span class="${effortMode?"ledger__eff":""}">${esc(vals.eff)}</span>`+
    `<span class="ledger__check" aria-hidden="true"></span>`;
  return `<button type="button" class="ledger__row${editing?" is-editing":""}${fresh?" is-fresh":""}"${peek?dead()
    :` data-editex="${esc(ex.id)}" data-editn="${n}" aria-label="${esc(t("focus.edit_set_aria",{n}))}"`}`+
    `${editing?' aria-current="true"':""}>${cells}</button>`}

/** The upper ledger: last session before the first set lands, the session's own
 *  rows after that, with older rows folded away once the list gets long. */
function focusLedgerHtml(ex,r,draft,prev,{effortMode,peek=false}){
  const head=(check=true)=>`<div class="ledger__head"><span>${esc(t("log.set"))}</span><span>${loadHeadHtml()}</span>`+
    `<span>${esc(t("log.reps"))}</span><span>${effortMode?esc(t("log.effort")):"RIR"}</span>`+
    (check?`<span></span>`:"")+`</div>`;
  // What the columns mean, and how far the session has got, stay put while the
  // rows underneath them scroll.
  const top=inner=>`<div class="ledger__top">${inner}</div>`;
  const done=focusDoneSets(ex);
  if(!done.length){
    if(prev.length){
      const rows=prev.map(x=>{
        const eff=effortMode?effortLabel(effortForRir(x.rir)):fmt(x.rir);
        return `<div class="ledger__row is-past"><span class="ledger__n">${x.set}</span>`+
          `<span class="ledger__load">${esc(fmtLoad(x.load))}</span><span>${esc(String(x.reps))}</span>`+
          `<span class="${effortMode?"ledger__eff":""}">${esc(String(eff))}</span></div>`}).join("");
      return top(`<p class="ledger__lab">${esc(t("focus.last_session"))}</p>${head(false)}`)+rows}
    return top(head())+`<div class="ledger__row is-empty"><span class="ledger__empty">${esc(t("focus.ledger.empty"))}</span>`+
      `<span class="ledger__dash" aria-hidden="true">—</span><span></span></div>`}
  const editN=focusEdit&&focusEdit.exId===ex.id?focusEdit.n:0;
  // The set that just landed is drawn once as fresh, so it arrives instead of
  // appearing. Folding always keeps the newest rows, so it is never hidden.
  const freshN=focusIsFresh(ex,peek)?focusLogged.n:0;
  const open=focusUnfolded.has(ex.id);
  const folds=done.length>=FOCUS_FOLD_MIN&&!open;
  const hidden=folds?done.slice(0,done.length-FOCUS_FOLD_KEEP):[];
  const shown=folds?done.slice(done.length-FOCUS_FOLD_KEEP):done;
  const rowsFor=list=>list.map(n=>focusLedgerRow(ex,n,focusRowVals(ex,n,r,draft,prev,effortMode),
    {effortMode,editing:n===editN,peek,fresh:n===freshN})).join("");
  // A long session leads with a count and a run of ticks, so the sets that
  // scrolled behind the fold are still accounted for at a glance.
  const summary=done.length>=FOCUS_FOLD_MIN
    ?`<p class="ledger__count">${esc(t("focus.ledger.done_count",{n:done.length}))}</p>`+
      `<div class="ledger__ticks" aria-hidden="true">${done.map(n=>`<span class="ledger__tick${n===freshN?" is-fresh":""}"></span>`).join("")}</div>`
    :"";
  let disclosure="";
  if(done.length>=FOCUS_FOLD_MIN){
    const span=open?done.slice(0,done.length-FOCUS_FOLD_KEEP):hidden;
    const from=span[0],to=span.at(-1);
    disclosure=`<button type="button" class="ledger__more"${peek?dead()
      :` data-fold="${esc(ex.id)}" aria-controls="ledger_${esc(ex.id)}"`} aria-expanded="${open?"true":"false"}">`+
      `<span>${esc(t(open?"focus.ledger.hide":"focus.ledger.show",{from,to}))}</span>`+
      `<span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button>`}
  return top(summary+head())+`<div id="ledger_${esc(ex.id)}">${rowsFor(open?done:shown)}</div>`+disclosure}

/** One value cell of the well: label, big value, hairline, and its steppers.
 *  `extra` rides along out of flow — the effort explainer, which floats over
 *  the card rather than taking a caption slot below the steppers. */
function focusCell(label,inner,{accent=false,steps="",extra="",cls=""}={}){
  return `<div class="curset__cell${accent?" is-load is-active":""}${cls?` ${cls}`:""}">`+
    `<div class="curset__cell-lab${accent?" is-accent":""}">${label}</div>${inner}`+
    `<span class="curset__underline" aria-hidden="true"></span>`+
    (steps?`<div class="curset__steps">${steps}</div>`:"")+extra+`</div>`}
const stepBtn=(target,dir,label,attr="data-step",peek=false)=>
  `<button type="button" class="stepbtn"${peek?"":` ${attr}="${esc(target)}" data-dir="${dir}" aria-label="${esc(label)}"`} tabindex="-1">${dir>0?"+":"−"}</button>`;

/** The set being worked on — three columns of numbers (or two plus effort). */
function cursetHtml(ex,n,r,draft,prev,{peek=false}={}){
  const{key,kgVal,repsVal,rirVal,effortVal}=setFieldVals(ex,n,r,draft,prev);
  const effortMode=isEffortMode();
  const repsLab=esc(t("log.reps"));
  const unit=unitLabel();
  // The static copy shows a dash where the live field shows its placeholder.
  const val=(v,attrs,live=v)=>peek
    ?`<div class="curset__val curset__val--static">${esc(String(v))}</div>`
    :`<input class="curset__val" ${attrs} value="${esc(String(live))}">`;
  // The unit sits on the Load label so three-digit loads still fit the figure.
  const loadCell=focusCell(loadHeadHtml(),
    val(kgVal||"—",`data-k="${ex.id}_${n}_load" size="4" type="text" inputmode="decimal" enterkeyhint="next" placeholder="—" aria-label="${esc(t("log.set_unit_aria",{n,unit}))}"`,kgVal),
    {accent:true,steps:stepBtn(`${ex.id}_${n}_load`,-1,t("log.set_decrease_aria",{n,unit}),"data-step",peek)+stepBtn(`${ex.id}_${n}_load`,1,t("log.set_increase_aria",{n,unit}),"data-step",peek)});
  const repsCell=focusCell(repsLab,
    val(repsVal,`data-k="${ex.id}_${n}_reps" type="text" inputmode="numeric" enterkeyhint="next" aria-label="${esc(t("log.set_reps_aria",{n}))}"`),
    {steps:stepBtn(`${ex.id}_${n}_reps`,-1,t("log.set_decrease_aria",{n,unit:repsLab}),"data-step",peek)+stepBtn(`${ex.id}_${n}_reps`,1,t("log.set_increase_aria",{n,unit:repsLab}),"data-step",peek)});
  // Effort is a word, so its column is a spinner over the three steps rather
  // than a free number — same geometry as RIR, same two nudge buttons.
  const effCell=(()=>{
    const i=Math.max(0,EFFORT_STEPS.indexOf(effortVal));
    const body=peek
      ?`<div class="curset__val curset__val--static curset__val--word">${esc(effortLabel(effortVal))}</div>`
      :`<div class="curset__val curset__val--word" role="spinbutton" tabindex="0" data-effspin="${esc(key)}" data-e="${esc(effortVal)}"`+
        ` aria-label="${esc(t("log.set_effort_aria",{n}))}" aria-describedby="effpop_${esc(key)}"`+
        ` aria-valuemin="1" aria-valuemax="${EFFORT_STEPS.length}"`+
        ` aria-valuenow="${i+1}" aria-valuetext="${esc(effortLabel(effortVal))}">${esc(effortLabel(effortVal))}</div>`;
    return focusCell(esc(t("log.effort")),body,{cls:"is-effort",extra:peek?"":effortPopHtml(key,effortVal),
      steps:stepBtn(key,-1,t("focus.effort_down_aria"),"data-effstep",peek)+stepBtn(key,1,t("focus.effort_up_aria"),"data-effstep",peek)})})();
  const rirCell=focusCell("RIR",
    val(rirVal,`data-k="${ex.id}_${n}_rir" type="text" inputmode="decimal" enterkeyhint="done" aria-label="${esc(t("log.set_rir_aria",{n}))}"`),
    {steps:stepBtn(`${ex.id}_${n}_rir`,-1,t("log.set_decrease_aria",{n,unit:"RIR"}),"data-step",peek)+stepBtn(`${ex.id}_${n}_rir`,1,t("log.set_increase_aria",{n,unit:"RIR"}),"data-step",peek)});
  return `<div class="curset" data-set="${esc(key)}"><div class="curset__grid">`+
    loadCell+repsCell+(effortMode?effCell:rirCell)+`</div></div>`}

/** The attached lower area: cue, inputs and the single action that commits. */
function focusWellHtml(ex,r,draft,prev,{allDone,hasNext,peek=false}){
  const n=focusActiveSet(ex);
  const editing=!!(focusEdit&&focusEdit.exId===ex.id&&n);
  // The well re-arms on the set that just landed: the cue and the numbers of
  // the next set settle in, or — on the last set — the completion mark does.
  const fresh=focusIsFresh(ex,peek)?" is-fresh":"";
  if(!n){
    const done=focusDoneSets(ex).length;
    const title=allDone?t("focus.wo_done_title"):t("focus.ex_done_title");
    const sub=allDone
      ?t("focus.wo_done_sub",{n:focusList().length,lifts:tp(focusList().length,"lift")})
      :t("focus.ex_done_sets",{n:done,sets:tp(done,"logged set")});
    const cta=allDone||!hasNext
      ?`<button type="button" class="btn btn--cta btn--noarrow"${peek?dead():" data-ffinish"}>${esc(t("log.finish"))}</button>`
      :`<button type="button" class="btn btn--cta"${peek?dead():" data-fnext"}>${esc(t("focus.next_ex"))}</button>`;
    return `<div class="focus-well is-done${fresh}">`+
      `<div class="focus-done"><span class="focus-done__mark" aria-hidden="true"></span>`+
      `<div class="focus-done__text"><p class="focus-done__title">${esc(title)}</p>`+
      `<p class="focus-done__sub">${esc(sub)}</p></div></div>`+
      cta+`</div>`}
  const cue=focusCue(ex,n,r,draft,prev,editing);
  const key=`${ex.id}_${n}`;
  const commit=(label)=>`<button type="button" class="btn btn--cta btn--noarrow saveset"${peek?dead():` data-save="${esc(key)}"`}>${esc(label)}</button>`;
  const action=editing
    ?`<button type="button" class="focus-well__cancel"${peek?dead():" data-fcancel"}>${esc(t("focus.cancel_edit"))}</button>`+
      commit(t("focus.save_edit"))
    :commit(t("today.log_set"));
  return `<div class="focus-well${editing?" is-editing":""}${fresh}">`+
    `<p class="focus-cue is-${cue.kind}"><span class="focus-cue__bolt" aria-hidden="true"></span>`+
    `<b class="focus-cue__lab">${esc(cue.label)}</b><span class="focus-cue__sep" aria-hidden="true">·</span>`+
    `<span class="focus-cue__text">${esc(cue.text)}</span></p>`+
    cursetHtml(ex,n,r,draft,prev,{peek})+action+`</div>`}

/** A whole focus card. `peek` renders the inert copy that rides in from the
 *  side during a swipe: the same card, down to every control and the space it
 *  takes, so nothing pops in or reflows when the copy becomes the live one.
 *  What a peek does not carry is behaviour — its controls hold no hooks and no
 *  tab stop — and no `data-k` field, which would duplicate the draft keys the
 *  live card owns. */
function focusCardHtml(ex,r,draft,prev,opts){
  const{peek=false,hasNext=true,allDone=false,showSkip=true}=opts;
  const effortMode=isEffortMode();
  const n=focusActiveSet(ex);
  const perf=substituted.get(ex.id);
  const name=perf||ex.name;
  const nameHtml=`<h3 class="focus-ex__name"><button type="button" class="ex__name ex__namebtn"`+
    `${peek?dead():` data-exopen="${esc(ex.id)}" aria-label="${esc(t("log.open_exercise_aria",{name}))}"`}>${esc(name)}</button></h3>`;
  const setNo=n||ex.sets;
  // The counter only ticks when it actually moved: the last set of an exercise
  // leaves it on the total it already read.
  const setofFresh=n&&focusIsFresh(ex,peek)?" is-fresh":"";
  const noteVal=draft.__exnotes?.[ex.id]??lastExerciseNote(ex);
  const tools=`<div class="focus-ex__tools">`+
    `<button type="button" class="focus-tool${noteVal?" has-note":""}"`+
    `${peek?dead():` data-exnote-open="${esc(ex.id)}" aria-label="${esc(t("focus.note_aria",{name}))}"`}>`+
    `<span class="icon-mask icon-mask--sm icon-mask--note" aria-hidden="true"></span></button>`+
    (showSkip?`<button type="button" class="focus-tool ex__skip"`+
      `${peek?dead():` data-skip="${esc(ex.id)}" aria-label="${esc(t("log.skip_aria",{name}))}"`}>`+
      `<span class="icon-mask icon-mask--sm icon-mask--skip" aria-hidden="true"></span></button>`:"")+
    `</div>`;
  // Every set that is not in the well still needs a field to hold its value:
  // the draft is read back off the DOM. Inert keeps them out of the tab order.
  const carriers=peek?"":`<div class="focus-inputs" inert aria-hidden="true">`+
    Array.from({length:ex.sets},(_,i)=>i+1).filter(m=>m!==n)
      .map(m=>setRowHtml(ex,m,r,draft,prev,0)).join("")+
    `<textarea class="exnote__input" id="exnote_${esc(ex.id)}" data-exnote="${esc(ex.id)}" tabindex="-1">${esc(noteVal)}</textarea></div>`;
  return `<article class="exercise exercise--focus is-${r.status}${peek?" is-peek":" is-current"}"`+
    (peek?` aria-hidden="true" inert data-peek="${esc(ex.id)}"`:` data-ex="${esc(ex.id)}"`)+`>`+
    `<div class="fcard__head"><div class="focus-ex__eyebrow">`+
    `<span class="focus-ex__muscle">${esc(muscleListLabel(ex.primary))}</span>`+
    `<span class="focus-ex__setof${setofFresh}">${esc(t("focus.set_of",{x:" ",y:ex.sets})).replace(" ",`<b>${setNo}</b>`)}</span></div>`+
    `<div class="focus-ex__title"><div class="focus-ex__titletext">${nameHtml}`+
    `<p class="focus-ex__target"><span class="focus-ex__alvo">${esc(t("today.target_label"))}</span>${esc(targetText(ex))}</p>`+
    (r.status!=="new"?`<button type="button" class="text-link focus-ex__why"`+
      `${peek?dead():` data-why="${esc(ex.id)}" aria-label="${esc(t("why.open_aria",{name}))}"`}>${esc(t("why.open"))}</button>`:"")+
    `</div>${tools}</div></div>`+
    `<div class="fcard__ledger">${focusLedgerHtml(ex,r,draft,prev,{effortMode,peek})}</div>`+
    focusWellHtml(ex,r,draft,prev,{allDone,hasNext,peek})+
    carriers+`</article>`}

/** The deck: the live card plus an inert copy of each neighbour, parked off
 *  screen in its own slot. Dragging — or tapping through — moves all three
 *  together, the way a paged view does. */
function focusDeckHtml(ex,r,draft,prev,{fl,at}){
  const allDone=fl.every(e=>{for(let n=1;n<=e.sets;n++)if(!committed.has(`${e.id}_${n}`))return false;return true});
  const slot=(inner,side)=>`<div class="deck__slot${side?` deck__slot--${side}`:""}"${side?' aria-hidden="true"':""}>${inner}</div>`;
  // A neighbour is rendered exactly as it will be once it lands: same well,
  // same tools, same skip — the swipe is a move, not a rebuild.
  const peek=(i,side)=>fl[i]
    ? (()=>{const active=sessionExercise(fl[i]);return slot(focusCardHtml(active,recommendation(active),draft,last(active),
        {peek:true,hasNext:i<fl.length-1,allDone,showSkip:i<fl.length-1}),side)
      })()
    : "";
  return `<div class="deck" id="focusDeck" role="group" aria-roledescription="carousel" aria-label="${esc(t("focus.deck_aria"))}"><div class="deck__track" id="focusTrack">`+
    peek(at-1,"prev")+
    slot(focusCardHtml(ex,r,draft,prev,{hasNext:at<fl.length-1,allDone,showSkip:at<fl.length-1}))+
    peek(at+1,"next")+
    `</div></div>`}
function renderWorkout(){
  if(!workoutActive){focusLogged=null;updateGauge();updateSessionBanner();return}
  const lc=$("#logContext");if(lc){const nm=state.programMeta?.name,mc=mesocycleWeek();
    lc.textContent=nm||mc.current!=null||mc.isComplete?programWeekContext(nm,mc):t("log.context.today")}
  const draft=hydrateWorkoutDraft();
  const effortMode=isEffortMode();
  const restOn=+state.settings.restSec>0;
  const hiddenCount=exercises().filter(e=>skipped.has(e.id)).length;
  const banner=hiddenCount?`<div class="skipbar">${esc(t("log.skipbar",{n:hiddenCount}))} <button type="button" class="skipbar__show">${esc(t("log.skipbar.show_all"))}</button></div>`:"";
  const fl=focusList();
  if(logMode==="focus"&&fl.length)focusIndex=Math.min(focusIndex,fl.length-1);
  const curId=logMode==="focus"&&fl.length?fl[focusIndex]?.id:null;
  const at=logMode==="focus"&&fl.length?Math.min(focusIndex,fl.length-1):0;
  const wk=$("#workout");if(!wk){focusLogged=null;return}wk.classList.toggle("is-focus",logMode==="focus");
  wk.innerHTML=banner+exercises().map(slotEx=>{const ex=sessionExercise(slotEx);
    const r=recommendation(ex),prev=last(ex);
    // Focus renders the current exercise as its own full-height card; the rest
    // stay as (hidden) List markup, which is what carries their draft fields.
    if(logMode==="focus"&&ex.id===curId)return focusDeckHtml(ex,r,draft,prev,{fl,at});
    const prevHtml=prev.length?`<div class="prev"><span>${esc(t("log.prev"))}</span>${prev.map(x=>`${fmtLoad(x.load)}×${x.reps}<small>${esc(effortOrRirLabel(x.rir))}</small>`).join(" ")}<button type="button" class="copylast" data-copy="${esc(ex.id)}">${esc(t("log.copy_last"))}</button></div>`:"";
    const deltaHtml=(()=>{const txt=deltaPreviewFor(ex,draft);return txt?`<div class="delta-prev">${esc(txt)}</div>`:""})();
    const blockHtml=r.blockNote?`<p class="rec__block">${esc(r.blockNote)}</p>`:"";
    const sessNote=inSessionNote(ex,draft),sessHtml=sessNote?`<div class="insession">${esc(sessNote)}</div>`:"";
    let nextSet=0;for(let n=1;n<=ex.sets;n++){if(!committed.has(`${ex.id}_${n}`)){nextSet=n;break}}
    const rows=Array.from({length:ex.sets},(_,i)=>setRowHtml(ex,i+1,r,draft,prev,nextSet)).join("");
    const isSkipped=skipped.has(ex.id),perf=substituted.get(ex.id),display=perf||ex.name;
    // The heading is the movement being performed and nothing else. Which slot
    // it stands in is a second thought, and gets its own full-width line down
    // beside the substitute control rather than wrapping the title into a
    // four-line paragraph on a phone.
    const nameLabel=esc(perf||ex.name);
    const statusHtml=isSkipped?`<span class="ex__state">${esc(t("log.skipped"))}</span>`:"";
    const openAria=t("log.open_exercise_aria",{name:display})+(isSkipped?` · ${t("log.skipped")}`:"");
    const nameHtml=`<button type="button" class="ex__name ex__namebtn" data-exopen="${esc(ex.id)}" aria-label="${esc(openAria)}">${nameLabel}${statusHtml}</button>`;
    const skipLabel=isSkipped?t("log.restore"):t("log.skip");
    const skipAria=isSkipped?t("log.restore_aria",{name:display}):t("log.skip_aria",{name:display});
    const noteVal=draft.__exnotes?.[ex.id]??lastExerciseNote(ex);
    const notePreview=noteVal?esc(noteVal):esc(t("log.note.empty"));
    const noteHtml=`<div class="exnote${noteVal?" has-note":""}">`+
      `<button type="button" class="exnote__toggle" data-exnote-toggle="${esc(ex.id)}" aria-expanded="false" aria-controls="exnote_${esc(ex.id)}">`+
      `<span class="exnote__lab">${esc(t("log.note"))}</span><span class="exnote__preview">${notePreview}</span></button>`+
      `<textarea class="exnote__input hidden" id="exnote_${esc(ex.id)}" data-exnote="${esc(ex.id)}" rows="2" `+
      `placeholder="${esc(t("log.note.placeholder"))}" aria-label="${esc(t("log.note_aria",{name:ex.name}))}">${esc(noteVal)}</textarea></div>`;
    // Every slot can be swapped now, not just the ones that happen to carry
    // alternates: the machine being taken does not check the program first.
    // The field says what it holds, and its own label names the job for a
    // screen reader, so a printed "USE:" beside it was a caption on a caption.
    const subPick=`<div class="subst${perf?" is-swapped":""}"><span class="subst__lab visually-hidden">${esc(t("log.substitute.label"))}</span>`+
      `<button type="button" class="subst__pick${perf?" is-swapped":""}" data-sub="${esc(ex.id)}" aria-label="${esc(t("log.substitute.aria",{name:slotEx.name}))}">${esc(perf||ex.name)}</button>`+
      (perf?`<p class="subst__from">${esc(t("log.substitute_for",{name:slotEx.name}))}</p>`:"")+
      `</div>`;
    const recHead=r.load!=null?t("today.rec_keep",{load:fmtLoad(r.load),unit:unitLabel()}):r.label;
    const recBlock=`<div class="recblock is-${r.status}"><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
      `<div class="recblock__head">${esc(recHead)}</div><p class="recblock__body">${esc(r.text)}</p>${blockHtml}`+
      (r.status!=="new"?`<button type="button" class="text-link recblock__why" data-why="${esc(ex.id)}" aria-label="${esc(t("why.open_aria",{name:ex.name}))}">${esc(t("why.open"))}</button>`:"")+
      `</div>`;
    const listHead=`<div class="ex__top"><div class="ex__head"><h3 class="ex__nameh">${nameHtml}</h3>`+
      `<p class="ex__meta"><span class="ex__tag">${esc(muscleListLabel(ex.primary))}</span><span class="nowrap">${ex.sets}×${ex.min}-${ex.max} reps</span> · `+
      `<span class="nowrap">${effortMode?term(EFFORT_TERM[targetEffort()]):`${term("RIR")} 0-${fmt(state.settings.rirHigh)}`}</span></p></div>`+
      `<div class="ex__topend">`+
      (restOn?`<button type="button" class="ex__rest" data-rest="1" aria-label="${esc(t("log.rest_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--timer" aria-hidden="true"></span></button>`:"")+
      `<button type="button" class="ex__skip" data-skip="${esc(ex.id)}" aria-label="${esc(skipAria)}">${esc(skipLabel)}</button>`+
      `<button type="button" class="ex__caret" data-collapse="${esc(ex.id)}" aria-label="${esc(t("log.toggle_sets_aria",{name:ex.name}))}"><span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button></div></div>`;
    return `<article class="exercise is-${r.status}${collapsed.has(ex.id)?" is-collapsed":""}${isSkipped?" is-skipped":""}" data-ex="${esc(ex.id)}">`+
      listHead+
      `<div class="heat"><span class="heat__track"><span class="heat__fill" style="width:${Math.round(r.heat*100)}%"></span></span>`+
      `<span class="chip">${esc(r.label)}</span></div>`+
      recBlock+
      (ex.notes?`<p class="setup"><span>${esc(t("log.setup"))}</span>${esc(ex.notes)}</p>`:"")+
      subPick+
      prevHtml+deltaHtml+sessHtml+
      `<div class="sets__head${effortMode?" has-effort":""}"><span>${esc(t("log.set"))}</span><span>${loadHeadHtml()}</span><span>${esc(t("log.reps"))}</span>`+
      (effortMode?"":`<span>${term("RIR")}</span>`)+
      `<span class="sets__head-save" aria-hidden="true">${esc(t("log.save_set"))}</span>`+
      // In effort mode the picker sits on its own line, so its heading does too.
      (effortMode?`<span class="sets__head-eff">${term("Effort")}</span>`:"")+
      `</div>${rows}`+
      noteHtml+
      `</article>`;
  }).join("");
  // The landing animation belongs to this render alone: the markup that plays
  // it has been written, so the next render draws the same card at rest.
  focusLogged=null;
  bindWorkout();
  updateGauge();updateSaveMeta();renderFatigue();
  updateBodyweightField();
  updateSessionBanner();
  updateFocusChrome();
  sizeFocusDeck();
}
/** After a render, bring every card in the deck to the row that matters — the
 *  peeks included, so a neighbour rides in already showing what it will show
 *  once it lands. The card's own height comes from the layout, so nothing is
 *  measured into a stale number. */
function sizeFocusDeck(){
  const cards=$$("#focusDeck .exercise--focus");
  if(cards.length)cards.forEach(sizeFocusCard);
  else sizeFocusCard(focusCard())}
function sizeFocusCard(card){
  if(!card)return;
  const ledger=card.querySelector(".fcard__ledger");if(!ledger)return;
  const scrolls=ledger.scrollHeight>ledger.clientHeight+1;
  ledger.classList.toggle("is-scrollable",scrolls);
  // The newest logged row is the one worth showing; before the first set lands
  // the top of the ledger is where last session reads from.
  if(!scrolls)return;
  const rows=ledger.querySelectorAll(".ledger__row:not(.is-past)");
  const anchor=ledger.querySelector(".ledger__row.is-editing")
    ||(rows.length?ledger.lastElementChild:null);
  if(!anchor){ledger.scrollTop=0;return}
  const gap=anchor.getBoundingClientRect().bottom-ledger.getBoundingClientRect().bottom;
  if(gap>0||anchor.getBoundingClientRect().top<ledger.getBoundingClientRect().top)
    ledger.scrollTop=Math.max(0,ledger.scrollTop+gap+8)}

// Keep the "next set up" marker on the first unsaved row of an exercise card.
function updateNextMarker(art){if(!art)return;let found=false;
  art.querySelectorAll(".setrow").forEach(r=>{const on=!found&&!r.classList.contains("is-done");if(on)found=true;
    r.classList.toggle("is-next",on)})}
function refreshAfterCommittedEdit(row){
  if(!row?.dataset.set||!committed.has(row.dataset.set))return;
  const exId=row.closest(".exercise")?.dataset.ex;
  if(exId)refreshSuggestions(exId)}

function updateExerciseDeltaPreview(exId){const art=$(`#workout [data-ex="${exId}"]`);if(!art)return;
  const ex=sessionExercise(prog.find(exId));if(!ex)return;const text=deltaPreviewFor(ex,loadDraft()),el=art.querySelector(".delta-prev");
  if(!text){el?.remove();return}
  if(el)el.textContent=text;else{const n=document.createElement("div");n.className="delta-prev";n.textContent=text;
    const anchor=art.querySelector(".prev")||art.querySelector(".sets__head");
    if(anchor)anchor.insertAdjacentElement(anchor.classList.contains("sets__head")?"beforebegin":"afterend",n)}}

// Latest note the lifter left on this exercise, so machine setup carries into the next session.
function lastExerciseNote(ex){const match=matchLift(ex);
  const rows=state.log.filter(r=>match(r)&&String(r.exNote||"").trim());
  if(!rows.length)return"";
  const latest=rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created))).at(-1);
  return String(latest.exNote).trim()}
function currentExerciseNote(exId){const el=$(`[data-exnote="${exId}"]`);
  if(el)return el.value.trim();
  const d=loadDraft().__exnotes||{};return String(d[exId]??"").trim()}

function saveDraft(opts){
  const fromDom=opts?.fromDom!==false;
  const prev=loadDraft(),d={...prev};
  const inputs=fromDom?$$("#workout input[data-k]"):[];
  if(inputs.length){
    for(const k of Object.keys(d)){
      if(k.startsWith("__"))continue;
      if(/_(load|reps|rir|effort)$/.test(k)) delete d[k]}
    inputs.forEach(x=>{if(x.dataset.k)d[x.dataset.k]=x.value});
    $$("#workout .effort__btn.active").forEach(b=>d[`${b.dataset.eff}_effort`]=b.dataset.e);
    $$("#workout [data-effspin]").forEach(e=>d[`${e.dataset.effspin}_effort`]=e.dataset.e);
    const notes={};$$("#workout [data-exnote]").forEach(t=>notes[t.dataset.exnote]=t.value);
    if(Object.keys(notes).length)d.__exnotes=notes;
    else if(prev.__exnotes)d.__exnotes=prev.__exnotes}
  d.__done=[...committed];d.__touched=[...touched];d.__warm=[...warmups];
  d.__skipped=[...skipped];d.__substituted=Object.fromEntries(substituted);
  d.__substitutedRef=Object.fromEntries(substitutedRef);
  if(lastCommitAt&&committed.size)d.__lastCommitAt=lastCommitAt;
  else delete d.__lastCommitAt;
  if(sessionStartedAt&&committed.size)d.__startedAt=sessionStartedAt;
  else delete d.__startedAt;
  const hasWork=committed.size||touched.size||warmups.size||skipped.size||substituted.size
    ||contextTouched.day||contextTouched.date||contextTouched.sessionNotes||contextTouched.bodyweight
    ||d.__done.length||d.__touched.length||d.__warm.length||d.__skipped.length||Object.keys(d.__substituted).length;
  if(hasWork) d.__day=day;
  const dateEl=$("#date"),notesEl=$("#notes"),bwEl=$("#bodyweight");
  if(contextTouched.date||Object.prototype.hasOwnProperty.call(d,"__date")||(hasWork&&(committed.size||touched.size||warmups.size||skipped.size||substituted.size))){
    if(dateEl) d.__date=dateEl.value}
  if(contextTouched.sessionNotes||Object.prototype.hasOwnProperty.call(d,"__sessionNotes")){
    if(notesEl) d.__sessionNotes=notesEl.value}
  if(contextTouched.bodyweight||Object.prototype.hasOwnProperty.call(d,"__bodyweight")){
    if(bwEl) d.__bodyweight=bwEl.value}
  d.__contextTouched={day:!!contextTouched.day,date:!!contextTouched.date,sessionNotes:!!contextTouched.sessionNotes,bodyweight:!!contextTouched.bodyweight};
  DraftStore.write(JSON.stringify(d))}

function clearFieldInvalid(root){
  (root||document).querySelectorAll("[aria-invalid='true']").forEach(el=>el.removeAttribute("aria-invalid"))}
function applyFieldError(res){
  if(!res||res.ok)return false;
  const el=res.el;
  if(el){el.setAttribute("aria-invalid","true");try{el.focus()}catch{}}
  toast(t(res.error?.key||"validation.load"));
  return true}
function workoutCandidateKeys(){
  const keys=[];
  for(const ex of exercises()){if(skipped.has(ex.id))continue;
    for(let n=1;n<=ex.sets;n++){const key=`${ex.id}_${n}`;
      if(committed.has(key)||touched.has(key)||warmups.has(key))keys.push(key)}}
  return keys}
function readSetCandidate(key){
  const loadEl=$(`[data-k="${key}_load"]`),repsEl=$(`[data-k="${key}_reps"]`),rirEl=$(`[data-k="${key}_rir"]`);
  const loadP=parseLoadDisplay(loadEl?.value);if(loadP.field)return{ok:false,error:loadP,el:loadEl};
  const repsP=parseRepsValue(repsEl?.value);if(repsP.field)return{ok:false,error:repsP,el:repsEl};
  let rir;
  if(isEffortMode()){
    const draft=loadDraft();
    const eff=draft[`${key}_effort`]||$(`.effort__btn.active[data-eff="${key}"]`)?.dataset.e||$(`[data-effspin="${key}"]`)?.dataset.e||"hard";
    const ep=parseEffortValue(eff);
    if(ep.field)return{ok:false,error:ep,el:$(`.effort__btn[data-eff="${key}"]`)||$(`[data-effspin="${key}"]`)};
    rir=EFFORT_RIR[ep.value]}
  else{const rirP=parseRirValue(rirEl?.value);if(rirP.field)return{ok:false,error:rirP,el:rirEl};rir=rirP.value}
  return{ok:true,values:{load:loadP.value,reps:repsP.value,rir}}}
function firstWorkoutValidationError(keys){
  clearFieldInvalid(document);
  const dateEl=$("#date"),dateP=parseCalendarDate(dateEl?.value);
  if(dateP.field)return{ok:false,error:dateP,el:dateEl};
  for(const key of keys){const r=readSetCandidate(key);if(!r.ok)return r}
  const bwEl=$("#bodyweight"),bwP=parseOptionalBodyweightDisplay(bwEl?.value);
  if(bwP.field)return{ok:false,error:bwP,el:bwEl};
  return{ok:true,values:{date:dateP.value,bodyweight:bwP.value===0?0:fromDisplay(bwEl.value)}}}

/** Controls of the live workout. The deck also holds a full copy of each
 *  neighbouring card, so every focus control exists three times over; only the
 *  live one takes a handler. */
const $w=sel=>$$(`#workout ${sel}`).filter(el=>!el.closest(".is-peek"));
function bindWorkout(){
  $w("input").forEach(i=>{i.oninput=()=>{const row=i.closest(".setrow, .curset");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta();
    const m=i.dataset.k?.match(/^(.+)_\d+_/);if(m)updateExerciseDeltaPreview(m[1]);
    refreshAfterCommittedEdit(row)};
  i.onfocus=()=>i.select()});
  $w(".term").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
  $w("[data-why]").forEach(b=>b.onclick=e=>{e.stopPropagation();openWhySheet(b.dataset.why,b)});
  $w(".saveset").forEach(b=>b.onclick=()=>{const key=b.dataset.save;
    if(applyFieldError(firstWorkoutValidationError([key])))return;
    const row=b.closest(".setrow, .curset");
    // Saving an edit updates the set that is already there; it never toggles it
    // off, and it never re-arms the rest clock for a set that finished long ago.
    const editing=!!(focusEdit&&`${focusEdit.exId}_${focusEdit.n}`===key);
    if(editing){touched.add(key)}
    else if(committed.has(key)){committed.delete(key)}
    else{committed.add(key);touched.add(key)}
    if(row){row.classList.toggle("is-done",committed.has(key));row.classList.remove("is-suggested");
      if(row.classList.contains("setrow"))b.setAttribute("aria-pressed",committed.has(key)?"true":"false");
      updateNextMarker(row.closest(".exercise"))}
    if(committed.has(key)&&!editing){lastCommitAt=Date.now();if(!sessionStartedAt)sessionStartedAt=lastCommitAt}
    if(editing)focusEdit=null;
    saveDraft();updateSaveMeta();
    const exId=b.closest(".exercise")?.dataset.ex;if(exId)refreshSuggestions(exId);
    // A set landing is the one beat of Focus worth marking. The exercise id can
    // hold underscores, so the set number comes off the end of the key by
    // length rather than by splitting it.
    if(logMode==="focus"&&exId&&committed.has(key)&&!editing)
      focusLogged={exId,n:+key.slice(exId.length+1)};
    if(committed.has(key)&&!editing){startRest();armUnfinishedWatch()}
    if(editing)toast(t("toast.set_updated"));
    if(logMode==="focus")renderWorkout();
    else updateFocusChrome()});
  $w("[data-warm]").forEach(b=>b.onclick=()=>{const key=b.dataset.warm;
    warmups.has(key)?warmups.delete(key):warmups.add(key);saveDraft();renderWorkout()});
  $w(".stepbtn").forEach(b=>b.onclick=()=>{if(!b.dataset.step)return;
    const inp=$(`[data-k="${b.dataset.step}"]`);if(!inp)return;
    const key=b.dataset.step||"",dir=+b.dataset.dir||0;
    if(/_reps$|_rir$/.test(key)){
      const cur=parseDec(inp.value)||0;inp.value=fmtPlain(Math.max(0,cur+dir));
    }else{
      const incKg=parseDec(state.settings.minJump)||2.5,curKg=fromDisplay(inp.value||0),
        nextKg=Math.max(0,Math.round((curKg+incKg*dir)/incKg)*incKg);
      inp.value=fmtPlain(toDisplay(nextKg));
    }
    const row=inp.closest(".setrow, .curset");
    if(row&&row.dataset.set){touched.add(row.dataset.set);row.classList.remove("is-suggested")}
    saveDraft();updateSaveMeta();refreshAfterCommittedEdit(row)});
  $w(".copylast").forEach(b=>b.onclick=()=>{const ex=sessionExercise(prog.find(b.dataset.copy)),prevSets=ex?last(ex):[];if(!prevSets.length)return;
    for(const s of prevSets){const key=`${b.dataset.copy}_${s.set}`;touched.add(key);
      for(const f of ["load","reps"]){const inp=$(`[data-k="${key}_${f}"]`);if(inp)inp.value=f==="load"?fmtPlain(toDisplay(s.load)):fmtPlain(s[f])}
      // The pickers carry the copied effort: saveDraft reads the DOM back, so
      // writing the draft alone would be overwritten by the stale selection.
      if(isEffortMode())setEffortPick(key,effortForRir(s.rir));
      else{const inp=$(`[data-k="${key}_rir"]`);if(inp)inp.value=fmtPlain(s.rir)}}
    saveDraft();renderWorkout();toast(t("toast.filled_from_last"))});
  $w(".ex__rest").forEach(b=>b.onclick=()=>startRest());
  $w(".ex__skip").forEach(b=>b.onclick=()=>applySkipToggle(b.dataset.skip));
  $w(".subst__pick").forEach(b=>b.onclick=()=>openSubstitutePicker(b.dataset.sub));
  $w(".effort__btn").forEach(b=>{
    b.onclick=()=>{const key=b.dataset.eff;
      setEffortPick(key,b.dataset.e);touched.add(key);
      const row=b.closest(".setrow, .curset");if(row)row.classList.remove("is-suggested");
      saveDraft();updateSaveMeta();refreshAfterCommittedEdit(row)};
    // Arrow keys walk the picker like the single-choice control it is.
    b.onkeydown=e=>{const step=e.key==="ArrowRight"||e.key==="ArrowDown"?1:e.key==="ArrowLeft"||e.key==="ArrowUp"?-1:0;
      const jump=e.key==="Home"?0:e.key==="End"?EFFORT_STEPS.length-1:null;
      if(!step&&jump==null)return;
      e.preventDefault();
      const i=EFFORT_STEPS.indexOf(b.dataset.e);
      const next=jump!=null?jump:(i+step+EFFORT_STEPS.length)%EFFORT_STEPS.length;
      b.closest(".effort")?.querySelectorAll(".effort__btn")[next]?.click();
      b.closest(".effort")?.querySelectorAll(".effort__btn")[next]?.focus()}});
  const stepEffort=(key,dir)=>{
    const el=$(`[data-effspin="${key}"]`);if(!el)return;
    const i=Math.max(0,EFFORT_STEPS.indexOf(el.dataset.e));
    const next=EFFORT_STEPS[Math.min(EFFORT_STEPS.length-1,Math.max(0,i+dir))];
    if(next===el.dataset.e)return;
    setEffortPick(key,next);touched.add(key);
    saveDraft();updateSaveMeta();refreshAfterCommittedEdit(el.closest(".curset"))};
  $w("[data-effstep]").forEach(b=>b.onclick=()=>stepEffort(b.dataset.effstep,+b.dataset.dir||0));
  $w("[data-effspin]").forEach(el=>{
    // Tapping the word asks what it means; the ± buttons beside it change it.
    el.onclick=()=>toggleEffortPop(el.dataset.effspin);
    el.onkeydown=e=>{
      if(e.key==="Enter"||e.key===" "||e.key==="Spacebar"){e.preventDefault();toggleEffortPop(el.dataset.effspin);return}
      if(e.key==="Escape"){closeEffortPop();return}
      const step=e.key==="ArrowUp"||e.key==="ArrowRight"?1:e.key==="ArrowDown"||e.key==="ArrowLeft"?-1:0;
      const jump=e.key==="Home"?-EFFORT_STEPS.length:e.key==="End"?EFFORT_STEPS.length:null;
      if(!step&&jump==null)return;
      e.preventDefault();stepEffort(el.dataset.effspin,jump??step)}});
  $w("[data-exnote-toggle]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.exnoteToggle;let wrap=b.closest(".exnote");
    if(!wrap&&id)wrap=$(`#workout [data-ex="${id}"] .exnote`);
    const ta=wrap?.querySelector(".exnote__input");if(!ta)return;
    const open=ta.classList.toggle("hidden")===false;b.setAttribute("aria-expanded",open?"true":"false");
    wrap.classList.toggle("is-open",open);
    if(open){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}});
  $w(".exnote__input").forEach(t=>{t.oninput=()=>{saveDraft();
    const prev=t.closest(".exnote")?.querySelector(".exnote__preview");
    if(prev)prev.textContent=t.value.trim()||t("log.note.empty");
    t.closest(".exnote")?.classList.toggle("has-note",!!t.value.trim())}});
  $w(".ex__namebtn").forEach(b=>b.onclick=()=>openExerciseView(b.dataset.exopen,"log"));
  const sb=$("#workout .skipbar__show");if(sb)sb.onclick=()=>applyShowAll();
  $w(".ex__caret").forEach(b=>b.onclick=()=>{const id=b.dataset.collapse,art=b.closest(".exercise");if(!art)return;
    const now=!collapsed.has(id);now?collapsed.add(id):collapsed.delete(id);art.classList.toggle("is-collapsed",now)});
  if(logMode==="focus"){const fl=focusList();const at=fl.length?Math.min(focusIndex,fl.length-1):0;
    const progEl=$("#woProgress");
    if(progEl){progEl.classList.remove("hidden");
      progEl.innerHTML=`<div class="wo-progress__top">`+
        `<button type="button" class="focusnav" id="woPrev" aria-label="${esc(t("focus.prev_ex"))}"${at<=0?" disabled":""}>‹</button>`+
        `<div class="wo-progress__lab">${esc(t("today.exercise_of",{n:fl.length?at+1:0,m:fl.length}))}</div>`+
        `<button type="button" class="focusnav" id="woNext" aria-label="${esc(t("focus.next_ex"))}"${at>=fl.length-1?" disabled":""}>›</button></div>`+
        `<div class="segbar segbar--ex">${fl.map((_,i)=>`<span class="segbar__seg${i<at?" is-done":""}${i===at?" is-current":""}"></span>`).join("")}</div>`;
      $("#woPrev").onclick=()=>focusAnimateTo(-1);
      $("#woNext").onclick=()=>focusAnimateTo(1)}
    const f=$w("[data-ffinish]")[0];if(f)f.onclick=()=>$("#logForm").requestSubmit();
    $w("[data-fnext]").forEach(b=>b.onclick=()=>focusAnimateTo(1));
    // Tap a logged row to reopen that set in the well, with a way back out.
    $w("[data-editn]").forEach(b=>b.onclick=()=>{
      const exId=b.dataset.editex,n=+b.dataset.editn,key=`${exId}_${n}`,d=loadDraft();
      focusEdit={exId,n,snap:{load:d[`${key}_load`],reps:d[`${key}_reps`],rir:d[`${key}_rir`],effort:d[`${key}_effort`]}};
      renderWorkout()});
    $w("[data-fcancel]").forEach(b=>b.onclick=()=>{
      if(!focusEdit)return;
      const{exId,n,snap}=focusEdit,key=`${exId}_${n}`;
      for(const f2 of ["load","reps","rir"]){
        if(snap[f2]==null)continue;
        const inp=$(`[data-k="${key}_${f2}"]`);if(inp)inp.value=snap[f2]}
      if(snap.effort)setEffortPick(key,snap.effort);
      focusEdit=null;saveDraft();renderWorkout()});
    $w("[data-fold]").forEach(b=>b.onclick=()=>{
      const id=b.dataset.fold;
      focusUnfolded.has(id)?focusUnfolded.delete(id):focusUnfolded.add(id);
      renderWorkout()});
    $w("[data-exnote-open]").forEach(b=>b.onclick=()=>openExNoteSheet(b.dataset.exnoteOpen))}
  else{$("#woProgress")?.classList.add("hidden")}
  updateFocusChrome();
}

function updateGauge(){const exs=exercises();const hot=exs.filter(e=>{const s=recommendation(e).status;return s==="add"||s==="add2"}).length;
  const g=$("#heatGauge"),frac=exs.length?hot/exs.length:0;
  if(g){const fill=g.querySelector(".gauge__fill"),lab=g.querySelector(".gauge__label");
    if(fill)fill.style.width=`${Math.round(frac*100)}%`;
    if(lab)lab.textContent=hot?t("top.gauge.hot",{n:hot}):t("top.gauge.forge");
    g.classList.toggle("is-hot",hot>0);
    g.style.cursor=hot?"pointer":"default";
    g.onclick=hot?()=>{enterWorkout({});const first=$("#workout .exercise.is-add, #workout .exercise.is-add2");if(first){collapsed.delete(first.dataset.ex);first.classList.remove("is-collapsed");first.scrollIntoView({behavior:"smooth",block:"center"})}}:null}
}

function renderFatigue(){const el=$("#fatigue");if(!el)return;const exs=exercises();
  const flagged=fatigueFlagged(),actedOn=flagged.length>0&&flagged.every(e=>skipped.has(e.id));
  if(exs.length>=3&&flagged.length>=2&&!actedOn&&uiPrefs.fatigueDismissedOn!==today()){el.className="fatigue";el.innerHTML=`<b>${esc(t("log.fatigue.title"))}</b> ${esc(t("log.fatigue.body",{n:flagged.length}))} `+
    `<button type="button" class="fatigue__trim">${esc(t("log.fatigue.trim"))}</button>`+
    `<button type="button" class="fatigue__dismiss" aria-label="${esc(t("log.fatigue.dismiss_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`;
    $("#fatigue .fatigue__trim").onclick=()=>applyFatigueTrim();
    $("#fatigue .fatigue__dismiss").onclick=()=>{setUiPref("fatigueDismissedOn",today());renderFatigue()}}
  else el.className="fatigue hidden",el.innerHTML="";}

/* ============================================================
   The end of a session
   The work is already in the log by the time any of this runs: nothing here
   computes a judgement, it only reads back what the session actually did.
   Every number is one the app already trusts elsewhere — the same PR rule as
   the ledger, the same hard-set rule as the volume audit, the same week as
   Today — so the summary can never disagree with the screen it sends you to.
   ============================================================ */

/** The strongest record one lift set, judged only against the log as it stood
 *  before this session. A lift with no history sets none: the first session is
 *  the baseline every later one is measured against, not a record over nothing.
 *  Load beats reps beats e1RM, so a lift reports its best claim once. */
function liftPR(mine,past){
  if(!mine.length||!past.length)return null;
  const bestLoad=Math.max(...past.map(x=>+x.load));
  const bestReps=Math.max(0,...past.filter(x=>sameLoad(+x.load,bestLoad)).map(x=>+x.reps));
  const bestE=Math.max(...past.map(x=>e1rm(+x.load,+x.reps)));
  const top=Math.max(...mine.map(x=>+x.load));
  if(top>bestLoad&&!sameLoad(top,bestLoad)){
    const row=mine.filter(x=>sameLoad(+x.load,top)).sort((a,b)=>+b.reps-+a.reps)[0];
    return{kind:"load",load:top,reps:+row.reps,delta:top-bestLoad}}
  if(sameLoad(top,bestLoad)){
    const reps=Math.max(...mine.filter(x=>sameLoad(+x.load,top)).map(x=>+x.reps));
    if(reps>bestReps)return{kind:"reps",load:top,reps,delta:reps-bestReps}}
  const best=mine.reduce((a,b)=>e1rm(+b.load,+b.reps)>e1rm(+a.load,+a.reps)?b:a);
  const e=e1rm(+best.load,+best.reps);
  if(e>bestE)return{kind:"e1rm",load:+best.load,reps:+best.reps,delta:e-bestE};
  return null}

/** One record line per lift that set one, strongest claim first. */
function sessionPRs(rows,prevLog){
  const past=new Map();
  for(const x of workingRows(prevLog)){const k=liftKey(x);if(!past.has(k))past.set(k,[]);past.get(k).push(x)}
  const mineBy=new Map();
  for(const r of workingRows(rows)){const k=liftKey(r);if(!mineBy.has(k))mineBy.set(k,[]);mineBy.get(k).push(r)}
  const out=[];
  for(const[k,mine]of mineBy){
    const pr=liftPR(mine,past.get(k)||[]);
    if(pr)out.push({...pr,name:displayName(mine[0])})}
  // Heaviest claim first: a load record outranks reps at the old load, which
  // outranks an e1RM that no single set actually lifted.
  const rank={load:0,reps:1,e1rm:2};
  return out.sort((a,b)=>rank[a.kind]-rank[b.kind]||b.delta-a.delta||a.name.localeCompare(b.name))}

/** Hard sets this session put into each muscle — the volume audit's counting
 *  rule (direct 1, partial ½, RIR within the ceiling), scoped to one session. */
function sessionMuscleWork(rows){
  const hr=+state.settings.hardRir,m=new Map();
  for(const x of rows){
    if(!isWork(x)||!(+x.load>0&&+x.reps>0&&+x.rir<=hr))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  // Equal shares break toward the muscle that took the direct work: two sets
  // trained head-on outrank two halves picked up as an assister.
  return[...m].map(([name,v])=>({name,sets:v.d+v.p,direct:v.d})).filter(x=>x.sets>0)
    .sort((a,b)=>b.sets-a.sets||b.direct-a.direct||a.name.localeCompare(b.name))}

/** Everything the finished session earns the right to say about itself. */
function buildSessionSummary({rows,prevLog,session,date,day:sessDay,startedAt}){
  const work=workingRows(rows);
  const meso=mesocycleWeek(),week=weeklySnapshot(date);
  const ds=days(),idx=Math.max(0,ds.indexOf(sessDay)),next=ds.length>1?ds[(idx+1)%ds.length]:null;
  // A clock only earns a slot when it plausibly measured this session: a draft
  // resumed the next morning would otherwise report a nine-hour workout.
  const mins=startedAt?Math.round((Date.now()-startedAt)/60000):0;
  return{session,date,day:sessDay,
    sets:rows.length,
    volume:sum(work.map(r=>(+r.load||0)*(+r.reps||0))),
    lifts:new Set(work.map(liftKey)).size,
    minutes:mins>=1&&mins<=480?mins:null,
    prs:sessionPRs(rows,prevLog),
    delta:sessionDeltaCounts(rows),
    muscles:sessionMuscleWork(rows),
    week:{done:week.completedDays,planned:week.plannedDays},
    meso:{current:meso.current,total:meso.total,isComplete:meso.isComplete},
    next:next?{day:next,exercises:exercises(next).length}:null}}

function updateSaveMeta(){const exs=exercises(),planned=sum(exs.map(e=>e.sets));
  const done=[...committed].length;
  const entered=$$("#workout input").filter(i=>i.dataset.k&&i.dataset.k.endsWith("_load")&&parseDec(i.value)>0).length;
  $("#saveMeta").textContent=done?t("log.save_meta.done",{day:dayLabel(day),done,planned}):(entered?t("log.save_meta.entered",{day:dayLabel(day),entered,planned}):t("log.save_meta.planned",{day:dayLabel(day),planned}));}

async function saveWorkout(e,io){if(e&&e.preventDefault)e.preventDefault();if(saving)return;
  const keys=workoutCandidateKeys(),check=firstWorkoutValidationError(keys);
  if(applyFieldError(check))return;
  if(!keys.length){toast(t("toast.enter_weight_before_save"));return}
  const form=$("#logForm"),formWasInert=!!form?.inert,formBusy=form?.getAttribute("aria-busy")??null;
  saving=true;
  if(form){form.inert=true;form.setAttribute("aria-busy","true")}
  try{const date=check.values.date,bw=check.values.bodyweight,session=`${date}_${day}_${uid()}`,notes=$("#notes").value.trim(),created=new Date().toISOString(),rows=[];
  for(const ex of exercises()){if(skipped.has(ex.id))continue;
    const performed=sessionExercise(ex),exNote=currentExerciseNote(ex.id);
    for(let n=1;n<=ex.sets;n++){
    const key=`${ex.id}_${n}`;
    if(!(committed.has(key)||touched.has(key)||warmups.has(key)))continue;
    const got=readSetCandidate(key);if(!got.ok){applyFieldError(got);return}
    const{load,reps,rir}=got.values;
    const row={session,date,day,name:ex.name,exerciseId:ex.id,set:n,load,reps,rir,notes,created,
      primary:ex.primary,secondary:ex.secondary,performedName:performed.name,
      performedPrimary:performed.primary||"",performedSecondary:performed.secondary||""};
    if(performed.libraryId)row.performedLibraryId=performed.libraryId;
    else if(performed.movementId)row.performedMovementId=performed.movementId;
    if(exNote)row.exNote=exNote;
    if(warmups.has(key))row.warmup=true;
    if(bw>0)row.bodyweight=bw;
    rows.push(row)}}
  if(!rows.length){toast(t("toast.enter_weight_before_save"));return}
  // The log as it stood before this session: what every record below is judged
  // against. Copied, because committing replaces the live snapshot.
  const prevLog=state.log.slice(),startedAt=sessionStartedAt;
  const rawDraft=DraftStore.readRaw();
  const proposal=cloneSnapshot(state);
  proposal.log=proposal.log.concat(cloneSnapshot(rows));
  const effect=consumedDraftClearEffect(rawDraft);
  const result=await commitProposedState(proposal,io||storageIO,{effect,reconcileSessionIds:[session]});
  if(!(result.localOk||result.idbOk))return result;
  if(!prevLog.some(isWork)&&rows.some(isWork))captureEvent("first_set_logged",{});
  captureEvent("session_completed",{
    set_count:window.RepForgeTelemetry?.bucketCount(rows.filter(isWork).length,"sets"),
    exercise_count:window.RepForgeTelemetry?.bucketCount(new Set(rows.filter(isWork).map(row=>row.exerciseId)).size,"exercises"),
    duration:window.RepForgeTelemetry?.bucketDuration(startedAt?Math.max(0,(Date.now()-startedAt)/60000):0)});
  resetDraftSessionState();
  resetSessionContextFields();
  // Nothing left to rest for. Left running, the clock would count down behind
  // the summary and ring for a set that is never coming.
  stopRest();
  const btn=$(".btn--save");if(btn){btn.classList.remove("is-stamped");void btn.offsetWidth;btn.classList.add("is-stamped")}
  const summary=buildSessionSummary({rows,prevLog,session,date,day,startedAt});
  render();
  // The summary is the receipt. The toast only stands in for it when the screen
  // cannot open — another dialog already holds the app, or the host is stripped.
  if(!openSessionSummary(summary)){
    const deltaTxt=formatDeltaCounts(summary.delta,{sep:", "});
    let msg=t("toast.workout_forged",{n:rows.length,sets:tp(rows.length,"set")});
    if(summary.prs.length)msg+=` ${t("toast.workout_pr",{items:summary.prs.map(p=>`${p.name} ${fmtLoad(p.load)} ${unitLabel()}`).join(", ")})}`;
    if(deltaTxt)msg+=` ${deltaTxt}.`;
    toast(msg)}
  return result}finally{
    if(form){form.inert=formWasInert;if(formBusy==null)form.removeAttribute("aria-busy");else form.setAttribute("aria-busy",formBusy)}
    saving=false}}

/** Records worth a line of their own before the rest become a count. */
const SUMMARY_PR_MAX=3;
/** One PR line: what kind of record, on what lift, and by how much. The kind
 *  badge is only drawn when the block holds more than one kind — see the caller.
 *  The sentence under the name names the kind either way. */
function sessionPRHtml(p,withBadge){
  const unit=unitLabel();
  const badge=p.kind==="load"?t("stats.pr_filter.load")
    :p.kind==="reps"?t("stats.pr_filter.reps"):t("stats.pr_filter.e1rm");
  const over=p.kind==="load"?t("summary.pr.over_load",{n:fmtLoad(p.delta),unit})
    :p.kind==="reps"?t("summary.pr.over_reps",{n:fmt(p.delta),reps:tp(p.delta,"rep")})
    :t("summary.pr.over_e1rm",{n:fmtLoad(p.delta),unit});
  return `<li class="sum-pr">`+(withBadge?`<span class="sum-pr__badge">${esc(badge)}</span>`:"")+
    `<span class="sum-pr__text"><span class="sum-pr__name">${esc(p.name)}</span>`+
    `<span class="sum-pr__over">${esc(over)}</span></span>`+
    `<span class="sum-pr__val">${esc(t("summary.pr.value",{load:fmtLoad(p.load),unit,reps:fmt(p.reps)}))}</span></li>`}

function sessionSummaryHtml(s){
  const unit=unitLabel(),out=[];
  out.push(`<div class="sum-crest" aria-hidden="true"><span class="sum-crest__mark"></span></div>`);
  out.push(`<p class="sum-eyebrow">${esc(t("summary.eyebrow"))}</p>`);
  out.push(`<h2 class="sum-hero" id="sumTitle" tabindex="-1">${esc(dayLabel(s.day))}</h2>`);
  const sub=[];
  if(s.meso.current!=null)sub.push(t("today.week_short",{n:s.meso.current}));
  sub.push(formatLongDate(s.date));
  out.push(`<p class="sum-sub">${esc(sub.join(" · "))}</p>`);
  // What the work itself was — sets, load moved, lifts touched — plus the clock
  // when it measured this session rather than a draft left open overnight.
  // `data-ramp` carries the finished number so the row can spin up to it.
  const cell=(n,cap,k)=>`<div class="statrow__cell"><div class="statrow__val" data-ramp="${esc(n)}"`+
    `${k?' data-kfmt="1"':""}>${esc(k?kfmt(n):fmt(n))}</div>`+
    `<div class="statrow__cap">${esc(cap)}</div></div>`;
  const cells=[cell(s.sets,tp(s.sets,"logged set")),
    cell(toDisplay(s.volume),t("summary.stat.moved",{unit}),true),
    cell(s.lifts,tp(s.lifts,"lift"))];
  if(s.minutes!=null)cells.push(cell(s.minutes,tp(s.minutes,"minute")));
  out.push(`<div class="statrow${cells.length>3?" statrow--4":""} sum-stats">${cells.join("")}</div>`);
  // Records first: they are the one thing a lifter came back for. A week where
  // everything moves would bury the best of them in its own list, so only the
  // strongest few get a line and the rest are counted.
  if(s.prs.length){
    const shown=s.prs.slice(0,SUMMARY_PR_MAX),rest=s.prs.length-shown.length;
    // A badge that reads the same on every line is a rubber stamp: it spends a
    // column to repeat what the sentence under each name already says. It earns
    // that column only where it tells one record apart from the next.
    const kinds=new Set(shown.map(p=>p.kind)),withBadge=kinds.size>1;
    out.push(`<p class="section-label section-label--accent">${esc(t("summary.prs.title"))}</p>`+
      `<ul class="sum-prs${withBadge?"":" sum-prs--onekind"}">`+
      shown.map(p=>sessionPRHtml(p,withBadge)).join("")+`</ul>`+
      (rest?`<p class="sum-more">${esc(t("summary.prs.more",{n:rest}))}</p>`:""))}
  // Nothing in this session had a past to be read against, so counting "1 new
  // lift" would be the whole story told as arithmetic. Say what it is instead —
  // but only when there was working weight to call a baseline in the first
  // place, since a session of nothing but warmups is not a first attempt.
  const noHistory=s.lifts>0&&!s.prs.length&&!s.delta.improved&&!s.delta.flat&&!s.delta.regressed;
  if(noHistory)out.push(`<p class="sum-baseline">${esc(t("summary.baseline"))}</p>`);
  else{
    // Good news reads first, but nothing is left out: the same four counts the
    // History row shows, in the order a lifter wants to hear them.
    const chips=[];
    if(s.delta.improved)chips.push({cls:"is-up",text:t("delta.count.improved",{n:s.delta.improved})});
    if(s.delta.new)chips.push({cls:"is-new",text:t("delta.count.new_lifts",{n:s.delta.new,lifts:tp(s.delta.new,"lift")})});
    if(s.delta.flat)chips.push({cls:"",text:t("delta.count.flat",{n:s.delta.flat})});
    if(s.delta.regressed)chips.push({cls:"",text:t("delta.count.regressed",{n:s.delta.regressed})});
    if(chips.length)
      out.push(`<p class="section-label">${esc(t("summary.lifts.title"))}</p>`+
        `<div class="sum-chips">${chips.map(c=>`<span class="sum-chip ${c.cls}">${esc(c.text)}</span>`).join("")}</div>`)}
  if(s.muscles.length){
    const top=s.muscles.slice(0,4),max=Math.max(...top.map(m=>m.sets),1);
    out.push(`<p class="section-label">${esc(t("summary.muscles.title"))}</p>`+
      `<div class="volume sum-muscles">`+top.map(m=>`<div class="vrow"><span class="vrow__name">${esc(muscleLabel(m.name))}</span>`+
        `<span class="vrow__num"><b>${fmt(m.sets)}</b> ${esc(tp(m.sets,"set"))}</span>`+
        `<span class="vrow__bar"><span class="vrow__fill" style="width:${Math.max(4,Math.round(m.sets/max*100))}%"></span></span></div>`).join("")+
      `</div>`)}
  // Where the session leaves the week — the reason to come back on Thursday.
  if(s.week.planned){
    const segs=Math.max(s.week.planned,s.week.done,1),done=Math.min(s.week.done,segs);
    out.push(`<p class="section-label">${esc(t("summary.week.title"))}</p>`+
      `<p class="sum-week">${esc(t("today.sessions_done",{done:s.week.done,planned:s.week.planned}))}</p>`+
      `<div class="segbar sum-segbar" aria-hidden="true">`+
      Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<done?" is-done":""}"></span>`).join("")+`</div>`)}
  if(s.next)
    out.push(`<div class="sum-next"><span class="sum-next__lab">${esc(t("summary.next"))}</span>`+
      `<span class="sum-next__day">${esc(dayLabel(s.next.day))}</span>`+
      `<span class="sum-next__meta">${esc(t("today.exercise_count",{n:s.next.exercises}))}</span></div>`);
  // The detour comes before the door. Done is the last block on purpose: it is
  // the one control the sheet pins, so a report that runs past the fold still
  // shows the way out, and the way out is not carrying a second link with it.
  out.push(`<div class="sum-secondary"><button type="button" class="text-link text-link--center" id="sumSee">${esc(t("summary.see_session"))}</button></div>`);
  out.push(`<div class="sum-actions"><button type="button" class="btn btn--cta btn--noarrow" id="sumDone">${esc(t("summary.done"))}</button></div>`);
  return out.join("")}

/** The stat row spins up to its numbers instead of printing them. They are the
 *  reward, so they are the one thing on the screen that moves by itself — and
 *  the ramp always lands on exactly the figure the markup already rendered, so
 *  a reader who never sees the motion reads the same page. */
function rampSessionStats(root,delayMs=0){
  const cells=[...(root?.querySelectorAll("[data-ramp]")||[])];
  if(!cells.length)return;
  const targets=cells.map(el=>({el,to:+el.dataset.ramp||0,k:el.dataset.kfmt==="1"}));
  const paint=e=>{for(const{el,to,k}of targets)el.textContent=k?kfmt(to*e):fmt(Math.round(to*e))};
  // Reduced motion — or a tab with no screen to animate onto — keeps the
  // finished numbers the markup already carries.
  if(document.hidden||window.matchMedia?.("(prefers-reduced-motion:reduce)").matches)return;
  paint(0);
  const dur=520,start=performance.now()+delayMs;
  // rAF stops in a backgrounded tab. This timer is what guarantees the numbers
  // are never left sitting at zero for a lifter who looks back at the screen.
  const land=setTimeout(()=>paint(1),delayMs+dur+400);
  const step=now=>{
    if(now<start)return requestAnimationFrame(step);
    const p=Math.min(1,(now-start)/dur);
    paint(1-Math.pow(1-p,3));
    if(p<1)requestAnimationFrame(step);
    else clearTimeout(land)};
  requestAnimationFrame(step)}

let sessionSummaryCurrent=null;
function renderSessionSummary(s){
  const body=$("#sessionSummaryBody");if(!body)return;
  body.innerHTML=sessionSummaryHtml(s);
  // Each block carries its reading position, so the stylesheet can stagger
  // however many blocks this particular session earned.
  [...body.children].forEach((el,i)=>el.style.setProperty("--i",i));
  const done=$("#sumDone");if(done)done.onclick=()=>closeSessionSummary();
  const see=$("#sumSee");if(see)see.onclick=()=>{
    editSession=s.session;
    closeSessionSummary({nav:"history"})}}

/** The screen the lifter earns by finishing. It opens over the workout, so
 *  leaving it is what actually ends the session and returns to Today. */
function openSessionSummary(s){
  const el=$("#sessionSummary");if(!el)return false;
  sessionSummaryCurrent=s;
  renderSessionSummary(s);
  el.classList.remove("is-played");
  const ok=openModal(el,{initialFocus:()=>$("#sumTitle"),onEscape:()=>closeSessionSummary()});
  if(!ok){sessionSummaryCurrent=null;return false}
  // One beat, played on the frame after the panel is up so the strike is seen
  // rather than missed. `prefers-reduced-motion` turns every step of it off.
  requestAnimationFrame(()=>{
    if(activeModal?.el!==el)return;
    el.classList.add("is-played");
    // The numbers wait for their own block to arrive before they start. The
    // stylesheet owns the stagger, so the delay is read off it rather than
    // duplicated here.
    const stats=el.querySelector(".sum-stats");
    rampSessionStats(stats,stats?parseFloat(getComputedStyle(stats).animationDelay)*1000||0:0)});
  el.scrollTop=0;
  captureEvent("session_summary_viewed",{});
  return true}

function closeSessionSummary(opts={}){
  const el=$("#sessionSummary");
  sessionSummaryCurrent=null;
  if(el&&activeModal?.el===el)closeModal(el);
  el?.classList.remove("is-played");
  // Finishing a session ends it: the shell steps back to Today either way.
  leaveWorkout();
  if(opts.nav)navTo(opts.nav);
  else render();
  // The control that opened this is gone with the workout, so focus lands on
  // whatever Today now leads with rather than falling back to the body. Saving
  // the day's session swaps the start CTA for the recap, so the target is read
  // off the rendered dashboard instead of assumed to be the CTA.
  if(!opts.nav){const next=resolveReturnFocus(todayPrimaryControl);
    if(next){try{next.focus({preventScroll:true})}catch{}}}}
window.__repforgeSessionSummary={
  open:openSessionSummary,close:closeSessionSummary,
  build:buildSessionSummary,current:()=>sessionSummaryCurrent};

function summaries(){const m=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=`${x.session}|${liftKey(x)}`;if(!m.has(k))m.set(k,{session:x.session,date:x.date,day:x.day,liftKey:liftKey(x),name:displayName(x),loads:[],reps:[],rirs:[],sets:0});
    const o=m.get(k);o.loads.push(+x.load);o.reps.push(+x.reps);o.rirs.push(+x.rir);o.sets++}
  return [...m.values()].map(o=>{let top=0,topReps=0,vol=0,best=0;
    o.loads.forEach((ld,i)=>{const rp=o.reps[i];vol+=ld*rp;const e=e1rm(ld,rp);if(e>best)best=e;if(ld>top){top=ld;topReps=rp}});
    return{session:o.session,date:o.date,day:o.day,liftKey:o.liftKey,name:o.name,top,topReps,reps:sum(o.reps),rir:avg(o.rirs),sets:o.sets,volume:vol,e1rm:best};})
    .sort((a,b)=>a.date.localeCompare(b.date)||a.session.localeCompare(b.session))}

function strengthDashboard(){
  const byLift=new Map();for(const s of summaries()){(byLift.get(s.liftKey)||byLift.set(s.liftKey,[]).get(s.liftKey)).push(s)}
  const prN=new Map();for(const ev of detectPRs(state.log)){const k=ev.liftKey;prN.set(k,(prN.get(k)||0)+1)}
  const rows=[];
  for(const [k,sess] of byLift){const latest=sess.at(-1),first=sess[0],best=Math.max(...sess.map(s=>s.e1rm));
    const ex=currentExerciseForLiftKey(k);
    const rec=ex?recommendation(ex):{label:"—"};
    rows.push({exercise:latest.name,latest:`${fmtLoad(latest.top)}×${latest.topReps}`,best,blockDelta:latest.e1rm-first.e1rm,
      prs:prN.get(k)||0,lastTrained:latest.date,signal:rec.label})}
  return rows.sort((a,b)=>a.exercise.localeCompare(b.exercise))}
window.__repforgeStrengthDashboard=strengthDashboard;
/* Test-only view of the recommendation surface. The parity gate calls exactly
   what the Log tab and the "why this weight" sheet call, so it can prove that
   routing the arithmetic through progression-engine.js leaves every displayed
   target and every displayed explanation byte-identical. Read-only. */
window.__repforgeProgression={
  recommendation,explainRecommendation,setSuggestion,baseSuggestion,baseSetReps,
  sessionsFor:ex=>sessionsFor(ex),
  programSlot:id=>{const slot=prog.find(id);return slot?sessionExercise(slot):null}};

function renderStrengthDash(){const el=$("#strengthDash");if(!el)return;const rows=strengthDashboard();
  if(!rows.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.no_lifts"))}</div>`;return}
  const u=unitLabel(),fmtDelta=d=>{const n=toDisplay(d),a=Math.abs(n);const s=n>0?"+":n<0?"-":"";return s+(a?fmt(Math.round(a)):0)};
  el.innerHTML=table(rows.map(r=>({[t("stats.table.exercise")]:r.exercise,[t("stats.table.latest")]:r.latest,[t("stats.table.best_e1rm_unit",{unit:u})]:fmt(Math.round(toDisplay(r.best))),
    [t("stats.table.delta_block")]:fmtDelta(r.blockDelta),[t("stats.table.prs")]:r.prs,[t("stats.table.signal")]:r.signal})))}

// The week reads as a headline: the verdict first, the arithmetic under it, and a
// session bar so "3 of 4" is legible without reading. The attention tally counts the
// same lifts the Attention list below shows, so the two numbers never disagree.
function coachingDestKey(group){if(group==="add")return"details";if(group==="new"||group==="stale")return"log";return"trend"}
function coachingDestLabel(group){const k=coachingDestKey(group);return k==="details"?t("stats.dest.details"):k==="log"?t("stats.dest.log"):t("stats.dest.trend")}
function renderThisWeek(){const el=$("#thisWeek");if(!el)return;const w=weeklySnapshot();
  const attnN=attentionCount();
  const segs=Math.max(w.plannedDays,w.completedDays,1),done=Math.min(w.completedDays,segs);
  el.innerHTML=`<div class="ov-week-status">${esc(t("stats.this_week.status",{status:w.status}))}</div>`+
    `<div class="ov-week-line">${esc(t("stats.this_week.line",{done:w.completedDays,planned:w.plannedDays,hardSets:`${w.totalHardSets} ${tp(w.totalHardSets,"hard set")}`}))}</div>`+
    `<div class="ov-week-bar" aria-hidden="true">`+
    Array.from({length:segs},(_,i)=>`<span class="ov-week-bar__seg${i<done?" is-done":""}"></span>`).join("")+`</div>`+
    `<div class="statrow">`+
    `<div class="statrow__cell" data-week-metric="improved"><div class="statrow__val">${w.improvedLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.improved"))}</div></div>`+
    `<div class="statrow__cell" data-week-metric="stable"><div class="statrow__val">${w.flatLifts}</div><div class="statrow__cap">${esc(t("stats.this_week.stable"))}</div></div>`+
    `<div class="statrow__cell${attnN?" is-attn":""}" data-week-metric="attention"><div class="statrow__val">${attnN||0}${attnN?`<span class="statrow__dot"></span>`:""}</div><div class="statrow__cap">${esc(t("stats.this_week.attention"))}</div></div>`+
    `</div>`}
function overviewBarPct(planned,completed7){return planned>0?Math.min(100,Math.round(completed7/planned*100)):0}
function overviewVolumeSorted(){return volumeDashboard(7).slice().sort((a,b)=>{
  const da=Math.max(a.planned-a.completed7,0),db=Math.max(b.planned-b.completed7,0);
  if(db!==da)return db-da;
  const ra=a.planned>0?a.completed7/a.planned:Infinity,rb=b.planned>0?b.completed7/b.planned:Infinity;
  if(ra!==rb)return ra-rb;
  return muscleLabel(a.muscle).localeCompare(muscleLabel(b.muscle),locTag())})}
function renderOverviewVolume(){const el=$("#overviewVolume");if(!el)return;
  const rows=overviewVolumeSorted(),shown=rows.slice(0,8),more=rows.length-shown.length;
  el.innerHTML=rows.length?shown.map(r=>{
    const high=r.status===t("status.high"),on=r.status===t("status.on_target"),below=r.status===t("status.low");
    const pct=overviewBarPct(r.planned,r.completed7);
    const label=high?t("status.high"):below?t("stats.volume_below"):t("stats.volume_on_target");
    return `<div class="vrow" data-muscle="${esc(r.muscle)}"><span class="vrow__name">${esc(muscleLabel(r.muscle))}</span>`+
      `<span class="vrow__bar"><span class="vrow__fill${high?" is-high":on?" is-on":""}" style="width:${pct}%"></span></span>`+
      `<span class="vrow__num">${fmt(r.completed7)} / ${fmt(r.planned)}</span>`+
      `<span class="vrow__status${on?" is-on":""}">${esc(label)}</span></div>`}).join("")+
      (more>0?`<button type="button" class="link-row-cta" id="overviewVolumeMore">${esc(t("stats.volume_more",{n:more}))}</button>`:"")
    :`<div class="empty">${esc(t("stats.empty.no_hard_sets",{n:7}))}</div>`;
  const moreBtn=$("#overviewVolumeMore");if(moreBtn)moreBtn.onclick=()=>setStatsSeg("volume")}
function renderReadyList(){const el=$("#readyList");if(!el)return;
  const add=attentionGroups().find(g=>g.key==="add");
  if(!add?.items.length){el.innerHTML="";readyExpanded=false;return}
  const items=add.items,cap=4,shown=readyExpanded?items:items.slice(0,cap),more=items.length-cap;
  const row=({ex,why})=>{const r=recommendation(ex);const prev=last(ex);const base=prev.find(s=>s.set===1)?.load??prev[0]?.load;
      const delta=r.load!=null&&base!=null?r.load-base:null;
      const deltaTxt=delta!=null?`+${fmtLoad(Math.abs(delta))} ${unitLabel()}`:r.label;
      const dest=coachingDestLabel("add");
      return `<button type="button" class="ready-row listrow" data-ready="${esc(ex.id)}" data-dest="details"><div class="listrow__main"><div class="listrow__title">${esc(ex.name)}</div>`+
        `<div class="listrow__sub">${esc(why)}</div></div><span class="ready-row__delta">${esc(deltaTxt)}</span><span class="coach-dest">${esc(dest)}</span><span class="chevron" aria-hidden="true"></span></button>`};
  el.innerHTML=`<p class="section-label">${esc(t("stats.ready_to_progress"))}<span class="section-label__count">${esc(t("stats.section_count",{n:items.length}))}</span></p>`+shown.map(row).join("")+
    (more>0&&!readyExpanded?`<button type="button" class="link-row-cta" id="readySeeAll"><span>${esc(t("stats.ready_see_all",{n:items.length}))}</span><span class="chevron" aria-hidden="true"></span></button>`:"");
  $$("#readyList [data-ready]").forEach(b=>b.onclick=()=>openExerciseView(b.dataset.ready,"stats"));
  const see=$("#readySeeAll");if(see)see.onclick=()=>{readyExpanded=true;renderReadyList()}}
function recentDeltaRows(){const sessMap=new Map();
  for(const x of state.log){if(!sessMap.has(x.session))sessMap.set(x.session,{session:x.session,date:x.date,created:x.created})}
  const recent=[...sessMap.values()].sort((a,b)=>String(b.created).localeCompare(String(a.created))||String(b.date).localeCompare(String(a.date))).slice(0,10);
  const out=[];
  for(const sess of recent){const byLift=new Map();
    for(const r of state.log.filter(x=>x.session===sess.session)){const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
    for(const rows of byLift.values()){if(!workingRows(rows).length)continue;
      const ex=currentExerciseForLiftKey(liftKey(rows[0]))||exerciseIdentityFromRow(rows[0]);
      const cmp=compareExerciseSession(ex,rows);if(cmp.status==="not_comparable")continue;
      const m=cmp.metrics?.current||exerciseSessionMetrics(rows);
      out.push({[t("stats.table.date")]:shortDate(sess.date),[t("stats.table.exercise")]:displayName(rows[0]),[t("stats.table.status")]:cmp.label,[t("stats.table.load")]:fmtLoad(m.topLoad),[t("stats.table.reps")]:m.totalReps,
        [t("stats.table.e1rm")]:fmt(Math.round(toDisplay(m.bestE1rm))),[t("stats.table.delta")]:cmp.status==="new"?"—":formatDelta(cmp)||"—"})}}
  return out}

function renderStats(){
  // First run: point at the Log tab instead of an all-zero dashboard.
  const hasLog=state.log.some(isWork),intro=$("#statsIntro");
  if(intro){
    intro.classList.toggle("hidden",hasLog);
    intro.innerHTML=hasLog?"":`<p class="emptystate__title">${esc(t("stats.empty.title"))}</p>`+
      `<p class="emptystate__body">${esc(t("stats.empty.body"))}</p>`+
      `<button type="button" class="btn btn--cta" id="statsIntroGo">${esc(t("stats.empty.cta"))}</button>`;
    const go=$("#statsIntroGo");if(go)go.onclick=()=>navTo("log");
    for(const sel of["#thisWeek","#readyList","#attention","#metrics","#statsDeep","#overviewVolume"]){const el=$(sel);if(el)el.classList.toggle("hidden",!hasLog)}
  }
  renderThisWeek();
  renderReadyList();
  renderOverviewVolume();
  // Stat exercise options: the label and identity both follow what was actually
  // performed, so reusing a program slot cannot merge two different movements.
  const keys=[...new Set(state.log.filter(isWork).map(liftKey))].sort();
  const keyLabel=k=>{const rows=state.log.filter(r=>liftKey(r)===k);
    const latest=[...rows].sort((a,b)=>String(b.created).localeCompare(String(a.created)))[0];
    return latest?displayName(latest):k};
  const sums=summaries();
  const totalVol=sum(state.log.filter(isWork).map(x=>(+x.load||0)*(+x.reps||0)));
  const bestE=state.log.length?Math.max(...state.log.filter(isWork).map(x=>e1rm(+x.load,+x.reps))):0;
  const lc=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
  const tiles=[
    {label:lc(t("stats.metric.sessions")),val:new Set(state.log.map(x=>x.session)).size},
    {label:lc(t("stats.metric.sets_logged")),val:state.log.length},
    {label:lc(t("stats.metric.volume")),val:kfmt(toDisplay(totalVol)),unit:unitLabel()},
    {label:lc(t("stats.metric.best_e1rm")),val:fmt(Math.round(toDisplay(bestE))),unit:unitLabel(),hot:bestE>0},
  ];
  $("#metrics").innerHTML=tiles.map(t=>`<div class="metric${t.hot?" metric--hot":""}"><div class="metric__val">${t.val}${t.unit?`<small>${t.unit}</small>`:""}</div><div class="metric__label">${t.label}</div></div>`).join("");

  const old=$("#statExercise").value;
  $("#statExercise").innerHTML=keys.map(k=>`<option value="${esc(k)}">${esc(keyLabel(k))}</option>`).join("")||`<option>${esc(t("stats.table.no_data"))}</option>`;
  if(keys.includes(old))$("#statExercise").value=old;
  else if(keys.length)$("#statExercise").value=keys[0];
  const sel=$("#statExercise").value,rows=sums.filter(x=>x.liftKey===sel);
  draw(rows);

  if(rows.length){const first=rows[0].top,latest=rows.at(-1).top,delta=latest-first,be=Math.max(...rows.map(r=>r.e1rm));
    const dir=delta>0?"up":delta<0?"down":"";const arrow=delta>0?"▲":delta<0?"▼":"·";
    // Two figures, not one sentence: what the top set did, and the best estimate
    // behind it. The movement over sessions belongs to the first of them, so it
    // sits on that line rather than wrapping into the second.
    $("#trend").innerHTML=`<p class="trend__fig"><span>${t("stats.trend.top_load",{a:fmtLoad(first),b:fmtLoad(latest),unit:unitLabel()})}</span>`+
      `<span class="trend__delta ${dir}">${arrow} ${esc(t("stats.trend.over_sessions",{signed:fmt(toDisplay(Math.abs(delta))),unit:unitLabel(),sessions:`${rows.length} ${tp(rows.length,"session")}`}))}</span></p>`+
      `<p class="trend__fig"><span>${t("stats.trend.best_e1rm",{top:fmt(Math.round(toDisplay(be))),unit:unitLabel()})}</span></p>`;
  }else $("#trend").innerHTML="";

  $("#recent").innerHTML=table(rows.slice(-8).reverse().map(x=>({[t("stats.table.date")]:x.date,[t("stats.table.top")]:fmtLoad(x.top),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir),[t("stats.table.e1rm")]:fmt(Math.round(toDisplay(x.e1rm))),[t("stats.table.vol")]:kfmt(toDisplay(x.volume))})));
  const rd=$("#recentDeltas");if(rd)rd.innerHTML=table(recentDeltaRows());
  const topByLift=new Map();
  for(const x of state.log){if(!isWork(x))continue;const k=liftKey(x),ld=+x.load,cur=topByLift.get(k);
    if(!cur||ld>cur.load||(ld===cur.load&&+x.reps>+cur.reps))topByLift.set(k,{Exercise:displayName(x),load:ld,reps:x.reps,rir:x.rir,date:x.date})}
  const progRows=[...topByLift.values()].sort((a,b)=>b.load-a.load||b.reps-a.reps).map(r=>({[t("stats.table.exercise")]:r.Exercise,[unitLabel()]:fmtLoad(r.load),[t("stats.table.reps")]:r.reps,[t("stats.table.rir")]:fmt(r.rir),[t("stats.table.date")]:r.date}));
  $("#tops").innerHTML=table(progRows);
  renderPRs();renderAttention();renderCompleted();renderReview();
  if(statsSeg==="strength")renderStrengthDash();
  if(statsSeg==="volume")renderVolumeDash();
  if(statsSeg==="prs")renderPRTimeline();
}

function detectPRs(log,opts={}){
  const rows=(Array.isArray(log)?log:[]).filter(isWork).filter(r=>+r.load>0)
    .sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created)));
  const best=new Map(),events=[];
  for(const row of rows){const k=liftKey(row),ld=+row.load,rp=+row.reps,em=e1rm(ld,rp);
    const cur=best.get(k)||{load:0,repsAtMax:0,e1rm:0};
    if(ld>cur.load){events.push({kind:"load",liftKey:k,date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaLoad:cur.load>0?ld-cur.load:undefined});
      cur.load=ld;cur.repsAtMax=rp}
    else if(ld===cur.load&&rp>cur.repsAtMax){events.push({kind:"reps",liftKey:k,date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaReps:rp-cur.repsAtMax});
      cur.repsAtMax=rp}
    if(em>cur.e1rm){events.push({kind:"e1rm",liftKey:k,date:row.date,load:ld,reps:rp,rir:row.rir,exerciseName:displayName(row),exerciseId:row.exerciseId,deltaE1rm:cur.e1rm>0?em-cur.e1rm:undefined});
      cur.e1rm=em}
    best.set(k,cur)}
  return events}
function normalizeCommandText(text){return String(text??"").toLowerCase().replaceAll("×","x").replace(/@/g," rir ")
  .replace(/(\d),(\d)/g,"$1.$2").replace(/\breps\b/g,"").replace(/\s+/g," ").trim()}
const deaccent=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
/** Effort spoken or typed in either language: "hard", "difícil", "dificil". */
function matchEffortWord(text){
  const hay=` ${deaccent(text).toLowerCase()} `;
  for(const e of EFFORT_STEPS){
    const words=new Set([e,deaccent(effortLabel(e)).toLowerCase()]);
    for(const w of words)if(w&&new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(hay))return e}
  return null}
function parseSetCommand(text){
  const n=normalizeCommandText(text),warnings=[];
  let set=null,load,reps,rir=null,effort=null,unit=null,confidence="low",gotReps=false;
  const setM=n.match(/(?:set|s)\s*(\d+)/);if(setM)set=+setM[1];
  const primary=n.match(/(\d+(?:\.\d+)?)\s*(kg|lb)?\s*(?:x|for)\s*(\d+)/);
  if(primary){load=+primary[1];unit=primary[2]||null;reps=+primary[3];confidence="high";gotReps=true}
  else{const nums=(n.match(/\d+(?:\.\d+)?/g)||[]).map(Number);
    if(set!=null){const i=nums.indexOf(set);if(i>=0)nums.splice(i,1)}
    if(!nums.length)return {ok:false,error:t("command.error.could_not_read_set"),warnings};
    if(nums.length<2)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
    load=nums[0];reps=nums[1];gotReps=true;if(nums.length>=3)rir=nums[2]}
  if(!gotReps)return {ok:false,error:t("command.error.could_not_find_reps"),warnings};
  const rirM=n.match(/(?:rir|@)\s*(\d+(?:\.\d+)?)/);if(rirM)rir=+rirM[1];
  else{const tr=n.match(/\b(\d+(?:\.\d+)?)\s*rir\b/);if(tr)rir=+tr[1]}
  effort=matchEffortWord(n);
  if(!unit){const u=n.match(/\b(\d+(?:\.\d+)?)\s*(kg|lb)\b/);if(u)unit=u[2]}
  let exerciseName=null;const exSrc=setM?n.slice(setM.index+setM[0].length).trim():n;
  const lead=exSrc.match(/^([a-z][a-z\s]*?)(?=\d)/);if(lead){const ex=lead[1].trim();if(ex)exerciseName=ex}
  return {ok:true,exerciseName,set,load,reps,rir,effort,unit,confidence,warnings}}
window.detectPRs=detectPRs;
window.__repforgeGenerateProgram=generateProgramFromOnboarding;
window.__repforgeCatalogForSlot=catalogForSlot;
window.__repforgeChooseExercise=chooseExercise;
window.__repforgeResolveSplit=resolveSplit;
window.__repforgeExerciseCatalog=EXERCISE_LIBRARY;
window.__repforgeExerciseLibrary=EXERCISE_LIBRARY;
window.__repforgeLibraryEntry=libraryEntry;
window.__repforgePickableExercises=()=>pickableExercises();
window.__repforgeLinkImported=linkImportedExercises;
window.__repforgeOpenPicker=opts=>openExercisePicker(opts);
window.__repforgeSaveCustomExercise=draft=>saveCustomExercise(draft);
window.__repforgeCustomExercises=()=>customExercises();
window.__repforgePickerSelection=()=>pickerState?[...pickerState.selected]:null;
window.__repforgeDeleteCustomExercise=id=>deleteCustomExercise(id);
window.__repforgeRowMuscles=row=>rowMuscles(row);
window.__repforgeParseProgramSource=(text,name)=>parseProgramSource(text,name);
window.__repforgeImportDraft=()=>importDraft&&{
  fileName:importDraft.fileName,format:importDraft.format,
  counts:importCounts(importDraft),
  rows:importDraft.rows.map(r=>({name:r.raw.name,status:r.status,decision:r.decision,
    reviewed:r.reviewed,match:r.match?r.match.id:null}))};
window.__repforgeCommitImport=io=>commitImportReview(io||storageIO);
window.__repforgeReferencedCustom=list=>referencedCustomExercises(list);
window.__repforgeOpenLibrary=opts=>openLibrary(opts||{});
window.__repforgeLibraryFlow=()=>libFlow&&{day:libFlow.day,tab:libFlow.tab,step:libFlow.step,
  query:libFlow.query,muscle:libFlow.muscle,equipment:libFlow.equipment,
  selected:[...libFlow.selected.keys()],selection:[...libFlow.selected.entries()].map(cloneSnapshot)};
window.__repforgeEditCustom=id=>editCustomExercise(id);
window.__repforgeCompletedVolume=(windowDays=7)=>volMapToObj(completedHardSets(windowDays));
window.__repforgeEquipmentSupportsSplit=equipmentSupportsSplit;
window.__repforgeTestDeltas=(prevRows,currentRows)=>buildSessionDelta(prevRows,currentRows);
window.__repforgeCompareExercise=(ex,currentRows)=>compareExerciseSession(ex,currentRows);
window.__repforgeMesocycleWeek=mesocycleWeek;
window.__repforgeBuildBlockReview=buildBlockReview;
window.__repforgeCommitNextBlock=commitNextBlock;
window.__repforgeFinalizeProgramSetup=(opts,io)=>finalizeProgramSetup(Object.assign({},opts,{io:io||opts?.io||storageIO}));
window.__repforgeApplyProgramTemplate=applyProgramTemplate;
window.__repforgeOnboardingOrigin=()=>onboardingOrigin;
window.__repforgePendingBlock=()=>pendingBlockTransition;
window.__repforgeParseCommand=parseSetCommand;
window.__repforgeNormalizeCommand=normalizeCommandText;
window.__repforgeParseDec=parseDec;
window.__repforgeParseLoad=parseLoadInput;

function resolveExerciseFromCommand(parsed,currentExercises){
  if(parsed.exerciseName){
    const q=parsed.exerciseName.toLowerCase();
    const hit=currentExercises.filter(e=>{const n=e.name.toLowerCase();return n.startsWith(q)||n.includes(q)});
    return hit.length===1?hit[0]:null}
  if(logMode==="focus"){const fl=focusList();return fl[Math.min(focusIndex,Math.max(0,fl.length-1))]||null}
  return currentExercises[0]||null}
function applyParsedCommand(parsed,context){
  const d=context?.day??day,exs=exercises(d).filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex)return;
  const pick=n=>{if(n<1||n>ex.sets)return null;const k=`${ex.id}_${n}`;return committed.has(k)?null:n};
  let setN=null;
  if(parsed.set!=null){for(let n=parsed.set;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  else{for(let n=1;n<=ex.sets;n++){setN=pick(n);if(setN)break}}
  if(!setN){toast(t("toast.all_sets_saved"));return}
  const key=`${ex.id}_${setN}`;
  let loadDisp=parsed.load;
  if(parsed.unit&&parsed.unit!==state.settings.unit)loadDisp=toDisplay(fromDisplayUnit(parsed.load,parsed.unit));
  const loadInp=$(`[data-k="${key}_load"]`);if(loadInp)loadInp.value=fmt(loadDisp);
  const repsInp=$(`[data-k="${key}_reps"]`);if(repsInp)repsInp.value=fmt(parsed.reps);
  if(isEffortMode()){
    let eff=parsed.effort;
    if(!eff&&parsed.rir!=null)eff=effortForRir(parsed.rir);
    setEffortPick(key,eff||"hard")}
  else{const rirInp=$(`[data-k="${key}_rir"]`);if(rirInp)rirInp.value=parsed.rir!=null?fmt(parsed.rir):""}
  touched.add(key);const row=$(`[data-set="${key}"]`);if(row)row.classList.remove("is-suggested");
  saveDraft();updateSaveMeta();return{ex,set:setN}}
/** Fill the next open set from a spoken set, e.g. "80 x 8 @1". Returns true when applied. */
function applyCommandText(text){
  const v=String(text||"").trim();if(!v)return false;
  const parsed=parseSetCommand(v);
  if(!parsed.ok){toast(parsed.error);return false}
  const exs=exercises().filter(e=>!skipped.has(e.id)),ex=resolveExerciseFromCommand(parsed,exs);
  if(!ex){toast(t("command.error.no_exercise_match"));return false}
  const r=applyParsedCommand(parsed,{day,logMode});
  if(!r)return false;
  const rirBit=parsed.rir!=null?` @${fmt(parsed.rir)}`:parsed.effort?` ${effortLabel(parsed.effort)}`:"";
  toast(t("toast.command_applied",{load:fmt(parsed.load),reps:parsed.reps,rir:rirBit}));
  return true}
window.__repforgeApplyCommandText=applyCommandText;
function updateVoiceBtn(){const b=$("#voiceBtn");if(!b)return;b.classList.toggle("hidden",!(SR&&state.settings.voiceInputEnabled))}
function startVoiceInput(){
  if(!SR)return;const rec=new SR();rec.lang=I18N?I18N.speechLang():"en-US";rec.interimResults=false;rec.maxAlternatives=1;
  rec.onresult=e=>{const said=e.results[0]?.[0]?.transcript;if(said)applyCommandText(said)};
  rec.onerror=()=>toast(t("toast.voice_failed"));
  try{rec.start()}catch{toast(t("toast.voice_failed"))}}
window.__repforgeBlockSnapshot=blockSnapshot;
window.__repforgeBuildPlainSummary=buildPlainSummary;

function prTimeline(filter){
  const all=detectPRs(state.log);let events=all;
  if(filter==="load"||filter==="reps"||filter==="e1rm")events=all.filter(e=>e.kind===filter);
  else if(filter==="program"){const ids=new Set(prog.exercises.map(exerciseLiftKey));
    events=all.filter(e=>ids.has(e.liftKey))}
  return events.sort((a,b)=>String(b.date).localeCompare(String(a.date)))}
window.__repforgePrTimeline=prTimeline;

function renderPRTimeline(){const el=$("#prTimeline");if(!el)return;
  $$("#prFilterSeg button").forEach(b=>{const on=b.dataset.prf===prFilter;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false");
    b.onclick=()=>{prFilter=b.dataset.prf;renderPRTimeline()}});
  const events=prTimeline(prFilter);
  if(!events.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.no_pr_filter"))}</div>`;return}
  const prDate=d=>{const p=String(d||"").split("-");return p.length===3?`${t("month."+(+p[1]-1))} ${+p[2]}`:String(d||"")};
  const kindLbl=k=>k==="load"?t("stats.pr.load"):k==="reps"?t("stats.pr.reps"):t("stats.pr.e1rm");
  const delta=ev=>ev.kind==="load"?(ev.deltaLoad!=null?`+${fmtLoad(ev.deltaLoad)}${unitLabel()}`:"")
    :ev.kind==="reps"?(ev.deltaReps!=null?`+${ev.deltaReps}`:"")
    :(ev.deltaE1rm!=null?`+${fmt(Math.round(toDisplay(ev.deltaE1rm)))}${unitLabel()}`:"");
  el.innerHTML=events.map(ev=>{const kc=ev.kind==="load"?"pr-kind--load":ev.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm";
    const d=delta(ev);
    return `<div class="prtl__row"><span class="prtl__date">${esc(prDate(ev.date))}</span>`+
      `<span class="prtl__ex">${esc(ev.exerciseName)}</span>`+
      `<span class="pr-kind ${kc}">${esc(kindLbl(ev.kind))}</span>`+
      `<span class="prtl__set">${esc(fmtLoad(ev.load))}${unitLabel()} × ${esc(ev.reps)}</span>`+
      (d?`<span class="prtl__delta">${esc(d)}</span>`:"")+`</div>`}).join("")}

function renderPRs(){const el=$("#prLedger");if(!el)return;
  const sel=$("#statExercise").value,events=detectPRs(state.log).filter(ev=>ev.liftKey===sel);
  if(!events.length){el.innerHTML=`<div class="empty">${esc(t("stats.empty.log_prs"))}</div>`;return}
  // No e1RM column: the figures above the ledger name the best estimate, and the
  // chart below it is that estimate over time under a caption saying so. Three
  // printings of one number were what pushed the seventh column off the card.
  el.innerHTML=`<table><thead><tr><th>${esc(t("stats.table.date"))}</th><th>${esc(t("stats.table.kind"))}</th><th>${esc(t("stats.table.load"))}</th><th>${esc(t("stats.table.reps"))}</th><th>${esc(t("stats.table.rir"))}</th><th>${esc(t("stats.table.delta_vs_prev"))}</th></tr></thead><tbody>${
    events.map(ev=>{const kindCls=ev.kind==="load"?"pr-kind--load":ev.kind==="reps"?"pr-kind--reps":"pr-kind--e1rm";
      const kindLabel=ev.kind==="e1rm"?t("stats.pr.e1rm"):ev.kind==="reps"?t("stats.pr.reps"):t("stats.pr.load");
      const delta=ev.kind==="e1rm"?(ev.deltaE1rm!=null?`+${fmt(Math.round(toDisplay(ev.deltaE1rm)))}`:"—")
        :ev.kind==="reps"?(ev.deltaReps!=null?`+${ev.deltaReps}`:"—")
        :(ev.deltaLoad!=null?`+${fmtLoad(ev.deltaLoad)}`:"—");
      return `<tr class="pr-row"><td>${esc(ev.date)}</td><td><span class="pr-kind ${kindCls}">${esc(kindLabel)}</span></td>`+
        `<td>${esc(fmtLoad(ev.load))}</td><td>${esc(ev.reps)}</td><td>${esc(fmt(ev.rir))}</td>`+
        `<td>${esc(delta)}</td></tr>`}).join("")
  }</tbody></table>`}

// Action board — which lifts need a decision, grouped by signal (one group per lift).
function attentionSignal(ex,fatigueCluster){
  const r=recommendation(ex),sess=sessionsFor(ex);
  if(r.status==="add"||r.status==="add2")return{key:"add",why:t("attention.add.why")};
  if(r.status==="reduce"||r.stalled)return{key:"reduce",why:t("attention.reduce.why")};
  if(r.status==="new")return{key:"new",why:t("attention.new.why")};
  if(sess.length){
    const lastDate=String(sess.at(-1).date).slice(0,10),cutoff=daysAgo(10);
    if(lastDate<cutoff){const n=Math.floor((new Date(`${today()}T12:00:00`)-new Date(`${lastDate}T12:00:00`))/86400000);
      return{key:"stale",why:t("attention.stale.why",{n})}}
  }
  const planned=prog.volume(),done=completedHardSets(7);
  for(const m of muscles(ex.primary)){const p=planned.get(m),d=done.get(m),target=p?p.d+p.p:0,actual=d?d.d+d.p:0;
    if(target>0&&actual<target)return{key:"vol",why:t("attention.vol.why")}}
  if(recoverSignal(ex,sess)||(fatigueCluster&&r.status==="hold"&&recoverSignal(ex,sess,1)))return{key:"fatigue",why:t("attention.fatigue.why")};
  return null}
function attentionGroups(){const fatigueCluster=prog.exercises.filter(ex=>{const r=recommendation(ex);return r.status==="reduce"||r.stalled}).length>=2;
  const defs=[{key:"add",cls:"add",lead:t("attention.add.lead")},{key:"reduce",cls:"reduce",lead:t("attention.reduce.lead")},{key:"new",cls:"new",lead:t("attention.new.lead")},
    {key:"stale",cls:"stale",lead:t("attention.stale.lead")},{key:"vol",cls:"vol",lead:t("attention.vol.lead")},{key:"fatigue",cls:"fatigue",lead:t("attention.fatigue.lead")}];
  const g=Object.fromEntries(defs.map(d=>[d.key,[]]));
  for(const ex of prog.exercises){const sig=attentionSignal(ex,fatigueCluster);if(sig)g[sig.key].push({ex,why:sig.why})}
  return defs.map(d=>({...d,items:g[d.key]})).filter(d=>d.items.length)}
window.__repforgeRecoverSignal=recoverSignal;
window.__repforgeRecommendation=recommendation;
window.__repforgeProgressionForExercise=progressionForExercise;
window.__repforgeCapacity={CAPACITY,capRir,capReps,capE1rm,repsAtLoad,typicalRir,capacityBaseline,
  sessionsFor,expectedSetDrop,sessionFreshness,baseSetReps,setSuggestion};
window.__repforgeAttention=attentionGroups;
// Lifts on the Attention board — everything the board lists, so the "attention" cell in
// the weekly stat row and the "ATTENTION · n" heading always report the same lifts.
function attentionCount(groups){return(groups||attentionGroups().filter(g=>g.key!=="add")).reduce((n,g)=>n+g.items.length,0)}
function renderAttention(){const el=$("#attention");if(!el)return;
  const groups=attentionGroups().filter(g=>g.key!=="add");
  if(!groups.length){el.innerHTML="";return}
  const n=attentionCount(groups);
  const html=`<p class="section-label">${esc(t("attention.title"))}<span class="section-label__count">${esc(t("stats.section_count",{n}))}</span></p>`+groups.map(({key,cls,lead,items})=>{
    // A cause the whole group shares is stated once, above the lifts it holds:
    // ten rows repeating "Primary muscle under weekly volume target." read as a
    // rendering fault rather than as ten lifts sharing one reason. A group whose
    // rows differ — "Last trained 15 days ago." beside 22 — keeps them, because
    // hoisting one row's sentence would speak for the others.
    const shared=items.length>1&&items.every(it=>it.why===items[0].why)?items[0].why:"";
    return `<div class="attn__grp attn--${cls}"><span class="attn__lead">${esc(lead)}</span>`+
    `<p class="attn__why${shared?"":" visually-hidden"}">${esc(items[0]?.why||"")}</p>`+
    items.map(({ex,why})=>{const dest=coachingDestLabel(key),destKey=coachingDestKey(key);
      // The destination is spoken, not printed: the chevron carries it for the
      // eye, and ten rows of "View trend" were charging the reason beside them
      // for a word the row already implies. A shared reason goes the same way:
      // the eye reads it once above the group, and each row keeps it in its own
      // accessible name, so a row still answers "why" on its own.
      return `<button type="button" class="attn__chip" data-attn="${esc(ex.id)}" data-attngo="${esc(key)}" data-dest="${esc(destKey)}"><span class="attn__dot" aria-hidden="true"></span><div class="listrow__main"><div class="listrow__title">${esc(ex.name)}</div>`+
      `<div class="listrow__sub${shared?" visually-hidden":""}">${esc(why)}</div>`+
      `</div><span class="coach-dest visually-hidden">${esc(dest)}</span><span class="chevron" aria-hidden="true"></span></button>`}).join("")+`</div>`}).join("");
  el.innerHTML=html;
  $$("#attention [data-attn]").forEach(b=>b.onclick=()=>{const grp=b.dataset.attngo,id=b.dataset.attn,ex=prog.find(id);
    if(grp==="new"||grp==="stale"){if(ex)goToLogExercise(ex.id)}
    else{const k=ex?exerciseLiftKey(ex):null,has=!!k&&[...$("#statExercise").options].some(o=>o.value===k);
      if(has){$("#statsDeep").open=true;$("#statExercise").value=k;renderStats();redrawChart();$("#chart").scrollIntoView({behavior:"smooth",block:"center"})}else toast(t("toast.chart_missing_lift"))}});}

// Completed hard sets per muscle over a rolling window (load>0, reps>0, RIR within hardRir).
function completedHardSets(windowDays){const cutoff=daysAgo(windowDays-1),hr=+state.settings.hardRir,m=new Map();
  for(const x of state.log){if(String(x.date)<cutoff)continue;if(!(+x.load>0&&+x.reps>0&&+x.rir<=hr)||!isWork(x))continue;
    const mus=rowMuscles(x);
    for(const p of muscles(mus.primary))addVol(m,p,1,0);
    for(const s of muscles(mus.secondary))addVol(m,s,0,.5)}
  return m}
function volEff(m,name){const v=m.get(name);return v?v.d+v.p:0}
function volumeStatus(planned,completed7){if(!planned)return completed7>0?t("status.high"):t("status.on_target");
  const ratio=completed7/planned;return ratio<0.6?t("status.low"):ratio<=1.3?t("status.on_target"):t("status.high")}
function volumeDashboard(windowDays){const planned=prog.volume(),c7=completedHardSets(7),c28=completedHardSets(28);
  const names=new Set([...planned.keys(),...c7.keys(),...c28.keys()]);
  return[...names].sort((a,b)=>muscleLabel(a).localeCompare(muscleLabel(b),locTag())).map(muscle=>{
    const p=volEff(planned,muscle),c7v=volEff(c7,muscle),c28v=volEff(c28,muscle);
    return{muscle,planned:p,completed7:c7v,completed28:c28v,status:volumeStatus(p,c7v)}})}
window.__repforgeVolumeDashboard=volumeDashboard;
window.__repforgeOverviewVolume={pct:overviewBarPct,sorted:overviewVolumeSorted,label:muscleLabel};
function renderVolumeDash(){const el=$("#volumeDash");if(!el)return;
  const rows=volumeDashboard(7).map(r=>({[t("stats.table.muscle")]:muscleLabel(r.muscle),[t("stats.table.planned")]:fmt(r.planned),[t("stats.table.completed_7d")]:fmt(r.completed7),[t("stats.table.completed_28d")]:fmt(r.completed28),[t("stats.table.status")]:r.status}));
  el.innerHTML=table(rows)}
function renderCompleted(){const el=$("#completedVolume");if(!el)return;const m=completedHardSets(volWindow);
  const arr=[...m.entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff),max=Math.max(...arr.map(x=>x.eff),1);
  el.innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(muscleLabel(x.name))}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> ${esc(tp(x.eff,"set"))}</span></div>`).join(""):`<div class="table"><div class="empty">${esc(t("stats.empty.no_hard_sets",{n:volWindow}))}</div></div>`;
  $$("#volWindow button").forEach(b=>{const on=+b.dataset.win===volWindow;b.classList.toggle("active",on);b.setAttribute("aria-selected",on?"true":"false")});}

function chartLabelDecimals(rngKg){return toDisplay(rngKg/3)<1?1:0}
window.__repforgeChartLabelDecimals=chartLabelDecimals;
function chartPalette(){
  const css=getComputedStyle(document.documentElement);
  const tok=n=>(css.getPropertyValue(n)||"").trim();
  return{
    accent:tok("--accent")||"#E04E14",
    deep:tok("--accent-deep")||"#B8410E",
    text:tok("--ink-faint")||"#716D66",
    ink:tok("--ink")||"#1B1A17",
    rule:tok("--rule")||"#E4E1DA",
    bg:tok("--bg")||"#F4F2EF",
    surface:tok("--surface")||"#FFFFFF"
  }}
window.__repforgeChartPalette=chartPalette;
function draw(rows,sel="#chart"){
  const c=$(sel);if(!c)return;
  const ctx=c.getContext("2d"),w=c.clientWidth||320,h=240,ratio=devicePixelRatio||1;
  c.width=w*ratio;c.height=h*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const pal=chartPalette(),C={accent:pal.accent,steel:pal.text,dim:pal.text,rule:pal.rule,mist:pal.ink};
  const padL=42,padR=14,padT=22,padB=26,iw=w-padL-padR,ih=h-padT-padB;
  ctx.font='11px "Plex Sans",sans-serif';ctx.textBaseline="middle";
  if(!rows.length){ctx.fillStyle=C.steel;ctx.textAlign="center";ctx.fillText(t("stats.chart.empty"),w/2,h/2);return}
  const vals=rows.map(r=>r.e1rm??r.top),max=Math.max(...vals),min=Math.min(...vals),span=max-min||1,pad=span*0.25;
  const lo=Math.max(0,min-pad),hi=max+pad,rng=hi-lo||1;
  const X=i=>padL+(rows.length===1?iw/2:i*iw/(rows.length-1)),Y=v=>padT+ih-((v-lo)/rng)*ih;
  const decimals=chartLabelDecimals(rng),yLabel=v=>{const d=toDisplay(v);return decimals?fmt(+d.toFixed(1)):fmt(Math.round(d))};
  const accent=pal.accent;
  ctx.strokeStyle=C.rule;ctx.lineWidth=1;ctx.fillStyle=C.dim;ctx.textAlign="right";
  for(let i=0;i<=3;i++){const gy=padT+ih*i/3,val=hi-(rng*i/3);ctx.beginPath();ctx.moveTo(padL,gy);ctx.lineTo(w-padR,gy);ctx.stroke();ctx.fillText(yLabel(val)+` ${unitLabel()}`,padL-8,gy)}
  ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.lineJoin="round";ctx.lineCap="round";
  ctx.beginPath();rows.forEach((r,i)=>{const v=r.e1rm??r.top;i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke();
  rows.forEach((r,i)=>{const v=r.e1rm??r.top,last=i===rows.length-1;ctx.beginPath();ctx.arc(X(i),Y(v),last?4:3.5,0,7);
    ctx.fillStyle=accent;ctx.fill()});
  const lastV=rows.at(-1).e1rm??rows.at(-1).top,lx=X(rows.length-1),ly=Y(lastV);ctx.fillStyle=pal.deep;ctx.textAlign=lx>w-60?"right":"left";ctx.font='600 12px "Plex Sans",sans-serif';
  ctx.fillText(`${fmt(Math.round(toDisplay(lastV)))} ${unitLabel()}`,lx+(lx>w-60?-10:9),ly-12);
  ctx.fillStyle=C.dim;ctx.font='11px "Plex Sans",sans-serif';ctx.textBaseline="alphabetic";
  ctx.textAlign="left";ctx.fillText(shortDate(rows[0].date),padL,h-8);
  if(rows.length>2){ctx.textAlign="center";ctx.fillText(shortDate(rows[Math.floor(rows.length/2)].date),padL+iw/2,h-8)}
  ctx.textAlign="right";ctx.fillText(shortDate(rows.at(-1).date),w-padR,h-8);
}

function redrawChart(){
  if($("#exercise")?.classList.contains("active")&&exView){draw(summaries().filter(x=>x.liftKey===exView.key),"#exChart");return}
  if(!$("#stats").classList.contains("active")||statsSeg!=="overview")return;
  const sel=$("#statExercise").value,rows=summaries().filter(x=>x.liftKey===sel);draw(rows)}

const historyDiagnostics={enabled:false,builds:0,sourceRowVisits:0,last:null,onBuilt:null,
  reset(){this.enabled=true;this.builds=0;this.sourceRowVisits=0;this.last=null;this.onBuilt=null},
  disable(){this.enabled=false;this.last=null;this.onBuilt=null}};
const historyIndexCache=new WeakMap();
function buildHistoryIndex(log){
  const source=log||[];
  // Read the program's current movement names once per build; this is the only
  // thing in the index that depends on the program, and it is why historyIndexFor
  // still invalidates its cache when the program identity changes.
  const currentNames=currentMovementNames();
  const rows=[];
  const n=source.length;
  for(let i=0;i<n;i++){const raw=source[i];rows.push(raw&&typeof raw==="object"?raw:{})}
  const sessionMap=new Map();
  for(const row of rows){
    const sid=row&&row.session!=null?String(row.session):"";
    if(!sessionMap.has(sid))sessionMap.set(sid,{session:row.session,date:row.date,day:row.day,created:row.created,rows:[]});
    sessionMap.get(sid).rows.push(row)}
  for(const sess of sessionMap.values()){
    sess.rows.sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set)}
  const sessions=[...sessionMap.values()].sort((a,b)=>{
    const dd=String(b.date).localeCompare(String(a.date));return dd||String(b.created).localeCompare(String(a.created))});
  const liftChrono=new Map();
  for(const row of rows){
    if(!isWork(row)||!(+row.load>0)||!(+row.reps>0))continue;
    const k=liftKey(row);
    if(!liftChrono.has(k))liftChrono.set(k,new Map());
    const sm=liftChrono.get(k);
    if(!sm.has(row.session))sm.set(row.session,{session:row.session,date:row.date,created:row.created,rows:[]});
    sm.get(row.session).rows.push(row)}
  const liftPred=new Map();
  for(const[k,sm]of liftChrono){
    const ordered=[...sm.values()].sort((a,b)=>String(a.created).localeCompare(String(b.created))||String(a.date).localeCompare(String(b.date)));
    for(let i=0;i<ordered.length;i++){
      const cur=ordered[i],pred=i>0?ordered[i-1].rows:[];
      liftPred.set(`${cur.session}|${k}`,pred)}}
  for(const sess of sessions){
    const byLift=new Map();
    for(const r of sess.rows){
      if(!isWork(r)||!(+r.load>0)||!(+r.reps>0))continue;
      const k=liftKey(r);if(!byLift.has(k))byLift.set(k,[]);byLift.get(k).push(r)}
    const counts={improved:0,flat:0,regressed:0,new:0};
    for(const[k,liftRows]of byLift){
      const pred=liftPred.get(`${sess.session}|${k}`)||[];
      if(!pred.length){counts.new++;continue}
      const d=buildSessionDelta(pred,liftRows);if(d.status in counts)counts[d.status]++}
    sess.delta=counts;
    const names=new Set(sess.rows.map(r=>String(displayName(r)||"")));
    // Aliases are additive: the performed label always stays searchable, and
    // the current program name only widens what finds the session.
    const aliases=new Set();
    for(const r of sess.rows){const alias=currentNameForRow(r,currentNames);if(alias&&!names.has(alias))aliases.add(alias)}
    sess.searchText=`${String(sess.day||"")} ${dayLabel(sess.day)} ${[...names,...aliases].join(" ")}`.toLowerCase()}
  const prEvents=detectPRs(rows);
  const prDates=new Set(prEvents.map(ev=>String(ev.date)));
  const months=new Map();
  for(const row of rows){
    const date=String(row.date||""),ym=date.slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(ym))continue;
    if(!months.has(ym))months.set(ym,{sessions:new Set(),sets:0,byDay:new Map()});
    const bucket=months.get(ym);bucket.sessions.add(row.session);bucket.sets++;
    const dayNum=+date.slice(8,10);
    if(!bucket.byDay.has(dayNum))bucket.byDay.set(dayNum,{sets:0,pr:false});
    bucket.byDay.get(dayNum).sets++;
    if(prDates.has(date))bucket.byDay.get(dayNum).pr=true}
  const tableRows=[...rows].sort((a,b)=>String(b.date).localeCompare(String(a.date))||displayName(a).localeCompare(displayName(b))||a.set-b.set);
  const index={rows,sessions,months,prEvents,tableRows,liftPred};
  if(historyDiagnostics.enabled){
    historyDiagnostics.builds++;historyDiagnostics.sourceRowVisits+=rows.length;historyDiagnostics.last=index;
    if(typeof historyDiagnostics.onBuilt==="function")historyDiagnostics.onBuilt(index)}
  return index}
function historyIndexFor(log){
  const source=log||[];
  if(source&&typeof source==="object"){
    const cached=historyIndexCache.get(source);
    if(cached?.program===state.program)return cached.index;
    const index=buildHistoryIndex(source);
    historyIndexCache.set(source,{program:state.program,index});
    return index}
  return buildHistoryIndex(source)}
function searchHistoryIndex(index,query){
  const q=String(query||"").trim().toLowerCase(),sessions=index?.sessions||[];
  if(!q)return sessions.slice();
  return sessions.filter(s=>String(s.searchText||"").includes(q))}
function renderHistoryWithSource(source){renderHistory(source)}
window.__repforgeHistory={
  buildIndex:buildHistoryIndex,
  indexFor:historyIndexFor,
  searchIndex:searchHistoryIndex,
  renderWithSource:renderHistoryWithSource,
  diagnostics:historyDiagnostics};

function isHistorySearchOpen(){return!$("#historySearchWrap")?.classList.contains("hidden")}
function setHistorySearchOpen(open){
  if(!open&&histQuery.trim())return;
  $("#historySearchWrap")?.classList.toggle("hidden",!open);
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  if(open)$("#historySearch")?.focus()}
function clearHistorySearch(){
  histQuery="";
  const inp=$("#historySearch");if(inp)inp.value="";
  renderHistory();
  setHistorySearchOpen(false)}
function syncHistorySearchChrome(){
  const open=isHistorySearchOpen()||!!histQuery.trim();
  if(histQuery.trim())$("#historySearchWrap")?.classList.remove("hidden");
  $("#historySearchBtn")?.setAttribute("aria-expanded",open?"true":"false");
  const inp=$("#historySearch");if(inp&&inp.value!==histQuery)inp.value=histQuery}
async function deleteSession(sid,io=storageIO){
  const proposal=cloneSnapshot(state);
  proposal.log=proposal.log.filter(row=>row.session!==sid);
  const result=await commitProposedState(proposal,io);
  if(result.localOk||result.idbOk){
    if(editSession===sid)editSession=null;
    render();toast(t("toast.session_deleted"))}
  return result}

function renderHistory(source=state.log){
  if(!histMonth){const n=new Date();histMonth={y:n.getFullYear(),m:n.getMonth()}}
  const focusedToggle=document.activeElement?.matches?.("#sessions .session__open")?document.activeElement:null;
  const focusedSession=focusedToggle?.closest("[data-sess]")?.dataset.sess||null;
  const index=historyIndexFor(source);
  renderHistoryCalendar(index);
  const q=histQuery.trim();
  const sessions=searchHistoryIndex(index,q);
  syncHistorySearchChrome();
  let lastMonth="";
  $("#sessions").innerHTML=sessions.length?sessions.map(s=>{
    const sets=s.rows;
    if(s.session===editSession)return sessionEditor(s,sets);
    const work=sets.filter(isWork),vol=sum(work.map(x=>(+x.load||0)*(+x.reps||0)));
    const delta=s.delta||{improved:0,flat:0,regressed:0,new:0},deltaLine=hasDeltaSummary(delta)?`<div class="session__delta">${esc(formatDeltaCounts(delta))}</div>`:"";
    const mus=[...new Set(work.map(r=>String(r.primary||"").split(",")[0].trim()).filter(Boolean))].slice(0,3);
    const d=new Date(`${s.date}T12:00:00`);
    const monthKey=`${d.getFullYear()}-${d.getMonth()}`;
    let monthHdr="";
    if(monthKey!==lastMonth){lastMonth=monthKey;monthHdr=`<p class="section-label">${esc(t("month."+d.getMonth()).toUpperCase())}</p>`}
    const eyebrow=esc(t("history.session_eyebrow",{weekday:t("weekday."+d.getDay()),day:d.getDate(),month:t("month_short."+d.getMonth())}));
    // The card is the way in. It used to be a disclosure whose panel held one
    // link to the session — a tap to reveal a tap — and the panel was drawn on
    // every row regardless, because `display:flex` outranks the `hidden` it
    // carried. Deleting a session already moved inside the session, so nothing
    // is left for a row to reveal and the whole card opens it.
    return monthHdr+`<article class="hist-row session" data-sess="${esc(s.session)}">`+
      `<button type="button" class="session__open" data-edit="${esc(s.session)}" aria-label="${esc(t("history.session_open_aria",{day:dayLabel(s.day)}))}">`+
      `<div class="session__info"><div class="hist-eyebrow">${eyebrow}</div><div class="session__day hist-row__title">${esc(dayLabel(s.day))}</div>`+
      (mus.length?`<div class="session__sub">${esc(mus.map(muscleLabel).join(" · "))}</div>`:"")+
      `<div class="session__sub">${esc(t("history.session_meta",{sets:sets.length,vol:kfmt(toDisplay(vol)),unit:unitLabel()}))}</div>${deltaLine}`+
      `</div><span class="chevron" aria-hidden="true"></span></button></article>`;
  }).join(""):`<div class="table"><div class="empty" data-hist-empty="${q?"nomatch":"none"}">${esc(t(q?"history.empty.no_match":"history.empty.sessions"))}</div></div>`;
  if(focusedSession){
    const next=$$("#sessions .session__open").find(btn=>btn.closest("[data-sess]")?.dataset.sess===focusedSession);
    if(next&&canTakeFocus(next)){try{next.focus({preventScroll:true})}catch{try{next.focus()}catch{}}}}
  $$("#sessions [data-del]").forEach(b=>b.onclick=async e=>{e.stopPropagation();if(confirm(t("confirm.delete_session")))await deleteSession(b.dataset.del)});
  $$("#sessions [data-edit]").forEach(b=>b.onclick=e=>{e.stopPropagation();editSession=b.dataset.edit;renderHistory()});
  $$("[data-edcancel]").forEach(b=>b.onclick=()=>{editSession=null;renderHistory()});
  $$("[data-edsave]").forEach(b=>b.onclick=()=>saveSessionEdit(b.dataset.edsave));
  $$("[data-edrm]").forEach(b=>b.onclick=e=>{e.stopPropagation();
    const row=b.closest(".edrow"),card=b.closest(".session--edit");if(!row||!card)return;
    const removing=!row.classList.contains("is-removed");
    if(removing){
      const left=[...card.querySelectorAll(".edrow[data-edidx]:not(.is-removed)")];
      if(left.length<=1){toast(t("history.edit.keep_one"));return}
      row.classList.add("is-removed");setEdrowRmState(b,true);
      row.querySelectorAll(".edrow__in").forEach(inp=>{inp.disabled=true;inp.removeAttribute("aria-invalid")})}
    else{row.classList.remove("is-removed");setEdrowRmState(b,false);
      row.querySelectorAll(".edrow__in").forEach(inp=>inp.disabled=false)}});
  const rows=index.tableRows.map(x=>({[t("stats.table.date")]:x.date,[t("stats.table.day")]:dayLabel(x.day),[t("stats.table.exercise")]:displayName(x),[t("stats.table.set")]:x.warmup?"W"+x.set:x.set,[unitLabel()]:fmtLoad(x.load),[t("stats.table.reps")]:x.reps,[t("stats.table.rir")]:fmt(x.rir)}));
  $("#historyTable").innerHTML=table(rows);
}
function renderHistoryCalendar(index){const el=$("#historyCalendar");if(!el)return;
  const {y,m}=histMonth,first=new Date(y,m,1),startDow=(first.getDay()+6)%7;
  const daysInMonth=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
  const ym=`${y}-${String(m+1).padStart(2,"0")}`;
  const month=index?.months?.get(ym)||{sessions:new Set(),sets:0,byDay:new Map()};
  const byDay=month.byDay;
  const sessCount=month.sessions.size,setCount=month.sets;
  const letters=weekdayLetters();
  // Monday-start letters already match weekdayLetters
  let cells=letters.map(l=>`<div class="cal-grid__dow">${esc(l)}</div>`).join("");
  for(let i=0;i<42;i++){let dayNum,out=false,iso;
    if(i<startDow){dayNum=prevDays-startDow+i+1;out=true;const pm=m===0?11:m-1,py=m===0?y-1:y;iso=`${py}-${String(pm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else if(i-startDow>=daysInMonth){dayNum=i-startDow-daysInMonth+1;out=true;const nm=m===11?0:m+1,ny=m===11?y+1:y;iso=`${ny}-${String(nm+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    else{dayNum=i-startDow+1;iso=`${y}-${String(m+1).padStart(2,"0")}-${String(dayNum).padStart(2,"0")}`}
    const info=!out&&byDay.get(dayNum),isToday=iso===today();
    let mark="";if(info?.pr)mark=`<span class="cal-grid__mark is-pr"></span>`;else if(info)mark=`<span class="cal-grid__mark is-check">✓</span>`;else if(isToday)mark=`<span class="cal-grid__mark is-today"></span>`;
    cells+=`<div class="cal-grid__day${out?" is-out":""}">${dayNum}${mark}</div>`;
    if(i===41)break;if(i>=startDow+daysInMonth-1&&(i+1)%7===0)break}
  el.innerHTML=`<div class="cal-head"><button type="button" class="icon-btn icon-btn--ghost" id="calPrev" aria-label="${esc(t("history.calendar_prev_aria"))}">‹</button>`+
    `<div class="cal-head__title">${esc(t("history.month_title",{month:(()=>{const s=t("month."+m);return s?s.charAt(0).toUpperCase()+s.slice(1):s})(),year:y}))}</div>`+
    `<button type="button" class="icon-btn icon-btn--ghost" id="calNext" aria-label="${esc(t("history.calendar_next_aria"))}">›</button></div>`+
    `<div class="cal-summary">${esc(t("history.month_summary",{sessions:sessCount,sets:setCount}))}</div>`+
    `<div class="cal-grid">${cells}</div>`;
  $("#calPrev").onclick=()=>{if(histMonth.m===0){histMonth={y:histMonth.y-1,m:11}}else histMonth={y:histMonth.y,m:histMonth.m-1};renderHistory()};
  $("#calNext").onclick=()=>{if(histMonth.m===11){histMonth={y:histMonth.y+1,m:0}}else histMonth={y:histMonth.y,m:histMonth.m+1};renderHistory()}}


const EDROW_RM_GLYPH={remove:"×",undo:"↺"};
// The per-row remove control is icon-only, so its state lives in the glyph plus
// the accessible name rather than visible copy.
function setEdrowRmState(btn,removed){
  const label=t(removed?"history.edit.undo_remove":"history.edit.remove_set");
  btn.setAttribute("aria-label",label);btn.title=label;btn.classList.toggle("is-undo",removed);
  const glyph=btn.querySelector(".edrow__rm-glyph")||btn;
  glyph.textContent=removed?EDROW_RM_GLYPH.undo:EDROW_RM_GLYPH.remove}

function sessionEditor(s,sets){
  const rows=sets.map((r,i)=>{
    return `<div class="edrow" data-edidx="${i}"><span class="edrow__name">${esc(displayName(r))} <small>#${r.set}</small></span>`+
      `<input class="edrow__in" data-ek="load|${i}" type="text" inputmode="decimal" enterkeyhint="next" value="${esc(fmtLoadPlain(r.load))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${unitLabel()}">`+
      `<input class="edrow__in" data-ek="reps|${i}" type="text" inputmode="numeric" enterkeyhint="next" value="${esc(r.reps)}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("log.reps"))}">`+
      `<input class="edrow__in" data-ek="rir|${i}" type="text" inputmode="decimal" enterkeyhint="done" value="${esc(fmt(r.rir))}" aria-label="${esc(displayName(r))} ${esc(t("log.set").toLowerCase())} ${r.set} ${esc(t("glossary.term.RIR"))}">`+
      `<button type="button" class="edrow__rm" data-edrm="${i}" aria-label="${esc(t("history.edit.remove_set"))}" title="${esc(t("history.edit.remove_set"))}"><span class="edrow__rm-glyph" aria-hidden="true">${EDROW_RM_GLYPH.remove}</span></button></div>`}).join("");
  return `<div class="session session--edit" data-editing="${esc(s.session)}">`+
    `<div class="edhead"><div class="session__day">${esc(dayLabel(s.day))}</div>`+
    `<label class="edate">${esc(t("stats.table.date"))}<input data-ed="date" type="date" value="${esc(s.date)}"></label></div>`+
    `<div class="edrow edrow--head"><span>${esc(t("log.set"))}</span><span>${unitLabel()}</span><span>${esc(t("log.reps"))}</span><span>${esc(t("glossary.term.RIR"))}</span><span></span></div>`+rows+
    `<div class="edbtns"><button type="button" class="btn btn--steel" data-edcancel="1">${esc(t("history.edit.cancel"))}</button>`+
    `<button type="button" class="btn btn--cta" data-edsave="${esc(s.session)}">${esc(t("history.edit.save"))}</button></div>`+
    // Where the whole session can be thrown away: behind the way in, under the
    // edits, and named in full so the row it deletes is never in doubt.
    `<div class="edrisk"><button type="button" class="session__del" data-del="${esc(s.session)}">${esc(t("history.session.delete"))}</button></div></div>`;
}

function sessionSetsForEdit(sid){
  return state.log.filter(r=>r.session===sid).sort((a,b)=>String(displayName(a)).localeCompare(String(displayName(b)))||a.set-b.set)}

async function saveSessionEdit(sid,io=storageIO){const card=$(`.session--edit[data-editing="${sid}"]`);if(!card)return;
  clearFieldInvalid(card);
  const dateEl=card.querySelector('[data-ed="date"]'),dateP=parseCalendarDate(dateEl?.value);
  if(dateP.field){if(dateEl){dateEl.setAttribute("aria-invalid","true");try{dateEl.focus()}catch{}}toast(t(dateP.key));return}
  const orig=sessionSetsForEdit(sid),proposed=[];
  for(const rowEl of card.querySelectorAll(".edrow[data-edidx]")){
    if(rowEl.classList.contains("is-removed"))continue;
    const i=+rowEl.dataset.edidx,src=orig[i];if(!src)continue;
    const loadEl=rowEl.querySelector('[data-ek^="load|"]'),repsEl=rowEl.querySelector('[data-ek^="reps|"]'),rirEl=rowEl.querySelector('[data-ek^="rir|"]');
    const loadP=parseLoadDisplay(loadEl?.value);
    if(loadP.field){if(loadEl){loadEl.setAttribute("aria-invalid","true");try{loadEl.focus()}catch{}}toast(t(loadP.key));return}
    const repsP=parseRepsValue(repsEl?.value);
    if(repsP.field){if(repsEl){repsEl.setAttribute("aria-invalid","true");try{repsEl.focus()}catch{}}toast(t(repsP.key));return}
    const rirP=parseRirValue(rirEl?.value);
    if(rirP.field){if(rirEl){rirEl.setAttribute("aria-invalid","true");try{rirEl.focus()}catch{}}toast(t(rirP.key));return}
    const next=cloneSnapshot(src);
    next.load=loadP.value;next.reps=repsP.value;next.rir=rirP.value;next.date=dateP.value;
    proposed.push(next)}
  if(!proposed.length){toast(t("history.edit.keep_one"));return}
  const proposal=cloneSnapshot(state);
  proposal.log=proposal.log.filter(r=>r.session!==sid).concat(proposed);
  const result=await commitProposedState(proposal,io);
  if(result.localOk||result.idbOk){editSession=null;render();toast(t("toast.session_updated"))}
  return result}
window.__repforgeSaveSessionEdit=saveSessionEdit;

// ---- Exercise detail: one lift's stats, session history and session notes ----
// Reached by tapping an exercise name on the Log tab; not part of the bottom nav.
function exerciseSessionsDetail(key){const m=new Map();
  for(const r of state.log){if(liftKey(r)!==key)continue;
    if(!m.has(r.session))m.set(r.session,{session:r.session,date:r.date,day:r.day,created:r.created,rows:[],note:""});
    const e=m.get(r.session);e.rows.push(r);
    if(!e.note&&String(r.exNote||"").trim())e.note=String(r.exNote).trim()}
  return [...m.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.created).localeCompare(String(b.created)))}

function currentViewId(){return $$(".view").find(v=>v.classList.contains("active"))?.id||"log"}
function openExerciseView(key,from){if(!key)return;
  const slot=prog.find(key),movement=slot?(workoutActive?sessionExercise(slot):slot):null;
  exView={key:movement?exerciseLiftKey(movement):key,from:from||currentViewId(),exercise:movement?Object.assign({},movement):null};
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="exercise"));
  document.body.classList.add("is-exercise");document.body.classList.remove("is-settings","is-onboarding","is-workout");
  window.scrollTo({top:0});renderExerciseView()}
function closeExerciseView(){const back=exView?.from||"log";exView=null;
  document.body.classList.remove("is-exercise");
  if(back==="settings"){showSettings();return}
  $$("nav button").forEach(x=>{const on=x.dataset.view===back;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===back));
  window.scrollTo({top:0});render()}
function openSettingsView(){showSettings()}

function renderExerciseView(){const el=$("#exDetail");if(!el||!exView)return;
  const key=exView.key,tmpl=currentExerciseForLiftKey(key)||exView.exercise||null,sessions=exerciseSessionsDetail(key);
  const latest=sessions.at(-1)?.rows.at(-1);
  const name=latest?displayName(latest):(tmpl?.name||key);
  const exRef=tmpl||(latest?exerciseIdentityFromRow(latest):null);
  const backKey=exView.from==="stats"?"nav.stats":exView.from==="program"?"nav.program":exView.from==="history"?"nav.history":"nav.log";
  const back=$("#exBack");if(back)back.textContent=`‹ ${t(backKey)}`;

  /* Unlike a list thumbnail this drawing is the only place the lifter can see
     how the movement is set up, so it gets a describing alt and no lazy hint —
     it is above the fold. Movements without licensed artwork render nothing at
     all; a placeholder tile would only promise something that never arrives. */
  const artEntry=exerciseRefEntry(exRef),artSrc=exerciseMedia(artEntry);
  const artBg=artSrc?exerciseMediaBg(artEntry):null;
  const artHtml=artSrc?`<div class="exdet-art"`+
    (artBg?` style="--exercise-art-bg:${esc(artBg)}"`:"")+`><div class="exdet-art__figure">`+
    `<img class="exdet-art__img" src="${esc(artSrc)}" alt="${esc(t("preview.art_alt",{name}))}" `+
    `decoding="async" width="768" height="768"></div></div>`:"";

  const rec=tmpl?recommendation(tmpl):null;
  const recHtml=rec?`<div class="recblock is-${rec.status}"><div class="recblock__row"><div><div class="recblock__lab">${esc(t("today.recommendation"))}</div>`+
    `<div class="recblock__head">${esc(rec.load!=null?t("today.rec_keep",{load:fmtLoad(rec.load),unit:unitLabel()}):rec.label)}</div>`+
    `<p class="recblock__body">${esc(rec.text)}</p></div>`+
    `<button type="button" class="link-accent" data-term="RIR">${esc(t("exercise.understand"))}</button>`+
    (rec.status!=="new"?`<button type="button" class="text-link recblock__why" data-why="${esc(tmpl.id)}" aria-label="${esc(t("why.open_aria",{name}))}">${esc(t("why.open"))}</button>`:"")+
    `</div></div>`:"";

  const work=state.log.filter(r=>liftKey(r)===key&&isWork(r));
  const topLoad=Math.max(0,...work.map(r=>+r.load||0));
  const bestE=work.length?Math.max(...work.map(r=>e1rm(+r.load,+r.reps))):0;
  const prCount=detectPRs(state.log).filter(ev=>ev.liftKey===key).length;
  const lcFirst=s=>s?s.charAt(0).toLowerCase()+s.slice(1):s;
  const tiles=[
    {label:lcFirst(t("stats.metric.sessions")),val:sessions.length},
    {label:t("exercise.top_load"),val:topLoad?`${fmtLoad(topLoad)} ${unitLabel()}`:"—"},
    {label:lcFirst(t("stats.metric.best_e1rm")),val:bestE?`${fmt(Math.round(toDisplay(bestE)))} ${unitLabel()}`:"—"},
    {label:t("stats.metric.prs"),val:prCount},
  ];
  const sums=summaries().filter(x=>x.liftKey===key);
  const prEvents=detectPRs(state.log).filter(ev=>ev.liftKey===key).reverse();
  const loadPr=prEvents.find(e=>e.kind==="load"),e1Pr=prEvents.find(e=>e.kind==="e1rm");
  const historyHtml=sessions.length?[...sessions].reverse().slice(0,8).map(s=>{
    const best=[...s.rows].filter(isWork).sort((a,b)=>+b.load-+a.load||+b.reps-+a.reps)[0];
    const cmp=exRef?compareExerciseSession(exRef,s.rows):null;
    const note=s.note?`<p class="exsess__note">${esc(s.note)}</p>`:"";
    return `<div class="exsess"><div class="exsess__head"><span class="exsess__date">${esc(shortDate(s.date))}</span>`+
      (best?`<span class="exsess__set">${fmtLoad(best.load)} × ${best.reps}</span><span class="exsess__day">RIR ${fmt(best.rir)}</span>`:"")+
      (cmp&&cmp.status!=="not_comparable"?`<span class="exsess__delta">${esc(cmp.label)}</span>`:"")+`</div>${note}</div>`}).join("")
    :`<div class="empty">${esc(t("exercise.empty.no_sets"))}</div>`;

  el.innerHTML=`<p class="exdet__muscle">${esc(muscleListLabel(tmpl?.primary||""))}</p><h2 class="exdet__name">${esc(name)}</h2>`+
    `<p class="exdet__meta">${tmpl?`${esc(dayLabel(tmpl.day))} · ${tmpl.sets} × ${tmpl.min}–${tmpl.max} ${esc(t("log.reps"))} · RIR 0–${fmt(state.settings.rirHigh)}`:esc(t("exercise.not_in_program"))}</p>`+
    artHtml+
    recHtml+
    `<div class="statrow statrow--4 exdet__stats">${tiles.map(tile=>`<div class="statrow__cell"><div class="statrow__val">${tile.val}</div><div class="statrow__cap">${tile.label}</div></div>`).join("")}</div>`+
    `<p class="section-label section-label--row"><span>${esc(t("exercise.progression"))}</span><span class="range-static">${esc(t("exercise.range_12w"))}</span></p>`+
    `<p class="lede">${esc(t("stats.e1rm_caption"))}</p>`+
    `<div class="chart-wrap"><canvas id="exChart" height="240" aria-label="${esc(t("exercise.chart_aria",{name}))}"></canvas></div>`+
    `<p class="section-label">${esc(t("exercise.records"))}</p>`+
    (loadPr?`<div class="listrow listrow--static"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.load"))}</div><div class="listrow__sub">${fmtLoad(loadPr.load)} ${unitLabel()} × ${loadPr.reps}</div></div><span class="listrow__meta">${esc(shortDate(loadPr.date))}</span></div>`:"")+
    (e1Pr?`<div class="listrow listrow--static"><div class="listrow__main"><div class="listrow__title">${esc(t("stats.pr.e1rm"))}</div><div class="listrow__sub">${fmt(Math.round(toDisplay(e1rm(e1Pr.load,e1Pr.reps))))} ${unitLabel()}</div></div><span class="listrow__meta">${esc(shortDate(e1Pr.date))}</span></div>`:"")+
    `<button type="button" class="link-row-cta" id="exSeePrs"><span>${esc(t("exercise.see_all_prs"))}</span><span class="chevron" aria-hidden="true"></span></button>`+
    `<p class="section-label">${esc(t("exercise.recent_sessions"))}</p><div class="exsessions">${historyHtml}</div>`;
  draw(sums,"#exChart");
  $$("#exDetail [data-term]").forEach(b=>b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)});
  $$("#exDetail [data-why]").forEach(b=>b.onclick=e=>{e.stopPropagation();openWhySheetFor(tmpl,b)});
  const see=$("#exSeePrs");if(see)see.onclick=()=>{closeExerciseView();navTo("stats");setStatsSeg("prs")}}

function renderProgram(){renderProgramOverview();renderProgramHeader();renderProgramEditor();renderVolume();
  const ov=$("#programOverview"),ed=$("#programEditorWrap"),tog=$("#programEditToggle"),meta=$("#programMeta");
  if(ov)ov.classList.toggle("is-hidden",programEditMode);
  if(ed)ed.classList.toggle("is-hidden",!programEditMode);
  if(meta)meta.classList.toggle("visually-hidden",!programEditMode);
  if(tog)tog.textContent=programEditMode?t("program.done_edit"):t("program.edit")}
function renderProgramOverview(){const el=$("#programOverview");if(!el)return;
  const meta=state.programMeta||defaultProgramMeta(state.log),mc=mesocycleWeek(),ad=programAdherence(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const ds=prog.days(),goal=meta.goal?t("onb.goal."+meta.goal+".label")||meta.goal:"";
  const segs=mc.total||6,cur=mc.current||0;
  const started=meta.started?(()=>{const d=new Date(`${meta.started}T12:00:00`);return t("program.started_on",{date:`${d.getDate()} ${t("month_short."+d.getMonth())}`})})():"";
  let daysHtml=`<p class="section-label">${esc(t("program.training_days"))}</p>`;
  // A saved array — including an empty one — means the user picked; only an absent pref falls back to the first day.
  const saved=Array.isArray(uiPrefs.overviewOpenDays)?uiPrefs.overviewOpenDays.filter(x=>typeof x==="string"):null;
  const openDays=new Set(saved||(ds.length?[ds[0]]:[]));
  for(const d of ds){const exs=prog.forDay(d),sets=sum(exs.map(e=>e.sets)),mus=dayMuscles(d),open=openDays.has(d);
    daysHtml+=`<div class="prog-day"><button type="button" class="prog-day__head" data-ovday="${esc(d)}" aria-expanded="${open?"true":"false"}"><div>`+
      `<div class="prog-day__title">${esc(dayLabel(d))}</div>${mus.length?`<div class="prog-day__muscles">${esc(mus.map(muscleLabel).join(" · "))}</div>`:""}</div>`+
      `<div class="prog-day__right">${esc(t("program.day_meta",{ex:exs.length,sets}))}<span class="chevron${open?" is-up":""}" aria-hidden="true"></span></div></button>`;
    if(open){daysHtml+=`<div class="prog-day__body">${exs.map(e=>`<button type="button" class="prog-ex" data-exopen="${esc(e.id)}"><span>${esc(e.name)}</span><span class="prog-ex__sets">${e.sets} × ${e.min}–${e.max}</span></button>`).join("")}`+
      `<button type="button" class="link-row-cta" data-ovdetails="${esc(d)}"><span>${esc(t("program.see_details"))}</span><span class="chevron" aria-hidden="true"></span></button></div>`}
    daysHtml+=`</div>`}
  const planned=prog.volume();let plannedTotal=0;for(const[,v] of planned)plannedTotal+=v.d+v.p;
  el.innerHTML=`<div class="prog-overview__name">${esc(meta.name||t("untitled_program"))}</div>`+
    `<div class="prog-overview__meta">${[goal,t("program.days_per_week",{n:ds.length})].filter(Boolean).join(" · ")}</div>`+
    (mc.current!=null||mc.isComplete?`<div class="prog-overview__week">${esc(mesocycleWeekCopy(mc))}</div>`+
      `<div class="segbar">${Array.from({length:segs},(_,i)=>`<span class="segbar__seg${i<Math.min(cur,segs)?" is-done":""}"></span>`).join("")}</div>`:"")+
    (started?`<div class="prog-overview__started">${esc(started)}</div>`:"")+
    `<div class="statrow">`+
    `<div class="statrow__cell"><div class="statrow__val">${ad.logged} / ${ad.total}</div><div class="statrow__cap">${esc(t("program.stat.days_7d"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${health?.hot||0}</div><div class="statrow__cap">${esc(t("program.stat.ready"))}</div></div>`+
    `<div class="statrow__cell"><div class="statrow__val">${vol?Math.round(vol.ratio*100)+"%":"—"}</div><div class="statrow__cap">${esc(t("program.stat.volume"))}</div></div>`+
    `</div>${daysHtml}`+
    `<p class="section-label">${esc(t("program.planned_volume_label"))}</p>`+
    `<button type="button" class="listrow" id="seeVolumeAudit"><div class="listrow__main"><div class="listrow__title">${esc(t("program.effective_sets",{n:fmt(plannedTotal)}))}</div></div>`+
    `<span class="listrow__meta">${esc(t("program.see_audit"))}<span class="chevron" aria-hidden="true"></span></span></button>`+
    // Nothing to read out when the program has no days left, so the row waits for one.
    (ds.length?`<button type="button" class="listrow" id="exportProgramText"><div class="listrow__main"><div class="listrow__title">${esc(t("program.export_text"))}</div>`+
      `<div class="listrow__sub">${esc(t("program.export_text.sub"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`:"")+
    (ds.length?`<button type="button" class="listrow" id="shareProgramSetup"><div class="listrow__main"><div class="listrow__title">${esc(t("program.share_setup"))}</div>`+
      `<div class="listrow__sub">${esc(t("program.share_setup_sub"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`:"")+
    `<button type="button" class="listrow" id="reviewBlockLink" style="border-bottom:0"><div class="listrow__main"><div class="listrow__title">${esc(t("program.review_block"))}</div></div><span class="chevron" aria-hidden="true"></span></button>`;
  $$("#programOverview [data-ovday]").forEach(b=>b.onclick=()=>{
    const cur=new Set(openDays);
    cur.has(b.dataset.ovday)?cur.delete(b.dataset.ovday):cur.add(b.dataset.ovday);
    setUiPref("overviewOpenDays",[...cur].filter(x=>ds.includes(x)));renderProgramOverview()});
  $$("#programOverview [data-exopen]").forEach(b=>b.onclick=()=>{if(b.dataset.exopen)openExerciseView(b.dataset.exopen,"program")});
  $$("#programOverview [data-ovdetails]").forEach(b=>b.onclick=()=>openDayInEditor(b.dataset.ovdetails));
  const audit=$("#seeVolumeAudit");if(audit)audit.onclick=()=>{programEditMode=true;renderProgram();$("#volume")?.scrollIntoView({behavior:"smooth"})};
  const asText=$("#exportProgramText");if(asText)asText.onclick=openProgramTextSheet;
  const shareSetup=$("#shareProgramSetup");if(shareSetup)shareSetup.onclick=openShareSetupSheet;
  const rev=$("#reviewBlockLink");if(rev)rev.onclick=promptEndBlock}

function openDayInEditor(d){if(!d||!prog.days().includes(d))return;
  setDayCollapsed(d,false);programEditMode=true;renderProgram();
  $(`#programEditor .pday[data-day="${CSS.escape(d)}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})}

function renderProgramChips(){
  const top=$("#pmetaChipsTop"),bottom=$("#pmetaChipsBottom");if(!top||!bottom)return;
  const ad=programAdherence(),mc=mesocycleWeek(),health=programProgressionHealth(),vol=programVolumeCompliance();
  const status=programStatusLabel(ad,health);
  const weekChip=(mc.current!=null||mc.isComplete)?`<span class="pmeta__chip">${esc(mesocycleWeekCopy(mc,"program.week_chip"))}</span>`:"";
  const healthChip=health?`<span class="pmeta__chip">${esc(t("program.ready_chip",{done:health.hot,total:health.total}))}</span>`:"";
  const volChip=vol?`<span class="pmeta__chip">${esc(t("program.volume_chip",{pct:Math.round(vol.ratio*100)}))}</span>`:"";
  top.innerHTML=`${weekChip}<span class="pmeta__chip pmeta__chip--status">${esc(status)}</span>`;
  bottom.innerHTML=`<span class="pmeta__chip">${esc(t("program.days_last_7",{done:ad.logged,planned:ad.total}))}</span>${healthChip}${volChip}`;
}

function renderProgramHeader(){
  const el=$("#programMeta");if(!el)return;
  if(document.activeElement?.closest("#programMeta"))return;
  const meta=state.programMeta||defaultProgramMeta(state.log);
  el.innerHTML=
    `<div class="pmeta__row">`+
      `<label class="pmeta__name">${esc(t("program.name"))}<input id="programName" type="text" value="${esc(meta.name)}" placeholder="${esc(t("program.name.placeholder"))}" aria-label="${esc(t("program.name_aria"))}"></label>`+
      `<div id="pmetaChipsTop" class="pmeta__chips"></div>`+
    `</div>`+
    `<div class="pmeta__row">`+
      `<label class="pmeta__started">${esc(t("program.started"))}<input id="programStarted" type="date" value="${esc(meta.started||"")}" aria-label="${esc(t("program.started_aria"))}"></label>`+
      `<div id="pmetaChipsBottom" class="pmeta__chips"></div>`+
    `</div>`;
  renderProgramChips();
  const nameInp=$("#programName"),startInp=$("#programStarted");
  nameInp.oninput=async()=>{const captured=nameInp.value,result=await persistProgramMeta({name:captured});
    if(!(result.localOk||result.idbOk)&&nameInp.value===captured)nameInp.value=state.programMeta?.name||""};
  startInp.onchange=async()=>{const captured=startInp.value,result=await persistProgramMeta({started:captured||null});
    if(result.localOk||result.idbOk)renderProgramChips();
    else if(startInp.value===captured)startInp.value=state.programMeta?.started||""};
}

// Collapsed program days live in UI prefs so the state survives reloads without touching training data.
function collapsedProgramDays(){const v=uiPrefs.collapsedProgramDays;return Array.isArray(v)?v.filter(x=>typeof x==="string"):[]}
function setDayCollapsed(d,on){const cur=new Set(collapsedProgramDays());
  on?cur.add(d):cur.delete(d);
  setUiPref("collapsedProgramDays",[...cur].filter(x=>prog.days().includes(x)))}
function renameCollapsedDay(oldName,newName){const cur=collapsedProgramDays();
  if(!cur.includes(oldName))return;
  setUiPref("collapsedProgramDays",cur.map(x=>x===oldName?newName:x))}

/* The raw JSON box is the one field a lifter types a whole document into, so a
   render() firing mid-edit used to throw the draft away — every route into
   render() (collapsing a day, a rest tick, a cross-tab write) reset the
   textarea. Hold unsaved text while the program itself is unchanged; a real
   program change is the newer edit and wins. force is for the two flows that
   just consumed the box (Save JSON, import) and want the normalised result. */
let programJsonSynced=null;
function syncProgramJson({force=false}={}){
  const box=$("#programJson");if(!box)return;
  const next=JSON.stringify(prog.toJSON(),null,2);
  if(!force){
    if(document.activeElement===box)return;
    if(next===programJsonSynced&&box.value!==programJsonSynced)return}
  programJsonSynced=next;box.value=next}

function renderProgramEditor(){
  const ds=prog.days();
  $("#programEditor").innerHTML=ds.length
    ?ds.map(dayCard).join("")
    :`<div class="table"><div class="empty">${esc(t("program.empty.days"))}</div></div>`;
  syncProgramJson();
  bindEditor();
}

function dayCard(d){
  const exs=prog.forDay(d),sets=sum(exs.map(e=>e.sets));
  const isCollapsed=collapsedProgramDays().includes(d);
  const body=exs.length
    ?exs.map((e,i)=>exCard(e,i,exs.length)).join("")
    :`<p class="pday__empty">${esc(t("program.empty.exercises"))}</p>`;
  return `<div class="pday${isCollapsed?" is-collapsed":""}" data-day="${esc(d)}">`+
    `<div class="pday__head">`+
      `<input class="pday__name" data-act="renameDay" data-day="${esc(d)}" value="${esc(dayLabel(d))}" aria-label="${esc(t("program.day.name_aria"))}">`+
      `<span class="pday__count">${esc(t("program.day.count",{n:exs.length,sets}))}</span>`+
      `<button class="iconbtn iconbtn--del" type="button" data-act="delDay" data-day="${esc(d)}" title="${esc(t("program.day.delete_title"))}" aria-label="${esc(t("program.day.delete_aria",{day:dayLabel(d)}))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `<button class="iconbtn pday__caret" type="button" data-act="toggleDay" data-day="${esc(d)}" aria-expanded="${isCollapsed?"false":"true"}" title="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:dayLabel(d)}))}" aria-label="${esc(t(isCollapsed?"program.day.expand":"program.day.collapse",{day:dayLabel(d)}))}"><span class="icon-mask icon-mask--sm icon-mask--chev-down" aria-hidden="true"></span></button>`+
    `</div>`+
    `<div class="pexlist">${body}</div>`+
    `<button class="btn btn--steel pday__add" type="button" data-act="addEx" data-day="${esc(d)}">${esc(t("program.day.add_exercise"))}</button>`+
  `</div>`;
}

function exCard(e,i,n){
  const num=(f,label)=>`<label class="pex__num">${label}<input type="number" inputmode="numeric" min="1" step="1" data-id="${e.id}" data-field="${f}" value="${esc(e[f])}"></label>`;
  // The name stays an editable field — a slot can be renamed to what the plate
  // on the machine says — with the library one tap away beside it.
  const linked=e.libraryId?libraryEntry(e.libraryId):null;
  return `<div class="pex" data-id="${esc(e.id)}">`+
    `<div class="pex__head">`+
      `<input class="pex__name" data-id="${esc(e.id)}" data-field="name" value="${esc(e.name)}" placeholder="${esc(t("program.exercise.name_placeholder"))}" aria-label="${esc(t(linked?"program.exercise.alias_aria":"program.exercise.name_aria"))}">`+
      `<button class="iconbtn pex__swap${linked?"":" is-unlinked"}" type="button" data-act="changeEx" data-id="${esc(e.id)}" title="${esc(t("program.exercise.change_title"))}" aria-label="${esc(t("program.exercise.change_aria",{name:e.name}))}"><span class="icon-mask icon-mask--sm icon-mask--search" aria-hidden="true"></span></button>`+
      `<div class="pex__move">`+
        `<button class="iconbtn" type="button" data-act="up" data-id="${esc(e.id)}"${i===0?" disabled":""} aria-label="${esc(t("program.exercise.move_up"))}">▲</button>`+
        `<button class="iconbtn" type="button" data-act="down" data-id="${esc(e.id)}"${i===n-1?" disabled":""} aria-label="${esc(t("program.exercise.move_down"))}">▼</button>`+
        `<button class="iconbtn iconbtn--del" type="button" data-act="delEx" data-id="${esc(e.id)}" aria-label="${esc(t("program.exercise.delete_aria"))}"><span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
      `</div>`+
    `</div>`+
    `<div class="pex__nums">${num("sets",esc(t("program.exercise.sets")))}${num("min",esc(t("program.exercise.min_reps")))}${num("max",esc(t("program.exercise.max_reps")))}</div>`+
    // Muscles belong to the definition while a slot is linked. Showing them
    // read-only with a way out beats letting an edit silently contradict the id.
    `<label class="pex__mus">${esc(t("program.exercise.primary"))}<input data-id="${esc(e.id)}" data-field="primary" value="${esc(e.primary)}" placeholder="${esc(t("program.exercise.primary_placeholder"))}"${linked?" readonly":""}></label>`+
    `<label class="pex__mus">${esc(t("program.exercise.secondary"))}<input data-id="${esc(e.id)}" data-field="secondary" value="${esc(e.secondary)}" placeholder="${esc(t("program.exercise.secondary_placeholder"))}"${linked?" readonly":""}></label>`+
    (linked?`<p class="pex__linked">${esc(t("program.exercise.linked",{name:libraryName(linked)}))} `+
      `<button type="button" class="pex__detach" data-act="detachEx" data-id="${esc(e.id)}">${esc(t("program.exercise.detach"))}</button></p>`:"")+
    `<label class="pex__mus">${esc(t("program.exercise.setup_notes"))}<input data-id="${esc(e.id)}" data-field="notes" value="${esc(e.notes)}" placeholder="${esc(t("program.exercise.setup_notes_placeholder"))}"></label>`+
    `<div class="pex__alts">`+
      `<span class="pex__altlab">${esc(t("program.exercise.alternates"))}</span>`+
      `<button type="button" class="pex__altpick" data-act="pickAlternates" data-id="${esc(e.id)}">`+
        `${esc((e.alternates||[]).join(", ")||t("program.exercise.alternates_empty"))}`+
      `</button>`+
    `</div>`+
  `</div>`;
}

/* Free-text editor fields. Their model values are normalised on the way in
   (trimmed, split on commas), so the stored string routinely differs from what
   is legitimately half-typed in the box — mirroring the model back mid-edit
   would eat trailing spaces and re-fill a field the lifter is still clearing.
   These echo on blur instead; see bindEditor. Alternates are no longer typed —
   they are picked — so they are committed whole and are not in this set,
   though Program.update still parses the string form for imported programs. */
const EDITOR_TEXT_FIELDS=new Set(["name","primary","secondary","notes"]);
const editorFieldText=(e,field)=>field==="alternates"?(e.alternates||[]).join(", "):String(e[field]??"");
function commitEditorField(id,field,value,effect){
  const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
  nextProgram.update(id,field,value);proposal.program=nextProgram.toJSON();
  return commitProposedState(proposal,storageIO,{effect})}

function bindEditor(){
  $$("#programEditor [data-field]").forEach(inp=>{
    const field=inp.dataset.field,isText=EDITOR_TEXT_FIELDS.has(field);
    inp.oninput=async()=>{const e=prog.find(inp.dataset.id);if(!e)return;
      const captured=inp.value,priorValue=String(e[field]??"");
      // A blank name is a stage of typing, not a rename: hold the committed name
      // until something non-blank arrives, so the Exercise fallback never lands
      // in the box under the cursor. Blur puts a name back if none does.
      if(field==="name"&&!captured.trim())return;
      let effect=null;
      if(field==="sets"){
        const next=Exercise.posInt(captured,e.sets);
        if(next<e.sets){
          const draftRaw=readDraftRaw();
          let draft={};
          try{const parsed=JSON.parse(draftRaw||"{}");if(isPlainStateObject(parsed))draft=parsed}
          catch{}
          if(draftHasProgressInRemovedSets(e.id,next,e.sets,draft)){
            inp.value=e.sets;toast(t("toast.set_count_locked_draft"));return}
          effect=draftPreservationEffect(draftRaw);
          if(effect.status!==DRAFT_EFFECT_VALID){
            inp.value=e.sets;toast(t("toast.set_count_locked_draft"));return}}}
      const result=await commitEditorField(inp.dataset.id,field,captured,effect);
      if(!(result.localOk||result.idbOk)){
        const cur=prog.find(inp.dataset.id);
        if(inp.value===captured)inp.value=cur?(isText?editorFieldText(cur,field):cur[field]):captured;
        if(effect)toast(t("toast.set_count_locked_draft"));
        return}
      if(!isText&&(inp.value===captured||inp.value===priorValue))
        inp.value=String(prog.find(inp.dataset.id)?.[field]??captured);
      renderVolume();updateGauge();updateSaveMeta()};
    if(inp.type==="number"){
      inp.onfocus=()=>inp.select();
      inp.onchange=()=>{const e=prog.find(inp.dataset.id);if(!e)return;const card=inp.closest(".pex");
        (card?card.querySelectorAll('input[type="number"][data-field]'):[inp]).forEach(x=>x.value=e[x.dataset.field])};
    }
    else if(isText){
      // Every keystroke commits, so by the time a name box is empty the model holds
      // whatever single letter survived the backspacing. Remember what was in the
      // box on focus and put that back — clearing a name and walking away is an
      // abandoned edit, not a rename to a fragment.
      let onFocusText=null;
      inp.onfocus=()=>{const e=prog.find(inp.dataset.id);onFocusText=e?editorFieldText(e,field):null};
      // Blur is where the box catches up with the model: stray whitespace goes and
      // alternates regain their ", " spacing.
      inp.onchange=async()=>{
        if(field==="name"&&!inp.value.trim()&&onFocusText){
          // Backspacing leaves a keystroke commit per character still in flight, and
          // a proposal built on a state they have not landed in yet diffs to nothing.
          // Let the queue drain so the restore is a real change against the model.
          await flushStorage();
          if(prog.find(inp.dataset.id)?.name!==onFocusText)
            await commitEditorField(inp.dataset.id,field,onFocusText);}
        const e=prog.find(inp.dataset.id);if(!e)return;
        const shown=editorFieldText(e,field);
        if(inp.value!==shown)inp.value=shown;
        onFocusText=null;
        renderVolume();updateGauge();updateSaveMeta()};
    }
  });
  $$('#programEditor [data-act="renameDay"]').forEach(inp=>{
    inp.onchange=async()=>{const old=inp.dataset.day,next=inp.value.trim();
      const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
      if(!nextProgram.renameDay(old,next)){
        inp.value=dayLabel(old);toast(prog.days().includes(next)?t("toast.day_name_exists"):t("toast.day_rename_failed"));return}
      proposal.program=nextProgram.toJSON();
      const effect=draftDayReplacementEffect(old,next);
      const result=await commitProposedState(proposal,storageIO,{effect,dayRenames:[{from:old,to:next}]});
      if(!(result.localOk||result.idbOk)){inp.value=dayLabel(old);return}
      renameCollapsedDay(old,next);
      if(day===old)day=next;
      render();toast(t("toast.day_renamed"))};
  });
  $$("#programEditor button[data-act]").forEach(b=>b.onclick=()=>editorAction(b.dataset.act,b.dataset));
}

async function editorAction(act,ds){
  if(act==="toggleDay"){const card=$(`#programEditor .pday[data-day="${CSS.escape(ds.day)}"]`);if(!card)return;
    const now=!card.classList.contains("is-collapsed");
    card.classList.toggle("is-collapsed",now);setDayCollapsed(ds.day,now);
    const btn=card.querySelector(".pday__caret");
    if(btn){btn.setAttribute("aria-expanded",now?"false":"true");
      const label=t(now?"program.day.expand":"program.day.collapse",{day:dayLabel(ds.day)});btn.setAttribute("aria-label",label);btn.title=label}}
  else if(act==="addEx"){
    // The fast path: what this day is short of, what you train often, and your
    // own movements — with the whole library one tap further on. Everything
    // already on the day is excluded; the same movement twice is always a slip.
    openExercisePicker({quick:true,day:ds.day,title:t("picker.add_to",{day:dayLabel(ds.day)}),subtitle:"",
      exclude:prog.forDay(ds.day).map(e=>e.libraryId).filter(Boolean),
      onPick:async entry=>{
        const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
        nextProgram.addExercise(ds.day,entry);proposal.program=nextProgram.toJSON();
        const result=await commitProposedState(proposal);
        if(result.localOk||result.idbOk){setDayCollapsed(ds.day,false);render();toast(t("toast.exercise_added"))}}})}
  else if(act==="changeEx"){
    const ex=prog.find(ds.id);if(!ex)return;
    openExercisePicker({title:t("picker.title_change"),subtitle:ex.name,
      exclude:prog.forDay(ex.day).filter(e=>e.id!==ex.id).map(e=>e.libraryId).filter(Boolean),
      onPick:async entry=>{
        const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
        if(!nextProgram.replaceExercise(ds.id,entry))return;
        proposal.program=nextProgram.toJSON();
        const result=await commitProposedState(proposal);
        if(result.localOk||result.idbOk){render();toast(t("toast.exercise_changed"))}}})}
  else if(act==="detachEx"){
    const ex=prog.find(ds.id);if(!ex)return;
    if(!confirm(t("confirm.detach_exercise",{name:ex.name})))return;
    const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
    if(!nextProgram.detachExercise(ds.id))return;
    proposal.program=nextProgram.toJSON();
    const result=await commitProposedState(proposal);
    if(result.localOk||result.idbOk){render();toast(t("toast.exercise_detached"))}}
  else if(act==="pickAlternates"){
    const ex=prog.find(ds.id);if(!ex)return;
    // Alternates were a comma-separated string of whatever got typed. They are
    // still stored as names, so older programs keep working, but they are now
    // chosen from the library — which is what makes a one-tap swap possible.
    const byName=new Map(pickableExercises().map(e=>[foldSearch(libraryName(e)),e.id]));
    const extras=[],preselected=[];
    for(const n of ex.alternates||[]){
      const hit=byName.get(foldSearch(n));
      if(hit){preselected.push(hit);continue}
      const extra=nameOnlyEntry(n);extras.push(extra);preselected.push(extra.id)}
    openExercisePicker({title:t("picker.title_alternates"),subtitle:ex.name,mode:"multi",
      selected:preselected,extras,exclude:[ex.libraryId].filter(Boolean),
      onPick:async entries=>{
        const result=await commitEditorField(ds.id,"alternates",entries.map(libraryName).join(", "));
        if(result.localOk||result.idbOk){render();toast(t("toast.alternates_saved"))}}})}
  else if(act==="delEx"){const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
    const key=draftActive?"confirm.remove_exercise_discard_draft":"confirm.remove_exercise";
    if(confirm(t(key))){
    const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
    nextProgram.removeExercise(ds.id);proposal.program=nextProgram.toJSON();
    const effect=destructiveDraftClearEffect(discardDraftRaw);
    const result=await commitProposedState(proposal,storageIO,{effect});
    if(result.localOk||result.idbOk){resetDraftSessionState();render();toast(t("toast.exercise_removed"))}}}
  else if(act==="up"||act==="down"){
    const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
    nextProgram.move(ds.id,act==="up"?-1:1);proposal.program=nextProgram.toJSON();
    const result=await commitProposedState(proposal);
    if(result.localOk||result.idbOk)render()}
  else if(act==="delDay"){const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
    const key=draftActive?"confirm.delete_day_discard_draft":"confirm.delete_day";
    if(confirm(t(key,{day:dayLabel(ds.day)}))){
    const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
    nextProgram.removeDay(ds.day);proposal.program=nextProgram.toJSON();
    const effect=destructiveDraftClearEffect(discardDraftRaw);
    const result=await commitProposedState(proposal,storageIO,{effect});
    if(result.localOk||result.idbOk){resetDraftSessionState();setDayCollapsed(ds.day,false);render();toast(t("toast.day_deleted"))}}}
}

function renderVolume(){
  const arr=[...prog.volume().entries()].map(([name,v])=>({name,eff:v.d+v.p})).sort((a,b)=>b.eff-a.eff);
  const max=Math.max(...arr.map(x=>x.eff),1);
  $("#volume").innerHTML=arr.length?arr.map(x=>`<div class="vrow"><span class="vrow__name">${esc(muscleLabel(x.name))}</span>`+
    `<span class="vrow__bar"><span class="vrow__fill${x.eff>=10?" is-high":""}" style="width:${Math.max(4,Math.round(x.eff/max*100))}%"></span></span>`+
    `<span class="vrow__num"><b>${fmt(x.eff)}</b> ${esc(tp(x.eff,"set"))}</span></div>`).join(""):`<div class="table"><div class="empty">${esc(t("program.empty.no_program_exercises"))}</div></div>`;
}
function addVol(m,k,d,p){if(!m.has(k))m.set(k,{d:0,p:0});m.get(k).d+=d;m.get(k).p+=p}

function persistProgram(nextProgram=prog){
  const proposal=cloneSnapshot(state);proposal.program=new Program(nextProgram.toJSON()).toJSON();
  return commitProposedState(proposal)}

/* Hand-edited rows skip Program.update, so they also skip its rule that a
   linked slot's label is an alias (displayName) while its muscles belong to the
   definition. Left alone, resolveIdentity overwrites both on save and the edit
   vanishes with a "Program saved." toast. Renames are translated into an alias
   here, exactly as the visual editor does; muscle edits cannot be honoured
   while the link stands, so they come back as names for the toast to report. */
function reconcileLinkedProgramRows(rows,byId){
  const text=v=>v==null?"":String(v).trim(),ignoredMuscles=new Set();
  for(const row of rows){
    if(!row||typeof row!=="object"||row.libraryId==null)continue;
    const entry=libraryEntry(row.libraryId);
    // An unknown id is not a link: resolveIdentity drops it and keeps the text.
    if(!entry)continue;
    const canonical=libraryName(entry),prev=row.id?byId.get(row.id):null;
    const nextAlias=text(row.displayName),prevAlias=text(prev?.displayName);
    const nextName=text(row.name),prevName=text(prev?.name);
    // Whichever label the lifter actually touched wins; an untouched row keeps
    // the alias it already carries.
    const alias=nextAlias!==prevAlias?nextAlias
      :prev?(nextName!==prevName?nextName:prevAlias)
      :(nextAlias||nextName);
    if(alias&&alias!==canonical)row.displayName=alias;else delete row.displayName;
    if(text(row.primary)!==text(entry.primary)||text(row.secondary)!==text(entry.secondary))
      ignoredMuscles.add(alias&&alias!==canonical?alias:canonical)}
  return{ignoredMuscles:[...ignoredMuscles]}}

async function saveProgram(){try{const parsed=JSON.parse($("#programJson").value);if(!Array.isArray(parsed))throw Error();
  const transition=programTransitionPrecondition(state);
  const byId=new Map(prog.exercises.map(e=>[e.id,e]));
  for(const row of parsed){if(row.id&&byId.has(row.id))continue;
    const match=prog.exercises.find(e=>e.name===row.name&&e.day===row.day)||prog.exercises.find(e=>e.name===row.name);
    if(match&&!parsed.some(r=>r.id===match.id))row.id=match.id}
  const{ignoredMuscles}=reconcileLinkedProgramRows(parsed,byId);
  const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
  if(draftActive&&!confirm(t("confirm.replace_program_discard_draft")))return;
  const proposal=cloneSnapshot(state);
  proposal.program=new Program(parsed).toJSON();
  migrateLogSnapshot(proposal);
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,storageIO,{effect,...transition});
  if(!(result.localOk||result.idbOk))return result;
  resetDraftSessionState();day=prog.days()[0]||"Day 1";render();
  // The save consumed the box, so show the normalised result over the draft.
  syncProgramJson({force:true});
  if(!ignoredMuscles.length)toast(t("toast.program_saved"));
  else toast(ignoredMuscles.length===1
    ?t("toast.program_saved_muscles_linked",{name:ignoredMuscles[0]})
    :t("toast.program_saved_muscles_linked_many",{n:ignoredMuscles.length}),{assertive:true});
  return result}
  catch{toast(t("toast.program_json_invalid"))}}

let notifyIntentGen=0,notifyWanted=false,notifyPending=false,notifyRequestInFlight=null;
function notifyPermission(){return window.RepForgeNotify?RepForgeNotify.permission():"unsupported"}
function notifyEffective(){return!!state.settings.notify?.enabled&&notifyPermission()==="granted"}
function persistNotifyEnabled(enabled){
  const proposal=cloneSnapshot(state);
  if(!proposal.settings.notify)proposal.settings.notify=normalizeNotify();
  proposal.settings.notify=normalizeNotify({...proposal.settings.notify,enabled:!!enabled});
  return commitProposedState(proposal)}
function notifyStatusText(){
  const perm=notifyPermission();
  if(notifyPending)return t("settings.notifications.status.pending");
  if(perm==="unsupported")return t("settings.notifications.next.unsupported");
  if(perm==="denied")return t("settings.notifications.next.denied");
  if(perm==="default")return t("settings.notifications.next.prompt");
  if(perm==="granted")return t("settings.notifications.permission",{status:t("settings.notifications.status.granted")});
  return t("settings.notifications.permission",{status:perm})}
function paintNotifyControls(){
  const n=state.settings.notify||normalizeNotify();
  const effective=notifyEffective();
  const ne=$("#notifyEnabled");if(ne)ne.checked=effective||notifyPending;
  const ntog=$("#notifyToggle");
  if(ntog){
    ntog.classList.toggle("is-on",effective||notifyPending);
    ntog.setAttribute("aria-pressed",effective?"true":"false");
    ntog.setAttribute("aria-busy",notifyPending?"true":"false");
    const name=t("settings.notifications.toggle_aria");
    if(name)ntog.setAttribute("aria-label",name)}
  const nt=$("#notifyTimer");if(nt)nt.checked=n.timer!==false;
  const ns=$("#notifySession");if(ns)ns.checked=n.session!==false;
  const nu=$("#notifyUnfinished");if(nu)nu.checked=n.unfinished!==false;
  const nm=$("#notifyMissed");if(nm)nm.checked=n.missed!==false;
  $$("#notifyTypes input").forEach(i=>{i.disabled=!effective});
  const ps=$("#notifyPermStatus");if(ps)ps.textContent=notifyStatusText()}
function reconcileNotifyPermission(){
  const perm=notifyPermission();
  if(perm==="granted"){
    if(state.settings.notify?.enabled)notifyWanted=true;
    return}
  const wasEnabled=!!state.settings.notify?.enabled;
  if(wasEnabled){
    notifyIntentGen++;
    notifyWanted=false;
    notifyPending=false;
    void persistNotifyEnabled(false);
    return}
  if(notifyPending&&(perm==="denied"||perm==="unsupported")){
    notifyIntentGen++;
    notifyWanted=false;
    notifyPending=false}}
async function setNotificationsEnabled(wanted){
  wanted=!!wanted;
  notifyWanted=wanted;
  if(!wanted){
    notifyIntentGen++;
    notifyPending=false;
    await persistNotifyEnabled(false);
    paintNotifyControls();
    return}
  if(notifyPending&&notifyRequestInFlight)return notifyRequestInFlight;
  const gen=notifyIntentGen;
  notifyPending=true;
  paintNotifyControls();
  const request=notifyRequestInFlight||(async()=>{
    let result="unsupported";
    try{result=window.RepForgeNotify?await RepForgeNotify.request():"unsupported"}
    catch{result=notifyPermission()}
    return result})();
  notifyRequestInFlight=request;
  try{
    const result=await request;
    if(gen!==notifyIntentGen||!notifyWanted)return;
    const perm=notifyPermission();
    const granted=result==="granted"&&perm==="granted";
    notifyPending=false;
    await persistNotifyEnabled(granted);
    if(!granted)notifyWanted=false;
    paintNotifyControls()}
  finally{if(notifyRequestInFlight===request)notifyRequestInFlight=null}}

function renderSettings(){
  const jp=$("#jumpPct"),mj=$("#minJump"),rh=$("#rirHigh"),hr=$("#hardRir"),rs=$("#restSec"),un=$("#unit");
  if(jp)jp.value=state.settings.jumpPct;if(mj)mj.value=state.settings.minJump;if(rh)rh.value=state.settings.rirHigh;if(hr)hr.value=state.settings.hardRir;
  if(rs)rs.value=state.settings.restSec;if(un)un.value=state.settings.unit;
  const langSel=$("#lang");if(langSel){langSel.value=state.settings.lang;[...langSel.options].forEach(o=>{o.textContent=t("settings.lang."+o.value)})}
  const themeSel=$("#theme");if(themeSel){themeSel.value=currentTheme();[...themeSel.options].forEach(o=>{o.textContent=t("settings.appearance."+o.value)})}
  $$('input[name="rirMode"]').forEach(r=>{r.checked=r.value===state.settings.rirMode});
  const vi=$("#voiceInputEnabled");if(vi)vi.checked=!!state.settings.voiceInputEnabled;
  const vt=$("#voiceToggle");if(vt){vt.classList.toggle("is-on",!!state.settings.voiceInputEnabled);vt.setAttribute("aria-pressed",state.settings.voiceInputEnabled?"true":"false")}
  const telemetryEnabled=window.RepForgeTelemetry?.isEnabled?.()!==false;
  const tt=$("#telemetryToggle");if(tt){tt.classList.toggle("is-on",telemetryEnabled);tt.setAttribute("aria-pressed",telemetryEnabled?"true":"false")}
  reconcileNotifyPermission();
  paintNotifyControls();
  updateVoiceBtn();
  // Rule 5: the row is there only when tapping it leads somewhere — Chrome's
  // prompt, the Safari sheet, or the explanation another iOS browser needs.
  const ia=$("#installApp");if(ia)ia.classList.toggle("hidden",installMode()==="none");
  const sec=normalizeRestSec(state.settings.restSec),disp=$("#restSecDisplay");
  if(disp)disp.textContent=sec?fmtClock(sec):t("settings.rest_off");
  const rirDisp=$("#rirModeDisplay");if(rirDisp)rirDisp.textContent=state.settings.rirMode==="effort"?t("settings.rir_effort"):t("settings.rir_numbers");
  const le=state.settings.lastExport,ago=le?t("settings.storage.last_backup",{lastBackup:le.slice(0,10)}):t("settings.storage.last_backup_never");
  const sn=$("#storageNote");if(sn)sn.textContent=ago;
  const deg=$("#storageDegraded");
  if(deg){const on=!!storageHealth.degraded;deg.textContent=on?t("settings.storage.degraded"):"";deg.classList.toggle("hidden",!on);deg.hidden=!on}
  const sz=$("#storageSize");if(sz){try{const bytes=new Blob([localStorage.getItem(KEY)||""]).size;sz.textContent=bytes>1048576?`${fmt(+(bytes/1048576).toFixed(1))} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`}catch{sz.textContent="—"}}
}

async function commitSettings(silent){const editRevision=settingsEditRevision;
  const num=(sel,def,min)=>{const n=parseDec($(sel).value);return Number.isFinite(n)&&n>=min?n:def};
  const oldUnit=state.settings.unit,newUnit=$("#unit").value==="lb"?"lb":"kg",oldLang=state.settings.lang,newLang=I18N?.normalizeLang($("#lang")?.value)||oldLang;
  const newRirMode=$('input[name="rirMode"]:checked')?.value==="effort"?"effort":"numeric";
  if(!changeRirMode(newRirMode))return{revision:readRevision(state),localOk:false,idbOk:false,cancelled:true};
  const rsEl=$("#restSec");let restSec;
  const restN=parseDec(rsEl?.value);
  if(Number.isFinite(restN)&&restN>=0&&!Number.isInteger(restN)){
    if(rsEl){rsEl.value=String(state.settings.restSec);rsEl.setAttribute("aria-invalid","true");try{rsEl.focus()}catch{}}
    toast(t("validation.rest_frac"));restSec=state.settings.restSec}
  else{rsEl?.removeAttribute("aria-invalid");restSec=rsEl?num("#restSec",120,0):state.settings.restSec}
  const oldRestSec=state.settings.restSec;
  const originalDraftRaw=oldUnit===newUnit?null:readDraftRaw();
  const unitEffect=draftUnitConversionEffect(originalDraftRaw,oldUnit,newUnit);
  const proposal=cloneSnapshot(state);
  proposal.settings=normalizeSettings({jumpPct:num("#jumpPct",2.5,0),minJump:(()=>{const n=parseDec($("#minJump").value);return Number.isFinite(n)&&n>0?n:2.5})(),rirHigh:num("#rirHigh",2,0),hardRir:num("#hardRir",4,0),restSec,lastExport:state.settings.lastExport,unit:newUnit,lang:newLang,rirMode:newRirMode,voiceInputEnabled:!!$("#voiceInputEnabled")?.checked,notify:normalizeNotify({enabled:!!state.settings.notify?.enabled,timer:!!$("#notifyTimer")?.checked,session:!!$("#notifySession")?.checked,unfinished:!!$("#notifyUnfinished")?.checked,missed:!!$("#notifyMissed")?.checked})});
  const result=await commitProposedState(proposal,storageIO,{effect:unitEffect});
  if(!(result.localOk||result.idbOk)){if(editRevision===settingsEditRevision)renderSettings();return result}
  // A length picked in the timer sheet holds for the session, but a new default
  // in Settings is the lifter saying it plainly — it wins.
  if(oldRestSec!==state.settings.restSec)restLength=0;
  if(oldUnit!==newUnit){
    const bw=$("#bodyweight");if(bw&&bw.value!==""){const n=parseDec(bw.value);if(Number.isFinite(n))bw.value=fmtPlain(toDisplayUnit(fromDisplayUnit(n,oldUnit),newUnit))}}
  if(oldLang!==state.settings.lang&&I18N)I18N.setLang(state.settings.lang);
  if(editRevision===settingsEditRevision)render();
  if(!silent)toast(t("toast.settings_saved"));
  return result}

function table(rows){if(!rows.length)return`<div class="empty">${esc(t("stats.table.no_data"))}</div>`;const h=Object.keys(rows[0]);
  return`<table><thead><tr>${h.map(x=>`<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${h.map(x=>`<td>${esc(r[x])}</td>`).join("")}</tr>`).join("")}</tbody></table>`}

function exportCsv(){
  const hr=+state.settings.hardRir;
  const cols=[
    ["session",r=>r.session],["date",r=>r.date],["day",r=>r.day],
    ["name",r=>exerciseLabel(r)],["performed_name",r=>r.performedName||""],["exercise_id",r=>r.exerciseId||""],
    ["set",r=>r.set],["load",r=>r.load],["reps",r=>r.reps],["rir",r=>r.rir],
    ["e1rm",r=>+e1rm(+r.load,+r.reps).toFixed(2)],
    ["tonnage",r=>+((+r.load||0)*(+r.reps||0)).toFixed(2)],
    ["primary",r=>rowMuscles(r).primary],["secondary",r=>rowMuscles(r).secondary],
    ["is_hard_set",r=>(+r.load>0&&+r.reps>0&&+r.rir<=hr&&!r.warmup)?1:0],
    ["is_warmup",r=>r.warmup?1:0],
    ["bodyweight",r=>r.bodyweight??""],
    ["notes",r=>r.notes],["exercise_note",r=>r.exNote||""],["created",r=>r.created],
  ];
  const q=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[cols.map(c=>c[0]).join(","),
    ...state.log.map(r=>cols.map(c=>q(c[1](r))).join(","))].join("\n");
  download(csv,`taurifer_log_${today()}.csv`,"text/csv");
}
async function exportJson(){
  const proposal=cloneSnapshot(state);proposal.settings.lastExport=new Date().toISOString();
  const result=await commitProposedState(proposal);
  if(!(result.localOk||result.idbOk))return result;
  const text=JSON.stringify(exportableState(state),null,2),name=`taurifer_backup_${today()}.json`;
  shareOrDownload(text,name,"application/json");
  renderSettings();
  return result}
const fileSlug=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);
/* A program-only export carries its own custom definitions. Without them a
   template arriving on another device points at a "custom:…" id that device has
   never seen: the movement survives as copied strings but stops being a
   reusable exercise. Only definitions this program actually references travel;
   the rest of the lifter's library is not this file's business. */
function referencedCustomExercises(list){
  const wanted=new Set((list||[]).map(e=>e.libraryId).filter(id=>isCustomLibraryId(id)));
  return customExercises().filter(e=>wanted.has(e.id)).map(cloneSnapshot)}
const SHARED_EQUIPMENT={machine:"machines",machines:"machines",cable:"cables",cables:"cables",
  dumbbell:"dumbbells",dumbbells:"dumbbells",barbell:"barbells",barbells:"barbells",bodyweight:"bodyweight"};
function sharedProgramMeta(meta,program){
  const days=program.days();
  const optional=(value,allowed)=>allowed.includes(value)?value:null;
  return{name:String(meta?.name||"").trim()||t("untitled_program")||"Untitled program",
    goal:optional(meta?.goal,["hypertrophy","strength_hypertrophy","beginner_consistency"]),
    experience:optional(meta?.experience,["beginner","intermediate","advanced"]),daysPerWeek:days.length,
    splitType:optional(meta?.splitType,["full_body","machine_only","ppl","upper_lower","bro"]),
    equipment:[...new Set((Array.isArray(meta?.equipment)?meta.equipment:[])
      .map(value=>SHARED_EQUIPMENT[String(value).toLowerCase()]).filter(Boolean))],
    priorityMuscles:[...new Set((Array.isArray(meta?.priorityMuscles)?meta.priorityMuscles:[])
      .map(value=>String(value).trim()).filter(Boolean))],
    sessionLength:optional(meta?.sessionLength,["short","normal","long"]),
    mesocycleLengthWeeks:meta?.mesocycleLengthWeeks==null?6:meta.mesocycleLengthWeeks,
    progressionRelations:normalizeProgressionRelations(meta?.progressionRelations,program.toJSON()),
    progressionModifiers:normalizeProgressionModifiers(meta?.progressionModifiers)}}
function sharedExercise(ex,preserveIdentity=false){
  const libraryId=LEGACY_LIBRARY_IDS[ex?.libraryId]||ex?.libraryId;
  const out={day:ex?.day,order:ex?.order,libraryId,sets:ex?.sets,min:ex?.min,max:ex?.max,
    notes:ex?.notes||"",alternates:Array.isArray(ex?.alternates)?[...ex.alternates]:[]};
  if(preserveIdentity){out.id=ex?.id;out.movementId=ex?.movementId}
  for(const key of ["displayName","progressionType","targetRirStart","targetRirEnd","minSets","maxSets","priority"])
    if(ex?.[key]!==undefined)out[key]=ex[key];
  if(ex?.progression!==undefined)out.progression=cloneSnapshot(ex.progression);
  return out}
function sharedCustomExercise(entry){
  return{id:entry.id,name:entry.name,namePt:entry.namePt||entry.name,
    equipment:Array.isArray(entry.equipment)?[...entry.equipment]:[],primary:entry.primary||"",
    secondary:entry.secondary||"",notes:entry.notes||""}}
function sharedSettings(settings){
  return{jumpPct:settings.jumpPct,minJump:settings.minJump,rirHigh:settings.rirHigh,
    hardRir:settings.hardRir,restSec:settings.restSec,unit:settings.unit,
    lang:settings.lang||I18N?.getLang?.()||I18N?.detectLang?.()||"en",rirMode:settings.rirMode}}
function buildSharedSetupPayload(){
  if(!SharedSetup)throw new TypeError("Shared setup unavailable");
  const source=prog.toJSON();
  const relations=normalizeProgressionRelations(state.programMeta?.progressionRelations,source);
  const relationSlots=new Set(relations.flatMap(relation=>relation.members.map(member=>member.exerciseId)));
  const exercises=source.map(ex=>sharedExercise(ex,relationSlots.has(ex.id)));
  return{kind:SharedSetup.KIND,version:SharedSetup.VERSION,
    program:{meta:sharedProgramMeta(state.programMeta,prog),exercises,
      customExercises:referencedCustomExercises(exercises).map(sharedCustomExercise)},
    settings:sharedSettings(state.settings)}}
function exportProgram(){
  const exercises=prog.toJSON();
  const payload={version:3,meta:state.programMeta,exercises,
    customExercises:referencedCustomExercises(exercises)};
  const slug=fileSlug(state.programMeta?.name);
  download(JSON.stringify(payload,null,2),`taurifer_program_${slug?`${slug}_`:""}${today()}.json`,"application/json")}

/* ---- Plain-text program export ----
 * The program as something a lifter can read or paste into a chat: the name and
 * how many days it runs, then each training day with its muscles and its
 * exercise templates numbered in order, "3× 6 to 10" for sets × rep range.
 * The readable body intentionally omits editor-only details; the structured
 * appendix round-trips progression envelopes and incompatibility provenance.
 * Per-exercise muscles, notes, and alternates still require the JSON export. */
const programTextReps=e=>e.min===e.max?`${e.min}`:t("program.export_text.rep_range",{min:e.min,max:e.max});
const PROGRAM_TEXT_DATA_MARKER="TAURIFER-DATA";
function programTextData(meta,program){
  const relations=normalizeProgressionRelations(meta?.progressionRelations,program);
  const relationSlots=new Set(relations.flatMap(relation=>relation.members.map(member=>member.exerciseId)));
  const exercises=program.filter(ex=>ex?.progression||ex?.progressionIncompatibility||relationSlots.has(ex?.id)).map(ex=>({day:ex.day,order:ex.order,id:ex.id,
    movementId:ex.movementId,...(ex.progression?{progression:cloneSnapshot(ex.progression)}:{}),
    ...(ex.progressionIncompatibility?{progressionIncompatibility:cloneSnapshot(ex.progressionIncompatibility)}:{})}));
  const modifiers=normalizeProgressionModifiers(meta?.progressionModifiers);
  const incompatibilities=Array.isArray(meta?.progressionIncompatibilities)?cloneSnapshot(meta.progressionIncompatibilities):[];
  if(!exercises.length&&!relations.length&&!modifiers.length&&!incompatibilities.length)return null;
  return{version:1,exercises,relations,modifiers,incompatibilities};
}
function programText(){
  const meta=state.programMeta||defaultProgramMeta(state.log),ds=prog.days();
  const up=s=>String(s??"").toLocaleUpperCase(locTag());
  const lines=[`${up(meta.name||t("untitled_program"))}, ${t("program.export_text.days_per_week",{n:ds.length})}`];
  for(const d of ds){
    const mus=dayMuscles(d).map(muscleLabel);
    lines.push("",`${up(d)}${mus.length?`: ${mus.join(" · ")}`:""}`);
    prog.forDay(d).forEach((e,i)=>lines.push(`${i+1}. ${e.name}: ${e.sets}× ${programTextReps(e)}`))}
  const data=programTextData(meta,prog.toJSON());
  if(data)lines.push("",PROGRAM_TEXT_DATA_MARKER,JSON.stringify(data));
  return lines.join("\n")}
const programTextName=()=>{const slug=fileSlug(state.programMeta?.name);
  return `taurifer_program_${slug?`${slug}_`:""}${today()}.txt`};
let programTextReturn=null;
function openProgramTextSheet(){
  const sheet=$("#programTextSheet"),scrim=$("#programTextScrim"),out=$("#programTextOut");
  if(!sheet||!out)return;
  out.textContent=programText();
  out.scrollTop=0;
  const sub=$("#programTextFor");if(sub)sub.textContent=state.programMeta?.name||t("untitled_program");
  programTextReturn=document.activeElement;
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{
    initialFocus:$("#programTextCopy"),
    returnFocus:programTextReturn,
    onEscape:closeProgramTextSheet,
    scrim,
    delayHide:reducedMotion()?0:280
  });
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeProgramTextSheet(){
  const sheet=$("#programTextSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  programTextReturn=null;
  return closeModal(sheet)}
let shareSetupReturn=null,shareSetupLink="";
function setShareSetupState(message,{ready=false}={}){
  const status=$("#shareSetupStatus"),out=$("#shareSetupLink"),share=$("#shareSetupShare"),copy=$("#shareSetupCopy");
  if(status){status.textContent=message||"";status.classList.toggle("hidden",!message)}
  if(out){if("value" in out)out.value=ready?shareSetupLink:"";else out.textContent=ready?shareSetupLink:""}
  if(share){share.disabled=!ready||typeof navigator.share!=="function";share.classList.toggle("hidden",typeof navigator.share!=="function")}
  if(copy)copy.disabled=!ready}
function sharedSetupErrorMessage(result,unlinked=false){
  if(unlinked)return t("program.share_setup_unlinked");
  if(result?.code==="compression-unavailable")return t("program.share_setup_unsupported");
  if(result?.code==="encoded-too-large")return t("setup.shared.too_large");
  return t("program.share_setup_invalid")}
async function buildShareSetupLink(){
  shareSetupLink="";
  setShareSetupState(t("program.share_setup_building"));
  if(!SharedSetup){setShareSetupState(t("program.share_setup_unsupported"));return}
  const unlinked=prog.toJSON().some(ex=>!ex.libraryId||!libraryEntry(ex.libraryId));
  if(unlinked){setShareSetupState(sharedSetupErrorMessage(null,true));return}
  let payload;
  try{payload=buildSharedSetupPayload()}catch{setShareSetupState(t("program.share_setup_invalid"));return}
  const checked=SharedSetup.validate(payload,{builtInIds:SHARED_BUILT_IN_IDS});
  if(!checked.ok){setShareSetupState(sharedSetupErrorMessage(checked));return}
  let encoded;
  try{encoded=await SharedSetup.encode(checked.value,{builtInIds:SHARED_BUILT_IN_IDS})}
  catch{setShareSetupState(t("program.share_setup_unsupported"));return}
  if(!encoded.ok){setShareSetupState(sharedSetupErrorMessage(encoded));return}
  const local=/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(location.hostname);
  const url=new URL("index.html",local?location.href:"https://pedrochagasmaster.github.io/repforge/index.html");
  url.search="";
  url.hash=`setup=${encoded.value}`;
  shareSetupLink=url.href;
  setShareSetupState("",{ready:true})}
function openShareSetupSheet(){
  const sheet=$("#shareSetupSheet"),scrim=$("#shareSetupScrim");
  if(!sheet)return;
  const subtitle=$("#shareSetupFor");if(subtitle)subtitle.textContent=state.programMeta?.name||t("untitled_program");
  shareSetupReturn=document.activeElement;
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{initialFocus:$("#shareSetupClose"),returnFocus:shareSetupReturn,
    onEscape:closeShareSetupSheet,scrim,delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")});
  buildShareSetupLink()}
function closeShareSetupSheet(){
  const sheet=$("#shareSetupSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  shareSetupReturn=null;
  return closeModal(sheet)}
async function copySetupLink(){
  if(!shareSetupLink)return false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(shareSetupLink);
    toast(t("toast.setup_link_copied"));return true}}catch{}
  try{const ta=document.createElement("textarea");ta.value=shareSetupLink;ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.append(ta);ta.select();
    const ok=document.execCommand("copy");ta.remove();
    if(ok){toast(t("toast.setup_link_copied"));return true}}catch{}
  return false}
async function shareSetupLinkNow(){
  if(!shareSetupLink||typeof navigator.share!=="function")return false;
  try{await navigator.share({title:t("program.share_setup_title"),url:shareSetupLink});return true}
  catch{return false}}
/* ============================================================
   Exercise picker
   One sheet, four callers: the program editor's add and change
   paths, the alternates field, and the log-tab substitution.
   Callers hand it a mode and a callback and get library entries
   back — they never touch the library themselves, so a movement
   arrives in a program slot the same way from every surface.
   ============================================================ */

/* Search is accent- and case-blind, and reads both languages at once: a
   Portuguese lifter still types "bench press" for a machine whose plate says
   so, and an English one still finds "supino". */
const foldSearch=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const MUSCLE_TOKENS=["Chest","Lats","Mid/upper back","Traps","Front delts","Side delts","Rear delts",
  "Biceps","Triceps","Forearms","Quads","Hamstrings","Glutes","Adductors","Abductors","Calves",
  "Spinal erectors","Abs","Obliques"];
const PICKER_EQUIPMENT=["machine","cable","dumbbell","barbell","smith","bodyweight"];
/* Muscle filters lifters actually think in, each covering the tokens under it. */
const PICKER_MUSCLE_GROUPS=[
  ["chest",["Chest"]],["back",["Lats","Mid/upper back","Traps"]],
  ["shoulders",["Front delts","Side delts","Rear delts"]],
  ["arms",["Biceps","Triceps","Forearms"]],
  ["legs",["Quads","Hamstrings","Glutes","Adductors","Abductors","Calves"]],
  ["core",["Abs","Obliques","Spinal erectors"]]];

let pickerState=null,pickerReturn=null,customState=null,customReturn=null;

const exerciseSearchText=e=>foldSearch(`${e.name} ${e.namePt||""} ${e.primary||""} ${e.secondary||""}`);
function exerciseMatches(e,query,muscleGroup,equipment){
  if(equipment&&!(e.equipment||[]).includes(equipment))return false;
  if(muscleGroup){
    const group=PICKER_MUSCLE_GROUPS.find(g=>g[0]===muscleGroup);
    const tokens=`${e.primary||""},${e.secondary||""}`.split(",");
    if(group&&!tokens.some(x=>group[1].includes(x)))return false}
  if(!query)return true;
  const hay=exerciseSearchText(e);
  return foldSearch(query).split(/\s+/).filter(Boolean).every(w=>hay.includes(w))}

/* Library ids already in the program, and names already logged. Both float to
   the top of the list: the movement somebody wants next is usually one they
   have met before. */
function programLibraryIds(){
  const ids=new Set();
  for(const e of state.program||[])if(e.libraryId)ids.add(String(e.libraryId));
  return ids}
/* What the lifter has actually trained, for promoting familiar movements in the
   picker. Library ids are the reliable half — names only match when the log was
   written in the language the picker is being read in. */
function loggedExerciseRefs(){
  const ids=new Set(),names=new Set();
  for(const r of state.log||[]){
    if(r?.performedLibraryId)ids.add(String(r.performedLibraryId));
    if(r?.performedName)names.add(foldSearch(r.performedName));
    if(r?.name)names.add(foldSearch(r.name))}
  for(const e of state.program||[])if(e.libraryId)ids.add(String(e.libraryId));
  return{ids,names}}

/* ---- Exercise artwork ----
   Twenty-four movements have licensed illustrations; every other built-in and
   every custom exercise renders a deliberately empty tile. The empty state is
   an element with no src, not an <img> pointing at a file that is not there:
   a broken-image request is both a wasted fetch and a visible glyph. Both
   shapes are the same size so a mixed list stays aligned. */
const exerciseMedia=e=>(e&&typeof e.media==="string"&&e.media)||null;
/* The paper colour the illustration is drawn on, sampled per file at build time
   (tools/sample-media-bg.mjs). The detail page lays the artwork on a field of
   this colour so the opaque square dissolves rather than reading as a pasted
   tile. Re-checked here because the value reaches a style attribute, and a
   generated file is still a file somebody can edit. */
const HEX_COLOR=/^#[0-9a-f]{6}$/i;
const exerciseMediaBg=e=>(e&&typeof e.mediaBg==="string"&&HEX_COLOR.test(e.mediaBg)&&e.mediaBg)||null;
/* A program slot and an identity recovered from a log row both carry a library
   id rather than the artwork itself, so the illustration has to come from the
   definition they point at. A custom entry resolves too and simply has none. */
const exerciseRefEntry=ref=>ref?.libraryId!=null?libraryEntry(ref.libraryId):ref;
const emptyThumb=({size="md"}={})=>
  `<span class="exthumb exthumb--${esc(size)} exthumb--empty" aria-hidden="true"></span>`;
function exerciseThumb(e,{size="md"}={}){
  const src=exerciseMedia(e);
  if(!src)return emptyThumb({size});
  // alt is empty on purpose: the exercise name sits next to it in every list,
  // so describing the drawing again would only repeat the row to a screen reader.
  return `<img class="exthumb exthumb--${esc(size)}" src="${esc(src)}" alt="" `+
    `loading="lazy" decoding="async" width="768" height="768">`}

function pickerRow(e,{selected=false,checkbox=false}={}){
  const muscles=[e.primary,e.secondary].filter(Boolean).join(",").split(",").filter(Boolean);
  const shown=muscles.slice(0,3).map(muscleLabel);
  const eq=(e.equipment||[])[0]||null;
  return `<button type="button" class="pickrow${selected?" is-selected":""}" data-pick="${esc(e.id)}"`+
    (checkbox?` role="checkbox" aria-checked="${selected?"true":"false"}"`:"")+`>`+
    exerciseThumb(e,{size:"sm"})+
    `<span class="pickrow__main">`+
      `<span class="pickrow__name">${esc(libraryName(e))}</span>`+
      `<span class="pickrow__meta">${esc(shown.join(" · "))}</span>`+
    `</span>`+
    (eq?`<span class="pickrow__eq">${esc(t("picker.equipment."+eq))}</span>`:"")+
    `<span class="pickrow__tick" aria-hidden="true"></span>`+
  `</button>`}

function renderPickerFilters(){
  const el=$("#exPickFilters");if(!el||!pickerState)return;
  const chip=(kind,val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-filter="${kind}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const parts=[chip("clear","",t("picker.filter_all"),!pickerState.muscle&&!pickerState.equipment)];
  for(const [key] of PICKER_MUSCLE_GROUPS)
    parts.push(chip("muscle",key,t("picker.group."+key),pickerState.muscle===key));
  for(const eq of PICKER_EQUIPMENT)
    parts.push(chip("equipment",eq,t("picker.equipment."+eq),pickerState.equipment===eq));
  el.innerHTML=parts.join("");
  $$("#exPickFilters .pchip").forEach(b=>b.onclick=()=>{
    const kind=b.dataset.filter;
    if(kind==="clear"){pickerState.muscle=null;pickerState.equipment=null}
    else if(kind==="muscle")pickerState.muscle=pickerState.muscle===b.dataset.val?null:b.dataset.val;
    else pickerState.equipment=pickerState.equipment===b.dataset.val?null:b.dataset.val;
    renderPickerFilters();renderPickerList()})}

const pickerCandidates=()=>(pickerState?.extras||[]).concat(pickableExercises());
const pickerEntry=id=>pickerCandidates().find(e=>e.id===id)||libraryEntry(id);

function renderPickerList(){
  const el=$("#exPickList");if(!el||!pickerState)return;
  const {query,muscle,equipment,mode,selected,exclude}=pickerState;
  const multi=mode==="multi";
  // A quick-add tab narrows the source; typing in it searches everything,
  // because a lifter who types a name wants that name, not the tab.
  const source=pickerState.quick&&!query?libTabList(pickerState.tab):pickerCandidates();
  const all=source.filter(e=>!exclude.has(e.id)&&exerciseMatches(e,query,muscle,equipment));
  const inProgram=programLibraryIds(),logged=loggedExerciseRefs();
  const custom=[],known=[],rest=[];
  const familiar=e=>inProgram.has(e.id)||logged.ids.has(e.id)||
    logged.names.has(foldSearch(e.name))||logged.names.has(foldSearch(e.namePt||""));
  for(const e of all){
    if(isCustomLibraryId(e.id)||e.nameOnly)custom.push(e);
    else if(familiar(e))known.push(e);
    else rest.push(e)}
  // Rank before name. Alphabetical alone answers "row" with four barbell
  // variants before plain Barbell row, and opens the library on an assisted
  // kneeling dip — the staple for a movement should lead its own results.
  rest.sort((a,b)=>(a.rank??50)-(b.rank??50)||libraryName(a).localeCompare(libraryName(b)));
  const section=(key,list)=>list.length
    ?`<p class="pick__section">${esc(t(key))}</p>`+list.map(e=>pickerRow(e,{selected:selected.has(e.id),checkbox:multi})).join("")
    :"";
  const html=pickerState.quick&&!query
    ?(all.length?`<p class="pick__section">${esc(t("picker.tab_head."+pickerState.tab))}</p>`+
      all.map(e=>pickerRow(e,{selected:selected.has(e.id),checkbox:multi})).join(""):"")
    :section("picker.section_custom",custom)+
      section("picker.section_known",known)+
      section("picker.section_all",rest);
  el.innerHTML=html||`<p class="pick__empty">${esc(t("picker.empty",{q:query}))}</p>`;
  $$("#exPickList .pickrow").forEach(b=>b.onclick=()=>choosePicked(b.dataset.pick));
  const done=$("#exPickDone");
  if(done)done.textContent=multi&&selected.size?t("picker.done_count",{n:selected.size}):t("dialog.done")}

async function choosePicked(id){
  if(!pickerState||pickerState.choosing)return;
  const entry=pickerEntry(id);
  if(!entry)return;
  if(pickerState.mode==="multi"){
    if(pickerState.selected.has(id))pickerState.selected.delete(id);
    else pickerState.selected.add(id);
    renderPickerList();return}
  const active=pickerState,handler=active.onPick;
  active.choosing=true;
  const sheet=$("#exPickSheet");if(sheet)sheet.setAttribute("aria-busy","true");
  try{if(handler)await handler(entry);await closeExercisePicker()}
  finally{if(pickerState===active)active.choosing=false;if(sheet)sheet.removeAttribute("aria-busy")}}

/* mode "single" fires onPick with one entry and closes; "multi" collects and
   fires once on Done with the entries in selection order. */
/* Pseudo-entries for names that exist only in somebody's program — a legacy or
   imported alternate the library has no row for. They are listed and selectable
   like anything else, so opening the picker can neither drop them silently nor
   strand them as something the lifter can see but not remove. */
const NAME_ONLY_PREFIX="name:";
const nameOnlyEntry=name=>({id:`${NAME_ONLY_PREFIX}${foldSearch(name)}`,name,namePt:name,
  equipment:[],primary:"",secondary:"",patterns:[],nameOnly:true});
function openExercisePicker({title=null,subtitle="",mode="single",selected=[],exclude=[],extras=[],onPick=null,
  quick=false,day:dayName=null,query="",muscle=null,equipment=null,tab=null}={}){
  const sheet=$("#exPickSheet"),scrim=$("#exPickScrim"),search=$("#exPickSearch");
  if(!sheet)return;
  pickerState={query:String(query||""),muscle,equipment,mode,onPick,
    selected:new Set(selected.filter(Boolean).map(String)),
    exclude:new Set(exclude.filter(Boolean).map(String)),
    extras:extras.filter(Boolean),
    quick,day:dayName,tab:quick&&(LIB_TABS.includes(tab)?tab:"suggested"),
    // Kept so the custom-exercise detour can put this exact picker back, with
    // whatever was typed and filtered still in place.
    reopen:{title,subtitle,mode,exclude:[...exclude],extras:[...extras],onPick,quick,day:dayName}};
  pickerReturn=document.activeElement;
  $("#exPickTitle").textContent=title||t("picker.title");
  const sub=$("#exPickFor");if(sub)sub.textContent=subtitle||"";
  if(search)search.value=pickerState.query;
  const done=$("#exPickDone");
  if(done)done.classList.toggle("hidden",mode!=="multi");
  const tabs=$("#exPickTabs");if(tabs)tabs.classList.toggle("hidden",!quick);
  const full=$("#exPickFull");if(full)full.classList.toggle("hidden",!quick);
  if(quick)renderQuickTabs();
  renderPickerFilters();renderPickerList();
  document.body.classList.add("is-sheet-open");
  // The sheet takes focus, not the search box: focusing an input raises the
  // software keyboard, which covers half the phone before the lifter has asked
  // to type — and browsing the list is the common move, typing the rarer one.
  // The dialog element carries tabindex="-1" so it can hold focus without
  // joining the tab order, and Tab from it lands on the sheet's first control.
  openModal(sheet,{initialFocus:sheet,returnFocus:pickerReturn,onEscape:closeExercisePicker,scrim,
    delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}

function closeExercisePicker(){
  const sheet=$("#exPickSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  pickerReturn=null;
  return closeModal(sheet)}

async function confirmPickerSelection(){
  if(!pickerState||pickerState.mode!=="multi"||pickerState.choosing)return;
  const active=pickerState,handler=active.onPick;
  const picked=[...active.selected].map(pickerEntry).filter(Boolean);
  active.choosing=true;
  try{if(handler)await handler(picked);await closeExercisePicker()}
  finally{if(pickerState===active)active.choosing=false}}

function pickerResumeOptions(){
  if(!pickerState)return null;
  return Object.assign({},pickerState.reopen,{query:pickerState.query,muscle:pickerState.muscle,
    equipment:pickerState.equipment,tab:pickerState.tab,selected:[...pickerState.selected]})}

/* ---- custom exercise editor ---- */

/* Reachable editing, which the definition needs to be manageable at all: the
   sheet always supported an existing entry, but nothing ever passed one. */
function editCustomExercise(id){
  const entry=customExercises().find(e=>e.id===id);
  if(!entry)return;
  const reopen=libraryResumeOptions();
  openCustomExerciseSheet({entry,handoff:!!libFlow,
    onCancel:()=>{if(reopen)openLibrary(reopen)},
    onSave:()=>{if(reopen)openLibrary(reopen);else if(pickerState)renderPickerList()}})}

function renderCustomChips(){
  if(!customState)return;
  const chip=(val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const eq=$("#exCustomEquip");
  if(eq){
    eq.innerHTML=PICKER_EQUIPMENT.map(x=>chip(x,t("picker.equipment."+x),customState.equipment.has(x))).join("");
    $$("#exCustomEquip .pchip").forEach(b=>b.onclick=()=>{
      const v=b.dataset.val;
      customState.equipment.has(v)?customState.equipment.delete(v):customState.equipment.add(v);
      renderCustomChips()})}
  for(const [sel,key] of [["#exCustomPrimary","primary"],["#exCustomSecondary","secondary"]]){
    const box=$(sel);if(!box)continue;
    box.innerHTML=MUSCLE_TOKENS.map(m=>chip(m,muscleLabel(m),customState[key].has(m))).join("");
    $$(`${sel} .pchip`).forEach(b=>b.onclick=()=>{
      const v=b.dataset.val;
      if(customState[key].has(v))customState[key].delete(v);
      else{customState[key].add(v);
        // A muscle cannot be both; picking a side moves it.
        customState[key==="primary"?"secondary":"primary"].delete(v)}
      renderCustomChips()})}}

/* stageOnly builds the definition without writing it: import review needs the
   entry to show, but nothing durable may move before the final Import. */
function openCustomExerciseSheet({entry=null,onSave=null,onCancel=null,handoff=false,stageOnly=false}={}){
  const sheet=$("#exCustomSheet"),scrim=$("#exCustomScrim"),name=$("#exCustomName");
  if(!sheet)return;
  const inUse=entry?customExerciseInUse(entry.id):false;
  customState={id:entry?.id||null,onSave,stageOnly,
    // Empty for a new definition: defaulting every custom exercise to Machine
    // quietly mislabels dumbbell and cable work the wizard then filters on.
    equipment:new Set(entry?.equipment||[]),
    primary:new Set(String(entry?.primary||"").split(",").filter(Boolean)),
    secondary:new Set(String(entry?.secondary||"").split(",").filter(Boolean))};
  customReturn=document.activeElement;
  if(name)name.value=entry?.name||"";
  const notes=$("#exCustomNotes");if(notes)notes.value=entry?.notes||"";
  const del=$("#exCustomDelete");
  if(del){const action=inUse?"custom.archive":"custom.delete";
    del.classList.toggle("hidden",!entry);del.dataset.i18n=action;del.textContent=t(action)}
  const used=$("#exCustomInUse");
  if(used)used.classList.toggle("hidden",!(entry&&inUse));
  customState.onCancel=onCancel;
  renderCustomChips();
  document.body.classList.add("is-sheet-open");
  // handoff lets this open over the picker: openModal stands the picker down
  // rather than refusing a second modal.
  openModal(sheet,{initialFocus:name,returnFocus:customReturn,onEscape:cancelCustomExerciseSheet,scrim,
    handoff,delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}

function closeCustomExerciseSheet(){
  const sheet=$("#exCustomSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  customReturn=null;
  return closeModal(sheet)}
/* Backing out of the custom form returns to the picker it came from, with the
   search and any multi-selection intact. Dropping the lifter back to the
   program instead would throw away a browse they never finished. */
async function cancelCustomExerciseSheet(){
  const back=customState?.onCancel;
  await closeCustomExerciseSheet();
  if(back)back()}

async function saveCustomExerciseSheet(){
  if(!customState)return;
  const name=String($("#exCustomName")?.value||"").trim();
  if(!name){toast(t("toast.custom_needs_name"));return}
  // Equipment and a primary muscle are what make the definition usable: the
  // wizard filters on one and the volume audit groups by the other.
  if(!customState.equipment.size){toast(t("toast.custom_needs_equipment"));return}
  if(!customState.primary.size){toast(t("toast.custom_needs_primary"));return}
  if(!customState.id){
    const twin=pickableExercises().find(e=>foldSearch(libraryName(e))===foldSearch(name)||foldSearch(e.name)===foldSearch(name));
    if(twin&&!customState.duplicateAcknowledged){
      // Offer what already exists before minting a near-identical second copy.
      if(confirm(t("confirm.custom_duplicate",{name:libraryName(twin)}))){
        const handler=customState.onSave;
        await closeCustomExerciseSheet();
        if(handler)await handler(twin);
        return}
      customState.duplicateAcknowledged=true}}
  const handler=customState.onSave;
  const editing=!!customState.id;
  if(customState.stageOnly){
    const staged=normalizeCustomExercises([{id:customState.id||`${CUSTOM_ID_PREFIX}${uid()}`,name,
      equipment:[...customState.equipment],
      primary:[...customState.primary].join(","),
      secondary:[...customState.secondary].join(","),
      notes:String($("#exCustomNotes")?.value||"").trim()}])[0];
    await closeCustomExerciseSheet();
    if(handler&&staged)await handler(staged);
    return}
  const {result,entry}=await saveCustomExercise({id:customState.id,name,
    equipment:[...customState.equipment],
    primary:[...customState.primary].join(","),
    secondary:[...customState.secondary].join(","),
    notes:String($("#exCustomNotes")?.value||"").trim()});
  if(result&&!(result.localOk||result.idbOk)){toast(t("toast.custom_save_failed"));return}
  await closeCustomExerciseSheet();
  toast(t(editing?"toast.custom_saved":"toast.custom_created"));
  if(handler&&entry)await handler(entry);
  else if(pickerState)renderPickerList()}

async function deleteCustomExerciseSheet(){
  if(!customState?.id)return;
  const result=await deleteCustomExercise(customState.id);
  if(!result){toast(t("toast.custom_in_use"));return}
  if(!(result.localOk||result.idbOk)){toast(t("toast.custom_save_failed"));return}
  await closeCustomExerciseSheet();
  toast(t(result.archived?"toast.custom_archived":"toast.custom_deleted"));
  if(libFlow)renderLibrary();else if(pickerState)renderPickerList()}

/** Clipboard first; the hidden-textarea path covers browsers that refuse the
 *  async clipboard, and only a genuine failure of both surfaces a toast. */
async function copyProgramText(){
  const text=$("#programTextOut")?.textContent||programText();
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);
    toast(t("toast.program_text_copied"));return true}}catch{}
  try{const ta=document.createElement("textarea");
    ta.value=text;ta.setAttribute("readonly","");
    ta.style.cssText="position:fixed;top:0;left:0;opacity:0";
    document.body.append(ta);ta.select();
    const ok=document.execCommand("copy");ta.remove();
    if(ok){toast(t("toast.program_text_copied"));return true}}catch{}
  toast(t("toast.program_text_copy_failed"));return false}
function shareProgramText(){
  return shareOrDownload($("#programTextOut")?.textContent||programText(),programTextName(),"text/plain")}
/* An imported split arrives as names. Matching them to the library is what
   turns it from a list of strings into something the app can reason about:
   muscle tags for the volume audit, and a link the swap picker can work from.
   Names that find no match keep exactly what was imported — the program is the
   lifter's, not the library's — and their slots show an accented swap button
   in the editor so linking them by hand is one tap. */
function linkImportedExercises(list){
  const byName=new Map();
  for(const entry of pickableExercises()){
    for(const n of [entry.name,entry.namePt]){
      const key=foldSearch(n);
      if(key&&!byName.has(key))byName.set(key,entry)}}
  let linked=0;
  for(const ex of list){
    if(!ex||typeof ex!=="object")continue;
    // A Taurifer export already carries links; only repoint ids the library
    // has since merged, and never overwrite a link that still resolves.
    if(ex.libraryId){
      const known=libraryEntry(ex.libraryId);
      if(known){ex.libraryId=known.id;linked++;continue}
      delete ex.libraryId}
    const match=byName.get(foldSearch(ex.name));
    if(!match)continue;
    ex.libraryId=match.id;
    if(!String(ex.primary??"").trim())ex.primary=match.primary||"";
    if(!String(ex.secondary??"").trim())ex.secondary=match.secondary||"";
    if(!String(ex.notes??"").trim()&&match.notes)ex.notes=match.notes;
    linked++}
  return{linked,total:list.length}}

/* ============================================================
   Program import — staged, reviewed, then written
   Parsing produces a transient model only. Nothing durable moves
   until the lifter presses Import, so a file that turns out to be
   wrong costs them nothing. Names are classified rather than
   guessed at: an exact hit links itself, a likely one has to be
   looked at, and anything else keeps exactly what was imported.
   ============================================================ */

const IMPORT_EXACT="exact",IMPORT_ALIAS="alias",IMPORT_PROBABLE="probable",IMPORT_UNMATCHED="unmatched";
let importDraft=null,importReturn=null;

/* Taurifer's own text export, read back. The grammar is the one programText()
   writes: a title line, then "DAY NAME: muscles", then "1. Exercise: 3× 6 to 10".
   Anything that does not look like that is rejected rather than guessed at —
   this parses one known format, it does not read prose. */
/* The text export shouts day names ("DAY 1", "TREINO A") for legibility, so a
   round-trip would otherwise bring the shouting back into the program. A label
   with no lowercase at all was uppercased on the way out; anything else is left
   exactly as written. */
function restoreExportCase(label){
  if(label!==label.toLocaleUpperCase(locTag())||!/[a-z]/i.test(label))return label;
  return label.toLocaleLowerCase(locTag()).replace(/(^|\s)(\p{L})/gu,(m,sp,ch)=>sp+ch.toLocaleUpperCase(locTag()))}
function stripProgramTextTitleMeta(label){
  return String(label||"").replace(/\s*(?:\(\s*|,\s*)\d+\s*(?:days?\s*\/\s*week|days?\s+per\s+week|dias?\s*\/\s*semana|dias?\s+por\s+semana)\s*\)?\s*$/iu,"").trim()}
function parseProgramTextExport(text){
  const lines=String(text||"").split(/\r?\n/);
  const dataIndex=lines.findIndex(line=>line.trim()===PROGRAM_TEXT_DATA_MARKER);
  let data=null;
  if(dataIndex>=0){try{const parsed=JSON.parse(lines[dataIndex+1]||"");if(parsed&&parsed.version===1)data=parsed}catch{}}
  const content=dataIndex<0?lines:lines.filter((_,index)=>index!==dataIndex&&index!==dataIndex+1);
  const days=[];let current=null,title="";
  const exRe=/^\s*(\d+)\.\s*(.+?)(?:\s*[—-]\s*|\s*:\s*)(\d+)\s*[×x]\s*(\d+)(?:\s*(?:[–-]|to|a)\s*(\d+))?\s*$/iu;
  for(const raw of content){
    const line=raw.trim();
    if(!line)continue;
    const ex=line.match(exRe);
    if(ex){
      if(!current){current={day:`Day ${days.length+1}`,rows:[]};days.push(current)}
      const min=+ex[4],max=ex[5]?+ex[5]:min;
      const legacy=ex[2].trim().match(/^(.*)\s+\[(range|manual|rep_goal|anchor_backoff)@(\d+)\]$/iu);
      const row={name:(legacy?.[1]||ex[2]).trim(),sets:+ex[3],min,max};
      // Read the pre-appendix range marker without exposing it in the new
      // export. Its parameters are the already-authored text targets; other
      // strategy markers remain structural and cannot invent executable data.
      if(legacy?.[2].toLowerCase()==="range"&&legacy[3]==="1")row.progression={
        schemaVersion:1,strategy:{id:"range",version:1,params:{workingSets:row.sets,repMin:row.min,repMax:row.max}},modifiers:[]};
      current.rows.push(row);
      continue}
    // A non-exercise line starts a day, except the first which is the title.
    if(!title&&!days.length){title=restoreExportCase(stripProgramTextTitleMeta(line));continue}
    const label=line.split(/\s*[—-]\s+|\s*:\s+/)[0].trim();
    if(!label)continue;
    current={day:restoreExportCase(label),rows:[]};days.push(current)}
  const exercises=[];
  for(const d of days)
    d.rows.forEach((r,i)=>{
      const carried=data?.exercises?.find(ex=>ex?.day===d.day&&ex?.order===i+1);
      exercises.push({day:d.day,order:i+1,name:r.name,sets:r.sets,min:r.min,max:r.max,
        ...(carried?.id?{id:carried.id}:{ }),...(carried?.movementId?{movementId:carried.movementId}:{ }),
        ...(carried?.progression?{progression:carried.progression}:r.progression?{progression:r.progression}:{}),
        ...(carried?.progressionIncompatibility?{progressionIncompatibility:carried.progressionIncompatibility}:{} )});
    });
  if(!exercises.length)return null;
  const metaOut=title?{name:title}:null;
  if(metaOut&&data){if(Array.isArray(data.relations))metaOut.progressionRelations=data.relations;if(Array.isArray(data.modifiers))metaOut.progressionModifiers=data.modifiers;if(Array.isArray(data.incompatibilities))metaOut.progressionIncompatibilities=data.incompatibilities}
  return{exercises,meta:metaOut,customExercises:[]}}

/* Reads whatever the file turns out to be. JSON first, then the text export. */
function parseProgramSource(text,fileName=""){
  const trimmed=String(text||"").trim();
  if(trimmed.startsWith("{")||trimmed.startsWith("[")){
    let parsed=null;
    try{parsed=JSON.parse(trimmed)}catch{return null}
    const imp=parseProgramImport(parsed);
    return imp?.exercises?.length?Object.assign({format:"json"},imp):null}
  const text2=parseProgramTextExport(trimmed);
  return text2?Object.assign({format:"text"},text2):null}

/* How close two movement names are, 0..1, on shared words. Deliberately dumb:
   it only has to be good enough to say "look at this one", never to decide. */
function nameAffinity(a,b){
  const wa=foldSearch(a).split(/[^a-z0-9]+/).filter(w=>w.length>2);
  const wb=new Set(foldSearch(b).split(/[^a-z0-9]+/).filter(w=>w.length>2));
  if(!wa.length||!wb.size)return 0;
  const hits=wa.filter(w=>wb.has(w)).length;
  return hits/Math.max(wa.length,wb.size)}

const IMPORT_PROBABLE_MIN=0.5;

/* Classifies one imported row against the library plus the definitions that
   travelled with the file. */
function classifyImportRow(row,candidates){
  const name=String(row.name??"").trim();
  if(row.libraryId){
    const known=candidates.find(e=>e.id===row.libraryId)||libraryEntry(row.libraryId);
    if(known)return{status:IMPORT_EXACT,match:known}}
  const folded=foldSearch(name);
  if(!folded)return{status:IMPORT_UNMATCHED,match:null};
  const exact=candidates.find(e=>foldSearch(e.name)===folded);
  if(exact)return{status:IMPORT_EXACT,match:exact};
  // The same movement written in the other language is a match, but one the
  // lifter should still see, since the name in their file will change.
  const alias=candidates.find(e=>foldSearch(e.namePt||"")===folded);
  if(alias)return{status:IMPORT_ALIAS,match:alias};
  let best=null,bestScore=0;
  for(const e of candidates){
    const score=Math.max(nameAffinity(name,e.name),nameAffinity(name,e.namePt||""));
    if(score>bestScore){bestScore=score;best=e}}
  if(best&&bestScore>=IMPORT_PROBABLE_MIN)return{status:IMPORT_PROBABLE,match:best,score:bestScore};
  return{status:IMPORT_UNMATCHED,match:null}}

/* Builds the review model. Exact and alias hits arrive decided; a probable one
   arrives undecided and blocks Import until it is looked at. */
function buildImportDraft(source,fileName){
  const candidates=source.customExercises?.length
    ? normalizeCustomExercises(source.customExercises).concat(pickableExercises())
    : pickableExercises();
  const rows=source.exercises.map((raw,i)=>{
    const {status,match}=classifyImportRow(raw,candidates);
    return{key:`imp${i}`,raw:cloneSnapshot(raw),status,match,
      decision:status===IMPORT_EXACT||status===IMPORT_ALIAS?"link":"raw",
      reviewed:status===IMPORT_EXACT||status===IMPORT_ALIAS}});
  return{fileName:String(fileName||""),format:source.format||"json",
    meta:source.meta||null,customExercises:source.customExercises||[],rows}}

const importCounts=draft=>{
  const linked=draft.rows.filter(r=>r.decision==="link").length;
  const review=draft.rows.filter(r=>!r.reviewed).length;
  const custom=draft.rows.filter(r=>r.decision==="custom").length;
  return{linked,review,custom,total:draft.rows.length}};

/* Turns reviewed rows into program templates. A linked row takes the
   definition's identity; a raw row keeps precisely what the file said. */
function importDraftExercises(draft){
  return draft.rows.map(r=>{
    const base=cloneSnapshot(r.raw);
    delete base.libraryId;delete base.displayName;
    if(r.decision==="link"&&r.match)
      return Object.assign(base,exerciseFieldsFromLibrary(r.match));
    if(r.decision==="custom"&&r.createdCustomId)
      return Object.assign(base,{libraryId:r.createdCustomId});
    return base})}

/* Definitions that have to exist before the templates can resolve: the ones
   that travelled in a v3 file, plus any created during review. */
function importDraftCustomDefinitions(draft){
  const out=[];
  for(const e of normalizeCustomExercises(draft.customExercises))out.push(e);
  for(const r of draft.rows)if(r.createdCustom)out.push(r.createdCustom);
  return out}

/* ============================================================
   The library flow
   One controller behind three surfaces: the quick-add sheet on a
   training day, the full browse page it opens into, and the
   configuration step that follows a multi-selection. The picker
   sheet keeps serving the single-pick jobs (change, substitute,
   alternates) — this is the "add to my program" path, where
   choosing several at once and setting their sets afterwards is
   what a lifter actually does.
   ============================================================ */

const LIB_TABS=["suggested","recent","yours"];
const LIB_PAGE_TABS=["search","browse","yours"];
let libFlow=null,libReturn=null,previewState=null;

/* What this day is short of. A day that already has two chest presses does not
   need a third suggested; one with no back work does. Ranked so the staple for
   an uncovered pattern leads. */
function suggestedForDay(dayName,limit=6){
  const onDay=prog.forDay(dayName);
  const have=new Set(onDay.map(e=>e.libraryId).filter(Boolean));
  const covered=new Set();
  for(const e of onDay)for(const m of muscles(e.primary))covered.add(m);
  const scored=[];
  for(const e of EXERCISE_LIBRARY){
    if(have.has(e.id))continue;
    const prim=muscles(e.primary);
    const fresh=prim.some(m=>!covered.has(m));
    scored.push({e,score:(fresh?0:1)*100+(e.rank??50)})}
  scored.sort((a,b)=>a.score-b.score||libraryName(a.e).localeCompare(libraryName(b.e)));
  return scored.slice(0,limit).map(x=>x.e)}

/* Most recently trained first, so the movements a lifter keeps coming back to
   are the ones they see. Reads library ids, which survive a language change. */
function recentExercises(limit=8){
  const seen=[],ids=new Set();
  const log=[...(state.log||[])].sort((a,b)=>String(b.created||"").localeCompare(String(a.created||"")));
  const add=id=>{if(!id||ids.has(id))return;const entry=libraryEntry(id);if(!entry)return;ids.add(id);seen.push(entry)};
  for(const r of log){
    if(seen.length>=limit)break;
    if(r.performedLibraryId)add(r.performedLibraryId)}
  for(const e of state.program||[]){if(seen.length>=limit)break;add(e.libraryId)}
  return seen.slice(0,limit)}

const yourExercises=()=>customExercises().filter(e=>!e.archived);

function libTabList(tab,{page=false}={}){
  if(tab==="yours")return yourExercises();
  if(tab==="recent")return recentExercises();
  if(tab==="suggested")return suggestedForDay(libFlow?.day||day);
  return pickableExercises()}

/* ---- quick add ---- */

function renderQuickTabs(){
  const el=$("#exPickTabs");if(!el||!pickerState?.quick)return;
  el.classList.remove("hidden");
  el.innerHTML=LIB_TABS.map(tab=>
    `<button type="button" role="tab" class="picktab${pickerState.tab===tab?" is-active":""}" `+
    `aria-selected="${pickerState.tab===tab?"true":"false"}" data-tab="${tab}">${esc(t("picker.tab."+tab))}</button>`).join("");
  $$("#exPickTabs .picktab").forEach(b=>b.onclick=()=>{pickerState.tab=b.dataset.tab;renderQuickTabs();renderPickerList()})}

/* ---- full library page ---- */

function librarySelectionMap(selected){const out=new Map();
  for(const item of Array.isArray(selected)?selected:[]){
    const pair=Array.isArray(item)?item:[item,null],id=String(pair[0]||"");if(!id)continue;
    out.set(id,pair[1]?cloneSnapshot(pair[1]):null)}
  return out}
function libraryResumeOptions(){
  if(!libFlow)return null;
  return{day:libFlow.day,tab:libFlow.tab,query:libFlow.query,muscle:libFlow.muscle,
    equipment:libFlow.equipment,step:libFlow.step,selected:[...libFlow.selected.entries()].map(cloneSnapshot)}}
function openLibrary({day:dayName=day,selected=[],step="browse",tab="browse",query="",muscle=null,equipment=null}={}){
  libFlow={day:dayName,tab:LIB_PAGE_TABS.includes(tab)?tab:"browse",query:String(query||""),muscle,equipment,step,
    selected:librarySelectionMap(selected)};
  libReturn=document.activeElement;
  document.body.classList.add("is-library");
  document.body.classList.remove("is-preview");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="library"));
  window.scrollTo({top:0});
  const search=$("#libSearch");if(search)search.value=libFlow.query;
  renderLibrary();
  search?.focus({preventScroll:true})}

function closeLibrary({toProgram=true}={}){
  libFlow=null;
  document.body.classList.remove("is-library","is-preview");
  const back=resolveReturnFocus(libReturn);libReturn=null;
  if(toProgram)returnToTab("program");
  if(back)try{back.focus({preventScroll:true})}catch{}}

function renderLibrary(){
  if(!libFlow)return;
  const configuring=libFlow.step==="configure";
  $("#libBrowse")?.classList.toggle("hidden",configuring);
  $("#libConfigure")?.classList.toggle("hidden",!configuring);
  const title=$("#libTitle");
  if(title)title.textContent=configuring?t("library.configure_title",{day:dayLabel(libFlow.day)}):t("library.title");
  const step=$("#libStep");
  if(step){step.classList.remove("hidden");
    step.innerHTML=`<p class="libstep__lab">${esc(t("library.step",{n:configuring?2:1,total:2}))}</p>`+
      `<span class="libstep__bar${configuring?" is-done":""}" aria-hidden="true"></span>`+
      `<span class="libstep__bar${configuring?" is-done":""}" aria-hidden="true"></span>`}
  if(configuring)renderLibraryConfigure();else renderLibraryBrowse();
  renderLibraryBar()}

function renderLibraryTabs(){
  const el=$("#libTabs");if(!el)return;
  el.innerHTML=LIB_PAGE_TABS.map(tab=>
    `<button type="button" role="tab" class="picktab${libFlow.tab===tab?" is-active":""}" `+
    `aria-selected="${libFlow.tab===tab?"true":"false"}" data-tab="${tab}">${esc(t("picker.tab."+tab))}</button>`).join("");
  $$("#libTabs .picktab").forEach(b=>b.onclick=()=>{libFlow.tab=b.dataset.tab;renderLibrary()})}

function renderLibraryFilters(){
  const el=$("#libFilters");if(!el)return;
  // Muscle and equipment are separate ideas, so they get separate rails here
  // rather than one undifferentiated row of chips.
  const chip=(kind,val,label,active)=>
    `<button type="button" class="pchip${active?" is-active":""}" data-lf="${kind}" data-val="${esc(val)}" aria-pressed="${active?"true":"false"}">${esc(label)}</button>`;
  const muscleRow=[chip("clear","",t("picker.filter_all"),!libFlow.muscle&&!libFlow.equipment)]
    .concat(PICKER_MUSCLE_GROUPS.map(([key])=>chip("muscle",key,t("picker.group."+key),libFlow.muscle===key)));
  const equipRow=PICKER_EQUIPMENT.map(eq=>chip("equipment",eq,t("picker.equipment."+eq),libFlow.equipment===eq));
  el.innerHTML=`<div class="pick__filters pick__filters--row">${muscleRow.join("")}</div>`+
    `<div class="pick__filters pick__filters--row">${equipRow.join("")}</div>`;
  $$("#libFilters .pchip").forEach(b=>b.onclick=()=>{
    const kind=b.dataset.lf;
    if(kind==="clear"){libFlow.muscle=null;libFlow.equipment=null}
    else if(kind==="muscle")libFlow.muscle=libFlow.muscle===b.dataset.val?null:b.dataset.val;
    else libFlow.equipment=libFlow.equipment===b.dataset.val?null:b.dataset.val;
    renderLibrary()})}

function renderLibraryBrowse(){
  renderLibraryTabs();renderLibraryFilters();
  const list=$("#libList");if(!list)return;
  const source=libFlow.tab==="yours"?yourExercises():pickableExercises();
  const rows=source.filter(e=>exerciseMatches(e,libFlow.query,libFlow.muscle,libFlow.equipment))
    .sort((a,b)=>(a.rank??50)-(b.rank??50)||libraryName(a).localeCompare(libraryName(b)));
  list.innerHTML=rows.length
    ?rows.map(e=>libraryRowHtml(e)).join("")
    :`<p class="pick__empty">${esc(t("picker.empty",{q:libFlow.query}))}</p>`;
  $$("#libList [data-lib-toggle]").forEach(b=>b.onclick=()=>toggleLibrarySelection(b.dataset.libToggle));
  $$("#libList [data-lib-preview]").forEach(b=>b.onclick=()=>openExercisePreview(b.dataset.libPreview));
  $$("#libList [data-lib-edit]").forEach(b=>b.onclick=()=>editCustomExercise(b.dataset.libEdit))}

function libraryRowHtml(e){
  const on=libFlow.selected.has(e.id);
  const mus=[e.primary,e.secondary].filter(Boolean).join(",").split(",").filter(Boolean).slice(0,2).map(muscleLabel);
  const eq=(e.equipment||[])[0];
  const meta=[mus.join(" · "),eq?t("picker.equipment."+eq):""].filter(Boolean).join(" · ");
  return `<div class="librow${on?" is-selected":""}" data-lib-row="${esc(e.id)}">`+
    `<button type="button" class="librow__preview" data-lib-preview="${esc(e.id)}" aria-label="${esc(t("library.preview_aria",{name:libraryName(e)}))}">`+
      exerciseThumb(e,{size:"md"})+
    `</button>`+
    `<div class="librow__text">`+
      `<p class="librow__name">${esc(libraryName(e))}</p>`+
      `<p class="librow__meta">${esc(meta)}</p>`+
      (isCustomLibraryId(e.id)
        ?`<button type="button" class="librow__edit" data-lib-edit="${esc(e.id)}">${esc(t("library.edit"))}</button>`:"")+
    `</div>`+
    `<button type="button" class="librow__check${on?" is-on":""}" role="checkbox" aria-checked="${on?"true":"false"}" `+
      `data-lib-toggle="${esc(e.id)}" aria-label="${esc(t(on?"library.remove_aria":"library.add_aria",{name:libraryName(e)}))}"></button>`+
  `</div>`}

function toggleLibrarySelection(id){
  if(!libFlow)return;
  if(libFlow.selected.has(id))libFlow.selected.delete(id);
  else libFlow.selected.set(id,null);
  renderLibrary()}

function renderLibraryBar(){
  const bar=$("#libBar"),count=$("#libBarCount"),primary=$("#libPrimary");
  if(!bar||!primary)return;
  const n=libFlow.selected.size;
  bar.classList.toggle("is-hidden",n===0);
  if(count)count.textContent=n?t("library.selected",{n}):"";
  primary.textContent=libFlow.step==="configure"
    ?t("library.save_day",{day:dayLabel(libFlow.day)})
    :t("library.add_n",{n,day:dayLabel(libFlow.day)});
  primary.disabled=n===0}

/* ---- configure step ---- */

function libraryConfigureRows(){
  return [...libFlow.selected.entries()].map(([id,cfg])=>{
    const entry=libraryEntry(id);
    return{id,entry,cfg:cfg||{sets:3,min:6,max:10}}}).filter(r=>r.entry)}

function renderLibraryConfigure(){
  const el=$("#libConfigureRows");if(!el)return;
  const rows=libraryConfigureRows();
  const count=$("#libConfigureCount");
  if(count)count.textContent=t("library.configure_count",
    {n:rows.length,sets:rows.reduce((a,r)=>a+r.cfg.sets,0)});
  el.innerHTML=rows.map(r=>
    `<div class="libcfg" data-cfg="${esc(r.id)}">`+
      exerciseThumb(r.entry,{size:"md"})+
      `<div class="libcfg__body">`+
        `<p class="libcfg__name">${esc(libraryName(r.entry))}</p>`+
        `<div class="libcfg__fields">`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.sets"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="sets" value="${r.cfg.sets}"></label>`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.min_reps"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="min" value="${r.cfg.min}"></label>`+
          `<label class="libcfg__field"><span>${esc(t("program.exercise.max_reps"))}</span>`+
            `<input type="number" inputmode="numeric" min="1" step="1" data-cfg-id="${esc(r.id)}" data-cfg-field="max" value="${r.cfg.max}"></label>`+
        `</div>`+
      `</div>`+
      `<button type="button" class="libcfg__drop" data-cfg-drop="${esc(r.id)}" aria-label="${esc(t("library.remove_aria",{name:libraryName(r.entry)}))}">`+
        `<span class="icon-mask icon-mask--sm icon-mask--close" aria-hidden="true"></span></button>`+
    `</div>`).join("");
  $$("#libConfigureRows [data-cfg-field]").forEach(inp=>{
    inp.onfocus=()=>inp.select();
    inp.oninput=()=>{
      const id=inp.dataset.cfgId,field=inp.dataset.cfgField;
      const cur=libFlow.selected.get(id)||{sets:3,min:6,max:10};
      const next=Object.assign({},cur,{[field]:Exercise.posInt(inp.value,cur[field])});
      if(next.max<next.min)next.max=next.min;
      libFlow.selected.set(id,next)}});
  $$("#libConfigureRows [data-cfg-drop]").forEach(b=>b.onclick=()=>{
    libFlow.selected.delete(b.dataset.cfgDrop);
    if(!libFlow.selected.size){libFlow.step="browse"}
    renderLibrary()})}

async function commitLibrarySelection(){
  if(!libFlow||!libFlow.selected.size)return null;
  if(libFlow.step!=="configure"){libFlow.step="configure";renderLibrary();window.scrollTo({top:0});return null}
  const rows=libraryConfigureRows();
  const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
  for(const r of rows){
    const added=nextProgram.addExercise(libFlow.day,r.entry);
    added.sets=r.cfg.sets;added.min=r.cfg.min;added.max=Math.max(r.cfg.min,r.cfg.max)}
  proposal.program=nextProgram.toJSON();
  const result=await commitProposedState(proposal);
  if(!(result.localOk||result.idbOk)){toast(t("toast.program_save_failed"));return result}
  const n=rows.length,target=libFlow.day;
  setDayCollapsed(target,false);
  closeLibrary({toProgram:true});
  render();
  toast(t("toast.exercises_added",{n}));
  return result}

/* ---- exercise preview ---- */

function openExercisePreview(id){
  const entry=libraryEntry(id);if(!entry)return;
  previewState={id,from:libFlow?"library":"picker",returnId:id};
  document.body.classList.add("is-preview");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="exercisePreview"));
  window.scrollTo({top:0});
  renderExercisePreview();
  $("#previewBack")?.focus({preventScroll:true})}

function closeExercisePreview(){
  const back=previewState?.from,returnId=previewState?.returnId;
  previewState=null;
  document.body.classList.remove("is-preview");
  if(back==="library"&&libFlow){$$(".view").forEach(v=>v.classList.toggle("active",v.id==="library"));renderLibrary();
    requestAnimationFrame(()=>{const target=$(`[data-lib-preview="${CSS.escape(returnId||"")}"]`);if(target)target.focus({preventScroll:true})})}
  else{document.body.classList.remove("is-library");returnToTab("program")}}

function renderExercisePreview(){
  const el=$("#previewBody");if(!el||!previewState)return;
  const e=libraryEntry(previewState.id);if(!e)return;
  const prim=muscles(e.primary).map(muscleLabel).join(" · ");
  const sec=muscles(e.secondary).map(muscleLabel).join(" · ");
  const eq=(e.equipment||[]).map(x=>t("picker.equipment."+x)).join(" · ");
  const inLibrary=!!libFlow;
  const selected=inLibrary&&libFlow.selected.has(e.id);
  el.innerHTML=
    `<p class="preview__eyebrow">${esc(prim)}</p>`+
    `<h2 class="preview__title">${esc(libraryName(e))}</h2>`+
    `<p class="preview__sub">${esc(eq)}</p>`+
    // A large illustration carries instructional content, so it is described
    // rather than hidden; the empty tile has nothing to describe.
    (exerciseMedia(e)
      ?`<img class="exthumb exthumb--lg" src="${esc(exerciseMedia(e))}" alt="${esc(t("preview.art_alt",{name:libraryName(e)}))}" decoding="async" width="768" height="768">`
      :`<span class="exthumb exthumb--lg exthumb--empty" aria-hidden="true"></span>`)+
    `<h3 class="preview__head">${esc(t("preview.muscles"))}</h3>`+
    `<dl class="preview__rows">`+
      `<div class="preview__row"><dt>${esc(t("program.exercise.primary"))}</dt><dd>${esc(prim||"—")}</dd></div>`+
      `<div class="preview__row"><dt>${esc(t("program.exercise.secondary"))}</dt><dd>${esc(sec||"—")}</dd></div>`+
    `</dl>`+
    (e.notes?`<h3 class="preview__head">${esc(t("program.exercise.setup_notes"))}</h3><p class="preview__notes">${esc(e.notes)}</p>`:"")+
    (inLibrary
      ?`<button type="button" class="btn btn--cta" id="previewAdd">${esc(t(selected?"preview.remove":"preview.add",{day:dayLabel(libFlow.day)}))}</button>`
      :"");
  const add=$("#previewAdd");
  if(add)add.onclick=()=>{toggleLibrarySelection(e.id);closeExercisePreview()}}

/* ---- Import review screen ---- */

const importStatusKey={[IMPORT_EXACT]:"import.status.exact",[IMPORT_ALIAS]:"import.status.alias",
  [IMPORT_PROBABLE]:"import.status.probable",[IMPORT_UNMATCHED]:"import.status.unmatched"};

function renderImportReview(){
  if(!importDraft)return;
  const counts=importCounts(importDraft);
  const file=$("#importFile");
  if(file)file.textContent=t("import.file",{name:importDraft.fileName||t("import.file_fallback"),n:counts.total});
  const countsEl=$("#importCounts");
  if(countsEl)countsEl.innerHTML=
    `<span class="impcount"><b>${counts.linked}</b>${esc(t("import.count_linked"))}</span>`+
    `<span class="impcount"><b>${counts.review}</b>${esc(t("import.count_review"))}</span>`+
    `<span class="impcount"><b>${counts.custom}</b>${esc(t("import.count_custom"))}</span>`;
  const rows=$("#importRows");
  if(rows){
    // Rows still needing a decision come first: they are the only reason this
    // screen exists, and a twelve-exercise split should not hide them.
    const ordered=[...importDraft.rows].sort((a,b)=>(a.reviewed?1:0)-(b.reviewed?1:0));
    rows.innerHTML=ordered.map(importRowHtml).join("");
    $$("#importRows [data-imp-act]").forEach(b=>b.onclick=()=>importRowAction(b.dataset.impAct,b.dataset.impKey));
  }
  const commit=$("#importCommit");
  if(commit){
    commit.disabled=counts.review>0;
    commit.textContent=counts.review>0?t("import.commit_blocked",{n:counts.review}):t("import.commit")}
}

function importRowHtml(row){
  // An unreviewed row shows what is being proposed, not the standing default:
  // "keep as imported" beside a Likely badge hides the very thing being asked
  // about. Once decided, the target is the decision.
  const proposed=!row.reviewed&&row.match?row.match:null;
  const shown=row.decision==="link"&&row.match?row.match:proposed;
  const target=shown?libraryName(shown)
    :row.decision==="custom"?t("import.target_custom")
    :t("import.target_raw");
  const badge=row.reviewed
    ?`<span class="impbadge is-done">${esc(t("import.status.confirmed"))}</span>`
    :`<span class="impbadge is-open">${esc(t(importStatusKey[row.status]||"import.status.unmatched"))}</span>`;
  const art=shown?exerciseThumb(shown,{size:"sm"}):emptyThumb({size:"sm"});
  // A settled row keeps its name, its target, its art and its badge, and trades
  // its three remaining alternatives for one quiet way back in. Most settled
  // rows were matched by the importer rather than chosen by the lifter, so the
  // alternatives are noise on the screen you read before replacing a program.
  const folded=row.reviewed&&!row.expanded;
  const acts=folded
    ?`<button type="button" class="improw__btn improw__btn--change" data-imp-act="expand" data-imp-key="${esc(row.key)}">${esc(t("import.action_change"))}</button>`
    :(row.match&&row.decision!=="link"
        ?`<button type="button" class="improw__btn" data-imp-act="link" data-imp-key="${esc(row.key)}">${esc(t("import.action_link",{name:libraryName(row.match)}))}</button>`:"")+
      `<button type="button" class="improw__btn" data-imp-act="choose" data-imp-key="${esc(row.key)}">${esc(t("import.action_choose"))}</button>`+
      // Shown while a row still needs a decision even when "keep" is already
      // the standing choice: an unmatched row has to be acknowledged, not just
      // defaulted, or there is no way to clear it off the review list.
      (row.decision!=="raw"||!row.reviewed
        ?`<button type="button" class="improw__btn" data-imp-act="raw" data-imp-key="${esc(row.key)}">${esc(t("import.action_keep"))}</button>`:"")+
      (row.decision!=="custom"
        ?`<button type="button" class="improw__btn" data-imp-act="custom" data-imp-key="${esc(row.key)}">${esc(t("import.action_custom"))}</button>`:"");
  return `<div class="improw${row.reviewed?"":" is-open"}${folded?" is-folded":""}" data-imp-row="${esc(row.key)}">`+
    `<p class="improw__from">${esc(row.raw.name||"")}</p>`+
    `<span class="improw__arrow" aria-hidden="true">→</span>`+
    art+
    `<div class="improw__to"><p class="improw__name">${esc(target)}</p>${badge}</div>`+
    `<div class="improw__acts">${acts}</div>`+
  `</div>`}

function importRowAction(act,key){
  const row=importDraft?.rows.find(r=>r.key===key);
  if(!row)return;
  // Change only reopens the row: the decision it already carries is untouched,
  // so a lifter who taps it and changes their mind still imports what they saw.
  // The render replaces the row's markup, so the caret is put back on the
  // controls the tap was asking for rather than dropped to the document.
  if(act==="expand"){row.expanded=true;renderImportReview();
    $(`#importRows [data-imp-row="${esc(row.key)}"] [data-imp-act]`)?.focus({preventScroll:true});return}
  if(act==="link"&&row.match){row.decision="link";settleImportRow(row);return}
  if(act==="raw"){row.decision="raw";settleImportRow(row);return}
  if(act==="choose"){
    openExercisePicker({title:t("import.pick_title"),subtitle:row.raw.name||"",
      onPick:entry=>{row.match=entry;row.decision="link";settleImportRow(row)}});
    return}
  if(act==="custom"){
    // Creating the definition here rather than at commit time means the lifter
    // sees exactly what will exist before anything is written.
    openCustomExerciseSheet({entry:{name:row.raw.name||"",primary:row.raw.primary||"",secondary:row.raw.secondary||""},
      stageOnly:true,
      onSave:entry=>{row.createdCustom=entry;row.createdCustomId=entry.id;
        row.decision="custom";settleImportRow(row)}})}}
/** A decided row folds back down: the alternatives have done their job. */
function settleImportRow(row){row.reviewed=true;row.expanded=false;renderImportReview()}

function openImportReview(draft){
  importDraft=draft;
  captureEvent("program_path_selected",{route:"import"});
  importReturn=document.activeElement;
  // The review renders inside the app shell, so the first-run gate steps aside
  // for it rather than covering it.
  if(draft?.fromFirstRun)suspendFirstRun();
  document.body.classList.add("is-import");
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="importReview"));
  window.scrollTo({top:0});
  renderImportReview();
  const counts=importCounts(draft),target=counts.review
    ?$("#importRows .improw.is-open [data-imp-act]")
    :$("#importCommit");
  (target||$("#importBack"))?.focus({preventScroll:true})}

function closeImportReview({toProgram=true}={}){
  const wasOnboarding=importDraft?.onboarding,wasFirstRun=importDraft?.fromFirstRun;
  importDraft=null;
  document.body.classList.remove("is-import");
  const back=resolveReturnFocus(importReturn);
  importReturn=null;
  // Backing out of an import started during onboarding returns to onboarding —
  // or to the setup gate it came from. Either way the lifter has no program yet,
  // so they cannot be dropped into the app.
  if(wasFirstRun&&toProgram){openFirstRun();return}
  if(wasOnboarding&&toProgram){showOnboardingView();renderOnboarding();return}
  if(toProgram)returnToTab("program");
  if(back)try{back.focus({preventScroll:true})}catch{}}

/* The only place an import touches durable state. Custom definitions and the
   templates that reference them are assembled in one proposal, so neither can
   become durable without the other. */
async function commitImportReview(io=storageIO){
  if(!importDraft)return null;
  const counts=importCounts(importDraft);
  if(counts.review>0){toast(t("toast.import_needs_review",{n:counts.review}));return null}
  const draft=importDraft;
  const exercises=importDraftExercises(draft);
  const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
  const adapter=io||storageIO;
  if(draft.onboarding){
    const name=typeof draft.meta?.name==="string"?draft.meta.name.trim():"";
    const staged=importDraftCustomDefinitions(draft);
    const proposal=cloneSnapshot(state);
    if(staged.length){
      const merged=mergeImportedCustomExercises(staged,exercises,proposal);
      proposal.customExercises=merged.customExercises}
    proposal.programMeta={...proposal.programMeta,
      progressionRelations:cloneSnapshot(draft.meta?.progressionRelations||[]),
      progressionModifiers:cloneSnapshot(draft.meta?.progressionModifiers||[])};
    const setup=await finalizeProgramSetup({exercises,name,answers:onbAnswers,destination:"log",
      origin:onboardingOrigin||"first-run",io:adapter,draftConfirmed:draftActive,discardDraftRaw,baseProposal:proposal,
      telemetryRoute:"import"});
    if(setup&&!(setup.localOk||setup.idbOk)){
      // The write was refused; leave the screen it came from standing so it can
      // be retried.
      if(draft.fromFirstRun)openFirstRun();else{showOnboardingView();renderOnboarding()}
      toast(t("toast.program_import_failed"));return setup}
    closeImportReview({toProgram:false});
    toast(t("toast.program_imported",{n:counts.total}));
    return setup||{localOk:true,idbOk:true}}
  const transition=programTransitionPrecondition(state);
  const proposal=cloneSnapshot(state);
  const merged=mergeImportedCustomExercises(importDraftCustomDefinitions(draft),exercises,proposal);
  proposal.customExercises=merged.customExercises;
  const meta=cloneSnapshot(proposal.programMeta)||defaultProgramMeta(proposal.log);
  if(typeof draft.meta?.name==="string"&&draft.meta.name.trim())meta.name=draft.meta.name.trim();
  meta.updated=new Date().toISOString();
  proposal.programMeta=meta;
  proposal.program=new Program(exercises,snapshotLookup(proposal.customExercises)).toJSON();
  meta.progressionRelations=normalizeProgressionRelations(draft.meta?.progressionRelations,proposal.program);
  meta.progressionModifiers=normalizeProgressionModifiers(draft.meta?.progressionModifiers);
  migrateLogSnapshot(proposal);
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,adapter,{effect,...transition});
  if(!(result.localOk||result.idbOk)){
    // Keep the reviewed decisions on screen: the lifter can press Import again
    // once whatever blocked the write has cleared.
    toast(t("toast.program_import_failed"));return result}
  resetDraftSessionState();
  day=days()[0]||"Day 1";
  closeImportReview({toProgram:true});
  render();
  // An import replaces the program outright — the box shows the new one.
  syncProgramJson({force:true});
  captureEvent("program_activated",{route:"import",version_category:"import_v1"});
  toast(t("toast.program_imported",{n:counts.total}));
  return result}

/* A backup is not a program file. It carries the log, the settings and the meta
   as well as the program, so reading only its exercises drops the rest on the
   floor — silently, because the review screen has nothing to show for a key it
   never looked at. An empty log is no reason to demote one: the language, the
   rest timer, the RIR mode and the program's own name and block are still in
   there, and the lifter restoring onto a fresh install has nothing else left to
   read them out of. Recognised here so the program door can offer the restore
   instead of quietly discarding it. */
function parseBackupFile(text){
  let parsed=null;
  try{parsed=JSON.parse(text)}catch{return null}
  return isImportableState(parsed)?parsed:null}

/* Reading a file no longer changes anything: it opens the review screen. The
   old path linked names and wrote the program behind one confirm(), which meant
   a wrong file had already replaced the program by the time you saw it. */
async function importProgramFile(e,io){const f=e.target.files?.[0];if(!f)return;
  try{
    const text=await f.text();
    const backup=parseBackupFile(text);
    const source=parseProgramSource(text,f.name);
    // A backup whose program is empty is still a backup worth restoring, so the
    // exercise requirement only has to hold for a file that is nothing else.
    if(!backup&&!source?.exercises?.length)throw Error();
    pendingImportIo=io||null;
    let draft=null;
    if(source?.exercises?.length){
      draft=buildImportDraft(source,f.name);
      // An import during onboarding still finishes onboarding: it is how a lifter
      // brings their own split instead of generating one. The setup gate's Import
      // is the same first run by another door, so it commits the same way and
      // returns to the gate if it is abandoned. The review comes first either way.
      draft.fromFirstRun=firstRunOpen();
      draft.onboarding=draft.fromFirstRun||!!$("#onboarding")?.classList.contains("active")}
    if(backup)
      // The button said "program", so program-only stays on the table — but
      // what else the file is carrying is now named out loud and can be
      // restored instead.
      openImportChoice(Object.assign(importChoiceContext(backup,e.target,io),
        {bodyKey:"dialog.import.body_program",programOnly:draft?()=>openImportReview(draft):null}));
    else openImportReview(draft);
  }catch{toast(t("toast.program_import_invalid"))}
  e.target.value=""}
let pendingImportIo=null;
/* What the restore choice needs to state the trade honestly: what this device
   holds, what the file holds, and how much of the file is actually new. */
function importChoiceContext(s,opener,io){
  const have=new Set(state.log.map(r=>r.session));
  return{s,io:io||null,opener,
    inSessions:new Set(s.log.map(r=>r.session)).size,inSets:s.log.length,
    curSessions:have.size,curSets:state.log.length,
    newSessions:new Set(s.log.filter(r=>!have.has(r.session)).map(r=>r.session)).size}}
async function importJson(e){const f=e.target.files?.[0];if(!f)return;
  try{const s=JSON.parse(await f.text());
    if(!isImportableState(s))throw Error();
    openImportChoice(importChoiceContext(s,e.target))}
  catch{toast(t("toast.import_invalid"))}
  e.target.value=""}
/* Restoring answers the setup gate it may have arrived through: the lifter now
   has both a program and a history, so there is nothing left for the gate to
   ask. Idempotent, since the Settings door has no gate standing. */
function leaveSetupGates(){
  if(firstRunOpen())closeFirstRun();
  if($("#onboarding")?.classList.contains("active"))closeOnboarding()}
/* The body and the buttons describe the file that is actually in front of the
   lifter. A backup taken before the first workout carries no sessions at all,
   so the session arithmetic is noise and Merge has nothing to add: what the
   file still holds is the program and the settings, and the choice is restore
   it or leave this device alone. */
function openImportChoice(ctx){const d=$("#importChoice");
  const bodyKey=ctx.bodyKey||"dialog.import.body",mergeable=ctx.inSessions>0;
  $("#importChoiceBody").textContent=t(mergeable?bodyKey:`${bodyKey}_nolog`,{curSessions:ctx.curSessions,curSets:ctx.curSets,inSessions:ctx.inSessions,inSets:ctx.inSets,newSessions:ctx.newSessions});
  const active=document.activeElement;
  // The file input itself is never the way back: it is the invisible half of a
  // label button. Whichever door this came through, focus returns to that
  // label — the Settings row stays the fallback for a caller without one.
  const opener=canTakeFocus(active)?active
    :(ctx.opener?.closest?.("label")||$("#importJson")?.closest("label")||$("#dataImportRow"));
  const close=()=>closeModal(d);
  const io=ctx.io||storageIO;
  const onlyBtn=$("#importProgramOnly"),mergeBtn=$("#importMerge");
  if(onlyBtn)onlyBtn.classList.toggle("hidden",!ctx.programOnly);
  if(mergeBtn)mergeBtn.classList.toggle("hidden",!mergeable);
  openModal(d,{initialFocus:$("#importCancel"),returnFocus:opener,onEscape:close});
  let importBusy=false;
  $("#importCancel").onclick=()=>{if(importBusy)return;close();toast(t("toast.import_cancelled"))};
  if(onlyBtn)onlyBtn.onclick=()=>{
    if(importBusy||!ctx.programOnly)return;
    // Nothing has been written, so this is still just a change of screen.
    close();ctx.programOnly()};
  $("#importReplace").onclick=async()=>{
    if(importBusy)return;importBusy=true;
    const discardDraftRaw=readDraftRaw();
    try{const result=await replaceImportedState(ctx.s,io,{discardDraftRaw});
      if(result.localOk||result.idbOk){close();resetDraftSessionState();day=days()[0]||"Day 1";syncLang();leaveSetupGates();render();toast(t("toast.imported_sessions",{sessions:ctx.inSessions}))}}
    finally{importBusy=false}};
  $("#importMerge").onclick=async()=>{
    if(importBusy)return;importBusy=true;
    try{const result=await mergeImportedLog(ctx.s,io);
      if(result.added===0){close();toast(t("toast.nothing_to_merge"));return}
      if(result.localOk||result.idbOk){close();leaveSetupGates();render();toast(t("toast.merged_sessions",{n:result.added,sessions:tp(result.added,"session")}))}}
    finally{importBusy=false}}}
function mergeLog(s){return mergeImportedLog(s)}

function switchToBeginnerProgram(discardDraftRaw){return applyProgramTemplate(storageIO,{discardDraftRaw})}
async function applyProgramTemplate(io=storageIO,{discardDraftRaw=readDraftRaw()}={}){
  requireAdapter(io,"applyProgramTemplate");
  const transition=programTransitionPrecondition(state);
  const proposal=cloneSnapshot(state);
  proposal.program=new Program(beginnerProgram()).toJSON();
  proposal.programMeta=buildProgramMeta({name:t("program.beginner_name")});
  const effect=destructiveDraftClearEffect(discardDraftRaw);
  const result=await commitProposedState(proposal,io,{effect,...transition});
  if(result.localOk||result.idbOk){captureEvent("program_path_selected",{route:"browse"});captureEvent("program_activated",{route:"browse",version_category:"legacy_v1"});resetDraftSessionState();day=days()[0]||"Day 1";render();toast(t("toast.beginner_loaded"))}
  return result}

const ONB_SPLITS={2:["full_body","upper_lower"],3:["full_body","machine_only","ppl"],4:["upper_lower","full_body"],
  5:["ppl","bro","upper_lower"],6:["ppl"]};
const ONB_EQ_UI=["machines","cables","dumbbells","barbells"];
const ONB_EQ_GEN={machines:"machine",cables:"cable",dumbbells:"dumbbell",barbells:"barbell",bodyweight:"bodyweight"};
const ONB_MUSCLES=["Chest","Back","Quads","Hamstrings","Glutes","Side delts","Arms","Calves"];
let onbStep=0,onbAnswers={};
function defaultOnbAnswers(){return{goal:null,experience:null,daysPerWeek:null,splitType:null,equipment:["machines","cables"],
  priorityMuscles:[],sessionLength:null}}
function onbGenAnswers(a){const eq=(a.equipment||[]).map(x=>ONB_EQ_GEN[x]||x);
  const goal=a.goal==="strength_hypertrophy"?"strength":a.goal==="beginner_consistency"?"hypertrophy":a.goal||"hypertrophy";
  return{...a,goal,equipment:eq}}
function showOnboardingView(){$("#onboarding").classList.remove("hidden");$("#onboarding").classList.add("active");document.body.classList.add("is-onboarding");
  $$(".view").forEach(v=>{if(v.id!=="onboarding")v.classList.remove("active")})}
function closeOnboarding(){$("#onboarding").classList.remove("active");$("#onboarding").classList.add("hidden");document.body.classList.remove("is-onboarding");
  const log=$("#log");if(log&&!log.classList.contains("active")){
    $$("nav button").forEach(x=>{const on=x.dataset.view==="log";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    log.classList.add("active")}
  render()}
/* Onboarding that opens by itself on first run is not a route anybody chose.
   Counting it would enter every install into the generator funnel and make
   the drop-off after it meaningless. So an automatic open stays silent until
   the first answer, which is the user actually choosing this path; an open
   the user asked for reports immediately. Either way the flow reports once —
   Start over inside it continues the same attempt. */
let onbEngaged=false;
function reportOnboardingEngagement(){if(onbEngaged)return;
  onbEngaged=true;
  captureEvent("program_path_selected",{route:"custom"});captureEvent("generator_started",{mode:"baseline"})}
function startOnboarding(origin,opts={}){
  onboardingOrigin=origin||(!state.programMeta?.onboarded&&!state.log.length?"first-run":"settings");
  onbEngaged=false;
  onbStep=0;onbAnswers=defaultOnbAnswers();showOnboardingView();renderOnboarding();
  if(opts.userInitiated!==false)reportOnboardingEngagement()}
function maybeShowOnboarding(){if(!state.programMeta?.onboarded&&state.log.length===0)startOnboarding("first-run",{userInitiated:false})}
function cancelOnboarding(){
  if(onboardingOrigin==="block")pendingBlockTransition=null;
  onboardingOrigin=null;closeOnboarding()}
function onbEquipmentSupportsDays(a){
  if(!a?.equipment?.length||a.daysPerWeek==null||!a.splitType)return false;
  const gen=onbGenAnswers(a);
  return equipmentSupportsSplit(gen.daysPerWeek,gen.splitType,gen.equipment,gen.experience)}
function onbCanNext(){const a=onbAnswers;
  if(onbStep===0)return!!a.goal;if(onbStep===1)return!!a.experience;if(onbStep===2)return!!a.daysPerWeek;
  if(onbStep===3)return!!a.splitType;if(onbStep===4)return onbEquipmentSupportsDays(a);if(onbStep===6)return!!a.sessionLength;return true}
function onbPick(key,val,multi){reportOnboardingEngagement();
  if(multi){const arr=onbAnswers[key]||[];const i=arr.indexOf(val);
  if(i>=0)arr.splice(i,1);else arr.push(val);onbAnswers[key]=arr}else onbAnswers[key]=val;
  if(key==="daysPerWeek"){const opts=ONB_SPLITS[val]||[];if(!opts.includes(onbAnswers.splitType))onbAnswers.splitType=null}
  renderOnboarding()}
function onbOpt(cls,key,val,label,sub,multi){const sel=multi?(onbAnswers[key]||[]).includes(val):onbAnswers[key]===val;
  return `<button type="button" class="radio-card${sel?" is-selected":""}" data-onb-pick="${esc(key)}" data-onb-val="${esc(val)}" data-onb-multi="${multi?"1":"0"}">`+
    `<span class="radio-card__body"><span class="radio-card__title">${esc(label)}</span>${sub?`<span class="radio-card__cap">${esc(sub)}</span>`:""}</span>`+
    `<span class="radio-card__mark" aria-hidden="true"></span></button>`}
function renderOnboarding(){const body=$("#onbBody"),title=$("#onbTitle"),step=$("#onbStepLabel"),back=$("#onbBack"),next=$("#onbNext");
  if(!body)return;title.textContent=t(`onb.title.${onbStep}`)||t("onb.title.default");
  if(step)step.textContent=t("onb.step",{n:onbStep+1,total:8});
  const seg=$("#onbSegbar");if(seg)seg.innerHTML=Array.from({length:8},(_,i)=>`<span class="segbar__seg${i<=onbStep?" is-current":""}${i<onbStep?" is-done":""}"></span>`).join("");
  const cancel=$("#onbCancel");if(cancel)cancel.textContent=onbStep===0?t("onb.cancel"):"‹";
  if(back)back.classList.toggle("hidden",onbStep===0||onbStep===7);
  if(next){next.classList.toggle("hidden",onbStep===7);next.textContent=t("onb.next")}
  let html=`<h2 class="onb__q">${esc(t(`onb.title.${onbStep}`)||t("onb.title.default"))}</h2>`;
  if(onbStep===0)html+=`<p class="onb__explain">${esc(t("onb.goal.lede"))}</p><div class="onb__opts">`+
    onbOpt("","goal","hypertrophy",t("onb.goal.hypertrophy.label"),t("onb.goal.hypertrophy.sub"),false)+
    onbOpt("","goal","strength_hypertrophy",t("onb.goal.strength_hypertrophy.label"),t("onb.goal.strength_hypertrophy.sub"),false)+
    onbOpt("","goal","beginner_consistency",t("onb.goal.beginner_consistency.label"),t("onb.goal.beginner_consistency.sub"),false)+`</div>`+
    `<div class="onb__changes"><div class="onb__changes-lab">${esc(t("onb.what_changes"))}</div><p class="lede">${esc(t("onb.goal.changes"))}</p></div>`+
    `<p class="onb__import">${esc(t("onb.have_program"))} · <button type="button" id="onbImportLink">${esc(t("onb.import"))}</button></p>`;
  else if(onbStep===1)html+=`<p class="onb__explain">${esc(t("onb.experience.lede")||"")}</p><div class="onb__opts">`+
    onbOpt("","experience","beginner",t("onb.experience.beginner"),"",false)+onbOpt("","experience","intermediate",t("onb.experience.intermediate"),"",false)+
    onbOpt("","experience","advanced",t("onb.experience.advanced"),"",false)+`</div>`;
  else if(onbStep===2)html+=`<div class="onb__opts">`+[2,3,4,5,6].map(n=>onbOpt("","daysPerWeek",n,String(n),t("onb.days.sub"),false)).join("")+`</div>`;
  else if(onbStep===3){const opts=ONB_SPLITS[onbAnswers.daysPerWeek]||[];
    html+=`<p class="onb__explain">${esc(t("onb.split.lede",{n:onbAnswers.daysPerWeek}))}</p><div class="onb__opts">`+
      opts.map(s=>onbOpt("","splitType",s,t("split."+s),"",false)).join("")+`</div>`}
  else if(onbStep===4){html+=`<p class="onb__explain">${esc(t("onb.equipment.lede"))}</p><div class="onb__opts">`+
    ONB_EQ_UI.map(e=>onbOpt("", "equipment",e,t("equipment."+e),"",true)).join("")+`</div>`;
    if(!onbEquipmentSupportsDays(onbAnswers))
      html+=`<p class="lede" id="onbEquipUnsupported" role="status">${esc(t("onb.equipment.unsupported"))}</p>`}
  else if(onbStep===5)html+=`<p class="onb__explain">${esc(t("onb.priority.lede"))}</p><div class="onb__opts">`+
    ONB_MUSCLES.map(m=>onbOpt("","priorityMuscles",m,t("muscle."+m)||m,"",true)).join("")+`</div>`;
  else if(onbStep===6)html+=`<div class="onb__opts">`+
    onbOpt("","sessionLength","short",t("onb.session.short.label"),t("onb.session.short.sub"),false)+
    onbOpt("","sessionLength","normal",t("onb.session.normal.label"),t("onb.session.normal.sub"),false)+
    onbOpt("","sessionLength","long",t("onb.session.long.label"),t("onb.session.long.sub"),false)+`</div>`;
  else{const gen=generateProgramFromOnboarding(onbGenAnswers(onbAnswers)),days=[...new Set(gen.map(e=>e.day))];
    const byDay=days.map(d=>{const exs=gen.filter(e=>e.day===d);
      return `<div class="onb__day"><div class="onb__dayname">${esc(dayLabel(d))}</div>`+
        exs.map(e=>`<div class="onb__ex"><b>${esc(e.name)}</b> · ${e.sets}×${e.min}–${e.max} · ${esc(muscleListLabel(e.primary))}</div>`).join("")+`</div>`});
    html=`<div class="onb__review">${byDay.join("")}<div class="onb__actions">`+
      `<button type="button" id="onbSave" class="btn btn--cta">${esc(t("onb.review.save"))}</button>`+
      `<button type="button" id="onbEdit" class="btn btn--steel">${esc(t("onb.review.edit"))}</button>`+
      `<button type="button" id="onbRestart" class="btn btn--steel">${esc(t("onb.review.restart"))}</button></div></div>`}
  body.innerHTML=html;
  $$("[data-onb-pick]").forEach(b=>b.onclick=()=>{const k=b.dataset.onbPick,v=b.dataset.onbVal;
    const multi=b.dataset.onbMulti==="1",num=k==="daysPerWeek"?+v:v;onbPick(k,num,multi)});
  const saveBtn=$("#onbSave");if(saveBtn)saveBtn.onclick=()=>saveOnboardingProgram();
  const editBtn=$("#onbEdit");if(editBtn)editBtn.onclick=()=>editOnboardingProgram();
  const restartBtn=$("#onbRestart");if(restartBtn)restartBtn.onclick=()=>{onbStep=0;onbAnswers=defaultOnbAnswers();renderOnboarding()};
  const imp=$("#onbImportLink");if(imp)imp.onclick=()=>{$("#importProgram")?.click()};
  if(next)next.disabled=!onbCanNext()}
/* What the generator actually built, not what the answer was called.
   "Beginner consistency" is not a third goal: onbGenAnswers compiles it to
   the same hypertrophy program, given the beginner treatment — which is
   Foundation. Reporting nothing for it deleted every beginner from the
   generator funnel, which is the cohort the alpha most needs to see. The
   legacy generator has no family of its own, so everything else reports
   legacy until Plan 047 supplies real ones. */
function telemetryGeneratedProgram(goal){
  if(goal==="beginner_consistency")return{goal:"muscle_growth",family:"foundation"};
  if(goal==="strength_hypertrophy")return{goal:"balanced",family:"legacy"};
  if(goal==="hypertrophy")return{goal:"muscle_growth",family:"legacy"};
  return null}
async function finalizeProgramSetup({exercises,name,answers,destination,origin,io,draftConfirmed=false,discardDraftRaw,baseProposal=null,telemetryRoute="custom"}={}){
  const adapter=requireAdapter(io||storageIO,"finalizeProgramSetup");
  const originEff=origin||onboardingOrigin||"first-run";
  const blockCap=originEff==="block"?pendingBlockTransition:null;
  const transition=blockCap
    ?{expectedProgramId:blockCap.oldProgramId,expectedProgramFingerprint:blockCap.programFingerprint}
    :programTransitionPrecondition(state);
  const draftActive=draftHasProgress();
  const confirmedDraftRaw=discardDraftRaw===undefined?readDraftRaw():discardDraftRaw;
  if(draftActive&&!draftConfirmed&&!confirm(t("confirm.replace_program_discard_draft")))
    return{revision:readRevision(state),localOk:false,idbOk:false,cancelled:true};
  const proposal=cloneSnapshot(baseProposal||state);
  if(originEff==="block"){
    if(!blockCap)return blockTransitionResult("failed");
    if(proposal.programMeta?.id!==transition.expectedProgramId)return blockTransitionResult("duplicate");
    archiveCapturedBlock(proposal,blockCap)}
  const meta=buildProgramMeta({name,answers:answers||onbAnswers});
  proposal.program=new Program(exercises,snapshotLookup(proposal.customExercises)).toJSON();
  meta.progressionRelations=normalizeProgressionRelations(baseProposal?.programMeta?.progressionRelations,proposal.program);
  meta.progressionModifiers=normalizeProgressionModifiers(baseProposal?.programMeta?.progressionModifiers);
  proposal.programMeta=meta;
  if(destination==="program-edit")proposal[STORAGE_FOLLOWUP]={kind:"onboarding-edit",origin:originEff};
  else delete proposal[STORAGE_FOLLOWUP];
  const effect=destructiveDraftClearEffect(confirmedDraftRaw);
  const persisted=await commitProposedState(proposal,adapter,{...transition,effect});
  const result=originEff==="block"
    ?blockTransitionResult(persisted.localOk||persisted.idbOk?"committed":persisted.duplicate?"duplicate":"failed",persisted)
    :persisted;
  if(!(result.localOk||result.idbOk))return result;
  const generated=telemetryGeneratedProgram(meta.goal);
  // A frequency outside the reviewed 2-6 range is rejected by the boundary,
  // where the rejection is visible, rather than dropped silently here.
  if(telemetryRoute==="custom"&&generated)captureEvent("generator_completed",
    {goal:generated.goal,frequency:String(new Set(exercises.map(exercise=>exercise.day)).size),family:generated.family});
  captureEvent("program_activated",{route:telemetryRoute,version_category:telemetryRoute==="import"?"import_v1":"legacy_v1"});
  resetDraftSessionState();
  if(originEff==="block")pendingBlockTransition=null;
  onboardingOrigin=null;day=days()[0]||"Day 1";closeFirstRun();closeOnboarding();
  if(destination==="program-edit"){
    programEditMode=true;
    $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));
    document.body.classList.remove("is-settings","is-workout","is-exercise","is-onboarding","is-library","is-preview","is-import");
    render();toast(t("toast.tweak_program"));return result}
  render();toast(t("toast.onboarding_saved"));
  if(!maybeStartTour())maybeShowInstallBanner();
  return result}
function saveOnboardingProgram(io){
  const a=onbAnswers,list=generateProgramFromOnboarding(onbGenAnswers(a));
  return finalizeProgramSetup({exercises:list,name:"",answers:a,destination:"log",origin:onboardingOrigin||"first-run",io:io||storageIO})}
function editOnboardingProgram(io){
  const a=onbAnswers,list=generateProgramFromOnboarding(onbGenAnswers(a));
  return finalizeProgramSetup({exercises:list,name:"",answers:a,destination:"program-edit",origin:onboardingOrigin||"first-run",io:io||storageIO})}
window.closeOnboarding=closeOnboarding;window.startOnboarding=startOnboarding;

// ---- UI prefs (kept separate from training data so they never touch export/import) ----
const UIKEY="repforge_ui_v1";
function loadUiPrefs(){try{const o=JSON.parse(localStorage.getItem(UIKEY));return o&&typeof o==="object"?o:{}}catch{return{}}}
let uiPrefs=loadUiPrefs();
function setUiPref(k,v){uiPrefs[k]=v;try{localStorage.setItem(UIKEY,JSON.stringify(uiPrefs))}catch(e){console.warn("ui prefs save failed",e)}}

/* ---- Appearance ----
   A UI pref, not a setting: which paper this device prefers says nothing about
   the training in a backup, and a setup link that repainted the recipient's app
   would be reading far past its remit. So it stays out of state.settings, out
   of export/import, and out of the shared-setup allowlist.

   "system" is a live answer rather than a stored light/dark, so a phone on a
   sunrise schedule follows it without the app being reopened, but only once
   the lifter has explicitly chosen it: with nothing stored yet, the default
   is light rather than a read of the device. Everything else below resolves
   the pick to the concrete value <html data-theme> carries, which is the
   only thing styles.css ever looks at. */
const THEMES=["system","light","dark"];
/* Browser chrome cannot read a CSS variable, so --bg is spelled out again here
   and in the pre-paint snippet in index.html. Three copies of two hexes; move
   all three together. */
const THEME_COLOR={light:"#F4F2EF",dark:"#141310"};
const darkQuery=()=>window.matchMedia?.("(prefers-color-scheme: dark)")||null;
const normalizeTheme=v=>THEMES.includes(v)?v:"light";
const currentTheme=()=>normalizeTheme(uiPrefs.theme);
const resolvedTheme=()=>{const pick=currentTheme();return pick==="system"?(darkQuery()?.matches?"dark":"light"):pick};
function applyTheme(){
  const resolved=resolvedTheme();
  document.documentElement.dataset.theme=resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",THEME_COLOR[resolved]);
  return resolved}
/* The chart is painted into a canvas, so it is the one surface a token swap
   cannot reach on its own — it has already sampled the old palette. */
function repaintForTheme(){applyTheme();redrawChart()}
function setTheme(v){setUiPref("theme",normalizeTheme(v));repaintForTheme()}
function watchSystemTheme(){
  const q=darkQuery();
  if(!q?.addEventListener)return;
  q.addEventListener("change",()=>{if(currentTheme()==="system")repaintForTheme()})}

// ---- Install / PWA helpers ----
const isStandalone=()=>window.matchMedia?.("(display-mode: standalone)")?.matches===true||window.navigator.standalone===true;
const isIOS=()=>{const ua=navigator.userAgent||"";return /iphone|ipad|ipod/i.test(ua)||(navigator.platform==="MacIntel"&&(navigator.maxTouchPoints||0)>1)};
/* iOS ships one installer — Safari's Share sheet — and every other iOS browser
   is that same engine without it. Those browsers name themselves in the UA, and
   so do the in-app webviews; nothing else on iOS can be told apart. */
const IOS_NON_SAFARI=/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|OPR\/|YaBrowser|DuckDuckGo|Brave|FBAN|FBAV|FBIOS|Instagram|Line\/|Twitter|MicroMessenger|GSA\//i;
const isIOSSafari=()=>isIOS()&&!IOS_NON_SAFARI.test(navigator.userAgent||"");
/** The single decision about which install interface a browser gets. It reads
 *  capabilities and display mode — never screen size — in this order:
 *    "none"   already installed, or nothing worth offering
 *    "native" a deferred beforeinstallprompt is in hand (Chromium anywhere)
 *    "ios"    iOS/iPadOS Safari, which installs by hand from the Share sheet
 *    "safari" another browser on iOS/iPadOS, which cannot install at all
 *  Chrome's own install prompt is never drawn by Taurifer: "native" only means
 *  we hold the event that asks Chrome to show it. */
function installMode(){
  if(isStandalone())return "none";
  if(installPrompt)return "native";
  if(isIOS())return isIOSSafari()?"ios":"safari";
  return "none";
}
/* Chrome can fire this before init() binds its own listener, and an event nobody
   caught is an install offer the lifter never gets. Capturing it here, at parse
   time, means boot always reads the true answer; the listener in init() is the
   one that redraws once there is something to redraw. */
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e},true);
const IOS_SHARE_SVG='<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M6 12H4v8h16v-8h-2"/></svg>';
const INSTALL_SNOOZE_MS=7*86400000;
function installInstructions(){
  if(isIOS())return t("install.ios_instructions",{icon:IOS_SHARE_SVG});
  if(installPrompt)return t("install.prompt_instructions");
  return t("install.browser_instructions");
}
/** Every surface that offers an install, refreshed from one reading of what the
 *  browser can do. Called whenever that reading can have changed. */
function renderInstallSurfaces(){
  const mode=installMode();
  $("#installBtn")?.classList.toggle("hidden",mode!=="native");
  $("#installApp")?.classList.toggle("hidden",mode==="none");
  renderFirstRunInstall();
}
async function triggerInstall(){
  const mode=installMode();
  if(mode==="native"){
    // The event is single-use. Clearing it before the await is what makes a
    // second tap a no-op rather than a second prompt() on a spent event, and it
    // is also step 3 of the flow: consume it whatever the lifter chooses.
    const evt=installPrompt;installPrompt=null;
    let outcome="";
    try{evt.prompt();const choice=await evt.userChoice;outcome=choice?.outcome||""}catch{}
    // Nothing is claimed that Chrome has not confirmed: only "accepted" reports
    // an install, and a dismissal simply leaves the section gone until Chrome
    // offers the event again.
    if(outcome==="accepted"){hideInstallBanner(false);closeFirstRunInstall();toast(t("toast.installing"))}
    renderSettings();renderInstallSurfaces();return}
  if(mode==="ios"){openIosInstallSheet();return}
  if(mode==="safari"){showInstallBanner(true);return}
}
function installBannerEligible(){
  if(installMode()==="none")return false;
  if(state?.[STORAGE_FOLLOWUP]?.kind==="onboarding-edit")return false;
  if(tourActive||firstRunActive||$("#onboarding")?.classList.contains("active"))return false;
  const dis=+uiPrefs.installDismissedAt||0;
  if(dis&&Date.now()-dis<INSTALL_SNOOZE_MS)return false;
  return true;
}
function showInstallBanner(force){
  const b=$("#installBanner");if(!b)return;
  const mode=installMode();
  if(mode==="none")return;
  if(!force&&!installBannerEligible())return;
  $("#installBannerBody").innerHTML=mode==="safari"?esc(t("install.card.safari_only_body")):installInstructions();
  const act=$("#installBannerAction");
  // A button appears only where it does something: Chrome's prompt, or the
  // Safari sheet. In another iOS browser the banner is the explanation itself.
  if(mode==="native"){act.classList.remove("hidden");act.textContent=t("install.action")}
  else if(mode==="ios"){act.classList.remove("hidden");act.textContent=t("install.card.ios_action")}
  else act.classList.add("hidden");
  b.classList.remove("hidden");
}
function hideInstallBanner(remember){$("#installBanner")?.classList.add("hidden");if(remember)setUiPref("installDismissedAt",Date.now())}
function maybeShowInstallBanner(){if(installBannerEligible())showInstallBanner(false)}

/* ---- First-run setup: install, then choose a program ----
   One screen, one layout. Only its install section changes, and it changes with
   what the browser can actually do — a captured beforeinstallprompt, Safari's
   manual Home Screen flow, or nothing — so no lifter is ever asked which phone
   they are holding. */
const INSTALL_TRAY_SVG='<svg class="installcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
  '<path d="M12 3v11"/><path d="M7.5 9.5 12 14l4.5-4.5"/><path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>';
const INSTALL_SHARE_SVG='<svg class="installcard__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
  '<path d="M12 3v12"/><path d="M7.5 7.5 12 3l4.5 4.5"/><path d="M6 11H4v9h16v-9h-2"/></svg>';
let sharedSetupDraft={status:"none",source:null,encoded:null,payload:null,error:null,previousLang:null};
let firstRunActive=false;
const firstRunOpen=()=>!!$("#firstRun")&&!$("#firstRun").classList.contains("hidden");
const sharedSetupReady=()=>sharedSetupDraft.status==="ready"&&!!sharedSetupDraft.payload;
const sharedSetupEligible=()=>firstRunPending()&&!(state.programHistory?.length);
function sharedSetupErrorKey(code){
  if(code==="unsupported-version")return"setup.shared.unsupported";
  if(code==="decompression-unavailable")return"setup.shared.browser_unsupported";
  return"setup.shared.invalid"}
function renderFirstRunProgramMode(){
  const standard=$("#firstRunStandardProgram"),shared=$("#firstRunSharedProgram"),error=$("#firstRunSharedError");
  const ready=sharedSetupReady();
  standard?.classList.toggle("hidden",ready);
  shared?.classList.toggle("hidden",!ready);
  if(ready){
    const name=sharedSetupDraft.payload.program.meta.name;
    const n=sharedSetupDraft.payload.program.meta.daysPerWeek;
    const title=$("#firstRunSharedTitle"),cap=$("#firstRunSharedCap");
    if(title)title.textContent=t("setup.shared.title");
    if(cap)cap.textContent=t(n===1?"setup.shared.cap_one":"setup.shared.cap_many",{name,n});
    if(error){error.textContent="";error.classList.add("hidden")}}
  else if(sharedSetupDraft.status==="invalid"||sharedSetupDraft.status==="unsupported"){
    if(error){error.textContent=t(sharedSetupErrorKey(sharedSetupDraft.error));error.classList.remove("hidden")}}
  else if(error){error.textContent="";error.classList.add("hidden")}}
function setSharedSetupBusy(busy){
  const button=$("#firstRunSharedStart"),busyEl=$("#firstRunSharedBusy");
  if(button){button.disabled=busy;button.setAttribute("aria-busy",busy?"true":"false")}
  busyEl?.classList.toggle("hidden",!busy)}
async function commitSharedSetup(io=storageIO){
  if(!sharedSetupReady())return{revision:readRevision(state),localOk:false,idbOk:false};
  if(!sharedSetupEligible()){
    toast(t("setup.shared.existing"),{assertive:true});
    return{revision:readRevision(state),localOk:false,idbOk:false,ineligible:true}}
  const checked=SharedSetup?.validate(sharedSetupDraft.payload,{builtInIds:SHARED_BUILT_IN_IDS});
  if(!checked?.ok){
    toast(t("setup.shared.commit_failed"),{assertive:true});
    $("#firstRunSharedStart")?.focus();
    return{revision:readRevision(state),localOk:false,idbOk:false,invalid:true}}
  const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
  if(draftActive&&!confirm(t("confirm.replace_program_discard_draft")))
    return{revision:readRevision(state),localOk:false,idbOk:false,cancelled:true};
  setSharedSetupBusy(true);
  let result;
  try{
    const transition=programTransitionPrecondition(state);
    const proposal=proposalFromSharedSetup(checked.value,state);
    const effect=destructiveDraftClearEffect(discardDraftRaw);
    result=await commitProposedState(proposal,requireAdapter(io,"commitSharedSetup"),
      {replace:true,expectedFirstRunEmpty:true,effect,...transition})}
  catch{result={revision:readRevision(state),localOk:false,idbOk:false}}
  setSharedSetupBusy(false);
  if(!(result.localOk||result.idbOk)){
    toast(t("setup.shared.commit_failed"),{assertive:true});
    $("#firstRunSharedStart")?.focus();
    return result}
  resetDraftSessionState();
  onboardingOrigin=null;day=days()[0]||"Day 1";closeFirstRun();closeOnboarding();syncLang();
  if(isStandalone())SharedSetup?.clearHandoffCookie();
  sharedSetupDraft={status:"none",source:null,encoded:null,payload:null,error:null,previousLang:null};
  captureEvent("program_path_selected",{route:"shared"});captureEvent("program_activated",{route:"shared",version_category:"shared_v1"});
  render();toast(t("toast.onboarding_saved"));
  if(!maybeStartTour())maybeShowInstallBanner();
  return result}
/** Write the install section from the current reading, or take it away. Rule 5:
 *  a browser with no mechanism gets no section at all, never a dead button. */
function renderFirstRunInstall(){
  const sec=$("#firstRunInstall"),card=$("#firstRunInstallCard");
  if(!sec||!card)return;
  const mode=installMode();
  if(mode==="none"){sec.classList.add("hidden");card.innerHTML="";return}
  const body=mode==="native"?t("install.card.browser_body")
    :mode==="ios"?t("install.card.ios_body"):t("install.card.safari_only_body");
  const action=mode==="native"?t("install.card.browser_action"):mode==="ios"?t("install.card.ios_action"):"";
  card.innerHTML=(mode==="native"?INSTALL_TRAY_SVG:INSTALL_SHARE_SVG)+
    `<div class="installcard__text"><p class="installcard__title">${esc(t("install.card.title"))}</p>`+
    `<p class="installcard__body">${esc(body)}</p></div>`+
    (action?`<button type="button" class="btn btn--cta installcard__action" id="firstRunInstallAction">${esc(action)}</button>`:"");
  const act=$("#firstRunInstallAction");if(act)act.onclick=triggerInstall;
  sec.classList.remove("hidden");
}
/** The lede and the escape hatch both speak to the install offer, so they follow
 *  it. With nothing to install — most of all inside the installed app — the
 *  screen is only the program question, and "Continue in browser" would be an
 *  answer to a question nobody asked. */
function setFirstRunOffer(offer){
  const lede=$("#firstRunLede");
  if(lede)lede.textContent=sharedSetupReady()
    ?t(offer?"setup.shared.lede":"setup.shared.lede_installed")
    :t(offer?"setup.lede":"setup.lede_installed");
  $("#firstRunContinue")?.classList.toggle("hidden",!offer);
}
/** Chrome accepted the install, or the app reports itself installed. Either way
 *  there is nothing left to install: the section goes, the choices stay. */
function closeFirstRunInstall(){
  const sec=$("#firstRunInstall");if(sec)sec.classList.add("hidden");
  const card=$("#firstRunInstallCard");if(card)card.innerHTML="";
  setFirstRunOffer(false);
}
function renderFirstRun(){
  setFirstRunOffer(installMode()!=="none");
  const label=$("#firstRunContinueLabel");
  if(label)label.textContent=isIOSSafari()?t("setup.continue_safari"):t("setup.continue_browser");
  renderFirstRunInstall();
  renderFirstRunProgramMode();
}
function openFirstRun(){
  const el=$("#firstRun");if(!el)return false;
  firstRunActive=true;
  renderFirstRun();
  el.classList.remove("hidden");
  document.body.classList.add("is-firstrun");
  window.scrollTo({top:0});
  // The screen itself takes focus, not its first choice: a ring drawn around
  // Create before the lifter has touched anything reads as a recommendation.
  try{el.focus({preventScroll:true})}catch{}
  return true}
function trapFirstRunTab(event){
  if(event.key!=="Tab"||!firstRunOpen())return;
  const root=$("#firstRun"),focusable=modalFocusables(root);
  if(!focusable.length){event.preventDefault();root?.focus();return}
  const current=focusable.indexOf(document.activeElement);
  if(event.shiftKey&&(current<=0)){
    event.preventDefault();focusable[focusable.length-1].focus()}
  else if(!event.shiftKey&&(current===-1||current===focusable.length-1)){
    event.preventDefault();focusable[0].focus()}}
/** Hide the gate without giving up on it: the import review lives in the app
 *  shell underneath, so it needs the overlay out of the way while it decides. */
function suspendFirstRun(){
  const el=$("#firstRun");if(!el)return;
  el.classList.add("hidden");document.body.classList.remove("is-firstrun")}
function closeFirstRun(){
  firstRunActive=false;suspendFirstRun()}
const firstRunPending=()=>!state.programMeta?.onboarded&&!state.log.length;
/** The screen carries two questions: install, and which program. The program
 *  question is live on every first run, so the screen opens on every first run.
 *  The install question adds its section wherever the browser has an answer —
 *  and where it has none, the screen is the program question by itself.
 *
 *  This is the one door into a first program. Import used to reach it only
 *  through a text link inside the wizard's first step, which made bringing a
 *  shared program the hidden path and building one from scratch the default;
 *  they are two equal ways to begin and now read as two. */
function maybeShowFirstRun(){
  if(sharedSetupDraft.status==="existing")return false;
  if(!firstRunPending())return false;
  return openFirstRun()}
window.closeFirstRun=closeFirstRun;window.openFirstRun=openFirstRun;

/* ---- "Why this weight?" sheet ----
   Plan 043: the recommendation is the product's differentiator, so it must not
   read as a magic number. Everything here is built at tap time from fields the
   engine attached to its own result — no arithmetic is re-derived, and the Log
   tab's render path pays nothing but one static button per card. */
// Log list and focus cards render every slot through sessionExercise, so resolving
// by id here matches what they drew. The exercise page does NOT: it renders the raw
// slot whenever the workout is not active (openExerciseView), so a slot substituted
// earlier in the session would have the page showing one movement's recommendation
// and the sheet showing another's arithmetic. That caller passes its own resolved
// movement to openWhySheetFor instead.
function openWhySheet(exId,opener){
  const slot=prog.find(exId);if(!slot)return;
  const ex=sessionExercise(slot);if(!ex)return;
  openWhySheetFor(ex,opener)}
function openWhySheetFor(ex,opener){
  const sheet=$("#whySheet"),scrim=$("#whyScrim");
  if(!sheet||!ex)return;
  const rec=recommendation(ex);
  const target=$("#whyTarget");
  if(target)target.textContent=rec.load!=null?t("today.rec_keep",{load:fmtLoad(rec.load),unit:unitLabel()}):rec.label;
  const body=$("#whyBody");
  if(body)body.innerHTML=explainRecommendation(ex).map(row=>
    `<div class="whysheet__row">${row.label?`<span class="whysheet__lab">${esc(row.label)}</span>`:""}`+
    `<p>${esc(row.text)}</p></div>`).join("");
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{initialFocus:$("#whyClose"),returnFocus:opener,onEscape:closeWhySheet,scrim,
    delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeWhySheet(){
  const sheet=$("#whySheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  return closeModal(sheet)}

/* ---- iOS install instructions ----
   Safari exposes no install event, so this sheet is the whole mechanism: it
   points at Safari's own control. The bar it draws is an illustration of
   Safari, and the only third-party UI Taurifer ever draws — Chrome's install
   prompt is Chrome's to render, and we only ever ask for it. */
function openIosInstallSheet(){
  const sheet=$("#iosInstallSheet"),scrim=$("#iosInstallScrim");
  if(!sheet)return;
  const host=$("#iosInstallHost");
  if(host)host.textContent=location.hostname||"";
  document.body.classList.add("is-sheet-open");
  openModal(sheet,{initialFocus:$("#iosInstallDone"),onEscape:closeIosInstallSheet,scrim,
    delayHide:reducedMotion()?0:280});
  requestAnimationFrame(()=>{sheet.classList.add("is-open");scrim?.classList.add("is-open")})}
function closeIosInstallSheet(){
  const sheet=$("#iosInstallSheet");
  if(!sheet)return Promise.resolve(false);
  if(sheet.hidden&&!(activeModal&&activeModal.el===sheet))return Promise.resolve(false);
  return closeModal(sheet)}

// ---- Feature tour (bottom-sheet coach that walks every feature) ----
const TOUR=[
  {view:"log"},{view:"log"},{view:"log"},{view:"log"},{view:"log"},{view:"log"},
  {view:"stats"},{view:"history"},{view:"program"},{view:"settings"},{view:"settings",install:true}
];
let tourStep=0,tourActive=false,tourOrigin=null,tourSnapshot=null,tourPreview=null,tourFocusOrigin=null;
function tourSteps(){return TOUR.filter(s=>!(s.install&&isStandalone()))}
function snapshotTourUi(){
  const scrolls={};
  for(const id of["log","stats","history","program","settings"]){const el=$("#"+id);if(el)scrolls[id]=el.scrollTop}
  return{view:currentViewId(),settings:document.body.classList.contains("is-settings"),exercise:!!exView,
    exView:exView?{key:exView.key,from:exView.from}:null,statsSeg,programEditMode,workoutActive,workoutLeft,logMode,focusIndex,
    focusEdit:focusEdit?Object.assign({},focusEdit):null,overflow:!$("#woOverflow")?.classList.contains("hidden"),day,
    date:$("#date")?.value||"",scrolls,windowScroll:window.scrollY}}
function restoreTourUi(snap){
  if(!snap)return;
  tourPreview=null;day=snap.day;if($("#date")&&snap.date!=null)$("#date").value=snap.date;
  logMode=snap.logMode;focusIndex=snap.focusIndex;focusEdit=snap.focusEdit;programEditMode=snap.programEditMode;
  syncLogModeControls();
  workoutLeft=snap.workoutLeft;
  if(snap.statsSeg)setStatsSeg(snap.statsSeg);
  document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-library","is-preview","is-import");
  if(snap.settings){showSettings()}
  else if(snap.exercise&&snap.exView){openExerciseView(snap.exView.key,snap.exView.from)}
  else{
    $$("nav button").forEach(x=>{const on=x.dataset.view===snap.view;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===snap.view))}
  setWorkoutActive(!!snap.workoutActive);
  document.body.classList.toggle("is-focus-wo",!!snap.workoutActive&&snap.logMode==="focus");
  if(snap.workoutActive){renderTabs();renderWorkout()}
  render();
  setWorkoutOverflow(!!snap.overflow);
  for(const[id,top]of Object.entries(snap.scrolls||{})){const el=$("#"+id);if(el)el.scrollTop=top}
  window.scrollTo(0,snap.windowScroll||0)}
function applyTourChoreography(step){
  const focus=step===3||step===4,list=step===1||step===2||step===5,overflow=step===1||step===2;
  tourPreview={step,ignoreSkipped:list||focus,showRest:step===4};
  if(step===0){
    setWorkoutActive(false);document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-library","is-preview","is-import");
    $$("nav button").forEach(x=>{const on=x.dataset.view==="log";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id==="log"));renderToday();window.scrollTo({top:0});return}
  if(step>=1&&step<=5){
    document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-library","is-preview","is-import");
    $$("nav button").forEach(x=>{const on=x.dataset.view==="log";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id==="log"));
    logMode=focus?"focus":"full";
    syncLogModeControls();
    setWorkoutActive(true);renderTabs();renderWorkout();renderToday();setWorkoutOverflow(overflow);
    if(step===5)$("#logForm .btn--save")?.scrollIntoView({block:"center"});return}
  setWorkoutActive(false);
  const s=tourSteps()[step];if(s?.view)navTo(s.view)}
function openTourOverlay(){
  const tour=$("#tour");if(!tour)return;
  openModal(tour,{
    initialFocus:$("#tourSkip"),
    returnFocus:document.activeElement,
    onEscape:()=>endTour(false)
  })}
function closeTourOverlay(){
  closeModal($("#tour"))}
function focusAfterTour(origin,original){
  const sameId=original?.id?document.getElementById(original.id):null;
  const stable=origin==="first-run"?$("#startWorkout"):origin==="replay"?$("#replayTour"):null;
  const fallback=origin==="replay"?$("#settingsBack"):$('nav button[data-view="log"]');
  for(const candidate of origin==="first-run"?[stable,original,sameId,fallback]:[original,sameId,stable,fallback]){
    const target=resolveReturnFocus(candidate);
    if(target){try{target.focus({preventScroll:true})}catch{try{target.focus()}catch{}}return true}}
  return false}
function showSettings(){
  $$("nav button").forEach(x=>{x.classList.remove("active");x.setAttribute("aria-current","false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="settings"));
  document.body.classList.add("is-settings");document.body.classList.remove("is-exercise","is-onboarding","is-workout");
  workoutActive=false;workoutLeft=true;window.scrollTo({top:0});render()}
/* Returns to a bottom-nav destination from a stacked view. navTo cannot do it:
   it skips the click when the nav button is already marked active, which it
   still is after a full-screen view took over without touching the dock. */
function returnToTab(view){
  $$("nav button").forEach(b=>{const on=b.dataset.view===view;
    b.classList.toggle("active",on);b.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===view));
  window.scrollTo({top:0})}
function navTo(view){
  if(view==="settings"){showSettings();return}
  const b=$(`nav button[data-view="${view}"]`);
  if(b){if(!b.classList.contains("active"))b.click();return}
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===view));
  window.scrollTo({top:0});render()
}
window.__repforgeEnterWorkout=enterWorkout;
window.__repforgeGoToLogExercise=goToLogExercise;
window.__repforgeSaveWorkout=(io)=>saveWorkout({preventDefault(){}},io);
// Test seam for the Focus deck, alongside the other __repforge* harness hooks.
window.__repforgeFocus={
  go:focusAnimateTo,list:focusList,at:()=>focusIndex,editing:()=>focusEdit,
  to(i){focusIndex=Math.max(0,i);focusEdit=null;renderWorkout()},
};
window.__repforgeLeaveWorkout=leaveWorkout;
window.__repforgeShowSettings=showSettings;
function startTour(origin){
  tourOrigin=origin==="replay"?"replay":"first-run";
  tourFocusOrigin=document.activeElement instanceof Element?document.activeElement:null;
  tourSnapshot=tourOrigin==="replay"?snapshotTourUi():null;
  tourStep=0;tourActive=true;hideInstallBanner(false);openTourOverlay();renderTour()}
function renderTour(){
  const steps=tourSteps(),s=steps[tourStep];
  if(!s){endTour(true);return}
  applyTourChoreography(tourStep);
  $("#tourEyebrow").textContent=t("tour.eyebrow_progress",{n:tourStep+1,total:steps.length});
  $("#tourTitle").textContent=t(`tour.${tourStep}.title`);
  const extra=$("#tourExtra");
  if(s.install){
    $("#tourBody").innerHTML=`${t("tour.install.body_prefix")} ${installInstructions()}`;
    extra.innerHTML=installPrompt?`<button type="button" id="tourInstallBtn" class="btn btn--cta">${esc(t("tour.install.cta"))}</button>`:"";
    const ib=$("#tourInstallBtn");if(ib)ib.onclick=triggerInstall;
  }else{$("#tourBody").innerHTML=t(`tour.${tourStep}.body`);extra.innerHTML=""}
  $("#tourDots").innerHTML=steps.map((_,i)=>`<span class="tour__dot${i===tourStep?" is-on":""}"></span>`).join("");
  $("#tourBack").classList.toggle("hidden",tourStep===0);
  $("#tourNext").textContent=tourStep===steps.length-1?t("tour.done"):t("tour.next");
  if(tourStep!==5)window.scrollTo({top:0});
}
function endTour(completed){
  const origin=tourOrigin,snap=tourSnapshot,focusOrigin=tourFocusOrigin;
  closeTourOverlay();tourActive=false;tourPreview=null;tourOrigin=null;tourSnapshot=null;tourFocusOrigin=null;
  if(origin==="first-run"){setUiPref("tourDone",true);setWorkoutActive(false);navTo("log")}
  else if(origin==="replay")restoreTourUi(snap);
  else{setUiPref("tourDone",true);if(completed)navTo("log")}
  focusAfterTour(origin,focusOrigin);
  maybeShowInstallBanner()}
function maybeStartTour(){if(uiPrefs.tourDone)return false;if($("#onboarding")?.classList.contains("active"))return false;startTour("first-run");return true}
window.startTour=startTour;window.closeTour=()=>{if(tourActive)endTour(false)};
window.__repforgeUi={loadUiPrefs,isStandalone,isIOS,showInstallBanner,startTour,currentTheme,resolvedTheme,setTheme};
function resumeProgramEditFollowUp(){
  if(state?.[STORAGE_FOLLOWUP]?.kind!=="onboarding-edit")return false;
  programEditMode=true;
  document.body.classList.remove("is-settings","is-workout","is-exercise","is-onboarding","is-library","is-preview","is-import");
  $$("nav button").forEach(x=>{const on=x.dataset.view==="program";x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
  $$(".view").forEach(v=>v.classList.toggle("active",v.id==="program"));
  return true}
window.__repforgeOnboarding={eqUi:ONB_EQ_UI,eqGen:ONB_EQ_GEN,splits:ONB_SPLITS,muscles:ONB_MUSCLES};

function init(){
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  // The pre-paint snippet in index.html has already done this for a dark
  // device; re-running it is what covers the light case and a snippet that
  // could not read storage.
  applyTheme();watchSystemTheme();
  window.addEventListener("hashchange",()=>{handleSharedSetupHash()});
  $("#firstRun")?.addEventListener("keydown",trapFirstRunTab);
  let rzT;window.addEventListener("resize",()=>{clearTimeout(rzT);rzT=setTimeout(redrawChart,150)});
  window.addEventListener("orientationchange",()=>setTimeout(redrawChart,200));
  // Chrome decides when to offer this, and it usually decides after the first
  // paint — often after the lifter has touched something. Every install surface
  // is rewritten from the new reading rather than assumed at boot, which is what
  // lets the install section appear on a first-run screen the lifter is already
  // reading. One that has been left for the wizard is not pulled back: the
  // banner carries the offer from there.
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;
    renderSettings();renderInstallSurfaces();
    if(tourActive)renderTour();else maybeShowInstallBanner()});
  window.addEventListener("appinstalled",()=>{installPrompt=null;hideInstallBanner(false);
    closeFirstRunInstall();renderSettings();renderInstallSurfaces()});
  $("#installBtn").onclick=triggerInstall;
  $("#installBannerClose").onclick=()=>hideInstallBanner(true);
  $("#installBannerAction").onclick=triggerInstall;
  $("#firstRunCreate").onclick=()=>{closeFirstRun();startOnboarding("first-run")};
  // Import runs through the same review as everywhere else; the gate stays
  // standing behind it so backing out returns here rather than to an empty app.
  $("#firstRunImport").onclick=()=>{onbAnswers=defaultOnbAnswers();onboardingOrigin="first-run";$("#importProgram")?.click()};
  // "Continue in browser" is an answer to the install offer, not to the program
  // question: it takes the offer off the table for a while, then hands over to
  // the same first run the app has always had.
  $("#firstRunContinue").onclick=()=>{setUiPref("installDismissedAt",Date.now());
    if(sharedSetupReady()){closeFirstRunInstall();renderFirstRunProgramMode();return}
    closeFirstRun();startOnboarding("first-run")};
  const sharedStart=$("#firstRunSharedStart");if(sharedStart)sharedStart.onclick=async()=>{
    if(sharedStart.disabled)return;
    await commitSharedSetup(storageIO)};
  $("#whyClose").onclick=closeWhySheet;
  $("#iosInstallDone").onclick=closeIosInstallSheet;
  $("#iosInstallScrim").onclick=closeIosInstallSheet;
  $("#tourBack").onclick=()=>{if(tourStep>0){tourStep--;renderTour()}};
  $("#tourNext").onclick=()=>{if(tourStep<tourSteps().length-1){tourStep++;renderTour()}else endTour(true)};
  $("#tourSkip").onclick=()=>endTour(false);
  $("#replayTour").onclick=()=>startTour("replay");
  $("#installApp").onclick=triggerInstall;
  $("#restBar").onclick=openRestSheet;
  // One rest control in the workout header: it starts the clock when idle, and
  // opens the timer sheet once it is running rather than ending the rest.
  const woRest=$("#woRest");if(woRest)woRest.onclick=()=>{if(tourActive&&tourPreview?.showRest&&!(+state.settings.restSec>0))return;restEnd?openRestSheet():startRest()};
  const restClose=$("#restSheetClose");if(restClose)restClose.onclick=closeRestSheet;
  const restScrim=$("#restSheetScrim");if(restScrim)restScrim.onclick=closeRestSheet;
  const restMinus=$("#restMinus");if(restMinus)restMinus.onclick=()=>nudgeRest(-REST_NUDGE);
  const restPlus=$("#restPlus");if(restPlus)restPlus.onclick=()=>nudgeRest(REST_NUDGE);
  const restPlay=$("#restPlayPause");if(restPlay)restPlay.onclick=toggleRestHold;
  const restReset=$("#restReset");if(restReset)restReset.onclick=resetRest;
  const restStop=$("#restStop");if(restStop)restStop.onclick=endRestFromSheet;
  const noteCancel=$("#exNoteCancel");if(noteCancel)noteCancel.onclick=closeExNoteSheet;
  const noteSave=$("#exNoteSave");if(noteSave)noteSave.onclick=saveExNoteSheet;
  const noteScrim=$("#exNoteScrim");if(noteScrim)noteScrim.onclick=closeExNoteSheet;
  const dayPickCancel=$("#dayPickCancel");if(dayPickCancel)dayPickCancel.onclick=closeDayPickSheet;
  const dayPickScrim=$("#dayPickScrim");if(dayPickScrim)dayPickScrim.onclick=closeDayPickSheet;
  const dayPickOk=$("#dayPickConfirm");if(dayPickOk)dayPickOk.onclick=()=>confirmPickerDay();
  const pkCancel=$("#exPickCancel");if(pkCancel)pkCancel.onclick=closeExercisePicker;
  const pkScrim=$("#exPickScrim");if(pkScrim)pkScrim.onclick=closeExercisePicker;
  const pkDone=$("#exPickDone");if(pkDone)pkDone.onclick=confirmPickerSelection;
  const pkSearch=$("#exPickSearch");
  if(pkSearch)pkSearch.oninput=()=>{if(pickerState){pickerState.query=pkSearch.value;renderPickerList()}};
  // Creating a custom exercise is the tail of a search that found nothing, so
  // the typed text becomes the new movement's name and the picker is handed
  // over rather than stacked under a second sheet.
  const pkCustom=$("#exPickCustom");
  if(pkCustom)pkCustom.onclick=()=>{
    const reopen=pickerResumeOptions();
    const selectedNow=reopen?.selected||[];
    const multi=pickerState?.mode==="multi";
    const onPick=pickerState?.onPick;
    const typed=String($("#exPickSearch")?.value||"").trim();
    const backToPicker=extraId=>{
      if(!reopen)return;
      openExercisePicker(Object.assign({},reopen,
        {selected:extraId?selectedNow.concat(extraId):selectedNow}))};
    openCustomExerciseSheet({entry:typed?{name:typed}:null,handoff:true,
      onCancel:()=>backToPicker(null),
      onSave:entry=>{
        // A multi-pick is still being assembled, so the picker comes back with
        // the new movement already ticked; a single pick is finished by it.
        if(multi){backToPicker(entry.id);return}
        if(onPick)return onPick(entry)}})};
  const cuCancel=$("#exCustomCancel");if(cuCancel)cuCancel.onclick=cancelCustomExerciseSheet;
  const cuScrim=$("#exCustomScrim");if(cuScrim)cuScrim.onclick=cancelCustomExerciseSheet;
  const cuSave=$("#exCustomSave");if(cuSave)cuSave.onclick=saveCustomExerciseSheet;
  const cuDelete=$("#exCustomDelete");if(cuDelete)cuDelete.onclick=deleteCustomExerciseSheet;
  const ptClose=$("#programTextClose");if(ptClose)ptClose.onclick=closeProgramTextSheet;
  const ptScrim=$("#programTextScrim");if(ptScrim)ptScrim.onclick=closeProgramTextSheet;
  const ptCopy=$("#programTextCopy");if(ptCopy)ptCopy.onclick=copyProgramText;
  const ssClose=$("#shareSetupClose");if(ssClose)ssClose.onclick=closeShareSetupSheet;
  const ssScrim=$("#shareSetupScrim");if(ssScrim)ssScrim.onclick=closeShareSetupSheet;
  const ssCopy=$("#shareSetupCopy");if(ssCopy)ssCopy.onclick=copySetupLink;
  const ssShare=$("#shareSetupShare");if(ssShare)ssShare.onclick=shareSetupLinkNow;
  const libBack=$("#libBack");
  if(libBack)libBack.onclick=()=>{
    if(libFlow?.step==="configure"){libFlow.step="browse";renderLibrary();return}
    closeLibrary()};
  const libClose=$("#libClose");if(libClose)libClose.onclick=()=>closeLibrary();
  const libPrimary=$("#libPrimary");if(libPrimary)libPrimary.onclick=()=>commitLibrarySelection();
  const libSearch=$("#libSearch");
  if(libSearch)libSearch.oninput=()=>{if(libFlow){libFlow.query=libSearch.value;renderLibrary()}};
  const libCustom=$("#libCustom");
  if(libCustom)libCustom.onclick=()=>{
    const reopen=libraryResumeOptions();
    const typed=String($("#libSearch")?.value||"").trim();
    openCustomExerciseSheet({entry:typed?{name:typed}:null,
      onCancel:()=>{if(reopen)openLibrary(reopen)},
      onSave:entry=>{
        if(!reopen)return;
        // The definition the lifter just described is the one they were looking
        // for, so it comes back selected.
        const selected=librarySelectionMap(reopen.selected);selected.set(entry.id,null);
        openLibrary(Object.assign({},reopen,{selected:[...selected.entries()]}))}})};
  const previewBack=$("#previewBack");if(previewBack)previewBack.onclick=closeExercisePreview;
  const pkFull=$("#exPickFull");
  if(pkFull)pkFull.onclick=()=>{
    const resume=pickerResumeOptions(),target=pickerState?.day||day;
    closeExercisePicker().then(()=>openLibrary({day:target,query:resume?.query||"",muscle:resume?.muscle||null,equipment:resume?.equipment||null}))};
  const impBack=$("#importBack");if(impBack)impBack.onclick=()=>closeImportReview();
  const impCancel=$("#importReviewCancel");
  if(impCancel)impCancel.onclick=()=>{closeImportReview();toast(t("toast.program_import_cancelled"))};
  const impCommit=$("#importCommit");
  if(impCommit)impCommit.onclick=()=>commitImportReview(pendingImportIo||storageIO);
  const ptShare=$("#programTextShare");if(ptShare)ptShare.onclick=shareProgramText;
  trackSheetViewport();
  blockZoomGestures();
  // Every bottom sheet is dismissed the way its grab handle says it is: pushed
  // back down. Delegated, so a sheet added later is dragged without new wiring.
  document.addEventListener("pointerdown",sheetDragStart);
  window.addEventListener("pointermove",sheetDragMove,{passive:true});
  window.addEventListener("pointerup",sheetDragEnd);
  window.addEventListener("pointercancel",sheetDragEnd);
  const openSettingsBtn=$("#openSettings");if(openSettingsBtn)openSettingsBtn.onclick=()=>openSettingsView();
  const settingsBack=$("#settingsBack");if(settingsBack)settingsBack.onclick=()=>navTo("log");
  const startWo=$("#startWorkout");if(startWo)startWo.onclick=()=>enterWorkout({focus:true});
  const otherDay=$("#chooseAnotherDay");if(otherDay)otherDay.onclick=()=>openDayPickSheet();
  const viewEx=$("#viewExercises");if(viewEx)viewEx.onclick=()=>enterWorkout({focus:false});
  const reviewToday=$("#reviewTodaySession");if(reviewToday)reviewToday.onclick=()=>openTodaySessionInHistory();
  // Training twice in a day is the lifter's call, never Today's suggestion, so it
  // opens the day that follows the one already done rather than repeating it.
  const another=$("#logAnotherSession");if(another)another.onclick=()=>enterWorkout({day:dayAfterTrainedToday()||day,focus:true});
  const leaveWo=$("#leaveWorkout");if(leaveWo)leaveWo.onclick=leaveWorkout;
  const woOv=$("#woOverflowBtn");if(woOv)woOv.onclick=e=>{e.stopPropagation();toggleWorkoutOverflow()};
  // The menu is a popover: any choice inside it, a tap outside, or Escape closes it.
  // iOS does not reliably bubble click to document, so touchstart backs it up.
  const dismissOverflow=e=>{
    if(tourActive)return;
    const menu=$("#woOverflow");if(!menu||menu.classList.contains("hidden"))return;
    const target=e.target instanceof Element?e.target:null;
    if(target&&(menu.contains(target)||target.closest("#woOverflowBtn")))return;
    closeWorkoutOverflow()};
  document.addEventListener("click",dismissOverflow);
  document.addEventListener("touchstart",dismissOverflow,{passive:true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeWorkoutOverflow();closeEffortPop()}});
  // The effort explainer dismisses like any popover: a tap anywhere off it, or
  // a swipe of the card underneath. Capture, so a card drag never outlives it.
  document.addEventListener("pointerdown",e=>{
    const el=e.target instanceof Element?e.target:null;
    if(el?.closest(".effortpop, [data-effspin], [data-effstep]"))return;
    closeEffortPop()},{capture:true});
  let deckResize;
  window.addEventListener("resize",()=>{clearTimeout(deckResize);deckResize=setTimeout(sizeFocusDeck,120)});
  // Focus mode is a card deck: drag it sideways, or use the arrow keys.
  const wk=$("#workout");
  if(wk)wk.addEventListener("pointerdown",focusDragStart);
  window.addEventListener("pointermove",focusDragMove,{passive:true});
  window.addEventListener("pointerup",focusDragEnd);
  window.addEventListener("pointercancel",focusDragEnd);
  document.addEventListener("keydown",e=>{
    if(!workoutActive||logMode!=="focus")return;
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    const el=e.target instanceof Element?e.target:null;
    if(el&&el.closest("input,select,textarea,[contenteditable]"))return;
    if(e.key==="ArrowRight")focusAnimateTo(1);
    else if(e.key==="ArrowLeft")focusAnimateTo(-1)});
  const woDate=$("#date");if(woDate)woDate.addEventListener("change",()=>{contextTouched.date=true;saveDraft();closeWorkoutOverflow()});
  const woNotes=$("#notes");if(woNotes)woNotes.addEventListener("input",()=>{contextTouched.sessionNotes=true;saveDraft()});
  const woBw=$("#bodyweight");if(woBw)woBw.addEventListener("input",()=>{contextTouched.bodyweight=true;saveDraft()});
  const progEdit=$("#programEditToggle");if(progEdit)progEdit.onclick=async()=>{
    if(programEditMode&&state[STORAGE_FOLLOWUP]?.kind==="onboarding-edit"){
      const proposal=cloneSnapshot(state);delete proposal[STORAGE_FOLLOWUP];
      const result=await commitProposedState(proposal,storageIO);
      if(!(result.localOk||result.idbOk))return;
      programEditMode=false;renderProgram();
      if(!maybeStartTour())maybeShowInstallBanner();
      return}
    programEditMode=!programEditMode;renderProgram()};
  const histSearchBtn=$("#historySearchBtn");if(histSearchBtn)histSearchBtn.onclick=()=>setHistorySearchOpen(!isHistorySearchOpen());
  const histSearch=$("#historySearch");if(histSearch)histSearch.oninput=()=>{histQuery=histSearch.value;renderHistory()};
  const histSearchClear=$("#historySearchClear");if(histSearchClear)histSearchClear.onclick=()=>clearHistorySearch();
  const histExport=$("#historyExportBtn");if(histExport)histExport.onclick=exportCsv;
  const gotoVol=$("#gotoVolume");if(gotoVol)gotoVol.onclick=()=>setStatsSeg("volume");
  const restRow=$("#restSecRow");if(restRow)restRow.onclick=()=>setDisclosure(restRow,$("#restSecPanel"),!$("#restSecPanel")?.classList.contains("is-open"));
  const rirRow=$("#rirModeRow");if(rirRow)rirRow.onclick=()=>setDisclosure(rirRow,$("#rirModePanel"),!$("#rirModePanel")?.classList.contains("is-open"));
  const progRow=$("#progressionRow");if(progRow)progRow.onclick=()=>setDisclosure(progRow,$("#progressionDetails"),!$("#progressionDetails")?.classList.contains("is-open"));
  const notifyCfg=$("#notifyConfigRow");if(notifyCfg)notifyCfg.onclick=()=>setDisclosure(notifyCfg,$("#notifyTypes"),!$("#notifyTypes")?.classList.contains("is-open"));
  const dataBackup=$("#dataBackupRow");if(dataBackup)dataBackup.onclick=()=>setDisclosure(dataBackup,$("#dataBackupPanel"),!$("#dataBackupPanel")?.classList.contains("is-open"));
  const dataImport=$("#dataImportRow");if(dataImport)dataImport.onclick=()=>setDisclosure(dataImport,$("#dataImportPanel"),!$("#dataImportPanel")?.classList.contains("is-open"));
  [["#restSecRow","#restSecPanel"],["#rirModeRow","#rirModePanel"],["#progressionRow","#progressionDetails"],["#notifyConfigRow","#notifyTypes"],["#dataBackupRow","#dataBackupPanel"],["#dataImportRow","#dataImportPanel"]].forEach(([b,p])=>setDisclosure($(b),$(p),false));
  const commitChangedSettings=()=>{settingsEditRevision++;return commitSettings(true)};
  $("#settings").addEventListener("input",()=>{settingsEditRevision++});
  const voiceTog=$("#voiceToggle");if(voiceTog)voiceTog.onclick=()=>{const c=$("#voiceInputEnabled");if(c){c.checked=!c.checked;commitChangedSettings()}};
  const telemetryTog=$("#telemetryToggle");if(telemetryTog)telemetryTog.onclick=()=>{
    try{window.RepForgeTelemetry?.setEnabled(!(window.RepForgeTelemetry?.isEnabled?.()!==false))}catch{}
    renderSettings()};
  const notifyTog=$("#notifyToggle");if(notifyTog)notifyTog.onclick=()=>{
    const on=notifyPending||notifyEffective();
    setNotificationsEnabled(!on)};
  const onbCancel=$("#onbCancel");if(onbCancel)onbCancel.onclick=()=>{if(onbStep>0){onbStep--;renderOnboarding()}else cancelOnboarding()};
  document.addEventListener("visibilitychange",onAppVisible);
  $("#glossary .glossary__close").onclick=()=>$("#glossary").classList.add("hidden");
  document.addEventListener("click",e=>{const g=$("#glossary");if(!g||g.classList.contains("hidden"))return;
    if(!g.contains(e.target)&&!e.target.closest("[data-term]"))g.classList.add("hidden")});
  // Comma decimals from locale keypads: rewrite digit-comma-digit to a period
  // as the user types so steppers, drafts, and saves all see a parseable value.
  document.addEventListener("input",e=>{
    const t=e.target;if(!(t instanceof HTMLInputElement))return;
    if((t.getAttribute("inputmode")||t.inputMode)!=="decimal")return;
    const next=t.value.replace(/(\d),(\d)/g,"$1.$2");
    if(next===t.value)return;
    const s=t.selectionStart,en=t.selectionEnd;t.value=next;
    if(s!=null)try{t.setSelectionRange(s,en)}catch{}});
  $$("[data-term]").forEach(b=>{if(!b.onclick)b.onclick=e=>{e.stopPropagation();glossaryPopover(b.dataset.term,b)}});
  $("#statsDeep").addEventListener("toggle",()=>{if($("#statsDeep").open)redrawChart()});
  applyDraftContextToDom();
  updateBodyweightField();
  $("#modeFull").onclick=()=>setLogMode("full");
  $("#modeFocus").onclick=()=>setLogMode("focus");
  syncLogModeControls();
  const vBtn=$("#voiceBtn");if(vBtn)vBtn.onclick=()=>{closeWorkoutOverflow();startVoiceInput()};
  updateVoiceBtn();
  $("#logForm").addEventListener("submit",(e)=>{e.preventDefault();saveWorkout(e)});
  $("#statExercise").onchange=renderStats;
  $("#saveProgram").onclick=saveProgram;
  // Unsaved JSON now outlives a render, so collapsing Advanced is the way to
  // throw a scratch edit away — including one too broken to save.
  const advanced=$("#program details.advanced");
  if(advanced)advanced.addEventListener("toggle",()=>{if(!advanced.open)syncProgramJson({force:true})});
  $("#exportProgram").onclick=exportProgram;
  $("#importProgram").onchange=importProgramFile;
  $("#addDay").onclick=async()=>{
    const proposal=cloneSnapshot(state),nextProgram=new Program(proposal.program);
    const nextDay=nextProgram.addDay();proposal.program=nextProgram.toJSON();
    const result=await commitProposedState(proposal);
    if(result.localOk||result.idbOk){day=nextDay;render();toast(t("toast.day_added"))}};
  $("#endBlock").onclick=promptEndBlock;
  $("#saveSettings").onclick=()=>commitSettings(false);
  $("#beginnerProgram").onclick=()=>{
    const draftActive=draftHasProgress(),discardDraftRaw=readDraftRaw();
    const key=draftActive?"confirm.replace_program_discard_draft":"confirm.replace_program_template";
    if(confirm(t(key)))switchToBeginnerProgram(discardDraftRaw)};
  $("#createProgram").onclick=()=>startOnboarding("settings");
  $("#onbBack").onclick=()=>{if(onbStep>0){onbStep--;renderOnboarding()}};
  $("#onbNext").onclick=()=>{if(onbStep<7&&onbCanNext()){onbStep++;renderOnboarding()}};
  ["#jumpPct","#minJump","#rirHigh","#hardRir","#restSec","#unit","#lang"].forEach(sel=>$(sel).onchange=commitChangedSettings);
  // Appearance lives in UI prefs, so it never joins a state proposal.
  const themeSel=$("#theme");if(themeSel)themeSel.onchange=()=>setTheme(themeSel.value);
  $$('input[name="rirMode"]').forEach(r=>r.onchange=commitChangedSettings);
  const vi=$("#voiceInputEnabled");if(vi)vi.onchange=commitChangedSettings;
  const ne=$("#notifyEnabled");
  if(ne)ne.onchange=()=>setNotificationsEnabled(!!ne.checked);
  ["#notifyTimer","#notifySession","#notifyUnfinished","#notifyMissed"].forEach(sel=>{const el=$(sel);if(el)el.onchange=commitChangedSettings});
  $$("#volWindow button").forEach(b=>b.onclick=()=>{volWindow=+b.dataset.win;renderCompleted()});
  $$("#statsSeg button").forEach(b=>b.onclick=()=>setStatsSeg(b.dataset.seg));
  const lc=$("#logContext");if(lc)lc.onclick=()=>{navTo("stats");setStatsSeg("review")};
  $("#exportCsv").onclick=exportCsv;$("#exportJson").onclick=exportJson;$("#importJson").onchange=importJson;
  $("#reset").onclick=async()=>{
    const discardDraftRaw=readDraftRaw();
    if(confirm(t("confirm.delete_log")))await deleteTrainingLog(storageIO,{discardDraftRaw})};
  $$("nav button").forEach(b=>b.onclick=()=>{exView=null;workoutActive=false;workoutLeft=true;
    document.body.classList.remove("is-settings","is-exercise","is-onboarding","is-workout");
    $$("nav button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-current",on?"page":"false")});
    $$(".view").forEach(v=>v.classList.toggle("active",v.id===b.dataset.view));window.scrollTo({top:0});render()});
  $("#exBack").onclick=closeExerciseView;
  $("nav button.active")?.setAttribute("aria-current","page");
  render();
  maybeUnfinishedOnOpen();
  // First run puts the install first and the program choice second. Where there
  // is no install to offer, the gate would add a step and nothing else, so
  // onboarding opens exactly as it always has.
  if(!maybeShowFirstRun()){
    maybeShowOnboarding();
    if(!$("#onboarding").classList.contains("active"))maybeShowInstallBanner()}
}
function applyGotoParam(){
  try{
    const u=new URL(location.href);
    const g=u.searchParams.get("goto");
    if(g && days().includes(g)) day=g;
    if(u.searchParams.has("goto")){
      u.searchParams.delete("goto");
      history.replaceState({}, "", u.pathname+u.search+u.hash);
    }
  }catch{}
}

function recoveryCopyLabel(side){return t(side==="local"?"dialog.storage_recovery.copy_a":"dialog.storage_recovery.copy_b")}
function recoverySummaryText(parsed){
  const sum=snapshotSummary(parsed),name=sum.name||t("dialog.storage_recovery.unnamed");
  if(sum.lastDate)return t("dialog.storage_recovery.summary",{name,sessions:sum.sessions,sets:sum.sets,date:sum.lastDate});
  return t("dialog.storage_recovery.summary_empty",{name,sessions:sum.sessions,sets:sum.sets})}
function recoveryStatusText(read){
  if(read.status==="valid")return recoverySummaryText(read.parsed);
  if(read.status==="invalid")return t("dialog.storage_recovery.invalid_copy");
  if(read.status==="failed")return t("dialog.storage_recovery.unread_copy");
  return t("dialog.storage_recovery.absent_copy")}
function closeStorageRecovery(){
  closeModal($("#storageRecovery"))}
function bindStorageRecoveryGuard(d){
  if(!d||d.dataset.guarded)return;
  d.dataset.guarded="1";
  d.addEventListener("cancel",e=>e.preventDefault());
  d.addEventListener("click",e=>{if(e.target===d)e.stopPropagation()})}
function exportRecoveryRaw(raw,name){download(encodeRawExport(raw),name,"application/json")}
function presentStorageRecovery(decision){
  return new Promise(resolve=>{
    const d=$("#storageRecovery");if(!d){resolve({kind:"first-run"});return}
    bindStorageRecoveryGuard(d);
    const langHint=decision.local?.parsed?.settings?.lang||decision.idb?.parsed?.settings?.lang;
    if(I18N)I18N.setLang(langHint||I18N.detectLang());
    let retryBusy=false;
    const bump=()=>{d.dataset.seq=String((+d.dataset.seq||0)+1)};
    const finish=choice=>{d.dataset.resolved="1";d.dataset.busy="0";bump();closeStorageRecovery();resolve(choice)};
    const paint=()=>{
      const title=$("#storageRecoveryTitle"),lead=$("#storageRecoveryLead"),copies=$("#storageRecoveryCopies"),actions=$("#storageRecoveryActions");
      const reason=decision.reason;
      title.textContent=reason==="no-valid"?t("dialog.storage_recovery.title_blocked"):t("dialog.storage_recovery.title");
      lead.textContent=reason==="divergent"?t("dialog.storage_recovery.divergent"):
        reason==="valid-plus-failed"?t("dialog.storage_recovery.valid_failed"):
        reason==="valid-plus-invalid"?t("dialog.storage_recovery.valid_invalid"):
        t("dialog.storage_recovery.none_valid");
      copies.innerHTML=`<div class="storage-recovery__copy"><p class="storage-recovery__copy-label">${esc(recoveryCopyLabel("local"))}</p><p>${esc(recoveryStatusText(decision.local))}</p></div>`+
        `<div class="storage-recovery__copy"><p class="storage-recovery__copy-label">${esc(recoveryCopyLabel("idb"))}</p><p>${esc(recoveryStatusText(decision.idb))}</p></div>`;
      const btns=[];
      const add=(id,cls,key)=>btns.push(`<button type="button" class="btn ${cls}" id="${id}">${esc(t(key))}</button>`);
      add("storageExportA","btn--steel","dialog.storage_recovery.export_a");
      add("storageExportB","btn--steel","dialog.storage_recovery.export_b");
      add("storageRetry","btn--steel","dialog.storage_recovery.retry");
      if(reason==="divergent"){
        add("storageUseA","btn--cta","dialog.storage_recovery.use_a");
        add("storageUseB","btn--cta","dialog.storage_recovery.use_b")}
      else if(reason==="valid-plus-invalid"||reason==="valid-plus-failed"){
        add("storageOverwrite","btn--cta","dialog.storage_recovery.overwrite")}
      else{
        add("storageExportRaw","btn--steel","dialog.storage_recovery.export_raw");
        add("storageStartFresh","btn--danger","dialog.storage_recovery.start_fresh")}
      actions.innerHTML=btns.join("");
      $("#storageExportA").onclick=()=>exportRecoveryRaw(decision.local?.raw,"taurifer_copy_a.json");
      $("#storageExportB").onclick=()=>exportRecoveryRaw(decision.idb?.raw,"taurifer_copy_b.json");
      $("#storageRetry").onclick=async()=>{
        if(retryBusy)return;retryBusy=true;d.dataset.busy="1";
        try{const local=readLocalStatus(),idb=await readIdbStatus(),next=chooseSnapshot(local,idb);
          if(next.kind!=="unresolved"){finish(next);return}
          decision=next;paint()}
        finally{retryBusy=false;d.dataset.busy="0"}};
      const useA=$("#storageUseA");if(useA)useA.onclick=()=>finish({kind:"chosen",snapshot:decision.local.parsed,source:"local",heal:"idb"});
      const useB=$("#storageUseB");if(useB)useB.onclick=()=>finish({kind:"chosen",snapshot:decision.idb.parsed,source:"idb",heal:"local"});
      const overwrite=$("#storageOverwrite");
      if(overwrite)overwrite.onclick=()=>{
        if(!confirm(t("dialog.storage_recovery.overwrite_confirm")))return;
        const winner=decision.local?.status==="valid"?decision.local.parsed:decision.idb.parsed;
        const heal=decision.local?.status==="valid"?"idb":"local";
        finish({kind:"chosen",snapshot:winner,source:heal==="idb"?"local":"idb",heal})};
      const exportRaw=$("#storageExportRaw");
      if(exportRaw)exportRaw.onclick=()=>{
        exportRecoveryRaw(decision.local?.raw,"taurifer_copy_a.json");
        exportRecoveryRaw(decision.idb?.raw,"taurifer_copy_b.json")};
      const fresh=$("#storageStartFresh");
      if(fresh)fresh.onclick=async()=>{
        if(retryBusy)return;
        if(!confirm(t("dialog.storage_recovery.start_fresh_confirm")))return;
        retryBusy=true;d.dataset.busy="1";
        const {localNow,idbNow}=await withStorageLock(storageIO,async()=>{
          try{localStorage.removeItem(KEY)}catch{}
          try{await idbDel(KEY)}catch{}
          return{localNow:readLocalStatus(),idbNow:await readIdbStatus()}});
        if(localNow.status==="absent"&&idbNow.status==="absent"){
          clearAllPendingJournal();
          finish({kind:"first-run"})}
        else{
          decision={kind:"unresolved",reason:"no-valid",local:localNow,idb:idbNow};
          retryBusy=false;delete d.dataset.busy;paint()}
      };
      if(!d.open)d.showModal();
      openModal(d,{
        initialFocus:$("#storageExportA")||$("#storageRetry")||title,
        returnFocus:todayPrimaryControl,
        onEscape:null
      });
      bump();
      const focusEl=$("#storageExportA")||$("#storageRetry")||title;
      if(focusEl)focusEl.focus()};
    paint()})}
function recoveryChoiceMatches(candidate,current){
  if(candidate?.kind!=="chosen"||(candidate.source!=="local"&&candidate.source!=="idb"))return false;
  const selected=candidate.source==="local"?current.local:current.idb;
  return selected?.status==="valid"&&storageSnapshotsEqual(selected.parsed,candidate.snapshot)}
async function resolveBootReplicas(candidate=null){
  return withStorageLock(storageIO,async()=>{
    const local=readLocalStatus(),idb=await readIdbStatus();
    let decision=chooseSnapshot(local,idb);
    if(decision.kind==="unresolved"){
      if(!recoveryChoiceMatches(candidate,decision))return decision;
      decision={kind:"chosen",snapshot:cloneSnapshot(candidate.snapshot),source:candidate.source,
        heal:candidate.source==="local"?"idb":"local"}}
    let head=decision.kind==="first-run"?null:cloneSnapshot(decision.snapshot),replayed=false,draftConflict=false;
    const storedTransaction=head&&pendingDraftTransaction(head);
    if(storedTransaction){
      const storedRecord=readPendingJournal().entries.find(record=>record.journal.id===storedTransaction.id)||null;
      const finalized=finalizedDraftTransactionSnapshot(head);
      const execution=await executeDraftTransaction({record:storedRecord,
        transactionId:storedTransaction.id,effect:storedTransaction.effect,prepared:head,
        snapshot:finalized,io:storageIO,writePrepared:false,
        preparedResult:{revision:readRevision(head),localOk:true,idbOk:true}});
      if(!execution.settled||
        (execution.kind!=="committed"&&execution.kind!=="rejected"&&execution.kind!=="compensated"))
        return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
      head=execution.snapshot;
      draftConflict=execution.kind!=="committed";
      replayed=true;
      decision={kind:"chosen",snapshot:head,source:"pending"}}
    const pending=readPendingJournal();
    for(const invalid of pending.invalid)clearPendingJournal(invalid);
    for(const record of pending.entries){
      const journal=record.journal;
      if(journal.effectOutcome.status===DRAFT_EFFECT_INVALID){
        const discarded=await executeDraftTransaction({record,transactionId:journal.id,
          effect:journal.effectOutcome,discard:true});
        if(!discarded.settled)
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        draftConflict=true;
        continue}
      if(pendingJournalSuccessorMatches(record,head)){
        const prepared=preparePendingDraftTransaction(
          head,journal.rollback,journal.effectOutcome,journal.id);
        const execution=await executeDraftTransaction({record,transactionId:journal.id,
          effect:journal.effectOutcome,prepared,snapshot:head,io:storageIO,writePrepared:false,
          preparedResult:{revision:readRevision(head),localOk:true,idbOk:true}});
        if(!execution.settled||
          (execution.kind!=="committed"&&execution.kind!=="rejected"&&execution.kind!=="compensated"))
          return{kind:"unresolved",reason:"pending-transaction",
            local:readLocalStatus(),idb:await readIdbStatus()};
        head=execution.snapshot;
        if(execution.kind!=="committed")draftConflict=true;
        replayed=true;
        continue}
      if(journal.expectedProgramId&&head?.programMeta?.id!==journal.expectedProgramId){
        const discarded=await executeDraftTransaction({record,transactionId:journal.id,
          effect:journal.effectOutcome,discard:true});
        if(!discarded.settled)
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        continue}
      if(journal.expectedProgramFingerprint&&
        draftProgramFingerprint(head)!==journal.expectedProgramFingerprint){
        const discarded=await executeDraftTransaction({record,transactionId:journal.id,
          effect:journal.effectOutcome,discard:true});
        if(!discarded.settled)
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        continue}
      if(journal.expectedFirstRunEmpty&&
        (head?.programMeta?.onboarded||head?.log?.length||head?.programHistory?.length)){
        const discarded=await executeDraftTransaction({record,transactionId:journal.id,
          effect:journal.effectOutcome,discard:true});
        if(!discarded.settled)
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        continue}
      const journalHead=head||cloneSnapshot(journal.base);
      const snapshot=stateSnapshotForHead(journal.base,journal.liveBase,journal.proposal,journalHead,
        {replace:journal.replace,reconcileSessionIds:journal.reconcileSessionIds,dayRenames:journal.dayRenames,
          expectedFirstRunEmpty:journal.expectedFirstRunEmpty,sharedRebaseSeed:journal.id});
      const prepared=preparePendingDraftTransaction(snapshot,journalHead,journal.effectOutcome,journal.id);
      const execution=await executeDraftTransaction({record,transactionId:journal.id,
        effect:journal.effectOutcome,prepared,snapshot,io:storageIO,writePrepared:true,
        retainRecordOnWriteFailure:true});
      if(execution.kind==="write-failed")
        break;
      if(execution.kind==="precondition-rejected"){
        if(!execution.settled)
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        draftConflict=true;
        continue}
      if(!execution.settled||
        (execution.kind!=="committed"&&execution.kind!=="rejected"&&execution.kind!=="compensated"))
        return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
      head=execution.snapshot;
      if(execution.kind!=="committed")draftConflict=true;
      replayed=true}
    if(replayed)return{kind:"chosen",snapshot:head,source:"pending",draftConflict};
    if(decision.kind==="chosen"&&decision.heal)await writeSnapshot(cloneSnapshot(decision.snapshot),storageIO);
    return Object.assign({},decision,{draftConflict})})}
async function applyBootDecision(decision){
  if(decision.kind==="first-run")state=normalizeLoaded(null);
  else state=normalizeLoaded(decision.snapshot);
  prog=new Program(state.program);state.program=prog.toJSON();
  state.programMeta=normalizeProgramMeta(state.programMeta,state.log,state.program);
  resetPersistenceBase(decision.kind==="first-run"?state:decision.snapshot);
  DraftStore.promote(null,draftContextFingerprint(state));
  day=days()[0]||"Day 1";
  applyGotoParam();
  const migrated=migrateLog();
  const metaDrift=decision.snapshot&&canonicalPayload({programMeta:decision.snapshot.programMeta})!==canonicalPayload({programMeta:state.programMeta});
  const revisionless=decision.snapshot&&!Object.prototype.hasOwnProperty.call(decision.snapshot,STORAGE_REV);
  if(decision.kind==="first-run"||decision.migrate||revisionless||migrated||metaDrift)await persist();
  if(I18N)I18N.setLang(resolveLang())}
window.__repforgeSharedSetup={
  get status(){return sharedSetupDraft.status},
  get source(){return sharedSetupDraft.source},
  get error(){return sharedSetupDraft.error},
  get summary(){return sharedSetupDraft.payload?{
    name:sharedSetupDraft.payload.program.meta.name,
    daysPerWeek:sharedSetupDraft.payload.program.meta.daysPerWeek,
    lang:sharedSetupDraft.payload.settings.lang}:null},
  build:buildSharedSetupPayload,
  buildPayload:buildSharedSetupPayload,
  proposal:proposalFromSharedSetup,
  proposalFromSharedSetup,
  buildProposal:(payload,base)=>proposalFromSharedSetup(payload,base||state),
  commit:io=>commitSharedSetup(io||storageIO),
  eligible:sharedSetupEligible};
function captureSharedSetupSource({allowCookie=true}={}){
  if(!SharedSetup)return null;
  try{
    const fragment=SharedSetup.readSetupFragment();
    if(fragment!=null){
      sharedSetupDraft={status:"loading",source:"fragment",encoded:null,payload:null,error:null,previousLang:null};
      return{source:"fragment",encoded:fragment}}
    if(!allowCookie)return null;
    const cookie=SharedSetup.readHandoffCookie();
    if(cookie){
      sharedSetupDraft={status:"loading",source:"cookie",encoded:null,payload:null,error:null,previousLang:null};
      return{source:"cookie",encoded:cookie}}
    return null}
  catch{
    sharedSetupDraft={status:"invalid",source:null,encoded:null,payload:null,error:"invalid-schema",previousLang:null};
    return null}}
async function prepareSharedSetup(candidate){
  if(!candidate||!SharedSetup)return;
  const {source,encoded}=candidate;
  let staged=false,matchingCookie=false;
  try{matchingCookie=SharedSetup.readHandoffCookie()===encoded}catch{}
  if(source==="fragment"&&typeof encoded==="string"&&
    encoded.length<=SharedSetup.MAX_ENCODED_CHARS){
    try{
      staged=SharedSetup.writeHandoffCookie(encoded)===true;
      if(staged&&location.pathname===SharedSetup.handoffCookiePath())
        staged=SharedSetup.readHandoffCookie()===encoded}
    catch{staged=false}}
  let decoded;
  try{decoded=await SharedSetup.decode(encoded,{builtInIds:SHARED_BUILT_IN_IDS})}
  catch{decoded={ok:false,code:"invalid-schema"}}
  if(!decoded.ok){
    if(source==="cookie"||staged||matchingCookie)SharedSetup.clearHandoffCookie();
    const unsupported=decoded.code==="unsupported-version"||decoded.code==="decompression-unavailable";
    sharedSetupDraft={status:unsupported?"unsupported":"invalid",source,encoded:null,payload:null,
      error:decoded.code,previousLang:null};
    return}
  if(source==="fragment"&&staged){
    const next=SharedSetup.removeSetupFragment();
    history.replaceState({},"",next)}
  if(!sharedSetupEligible()){
    sharedSetupDraft={status:source==="fragment"?"existing":"none",source,encoded:null,payload:null,
      error:source==="fragment"?"existing":null,previousLang:null};
    return}
  const previousLang=I18N?.getLang?.()||state.settings.lang||I18N?.detectLang?.()||"en";
  sharedSetupDraft={status:"ready",source,encoded,payload:decoded.value,error:null,previousLang};
  I18N?.setLang(decoded.value.settings.lang)}
async function handleSharedSetupHash(){
  const candidate=captureSharedSetupSource({allowCookie:false});
  if(!candidate||candidate.source!=="fragment")return;
  if(firstRunOpen())suspendFirstRun();
  await prepareSharedSetup(candidate);
  if(sharedSetupDraft.status==="existing"){
    closeFirstRun();toast(t("setup.shared.existing"),{assertive:true});return}
  applyI18n();
  if(firstRunPending())openFirstRun()}
async function boot(){
  // The starter program is minted while the first-run state is built, so the
  // language has to be settled before that — not after the state exists.
  const sharedCandidate=captureSharedSetupSource();
  if(I18N)I18N.setLang(I18N.detectLang());
  bootTelemetry();
  let decision=await resolveBootReplicas();
  while(decision.kind==="unresolved"){
    const candidate=await presentStorageRecovery(decision);
    decision=await resolveBootReplicas(candidate)}
  await applyBootDecision(decision);
  await prepareSharedSetup(sharedCandidate);
  hydrateWorkoutDraft({restoreDay:true});
  resumeProgramEditFollowUp();
  init();
  captureEvent("app_boot",{first_run:firstRunPending(),language:I18N?.getLang?.()==="pt"?"pt":"en",platform_class:telemetryPlatformClass()});
  if(sharedSetupDraft.status==="existing")toast(t("setup.shared.existing"),{assertive:true});
  if(decision.draftConflict)toast(t("toast.draft_conflict_retry"),{assertive:true})}
boot();
