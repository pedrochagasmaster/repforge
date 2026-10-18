import {cloneSnapshot,isPlainStateObject,canonicalize,isBoundedProgressionValue,PROGRESSION_VALUE_LIMITS} from '../training/model.js';

/** Canonical durable values and identity policy. No browser or live state access.
 * Storage receipts are deliberately included in mirror arbitration and omitted
 * only from interchange exports. Changing that distinction loses activations.
 */

/** @typedef {'match-only'|'abort-changed'|'abort-same-day'} DraftPrecondition
 * @typedef {{kind:'clear-draft',expectedRaw:string|null,precondition:DraftPrecondition,required?:true,conflictDay?:string}|{kind:'replace-draft',expectedRaw:string,replacementRaw:string,precondition:DraftPrecondition,required?:true,conflictDay?:string}} DraftEffect
 * @typedef {{status:'valid',effect:DraftEffect}|{status:'none',effect:null}|{status:'invalid',effect:null,reason:unknown}} DraftEffectOutcome
 * @typedef {{programMeta?:{id?:unknown,blockId?:unknown}|null,program?:unknown[],settings?:unknown}} SnapshotIdentity
 * @typedef {Record<string,unknown>} RawRecord
 */

// Native numeric predicates narrow unknown persisted fields without coercion.
/** @param {unknown} value @returns {value is number} */
function finiteNumber(value){return Number.isFinite(value)}
/** @param {unknown} value @returns {value is number} */
function integerNumber(value){return Number.isInteger(value)}
/** @param {unknown} value @returns {value is number} */
function safeIntegerNumber(value){return Number.isSafeInteger(value)}
/** @template {string} T @param {readonly T[]} values @param {unknown} value @returns {value is T} */
function containsString(values,value){return values.includes(/** @type {T} */(value))}

const STORAGE_REV='_storageRevision', STORAGE_FOLLOWUP='_storageFollowUp';
const STORAGE_DRAFT_TXN='_storageDraftTransaction', STORAGE_SETUP_TXN='_storageSetupActivation';
const SHARED_IMPORT='_sharedSetupImport';
const PENDING_EFFECT_MAX_RAW=1000000;
const DRAFT_EFFECT_VALID='valid', DRAFT_EFFECT_INVALID='invalid', DRAFT_EFFECT_NONE='none';
const DRAFT_PRECONDITION_MATCH_ONLY='match-only', DRAFT_PRECONDITION_ABORT_CHANGED='abort-changed', DRAFT_PRECONDITION_ABORT_SAME_DAY='abort-same-day';

  /** @param {RawRecord|null|undefined} snapshot @returns {number} */
function readRevision(snapshot) {
    return integerNumber(snapshot?.[STORAGE_REV]) && /** @type {number} */(snapshot?.[STORAGE_REV]) > 0
      ? /** @type {number} */(snapshot?.[STORAGE_REV])
      : 0;
  }

  /** @template {RawRecord|null|undefined} T @param {T} snapshot @returns {T} */
function unversionedSnapshot(snapshot) {
    const out = cloneSnapshot(snapshot);
    if (out && typeof out === "object") delete out[STORAGE_REV];
    return out;
  }

  /** @template {RawRecord|null|undefined} T @param {T} snapshot @returns {T} */
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

  /** @template {RawRecord|null|undefined} T @param {T} snapshot @returns {T} */
function exportableState(snapshot) {
    return stripStorageMeta(snapshot);
  }

  /** @param {RawRecord|null|undefined} snapshot */
function canonicalPayload(snapshot) {
    return JSON.stringify(canonicalize(stripStorageMeta(snapshot)));
  }

  /** @template {RawRecord|null|undefined} T @param {T} snapshot @returns {T} */
function mirrorComparisonSnapshot(snapshot) {
    const clean = cloneSnapshot(snapshot);
    if (clean && typeof clean === "object") {
      delete clean._storageRevision;
      delete clean._storageFollowUp;
      delete clean._storageDraftTransaction;
    }
    return clean;
  }

  /** @param {RawRecord|null|undefined} a @param {RawRecord|null|undefined} b */
function snapshotsEqual(a, b) {
    return JSON.stringify(canonicalize(mirrorComparisonSnapshot(a))) ===
      JSON.stringify(canonicalize(mirrorComparisonSnapshot(b)));
  }

  /** @param {unknown} a @param {unknown} b */
function storageSnapshotsEqual(a, b) {
    return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
  }


    /** @param {SnapshotIdentity|null|undefined} snapshot */
function snapshotBlockId(snapshot){
    const meta=snapshot?.programMeta;
    return Object.prototype.hasOwnProperty.call(meta||{},"blockId")?meta?.blockId:null}

    // A program row never owns prescriptions; the ProgramDefinition does, and
    // loading drops a row's copy. Older installed-editor builds persisted that
    // copy (#344), so it cannot count toward the durable program's identity.
    /** @param {unknown} row */
function fingerprintRow(row){
    if(!row||typeof row!=="object"||!Object.prototype.hasOwnProperty.call(row,"prescriptionsByCycle"))return row;
    const{prescriptionsByCycle,...rest}=/** @type {RawRecord} */(row);return rest}

    /** @param {SnapshotIdentity|null|undefined} snapshot */
function draftProgramFingerprint(snapshot){
    /** @type {Record<string,unknown>} */
    const value={programMetaId:snapshot?.programMeta?.id||null,
      program:Array.isArray(snapshot?.program)?snapshot.program.map(fingerprintRow):[]};
    if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
      value.programMetaBlockId=snapshot?.programMeta?.blockId;
    return JSON.stringify(canonicalize(value))}


const CHANGE_MISSING=Symbol("change-missing");
/** @param {unknown} a @param {unknown} b */
function changeValueEqual(a,b){
  if(a===CHANGE_MISSING||b===CHANGE_MISSING)return a===b;
  return JSON.stringify(canonicalize(a))===JSON.stringify(canonicalize(b))}
/** @param {unknown} v @returns {v is RawRecord} */
function changeObject(v){return!!(v&&typeof v==="object"&&!Array.isArray(v))}
/** @param {string} root @param {unknown} raw @param {number} index */
function changeEntityKey(root,raw,index){
  const value=/** @type {RawRecord|null|undefined} */(raw);
  if(!value||typeof value!=="object")return`${root}:value:${index}:${JSON.stringify(canonicalize(value))}`;
  if(root==="log")return value.session?`session:${value.session}`:`row:${index}:${JSON.stringify(canonicalize(value))}`;
  if(root==="program"||root==="programHistory"||root==="customExercises")
    return value.id?`id:${value.id}`:`row:${index}:${JSON.stringify(canonicalize(value))}`;
  return null}
/** @param {unknown[]} list @param {string} root */
function changeGroups(list,root){
  /** @type {string[]} */const order=[];
  /** @type {Map<string,unknown[]>} */const map=new Map();
  (Array.isArray(list)?list:[]).forEach((value,index)=>{
    const key=changeEntityKey(root,value,index);
    if(key==null)return;
    if(!map.has(key)){order.push(key);map.set(key,[])}
    /** @type {unknown[]} */(map.get(key)).push(value)});
  return{order,map}}
/** @param {unknown[]} base @param {unknown[]} proposal @param {unknown[]} target @param {string} root @param {boolean} preferProposal @returns {unknown[]} */
function mergeChangedArray(base,proposal,target,root,preferProposal){
  const b=changeGroups(base,root),p=changeGroups(proposal,root),tgt=changeGroups(target,root);
  const order=[...tgt.order],out=new Map([...tgt.map].map(([key,value])=>[key,cloneSnapshot(value)]));
  /** @param {string} key */
  const remove=key=>{out.delete(key);const i=order.indexOf(key);if(i>=0)order.splice(i,1)};
  for(const key of new Set([...b.order,...p.order])){
    const bv=b.map.has(key)?/** @type {unknown[]} */(b.map.get(key)):CHANGE_MISSING;
    const pv=p.map.has(key)?/** @type {unknown[]} */(p.map.get(key)):CHANGE_MISSING;
    const tv=tgt.map.has(key)?/** @type {unknown[]} */(tgt.map.get(key)):CHANGE_MISSING;
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
/** @param {unknown} base @param {unknown} proposal @param {unknown} target @param {string[]} path @param {boolean} preferProposal @returns {unknown} */
function mergeStateValue(base,proposal,target,path,preferProposal){
  if(changeValueEqual(proposal,base))return target===CHANGE_MISSING?CHANGE_MISSING:cloneSnapshot(target);
  if(changeValueEqual(target,base))return proposal===CHANGE_MISSING?CHANGE_MISSING:cloneSnapshot(proposal);
  const root=path[0];
  if(path.length===1&&Array.isArray(base)&&Array.isArray(proposal)&&Array.isArray(target)&&
    (root==="log"||root==="program"||root==="programHistory"||root==="customExercises"))
    return mergeChangedArray(base,proposal,target,root,preferProposal);
  if(changeObject(base)&&changeObject(proposal)&&changeObject(target)){
    /** @type {RawRecord} */const out={};
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
/** @param {unknown} base @param {unknown} proposal @param {unknown} target @param {{preferProposal?:boolean}} [options] @returns {unknown} */
function rebaseStateChange(base,proposal,target,{preferProposal=true}={}){
  const merged=mergeStateValue(base,proposal,target,[],preferProposal);
  return merged===CHANGE_MISSING?{}:merged}

/** @param {SnapshotIdentity|null|undefined} snapshot */
function workoutProgramFingerprint(snapshot){
  const source=draftProgramFingerprint(snapshot),seeds=[0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
  const hashes=seeds.map(seed=>{let hash=seed;
    for(let i=0;i<source.length;i++){hash^=source.charCodeAt(i);hash=Math.imul(hash,0x01000193)}
    return(hash>>>0).toString(16).padStart(8,"0")});
  return`program-v1:${source.length}:${hashes.join("")}`}

/** @param {SnapshotIdentity|null|undefined} snapshot */
function draftContextFingerprint(snapshot){
  const settings=/** @type {RawRecord|null|undefined} */(snapshot?.settings);
  /** @type {Record<string,unknown>} */
    const value={programMetaId:snapshot?.programMeta?.id||null,
    program:Array.isArray(snapshot?.program)?snapshot.program:[],
    unit:settings?.unit||"kg",rirMode:settings?.rirMode||"numeric"};
  if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
    value.programMetaBlockId=snapshot?.programMeta?.blockId;
  return JSON.stringify(canonicalize(value))}

/** @param {unknown} value @param {unknown} [programId] @returns {value is string} */
function isValidBlockId(value,programId=null){
  return typeof value==="string"&&value.trim().length>0&&value.length<=240&&
    (programId==null||value!==programId)}
const TRANSITION_VALUE_LIMITS=Object.freeze({depth:32,nodes:10000,keys:128,arrayItems:256,stringLength:10000});
/** @param {unknown} value @param {number} [depth] @param {{nodes:number}} [state] @returns {boolean} */
function isBoundedTransitionValue(value,depth=0,state={nodes:0}){
  if(++state.nodes>TRANSITION_VALUE_LIMITS.nodes||depth>TRANSITION_VALUE_LIMITS.depth)return false;
  if(typeof value==="string")return value.length<=TRANSITION_VALUE_LIMITS.stringLength;
  if(value===null||typeof value==="boolean")return true;
  if(typeof value==="number")return finiteNumber(value);
  if(Array.isArray(value))return value.length<=TRANSITION_VALUE_LIMITS.arrayItems&&value.every(item=>isBoundedTransitionValue(item,depth+1,state));
  if(!isPlainStateObject(value)||Object.keys(value).length>TRANSITION_VALUE_LIMITS.keys)return false;
  return Object.keys(value).every(key=>isBoundedTransitionValue(value[key],depth+1,state));
}

/** @typedef {RawRecord & {blockId:string,transitionId:string,eligibilityEvidence:RawRecord & {sourceBlockId:string},entries:unknown[],createdAt:string,confirmedAt:string,reassessmentDueAt:string}} RecoveryOverlay
 * @typedef {RawRecord & {diff:RawRecord & {recoveryWeek:RawRecord}}} RecoveryEnvelope
 * @typedef {RawRecord & {schemaVersion:1,kind:'recovery_week',status:'committed',transitionId:string,createdAt:string,confirmedAt:string,proposalHash:string,archiveId:null,predecessor:RawRecord & {programId:string,blockId:string},diff:RawRecord & {recoveryWeek:RecoveryOverlay}}} RecoveryRecord
 * @typedef {RawRecord & {schemaVersion:1,digest:string,raw:string,sourceReplica:string,detectedAt:string,reason:string}} RecoveryQuarantine
 * @typedef {{targetBlockId:string,records:RecoveryRecord[]}} RecoveryConflict
 * @typedef {{kind:'unknown'}|{kind:'absent',malformed:[],valid:[],needsEvidence:false}|{kind:'known',valid:RecoveryRecord[],malformed:RecoveryEnvelope[],conflicts:RecoveryConflict[],needsEvidence:boolean}} RecoveryClassification
 */

const RECOVERY_HASH_RE=/^[0-9a-f]{64}$/;
const RECOVERY_CARRIER_INSTANT_RE=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const RECOVERY_CARRIER_KEYS=["schemaVersion","records","quarantine"];
const RECOVERY_RECORD_KEYS=["schemaVersion","transitionId","kind","createdAt","status","predecessor","diagnosis","derivation","diff","progressionContract","archiveId","confirmedAt","proposalHash"];
const RECOVERY_OVERLAY_KEYS=["schemaVersion","policyVersion","transitionId","blockId","activePeriod","eligibilityEvidence","baseProgramFingerprint","entries","createdAt","confirmedAt","reassessmentDueAt","reassessmentOutcome"];
const RECOVERY_DIFF_KEYS=["days","exercises","prescriptions","recoveryWeek"];
const RECOVERY_QUARANTINE_REASONS=["known-schema-malformed-recovery","duplicate-target-conflict"];
const RECOVERY_REPLICA_SOURCES=["localStorage","indexedDB","both"];
/** @param {string} left @param {string} right */
function recoveryCodeUnitCompare(left,right){return left<right?-1:left>right?1:0}
/** @param {unknown} value @param {string[]} keys */
function exactRecoveryKeys(value,keys){
  return isPlainStateObject(value)&&Object.keys(value).length===keys.length&&
    keys.every(key=>Object.prototype.hasOwnProperty.call(value,key))}
/** @param {unknown} value @returns {value is RecoveryQuarantine} */
function isRecoveryCarrierQuarantineEntry(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value))return false;
  const keys=["schemaVersion","digest","raw","sourceReplica","detectedAt","reason"];
  if(Object.keys(value).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(value,key)))return false;
  return value.schemaVersion===1&&RECOVERY_HASH_RE.test(/** @type {string} */(value.digest))&&
    typeof value.raw==="string"&&value.raw.length<=TRANSITION_VALUE_LIMITS.stringLength&&
    RECOVERY_REPLICA_SOURCES.includes(/** @type {string} */(value.sourceReplica))&&
    RECOVERY_CARRIER_INSTANT_RE.test(/** @type {string} */(value.detectedAt))&&
    RECOVERY_QUARANTINE_REASONS.includes(/** @type {string} */(value.reason));
}
/** @param {unknown} value @returns {value is RecoveryRecord} */
function isRecoveryCarrierRecord(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value))return false;
  if(!exactRecoveryKeys(value,RECOVERY_RECORD_KEYS))return false;
  const predecessor=value.predecessor,overlay=/** @type {RawRecord|undefined} */(/** @type {RawRecord|undefined} */(value.diff)?.recoveryWeek),evidence=overlay?.eligibilityEvidence;
  const overlayKeys=RECOVERY_OVERLAY_KEYS;
  const diffKeys=RECOVERY_DIFF_KEYS;
  if(value.schemaVersion!==1||value.kind!=="recovery_week"||value.status!=="committed"||
    typeof value.transitionId!=="string"||!value.transitionId.trim()||
    !RECOVERY_CARRIER_INSTANT_RE.test(/** @type {string} */(value.createdAt))||!RECOVERY_CARRIER_INSTANT_RE.test(/** @type {string} */(value.confirmedAt))||
    !RECOVERY_HASH_RE.test(/** @type {string} */(value.proposalHash))||value.archiveId!==null||
    !isPlainStateObject(predecessor)||typeof predecessor.programId!=="string"||!predecessor.programId.trim()||
    !isValidBlockId(predecessor.blockId,predecessor.programId)||
    !isPlainStateObject(value.diff)||Object.keys(value.diff).length!==diffKeys.length||!diffKeys.every(key=>Object.prototype.hasOwnProperty.call(value.diff,key))||
    !isPlainStateObject(overlay)||Object.keys(overlay).length!==overlayKeys.length||!overlayKeys.every(key=>Object.prototype.hasOwnProperty.call(overlay,key))||
    overlay.schemaVersion!==1||overlay.policyVersion!==2||overlay.transitionId!==value.transitionId||
    typeof overlay.blockId!=="string"||!overlay.blockId.trim()||overlay.blockId===predecessor.blockId||
    overlay.activePeriod!=="nextBlockWeek1"||!RECOVERY_CARRIER_INSTANT_RE.test(/** @type {string} */(overlay.createdAt))||
    !RECOVERY_CARRIER_INSTANT_RE.test(/** @type {string} */(overlay.reassessmentDueAt))||overlay.confirmedAt!==value.confirmedAt||
    ![null,"Better","About the same","Worse"].includes(/** @type {string|null} */(overlay.reassessmentOutcome))||
    !isPlainStateObject(evidence)||evidence.sourceBlockId!==predecessor.blockId||
    typeof evidence.sourceBlockId!=="string"||!evidence.sourceBlockId.trim()||
    !Array.isArray(overlay.entries)||overlay.entries.length===0)return false;
  return true;
}
/** @param {unknown} value @returns {value is RawRecord & {schemaVersion:1,records:RecoveryRecord[],quarantine:RecoveryQuarantine[]}} */
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
/** @param {unknown} value */
function classifyRecoveryRecordEnvelope(value){
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value)||
    !exactRecoveryKeys(value,RECOVERY_RECORD_KEYS)||value.schemaVersion!==1)return"unknown";
  const diff=value.diff,overlay=/** @type {RawRecord|undefined} */(diff)?.recoveryWeek;
  if(!isPlainStateObject(diff)||!exactRecoveryKeys(diff,RECOVERY_DIFF_KEYS)||
    !isPlainStateObject(overlay)||!exactRecoveryKeys(overlay,RECOVERY_OVERLAY_KEYS)||
    overlay.schemaVersion!==1||overlay.policyVersion!==2)return"unknown";
  return isRecoveryCarrierRecord(value)?"valid":"malformed";
}
/** @param {unknown} value @returns {RecoveryClassification} */
function classifyRecoveryCarrier(value){
  if(value===undefined)return{kind:"absent",malformed:[],valid:[],needsEvidence:false};
  if(!isPlainStateObject(value)||!isBoundedTransitionValue(value)||
    !exactRecoveryKeys(value,RECOVERY_CARRIER_KEYS)||value.schemaVersion!==1||
    !Array.isArray(value.records)||value.records.length>TRANSITION_VALUE_LIMITS.arrayItems||
    !Array.isArray(value.quarantine)||value.quarantine.length>TRANSITION_VALUE_LIMITS.arrayItems||
    !value.quarantine.every(isRecoveryCarrierQuarantineEntry))return{kind:"unknown"};
  /** @type {RecoveryRecord[]} */const valid=[];
  /** @type {RecoveryEnvelope[]} */const malformed=[];
  for(const record of value.records){
    const status=classifyRecoveryRecordEnvelope(record);
    if(status==="unknown")return{kind:"unknown"};
    if(status==="valid")valid.push(/** @type {RecoveryRecord} */(record));
    else malformed.push(/** @type {RecoveryEnvelope} */(record))}
  /** @type {Map<string,RecoveryRecord[]>} */const targets=new Map();
  for(const record of valid){
    const target=record.diff.recoveryWeek.blockId;
    if(!targets.has(target))targets.set(target,[]);
    /** @type {RecoveryRecord[]} */(targets.get(target)).push(record)}
  const conflicts=[...targets].filter(([,records])=>records.length>1)
    .map(([targetBlockId,records])=>({targetBlockId,records}));
  return{kind:"known",valid,malformed,conflicts,
    needsEvidence:malformed.length>0||conflicts.length>0};
}
/** @param {RecoveryRecord[]} records @returns {RecoveryConflict[]} */
function recoveryCarrierConflictGroups(records){
  /** @type {Map<string,RecoveryRecord[]>} */const targets=new Map();
  for(const record of records){
    const target=record.diff.recoveryWeek.blockId;
    if(!targets.has(target))targets.set(target,[]);
    /** @type {RecoveryRecord[]} */(targets.get(target)).push(record)}
  return[...targets].filter(([,group])=>group.length>1)
    .map(([targetBlockId,group])=>({targetBlockId,records:group}))
}

    /** @param {unknown} effect @returns {DraftEffectOutcome} */
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
      /** @type {Extract<DraftEffect,{kind:"clear-draft"}>} */
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
      /** @type {Extract<DraftEffect,{kind:"replace-draft"}>} */
      const receipt={kind:"replace-draft",expectedRaw:effect.expectedRaw,replacementRaw:effect.replacementRaw,precondition};
      if(effect.required===true)receipt.required=true;
      if(precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY){
        if(typeof effect.conflictDay!=="string"||!effect.conflictDay||effect.conflictDay.length>200)
          return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"conflict-day"};
        receipt.conflictDay=effect.conflictDay}
      return{status:DRAFT_EFFECT_VALID,effect:receipt}}
    return{status:DRAFT_EFFECT_INVALID,effect:null,reason:"kind"}}

    /** @param {unknown} value @returns {DraftEffectOutcome} */
    function normalizeDraftEffectOutcome(value){
    if(isPlainStateObject(value)&&
      (value.status===DRAFT_EFFECT_VALID||value.status===DRAFT_EFFECT_INVALID||value.status===DRAFT_EFFECT_NONE)){
      if(value.status===DRAFT_EFFECT_VALID)return draftEffectOutcome(value.effect);
      if(value.status===DRAFT_EFFECT_NONE)return{status:DRAFT_EFFECT_NONE,effect:null};
      return{status:DRAFT_EFFECT_INVALID,effect:null,reason:value.reason||"invalid"}}
    return draftEffectOutcome(value)}

    /** @param {unknown} effect */
    function pendingJournalEffect(effect){
    const outcome=normalizeDraftEffectOutcome(effect);
    return outcome.status===DRAFT_EFFECT_VALID?outcome.effect:null}

    /** @param {unknown} effect */
    function draftEffectRequiresCoordination(effect){
    const outcome=normalizeDraftEffectOutcome(effect);
    return outcome.status===DRAFT_EFFECT_VALID&&
      outcome.effect.precondition!==DRAFT_PRECONDITION_MATCH_ONLY}


  /** @param {unknown} tin */
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

  /** @param {unknown} tout */
function isCoherentV1TransitionOut(tout){
    return isPlainStateObject(tout)&&isBoundedTransitionValue(tout)&&
      tout.schemaVersion===1&&
      typeof tout.transitionId==="string"&&tout.transitionId.trim()!==""&&
      typeof tout.proposalHash==="string"&&tout.proposalHash.trim()!==""&&
      typeof tout.successorProgramId==="string"&&tout.successorProgramId.trim()!==""}


export { cloneSnapshot, isPlainStateObject, readRevision, unversionedSnapshot, stripStorageMeta, exportableState, canonicalize, canonicalPayload, mirrorComparisonSnapshot, snapshotsEqual, storageSnapshotsEqual, snapshotBlockId, draftProgramFingerprint, rebaseStateChange, workoutProgramFingerprint, draftContextFingerprint, isValidBlockId, isBoundedProgressionValue, isBoundedTransitionValue, isValidRecoveryTransitions, classifyRecoveryCarrier, draftEffectOutcome, normalizeDraftEffectOutcome, pendingJournalEffect, draftEffectRequiresCoordination, isCoherentV1TransitionIn, isCoherentV1TransitionOut };

/** @typedef {RawRecord & {id:string,name:string,day:string,libraryId?:string}} ProgramRow
 * @typedef {RawRecord & {id:string,name:string,metricIds?:unknown[],metricDefinitions?:unknown[]}} CustomDefinition
 * @typedef {(id:string)=>RawRecord|null} LibraryLookup
 * @typedef {RawRecord & {id:string,name:string}} RawCustomDefinition
 * @typedef {RawRecord & {program:RawRecord[],log:RawRecord[],programMeta?:RawRecord|null,settings?:unknown,customExercises?:RawCustomDefinition[],programHistory?:RawRecord[],recoveryTransitions?:unknown}} RawSnapshot
 * @typedef {RawRecord & {id:string,name:string,created:string,updated:string}} ProgramMetadata
 * @typedef {{program:ProgramRow[],log:RawRecord[],settings:RawRecord,customExercises:CustomDefinition[],programHistory:RawRecord[]}} NormalizedFields
 * @typedef {RawRecord & NormalizedFields & {programMeta:ProgramMetadata}} NormalizedSnapshot
 * @typedef {{preserveInvalidProgression?:boolean,source?:string,customExercises?:CustomDefinition[]}} NormalizationOptions
 * @typedef {{MUSCLE_TOKENS:readonly string[],ROUTES:readonly string[],MAX_DRAFT_ENVELOPE_BYTES:number,normalizeMuscleAttribution:(value:unknown)=>{ok:true,value:string}|{ok:false,code?:string},isCanonicalMuscleAttribution:(value:unknown)=>boolean,isMuscleToken:(value:unknown)=>boolean,normalizeProfile:(value:unknown)=>{ok:boolean,value:RawRecord},normalizeProgrammingContext:(value:unknown)=>{ok:boolean,value:RawRecord}}} EntryRules
 * @typedef {{validateLoadingContext:(value:unknown)=>{ok:boolean}}} WorkoutRules
 * @typedef {{VERSIONS?:RawRecord,validateContext?:(value:unknown)=>{ok:boolean},compile?:(context:RawRecord,catalog:unknown)=>RawRecord & {kind:string,program:unknown},migrateLegacyStructure?:(program:ProgramRow[],structure:unknown)=>{program:ProgramRow[],structure:unknown}}} CompilerRules
 * @typedef {{validateRecoveryRecord?:(record:RecoveryRecord,context:RawRecord)=>Promise<{ok:boolean,record?:unknown}>,approvedRecoveryPolicy?:()=>unknown}} TransitionRules
 * @typedef {{exercises?:Array<RawRecord & {id:string}>,uuidIndex?:Record<string,RawRecord>}} CatalogSnapshot
 * @typedef {{Program:new(program:unknown,lookup:LibraryLookup,meta?:unknown,strict?:boolean,options?:{preserveLinkedSnapshot?:boolean})=>{toJSON():ProgramRow[]},normalizeCustomExercises:(value:unknown)=>CustomDefinition[],snapshotLookup:(customs:CustomDefinition[])=>LibraryLookup,canonicalProgramDefinition:(value:unknown,customs:unknown)=>RawRecord|null,compilerCustomDefinitions:(customs:unknown)=>unknown[],compactProgramPrescriptionState:(structure:unknown,program:ProgramRow[],meta:RawRecord,options:{freezeHistory:boolean})=>{structure:RawRecord|null,history?:RawRecord|null},programStructureForDefinition:(structure:unknown,definition:unknown)=>RawRecord|null,libraryMuscleAttribution:(value:unknown,kind:string)=>string,normalizeProgressionRelations:(value:unknown,program:ProgramRow[],options:RawRecord)=>unknown[],normalizeProgressionModifiers:(value:unknown,options:RawRecord)=>unknown[],canonicalizeDurableMuscleAttributions:<T>(value:T)=>T,canonicalizeProgramStructureMuscles:<T>(value:T)=>T,canonicalizeLinkedMuscleRows:<T>(value:T)=>T,compilerProgramMatchesLive:(program:unknown,compiled:unknown,customs:unknown)=>boolean}} SnapshotModel
 */

/** Bind immutable training/catalog domains once; never read app/session state.
 * Catalog is the integrity-verified raw catalog, not a browser loader.
 * model supplies the canonical training program comparison, not storage policy.
 * @param {{entry:EntryRules,metrics:typeof import('../training/metrics.js').default,workout:WorkoutRules,compiler?:CompilerRules|null,catalog?:CatalogSnapshot|null,model:SnapshotModel,transition?:TransitionRules|null,now?:(()=>string)|null,digest?:((raw:string)=>Promise<string>)|null,nextId?:(()=>string)|null,language?:{normalizeLang:(value:unknown)=>string|null,detectLang:()=>string}|null,progression?:{strategy:(value:unknown)=>unknown}|null}} dependencies
 */
export function createSnapshotPolicy({entry,metrics,workout,compiler,catalog,model,transition,
  now:nowInstant=null,digest=null,nextId=null,language=null,progression=null}) {
  const MuscleDomain=entry,ProgramEntry=entry,ExerciseMetrics=metrics,WorkoutDraft=workout;
  const CUSTOM_ID_PREFIX='custom:';
  /** @param {string} id */
  const rawCatalogObject=id=>Array.isArray(catalog)?catalog.find(row=>row?.id===id):
    (Object.hasOwn(catalog?.uuidIndex||{},id)?catalog?.uuidIndex?.[id]:null);
  const exercisesById=new Map((catalog?.exercises||[]).map(value=>[value.id,value]));
  /** @param {string} id */
  const rawExercise=id=>exercisesById.get(id)||null;
  const {Program,normalizeCustomExercises,snapshotLookup,canonicalProgramDefinition,
    compilerCustomDefinitions,compactProgramPrescriptionState,programStructureForDefinition,
    libraryMuscleAttribution,normalizeProgressionRelations,normalizeProgressionModifiers,
    canonicalizeDurableMuscleAttributions,canonicalizeProgramStructureMuscles,
    canonicalizeLinkedMuscleRows}=model;
  const ProgramCompiler=compiler;
  const uid=()=>/** @type {()=>string} */(nextId)();
  const customExercises=()=>[];
  const I18N=language;
/** @param {unknown} value @param {string} [field] */
function normalizeMuscleAttribution(value,field="muscle attribution"){
  const result=MuscleDomain?.normalizeMuscleAttribution?.(value);
  if(!result?.ok)throw new TypeError(`${result?.code||"invalid-muscle-domain"}: ${field}`);
  return result.value}
/** @param {unknown} value @param {WeakSet<object>} [seen] @returns {boolean} */
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
/** @param {unknown} value @param {boolean} [nullable] */
function isValidStoredMuscleField(value,nullable=false){
  return nullable&&value===null||typeof value==="string"&&MuscleDomain?.isCanonicalMuscleAttribution?.(value)}

const PLANNED_VOLUME_HISTORY_KEYS=["schemaVersion","throughWeek","plannedSessions","plannedWorkingSets","muscles"];
const PLANNED_VOLUME_HISTORY_MUSCLE_KEYS=["direct","secondary"];
/** @param {unknown} value */
function isValidPlannedVolumeHistory(value){
  if(!isPlainStateObject(value)||!isBoundedProgressionValue(value)||
    Object.keys(value).length!==PLANNED_VOLUME_HISTORY_KEYS.length||
    !PLANNED_VOLUME_HISTORY_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value,key))||
    value.schemaVersion!==1||!integerNumber(value.throughWeek)||value.throughWeek<0||value.throughWeek>52||
    !finiteNumber(value.plannedSessions)||value.plannedSessions<0||
    !finiteNumber(value.plannedWorkingSets)||value.plannedWorkingSets<0||
    !isPlainStateObject(value.muscles)||Object.keys(value.muscles).length!==PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.length||
    !PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(key=>Object.prototype.hasOwnProperty.call(value.muscles,key)))return false;
  const muscles=value.muscles;
  return PLANNED_VOLUME_HISTORY_MUSCLE_KEYS.every(kind=>{
    const map=muscles[kind];
    if(!isPlainStateObject(map)||Object.keys(map).length>MuscleDomain.MUSCLE_TOKENS.length)return false;
    return Object.entries(map).every(([name,amount])=>name&&name.length<=PROGRESSION_VALUE_LIMITS.stringLength&&
      MuscleDomain?.isMuscleToken?.(name)&&finiteNumber(amount)&&amount>=0);
  });
}

/** @param {unknown} value @returns {value is RawRecord} */
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
/** @param {unknown} value @param {unknown} [customDefinitions] @returns {value is RawRecord} */
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
/** @param {unknown} entry @param {unknown} [customExercises] @returns {entry is RawRecord} */
function isSafeProgramHistoryEntry(entry,customExercises=[]){
  if(!isPlainStateObject(entry))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"transitionOut")&&entry.transitionOut!=null&&
    !isCoherentV1TransitionOut(entry.transitionOut))return false;
  const customs=[...(Array.isArray(entry.customExercises)?entry.customExercises:[]),
    ...(Array.isArray(customExercises)?customExercises:[])];
  if(Object.prototype.hasOwnProperty.call(entry,"meta")&&!isSafeProgressionMeta(entry.meta,customs))return false;
  if(!Object.prototype.hasOwnProperty.call(entry,"program"))return true;
  return Array.isArray(entry.program)&&entry.program.every(isSafeProgressionFields)}
/** @param {unknown} entry @returns {entry is RawRecord} */
function isSafeLogRow(entry){
  if(!isPlainStateObject(entry))return false;
  if(Object.prototype.hasOwnProperty.call(entry,"setIndex")&&
    (!integerNumber(entry.setIndex)||entry.setIndex<0))return false;
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
  if(Object.prototype.hasOwnProperty.call(entry,"metricOrigin")&&!containsString(["source_catalog","user_defined"],entry.metricOrigin))return false;
  const metricFields=["metricType","metricIds","metricDefinitions","metricValues","equipmentId","loadingConvention","loadingContext","restSeconds"];
  const hasMetricFields=metricFields.some(key=>Object.prototype.hasOwnProperty.call(entry,key));
  if(hasMetricFields){
    if(!integerNumber(entry.setIndex)||entry.setIndex<0||entry.metricType!=="source_metrics@1"||!Array.isArray(entry.metricIds)||!Array.isArray(entry.metricDefinitions)||
      !Array.isArray(entry.metricValues)||entry.metricIds.length===0||
      !containsString(["source_catalog","user_defined"],entry.metricOrigin)||typeof entry.sourceLibraryId!=="string"||!entry.sourceLibraryId||
      !containsString(["external","assistance","per_side","bodyweight"],entry.loadingConvention)||
      !(entry.equipmentId===null||typeof entry.equipmentId==="string")||
      (entry.restSeconds!==null&&(!safeIntegerNumber(entry.restSeconds)||entry.restSeconds<0)))return false;
    const definitions=ExerciseMetrics?.validateDefinitions?.(entry.metricIds,entry.metricDefinitions);
    const values=ExerciseMetrics?.validateMetricValues?.(entry.metricIds,entry.metricValues);
    if(!definitions?.ok||!values?.ok||entry.metricValues.some(value=>typeof value?.value!=="number"||!finiteNumber(value.value)))return false;
    const sourceExercise=rawExercise(entry.sourceLibraryId);
    const sourceBinding=ExerciseMetrics?.validateExerciseSourceBinding?.({metricOrigin:entry.metricOrigin,
      metricIds:entry.metricIds,metricDefinitions:entry.metricDefinitions,sourceId:entry.sourceLibraryId,
      sourceExercise,bodyweightCoefficient:/** @type {RawRecord|null|undefined} */(entry.loadingModel)?.bodyweightCoefficient??null});
    if(!sourceBinding?.ok)return false;
    const loading=WorkoutDraft?.validateLoadingContext?.(entry.loadingContext);
    if(!loading?.ok||!Object.prototype.hasOwnProperty.call(entry.loadingContext,"bodyweightKg")||
      !Object.prototype.hasOwnProperty.call(entry.loadingContext,"bodyweightContributionEnabled")||
      !Object.prototype.hasOwnProperty.call(entry.loadingContext,"externalLoadMultiplier"))return false;
    if(entry.loadingModel!=null&&(!isPlainStateObject(entry.loadingModel)||
      Object.keys(entry.loadingModel).some(key=>!["bodyweightCoefficient","assistanceDirection"].includes(key))||
      (entry.loadingModel.bodyweightCoefficient!=null&&(!finiteNumber(entry.loadingModel.bodyweightCoefficient)||entry.loadingModel.bodyweightCoefficient<0||entry.loadingModel.bodyweightCoefficient>1))||
      (entry.loadingModel.assistanceDirection!=null&&entry.loadingModel.assistanceDirection!=="subtract")))return false;
    const loadingContext=/** @type {{bodyweightKg?:number|null,bodyweightCoefficient?:number|null,externalLoadMultiplier?:number|null,loadingConvention?:string}} */(entry.loadingContext);
    const modelCoefficient=/** @type {RawRecord|null|undefined} */(entry.loadingModel)?.bodyweightCoefficient??null;
    const contextCoefficient=loadingContext?.bodyweightCoefficient??null;
    if(modelCoefficient!==contextCoefficient)return false;
    const semantics=new Set(entry.metricDefinitions.map(definition=>definition.semantic));
    const expectedConvention=semantics.has("assistanceKg")?"assistance":
      semantics.has("loadPerSideKg")||semantics.has("persistentLoadPerSideKg")?"per_side":
        entry.metricIds.length===1&&(semantics.has("reps")||semantics.has("repsPerSide"))?"bodyweight":"external";
    if(entry.loadingConvention!==expectedConvention)return false;
    if(loadingContext.loadingConvention!==entry.loadingConvention)return false;
    if(entry.loadingConvention==="bodyweight"&&loadingContext.externalLoadMultiplier!==0)return false;
    if(loadingContext.externalLoadMultiplier!=null&&entry.loadingConvention!=="per_side"&&
      entry.loadingConvention!=="bodyweight"&&loadingContext.externalLoadMultiplier!==1)return false;
    if(/** @type {RawRecord|null|undefined} */(entry.loadingModel)?.bodyweightCoefficient!=null&&loadingContext.bodyweightCoefficient!==/** @type {RawRecord} */(entry.loadingModel).bodyweightCoefficient)return false;
    if(loadingContext.bodyweightKg!==(entry.bodyweight??null))return false;
    if(entry.rir!==null&&(!finiteNumber(entry.rir)||entry.rir<0))return false;
    const load=entry.metricDefinitions.find(definition=>definition.semantic==="loadKg");
    const reps=entry.metricDefinitions.find(definition=>definition.semantic==="reps");
    const loadValue=load?entry.metricValues.find(value=>value.metricId===load.id)?.value:null;
    const repsValue=reps?entry.metricValues.find(value=>value.metricId===reps.id)?.value:null;
    if(entry.load!==loadValue||entry.reps!==repsValue)return false;
    if(entry.equipmentId!=null&&rawCatalogObject(entry.equipmentId)?.type!=="equipment")return false;
  }
  return true}
/** @param {unknown} entry @returns {entry is RawCustomDefinition} */
function isSafeCustomExercise(entry){
  if(!isPlainStateObject(entry))return false;
  if(!isValidMuscleDomainTree(entry))return false;
  for(const key of ["primary","secondary"])
    if(Object.prototype.hasOwnProperty.call(entry,key)&&!isValidStoredMuscleField(entry[key]))return false;
  return typeof entry.id==="string"&&entry.id.startsWith(CUSTOM_ID_PREFIX)&&typeof entry.name==="string"}
/** @param {unknown} marker @returns {marker is {version:1,programId:string,raw:string,revision?:number}} */
function isValidSetupActivationMarker(marker){
  const maxRaw=safeIntegerNumber(ProgramEntry?.MAX_DRAFT_ENVELOPE_BYTES)
    ?ProgramEntry.MAX_DRAFT_ENVELOPE_BYTES:70000;
  return isPlainStateObject(marker)&&marker.version===1&&
    typeof marker.programId==="string"&&marker.programId.length>0&&marker.programId.length<=128&&
    typeof marker.raw==="string"&&marker.raw.length>0&&marker.raw.length<=maxRaw&&
    (!Object.prototype.hasOwnProperty.call(marker,"revision")||
      (integerNumber(marker.revision)&&marker.revision>=1))}
/** @param {unknown} raw @param {unknown} programId */
function setupActivationMarker(raw,programId){
  if(typeof raw!=="string"||!raw||typeof programId!=="string"||!programId)return null;
  const marker={version:1,programId,raw};
  return isValidSetupActivationMarker(marker)?marker:null}
/** @param {unknown} marker @param {unknown} raw @param {unknown} programId */
function setupActivationMatches(marker,raw,programId){
  return isValidSetupActivationMarker(marker)&&marker.programId===programId&&marker.raw===raw}
/** @param {unknown} s @returns {s is RawSnapshot} */
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

    /** @param {RawRecord|null|undefined} snapshot */
function pendingDraftTransaction(snapshot){
    const value=snapshot?.[STORAGE_DRAFT_TXN];
    if(!isPlainStateObject(value)||value.version!==1||typeof value.id!=="string"||!value.id)return null;
    const effectOutcome=draftEffectOutcome(value.effect),previous=value.previous;
    if(effectOutcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(effectOutcome)||!isPlainStateObject(previous)||
      Object.prototype.hasOwnProperty.call(previous,STORAGE_DRAFT_TXN)||!isValidStateShape(previous)||
      readRevision(snapshot)<=readRevision(previous))return null;
    return{id:value.id,effect:effectOutcome.effect,previous:cloneSnapshot(previous)}}


/** @param {unknown} value */
function isValidStateWithoutRecoveryCarrier(value){
  if(!isPlainStateObject(value)||!Object.prototype.hasOwnProperty.call(value,"recoveryTransitions"))return false;
  const copy=cloneSnapshot(value);delete copy.recoveryTransitions;
  return isValidStateShape(copy)}
/** @param {RawRecord|null|undefined} parsed @param {unknown} raw */
function carrierReadStatus(parsed,raw){
  const classification=classifyRecoveryCarrier(parsed?.recoveryTransitions);
  if(classification.kind==="known"&&
    (isValidStateShape(parsed)||isValidStateWithoutRecoveryCarrier(parsed)))
    return{status:"valid",raw,parsed,recoveryCarrierClassification:classification};
  return null;
}

/** @param {string} existing @param {string} incoming */
function mergeRecoverySource(existing,incoming){
  if(existing===incoming)return existing;
  if(existing==="both"||incoming==="both")return"both";
  return"both";
}
/** @param {RecoveryQuarantine} entry */
function quarantineEntryKey(entry){return`${entry.digest}\u0000${entry.reason}`}

/** @param {RecoveryQuarantine[]} list @param {RecoveryQuarantine} entry */
function mergeRecoveryQuarantine(list,entry){
  const key=quarantineEntryKey(entry),index=list.findIndex(candidate=>quarantineEntryKey(candidate)===key);
  if(index<0){list.push(entry);return true}
  const previous=list[index],source=mergeRecoverySource(previous.sourceReplica,entry.sourceReplica);
  if(source===previous.sourceReplica)return false;
  list[index]={...previous,sourceReplica:source};
  return true;
}

/** @param {RawSnapshot} snapshot @param {string} sourceReplica @param {{priorQuarantine?:RecoveryQuarantine[]}} [options] */
async function normalizeRecoveryCarrierSnapshot(snapshot,sourceReplica,{priorQuarantine=[]}={}){
  let classification=classifyRecoveryCarrier(snapshot?.recoveryTransitions);
  if(classification.kind!=="known")return{kind:classification.kind,snapshot};
  let semantic;
  try{semantic=await classifyRecoveryCarrierSemantics(snapshot,classification)}
  catch{return{kind:"full-recovery",snapshot}}
  if(semantic.kind!=="known")return{kind:"full-recovery",snapshot};
  const checked=semantic;
  const carrier=/** @type {{quarantine:RecoveryQuarantine[]}} */(snapshot.recoveryTransitions);
  /** @type {{schemaVersion:1,records:RecoveryRecord[],quarantine:RecoveryQuarantine[]}} */
  const normalized={schemaVersion:1,records:checked.valid.map(cloneSnapshot),quarantine:[]};
  for(const entry of carrier.quarantine)
    mergeRecoveryQuarantine(normalized.quarantine,cloneSnapshot(entry));
  for(const entry of priorQuarantine)
    mergeRecoveryQuarantine(normalized.quarantine,cloneSnapshot(entry));
  const detectedAt=()=>/** @type {()=>string} */(nowInstant)();
  /** @param {string} raw @param {string} reason */
  const addEvidence=async(raw,reason)=>{
    if(typeof raw!=="string"||raw.length>TRANSITION_VALUE_LIMITS.stringLength)
      return{kind:"full-recovery"};
    let evidenceDigest;
    try{evidenceDigest=await /** @type {(raw:string)=>Promise<string>} */(digest)(raw)}catch{return{kind:"full-recovery"}}
    /** @type {RecoveryQuarantine} */
    const entry={schemaVersion:1,digest:evidenceDigest,raw,sourceReplica,detectedAt:detectedAt(),reason};
    mergeRecoveryQuarantine(normalized.quarantine,entry);
    if(!isBoundedTransitionValue(normalized))return{kind:"full-recovery"};
    return{kind:"ok"};
  };
  for(const malformed of checked.malformed){
    const result=await addEvidence(JSON.stringify(malformed),"known-schema-malformed-recovery");
    if(result.kind!=="ok")return{kind:result.kind,snapshot};
  }
  for(const conflict of checked.conflicts){
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

/** @param {RawSnapshot} snapshot @param {RecoveryRecord} record */
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
/** @param {RawSnapshot} snapshot @param {Extract<RecoveryClassification,{kind:"known"}>} classification @returns {Promise<{kind:"unavailable"}|Extract<RecoveryClassification,{kind:"known"}>>} */
async function classifyRecoveryCarrierSemantics(snapshot,classification){
  /** @type {RecoveryRecord[]} */const valid=[];
  const malformed=[...classification.malformed];
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
/** @param {RawRecord|null|undefined} meta */
function classifyCompilerTransitionProvenance(meta) {
  const provenance = /** @type {RawRecord|null|undefined} */(meta?.programStructure)?.provenance;
  if (provenance == null) return "absent";
  if (!isPlainStateObject(provenance)) return "invalid";
  if (provenance.source === "legacy_migration" || provenance.source === "manual_build") return "absent";
  const strings = ["familyId", "blueprintId", "profileId"];
  if (!strings.every(key => typeof provenance[key] === "string" && provenance[key].trim())) return "invalid";
  if (!COMPILER_PROVENANCE_FIELDS.every(key => Object.prototype.hasOwnProperty.call(provenance, key))) return "invalid";
  if (!["blueprintVersion", "compilerVersion", "catalogueVersion", "rulesVersion", "contextVersion", "recentConsistencyVersion"]
    .every(key => safeIntegerNumber(provenance[key]) && /** @type {number} */(provenance[key]) >= 1)) return "invalid";
  return "present";
}

/** @param {RawSnapshot} snapshot @param {CompilerRules} Compiler @param {unknown} catalogue */
function recoveryCompilerInstance(snapshot,Compiler,catalogue){
  const meta=snapshot?.programMeta;
  if(classifyCompilerTransitionProvenance(meta)!=="present"||!meta?.compilerContext||
    typeof Compiler?.compile!=="function")return null;
  try{
    const instance=Compiler.compile(/** @type {RawRecord} */(meta.compilerContext),catalogue);
    if(!instance||instance.kind!=="compiled"||!model.compilerProgramMatchesLive(snapshot.program,instance.program,snapshot.customExercises))return null;
    return instance;
  }catch{return null}}

const DEFAULTS={jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,lastExport:"",unit:"kg",lang:null,rirMode:"numeric",voiceInputEnabled:false,notify:{enabled:false,timer:true,session:true,unfinished:true,missed:true}};
/** @param {unknown} v @param {number} def @param {number} [min] */
const normSetting=(v,def,min=0)=>finiteNumber(+/** @type {number} */(v))&&+/** @type {number} */(v)>=min?+/** @type {number} */(v):def;
/** @param {unknown} v */
const normalizeRestSec=v=>{const n=+/** @type {number} */(v);if(!finiteNumber(n)||n<0)return DEFAULTS.restSec;return Math.round(n)};
/** @param {unknown} v @param {boolean} def */
const normBool=(v,def)=>typeof v==="boolean"?v:def;
/* A settings blob written by a newer build carries keys this one has no field
   for. Dropping them here does not merely hide them: boot normalization would
   leave live state without them while the mutation base still has them, so the
   next ordinary write offers them back as deletions. Unknown keys therefore ride
   along untouched, and the known fields always win. */
/** @template {RawRecord} T @param {unknown} raw @param {T} known @returns {T & RawRecord} */
function withUnknownKeys(raw,known){
  if(!isPlainStateObject(raw))return known;
  /** @type {RawRecord} */const out={};
  for(const key of Object.keys(raw))
    if(!Object.prototype.hasOwnProperty.call(known,key))out[key]=cloneSnapshot(raw[key]);
  return Object.assign(out,known)}
/** @param {unknown} value */
function normalizeNotify(value){
  const n=/** @type {RawRecord|null|undefined} */(value);
  return withUnknownKeys(n,{enabled:!!(n&&n.enabled),timer:n?.timer!==false,session:n?.session!==false,unfinished:n?.unfinished!==false,missed:n?.missed!==false})}
/** @param {unknown} value */
const normalizeSettings=value=>{const s=/** @type {RawRecord|null|undefined} */(value);return normalizeSettingsRecord(s)};
/** @param {RawRecord|null|undefined} s */
const normalizeSettingsRecord=s=>{const lang=I18N?.normalizeLang(s?.lang)||I18N?.detectLang()||"en";return withUnknownKeys(s,{jumpPct:normSetting(s?.jumpPct,DEFAULTS.jumpPct,0),minJump:normSetting(s?.minJump,DEFAULTS.minJump,0.01),rirHigh:normSetting(s?.rirHigh,DEFAULTS.rirHigh,0),hardRir:normSetting(s?.hardRir,DEFAULTS.hardRir,0),restSec:normalizeRestSec(s?.restSec),lastExport:typeof s?.lastExport==="string"?s.lastExport:"",unit:s?.unit==="lb"?"lb":"kg",lang,rirMode:s?.rirMode==="effort"?"effort":"numeric",voiceInputEnabled:normBool(s?.voiceInputEnabled,DEFAULTS.voiceInputEnabled),notify:normalizeNotify(s?.notify)})};

/** @param {RawRecord[]} log @returns {unknown} */
function earliestLogDate(log){if(!log?.length)return null;return log.reduce((min,r)=>!min||String(r.date)</** @type {string} */(min)?r.date:min,/** @type {unknown} */(null))}
/** @param {RawRecord[]} [log] @returns {ProgramMetadata} */
function defaultProgramMeta(log=[]){const now=/** @type {()=>string} */(nowInstant)();return{id:uid(),name:"",started:earliestLogDate(log),created:now,updated:now,
  goal:null,experience:null,daysPerWeek:null,splitType:null,equipment:[],priorityMuscles:[],sessionLength:null,
  mesocycleLengthWeeks:6,mesocycleStatus:"active",completedAt:null,onboarded:false,
  progressionRelations:[],progressionModifiers:[],progressionIncompatibilities:[],programStructure:null,entrySource:null}}
/** @param {unknown} candidate */
function normalizeProgramEntrySource(candidate){
  const value=/** @type {RawRecord|null|undefined} */(candidate);
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const routes=entry?.ROUTES||[];
  const route=containsString(routes,value.route)?value.route:null;
  const fingerprint=typeof value.fingerprint==="string"&&value.fingerprint.length<=128&&/^[a-zA-Z0-9._:-]+$/.test(value.fingerprint)
    ?value.fingerprint:null;
  return route&&fingerprint?{route,fingerprint}:null}

/** @param {unknown} candidate @param {RawRecord[]} [log] @param {ProgramRow[]} [program] @param {NormalizationOptions} [options] @returns {ProgramMetadata} */
function normalizeProgramMeta(candidate,log=[],program=[],options={}){const m=/** @type {RawRecord|null|undefined} */(candidate);const now=/** @type {()=>string} */(nowInstant)(),base=defaultProgramMeta(log);
  if(!m||typeof m!=="object")return base;
  if(Object.prototype.hasOwnProperty.call(m,"blockId")&&!isValidBlockId(m.blockId,m.id))
    throw new TypeError("blockId: expected bounded opaque identity");
  const started=typeof m.started==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(m.started)?m.started:(m.started===null?null:base.started);
  const goal=typeof m.goal==="string"?m.goal.trim()||null:m.goal===null?null:base.goal;
  const experience=typeof m.experience==="string"?m.experience.trim()||null:m.experience===null?null:base.experience;
  const daysPerWeek=m.daysPerWeek===null?null:finiteNumber(+/** @type {number} */(m.daysPerWeek))?+/** @type {number} */(m.daysPerWeek):base.daysPerWeek;
  const splitType=typeof m.splitType==="string"?m.splitType.trim()||null:m.splitType===null?null:base.splitType;
  const equipment=Array.isArray(m.equipment)?m.equipment.map(s=>String(s).trim()).filter(Boolean):base.equipment;
  const priorityMuscles=Array.isArray(m.priorityMuscles)?m.priorityMuscles.map(s=>String(s).trim()).filter(Boolean):base.priorityMuscles;
  const sessionLength=typeof m.sessionLength==="string"?m.sessionLength.trim()||null:m.sessionLength===null?null:base.sessionLength;
  const mesocycleLengthWeeks=finiteNumber(+/** @type {number} */(m.mesocycleLengthWeeks))&&+/** @type {number} */(m.mesocycleLengthWeeks)>0?Math.round(+/** @type {number} */(m.mesocycleLengthWeeks)):base.mesocycleLengthWeeks;
  const mesocycleStatus=m.mesocycleStatus==="active"||m.mesocycleStatus==="completed"?m.mesocycleStatus:base.mesocycleStatus;
  const completedAt=typeof m.completedAt==="string"?m.completedAt:m.completedAt===null?null:base.completedAt;
  const onboarded=typeof m.onboarded==="boolean"?m.onboarded:base.onboarded;
  const blockPromptDismissedId=typeof m.blockPromptDismissedId==="string"&&m.blockPromptDismissedId?m.blockPromptDismissedId:null;
  if(m.progressionIncompatibilities!=null&&!isBoundedProgressionValue(m.progressionIncompatibilities))
    throw new TypeError("progressionIncompatibilities: structure exceeds safety bounds");
  if(m.progressionIncompatibilities!=null&&!Array.isArray(m.progressionIncompatibilities))
    throw new TypeError("progressionIncompatibilities: expected array");
  const incompatibilities=Array.isArray(m.progressionIncompatibilities)?cloneSnapshot(m.progressionIncompatibilities):[];
  const progressionOptions={preserveInvalid:options.preserveInvalidProgression===true,incompatibilities,source:options.source};
  const progressionRelations=normalizeProgressionRelations(m.progressionRelations,program,progressionOptions);
  const progressionModifiers=normalizeProgressionModifiers(m.progressionModifiers,progressionOptions);
  if(m.programStructure!=null&&!isBoundedProgressionValue(m.programStructure))throw new TypeError("programStructure: structure exceeds safety bounds");
  const programStructure=m.programStructure&&typeof m.programStructure==="object"?cloneSnapshot(m.programStructure):base.programStructure;
  if(m.plannedVolumeHistory!=null&&!isValidPlannedVolumeHistory(m.plannedVolumeHistory))
    throw new TypeError("plannedVolumeHistory: expected bounded aggregate");
  const plannedVolumeHistory=m.plannedVolumeHistory==null?null:cloneSnapshot(m.plannedVolumeHistory);
  const programDefinition=m.programDefinition==null?null:canonicalProgramDefinition(
    m.programDefinition,options.customExercises||customExercises());
  if(m.programDefinition!=null&&!programDefinition)throw new TypeError("programDefinition: invalid Plan 067 definition");
  const entrySource=normalizeProgramEntrySource(m.entrySource);
  let compilerContext=null;
  if(m.compilerContext!=null){
    if(!isBoundedProgressionValue(m.compilerContext))throw new TypeError("compilerContext: structure exceeds safety bounds");
    if(typeof m.compilerContext!=="object"||Array.isArray(m.compilerContext))throw new TypeError("compilerContext: expected object");
    const check=typeof ProgramCompiler?.validateContext==="function"
      ?ProgramCompiler.validateContext(m.compilerContext)
      :({ok:typeof /** @type {RawRecord} */(m.compilerContext).schemaVersion==="number"&&/** @type {RawRecord} */(m.compilerContext).schemaVersion>=1});
    if(check.ok)compilerContext=cloneSnapshot(m.compilerContext);
  }
  let transitionIn=null;
  if(m.transitionIn!=null){
    if(!isBoundedTransitionValue(m.transitionIn))throw new TypeError("transitionIn: structure exceeds safety bounds");
    if(typeof m.transitionIn!=="object"||Array.isArray(m.transitionIn))throw new TypeError("transitionIn: expected object");
    const t=/** @type {RawRecord} */(m.transitionIn);
    if(t.schemaVersion===1&&typeof t.transitionId==="string"&&t.transitionId.trim()&&
       typeof t.proposalHash==="string"&&t.proposalHash.trim()&&t.status==="committed"&&
       typeof t.confirmedAt==="string"&&t.confirmedAt.trim()&&typeof t.archiveId==="string"&&t.archiveId.trim()&&
       typeof t.successor==="object"&&t.successor!==null&&typeof t.predecessor==="object"&&t.predecessor!==null){
      transitionIn=cloneSnapshot(t);
    }
  }
  const normalizedId=typeof m.id==="string"&&m.id?m.id:base.id;
  /** @type {ProgramMetadata} */
  const metaObj={id:normalizedId,name:typeof m.name==="string"?m.name.trim():"",started,
    created:typeof m.created==="string"?m.created:base.created,updated:typeof m.updated==="string"?m.updated:now,
    goal,experience,daysPerWeek,splitType,equipment,priorityMuscles,sessionLength,mesocycleLengthWeeks,mesocycleStatus,completedAt,onboarded,
    progressionRelations,progressionModifiers,progressionIncompatibilities:incompatibilities,blockPromptDismissedId,programStructure,entrySource};
  if(plannedVolumeHistory!=null)metaObj.plannedVolumeHistory=plannedVolumeHistory;
  if(programDefinition)metaObj.programDefinition=programDefinition;
  if(Object.prototype.hasOwnProperty.call(m,"blockId"))metaObj.blockId=m.blockId;
  if(compilerContext!=null)metaObj.compilerContext=compilerContext;
  if(transitionIn!=null)metaObj.transitionIn=transitionIn;
  const loadSteps=normalizeLoadingConfiguration(m.loadingConfiguration);
  if(loadSteps)metaObj.loadingConfiguration=loadSteps;
  return metaObj;}
/* Per-movement smallest load change in canonical kg; anything else is dropped. */
/** @param {unknown} value */
function normalizeLoadingConfiguration(value){
  const source=isPlainStateObject(value)&&isPlainStateObject(value.byExerciseId)?value.byExerciseId:null;
  if(!source)return null;
  /** @type {Record<string,{loadStepKg:number}>} */const byExerciseId={};
  for(const [exerciseId,entry] of Object.entries(source).slice(0,2048)){
    const step=/** @type {RawRecord|null|undefined} */(entry)?.loadStepKg;
    if(exerciseId&&exerciseId.length<=256&&finiteNumber(step)&&step>0&&step<=100)byExerciseId[exerciseId]={loadStepKg:step}}
  return Object.keys(byExerciseId).length?{byExerciseId}:null}

/** @template {RawRecord} T @param {ProgramRow[]} program @param {T} meta @param {{freezeHistory?:boolean}} [options] @returns {{program:ProgramRow[],meta:T}} */
function withExplicitProgramStructure(program,meta,{freezeHistory=false}={}){
  if(!ProgramCompiler?.migrateLegacyStructure)return{program,meta};
  if(meta?.plannedVolumeHistory!=null&&!isValidPlannedVolumeHistory(meta.plannedVolumeHistory))
    throw new TypeError("plannedVolumeHistory: expected bounded aggregate");
  const migrated=ProgramCompiler.migrateLegacyStructure(program,meta?.programStructure);
  const compacted=compactProgramPrescriptionState(migrated.structure,migrated.program,meta,{freezeHistory});
  /** @type {T & {programStructure:RawRecord|null,plannedVolumeHistory?:unknown}} */const nextMeta={...meta,programStructure:compacted.structure};
  if(compacted.history)nextMeta.plannedVolumeHistory=compacted.history;
  return{program:migrated.program,meta:nextMeta}
}

/** @param {unknown} history @param {LibraryLookup} lookup @returns {RawRecord[]} */
function normalizeProgramHistory(history,lookup){
  return(Array.isArray(history)?history:[]).map(entry=>{
    const normalized=/** @type {RawRecord} */(cloneSnapshot(entry));
    if(Object.prototype.hasOwnProperty.call(normalized,"program")){
      // An archived program is a historical snapshot. Keep its linked
      // movement identity and captured attribution; resolving it through the
      // current custom library would rewrite history after a definition edit.
      normalized.program=new Program(normalized.program,lookup,null,false,{preserveLinkedSnapshot:true}).toJSON();
      const structured=withExplicitProgramStructure(/** @type {ProgramRow[]} */(normalized.program),/** @type {RawRecord} */(normalized.meta||normalized.programMeta||{}),
        {freezeHistory:true});
      normalized.program=structured.program;
      if(normalized.meta)normalized.meta=structured.meta;
      else normalized.programMeta=structured.meta}
    if(entry.transitionOut!=null){
      if(!isBoundedTransitionValue(entry.transitionOut))throw new TypeError("transitionOut: structure exceeds safety bounds");
      if(typeof entry.transitionOut==="object"&&!Array.isArray(entry.transitionOut)){
        const t=/** @type {RawRecord} */(entry.transitionOut);
        if(t.schemaVersion===1&&typeof t.transitionId==="string"&&t.transitionId.trim()&&
           typeof t.proposalHash==="string"&&t.proposalHash.trim()&&
           typeof t.successorProgramId==="string"&&t.successorProgramId.trim()){
          normalized.transitionOut=cloneSnapshot(t);
        }
      }
    }
    if(typeof entry.archiveId==="string"&&entry.archiveId.trim()){
      normalized.archiveId=entry.archiveId.trim();
    }
    return normalized})}
/** @param {unknown} s @param {NormalizationOptions} [options] @returns {NormalizedSnapshot} */
function normalizeLoaded(s,options={}){
  if(s==null)return{settings:{...DEFAULTS},programMeta:defaultProgramMeta([]),program:[],log:[],programHistory:[],customExercises:[],[STORAGE_REV]:0};
  if(!isValidStateShape(s))throw new TypeError("Invalid Taurifer state");
  const customs=normalizeCustomExercises(s.customExercises),lookup=snapshotLookup(customs);
  /** @type {RawRecord & NormalizedFields & {programMeta:ProgramMetadata|null}} */
  const out={settings:normalizeSettings(s.settings),programMeta:null,
    program:[],log:cloneSnapshot(s.log),
    programHistory:normalizeProgramHistory(Object.prototype.hasOwnProperty.call(s,"programHistory")?s.programHistory:[],lookup),
    customExercises:customs};
  // Resolved against this snapshot's own custom definitions: during an import
  // or a boot they are not in live state yet.
  out.program=new Program(s.program,lookup).toJSON();
  out.programMeta=normalizeProgramMeta(s.programMeta,s.log,out.program,{...options,customExercises:customs});
  const structured=withExplicitProgramStructure(out.program,out.programMeta);
  out.program=structured.program;out.programMeta=structured.meta;
  // An older Review successor kept its predecessor's day list (#388).
  if(out.programMeta?.programStructure)out.programMeta.programStructure=
    programStructureForDefinition(out.programMeta.programStructure,out.programMeta.programDefinition);
  out[STORAGE_REV]=readRevision(s);
  if(Object.prototype.hasOwnProperty.call(s,"recoveryTransitions"))
    out.recoveryTransitions=cloneSnapshot(s.recoveryTransitions);
  if(Object.prototype.hasOwnProperty.call(s,STORAGE_FOLLOWUP))out[STORAGE_FOLLOWUP]=s[STORAGE_FOLLOWUP];
  if(Object.prototype.hasOwnProperty.call(s,STORAGE_SETUP_TXN))out[STORAGE_SETUP_TXN]=cloneSnapshot(s[STORAGE_SETUP_TXN]);
  if(Object.prototype.hasOwnProperty.call(s,"profile")){
    // The Basics a lifter gave in setup (Plan 072). Keep raw records this
    // release cannot interpret so a later version can recover them.
    const normalized=entry?.normalizeProfile?.(s.profile);
    out.profile=normalized?.ok&&Object.keys(normalized.value).length
      ?normalized.value:cloneSnapshot(s.profile)}
  if(Object.prototype.hasOwnProperty.call(s,"programmingContext")){
    const Entry=entry;
    if(Entry){
      const normalized=Entry.normalizeProgrammingContext(s.programmingContext);
      if(normalized.ok)out.programmingContext=normalized.value}
    else if(s.programmingContext&&typeof s.programmingContext==="object")out.programmingContext=cloneSnapshot(s.programmingContext)}
  return /** @type {NormalizedSnapshot} */(out)}

  /** @param {unknown} s */
  const movementToken=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  /** @param {unknown} v */
  const parseDec=v=>{if(typeof v==='number')return finiteNumber(v)?v:NaN;if(v==null||v==='')return NaN;const n=Number(String(v).trim().replace(/(\d),(\d)/g,'$1.$2'));return finiteNumber(n)?n:NaN};
  /** @param {unknown} v @param {number} [f] */
  const posNum=(v,f=0)=>{const n=parseDec(v);return Math.max(0,finiteNumber(n)?n:f)};
/** @param {NormalizedSnapshot} snapshot */
function migrateLogSnapshot(snapshot){let changed=false;const lookup=snapshotLookup(snapshot.customExercises);
  for(const row of snapshot.log){
  const named=snapshot.program.find(e=>e.name===row.name&&e.day===row.day)||snapshot.program.find(e=>e.name===row.name);
  const slotted=snapshot.program.find(e=>e.id===row.exerciseId);
  const ex=named||(!slotted?.libraryId?slotted:null);
  if(!row.exerciseId&&ex){row.exerciseId=ex.id;changed=true}
  if(row.performedName==null&&row.name){row.performedName=String(row.name);changed=true}
  if(row.performedLibraryId==null&&ex?.libraryId){
    const entry=lookup(/** @type {string} */(ex.libraryId)),names=new Set([ex.name,entry?.name,entry?.namePt].map(movementToken).filter(Boolean));
    if(names.has(movementToken(row.name))){row.performedLibraryId=ex.libraryId;changed=true}}
  if(row.performedLibraryId==null&&row.performedMovementId==null&&ex?.movementId){
    row.performedMovementId=ex.movementId;changed=true}
  const performed=row.performedLibraryId?lookup(/** @type {string} */(row.performedLibraryId)):null;
  if(performed){
    if(row.performedPrimary==null){row.performedPrimary=libraryMuscleAttribution(performed,"primary");changed=true}
    if(row.performedSecondary==null){row.performedSecondary=libraryMuscleAttribution(performed,"secondary");changed=true}}
  else if(row.performedName===row.name){
    if(row.performedPrimary==null&&row.primary!=null){row.performedPrimary=String(row.primary||"");changed=true}
    if(row.performedSecondary==null&&row.secondary!=null){row.performedSecondary=String(row.secondary||"");changed=true}}
  if(Array.isArray(row.metricValues))continue;
  const ld=posNum(row.load),rp=posNum(row.reps);
  const missingRir=row.rir==null||row.rir==="",parsedRir=parseDec(row.rir);
  const explicitStrategy=/** @type {{strategy?:{id?:unknown}}|null|undefined} */(ex?.progression)?.strategy?.id;
  const preserveMissingRir=explicitStrategy&&explicitStrategy!=="range"&&missingRir;
  // Keep the released progression input exactly as it was. Progress also needs
  // to know that a legacy range row which was coerced to RIR 0 was unmeasured,
  // so retain that provenance separately instead of changing recommendation
  // arithmetic for every existing program.
  const rr=preserveMissingRir?null:posNum(row.rir);
  if((missingRir||!finiteNumber(parsedRir)||parsedRir<0)&&row.rirMeasured!==false){row.rirMeasured=false;changed=true}
  if(ld!==row.load||rp!==row.reps||rr!==row.rir){row.load=ld;row.reps=rp;row.rir=rr;changed=true}}
  return changed}
  return Object.freeze({isValidStateShape,isValidStateWithoutRecoveryCarrier,carrierReadStatus,
    classifyRecoveryCarrier,isValidRecoveryTransitions,isValidBlockId,isBoundedTransitionValue,
    normalizeRecoveryCarrierSnapshot,pendingDraftTransaction,canonicalProgramDefinition,
    isValidMuscleDomainTree,isValidStoredMuscleField,isSafeCustomExercise,isSafeProgressionFields,isSafeProgressionMeta,isSafeLogRow,
    isSafeProgramHistoryEntry,isValidPlannedVolumeHistory,isValidSetupActivationMarker,
    setupActivationMarker,setupActivationMatches,normalizeMuscleAttribution,
    migrateLogSnapshot,normalizeLoaded,normalizeSettings,normalizeNotify,normalizeProgramMeta,defaultProgramMeta,
    normalizeProgramHistory,withExplicitProgramStructure,canonicalizeDurableMuscleAttributions,
    canonicalizeProgramStructureMuscles,canonicalizeLinkedMuscleRows,normalizeLoadingConfiguration,
    normalizeProgramEntrySource});
}
