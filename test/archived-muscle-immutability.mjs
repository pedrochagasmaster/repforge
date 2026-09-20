#!/usr/bin/env node
/**
 * Plan 052/056 regression: a current custom-definition edit may update the
 * active linked program, but it must never rewrite an archived snapshot or its
 * compact planned-volume attribution during a write or a later boot.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertServingApp, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const DB_NAME = "repforge";
const CUSTOM_ID = "custom:archive-muscle";
const CLOCK_KEY = "repforge_test_clock_v1";
const PRE_ARCHIVE_CLOCK = "2026-09-01T12:00:00.000Z";
const INITIAL_CLOCK = "2026-09-10T12:00:00.000Z";
const FUTURE_CLOCK = "2026-10-10T12:00:00.000Z";
const BEYOND_BLOCK_CLOCK = "2027-01-01T12:00:00.000Z";

function row(id, primary, secondary) {
  return {
    id,
    day: "Day 1",
    order: 1,
    name: "Archive muscle test",
    libraryId: CUSTOM_ID,
    movementId: `library:${CUSTOM_ID}`,
    sets: 3,
    min: 8,
    max: 12,
    primary,
    secondary,
    notes: "",
    alternates: [],
  };
}

function plannedVolumeHistory() {
  return {
    schemaVersion: 1,
    throughWeek: 1,
    plannedSessions: 1,
    plannedWorkingSets: 3,
    muscles: {
      direct: { Chest: 18 },
      secondary: { Triceps: 9 },
    },
  };
}

function sparseReceiptStructure(slotId) {
  return {
    schemaVersion: 1,
    days: [{ dayId: "day-1", label: "Day 1", order: 1 }],
    weekPrescriptions: [{
      week: 2,
      phase: "deload",
      days: [{
        dayId: "day-1",
        slots: [{ slotId, sets: 2, primary: "Chest", secondary: "Triceps" }],
      }],
    }],
  };
}

function fullReceiptStructure(slotId) {
  return {
    schemaVersion: 1,
    days: [{ dayId: "day-1", label: "Day 1", order: 1 }],
    weekPrescriptions: Array.from({ length: 6 }, (_, index) => ({
      week: index + 1,
      phase: "normal",
      days: [{
        dayId: "day-1",
        slots: [{ slotId, sets: 3, primary: "Chest", secondary: "Triceps" }],
      }],
    })),
  };
}

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

async function writeMirroredState(page, state) {
  await page.evaluate(async ({ key, dbName, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
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
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        resolve(null);
        return;
      }
      const get = db.transaction("kv", "readonly").objectStore("kv").get(key);
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? null);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
  }), { key: KEY, dbName: DB_NAME });
}

async function readFacts(page) {
  return page.evaluate((key) => {
    const structureAttribution = (structure) => {
      const receipt = structure?.weekPrescriptions?.find((entry) => entry.week === 2);
      const slot = receipt?.days?.flatMap((day) => day.slots || [])
        .find((entry) => entry.slotId === "archived-slot" || entry.slotId === "active-slot");
      return { primary: slot?.primary, secondary: slot?.secondary };
    };
    const state = window.__repforgeWorkoutDraft.state();
    const archive = state.programHistory?.[0];
    const history = archive?.meta?.plannedVolumeHistory || archive?.programMeta?.plannedVolumeHistory || null;
    return {
      valid: window.__repforgeValidateStateShape(state),
      custom: state.customExercises?.find((entry) => entry.id === "custom:archive-muscle") || null,
      active: state.program?.find((entry) => entry.libraryId === "custom:archive-muscle") || null,
      activeVolume: state.programMeta?.plannedVolumeHistory || null,
      archived: archive?.program?.find((entry) => entry.libraryId === "custom:archive-muscle") || null,
      archivedVolume: history,
      activeStructure: structureAttribution(state.programMeta?.programStructure),
      archivedStructure: structureAttribution(archive?.meta?.programStructure || archive?.programMeta?.programStructure),
      raw: JSON.parse(localStorage.getItem(key) || "null"),
    };
  }, KEY);
}

async function exportBackup(page) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportJson").click(),
  ]);
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

function archiveVolume(snapshot) {
  const archive = snapshot?.programHistory?.[0];
  return archive?.meta?.plannedVolumeHistory || archive?.programMeta?.plannedVolumeHistory || null;
}

async function main() {
  await assertServingApp(BASE);
  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
    serviceWorkers: "block",
  });
  await installClock(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const base = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
    const state = {
      ...base,
      program: [row("active-slot", "Chest", "Triceps")],
      programMeta: {
        ...(base.programMeta || {}),
        id: "archive-muscle-active",
        name: "Archive muscle active",
        started: "2026-09-10",
        created: "2026-09-10T00:00:00.000Z",
        updated: "2026-09-10T00:00:00.000Z",
        onboarded: true,
        daysPerWeek: 1,
        mesocycleLengthWeeks: 6,
        mesocycleStatus: "active",
        blockId: "archive-muscle-block",
        programStructure: sparseReceiptStructure("active-slot"),
        plannedVolumeHistory: null,
        progressionRelations: [],
        progressionModifiers: [],
        progressionIncompatibilities: [],
      },
      customExercises: [{
        id: CUSTOM_ID,
        name: "Archive muscle test",
        namePt: "Archive muscle test",
        archived: false,
        equipment: ["machine"],
        primary: "Chest",
        secondary: "Triceps",
        notes: "",
        created: "2026-09-01T00:00:00.000Z",
      }],
      programHistory: [{
        id: "archive-muscle-predecessor",
        meta: {
          id: "archive-muscle-predecessor",
          name: "Archive muscle predecessor",
          started: "2026-09-01",
          created: "2026-09-01T00:00:00.000Z",
          updated: "2026-09-01T00:00:00.000Z",
          onboarded: true,
          mesocycleLengthWeeks: 6,
          mesocycleStatus: "active",
          plannedVolumeHistory: plannedVolumeHistory(),
          programStructure: sparseReceiptStructure("archived-slot"),
        },
        program: [row("archived-slot", "Chest", "Triceps")],
        completedAt: "2026-09-10T00:00:00.000Z",
        review: null,
      }],
      log: [],
      _storageRevision: 1,
    };
    await writeMirroredState(page, state);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const before = await readFacts(page);
    assert.equal(before.valid, true, "seeded archive state is valid");
    assert.deepEqual(archiveFacts(before.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "archive starts with the captured canonical facts");
    assert.deepEqual(before.activeStructure, { primary: "Chest", secondary: "Triceps" });
    assert.deepEqual(before.archivedStructure, { primary: "Chest", secondary: "Triceps" });

    const saved = await page.evaluate(async () => {
      const result = await window.__repforgeSaveCustomExercise({
        id: "custom:archive-muscle",
        name: "Archive muscle test",
        equipment: ["machine"],
        primary: "Lats",
        secondary: "Biceps",
        notes: "",
      });
      await window.__repforgeStorage.flush();
      return result.result;
    });
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
    assert.deepEqual(afterWrite.activeStructure, { primary: "Lats", secondary: "Biceps" },
      "active structure follows the current custom definition");
    assert.deepEqual(afterWrite.archivedStructure, { primary: "Chest", secondary: "Triceps" },
      "archived structure receipt keeps its captured attribution");
    assert.deepEqual(archiveFacts(afterWrite.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "both durable write replicas keep the archive internally consistent");

    const idbAfterWrite = await readIdbState(page);
    assert.deepEqual(archiveFacts(idbAfterWrite), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "IndexedDB keeps the immutable archive facts");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterReload = await readFacts(page);
    assert.equal(afterReload.valid, true, "reloaded state remains valid");
    assert.equal(afterReload.custom.primary, "Lats");
    assert.equal(afterReload.active.primary, "Lats");
    assert.equal(afterReload.archived.primary, "Chest", "boot normalization does not reinterpret the archive");
    assert.equal(afterReload.archived.secondary, "Triceps");
    assert.deepEqual(afterReload.activeStructure, { primary: "Lats", secondary: "Biceps" });
    assert.deepEqual(afterReload.archivedStructure, { primary: "Chest", secondary: "Triceps" });
    assert.deepEqual(archiveFacts(afterReload.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "reload preserves archived attribution and compact volume");

    // A real replacement must capture the current custom attribution exactly
    // once. The successor intentionally uses a built-in so the custom
    // definition becomes history-only and exercises the archive-retention
    // branch of deleteCustomExercise as well.
    const transitionState = JSON.parse(JSON.stringify(state));
    transitionState.program = [row("real-active-slot", "Chest", "Triceps")];
    transitionState.programMeta = {
      ...transitionState.programMeta,
      id: "archive-muscle-real-active",
      name: "Archive muscle real active",
      started: "2026-09-01",
      blockId: "archive-muscle-real-block",
      programStructure: sparseReceiptStructure("real-active-slot"),
      plannedVolumeHistory: null,
    };
    transitionState.programHistory = [];
    transitionState._storageRevision = 1;
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: CLOCK_KEY, value: PRE_ARCHIVE_CLOCK });
    await writeMirroredState(page, transitionState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(({ key, value }) => {
      globalThis.__repforgeTestNow = value;
      localStorage.setItem(key, value);
    }, { key: CLOCK_KEY, value: INITIAL_CLOCK });

    const finalized = await page.evaluate(async () => {
      const result = await window.__repforgeFinalizeProgramSetup({
        exercises: [{
          id: "successor-slot",
          day: "Day 1",
          order: 1,
          name: "Barbell back squat",
          libraryId: "sq_bb",
          movementId: "library:sq_bb",
          sets: 3,
          min: 8,
          max: 12,
          primary: "",
          secondary: "",
          notes: "",
          alternates: [],
        }],
        name: "Archive muscle successor",
        answers: { goal: "muscle_growth", daysPerWeek: 1 },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
        telemetryRoute: "custom",
        entrySource: { route: "custom", fingerprint: "archive-muscle-real" },
      });
      await window.__repforgeStorage.flush();
      return result;
    });
    assert.equal(finalized.committed, true, "real program replacement commits");
    assert.equal(finalized.localOk, true);
    assert.equal(finalized.idbOk, true);

    const realBeforeEdit = await readFacts(page);
    const archiveAtBoundary = realBeforeEdit.archivedVolume;
    assert.deepEqual(archiveAtBoundary, {
      schemaVersion: 1,
      throughWeek: 1,
      plannedSessions: 1,
      plannedWorkingSets: 3,
      muscles: { direct: { Chest: 3 }, secondary: { Triceps: 1.5 } },
    }, "real early predecessor archive records the exact boundary horizon");
    assert.equal(realBeforeEdit.archived.primary, "Chest");
    assert.equal(realBeforeEdit.archived.secondary, "Triceps");
    assert.deepEqual(archiveFacts(realBeforeEdit.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 3,
      secondaryVolume: 1.5,
    }, "real archive captures the current attribution and compact volume");
    assert.equal(realBeforeEdit.active, null, "successor no longer links the custom exercise");

    const backup = await exportBackup(page);

    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: CLOCK_KEY, value: FUTURE_CLOCK });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const futureBoot = await readFacts(page);
    assert.deepEqual(futureBoot.archivedVolume, archiveAtBoundary,
      "future boot does not advance the frozen archived planned-volume aggregate");
    assert.deepEqual(archiveVolume(futureBoot.raw), archiveAtBoundary,
      "future boot leaves the complete raw localStorage aggregate at the archive boundary");

    const realEdit = await page.evaluate(async () => {
      const result = await window.__repforgeSaveCustomExercise({
        id: "custom:archive-muscle",
        name: "Archive muscle test",
        equipment: ["machine"],
        primary: "Lats",
        secondary: "Biceps",
        notes: "",
      });
      await window.__repforgeStorage.flush();
      return result.result;
    });
    assert.equal(realEdit.localOk, true);
    assert.equal(realEdit.idbOk, true);
    const realAfterEdit = await readFacts(page);
    assert.equal(realAfterEdit.archived.primary, "Chest");
    assert.equal(realAfterEdit.archived.secondary, "Triceps");
    assert.deepEqual(archiveFacts(realAfterEdit.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 3,
      secondaryVolume: 1.5,
    }, "editing the current definition never rewrites a real archive");
    assert.deepEqual(archiveFacts(await readIdbState(page)), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 3,
      secondaryVolume: 1.5,
    }, "the real archive remains immutable in IndexedDB");
    assert.deepEqual(archiveVolume(realAfterEdit.raw), archiveAtBoundary,
      "the unrelated write keeps the complete localStorage aggregate unchanged");
    assert.deepEqual(archiveVolume(await readIdbState(page)), archiveAtBoundary,
      "the unrelated write keeps the complete IndexedDB aggregate unchanged");

    assert.deepEqual((await readFacts(page)).archivedVolume, archiveAtBoundary,
      "an unrelated durable write cannot persist time-inflated archive volume");

    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: CLOCK_KEY, value: BEYOND_BLOCK_CLOCK });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const beyondBlock = await readFacts(page);
    assert.deepEqual(beyondBlock.archivedVolume, archiveAtBoundary,
      "reload beyond the predecessor block end remains idempotent");

    const backupContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      timezoneId: "UTC",
      serviceWorkers: "block",
    });
    await installClock(backupContext);
    const backupPage = await backupContext.newPage();
    try {
      await backupPage.goto(BASE, { waitUntil: "domcontentloaded" });
      await waitForAppBoot(backupPage, { base: BASE });
      await backupPage.evaluate(({ key, value }) => localStorage.setItem(key, value),
        { key: CLOCK_KEY, value: FUTURE_CLOCK });
      await backupPage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(backupPage, { base: BASE });
      await importBackupThroughUi(backupPage, backup);
      const imported = await readFacts(backupPage);
      assert.deepEqual(imported.archivedVolume, archiveAtBoundary,
        "backup replacement preserves the frozen archive at a future date");
      assert.deepEqual(archiveVolume(await readIdbState(backupPage)), archiveAtBoundary,
        "backup replacement preserves the complete frozen archive in IndexedDB");
      await backupPage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(backupPage, { base: BASE });
      assert.deepEqual((await readFacts(backupPage)).archivedVolume, archiveAtBoundary,
        "reloaded backup remains frozen");
    } finally {
      await backupContext.close();
    }

    const deletedHistoryOnly = await page.evaluate(async () => {
      const result = await window.__repforgeDeleteCustomExercise("custom:archive-muscle");
      await window.__repforgeStorage.flush();
      return result;
    });
    assert.equal(deletedHistoryOnly.archived, true, "history-only custom definition is archived, not deleted");
    const afterHistoryOnlyDelete = await readFacts(page);
    assert.equal(afterHistoryOnlyDelete.custom.archived, true);
    assert.deepEqual(archiveFacts(afterHistoryOnlyDelete.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 3,
      secondaryVolume: 1.5,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterRealReload = await readFacts(page);
    assert.equal(afterRealReload.custom.archived, true);
    assert.deepEqual(archiveFacts(afterRealReload.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 3,
      secondaryVolume: 1.5,
    }, "real archive and history-only definition survive reload");

    const activeControlState = JSON.parse(JSON.stringify(transitionState));
    activeControlState.program = [row("active-control-slot", "Chest", "Triceps")];
    activeControlState.programMeta = {
      ...activeControlState.programMeta,
      id: "archive-volume-active-control",
      blockId: "archive-volume-active-control-block",
      started: "2026-09-01",
      mesocycleStatus: "active",
      plannedVolumeHistory: null,
      programStructure: sparseReceiptStructure("active-control-slot"),
    };
    activeControlState.programHistory = [];
    activeControlState._storageRevision = 1;
    await page.evaluate((key) => localStorage.setItem(key, "2026-09-10T12:00:00.000Z"), CLOCK_KEY);
    await writeMirroredState(page, activeControlState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const activeAtStart = await readFacts(page);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: CLOCK_KEY, value: FUTURE_CLOCK });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const activeLater = await readFacts(page);
    assert.ok(activeLater.activeVolume?.throughWeek > activeAtStart.activeVolume?.throughWeek,
      "active planned-volume history remains time-aware");
    assert.ok(activeLater.activeVolume?.plannedWorkingSets > activeAtStart.activeVolume?.plannedWorkingSets,
      "active planned-volume totals still advance with elapsed weeks");

    const completedState = JSON.parse(JSON.stringify(activeControlState));
    completedState.program = [row("completed-active-slot", "Chest", "Triceps")];
    completedState.programMeta = {
      ...completedState.programMeta,
      id: "archive-volume-completed-active",
      blockId: "archive-volume-completed-block",
      started: "2026-09-01",
      mesocycleStatus: "completed",
      completedAt: "2026-09-10T12:00:00.000Z",
      plannedVolumeHistory: null,
      programStructure: fullReceiptStructure("completed-active-slot"),
    };
    completedState.programHistory = [];
    completedState._storageRevision = 1;
    await page.evaluate((key) => localStorage.setItem(key, "2026-09-10T12:00:00.000Z"), CLOCK_KEY);
    await writeMirroredState(page, completedState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const completedTransition = await page.evaluate(async () => {
      const result = await window.__repforgeFinalizeProgramSetup({
        exercises: [{
          id: "completed-successor-slot",
          day: "Day 1",
          order: 1,
          name: "Barbell back squat",
          libraryId: "sq_bb",
          movementId: "library:sq_bb",
          sets: 3,
          min: 8,
          max: 12,
          primary: "",
          secondary: "",
          notes: "",
          alternates: [],
        }],
        name: "Completed successor",
        answers: { goal: "muscle_growth", daysPerWeek: 1 },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
        telemetryRoute: "custom",
        entrySource: { route: "custom", fingerprint: "archive-volume-completed" },
      });
      await window.__repforgeStorage.flush();
      return result;
    });
    assert.equal(completedTransition.committed, true, "completed predecessor replacement commits");
    const completedArchive = await readFacts(page);
    assert.deepEqual(completedArchive.archivedVolume, {
      schemaVersion: 1,
      throughWeek: 6,
      plannedSessions: 6,
      plannedWorkingSets: 18,
      muscles: { direct: { Chest: 18 }, secondary: { Triceps: 9 } },
    }, "completed predecessor archive retains the full configured horizon");
    const completedAtBoundary = completedArchive.archivedVolume;
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value),
      { key: CLOCK_KEY, value: BEYOND_BLOCK_CLOCK });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    assert.deepEqual((await readFacts(page)).archivedVolume, completedAtBoundary,
      "completed predecessor archive remains immutable after future reloads");
    assert.deepEqual(errors, [], "archive edit flow emits no page errors");
  } finally {
    await context.close();
    await browser.close();
  }

  console.log("archived muscle immutability: active edits, real archive creation, and reload pass");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
