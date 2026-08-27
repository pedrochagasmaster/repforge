#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(root, "progression-engine.js");
const require = createRequire(import.meta.url);
const Engine = require(modulePath);

assert.equal(Engine.ENGINE_VERSION, 1);
assert.deepEqual(Engine.STRATEGY_IDS, ["range", "rep_goal", "anchor_backoff", "manual"]);
assert.ok(Object.isFrozen(Engine));
assert.ok(Object.isFrozen(Engine.CAPACITY));

const imported = await import(`${pathToFileURL(modulePath).href}?purity=${Date.now()}`);
assert.equal(imported.default.ENGINE_VERSION, 1, "dynamic import must expose the CommonJS UMD API");

const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["document", "localStorage", "sessionStorage", "XMLHttpRequest", "fetch("]) {
  assert.ok(!source.includes(forbidden), `pure module must not contain ${forbidden}`);
}

assert.equal(Engine.capRir(3, 4), 3);
assert.equal(Engine.capRir(99, 4), 4);
assert.equal(Engine.capRir(-2, 4), 0);
assert.equal(Engine.capRir("", 4), 1);
assert.equal(Engine.capRir(null, 4), 1);
assert.equal(Engine.capReps(6, 3, 4), 9);
assert.equal(Engine.capE1rm(100, 6, 3, 4), 130);
assert.equal(Engine.repsAtLoad(Engine.e1rm(100, 9), 100), 9);
assert.equal(Engine.roundToGrid(101, 2.5), 100);
assert.equal(Engine.jumpAmount(20, 1, { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 }), 2.5);

const prescription = {
  schemaVersion: 1,
  strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 6, repMax: 8 } },
  modifiers: [],
};
const settings = { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 };
const history = [{
  sessionId: "s1",
  date: "2026-01-01",
  sets: [
    { load: 100, reps: 6, rir: 3 },
    { load: 100, reps: 6, rir: 99 },
    { load: 100, reps: 5, rir: null },
  ],
}];

const frozenPrescription = structuredClone(prescription);
const frozenSettings = structuredClone(settings);
const frozenHistory = structuredClone(history);
Object.freeze(prescription.strategy.params);
Object.freeze(prescription.strategy);
Object.freeze(prescription.modifiers);
Object.freeze(prescription);
Object.freeze(settings);
for (const set of history[0].sets) Object.freeze(set);
Object.freeze(history[0].sets);
Object.freeze(history[0]);
Object.freeze(history);

assert.equal(Engine.validateRangePrescription(prescription).ok, true);
const canonicalPrescriptionInput = {
  modifiers: [],
  strategy: {
    params: { repMax: 8, repMin: 6, workingSets: 3 },
    version: 1,
    id: "range",
  },
  schemaVersion: 1,
};
const canonicalPrescription = Engine.validatePrescription(canonicalPrescriptionInput);
assert.equal(canonicalPrescription.ok, true);
assert.deepEqual(canonicalPrescription.value, prescription);
assert.deepEqual(canonicalPrescriptionInput.strategy.params, { repMax: 8, repMin: 6, workingSets: 3 }, "prescription validation must not mutate input");

const manualPrescription = Engine.validatePrescription({
  schemaVersion: 1,
  strategy: { id: "manual", version: 1, params: { authored: { label: "as written" } } },
  modifiers: [],
});
assert.equal(manualPrescription.ok, true, "manual envelope is structurally valid without inventing numeric bounds");
assert.deepEqual(manualPrescription.value.strategy, {
  id: "manual",
  version: 1,
  params: { authored: { label: "as written" } },
});

for (const id of ["rep_goal", "anchor_backoff"]) {
  const pending = Engine.validatePrescription({
    schemaVersion: 1,
    strategy: { id, version: 1, params: { pending: true } },
    modifiers: [],
  });
  assert.equal(pending.ok, true, `${id} envelope validation must not invent unapproved bounds`);
  assert.equal(pending.value.strategy.id, id);
}

const hostileParams = {};
Object.defineProperty(hostileParams, "__proto__", { enumerable: true, value: { retained: true } });
const hostileEnvelope = Engine.validatePrescription({
  schemaVersion: 1,
  strategy: { id: "manual", version: 1, params: hostileParams },
  modifiers: [],
});
assert.equal(hostileEnvelope.ok, true, "JSON-safe hostile keys can be canonicalized without changing prototypes");
assert.equal(hostileEnvelope.ok && Object.prototype.hasOwnProperty.call(hostileEnvelope.value.strategy.params, "__proto__"), true, "canonicalization retains an own __proto__ key safely");
assert.equal(Engine.validatePrescription({
  schemaVersion: 1,
  strategy: { id: "manual", version: 1, params: { deep: { value: 1 } } },
  modifiers: [],
}).ok, true);
let deeplyNested = { value: true };
for (let index = 0; index < 40; index++) deeplyNested = { next: deeplyNested };
assert.equal(Engine.validatePrescription({
  schemaVersion: 1,
  strategy: { id: "manual", version: 1, params: deeplyNested },
  modifiers: [],
}).ok, false, "canonicalization rejects hostile nesting depth");

const relation = Engine.validateRelation({
  version: 1,
  members: [
    { role: "volume", exerciseId: "slot-volume" },
    { exerciseId: "slot-heavy", role: "heavy" },
  ],
  movementId: "movement:bench-press",
  id: "relation-1",
  type: "paired_exposure",
  schemaVersion: 1,
});
assert.equal(relation.ok, true);
assert.deepEqual(relation.value.members, [
  { exerciseId: "slot-heavy", role: "heavy" },
  { exerciseId: "slot-volume", role: "volume" },
], "relation members must have deterministic heavy/volume order");
assert.equal(Engine.validateRelation(null).value, null);
const trimmedRelation = Engine.validateRelation({
  ...relation.value,
  id: " relation-1 ",
  members: relation.value.members.map((member) => ({ ...member, exerciseId: ` ${member.exerciseId} ` })),
});
assert.equal(trimmedRelation.ok, true);
assert.equal(trimmedRelation.value.id, "relation-1");
assert.deepEqual(trimmedRelation.value.members.map((member) => member.exerciseId), ["slot-heavy", "slot-volume"]);
assert.deepEqual(Engine.canonicalizeRelation(relation.value), relation.value);
assert.equal(Engine.validateRelations([relation.value, null]).ok, false);
assert.deepEqual(Engine.canonicalizeRelations([relation.value]), [relation.value]);
const contextual = Engine.validateRelations([relation.value], { slots: [
  { id: "slot-heavy", movementId: "library:bench-press" },
  { id: "slot-volume", movementId: "library:bench-press" },
] });
assert.equal(contextual.ok, false, "a relation cannot persist without matching live movement identity");
const contextualRelation = Engine.validateRelation({
  ...relation.value,
  movementId: "library:bench-press",
});
assert.equal(Engine.validateRelations([contextualRelation.value], { slots: [
  { id: "slot-heavy", movementId: "library:bench-press" },
  { id: "slot-volume", movementId: "library:bench-press" },
] }).ok, true, "contextual relation validation accepts matching live identities");
assert.equal(Engine.validateRelations([contextualRelation.value], { slots: [
  { id: "slot-heavy", movementId: "library:bench-press" },
  { id: "slot-volume", movementId: "library:machine-row" },
] }).ok, false, "contextual relation validation rejects mismatched live identities");

for (const invalidRelation of [
  {
    schemaVersion: 1,
    id: "relation-1",
    type: "paired_exposure",
    version: 1,
    movementId: "library:bench-press",
    members: [
      { exerciseId: "slot-a", role: "heavy" },
      { exerciseId: "slot-a", role: "volume" },
    ],
  },
  {
    schemaVersion: 1,
    id: "relation-1",
    type: "paired_exposure",
    version: 1,
    movementId: "library:bench-press",
    members: [
      { exerciseId: "slot-a", role: "heavy" },
      { exerciseId: "slot-b", role: "heavy" },
    ],
  },
]) {
  assert.equal(Engine.validateRelation(invalidRelation).ok, false, "paired relation identity and roles are closed");
}

const modifier = Engine.validateModifier({
  params: { pending: true },
  target: "repMin",
  weekNumber: 1,
  compatibleStrategies: ["range@1"],
  version: 1,
  id: "pending-modifier",
});
assert.equal(modifier.ok, true, "modifier envelope can be preserved before numeric approval");
assert.deepEqual(modifier.value.compatibleStrategies, ["range@1"]);
assert.deepEqual(Engine.canonicalizeModifier(modifier.value), modifier.value);
assert.deepEqual(Engine.canonicalizeModifiers([modifier.value]), [modifier.value]);
assert.deepEqual(Engine.canonicalizePrescription(manualPrescription.value), manualPrescription.value);
assert.equal(Engine.validateModifier({ id: "bad", version: 1, compatibleStrategies: [], params: {} }).ok, false);
assert.equal(Engine.validateModifier({ id: "bad", version: 1, compatibleStrategies: ["range@1", "range@1"], params: {} }).ok, false, "duplicate modifier compatibility entries are rejected");

assert.equal(Engine.validateSettings(settings).ok, true);
const normalized = Engine.normalizeHistory(history);
assert.equal(normalized.ok, true);
assert.deepEqual(prescription, frozenPrescription, "prescription validation must not mutate input");
assert.deepEqual(settings, frozenSettings, "settings validation must not mutate input");
assert.deepEqual(history, frozenHistory, "history normalization must not mutate input");

const summarizedA = Engine.summarizeHistory(history, settings.hardRir);
const summarizedB = Engine.summarizeHistory(history, settings.hardRir);
assert.deepEqual(summarizedA, summarizedB, "summary must be deterministic");
assert.deepEqual(summarizedA.value[0], {
  sessionId: "s1",
  date: "2026-01-01",
  sets: [
    { load: 100, reps: 6, rir: 3 },
    { load: 100, reps: 6, rir: 99 },
    { load: 100, reps: 5, rir: null },
  ],
  medianLoad: 100,
  minimumReps: 5,
  maximumReps: 6,
  medianReps: 6,
  averageRir: 34,
  bestE1rm: 120,
  bestCapacity: 133.33333333333331,
  medianCapacity: 130,
  medianCappedRir: 3,
});
assert.equal(Engine.typicalRir(summarizedA.value), 3);
assert.ok(Math.abs(Engine.expectedSetDrop([130, 126.6666666667], []) - 0.025641025640769) < 1e-12);
assert.equal(Engine.expectedSetDrop([100, 10], []), 0.05, "observed drop must cap at 5%");
assert.equal(Engine.expectedSetDrop([100], [0.02, 0.04, 0.03]), 0.03, "historical median is the fallback");

const invalidInputs = [
  ["unknown prescription key", () => Engine.validateRangePrescription({ ...frozenPrescription, familyId: "growth" })],
  ["unsupported strategy", () => Engine.validateRangePrescription({ ...frozenPrescription, strategy: { ...frozenPrescription.strategy, id: "rep_goal" } })],
  ["inverted range", () => Engine.validateRangePrescription({ ...frozenPrescription, strategy: { ...frozenPrescription.strategy, params: { ...frozenPrescription.strategy.params, repMin: 9 } } })],
  ["unknown setting", () => Engine.validateSettings({ ...frozenSettings, entitlement: "pro" })],
  ["non-finite setting", () => Engine.validateSettings({ ...frozenSettings, jumpPercent: Number.NaN })],
  ["unknown history key", () => Engine.normalizeHistory([{ ...frozenHistory[0], programId: "p1" }])],
  ["non-finite history", () => Engine.normalizeHistory([{ ...frozenHistory[0], sets: [{ load: Number.POSITIVE_INFINITY, reps: 6, rir: 1 }] }])],
];
for (const [name, run] of invalidInputs) {
  const result = run();
  assert.equal(result.ok, false, `${name}: must fail`);
  assert.equal(result.code, "invalid-input", `${name}: typed failure required`);
  assert.ok(result.issues.length, `${name}: issue list required`);
}

const fixtures = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/progression-strategies-v1.json"), "utf8"));
const rangeFixtures = fixtures.strategies["range@1"];

function setPath(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part];
  cursor[parts.at(-1)] = value;
}

for (const testCase of rangeFixtures.cases) {
  const input = structuredClone(rangeFixtures.defaults);
  input.engineVersion = fixtures.engineVersion;
  input.history = structuredClone(testCase.history);
  if (testCase.currentSession) input.currentSession = structuredClone(testCase.currentSession);
  for (const [dottedPath, value] of Object.entries(testCase.overrides || {})) setPath(input, dottedPath, value);
  const before = JSON.stringify(input);
  const result = Engine.evaluateProgression(input);
  const again = Engine.evaluateProgression(input);

  assert.equal(JSON.stringify(input), before, `${testCase.id}: evaluation must not mutate input`);
  assert.deepEqual(result, again, `${testCase.id}: evaluation must be deterministic`);
  assert.equal(result.kind, testCase.expected.kind, `${testCase.id}: kind`);
  assert.equal(result.status, testCase.expected.status, `${testCase.id}: status`);
  assert.equal(result.facts.legacyStatus, testCase.expected.legacyStatus, `${testCase.id}: legacy status`);
  assert.deepEqual(result.reasonCodes, testCase.expected.reasonCodes, `${testCase.id}: reason codes`);
  assert.equal(result.target.sets[0].load, testCase.expected.targetLoad, `${testCase.id}: target load`);
  assert.equal(result.target.sets[0].reps, testCase.expected.targetReps, `${testCase.id}: target reps`);
  assert.equal(result.strategy.id, "range", `${testCase.id}: strategy id`);
  assert.equal(result.strategy.version, 1, `${testCase.id}: strategy version`);
  assert.equal(result.engineVersion, 1, `${testCase.id}: engine version`);
  assert.equal(result.provenance.evidenceWindow.sessionCount, input.history.length, `${testCase.id}: session provenance`);
  assert.equal(result.provenance.evidenceWindow.currentSetCount, input.currentSession.length, `${testCase.id}: current-set provenance`);
  if (testCase.expected.capacityReps !== undefined) {
    assert.ok(Math.abs(result.facts.capacityReps - testCase.expected.capacityReps) < 1e-6, `${testCase.id}: capacity reps`);
  }
}

const unsupported = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  prescription: {
    schemaVersion: 1,
    strategy: { id: "rep_goal", version: 1, params: {} },
    modifiers: [],
  },
});
assert.equal(unsupported.kind, "incompatible");
assert.deepEqual(unsupported.reasonCodes, ["engine.unsupported_strategy"]);

const unsupportedModifier = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  modifiers: [modifier.value],
});
assert.equal(unsupportedModifier.kind, "incompatible");
assert.deepEqual(unsupportedModifier.reasonCodes, ["engine.unsupported_modifier"]);

const polluted = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  entitlement: "pro",
});
assert.equal(polluted.kind, "invalid");
assert.deepEqual(polluted.reasonCodes, ["engine.invalid_input"]);

console.log(`PASS: progression primitives plus ${rangeFixtures.cases.length} deterministic range fixtures`);
