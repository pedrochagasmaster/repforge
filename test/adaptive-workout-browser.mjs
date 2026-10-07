#!/usr/bin/env node
/**
 * Plan 067 slice 3: adaptive prescriptions through real draft commands.
 *
 * A generated program's weighted movement starts cold (no invented load).
 * After a session at 110 kg × 6 reps with 2 RIR on both sets, and a 5 kg
 * smallest load change set in the program editor, the next session prefills the
 * plan's screenshot checkpoint (7–9 reps at 1 RIR → 105 kg × 8) without
 * performing it. A value the lifter types is never overwritten by later
 * recommendations, and completing a set recomputes only untouched sets.
 */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...catalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 4, deloadCycles: [],
};

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}
const flush = (page) => page.evaluate(() => window.__repforgeStorage?.flush?.());
const draftSet = (page, slotId, ordinal) => page.evaluate(({ slotId, ordinal }) => {
  const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
  const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
  return setId ? exercise.sets[setId] : null;
}, { slotId, ordinal });

async function seed(page) {
  return page.evaluate(async ({ request, weight, reps }) => {
    const generated = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot(), "adaptive-067");
    const definition = generated.value;
    // A day's first weighted movement. No bodyweight is entered, so its share is
    // off in both the history and the recommendation (external load only).
    const target = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
        slot.prescriptionsByCycle[0].sets.length >= 2);
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Adaptive proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "adaptive-067" },
    });
    await window.__repforgeStorage.flush();
    return target ? { day: target.day.name, slotId: target.slot.id, exerciseId: target.slot.exerciseId,
      sets: target.slot.prescriptionsByCycle[0].sets.map((set) => ({ targets: set.targets, rir: set.rir })) } : null;
  }, { request: REQUEST, weight: WEIGHT, reps: REPS });
}

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logSet(page, slotId, ordinal, { load, reps, rir }) {
  if (load != null) await fillShelf(page, WEIGHT, load);
  if (reps != null) await fillShelf(page, REPS, reps);
  const rirInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${slotId}_${ordinal}_rir"]`);
  if (await rirInput.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rirInput.fill(String(rir));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${slotId}_${ordinal}"]`).click();
  await page.waitForFunction(({ slotId, ordinal }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    return typeof exercise?.sets?.[setId]?.completion === "object";
  }, { slotId, ordinal }, { timeout: 15000 });
}

async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await flush(page);
}

async function setLoadStep(page, slotId, value) {
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden")))
    await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${slotId}"]`);
  const day = row.locator("xpath=ancestor::*[@data-role='day']");
  const toggleDay = day.locator('[data-role="toggle-day"]');
  if (await toggleDay.count() && await toggleDay.getAttribute("aria-expanded") === "false") await toggleDay.click();
  if (!await row.locator('[data-role="load-step"]').count()) await row.locator('[data-role="toggle-exercise"]').click();
  const input = row.locator('[data-role="load-step"]');
  check(await input.inputValue() === "2.5", "the load-step field starts from the global minimum jump", await input.inputValue());
  await input.fill(String(value));
  await input.press("Tab");
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), undefined, { timeout: 10000 });
  await flush(page);
}

async function main() {
  console.log("P067 slice 3: adaptive prescriptions through production draft commands");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const target = await seed(page);
    if (!target) throw new Error("no weighted first slot in the generated program");
    check(target.sets[1].rir === 1 && target.sets[1].targets.reps.min === 7 && target.sets[1].targets.reps.max === 9,
      "the target's second set is the screenshot prescription (7–9 reps at 1 RIR)", target.sets);

    // Session 1: a cold start invents no load ---------------------------------
    if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not enter day");
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
    const cold = await draftSet(page, target.slotId, 1);
    check(cold && !cold.edited.metrics[WEIGHT], "a first session has no recommended load", cold?.edited?.metrics);
    await logSet(page, target.slotId, 1, { load: 110, reps: 6, rir: 2 });
    await logSet(page, target.slotId, 2, { load: 110, reps: 6, rir: 2 });
    await finishEarly(page);

    await setLoadStep(page, target.slotId, 5);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1")).programMeta.loadingConfiguration);
    check(stored?.byExerciseId?.[target.exerciseId]?.loadStepKg === 5, "the load step is stored for the movement", stored);

    // Session 2: the screenshot checkpoint ------------------------------------
    await page.clock.setFixedTime(new Date("2026-03-04T09:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not re-enter day");
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
    const second = await draftSet(page, target.slotId, 2);
    check(second?.edited?.metrics?.[WEIGHT] === "105" && second?.edited?.metrics?.[REPS] === "8",
      "after 110 kg × 6 at 2 RIR, the 7–9 at 1 RIR set is prefilled with 105 kg × 8", second?.edited?.metrics);
    check(second?.completion === "pending" && second?.touched?.metrics?.[WEIGHT] === false,
      "the recommendation is prefilled, untouched and not performed");
    const first = await draftSet(page, target.slotId, 1);
    const firstLoad = Number(first?.edited?.metrics?.[WEIGHT]), firstReps = Number(first?.edited?.metrics?.[REPS]);
    check(firstLoad > 0 && firstLoad % 5 === 0 && firstReps >= 7 && firstReps <= 9,
      "the first set is recommended on the 5 kg grid inside its rep range", first?.edited?.metrics);

    // A value the lifter typed is theirs; completion recomputes the rest ------
    await logSet(page, target.slotId, 1, { load: 105, reps: 9, rir: 3 });
    const after = await draftSet(page, target.slotId, 2);
    check(after?.completion === "pending" && after?.edited?.metrics?.[WEIGHT] != null,
      "completing set 1 keeps set 2 pending with a recomputed recommendation", after?.edited?.metrics);
    await fillShelf(page, REPS, 10);
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const typed = await draftSet(page, target.slotId, 2);
    check(typed?.edited?.metrics?.[REPS] === "10" && typed?.touched?.metrics?.[REPS] === true,
      "the lifter's typed reps are recorded as their own");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not resume day");
    const resumed = await draftSet(page, target.slotId, 2);
    check(resumed?.edited?.metrics?.[REPS] === "10", "a resumed session never overwrites the lifter's typed value", resumed?.edited?.metrics);

    check(errors.length === 0, "no page errors during adaptive sessions", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
  console.log(`\nP067 adaptive result: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
