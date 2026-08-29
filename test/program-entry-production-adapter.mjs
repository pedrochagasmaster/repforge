#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const services = Adapter.createProductionServices({ Compiler, catalogue: EXERCISE_LIBRARY });

function recommendAnswers(extra = {}) {
  return {
    desiredResult: "muscle_growth",
    structuredExperience: "6_to_24m",
    recentConsistency: "most",
    daysPerWeek: 4,
    sessionMinutes: 60,
    preferredRestSeconds: 120,
    environment: { kind: "commercial_gym" },
    primaryMuscles: [],
    priorityMovements: [],
    exerciseConstraints: [],
    ...extra,
  };
}

test("production adapter compiles recommend and custom through the real compiler", () => {
  const answers = recommendAnswers();
  const recommend = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
  assert.equal(recommend.ok, true, recommend.code);
  assert.equal(recommend.preview.source, "compiler");
  assert.ok(recommend.preview.program.length > 0);
  assert.equal(recommend.telemetry.goal, "muscle_growth");
  assert.equal(recommend.telemetry.family, "growth");
  assert.equal(Object.hasOwn(answers, "volumeTolerance"), false);

  const again = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
  assert.equal(again.fingerprint, recommend.fingerprint);
  assert.deepEqual(again.preview.program, recommend.preview.program);
});

test("custom split choices come from getCompatibleSplitChoices and never invent fakes", () => {
  const answers = recommendAnswers({ desiredResult: "balanced" });
  const splits = services.splitChoices(answers);
  assert.ok(splits.choices.length >= 1 && splits.choices.length <= 2);
  assert.equal(splits.choices.filter((choice) => choice.default).length, 1);
  assert.ok(splits.choices.every((choice) => choice.id === `${choice.familyId}_${choice.frequency}_v1`));

  const custom = services.compile({
    mode: "custom",
    answers: { ...answers, splitPreference: splits.choices[0].id },
    versions: services.currentVersions(),
  });
  assert.equal(custom.ok, true, custom.code);
  assert.equal(custom.selected.blueprintId, splits.choices[0].blueprintId);
});

test("limited home selects the home family and browse returns only executable cards", () => {
  const home = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ environment: { kind: "limited_home" }, daysPerWeek: 3 }),
    versions: services.currentVersions(),
  });
  assert.equal(home.ok, true, home.code);
  assert.equal(home.selected.familyId, "home");

  const cards = services.browseCatalogue({
    daysPerWeek: 3,
    sessionMinutes: 60,
    environment: { kind: "commercial_gym" },
    structuredExperience: "6_to_24m",
  });
  assert.ok(cards.length >= 15);
  assert.ok(cards.every((card) => card.browse && card.complete && card.executable && card.tested));
  assert.ok(cards.every((card) => Array.isArray(card.preview.program) && card.preview.program.length > 0));
  assert.ok(!cards.some((card) => card.family === "future"));
});

test("build creates empty day containers without placeholder exercises", () => {
  const built = services.buildEmptyProgram({ programName: "Manual block", daysPerWeek: 4 });
  assert.equal(built.ok, true);
  assert.deepEqual(built.program, []);
  assert.equal(built.programStructure.days.length, 4);
  assert.ok(built.programStructure.days.every((day) => day.dayId && day.label));
  assert.ok(built.preview.days.every((day) => day.exercises.length === 0));
});

test("first structured experience reports foundation telemetry without changing authorship route", () => {
  const result = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ structuredExperience: "first", recentConsistency: "few" }),
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.telemetry.family, "foundation");
  assert.equal(result.compilerContext.profile, "foundation");
  assert.equal(result.compilerContext.reentryEnabled, true);
});

test("state machine plus production compile reaches activation-ready preview", () => {
  const versions = services.currentVersions();
  let state = Entry.createState({
    draftId: "adapter-draft",
    activeProgramRevisionAtStart: 3,
    now: "2026-08-29T12:00:00.000Z",
    versions,
  });
  state = Entry.selectRoute(state, "recommend");
  state = Entry.setAnswers(state, recommendAnswers());
  while (state.step !== "result") {
    const advanced = Entry.advance(state);
    assert.equal(advanced.ok, true, advanced.issues?.join(","));
    state = advanced.state;
  }
  const compiled = services.compile({ mode: "recommend", answers: state.answers, versions });
  state = Entry.setResult(state, {
    fingerprint: compiled.fingerprint,
    selected: compiled.selected,
    candidates: compiled.candidates,
    preview: compiled.preview,
    telemetry: compiled.telemetry,
  });
  state = Entry.advance(state).state;
  assert.equal(state.step, "preview");
  const ready = Entry.activationReadiness(state, {
    liveActiveProgramRevision: 3,
    currentVersions: versions,
  });
  assert.equal(ready.ok, true);
});

test("hostile or incomplete inputs fail closed", () => {
  assert.equal(services.compile({
    mode: "recommend",
    answers: recommendAnswers({ desiredResult: undefined }),
    versions: services.currentVersions(),
  }).ok, false);
  assert.equal(services.buildEmptyProgram({ programName: "", daysPerWeek: 3 }).ok, false);
  assert.deepEqual(services.splitChoices({ daysPerWeek: 4 }).choices, []);
});

test("recommend returns only the primary candidate with no invented alternative", () => {
  const balanced = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ desiredResult: "balanced" }),
    versions: services.currentVersions(),
  });
  assert.equal(balanced.ok, true, balanced.code);
  assert.equal(balanced.alternative, null);
  assert.equal(balanced.candidates.length, 1);
  assert.equal(balanced.selected.familyId, "balanced");
});

test("environment equipment and capability corrections map into compiler context", () => {
  const answers = recommendAnswers({
    environment: {
      kind: "commercial_gym",
      equipment: ["dumbbell", "cable"],
      capabilities: ["safe_pull"],
    },
  });
  const mapped = Adapter.answersToCompilerContext(answers);
  assert.equal(mapped.ok, true);
  assert.deepEqual(mapped.value.equipment, ["dumbbell", "cable"]);
  assert.deepEqual(mapped.value.environment, ["safe_pull"]);
  assert.equal(mapped.value.equipment.includes("external_resistance"), false);
});

test("exerciseConstraints become dislikes and stay out of telemetry", () => {
  const answers = recommendAnswers({
    exerciseConstraints: [
      { exerciseId: "bp_bb", reason: "pain" },
      { exerciseId: "sq_bb", reason: "dislike" },
    ],
  });
  const result = services.compile({
    mode: "recommend",
    answers,
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  assert.deepEqual(result.compilerContext.dislikes.sort(), ["bp_bb", "sq_bb"].sort());
  assert.equal(Object.hasOwn(result.telemetry, "exerciseConstraints"), false);
  assert.equal(Object.hasOwn(result.telemetry, "dislikes"), false);
  assert.equal(JSON.stringify(result.telemetry).includes("pain"), false);
  assert.equal(JSON.stringify(result.telemetry).includes("bp_bb"), false);
});
