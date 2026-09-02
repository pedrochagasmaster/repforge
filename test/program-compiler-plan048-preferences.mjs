import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const context = (familyId, frequency, extra = {}) => ({
  schemaVersion: 2,
  familyId,
  frequency,
  sessionMinutes: 90,
  preferredRestSeconds: null,
  equipment: familyId === "home" ? [] : ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: familyId === "home" ? [] : ["safe_pull", "training_support"],
  loadIncrements: familyId === "home" ? {} : { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  primaryMuscles: [],
  deEmphasizedMuscles: [],
  ignoredMuscles: [],
  priorityMovements: [],
  ...extra,
});
const allSlots = (result) => result.days.flatMap((day) => day.slots);
const preservesPrimaryIntent = (slot) => slot.exercise.primaryMuscles.some((muscle) =>
  slot.contract.primaryMuscles.includes(muscle));
const semanticWithoutVersions = (result) => {
  const copy = structuredClone(result);
  if (copy.provenance) {
    delete copy.provenance.compilerVersion;
    delete copy.provenance.contextVersion;
  }
  if (copy.programStructure?.provenance) {
    delete copy.programStructure.provenance.compilerVersion;
    delete copy.programStructure.provenance.contextVersion;
  }
  return copy;
};

assert.equal(Compiler.VERSIONS.compiler, 2, "Plan 048 preference semantics increment compiler version");
assert.equal(Compiler.VERSIONS.context, 2, "Plan 048 inputs use context schema/version 2");

const legacyNoPreference = Compiler.compile({
  schemaVersion: 1,
  familyId: "strength",
  frequency: 3,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  priorityMuscles: [],
}, EXERCISE_LIBRARY);
const currentNoPreference = Compiler.compile(context("strength", 3), EXERCISE_LIBRARY);
assert.equal(legacyNoPreference.kind, "compiled");
assert.equal(currentNoPreference.kind, "compiled");
assert.deepEqual(
  semanticWithoutVersions(currentNoPreference),
  semanticWithoutVersions(legacyNoPreference),
  "no preference preserves Plan 047 semantic output apart from version provenance",
);

const shortRest = Compiler.compile(context("strength", 3, { preferredRestSeconds: 60 }), EXERCISE_LIBRARY);
assert.equal(shortRest.kind, "compiled");
assert(allSlots(shortRest).filter((slot) => slot.role === "heavy_primary").every((slot) => slot.prescription.restSeconds === 120),
  "60-second preference cannot violate the 120-second heavy floor");

const longRest = Compiler.compile(context("strength", 3, { preferredRestSeconds: 180 }), EXERCISE_LIBRARY);
assert.equal(longRest.kind, "compiled");
assert(allSlots(longRest).filter((slot) => slot.role === "heavy_primary").every((slot) => slot.prescription.restSeconds === 180),
  "180-second preference is used where authored heavy bounds allow it");
assert(allSlots(longRest).filter((slot) => slot.prescription.classId === "isolation_8_15").every((slot) => slot.prescription.restSeconds === 120),
  "180-second preference clamps isolation work to its authored 120-second ceiling");
assert(
  Compiler.estimateDaySeconds(longRest.days[0]) > Compiler.estimateDaySeconds(currentNoPreference.days[0]),
  "preferred rest materially changes the time estimate",
);

let restPressure = null;
for (let minutes = 20; minutes <= 75 && !restPressure; minutes += 5) {
  const result = Compiler.compile(context("growth", 3, { sessionMinutes: minutes, preferredRestSeconds: 180 }), EXERCISE_LIBRARY);
  if (result.kind === "compiled" && result.reductions.length) restPressure = result;
}
assert(restPressure, "longer preferred rest can trigger the normal time-pressure path");
for (const dayId of new Set(restPressure.reductions.map((entry) => entry.dayId))) {
  const ranks = restPressure.reductions
    .filter((entry) => entry.dayId === dayId)
    .map((entry) => Compiler.RULES.reductionOrder.indexOf(entry.step));
  assert(ranks.every((rank, index) => index === 0 || rank >= ranks[index - 1]), "rest pressure follows reviewed reduction order");
}
const impossibleRest = Compiler.compile(context("strength", 2, { sessionMinutes: 10, preferredRestSeconds: 180 }), EXERCISE_LIBRARY);
assert.equal(impossibleRest.kind, "conflict");
assert.equal(impossibleRest.frequency, 2, "rest conflict never reduces requested frequency");
assert(impossibleRest.conflicts.some((entry) => entry.code === "time_ceiling_conflict"));

const syntheticCandidates = [
  {
    id: "synthetic:a-row",
    name: "Synthetic row",
    equipment: ["machine"],
    primary: "Back",
    secondary: "Biceps",
    patterns: ["row"],
    practicalRepRange: [4, 12],
    rank: 0,
  },
  {
    id: "synthetic:b-pulldown",
    name: "Synthetic pulldown",
    equipment: ["machine"],
    primary: "Lats",
    secondary: "Biceps",
    patterns: ["pulldown"],
    practicalRepRange: [4, 12],
    rank: 0,
  },
];
const movementCatalogue = [...EXERCISE_LIBRARY, ...syntheticCandidates];
const movementBaseline = Compiler.compile(context("strength", 2, { history: [{ libraryId: "synthetic:a-row" }] }), movementCatalogue);
const movementPriority = Compiler.compile(context("strength", 2, {
  history: [{ libraryId: "synthetic:a-row" }],
  priorityMovements: ["pulldown"],
}), movementCatalogue);
assert.equal(movementBaseline.kind, "compiled");
assert.equal(movementPriority.kind, "compiled");
const baselineMixed = allSlots(movementBaseline).find((slot) => slot.templateId === "pull_mixed");
const priorityMixed = allSlots(movementPriority).find((slot) => slot.templateId === "pull_mixed");
assert.equal(baselineMixed.exercise.id, "synthetic:a-row");
assert.notEqual(priorityMixed.exercise.id, baselineMixed.exercise.id, "movement priority changes a compatible candidate preference");
assert(priorityMixed.exercise.patterns.includes("pulldown"), "movement priority selects a compatible candidate with that pattern");
assert.deepEqual(
  movementPriority.days.map((day) => day.slots.map((slot) => slot.templateId)),
  movementBaseline.days.map((day) => day.slots.map((slot) => slot.templateId)),
  "movement priority does not mutate blueprint structure",
);
assert.deepEqual(Compiler.compile(context("strength", 2, {
  history: [{ libraryId: "synthetic:a-row" }],
  priorityMovements: ["pulldown"],
}), movementCatalogue), movementPriority,
  "movement-priority compilation is deterministic");
assert.equal(Compiler.compile(context("strength", 2, { priorityMovements: ["unknown_pattern"] }), movementCatalogue).kind, "invalid",
  "unknown movement priorities are rejected");

const deEmphasized = Compiler.compile(context("strength", 2, {
  history: [{ libraryId: "synthetic:a-row" }],
  deEmphasizedMuscles: ["back"],
}), movementCatalogue);
assert.equal(deEmphasized.kind, "compiled");
assert(allSlots(deEmphasized).find((slot) => slot.templateId === "pull_mixed").exercise.primaryMuscles.every((muscle) => muscle !== "back"),
  "a valid reducible candidate with less direct de-emphasis is preferred");
assert(allSlots(deEmphasized).some((slot) => slot.protected), "protected family coverage survives de-emphasis");
assert.equal(deEmphasized.frequency, movementBaseline.frequency);
assert.deepEqual(Compiler.compile(context("strength", 2, {
  history: [{ libraryId: "synthetic:a-row" }],
  deEmphasizedMuscles: ["back"],
}), movementCatalogue), deEmphasized,
  "de-emphasis stays deterministic");

const hingeDeEmphasis = Compiler.compile(context("growth", 2, {
  deEmphasizedMuscles: ["glutes"],
}), EXERCISE_LIBRARY);
assert.equal(hingeDeEmphasis.kind, "compiled");
const hingeGrowth = allSlots(hingeDeEmphasis).find((slot) => slot.templateId === "hinge_growth");
assert(preservesPrimaryIntent(hingeGrowth),
  "de-emphasis cannot fill hinge_growth with an exercise that trains its intended muscles only secondarily");
assert.notEqual(hingeGrowth.exercise.id, "sq_lp",
  "leg press cannot replace the authored hinge primary intent");

const primaryIntentInversions = [];
for (const familyId of Compiler.FAMILY_IDS) {
  for (const frequency of Compiler.FREQUENCIES) {
    const baseline = Compiler.compile(context(familyId, frequency), EXERCISE_LIBRARY);
    assert.equal(baseline.kind, "compiled");
    const baselineBySlot = new Map(allSlots(baseline).map((slot) => [slot.slotId, slot]));
    for (const muscle of Compiler.MUSCLE_IDS) {
      const changed = Compiler.compile(context(familyId, frequency, {
        deEmphasizedMuscles: [muscle],
      }), EXERCISE_LIBRARY);
      assert.equal(changed.kind, "compiled");
      for (const slot of allSlots(changed)) {
        const before = baselineBySlot.get(slot.slotId);
        if (before && preservesPrimaryIntent(before) && !preservesPrimaryIntent(slot)) {
          primaryIntentInversions.push({ familyId, frequency, muscle, slotId: slot.slotId,
            before: before.exercise.id, after: slot.exercise.id });
        }
      }
    }
  }
}
assert.deepEqual(primaryIntentInversions, [],
  `de-emphasis introduced ${primaryIntentInversions.length} primary-intent inversions`);

const ignored = Compiler.compile(context("growth", 2, {
  ignoredMuscles: ["biceps", "triceps", "calves", "side_delts", "rear_delts"],
}), EXERCISE_LIBRARY);
assert.equal(ignored.kind, "compiled");
assert(!allSlots(ignored).some((slot) => slot.reducible && slot.exercise.primaryMuscles.some((muscle) =>
  ["biceps", "triceps", "calves", "side_delts", "rear_delts"].includes(muscle))),
  "safe optional/reducible direct work for ignored muscles disappears");
assert(allSlots(ignored).some((slot) => slot.exercise.secondaryMuscles.includes("biceps")),
  "indirect ignored-muscle exposure through required compounds may remain");

const protectedIgnore = Compiler.compile(context("growth", 2, { ignoredMuscles: ["quads"] }), EXERCISE_LIBRARY);
assert.equal(protectedIgnore.kind, "conflict");
assert(protectedIgnore.conflicts.some((entry) => entry.code === "ignored_muscle_required"),
  "an impossible ignore request returns a typed conflict rather than weakening protected work");

for (const invalid of [
  { primaryMuscles: ["chest"], ignoredMuscles: ["chest"] },
  { primaryMuscles: ["chest"], deEmphasizedMuscles: ["chest"] },
  { deEmphasizedMuscles: ["chest"], ignoredMuscles: ["chest"] },
  { primaryMuscles: ["chest", "back", "quads"] },
  { ignoredMuscles: Array.from({ length: 20 }, (_, index) => `muscle_${index}`) },
]) {
  assert.equal(Compiler.compile(context("growth", 3, invalid), EXERCISE_LIBRARY).kind, "invalid",
    "contradictory or oversized muscle controls are rejected");
}

for (const familyId of Compiler.FAMILY_IDS) {
  for (const frequency of Compiler.FREQUENCIES) {
    const input = context(familyId, frequency);
    const choices = Compiler.getCompatibleSplitChoices(input);
    assert.deepEqual(choices, [{
      id: `${familyId}_${frequency}_v1`,
      familyId,
      frequency,
      blueprintId: `${familyId}_${frequency}_v1`,
      blueprintVersion: 1,
      default: true,
    }], `${familyId} ${frequency} exposes only its real canonical authored split`);
    assert.deepEqual(Compiler.getCompatibleSplitChoices(structuredClone(input)), choices, "split choices are deterministic");
    const canonical = Compiler.compile({ ...input, splitId: choices[0].id }, EXERCISE_LIBRARY);
    const implicit = Compiler.compile(input, EXERCISE_LIBRARY);
    assert.deepEqual(canonical, implicit, "canonical split ID produces the exact existing blueprint");
    assert.equal(Compiler.compile({ ...input, splitId: "fake_upper_lower" }, EXERCISE_LIBRARY).kind, "invalid",
      "unknown split IDs fail validation");
  }
}

console.log("PASS Plan 048 compiler preferences: rest, movement, muscle controls, split seam, bounds, conflicts, and determinism");
