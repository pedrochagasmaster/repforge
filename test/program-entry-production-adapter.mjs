#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const Entry = require("../src/training/authoring.js").createEntryRules(require("../assets/exercise-catalog.json"));
const Compiler = require("../src/training/generation.js");
const Catalog = require("../assets/exercise-catalog.json");
const Adapter = require("../src/training/authoring.js").createEntryAdapter({compiler:Compiler});
const workerFixture = JSON.parse(require("node:fs").readFileSync(new URL(
  "../services/install-transfer/test/fixtures/program-definition-plan067-worker.json",
  import.meta.url,
), "utf8"));

function generatedRequest(overrides = {}) {
  const request = structuredClone(workerFixture.request);
  delete request.seed;
  Object.assign(request, overrides);
  request.gymProfile.equipmentIds = Object.keys(Catalog.uuidIndex)
    .filter((id) => Catalog.uuidIndex[id]?.type === "equipment");
  return { request };
}

test("production services pass the typed request and raw snapshot to the canonical compiler", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const { request } = generatedRequest({
    daysPerWeek: 4,
    timeCeilingMinutes: 150,
    cycles: 8,
    deloadCycles: [8],
    split: "auto",
  });
  const originalRequest = structuredClone(request);
  const expected = Compiler.generateProgram(request, Catalog);
  const actual = services.generateProgram({ request });

  assert.equal(actual.ok, true, actual.conflicts?.map((item) => item.message).join("; "));
  assert.deepEqual(actual, expected, "the adapter returns the real compiler result without a family/candidate wrapper");
  assert.deepEqual(request, originalRequest, "generation does not mutate the authored request");
  assert.equal(actual.value.cycles, 8);
  assert.deepEqual(Compiler.validateProgramDefinition(actual.value, Catalog), { ok: true, issues: [] });
  assert.deepEqual(Object.keys(actual).sort(), ["confirmationOffers", "conflicts", "explanations", "ok", "value"]);
});

test("production services expose no family, browse, or legacy compile façade", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  // splitChoices remains: it offers the generator's authored splits (see below).
  for (const method of ["compile", "browseCatalogue", "answersToCompilerContext", "resolveFamilyId", "sharedMovementId"]) {
    assert.equal(services[method], undefined, `${method} is retired from the production service surface`);
  }
  assert.equal(typeof services.generateProgram, "function");
  assert.equal(typeof services.currentVersions, "function");
});

test("invalid compiler requests stay explicit conflicts and never fall back to a starter program", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const { request } = generatedRequest();
  request.gymProfile.equipmentIds = ["vague:machine"];
  const actual = services.generateProgram({ request });
  const expected = Compiler.generateProgram(request, Catalog);
  assert.equal(actual.ok, false);
  assert.deepEqual(actual, expected);
  assert.equal(actual.value, null);
  assert.ok(actual.conflicts.length > 0);
});

test("production services require the checked raw catalog snapshot", () => {
  assert.throws(() => Adapter.createProductionServices({ Compiler }), /raw catalog/i);
  assert.throws(() => Adapter.createProductionServices({ Compiler, catalog: [] }), /raw catalog/i);
  assert.throws(() => Adapter.createProductionServices({ Compiler, catalog: { exercises: [] } }), /raw catalog/i);
});

test("Build starts from a compiler-valid empty manual ProgramDefinition", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const built = services.buildEmptyProgram({ programName: "Manual block", daysPerWeek: 4 });
  assert.equal(built.ok, true, built.code);
  assert.deepEqual(built.preview.program, []);
  assert.equal(built.programDefinition, built.preview.programDefinition);
  assert.equal(built.programDefinition.days.length, 7);
  assert.equal(built.programDefinition.days.filter((day) => day.kind === "training").length, 4);
  assert.ok(built.programDefinition.days.filter((day) => day.kind === "training").every((day) => day.slots.length === 0));
  assert.equal(Compiler.validateProgramDefinition(built.programDefinition, Catalog).ok, true);
  assert.deepEqual(built.preview.programStructure.days.map((day) => day.dayId),
    built.programDefinition.days.filter((day) => day.kind === "training").map((day) => day.id));

  let state = Entry.selectRoute(Entry.createState({
    draftId: "manual-draft",
    activeProgramRevisionAtStart: 0,
    now: "2026-08-27T12:00:00.000Z",
    versions: services.currentVersions(),
  }), "build");
  state = Entry.setAnswers(state, { programName: "Manual block", daysPerWeek: 4 });
  state = Entry.setResult(state, {
    fingerprint: built.fingerprint,
    selected: { id: "manual-build", source: "build" },
    name: built.name,
    preview: built.preview,
  });
  const normalized = Entry.normalizeSetupDraft(state);
  assert.equal(normalized.ok, true, normalized.issues?.join(","));
  assert.deepEqual(normalized.value.result.preview.programDefinition, built.programDefinition);
});

test("adapter fingerprints are deterministic and identity diff remains presentation-only", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  assert.equal(services.fingerprint({ b: 2, a: 1 }), services.fingerprint({ a: 1, b: 2 }));
  assert.deepEqual(services.identityDiff(
    [{ libraryId: "exercise.one" }, { libraryId: "exercise.two" }],
    [{ libraryId: "exercise.one" }, { libraryId: "exercise.three" }],
  ), { added: 1, removed: 1, n: 1, total: 2 });
});

// Generate's answers become a canonical generator request. These mappings are
// combinatorial (goal × experience × minutes × environment × muscle tokens), so
// they are proved here; the browser journey proves the route renders and
// activates the result.
const answersFor = (overrides = {}) => ({
  desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most",
  daysPerWeek: 4, sessionMinutes: 60, environment: { kind: "commercial_gym" },
  primaryMuscles: [], deEmphasizedMuscles: [], ignoredMuscles: [], exerciseConstraints: [], mustHaveExercises: [],
  ...overrides,
});
const equipmentFlag = (flag) => Object.keys(Catalog.uuidIndex)
  .filter((id) => Catalog.uuidIndex[id].type === "equipment" && Catalog.uuidIndex[id][flag] === 1).sort();
const muscleId = (name) => Object.keys(Catalog.uuidIndex)
  .find((id) => Catalog.uuidIndex[id].type === "featureMuscleGroup" && Catalog.uuidIndex[id].name === name);

test("Generate answers map to the generator's goal, experience, time ceiling and source gym equipment", () => {
  assert.equal(typeof Adapter.programRequestFromAnswers, "function");
  const mapped = Adapter.programRequestFromAnswers(answersFor(), Catalog);
  assert.equal(mapped.ok, true, JSON.stringify(mapped.conflicts));
  const request = mapped.value;
  assert.equal(request.goal, "hypertrophy");
  assert.equal(request.experience, "intermediate");
  assert.equal(request.daysPerWeek, 4);
  assert.equal(request.timeCeilingMinutes, 60);
  assert.deepEqual(request.gymProfile.equipmentIds, equipmentFlag("commercialGym"));
  assert.deepEqual(Object.values(request.competencyAnswers), [null, null, null, null, null, null, null],
    "competency answers default to unconfirmed");
  assert.equal(request.split, "auto");
  assert.equal(request.periodization, "static");
  assert.equal(request.cycles, 7);
  assert.deepEqual(request.deloadCycles, []);
  const generated = Compiler.generateProgram(request, Catalog);
  assert.equal(generated.ok, true, "the mapped request generates a program");

  for (const [result, goal] of [["balanced", "hybrid"], ["strength", "strength"]]) {
    assert.equal(Adapter.programRequestFromAnswers(answersFor({ desiredResult: result }), Catalog).value.goal, goal);
  }
  for (const [experience, level] of [["first", "beginner"], ["under_6m", "beginner"], ["over_24m", "advanced"]]) {
    assert.equal(Adapter.programRequestFromAnswers(answersFor({ structuredExperience: experience }), Catalog).value.experience, level);
  }
  for (const [minutes, ceiling] of [[30, 20], [45, 40], [75, 60], [90, 90]]) {
    assert.equal(Adapter.programRequestFromAnswers(answersFor({ sessionMinutes: minutes }), Catalog).value.timeCeilingMinutes, ceiling,
      "the ceiling never exceeds the minutes the lifter has");
  }
  for (const [kind, flag] of [["basic_gym", "localGym"], ["full_home", "garageGym"], ["limited_home", "homeGym"], ["other", "localGym"]]) {
    assert.deepEqual(Adapter.programRequestFromAnswers(answersFor({ environment: { kind } }), Catalog).value.gymProfile.equipmentIds,
      equipmentFlag(flag), `${kind} uses the source ${flag} equipment`);
  }
});

test("Generate muscle and exercise answers become canonical ontology IDs", () => {
  const pick = Catalog.exercises.find((entry) => entry.name === "Leg extension").id;
  const avoid = Catalog.exercises.find((entry) => entry.name === "Pec deck fly").id;
  const mapped = Adapter.programRequestFromAnswers(answersFor({
    primaryMuscles: ["side_delts", "back"], deEmphasizedMuscles: ["calves"], ignoredMuscles: ["glutes"],
    mustHaveExercises: [pick], exerciseConstraints: [{ exerciseId: avoid, reason: "dislike" }],
  }), Catalog).value;
  assert.deepEqual(mapped.emphasisMuscleIds, [muscleId("Side Delts"), muscleId("Upper Back")]);
  assert.deepEqual(mapped.deprioritizedMuscleIds, [muscleId("Calves")]);
  assert.deepEqual(mapped.excludedMuscleIds, [muscleId("Glutes")]);
  assert.deepEqual(mapped.preferredExerciseIds, [pick]);
  assert.deepEqual(mapped.excludedExerciseIds, [avoid]);
});

test("incomplete or unsupported Generate answers are explicit conflicts", () => {
  const codes = (answers) => Adapter.programRequestFromAnswers(answers, Catalog).conflicts?.map((item) => item.code);
  assert.deepEqual(codes(answersFor({ desiredResult: undefined })), ["goal_required"]);
  assert.deepEqual(codes(answersFor({ structuredExperience: undefined })), ["experience_required"]);
  assert.deepEqual(codes(answersFor({ daysPerWeek: 7 })), ["days_unsupported"]);
  assert.deepEqual(codes(answersFor({ environment: null })), ["environment_required"]);
});

test("split choices are the generator's authored splits compatible with the day count", () => {
  const services = Adapter.createProductionServices({ Compiler, catalog: Catalog });
  const three = services.splitChoices(answersFor({ daysPerWeek: 3 })).choices;
  assert.deepEqual(three.map((choice) => choice.id), ["full_body", "upper_lower_full", "push_pull_legs"]);
  assert.deepEqual(three.filter((choice) => choice.default).map((choice) => choice.id), ["upper_lower_full"]);
  const four = services.splitChoices(answersFor({ daysPerWeek: 4 })).choices;
  assert.deepEqual(four.map((choice) => choice.id), ["full_body", "upper_lower_upper_lower", "push_pull_hinge_squat", "push_pull_legs_accessories"]);
  assert.deepEqual(four.filter((choice) => choice.default).map((choice) => choice.id), ["upper_lower_upper_lower"]);
  assert.deepEqual(services.splitChoices({}).choices, []);
  assert.equal(Adapter.programRequestFromAnswers(answersFor({ splitPreference: "upper_lower_upper_lower" }), Catalog).value.split, "upper_lower_upper_lower");
  const incompatible = Adapter.programRequestFromAnswers(answersFor({ daysPerWeek: 3, splitPreference: "upper_lower" }), Catalog);
  assert.equal(incompatible.ok, false, "an incompatible explicit split is refused");
  assert.deepEqual(incompatible.conflicts, [{ field: "split", code: "split_unsupported" }]);
});

test("Generate preserves all 22 source muscles by identity even when catalogue labels change", () => {
  const muscles = ["chest", "lats", "back", "side_delts", "front_delts", "rear_delts", "biceps", "triceps",
    "quads", "hamstrings", "glutes", "calves", "forearms", "lower_back", "abductors", "adductors",
    "neck", "upper_traps", "abs", "serratus", "tibs", "obliques"];
  assert.deepEqual(new Set(Entry.ENTRY_MUSCLES), new Set(muscles));
  const expected = muscles.map((token) => ({
    chest: "2545c6f170d8805f823bcfb076a74397", lats: "2545c6f170d88060a50ec9b41a066a5d",
    back: "2545c6f170d880da9b28f1e024be796b", side_delts: "2545c6f170d880088132c5739103e625",
    front_delts: "2545c6f170d8809a8fa7e24a77c25416", rear_delts: "2545c6f170d880a9899eec0e496c8cba",
    biceps: "2545c6f170d880349546e5d8f6df2e2a", triceps: "2545c6f170d88017a44bcd5bc21b8d98",
    quads: "2545c6f170d88084b35affb3c3375aa6", hamstrings: "2545c6f170d88002b193de9106604e79",
    glutes: "2545c6f170d8804bb1fbdfc4471debe5", calves: "2545c6f170d880bbb34fc724d677176f",
    forearms: "2545c6f170d88024b49fcea90e7d1ed9", lower_back: "2545c6f170d880768fc0ec766d080c01",
    abductors: "2545c6f170d8803d89bcf1ee5a11b23b", adductors: "2545c6f170d880a0ad32cd4e83834959",
    neck: "2545c6f170d88021b648feb29a2427c2", upper_traps: "2545c6f170d880af953ace5a631c8cd2",
    abs: "2545c6f170d8806aab76c6830449a3ff", serratus: "27a5c6f170d880c39b2df5e861495666",
    tibs: "27a5c6f170d880a5baa9c716b240d0f6", obliques: "2545c6f170d8809da3f3cd80f2f14a4d",
  })[token]);
  const renamed = structuredClone(Catalog);
  for (const id of expected) renamed.uuidIndex[id].name = "Presentation only";
  for (const field of ["primaryMuscles", "deEmphasizedMuscles"]) {
    const mapped = Adapter.programRequestFromAnswers(answersFor({ [field]: muscles }), renamed);
    assert.equal(mapped.ok, true, JSON.stringify(mapped.conflicts));
    assert.deepEqual(mapped.value[field === "primaryMuscles" ? "emphasisMuscleIds" : "deprioritizedMuscleIds"], expected);
  }
});

test("an explicitly saved recovered split cannot silently become another policy outside its domain", () => {
  const answers = answersFor({ desiredResult: "balanced", structuredExperience: "over_24m", daysPerWeek: 4,
    sessionMinutes: 60, splitPreference: "upper_lower_full", block: { cycles: 7, periodization: "static" }, deload: false });
  const original = structuredClone(answers);
  const mapped = Adapter.programRequestFromAnswers(answers, Catalog);
  assert.equal(mapped.ok, false);
  assert.ok(mapped.conflicts.some((item) => item.field === "split" && item.code === "split_unsupported"));
  assert.deepEqual(answers, original, "unreplayable saved answers remain available for rules recovery");
});
