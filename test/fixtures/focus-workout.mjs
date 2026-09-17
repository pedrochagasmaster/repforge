export async function selectExercise(page, id) {
  if (await page.locator(`#workout .exercise.is-current[data-ex="${id}"]`).count()) return;
  await page.locator("#sessionSheetBtn").click();
  await page.locator(`[data-session-map-jump="${id}"]`).click();
  await page.locator("#sessionSheet").waitFor({ state: "hidden" });
}

export async function openActions(page, id) {
  await selectExercise(page, id);
  if (!await page.locator("#exActionsSheet").isVisible()) {
    await page.locator("#workout .exercise.is-current [data-exactions-open]").click();
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

export async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
}
