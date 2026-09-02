#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const SharedSetup = require("../shared-setup.js");
const Entry = require("../program-entry.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const gymContext = (familyId, frequency) => ({
  schemaVersion: 1,
  familyId,
  frequency,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
});

assert.equal(Compiler.validateBlueprints().ok, true);
assert.equal(Object.keys(Compiler.DAY_DISPLAY_NAME_KEYS).length, 80);
for (const familyId of Compiler.FAMILY_IDS) {
  for (const frequency of Compiler.FREQUENCIES) {
    const compiled = Compiler.compile(gymContext(familyId, frequency), EXERCISE_LIBRARY);
    assert.equal(compiled.kind, "compiled", `${familyId} ${frequency}`);
    assert.deepEqual(
      compiled.days.map((day) => day.displayNameKey),
      compiled.programStructure.days.map((day) => day.displayNameKey),
      `${familyId} ${frequency} keeps day keys in the instance and persisted structure`,
    );
    assert(compiled.days.every((day) => day.displayNameKey === Compiler.dayDisplayNameKey(day.dayId)));
  }
}

const balanced = Compiler.compile(gymContext("balanced", 4), EXERCISE_LIBRARY);
const legacyProgram = balanced.program.map(({ dayId, ...exercise }) => ({ ...exercise, dayId }));
const legacyStructure = {
  ...balanced.programStructure,
  days: balanced.programStructure.days.map(({ dayId, label, order }) => ({ dayId, label, order })),
};
const migrated = Compiler.migrateLegacyStructure(legacyProgram, legacyStructure);
assert.deepEqual(
  migrated.structure.days.map(({ displayNameKey }) => displayNameKey),
  balanced.programStructure.days.map(({ displayNameKey }) => displayNameKey),
  "legacy generated structures gain keys without changing compiler labels",
);

const renamedLabel = "Leg day, easy to recognize";
const renamed = Compiler.migrateLegacyStructure(
  legacyProgram.map((exercise) => exercise.dayId === balanced.programStructure.days[0].dayId
    ? { ...exercise, day: renamedLabel } : exercise),
  {
    ...legacyStructure,
    days: legacyStructure.days.map((day, index) => index === 0 ? { ...day, label: renamedLabel } : day),
  },
);
assert.equal(renamed.structure.days[0].dayId, balanced.programStructure.days[0].dayId);
assert.equal(renamed.structure.days[0].nameOverride, renamedLabel,
  "a pre-key custom rename is retained as an explicit override");
assert.equal(renamed.structure.days[0].displayNameKey, "program.day.balanced_4_d1");

const sharedPayload = {
  kind: SharedSetup.KIND,
  version: SharedSetup.VERSION,
  program: {
    meta: {
      name: "Balanced shared",
      goal: "strength_hypertrophy",
      experience: "intermediate",
      daysPerWeek: 4,
      splitType: "full_body",
      equipment: ["barbells", "dumbbells", "machines", "cables"],
      priorityMuscles: [],
      sessionLength: "long",
      mesocycleLengthWeeks: 6,
      programStructure: renamed.structure,
    },
    exercises: renamed.program,
    customExercises: [],
  },
  settings: {
    jumpPct: 2.5, minJump: 2.5, rirHigh: 3, hardRir: 1, restSec: 120,
    unit: "kg", lang: "en", rirMode: "numeric",
  },
};
const sharedOptions = { builtInIds: new Set(EXERCISE_LIBRARY.map((entry) => entry.id)) };
assert.equal(SharedSetup.validate(sharedPayload, sharedOptions).ok, true,
  "shared payload accepts localized day metadata");
const sharedEncoded = await SharedSetup.encode(sharedPayload, sharedOptions);
assert.equal(sharedEncoded.ok, true, sharedEncoded.code);
const sharedDecoded = await SharedSetup.decode(sharedEncoded.value, sharedOptions);
assert.equal(sharedDecoded.ok, true, sharedDecoded.code);
assert.deepEqual(sharedDecoded.value.program.meta.programStructure.days, renamed.structure.days,
  "shared round trip keeps custom day name and stable display key");

const versions = {
  compiler: "2", family: "1", blueprint: "1", catalogue: "1", rules: "1",
  context: "2", progression: "range-1", recentConsistency: "1", simpleStart: "1",
};
let draft = Entry.createState({
  draftId: "day-name-draft",
  activeProgramRevisionAtStart: 0,
  now: "2026-09-02T00:00:00.000Z",
  versions,
});
draft = Entry.selectRoute(draft, "recommend");
draft = Entry.setAnswers(draft, {
  desiredResult: "balanced",
  structuredExperience: "6_to_24m",
  recentConsistency: "most",
  daysPerWeek: 4,
  sessionMinutes: 60,
  preferredRestSeconds: 120,
  environment: { kind: "commercial_gym" },
  primaryMuscles: [],
  priorityMovements: [],
  exerciseConstraints: [],
});
draft = Entry.setResult(draft, {
  fingerprint: "day-name-fixture",
  preview: {
    program: [{ id: "row", day: "Lower primary", dayId: "balanced_4_d1", order: 1, name: "Squat", sets: 3, min: 6, max: 10 }],
    programStructure: {
      schemaVersion: 1,
      days: [{ dayId: "balanced_4_d1", label: "Lower primary", order: 1,
        displayNameKey: "program.day.balanced_4_d1", nameOverride: "My lower day" }],
    },
  },
});
const accepted = Entry.normalizeSetupDraft(draft);
assert.equal(accepted.ok, true, accepted.issues?.join(", "));
const tampered = structuredClone(draft);
tampered.result.preview.programStructure.days[0].displayNameKey = "program.day.Knee_horizontal";
const rejected = Entry.normalizeSetupDraft(tampered);
assert.equal(rejected.ok, false);
assert(rejected.issues.some((issue) => issue.includes("displayNameKey:invalid")));

console.log("PASS program day names: stable keys, legacy overrides, and draft schema guard");
