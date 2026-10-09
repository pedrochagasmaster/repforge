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
  return page.locator(`#programEditor [data-role="exercise-field"][data-id="${EXERCISE_ID}"][data-field="${field}"]`);
}

async function stagedExercise(page) {
  return page.evaluate(async (id) => {
    const debug = await window.__debugProgramEditor?.();
    return debug?.session?.document?.program?.find((entry) => entry.id === id) ?? null;
  }, EXERCISE_ID);
}

async function openExerciseDetails(page) {
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${EXERCISE_ID}"]`);
  if (!(await row.locator('[data-role="exercise-field"][data-field="notes"]').count()))
    await row.locator('[data-role="toggle-exercise"]').click();
  await page.locator('#programEditor [data-role="day-menu"]').first().click();
  const editor = page.locator('#programEditor [data-role="editor"]');
  if (!(await editor.evaluate((element) => element.classList.contains("is-reorder-mode"))))
    await page.locator('#programEditor [data-role="toggle-reorder"]').first().click();
  await row.locator('[data-role="exercise-menu"]').click();
  await row.locator('[data-role="more-details"][role="menuitem"]').click();
  await page.waitForFunction((id) => {
    const details = document.querySelector(`#programEditor details[data-role="more-details"][data-id="${CSS.escape(id)}"]`);
    return details?.open === true;
  }, EXERCISE_ID);
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

    // 0. R7 J-18: the Add day control carries one plus, not the glyph and the string's own.
    const addDayText = ((await page.locator('#programEditor [data-role="add-day"]').textContent()) || "").replace(/\s+/g, " ").trim();
    check((addDayText.match(/[+＋]/g) || []).length === 1 && /Add day/.test(addDayText),
      "the Add day control shows a single plus", { addDayText });

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
      (await stagedExercise(page))?.name === "Incline chest press",
      "typed multi-word name reaches storage",
      { stored: (await stagedExercise(page))?.name }
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
      (await stagedExercise(page))?.name !== "Exercise",
      "clearing the name box never commits the Exercise fallback",
      { stored: (await stagedExercise(page))?.name }
    );

    // 4. Typing a fresh name after the clear commits normally.
    await name.pressSequentially("Seated row", { delay: 20 });
    check(
      (await name.inputValue()) === "Seated row" &&
      (await stagedExercise(page))?.name === "Seated row",
      "a name typed after clearing commits as typed",
      { value: await name.inputValue(), stored: (await stagedExercise(page))?.name }
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
      restored === "Seated row" && (await stagedExercise(page))?.name === "Seated row",
      "blurring an empty name box restores the name it had on focus",
      { value: restored, stored: (await storedExercise(page))?.name }
    );

    // 6. Trailing whitespace is trimmed on blur, not mid-word. A linked
    //    movement's muscles come from its catalog definition and are read-only
    //    here, so the free-text box under test is the notes field.
    await openExerciseDetails(page);
    check(
      await fieldInput(page, "primary").evaluate((element) => element.readOnly),
      "a linked movement's muscle box is read-only",
    );
    const notes = fieldInput(page, "notes");
    await notes.click();
    await page.keyboard.press("End");
    await notes.pressSequentially("Seat on 4 ", { delay: 20 });
    check(
      (await notes.inputValue()) === "Seat on 4 ",
      "a trailing space is left alone while the notes box is focused",
      { value: await notes.inputValue() }
    );
    await notes.blur();
    check(
      (await waitForValue(page, notes, "Seat on 4")) === "Seat on 4" &&
        (await stagedExercise(page))?.notes === "Seat on 4",
      "blur trims the notes box to the stored value",
      { value: await notes.inputValue(), stored: (await stagedExercise(page))?.notes }
    );
    await openExerciseDetails(page);

    // 7. #317 option B: the Alternates row is gone. The Focus swap picker never
    //    read it, so the control only stored a note the canonical program then
    //    dropped on the floor — removed rather than wired up.
    check(await page.locator(`#programEditor [data-role="alternates"][data-id="${EXERCISE_ID}"]`).count() === 0,
      "the alternates picker control is gone", {
        altButton: await page.locator(`#programEditor [data-role="alternates"][data-id="${EXERCISE_ID}"]`).count(),
      });
    check(await page.locator('#programEditor [data-role="exercise-field"][data-field="alternates"]').count() === 0,
      "no leftover alternates text box took its place", {
        leftoverInput: await page.locator('#programEditor [data-role="exercise-field"][data-field="alternates"]').count(),
      });

    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));

    // 8. The edits survive a reload.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const reloaded = await storedExercise(page);
    check(
      reloaded?.name === "Seated row" && reloaded?.notes === "Seat on 4",
      "edited text fields survive a reload",
      { reloaded }
    );

    // 9. R7 J-14: in Portuguese no editor control is named in English, and the stepper reads as sets.
    await writeFixture(page, { ...fixture(), settings: { ...fixture().settings, lang: "pt" } });
    await openProgramEditor(page);
    await page.locator('#programEditor [data-role="toggle-exercise"]').first().click();
    await page.waitForSelector('#programEditor [data-role="adjust"]', { timeout: 5000 });
    const names = await page.$$eval("#programEditor button, #programEditor [role=button]", (nodes) =>
      nodes.map((node) => (node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean));
    const english = names.filter((value) => /^(Expand|Collapse|Increase|Decrease)\b/.test(value));
    check(english.length === 0, "PT editor: no control is named Expand, Collapse, Increase or Decrease", { english, names });
    const steppers = await page.$$eval('#programEditor [data-role="adjust"]', (nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    check(steppers.length === 2 && steppers.every((value) => /s[eé]ries/i.test(value || "")),
      "PT editor: the sets steppers are named in Portuguese", { steppers });
    const toggles = await page.$$eval('#programEditor [data-role="toggle-exercise"], #programEditor [data-role="toggle-day"]', (nodes) => nodes.map((node) => node.getAttribute("aria-label")));
    check(toggles.length === 2 && toggles.every((value) => /^(Expandir|Recolher)\b/.test(value || "")),
      "PT editor: the exercise and day toggles read Expandir or Recolher", { toggles });
    const addDayPt = ((await page.locator('#programEditor [data-role="add-day"]').textContent()) || "").replace(/\s+/g, " ").trim();
    check((addDayPt.match(/[+＋]/g) || []).length === 1 && /Adicionar dia/.test(addDayPt),
      "PT editor: Add day shows a single plus", { addDayPt });
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
