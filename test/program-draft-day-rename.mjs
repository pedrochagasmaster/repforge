#!/usr/bin/env node
/**
 * Focused regression for renaming a training day while a workout draft is active.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const PENDING = "repforge_pending_v1";
const DB = "repforge";
const STORE = "kv";
const STORAGE_LOCK = "repforge:state-write";
const EXERCISE_ID = "rename-draft-press";
const OTHER_EXERCISE_ID = "rename-draft-row";
const SET_KEY = `${EXERCISE_ID}_1`;
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

function fixture() {
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
      id: "rename-draft-program",
      name: "Rename draft fixture",
      started: "2026-08-01",
      created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 2,
      splitType: "upper_lower",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "short",
      completedAt: null,
    },
    program: [
      {
        id: EXERCISE_ID,
        name: "Rename draft press",
        day: "Day 1",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "Triceps",
        notes: "",
        alternates: [],
      },
      {
        id: OTHER_EXERCISE_ID,
        name: "Rename draft row",
        day: "Day 2",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Back",
        secondary: "Biceps",
        notes: "",
        alternates: [],
      },
    ],
    log: [
      {
        session: "rename-history-session",
        date: "2026-08-07",
        day: "Day 1",
        name: "Rename draft press",
        exerciseId: EXERCISE_ID,
        set: 1,
        load: 80,
        reps: 8,
        rir: 2,
        notes: "",
        created: "2026-08-07T12:00:00.000Z",
        primary: "Chest",
        secondary: "Triceps",
      },
    ],
    programHistory: [],
    _storageRevision: 1,
  };
}

function progressDraft() {
  return {
    __day: "Day 1",
    __date: "2026-08-14",
    __bodyweight: "81.25",
    __sessionNotes: "day-rename-marker",
    __contextTouched: {
      day: true,
      date: true,
      sessionNotes: true,
      bodyweight: true,
    },
    __done: [],
    __touched: [SET_KEY],
    __warm: [],
    __skipped: [],
    __substituted: {},
    __exnotes: { [EXERCISE_ID]: "marker-note" },
    [`${SET_KEY}_load`]: "92.5",
    [`${SET_KEY}_reps`]: "7",
    [`${SET_KEY}_rir`]: "1.5",
  };
}

function renameDraftRaw(raw, nextDay) {
  const draft = JSON.parse(raw);
  draft.__day = nextDay;
  return JSON.stringify(draft);
}

function sameDraftExceptDay(beforeRaw, afterRaw, expectedDay) {
  if (beforeRaw == null || afterRaw == null) return false;
  const before = JSON.parse(beforeRaw);
  const after = JSON.parse(afterRaw);
  const actualDay = after.__day;
  delete before.__day;
  delete after.__day;
  return actualDay === expectedDay && JSON.stringify(after) === JSON.stringify(before);
}

function renamedSnapshot(snapshot) {
  return (
    snapshot?.program?.some((exercise) => exercise.id === EXERCISE_ID && exercise.day === "Push Day") &&
    !snapshot?.program?.some((exercise) => exercise.day === "Day 1") &&
    snapshot?.log?.some((row) => row.session === "rename-history-session" && row.day === "Push Day") &&
    !snapshot?.log?.some((row) => row.day === "Day 1")
  );
}

function stateHasEffectMetadata(snapshot) {
  return Object.prototype.hasOwnProperty.call(snapshot || {}, "effect");
}

async function waitForApp(page) {
  await page.waitForFunction(
    () =>
      typeof window.__repforgeStorage?.flush === "function" &&
      typeof window.__repforgeEnterWorkout === "function",
    { timeout: 15000 }
  );
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
  await page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

async function reloadApp(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return page;
}

async function ensureWorkoutOpen(page) {
  if (!(await page.locator("#workoutShell").isVisible())) {
    await page.click("#viewExercises");
  }
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
}

async function seedScenario(page, draftRaw) {
  const state = fixture();
  await page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName, state, draftRaw }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem(draftKey, draftRaw);
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const storageKey = localStorage.key(index);
        if (storageKey === pendingKey || storageKey?.startsWith(`${pendingKey}:`)) {
          localStorage.removeItem(storageKey);
        }
      }
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
      pendingKey: PENDING,
      dbName: DB,
      storeName: STORE,
      state,
      draftRaw,
    }
  );
  await reloadApp(page);
}

async function readRuntime(page) {
  return page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName }) => {
      const localRaw = localStorage.getItem(key);
      const local = localRaw == null ? null : JSON.parse(localRaw);
      const draftRaw = localStorage.getItem(draftKey);
      const draft = draftRaw == null ? null : JSON.parse(draftRaw);
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
      const pendingEntries = [];
      for (let index = 0; index < localStorage.length; index++) {
        const storageKey = localStorage.key(index);
        if (storageKey !== pendingKey && !storageKey?.startsWith(`${pendingKey}:`)) continue;
        const raw = localStorage.getItem(storageKey);
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          value = { __invalid: true };
        }
        pendingEntries.push({ key: storageKey, raw, value });
      }
      pendingEntries.sort((a, b) => a.key.localeCompare(b.key));
      return { localRaw, local, idb, draftRaw, draft, pendingEntries };
    },
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE }
  );
}

async function openProgramEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  const editorHidden = await page.locator("#programEditorWrap").evaluate((element) =>
    element.classList.contains("is-hidden")
  );
  if (editorHidden) await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
}

async function dispatchRename(page, oldDay, nextDay) {
  await page.evaluate(
    ({ oldDay, nextDay }) => {
      const input = [...document.querySelectorAll('[data-act="renameDay"]')].find(
        (candidate) => candidate.dataset.day === oldDay
      );
      if (!input) throw new Error(`rename input missing for ${oldDay}`);
      input.value = nextDay;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { oldDay, nextDay }
  );
}

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.__renameDraftReleaseLock = release;
    window.__renameDraftLockHeld = false;
    window.__renameDraftLockDone = navigator.locks.request(lockName, async () => {
      window.__renameDraftLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__renameDraftLockHeld === true, { timeout: 10000 });
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__renameDraftReleaseLock?.();
    await window.__renameDraftLockDone;
  });
}

async function waitForPendingStorageLock(page) {
  await page.waitForFunction(
    async (lockName) => {
      const lockState = await navigator.locks.query();
      return lockState.pending.some((lock) => lock.name === lockName);
    },
    STORAGE_LOCK,
    { timeout: 10000 }
  );
}

async function runAcceptedRename(browser) {
  console.log("\n1. Accepted rename preserves and restores the exact draft");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const dialogs = [];
  try {
    const page = await openApp(context);
    page.on("dialog", async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss();
    });
    const draftRaw = JSON.stringify(progressDraft());
    const expectedDraftRaw = renameDraftRaw(draftRaw, "Push Day");
    await seedScenario(page, draftRaw);
    const seeded = await readRuntime(page);
    const expectedRevision = (seeded.local?._storageRevision ?? 0) + 1;

    await openProgramEditor(page);
    await dispatchRename(page, "Day 1", "Push Day");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const accepted = await readRuntime(page);

    check(
      renamedSnapshot(accepted.local) && renamedSnapshot(accepted.idb),
      "one accepted rename updates program exercises and historical rows in both replicas",
      {
        localProgramDays: accepted.local?.program?.map((exercise) => exercise.day),
        localLogDays: accepted.local?.log?.map((row) => row.day),
        idbProgramDays: accepted.idb?.program?.map((exercise) => exercise.day),
        idbLogDays: accepted.idb?.log?.map((row) => row.day),
      }
    );
    check(
      accepted.local?._storageRevision === expectedRevision &&
        accepted.idb?._storageRevision === expectedRevision,
      "rename commits exactly one durable revision",
      {
        beforeRevision: seeded.local?._storageRevision,
        expectedRevision,
        localRevision: accepted.local?._storageRevision,
        idbRevision: accepted.idb?._storageRevision,
      }
    );
    check(
      accepted.draftRaw === expectedDraftRaw &&
        sameDraftExceptDay(draftRaw, accepted.draftRaw, "Push Day"),
      "accepted rename preserves every draft field while replacing only __day",
      {
        before: draftRaw,
        after: accepted.draftRaw,
        expected: expectedDraftRaw,
      }
    );
    check(
      accepted.pendingEntries.length === 0,
      "accepted rename drains its single pending journal",
      accepted.pendingEntries
    );
    check(
      !stateHasEffectMetadata(accepted.local) && !stateHasEffectMetadata(accepted.idb),
      "draft effect metadata never enters app state",
      {
        localKeys: Object.keys(accepted.local || {}),
        idbKeys: Object.keys(accepted.idb || {}),
      }
    );

    await reloadApp(page);
    const restoredUi = await page.evaluate(
      ({ exerciseId, setKey }) => ({
        activeDay: document.querySelector("#dayTabs button.active")?.textContent ?? null,
        draftDay: JSON.parse(localStorage.getItem("repforge_draft_v1") || "null")?.__day ?? null,
        marker: JSON.parse(localStorage.getItem("repforge_draft_v1") || "null")?.__sessionNotes ?? null,
        exercisePresent: !!document.querySelector(`[data-ex="${exerciseId}"]`),
        load: document.querySelector(`[data-k="${setKey}_load"]`)?.value ?? null,
      }),
      { exerciseId: EXERCISE_ID, setKey: SET_KEY }
    );

    check(
      restoredUi.activeDay === "Push Day" && restoredUi.draftDay === "Push Day",
      "reload selects the renamed draft day",
      restoredUi
    );
    await ensureWorkoutOpen(page);
    const workoutUi = await page.evaluate(
      ({ exerciseId, setKey }) => ({
        activeDay: document.querySelector("#dayTabs button.active")?.textContent ?? null,
        exercisePresent: !!document.querySelector(`[data-ex="${exerciseId}"]`),
        load: document.querySelector(`[data-k="${setKey}_load"]`)?.value ?? null,
        reps: document.querySelector(`[data-k="${setKey}_reps"]`)?.value ?? null,
        rir: document.querySelector(`[data-k="${setKey}_rir"]`)?.value ?? null,
        notes: document.querySelector(`[data-exnote="${exerciseId}"]`)?.value ?? null,
      }),
      { exerciseId: EXERCISE_ID, setKey: SET_KEY }
    );
    check(
      workoutUi.activeDay === "Push Day" &&
        workoutUi.exercisePresent &&
        workoutUi.load === "92.5" &&
        workoutUi.reps === "7" &&
        workoutUi.rir === "1.5" &&
        workoutUi.notes === "marker-note",
      "renamed draft remains reachable with its set and marker bytes",
      workoutUi
    );
    check(dialogs.length === 0, "rename and reload do not show a discard prompt", dialogs);

    await openProgramEditor(page);
    const beforeNoops = await readRuntime(page);
    await dispatchRename(page, "Day 2", "Push Day");
    await dispatchRename(page, "Push Day", "   ");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterNoops = await readRuntime(page);
    check(
      afterNoops.localRaw === beforeNoops.localRaw &&
        JSON.stringify(afterNoops.idb) === JSON.stringify(beforeNoops.idb) &&
        afterNoops.draftRaw === beforeNoops.draftRaw &&
        afterNoops.pendingEntries.length === 0,
      "duplicate and blank day renames are persistence no-ops",
      {
        localChanged: afterNoops.localRaw !== beforeNoops.localRaw,
        idbChanged: JSON.stringify(afterNoops.idb) !== JSON.stringify(beforeNoops.idb),
        draftChanged: afterNoops.draftRaw !== beforeNoops.draftRaw,
        pendingCount: afterNoops.pendingEntries.length,
      }
    );
  } finally {
    await context.close();
  }
}

async function runTotalFailure(browser) {
  console.log("\n2. Total storage failure changes no live or durable state");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const page = await openApp(context);
    const draftRaw = JSON.stringify(progressDraft());
    const replacementRaw = renameDraftRaw(draftRaw, "Push Day");
    await seedScenario(page, draftRaw);
    await openProgramEditor(page);
    const before = await readRuntime(page);

    await page.evaluate(
      async ({ key, oldDay, nextDay }) => {
        const originalSetItem = Storage.prototype.setItem;
        const originalPut = IDBObjectStore.prototype.put;
        Storage.prototype.setItem = function (candidate) {
          if (candidate === key) throw new Error("audit: reject rename local replica");
          return originalSetItem.apply(this, arguments);
        };
        IDBObjectStore.prototype.put = function (_value, candidate) {
          if (candidate === key) throw new Error("audit: reject rename IDB replica");
          return originalPut.apply(this, arguments);
        };
        try {
          const input = [...document.querySelectorAll('[data-act="renameDay"]')].find(
            (candidate) => candidate.dataset.day === oldDay
          );
          input.value = nextDay;
          input.dispatchEvent(new Event("change", { bubbles: true }));
          await window.__repforgeStorage.flush();
        } finally {
          Storage.prototype.setItem = originalSetItem;
          IDBObjectStore.prototype.put = originalPut;
        }
      },
      { key: KEY, oldDay: "Day 1", nextDay: "Push Day" }
    );

    const failed = await readRuntime(page);
    const ui = await page.evaluate(() => ({
      tabDays: [...document.querySelectorAll("#dayTabs button")].map((button) => button.textContent),
      activeDay: document.querySelector("#dayTabs button.active")?.textContent ?? null,
      editorDays: [...document.querySelectorAll('[data-act="renameDay"]')].map((input) => ({
        dataDay: input.dataset.day,
        value: input.value,
      })),
    }));
    const retained = failed.pendingEntries[0]?.value;

    check(
      failed.localRaw === before.localRaw && JSON.stringify(failed.idb) === JSON.stringify(before.idb),
      "total failure leaves durable program and log unchanged",
      {
        localChanged: failed.localRaw !== before.localRaw,
        idbChanged: JSON.stringify(failed.idb) !== JSON.stringify(before.idb),
      }
    );
    check(failed.draftRaw === draftRaw, "total failure leaves the exact draft unchanged", {
      before: draftRaw,
      after: failed.draftRaw,
    });
    check(
      ui.tabDays.includes("Day 1") &&
        !ui.tabDays.includes("Push Day") &&
        ui.activeDay === "Day 1" &&
        ui.editorDays.some((entry) => entry.dataDay === "Day 1" && entry.value === "Day 1"),
      "total failure leaves live program and selected day unchanged",
      ui
    );
    check(
      failed.pendingEntries.length === 1 &&
        retained?.effect?.kind === "replace-draft" &&
        retained.effect.expectedRaw === draftRaw &&
        retained.effect.replacementRaw === replacementRaw,
      "total failure retains one journal with the bounded compare-and-replace receipt",
      failed.pendingEntries.map((entry) => ({ key: entry.key, effect: entry.value?.effect }))
    );
    check(
      !stateHasEffectMetadata(failed.local) && !stateHasEffectMetadata(failed.idb),
      "failed receipt metadata remains outside app state",
      {
        localKeys: Object.keys(failed.local || {}),
        idbKeys: Object.keys(failed.idb || {}),
      }
    );

    await reloadApp(page);
    const replayed = await readRuntime(page);
    const replayRevision = (before.local?._storageRevision ?? 0) + 1;
    check(
      renamedSnapshot(replayed.local) &&
        renamedSnapshot(replayed.idb) &&
        replayed.local?._storageRevision === replayRevision &&
        replayed.idb?._storageRevision === replayRevision &&
        replayed.pendingEntries.length === 0,
      "boot replay commits the retained rename exactly once and drains its journal",
      {
        replayRevision,
        localRevision: replayed.local?._storageRevision,
        idbRevision: replayed.idb?._storageRevision,
        pendingCount: replayed.pendingEntries.length,
      }
    );
    check(
      replayed.draftRaw === replacementRaw,
      "boot replay applies the retained exact draft replacement",
      {
        expected: replacementRaw,
        actual: replayed.draftRaw,
      }
    );
  } finally {
    await context.close();
  }
}

async function runNewerDraftRace(browser) {
  console.log("\n3. A newer non-matching draft survives accepted rename");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  try {
    const writer = await openApp(context);
    const draftRaw = JSON.stringify(progressDraft());
    const replacementRaw = renameDraftRaw(draftRaw, "Push Day");
    await seedScenario(writer, draftRaw);
    const locker = await openApp(context);
    await holdStorageLock(locker);
    await openProgramEditor(writer);
    await dispatchRename(writer, "Day 1", "Push Day");
    await waitForPendingStorageLock(locker);
    const blocked = await readRuntime(writer);
    const pending = blocked.pendingEntries[0]?.value;
    const expectedRevision = (blocked.local?._storageRevision ?? 0) + 1;

    check(
      blocked.pendingEntries.length === 1 &&
        pending?.effect?.kind === "replace-draft" &&
        pending.effect.expectedRaw === draftRaw &&
        pending.effect.replacementRaw === replacementRaw,
      "blocked rename owns one exact compare-and-replace receipt",
      blocked.pendingEntries.map((entry) => ({ key: entry.key, effect: entry.value?.effect }))
    );

    const newerDraft = progressDraft();
    newerDraft.__day = "Day 2";
    newerDraft.__sessionNotes = "newer-cross-tab-marker";
    newerDraft.__touched = [`${OTHER_EXERCISE_ID}_1`];
    delete newerDraft[`${SET_KEY}_load`];
    delete newerDraft[`${SET_KEY}_reps`];
    delete newerDraft[`${SET_KEY}_rir`];
    newerDraft[`${OTHER_EXERCISE_ID}_1_load`] = "66.25";
    newerDraft[`${OTHER_EXERCISE_ID}_1_reps`] = "11";
    newerDraft[`${OTHER_EXERCISE_ID}_1_rir`] = "2";
    const newerDraftRaw = JSON.stringify(newerDraft);
    await locker.evaluate(
      ({ draftKey, raw }) => localStorage.setItem(draftKey, raw),
      { draftKey: DRAFT, raw: newerDraftRaw }
    );

    await releaseStorageLock(locker);
    await writer.evaluate(() => window.__repforgeStorage.flush());
    const accepted = await readRuntime(writer);

    check(
      renamedSnapshot(accepted.local) &&
        renamedSnapshot(accepted.idb) &&
        accepted.local?._storageRevision === expectedRevision &&
        accepted.idb?._storageRevision === expectedRevision,
      "accepted blocked rename commits program and history exactly once",
      {
        beforeRevision: blocked.local?._storageRevision,
        expectedRevision,
        localRevision: accepted.local?._storageRevision,
        idbRevision: accepted.idb?._storageRevision,
        localRenamed: renamedSnapshot(accepted.local),
        idbRenamed: renamedSnapshot(accepted.idb),
      }
    );
    check(
      accepted.draftRaw === newerDraftRaw,
      "compare failure preserves a newer draft byte-for-byte",
      {
        expected: newerDraftRaw,
        actual: accepted.draftRaw,
      }
    );
    check(
      accepted.pendingEntries.length === 0,
      "accepted rename drains its journal even when the draft compare fails",
      accepted.pendingEntries
    );
    check(
      !stateHasEffectMetadata(accepted.local) && !stateHasEffectMetadata(accepted.idb),
      "compare-and-replace receipt stays outside accepted app state",
      {
        localKeys: Object.keys(accepted.local || {}),
        idbKeys: Object.keys(accepted.idb || {}),
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
  console.log("Program day-rename active-draft regression");
  console.log(`Target: ${BASE}`);

  const browser = await launchChromium();
  try {
    await runScenario("accepted rename", () => runAcceptedRename(browser));
    await runScenario("total storage failure", () => runTotalFailure(browser));
    await runScenario("newer draft race", () => runNewerDraftRace(browser));
  } finally {
    await browser.close();
  }

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) {
    console.error(
      "\nObserved defect: day rename is not one transaction with an exact draft compare-and-replace."
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
