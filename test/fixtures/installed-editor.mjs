/**
 * Driving the installed Program editor (Plan 074, ADR 0021: candidate A; the
 * page sheet of Plan 075 phase 2B, ADR 0023).
 *
 * Program → Edit opens the editor as a page sheet: day tabs, one row per
 * exercise, a sheet per exercise in #reviewSheet, Cancel and Done in the
 * sheet's own bar, and the editor's own bottom bar hidden except for its
 * blocked reason. Suites that used the classic cards go through these
 * helpers so a later layout change has one place to land.
 */

export const EDITOR = "#programEditor";
export const SHEET = "#reviewSheet";

/** The editor has drawn and no edit is in flight. */
export function editorSettled(page, { timeout = 10000 } = {}) {
  return page.waitForFunction((selector) => {
    const editor = document.querySelector(`${selector} [data-role="editor"][data-layout="review"]`);
    return !!editor && editor.getAttribute("aria-busy") !== "true";
  }, EDITOR, { timeout });
}

/** Program → Edit. Leaves the editor drawn and idle. */
export async function openInstalledEditor(page) {
  if (!(await page.locator("#program.view.active").count())) {
    await page.click('nav button[data-view="program"]');
    await page.waitForSelector("#program.view.active");
  }
  await page.click("#programEditToggle");
  await page.waitForSelector(`${EDITOR} [data-role="editor"][data-layout="review"]`, { timeout: 10000 });
  await editorSettled(page);
}

/** Show the day tab whose label is `day`. */
export async function showEditorDay(page, day) {
  const tab = page.locator(`${EDITOR} [data-role="day-tab"][data-day="${day}"]`);
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await page.waitForSelector(`${EDITOR} [data-role="day-tab"][data-day="${day}"][aria-selected="true"]`);
}

/** Show the tab that holds the exercise, whichever day it is on. */
export async function showEditorExercise(page, id) {
  const row = `${EDITOR} [data-role="exercise-row"][data-id="${id}"]`;
  if (await page.locator(row).count()) return;
  for (const tab of await page.locator(`${EDITOR} [data-role="day-tab"]`).all()) {
    await tab.click();
    if (await page.locator(row).count()) return;
  }
  throw new Error(`no editor row for ${id}`);
}

/** Open an exercise's sheet. */
export async function openExerciseSheet(page, id) {
  await showEditorExercise(page, id);
  await page.locator(`${EDITOR} [data-role="exercise-row"][data-id="${id}"]`).click();
  await page.waitForSelector(`${SHEET}.is-open [data-pe-sheet="exercise"][data-id="${id}"]`, { timeout: 5000 });
}

/** Tap a control in the open sheet and wait for its edit to settle. */
export async function sheetTap(page, selector) {
  await page.locator(`${SHEET} ${selector}`).click();
  await editorSettled(page);
}

/** Done on the open sheet. */
export async function closeEditorSheet(page) {
  if (!(await page.locator(`${SHEET}.is-open`).count())) return;
  await page.locator(`${SHEET} [data-role="sheet-done"]`).click();
  await page.waitForSelector(SHEET, { state: "hidden", timeout: 5000 });
}

/** Step the open exercise's set count to `count` (every week). */
export async function setSheetSetCount(page, count) {
  for (let guard = 0; guard < 120; guard++) {
    const shown = Number((await page.locator(`${SHEET} [data-role="sets-step-value"]`).textContent()).match(/\d+/)?.[0]);
    if (shown === count) return;
    await sheetTap(page, `[data-role="sets-step"][data-delta="${shown < count ? 1 : -1}"]`);
  }
  throw new Error(`set count did not reach ${count}`);
}

/** Done, the sheet's commit action. Resolves when the editor has closed. */
export async function applyInstalledEditor(page, { timeout = 10000 } = {}) {
  await closeEditorSheet(page);
  await page.locator("#programEditDone").click();
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout });
}

/** Cancel from the header. With changes, the leave dialog opens and the caller answers it. */
export async function cancelInstalledEditor(page) {
  await closeEditorSheet(page);
  await page.click("#programEditCancel");
}
