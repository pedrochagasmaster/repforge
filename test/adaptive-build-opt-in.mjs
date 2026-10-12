#!/usr/bin/env node
/**
 * P069-S4 first-contract production proof. A lifter builds a program through
 * the real entry hub and adds a checked catalog movement. The new slot keeps
 * Build's visible 6–10 target, has no confirmed RIR, and starts manual. The
 * contract gap is the missing per-slot opt-in that would let the lifter
 * confirm the range and provide the RIR without inventing either.
 *
 * Initial failure is retained before the opt-in implementation is written.
 * Run: node tools/run-tests.mjs entry --suite-id test-adaptive-build-opt-in-mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const EXERCISE_ID = "2aa5c6f170d880c08fcbf27e03a0e2dc";
const EXERCISE_NAME = "45° glute-biased leg press";
const SECOND_EXERCISE_ID = "19f5c6f170d8808bb424e98de4472a7e";
const SECOND_EXERCISE_NAME = "Barbell bench press";
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

const browser = await launchChromium();
let context;
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.fill("#entryProgramName", "Suggest loads contract proof");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });
  await page.locator('#onbProgramEditor [data-role="add-exercise"][data-day="Day 1"]').click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", EXERCISE_NAME);
  const option = page.locator(`#exPickList [data-pick="${EXERCISE_ID}"]`);
  await option.waitFor({ timeout: 5000 });
  await option.click();
  await page.waitForFunction(() =>
    document.querySelectorAll('#onbProgramEditor [data-role="exercise"]').length > 0,
    undefined, { timeout: 10000 });
  await page.locator('#onbProgramEditor [data-role="toggle-day"][data-day="Day 2"]').click();
  await page.locator('#onbProgramEditor [data-role="add-exercise"][data-day="Day 2"]').click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", SECOND_EXERCISE_NAME);
  const secondOption = page.locator(`#exPickList [data-pick="${SECOND_EXERCISE_ID}"]`);
  await secondOption.waitFor({ timeout: 5000 });
  await secondOption.click();
  await page.waitForFunction((id) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    return definition?.days?.some((day) => day.slots?.some((slot) => slot.exerciseId === id));
  }, SECOND_EXERCISE_ID, { timeout: 10000 });

  const row = page.locator('#onbProgramEditor [data-role="exercise"]').first();
  if (!await row.locator('[data-role="sets-control"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
  await page.waitForFunction((id) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    return definition?.days?.some((day) => day.slots?.some((slot) => slot.exerciseId === id));
  }, EXERCISE_ID, { timeout: 10000 });

  const initial = await page.evaluate((id) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    const slot = definition?.days?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === id);
    const sets = slot?.prescriptionsByCycle?.flatMap((cycle) => cycle.sets || []) || [];
    return {
      route: window.__repforgeEntryState?.()?.route,
      step: window.__repforgeEntryState?.()?.step,
      exerciseId: slot?.exerciseId,
      metricIds: slot?.metricIds,
      cycles: slot?.prescriptionsByCycle?.length,
      firstTarget: sets[0]?.targets?.reps,
      allManual: sets.length > 0 && sets.every((set) => set.status === "manual" && set.provenance?.source === "manual"),
      allUnconfirmed: sets.length > 0 && sets.every((set) => set.rir == null && set.provenance?.policyVersion !== "manual-adaptive@1"),
      setCount: sets.length,
      editorText: document.querySelector('#onbProgramEditor [data-role="exercise"]')?.innerText,
    };
  }, EXERCISE_ID);
  check(initial.route === "build" && initial.step === "editor", "real Build journey reached its per-slot editor", initial);
  check(initial.firstTarget?.min === 6 && initial.firstTarget?.max === 10,
    "Build's current 6–10 range is represented on the new catalog slot", initial);
  check(initial.allManual && initial.allUnconfirmed,
    "new Build slots are off by default and do not acquire an RIR the lifter has not confirmed", initial);

  const switchCount = await page.getByText("Suggest loads", { exact: true }).count();
  const switchVisible = switchCount > 0 && await page.getByText("Suggest loads", { exact: true }).first().isVisible();
  check(switchCount > 0,
    "the actual Build editor exposes the per-slot Suggest loads opt-in", { switchCount, switchVisible, initial, pageErrors });
  const loadStep = row.locator('[data-role="load-step"]');
  const loadStepCount = await loadStep.count();
  check(loadStepCount === 1,
    "Build exposes the same effective per-exercise load step as the installed editor", { loadStepCount, initial });
  if (loadStepCount === 1) {
    const initialLoadStep = await loadStep.inputValue();
    check(initialLoadStep === "2.5",
      "a new Build slot shows the current 2.5 kg global minimum jump when no override exists", { initialLoadStep });
    await loadStep.click();
    await loadStep.press("Control+A");
    await loadStep.pressSequentially("1.25");
    const filledLoadStep = await loadStep.inputValue();
    await loadStep.press("Tab");
    const staged = await page.waitForFunction((id) => {
      const envelope = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "null");
      return envelope?.state?.result?.preview?.loadingConfiguration?.byExerciseId?.[id]?.loadStepKg === 1.25;
    }, EXERCISE_ID, { timeout: 3000 }).then(() => true, () => false);
    const stageFacts = await page.evaluate(({ id }) => {
      const envelope = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "null");
      const preview = envelope?.state?.result?.preview;
      return {
        stagedStep: preview?.loadingConfiguration?.byExerciseId?.[id]?.loadStepKg ?? null,
        draftPresent: !!envelope?.state?.result?.preview,
      };
    }, { id: EXERCISE_ID });
    check(filledLoadStep === "1.25" && staged && stageFacts.draftPresent,
      "the edited load-step value is persisted in the Build setup draft", { filledLoadStep, staged, ...stageFacts });
    check(staged && stageFacts.stagedStep === 1.25,
      "the canonical Build setup draft retains the explicit per-exercise load step", stageFacts);

    if (stageFacts.stagedStep === 1.25) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(page, { base: BASE });
      const firstRunCreate = page.locator("#firstRunCreate");
      if (await firstRunCreate.isVisible().catch(() => false)) await firstRunCreate.click();
      await page.waitForSelector("#onboarding.active", { timeout: 10000 });
      const resume = page.locator("#entryResumeContinue");
      await resume.waitFor({ timeout: 10000 });
      await resume.click();
      await page.waitForSelector('#onboarding.active #onbProgramEditor [data-role="exercise"]', { timeout: 10000 });
      const resumedRow = page.locator('#onbProgramEditor [data-role="exercise"]').first();
      if (!await resumedRow.locator('[data-role="load-step"]').count())
        await resumedRow.locator('[data-role="toggle-exercise"]').click();
      await page.waitForSelector('#onboarding.active #onbProgramEditor [data-role="load-step"]', { timeout: 10000 });
      const resumedStep = await resumedRow.locator('[data-role="load-step"]').inputValue();
      check(resumedStep === "1.25",
        "the explicit per-exercise load step survives setup-draft reload", { resumedStep });

      await page.click("#entryEditorActivate");
      const activated = await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem("repforge_v1") || "null");
        return state?.programMeta?.onboarded === true;
      }, undefined, { timeout: 10000 }).then(() => true, () => false);
      const activationFacts = await page.evaluate((id) => {
        const state = JSON.parse(localStorage.getItem("repforge_v1") || "null");
        return {
          onboarded: state?.programMeta?.onboarded === true,
          activatedStep: state?.programMeta?.loadingConfiguration?.byExerciseId?.[id]?.loadStepKg ?? null,
        };
      }, EXERCISE_ID);
      check(activated && activationFacts.onboarded && activationFacts.activatedStep === 1.25,
        "Build activation carries the explicit per-exercise load step into durable program metadata", { activated, ...activationFacts });
    }
  }
  check(pageErrors.length === 0, "Build opt-in journey has no uncaught browser errors", pageErrors);
} finally {
  await context?.close();
  await browser.close();
}

console.log(`\nP069-S4 first-contract proof: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
