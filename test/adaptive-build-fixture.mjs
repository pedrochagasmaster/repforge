/**
 * Plan 069 S4 browser fixture: a Build program made through the real entry
 * hub and editor, with Suggest loads confirmed on its bench press slot by
 * "Use this program". The P069-S4-OPTIN proof owns the step-by-step contract;
 * the other S4 proofs start from its result.
 */
export const BENCH_ID = "19f5c6f170d8808bb424e98de4472a7e";
export const BENCH_NAME = "Barbell bench press";
export const LEG_PRESS_ID = "2aa5c6f170d880c08fcbf27e03a0e2dc";
export const LEG_PRESS_NAME = "45° glute-biased leg press";

async function pick(page, day, name, id) {
  await page.locator(`#onbProgramEditor [data-role="add-exercise"][data-day="${day}"]`).click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", name);
  const option = page.locator(`#exPickList [data-pick="${id}"]`);
  await option.waitFor({ timeout: 5000 });
  await option.click();
  await page.waitForFunction((exerciseId) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    return definition?.days?.some((entry) => entry.slots?.some((slot) => slot.exerciseId === exerciseId));
  }, id, { timeout: 10000 });
}

/** Builds the two-day program; `optInRir` null leaves every slot manual. */
export async function buildProgram(page, { name = "Suggest loads proof", optInRir = 2 } = {}) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.fill("#entryProgramName", name);
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });
  await pick(page, "Day 1", BENCH_NAME, BENCH_ID);
  await page.locator('#onbProgramEditor [data-role="toggle-day"][data-day="Day 2"]').click();
  await pick(page, "Day 2", LEG_PRESS_NAME, LEG_PRESS_ID);
  if (optInRir != null) {
    const row = page.locator('#onbProgramEditor [data-role="exercise"]').filter({ hasText: BENCH_NAME }).first();
    if (!await row.locator('[data-role="sets-control"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
    await row.locator('[data-role="suggest-loads"]').click();
    const rir = row.locator('[data-role="suggest-loads-rir"]');
    await rir.waitFor({ timeout: 5000 });
    await rir.fill(String(optInRir));
    await rir.press("Tab");
    await page.waitForFunction(({ id, value }) => {
      const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
      const slot = definition?.days?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === id);
      return slot?.prescriptionsByCycle?.every((cycle) => cycle.sets.every((set) => set.rir === value));
    }, { id: BENCH_ID, value: optInRir }, { timeout: 5000 });
  }
  await page.click("#entryEditorActivate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
    undefined, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active")
    && window.__repforgeWorkoutDraft?.state()?.programMeta?.onboarded === true, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "null");
    const row = state.program.find((entry) => entry.libraryId === id);
    return { row, slotId: row?.slotId || row?.id };
  }, BENCH_ID);
}

/** Facts about one slot, from the live durable state. */
export function durableSlot(page, exerciseId = BENCH_ID) {
  return page.evaluate((id) => {
    const definition = JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.programDefinition;
    const slot = definition?.days?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === id);
    const sets = slot?.prescriptionsByCycle?.flatMap((cycle) => cycle.sets || []) || [];
    return {
      slot,
      statuses: [...new Set(sets.map((set) => set.status))],
      rirs: sets.map((set) => set.rir),
      targets: sets.map((set) => set.targets?.reps ?? null),
      policies: [...new Set(sets.map((set) => `${set.provenance?.source}/${set.provenance?.policyVersion}`))],
    };
  }, exerciseId);
}

export async function openInstalledEditor(page, exerciseName = BENCH_NAME) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden")))
    await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
  const row = page.locator('#programEditor [data-role="exercise"]').filter({ hasText: exerciseName }).first();
  const day = row.locator("xpath=ancestor::*[@data-role='day']");
  const toggleDay = day.locator('[data-role="toggle-day"]');
  if (await toggleDay.count() && await toggleDay.getAttribute("aria-expanded") === "false") await toggleDay.click();
  if (!await row.locator('[data-role="sets-control"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
  await row.locator('[data-role="sets-control"]').waitFor({ timeout: 5000 });
  return row;
}

/**
 * A representative Build program: `days` lists [exerciseId, name] pairs per
 * day. Every eligible slot is opted in with `rir`; `modes` answers the
 * execution-mode question by exercise id where the movement asks it.
 */
export async function buildRepresentativeProgram(page, { name, days, rir = 2, modes = {} }) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.fill("#entryProgramName", name);
  await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${days.length}"]`);
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });
  for (const [index, exercises] of days.entries()) {
    const day = `Day ${index + 1}`;
    const toggle = page.locator(`#onbProgramEditor [data-role="toggle-day"][data-day="${day}"]`);
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    for (const [id, exerciseName] of exercises) await pick(page, day, exerciseName, id);
  }
  for (const exercises of days) for (const [id, exerciseName] of exercises) {
    const row = page.locator('#onbProgramEditor [data-role="exercise"]').filter({ hasText: exerciseName }).first();
    const day = row.locator("xpath=ancestor::*[@data-role='day']");
    const toggleDay = day.locator('[data-role="toggle-day"]');
    if (await toggleDay.getAttribute("aria-expanded") === "false") await toggleDay.click();
    if (!await row.locator('[data-role="sets-control"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
    const toggle = row.locator('[data-role="suggest-loads"]');
    if (!await toggle.count()) continue;
    await toggle.click();
    const field = row.locator('[data-role="suggest-loads-rir"]');
    await field.waitFor({ timeout: 5000 });
    await field.fill(String(rir));
    await field.press("Tab");
    await page.waitForFunction((exerciseId) => {
      const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
      const slot = definition?.days?.flatMap((entry) => entry.slots || []).find((candidate) => candidate.exerciseId === exerciseId);
      return slot?.prescriptionsByCycle?.every((cycle) => cycle.sets.every((set) => set.rir != null));
    }, id, { timeout: 5000 });
    if (modes[id]) {
      await row.locator(`[data-role="execution-mode"][data-mode="${modes[id]}"]`).click();
      await page.waitForFunction(({ exerciseId, mode }) => {
        const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
        return definition?.days?.flatMap((entry) => entry.slots || []).some((slot) => slot.exerciseId === exerciseId && slot.executionMode === mode);
      }, { exerciseId: id, mode: modes[id] }, { timeout: 5000 });
    }
    await row.locator('[data-role="toggle-exercise"]').click();
  }
  await page.click("#entryEditorActivate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
    undefined, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active")
    && window.__repforgeWorkoutDraft?.state()?.programMeta?.onboarded === true, undefined, { timeout: 15000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}
