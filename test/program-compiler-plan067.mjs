#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "program-compiler.js"));
const Metrics = require(path.join(root, "exercise-metrics.js"));
const raw = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/app_file.json"), "utf8"));
const gym = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/gym.json"), "utf8"));
const observations = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/programs.json"), "utf8"));

// These pure proofs cover combinatorial boundaries that a browser flow cannot
// enumerate reliably: all-or-nothing slot feasibility, seeded tie resolution,
// multi-set/cycle dose construction, raw equipment-group closure, and unknown
// prerequisite refusal. The production browser journey separately proves the
// Generate → review → activation path.

const observedExerciseIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const movementConfirmations = Object.fromEntries(observedExerciseIds.map((id) => {
  const exercise = raw.exercises.find((entry) => entry.id === id);
  return [id, [...exercise.preconditions]];
}));

function request(overrides = {}) {
  return {
    goal: "hypertrophy",
    experience: "intermediate",
    daysPerWeek: 4,
    timeCeilingMinutes: 90,
    gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
    competencyAnswers: {
      pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
      overheadPress10: null, bodyweightDips10: null, benchPress10: null,
    },
    movementConfirmations,
    emphasisMuscleIds: [],
    deprioritizedMuscleIds: [],
    excludedExerciseIds: [],
    excludedMuscleIds: [],
    preferredExerciseIds: [],
    split: "auto",
    periodization: "static",
    cycles: 7,
    deloadCycles: [],
    ...overrides,
  };
}

function observedDoseMatrix(program) {
  return program.days.map((day) => day.exercises.map((exercise) => exercise.sets.map((set) => [
    set.repMin, set.repMax, set.rir,
  ])));
}

function generatedDoseMatrix(program) {
  return program.days.filter((day) => day.kind === "training").map((day) => day.slots.map((slot) =>
    slot.prescriptionsByCycle[0].sets.map((set) => {
      const repDefinition = slot.metricDefinitions.find((entry) => entry.semantic === "reps" || entry.semantic === "repsPerSide");
      assert.ok(repDefinition, "an authored set has a source repetition metric");
      return [set.targets[repDefinition.semantic].min, set.targets[repDefinition.semantic].max, set.rir];
    })));
}

const standard = Compiler.generateProgram(request(), raw, "p067-standard-fixture");
assert.equal(standard.ok, true, `standard four-day plan should compile: ${JSON.stringify(standard.conflicts)}`);
assert.deepEqual(standard.conflicts, []);
assert.equal(standard.value.schemaVersion, 2);
assert.equal(standard.value.generatorVersion, "067.1");
assert.equal(standard.value.seed, "p067-standard-fixture");
assert.equal(standard.value.cycles, 7);
assert.deepEqual(standard.value.days.filter((day) => day.kind === "training").map((day) => day.name), [
  "Upper A", "Lower A", "Upper B", "Lower B",
]);
assert.deepEqual(standard.value.days.filter((day) => day.kind === "training").map((day) => day.slots.length), [6, 5, 6, 5]);
assert.equal(standard.value.days.flatMap((day) => day.slots).length, 22);
assert.equal(standard.value.days.flatMap((day) => day.slots)
  .flatMap((slot) => slot.prescriptionsByCycle[0].sets).length, 62);
for (const fixture of ["P1", "P2", "P3"]) {
  assert.deepEqual(observedDoseMatrix(observations[fixture]), observedDoseMatrix(observations.P1),
    `${fixture} must retain the same independently observed standard dose matrix`);
}
assert.deepEqual(generatedDoseMatrix(standard.value), observedDoseMatrix(observations.P1),
  "standard four-day hypertrophy anchors must preserve every observed P1–P3 set range and RIR");

for (const slot of standard.value.days.flatMap((day) => day.slots)) {
  assert.ok(slot.id && slot.purposeId && slot.exerciseId, "slots retain stable job and selected exercise identities");
  assert.ok(slot.sourceExerciseIds.includes(slot.exerciseId));
  assert.ok(Array.isArray(slot.metricIds) && slot.metricIds.length > 0, "prescriptions retain the source metric UUID composition");
  assert.equal(slot.prescriptionsByCycle.length, 7);
  for (const cycle of slot.prescriptionsByCycle) {
    assert.equal(cycle.sets.length, slot.prescriptionsByCycle[0].sets.length, "static cycles preserve set dose");
    for (const set of cycle.sets) {
      // Schema v2: a set derives its metric identity from its slot rather than
      // storing it again; prescriptionsForCycle is the one place that
      // materializes it back for engine/app consumers.
      assert.equal(set.metricIds, undefined, "a generated set stores no metric composition of its own");
      assert.equal(set.metricDefinitions, undefined, "a generated set stores no metric definitions of its own");
      const repDefinition = slot.metricDefinitions.find((entry) => entry.semantic === "reps" || entry.semantic === "repsPerSide");
      assert.ok(repDefinition, "the source composition declares its repetition identity");
      assert.deepEqual(Object.keys(set.targets), [repDefinition.semantic], "generation targets the declared reps metric without inventing load");
      assert.ok(set.targets[repDefinition.semantic].min >= 3 && set.targets[repDefinition.semantic].max <= 30);
      assert.ok(set.rir >= 0 && set.rir <= 4);
      assert.equal(set.actual, undefined, "prescriptions do not contain performed values");
    }
  }
}

const compact = Compiler.generateProgram(request({ timeCeilingMinutes: 40 }), raw, "p067-compact-fixture");
assert.equal(compact.ok, true, `compact four-day plan should compile: ${JSON.stringify(compact.conflicts)}`);
assert.deepEqual(compact.value.days.filter((day) => day.kind === "training").map((day) => day.slots.length), [4, 3, 5, 3]);
assert.equal(compact.value.days.flatMap((day) => day.slots).length, 15);
assert.equal(compact.value.days.flatMap((day) => day.slots)
  .flatMap((slot) => slot.prescriptionsByCycle[0].sets).length, 37);
assert.deepEqual(generatedDoseMatrix(compact.value), observedDoseMatrix(observations.P4),
  "compact four-day anchors must preserve every observed P4 set range and RIR");

const replay = Compiler.generateProgram(request(), raw, "p067-standard-fixture");
assert.deepEqual(replay, standard, "the seed must replay selection, slot IDs, prescription IDs, and provenance");
const otherSeed = Compiler.generateProgram(request(), raw, "p067-another-seed");
assert.equal(otherSeed.ok, true);
assert.notDeepEqual(
  otherSeed.value.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)),
  standard.value.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)),
  "a different seed must deterministically change at least one eligible tie selection",
);

const impossible = Compiler.generateProgram(request({ gymProfile: { equipmentIds: [] } }), raw, "no-gym");
assert.equal(impossible.ok, false, "missing equipment for protected jobs must not produce a partial program");
assert.equal(impossible.value, null);
assert.ok(impossible.conflicts.some((conflict) => conflict.code === "no_eligible_exercise"));

const incompatibleSplit = Compiler.generateProgram(request({ split: "push_pull_legs" }), raw, "bad-split");
assert.equal(incompatibleSplit.ok, false, "a six-day split cannot be silently used at four days");
assert.ok(incompatibleSplit.conflicts.some((conflict) => conflict.code === "split_frequency_mismatch"));

const soleUnilateral = raw.exercises.find((exercise) => exercise.name === "Single arm machine rear delt fly");
assert.ok(soleUnilateral, "the source fixture includes a sole-unilateral exercise");
assert.deepEqual(soleUnilateral.laterality.map((id) => raw.uuidIndex[id].name), ["Unilateral"]);
const reviewShare = Compiler.generateProgram(request(), raw, "review-share");
assert.equal(reviewShare.ok, true, `the raw four-day/90-minute source fixture compiles: ${JSON.stringify(reviewShare.conflicts)}`);
const reviewShareSlot = reviewShare.value.days.flatMap((day) => day.slots)
  .find((slot) => slot.exerciseId === soleUnilateral.id);
assert.ok(reviewShareSlot, "the review-share seed selects the source's sole-unilateral rear-delt movement");
assert.equal(reviewShareSlot.executionMode, "unilateral", "the source laterality determines the generated execution mode");
const contradictoryMode = Compiler.generateProgram(request({
  executionContexts: { [soleUnilateral.id]: "bilateral" },
}), raw, "review-share");
assert.equal(contradictoryMode.ok, false, "an explicit bilateral override cannot contradict a sole-unilateral source record");
assert.ok(contradictoryMode.conflicts.some((conflict) => conflict.code === "conflicting_execution_context"));
const reviewShareDay = reviewShare.value.days.find((day) => day.slots.some((slot) => slot.id === reviewShareSlot.id));
const spoofedBilateralSeconds = Compiler.estimateDaySeconds({
  ...reviewShareDay,
  slots: reviewShareDay.slots.map((slot) => slot.id === reviewShareSlot.id
    ? { ...slot, executionMode: "bilateral" } : slot),
});
assert.ok(Compiler.estimateDaySeconds(reviewShareDay) > spoofedBilateralSeconds,
  "overriding the source movement to bilateral would materially undercount its sequential work time");

const inclineBarbell = raw.exercises.find((exercise) => exercise.name === "45° incline barbell press");
const inclineResistance = raw.uuidIndex[inclineBarbell.resistanceEquipmentGroupIds[0]];
const pluralWeightPlatesId = "25a5c6f170d880c1a55ac08cf52671ab";
const singleWeightPlateId = "1a45c6f170d880629cdcc99a2ff615cf";
assert.ok(inclineResistance.equipment.includes(pluralWeightPlatesId));
const isolatedPurpose = structuredClone(standard.value);
const isolatedSlot = isolatedPurpose.days[0].slots[0];
for (const day of isolatedPurpose.days) day.slots = [];
isolatedPurpose.days[0].slots.push(isolatedSlot);
const singularOnlyEquipment = [
  "19e5c6f170d8801cac93cf6853bd86b8", // Barbell
  singleWeightPlateId, // Weight plate; does not imply Weight plates
  "25b5c6f170d8805db24ce3ad378a4739", // Incline bench press station
];
const groupedCandidates = Compiler.findSubstitutions(isolatedPurpose, isolatedSlot.id, {
  gymProfile: { equipmentIds: singularOnlyEquipment },
  competencyAnswers: { inclineBarbell10: true },
  movementConfirmations: { [inclineBarbell.id]: inclineBarbell.preconditions },
}, raw);
assert.ok(!groupedCandidates.some((candidate) => candidate.exerciseId === inclineBarbell.id),
  "required plural equipment stays unavailable when only its singular child is selected");

const main = standard.value.days.find((day) => day.name === "Upper A").slots[0];
const noConfirmations = Compiler.findSubstitutions(standard.value, main.id, {
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  movementConfirmations: {}, competencyAnswers: {},
}, raw);
assert.ok(noConfirmations.every((candidate) => !raw.exercises.find((exercise) => exercise.id === candidate.exerciseId).preconditions.length),
  "unknown prerequisites cannot be treated as satisfied for substitutions");
assert.ok(noConfirmations.every((candidate) => candidate.exerciseId !== main.exerciseId));

const edited = structuredClone(standard.value);
const editedAnchor = edited.days.find((day) => day.name === "Upper A").slots[0];
const editedReps = editedAnchor.metricDefinitions.find((entry) => entry.semantic === "reps" || entry.semantic === "repsPerSide").semantic;
editedAnchor.prescriptionsByCycle[0].sets[0].targets[editedReps].min = 3;
const substitutions = Compiler.findSubstitutions(edited, main.id, {
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  movementConfirmations,
  competencyAnswers: {},
}, raw);
assert.ok(substitutions.length > 0);
assert.ok(substitutions.every((candidate) => candidate.exerciseId !== main.exerciseId));
assert.ok(substitutions.every((candidate) => candidate.roleTier !== null && candidate.eligibleEquipmentContexts.length > 0));
assert.deepEqual(editedAnchor.prescriptionsByCycle[0].sets[0].targets[editedReps], { min: 3, max: 9 }, "substitution discovery must not mutate or replace the slot dose");

const latsId = Object.entries(raw.uuidIndex).find(([, entry]) => entry.type === "featureMuscleGroup" && entry.name === "Lats")[0];
const emphasized = Compiler.generateProgram(request({ timeCeilingMinutes: 40, emphasisMuscleIds: [latsId] }), raw, "emphasis-lats");
assert.equal(emphasized.ok, true, `a reviewed compact emphasis may be applied: ${JSON.stringify(emphasized.conflicts)}`);
const emphasisSlot = emphasized.value.days.flatMap((day) => day.slots).find((slot) => slot.purposeId === `emphasis_${latsId}`);
assert.ok(emphasisSlot, "compact emphasis can add a reviewed assistance job absent from the base schedule");
const emphasisCandidates = Compiler.findSubstitutions(emphasized.value, emphasisSlot.id, {
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  movementConfirmations, competencyAnswers: {},
}, raw);
assert.ok(emphasisCandidates.length > 0, "emphasis substitution resolves the original reviewed assistance purpose");
for (const candidate of emphasisCandidates) {
  const exercise = raw.exercises.find((entry) => entry.id === candidate.exerciseId);
  assert.ok(exercise.primaryFeatureMuscle.some((id) => emphasisSlot.musclePurposeIds.includes(id)));
  assert.ok(exercise.movementPattern.some((id) => emphasisSlot.movementPatternIds.includes(id)));
  assert.equal(exercise.exerciseType, emphasisSlot.exerciseTypeId);
}

const manualRepeat = structuredClone(standard.value);
const manualSlot = structuredClone(manualRepeat.days[0].slots[0]);
manualSlot.id = "manual-repeat-slot";
manualSlot.purposeId = "manual";
manualSlot.role = "manual";
manualSlot.order = manualRepeat.days[2].slots.length + 1;
for (const cycle of manualSlot.prescriptionsByCycle) for (const set of cycle.sets) set.id = `manual-repeat-${cycle.cycleIndex}-${set.setIndex}`;
manualRepeat.days[2].slots.push(manualSlot);
assert.deepEqual(Compiler.validateProgramDefinition(manualRepeat, raw), { ok: true, issues: [] },
  "a manual Build program may intentionally use the same exercise on multiple days");

const configuredCustomDefinition = structuredClone(manualRepeat);
const configuredCustomSlot = configuredCustomDefinition.days[2].slots[0];
configuredCustomSlot.purposeId = "manual";
configuredCustomSlot.exerciseId = "custom:configured-row";
configuredCustomSlot.sourceExerciseIds = [configuredCustomSlot.exerciseId];
configuredCustomSlot.role = "manual";
configuredCustomSlot.metricOrigin = "user_defined";
for (const cycle of configuredCustomSlot.prescriptionsByCycle) {
  for (const set of cycle.sets) set.status = "manual";
}
assert.deepEqual(Compiler.validateProgramDefinition(configuredCustomDefinition, raw, [
  { id: "custom:configured-row", name: "Coach row", metricIds: [...configuredCustomSlot.metricIds],
    metricDefinitions: configuredCustomSlot.metricDefinitions.map((definition) => ({ ...definition })) },
]), { ok: true, issues: [] }, "a manual custom exercise with configured source metrics stays manually prescribed, not permanently configuration-required");

const unboundedCustomCoefficient = structuredClone(configuredCustomDefinition);
unboundedCustomCoefficient.days[2].slots[0].loadingModel.bodyweightCoefficient = 1.25;
assert.equal(Compiler.validateProgramDefinition(unboundedCustomCoefficient, raw, [
  { id: "custom:configured-row", name: "Coach row", metricIds: [...configuredCustomSlot.metricIds],
    metricDefinitions: configuredCustomSlot.metricDefinitions.map((definition) => ({ ...definition })) },
]).ok, false, "custom loading coefficients must obey the shared [0, 1] bound");

const unconfiguredCustomDefinition = structuredClone(configuredCustomDefinition);
const unconfiguredCustomSlot = unconfiguredCustomDefinition.days[2].slots[0];
unconfiguredCustomSlot.metricIds = [];
unconfiguredCustomSlot.metricDefinitions = [];
for (const cycle of unconfiguredCustomSlot.prescriptionsByCycle) {
  for (const set of cycle.sets) {
    set.metricIds = [];
    set.metricDefinitions = [];
    set.targets = {};
    set.status = "configuration_required";
  }
}
assert.deepEqual(Compiler.validateProgramDefinition(unconfiguredCustomDefinition, raw, [
  { id: "custom:configured-row", name: "Coach row", metricIds: [], metricDefinitions: [] },
]), { ok: true, issues: [] }, "an actually unconfigured custom movement remains explicitly configuration-required");

const sourceUnknownBodyweight = raw.exercises.find((exercise) => exercise.name === "Landmine hack squat");
assert.ok(sourceUnknownBodyweight, "raw catalog includes the reviewed landmine hack squat source record");
assert.equal(sourceUnknownBodyweight.bodyweight, null, "the raw source explicitly marks its bodyweight coefficient unknown");
assert.deepEqual(sourceUnknownBodyweight.exerciseMetrics.map((id) => raw.uuidIndex[id]?.name), ["Weight", "Reps"]);
const unknownCoefficientDefinition = structuredClone(manualRepeat);
const unknownCoefficientSlot = unknownCoefficientDefinition.days[2].slots.find((entry) => entry.id === "manual-repeat-slot");
unknownCoefficientSlot.exerciseId = sourceUnknownBodyweight.id;
unknownCoefficientSlot.sourceExerciseIds = [sourceUnknownBodyweight.id];
unknownCoefficientSlot.metricIds = [...sourceUnknownBodyweight.exerciseMetrics];
unknownCoefficientSlot.metricDefinitions = Metrics.definitionsForIds(unknownCoefficientSlot.metricIds).value;
unknownCoefficientSlot.metricOrigin = "source_catalog";
unknownCoefficientSlot.lateralityIds = [...sourceUnknownBodyweight.laterality];
unknownCoefficientSlot.executionMode = "bilateral";
unknownCoefficientSlot.loadingModel.bodyweightCoefficient = sourceUnknownBodyweight.bodyweight;
assert.deepEqual(Compiler.validateProgramDefinition(unknownCoefficientDefinition, raw), { ok: true, issues: [] },
  "a real raw movement with unknown coefficient keeps null as a valid, explicit source value");
for (const inventedCoefficient of [0, 0.7]) {
  const invented = structuredClone(unknownCoefficientDefinition);
  invented.days[2].slots.find((entry) => entry.id === "manual-repeat-slot")
    .loadingModel.bodyweightCoefficient = inventedCoefficient;
  assert.equal(Compiler.validateProgramDefinition(invented, raw).ok, false,
    `an invented ${inventedCoefficient} coefficient cannot replace the raw source null`);
}

const unsafeCustomDefinition = Compiler.validateProgramDefinition(configuredCustomDefinition, raw, [
  { id: "custom:configured-row", name: "Coach row", metricIds: [...configuredCustomSlot.metricIds],
    metricDefinitions: configuredCustomSlot.metricDefinitions.map((definition) => ({ ...definition })),
    performedValues: [{ metricId: configuredCustomSlot.metricIds[0], value: 777, unit: "kg" }] },
]);
assert.equal(unsafeCustomDefinition.ok, false, "custom definitions reject unreviewed fields that could carry performed values");

const badMetricSemantic = structuredClone(standard.value);
badMetricSemantic.days[0].slots[0].metricDefinitions[0].semantic = "fabricatedLoad";
assert.equal(Compiler.validateProgramDefinition(badMetricSemantic, raw).ok, false,
  "definition semantics must match the canonical source UUID, name, and unit");
const malformedSlotOrder = structuredClone(standard.value);
malformedSlotOrder.days[0].slots[0].order = {};
assert.equal(Compiler.validateProgramDefinition(malformedSlotOrder, raw).ok, false,
  "slot ordering is a bounded canonical ordinal, never an arbitrary JSON object");

const overlongRest = structuredClone(standard.value);
overlongRest.days[0].slots[0].prescriptionsByCycle[0].sets[0].restSeconds = 86401;
assert.equal(Compiler.validateProgramDefinition(overlongRest, raw).ok, false,
  "rest duration is bounded to one day at the canonical definition boundary");
const fractionalRest = structuredClone(standard.value);
fractionalRest.days[0].slots[0].prescriptionsByCycle[0].sets[0].restSeconds = 0.5;
assert.equal(Compiler.validateProgramDefinition(fractionalRest, raw).ok, false,
  "rest duration is an integer number of seconds so a generated slot can become a valid DraftV2 set");

const zeroLoadGridDefinition = structuredClone(standard.value);
const gridEquipmentId = zeroLoadGridDefinition.request.gymProfile.equipmentIds[0];
zeroLoadGridDefinition.request.gymProfile.equipmentLoadsKg = { [gridEquipmentId]: [0, 5, 10] };
assert.deepEqual(Compiler.validateProgramDefinition(zeroLoadGridDefinition, raw), { ok: true, issues: [] },
  "a configured external load grid may include zero for a real equipment UUID");
const negativeLoadGridDefinition = structuredClone(zeroLoadGridDefinition);
negativeLoadGridDefinition.request.gymProfile.equipmentLoadsKg[gridEquipmentId] = [-0.5, 5, 10];
assert.equal(Compiler.validateProgramDefinition(negativeLoadGridDefinition, raw).ok, false,
  "load grids preserve the zero boundary while still refusing negative loads");

const badTargetMetric = structuredClone(standard.value);
const badTargetSlot = badTargetMetric.days[0].slots[0];
const badTargetSet = badTargetSlot.prescriptionsByCycle[0].sets[0];
badTargetSet.targets.durationSeconds = { min: 1, max: 2 };
assert.equal(Compiler.validateProgramDefinition(badTargetMetric, raw).ok, false,
  "a globally known semantic key is invalid unless its exact source metric ID is in the composition");

const injectedPerformedValues = structuredClone(standard.value);
injectedPerformedValues.days[0].slots[0].prescriptionsByCycle[0].sets[0].performedValues = [{ metricId: "x", value: 999 }];
assert.equal(Compiler.validateProgramDefinition(injectedPerformedValues, raw).ok, false,
  "performed values are rejected recursively at the program import boundary");

assert.equal(Metrics.validateMetricValues(["2555c6f170d88072bbf6d9ad3f16ea86"], [
  { metricId: "2555c6f170d88072bbf6d9ad3f16ea86", value: 0.5, unit: "reps" },
]).ok, false, "performed repetitions must be positive integers");
assert.equal(Metrics.validateMetricValues(["2555c6f170d88063941ef7c8956d760c"], [
  { metricId: "2555c6f170d88063941ef7c8956d760c", value: 0, unit: "seconds" },
]).ok, false, "performed duration must be positive");
assert.equal(Metrics.validateMetricValues(["2555c6f170d88022b3b4ef4ae5fe7571"], [
  { metricId: "2555c6f170d88022b3b4ef4ae5fe7571", value: 0, unit: "metres" },
]).ok, false, "an unsupported metric composition remains rejected");
assert.equal(Metrics.validateMetricValues(["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d88022b3b4ef4ae5fe7571"], [
  { metricId: "2555c6f170d8805cafa6d16d3fdddbaa", value: 10, unit: "kg" },
  { metricId: "25a5c6f170d88022b3b4ef4ae5fe7571", value: 1.5, unit: "metres" },
]).ok, true, "a valid observed composition accepts fractional positive metres");
assert.equal(Metrics.validateMetricValues(["2555c6f170d8805cafa6d16d3fdddbaa", "25a5c6f170d88022b3b4ef4ae5fe7571"], [
  { metricId: "2555c6f170d8805cafa6d16d3fdddbaa", value: 10, unit: "kg" },
  { metricId: "25a5c6f170d88022b3b4ef4ae5fe7571", value: 0, unit: "metres" },
]).ok, false, "distance values must be positive in a valid source composition");
for (const invalidActual of [null, "8", ""]) {
  assert.equal(Metrics.validateMetricValues(["2555c6f170d88072bbf6d9ad3f16ea86"], [
    { metricId: "2555c6f170d88072bbf6d9ad3f16ea86", value: invalidActual, unit: "reps" },
  ]).ok, false, "performed values must be finite numbers, distinct from editable text/null input");
}
assert.equal(Metrics.validateTargets(["2555c6f170d88072bbf6d9ad3f16ea86"], { reps: { min: 0.5, max: 4 } }).ok, false,
  "repetition target bounds must be positive integers");
assert.equal(Metrics.validateTargets(["2555c6f170d88063941ef7c8956d760c"], { durationSeconds: 0 }).ok, false,
  "duration targets must be positive");
assert.equal(Metrics.validateTargets(["2555c6f170d8805cafa6d16d3fdddbaa", "2555c6f170d88072bbf6d9ad3f16ea86"], {
  loadKg: { min: 0, max: 10, performedValues: [999] }, reps: { min: 1, max: 3 },
}).ok, false, "target range objects reject unknown nested fields");

const uniqueMetricCompositions = new Map();
for (const exercise of raw.exercises) uniqueMetricCompositions.set(JSON.stringify(exercise.exerciseMetrics), exercise.exerciseMetrics);
assert.equal(uniqueMetricCompositions.size, 18, "the source corpus has 17 populated compositions and one explicit empty composition");
assert.deepEqual(Metrics.SOURCE_COMPOSITIONS.map(JSON.stringify).sort(), [...uniqueMetricCompositions.keys()].sort(),
  "the canonical helper allows exactly the source metric compositions in source order");
const knownBilateral = raw.exercises.find((exercise) => exercise.name === "45° cable rear delt fly");
assert.ok(knownBilateral, "raw laterality fixture identifies the bilateral per-side movement");
assert.equal(knownBilateral.laterality.map((id) => raw.uuidIndex[id].name).includes("Bilateral"), true);
const repsPerSideDefinition = Metrics.byName("Reps per side");
const estimateSlot = {
  role: "hypertrophyAccessory",
  metricDefinitions: [repsPerSideDefinition],
  executionMode: "bilateral",
  prescriptionsByCycle: [{ sets: [
    { targets: { repsPerSide: { min: 14, max: 16 } }, restSeconds: 90 },
    { targets: { repsPerSide: { min: 14, max: 16 } }, restSeconds: 90 },
  ] }],
};
const bilateralEstimate = Compiler.estimateDaySeconds({ kind: "training", slots: [estimateSlot] });
const unilateralEstimate = Compiler.estimateDaySeconds({ kind: "training", slots: [{ ...estimateSlot, executionMode: "unilateral" }] });
assert.equal(unilateralEstimate - bilateralEstimate, 120,
  "a bilateral 45-degree cable rear-delt fly counts reps once; explicitly sequential unilateral execution counts both sides");
assert.ok(Compiler.estimateDaySeconds(standard.value.days.find((day) => day.kind === "training")) > 180,
  "day estimates use final cycle prescriptions instead of treating every generated day as empty");
// A Review regeneration that carries a week-specific edit must keep every
// week inside the ceiling, so a day is estimated for the cycle asked about.
const cycleSlot = { ...estimateSlot, prescriptionsByCycle: [
  { cycleIndex: 1, sets: estimateSlot.prescriptionsByCycle[0].sets },
  { cycleIndex: 2, sets: [...estimateSlot.prescriptionsByCycle[0].sets, ...estimateSlot.prescriptionsByCycle[0].sets] },
  { cycleIndex: 3, sets: [] },
] };
const cycleDay = { kind: "training", slots: [cycleSlot] };
assert.equal(Compiler.estimateDaySeconds(cycleDay, 1), Compiler.estimateDaySeconds(cycleDay),
  "without a cycle the estimate is the first cycle's");
assert.equal(Compiler.estimateDaySeconds(cycleDay, 2) - Compiler.estimateDaySeconds(cycleDay, 1), 2 * (15 * 4 + 90),
  "a cycle with two more sets costs their work and rest");
assert.equal(Compiler.estimateDaySeconds(cycleDay, 3), 180, "a cycle with no sets costs only the day overhead");
assert.equal(Compiler.estimateDaySeconds(cycleDay, 4), 180, "a cycle the slot does not have costs nothing for it");

// The progression engine reads each prescription's bodyweight coefficient;
// a projection without it makes every set configuration-required.
for (const projected of Compiler.prescriptionsForCycle(standard.value, 1)) {
  const slot = standard.value.days.flatMap((day) => day.slots).find((candidate) => candidate.id === projected.slotId);
  assert.deepEqual(projected.loadingModel, slot.loadingModel, "cycle prescriptions carry their slot's loading model");
  // Schema v2 drops a set's own metric composition; prescriptionsForCycle is
  // the one boundary that materializes it back onto every returned prescription.
  assert.deepEqual(projected.metricIds, slot.metricIds, "cycle prescriptions materialize their slot's metric IDs");
  assert.deepEqual(projected.metricDefinitions, slot.metricDefinitions, "cycle prescriptions materialize their slot's metric definitions");
}

// #314: a schema v1 import (set-level metrics present, identical to the
// slot's — the shape every pre-dedupe release wrote) stays valid and
// normalizes to the exact current v2 output, with no user migration.
const legacyV1 = structuredClone(standard.value);
legacyV1.schemaVersion = 1;
for (const slot of legacyV1.days.flatMap((day) => day.slots)) {
  for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
    set.metricIds = [...slot.metricIds];
    set.metricDefinitions = slot.metricDefinitions.map((definition) => ({ ...definition }));
  }
}
assert.deepEqual(Compiler.validateProgramDefinition(legacyV1, raw), { ok: true, issues: [] },
  "a schema v1 definition with set-level metrics identical to its slot's stays valid");
assert.deepEqual(Compiler.canonicalizeProgramDefinition(legacyV1), standard.value,
  "canonicalizing a schema v1 import yields the exact deduped v2 shape the generator emits directly");
const mismatchedV1 = structuredClone(legacyV1);
mismatchedV1.days[0].slots[0].prescriptionsByCycle[0].sets[0].metricIds = [];
assert.equal(Compiler.validateProgramDefinition(mismatchedV1, raw).ok, false,
  "a schema v1 set whose metrics disagree with its slot's is rejected, not silently coerced");

// #316: generated day names are stored in English so fingerprints, setup-link
// recipes and backups stay language-independent; the compiler names the
// translation key for a day only while it still carries the generator's exact
// name at its generated position. A rename, a day the lifter added and a
// hand-built program with the same words stay the lifter's own text.
const en316 = JSON.parse(fs.readFileSync(path.join(root, "i18n-en.json"), "utf8"));
const pt316 = JSON.parse(fs.readFileSync(path.join(root, "i18n-pt.json"), "utf8"));
const splitCases316 = Object.entries(Compiler.SPLITS).flatMap(([split, entry]) =>
  entry.compatibleDays.map((daysPerWeek) => ({ split, daysPerWeek })));
for (const { split, daysPerWeek } of splitCases316) {
  const generated = Compiler.generateProgram(request({ split, daysPerWeek }), raw, `p316-${split}-${daysPerWeek}`);
  assert.equal(generated.ok, true, `${split}/${daysPerWeek} generates`);
  const training = generated.value.days.filter((day) => day.kind === "training");
  for (const day of training) {
    const key = Compiler.generatedDayNameKey(generated.value, day.id);
    assert.equal(typeof key, "string", `${split} ${day.name} has a translation key`);
    assert.equal(en316[key], day.name, `${split} ${day.name} reads as its stored English name in EN`);
    assert.ok(pt316[key] && pt316[key] !== day.name, `${split} ${day.name} has its own PT name (${key})`);
  }
  for (const day of generated.value.days.filter((entry) => entry.kind === "rest")) {
    assert.equal(Compiler.generatedDayNameKey(generated.value, day.id), null, `${split} rest day has no generated name`);
  }
  const renamed = structuredClone(generated.value);
  const [first, second] = renamed.days.filter((day) => day.kind === "training");
  first.name = "Monday heavy";
  assert.equal(Compiler.generatedDayNameKey(renamed, first.id), null, `${split} renamed day keeps the lifter's text`);
  const swapped = structuredClone(generated.value);
  const [a, b] = swapped.days.filter((day) => day.kind === "training");
  [a.name, b.name] = [b.name, a.name];
  assert.equal(Compiler.generatedDayNameKey(swapped, a.id), null, `${split} a day renamed to another generated name keeps the lifter's text`);
  const added = structuredClone(generated.value);
  const rest = added.days.find((day) => day.kind === "rest");
  rest.kind = "training";
  rest.name = second.name === "Lower" ? "Upper" : "Push";
  assert.equal(Compiler.generatedDayNameKey(added, rest.id), null, `${split} a day the lifter added keeps the lifter's text`);
}
const manual316 = structuredClone(standard.value);
manual316.request = {};
manual316.provenance = { source: "manual", policyVersion: "manual@1" };
const manualDay316 = manual316.days.find((day) => day.kind === "training");
assert.equal(Compiler.generatedDayNameKey(manual316, manualDay316.id), null,
  "a hand-built program that uses a generated day name keeps the lifter's text");
assert.equal(Compiler.generatedDayNameKey(null, "day-x"), null, "a missing definition has no generated day names");

// #317: a slot may name ordered alternate movements the swap picker offers
// first. The field is additive and optional, so every definition written
// before it (and every generated one) is unchanged. Its identity rules are a
// combinatorial boundary the browser journey exercises only one path of.
const alternateIds = standard.value.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId))
  .filter((id) => id !== standard.value.days[0].slots[0].exerciseId);
assert.ok(alternateIds.length >= 6, "the fixture offers enough distinct catalog movements to exceed the cap");
assert.equal(standard.value.days.flatMap((day) => day.slots).some((slot) => "alternates" in slot), false,
  "a generated definition carries no alternates field");
const withAlternates = (alternates, custom = []) => {
  const definition = structuredClone(standard.value);
  definition.days[0].slots[0].alternates = alternates;
  return Compiler.validateProgramDefinition(definition, raw, custom);
};
assert.deepEqual(withAlternates(alternateIds.slice(0, 2)), { ok: true, issues: [] },
  "catalog alternates are valid on a slot");
assert.deepEqual(withAlternates([]), { ok: true, issues: [] }, "an empty alternates list is valid input");
const customAlternate = { id: "custom:alt-row", name: "Coach row", metricIds: [], metricDefinitions: [] };
assert.deepEqual(withAlternates([customAlternate.id, alternateIds[0]], [customAlternate]), { ok: true, issues: [] },
  "a custom movement the program carries may be an alternate");
for (const [label, alternates, custom] of [
  ["a custom alternate without its definition", [customAlternate.id], []],
  ["an unknown catalog identity", ["00000000000000000000000000000000"], []],
  ["a repeated alternate", [alternateIds[0], alternateIds[0]], []],
  ["the slot's own movement", [standard.value.days[0].slots[0].exerciseId], []],
  ["more alternates than the cap", alternateIds.slice(0, Compiler.MAX_SLOT_ALTERNATES + 1), []],
  ["a non-string identity", [7], []],
  ["an empty identity", [""], []],
  ["a non-array value", alternateIds[0], []],
]) {
  const checked = withAlternates(alternates, custom);
  assert.equal(checked.ok, false, `${label} is refused`);
  assert.ok(checked.issues.some((issue) => issue.startsWith("program.days[0].slots[0].alternates")),
    `${label} is reported against the slot's alternates: ${JSON.stringify(checked.issues)}`);
}
assert.equal(Compiler.MAX_SLOT_ALTERNATES, 5, "the alternates cap is a published compiler constant");
const keptAlternates = structuredClone(standard.value);
keptAlternates.days[0].slots[0].alternates = alternateIds.slice(0, 3);
assert.deepEqual(Compiler.canonicalizeProgramDefinition(keptAlternates).days[0].slots[0].alternates, alternateIds.slice(0, 3),
  "canonicalization keeps alternates in their authored order");
const emptyAlternates = structuredClone(standard.value);
emptyAlternates.days[0].slots[0].alternates = [];
assert.deepEqual(Compiler.canonicalizeProgramDefinition(emptyAlternates), standard.value,
  "an empty alternates list canonicalizes to the absent field, so the two spellings are one definition");
assert.equal(Compiler.PROGRAM_SCHEMA_VERSION, 2, "alternates are additive; they do not bump the program schema");

console.log("PASS Plan 067 program compiler algorithm contract");
