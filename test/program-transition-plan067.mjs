#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Transition = require(path.join(root, "program-transition.js"));
const Compiler = require(path.join(root, "program-compiler.js"));
globalThis.crypto ||= webcrypto;

const catalogSnapshot = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/app_file.json"), "utf8"));
const gym = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/gym.json"), "utf8"));
const observations = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/programs.json"), "utf8"));
const observedExerciseIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const movementConfirmations = Object.fromEntries(observedExerciseIds.map((id) => {
  const exercise = catalogSnapshot.exercises.find((entry) => entry.id === id);
  return [id, [...exercise.preconditions]];
}));
const request = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations, emphasisMuscleIds: [], deprioritizedMuscleIds: [],
  excludedExerciseIds: [], excludedMuscleIds: [], preferredExerciseIds: [],
  split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};

const predecessorDefinition = Compiler.generateProgram(request, catalogSnapshot, "transition-source-067");
const successorDefinition = Compiler.generateProgram(request, catalogSnapshot, "transition-successor-067");
assert.equal(predecessorDefinition.ok, true, "transition source is a real complete compiler output");
assert.equal(successorDefinition.ok, true, "replacement is a second real complete compiler output");
const predecessor = {
  programId: "program-source-067",
  durableRevision: 12,
  programDefinition: predecessorDefinition.value,
  customExerciseDefinitions: [],
};
const current = { predecessor, catalogSnapshot };

assert.equal(typeof Transition.createReplacementProposal, "function",
  "replacement proposals consume canonical ProgramDefinitions instead of family/compiler envelopes");

const created = await Transition.createReplacementProposal({
  transitionId: "transition-plan067-1",
  createdAt: "2026-10-06T10:00:00.000Z",
  predecessor,
  successor: {
    programId: "program-successor-067",
    programDefinition: successorDefinition.value,
    customExerciseDefinitions: [],
  },
  catalogSnapshot,
});
assert.equal(created.ok, true, `canonical replacement is previewable: ${created.code || ""}`);
assert.equal(created.proposal.status, "preview");
assert.equal(created.proposal.predecessor.programId, predecessor.programId);
assert.equal(created.proposal.predecessor.durableRevision, predecessor.durableRevision);
assert.deepEqual(created.proposal.successor.programDefinition, successorDefinition.value,
  "the complete successor definition remains hash-covered and lossless");
assert.ok(created.proposal.proposalHash, "a preview pins the complete definition with a stable proposal hash");
for (const legacyKey of ["familyId", "blueprintId", "compilerContext", "successorCompilerContext", "strategy"]) {
  assert.equal(Object.hasOwn(created.proposal, legacyKey), false, `${legacyKey} is not a transition input anymore`);
}

const accepted = await Transition.validateProposal(JSON.parse(JSON.stringify(created.proposal)), current);
assert.equal(accepted.ok, true, "a reloaded proposal validates against the exact current canonical predecessor");
assert.equal(accepted.status, "preview");
assert.deepEqual(accepted.proposal.successor.programDefinition, successorDefinition.value);

const committed = Transition.commitRecord(accepted.proposal, {
  confirmedAt: "2026-10-06T10:01:00.000Z",
  archiveId: predecessor.programId,
});
assert.equal(committed.status, "committed");
assert.equal(committed.archiveId, predecessor.programId);
assert.equal(committed.proposalHash, created.proposal.proposalHash);
assert.equal(committed.predecessor.programId, predecessor.programId);
assert.equal(committed.successor.programId, "program-successor-067");

const staleRevision = await Transition.validateProposal(created.proposal, {
  ...current,
  predecessor: { ...predecessor, durableRevision: predecessor.durableRevision + 1 },
});
assert.equal(staleRevision.ok, false);
assert.equal(staleRevision.status, "stale", "a concurrent durable replacement is distinguished from invalid data");

const staleDefinition = await Transition.validateProposal(created.proposal, {
  ...current,
  predecessor: { ...predecessor, programDefinition: successorDefinition.value },
});
assert.equal(staleDefinition.ok, false);
assert.equal(staleDefinition.status, "stale", "same id and revision with a changed definition is stale");

const staleCustomDefinitions = await Transition.validateProposal(created.proposal, {
  ...current,
  predecessor: {
    ...predecessor,
    customExerciseDefinitions: [{
      id: "custom:unused-but-device-local",
      name: "User-owned movement",
      namePt: "Movimento pessoal",
      equipment: ["machine"], primary: "", secondary: "", notes: "",
      metricIds: [], metricDefinitions: [],
    }],
  },
});
assert.equal(staleCustomDefinitions.ok, false,
  "a custom-definition registry change stales the replacement snapshot even when current slots do not reference that custom ID");
assert.equal(staleCustomDefinitions.status, "stale");

const tampered = JSON.parse(JSON.stringify(created.proposal));
const firstSet = tampered.successor.programDefinition.days.find((day) => day.kind === "training")
  .slots[0].prescriptionsByCycle[0].sets[0];
firstSet.targets.reps.min += 1;
const tamperedBefore = JSON.stringify(tampered);
const rejectedTamper = await Transition.validateProposal(tampered, current);
assert.equal(rejectedTamper.ok, false, "tampering with an authored prescription invalidates its hash");
assert.equal(rejectedTamper.status, "invalid");
assert.equal(JSON.stringify(tampered), tamperedBefore, "validation never mutates untrusted proposal bytes");

const legacyFamilyProposal = {
  schemaVersion: 1,
  kind: "replace_family",
  status: "preview",
  transitionId: "legacy-transition",
  predecessor: { programId: predecessor.programId, durableRevision: predecessor.durableRevision },
  successor: { programId: "legacy-successor", familyId: "growth", blueprintId: "growth_3_v1" },
};
const rejectedLegacy = await Transition.validateProposal(legacyFamilyProposal, current);
assert.equal(rejectedLegacy.ok, false, "obsolete family/blueprint proposals are refused instead of mapped forward");
assert.equal(rejectedLegacy.status, "invalid");

// Block-end Review transitions derive a successor from the stored definition.
// These are algorithmic boundaries (set floors, cycle insertion, regeneration
// eligibility) the browser journey cannot enumerate, so they are proved here.
assert.equal(typeof Transition.deriveSuccessor, "function", "Review changes derive successors from canonical definitions");
const base = predecessorDefinition.value;
const trainingDays = (definition) => definition.days.filter((day) => day.kind === "training").length;
const slotsOf = (definition) => definition.days.flatMap((day) => day.slots);
const derive = (change, definition = base, custom = []) => Transition.deriveSuccessor({
  change, programDefinition: definition, customExerciseDefinitions: custom, catalogSnapshot,
});

const fewer = derive({ kind: "fewer_days", daysPerWeek: 3 });
assert.equal(fewer.ok, true, `fewer days regenerates a generated program: ${fewer.code || ""}`);
assert.equal(trainingDays(fewer.value.programDefinition), 3, "the successor trains on the requested number of days");
assert.equal(fewer.value.programDefinition.request.daysPerWeek, 3);
assert.equal(fewer.value.programDefinition.seed, base.seed, "regeneration keeps the program seed");
assert.equal(Compiler.validateProgramDefinition(fewer.value.programDefinition, catalogSnapshot, []).ok, true);
const keptExercises = new Set(slotsOf(base).map((slot) => slot.exerciseId));
assert.ok(slotsOf(fewer.value.programDefinition).filter((slot) => keptExercises.has(slot.exerciseId)).length >=
  Math.min(slotsOf(fewer.value.programDefinition).length, 6), "regeneration prefers the movements already in the program");
assert.equal(derive({ kind: "fewer_days", daysPerWeek: 4 }).code, "not_fewer_days", "the same day count is not a repair");
assert.equal(derive({ kind: "fewer_days", daysPerWeek: 1 }).code, "days_unsupported", "the generator supports two to six days");

const shorter = derive({ kind: "shorter_sessions", sessionMinutes: 45 });
assert.equal(shorter.ok, true, `shorter sessions regenerate under a lower ceiling: ${shorter.code || ""}`);
assert.equal(shorter.value.programDefinition.request.timeCeilingMinutes, 40, "minutes round down to the generator's ceiling buckets");
assert.equal(derive({ kind: "shorter_sessions", sessionMinutes: 120 }).code, "not_shorter_sessions");
assert.equal(derive({ kind: "shorter_sessions", sessionMinutes: 10 }).code, "minutes_unsupported");

const setCounts = (definition) => slotsOf(definition).map((slot) => [slot.id, slot.role,
  slot.prescriptionsByCycle.map((cycle) => cycle.sets.length)]);
const reduced = derive({ kind: "reduce_volume" });
assert.equal(reduced.ok, true, `volume reduction applies to accessory work: ${reduced.code || ""}`);
assert.equal(Compiler.validateProgramDefinition(reduced.value.programDefinition, catalogSnapshot, []).ok, true);
const beforeCounts = new Map(setCounts(base).map(([id, role, counts]) => [id, { role, counts }]));
for (const [id, role, counts] of setCounts(reduced.value.programDefinition)) {
  const before = beforeCounts.get(id);
  if (/PrimaryCompound|SecondaryCompound/.test(role)) {
    assert.deepEqual(counts, before.counts, `${role} work is protected from volume reduction`);
  } else {
    counts.forEach((count, index) => assert.equal(count, Math.max(1, before.counts[index] - 1),
      "accessory work loses one set per cycle with a one-set floor"));
  }
}
let floor = base;
for (let pass = 0; pass < 6; pass++) {
  const next = derive({ kind: "reduce_volume" }, floor);
  if (!next.ok) { assert.equal(next.code, "volume_floor", "volume reduction stops at the one-set floor"); break; }
  floor = next.value.programDefinition;
}

const recovery = derive({ kind: "recovery_week" });
assert.equal(recovery.ok, true, `a recovery week is an explicit deload cycle: ${recovery.code || ""}`);
const recovered = recovery.value.programDefinition;
assert.equal(recovered.cycles, base.cycles + 1, "the recovery week is inserted before the next block's cycles");
assert.deepEqual(recovered.deloadCycles, [1, ...base.deloadCycles.map((cycle) => cycle + 1)]);
assert.equal(Compiler.validateProgramDefinition(recovered, catalogSnapshot, []).ok, true);
for (const [slotIndex, slot] of slotsOf(recovered).entries()) {
  const original = slotsOf(base)[slotIndex];
  const [deload, ...rest] = slot.prescriptionsByCycle;
  assert.equal(deload.sets.length, Math.ceil(original.prescriptionsByCycle[0].sets.length / 2), "deload halves sets, rounding up");
  deload.sets.forEach((set, index) => {
    const source = original.prescriptionsByCycle[0].sets[index];
    assert.equal(set.rir, source.rir == null ? null : Math.min(4, source.rir + 2), "deload adds two RIR, capped at four");
    assert.deepEqual(set.targets, source.targets, "deload keeps the targets");
    assert.equal(set.provenance.deload, true);
  });
  assert.deepEqual(rest.map((cycle) => cycle.sets.map((set) => set.targets)),
    original.prescriptionsByCycle.map((cycle) => cycle.sets.map((set) => set.targets)), "the training cycles follow unchanged");
}
const full = { ...base, cycles: 12, request: { ...base.request, cycles: 12 } };
full.days = base.days.map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot,
  prescriptionsByCycle: Array.from({ length: 12 }, (_, index) => ({ cycleIndex: index + 1,
    sets: slot.prescriptionsByCycle[0].sets.map((set) => ({ ...set, id: `${set.id}-c${index + 1}`, cycleIndex: index + 1 })) })) })) }));
assert.equal(derive({ kind: "recovery_week" }, full).code, "cycles_limit", "a twelve-cycle program has no room for another cycle");

const manualBase = JSON.parse(JSON.stringify(base));
manualBase.generatorVersion = "manual@1"; manualBase.seed = "manual"; manualBase.request = {};
manualBase.provenance = { source: "manual", policyVersion: "manual@1" };
assert.equal(derive({ kind: "fewer_days", daysPerWeek: 3 }, manualBase).code, "manual_program",
  "a Build program has no generator request to regenerate, so it goes to guided editing");
assert.equal(derive({ kind: "unknown" }).code, "unsupported_change");

const changedProposal = await Transition.createReplacementProposal({
  transitionId: "transition-plan067-volume",
  createdAt: "2026-10-06T10:00:00.000Z",
  predecessor,
  successor: { programId: "program-volume-067", programDefinition: reduced.value.programDefinition, customExerciseDefinitions: [] },
  change: { kind: "reduce_volume" },
  catalogSnapshot,
});
assert.equal(changedProposal.ok, true, `a derived successor is previewable: ${changedProposal.code || ""}`);
assert.deepEqual(changedProposal.proposal.change, { kind: "reduce_volume" }, "the change is part of the hashed proposal");
assert.equal((await Transition.validateProposal(JSON.parse(JSON.stringify(changedProposal.proposal)), current)).ok, true);
const mismatched = await Transition.createReplacementProposal({
  transitionId: "transition-plan067-mismatch",
  createdAt: "2026-10-06T10:00:00.000Z",
  predecessor,
  successor: { programId: "program-mismatch-067", programDefinition: successorDefinition.value, customExerciseDefinitions: [] },
  change: { kind: "reduce_volume" },
  catalogSnapshot,
});
assert.equal(mismatched.ok, false, "a change-labelled proposal must carry exactly the derived successor");
assert.equal(mismatched.code, "successor_derivation_mismatch");

console.log("PASS Plan 067 canonical program transition contract");
