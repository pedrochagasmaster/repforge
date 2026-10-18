/** Canonical durable values and identity policy. No browser or live state access.
 * Storage receipts are deliberately included in mirror arbitration and omitted
 * only from interchange exports. Changing that distinction loses activations.
 */
const STORAGE_REV='_storageRevision', STORAGE_FOLLOWUP='_storageFollowUp';
const STORAGE_DRAFT_TXN='_storageDraftTransaction', STORAGE_SETUP_TXN='_storageSetupActivation';
const SHARED_IMPORT='_sharedSetupImport';
const PENDING_EFFECT_MAX_RAW=1000000;
const DRAFT_EFFECT_VALID='valid', DRAFT_EFFECT_INVALID='invalid', DRAFT_EFFECT_NONE='none';
const DRAFT_PRECONDITION_MATCH_ONLY='match-only', DRAFT_PRECONDITION_ABORT_CHANGED='abort-changed', DRAFT_PRECONDITION_ABORT_SAME_DAY='abort-same-day';

  function cloneSnapshot(snapshot) {
    if (snapshot == null || typeof snapshot !== "object") return snapshot;
    try {
      if (typeof structuredClone === "function") return structuredClone(snapshot);
    } catch {
      // fallback to JSON clone
    }
    return JSON.parse(JSON.stringify(snapshot));
  }

function isPlainStateObject(value){
  if(!value||typeof value!=="object"||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null}
  function readRevision(snapshot) {
    return Number.isInteger(snapshot?.[STORAGE_REV]) && snapshot[STORAGE_REV] > 0
      ? snapshot[STORAGE_REV]
      : 0;
  }

  function unversionedSnapshot(snapshot) {
    const out = cloneSnapshot(snapshot);
    if (out && typeof out === "object") delete out[STORAGE_REV];
    return out;
  }

  function stripStorageMeta(snapshot) {
    const out = cloneSnapshot(snapshot);
    if (out && typeof out === "object") {
      delete out[STORAGE_REV];
      delete out[STORAGE_FOLLOWUP];
      delete out[STORAGE_DRAFT_TXN];
      delete out[STORAGE_SETUP_TXN];
      delete out[SHARED_IMPORT];
    }
    return out;
  }

  function exportableState(snapshot) {
    return stripStorageMeta(snapshot);
  }

  function canonicalize(value) {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = canonicalize(value[key]);
    }
    return sorted;
  }

  function canonicalPayload(snapshot) {
    return JSON.stringify(canonicalize(stripStorageMeta(snapshot)));
  }

  function mirrorComparisonSnapshot(snapshot) {
    const clean = cloneSnapshot(snapshot);
    if (clean && typeof clean === "object") {
      delete clean._storageRevision;
      delete clean._storageFollowUp;
      delete clean._storageDraftTransaction;
    }
    return clean;
  }

  function snapshotsEqual(a, b) {
    return JSON.stringify(canonicalize(mirrorComparisonSnapshot(a))) ===
      JSON.stringify(canonicalize(mirrorComparisonSnapshot(b)));
  }

  function storageSnapshotsEqual(a, b) {
    return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
  }


    function snapshotBlockId(snapshot){
    const meta=snapshot?.programMeta;
    return Object.prototype.hasOwnProperty.call(meta||{},"blockId")?meta.blockId:null}

    // A program row never owns prescriptions; the ProgramDefinition does, and
    // loading drops a row's copy. Older installed-editor builds persisted that
    // copy (#344), so it cannot count toward the durable program's identity.
    function fingerprintRow(row){
    if(!row||typeof row!=="object"||!Object.prototype.hasOwnProperty.call(row,"prescriptionsByCycle"))return row;
    const{prescriptionsByCycle,...rest}=row;return rest}

    function draftProgramFingerprint(snapshot){
    const value={programMetaId:snapshot?.programMeta?.id||null,
      program:Array.isArray(snapshot?.program)?snapshot.program.map(fingerprintRow):[]};
    if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
      value.programMetaBlockId=snapshot.programMeta.blockId;
    return JSON.stringify(canonicalize(value))}


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

function workoutProgramFingerprint(snapshot){
  const source=draftProgramFingerprint(snapshot),seeds=[0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
  const hashes=seeds.map(seed=>{let hash=seed;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,0x01000193)}
    return(hash>>>0).toString(16).padStart(8,"0")});
  return`program-v1:${source.length}:${hashes.join("")}`}

function draftContextFingerprint(snapshot){
  const value={programMetaId:snapshot?.programMeta?.id||null,
    program:Array.isArray(snapshot?.program)?snapshot.program:[],
    unit:snapshot?.settings?.unit||"kg",rirMode:snapshot?.settings?.rirMode||"numeric"};
  if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
    value.programMetaBlockId=snapshot.programMeta.blockId;
  return JSON.stringify(canonicalize(value))}

function isValidBlockId(value,programId=null){
  return typeof value==="string"&&value.trim().length>0&&value.length<=240&&
    (programId==null||value!==programId)}
function isBoundedProgressionValue(value,depth=0,state={nodes:0}){
  if(++state.nodes>PROGRESSION_VALUE_LIMITS.nodes||depth>PROGRESSION_VALUE_LIMITS.depth)return false;
  if(typeof value==="string")return value.length<=PROGRESSION_VALUE_LIMITS.stringLength;
  if(value===null||typeof value==="boolean")return true;
  if(typeof value==="number")return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=PROGRESSION_VALUE_LIMITS.arrayItems&&value.every(item=>isBoundedProgressionValue(item,depth+1,state));
  if(!isPlainStateObject(value)||Object.keys(value).length>PROGRESSION_VALUE_LIMITS.keys)return false;
  return Object.keys(value).every(key=>isBoundedProgressionValue(value[key],depth+1,state));
}

const TRANSITION_VALUE_LIMITS=Object.freeze({depth:32,nodes:10000,keys:128,arrayItems:256,stringLength:10000});
function isBoundedTransitionValue(value,depth=0,state={nodes:0}){
  if(++state.nodes>TRANSITION_VALUE_LIMITS.nodes||depth>TRANSITION_VALUE_LIMITS.depth)return false;
  if(typeof value==="string")return value.length<=TRANSITION_VALUE_LIMITS.stringLength;
  if(value===null||typeof value==="boolean")return true;
  if(typeof value==="number")return Number.isFinite(value);
  if(Array.isArray(value))return value.length<=TRANSITION_VALUE_LIMITS.arrayItems&&value.every(item=>isBoundedTransitionValue(item,depth+1,state));
  if(!isPlainStateObject(value)||Object.keys(value).length>TRANSITION_VALUE_LIMITS.keys)return false;
  return Object.keys(value).every(key=>isBoundedTransitionValue(value[key],depth+1,state));
}
const RECOVERY_HASH_RE=/^[0-9a-f]{64}$/;
const RECOVERY_CARRIER_INSTANT_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RECOVERY_CARRIER_KEYS=["schemaVersion","records","quarantine"];
const RECOVERY_RECORD_KEYS=["schemaVersion","transitionId","kind","createdAt","status","predecessor","diagnosis","derivation","diff","progressionContract","archiveId","confirmedAt","proposalHash"];
const RECOVERY_OVERLAY_KEYS=["schemaVersion","policyVersion","transitionId","blockId","activePeriod","eligibilityEvidence","baseProgramFingerprint","entries","createdAt","confirmedAt","reassessmentDueAt","reassessmentOutcome"];
const RECOVERY_DIFF_KEYS=["days","exercises","prescriptions","recoveryWeek"];
const RECOVERY_QUARANTINE_REASONS=["known-schema-malformed-recovery","duplicate-target-conflict"];
const RECOVERY_REPLICA_SOURCES=["localStorage","indexedDB","both"];
function recoveryCodeUnitCompare(left,right){return left<right?-1:left>right?1:0}
function exactRecoveryKeys(value,keys){
  return isPlainStateObject(value)&&Object.keys(value).length===keys.length&&
    keys.every(key=>Object.prototype.hasOwnProperty.call(value,key))}
function isRecoveryCarrierQuarantineEntry(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value))return false;
  const keys=["schemaVersion","digest","raw","sourceReplica","detectedAt","reason"];
  if(Object.keys(value).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(value,key)))return false;
  return value.schemaVersion===1&&RECOVERY_HASH_RE.test(value.digest)&&
    typeof value.raw==="string"&&value.raw.length<=TRANSITION_VALUE_LIMITS.stringLength&&
    RECOVERY_REPLICA_SOURCES.includes(value.sourceReplica)&&
    RECOVERY_CARRIER_INSTANT_RE.test(value.detectedAt)&&
    RECOVERY_QUARANTINE_REASONS.includes(value.reason);
}
function isRecoveryCarrierRecord(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value))return false;
  if(!exactRecoveryKeys(value,RECOVERY_RECORD_KEYS))return false;
  const predecessor=value.predecessor,overlay=value.diff?.recoveryWeek,evidence=overlay?.eligibilityEvidence;
  const overlayKeys=RECOVERY_OVERLAY_KEYS;
  const diffKeys=RECOVERY_DIFF_KEYS;
  if(value.schemaVersion!==1||value.kind!=="recovery_week"||value.status!=="committed"||
    typeof value.transitionId!=="string"||!value.transitionId.trim()||
    !RECOVERY_CARRIER_INSTANT_RE.test(value.createdAt)||!RECOVERY_CARRIER_INSTANT_RE.test(value.confirmedAt)||
    !RECOVERY_HASH_RE.test(value.proposalHash)||value.archiveId!==null||
    !isPlainStateObject(predecessor)||typeof predecessor.programId!=="string"||!predecessor.programId.trim()||
    !isValidBlockId(predecessor.blockId,predecessor.programId)||
    !isPlainStateObject(value.diff)||Object.keys(value.diff).length!==diffKeys.length||!diffKeys.every(key=>Object.prototype.hasOwnProperty.call(value.diff,key))||
    !isPlainStateObject(overlay)||Object.keys(overlay).length!==overlayKeys.length||!overlayKeys.every(key=>Object.prototype.hasOwnProperty.call(overlay,key))||
    overlay.schemaVersion!==1||overlay.policyVersion!==2||overlay.transitionId!==value.transitionId||
    typeof overlay.blockId!=="string"||!overlay.blockId.trim()||overlay.blockId===predecessor.blockId||
    overlay.activePeriod!=="nextBlockWeek1"||!RECOVERY_CARRIER_INSTANT_RE.test(overlay.createdAt)||
    !RECOVERY_CARRIER_INSTANT_RE.test(overlay.reassessmentDueAt)||overlay.confirmedAt!==value.confirmedAt||
    ![null,"Better","About the same","Worse"].includes(overlay.reassessmentOutcome)||
    !isPlainStateObject(evidence)||evidence.sourceBlockId!==predecessor.blockId||
    typeof evidence.sourceBlockId!=="string"||!evidence.sourceBlockId.trim()||
    !Array.isArray(overlay.entries)||overlay.entries.length===0)return false;
  return true;
}
function isValidRecoveryTransitions(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value)||value.schemaVersion!==1)return false;
  const keys=RECOVERY_CARRIER_KEYS;
  if(!exactRecoveryKeys(value,keys))return false;
  return Array.isArray(value.records)&&value.records.length<=TRANSITION_VALUE_LIMITS.arrayItems&&
    value.records.every(isRecoveryCarrierRecord)&&Array.isArray(value.quarantine)&&
    value.quarantine.length<=TRANSITION_VALUE_LIMITS.arrayItems&&value.quarantine.every(isRecoveryCarrierQuarantineEntry);
}
/* Carrier classification is deliberately narrower than normalization. The
   supported envelope is closed: an unknown key/version is storage recovery,
   while a known envelope whose semantic record is malformed can fall back to
   the canonical program and leave bounded evidence. */
function classifyRecoveryRecordEnvelope(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value)||
    !exactRecoveryKeys(value,RECOVERY_RECORD_KEYS)||value.schemaVersion!==1)return"unknown";
  const diff=value.diff,overlay=diff?.recoveryWeek;
  if(!isPlainStateObject(diff)||!exactRecoveryKeys(diff,RECOVERY_DIFF_KEYS)||
    !isPlainStateObject(overlay)||!exactRecoveryKeys(overlay,RECOVERY_OVERLAY_KEYS)||
    overlay.schemaVersion!==1||overlay.policyVersion!==2)return"unknown";
  return isRecoveryCarrierRecord(value)?"valid":"malformed";
}
function classifyRecoveryCarrier(value){
  if(value===undefined)return{kind:"absent",malformed:[],valid:[],needsEvidence:false};
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value)||
    !exactRecoveryKeys(value,RECOVERY_CARRIER_KEYS)||value.schemaVersion!==1||
    !Array.isArray(value.records)||value.records.length>TRANSITION_VALUE_LIMITS.arrayItems||
    !Array.isArray(value.quarantine)||value.quarantine.length>TRANSITION_VALUE_LIMITS.arrayItems||
    !value.quarantine.every(isRecoveryCarrierQuarantineEntry))return{kind:"unknown"};
  const valid=[],malformed=[];
  for(const record of value.records){
    const status=classifyRecoveryRecordEnvelope(record);
    if(status==="unknown")return{kind:"unknown"};
    if(status==="valid")valid.push(record);
    else malformed.push(record)}
  const targets=new Map();
  for(const record of valid){
    const target=record.diff.recoveryWeek.blockId;
    if(!targets.has(target))targets.set(target,[]);
    targets.get(target).push(record)}
  const conflicts=[...targets].filter(([,records])=>records.length>1)
    .map(([targetBlockId,records])=>({targetBlockId,records}));
  return{kind:"known",valid,malformed,conflicts,
    needsEvidence:malformed.length>0||conflicts.length>0};
}
function recoveryCarrierConflictGroups(records){
  const targets=new Map();
  for(const record of records){
    const target=record.diff.recoveryWeek.blockId;
    if(!targets.has(target))targets.set(target,[]);
    targets.get(target).push(record)}
  return[...targets].filter(([,group])=>group.length>1)
    .map(([targetBlockId,group])=>({targetBlockId,records:group}))
}

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


  function isCoherentV1TransitionIn(tin){
    return isPlainStateObject(tin)&&isBoundedTransitionValue(tin)&&
      tin.schemaVersion===1&&tin.status==="committed"&&
      typeof tin.transitionId==="string"&&tin.transitionId.trim()!==""&&
      typeof tin.proposalHash==="string"&&tin.proposalHash.trim()!==""&&
      typeof tin.archiveId==="string"&&tin.archiveId.trim()!==""&&
      typeof tin.confirmedAt==="string"&&tin.confirmedAt.trim()!==""&&
      isPlainStateObject(tin.successor)&&isPlainStateObject(tin.predecessor)&&
      typeof tin.successor.programId==="string"&&tin.successor.programId.trim()!==""&&
      typeof tin.predecessor.programId==="string"&&tin.predecessor.programId.trim()!==""}

  function isCoherentV1TransitionOut(tout){
    return isPlainStateObject(tout)&&isBoundedTransitionValue(tout)&&
      tout.schemaVersion===1&&
      typeof tout.transitionId==="string"&&tout.transitionId.trim()!==""&&
      typeof tout.proposalHash==="string"&&tout.proposalHash.trim()!==""&&
      typeof tout.successorProgramId==="string"&&tout.successorProgramId.trim()!==""}


export { cloneSnapshot, isPlainStateObject, readRevision, unversionedSnapshot, stripStorageMeta, exportableState, canonicalize, canonicalPayload, mirrorComparisonSnapshot, snapshotsEqual, storageSnapshotsEqual, snapshotBlockId, fingerprintRow, draftProgramFingerprint, changeValueEqual, changeObject, changeEntityKey, changeGroups, mergeChangedArray, mergeStateValue, rebaseStateChange, workoutProgramFingerprint, draftContextFingerprint, isValidBlockId, isBoundedProgressionValue, isBoundedTransitionValue, recoveryCodeUnitCompare, exactRecoveryKeys, isRecoveryCarrierQuarantineEntry, isRecoveryCarrierRecord, isValidRecoveryTransitions, classifyRecoveryRecordEnvelope, classifyRecoveryCarrier, recoveryCarrierConflictGroups, draftEffectOutcome, normalizeDraftEffectOutcome, pendingJournalEffect, draftEffectRequiresCoordination, isCoherentV1TransitionIn, isCoherentV1TransitionOut };

/** Bind immutable training/catalog domains once; never read app/session state.
 * Catalog is the integrity-verified raw catalog, not a browser loader.
 * model supplies the canonical training program comparison, not storage policy.
 */
export function createSnapshotPolicy({entry,metrics,workout,compiler,catalog,model,transition,
  now=null,digest=null}) {
  const MuscleDomain=entry,ProgramEntry=entry,ExerciseMetrics=metrics,WorkoutDraft=workout;
  const CUSTOM_ID_PREFIX='custom:';
  const rawCatalogObject=id=>Array.isArray(catalog)?catalog.find(row=>row?.id===id):
    (Object.hasOwn(catalog?.uuidIndex||{},id)?catalog.uuidIndex[id]:null);
  const rawExercise=id=>{const value=rawCatalogObject(id);return value?.type==='exercise'?value:null};
  function compilerCustomDefinitions(list){
    return (Array.isArray(list)?list:[]).filter(isPlainStateObject).map(entry=>{
      const checked=metrics?.validateDefinitions?.(entry.metricIds,entry.metricDefinitions,{allowEmpty:true});
      const out={id:String(entry.id||''),name:String(entry.name||'')};
      if(typeof entry.namePt==='string'&&entry.namePt.trim())out.namePt=entry.namePt;
      out.equipment=Array.isArray(entry.equipment)?entry.equipment.filter(value=>typeof value==='string'&&value.trim()):[];
      out.primary=typeof entry.primary==='string'?entry.primary:'';
      out.secondary=typeof entry.secondary==='string'?entry.secondary:'';
      out.notes=typeof entry.notes==='string'?entry.notes:'';
      out.metricIds=checked?.ok?cloneSnapshot(entry.metricIds):[];
      out.metricDefinitions=checked?.ok?cloneSnapshot(entry.metricDefinitions):[];
      return out;
    });
  }
  function canonicalProgramDefinition(value,customDefinitions=[]){
    if(!compiler?.validateProgramDefinition||!catalog)return null;
    const checked=compiler.validateProgramDefinition(value,catalog,compilerCustomDefinitions(customDefinitions));
    if(!checked?.ok)return null;
    return compiler.canonicalizeProgramDefinition?compiler.canonicalizeProgramDefinition(value):cloneSnapshot(value);
  }
function normalizeMuscleAttribution(value,field="muscle attribution"){
  const result=MuscleDomain?.normalizeMuscleAttribution?.(value);
  if(!result?.ok)throw new TypeError(`${result?.code||"invalid-muscle-domain"}: ${field}`);
  return result.value}
function isValidMuscleDomainTree(value,seen=new WeakSet()){
  if(value===null||typeof value!=="object")return true;
  if(seen.has(value))return false;
  seen.add(value);
  if(Array.isArray(value))return value.every(item=>isValidMuscleDomainTree(item,seen));
  if(!isPlainStateObject(value))return false;
  for(const [key,child] of Object.entries(value)){
    if((key==="primary"||key==="secondary")&&typeof child==="string"){
      if(!MuscleDomain?.isCanonicalMuscleAttribution?.(child))return false;
    }else if((key==="performedPrimary"||key==="performedSecondary")&&typeof child==="string"){
      if(child!==null&&!MuscleDomain?.isCanonicalMuscleAttribution?.(child))return false;
    }
    if(!isValidMuscleDomainTree(child,seen))return false}
  return true}
function isValidStoredMuscleField(value,nullable=false){
  return nullable&&value===null||typeof value==="string"&&MuscleDomain?.isCanonicalMuscleAttribution?.(value)}

const PLANNED_VOLUME_HISTORY_KEYS=["schemaVersion","throughWeek","plannedSessions","plannedWorkingSets","muscles"];
const PLANNED_VOLUME_HISTORY_MUSCLE_KEYS=["direct","secondary"];
function isValidPlannedVolumeHistory(value){
  if(!isPlainStateObject(value)||!isBoundedProgressionValue(value)||
    Object.keys(value).length!==PLANNED_VOLUME_HISTORY_KEYS.length||
    !PLANNED_VOLUME_HISTORY_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value,key))||
    value.schemaVersion!==1||!Number.isInteger(value.throughWeek)||value.throughWeek<0||value.throughWeek>52||
    !Number.isFinite(value.plannedSessions)||value.plannedSessions<0||
    !Number.isFinite(value.plannedWorkingSets)||value.plannedWorkingSets<0||
    !isPlainStateObject(value.muscles)||Object.keys(value.muscles).length!==PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.length||
    !PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value.muscles,key)))return false;
  return PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(kind=>{
    const map=value.muscles[kind];
    if(!isPlainStateObject(map)||Object.keys(map).length>MuscleDomain.MUSCLE_TOKENS.length)return false;
    return Object.entries(map).every(([name,amount])=>name&&name.length<=PROGRESSION_VALUE_LIMITS.stringLength&&
      MuscleDomain?.isMuscleToken?.(name)&&Number.isFinite(amount)&&amount>=0);
  });
}

function isSafeProgressionFields(value){
  if(!isPlainStateObject(value))return false;
  if(Object.prototype.hasOwnProperty.call(value,"hasRepTarget")&&typeof value.hasRepTarget!=="boolean")return false;
  if(!isValidMuscleDomainTree(value))return false;
  for(const key of ["primary","secondary"])
    if(Object.prototype.hasOwnProperty.call(value,key)&&!isValidStoredMuscleField(value[key]))return false;
  if(Object.prototype.hasOwnProperty.call(value,"progressionType")&&
    (typeof value.progressionType!=="string"||Array.from(value.progressionType.trim()).length>80))return false;
  for(const key of ["progression","progressionIncompatibility"])
    if(Object.prototype.hasOwnProperty.call(value,key)&&!isBoundedProgressionValue(value[key]))return false;
  return true}
function isSafeProgressionMeta(value,customDefinitions=[]){
  if(value==null)return true;
  if(!isPlainStateObject(value))return false;
  if(!isValidMuscleDomainTree(value))return false;
  if(Object.prototype.hasOwnProperty.call(value,"blockId")&&
    !isValidBlockId(value.blockId,value.id))return false;
  if(Object.prototype.hasOwnProperty.call(value,"transitionIn")&&value.transitionIn!=null&&
    !isCoherentV1TransitionIn(value.transitionIn))return false;
  for(const key of ["progressionRelations","progressionModifiers","progressionIncompatibilities"])
    if(Object.prototype.hasOwnProperty.call(value,key)&&
      (!Array.isArray(value[key])||!isBoundedProgressionValue(value[key])))return false;
  if(Object.prototype.hasOwnProperty.call(value,"programStructure")&&value.programStructure!=null&&
    !isBoundedProgressionValue(value.programStructure))return false;
  if(Object.prototype.hasOwnProperty.call(value,"programDefinition")&&value.programDefinition!=null&&
    !canonicalProgramDefinition(value.programDefinition,customDefinitions))return false;
  if(Object.prototype.hasOwnProperty.call(value,"plannedVolumeHistory")&&value.plannedVolumeHistory!=null&&
    !isValidPlannedVolumeHistory(value.plannedVolumeHistory))return false;
  return true}
/* An archived block's custom slots resolve against the install's custom
   definitions (archived, never deleted, while anything points at them) as well
   as any the archive itself carries. */
function isSafeProgramHistoryEntry(entry,customExercises=[]){
  if(!isPlainStateObject(entry))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"transitionOut")&&entry.transitionOut!=null&&
    !isCoherentV1TransitionOut(entry.transitionOut))return false;
  const customs=[...(Array.isArray(entry.customExercises)?entry.customExercises:[]),
    ...(Array.isArray(customExercises)?customExercises:[])];
  if(Object.prototype.hasOwnProperty.call(entry,"meta")&&!isSafeProgressionMeta(entry.meta,customs))return false;
  if(!Object.prototype.hasOwnProperty.call(entry,"program"))return true;
  return Array.isArray(entry.program)&&entry.program.every(isSafeProgressionFields)}
function isSafeLogRow(entry){
  if(!isPlainStateObject(entry))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"setIndex")&&
    (!Number.isInteger(entry.setIndex)||entry.setIndex<0))return false;
  if(!isValidMuscleDomainTree(entry))return false;
  for(const key of ["primary","secondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&!isValidStoredMuscleField(entry[key],true))return false;
  for(const key of ["performedPrimary","performedSecondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&!isValidStoredMuscleField(entry[key],true))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"blockId")&&!isValidBlockId(entry.blockId))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"rirMeasured")&&typeof entry.rirMeasured!=="boolean")return false;
  for(const key of ["performedName","performedLibraryId","performedMovementId","performedPrimary","performedSecondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&entry[key]!=null&&typeof entry[key]!=="string")
      return false;
  if(Object.prototype.hasOwnProperty.call(entry,"sourceLibraryId")&&entry.sourceLibraryId!==null&&typeof entry.sourceLibraryId!=="string")return false;
  if(Object.prototype.hasOwnProperty.call(entry,"metricOrigin")&&!["source_catalog","user_defined"].includes(entry.metricOrigin))return false;
  const metricFields=["metricType","metricIds","metricDefinitions","metricValues","equipmentId","loadingConvention","loadingContext","restSeconds"];
  const hasMetricFields=metricFields.some(key=>Object.prototype.hasOwnProperty.call(entry,key));
  if(hasMetricFields){
    if(!Number.isInteger(entry.setIndex)||entry.setIndex<0||entry.metricType!=="source_metrics@1"||!Array.isArray(entry.metricIds)||!Array.isArray(entry.metricDefinitions)||
      !Array.isArray(entry.metricValues)||entry.metricIds.length===0||
      !["source_catalog","user_defined"].includes(entry.metricOrigin)||typeof entry.sourceLibraryId!=="string"||!entry.sourceLibraryId||
      !["external","assistance","per_side","bodyweight"].includes(entry.loadingConvention)||
      !(entry.equipmentId===null||typeof entry.equipmentId==="string")||
      (entry.restSeconds!==null&&(!Number.isSafeInteger(entry.restSeconds)||entry.restSeconds<0)))return false;
    const definitions=ExerciseMetrics?.validateDefinitions?.(entry.metricIds,entry.metricDefinitions);
    const values=ExerciseMetrics?.validateMetricValues?.(entry.metricIds,entry.metricValues);
    if(!definitions?.ok||!values?.ok||entry.metricValues.some(value=>typeof value?.value!=="number"||!Number.isFinite(value.value)))return false;
    const sourceExercise=rawExercise(entry.sourceLibraryId);
    const sourceBinding=ExerciseMetrics?.validateExerciseSourceBinding?.({metricOrigin:entry.metricOrigin,
      metricIds:entry.metricIds,metricDefinitions:entry.metricDefinitions,sourceId:entry.sourceLibraryId,
      sourceExercise,bodyweightCoefficient:entry.loadingModel?.bodyweightCoefficient??null});
    if(!sourceBinding?.ok)return false;
    const loading=WorkoutDraft?.validateLoadingContext?.(entry.loadingContext);
    if(!loading?.ok||!Object.prototype.hasOwnProperty.call(entry.loadingContext,"bodyweightKg")||
      !Object.prototype.hasOwnProperty.call(entry.loadingContext,"bodyweightContributionEnabled")||
      !Object.prototype.hasOwnProperty.call(entry.loadingContext,"externalLoadMultiplier"))return false;
    if(entry.loadingModel!=null&&(!isPlainStateObject(entry.loadingModel)||
      Object.keys(entry.loadingModel).some(key=>!["bodyweightCoefficient","assistanceDirection"].includes(key))||
      (entry.loadingModel.bodyweightCoefficient!=null&&(!Number.isFinite(entry.loadingModel.bodyweightCoefficient)||entry.loadingModel.bodyweightCoefficient<0||entry.loadingModel.bodyweightCoefficient>1))||
      (entry.loadingModel.assistanceDirection!=null&&entry.loadingModel.assistanceDirection!=="subtract")))return false;
    const modelCoefficient=entry.loadingModel?.bodyweightCoefficient??null;
    const contextCoefficient=entry.loadingContext?.bodyweightCoefficient??null;
    if(modelCoefficient!==contextCoefficient)return false;
    const semantics=new Set(entry.metricDefinitions.map(definition=>definition.semantic));
    const expectedConvention=semantics.has("assistanceKg")?"assistance":
      semantics.has("loadPerSideKg")||semantics.has("persistentLoadPerSideKg")?"per_side":
        entry.metricIds.length===1&&(semantics.has("reps")||semantics.has("repsPerSide"))?"bodyweight":"external";
    if(entry.loadingConvention!==expectedConvention)return false;
    if(entry.loadingContext.loadingConvention!==entry.loadingConvention)return false;
    if(entry.loadingConvention==="bodyweight"&&entry.loadingContext.externalLoadMultiplier!==0)return false;
    if(entry.loadingContext.externalLoadMultiplier!=null&&entry.loadingConvention!=="per_side"&&
      entry.loadingConvention!=="bodyweight"&&entry.loadingContext.externalLoadMultiplier!==1)return false;
    if(entry.loadingModel?.bodyweightCoefficient!=null&&entry.loadingContext.bodyweightCoefficient!==entry.loadingModel.bodyweightCoefficient)return false;
    if(entry.loadingContext.bodyweightKg!==(entry.bodyweight??null))return false;
    if(entry.rir!==null&&(!Number.isFinite(entry.rir)||entry.rir<0))return false;
    const load=entry.metricDefinitions.find(definition=>definition.semantic==="loadKg");
    const reps=entry.metricDefinitions.find(definition=>definition.semantic==="reps");
    const loadValue=load?entry.metricValues.find(value=>value.metricId===load.id)?.value:null;
    const repsValue=reps?entry.metricValues.find(value=>value.metricId===reps.id)?.value:null;
    if(entry.load!==loadValue||entry.reps!==repsValue)return false;
    if(entry.equipmentId!=null&&rawCatalogObject(entry.equipmentId)?.type!=="equipment")return false;
  }
  return true}
function isSafeCustomExercise(entry){
  if(!isPlainStateObject(entry))return false;
  if(!isValidMuscleDomainTree(entry))return false;
  for(const key of ["primary","secondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&!isValidStoredMuscleField(entry[key]))return false;
  return typeof entry.id==="string"&&entry.id.startsWith(CUSTOM_ID_PREFIX)&&typeof entry.name==="string"}
function isValidSetupActivationMarker(marker){
  const maxRaw=Number.isSafeInteger(ProgramEntry?.MAX_DRAFT_ENVELOPE_BYTES)
    ?ProgramEntry.MAX_DRAFT_ENVELOPE_BYTES:70000;
  return isPlainStateObject(marker)&&marker.version===1&&
    typeof marker.programId==="string"&&marker.programId.length>0&&marker.programId.length<=128&&
    typeof marker.raw==="string"&&marker.raw.length>0&&marker.raw.length<=maxRaw&&
    (!Object.prototype.hasOwnProperty.call(marker,"revision")||
      (Number.isInteger(marker.revision)&&marker.revision>=1))}
function setupActivationMarker(raw,programId){
  if(typeof raw!=="string"||!raw||typeof programId!=="string"||!programId)return null;
  const marker={version:1,programId,raw};
  return isValidSetupActivationMarker(marker)?marker:null}
function setupActivationMatches(marker,raw,programId){
  return isValidSetupActivationMarker(marker)&&marker.programId===programId&&marker.raw===raw}
function isValidStateShape(s){
  try{
    // Pre-contract snapshots may contain arbitrary legacy attribution. Keep
    // them lossless in the raw replicas and reject them here; boot recovery
    // can surface the original bytes for deliberate repair instead of
    // relabeling or dropping unknown historical muscle identity.
    if(!isPlainStateObject(s)||!Array.isArray(s.program)||!s.program.every(isSafeProgressionFields)||
      !Array.isArray(s.log)||!s.log.every(isSafeLogRow))return false;
    if(Object.prototype.hasOwnProperty.call(s,"programMeta")&&!isSafeProgressionMeta(s.programMeta,s.customExercises||[]))return false;
    if(Object.prototype.hasOwnProperty.call(s,"recoveryTransitions")&&!isValidRecoveryTransitions(s.recoveryTransitions))return false;
    if(Object.prototype.hasOwnProperty.call(s,STORAGE_DRAFT_TXN)&&!pendingDraftTransaction(s))return false;
    if(Object.prototype.hasOwnProperty.call(s,STORAGE_SETUP_TXN)&&!isValidSetupActivationMarker(s[STORAGE_SETUP_TXN]))return false;
    // Optional: backups written before custom exercises existed stay importable.
    if(Object.prototype.hasOwnProperty.call(s,"customExercises")&&
      !(Array.isArray(s.customExercises)&&s.customExercises.every(isSafeCustomExercise)))return false;
    if(!Object.prototype.hasOwnProperty.call(s,"programHistory"))return true;
    return Array.isArray(s.programHistory)&&s.programHistory.every(entry=>isSafeProgramHistoryEntry(entry,s.customExercises||[]))}
  catch{return false}}

    function pendingDraftTransaction(snapshot){
    const value=snapshot?.[STORAGE_DRAFT_TXN];
    if(!isPlainStateObject(value)||value.version!==1||typeof value.id!=="string"||!value.id)return null;
    const effectOutcome=draftEffectOutcome(value.effect),previous=value.previous;
    if(effectOutcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(effectOutcome)||!isPlainStateObject(previous)||
      Object.prototype.hasOwnProperty.call(previous,STORAGE_DRAFT_TXN)||!isValidStateShape(previous)||
      readRevision(snapshot)<=readRevision(previous))return null;
    return{id:value.id,effect:effectOutcome.effect,previous:cloneSnapshot(previous)}}


function isValidStateWithoutRecoveryCarrier(value){
  if(!isPlainStateObject(value)||!Object.prototype.hasOwnProperty.call(value,"recoveryTransitions"))return false;
  const copy=cloneSnapshot(value);delete copy.recoveryTransitions;
  return isValidStateShape(copy)}
function carrierReadStatus(parsed,raw){
  const classification=classifyRecoveryCarrier(parsed?.recoveryTransitions);
  if(classification.kind==="known"&&
    (isValidStateShape(parsed)||isValidStateWithoutRecoveryCarrier(parsed)))
    return{status:"valid",raw,parsed,recoveryCarrierClassification:classification};
  return null;
}

function mergeRecoverySource(existing,incoming){
  if(existing===incoming)return existing;
  if(existing==="both"||incoming==="both")return"both";
  return"both";
}
function quarantineEntryKey(entry){return`${entry.digest}\u0000${entry.reason}`}

function mergeRecoveryQuarantine(list,entry){
  const key=quarantineEntryKey(entry),index=list.findIndex(candidate=>quarantineEntryKey(candidate)===key);
  if(index<0){list.push(entry);return true}
  const previous=list[index],source=mergeRecoverySource(previous.sourceReplica,entry.sourceReplica);
  if(source===previous.sourceReplica)return false;
  list[index]={...previous,sourceReplica:source};
  return true;
}

async function normalizeRecoveryCarrierSnapshot(snapshot,sourceReplica,{priorQuarantine=[]}={}){
  let classification=classifyRecoveryCarrier(snapshot?.recoveryTransitions);
  if(classification.kind!=="known")return{kind:classification.kind,snapshot};
  let semantic;
  try{semantic=await classifyRecoveryCarrierSemantics(snapshot,classification)}
  catch{return{kind:"full-recovery",snapshot}}
  if(semantic.kind!=="known")return{kind:"full-recovery",snapshot};
  classification=semantic;
  const carrier=snapshot.recoveryTransitions;
  const normalized={schemaVersion:1,records:classification.valid.map(cloneSnapshot),quarantine:[]};
  for(const entry of carrier.quarantine)
    mergeRecoveryQuarantine(normalized.quarantine,cloneSnapshot(entry));
  for(const entry of priorQuarantine)
    mergeRecoveryQuarantine(normalized.quarantine,cloneSnapshot(entry));
  const detectedAt=()=>now();
  const addEvidence=async(raw,reason)=>{
    if(typeof raw!=="string"||raw.length>TRANSITION_VALUE_LIMITS.stringLength)
      return{kind:"full-recovery"};
    let digest;
    try{digest=await digest(raw)}catch{return{kind:"full-recovery"}}
    const entry={schemaVersion:1,digest,raw,sourceReplica,detectedAt:detectedAt(),reason};
    mergeRecoveryQuarantine(normalized.quarantine,entry);
    if(!isBoundedTransitionValue(normalized))return{kind:"full-recovery"};
    return{kind:"ok"};
  };
  for(const malformed of classification.malformed){
    const result=await addEvidence(JSON.stringify(malformed),"known-schema-malformed-recovery");
    if(result.kind!=="ok")return{kind:result.kind,snapshot};
  }
  for(const conflict of classification.conflicts){
    const records=[...conflict.records].sort((left,right)=>
      recoveryCodeUnitCompare(String(left.proposalHash||""),String(right.proposalHash||""))||
      recoveryCodeUnitCompare(String(left.transitionId||""),String(right.transitionId||"")));
    const result=await addEvidence(JSON.stringify({targetBlockId:conflict.targetBlockId,records}),"duplicate-target-conflict");
    if(result.kind!=="ok")return{kind:result.kind,snapshot};
  }
  if(!isBoundedTransitionValue(normalized))return{kind:"full-recovery",snapshot};
  const next=cloneSnapshot(snapshot);next.recoveryTransitions=normalized;
  return{kind:"known",snapshot:next,changed:!storageSnapshotsEqual(next,snapshot)};
}

async function validateRecoveryCarrierRecord(snapshot,record){
  const Transition=transition;
  const Compiler=compiler;
  const catalogue=catalog;
  if(!Transition||typeof Transition.validateRecoveryRecord!=="function"||
    typeof Transition.approvedRecoveryPolicy!=="function"||!Compiler||
    !Compiler.VERSIONS||typeof Compiler.VERSIONS!=="object")return{kind:"unavailable"};
  const instance=recoveryCompilerInstance(snapshot,Compiler,catalogue);
  if(!instance)return{kind:"unavailable"};
  let validation;
  try{
    validation=await Transition.validateRecoveryRecord(record,{
      predecessor:cloneSnapshot(record.predecessor),
      predecessorInstance:instance,
      approvedPolicy:Transition.approvedRecoveryPolicy(),
      supportedVersions:Compiler.VERSIONS,
      // Validate each candidate independently. The candidate itself is the
      // only repeat context, so two independently valid records can become a
      // deterministic target conflict after validation.
      existingRecoveryRecords:[record],
    });
  }catch{return{kind:"unavailable"}}
  if(validation?.ok===true&&validation.record)return{kind:"valid"};
  if(!validation||typeof validation!=="object")return{kind:"unavailable"};
  return{kind:"malformed"};
}
async function classifyRecoveryCarrierSemantics(snapshot,classification){
  const valid=[],malformed=[...classification.malformed];
  for(const record of classification.valid){
    const result=await validateRecoveryCarrierRecord(snapshot,record);
    if(result.kind==="unavailable")return{kind:"unavailable"};
    if(result.kind==="valid")valid.push(record);
    else malformed.push(record)}
  const conflicts=recoveryCarrierConflictGroups(valid);
  return{kind:"known",valid,malformed,conflicts,
    needsEvidence:malformed.length>0||conflicts.length>0};
}

const COMPILER_PROVENANCE_FIELDS = [
  "familyId", "blueprintId", "blueprintVersion", "compilerVersion", "catalogueVersion",
  "rulesVersion", "contextVersion", "profileId", "recentConsistencyVersion",
];
/* Compiler context is not provenance. A context can be absent from a shared
   import even while its released programStructure still carries the complete
   compiler receipt; conversely, a stale context must not turn a historical
   program into a compiler-backed transition. The structure receipt is the
   independent discriminator for the two paths. */
function classifyCompilerTransitionProvenance(meta) {
  const provenance = meta?.programStructure?.provenance;
  if (provenance == null) return "absent";
  if (!isPlainStateObject(provenance)) return "invalid";
  if (provenance.source === "legacy_migration" || provenance.source === "manual_build") return "absent";
  const strings = ["familyId", "blueprintId", "profileId"];
  if (!strings.every(key => typeof provenance[key] === "string" && provenance[key].trim())) return "invalid";
  if (!COMPILER_PROVENANCE_FIELDS.every(key => Object.prototype.hasOwnProperty.call(provenance, key))) return "invalid";
  if (!["blueprintVersion", "compilerVersion", "catalogueVersion", "rulesVersion", "contextVersion", "recentConsistencyVersion"]
    .every(key => Number.isSafeInteger(provenance[key]) && provenance[key] >= 1)) return "invalid";
  return "present";
}

function recoveryCompilerInstance(snapshot,Compiler,catalogue){
  const meta=snapshot?.programMeta;
  if(classifyCompilerTransitionProvenance(meta)!=="present"||!meta?.compilerContext||
    typeof Compiler?.compile!=="function")return null;
  try{
    const instance=Compiler.compile(meta.compilerContext,catalogue);
    if(!instance||instance.kind!=="compiled"||!model.compilerProgramMatchesLive(snapshot.program,instance.program,snapshot.customExercises))return null;
    return instance;
  }catch{return null}}

  return Object.freeze({isValidStateShape,isValidStateWithoutRecoveryCarrier,carrierReadStatus,
    classifyRecoveryCarrier,isValidRecoveryTransitions,isValidBlockId,isBoundedTransitionValue,
    normalizeRecoveryCarrierSnapshot,pendingDraftTransaction,canonicalProgramDefinition,
    isValidMuscleDomainTree,isSafeProgressionFields,isSafeProgressionMeta,isSafeLogRow,
    isSafeProgramHistoryEntry,isValidPlannedVolumeHistory,isValidSetupActivationMarker,
    setupActivationMarker,setupActivationMatches,normalizeMuscleAttribution});
}
