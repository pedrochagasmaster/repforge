#!/usr/bin/env node
/**
 * #278 and #277: every surface says the recommendation's move with the same
 * verb, and the Focus load field writes its number the way the lifter's
 * language does.
 *
 * #278: the exercise page's recommendation block headlined every load with
 * `today.rec_keep` ("Mantenha 62,5 kg") even when the engine raised or lowered
 * it. The Focus cue, the Why sheet (from Focus and from the exercise page) and
 * that block must all use the `focus.cue.up|hold|down` verb the engine's move
 * names, and Today's verdict mark must point the same way.
 *
 * #277: in Portuguese the Focus load field printed "62.5" while the cue above
 * it said "62,5". The field reads the locale decimal at rest and after − / +,
 * typed input still takes a comma or a point, and the draft stores a number.
 *
 * Each variant is a fresh device on a real generated program: one logged
 * session of three sets, then the next session's surfaces are read.
 *
 * Run: node tools/run-tests.mjs workout --suite why-verb-locale
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

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`); }
}

/** Install a generated program; the target is the first weighted slot of a
 *  training day that prescribes three sets. */
async function seed(page) {
  return page.evaluate(({ request, weight, reps }) => {
    const definition = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot(), "why-verb-locale").value;
    const target = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot, index) => ({ day, slot, index }))).find(({ slot, index }) => {
      const sets = slot.prescriptionsByCycle[0].sets;
      return index === 0 && JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) && sets.length === 3;
    });
    if (!target) return null;
    return window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Why verb proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "why-verb-locale" },
    }).then(() => window.__repforgeStorage.flush()).then(() => {
      const program = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || [];
      const row = program.find((entry) => entry.slotId === target.slot.id);
      return row && { day: target.day.name, slotId: target.slot.id, rowId: row.id };
    });
  }, { request: REQUEST, weight: WEIGHT, reps: REPS });
}

const current = "#workout .exercise.is-current";

async function revealField(page, fieldId) {
  const input = page.locator(`${current} .focus-shelf [data-shelf-field="${fieldId}"]`);
  await input.click();
}

async function fillShelf(page, metricId, value) {
  const input = page.locator(`${current} .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true") await revealField(page, `metric_${metricId}`);
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function logSet(page, slotId, ordinal, { load, reps, rir }) {
  await fillShelf(page, WEIGHT, load);
  await fillShelf(page, REPS, reps);
  const rirInput = page.locator(`${current} .focus-shelf input[data-k="${slotId}_${ordinal}_rir"]`);
  if (await rirInput.getAttribute("aria-hidden") === "true") await revealField(page, "rir");
  await rirInput.fill(String(rir));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`${current} [data-save="${slotId}_${ordinal}"]`).click();
  await page.waitForFunction(({ slotId, ordinal }) => {
    const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
    const setId = exercise?.setOrder?.find((id) => exercise.sets[id].ordinal === ordinal);
    return typeof exercise?.sets?.[setId]?.completion === "object";
  }, { slotId, ordinal }, { timeout: 15000 });
  const resting = await page.waitForFunction(() => document.querySelector("#woRest")?.classList.contains("is-running"),
    undefined, { timeout: 3000 }).then(() => true, () => false);
  if (resting) {
    await page.evaluate(() => window.stopRest());
    await page.waitForFunction(() => !document.querySelector("#woRest")?.classList.contains("is-running"), undefined, { timeout: 10000 });
  }
}

async function finishEarly(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 15000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
}

async function readWhy(page, opener) {
  await page.locator(opener).first().click();
  await page.waitForSelector("#whySheet.is-open");
  const why = await page.evaluate(() => ({
    target: document.querySelector("#whyTarget")?.textContent?.replace(/\s+/g, " ").trim() || "",
    mark: [...document.querySelectorAll("#whyTarget .verdictmark")].map((el) => el.className.replace(/.*verdictmark--/, "")),
  }));
  await page.click("#whyClose");
  await page.waitForSelector("#whySheet", { state: "hidden" });
  return why;
}

/** The load field's face, read in the same tick it is found rendered. */
async function loadFace(page) {
  const handle = await page.waitForFunction((metricId) =>
    document.querySelector(`#workout .exercise.is-current .focus-shelf .shelf__field[data-metric="${metricId}"] .shelf__val`)?.textContent?.trim() || null,
  WEIGHT, { timeout: 10000 });
  return handle.jsonValue();
}

/** One device: log `session` on the target slot, then read every surface of the next session. */
async function variant(browser, { locale, session }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  try {
    await page.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const target = await seed(page);
    if (!target) throw new Error("the generated program has no first weighted slot of three sets");
    if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not enter day");
    await page.waitForSelector(`${current}[data-ex="${target.rowId}"]`, { timeout: 10000 });
    for (const [index, set] of session.entries()) await logSet(page, target.slotId, index + 1, set);
    await finishEarly(page);

    await page.clock.setFixedTime(new Date("2026-03-04T09:00:00.000Z"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const truth = await page.evaluate((id) => {
      const P = window.__repforgeProgression, rec = P.recommendation(P.programSlot(id));
      return { status: rec.status, load: rec.load, lang: window.RepForgeI18n.getLang() };
    }, target.slotId);
    const enter = async () => {
      if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not re-enter day");
      await page.waitForSelector(`${current}[data-ex="${target.rowId}"]`, { timeout: 10000 });
    };
    await enter();
    const cue = (await (await page.waitForFunction(() => {
      const el = document.querySelector("#workout .exercise.is-current .fx-cue");
      const line1 = el?.querySelector(".fx-cue__l1")?.textContent?.replace(/\s+/g, " ").trim() || "";
      return line1 ? { line1, line2: el.querySelector(".fx-cue__l2")?.textContent?.trim() || "",
        mark: [...el.querySelectorAll(".fx-cue__mark .verdictmark")].map((m) => m.className.replace(/.*verdictmark--/, "")) } : null;
    }, undefined, { timeout: 10000 })).jsonValue());
    const focusWhy = await readWhy(page, `${current} [data-why]`);

    // Today holds the day the lifter is on; its row opens the exercise page.
    await page.evaluate(() => window.__repforgeLeaveWorkout());
    const row = `#todayDash .rxrow[data-exopen="${target.rowId}"]`;
    await page.waitForSelector(row, { timeout: 10000 });
    const today = await page.evaluate((selector) =>
      [...(document.querySelector(selector)?.querySelectorAll(".verdictmark") || [])].map((el) => el.className.replace(/.*verdictmark--/, "")), row);
    await page.locator(row).click();
    await page.waitForSelector("#exercise.view.active #exDetail .recblock__head");
    const block = await page.evaluate(() => document.querySelector("#exDetail .recblock__head")?.textContent?.trim() || "");
    const exerciseWhy = await readWhy(page, "#exDetail [data-why]");
    await page.locator("#exBack").click();
    await enter();
    return { page, context, target, truth, today, block, exerciseWhy, cue, focusWhy, errors };
  } catch (error) {
    await context.close();
    throw error;
  }
}

const t = (page, key, vars) => page.evaluate(({ key, vars }) => window.RepForgeI18n.t(key, vars), { key, vars });

const browser = await launchChromium();
try {
  const cases = [
    { name: "add", move: "up", status: "add", session: [{ load: 60, reps: 12, rir: 2 }, { load: 60, reps: 12, rir: 2 }, { load: 60, reps: 12, rir: 2 }] },
    { name: "hold", move: "hold", status: "hold", session: [{ load: 60, reps: 10, rir: 2 }, { load: 60, reps: 10, rir: 2 }, { load: 60, reps: 10, rir: 2 }] },
    { name: "reduce", move: "down", status: "reduce", session: [{ load: 60, reps: 5, rir: 0 }, { load: 60, reps: 5, rir: 0 }, { load: 60, reps: 5, rir: 0 }] },
  ];
  for (const item of cases) {
    console.log(`#278 PT ${item.name}: every surface names the move with the same verb`);
    const run = await variant(browser, { locale: "pt-BR", session: item.session });
    const { page, truth } = run;
    try {
      console.log(`    engine: ${JSON.stringify(truth)}`);
      assert(truth.lang === "pt" && truth.status === item.status, `#278 PT ${item.name}: the engine's move is ${item.status}`, truth);
      if (item.name === "add") assert(truth.load === 62.5, "#278 PT add: 60 kg × 10, 10, 10 at RIR 2 targets 62.5 kg next", truth);
      const load = (await page.evaluate((kg) => String(kg).replace(".", ","), truth.load));
      const headline = await t(page, `focus.cue.${item.move}`, { load, unit: "kg" });
      assert(run.block === headline, `#278 PT ${item.name}: the exercise page block headlines "${headline}"`, run.block);
      assert(run.cue.line1 === headline, `#278 PT ${item.name}: the Focus Agora cue reads "${headline}"`, run.cue);
      assert(run.focusWhy.target.startsWith(`${headline}, `) && run.focusWhy.target === `${run.cue.line1}, ${run.cue.line2}`,
        `#278 PT ${item.name}: the Why sheet from Focus leads with the cue`, run.focusWhy);
      assert(run.exerciseWhy.target.startsWith(`${headline}, `),
        `#278 PT ${item.name}: the Why sheet from the exercise page leads with the same verb`, run.exerciseWhy);
      assert([run.cue.mark, run.focusWhy.mark, run.exerciseWhy.mark, run.today].every((mark) => JSON.stringify(mark) === JSON.stringify([item.move])),
        `#278 PT ${item.name}: Today, the cue and both Why sheets draw the ${item.move} mark`,
        { cue: run.cue.mark, focusWhy: run.focusWhy.mark, exerciseWhy: run.exerciseWhy.mark, today: run.today });
      if (item.name === "add") {
        assert(run.block === "Subir para 62,5 kg", "#278 PT add: the block reads exactly \"Subir para 62,5 kg\"", run.block);

        console.log("#277 PT: the Focus load field writes the locale decimal");
        assert(await loadFace(page) === "62,5", "#277 PT: the load field reads 62,5 at rest", await loadFace(page));
        await revealField(page, `metric_${WEIGHT}`);
        const pads = page.locator(`${current} .focus-shelf .shelf__pads [data-step][data-dir="1"]`);
        await pads.click();
        await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
        assert(await loadFace(page) === "65", "#277 PT: + steps the field to 65", await loadFace(page));
        await page.locator(`${current} .focus-shelf .shelf__pads [data-step][data-dir="-1"]`).click();
        await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
        assert(await loadFace(page) === "62,5", "#277 PT: − steps the field back to 62,5", await loadFace(page));
        await fillShelf(page, WEIGHT, "57,5");
        await page.locator(`${current} .focus-shelf [data-shelf-field="metric_${REPS}"]`).click();
        assert(await loadFace(page) === "57,5", "#277 PT: a typed comma decimal reads 57,5", await loadFace(page));
        await fillShelf(page, WEIGHT, "55.5");
        await page.locator(`${current} .focus-shelf [data-shelf-field="metric_${REPS}"]`).click();
        assert(await loadFace(page) === "55,5", "#277 PT: a typed point decimal reads 55,5", await loadFace(page));
        const stored = await page.evaluate(({ slotId, metricId }) => {
          const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[slotId];
          const set = exercise?.sets?.[exercise.setOrder[0]];
          return set?.edited?.metrics?.[metricId];
        }, { slotId: run.target.slotId, metricId: WEIGHT });
        assert(Number(stored) === 55.5 && !String(stored).includes(","), "#277 PT: the draft stores the typed load as a number", stored);
      }
      assert(run.errors.length === 0, `#278 PT ${item.name}: no page errors`, run.errors);
    } finally {
      await run.context.close();
    }
  }

  console.log("#277 EN: the Focus load field keeps the point");
  const en = await variant(browser, { locale: "en-US", session: cases[0].session });
  try {
    assert(en.truth.lang === "en" && en.truth.load === 62.5, "#277 EN: the engine targets 62.5 kg", en.truth);
    assert(en.block === "Go up to 62.5 kg", "#278 EN add: the block reads \"Go up to 62.5 kg\"", en.block);
    assert(await loadFace(en.page) === "62.5", "#277 EN: the load field reads 62.5 at rest", await loadFace(en.page));
    await revealField(en.page, `metric_${WEIGHT}`);
    await en.page.locator(`${current} .focus-shelf .shelf__pads [data-step][data-dir="1"]`).click();
    await en.page.locator(`${current} .focus-shelf .shelf__pads [data-step][data-dir="-1"]`).click();
    assert(await loadFace(en.page) === "62.5", "#277 EN: + then − steps back to 62.5", await loadFace(en.page));
    assert(en.errors.length === 0, "#277 EN: no page errors", en.errors);
  } finally {
    await en.context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
