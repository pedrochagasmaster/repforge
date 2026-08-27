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

function validatePendingCollection(id, collection) {
  assert.ok(approvals.has(collection.approval), `${id}: unknown approval`);
  assert.ok(Array.isArray(collection.cases), `${id}: cases must be an array`);
  if (collection.approval === "pending") {
    assert.ok(collection.requiredDecisions?.length, `${id}: pending contract needs decisions`);
    assert.equal(collection.cases.length, 0, `${id}: pending contract cannot carry executable cases`);
  }
}

for (const [id, strategy] of Object.entries(fixture.strategies)) {
  validatePendingCollection(id, strategy);
}
for (const [id, relation] of Object.entries(fixture.relations)) {
  validatePendingCollection(id, relation);
}
validatePendingCollection("modifiers", fixture.modifiers);

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

const allowedKinds = new Set(["recommendation", "manual", "insufficient_evidence", "incompatible", "invalid"]);
const allowedStatuses = new Set(["new", "advance", "hold", "reduce", "recalibrate", "manual"]);
const allowedLegacyStatuses = new Set(["new", "add", "add2", "hold", "reduce"]);

for (const testCase of range.cases) {
  assert.match(testCase.id, /^range-[a-z0-9-]+$/);
  assert.ok(!seenCaseIds.has(testCase.id), `${testCase.id}: duplicate case id`);
  seenCaseIds.add(testCase.id);
  assert.equal(testCase.approval, "locked", `${testCase.id}: range case must be locked`);
  assert.ok(Array.isArray(testCase.history), `${testCase.id}: history must be an array`);
  assert.ok(testCase.expected && typeof testCase.expected === "object", `${testCase.id}: expected result required`);
  assert.ok(allowedKinds.has(testCase.expected.kind), `${testCase.id}: invalid kind`);
  assert.ok(allowedStatuses.has(testCase.expected.status), `${testCase.id}: invalid status`);
  assert.ok(allowedLegacyStatuses.has(testCase.expected.legacyStatus), `${testCase.id}: invalid legacy status`);
  assert.ok(Array.isArray(testCase.expected.reasonCodes) && testCase.expected.reasonCodes.length, `${testCase.id}: reason codes required`);
  assert.ok(testCase.expected.reasonCodes.every((code) => code.startsWith("range.")), `${testCase.id}: range reason namespace required`);
  assert.ok(testCase.expected.targetLoad === null || Number.isFinite(testCase.expected.targetLoad), `${testCase.id}: target load must be finite or null`);
  assert.ok(Number.isInteger(testCase.expected.targetReps), `${testCase.id}: target reps must be an integer`);

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

const requiredCases = [
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
for (const id of requiredCases) assert.ok(seenCaseIds.has(id), `${id}: required parity case missing`);

console.log(`PASS: ${range.cases.length} locked range fixtures; pending numeric contracts remain non-executable`);
