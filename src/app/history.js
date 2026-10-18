import {copySnapshot} from './session.js';
import {canonicalize} from '../persistence/snapshot.js';

/** Entire raw rows participate, including unknown fields and duplicate sets.
 * Ordering/display names never change identity. */
export function sessionFingerprint(rows) {
  return JSON.stringify((Array.isArray(rows) ? rows : []).map(row => JSON.stringify(canonicalize(row))).sort());
}
function rowsFor(head, sessionId) { return (head.log || []).filter(row => String(row?.session ?? '') === String(sessionId)); }
function replaceRows(head, sessionId, rows) {
  const next = copySnapshot(head);
  next.log = next.log.filter(row => String(row?.session ?? '') !== String(sessionId)).concat(copySnapshot(rows));
  return next;
}

/** Commands recheck the complete captured session under the storage lock.
 * alreadyCommitted is only replica visibility; settlement remains mandatory.
 * Views keep speculative edits and operation/focus state, never commit policy. */
export function createHistoryCommands({read, commit, readRevision, settleAlreadyCommitted}) {
  async function change({sessionId, rows, originalFingerprint}, deleting) {
    if (!originalFingerprint || typeof originalFingerprint !== 'string')
      return {ok: false, committed: false, settled: true, failed: true, code: 'history_missing_fingerprint',
        revision: readRevision(read()), localOk: false, idbOk: false};
    if (!deleting && (!Array.isArray(rows) || !rows.length || rows.some(row => String(row?.session ?? '') !== String(sessionId))))
      return {ok: false, committed: false, settled: true, invalid: true, code: 'history_session_identity', localOk: false, idbOk: false};
    const capturedRows = deleting ? [] : copySnapshot(rows), desired = sessionFingerprint(capturedRows);
    const preflight = ({head}) => {
      const current = rowsFor(head, sessionId), fingerprint = sessionFingerprint(current);
      if (deleting ? !current.length : fingerprint === desired)
        return {reject: true, result: {ok: true, committed: true, alreadyCommitted: true,
          revision: readRevision(head), localOk: true, idbOk: true, kind: 'committed'}};
      if (!current.length || fingerprint !== originalFingerprint)
        return {reject: true, result: {ok: false, committed: false, conflict: true, stale: true,
          code: 'history_stale', revision: readRevision(head), localOk: false, idbOk: false}};
      return {proposal: replaceRows(head, sessionId, capturedRows)};
    };
    const result = await commit(replaceRows(read(), sessionId, capturedRows), {preflight});
    if (!result?.alreadyCommitted) return result;
    return settleAlreadyCommitted({pendingJournalId: result.pendingJournalId, verify: head => ({
      ok: deleting ? rowsFor(head, sessionId).length === 0 : sessionFingerprint(rowsFor(head, sessionId)) === desired,
      code: 'history_settlement_mismatch'})});
  }
  return Object.freeze({correct: request => change(request, false), remove: request => change(request, true), fingerprint: sessionFingerprint});
}
