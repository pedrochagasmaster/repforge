#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Engine = require(path.join(root, "progression-engine.js"));
const Metrics = require(path.join(root, "exercise-metrics.js"));

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
  loadingModel: { bodyweightCoefficient: 0.25 },
});
const bodyweight = recommend(bodyweightPrescription, [{
  sessionId: "weighted-bodyweight",
  completed: true,
  sets: [performedSet({
    loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.25,
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true, externalLoadMultiplier: 1 },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 80, externalLoadMultiplier: 1,
} } }));
assert.equal(bodyweight.status, "recommended");
assert.equal(bodyweight.historyAnchor.effectiveLoadKg, 100, "fractional bodyweight load contributes once to the anchor");
assert.equal(bodyweight.loadingAssumptions.bodyweightContributionKg, 20);
assert.equal(bodyweight.targets.loadKg + bodyweight.loadingAssumptions.bodyweightContributionKg,
  bodyweight.targetEffectiveLoadKg, "candidate and anchor use the same bodyweight transform");

const changedBodyweight = recommend(bodyweightPrescription, [{
  sessionId: "older-bodyweight",
  completed: true,
  sets: [performedSet({
    loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.25,
    loadingContext: { bodyweightKg: 80, bodyweightContributionEnabled: true, externalLoadMultiplier: 1 },
  })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 90, externalLoadMultiplier: 1,
} } }));
assert.equal(changedBodyweight.status, "recommended", "a changed bodyweight is comparable under the same recorded convention");
assert.equal(changedBodyweight.historyAnchor.effectiveLoadKg, 100, "history uses the body's recorded 80 kg, not current 90 kg");
assert.equal(changedBodyweight.loadingAssumptions.bodyweightContributionKg, 22.5, "candidates use the current bodyweight");
assert.equal(changedBodyweight.targets.loadKg + 22.5, changedBodyweight.targetEffectiveLoadKg);

const missingHistoricalBodyweight = recommend(bodyweightPrescription, [{
  sessionId: "missing-historic-bodyweight",
  completed: true,
  sets: [performedSet({ loadKg: 80, reps: 6, rir: 2, setIndex: 0,
    bodyweightCoefficient: 0.25, loadingContext: null })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-a", availableLoadsKg: [60, 65, 70, 75, 80, 85],
  loadingConvention: "external", bodyweightContributionEnabled: true,
  bodyweightKg: 90, externalLoadMultiplier: 1,
} } }));
assert.notEqual(missingHistoricalBodyweight.status, "recommended", "current weight cannot fill missing historical bodyweight");
assert.ok(missingHistoricalBodyweight.reasonCodes.includes("historical_bodyweight_required"));

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
  externalLoadMultiplier: 2,
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
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 3,
} } }));
assert.notEqual(mismatchedPerSideMultiplier.status, "recommended", "a different per-side multiplier is a different loading convention");

const mismatchedEquipment = recommend(perSidePrescription, [{
  sessionId: "per-side-anchor", completed: true,
  sets: [performedSet({ loadPerSideKg: 20, repsPerSide: 6, setIndex: 0,
    metricIds: [METRIC.repsPerSide, METRIC.weightPerSide], equipmentId: "rack-a", loadingConvention: "per_side",
    loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 2, loadingConvention: "per_side" } })],
}], [], context({ bySlotId: { "slot-a": {
  equipmentId: "rack-b", availableLoadsKg: [15, 17.5, 20, 22.5, 25],
  loadingConvention: "per_side", bodyweightContributionEnabled: false, externalLoadMultiplier: 2,
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
  loadingConvention: "per_side", bodyweightContributionEnabled: false,
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
  bodyweightContributionEnabled: false,
  // Intentionally missing externalLoadMultiplier.
} } }));
assert.equal(missingPerSideConvention.status, "configuration_required");
assert.ok(missingPerSideConvention.reasonCodes.includes("per_side_convention_required"));

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
assert.equal(highPerformedRir.status, "recommended", "performed RIR is evidence, not capped to the authored target range");
assert.equal(highPerformedRir.historyAnchor.capacityKg, 100 * (1 + (6 + 6) / 30));

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

console.log("PASS Plan 067 adaptive progression algorithm contract");
