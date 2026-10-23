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
import { launchChromium, openShelfField, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

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
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
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

async function seed(page, { ambiguousPerSideReview = false, knownModeNullConfigRequired = false } = {}) {
  return page.evaluate(({ request, weight, reps, ambiguousPerSideReview, knownModeNullConfigRequired }) => {
    const generated = window.RepForgeProgramCompiler.generateProgram(request, window.RepForgeExerciseCatalog.snapshot());
    let definition = generated.value;
    const target = definition.days.filter((day) => day.kind === "training").map((day) => ({ day, slot: day.slots[0] }))
      .find(({ slot }) => JSON.stringify(slot.metricIds) === JSON.stringify([weight, reps]) &&
        slot.prescriptionsByCycle[0].sets.length >= 2);
    const knownPerSide = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
      day.slots.map((slot) => ({ day, slot }))).find(({ slot }) =>
      slot.executionMode === "bilateral" &&
      slot.metricDefinitions.some((metric) => metric.semantic === "loadPerSideKg") &&
      slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide"));
    let perSide = knownPerSide;
    if (ambiguousPerSideReview) {
      const hipHinge = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
        day.slots.map((slot) => ({ day, slot }))).find(({ slot }) => (slot.movementPatternIds || []).includes("19e5c6f170d88068951fd7fffc03ed0d"));
      if (!hipHinge) throw new Error("generated recommendation has no lower B hip-hinge slot to swap in Review");
      const exerciseId = "3895c6f170d88002b51fdf96c7dc50e1";
      const exerciseCatalog = window.RepForgeExerciseCatalog.snapshot();
      const rawExercise = exerciseCatalog.exercises.find((entry) => entry.id === exerciseId);
      const laterality = (rawExercise?.laterality || []).map((id) => exerciseCatalog.uuidIndex?.[id]?.name).filter(Boolean);
      if (laterality.length !== 1 || laterality[0] !== "Asymmetrical") {
        throw new Error(`the Review-picked B-stance fixture is no longer catalog-ambiguous: ${JSON.stringify(laterality)}`);
      }
      const edited = window.RepForgeProgramReview.applyEdit(definition, {
        kind: "swap", slotId: hipHinge.slot.id, exerciseId,
      }, {
        compiler: window.RepForgeProgramCompiler, catalog: exerciseCatalog,
        metrics: window.RepForgeExerciseMetrics, ordinal: 1,
      });
      if (!edited.ok) throw new Error(`Review catalog swap refused the ambiguous B-stance movement: ${JSON.stringify(edited)}`);
      const checked = window.RepForgeProgramCompiler.validateProgramDefinition(edited.definition, exerciseCatalog, []);
      if (!checked.ok) throw new Error(`Review catalog swap produced an invalid canonical definition: ${JSON.stringify(checked.issues)}`);
      definition = edited.definition;
      perSide = definition.days.filter((day) => day.kind === "training").flatMap((day) =>
        day.slots.map((slot) => ({ day, slot }))).find(({ slot }) => slot.exerciseId === exerciseId);
      if (!perSide || perSide.slot.executionMode != null || perSide.slot.id === knownPerSide?.slot.id ||
        !perSide.slot.metricDefinitions.some((metric) => metric.semantic === "loadPerSideKg") ||
        !perSide.slot.metricDefinitions.some((metric) => metric.semantic === "repsPerSide")) {
        throw new Error("Review catalog-picked B-stance slot did not retain its unknown execution mode");
      }
    }
    if (knownModeNullConfigRequired) {
      const exerciseCatalog = window.RepForgeExerciseCatalog.snapshot();
      const rawExercise = exerciseCatalog.exercises.find((entry) => entry.id === knownPerSide?.slot.exerciseId);
      const laterality = (rawExercise?.laterality || []).map((id) => exerciseCatalog.uuidIndex?.[id]?.name).filter(Boolean);
      const hasKnownBilateralMode = laterality.includes("Bilateral") && !laterality.includes("Unilateral");
      if (!knownPerSide || !hasKnownBilateralMode || knownPerSide.slot.executionMode !== "bilateral") {
        throw new Error(`the known-laterality guard fixture is no longer a generated bilateral slot: ${JSON.stringify(laterality)}`);
      }
      // Model a persisted configuration-required prescription whose mode was
      // not stored, while the built-in catalog still establishes laterality.
      // The production recommendation adapter must keep this generic status
      // and must not add the missing-mode explanation.
      knownPerSide.slot.executionMode = null;
      for (const cycle of knownPerSide.slot.prescriptionsByCycle || []) {
        for (const set of cycle.sets || []) set.status = "configuration_required";
      }
      const checked = window.RepForgeProgramCompiler.validateProgramDefinition(definition, exerciseCatalog, []);
      if (!checked.ok) throw new Error(`known-laterality guard fixture is not a valid canonical definition: ${JSON.stringify(checked.issues)}`);
    }
    return window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Why sheet proof", answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "why-sheet-067" },
    }).then(() => window.__repforgeStorage.flush()).then(() => {
      const program = JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || [];
      const perSideRow = program.find((row) => row.slotId === perSide?.slot.id);
      const knownPerSideRow = program.find((row) => row.slotId === knownPerSide?.slot.id);
      return target && perSide && perSideRow && knownPerSide && knownPerSideRow && {
        day: target.day.name, slotId: target.slot.id, exerciseId: target.slot.exerciseId,
        perSide: { day: perSide.day.name, rowId: perSideRow.id, slotId: perSide.slot.id, exerciseId: perSide.slot.exerciseId },
        knownPerSide: { day: knownPerSide.day.name, rowId: knownPerSideRow.id, slotId: knownPerSide.slot.id,
          exerciseId: knownPerSide.slot.exerciseId },
      };
    });
  }, { request: REQUEST, weight: WEIGHT, reps: REPS, ambiguousPerSideReview, knownModeNullConfigRequired });
}

async function fillShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 5000 });
  if (await input.getAttribute("aria-hidden") === "true")
    await openShelfField(page, `#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`);
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function measureLargeTextTodayTarget(page, rowId) {
  const style = await page.addStyleTag({ content: "html { font-size: 32px !important; }" });
  try {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    return await page.evaluate((id) => {
      const root = document.documentElement;
      const target = document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"] .rxrow__target`);
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      const lineHeight = Number.parseFloat(getComputedStyle(target).lineHeight);
      return {
        language: window.RepForgeI18n.getLang(),
        viewport: root.clientWidth,
        document: root.scrollWidth,
        text: target.textContent.replace(/\s+/g, " ").trim(),
        left: rect.left,
        right: rect.right,
        width: target.clientWidth,
        scrollWidth: target.scrollWidth,
        height: target.scrollHeight,
        lineHeight,
      };
    }, rowId);
  } finally {
    await style.evaluate((node) => node.remove());
  }
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
    const definition = JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.programDefinition;
    const slot = (definition?.days || []).flatMap((day) => day.slots || []).find((candidate) => candidate.id === ex?.slotId);
    return {
      status: rec.status, load: rec.load,
      engineStatus: rec.engineStatus, reason: rec.reason, reasonCodes: rec.reasonCodes,
      min: ex.min, max: ex.max, sets: ex.sets, executionMode: slot?.executionMode ?? null,
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
  if (!target) throw new Error("no weighted first slot with 2+ sets and generated per-side slot in the program");

  // S1: exercise the generated per-side slot in its own fresh device so
  // today's-row navigation cannot change which slot the adaptive proof starts.
  const perSideContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const perSidePage = await perSideContext.newPage();
  await perSidePage.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
  await perSidePage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(perSidePage, { base: BASE });
  const perSideProgram = await seed(perSidePage, { ambiguousPerSideReview: true });
  if (!perSideProgram) throw new Error("no generated or Review catalog-picked per-side slot in the program");

  // The generated bilateral slot has a known multiplier and no history, so it
  // stays a new pick-load state. The ambiguous B-stance target below is a real
  // Review catalog swap and needs the lifter to choose its execution mode.
  const knownPerSideTruth = await engineTruth(perSidePage, perSideProgram.knownPerSide.slotId);
  assert(knownPerSideTruth.status === "new" && knownPerSideTruth.reasonCodes?.includes("no_comparable_history") &&
    knownPerSideTruth.executionMode === "bilateral" && knownPerSideTruth.load == null,
    "P069-S3-WHY: generated known-bilateral per-side work has no-history pick-load behavior", knownPerSideTruth);

  await perSidePage.evaluate((id) => window.__repforgeGoToLogExercise(id), perSideProgram.knownPerSide.rowId);
  await perSidePage.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  await perSidePage.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    perSideProgram.knownPerSide.rowId, { timeout: 10000 });
  const knownPerSideContext = await perSidePage.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft?.exercises?.[draft.session?.selectedExerciseId];
    const set = exercise?.sets?.[exercise.setOrder?.[0]];
    return set?.programmed?.loadingContext || null;
  });
  assert(knownPerSideContext?.loadingConvention === "per_side" && knownPerSideContext.externalLoadMultiplier === 2 &&
    knownPerSideTruth.executionMode === "bilateral",
    "P069-S3-WHY: entering the generated known-bilateral slot establishes m=2 in the actual workout context", knownPerSideContext);
  const knownPerSideCue = await focusCue(perSidePage);
  assert(knownPerSideCue.line1 === `Pick a load for ${knownPerSideTruth.min}–${knownPerSideTruth.max} reps` && !knownPerSideCue.line2,
    "P069-S3-CUE: generated known-bilateral Focus asks for a load without claiming setup is missing",
    JSON.stringify({ cue: knownPerSideCue, truth: knownPerSideTruth }));

  const perSideTruth = await engineTruth(perSidePage, perSideProgram.perSide.slotId);
  assert(perSideTruth.status === "configuration_required" && perSideTruth.engineStatus === "configuration_required" &&
    perSideTruth.reasonCodes?.includes("execution_context_required") && perSideTruth.load == null &&
    perSideTruth.executionMode == null,
    "P069-S3-WHY: Review catalog-picked ambiguous B-stance work has no inferred execution mode or load", perSideTruth);
  await perSidePage.evaluate((id) => window.__repforgeGoToLogExercise(id), perSideProgram.perSide.rowId);
  await perSidePage.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  await perSidePage.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    perSideProgram.perSide.rowId, { timeout: 10000 });
  const perSideCue = await focusCue(perSidePage);
  assert(perSideCue.line1 === "Needs setup" && perSideCue.line2 === `${perSideTruth.min}–${perSideTruth.max} reps`,
    "P069-S3-CUE: Focus labels the Review catalog-picked ambiguous range Needs setup", JSON.stringify({ cue: perSideCue, truth: perSideTruth }));
  const perSideWhy = await openWhy(perSidePage);
  const perSideWhyText = perSideWhy.blocks.map((block) => block.text).join(" ");
  assert(perSideWhyText === "Tell Taurifer how you do this: both sides together, or one side at a time.",
    "P069-S3-WHY: ambiguous Review catalog pick explains the missing execution mode", perSideWhy);
  await closeWhy(perSidePage);
  await perSidePage.evaluate(() => window.__repforgeLeaveWorkout());
  await perSidePage.waitForFunction(() => !document.querySelector("#todayDash")?.classList.contains("hidden"), undefined, { timeout: 10000 });
  const perSideToday = await perSidePage.evaluate((id) => {
    const row = document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"]`);
    return row ? {
      target: row.querySelector(".rxrow__target")?.textContent?.replace(/\s+/g, " ").trim() || "",
      load: row.querySelector(".rxrow__load")?.textContent?.trim() || "",
    } : null;
  }, perSideProgram.perSide.rowId);
  assert(perSideToday?.target === `${perSideTruth.sets} × ${perSideTruth.min}–${perSideTruth.max} · Needs setup` && perSideToday.load === "–",
    "P069-S3-CUE: Today shows the Review catalog-picked per-side sets × range without a load suggestion", JSON.stringify(perSideToday));
  const perSideLargeText = await measureLargeTextTodayTarget(perSidePage, perSideProgram.perSide.rowId);
  assert(perSideLargeText?.language === "en" && perSideLargeText.text === perSideToday.target &&
    perSideLargeText.document <= perSideLargeText.viewport && perSideLargeText.left >= 0 &&
    perSideLargeText.right <= perSideLargeText.viewport + 1 && perSideLargeText.scrollWidth <= perSideLargeText.width + 1 &&
    perSideLargeText.height > perSideLargeText.lineHeight * 1.5,
    "P069-S3-CUE: the English setup-required Today target wraps at 200% text without horizontal overflow", perSideLargeText);
  console.log(`  EN setup-required 200% target geometry: ${JSON.stringify(perSideLargeText)}`);
  await perSideContext.close();

  // A legacy or otherwise configuration-required prescription can have no
  // stored slot mode even though its built-in catalog laterality is known.
  // This enters the same production recommendation/Why boundary as the
  // ambiguous Review pick above, while guarding the adapter's reason mapping.
  const modeGuardContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const modeGuardPage = await modeGuardContext.newPage();
  await modeGuardPage.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
  await modeGuardPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(modeGuardPage, { base: BASE });
  const modeGuardProgram = await seed(modeGuardPage, { knownModeNullConfigRequired: true });
  if (!modeGuardProgram) throw new Error("no known-laterality configuration-required slot in the program");
  const modeGuardTruth = await engineTruth(modeGuardPage, modeGuardProgram.knownPerSide.slotId);
  assert(modeGuardTruth.status === "configuration_required" && modeGuardTruth.engineStatus === "configuration_required" &&
    modeGuardTruth.executionMode == null && modeGuardTruth.reasonCodes?.includes("configuration_required") &&
    !modeGuardTruth.reasonCodes?.includes("execution_context_required") && modeGuardTruth.load == null,
    "P069-S3-WHY: known catalog laterality does not turn a generic configuration-required reason into missing execution mode",
    modeGuardTruth);
  await modeGuardPage.evaluate((id) => window.__repforgeGoToLogExercise(id), modeGuardProgram.knownPerSide.rowId);
  await modeGuardPage.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  await modeGuardPage.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
    modeGuardProgram.knownPerSide.rowId, { timeout: 10000 });
  const modeGuardLoading = await modeGuardPage.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft?.exercises?.[draft.session?.selectedExerciseId];
    const set = exercise?.sets?.[exercise.setOrder?.[0]];
    return set?.programmed?.loadingContext || null;
  });
  assert(modeGuardLoading?.loadingConvention === "per_side" &&
    modeGuardLoading.externalLoadMultiplier === 2,
    "P069-S3-WHY: catalog laterality still establishes m=2 in the actual workout context", modeGuardLoading);
  const modeGuardWhy = await openWhy(modeGuardPage);
  assert(!modeGuardWhy.blocks.map((block) => block.text).join(" ").includes("Tell Taurifer how you do this: both sides together, or one side at a time."),
    "P069-S3-WHY: the Why sheet does not ask for an execution mode already resolved by catalog laterality", modeGuardWhy);
  await closeWhy(modeGuardPage);
  await modeGuardContext.close();

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

  // S1: a real Build fixture has a rep target but no authored load. Today,
  // Focus and Why all keep that distinction visible.
  const buildContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buildPage = await buildContext.newPage();
  const buildErrors = [];
  buildPage.on("pageerror", (error) => buildErrors.push(String(error?.stack || error)));
  await buildPage.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
  await buildPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(buildPage, { base: BASE });
  const buildState = await installSeedProgram(buildPage, {
    waitFor: (current) => waitForAppBoot(current, { base: BASE }),
  });
  const buildRow = buildState.program[0];
  const buildTruth = await engineTruth(buildPage, buildRow.slotId);
  assert(buildTruth.status === "manual" && buildTruth.engineStatus === "manual" && buildTruth.load == null,
    "P069-S1-WHY: a Build slot remains manual and has no engine load", buildTruth);
  const buildToday = await buildPage.evaluate((id) => {
    const row = document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"]`);
    return row ? {
      target: row.querySelector(".rxrow__target")?.textContent?.replace(/\s+/g, " ").trim() || "",
      load: row.querySelector(".rxrow__load")?.textContent?.trim() || "",
    } : null;
  }, buildRow.id);
  // The manual target is sets × range alone (owner copy, 2026-10-18).
  assert(buildToday?.target === `${buildRow.sets} × ${buildRow.min}–${buildRow.max}` && buildToday.load === "–",
    "P069-S1-CUE: Today shows a Build slot's sets × range without a load suggestion", JSON.stringify(buildToday));
  const buildLargeText = await measureLargeTextTodayTarget(buildPage, buildRow.id);
  assert(buildLargeText?.language === "en" && buildLargeText.text === buildToday.target &&
    buildLargeText.document <= buildLargeText.viewport && buildLargeText.left >= 0 &&
    buildLargeText.right <= buildLargeText.viewport + 1 && buildLargeText.scrollWidth <= buildLargeText.width + 1,
  "P069-S1-CUE: the English manual Today target fits at 200% text without horizontal overflow", buildLargeText);
  console.log(`  EN manual 200% target geometry: ${JSON.stringify(buildLargeText)}`);
  await buildPage.evaluate((day) => window.__repforgeEnterWorkout({ day }), buildRow.day);
  await buildPage.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
  const buildCue = await focusCue(buildPage);
  assert(buildCue.line1 === "Your targets" && buildCue.line2 === `${buildRow.min}–${buildRow.max} reps`,
    "P069-S1-CUE: Focus labels a Build slot's stored range as Your targets", JSON.stringify(buildCue));
  const buildWhy = await openWhy(buildPage);
  const buildWhyText = buildWhy.blocks.map((block) => block.text).join(" ");
  assert(buildWhy.target === "" && buildWhyText === "This exercise has a rep range, but Taurifer does not suggest a load.",
    "P069-S1-WHY: a Build slot has no invented target and Why stays neutral about who chose the range", buildWhy);
  assert(buildErrors.length === 0, "no page errors in the Build Why journey", buildErrors);
  await buildContext.close();

  const setupPtContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  try {
    const setupPtPage = await setupPtContext.newPage();
    await setupPtPage.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await setupPtPage.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(setupPtPage, { base: BASE });
    const ptProgram = await seed(setupPtPage, { ambiguousPerSideReview: true });
    if (!ptProgram) throw new Error("no Review catalog-picked ambiguous per-side row in the Portuguese target-wrap proof");
    const ptRows = await setupPtPage.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []);
    const ptPerSideRow = ptRows.find((row) => row.slotId === ptProgram.perSide.slotId);
    if (!ptPerSideRow) throw new Error("Portuguese setup-required target row is missing from the program");
    await setupPtPage.evaluate((id) => window.__repforgeGoToLogExercise(id), ptPerSideRow.id);
    await setupPtPage.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 10000 });
    await setupPtPage.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id,
      ptPerSideRow.id, { timeout: 10000 });
    await setupPtPage.evaluate(() => window.__repforgeLeaveWorkout());
    await setupPtPage.waitForFunction(() => !document.querySelector("#todayDash")?.classList.contains("hidden"), undefined, { timeout: 10000 });
    const ptPerSideToday = await setupPtPage.evaluate((id) =>
      document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"] .rxrow__target`)
        ?.textContent?.replace(/\s+/g, " ").trim() || "", ptPerSideRow.id);
    const ptPerSideLargeText = await measureLargeTextTodayTarget(setupPtPage, ptPerSideRow.id);
    assert(ptPerSideLargeText?.language === "pt" && ptPerSideToday === `${ptPerSideRow.sets} × ${ptPerSideRow.min}–${ptPerSideRow.max} · Precisa de configuração` &&
      ptPerSideLargeText.text === ptPerSideToday && ptPerSideLargeText.document <= ptPerSideLargeText.viewport &&
      ptPerSideLargeText.left >= 0 && ptPerSideLargeText.right <= ptPerSideLargeText.viewport + 1 &&
      ptPerSideLargeText.scrollWidth <= ptPerSideLargeText.width + 1 && ptPerSideLargeText.height > ptPerSideLargeText.lineHeight * 1.5,
    "P069-S1-CUE: the Portuguese setup-required Today target wraps at 200% text without horizontal overflow", ptPerSideLargeText);
    console.log(`  PT setup-required 200% target geometry: ${JSON.stringify(ptPerSideLargeText)}`);
  } finally {
    await setupPtContext.close();
  }

  const manualPtContext = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR" });
  try {
    const manualPtPage = await manualPtContext.newPage();
    await manualPtPage.clock.setFixedTime(new Date("2026-03-02T09:00:00.000Z"));
    await manualPtPage.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(manualPtPage, { base: BASE });
    const manualPtState = await installSeedProgram(manualPtPage, {
      waitFor: (current) => waitForAppBoot(current, { base: BASE }),
    });
    const manualPtRow = manualPtState.program[0];
    const manualPtToday = await manualPtPage.evaluate((id) =>
      document.querySelector(`#todayDash .rxrow[data-exopen="${CSS.escape(id)}"] .rxrow__target`)
        ?.textContent?.replace(/\s+/g, " ").trim() || "", manualPtRow.id);
    const manualPtLargeText = await measureLargeTextTodayTarget(manualPtPage, manualPtRow.id);
    assert(manualPtLargeText?.language === "pt" && manualPtToday === `${manualPtRow.sets} × ${manualPtRow.min}–${manualPtRow.max}` &&
      manualPtLargeText.text === manualPtToday && manualPtLargeText.document <= manualPtLargeText.viewport &&
      manualPtLargeText.left >= 0 && manualPtLargeText.right <= manualPtLargeText.viewport + 1 &&
      manualPtLargeText.scrollWidth <= manualPtLargeText.width + 1,
    "P069-S1-CUE: the Portuguese manual Today target fits at 200% text without horizontal overflow", manualPtLargeText);
    console.log(`  PT manual 200% target geometry: ${JSON.stringify(manualPtLargeText)}`);
  } finally {
    await manualPtContext.close();
  }

  assert(errors.length === 0, "no page errors during the why-sheet sessions", errors);
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
