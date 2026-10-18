import {copySnapshot} from './session.js';

/** The sole capability authorizing early completion. UI receives this constant
 * after its confirmation; strings from imported/stored data cannot authorize it. */
export const EARLY_FINISH_CONFIRMATION = Symbol('confirmed early finish');

/** Capture/validate/commit a DraftV2 aggregate. Dependencies are explicit owners,
 * not a registry: training is createWorkoutRules(catalog); drafts owns CAS/Focus
 * flushing and raw checkpoint identity; commit holds the durable-state lock.
 * finish never clears identity until both committed and settled are true.
 * clock/id/writer are supplied by the page root so import has no side effects. */
export function createWorkoutCommands({session, training, drafts, commit, now, operationId, writer,
  earlyFinishConfirmation = EARLY_FINISH_CONFIRMATION, beforeCommit = async () => {}}) {
  async function start(label, options) {
    await drafts.flush();
    return session.run(() => drafts.start(label, options));
  }
  async function leave() {
    await drafts.flush();
    await session.idle();
    return drafts.canLeave();
  }
  async function dispatch(type, payload, ui) {
    return session.run(() => drafts.dispatch(type, payload, ui));
  }
  async function finish({expectedDraft = null, completion = 'normal'} = {}) {
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
      const snapshot = session.read(), proposal = copySnapshot(snapshot), prevLog = copySnapshot(snapshot.log);
      proposal.log = proposal.log.concat(copySnapshot(rows));
      const savedSession = capturedDraft.draftId;
      const effect = drafts.clearEffect(capturedRaw);
      await beforeCommit({session: savedSession, draftId: savedSession, revision: capturedDraft.revision});
      const expectedBlockId = Object.prototype.hasOwnProperty.call(capturedDraft.program || {}, 'blockId')
        ? capturedDraft.program.blockId : null;
      const result = await commit(proposal, {effect, reconcileSessionIds: [savedSession],
        expectedProgramId: capturedDraft.program.programId, expectedBlockId});
      if (result.committed !== true || result.settled !== true) return {result, capturedRaw};
      drafts.clearIdentity();
      return {result, completed: {rows, prevLog, session: savedSession, date: capturedDraft.program.scheduleDate,
        day: capturedDraft.program.dayLabel, startedAt: Date.parse(capturedDraft.session.startedAt) || 0, draftId: savedSession}};
    });
  }
  return Object.freeze({start, leave, dispatch, finish, projection: () => drafts.projection(), flush: () => drafts.flush()});
}

function failure(reason) { return {localOk: false, idbOk: false, reason}; }
function invalid(issues) { return {localOk: false, idbOk: false, validation: true, issues}; }
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
