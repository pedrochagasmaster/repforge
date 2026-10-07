#!/usr/bin/env node
/**
 * Focused destructive-program draft conflict regressions.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

/* Clear the mapping review and persist the candidate. Activation remains a
   separate transaction, which the conflict cases start while holding the
   storage lock. */
async function reviewAndStageImport(page) {
  await page.waitForSelector("#importReview.active", { timeout: 5000 });
  for (let guard = 0; guard < 40; guard++) {
    const acted = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")].find((r) => r.classList.contains("is-open"));
      if (!row) return false;
      (row.querySelector('[data-imp-act="link"]') || row.querySelector('[data-imp-act="raw"]'))?.click();
      return true;
    });
    if (!acted) break;
    await page.waitForTimeout(50);
  }
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DRAFT_CHECKPOINT = `${DRAFT}:v2-checkpoint`;
const DRAFT_RECOVERY = `${DRAFT}:recovery`;
const DRAFT_PENDING_PREFIX = `${DRAFT}:pending:`;
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const WEIGHT_METRIC = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS_METRIC = "2555c6f170d88072bbf6d9ad3f16ea86";
/* Replacing the whole installed program is activation of another canonical
   definition: the 18-slot seed program. */
const REPLACEMENT_DEFINITION = seedProgramMeta().programDefinition;
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

function domainSnapshot(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy._storageRevision;
  const canonicalize = (candidate) => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(
        Object.keys(candidate)
          .sort()
          .map((key) => [key, canonicalize(candidate[key])])
      );
    }
    return candidate;
  };
  return JSON.stringify(canonicalize(copy));
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

function fixture() {
  const row = { day: "Day 1", sets: 2, min: 8, max: 12 };
  const { program, programDefinition } = definitionBackedProgram([
    { ...row, id: "draft-conflict-press", name: "Draft conflict press", order: 1, seedId: "seed-ex-3" },
    { ...row, id: "draft-conflict-press-accessory", name: "Draft conflict press accessory", order: 2, seedId: "seed-ex-3" },
    { ...row, id: "draft-conflict-row", name: "Draft conflict row", day: "Day 2", order: 1, seedId: "seed-ex-4" },
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
      id: "draft-conflict-program",
      name: "Draft conflict fixture",
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
    _storageRevision: 10,
  };
}

/** A Day 1 workout in progress: dated, noted, with set 1 Weight `load`, Reps 8, RIR 1. */
function draft(marker, load) {
  return { marker, load: String(load) };
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeFinalizeProgramSetup === "function",
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

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return page;
}

/* A second tab that writes the workout draft through the uncoordinated
   draft-write path: it stages the draft as a draft-write sidecar and publishes
   only while no state transaction is provisional. That is how a tab without
   DraftV2 compare-and-swap (an older build's saveDraft) saves, so the queue
   below is the one such a writer leaves behind. */
async function openStalePopup(context, opener, name) {
  const popup = context.waitForEvent("page");
  await opener.evaluate(({ url, name }) => {
    window.__draftConflictStaleTab = window.open(url, name);
  }, { url: BASE, name });
  const page = await popup;
  await waitForApp(page);
  return page;
}

/**
 * Install `state` with no draft, then (for a draft spec) write the workout
 * through the app's own DraftV2 commands and reboot onto it, so the returned
 * bytes are the acknowledged draft boot reads.
 */
async function seedScenario(page, draftSpec, state = fixture()) {
  await installState(page, null, state);
  if (draftSpec == null) return (await readRuntime(page)).draftRaw;
  const entered = await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  if (!entered) throw new Error("production workout entry failed");
  await page.evaluate(async ({ marker, load, weightMetric, repsMetric }) => {
    const session = window.__repforgeWorkoutDraft;
    const exerciseInstanceId = "draft-conflict-press";
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
  }, { ...draftSpec, weightMetric: WEIGHT_METRIC, repsMetric: REPS_METRIC });
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const raw = (await readRuntime(page)).draftRaw;
  if (storedDraftLoad(raw) !== draftSpec.load || JSON.parse(raw).session?.notes !== draftSpec.marker) {
    throw new Error(`draft seed failed: ${raw}`);
  }
  return raw;
}

async function installState(page, draftRaw, state) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      if (draftRaw == null) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, draftRaw);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
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
      const localRaw = localStorage.getItem(key);
      const local = localRaw == null ? null : JSON.parse(localRaw);
      const draftRaw = localStorage.getItem(draftKey);
      const checkpointRaw = localStorage.getItem(checkpointKey);
      const recoveryRaw = localStorage.getItem(recoveryKey);
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const idb = await new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return { localRaw, local, idb, draftRaw, checkpointRaw, recoveryRaw };
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
    window.__draftConflictReleaseLock = release;
    window.__draftConflictLockHeld = false;
    window.__draftConflictLockDone = navigator.locks.request(lockName, async () => {
      window.__draftConflictLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__draftConflictLockHeld === true, { timeout: 10000 });
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__draftConflictReleaseLock?.();
    await window.__draftConflictLockDone;
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

async function queueNewerDraftLoad(page, load) {
  await page.evaluate(({ value, weightMetric }) => {
    const hook = window.__repforgeWorkoutDraft;
    const exerciseInstanceId = "draft-conflict-press";
    const setId = hook.current().exercises[exerciseInstanceId].setOrder[0];
    window.__draftConflictNewerDraft = hook.dispatch("editMetricValue", {
      exerciseInstanceId,
      setId,
      metricId: weightMetric,
      value,
    });
  }, { value: String(load), weightMetric: WEIGHT_METRIC });
}

async function finishNewerDraftLoad(page) {
  const result = await page.evaluate(() => window.__draftConflictNewerDraft);
  if (result?.status !== "applied") throw new Error(`newer DraftV2 write did not apply: ${JSON.stringify(result)}`);
  return result.raw;
}

async function nextDraftRaw(page, load, operationId = `fixture-${Date.now()}`) {
  return page.evaluate(({ load, operationId, weightMetric }) => {
    const raw = localStorage.getItem("repforge_draft_v1");
    const parsed = window.RepForgeWorkoutDraft.parse(raw);
    if (parsed.kind !== "valid") throw new Error(`expected DraftV2, got ${parsed.kind}`);
    const draft = parsed.draft;
    const exerciseInstanceId = draft.exerciseOrder[0];
    const setId = draft.exercises[exerciseInstanceId].setOrder[0];
    const next = window.RepForgeWorkoutDraft.reduce(draft, {
      type: "editMetricValue", exerciseInstanceId, setId, metricId: weightMetric, value: String(load),
      expectedRevision: draft.revision, operationId,
      updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
      writer: { ...draft.writer, tabId: "conflict-fixture", operationId },
    });
    if (window.RepForgeWorkoutDraft.isDomainError(next)) throw new Error(next.code);
    return JSON.stringify(window.RepForgeWorkoutDraft.serialize(next));
  }, { load: String(load), operationId, weightMetric: WEIGHT_METRIC });
}

async function installAcknowledgedDraft(page, raw, operationId = `fixture-${Date.now()}`) {
  await page.evaluate(({ draftKey, checkpointKey, raw, operationId }) => {
    const parsed = window.RepForgeWorkoutDraft.parse(raw);
    if (parsed.kind !== "valid") throw new Error(`expected DraftV2, got ${parsed.kind}`);
    const draft = parsed.draft;
    localStorage.setItem(draftKey, raw);
    localStorage.setItem(checkpointKey, JSON.stringify({
      version: 1, kind: "committed", draftId: draft.draftId, revision: draft.revision,
      operationId, programFingerprint: draft.program.programFingerprint, raw,
    }));
  }, { draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, raw, operationId });
}

function acknowledgedCheckpointRaw(raw, operationId) {
  const draft = JSON.parse(raw);
  return JSON.stringify({
    version: 1, kind: "committed", draftId: draft.draftId, revision: draft.revision,
    operationId, programFingerprint: draft.program.programFingerprint, raw,
  });
}

function storedDraftLoad(raw, exerciseId = "draft-conflict-press") {
  if (raw == null) return null;
  const value = JSON.parse(raw);
  if (value?.schemaVersion === 2) {
    const exercise = value.exercises?.[exerciseId];
    const set = exercise?.sets?.[exercise?.setOrder?.[0]];
    if (set?.programmed?.metrics?.some((metric) => metric.id === WEIGHT_METRIC)) return set.edited?.metrics?.[WEIGHT_METRIC] ?? null;
    return set?.edited?.load ?? null;
  }
  return value?.[`${exerciseId}_1_load`] ?? null;
}

async function waitForNoPendingStorageLock(page) {
  await page.waitForFunction(
    async (lockName) => {
      const locks = await navigator.locks.query();
      return !locks.pending.some((lock) => lock.name === lockName);
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function openProgramEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  const hidden = await page.locator("#programEditorWrap").evaluate((element) =>
    element.classList.contains("is-hidden")
  );
  if (hidden) await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
}

async function runTemplateConflict(browser) {
  console.log("\n1. Whole-program activation conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-template-draft", "82.5"));
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "97.5");
    await waitForPendingStorageLocks(locker, 1);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const toastText = await writer.locator("#toast").innerText();

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "program activation journals the exact confirmed draft with abort-on-change policy",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        result.localOk === false &&
        result.idbOk === false,
      "program activation returns explicit draftConflict",
      result
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "program activation conflict preserves durable program and newer draft byte-for-byte",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "program activation conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(/retry|try again/i.test(toastText), "program activation conflict shows retry guidance", toastText);
  } finally {
    await context.close();
  }
}

async function runFinalizeConflict(browser) {
  console.log("\n2. Program setup finalization conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-finalize-draft", "85"));
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "100");
    await waitForPendingStorageLocks(locker, 1);
    await writer.evaluate(
      ({ programDefinition, confirmedDraftRaw }) => {
        window.__draftConflictResult = window.__repforgeFinalizeProgramSetup({
          programDefinition,
          name: "Conflicting finalized program",
          answers: { goal: "hypertrophy" },
          destination: "log",
          origin: "settings",
          draftConfirmed: true,
          discardDraftRaw: confirmedDraftRaw,
        });
      },
      { programDefinition: REPLACEMENT_DEFINITION, confirmedDraftRaw }
    );
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "program finalization journals the exact confirmed draft with abort-on-change policy",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        result.localOk === false &&
        result.idbOk === false,
      "program finalization returns explicit draftConflict",
      result
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "program finalization conflict preserves durable program and newer draft byte-for-byte",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "program finalization conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runSaveProgramConflict(browser) {
  console.log("\n3. Visible program edit conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-save-program-draft", "87.5"));
    const locker = await openApp(context);
    await openProgramEditor(writer);
    // Replacing the touched exercise is the visible equivalent of replacing
    // the installed program while a workout draft exists. Done first presents
    // the workout-safe Apply changes action before the destructive transaction
    // begins.
    await writer.locator('#programEditor [data-role="replace"][data-id="draft-conflict-press"]').click();
    await writer.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await writer.locator("#exPickList .pickrow").first().click();
    await writer.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "102.5");
    await waitForPendingStorageLocks(locker, 1);
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "visible program edit journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "visible program edit conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "visible program edit conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runNormalProgramImportConflict(browser) {
  console.log("\n4. Normal program import conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-import-draft", "90"));
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    const imported = fixture().program;
    imported[0].name = "Imported replacement press";
    await writer.setInputFiles("#importProgram", {
      name: "program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Imported conflict" }, exercises: imported })),
    });
    await reviewAndStageImport(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "105");
    await waitForPendingStorageLocks(locker, 1);
    await writer.evaluate(() => document.querySelector("#entryActivate")?.click());
    await confirmEntryReplace(writer);
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "normal program import journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "normal program import conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "normal program import conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

// Replacing an active program asks first; the dialog stands where the native confirm did.
async function confirmEntryReplace(page) {
  const replace = page.locator("#entryReplaceConfirm");
  if (await replace.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await replace.click();
}

async function runOnboardingProgramImportConflict(browser) {
  console.log("\n5. Onboarding program import conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-onboarding-import-draft", "91.25"));
    const locker = await openApp(context);
    await writer.evaluate(() => window.startOnboarding("settings"));
    await writer.waitForSelector("#onboarding.active", { timeout: 5000 });
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    const imported = fixture().program;
    imported[0].name = "Onboarding imported press";
    await writer.setInputFiles("#importProgram", {
      name: "onboarding-program.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 2, meta: { name: "Onboarding import" }, exercises: imported })),
    });
    await reviewAndStageImport(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "106.25");
    await waitForPendingStorageLocks(locker, 1);
    await writer.evaluate(() => document.querySelector("#entryActivate")?.click());
    await confirmEntryReplace(writer);
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const onboardingActive = await writer.locator("#onboarding").evaluate((element) =>
      element.classList.contains("active")
    );

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "onboarding import journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw &&
        onboardingActive,
      "onboarding import conflict preserves program, newer draft, and retry UI",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
        onboardingActive,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "onboarding import conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runDeleteExerciseConflict(browser) {
  console.log("\n6. Exercise deletion conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-delete-exercise-draft", "92.5"));
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "107.5");
    await waitForPendingStorageLocks(locker, 1);
    await writer.click('#programEditor [data-role="remove-exercise"][data-id="draft-conflict-press"]');
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "exercise deletion journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "exercise deletion conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "exercise deletion conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runDeleteDayConflict(browser) {
  console.log("\n7. Day deletion conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-delete-day-draft", "95"));
    const locker = await openApp(context);
    await openProgramEditor(writer);
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "110");
    await waitForPendingStorageLocks(locker, 1);
    await writer.click('#programEditor [data-role="day-menu"][data-day="Day 1"]');
    await writer.click('#programEditor [data-role="remove-day"][data-day="Day 1"]');
    await writer.click("#programEditToggle");
    await writer.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
    await writer.click("#programEditorApply");
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "day deletion journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "day deletion conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "day deletion conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runBackupReplaceConflict(browser) {
  console.log("\n8. Full-backup Replace conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-backup-replace-draft", "97.5"));
    const locker = await openApp(context);
    const incoming = fixture();
    incoming.programMeta.name = "Incoming full backup";
    incoming.program[0].name = "Incoming backup press";
    await writer.setInputFiles("#importJson", {
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incoming)),
    });
    await writer.waitForSelector("#importChoice[open]", { timeout: 5000 });
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "112.5");
    await waitForPendingStorageLocks(locker, 1);
    await writer.click("#importReplace");
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "full-backup Replace journals the exact draft present at acceptance",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "full-backup Replace conflict preserves durable state and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "full-backup Replace conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(
      await writer.locator("#importChoice").evaluate((dialog) => dialog.open),
      "full-backup Replace conflict leaves the chooser open for retry"
    );
  } finally {
    await context.close();
  }
}

async function runDeleteLogConflict(browser) {
  console.log("\n9. Delete log conflicts with a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const state = fixture();
    state.log = [
      {
        session: "delete-log-session",
        date: "2026-08-13",
        day: "Day 1",
        name: "Draft conflict press",
        exerciseId: "draft-conflict-press",
        set: 1,
        load: 80,
        reps: 8,
        rir: 1,
        notes: "",
        created: "2026-08-13T12:00:00.000Z",
        primary: "Chest",
        secondary: "Triceps",
      },
    ];
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-delete-log-draft", "98.75"), state);
    const locker = await openApp(context);
    await writer.evaluate(() => window.__repforgeShowSettings());
    const before = await readRuntime(writer);
    writer.on("dialog", (dialog) => dialog.accept());
    await holdStorageLock(locker);
    await queueNewerDraftLoad(writer, "113.75");
    await waitForPendingStorageLocks(locker, 1);
    await writer.click("#reset");
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await finishNewerDraftLoad(writer);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "Delete log journals the exact confirmed draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "Delete log conflict preserves durable log and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "Delete log conflict clears only its stale journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runIndependentlyRemovedDraft(browser) {
  console.log("\n10. Independently removed draft permits the confirmed replacement");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("independently-removed-draft", "100"));
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    await locker.evaluate((draftKey) => localStorage.removeItem(draftKey), DRAFT);
    await releaseStorageLock(locker);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      (result?.localOk || result?.idbOk) &&
        result.draftConflict !== true &&
        result.revision === before.local._storageRevision + 1,
      "an independently removed draft is a safe accepted outcome",
      { beforeRevision: before.local?._storageRevision, result }
    );
    check(
      final.local?.programMeta?.name === "Beginner program" &&
        final.idb?.programMeta?.name === "Beginner program" &&
        final.draftRaw === null &&
        final.persistenceArtifacts.length === 0,
      "safe acceptance installs the program without recreating the removed draft",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        draftRaw: final.draftRaw,
        pendingCount: final.pendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runBootDestructiveConflict(browser) {
  console.log("\n11. Boot replay aborts an unloaded destructive clear for a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = await seedScenario(page, draft("retained-destructive-draft", "101.25"));
    const locker = await openApp(context);
    const before = await readRuntime(page);
    const newerDraftRaw = await nextDraftRaw(page, "116.25", "boot-destructive-newer");
    await holdStorageLock(locker);
    await page.evaluate(() => {
      window.__bootDestructivePending = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const retained = await readRuntime(page);
    await installAcknowledgedDraft(locker, newerDraftRaw, "boot-destructive-newer");

    check(
      retained.pendingEntries.length === 1 &&
        retained.pendingEntries[0].value?.effect?.precondition === "abort-changed" &&
        retained.pendingEntries[0].value.effect.expectedRaw === confirmedDraftRaw,
      "precondition: unload leaves the exact destructive clear receipt",
      retained.pendingEntries.map((entry) => entry.value?.effect)
    );

    await page.close();
    await waitForNoPendingStorageLock(locker);
    await releaseStorageLock(locker);
    await locker.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(locker);
    const final = await readRuntime(locker);
    const toastText = await locker.locator("#toast").innerText();
    check(
      final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "boot destructive conflict preserves durable program and newer draft",
      {
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "boot destructive conflict clears only its stale journal",
      final.persistenceArtifacts
    );
    check(/try again/i.test(toastText), "boot destructive conflict shows retry guidance", toastText);
  } finally {
    await context.close();
  }
}

async function runDraftCreatedAfterConfirmation(browser) {
  console.log("\n12. A draft created after confirmation aborts the replacement");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    await seedScenario(writer, null);
    const locker = await openApp(context);
    const before = await readRuntime(writer);
    await holdStorageLock(locker);
    await writer.evaluate(() => {
      window.__draftConflictCreatedDraft = window.__repforgeEnterWorkout({day: "Day 1" })
        .then(() => window.__repforgeWorkoutDraft.raw());
    });
    await waitForPendingStorageLocks(locker, 1);
    await writer.evaluate(() => {
      window.__draftConflictResult = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLocks(locker, 2);
    const blocked = await readRuntime(writer);
    await releaseStorageLock(locker);
    const newerDraftRaw = await writer.evaluate(() => window.__draftConflictCreatedDraft);
    const result = await writer.evaluate(() => window.__draftConflictResult);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);

    check(
      blocked.pendingEntries.length === 1 &&
        blocked.pendingEntries[0].value?.effect?.kind === "clear-draft" &&
        blocked.pendingEntries[0].value.effect.expectedRaw === null &&
        blocked.pendingEntries[0].value.effect.precondition === "abort-changed",
      "replacement journals the confirmed absence of a draft",
      blocked.pendingEntries.map((entry) => entry.value?.effect)
    );
    check(
      result?.draftConflict === true &&
        final.localRaw === before.localRaw &&
        JSON.stringify(final.idb) === JSON.stringify(before.idb) &&
        final.draftRaw === newerDraftRaw,
      "a newly created draft aborts replacement without changing either replica",
      {
        result,
        localChanged: final.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(final.idb) !== JSON.stringify(before.idb),
        draftMatchesNewer: final.draftRaw === newerDraftRaw,
      }
    );
    check(
      final.persistenceArtifacts.length === 0,
      "new-draft conflict clears only the stale replacement journal",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runLocalReplicaWriteRace(browser) {
  console.log("\n13. A draft written from the local replica write path aborts program activation");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = await seedScenario(page, draft("confirmed-local-write-race", "102.5"));
    const newerDraftRaw = await nextDraftRaw(page, "122.5", "local-write-race");
    const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, "local-write-race");
    const before = await readRuntime(page);
    const result = await page.evaluate(
      async ({ key, draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        Storage.prototype.setItem = function (candidate, value) {
          const written = originalSetItem.call(this, candidate, value);
          if (!injected && candidate === key) {
            injected = true;
            originalSetItem.call(this, draftKey, newerDraftRaw);
            originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
          }
          return written;
        };
        try {
          return await window.__testFinalizeCurrentProgram();
        } finally {
          Storage.prototype.setItem = originalSetItem;
        }
      },
      { key: KEY, draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(result?.draftConflict === true, "local-write race is observably rejected as draftConflict", result);
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb),
      "local-write race preserves the prior domain head in both replicas",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        beforeRevision: before.local?._storageRevision,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(final.draftRaw === newerDraftRaw, "local-write race preserves the newer draft exactly", {
      expected: newerDraftRaw,
      actual: final.draftRaw,
    });
    check(
      final.persistenceArtifacts.length === 0,
      "local-write race drains its stale journal only after rejection is durable",
      final.persistenceArtifacts
    );
  } finally {
    await context.close();
  }
}

async function runBootReplayLocalReplicaWriteRace(browser) {
  console.log("\n14. Boot replay rolls back when the local replica write path publishes a newer draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = await seedScenario(page, draft("confirmed-boot-write-race", "103.75"));
    const newerDraftRaw = await nextDraftRaw(page, "123.75", "boot-write-race");
    const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, "boot-write-race");
    const locker = await openApp(context);
    const before = await readRuntime(page);
    await holdStorageLock(locker);
    await page.evaluate(() => {
      window.__bootWriteRacePending = window.__testFinalizeCurrentProgram();
    });
    await waitForPendingStorageLock(locker);
    const retained = await readRuntime(page);
    check(
      retained.pendingEntries.length === 1 &&
        retained.pendingEntries[0].value?.effect?.precondition === "abort-changed",
      "precondition: boot race retains one destructive receipt",
      retained.pendingEntries.map((entry) => entry.value?.effect)
    );

    await page.close();
    await waitForNoPendingStorageLock(locker);
    await context.addInitScript(
      ({ key, draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw }) => {
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        Storage.prototype.setItem = function (candidate, value) {
          const written = originalSetItem.call(this, candidate, value);
          if (!injected && candidate === key) {
            injected = true;
            originalSetItem.call(this, draftKey, newerDraftRaw);
            originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
          }
          return written;
        };
      },
      { key: KEY, draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw }
    );
    await releaseStorageLock(locker);
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const toastText = await recovered.locator("#toast").innerText();

    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb),
      "boot local-write race preserves the prior domain head in both replicas",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        beforeRevision: before.local?._storageRevision,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(final.draftRaw === newerDraftRaw, "boot local-write race preserves the newer draft exactly", {
      expected: newerDraftRaw,
      actual: final.draftRaw,
    });
    check(
      final.persistenceArtifacts.length === 0,
      "boot local-write race drains its stale journal only after durable rollback",
      final.persistenceArtifacts
    );
    check(/retry|try again/i.test(toastText), "boot local-write race reports a draft conflict", toastText);
  } finally {
    await context.close();
  }
}

async function runOneStoreReplicaWriteRaces(browser) {
  console.log("\n15. Post-write draft conflicts compensate every accepted one-store outcome");
  for (const outcome of [
    { label: "local-only", localOk: true, idbOk: false },
    { label: "IDB-only", localOk: false, idbOk: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    try {
      const page = await openApp(context);
      const confirmedDraftRaw = await seedScenario(page, draft(`confirmed-${outcome.label}-race`, "105"));
      const operationId = `one-store-${outcome.label}`;
      const newerDraftRaw = await nextDraftRaw(page, "125", operationId);
      const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, operationId);
      const before = await readRuntime(page);
      const result = await page.evaluate(
        async ({ key, draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw, localOk, idbOk }) => {
          const originalSetItem = Storage.prototype.setItem;
          const originalPut = IDBObjectStore.prototype.put;
          let injected = false;
          Storage.prototype.setItem = function (candidate, value) {
            if (candidate !== key) return originalSetItem.call(this, candidate, value);
            if (!localOk) throw new Error("audit: reject local replica");
            const written = originalSetItem.call(this, candidate, value);
            if (!injected) {
              injected = true;
              originalSetItem.call(this, draftKey, newerDraftRaw);
              originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
            }
            return written;
          };
          IDBObjectStore.prototype.put = function (value, candidate) {
            if (candidate !== key) return originalPut.apply(this, arguments);
            if (!idbOk) throw new Error("audit: reject IDB replica");
            const request = originalPut.apply(this, arguments);
            if (!injected) {
              injected = true;
              originalSetItem.call(localStorage, draftKey, newerDraftRaw);
              originalSetItem.call(localStorage, checkpointKey, newerCheckpointRaw);
            }
            return request;
          };
          try {
            return await window.__testFinalizeCurrentProgram();
          } finally {
            Storage.prototype.setItem = originalSetItem;
            IDBObjectStore.prototype.put = originalPut;
          }
        },
        { key: KEY, draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw,
          localOk: outcome.localOk, idbOk: outcome.idbOk }
      );
      await page.evaluate(() => window.__repforgeStorage.flush());
      const compensated = await readRuntime(page);

      check(
        result?.draftConflict === true &&
          result.localOk === false &&
          result.idbOk === false &&
          result.compensationLocalOk === outcome.localOk &&
          result.compensationIdbOk === outcome.idbOk,
        `${outcome.label} conflict reports rejection and its durable compensation`,
        result
      );
      check(
        domainSnapshot(compensated.local) === domainSnapshot(before.local) &&
          domainSnapshot(compensated.idb) === domainSnapshot(before.idb) &&
          compensated.draftRaw === newerDraftRaw &&
          compensated.persistenceArtifacts.length === 0,
        `${outcome.label} compensation preserves the prior domain head and newer draft`,
        {
          localName: compensated.local?.programMeta?.name,
          idbName: compensated.idb?.programMeta?.name,
          localRevision: compensated.local?._storageRevision,
          idbRevision: compensated.idb?._storageRevision,
          pendingCount: compensated.pendingEntries.length,
          artifacts: compensated.persistenceArtifacts,
        }
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      const healed = await readRuntime(page);
      check(
        domainSnapshot(healed.local) === domainSnapshot(before.local) &&
          domainSnapshot(healed.idb) === domainSnapshot(before.idb) &&
          healed.local?._storageRevision === healed.idb?._storageRevision &&
          healed.draftRaw === newerDraftRaw,
        `${outcome.label} rollback wins replica selection and heals on boot`,
        {
          localName: healed.local?.programMeta?.name,
          idbName: healed.idb?.programMeta?.name,
          localRevision: healed.local?._storageRevision,
          idbRevision: healed.idb?._storageRevision,
        }
      );
    } finally {
      await context.close();
    }
  }
}

async function runCrossStoreCompensationRecovery(browser) {
  console.log("\n15b. Opposite one-store rollback outcomes deterministically win on boot");
  for (const outcome of [
    {
      label: "local provisional / IDB rollback",
      initialLocalOk: true,
      initialIdbOk: false,
      rollbackLocalOk: false,
      rollbackIdbOk: true,
    },
    {
      label: "IDB provisional / local rollback",
      initialLocalOk: false,
      initialIdbOk: true,
      rollbackLocalOk: true,
      rollbackIdbOk: false,
    },
  ]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    try {
      const page = await openApp(context);
      const confirmedDraftRaw = await seedScenario(page, draft(`confirmed-${outcome.label}`, "105.5"));
      const operationId = `cross-store-${outcome.label}`;
      const newerDraftRaw = await nextDraftRaw(page, "125.5", operationId);
      const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, operationId);
      const before = await readRuntime(page);
      const result = await page.evaluate(
        async ({
          key,
          draftKey,
          checkpointKey,
          newerDraftRaw,
          newerCheckpointRaw,
          initialLocalOk,
          initialIdbOk,
          rollbackLocalOk,
          rollbackIdbOk,
        }) => {
          const originalSetItem = Storage.prototype.setItem;
          const originalPut = IDBObjectStore.prototype.put;
          let localWrites = 0;
          let idbWrites = 0;
          let injected = false;
          Storage.prototype.setItem = function (candidate, value) {
            if (candidate !== key) return originalSetItem.call(this, candidate, value);
            localWrites++;
            const allowed = localWrites === 1 ? initialLocalOk : rollbackLocalOk;
            if (!allowed) throw new Error(`audit: reject local state round ${localWrites}`);
            const written = originalSetItem.call(this, candidate, value);
            if (!injected && localWrites === 1) {
              injected = true;
              originalSetItem.call(this, draftKey, newerDraftRaw);
              originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
            }
            return written;
          };
          IDBObjectStore.prototype.put = function (_value, candidate) {
            if (candidate !== key) return originalPut.apply(this, arguments);
            idbWrites++;
            const allowed = idbWrites === 1 ? initialIdbOk : rollbackIdbOk;
            if (!allowed) throw new Error(`audit: reject IDB state round ${idbWrites}`);
            const request = originalPut.apply(this, arguments);
            if (!injected && idbWrites === 1) {
              injected = true;
              originalSetItem.call(localStorage, draftKey, newerDraftRaw);
              originalSetItem.call(localStorage, checkpointKey, newerCheckpointRaw);
            }
            return request;
          };
          try {
            const value = await window.__testFinalizeCurrentProgram();
            return { value, localWrites, idbWrites };
          } finally {
            Storage.prototype.setItem = originalSetItem;
            IDBObjectStore.prototype.put = originalPut;
          }
        },
        {
          key: KEY,
          draftKey: DRAFT,
          checkpointKey: DRAFT_CHECKPOINT,
          newerDraftRaw,
          newerCheckpointRaw,
          initialLocalOk: outcome.initialLocalOk,
          initialIdbOk: outcome.initialIdbOk,
          rollbackLocalOk: outcome.rollbackLocalOk,
          rollbackIdbOk: outcome.rollbackIdbOk,
        }
      );
      await page.evaluate(() => window.__repforgeStorage.flush());
      const split = await readRuntime(page);
      const rollbackReplica = outcome.rollbackLocalOk ? split.local : split.idb;
      const provisionalReplica = outcome.initialLocalOk ? split.local : split.idb;

      check(
        result.value?.draftConflict === true &&
          result.value.localOk === false &&
          result.value.idbOk === false &&
          result.value.compensationLocalOk === outcome.rollbackLocalOk &&
          result.value.compensationIdbOk === outcome.rollbackIdbOk &&
          result.localWrites === 2 &&
          result.idbWrites === 2,
        `${outcome.label} reports rejection with the accepted rollback replica`,
        result
      );
      check(
        domainSnapshot(rollbackReplica) === domainSnapshot(before.local) &&
          rollbackReplica?._storageRevision > provisionalReplica?._storageRevision &&
          split.draftRaw === newerDraftRaw &&
          split.persistenceArtifacts.length === 0,
        `${outcome.label} leaves a higher-revision rollback head and exact newer draft`,
        {
          rollbackName: rollbackReplica?.programMeta?.name,
          provisionalName: provisionalReplica?.programMeta?.name,
          rollbackRevision: rollbackReplica?._storageRevision,
          provisionalRevision: provisionalReplica?._storageRevision,
          draftMatches: split.draftRaw === newerDraftRaw,
          artifacts: split.persistenceArtifacts,
        }
      );

      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      const healed = await readRuntime(page);
      check(
        domainSnapshot(healed.local) === domainSnapshot(before.local) &&
          domainSnapshot(healed.idb) === domainSnapshot(before.idb) &&
          healed.local?._storageRevision === healed.idb?._storageRevision &&
          healed.draftRaw === newerDraftRaw &&
          healed.persistenceArtifacts.length === 0,
        `${outcome.label} heals both replicas from the rollback winner`,
        {
          localName: healed.local?.programMeta?.name,
          idbName: healed.idb?.programMeta?.name,
          localRevision: healed.local?._storageRevision,
          idbRevision: healed.idb?._storageRevision,
          draftMatches: healed.draftRaw === newerDraftRaw,
          artifacts: healed.persistenceArtifacts,
        }
      );
    } finally {
      await context.close();
    }
  }
}

async function runEffectApplicationRace(browser) {
  console.log("\n16. A draft published between post-write check and receipt application is rejected");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = await seedScenario(page, draft("confirmed-effect-race", "106.25"));
    const newerDraftRaw = await nextDraftRaw(page, "126.25", "effect-race");
    const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, "effect-race");
    const before = await readRuntime(page);
    const observed = await page.evaluate(
      async ({ draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw }) => {
        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        let draftReads = 0;
        Storage.prototype.getItem = function (candidate) {
          if (candidate === draftKey) {
            draftReads++;
            if (draftReads === 4) {
              originalSetItem.call(this, draftKey, newerDraftRaw);
              originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
            }
          }
          return originalGetItem.apply(this, arguments);
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, draftReads };
        } finally {
          Storage.prototype.getItem = originalGetItem;
        }
      },
      { draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);

    check(
      observed.result?.draftConflict === true && observed.draftReads >= 4,
      "receipt-application race is observably rejected",
      observed
    );
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.draftRaw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "receipt-application race durably restores both replicas and preserves the newer draft",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        draftMatches: final.draftRaw === newerDraftRaw,
        pendingCount: final.pendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runPreparedTransactionUnloadRecovery(browser) {
  console.log("\n17. Boot compensates an interrupted prepared destructive transaction");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-interrupted-transaction", "107.5"));
    const newerDraftRaw = await nextDraftRaw(writer, "127.5", "interrupted-transaction");
    const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, "interrupted-transaction");
    const before = await readRuntime(writer);
    await writer.evaluate(
      ({ key, draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw }) => {
        const io = {
          async writeLocal(snapshot) {
            localStorage.setItem(key, JSON.stringify(snapshot));
            localStorage.setItem(draftKey, newerDraftRaw);
            localStorage.setItem(checkpointKey, newerCheckpointRaw);
          },
          async writeIdb() {
            await new Promise(() => {});
          },
        };
        window.__interruptedDraftTransaction = window.__testFinalizeCurrentProgram(io);
      },
      { key: KEY, draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw }
    );
    await writer.waitForFunction(
      ({ key, marker }) => {
        const snapshot = JSON.parse(localStorage.getItem(key) || "null");
        return snapshot?.[marker]?.version === 1;
      },
      { key: KEY, marker: "_storageDraftTransaction" },
      { timeout: 10000 }
    );
    const interrupted = await readRuntime(writer);
    check(
      interrupted.local?.programMeta?.name === "Beginner program" &&
        interrupted.local?._storageDraftTransaction?.previous?.programMeta?.name === before.local?.programMeta?.name &&
        domainSnapshot(interrupted.idb) === domainSnapshot(before.idb) &&
        interrupted.draftRaw === newerDraftRaw,
      "precondition: one provisional replica carries its exact rollback head",
      {
        localName: interrupted.local?.programMeta?.name,
        rollbackName: interrupted.local?._storageDraftTransaction?.previous?.programMeta?.name,
        idbName: interrupted.idb?.programMeta?.name,
      }
    );

    await writer.close();
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const toastText = await recovered.locator("#toast").innerText();
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.local?._storageRevision === final.idb?._storageRevision &&
        !("_storageDraftTransaction" in final.local) &&
        !("_storageDraftTransaction" in final.idb),
      "boot uses the prepared marker to durably compensate and heal both replicas",
      {
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        localRevision: final.local?._storageRevision,
        idbRevision: final.idb?._storageRevision,
      }
    );
    check(
      final.draftRaw === newerDraftRaw && /retry|try again/i.test(toastText),
      "interrupted compensation preserves the newer draft and reports rejection",
      { draftMatches: final.draftRaw === newerDraftRaw, toastText }
    );
  } finally {
    await context.close();
  }
}

async function runSuccessfulClearPublicationRace(browser) {
  console.log("\n18. An uncoordinated candidate published inside successful removal is quarantined");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const confirmedDraftRaw = await seedScenario(page, draft("confirmed-successful-clear-race", "108.75"));
    const newerDraftRaw = await nextDraftRaw(page, "128.75", "successful-clear-race");
    const newerCheckpointRaw = acknowledgedCheckpointRaw(newerDraftRaw, "successful-clear-race");
    const before = await readRuntime(page);
    const observed = await page.evaluate(
      async ({ key, draftKey, checkpointKey, newerDraftRaw, newerCheckpointRaw }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalSetItem = Storage.prototype.setItem;
        let injected = false;
        let markerPresent = false;
        let draftRawAfterRemoval = null;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!injected && candidate === draftKey) {
            injected = true;
            const provisional = JSON.parse(localStorage.getItem(key) || "null");
            markerPresent = provisional?._storageDraftTransaction?.version === 1;
            originalSetItem.call(this, draftKey, newerDraftRaw);
            originalSetItem.call(this, checkpointKey, newerCheckpointRaw);
            draftRawAfterRemoval = localStorage.getItem(draftKey);
          }
          return removed;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, injected, markerPresent, draftRawAfterRemoval };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
        }
      },
      { key: KEY, draftKey: DRAFT, checkpointKey: DRAFT_CHECKPOINT, newerDraftRaw, newerCheckpointRaw }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(page);
    const recovery = final.recoveryRaw == null ? null : JSON.parse(final.recoveryRaw);

    check(
      observed.injected && observed.markerPresent && observed.draftRawAfterRemoval === newerDraftRaw,
      "precondition: the fault bypasses the shared-lock adapter while the destructive transaction is provisional",
      observed
    );
    check(observed.result?.draftConflict === true, "the uncoordinated publication is rejected as draftConflict", observed.result);
    check(
        domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.draftRaw === confirmedDraftRaw &&
        recovery?.raw === newerDraftRaw &&
        final.persistenceArtifacts.length === 0,
      "compensation restores the acknowledged draft and quarantines the uncoordinated candidate",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        acknowledgedDraftRestored: final.draftRaw === confirmedDraftRaw,
        candidateRecovered: recovery?.raw === newerDraftRaw,
        finalLoad: storedDraftLoad(final.draftRaw),
        expectedLoad: storedDraftLoad(newerDraftRaw),
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runStaleTabSaveDuringSuccessfulClear(browser) {
  console.log("\n19. A stale tab saveDraft during successful removal is queued without loss");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-stale-tab-save", "110"));
    const before = await readRuntime(writer);
    const stale = await openStalePopup(context, writer, "draft-conflict-stale-tab");
    // The stale tab's save is a DraftV2 successor of the acknowledged workout.
    const staleRaw = await nextDraftRaw(writer, "131.25", "stale-tab-save");
    await stale.evaluate((draftPendingPrefix) => {
      const originalSetItem = Storage.prototype.setItem;
      window.__draftConflictQueuedSidecarKeys = new Set();
      window.__draftConflictRestoreSidecarCapture = () => {
        Storage.prototype.setItem = originalSetItem;
        delete window.__draftConflictRestoreSidecarCapture;
      };
      Storage.prototype.setItem = function (candidate) {
        if (typeof candidate === "string" && candidate.startsWith(draftPendingPrefix)) {
          window.__draftConflictQueuedSidecarKeys.add(candidate);
        }
        return originalSetItem.apply(this, arguments);
      };
    }, DRAFT_PENDING_PREFIX);

    const observed = await writer.evaluate(
      async ({ key, draftKey, staleRaw }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        let saveDispatched = false;
        let markerPresent = false;
        let draftRawAfterSave = null;
        let queuedWriteCount = 0;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!saveDispatched && candidate === draftKey) {
            const provisional = JSON.parse(localStorage.getItem(key) || "null");
            markerPresent = provisional?._storageDraftTransaction?.version === 1;
            const staleTab = window.__draftConflictStaleTab;
            if (staleTab?.__repforgeWorkoutDraft?.stageLegacy("draft-write", staleRaw)) {
              saveDispatched = true;
              draftRawAfterSave = staleTab.localStorage.getItem(draftKey);
              queuedWriteCount = staleTab.__draftConflictQueuedSidecarKeys.size;
            }
          }
          return removed;
        };
        try {
          const result = await window.__testFinalizeCurrentProgram();
          return { result, saveDispatched, markerPresent, draftRawAfterSave, queuedWriteCount };
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          window.__draftConflictStaleTab?.__draftConflictRestoreSidecarCapture?.();
        }
      },
      { key: KEY, draftKey: DRAFT, staleRaw }
    );
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const final = await readRuntime(writer);
    const finalLoad = storedDraftLoad(final.draftRaw);
    const recovery = final.recoveryRaw == null ? null : JSON.parse(final.recoveryRaw);
    const recoveredStaleLoad = storedDraftLoad(recovery?.raw);

    check(
      observed.saveDispatched &&
        observed.markerPresent &&
        observed.draftRawAfterSave === null &&
        observed.queuedWriteCount === 1,
      "precondition: the stale tab's draft-write queues instead of publishing while the transaction is provisional",
      observed
    );
    check(
      observed.result?.draftConflict === true,
      "stale-tab save causes compensation instead of accepting an incompatible program",
      observed.result
    );
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.draftRaw === staleRaw &&
        final.recoveryRaw === null &&
        final.persistenceArtifacts.length === 0,
      "compensation restores the program and promotes the queued stale-tab successor without loss",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        acknowledgedLoad: finalLoad,
        recoveredStaleLoad,
        recoveryReason: recovery?.reason,
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
  } finally {
    await context.close();
  }
}

async function runQueuedStaleTabUnloadRecovery(browser) {
  console.log("\n20. Boot recovers a queued stale-tab draft after interrupted compensation");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const confirmedDraftRaw = await seedScenario(writer, draft("confirmed-queued-unload", "112.5"));
    const before = await readRuntime(writer);
    const stale = await openStalePopup(context, writer, "draft-conflict-unload-stale-tab");
    const staleRaw = await nextDraftRaw(writer, "133.75", "stale-tab-unload");

    const result = await writer.evaluate(
      async ({ key, draftKey, staleRaw }) => {
        const originalRemoveItem = Storage.prototype.removeItem;
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        let stateWrites = 0;
        let idbWrites = 0;
        let saveDispatched = false;
        Storage.prototype.removeItem = function (candidate) {
          const removed = originalRemoveItem.apply(this, arguments);
          if (!saveDispatched && candidate === draftKey) {
            const staleTab = window.__draftConflictStaleTab;
            if (staleTab?.__repforgeWorkoutDraft?.stageLegacy("draft-write", staleRaw)) {
              saveDispatched = true;
            }
          }
          return removed;
        };
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key && ++stateWrites > 1) {
            throw new Error("audit: interrupt local compensation");
          }
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key && ++idbWrites > 1) {
            throw new Error("audit: interrupt IDB compensation");
          }
          return originalPut.apply(this, arguments);
        };
        try {
          return await window.__testFinalizeCurrentProgram();
        } finally {
          Storage.prototype.removeItem = originalRemoveItem;
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY, draftKey: DRAFT, staleRaw }
    );
    const interrupted = await readRuntime(writer);
    check(
      result?.draftConflict === true &&
        result.compensationPending === true &&
        interrupted.local?._storageDraftTransaction?.version === 1 &&
        interrupted.idb?._storageDraftTransaction?.version === 1 &&
        interrupted.draftRaw === null &&
        interrupted.pendingEntries.length === 1 &&
        interrupted.draftPendingEntries.length === 1,
      "precondition: failed compensation retains the provisional marker, state journal, and queued draft",
      {
        result,
        localTransaction: interrupted.local?._storageDraftTransaction?.version,
        idbTransaction: interrupted.idb?._storageDraftTransaction?.version,
        draftRaw: interrupted.draftRaw,
        pendingCount: interrupted.pendingEntries.length,
        pendingDraftCount: interrupted.draftPendingEntries.length,
      }
    );

    await stale.close();
    await writer.close();
    const recovered = await openApp(context);
    const final = await readRuntime(recovered);
    const finalLoad = storedDraftLoad(final.draftRaw);
    const recovery = final.recoveryRaw == null ? null : JSON.parse(final.recoveryRaw);
    const recoveredStaleLoad = storedDraftLoad(recovery?.raw);
    const toastText = await recovered.locator("#toast").innerText();
    check(
      domainSnapshot(final.local) === domainSnapshot(before.local) &&
        domainSnapshot(final.idb) === domainSnapshot(before.idb) &&
        final.local?._storageRevision === final.idb?._storageRevision &&
        final.draftRaw === staleRaw && final.recoveryRaw === null &&
        final.persistenceArtifacts.length === 0,
      "boot durably compensates and promotes the queued stale-tab successor without loss",
      {
        beforeName: before.local?.programMeta?.name,
        localName: final.local?.programMeta?.name,
        idbName: final.idb?.programMeta?.name,
        activeLoad: finalLoad,
        recoveredStaleLoad,
        recoveryReason: recovery?.reason,
        pendingCount: final.pendingEntries.length,
        pendingDraftCount: final.draftPendingEntries.length,
        artifacts: final.persistenceArtifacts,
      }
    );
    check(/retry|try again/i.test(toastText), "queued unload recovery reports the rejected replacement", toastText);
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("Program destructive-draft conflict regressions");
  console.log(`Target: ${BASE}`);
  const browser = await launchChromium();
  try {
    await runTemplateConflict(browser);
    await runFinalizeConflict(browser);
    await runSaveProgramConflict(browser);
    await runNormalProgramImportConflict(browser);
    await runOnboardingProgramImportConflict(browser);
    await runDeleteExerciseConflict(browser);
    await runDeleteDayConflict(browser);
    await runBackupReplaceConflict(browser);
    await runDeleteLogConflict(browser);
    await runIndependentlyRemovedDraft(browser);
    await runBootDestructiveConflict(browser);
    await runDraftCreatedAfterConfirmation(browser);
    await runLocalReplicaWriteRace(browser);
    await runBootReplayLocalReplicaWriteRace(browser);
    await runOneStoreReplicaWriteRaces(browser);
    await runCrossStoreCompensationRecovery(browser);
    await runEffectApplicationRace(browser);
    await runPreparedTransactionUnloadRecovery(browser);
    await runSuccessfulClearPublicationRace(browser);
    await runStaleTabSaveDuringSuccessfulClear(browser);
    await runQueuedStaleTabUnloadRecovery(browser);
  } finally {
    await browser.close();
  }
  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
