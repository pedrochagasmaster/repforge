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

test("shared movement identities canonicalize exact compiler library references only", () => {
  assert.equal(
    Adapter.sharedMovementId({ libraryId: "pr_mc", movementId: "library:pr_mc" }),
    "pr_mc",
  );
  assert.equal(
    Adapter.sharedMovementId({ libraryId: "legacy_press", movementId: "library:legacy_press" }, { legacy_press: "pr_mc" }),
    "pr_mc",
  );
  assert.equal(
    Adapter.sharedMovementId({ libraryId: "pr_mc", movementId: "coach:press" }),
    "coach:press",
  );
  assert.equal(
    Adapter.sharedMovementId({ libraryId: "pr_mc", movementId: "library:other" }),
    "library:other",
  );
});

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

test("production services preserve compatible exact exercise history", () => {
  const answers = recommendAnswers({ daysPerWeek: 2, sessionMinutes: 90 });
  const baseline = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
  const familiarServices = Adapter.createProductionServices({
    Compiler,
    catalogue: EXERCISE_LIBRARY,
    history: [{ libraryId: "cd_mc" }],
  });
  const familiar = familiarServices.compile({
    mode: "recommend",
    answers,
    versions: familiarServices.currentVersions(),
  });
  assert.equal(baseline.ok, true, baseline.code);
  assert.equal(familiar.ok, true, familiar.code);
  assert.equal(baseline.preview.program.some((exercise) => exercise.libraryId === "cd_mc"), false);
  assert.equal(familiar.preview.program.some((exercise) => exercise.libraryId === "cd_mc"), true,
    "a compatible exact movement is retained as the compiler's continuity tie-breaker");
  assert.deepEqual(familiar.compilerContext.history, [{ libraryId: "cd_mc" }]);
  assert.notEqual(familiar.fingerprint, baseline.fingerprint,
    "history-dependent output receives a history-dependent deterministic fingerprint");
  assert.equal(JSON.stringify(familiar.telemetry).includes("cd_mc"), false,
    "exercise identity stays outside telemetry");
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


// --- Plan 054 packet 054-P5 Proof-First Tests ---

function compileWithOracle(servicesInstance, compileOptions) {
  const result = servicesInstance.compile(compileOptions);
  if (process.env.REPFORGE_PROGRAM_CANDIDATE_FAULT === "fabricate-alternative") {
    if (result && result.ok && result.alternative === null) {
      result.alternative = {
        id: "fabricated_split_alt",
        blueprintId: "fabricated_4_v1",
        familyId: "fabricated",
        name: "Fabricated Alternative",
        namePt: "Alternativa Fabricada",
        daysPerWeek: 4,
        synthetic: true,
        reason: { code: "synthesized_mutation", facts: {} },
      };
      if (result.candidate) {
        result.candidate.alternative = result.alternative;
      }
    }
  }
  return result;
}

function createInjectedCompiler({
  alternativeFamilyId = "balanced",
  reason = { code: "compatible_split_variation", facts: { familyId: "balanced" } },
  malformed = null,
  incompatible = false,
  sameIdentity = false,
  omitReason = false,
} = {}) {
  return {
    ...Compiler,
    compile(context, catalogue) {
      const primary = Compiler.compile(context, catalogue);
      if (primary.kind !== "compiled") return primary;

      if (malformed !== null) {
        return {
          ...primary,
          alternative: malformed,
        };
      }

      let altInstance;
      if (sameIdentity) {
        altInstance = Compiler.compile(context, catalogue);
      } else if (incompatible) {
        altInstance = Compiler.compile({ ...context, frequency: 3 }, catalogue);
      } else {
        const altContext = { ...context, familyId: alternativeFamilyId };
        altInstance = Compiler.compile(altContext, catalogue);
      }

      const altEntry = {
        ...altInstance,
        instance: altInstance,
        ...(omitReason ? {} : { reason }),
      };

      return {
        ...primary,
        alternative: altEntry,
      };
    },
  };
}

test("P5: Recommend result exposes one coherent ProgramCandidate view model", () => {
  const versions = services.currentVersions();
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const result = compileWithOracle(services, {
    mode: "recommend",
    answers,
    versions,
  });
  assert.equal(result.ok, true, result.code);

  const candidate = result.candidate;
  assert.ok(
    candidate && typeof candidate === "object",
    "recommend result must expose a coherent ProgramCandidate view model (e.g. result.candidate)",
  );

  const primary = candidate.primary ?? candidate.selected;
  assert.ok(primary && typeof primary === "object", "ProgramCandidate must carry primary compiled candidate");
  assert.equal(primary.blueprintId, "growth_4_v1");
  assert.equal(primary.familyId, "growth");

  const draft = candidate.draft ?? candidate.preview;
  assert.ok(draft && typeof draft === "object", "ProgramCandidate must carry primary preview or editable draft");
  assert.ok(Array.isArray(draft.program) && draft.program.length > 0, "preview/draft must contain program rows");
  assert.ok(Array.isArray(draft.days) && draft.days.length === 4, "preview/draft must contain day structures");

  assert.ok(candidate.rationale && typeof candidate.rationale === "object", "ProgramCandidate must carry structured rationale");
  const reasonCodes = candidate.rationale.codes ?? candidate.rationale.reasonCodes;
  assert.ok(Array.isArray(reasonCodes) && reasonCodes.length > 0, "rationale must expose structured reason codes array");
  const facts = candidate.rationale.facts ?? candidate.explanation;
  assert.ok(facts && typeof facts === "object", "rationale must expose structured rationale facts");
  assert.equal(facts.desiredResult, "muscle_growth");
  assert.equal(facts.daysPerWeek, 4);

  assert.ok(
    candidate.validation !== undefined || candidate.validationStatus !== undefined,
    "ProgramCandidate must expose validation status",
  );
  assert.ok(
    candidate.activation !== undefined || candidate.activationStatus !== undefined,
    "ProgramCandidate must expose activation status",
  );

  assert.equal(candidate.alternative, null, "ProgramCandidate alternative must be null when compiler supplies none");
});

test("P5: alternative is non-null when injected compiler explicitly supplies a second compatible candidate plus structured reason", () => {
  const injectedCompiler = createInjectedCompiler({
    alternativeFamilyId: "balanced",
    reason: { code: "compatible_split_variation", facts: { familyId: "balanced" } },
  });
  const customServices = Adapter.createProductionServices({
    Compiler: injectedCompiler,
    catalogue: EXERCISE_LIBRARY,
  });
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const result = customServices.compile({
    mode: "recommend",
    answers,
    versions: customServices.currentVersions(),
  });

  assert.equal(result.ok, true, result.code);
  const alt = result.candidate?.alternative ?? result.alternative;
  assert.ok(alt, "alternative must be non-null when compiler explicitly supplies second candidate with reason");

  const primaryId = result.selected?.blueprintId || result.candidate?.primary?.blueprintId;
  const altId = alt.blueprintId || alt.id;
  assert.ok(altId, "alternative must have an id or blueprintId");
  assert.notEqual(altId, primaryId, "alternative must have an independent ID from primary");

  assert.ok(alt.provenance || alt.instance?.provenance, "alternative must carry provenance");
  const primaryFamily = result.selected?.familyId || result.instance?.familyId;
  const altFamily = alt.familyId || alt.instance?.familyId;
  assert.notEqual(altFamily, primaryFamily, "alternative must carry independent provenance/family");

  assert.ok(alt.fingerprint, "alternative must have a deterministic fingerprint");
  assert.notEqual(alt.fingerprint, result.fingerprint, "alternative fingerprint must be independent from primary");

  const altPreview = alt.preview || alt.instance;
  assert.ok(Array.isArray(altPreview.program) && altPreview.program.length > 0, "alternative must carry executable program rows");
  assert.ok(Array.isArray(altPreview.days) && altPreview.days.length === answers.daysPerWeek, "alternative must carry executable days matching schedule");
  assert.ok(
    altPreview.program.every((row) => row.name && row.sets > 0 && row.min > 0 && row.max >= row.min),
    "all alternative program rows must be executable",
  );

  assert.ok(alt.reason && typeof alt.reason === "object", "alternative must carry structured reason");
  assert.equal(alt.reason.code, "compatible_split_variation");
});

test("P5: no second candidate or reason means alternative is null and never synthesized", () => {
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const result = compileWithOracle(services, {
    mode: "recommend",
    answers,
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(
    result.alternative,
    null,
    "alternative must be null when compiler supplies no second candidate or reason",
  );
  if (result.candidate) {
    assert.equal(
      result.candidate.alternative,
      null,
      "candidate.alternative must be null when compiler supplies no second candidate",
    );
  }
});

test("P5: adapter never synthesizes an alternative from getCompatibleSplitChoices alone", () => {
  const answers = recommendAnswers({ desiredResult: "balanced", daysPerWeek: 4 });
  const splits = services.splitChoices(answers);
  assert.ok(splits.choices.length >= 1, "split choices exist for these answers");

  const result = compileWithOracle(services, {
    mode: "recommend",
    answers,
    versions: services.currentVersions(),
  });
  assert.equal(result.ok, true, result.code);
  assert.equal(
    result.alternative,
    null,
    "getCompatibleSplitChoices alone must not be treated as a recommendation alternative",
  );
});

test("P5: incompatible compiler alternative fails closed to null without contaminating primary", () => {
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const injectedCompiler = createInjectedCompiler({
    incompatible: true,
    reason: { code: "incompatible_frequency", facts: {} },
  });
  const customServices = Adapter.createProductionServices({
    Compiler: injectedCompiler,
    catalogue: EXERCISE_LIBRARY,
  });
  const result = customServices.compile({
    mode: "recommend",
    answers,
    versions: customServices.currentVersions(),
  });

  assert.equal(result.ok, true, "primary compile must still succeed");
  assert.equal(result.alternative, null, "incompatible alternative must fail closed to null");
  if (result.candidate) {
    assert.equal(result.candidate.alternative, null, "candidate alternative must fail closed to null");
  }
  assert.equal(result.selected.blueprintId, "growth_4_v1");
  assert.equal(result.selected.daysPerWeek, 4);
  assert.ok(result.preview.program.length > 0);
});

test("P5: same-identity compiler alternative fails closed to null without contaminating primary", () => {
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const injectedCompiler = createInjectedCompiler({
    sameIdentity: true,
    reason: { code: "duplicate_split", facts: {} },
  });
  const customServices = Adapter.createProductionServices({
    Compiler: injectedCompiler,
    catalogue: EXERCISE_LIBRARY,
  });
  const result = customServices.compile({
    mode: "recommend",
    answers,
    versions: customServices.currentVersions(),
  });

  assert.equal(result.ok, true, "primary compile must still succeed");
  assert.equal(result.alternative, null, "same-identity alternative must fail closed to null");
  if (result.candidate) {
    assert.equal(result.candidate.alternative, null);
  }
  assert.equal(result.selected.blueprintId, "growth_4_v1");
});

test("P5: compiler alternative missing a structured reason fails closed to null without contaminating primary", () => {
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const injectedCompiler = createInjectedCompiler({
    alternativeFamilyId: "balanced",
    omitReason: true,
  });
  const customServices = Adapter.createProductionServices({
    Compiler: injectedCompiler,
    catalogue: EXERCISE_LIBRARY,
  });
  const result = customServices.compile({
    mode: "recommend",
    answers,
    versions: customServices.currentVersions(),
  });

  assert.equal(result.ok, true, "primary compile must still succeed");
  assert.equal(result.alternative, null, "alternative without structured reason must fail closed to null");
  if (result.candidate) {
    assert.equal(result.candidate.alternative, null);
  }
  assert.equal(result.selected.blueprintId, "growth_4_v1");
});

test("P5: malformed compiler alternative fails closed to null without contaminating primary", () => {
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const injectedCompiler = createInjectedCompiler({
    malformed: { invalid: "not_a_candidate_instance", program: null },
  });
  const customServices = Adapter.createProductionServices({
    Compiler: injectedCompiler,
    catalogue: EXERCISE_LIBRARY,
  });
  const result = customServices.compile({
    mode: "recommend",
    answers,
    versions: customServices.currentVersions(),
  });

  assert.equal(result.ok, true, "primary compile must still succeed");
  assert.equal(result.alternative, null, "malformed alternative must fail closed to null");
  if (result.candidate) {
    assert.equal(result.candidate.alternative, null);
  }
  assert.equal(result.selected.blueprintId, "growth_4_v1");
  assert.ok(result.preview.program.length > 0);
});

test("P5: choosing or editing a candidate is represented without mutating adapter result or durable state fixture", () => {
  const versions = services.currentVersions();
  const answers = recommendAnswers({ desiredResult: "muscle_growth", daysPerWeek: 4 });
  const result = compileWithOracle(services, {
    mode: "recommend",
    answers,
    versions,
  });
  assert.equal(result.ok, true, result.code);

  const originalResultSnapshot = JSON.parse(JSON.stringify(result));

  const durableStateFixture = Object.freeze({
    revision: 3,
    activeProgramId: "prog_active_prior",
    program: [
      { id: "slot_prior_1", day: "Day 1", name: "Prior Bench", sets: 3, min: 6, max: 10 },
      { id: "slot_prior_2", day: "Day 1", name: "Prior Row", sets: 3, min: 8, max: 12 },
    ],
    updatedAt: "2026-08-20T10:00:00.000Z",
  });
  const originalFixtureSnapshot = JSON.parse(JSON.stringify(durableStateFixture));

  // 1. Represent editing a candidate draft (candidate-scoped edit)
  const draft = JSON.parse(JSON.stringify(result.preview));
  assert.ok(draft.program.length > 0);
  const firstExercise = draft.program[0];
  const originalSets = firstExercise.sets;
  firstExercise.sets = originalSets + 1;
  firstExercise.notes = "Focused tempo on eccentric phase";

  assert.equal(draft.program[0].sets, originalSets + 1);
  assert.equal(draft.program[0].notes, "Focused tempo on eccentric phase");

  // 2. Represent choosing a candidate into entry state
  let state = Entry.createState({
    draftId: "p5-selection-draft",
    activeProgramRevisionAtStart: durableStateFixture.revision,
    now: "2026-08-29T12:00:00.000Z",
    versions,
  });
  state = Entry.selectRoute(state, "recommend");
  state = Entry.setAnswers(state, answers);
  state = Entry.setResult(state, {
    fingerprint: result.fingerprint,
    selected: result.selected,
    candidates: result.candidates,
    preview: draft,
    telemetry: result.telemetry,
  });

  assert.equal(state.result.preview.program[0].sets, originalSets + 1);

  // 3. Assert original compile result is completely unmutated
  assert.deepEqual(
    result,
    originalResultSnapshot,
    "original compile result must not be mutated by candidate edits or selection",
  );

  // 4. Assert durable state fixture is completely unmutated
  assert.deepEqual(
    durableStateFixture,
    originalFixtureSnapshot,
    "durable state fixture must not be mutated during candidate choice or draft edits",
  );
});
