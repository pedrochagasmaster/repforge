/**
 * Plan 052-P6c corrections 1+2: coherent transition journal before boot replay.
 *
 * Correction 1 root defect (reproduced on clean da81494a):
 * commitProgramReplacement() archives the predecessor (with its transition-out
 * link) before writePendingJournal() runs, while the successor program and its
 * transition-in record join the proposal only inside the lock-held preflight.
 * A writer that dies while queued on repforge:state-write leaves a journal
 * whose proposal carries the outgoing archive but no successor and no
 * transition-in. Boot replay of that incomplete journal advanced both
 * replicas to R+1 with the predecessor active under its own outgoing archive
 * — a mixed state every later confirmation can only reject as
 * conflicting_transition_record.
 *
 * Correction 2 (this suite, reproduced on clean c5b0f0f4): classification and
 * the coherence gate were ID-shaped, not value-shaped. A generic journal based
 * on an already-transitioned state could mutate inherited transitionIn or
 * transitionOut values while retaining their IDs and boot would replay it,
 * advancing the revision and persisting poisoned provenance that makes the
 * exact retry conflict forever. A replacement journal carrying an unknown
 * schemaVersion (or a record field normalization would drop, such as a
 * missing/empty confirmedAt) passed the gate, was replayed, and was then
 * silently stripped by normalization, leaving a mixed/bare archive state.
 *
 * Resolved invariants pinned here:
 * - Inherited transition metadata is compared by bounded semantic/value
 *   equality against the journal base: any addition, removal, duplication, or
 *   changed field is a transition attempt even when every ID is unchanged.
 * - A replacement journal replays only when the complete stored transition
 *   pair matches the supported v1 record shape — schemaVersion exactly 1 on
 *   both records, committed status, nonempty confirmedAt and every required
 *   identity/hash/program/archive field — and the active meta is the exact
 *   successor, exactly one predecessor archive is the exact archive, and
 *   every link agrees.
 * - Every invalid journal is discarded at boot: base revision, settings,
 *   program, meta, and history stay semantically unchanged in both replicas,
 *   no successor or extra archive becomes durable, journal/sidecar/closing
 *   artifacts clear, and the exact retry remains possible.
 * - Control: an ordinary settings/log journal whose inherited transition
 *   records are value-identical still replays and advances exactly once.
 * - The correction-1 invariant stands: an incomplete outgoing transition
 *   journal is discarded with predecessor, revision, log, and DraftV2
 *   untouched and zero new archives. Generic non-transition journal replay
 *   outside this boundary is unchanged.
 *
 * The oracle reads localStorage, IndexedDB and the live clone separately.
 * DraftV2 raw/checkpoint bytes are exact; durable state is compared
 * semantically. No sleeps, no List DOM, no raw whole-state equality.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { isDeepStrictEqual } from "node:util";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8658/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const RECOVERY_KEY = "repforge_draft_v1:recovery";
const DB_NAME = "repforge";
const STORAGE_LOCK = "repforge:state-write";
const PENDING_PREFIX = "repforge_pending_v1:";
const DRAFT_CLOSE_PREFIX = "repforge_draft_v1:closing:";
const DRAFT_PENDING_PREFIX = "repforge_draft_v1:pending:";

const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
}

async function readIdbState(page) {
  return page.evaluate(async ({ dbName, storeName, key }) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          return resolve(null);
        }
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result ?? null);
        };
        getReq.onerror = () => {
          db.close();
          reject(getReq.error);
        };
      };
    });
  }, { dbName: DB_NAME, storeName: "kv", key: KEY });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const idb = await readIdbState(page);
  const local = JSON.parse(localRaw || "null");
  const semantic = (s) => s && ({
    programId: s.programMeta?.id ?? null,
    revision: s._storageRevision ?? null,
    transitionIn: s.programMeta?.transitionIn ?? null,
    programHistory: s.programHistory ?? [],
    storageDraftTransaction: s._storageDraftTransaction ?? null,
    settings: s.settings ?? null,
    log: s.log ?? [],
  });
  return { local: semantic(local), idb: semantic(idb) };
}

async function readDraftBytes(page) {
  return page.evaluate((keys) => ({
    raw: localStorage.getItem(keys.d),
    checkpoint: localStorage.getItem(keys.c),
    recovery: localStorage.getItem(keys.r),
  }), { d: DRAFT_KEY, c: CHECKPOINT_KEY, r: RECOVERY_KEY });
}

async function artifactKeys(page) {
  return page.evaluate(() => {
    const keys = Object.keys(localStorage);
    return {
      pending: keys.filter((k) => k.startsWith("repforge_pending_v1")),
      closing: keys.filter((k) => k.startsWith("repforge_draft_v1:closing")),
      sidecar: keys.filter((k) => k.startsWith("repforge_draft_v1:pending")),
    };
  });
}

async function readJournal(page) {
  return page.evaluate((prefix) => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix)) {
        return { key: k, raw: localStorage.getItem(k) };
      }
    }
    return null;
  }, PENDING_PREFIX);
}

async function clearStorage(page) {
  await page.evaluate(async ({ key, draftKey, checkpointKey, dbName }) => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("repforge_pending_v1") || k.startsWith("repforge_draft_v1:closing") ||
          k.startsWith("repforge_draft_v1:pending")) {
        localStorage.removeItem(k);
      }
    }
    localStorage.removeItem(key);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
    localStorage.removeItem("repforge_draft_v1:recovery");
    localStorage.removeItem("repforge_program_setup_draft_v1");
    localStorage.removeItem("repforge_ui_v1");
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, dbName: DB_NAME });
}

async function confirmTransition(page, args) {
  return page.evaluate((a) => window.__repforgeProgramTransition.confirmTransition(a), args);
}

async function activateBalancedRecommendPredecessor(page) {
  return page.evaluate(async () => {
    if (!window.RepForgeProgramEntryAdapter || !window.RepForgeProgramCompiler) {
      return { ok: false, error: "compiler or entry adapter unavailable in window" };
    }
    const services = window.RepForgeProgramEntryAdapter.createProductionServices({
      Compiler: window.RepForgeProgramCompiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const compiled = services.compile({
      mode: "recommend",
      answers: {
        desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most",
        daysPerWeek: 4, sessionMinutes: 90, preferredRestSeconds: 90,
        environment: { kind: "commercial_gym" },
        primaryMuscles: [], deEmphasizedMuscles: [], ignoredMuscles: [],
        priorityMovements: [], mustHaveExercises: [], exerciseConstraints: [],
      },
      versions: services.currentVersions(),
    });
    if (!compiled.ok) return { ok: false, error: "compilation failed", issues: compiled.issues };
    const baseProposal = window.__repforgeWorkoutDraft.state();
    baseProposal.programMeta = baseProposal.programMeta || {};
    baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
    baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));
    await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program, name: compiled.name || "Balanced 4-Day",
      answers: { goal: "strength_hypertrophy", daysPerWeek: 4 },
      destination: "log", origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure, compilerContext: compiled.compilerContext,
      baseProposal,
    });
    await window.__repforgeStorage.flush();
    return { ok: true };
  });
}

async function proposeLowerFrequencySibling(page, overrides = {}) {
  return page.evaluate(async (args) => window.__repforgeProgramTransition.proposeSibling(args), {
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days", answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"], insufficientEvidenceReasons: [],
    },
    ...overrides,
  });
}

async function setupPredecessorWithSentinelAndDraft(page, tag) {
  const act = await activateBalancedRecommendPredecessor(page);
  if (!act.ok) throw new Error(`Activation failed: ${JSON.stringify(act)}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const logSeed = await page.evaluate(async (t) => {
    const s = window.__repforgeWorkoutDraft.state();
    const row0 = (s.program || [])[0];
    if (!row0) return { ok: false, error: "no compiled program rows" };
    const sessionId = `p6c-sentinel-${t}`;
    const entry = {
      session: sessionId,
      date: "2026-10-01",
      day: row0.day,
      exerciseId: row0.id,
      performedName: row0.name,
      performedLibraryId: typeof row0.libraryId === "string" ? row0.libraryId : null,
      performedMovementId: typeof row0.movementId === "string" ? row0.movementId : null,
      set: 1,
      load: 60,
      reps: 8,
      rir: 2,
      created: "2026-10-01T09:00:00.000Z",
    };
    s.log = [...(s.log || []), entry];
    const res = await window.__repforgeCommitProposedState(s);
    await window.__repforgeStorage.flush();
    return { ok: res.localOk && res.idbOk, res, sessionId };
  }, tag);
  if (!logSeed.ok) throw new Error(`Log seed failed: ${JSON.stringify(logSeed)}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const draftSetup = await page.evaluate(async () => {
    const dayLabel = (window.__repforgeWorkoutDraft.state()?.program || [])[0]?.day || "Day 1";
    await window.__repforgeEnterWorkout({ day: dayLabel, focus: false });
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const exIds = Object.keys(draft.exercises || {});
    const ex0Id = exIds[0];
    const setIds = Object.keys(draft.exercises[ex0Id].sets || {});
    const set0Id = setIds[0];
    await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "reps", value: "11" });
    await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "load", value: "72.5" });
    await hook.dispatch("setSessionNotes", { value: `Draft notes ${"p6c"}` });
    await hook.flush();
    return {
      ok: true,
      raw: localStorage.getItem("repforge_draft_v1"),
      checkpointRaw: localStorage.getItem("repforge_draft_v1:v2-checkpoint"),
    };
  });
  if (!draftSetup.ok) throw new Error(`Draft setup failed: ${JSON.stringify(draftSetup)}`);

  const s = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
  return {
    predecessorProgramId: s.programMeta?.id,
    predecessorRevision: s._storageRevision,
    logSentinel: s.log || [],
    preDraftRaw: draftSetup.raw,
    preCheckpointRaw: draftSetup.checkpointRaw,
  };
}

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    window.__p6cReleaseStorageLock = release;
    window.__p6cStorageLockHeld = false;
    window.__p6cStorageLockDone = navigator.locks.request(lockName, async () => {
      window.__p6cStorageLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__p6cStorageLockHeld === true, { timeout: 10000 });
}

async function waitForPendingStorageLocks(page, count) {
  await page.waitForFunction(
    async ({ lockName, count }) => {
      const locks = await navigator.locks.query();
      return locks.pending.filter((lock) => lock.name === lockName).length >= count;
    },
    { lockName: STORAGE_LOCK, count },
    { timeout: 10000 }
  );
}

async function waitForNoPendingStorageLocks(page) {
  await page.waitForFunction(
    async (lockName) => {
      const locks = await navigator.locks.query();
      return locks.pending.filter((lock) => lock.name === lockName).length === 0;
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__p6cReleaseStorageLock();
    await window.__p6cStorageLockDone;
  });
}

async function newBootedContext(browser) {
  const context = await browser.newContext();
  const locker = await context.newPage();
  const writer = await context.newPage();
  const survivor = await context.newPage();
  for (const p of [locker, writer, survivor]) p.on("dialog", (d) => d.dismiss().catch(() => {}));
  await survivor.goto(BASE);
  await waitForAppBoot(survivor, { base: BASE });
  await clearStorage(survivor);
  await survivor.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(survivor, { base: BASE });
  return { context, locker, writer, survivor };
}

async function bootOthers(pages) {
  for (const p of pages) {
    await p.goto(BASE);
    await waitForAppBoot(p, { base: BASE });
  }
}

// Reproduce the exact pre-lock crash: hold the real state-write lock, start a
// real confirm in a second page, observe the production-created journal, then
// destroy the queued writer before it ever obtains the lock. Returns the
// captured journal and the survivor page state before reload.
async function crashWhileQueued({ locker, writer, survivor }, confirmArgs, setup) {
  await holdStorageLock(locker);
  await writer.evaluate((a) => {
    window.__p6cConfirmResult = window.__repforgeProgramTransition.confirmTransition(a);
  }, confirmArgs);
  await waitForPendingStorageLocks(locker, 1);
  await survivor.waitForFunction((prefix) =>
    Object.keys(localStorage).some((k) => k.startsWith(prefix)), PENDING_PREFIX, { timeout: 10000 });
  const journal = await readJournal(survivor);
  if (!journal) throw new Error("production journal was not armed while queued");
  const parsed = JSON.parse(journal.raw);
  if (parsed?.id == null) throw new Error("armed journal has no id");
  await writer.close();
  await releaseStorageLock(locker);
  await locker.waitForFunction(async (lockName) => {
    const locks = await navigator.locks.query();
    return !locks.pending.some((l) => l.name === lockName);
  }, STORAGE_LOCK, { timeout: 10000 });
  return journal;
}

// Same reproduction for the generic proposed-state write path: the journal is
// armed synchronously before the state-write lock, so a writer killed while
// queued leaves a journal whose proposal is an arbitrary state mutation
// against the transitioned base. This is the correction-2 poison vehicle.
// Each call boots a fresh writer page and destroys it queued, so the helper
// can be reused for several journals against the same committed state.
async function crashGenericWhileQueued({ locker, survivor, context }, spec) {
  const writer = await context.newPage();
  writer.on("dialog", (d) => d.dismiss().catch(() => {}));
  await writer.goto(BASE);
  await waitForAppBoot(writer, { base: BASE });
  await holdStorageLock(locker);
  await writer.evaluate((poisonSpec) => {
    window.__p6cGenericResult = window.__repforgeCommitProposedState((() => {
      const clone = JSON.parse(JSON.stringify(window.__repforgeWorkoutDraft.state()));
      if (poisonSpec.kind === "tin-proposalHash") {
        clone.programMeta.transitionIn = {
          ...clone.programMeta.transitionIn,
          proposalHash: "a".repeat(64),
        };
      } else if (poisonSpec.kind === "tin-confirmedAt-ids-retained") {
        clone.programMeta.transitionIn = {
          ...clone.programMeta.transitionIn,
          confirmedAt: "2026-10-04T00:00:00.000Z",
        };
      } else if (poisonSpec.kind === "tout-proposalHash") {
        const row = clone.programHistory.find((h) => h?.transitionOut);
        row.transitionOut = { ...row.transitionOut, proposalHash: "b".repeat(64) };
      } else if (poisonSpec.kind === "tout-successorLink") {
        const row = clone.programHistory.find((h) => h?.transitionOut);
        row.transitionOut = { ...row.transitionOut, successorProgramId: "prog_p6c_poisoned_succ" };
      } else if (poisonSpec.kind === "tout-duplicate") {
        const row = clone.programHistory.find((h) => h?.transitionOut);
        clone.programHistory.push(JSON.parse(JSON.stringify(row)));
      } else if (poisonSpec.kind === "tout-removed") {
        const row = clone.programHistory.find((h) => h?.transitionOut);
        if (row) delete row.transitionOut;
      } else if (poisonSpec.kind === "control-settings") {
        clone.settings = { ...clone.settings, restSec: 135 };
      } else if (poisonSpec.kind === "control-reordered-archives") {
        clone.settings = { ...clone.settings, restSec: 140 };
        clone.programHistory = [...(clone.programHistory || [])].reverse();
      } else {
        throw new Error(`unknown poison spec: ${poisonSpec.kind}`);
      }
      return clone;
    })());
  }, spec);
  await waitForPendingStorageLocks(locker, 1);
  await survivor.waitForFunction((prefix) =>
    Object.keys(localStorage).some((k) => k.startsWith(prefix)), PENDING_PREFIX, { timeout: 10000 });
  const journal = await readJournal(survivor);
  if (!journal) throw new Error("generic journal was not armed while queued");
  const parsed = JSON.parse(journal.raw);
  if (parsed?.id == null) throw new Error("armed generic journal has no id");
  await writer.close();
  await releaseStorageLock(locker);
  await locker.waitForFunction(async (lockName) => {
    const locks = await navigator.locks.query();
    return !locks.pending.some((l) => l.name === lockName);
  }, STORAGE_LOCK, { timeout: 10000 });
  return journal;
}

// Production write-fault injection: the shipped transaction must fail on the
// requested write ordinal of the durable key in both mirrors, so the prepared
// state is left durable by the real code path, never a synthetic copy.
async function injectWriteFailureAfterFirst(page) {
  await page.evaluate((key) => {
    const originalSetItem = Storage.prototype.setItem;
    const originalPut = IDBObjectStore.prototype.put;
    let localWrites = 0;
    let idbWrites = 0;
    Storage.prototype.setItem = function (candidate) {
      if (candidate === key && ++localWrites > 1) {
        throw new Error("audit: defer final durable state");
      }
      return originalSetItem.apply(this, arguments);
    };
    IDBObjectStore.prototype.put = function (_value, candidate) {
      if (candidate === key && ++idbWrites > 1) {
        throw new Error("audit: defer final durable state");
      }
      return originalPut.apply(this, arguments);
    };
    window.__p6cRestoreWriteSeam = () => {
      Storage.prototype.setItem = originalSetItem;
      IDBObjectStore.prototype.put = originalPut;
    };
  }, KEY);
}

async function injectIdbState(page, value) {
  await page.evaluate(async ({ dbName, storeName, key, value }) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
      req.onerror = () => reject(req.error);
    });
  }, { dbName: DB_NAME, storeName: "kv", key: KEY, value });
}

async function injectCleanupFailure(page) {
  await page.evaluate(() => {
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (typeof key === "string" &&
          (key.startsWith("repforge_pending_v1") || key.startsWith("repforge_draft_v1:closing") ||
           key.startsWith("repforge_draft_v1:pending"))) {
        throw new Error("audit: cleanup interrupted");
      }
      return originalRemoveItem.apply(this, arguments);
    };
    window.__p6cRestoreCleanupSeam = () => {
      Storage.prototype.removeItem = originalRemoveItem;
    };
  });
}

function commitArgsFor(proposal, confirmedAt, draftRaw) {
  return {
    proposal,
    transitionId: proposal.transitionId,
    successorProgramId: proposal.successor.programId,
    confirmedAt,
    proposalHash: proposal.proposalHash,
    acknowledgedDraftRaw: draftRaw,
  };
}

function assertTransitionLinks(replicas, proposal, label) {
  const predId = proposal.predecessor.programId;
  const succId = proposal.successor.programId;
  for (const side of ["local", "idb"]) {
    const tin = replicas[side].transitionIn;
    const history = replicas[side].programHistory;
    check(isDeepStrictEqual(tin, replicas[side === "local" ? "idb" : "local"].transitionIn),
      `${label}: transitionIn deep-equal across localStorage and IndexedDB`);
    check(isDeepStrictEqual(history, replicas[side === "local" ? "idb" : "local"].programHistory),
      `${label}: programHistory deep-equal across localStorage and IndexedDB`);
    check(history.length === 1, `${label}: exactly one archive entry in ${side}`, history.length);
    const archive = history[0];
    check(archive?.id === predId && archive?.archiveId === predId,
      `${label}: archive identity is the predecessor id in ${side}`, archive);
    check(archive?.transitionOut?.schemaVersion === 1 &&
      archive?.transitionOut?.transitionId === proposal.transitionId &&
      archive?.transitionOut?.proposalHash === proposal.proposalHash &&
      archive?.transitionOut?.successorProgramId === succId,
      `${label}: archive transitionOut links exact in ${side}`, archive?.transitionOut);
    check(tin?.status === "committed" &&
      tin?.transitionId === proposal.transitionId &&
      tin?.proposalHash === proposal.proposalHash &&
      tin?.archiveId === predId &&
      tin?.successor?.programId === succId &&
      tin?.predecessor?.programId === predId,
      `${label}: successor transitionIn record exact in ${side}`, tin);
  }
}

async function main() {
  console.log("052-P6c corrections 1+2: inherited transition value integrity and v1 fail-closed boundary");
  await assertServingApp(BASE);

  const browser = await launchChromium();
  try {
    // =========================================================================
    // Case 1: Journal armed, before prepared state — the real pre-lock crash.
    // A confirm writer dies while queued on repforge:state-write; the journal
    // its transaction armed carries the outgoing archive but no successor and
    // no transition-in. Boot must discard it with predecessor, revision, log,
    // and DraftV2 untouched and zero new archives — then a real confirm retry
    // must still commit one coherent successor/archive at R+1.
    // =========================================================================
    console.log("\n1. Pre-lock crash: incomplete outgoing journal is discarded, never replayed");
    {
      const env = await newBootedContext(browser);
      const { locker, writer, survivor, context } = env;
      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "crash1");
      const predId = setup.predecessorProgramId;
      const revisionR = setup.predecessorRevision;

      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_crash_replay",
        successorProgramId: "prog_p6c_crash_succ",
        createdAt: "2026-10-03T09:00:00.000Z",
      });
      check(propose?.ok === true, "sibling proposal for the pre-lock crash created", propose?.code);
      const proposal = propose.proposal;
      check(proposal.predecessor.programId === predId && proposal.predecessor.durableRevision === revisionR,
        "proposal pins the predecessor id and durable revision");

      await bootOthers([locker, writer]);

      const confirmArgs = {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T09:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };
      const journal = await crashWhileQueued(env, confirmArgs, setup);
      check(journal.key.startsWith(PENDING_PREFIX), "the production journal key is a repforge_pending_v1 entry", journal.key);
      const armed = JSON.parse(journal.raw);
      check(Array.isArray(armed.proposal?.programHistory) &&
            (armed.proposal.programHistory.filter((h) => h?.transitionOut)).length === 1,
        "the armed journal proposal is an outgoing transition replacement (one transitionOut archive)");
      const armedArchive = (armed.proposal.programHistory || []).filter((h) => h?.transitionOut);
      check(armedArchive.length === 1 &&
        armedArchive[0].transitionOut.transitionId === proposal.transitionId &&
        armedArchive[0].transitionOut.successorProgramId === proposal.successor.programId,
        "the armed journal proposal carries the outgoing transition archive before any lock-held write",
        armedArchive.map((h) => h.transitionOut));
      check(armed.proposal.programMeta?.transitionIn == null && armed.proposal.programMeta?.id === predId,
        "the armed journal proposal has no successor and no transitionIn yet");

      const beforeReload = await readReplicas(survivor);
      check(beforeReload.local.programId === predId && beforeReload.idb.programId === predId &&
            beforeReload.local.revision === revisionR && beforeReload.idb.revision === revisionR,
        "both replicas still hold the predecessor at revision R while the writer was queued");

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const after = await readReplicas(survivor);
      check(after.local.programId === predId && after.idb.programId === predId,
        "boot left the predecessor active in both replicas", after);
      check(after.local.revision === revisionR && after.idb.revision === revisionR,
        "boot advanced no durable revision in either replica",
        { expected: revisionR, local: after.local.revision, idb: after.idb.revision });
      check(after.local.transitionIn == null && after.idb.transitionIn == null,
        "no transitionIn appeared in either replica");
      check(after.local.programHistory.length === 0 && after.idb.programHistory.length === 0,
        "boot created zero archives in either replica",
        { local: after.local.programHistory.length, idb: after.idb.programHistory.length });
      check(isDeepStrictEqual(after.local.log, setup.logSentinel) && isDeepStrictEqual(after.idb.log, setup.logSentinel),
        "log sentinel unchanged in both replicas after boot");
      const draftAfter = await readDraftBytes(survivor);
      check(draftAfter.raw === setup.preDraftRaw && draftAfter.checkpoint === setup.preCheckpointRaw,
        "DraftV2 raw and checkpoint bytes unchanged after boot");
      const artifacts = await artifactKeys(survivor);
      check(artifacts.pending.length === 0 && artifacts.closing.length === 0 && artifacts.sidecar.length === 0,
        "boot cleared every pending, sidecar, and closing artifact", artifacts);

      // Retry after the discard: the transition is not permanently stuck.
      const retry = await confirmTransition(survivor, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T09:12:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(retry?.ok === true && retry?.committed === true && retry?.localOk === true && retry?.idbOk === true,
        "confirm retry after the discarded journal commits coherently", retry);
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterRetry = await readReplicas(survivor);
      check(afterRetry.local.programId === proposal.successor.programId &&
            afterRetry.idb.programId === proposal.successor.programId,
        "retry activated the successor in both replicas");
      check(afterRetry.local.revision === revisionR + 1 && afterRetry.idb.revision === revisionR + 1,
        "retry advanced the durable revision by exactly one to R+1",
        { expected: revisionR + 1, local: afterRetry.local.revision, idb: afterRetry.idb.revision });
      assertTransitionLinks(afterRetry, proposal, "retry after discard");
      check(isDeepStrictEqual(afterRetry.local.log, setup.logSentinel) &&
            isDeepStrictEqual(afterRetry.idb.log, setup.logSentinel),
        "log sentinel survives the retried transition in both replicas");
      const artifactsRetry = await artifactKeys(survivor);
      check(artifactsRetry.pending.length === 0 && artifactsRetry.closing.length === 0 && artifactsRetry.sidecar.length === 0,
        "retried transition left zero pending, sidecar, or closing artifacts", artifactsRetry);
      const draftRetry = await readDraftBytes(survivor);
      check(draftRetry.raw === setup.preDraftRaw && draftRetry.checkpoint === setup.preCheckpointRaw,
        "DraftV2 raw and checkpoint bytes survive the retried transition");
      await context.close();
    }

    // =========================================================================
    // Case 2: Prepared state before final state. A real confirm is interrupted
    // after the prepared state (successor + archive + _storageDraftTransaction)
    // is durable in both replicas but before its final state write. Boot must
    // finish the same successor through the shipped stored-transaction path.
    // =========================================================================
    console.log("\n2. Prepared state before final state finishes the same successor at boot");
    {
      const context = await browser.newContext();
      const survivor = await context.newPage();
      survivor.on("dialog", (d) => d.dismiss().catch(() => {}));
      await survivor.goto(BASE);
      await waitForAppBoot(survivor, { base: BASE });
      await clearStorage(survivor);
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "prepared");
      const revisionR = setup.predecessorRevision;
      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_prepared_replay",
        successorProgramId: "prog_p6c_prepared_succ",
        createdAt: "2026-10-03T10:00:00.000Z",
      });
      check(propose?.ok === true, "prepared-case sibling proposal created", propose?.code);
      const proposal = propose.proposal;
      const args = {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T10:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };

      await injectWriteFailureAfterFirst(survivor);
      const interrupted = await confirmTransition(survivor, args);
      await survivor.evaluate(() => window.__p6cRestoreWriteSeam());
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      check(interrupted?.deferred === true && interrupted?.finalizationPending === true,
        "interrupted confirm reports the truthful deferred finalization, not a settled commit", interrupted);

      // Prepared state captured through the real transaction.
      const prepared = await readReplicas(survivor);
      check(prepared.local.programId === proposal.successor.programId &&
            prepared.idb.programId === proposal.successor.programId,
        "prepared successor program is durable in both replicas");
      check(prepared.local.revision === revisionR + 1 && prepared.idb.revision === revisionR + 1,
        "prepared state advanced the revision to R+1 in both replicas");
      check(prepared.local.storageDraftTransaction?.version === 1 &&
            prepared.idb.storageDraftTransaction?.version === 1,
        "the _storageDraftTransaction marker is present in both parsed replicas",
        { local: prepared.local.storageDraftTransaction, idb: prepared.idb.storageDraftTransaction });
      assertTransitionLinks(prepared, proposal, "prepared state");
      const preparedJournal = await readJournal(survivor);
      check(preparedJournal != null, "the matching journal is retained with the prepared state");
      const preparedArtifacts = await artifactKeys(survivor);
      check(preparedArtifacts.closing.length > 0, "the closing marker of the interrupted transaction is retained",
        preparedArtifacts);
      const preparedDraft = await readDraftBytes(survivor);
      check(preparedDraft.raw === setup.preDraftRaw && preparedDraft.checkpoint === setup.preCheckpointRaw,
        "DraftV2 bytes unchanged by the interrupted finalization");

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const finalized = await readReplicas(survivor);
      check(finalized.local.programId === proposal.successor.programId &&
            finalized.idb.programId === proposal.successor.programId,
        "boot finished the same successor in both replicas");
      check(finalized.local.revision === revisionR + 1 && finalized.idb.revision === revisionR + 1,
        "recovered replay kept the revision at R+1 in both replicas");
      check(finalized.local.storageDraftTransaction == null && finalized.idb.storageDraftTransaction == null,
        "the parsed transaction marker is gone from both replicas");
      assertTransitionLinks(finalized, proposal, "recovered replay");
      check(isDeepStrictEqual(finalized.local.log, setup.logSentinel) &&
            isDeepStrictEqual(finalized.idb.log, setup.logSentinel),
        "log sentinel unchanged by the recovered replay");
      const finalizedDraft = await readDraftBytes(survivor);
      check(finalizedDraft.raw === setup.preDraftRaw && finalizedDraft.checkpoint === setup.preCheckpointRaw,
        "DraftV2 raw and checkpoint bytes unchanged by the recovered replay");
      const finalizedArtifacts = await artifactKeys(survivor);
      check(finalizedArtifacts.pending.length === 0 && finalizedArtifacts.closing.length === 0 &&
            finalizedArtifacts.sidecar.length === 0,
        "recovered replay cleared every pending, sidecar, and closing artifact", finalizedArtifacts);

      // Case 6: exact retry after the recovered replay is idempotent.
      const revisionBeforeRetry = finalized.local.revision;
      const retry = await confirmTransition(survivor, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T10:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(retry?.alreadyCommitted === true && retry?.committed === true,
        "exact retry after recovered replay returns alreadyCommitted", retry);
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      const afterRetry = await readReplicas(survivor);
      check(afterRetry.local.revision === revisionBeforeRetry && afterRetry.idb.revision === revisionBeforeRetry,
        "idempotent retry advanced no revision in either replica");
      check(afterRetry.local.programHistory.length === 1 && afterRetry.idb.programHistory.length === 1,
        "idempotent retry created no second archive");
      const retryArtifacts = await artifactKeys(survivor);
      check(retryArtifacts.pending.length === 0 && retryArtifacts.closing.length === 0 && retryArtifacts.sidecar.length === 0,
        "idempotent retry left zero artifacts", retryArtifacts);
      await context.close();
    }

    // =========================================================================
    // Case 3: Final durable state before cleanup. Cleanup artifacts are made
    // unremovable so the shipped commit retains its journal and closing
    // marker after the successor is durable; boot recognizes the exact
    // successor, clears only the owned artifacts, and later DraftV2 writes
    // stay unblocked.
    // =========================================================================
    console.log("\n3. Finalized successor before cleanup is recognized and cleaned at boot");
    {
      const context = await browser.newContext();
      const survivor = await context.newPage();
      survivor.on("dialog", (d) => d.dismiss().catch(() => {}));
      await survivor.goto(BASE);
      await waitForAppBoot(survivor, { base: BASE });
      await clearStorage(survivor);
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "finalized");
      const revisionR = setup.predecessorRevision;
      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_finalized_cleanup",
        successorProgramId: "prog_p6c_finalized_succ",
        createdAt: "2026-10-03T11:00:00.000Z",
      });
      check(propose?.ok === true, "finalized-case sibling proposal created", propose?.code);
      const proposal = propose.proposal;
      const args = {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T11:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };

      await injectCleanupFailure(survivor);
      const committed = await confirmTransition(survivor, args);
      await survivor.evaluate(() => window.__p6cRestoreCleanupSeam());
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      check(committed?.localOk === true && committed?.idbOk === true,
        "transition finalized in both replicas despite the interrupted cleanup", committed);

      const sealed = await readReplicas(survivor);
      check(sealed.local.programId === proposal.successor.programId &&
            sealed.idb.programId === proposal.successor.programId,
        "the durable successor is present in both replicas before cleanup");
      check(sealed.local.revision === revisionR + 1 && sealed.idb.revision === revisionR + 1,
        "finalized state sits at revision R+1 in both replicas");
      check(sealed.local.storageDraftTransaction == null && sealed.idb.storageDraftTransaction == null,
        "no parsed transaction marker remains in the finalized state");
      assertTransitionLinks(sealed, proposal, "finalized state");
      const sealedJournal = await readJournal(survivor);
      check(sealedJournal != null, "the matching journal is retained with the finalized successor");
      const sealedArtifacts = await artifactKeys(survivor);
      check(sealedArtifacts.closing.length > 0, "the closing marker is retained with the finalized successor",
        sealedArtifacts);
      const sealedDraft = await readDraftBytes(survivor);
      check(sealedDraft.raw === setup.preDraftRaw && sealedDraft.checkpoint === setup.preCheckpointRaw,
        "DraftV2 bytes unchanged through the finalized commit");

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterCleanup = await readReplicas(survivor);
      check(afterCleanup.local.programId === proposal.successor.programId &&
            afterCleanup.idb.programId === proposal.successor.programId,
        "boot recognized the exact finalized successor");
      check(afterCleanup.local.revision === revisionR + 1 && afterCleanup.idb.revision === revisionR + 1,
        "cleanup advanced no revision beyond R+1 in either replica");
      assertTransitionLinks(afterCleanup, proposal, "finalized cleanup");
      check(isDeepStrictEqual(afterCleanup.local.log, setup.logSentinel) &&
            isDeepStrictEqual(afterCleanup.idb.log, setup.logSentinel),
        "log sentinel unchanged by the finalized cleanup");
      const cleanupDraft = await readDraftBytes(survivor);
      check(cleanupDraft.raw === setup.preDraftRaw && cleanupDraft.checkpoint === setup.preCheckpointRaw,
        "DraftV2 bytes unchanged by the finalized cleanup");
      const cleanupArtifacts = await artifactKeys(survivor);
      check(cleanupArtifacts.pending.length === 0 && cleanupArtifacts.closing.length === 0 &&
            cleanupArtifacts.sidecar.length === 0,
        "boot cleared only the owned transaction artifacts", cleanupArtifacts);

      // Later DraftV2 writes are unblocked: with every transaction artifact
      // cleared, the shipped CAS applies straight to the canonical key
      // instead of staging behind a journal.
      const draftUnblocked = await survivor.evaluate(async () => {
        const WorkoutDraft = window.RepForgeWorkoutDraft;
        const read = window.__repforgeWorkoutDraft.read();
        if (read.status !== "ok") return { ok: false, reason: "canonical unreadable", read };
        const parsed = WorkoutDraft.parse(read.raw);
        if (parsed.kind !== "valid") return { ok: false, kind: parsed.kind };
        const draft = parsed.draft;
        const exId = draft.exerciseOrder[0];
        const setIds = draft.exercises[exId].setOrder;
        const set1Id = setIds[1] || setIds[0];
        const next = WorkoutDraft.reduce(draft, {
          type: "editSetField", exerciseInstanceId: exId, setId: set1Id, field: "reps", value: "14",
          expectedRevision: draft.revision, operationId: "p6c-unblocked-write",
          updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
          writer: { ...draft.writer, tabId: "p6c-unblocked", operationId: "p6c-unblocked-write" },
        });
        if (WorkoutDraft.isDomainError(next)) return { ok: false, error: next.code };
        const nextRaw = JSON.stringify(WorkoutDraft.serialize(next));
        const cas = await window.__repforgeWorkoutDraft.cas({
          expectedRaw: read.raw, expectedDraftId: draft.draftId, expectedRevision: draft.revision,
          nextRaw, operationId: "p6c-unblocked-write",
        });
        return {
          ok: cas.status === "applied" && cas.staged !== true,
          cas, nextRaw, raw: localStorage.getItem("repforge_draft_v1"),
        };
      });
      check(draftUnblocked.ok === true,
        "later DraftV2 writes apply straight to canonical after the recovered cleanup",
        { cas: draftUnblocked.cas, error: draftUnblocked.error });
      check(draftUnblocked.raw === draftUnblocked.nextRaw,
        "the unblocked DraftV2 write persisted its exact bytes", draftUnblocked.raw?.slice?.(0, 60));
      await context.close();
    }

    // =========================================================================
    // Case 4: Partial replica at the same transaction boundary — both
    // permutations heal through real boot arbitration without a second
    // archive or revision.
    // =========================================================================
    console.log("\n4. Partial replica healing in both permutations");
    for (const direction of ["local-successor", "idb-successor"]) {
      const context = await browser.newContext();
      const survivor = await context.newPage();
      survivor.on("dialog", (d) => d.dismiss().catch(() => {}));
      await survivor.goto(BASE);
      await waitForAppBoot(survivor, { base: BASE });
      await clearStorage(survivor);
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const setup = await setupPredecessorWithSentinelAndDraft(survivor, `partial-${direction}`);
      const revisionR = setup.predecessorRevision;
      const predecessorRaw = await survivor.evaluate((k) => localStorage.getItem(k), KEY);
      const propose = await page_or_null(survivor, {
        transitionId: `tr_p6c_partial_${direction}`,
        successorProgramId: `prog_p6c_partial_${direction}_succ`,
        createdAt: "2026-10-03T12:00:00.000Z",
      });
      check(propose?.ok === true, `${direction}: sibling proposal created`, propose?.code);
      const proposal = propose.proposal;
      const committed = await confirmTransition(survivor, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T12:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(committed?.localOk === true && committed?.idbOk === true,
        `${direction}: clean transition committed to both replicas`, committed);
      await survivor.evaluate(() => window.__repforgeStorage.flush());

      // Leave exactly one replica at the successor; the other holds the real
      // predecessor bytes captured before the commit.
      if (direction === "local-successor") {
        await injectIdbState(survivor, JSON.parse(predecessorRaw));
      } else {
        await survivor.evaluate((payload) => {
          localStorage.setItem(payload.key, payload.raw);
        }, { key: KEY, raw: predecessorRaw });
      }

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const healed = await readReplicas(survivor);
      check(healed.local.programId === proposal.successor.programId &&
            healed.idb.programId === proposal.successor.programId,
        `${direction}: boot arbitration healed both replicas to the successor`);
      check(healed.local.revision === revisionR + 1 && healed.idb.revision === revisionR + 1,
        `${direction}: healed state sits at revision R+1, not beyond, in both replicas`,
        { expected: revisionR + 1, local: healed.local.revision, idb: healed.idb.revision });
      assertTransitionLinks(healed, proposal, `partial ${direction}`);
      check(healed.local.storageDraftTransaction == null && healed.idb.storageDraftTransaction == null,
        `${direction}: no parsed transaction marker in either healed replica`);
      check(isDeepStrictEqual(healed.local.log, setup.logSentinel) &&
            isDeepStrictEqual(healed.idb.log, setup.logSentinel),
        `${direction}: log sentinel unchanged by the healing`);
      const healedDraft = await readDraftBytes(survivor);
      check(healedDraft.raw === setup.preDraftRaw && healedDraft.checkpoint === setup.preCheckpointRaw,
        `${direction}: DraftV2 bytes unchanged by the healing`);
      const healedArtifacts = await artifactKeys(survivor);
      check(healedArtifacts.pending.length === 0 && healedArtifacts.closing.length === 0 &&
            healedArtifacts.sidecar.length === 0,
        `${direction}: zero pending, sidecar, or closing artifacts after healing`, healedArtifacts);
      await context.close();
    }

    // =========================================================================
    // Case 5: A real newer DraftV2 command dispatched after the journal is
    // armed and before replay. The ABORT_CHANGED contract must not produce a
    // mixed state: predecessor active, zero archives, revision R, and the
    // newer draft retained with exact bytes and no residual artifacts.
    // =========================================================================
    console.log("\n5. Newer DraftV2 command after journal arm fails closed without mixing");
    {
      const env = await newBootedContext(browser);
      const { locker, writer, survivor, context } = env;
      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "draft-arm");
      const revisionR = setup.predecessorRevision;
      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_draft_after_arm",
        successorProgramId: "prog_p6c_draft_arm_succ",
        createdAt: "2026-10-03T13:00:00.000Z",
      });
      check(propose?.ok === true, "draft-arm sibling proposal created", propose?.code);
      const proposal = propose.proposal;

      await bootOthers([locker, writer]);
      await holdStorageLock(locker);
      await writer.evaluate((a) => {
        window.__p6cConfirmResult = window.__repforgeProgramTransition.confirmTransition(a);
      }, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T13:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      await waitForPendingStorageLocks(locker, 1);
      await survivor.waitForFunction((prefix) =>
        Object.keys(localStorage).some((k) => k.startsWith(prefix)), PENDING_PREFIX, { timeout: 10000 });

      // Real newer DraftV2 command, dispatched after the journal exists. With
      // the journal present the shipped CAS stages it behind the journal
      // without waiting for the held state lock.
      const newer = await survivor.evaluate(async () => {
        const hook = window.__repforgeWorkoutDraft;
        const draft = hook.current();
        const exIds = Object.keys(draft.exercises || {});
        const ex1Id = exIds[1] || exIds[0];
        const setIds = Object.keys(draft.exercises[ex1Id].sets || {});
        const set1Id = setIds[1] || setIds[0];
        const res = await hook.dispatch("editSetField", {
          exerciseInstanceId: ex1Id, setId: set1Id, field: "load", value: "83.5",
        });
        await hook.flush();
        return { status: res.status, raw: hook.raw() };
      });
      check(newer.status === "applied" && newer.raw !== setup.preDraftRaw,
        "the newer DraftV2 command landed after the journal arm", newer.status);

      await writer.close();
      await releaseStorageLock(locker);
      await locker.waitForFunction(async (lockName) => {
        const locks = await navigator.locks.query();
        return !locks.pending.some((lock) => lock.name === lockName);
      }, STORAGE_LOCK, { timeout: 10000 });

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const after = await readReplicas(survivor);
      check(after.local.programId === setup.predecessorProgramId &&
            after.idb.programId === setup.predecessorProgramId,
        "boot left the predecessor active in both replicas");
      check(after.local.revision === revisionR && after.idb.revision === revisionR,
        "the durable revision is unchanged at R in both replicas",
        { expected: revisionR, local: after.local.revision, idb: after.idb.revision });
      check(after.local.programHistory.length === 0 && after.idb.programHistory.length === 0,
        "zero new archives in either replica");
      check(after.local.transitionIn == null && after.idb.transitionIn == null,
        "no transitionIn in either replica");
      check(isDeepStrictEqual(after.local.log, setup.logSentinel) &&
            isDeepStrictEqual(after.idb.log, setup.logSentinel),
        "log sentinel intact in both replicas");
      const draftAfter = await readDraftBytes(survivor);
      check(draftAfter.raw === newer.raw, "the newer draft raw is retained exactly", {
        expected: newer.raw, actual: draftAfter.raw,
      });
      const newerCheckpoint = JSON.parse(draftAfter.checkpoint || "null");
      check(newerCheckpoint?.kind === "committed" && newerCheckpoint?.raw === newer.raw,
        "the retained draft is the acknowledged checkpoint aggregate", newerCheckpoint);
      check(draftAfter.recovery == null,
        "no recovery-channel entry was needed for the retained newer draft");
      const artifacts5 = await artifactKeys(survivor);
      check(artifacts5.pending.length === 0 && artifacts5.closing.length === 0 && artifacts5.sidecar.length === 0,
        "no residual journal, sidecar, or closing artifact after the fail-closed discard", artifacts5);
      await context.close();
    }

    // =========================================================================
    // Case 6: Deliberately malformed/mixed transition journals must be
    // rejected by the same integrity boundary. Each negative rewrites the
    // proposal inside the production-armed journal bytes.
    // =========================================================================
    console.log("\n6. Deliberate malformed/mixed transition journals are rejected");
    {
      const env = await newBootedContext(browser);
      const { locker, writer, survivor, context } = env;
      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "negatives");
      const revisionR = setup.predecessorRevision;
      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_malformed",
        successorProgramId: "prog_p6c_malformed_succ",
        createdAt: "2026-10-03T14:00:00.000Z",
      });
      check(propose?.ok === true, "negative-case sibling proposal created", propose?.code);
      const proposal = propose.proposal;

      await bootOthers([locker, writer]);
      await holdStorageLock(locker);
      await writer.evaluate((a) => {
        window.__p6cConfirmResult = window.__repforgeProgramTransition.confirmTransition(a);
      }, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T14:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      await waitForPendingStorageLocks(locker, 1);
      await survivor.waitForFunction((prefix) =>
        Object.keys(localStorage).some((k) => k.startsWith(prefix)), PENDING_PREFIX, { timeout: 10000 });
      const journal = await readJournal(survivor);
      const armedRaw = journal.raw;
      await writer.close();
      await releaseStorageLock(locker);

      const committedRecord = {
        ...JSON.parse(JSON.stringify(proposal)),
        status: "committed",
        confirmedAt: "2026-10-03T14:10:00.000Z",
        archiveId: proposal.predecessor.programId,
      };

      const negatives = [
        {
          name: "mismatched transition link (transitionIn names a different transitionId)",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = {
              ...committedRecord,
              transitionId: "tr_other_mismatch",
            };
          },
        },
        {
          name: "mismatched proposalHash link",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = {
              ...committedRecord,
              proposalHash: "f".repeat(64),
            };
          },
        },
        {
          name: "successor without matching archive (transitionOut removed)",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = committedRecord;
            j.proposal.programMeta.id = proposal.successor.programId;
            for (const row of j.proposal.programHistory) delete row.transitionOut;
          },
        },
        {
          name: "two outgoing transition archives",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = committedRecord;
            j.proposal.programMeta.id = proposal.successor.programId;
            j.proposal.programHistory.push(JSON.parse(JSON.stringify(j.proposal.programHistory[0])));
          },
        },
        {
          name: "replacement transitionIn with schemaVersion 2",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = { ...committedRecord, schemaVersion: 2 };
            j.proposal.programMeta.id = proposal.successor.programId;
          },
        },
        {
          name: "replacement transitionOut with schemaVersion 2",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = committedRecord;
            j.proposal.programMeta.id = proposal.successor.programId;
            for (const row of j.proposal.programHistory) {
              if (row?.transitionOut) row.transitionOut = { ...row.transitionOut, schemaVersion: 2 };
            }
          },
        },
        {
          name: "committed transitionIn without confirmedAt (normalization would drop)",
          mutate: (j) => {
            const record = { ...committedRecord };
            delete record.confirmedAt;
            j.proposal.programMeta.transitionIn = record;
            j.proposal.programMeta.id = proposal.successor.programId;
          },
        },
        {
          name: "committed transitionIn with empty confirmedAt (normalization would drop)",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = { ...committedRecord, confirmedAt: "" };
            j.proposal.programMeta.id = proposal.successor.programId;
          },
        },
        {
          name: "committed transitionIn with whitespace confirmedAt (normalization would drop)",
          mutate: (j) => {
            j.proposal.programMeta.transitionIn = { ...committedRecord, confirmedAt: "   " };
            j.proposal.programMeta.id = proposal.successor.programId;
          },
        },
      ];

      for (const negative of negatives) {
        const parsed = JSON.parse(armedRaw);
        negative.mutate(parsed);
        await survivor.evaluate(({ key, raw }) => localStorage.setItem(key, JSON.stringify(raw)),
          { key: journal.key, raw: parsed });
        await survivor.reload({ waitUntil: "domcontentloaded" });
        await waitForAppBoot(survivor, { base: BASE });

        const after = await readReplicas(survivor);
        check(after.local.programId === setup.predecessorProgramId &&
              after.idb.programId === setup.predecessorProgramId,
          `malformed journal rejected, predecessor retained: ${negative.name}`, after);
        check(after.local.revision === revisionR && after.idb.revision === revisionR,
          `malformed journal rejection advanced no revision: ${negative.name}`,
          { expected: revisionR, local: after.local.revision, idb: after.idb.revision });
        check(isDeepStrictEqual(after.local.programHistory, []) &&
              isDeepStrictEqual(after.idb.programHistory, []),
          `malformed journal rejection created zero archives: ${negative.name}`);
        check(after.local.transitionIn == null && after.idb.transitionIn == null,
          `malformed journal rejection wrote no transitionIn: ${negative.name}`);
        check(isDeepStrictEqual(after.local.log, setup.logSentinel) &&
              isDeepStrictEqual(after.idb.log, setup.logSentinel),
          `malformed journal rejection kept the log: ${negative.name}`);
        const draftAfter = await readDraftBytes(survivor);
        check(draftAfter.raw === setup.preDraftRaw && draftAfter.checkpoint === setup.preCheckpointRaw,
          `malformed journal rejection kept DraftV2 bytes: ${negative.name}`);
        const negArtifacts = await artifactKeys(survivor);
        check(negArtifacts.pending.length === 0 && negArtifacts.closing.length === 0 &&
              negArtifacts.sidecar.length === 0,
          `malformed journal rejection left zero artifacts: ${negative.name}`, negArtifacts);
      }

      // Post-discard representative real retry: discarding the malformed journal
      // left the predecessor state completely healthy and capable of committing
      // the real valid transition.
      const validRetry = await confirmTransition(survivor, {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T14:15:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(validRetry?.ok === true && validRetry?.committed === true &&
            validRetry?.localOk === true && validRetry?.idbOk === true,
        "representative valid retry commits cleanly after malformed journal discard", validRetry);
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });
      const afterValidRetry = await readReplicas(survivor);
      check(afterValidRetry.local.programId === proposal.successor.programId &&
            afterValidRetry.local.revision === revisionR + 1,
        "state advanced to successor at R+1 after representative valid retry");
      check(afterValidRetry.local.programHistory.length === 1 &&
            afterValidRetry.local.transitionIn?.status === "committed",
        "archive and transitionIn created cleanly after representative valid retry");

      await context.close();
    }

    // =========================================================================
    // Case 7 (correction 2): inherited transition value integrity on an
    // already-transitioned state. A generic journal whose proposal changes
    // inherited transitionIn/transitionOut values while retaining their IDs is
    // a transition attempt and must fail closed: discarded at boot with the
    // committed provenance intact in both replicas and the exact retry still
    // idempotent. The control arms a value-identical settings journal, which
    // must still replay and advance exactly once.
    // =========================================================================
    console.log("\n7. Inherited transition metadata is compared by value, not identity");
    {
      const env = await newBootedContext(browser);
      const { locker, survivor, context } = env;
      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "poison");
      const revisionR = setup.predecessorRevision;
      const propose = await page_or_null(survivor, {
        transitionId: "tr_p6c_inherited",
        successorProgramId: "prog_p6c_inherited_succ",
        createdAt: "2026-10-03T15:00:00.000Z",
      });
      check(propose?.ok === true, "inherited-case sibling proposal created", propose?.code);
      const proposal = propose.proposal;
      const confirmArgs = {
        proposal,
        transitionId: proposal.transitionId,
        successorProgramId: proposal.successor.programId,
        confirmedAt: "2026-10-03T15:10:00.000Z",
        proposalHash: proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };
      const committed = await confirmTransition(survivor, confirmArgs);
      check(committed?.ok === true && committed?.committed === true &&
            committed?.localOk === true && committed?.idbOk === true,
        "the transition committed cleanly before the inherited-value cases", committed);
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      // The committed provenance every poison case must leave untouched.
      const committedState = await readReplicas(survivor);
      const revisionT = committedState.local.revision;
      check(revisionT === revisionR + 1 && committedState.idb.revision === revisionR + 1,
        "the committed transition sits at R+1 in both replicas");
      const originalTin = JSON.parse(JSON.stringify(committedState.local.transitionIn));
      const originalHistory = JSON.parse(JSON.stringify(committedState.local.programHistory));
      check(originalTin?.transitionId === proposal.transitionId &&
            originalTin?.proposalHash === proposal.proposalHash,
        "the committed transitionIn record is captured for the value oracle", originalTin);
      check(originalHistory.length === 1 && originalHistory[0]?.transitionOut?.schemaVersion === 1,
        "the committed transitionOut archive is captured for the value oracle");

      // The lock-holder page must be live on the shared origin before the
      // first journal is armed; it only holds the state-write lock.
      await bootOthers([locker]);

      const poisonCases = [
        { name: "mutated inherited transitionIn.proposalHash with the same transitionId/archiveId", kind: "tin-proposalHash" },
        { name: "mutated inherited transitionOut.proposalHash with the same transitionId", kind: "tout-proposalHash" },
        { name: "mutated inherited transitionOut successor link with the same transitionId", kind: "tout-successorLink" },
        { name: "removed inherited transitionOut record", kind: "tout-removed" },
        { name: "duplicate inherited transitionOut archive with the same IDs", kind: "tout-duplicate" },
        { name: "changed inherited transitionIn.confirmedAt with every ID retained", kind: "tin-confirmedAt-ids-retained" },
      ];
      for (const poison of poisonCases) {
        const journal = await crashGenericWhileQueued(
          { locker, survivor, context }, { kind: poison.kind });
        check(journal.key.startsWith(PENDING_PREFIX),
          `${poison.name}: the generic journal is armed against the transitioned base`);
        const armed = JSON.parse(journal.raw);
        check(armed.base?.programMeta?.transitionIn?.transitionId === proposal.transitionId,
          `${poison.name}: the journal base is the already-transitioned state`);
        check(armed.proposal?.programMeta?.transitionIn?.transitionId === proposal.transitionId ||
              poison.kind.startsWith("tout"),
          `${poison.name}: the poisoned proposal retains the inherited transitionId`);

        await survivor.reload({ waitUntil: "domcontentloaded" });
        await waitForAppBoot(survivor, { base: BASE });

        const after = await readReplicas(survivor);
        for (const side of ["local", "idb"]) {
          check(after[side].programId === proposal.successor.programId,
            `${poison.name}: the committed successor stays active in ${side}`, after[side].programId);
          check(after[side].revision === revisionT,
            `${poison.name}: boot advanced no durable revision in ${side}`,
            { expected: revisionT, actual: after[side].revision });
          check(isDeepStrictEqual(after[side].transitionIn, originalTin),
            `${poison.name}: the committed transitionIn is value-intact in ${side}`);
          check(isDeepStrictEqual(after[side].programHistory, originalHistory),
            `${poison.name}: exactly the committed archive remains in ${side}`);
          check(isDeepStrictEqual(after[side].log, setup.logSentinel),
            `${poison.name}: the log sentinel is unchanged in ${side}`);
        }
        const draftAfter = await readDraftBytes(survivor);
        check(draftAfter.raw === setup.preDraftRaw && draftAfter.checkpoint === setup.preCheckpointRaw,
          `${poison.name}: DraftV2 raw and checkpoint bytes are unchanged`);
        const artifacts = await artifactKeys(survivor);
        check(artifacts.pending.length === 0 && artifacts.closing.length === 0 && artifacts.sidecar.length === 0,
          `${poison.name}: every journal, sidecar, and closing artifact cleared`, artifacts);

        // The exact retry must remain possible: the original committed proposal
        // is still idempotent, never a conflict.
        const retry = await confirmTransition(survivor, confirmArgs);
        check(retry?.alreadyCommitted === true && retry?.committed === true,
          `${poison.name}: the exact retry returns alreadyCommitted`, retry);
        const afterRetry = await readReplicas(survivor);
        check(afterRetry.local.revision === revisionT && afterRetry.idb.revision === revisionT,
          `${poison.name}: the exact retry advanced no revision in either replica`);
        check(isDeepStrictEqual(afterRetry.local.programHistory, originalHistory) &&
              isDeepStrictEqual(afterRetry.idb.programHistory, originalHistory),
          `${poison.name}: the exact retry created no second archive`);
      }

      // Control: an ordinary settings journal whose inherited transition
      // records are value-identical replays normally and advances once.
      const controlJournal = await crashGenericWhileQueued(
        { locker, survivor, context }, { kind: "control-settings" });
      check(controlJournal.key.startsWith(PENDING_PREFIX),
        "control: the value-identical settings journal is armed");
      const armedControl = JSON.parse(controlJournal.raw);
      check(armedControl.base?.programMeta?.transitionIn?.transitionId === proposal.transitionId &&
            isDeepStrictEqual(armedControl.base?.programMeta?.transitionIn, armedControl.proposal?.programMeta?.transitionIn) &&
            isDeepStrictEqual(
              (armedControl.base?.programHistory || []).filter((h) => h?.transitionOut),
              (armedControl.proposal?.programHistory || []).filter((h) => h?.transitionOut)),
        "control: the armed journal's inherited transition records are value-identical to its base");

      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterControl = await readReplicas(survivor);
      for (const side of ["local", "idb"]) {
        check(afterControl[side].revision === revisionT + 1,
          `control: the ordinary settings journal replayed and advanced exactly once in ${side}`,
          { expected: revisionT + 1, actual: afterControl[side].revision });
        check(afterControl[side].settings?.restSec === 135,
          `control: the settings change is durable in ${side}`, afterControl[side].settings?.restSec);
        check(afterControl[side].programId === proposal.successor.programId,
          `control: the successor stays active in ${side}`);
        check(isDeepStrictEqual(afterControl[side].transitionIn, originalTin),
          `control: the committed transitionIn is value-intact in ${side}`);
        check(isDeepStrictEqual(afterControl[side].programHistory, originalHistory),
          `control: exactly the committed archive remains in ${side}`);
        check(isDeepStrictEqual(afterControl[side].log, setup.logSentinel),
          `control: the log sentinel is unchanged in ${side}`);
      }
      const controlDraft = await readDraftBytes(survivor);
      check(controlDraft.raw === setup.preDraftRaw && controlDraft.checkpoint === setup.preCheckpointRaw,
        "control: DraftV2 raw and checkpoint bytes are unchanged");
      const controlArtifacts = await artifactKeys(survivor);
      check(controlArtifacts.pending.length === 0 && controlArtifacts.closing.length === 0 &&
            controlArtifacts.sidecar.length === 0,
        "control: the replay consumed every journal, sidecar, and closing artifact", controlArtifacts);

      // Control 2: an ordinary settings journal whose inherited transition
      // archives are reordered but value-identical does not trigger attempt guard.
      const reorderJournal = await crashGenericWhileQueued(
        { locker, survivor, context }, { kind: "control-reordered-archives" });
      check(reorderJournal.key.startsWith(PENDING_PREFIX),
        "control 2: the reordered-archive settings journal is armed");
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterReorder = await readReplicas(survivor);
      for (const side of ["local", "idb"]) {
        check(afterReorder[side].settings?.restSec === 140,
          `control 2: order-independent settings change applied in ${side}`, afterReorder[side].settings?.restSec);
      }

      await context.close();
    }

    // =========================================================================
    // Case 8: Chained B->C replacement crash and replay.
    // 1. Pre-lock crash during B->C: an incomplete armed journal (carrying
    //    predecessor B and a new uncommitted archive) is discarded at boot,
    //    leaving coherent B with its complete inherited A->B provenance intact.
    //    A real confirm retry then commits coherent C.
    // 2. Prepared state before final state on B->C: an interrupted confirm
    //    replays to completion at boot, advancing to R+2 with both A->B and
    //    B->C transition records durable in both replicas.
    // =========================================================================
    console.log("\n8. Chained B->C replacement crash discard and prepared replay");
    {
      const env = await newBootedContext(browser);
      const { locker, writer, survivor, context } = env;
      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "chain_crash");
      const revA = setup.predecessorRevision;

      // Commit transition 1: A -> B
      const propAB = await page_or_null(survivor, {
        transitionId: "tr_p6c_chain_ab_crash",
        successorProgramId: "prog_p6c_chain_b_crash",
        createdAt: "2026-10-03T16:00:00.000Z",
      });
      check(propAB?.ok === true, "first sibling proposal A->B created", propAB?.code);
      const proposalAB = propAB.proposal;
      const confirmArgsAB = {
        proposal: proposalAB,
        transitionId: proposalAB.transitionId,
        successorProgramId: proposalAB.successor.programId,
        confirmedAt: "2026-10-03T16:10:00.000Z",
        proposalHash: proposalAB.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };
      const committedAB = await confirmTransition(survivor, confirmArgsAB);
      check(committedAB?.ok === true && committedAB?.committed === true &&
            committedAB?.localOk === true && committedAB?.idbOk === true,
        "transition A->B committed cleanly before chained crash tests", committedAB);
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const stateB = await readReplicas(survivor);
      check(stateB.local.programId === "prog_p6c_chain_b_crash" &&
            stateB.local.revision === revA + 1,
        "program B is active at revision R+1");
      const originalTinB = JSON.parse(JSON.stringify(stateB.local.transitionIn));
      const originalHistB = JSON.parse(JSON.stringify(stateB.local.programHistory));

      // Propose transition 2: B -> C (shorter session)
      const propBC = await survivor.evaluate(async () => window.__repforgeProgramTransition.proposeSibling({
        targetConstraint: { sessionMinutes: 60 },
        diagnosis: {
          kind: "sessions_too_long", answers: { sessionMinutes: 60 },
          eligibleEvidenceIds: ["session-time-avg-105-of-90"], insufficientEvidenceReasons: [],
        },
        transitionId: "tr_p6c_chain_bc_crash",
        successorProgramId: "prog_p6c_chain_c_crash",
        createdAt: "2026-10-03T17:00:00.000Z",
      }));
      check(propBC?.ok === true, "second sibling proposal B->C created", propBC?.code);
      const proposalBC = propBC.proposal;

      // Part 1: Pre-lock crash during B->C
      await bootOthers([locker, writer]);
      const confirmArgsBC = {
        proposal: proposalBC,
        transitionId: proposalBC.transitionId,
        successorProgramId: proposalBC.successor.programId,
        confirmedAt: "2026-10-03T17:10:00.000Z",
        proposalHash: proposalBC.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      };

      const journal = await crashWhileQueued(env, confirmArgsBC, setup);
      check(journal.key.startsWith(PENDING_PREFIX), "chained B->C journal was armed while queued");

      // Reload survivor: boot must discard the incomplete pre-lock journal
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterDiscardB = await readReplicas(survivor);
      for (const side of ["local", "idb"]) {
        check(afterDiscardB[side].programId === "prog_p6c_chain_b_crash",
          `boot left predecessor B active in ${side} after pre-lock crash`);
        check(afterDiscardB[side].revision === revA + 1,
          `boot advanced no revision in ${side} after pre-lock crash`);
        check(isDeepStrictEqual(afterDiscardB[side].transitionIn, originalTinB),
          `inherited A->B transitionIn intact in ${side} after pre-lock crash`);
        check(isDeepStrictEqual(afterDiscardB[side].programHistory, originalHistB),
          `inherited archive intact in ${side} after pre-lock crash`);
        check(isDeepStrictEqual(afterDiscardB[side].log, setup.logSentinel),
          `log sentinel intact in ${side} after pre-lock crash`);
      }
      const draftAfterDiscard = await readDraftBytes(survivor);
      check(draftAfterDiscard.raw === setup.preDraftRaw && draftAfterDiscard.checkpoint === setup.preCheckpointRaw,
        "DraftV2 raw and checkpoint bytes unchanged after pre-lock crash discard");
      const discardArtifacts = await artifactKeys(survivor);
      check(discardArtifacts.pending.length === 0 && discardArtifacts.closing.length === 0 &&
            discardArtifacts.sidecar.length === 0,
        "pre-lock crash discard cleared every pending, sidecar, and closing artifact", discardArtifacts);

      // Part 2: Real retry of B->C commits coherently
      const retryBC = await confirmTransition(survivor, confirmArgsBC);
      check(retryBC?.ok === true && retryBC?.committed === true &&
            retryBC?.localOk === true && retryBC?.idbOk === true,
        "retry of B->C commits cleanly after pre-lock crash discard", retryBC);

      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const afterRetryC = await readReplicas(survivor);
      for (const side of ["local", "idb"]) {
        check(afterRetryC[side].programId === "prog_p6c_chain_c_crash",
          `successor C active in ${side} after retry`);
        check(afterRetryC[side].revision === revA + 2,
          `revision advanced to R+2 in ${side} after chained retry`);
        check(afterRetryC[side].programHistory.length === 2,
          `exactly two archives in ${side} after chained retry`);
      }

      await context.close();
    }

    // Part 3: Prepared state before final state on B->C
    {
      const context = await browser.newContext();
      const survivor = await context.newPage();
      survivor.on("dialog", (d) => d.dismiss().catch(() => {}));
      await survivor.goto(BASE);
      await waitForAppBoot(survivor, { base: BASE });
      await clearStorage(survivor);
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const setup = await setupPredecessorWithSentinelAndDraft(survivor, "chain_prep");
      const revA = setup.predecessorRevision;

      // Commit A -> B
      const propAB = await page_or_null(survivor, {
        transitionId: "tr_p6c_prep_ab",
        successorProgramId: "prog_p6c_prep_b",
        createdAt: "2026-10-03T18:00:00.000Z",
      });
      check(propAB?.ok === true, "prepared-case A->B proposal created");
      const confirmAB = await confirmTransition(survivor, {
        proposal: propAB.proposal,
        transitionId: propAB.proposal.transitionId,
        successorProgramId: propAB.proposal.successor.programId,
        confirmedAt: "2026-10-03T18:10:00.000Z",
        proposalHash: propAB.proposal.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(confirmAB?.committed === true, "A->B committed");
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      // Propose B -> C
      const propBC = await survivor.evaluate(async () => window.__repforgeProgramTransition.proposeSibling({
        targetConstraint: { sessionMinutes: 60 },
        diagnosis: {
          kind: "sessions_too_long", answers: { sessionMinutes: 60 },
          eligibleEvidenceIds: ["session-time-avg-105-of-90"], insufficientEvidenceReasons: [],
        },
        transitionId: "tr_p6c_prep_bc",
        successorProgramId: "prog_p6c_prep_c",
        createdAt: "2026-10-03T19:00:00.000Z",
      }));
      check(propBC?.ok === true, "prepared-case B->C proposal created");
      const proposalBC = propBC.proposal;

      // Inject write failure on final write of B->C
      await injectWriteFailureAfterFirst(survivor);
      const interrupted = await confirmTransition(survivor, {
        proposal: proposalBC,
        transitionId: proposalBC.transitionId,
        successorProgramId: proposalBC.successor.programId,
        confirmedAt: "2026-10-03T19:10:00.000Z",
        proposalHash: proposalBC.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      await survivor.evaluate(() => window.__p6cRestoreWriteSeam());
      await survivor.evaluate(() => window.__repforgeStorage.flush());
      check(interrupted?.deferred === true && interrupted?.finalizationPending === true,
        "interrupted B->C confirm reports deferred finalization", interrupted);

      // Reload survivor: boot replays the prepared transaction to completion
      await survivor.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(survivor, { base: BASE });

      const finalReplicas = await readReplicas(survivor);
      for (const side of ["local", "idb"]) {
        check(finalReplicas[side].programId === "prog_p6c_prep_c",
          `prepared B->C replay finished successor C in ${side}`);
        check(finalReplicas[side].revision === revA + 2,
          `prepared B->C replay advanced to R+2 in ${side}`);
        check(finalReplicas[side].programHistory.length === 2,
          `prepared B->C replay retained both archives in ${side}`);
        check(finalReplicas[side].storageDraftTransaction == null,
          `no _storageDraftTransaction marker in ${side} after boot recovery`);
      }
      const prepArtifacts = await artifactKeys(survivor);
      check(prepArtifacts.pending.length === 0 && prepArtifacts.closing.length === 0 &&
            prepArtifacts.sidecar.length === 0,
        "prepared B->C replay cleaned up all artifacts", prepArtifacts);

      // Duplicate retry of B->C reports alreadyCommitted
      const dupRetry = await confirmTransition(survivor, {
        proposal: proposalBC,
        transitionId: proposalBC.transitionId,
        successorProgramId: proposalBC.successor.programId,
        confirmedAt: "2026-10-03T19:10:00.000Z",
        proposalHash: proposalBC.proposalHash,
        acknowledgedDraftRaw: setup.preDraftRaw,
      });
      check(dupRetry?.alreadyCommitted === true && dupRetry?.committed === true,
        "duplicate retry after prepared B->C replay reports alreadyCommitted", dupRetry);

      await context.close();
    }

  } finally {
    await browser.close();
  }

  console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

// proposeSibling helper: production adapter only.
async function page_or_null(page, overrides) {
  return page.evaluate(async (args) => window.__repforgeProgramTransition.proposeSibling(args), {
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days", answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"], insufficientEvidenceReasons: [],
    },
    ...overrides,
  });
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
