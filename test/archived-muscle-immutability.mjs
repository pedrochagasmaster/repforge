#!/usr/bin/env node
/**
 * Plan 052/056 regression, on the canonical program model: a current
 * custom-definition edit may update the active linked program, but it must
 * never rewrite an archived snapshot or the compact planned-volume aggregate it
 * carries — during a write, a later boot, a backup round trip, or the deletion
 * of the definition. A real replacement captures the definition's attribution
 * at the archive boundary exactly once.
 *
 * Retired with Plan 067: the programStructure week receipts that projected a
 * time-aware planned-volume aggregate for the active block (canonical programs
 * carry no programStructure, so nothing computes one).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertServingApp, launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const DB_NAME = "repforge";
const CUSTOM_ID = "custom:archive-muscle";
const CLOCK_KEY = "repforge_test_clock_v1";
const PRE_ARCHIVE_CLOCK = "2026-09-01T12:00:00.000Z";
const INITIAL_CLOCK = "2026-09-10T12:00:00.000Z";
const DEFERRED_SAVE_CLOCK = "2026-09-15T12:00:00.000Z";
const FUTURE_CLOCK = "2026-10-10T12:00:00.000Z";
const BEYOND_BLOCK_CLOCK = "2027-01-01T12:00:00.000Z";
const SETS = 3;

/** The seed program's Day 1 slot `seedId`, alone, as a canonical definition. */
function seedDefinition(seedId) {
  const definition = seedProgramMeta().programDefinition;
  for (const day of definition.days) {
    day.slots = day.slots.filter((slot) => slot.id === seedId);
    day.slots.forEach((slot) => { slot.order = 1; });
    if (!day.slots.length) day.kind = "rest";
  }
  return definition;
}

/** A Weight + Reps custom definition, attributed Chest / Triceps. */
function customDefinition(primary = "Chest", secondary = "Triceps") {
  const source = seedDefinition("seed-ex-3").days[0].slots[0];
  return {
    id: CUSTOM_ID, name: "Archive muscle test", namePt: "Archive muscle test", archived: false,
    equipment: ["machine"], primary, secondary, notes: "", created: "2026-09-01T00:00:00.000Z",
    metricIds: structuredClone(source.metricIds), metricDefinitions: structuredClone(source.metricDefinitions),
  };
}

/** A one-slot canonical program whose only slot is the custom movement. */
function customProgram(slotId) {
  const definition = seedDefinition("seed-ex-3");
  const slot = definition.days[0].slots[0];
  Object.assign(slot, {
    id: slotId, exerciseId: CUSTOM_ID, sourceExerciseIds: [CUSTOM_ID], musclePurposeIds: [], movementPatternIds: [],
    metricOrigin: "user_defined", manualAttribution: { primary: "Chest", secondary: "Triceps" },
    loadingModel: { bodyweightCoefficient: null, assistanceDirection: "subtract" },
  });
  delete slot.exerciseTypeId;
  delete slot.displayName;
  for (const cycle of slot.prescriptionsByCycle) {
    const template = cycle.sets[0];
    cycle.sets = Array.from({ length: SETS }, (_, index) => ({
      ...structuredClone(template), id: `${slotId}-${cycle.cycleIndex}-${index + 1}`, setIndex: index + 1,
    }));
  }
  const row = { ...seedProgram().find((entry) => entry.id === "seed-ex-3") };
  delete row.displayName;
  Object.assign(row, {
    id: slotId, slotId, order: 1, name: "Archive muscle test", libraryId: CUSTOM_ID, sets: SETS,
    primary: "Chest", secondary: "Triceps", alternates: [],
  });
  return { definition, row };
}

const withoutDefinition = ({ programDefinition, ...meta }) => meta;

/** A frozen archive: the compact aggregate is the history, not a projection. */
function plannedVolumeHistory() {
  return {
    schemaVersion: 1, throughWeek: 1, plannedSessions: 1, plannedWorkingSets: 3,
    muscles: { direct: { Chest: 18 }, secondary: { Triceps: 9 } },
  };
}

function activeState(base, { id, slotId, started = "2026-09-10", history = [] }) {
  const { definition, row } = customProgram(slotId);
  return {
    ...base,
    program: [row],
    programMeta: {
      ...seedProgramMeta(), id, name: id, started, created: `${started}T00:00:00.000Z`, updated: `${started}T00:00:00.000Z`,
      daysPerWeek: 1, mesocycleLengthWeeks: definition.cycles, mesocycleStatus: "active", blockId: `${id}-block`,
      plannedVolumeHistory: null, programDefinition: definition,
    },
    customExercises: [customDefinition()],
    programHistory: history,
    log: [],
    _storageRevision: 1,
  };
}

/** The successor every replacement installs: one built-in slot, no custom link. */
const SUCCESSOR = seedDefinition("seed-ex-1");

async function installClock(context) {
  await context.addInitScript(({ key, initial }) => {
    globalThis.__repforgeTestNow = localStorage.getItem(key) || initial;
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [globalThis.__repforgeTestNow])); }
      static now() { return new NativeDate(globalThis.__repforgeTestNow).getTime(); }
    }
    globalThis.Date = FixedDate;
  }, { key: CLOCK_KEY, initial: INITIAL_CLOCK });
}

async function setClock(page, value) {
  await page.evaluate(({ key, value }) => {
    globalThis.__repforgeTestNow = value;
    localStorage.setItem(key, value);
  }, { key: CLOCK_KEY, value });
}

async function reboot(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function writeMirroredState(page, state) {
  await page.evaluate(async ({ key, dbName, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.removeItem("repforge_program_setup_draft_v1");
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { key: KEY, dbName: DB_NAME, value: state });
}

async function readIdbState(page) {
  return page.evaluate(async ({ key, dbName }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) { db.close(); resolve(null); return; }
      const get = db.transaction("kv", "readonly").objectStore("kv").get(key);
      get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
  }), { key: KEY, dbName: DB_NAME });
}

async function readFacts(page) {
  return page.evaluate(({ key, customId }) => {
    const state = window.__repforgeWorkoutDraft.state();
    const archive = state.programHistory?.[0];
    return {
      valid: window.__repforgeValidateStateShape(state),
      custom: state.customExercises?.find((entry) => entry.id === customId) || null,
      active: state.program?.find((entry) => entry.libraryId === customId) || null,
      archived: archive?.program?.find((entry) => entry.libraryId === customId) || null,
      archivedVolume: archive?.meta?.plannedVolumeHistory || archive?.programMeta?.plannedVolumeHistory || null,
      raw: JSON.parse(localStorage.getItem(key) || "null"),
    };
  }, { key: KEY, customId: CUSTOM_ID });
}

function archiveFacts(snapshot) {
  const archive = snapshot?.programHistory?.[0];
  const row = archive?.program?.find((entry) => entry.libraryId === CUSTOM_ID);
  const history = archive?.meta?.plannedVolumeHistory || archive?.programMeta?.plannedVolumeHistory;
  return {
    primary: row?.primary,
    secondary: row?.secondary,
    direct: history?.muscles?.direct?.Chest,
    secondaryVolume: history?.muscles?.secondary?.Triceps,
  };
}

const archiveVolume = (snapshot) =>
  snapshot?.programHistory?.[0]?.meta?.plannedVolumeHistory || snapshot?.programHistory?.[0]?.programMeta?.plannedVolumeHistory || null;

async function editCustom(page, primary, secondary) {
  return page.evaluate(async ({ id, primary, secondary }) => {
    const result = await window.__repforgeSaveCustomExercise({
      id, name: "Archive muscle test", equipment: ["machine"], primary, secondary, notes: "",
    });
    await window.__repforgeStorage.flush();
    return result.result;
  }, { id: CUSTOM_ID, primary, secondary });
}

async function replaceProgram(page, { name, origin, fingerprint }) {
  return page.evaluate(async ({ definition, name, origin, fingerprint }) => {
    const result = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name, answers: { goal: "muscle_growth", daysPerWeek: 1 },
      destination: "log", origin, draftConfirmed: true, telemetryRoute: "build",
      entrySource: { route: "build", fingerprint },
    });
    await window.__repforgeStorage.flush();
    return result;
  }, { definition: SUCCESSOR, name, origin, fingerprint });
}

async function exportBackup(page) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportJson").click()]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function importBackupThroughUi(page, backup) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "taurifer-archived-volume-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.locator("#importChoice").waitFor({ state: "visible" });
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

const CAPTURED = { primary: "Chest", secondary: "Triceps", direct: 18, secondaryVolume: 9 };

async function main() {
  await assertServingApp(BASE);
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC", serviceWorkers: "block" });
  await installClock(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const base = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
    const predecessor = customProgram("archived-slot");
    const state = activeState(base, {
      id: "archive-muscle-active", slotId: "active-slot",
      history: [{
        id: "archive-muscle-predecessor",
        meta: {
          ...withoutDefinition(seedProgramMeta()), id: "archive-muscle-predecessor", name: "Archive muscle predecessor",
          started: "2026-09-01", created: "2026-09-01T00:00:00.000Z", updated: "2026-09-01T00:00:00.000Z",
          mesocycleStatus: "active", plannedVolumeHistory: plannedVolumeHistory(),
        },
        program: [predecessor.row],
        completedAt: "2026-09-10T00:00:00.000Z",
        review: null,
      }],
    });
    await writeMirroredState(page, state);
    await reboot(page);

    const before = await readFacts(page);
    assert.equal(before.valid, true, "seeded archive state is valid");
    assert.equal(before.active?.primary, "Chest", "the active custom slot starts with the definition's attribution");
    assert.deepEqual(archiveFacts(before.raw), CAPTURED, "archive starts with the captured canonical facts");

    const saved = await editCustom(page, "Lats", "Biceps");
    assert.equal(saved.localOk, true, "custom definition edit commits to localStorage");
    assert.equal(saved.idbOk, true, "custom definition edit commits to IndexedDB");

    const afterWrite = await readFacts(page);
    assert.equal(afterWrite.valid, true, "edited state remains valid");
    assert.equal(afterWrite.custom.primary, "Lats");
    assert.equal(afterWrite.custom.secondary, "Biceps");
    assert.equal(afterWrite.active.primary, "Lats", "active linked row follows the current definition");
    assert.equal(afterWrite.active.secondary, "Biceps");
    assert.equal(afterWrite.archived.primary, "Chest", "archive row keeps its captured primary attribution");
    assert.equal(afterWrite.archived.secondary, "Triceps", "archive row keeps its captured secondary attribution");
    assert.deepEqual(archiveFacts(afterWrite.raw), CAPTURED, "localStorage keeps the archive internally consistent");
    assert.deepEqual(archiveFacts(await readIdbState(page)), CAPTURED, "IndexedDB keeps the immutable archive facts");

    await reboot(page);
    const afterReload = await readFacts(page);
    assert.equal(afterReload.valid, true, "reloaded state remains valid");
    assert.equal(afterReload.custom.primary, "Lats");
    assert.equal(afterReload.active.primary, "Lats");
    assert.equal(afterReload.archived.primary, "Chest", "boot normalization does not reinterpret the archive");
    assert.equal(afterReload.archived.secondary, "Triceps");
    assert.deepEqual(archiveFacts(afterReload.raw), CAPTURED, "reload preserves archived attribution and compact volume");

    // A real replacement captures the current custom attribution exactly once.
    // The successor is a built-in, so the definition becomes history-only and
    // exercises the archive-retention branch of deleteCustomExercise as well.
    await setClock(page, PRE_ARCHIVE_CLOCK);
    await writeMirroredState(page, activeState(base, { id: "archive-muscle-real-active", slotId: "real-active-slot", started: "2026-09-01" }));
    await reboot(page);
    await setClock(page, INITIAL_CLOCK);
    const finalized = await replaceProgram(page, { name: "Archive muscle successor", origin: "settings", fingerprint: "archive-muscle-real" });
    assert.equal(finalized.committed, true, "real program replacement commits");
    assert.equal(finalized.localOk, true);
    assert.equal(finalized.idbOk, true);

    const realBeforeEdit = await readFacts(page);
    const archiveAtBoundary = realBeforeEdit.archivedVolume;
    assert.equal(realBeforeEdit.archived?.primary, "Chest", "the archive captures the attribution current at replacement");
    assert.equal(realBeforeEdit.archived?.secondary, "Triceps");
    assert.equal(realBeforeEdit.raw.programHistory[0]?.completedAt, INITIAL_CLOCK, "the archive records its replacement boundary");
    assert.equal(realBeforeEdit.active, null, "successor no longer links the custom exercise");

    const backup = await exportBackup(page);

    await setClock(page, FUTURE_CLOCK);
    await reboot(page);
    const futureBoot = await readFacts(page);
    assert.deepEqual(futureBoot.archivedVolume, archiveAtBoundary, "a future boot does not advance the frozen archive");
    assert.deepEqual(archiveVolume(futureBoot.raw), archiveAtBoundary, "a future boot leaves the raw archive aggregate unchanged");

    const realEdit = await editCustom(page, "Lats", "Biceps");
    assert.equal(realEdit.localOk, true);
    assert.equal(realEdit.idbOk, true);
    const realAfterEdit = await readFacts(page);
    assert.equal(realAfterEdit.archived.primary, "Chest", "editing the current definition never rewrites a real archive");
    assert.equal(realAfterEdit.archived.secondary, "Triceps");
    assert.equal(archiveFacts(await readIdbState(page)).primary, "Chest", "the real archive remains immutable in IndexedDB");
    assert.deepEqual(archiveVolume(realAfterEdit.raw), archiveAtBoundary, "the unrelated write keeps the localStorage aggregate");
    assert.deepEqual(archiveVolume(await readIdbState(page)), archiveAtBoundary, "the unrelated write keeps the IndexedDB aggregate");

    await setClock(page, BEYOND_BLOCK_CLOCK);
    await reboot(page);
    assert.deepEqual((await readFacts(page)).archivedVolume, archiveAtBoundary, "reload beyond the predecessor block end is idempotent");

    const backupContext = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC", serviceWorkers: "block" });
    await installClock(backupContext);
    const backupPage = await backupContext.newPage();
    try {
      await backupPage.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(backupPage, { base: BASE });
      await setClock(backupPage, FUTURE_CLOCK);
      await reboot(backupPage);
      await importBackupThroughUi(backupPage, backup);
      const imported = await readFacts(backupPage);
      assert.equal(imported.archived?.primary, "Chest", "backup replacement preserves the archived attribution");
      assert.deepEqual(imported.archivedVolume, archiveAtBoundary, "backup replacement preserves the frozen archive at a future date");
      assert.deepEqual(archiveVolume(await readIdbState(backupPage)), archiveAtBoundary,
        "backup replacement preserves the frozen archive in IndexedDB");
      await reboot(backupPage);
      assert.deepEqual((await readFacts(backupPage)).archivedVolume, archiveAtBoundary, "reloaded backup remains frozen");
    } finally {
      await backupContext.close();
    }

    const deletedHistoryOnly = await page.evaluate(async (id) => {
      const result = await window.__repforgeDeleteCustomExercise(id);
      await window.__repforgeStorage.flush();
      return result;
    }, CUSTOM_ID);
    assert.equal(deletedHistoryOnly.archived, true, "history-only custom definition is archived, not deleted");
    const afterHistoryOnlyDelete = await readFacts(page);
    assert.equal(afterHistoryOnlyDelete.custom.archived, true);
    assert.equal(archiveFacts(afterHistoryOnlyDelete.raw).primary, "Chest");
    await reboot(page);
    const afterRealReload = await readFacts(page);
    assert.equal(afterRealReload.custom.archived, true, "the history-only definition survives reload");
    assert.equal(archiveFacts(afterRealReload.raw).primary, "Chest", "the real archive survives reload");

    // F-ARCH-05: opening block onboarding is only a deferred intent boundary.
    // The archive is written at the actual Save, not at onboarding-open time.
    const deferredState = activeState(base, { id: "archive-volume-deferred-active", slotId: "deferred-active-slot", started: "2026-09-01" });
    await setClock(page, INITIAL_CLOCK);
    await writeMirroredState(page, deferredState);
    await reboot(page);
    const deferredBeforeOpen = await readFacts(page);
    const deferredOpen = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
    assert.equal(deferredOpen.deferred, true, "block onboarding opens as a deferred transition");
    const pendingAtOpen = await page.evaluate(() => window.__repforgePendingBlock());
    assert.equal(pendingAtOpen?.oldMeta, undefined, "deferred intent does not own an archive-ready metadata snapshot");
    assert.equal(pendingAtOpen?.oldProgram, undefined, "deferred intent does not own an archive-ready program snapshot");
    assert.equal(pendingAtOpen?.oldProgramId, deferredBeforeOpen.raw.programMeta.id, "deferred intent pins predecessor identity");
    assert.equal(pendingAtOpen?.storageRevision, deferredBeforeOpen.raw._storageRevision, "deferred intent pins the opening durable revision");
    const deferredAfterOpen = await readFacts(page);
    assert.equal(deferredAfterOpen.raw.programHistory.length, 0, "opening onboarding creates no durable archive");
    assert.equal(deferredAfterOpen.raw._storageRevision, deferredBeforeOpen.raw._storageRevision, "opening onboarding does not advance durable state");

    await setClock(page, DEFERRED_SAVE_CLOCK);
    const deferredSave = await replaceProgram(page, { name: "Deferred successor", origin: "block", fingerprint: "deferred-boundary" });
    assert.equal(deferredSave.committed, true, "deferred block successor commits at Save");
    const deferredAfterSave = await readFacts(page);
    assert.equal(deferredAfterSave.raw.programHistory[0]?.completedAt, DEFERRED_SAVE_CLOCK,
      "archive completedAt records the actual deferred Save boundary");
    assert.equal(deferredAfterSave.archived?.primary, "Chest", "the deferred archive captures the custom attribution");
    assert.deepEqual(archiveFacts(await readIdbState(page)), archiveFacts(deferredAfterSave.raw),
      "both replicas hold the same deferred archive");

    // Cancel is a no-archive/no-successor control.
    await setClock(page, INITIAL_CLOCK);
    await writeMirroredState(page, activeState(base, { id: "archive-volume-cancel-active", slotId: "cancel-active-slot", started: "2026-09-01" }));
    await reboot(page);
    const cancelBefore = await readFacts(page);
    const cancelOpen = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
    assert.equal(cancelOpen.deferred, true, "cancel control opens deferred onboarding");
    await page.locator("#onbCancel").click();
    await page.locator("#entryCancelDiscard").waitFor({ state: "visible" });
    await page.locator("#entryCancelDiscard").click();
    await page.waitForFunction(() => window.__repforgePendingBlock() === null);
    assert.deepEqual((await readFacts(page)).raw, cancelBefore.raw, "cancel leaves mirrored predecessor/history/revision unchanged");
    assert.deepEqual(await readIdbState(page), cancelBefore.raw, "cancel leaves IndexedDB predecessor/history/revision unchanged");

    // A durable predecessor mutation while onboarding is open stales the intent.
    const staleState = activeState(base, { id: "archive-volume-stale-active", slotId: "stale-active-slot", started: "2026-09-01" });
    await setClock(page, INITIAL_CLOCK);
    await writeMirroredState(page, staleState);
    await reboot(page);
    const staleOpen = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
    assert.equal(staleOpen.deferred, true, "stale control opens deferred onboarding");
    const intervening = await page.evaluate(async () => {
      const next = window.__repforgeWorkoutDraft.state();
      next.settings = { ...next.settings, restSec: Number(next.settings?.restSec || 90) + 5 };
      const result = await window.__repforgeCommitProposedState(next);
      await window.__repforgeStorage.flush();
      return result;
    });
    assert.equal(intervening.localOk, true, "intervening predecessor write reaches localStorage");
    assert.equal(intervening.idbOk, true, "intervening predecessor write reaches IndexedDB");
    const staleBeforeSave = await readFacts(page);
    await setClock(page, DEFERRED_SAVE_CLOCK);
    const staleSave = await replaceProgram(page, { name: "Stale successor", origin: "block", fingerprint: "stale-boundary" });
    assert.equal(staleSave.committed, false, "durably changed predecessor is not archived by stale onboarding");
    assert.ok(staleSave.staleRevision || staleSave.stale || staleSave.duplicate || staleSave.conflict,
      "durable predecessor change returns the existing stale/conflict contract");
    const staleAfter = await readFacts(page);
    assert.equal(staleAfter.raw.programHistory.length, 0, "stale Save creates no archive");
    assert.equal(staleAfter.raw.programMeta.id, staleState.programMeta.id, "stale Save leaves the predecessor active");
    assert.equal(staleAfter.raw._storageRevision, staleBeforeSave.raw._storageRevision,
      "stale Save advances no revision beyond the intervening durable write");
    assert.deepEqual(errors, [], "archive edit flow emits no page errors");
  } finally {
    await context.close();
    await browser.close();
  }

  console.log("archived muscle immutability: active edits, real archive creation, backup, and reload pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
