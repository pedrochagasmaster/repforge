#!/usr/bin/env node
/**
 * Focused regression for the program editor's free-text fields.
 *
 * The editor commits on every keystroke and the model normalises what it stores
 * (names are trimmed, a blank one falls back to "Exercise"). Echoing that
 * normalised value straight back into the focused input
 * swallowed spaces and re-filled a name the lifter was still clearing. These
 * checks type character by character — `fill()` dispatches a single input event
 * and hides the bug.
 *
 * Requires the repository root at REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { SHEET, applyInstalledEditor, editorSettled, openExerciseSheet, openInstalledEditor } from "./fixtures/installed-editor.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";
const EXERCISE_ID = "seed-ex-3";
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

/**
 * One linked movement on Day 1, shown under a program alias ("Press") over its
 * catalog name. The program is the seed program's canonical ProgramDefinition
 * cut down to that slot, so every editor commit runs the real canonical path.
 */
function fixture() {
  const meta = seedProgramMeta();
  const definition = meta.programDefinition;
  for (const day of definition.days) {
    day.slots = day.slots.filter((slot) => slot.id === EXERCISE_ID);
    day.slots.forEach((slot) => { slot.order = 1; slot.displayName = "Press"; });
    if (!day.slots.length) day.kind = "rest";
  }
  const row = seedProgram().find((entry) => entry.id === EXERCISE_ID);
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
    programMeta: { ...meta, daysPerWeek: 1, programDefinition: definition },
    program: [{ ...row, order: 1, name: "Press", displayName: "Press", alternates: [] }],
    log: [],
    programHistory: [],
    customExercises: [],
    _storageRevision: 1,
  };
}

async function waitForApp(page) {
  await page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function",
    { timeout: 15000 }
  );
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const onboarding = document.querySelector("#onboarding");
    window.closeFirstRun?.();
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

/*
 * The classic editor layout now serves the Build route's setup draft, so the
 * keystroke regressions run there: Build → one day → a catalog movement whose
 * name the lifter retypes as a program alias. The installed Program editor
 * (Plan 074) renames only custom movements, in its sheet; its part follows.
 */
const BUILD = "#onbProgramEditor";
const BENCH = { id: "19f5c6f170d8808bb424e98de4472a7e", name: "Barbell bench press" };
let buildRowId = null;

function fieldInput(page, field) {
  return page.locator(`${BUILD} [data-role="exercise-field"][data-id="${buildRowId}"][data-field="${field}"]`);
}

/** The setup draft's copy of the row the editor last committed. */
async function stagedExercise(page) {
  return page.evaluate((id) => window.__repforgeEntryState?.()?.result?.preview?.program?.find((entry) => entry.id === id) ?? null, buildRowId);
}

async function openBuildEditor(page) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.fill("#entryProgramName", "Text fields");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector(`${BUILD} [data-role="add-exercise"]`, { timeout: 10000 });
  await page.locator(`${BUILD} [data-role="add-exercise"][data-day="Day 1"]`).click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", BENCH.name);
  await page.locator(`#exPickList [data-pick="${BENCH.id}"]`).click();
  await page.waitForSelector(`${BUILD} [data-role="exercise"]`, { timeout: 10000 });
  buildRowId = await page.locator(`${BUILD} [data-role="exercise"]`).first().getAttribute("data-id");
  const toggle = page.locator(`${BUILD} [data-role="toggle-exercise"][data-id="${buildRowId}"]`);
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
}

async function openExerciseDetails(page) {
  const row = page.locator(`${BUILD} [data-role="exercise"][data-id="${buildRowId}"]`);
  // The row menu shares the day menu's reorder mode with the drag handle.
  const editor = page.locator(`${BUILD} [data-role="editor"]`);
  if (!(await editor.evaluate((element) => element.classList.contains("is-reorder-mode")))) {
    await page.locator(`${BUILD} [data-role="day-menu"]`).first().click();
    await page.locator(`${BUILD} [data-role="toggle-reorder"]`).first().click();
  }
  await row.locator('[data-role="exercise-menu"]').click();
  await row.locator('[data-role="more-details"][role="menuitem"]').click();
  await page.waitForFunction(({ scope, id }) => {
    const details = document.querySelector(`${scope} details[data-role="more-details"][data-id="${CSS.escape(id)}"]`);
    return details?.open === true;
  }, { scope: BUILD, id: buildRowId });
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

async function buildPart(browser) {
  console.log("Build editor (classic layout)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
    await openBuildEditor(page);
    const name = fieldInput(page, "name");

    // 0. R7 J-18: the Add day control carries one plus, not the glyph and the string's own.
    const addDayText = ((await page.locator(`${BUILD} [data-role="add-day"]`).textContent()) || "").replace(/\s+/g, " ").trim();
    check((addDayText.match(/[+＋]/g) || []).length === 1 && /Add day/.test(addDayText),
      "the Add day control shows a single plus", { addDayText });

    // 1. Typing a multi-word name keeps its spaces.
    await name.click();
    await page.keyboard.press("End");
    await backspace(page, BENCH.name.length);
    await name.pressSequentially("Incline chest press", { delay: 20 });
    check((await name.inputValue()) === "Incline chest press", "typed spaces survive in the name box", { value: await name.inputValue() });
    check((await stagedExercise(page))?.name === "Incline chest press", "typed multi-word name reaches storage",
      { stored: (await stagedExercise(page))?.name });

    // 2. Erasing the last character leaves the truncated name, not a fallback.
    await backspace(page, 1);
    check((await name.inputValue()) === "Incline chest pres", "erasing one character does not rewrite the name box",
      { value: await name.inputValue() });

    // 3. Clearing the box entirely leaves it empty while the field still has focus.
    await backspace(page, "Incline chest pres".length);
    check((await name.inputValue()) === "", "a fully cleared name box stays empty while focused", { value: await name.inputValue() });
    check((await stagedExercise(page))?.name !== "Exercise", "clearing the name box never commits the Exercise fallback",
      { stored: (await stagedExercise(page))?.name });

    // 4. Typing a fresh name after the clear commits normally.
    await name.pressSequentially("Seated row", { delay: 20 });
    check((await name.inputValue()) === "Seated row" && (await stagedExercise(page))?.name === "Seated row",
      "a name typed after clearing commits as typed", { value: await name.inputValue(), stored: (await stagedExercise(page))?.name });

    // 5. Clearing a name and blurring is an abandoned edit, not a rename: the box
    //    and storage both go back to what was there when the field took focus.
    await name.blur();
    await name.click();
    await page.keyboard.press("End");
    await backspace(page, "Seated row".length);
    await name.blur();
    const restored = await waitForValue(page, name, "Seated row");
    check(restored === "Seated row" && (await stagedExercise(page))?.name === "Seated row",
      "blurring an empty name box restores the name it had on focus", { value: restored, stored: (await stagedExercise(page))?.name });

    // 6. Trailing whitespace is trimmed on blur, not mid-word. A linked
    //    movement's muscles come from its catalog definition and are read-only.
    await openExerciseDetails(page);
    check(await fieldInput(page, "primary").evaluate((element) => element.readOnly), "a linked movement's muscle box is read-only");
    const notes = fieldInput(page, "notes");
    await notes.click();
    await page.keyboard.press("End");
    await notes.pressSequentially("Seat on 4 ", { delay: 20 });
    check((await notes.inputValue()) === "Seat on 4 ", "a trailing space is left alone while the notes box is focused",
      { value: await notes.inputValue() });
    await notes.blur();
    check((await waitForValue(page, notes, "Seat on 4")) === "Seat on 4" && (await stagedExercise(page))?.notes === "Seat on 4",
      "blur trims the notes box to the stored value", { value: await notes.inputValue(), stored: (await stagedExercise(page))?.notes });

    // 7. #317: alternates are chosen movements, never a free-text box of names.
    check(await page.locator(`${BUILD} [data-role="exercise-field"][data-field="alternates"]`).count() === 0,
      "alternates are not a free-text field");

    // 8. The edits are what the activated program keeps, across a reload.
    await page.locator(`${BUILD} [data-role="add-exercise"][data-day="Day 2"]`).click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.locator("#exPickList .pickrow").first().click();
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await page.click("#entryEditorActivate");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
      undefined, { timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await page.evaluate((id) => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.program?.find((entry) => entry.libraryId === id), BENCH.id);
    check(reloaded?.name === "Seated row" && reloaded?.notes === "Seat on 4", "edited text fields survive activation and a reload", { reloaded });
  } finally {
    await context.close();
  }
}

/** Every visible control in the editor and its open sheet, named as a screen reader reads it. */
const controlNames = (page) => page.$$eval("#programEditor button, #programEditor [role=button], #reviewSheet.is-open button", (nodes) =>
  nodes.map((node) => (node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean));

async function installedPart(browser) {
  console.log("\nInstalled Program editor (candidate A)");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await writeFixture(page, fixture());
    await openInstalledEditor(page);
    await openExerciseSheet(page, EXERCISE_ID);

    // A catalog movement shows its name and is not retyped (ADR 0021 decision 5).
    check(await page.locator(`${SHEET} [data-role="exercise-field"][data-field="name"]`).count() === 0,
      "a catalog movement offers no name box");
    await page.locator(`${SHEET} [data-role="more-details"] summary`).click();
    check(await page.locator(`${SHEET} [data-role="exercise-field"][data-field="primary"]`).evaluate((element) => element.readOnly),
      "a linked movement's muscle box is read-only");
    const notes = page.locator(`${SHEET} [data-role="exercise-field"][data-field="notes"]`);
    await notes.click();
    await notes.pressSequentially("Seat on 4 ", { delay: 20 });
    check((await notes.inputValue()) === "Seat on 4 ", "a trailing space is left alone while the notes box is focused");
    await notes.press("Tab");
    await editorSettled(page);
    const staged = await page.evaluate(async (id) => (await window.__debugProgramEditor?.())?.session?.document?.program?.find((entry) => entry.id === id) ?? null, EXERCISE_ID);
    check(staged?.notes === "Seat on 4", "leaving the notes box stages the trimmed text", { staged: staged?.notes });
    check(await page.locator(`${SHEET} [data-role="exercise-field"][data-field="alternates"]`).count() === 0,
      "alternates are not a free-text field");
    await applyInstalledEditor(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    check((await storedExercise(page))?.notes === "Seat on 4", "the notes survive Apply and a reload");

    // R7 J-14: in Portuguese no editor control is named in English, and the stepper reads as sets.
    await writeFixture(page, { ...fixture(), settings: { ...fixture().settings, lang: "pt" } });
    await openInstalledEditor(page);
    await openExerciseSheet(page, EXERCISE_ID);
    const names = await controlNames(page);
    const english = names.filter((value) => /^(Expand|Collapse|Increase|Decrease|Remove|Rename|Move|Add|Swap|Done|Apply|Undo|More)\b/.test(value));
    check(english.length === 0, "PT editor: no control is named in English", { english, names });
    const steppers = await page.$$eval(`${SHEET} [data-role="sets-step"]`, (nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    check(steppers.length === 2 && steppers.every((value) => /s[eé]ries/i.test(value || "")),
      "PT editor: the sets steppers are named in Portuguese", { steppers });
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("Program editor text-field regression");
  console.log(`Target: ${BASE}\n`);
  const browser = await launchChromium();
  try {
    await buildPart(browser);
    await installedPart(browser);
  } finally {
    await browser.close();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
