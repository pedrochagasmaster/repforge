#!/usr/bin/env node
/**
 * Focused regression for the program editor's free-text fields.
 *
 * The editor commits on every keystroke and the model normalises what it stores
 * (names are trimmed, a blank one falls back to "Exercise", alternates are split
 * on commas). Echoing that normalised value straight back into the focused input
 * swallowed spaces and re-filled a name the lifter was still clearing. These
 * checks type character by character — `fill()` dispatches a single input event
 * and hides the bug.
 *
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";
const EXERCISE_ID = "text-field-press";
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
      id: "text-field-program",
      name: "Text field fixture",
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
        name: "Press",
        day: "Day 1",
        order: 1,
        sets: 2,
        min: 8,
        max: 12,
        primary: "Chest",
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

async function waitForApp(page) {
  await page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function",
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

async function writeFixture(page, state) {
  await page.evaluate(() => window.__repforgeStorage.flush());
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
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function storedExercise(page) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate(
    ({ key, id }) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw).program?.find((entry) => entry.id === id) ?? null;
    },
    { key: KEY, id: EXERCISE_ID }
  );
}

async function openProgramEditor(page) {
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (
    await page
      .locator("#programEditorWrap")
      .evaluate((element) => element.classList.contains("is-hidden"))
  ) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
}

function fieldInput(page, field) {
  return page.locator(`#programEditor input[data-id="${EXERCISE_ID}"][data-field="${field}"]`);
}

// Clears the box the way a lifter does — cursor at the end, backspace held down —
// so every intermediate value round-trips through the commit path.
async function backspace(page, times) {
  for (let i = 0; i < times; i++) await page.keyboard.press("Backspace");
}

// Blur handlers commit before they repaint the box, so a read taken the instant
// blur() returns races them.
async function waitForValue(page, locator, expected, timeout = 5000) {
  const deadline = Date.now() + timeout;
  let value = await locator.inputValue();
  while (value !== expected && Date.now() < deadline) {
    await page.waitForTimeout(25);
    value = await locator.inputValue();
  }
  return value;
}

async function main() {
  console.log("Program editor text-field regression");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await writeFixture(page, fixture());
    await openProgramEditor(page);

    const name = fieldInput(page, "name");

    // 1. Typing a multi-word name keeps its spaces.
    await name.click();
    await page.keyboard.press("End");
    await backspace(page, "Press".length);
    await name.pressSequentially("Incline chest press", { delay: 20 });
    check(
      (await name.inputValue()) === "Incline chest press",
      "typed spaces survive in the name box",
      { value: await name.inputValue() }
    );
    check(
      (await storedExercise(page))?.name === "Incline chest press",
      "typed multi-word name reaches storage",
      { stored: (await storedExercise(page))?.name }
    );

    // 2. Erasing the last character leaves the truncated name, not a fallback.
    await backspace(page, 1);
    check(
      (await name.inputValue()) === "Incline chest pres",
      "erasing one character does not rewrite the name box",
      { value: await name.inputValue() }
    );

    // 3. Clearing the box entirely leaves it empty while the field still has focus.
    await backspace(page, "Incline chest pres".length);
    check(
      (await name.inputValue()) === "",
      "a fully cleared name box stays empty while focused",
      { value: await name.inputValue() }
    );
    check(
      (await storedExercise(page))?.name !== "Exercise",
      "clearing the name box never commits the Exercise fallback",
      { stored: (await storedExercise(page))?.name }
    );

    // 4. Typing a fresh name after the clear commits normally.
    await name.pressSequentially("Seated row", { delay: 20 });
    check(
      (await name.inputValue()) === "Seated row" &&
        (await storedExercise(page))?.name === "Seated row",
      "a name typed after clearing commits as typed",
      { value: await name.inputValue(), stored: (await storedExercise(page))?.name }
    );

    // 5. Clearing a name and blurring is an abandoned edit, not a rename: the box
    //    and storage both go back to what was there when the field took focus.
    await name.blur();
    await name.click();
    await page.keyboard.press("End");
    await backspace(page, "Seated row".length);
    await name.blur();
    const restored = await waitForValue(page, name, "Seated row");
    check(
      restored === "Seated row" && (await storedExercise(page))?.name === "Seated row",
      "blurring an empty name box restores the name it had on focus",
      { value: restored, stored: (await storedExercise(page))?.name }
    );

    // 6. Trailing whitespace is trimmed on blur, not mid-word.
    const primary = fieldInput(page, "primary");
    await primary.click();
    await page.keyboard.press("End");
    await backspace(page, "Chest".length);
    await primary.pressSequentially("Upper chest ", { delay: 20 });
    check(
      (await primary.inputValue()) === "Upper chest ",
      "a trailing space is left alone while the muscle box is focused",
      { value: await primary.inputValue() }
    );
    await primary.blur();
    check(
      (await primary.inputValue()) === "Upper chest" &&
        (await storedExercise(page))?.primary === "Upper chest",
      "blur trims the muscle box to the stored value",
      { value: await primary.inputValue(), stored: (await storedExercise(page))?.primary }
    );

    // 7. Alternates are no longer typed: the row is a button onto the picker,
    //    so it reads back the stored list rather than holding a half-typed one.
    const altBtn = page.locator('#programEditor [data-act="pickAlternates"][data-id="text-field-press"]');
    check(await altBtn.count() === 1, "alternates are a picker control, not a text box", {
      count: await altBtn.count(),
      leftoverInput: await page.locator('#programEditor input[data-field="alternates"]').count(),
    });
    await altBtn.click();
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await page.fill("#exPickSearch", "Pec deck");
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#exPickList .pickrow")];
      rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim() === "Pec deck")?.click();
    });
    await page.click("#exPickDone");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await page.waitForTimeout(250);
    const stored = await storedExercise(page);
    check(
      JSON.stringify(stored?.alternates) === JSON.stringify(["Pec deck"]),
      "picked alternates are stored as names",
      { stored: stored?.alternates }
    );
    check(
      ((await altBtn.textContent()) || "").trim() === "Pec deck",
      "the alternates control reads back what is stored",
      { label: (await altBtn.textContent() || "").trim() }
    );

    // 8. The edits survive a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await storedExercise(page);
    check(
      reloaded?.name === "Seated row" && reloaded?.primary === "Upper chest",
      "edited text fields survive a reload",
      { reloaded }
    );
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
