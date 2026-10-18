#!/usr/bin/env node
/**
 * Plan 074 S1: the installed Program editor in onboarding B's editing language
 * (ADR 0021, candidate A).
 *
 * P074-S1-EDIT: Program → Edit → in one exercise's sheet change sets, the rep
 * range, one set's RIR and the rest → give week 7 its own RIR in Weeks → swap
 * the exercise to one of its alternates → Apply. The stored ProgramDefinition
 * carries every change in every week and the week-7 exception, survives a
 * reload, and the next workout is built from it.
 * P074-S1-CANCEL: Undo reverts the last change; Cancel with changes asks, and
 * Discard leaves the stored program as it was.
 * P074-S1-EMPTY: a training day emptied of exercises marks its tab and keeps
 * Apply disabled with the reason above it.
 *
 * Run: node tools/run-tests.mjs entry --suite program-editor-a
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const SLOT = "seed-ex-1";
const LAT = { id: "1a15c6f170d8800d8fc9d2c235673bf6", name: "Overhand grip cable lat pulldown" };
const EDITOR = "#programEditor";
const SHEET = "#reviewSheet";

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 1500)}`);
}

async function waitForApp(page) {
  await waitForAppBoot(page);
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

const durable = async (page) => {
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
};
const storedSlot = async (page, slotId = SLOT) => (await durable(page)).programMeta?.programDefinition?.days
  ?.flatMap((day) => day.slots || []).find((slot) => slot.id === slotId) || null;

/** The editor has drawn and no edit is in flight. */
const settled = (page) => page.waitForFunction((selector) => {
  const editor = document.querySelector(`${selector} [data-role="editor"][data-layout="review"]`);
  return !!editor && editor.getAttribute("aria-busy") !== "true";
}, EDITOR, { timeout: 10000 });

async function openEditor(page) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#programEditToggle");
  await page.waitForSelector(`${EDITOR} [data-role="editor"][data-layout="review"]`, { timeout: 10000 });
  await settled(page);
}

async function openSheet(page, slotId = SLOT) {
  await page.locator(`${EDITOR} [data-role="exercise-row"][data-id="${slotId}"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="exercise"][data-id="${slotId}"]`, { timeout: 5000 });
}

/** Click a sheet control and wait for the edit it stages to settle. */
async function sheetTap(page, selector) {
  await page.locator(`${SHEET} ${selector}`).click();
  await settled(page);
}

const ledger = (page) => page.$$eval(`${SHEET} [data-role="set-ledger-row"]`, (rows) => rows.map((row) => ({
  reps: row.querySelector('[data-role="set-reps"]')?.textContent?.trim(),
  rir: row.querySelector('[data-role="set-rir"]')?.textContent?.trim(),
})));

async function pickExact(page, name) {
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", name);
  const row = page.locator("#exPickList .pickrow").filter({ has: page.locator(".pickrow__name", { hasText: new RegExp(`^${name}$`, "i") }) });
  await row.first().waitFor({ timeout: 5000 });
  await row.first().click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
}

async function closeSheet(page) {
  await page.locator(`${SHEET} [data-role="sheet-done"]`).click();
  await page.waitForSelector(`${SHEET}`, { state: "hidden", timeout: 5000 });
}

async function editJourney(page) {
  console.log("P074-S1-EDIT");
  await openEditor(page);
  const overview = await page.evaluate((selector) => ({
    navHidden: getComputedStyle(document.querySelector("nav")).display === "none" || document.querySelector("nav").hidden,
    tabs: [...document.querySelectorAll(`${selector} [data-role="day-tab"]`)].map((tab) => tab.textContent.trim()),
    rows: document.querySelectorAll(`${selector} [data-role="exercise-row"]`).length,
    apply: !!document.querySelector(`${selector} [data-role="apply"]`),
    title: document.querySelector("#program .page-title")?.textContent?.trim(),
    cancel: !!document.querySelector("#programEditCancel:not(.hidden)"),
    setLines: document.querySelectorAll(`${selector} [data-role="exercise-row"][data-id="seed-ex-1"] [data-role="set-line"]`).length,
  }), EDITOR);
  check(overview.tabs.length === 3, "the overview has one tab per training day", overview);
  check(overview.rows === 6, "the first day's six exercises are listed as rows", overview);
  check(overview.setLines === 2, "a row shows one line per set", overview);
  check(overview.apply && overview.navHidden, "Apply is pinned where the dock was", overview);
  check(overview.title === "Edit program" && overview.cancel, "the header reads Edit program with Cancel", overview);

  await openSheet(page);
  await sheetTap(page, '[data-role="sets-step"][data-delta="1"]');
  await sheetTap(page, '[data-role="range-step"][data-bound="max"][data-delta="-1"]');
  await sheetTap(page, '[data-role="rir-step"][data-set-index="1"][data-delta="1"]');
  await sheetTap(page, '[data-role="rest-preset"][data-seconds="120"]');
  const rows = await ledger(page);
  check(rows.length === 3 && rows.every((row) => row.reps === "4–7 reps"), "the ledger shows three sets of 4–7 reps", rows);
  check(rows[0].rir === "3", "set 1's RIR stepped from the default", rows);

  // A week-7 exception through Weeks.
  check(/Same in all 7 weeks/.test(await page.locator(`${SHEET} [data-role="weeks-open"]`).textContent()),
    "the Weeks row says every week is the same");
  await page.locator(`${SHEET} [data-role="weeks-open"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="weeks"]`, { timeout: 5000 });
  await page.locator(`${SHEET} [data-role="week-row"][data-cycle-index="7"]`).click();
  const weekRir = page.locator(`${SHEET} [data-role="prescription-field"][data-cycle-index="7"][data-set-index="1"][data-field="rir"]`);
  await weekRir.waitFor({ timeout: 5000 });
  await weekRir.fill("4");
  await weekRir.press("Enter");
  await weekRir.blur();
  await settled(page);
  await page.waitForSelector(`${SHEET} [data-role="week-row"][data-cycle-index="7"] [data-role="week-differs"]`, { timeout: 5000 });
  check(true, "week 7 is marked as different");
  await page.locator(`${SHEET} [data-role="weeks-back"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="exercise"][data-id="${SLOT}"]`, { timeout: 5000 });
  check(/1 week differs/.test(await page.locator(`${SHEET} [data-role="weeks-open"]`).textContent()),
    "the Weeks row now says one week differs");

  // Swap to an alternate: the swap list offers the lifter's alternates first.
  await page.locator(`${SHEET} [data-role="add-alternate"]`).click();
  await pickExact(page, LAT.name);
  await page.waitForSelector(`${SHEET}.is-open [data-role="alternate"][data-exercise-id="${LAT.id}"]`, { timeout: 5000 });
  await page.locator(`${SHEET} [data-role="swap-open"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="swap"]`, { timeout: 5000 });
  const groups = await page.$$eval(`${SHEET} [data-role="swap-group"]`, (items) => items.map((item) => ({
    title: item.querySelector("[data-role=swap-group-title]")?.textContent?.trim(),
    ids: [...item.querySelectorAll("[data-role=swap-choice]")].map((choice) => choice.dataset.exerciseId),
  })));
  check(groups[0]?.title === "Your alternates" && groups[0]?.ids[0] === LAT.id, "the swap list starts with the lifter's alternates", groups);
  await page.locator(`${SHEET} [data-role="swap-choice"][data-exercise-id="${LAT.id}"]`).click();
  await settled(page);
  await page.waitForFunction(({ selector, slot, name }) =>
    document.querySelector(`${selector} [data-role="exercise-row"][data-id="${slot}"]`)?.textContent.includes(name),
  { selector: EDITOR, slot: SLOT, name: LAT.name }, { timeout: 5000 });
  check(true, "the row now names the alternate");
  if (await page.locator(`${SHEET}.is-open`).count()) await closeSheet(page);

  const count = await page.locator(`${EDITOR} [data-role="changes-count"]`).textContent();
  check(/\d+ changes of yours/.test(count || ""), "the changes bar counts the changes", count);
  check((await storedSlot(page))?.exerciseId !== LAT.id, "nothing is stored before Apply");

  await page.locator(`${EDITOR} [data-role="apply"]`).click();
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  const verify = async (label) => {
    const slot = await storedSlot(page);
    const cycles = slot?.prescriptionsByCycle || [];
    const regular = cycles.filter((cycle) => cycle.cycleIndex !== 7);
    const seventh = cycles.find((cycle) => cycle.cycleIndex === 7);
    check(slot?.exerciseId === LAT.id, `${label}: the slot is the alternate`, slot?.exerciseId);
    check(cycles.length === 7 && cycles.every((cycle) => cycle.sets.length === 3), `${label}: every week has three sets`,
      cycles.map((cycle) => cycle.sets.length));
    check(cycles.every((cycle) => cycle.sets.every((set) => set.targets?.reps?.min === 4 && set.targets?.reps?.max === 7)),
      `${label}: every set in every week is 4–7 reps`, cycles.map((cycle) => cycle.sets.map((set) => set.targets)));
    check(cycles.every((cycle) => cycle.sets.every((set) => set.restSeconds === 120)), `${label}: every set rests 120 s`,
      cycles.map((cycle) => cycle.sets.map((set) => set.restSeconds)));
    check(regular.every((cycle) => cycle.sets[0].rir === 3) && seventh?.sets[0].rir === 4,
      `${label}: set 1 is RIR 3, and 4 in week 7`, cycles.map((cycle) => cycle.sets[0].rir));
  };
  await verify("after Apply");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await verify("after a reload");

  await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  await page.waitForSelector("#workout .exercise", { timeout: 5000 });
  const workout = await page.evaluate((id) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft?.exercises?.[id];
    return { sets: exercise?.setOrder?.length, name: document.querySelector(`#workout .exercise[data-ex="${id}"] .fcard__context`)?.getAttribute("aria-label") };
  }, SLOT);
  check(workout.sets === 3 && workout.name?.includes(LAT.name), "the next workout is built from the edited program", workout);
}

async function cancelJourney(page) {
  console.log("P074-S1-CANCEL");
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  const before = await storedSlot(page);
  await openEditor(page);
  await openSheet(page);
  await sheetTap(page, '[data-role="sets-step"][data-delta="1"]');
  check((await ledger(page)).length === 3, "the sheet shows the added set");
  await closeSheet(page);
  await page.locator(`${EDITOR} [data-role="undo"]`).click();
  await settled(page);
  const lines = await page.locator(`${EDITOR} [data-role="exercise-row"][data-id="${SLOT}"] [data-role="set-line"]`).count();
  check(lines === 2, "Undo reverts the last change", lines);
  check(!(await page.locator(`${EDITOR} [data-role="changes-count"]`).count()), "with nothing left to undo, the changes bar is gone");

  await openSheet(page);
  await sheetTap(page, '[data-role="sets-step"][data-delta="1"]');
  await closeSheet(page);
  await page.click("#programEditCancel");
  await page.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
  await page.click("#programEditorDiscard");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  const after = await storedSlot(page);
  check(JSON.stringify(after) === JSON.stringify(before), "Discard leaves the stored program unchanged");
  check(await page.evaluate(() => getComputedStyle(document.querySelector("nav")).display !== "none"), "the dock returns when the editor closes");
}

async function emptyDayJourney(page) {
  console.log("P074-S1-EMPTY");
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  await openEditor(page);
  await page.locator(`${EDITOR} [data-role="day-tab"][data-day="Day 3"]`).click();
  for (let index = 13; index <= 18; index++) {
    await openSheet(page, `seed-ex-${index}`);
    await page.locator(`${SHEET} [data-role="remove-exercise"]`).click();
    await page.waitForSelector(`${SHEET}`, { state: "hidden", timeout: 5000 });
    await settled(page);
  }
  const left = await page.locator(`${EDITOR} [data-role="exercise-row"]`).count();
  check(left === 0, "each exercise of the day is removed in turn, the first ones too (#434)", left);
  const state = await page.evaluate((selector) => ({
    pip: !!document.querySelector(`${selector} [data-role="day-tab"][data-day="Day 3"] [data-role="empty-pip"]`),
    banner: document.querySelector(`${selector} [data-role="day-empty"]`)?.textContent?.trim(),
    disabled: document.querySelector(`${selector} [data-role="apply"]`)?.disabled,
    reason: document.querySelector(`${selector} [data-role="apply-reason"]`)?.textContent?.trim(),
  }), EDITOR);
  check(state.pip, "the emptied day's tab carries a mark", state);
  check(/no exercises/i.test(state.banner || ""), "the day says it has no exercises", state);
  check(state.disabled === true && /each training day/i.test(state.reason || ""), "Apply is disabled with its reason above it", state);
}

async function main() {
  console.log("Plan 074 S1: the Program editor in candidate A");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
    await editJourney(page);
    await cancelJourney(page);
    await emptyDayJourney(page);
    check(!errors.length, "no page errors", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main();
