#!/usr/bin/env node
/**
 * Negative fault-injection and contract test suite for the normalized durable outcome contract.
 *
 * Verifies:
 * 1. The normalized durable outcome contract accurately distinguishes:
 *    - committed (both replicas settled)
 *    - already_committed (idempotent duplicate)
 *    - rejected / conflict (precondition, lock, stale revision, or transfer freeze)
 *    - deferred (partial writes or finalization pending; NEVER flattened to committed)
 *    - failed (storage IO error)
 * 2. Fault injection under simulated storage faults:
 *    - localStorage failure
 *    - IndexedDB failure
 *    - Install transfer mutation freeze
 *    - Concurrent draft conflict
 *    - Interrupted / deferred settlement
 */
import assert from "node:assert/strict";
import DurableState from "../durable-state.js";

const failures = [];

function check(condition, message, detail) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

console.log("\n1. Pure outcome contract normalizer");

// Case 1: Committed dual-replica write
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: true,
    idbOk: true,
    revision: 12,
    accepted: true,
  });
  check(outcome.status === "committed", "Committed status is 'committed'");
  check(outcome.kind === "committed", "Committed maps to the committed workflow kind");
  check(outcome.committed === true, "Committed is true when both replicas succeed");
  check(outcome.settled === true, "Settled is true for committed outcome");
  check(outcome.rejected === false, "Rejected is false for committed outcome");
  check(outcome.deferred === false, "Deferred is false for committed outcome");
  check(outcome.conflict === false, "Conflict is false for committed outcome");
  check(outcome.revision === 12, "Revision is preserved");
  check(outcome.localOk === true && outcome.idbOk === true, "Both replica flags are true");
}

// Case 2: Already committed / Idempotent
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: true,
    idbOk: true,
    revision: 15,
    alreadyCommitted: true,
    accepted: true,
  });
  check(outcome.status === "already_committed", "Idempotent duplicate status is 'already_committed'");
  check(outcome.kind === "already_committed", "Idempotent duplicate maps to already_committed");
  check(outcome.committed === true, "Idempotent duplicate reports committed: true");
  check(outcome.alreadyCommitted === true, "alreadyCommitted flag is preserved");
  check(outcome.settled === true, "Settled is true for already-committed");
  check(outcome.rejected === false, "Rejected is false for already-committed");
}

// Case 3: Precondition / Stale revision conflict
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    conflict: true,
    staleRevision: true,
    revision: 10,
  });
  check(outcome.status === "rejected", "Stale revision status is 'rejected'");
  check(outcome.kind === "rejected_conflict", "Stale revision maps to rejected_conflict");
  check(outcome.committed === false, "Stale revision is NOT committed");
  check(outcome.rejected === true, "Rejected is true for stale revision");
  check(outcome.conflict === true, "Conflict is true for stale revision");
  check(outcome.staleRevision === true, "staleRevision flag is preserved");
  check(outcome.code === "stale_proposal", "Code is 'stale_proposal'");
}

// Case 4: Install transfer mutation freeze
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    conflict: true,
    transferFrozen: true,
  });
  check(outcome.status === "rejected", "Transfer frozen status is 'rejected'");
  check(outcome.committed === false, "Transfer frozen is NOT committed");
  check(outcome.transferFrozen === true, "transferFrozen flag is preserved");
  check(outcome.code === "install-transfer-frozen", "Code is 'install-transfer-frozen'");
}

// Case 5: Draft conflict
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    draftConflict: true,
    revision: 8,
  });
  check(outcome.status === "rejected", "Draft conflict status is 'rejected'");
  check(outcome.committed === false, "Draft conflict is NOT committed");
  check(outcome.draftConflict === true, "draftConflict flag is preserved");
  check(outcome.code === "draft_conflict", "Code is 'draft_conflict'");
}

// Logical duplicate/ineligibility is a conflict, not a storage failure.
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    duplicate: true,
    ineligible: true,
    revision: 9,
  });
  check(outcome.kind === "rejected_conflict", "Duplicate/ineligible result maps to rejected_conflict");
  check(outcome.status === "rejected" && outcome.conflict === true,
    "Duplicate/ineligible result retains logical conflict semantics");
}

// A WAL failure is an operational failure even when a required draft effect
// also reports draftConflict to preserve the legacy caller signal.
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    journalFailed: true,
    draftConflict: true,
    revision: 9,
  });
  check(outcome.kind === "rejected_failure", "Journal failure maps to rejected_failure");
  check(outcome.status === "failed" && outcome.code === "journal_failed",
    "Journal failure preserves its operational failure code");
}

// Case 6: Settlement deferred / Close deferred - MUST NEVER flatten to committed
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: true,
    idbOk: true,
    revision: 20,
    accepted: true,
    deferred: true,
    finalizationPending: true,
  });
  check(outcome.status === "deferred", "Deferred write status is 'deferred'");
  check(outcome.kind === "deferred_pending", "Deferred settlement maps to deferred_pending");
  check(outcome.committed === false, "CRITICAL: Deferred write is NOT flattened to committed: true");
  check(outcome.deferred === true, "Deferred flag is true");
  check(outcome.finalizationPending === true, "finalizationPending is true");
  check(outcome.settled === false, "Settled is false for deferred write");
  check(outcome.accepted === true, "Accepted is preserved for deferred write");
}

// Case 7: One-replica write without explicit allowDegradedCommit
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: true,
    idbOk: false,
    revision: 5,
  });
  check(outcome.status === "partial", "Partial write status is 'partial' by default");
  check(outcome.kind === "deferred_pending", "Unaccepted partial write maps to deferred_pending");
  check(outcome.committed === false, "Partial one-replica write is NOT committed by default");
  check(outcome.settled === false, "Partial one-replica write is NOT settled");
  check(outcome.localOk === true, "localOk is true");
  check(outcome.idbOk === false, "idbOk is false");
}

// Case 8: A workflow that permits one-replica acceptance remains explicit.
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: true,
    idbOk: false,
    revision: 6,
    accepted: true,
  });
  check(outcome.status === "partial", "Accepted one-replica write remains partial");
  check(outcome.kind === "degraded_committed", "Accepted one-replica write maps to degraded_committed");
  check(outcome.accepted === true, "Degraded committed workflow remains accepted");
  check(outcome.committed === false, "Degraded committed does not claim both replicas settled");
  check(outcome.recoveryPending === true, "Degraded committed exposes replica recovery work");
}

// Case 9: Fatal storage failure (both replicas failed)
{
  const outcome = DurableState.normalizeDurableOutcome({
    localOk: false,
    idbOk: false,
    revision: 0,
  });
  check(outcome.status === "failed", "Total storage failure status is 'failed'");
  check(outcome.kind === "rejected_failure", "Total storage failure maps to rejected_failure");
  check(outcome.committed === false, "Total failure is NOT committed");
  check(outcome.settled === false, "Total failure is NOT settled");
  check(outcome.rejected === false, "Total failure is not a logical rejection");
}

console.log("\n2. Fault-injection under simulated storage faults");

// Mock LocalStorage and IndexedDB environment for node test
const mockLocalStorage = (() => {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] || null; },
  };
})();

globalThis.localStorage = mockLocalStorage;

// Fault Test A: writeSnapshot with failing adapter
{
  const failingIdbAdapter = {
    async writeLocal(snapshot) { return true; },
    async writeIdb(snapshot) { throw new Error("Disk quota exceeded"); },
  };
  const res = await DurableState.writeSnapshot({ _storageRevision: 1 }, failingIdbAdapter);
  check(res.localOk === true, "Local write succeeded");
  check(res.idbOk === false, "IDB write failed cleanly without unhandled rejection");

  const health = DurableState.getStorageHealth();
  check(health.degraded === true, "Health is marked degraded after IDB write failure");
  check(health.idbFailed === true, "Health notes idbFailed");
}

// Fault Test B: writeSnapshot with totally failing adapter
{
  const totalFailAdapter = {
    async writeLocal(snapshot) { return false; },
    async writeIdb(snapshot) { return false; },
  };
  const res = await DurableState.writeSnapshot({ _storageRevision: 2 }, totalFailAdapter);
  check(res.localOk === false && res.idbOk === false, "Both replicas fail");
  const health = DurableState.getStorageHealth();
  check(health.localFailed === true && health.idbFailed === true, "Health notes dual failure");
}

// Fault Test C: Successful dual write heals degraded health
{
  const healthyAdapter = {
    async writeLocal(snapshot) { return true; },
    async writeIdb(snapshot) { return true; },
  };
  const res = await DurableState.writeSnapshot({ _storageRevision: 3 }, healthyAdapter);
  check(res.localOk === true && res.idbOk === true, "Both replicas succeed");
  const health = DurableState.getStorageHealth();
  check(health.degraded === false, "Health is no longer degraded after successful dual write");
  check(health.localFailed === false && health.idbFailed === false, "Failure flags cleared");
}

// Fault Test D: Mutation freeze check blocks writes immediately
{
  DurableState.setMutationFreezeCheck(() => true);
  const lockOutcome = await DurableState.withStorageLock(DurableState.storageIO, async () => {
    return { ok: true };
  });
  check(lockOutcome.status === "rejected", "withStorageLock rejected under transfer freeze");
  check(lockOutcome.transferFrozen === true, "transferFrozen flag set");
  check(lockOutcome.code === "install-transfer-frozen", "code is 'install-transfer-frozen'");

  DurableState.setMutationFreezeCheck(null);
}

// Fault Test E: WAL journal decode and cleanup under corruption
{
  mockLocalStorage.clear();
  mockLocalStorage.setItem("repforge_pending_v1:corrupt", "not-valid-json{{{");
  mockLocalStorage.setItem("repforge_pending_v1:valid", JSON.stringify({
    version: 2,
    id: "valid",
    order: { at: 100, writer: "contract-test", seq: 1 },
    base: {},
    liveBase: {},
    proposal: {},
    effectOutcome: { status: "none", effect: null },
  }));

  const journal = DurableState.readPendingJournal();
  check(journal.entries.length === 1, "One valid journal entry parsed");
  check(journal.invalid.length === 1, "One corrupt entry identified");
  check(journal.invalid[0].key === "repforge_pending_v1:corrupt", "Corrupt key correctly identified");

  DurableState.clearPendingJournal(journal.invalid[0]);
  check(mockLocalStorage.getItem("repforge_pending_v1:corrupt") === null, "Corrupt entry cleaned up");
}

// Fault Test F: Snapshot comparison strips storage meta without mutating input
{
  const snapA = { program: [{ id: "p1" }], _storageRevision: 5, _storageDraftTransaction: { id: "t1" } };
  const snapB = { program: [{ id: "p1" }], _storageRevision: 10 };
  check(DurableState.snapshotsEqual(snapA, snapB), "snapshotsEqual ignores storage metadata");
  check(snapA._storageRevision === 5, "Input snapshot snapA was not mutated");
  check(snapA._storageDraftTransaction !== undefined, "snapA draft txn was not deleted");
}

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} test(s) failed`);
  process.exit(1);
} else {
  console.log(`\nPASS: all durable outcome contract tests passed\n`);
}
