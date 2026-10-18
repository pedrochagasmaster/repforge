import * as Snapshot from './snapshot.js';
/** @typedef {import('./contracts.js').StoredSnapshot} StoredSnapshot
 * @typedef {import('./contracts.js').StorageIO} StorageIO
 * @typedef {import('./contracts.js').OutcomeInput} OutcomeInput
 * @typedef {import('./contracts.js').ReplicaWriteResult} ReplicaWriteResult
 */

/** Owns one application's durable queue, replica head, WAL and draft checkpoints.
 * Creating an instance never reads browser storage. The composition root passes
 * the concrete browser capabilities and the current workout/setup owners.
 * snapshotPolicy is immutable validation/normalization, never a live UI host.
 * onAccepted publishes accepted data back to the application state owner.
 */
/** @param {import('./contracts.js').DurableOptions} options */
export function createDurableStore({snapshotPolicy, workout, session,
  setup, resolveCustomMutationIntent=null, onAccepted=null,
  mutationGate=null, platform=globalThis}) {
  if (!snapshotPolicy) throw new TypeError('snapshot policy required');
  const KEY = "repforge_v1";
  const DB = "repforge";
  const STORE = "kv";
  const STORAGE_REV = "_storageRevision";
  const STORAGE_FOLLOWUP = "_storageFollowUp";
  const STORAGE_DRAFT_TXN = "_storageDraftTransaction";
  const STORAGE_SETUP_TXN = "_storageSetupActivation";
  const SHARED_IMPORT = "_sharedSetupImport";
  const STORAGE_LOCK = "repforge:state-write";
  const DRAFT_WRITE_LOCK = "repforge:draft-write";
  const PENDING = "repforge_pending_v1";
  const PENDING_PREFIX = "repforge_pending_v1:";
  const PENDING_EFFECT_MAX_RAW = 1000000;

  const DRAFT = "repforge_draft_v1";
  const DRAFT_V2_CHECKPOINT = "repforge_draft_v1:v2-checkpoint";
  const DRAFT_PENDING_PREFIX = "repforge_draft_v1:pending:";
  const DRAFT_CLOSE_PREFIX = "repforge_draft_v1:closing:";
  const DRAFT_WRITE_TRANSACTION = "draft-write";

  const DRAFT_EFFECT_VALID = "valid";
  const DRAFT_EFFECT_INVALID = "invalid";
  const DRAFT_EFFECT_NONE = "none";

  const DRAFT_PRECONDITION_MATCH_ONLY = "match-only";
  const DRAFT_PRECONDITION_ABORT_CHANGED = "abort-changed";
  const DRAFT_PRECONDITION_ABORT_SAME_DAY = "abort-same-day";

  // In-memory state tracking for durable engine
  /** @type {StoredSnapshot|null} */
  let persistHead = null;
  let writeTail = Promise.resolve();
  let mutationFreezeCheck = mutationGate;
  let pendingJournalSeq = 0, pendingJournalClock = 0;
  const pendingJournalWriterId = pendingJournalUuid();
  /** @type {import('./contracts.js').StorageHealth} */
  const storageHealth = { localOk: true, idbOk: true, degraded: false, revision: 0, lastResult: null, localFailed: false, idbFailed: false, quotaFailed: false, lastError: null };
  /** @type {Set<(result:OutcomeInput)=>void>} */
  const healthListeners = new Set();

  function getStorageHealth() {
    return Object.assign({}, storageHealth);
  }

  /** @param {(result:OutcomeInput)=>void} fn */
  function addStorageHealthListener(fn) {
    if (typeof fn === "function") healthListeners.add(fn);
    return () => healthListeners.delete(fn);
  }

  /** @param {OutcomeInput|null} [result] */
  function notifyHealthListeners(result = null) {
    const copy = getStorageHealth();
    for (const listener of healthListeners) {
      try { listener(result || copy); } catch (e) { /* suppress listener error */ }
    }
  }

  /** @param {(()=>boolean)|null} fn */
  function setMutationFreezeCheck(fn) {
    mutationFreezeCheck = typeof fn === "function" ? fn : null;
  }

  function isMutationFrozen() {
    return mutationFreezeCheck ? !!mutationFreezeCheck() : false;
  }

  const {cloneSnapshot,isPlainStateObject,readRevision,unversionedSnapshot,
    stripStorageMeta,exportableState,canonicalize,canonicalPayload,
    mirrorComparisonSnapshot,snapshotsEqual,storageSnapshotsEqual,
    snapshotBlockId,draftProgramFingerprint,rebaseStateChange,
    isValidBlockId,isValidRecoveryTransitions,isBoundedTransitionValue,
    draftEffectOutcome,normalizeDraftEffectOutcome,pendingJournalEffect,
    draftEffectRequiresCoordination,
    draftContextFingerprint}=Snapshot;
  /** Runtime validators establish these exact released transition fields. */
  const isCoherentV1TransitionIn=/** @type {(value:unknown)=>value is import('./contracts.js').TransitionIn} */(Snapshot.isCoherentV1TransitionIn);
  const isCoherentV1TransitionOut=/** @type {(value:unknown)=>value is import('./contracts.js').TransitionOut} */(Snapshot.isCoherentV1TransitionOut);
  /** @param {unknown} snapshot @returns {snapshot is StoredSnapshot} */
  function isValidStateShape(snapshot) { return snapshotPolicy.isValidStateShape(snapshot); }
  /** @returns {StoredSnapshot|null} */
  function currentStateSnapshot(){return session?.getState?.() ?? persistHead}
  function workoutDraft(){return workout}
  /** @param {string|null} raw @param {string} reason */
  function retainDraftRecovery(raw,reason){
    try { platform.localStorage.setItem('repforge_draft_v1:recovery',JSON.stringify({version:1,reason,raw})); } catch {}
    session?.onDraftRecovery?.({raw,reason});
  }
  /** @param {string} point */
  function workoutDraftFault(point){
    if(platform.__repforgeDraftFault!==point)return false;
    platform.__repforgeDraftFault=null;return true;
  }
  /** @param {import('./contracts.js').DraftIdentity & {writer:{operationId:string}}} draft @param {string} raw @param {string} [operationId] @returns {import('./contracts.js').V2Committed} */
  function v2CheckpointRecord(draft,raw,operationId=draft.writer.operationId){
    return{version:1,kind:"committed",draftId:draft.draftId,revision:draft.revision,operationId,
      programFingerprint:draft.program.programFingerprint,raw}}
  /** @param {string|null} currentRaw @param {string|null} nextRaw @param {string} operationId @param {{previous?:import('./contracts.js').V2Record|null}} [options] @returns {import('./contracts.js').CheckpointPreparation} */
  function prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,{previous:previousOverride}={}){
    const current=workoutDraft()?.parse(currentRaw),next=workoutDraft()?.parse(nextRaw),checkpoint=DraftStore.readV2Checkpoint();
    if(checkpoint.status==="invalid"||checkpoint.status==="read-failed")return{ok:false,reason:"checkpoint-unreadable"};
    if(nextRaw===currentRaw)return{ok:true,kind:"none"};
    if(current?.kind==="valid"&&nextRaw===null){
      /** @type {Extract<import('./contracts.js').V2Checkpoint,{kind:'pending-removal'}>} */
      const pending={...v2CheckpointRecord(current.draft,/** @type {string} */(currentRaw),operationId),kind:"pending-removal",baseRaw:/** @type {string} */(currentRaw)};
      return DraftStore.writeV2Checkpoint(pending)?{ok:true,kind:"pending-removal",value:pending}:{ok:false,reason:"checkpoint-write"}}
    if(next?.kind!=="valid")return current?.kind==="valid"?{ok:false,reason:"v2-replacement-invalid"}:{ok:true,kind:"none"};
    const previous=previousOverride!==undefined?previousOverride:
      current?.kind==="valid"?v2CheckpointRecord(current.draft,/** @type {string} */(currentRaw)):null;
    /** @type {Extract<import('./contracts.js').V2Checkpoint,{kind:'pending'}>} */
    const pending={...v2CheckpointRecord(next.draft,/** @type {string} */(nextRaw),operationId),kind:"pending",baseRaw:currentRaw,previous};
    return DraftStore.writeV2Checkpoint(pending)?{ok:true,kind:"pending",value:pending}:{ok:false,reason:"checkpoint-write"}}
  /** @param {Exclude<import('./contracts.js').CheckpointPreparation,{ok:false}>} prepared @param {string|null} nextRaw */
  function commitV2CheckpointEffect(prepared,nextRaw){
    if(prepared.kind==="none")return true;
    if(prepared.kind==="pending-removal"){
      if(nextRaw!==null)return false;
      const removed=workoutDraft()?.parse(prepared.value.raw);
      return removed?.kind==="valid"&&DraftStore.writeV2Checkpoint(
        DraftStore.v2Tombstone(removed.draft,prepared.value.operationId))}
    const next=workoutDraft()?.parse(nextRaw);
    return next?.kind==="valid"&&DraftStore.writeV2Checkpoint(v2CheckpointRecord(next.draft,/** @type {string} */(nextRaw),prepared.value.operationId))}

  /** @param {Extract<import('./contracts.js').CanonicalRead,{status:'ok'}>} read @param {string} label */
  async function reconcileV2Checkpoint(read,label){
    const checkpoint=DraftStore.readV2Checkpoint();
    if(checkpoint.status==="invalid"||checkpoint.status==="read-failed"){
      if(read.raw!=null)retainDraftRecovery(read.raw,"v2-checkpoint-unreadable");
      return{status:"checkpoint-unreadable",raw:read.raw}}
    const parser=workoutDraft(),canonical=parser?.parse(read.raw);
    if(checkpoint.status==="absent"){
      if(canonical?.kind==="valid"){
        retainDraftRecovery(read.raw,"v2-checkpoint-missing");
        return{status:"checkpoint-missing",raw:read.raw}}
      return read}
    const value=checkpoint.value;
    /** @template T @param {(current:Extract<import('./contracts.js').CanonicalRead,{status:'ok'}>)=>T|Promise<T>} operation */
    const underCheckpointLock=async operation=>{
      if(!platform.navigator?.locks?.request)return{status:"lock-unavailable",raw:read.raw};
      return platform.navigator?.locks.request(STORAGE_LOCK,()=>withDraftWriteLock(async()=>{
        const current=DraftStore.readCanonicalStatus(),currentCheckpoint=DraftStore.readV2Checkpoint();
        if(current.status!=="ok")return current;
        if(current.raw!==read.raw||currentCheckpoint.raw!==checkpoint.raw)
          return{status:"stale-recovery",raw:current.raw};
        return operation(current)}))};
    /** @param {string} reason @param {import('./contracts.js').DraftIdentity} draft */
    const clearProtected=async(reason,draft)=>{
      if(read.raw!=null)retainDraftRecovery(read.raw,reason);
      return underCheckpointLock(current=>{
        const tombstone=DraftStore.v2Tombstone(draft,`remove-${pendingJournalUuid()}`);
        if(!DraftStore.writeV2Checkpoint(tombstone)||!DraftStore.publishCanonical(null))
          return{status:"recovery-write-failed",raw:current.raw};
        return{status:"ok",raw:null}})};
    if(value.kind==="tombstone"){
      if(read.raw==null)return read;
      const markerDraft={draftId:value.draftId,revision:value.revision,
        program:{programFingerprint:value.programFingerprint}};
      return clearProtected("canonical-after-v2-removal",markerDraft)}
    // readV2Checkpoint already validates every non-tombstone raw value. Keep
    // that discriminant explicit at this consumer rather than treating every
    // parse result as a valid aggregate.
    const checkpointParsed=parser.parse(value.raw);
    if(checkpointParsed.kind!=="valid")return{status:"checkpoint-unreadable",raw:read.raw};
    if((currentStateSnapshot()?.log||[]).some(row=>row?.session===value.draftId)){
      const savedDraft=checkpointParsed.draft;
      if(!savedDraft)return{status:"checkpoint-unreadable",raw:read.raw};
      return clearProtected("canonical-after-saved-v2",savedDraft)}
    if(value.kind==="pending-removal"&&read.raw===value.raw){
      return underCheckpointLock(()=>DraftStore.writeV2Checkpoint(v2CheckpointRecord(
        checkpointParsed.draft,value.raw,value.operationId))?read:
        {status:"checkpoint-rollback-failed",raw:read.raw})}
    if(value.kind==="pending-removal"&&read.raw==null){
      return underCheckpointLock(()=>DraftStore.writeV2Checkpoint(DraftStore.v2Tombstone(
        checkpointParsed.draft,value.operationId))?read:
        {status:"checkpoint-commit-failed",raw:read.raw})}
    const protectedValue=value.kind==="committed"||value.kind==="pending-removal"?value:value.previous;
    const protectedParsed=protectedValue?parser?.parse(protectedValue.raw):null;
    if(protectedValue&&protectedParsed?.kind!=="valid")return{status:"checkpoint-unreadable",raw:read.raw};
    if(value.kind==="pending"&&read.raw===value.raw){
      return underCheckpointLock(()=>DraftStore.writeV2Checkpoint(v2CheckpointRecord(
        checkpointParsed.draft,value.raw,value.operationId))?read:
        {status:"checkpoint-commit-failed",raw:read.raw})}
    if(value.kind==="pending"&&read.raw===value.baseRaw){
      if(value.previous&&read.raw===value.previous.raw){
        return underCheckpointLock(()=>DraftStore.writeV2Checkpoint({.../** @type {import('./contracts.js').V2Record} */(value.previous),kind:"committed"})
          ?read:{status:"checkpoint-rollback-failed",raw:read.raw})}
      if(!value.previous)return underCheckpointLock(current=>{
        const prepared=prepareV2CheckpointEffect(current.raw,value.raw,value.operationId,{previous:null});
        if(!prepared.ok||!DraftStore.publishCanonical(value.raw)||!commitV2CheckpointEffect(prepared,value.raw))
          return{status:"recovery-write-failed",raw:current.raw};
        return{status:"ok",raw:value.raw}})}
    if(!protectedValue||protectedParsed?.kind!=="valid"){
      retainDraftRecovery(read.raw,"orphaned-v2-pending");
      return{status:"checkpoint-conflict",raw:read.raw}}
    return underCheckpointLock(async current=>{
      // The checkpoint may be unchanged while a different tab commits a new
      // program head. Validate against the selected replicas under both locks.
      const head=chooseSnapshot(readLocalStatus(),await readIdbStatus());
      if(head.kind!=='chosen'||pendingDraftTransaction(head.snapshot)||hasPendingJournal()||
        head.snapshot.log.some(row=>row?.session===protectedParsed.draft.draftId))
        return{status:'stale-recovery',raw:current.raw};
      const protectedDraft=parser.parse(protectedValue.raw,
        Snapshot.workoutParseContextForSnapshot(head.snapshot,protectedParsed.draft.program.dayLabel||label));
      if(protectedDraft.kind!=='valid'){
        retainDraftRecovery(current.raw,protectedDraft.kind==='stale'?`stale-${protectedDraft.reason}`:'code' in protectedDraft?protectedDraft.code:'checkpoint-unreadable');
        return{status:'stale-recovery',error:protectedDraft,raw:current.raw}}
      if(current.raw!==protectedValue.raw)retainDraftRecovery(current.raw,'superseded-v2-canonical');
      const operationId=`recover-${pendingJournalUuid()}`;
      const prepared=prepareV2CheckpointEffect(current.raw,protectedValue.raw,operationId,{previous:protectedValue});
      if(!prepared.ok||!DraftStore.publishCanonical(protectedValue.raw)||
        !commitV2CheckpointEffect(prepared,protectedValue.raw))return{status:"recovery-write-failed",raw:current.raw};
      return{status:"ok",raw:protectedValue.raw}})}

  const DraftStore={
    readCanonicalRaw(){
      try{return platform.localStorage.getItem(DRAFT)}
      catch{return null}},
    /** @returns {import('./contracts.js').CanonicalRead} */
    readCanonicalStatus(){
      try{return{status:"ok",raw:platform.localStorage.getItem(DRAFT)}}
      catch(error){return{status:"read-failed",error}}},
    /** @returns {import('./contracts.js').CheckpointRead} */
    readV2Checkpoint(){
      try{const raw=platform.localStorage.getItem(DRAFT_V2_CHECKPOINT);if(raw==null)return{status:"absent",raw:null};
        /** @type {unknown} */
        const value=JSON.parse(raw);
        if(!isPlainStateObject(value)||value.version!==1||!["pending","pending-removal","committed","tombstone"].includes(/** @type {string} */(value.kind))||
          typeof value.draftId!=="string"||!value.draftId||value.draftId.length>240||
          !Number.isSafeInteger(value.revision)||/** @type {number} */(value.revision)<0||
          typeof value.operationId!=="string"||!value.operationId||value.operationId.length>240||
          typeof value.programFingerprint!=="string"||!value.programFingerprint||value.programFingerprint.length>2000||
          (value.kind!=="tombstone"&&(typeof value.raw!=="string"||value.raw.length>PENDING_EFFECT_MAX_RAW)))
          return{status:"invalid",raw};
        /** @param {unknown} record @returns {record is import('./contracts.js').V2Record} */
        const validRecord=record=>{const parsed=workoutDraft()?.parse(isPlainStateObject(record)?record.raw:null);
          return isPlainStateObject(record)&&typeof record.draftId==="string"&&Number.isSafeInteger(record.revision)&&
            typeof record.operationId==="string"&&typeof record.programFingerprint==="string"&&parsed?.kind==="valid"&&
            parsed.draft.draftId===record.draftId&&parsed.draft.revision===record.revision};
        if(value.kind!=="tombstone"&&!validRecord(value))return{status:"invalid",raw};
        if(value.kind==="pending"&&
          (!(value.baseRaw===null||typeof value.baseRaw==="string"&&value.baseRaw.length<=PENDING_EFFECT_MAX_RAW)||
            value.previous!=null&&!validRecord(value.previous)))
          return{status:"invalid",raw};
        if(value.kind==="pending-removal"&&value.baseRaw!==value.raw)return{status:"invalid",raw};
        return{status:"valid",raw,value:/** @type {import('./contracts.js').V2Checkpoint} */(value)}}
      catch(error){return{status:"read-failed",raw:null,error}}},
    /** @param {import('./contracts.js').V2Checkpoint} value */
    writeV2Checkpoint(value){
      if(installTransferMutationFrozen())return false;
      try{platform.localStorage.setItem(DRAFT_V2_CHECKPOINT,JSON.stringify(value));return true}
      catch{return false}},
    /** @param {import('./contracts.js').DraftIdentity} draft @param {string} operationId @returns {Extract<import('./contracts.js').V2Checkpoint,{kind:'tombstone'}>} */
    v2Tombstone(draft,operationId){return{version:1,kind:"tombstone",draftId:draft.draftId,
      revision:draft.revision,operationId,programFingerprint:draft.program.programFingerprint}},
    /** @param {{expectedRaw?:string|null;expectedDraftId?:string;expectedRevision?:number;nextRaw:string;operationId:string}} options */
    async compareAndSwapV2({expectedRaw,expectedDraftId,expectedRevision,nextRaw,operationId}){
      if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
      if(!platform.navigator?.locks?.request)return{status:"lock-unavailable"};
      if(typeof nextRaw!=="string"||nextRaw.length>PENDING_EFFECT_MAX_RAW)
        return{status:"invalid-next"};
      const candidate=workoutDraft()?.parse(nextRaw);if(candidate?.kind!=="valid")return{status:"invalid-next"};
      // Staged writers take only the draft lock. Canonical writers and state
      // transaction settlement take the state lock before the draft lock.
      /** @param {{id:string}} target */
      const stageFor=target=>{if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
        const currentRaw=this.readRaw(),current=workoutDraft()?.parse(currentRaw);
        if(expectedRaw!==undefined?currentRaw!==expectedRaw:
          current?.kind!=="valid"||current.draft.draftId!==expectedDraftId||current.draft.revision!==expectedRevision)
          return{status:"stale",raw:currentRaw,draft:current?.kind==="valid"?current.draft:undefined};
        if(current?.kind==="valid"){
          const checkpoint=this.readV2Checkpoint();
          const context=draftContextFingerprint(currentStateSnapshot());
          const latestSidecar=this.pending().entries.filter(entry=>entry.value.programFingerprint===context).at(-1);
          const staged=latestSidecar?.value.raw===currentRaw;
          if(checkpoint.status==="absent"){
            const canonical=this.readCanonicalStatus();
            if(!staged||canonical.status!=="ok"||canonical.raw!==null)
              return{status:"checkpoint-missing",raw:currentRaw};}
          else if(checkpoint.status!=="valid")return{status:"checkpoint-unreadable",raw:currentRaw};
          else if(checkpoint.value.kind==="committed"){
            const authoritative=workoutDraft()?.parse(checkpoint.value.raw);
            if(checkpoint.value.raw!==currentRaw&&(!staged||authoritative?.kind!=="valid"||
              authoritative.draft.draftId!==current.draft.draftId||
              authoritative.draft.revision>=current.draft.revision)){
              if(authoritative?.kind==="valid"&&authoritative.draft.draftId!==current.draft.draftId||
                authoritative?.kind==="valid"&&authoritative.draft.revision>current.draft.revision)
                return{status:"stale",raw:checkpoint.value.raw,draft:authoritative.draft};
              return{status:"checkpoint-conflict",raw:checkpoint.value.raw,draft:authoritative?.kind==="valid"?authoritative.draft:undefined};}}
          else if(checkpoint.value.kind==="pending"&&checkpoint.value.operationId===operationId){
            if(checkpoint.value.raw!==nextRaw)return{status:"operation-conflict",raw:currentRaw};
            if(currentRaw!==checkpoint.value.baseRaw&&currentRaw!==checkpoint.value.raw)
              return{status:"checkpoint-conflict",raw:currentRaw};}
          else if(checkpoint.value.kind==="tombstone"&&staged){}
          else return{status:"checkpoint-conflict",raw:currentRaw};}
        if(!this.stage(target,nextRaw))return{status:"stage-failed"};
        const acceptedRaw=this.readRaw();
        if(acceptedRaw!==nextRaw){
          const accepted=workoutDraft()?.parse(acceptedRaw);
          return{status:"stale",raw:acceptedRaw,draft:accepted?.kind==="valid"?accepted.draft:undefined};}
        return{status:"applied",raw:nextRaw,draft:candidate.draft,staged:true}};
      const target=this.writeTarget();
      if(target){
        const staged=await withDraftWriteLock(()=>{
          const currentTarget=this.writeTarget();
          return currentTarget?stageFor(currentTarget):null});
        if(staged)return staged;}
      return platform.navigator?.locks.request(STORAGE_LOCK,()=>withDraftWriteLock(async()=>{
        if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
        const queuedTarget=this.writeTarget();if(queuedTarget)return stageFor(queuedTarget);
        const read=this.readCanonicalStatus();
        if(read.status!=="ok")return read;
        if(expectedRaw!==undefined){
          if(read.raw!==expectedRaw)return{status:"stale",raw:read.raw}}
        else{
          const live=workoutDraft()?.parse(read.raw);
          if(live?.kind!=="valid")return{status:live?.kind==="absent"?"missing":"invalid-live",raw:read.raw};
          if(live.draft.writer.operationId!==operationId&&
            (live.draft.draftId!==expectedDraftId||live.draft.revision!==expectedRevision))
            return{status:"stale",raw:read.raw,draft:live.draft}}
        const next=candidate;
        const priorCheckpoint=this.readV2Checkpoint();
        if(priorCheckpoint.status!=="valid"&&priorCheckpoint.status!=="absent")return{status:"checkpoint-unreadable"};
        const liveParsed=workoutDraft()?.parse(read.raw);
        if(priorCheckpoint.value?.kind==="pending"&&priorCheckpoint.value.operationId===operationId){
          if(priorCheckpoint.value.raw!==nextRaw)return{status:"operation-conflict",raw:read.raw};
          if(read.raw===priorCheckpoint.value.raw){
            if(!this.writeV2Checkpoint(v2CheckpointRecord(next.draft,/** @type {string} */(nextRaw),operationId)))
              return{status:"checkpoint-commit-failed",raw:read.raw,draft:next.draft};
            return{status:"applied",raw:read.raw,draft:next.draft,idempotent:true}}
          if(read.raw===priorCheckpoint.value.baseRaw){
            if(!this.publishCanonical(nextRaw))return{status:"write-failed"};
            const verify=this.readCanonicalStatus();
            if(verify.status!=="ok")return verify;
            if(verify.raw!==nextRaw)return{status:"readback-mismatch",raw:verify.raw};
            if(!this.writeV2Checkpoint(v2CheckpointRecord(next.draft,/** @type {string} */(nextRaw),operationId)))
              return{status:"checkpoint-commit-failed",raw:verify.raw,draft:next.draft};
            return{status:"applied",raw:verify.raw,draft:next.draft,idempotent:true}}
          return{status:"checkpoint-conflict",raw:read.raw}}
        if(liveParsed?.kind==="valid"){
          if(priorCheckpoint.value?.kind!=="committed"||priorCheckpoint.value.raw!==read.raw)
            return{status:priorCheckpoint.status==="absent"?"checkpoint-missing":"checkpoint-conflict",raw:read.raw};}
        if(liveParsed?.kind==="valid"&&liveParsed.draft.writer.operationId===operationId)
          return nextRaw===read.raw?{status:"applied",raw:read.raw,draft:liveParsed.draft,idempotent:true}:
            {status:"operation-conflict",raw:read.raw};
        else if(liveParsed?.kind==="legacy"&&priorCheckpoint.status!=="absent")
          return{status:"checkpoint-conflict",raw:read.raw};
        else if(liveParsed?.kind==="absent"&&priorCheckpoint.status==="valid"&&priorCheckpoint.value.kind!=="tombstone")
          return{status:"checkpoint-conflict",raw:read.raw};
        const previous=liveParsed?.kind==="valid"?v2CheckpointRecord(liveParsed.draft,/** @type {string} */(read.raw)):null;
        /** @type {Extract<import('./contracts.js').V2Checkpoint,{kind:'pending'}>} */
        const checkpoint={version:1,kind:"pending",draftId:next.draft.draftId,revision:next.draft.revision,
          operationId,programFingerprint:next.draft.program.programFingerprint,raw:nextRaw,baseRaw:read.raw,previous};
        if(!this.writeV2Checkpoint(checkpoint))return{status:"checkpoint-failed"};
        if(workoutDraftFault("before-canonical-write"))return{status:"fault-before-canonical"};
        if(!this.publishCanonical(nextRaw))return{status:"write-failed"};
        const verify=this.readCanonicalStatus();
        if(verify.status!=="ok")return verify;
        if(verify.raw!==nextRaw)return{status:"readback-mismatch",raw:verify.raw};
        const parsed=workoutDraft()?.parse(verify.raw);
        if(parsed?.kind!=="valid")return{status:"invalid-readback",raw:verify.raw};
        if(workoutDraftFault("after-canonical-write"))return{status:"fault-after-canonical",raw:verify.raw,draft:parsed.draft};
        if(!this.writeV2Checkpoint(v2CheckpointRecord(parsed.draft,verify.raw,operationId)))
          return{status:"checkpoint-commit-failed",raw:verify.raw,draft:parsed.draft};
        return{status:"applied",raw:verify.raw,draft:parsed.draft}
      }))},
    /** @param {{expectedDraftId:string;expectedRevision:number;operationId:string}} options */
    async removeV2({expectedDraftId,expectedRevision,operationId}){
      if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
      if(!platform.navigator?.locks?.request)return{status:"lock-unavailable"};
      return platform.navigator?.locks.request(STORAGE_LOCK,async()=>{
        if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
        if(this.writeTarget())return{status:"transaction-active"};
        const read=this.readCanonicalStatus();if(read.status!=="ok")return read;
        const live=workoutDraft()?.parse(read.raw);
        if(live?.kind!=="valid")return{status:live?.kind==="absent"?"missing":"invalid-live",raw:read.raw};
        if(live.draft.draftId!==expectedDraftId||live.draft.revision!==expectedRevision)
          return{status:"stale",raw:read.raw,draft:live.draft};
        const checkpoint=this.readV2Checkpoint();
        if(checkpoint.status!=="valid"||checkpoint.value.kind!=="committed"||checkpoint.value.raw!==read.raw)
          return{status:checkpoint.status==="absent"?"checkpoint-missing":"checkpoint-conflict",raw:read.raw};
        const prepared=prepareV2CheckpointEffect(read.raw,null,operationId);
        if(!prepared.ok)return{status:prepared.reason};
        if(workoutDraftFault("before-canonical-remove"))return{status:"fault-before-canonical"};
        if(!this.publishCanonical(null))return{status:"write-failed"};
        const verify=this.readCanonicalStatus();if(verify.status!=="ok")return verify;
        if(verify.raw!==null)return{status:"readback-mismatch",raw:verify.raw};
        if(workoutDraftFault("after-canonical-remove"))return{status:"fault-after-canonical"};
        if(!commitV2CheckpointEffect(prepared,null))return{status:"checkpoint-commit-failed"};
        return{status:"applied",raw:null,draft:live.draft}
      })},
    /* A legacy flat draft (pre-DraftV2) has no draftId/revision to CAS on, and
       the V2 checkpoint protocol never ran for it, so clearing it is an exact
       raw-byte compare-and-swap to null rather than removeV2's identity CAS.
       A live V2-valid raw, or any checkpoint beyond "absent", is refused: those
       belong to removeV2 and reconcileV2Checkpoint respectively, and this path
       must never clobber state it does not own. */
    /** @param {{expectedRaw:string;operationId:string}} options */
    async removeLegacy({expectedRaw,operationId}){
      if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
      if(!platform.navigator?.locks?.request)return{status:"lock-unavailable"};
      return platform.navigator?.locks.request(STORAGE_LOCK,async()=>{
        if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
        if(this.writeTarget())return{status:"transaction-active"};
        const read=this.readCanonicalStatus();if(read.status!=="ok")return read;
        if(read.raw!==expectedRaw)return{status:"stale",raw:read.raw};
        const live=workoutDraft()?.parse(read.raw);
        if(live?.kind==="valid")return{status:"invalid-live",raw:read.raw};
        const checkpoint=this.readV2Checkpoint();
        if(checkpoint.status!=="absent")return{status:checkpoint.status==="valid"?"checkpoint-conflict":"checkpoint-unreadable",raw:read.raw};
        if(workoutDraftFault("before-canonical-remove"))return{status:"fault-before-canonical"};
        if(!this.publishCanonical(null))return{status:"write-failed"};
        const verify=this.readCanonicalStatus();if(verify.status!=="ok")return verify;
        if(verify.raw!==null)return{status:"readback-mismatch",raw:verify.raw};
        return{status:"applied",raw:null}
      })},
    /** @param {string|null} raw */
    publishCanonical(raw){
      if(installTransferMutationFrozen())return false;
      if(raw!==null&&typeof raw!=="string")return false;
      try{
        if(raw===null)platform.localStorage.removeItem(DRAFT);
        else platform.localStorage.setItem(DRAFT,raw);
        return true}
      catch{return false}},
    /** @param {string|null} [transactionId] @returns {string[]} */
    sidecarKeys(transactionId=null){
      const keys=[],prefix=transactionId==null?DRAFT_PENDING_PREFIX:`${DRAFT_PENDING_PREFIX}${transactionId}:`;
      try{for(let i=0;i<platform.localStorage.length;i++){
        const key=platform.localStorage.key(i);
        if(key?.startsWith(prefix))keys.push(key)}}
      catch{}
      return[...new Set(keys)].sort()},
    /** @param {string} key @param {string} raw @returns {import('./contracts.js').PendingDraftSidecar|null} */
    decodeSidecar(key,raw){
      try{
        /** @type {unknown} */
        const value=JSON.parse(raw),order=/** @type {{order?:{at?:unknown,writer?:unknown,seq?:unknown}}|null|undefined} */(value)?.order;
        if(!isPlainStateObject(value)||value.version!==1||typeof value.transactionId!=="string"||
          !value.transactionId||typeof value.writer!=="string"||!value.writer||
          key!==`${DRAFT_PENDING_PREFIX}${value.transactionId}:${value.writer}`||
          !(value.raw===null||typeof value.raw==="string"&&value.raw.length<=PENDING_EFFECT_MAX_RAW)||
          typeof value.programFingerprint!=="string"||
          !Number.isSafeInteger(order?.at)||typeof order?.writer!=="string"||
          !Number.isSafeInteger(order?.seq))return null;
        return{key,raw,value:/** @type {import('./contracts.js').DraftSidecar} */(value)}}
      catch{return null}},
    /** @param {string|null} [transactionId] @returns {{entries:import('./contracts.js').PendingDraftSidecar[],invalid:import('./contracts.js').InvalidJournal[]}} */
    pending(transactionId=null){
      const entries=[],invalid=[];
      for(const key of this.sidecarKeys(transactionId)){
        let raw;
        try{raw=platform.localStorage.getItem(key)}catch{continue}
        if(raw==null)continue;
        const entry=this.decodeSidecar(key,raw);
        if(!entry)invalid.push({key,raw});
        else if(transactionId==null||entry.value.transactionId===transactionId)entries.push(entry)}
      entries.sort((a,b)=>a.value.order.at-b.value.order.at||
        a.value.order.writer.localeCompare(b.value.order.writer)||
        a.value.order.seq-b.value.order.seq||a.key.localeCompare(b.key));
      return{entries,invalid}},
    /** @param {string|null} [transactionId] @param {string|null} [contextFingerprint] */
    related(transactionId=null,contextFingerprint=null){
      const pending=this.pending();
      const entries=pending.entries.filter(entry=>
        transactionId!=null&&entry.value.transactionId===transactionId||
        contextFingerprint!=null&&entry.value.programFingerprint===contextFingerprint);
      const invalid=transactionId==null?[]:pending.invalid.filter(entry=>
        entry.key.startsWith(`${DRAFT_PENDING_PREFIX}${transactionId}:`));
      return{entries,invalid}},
    /** @returns {string[]} */
    closingIds(){
      const ids=[];
      try{for(let i=0;i<platform.localStorage.length;i++){
        const key=platform.localStorage.key(i);
        if(key?.startsWith(DRAFT_CLOSE_PREFIX)&&key.length>DRAFT_CLOSE_PREFIX.length)
          ids.push(key.slice(DRAFT_CLOSE_PREFIX.length))}}
      catch{}
      return[...new Set(ids)].sort()},
    /** @param {string} transactionId */
    isClosing(transactionId){
      try{return platform.localStorage.getItem(DRAFT_CLOSE_PREFIX+transactionId)!=null}
      catch{return false}},
    /** @param {string} transactionId */
    beginClose(transactionId){
      if(installTransferMutationFrozen())return false;
      if(typeof transactionId!=="string"||!transactionId)return false;
      try{
        platform.localStorage.setItem(DRAFT_CLOSE_PREFIX+transactionId,
          JSON.stringify({version:1,transactionId,writer:getJournalWriterId()}));
        return true}
      catch{return false}},
    /** @param {string} transactionId */
    transactionOwned(transactionId){
      if(this.isClosing(transactionId))return true;
      const local=readLocalStatus();
      const transaction=local.status==="valid"?pendingDraftTransaction(local.parsed):null;
      if(transaction?.id===transactionId)return true;
      return readPendingJournal().entries.some(record=>record.journal.id===transactionId)},
    writeTarget(){
      const closing=this.closingIds()[0];
      if(closing)return{id:closing};
      if(!hasPendingJournal())return null;
      const local=readLocalStatus();
      const transaction=local.status==="valid"?pendingDraftTransaction(local.parsed):null;
      if(transaction)return{id:transaction.id};
      // Any durable-state journal can reach a lock-held preflight that depends
      // on workout progress (for example, reducing a set count that was safe
      // when clicked). Stage draft writes behind the oldest journal so that
      // preflight sees and either rejects or reconciles them before state lands.
      const next=readPendingJournal().entries[0];
      return next?{id:next.journal.id}:null},
    /** @param {string} transactionId @param {string|null} raw */
    writeSidecar(transactionId,raw){
      if(installTransferMutationFrozen())return false;
      if(typeof transactionId!=="string"||!transactionId||
        !(raw===null||typeof raw==="string"&&raw.length<=PENDING_EFFECT_MAX_RAW))return false;
      const writer=getJournalWriterId();
      const order=pendingJournalOrder(),latestAt=this.pending().entries.reduce(
        (latest,entry)=>Math.max(latest,entry.value.order.at),0);
      if(latestAt>=order.at){
        if(latestAt>=Number.MAX_SAFE_INTEGER)return false;
        order.at=latestAt+1;
        pendingJournalClock=Math.max(pendingJournalClock,order.at)}
      const key=`${DRAFT_PENDING_PREFIX}${transactionId}:${writer}`;
      const value={version:1,transactionId,writer,order,
        programFingerprint:draftContextFingerprint(currentStateSnapshot()),raw};
      try{
        const encoded=JSON.stringify(value);
        platform.localStorage.setItem(key,encoded);
        return this.decodeSidecar(key,encoded)}
      catch{return false}},
    /** @param {{id:string}} target @param {string|null} raw */
    stage(target,raw){
      if(installTransferMutationFrozen())return false;
      if(!target||typeof target.id!=="string")return false;
      if(!this.writeSidecar(target.id,raw))return false;
      if(!this.transactionOwned(target.id))return this.promoteUnlocked(target.id).settled;
      return true},
    readRaw(){
      const contextFingerprint=draftContextFingerprint(currentStateSnapshot());
      const queued=this.pending().entries.filter(entry=>
        entry.value.programFingerprint===contextFingerprint).at(-1);
      return queued?queued.value.raw:this.readCanonicalRaw()},
    /** @param {string|null} raw */
    publish(raw){
      if(installTransferMutationFrozen())return false;
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
    /** @param {string} raw */
    write(raw){return typeof raw==="string"&&this.publish(raw)},
    remove(){return this.publish(null)},
    /** @param {import('./contracts.js').PendingDraftSidecar|import('./contracts.js').InvalidJournal} entry */
    clearSidecar(entry){
      if(installTransferMutationFrozen())return false;
      try{
        if(platform.localStorage.getItem(entry.key)===entry.raw)platform.localStorage.removeItem(entry.key);
        return true}
      catch{return false}},
    /** @param {string} transactionId @param {string|null} [contextFingerprint] */
    async promote(transactionId,contextFingerprint=null){
      return withDraftWriteLock(()=>this.promoteUnlocked(transactionId,contextFingerprint))},
    /** @param {string|null} transactionId @param {string|null} [contextFingerprint] */
    promoteUnlocked(transactionId,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      const pending=this.related(transactionId,contextFingerprint);
      if(!pending.entries.length&&!pending.invalid.length)
        return{settled:true,hadWrites:false,raw:undefined};
      const latest=pending.entries.at(-1);
      let promotedRaw=latest?.value.raw;
      if(latest){
        const canonical=this.readCanonicalStatus(),current=canonical.status==="ok"?
          workoutDraft()?.parse(canonical.raw):null;
        const checkpoint=this.readV2Checkpoint(),incoming=workoutDraft()?.parse(latest.value.raw);
        const acknowledgedCanonical=canonical.status==="ok"&&current?.kind==="valid"&&
          checkpoint.status==="valid"&&checkpoint.value.kind==="committed"&&
          checkpoint.value.raw===canonical.raw;
        const superseded=acknowledgedCanonical&&incoming?.kind==="valid"&&
          (current.draft.draftId!==incoming.draft.draftId||current.draft.revision>=incoming.draft.revision);
        if(superseded){
          if(canonical.raw!==latest.value.raw)retainDraftRecovery(latest.value.raw,"superseded-v2-sidecar");
          promotedRaw=canonical.raw;
        }else{
          if(!this.publishCanonical(latest.value.raw))return{settled:false,hadWrites:true,raw:latest.value.raw};
          if(incoming?.kind==="valid"&&!this.writeV2Checkpoint(v2CheckpointRecord(incoming.draft,/** @type {string} */(latest.value.raw))))
            return{settled:false,hadWrites:true,raw:latest.value.raw}}}
      for(const entry of pending.entries){if(!this.clearSidecar(entry))return{settled:false,hadWrites:true,transferFrozen:true,code:"install-transfer-frozen"}}
      for(const invalid of pending.invalid){
        if(installTransferMutationFrozen())return{settled:false,hadWrites:true,transferFrozen:true,code:"install-transfer-frozen"};
        try{if(platform.localStorage.getItem(invalid.key)===invalid.raw)platform.localStorage.removeItem(invalid.key)}
        catch{}}
      const remaining=this.related(transactionId,contextFingerprint);
      return{settled:remaining.entries.length===0&&remaining.invalid.length===0,
        hadWrites:true,raw:promotedRaw}},
    /** @param {string|null} transactionId @param {import('./contracts.js').EffectInput} effect @param {string|null} [contextFingerprint] */
    restoreEffect(transactionId,effect,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      const promoted=this.promoteUnlocked(transactionId,contextFingerprint);
      if(!promoted.settled)return promoted;
      const outcome=normalizeDraftEffectOutcome(effect);
      if(outcome.status!==DRAFT_EFFECT_VALID)return promoted;
      const receipt=outcome.effect;
      const appliedRaw=receipt.kind==="clear-draft"?null:receipt.replacementRaw;
      const current=this.readCanonicalStatus();
      if(current.status!=="ok")return{settled:false,hadWrites:false,raw:receipt.expectedRaw};
      const checkpoint=this.readV2Checkpoint();
      const currentDraft=workoutDraft()?.parse(current.raw),expectedDraft=workoutDraft()?.parse(receipt.expectedRaw);
      const acknowledgedSuccessor=checkpoint.status==="valid"&&checkpoint.value.kind==="committed"&&
        checkpoint.value.raw===current.raw&&currentDraft?.kind==="valid"&&
        (expectedDraft?.kind!=="valid"||currentDraft.draft.draftId!==expectedDraft.draft.draftId||
          currentDraft.draft.revision>expectedDraft.draft.revision);
      // A sidecar produced by the V2 adapter is a real acknowledged successor.
      // A legacy tab can only preserve the same nested V2 revision while adding
      // flat fields, or publish an unsupported flat draft. Keep the successor;
      // roll the legacy bytes into recovery below.
      if(acknowledgedSuccessor)return promoted;
      const writeAfterRemoval=checkpoint.status==="valid"&&checkpoint.value.kind==="tombstone"&&current.raw!=null;
      if((promoted.hadWrites||writeAfterRemoval)&&current.raw!==receipt.expectedRaw){
        if(current.raw!=null)retainDraftRecovery(current.raw,"draft-write-during-rollback");
        const prepared=prepareV2CheckpointEffect(current.raw,receipt.expectedRaw,`rollback-${transactionId}`);
        if(!prepared.ok||!this.publishCanonical(receipt.expectedRaw)||
          !commitV2CheckpointEffect(prepared,receipt.expectedRaw))
          return{settled:false,hadWrites:true,raw:receipt.expectedRaw};
        return{settled:true,hadWrites:true,raw:receipt.expectedRaw}}
      if(current.raw!==appliedRaw){
        if(current.raw===receipt.expectedRaw){
          const expected=workoutDraft()?.parse(receipt.expectedRaw);
          if(expected?.kind==="valid"&&!this.writeV2Checkpoint(v2CheckpointRecord(
            expected.draft,/** @type {string} */(receipt.expectedRaw),`rollback-${transactionId}`)))
            return{settled:false,hadWrites:false,raw:receipt.expectedRaw}}
        return promoted}
      const prepared=prepareV2CheckpointEffect(appliedRaw,receipt.expectedRaw,`rollback-${transactionId}`);
      if(!prepared.ok)return{settled:false,hadWrites:false,raw:receipt.expectedRaw};
      const published=this.publishCanonical(receipt.expectedRaw);
      return{settled:published&&commitV2CheckpointEffect(prepared,receipt.expectedRaw),hadWrites:false,raw:receipt.expectedRaw}},
    /** @param {string} transactionId */
    endClose(transactionId,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      try{platform.localStorage.removeItem(DRAFT_CLOSE_PREFIX+transactionId)}
      catch{return{settled:false,hadWrites:false}}
      return this.promoteUnlocked(transactionId,contextFingerprint)}
  };

  function installTransferMutationFrozen() {
    return isMutationFrozen();
  }

  /** @param {StoredSnapshot|null} snapshot */
  async function settleOrphanDraftArtifacts(snapshot){
    return withDraftWriteLock(async()=>{
    const activeTransaction=pendingDraftTransaction(snapshot);
    const journalIds=new Set(readPendingJournal().entries.map(record=>record.journal.id));
    const pending=DraftStore.pending();
    const transactionIds=new Set([
      ...DraftStore.closingIds(),
      ...pending.entries.map(entry=>entry.value.transactionId)
    ]);
    let settled=true;
    for(const transactionId of transactionIds){
      if(activeTransaction?.id===transactionId||journalIds.has(transactionId))continue;
      if(DraftStore.endClose(transactionId).settled!==true)settled=false}
    return{settled}})}

  function readSetupDraftRaw(){return setup.readRaw()}
  /** @param {StoredSnapshot} snapshot @param {StoredSnapshot} head @param {string|null} seed */
  function rebaseSharedSetupSnapshot(snapshot,head,seed){return setup.rebase(snapshot,head,seed)}
  /** @param {StoredSnapshot} base @param {StoredSnapshot} snapshot */
  function applyAcceptedSnapshot(base,snapshot){onAccepted?.(base,snapshot)}
  /** @param {StoredSnapshot} snapshot @param {string} source @param {{priorQuarantine?:import('./snapshot.js').RecoveryQuarantine[]}} [options] */
  function normalizeRecoveryCarrierSnapshot(snapshot,source,options){
    return snapshotPolicy.normalizeRecoveryCarrierSnapshot(snapshot,source,options)}
  /** @param {StoredSnapshot|null} snapshot */
  function blockStartDraftGuard(snapshot){return session.blockStartGuard(snapshot)}

  // --- IndexedDB Primitives ---
  /** @returns {Promise<IDBDatabase>} */
  function openIdb() {
    return new Promise((resolve, reject) => {
      if (typeof platform.indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = platform.indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("idb open failed"));
    });
  }
  const idbOpen = openIdb;

    /** @param {string} key @returns {Promise<unknown>} */
    async function idbGet(key){const db=await idbOpen();
    try{return await new Promise((res,rej)=>{
      const tx=db.transaction(STORE,"readonly").objectStore(STORE).get(key);
      tx.onsuccess=()=>res(tx.result);tx.onerror=()=>rej(tx.error)})}
    finally{db.close()}}

    /** @param {string} key @param {unknown} val @returns {Promise<void>} */
    async function idbSet(key,val){const db=await idbOpen();
    try{return await new Promise((res,rej)=>{
      const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(val,key);
      tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
    finally{db.close()}}

    /** @param {string} key @returns {Promise<void>} */
    async function idbDel(key){const db=await idbOpen();
    try{return await new Promise((res,rej)=>{
      const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(key);
      tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
    finally{db.close()}}

  /** @param {string} key */
  function requireAuxiliaryIdbKey(key) {
    if (typeof key !== "string" || !key || key === KEY) {
      throw new TypeError("auxiliary IndexedDB key required");
    }
    return key;
  }

  /** @param {string} key */
  function readAuxiliaryIdbValue(key) {
    return idbGet(requireAuxiliaryIdbKey(key));
  }

  /** @param {string} key @param {unknown} value */
  function writeAuxiliaryIdbValue(key, value) {
    return idbSet(requireAuxiliaryIdbKey(key), value);
  }

  /** @param {string} key */
  function deleteAuxiliaryIdbValue(key) {
    return idbDel(requireAuxiliaryIdbKey(key));
  }

  // --- Replicas Status & Arbitration ---
  /** @param {string} [key] @returns {import('./contracts.js').ReplicaRead} */
  function readLocalStatus(key = KEY) {
    try {
      const raw = platform.localStorage.getItem(key);
      if (raw === null) return { status: "absent", raw: null, parsed: null };
      try {
        /** @type {unknown} */
        const parsed = JSON.parse(raw);
        if (isValidStateShape(parsed)) return {
          status: "valid", raw, parsed,
          ...(typeof snapshotPolicy.classifyRecoveryCarrier === "function"
            ? { recoveryCarrierClassification: snapshotPolicy.classifyRecoveryCarrier(parsed?.recoveryTransitions) }
            : {}),
        };
        const carrier = typeof snapshotPolicy.carrierReadStatus === "function" ? snapshotPolicy.carrierReadStatus(parsed, raw) : null;
        return carrier || { status: "invalid", raw, parsed };
      } catch {
        return { status: "invalid", raw, parsed: null };
      }
    } catch (error) {
      return { status: "failed", raw: null, parsed: null, error };
    }
  }

  /** @param {string} [key] @returns {Promise<import('./contracts.js').ReplicaRead>} */
  async function readIdbStatus(key = KEY) {
    try {
      const parsed = await idbGet(key);
      if (parsed === null || parsed === undefined) return { status: "absent", raw: null, parsed: null };
      if (isValidStateShape(parsed)) return {
        status: "valid", raw: parsed, parsed,
        ...(typeof snapshotPolicy.classifyRecoveryCarrier === "function"
          ? { recoveryCarrierClassification: snapshotPolicy.classifyRecoveryCarrier(parsed?.recoveryTransitions) }
          : {}),
      };
      const carrier = typeof snapshotPolicy.carrierReadStatus === "function" ? snapshotPolicy.carrierReadStatus(parsed, parsed) : null;
      return carrier || { status: "invalid", raw: parsed, parsed };
    } catch (error) {
      return { status: "failed", raw: null, parsed: null, error };
    }
  }

  /** Restore one interrupted transfer's acknowledged predecessor without
   * publishing an application read model. Only this owner allocates revisions.
   * @param {{durableState:StoredSnapshot}} previous
   * @param {{snapshot:StoredSnapshot,local:import('./contracts.js').ReplicaRead,idb:import('./contracts.js').ReplicaRead}} current */
  async function restoreTransferSnapshot(previous,current){
    const currentRevision=readRevision(current?.snapshot);
    const target=cloneSnapshot(previous.durableState);
    const logicalEqual=JSON.stringify(canonicalize(exportableState(current?.snapshot)))===JSON.stringify(canonicalize(target));
    if(logicalEqual&&current?.local?.status==="valid"&&current?.idb?.status==="valid"&&
      readRevision(current.local.parsed)===currentRevision&&readRevision(current.idb.parsed)===currentRevision&&
      storageSnapshotsEqual(current.local.parsed,current.idb.parsed))return{ok:true,unchanged:true};
    target[STORAGE_REV]=currentRevision+1;
    const result=await withStorageLock(storageIO,async()=>{
      const local=readLocalStatus(),idb=await readIdbStatus(),latest=chooseSnapshot(local,idb);
      if((latest.kind!=="chosen"&&latest.kind!=="first-run")||
        latest.kind==="chosen"&&(readRevision(latest.snapshot)!==currentRevision||
          !storageSnapshotsEqual(latest.snapshot,current.snapshot)))
        return{revision:currentRevision,localOk:false,idbOk:false,conflict:true,staleRevision:true,code:"rollback-stale-revision"};
      return writeSnapshot(target,storageIO);
    });
    return{ok:!!(result?.localOk&&result?.idbOk),result,code:result?.code||"durable-rollback-failed"};
  }

  /** @param {import('./contracts.js').ReplicaRead} localRead @param {import('./contracts.js').ReplicaRead} idbRead @returns {import('./contracts.js').SnapshotChoice} */
  function chooseSnapshot(localRead, idbRead) {
    const l = localRead?.status, i = idbRead?.status, lv = l === "valid", iv = i === "valid";
    if (l === "absent" && i === "absent") return { kind: "first-run" };
    if (!lv && !iv) return { kind: "unresolved", reason: "no-valid", local: localRead, idb: idbRead };
    if (lv && i === "absent") return { kind: "chosen", snapshot: localRead.parsed, source: "local", heal: "idb" };
    if (iv && l === "absent") return { kind: "chosen", snapshot: idbRead.parsed, source: "idb", heal: "local" };
    if (lv && (i === "invalid" || i === "failed")) return { kind: "unresolved", reason: i === "failed" ? "valid-plus-failed" : "valid-plus-invalid", local: localRead, idb: idbRead };
    if (iv && (l === "invalid" || l === "failed")) return { kind: "unresolved", reason: l === "failed" ? "valid-plus-failed" : "valid-plus-invalid", local: localRead, idb: idbRead };
    const localSnapshot=/** @type {StoredSnapshot} */(localRead.parsed),idbSnapshot=/** @type {StoredSnapshot} */(idbRead.parsed);
    const localHas = Object.prototype.hasOwnProperty.call(localSnapshot || {}, STORAGE_REV);
    const idbHas = Object.prototype.hasOwnProperty.call(idbSnapshot || {}, STORAGE_REV);
    const equal = snapshotsEqual(localSnapshot, idbSnapshot);
    const lr = readRevision(localSnapshot), ir = readRevision(idbSnapshot);
    if (equal) {
      const localTxn = pendingDraftTransaction(localSnapshot), idbTxn = pendingDraftTransaction(idbSnapshot);
      if (lr === ir && !!localTxn !== !!idbTxn) {
        if (localTxn) return { kind: "chosen", snapshot: idbSnapshot, source: "idb", heal: "local" };
        return { kind: "chosen", snapshot: localSnapshot, source: "local", heal: "idb" };
      }
      if (lr !== ir) {
        if (lr > ir) return { kind: "chosen", snapshot: localSnapshot, source: "local", heal: "idb" };
        return { kind: "chosen", snapshot: idbSnapshot, source: "idb", heal: "local" };
      }
      if (!localHas || !idbHas) {
        const chosen = localHas ? localRead : idbRead;
        return { kind: "chosen", snapshot: /** @type {StoredSnapshot} */(chosen.parsed), source: chosen === localRead ? "local" : "idb", migrate: true };
      }
      return { kind: "chosen", snapshot: idbSnapshot, source: "idb" };
    }
    if (lr !== ir) {
      if (lr > ir) return { kind: "chosen", snapshot: localSnapshot, source: "local", heal: "idb" };
      return { kind: "chosen", snapshot: idbSnapshot, source: "idb", heal: "local" };
    }
    return { kind: "unresolved", reason: "divergent", local: localRead, idb: idbRead };
  }

  // --- Normalized Durable Outcome Contract ---
  /** @param {OutcomeInput|null|undefined} result @param {{revision?:number;allowDegradedAcceptance?:boolean;allowDegradedCommit?:boolean}} [options] */
  function normalizeDurableOutcome(result, options = {}) {
    const localOk = !!result?.localOk;
    const idbOk = !!result?.idbOk;
    const revision = typeof result?.revision === "number" ? result.revision : (options.revision ?? 0);
    const conflict = !!(result?.conflict || result?.duplicate || result?.ineligible ||
      result?.setupDraftConflict || result?.stale || result?.staleRevision || result?.staleBlock ||
      result?.stateInvalid);
    const draftConflict = !!result?.draftConflict;
    const alreadyCommitted = !!result?.alreadyCommitted;
    const accepted = !!result?.accepted;
    const deferred = !!result?.deferred;
    const finalizationPending = !!result?.finalizationPending;
    const compensationPending = !!result?.compensationPending;
    const pendingJournalCleanup = !!result?.pendingJournalCleanup;
    const transferFrozen = !!result?.transferFrozen;
    const journalFailed = !!result?.journalFailed;
    const stale = !!(result?.stale || result?.staleRevision || result?.staleBlock);
    const code = result?.code || (
      transferFrozen ? "install-transfer-frozen" :
      pendingJournalCleanup ? "journal_cleanup_pending" :
      journalFailed ? "journal_failed" :
      draftConflict ? "draft_conflict" :
      stale ? "stale_proposal" :
      result?.stateInvalid ? "invalid-state" :
      conflict ? (result?.reason || "conflict") :
      pendingJournalCleanup ? "journal_cleanup_pending" :
      deferred ? "settlement_deferred" :
      null
    );

    let status;
    let kind;
    let committed;
    let settled;
    let rejected;

    if (alreadyCommitted) {
      status = "already_committed";
      kind = "already_committed";
      committed = true;
      settled = !pendingJournalCleanup;
      rejected = false;
    } else if (pendingJournalCleanup) {
      // A proposal whose WAL cannot be removed may still be replayed. Until
      // cleanup succeeds it is neither a durable rejection nor a commit, even
      // when the operation that required cleanup also failed.
      status = "deferred";
      kind = "deferred_pending";
      committed = false;
      settled = false;
      rejected = false;
    } else if (journalFailed) {
      status = "failed";
      kind = "rejected_failure";
      committed = false;
      settled = false;
      rejected = false;
    } else if (accepted && (deferred || finalizationPending)) {
      // A freeze may begin after the local replica has already accepted the
      // write. Keep that partial transaction recoverable instead of claiming
      // that the proposal was rejected without mutation.
      status = "deferred";
      kind = "deferred_pending";
      committed = false;
      settled = false;
      rejected = false;
    } else if (transferFrozen && localOk !== idbOk) {
      // A freeze can begin after the first replica has already accepted this
      // snapshot. Keep that exact mutation recoverable; it is not a settled
      // rejection merely because the second write was stopped at the boundary.
      status = "partial";
      kind = "deferred_pending";
      committed = false;
      settled = false;
      rejected = false;
    } else if (conflict || draftConflict || transferFrozen) {
      status = "rejected";
      kind = "rejected_conflict";
      committed = false;
      settled = !compensationPending && !finalizationPending;
      rejected = true;
    } else if (deferred || finalizationPending || compensationPending) {
      status = "deferred";
      kind = "deferred_pending";
      committed = false; // NEVER flatten deferred writes into committed!
      settled = false;
      rejected = false;
    } else if (localOk && idbOk) {
      status = "committed";
      kind = "committed";
      committed = true;
      settled = true;
      rejected = false;
    } else if (localOk || idbOk) {
      status = "partial";
      committed = false;
      settled = false;
      if (accepted || options.allowDegradedAcceptance || options.allowDegradedCommit) {
        kind = "degraded_committed";
        rejected = false;
      } else {
        kind = "deferred_pending";
        rejected = false;
      }
    } else {
      status = "failed";
      kind = "rejected_failure";
      committed = false;
      settled = false;
      rejected = false;
    }

    return Object.assign({}, result, {
      status,
      kind,
      committed,
      settled,
      rejected,
      accepted: rejected ? false : accepted || committed || kind === "degraded_committed",
      deferred: deferred || finalizationPending || compensationPending || pendingJournalCleanup || kind === "deferred_pending",
      recoveryPending: compensationPending || finalizationPending || pendingJournalCleanup ||
        kind === "degraded_committed" || kind === "deferred_pending",
      localOk,
      idbOk,
      revision,
      conflict: conflict || draftConflict || transferFrozen || rejected,
      code,
    });
  }

  async function clearPrimaryReplicas() {
    return withStorageLock(storageIO, async () => {
      try { platform.localStorage.removeItem(KEY); } catch {}
      try { await idbDel(KEY); } catch {}
      const localNow = readLocalStatus();
      const idbNow = await readIdbStatus();
      return {
        localNow,
        idbNow,
        localOk: localNow.status === "absent",
        idbOk: idbNow.status === "absent",
      };
    });
  }

  // --- Storage IO & Write Coordination ---
  const storageIO = {
    /** @param {StoredSnapshot} snapshot */
    async writeLocal(snapshot) {
      try {
        platform.localStorage.setItem(KEY, JSON.stringify(snapshot));
        return true;
      } catch (err) {
        const failure=/** @type {{name?:unknown;code?:unknown}|null|undefined} */(err);
        if (failure && (failure.name === "QuotaExceededError" || failure.code === 22)) {
          storageHealth.quotaFailed = true;
        }
        return false;
      }
    },
    /** @param {StoredSnapshot} snapshot */
    async writeIdb(snapshot) {
      try {
        return await idbSet(KEY, snapshot);
      } catch {
        return false;
      }
    },
  };

  /** @param {StorageIO|null|undefined} io @param {string} [label] @returns {StorageIO} */
  function requireAdapter(io, label = "storage operation") {
    if (!io || typeof io.writeLocal !== "function" || typeof io.writeIdb !== "function") {
      throw new Error(`${label} requires an explicit adapter`);
    }
    return io;
  }

  /** @param {OutcomeInput|null} result */
  function noteWriteHealth(result) {
    if (!result) return;
    const both = !!(result.localOk && result.idbOk);
    const none = !result.localOk && !result.idbOk;
    const degraded = !both && !none;
    storageHealth.revision = result.revision || 0;
    storageHealth.localOk = !!result.localOk;
    storageHealth.idbOk = !!result.idbOk;
    storageHealth.degraded = degraded;
    storageHealth.lastResult = result;
    storageHealth.localFailed = !result.localOk;
    storageHealth.idbFailed = !result.idbOk;
    if (both) {
      storageHealth.quotaFailed = false;
      storageHealth.lastError = null;
    }
    notifyHealthListeners(result);
  }

  /** @param {StoredSnapshot} snapshot @param {StorageIO} [io] @returns {Promise<ReplicaWriteResult>} */
  async function writeSnapshot(snapshot, io = storageIO) {
    requireAdapter(io, "writeSnapshot");
    const target = cloneSnapshot(snapshot);
    const revision = readRevision(target);
    // This is the last common write boundary for normal snapshots, prepared
    // draft transactions, boot heals, and test adapters. Validate the exact
    // shape the boot reader accepts before touching either durable replica.
    if (!isValidStateShape(target)) {
      return { revision, localOk: false, idbOk: false, conflict: true,
        stateInvalid: true, code: "invalid-state" };
    }
    if(io===storageIO&&installTransferMutationFrozen())
      return{revision,localOk:false,idbOk:false,conflict:true,
        transferFrozen:true,code:"install-transfer-frozen"};
    let localOk = false, idbOk = false, transferFrozen = false;
    try {
      const res = await io.writeLocal(target);
      localOk = res !== false;
    } catch {
      localOk = false;
    }
    if(io===storageIO&&installTransferMutationFrozen())transferFrozen=true;
    else try {
      const res = await io.writeIdb(target);
      idbOk = res !== false;
    } catch {
      idbOk = false;
    }
    const result = transferFrozen
      ?{revision,localOk,idbOk,conflict:true,transferFrozen:true,code:"install-transfer-frozen"}
      :{revision,localOk,idbOk};
    noteWriteHealth(result);
    return result;
  }

    /** @template T @template [F=never] @param {StorageIO} io @param {(...args:unknown[])=>T} op @param {{onFrozen?:null|((...args:unknown[])=>F)}} [options] */
    function withStorageLock(io,op,{onFrozen=null}={}){
    /** @param {unknown[]} args */
    const guarded=async(...args)=>{
      if(io===storageIO&&installTransferMutationFrozen())
        return typeof onFrozen==="function"?onFrozen(...args):
          normalizeDurableOutcome({localOk:false,idbOk:false,conflict:true,
            transferFrozen:true,code:"install-transfer-frozen"});
      return op(...args)};
    if(io===storageIO&&platform.navigator?.locks?.request)return platform.navigator?.locks.request(STORAGE_LOCK,guarded);
    return guarded()}

  /** @template T @param {()=>T|Promise<T>} op */
  function withDraftWriteLock(op){
    if(platform.navigator?.locks?.request)return platform.navigator?.locks.request(DRAFT_WRITE_LOCK,op);
    return Promise.resolve().then(op)}

  /** @template T @param {()=>T} op @returns {Promise<Awaited<T>>} */
  function enqueueWrite(op) {
    const run = () => op();
    const next = writeTail.then(run, run);
    writeTail = next.then(() => {}, () => {});
    return /** @type {Promise<Awaited<T>>} */(next);
  }

  function flushStorage() {
    return writeTail;
  }

  /** @param {StoredSnapshot|null} snapshot */
  function setPersistHead(snapshot) {
    persistHead = cloneSnapshot(snapshot);
  }

  /** @returns {StoredSnapshot|null} */
  function getPersistHead() {
    return cloneSnapshot(persistHead);
  }

  /** @returns {string} */
  function getJournalWriterId() {
    return pendingJournalWriterId;
  }

  function hasPendingJournal() {
    return pendingJournalKeys().length > 0;
  }

  /** @param {StoredSnapshot|null} snapshot */
  function resetPersistenceBase(snapshot) {
    persistHead = cloneSnapshot(snapshot);
  }

  async function refreshPersistenceHead(){
    const local=readLocalStatus(),idb=await readIdbStatus();
    const decision=chooseSnapshot(local,idb);
    if(decision.kind==="first-run")return{head:cloneSnapshot(persistHead)};
    if(decision.kind!=="chosen")return{head:cloneSnapshot(persistHead),conflict:true};
    if(pendingDraftTransaction(decision.snapshot))
      return{head:cloneSnapshot(persistHead),conflict:true,draftTransaction:true};
    const current=cloneSnapshot(persistHead);
    let disk=cloneSnapshot(decision.snapshot);
    let normalized;
    try{normalized=await normalizeRecoveryCarrierSnapshot(
      disk,sourceReplicaForCarrierDecision(decision,local,idb),{
        priorQuarantine:/** @type {{quarantine?:import('./snapshot.js').RecoveryQuarantine[]}|null|undefined} */(current?.recoveryTransitions)?.quarantine||[]})}
    catch{return{head:current,conflict:true,recovery:true}}
    if(normalized.kind==="full-recovery")return{head:current,conflict:true,recovery:true};
    if(normalized.kind==="known")disk=normalized.snapshot;
    const diskRev=readRevision(disk),currentRev=readRevision(current);
    if(diskRev>currentRev)return{head:disk};
    if(diskRev<currentRev||storageSnapshotsEqual(disk,current))return{head:current};
    return{head:current,conflict:true}}

    /** @param {{source?:string}} decision @param {import('./contracts.js').ReplicaRead} localRead @param {import('./contracts.js').ReplicaRead} idbRead */
    function sourceReplicaForCarrierDecision(decision,localRead,idbRead){
    const localClass=localRead?.recoveryCarrierClassification;
    const idbClass=idbRead?.recoveryCarrierClassification;
    const equal=localRead?.status==="valid"&&idbRead?.status==="valid"&&
      snapshotsEqual(localRead.parsed,idbRead.parsed);
    if(equal&&localClass?.kind==="known"&&idbClass?.kind==="known"&&
      (localClass.valid.length+localClass.malformed.length)>0)return"both";
    return recoverySourceReplica(decision?.source||"");
  }

  // --- Draft Effects & Coordination ---
    /** @param {StoredSnapshot|null|undefined} snapshot @returns {{id:string;effect:import('./snapshot.js').DraftEffect;previous:StoredSnapshot}|null} */
    function pendingDraftTransaction(snapshot){
    const value=snapshot?.[STORAGE_DRAFT_TXN];
    if(!isPlainStateObject(value)||value.version!==1||typeof value.id!=="string"||!value.id)return null;
    const effectOutcome=draftEffectOutcome(value.effect),previous=value.previous;
    if(effectOutcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(effectOutcome)||!isPlainStateObject(previous)||
      Object.prototype.hasOwnProperty.call(previous,STORAGE_DRAFT_TXN)||!isValidStateShape(previous)||
      readRevision(snapshot)<=readRevision(previous))return null;
    return{id:value.id,effect:effectOutcome.effect,previous:cloneSnapshot(previous)}}

    /** @param {import('./contracts.js').EffectInput} effect */
    function pendingJournalEffectState(effect){
    const outcome=normalizeDraftEffectOutcome(effect);
    if(outcome.status!==DRAFT_EFFECT_VALID)return{receipt:null,status:outcome.status};
    const receipt=outcome.effect;
    try{
      const read=DraftStore.readCanonicalStatus();
      if(read.status!=="ok")return{receipt,currentRaw:null,status:"read-failed"};
      const currentRaw=read.raw,checkpoint=DraftStore.readV2Checkpoint();
      if(checkpoint.status==="invalid"||checkpoint.status==="read-failed")
        return{receipt,currentRaw:null,status:"read-failed"};
      // A pre-V2 tab can still replace the canonical localStorage key after the
      // versioned tab has closed, or remove it after a V2 write. The checkpoint
      // is the acknowledged aggregate even when the canonical bytes happen to
      // equal an older receipt. Canonical equality alone cannot authorize a
      // destructive state transaction.
      let authoritativeRaw=currentRaw;
      if(checkpoint.status==="valid"){
        if(checkpoint.value.kind==="committed")authoritativeRaw=checkpoint.value.raw;
        else if(checkpoint.value.kind==="tombstone")authoritativeRaw=null;
        else return{receipt,currentRaw:null,status:"read-failed"};
        if(currentRaw!==authoritativeRaw&&currentRaw!=null)
          retainDraftRecovery(currentRaw,"canonical-overwrite-before-state-transaction")}
      if(authoritativeRaw===receipt.expectedRaw)
        return{receipt,currentRaw:authoritativeRaw,status:"exact",overwrittenRaw:currentRaw!==authoritativeRaw?currentRaw:undefined};
      if(authoritativeRaw==null)return{receipt,currentRaw:authoritativeRaw,status:"missing"};
      if(receipt.precondition===DRAFT_PRECONDITION_ABORT_CHANGED)
        return{receipt,currentRaw:authoritativeRaw,status:"conflict"};
      if(receipt.precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY){
        try{
          /** @type {unknown} */
          const authoritative=JSON.parse(authoritativeRaw);
          if(isPlainStateObject(authoritative)&&
            (authoritative.__day===receipt.conflictDay||authoritative.schemaVersion===2&&/** @type {{dayLabel?:unknown}|null|undefined} */(authoritative.program)?.dayLabel===receipt.conflictDay))
            return{receipt,currentRaw:authoritativeRaw,status:"conflict"}}
        catch{}}
      return{receipt,currentRaw:authoritativeRaw,status:"mismatch"}}
    catch{
      return{receipt,currentRaw:null,status:receipt.precondition===DRAFT_PRECONDITION_MATCH_ONLY?"mismatch":"conflict"}}}

    /** @param {import('./contracts.js').EffectInput} effect */
    function applyPendingJournalEffect(effect){
    const checked=pendingJournalEffectState(effect),receipt=checked.receipt;
    if(checked.status===DRAFT_EFFECT_NONE)return{status:DRAFT_EFFECT_NONE,receipt:null};
    if(!receipt)return{status:DRAFT_EFFECT_INVALID,receipt:null};
    if(checked.status!=="exact")return{status:"no-effect",receipt,reason:checked.status};
    const nextRaw=receipt.kind==="clear-draft"?null:receipt.replacementRaw;
    const prepared=prepareV2CheckpointEffect(checked.currentRaw,nextRaw,`transaction-${pendingJournalUuid()}`);
    if(!prepared.ok)return{status:"failed",receipt,reason:prepared.reason};
    if(!DraftStore.publishCanonical(nextRaw))return{status:"failed",receipt};
    if(!commitV2CheckpointEffect(prepared,nextRaw))return{status:"failed",receipt,reason:"checkpoint-commit"};
    return{status:"applied",receipt}}

    /** @param {string} transactionId @param {import('./contracts.js').EffectInput} effect @param {boolean} restoreEffect @param {string|null} contextFingerprint @returns {import('./contracts.js').SidecarSettlement} */
    function settlePendingDraftSidecars(transactionId,effect,restoreEffect,contextFingerprint){
    if(restoreEffect)return DraftStore.restoreEffect(transactionId,effect,contextFingerprint);
    let pending=pendingDraftRelatedState(effect,transactionId,contextFingerprint);
    for(const entry of pending.expectedWrites)DraftStore.clearSidecar(entry);
    pending=pendingDraftRelatedState(effect,transactionId,contextFingerprint);
    if(pending.expectedWrites.length)
      return{settled:false,hadWrites:false,conflict:false};
    const promoted=DraftStore.promoteUnlocked(transactionId,contextFingerprint);
    return Object.assign({},promoted,{conflict:promoted.hadWrites})}

    /** @param {import('./contracts.js').PendingJournal|null} record @param {{transactionId?:string|null;effect?:import('./contracts.js').EffectInput;restoreEffect?:boolean;allowWrites?:boolean;contextFingerprint?:string|null}} [options] @returns {import('./contracts.js').SidecarSettlement} */
    function settlePendingDraftRecord(record,{transactionId=record?.journal?.id||null,effect=null,
    restoreEffect=false,allowWrites=false,contextFingerprint=null}={}){
    if(!transactionId){
      return{settled:clearPendingJournal(record),hadWrites:false}}
    const settle=()=>settlePendingDraftSidecars(
      transactionId,effect,restoreEffect,contextFingerprint);
    /** @param {import('./contracts.js').SidecarSettlement} result */
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
    try{platform.localStorage.removeItem(DRAFT_CLOSE_PREFIX+transactionId)}
    catch{ended=false}
    const final=settle();
    if(!ended||!final.settled||!restoreEffect&&!allowWrites&&final.conflict)
      return blocked({settled:false,
        hadWrites:first.hadWrites||second.hadWrites||final.hadWrites,
        conflict:final.conflict});
    return{settled:true,hadWrites:first.hadWrites||second.hadWrites||final.hadWrites,
      conflict:false}}

  // --- Write-Ahead Log (WAL) Primitives ---
    function pendingJournalUuid(){
    const uuid=globalThis.crypto?.randomUUID?.();
    if(uuid)return uuid;
    const words=new Uint32Array(4);
    if(globalThis.crypto?.getRandomValues){
      globalThis.crypto.getRandomValues(words);
      return [...words].map(n=>n.toString(36)).join("-")}
    return`${Date.now().toString(36)}-${(++pendingJournalSeq).toString(36)}-${Math.random().toString(36).slice(2)}`}

    /** @returns {import('./contracts.js').JournalOrder} */
    function pendingJournalOrder(){
    const clock=Number.isFinite(globalThis.performance?.timeOrigin)&&Number.isFinite(globalThis.performance?.now?.())
      ?Math.floor((globalThis.performance.timeOrigin+globalThis.performance.now())*1000):Date.now()*1000;
    const at=Math.max(clock,pendingJournalClock+1);
    pendingJournalClock=at;
    return{at,writer:pendingJournalWriterId,seq:++pendingJournalSeq}}

    /** @returns {string[]} */
    function pendingJournalKeys(){
    const keys=[];
    try{for(let i=0;i<platform.localStorage.length;i++){
      const key=platform.localStorage.key(i);
      if(key===PENDING||key?.startsWith(PENDING_PREFIX))keys.push(key)}}
    catch{}
    return[...new Set(keys)]}

    /** @param {unknown} value @returns {import('./contracts.js').CustomMutationRecovery|null} */
    function normalizeCustomMutationRecovery(value){
    if(!isPlainStateObject(value)||value.version!==1||value.operation!=="delete"||
      typeof value.id!=="string"||!value.id.startsWith("custom:"))return null;
    return{version:1,operation:"delete",id:value.id}}

    /** @param {unknown} value @returns {import('./contracts.js').CustomMutationIntent|null} */
    function normalizeCustomMutationIntent(value){
    if(!isPlainStateObject(value)||value.version!==1||value.operation!=="delete"||
      typeof value.id!=="string"||!value.id.startsWith("custom:")||
      !isValidStateShape({program:[],log:[],customExercises:[value.entry]})||
      /** @type {import('./contracts.js').CustomExercise} */(value.entry).id!==value.id)return null;
    return{version:1,operation:"delete",id:value.id,entry:cloneSnapshot(/** @type {import('./contracts.js').CustomExercise} */(value.entry))}}

    /** @param {string} key @param {string} raw @returns {import('./contracts.js').PendingJournal|null} */
    function decodePendingJournal(key,raw){
    try{
      /** @type {unknown} */
      const journal=JSON.parse(raw);
      if(!isPlainStateObject(journal)||typeof journal.id!=="string"||
        !isValidStateShape(journal.base)||!isValidStateShape(journal.liveBase)||!isValidStateShape(journal.proposal))return null;
      const legacy=key===PENDING,order=/** @type {{at?:unknown,writer?:unknown,seq?:unknown}|null|undefined} */(journal.order);
      if(!legacy&&(key!==PENDING_PREFIX+journal.id||journal.version!==2||
        !Number.isSafeInteger(order?.at)||typeof order?.writer!=="string"||
        !Number.isSafeInteger(order?.seq)))return null;
      /** @type {import('./snapshot.js').DraftEffectOutcome} */
      const effectOutcome=legacy?{status:DRAFT_EFFECT_NONE,effect:null}:
        draftEffectOutcome(Object.prototype.hasOwnProperty.call(journal,"effect")?journal.effect:null);
      const recoveryTransactionPresent=Object.prototype.hasOwnProperty.call(journal,"recoveryTransaction");
      if(journal.recoveryTransaction!=null&&typeof journal.recoveryTransaction!=="boolean")return null;
      const recoveryTransaction=journal.recoveryTransaction===true;
      let customMutationRecovery=null;
      if(Object.prototype.hasOwnProperty.call(journal,"customMutationRecovery")){
        customMutationRecovery=normalizeCustomMutationRecovery(journal.customMutationRecovery);
        if(!customMutationRecovery)return null}
      let customMutationIntent=null;
      if(Object.prototype.hasOwnProperty.call(journal,"customMutationIntent")){
        customMutationIntent=normalizeCustomMutationIntent(journal.customMutationIntent);
        if(!customMutationIntent)return null}
      if(journal.preflightPending!=null&&typeof journal.preflightPending!=="boolean")return null;
      const preflightPending=journal.preflightPending===true;
      if(preflightPending&&customMutationIntent)return null;
      const transitionPayloadMalformed=rawTransitionMetadataMalformed(journal.proposal);
      const expectedProgramFingerprint=typeof journal.expectedProgramFingerprint==="string"&&
        journal.expectedProgramFingerprint.length<=PENDING_EFFECT_MAX_RAW?journal.expectedProgramFingerprint:null;
      if(journal.expectedProgramFingerprint!=null&&!expectedProgramFingerprint)return null;
      const expectedBlockId=Object.prototype.hasOwnProperty.call(journal,"expectedBlockId")
        ?(journal.expectedBlockId===null?null:isValidBlockId(journal.expectedBlockId)?journal.expectedBlockId:null)
        :undefined;
      if(Object.prototype.hasOwnProperty.call(journal,"expectedBlockId")&&expectedBlockId===null&&journal.expectedBlockId!==null)return null;
      const expectedStorageRevision=Object.prototype.hasOwnProperty.call(journal,"expectedStorageRevision")
        ?journal.expectedStorageRevision:null;
      if(expectedStorageRevision!==null&&(!Number.isInteger(expectedStorageRevision)||/** @type {number} */(expectedStorageRevision)<0))return null;
      const reconcileSessionIds=normalizeJournalSessionIds(journal.reconcileSessionIds);
      const dayRenames=normalizeJournalDayRenames(journal.dayRenames);
      if(reconcileSessionIds==null||dayRenames==null)return null;
      let rollback=null;
      if(Object.prototype.hasOwnProperty.call(journal,"rollback")){
        if(!isValidStateShape(journal.rollback)||
          Object.prototype.hasOwnProperty.call(journal.rollback,STORAGE_DRAFT_TXN))return null;
        rollback=cloneSnapshot(journal.rollback)}
      else if(Object.prototype.hasOwnProperty.call(journal,"rollbackRevision")){
        if(!Number.isInteger(journal.rollbackRevision)||/** @type {number} */(journal.rollbackRevision)<0)return null;
        rollback=cloneSnapshot(journal.base);
        rollback[STORAGE_REV]=journal.rollbackRevision}
      return{key,raw,legacy,order:legacy?null:/** @type {import('./contracts.js').JournalOrder} */(order),journal:{
        id:journal.id,base:unversionedSnapshot(journal.base),liveBase:unversionedSnapshot(journal.liveBase),
        proposal:unversionedSnapshot(journal.proposal),replace:!!journal.replace,
        expectedProgramId:typeof journal.expectedProgramId==="string"&&journal.expectedProgramId?journal.expectedProgramId:null,
        expectedProgramFingerprint,expectedBlockId,expectedStorageRevision:/** @type {number|null} */(expectedStorageRevision),
        expectedFirstRunEmpty:journal.expectedFirstRunEmpty===true,reconcileSessionIds,dayRenames,
        effectOutcome,effect:effectOutcome.effect,recoveryTransaction,recoveryTransactionPresent,
        customMutationRecovery,customMutationIntent,preflightPending,
        transitionPayloadMalformed,rollback}}}
    catch{return null}}

    /** @returns {{entries:import('./contracts.js').PendingJournal[],invalid:import('./contracts.js').InvalidJournal[]}} */
    function readPendingJournal(){
    const entries=[],invalid=[];
    for(const key of pendingJournalKeys()){
      let raw;
      try{raw=platform.localStorage.getItem(key)}catch{continue}
      if(raw==null)continue;
      const record=decodePendingJournal(key,raw);
      if(record)entries.push(record);else invalid.push({key,raw})}
    entries.sort((a,b)=>{
      if(a.legacy!==b.legacy)return a.legacy?-1:1;
      if(a.legacy)return a.journal.id.localeCompare(b.journal.id);
      const ao=/** @type {import('./contracts.js').JournalOrder} */(a.order),bo=/** @type {import('./contracts.js').JournalOrder} */(b.order);
      return ao.at-bo.at||ao.writer.localeCompare(bo.writer)||
        ao.seq-bo.seq||a.journal.id.localeCompare(b.journal.id)});
    return{entries,invalid}}

    /** @param {import('./contracts.js').PendingJournal|import('./contracts.js').InvalidJournal|null} record @returns {boolean} */
    function clearPendingJournal(record){
    if(!record)return true;
    try{
      const current=platform.localStorage.getItem(record.key);
      if(current===record.raw)platform.localStorage.removeItem(record.key);
      return platform.localStorage.getItem(record.key)!==record.raw}
    catch{return false}}

    /** @param {import('./contracts.js').PendingJournal|null} record @param {StoredSnapshot} snapshot @param {import('./contracts.js').CustomMutationRecovery} recovery */
    function rewritePendingJournalProposal(record,snapshot,recovery){
    if(!record||!isValidStateShape(snapshot)||!recovery||
      recovery.version!==1||recovery.operation!=="delete"||
      typeof recovery.id!=="string"||!recovery.id.startsWith("custom:"))return null;
    try{
      if(platform.localStorage.getItem(record.key)!==record.raw)return null;
      const journal=/** @type {Record<string,unknown>} */(JSON.parse(record.raw));
      journal.proposal=unversionedSnapshot(snapshot);
      journal.customMutationRecovery={version:1,operation:"delete",id:recovery.id};
      const raw=JSON.stringify(journal);
      platform.localStorage.setItem(record.key,raw);
      return decodePendingJournal(record.key,raw)}
    catch{return null}}

    /** @param {string} id @returns {void} */
    function clearPendingJournalById(id){
    if(typeof id!=="string"||!id)return;
    const key=PENDING_PREFIX+id;
    try{
      const raw=platform.localStorage.getItem(key);
      if(raw==null)return;
      const record=decodePendingJournal(key,raw);
      if(record?.journal.id===id)clearPendingJournal(record)}
    catch{}}

    function clearAllPendingJournal(){
    const records=readPendingJournal();
    for(const record of [...records.entries,...records.invalid])clearPendingJournal(record)}

    /** @param {StoredSnapshot} base @param {StoredSnapshot} liveBase @param {StoredSnapshot} proposal @param {import('./contracts.js').JournalOptions} [options] @returns {import('./contracts.js').PendingJournal|null} */
    function writePendingJournal(base,liveBase,proposal,{replace=false,expectedProgramId=null,
    expectedProgramFingerprint=null,expectedBlockId=undefined,expectedStorageRevision=undefined,expectedFirstRunEmpty=false,
    reconcileSessionIds=[],dayRenames=[],effectOutcome=null,recoveryTransaction=false,preflightPending=false,
    customMutationRecovery=null,customMutationIntent=null}={}){
    const recoveryMarker=customMutationRecovery==null?null:normalizeCustomMutationRecovery(customMutationRecovery);
    if(customMutationRecovery!=null&&!recoveryMarker)return null;
    const mutationIntent=customMutationIntent==null?null:normalizeCustomMutationIntent(customMutationIntent);
    if(customMutationIntent!=null&&!mutationIntent)return null;
    const id=pendingJournalUuid(),key=PENDING_PREFIX+id;
    /** @type {import('./contracts.js').RawJournal} */
    const journal={version:2,id,order:pendingJournalOrder(),base:unversionedSnapshot(base),liveBase:unversionedSnapshot(liveBase),
      proposal:unversionedSnapshot(proposal),replace:!!replace,expectedProgramId:expectedProgramId||null};
    if(expectedProgramFingerprint)journal.expectedProgramFingerprint=expectedProgramFingerprint;
    if(expectedBlockId!==undefined)journal.expectedBlockId=expectedBlockId;
    if(Number.isInteger(expectedStorageRevision)&&/** @type {number} */(expectedStorageRevision)>=0)
      journal.expectedStorageRevision=/** @type {number} */(expectedStorageRevision);
    if(expectedFirstRunEmpty)journal.expectedFirstRunEmpty=true;
    if(reconcileSessionIds.length)journal.reconcileSessionIds=reconcileSessionIds;
    if(dayRenames.length)journal.dayRenames=dayRenames;
    // This optional marker is absent from older journals. It scopes the
    // recovery crash protocol without inferring ownership from a carrier delta
    // that could belong to another state-changing workflow.
    if(recoveryTransaction)journal.recoveryTransaction=true;
    if(preflightPending)journal.preflightPending=true;
    if(recoveryMarker)journal.customMutationRecovery=recoveryMarker;
    if(mutationIntent)journal.customMutationIntent=mutationIntent;
    const outcome=normalizeDraftEffectOutcome(effectOutcome);
    if(outcome.status===DRAFT_EFFECT_VALID)journal.effect=outcome.effect;
    const raw=JSON.stringify(journal);
    try{platform.localStorage.setItem(key,raw);return decodePendingJournal(key,raw)}
    catch(e){console.warn("pending state journal failed",e);return null}}

    /** @param {import('./contracts.js').PendingJournal|null} record @param {StoredSnapshot} snapshot @param {{forceRollback?:boolean}} [options] */
    function armPendingJournalRollback(record,snapshot,{forceRollback=false}={}){
    if(!record||record.legacy||!isValidStateShape(snapshot)||
      Object.prototype.hasOwnProperty.call(snapshot,STORAGE_DRAFT_TXN))return null;
    try{
      if(platform.localStorage.getItem(record.key)!==record.raw)return null;
      const journal=/** @type {Record<string,unknown>} */(JSON.parse(record.raw)),rollback=cloneSnapshot(snapshot);
      journal.rollbackRevision=readRevision(rollback);
      delete journal.rollback;
      if(forceRollback||!storageSnapshotsEqual(unversionedSnapshot(rollback),record.journal.base))
        journal.rollback=rollback;
      const raw=JSON.stringify(journal);
      platform.localStorage.setItem(record.key,raw);
      return decodePendingJournal(record.key,raw)}
    catch(e){console.warn("pending rollback journal failed",e);return null}}

    /** @param {import('./contracts.js').PendingJournal|null} record @param {StoredSnapshot|null} head @returns {boolean} */
    function pendingJournalSuccessorMatches(record,head){
    const journal=record?.journal,rollback=journal?.rollback;
    if(!journal||!rollback||!head)return false;
    const candidate=stateSnapshotForHead(journal.base,journal.liveBase,journal.proposal,rollback,
      {replace:journal.replace,reconcileSessionIds:journal.reconcileSessionIds,
        dayRenames:journal.dayRenames,expectedFirstRunEmpty:journal.expectedFirstRunEmpty,
        sharedRebaseSeed:journal.id});
    if(missingCustomProgramReference(journal.base,candidate,{replace:journal.replace}))return false;
    return readRevision(candidate)===readRevision(head)&&storageSnapshotsEqual(candidate,head)}

    /** @param {unknown} marker @param {unknown} raw @param {unknown} programId */
    function setupActivationMatches(marker,raw,programId){
    return isValidSetupActivationMarker(marker)&&marker.programId===programId&&marker.raw===raw}

    /** @param {StoredSnapshot|null} head @param {StoredSnapshot} proposal @param {unknown} expectedSetupDraftRaw */
    function setupActivationAlreadyCommitted(head,proposal,expectedSetupDraftRaw){
    if(typeof expectedSetupDraftRaw!=="string"||!expectedSetupDraftRaw)return false;
    const proposed=proposal?.[STORAGE_SETUP_TXN],current=head?.[STORAGE_SETUP_TXN];
    if(!isValidSetupActivationMarker(proposed)||!isValidSetupActivationMarker(current))return false;
    const headRevision=readRevision(head);
    // The proposal can be an older in-memory copy after another harmless write
    // advanced the receipt. The durable head is authoritative; matching the
    // exact draft raw value and program id is the idempotency proof.
    if(!Number.isInteger(current.revision)||current.revision!==headRevision)return false;
    return setupActivationMatches(proposed,expectedSetupDraftRaw,proposed.programId)&&
      setupActivationMatches(current,expectedSetupDraftRaw,head?.programMeta?.id)&&
      current.programId===proposed.programId;
  }

    /** @param {StoredSnapshot} snapshot @param {StoredSnapshot} previous @param {import('./contracts.js').EffectInput} effect @param {string|null|undefined} id */
    function preparePendingDraftTransaction(snapshot,previous,effect,id){
    const prepared=cloneSnapshot(snapshot),outcome=normalizeDraftEffectOutcome(effect);
    if(outcome.status!==DRAFT_EFFECT_VALID||!draftEffectRequiresCoordination(outcome))return prepared;
    const receipt=outcome.effect;
    const prior=cloneSnapshot(previous);
    delete prior[STORAGE_DRAFT_TXN];
    if(!isValidStateShape(prior))throw new TypeError("draft transaction requires a valid prior state");
    prepared[STORAGE_DRAFT_TXN]={version:1,id:id||pendingJournalUuid(),previous:prior,effect:receipt};
    return prepared}

    /** @param {StoredSnapshot} snapshot @returns {StoredSnapshot} */
    function finalizedDraftTransactionSnapshot(snapshot){
    const finalized=cloneSnapshot(snapshot);
    delete finalized[STORAGE_DRAFT_TXN];
    return finalized}

    /** @param {StoredSnapshot} snapshot @returns {StoredSnapshot|null} */
    function rejectedDraftTransactionSnapshot(snapshot){
    const transaction=pendingDraftTransaction(snapshot);
    if(!transaction)return null;
    const rollback=cloneSnapshot(transaction.previous);
    delete rollback[STORAGE_DRAFT_TXN];
    rollback[STORAGE_REV]=readRevision(snapshot)+1;
    return rollback}

  // --- Snapshot Derivation ---
    // Legacy snapshots can contain an already-dangling custom Program row and
    // remain readable. A new durable transition may carry that exact legacy
    // row forward, but it may not create one or remove the definition from a
    // previously valid reference. This guard belongs beside snapshot
    // derivation so ordinary commits and boot replay enforce the same rule.
    /** @param {StoredSnapshot|null} head @param {StoredSnapshot} candidate @param {{replace?:boolean}} [options] */
    function missingCustomProgramReference(head,candidate,{replace=false}={}){
    const definitions=new Set((candidate?.customExercises||[]).map(entry=>entry?.id));
    /** @type {Set<string>} */
    const legacyDangling=new Set();
    if(!replace){
      const headDefinitions=new Set((head?.customExercises||[]).map(entry=>entry?.id));
      for(const row of head?.program||[]){
        const id=row?.libraryId;
        if(typeof id==="string"&&id.startsWith("custom:")&&!headDefinitions.has(id))
          legacyDangling.add(`${row?.id||""}\u0000${id}`)}
    }
    for(const row of candidate?.program||[]){
      const id=row?.libraryId;
      if(typeof id!=="string"||!id.startsWith("custom:")||definitions.has(id)||
        legacyDangling.has(`${row?.id||""}\u0000${id}`))continue;
      return id}
    return null}

    /** @param {StoredSnapshot} base @param {StoredSnapshot} liveBase @param {StoredSnapshot} proposal @param {StoredSnapshot|null} head @param {{replace?:boolean;reconcileSessionIds?:string[];dayRenames?:import('./contracts.js').DayRename[];expectedFirstRunEmpty?:boolean;sharedRebaseSeed?:string|null}} [options] @returns {StoredSnapshot} */
    function stateSnapshotForHead(base,liveBase,proposal,head,{replace=false,reconcileSessionIds=[],dayRenames=[],expectedFirstRunEmpty=false,sharedRebaseSeed=null}={}){
    const durableHead=cloneSnapshot(head||base);
    const liveHead=replace?durableHead:/** @type {StoredSnapshot} */(rebaseStateChange(base,liveBase,durableHead));
    const snapshot=replace?cloneSnapshot(proposal):/** @type {StoredSnapshot} */(rebaseStateChange(liveBase,proposal,liveHead));
    if(replace&&expectedFirstRunEmpty)rebaseSharedSetupSnapshot(snapshot,durableHead,sharedRebaseSeed);
    reconcileExplicitLogDayRenames(snapshot,dayRenames);
    reconcileCandidateLogDays(snapshot,reconcileSessionIds);
    delete snapshot[STORAGE_DRAFT_TXN];
    delete snapshot[SHARED_IMPORT];
    snapshot[STORAGE_REV]=readRevision(durableHead)+1;
    const setupMarker=snapshot[STORAGE_SETUP_TXN];
    if(isValidSetupActivationMarker(setupMarker))
      snapshot[STORAGE_SETUP_TXN]={...setupMarker,revision:snapshot[STORAGE_REV]};
    return snapshot}

  // --- Transaction Execution Engine ---
    /** @param {StoredSnapshot} snapshot @param {StorageIO} io @param {string|null} transactionId @param {import('./contracts.js').EffectInput} effect */
    async function compensatePendingDraftTransaction(snapshot,io,transactionId,effect){
    const transaction=pendingDraftTransaction(snapshot);
    const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
    const rollback=rejectedDraftTransactionSnapshot(snapshot);
    const result=rollback?await writeSnapshot(rollback,io):{revision:readRevision(snapshot),localOk:false,idbOk:false};
    const durable=!!(result.localOk||result.idbOk);
    const restored=durable?await withDraftWriteLock(()=>
      DraftStore.restoreEffect(transactionId,effect,contextFingerprint)):{settled:false};
    return{settled:durable&&restored.settled,snapshot:rollback,result}}

    /** @param {import('./contracts.js').ExecuteOptions} [options] @returns {Promise<import('./contracts.js').TransactionExecution>} */
    async function executeDraftTransaction({record=null,transactionId=record?.journal?.id||null,effect=null,
    prepared=null,snapshot=null,io=null,writePrepared=true,preparedResult=null,
    retainRecordOnWriteFailure=false,retainRecordOnReplicaPartial=false,
    discard=false,forceFinalization=false}={}){
    const effectOutcome=normalizeDraftEffectOutcome(effect);
    const transaction=prepared&&pendingDraftTransaction(prepared);
    const id=transaction?.id||transactionId;
    const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):
      record?.journal?draftContextFingerprint(record.journal.liveBase):null;
    const coordinated=draftEffectRequiresCoordination(effectOutcome);
    const beginClose=()=>!id||DraftStore.beginClose(id);
    /** @param {boolean} restoreEffect @param {boolean} [allowWrites] */
    const close=async(restoreEffect,allowWrites=false)=>{
      if(!id)return{settled:clearPendingJournal(record),hadWrites:false};
      if(!beginClose())return{settled:false,hadWrites:false,closeFailed:true};
      return withDraftWriteLock(()=>settlePendingDraftRecord(record,
        {transactionId:id,effect:effectOutcome,restoreEffect:!!restoreEffect,
          allowWrites:!!allowWrites,contextFingerprint}))};
    if(discard){
      const closed=await close(false,true);
      return{kind:closed.settled?"discarded":"close-failed",accepted:false,rejected:false,
        settled:closed.settled,closed,snapshot:null,result:null}}
    io=requireAdapter(io,"executeDraftTransaction");
    if(!prepared||!snapshot)throw new TypeError("executeDraftTransaction requires prepared and final snapshots");
    if(coordinated&&(!id||!beginClose()))
      return{kind:"close-failed",accepted:false,rejected:false,settled:false,
        closeFailed:true,snapshot:prepared,result:preparedResult};
    const preEffectState=pendingJournalEffectState(effectOutcome);
    const preEffectPending=pendingDraftRelatedState(effectOutcome,id,contextFingerprint);
    if(writePrepared&&(preEffectState.status==="conflict"||
      preEffectPending.entries.length||preEffectPending.invalid.length)){
      const closed=await close(false,true);
      return{kind:"precondition-rejected",accepted:false,rejected:true,settled:closed.settled,
        closed,snapshot:null,result:null}}
    let result=preparedResult;
    if(writePrepared){
      result=await writeSnapshot(prepared,io);
      if(retainRecordOnReplicaPartial&&(result.localOk===true)!==(result.idbOk===true))
        return{kind:"write-partial-retained",accepted:false,rejected:false,settled:false,
          snapshot:prepared,result};
      if(!(result.localOk||result.idbOk)){
        let closed=null;
        if(retainRecordOnWriteFailure){
          if(coordinated&&id)await withDraftWriteLock(()=>DraftStore.endClose(id))}
        else closed=await close(false,true);
        return{kind:"write-failed",accepted:false,rejected:false,settled:!!closed?.settled,
          closed,snapshot:prepared,result}}}
    const checked=writePrepared?pendingJournalEffectState(effectOutcome):preEffectState;
    const provisionalResult=result||
      {revision:readRevision(prepared),localOk:!writePrepared,idbOk:!writePrepared};
    const finalizeRecovery=forceFinalization&&provisionalResult.localOk===true&&provisionalResult.idbOk===true;
    const settlement=await settleAppliedDraftTransaction(
      prepared,snapshot,effectOutcome,checked,io,provisionalResult,finalizeRecovery);
    if(!settlement.accepted){
      if(settlement.rejected&&settlement.settled){
        const closed=await close(true);
        return Object.assign({},settlement,{kind:"rejected",settled:closed.settled,closed})}
      return Object.assign({},settlement,
        {kind:settlement.deferred?"settlement-deferred":"rejected"})}
    if(settlement.deferred)
      return Object.assign({},settlement,{kind:"settlement-deferred"});
    const closed=await close(false);
    if(coordinated&&(closed.hadWrites||
      !pendingDraftSettlementAccepted(effectOutcome,id,contextFingerprint))){
      const compensation=await compensatePendingDraftTransaction(prepared,io,id,effectOutcome);
      if(compensation.settled){
        const restored=await close(true);
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

  // --- Enqueue State Change ---
    /** @param {StoredSnapshot} base @param {StoredSnapshot} proposal @param {StorageIO} io @param {import('./contracts.js').CommitOptions} [options] */
    function enqueueStateChangeRaw(base,proposal,io,{replace=false,liveBase=base,expectedProgramId=null,
    expectedProgramFingerprint=null,expectedBlockId=undefined,expectedStorageRevision=undefined,expectedFirstRunEmpty=false,
    expectedSetupDraftRaw=undefined,
    reconcileSessionIds=[],dayRenames=[],effect=null,preflight=null,preflightJournalPending=undefined,recoveryTransaction=false,
    customMutationIntent=null}={}){
    requireAdapter(io,"enqueueStateChange");
    if(io===storageIO&&installTransferMutationFrozen())
      return Promise.resolve({revision:readRevision(base),localOk:false,idbOk:false,conflict:true,transferFrozen:true,code:"install-transfer-frozen"});
    const frozenBase=cloneSnapshot(base),frozenLiveBase=cloneSnapshot(liveBase);
    const frozenProposal=cloneSnapshot(proposal),frozenEffectOutcome=normalizeDraftEffectOutcome(effect);
    let workingProposal=cloneSnapshot(frozenProposal);
    if(!isValidStateShape(frozenBase)||!isValidStateShape(frozenLiveBase)||!isValidStateShape(frozenProposal))
      return Promise.resolve({revision:readRevision(frozenBase),localOk:false,idbOk:false,
        conflict:true,stateInvalid:true,code:"invalid-state"});
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
          expectedBlockId,
          expectedStorageRevision,
          expectedFirstRunEmpty,
          reconcileSessionIds:frozenReconcileSessionIds,dayRenames:frozenDayRenames,
          effectOutcome:frozenEffectOutcome,recoveryTransaction,
          preflightPending:(preflightJournalPending===undefined
            ?typeof preflight==="function":preflightJournalPending===true)&&!customMutationIntent,
          customMutationIntent})
      :null;
    if(io===storageIO&&!pendingRecord){
      /** @type {OutcomeInput} */
      const failed={revision:readRevision(frozenBase),localOk:false,idbOk:false,journalFailed:true};
      if(frozenEffect?.required===true)failed.draftConflict=true;
      noteWriteHealth(failed);
      return Promise.resolve(failed)}
    /** @param {OutcomeInput} result @param {{pendingJournalCleanup?:boolean}} [options] */
    const discardPending=async(result,{pendingJournalCleanup=false}={})=>{
      const pendingJournalId=pendingRecord?.journal.id||null;
      const discarded=await executeDraftTransaction({record:pendingRecord,
        transactionId:pendingRecord?.journal.id||null,effect:frozenEffectOutcome,discard:true});
      return Object.assign({},result,{pendingJournalCleanup:pendingJournalCleanup||discarded.settled!==true,
        pendingJournalId})};
    const cancelUnstarted=()=>{
      const transactionId=pendingRecord?.journal.id||null;
      const related=transactionId?DraftStore.related(transactionId):{entries:[],invalid:[]};
      const hasRelatedDraftWrites=related.entries.length>0||related.invalid.length>0;
      const cleared=!hasRelatedDraftWrites&&clearPendingJournal(pendingRecord);
      return Object.assign({revision:readRevision(frozenBase),localOk:false,idbOk:false,
        conflict:true,transferFrozen:true,code:"install-transfer-frozen"},
        {pendingJournalCleanup:!cleared})};
    const operation=enqueueWrite(()=>withStorageLock(io,async()=>{
      if(io===storageIO&&installTransferMutationFrozen()){
        return cancelUnstarted()}
      let head=cloneSnapshot(persistHead||frozenBase);
      if(io===storageIO){
        const refreshed=await refreshPersistenceHead();
        if(installTransferMutationFrozen())return cancelUnstarted();
        if(refreshed.conflict){
          console.warn("storage write blocked by an unresolved concurrent snapshot");
          return discardPending({revision:readRevision(head),localOk:false,idbOk:false,conflict:true})}
        head=refreshed.head||head}
      const coordinationId=pendingRecord?.journal.id||null;
      if(expectedSetupDraftRaw!==undefined&&readSetupDraftRaw()!==expectedSetupDraftRaw){
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,setupDraftConflict:true})}
      // A setup activation writes a receipt into the durable successor before it
      // attempts to consume the separate setup-draft key. If that consumption
      // was interrupted, the next click must recognize the already-installed
      // successor instead of archiving it a second time.
      if(setupActivationAlreadyCommitted(head,frozenProposal,expectedSetupDraftRaw)){
        const discarded=await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:true,idbOk:true,alreadyCommitted:true,
          pendingJournalCleanup:discarded.settled!==true}}
      // On freshly reread lock-held head, exact-match idempotency and custom
      // preflight guards are evaluated before generic predecessor revision/ID/fingerprint rejection.
      if(typeof preflight==="function"){
        const checked=await preflight({head:cloneSnapshot(head),proposal:cloneSnapshot(workingProposal)});
        if(io===storageIO&&installTransferMutationFrozen())return cancelUnstarted();
        if(checked?.proposal)workingProposal=cloneSnapshot(checked.proposal);
        if(!checked?.reject&&pendingRecord&&!pendingRecord.journal.customMutationIntent&&
          (checked?.proposal||pendingRecord.journal.preflightPending)){
          // Keep crash recovery pointed at the proposal that survived the
          // lock-held semantic rebase, not the stale copy written before it.
          let rebasedRecord=null;
          let rebasedRaw=null;
          let rewriteAttempted=false;
          let journalCleanupPending=false;
          try{
            const currentRaw=platform.localStorage.getItem(pendingRecord.key);
            if(currentRaw===pendingRecord.raw){
              const journal=/** @type {Record<string,unknown>} */(JSON.parse(pendingRecord.raw));
              journal.proposal=unversionedSnapshot(workingProposal);
              delete journal.preflightPending;
              rebasedRaw=JSON.stringify(journal);
              rewriteAttempted=true;
              platform.localStorage.setItem(pendingRecord.key,rebasedRaw);
              if(platform.localStorage.getItem(pendingRecord.key)===rebasedRaw)
                rebasedRecord=decodePendingJournal(pendingRecord.key,rebasedRaw);
            }else if(currentRaw!==null)journalCleanupPending=true;
          }catch(e){console.warn("pending rebase journal failed",e)}
          if(!rebasedRecord){
            if(rewriteAttempted){
              try{
                const currentRaw=platform.localStorage.getItem(pendingRecord.key);
                if(currentRaw===pendingRecord.raw||currentRaw===rebasedRaw){
                  if(currentRaw!==null)platform.localStorage.removeItem(pendingRecord.key);
                  journalCleanupPending=platform.localStorage.getItem(pendingRecord.key)!==null;
                }else if(currentRaw!==null)journalCleanupPending=true;
              }catch{journalCleanupPending=true}}
            return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
              journalFailed:true},{pendingJournalCleanup:journalCleanupPending})}
          pendingRecord=rebasedRecord;
        }
        if(checked?.reject){
          return discardPending(Object.assign(
            {revision:readRevision(head),localOk:false,idbOk:false},checked.result||{conflict:true}))}}
      if(expectedStorageRevision!==undefined&&readRevision(head)!==expectedStorageRevision){
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,staleRevision:true})}
          if(expectedProgramId&&head?.programMeta?.id!==expectedProgramId){
          return discardPending({revision:readRevision(head),localOk:false,idbOk:false,duplicate:true})}
      if(expectedProgramFingerprint&&draftProgramFingerprint(head)!==expectedProgramFingerprint){
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,duplicate:true})}
      if(expectedBlockId!==undefined&&snapshotBlockId(head)!==expectedBlockId){
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,duplicate:true,staleBlock:true})}
      if(expectedFirstRunEmpty&&(head?.programMeta?.onboarded||head?.log?.length||head?.programHistory?.length)){
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,duplicate:true,ineligible:true})}
      if(pendingRecord&&(draftEffectRequiresCoordination(frozenEffectOutcome)||recoveryTransaction)){
        const armed=armPendingJournalRollback(pendingRecord,head,{forceRollback:recoveryTransaction});
        if(!armed){
          return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
            draftConflict:true,journalFailed:true})}
        pendingRecord=armed}
      const snapshot=stateSnapshotForHead(frozenBase,frozenLiveBase,workingProposal,head,
        {replace,reconcileSessionIds:frozenReconcileSessionIds,dayRenames:frozenDayRenames,
          expectedFirstRunEmpty,sharedRebaseSeed:pendingRecord?.journal.id||coordinationId});
      if(missingCustomProgramReference(head,snapshot,{replace}))
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,stale:true,code:"missing_custom_definition"});
      if(!isValidStateShape(snapshot))
        return discardPending({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,stateInvalid:true,code:"invalid-state"});
      const prepared=preparePendingDraftTransaction(snapshot,head,frozenEffect,pendingRecord?.journal.id);
      const transactionId=pendingDraftTransaction(prepared)?.id||coordinationId;
      if(io===storageIO&&installTransferMutationFrozen())return cancelUnstarted();
      const execution=await executeDraftTransaction({record:pendingRecord,transactionId,
        effect:frozenEffectOutcome,prepared,snapshot,io,writePrepared:true,
        retainRecordOnReplicaPartial:!!pendingRecord?.journal.customMutationIntent,
        forceFinalization:recoveryTransaction});
      if(execution.kind==="close-failed")
        return{revision:readRevision(head),localOk:false,idbOk:false,draftConflict:true,closeFailed:true,
          pendingJournalCleanup:execution.settled!==true,pendingJournalId:coordinationId};
      if(execution.kind==="precondition-rejected")
        return{revision:readRevision(head),localOk:false,idbOk:false,draftConflict:true,
          pendingJournalCleanup:execution.settled!==true,pendingJournalId:coordinationId};
      if(execution.kind==="write-failed")return Object.assign({},execution.result,
        {pendingJournalCleanup:execution.settled!==true,pendingJournalId:coordinationId});
      if(execution.kind==="write-partial-retained")return Object.assign({},execution.result,
        {pendingJournalCleanup:true,pendingJournalId:coordinationId,customMutationPending:true});
      if(execution.kind==="rejected"||execution.kind==="compensated"){
        if(execution.settled&&execution.snapshot){
          persistHead=cloneSnapshot(execution.snapshot);
          applyAcceptedSnapshot(frozenLiveBase,execution.snapshot)}
        return{revision:execution.result?.revision??readRevision(head),localOk:false,idbOk:false,
          draftConflict:!!execution.rejected,compensationPending:!execution.settled,
          compensationLocalOk:!!execution.result?.localOk,compensationIdbOk:!!execution.result?.idbOk,
          pendingJournalId:coordinationId}}
      if(execution.kind==="settlement-deferred"){
          persistHead=cloneSnapshot(prepared);
          applyAcceptedSnapshot(frozenLiveBase,snapshot);
          return Object.assign({},execution.result,
            {accepted:true,deferred:true,finalizationPending:true,pendingJournalId:coordinationId})}
      if(execution.kind==="close-deferred"){
        /* Only the journal record is still outstanding: the snapshot below is
           already durable, so live state has to adopt it. Reporting success while
           the app still renders the pre-transaction program is the worse failure. */
        if(execution.snapshot){
          persistHead=cloneSnapshot(execution.snapshot);
          applyAcceptedSnapshot(frozenLiveBase,execution.snapshot)}
        if(!execution.accepted)
          return{revision:execution.result?.revision??readRevision(head),localOk:false,idbOk:false,
            draftConflict:true,compensationPending:true,pendingJournalId:coordinationId};
        return Object.assign({},execution.result,
          {accepted:true,deferred:true,finalizationPending:true,pendingJournalId:coordinationId})}
      if(execution.kind==="committed"){
        persistHead=cloneSnapshot(snapshot);
        applyAcceptedSnapshot(frozenLiveBase,snapshot);
        return Object.assign({accepted:true,pendingJournalId:coordinationId},execution.result)}
      return{revision:readRevision(head),localOk:false,idbOk:false,conflict:true}},
      {onFrozen:cancelUnstarted}));
    return operation}

  /** @param {StoredSnapshot} base @param {StoredSnapshot} proposal @param {StorageIO} [io] @param {import('./contracts.js').CommitOptions} [options] */
  function enqueueStateChange(base, proposal, io = storageIO, options = {}) {
    return Promise.resolve(enqueueStateChangeRaw(base, proposal, io, options))
      .then(result => normalizeDurableOutcome(result));
  }

  /** @param {string} raw */
  async function settleCommittedSetupActivation(raw){
    return withStorageLock(storageIO,async()=>{
      const refreshed=await refreshPersistenceHead();
      const head=refreshed.head||persistHead;
      if(refreshed.conflict||typeof raw!=="string"||
        !setupActivationMatches(head?.[STORAGE_SETUP_TXN],raw,head?.programMeta?.id))
        return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,setupDraftConflict:true});
      let pendingJournalCleanup=false;
      for(const record of readPendingJournal().entries){
        if(!setupActivationAlreadyCommitted(head,record.journal.proposal,raw))continue;
        const discarded=await executeDraftTransaction({record,transactionId:record.journal.id,
          effect:record.journal.effectOutcome,discard:true});
        if(discarded.settled!==true)pendingJournalCleanup=true}
      if(!(await settleOrphanDraftArtifacts(head)).settled)pendingJournalCleanup=true;
      return normalizeDurableOutcome({revision:readRevision(head),localOk:true,idbOk:true,
        alreadyCommitted:true,pendingJournalCleanup})})
  }

  // --- Boot Replay & Resolution ---
  /** @param {import('./contracts.js').RecoveryChoice|null} [candidate] */
  async function resolveBootReplicasLocked(candidate=null){
      const local=readLocalStatus(),idb=await readIdbStatus();
      let decision=chooseSnapshot(local,idb);
      if(decision.kind==="unresolved"){
        if(!candidate||!recoveryChoiceMatches(candidate,decision))return decision;
        decision={kind:"chosen",snapshot:cloneSnapshot(candidate.snapshot),source:candidate.source,
          heal:candidate.source==="local"?"idb":"local"}}
      if(decision.kind==="chosen"){
        const sourceReplica=sourceReplicaForCarrierDecision(decision,local,idb);
        /** @type {import('./contracts.js').NormalizedRecovery|{kind:'full-recovery'}} */
        let normalized;
        try{normalized=await normalizeRecoveryCarrierSnapshot(decision.snapshot,sourceReplica)}
        catch{normalized={kind:"full-recovery"}};
        if(normalized.kind==="full-recovery")
          return{kind:"unresolved",reason:"no-valid",
            local:{...local,status:"invalid"},idb:{...idb,status:"invalid"}};
        if(normalized.kind==="known"){
          decision.snapshot=normalized.snapshot;
          decision.recoveryChanged=!!normalized.changed}}
      let head=decision.kind==="first-run"?null:cloneSnapshot(decision.snapshot),replayed=false,draftConflict=false;
      const storedTransaction=head&&pendingDraftTransaction(head);
      if(storedTransaction){
        const storedRecord=readPendingJournal().entries.find(record=>record.journal.id===storedTransaction.id)||null;
        const finalized=finalizedDraftTransactionSnapshot(/** @type {StoredSnapshot} */(head));
        const execution=await executeDraftTransaction({record:storedRecord,
          transactionId:storedTransaction.id,effect:storedTransaction.effect,prepared:head,
          snapshot:finalized,io:storageIO,writePrepared:false,
          preparedResult:{revision:readRevision(head),localOk:true,idbOk:true}});
        if(!execution.settled||
          (execution.kind!=="committed"&&execution.kind!=="rejected"&&execution.kind!=="compensated"))
          return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
        head=/** @type {StoredSnapshot} */(execution.snapshot);
        draftConflict=execution.kind!=="committed";
        replayed=true;
        decision={kind:"chosen",snapshot:head,source:"pending"}}
      const pending=readPendingJournal();
      for(const invalid of pending.invalid)clearPendingJournal(invalid);
      for(const record of pending.entries){
        const journal=record.journal;
        if(journal.customMutationIntent){
          const resolveIntent=resolveCustomMutationIntent;
          if(typeof resolveIntent!=="function")
            return{kind:"unresolved",reason:"custom-mutation-recovery-unavailable",
              local:readLocalStatus(),idb:await readIdbStatus()};
          let resolution;
          try{resolution=await resolveIntent({head:cloneSnapshot(head||journal.base),journal:cloneSnapshot(journal)})}
          catch{resolution=null}
          if(!resolution?.ok||!resolution.snapshot||typeof resolution.verify!=="function")
            return{kind:"unresolved",reason:"custom-mutation-intent-invalid",
              local:readLocalStatus(),idb:await readIdbStatus()};
          let candidate=cloneSnapshot(resolution.snapshot);
          if(!isValidStateShape(candidate)||pendingDraftTransaction(candidate))
            return{kind:"unresolved",reason:"custom-mutation-candidate-invalid",
              local:readLocalStatus(),idb:await readIdbStatus()};
          if(!storageSnapshotsEqual(candidate,head)){
            const revision=readRevision(head);
            if(revision>=Number.MAX_SAFE_INTEGER)
              return{kind:"unresolved",reason:"custom-mutation-revision-exhausted",
                local:readLocalStatus(),idb:await readIdbStatus()};
            candidate[STORAGE_REV]=revision+1;
          }
          let safe;
          try{safe=await resolution.verify(cloneSnapshot(candidate))}catch{safe=null}
          if(!safe?.ok)
            return{kind:"unresolved",reason:safe?.code||"custom-mutation-candidate-unsafe",
              local:readLocalStatus(),idb:await readIdbStatus()};
          let localNow=readLocalStatus(),idbNow=await readIdbStatus();
          const bothMatch=localNow.status==="valid"&&idbNow.status==="valid"&&
            storageSnapshotsEqual(localNow.parsed,candidate)&&storageSnapshotsEqual(idbNow.parsed,candidate);
          if(!bothMatch){
            const written=await writeSnapshot(candidate,storageIO);
            localNow=readLocalStatus();idbNow=await readIdbStatus();
            const replicasMatch=localNow.status==="valid"&&idbNow.status==="valid"&&
              storageSnapshotsEqual(localNow.parsed,candidate)&&storageSnapshotsEqual(idbNow.parsed,candidate);
            let postWriteSafe=null;
            if(replicasMatch){try{postWriteSafe=await resolution.verify(cloneSnapshot(/** @type {StoredSnapshot} */(localNow.parsed)))}catch{}}
            if(!written.localOk||!written.idbOk||!replicasMatch||!postWriteSafe?.ok)
              return{kind:"unresolved",reason:"custom-mutation-recovery-write-failed",
                local:localNow,idb:idbNow};
          }
          const currentRecord=readPendingJournal().entries.find(item=>item.journal.id===journal.id);
          if(!currentRecord||currentRecord.raw!==record.raw)
            return{kind:"unresolved",reason:"custom-mutation-journal-changed",
              local:readLocalStatus(),idb:await readIdbStatus()};
          const closed=await executeDraftTransaction({record:currentRecord,
            transactionId:journal.id,effect:journal.effectOutcome,discard:true});
          if(!closed.settled)
            return{kind:"unresolved",reason:"custom-mutation-journal-pending",
              local:readLocalStatus(),idb:await readIdbStatus()};
          head=candidate;
          replayed=true;
          continue;
        }
        if(journal.preflightPending){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"preflight-pending-journal",
              local:readLocalStatus(),idb:await readIdbStatus()};
          draftConflict=true;
          continue}
        if(journal.effectOutcome.status===DRAFT_EFFECT_INVALID){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          draftConflict=true;
          continue}
        // A setup activation can leave its journal behind after the durable
        // successor is committed but before the separate setup draft is
        // consumed. Treat that journal as settled; replaying it would archive
        // the successor a second time after a crash.
        const setupMarker=journal.proposal?.[STORAGE_SETUP_TXN];
        if(setupActivationAlreadyCommitted(head,journal.proposal,/** @type {{raw?:unknown}|null|undefined} */(setupMarker)?.raw)){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          continue}
        if(isAmbiguousLegacyRecoveryJournalMutation(journal)){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          continue}
        // A recovery journal without a rollback snapshot was written before the
        // lock-held preparation boundary. It is intent only, never a durable
        // block start, so discard it without replaying or advancing state. A
        // prepared journal is replayed only while the acknowledged DraftV2
        // boundary is still clear; a draft created after it was armed survives
        // untouched and the pending start is discarded.
        if(isRecoveryJournalAttempt(journal)&&(!journal.rollback||blockStartDraftGuard(head))){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          continue}
        if(journal.transitionPayloadMalformed){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          continue}
        if(pendingJournalSuccessorMatches(record,head)){
          const prepared=preparePendingDraftTransaction(
            /** @type {StoredSnapshot} */(head),/** @type {StoredSnapshot} */(journal.rollback),journal.effectOutcome,journal.id);
          const execution=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,prepared,snapshot:/** @type {StoredSnapshot} */(head),io:storageIO,writePrepared:false,
            preparedResult:{revision:readRevision(head),localOk:true,idbOk:true}});
          if(!execution.settled||
            (execution.kind!=="committed"&&execution.kind!=="rejected"&&execution.kind!=="compensated"))
            return{kind:"unresolved",reason:"pending-transaction",
              local:readLocalStatus(),idb:await readIdbStatus()};
          head=/** @type {StoredSnapshot} */(execution.snapshot);
          if(execution.kind!=="committed")draftConflict=true;
          replayed=true;
          continue}
        if(transitionJournalAttempt(journal.proposal,journal.base)&&
          !isCoherentTransitionProposal(journal.proposal,journal.base)&&
          !isCoherentLegacyReplacement(journal.proposal,journal.base)){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
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
        if(journal.expectedBlockId!==undefined&&snapshotBlockId(head)!==journal.expectedBlockId){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          continue}
        if(journal.expectedStorageRevision!==null&&
          readRevision(head)!==journal.expectedStorageRevision){
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
        if(missingCustomProgramReference(journal.base,snapshot,{replace:journal.replace})||
          missingCustomProgramReference(journalHead,snapshot,{replace:journal.replace})){
          const discarded=await executeDraftTransaction({record,transactionId:journal.id,
            effect:journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
          draftConflict=true;
          continue}
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
        head=/** @type {StoredSnapshot} */(execution.snapshot);
        if(execution.kind!=="committed")draftConflict=true;
        replayed=true}
      if(!(await settleOrphanDraftArtifacts(head)).settled)
        return{kind:"unresolved",reason:"pending-transaction",local:readLocalStatus(),idb:await readIdbStatus()};
      if(replayed)return{kind:"chosen",snapshot:head,source:"pending",draftConflict,
        recoveryChanged:!!decision.recoveryChanged};
      if(decision.kind==="chosen"&&decision.heal&&!decision.recoveryChanged)
        await writeSnapshot(cloneSnapshot(decision.snapshot),storageIO);
      return Object.assign({},decision,{draftConflict})}

  /** @param {import('./contracts.js').RecoveryChoice|null} [candidate] */
  async function resolveBootReplicas(candidate=null){
    return withStorageLock(storageIO,()=>resolveBootReplicasLocked(candidate));
  }

  async function readDurableState(){
    return enqueueWrite(()=>withStorageLock(storageIO,async()=>{
      const refreshed=await refreshPersistenceHead();
      const head=cloneSnapshot(refreshed.head||persistHead);
      const pending=readPendingJournal();
      return{ok:!refreshed.conflict,conflict:!!refreshed.conflict,head,
        revision:readRevision(head),pendingJournal:pending.entries.length>0||pending.invalid.length>0};
    }));
  }

  /** @param {string} name @param {unknown} [payload] */
  async function runDurableStateTestHook(name,payload){
    const hook=platform.__repforgeDurableStateTestHooks?.[name];
    if(typeof hook==="function")await hook(payload);
  }

  /** @param {{verify?:(snapshot:StoredSnapshot)=>import('./contracts.js').SemanticCheck|Promise<import('./contracts.js').SemanticCheck>;pendingJournalId?:string|null}} [options] */
  async function settleHistoryAlreadyCommitted({verify,pendingJournalId=null}={}){
    return enqueueWrite(()=>withStorageLock(storageIO,async()=>{
      await runDurableStateTestHook("durableSettlementLockHeld");
      let refreshed=await refreshPersistenceHead();
      let head=cloneSnapshot(refreshed.head||persistHead);
      if(refreshed.conflict||!isValidStateShape(head))
        return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,code:"history_settlement_unresolved",head});

      // An already-committed preflight may have failed to close its own WAL
      // entry. Reconcile only that entry: another document can have queued an
      // unrelated journal behind this lock and must remain untouched.
      if(typeof pendingJournalId==="string"&&pendingJournalId){
        const record=readPendingJournal().entries.find(item=>item.journal.id===pendingJournalId);
        if(record){
          const discarded=await executeDraftTransaction({record,transactionId:record.journal.id,
            effect:record.journal.effectOutcome,discard:true});
          if(!discarded.settled)
            return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
              pendingJournalCleanup:true,code:"history_settlement_pending",head});
        }
        refreshed=await refreshPersistenceHead();
        head=cloneSnapshot(refreshed.head||persistHead);
        if(refreshed.conflict||!isValidStateShape(head))
          return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
            conflict:true,code:"history_settlement_unresolved",head});
      }

      let checked;
      try{checked=typeof verify==="function"?await verify(cloneSnapshot(head)):null}
      catch{return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
        conflict:true,code:"history_settlement_unresolved",head})}
      if(!checked?.ok)
        return normalizeDurableOutcome({revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,code:checked?.code||"history_settlement_mismatch",head});

      const localBefore=readLocalStatus(),idbBefore=await readIdbStatus();
      const replicasSettled=localBefore.status==="valid"&&idbBefore.status==="valid"&&
        storageSnapshotsEqual(localBefore.parsed,idbBefore.parsed);
      if(replicasSettled){
        persistHead=cloneSnapshot(head);
        return normalizeDurableOutcome({revision:readRevision(head),localOk:true,idbOk:true,
          alreadyCommitted:true,head});
      }

      // The lock remains held across the authoritative reread, semantic check,
      // dual-replica write, and post-write proof. No unrelated writer can land
      // between the head we verified and the bytes we heal from it.
      const written=await writeSnapshot(head,storageIO);
      const local=readLocalStatus(),idb=await readIdbStatus();
      const healedReplicasSettled=local.status==="valid"&&idb.status==="valid"&&
        storageSnapshotsEqual(local.parsed,idb.parsed);
      const ownJournalPending=typeof pendingJournalId==="string"&&pendingJournalId&&
        readPendingJournal().entries.some(item=>item.journal.id===pendingJournalId);
      if(!written.localOk||!written.idbOk||!healedReplicasSettled||ownJournalPending)
        return normalizeDurableOutcome({revision:readRevision(head),localOk:!!written.localOk,idbOk:!!written.idbOk,
          conflict:true,pendingJournalCleanup:!!ownJournalPending,
          code:ownJournalPending?"history_settlement_pending":"history_settlement_unresolved",head});
      persistHead=cloneSnapshot(head);
      return normalizeDurableOutcome({revision:readRevision(head),localOk:true,idbOk:true,
        alreadyCommitted:true,head});
    }));
  }

  /** @param {import('./contracts.js').CustomSettlementOptions} [options] */
  async function settleCustomExerciseMutation({verify,recover=null,pendingJournalId=null}={}){
    if(typeof verify!=="function")
      return normalizeDurableOutcome({localOk:false,idbOk:false,conflict:true,
        code:"custom_settlement_verifier_missing"});
    return enqueueWrite(()=>withStorageLock(storageIO,async()=>{
      await runDurableStateTestHook("durableSettlementLockHeld",{pendingJournalId});
      const ownPending=()=>typeof pendingJournalId==="string"&&pendingJournalId
        ?readPendingJournal().entries.find(item=>item.journal.id===pendingJournalId)||null:null;
      /** @param {string} code @param {StoredSnapshot|null} [head] */
      const unresolved=async(code,head=null)=>{
        const local=readLocalStatus(),idb=await readIdbStatus();
        const record=ownPending();
        return normalizeDurableOutcome({revision:readRevision(head||persistHead),
          localOk:local.status==="valid",idbOk:idb.status==="valid",deferred:true,
          pendingJournalCleanup:!!record,pendingJournalId:record?.journal.id||undefined,
          code,head:head&&cloneSnapshot(head)});
      };
      /** @param {StoredSnapshot} snapshot @param {import('./contracts.js').Journal|null} [journal] */
      const verifySnapshot=async(snapshot,journal=null)=>{
        try{return await verify({snapshot:cloneSnapshot(snapshot),journal:journal&&cloneSnapshot(journal)})}
        catch{return null}};
      /** @param {StoredSnapshot} snapshot @param {import('./contracts.js').Journal|null} journal @param {string} code @param {string} stage */
      const recoverSnapshot=async(snapshot,journal,code,stage)=>{
        if(typeof recover!=="function")return null;
        try{return await recover({snapshot:cloneSnapshot(snapshot),journal:journal&&cloneSnapshot(journal),code,stage})}
        catch{return null}};
      /** @param {StoredSnapshot} snapshot @param {import('./contracts.js').SemanticRecovery} recovery @param {import('./contracts.js').PendingJournal|null} record */
      const finishSemanticRecovery=async(snapshot,recovery,record)=>{
        if(!recovery?.snapshot||!isValidStateShape(recovery.snapshot)||
          pendingDraftTransaction(recovery.snapshot))return unresolved("custom_recovery_candidate_invalid",snapshot);
        let candidate=cloneSnapshot(recovery.snapshot);
        if(!storageSnapshotsEqual(candidate,snapshot)){
          const revision=readRevision(snapshot);
          if(revision>=Number.MAX_SAFE_INTEGER)return unresolved("custom_recovery_revision_exhausted",snapshot);
          candidate[STORAGE_REV]=revision+1;
        }
        let ownedRecord=record;
        if(record){
          const current=ownPending();
          if(!current||current.raw!==record.raw)
            return unresolved("custom_settlement_journal_changed",snapshot);
          // A custom Delete journal carries immutable intent and its source
          // definition. Keep those original bytes as the recovery authority;
          // boot can recompute the safe candidate from the then-current head
          // if a replica write or journal close is interrupted.
          if(current.journal.customMutationIntent)ownedRecord=current;
          else{
            ownedRecord=rewritePendingJournalProposal(current,candidate,recovery.journalMarker);
            if(!ownedRecord)return unresolved("custom_recovery_journal_rewrite_failed",snapshot)}
        }else{
          ownedRecord=writePendingJournal(snapshot,snapshot,candidate,
            {customMutationRecovery:recovery.journalMarker});
          if(!ownedRecord)return unresolved("custom_recovery_journal_write_failed",snapshot);
          pendingJournalId=ownedRecord.journal.id;
        }
        let local=readLocalStatus(),idb=await readIdbStatus();
        const replicasAlreadyMatch=local.status==="valid"&&idb.status==="valid"&&
          storageSnapshotsEqual(local.parsed,candidate)&&storageSnapshotsEqual(idb.parsed,candidate);
        if(!replicasAlreadyMatch){
          const written=await writeSnapshot(candidate,storageIO);
          local=readLocalStatus();idb=await readIdbStatus();
          const same=local.status==="valid"&&idb.status==="valid"&&
            storageSnapshotsEqual(local.parsed,candidate)&&storageSnapshotsEqual(idb.parsed,candidate);
          if(!written.localOk||!written.idbOk||!same)
            return unresolved("custom_recovery_replica_write_failed",candidate);
        }
        /** @param {StoredSnapshot} value */
        const validate=async value=>{
          try{return typeof recovery.verify==="function"?await recovery.verify(cloneSnapshot(value)):{ok:true}}
          catch{return null}};
        const repaired=await validate(candidate);
        if(!repaired?.ok)return unresolved("custom_recovery_candidate_invalid",candidate);
        if(ownedRecord){
          const current=ownPending();
          if(!current||current.raw!==ownedRecord.raw)
            return unresolved("custom_settlement_journal_changed",candidate);
          const closed=await executeDraftTransaction({record:current,
            transactionId:current.journal.id,effect:current.journal.effectOutcome,discard:true});
          if(!closed.settled)return unresolved("custom_settlement_journal_pending",candidate);
        }
        local=readLocalStatus();idb=await readIdbStatus();
        if(local.status!=="valid"||idb.status!=="valid"||
          !storageSnapshotsEqual(local.parsed,candidate)||!storageSnapshotsEqual(idb.parsed,candidate)||
          ownPending())return unresolved("custom_recovery_replica_write_failed",candidate);
        const liveBase=cloneSnapshot(persistHead||candidate);
        persistHead=cloneSnapshot(candidate);
        applyAcceptedSnapshot(liveBase,candidate);
        return normalizeDurableOutcome({revision:readRevision(candidate),localOk:true,idbOk:true,
          conflict:true,code:recovery.code||"custom_mutation_recovered",
          semanticRecovery:true,head:candidate});
      };

      // Reconcile the current durable head first. Custom mutations have no
      // draft side effect, so an owned journal can be closed once the exact
      // semantic result is already present. Running the boot replay loop here
      // would also consume unrelated queued journals and could replay this
      // already-written proposal as a second revision.
      let owner=ownPending();
      if(owner){
        const owned=await verifySnapshot(owner.journal.proposal,owner.journal);
        if(owner.journal.customMutationRecovery){
          const recoveryOwner=await recoverSnapshot(owner.journal.proposal,owner.journal,
            owned?.code||"custom_settlement_recovered_owner","journal");
          if(!recoveryOwner?.owned)return unresolved("custom_settlement_ownership_mismatch");
        }else if(!owned?.ok)return unresolved(owned?.code||"custom_settlement_ownership_mismatch");
        if(owner.journal.effectOutcome.status!==DRAFT_EFFECT_NONE||owner.journal.recoveryTransaction)
          return unresolved("custom_settlement_journal_not_custom");
      }

      const refreshed=await refreshPersistenceHead();
      let refreshedHead=cloneSnapshot(refreshed.head||persistHead);
      if(refreshed.conflict||!isValidStateShape(refreshedHead)||pendingDraftTransaction(refreshedHead))
        return unresolved("custom_settlement_unresolved",refreshedHead);
      const refreshedCheck=await verifySnapshot(refreshedHead);
      if(owner?.journal.customMutationRecovery||!refreshedCheck?.ok){
        const recovery=await recoverSnapshot(refreshedHead,owner?.journal||null,
          refreshedCheck?.code||"custom_settlement_mismatch","head");
        if(recovery?.snapshot)
          return finishSemanticRecovery(refreshedHead,recovery,owner);
        return unresolved(refreshedCheck?.code||"custom_settlement_mismatch",refreshedHead);
      }

      if(owner){
        const currentOwner=ownPending();
        if(!currentOwner||currentOwner.raw!==owner.raw)
          return unresolved("custom_settlement_journal_changed",refreshedHead);
        const closed=await executeDraftTransaction({record:currentOwner,
          transactionId:currentOwner.journal.id,effect:currentOwner.journal.effectOutcome,discard:true});
        if(!closed.settled)return unresolved("custom_settlement_journal_pending",refreshedHead);
      }

      const localBefore=readLocalStatus(),idbBefore=await readIdbStatus();
      const decision=chooseSnapshot(localBefore,idbBefore);
      if(decision.kind!=="chosen"||!isValidStateShape(decision.snapshot)||
        pendingDraftTransaction(decision.snapshot))
        return unresolved("custom_settlement_unresolved");
      let head=cloneSnapshot(decision.snapshot);
      const checked=await verifySnapshot(head);
      if(!checked?.ok)return unresolved(checked?.code||"custom_settlement_mismatch",head);
      if(ownPending())return unresolved("custom_settlement_journal_pending",head);

      const replicasSettled=localBefore.status==="valid"&&idbBefore.status==="valid"&&
        storageSnapshotsEqual(localBefore.parsed,idbBefore.parsed);
      if(!replicasSettled){
        // The semantic operation is present in the authoritative durable head.
        // Heal that exact revision under the same lock; do not mint a second
        // proposal or consume an unrelated journal.
        const written=await writeSnapshot(head,storageIO);
        const localAfter=readLocalStatus(),idbAfter=await readIdbStatus();
        const settled=localAfter.status==="valid"&&idbAfter.status==="valid"&&
          storageSnapshotsEqual(localAfter.parsed,idbAfter.parsed);
        const verified=settled?await verifySnapshot(localAfter.parsed):null;
        if(!written.localOk||!written.idbOk||!settled||!verified?.ok||ownPending())
          return unresolved(verified?.code||"custom_settlement_replica_write_failed",head);
        head=cloneSnapshot(localAfter.parsed);
      }

      if(ownPending())return unresolved("custom_settlement_journal_pending",head);
      const liveBase=cloneSnapshot(persistHead||head);
      persistHead=cloneSnapshot(head);
      applyAcceptedSnapshot(liveBase,head);
      return normalizeDurableOutcome({revision:readRevision(head),localOk:true,idbOk:true,
        alreadyCommitted:true,head});
    }));
  }

  async function settlePendingJournal(){
    const before=readPendingJournal();
    if(!before.entries.length&&!before.invalid.length)
      return normalizeDurableOutcome({localOk:false,idbOk:false,
        pendingJournalCleanup:true,code:"journal_cleanup_pending"});
    const decision=await resolveBootReplicas();
    const remaining=readPendingJournal();
    const snapshot=/** @type {StoredSnapshot|null|undefined} */('snapshot' in decision?decision.snapshot:null)||persistHead;
    if(decision?.kind==="unresolved"||remaining.entries.length||remaining.invalid.length)
      return normalizeDurableOutcome({revision:readRevision(snapshot),localOk:false,idbOk:false,
        pendingJournalCleanup:true,code:"journal_cleanup_pending"});
    return normalizeDurableOutcome({revision:readRevision(snapshot),localOk:true,idbOk:true,
      alreadyCommitted:true});
  }

  /** @param {import('./contracts.js').RecoveryChoice|null} candidate @param {{local:import('./contracts.js').ReplicaRead,idb:import('./contracts.js').ReplicaRead}} current @returns {boolean} */
  function recoveryChoiceMatches(candidate,current){
    if(candidate?.kind!=="chosen"||(candidate.source!=="local"&&candidate.source!=="idb"))return false;
    const selected=candidate.source==="local"?current.local:current.idb;
    return selected?.status==="valid"&&storageSnapshotsEqual(selected.parsed,candidate.snapshot)}

  /** @param {import('./contracts.js').EffectInput} effect */
  function pendingDraftPostEffectAccepted(effect){
    const outcome=normalizeDraftEffectOutcome(effect);
    if(outcome.status===DRAFT_EFFECT_NONE)return true;
    if(outcome.status!==DRAFT_EFFECT_VALID)return false;
    const receipt=outcome.effect;
    if(!draftEffectRequiresCoordination(outcome))return true;
    try{
      const read=DraftStore.readCanonicalStatus();if(read.status!=="ok")return false;
      const currentRaw=read.raw;
      if(receipt.kind==="clear-draft"){
        if(currentRaw==null)return true;
        const after=pendingJournalEffectState(receipt);
        return receipt.precondition===DRAFT_PRECONDITION_ABORT_SAME_DAY&&after.status==="mismatch"}
      if(currentRaw===receipt.replacementRaw)return true;
      const after=pendingJournalEffectState(receipt);
      return after.status==="missing"||after.status==="mismatch"}
    catch{return false}}

  /** @param {import('./contracts.js').EffectInput} effect @param {string|null} transactionId @param {string|null} [contextFingerprint] */
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

  /** @param {import('./contracts.js').EffectInput} effect @param {string|null} transactionId @param {string|null} [contextFingerprint] */
  function pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint=null){
    const related=()=>pendingDraftRelatedState(effect,transactionId,contextFingerprint);
    let pending=related();
    if(pending.entries.length||pending.invalid.length)return false;
    const accepted=pendingDraftPostEffectAccepted(effect);
    pending=related();
    return accepted&&!pending.entries.length&&!pending.invalid.length}

  /** @param {import('./contracts.js').EffectInput} effect @param {ReturnType<typeof pendingJournalEffectState>} checked @param {string|null} transactionId @param {string|null} [contextFingerprint] */
  function pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint=null){
    const outcome=normalizeDraftEffectOutcome(effect);
    if(outcome.status===DRAFT_EFFECT_INVALID)return false;
    if(outcome.status===DRAFT_EFFECT_NONE||!draftEffectRequiresCoordination(outcome))return true;
    if(checked.status==="conflict")return false;
    return pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint)}

  /** @param {unknown} value @returns {string[]|null} */
  function normalizeJournalSessionIds(value){
    if(value==null)return[];
    if(!Array.isArray(value)||value.length>1000)return null;
    /** @type {string[]} */const ids=[];
    for(const id of value){
      if(typeof id!=="string"||!id||id.length>300)return null;
      if(!ids.includes(id))ids.push(id)}
    return ids}

  /** @param {unknown} value @returns {import('./contracts.js').DayRename[]|null} */
  function normalizeJournalDayRenames(value){
    if(value==null)return[];
    if(!Array.isArray(value)||value.length>100)return null;
    const renames=[];
    for(const entry of value){
      if(!isPlainStateObject(entry)||typeof entry.from!=="string"||!entry.from||
        typeof entry.to!=="string"||!entry.to||entry.from.length>200||entry.to.length>200)return null;
      renames.push({from:entry.from,to:entry.to})}
    return renames}

  /** @param {unknown} marker @returns {marker is import('./contracts.js').SetupActivation} */
  function isValidSetupActivationMarker(marker){
    return isPlainStateObject(marker)&&marker.version===1&&
      typeof marker.programId==="string"&&marker.programId.length>0&&marker.programId.length<=128&&
      typeof marker.raw==="string"&&marker.raw.length>0&&marker.raw.length<=70000&&
      (!Object.prototype.hasOwnProperty.call(marker,"revision")||
        (Number.isInteger(marker.revision)&&/** @type {number} */(marker.revision)>=1))}

  /** @param {import('./contracts.js').PendingJournal|null} record */
  function retainPendingJournal(record){
    if(!record)return false;
    try{
      const current=platform.localStorage.getItem(record.key);
      if(current===record.raw)return true;
      if(current!=null)return false;
      platform.localStorage.setItem(record.key,record.raw);
      return platform.localStorage.getItem(record.key)===record.raw}
    catch{return false}}

  /** @param {StoredSnapshot} snapshot @param {import('./contracts.js').DayRename[]} dayRenames */
  function reconcileExplicitLogDayRenames(snapshot,dayRenames){
    if(!Array.isArray(snapshot?.log)||!dayRenames.length)return snapshot;
    for(const {from,to} of dayRenames){
      const sessions=new Set(snapshot.log.filter(row=>row?.day===from&&row.session).map(row=>row.session));
      for(const row of snapshot.log){
        if(row?.day===from||row?.session&&sessions.has(row.session))row.day=to}}
    return snapshot}

  /** @param {StoredSnapshot} snapshot @param {string[]} sessionIds */
  function reconcileCandidateLogDays(snapshot,sessionIds){
    if(!Array.isArray(snapshot?.program)||!Array.isArray(snapshot?.log)||!sessionIds.length)return snapshot;
    /** @type {Map<unknown,unknown>} */
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

  /** @param {StoredSnapshot|null} snapshot */
  function recoveryJournalCarrier(snapshot){
    const carrier=snapshot?.recoveryTransitions;
    if(carrier===undefined)return{records:[],quarantine:[]};
    return isValidRecoveryTransitions(carrier)
      ?{records:carrier.records,quarantine:carrier.quarantine}:null;
  }

  /** @param {StoredSnapshot} base @param {StoredSnapshot} proposal @param {{ignoreBlockId?:boolean;ignoreRecoveryLifecycle?:boolean;recoveryStartRecord?:import('./snapshot.js').RecoveryRecord|null}} [options] */
  function recoveryJournalNonCarrierEqual(base,proposal,{
    ignoreBlockId=false,
    ignoreRecoveryLifecycle=false,
    recoveryStartRecord=null}={}){
    const left=cloneSnapshot(base),right=cloneSnapshot(proposal);
    if(!isPlainStateObject(left?.programMeta)||!isPlainStateObject(right?.programMeta))return false;
    delete left.recoveryTransitions;
    delete right.recoveryTransitions;
    if(ignoreBlockId){
      delete left.programMeta.blockId;
      delete right.programMeta.blockId}
    if(recoveryStartRecord){
      const confirmedAt=recoveryStartRecord.confirmedAt;
      if(typeof confirmedAt!=="string"||!/^\d{4}-\d{2}-\d{2}T/.test(confirmedAt)||
        right.programMeta.started!==confirmedAt.slice(0,10)||
        right.programMeta.mesocycleStatus!=="active"||
        right.programMeta.updated!==confirmedAt)return false;
      for(const key of["started","mesocycleStatus","updated"])
        right.programMeta[key]=left.programMeta[key];
    }else if(ignoreRecoveryLifecycle){
      for(const key of["started","mesocycleStatus","updated"]){
        delete left.programMeta[key];
        delete right.programMeta[key]}}
    return storageSnapshotsEqual(left,right);
  }

  /** @param {import('./contracts.js').Journal|null} journal */
  function classifyLegacyRecoveryJournal(journal){
    if(!journal||journal.recoveryTransactionPresent===true)return null;
    const base=journal.base,proposal=journal.proposal;
    if(!isPlainStateObject(base)||!isPlainStateObject(proposal)||
      !isPlainStateObject(base.programMeta)||!isPlainStateObject(proposal.programMeta)||
      base.programMeta.id!==proposal.programMeta.id)return null;
    const sourceBlock=base.programMeta.blockId,targetBlock=proposal.programMeta.blockId;
    if(!isValidBlockId(sourceBlock,base.programMeta.id)||
      !isValidBlockId(targetBlock,proposal.programMeta.id))return null;
    const baseCarrier=recoveryJournalCarrier(base),proposalCarrier=recoveryJournalCarrier(proposal);
    if(!baseCarrier||!proposalCarrier)return null;
    if(journal.expectedProgramId!==base.programMeta.id||journal.expectedBlockId!==sourceBlock||
      !Number.isInteger(journal.expectedStorageRevision)||/** @type {number} */(journal.expectedStorageRevision)<0)return null;

    const before=baseCarrier.records,after=proposalCarrier.records;
    const sameQuarantine=storageSnapshotsEqual(baseCarrier.quarantine,proposalCarrier.quarantine);
    if(!sameQuarantine)return null;
    if(targetBlock!==sourceBlock&&after.length===before.length+1&&
      before.every((record,index)=>transitionRecordEqual(record,after[index]))){
      const appended=after.at(-1),overlay=appended?.diff?.recoveryWeek;
      const targetWasAbsent=!before.some(record=>record?.diff?.recoveryWeek?.blockId===targetBlock);
      if(targetWasAbsent&&appended&&appended?.predecessor?.programId===base.programMeta.id&&
        appended.predecessor.blockId===sourceBlock&&
        appended.predecessor.durableRevision===journal.expectedStorageRevision&&
        overlay?.blockId===targetBlock&&overlay?.reassessmentOutcome===null&&
        typeof journal.expectedProgramFingerprint==="string"&&
        draftProgramFingerprint(base)===journal.expectedProgramFingerprint&&
        recoveryJournalNonCarrierEqual(base,proposal,{
          ignoreBlockId:true,recoveryStartRecord:appended}))
        return"start";
      return null;
    }

    // Reassessment is the legacy outcome-only mutation. It intentionally does
    // not qualify as a recovery journal attempt: generic replay must preserve
    // its old unmarked R->R+1 semantics.
    if(targetBlock===sourceBlock&&after.length===before.length&&
      recoveryJournalNonCarrierEqual(base,proposal)&&
      before.length>0){
      let changed=-1;
      for(let index=0;index<before.length;index++){
        if(transitionRecordEqual(before[index],after[index]))continue;
        if(changed!==-1)return"other";
        const beforeOverlay=before[index]?.diff?.recoveryWeek;
        const afterOverlay=after[index]?.diff?.recoveryWeek;
        if(beforeOverlay?.reassessmentOutcome!==null||
          !["Better","About the same","Worse"].includes(/** @type {string} */(afterOverlay?.reassessmentOutcome))||
          !isPlainStateObject(beforeOverlay)||!isPlainStateObject(afterOverlay))return"other";
        const beforeCopy=cloneSnapshot(before[index]),afterCopy=cloneSnapshot(after[index]);
        beforeCopy.diff.recoveryWeek.reassessmentOutcome=null;
        afterCopy.diff.recoveryWeek.reassessmentOutcome=null;
        if(!transitionRecordEqual(beforeCopy,afterCopy))return"other";
        changed=index;
      }
      if(changed!==-1)return"reassessment";
    }
    return null;
  }

  /** @param {import('./contracts.js').Journal|null} journal */
  function isAmbiguousLegacyRecoveryJournalMutation(journal){
    if(!journal||journal.recoveryTransactionPresent===true)return false;
    const classified=classifyLegacyRecoveryJournal(journal);
    if(classified==="start"||classified==="reassessment")return false;
    const base=journal.base,proposal=journal.proposal;
    if(!isPlainStateObject(base)||!isPlainStateObject(proposal)||
      !isPlainStateObject(base.programMeta)||!isPlainStateObject(proposal.programMeta)||
      base.programMeta.id!==proposal.programMeta.id)return false;
    const sourceBlock=base.programMeta.blockId,targetBlock=proposal.programMeta.blockId;
    if(!isValidBlockId(sourceBlock,base.programMeta.id)||
      !isValidBlockId(targetBlock,proposal.programMeta.id)||
      !recoveryJournalNonCarrierEqual(base,proposal,{
        ignoreBlockId:true,ignoreRecoveryLifecycle:true}))return false;
    const baseCarrier=recoveryJournalCarrier(base),proposalCarrier=recoveryJournalCarrier(proposal);
    if(!baseCarrier||!proposalCarrier||
      storageSnapshotsEqual(baseCarrier,proposalCarrier))return false;
    const hasRecoveryRecord=[...baseCarrier.records,...proposalCarrier.records].some(record=>
      record?.kind==="recovery_week"&&record?.status==="committed");
    if(!hasRecoveryRecord)return false;
    return true;
  }

  /** @param {import('./contracts.js').Journal|null} journal */
  function isRecoveryJournalAttempt(journal){
    if(journal?.recoveryTransaction===true){
      const proposalCarrier=journal?.proposal?.recoveryTransitions;
      if(!isValidRecoveryTransitions(proposalCarrier))return false;
      return proposalCarrier.records.some(record=>
        record?.kind==="recovery_week"&&record?.status==="committed");
    }
    return classifyLegacyRecoveryJournal(journal)==="start";
  }

  /** @param {unknown} a @param {unknown} b */
  function transitionRecordEqual(a,b){
    if(a==null||b==null)return a==b;
    return storageSnapshotsEqual(a,b)}

  /** @param {StoredSnapshot} snapshot */
  function rawTransitionMetadataMalformed(snapshot){
    if(!isPlainStateObject(snapshot))return false;
    const meta=isPlainStateObject(snapshot.programMeta)?snapshot.programMeta:null;
    if(meta?.transitionIn!=null&&!isCoherentV1TransitionIn(meta.transitionIn))return true;
    const history=Array.isArray(snapshot.programHistory)?snapshot.programHistory:[];
    for(const row of history){
      if(!isPlainStateObject(row))continue;
      if(row.transitionOut!=null&&!isCoherentV1TransitionOut(row.transitionOut))return true;
      if(/** @type {{transitionIn?:unknown}|null|undefined} */(row.meta)?.transitionIn!=null&&!isCoherentV1TransitionIn(/** @type {{transitionIn?:unknown}} */(row.meta).transitionIn))return true;
    }
    return false;
  }

  /** @param {unknown} value @param {(value:unknown)=>boolean} validator */
  function classifyInheritedTransitionValue(value,validator){
    if(value==null)return "absent";
    return validator(value)?"supported-v1":"unknown-or-malformed"}

  /** @param {StoredSnapshot} snapshot */
  function extractTransitionOutMap(snapshot){
    const history=Array.isArray(snapshot?.programHistory)?snapshot.programHistory:[];
    /** @type {Map<string,import('./contracts.js').TransitionOut>} */
    const map=new Map();
    let invalid=false;
    for(const h of history){
      if(!isPlainStateObject(h)){invalid=true;break}
      const toutStatus=classifyInheritedTransitionValue(h.transitionOut,isCoherentV1TransitionOut);
      if(toutStatus==="absent")continue;
      const aid=typeof h.archiveId==="string"&&h.archiveId.trim()?h.archiveId.trim():null;
      const hid=typeof h.id==="string"&&h.id.trim()?h.id.trim():null;
      if(toutStatus!=="supported-v1"||!aid||!hid||aid!==hid||map.has(aid)){
        invalid=true;break}
      map.set(aid,/** @type {import('./contracts.js').TransitionOut} */(h.transitionOut))}
    return{map,invalid}}

  /** @param {StoredSnapshot} snapshot */
  function classifyInheritedProvenance(snapshot){
    const meta=isPlainStateObject(snapshot?.programMeta)?snapshot.programMeta:null;
    const history=Array.isArray(snapshot?.programHistory)?snapshot.programHistory:[];
    const transitionIn=classifyInheritedTransitionValue(meta?.transitionIn,isCoherentV1TransitionIn);
    const transitionOut=extractTransitionOutMap(snapshot);
    if(transitionIn==="unknown-or-malformed"||transitionOut.invalid)
      return{ok:false,transitionIn,transitionOut:transitionOut.map};
    /** @type {{holderId:unknown,value:import('./contracts.js').TransitionIn}[]} */
    const records=[];
    if(meta?.transitionIn!=null)records.push({holderId:meta.id,value:/** @type {import('./contracts.js').TransitionIn} */(meta.transitionIn)});
    for(const row of history){
      if(!isPlainStateObject(row))return{ok:false,transitionIn,transitionOut:transitionOut.map};
      if(row.meta==null)continue;
      if(!isPlainStateObject(row.meta))return{ok:false,transitionIn,transitionOut:transitionOut.map};
      const status=classifyInheritedTransitionValue(row.meta.transitionIn,isCoherentV1TransitionIn);
      if(status==="unknown-or-malformed")return{ok:false,transitionIn,transitionOut:transitionOut.map};
      if(status==="supported-v1")records.push({holderId:row.id,value:/** @type {import('./contracts.js').TransitionIn} */(row.meta.transitionIn)});
    }
    /** @type {Map<string,import('./contracts.js').ProgramArchive & {transitionOut:import('./contracts.js').TransitionOut}>} */
    const archivesById=new Map();
    for(const row of history){
      if(row.transitionOut==null)continue;
      const id=typeof row.id==="string"&&row.id.trim()?row.id.trim():null;
      const archiveId=typeof row.archiveId==="string"&&row.archiveId.trim()?row.archiveId.trim():null;
      if(!id||!archiveId||id!==archiveId||archivesById.has(id))
        return{ok:false,transitionIn,transitionOut:transitionOut.map};
      archivesById.set(id,/** @type {import('./contracts.js').ProgramArchive & {transitionOut:import('./contracts.js').TransitionOut}} */(row));
    }
    for(const record of records){
      const tin=record.value;
      if(typeof record.holderId!=="string"||!record.holderId.trim()||
        tin.successor.programId!==record.holderId||tin.archiveId!==tin.predecessor.programId)
        return{ok:false,transitionIn,transitionOut:transitionOut.map};
      const archive=archivesById.get(tin.archiveId);
      if(!archive||archive.id!==tin.archiveId||archive.archiveId!==tin.archiveId)return{
        ok:false,transitionIn,transitionOut:transitionOut.map};
      const tout=archive.transitionOut;
      if(tout.transitionId!==tin.transitionId||tout.proposalHash!==tin.proposalHash||
        tout.successorProgramId!==tin.successor.programId)
        return{ok:false,transitionIn,transitionOut:transitionOut.map};
    }
    for(const [archiveId,tout] of transitionOut.map.entries()){
      const linked=records.filter(({value:tin})=>tin.archiveId===archiveId&&
        tin.transitionId===tout.transitionId&&tin.proposalHash===tout.proposalHash&&
        tin.successor.programId===tout.successorProgramId);
      if(linked.length!==1)return{ok:false,transitionIn,transitionOut:transitionOut.map};
    }
    return{ok:true,transitionIn,transitionOut:transitionOut.map}}

  /** @param {StoredSnapshot} proposal @param {StoredSnapshot} base */
  function transitionJournalAttempt(proposal,base){
    if(!proposal||!isPlainStateObject(proposal))return false;
    const propProvenance=classifyInheritedProvenance(proposal);
    const baseProvenance=classifyInheritedProvenance(base);
    if(!propProvenance.ok||!baseProvenance.ok)return true;
    const propTin=isPlainStateObject(proposal.programMeta)?proposal.programMeta.transitionIn:null;
    const baseTin=isPlainStateObject(base?.programMeta)?base.programMeta.transitionIn:null;
    if(!transitionRecordEqual(propTin,baseTin))return true;
    if(propProvenance.transitionOut.size!==baseProvenance.transitionOut.size)return true;
    for(const [key,propTout] of propProvenance.transitionOut.entries()){
      if(!baseProvenance.transitionOut.has(key))return true;
      const baseTout=baseProvenance.transitionOut.get(key);
      if(!transitionRecordEqual(propTout,baseTout))return true}
    return false}

  /** @param {import('./contracts.js').ProgramArchive[]} history */
  function programHistoryUniqueIds(history){
    /** @type {Set<unknown>} */
    const ids=new Set();
    for(const row of history){
      if(!isPlainStateObject(row))return null;
      const id=row.id;
      if(typeof id!=="string"||!id.trim())return null;
      if(ids.has(id))return null;
      ids.add(id)}
    return ids}

  /** @param {StoredSnapshot} proposal @param {StoredSnapshot} base */
  function isCoherentLegacyReplacement(proposal,base){
    if(!proposal||!isPlainStateObject(proposal)||!base||!isPlainStateObject(base))return false;
    const propMeta=proposal.programMeta,baseMeta=base.programMeta;
    if(!isPlainStateObject(propMeta)||!isPlainStateObject(baseMeta))return false;
    const propProvenance=classifyInheritedProvenance(proposal);
    const baseProvenance=classifyInheritedProvenance(base);
    if(!propProvenance.ok||!baseProvenance.ok)return false;
    const succId=propMeta.id;
    if(typeof succId!=="string"||!succId.trim()||succId===baseMeta.id)return false;
    if(propMeta.transitionIn!=null)return false;
    const propMap=propProvenance.transitionOut;
    const baseMap=baseProvenance.transitionOut;
    if(propMap.size!==baseMap.size)return false;
    for(const [key,propTout] of propMap.entries()){
      if(!baseMap.has(key))return false;
      if(!transitionRecordEqual(propTout,baseMap.get(key)))return false}
    const propHist=Array.isArray(proposal.programHistory)?proposal.programHistory:[];
    const baseHist=Array.isArray(base.programHistory)?base.programHistory:[];
    if(propHist.length!==baseHist.length+1)return false;
    const propIds=programHistoryUniqueIds(propHist);
    const baseIds=programHistoryUniqueIds(baseHist);
    if(!propIds||!baseIds)return false;
    for(const b of baseHist){
      const p=propHist.find(row=>row.id===b.id);
      if(!p)return false;
      if(!transitionRecordEqual(p,b))return false}
    const newRows=propHist.filter(row=>!baseIds.has(row.id));
    if(newRows.length!==1)return false;
    const newRow=newRows[0];
    if(newRow.id!==baseMeta.id)return false;
    if(newRow.transitionOut!=null)return false;
    if(newRow.archiveId!=null&&newRow.archiveId!==newRow.id)return false;
    if(newRow.meta==null||!transitionRecordEqual(newRow.meta,baseMeta))return false;
    if(!Array.isArray(newRow.program))return false;
    if(!transitionRecordEqual(newRow.program,Array.isArray(base.program)?base.program:[]))return false;
    return true}

  /** @param {StoredSnapshot} proposal @param {StoredSnapshot} base */
  function isCoherentTransitionProposal(proposal,base){
    if(!proposal||!isPlainStateObject(proposal))return false;
    const propProvenance=classifyInheritedProvenance(proposal);
    if(!propProvenance.ok)return false;
    const tin=proposal.programMeta?.transitionIn;
    if(!isCoherentV1TransitionIn(tin)||!proposal.programMeta)return false;
    const succId=tin.successor.programId,predId=tin.predecessor.programId;
    if(proposal.programMeta.id!==succId)return false;
    if(tin.archiveId!==predId)return false;
    const propHist=Array.isArray(proposal.programHistory)?proposal.programHistory:[];
    const newOccupants=propHist.filter(h=>h&&(h.id===predId||h.archiveId===predId));
    if(newOccupants.length!==1)return false;
    const newArc=newOccupants[0];
    if(newArc.id!==predId||newArc.archiveId!==predId)return false;
    if(!isCoherentV1TransitionOut(newArc.transitionOut))return false;
    const tout=newArc.transitionOut;
    if(tout.transitionId!==tin.transitionId||tout.proposalHash!==tin.proposalHash||
      tout.successorProgramId!==succId)return false;
    const allWithTransId=propHist.filter(h=>/** @type {{transitionId?:unknown}|null|undefined} */(h?.transitionOut)?.transitionId===tin.transitionId);
    if(allWithTransId.length!==1)return false;

    if(base!=null){
      if(!isPlainStateObject(base))return false;
      const baseProvenance=classifyInheritedProvenance(base);
      if(!baseProvenance.ok)return false;
      if(base.programMeta?.id!==predId)return false;
      const baseHist=Array.isArray(base.programHistory)?base.programHistory:[];
      if(propHist.length!==baseHist.length+1)return false;
      if(baseHist.some(h=>h&&(h.id===predId||h.archiveId===predId)))return false;

      // Inherited transitionIn provenance captured in new archive
      const baseTin=base.programMeta?.transitionIn;
      if(baseTin!=null){
        if(!transitionRecordEqual(/** @type {{transitionIn?:unknown}|null|undefined} */(newArc.meta)?.transitionIn,baseTin))return false;
      }else{
        if(/** @type {{transitionIn?:unknown}|null|undefined} */(newArc.meta)?.transitionIn!=null)return false;
      }

      // Every inherited base history row must be retained value-identically,
      // keyed by its stable primary id. Legacy rows without archiveId or
      // transitionOut are kept as they are — never forced to invent fields.
      for(const b of baseHist){
        if(!b||typeof b.id!=="string"||!b.id)return false;
        const matching=propHist.filter(p=>p!==newArc&&p?.id===b.id);
        if(matching.length!==1)return false;
        if(!transitionRecordEqual(matching[0],b))return false;
      }
    }
    return true}

  /** @param {StoredSnapshot} prepared @param {StoredSnapshot} finalized @param {import('./contracts.js').EffectInput} effect @param {ReturnType<typeof pendingJournalEffectState>} checked @param {StorageIO} io @param {ReplicaWriteResult} provisionalResult @param {boolean} [forceFinalization] @returns {Promise<import('./contracts.js').DraftSettlement>} */
  async function settleAppliedDraftTransaction(prepared,finalized,effect,checked,io,provisionalResult,
    forceFinalization=false){
    const transaction=pendingDraftTransaction(prepared),transactionId=transaction?.id||null;
    const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
    const applied=await withDraftWriteLock(()=>applyPendingJournalEffect(effect));
    if(applied.status==="failed"){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      return Object.assign(/** @type {const} */({accepted:false,rejected:true}),compensation)}
    if(!pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint)){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      return Object.assign(/** @type {const} */({accepted:false,rejected:true}),compensation)}
    if(!transaction&&!forceFinalization)return{accepted:true,rejected:false,snapshot:finalized,result:null};
    const result=await writeSnapshot(finalized,io);
    if(!(result.localOk||result.idbOk)){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      if(compensation.settled)return Object.assign(/** @type {const} */({accepted:false,rejected:true}),compensation);
      return{accepted:true,rejected:false,deferred:true,settled:false,snapshot:prepared,
        result:provisionalResult,finalizationResult:result,applied}}
    if(!pendingDraftSettlementAccepted(effect,transactionId,contextFingerprint)){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      return Object.assign(/** @type {const} */({accepted:false,rejected:true}),compensation)}
    return{accepted:true,rejected:false,settled:true,snapshot:finalized,result}}

  /** @param {string} source @returns {'localStorage'|'indexedDB'|'both'} */
  function recoverySourceReplica(source){
    return source==="local"?"localStorage":source==="idb"?"indexedDB":"both";
  }

  // --- Export API ---
  const api = {
    // Keys & Constants
    KEY,
    DB,
    STORE,
    STORAGE_REV,
    STORAGE_FOLLOWUP,
    STORAGE_DRAFT_TXN,
    STORAGE_SETUP_TXN,
    SHARED_IMPORT,
    STORAGE_LOCK,
    PENDING,
    PENDING_PREFIX,
    DRAFT,
    DRAFT_V2_CHECKPOINT,
    DRAFT_PENDING_PREFIX,
    DRAFT_CLOSE_PREFIX,

    // DraftV2 storage owner
    DraftStore,
    v2CheckpointRecord,
    prepareV2CheckpointEffect,
    commitV2CheckpointEffect,
    reconcileV2Checkpoint,

    // Normalizer & Contracts
    normalizeDurableOutcome,

    // Storage IO & Locking
    storageIO,
    requireAdapter,
    writeSnapshot,
    withStorageLock,
    enqueueWrite,
    flushStorage,
    getStorageHealth,
    addStorageHealthListener,
    noteWriteHealth,
    setMutationFreezeCheck,
    isMutationFrozen,

    // Replicas & Arbitration
    readLocalStatus,
    readIdbStatus,
    clearPrimaryReplicas,
    restoreTransferSnapshot,
    readAuxiliaryIdbValue,
    writeAuxiliaryIdbValue,
    deleteAuxiliaryIdbValue,
    chooseSnapshot,
    snapshotsEqual,
    storageSnapshotsEqual,
    isValidStateShape,
    resolveBootReplicas,
    readDurableState,
    settleHistoryAlreadyCommitted,
    settleCustomExerciseMutation,
    settlePendingJournal,

    // Snapshot Meta & Helpers
    cloneSnapshot,
    isPlainStateObject,
    readRevision,
    unversionedSnapshot,
    stripStorageMeta,
    exportableState,
    canonicalize,
    canonicalPayload,
    mirrorComparisonSnapshot,
    draftProgramFingerprint,
    setPersistHead,
    getPersistHead,
    resetPersistenceBase,
    refreshPersistenceHead,
    getJournalWriterId,
    hasPendingJournal,
    pendingJournalOrder,

    // WAL / Pending Journal
    writePendingJournal,
    readPendingJournal,
    clearPendingJournal,
    clearPendingJournalById,
    clearAllPendingJournal,
    armPendingJournalRollback,
    decodePendingJournal,
    pendingJournalSuccessorMatches,
    setupActivationMatches,
    setupActivationAlreadyCommitted,
    missingCustomProgramReference,

    // Transaction Engine & Execution
    draftEffectOutcome,
    normalizeDraftEffectOutcome,
    pendingJournalEffect,
    draftEffectRequiresCoordination,
    pendingDraftTransaction,
    pendingJournalEffectState,
    applyPendingJournalEffect,
    pendingDraftPostEffectAccepted,
    pendingDraftRelatedState,
    pendingDraftSettlementAccepted,
    pendingDraftEffectAccepted,
    isCoherentV1TransitionIn,
    isCoherentV1TransitionOut,
    preparePendingDraftTransaction,
    finalizedDraftTransactionSnapshot,
    rejectedDraftTransactionSnapshot,
    executeDraftTransaction,
    enqueueStateChange,
    settleCommittedSetupActivation,
  };

  return api;
}
