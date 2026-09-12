/**
 * RepForge Durable State Engine (durable-state.js)
 *
 * Owns:
 * - Dual-replica storage coordination (localStorage "repforge_v1" + IndexedDB "repforge"/"kv")
 * - Write-Ahead Logging (WAL) via localStorage "repforge_pending_v1:*"
 * - Cross-tab locking via WebLocks ("repforge:state-write") and fallback queue
 * - Transaction closing markers, draft coordination sidecars, and crash recovery
 * - Boot-time replica resolution, replay of interrupted journals, and replica self-healing
 * - Normalized durable outcome contract distinguishing committed, rejected, deferred, and failed states
 *
 * Does NOT own:
 * - Workout-session lifecycle (Plan 055)
 * - Program-transition derivation or recovery policy (Plan 052/056)
 * - Install-transfer protocol or encryption (Plan 053 / ADR 0013)
 * - DOM manipulation, UI state, toasts, or telemetry emission
 */
(function (root) {
  "use strict";

  const KEY = "repforge_v1";
  const DB = "repforge";
  const STORE = "kv";
  const STORAGE_REV = "_storageRevision";
  const STORAGE_FOLLOWUP = "_storageFollowUp";
  const STORAGE_DRAFT_TXN = "_storageDraftTransaction";
  const STORAGE_SETUP_TXN = "_storageSetupActivation";
  const SHARED_IMPORT = "_sharedSetupImport";
  const STORAGE_LOCK = "repforge:state-write";
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
  let persistHead = null;
  let writeTail = Promise.resolve();
  let mutationFreezeCheck = null;
  let host = null;
  let pendingJournalSeq = 0, pendingJournalClock = 0;
  const pendingJournalWriterId = pendingJournalUuid();
  const storageHealth = { localOk: true, idbOk: true, degraded: false, revision: 0, lastResult: null, localFailed: false, idbFailed: false, quotaFailed: false, lastError: null };
  const healthListeners = new Set();

  function getStorageHealth() {
    return Object.assign({}, storageHealth);
  }

  function addStorageHealthListener(fn) {
    if (typeof fn === "function") healthListeners.add(fn);
    return () => healthListeners.delete(fn);
  }

  function notifyHealthListeners(result = null) {
    const copy = getStorageHealth();
    for (const listener of healthListeners) {
      try { listener(result || copy); } catch (e) { /* suppress listener error */ }
    }
  }

  function setMutationFreezeCheck(fn) {
    mutationFreezeCheck = typeof fn === "function" ? fn : null;
  }

  function configureHost(next) {
    if (!next || typeof next !== "object") throw new TypeError("durable host adapter required");
    host = next;
  }

  function isMutationFrozen() {
    return mutationFreezeCheck ? !!mutationFreezeCheck() : false;
  }

  function cloneSnapshot(snapshot) {
    if (snapshot == null || typeof snapshot !== "object") return snapshot;
    try {
      if (typeof structuredClone === "function") return structuredClone(snapshot);
    } catch {
      // fallback to JSON clone
    }
    return JSON.parse(JSON.stringify(snapshot));
  }

  function isPlainStateObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

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

  function isValidStateShape(snapshot) {
    return hostFunction("isValidStateShape")(snapshot);
  }

    function snapshotBlockId(snapshot){
    const meta=snapshot?.programMeta;
    return Object.prototype.hasOwnProperty.call(meta||{},"blockId")?meta.blockId:null}

    function draftProgramFingerprint(snapshot){
    const value={programMetaId:snapshot?.programMeta?.id||null,
      program:Array.isArray(snapshot?.program)?snapshot.program:[]};
    if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
      value.programMetaBlockId=snapshot.programMeta.blockId;
    return JSON.stringify(canonicalize(value))}

  function hostFunction(name) {
    const fn = host?.[name];
    if (typeof fn !== "function") throw new Error(`durable host adapter missing ${name}`);
    return fn;
  }

  function currentStateSnapshot(){
    return typeof host?.getLiveState==="function"?host.getLiveState():persistHead}
  function workoutDraft(){return host?.workoutDraft||root?.RepForgeWorkoutDraft||null}
  function retainDraftRecovery(raw,reason){return hostFunction("storeDraftRecovery")(raw,reason)}

  function v2CheckpointRecord(draft,raw,operationId=draft.writer.operationId){
    return{version:1,kind:"committed",draftId:draft.draftId,revision:draft.revision,operationId,
      programFingerprint:draft.program.programFingerprint,raw}}
  function prepareV2CheckpointEffect(currentRaw,nextRaw,operationId,{previous:previousOverride}={}){
    const current=workoutDraft()?.parse(currentRaw),next=workoutDraft()?.parse(nextRaw),checkpoint=DraftStore.readV2Checkpoint();
    if(checkpoint.status==="invalid"||checkpoint.status==="read-failed")return{ok:false,reason:"checkpoint-unreadable"};
    if(nextRaw===currentRaw)return{ok:true,kind:"none"};
    if(current?.kind==="valid"&&nextRaw===null){
      const pending={...v2CheckpointRecord(current.draft,currentRaw,operationId),kind:"pending-removal",baseRaw:currentRaw};
      return DraftStore.writeV2Checkpoint(pending)?{ok:true,kind:"pending-removal",value:pending}:{ok:false,reason:"checkpoint-write"}}
    if(next?.kind!=="valid")return current?.kind==="valid"?{ok:false,reason:"v2-replacement-invalid"}:{ok:true,kind:"none"};
    const previous=previousOverride!==undefined?previousOverride:
      current?.kind==="valid"?v2CheckpointRecord(current.draft,currentRaw):null;
    const pending={...v2CheckpointRecord(next.draft,nextRaw,operationId),kind:"pending",baseRaw:currentRaw,previous};
    return DraftStore.writeV2Checkpoint(pending)?{ok:true,kind:"pending",value:pending}:{ok:false,reason:"checkpoint-write"}}
  function commitV2CheckpointEffect(prepared,nextRaw){
    if(prepared.kind==="none")return true;
    if(prepared.kind==="pending-removal"){
      if(nextRaw!==null)return false;
      const removed=workoutDraft()?.parse(prepared.value.raw);
      return removed?.kind==="valid"&&DraftStore.writeV2Checkpoint(
        DraftStore.v2Tombstone(removed.draft,prepared.value.operationId))}
    const next=workoutDraft()?.parse(nextRaw);
    return next?.kind==="valid"&&DraftStore.writeV2Checkpoint(v2CheckpointRecord(next.draft,nextRaw,prepared.value.operationId))}

  const DraftStore={
    readCanonicalRaw(){
      try{return localStorage.getItem(DRAFT)}
      catch{return null}},
    readCanonicalStatus(){
      try{return{status:"ok",raw:localStorage.getItem(DRAFT)}}
      catch(error){return{status:"read-failed",error}}},
    readV2Checkpoint(){
      try{const raw=localStorage.getItem(DRAFT_V2_CHECKPOINT);if(raw==null)return{status:"absent",raw:null};
        const value=JSON.parse(raw);
        if(!isPlainStateObject(value)||value.version!==1||!["pending","pending-removal","committed","tombstone"].includes(value.kind)||
          typeof value.draftId!=="string"||!value.draftId||value.draftId.length>240||
          !Number.isSafeInteger(value.revision)||value.revision<0||
          typeof value.operationId!=="string"||!value.operationId||value.operationId.length>240||
          typeof value.programFingerprint!=="string"||!value.programFingerprint||value.programFingerprint.length>2000||
          (value.kind!=="tombstone"&&(typeof value.raw!=="string"||value.raw.length>PENDING_EFFECT_MAX_RAW)))
          return{status:"invalid",raw};
        const validRecord=record=>{const parsed=workoutDraft()?.parse(record?.raw);
          return isPlainStateObject(record)&&typeof record.draftId==="string"&&Number.isSafeInteger(record.revision)&&
            typeof record.operationId==="string"&&typeof record.programFingerprint==="string"&&parsed?.kind==="valid"&&
            parsed.draft.draftId===record.draftId&&parsed.draft.revision===record.revision};
        if(value.kind!=="tombstone"&&!validRecord(value))return{status:"invalid",raw};
        if(value.kind==="pending"&&
          (!(value.baseRaw===null||typeof value.baseRaw==="string"&&value.baseRaw.length<=PENDING_EFFECT_MAX_RAW)||
            value.previous!=null&&!validRecord(value.previous)))
          return{status:"invalid",raw};
        if(value.kind==="pending-removal"&&value.baseRaw!==value.raw)return{status:"invalid",raw};
        return{status:"valid",raw,value}}
      catch(error){return{status:"read-failed",raw:null,error}}},
    writeV2Checkpoint(value){
      if(installTransferMutationFrozen())return false;
      try{localStorage.setItem(DRAFT_V2_CHECKPOINT,JSON.stringify(value));return true}
      catch{return false}},
    v2Tombstone(draft,operationId){return{version:1,kind:"tombstone",draftId:draft.draftId,
      revision:draft.revision,operationId,programFingerprint:draft.program.programFingerprint}},
    async compareAndSwapV2({expectedRaw,expectedDraftId,expectedRevision,nextRaw,operationId}){
      if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
      if(!navigator.locks?.request)return{status:"lock-unavailable"};
      if(typeof nextRaw!=="string"||nextRaw.length>PENDING_EFFECT_MAX_RAW)
        return{status:"invalid-next"};
      const candidate=workoutDraft()?.parse(nextRaw);if(candidate?.kind!=="valid")return{status:"invalid-next"};
      // A state transaction has already published its exact draft precondition
      // before waiting for the shared lock. Preserve a newer workout command in
      // that transaction's ordered sidecar so its lock-held preflight sees the
      // conflict and the workout survives when the transaction closes.
      const stageFor=target=>{if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
        const currentRaw=this.readRaw(),current=workoutDraft()?.parse(currentRaw);
        if(expectedRaw!==undefined?currentRaw!==expectedRaw:
          current?.kind!=="valid"||current.draft.draftId!==expectedDraftId||current.draft.revision!==expectedRevision)
          return{status:"stale",raw:currentRaw,draft:current?.draft};
        if(!this.stage(target,nextRaw))return{status:"stage-failed"};
        return{status:"applied",raw:nextRaw,draft:candidate.draft,staged:true}};
      const target=this.writeTarget();
      if(target)return stageFor(target);
      return navigator.locks.request(STORAGE_LOCK,async()=>{
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
            if(!this.writeV2Checkpoint(v2CheckpointRecord(next.draft,nextRaw,operationId)))
              return{status:"checkpoint-commit-failed",raw:read.raw,draft:next.draft};
            return{status:"applied",raw:read.raw,draft:next.draft,idempotent:true}}
          if(read.raw===priorCheckpoint.value.baseRaw){
            if(!this.publishCanonical(nextRaw))return{status:"write-failed"};
            const verify=this.readCanonicalStatus();
            if(verify.status!=="ok")return verify;
            if(verify.raw!==nextRaw)return{status:"readback-mismatch",raw:verify.raw};
            if(!this.writeV2Checkpoint(v2CheckpointRecord(next.draft,nextRaw,operationId)))
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
        const previous=liveParsed?.kind==="valid"?v2CheckpointRecord(liveParsed.draft,read.raw):null;
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
      })},
    async removeV2({expectedDraftId,expectedRevision,operationId}){
      if(installTransferMutationFrozen())return{status:"transfer-frozen",code:"install-transfer-frozen"};
      if(!navigator.locks?.request)return{status:"lock-unavailable"};
      return navigator.locks.request(STORAGE_LOCK,async()=>{
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
    publishCanonical(raw){
      if(installTransferMutationFrozen())return false;
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
      if(installTransferMutationFrozen())return false;
      if(typeof transactionId!=="string"||!transactionId)return false;
      try{
        localStorage.setItem(DRAFT_CLOSE_PREFIX+transactionId,
          JSON.stringify({version:1,transactionId,writer:getJournalWriterId()}));
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
    writeSidecar(transactionId,raw){
      if(installTransferMutationFrozen())return false;
      if(typeof transactionId!=="string"||!transactionId||
        !(raw===null||typeof raw==="string"&&raw.length<=PENDING_EFFECT_MAX_RAW))return false;
      const writer=getJournalWriterId();
      const order=pendingJournalOrder(),key=`${DRAFT_PENDING_PREFIX}${transactionId}:${writer}`;
      const value={version:1,transactionId,writer,order,
        programFingerprint:draftContextFingerprint(currentStateSnapshot()),raw};
      try{
        const encoded=JSON.stringify(value);
        localStorage.setItem(key,encoded);
        return this.decodeSidecar(key,encoded)}
      catch{return false}},
    stage(target,raw){
      if(installTransferMutationFrozen())return false;
      if(!target||typeof target.id!=="string")return false;
      if(!this.writeSidecar(target.id,raw))return false;
      if(!this.transactionOwned(target.id))return this.promote(target.id).settled;
      return true},
    readRaw(){
      const contextFingerprint=draftContextFingerprint(currentStateSnapshot());
      const queued=this.pending().entries.filter(entry=>
        entry.value.programFingerprint===contextFingerprint).at(-1);
      return queued?queued.value.raw:this.readCanonicalRaw()},
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
    write(raw){return typeof raw==="string"&&this.publish(raw)},
    remove(){return this.publish(null)},
    clearSidecar(entry){
      if(installTransferMutationFrozen())return false;
      try{
        if(localStorage.getItem(entry.key)===entry.raw)localStorage.removeItem(entry.key);
        return true}
      catch{return false}},
    promote(transactionId,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      const pending=this.related(transactionId,contextFingerprint);
      if(!pending.entries.length&&!pending.invalid.length)
        return{settled:true,hadWrites:false,raw:undefined};
      const latest=pending.entries.at(-1);
      if(latest){
        if(!this.publishCanonical(latest.value.raw))return{settled:false,hadWrites:true,raw:latest.value.raw};
        const parsed=workoutDraft()?.parse(latest.value.raw);
        if(parsed?.kind==="valid"&&!this.writeV2Checkpoint(v2CheckpointRecord(parsed.draft,latest.value.raw)))
          return{settled:false,hadWrites:true,raw:latest.value.raw}}
      for(const entry of pending.entries){if(!this.clearSidecar(entry))return{settled:false,hadWrites:true,transferFrozen:true,code:"install-transfer-frozen"}}
      for(const invalid of pending.invalid){
        if(installTransferMutationFrozen())return{settled:false,hadWrites:true,transferFrozen:true,code:"install-transfer-frozen"};
        try{if(localStorage.getItem(invalid.key)===invalid.raw)localStorage.removeItem(invalid.key)}
        catch{}}
      const remaining=this.related(transactionId,contextFingerprint);
      return{settled:remaining.entries.length===0&&remaining.invalid.length===0,
        hadWrites:true,raw:latest?.value.raw}},
    restoreEffect(transactionId,effect,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      const promoted=this.promote(transactionId,contextFingerprint);
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
            expected.draft,receipt.expectedRaw,`rollback-${transactionId}`)))
            return{settled:false,hadWrites:false,raw:receipt.expectedRaw}}
        return promoted}
      const prepared=prepareV2CheckpointEffect(appliedRaw,receipt.expectedRaw,`rollback-${transactionId}`);
      if(!prepared.ok)return{settled:false,hadWrites:false,raw:receipt.expectedRaw};
      const published=this.publishCanonical(receipt.expectedRaw);
      return{settled:published&&commitV2CheckpointEffect(prepared,receipt.expectedRaw),hadWrites:false,raw:receipt.expectedRaw}},
    endClose(transactionId,contextFingerprint=null){
      if(installTransferMutationFrozen())return{settled:false,hadWrites:false,transferFrozen:true,code:"install-transfer-frozen"};
      try{localStorage.removeItem(DRAFT_CLOSE_PREFIX+transactionId)}
      catch{return{settled:false,hadWrites:false}}
      return this.promote(transactionId,contextFingerprint)}
  };

  function installTransferMutationFrozen() {
    return isMutationFrozen();
  }

  function readSetupDraftRaw() {
    return hostFunction("readSetupDraftRaw")();
  }

  function rebaseStateChange(base, proposal, target, options) {
    return hostFunction("rebaseStateChange")(base, proposal, target, options);
  }

  function rebaseSharedSetupSnapshot(snapshot, head, seed) {
    return hostFunction("rebaseSharedSetupSnapshot")(snapshot, head, seed);
  }

  function applyAcceptedSnapshot(base, snapshot) {
    return hostFunction("applyAcceptedSnapshot")(base, snapshot);
  }

  function normalizeRecoveryCarrierSnapshot(snapshot, source, options) {
    return hostFunction("normalizeRecoveryCarrierSnapshot")(snapshot, source, options);
  }

  function blockStartDraftGuard(snapshot) {
    return hostFunction("blockStartDraftGuard")(snapshot);
  }

  function isValidBlockId(value, programId = null) {
    return hostFunction("isValidBlockId")(value, programId);
  }

  function isValidRecoveryTransitions(value) {
    return hostFunction("isValidRecoveryTransitions")(value);
  }

  function isBoundedTransitionValue(value) {
    return hostFunction("isBoundedTransitionValue")(value);
  }

  // --- IndexedDB Primitives ---
  function openIdb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = indexedDB.open(DB, 1);
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

  function requireAuxiliaryIdbKey(key) {
    if (typeof key !== "string" || !key || key === KEY) {
      throw new TypeError("auxiliary IndexedDB key required");
    }
    return key;
  }

  function readAuxiliaryIdbValue(key) {
    return idbGet(requireAuxiliaryIdbKey(key));
  }

  function writeAuxiliaryIdbValue(key, value) {
    return idbSet(requireAuxiliaryIdbKey(key), value);
  }

  function deleteAuxiliaryIdbValue(key) {
    return idbDel(requireAuxiliaryIdbKey(key));
  }

  // --- Replicas Status & Arbitration ---
  function readLocalStatus(key = KEY) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { status: "absent", raw: null, parsed: null };
      try {
        const parsed = JSON.parse(raw);
        if (isValidStateShape(parsed)) return {
          status: "valid", raw, parsed,
          ...(typeof host?.classifyRecoveryCarrier === "function"
            ? { recoveryCarrierClassification: host.classifyRecoveryCarrier(parsed?.recoveryTransitions) }
            : {}),
        };
        const carrier = typeof host?.carrierReadStatus === "function" ? host.carrierReadStatus(parsed, raw) : null;
        return carrier || { status: "invalid", raw, parsed };
      } catch {
        return { status: "invalid", raw, parsed: null };
      }
    } catch (error) {
      return { status: "failed", raw: null, parsed: null, error };
    }
  }

  async function readIdbStatus(key = KEY) {
    try {
      const parsed = await idbGet(key);
      if (parsed === null || parsed === undefined) return { status: "absent", raw: null, parsed: null };
      if (isValidStateShape(parsed)) return {
        status: "valid", raw: parsed, parsed,
        ...(typeof host?.classifyRecoveryCarrier === "function"
          ? { recoveryCarrierClassification: host.classifyRecoveryCarrier(parsed?.recoveryTransitions) }
          : {}),
      };
      const carrier = typeof host?.carrierReadStatus === "function" ? host.carrierReadStatus(parsed, parsed) : null;
      return carrier || { status: "invalid", raw: parsed, parsed };
    } catch (error) {
      return { status: "failed", raw: null, parsed: null, error };
    }
  }

  function chooseSnapshot(localRead, idbRead) {
    const l = localRead?.status, i = idbRead?.status, lv = l === "valid", iv = i === "valid";
    if (l === "absent" && i === "absent") return { kind: "first-run" };
    if (!lv && !iv) return { kind: "unresolved", reason: "no-valid", local: localRead, idb: idbRead };
    if (lv && i === "absent") return { kind: "chosen", snapshot: localRead.parsed, source: "local", heal: "idb" };
    if (iv && l === "absent") return { kind: "chosen", snapshot: idbRead.parsed, source: "idb", heal: "local" };
    if (lv && (i === "invalid" || i === "failed")) return { kind: "unresolved", reason: i === "failed" ? "valid-plus-failed" : "valid-plus-invalid", local: localRead, idb: idbRead };
    if (iv && (l === "invalid" || l === "failed")) return { kind: "unresolved", reason: l === "failed" ? "valid-plus-failed" : "valid-plus-invalid", local: localRead, idb: idbRead };
    const localHas = Object.prototype.hasOwnProperty.call(localRead.parsed || {}, STORAGE_REV);
    const idbHas = Object.prototype.hasOwnProperty.call(idbRead.parsed || {}, STORAGE_REV);
    const equal = snapshotsEqual(localRead.parsed, idbRead.parsed);
    const lr = readRevision(localRead.parsed), ir = readRevision(idbRead.parsed);
    if (equal) {
      const localTxn = pendingDraftTransaction(localRead.parsed), idbTxn = pendingDraftTransaction(idbRead.parsed);
      if (lr === ir && !!localTxn !== !!idbTxn) {
        if (localTxn) return { kind: "chosen", snapshot: idbRead.parsed, source: "idb", heal: "local" };
        return { kind: "chosen", snapshot: localRead.parsed, source: "local", heal: "idb" };
      }
      if (lr !== ir) {
        if (lr > ir) return { kind: "chosen", snapshot: localRead.parsed, source: "local", heal: "idb" };
        return { kind: "chosen", snapshot: idbRead.parsed, source: "idb", heal: "local" };
      }
      if (!localHas || !idbHas) {
        const chosen = localHas ? localRead : idbRead;
        return { kind: "chosen", snapshot: chosen.parsed, source: chosen === localRead ? "local" : "idb", migrate: true };
      }
      return { kind: "chosen", snapshot: idbRead.parsed, source: "idb" };
    }
    if (lr !== ir) {
      if (lr > ir) return { kind: "chosen", snapshot: localRead.parsed, source: "local", heal: "idb" };
      return { kind: "chosen", snapshot: idbRead.parsed, source: "idb", heal: "local" };
    }
    return { kind: "unresolved", reason: "divergent", local: localRead, idb: idbRead };
  }

  // --- Normalized Durable Outcome Contract ---
  function normalizeDurableOutcome(result, options = {}) {
    const localOk = !!result?.localOk;
    const idbOk = !!result?.idbOk;
    const revision = typeof result?.revision === "number" ? result.revision : (options.revision ?? 0);
    const conflict = !!(result?.conflict || result?.duplicate || result?.ineligible ||
      result?.setupDraftConflict || result?.stale || result?.staleRevision || result?.staleBlock);
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
      journalFailed ? "journal_failed" :
      draftConflict ? "draft_conflict" :
      stale ? "stale_proposal" :
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
    } else if (journalFailed) {
      status = "failed";
      kind = "rejected_failure";
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
      try { localStorage.removeItem(KEY); } catch {}
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
    async writeLocal(snapshot) {
      try {
        localStorage.setItem(KEY, JSON.stringify(snapshot));
        return true;
      } catch (err) {
        if (err && (err.name === "QuotaExceededError" || err.code === 22)) {
          storageHealth.quotaFailed = true;
        }
        return false;
      }
    },
    async writeIdb(snapshot) {
      try {
        return await idbSet(KEY, snapshot);
      } catch {
        return false;
      }
    },
  };

  function requireAdapter(io, label = "storage operation") {
    if (!io || typeof io.writeLocal !== "function" || typeof io.writeIdb !== "function") {
      throw new Error(`${label} requires an explicit adapter`);
    }
    return io;
  }

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

  async function writeSnapshot(snapshot, io = storageIO) {
    requireAdapter(io, "writeSnapshot");
    const target = cloneSnapshot(snapshot);
    const revision = readRevision(target);
    let localOk = false, idbOk = false;
    try {
      const res = await io.writeLocal(target);
      localOk = res !== false;
    } catch {
      localOk = false;
    }
    try {
      const res = await io.writeIdb(target);
      idbOk = res !== false;
    } catch {
      idbOk = false;
    }
    const result = { revision, localOk, idbOk };
    noteWriteHealth(result);
    return result;
  }

    function withStorageLock(io,op){
    const guarded=async(...args)=>{
      if(io===storageIO&&installTransferMutationFrozen())
        return normalizeDurableOutcome({localOk:false,idbOk:false,conflict:true,
          transferFrozen:true,code:"install-transfer-frozen"});
      return op(...args)};
    if(io===storageIO&&navigator.locks?.request)return navigator.locks.request(STORAGE_LOCK,guarded);
    return guarded()}

  function enqueueWrite(op) {
    const run = () => op();
    const next = writeTail.then(run, run);
    writeTail = next.then(() => {}, () => {});
    return next;
  }

  function flushStorage() {
    return writeTail;
  }

  function setPersistHead(snapshot) {
    persistHead = cloneSnapshot(snapshot);
  }

  function getPersistHead() {
    return cloneSnapshot(persistHead);
  }

  function getJournalWriterId() {
    return pendingJournalWriterId;
  }

  function hasPendingJournal() {
    return pendingJournalKeys().length > 0;
  }

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
        priorQuarantine:current?.recoveryTransitions?.quarantine||[]})}
    catch{return{head:current,conflict:true,recovery:true}}
    if(normalized.kind==="full-recovery")return{head:current,conflict:true,recovery:true};
    if(normalized.kind==="known")disk=normalized.snapshot;
    const diskRev=readRevision(disk),currentRev=readRevision(current);
    if(diskRev>currentRev)return{head:disk};
    if(diskRev<currentRev||storageSnapshotsEqual(disk,current))return{head:current};
    return{head:current,conflict:true}}

    function sourceReplicaForCarrierDecision(decision,localRead,idbRead){
    const localClass=localRead?.recoveryCarrierClassification;
    const idbClass=idbRead?.recoveryCarrierClassification;
    const equal=localRead?.status==="valid"&&idbRead?.status==="valid"&&
      snapshotsEqual(localRead.parsed,idbRead.parsed);
    if(equal&&localClass?.kind==="known"&&idbClass?.kind==="known"&&
      (localClass.valid.length+localClass.malformed.length)>0)return"both";
    return recoverySourceReplica(decision?.source);
  }

  // --- Draft Effects & Coordination ---
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
          const authoritative=JSON.parse(authoritativeRaw);
          if(authoritative&&typeof authoritative==="object"&&!Array.isArray(authoritative)&&
            (authoritative.__day===receipt.conflictDay||authoritative.schemaVersion===2&&authoritative.program?.dayLabel===receipt.conflictDay))
            return{receipt,currentRaw:authoritativeRaw,status:"conflict"}}
        catch{}}
      return{receipt,currentRaw:authoritativeRaw,status:"mismatch"}}
    catch{
      return{receipt,currentRaw:null,status:receipt.precondition===DRAFT_PRECONDITION_MATCH_ONLY?"mismatch":"conflict"}}}

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

  // --- Write-Ahead Log (WAL) Primitives ---
    function pendingJournalUuid(){
    const uuid=globalThis.crypto?.randomUUID?.();
    if(uuid)return uuid;
    const words=new Uint32Array(4);
    if(globalThis.crypto?.getRandomValues){
      globalThis.crypto.getRandomValues(words);
      return [...words].map(n=>n.toString(36)).join("-")}
    return`${Date.now().toString(36)}-${(++pendingJournalSeq).toString(36)}-${Math.random().toString(36).slice(2)}`}

    function pendingJournalOrder(){
    const clock=Number.isFinite(globalThis.performance?.timeOrigin)&&Number.isFinite(globalThis.performance?.now?.())
      ?Math.floor((globalThis.performance.timeOrigin+globalThis.performance.now())*1000):Date.now()*1000;
    const at=Math.max(clock,pendingJournalClock+1);
    pendingJournalClock=at;
    return{at,writer:pendingJournalWriterId,seq:++pendingJournalSeq}}

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
      const recoveryTransactionPresent=Object.prototype.hasOwnProperty.call(journal,"recoveryTransaction");
      if(journal.recoveryTransaction!=null&&typeof journal.recoveryTransaction!=="boolean")return null;
      const recoveryTransaction=journal.recoveryTransaction===true;
      const expectedProgramFingerprint=typeof journal.expectedProgramFingerprint==="string"&&
        journal.expectedProgramFingerprint.length<=PENDING_EFFECT_MAX_RAW?journal.expectedProgramFingerprint:null;
      if(journal.expectedProgramFingerprint!=null&&!expectedProgramFingerprint)return null;
      const expectedBlockId=Object.prototype.hasOwnProperty.call(journal,"expectedBlockId")
        ?(journal.expectedBlockId===null?null:isValidBlockId(journal.expectedBlockId)?journal.expectedBlockId:null)
        :undefined;
      if(Object.prototype.hasOwnProperty.call(journal,"expectedBlockId")&&expectedBlockId===null&&journal.expectedBlockId!==null)return null;
      const expectedStorageRevision=Object.prototype.hasOwnProperty.call(journal,"expectedStorageRevision")
        ?journal.expectedStorageRevision:null;
      if(expectedStorageRevision!==null&&(!Number.isInteger(expectedStorageRevision)||expectedStorageRevision<0))return null;
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
        expectedProgramFingerprint,expectedBlockId,expectedStorageRevision,
        expectedFirstRunEmpty:journal.expectedFirstRunEmpty===true,reconcileSessionIds,dayRenames,
        effectOutcome,effect:effectOutcome.effect,recoveryTransaction,recoveryTransactionPresent,rollback}}}
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

    function clearPendingJournal(record){
    if(!record)return true;
    try{
      const current=localStorage.getItem(record.key);
      if(current===record.raw)localStorage.removeItem(record.key);
      return localStorage.getItem(record.key)!==record.raw}
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

    function writePendingJournal(base,liveBase,proposal,{replace=false,expectedProgramId=null,
    expectedProgramFingerprint=null,expectedBlockId=undefined,expectedStorageRevision=undefined,expectedFirstRunEmpty=false,
    reconcileSessionIds=[],dayRenames=[],effectOutcome=null,recoveryTransaction=false}={}){
    const id=pendingJournalUuid(),key=PENDING_PREFIX+id;
    const journal={version:2,id,order:pendingJournalOrder(),base:unversionedSnapshot(base),liveBase:unversionedSnapshot(liveBase),
      proposal:unversionedSnapshot(proposal),replace:!!replace,expectedProgramId:expectedProgramId||null};
    if(expectedProgramFingerprint)journal.expectedProgramFingerprint=expectedProgramFingerprint;
    if(expectedBlockId!==undefined)journal.expectedBlockId=expectedBlockId;
    if(Number.isInteger(expectedStorageRevision)&&expectedStorageRevision>=0)
      journal.expectedStorageRevision=expectedStorageRevision;
    if(expectedFirstRunEmpty)journal.expectedFirstRunEmpty=true;
    if(reconcileSessionIds.length)journal.reconcileSessionIds=reconcileSessionIds;
    if(dayRenames.length)journal.dayRenames=dayRenames;
    // This optional marker is absent from older journals. It scopes the
    // recovery crash protocol without inferring ownership from a carrier delta
    // that could belong to another state-changing workflow.
    if(recoveryTransaction)journal.recoveryTransaction=true;
    const outcome=normalizeDraftEffectOutcome(effectOutcome);
    if(outcome.status===DRAFT_EFFECT_VALID)journal.effect=outcome.effect;
    const raw=JSON.stringify(journal);
    try{localStorage.setItem(key,raw);return decodePendingJournal(key,raw)}
    catch(e){console.warn("pending state journal failed",e);return null}}

    function armPendingJournalRollback(record,snapshot,{forceRollback=false}={}){
    if(!record||record.legacy||!isValidStateShape(snapshot)||
      Object.prototype.hasOwnProperty.call(snapshot,STORAGE_DRAFT_TXN))return null;
    try{
      if(localStorage.getItem(record.key)!==record.raw)return null;
      const journal=JSON.parse(record.raw),rollback=cloneSnapshot(snapshot);
      journal.rollbackRevision=readRevision(rollback);
      delete journal.rollback;
      if(forceRollback||!storageSnapshotsEqual(unversionedSnapshot(rollback),record.journal.base))
        journal.rollback=rollback;
      const raw=JSON.stringify(journal);
      localStorage.setItem(record.key,raw);
      return decodePendingJournal(record.key,raw)}
    catch(e){console.warn("pending rollback journal failed",e);return null}}

    function pendingJournalSuccessorMatches(record,head){
    const journal=record?.journal,rollback=journal?.rollback;
    if(!journal||!rollback||!head)return false;
    const candidate=stateSnapshotForHead(journal.base,journal.liveBase,journal.proposal,rollback,
      {replace:journal.replace,reconcileSessionIds:journal.reconcileSessionIds,
        dayRenames:journal.dayRenames,expectedFirstRunEmpty:journal.expectedFirstRunEmpty,
        sharedRebaseSeed:journal.id});
    return readRevision(candidate)===readRevision(head)&&storageSnapshotsEqual(candidate,head)}

    function setupActivationMatches(marker,raw,programId){
    return isValidSetupActivationMarker(marker)&&marker.programId===programId&&marker.raw===raw}

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

  // --- Snapshot Derivation ---
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
    const setupMarker=snapshot[STORAGE_SETUP_TXN];
    if(isValidSetupActivationMarker(setupMarker))
      snapshot[STORAGE_SETUP_TXN]={...setupMarker,revision:snapshot[STORAGE_REV]};
    return snapshot}

  // --- Transaction Execution Engine ---
    async function compensatePendingDraftTransaction(snapshot,io,transactionId,effect){
    const transaction=pendingDraftTransaction(snapshot);
    const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
    const rollback=rejectedDraftTransactionSnapshot(snapshot);
    const result=rollback?await writeSnapshot(rollback,io):{revision:readRevision(snapshot),localOk:false,idbOk:false};
    const durable=!!(result.localOk||result.idbOk);
    const restored=durable?DraftStore.restoreEffect(transactionId,effect,contextFingerprint):{settled:false};
    return{settled:durable&&restored.settled,snapshot:rollback,result}}

    async function executeDraftTransaction({record=null,transactionId=record?.journal?.id||null,effect=null,
    prepared=null,snapshot=null,io=null,writePrepared=true,preparedResult=null,
    retainRecordOnWriteFailure=false,discard=false,forceFinalization=false}={}){
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
    const finalizeRecovery=forceFinalization&&provisionalResult.localOk===true&&provisionalResult.idbOk===true;
    const settlement=await settleAppliedDraftTransaction(
      prepared,snapshot,effectOutcome,checked,io,provisionalResult,finalizeRecovery);
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

  // --- Enqueue State Change ---
    function enqueueStateChangeRaw(base,proposal,io,{replace=false,liveBase=base,expectedProgramId=null,
    expectedProgramFingerprint=null,expectedBlockId=undefined,expectedStorageRevision=undefined,expectedFirstRunEmpty=false,
    expectedSetupDraftRaw=undefined,
    reconcileSessionIds=[],dayRenames=[],effect=null,preflight=null,recoveryTransaction=false}={}){
    requireAdapter(io,"enqueueStateChange");
    if(io===storageIO&&installTransferMutationFrozen())
      return Promise.resolve({revision:readRevision(base),localOk:false,idbOk:false,conflict:true,transferFrozen:true,code:"install-transfer-frozen"});
    const frozenBase=cloneSnapshot(base),frozenLiveBase=cloneSnapshot(liveBase);
    const frozenProposal=cloneSnapshot(proposal),frozenEffectOutcome=normalizeDraftEffectOutcome(effect);
    let workingProposal=cloneSnapshot(frozenProposal);
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
          effectOutcome:frozenEffectOutcome,recoveryTransaction})
      :null;
    if(io===storageIO&&!pendingRecord){
      const failed={revision:readRevision(frozenBase),localOk:false,idbOk:false,journalFailed:true};
      if(frozenEffect?.required===true)failed.draftConflict=true;
      noteWriteHealth(failed);
      return Promise.resolve(failed)}
    const operation=enqueueWrite(()=>withStorageLock(io,async()=>{
      if(io===storageIO&&installTransferMutationFrozen()){
        await executeDraftTransaction({record:pendingRecord,transactionId:pendingRecord?.journal.id||null,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(frozenBase),localOk:false,idbOk:false,
          conflict:true,transferFrozen:true,code:"install-transfer-frozen"}}
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
      if(expectedSetupDraftRaw!==undefined&&readSetupDraftRaw()!==expectedSetupDraftRaw){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,setupDraftConflict:true}}
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
        if(checked?.proposal){
          workingProposal=cloneSnapshot(checked.proposal);
          // Keep crash recovery pointed at the proposal that survived the
          // lock-held semantic rebase, not the stale copy written before it.
          if(pendingRecord){
            try{
              const journal=JSON.parse(pendingRecord.raw);
              journal.proposal=unversionedSnapshot(workingProposal);
              const raw=JSON.stringify(journal);
              localStorage.setItem(pendingRecord.key,raw);
              pendingRecord=decodePendingJournal(pendingRecord.key,raw)||pendingRecord;
            }catch{}
          }
        }
        if(checked?.reject){
          await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
            effect:frozenEffectOutcome,discard:true});
          return Object.assign({revision:readRevision(head),localOk:false,idbOk:false},checked.result||{conflict:true})}}
      if(expectedStorageRevision!==undefined&&readRevision(head)!==expectedStorageRevision){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,
          conflict:true,staleRevision:true}}
          if(expectedProgramId&&head?.programMeta?.id!==expectedProgramId){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true}}
      if(expectedProgramFingerprint&&draftProgramFingerprint(head)!==expectedProgramFingerprint){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true}}
      if(expectedBlockId!==undefined&&snapshotBlockId(head)!==expectedBlockId){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true,staleBlock:true}}
      if(expectedFirstRunEmpty&&(head?.programMeta?.onboarded||head?.log?.length||head?.programHistory?.length)){
        await executeDraftTransaction({record:pendingRecord,transactionId:coordinationId,
          effect:frozenEffectOutcome,discard:true});
        return{revision:readRevision(head),localOk:false,idbOk:false,duplicate:true,ineligible:true}}
      if(pendingRecord&&(draftEffectRequiresCoordination(frozenEffectOutcome)||recoveryTransaction)){
        const armed=armPendingJournalRollback(pendingRecord,head,{forceRollback:recoveryTransaction});
        if(!armed){
          await executeDraftTransaction({record:pendingRecord,
            transactionId:pendingRecord.journal.id,effect:frozenEffectOutcome,discard:true});
          return{revision:readRevision(head),localOk:false,idbOk:false,
            draftConflict:true,journalFailed:true}}
        pendingRecord=armed}
      const snapshot=stateSnapshotForHead(frozenBase,frozenLiveBase,workingProposal,head,
        {replace,reconcileSessionIds:frozenReconcileSessionIds,dayRenames:frozenDayRenames,
          expectedFirstRunEmpty,sharedRebaseSeed:pendingRecord?.journal.id||coordinationId});
      const prepared=preparePendingDraftTransaction(snapshot,head,frozenEffect,pendingRecord?.journal.id);
      const transactionId=pendingDraftTransaction(prepared)?.id||coordinationId;
      const execution=await executeDraftTransaction({record:pendingRecord,transactionId,
        effect:frozenEffectOutcome,prepared,snapshot,io,writePrepared:true,
        forceFinalization:recoveryTransaction});
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
        return Object.assign({accepted:true},execution.result)}
      return{revision:readRevision(head),localOk:false,idbOk:false,conflict:true}}));
    return operation}

  function enqueueStateChange(base, proposal, io = storageIO, options = {}) {
    return Promise.resolve(enqueueStateChangeRaw(base, proposal, io, options))
      .then(result => normalizeDurableOutcome(result));
  }

  // --- Boot Replay & Resolution ---
    async function resolveBootReplicas(candidate=null){
    return withStorageLock(storageIO,async()=>{
      const local=readLocalStatus(),idb=await readIdbStatus();
      let decision=chooseSnapshot(local,idb);
      if(decision.kind==="unresolved"){
        if(!recoveryChoiceMatches(candidate,decision))return decision;
        decision={kind:"chosen",snapshot:cloneSnapshot(candidate.snapshot),source:candidate.source,
          heal:candidate.source==="local"?"idb":"local"}}
      if(decision.kind==="chosen"){
        const sourceReplica=sourceReplicaForCarrierDecision(decision,local,idb);
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
        // A setup activation can leave its journal behind after the durable
        // successor is committed but before the separate setup draft is
        // consumed. Treat that journal as settled; replaying it would archive
        // the successor a second time after a crash.
        const setupMarker=journal.proposal?.[STORAGE_SETUP_TXN];
        if(setupActivationAlreadyCommitted(head,journal.proposal,setupMarker?.raw)){
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
      if(replayed)return{kind:"chosen",snapshot:head,source:"pending",draftConflict,
        recoveryChanged:!!decision.recoveryChanged};
      if(decision.kind==="chosen"&&decision.heal&&!decision.recoveryChanged)
        await writeSnapshot(cloneSnapshot(decision.snapshot),storageIO);
      return Object.assign({},decision,{draftConflict})})}

    function recoveryChoiceMatches(candidate,current){
    if(candidate?.kind!=="chosen"||(candidate.source!=="local"&&candidate.source!=="idb"))return false;
    const selected=candidate.source==="local"?current.local:current.idb;
    return selected?.status==="valid"&&storageSnapshotsEqual(selected.parsed,candidate.snapshot)}

  function pendingDraftPostEffectAccepted(effect){
    const outcome=normalizeDraftEffectOutcome(effect),receipt=outcome.effect;
    if(outcome.status===DRAFT_EFFECT_NONE)return true;
    if(outcome.status!==DRAFT_EFFECT_VALID)return false;
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

  function draftContextFingerprint(snapshot){
    const value={programMetaId:snapshot?.programMeta?.id||null,
      program:Array.isArray(snapshot?.program)?snapshot.program:[],
      unit:snapshot?.settings?.unit||"kg",rirMode:snapshot?.settings?.rirMode||"numeric"};
    if(Object.prototype.hasOwnProperty.call(snapshot?.programMeta||{},"blockId"))
      value.programMetaBlockId=snapshot.programMeta.blockId;
    return JSON.stringify(canonicalize(value))}

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

  function isValidSetupActivationMarker(marker){
    return isPlainStateObject(marker)&&marker.version===1&&
      typeof marker.programId==="string"&&marker.programId.length>0&&marker.programId.length<=128&&
      typeof marker.raw==="string"&&marker.raw.length>0&&marker.raw.length<=70000&&
      (!Object.prototype.hasOwnProperty.call(marker,"revision")||
        (Number.isInteger(marker.revision)&&marker.revision>=1))}

  function retainPendingJournal(record){
    if(!record)return false;
    try{
      const current=localStorage.getItem(record.key);
      if(current===record.raw)return true;
      if(current!=null)return false;
      localStorage.setItem(record.key,record.raw);
      return localStorage.getItem(record.key)===record.raw}
    catch{return false}}

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

  function recoveryJournalCarrier(snapshot){
    const carrier=snapshot?.recoveryTransitions;
    if(carrier===undefined)return{records:[],quarantine:[]};
    return isValidRecoveryTransitions(carrier)
      ?{records:carrier.records,quarantine:carrier.quarantine}:null;
  }

  function recoveryJournalNonCarrierEqual(base,proposal,{ignoreBlockId=false}={}){
    const left=cloneSnapshot(base),right=cloneSnapshot(proposal);
    if(!isPlainStateObject(left?.programMeta)||!isPlainStateObject(right?.programMeta))return false;
    delete left.recoveryTransitions;
    delete right.recoveryTransitions;
    if(ignoreBlockId){
      delete left.programMeta.blockId;
      delete right.programMeta.blockId}
    return storageSnapshotsEqual(left,right);
  }

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
    if(!baseCarrier||!proposalCarrier||!recoveryJournalNonCarrierEqual(base,proposal,{ignoreBlockId:true}))return null;
    if(journal.expectedProgramId!==base.programMeta.id||journal.expectedBlockId!==sourceBlock||
      !Number.isInteger(journal.expectedStorageRevision)||journal.expectedStorageRevision<0)return null;

    const before=baseCarrier.records,after=proposalCarrier.records;
    const sameQuarantine=storageSnapshotsEqual(baseCarrier.quarantine,proposalCarrier.quarantine);
    if(!sameQuarantine)return null;
    if(targetBlock!==sourceBlock&&after.length===before.length+1&&
      before.every((record,index)=>transitionRecordEqual(record,after[index]))){
      const appended=after.at(-1),overlay=appended?.diff?.recoveryWeek;
      const targetWasAbsent=!before.some(record=>record?.diff?.recoveryWeek?.blockId===targetBlock);
      if(targetWasAbsent&&appended?.predecessor?.programId===base.programMeta.id&&
        appended.predecessor.blockId===sourceBlock&&
        appended.predecessor.durableRevision===journal.expectedStorageRevision&&
        overlay?.blockId===targetBlock&&overlay?.reassessmentOutcome===null&&
        typeof journal.expectedProgramFingerprint==="string"&&
        draftProgramFingerprint(base)===journal.expectedProgramFingerprint)
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
          !["Better","About the same","Worse"].includes(afterOverlay?.reassessmentOutcome)||
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
      !recoveryJournalNonCarrierEqual(base,proposal,{ignoreBlockId:true}))return false;
    const baseCarrier=recoveryJournalCarrier(base),proposalCarrier=recoveryJournalCarrier(proposal);
    if(!baseCarrier||!proposalCarrier||
      storageSnapshotsEqual(baseCarrier,proposalCarrier))return false;
    const hasRecoveryRecord=[...baseCarrier.records,...proposalCarrier.records].some(record=>
      record?.kind==="recovery_week"&&record?.status==="committed");
    if(!hasRecoveryRecord)return false;
    return true;
  }

  function isRecoveryJournalAttempt(journal){
    if(journal?.recoveryTransaction===true){
      const proposalCarrier=journal?.proposal?.recoveryTransitions;
      if(!isValidRecoveryTransitions(proposalCarrier))return false;
      return proposalCarrier.records.some(record=>
        record?.kind==="recovery_week"&&record?.status==="committed");
    }
    return classifyLegacyRecoveryJournal(journal)==="start";
  }

  function transitionRecordEqual(a,b){
    if(a==null||b==null)return a==b;
    return storageSnapshotsEqual(a,b)}

  function classifyInheritedTransitionValue(value,validator){
    if(value==null)return "absent";
    return validator(value)?"supported-v1":"unknown-or-malformed"}

  function extractTransitionOutMap(snapshot){
    const history=Array.isArray(snapshot?.programHistory)?snapshot.programHistory:[];
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
      map.set(aid,h.transitionOut)}
    return{map,invalid}}

  function classifyInheritedProvenance(snapshot){
    const meta=isPlainStateObject(snapshot?.programMeta)?snapshot.programMeta:null;
    const history=Array.isArray(snapshot?.programHistory)?snapshot.programHistory:[];
    const transitionIn=classifyInheritedTransitionValue(meta?.transitionIn,isCoherentV1TransitionIn);
    const transitionOut=extractTransitionOutMap(snapshot);
    if(transitionIn==="unknown-or-malformed"||transitionOut.invalid)
      return{ok:false,transitionIn,transitionOut:transitionOut.map};
    const records=[];
    if(meta?.transitionIn!=null)records.push({holderId:meta.id,value:meta.transitionIn});
    for(const row of history){
      if(!isPlainStateObject(row))return{ok:false,transitionIn,transitionOut:transitionOut.map};
      if(row.meta==null)continue;
      if(!isPlainStateObject(row.meta))return{ok:false,transitionIn,transitionOut:transitionOut.map};
      const status=classifyInheritedTransitionValue(row.meta.transitionIn,isCoherentV1TransitionIn);
      if(status==="unknown-or-malformed")return{ok:false,transitionIn,transitionOut:transitionOut.map};
      if(status==="supported-v1")records.push({holderId:row.id,value:row.meta.transitionIn});
    }
    const archivesById=new Map();
    for(const row of history){
      if(row.transitionOut==null)continue;
      const id=typeof row.id==="string"&&row.id.trim()?row.id.trim():null;
      const archiveId=typeof row.archiveId==="string"&&row.archiveId.trim()?row.archiveId.trim():null;
      if(!id||!archiveId||id!==archiveId||archivesById.has(id))
        return{ok:false,transitionIn,transitionOut:transitionOut.map};
      archivesById.set(id,row);
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

  function programHistoryUniqueIds(history){
    const ids=new Set();
    for(const row of history){
      if(!isPlainStateObject(row))return null;
      const id=row.id;
      if(typeof id!=="string"||!id.trim())return null;
      if(ids.has(id))return null;
      ids.add(id)}
    return ids}

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

  function isCoherentTransitionProposal(proposal,base){
    if(!proposal||!isPlainStateObject(proposal))return false;
    const propProvenance=classifyInheritedProvenance(proposal);
    if(!propProvenance.ok)return false;
    const tin=proposal.programMeta?.transitionIn;
    if(!isCoherentV1TransitionIn(tin))return false;
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
    const allWithTransId=propHist.filter(h=>h?.transitionOut?.transitionId===tin.transitionId);
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
        if(!transitionRecordEqual(newArc.meta?.transitionIn,baseTin))return false;
      }else{
        if(newArc.meta?.transitionIn!=null)return false;
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

  async function settleAppliedDraftTransaction(prepared,finalized,effect,checked,io,provisionalResult,
    forceFinalization=false){
    const transaction=pendingDraftTransaction(prepared),transactionId=transaction?.id||null;
    const contextFingerprint=transaction?draftContextFingerprint(transaction.previous):null;
    const applied=applyPendingJournalEffect(effect);
    if(applied.status==="failed"){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      return Object.assign({accepted:false,rejected:true},compensation)}
    if(!pendingDraftEffectAccepted(effect,checked,transactionId,contextFingerprint)){
      const compensation=await compensatePendingDraftTransaction(prepared,io,transactionId,effect);
      return Object.assign({accepted:false,rejected:true},compensation)}
    if(!transaction&&!forceFinalization)return{accepted:true,rejected:false,snapshot:finalized,result:null};
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
    configureHost,
    isMutationFrozen,

    // Replicas & Arbitration
    readLocalStatus,
    readIdbStatus,
    clearPrimaryReplicas,
    readAuxiliaryIdbValue,
    writeAuxiliaryIdbValue,
    deleteAuxiliaryIdbValue,
    chooseSnapshot,
    snapshotsEqual,
    storageSnapshotsEqual,
    isValidStateShape,
    resolveBootReplicas,

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
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeDurableState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
