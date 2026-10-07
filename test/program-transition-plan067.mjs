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

console.log("PASS Plan 067 canonical program transition contract");
