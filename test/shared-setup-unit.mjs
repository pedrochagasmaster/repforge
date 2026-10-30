#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const Setup = require(join(root, "shared-setup.js"));
const Metrics = require(join(root, "exercise-metrics.js"));
const Compiler = require(join(root, "program-compiler.js"));
const source = JSON.parse(fs.readFileSync(join(root, "plans/067/data/app_file.json"), "utf8"));
require(join(root, "generation-identity.js")).prepareCatalog(source);
const gym = JSON.parse(fs.readFileSync(join(root, "plans/067/data/gym.json"), "utf8"));
const workerFixture = JSON.parse(fs.readFileSync(join(root,
  "services/install-transfer/test/fixtures/program-definition-plan067-worker.json"), "utf8"));
const exercise = source.exercises.find((entry) => entry.exerciseMetrics?.length);
assert.ok(exercise, "raw source has at least one movement with metrics");
const metricDefinitions = Metrics.definitionsForIds(exercise.exerciseMetrics);
assert.equal(metricDefinitions.ok, true);
const builtInIds = new Set(source.exercises.map((entry) => entry.id));

const settings = {
  jumpPct: 3.5,
  minJump: 1.25,
  rirHigh: 3,
  hardRir: 4,
  restSec: 165,
  unit: "lb",
  lang: "pt",
  rirMode: "effort",
};

function slot(overrides = {}) {
  const set = {
    id: "set-1",
    cycleIndex: 1,
    setIndex: 1,
    metricType: "source_metrics@1",
    metricIds: [...exercise.exerciseMetrics],
    metricDefinitions: structuredClone(metricDefinitions.value),
    targets: {
      repsPerSide: { min: 8, max: 12 },
      loadPerSideKg: 12.5,
    },
    rir: 2,
    restSeconds: 90,
    status: "ready",
    provenance: { source: "manual_build", policyVersion: "manual@1" },
  };
  return {
    id: "slot-1",
    purposeId: "purpose-1",
    exerciseId: exercise.id,
    role: "manual",
    sourceExerciseIds: [exercise.id],
    musclePurposeIds: [...(exercise.primaryFeatureMuscle || [])],
    movementPatternIds: [...(exercise.movementPattern || [])],
    exerciseTypeId: exercise.exerciseType,
    metricIds: [...exercise.exerciseMetrics],
    metricDefinitions: structuredClone(metricDefinitions.value),
    metricOrigin: "source_catalog",
    loadingModel: { bodyweightCoefficient: exercise.bodyweight || 0, assistanceDirection: "subtract" },
    prescriptionsByCycle: [{ cycleIndex: 1, sets: [set] }],
    order: 1,
    ...overrides,
  };
}

function definition(overrides = {}) {
  return {
    schemaVersion: 1,
    generatorVersion: "067.1",
    seed: "shared-setup-proof",
    request: {},
    cycles: 1,
    deloadCycles: [],
    provenance: {
      source: "manual_build",
      policyVersion: "manual@1",
      approximations: [],
      estimatedSessionSeconds: {},
      focusNotApplied: [],
    },
    days: Array.from({ length: 7 }, (_, index) => ({
      id: `day-${index + 1}`,
      name: index === 0 ? "Training day" : `Rest ${index + 1}`,
      kind: index === 0 ? "training" : "rest",
      order: index + 1,
      slots: index === 0 ? [slot()] : [],
    })),
    ...overrides,
  };
}

function document(overrides = {}) {
  return {
    kind: "taurifer-shared-setup",
    version: 2,
    program: {
      name: "Coach program",
      definition: definition(),
      customExercises: [],
    },
    settings: structuredClone(settings),
    language: "pt",
    ...overrides,
  };
}

function compactRepsDocument() {
  const reps = source.exercises.find((entry) => entry.exerciseMetrics?.length === 1
    && Metrics.definitionsForIds(entry.exerciseMetrics).value[0]?.semantic === "reps");
  assert.ok(reps, "raw source has a single-metric repetitions movement for the representative link proof");
  const definitions = Metrics.definitionsForIds(reps.exerciseMetrics).value;
  const targets = { reps: { min: 8, max: 12 } };
  const prescription = {
    id: "compact-set-1",
    cycleIndex: 1,
    setIndex: 1,
    metricType: "source_metrics@1",
    metricIds: [...reps.exerciseMetrics],
    metricDefinitions: structuredClone(definitions),
    targets,
    rir: 2,
    restSeconds: 90,
    status: "ready",
    provenance: { source: "manual_build", policyVersion: "manual@1" },
  };
  const compactSlot = {
    id: "compact-slot-1",
    purposeId: "purpose-1",
    exerciseId: reps.id,
    role: "manual",
    sourceExerciseIds: [reps.id],
    musclePurposeIds: [...(reps.primaryFeatureMuscle || [])],
    movementPatternIds: [...(reps.movementPattern || [])],
    exerciseTypeId: reps.exerciseType,
    metricIds: [...reps.exerciseMetrics],
    metricDefinitions: structuredClone(definitions),
    metricOrigin: "source_catalog",
    loadingModel: { bodyweightCoefficient: reps.bodyweight || 0 },
    prescriptionsByCycle: [{ cycleIndex: 1, sets: [prescription] }],
    order: 1,
  };
  return {
    kind: "taurifer-shared-setup",
    version: 2,
    program: {
      name: "Coach program",
      definition: {
        schemaVersion: 1,
        generatorVersion: "067.1",
        seed: "compact-share-proof",
        request: {},
        days: Array.from({ length: 7 }, (_, index) => ({
          id: `day-${index + 1}`,
          name: index === 0 ? "Training day" : `Rest ${index + 1}`,
          kind: index === 0 ? "training" : "rest",
          order: index + 1,
          slots: index === 0 ? [compactSlot] : [],
        })),
        cycles: 1,
        deloadCycles: [],
        provenance: {
          source: "manual_build",
          policyVersion: "manual@1",
        },
      },
    },
    settings: structuredClone(settings),
    language: "pt",
  };
}

const callbackCalls = [];
function validateDefinition(value, catalogSnapshot, customExercises) {
  callbackCalls.push({
    definition: structuredClone(value),
    catalogSnapshot,
    customExercises: structuredClone(customExercises),
  });
  return Compiler.validateProgramDefinition(value, catalogSnapshot, customExercises);
}
const options = {
  builtInIds,
  catalogSnapshot: source,
  validateProgramDefinition: validateDefinition,
};
const compilerOptions = {
  builtInIds,
  catalogSnapshot: source,
  validateProgramDefinition: Compiler.validateProgramDefinition,
};

function generationRequest(overrides = {}) {
  const movementConfirmations = Object.fromEntries(source.exercises.map((entry) => [entry.id, [...entry.preconditions]]));
  return {
    goal: "hypertrophy",
    experience: "intermediate",
    daysPerWeek: 4,
    timeCeilingMinutes: 120,
    gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
    competencyAnswers: {
      pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
      overheadPress10: null, bodyweightDips10: null, benchPress10: null,
    },
    movementConfirmations,
    emphasisMuscleIds: [],
    deprioritizedMuscleIds: [],
    excludedExerciseIds: [],
    excludedMuscleIds: [],
    preferredExerciseIds: [],
    split: "auto",
    periodization: "static",
    cycles: 7,
    deloadCycles: [],
    ...overrides,
  };
}

async function gzipText(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipText(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesFromBase64url(value) {
  const payload = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(payload + "=".repeat((4 - payload.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

console.log("shared setup v4 semantic protocol");
{
  assert.equal(Setup.KIND, "taurifer-shared-setup");
  assert.equal(Setup.VERSION, 2, "the semantic document advances independently from the v4 wire prefix");
  assert.equal(Setup.MAX_ENCODED_CHARS, 3072);
  assert.ok(Object.prototype.hasOwnProperty.call(Setup, "buildProposal"));
  assert.ok(Object.prototype.hasOwnProperty.call(Setup, "fragmentFromLocation"));
}

console.log("canonical validation and full definition fidelity");
{
  const input = document();
  const original = structuredClone(input);
  const built = Setup.buildProposal(input, options);
  assert.equal(built.ok, true, JSON.stringify(built));
  assert.deepEqual(built.value, input, "validation retains every semantic ProgramDefinition field and array order");
  assert.deepEqual(input, original, "validation does not mutate caller data");
  assert.equal(callbackCalls.at(-1).catalogSnapshot, source, "the raw catalog reaches the injected validator");
  assert.deepEqual(callbackCalls.at(-1).definition, input.program.definition);
  assert.deepEqual(callbackCalls.at(-1).customExercises, []);
  assert.notEqual(built.value, input, "the returned proposal is detached from its input");
  built.value.program.definition.provenance.approximations.push("changed-copy");
  assert.deepEqual(input.program.definition.provenance.approximations, [], "nested provenance is detached from the input");

  const mismatch = document({ language: "en" });
  const rejectedLanguage = Setup.validate(mismatch, options);
  assert.equal(rejectedLanguage.ok, false, "settings.lang and top-level language cannot disagree");
  assert.ok(rejectedLanguage.issues.join(" ").includes("language"));

  const unknownSetting = document({ settings: { ...settings, theme: "dark" } });
  assert.equal(Setup.validate(unknownSetting, options).ok, false, "device appearance is not part of the setup allowlist");
}

console.log("the production compiler validates a complete generated definition");
{
  const generated = Compiler.generateProgram(generationRequest(), source);
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const input = document({ program: { name: "Coach program", definition: generated.value } });
  const validated = Setup.validate(input, compilerOptions);
  assert.equal(validated.ok, true, JSON.stringify(validated.issues));
  assert.deepEqual(validated.value.program.definition, generated.value,
    "the production compiler validates without dropping request, stable IDs, cycles, metric UUIDs, targets, or provenance");
  assert.deepEqual(validated.value.program.definition, generated.value);
  // #458: a generated program names every rest day "Rest"; a setup link carries the repeated names as they are.
  const rests = generated.value.days.filter((day) => day.kind === "rest");
  assert.ok(rests.length >= 2 && rests.every((day) => day.name === "Rest"), "the generated program repeats Rest across its rest days");
  const restInput = compactRepsDocument();
  const restDays = restInput.program.definition.days;
  // A week is seven days: the compact program's training days, then rest days, every one of them "Rest".
  while (restDays.length < 7) restDays.push({ id: `rest_${restDays.length + 1}`, name: "Rest", kind: "rest", order: restDays.length + 1, slots: [] });
  assert.ok(restDays.filter((day) => day.kind === "rest").length >= 2, "the fixture week holds at least two rest days");
  const encodedRests = await Setup.encode(restInput, compilerOptions);
  assert.equal(encodedRests.ok, true, JSON.stringify(encodedRests));
  const decodedRests = await Setup.decode(encodedRests.value, compilerOptions);
  assert.equal(decodedRests.ok, true, JSON.stringify(decodedRests));
  assert.deepEqual(decodedRests.value.program.definition.days.map((day) => [day.kind, day.name]), restDays.map((day) => [day.kind, day.name]),
    "duplicate rest-day names round-trip through a setup link");
}

console.log("v4 encoding preserves scalar leaves in a canonical definition");
{
  const input = compactRepsDocument();
  input.program.definition.request = {
    daysPerWeek: 3,
    competencyAnswers: { pullups10: null, pullups5: false },
  };
  input.program.definition.days[0].slots[0].loadingModel.assistanceDirection = null;
  const encoded = await Setup.encode(input, compilerOptions);
  assert.equal(encoded.ok, true, JSON.stringify(encoded));
  const decoded = await Setup.decode(encoded.value, compilerOptions);
  assert.equal(decoded.ok, true, JSON.stringify(decoded));
  assert.deepEqual(decoded.value, input,
    "numbers, nulls, and booleans roundtrip through the compact definition tree");

  const wire = JSON.parse(await gunzipText(bytesFromBase64url(encoded.value.slice(3))));
  function replaceScalar(value) {
    if (!Array.isArray(value)) return false;
    for (let index = 1; index < value.length; index += 1) {
      if (typeof value[index] === "number") {
        value[index] = "__non_finite_number__";
        return true;
      }
      if (replaceScalar(value[index])) return true;
    }
    return false;
  }
  assert.equal(replaceScalar(wire[2]), true, "the compact definition contains a numeric scalar");
  const malformedJson = JSON.stringify(wire).replace('"__non_finite_number__"', "1e400");
  const malformed = await Setup.decode(`v4.${base64url(await gzipText(malformedJson))}`, compilerOptions);
  assert.equal(malformed.ok, false, "JSON overflow cannot become an accepted non-finite scalar");
  assert.equal(malformed.code, "invalid-envelope");
}

console.log("a crafted link with a non-array where a list belongs is refused, never thrown (#356)");
{
  // The generative property "decode totality" found this with a random seed:
  // `sets: true` inside a slot made decode throw a TypeError instead of
  // refusing the link. Each case is built from a real encoding, with one list
  // replaced on the wire. Expansion keeps key order, so the wire's object
  // entries are matched to the decoded document's keys by position.
  const input = compactRepsDocument();
  const encoded = await Setup.encode(input, compilerOptions);
  assert.equal(encoded.ok, true, JSON.stringify(encoded));
  const decoded = await Setup.decode(encoded.value, compilerOptions);
  assert.equal(decoded.ok, true, JSON.stringify(decoded));
  function replaceList(node, value, key, replacement) {
    if (!Array.isArray(node)) return false;
    if (node[0] === "o" && value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      for (let index = 1, position = 0; index < node.length; index += 2, position += 1) {
        if (keys[position] === key) { node[index + 1] = replacement; return true; }
        if (replaceList(node[index + 1], value[keys[position]], key, replacement)) return true;
      }
    }
    if (node[0] === "a" && Array.isArray(value)) {
      for (let index = 1; index < node.length; index += 1) {
        if (replaceList(node[index], value[index - 1], key, replacement)) return true;
      }
    }
    return false;
  }
  for (const [key, replacement] of [["sets", true], ["prescriptionsByCycle", 1], ["slots", "x"], ["days", true]]) {
    const wire = JSON.parse(await gunzipText(bytesFromBase64url(encoded.value.slice(3))));
    // A catalog-bound definition travels as ["c", catalog fingerprint, tree].
    const tree = wire[2][0] === "c" ? wire[2][2] : wire[2];
    assert.equal(replaceList(tree, decoded.value.program.definition, key, replacement), true,
      `the compact definition carries ${key}`);
    const crafted = `v4.${base64url(await gzipText(JSON.stringify(wire)))}`;
    let refused;
    try {
      refused = await Setup.decode(crafted, compilerOptions);
    } catch (error) {
      assert.fail(`${key}: ${JSON.stringify(replacement)} made decode throw: ${error}`);
    }
    assert.equal(refused.ok, false, `${key}: ${JSON.stringify(replacement)} is refused`);
    assert.ok(["invalid-envelope", "invalid-program-definition"].includes(refused.code),
      `${key}: ${JSON.stringify(replacement)} is refused with a typed invalid code, got ${refused.code}`);
  }
}

console.log("representative complete URL is short and lossless");
{
  const representativeInput = compactRepsDocument();
  const representative = await Setup.encode(representativeInput, compilerOptions);
  assert.equal(representative.ok, true, JSON.stringify(representative));
  const completeUrl = "https://pedrochagasmaster.github.io/repforge/index.html#setup=" + representative.value;
  assert.ok(completeUrl.length <= 700,
    `representative one-movement URL measured ${completeUrl.length} characters`);
  const representativeDecoded = await Setup.decode(representative.value, compilerOptions);
  assert.equal(representativeDecoded.ok, true, JSON.stringify(representativeDecoded));
  assert.deepEqual(representativeDecoded.value, representativeInput,
    "the seven-day, one-movement repetitions-only proposal and all eight settings survive the measured URL roundtrip");
  console.log(`representative complete URL: ${completeUrl.length} characters; lossless`);
}

console.log("a generated compact four-day program fits the setup-link limit losslessly");
{
  const request = structuredClone(workerFixture.request);
  delete request.seed;
  Object.assign(request, {
    daysPerWeek: 4,
    timeCeilingMinutes: 40,
    cycles: 7,
    deloadCycles: [],
    split: "auto",
  });
  const generated = Compiler.generateProgram(request, source);
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const training = generated.value.days.filter((day) => day.kind === "training");
  assert.equal(training.length, 4, "the complete proposal contains every requested training day");
  assert.ok(training.every((day) => day.slots.length > 0), "no requested day is replaced with an empty placeholder");
  const input = document({ program: { name: "Compact four-day", definition: generated.value } });
  const generatorOptions = { ...compilerOptions, generateProgram: Compiler.generateProgram,
    generatorVersion: Compiler.GENERATOR_VERSION };
  const encoded = await Setup.encode(input, generatorOptions);
  assert.equal(encoded.ok, true, JSON.stringify(encoded));
  assert.ok(encoded.value.length <= Setup.MAX_ENCODED_CHARS,
    `generated compact four-day link measured ${encoded.value.length} characters`);
  const decoded = await Setup.decode(encoded.value, generatorOptions);
  assert.equal(decoded.ok, true, JSON.stringify(decoded));
  assert.deepEqual(decoded.value, input,
    "a real generated four-day proposal preserves every day, stable identity, metric, target, and setting");
}

console.log("source identity, structural identities, and unsafe values");
{
  const unknown = document();
  unknown.program.definition.days[0].slots[0].exerciseId = "old-short-id";
  assert.equal(Setup.validate(unknown, options).ok, false, "unknown or retired IDs never fuzzy-match a raw UUID");

  const unresolvedCustom = document();
  unresolvedCustom.program.definition.days[0].slots[0].exerciseId = "custom:missing";
  assert.equal(Setup.validate(unresolvedCustom, options).ok, false, "a custom reference needs its exact definition");

  const custom = document();
  const customDefinition = {
    id: "custom:coach-row",
    name: "Coach row",
    metricIds: [],
    metricDefinitions: [],
  };
  custom.program.definition.days[0].slots[0].exerciseId = customDefinition.id;
  custom.program.definition.days[0].slots[0].sourceExerciseIds = [customDefinition.id];
  custom.program.definition.days[0].slots[0].metricOrigin = "user_defined";
  custom.program.definition.days[0].slots[0].metricIds = [];
  custom.program.definition.days[0].slots[0].metricDefinitions = [];
  custom.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].status = "configuration_required";
  custom.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].metricIds = [];
  custom.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].metricDefinitions = [];
  custom.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].targets = {};
  custom.program.customExercises = [customDefinition];
  const checkedCustom = Setup.validate(custom, options);
  assert.equal(checkedCustom.ok, true, JSON.stringify(checkedCustom));
  assert.deepEqual(checkedCustom.value.program.customExercises, [customDefinition]);
  assert.deepEqual(callbackCalls.at(-1).customExercises, [customDefinition]);

  const performedCustom = document();
  const performedCustomId = "custom:privacy-proof";
  const performedCustomSlot = performedCustom.program.definition.days[0].slots[0];
  performedCustomSlot.exerciseId = performedCustomId;
  performedCustomSlot.sourceExerciseIds = [performedCustomId];
  performedCustomSlot.metricOrigin = "user_defined";
  const canonicalCustomDefinition = {
    id: performedCustomId,
    name: "Coach movement",
    namePt: "Movimento do coach",
    equipment: ["machine"],
    primary: "",
    secondary: "",
    notes: "",
    metricIds: [...exercise.exerciseMetrics],
    metricDefinitions: structuredClone(metricDefinitions.value),
  };
  const validCustom = document();
  const validCustomSlot = validCustom.program.definition.days[0].slots[0];
  validCustomSlot.exerciseId = performedCustomId;
  validCustomSlot.sourceExerciseIds = [performedCustomId];
  validCustomSlot.metricOrigin = "user_defined";
  validCustomSlot.metricIds = [...exercise.exerciseMetrics];
  validCustomSlot.metricDefinitions = structuredClone(metricDefinitions.value);
  validCustomSlot.prescriptionsByCycle[0].sets[0].metricIds = [...exercise.exerciseMetrics];
  validCustomSlot.prescriptionsByCycle[0].sets[0].metricDefinitions = structuredClone(metricDefinitions.value);
  validCustomSlot.prescriptionsByCycle[0].sets[0].targets = {};
  validCustomSlot.prescriptionsByCycle[0].sets[0].status = "manual";
  validCustom.program.customExercises = [canonicalCustomDefinition];
  assert.equal(Setup.validate(validCustom, compilerOptions).ok, true,
    "the canonical custom definition is accepted before performed data is added");

  const performedCustomDefinition = structuredClone(canonicalCustomDefinition);
  performedCustomDefinition.performedValues = [
    { metricId: exercise.exerciseMetrics[0], value: 777, unit: metricDefinitions.value[0].unit },
  ];
  performedCustomDefinition.metricDefinitions[0].metricValues = [
    { metricId: exercise.exerciseMetrics[0], value: 888, unit: metricDefinitions.value[0].unit },
  ];
  performedCustom.program.customExercises = [performedCustomDefinition];
  const performedCustomSlotForDefinition = performedCustom.program.definition.days[0].slots[0];
  performedCustomSlotForDefinition.metricIds = [...exercise.exerciseMetrics];
  performedCustomSlotForDefinition.metricDefinitions = structuredClone(metricDefinitions.value);
  performedCustomSlotForDefinition.prescriptionsByCycle[0].sets[0].metricIds = [...exercise.exerciseMetrics];
  performedCustomSlotForDefinition.prescriptionsByCycle[0].sets[0].metricDefinitions = structuredClone(metricDefinitions.value);
  performedCustomSlotForDefinition.prescriptionsByCycle[0].sets[0].targets = {};
  performedCustomSlotForDefinition.prescriptionsByCycle[0].sets[0].status = "manual";
  assert.equal(Setup.validate(performedCustom, compilerOptions).ok, false,
    "performed and metric actuals are rejected anywhere in a custom exercise definition");

  const repeatedDay = document();
  repeatedDay.program.definition.days[1].id = repeatedDay.program.definition.days[0].id;
  assert.equal(Setup.validate(repeatedDay, options).ok, false, "duplicate day IDs are rejected");

  const repeatedMovement = document();
  const secondSlot = structuredClone(repeatedMovement.program.definition.days[0].slots[0]);
  secondSlot.id = "slot-2";
  secondSlot.order = 2;
  secondSlot.prescriptionsByCycle[0].sets[0].id = "set-2";
  repeatedMovement.program.definition.days[0].slots.push(secondSlot);
  assert.equal(Setup.validate(repeatedMovement, options).ok, true,
    "manual definitions may use the same movement in distinct stable slots");

  const repeatedSlot = document();
  const duplicateSlot = structuredClone(repeatedSlot.program.definition.days[0].slots[0]);
  duplicateSlot.order = 2;
  duplicateSlot.prescriptionsByCycle[0].sets[0].id = "set-2";
  repeatedSlot.program.definition.days[0].slots.push(duplicateSlot);
  assert.equal(Setup.validate(repeatedSlot, options).ok, false, "duplicate slot identities are rejected");

  const repeatedSet = document();
  const secondSet = structuredClone(repeatedSet.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0]);
  secondSet.setIndex = 2;
  repeatedSet.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets.push(secondSet);
  assert.equal(Setup.validate(repeatedSet, options).ok, false, "duplicate prescription identities are rejected");

  const actual = document();
  actual.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].actual = { loadKg: 20 };
  assert.equal(Setup.validate(actual, options).ok, false, "performed values cannot enter a setup proposal");

  const polluted = document();
  polluted.program.definition.request = JSON.parse('{"goal":"hypertrophy","__proto__":{"polluted":true}}');
  assert.equal(Setup.validate(polluted, options).ok, false, "unsafe property names are rejected at any depth");

  const nonFinite = document();
  nonFinite.program.definition.request.invalid = Number.NaN;
  assert.equal(Setup.validate(nonFinite, options).ok, false, "non-JSON numeric values are rejected");
}

console.log("v4 compact wire, roundtrip, and legacy byte retention");
{
  const input = document();
  const encoded = await Setup.encode(input, compilerOptions);
  assert.equal(encoded.ok, true, JSON.stringify(encoded));
  assert.match(encoded.value, /^v4\./);
  assert.ok(encoded.value.length <= 3072);
  const wire = JSON.parse(await gunzipText(bytesFromBase64url(encoded.value.slice(3))));
  assert.ok(Array.isArray(wire), "v4 uses a compact positional envelope");
  assert.equal(wire[0], 2, "the inner semantic version is explicit");
  assert.equal(JSON.stringify(wire).includes('"lang"'), false, "the compact envelope carries language once");
  const decoded = await Setup.decode(encoded.value, compilerOptions);
  assert.equal(decoded.ok, true, JSON.stringify(decoded));
  assert.deepEqual(decoded.value, input, "gzip/JSON roundtrip reconstructs the complete semantic document");
  assert.equal(decoded.compressedBytes, encoded.compressedBytes);
  assert.deepEqual(Setup.buildProposal(decoded.value, compilerOptions).value, input);

  for (const version of [1, 2, 3, 6, 99]) {
    const sourceBytes = `v${version}.not-even-base64%2Fbytes`;
    const rejected = await Setup.decode(sourceBytes, options);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.code, "unsupported-version");
    assert.equal(rejected.version, version);
    assert.equal(rejected.encoded, sourceBytes, "unsupported bytes remain available for retention or re-export");
  }

  const invalidGzip = await Setup.decode("v4.AA", options);
  assert.equal(invalidGzip.ok, false);
  assert.equal(invalidGzip.code, "invalid-gzip");
  assert.equal((await Setup.decode("v4.=", options)).code, "invalid-base64");
}

console.log("hard size refusal never truncates semantic fields");
{
  const generated = Compiler.generateProgram(generationRequest({ cycles: 8, deloadCycles: [8] }), source);
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const tooLarge = document({ program: { name: "Coach program", definition: generated.value } });
  const before = structuredClone(tooLarge);
  const validated = Setup.validate(tooLarge, compilerOptions);
  assert.equal(validated.ok, true, JSON.stringify(validated.issues));
  const rejected = await Setup.encode(tooLarge, compilerOptions);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "encoded-too-large");
  assert.deepEqual(tooLarge, before, "failed size checks leave the complete input unchanged");
  assert.equal(tooLarge.program.definition.cycles, 8, "too-large programs are not trimmed to fewer cycles");
}

console.log("fragment and cookie handoff helpers retain source bytes");
{
  const rawValue = "v3.legacy%2Fpayload+with%2Bbytes";
  assert.equal(
    Setup.fragmentFromLocation(`https://example.test/index.html#keep=a%2Fb&setup=${rawValue}`),
    rawValue,
    "fragment extraction preserves the encoded bytes without URLSearchParams normalization",
  );
  assert.equal(Setup.readSetupFragment(`https://example.test/index.html#setup=${rawValue}`), rawValue);
  assert.equal(Setup.removeSetupFragment(`https://example.test/repforge/index.html#keep=a%2Fb&setup=${rawValue}`), "/repforge/index.html#keep=a%2Fb");

  const store = new Map();
  let lastWrite = "";
  const writes = [];
  const documentAdapter = {
    get cookie() { return [...store].map(([key, value]) => `${key}=${value}`).join("; "); },
    set cookie(raw) {
      lastWrite = raw;
      writes.push(raw);
      const [pair, ...attributes] = raw.split(";").map((part) => part.trim());
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) store.delete(name);
      else store.set(name, value);
    },
  };
  const locationAdapter = { href: "https://example.test/repforge/index.html", hostname: "example.test", protocol: "https:" };
  const adapters = { document: documentAdapter, location: locationAdapter };
  assert.equal(Setup.writeHandoffCookie(rawValue, adapters), false, "an unsupported legacy value is not rewritten as a new proposal");
  assert.equal(lastWrite, "");
  assert.equal(Setup.readHandoffCookie(adapters), null);
  const encoded = await Setup.encode(document(), options);
  assert.equal(Setup.writeHandoffCookie(encoded.value, adapters), true);
  assert.equal(Setup.readHandoffCookie(adapters), encoded.value, "cookie reads preserve the exact v4 envelope");
  assert.match(lastWrite, /Path=\/repforge\/;/, "the handoff cookie is scoped to the app, not its document URL");
  assert.match(lastWrite, /Max-Age=604800/);
  assert.match(lastWrite, /SameSite=Lax/);
  assert.match(lastWrite, /; Secure$/);
  const expiresLegacy = (entry) => entry.startsWith("repforge_setup_v1=;") && entry.includes("Path=/repforge/index.html;") && entry.includes("Max-Age=0");
  assert.ok(writes.some(expiresLegacy), "a write expires the cookie a release before the scope path left at the document URL");
  const writesBeforeClear = writes.length;
  assert.equal(Setup.clearHandoffCookie(adapters), true);
  assert.equal(Setup.readHandoffCookie(adapters), null);
  const clears = writes.slice(writesBeforeClear);
  assert.ok(clears.some(expiresLegacy) && clears.some((entry) => entry.startsWith("repforge_setup_v1=;") && entry.includes("Path=/repforge/;") && entry.includes("Max-Age=0")),
    "clear expires both the scope and the legacy document path");
}

// R13: a generated program is far larger than a link can carry. An unedited one
// travels as its canonical generator request; the receiver regenerates it with
// the same generator version and must arrive at the identical definition.
{
  const generatorOptions = { ...compilerOptions, generateProgram: Compiler.generateProgram,
    generatorVersion: Compiler.GENERATOR_VERSION };
  // As Generate produces it: no per-movement confirmations.
  const request = generationRequest({ cycles: 7, timeCeilingMinutes: 90, movementConfirmations: {} });
  const generated = Compiler.generateProgram(request, source);
  assert.equal(generated.ok, true);
  const shared = document({ program: { name: "Generated", definition: generated.value } });
  const full = await Setup.encode(shared, compilerOptions);
  assert.equal(full.ok, false, "without the generator the full seven-cycle definition does not fit");
  assert.equal(full.code, "encoded-too-large");
  const compact = await Setup.encode(shared, generatorOptions);
  assert.equal(compact.ok, true, `an unedited generated program encodes by canonical request: ${compact.code || ""}`);
  assert.ok(compact.value.length <= 3072, `regenerable link fits the limit (${compact.value.length})`);
  const received = await Setup.decode(compact.value, generatorOptions);
  assert.equal(received.ok, true, `the regenerable link decodes: ${received.code || ""}`);
  assert.deepEqual(received.value.program.definition, generated.value, "the receiver regenerates the identical definition");
  const reorderedCatalog = structuredClone(source);
  reorderedCatalog.generatedAt = "different publication timestamp";
  reorderedCatalog.exercises.reverse();
  const reordered = await Setup.decode(compact.value, { ...generatorOptions, catalogSnapshot: reorderedCatalog });
  assert.equal(reordered.ok, true, "catalogue publication timestamp and container order preserve recipe identity");
  assert.deepEqual(reordered.value.program.definition, generated.value);
  const changedCatalog = structuredClone(source);
  changedCatalog.exercises[0].name += " changed";
  let unexpectedGeneration = 0;
  const changed = await Setup.decode(compact.value, { ...generatorOptions, catalogSnapshot: changedCatalog,
    generateProgram: () => { unexpectedGeneration++; throw Error("catalogue mismatch must precede generation"); } });
  assert.equal(changed.ok, false, "semantic catalogue changes refuse a bound recipe");
  assert.equal(changed.code, "catalog-mismatch");
  assert.equal(unexpectedGeneration, 0);
  const withoutGenerator = await Setup.decode(compact.value, compilerOptions);
  assert.equal(withoutGenerator.ok, false, "a regenerable link needs the generator to decode");
  const otherVersion = await Setup.decode(compact.value, { ...generatorOptions, generatorVersion: "999.0" });
  assert.equal(otherVersion.ok, false, "a different generator version refuses rather than regenerating something else");
  assert.equal(otherVersion.code, "unsupported-version");

  // #527: an edited generated program is never silently replaced by its regeneration; it travels as the request plus
  // its edits and arrives exactly as the sender had it.
  const edited = structuredClone(generated.value);
  edited.days.find((day) => day.kind === "training").slots[0].setupNotes = "Rack at 7";
  const editedResult = await Setup.encode(document({ program: { name: "Edited", definition: edited } }), generatorOptions);
  assert.equal(editedResult.ok, true, editedResult.code);
  assert.equal(editedResult.form, "patch", "an edited generated program travels as its recipe plus the edit");
  const editedReceived = await Setup.decode(editedResult.value, generatorOptions);
  assert.equal(editedReceived.ok, true, editedReceived.code);
  assert.equal(editedReceived.value.program.definition.days.find((day) => day.kind === "training").slots[0].setupNotes, "Rack at 7",
    "the edit arrives, not the regeneration");
}

// #340 (Plan 072 OD-11): a plain GENERATOR_VERSION bump retires every recipe
// link made by the earlier generator. The fixture is a real link recorded with
// 067.1 for a program that answers pullups10 = yes, which the current
// generator builds differently. With the app's own codec options it is refused
// as unsupported, the reason the receiver asks for the program to be shared
// again, and the generator is never even run: nothing can regenerate it into a
// different program.
{
  const legacy = JSON.parse(fs.readFileSync(join(root, "test/fixtures/setup-link-recipe-067-1.json"), "utf8"));
  assert.notEqual(Compiler.GENERATOR_VERSION, legacy.generatorVersion, "the generator has moved past the recorded link");
  const releaseCatalog = JSON.parse(fs.readFileSync(join(root, "assets/exercise-catalog.json"), "utf8"));
  const { EXERCISE_LIBRARY } = require(join(root, "exercises.js"));
  let generated = 0;
  const appOptions = { builtInIds: new Set(EXERCISE_LIBRARY.map((entry) => entry.id)), catalogSnapshot: releaseCatalog,
    validateProgramDefinition: Compiler.validateProgramDefinition,
    generateProgram: (...args) => { generated++; return Compiler.generateProgram(...args); },
    generatorVersion: Compiler.GENERATOR_VERSION };
  const refused = await Setup.decode(legacy.link, appOptions);
  assert.equal(refused.ok, false, "a recipe link from the earlier generator is refused");
  assert.equal(refused.code, "unsupported-version", "and refused as unsupported, not as invalid");
  assert.equal(generated, 0, "the generator never runs for it");
}

// #317: alternate identities travel in the full definition. A current large
// edited program may need a file; that refusal must never drop the alternates.
{
  const generatorOptions = { ...compilerOptions, generateProgram: Compiler.generateProgram,
    generatorVersion: Compiler.GENERATOR_VERSION };
  const request = structuredClone(workerFixture.request);
  delete request.seed;
  Object.assign(request, { daysPerWeek: 2, timeCeilingMinutes: 20, cycles: 7, deloadCycles: [], split: "auto" });
  const generated = Compiler.generateProgram(request, source);
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const unchanged = document({ program: { name: "Generated program", definition: generated.value } });
  const recipe = await Setup.encode(unchanged, generatorOptions);
  assert.equal(recipe.ok, true, recipe.code);
  assert.equal(recipe.form, "recipe", "the unedited current program is exactly regenerable");
  const editedDefinition = structuredClone(generated.value);
  const generatedSlots = editedDefinition.days.flatMap((day) => day.slots);
  const customAlternate = { id: "custom:alt", name: "Coach press",
    equipment: [], primary: "", secondary: "", notes: "", metricIds: [], metricDefinitions: [] };
  generatedSlots[0].alternates = [customAlternate.id, generatedSlots[1].exerciseId];
  const edited = document({ program: { name: "Generated with alternates", definition: editedDefinition,
    customExercises: [customAlternate] } });
  const before = structuredClone(edited);
  const patched = await Setup.encode(edited, generatorOptions);
  assert.equal(patched.ok, true, patched.code);
  assert.equal(patched.form, "patch", "the edited generated program travels as its recipe plus edits (#527)");
  assert.deepEqual(edited, before, "encoding leaves every authored alternate and prescription in place");
  const patchedReceived = await Setup.decode(patched.value, generatorOptions);
  assert.equal(patchedReceived.ok, true, patchedReceived.code);
  assert.deepEqual(patchedReceived.value, edited, "the alternates and the custom movement they name arrive unchanged");

  const compact = definition();
  const first = compact.days.flatMap((day) => day.slots)[0];
  const catalogAlternate = generatedSlots.find((slot) => slot.exerciseId !== first.exerciseId).exerciseId;
  first.alternates = [customAlternate.id, catalogAlternate];
  const input = document({ program: { name: "Coach program with alternates", definition: compact,
    customExercises: [customAlternate] } });
  const encoded = await Setup.encode(input, generatorOptions);
  assert.equal(encoded.ok, true, `a compact full definition with alternates shares losslessly: ${encoded.code || ""}`);
  const wire = JSON.parse(await gunzipText(bytesFromBase64url(encoded.value.slice(3))));
  const form = wire.find((entry) => Array.isArray(entry) && (entry[0] === "g" || entry[0] === "c"))?.[0];
  assert.equal(form, "c", "the full form carries catalog and custom alternate identities");
  const decoded = await Setup.decode(encoded.value, generatorOptions);
  assert.equal(decoded.ok, true, JSON.stringify(decoded));
  assert.deepEqual(decoded.value, input, "the alternates and the custom movement they name arrive unchanged");
  const dropped = structuredClone(input);
  dropped.program.customExercises = [];
  assert.equal(Setup.validate(dropped, compilerOptions).ok, false,
    "a custom alternate without its definition is refused, never left dangling");
}

// Plan 076: a five-week generated program travels as a recipe, and a recipe
// stamped by 073.4 is refused as unsupported (the receiver is asked to have it
// shared again) instead of being rebuilt under 073.5.
{
  const generatorOptions = { ...compilerOptions, generateProgram: Compiler.generateProgram,
    generatorVersion: Compiler.GENERATOR_VERSION };
  const request = structuredClone(workerFixture.request);
  delete request.seed;
  Object.assign(request, { daysPerWeek: 3, timeCeilingMinutes: 60, cycles: 5, deloadCycles: [], split: "auto", periodization: "linear" });
  const fiveWeeks = Compiler.generateProgram(request, source);
  assert.equal(fiveWeeks.ok, true, JSON.stringify(fiveWeeks.conflicts));
  assert.equal(fiveWeeks.value.cycles, 5);
  const encoded = await Setup.encode(document({ program: { name: "Five weeks", definition: fiveWeeks.value } }), generatorOptions);
  assert.equal(encoded.ok, true, encoded.code);
  assert.equal(encoded.form, "recipe", "a five-week generated program is regenerable from its request");
  const decoded = await Setup.decode(encoded.value, generatorOptions);
  assert.equal(decoded.ok, true, decoded.code);
  assert.deepEqual(decoded.value.program.definition, fiveWeeks.value, "the recipe rebuilds the identical five-week definition");

  const seven = { ...request, cycles: 7 };
  const asOld = { ...generatorOptions, generatorVersion: "073.4",
    generateProgram: (value, catalog) => Compiler.generateProgram(value, catalog, { asVersion: "073.4" }) };
  const oldProgram = Compiler.generateProgram(seven, source, { asVersion: "073.4" });
  const oldLink = await Setup.encode(document({ program: { name: "Before the update", definition: oldProgram.value } }), asOld);
  assert.equal(oldLink.form, "recipe", "073.4 made this link as a recipe");
  const refused = await Setup.decode(oldLink.value, generatorOptions);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "unsupported-version", "a 073.4 recipe is refused on 073.5, never rebuilt into a different program");
  const resent = await Setup.encode(document({ program: { name: "Before the update", definition: oldProgram.value } }), generatorOptions);
  assert.equal(resent.ok, false, "a 073.4 program no longer regenerates exactly, so it cannot be a recipe link now");
  assert.equal(resent.code, "encoded-too-large", "its patch against 073.5 (renamed ids) is too large, and so is the full form");
}

// #527: an edited generated program travels as its generator request plus an id-keyed patch against what that request
// regenerates, on the v5 wire. The receiver regenerates, applies the patch, and must reproduce the sender's canonical
// definition exactly (a digest travels with it); anything else is refused. Recipe and full links stay v4, unchanged.
{
  const generatorOptions = { ...compilerOptions, generateProgram: Compiler.generateProgram,
    generatorVersion: Compiler.GENERATOR_VERSION };
  const canonical = (value) => {
    const order = (v) => Array.isArray(v) ? v.map(order) : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, order(v[key])])) : v;
    return JSON.stringify(order(value));
  };
  let uuid = 0;
  const editorId = () => `5f0c${String(++uuid).padStart(4, "0")}-6f7e-4a1b-9c3d-${String(uuid * 7919).padStart(12, "0")}`;
  const program = (daysPerWeek, minutes) => {
    const request = structuredClone(workerFixture.request);
    delete request.seed;
    Object.assign(request, { daysPerWeek, timeCeilingMinutes: minutes, cycles: 7, deloadCycles: [], split: "auto" });
    const generated = Compiler.generateProgram(request, source);
    assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
    return generated.value;
  };
  const trainingSlots = (definition) => definition.days.filter((day) => day.kind === "training").flatMap((day) => day.slots);
  // The editor's own edits: a set added in every cycle (a fresh id each), rest, a rep range, a rename and a reorder.
  const typicalReview = (base) => {
    const edited = structuredClone(base);
    const slots = trainingSlots(edited);
    for (const target of [slots[0], slots[4]]) for (const cycle of target.prescriptionsByCycle) {
      cycle.sets.push({ ...structuredClone(cycle.sets.at(-1)), id: editorId(), setIndex: cycle.sets.length + 1 });
    }
    for (const cycle of slots[2].prescriptionsByCycle) for (const set of cycle.sets) set.restSeconds = (set.restSeconds || 90) + 30;
    for (const cycle of slots[3].prescriptionsByCycle) for (const set of cycle.sets) if (set.targets?.reps) set.targets.reps = { min: 6, max: 8 };
    const day = edited.days.find((entry) => entry.kind === "training");
    day.name = "Superior A";
    [day.slots[0], day.slots[1]] = [day.slots[1], day.slots[0]];
    day.slots.forEach((entry, index) => { entry.order = index + 1; });
    return edited;
  };
  const swapTwo = (edited) => {
    const swapped = structuredClone(edited);
    const slots = trainingSlots(swapped);
    let made = 0;
    for (const target of [slots[5], slots[8]]) {
      const alternate = source.exercises.find((entry) => entry.id !== target.exerciseId
        && JSON.stringify(entry.exerciseMetrics) === JSON.stringify(target.metricIds)
        && (entry.movementPattern || []).some((pattern) => (target.movementPatternIds || []).includes(pattern)));
      if (!alternate) continue;
      Object.assign(target, { exerciseId: alternate.id, sourceExerciseIds: [alternate.id], exerciseTypeId: alternate.exerciseType,
        displayName: alternate.name, musclePurposeIds: [...alternate.primaryFeatureMuscle], movementPatternIds: [...alternate.movementPattern],
        loadingModel: { ...target.loadingModel, bodyweightCoefficient: alternate.bodyweight } });
      made++;
    }
    assert.equal(made, 2, "two catalog alternatives are swapped in");
    return swapped;
  };
  const roundTrip = async (label, definition) => {
    const sent = document({ program: { name: label, definition } });
    const encoded = await Setup.encode(sent, generatorOptions);
    assert.equal(encoded.ok, true, `${label}: ${encoded.code || ""}`);
    assert.equal(encoded.form, "patch", `${label}: travels as the recipe plus its edits`);
    assert.ok(encoded.value.startsWith("v5.") && encoded.compressedBytes <= Setup.MAX_COMPRESSED_BYTES && encoded.value.length <= Setup.MAX_ENCODED_CHARS,
      `${label}: a v5 link within the limits (${encoded.value.length} chars, ${encoded.compressedBytes} B)`);
    const received = await Setup.decode(encoded.value, generatorOptions);
    assert.equal(received.ok, true, `${label}: ${received.code || ""}`);
    assert.equal(canonical(received.value.program.definition), canonical(Setup.canonicalize(definition)),
      `${label}: the receiver's definition is byte-identical to the sender's, canonically`);
    return encoded;
  };

  // One edit: rest on one slot, in every cycle.
  const small = program(3, 60);
  const oneEdit = structuredClone(small);
  for (const cycle of trainingSlots(oneEdit)[0].prescriptionsByCycle) for (const set of cycle.sets) set.restSeconds = (set.restSeconds || 90) + 30;
  const one = await roundTrip("one edit", oneEdit);
  assert.ok(one.compressedBytes < 1100, `one edit costs little over the recipe (${one.compressedBytes} B)`);

  // A typical review, on each program shape the investigation measured, and the two-swap edge case on the 18-slot one.
  for (const [days, minutes] of [[3, 60], [3, 90], [4, 60], [5, 60]]) {
    const base = days === 3 && minutes === 60 ? small : program(days, minutes);
    await roundTrip(`typical review, ${days} days x ${minutes} min`, typicalReview(base));
  }
  const edge = await roundTrip("typical review + 2 swaps, 18 slots", swapTwo(typicalReview(small)));
  assert.equal(trainingSlots(small).length, 18, "the edge case is the 18-slot program");
  assert.ok(edge.compressedBytes < Setup.MAX_COMPRESSED_BYTES, `the edge case fits (${edge.compressedBytes} of ${Setup.MAX_COMPRESSED_BYTES} B)`);

  // Over the cap: edits too many to carry fall back to the full form, which is refused whole, so the share sheet offers
  // the file; the sender's program is untouched.
  const heavy = structuredClone(small);
  for (const target of trainingSlots(heavy)) for (const cycle of target.prescriptionsByCycle) for (const set of cycle.sets) {
    set.id = editorId();
    set.restSeconds = 37 + (cycle.cycleIndex * 11 + set.setIndex * 3) % 50;
  }
  const heavyBefore = structuredClone(heavy);
  const over = await Setup.encode(document({ program: { name: "Rewritten", definition: heavy } }), generatorOptions);
  assert.equal(over.ok, false, "a patch over the cap is not sent");
  assert.equal(over.code, "encoded-too-large");
  assert.equal(over.form, "full", "it falls back to the full form, which is too large too, so the file is offered");
  assert.deepEqual(heavy, heavyBefore, "the refusal leaves the program untouched");

  // The patch must reproduce the sender's definition exactly; a changed digest, a patch that no longer applies, or the
  // patch form on the v4 wire is refused, never a partial or different program.
  const rewrap = async (encoded, change) => {
    const wire = JSON.parse(await gunzipText(bytesFromBase64url(encoded.slice(3))));
    change(wire);
    const bytes = new TextEncoder().encode(JSON.stringify(wire));
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    const gz = new Uint8Array(await new Response(stream).arrayBuffer());
    return encoded.slice(0, 3) + Buffer.from(gz).toString("base64url");
  };
  const digestChanged = await Setup.decode(await rewrap(one.value, (wire) => { wire[2][5] = "000000000000"; }), generatorOptions);
  assert.equal(digestChanged.ok, false, "a digest the patched definition does not match is refused");
  assert.equal(digestChanged.code, "invalid-envelope");
  const badIndex = await Setup.decode(await rewrap(one.value, (wire) => { wire[2][4] = ["i", null, [999, ["o"]]]; }), generatorOptions);
  assert.equal(badIndex.ok, false, "a patch naming an element that does not exist is refused");
  const forbidden = await Setup.decode(await rewrap(one.value, (wire) => {
    wire[2][4] = ["o", "~" + Buffer.from("__proto__").toString("base64url"), ["=", 1]];
  }), generatorOptions);
  assert.equal(forbidden.ok, false, "a patch cannot reach a forbidden key");
  const onV4 = await Setup.decode("v4." + (await rewrap(one.value, () => {})).slice(3), generatorOptions);
  assert.equal(onV4.ok, false, "the patch form exists only on the v5 wire");
  const otherGenerator = await Setup.decode(one.value, { ...generatorOptions, generatorVersion: "999.0" });
  assert.equal(otherGenerator.code, "unsupported-version", "a patch link from another generator version is refused as unsupported");

  // An app that reads only v4 (main before #527) refuses the v5 link as a newer, unsupported one, and still reads v4.
  // test/fixtures/shared-setup-v4-only.cjs is shared-setup.js as it was at b1aeedd8, before #527; it finds its sibling
  // modules through the globals the app provides.
  globalThis.RepForgeGenerationIdentity ||= require(join(root, "generation-identity.js"));
  globalThis.RepForgeExerciseMetrics ||= Metrics;
  const OldSetup = require(join(root, "test/fixtures/shared-setup-v4-only.cjs"));
  const oldRefusal = await OldSetup.decode(one.value, generatorOptions);
  assert.equal(oldRefusal.ok, false);
  assert.equal(oldRefusal.code, "unsupported-version", "the v4-only reader refuses a v5 link cleanly");
  assert.equal(oldRefusal.version, 5, "as a newer link (the app says setup.shared.unsupported)");
  const unchangedRecipe = await Setup.encode(document({ program: { name: "Unchanged", definition: small } }), generatorOptions);
  assert.equal(unchangedRecipe.form, "recipe");
  assert.ok(unchangedRecipe.value.startsWith("v4."), "an unedited program is still a v4 recipe link");
  const oldReads = await OldSetup.decode(unchangedRecipe.value, generatorOptions);
  assert.equal(oldReads.ok, true, "and the v4-only reader still opens it");
}

console.log("PASS shared setup v4 protocol contract");
