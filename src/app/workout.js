import {copySnapshot} from './session.js';

/** @typedef {import('./session.js').Snapshot} Snapshot
 * @typedef {import('./session.js').HistoryRow} HistoryRow
 * @typedef {import('./session.js').Commit} Commit
 * @typedef {{code:string,exerciseInstanceId?:string,setId?:string,[key:string]:unknown}} Issue
 * @typedef {{kind:'domain-error',issues?:Issue[]}} DomainError
 * @typedef {{draftId:string,revision:number}} DraftIdentity
 * @typedef {DraftIdentity & {program:{programId:string,blockId?:string|null,scheduleDate:string,dayLabel:string},session:{startedAt:string},exerciseOrder:string[],exercises:Record<string,{status?:string,setOrder:string[],sets:Record<string,{completion?:string}>}>}} WorkoutDraft
 * @typedef {{read:()=>Readonly<Snapshot>,run:<R>(command:()=>R|Promise<R>)=>Promise<R>,idle:()=>Promise<void>}} SessionOwner
 * @typedef {{validateForSave:(draft:WorkoutDraft)=>Issue[],reduce:(draft:WorkoutDraft,command:Record<string,unknown>)=>WorkoutDraft|DomainError,isDomainError:(value:unknown)=>value is DomainError,toHistoryRows:(draft:WorkoutDraft,createdAt:string)=>HistoryRow[]|DomainError}} WorkoutRules
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
 * @param {{session:SessionOwner,training:WorkoutRules,drafts:DraftOwner,commit:Commit,now:()=>string,operationId:()=>string,writer:(id:string)=>unknown,earlyFinishConfirmation?:symbol,beforeCommit?:(captured:{session:string,draftId:string,revision:number})=>Promise<void>}} options */
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
      if (training.isDomainError(finishing)) return {result: invalid(finishing.issues || [])};
      const issues = training.validateForSave(finishing);
      if (issues.length) return {result: invalid(issues)};
      const rows = training.toHistoryRows(finishing, now());
      if (training.isDomainError(rows)) return {result: invalid(rows.issues || [])};
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
