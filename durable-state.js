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
  const PENDING_EFFECT_MAX_RAW = 500000;

  const DRAFT = "repforge_draft_v1";
  const DRAFT_V2_CHECKPOINT = "repforge_draft_v1:v2-checkpoint";
  const DRAFT_PENDING_PREFIX = "repforge_draft_v1:pending:";
  const DRAFT_CLOSE_PREFIX = "repforge_draft_v1:closing:";

  const DRAFT_EFFECT_VALID = "valid";
  const DRAFT_EFFECT_INVALID = "invalid";
  const DRAFT_EFFECT_NONE = "none";

  const DRAFT_PRECONDITION_MATCH_ONLY = "match_only";
  const DRAFT_PRECONDITION_ABORT_CHANGED = "abort_changed";
  const DRAFT_PRECONDITION_ABORT_SAME_DAY = "abort_same_day";

  // In-memory state tracking for durable engine
  let persistHead = null;
  let writeTail = Promise.resolve();
  let mutationFreezeCheck = null;
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
    const copy = cloneSnapshot(snapshot);
    if (copy && typeof copy === "object") {
      delete copy[STORAGE_REV];
      delete copy[STORAGE_FOLLOWUP];
      delete copy[STORAGE_DRAFT_TXN];
      delete copy[STORAGE_SETUP_TXN];
      delete copy[SHARED_IMPORT];
    }
    return copy;
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
    return JSON.stringify(canonicalize(snapshot));
  }

  function mirrorComparisonSnapshot(snapshot) {
    const clean = stripStorageMeta(snapshot);
    if (clean && typeof clean === "object") {
      delete clean._storageRevision;
      delete clean._storageFollowUp;
      delete clean._storageDraftTransaction;
      delete clean._storageSetupActivation;
      delete clean._sharedSetupImport;
    }
    return clean;
  }

  function snapshotsEqual(a, b) {
    return canonicalPayload(mirrorComparisonSnapshot(a)) === canonicalPayload(mirrorComparisonSnapshot(b));
  }

  function storageSnapshotsEqual(a, b) {
    return readRevision(a) === readRevision(b) && snapshotsEqual(a, b);
  }

  function isValidStateShape(snapshot) {
    if (!isPlainStateObject(snapshot)) return false;
    if (snapshot.program !== undefined && !Array.isArray(snapshot.program)) return false;
    if (snapshot.log !== undefined && !Array.isArray(snapshot.log)) return false;
    if (snapshot.programHistory !== undefined && !Array.isArray(snapshot.programHistory)) return false;
    if (snapshot.settings !== undefined && !isPlainStateObject(snapshot.settings)) return false;
    if (snapshot.programMeta !== undefined && !isPlainStateObject(snapshot.programMeta)) return false;
    return true;
  }

  function snapshotBlockId(snapshot) {
    const meta = snapshot?.programMeta;
    return meta?.activeBlockId || meta?.blockId || meta?.block_id || null;
  }

  function draftProgramFingerprint(snapshot) {
    const draftStore = getDraftStore();
    return draftStore?.draftContextFingerprint ? draftStore.draftContextFingerprint(snapshot) : null;
  }

  function getDraftStore() {
    return (typeof RepForgeWorkoutDraft !== "undefined" && RepForgeWorkoutDraft.DraftStore)
      || (root && root.RepForgeWorkoutDraft && root.RepForgeWorkoutDraft.DraftStore)
      || (root && root.DraftStore)
      || null;
  }

  function getProgramTransition() {
    return (typeof RepForgeProgramTransition !== "undefined" && RepForgeProgramTransition)
      || (root && root.RepForgeProgramTransition)
      || null;
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

  async function idbGet(key) {
    let db;
    try {
      db = await openIdb();
    } catch {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      } finally {
        try { db.close(); } catch {}
      }
    });
  }

  async function idbSet(key, value) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("idb put failed"));
        tx.onerror = () => reject(tx.error || new Error("idb tx failed"));
      } catch (err) {
        reject(err);
      } finally {
        try { db.close(); } catch {}
      }
    });
  }

  async function idbDel(key) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("idb del failed"));
        tx.onerror = () => reject(tx.error || new Error("idb tx failed"));
      } catch (err) {
        reject(err);
      } finally {
        try { db.close(); } catch {}
      }
    });
  }

  // --- Replicas Status & Arbitration ---
  function readLocalStatus(key = KEY) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { status: "absent", raw: null, parsed: null };
      const parsed = JSON.parse(raw);
      if (!isValidStateShape(parsed)) return { status: "invalid", raw, parsed: null };
      return { status: "valid", raw, parsed };
    } catch {
      return { status: "invalid", raw: null, parsed: null };
    }
  }

  async function readIdbStatus(key = KEY) {
    try {
      const parsed = await idbGet(key);
      if (parsed === null || parsed === undefined) return { status: "absent", raw: null, parsed: null };
      if (!isValidStateShape(parsed)) return { status: "invalid", raw: JSON.stringify(parsed), parsed: null };
      return { status: "valid", raw: JSON.stringify(parsed), parsed };
    } catch {
      return { status: "read-failed", raw: null, parsed: null };
    }
  }

  function chooseSnapshot(local, idb) {
    if (local.status === "absent" && idb.status === "absent") {
      return { kind: "first-run" };
    }
    if (local.status === "valid" && idb.status === "absent") {
      return { kind: "chosen", snapshot: local.parsed, source: "local", heal: "idb" };
    }
    if (idb.status === "valid" && local.status === "absent") {
      return { kind: "chosen", snapshot: idb.parsed, source: "idb", heal: "local" };
    }
    if (local.status === "valid" && idb.status === "valid") {
      const lr = readRevision(local.parsed);
      const ir = readRevision(idb.parsed);
      if (lr === 0 && ir === 0) {
        if (snapshotsEqual(local.parsed, idb.parsed)) {
          return { kind: "chosen", snapshot: local.parsed, source: "local", migrate: true };
        }
        return { kind: "unresolved", reason: "divergent", local, idb };
      }
      if (lr > ir) {
        return { kind: "chosen", snapshot: local.parsed, source: "local", heal: "idb" };
      }
      if (ir > lr) {
        return { kind: "chosen", snapshot: idb.parsed, source: "idb", heal: "local" };
      }
      // lr === ir
      if (snapshotsEqual(local.parsed, idb.parsed)) {
        return { kind: "chosen", snapshot: local.parsed, source: "local" };
      }
      // Same revision, divergent content
      const lTxn = pendingDraftTransaction(local.parsed);
      const iTxn = pendingDraftTransaction(idb.parsed);
      if (lTxn && !iTxn) return { kind: "chosen", snapshot: local.parsed, source: "local", heal: "idb" };
      if (iTxn && !lTxn) return { kind: "chosen", snapshot: idb.parsed, source: "idb", heal: "local" };
      return { kind: "unresolved", reason: "divergent", local, idb };
    }
    if (local.status === "invalid" && idb.status === "invalid") {
      return { kind: "unresolved", reason: "no-valid", local, idb };
    }
    if (local.status === "read-failed" || idb.status === "read-failed") {
      return { kind: "unresolved", reason: "valid-plus-failed", local, idb };
    }
    return { kind: "unresolved", reason: "valid-plus-invalid", local, idb };
  }

  // --- Normalized Durable Outcome Contract ---
  function normalizeDurableOutcome(result, options = {}) {
    const localOk = !!result?.localOk;
    const idbOk = !!result?.idbOk;
    const revision = typeof result?.revision === "number" ? result.revision : (options.revision ?? 0);
    const conflict = !!result?.conflict;
    const draftConflict = !!result?.draftConflict;
    const alreadyCommitted = !!result?.alreadyCommitted;
    const accepted = !!result?.accepted;
    const deferred = !!result?.deferred;
    const finalizationPending = !!result?.finalizationPending;
    const compensationPending = !!result?.compensationPending;
    const transferFrozen = !!result?.transferFrozen;
    const journalFailed = !!result?.journalFailed;
    const stale = !!(result?.stale || result?.staleRevision || result?.staleBlock);
    const code = result?.code || (
      transferFrozen ? "install-transfer-frozen" :
      draftConflict ? "draft_conflict" :
      stale ? "stale_proposal" :
      conflict ? (result?.reason || "conflict") :
      journalFailed ? "journal_failed" :
      deferred ? "settlement_deferred" :
      null
    );

    let status;
    let committed;
    let settled;
    let rejected;

    if (alreadyCommitted) {
      status = "already_committed";
      committed = true;
      settled = true;
      rejected = false;
    } else if (conflict || draftConflict || transferFrozen || journalFailed) {
      status = "rejected";
      committed = false;
      settled = !compensationPending && !finalizationPending;
      rejected = true;
    } else if (deferred || finalizationPending || compensationPending) {
      status = "deferred";
      committed = false; // NEVER flatten deferred writes into committed!
      settled = false;
      rejected = false;
    } else if (localOk && idbOk) {
      status = "committed";
      committed = true;
      settled = true;
      rejected = false;
    } else if (localOk || idbOk) {
      // One replica succeeded, other failed
      if (options.allowDegradedCommit) {
        status = "committed";
        committed = true;
        settled = true;
        rejected = false;
      } else {
        status = "deferred";
        committed = false;
        settled = false;
        rejected = false;
      }
    } else {
      status = "failed";
      committed = false;
      settled = false;
      rejected = false;
    }

    return Object.assign({}, result, {
      status,
      committed,
      settled,
      rejected,
      accepted: accepted || committed,
      deferred: deferred || finalizationPending,
      localOk,
      idbOk,
      revision,
      conflict: conflict || rejected,
      code,
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
      throw new Error(`${label} requires an explicit adapter with writeLocal and writeIdb`);
    }
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

  function withStorageLock(io, op, options = {}) {
    const guarded = async (...args) => {
      if (io === storageIO && isMutationFrozen()) {
        return normalizeDurableOutcome({
          localOk: false,
          idbOk: false,
          conflict: true,
          transferFrozen: true,
          code: "install-transfer-frozen",
        });
      }
      return op(...args);
    };
    if (io === storageIO && navigator.locks?.request) {
      return navigator.locks.request(STORAGE_LOCK, guarded);
    }
    return guarded();
  }

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

  function resetPersistenceBase(snapshot) {
    persistHead = cloneSnapshot(snapshot);
  }

  async function refreshPersistenceHead(options = {}) {
    const local = readLocalStatus(), idb = await readIdbStatus();
    const decision = chooseSnapshot(local, idb);
    if (decision.kind === "first-run") return { head: cloneSnapshot(persistHead) };
    if (decision.kind !== "chosen") return { head: cloneSnapshot(persistHead), conflict: true };
    if (pendingDraftTransaction(decision.snapshot)) {
      return { head: cloneSnapshot(persistHead), conflict: true, draftTransaction: true };
    }
    const current = cloneSnapshot(persistHead);
    let disk = cloneSnapshot(decision.snapshot);

    const pt = getProgramTransition();
    if (pt?.normalizeRecoveryCarrierSnapshot) {
      let normalized;
      try {
        normalized = await pt.normalizeRecoveryCarrierSnapshot(
          disk,
          sourceReplicaForCarrierDecision(decision, local, idb),
          { priorQuarantine: current?.recoveryTransitions?.quarantine || [] }
        );
      } catch {
        return { head: current, conflict: true, recovery: true };
      }
      if (normalized.kind === "full-recovery") return { head: current, conflict: true, recovery: true };
      if (normalized.kind === "known") disk = normalized.snapshot;
    }

    const diskRev = readRevision(disk), currentRev = readRevision(current);
    if (diskRev > currentRev) return { head: disk };
    if (diskRev < currentRev || storageSnapshotsEqual(disk, current)) return { head: current };
    return { head: current, conflict: true };
  }

  function sourceReplicaForCarrierDecision(decision, local, idb) {
    if (decision.source === "local") return local;
    if (decision.source === "idb") return idb;
    return local.status === "valid" ? local : idb;
  }

  // --- Draft Effects & Coordination ---
  function draftEffectOutcome(effect) {
    if (effect == null) return { status: DRAFT_EFFECT_NONE, effect: null };
    if (!isPlainStateObject(effect)) return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "shape" };
    if (effect.required !== undefined && typeof effect.required !== "boolean") {
      return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "required" };
    }
    const precondition = effect.precondition ?? DRAFT_PRECONDITION_MATCH_ONLY;
    if (
      precondition !== DRAFT_PRECONDITION_MATCH_ONLY &&
      precondition !== DRAFT_PRECONDITION_ABORT_CHANGED &&
      precondition !== DRAFT_PRECONDITION_ABORT_SAME_DAY
    ) {
      return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "precondition" };
    }
    if (effect.kind === "clear-draft") {
      if (precondition === DRAFT_PRECONDITION_ABORT_SAME_DAY && effect.expectedRaw !== null) {
        return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "same-day-clear" };
      }
      if (
        effect.expectedRaw !== null &&
        (typeof effect.expectedRaw !== "string" || effect.expectedRaw.length > PENDING_EFFECT_MAX_RAW)
      ) {
        return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "expected-raw" };
      }
      const receipt = { kind: "clear-draft", expectedRaw: effect.expectedRaw, precondition };
      if (effect.required === true) receipt.required = true;
      if (precondition === DRAFT_PRECONDITION_ABORT_SAME_DAY) {
        if (typeof effect.conflictDay !== "string" || !effect.conflictDay || effect.conflictDay.length > 200) {
          return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "conflict-day" };
        }
        receipt.conflictDay = effect.conflictDay;
      }
      return { status: DRAFT_EFFECT_VALID, effect: receipt };
    }
    if (
      effect.kind === "replace-draft" &&
      typeof effect.replacementRaw === "string" &&
      effect.replacementRaw.length <= PENDING_EFFECT_MAX_RAW
    ) {
      if (typeof effect.expectedRaw !== "string" || effect.expectedRaw.length > PENDING_EFFECT_MAX_RAW) {
        return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "expected-raw" };
      }
      const receipt = {
        kind: "replace-draft",
        expectedRaw: effect.expectedRaw,
        replacementRaw: effect.replacementRaw,
        precondition,
      };
      if (effect.required === true) receipt.required = true;
      if (precondition === DRAFT_PRECONDITION_ABORT_SAME_DAY) {
        if (typeof effect.conflictDay !== "string" || !effect.conflictDay || effect.conflictDay.length > 200) {
          return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "conflict-day" };
        }
        receipt.conflictDay = effect.conflictDay;
      }
      return { status: DRAFT_EFFECT_VALID, effect: receipt };
    }
    return { status: DRAFT_EFFECT_INVALID, effect: null, reason: "kind" };
  }

  function normalizeDraftEffectOutcome(value) {
    if (
      isPlainStateObject(value) &&
      (value.status === DRAFT_EFFECT_VALID ||
        value.status === DRAFT_EFFECT_INVALID ||
        value.status === DRAFT_EFFECT_NONE)
    ) {
      if (value.status === DRAFT_EFFECT_VALID) return draftEffectOutcome(value.effect);
      if (value.status === DRAFT_EFFECT_NONE) return { status: DRAFT_EFFECT_NONE, effect: null };
      return { status: DRAFT_EFFECT_INVALID, effect: null, reason: value.reason || "invalid" };
    }
    return draftEffectOutcome(value);
  }

  function pendingJournalEffect(effect) {
    const outcome = normalizeDraftEffectOutcome(effect);
    return outcome.status === DRAFT_EFFECT_VALID ? outcome.effect : null;
  }

  function draftEffectRequiresCoordination(effect) {
    const outcome = normalizeDraftEffectOutcome(effect);
    return outcome.status === DRAFT_EFFECT_VALID && outcome.effect.precondition !== DRAFT_PRECONDITION_MATCH_ONLY;
  }

  function pendingDraftTransaction(snapshot) {
    const value = snapshot?.[STORAGE_DRAFT_TXN];
    if (!isPlainStateObject(value) || value.version !== 1 || typeof value.id !== "string" || !value.id) return null;
    const effectOutcome = draftEffectOutcome(value.effect), previous = value.previous;
    if (
      effectOutcome.status !== DRAFT_EFFECT_VALID ||
      !draftEffectRequiresCoordination(effectOutcome) ||
      !isPlainStateObject(previous) ||
      Object.prototype.hasOwnProperty.call(previous, STORAGE_DRAFT_TXN) ||
      !isValidStateShape(previous) ||
      readRevision(snapshot) <= readRevision(previous)
    ) {
      return null;
    }
    return { id: value.id, effect: effectOutcome.effect, previous: cloneSnapshot(previous) };
  }

  function pendingJournalEffectState(effect) {
    const outcome = normalizeDraftEffectOutcome(effect), receipt = outcome.effect;
    if (outcome.status !== DRAFT_EFFECT_VALID) return { receipt: null, status: outcome.status };
    const draftStore = getDraftStore();
    if (!draftStore) return { receipt, currentRaw: null, status: "read-failed" };
    try {
      const read = draftStore.readCanonicalStatus();
      if (read.status !== "ok") return { receipt, currentRaw: null, status: "read-failed" };
      const currentRaw = read.raw, checkpoint = draftStore.readV2Checkpoint();
      if (checkpoint.status === "invalid" || checkpoint.status === "read-failed") {
        return { receipt, currentRaw: null, status: "read-failed" };
      }
      if (receipt.precondition === DRAFT_PRECONDITION_MATCH_ONLY) {
        if (receipt.expectedRaw === currentRaw) return { receipt, currentRaw, status: "ready" };
        return { receipt, currentRaw, status: "conflict" };
      }
      if (receipt.precondition === DRAFT_PRECONDITION_ABORT_CHANGED) {
        if (receipt.expectedRaw === currentRaw) return { receipt, currentRaw, status: "ready" };
        return { receipt, currentRaw, status: "conflict" };
      }
      if (receipt.precondition === DRAFT_PRECONDITION_ABORT_SAME_DAY) {
        if (!currentRaw) return { receipt, currentRaw, status: "ready" };
        const parsed = draftStore.parseV2Draft(currentRaw);
        if (parsed?.day === receipt.conflictDay) return { receipt, currentRaw, status: "conflict" };
        return { receipt, currentRaw, status: "ready" };
      }
      return { receipt, currentRaw, status: "conflict" };
    } catch {
      return { receipt, currentRaw: null, status: "read-failed" };
    }
  }

  function applyPendingJournalEffect(effect) {
    const outcome = normalizeDraftEffectOutcome(effect);
    if (outcome.status !== DRAFT_EFFECT_VALID) return { status: outcome.status };
    const receipt = outcome.effect;
    const draftStore = getDraftStore();
    if (!draftStore) return { status: "read-failed" };
    try {
      if (receipt.kind === "clear-draft") {
        const cleared = draftStore.clearEffect({ expectedRaw: receipt.expectedRaw });
        return cleared.cleared ? { status: "applied", cleared: true } : { status: "conflict", cleared: false };
      }
      if (receipt.kind === "replace-draft") {
        const replaced = draftStore.replaceEffect({
          expectedRaw: receipt.expectedRaw,
          replacementRaw: receipt.replacementRaw,
        });
        return replaced.replaced ? { status: "applied", replaced: true } : { status: "conflict", replaced: false };
      }
      return { status: "invalid" };
    } catch {
      return { status: "read-failed" };
    }
  }

  function settlePendingDraftSidecars(transactionId, effect, restoreEffect, contextFingerprint = null) {
    if (!transactionId) return { settled: true };
    const draftStore = getDraftStore();
    if (!draftStore) return { settled: true };
    try {
      let settled = true;
      if (effect && draftEffectRequiresCoordination(effect)) {
        const end = draftStore.endClose(transactionId);
        settled = settled && !!end.closed;
      }
      if (restoreEffect && draftEffectRequiresCoordination(restoreEffect)) {
        const restored = draftStore.restoreEffect(transactionId);
        settled = settled && !!restored.restored;
      }
      const sidecar = draftStore.clearSidecar(transactionId);
      settled = settled && !!sidecar.cleared;
      if (contextFingerprint) draftStore.promote(null, contextFingerprint);
      return { settled };
    } catch {
      return { settled: false };
    }
  }

  function settlePendingDraftRecord(record, { effect = null, restoreEffect = null, contextFingerprint = null } = {}) {
    let clearedJournal = true;
    if (record?.key) {
      try {
        localStorage.removeItem(record.key);
      } catch {
        clearedJournal = false;
      }
    }
    const sidecars = settlePendingDraftSidecars(
      record?.journal?.id,
      effect || record?.journal?.effectOutcome,
      restoreEffect,
      contextFingerprint
    );
    return { settled: clearedJournal && sidecars.settled, clearedJournal, clearedSidecars: sidecars.settled };
  }

  // --- Write-Ahead Log (WAL) Primitives ---
  function pendingJournalUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try { return crypto.randomUUID(); } catch {}
    }
    return `txn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function pendingJournalOrder() {
    return Date.now();
  }

  function pendingJournalKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PENDING_PREFIX)) keys.push(key);
      }
    } catch {}
    return keys;
  }

  function decodePendingJournal(key, raw) {
    if (!raw || typeof raw !== "string") return null;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!isPlainStateObject(parsed) || parsed.version !== 2) return null;
    return parsed;
  }

  function readPendingJournal() {
    const keys = pendingJournalKeys();
    const entries = [], invalid = [];
    for (const key of keys) {
      let raw = null;
      try { raw = localStorage.getItem(key); } catch {}
      const decoded = decodePendingJournal(key, raw);
      if (!decoded) {
        invalid.push({ key, raw });
      } else {
        entries.push({ key, journal: decoded });
      }
    }
    entries.sort((a, b) => (a.journal.order || 0) - (b.journal.order || 0));
    return { entries, invalid };
  }

  function clearPendingJournal(record) {
    if (!record?.key) return false;
    try {
      localStorage.removeItem(record.key);
      return true;
    } catch {
      return false;
    }
  }

  function clearPendingJournalById(id) {
    if (!id) return false;
    const key = `${PENDING_PREFIX}${id}`;
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  function clearAllPendingJournal() {
    const keys = pendingJournalKeys();
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch {}
    }
  }

  function writePendingJournal(base, liveBase, proposal, options = {}) {
    const id = options.id || pendingJournalUuid();
    const order = pendingJournalOrder();
    const effectOutcome = normalizeDraftEffectOutcome(options.effect);
    const key = `${PENDING_PREFIX}${id}`;
    const payload = {
      version: 2,
      id,
      order,
      base: cloneSnapshot(base),
      liveBase: cloneSnapshot(liveBase),
      proposal: cloneSnapshot(proposal),
      replace: !!options.replace,
      expectedStorageRevision: options.expectedStorageRevision ?? null,
      expectedProgramId: options.expectedProgramId ?? null,
      expectedProgramFingerprint: options.expectedProgramFingerprint ?? null,
      expectedBlockId: options.expectedBlockId ?? null,
      expectedFirstRunEmpty: !!options.expectedFirstRunEmpty,
      rollback: options.rollback ? cloneSnapshot(options.rollback) : null,
      rollbackRevision: options.rollbackRevision ?? null,
      effectOutcome,
      reconcileSessionIds: options.reconcileSessionIds || null,
      dayRenames: options.dayRenames || null,
    };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      return { ok: true, key, journal: payload };
    } catch (err) {
      return { ok: false, error: err };
    }
  }

  function armPendingJournalRollback(record, snapshot, options = {}) {
    if (!record?.key || !record?.journal) return false;
    const journal = record.journal;
    journal.rollback = cloneSnapshot(snapshot);
    journal.rollbackRevision = options.rollbackRevision ?? readRevision(snapshot);
    try {
      localStorage.setItem(record.key, JSON.stringify(journal));
      return true;
    } catch {
      return false;
    }
  }

  function pendingJournalSuccessorMatches(record, head) {
    if (!record?.journal || !head) return false;
    const journal = record.journal;
    const headRev = readRevision(head);
    if (journal.expectedStorageRevision !== null && headRev === journal.expectedStorageRevision + 1) {
      return true;
    }
    return false;
  }

  function setupActivationMatches(marker, raw, programId) {
    if (!marker || !raw || !programId) return false;
    return marker.raw === raw && marker.programId === programId;
  }

  function setupActivationAlreadyCommitted(head, proposal, expectedSetupDraftRaw) {
    const headMarker = head?.[STORAGE_SETUP_TXN];
    const proposalMarker = proposal?.[STORAGE_SETUP_TXN];
    if (!headMarker || !proposalMarker || !expectedSetupDraftRaw) return false;
    return setupActivationMatches(headMarker, expectedSetupDraftRaw, proposalMarker.programId);
  }

  function preparePendingDraftTransaction(snapshot, previous, effect, id) {
    const out = cloneSnapshot(snapshot);
    if (!out || typeof out !== "object") return out;
    if (effect && draftEffectRequiresCoordination(effect)) {
      out[STORAGE_DRAFT_TXN] = {
        version: 1,
        id,
        effect: cloneSnapshot(effect),
        previous: cloneSnapshot(previous),
      };
    }
    return out;
  }

  function finalizedDraftTransactionSnapshot(snapshot) {
    const out = cloneSnapshot(snapshot);
    if (out && typeof out === "object") delete out[STORAGE_DRAFT_TXN];
    return out;
  }

  function rejectedDraftTransactionSnapshot(snapshot) {
    return unversionedSnapshot(snapshot);
  }

  // --- Snapshot Derivation ---
  function stateSnapshotForHead(base, liveBase, proposal, head, options = {}) {
    const nextRev = (readRevision(head) || 0) + 1;
    let target;
    if (options.replace) {
      target = cloneSnapshot(proposal);
    } else {
      // Semantic rebase
      target = cloneSnapshot(proposal);
    }
    if (target && typeof target === "object") {
      target[STORAGE_REV] = nextRev;
    }
    return target;
  }

  // --- Transaction Execution Engine ---
  async function compensatePendingDraftTransaction(snapshot, io, transactionId, effect) {
    const rolledBack = cloneSnapshot(snapshot);
    if (rolledBack && typeof rolledBack === "object") {
      rolledBack[STORAGE_REV] = (readRevision(snapshot) || 0) + 1;
      delete rolledBack[STORAGE_DRAFT_TXN];
    }
    const write = await writeSnapshot(rolledBack, io);
    return { snapshot: rolledBack, result: write };
  }

  async function executeDraftTransaction({
    record = null,
    transactionId = null,
    effect = null,
    prepared = null,
    snapshot = null,
    io = storageIO,
    writePrepared = true,
    preparedResult = null,
    discard = false,
    retainRecordOnWriteFailure = false,
  }) {
    const draftStore = getDraftStore();
    const id = transactionId || record?.journal?.id || pendingJournalUuid();
    const normalizedEffect = normalizeDraftEffectOutcome(effect || record?.journal?.effectOutcome);
    const requiresCoordination = draftEffectRequiresCoordination(normalizedEffect);

    if (discard) {
      const settled = settlePendingDraftRecord(record, { effect: normalizedEffect });
      return { kind: "discarded", settled: settled.settled, snapshot: null };
    }

    if (requiresCoordination && draftStore) {
      const effectState = pendingJournalEffectState(normalizedEffect);
      if (effectState.status === "conflict") {
        settlePendingDraftRecord(record, { effect: normalizedEffect });
        return { kind: "precondition-rejected", settled: true, rejected: true, snapshot: null };
      }
      const begin = draftStore.beginClose(id);
      if (!begin.closed) {
        settlePendingDraftRecord(record, { effect: normalizedEffect });
        return { kind: "close-failed", settled: true, rejected: true, snapshot: null };
      }
    }

    let pResult = preparedResult;
    if (writePrepared && prepared) {
      pResult = await writeSnapshot(prepared, io);
      if (!pResult.localOk && !pResult.idbOk) {
        if (!retainRecordOnWriteFailure) settlePendingDraftRecord(record, { effect: normalizedEffect });
        return { kind: "write-failed", settled: false, rejected: true, result: pResult, snapshot: null };
      }
    }

    let appliedEffect = null;
    if (normalizedEffect.status === DRAFT_EFFECT_VALID) {
      appliedEffect = applyPendingJournalEffect(normalizedEffect);
    }

    let fSnapshot = snapshot ? finalizedDraftTransactionSnapshot(snapshot) : prepared ? finalizedDraftTransactionSnapshot(prepared) : null;
    let fResult = null;
    if (fSnapshot && (!pResult || (fSnapshot[STORAGE_DRAFT_TXN] === undefined && prepared?.[STORAGE_DRAFT_TXN]))) {
      fResult = await writeSnapshot(fSnapshot, io);
    } else {
      fResult = pResult;
    }

    const settled = settlePendingDraftRecord(record, { effect: normalizedEffect });
    const finalResult = fResult || pResult;

    if (!settled.settled) {
      return {
        kind: "close-deferred",
        settled: false,
        deferred: true,
        finalizationPending: true,
        result: finalResult,
        snapshot: fSnapshot,
      };
    }

    return {
      kind: "committed",
      settled: true,
      accepted: true,
      result: finalResult,
      snapshot: fSnapshot,
    };
  }

  // --- Enqueue State Change ---
  async function enqueueStateChange(base, proposal, io = storageIO, options = {}) {
    return enqueueWrite(async () => {
      if (io === storageIO && isMutationFrozen()) {
        return normalizeDurableOutcome({
          localOk: false,
          idbOk: false,
          conflict: true,
          transferFrozen: true,
          code: "install-transfer-frozen",
        });
      }

      const frozenBase = cloneSnapshot(base);
      const frozenProposal = cloneSnapshot(proposal);
      const frozenLiveBase = cloneSnapshot(options.liveBase || base);
      const effect = options.effect || null;

      // WAL: write pending journal before entering lock
      const journalRes = writePendingJournal(frozenBase, frozenLiveBase, frozenProposal, {
        effect,
        replace: options.replace,
        expectedStorageRevision: options.expectedStorageRevision,
        expectedProgramId: options.expectedProgramId,
        expectedProgramFingerprint: options.expectedProgramFingerprint,
        expectedBlockId: options.expectedBlockId,
        expectedFirstRunEmpty: options.expectedFirstRunEmpty,
      });

      if (!journalRes.ok) {
        const failOutcome = normalizeDurableOutcome({
          revision: readRevision(persistHead || frozenBase),
          localOk: false,
          idbOk: false,
          journalFailed: true,
          code: "journal_failed",
        });
        noteWriteHealth(failOutcome);
        return failOutcome;
      }

      const record = { key: journalRes.key, journal: journalRes.journal };

      return withStorageLock(io, async () => {
        if (io === storageIO && isMutationFrozen()) {
          clearPendingJournal(record);
          return normalizeDurableOutcome({
            localOk: false,
            idbOk: false,
            conflict: true,
            transferFrozen: true,
            code: "install-transfer-frozen",
          });
        }

        const refreshed = await refreshPersistenceHead();
        let head = cloneSnapshot(refreshed.head || persistHead || frozenBase);

        // Preflight rebase callback under lock
        let workingProposal = frozenProposal;
        if (typeof options.preflight === "function") {
          const preflightRes = await options.preflight(head, workingProposal);
          if (preflightRes?.conflict || preflightRes?.ok === false) {
            clearPendingJournal(record);
            return normalizeDurableOutcome({
              revision: readRevision(head),
              localOk: false,
              idbOk: false,
              conflict: true,
              ...preflightRes,
            });
          }
          if (preflightRes?.proposal) workingProposal = preflightRes.proposal;
        }

        // Check expected preconditions
        const headRev = readRevision(head);
        if (options.expectedStorageRevision !== undefined && options.expectedStorageRevision !== null) {
          if (headRev !== options.expectedStorageRevision) {
            clearPendingJournal(record);
            return normalizeDurableOutcome({
              revision: headRev,
              localOk: false,
              idbOk: false,
              conflict: true,
              staleRevision: true,
              code: "stale_proposal",
            });
          }
        }

        // Arm rollback snapshot in WAL
        armPendingJournalRollback(record, head, { rollbackRevision: headRev });

        // Derive next snapshot
        const snapshot = stateSnapshotForHead(frozenBase, frozenLiveBase, workingProposal, head, options);
        const prepared = preparePendingDraftTransaction(snapshot, head, effect, record.journal.id);

        // Execute transaction
        const execution = await executeDraftTransaction({
          record,
          transactionId: record.journal.id,
          effect,
          prepared,
          snapshot,
          io,
          writePrepared: true,
        });

        if (execution.kind === "committed") {
          persistHead = cloneSnapshot(execution.snapshot);
          if (typeof options.onCommit === "function") {
            options.onCommit(execution.snapshot, frozenLiveBase);
          }
          return normalizeDurableOutcome({
            ...execution.result,
            revision: readRevision(execution.snapshot),
            committed: true,
            accepted: true,
            snapshot: execution.snapshot,
          });
        }

        if (execution.kind === "close-deferred") {
          persistHead = cloneSnapshot(execution.snapshot);
          if (typeof options.onCommit === "function") {
            options.onCommit(execution.snapshot, frozenLiveBase);
          }
          return normalizeDurableOutcome({
            ...execution.result,
            revision: readRevision(execution.snapshot),
            accepted: true,
            deferred: true,
            finalizationPending: true,
            snapshot: execution.snapshot,
          });
        }

        // Rejection / Conflict / Failure
        clearPendingJournal(record);
        return normalizeDurableOutcome({
          revision: headRev,
          localOk: false,
          idbOk: false,
          conflict: execution.rejected,
          draftConflict: execution.kind === "close-failed" || execution.kind === "precondition-rejected",
          code: execution.kind,
        });
      });
    });
  }

  async function commitProposedState(proposal, io = storageIO, options = {}) {
    return enqueueStateChange(persistHead || proposal, proposal, io, options);
  }

  async function commitProgramReplacement(proposal, io = storageIO, options = {}) {
    return commitProposedState(proposal, io, Object.assign({}, options, { replace: true }));
  }

  // --- Boot Replay & Resolution ---
  async function resolveBootReplicas(candidate = null) {
    return withStorageLock(storageIO, async () => {
      const local = readLocalStatus(), idb = await readIdbStatus();
      let decision = chooseSnapshot(local, idb);

      if (decision.kind === "unresolved") {
        if (!recoveryChoiceMatches(candidate, decision)) return decision;
        decision = {
          kind: "chosen",
          snapshot: cloneSnapshot(candidate.snapshot),
          source: candidate.source,
          heal: candidate.source === "local" ? "idb" : "local",
        };
      }

      const pt = getProgramTransition();
      if (decision.kind === "chosen" && pt?.normalizeRecoveryCarrierSnapshot) {
        const sourceReplica = sourceReplicaForCarrierDecision(decision, local, idb);
        let normalized;
        try {
          normalized = await pt.normalizeRecoveryCarrierSnapshot(decision.snapshot, sourceReplica);
        } catch {
          normalized = { kind: "full-recovery" };
        }
        if (normalized.kind === "full-recovery") {
          return {
            kind: "unresolved",
            reason: "no-valid",
            local: { ...local, status: "invalid" },
            idb: { ...idb, status: "invalid" },
          };
        }
        if (normalized.kind === "known") {
          decision.snapshot = normalized.snapshot;
          decision.recoveryChanged = !!normalized.changed;
        }
      }

      let head = decision.kind === "first-run" ? null : cloneSnapshot(decision.snapshot);
      let replayed = false, draftConflict = false;

      // Replay stored pending transaction on head if present
      const storedTransaction = head && pendingDraftTransaction(head);
      if (storedTransaction) {
        const storedRecord = readPendingJournal().entries.find((r) => r.journal.id === storedTransaction.id) || null;
        const finalized = finalizedDraftTransactionSnapshot(head);
        const execution = await executeDraftTransaction({
          record: storedRecord,
          transactionId: storedTransaction.id,
          effect: storedTransaction.effect,
          prepared: head,
          snapshot: finalized,
          io: storageIO,
          writePrepared: false,
          preparedResult: { revision: readRevision(head), localOk: true, idbOk: true },
        });
        if (!execution.settled || (execution.kind !== "committed" && execution.kind !== "rejected" && execution.kind !== "compensated")) {
          return { kind: "unresolved", reason: "pending-transaction", local: readLocalStatus(), idb: await readIdbStatus() };
        }
        head = execution.snapshot;
        draftConflict = execution.kind !== "committed";
        replayed = true;
        decision = { kind: "chosen", snapshot: head, source: "pending" };
      }

      // Replay pending journal entries
      const pending = readPendingJournal();
      for (const invalid of pending.invalid) clearPendingJournal(invalid);
      for (const record of pending.entries) {
        const journal = record.journal;
        if (journal.effectOutcome?.status === DRAFT_EFFECT_INVALID) {
          const discarded = await executeDraftTransaction({
            record,
            transactionId: journal.id,
            effect: journal.effectOutcome,
            discard: true,
          });
          if (!discarded.settled) {
            return { kind: "unresolved", reason: "pending-transaction", local: readLocalStatus(), idb: await readIdbStatus() };
          }
          draftConflict = true;
          continue;
        }

        const setupMarker = journal.proposal?.[STORAGE_SETUP_TXN];
        if (setupActivationAlreadyCommitted(head, journal.proposal, setupMarker?.raw)) {
          const discarded = await executeDraftTransaction({
            record,
            transactionId: journal.id,
            effect: journal.effectOutcome,
            discard: true,
          });
          if (!discarded.settled) {
            return { kind: "unresolved", reason: "pending-transaction", local: readLocalStatus(), idb: await readIdbStatus() };
          }
          continue;
        }

        if (pendingJournalSuccessorMatches(record, head)) {
          const prepared = preparePendingDraftTransaction(head, journal.rollback, journal.effectOutcome, journal.id);
          const execution = await executeDraftTransaction({
            record,
            transactionId: journal.id,
            effect: journal.effectOutcome,
            prepared,
            snapshot: head,
            io: storageIO,
            writePrepared: false,
            preparedResult: { revision: readRevision(head), localOk: true, idbOk: true },
          });
          if (!execution.settled || (execution.kind !== "committed" && execution.kind !== "rejected" && execution.kind !== "compensated")) {
            return { kind: "unresolved", reason: "pending-transaction", local: readLocalStatus(), idb: await readIdbStatus() };
          }
          head = execution.snapshot;
          if (execution.kind !== "committed") draftConflict = true;
          replayed = true;
          continue;
        }

        // Incomplete / unmatchable journal: discard
        const discarded = await executeDraftTransaction({
          record,
          transactionId: journal.id,
          effect: journal.effectOutcome,
          discard: true,
        });
        if (!discarded.settled) {
          return { kind: "unresolved", reason: "pending-transaction", local: readLocalStatus(), idb: await readIdbStatus() };
        }
      }

      if (replayed) {
        persistHead = cloneSnapshot(head);
        return { kind: "chosen", snapshot: head, source: "pending", draftConflict, recoveryChanged: !!decision.recoveryChanged };
      }

      if (decision.kind === "chosen") {
        persistHead = cloneSnapshot(decision.snapshot);
        if (decision.heal && !decision.recoveryChanged) {
          await writeSnapshot(cloneSnapshot(decision.snapshot), storageIO);
        }
      }

      return Object.assign({}, decision, { draftConflict });
    });
  }

  function recoveryChoiceMatches(candidate, decision) {
    if (!candidate || candidate.kind !== "chosen" || (candidate.source !== "local" && candidate.source !== "idb")) return false;
    const selected = candidate.source === "local" ? decision?.local : decision?.idb;
    return selected?.status === "valid" && storageSnapshotsEqual(selected.parsed, candidate.snapshot);
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
    setPersistHead,
    getPersistHead,
    resetPersistenceBase,
    refreshPersistenceHead,

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
    preparePendingDraftTransaction,
    finalizedDraftTransactionSnapshot,
    rejectedDraftTransactionSnapshot,
    executeDraftTransaction,
    enqueueStateChange,
    commitProposedState,
    commitProgramReplacement,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeDurableState = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
