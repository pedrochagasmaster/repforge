import {copySnapshot} from './session.js';
import {canonicalize} from '../persistence/snapshot.js';
/** @typedef {import('./session.js').Snapshot} Snapshot
 * @typedef {import('./session.js').HistoryRow} HistoryRow
 * @typedef {import('./session.js').CommitResult} CommitResult
 * @typedef {import('./session.js').Commit} Commit
 * @typedef {{sessionId:string,rows?:HistoryRow[],originalFingerprint:string}} HistoryChange */

/** Entire raw rows participate, including unknown fields and duplicate sets.
 * Ordering/display names never change identity.
 * @param {unknown} rows */
export function sessionFingerprint(rows) {
  return JSON.stringify((Array.isArray(rows) ? rows : []).map(row => JSON.stringify(canonicalize(row))).sort());
}
/** @param {Snapshot} head @param {string} sessionId */
function rowsFor(head, sessionId) { return (head.log || []).filter(row => String(row?.session ?? '') === String(sessionId)); }
/** @param {Snapshot} head @param {string} sessionId @param {HistoryRow[]} rows */
function replaceRows(head, sessionId, rows) {
  const next = copySnapshot(head);
  next.log = next.log.filter(row => String(row?.session ?? '') !== String(sessionId)).concat(copySnapshot(rows));
  return next;
}

/** Commands recheck the complete captured session under the storage lock.
 * alreadyCommitted is only replica visibility; settlement remains mandatory.
 * Views keep speculative edits and operation/focus state, never commit policy.
 * @param {{read:()=>Snapshot,commit:Commit,readRevision:(snapshot:Snapshot)=>number,settleAlreadyCommitted:(options:{pendingJournalId?:string,verify:(head:Snapshot)=>{ok:boolean,code:string}})=>Promise<CommitResult>}} options */
export function createHistoryCommands({read, commit, readRevision, settleAlreadyCommitted}) {
  /** @param {HistoryChange} request @param {boolean} deleting */
  async function change({sessionId, rows, originalFingerprint}, deleting) {
    if (!originalFingerprint || typeof originalFingerprint !== 'string')
      return {ok: false, committed: false, settled: true, failed: true, code: 'history_missing_fingerprint',
        revision: readRevision(read()), localOk: false, idbOk: false};
    if (!deleting && (!Array.isArray(rows) || !rows.length || rows.some(row => String(row?.session ?? '') !== String(sessionId))))
      return {ok: false, committed: false, settled: true, invalid: true, code: 'history_session_identity', localOk: false, idbOk: false};
    const capturedRows = deleting ? [] : copySnapshot(rows || []), desired = sessionFingerprint(capturedRows);
    /** @param {{head:Snapshot}} context @returns {import('./session.js').PreflightResult} */
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
  return Object.freeze({correct: /** @param {HistoryChange} request */ request => change(request, false), remove: /** @param {HistoryChange} request */ request => change(request, true), fingerprint: sessionFingerprint});
}
