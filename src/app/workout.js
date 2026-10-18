import {copySnapshot} from './session.js';
import {canonicalDraftField,canonicalMetricInput,canonicalNumberText,effortForRir} from '../training/metrics.js';

/** @typedef {import('./session.js').Snapshot} Snapshot
 * @typedef {import('./session.js').HistoryRow} HistoryRow
 * @typedef {import('./session.js').Commit} Commit
 * @typedef {import('../training/workout-contracts.js').SaveIssue} Issue
 * @typedef {import('../training/workout-contracts.js').DomainError} DomainError
 * @typedef {{draftId:string,revision:number}} DraftIdentity
 * @typedef {import('../training/workout-contracts.js').DraftSet} DraftSet
 * @typedef {import('../training/workout-contracts.js').Draft} WorkoutDraft
 * @typedef {Pick<ReturnType<typeof import('./session.js').createSession<Snapshot>>,'read'|'run'|'idle'>} SessionOwner
 * @typedef {ReturnType<typeof import('../training/workout.js').createWorkoutRules>} WorkoutRules
 * @typedef {{flush:()=>Promise<void>,read:()=>{draft:WorkoutDraft|null,raw:string|null,recovery?:{attempt?:unknown,status?:string}|null},start:(label:string,options?:Record<string,unknown>)=>Promise<unknown>,dispatch:(type:string,payload:Record<string,unknown>,ui:Record<string,unknown>)=>Promise<unknown>,projection:()=>unknown,clearIdentity:()=>void,clearEffect:(raw:string|null)=>import('./session.js').DraftEffect|null,canLeave:()=>boolean}} DraftOwner
 */

/** The sole capability authorizing early completion. UI receives this constant
 * after its confirmation; strings from imported/stored data cannot authorize it. */
export const EARLY_FINISH_CONFIRMATION = Symbol('confirmed early finish');

/** Capture/validate/commit a DraftV2 aggregate. Dependencies are explicit owners,
 * not a registry: training is createWorkoutRules(catalog); drafts owns CAS/Focus
 * flushing and raw checkpoint identity; commit holds the durable-state lock.
 * finish never clears identity until both committed and settled are true.
 * clock/id/writer are supplied by the page root so import has no side effects.
 * @param {{session:SessionOwner,training:WorkoutRules,drafts:DraftOwner,commit:Commit,now:()=>string,operationId:()=>string,writer:(id:string)=>import('../training/workout-contracts.js').Writer,earlyFinishConfirmation?:symbol,beforeCommit?:(captured:{session:string,draftId:string,revision:number})=>Promise<void>}} options */
export function createWorkoutCommands({session, training, drafts, commit, now, operationId, writer,
  earlyFinishConfirmation = EARLY_FINISH_CONFIRMATION, beforeCommit = async () => {}}) {
  /** @param {string} label @param {Record<string,unknown>} [options] */
  async function start(label, options) {
    await drafts.flush();
    return session.run(() => drafts.start(label, options));
  }
  async function leave() {
    await drafts.flush();
    await session.idle();
    return drafts.canLeave();
  }
  /** @param {string} type @param {Record<string,unknown>} [payload] @param {Record<string,unknown>} [ui] */
  async function dispatch(type, payload = {}, ui = {}) {
    return session.run(() => drafts.dispatch(type, payload, ui));
  }
  /** @param {{expectedDraft?:DraftIdentity|null,completion?:string|symbol,io?:unknown}} [options] */
  async function finish({expectedDraft = null, completion = 'normal', io} = {}) {
    // Flush outside the command queue: pending Focus input may itself dispatch
    // a queued command. Holding the queue while flushing would deadlock.
    await drafts.flush();
    return session.run(async () => {
      const {draft, raw, recovery} = drafts.read();
      if (expectedDraft && (draft?.draftId !== expectedDraft.draftId || draft?.revision !== expectedDraft.revision))
        return {result: failure('stale-confirmation')};
      if (!draft) return {result: null};
      if (recovery?.attempt || recovery?.status === 'refresh-failed') return {result: failure('recovery-pending')};
      const earlyConfirmed = completion === earlyFinishConfirmation;
      if (completion !== 'normal' && !earlyConfirmed) return {result: failure('invalid-finish-kind')};
      if (!earlyConfirmed) {
        const invalidInput = training.validateForSave(draft).filter(issue => issue.code !== 'finish-required' && issue.code !== 'no-work');
        if (invalidInput.length) return {result: invalid(invalidInput)};
        const incomplete = normalFinishIssues(draft);
        if (incomplete.length) return {result: invalid(incomplete)};
      }
      const capturedDraft = copySnapshot(draft), capturedRaw = raw, id = operationId();
      const finishing = training.reduce(capturedDraft, {type: 'beginFinish', operationId: id,
        expectedRevision: capturedDraft.revision, updatedAt: now(), writer: writer(id)});
      if (training.isDomainError(finishing)) return {result: invalid(/** @type {Issue[]} */(finishing.issues || []))};
      const issues = training.validateForSave(finishing);
      if (issues.length) return {result: invalid(issues)};
      const rows = training.toHistoryRows(finishing, now());
      if (training.isDomainError(rows)) return {result: invalid(/** @type {Issue[]} */(rows.issues || []))};
      const snapshot = session.read(), proposal = {...copySnapshot(snapshot)}, prevLog = copySnapshot(snapshot.log);
      proposal.log = proposal.log.concat(copySnapshot(rows));
      const savedSession = capturedDraft.draftId;
      const effect = drafts.clearEffect(capturedRaw);
      await beforeCommit({session: savedSession, draftId: savedSession, revision: capturedDraft.revision});
      const expectedBlockId = Object.prototype.hasOwnProperty.call(capturedDraft.program || {}, 'blockId')
        ? capturedDraft.program.blockId : null;
      const result = await commit(proposal, {effect, reconcileSessionIds: [savedSession],
        expectedProgramId: capturedDraft.program.programId, expectedBlockId}, io || undefined);
      if (result.committed !== true || result.settled !== true) return {result, capturedRaw};
      drafts.clearIdentity();
      return {result, completed: {rows, prevLog, session: savedSession, date: capturedDraft.program.scheduleDate,
        day: capturedDraft.program.dayLabel, startedAt: Date.parse(capturedDraft.session.startedAt) || 0, draftId: savedSession}};
    });
  }
  async function flush() {
    await drafts.flush();
    await session.idle();
    await drafts.flush();
  }
  return Object.freeze({start, leave, dispatch, finish, projection: () => drafts.projection(), flush});
}

/** @param {string} reason */
function failure(reason) { return {localOk: false, idbOk: false, reason}; }
/** @param {Issue[]} issues */
function invalid(issues) { return {localOk: false, idbOk: false, validation: true, issues}; }
/** @param {WorkoutDraft} draft @returns {Issue[]} */
function normalFinishIssues(draft) {
  const issues = [];
  for (const exerciseInstanceId of draft?.exerciseOrder || []) {
    const exercise = draft.exercises?.[exerciseInstanceId];
    if (!exercise) continue;
    if (exercise.status === 'skipped') {
      issues.push({code: 'incomplete-workout', exerciseInstanceId});
      continue;
    }
    for (const setId of exercise.setOrder || []) if (exercise.sets?.[setId]?.completion === 'pending')
      issues.push({code: 'incomplete-workout', exerciseInstanceId, setId});
  }
  return issues;
}

/** @typedef {{exerciseInstanceId:string,setId:string,ordinal:number,field?:string,metricId?:string|null}} SetTarget
 * @typedef {{status:string,error?:{code?:string,issues?:unknown[]},[key:string]:unknown}} DraftCommandResult
 * @typedef {{dispatch:(type:string,payload:Record<string,unknown>,ui?:Record<string,unknown>)=>Promise<DraftCommandResult>}} WorkoutPort
 */

/** One suggestion queue owns the reservation before Complete and the bounded
 * source-revision retry. planUpdates is pure training data construction; this
 * owner performs all writes. No renderer, recovery sheet or arbitrary job bus.
 * @param {{workout:WorkoutPort,readDraft:()=>WorkoutDraft|null,readSnapshot:()=>Readonly<Snapshot>,planUpdates:(input:{exerciseId:string,draft:WorkoutDraft,snapshot:Readonly<Snapshot>})=>unknown[]|null,beforeRefresh?:(exerciseId:string)=>Promise<void>}} options */
export function createWorkoutSuggestionCommands({workout,readDraft,readSnapshot,planUpdates,beforeRefresh=async()=>{}}) {
  let tail=Promise.resolve();
  /** @param {string} exerciseId @returns {Promise<DraftCommandResult>} */
  async function perform(exerciseId) {
    await beforeRefresh(exerciseId);
    for(let attempt=0;attempt<2;attempt++){
      const draft=readDraft();if(!draft)return{status:'missing'};
      const sourceRevision=draft.revision;
      const updates=planUpdates({exerciseId,draft,snapshot:readSnapshot()});
      if(updates===null)return{status:'missing'};
      if(!updates.length)return{status:'unchanged'};
      const result=await workout.dispatch('refreshUntouchedSuggestions',{sourceRevision,updates});
      if(result.status==='applied')return result;
      if(result.status==='domain-error'&&result.error?.code==='stale-suggestion')continue;
      return result;
    }
    return{status:'refresh-failed'};
  }
  /** @param {string} exerciseId */
  function refresh(exerciseId){
    const result=tail.then(()=>perform(exerciseId));
    tail=result.then(()=>undefined,()=>undefined);
    return result;
  }
  function reserve(){
    /** @type {(exerciseId:string|null)=>void} */
    let release=()=>{};
    let started=false;
    const gate=new Promise(/** @param {(value:string|null)=>void} resolve */ resolve=>{release=resolve});
    const result=tail.then(()=>gate).then(exerciseId=>exerciseId===null?{status:'unchanged'}:perform(exerciseId));
    tail=result.then(()=>undefined,()=>undefined);
    return Object.freeze({
      /** @param {string} exerciseId */
      start(exerciseId){if(!started){started=true;release(exerciseId);}return result;},
      cancel(){if(!started){started=true;release(null);}},
    });
  }
  async function flush(){for(;;){const pending=tail;await pending;if(pending===tail)return;}}
  return Object.freeze({refresh,reserve,flush});
}

/** @typedef {{draftId:string,exerciseInstanceId:string,setId:string,fields:{load?:string|null,reps?:string|null,rir?:string|null,effort?:string|null},metrics:Record<string,string|null>|null,completedAt?:string}} EditSnapshot
 * @typedef {{metric:import('../training/metrics.js').MetricDefinition|null,ordinal:number,value:string}} LoadCarry
 */

/** Focus emits stable aggregate targets and captured display facts. These
 * commands own canonical input, what gets acknowledged before Complete, and
 * raw-value cancellation. DOM focus, pending tokens, rest and toasts stay UI.
 * @param {{workout:WorkoutPort,training:{manualLoadCarry:(draft:WorkoutDraft,exerciseId:string,ordinal:number,options:{status?:string,pendingLoad?:boolean})=>LoadCarry|null},readDraft:()=>WorkoutDraft|null,readUnit:()=>string,suggestions:ReturnType<typeof createWorkoutSuggestionCommands>,now:()=>string,onSetAcknowledged?:(facts:{nowDone:boolean,exerciseInstanceId:string,ordinal:number,editing:boolean})=>void}} options */
export function createFocusWorkoutCommands({workout,training,readDraft,readUnit,suggestions,now,onSetAcknowledged=()=>{}}) {
  /** @param {SetTarget} target */
  const current=target=>readDraft()?.exercises?.[target.exerciseInstanceId]?.sets?.[target.setId]||null;
  /** @param {{target:SetTarget,rawValue:unknown}} request */
  async function editField({target,rawValue}){
    const set=current(target);if(!set||!target.field)return{status:'missing'};
    const at={exerciseInstanceId:target.exerciseInstanceId,setId:target.setId};
    if(target.metricId){
      const metric=set.programmed.metrics?.find(item=>item.id===target.metricId);
      if(!metric)return{status:'missing'};
      return workout.dispatch('editMetricValue',{...at,metricId:target.metricId,value:canonicalMetricInput(metric,rawValue,readUnit())},{pendingValue:String(rawValue??'')});
    }
    return workout.dispatch('editSetField',{...at,field:target.field,value:canonicalDraftField(target.field,rawValue,readUnit())},{pendingValue:String(rawValue??'')});
  }
  /** @param {{target:SetTarget,status?:string,pendingLoad?:boolean,editing?:boolean,displayedEffort?:{field:'rir'|'effort',value:string,pending:boolean}|null}} request */
  async function toggleSet({target,status,pendingLoad=false,editing=false,displayedEffort=null}){
    const draft=readDraft(),set=current(target);if(!draft||!set)return{status:'missing'};
    const type=set.completion==='pending'?'completeSet':'uncommitSet';
    const at={exerciseInstanceId:target.exerciseInstanceId,setId:target.setId};
    if(type==='completeSet'){
      const carry=training.manualLoadCarry(draft,target.exerciseInstanceId,target.ordinal,{status,pendingLoad});
      if(carry){
        const result=await workout.dispatch(carry.metric?'editMetricValue':'editSetField',carry.metric
          ?{...at,metricId:carry.metric.id,value:carry.value}:{...at,field:'load',value:carry.value});
        if(result.status!=='applied')return result;
      }
      if(set.programmed.metrics&&displayedEffort&&set.edited[displayedEffort.field]==null&&!displayedEffort.pending&&displayedEffort.value!==''){
        const result=await workout.dispatch('editSetField',{...at,field:displayedEffort.field,value:displayedEffort.value});
        if(result.status!=='applied')return result;
      }
    }
    const reservation=type==='completeSet'?suggestions.reserve():null;
    let refreshStarted=false;
    try{
      const result=await workout.dispatch(type,at);
      if(result.status!=='applied')return result;
      const acknowledged=current(target);if(!acknowledged)return{status:'missing'};
      const nowDone=acknowledged.completion!=='pending';
      onSetAcknowledged({nowDone,exerciseInstanceId:target.exerciseInstanceId,ordinal:target.ordinal,editing});
      if(nowDone&&reservation){
        refreshStarted=true;
        const refreshed=await reservation.start(target.exerciseInstanceId);
        if(refreshed.status!=='applied'&&refreshed.status!=='unchanged')return{...refreshed,phase:'suggestion-refresh'};
      }
      return{...result,nowDone,exerciseInstanceId:target.exerciseInstanceId,ordinal:target.ordinal};
    }finally{if(reservation&&!refreshStarted)reservation.cancel();}
  }
  /** @param {{target:SetTarget}} request */
  async function reopenSet({target}){
    const draft=readDraft(),set=current(target);if(!draft||!set)return{status:'missing'};
    /** @type {EditSnapshot} */
    const snapshot={draftId:draft.draftId,exerciseInstanceId:target.exerciseInstanceId,setId:target.setId,
      fields:copySnapshot({load:set.edited.load,reps:set.edited.reps,rir:set.edited.rir,effort:set.edited.effort}),
      metrics:set.programmed.metrics?.length?copySnapshot(set.edited.metrics||{}):null,
      completedAt:typeof set.completion==='object'?set.completion.completedAt:undefined};
    const result=await workout.dispatch('uncommitSet',{exerciseInstanceId:target.exerciseInstanceId,setId:target.setId});
    return result.status==='applied'?{...result,snapshot}:result;
  }
  /** @param {{target:SetTarget,snapshot:EditSnapshot}} request */
  async function cancelEdit({target,snapshot}){
    const draft=readDraft(),set=current(target);if(!draft||!set)return{status:'missing'};
    if(draft.draftId!==snapshot.draftId||target.exerciseInstanceId!==snapshot.exerciseInstanceId||target.setId!==snapshot.setId)
      return{status:'stale'};
    const at={exerciseInstanceId:target.exerciseInstanceId,setId:target.setId};
    if(snapshot.metrics){
      for(const [metricId,value]of Object.entries(snapshot.metrics)){
        if(set.edited.metrics?.[metricId]===value)continue;
        const result=await workout.dispatch('editMetricValue',{...at,metricId,value});if(result.status!=='applied')return result;
      }
    }
    const fields=/** @type {('load'|'reps'|'rir'|'effort')[]} */(snapshot.metrics?['rir','effort']:['load','reps','rir','effort']);
    for(const field of fields){
      const value=snapshot.fields[field];if(value==null)continue;
      const result=await workout.dispatch('editSetField',{...at,field,value});if(result.status!=='applied')return result;
    }
    return workout.dispatch('completeSet',{...at,completedAt:snapshot.completedAt||now()});
  }
  /** @param {{target:SetTarget}} request */
  async function toggleWarmup({target}){
    const set=current(target);if(!set)return{status:'missing'};
    return workout.dispatch(set.role==='warmup'?'markWorking':'markWarmup',{exerciseInstanceId:target.exerciseInstanceId,setId:target.setId});
  }
  /** Restore the captured skipped membership in acknowledged exercise order.
   * A refusal stops the sequence; subsequent commands never guess a new list. */
  async function restoreExercises(){
    const draft=readDraft();if(!draft)return false;
    const skipped=draft.exerciseOrder.filter(id=>draft.exercises[id]?.status==='skipped');
    for(const exerciseInstanceId of skipped){
      const result=await workout.dispatch('restoreExercise',{exerciseInstanceId});
      if(result.status!=='applied')return false;
    }
    return true;
  }
  return Object.freeze({editField,toggleSet,reopenSet,cancelEdit,toggleWarmup,restoreExercises});
}

/** Exercise actions capture acknowledged draft/query facts and issue named
 * commands. History is copied as canonical metric values, never display units.
 * @param {{workout:WorkoutPort,read:()=>{draft:WorkoutDraft|null,query:import('./workout-model.js').WorkoutCapture,program:readonly import('./workout-model.js').Exercise[],effortMode:boolean}}} options */
export function createWorkoutExerciseCommands({workout,read}){
  /** @param {string} exerciseInstanceId */
  async function repeatPrevious(exerciseInstanceId){
    const {draft,query,program,effortMode}=read(),base=program.find(ex=>ex.id===exerciseInstanceId);
    const previous=base?query.last(query.sessionExercise(base)):[];
    if(!draft||!previous.length)return{status:'missing'};
    const values=previous.map(row=>Array.isArray(row.metricValues)?{
      ordinal:row.set,metrics:Object.fromEntries(row.metricValues.map(value=>[value.metricId,canonicalNumberText(value.value)])),
      ...(row.rir==null?{}:effortMode?{effort:effortForRir(row.rir)}:{rir:canonicalNumberText(row.rir)})
    }:{ordinal:row.set,load:canonicalNumberText(row.load),reps:canonicalNumberText(row.reps),
      ...(effortMode?{effort:effortForRir(row.rir)}:{rir:canonicalNumberText(row.rir)})});
    return workout.dispatch('repeatPreviousSetValues',{exerciseInstanceId,values});
  }
  /** @param {string} exerciseInstanceId @param {string} setId */
  async function toggleWarmup(exerciseInstanceId,setId){
    const set=read().draft?.exercises[exerciseInstanceId]?.sets[setId];if(!set)return{status:'missing'};
    return workout.dispatch(set.role==='warmup'?'markWorking':'markWarmup',{exerciseInstanceId,setId});
  }
  /** @param {string} exerciseInstanceId */
  async function restoreOriginal(exerciseInstanceId){if(!read().draft)return{status:'missing'};return workout.dispatch('restoreOriginalExercise',{exerciseInstanceId});}
  /** @param {string} exerciseInstanceId */
  async function toggleSkipped(exerciseInstanceId){
    const draft=read().draft;if(!draft)return{status:'missing'};
    return workout.dispatch(draft.exercises[exerciseInstanceId]?.status==='skipped'?'restoreExercise':'skipExercise',{exerciseInstanceId});
  }
  return Object.freeze({repeatPrevious,toggleWarmup,restoreOriginal,toggleSkipped});
}
