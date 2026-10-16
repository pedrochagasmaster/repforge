#!/usr/bin/env node
/** Plan 069 S3: Focus reads both remaining supported per-side compositions. */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalogFixture = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const PRESS_ID = "1a05c6f170d8806b911acf558c5af4f6";
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
    [id, [...catalogFixture.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [PRESS_ID], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

const CASES = [
  {
    name: "total Weight with per-side reps",
    exerciseId: "1a05c6f170d8805b9dd1f99907b00278", // 45° incline single arm dumbbell press
    mode: "unilateral", loadMetric: "loadKg", repsMetric: "repsPerSide", load: "30", reps: "8",
    expected: {
      en: "last 30 kg × 8 reps per side · RIR 2",
      pt: "antes 30 kg × 8 reps por lado · RIR 2",
    },
  },
  {
    name: "per-side load with ordinary reps",
    exerciseId: "1a35c6f170d880f3af82ce83d7aee474", // Dual kettlebell Romanian deadlift
    mode: "bilateral", loadMetric: "loadPerSideKg", repsMetric: "reps", load: "24", reps: "8",
    expected: {
      en: "last 24 kg per side × 8 reps · RIR 2",
      pt: "antes 24 kg por lado × 8 reps · RIR 2",
    },
  },
];

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}

async function installProgram(page, item) {
  return page.evaluate(async ({ request, item }) => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const generated = window.RepForgeProgramCompiler.generateProgram(
      { ...request, preferredExerciseIds: [item.exerciseId] }, catalog);
    if (!generated.ok) throw new Error("Could not generate production program: " + JSON.stringify(generated.conflicts));
    const source = catalog.exercises.find(entry => entry.id === item.exerciseId);
    const definitions = window.RepForgeExerciseMetrics.definitionsForIds(source?.exerciseMetrics || []);
    if (!source || !definitions?.ok) throw new Error("Catalog source or metric definitions are missing");
    const loadDefinition = definitions.value.find(metric => metric.semantic === item.loadMetric);
    const repsDefinition = definitions.value.find(metric => metric.semantic === item.repsMetric);
    if (!loadDefinition || !repsDefinition) throw new Error("Catalog composition does not match the cue case");
    const existing = generated.value.days.filter(day => day.kind === "training").flatMap(day =>
      day.slots.map(slot => ({ day, slot }))).find(({ slot }) => slot.exerciseId === item.exerciseId);
    const target = existing || generated.value.days.filter(day => day.kind === "training").flatMap(day =>
      day.slots.map(slot => ({ day, slot }))).find(({ slot }) => slot.role !== "manual");
    if (!target) throw new Error("Generated program has no slot to bind to the fixture source");
    const laterality = source.laterality || [];
    const unilateralId = "1a45c6f170d88034beccf30a41da9588";
    const bilateralId = "1a45c6f170d8808e8340d9a8d0f06f9d";
    target.slot.exerciseId = source.id;
    target.slot.sourceExerciseIds = [source.id];
    target.slot.exerciseTypeId = source.exerciseType;
    target.slot.displayName = source.name;
    target.slot.musclePurposeIds = [...source.primaryFeatureMuscle];
    target.slot.movementPatternIds = [...source.movementPattern];
    target.slot.metricIds = [...source.exerciseMetrics];
    target.slot.metricDefinitions = definitions.value;
    target.slot.metricOrigin = "source_catalog";
    target.slot.lateralityIds = [...laterality];
    target.slot.executionMode = laterality.includes(unilateralId) && !laterality.includes(bilateralId)
      ? "unilateral" : laterality.includes(bilateralId) && !laterality.includes(unilateralId) ? "bilateral" : item.mode;
    target.slot.loadingModel = { ...target.slot.loadingModel, bodyweightCoefficient: source.bodyweight };
    const targets = { [item.loadMetric]: { min: Number(item.load) - 2, max: Number(item.load) + 4 },
      [item.repsMetric]: { min: 7, max: 10 } };
    for (const cycle of target.slot.prescriptionsByCycle) {
      for (const set of cycle.sets) set.targets = structuredClone(targets);
    }
    const validation = window.RepForgeProgramCompiler.validateProgramDefinition(generated.value, catalog, []);
    if (!validation.ok) throw new Error("Compiler rejected the fixture program: " + JSON.stringify(validation.issues));
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value, name: "Per-side Focus cue proof", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: `p069-focus-${item.loadMetric}` },
    });
    await window.__repforgeStorage.flush();
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = state.program.find(entry => entry.slotId === target.slot.id);
    return { validation, row, slot: target.slot, loadMetricId: loadDefinition.id, repsMetricId: repsDefinition.id };
  }, { request: REQUEST, item });
}

async function enterFocus(page, rowId) {
  await page.evaluate(id => window.__repforgeGoToLogExercise(id), rowId);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction(id => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    rowId, { timeout: 15000 });
}

async function fillMetric(page, rowId, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  await input.fill(value);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function finishSession(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false,
    undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true,
    undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function runCase(browser, item, locale) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale, timezoneId: "UTC" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const setup = await installProgram(page, item);
    const rowId = setup.row?.id;
    check(!!rowId && setup.slot.executionMode === item.mode,
      `${item.name} is compiler-valid in its catalog execution mode (${locale})`, {
        rowId, mode: setup.slot.executionMode, validation: setup.validation,
      });
    if (!rowId) throw new Error(`No program row for ${item.name}`);
    await enterFocus(page, rowId);
    await fillMetric(page, rowId, setup.loadMetricId, item.load);
    await fillMetric(page, rowId, setup.repsMetricId, item.reps);
    const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${rowId}_1_rir"]`);
    if (await rir.getAttribute("aria-hidden") === "true")
      await page.locator("#workout .exercise.is-current .focus-shelf [data-shelf-field=\"rir\"]").click();
    await rir.fill("2");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
    await page.waitForFunction(id => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const setId = exercise?.setOrder?.find(key => exercise.sets[key].ordinal === 1);
      return !!exercise?.sets?.[setId]?.completion;
    }, rowId, { timeout: 15000 });
    await finishSession(page);
    const saved = await page.evaluate(exerciseId => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return (state.log || []).filter(row => row.exerciseId === exerciseId).at(-1) || null;
    }, rowId);
    const savedMetrics = Object.fromEntries((saved?.metricValues || []).map(value => [value.metricId, value.value]));
    check(savedMetrics[setup.loadMetricId] === Number(item.load) && savedMetrics[setup.repsMetricId] === Number(item.reps) &&
      saved?.loadingContext?.externalLoadMultiplier != null,
      `${item.name} was durably logged with its metric values and multiplier (${locale})`, saved);
    await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await enterFocus(page, rowId);
    const cue = (await page.locator("#workout .exercise.is-current .ledgerline__prev").first().textContent())?.trim() || "";
    const lang = locale.startsWith("pt") ? "pt" : "en";
    check(cue === item.expected[lang], `${item.name} Focus cue preserves logged meaning (${locale})`, cue);
    check(errors.length === 0, `${item.name} journey has no page errors (${locale})`, errors);
  } catch (error) {
    failures.push(`${item.name} (${locale}): ${String(error?.stack || error)}`);
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await context.close();
  }
}

async function main() {
  console.log("P069 S3: Focus cues retain total-load/side-reps and side-load/ordinary-reps meanings");
  const browser = await launchChromium();
  try {
    for (const item of CASES) {
      await runCase(browser, item, "en-US");
      await runCase(browser, item, "pt-BR");
    }
  } finally {
    await browser.close();
  }
  console.log(`\nP069 S3 per-side Focus cue compositions: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
