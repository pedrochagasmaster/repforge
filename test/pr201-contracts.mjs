#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const SharedSetup = require("../shared-setup.js");
const I18N = require("../i18n.js");
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

  const nestedSelected = structuredClone(state);
  nestedSelected.result.selected.extra = true;
  assert.equal(Entry.normalizeSetupDraft(nestedSelected).ok, false);

  const wrongSelected = structuredClone(state);
  wrongSelected.result.selected.id = 42;
  assert.equal(Entry.normalizeSetupDraft(wrongSelected).ok, false);

  const nestedPreview = structuredClone(state);
  nestedPreview.result.preview.extra = true;
  assert.equal(Entry.normalizeSetupDraft(nestedPreview).ok, false);

  const wrongPreview = structuredClone(state);
  wrongPreview.result.preview.program = {};
  assert.equal(Entry.normalizeSetupDraft(wrongPreview).ok, false);

  const nestedDay = structuredClone(state);
  nestedDay.result.preview.days = [{ id: "day-1", exercises: [], extra: true }];
  assert.equal(Entry.normalizeSetupDraft(nestedDay).ok, false);

  const nestedProgression = structuredClone(state);
  nestedProgression.result.preview.program = [{ progression: { schemaVersion: 1, strategy: { id: "range", version: 1, params: {}, extra: true }, modifiers: [] } }];
  assert.equal(Entry.normalizeSetupDraft(nestedProgression).ok, false);

  const nestedRelation = structuredClone(state);
  nestedRelation.result.preview.progressionRelations = [{ id: "r", movementId: "library:rw_mc", members: [], extra: true }];
  assert.equal(Entry.normalizeSetupDraft(nestedRelation).ok, false);

  const nestedStructure = structuredClone(state);
  nestedStructure.result.preview.programStructure = { schemaVersion: 1, days: [], extra: true };
  assert.equal(Entry.normalizeSetupDraft(nestedStructure).ok, false);
});

test("persisted entry muscle controls use the authoritative adapter vocabulary", () => {
  const state = previewState();
  for (const key of ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles"]) {
    const tampered = structuredClone(state);
    tampered.answers[key] = ["core"];
    assert.equal(Entry.normalizeSetupDraft(tampered).ok, false, key);
  }
  const movement = structuredClone(state);
  movement.answers.priorityMovements = ["invented_pattern"];
  assert.equal(Entry.normalizeSetupDraft(movement).ok, false);
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

test("app day merge and entry controls consume adapter-owned vocabularies", async () => {
  const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /RepForgeProgramEntryAdapter\.DAY_MERGE_VOCABULARY/);
  assert.match(app, /ENTRY_MUSCLES=ProgramEntryAdapter\.ENTRY_MUSCLES/);
  assert.match(app, /ENTRY_MOVEMENTS=ProgramEntryAdapter\.ENTRY_MOVEMENTS/);
  assert.doesNotMatch(app, /const DAY_TYPES\s*=\s*\{/);
});

test("production-shaped results round-trip through each route's closed schema", () => {
  const services = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });
  const common = {
    desiredResult: "balanced", structuredExperience: "6_to_24m", recentConsistency: "most",
    daysPerWeek: 2, sessionMinutes: 60, preferredRestSeconds: 120,
    environment: { kind: "commercial_gym" }, primaryMuscles: ["back"], priorityMovements: [], exerciseConstraints: [],
  };
  const row = { id: "row-1", day: "Day 1", order: 1, name: "A movement", sets: 3, min: 6, max: 10, notes: "A deliberately long coaching note that must remain intact when the setup draft is resumed; it exceeds eighty characters.", libraryId: "rw_mc" };
  const cases = {
    recommend: { answers: common, result: services.compile({ mode: "recommend", answers: common }) },
    custom: (() => { const answers = { ...common, splitPreference: services.splitChoices(common).choices[0].id }; return { answers, result: services.compile({ mode: "custom", answers }) }; })(),
    browse: (() => { const card = services.browseCatalogue(common)[0]; return { answers: { daysPerWeek: 2, sessionMinutes: 60, environment: { kind: "commercial_gym" }, catalogueSelection: card.id }, result: { fingerprint: card.fingerprint, selected: { id: card.id, familyId: card.familyId, daysPerWeek: card.daysPerWeek, blueprintId: card.id }, preview: card.preview } }; })(),
    build: { answers: { programName: "Manual", daysPerWeek: 2 }, result: services.buildEmptyProgram({ programName: "Manual", daysPerWeek: 2 }) },
    import: { answers: { importReady: true }, result: { fingerprint: "import-fixture", selected: { id: "import", source: "import" }, preview: { source: "import", format: "json", program: [row], days: [{ id: "Day 1", exercises: [{ ...row }] }], programStructure: null, progressionRelations: [], progressionModifiers: [], customExercises: [{ id: "custom:local", name: "Local", namePt: "Local", equipment: ["machine"], primary: "Back", secondary: "", notes: "", archived: false, patterns: [], beginnerFriendly: true, custom: true, created: "2026-08-31T00:00:00.000Z" }] } } },
    shared: { answers: { sharedReady: true }, result: { fingerprint: "shared-fixture", selected: { id: "shared", source: "shared" }, preview: { source: "shared", frequency: 2, program: [row], days: [{ id: "Day 1", exercises: [{ ...row }] }], programStructure: null, progressionRelations: [], customExercises: [], primaryMuscles: [], sharedMeta: { name: "Shared", daysPerWeek: 2, equipment: ["machines"], priorityMuscles: ["Chest"] }, sharedSettings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg", lang: "pt", rirMode: "numeric" }, sharedImport: null } } },
  };
  for (const [route, fixture] of Object.entries(cases)) {
    let state = Entry.selectRoute(Entry.createState({ draftId: `roundtrip-${route}`, now: "2026-08-31T00:00:00.000Z", versions: VERSIONS }), route);
    state = Entry.setAnswers(state, fixture.answers);
    const source = fixture.result;
    const result = route === "recommend" || route === "custom"
      ? { fingerprint: source.fingerprint, name: source.name, namePt: source.namePt, selected: source.selected, candidates: source.candidates, alternative: null, preview: source.preview, telemetry: source.telemetry, explanation: source.explanation }
      : route === "build" ? { fingerprint: source.fingerprint, selected: { id: "manual_build", source: "manual_build" }, preview: source.preview, name: source.name }
      : source;
    try { state = Entry.setResult(state, result); } catch (error) { throw new Error(`${route}: ${error.message}`); }
    const checked = Entry.normalizeSetupDraft(state);
    assert.equal(checked.ok, true, `${route}: ${checked.issues?.join(", ")}`);
    assert.deepEqual(checked.value, state, route);
  }
});

test("import exercise copy uses the locale's singular form", () => {
  I18N.setLang("pt");
  assert.equal(I18N.t("import.file", { name: "x.json", n: 1, exercise: I18N.tp(1, "lift") }), "x.json · 1 exercício");
  assert.equal(I18N.t("import.file", { name: "x.json", n: 2, exercise: I18N.tp(2, "lift") }), "x.json · 2 exercícios");
  I18N.setLang("en");
});
