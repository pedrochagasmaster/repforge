#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../program-entry.js");
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Progression = require("../progression-engine.js");
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

test("compiled preview preserves executable paired-exposure relations", () => {
  const balanced = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ desiredResult: "balanced", daysPerWeek: 3 }),
    versions: services.currentVersions(),
  });
  assert.equal(balanced.ok, true, balanced.code);
  assert.equal(balanced.preview.progressionRelations.length, 2);
  assert.deepEqual(
    Progression.validateRelations(balanced.preview.progressionRelations, { slots: balanced.preview.program }),
    { ok: true, value: balanced.preview.progressionRelations },
  );
  const foundation = services.compile({
    mode: "recommend",
    answers: recommendAnswers({
      desiredResult: "balanced",
      daysPerWeek: 3,
      structuredExperience: "first",
      recentConsistency: "few",
    }),
    versions: services.currentVersions(),
  });
  assert.equal(foundation.ok, true, foundation.code);
  assert.deepEqual(foundation.preview.progressionRelations, [],
    "Foundation does not invent a paired relation");
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

test("custom split choices carry human facts and are executable for the exact answers", () => {
  const answers = recommendAnswers({ desiredResult: "balanced", sessionMinutes: 60 });
  const splits = services.splitChoices(answers);
  assert.ok(splits.choices.length >= 1 && splits.choices.length <= 2);
  for (const choice of splits.choices) {
    assert.ok(choice.name && choice.namePt);
    assert.ok(Array.isArray(choice.days) && choice.days.length === answers.daysPerWeek);
    assert.ok(choice.days.every((day) => typeof day.label === "string" && day.label));
    const compiled = services.compile({
      mode: "custom",
      answers: { ...answers, splitPreference: choice.id },
      versions: services.currentVersions(),
    });
    assert.equal(compiled.ok, true, `${choice.id}: ${compiled.code}`);
  }
  assert.deepEqual(services.splitChoices({ ...answers, sessionMinutes: 30 }).choices, [],
    "a structure that conflicts with the exact time ceiling must not be offered");
});

test("Custom guarantees a compatible must-have and rejects must-have/avoid contradictions", () => {
  const answers = recommendAnswers({ desiredResult: "balanced", mustHaveExercises: ["pr_bb"] });
  const splitPreference = services.splitChoices(answers).choices[0].id;
  const compiled = services.compile({
    mode: "custom",
    answers: { ...answers, splitPreference },
    versions: services.currentVersions(),
  });
  assert.equal(compiled.ok, true, compiled.code);
  assert.ok(compiled.preview.program.some((exercise) => exercise.libraryId === "pr_bb"));
  assert.equal(Object.hasOwn(compiled.telemetry, "mustHaveExercises"), false);
  assert.equal(Object.hasOwn(compiled.telemetry, "preferences"), false);
  assert.equal(JSON.stringify(compiled.telemetry).includes("pr_bb"), false);

  const conflict = services.compile({
    mode: "custom",
    answers: {
      ...answers,
      splitPreference,
      exerciseConstraints: [{ exerciseId: "pr_bb", reason: "pain" }],
    },
    versions: services.currentVersions(),
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.code, "exercise_preference_conflict");
  assert.deepEqual(conflict.conflicts, [{ code: "must_have_avoided", exerciseId: "pr_bb" }]);
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

test("Browse consumes released blueprint metadata and compiler facts", () => {
  const context = {
    daysPerWeek: 4,
    sessionMinutes: 60,
    structuredExperience: "6_to_24m",
    environment: { kind: "commercial_gym" },
  };
  const cards = services.browseCatalogue(context);
  assert.ok(cards.length > 0);
  assert.equal(new Set(cards.map((card) => card.name)).size, cards.length);
  for (const card of cards) {
    const source = Compiler.BLUEPRINTS.find((blueprint) => blueprint.id === card.id);
    assert.ok(source?.release?.browse && source.release.complete && source.release.executable && source.release.tested);
    assert.deepEqual(card.release, source.release);
    const estimates = card.preview.days.map((day) => day.estimateMinutes);
    assert.deepEqual(card.minutes, [Math.min(...estimates), Math.max(...estimates)]);
    assert.ok(card.purpose && card.progressionStrategies.length > 0);
    assert.ok(card.equipmentAssumptions.length > 0);
    assert.ok(card.equipmentAssumptions.every((equipment) => card.instance.days.some((day) =>
      day.slots.some((slot) => slot.exercise?.equipment === equipment))));
    assert.ok(card.structureFacts.length === card.daysPerWeek);
  }
  const changedContext = services.browseCatalogue({ ...context, sessionMinutes: 75 });
  const sameBlueprint = changedContext.find((card) => card.id === cards[0].id);
  assert.ok(sameBlueprint);
  assert.notEqual(sameBlueprint.fingerprint, cards[0].fingerprint);
});

test("Browse omits a blueprint whose declared release metadata is incomplete", () => {
  const hiddenId = Compiler.BLUEPRINTS[0].id;
  const guardedCompiler = {
    ...Compiler,
    BLUEPRINTS: Compiler.BLUEPRINTS.map((blueprint) => blueprint.id === hiddenId
      ? { ...blueprint, release: { ...blueprint.release, tested: false } }
      : blueprint),
  };
  const guarded = Adapter.createProductionServices({ Compiler: guardedCompiler, catalogue: EXERCISE_LIBRARY });
  const cards = guarded.browseCatalogue({ sessionMinutes: 60, environment: { kind: "commercial_gym" } });
  assert.equal(cards.some((card) => card.id === hiddenId), false);
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

test("about_half enables the interrupted one-week treatment", () => {
  const result = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ recentConsistency: "about_half", daysPerWeek: 3 }),
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(result.compilerContext.recentConsistency, "interrupted");
  assert.equal(result.compilerContext.reentryEnabled, true);
  assert.equal(result.instance.weeks[0].phase, "interrupted_week_1");
  assert.ok(result.instance.weeks[0].days.flatMap((day) => day.slots)
    .some((target) => target.sets < result.instance.program
      .find((exercise) => exercise.slotId === target.slotId).sets));
  assert.ok(result.instance.weeks.slice(1).every((week) => week.phase === "normal"));
});

test("current-week projection executes stored re-entry sets without mutating the authored program", () => {
  const result = services.compile({
    mode: "recommend",
    answers: recommendAnswers({ recentConsistency: "about_half", daysPerWeek: 3 }),
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  const authoredBytes = JSON.stringify(result.preview.program);
  const weekOne = Compiler.projectProgramForWeek(
    result.preview.program,
    result.preview.programStructure,
    1,
  );
  const weekTwo = Compiler.projectProgramForWeek(
    result.preview.program,
    result.preview.programStructure,
    2,
  );
  const weekOneTargets = new Map(result.preview.programStructure.weekPrescriptions[0].days
    .flatMap((day) => day.slots).map((target) => [target.slotId, target.sets]));
  const expectedWeekOne = result.preview.program.flatMap((exercise) => {
    const sets = weekOneTargets.get(exercise.slotId);
    return sets === 0 ? [] : [{ ...exercise, sets }];
  });
  assert.deepEqual(weekOne, expectedWeekOne);
  assert.deepEqual(weekTwo, result.preview.program);
  assert.equal(JSON.stringify(result.preview.program), authoredBytes);
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
  assert.equal(typeof compiled.name, "string");
  assert.equal(typeof compiled.namePt, "string");
  assert.equal(compiled.name.includes(compiled.selected.blueprintId), false);
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
