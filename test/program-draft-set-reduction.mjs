#!/usr/bin/env node
/**
 * Focused regression for reducing planned sets while a workout draft is active.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const PENDING = "repforge_pending_v1";
const DB = "repforge";
const STORE = "kv";
const EXERCISE_ID = "draft-guard-press";
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
      id: "draft-guard-program",
      name: "Draft guard fixture",
      started: "2026-08-01",
      created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 1,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "short",
      completedAt: null,
    },
    program: [
      {
        id: EXERCISE_ID,
        name: "Draft guard press",
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
    ],
    log: [],
    programHistory: [],
    _storageRevision: 1,
  };
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

async function writeFixture(page, state) {
  await page.evaluate(
    async ({ key, draftKey, pendingKey, dbName, storeName, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.removeItem(draftKey);
      localStorage.removeItem(pendingKey);
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
    { key: KEY, draftKey: DRAFT, pendingKey: PENDING, dbName: DB, storeName: STORE, state }
  );
}

async function readRuntime(page) {
  return page.evaluate(
    async ({ key, draftKey, dbName, storeName }) => {
      const localRaw = localStorage.getItem(key);
      const draftRaw = localStorage.getItem(draftKey);
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
      return {
        local: localRaw == null ? null : JSON.parse(localRaw),
        idb,
        draftRaw,
        draft: draftRaw == null ? null : JSON.parse(draftRaw),
      };
    },
    { key: KEY, draftKey: DRAFT, dbName: DB, storeName: STORE }
  );
}

function programSets(snapshot) {
  return snapshot?.program?.find((exercise) => exercise.id === EXERCISE_ID)?.sets ?? null;
}

async function fillSet(page, set, load, reps, rir) {
  await page.locator(`[data-k="${EXERCISE_ID}_${set}_load"]`).fill(String(load));
  await page.locator(`[data-k="${EXERCISE_ID}_${set}_reps"]`).fill(String(reps));
  await page.locator(`[data-k="${EXERCISE_ID}_${set}_rir"]`).fill(String(rir));
}

async function main() {
  console.log("Program set-reduction active-draft regression");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.dismiss();
  });

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    await writeFixture(page, fixture());
    await reloadApp(page);

    await page.click("#viewExercises");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    await fillSet(page, 1, 100, 8, 1);
    await fillSet(page, 2, 90, 10, 2);

    const drafted = await readRuntime(page);
    const setKeys = [`${EXERCISE_ID}_1`, `${EXERCISE_ID}_2`];
    const completeDraft = setKeys.every(
      (setKey) =>
        drafted.draft?.[`${setKey}_load`] &&
        drafted.draft?.[`${setKey}_reps`] &&
        drafted.draft?.[`${setKey}_rir`] != null &&
        drafted.draft?.__touched?.includes(setKey)
    );
    check(completeDraft, "precondition: draft contains touched sets 1 and 2", {
      draft: drafted.draft,
    });

    await page.click("#leaveWorkout");
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active", { timeout: 5000 });
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });

    const setsInput = page.locator(
      `#programEditor input[data-id="${EXERCISE_ID}"][data-field="sets"]`
    );
    const beforeReduction = await readRuntime(page);

    await setsInput.fill("1");
    await setsInput.blur();
    await page.evaluate(() => window.__repforgeStorage.flush());

    const afterReduction = await readRuntime(page);
    const rejectedToast = await page.locator("#toast").textContent();
    const reductionGuarded =
      programSets(afterReduction.local) === 2 &&
      programSets(afterReduction.idb) === 2;
    const replicasUnchanged =
      JSON.stringify(afterReduction.local) === JSON.stringify(beforeReduction.local) &&
      JSON.stringify(afterReduction.idb) === JSON.stringify(beforeReduction.idb);
    check(
      reductionGuarded,
      "set-count reduction is rejected when a removed set has draft progress",
      {
        dialogs,
        durableProgramSets: {
          local: programSets(afterReduction.local),
          indexedDb: programSets(afterReduction.idb),
        },
        draftStillContainsSet2: afterReduction.draft?.[`${EXERCISE_ID}_2_load`] != null,
      }
    );
    check(dialogs.length === 0, "rejection does not open a confirmation dialog", dialogs);
    check(await setsInput.inputValue() === "2", "rejected input is restored to the planned count", {
      inputValue: await setsInput.inputValue(),
    });
    check(replicasUnchanged, "rejection leaves both durable replicas unchanged", {
      localBefore: beforeReduction.local,
      localAfter: afterReduction.local,
      idbBefore: beforeReduction.idb,
      idbAfter: afterReduction.idb,
    });
    check(
      afterReduction.draftRaw === beforeReduction.draftRaw,
      "rejection leaves the exact workout draft unchanged",
      {
        before: beforeReduction.draftRaw,
        after: afterReduction.draftRaw,
      }
    );
    check(
      rejectedToast === "Finish or discard this workout before reducing sets you've started.",
      "rejection shows guidance to finish or discard the workout",
      { rejectedToast }
    );

    await page.click('nav button[data-view="log"]');
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    await page.click("#viewExercises");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const set2Reachable =
      (await page.locator(`[data-k="${EXERCISE_ID}_2_load"]`).count()) === 1;
    check(set2Reachable, "draft set 2 remains reachable before Finish", {
      plannedSets: programSets(afterReduction.local),
      set2DraftValue: afterReduction.draft?.[`${EXERCISE_ID}_2_load`],
    });

    await page.click("#logForm .btn--save");
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key) || "{}").log?.length > 0,
      KEY,
      { timeout: 8000 }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());

    const finished = await readRuntime(page);
    const savedRows = (finished.local?.log ?? [])
      .filter((row) => row.exerciseId === EXERCISE_ID)
      .sort((a, b) => a.set - b.set);
    const savedSets = savedRows.map((row) => row.set);
    const draftCleared = finished.draftRaw == null;
    check(
      savedSets.length === 2 && savedSets[0] === 1 && savedSets[1] === 2 && draftCleared,
      "Finish persists both drafted sets before clearing the draft",
      {
        savedSets,
        savedLoads: savedRows.map((row) => row.load),
        draftCleared,
        lostDraftSet2: draftCleared && !savedSets.includes(2),
      }
    );

    await writeFixture(page, fixture());
    await reloadApp(page);
    await page.click("#viewExercises");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    await fillSet(page, 1, 100, 8, 1);

    const allowedDraft = await readRuntime(page);
    const allowedSet1Key = `${EXERCISE_ID}_1`;
    const allowedSet2Key = `${EXERCISE_ID}_2`;
    const removedSetHasNoProgress =
      allowedDraft.draft?.__touched?.includes(allowedSet1Key) &&
      !allowedDraft.draft?.__done?.includes(allowedSet2Key) &&
      !allowedDraft.draft?.__touched?.includes(allowedSet2Key) &&
      !allowedDraft.draft?.__warm?.includes(allowedSet2Key) &&
      !(Number(allowedDraft.draft?.[`${allowedSet2Key}_load`]) > 0);
    check(removedSetHasNoProgress, "precondition: only retained set 1 has draft progress", {
      draft: allowedDraft.draft,
    });

    await page.click("#leaveWorkout");
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active", { timeout: 5000 });
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });

    const allowedInput = page.locator(
      `#programEditor input[data-id="${EXERCISE_ID}"][data-field="sets"]`
    );
    const dialogsBeforeAllowed = dialogs.length;
    await allowedInput.fill("1");
    await allowedInput.blur();
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterAllowedReduction = await readRuntime(page);
    const allowed =
      programSets(afterAllowedReduction.local) === 1 &&
      programSets(afterAllowedReduction.idb) === 1;
    check(allowed, "set-count reduction remains allowed when removed sets have no draft progress", {
      localSets: programSets(afterAllowedReduction.local),
      idbSets: programSets(afterAllowedReduction.idb),
    });
    check(
      dialogs.length === dialogsBeforeAllowed,
      "allowed reduction does not open a confirmation dialog",
      dialogs.slice(dialogsBeforeAllowed)
    );
    check(await allowedInput.inputValue() === "1", "allowed reduction keeps the requested count", {
      inputValue: await allowedInput.inputValue(),
    });
    check(
      afterAllowedReduction.draftRaw === allowedDraft.draftRaw,
      "allowed reduction leaves the active draft unchanged",
      {
        before: allowedDraft.draftRaw,
        after: afterAllowedReduction.draftRaw,
      }
    );
  } finally {
    await browser.close();
  }

  console.log(`\nPASSED: ${passed}`);
  console.log(`FAILED: ${failures.length}`);
  if (failures.length) {
    console.error(
      "\nObserved defect: a 2→1 Program edit can remove a drafted set, or an over-broad guard can block a safe reduction."
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Regression crashed:", error);
  process.exit(2);
});
