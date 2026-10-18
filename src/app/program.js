import {copySnapshot} from './session.js';

/** Installed editor Apply owns refreshing, lock-held canonical intent rebase,
 * pending Suggest loads confirmation and exact draft impact. The authoring owner
 * supplies canonical algorithms; the view supplies already-captured speculative
 * document/intents, including any focused name field. No rendering or telemetry.
 *
 * read/refreshHead/commit are the root's durable owner capabilities. authoring:
 * token, tokenEqual, rebaseDocument, confirmOptIn, impact, snapshotFromDocument.
 * drafts: readRaw, clearEffect, dayReplacementEffect. */
export function createProgramCommands({read, refreshHead, commit, authoring, drafts}) {
  async function applyEdits({expectedToken, nextDocument, edits = [], discardWorkout = false}) {
    const capturedEdits = copySnapshot(edits), capturedToken = copySnapshot(expectedToken);
    const capturedDocument = copySnapshot(nextDocument);
    const refreshed = await refreshHead();
    if (refreshed.conflict) return {ok: false, conflict: true, editorConflict: true};
    const head = refreshed.head || read(), headToken = authoring.token(head);
    if (capturedToken?.blockId !== headToken.blockId) return staleBlock();
    let document = capturedDocument;
    if (!authoring.tokenEqual(capturedToken, headToken)) {
      const rebased = authoring.rebaseDocument({edits: capturedEdits}, head);
      if (rebased.conflict) return editorConflict(rebased.code);
      document = rebased.document;
    }
    const optIn = authoring.confirmOptIn(document);
    if (!optIn.ok) return invalidOptIn(optIn);
    document = optIn.document;
    const impact = authoring.impact(document, head, capturedEdits);
    if (impact.active && impact.incompatible && !discardWorkout) return {ok: false, workoutConflict: true, impact};
    const proposal = authoring.snapshotFromDocument(document, head);
    const rename = capturedEdits.find(edit => edit?.kind === 'day_name' && edit.before !== undefined && edit.after !== undefined);
    const renameEffect = rename ? drafts.dayReplacementEffect(String(rename.before), String(rename.after), proposal) : null;
    const raw = drafts.readRaw();
    const effect = impact.active && impact.incompatible || discardWorkout && raw != null
      ? drafts.clearEffect(raw) : impact.effect || renameEffect;
    const dayRenames = capturedEdits.filter(edit => edit?.kind === 'day_name' && edit.before !== undefined && edit.after !== undefined)
      .map(edit => ({from: String(edit.before), to: String(edit.after)}));
    const result = await commit(proposal, {effect, dayRenames,
      expectedProgramId: headToken.programId, expectedBlockId: headToken.blockId,
      preflight: ({head: lockedHead}) => {
        const lockedToken = authoring.token(lockedHead);
        if (headToken.blockId !== lockedToken.blockId) return {reject: true, result: staleBlock()};
        if (!authoring.tokenEqual(headToken, lockedToken)) {
          const rebased = authoring.rebaseDocument({edits: capturedEdits}, lockedHead);
          if (rebased.conflict) return {reject: true, result: editorConflict(rebased.code)};
          const lockedOptIn = authoring.confirmOptIn(rebased.document);
          if (!lockedOptIn.ok) return {reject: true, result: invalidOptIn(lockedOptIn)};
          document = lockedOptIn.document;
        }
        const lockedImpact = authoring.impact(document, lockedHead, capturedEdits);
        if (lockedImpact.active && lockedImpact.incompatible && !discardWorkout)
          return {reject: true, result: {ok: false, workoutConflict: true, impact: lockedImpact}};
        // A draft created while waiting cannot be consumed by a rename that had
        // no captured draft receipt. Retain the production abort-same-day guard.
        if (!discardWorkout && abortsSameDay(lockedImpact.effect) && !abortsSameDay(effect))
          return {reject: true, result: {ok: false, draftConflict: true, impact: lockedImpact}};
        return {proposal: authoring.snapshotFromDocument(document, lockedHead)};
      }});
    if (result.committed === true && result.settled === true)
      return {...result, ok: true, document, token: authoring.token(read()),
        discardedWorkout: effect?.status === 'valid' && effect.effect?.kind === 'clear-draft'};
    return {...result, ok: false, conflict: !!(result.conflict || result.staleRevision)};
  }
  return Object.freeze({applyEdits});
}
function staleBlock() { return {ok: false, conflict: true, editorConflict: true, staleBlock: true}; }
function editorConflict(code) { return {ok: false, conflict: true, editorConflict: true, code}; }
function invalidOptIn(result) { return {ok: false, invalid: true, suggestLoads: result.issues?.[0] || null}; }
function abortsSameDay(effect) { return effect?.status === 'valid' && effect.effect?.precondition === 'abort-same-day'; }
