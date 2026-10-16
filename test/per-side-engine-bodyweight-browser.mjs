#!/usr/bin/env node
/** Plan 069 S3: bodyweight + per-side reps carries captured context into history. */
import { readFileSync } from "node:fs";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", DATA), "utf8"));
const catalog = JSON.parse(readFileSync(new URL("app_file.json", DATA), "utf8"));
const PRESS_ID = "1a05c6f170d8806b911acf558c5af4f6";
const EXERCISE_ID = "1a35c6f170d880918125e6387c3849d5"; // Side-lying bodyweight hip abduction leg raise
const AMBIGUOUS_EXERCISE_ID = "2ae5c6f170d88044bac9fce04daffe3f"; // Standing accentuated eccentric bodyweight calf raise
const REPS_PER_SIDE_ID = "25a5c6f170d880baaa2dc8c7b67d4b65";
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
  preferredExerciseIds: [PRESS_ID], split: "auto", periodization: "static", cycles: 4, deloadCycles: [],
};

const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2500)}`);
}

async function setupProgram(page, exerciseId, executionMode) {
  return page.evaluate(async ({ request, exerciseId, executionMode }) => {
    const snapshot = window.RepForgeExerciseCatalog.snapshot();
    const generated = window.RepForgeProgramCompiler.generateProgram(
      request, snapshot);
    if (!generated.ok) throw new Error("Could not generate the production program: " + JSON.stringify(generated.conflicts));
    const target = generated.value.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot) => ({ day, slot }))).find(({ slot }) =>
        slot.metricDefinitions.some((metric) => metric.semantic === "loadKg") &&
        slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide"));
    if (!target) throw new Error("Generated program did not include a total-load plus Reps per side slot");
    const source = snapshot.exercises.find((entry) => entry.id === exerciseId);
    if (!source || source.exerciseMetrics.length !== 1) throw new Error("The bodyweight source exercise is missing its canonical metric");
    const repsPerSide = target.slot.metricDefinitions.find((metric) => metric.semantic === "repsPerSide");
    target.slot.exerciseId = source.id;
    target.slot.sourceExerciseIds = [source.id];
    target.slot.exerciseTypeId = source.exerciseType;
    target.slot.displayName = source.name;
    target.slot.musclePurposeIds = [...source.primaryFeatureMuscle];
    target.slot.movementPatternIds = [...source.movementPattern];
    target.slot.metricIds = [...source.exerciseMetrics];
    target.slot.metricDefinitions = [repsPerSide];
    target.slot.metricOrigin = "source_catalog";
    target.slot.lateralityIds = [...source.laterality];
    target.slot.executionMode = executionMode;
    target.slot.loadingModel = { ...target.slot.loadingModel, bodyweightCoefficient: source.bodyweight };
    for (const cycle of target.slot.prescriptionsByCycle) {
      for (const set of cycle.sets) {
        set.targets = { repsPerSide: { min: 7, max: 9 } };
      }
    }
    const validation = window.RepForgeProgramCompiler.validateProgramDefinition(generated.value, snapshot, []);
    if (!validation.ok) throw new Error("Mutated catalog-backed bodyweight slot is invalid: " + JSON.stringify(validation.issues));
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value, name: "Per-side bodyweight proof", answers: {}, destination: "log",
      origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "p069-s3-bodyweight-history" },
    });
    await window.__repforgeStorage.flush();
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return { validation, day: target.day.name, slot: target.slot,
      row: state.program.find((entry) => entry.slotId === target.slot.id) };
  }, { request: REQUEST, exerciseId, executionMode });
}

async function enterExercise(page, rowId) {
  await page.evaluate((id) => window.__repforgeGoToLogExercise(id), rowId);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    rowId, { timeout: 15000 });
}

async function enterBodyweight(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 5000 });
  await page.locator("#sessionBodyweight").fill("80");
  await page.locator("#sessionBodyweight").dispatchEvent("input");
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator("#sessionSheetClose").click();
  await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });
}

async function logWorkingSet(page, rowId) {
  const reps = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${REPS_PER_SIDE_ID}"]`);
  await reps.waitFor({ state: "attached", timeout: 10000 });
  if (await reps.getAttribute("aria-hidden") === "true")
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${REPS_PER_SIDE_ID}"]`).click();
  await reps.fill("8");
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
  console.log("P069 S3: bodyweight per-side history through a compiler-validated catalog slot");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const setup = await setupProgram(page, EXERCISE_ID, "unilateral");
    const rowId = setup.row?.id;
    check(!!rowId && setup.slot.executionMode === "unilateral",
      "the generated bodyweight Reps per side slot has a known unilateral catalog mode", {
        rowId, mode: setup.slot.executionMode, status: setup.slot.prescriptionsByCycle?.[0]?.sets?.[0]?.status,
      });
    if (!rowId) throw new Error("Generated bodyweight slot did not become a program row");
    await enterExercise(page, rowId);
    await enterBodyweight(page);
    await logWorkingSet(page, rowId);
    await finishEarly(page);
    const captured = await page.evaluate((exerciseId) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const row = (state.log || []).filter((entry) => entry.performedLibraryId === exerciseId).at(-1);
      return row ? { bodyweight: row.bodyweight, values: row.metricValues, context: row.loadingContext } : null;
    }, EXERCISE_ID);
    check(captured?.context?.bodyweightKg === 80 && captured?.context?.bodyweightContributionEnabled === true &&
      captured?.context?.bodyweightCoefficient === 0.176 && captured?.context?.externalLoadMultiplier === 0,
    "the real saved bodyweight set captures the context needed by the engine", captured);

    await page.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await enterExercise(page, rowId);
    const previousCue = await page.locator("#workout .exercise.is-current .ledgerline__prev").first().textContent().catch(() => "");
    check(!previousCue.includes("{reps}") && !/\b0\s*×/.test(previousCue) && !/\b0\s*(?:kg|lb)\b/i.test(previousCue) &&
      previousCue.includes("8") && previousCue.toLowerCase().includes("reps per side"),
    "bodyweight-only Focus reads prior per-side reps without inventing zero external load", previousCue);
    const recommendation = await page.evaluate((id) => {
      const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));
      return { status: rec?.status, engineStatus: rec?.engineStatus, reason: rec?.reason, anchor: rec?.historyAnchor, load: rec?.load,
        targets: rec?.targetSets?.[0]?.result?.targets };
    }, rowId);
    check(recommendation.engineStatus === "recommended" && recommendation.anchor?.effectiveLoadKg > 0,
      "the next session uses its captured bodyweight history as an adaptive anchor", recommendation);
    check(recommendation.targets?.repsPerSide != null,
      "the bodyweight recommendation stays in per-side repetitions", recommendation.targets);

    // An ambiguous historical m=0 row does not capture whether the set was
    // unilateral or bilateral. A current explicit slot choice cannot fill in
    // that missing historical fact.
    const ambiguousContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", timezoneId: "UTC" });
    const ambiguousPage = await ambiguousContext.newPage();
    ambiguousPage.on("pageerror", (error) => errors.push(String(error?.stack || error)));
    await ambiguousPage.clock.setFixedTime(new Date("2026-10-05T12:00:00.000Z"));
    await ambiguousPage.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(ambiguousPage, { base: BASE });
    const ambiguousSetup = await setupProgram(ambiguousPage, AMBIGUOUS_EXERCISE_ID, "unilateral");
    const ambiguousRowId = ambiguousSetup.row?.id;
    check(!!ambiguousRowId && ambiguousSetup.slot.executionMode === "unilateral",
      "the ambiguous catalog movement has a current explicit slot mode", {
        rowId: ambiguousRowId, mode: ambiguousSetup.slot.executionMode,
      });
    if (ambiguousRowId) {
      await enterExercise(ambiguousPage, ambiguousRowId);
      await enterBodyweight(ambiguousPage);
      await logWorkingSet(ambiguousPage, ambiguousRowId);
      await finishEarly(ambiguousPage);
      const ambiguousLog = await ambiguousPage.evaluate((id) => {
        const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
        const row = (state.log || []).filter((entry) => entry.performedLibraryId === id).at(-1);
        return row ? { mode: row.loadingContext?.externalLoadMultiplier, context: row.loadingContext } : null;
      }, AMBIGUOUS_EXERCISE_ID);
      check(ambiguousLog?.mode === 0 && ambiguousLog.context?.executionMode === "unilateral",
        "a new ambiguous bodyweight-only set records m=0 and the lifter's explicit execution mode (#382)", ambiguousLog);
      const nextRecommendation = (id) => ambiguousPage.evaluate((rowId) => {
        const rec = window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(rowId));
        return { status: rec?.status, reasonCodes: rec?.reasonCodes, anchor: rec?.historyAnchor };
      }, id);
      await ambiguousPage.clock.setFixedTime(new Date("2026-10-07T12:00:00.000Z"));
      await ambiguousPage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(ambiguousPage, { base: BASE });
      await enterExercise(ambiguousPage, ambiguousRowId);
      const capturedRecommendation = await nextRecommendation(ambiguousRowId);
      check(capturedRecommendation.anchor?.source === "history" &&
        !(capturedRecommendation.reasonCodes || []).includes("no_comparable_history"),
        "the captured mode gives the next session a comparable anchor", capturedRecommendation);

      // A row saved before modes were captured has no executionMode. Today's
      // explicit slot choice cannot fill in that missing historical fact.
      await ambiguousPage.evaluate(async ({ key, id }) => {
        const state = JSON.parse(localStorage.getItem(key) || "{}");
        for (const row of state.log || []) if (row.performedLibraryId === id) delete row.loadingContext.executionMode;
        localStorage.setItem(key, JSON.stringify(state));
        const db = await new Promise((resolve, reject) => {
          const request = indexedDB.open("repforge", 1);
          request.onupgradeneeded = () => request.result.createObjectStore("kv");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction("kv", "readwrite");
          tx.objectStore("kv").put(state, key);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { const error = tx.error; db.close(); reject(error); };
        });
      }, { key: "repforge_v1", id: AMBIGUOUS_EXERCISE_ID });
      await ambiguousPage.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(ambiguousPage, { base: BASE });
      await enterExercise(ambiguousPage, ambiguousRowId);
      const legacyRecommendation = await nextRecommendation(ambiguousRowId);
      check(legacyRecommendation.status !== "recommended" && !legacyRecommendation.anchor,
        "the current slot mode does not manufacture a historical anchor for a legacy ambiguous m=0 row", legacyRecommendation);
    }
    await ambiguousContext.close();
    check(errors.length === 0, "the generated bodyweight history journey has no page errors", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await browser.close();
  }
  console.log(`\nP069 S3 bodyweight history: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

await main();
