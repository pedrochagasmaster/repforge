#!/usr/bin/env node
// Keep opening-load arithmetic in this existing PR-lane command (the command-count ceiling is unchanged).
import "./starting-loads.mjs";
import "./engine-standing.mjs";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Engine = require(path.join(root, "progression-engine.js"));
const Metrics = require(path.join(root, "exercise-metrics.js"));
assert.equal(Engine.ENGINE_VERSION, "078.1");
assert.equal(Engine.RIR_CREDIT_CAP, 5);
assert.equal(Engine.FORMULA_VERSION, "rir-adjusted-epley@067.1");

// These cases isolate arithmetic and convention boundaries that are unsafe to
// approximate in a browser journey: RIR-adjusted capacity, fractional bodyweight
// and assistance direction, explicit side normalization, bounded fatigue
// sampling, discrete equipment grids, and unusable partial/missing-RIR anchors.

const METRIC = Object.freeze({
  weight: "2555c6f170d8805cafa6d16d3fdddbaa",
  assistance: "2555c6f170d880e6b760f2286b2b2d76",
  reps: "2555c6f170d88072bbf6d9ad3f16ea86",
  duration: "2555c6f170d88063941ef7c8956d760c",
  distanceShort: "25a5c6f170d88022b3b4ef4ae5fe7571",
  distanceLong: "25a5c6f170d880aa9232e07fc8128d85",
  weightPerSide: "25a5c6f170d880e2990fc88146f7de56",
  repsPerSide: "25a5c6f170d880baaa2dc8c7b67d4b65",
  durationPerSide: "25a5c6f170d880229a4ed6ee87958e18",
  persistentWeightPerSide: "25a5c6f170d8803aa6fdc6f2535f9c5c",
  distanceShortPerSide: "25a5c6f170d88092bcead56f9fe8247e",
});

const metricDefinitions = Object.freeze({
  [METRIC.weight]: { id: METRIC.weight, sourceName: "Weight", semantic: "loadKg", unit: "kg" },
  [METRIC.assistance]: { id: METRIC.assistance, sourceName: "Assistance weight", semantic: "assistanceKg", unit: "kg" },
  [METRIC.reps]: { id: METRIC.reps, sourceName: "Reps", semantic: "reps", unit: "reps" },
  [METRIC.duration]: { id: METRIC.duration, sourceName: "Duration", semantic: "durationSeconds", unit: "seconds" },
  [METRIC.distanceShort]: { id: METRIC.distanceShort, sourceName: "Distance short", semantic: "distanceShortMeters", unit: "metres" },
  [METRIC.distanceLong]: { id: METRIC.distanceLong, sourceName: "Distance long", semantic: "distanceLongMeters", unit: "metres" },
  [METRIC.weightPerSide]: { id: METRIC.weightPerSide, sourceName: "Weight per side", semantic: "loadPerSideKg", unit: "kg" },
  [METRIC.repsPerSide]: { id: METRIC.repsPerSide, sourceName: "Reps per side", semantic: "repsPerSide", unit: "reps" },
  [METRIC.durationPerSide]: { id: METRIC.durationPerSide, sourceName: "Duration per side", semantic: "durationPerSideSeconds", unit: "seconds" },
  [METRIC.persistentWeightPerSide]: { id: METRIC.persistentWeightPerSide, sourceName: "Weight per side persistent", semantic: "persistentLoadPerSideKg", unit: "kg" },
  [METRIC.distanceShortPerSide]: { id: METRIC.distanceShortPerSide, sourceName: "Distance short per side", semantic: "distanceShortPerSideMeters", unit: "metres" },
});

function prescription(overrides = {}) {
  return {
    id: "slot-a:c1:s1",
    slotId: "slot-a",
    cycleIndex: 1,
    setIndex: 1,
    exerciseId: "exercise-a",
    role: "hypertrophyPrimaryCompound",
    metricType: "source_metrics@1",
    metricIds: [METRIC.weight, METRIC.reps],
    metricDefinitions: [metricDefinitions[METRIC.weight], metricDefinitions[METRIC.reps]],
    targets: { reps: { min: 7, max: 9 } },
    rir: 1,
    restSeconds: 120,
    status: "ready",
    loadingModel: { bodyweightCoefficient: 0 },
    ...overrides,
  };
}

function performedSet({
  exerciseId = "exercise-a", loadKg, assistanceKg, loadPerSideKg, persistentLoadPerSideKg,
  distanceShortMeters, reps = 6, repsPerSide, rir = 2, metricIds = [METRIC.weight, METRIC.reps],
  equipmentId = "rack-a", loadingConvention = "external", loadingContext, bodyweightCoefficient = 0,
  completed = true, setIndex = 0,
} = {}) {
  const capturedContext = loadingContext === null ? null : {
    loadingConvention,
    bodyweightKg: null,
    bodyweightContributionEnabled: false,
    externalLoadMultiplier: loadingConvention === "bodyweight" ? 0
      : loadingConvention === "per_side" ? null : 1,
    bodyweightCoefficient,
    ...(loadingContext || {}),
  };
  const valueFor = new Map([
    [METRIC.weight, loadKg], [METRIC.assistance, assistanceKg], [METRIC.reps, reps],
    [METRIC.weightPerSide, loadPerSideKg], [METRIC.persistentWeightPerSide, persistentLoadPerSideKg],
    [METRIC.repsPerSide, repsPerSide], [METRIC.distanceShort, distanceShortMeters],
  ]);
  return {
    exerciseId, completed, setIndex, rir, equipmentId, loadingConvention,
    ...(capturedContext ? { loadingContext: structuredClone(capturedContext) } : {}),
    metricIds: [...metricIds],
    metricValues: metricIds.map((metricId) => ({
      metricId,
      value: valueFor.get(metricId),
      unit: metricDefinitions[metricId]?.unit,
    })),
  };
}

function context(overrides = {}) {
  return {
    bySlotId: {
      "slot-a": {
        equipmentId: "rack-a",
        availableLoadsKg: [100, 102.5, 105, 107.5, 110],
        loadingConvention: "external",
        bodyweightContributionEnabled: true,
        bodyweightKg: 0,
        externalLoadMultiplier: 1,
      },
    },
    ...overrides,
  };
}

function recommend(p, history = [], currentSession = [], loadingContext = context(), settings = {}) {
  const result = Engine.recommendSets([p], history, currentSession, loadingContext, settings);
  assert.equal(result.length, 1);
  return result[0];
}

assert.equal(Metrics.validateDefinitions(
  [METRIC.reps, METRIC.assistance],
  [metricDefinitions[METRIC.reps], metricDefinitions[METRIC.assistance]],
).ok, true, "assistance metric fixture keeps the raw Reps → Assistance source order");
assert.equal(Metrics.validateDefinitions(
  [METRIC.repsPerSide, METRIC.weightPerSide],
  [metricDefinitions[METRIC.repsPerSide], metricDefinitions[METRIC.weightPerSide]],
).ok, true, "per-side metric fixture keeps the raw Reps per side → Weight per side source order");

const coldStart = recommend(prescription(), []);
assert.equal(coldStart.status, "manual", "a cold start must not invent a starting load");
assert.equal(coldStart.targets.loadKg, undefined);
assert.ok(coldStart.reasonCodes.includes("no_comparable_history"));

const weighted = recommend(prescription(), [{
  sessionId: "anchor-110",
  completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}]);
assert.equal(weighted.status, "recommended");
assert.equal(weighted.formulaVersion, "rir-adjusted-epley@067.1");
assert.equal(weighted.targets.loadKg, 105);
assert.equal(weighted.targets.reps, 8);
assert.equal(weighted.targets.rir, 1);
assert.ok(Math.abs(weighted.historyAnchor.effectiveLoadKg - 110) < 1e-9);
assert.ok(Math.abs(weighted.historyAnchor.capacityKg - 110 * (1 + (6 + 2) / 30)) < 1e-9);
assert.deepEqual(weighted.loadingAssumptions.availableLoadsKg, [100, 102.5, 105, 107.5, 110]);

// RIR credit cap (owner, 2026-11-05; Plan 077 OD-23b): a performed set earns
// capacity for at most five reps in reserve, in history and in the live session.
const cappedHistory = (rir) => recommend(prescription(), [{
  sessionId: `cap-${rir}`, completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir, setIndex: 0 })],
}]);
const atCap = cappedHistory(5), overCap = cappedHistory(9);
assert.ok(Math.abs(overCap.historyAnchor.capacityKg - 100 * (1 + (6 + 5) / 30)) < 1e-9,
  "a logged RIR above five earns only five reps of capacity");
assert.deepEqual(overCap.targets, atCap.targets, "RIR 9 and RIR 5 give the same suggestion");
assert.ok(Math.abs(cappedHistory(4).historyAnchor.capacityKg - 100 * (1 + (6 + 4) / 30)) < 1e-9,
  "a logged RIR at or below the cap keeps its full credit");
const liveOverCap = recommend(prescription({ setIndex: 2 }), [], [
  performedSet({ loadKg: 100, reps: 6, rir: 9, setIndex: 0 })]);
assert.ok(Math.abs(liveOverCap.historyAnchor.capacityKg - 100 * (1 + (6 + 5) / 30)) < 1e-9,
  "the live-session anchor applies the same cap");

// Effort calibration (Plan 077 PR 5, OD-18/19): the caller's shift reads reported RIR as rir − delta, within one
// available-load step up and two down from the unshifted suggestion; a max set's measured 0 never shifts and never
// counts as fatigue.
assert.equal(Engine.CALIBRATION_VERSION, "calibration@077.1");
const calibrated = (delta) => ({ calibration: { version: "calibration@077.1", delta } });
const loadsContext = (loads) => context({ bySlotId: { "slot-a": { equipmentId: "rack-a", availableLoadsKg: loads,
  loadingConvention: "external", bodyweightContributionEnabled: true, bodyweightKg: 0, externalLoadMultiplier: 1 } } });
const calPrescription = prescription({ targets: { reps: { min: 8, max: 12 } }, rir: 2 });
const anchorAt = (loadKg, rir) => [{ sessionId: `cal-${loadKg}-${rir}`, completed: true, sets: [performedSet({ loadKg, reps: 10, rir, setIndex: 0 })] }];
{
  // W2: an under-estimator (delta −1) on a 2.5 kg chest press: 60 × 10 at RIR 2 reads at RIR 3, capacity 84 → 86.
  const chest = loadsContext([50, 52.5, 55, 57.5, 60, 62.5, 65, 67.5, 70]);
  const base = recommend(calPrescription, anchorAt(60, 2), [], chest);
  const w2 = recommend(calPrescription, anchorAt(60, 2), [], chest, calibrated(-1));
  assert.ok(Math.abs(base.historyAnchor.capacityKg - 84) < 1e-9 && Math.abs(w2.historyAnchor.capacityKg - 86) < 1e-9,
    "W2: the shift raises the anchor's capacity from 84 to 86");
  assert.deepEqual(w2.targets, base.targets, "W2: within the range's midpoint the target holds at 60 × 10");
  assert.equal(w2.calibration.moved, false, "W2: an unmoved target is reported as not moved, so no 'tends to' line shows");
  // W3: an over-estimator (delta 4/3) on a 5 kg stack: 70 × 10 at RIR 3 reads at 1.67, capacity 100.3 → 97.2.
  const stack = loadsContext([50, 55, 60, 65, 70, 75, 80]);
  const base3 = recommend(calPrescription, anchorAt(70, 3), [], stack);
  const w3 = recommend(calPrescription, anchorAt(70, 3), [], stack, calibrated(4 / 3));
  assert.ok(Math.abs(w3.historyAnchor.capacityKg - 70 * (1 + (10 + 5 / 3) / 30)) < 1e-9, "W3: the anchor reads at RIR 1.67");
  assert.deepEqual([base3.targets.loadKg, base3.targets.reps, w3.targets.loadKg, w3.targets.reps], [70, 10, 70, 9],
    "W3: 70 × 10 becomes 70 × 9");
  assert.deepEqual(w3.calibration, { version: "calibration@077.1", delta: 4 / 3, moved: true, baseline: { displayLoadKg: 70, reps: 10 } },
    "W3: the recommendation says it moved and from what");
  // Only a known version and a delta in [−1, 2] apply; anything else is the unshifted engine.
  for (const settings of [{ calibration: { version: "calibration@076.9", delta: 1 } }, calibrated(2.5), calibrated(-1.5), calibrated(Number.NaN), { calibration: "x" }]) {
    assert.deepEqual(recommend(calPrescription, anchorAt(70, 3), [], stack, settings).targets, base3.targets, `ignored: ${JSON.stringify(settings)}`);
  }
  // Delta 0 is byte-identical to no calibration at all.
  assert.deepEqual(recommend(calPrescription, anchorAt(70, 3), [], stack, calibrated(0)), base3, "delta 0 leaves the recommendation unchanged");
  // The load bound: on 0.5 kg steps, a delta of 2 unbounded would take 71.5 kg down to 68 kg; bounded, the load stays
  // within two steps (70.5 kg) and the reps come down instead.
  const fine = loadsContext(Array.from({ length: 81 }, (_, i) => 50 + i * 0.5));
  const fineBase = recommend(calPrescription, anchorAt(70, 3), [], fine);
  const unbounded = recommend(calPrescription, anchorAt(70, 1), [], fine);
  const bounded = recommend(calPrescription, anchorAt(70, 3), [], fine, calibrated(2));
  assert.equal(fineBase.targets.loadKg, 71.5);
  assert.ok(unbounded.targets.loadKg < 70.5, `the unbounded reading would go below the floor: ${unbounded.targets.loadKg}`);
  assert.ok(bounded.targets.loadKg >= 70.5 && bounded.targets.loadKg <= 72, `the shifted load stays within the bound: ${JSON.stringify(bounded.targets)}`);
  // A max set's RIR 0 is measured: no shift reaches it, and the drop into it is not fatigue.
  const withMax = (source) => [{ sessionId: "max", completed: true, sets: [
    performedSet({ loadKg: 70, reps: 10, rir: 2, setIndex: 0 }),
    { ...performedSet({ loadKg: 70, reps: 9, rir: 0, setIndex: 1 }), ...(source ? { effortSource: source } : {}) }] }];
  const second = prescription({ targets: { reps: { min: 8, max: 12 } }, rir: 2, setIndex: 2 });
  const asReported = recommend(second, withMax(null), [], stack);
  const asMeasured = recommend(second, withMax("failure"), [], stack);
  assert.ok(asReported.fatigue.adjacentDrops[0].drop > 0, "a reported second set at 9 × 0 reads as a fatigue drop");
  assert.equal(asMeasured.fatigue.adjacentDrops.length ? asMeasured.fatigue.adjacentDrops[0].drop : 0, 0, "a max set is left out of the fatigue estimate");
  const liveMax = recommend(prescription({ targets: { reps: { min: 8, max: 12 } }, rir: 2, setIndex: 3 }), [], [
    { ...performedSet({ loadKg: 70, reps: 12, rir: 0, setIndex: 1 }), effortSource: "failure" }], stack, calibrated(2));
  assert.ok(Math.abs(liveMax.historyAnchor.capacityKg - 70 * (1 + 12 / 30)) < 1e-9, "a max set's 0 is never shifted");
}

const nonCanonicalExternalMultiplier = recommend(prescription(), [{
  sessionId: "external-multiplier-two",
  completed: true,
  sets: [performedSet({ loadKg: 55, reps: 6, rir: 2, setIndex: 0,
    loadingContext: { loadingConvention: "external", externalLoadMultiplier: 2,
      bodyweightContributionEnabled: false, bodyweightCoefficient: 0 } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [50, 55, 60, 65], loadingConvention: "external",
  bodyweightContributionEnabled: false, externalLoadMultiplier: 2,
} } }));
assert.equal(nonCanonicalExternalMultiplier.status, "configuration_required",
  "external-load progression must refuse the noncanonical multiplier even when history captured the same value");
assert.ok(nonCanonicalExternalMultiplier.reasonCodes.includes("configuration_required"));

const missingExternalMultiplier = recommend(prescription(), [{
  sessionId: "external-multiplier-missing",
  completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [100, 102.5, 105, 107.5, 110],
  loadingConvention: "external", bodyweightContributionEnabled: false,
} } }));
assert.equal(missingExternalMultiplier.status, "configuration_required",
  "missing external multiplier must not silently become the canonical value");

const noncanonicalCapturedExternalMultiplier = recommend(prescription(), [{
  sessionId: "captured-external-multiplier-two",
  completed: true,
  sets: [performedSet({ loadKg: 55, reps: 6, rir: 2, setIndex: 0,
    loadingContext: { loadingConvention: "external", externalLoadMultiplier: 2,
      bodyweightContributionEnabled: false, bodyweightCoefficient: 0 } })],
}]);
assert.notEqual(noncanonicalCapturedExternalMultiplier.status, "recommended",
  "history captured with a noncanonical external multiplier is not a comparable anchor");
assert.ok(noncanonicalCapturedExternalMultiplier.reasonCodes.includes("loading_convention_mismatch"));

for (const [description, loadingContext] of [
  ["multiplier", "externalLoadMultiplier"],
  ["loading convention", "loadingConvention"],
]) {
  const missingContextSet = performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 });
  delete missingContextSet.loadingContext[loadingContext];
  const incompleteCapturedContext = recommend(prescription(), [{
    sessionId: `incomplete-captured-${description}`,
    completed: true,
    sets: [missingContextSet],
  }]);
  assert.notEqual(incompleteCapturedContext.status, "recommended",
    `a captured external row missing its ${description} cannot anchor progression`);
  assert.ok(incompleteCapturedContext.reasonCodes.includes("loading_convention_mismatch"));
}

const weightMatched = recommend(prescription(), [{
  sessionId: "anchor-110",
  completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}], [], context(), { weightMatch: true });
assert.equal(weightMatched.status, "recommended");
assert.equal(weightMatched.targets.loadKg, 110, "Weight Match may prefer the anchor load only when a candidate meets the target-RIR window");
assert.equal(weightMatched.targets.reps, 7, "Weight Match cannot promote the anchor load with an inadmissible rep/RIR pair");

const expansionContext = context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [100], loadingConvention: "external",
  bodyweightContributionEnabled: false, externalLoadMultiplier: 1,
} } });
const expansionPrescription = prescription({ targets: { reps: { min: 10, max: 12 } } });
const expansionHistory = [{
  sessionId: "expansion-anchor", completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir: 3, setIndex: 0 })],
}];
const expansionDisabled = recommend(expansionPrescription, expansionHistory, [], expansionContext, { expandRepRange: false });
assert.notEqual(expansionDisabled.status, "recommended", "a range does not expand when the setting is off");
const expansionEnabled = recommend(expansionPrescription, expansionHistory, [], expansionContext, { expandRepRange: true });
assert.equal(expansionEnabled.status, "recommended", "range expansion can find a load/repetition pair after exhausting the authored range");
assert.equal(expansionEnabled.targets.reps, 8, "the expanded search retains the original midpoint ranking and predicted-RIR constraint");

const expansionLimit = recommend(prescription({ targets: { reps: { min: 20, max: 22 } } }), [{
  sessionId: "expansion-limit-anchor", completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir: 10, setIndex: 0 })],
}], [], expansionContext, { expandRepRange: true });
assert.notEqual(expansionLimit.status, "recommended", "range expansion stops after four reps at each boundary");

const bodyweightPrescription = prescription({
  metricIds: [METRIC.weight, METRIC.reps],
  metricDefinitions: [metricDefinitions[METRIC.weight], metricDefinitions[METRIC.reps]],
  loadingModel: { bodyweightCoefficient: 0.5 },
});
const bodyweight = recommend(bodyweightPrescription, [{
  sessionId: "weighted-bodyweight",
  completed: true,
  sets: [performedSet({
    loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.5,
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true, externalLoadMultiplier: 1 },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 80, externalLoadMultiplier: 1,
} } }));
assert.equal(bodyweight.status, "recommended");
assert.equal(bodyweight.historyAnchor.effectiveLoadKg, 120, "fractional bodyweight load contributes once to the anchor");
assert.equal(bodyweight.loadingAssumptions.bodyweightContributionKg, 40);
assert.equal(bodyweight.targets.loadKg + bodyweight.loadingAssumptions.bodyweightContributionKg,
  bodyweight.targetEffectiveLoadKg, "candidate and anchor use the same bodyweight transform");

const changedBodyweight = recommend(bodyweightPrescription, [{
  sessionId: "older-bodyweight",
  completed: true,
  sets: [performedSet({
    loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.5,
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true, externalLoadMultiplier: 1 },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 90, externalLoadMultiplier: 1,
} } }));
assert.equal(changedBodyweight.status, "recommended", "a changed bodyweight is comparable under the same recorded convention");
assert.equal(changedBodyweight.historyAnchor.effectiveLoadKg, 120, "history uses the body's recorded 80 kg, not current 90 kg");
assert.equal(changedBodyweight.loadingAssumptions.bodyweightContributionKg, 45, "candidates use the current bodyweight");
assert.equal(changedBodyweight.targets.loadKg + 45, changedBodyweight.targetEffectiveLoadKg);

const missingHistoricalBodyweight = recommend(bodyweightPrescription, [{
  sessionId: "missing-historic-bodyweight",
  completed: true,
  sets: [performedSet({ loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.5, loadingContext: null })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 90, externalLoadMultiplier: 1,
} } }));
assert.notEqual(missingHistoricalBodyweight.status, "recommended", "current weight cannot fill missing historical bodyweight");
assert.ok(missingHistoricalBodyweight.reasonCodes.includes("historical_bodyweight_required"));

// Owner report C1 (2026-11-03) and decision (2026-11-04): a bodyweight on file (setup or last logged) turns the slot's
// contribution on, while a set logged with no session bodyweight recorded none (bodyweightKg null, contribution off).
// That set is "contribution unknown", not a different loading setup: the current configuration stands for it. Since
// 2026-11-05 this matters only where bodyweight is material (a coefficient of 0.30 or more), so it is proven on a squat.
{
  const squat = (setIndex) => prescription({ setIndex, targets: { reps: { min: 8, max: 12 } }, rir: 1,
    loadingModel: { bodyweightCoefficient: 0.626 } });
  const squatContext = context({ bySlotId: { "slot-a": {
    equipmentId: "rack-a", availableLoadsKg: [45, 47.5, 50, 52.5, 55, 57.5, 60, 62.5, 65],
    loadingConvention: "external", bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 1,
  } } });
  const unknownSet = (setIndex = 0, extra = {}) => performedSet({ loadKg: 55, reps: 8, rir: 0, setIndex, bodyweightCoefficient: 0.626,
    loadingContext: { bodyweightKg: null, bodyweightContributionEnabled: false, externalLoadMultiplier: 1, ...extra } });
  const live = recommend(squat(2), [], [unknownSet()], squatContext);
  assert.equal(live.status, "recommended", "a set logged with no session bodyweight anchors the next one");
  assert.ok(!live.reasonCodes.includes("loading_convention_mismatch"), "an unrecorded bodyweight is never a different loading setup");
  assert.equal(live.historyAnchor.effectiveLoadKg, 55 + 0.626 * 80, "the unknown set is valued with the resolved bodyweight");
  const old = recommend(squat(1), [{ sessionId: "saved-the-old-way", completed: true, sets: [unknownSet()] }], [], squatContext);
  assert.equal(old.status, "recommended", "a previous session saved without a bodyweight still anchors the next session");
  const nullFlag = recommend(squat(1), [{ sessionId: "null-flag", completed: true,
    sets: [unknownSet(0, { bodyweightContributionEnabled: null })] }], [], squatContext);
  assert.equal(nullFlag.status, "recommended", "an unset contribution flag with no bodyweight is unknown too");
  const recorded = recommend(squat(1), [{ sessionId: "recorded-70", completed: true,
    sets: [unknownSet(0, { bodyweightKg: 70, bodyweightContributionEnabled: true })] }], [], squatContext);
  assert.equal(recorded.status, "recommended", "a recorded bodyweight keeps today's comparison");
  assert.equal(recorded.historyAnchor.effectiveLoadKg, 55 + 0.626 * 70, "a recorded bodyweight is used as recorded, not replaced");
  const recordedOff = recommend(squat(1), [{ sessionId: "recorded-off", completed: true,
    sets: [unknownSet(0, { bodyweightKg: 70, bodyweightContributionEnabled: false })] }], [], squatContext);
  assert.notEqual(recordedOff.status, "recommended", "a set that recorded a bodyweight with contribution off is still a different setup");
  assert.ok(recordedOff.reasonCodes.includes("loading_convention_mismatch"));
  const pullup = prescription({ metricIds: [METRIC.reps], metricDefinitions: [metricDefinitions[METRIC.reps]],
    targets: { reps: { min: 7, max: 9 } }, loadingModel: { bodyweightCoefficient: 1 } });
  const pullups = recommend(pullup, [{ sessionId: "pullups-no-session-weight", completed: true, sets: [performedSet({
    reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps], bodyweightCoefficient: 1, equipmentId: null, loadingConvention: "bodyweight",
    loadingContext: { bodyweightKg: null, bodyweightContributionEnabled: false, externalLoadMultiplier: 0, loadingConvention: "bodyweight" },
  })] }], [], context({ bySlotId: { "slot-a": { equipmentId: null, availableLoadsKg: [], loadingConvention: "bodyweight",
    bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 0 } } }));
  assert.equal(pullups.status, "recommended", "pull-ups logged with no session bodyweight progress on the setup weight");
  assert.ok(!pullups.reasonCodes.some((code) => /bodyweight_required/.test(code)), "and never ask for a bodyweight");
}

// Owner rule (2026-11-05): bodyweight counts only where it is a material share of the load, a coefficient of 0.30 or
// more. A loaded lift below it (wrist curls 0.006, EZ-bar triceps extension 0.046, Smith or machine press 0.076) counts
// no bodyweight: no contribution, no bodyweight dependency, no mismatch, whatever its rows recorded.
{
  assert.equal(Engine.BODYWEIGHT_MATERIAL_THRESHOLD, 0.3, "one named threshold");
  assert.deepEqual([0.006, 0.046, 0.076, 0.29, 0.3, 0.626, 0.99].map((c) => Engine.effectiveBodyweightCoefficient(c)),
    [0, 0, 0, 0, 0.3, 0.626, 0.99], "below 0.30 a loaded lift's coefficient reads as 0; from 0.30 it is kept");
  assert.equal(Engine.effectiveBodyweightCoefficient(0.1, "bodyweight"), 0.1, "a reps-only bodyweight movement keeps its whole load");
  const withBodyweight = context({ bySlotId: { "slot-a": {
    equipmentId: "rack-a", availableLoadsKg: [40, 42.5, 45, 47.5, 50, 52.5, 55, 57.5, 60, 62.5],
    loadingConvention: "external", bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 1,
  } } });
  const setAt = (coefficient, loadingContext) => performedSet({ loadKg: 55, reps: 8, rir: 1, setIndex: 0, bodyweightCoefficient: coefficient,
    loadingContext: { externalLoadMultiplier: 1, ...loadingContext } });
  for (const [name, coefficient] of [["the EZ-bar overhead triceps extension", 0.046], ["an incline machine press", 0.076]]) {
    const lift = prescription({ setIndex: 1, targets: { reps: { min: 8, max: 12 } }, rir: 1, loadingModel: { bodyweightCoefficient: coefficient } });
    const fresh = recommend(lift, [{ sessionId: "s", completed: true, sets: [setAt(coefficient, { bodyweightKg: null, bodyweightContributionEnabled: false })] }], [], withBodyweight);
    assert.equal(fresh.status, "recommended", `${name} is recommended`);
    assert.equal(fresh.loadingAssumptions.bodyweightContributionKg, 0, `${name} counts no bodyweight, with 80 kg on file`);
    assert.equal(fresh.historyAnchor.effectiveLoadKg, 55, `${name}'s anchor is the external load alone`);
    const recordedWithBodyweight = recommend(lift, [{ sessionId: "recorded-80", completed: true,
      sets: [setAt(coefficient, { bodyweightKg: 80, bodyweightContributionEnabled: true })] }], [], withBodyweight);
    assert.equal(recordedWithBodyweight.status, "recommended", `${name}: a row recorded with a bodyweight anchors normally`);
    assert.equal(recordedWithBodyweight.historyAnchor.effectiveLoadKg, 55, `${name}: its recorded bodyweight is irrelevant`);
    const recordedOff = recommend(lift, [{ sessionId: "recorded-off", completed: true,
      sets: [setAt(coefficient, { bodyweightKg: 80, bodyweightContributionEnabled: false })] }], [], withBodyweight);
    assert.equal(recordedOff.status, "recommended", `${name}: no contribution setting can make it a different setup`);
    const noWeight = recommend(lift, [{ sessionId: "s", completed: true, sets: [setAt(coefficient, {})] }], [],
      context({ bySlotId: { "slot-a": { equipmentId: "rack-a", availableLoadsKg: [50, 52.5, 55, 57.5], loadingConvention: "external",
        bodyweightContributionEnabled: true, bodyweightKg: null, externalLoadMultiplier: 1 } } }));
    assert.ok(!noWeight.reasonCodes.includes("bodyweight_required"), `${name} never asks for a bodyweight`);
  }
  const squat = prescription({ setIndex: 1, targets: { reps: { min: 8, max: 12 } }, rir: 1, loadingModel: { bodyweightCoefficient: 0.626 } });
  const squatResult = recommend(squat, [{ sessionId: "s", completed: true, sets: [setAt(0.626, { bodyweightKg: 80, bodyweightContributionEnabled: true })] }], [], withBodyweight);
  assert.equal(squatResult.loadingAssumptions.bodyweightContributionKg, 0.626 * 80, "a squat keeps its bodyweight share");
  const squatNoWeight = recommend(squat, [{ sessionId: "s", completed: true, sets: [setAt(0.626, { bodyweightKg: 80, bodyweightContributionEnabled: true })] }], [],
    context({ bySlotId: { "slot-a": { equipmentId: "rack-a", availableLoadsKg: [50, 55], loadingConvention: "external",
      bodyweightContributionEnabled: true, bodyweightKg: null, externalLoadMultiplier: 1 } } }));
  assert.ok(squatNoWeight.reasonCodes.includes("bodyweight_required"), "a squat still needs a bodyweight to count it");
}

const bodyweightOnlyPrescription = prescription({
  metricType: "source_metrics@1",
  metricIds: [METRIC.reps],
  metricDefinitions: [metricDefinitions[METRIC.reps]],
  targets: { reps: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 1 },
});
const bodyweightOnly = recommend(bodyweightOnlyPrescription, [{
  sessionId: "bodyweight-only",
  completed: true,
  sets: [performedSet({
    reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps],
    bodyweightCoefficient: 1,
    equipmentId: null, loadingConvention: "bodyweight",
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true,
      externalLoadMultiplier: 0, loadingConvention: "bodyweight" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: null, availableLoadsKg: [], loadingConvention: "bodyweight",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 0,
} } }));
assert.equal(bodyweightOnly.status, "recommended", "reps-only bodyweight movements use recorded bodyweight and fixed external zero");
assert.equal(bodyweightOnly.historyAnchor.effectiveLoadKg, 80);
assert.equal(bodyweightOnly.targets.loadKg, undefined, "bodyweight-only progression does not fabricate an external load");

const nonzeroBodyweightMultiplier = recommend(bodyweightOnlyPrescription, [{
  sessionId: "bodyweight-nonzero-multiplier",
  completed: true,
  sets: [performedSet({
    reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps],
    bodyweightCoefficient: 1,
    equipmentId: null, loadingConvention: "bodyweight",
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true,
      externalLoadMultiplier: 1, loadingConvention: "bodyweight" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: null, availableLoadsKg: [], loadingConvention: "bodyweight",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 1,
} } }));
assert.equal(nonzeroBodyweightMultiplier.status, "configuration_required",
  "bodyweight progression must reject a nonzero captured multiplier instead of discarding it");

const wrongCapturedBodyweightMultiplier = recommend(bodyweightOnlyPrescription, [{
  sessionId: "captured-bodyweight-nonzero-multiplier",
  completed: true,
  sets: [performedSet({
    reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps],
    bodyweightCoefficient: 1,
    equipmentId: null, loadingConvention: "bodyweight",
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true,
      externalLoadMultiplier: 1, loadingConvention: "bodyweight" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: null, availableLoadsKg: [], loadingConvention: "bodyweight",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 0,
} } }));
assert.notEqual(wrongCapturedBodyweightMultiplier.status, "recommended",
  "captured bodyweight actuals must carry the canonical zero multiplier");
assert.ok(wrongCapturedBodyweightMultiplier.reasonCodes.includes("loading_convention_mismatch"));

const assistancePrescription = prescription({
  metricType: "source_metrics@1",
  metricIds: [METRIC.reps, METRIC.assistance],
  metricDefinitions: [metricDefinitions[METRIC.reps], metricDefinitions[METRIC.assistance]],
  loadingModel: { bodyweightCoefficient: 1 },
});
const assistance = recommend(assistancePrescription, [{
  sessionId: "assisted-pull-up",
  completed: true,
  sets: [performedSet({
    assistanceKg: 20, reps: 8, rir: 2, setIndex: 0,
    bodyweightCoefficient: 1,
    metricIds: [METRIC.reps, METRIC.assistance],
    loadingConvention: "assistance",
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true, externalLoadMultiplier: 1, loadingConvention: "assistance" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [10, 15, 20, 25, 30],
  loadingConvention: "assistance", bodyweightContributionEnabled: true,
  bodyweightKg: 80, externalLoadMultiplier: 1,
} } }));
assert.equal(assistance.status, "recommended");
assert.equal(assistance.historyAnchor.effectiveLoadKg, 60, "assistance subtracts from the fractional bodyweight contribution");
assert.equal(assistance.loadingAssumptions.assistanceDirection, "subtract");
assert.ok(assistance.targets.assistanceKg >= 0);

const noncanonicalAssistanceMultiplier = recommend(assistancePrescription, [{
  sessionId: "assistance-multiplier-two",
  completed: true,
  sets: [performedSet({
    assistanceKg: 10, reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps, METRIC.assistance],
    bodyweightCoefficient: 1,
    loadingConvention: "assistance",
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true,
      externalLoadMultiplier: 2, loadingConvention: "assistance", bodyweightCoefficient: 1 },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [10, 15, 20, 25, 30],
  loadingConvention: "assistance", bodyweightContributionEnabled: true,
  bodyweightKg: 80, externalLoadMultiplier: 2,
} } }));
assert.equal(noncanonicalAssistanceMultiplier.status, "configuration_required",
  "assistance progression must enforce multiplier one even when captured history agrees");
for (const [label, multiplier] of [["null", null], ["missing", undefined]]) {
  const loadingContext = {
    equipmentId: "rack-a", availableLoadsKg: [10, 15, 20, 25, 30],
    loadingConvention: "assistance", bodyweightContributionEnabled: true,
    bodyweightKg: 80,
  };
  if (multiplier !== undefined) loadingContext.externalLoadMultiplier = multiplier;
  const missingAssistanceMultiplier = recommend(assistancePrescription, [{
    sessionId: `assistance-multiplier-${label}`,
    completed: true,
    sets: [performedSet({
      assistanceKg: 20, reps: 8, rir: 2, setIndex: 0, metricIds: [METRIC.reps, METRIC.assistance],
      loadingConvention: "assistance", bodyweightCoefficient: 1,
    })],
  }], [], context({ bySlotId: { "slot-a": loadingContext } }));
  assert.equal(missingAssistanceMultiplier.status, "configuration_required",
    `live assistance configuration refuses a ${label} external-load multiplier`);
}

const perSidePrescription = prescription({
  metricType: "source_metrics@1",
  metricIds: [METRIC.repsPerSide, METRIC.weightPerSide],
  metricDefinitions: [metricDefinitions[METRIC.repsPerSide], metricDefinitions[METRIC.weightPerSide]],
  targets: { repsPerSide: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 0 },
});
const perSide = recommend(perSidePrescription, [{
  sessionId: "per-side-anchor",
  completed: true,
  sets: [performedSet({
    loadPerSideKg: 20, repsPerSide: 6, rir: 2, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide],
    loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false,
  externalLoadMultiplier: 2, executionMode: "bilateral",
  bodyweightKg: null,
} } }));
assert.equal(perSide.status, "recommended");
assert.equal(perSide.historyAnchor.effectiveLoadKg, 40, "per-side loads are normalized only with an explicit multiplier");
assert.equal(perSide.loadingAssumptions.externalLoadMultiplier, 2);
assert.equal(perSide.targets.loadPerSideKg * 2, perSide.targetEffectiveLoadKg);

const mismatchedPerSideMultiplier = recommend(perSidePrescription, [{
  sessionId: "per-side-anchor", completed: true,
  sets: [performedSet({ loadPerSideKg: 20, repsPerSide: 6, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide], loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 1,
  executionMode: "unilateral",
} } }));
assert.equal(mismatchedPerSideMultiplier.status, "manual");
assert.ok(mismatchedPerSideMultiplier.reasonCodes.includes("loading_convention_mismatch"),
  "an explicit historical m=2 is refused against a known current unilateral m=1 convention");

const mismatchedEquipment = recommend(perSidePrescription, [{
  sessionId: "per-side-anchor", completed: true,
  sets: [performedSet({ loadPerSideKg: 20, repsPerSide: 6, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide], equipmentId: "rack-a", loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-b", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 2,
  executionMode: "bilateral",
} } }));
assert.notEqual(mismatchedEquipment.status, "recommended", "history from another equipment context is not a comparable anchor");

const persistentPerSidePrescription = prescription({
  metricType: "source_metrics@1",
  metricIds: [METRIC.persistentWeightPerSide, METRIC.repsPerSide],
  metricDefinitions: [metricDefinitions[METRIC.persistentWeightPerSide], metricDefinitions[METRIC.repsPerSide]],
  targets: { repsPerSide: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 0 },
});
const persistentPerSide = recommend(persistentPerSidePrescription, [{
  sessionId: "persistent-side-anchor",
  completed: true,
  sets: [performedSet({
    persistentLoadPerSideKg: 20, repsPerSide: 6, rir: 2, setIndex: 0,
    metricIds: [METRIC.persistentWeightPerSide, METRIC.repsPerSide],
    loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, executionMode: "bilateral",
  externalLoadMultiplier: 2,
} } }));
assert.equal(persistentPerSide.status, "recommended", "persistent per-side metric remains a distinct supported convention");
assert.equal(persistentPerSide.historyAnchor.effectiveLoadKg, 40);
assert.equal(persistentPerSide.targets.persistentLoadPerSideKg * 2, persistentPerSide.targetEffectiveLoadKg);

const missingPerSideConvention = recommend(perSidePrescription, [{
  sessionId: "per-side-anchor",
  completed: true,
  sets: [performedSet({
    loadPerSideKg: 20, repsPerSide: 6, rir: 2, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide],
    loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 20, 25], loadingConvention: "per_side",
  bodyweightContributionEnabled: false, executionMode: "bilateral",
  // Intentionally missing externalLoadMultiplier.
} } }));
assert.equal(missingPerSideConvention.status, "configuration_required");
assert.ok(missingPerSideConvention.reasonCodes.includes("per_side_convention_required"));

// S3's added source compositions are enumerated here because source metric
// order determines the meaning of actual values and the engine's load model.
const totalWeightSideRepIds = [METRIC.weight, METRIC.repsPerSide];
const totalWeightSideRepDefinitions = totalWeightSideRepIds.map((id) => metricDefinitions[id]);
const totalWeightSideRepPrescription = prescription({
  metricIds: totalWeightSideRepIds,
  metricDefinitions: totalWeightSideRepDefinitions,
  targets: { repsPerSide: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 0.5 },
});
assert.equal(Metrics.validateDefinitions(totalWeightSideRepIds, totalWeightSideRepDefinitions).ok, true,
  "Weight + Reps per side preserves the catalog's ordered source composition");

const totalWeightSideRepActual = (bodyweightContributionEnabled) => performedSet({
  loadKg: 20, repsPerSide: 6, rir: 2, metricIds: totalWeightSideRepIds,
  loadingConvention: "external", bodyweightCoefficient: 0.5,
  loadingContext: { loadingConvention: "external", externalLoadMultiplier: 1,
    bodyweightCoefficient: 0.5, bodyweightKg: 40, bodyweightContributionEnabled },
});
const totalWeightSideRepContext = (bodyweightContributionEnabled) => context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [10, 20, 30, 40, 50], loadingConvention: "external",
  bodyweightContributionEnabled, bodyweightKg: 40, externalLoadMultiplier: 1,
  executionMode: "bilateral",
} } });
const totalWeightSideRepWithBodyweight = recommend(totalWeightSideRepPrescription, [{
  sessionId: "total-load-side-reps-with-bodyweight", completed: true,
  sets: [totalWeightSideRepActual(true)],
}], [], totalWeightSideRepContext(true));
assert.equal(totalWeightSideRepWithBodyweight.status, "recommended",
  "total Weight + Reps per side adapts using a known execution mode and total-load multiplier one");
assert.equal(totalWeightSideRepWithBodyweight.historyAnchor.effectiveLoadKg, 40,
  "total load adds the enabled 20 kg bodyweight contribution once, without multiplying the total");
assert.equal(totalWeightSideRepWithBodyweight.historyAnchor.capacityKg, 40 * (1 + (6 + 2) / 30),
  "total-load per-side repetitions keep their recorded per-side count in the RIR capacity");
assert.equal(totalWeightSideRepWithBodyweight.targets.loadKg, 20);
assert.equal(totalWeightSideRepWithBodyweight.targets.repsPerSide, 7);
assert.equal(totalWeightSideRepWithBodyweight.loadingAssumptions.externalLoadMultiplier, 1);
assert.equal(totalWeightSideRepWithBodyweight.loadingAssumptions.bodyweightContributionKg, 20);

const totalWeightSideRepWithoutBodyweight = recommend(totalWeightSideRepPrescription, [{
  sessionId: "total-load-side-reps-without-bodyweight", completed: true,
  sets: [totalWeightSideRepActual(false)],
}], [], totalWeightSideRepContext(false));
assert.equal(totalWeightSideRepWithoutBodyweight.historyAnchor.effectiveLoadKg, 20,
  "disabled bodyweight contribution leaves already-total Weight unchanged");
assert.equal(totalWeightSideRepWithoutBodyweight.historyAnchor.capacityKg, 20 * (1 + (6 + 2) / 30));
assert.equal(totalWeightSideRepWithoutBodyweight.loadingAssumptions.bodyweightContributionKg, 0);

const unknownModeTotalLoadSideReps = recommend(totalWeightSideRepPrescription, [{
  sessionId: "total-load-side-reps-unknown-mode", completed: true,
  sets: [totalWeightSideRepActual(true)],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [10, 20, 30, 40, 50], loadingConvention: "external",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 1,
} } }));
assert.equal(unknownModeTotalLoadSideReps.status, "configuration_required",
  "m=1 for total Weight does not substitute for an unknown per-side execution mode");

const bodyweightSideRepPrescription = prescription({
  metricIds: [METRIC.repsPerSide],
  metricDefinitions: [metricDefinitions[METRIC.repsPerSide]],
  targets: { repsPerSide: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 1 },
});
assert.equal(Metrics.validateDefinitions([METRIC.repsPerSide], [metricDefinitions[METRIC.repsPerSide]]).ok, true,
  "Reps per side preserves the catalog's bodyweight source composition");
const bodyweightSideRep = recommend(bodyweightSideRepPrescription, [{
  sessionId: "bodyweight-side-reps", completed: true,
  sets: [performedSet({ repsPerSide: 6, rir: 2, metricIds: [METRIC.repsPerSide],
    loadingConvention: "bodyweight", bodyweightCoefficient: 1,
    loadingContext: { loadingConvention: "bodyweight", externalLoadMultiplier: 0,
      bodyweightCoefficient: 1, bodyweightContributionEnabled: true, bodyweightKg: 80 } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [], loadingConvention: "bodyweight",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 0,
  executionMode: "unilateral",
} } }));
assert.equal(bodyweightSideRep.status, "recommended", "bodyweight Reps per side is a supported source composition");
assert.equal(bodyweightSideRep.historyAnchor.effectiveLoadKg, 80);
assert.equal(bodyweightSideRep.historyAnchor.capacityKg, 80 * (1 + (6 + 2) / 30));
assert.equal(bodyweightSideRep.targets.repsPerSide, 7);

const unknownModeBodyweightSideRep = recommend(bodyweightSideRepPrescription, [{
  sessionId: "bodyweight-side-reps-unknown-current-mode", completed: true,
  sets: [performedSet({ repsPerSide: 6, rir: 2, metricIds: [METRIC.repsPerSide],
    loadingConvention: "bodyweight", bodyweightCoefficient: 1,
    loadingContext: { loadingConvention: "bodyweight", externalLoadMultiplier: 0,
      bodyweightCoefficient: 1, bodyweightContributionEnabled: true, bodyweightKg: 80 } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [], loadingConvention: "bodyweight",
  bodyweightContributionEnabled: true, bodyweightKg: 80, externalLoadMultiplier: 0,
} } }));
assert.equal(unknownModeBodyweightSideRep.status, "configuration_required",
  "m=0 for bodyweight-only Reps per side does not substitute for an unknown execution mode");

const totalRepSideLoadIds = [METRIC.reps, METRIC.weightPerSide];
const totalRepSideLoadDefinitions = totalRepSideLoadIds.map((id) => metricDefinitions[id]);
const totalRepSideLoadPrescription = prescription({
  metricIds: totalRepSideLoadIds,
  metricDefinitions: totalRepSideLoadDefinitions,
  targets: { reps: { min: 7, max: 9 } },
  loadingModel: { bodyweightCoefficient: 0.5 },
});
assert.equal(Metrics.validateDefinitions(totalRepSideLoadIds, totalRepSideLoadDefinitions).ok, true,
  "Reps + Weight per side preserves the catalog's ordered source composition");
const totalRepSideLoadActual = ({ multiplier, bodyweightContributionEnabled }) => performedSet({
  loadPerSideKg: 20, reps: 6, rir: 2, metricIds: totalRepSideLoadIds,
  loadingConvention: "per_side", bodyweightCoefficient: 0.5,
  loadingContext: { loadingConvention: "per_side", externalLoadMultiplier: multiplier,
    bodyweightCoefficient: 0.5, bodyweightKg: 40, bodyweightContributionEnabled },
});
const totalRepSideLoadResult = ({ multiplier, executionMode, bodyweightContributionEnabled }) => recommend(
  totalRepSideLoadPrescription,
  [{ sessionId: `total-reps-m${multiplier}-${bodyweightContributionEnabled}`, completed: true,
    sets: [totalRepSideLoadActual({ multiplier, bodyweightContributionEnabled })] }],
  [],
  context({ bySlotId: { "slot-a": {
    equipmentId: "rack-a", availableLoadsKg: [10, 15, 20, 25], loadingConvention: "per_side",
    bodyweightContributionEnabled, bodyweightKg: 40, externalLoadMultiplier: multiplier, executionMode,
  } } }),
);
const bilateralPerSideTotalReps = totalRepSideLoadResult({
  multiplier: 2, executionMode: "bilateral", bodyweightContributionEnabled: true,
});
assert.equal(bilateralPerSideTotalReps.status, "recommended", "Reps + Weight per side adapts as a per-side load");
assert.equal(bilateralPerSideTotalReps.historyAnchor.effectiveLoadKg, 60,
  "bilateral m=2 multiplies the per-side load before adding bodyweight");
assert.equal(bilateralPerSideTotalReps.historyAnchor.capacityKg, 60 * (1 + (6 + 2) / 30));
assert.equal(bilateralPerSideTotalReps.targets.loadPerSideKg, 20,
  "the recommendation remains a per-side value instead of returning total load");
assert.equal(bilateralPerSideTotalReps.targets.reps, 7);

const unilateralPerSideTotalReps = totalRepSideLoadResult({
  multiplier: 1, executionMode: "unilateral", bodyweightContributionEnabled: true,
});
assert.equal(unilateralPerSideTotalReps.historyAnchor.effectiveLoadKg, 40,
  "unilateral m=1 uses one per-side load plus the same bodyweight contribution");
assert.equal(unilateralPerSideTotalReps.historyAnchor.capacityKg, 40 * (1 + (6 + 2) / 30));

const bilateralPerSideTotalRepsWithoutBodyweight = totalRepSideLoadResult({
  multiplier: 2, executionMode: "bilateral", bodyweightContributionEnabled: false,
});
assert.equal(bilateralPerSideTotalRepsWithoutBodyweight.historyAnchor.effectiveLoadKg, 40,
  "disabling bodyweight leaves only two per-side loads in the effective load");
assert.equal(bilateralPerSideTotalRepsWithoutBodyweight.historyAnchor.capacityKg, 40 * (1 + (6 + 2) / 30));

const legacyNullPerSide = recommend(perSidePrescription, [{
  sessionId: "legacy-null-per-side", completed: true,
  sets: [performedSet({ loadPerSideKg: 20, repsPerSide: 6, rir: 2, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide], loadingConvention: "per_side",
    loadingContext: { loadingConvention: "per_side", bodyweightContributionEnabled: false,
      externalLoadMultiplier: null, bodyweightCoefficient: 0 } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 2,
  executionMode: "bilateral",
} } }));
assert.equal(legacyNullPerSide.status, "recommended",
  "a valid legacy null per-side multiplier resolves using the current known slot rule");
assert.equal(legacyNullPerSide.historyAnchor.effectiveLoadKg, 40);

const unknownModePerSide = recommend(perSidePrescription, [{
  sessionId: "per-side-unknown-current-mode", completed: true,
  sets: [performedSet({ loadPerSideKg: 20, repsPerSide: 6, rir: 2, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide], loadingConvention: "per_side",
    loadingContext: { loadingConvention: "per_side", bodyweightContributionEnabled: false,
      externalLoadMultiplier: 2, bodyweightCoefficient: 0 } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 2,
} } }));
assert.equal(unknownModePerSide.status, "configuration_required",
  "an explicit m=2 on a persistent/ambiguous per-side context is not a substitute for an unknown mode");

const sessions = [
  { sessionId: "f1", completed: true, sets: [performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 90, reps: 6, rir: 2, setIndex: 1 })] },
  { sessionId: "f2", completed: true, sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 99, reps: 6, rir: 2, setIndex: 1 })] },
  { sessionId: "f3", completed: true, sets: [performedSet({ loadKg: 120, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 108, reps: 6, rir: 2, setIndex: 1 })] },
  { sessionId: "f4", completed: true, sets: [performedSet({ loadKg: 500, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 1, reps: 6, rir: 2, setIndex: 1 })] },
];
const futureSet = recommend(prescription({ setIndex: 2, id: "slot-a:c1:s3" }), sessions);
assert.equal(futureSet.status, "recommended");
assert.equal(futureSet.fatigue.adjacentDrops[0].drop, 0.1, "the first adjacent-set fatigue estimate uses the median of the latest three comparable sessions");
assert.equal(futureSet.fatigue.sampleSessionIds.length, 3, "older sessions do not displace the bounded evidence window");
assert.deepEqual(futureSet.fatigue.sampleSessionIds, ["f2", "f3", "f4"], "fatigue samples the latest three sessions in input order");
assert.equal(futureSet.historyAnchor.capacityKg, 120 * (1 + (6 + 2) / 30),
  "the next-session baseline is the median first-set capacity from those latest three sessions");
assert.ok(futureSet.fatigue.projectedCapacityKg < futureSet.historyAnchor.capacityKg);
assert.ok(futureSet.targets.loadKg === 100 || futureSet.targets.loadKg === 102.5 || futureSet.targets.loadKg === 105
  || futureSet.targets.loadKg === 107.5 || futureSet.targets.loadKg === 110, "only the configured discrete grid can be returned");

const noMeasuredDrop = recommend(prescription({ setIndex: 2 }), [{
  sessionId: "no-drop", completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 1 })],
}]);
assert.equal(noMeasuredDrop.fatigue.adjacentDrops[0].drop, 0, "capacity increases clamp expected fatigue at zero");
const cappedDrop = recommend(prescription({ setIndex: 2 }), [{
  sessionId: "excessive-drop", completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }), performedSet({ loadKg: 1, reps: 6, rir: 2, setIndex: 1 })],
}]);
assert.equal(cappedDrop.fatigue.adjacentDrops[0].drop, 0.15, "extreme drops clamp expected fatigue at fifteen percent");

const positionalFatigueSessions = [
  { sessionId: "position-f1", completed: true, sets: [
    performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }),
    performedSet({ loadKg: 90, reps: 6, rir: 2, setIndex: 1 }),
    performedSet({ loadKg: 90, reps: 6, rir: 2, setIndex: 2 }),
  ] },
  { sessionId: "position-f2", completed: true, sets: [
    performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 }),
    performedSet({ loadKg: 99, reps: 6, rir: 2, setIndex: 1 }),
    performedSet({ loadKg: 99, reps: 6, rir: 2, setIndex: 2 }),
  ] },
  { sessionId: "position-f3", completed: true, sets: [
    performedSet({ loadKg: 120, reps: 6, rir: 2, setIndex: 0 }),
    performedSet({ loadKg: 108, reps: 6, rir: 2, setIndex: 1 }),
    performedSet({ loadKg: 108, reps: 6, rir: 2, setIndex: 2 }),
  ] },
];
const positionalFirst = recommend(prescription({ setIndex: 1 }), positionalFatigueSessions);
const positionalSecond = recommend(prescription({ setIndex: 2 }), positionalFatigueSessions);
const positionalThird = recommend(prescription({ setIndex: 3 }), positionalFatigueSessions);
assert.equal(positionalSecond.fatigue.adjacentDrops[0].drop, 0.1,
  "the first adjacent-set drop is the median of each session's set-zero to set-one capacity change");
assert.equal(positionalThird.fatigue.adjacentDrops[1].drop, 0,
  "the second adjacent-set drop is independently measured from set one to set two");
assert.equal(positionalFirst.fatigue.projectedCapacityKg, positionalFirst.historyAnchor.capacityKg,
  "the first future set uses the first-set baseline without a fatigue factor");
assert.equal(positionalSecond.fatigue.projectedCapacityKg, positionalSecond.historyAnchor.capacityKg * 0.9,
  "the second future set applies only its corresponding first adjacent-set factor");
assert.equal(positionalThird.fatigue.projectedCapacityKg, positionalThird.historyAnchor.capacityKg * 0.9,
  "the third future set multiplies the first two position-specific factors, not the first drop twice");

const liveAnchor = recommend(prescription({ setIndex: 3, id: "slot-a:c1:s4" }), sessions.slice(0, 1), [
  performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }),
  performedSet({ loadKg: 120, reps: 6, rir: 2, setIndex: 1 }),
]);
assert.equal(liveAnchor.status, "recommended");
assert.equal(liveAnchor.historyAnchor.source, "current_session");
assert.equal(liveAnchor.historyAnchor.effectiveLoadKg, 120, "the latest completed comparable live set replaces the session baseline");
assert.equal(liveAnchor.historyAnchor.capacityKg, 120 * (1 + (6 + 2) / 30));
assert.equal(liveAnchor.fatigue.projectedCapacityKg,
  liveAnchor.historyAnchor.capacityKg,
  "an in-session recommendation uses the next ordinal's adjacent drop after its latest completed anchor; missing ordinal evidence defaults to zero");

const liveSecondSet = recommend(prescription({ setIndex: 2, id: "slot-a:c1:s2" }), positionalFatigueSessions, [
  performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }),
]);
assert.equal(liveSecondSet.fatigue.projectedCapacityKg,
  liveSecondSet.historyAnchor.capacityKg * 0.9,
  "a live second-set recommendation applies the measured set-zero to set-one factor once");
const liveThirdSet = recommend(prescription({ setIndex: 3, id: "slot-a:c1:s3" }), positionalFatigueSessions, [
  performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }),
  performedSet({ loadKg: 120, reps: 6, rir: 2, setIndex: 1 }),
]);
assert.equal(liveThirdSet.fatigue.projectedCapacityKg, liveThirdSet.historyAnchor.capacityKg,
  "a live third-set recommendation applies the independently measured set-one to set-two factor after anchoring at set one");

const firstOrdinalSameSet = recommend(prescription({ setIndex: 1 }), [{
  sessionId: "first-history", completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}], [performedSet({ loadKg: 500, reps: 6, rir: 2, setIndex: 0 })]);
assert.equal(firstOrdinalSameSet.historyAnchor.source, "history", "the first prescription cannot use its own ordinal actual as a prior anchor");
assert.equal(firstOrdinalSameSet.historyAnchor.effectiveLoadKg, 110);

const secondOrdinalSameSet = recommend(prescription({ setIndex: 2 }), [{
  sessionId: "second-history", completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}], [
  performedSet({ loadKg: 100, reps: 6, rir: 2, setIndex: 0 }),
  performedSet({ loadKg: 500, reps: 6, rir: 2, setIndex: 1 }),
]);
assert.equal(secondOrdinalSameSet.historyAnchor.source, "current_session");
assert.equal(secondOrdinalSameSet.historyAnchor.effectiveLoadKg, 100,
  "the second prescription may use set zero, but cannot use its same-index set one actual");

const firstProjected = recommend(prescription({ setIndex: 1 }), sessions);
const secondProjected = recommend(prescription({ setIndex: 2 }), sessions);
const thirdProjected = recommend(prescription({ setIndex: 3 }), sessions);
assert.equal(firstProjected.fatigue.projectedCapacityKg, firstProjected.historyAnchor.capacityKg,
  "the first future set uses the first-set baseline without a fatigue factor");
assert.equal(secondProjected.fatigue.projectedCapacityKg, secondProjected.historyAnchor.capacityKg * 0.9,
  "the second future set applies one sequential fatigue factor");
assert.equal(thirdProjected.fatigue.projectedCapacityKg, thirdProjected.historyAnchor.capacityKg * 0.9,
  "the third future set applies its measured first drop once and defaults the unmeasured second adjacent ordinal to zero");

const partialAndMissingRir = recommend(prescription(), [{
  sessionId: "bad-history",
  completed: true,
  sets: [
    performedSet({ loadKg: 110, reps: 6, rir: 2, completed: false }),
    performedSet({ loadKg: 110, reps: 6, rir: null, setIndex: 1 }),
  ],
}]);
assert.equal(partialAndMissingRir.status, "manual", "partial sets and missing RIR cannot anchor capacity");
assert.ok(partialAndMissingRir.reasonCodes.includes("no_comparable_history"));

const highPerformedRir = recommend(prescription(), [{
  sessionId: "high-rir-anchor",
  completed: true,
  sets: [performedSet({ loadKg: 100, reps: 6, rir: 6, setIndex: 0 })],
}]);
assert.equal(highPerformedRir.status, "recommended", "performed RIR is evidence, not refused by the authored target range");
assert.equal(highPerformedRir.historyAnchor.capacityKg, 100 * (1 + (6 + 5) / 30),
  "a performed RIR above the credit cap earns the cap (owner, 2026-11-05)");

const distanceMetricIds = [METRIC.weight, METRIC.distanceShort];
const distanceMetricDefinitions = distanceMetricIds.map((id) => metricDefinitions[id]);
assert.equal(Metrics.validateDefinitions(distanceMetricIds, distanceMetricDefinitions).ok, true,
  "distance stays in its exact raw source composition");
const unsupportedDistance = recommend(prescription({
  metricType: "source_metrics@1",
  metricIds: distanceMetricIds,
  metricDefinitions: distanceMetricDefinitions,
  targets: { loadKg: { min: 10, max: 20 }, distanceShortMeters: { min: 100, max: 200 } },
}), [{
  sessionId: "distance-history", completed: true,
  sets: [performedSet({ loadKg: 15, distanceShortMeters: 120, reps: undefined, metricIds: distanceMetricIds, setIndex: 0 })],
}]);
assert.equal(unsupportedDistance.status, "manual", "distance prescriptions stay loggable without fabricated capacity math");

const unavailableGrid = recommend(prescription(), [{
  sessionId: "anchor-110", completed: true,
  sets: [performedSet({ loadKg: 110, reps: 6, rir: 2, setIndex: 0 })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", loadingConvention: "external", bodyweightContributionEnabled: false,
  externalLoadMultiplier: 1,
  // No available load enumeration.
} } }));
assert.equal(unavailableGrid.status, "configuration_required");
assert.ok(unavailableGrid.reasonCodes.includes("available_loads_required"));

// Fatigue is a drop in the lift's own performance, not a lighter suggestion (owner, 2026-11-06). The question needs
// at least two comparable earlier sessions, and the latest one must have done fewer reps or less load at the same or
// a harder effort than the one before it.
const session = (sessionId, ...sets) => ({ sessionId, completed: true,
  sets: sets.map(([loadKg, reps, rir], setIndex) => performedSet({ loadKg, reps, rir, setIndex })) });
const trend = (history) => Engine.performanceTrend(prescription(), history, context());
assert.equal(typeof Engine.performanceTrend, "function", "the engine answers whether a lift's performance dropped");
// The owner's second session: one earlier session, too heavy for the 7–9 range at RIR 0. The engine lowers the load
// to fit the range; that is calibration, and one session is not enough to call a drop.
const tooHeavy = [session("s1", [110, 6, 0], [110, 6, 0])];
assert.equal(recommend(prescription(), tooHeavy).targets.loadKg < 110, true, "a set too heavy for its range is suggested lighter");
assert.deepEqual(trend(tooHeavy), { status: "insufficient_history", comparableSessions: 1, dropped: false },
  "a lighter suggestion after one session is not fatigue");
assert.equal(trend([]).dropped, false);
// Calibrated down and performed: less load, more reps. Not a drop.
assert.equal(trend([...tooHeavy, session("s2", [100, 9, 0])]).dropped, false, "a lighter load for more reps is calibration");
// The same load for fewer reps at the same effort is a drop.
const dropped = trend([session("s1", [105, 9, 1]), session("s2", [105, 7, 1])]);
assert.equal(dropped.status, "dropped", "fewer reps at the same load and effort is a performance drop");
assert.equal(dropped.dropped, true);
assert.equal(dropped.comparableSessions, 2);
assert.equal(trend([session("s1", [105, 8, 1]), session("s2", [102.5, 8, 0])]).dropped, true,
  "less load for the same reps at a harder effort is a drop");
// Fewer reps but an easier effort, or more load for fewer reps, is not a drop.
assert.equal(trend([session("s1", [105, 9, 1]), session("s2", [105, 8, 3])]).dropped, false, "an easier effort is not a drop");
assert.equal(trend([session("s1", [100, 9, 1]), session("s2", [105, 7, 1])]).dropped, false, "more load for fewer reps is not a drop");
assert.equal(trend([session("s1", [105, 9, 1]), session("s2", [105, 9, 1])]).status, "steady");
// Only the latest two comparable sessions are compared: an old drop that recovered is not reported.
assert.equal(trend([session("s1", [105, 9, 1]), session("s2", [105, 7, 1]), session("s3", [105, 9, 1])]).dropped, false);
// Sessions without a comparable first set (another loading setup, a missing effort) do not count.
assert.equal(trend([session("s1", [105, 9, 1]), session("s2", [105, 7, null])]).status, "insufficient_history");

console.log("PASS Plan 067 adaptive progression algorithm contract");
