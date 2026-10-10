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

// A Review regeneration carries the lifter's block edits onto the movements
// that survive it, never past the session ceiling. Which edits exist, which
// survive and which cannot fit are combinatorial boundaries the browser
// journey samples only once, so each outcome is proved here.
const preferredNow = [...new Set(slotsOf(base).map((slot) => slot.exerciseId))].sort();
const regenerated = (overrides) => {
  const generatorRequest = { ...base.request, ...overrides, preferredExerciseIds: preferredNow };
  delete generatorRequest.seed;
  const generated = Compiler.generateProgram(generatorRequest, catalogSnapshot, base.seed);
  assert.equal(generated.ok, true, "the bare regeneration is a real compiler output");
  return generated.value;
};
const threeDays = regenerated({ daysPerWeek: 3, split: "auto" });
const fortyMinutes = regenerated({ timeCeilingMinutes: 40 });
const exerciseIds = (definition) => new Set(slotsOf(definition).map((slot) => slot.exerciseId));
const slotFor = (definition, exerciseId) => slotsOf(definition).find((slot) => slot.exerciseId === exerciseId);
const cycleOf = (slot, cycleIndex) => slot.prescriptionsByCycle.find((cycle) => cycle.cycleIndex === cycleIndex);
// The installed editor's set-count edit: duplicate the last set as a manual set.
const addSets = (slot, cycleIndex, count) => {
  const cycle = cycleOf(slot, cycleIndex);
  for (let added = 0; added < count; added++) {
    cycle.sets.push({ ...structuredClone(cycle.sets.at(-1)), id: `edit-${slot.id}-${cycleIndex}-${cycle.sets.length + 1}`,
      setIndex: cycle.sets.length + 1, rir: null, status: "manual", provenance: { source: "manual", policyVersion: "manual@1" } });
  }
};
const edited = (pick, edit) => {
  const definition = structuredClone(base);
  const slot = slotsOf(definition).find(pick);
  assert.ok(slot, "the fixture has a slot to edit");
  edit(slot);
  return { definition, slot };
};
const trainingOf = (definition) => definition.days.filter((day) => day.kind === "training");
const cycleIndexes = (definition) => Array.from({ length: definition.cycles }, (_, index) => index + 1);
const fitsEveryWeek = (definition, generated) => trainingOf(definition).every((day) => {
  const fresh = generated.days.find((candidate) => candidate.id === day.id);
  return cycleIndexes(definition).every((cycleIndex) => Compiler.estimateDaySeconds(day, cycleIndex) <=
    Math.max(definition.request.timeCeilingMinutes * 60, Compiler.estimateDaySeconds(fresh, cycleIndex)));
});

assert.deepEqual(fewer.value.programDefinition, threeDays, "an unedited program regenerates to exactly the generator's output");
assert.deepEqual(fewer.value.carry, { identified: true, entries: [] }, "an unedited program has no edits to carry");
assert.deepEqual(shorter.value.carry, { identified: true, entries: [] });

// Kept: a compound's extra set in week two and a longer rest in week one.
const keptEdit = edited((slot) => /PrimaryCompound$/.test(slot.role) && exerciseIds(threeDays).has(slot.exerciseId), (slot) => {
  addSets(slot, 2, 1);
  cycleOf(slot, 1).sets[0].restSeconds = 150;
  cycleOf(slot, 1).sets[0].status = "manual";
});
const kept = derive({ kind: "fewer_days", daysPerWeek: 3 }, keptEdit.definition);
assert.equal(kept.ok, true, `an edited program regenerates: ${kept.code || ""}`);
const keptSlot = slotFor(kept.value.programDefinition, keptEdit.slot.exerciseId);
const freshSlot = slotFor(threeDays, keptEdit.slot.exerciseId);
assert.equal(cycleOf(keptSlot, 2).sets.length, cycleOf(keptEdit.slot, 2).sets.length, "the week-two set count is carried");
assert.equal(cycleOf(keptSlot, 1).sets[0].restSeconds, 150, "the week-one rest edit is carried");
assert.deepEqual(cycleOf(keptSlot, 1).sets[0].targets, cycleOf(freshSlot, 1).sets[0].targets,
  "fields the lifter did not edit keep the generator's new value");
assert.deepEqual(cycleOf(keptSlot, 3), cycleOf(freshSlot, 3), "a week without edits is the generator's");
assert.deepEqual(kept.value.carry, { identified: true, entries: [{
  exerciseId: keptEdit.slot.exerciseId, predecessorSlotId: keptEdit.slot.id, successorSlotId: keptSlot.id,
  outcome: "kept", reason: null, cycles: [
    { cycleIndex: 1, fields: ["restSeconds"], requestedSets: cycleOf(keptEdit.slot, 1).sets.length, sets: cycleOf(keptSlot, 1).sets.length },
    { cycleIndex: 2, fields: ["sets"], requestedSets: cycleOf(keptEdit.slot, 2).sets.length, sets: cycleOf(keptEdit.slot, 2).sets.length },
  ],
}] }, "the carry report names the kept edits by week");
assert.equal(Compiler.validateProgramDefinition(kept.value.programDefinition, catalogSnapshot, []).ok, true);
assert.ok(fitsEveryWeek(kept.value.programDefinition, threeDays), "a carried edit keeps every week inside the ceiling");
const keptPredecessor = { ...predecessor, programDefinition: keptEdit.definition };
const keptProposal = await Transition.createReplacementProposal({
  transitionId: "transition-plan067-carry",
  createdAt: "2026-10-06T10:00:00.000Z",
  predecessor: keptPredecessor,
  successor: { programId: "program-carry-067", programDefinition: kept.value.programDefinition, customExerciseDefinitions: [] },
  change: { kind: "fewer_days", daysPerWeek: 3 },
  catalogSnapshot,
});
assert.equal(keptProposal.ok, true, `the carried successor is the derivation the proposal pins: ${keptProposal.code || ""}`);
assert.equal((await Transition.validateProposal(JSON.parse(JSON.stringify(keptProposal.proposal)),
  { predecessor: keptPredecessor, catalogSnapshot })).ok, true, "re-deriving at confirmation reproduces the carried successor");
const bareProposal = await Transition.createReplacementProposal({
  transitionId: "transition-plan067-bare",
  createdAt: "2026-10-06T10:00:00.000Z",
  predecessor: keptPredecessor,
  successor: { programId: "program-bare-067", programDefinition: threeDays, customExerciseDefinitions: [] },
  change: { kind: "fewer_days", daysPerWeek: 3 },
  catalogSnapshot,
});
assert.equal(bareProposal.code, "successor_derivation_mismatch", "a successor that drops the edits is not the derivation");

// A movement the lifter added a second time by hand does not take the
// generated slot's place: the generated slot keeps its edit, and the manual
// copy, which regeneration does not reproduce, is reported as removed.
const duplicated = structuredClone(keptEdit.definition);
const duplicateDay = trainingOf(duplicated).find((day) => day.slots.some((slot) => slot.id === keptEdit.slot.id));
const original = duplicateDay.slots.find((slot) => slot.id === keptEdit.slot.id);
duplicateDay.slots.unshift({ ...structuredClone(original), id: "manual-duplicate-slot", role: "manual",
  prescriptionsByCycle: original.prescriptionsByCycle.map((cycle) => ({ cycleIndex: cycle.cycleIndex,
    sets: [{ ...structuredClone(cycle.sets[0]), id: `manual-duplicate-${cycle.cycleIndex}`, setIndex: 1, restSeconds: 999,
      status: "manual", provenance: { source: "manual", policyVersion: "manual@1" } }] })) });
duplicateDay.slots.forEach((slot, index) => { slot.order = index + 1; });
assert.equal(Compiler.validateProgramDefinition(duplicated, catalogSnapshot, []).ok, true, "a manual copy of a generated movement is a valid program");
const withDuplicate = derive({ kind: "fewer_days", daysPerWeek: 3 }, duplicated);
assert.equal(withDuplicate.ok, true, `a program with a manual copy regenerates: ${withDuplicate.code || ""}`);
assert.deepEqual(slotFor(withDuplicate.value.programDefinition, keptEdit.slot.exerciseId), keptSlot,
  "the generated slot's edit is carried, untouched by the manual copy");
assert.deepEqual(withDuplicate.value.carry.entries.map(({ predecessorSlotId, outcome, reason }) => ({ predecessorSlotId, outcome, reason })), [
  { predecessorSlotId: "manual-duplicate-slot", outcome: "dropped", reason: "slot_removed" },
  { predecessorSlotId: keptEdit.slot.id, outcome: "kept", reason: null },
], "the manual copy is reported as no longer in the program");

// Clamped: more extra accessory sets than the shorter session has room for.
const slack = (definition, slot) => {
  const day = trainingOf(definition).find((candidate) => candidate.slots.includes(slot));
  return definition.request.timeCeilingMinutes * 60 - Compiler.estimateDaySeconds(day, 1);
};
const roomy = slotsOf(fortyMinutes).filter((slot) => /Accessory$/.test(slot.role) && exerciseIds(base).has(slot.exerciseId))
  .sort((left, right) => slack(fortyMinutes, right) - slack(fortyMinutes, left))[0];
assert.ok(roomy && slack(fortyMinutes, roomy) >= 240, "the fixture leaves one forty-minute day room for an extra set");
const clampedEdit = edited((slot) => slot.exerciseId === roomy.exerciseId, (slot) => addSets(slot, 1, 12));
const clamped = derive({ kind: "shorter_sessions", sessionMinutes: 45 }, clampedEdit.definition);
assert.equal(clamped.ok, true, `an over-long edit still regenerates: ${clamped.code || ""}`);
const clampedSlot = slotFor(clamped.value.programDefinition, roomy.exerciseId);
const [clampedEntry] = clamped.value.carry.entries;
assert.equal(clampedEntry.outcome, "clamped", "an edit that only partly fits is clamped");
assert.ok(cycleOf(clampedSlot, 1).sets.length > cycleOf(roomy, 1).sets.length &&
  cycleOf(clampedSlot, 1).sets.length < cycleOf(clampedEdit.slot, 1).sets.length,
"the clamped week keeps as many of the extra sets as fit, and no more");
assert.deepEqual(clampedEntry.cycles, [{ cycleIndex: 1, fields: ["sets"],
  requestedSets: cycleOf(clampedEdit.slot, 1).sets.length, sets: cycleOf(clampedSlot, 1).sets.length }]);
assert.ok(fitsEveryWeek(clamped.value.programDefinition, fortyMinutes), "the clamped program stays inside the new ceiling");
const oneMore = structuredClone(clamped.value.programDefinition);
addSets(slotFor(oneMore, roomy.exerciseId), 1, 1);
assert.equal(fitsEveryWeek(oneMore, fortyMinutes), false, "one more carried set would break the ceiling");

// Not carried: a rest edit too long for the shorter session keeps the generator's value.
const restEdit = edited((slot) => /PrimaryCompound$/.test(slot.role) && exerciseIds(fortyMinutes).has(slot.exerciseId), (slot) => {
  for (const set of cycleOf(slot, 1).sets) { set.restSeconds = 3600; set.status = "manual"; }
});
const overLimit = derive({ kind: "shorter_sessions", sessionMinutes: 45 }, restEdit.definition);
assert.equal(overLimit.ok, true, `an edit that cannot fit does not block the change: ${overLimit.code || ""}`);
assert.deepEqual(overLimit.value.programDefinition, fortyMinutes, "the slot keeps the generator's prescription");
assert.deepEqual(overLimit.value.carry.entries.map(({ outcome, reason, successorSlotId }) => ({ outcome, reason, successorSlotId })),
  [{ outcome: "dropped", reason: "over_session_limit", successorSlotId: slotFor(fortyMinutes, restEdit.slot.exerciseId).id }],
  "the edit is reported as not carried, over the session limit");

// An edit that cannot fit leaves its room to the next one on the same day.
const roomyDay = trainingOf(fortyMinutes).find((day) => day.slots.includes(roomy));
const neighbour = roomyDay.slots.find((slot) => !/Accessory$/.test(slot.role) && exerciseIds(base).has(slot.exerciseId));
assert.ok(neighbour, "the roomy day also holds a carried compound");
const sharedEdit = edited((slot) => slot.exerciseId === roomy.exerciseId, (slot) => addSets(slot, 1, 12));
for (const set of cycleOf(slotFor(sharedEdit.definition, neighbour.exerciseId), 1).sets) { set.restSeconds = 3600; set.status = "manual"; }
const shared = derive({ kind: "shorter_sessions", sessionMinutes: 45 }, sharedEdit.definition);
assert.deepEqual(shared.value.carry.entries.map(({ exerciseId, outcome }) => ({ exerciseId, outcome })).sort((a, b) =>
  a.exerciseId.localeCompare(b.exerciseId)), [{ exerciseId: neighbour.exerciseId, outcome: "dropped" },
  { exerciseId: roomy.exerciseId, outcome: "clamped" }].sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)));
assert.equal(cycleOf(slotFor(shared.value.programDefinition, roomy.exerciseId), 1).sets.length,
  cycleOf(clampedSlot, 1).sets.length, "the dropped rest edit does not cost the accessory any of the sets that fit");

// Dropped: an edit on a movement the regeneration removes.
const removedEdit = edited((slot) => !exerciseIds(fortyMinutes).has(slot.exerciseId), (slot) => addSets(slot, 1, 1));
const removed = derive({ kind: "shorter_sessions", sessionMinutes: 45 }, removedEdit.definition);
assert.equal(removed.ok, true);
assert.deepEqual(removed.value.programDefinition, fortyMinutes, "nothing of a removed slot's edit reaches the successor");
assert.deepEqual(removed.value.carry.entries, [{
  exerciseId: removedEdit.slot.exerciseId, predecessorSlotId: removedEdit.slot.id, successorSlotId: null,
  outcome: "dropped", reason: "slot_removed", cycles: [{ cycleIndex: 1, fields: ["sets"],
    requestedSets: cycleOf(removedEdit.slot, 1).sets.length, sets: null }],
}], "the edit on a removed slot is reported");

// Unidentified: a program from another generator version cannot be told apart from its edits.
const foreign = structuredClone(keptEdit.definition);
foreign.generatorVersion = "066.9";
const unidentified = derive({ kind: "fewer_days", daysPerWeek: 3 }, foreign);
assert.equal(unidentified.ok, true);
assert.deepEqual(unidentified.value.carry, { identified: false, entries: [] }, "unidentifiable edits are reported, not guessed");
assert.deepEqual(unidentified.value.programDefinition, threeDays);

console.log("PASS Plan 067 canonical program transition contract");
