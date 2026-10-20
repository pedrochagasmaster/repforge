#!/usr/bin/env node
/** Plan 069 S3: generated per-side adaptation through two real sessions. */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import {installBrowserTraining} from "./training-browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const PRESS_ID = "1a05c6f170d8806b911acf558c5af4f6";
const REPS_PER_SIDE_ID = "25a5c6f170d880baaa2dc8c7b67d4b65";
const LOAD_PER_SIDE_ID = "25a5c6f170d880e2990fc88146f7de56";
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
  preferredExerciseIds: [PRESS_ID], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 3000)}`);
}

async function seedGeneratedPress(page) {
  return page.evaluate(async ({ request, exerciseId }) => {
    const {compiler,catalog,metrics}=window.__repforgeTrainingTest;
    const entry=[...document.querySelectorAll("script[src]")].map(script=>script.src).find(src=>new URL(src).pathname.includes("/src/"));
    const graphBase=entry.slice(0,entry.lastIndexOf("/src/")+1);
    const {review}=await import(new URL("src/training/authoring.js",graphBase).href);
    const generated = compiler.generateProgram(request,catalog);
    if (!generated.ok) throw new Error("Could not generate the production program: " + JSON.stringify(generated.conflicts));
    // This journey exercises an explicit movement choice, independently of ranking.
    const compatible = generated.value.days.filter((day) => day.kind === "training").flatMap((day) => day.slots)
      .find((slot) => slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide") &&
        slot.metricDefinitions.some((metric) => metric.semantic === "loadPerSideKg"));
    if (!compatible) throw new Error("The generated program has no compatible per-side slot");
    const reviewed = review.applyEdit(generated.value,
      { kind: "swap", slotId: compatible.id, exerciseId },
      {compiler,catalog,metrics});
    if (!reviewed.ok) throw new Error("The explicit press choice was refused: " + JSON.stringify(reviewed));
    const definition = reviewed.definition;
    const target = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot) => ({ day, slot }))).find(({ slot }) => slot.id === compatible.id && slot.exerciseId === exerciseId);
    if (!target) throw new Error("The explicit press choice did not retain its slot");
    const finalized = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Per-side engine proof", answers: {},
      destination: "log", origin: "first-run", draftConfirmed: true,
      telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "p069-s3-per-side-generated-journey" },
    });
    await window.__repforgeStorage.flush();
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = state.program.find((entry) => entry.slotId === target.slot.id);
    return {
      finalized, day: target.day.name, slot: target.slot, row,
      profileWeight: state.profile?.weightKg ?? null,
      optInFields: Object.keys(state.programMeta || {}).filter((key) => /per.?side|multiplier/i.test(key)),
    };
  }, { request: REQUEST, exerciseId: PRESS_ID });
}

async function selectPress(page, rowId) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), rowId);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    rowId, { timeout: 15000 });
}

async function fillShelf(page, selector, value, shelfField) {
  const input = page.locator(selector);
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${shelfField}"]`).click();
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function setSessionBodyweight(page, value) {
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
  await page.locator("#sessionBodyweight").fill(String(value));
  await page.locator("#sessionBodyweight").dispatchEvent("input");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#sessionSheetClose").click();
  await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });
}

async function readSet(page, rowId, ordinal = 1) {
  return page.evaluate(({ rowId, ordinal }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[rowId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    return setId ? exercise.sets[setId] : null;
  }, { rowId, ordinal });
}

async function logPressSet(page, rowId) {
  await fillShelf(page,
    `#workout .exercise.is-current .focus-shelf input[data-metric-id="${LOAD_PER_SIDE_ID}"]`, 25,
    `metric_${LOAD_PER_SIDE_ID}`);
  await fillShelf(page,
    `#workout .exercise.is-current .focus-shelf input[data-metric-id="${REPS_PER_SIDE_ID}"]`, 8,
    `metric_${REPS_PER_SIDE_ID}`);
  const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${rowId}_1_rir"]`);
  if (await rir.getAttribute("aria-hidden") === "true")
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  await rir.fill("2");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
  await page.waitForFunction((id) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
    return !!exercise?.sets?.[setId]?.completion;
  }, rowId, { timeout: 15000 });
}

async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false,
    undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true,
    undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function main() {
  console.log("P069 S3: generated per-side adaptation through production workout sessions");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await installBrowserTraining(page);
    const setup = await seedGeneratedPress(page);
    const rowId = setup.row?.id;
    check(!!rowId && setup.slot.executionMode === "bilateral",
      "the generated bilateral per-side press is usable without an opt-in", {
        rowId, executionMode: setup.slot.executionMode, optInFields: setup.optInFields,
      });
    if (!rowId) throw new Error("Generated press did not become a program row");

    // First session: the lifter logs actual per-side values and bodyweight.
    await selectPress(page, rowId);
    await setSessionBodyweight(page, 80);
    await logPressSet(page, rowId);
    await finishEarly(page);
    const saved = await page.evaluate((exerciseId) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const rows = (state.log || []).filter((row) => row.performedLibraryId === exerciseId);
      return rows.at(-1) ? {
        session: rows.at(-1).session,
        metricValues: rows.at(-1).metricValues,
        loadingContext: rows.at(-1).loadingContext,
        bodyweight: rows.at(-1).bodyweight,
      } : null;
    }, PRESS_ID);
    check(saved?.loadingContext?.externalLoadMultiplier === 2,
      "the generated session captures the known bilateral multiplier for its performed set", saved);
    check(saved?.metricValues?.some((entry) => entry.metricId === LOAD_PER_SIDE_ID && entry.value === 25) &&
      saved?.metricValues?.some((entry) => entry.metricId === REPS_PER_SIDE_ID && entry.value === 8),
    "the saved row retains the lifter's per-side load and per-side reps", saved);

    // Second session: recommendation remains expressed in per-side values.
    await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    // The saved metric is canonical kilograms. Switch the display unit through
    // Settings before revisiting it so the previous-set cue proves conversion
    // uses today's unit without rewriting the historical row.
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.view.active", { timeout: 10000 });
    await page.locator("#unit").selectOption("lb");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.settings?.unit === "lb",
      undefined, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    await page.locator("#settingsBack").click();
    await page.waitForSelector("#log.view.active", { timeout: 10000 });
    await selectPress(page, rowId);
    const previousCue = await page.locator("#workout .exercise.is-current .ledgerline__prev").first().textContent().catch(() => "");
    check(!previousCue.includes("{reps}") && !/\b0\s*×/.test(previousCue) && previousCue.includes("55.12 lb") &&
      previousCue.toLowerCase().includes("per side"),
    "ordinary Focus converts the saved 25 kg per-side metric into the current pound display and retains its cue", previousCue);
    const historicalLoadKg = await page.evaluate((id) => {
      const row = (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || [])
        .find(entry => entry.performedLibraryId === id);
      return row?.metricValues?.find(entry => entry.metricId === "25a5c6f170d880e2990fc88146f7de56")?.value ?? null;
    }, PRESS_ID);
    check(historicalLoadKg === 25,
      "display-unit conversion leaves the historical per-side metric in canonical kilograms", historicalLoadKg);
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForSelector("#settings.view.active", { timeout: 10000 });
    await page.locator("#unit").selectOption("kg");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.settings?.unit === "kg",
      undefined, { timeout: 10000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    await page.locator("#settingsBack").click();
    await page.waitForSelector("#log.view.active", { timeout: 10000 });
    await selectPress(page, rowId);
    const state = await page.evaluate((id) => {
      const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));
      const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const setId = ex?.setOrder?.find((key) => ex.sets[key].ordinal === 1);
      const result = rec?.targetSets?.find((entry) => entry.prescription?.setIndex === 1)?.result;
      return { rec, set: setId ? ex.sets[setId] : null,
        targetLoad: result?.targets?.loadPerSideKg, targetReps: result?.targets?.repsPerSide };
    }, rowId);
    check(state.rec?.engineStatus === "recommended" && Number(state.rec?.load) > 0,
      "the next generated session receives an adaptive recommendation", {
        status: state.rec?.status, engineStatus: state.rec?.engineStatus,
        reason: state.rec?.reason, load: state.rec?.load,
      });
    check(state.targetLoad > 0 && Number(state.set?.edited?.metrics?.[LOAD_PER_SIDE_ID]) === state.targetLoad,
      "the engine's adaptive target prefills its exact per-side load, not a bilateral total", {
        targetLoad: state.targetLoad, edited: state.set?.edited?.metrics?.[LOAD_PER_SIDE_ID],
      });
    check(Number(state.set?.edited?.metrics?.[REPS_PER_SIDE_ID]) === state.targetReps,
      "the engine's adaptive target prefills its exact per-side repetitions", {
        targetReps: state.targetReps, edited: state.set?.edited?.metrics?.[REPS_PER_SIDE_ID],
      });

    await page.locator("#workout .exercise.is-current [data-why]").first().click();
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const why = await page.locator("#whyBody").innerText();
    check(why.includes("total load") && why.includes("per side") && why.includes("× 2") && why.includes("bodyweight"),
      "Why explains the bilateral multiplier and enabled bodyweight contribution", why);
    check(why.includes("last at 25 kg per side"),
      "Why labels its generated historical strength anchor as a per-side load", why);
    await page.locator("#whyClose").click();
    await page.waitForSelector("#whySheet", { state: "hidden", timeout: 5000 });

    // A manual edit remains authoritative after subsequent recommendation work.
    const loadInput = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${LOAD_PER_SIDE_ID}"]`);
    await loadInput.fill("33");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const touched = await readSet(page, rowId);
    check(touched?.edited?.metrics?.[LOAD_PER_SIDE_ID] === "33" && touched?.touched?.metrics?.[LOAD_PER_SIDE_ID] === true,
      "a lifter-touched per-side load remains their value", touched?.edited?.metrics);
    await page.locator(`#workout .exercise.is-current [data-save="${rowId}_1"]`).click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      const setId = exercise?.setOrder?.find((key) => exercise.sets[key].ordinal === 1);
      return !!exercise?.sets?.[setId]?.completion;
    }, rowId, { timeout: 15000 });
    const completed = await readSet(page, rowId);
    check(completed?.completion && completed?.edited?.metrics?.[LOAD_PER_SIDE_ID] === "33",
      "saving a set preserves both completion and the typed per-side load", completed);
    check(errors.length === 0, "the generated two-session journey has no page errors", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
  console.log(`\nP069 S3 generated per-side journey: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
