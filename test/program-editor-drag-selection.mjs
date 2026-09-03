#!/usr/bin/env node
/**
 * Regression for native text selection while exercise reordering is active.
 *
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DB = "repforge";
const STORE = "kv";
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
      id: "drag-selection-program",
      name: "Drag selection fixture",
      started: "2026-09-01",
      created: "2026-09-01T00:00:00.000Z",
      updated: "2026-09-01T00:00:00.000Z",
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
        id: "drag-selection-row-1",
        name: "Seated row machine",
        day: "Day 1",
        order: 1,
        sets: 3,
        min: 4,
        max: 8,
        primary: "Back",
        secondary: "",
        notes: "",
        alternates: [],
      },
      {
        id: "drag-selection-row-2",
        name: "Romanian deadlift",
        day: "Day 1",
        order: 2,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Hamstrings",
        secondary: "",
        notes: "",
        alternates: [],
      },
    ],
    log: [],
    programHistory: [],
    _storageRevision: 1,
  };
}

async function writeFixture(page) {
  const state = fixture();
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.evaluate(
    async ({ key, dbName, storeName, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.removeItem("repforge_draft_v1");
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
    { key: KEY, dbName: DB, storeName: STORE, state }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function main() {
  console.log("Program editor drag-selection regression");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await writeFixture(page);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active", { timeout: 5000 });
    await page.click("#programEditToggle");
    await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });

    const editor = page.locator("#programEditor");
    const name = editor.locator('[data-role="exercise-field"][data-field="name"]').first();
    const before = await name.evaluate((element) => getComputedStyle(element).userSelect);
    check(before !== "none", "exercise names remain selectable during ordinary editing", { userSelect: before });

    const day = editor.locator('[data-role="day"]').first();
    await day.locator('[data-role="day-menu"]').click();
    await day.locator('[data-role="toggle-reorder"]').click();

    const during = await name.evaluate((element) => ({
      userSelect: getComputedStyle(element).userSelect,
      webkitUserSelect: getComputedStyle(element).webkitUserSelect,
    }));
    check(
      during.userSelect === "none" && during.webkitUserSelect === "none",
      "exercise text cannot be selected while reorder mode is active",
      during
    );

    const firstRow = editor.locator('[data-role="exercise"][data-id="drag-selection-row-1"]');
    const secondRow = editor.locator('[data-role="exercise"][data-id="drag-selection-row-2"]');
    const handleBox = await firstRow.locator('[data-role="drag-handle"]').boundingBox();
    const secondBox = await secondRow.boundingBox();
    if (!handleBox || !secondBox) throw new Error("drag controls have no browser geometry");
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.move(handleBox.x + handleBox.width / 2, secondBox.y + secondBox.height - 4, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(() =>
      document.querySelector('#programEditor [data-role="exercise"]')?.dataset.id === "drag-selection-row-2"
    );
    check(
      await page.evaluate(() => window.getSelection()?.toString() === ""),
      "a completed pointer reorder leaves no native text selection"
    );

    const rerenderedDay = editor.locator('[data-role="day"]').first();
    await rerenderedDay.locator('[data-role="day-menu"]').click();
    await rerenderedDay.locator('[data-role="toggle-reorder"]').click();
    const after = await name.evaluate((element) => getComputedStyle(element).userSelect);
    check(after !== "none", "leaving reorder mode restores normal text selection", { userSelect: after });
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
