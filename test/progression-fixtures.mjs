#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/progression-strategies-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

assert.equal(fixture.kind, "taurifer-progression-strategy-fixtures");
assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.engineVersion, 1);
assert.ok(fs.existsSync(path.join(root, fixture.contract)), "contract path must resolve");

const approvals = new Set(["locked", "pending"]);
const seenCaseIds = new Set();

function validateCollection(id, collection) {
  assert.ok(approvals.has(collection.approval), `${id}: unknown approval`);
  assert.ok(Array.isArray(collection.cases), `${id}: cases must be an array`);
  if (collection.approval === "pending") {
    assert.ok(collection.requiredDecisions?.length, `${id}: pending contract needs decisions`);
    assert.equal(collection.cases.length, 0, `${id}: pending contract cannot carry executable cases`);
    return;
  }
  // A locked contract is the executable review record: it names where its
  // approval came from, carries the reviewed examples, and lists no open
  // decision it could still be waiting on.
  assert.ok(Array.isArray(collection.source) && collection.source.length, `${id}: locked contract must name its approval source`);
  assert.ok(collection.cases.length, `${id}: locked contract must carry its worked examples`);
  assert.ok(!collection.requiredDecisions, `${id}: a locked contract cannot still list open decisions`);
  for (const testCase of collection.cases) {
    assert.ok(!seenCaseIds.has(testCase.id), `${testCase.id}: duplicate case id`);
    seenCaseIds.add(testCase.id);
    assert.equal(testCase.approval, "locked", `${testCase.id}: a locked contract carries only locked cases`);
  }
}

for (const [id, strategy] of Object.entries(fixture.strategies)) validateCollection(id, strategy);
for (const [id, relation] of Object.entries(fixture.relations)) validateCollection(id, relation);
validateCollection("modifiers", fixture.modifiers);

const allowedKinds = new Set(["recommendation", "manual", "insufficient_evidence", "incompatible", "invalid"]);
const allowedStatuses = new Set(["new", "advance", "hold", "reduce", "recalibrate", "manual"]);
const allowedLegacyStatuses = new Set(["new", "add", "add2", "hold", "reduce"]);
const allowedRoles = new Set(["working", "anchor", "backoff"]);

function validateHistory(testCase) {
  for (const session of testCase.history) {
    assert.equal(typeof session.sessionId, "string", `${testCase.id}: session id required`);
    assert.match(session.date, /^\d{4}-\d{2}-\d{2}$/, `${testCase.id}: ISO date required`);
    assert.ok(Array.isArray(session.sets) && session.sets.length, `${testCase.id}: session sets required`);
    for (const set of session.sets) {
      assert.ok(Number.isFinite(set.load) && set.load > 0, `${testCase.id}: positive finite load required`);
      assert.ok(Number.isInteger(set.reps) && set.reps > 0, `${testCase.id}: positive integer reps required`);
      assert.ok(Number.isFinite(set.rir), `${testCase.id}: finite RIR required`);
    }
  }
}

// --- range@1: the released parity contract -----------------------------------
const range = fixture.strategies["range@1"];
assert.equal(range.approval, "locked");
assert.deepEqual(range.defaults.prescription.strategy, {
  id: "range",
  version: 1,
  params: { workingSets: 2, repMin: 6, repMax: 8 },
});
assert.deepEqual(range.defaults.prescription.modifiers, []);
assert.deepEqual(range.defaults.modifiers, []);
assert.equal(range.defaults.relation, null);
assert.ok(range.cases.length >= 18, "range fixture must cover released next-session and current-set behavior");

for (const testCase of range.cases) {
  assert.match(testCase.id, /^range-[a-z0-9-]+$/);
  assert.ok(Array.isArray(testCase.history), `${testCase.id}: history must be an array`);
  assert.ok(testCase.expected && typeof testCase.expected === "object", `${testCase.id}: expected result required`);
  assert.ok(allowedKinds.has(testCase.expected.kind), `${testCase.id}: invalid kind`);
  assert.ok(allowedStatuses.has(testCase.expected.status), `${testCase.id}: invalid status`);
  assert.ok(allowedLegacyStatuses.has(testCase.expected.legacyStatus), `${testCase.id}: invalid legacy status`);
  assert.ok(Array.isArray(testCase.expected.reasonCodes) && testCase.expected.reasonCodes.length, `${testCase.id}: reason codes required`);
  assert.ok(testCase.expected.reasonCodes.every((code) => code.startsWith("range.")), `${testCase.id}: range reason namespace required`);
  assert.ok(testCase.expected.targetLoad === null || Number.isFinite(testCase.expected.targetLoad), `${testCase.id}: target load must be finite or null`);
  assert.ok(Number.isInteger(testCase.expected.targetReps), `${testCase.id}: target reps must be an integer`);
  validateHistory(testCase);
}

const requiredRangeCases = [
  "range-no-history",
  "range-capacity-extends-jump",
  "range-rir-credit-is-capped",
  "range-performed-top-never-retracted",
  "range-near-top-majority",
  "range-capacity-double-jump",
  "range-capacity-below-floor-reduces",
  "range-early-stop-capacity-holds",
  "range-grid-step-dominates-light-jump",
  "range-off-grid-hold-snaps",
  "range-three-session-stall",
  "range-two-session-recovery",
  "range-falling-block-tempers-double-jump",
  "range-current-set-observed-drop",
  "range-current-set-advances",
  "range-current-set-reduces",
];
for (const id of requiredRangeCases) assert.ok(seenCaseIds.has(id), `${id}: required parity case missing`);

// --- owner-approved strategy contracts ---------------------------------------
// Every locked case beyond range@1 states what it locks, names only reason
// codes inside its own strategy namespace, and prescribes finite bounded
// targets. Nothing here executes the engine; test/progression-engine.mjs is
// where these same cases are run.
function validateStrategyCases(id, collection, namespace, prefix) {
  for (const testCase of collection.cases) {
    assert.match(testCase.id, prefix, `${testCase.id}: case id must name its strategy`);
    assert.ok(typeof testCase.note === "string" && testCase.note.length, `${testCase.id}: every locked case states what it locks`);
    assert.ok(Array.isArray(testCase.history), `${testCase.id}: history must be an array`);
    validateHistory(testCase);
    const expected = testCase.expected;
    assert.ok(expected && typeof expected === "object", `${testCase.id}: expected result required`);
    assert.ok(allowedKinds.has(expected.kind), `${testCase.id}: invalid kind`);
    assert.ok(allowedStatuses.has(expected.status), `${testCase.id}: invalid status`);
    assert.ok(Array.isArray(expected.reasonCodes) && expected.reasonCodes.length, `${testCase.id}: reason codes required`);
    assert.ok(
      expected.reasonCodes.every((code) => code.startsWith(`${namespace}.`)),
      `${testCase.id}: ${namespace} reason namespace required`,
    );
    assert.ok(Array.isArray(expected.sets), `${testCase.id}: expected sets must be an array`);
    for (const set of expected.sets) {
      assert.ok(allowedRoles.has(set.role), `${testCase.id}: unknown set role`);
      assert.ok(set.load === null || (Number.isFinite(set.load) && set.load > 0), `${testCase.id}: target load must be positive finite or null`);
      assert.ok(Number.isInteger(set.reps) && set.reps > 0, `${testCase.id}: target reps must be a positive integer`);
    }
    if (expected.kind !== "recommendation") {
      assert.equal(expected.sets.length, 0, `${testCase.id}: a non-recommendation never prescribes a target`);
      assert.equal(expected.status, "manual", `${testCase.id}: a non-recommendation reports manual status`);
    }
  }
  assert.ok(collection.cases.some((testCase) => testCase.expected.kind === "incompatible"),
    `${id}: a locked strategy must lock what it refuses to execute`);
}

// rep_goal@1
const repGoal = fixture.strategies["rep_goal@1"];
assert.equal(repGoal.approval, "locked");
assert.equal(repGoal.defaults.prescription.strategy.id, "rep_goal");
assert.equal(repGoal.defaults.prescription.strategy.params.distributionPolicy, "balanced_frontload_v1",
  "balanced_frontload_v1 is the only approved v1 distribution policy");
const repGoalParams = repGoal.defaults.prescription.strategy.params;
assert.ok(
  repGoalParams.workingSets * repGoalParams.repFloor <= repGoalParams.repGoal
    && repGoalParams.repGoal <= repGoalParams.workingSets * repGoalParams.repCeiling,
  "the authored goal must be reachable inside the authored per-set bounds",
);
validateStrategyCases("rep_goal@1", repGoal, "rep_goal", /^rep-goal-[a-z0-9-]+$/);

// The distribution policy is locked as pure vectors so it can be reviewed and
// executed without constructing evidence for it.
assert.equal(repGoal.distributionPolicy.id, "balanced_frontload_v1");
assert.ok(repGoal.distributionPolicy.vectors.length >= 4, "the distribution policy needs its worked vectors");
for (const vector of repGoal.distributionPolicy.vectors) {
  const base = Math.floor(vector.total / vector.sets);
  const remainder = vector.total % vector.sets;
  const derived = Array.from({ length: vector.sets }, (_, index) => Math.min(
    vector.repCeiling,
    Math.max(vector.repFloor, base + (index < remainder ? 1 : 0)),
  ));
  assert.deepEqual(vector.expected, derived, `distribution ${vector.total}/${vector.sets}: remainder must land on the earlier sets`);
  assert.equal(vector.expected.reduce((total, reps) => total + reps, 0), vector.total,
    `distribution ${vector.total}/${vector.sets}: a feasible total is distributed exactly`);
}

// anchor_backoff@1
const anchorBackoff = fixture.strategies["anchor_backoff@1"];
assert.equal(anchorBackoff.approval, "locked");
assert.equal(anchorBackoff.defaults.prescription.strategy.id, "anchor_backoff");
assert.equal(anchorBackoff.derivationMethod.id, "percentage_of_anchor_load_v1",
  "percentage_of_anchor_load_v1 is the only approved v1 back-off derivation");
assert.deepEqual(anchorBackoff.derivationMethod.backoffPercentRange, [0.7, 0.95]);
const anchorParams = anchorBackoff.defaults.prescription.strategy.params;
assert.ok(anchorParams.backoffPercent >= 0.7 && anchorParams.backoffPercent <= 0.95, "authored back-off percent stays inside the approved band");
validateStrategyCases("anchor_backoff@1", anchorBackoff, "anchor_backoff", /^anchor-backoff-[a-z0-9-]+$/);
for (const testCase of anchorBackoff.cases) {
  const anchors = testCase.expected.sets.filter((set) => set.role === "anchor");
  assert.ok(anchors.length <= 1, `${testCase.id}: anchor_backoff@1 has exactly one anchor set`);
}

// manual@1
const manual = fixture.strategies["manual@1"];
assert.equal(manual.approval, "locked");
for (const testCase of manual.cases) {
  assert.match(testCase.id, /^manual-[a-z0-9-]+$/);
  assert.ok(typeof testCase.note === "string" && testCase.note.length, `${testCase.id}: every locked case states what it locks`);
  assert.equal(testCase.expected.kind, "manual", `${testCase.id}: manual@1 always answers manual`);
  assert.equal(testCase.expected.status, "manual", `${testCase.id}: manual@1 always reports manual status`);
  assert.deepEqual(testCase.expected.sets, [], `${testCase.id}: manual@1 never invents a target`);
  assert.ok(testCase.expected.reasonCodes.every((code) => code === "manual.authored_target" || code === "manual.unsupported_import"),
    `${testCase.id}: manual@1 has exactly two approved reason codes`);
  validateHistory(testCase);
}

// --- paired_exposure@1 --------------------------------------------------------
const paired = fixture.relations["paired_exposure@1"];
assert.equal(paired.approval, "locked");
assert.deepEqual(paired.allowedPairs, [{ heavy: "anchor_backoff@1", volume: "rep_goal@1" }],
  "exactly one heavy/volume combination is approved in v1");
assert.equal(paired.evidenceWindowSessions, 3);
for (const testCase of paired.cases) {
  assert.match(testCase.id, /^paired-[a-z0-9-]+$/);
  assert.ok(typeof testCase.note === "string" && testCase.note.length, `${testCase.id}: every locked case states what it locks`);
  for (const code of testCase.expected.reasonCodes || []) {
    assert.ok(code.startsWith("paired_exposure."), `${testCase.id}: paired_exposure reason namespace required`);
  }
  if (testCase.independent) {
    // Temper-only: the relation may make a result more conservative, never
    // more aggressive, and it never reduces on its own evidence.
    const rank = { reduce: 0, recalibrate: 0, hold: 1, advance: 2, new: 1, manual: 1 };
    assert.ok(rank[testCase.expected.status] <= rank[testCase.independent.status],
      `${testCase.id}: a paired result is never more aggressive than the independent result`);
    assert.notEqual(testCase.expected.status, "reduce", `${testCase.id}: paired evidence alone never forces a reduction`);
  }
}

// --- block-profile modifiers --------------------------------------------------
const modifiers = fixture.modifiers;
assert.equal(modifiers.approval, "locked");
assert.ok(modifiers.decision.includes("infrastructure only") || modifiers.decision.includes("No target-changing"),
  "the modifier decision must record that no periodization is approved");
const identity = modifiers.cases.find((testCase) => testCase.id === "modifier-identity-block-changes-nothing");
assert.ok(identity, "the identity modifier is the only approved v1 modifier");
assert.equal(identity.modifier.id, "identity_block");
assert.equal(identity.modifier.target, null, "the identity modifier adjusts no target field");
assert.deepEqual(identity.modifier.weekValues, [1, 1, 1, 1, 1, 1]);
assert.equal(identity.expected.targetChanged, false);
const approvedModifierIds = new Set(
  modifiers.cases.filter((testCase) => testCase.expected.targetChanged === false).map((testCase) => testCase.modifier.id),
);
assert.deepEqual([...approvedModifierIds], ["identity_block"],
  "no step-loading, volume-emphasis, rep-range-emphasis or deload modifier is approved");

const lockedCollections = [
  ...Object.entries(fixture.strategies),
  ...Object.entries(fixture.relations),
  ["modifiers", fixture.modifiers],
].filter(([, collection]) => collection.approval === "locked");

console.log(`PASS: ${seenCaseIds.size} locked cases across ${lockedCollections.length} approved contracts; no unapproved periodization`);
