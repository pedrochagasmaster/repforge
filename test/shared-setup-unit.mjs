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
    cycles: 1,
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
  const generated = Compiler.generateProgram(generationRequest(), source, "shared-setup-generated-proof");
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const input = document({ program: { name: "Coach program", definition: generated.value } });
  const validated = Setup.validate(input, compilerOptions);
  assert.equal(validated.ok, true, JSON.stringify(validated.issues));
  assert.deepEqual(validated.value.program.definition, generated.value,
    "the production compiler validates without dropping request, stable IDs, cycles, metric UUIDs, targets, or provenance");
  assert.deepEqual(validated.value.program.definition, generated.value);
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
  const seed = request.seed;
  delete request.seed;
  Object.assign(request, {
    daysPerWeek: 4,
    timeCeilingMinutes: 40,
    cycles: 1,
    deloadCycles: [],
    split: "auto",
  });
  const generated = Compiler.generateProgram(request, source, seed);
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  assert.deepEqual(generated.value.days.filter((day) => day.kind === "training")
    .map((day) => day.slots.length), [4, 3, 5, 3]);
  const input = document({ program: { name: "Compact four-day", definition: generated.value } });
  const encoded = await Setup.encode(input, compilerOptions);
  assert.equal(encoded.ok, true, JSON.stringify(encoded));
  assert.ok(encoded.value.length <= Setup.MAX_ENCODED_CHARS,
    `generated compact four-day link measured ${encoded.value.length} characters`);
  const decoded = await Setup.decode(encoded.value, compilerOptions);
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

  for (const version of [1, 2, 3, 5, 99]) {
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
  const generated = Compiler.generateProgram(generationRequest({ cycles: 12 }), source, "shared-setup-size-proof");
  assert.equal(generated.ok, true, JSON.stringify(generated.conflicts));
  const tooLarge = document({ program: { name: "Coach program", definition: generated.value } });
  const before = structuredClone(tooLarge);
  const validated = Setup.validate(tooLarge, compilerOptions);
  assert.equal(validated.ok, true, JSON.stringify(validated.issues));
  const rejected = await Setup.encode(tooLarge, compilerOptions);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "encoded-too-large");
  assert.deepEqual(tooLarge, before, "failed size checks leave the complete input unchanged");
  assert.equal(tooLarge.program.definition.cycles, 12, "too-large programs are not trimmed to fewer cycles");
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
  const documentAdapter = {
    get cookie() { return [...store].map(([key, value]) => `${key}=${value}`).join("; "); },
    set cookie(raw) {
      lastWrite = raw;
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
  assert.match(lastWrite, /Path=\/repforge\/index\.html/);
  assert.match(lastWrite, /Max-Age=604800/);
  assert.match(lastWrite, /SameSite=Lax/);
  assert.match(lastWrite, /; Secure$/);
  assert.equal(Setup.clearHandoffCookie(adapters), true);
  assert.equal(Setup.readHandoffCookie(adapters), null);
}

console.log("PASS shared setup v4 protocol contract");
