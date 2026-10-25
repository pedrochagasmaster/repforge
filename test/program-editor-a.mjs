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
 * Plan 075 phase 2B (ADR 0023): the installed editor is a page sheet over a
 * pushed-back still copy of the Program view, with Cancel and Done in its bar.
 * P075-2B-SHEET: Cancel and a clean swipe down dismiss it without asking;
 * a guarded swipe with unsaved changes springs back and asks, and Keep editing
 * returns to the sheet with the edit intact.
 * P075-2B-REDUCED-MOTION: it cross-fades open and closed with no transform travel.
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
/** The rest presets as the sheet draws them: which one reads selected (class and aria-checked agree). */
const restPresets = (page) => page.$$eval(`${SHEET} [data-role="rest-preset"]`, (items) => items.map((item) => ({
  seconds: Number(item.dataset.seconds), on: item.classList.contains("is-on"), checked: item.getAttribute("aria-checked") === "true" })));
const restsOf = (slot) => (slot?.prescriptionsByCycle || []).flatMap((cycle) => cycle.sets.map((set) => set.restSeconds ?? null));
const OTHER = "seed-ex-2";
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

/** Plan 075 phase 2B (ADR 0023): #program itself, as the page sheet. */
async function waitForPushBackSettled(page, { scale = 0.941 } = {}) {
  await page.waitForFunction((max) => {
    const el = document.querySelector(".is-editor-pushed-back");
    if (!el) return false;
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
    return m.a <= max;
  }, scale, { timeout: 5000 });
}
/** The sheet's own close transition (260ms, or the reduced-motion fade) finishes
 *  after #programEditorWrap already reads is-hidden: the host's cleanup — the
 *  classes, the pushed-back copy, and the return of focus — waits for it. */
async function waitForSheetGone(page) {
  await page.waitForFunction(() => !document.querySelector("#program")?.classList.contains("sheet"), undefined, { timeout: 5000 });
}
async function sheetOverview(page, selector) {
  return page.evaluate((sel) => {
    const pushBack = document.querySelector(".is-editor-pushed-back");
    const m = pushBack ? new DOMMatrixReadOnly(getComputedStyle(pushBack).transform === "none" ? undefined : getComputedStyle(pushBack).transform) : null;
    return {
      navHidden: getComputedStyle(document.querySelector("nav")).display === "none" || document.querySelector("nav").hidden,
      tabs: [...document.querySelectorAll(`${sel} [data-role="day-tab"]`)].map((tab) => tab.textContent.trim()),
      rows: document.querySelectorAll(`${sel} [data-role="exercise-row"]`).length,
      applyHidden: getComputedStyle(document.querySelector(`${sel} [data-role="apply"]`)).display === "none",
      title: document.querySelector("#program .page-title")?.textContent?.trim(),
      cancel: !!document.querySelector("#programEditCancel:not(.hidden)"),
      doneVisible: !document.querySelector("#programEditDone")?.classList.contains("hidden"),
      doneDisabled: document.querySelector("#programEditDone")?.disabled,
      sheetRole: document.querySelector("#program")?.getAttribute("role"),
      sheetModal: document.querySelector("#program")?.getAttribute("aria-modal"),
      sheetLabelledby: document.querySelector("#program")?.getAttribute("aria-labelledby"),
      pushBack: !!pushBack,
      pushBackInert: pushBack?.inert,
      pushBackAriaHidden: pushBack?.getAttribute("aria-hidden"),
      pushBackScale: m?.a ?? null,
      setLines: document.querySelectorAll(`${sel} [data-role="exercise-row"][data-id="seed-ex-1"] [data-role="set-line"]`).length,
    };
  }, selector);
}

async function editJourney(page) {
  console.log("P074-S1-EDIT");
  await openEditor(page);
  await waitForPushBackSettled(page);
  const overview = await sheetOverview(page, EDITOR);
  check(overview.tabs.length === 3, "the overview has one tab per training day", overview);
  check(overview.rows === 6, "the first day's six exercises are listed as rows", overview);
  check(overview.setLines === 2, "a row shows one line per set", overview);
  check(overview.applyHidden && overview.navHidden, "the editor's own Apply is hidden; the dock stays where it was", overview);
  check(overview.title === "Edit program" && overview.cancel, "the header reads Edit program with Cancel", overview);
  check(overview.doneVisible && !overview.doneDisabled, "Done is shown and enabled", overview);
  check(overview.sheetRole === "dialog" && overview.sheetModal === "true" && overview.sheetLabelledby === "programTitle",
    "the sheet is a dialog labelled by its title", overview);
  check(overview.pushBack && overview.pushBackInert === true && overview.pushBackAriaHidden === "true" && overview.pushBackScale < 1,
    "a pushed-back copy of the Program view sits beneath it, inert, aria-hidden and scaled down", overview);

  // Rest (owner, 2026-10-25: option A). A slot that stores no rest inherits the Settings rest length (120 s): its preset
  // reads selected while restSeconds stays null; a default that is no preset selects none; a tap stores it explicitly.
  const otherBefore = restsOf(await storedSlot(page, OTHER));
  check(otherBefore.length > 0 && otherBefore.every((rest) => rest === null), "the other slot stores no rest to begin with", otherBefore);
  await openSheet(page, OTHER);
  const inherited = await restPresets(page);
  check(inherited.filter((p) => p.on && p.checked).map((p) => p.seconds).join() === "120" && inherited.filter((p) => p.on || p.checked).length === 1,
    "with no stored rest, the preset matching the Settings rest length (120 s) reads selected", inherited);
  await closeSheet(page);
  await page.evaluate(() => { state.settings.restSec = 100; });
  await openSheet(page, OTHER);
  const none = await restPresets(page);
  check(none.length > 0 && none.every((p) => !p.on && !p.checked), "a Settings rest length that is no preset (100 s) selects none", none);
  await closeSheet(page);
  await page.evaluate(() => { state.settings.restSec = 120; });

  await openSheet(page);
  const before = await restPresets(page);
  check(before.find((p) => p.seconds === 120)?.on, "the edited slot also reads its inherited 120 s before the tap", before);
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

  // The editor's own bottom Apply is hidden in the sheet; Done is the commit action.
  await page.locator("#programEditDone").click();
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  await waitForSheetGone(page);
  const closed = await page.evaluate(() => ({
    sheet: document.querySelector("#program")?.classList.contains("sheet"),
    pushBack: !!document.querySelector(".is-editor-pushed-back"),
    focus: document.activeElement?.id,
  }));
  check(!closed.sheet && !closed.pushBack, "Done closes the sheet and removes the pushed-back copy", closed);
  check(closed.focus === "programEditToggle", "focus returns to Edit", closed);
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
  // The tap on the already-selected inherited 120 s stored it (verify: every set rests 120 s); the slot only looked at
  // keeps no stored rest.
  const otherAfter = restsOf(await storedSlot(page, OTHER));
  check(otherAfter.length > 0 && otherAfter.every((rest) => rest === null), "the slot whose inherited preset was only shown still stores no rest (null)", otherAfter);
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

/** A point on the sheet's drag rail: the grabber, or the bar beneath it. */
async function sheetGrip(page) {
  const box = await page.locator("#programEditGrab").boundingBox();
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}
/** A real pointer drag (test/sheet-swipe-dismiss.mjs's technique): a short pause between
 *  samples reads as a flick, a long final one leaves the release velocity at rest. */
async function sheetDrag(page, from, steps, { pause = 16, settleAt = 0 } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const [dx, dy] of steps) {
    await page.mouse.move(from.x + dx, from.y + dy);
    await page.waitForTimeout(pause);
  }
  if (settleAt) await page.waitForTimeout(settleAt);
  await page.mouse.up();
}
const sheetDown = (to, n = 6) => Array.from({ length: n }, (_, i) => [0, Math.round((to * (i + 1)) / n)]);
const sheetClosed = (page) => page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });

async function sheetJourney(page) {
  console.log("P075-2B-SHEET");
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });

  // Cancel with no edits closes at once; no leave dialog is asked.
  await openEditor(page);
  await waitForPushBackSettled(page);
  await page.click("#programEditCancel");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  await waitForSheetGone(page);
  check(!(await page.locator("#programEditorLeave[open]").count()), "Cancel with no edits closes without asking");
  check(!(await page.locator(".is-editor-pushed-back").count()), "and the pushed-back copy is gone");
  check((await page.evaluate(() => document.activeElement?.id)) === "programEditToggle", "focus returns to Edit");

  // A swipe down with no edits dismisses the sheet, exactly like Cancel.
  await openEditor(page);
  await waitForPushBackSettled(page);
  const cleanRail = await sheetGrip(page);
  await sheetDrag(page, cleanRail, sheetDown(500), { settleAt: 360 });
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  await waitForSheetGone(page);
  check(!(await page.locator("#programEditorLeave[open]").count()), "a clean swipe down dismisses it without asking");

  // A swipe down with edits does not dismiss: it rubber-bands, springs back, and
  // the leave dialog opens, same as Cancel. Keep editing returns with the edit intact.
  await openEditor(page);
  await waitForPushBackSettled(page);
  await openSheet(page);
  await sheetTap(page, '[data-role="sets-step"][data-delta="1"]');
  await closeSheet(page);
  const dirtyRail = await sheetGrip(page);
  await sheetDrag(page, dirtyRail, sheetDown(500), { settleAt: 360 });
  await page.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
  const afterGuardedDrag = await page.evaluate(() => ({
    sheetOpen: document.querySelector("#program")?.classList.contains("is-open"),
    pushBack: !!document.querySelector(".is-editor-pushed-back"),
  }));
  check(afterGuardedDrag.sheetOpen && afterGuardedDrag.pushBack,
    "a guarded swipe with edits returns the sheet to rest instead of dismissing it", afterGuardedDrag);
  await page.click("#programEditorKeep");
  await page.waitForFunction(() => !document.querySelector("#programEditorLeave")?.open, undefined, { timeout: 5000 });
  const kept = await page.locator(`${EDITOR} [data-role="exercise-row"][data-id="${SLOT}"] [data-role="set-line"]`).count();
  check(kept === 3, "Keep editing returns to the sheet with the edit intact", kept);
  await page.click("#programEditCancel");
  await page.waitForSelector("#programEditorLeave[open]", { timeout: 5000 });
  await page.click("#programEditorDiscard");
  await sheetClosed(page);
}

async function reducedMotionJourney(browser) {
  console.log("P075-2B-REDUCED-MOTION");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
    const sample = (opening) => page.evaluate((isOpening) => new Promise((resolve) => {
      const sheet = document.querySelector("#program");
      const frames = [];
      const t0 = performance.now();
      if (isOpening) document.querySelector("#programEditToggle").click();
      else document.querySelector("#programEditCancel").click();
      const tick = () => {
        const style = getComputedStyle(sheet);
        frames.push({ t: Math.round(performance.now() - t0), opacity: Number(style.opacity), transform: style.transform });
        if (performance.now() - t0 < 300) requestAnimationFrame(tick); else resolve(frames);
      };
      requestAnimationFrame(tick);
    }), opening);
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#programEditToggle", { timeout: 10000 });
    const opening = await sample(true);
    const identity = (t) => t === "none" || /matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)/.test(t);
    const openNoTravel = opening.every((frame) => identity(frame.transform));
    const openFades = opening.some((frame) => frame.opacity > 0.02 && frame.opacity < 0.98) && opening.at(-1)?.opacity === 1;
    check(openNoTravel, "reduced motion: the sheet opens with no transform travel", opening.slice(0, 6));
    check(openFades, "reduced motion: the sheet cross-fades open", opening.slice(0, 8));
    const closing = await sample(false);
    const closeNoTravel = closing.every((frame) => identity(frame.transform));
    const closeFades = closing.some((frame) => frame.opacity > 0.02 && frame.opacity < 0.98);
    check(closeNoTravel, "reduced motion: the sheet closes with no transform travel", closing.slice(0, 6));
    check(closeFades, "reduced motion: the sheet cross-fades closed", closing.slice(0, 8));
  } finally {
    await context.close();
  }
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
    barVisible: getComputedStyle(document.querySelector(`${selector} [data-role="apply-bar"]`)).display !== "none",
    doneDisabled: document.querySelector("#programEditDone")?.disabled,
  }), EDITOR);
  check(state.pip, "the emptied day's tab carries a mark", state);
  check(/no exercises/i.test(state.banner || ""), "the day says it has no exercises", state);
  check(state.disabled === true && /each training day/i.test(state.reason || ""), "Apply is disabled with its reason above it", state);
  // Plan 075 phase 2B: the sheet's Done is the commit action now; the editor's own Apply
  // stays hidden, but its blocked reason is what the bar shows while Done is disabled.
  check(state.barVisible, "the bar stays visible for its reason while blocked", state);
  check(state.doneDisabled === true, "Done is disabled while the day is empty", state);

  // #440's rest pill and the editor's Undo toast float over the page: while editing they ride above the pinned
  // Apply band (its blocked reason included), the toast above the pill, and the sheet's own scroller
  // (#programEditorWrap, not the body: Plan 075 phase 2B moved #program off the normal flow) reserves room for all three.
  const stack = await page.evaluate((selector) => {
    const pill = document.querySelector("#restBar");
    pill.classList.remove("hidden");
    pill.hidden = false;
    const toast = document.createElement("div");
    toast.className = "review-toast";
    toast.textContent = "Removed.";
    document.body.append(toast);
    const box = (element) => element.getBoundingClientRect();
    const out = { pill: box(pill).bottom, pillTop: box(pill).top, toast: box(toast).bottom,
      bar: box(document.querySelector(`${selector} [data-role="apply-bar"]`)).top,
      reserve: parseFloat(getComputedStyle(document.querySelector("#programEditorWrap")).paddingBottom), viewport: innerHeight };
    toast.remove();
    pill.classList.add("hidden");
    return out;
  }, EDITOR);
  check(stack.pill <= stack.bar && stack.toast <= stack.pillTop, "the rest pill rides above the pinned Apply and the Undo toast above the pill", stack);
  check(stack.reserve >= stack.viewport - stack.pillTop, "the sheet's own scroller reserves the band the bar and the pill cover", stack);
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
    await sheetJourney(page);
    await emptyDayJourney(page);
    await reducedMotionJourney(browser);
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
