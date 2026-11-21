import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { savedLiftIdentity } = require("../progression-engine.js");
const { DEFINITIONS } = require("../exercise-metrics.js");
const { dumbbellLoadsKg } = require("../starting-loads.js");
const { suggestWarmups, classifyWarmupFinish, previewWarmupEdit } = require("../warmup-suggestions.js");

const NOW = Date.UTC(2026, 10, 20, 12);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const SQUAT = "a1111111111111111111111111111111";
const LEG_PRESS = "b2222222222222222222222222222222";
const QUADS = "quads";
const grid = Array.from({ length: 60 }, (_, index) => (index + 1) * 2.5);
const metricSemantics = ["loadKg", "reps"];

function comparableKey(overrides = {}) {
  const { movementId = SQUAT, equipmentId = "barbell", semantics = metricSemantics, coefficient = 0,
    convention = "external", mode = null, multiplier = 1 } = overrides;
  const metricDefinitions = semantics.map(semantic => DEFINITIONS.find(metric => metric.semantic === semantic));
  return savedLiftIdentity({
    exerciseId: movementId,
    metricType: "source_metrics@1",
    metricIds: metricDefinitions.map(metric => metric.id),
    metricDefinitions,
    loadingModel: { bodyweightCoefficient: coefficient },
    context: { equipmentId, loadingConvention: convention, executionMode: mode,
      externalLoadMultiplier: multiplier, bodyweightContributionEnabled: coefficient > 0 },
  });
}

const liftKey = comparableKey();
const legPressKey = comparableKey({ movementId: LEG_PRESS, equipmentId: "machine" });
const basis = {
  liftKey, movementId: SQUAT, primaryMuscle: QUADS, sessionId: "today",
  workLoadKg: 105, availableLoadsKg: grid, equipmentKind: "barbell", barKg: 20,
  loadingConvention: "external", metricSemantics, hasMaterialBodyweight: false, now: NOW,
};
const baseline = [[20, 8], [60, 5], [85, 2]];
const learned = [[20, 10], [50, 5], [70, 3], [90, 1]];
const warm = [[70, 3]];
const pairs = result => result.suggestions.map(({ loadKg, reps }) => [loadKg, reps]);
const suggest = overrides => suggestWarmups({ ...basis, ...overrides });
const recentLegPress = {
  liftKey: legPressKey, movementId: LEG_PRESS, primaryMuscle: QUADS,
  sessionId: "today", completedAt: NOW - 10 * MINUTE,
};
const earlierLift = { ...recentLegPress, elapsedMs: 10 * MINUTE };

function saved(index, sequence = learned, overrides = {}) {
  const sessionId = `session-${index}`;
  const savedAt = NOW + index * DAY;
  const steps = sequence.map(([loadKg, reps], step) => ({ setId: `${sessionId}-warmup-${step}`, loadKg, reps }));
  return {
    version: 1, liftKey, sessionId, workingSetId: `${sessionId}-work`, savedAt, workLoadKg: 105,
    resetGeneration: null, barKg: 20, earlierLift: null, decision: "edited",
    warmupSetIds: steps.map(step => step.setId), ...overrides, steps,
  };
}

const skip = (index, overrides) => saved(index, [], { decision: "skipped", ...overrides });
function inContext(index, sequence = warm, source = earlierLift) {
  const sessionId = `session-${index}`;
  const completedAt = NOW + index * DAY - 30 * MINUTE;
  return saved(index, sequence, { earlierLift: { ...source, sessionId, completedAt } });
}

test("the browser global runs the same policy without Node or a DOM", () => {
  const browser = {};
  runInNewContext(readFileSync(new URL("../warmup-suggestions.js", import.meta.url), "utf8"), browser);
  const result = browser.RepForgeWarmupSuggestions.suggestWarmups(basis);
  assert.equal(JSON.stringify(result), JSON.stringify(suggest()));
});

test("approved baseline uses canonical offered loads and yields exact plate arithmetic", () => {
  assert.ok(liftKey && legPressKey);
  const result = suggest();
  assert.equal(result.reason, "baseline");
  assert.deepEqual(pairs(result), baseline);
  assert.deepEqual(result.suggestions.map(step => step.platesPerSideKg), [[], [20], [25, 5, 2.5]]);
  assert.deepEqual(result.evidence, {
    liftKey, workLoadKg: 105, barKg: 20, resetGeneration: null, earlierLift: null,
    sessions: [], skipStreak: 0, unavailableReason: null, lowestLighterLoadKg: 20,
  });
});

test("attainable bar loads are the intersection of the grid and paired plates", () => {
  const result = suggest({ workLoadKg: 100, availableLoadsKg: [81, 77.5, 20, 60, 55, 77.5, 100, 500] });
  assert.deepEqual(pairs(result), [[20, 8], [55, 5], [77.5, 2]]);
  assert.deepEqual(result.suggestions[2].platesPerSideKg, [25, 2.5, 1.25]);
  assert.deepEqual(pairs(suggest({ availableLoadsKg: [30, 60, 85], barKg: 20 })), [[60, 5], [85, 2]]);
  const otherBar = suggest({ barKg: 15 });
  assert.deepEqual(pairs(otherBar), [[15, 8], [60, 5], [85, 2]]);
  assert.deepEqual(otherBar.suggestions[0].platesPerSideKg, []);
});

test("no known bar omits its step and hint; grid ties go down and collisions keep the earlier step", () => {
  const noBar = suggest({ barKg: null });
  assert.deepEqual(pairs(noBar), [[60, 5], [85, 2]]);
  assert.ok(noBar.suggestions.every(step => step.platesPerSideKg === null));
  const machine = { equipmentKind: "machine", barKg: null, workLoadKg: 100 };
  assert.deepEqual(pairs(suggest({ ...machine, availableLoadsKg: [85, 65, 100, 55, 75, 65] })), [[55, 5], [75, 2]]);
  assert.deepEqual(pairs(suggest({ ...machine, availableLoadsKg: [65, 80, 100] })), [[80, 2]]);
  assert.deepEqual(pairs(suggest({ ...machine, availableLoadsKg: [60, 100] })), [[60, 5]]);
  assert.deepEqual(pairs(suggest({ ...machine, workLoadKg: 5, availableLoadsKg: [5, 10] })), []);
  assert.deepEqual(pairs(suggest({ workLoadKg: 20, availableLoadsKg: grid })), []);
  assert.deepEqual(pairs(suggest({ workLoadKg: 22.5 })), [[20, 8]]);
});

test("the dumbbell ladder stays per hand and a display-unit round trip keeps canonical kg choices", () => {
  const dumbbells = { equipmentKind: "dumbbell", barKg: null, workLoadKg: 44, availableLoadsKg: dumbbellLoadsKg("kg") };
  assert.deepEqual(pairs(suggest(dumbbells)), [[26, 5], [36, 2]]);
  const kgPerLb = 0.45359237;
  const roundTripKg = kg => (kg / kgPerLb) * kgPerLb;
  const loads = [55, 65, 75, 85, 100];
  const result = suggest({ ...dumbbells, workLoadKg: 100, availableLoadsKg: loads });
  assert.deepEqual(pairs(suggest({
    ...dumbbells, workLoadKg: roundTripKg(100), availableLoadsKg: loads.map(roundTripKg),
  })).map(([load, reps]) => [Math.round(load), reps]), pairs(result));
  const lbGrid = dumbbellLoadsKg("lb");
  assert.deepEqual(pairs(suggest({ ...dumbbells, workLoadKg: 100 * kgPerLb, availableLoadsKg: lbGrid })),
    [[lbGrid.find(kg => Math.abs(kg - 60 * kgPerLb) < 0.001), 5],
      [lbGrid.find(kg => Math.abs(kg - 80 * kgPerLb) < 0.001), 2]]);
});

test("unsupported loading returns explicit reasons and preserves manual warm-up eligibility", () => {
  const cases = [
    [{ loadingConvention: "bodyweight", metricSemantics: ["reps"] }, "bodyweight", true],
    [{ loadingConvention: "assistance", metricSemantics: ["reps", "assistanceKg"] }, "assistance", true],
    [{ hasMaterialBodyweight: true }, "bodyweight", true],
    [{ metricSemantics: ["loadKg", "durationSeconds"] }, "unsupported-metrics", false],
    [{ workLoadKg: null }, "unknown-work-load", true],
    [{ liftKey: null }, "unknown-lift", true],
    [{ workLoadKg: 20 }, "no-lighter-load", true],
    [{ equipmentKind: "unknown" }, "unknown-equipment", true],
    [{ loadingConvention: "per_side" }, "unsupported-loading", true],
  ];
  for (const [input, unavailableReason, manualAllowed] of cases) {
    const result = suggest(input);
    assert.equal(result.reason, "none-with-reason");
    assert.deepEqual(result.suggestions, []);
    assert.equal(result.evidence.unavailableReason, unavailableReason);
    assert.equal(result.manualAllowed, manualAllowed);
  }
  assert.deepEqual(pairs(suggest({ equipmentKind: "machine", loadingConvention: "per_side",
    metricSemantics: ["repsPerSide", "loadPerSideKg"], workLoadKg: 50, barKg: null })), [[30, 5], [40, 2]]);
});

test("two agreeing saved sequences learn additions and removals; one change preserves the established preference", () => {
  const first = saved(-5, [[20, 10], [40, 5], [57.5, 3], [72.5, 1]], { workLoadKg: 85 });
  const second = saved(-4);
  const third = saved(-3);
  const shorter = [[20, 10], [70, 3]];
  assert.equal(suggest({ observations: [first] }).reason, "baseline");
  const result = suggest({ observations: [first, second, third] });
  assert.equal(result.reason, "learned");
  assert.deepEqual(pairs(result), learned);
  assert.deepEqual(result.evidence.sessions, [first, second, third].map(({ sessionId, savedAt }) => ({ sessionId, savedAt })));
  assert.deepEqual(pairs(suggest({ observations: [first, second], workLoadKg: 125 })),
    [[20, 10], [60, 5], [82.5, 3], [107.5, 1]]);
  assert.deepEqual(pairs(suggest({ observations: [first, second, saved(-2, shorter)] })), learned);
  assert.deepEqual(pairs(suggest({ observations: [first, second, saved(-2, shorter), saved(-1, shorter)] })), shorter);
  assert.equal(suggest({ observations: [saved(-2, baseline, { decision: "completed" }),
    saved(-1, baseline, { decision: "completed" })] }).reason, "learned");
});

test("comparable identity isolates movement, equipment, metrics, convention, mode and material bodyweight", () => {
  const variants = [
    { movementId: LEG_PRESS }, { equipmentId: "smith" }, { semantics: ["loadKg", "repsPerSide"] },
    { convention: "per_side" }, { multiplier: 2 }, { coefficient: 0.3 },
  ];
  for (const variant of variants) {
    const other = comparableKey(variant);
    assert.ok(other && other !== liftKey);
    assert.equal(suggest({ observations: [saved(-2), saved(-1, learned, { liftKey: other })] }).reason, "baseline");
  }
  const perSide = { semantics: ["repsPerSide", "loadPerSideKg"], convention: "per_side" };
  assert.notEqual(comparableKey({ ...perSide, mode: "bilateral" }), comparableKey({ ...perSide, mode: "unilateral" }));
  assert.equal(comparableKey({ coefficient: 0.25 }), liftKey);
});

test("already warm uses the latest qualifying logged working lift and two matching one-step sessions", () => {
  const ordinary = [saved(-5), saved(-4)];
  const shortHistory = [inContext(-3), inContext(-2)];
  const observations = [...ordinary, ...shortHistory];
  const completedWorkingLifts = [
    { ...recentLegPress, liftKey, movementId: SQUAT, completedAt: NOW },
    { ...recentLegPress, primaryMuscle: "calves", completedAt: NOW },
    { ...recentLegPress, sessionId: "prior", completedAt: NOW },
    { ...recentLegPress, completedAt: NOW + MINUTE },
    recentLegPress,
  ];
  const result = suggest({ observations, completedWorkingLifts });
  assert.equal(result.reason, "already-warm");
  assert.deepEqual(pairs(result), warm);
  assert.deepEqual(result.evidence.earlierLift, earlierLift);
  assert.deepEqual(pairs(suggest({ observations, completedWorkingLifts, workLoadKg: 120 })), [[80, 3]]);
  assert.deepEqual(result.evidence.sessions, shortHistory.map(({ sessionId, savedAt }) => ({ sessionId, savedAt })));
  assert.equal(suggest({ observations }).reason, "learned");
  assert.equal(suggest({ observations, completedWorkingLifts: [{ ...recentLegPress, completedAt: NOW - 15 * MINUTE }] }).reason, "already-warm");
  assert.equal(suggest({ observations, completedWorkingLifts: [{ ...recentLegPress, completedAt: NOW - 15 * MINUTE - 1 }] }).reason, "learned");
  const newerLift = { ...recentLegPress, liftKey: "front-squat", movementId: "front-squat", completedAt: NOW - MINUTE };
  assert.equal(suggest({ observations, completedWorkingLifts: [...completedWorkingLifts, newerLift] }).reason, "learned");
  assert.equal(suggest({ observations: [shortHistory[0], inContext(-1, learned)], completedWorkingLifts }).reason, "baseline");
  assert.equal(suggest({ observations: [shortHistory[0], inContext(-1, warm, { ...earlierLift, elapsedMs: 16 * MINUTE })],
    completedWorkingLifts }).reason, "baseline");
});

test("the sequence window expires by date and by the last six eligible sessions", () => {
  assert.equal(suggest({ observations: [saved(-91), saved(-90)] }).reason, "baseline");
  assert.equal(suggest({ observations: [saved(-90), saved(-89)] }).reason, "learned");
  const changes = Array.from({ length: 5 }, (_, i) => saved(i - 5, [[40, i + 1]]));
  assert.equal(suggest({ observations: [saved(-8), saved(-7), ...changes.slice(1)] }).reason, "learned");
  assert.equal(suggest({ observations: [saved(-8), saved(-7), ...changes] }).reason, "baseline");
  assert.equal(suggest({ observations: [saved(-4), skip(-3), saved(-2)] }).reason, "baseline");
});

test("whole skips suppress across contexts and expiry until a saved preparation or reset", () => {
  const observations = [inContext(-120), inContext(-119), skip(-110), skip(-109), skip(-108)];
  const result = suggest({ observations, completedWorkingLifts: [recentLegPress] });
  assert.equal(result.reason, "suppressed");
  assert.deepEqual(result.suggestions, []);
  assert.equal(result.evidence.skipStreak, 3);
  assert.deepEqual(result.evidence.sessions.map(row => row.sessionId), ["session--110", "session--109", "session--108"]);
  assert.equal(suggest({ observations: observations.slice(0, -1) }).reason, "baseline");
  assert.equal(suggest({ observations: [...observations, saved(-1, [[65, 3]])] }).reason, "baseline");
  assert.equal(suggest({ observations, resetGeneration: "after-reset" }).reason, "baseline");
  assert.equal(suggest({ observations: [...observations, inContext(-2), inContext(-1), skip(-0.8), skip(-0.6), skip(-0.4)],
    completedWorkingLifts: [recentLegPress] }).reason, "suppressed");
});

test("reordering, retries, stale generations and missing or contradictory history cannot teach", () => {
  const first = saved(-3);
  const second = saved(-2);
  const invalid = [
    saved(1), saved(-1, learned, { resetGeneration: "old" }),
    saved(-1, learned, { workingSetId: null }),
    saved(-1, learned, { warmupSetIds: ["deleted-row"] }),
    saved(-1, learned, { sessionId: "today" }),
    saved(-1, learned, { version: 2 }),
  ];
  const observations = [first, second, ...invalid, structuredClone(second)];
  const snapshot = structuredClone(observations);
  assert.deepEqual(suggest({ observations }), suggest({ observations: [...observations].reverse() }));
  assert.deepEqual(suggest({ observations }).evidence.sessions.map(session => session.sessionId), [first.sessionId, second.sessionId]);
  assert.deepEqual(observations, snapshot);
  const corrected = { ...second, steps: second.steps.map((step, index) => index === 0 ? { ...step, reps: 8 } : step) };
  assert.equal(suggest({ observations: [first, corrected] }).reason, "baseline");
  assert.deepEqual(pairs(suggest({ observations: [first, corrected, saved(-1, [[20, 8], ...learned.slice(1)])] })),
    [[20, 8], ...learned.slice(1)]);
  assert.equal(suggest({ observations: [first, structuredClone(first), ...invalid] }).reason, "baseline");
  assert.equal(suggest({ observations: [first, { ...first, decision: "completed" }, second] }).reason, "baseline");
  assert.equal(suggest({ observations: [skip(-3), skip(-2), structuredClone(skip(-2))] }).reason, "baseline");
  assert.equal(suggest({ resetGeneration: "new", observations: [first, second, saved(-1, learned, { resetGeneration: "new" })] }).reason, "baseline");
  const oversized = [...learned, [92.5, 1], [95, 1], [97.5, 1]];
  assert.equal(suggest({ observations: [saved(-2, oversized), saved(-1, oversized)] }).reason, "baseline");
});

function finish(sequence, overrides = {}) {
  const suggestion = suggest();
  const steps = sequence.map(([loadKg, reps], index) => ({ setId: `actual-${index}`, loadKg, reps }));
  return classifyWarmupFinish({
    suggestion, steps, sessionId: "today", workingSetId: "first-work", savedAt: NOW,
    availableLoadsKg: grid, ...overrides,
  });
}

test("finish captures actual row IDs, context and generation only after completed work and an explicit decision", () => {
  const suggestion = suggest({ completedWorkingLifts: [recentLegPress], resetGeneration: "new" });
  const { observation, onceMore } = finish(warm, { suggestion, resetGeneration: "new" });
  assert.deepEqual(observation, {
    version: 1, liftKey, workLoadKg: 105, resetGeneration: "new", barKg: 20, earlierLift,
    sessionId: "today", workingSetId: "first-work", savedAt: NOW, decision: "edited", warmupSetIds: ["actual-0"],
  });
  assert.equal(onceMore, true);
  assert.equal(finish(baseline).observation.decision, "completed");
  assert.equal(finish([], { skipped: true }).observation.decision, "skipped");
  assert.deepEqual(finish([], { skipped: true }).observation.warmupSetIds, []);
  const unlogged = { loadKg: 60, reps: 5 };
  assert.equal(finish([], { skipped: true, steps: [unlogged] }).observation?.decision, "skipped");
  for (const result of [
    finish([]), finish(warm, { skipped: true }), finish(warm, { workingSetId: null }),
    finish(warm, { steps: [{ setId: null, loadKg: 70, reps: 3 }] }),
    finish(warm, { steps: [null] }),
    finish(warm, { skipped: true, steps: [{ ...unlogged, setId: "actual-0" }, unlogged] }),
    finish(warm, { suggestion, savedAt: NOW - MINUTE }),
    finish(warm, { steps: [{ setId: "same", loadKg: 20, reps: 8 }, { setId: "same", loadKg: 60, reps: 5 }] }),
    finish(warm, { observations: [saved(-1, learned, { sessionId: "today" })] }),
    finish(warm, { suggestion: suggest({ loadingConvention: "assistance", metricSemantics: ["reps", "assistanceKg"] }) }),
  ]) assert.deepEqual(result, { observation: null, onceMore: false });
});

test("once more requires a first change that survives normalization and can teach in the captured context", () => {
  assert.equal(finish(learned).onceMore, true);
  assert.equal(finish(learned, { observations: [saved(-1)] }).onceMore, false);
  assert.equal(finish(baseline).onceMore, false);
  assert.equal(finish([[20, 8], [59, 5], [85, 2]]).onceMore, false);
  assert.equal(finish(learned, { suggestion: suggest({ completedWorkingLifts: [recentLegPress] }) }).onceMore, false);
  const stale = finish(learned, { resetGeneration: "reset-after-capture" });
  assert.equal(stale.observation.resetGeneration, null);
  assert.equal(stale.onceMore, false);
  const resumed = finish(warm, { suggestion: suggest({ observations: [skip(-3), skip(-2), skip(-1)] }) });
  assert.equal(resumed.observation.decision, "edited");
});

test("each learning context keeps its own six observations", () => {
  const ordinary = [saved(-8), saved(-7)];
  const short = [inContext(-8), inContext(-7)];
  assert.equal(suggest({ observations: [...ordinary, ...Array.from({ length: 5 }, (_, i) => inContext(i - 5))] }).reason,
    "learned");
  assert.equal(suggest({ observations: [...short, ...Array.from({ length: 5 }, (_, i) => saved(i - 5))],
    completedWorkingLifts: [recentLegPress] }).reason, "already-warm");
});

test("both sessions snap to the active grid and invalid performed order or a working load cannot teach", () => {
  const oneOffGrid = saved(-2, [[59, 5]]);
  const oneOnGrid = saved(-1, [[60, 5]]);
  for (const observations of [[oneOffGrid, oneOnGrid], [{ ...oneOffGrid, savedAt: NOW }, { ...oneOnGrid, savedAt: NOW - DAY }]]) {
    assert.deepEqual(pairs(suggest({ observations })), [[60, 5]]);
  }
  const changedStep = suggest({
    availableLoadsKg: [20, 55, 60, 65, 85, 105],
    observations: [oneOffGrid, saved(-1, [[62.5, 5]])],
  });
  assert.equal(changedStep.reason, "learned");
  assert.deepEqual(pairs(changedStep), [[60, 5]]);
  const metricLadderPreparation = [[12, 5], [18, 2]];
  const lbLadder = dumbbellLoadsKg("lb");
  const lbLadderPreparation = [[lbLadder[4], 5], [lbLadder[7], 2]];
  for (const [previous, current] of [[metricLadderPreparation, lbLadderPreparation], [lbLadderPreparation, metricLadderPreparation]]) {
    const result = suggest({ equipmentKind: "dumbbell", barKg: null, workLoadKg: 25, availableLoadsKg: lbLadder,
      observations: [saved(-2, previous, { barKg: null, workLoadKg: 25 }), saved(-1, current, { barKg: null, workLoadKg: 25 })] });
    assert.equal(result.reason, "learned");
    assert.deepEqual(pairs(result), lbLadderPreparation);
  }
  for (const invalid of [[[85, 2], [60, 5]], [[60, 5], [60, 2]], [[110, 3]], [[105, 3]], [[59, 5], [61, 3]]]) {
    assert.equal(suggest({ observations: [saved(-2, invalid), saved(-1, invalid)] }).reason, "baseline");
  }
});

test("an explicit skip counts only when an automatic sequence was offered", () => {
  const suppressed = suggest({ observations: [skip(-3), skip(-2), skip(-1)] });
  for (const suggestion of [suppressed, suggest({ workLoadKg: 20 })]) {
    assert.deepEqual(finish([], { suggestion, skipped: true }), { observation: null, onceMore: false });
  }
  assert.equal(finish([[65, 3]], { suggestion: suppressed }).observation.decision, "edited");
});

test("bar hints and input loads stay within the canonical 1000 kg limit", () => {
  const result = suggest({ workLoadKg: 1000, availableLoadsKg: [20, 570, 800, 1002.5, Number.MAX_VALUE] });
  assert.deepEqual(pairs(result), [[20, 8], [570, 5], [800, 2]]);
  assert.equal(result.suggestions[2].platesPerSideKg.reduce((sum, kg) => sum + kg, 0) * 2 + 20, 800);
  assert.deepEqual(pairs(suggest({ workLoadKg: 1010, availableLoadsKg: [20, 1002.5] })), []);
  assert.equal(finish([[1002.5, 1]]).observation, null);
});

test("the pounds and unknown-bar adapter uses only the offered grid without plate hints", () => {
  const kg = lb => lb * 0.45359237;
  const availableLoadsKg = [45, 135, 185, 225].map(kg);
  const result = suggest({ workLoadKg: kg(225), availableLoadsKg, barKg: null });
  assert.deepEqual(pairs(result), [[kg(135), 5], [kg(185), 2]]);
  assert.deepEqual(result.suggestions.map(step => step.platesPerSideKg), [null, null]);
  assert.equal(result.evidence.lowestLighterLoadKg, kg(45));
});

test("malformed input fails closed and nullable list inputs are accepted", () => {
  assert.equal(suggestWarmups().reason, "none-with-reason");
  assert.equal(suggestWarmups(null).reason, "none-with-reason");
  assert.equal(suggest({ metricSemantics: null }).evidence.unavailableReason, "unsupported-metrics");
  assert.equal(suggest({ completedWorkingLifts: 42, observations: {}, availableLoadsKg: null }).reason, "none-with-reason");
  assert.equal(classifyWarmupFinish().observation, null);
  assert.equal(classifyWarmupFinish(null).observation, null);
  assert.equal(finish(warm, { observations: null, availableLoadsKg: null }).observation.decision, "edited");
  for (const steps of [null, {}]) assert.equal(finish(warm, { steps }).observation, null);
  for (const patch of [{ liftKey: 7 }, { workLoadKg: NaN }, { barKg: NaN }, { barKg: undefined }, { earlierLift: "leg press" }]) {
    const original = suggest();
    assert.equal(finish(warm, { suggestion: { ...original, evidence: { ...original.evidence, ...patch } } }).observation, null);
  }
  for (const suggestions of [null, {}, [null], [{ loadKg: NaN, reps: 1 }]]) {
    assert.equal(finish(warm, { suggestion: { ...suggest(), suggestions } }).observation, null);
  }
});

test("suppression survives missing time, while learned suggestions require a known evidence window", () => {
  for (const now of [undefined, null, NaN]) {
    assert.equal(suggest({ now, observations: [saved(-6), saved(-5)] }).reason, "baseline");
    assert.equal(suggest({ now, observations: [skip(-3), skip(-2), skip(-1)] }).reason, "suppressed");
    assert.equal(suggest({ now, observations: [skip(-3), skip(-2), skip(-1), saved(-0.5)] }).reason, "baseline");
  }
});

test("an established preference that cannot scale uses the baseline with its own reason and evidence", () => {
  const first = saved(-2, [[30, 4]], { workLoadKg: 100, barKg: null });
  const second = saved(-1, [[30, 4]], { workLoadKg: 100, barKg: null });
  const result = suggest({ equipmentKind: "machine", barKg: null, workLoadKg: 40, availableLoadsKg: [20, 30, 35, 40],
    observations: [first, second] });
  assert.equal(result.reason, "baseline-fallback");
  assert.deepEqual(pairs(result), [[20, 5], [30, 2]]);
  assert.deepEqual(result.evidence.sessions, [first, second].map(({ sessionId, savedAt }) => ({ sessionId, savedAt })));
});

test("Add one can take the baseline five-rep step or the lowest reachable lighter load", () => {
  const result = suggest();
  assert.deepEqual(result.suggestions.find(step => step.reps === 5 && step.loadKg !== result.evidence.barKg),
    { loadKg: 60, reps: 5, platesPerSideKg: [20] });
  const withoutBaseline = suggest({ equipmentKind: "machine", barKg: null, workLoadKg: 100, availableLoadsKg: [100, 95, 90] });
  assert.deepEqual(pairs(withoutBaseline), []);
  assert.equal(withoutBaseline.evidence.lowestLighterLoadKg, 90);
  assert.equal(suggest({ loadingConvention: "assistance", metricSemantics: ["reps", "assistanceKg"] })
    .evidence.lowestLighterLoadKg, null);
});

function preview(sequence, loggedStepIndex, overrides = {}) {
  const steps = sequence.map(([loadKg, reps], i) => ({ loadKg, reps, ...(i <= loggedStepIndex && { setId: `logged-${i}` }) }));
  return previewWarmupEdit({ suggestion: suggest(), steps, loggedStepIndex, now: NOW, sessionId: "today",
    availableLoadsKg: grid, ...overrides });
}

test("mid-workout preview reports an edited step or sequence with no working set or learning write", () => {
  const edited = [[20, 8], [65, 5], [85, 2]];
  assert.deepEqual(preview(edited, 1), { onceMore: true, kind: "step", step: { loadKg: 65, reps: 5 } });
  assert.deepEqual(preview([...baseline, [95, 1]], 3), { onceMore: true, kind: "sequence", step: null });
  assert.deepEqual(preview([[20, 8], [65, 5], [90, 2]], 1), { onceMore: true, kind: "sequence", step: null });
  const noNotice = { onceMore: false, kind: null, step: null };
  assert.deepEqual(preview(edited, 0), noNotice);
  assert.deepEqual(preview(edited, 1, { steps: edited.map(([loadKg, reps]) => ({ loadKg, reps })) }), noNotice);
  assert.deepEqual(preview(edited, 1, { steps: edited.map(([loadKg, reps]) => ({ loadKg, reps, setId: "duplicate" })) }), noNotice);
  assert.deepEqual(preview([[20, 8], [59, 5], [85, 2]], 1), noNotice);
  assert.deepEqual(preview(edited, 1, { observations: [saved(-1, [[20, 8], [64, 5], [85, 2]])] }), noNotice);
  assert.deepEqual(preview(edited, 1, { resetGeneration: "new" }), noNotice);
  assert.deepEqual(previewWarmupEdit(null), noNotice);
  assert.equal(finish([[20, 8], [64, 5], [85, 2]]).onceMore, true);
  assert.equal(finish(edited, { observations: [saved(-1, [[20, 8], [64, 5], [85, 2]])] }).onceMore, false);
});
