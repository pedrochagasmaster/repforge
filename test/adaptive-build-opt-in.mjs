#!/usr/bin/env node
/**
 * P069-S4-OPTIN: Build's per-slot "Suggest loads" opt-in through the real
 * entry hub, editor, activation and two workout sessions.
 *
 * A new Build slot keeps Build's visible 6–10 target, has no confirmed RIR and
 * starts manual. Turning the switch on reveals the current range, an empty
 * required RIR and the load step, but commits nothing. "Use this program"
 * refuses an incomplete opt-in with the error on the RIR field; Save draft
 * keeps the incomplete state across a reload without making the slot ready.
 * Once the RIR is given, activation makes every set ready with the
 * lifter's RIR and manual-adaptive provenance, and the session after the first
 * logged one receives the engine's target. A load the lifter types survives a
 * reload and the recalculation that follows.
 *
 * Run: node tools/run-tests.mjs entry --suite-id test-adaptive-build-opt-in-mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const EXERCISE_ID = "19f5c6f170d8808bb424e98de4472a7e";
const EXERCISE_NAME = "Barbell bench press";
const SECOND_EXERCISE_ID = "2aa5c6f170d880c08fcbf27e03a0e2dc";
const SECOND_EXERCISE_NAME = "45° glute-biased leg press";
const SETUP_KEY = "repforge_program_setup_draft_v1";
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
  if (detail !== undefined) console.error(`    ${JSON.stringify(detail).slice(0, 3000)}`);
}

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

function benchRow(page) {
  return page.locator(`#onbProgramEditor [data-role="exercise"]`).filter({ hasText: EXERCISE_NAME }).first();
}

async function expand(row) {
  if (!await row.locator('[data-role="sets-control"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
  await row.locator('[data-role="sets-control"]').waitFor({ timeout: 5000 });
}

const slotFacts = (page, source) => page.evaluate(({ id, source, key }) => {
  const definition = source === "draft"
    ? JSON.parse(localStorage.getItem(key) || "null")?.state?.result?.preview?.programDefinition
    : source === "state"
      ? JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.programDefinition
      : window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
  const slot = definition?.days?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === id);
  const sets = slot?.prescriptionsByCycle?.flatMap((cycle) => cycle.sets || []) || [];
  return {
    slotId: slot?.id || null,
    metricIds: slot?.metricIds || [],
    cycles: slot?.prescriptionsByCycle?.length || 0,
    setCount: sets.length,
    statuses: [...new Set(sets.map((set) => set.status))],
    rirs: [...new Set(sets.map((set) => set.rir))],
    policies: [...new Set(sets.map((set) => `${set.provenance?.source}/${set.provenance?.policyVersion}`))],
    target: sets[0]?.targets?.reps ?? null,
  };
}, { id: EXERCISE_ID, source, key: SETUP_KEY });

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logSet(page, rowId, ordinal, metricIds, { load, reps, rir }) {
  await fillShelf(page, metricIds[0], load);
  await fillShelf(page, metricIds[1], reps);
  const rirInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${rowId}_${ordinal}_rir"]`);
  if (await rirInput.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rirInput.fill(String(rir));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${rowId}_${ordinal}"]`).click();
  await page.waitForFunction(({ rowId, ordinal }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[rowId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    return typeof exercise?.sets?.[setId]?.completion === "object";
  }, { rowId, ordinal }, { timeout: 15000 });
}

async function selectExercise(page, rowId) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), rowId);
  try {
    await page.waitForFunction((id) => document.querySelector("#workout.is-focus .exercise.is-current")?.dataset.ex === id,
      rowId, { timeout: 15000 });
  } catch (error) {
    const observed = await page.evaluate(() => ({
      view: document.querySelector(".view.active")?.id || null,
      current: document.querySelector("#workout .exercise.is-current")?.dataset.ex || null,
      focus: !!document.querySelector("#workout.is-focus"),
      openDialogs: [...document.querySelectorAll("dialog[open], .sheet.is-open")].map((node) => node.id),
    }));
    throw new Error(`${error.message} ${JSON.stringify({ rowId, ...observed })}`);
  }
}

async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

const browser = await launchChromium();
let context;
try {
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error?.stack || error)));
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await page.click('[data-entry-hub="build"]');
  await page.click("#onbNext");
  await page.fill("#entryProgramName", "Suggest loads proof");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="add-exercise"]', { timeout: 10000 });
  await pick(page, "Day 1", EXERCISE_NAME, EXERCISE_ID);
  await page.locator('#onbProgramEditor [data-role="toggle-day"][data-day="Day 2"]').click();
  await pick(page, "Day 2", SECOND_EXERCISE_NAME, SECOND_EXERCISE_ID);

  const row = benchRow(page);
  await expand(row);
  const initial = await slotFacts(page, "entry");
  check(initial.target?.min === 6 && initial.target?.max === 10,
    "Build's current 6–10 range is the new catalog slot's stored target", initial);
  check(initial.statuses.join() === "manual" && initial.rirs.length === 1 && initial.rirs[0] === null && initial.policies.join() === "manual/manual@1",
    "a new Build slot starts manual, without an RIR the lifter has not confirmed", initial);

  const toggle = row.locator('[data-role="suggest-loads"]');
  const toggleCount = await toggle.count();
  const toggleName = toggleCount === 1 ? await page.evaluate((node) =>
    (node.getAttribute("aria-labelledby") || "").split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" "),
  await toggle.elementHandle()) : null;
  check(toggleCount === 1 && await toggle.getAttribute("role") === "switch" && await toggle.getAttribute("aria-checked") === "false"
    && toggleName === "Suggest loads",
  "the Build editor shows an off Suggest loads switch on the catalog slot", { toggleCount, toggleName });
  if (toggleCount !== 1) throw new Error("Suggest loads switch is missing");
  check(await row.locator('[data-role="suggest-loads-rir"]').count() === 0,
    "the opt-in fields stay hidden while the switch is off");

  await toggle.click();
  await page.waitForFunction(() => document.querySelector('#onbProgramEditor [data-role="suggest-loads"][aria-checked="true"]'),
    undefined, { timeout: 5000 });
  const section = row.locator('[data-role="suggest-loads-section"]');
  const revealed = {
    range: await section.locator('[data-role="suggest-loads-range"]').innerText().catch(() => null),
    rir: await section.locator('[data-role="suggest-loads-rir"]').inputValue().catch(() => null),
    step: await section.locator('[data-role="load-step"]').inputValue().catch(() => null),
    mode: await section.locator('[data-role="execution-mode"]').count(),
  };
  check(revealed.range === "Current rep target · 6–10" && revealed.rir === "" && revealed.step === "2.5" && revealed.mode === 0,
    "the switch reveals the current 6–10 target, an empty RIR and the 2.5 kg step, with no mode question for a bilateral lift", revealed);
  const afterSwitch = await slotFacts(page, "entry");
  check(afterSwitch.statuses.join() === "manual" && afterSwitch.rirs.length === 1 && afterSwitch.rirs[0] === null,
    "the switch alone confirms nothing: every set stays manual", afterSwitch);

  // Load step, carried from the earlier staged slice of this packet.
  const loadStep = section.locator('[data-role="load-step"]');
  await loadStep.fill("1.25");
  await loadStep.press("Tab");
  await page.waitForFunction(({ id, key }) =>
    JSON.parse(localStorage.getItem(key) || "null")?.state?.result?.preview?.loadingConfiguration?.byExerciseId?.[id]?.loadStepKg === 1.25,
  { id: EXERCISE_ID, key: SETUP_KEY }, { timeout: 5000 });
  passed++; console.log("  ✓ the explicit per-exercise load step is staged in the Build setup draft");

  // Refusal at the commit point, with the error on the RIR field.
  await page.click("#entryEditorActivate");
  await page.waitForFunction(() =>
    document.querySelector('#onbProgramEditor [data-role="suggest-loads-rir"]')?.getAttribute("aria-invalid") === "true",
  undefined, { timeout: 5000 }).catch(() => {});
  const refusal = await page.evaluate(() => {
    const input = document.querySelector('#onbProgramEditor [data-role="suggest-loads-rir"]');
    const note = input && document.getElementById(input.getAttribute("aria-describedby") || "");
    return {
      invalid: input?.getAttribute("aria-invalid"), note: note?.textContent || null, noteRole: note?.getAttribute("role") || null,
      focused: document.activeElement === input,
      onboarded: JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
      step: window.__repforgeEntryState?.()?.step,
    };
  });
  check(refusal.invalid === "true" && refusal.noteRole === "alert" && !!refusal.note && refusal.focused,
    "Use this program refuses the incomplete opt-in with a focused, described error on the RIR field", refusal);
  check(!refusal.onboarded && refusal.step === "editor", "nothing is activated while the opt-in is incomplete", refusal);

  // Save draft keeps the incomplete state; it still does not act as adaptive.
  await page.click("#entryEditorSave");
  await page.waitForFunction((key) => !!JSON.parse(localStorage.getItem(key) || "null")?.state?.result?.preview, SETUP_KEY, { timeout: 5000 });
  const savedIncomplete = await slotFacts(page, "draft");
  check(savedIncomplete.statuses.join() === "manual",
    "a saved incomplete opt-in is not ready in the setup draft", savedIncomplete);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const firstRunCreate = page.locator("#firstRunCreate");
  if (await firstRunCreate.isVisible().catch(() => false)) await firstRunCreate.click();
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
  await page.locator("#entryResumeContinue").click();
  await page.waitForSelector('#onboarding.active #onbProgramEditor [data-role="exercise"]', { timeout: 10000 });
  const resumedRow = benchRow(page);
  await expand(resumedRow);
  const resumed = {
    switchOn: await resumedRow.locator('[data-role="suggest-loads"]').getAttribute("aria-checked"),
    rir: await resumedRow.locator('[data-role="suggest-loads-rir"]').inputValue().catch(() => null),
    step: await resumedRow.locator('[data-role="load-step"]').inputValue().catch(() => null),
    facts: await slotFacts(page, "entry"),
  };
  check(resumed.switchOn === "true" && resumed.rir === "" && resumed.step === "1.25" && resumed.facts.statuses.join() === "manual",
    "after Save draft and a reload, the incomplete opt-in, its empty RIR and the load step come back, still manual", resumed);

  // Complete the configuration and activate.
  const resumedRir = resumedRow.locator('[data-role="suggest-loads-rir"]');
  await resumedRir.fill("2");
  await resumedRir.press("Tab");
  await page.waitForFunction((id) => {
    const definition = window.__repforgeEntryState?.()?.result?.preview?.programDefinition;
    const slot = definition?.days?.flatMap((day) => day.slots || []).find((candidate) => candidate.exerciseId === id);
    return slot?.prescriptionsByCycle?.every((cycle) => cycle.sets.every((set) => set.rir === 2));
  }, EXERCISE_ID, { timeout: 5000 });
  const beforeCommit = await slotFacts(page, "entry");
  check(beforeCommit.statuses.join() === "manual", "a valid but uncommitted opt-in is still manual", beforeCommit);
  await page.click("#entryEditorActivate");
  const activated = await page.waitForFunction(() =>
    JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta?.onboarded === true,
  undefined, { timeout: 15000 }).then(() => true, () => false);
  const durable = await slotFacts(page, "state");
  const durableMeta = await page.evaluate((id) => {
    const meta = JSON.parse(localStorage.getItem("repforge_v1") || "null")?.programMeta || {};
    return { step: meta.loadingConfiguration?.byExerciseId?.[id]?.loadStepKg ?? null,
      pendingKeys: Object.keys(meta).filter((key) => /pending|suggest/i.test(key)) };
  }, EXERCISE_ID);
  check(activated && durable.statuses.join() === "ready" && durable.rirs.join() === "2"
    && durable.policies.join() === "manual/manual-adaptive@1" && durable.cycles > 1,
  "activation makes every set in every cycle ready with RIR 2 and manual-adaptive provenance", { activated, durable });
  check(durableMeta.step === 1.25 && durableMeta.pendingKeys.length === 0,
    "activation keeps the load step and stores no pending opt-in marker", durableMeta);

  // Session 1: a new lift, no invented load.
  const rowId = await page.evaluate((id) =>
    (JSON.parse(localStorage.getItem("repforge_v1") || "null")?.program || []).find((entry) => entry.libraryId === id)?.id, EXERCISE_ID);
  await selectExercise(page, rowId);
  const first = await page.evaluate((id) => {
    const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));
    return { status: rec?.status, engineStatus: rec?.engineStatus, load: rec?.load ?? null,
      cue: document.querySelector("#workout .exercise.is-current .fx-cue__l1")?.textContent || "" };
  }, rowId);
  check(first.load == null && first.cue.includes("Pick a load for 6–10 reps"),
    "the first opted-in session is a new lift: Focus asks for a load and invents none", first);
  for (const ordinal of [1, 2, 3]) await logSet(page, rowId, ordinal, durable.metricIds, { load: 60, reps: 10, rir: 2 });
  await finishEarly(page);

  // Session 2: the engine's adaptive target, on Focus and in Why.
  await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await selectExercise(page, rowId);
  const second = await page.evaluate((id) => {
    const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));
    return { status: rec?.status, engineStatus: rec?.engineStatus, load: rec?.load ?? null,
      cue: document.querySelector("#workout .exercise.is-current .fx-cue__l1")?.textContent || "" };
  }, rowId);
  check(second.engineStatus === "recommended" && Number(second.load) > 60 && second.cue.includes(String(second.load)),
    "the next session shows the engine's adaptive target on Focus", second);
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
  const why = await page.locator("#whyBody").innerText();
  check(!why.includes("does not suggest a load") && why.includes(String(second.load)),
    "Why explains the same engine target instead of the manual copy", why);
  await page.locator("#whyClose").click();
  await page.waitForSelector("#whySheet", { state: "hidden", timeout: 5000 });

  // A typed load survives a reload and the recalculation after a completed set.
  await fillShelf(page, durable.metricIds[0], 57.5);
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await selectExercise(page, rowId);
  const typed = await page.evaluate(({ id, metric }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    const set = setId ? exercise.sets[setId] : null;
    return { value: set?.edited?.metrics?.[metric] ?? null, touched: set?.touched?.metrics?.[metric] === true };
  }, { id: rowId, metric: durable.metricIds[0] });
  check(String(typed.value) === "57.5" && typed.touched,
    "a load the lifter typed survives a reload as their own value", typed);
  await fillShelf(page, durable.metricIds[1], 9);
  await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    return typeof exercise?.sets?.[setId]?.completion === "object";
  }, rowId, { timeout: 15000 });
  const completed = await page.evaluate(({ id, metric }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    return exercise?.sets?.[setId]?.edited?.metrics?.[metric] ?? null;
  }, { id: rowId, metric: durable.metricIds[0] });
  check(String(completed) === "57.5", "recalculation after the completed set keeps the typed load", completed);
  check(pageErrors.length === 0, "the Build opt-in journey has no uncaught browser errors", pageErrors);
} catch (error) {
  failures.push(String(error?.stack || error));
  console.error(error?.stack || error);
} finally {
  await context?.close();
  await browser.close();
}

console.log(`\nP069-S4-OPTIN: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
