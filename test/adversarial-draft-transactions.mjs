#!/usr/bin/env node
/**
 * Red-capable regressions for adversarial draft/state transaction overlaps.
 * Requires the repository root at REPFORGE_URL (default http://127.0.0.1:8000/).
 *
 * These assertions lock down the safe invariants at the transaction boundary.
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DRAFT_CHECKPOINT = `${DRAFT}:v2-checkpoint`;
const DRAFT_RECOVERY = `${DRAFT}:recovery`;
const PENDING = "repforge_pending_v1";
const PENDING_PREFIX = `${PENDING}:`;
const DRAFT_PENDING_PREFIX = `${DRAFT}:pending:`;
const DRAFT_CLOSE_PREFIX = `${DRAFT}:closing:`;
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const WEIGHT_METRIC = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS_METRIC = "2555c6f170d88072bbf6d9ad3f16ea86";
/* Replacing the whole installed program is activation of another canonical
   definition: the 18-slot seed program. */
const REPLACEMENT_DEFINITION = seedProgramMeta().programDefinition;
const EXERCISE_ID = "adversarial-press";
const OTHER_EXERCISE_ID = "adversarial-row";
const SET_KEY = `${EXERCISE_ID}_1`;
const LOAD_INPUT_KEY = `${SET_KEY}_metric_${WEIGHT_METRIC}`;
const FOCUSED_SCENARIO = process.argv.includes("--stored-close-marker-failure")
  ? "stored-close-marker-failure"
  : process.argv.includes("--settings-unit-draft-failure")
    ? "settings-unit-draft-failure"
    : process.argv.includes("--settings-unit-draft-conflict")
      ? "settings-unit-draft-conflict"
    : null;

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
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Every durable program carries a canonical ProgramDefinition (Plan 067); the
 * flat rows are its display projection. Fixture rows keep their stable ids and
 * names as display aliases of real Weight + Reps catalog movements borrowed
 * from the seed program.
 */
export function definitionBackedProgram(rows) {
  const seedRows = new Map(seedProgram().map((row) => [row.id, row]));
  const seedDefinition = seedProgramMeta().programDefinition;
  const seedSlots = new Map(seedDefinition.days.flatMap((day) => day.slots.map((slot) => [slot.id, slot])));
  const dayNames = [...new Set(rows.map((row) => row.day))];
  const program = [];
  const days = Array.from({ length: 7 }, (_, index) => {
    const name = dayNames[index] ?? `Rest ${index + 1}`;
    const dayId = `manual-day-${index + 1}`;
    const entries = rows.filter((row) => row.day === name).sort((a, b) => a.order - b.order);
    const slots = entries.map((row, slotIndex) => {
      const source = row.seedId || "seed-ex-3";
      const slot = structuredClone(seedSlots.get(source));
      const template = slot.prescriptionsByCycle[0].sets[0];
      slot.id = row.id;
      slot.order = slotIndex + 1;
      slot.displayName = row.name;
      slot.setupNotes = row.notes || "";
      slot.prescriptionsByCycle = slot.prescriptionsByCycle.map(({ cycleIndex }) => ({
        cycleIndex,
        sets: Array.from({ length: row.sets }, (_, setOffset) => ({
          ...structuredClone(template),
          id: `manual-${row.id}-${cycleIndex}-${setOffset + 1}`,
          cycleIndex,
          setIndex: setOffset + 1,
          targets: { reps: { min: row.min, max: row.max } },
        })),
      }));
      const seed = seedRows.get(source);
      program.push({
        id: row.id, day: name, order: slotIndex + 1, name: row.name, sets: row.sets,
        primary: seed.primary, secondary: seed.secondary, notes: row.notes || "",
        alternates: row.alternates || [], min: row.min, max: row.max,
        slotId: row.id, dayId, libraryId: slot.exerciseId, displayName: row.name,
      });
      return slot;
    });
    return { id: dayId, name, kind: slots.length ? "training" : "rest", order: index + 1, slots };
  });
  return { program, programDefinition: { ...seedDefinition, days } };
}

function fixture({
  revision = 10,
  programId = "adversarial-program",
  programName = "Adversarial transaction fixture",
} = {}) {
  const row = { day: "Day 1", order: 1, sets: 2, min: 8, max: 12 };
  const { program, programDefinition } = definitionBackedProgram([
    { ...row, id: EXERCISE_ID, name: "Adversarial press", seedId: "seed-ex-3" },
    { ...row, id: OTHER_EXERCISE_ID, name: "Adversarial row", day: "Day 2", seedId: "seed-ex-4" },
  ]);
  return {
    settings: {
      jumpPct: 2.5,
      minJump: 2.5,
      rirHigh: 2,
      hardRir: 4,
      restSec: 0,
      lastExport: "",
      unit: "kg",
      lang: "en",
      rirMode: "numeric",
      voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: programId,
      name: programName,
      started: "2026-08-01",
      created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: programDefinition.cycles,
      goal: null,
      experience: null,
      daysPerWeek: 2,
      splitType: "upper_lower",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "short",
      completedAt: null,
      programDefinition,
    },
    program,
    log: [],
    programHistory: [],
    _storageRevision: revision,
  };
}

/** A Day 1 workout in progress, written through the app's DraftV2 commands by seedScenario. */
function workoutDraft(marker, load = "90") {
  return { marker, load: String(load) };
}

/* The flat draft bytes an older build's saveDraft queues. The current app
   cannot activate them for a definition-backed program, so they stand for a
   stale writer's incompatible bytes. */
function legacyWorkoutDraft(marker, load = "90") {
  return {
    __day: "Day 1",
    __date: "2026-08-14",
    __sessionNotes: marker,
    __contextTouched: { day: true, date: true, sessionNotes: true, bodyweight: false },
    __done: [],
    __touched: [SET_KEY],
    __warm: [],
    __skipped: [],
    __substituted: {},
    __exnotes: {},
    [`${SET_KEY}_load`]: String(load),
    [`${SET_KEY}_reps`]: "8",
    [`${SET_KEY}_rir`]: "1",
  };
}

function oversizedDraftRaw(marker) {
  const value = legacyWorkoutDraft(marker, "92.5");
  value.__auditPadding = "x".repeat(1_000_001);
  return JSON.stringify(value);
}

function unversioned(snapshot) {
  const value = clone(snapshot);
  delete value._storageRevision;
  delete value._storageDraftTransaction;
  return value;
}

function replacementState(base, {
  revision = (base?._storageRevision ?? 0) + 1,
  programId = "replacement-program",
  programName = "Replacement program",
} = {}) {
  const value = clone(base);
  value._storageRevision = revision;
  value.programMeta = {
    ...value.programMeta,
    id: programId,
    name: programName,
    created: "2026-08-14T08:00:00.000Z",
    updated: "2026-08-14T08:00:00.000Z",
  };
  const replacement = definitionBackedProgram([{
    id: `${programId}-exercise`, name: `${programName} exercise`, day: "Replacement Day",
    order: 1, sets: 1, min: 6, max: 10, seedId: "seed-ex-3",
  }]);
  value.programMeta.programDefinition = replacement.programDefinition;
  value.program = replacement.program;
  return value;
}

function rawDraftLoad(raw) {
  try {
    const draft = JSON.parse(raw || "null");
    if (Object.prototype.hasOwnProperty.call(draft || {}, `${SET_KEY}_load`)) return draft[`${SET_KEY}_load`];
    if (draft?.schemaVersion !== 2) return null;
    const exercise = draft.exercises?.[EXERCISE_ID];
    const setId = exercise?.setOrder?.find((id) => exercise.sets?.[id]?.ordinal === 1);
    if (!setId) return null;
    const set = exercise.sets[setId];
    if (set.programmed?.metrics?.some((metric) => metric.id === WEIGHT_METRIC)) return set.edited?.metrics?.[WEIGHT_METRIC] ?? null;
    return set.edited?.load ?? null;
  } catch {
    return null;
  }
}

function programSummary(snapshot) {
  return {
    id: snapshot?.programMeta?.id ?? null,
    name: snapshot?.programMeta?.name ?? null,
    revision: snapshot?._storageRevision ?? null,
    marker: snapshot?._storageDraftTransaction?.version ?? null,
  };
}

function latestDraftPendingRaw(runtime) {
  const entry = runtime.draftPendingEntries
    .filter((candidate) => candidate.value?.raw != null)
    .sort((a, b) => {
      const ao = a.value?.order || {};
      const bo = b.value?.order || {};
      return (ao.at ?? 0) - (bo.at ?? 0) || (ao.seq ?? 0) - (bo.seq ?? 0);
    })
    .at(-1);
  return entry?.value?.raw ?? null;
}

async function waitForDraftPendingValue(page, loadKey, expected, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const artifacts = await inventoryPersistenceArtifacts(page);
    const found = artifacts.draftSidecarEntries.some((entry) => {
      return loadKey === LOAD_INPUT_KEY && rawDraftLoad(entry.value?.raw) === expected;
    });
    if (found) return;
    await page.waitForTimeout(25);
  }
  throw new Error(`timed out waiting for draft sidecar ${loadKey}=${expected}`);
}

/* The Focus shelf's Weight metric field for set 1 of the current exercise. */
async function fillShelfLoad(page, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${LOAD_INPUT_KEY}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true") {
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${WEIGHT_METRIC}"]`).click();
  }
  await input.fill(String(value));
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeFinalizeProgramSetup === "function" &&
      typeof window.__repforgeCommitNextBlock === "function" &&
      typeof window.__repforgeEnterWorkout === "function" &&
      typeof window.__repforgeSaveWorkout === "function",
    { timeout: 15000 }
  );
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate((replacementDefinition) => {
    window.__testReplacementDefinition = replacementDefinition;
    const onboarding = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    window.__testFinalizeCurrentProgram = (io) => {
      const current = JSON.parse(localStorage.getItem("repforge_v1") || "null");
      return window.__repforgeFinalizeProgramSetup({
        programDefinition: window.__testReplacementDefinition,
        name: "Beginner program",
        answers: { goal: current.programMeta?.goal || "hypertrophy" },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
      }, io);
    };
  }, REPLACEMENT_DEFINITION);
}

async function waitForBootOrRecovery(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      (window.__repforgeBooted === true || !!document.querySelector("#storageRecovery")?.open),
    { timeout: 15000 }
  );
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return page;
}

async function openPopup(context, owner, name) {
  const opened = context.waitForEvent("page");
  await owner.evaluate(
    ({ url, name }) => {
      window.__adversarialStaleTab = window.open(url, name);
    },
    { url: BASE, name }
  );
  const page = await opened;
  await waitForApp(page);
  return page;
}

/* A stale tab that saves through the uncoordinated draft-write path (stage a
   draft-write sidecar, publish only while no state transaction is provisional),
   the way an older build's saveDraft does. Its bytes are that build's flat
   draft, which the current app cannot activate for this program. */
async function openStaleWriterPopup(context, owner, name) {
  const page = await openPopup(context, owner, name);
  await page.evaluate(() => {
    window.__adversarialSaveLegacyDraft = (raw) => window.__repforgeWorkoutDraft.stageLegacy("draft-write", raw);
  });
  return page;
}

async function writeReplicas(page, state) {
  await page.evaluate(
    async ({ key, dbName, storeName, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(state, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { key: KEY, dbName: DB, storeName: STORE, state }
  );
}

/**
 * Install `state`. A string `draftRaw` is stored as the canonical draft bytes;
 * a workoutDraft() spec is written through the app's own DraftV2 commands and
 * the page reboots onto it, so the returned bytes are the acknowledged draft.
 */
async function seedScenario(page, { state = fixture(), draftRaw = null } = {}) {
  if (draftRaw == null || typeof draftRaw === "string") return installScenario(page, { state, draftRaw });
  const spec = draftRaw;
  await installScenario(page, { state, draftRaw: null });
  const entered = await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  if (!entered) throw new Error("production workout entry failed");
  await page.evaluate(async ({ marker, load, exerciseInstanceId, weightMetric, repsMetric }) => {
    const session = window.__repforgeWorkoutDraft;
    const setId = session.current().exercises[exerciseInstanceId].setOrder[0];
    const commands = [
      ["setSessionDate", { value: "2026-08-14" }],
      ["setSessionNotes", { value: marker }],
      ["editMetricValue", { exerciseInstanceId, setId, metricId: weightMetric, value: load }],
      ["editMetricValue", { exerciseInstanceId, setId, metricId: repsMetric, value: "8" }],
      ["editSetField", { exerciseInstanceId, setId, field: "rir", value: "1" }],
    ];
    for (const [type, payload] of commands) {
      const result = await session.dispatch(type, payload);
      if (result?.status !== "applied") throw new Error(`${type} was not applied: ${JSON.stringify(result)}`);
    }
    await session.flush();
  }, { ...spec, exerciseInstanceId: EXERCISE_ID, weightMetric: WEIGHT_METRIC, repsMetric: REPS_METRIC });
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const raw = (await readRuntime(page)).draftRaw;
  if (rawDraftLoad(raw) !== spec.load || JSON.parse(raw).session?.notes !== spec.marker) {
    throw new Error(`draft seed failed: ${raw}`);
  }
  return raw;
}

async function installScenario(page, { state, draftRaw }) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      if (draftRaw == null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, draftRaw);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(state, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    {
      key: KEY,
      draftKey: DRAFT,
      dbName: DB,
      storeName: STORE,
      state,
      draftRaw,
    }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return (await readRuntime(page)).draftRaw;
}

async function readRuntime(page) {
  const runtime = await page.evaluate(
    async ({ key, draftKey, checkpointKey, recoveryKey, dbName, storeName }) => {
      const parse = (raw) => {
        if (raw == null) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return { __invalid: true };
        }
      };
      const localRaw = localStorage.getItem(key);
      const draftRaw = localStorage.getItem(draftKey);
      const checkpointRaw = localStorage.getItem(checkpointKey);
      const recoveryRaw = localStorage.getItem(recoveryKey);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) {
            request.result.createObjectStore(storeName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const idb = await new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {
        localRaw,
        local: parse(localRaw),
        idb,
        draftRaw,
        draft: parse(draftRaw),
        checkpointRaw,
        checkpoint: parse(checkpointRaw),
        recoveryRaw,
        recovery: parse(recoveryRaw),
        recoveryOpen: !!document.querySelector("#storageRecovery")?.open,
      };
    },
    {
      key: KEY,
      draftKey: DRAFT,
      checkpointKey: DRAFT_CHECKPOINT,
      recoveryKey: DRAFT_RECOVERY,
      dbName: DB,
      storeName: STORE,
    }
  );
  const artifacts = await inventoryPersistenceArtifacts(page);
  return {
    ...runtime,
    pendingEntries: artifacts.pendingEntries,
    draftPendingEntries: artifacts.draftPendingEntries,
    closingMarkerEntries: artifacts.closingMarkerEntries,
    draftArtifacts: artifacts.draftArtifacts.map((entry) => entry.key),
    persistenceArtifactEntries: artifacts.entries,
    persistenceArtifacts: artifacts.keys,
  };
}

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.__adversarialReleaseLock = release;
    window.__adversarialLockHeld = false;
    window.__adversarialLockDone = navigator.locks.request(lockName, async () => {
      window.__adversarialLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__adversarialLockHeld === true, { timeout: 10000 });
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__adversarialReleaseLock?.();
    await window.__adversarialLockDone;
  });
}

async function waitForPendingStorageLock(page) {
  await page.waitForFunction(
    async (lockName) => {
      const locks = await navigator.locks.query();
      return locks.pending.some((lock) => lock.name === lockName);
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function queueDraftLoad(page, load) {
  return page.evaluate(({ value, weightMetric }) => {
    const hook = window.__repforgeWorkoutDraft, draft = hook.current();
    const exerciseInstanceId = draft.session.selectedExerciseId;
    return hook.dispatch("editMetricValue", {
      exerciseInstanceId,
      setId: draft.exercises[exerciseInstanceId].setOrder[0],
      metricId: weightMetric,
      value,
    });
  }, { value: String(load), weightMetric: WEIGHT_METRIC });
}

async function nextDraftRaw(page, load, operationId = `adversarial-${Date.now()}`) {
  return page.evaluate(({ load, operationId, weightMetric }) => {
    const hook = window.__repforgeWorkoutDraft, draft = hook.current();
    const exerciseInstanceId = draft.session.selectedExerciseId;
    const next = window.RepForgeWorkoutDraft.reduce(draft, {
      type: "editMetricValue", exerciseInstanceId, setId: draft.exercises[exerciseInstanceId].setOrder[0],
      metricId: weightMetric, value: String(load), expectedRevision: draft.revision, operationId,
      updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
      writer: { ...draft.writer, operationId },
    });
    return JSON.stringify(window.RepForgeWorkoutDraft.serialize(next));
  }, { load: String(load), operationId, weightMetric: WEIGHT_METRIC });
}

async function runFinalCheckOrphan(browser) {
  console.log("\n1a. Queued stale-tab draft lands after final settlement check");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    let originalDraftRaw = workoutDraft("final-check-original", "90");
    originalDraftRaw = await seedScenario(writer, { draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openStaleWriterPopup(context, writer, "adversarial-final-check-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, pendingPrefix, staleRaw }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        let injected = false;
        let stateJournalPresent = false;
        let stagedRaw = null;
        Storage.prototype.removeItem = function (candidate) {
          if (!injected && typeof candidate === "string" && candidate.startsWith(pendingPrefix)) {
            const staleTab = window.__adversarialStaleTab;
            if (staleTab?.__adversarialSaveLegacyDraft?.(staleRaw)) {
              injected = true;
              stateJournalPresent = localStorage.getItem(candidate) != null;
              stagedRaw = staleTab.__adversarialStagedRaw;
            }
          }
          return originalRemoveItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return {
            result,
            injected,
            stateJournalPresent,
            stagedRaw,
            canonicalDraftRaw: localStorage.getItem(draftKey),
            durableProgram: JSON.parse(localStorage.getItem(key) || "null")?.programMeta?.name ?? null,
          };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        draftKey: DRAFT,
        pendingPrefix: PENDING_PREFIX,
        staleRaw: JSON.stringify(legacyWorkoutDraft("stale-tab-save", "131.25")),
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    await writer.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(writer);
    const reloaded = await readRuntime(writer);
    const sidecarRaw = latestDraftPendingRaw(final);

    check(
      observed.injected &&
        observed.stateJournalPresent,
      "race injection publishes from the stale tab at journal deletion",
      {
        injected: observed.injected,
        stateJournalPresent: observed.stateJournalPresent,
      }
    );
    check(
      rawDraftLoad(observed.stagedRaw) === "131.25",
      "the close protocol observes the exact stale-tab bytes before terminal cleanup",
      {
        stagedLoad: rawDraftLoad(observed.stagedRaw),
      }
    );

    check(
      observed.result?.draftConflict === true &&
        final.local?.programMeta?.id === before.local?.programMeta?.id &&
        final.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        final.draftRaw === originalDraftRaw &&
        final.recovery?.raw === observed.stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "final settlement rejects the program change, restores the acknowledged draft, and retains the queued stale bytes",
      {
        result: observed.result,
        expectedProgramId: before.local?.programMeta?.id,
        localProgramId: final.local?.programMeta?.id,
        idbProgramId: final.idb?.programMeta?.id,
        acknowledgedDraftRestored: final.draftRaw === originalDraftRaw,
        staleWriteRecovered: final.recovery?.raw === observed.stagedRaw,
        finalLoad: rawDraftLoad(final.draftRaw),
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );

    await stale.close();
  } finally {
    await context.close();
  }
}

async function runPostGuardReleaseDraft(browser) {
  console.log("\n1c. A stale app draft cannot land after the closing guard is released");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    let originalDraftRaw = workoutDraft("post-guard-original", "91.25");
    originalDraftRaw = await seedScenario(writer, { draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openStaleWriterPopup(context, writer, "adversarial-post-guard-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, pendingPrefix, closePrefix, staleRaw }) => {
        const originalGetItem = Storage.prototype.getItem;
        let injected = false;
        let guardAbsent = false;
        let stateFinalized = false;
        let publishedRaw = null;
        let stagedRaw = null;
        Storage.prototype.getItem = function (candidate) {
          const current = originalGetItem.apply(this, arguments);
          if (!injected && candidate === draftKey && current === null) {
            const storageKeys = [];
            for (let index = 0; index < localStorage.length; index++) {
              storageKeys.push(localStorage.key(index));
            }
            const durable = JSON.parse(originalGetItem.call(this, key) || "null");
            guardAbsent =
              !storageKeys.some(
                (storageKey) =>
                  storageKey === pendingPrefix ||
                  storageKey?.startsWith(`${pendingPrefix}:`) ||
                  storageKey?.startsWith(closePrefix)
              ) && !durable?._storageDraftTransaction;
            stateFinalized = durable?.programMeta?.name === "Beginner program";
            if (guardAbsent && stateFinalized) {
              const staleTab = window.__adversarialStaleTab;
              if (staleTab?.__adversarialSaveLegacyDraft?.(staleRaw)) {
                injected = true;
                publishedRaw = staleTab.localStorage.getItem(draftKey);
                stagedRaw = staleTab.__adversarialStagedRaw;
              }
            }
          }
          return current;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, injected, guardAbsent, stateFinalized, publishedRaw, stagedRaw };
        } finally {
          Storage.prototype.getItem = originalGetItem;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        draftKey: DRAFT,
        pendingPrefix: PENDING,
        closePrefix: DRAFT_CLOSE_PREFIX,
        staleRaw: JSON.stringify(legacyWorkoutDraft("stale-tab-save", "132.5")),
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      observed.injected && observed.guardAbsent && observed.stateFinalized,
      "precondition: stale save runs after journal, marker, and closing guard are absent",
      observed
    );
    check(
      observed.result?.draftConflict === true &&
        final.local?.programMeta?.id === before.local?.programMeta?.id &&
        final.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        observed.publishedRaw === null &&
        final.draftRaw === originalDraftRaw &&
        final.recovery?.raw === observed.stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "post-guard stale save rejects the replacement, restores the acknowledged draft, and retains stale bytes",
      {
        result: observed.result,
        expectedProgramId: before.local?.programMeta?.id,
        localProgramId: final.local?.programMeta?.id,
        idbProgramId: final.idb?.programMeta?.id,
        stagedLoad: rawDraftLoad(observed.stagedRaw),
        staleCanonicalDraft: observed.publishedRaw,
        finalLoad: rawDraftLoad(final.draftRaw),
        staleWriteRecovered: final.recovery?.raw === observed.stagedRaw,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runUnloadSafeDraftWal(browser) {
  console.log("\n1d. Interrupted DraftV2 publication rolls back to the acknowledged checkpoint");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    await seedScenario(page, { draftRaw: null });
    await page.evaluate(() => window.__repforgeEnterWorkout({}));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    const before = await readRuntime(page);
    const observed = await page.evaluate(async ({ load, weightMetric }) => {
      window.__repforgeDraftFault = "before-canonical-write";
      const hook = window.__repforgeWorkoutDraft, draft = hook.current();
      const exerciseInstanceId = draft.session.selectedExerciseId;
      const result = await hook.dispatch("editMetricValue", {
        exerciseInstanceId, setId: draft.exercises[exerciseInstanceId].setOrder[0], metricId: weightMetric, value: load,
      });
      return { result, checkpoint: hook.checkpoint(), canonicalRaw: hook.read().raw };
    }, { load: "134.75", weightMetric: WEIGHT_METRIC });
    check(observed.result?.status === "fault-before-canonical" &&
      observed.checkpoint?.value?.kind === "pending" &&
      rawDraftLoad(observed.checkpoint.value.raw) === "134.75" &&
      observed.canonicalRaw === before.draftRaw,
    "precondition: interrupted write retains candidate and prior acknowledged bytes in the checkpoint WAL", {
      result: observed.result, checkpointKind: observed.checkpoint?.value?.kind,
      candidateLoad: rawDraftLoad(observed.checkpoint?.value?.raw), canonicalUnchanged: observed.canonicalRaw === before.draftRaw,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const recovered = await readRuntime(page);
    check(recovered.draftRaw === before.draftRaw && recovered.checkpoint?.kind === "committed" &&
      recovered.checkpoint?.raw === before.draftRaw && recovered.persistenceArtifacts.length === 0,
    "boot rolls the unacknowledged candidate back to the previous committed V2", {
      recoveredLoad: rawDraftLoad(recovered.draftRaw), exactPrior: recovered.draftRaw === before.draftRaw,
      checkpointKind: recovered.checkpoint?.kind, artifacts: recovered.persistenceArtifacts,
    });
  } finally { await context.close(); }
}

async function runSameRawDraftWalAcceptance(browser) {
  console.log("\n1e. An exact DraftV2 operation retry settles its checkpoint before a destructive receipt");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    await seedScenario(page, { draftRaw: null });
    await page.evaluate(() => window.__repforgeEnterWorkout({}));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    const staged = await page.evaluate(async (weightMetric) => {
      const hook = window.__repforgeWorkoutDraft, draft = hook.current();
      const exerciseInstanceId = draft.session.selectedExerciseId;
      const operationId = "same-raw-checkpoint-retry";
      const next = window.RepForgeWorkoutDraft.reduce(draft, {
        type: "editMetricValue", exerciseInstanceId, setId: draft.exercises[exerciseInstanceId].setOrder[0],
        metricId: weightMetric, value: "136.25", expectedRevision: draft.revision, operationId,
        updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
        writer: { ...draft.writer, operationId },
      });
      const request = { expectedDraftId: draft.draftId, expectedRevision: draft.revision,
        nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)), operationId };
      window.__repforgeDraftFault = "after-canonical-write";
      const first = await hook.cas(request);
      const retry = await hook.cas(request);
      return { first, retry, raw: hook.read().raw, checkpoint: hook.checkpoint() };
    }, WEIGHT_METRIC);
    check(staged.first?.status === "fault-after-canonical" && staged.retry?.status === "applied" &&
      staged.retry?.idempotent === true && rawDraftLoad(staged.raw) === "136.25" &&
      staged.checkpoint?.value?.kind === "committed",
    "the original operation token settles the same candidate exactly once", staged);
    const result = await page.evaluate(() => window.__testFinalizeCurrentProgram());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);
    check((result?.localOk || result?.idbOk) && result?.draftConflict !== true &&
      final.local?.programMeta?.name === "Beginner program" && final.idb?.programMeta?.name === "Beginner program" &&
      final.draftRaw === null && final.persistenceArtifacts.length === 0,
    "the settled exact checkpoint is consumed by its destructive receipt without a false conflict", {
      result, local: programSummary(final.local), idb: programSummary(final.idb), artifacts: final.persistenceArtifacts,
    });
  } finally { await context.close(); }
}

async function runDuplicateCleanupOrphan(browser) {
  console.log("\n1b. A valid DraftV2 blocks duplicate block-start cleanup before journaling");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 30 });
    let originalDraftRaw = workoutDraft("duplicate-cleanup-original", "93.75");
    originalDraftRaw = await seedScenario(writer, { state: originalState, draftRaw: originalDraftRaw });
    const seeded = await readRuntime(writer);
    const beforeBytes = { draftRaw: seeded.draftRaw, checkpointRaw: seeded.checkpointRaw };
    const result = await writer.evaluate((oldProgramId) =>
      window.__repforgeCommitNextBlock("reduce_volume", undefined, oldProgramId),
      seeded.local.programMeta.id
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      result?.draftConflict === true &&
        result?.code === "live_draft_blocks_next_block" &&
        result?.committed === false &&
        result?.localOk === false &&
        result?.idbOk === false,
      "precondition: a live DraftV2 refuses the explicit block start before duplicate cleanup",
      {
        result,
        local: programSummary(final.local),
        idb: programSummary(final.idb),
      }
    );
    check(
      final.draftRaw === beforeBytes.draftRaw &&
        final.checkpointRaw === beforeBytes.checkpointRaw &&
        final.persistenceArtifacts.length === 0 &&
        final.pendingEntries.length === 0,
      "the refused block start preserves exact DraftV2 bytes and writes no transaction artifacts",
      {
        beforeDraft: beforeBytes.draftRaw,
        afterDraft: final.draftRaw,
        stateJournals: final.pendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
    check(
      final.local?._storageRevision === seeded.local?._storageRevision &&
        final.idb?._storageRevision === seeded.idb?._storageRevision &&
        final.persistenceArtifacts.length === 0,
      "the refusal leaves both durable replicas at the captured revision",
      {
        result,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runFinalMarkerFailure(browser) {
  console.log("\n2. Both final marker-removal writes fail");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 50 });
    let draftRaw = workoutDraft("marker-removal-total-failure", "96.25");
    draftRaw = await seedScenario(page, { state: originalState, draftRaw });
    const before = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ key }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites === 2) {
            throw new Error("audit: reject final local marker removal");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites === 2) {
            throw new Error("audit: reject final IDB marker removal");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, localStateWrites, idbStateWrites };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY }
    );
    const interrupted = await readRuntime(page);

    check(
      observed.localStateWrites === 3 &&
        observed.idbStateWrites === 3 &&
        observed.result?.localOk === false &&
        observed.result?.idbOk === false &&
        observed.result?.compensationPending === false &&
        observed.result?.compensationLocalOk === true &&
        observed.result?.compensationIdbOk === true,
      "failed marker removal triggers a durable third-write compensation before rejection",
      observed
    );
    check(
      interrupted.local?.programMeta?.id === before.local?.programMeta?.id &&
        interrupted.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        !interrupted.local?._storageDraftTransaction &&
        !interrupted.idb?._storageDraftTransaction &&
        interrupted.draftRaw === draftRaw &&
        interrupted.persistenceArtifacts.length === 0,
      "compensation restores the prior program and exact draft before returning",
      {
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        canonicalDraft: interrupted.draftRaw,
        stateJournals: interrupted.pendingEntries.length,
        sidecars: interrupted.draftPendingEntries.length,
        artifacts: interrupted.persistenceArtifacts,
      }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await readRuntime(page);
    check(
      reloaded.local?.programMeta?.id === before.local?.programMeta?.id &&
        reloaded.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        !reloaded.local?._storageDraftTransaction &&
        !reloaded.idb?._storageDraftTransaction &&
        reloaded.draftRaw === draftRaw &&
        reloaded.persistenceArtifacts.length === 0,
      "reload cannot resurrect a replacement reported as rejected",
      {
        local: programSummary(reloaded.local),
        idb: programSummary(reloaded.idb),
        canonicalDraft: reloaded.draftRaw,
        stateJournals: reloaded.pendingEntries.length,
        artifacts: reloaded.persistenceArtifacts,
      }
    );

    check(
      observed.result?.localOk ||
        observed.result?.idbOk ||
        (reloaded.local?.programMeta?.id === before.local?.programMeta?.id &&
          reloaded.idb?.programMeta?.id === before.idb?.programMeta?.id),
      "a reported both-store failure cannot reload as the permanently committed replacement",
      {
        result: observed.result,
        beforeProgramId: before.local?.programMeta?.id,
        reloadedLocalProgramId: reloaded.local?.programMeta?.id,
        reloadedIdbProgramId: reloaded.idb?.programMeta?.id,
      }
    );
  } finally {
    await context.close();
  }
}

async function runLateSidecarFailedCompensation(browser) {
  console.log("\n2a. Failed late-sidecar compensation retains a boot rollback witness");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    let originalDraftRaw = workoutDraft("late-sidecar-original", "96.75");
    originalDraftRaw = await seedScenario(writer, { state: fixture({ revision: 55 }), draftRaw: originalDraftRaw });
    const before = await readRuntime(writer);
    const stale = await openStaleWriterPopup(context, writer, "adversarial-late-sidecar-stale");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__adversarialStagedRaw = null;
      window.__adversarialRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__adversarialRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate, value) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          try {
            window.__adversarialStagedRaw = JSON.parse(value)?.raw ?? null;
          } catch {}
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, pendingPrefix, staleRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        let injected = false;
        let journalPresentAtInjection = false;
        let stagedRaw = null;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites > 2) {
            throw new Error("audit: reject late-sidecar local compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites > 2) {
            throw new Error("audit: reject late-sidecar IDB compensation");
          }
          return originalPut.apply(this, arguments);
        };
        Storage.prototype.removeItem = function (candidate) {
          if (!injected && typeof candidate === "string" && candidate.startsWith(pendingPrefix)) {
            const staleTab = window.__adversarialStaleTab;
            if (staleTab?.__adversarialSaveLegacyDraft?.(staleRaw)) {
              injected = true;
              journalPresentAtInjection = localStorage.getItem(candidate) != null;
              stagedRaw = staleTab.__adversarialStagedRaw;
            }
          }
          return originalRemoveItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return {
            result,
            localStateWrites,
            idbStateWrites,
            injected,
            journalPresentAtInjection,
            stagedRaw,
          };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          Storage.prototype.removeItem = originalRemoveItem;
          IDBObjectStore.prototype.put = originalPut;
          window.__adversarialStaleTab?.__adversarialRestoreSidecarCapture?.();
        }
      },
      {
        key: KEY,
        pendingPrefix: PENDING_PREFIX,
        staleRaw: JSON.stringify(legacyWorkoutDraft("stale-tab-save", "146.25")),
      }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const interrupted = await readRuntime(writer);

    check(
      observed.injected &&
        observed.journalPresentAtInjection &&
        rawDraftLoad(observed.stagedRaw) === "146.25" &&
        observed.localStateWrites >= 3 &&
        observed.idbStateWrites >= 3,
      "precondition: different-raw related sidecar lands during close after both successor writes",
      observed
    );
    check(
      observed.result?.draftConflict === true &&
        observed.result?.localOk === false &&
        observed.result?.idbOk === false &&
        observed.result?.compensationPending === true &&
        interrupted.draftRaw === observed.stagedRaw &&
        interrupted.pendingEntries.length === 1,
      "failed compensation is reported as pending and retains its rollback journal",
      {
        result: observed.result,
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        draftMatches: interrupted.draftRaw === observed.stagedRaw,
        pendingCount: interrupted.pendingEntries.length,
        artifacts: interrupted.persistenceArtifacts,
      }
    );

    await stale.close();
    await writer.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(writer);
    const recovered = await readRuntime(writer);
    const toastText = await writer.locator("#toast").innerText();
    check(
      recovered.local?.programMeta?.id === before.local?.programMeta?.id &&
        recovered.idb?.programMeta?.id === before.idb?.programMeta?.id &&
        recovered.draftRaw === originalDraftRaw &&
        recovered.recovery?.raw === observed.stagedRaw &&
        recovered.persistenceArtifacts.length === 0 &&
        /retry|try again/i.test(toastText),
      "boot accepts the retained rollback, heals both replicas, and drains cleanup artifacts",
      {
        beforeProgramId: before.local?.programMeta?.id,
        local: programSummary(recovered.local),
        idb: programSummary(recovered.idb),
        acknowledgedDraftRestored: recovered.draftRaw === originalDraftRaw,
        acknowledgedLoad: rawDraftLoad(originalDraftRaw),
        activeLoad: rawDraftLoad(recovered.draftRaw),
        checkpointLoad: rawDraftLoad(recovered.checkpoint?.raw),
        checkpointKind: recovered.checkpoint?.kind,
        staleWriteRecovered: recovered.recovery?.raw === observed.stagedRaw,
        artifacts: recovered.persistenceArtifacts,
        toastText,
      }
    );
  } finally {
    await context.close();
  }
}

async function runDeferredBlockFinalization(browser) {
  console.log("\n2b. A valid DraftV2 refuses block finalization before any write");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 60 });
    let draftRaw = workoutDraft("deferred-block-finalization", "97.5");
    draftRaw = await seedScenario(page, { state: originalState, draftRaw });

    const observed = await page.evaluate(
      async ({ key, expectedProgramId }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let localStateWrites = 0;
        let idbStateWrites = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++localStateWrites > 1) {
            throw new Error("audit: defer local block finalization and compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbStateWrites > 1) {
            throw new Error("audit: defer IDB block finalization and compensation");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          const result = await window.__repforgeCommitNextBlock("reduce_volume", undefined, expectedProgramId);
          return { result, localStateWrites, idbStateWrites };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY, expectedProgramId: originalState.programMeta.id }
    );
    const interrupted = await readRuntime(page);
    check(
      observed.localStateWrites === 0 &&
        observed.idbStateWrites === 0 &&
        observed.result?.draftConflict === true &&
        observed.result?.code === "live_draft_blocks_next_block" &&
        observed.result?.committed === false &&
        observed.result?.deferred === false &&
        observed.result?.localOk === false &&
        observed.result?.idbOk === false,
      "a valid DraftV2 refuses block finalization before capture, journal, or replica writes",
      observed
    );
    check(
      interrupted.local?.programMeta?.id === originalState.programMeta.id &&
        interrupted.idb?.programMeta?.id === originalState.programMeta.id &&
        !interrupted.local?._storageDraftTransaction &&
        !interrupted.idb?._storageDraftTransaction &&
        interrupted.draftRaw === draftRaw &&
        interrupted.pendingEntries.length === 0 &&
        interrupted.persistenceArtifacts.length === 0,
      "the refused block start retains the original replicas, exact draft, and no artifacts",
      {
        local: programSummary(interrupted.local),
        idb: programSummary(interrupted.idb),
        draftMatches: interrupted.draftRaw === draftRaw,
        pendingCount: interrupted.pendingEntries.length,
      }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const finalized = await readRuntime(page);
    check(
      finalized.local?.programMeta?.id === originalState.programMeta.id &&
        finalized.idb?.programMeta?.id === interrupted.idb?.programMeta?.id &&
        !finalized.local?._storageDraftTransaction &&
        !finalized.idb?._storageDraftTransaction &&
        finalized.draftRaw === draftRaw &&
        finalized.persistenceArtifacts.length === 0,
      "a later boot preserves the refused block start without losing its draft",
      {
        local: programSummary(finalized.local),
        idb: programSummary(finalized.idb),
        draftMatches: finalized.draftRaw === draftRaw,
        pendingCount: finalized.pendingEntries.length,
        artifacts: finalized.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runOversizedRequiredEffects(browser) {
  console.log("\n3a. Oversized required draft effects fail closed in-page");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 70 });
    const draftRaw = oversizedDraftRaw("oversized-required-effect");
    await seedScenario(page, { state: originalState, draftRaw });
    await page.evaluate(() => window.__repforgeEnterWorkout({}));
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const finishResult = await page.evaluate(() => window.__repforgeSaveWorkout());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterFinish = await readRuntime(page);
    check(
      draftRaw.length > 1_000_000 &&
        finishResult?.reason === "missing-active-draft" &&
        !finishResult.localOk &&
        !finishResult.idbOk &&
        afterFinish.local?.log?.length === 0 &&
        afterFinish.idb?.log?.length === 0 &&
        afterFinish.draftRaw === draftRaw &&
        afterFinish.persistenceArtifacts.length === 0,
      "Finish fails closed before writing state when recovery cannot activate an oversized draft",
      {
        draftLength: draftRaw.length,
        finishResult,
        localRows: afterFinish.local?.log?.length,
        idbRows: afterFinish.idb?.log?.length,
        draftUnchanged: afterFinish.draftRaw === draftRaw,
        stateJournals: afterFinish.pendingEntries.length,
        artifacts: afterFinish.persistenceArtifacts,
      }
    );

    check(
      !(finishResult?.localOk || finishResult?.idbOk) || afterFinish.draftRaw === null,
      "an accepted Finish cannot silently omit its required exact draft clear",
      {
        draftLength: draftRaw.length,
        finishResult,
        acceptedRows: afterFinish.local?.log?.length,
        canonicalDraftPresent: afterFinish.draftRaw != null,
      }
    );

    const replaceResult = await page.evaluate(() => window.__testFinalizeCurrentProgram());
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterReplace = await readRuntime(page);
    const draftExerciseStillInProgram = afterReplace.local?.program?.some(
      (exercise) => exercise.id === EXERCISE_ID
    );
    check(
      replaceResult?.effectInvalid === true &&
        !replaceResult.localOk &&
        !replaceResult.idbOk &&
        afterReplace.local?.programMeta?.id === originalState.programMeta.id &&
        afterReplace.idb?.programMeta?.id === originalState.programMeta.id &&
        afterReplace.draftRaw === draftRaw &&
        draftExerciseStillInProgram === true,
      "destructive replacement fails closed before changing an oversized draft's program",
      {
        replaceResult,
        local: programSummary(afterReplace.local),
        idb: programSummary(afterReplace.idb),
        draftLength: afterReplace.draftRaw?.length ?? 0,
        draftExerciseStillInProgram,
      }
    );

    check(
      !(replaceResult?.localOk || replaceResult?.idbOk) || afterReplace.draftRaw === null,
      "an accepted destructive program replacement cannot silently omit its required draft guard",
      {
        draftLength: draftRaw.length,
        replaceResult,
        replacementProgramId: afterReplace.local?.programMeta?.id,
        canonicalDraftPresent: afterReplace.draftRaw != null,
        draftExerciseStillInProgram,
      }
    );
  } finally {
    await context.close();
  }
}

async function runMalformedBootEffect(browser) {
  console.log("\n3b. Malformed required v2 effect fails closed during boot replay");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 80 });
    let draftRaw = workoutDraft("malformed-boot-required-effect", "102.5");
    draftRaw = await seedScenario(page, { state: originalState, draftRaw });
    const proposal = replacementState(originalState, {
      revision: 80,
      programId: "malformed-effect-proposal",
      programName: "Malformed effect proposal",
    });
    const journalId = "audit-malformed-required-effect";
    const journal = {
      version: 2,
      id: journalId,
      order: { at: 1, writer: "audit-malformed-effect", seq: 1 },
      base: unversioned(originalState),
      liveBase: unversioned(originalState),
      proposal: unversioned(proposal),
      replace: false,
      expectedProgramId: null,
      effect: {
        required: true,
        kind: "clear-draft",
        expectedRaw: draftRaw,
        precondition: "malformed-required-precondition",
      },
    };
    await page.evaluate(
      ({ key, raw }) => localStorage.setItem(key, raw),
      { key: `${PENDING_PREFIX}${journalId}`, raw: JSON.stringify(journal) }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForBootOrRecovery(page);
    const replayed = await readRuntime(page);

    check(
      replayed.local?.programMeta?.id === originalState.programMeta.id &&
        replayed.idb?.programMeta?.id === originalState.programMeta.id &&
        replayed.draftRaw === draftRaw &&
        replayed.persistenceArtifacts.length === 0 &&
        replayed.recoveryOpen === false,
      "boot drains a malformed v2 effect without applying its proposal",
      {
        local: programSummary(replayed.local),
        idb: programSummary(replayed.idb),
        canonicalDraftLoad: rawDraftLoad(replayed.draftRaw),
        stateJournals: replayed.pendingEntries.length,
        artifacts: replayed.persistenceArtifacts,
        recoveryOpen: replayed.recoveryOpen,
      }
    );

    check(
      replayed.local?.programMeta?.id === originalState.programMeta.id &&
        replayed.idb?.programMeta?.id === originalState.programMeta.id &&
        replayed.draftRaw === draftRaw,
      "boot replay refuses a v2 proposal whose declared required draft effect is malformed",
      {
        expectedProgramId: originalState.programMeta.id,
        localProgramId: replayed.local?.programMeta?.id,
        idbProgramId: replayed.idb?.programMeta?.id,
        canonicalDraftPreserved: replayed.draftRaw === draftRaw,
        recoveryOpen: replayed.recoveryOpen,
      }
    );
  } finally {
    await context.close();
  }
}

async function runDirectDraftOwnerRace(browser) {
  console.log("\n4. requestWorkoutDay refusal preserves transaction-owned queued progress");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 90 });
    let canonicalDraftRaw = workoutDraft("direct-owner-canonical", "106.25");
    canonicalDraftRaw = await seedScenario(writer, { state: originalState, draftRaw: canonicalDraftRaw });
    const stale = await openApp(context);
    const locker = await openApp(context);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__adversarialOwnerResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);

    await fillShelfLoad(stale, "157.5");
    await waitForDraftPendingValue(stale, LOAD_INPUT_KEY, "157.5");
    const staged = await readRuntime(stale);
    const stagedRaw = latestDraftPendingRaw(staged);
    const dialogs = [];
    stale.on("dialog", async (dialog) => {
      dialogs.push({ type: `native ${dialog.type()}`, message: dialog.message() });
      await dialog.dismiss();
    });
    // The question is the drawn sheet now (OG-6 `today/draft-resume`); Cancel is the refusal under test.
    const dayChange = stale.evaluate(() =>
      window.__repforgeEnterWorkout({ day: "Day 2"})
    );
    await stale.waitForSelector("#draftDiscardSheet.is-open", { timeout: 5000 });
    dialogs.push({ type: "sheet", message: await stale.locator("#draftDiscardBody").textContent() });
    await stale.locator("#draftDiscardKeep").click();
    const dayChangeAccepted = await dayChange;
    const afterRefusal = await readRuntime(stale);
    const afterRefusalRaw = latestDraftPendingRaw(afterRefusal);

    check(
      staged.draftRaw === canonicalDraftRaw &&
        rawDraftLoad(stagedRaw) === "157.5" &&
        staged.draftPendingEntries.length === 1,
      "precondition: destructive owner holds a queued newer draft beside older canonical bytes",
      {
        canonicalLoad: rawDraftLoad(staged.draftRaw),
        stagedLoad: rawDraftLoad(stagedRaw),
        sidecars: staged.draftPendingEntries.length,
      }
    );
    check(
      dayChangeAccepted === false &&
        dialogs.length === 1 && dialogs[0].type === "sheet" &&
        afterRefusal.draftRaw === canonicalDraftRaw &&
        afterRefusalRaw === stagedRaw,
      "day-change refusal leaves transaction-owned staged bytes untouched",
      {
        dayChangeAccepted,
        dialogs,
        canonicalLoad: rawDraftLoad(afterRefusal.draftRaw),
        stagedLoadBefore: rawDraftLoad(stagedRaw),
        stagedLoadAfter: rawDraftLoad(afterRefusalRaw),
        sidecarsAfter: afterRefusal.draftPendingEntries.length,
      }
    );

    check(
      dayChangeAccepted === false &&
        afterRefusal.draftRaw === canonicalDraftRaw &&
        afterRefusalRaw === stagedRaw,
      "requestWorkoutDay refusal preserves the exact transaction-owned draft returned by DraftStore",
      {
        dayChangeAccepted,
        canonicalLoad: rawDraftLoad(afterRefusal.draftRaw),
        stagedLoadBefore: rawDraftLoad(stagedRaw),
        stagedLoadAfter: rawDraftLoad(afterRefusalRaw),
        exactStagedBytesPreserved: afterRefusalRaw === stagedRaw,
      }
    );

    await releaseStorageLock(locker);
    const transactionResult = await writer.evaluate(() => window.__adversarialOwnerResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    check(
      transactionResult?.draftConflict === true &&
        final.local?.programMeta?.id === originalState.programMeta.id &&
        final.idb?.programMeta?.id === originalState.programMeta.id &&
        final.draftRaw === stagedRaw &&
        final.checkpoint?.kind === "committed" &&
        final.checkpoint?.raw === stagedRaw &&
        final.persistenceArtifacts.length === 0,
      "transaction rejection acknowledges the newer V2 sidecar while retaining the old program",
      {
        transactionResult,
        local: programSummary(final.local),
        idb: programSummary(final.idb),
        finalCanonicalLoad: rawDraftLoad(final.draftRaw),
        checkpointLoad: rawDraftLoad(final.checkpoint?.raw),
        checkpointKind: final.checkpoint?.kind,
        lostLoad: rawDraftLoad(stagedRaw),
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runStoredCloseMarkerFailure(browser) {
  console.log("\n5. Stored recovery fails closed when close-marker creation fails");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const previous = fixture({ revision: 100 });
    let expectedDraftRaw = workoutDraft("stored-close-marker-expected", "108.75");
    expectedDraftRaw = await seedScenario(page, { state: previous, draftRaw: expectedDraftRaw });
    const concurrentDraftRaw = await nextDraftRaw(page, "166.25", "stored-close-marker-concurrent");

    const transactionId = "audit-stored-close-marker-failure";
    const prepared = replacementState(previous, {
      revision: previous._storageRevision + 1,
      programId: "stored-close-marker-replacement",
      programName: "Stored close-marker replacement",
    });
    prepared._storageDraftTransaction = {
      version: 1,
      id: transactionId,
      previous: clone(previous),
      effect: {
        required: true,
        kind: "clear-draft",
        expectedRaw: expectedDraftRaw,
        precondition: "abort-changed",
      },
    };
    await writeReplicas(page, prepared);
    const seeded = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ draftKey, closeKey, concurrentRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalRemoveItem = Storage.prototype.removeItem;
        let closeMarkerFailures = 0;
        let otherStorageFailures = 0;
        let concurrentWriteInjected = false;
        let injectionPhase = null;

        Storage.prototype.setItem = function (candidate) {
          if (candidate === closeKey) {
            closeMarkerFailures++;
            throw new DOMException("audit: reject close-marker creation", "QuotaExceededError");
          }
          try {
            return originalSetItem.apply(this, arguments);
          } catch (error) {
            otherStorageFailures++;
            throw error;
          }
        };
        Storage.prototype.removeItem = function (candidate) {
          if (candidate === draftKey && closeMarkerFailures > 0 && !concurrentWriteInjected) {
            originalSetItem.call(this, draftKey, concurrentRaw);
            concurrentWriteInjected = true;
            injectionPhase = "before-canonical-effect";
          }
          return originalRemoveItem.apply(this, arguments);
        };

        try {
          const decision = await window.resolveBootReplicas();
          if (!concurrentWriteInjected) {
            originalSetItem.call(localStorage, draftKey, concurrentRaw);
            concurrentWriteInjected = true;
            injectionPhase = "after-fail-closed-return";
          }
          return {
            decision: { kind: decision.kind, reason: decision.reason ?? null },
            closeMarkerFailures,
            otherStorageFailures,
            concurrentWriteInjected,
            injectionPhase,
            canonicalDraftRaw: localStorage.getItem(draftKey),
            closeMarkerRaw: localStorage.getItem(closeKey),
          };
        } finally {
          Storage.prototype.setItem = originalSetItem;
          Storage.prototype.removeItem = originalRemoveItem;
        }
      },
      {
        draftKey: DRAFT,
        closeKey: `${DRAFT_CLOSE_PREFIX}${transactionId}`,
        concurrentRaw: concurrentDraftRaw,
      }
    );

    const after = await readRuntime(page);
    const failClosed =
      observed.decision.kind === "unresolved" &&
      observed.decision.reason === "pending-transaction" &&
      after.local?._storageDraftTransaction?.id === transactionId &&
      after.idb?._storageDraftTransaction?.id === transactionId;
    const canonicalPreserved =
      observed.canonicalDraftRaw === concurrentDraftRaw && after.draftRaw === concurrentDraftRaw;

    check(
      seeded.draftRaw === expectedDraftRaw &&
        seeded.local?._storageDraftTransaction?.id === transactionId &&
        seeded.idb?._storageDraftTransaction?.id === transactionId &&
        observed.closeMarkerFailures > 0 &&
        observed.otherStorageFailures === 0 &&
        observed.concurrentWriteInjected &&
        observed.closeMarkerRaw === null,
      "precondition: only close-marker creation fails during stored recovery",
      {
        seededCanonicalLoad: rawDraftLoad(seeded.draftRaw),
        closeMarkerFailures: observed.closeMarkerFailures,
        otherStorageFailures: observed.otherStorageFailures,
        concurrentWriteInjected: observed.concurrentWriteInjected,
        injectionPhase: observed.injectionPhase,
        closeMarkerPresent: observed.closeMarkerRaw != null,
      }
    );
    check(
      canonicalPreserved && failClosed,
      "stored recovery preserves a concurrent canonical draft and remains durably fail closed",
      {
        decision: observed.decision,
        injectionPhase: observed.injectionPhase,
        expectedConcurrentLoad: rawDraftLoad(concurrentDraftRaw),
        observedCanonicalLoad: rawDraftLoad(after.draftRaw),
        canonicalPreserved,
        local: programSummary(after.local),
        idb: programSummary(after.idb),
        localTransactionId: after.local?._storageDraftTransaction?.id ?? null,
        idbTransactionId: after.idb?._storageDraftTransaction?.id ?? null,
        failClosed,
      }
    );
  } finally {
    await context.close();
  }
}

async function runSettingsUnitDraftFailure(browser) {
  console.log("\n6. Settings unit conversion fails atomically when draft publication fails");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const page = await openApp(context);
    const originalState = fixture({ revision: 110 });
    let originalDraftRaw = workoutDraft("settings-unit-publication-failure", "100");
    originalDraftRaw = await seedScenario(page, { state: originalState, draftRaw: originalDraftRaw });
    const before = await readRuntime(page);

    const observed = await page.evaluate(
      async ({ draftKey }) => {
        const originalSetItem = Storage.prototype.setItem;
        let draftPublicationAttempts = 0;
        let otherStorageFailures = 0;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === draftKey) {
            draftPublicationAttempts++;
            throw new DOMException("audit: reject converted draft publication", "QuotaExceededError");
          }
          try {
            return originalSetItem.apply(this, arguments);
          } catch (error) {
            otherStorageFailures++;
            throw error;
          }
        };
        try {
          window.__repforgeShowSettings();
          const unit = document.querySelector("#unit");
          unit.value = "lb";
          unit.dispatchEvent(new Event("input", { bubbles: true }));
          const result = await document.querySelector("#saveSettings").onclick();
          await window.__repforgeStorage.flush();
          return { result, draftPublicationAttempts, otherStorageFailures };
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      { draftKey: DRAFT }
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await readRuntime(page);
    const resultRejected = !(observed.result?.localOk || observed.result?.idbOk);
    const settingsCompensated =
      reloaded.local?.settings?.unit === "kg" && reloaded.idb?.settings?.unit === "kg";
    const exactDraftPreserved = reloaded.draftRaw === originalDraftRaw;

    check(
      before.local?.settings?.unit === "kg" &&
        before.idb?.settings?.unit === "kg" &&
        before.draftRaw === originalDraftRaw &&
        observed.draftPublicationAttempts > 0 &&
        observed.otherStorageFailures === 0,
      "precondition: only canonical draft publication fails during a real kg-to-lb Settings save",
      {
        beforeLocalUnit: before.local?.settings?.unit,
        beforeIdbUnit: before.idb?.settings?.unit,
        beforeDraftLoad: rawDraftLoad(before.draftRaw),
        draftPublicationAttempts: observed.draftPublicationAttempts,
        otherStorageFailures: observed.otherStorageFailures,
      }
    );
    check(
      resultRejected &&
        settingsCompensated &&
        exactDraftPreserved &&
        reloaded.persistenceArtifacts.length === 0 &&
        !reloaded.local?._storageDraftTransaction &&
        !reloaded.idb?._storageDraftTransaction,
      "failed unit conversion rejects the Settings commit and preserves the exact kg draft",
      {
        result: observed.result,
        localUnit: reloaded.local?.settings?.unit,
        idbUnit: reloaded.idb?.settings?.unit,
        retainedDraftLoad: rawDraftLoad(reloaded.draftRaw),
        exactDraftPreserved,
        stateJournals: reloaded.pendingEntries.length,
        sidecars: reloaded.draftPendingEntries.length,
        artifacts: reloaded.persistenceArtifacts,
        localTransaction: reloaded.local?._storageDraftTransaction?.version ?? null,
        idbTransaction: reloaded.idb?._storageDraftTransaction?.version ?? null,
      }
    );
  } finally {
    await context.close();
  }
}

async function runSettingsUnitDraftConflict(browser) {
  console.log("\n7. Settings unit conversion rejects a newer draft");
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  try {
    const writer = await openApp(context);
    const originalState = fixture({ revision: 120 });
    let originalDraftRaw = workoutDraft("settings-unit-conflict-original", "100");
    originalDraftRaw = await seedScenario(writer, { state: originalState, draftRaw: originalDraftRaw });
    const locker = await openApp(context);
    await holdStorageLock(locker);

    await writer.evaluate(() => {
      window.__repforgeShowSettings();
      const unit = document.querySelector("#unit");
      unit.value = "lb";
      window.__settingsUnitConflictResult = unit.onchange();
    });
    await waitForPendingStorageLock(locker);
    const newerWrite = await queueDraftLoad(writer, "145");
    const newerDraftRaw = newerWrite.raw;
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__settingsUnitConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      result?.draftConflict === true &&
        !result.localOk &&
        !result.idbOk &&
        final.local?.settings?.unit === "kg" &&
        final.idb?.settings?.unit === "kg" &&
        final.draftRaw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "a newer draft rejects unit conversion without changing its bytes or persisted unit",
      {
        result,
        localUnit: final.local?.settings?.unit,
        idbUnit: final.idb?.settings?.unit,
        expectedDraftLoad: rawDraftLoad(newerDraftRaw),
        retainedDraftLoad: rawDraftLoad(final.draftRaw),
        exactDraftPreserved: final.draftRaw === newerDraftRaw,
        stateJournals: final.pendingEntries.length,
        sidecars: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runScenario(name, scenario) {
  try {
    await scenario();
  } catch (error) {
    failures.push(`${name}: harness error`);
    console.error(`  ✗ ${name}: harness error`);
    console.error(error?.stack || error);
  }
}

async function main() {
  console.log("Adversarial draft-transaction regressions");
  console.log(`Target: ${BASE}`);
  const browser = await launchChromium();
  try {
    if (!FOCUSED_SCENARIO) {
      await runScenario("post-final-check orphan", () => runFinalCheckOrphan(browser));
      await runScenario("post-guard stale draft", () => runPostGuardReleaseDraft(browser));
      await runScenario("unload-safe draft WAL", () => runUnloadSafeDraftWal(browser));
      await runScenario("same-raw draft WAL acceptance", () => runSameRawDraftWalAcceptance(browser));
      await runScenario("expectedProgramId duplicate cleanup", () => runDuplicateCleanupOrphan(browser));
      await runScenario("final marker-removal total failure", () => runFinalMarkerFailure(browser));
      await runScenario("late-sidecar failed compensation", () => runLateSidecarFailedCompensation(browser));
      await runScenario("deferred block finalization", () => runDeferredBlockFinalization(browser));
      await runScenario("oversized in-page required effects", () => runOversizedRequiredEffects(browser));
      await runScenario("malformed boot required effect", () => runMalformedBootEffect(browser));
      await runScenario("direct draft owner race", () => runDirectDraftOwnerRace(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "stored-close-marker-failure") {
      await runScenario("stored recovery close-marker failure", () => runStoredCloseMarkerFailure(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "settings-unit-draft-failure") {
      await runScenario("Settings unit draft publication failure", () => runSettingsUnitDraftFailure(browser));
    }
    if (!FOCUSED_SCENARIO || FOCUSED_SCENARIO === "settings-unit-draft-conflict") {
      await runScenario("Settings unit newer-draft conflict", () => runSettingsUnitDraftConflict(browser));
    }
  } finally {
    await browser.close();
  }

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) {
    console.error("\nObserved failing assertions:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
