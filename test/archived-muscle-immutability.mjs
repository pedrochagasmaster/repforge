#!/usr/bin/env node
/**
 * Plan 052/056 regression: a current custom-definition edit may update the
 * active linked program, but it must never rewrite an archived snapshot or its
 * compact planned-volume attribution during a write or a later boot.
 */
import assert from "node:assert/strict";
import { assertServingApp, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8000/";
const KEY = "repforge_v1";
const DB_NAME = "repforge";
const CUSTOM_ID = "custom:archive-muscle";

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
      archived: archive?.program?.find((entry) => entry.libraryId === "custom:archive-muscle") || null,
      archivedVolume: history,
      activeStructure: structureAttribution(state.programMeta?.programStructure),
      archivedStructure: structureAttribution(archive?.meta?.programStructure || archive?.programMeta?.programStructure),
      raw: JSON.parse(localStorage.getItem(key) || "null"),
    };
  }, KEY);
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

async function main() {
  await assertServingApp(BASE);
  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "UTC",
    serviceWorkers: "block",
  });
  await context.addInitScript(() => {
    globalThis.__repforgeTestNow = "2026-09-10T12:00:00.000Z";
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [globalThis.__repforgeTestNow])); }
      static now() { return new NativeDate(globalThis.__repforgeTestNow).getTime(); }
    }
    globalThis.Date = FixedDate;
  });
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
      blockId: "archive-muscle-real-block",
      programStructure: null,
      plannedVolumeHistory: plannedVolumeHistory(),
    };
    transitionState.programHistory = [];
    transitionState._storageRevision = 1;
    await writeMirroredState(page, transitionState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

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
    assert.equal(realBeforeEdit.archived.primary, "Chest");
    assert.equal(realBeforeEdit.archived.secondary, "Triceps");
    assert.deepEqual(archiveFacts(realBeforeEdit.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "real archive captures the current attribution and compact volume");
    assert.equal(realBeforeEdit.active, null, "successor no longer links the custom exercise");

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
      direct: 18,
      secondaryVolume: 9,
    }, "editing the current definition never rewrites a real archive");
    assert.deepEqual(archiveFacts(await readIdbState(page)), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "the real archive remains immutable in IndexedDB");

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
      direct: 18,
      secondaryVolume: 9,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterRealReload = await readFacts(page);
    assert.equal(afterRealReload.custom.archived, true);
    assert.deepEqual(archiveFacts(afterRealReload.raw), {
      primary: "Chest",
      secondary: "Triceps",
      direct: 18,
      secondaryVolume: 9,
    }, "real archive and history-only definition survive reload");
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
