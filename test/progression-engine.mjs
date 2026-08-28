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
assert.deepEqual(Engine.STRATEGY_IDS, ["range", "rep_goal", "effort_target", "anchor_backoff", "manual"]);
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

// rep_goal@1 and anchor_backoff@1 have owner-approved bounds now, so their
// envelopes are validated against them rather than preserved as opaque shapes.
for (const id of ["rep_goal", "effort_target", "anchor_backoff"]) {
  assert.equal(Engine.validatePrescription({
    schemaVersion: 1,
    strategy: { id, version: 1, params: { pending: true } },
    modifiers: [],
  }).ok, false, `${id}: an approved strategy no longer accepts an arbitrary parameter bag`);
}

const effortTargetInput = {
  engineVersion: 1,
  prescription: {
    schemaVersion: 1,
    strategy: {
      id: "effort_target",
      version: 1,
      params: {
        workingSets: 2,
        targetReps: 5,
        targetRirMin: 2,
        targetRirMax: 3,
        minLoadIncrement: 2.5,
      },
    },
    modifiers: [],
  },
  settings: { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 },
  relation: null,
  modifiers: [],
  history: [],
  currentSession: [],
  context: { weekNumber: 1, blockLength: 6, blockStart: null },
};
const effortNew = Engine.evaluateProgression(effortTargetInput);
assert.equal(effortNew.kind, "recommendation");
assert.equal(effortNew.status, "new");
assert.deepEqual(effortNew.reasonCodes, ["effort_target.no_history"]);
assert.equal(effortNew.target.sets.length, 2);
assert.ok(effortNew.target.sets.every((set) => set.load === null && set.reps === 5));
assert.ok(effortNew.target.sets.every((set) => set.targetRirMin === 2 && set.targetRirMax === 3));

const effortAdvance = Engine.evaluateProgression({
  ...structuredClone(effortTargetInput),
  history: [{
    sessionId: "effort-s1",
    date: "2026-01-01",
    sets: [{ load: 100, reps: 5, rir: 4 }, { load: 100, reps: 5, rir: 4 }],
  }],
});
assert.equal(effortAdvance.status, "advance");
assert.deepEqual(effortAdvance.reasonCodes, ["effort_target.too_easy"]);
assert.ok(effortAdvance.target.sets.every((set) => set.load === 102.5 && set.reps === 5));
assert.equal(effortAdvance.facts.representativeRir, 4);

const effortMissingRir = Engine.evaluateProgression({
  ...structuredClone(effortTargetInput),
  history: [{
    sessionId: "effort-s1",
    date: "2026-01-01",
    sets: [{ load: 100, reps: 5, rir: null }, { load: 100, reps: 5, rir: null }],
  }],
});
assert.equal(effortMissingRir.status, "hold");
assert.deepEqual(effortMissingRir.reasonCodes, ["effort_target.no_rir_evidence"]);
assert.ok(effortMissingRir.target.sets.every((set) => set.load === 100 && set.reps === 5));

const effortCurrentReduce = Engine.evaluateProgression({
  ...structuredClone(effortTargetInput),
  currentSession: [{ load: 100, reps: 4, rir: 4 }],
});
assert.equal(effortCurrentReduce.status, "reduce");
assert.deepEqual(effortCurrentReduce.reasonCodes, ["effort_target.current_reduce"]);
assert.deepEqual(effortCurrentReduce.target.sets.map((set) => [set.load, set.reps]), [[97.5, 5]]);
// The authored back-off percentage stays inside the approved band.
const anchorParams = {
  anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 1, anchorTargetRirMax: 3,
  backoffSets: 3, backoffRepMin: 6, backoffRepMax: 10, backoffPercent: 0.8,
  minLoadIncrement: 2.5, jumpPercent: 2.5,
};
for (const percent of [0.69, 0.96, 0, 1]) {
  assert.equal(Engine.validateAnchorBackoffPrescription({
    schemaVersion: 1,
    strategy: { id: "anchor_backoff", version: 1, params: { ...anchorParams, backoffPercent: percent } },
    modifiers: [],
  }).ok, false, `backoffPercent ${percent}: outside the approved 0.70-0.95 band`);
}
for (const percent of [0.7, 0.8, 0.95]) {
  assert.equal(Engine.validateAnchorBackoffPrescription({
    schemaVersion: 1,
    strategy: { id: "anchor_backoff", version: 1, params: { ...anchorParams, backoffPercent: percent } },
    modifiers: [],
  }).ok, true, `backoffPercent ${percent}: inside the approved band`);
}
assert.deepEqual(Engine.balancedFrontload(30, 3, 6, 12), [10, 10, 10]);
assert.deepEqual(Engine.balancedFrontload(31, 3, 6, 12), [11, 10, 10]);
assert.deepEqual(Engine.balancedFrontload(32, 3, 6, 12), [11, 11, 10]);
assert.deepEqual(Engine.balancedFrontload(25, 3, 6, 12), [9, 8, 8]);
assert.deepEqual(Engine.balancedFrontload(3, 3, 6, 12), [6, 6, 6], "a tiny remainder never goes under the authored floor");
assert.deepEqual(Engine.balancedFrontload(60, 3, 6, 12), [12, 12, 12], "a catch-up set never goes over the authored ceiling");

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

// --- owner-approved strategy contracts ---------------------------------------
// Every locked case in the fixture is executed here. The fixture is the review
// record; this is where it has to hold.
function runLockedCases(collection, namespace) {
  for (const testCase of collection.cases) {
    const input = structuredClone(collection.defaults);
    input.engineVersion = fixtures.engineVersion;
    input.history = structuredClone(testCase.history);
    if (testCase.currentSession) input.currentSession = structuredClone(testCase.currentSession);
    for (const [dottedPath, value] of Object.entries(testCase.overrides || {})) {
      const parts = dottedPath.split(".");
      let cursor = input;
      for (const part of parts.slice(0, -1)) cursor = cursor[part];
      cursor[parts.at(-1)] = { ...cursor[parts.at(-1)], ...value };
    }
    const before = JSON.stringify(input);
    const result = Engine.evaluateProgression(input);
    const again = Engine.evaluateProgression(input);

    assert.equal(JSON.stringify(input), before, `${testCase.id}: evaluation must not mutate input`);
    assert.deepEqual(result, again, `${testCase.id}: evaluation must be deterministic`);
    assert.equal(result.kind, testCase.expected.kind, `${testCase.id}: kind`);
    assert.equal(result.status, testCase.expected.status, `${testCase.id}: status`);
    assert.deepEqual(result.reasonCodes, testCase.expected.reasonCodes, `${testCase.id}: reason codes`);
    assert.equal(result.strategy.id, namespace, `${testCase.id}: strategy id`);
    assert.equal(result.strategy.version, 1, `${testCase.id}: strategy version`);
    assert.equal(result.engineVersion, 1, `${testCase.id}: engine version`);
    assert.equal(result.target.sets.length, testCase.expected.sets.length, `${testCase.id}: prescribed set count`);
    result.target.sets.forEach((set, index) => {
      const expected = testCase.expected.sets[index];
      assert.equal(set.role, expected.role, `${testCase.id}: set ${index} role`);
      assert.equal(set.load, expected.load, `${testCase.id}: set ${index} load`);
      assert.equal(set.reps, expected.reps, `${testCase.id}: set ${index} reps`);
    });
    if (testCase.expected.capacityReps !== undefined) {
      assert.ok(Math.abs(result.facts.capacityReps - testCase.expected.capacityReps) < 1e-6, `${testCase.id}: capacity reps`);
    }
  }
  return collection.cases.length;
}

const repGoalFixtures = fixtures.strategies["rep_goal@1"];
const repGoalCount = runLockedCases(repGoalFixtures, "rep_goal");

// The authored goal is evidence-independent: no branch may rewrite it.
for (const testCase of repGoalFixtures.cases) {
  const input = structuredClone(repGoalFixtures.defaults);
  input.engineVersion = 1;
  input.history = structuredClone(testCase.history);
  if (testCase.currentSession) input.currentSession = structuredClone(testCase.currentSession);
  for (const [dottedPath, value] of Object.entries(testCase.overrides || {})) {
    const parts = dottedPath.split(".");
    let cursor = input;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = { ...cursor[parts.at(-1)], ...value };
  }
  const result = Engine.evaluateProgression(input);
  if (result.kind !== "recommendation") continue;
  const authoredGoal = input.prescription.strategy.params.repGoal;
  assert.equal(result.facts.repGoal, authoredGoal, `${testCase.id}: the authored goal is never rewritten`);
  for (const set of result.target.sets) {
    assert.ok(set.reps >= input.prescription.strategy.params.repFloor, `${testCase.id}: never under the authored floor`);
    assert.ok(set.reps <= input.prescription.strategy.params.repCeiling, `${testCase.id}: never over the authored ceiling`);
  }
  // Exceeding the goal never buys a double jump: one advancement magnitude.
  if (result.status === "advance") {
    const jump = Math.abs(result.facts.targetLoad - result.facts.latestLoad);
    const single = Math.max(result.facts.latestLoad * input.prescription.strategy.params.jumpPercent / 100,
      input.prescription.strategy.params.minLoadIncrement);
    assert.ok(jump <= single + input.settings.minLoadIncrement, `${testCase.id}: rep_goal@1 has one advancement magnitude`);
  }
}

const effortTargetFixtures = fixtures.strategies["effort_target@1"];
const effortTargetCount = runLockedCases(effortTargetFixtures, "effort_target");
for (const testCase of effortTargetFixtures.cases) {
  const input = structuredClone(effortTargetFixtures.defaults);
  input.engineVersion = 1;
  input.history = structuredClone(testCase.history);
  if (testCase.currentSession) input.currentSession = structuredClone(testCase.currentSession);
  for (const [dottedPath, value] of Object.entries(testCase.overrides || {})) {
    const parts = dottedPath.split(".");
    let cursor = input;
    for (const part of parts.slice(0, -1)) cursor = cursor[part];
    cursor[parts.at(-1)] = { ...cursor[parts.at(-1)], ...value };
  }
  const result = Engine.evaluateProgression(input);
  if (result.kind !== "recommendation") continue;
  const params = input.prescription.strategy.params;
  assert.equal(result.facts.targetReps, params.targetReps, `${testCase.id}: authored reps stay fixed`);
  assert.equal(result.facts.targetRirMin, params.targetRirMin, `${testCase.id}: authored RIR floor stays fixed`);
  assert.equal(result.facts.targetRirMax, params.targetRirMax, `${testCase.id}: authored RIR ceiling stays fixed`);
  for (const set of result.target.sets) {
    assert.equal(set.reps, params.targetReps, `${testCase.id}: every target keeps fixed reps`);
    assert.equal(set.targetRirMin, params.targetRirMin, `${testCase.id}: every target keeps the RIR floor`);
    assert.equal(set.targetRirMax, params.targetRirMax, `${testCase.id}: every target keeps the RIR ceiling`);
  }
  if (["advance", "reduce"].includes(result.status) && result.facts.representativeLoad != null) {
    const snappedEvidence = Engine.roundToGrid(result.facts.representativeLoad, input.settings.minLoadIncrement);
    assert.ok(Math.abs(result.facts.targetLoad - snappedEvidence) <= input.settings.minLoadIncrement + 1e-9,
      `${testCase.id}: one evidence step changes at most one grid increment`);
  }
}

const anchorFixtures = fixtures.strategies["anchor_backoff@1"];
const anchorCount = runLockedCases(anchorFixtures, "anchor_backoff");

// Completed and touched sets are never rewritten: with a current session the
// strategy prescribes at most the single next untouched back-off.
for (const testCase of anchorFixtures.cases) {
  if (!testCase.currentSession) continue;
  assert.ok(testCase.expected.sets.length <= 1, `${testCase.id}: only the next untouched back-off is prescribed`);
  assert.ok(testCase.expected.sets.every((set) => set.role === "backoff"),
    `${testCase.id}: a completed anchor is never re-prescribed`);
}

const manualFixtures = fixtures.strategies["manual@1"];
const manualCount = runLockedCases(manualFixtures, "manual");

const unsupported = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  prescription: {
    schemaVersion: 1,
    strategy: { id: "range", version: 2, params: {} },
    modifiers: [],
  },
});
assert.equal(unsupported.kind, "incompatible");
assert.deepEqual(unsupported.reasonCodes, ["engine.unsupported_strategy"]);

const unsupportedImportManual = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  prescription: {
    schemaVersion: 1,
    strategy: { id: "manual", version: 1, params: { unsupportedImport: "legacy_custom_rule" } },
    modifiers: [],
  },
});
assert.equal(unsupportedImportManual.kind, "manual");
assert.equal(unsupportedImportManual.status, "manual");
assert.deepEqual(unsupportedImportManual.reasonCodes, ["manual.unsupported_import"]);
assert.deepEqual(unsupportedImportManual.target.sets, [], "manual import must never invent a target");

const unsupportedModifier = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  modifiers: [modifier.value],
});
assert.equal(unsupportedModifier.kind, "incompatible");
assert.deepEqual(unsupportedModifier.reasonCodes, ["engine.unsupported_modifier"]);

// --- paired_exposure@1 and block-profile modifiers ----------------------------
const pairedFixtures = fixtures.relations["paired_exposure@1"];
assert.deepEqual(Engine.PAIRED_PAIRS.map((pair) => ({ ...pair })), pairedFixtures.allowedPairs,
  "the engine executes exactly the approved pairs");
assert.equal(Engine.PAIRED_WINDOW_SESSIONS, pairedFixtures.evidenceWindowSessions);

for (const testCase of pairedFixtures.cases) {
  if (testCase.pair) {
    const actual = Engine.pairedExposureCompatibility(testCase.pair);
    assert.equal(actual.compatible, testCase.expected.compatible, `${testCase.id}: compatibility`);
    assert.deepEqual(actual.reasonCodes, testCase.expected.reasonCodes || [], `${testCase.id}: reason codes`);
  }
  if (testCase.movements) {
    const actual = Engine.pairedMovementCompatibility(testCase.movements);
    assert.equal(actual.compatible, testCase.expected.compatible, `${testCase.id}: movement compatibility`);
    assert.deepEqual(actual.reasonCodes, testCase.expected.reasonCodes || [], `${testCase.id}: reason codes`);
  }
  if (testCase.counterpart) {
    const actual = Engine.pairedExposureConfidence(testCase.counterpart);
    assert.equal(actual.confidence, testCase.expected.confidence, `${testCase.id}: confidence`);
    assert.deepEqual(actual.reasonCodes, testCase.expected.reasonCodes, `${testCase.id}: reason codes`);
  }
  if (testCase.independent) {
    const independent = {
      status: testCase.independent.status,
      reasonCodes: [],
      target: { sets: [{ role: "working", load: 102.5, reps: 8 }] },
      facts: { latestLoad: 100, targetLoad: 102.5 },
    };
    const actual = Engine.applyPairedExposure(independent, { counterpartAgrees: testCase.counterpartAgrees });
    assert.equal(actual.status, testCase.expected.status, `${testCase.id}: tempered status`);
    assert.deepEqual(actual.reasonCodes, testCase.expected.reasonCodes, `${testCase.id}: reason codes`);
    // Temper-only, proven on the target itself and not just the status.
    for (const [index, set] of actual.target.sets.entries()) {
      assert.ok(set.load <= independent.target.sets[index].load, `${testCase.id}: never a larger load`);
      assert.ok(set.reps <= independent.target.sets[index].reps, `${testCase.id}: never more reps`);
    }
    assert.ok(actual.target.sets.length <= independent.target.sets.length, `${testCase.id}: never more sets`);
  }
}

// The one approved modifier, end to end through the entry point.
const identityModifier = {
  id: "identity_block",
  version: 1,
  compatibleStrategies: ["anchor_backoff@1", "range@1", "rep_goal@1"],
  target: null,
  params: {},
};
assert.ok(Engine.isApprovedModifier({ id: "identity_block", version: 1, target: null }));
assert.ok(!Engine.isApprovedModifier({ id: "step_loading", version: 1, target: "load" }),
  "no target-changing block profile is approved");
assert.ok(!Engine.isApprovedModifier({ id: "identity_block", version: 1, target: "load" }),
  "even the approved modifier may not claim a target field");

const baselineInput = { ...structuredClone(rangeFixtures.defaults), engineVersion: 1, history: [] };
const withoutModifier = Engine.evaluateProgression(baselineInput);
const withModifier = Engine.evaluateProgression({ ...baselineInput, modifiers: [{ ...identityModifier }] });
assert.equal(withModifier.kind, "recommendation", "the approved modifier is executable");
assert.deepEqual(withModifier.target, withoutModifier.target, "identity_block@1 changes no target");
assert.deepEqual(withModifier.status, withoutModifier.status);
assert.deepEqual(withModifier.provenance.modifierVersions, ["identity_block@1"], "modifier provenance is recorded");
assert.deepEqual(withoutModifier.provenance.modifierVersions, []);

const stepLoading = Engine.evaluateProgression({
  ...baselineInput,
  modifiers: [{ id: "step_loading", version: 1, compatibleStrategies: ["range@1"], target: "load", params: {} }],
});
assert.equal(stepLoading.kind, "incompatible", "an unapproved block profile never executes");
assert.deepEqual(stepLoading.reasonCodes, ["engine.unsupported_modifier"]);

// The approved pair, end to end: the volume slot runs rep_goal@1 while its
// heavy counterpart runs anchor_backoff@1.
const pairedRelation = {
  schemaVersion: 1,
  id: "relation-1",
  type: "paired_exposure",
  version: 1,
  movementId: "library:barbell-bench-press",
  members: [
    { exerciseId: "slot-heavy", role: "heavy" },
    { exerciseId: "slot-volume", role: "volume" },
  ],
  selfRole: "volume",
  counterpart: { strategy: "anchor_backoff@1", sessionsInWindow: 3, mostRecentExpectedExposureCompleted: true, status: "advance" },
};
const repGoalAdvance = repGoalFixtures.cases.find((testCase) => testCase.id === "rep-goal-goal-met-advances");
const pairedInput = {
  ...structuredClone(repGoalFixtures.defaults),
  engineVersion: 1,
  history: structuredClone(repGoalAdvance.history),
  relation: pairedRelation,
};
const pairedResult = Engine.evaluateProgression(pairedInput);
assert.equal(pairedResult.kind, "recommendation", "the approved pair executes");
assert.equal(pairedResult.status, "advance", "an agreeing counterpart changes nothing");
assert.equal(pairedResult.provenance.relationVersion, 1);
assert.ok(pairedResult.reasonCodes.includes("paired_exposure.full_confidence"));

const contradicting = Engine.evaluateProgression({
  ...pairedInput,
  relation: { ...pairedRelation, counterpart: { ...pairedRelation.counterpart, status: "reduce" } },
});
assert.equal(contradicting.status, "hold", "a contradicting counterpart tempers an advance to a hold");
assert.ok(contradicting.reasonCodes.includes("paired_exposure.tempered"));
assert.ok(contradicting.target.sets.every((set) => set.load <= pairedResult.target.sets[0].load),
  "tempering is never more aggressive");

const poorCounterpartOnHold = Engine.evaluateProgression({
  ...structuredClone(repGoalFixtures.defaults),
  engineVersion: 1,
  history: structuredClone(repGoalFixtures.cases.find((testCase) => testCase.id === "rep-goal-goal-miss-holds").history),
  relation: { ...pairedRelation, counterpart: { ...pairedRelation.counterpart, status: "reduce" } },
});
assert.equal(poorCounterpartOnHold.status, "hold", "paired evidence alone never turns a hold into a reduction");

const swappedRoles = Engine.evaluateProgression({
  ...pairedInput,
  relation: { ...pairedRelation, selfRole: "heavy", counterpart: { ...pairedRelation.counterpart, strategy: "rep_goal@1" } },
});
assert.equal(swappedRoles.kind, "incompatible", "roles are not interchangeable");
assert.deepEqual(swappedRoles.reasonCodes, ["paired_exposure.incompatible_strategy_pair"]);

const unprovenPair = Engine.evaluateProgression({
  ...pairedInput,
  relation: { schemaVersion: 1, id: "relation-1", type: "paired_exposure", version: 1, movementId: "library:barbell-bench-press", members: pairedRelation.members },
});
assert.equal(unprovenPair.kind, "incompatible", "an unproven pair never executes");
assert.deepEqual(unprovenPair.reasonCodes, ["engine.unsupported_relation"]);

// Evaluation-time pairing context never reaches the persisted relation shape.
assert.deepEqual(Engine.canonicalizeRelation(pairedRelation), {
  schemaVersion: 1,
  id: "relation-1",
  type: "paired_exposure",
  version: 1,
  movementId: "library:barbell-bench-press",
  members: [
    { exerciseId: "slot-heavy", role: "heavy" },
    { exerciseId: "slot-volume", role: "volume" },
  ],
}, "selfRole and counterpart are evaluation-time only");

const polluted = Engine.evaluateProgression({
  ...structuredClone(rangeFixtures.defaults),
  engineVersion: 1,
  history: [],
  entitlement: "pro",
});
assert.equal(polluted.kind, "invalid");
assert.deepEqual(polluted.reasonCodes, ["engine.invalid_input"]);

console.log(`PASS: progression primitives plus ${rangeFixtures.cases.length} range, ${repGoalCount} rep_goal, ${effortTargetCount} effort_target, ${anchorCount} anchor_backoff, ${manualCount} manual, ${pairedFixtures.cases.length} paired and ${fixtures.modifiers.cases.length} modifier locked fixtures`);
