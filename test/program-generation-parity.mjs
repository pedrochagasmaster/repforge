import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const catalog = JSON.parse(fs.readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url)));
const muscle = name => Object.entries(catalog.uuidIndex).find(([, row]) => row.type === "featureMuscleGroup" && row.name === name)?.[0];
const depriority = ["Chest", "Lats", "Upper Back", "Side Delts", "Front Delts", "Rear Delts", "Biceps", "Triceps"].map(muscle);
assert(depriority.every(Boolean), "fixture identities exist in the pinned catalogue");
const request = {
  goal: "hybrid", experience: "advanced", daysPerWeek: 3, split: "upper_lower_full",
  timeCeilingMinutes: 60, periodization: "static", cycles: 7, deloadCycles: [],
  gymProfile: { equipmentIds: Object.entries(catalog.uuidIndex).filter(([, row]) => row.type === "equipment" && row.commercialGym === 1).map(([id]) => id) },
  competencyAnswers: Object.fromEntries(["pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10"].map(key => [key, true])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: depriority,
};
assert.equal(typeof Compiler.canonicalizeRequest, "function", "compiler owns the canonical request boundary");
const normalized = Compiler.canonicalizeRequest(request, catalog);
assert.equal(normalized.ok, true, JSON.stringify(normalized));
assert.equal(normalized.value.deprioritizedMuscleIds.length, 8);
for (const loads of [null, [], 0, { unknown: [1] }, { unknown: "wrong" }]) {
  assert.equal(Compiler.canonicalizeRequest({ ...request, gymProfile: { ...request.gymProfile, equipmentLoadsKg: loads } }, catalog).ok, false, "invalid equipment grids are refused at the canonical boundary");
}
assert.deepEqual(Compiler.canonicalizeRequest({ ...request, gymProfile: { ...request.gymProfile, equipmentLoadsKg: {} } }, catalog), normalized, "an explicit empty equipment configuration equals the initial default");
const before = JSON.stringify(request);
const first = Compiler.generateProgram(request, catalog);
assert.equal(first.ok, true, JSON.stringify(first.conflicts));
assert.equal(JSON.stringify(request), before, "generation does not mutate inputs");
assert.equal(Compiler.validateProgramDefinition(first.value, catalog).ok, true);
assert.equal(first.value.generatorVersion, Compiler.GENERATOR_VERSION);
assert.equal(Object.hasOwn(first.value, "seed"), false, "current definitions have no variable-seed field");
assert.equal(Object.hasOwn(first.value.request, "seed"), false);
assert.deepEqual(first.value.days.map(day => day.kind), ["training", "rest", "training", "rest", "training", "rest", "rest"]);
assert.deepEqual(first.value.days.filter(day => day.kind === "training").map(day => day.name), ["Upper", "Lower", "Full Body"]);
assert.equal(first.value.provenance.generationBudgetMinutes, 50);
assert.equal(first.value.request.deprioritizedMuscleIds.length, 8);
const pull = new Set(Object.entries(catalog.uuidIndex).filter(([, row]) => row.type === "movementPattern" && ["Horizontal Pull", "Vertical Pull"].includes(row.name)).map(([id]) => id));
const adjustments = { 1: [0], 2: [0, -1], 3: [1, 0, -1], 4: [1, 0, 0, -1], 5: [1, 0, 0, -1, -1], 6: [1, 1, 0, 0, -1, -1] };
const ids = [];
for (const day of first.value.days) {
  ids.push(day.id);
  if (day.kind !== "training") continue;
  assert(day.slots.length > 0);
  for (const slot of day.slots) {
    ids.push(slot.id);
    const raw = catalog.exercises.find(row => row.id === slot.exerciseId);
    assert(raw && !request.excludedExerciseIds?.includes(raw.id));
    const accessory = slot.role.endsWith("Accessory");
    const primary = slot.role.endsWith("PrimaryCompound");
    const isPull = raw.movementPattern.some(id => pull.has(id));
    const center = accessory ? 15 : primary ? (isPull ? 8 : 5) : (isPull ? 12 : 10);
    const base = accessory ? 0 : isPull ? 1 : 2;
    assert.equal(slot.prescriptionsByCycle.length, 7);
    for (const cycle of slot.prescriptionsByCycle) {
      const sets = cycle.sets;
      assert(adjustments[sets.length], "source set-count domain");
      for (const [index, set] of sets.entries()) {
        ids.push(set.id);
        const range = set.targets.reps ?? set.targets.repsPerSide;
        if (range) assert.deepEqual(range, { min: center - 1, max: center + 1 });
        assert.equal(set.rir, range ? Math.max(0, base + adjustments[sets.length][index]) : null);
        assert.equal(set.restSeconds, null, "Static producer does not prescribe a rest override");
      }
      assert.deepEqual(sets.map(({ id, cycleIndex, ...set }) => set), slot.prescriptionsByCycle[0].sets.map(({ id, cycleIndex, ...set }) => set));
    }
  }
}
assert.equal(new Set(ids).size, ids.length, "all generated semantic paths have unique identities");
const permuted = structuredClone(request);
permuted.gymProfile.equipmentIds.reverse();
permuted.deprioritizedMuscleIds.reverse();
const originalRandom = Math.random, originalNow = Date.now;
try {
  Math.random = () => { throw new Error("hidden random input"); };
  Date.now = () => { throw new Error("hidden time input"); };
  assert.deepEqual(Compiler.generateProgram(permuted, catalog).value, first.value);
} finally { Math.random = originalRandom; Date.now = originalNow; }
const reorderedCatalog = { ...catalog, generatedAt: "irrelevant", exercises: [...catalog.exercises].reverse(), uuidIndex: Object.fromEntries(Object.entries(catalog.uuidIndex).reverse()) };
assert.deepEqual(Compiler.generateProgram(request, reorderedCatalog).value, first.value);
for (const bad of [
  { ...request, emphasisMuscleIds: {} },
  { ...request, deprioritizedMuscleIds: {} },
  { ...request, unknownInput: true },
  { ...request, deprioritizedMuscleIds: [...depriority, "unknown-uuid"] },
  { ...request, emphasisMuscleIds: [depriority[0]] },
  { ...request, gymProfile: { ...request.gymProfile, unknown: 1 } },
]) assert.equal(Compiler.generateProgram(bad, catalog).ok, false, "invalid input cannot be silently discarded");
for (const invalidBudget of [-1, "50", null]) {
  const invalidDefinition = structuredClone(first.value);
  invalidDefinition.provenance.generationBudgetMinutes = invalidBudget;
  assert.equal(Compiler.validateProgramDefinition(invalidDefinition, catalog).ok, false, "invalid generation budgets are refused at the definition boundary");
}
const outside = Compiler.generateProgram({ ...request, periodization: "linear" }, catalog);
assert.equal(outside.ok, false, "explicit ULF outside the validated domain must not silently use the old engine");
assert.equal(outside.value, null);
// Transition protocol proofs exercise unsupported recovered-domain overrides
// without needing to complete a block in the browser for every configuration.
const Transition = require("../program-transition.js");
const reviewed = structuredClone(first.value);
reviewed.days.find(day => day.kind === "training").slots[0].prescriptionsByCycle[0].sets[0].rir = 3;
const savedReviewed = JSON.stringify(reviewed);
for (const change of [{ kind: "fewer_days", daysPerWeek: 2 }, { kind: "shorter_sessions", sessionMinutes: 40 }]) {
  const derived = Transition.deriveSuccessor({ programDefinition: reviewed,
    customExerciseDefinitions: [], catalogSnapshot: catalog, change });
  assert.equal(derived.ok, false, `${change.kind} cannot replace recovered rules with old policy`);
  assert.equal(derived.code, "generation_conflict");
  assert.ok(derived.conflicts.some(conflict => conflict.code === "unsupported_generation_domain"));
  assert.equal(JSON.stringify(reviewed), savedReviewed, "refusal preserves the exact reviewed predecessor");
}
console.log("program-generation-parity: canonical inputs, recovered Static targets, seven cycles, identity and strict failures pass");
