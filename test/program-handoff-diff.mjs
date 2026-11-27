#!/usr/bin/env node
// Plan 086 slice 3: the changes a received program makes to the current one,
// from the two ProgramDefinitions (program-transition.js diffProgramDefinitions).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Transition = require(path.join(root, "program-transition.js"));
const Compiler = require(path.join(root, "program-compiler.js"));

const catalogSnapshot = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/app_file.json"), "utf8"));
const gym = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/gym.json"), "utf8"));
const observations = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/programs.json"), "utf8"));
const observed = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const request = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observed.map((id) =>
    [id, [...catalogSnapshot.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 7, deloadCycles: [],
};
const generated = Compiler.generateProgram(request, catalogSnapshot);
assert.equal(generated.ok, true, "the current program is a real compiler output");
const current = generated.value;
const copy = (value) => JSON.parse(JSON.stringify(value));
const training = (definition) => definition.days.filter((day) => day.kind === "training");
let checks = 0;
const check = (fn, label) => { fn(); checks++; console.log(`ok ${checks} - ${label}`); };

check(() => {
  const same = Transition.diffProgramDefinitions(current, copy(current));
  assert.equal(same.ok, true);
  assert.equal(same.related, true);
  assert.deepEqual(same.changes, []);
}, "an identical program has no changes");

check(() => {
  const next = copy(current);
  const [first, second] = training(next);
  const swapped = first.slots[0];
  const previous = swapped.exerciseId;
  const replacement = catalogSnapshot.exercises.find((entry) => entry.id !== previous &&
    !next.days.some((day) => day.slots.some((slot) => slot.exerciseId === entry.id))).id;
  swapped.exerciseId = replacement;
  const changed = second.slots[1];
  changed.prescriptionsByCycle[0].sets.push(copy(changed.prescriptionsByCycle[0].sets[0]));
  const removed = second.slots.pop();
  const added = { ...copy(first.slots[1]), id: "trainer-added-slot", order: first.slots.length + 1 };
  first.slots.push(added);
  const diff = Transition.diffProgramDefinitions(current, next);
  assert.equal(diff.related, true);
  assert.deepEqual(diff.changes.map(({ kind, slotId }) => [kind, slotId]), [
    ["swapped", swapped.id], ["added", added.id], ["changed", changed.id], ["removed", removed.id],
  ], "received order, removed slots after their day's received slots");
  assert.equal(diff.changes[0].previousExerciseId, previous);
  assert.equal(diff.changes[0].exerciseId, replacement);
  assert.ok(Object.isFrozen(diff.changes) && Object.isFrozen(diff.changes[0]));
}, "swapped, added, changed and removed slots, in the received program's order");

check(() => {
  const next = copy(current);
  const [first] = training(next);
  first.slots.reverse().forEach((slot, index) => { slot.order = index + 1; });
  assert.deepEqual(Transition.diffProgramDefinitions(current, next).changes, [], "reordering alone is not a change");
  const renamed = copy(current);
  training(renamed)[0].slots[0].displayName = "Trainer's name for it";
  assert.deepEqual(Transition.diffProgramDefinitions(current, renamed).changes.map((change) => change.kind), ["changed"]);
}, "order is not a change; the lifter-visible name is");

check(() => {
  const other = copy(current);
  for (const day of training(other)) for (const slot of day.slots) slot.id = `other-${slot.id}`;
  const diff = Transition.diffProgramDefinitions(current, other);
  assert.equal(diff.related, false, "no shared slot: a new program, not an update");
  assert.equal(diff.changes.filter((change) => change.kind === "added").length,
    training(other).reduce((sum, day) => sum + day.slots.length, 0));
}, "a program that shares no slot is unrelated");

check(() => {
  assert.equal(Transition.diffProgramDefinitions(null, current).ok, false);
  assert.equal(Transition.diffProgramDefinitions(current, { days: "x" }).ok, false);
}, "malformed input is refused");

console.log(`program handoff diff: ${checks} checks passed`);
