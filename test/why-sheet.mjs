#!/usr/bin/env node
/**
 * Plan 067: the Why sheet tells the truth about an adaptive recommendation.
 *
 * The old RT-01/RT-02/RT-05 audit fixtures described the retired strategy
 * engine (percent/minJump load arithmetic, `rec.strategy`, flat program
 * rows). On a canonical generated program the Why sheet is built by
 * `engineWhyModel`/`engineWhyRows` in app.js straight from
 * `recommendation()`'s own facts (`result.historyAnchor`,
 * `result.loadingAssumptions`, `result.targets`) — there is no load
 * arithmetic left in the sheet to re-derive and check (RT-02's subject),
 * so RT-02 is retired outright rather than migrated.
 *
 * RT-01 and RT-05 still describe real product guarantees and are migrated
 * onto a real generated program (the same request `adaptive-workout-browser.mjs`
 * uses) with one logged session of history:
 * - RT-01 the performed sentence in the "What you showed" block names each
 *   set's own load; a mixed-load session never prints one shared load.
 * - RT-05 the Why headline is exactly the Focus cue shown on the card the
 *   sheet was opened from, before any set is logged this session and after
 *   logging set 1 moves the cue.
 *
 * New: the sheet also names the anchor, the target (with RIR and reps), and
 * the load step — the three facts `engineWhyRows` reports — each checked
 * against `window.RepForgeI18n.t(...)`, never a hardcoded English string.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/why-sheet.mjs
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

/** The same plain-number formatting `fmtPlain`/`fmt` apply in app.js: an
 *  integer prints bare, anything else to two decimals with trailing zeros
 *  trimmed. `fmt`/`fmtLoad` are not exposed on `window`, so this is a local
 *  equivalent for the English, kg-unit case this suite runs in — the i18n
 *  *text* itself still always comes from `window.RepForgeI18n.t(...)`. */
function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`); }
}

async function seed(page) {
  return page.evaluate(({ request, weight, reps }) => {
    const generated = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot(), "why-sheet-067");
    const definition = generated.value;
    const target = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
        slot.prescriptionsByCycle[0].sets.length >= 2);
    return window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Why sheet proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "why-sheet-067" },
    }).then(() => window.__repforgeStorage.flush()).then(() => target && {
      day: target.day.name, slotId: target.slot.id, exerciseId: target.slot.exerciseId,
    });
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
  // A completed set arms the rest timer, which replaces the slot's `.fx-cue`
  // with a running-rest preview of the same cue (a different surface for the
  // same facts, not the one RT-05 is about). Skip it so the card's normal cue
  // is what's on screen right after a save.
  // The timer arms just after the completion lands (not every set rests):
  // give it a moment to start, and end it if it did.
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

const settle = (page, ms = 300) => page.evaluate((n) => new Promise((res) => setTimeout(res, n)), ms);

// The card re-renders as a logged set settles; read the cue in the same tick
// that finds it rendered, so a re-render between a wait and a read cannot
// hand back an empty cue.
async function focusCue(page) {
  const handle = await page.waitForFunction(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const cue = card?.querySelector(".fx-cue");
    const line1 = cue?.querySelector(".fx-cue__l1")?.textContent?.trim() || "";
    if (!line1) return null;
    return {
      line1,
      line2: cue?.querySelector(".fx-cue__l2")?.textContent?.trim() || "",
      mark: [...(cue?.querySelectorAll(".fx-cue__mark .verdictmark") || [])].map((el) => el.className.replace(/.*verdictmark--/, "")),
    };
  }, undefined, { timeout: 10000 });
  return handle.jsonValue();
}

async function openWhy(page) {
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await page.waitForSelector("#whySheet.is-open");
  await settle(page, 200);
  return page.evaluate(() => ({
    target: document.querySelector("#whyTarget")?.textContent?.trim() || "",
    mark: [...document.querySelectorAll("#whyTarget .verdictmark")].map((el) => el.className.replace(/.*verdictmark--/, "")),
    blocks: [...document.querySelectorAll("#whyBody .whysheet__block")].map((el) => ({
      lead: el.getAttribute("data-lead"), text: el.querySelector(".whysheet__text")?.textContent?.trim() || "",
    })),
  }));
}

async function closeWhy(page) {
  await page.click("#whyClose");
  await page.waitForSelector("#whySheet", { state: "hidden" });
}

/** The engine's own truth for the slot's current recommendation, read through
 *  the same test hook the Log tab and the Why sheet call — nothing re-derived. */
async function engineTruth(page, slotId) {
  return page.evaluate((id) => {
    const P = window.__repforgeProgression;
    const ex = P.programSlot(id);
    const rec = P.recommendation(ex);
    return {
      status: rec.status, load: rec.load,
      historyAnchor: rec.historyAnchor, fatigue: rec.fatigue,
      loadingAssumptions: rec.loadingAssumptions,
      metricDefinitions: rec.metricDefinitions,
      firstTargets: rec.targetSets?.[0]?.result?.targets || null,
      firstRir: rec.targetSets?.[0]?.prescription?.rir ?? null,
    };
  }, slotId);
}

/** i18n text for the block the engine's "anchor" fact produces, built the same
 *  way `engineWhyRows` builds it, from the engine's own truth values. */
async function expectedAnchorText(page, truth) {
  const anchor = truth.historyAnchor || {};
  const fatigue = truth.fatigue;
  const cap = Number.isFinite(anchor.capacityKg) ? fmtNum(Math.round(anchor.capacityKg * 2) / 2) : null;
  const displayLoad = fmtNum(anchor.displayLoadKg);
  const projected = fatigue?.projectedCapacityKg;
  const fatigueCap = Number.isFinite(projected) ? fmtNum(Math.round(projected * 2) / 2) : null;
  const showFatigue = Number.isFinite(projected) && Number.isFinite(anchor.capacityKg) && Math.abs(projected - anchor.capacityKg) > 0.25;
  return page.evaluate(({ anchor, cap, displayLoad, fatigueCap, showFatigue, unit }) => {
    const t = (k, v) => window.RepForgeI18n.t(k, v);
    let text = "";
    if (anchor.source === "current_session") {
      text = t("why.engine.anchor_session", { set: (anchor.setIndex ?? 0) + 1, load: displayLoad, cap, unit });
    } else if (cap) {
      text = t("why.engine.anchor_history", { n: (anchor.sessionIds || []).length || 1, load: displayLoad, cap, unit });
    }
    if (showFatigue) text += ` ${t("why.engine.fatigue", { cap: fatigueCap, unit })}`;
    return text;
  }, { anchor, cap, displayLoad, fatigueCap, showFatigue, unit: "kg" });
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));

  await page.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  const target = await seed(page);
  if (!target) throw new Error("no weighted first slot with 2+ sets in the generated program");

  // ------------------------------------------------------------ session 1
  // A previous session with two different loads on its two sets, so the next
  // session's "What you showed" sentence has to name each one separately.
  if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not enter day");
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  await logSet(page, target.slotId, 1, { load: 110, reps: 6, rir: 2 });
  await logSet(page, target.slotId, 2, { load: 100, reps: 8, rir: 1 });
  await finishEarly(page);

  // ------------------------------------------------------------ session 2
  console.log("RT-01: the performed sentence names each set's own load");
  await page.clock.setFixedTime(new Date("2026-03-04T09:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  if (!await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), target.day)) throw new Error("could not re-enter day");
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });

  const truthBefore = await engineTruth(page, target.slotId);
  assert(truthBefore.status !== "manual" && truthBefore.status !== "new",
    "the generated program has a real adaptive recommendation after one session", truthBefore);

  // RT-05, before any set this session: the headline is exactly the Focus cue.
  const cueBefore = await focusCue(page);
  const whyBefore = await openWhy(page);
  assert(cueBefore.line1.length > 0 && whyBefore.target === `${cueBefore.line1}, ${cueBefore.line2}`,
    "RT-05: before any set this session, the Why headline is the Focus cue",
    `cue=${JSON.stringify(cueBefore)} why=${JSON.stringify(whyBefore.target)}`);
  assert(JSON.stringify(cueBefore.mark) === JSON.stringify(whyBefore.mark),
    "RT-05: before any set this session, the verdict mark is the cue's",
    `cue=${JSON.stringify(cueBefore.mark)} why=${JSON.stringify(whyBefore.mark)}`);

  // RT-01: the "What you showed" block (data-lead="engine-anchor") names each
  // of last session's two sets at its own load — never one shared sentence.
  const anchorBlock = whyBefore.blocks.find((b) => b.lead === "engine-anchor");
  assert(!!anchorBlock, "the sheet has a 'what you showed' (engine-anchor) block", whyBefore.blocks);
  const performedExpectations = await page.evaluate(({ load1, load2 }) => {
    const t = window.RepForgeI18n.t;
    return {
      set1: t("why.performed", { reps: "6", load: load1, unit: "kg", rirs: "2" }),
      set2: t("why.performed", { reps: "8", load: load2, unit: "kg", rirs: "1" }),
    };
  }, { load1: fmtNum(110), load2: fmtNum(100) });
  assert((anchorBlock?.text || "").includes(performedExpectations.set1) && (anchorBlock?.text || "").includes(performedExpectations.set2),
    "RT-01: the performed sentence gives the 110 kg set and the 100 kg set each their own load",
    `text="${anchorBlock?.text}" expected=${JSON.stringify(performedExpectations)}`);
  assert(!/6 (e|and) 8 reps/.test(anchorBlock?.text || ""),
    "RT-01: the two different loads never collapse into one shared-load sentence", anchorBlock?.text);

  // The anchor fact itself: the engine's own anchor/fatigue sentence, read
  // from the same facts `recommendation()` exposes.
  const expectedAnchor = await expectedAnchorText(page, truthBefore);
  assert((anchorBlock?.text || "").includes(expectedAnchor),
    "the sheet names the anchor exactly as the engine computed it (via window.RepForgeI18n.t)",
    `text="${anchorBlock?.text}" expected substring="${expectedAnchor}"`);

  // The target fact: "engine-target" names the RIR and reps the engine aims for.
  const targetBlock = whyBefore.blocks.find((b) => b.lead === "engine-target");
  assert(!!targetBlock, "the sheet has a target (engine-target) block", whyBefore.blocks);
  if (targetBlock) {
    const loadMetric = truthBefore.metricDefinitions?.find((m) => m.semantic === "loadKg");
    const repsMetric = truthBefore.metricDefinitions?.find((m) => m.semantic === "reps");
    const load = truthBefore.firstTargets?.[loadMetric?.semantic];
    const rawReps = truthBefore.firstTargets?.[repsMetric?.semantic];
    const reps = typeof rawReps === "number" ? rawReps : rawReps?.min;
    const rir = truthBefore.firstRir;
    const expectedTarget = await page.evaluate(({ rir, reps, load, unit }) => {
      const t = window.RepForgeI18n.t;
      return t(rir != null ? "why.engine.target" : "why.engine.target_norir", { rir, reps, load, unit });
    }, { rir: fmtNum(rir), reps, load: fmtNum(load), unit: "kg" });
    assert(targetBlock.text === expectedTarget,
      "the sheet names the target with RIR and reps exactly as window.RepForgeI18n.t renders it",
      `text="${targetBlock.text}" expected="${expectedTarget}"`);
  }

  // The assumptions fact: "engine-assumptions" names the load step.
  const assumptionsBlock = whyBefore.blocks.find((b) => b.lead === "engine-assumptions");
  assert(!!assumptionsBlock, "the sheet has an assumptions (engine-assumptions) block", whyBefore.blocks);
  if (assumptionsBlock) {
    const loads = (truthBefore.loadingAssumptions?.availableLoadsKg || []).slice().sort((a, b) => a - b);
    const steps = loads.slice(1).map((v, i) => Math.round((v - loads[i]) * 1000) / 1000).filter((s) => s > 0);
    const step = Math.min(...steps);
    const expectedStep = await page.evaluate((step) =>
      window.RepForgeI18n.t("why.engine.step", { step, unit: "kg" }), fmtNum(step));
    assert(assumptionsBlock.text.includes(expectedStep),
      "the sheet names the load step exactly as window.RepForgeI18n.t renders it",
      `text="${assumptionsBlock.text}" expected substring="${expectedStep}"`);
  }
  await closeWhy(page);

  // ------------------------------------------------------- RT-05, in-session
  console.log("RT-05: logging set 1 moves the headline with the Focus cue");
  await logSet(page, target.slotId, 1, { load: 110, reps: 8, rir: 3 });
  await page.waitForFunction(() =>
    (document.querySelector("#workout .exercise.is-current .fx-cue__l1")?.textContent || "").trim().length > 0,
    undefined, { timeout: 8000 });
  await settle(page, 300);
  const cueAfter = await focusCue(page);
  const whyAfter = await openWhy(page);
  assert(cueAfter.line1.length > 0 && whyAfter.target === `${cueAfter.line1}, ${cueAfter.line2}`,
    "RT-05: after logging set 1, the Why headline is still exactly the Focus cue",
    `cue=${JSON.stringify(cueAfter)} why=${JSON.stringify(whyAfter.target)}`);
  assert(whyAfter.target !== whyBefore.target || cueAfter.line1 !== cueBefore.line1,
    "RT-05: the in-session set moved the cue (the case is not vacuous)",
    `before=${JSON.stringify(whyBefore.target)} after=${JSON.stringify(whyAfter.target)}`);
  await closeWhy(page);

  assert(errors.length === 0, "no page errors during the why-sheet sessions", errors);
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
