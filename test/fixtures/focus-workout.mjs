export async function selectExercise(page, id) {
  if (await page.locator(`#workout .exercise.is-current[data-ex="${id}"]`).count()) return;
  await page.locator("#sessionSheetBtn").click();
  await page.locator(`[data-session-map-jump="${id}"]`).click();
  await page.locator("#sessionSheet").waitFor({ state: "hidden" });
}

export async function openActions(page, id) {
  await selectExercise(page, id);
  if (!await page.locator("#exActionsSheet").isVisible()) {
    await page.locator("#woOverflowBtn").click(); await page.locator('[data-workout-action="exercise"]').click();
  }
}

export async function exerciseAction(page, id, selector) {
  await openActions(page, id);
  await page.locator(selector).click();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#exActionsSheet").waitFor({ state: "hidden" });
}

export async function sessionField(page, selector, value) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator(selector).fill(String(value));
  await page.locator(selector).blur();
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#sessionSheetClose").click();
  await page.locator("#sessionSheet").waitFor({ state: "hidden" });
}

export async function openEarlyFinish(page) {
  // The app keeps the last finish promise for harness observation. Clear that
  // receipt before starting a new confirmation so a later test cannot read a
  // previously settled finish while the new click handler is still pending.
  await page.evaluate(() => { window.__repforgeLastWorkoutFinish = null; });
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
}

export async function finishEarly(page) {
  await openEarlyFinish(page);
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, undefined, { timeout: 15000 });
  const result = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.current() === null, undefined, { timeout: 15000 });
  return result;
}

/** Layout D keeps the current exercise's logged sets behind its table's disclosure: open it, when it is closed, to
 *  read or correct them. It closes again after a correction and on another exercise. */
export async function openLoggedSets(page) {
  const more = page.locator("#workout .exercise.is-current [data-ledgermore][aria-expanded='false']");
  if (!(await more.count())) return;
  await more.click();
  await page.waitForFunction(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const rows = card?.querySelector(".ledger__rows");
    return card?.querySelector("[data-ledgermore]")?.getAttribute("aria-expanded") === "true" && rows && !rows.style.height;
  }, undefined, { timeout: 5000 });
}
