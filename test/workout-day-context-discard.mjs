#!/usr/bin/env node
/**
 * Regression for session context leaking across a confirmed workout-day discard.
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import {
  clearPersistenceArtifacts,
  inventoryPersistenceArtifacts,
} from "./persistence-artifacts.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";
const DAY_1_EXERCISE = "context-day-1";
const DAY_2_EXERCISE = "context-day-2";
const OLD_DATE = "2001-02-03";
const OLD_NOTE = "Day 1 context must be discarded";
const OLD_BODYWEIGHT = "83.25";
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
  const exercise = (id, name, day) => ({
    id,
    name,
    day,
    order: 1,
    sets: 1,
    min: 5,
    max: 10,
    primary: "Chest",
    secondary: "",
    notes: "",
    alternates: [],
  });
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
      id: "context-discard-program",
      name: "Context discard fixture",
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
      exercise(DAY_1_EXERCISE, "Day 1 press", "Day 1"),
      exercise(DAY_2_EXERCISE, "Day 2 press", "Day 2"),
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
    window.closeFirstRun?.();
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
  await page.evaluate(() => window.__repforgeStorage.flush());
  await clearPersistenceArtifacts(page);
  await page.evaluate(
    async ({ key, draftKey, dbName, storeName, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.removeItem(draftKey);
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
    { key: KEY, draftKey: DRAFT, dbName: DB, storeName: STORE, state }
  );
}

async function fillSet(page, exerciseId, load) {
  await page.locator(`[data-k="${exerciseId}_1_load"]`).fill(String(load));
  await page.locator(`[data-k="${exerciseId}_1_reps"]`).fill("8");
  await page.locator(`[data-k="${exerciseId}_1_rir"]`).fill("1");
}

async function contextSnapshot(page) {
  return page.evaluate((draftKey) => ({
    activeDay: document.querySelector("#dayTabs button.active")?.dataset.day,
    date: document.querySelector("#date")?.value,
    notes: document.querySelector("#notes")?.value,
    bodyweight: document.querySelector("#bodyweight")?.value,
    draftRaw: localStorage.getItem(draftKey),
  }), DRAFT);
}

async function main() {
  console.log("Workout-day context-discard regression");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  let dialogAction = "accept";
  const dialogs = [];
  page.on("dialog", async (dialog) => {
    dialogs.push({ message: dialog.message(), action: dialogAction });
    if (dialogAction === "dismiss") await dialog.dismiss();
    else await dialog.accept();
  });

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.evaluate(() => window.__repforgeStorage.flush());
    await writeFixture(page, fixture());
    await reloadApp(page);
    await page.click("#viewExercises");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });

    const freshDate = await page.locator("#date").inputValue();
    await page.click("#woOverflowBtn");
    await page.locator("#date").fill(OLD_DATE);
    await page.locator("#date").dispatchEvent("change");
    await page.locator("#notes").fill(OLD_NOTE);
    await page.locator("#bodyweight").fill(OLD_BODYWEIGHT);
    await fillSet(page, DAY_1_EXERCISE, 101);

    const beforeSwitch = await contextSnapshot(page);

    dialogAction = "dismiss";
    await page.click('#dayTabs button[data-day="Day 2"]');
    dialogAction = "accept";
    const afterCancel = await contextSnapshot(page);
    check(
      afterCancel.activeDay === "Day 1" &&
        afterCancel.draftRaw === beforeSwitch.draftRaw &&
        afterCancel.date === beforeSwitch.date &&
        afterCancel.notes === beforeSwitch.notes &&
        afterCancel.bodyweight === beforeSwitch.bodyweight,
      "Cancel preserves the exact raw draft, active day, and DOM context",
      { beforeSwitch, afterCancel }
    );

    await page.click('#dayTabs button[data-day="Day 2"]');
    await page.waitForFunction(
      () => document.querySelector("#dayTabs button.active")?.dataset.day === "Day 2",
      { timeout: 5000 }
    );
    const afterConfirm = await contextSnapshot(page);
    const confirmedDraft = JSON.parse(afterConfirm.draftRaw || "{}");
    check(
      afterConfirm.date === freshDate && afterConfirm.notes === "" && afterConfirm.bodyweight === "",
      "Confirmed discard resets date, note, and bodyweight before the new day draft",
      { freshDate, afterConfirm }
    );
    check(
      confirmedDraft.__day === "Day 2" &&
        confirmedDraft.__date !== OLD_DATE &&
        confirmedDraft.__sessionNotes !== OLD_NOTE &&
        confirmedDraft.__bodyweight !== OLD_BODYWEIGHT,
      "Confirmed discard removes Day-1 session context from draft storage",
      confirmedDraft
    );

    await fillSet(page, DAY_2_EXERCISE, 77);
    await page.click("#logForm .btn--save");
    await page.waitForFunction(
      (key) => JSON.parse(localStorage.getItem(key) || "{}").log?.length === 1,
      KEY,
      { timeout: 8000 }
    );
    await page.evaluate(() => window.__repforgeStorage.flush());
    const savedRows = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) || "{}").log || [],
      KEY
    );
    const savedArtifacts = await inventoryPersistenceArtifacts(page);
    const savedRow = savedRows[0];
    check(
      savedRows.length === 1 &&
        savedRow?.day === "Day 2" &&
        savedRow?.exerciseId === DAY_2_EXERCISE &&
        savedRow?.date === freshDate &&
        savedRow?.notes === "" &&
        !Object.prototype.hasOwnProperty.call(savedRow, "bodyweight") &&
        savedArtifacts.keys.length === 0,
      "Saved Day-2 row uses fresh session context after confirmed discard",
      { freshDate, savedRow, dialogs, artifacts: savedArtifacts.keys }
    );
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
