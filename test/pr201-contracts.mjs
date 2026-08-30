#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const SharedSetup = require("../shared-setup.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const VERSIONS = {
  compiler: "2", family: "1", blueprint: "1", catalogue: "1", rules: "1",
  context: "2", progression: "range-1", recentConsistency: "1", simpleStart: "1",
};

function previewState() {
  let state = Entry.selectRoute(Entry.createState({
    draftId: "00000000-0000-4000-8000-000000000201",
    activeProgramRevisionAtStart: 7,
    now: "2026-08-30T00:00:00.000Z",
    versions: VERSIONS,
  }), "recommend");
  state = Entry.setAnswers(state, { desiredResult: "balanced" });
  state = Entry.setResult(state, {
    fingerprint: "candidate-1",
    selected: { id: "candidate-1" },
    preview: { source: "compiler", program: [{ day: "Day 1", name: "Press", sets: 2, min: 6, max: 10 }] },
  });
  return state;
}

test("persisted result is closed and bound to the normalized answers", () => {
  const state = previewState();
  assert.equal(Entry.normalizeSetupDraft(state).ok, true);

  const unknown = structuredClone(state);
  unknown.result.extra = true;
  assert.equal(Entry.normalizeSetupDraft(unknown).ok, false);

  const wrongAnswers = structuredClone(state);
  wrongAnswers.answers.desiredResult = "muscle_growth";
  assert.equal(Entry.normalizeSetupDraft(wrongAnswers).ok, false);

  const wrongRoute = structuredClone(state);
  wrongRoute.result.route = "custom";
  assert.equal(Entry.normalizeSetupDraft(wrongRoute).ok, false);

  const legacy = structuredClone(state);
  delete legacy.result.schemaVersion;
  delete legacy.result.route;
  delete legacy.result.answersFingerprint;
  const migrated = Entry.normalizeSetupDraft(legacy);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.value.result.route, "recommend");
  assert.equal(typeof migrated.value.result.answersFingerprint, "string");
});

test("recent-consistency and simple-start pins drift independently", () => {
  const state = previewState();
  const consistency = Entry.resumeSetupDraft(state, {
    currentVersions: { ...VERSIONS, recentConsistency: "2" },
  });
  assert.deepEqual(consistency.value.versionChanges, ["recentConsistency"]);
  const simpleStart = Entry.resumeSetupDraft(state, {
    currentVersions: { ...VERSIONS, simpleStart: "2" },
  });
  assert.deepEqual(simpleStart.value.versionChanges, ["simpleStart"]);
});

test("core is not offered as a priority control without an approved priority contract", () => {
  const base = {
    schemaVersion: 2, familyId: "growth", frequency: 5, sessionMinutes: 60,
    preferredRestSeconds: null, equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
    environment: ["safe_pull", "training_support"],
    loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
    preferences: [], dislikes: [], history: [], deEmphasizedMuscles: [], ignoredMuscles: [],
    priorityMovements: [], profile: "standard", recentConsistency: "consistent", reentryEnabled: false, weekNumber: 1,
  };
  const without = Compiler.compile({ ...base, primaryMuscles: [] }, EXERCISE_LIBRARY);
  const withCore = Compiler.compile({ ...base, primaryMuscles: ["core"] }, EXERCISE_LIBRARY);
  assert.equal(without.kind, "compiled");
  assert.equal(withCore.kind, "compiled");
  const core = withCore.days.flatMap((day) => day.slots).find((slot) => slot.templateId === "priority");
  assert.equal(core, undefined);
  const old = without.days.flatMap((day) => day.slots).find((slot) => slot.templateId === "priority");
  assert.equal(old, undefined);
});

test("shared setup validates executable progression parameters, not only their envelope", () => {
  const payload = {
    kind: "taurifer-shared-setup", version: 1,
    program: {
      meta: { name: "Shared", daysPerWeek: 2 },
      exercises: [{ id: "x", day: "Day 1", order: 1, name: "Press", sets: 2, min: 6, max: 10,
        progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: {} }, modifiers: [] } }],
    },
    settings: { unit: "kg", lang: "en", rirMode: "numeric" },
  };
  const result = SharedSetup.validate(payload, { builtInIds: new Set() });
  assert.equal(result.ok, false);
  assert.equal(result.issues.some((issue) => issue.includes("non_executable_parameters")), true);
});

test("entry vocabularies have one adapter authority and band is explicit-only", () => {
  assert.equal(Adapter.KNOWN_EQUIPMENT.includes("band"), true);
  assert.deepEqual(Adapter.KNOWN_CAPABILITIES, ["safe_pull", "training_support"]);
  assert.equal(Adapter.ENV_EQUIPMENT.commercial_gym.includes("band"), false);
  assert.equal(Adapter.ENTRY_MUSCLES.includes("core"), false);
});
