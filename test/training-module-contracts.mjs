import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Text } from "../src/training/identity.js";
import { createTransitionRules } from "../src/training/generation.js";
const transition=createTransitionRules();
// The pure identity digest must preserve the cryptographic bytes already used
// by saved transition capabilities. Include surrogate and padding boundaries.
for (const text of ["", "abc", "é😀", "\ud800", "\udc00", ...[55, 56, 63, 64, 65, 1000].map(n => "x".repeat(n))]) {
  assert.equal(sha256Text(text), createHash("sha256").update(text, "utf8").digest("hex"));
}
const value = { programDefinition: { name: "é😀", days: [] }, customExerciseDefinitions: [] };
const expected = createHash("sha256").update(transition.canonicalProposalJson(value), "utf8").digest("hex");
assert.equal(await transition.fingerprintProgramDefinition(value.programDefinition), `program-definition-sha256:${expected}`);
console.log("PASS native training SHA256/transition fingerprint byte parity");

// Input contracts use explicit units and preserve full storage precision.
const input=await import('../src/training/metrics.js');
assert.equal(input.canonicalNumberText(1e-7),'0.0000001');
assert.equal(input.canonicalNumberText(-1.25e21),'-1250000000000000000000');
assert.equal(input.canonicalDraftField('load','12,5','lb'),'5.669904625125443');
assert.equal(input.canonicalDraftField('load','1e3','kg'),'1e3');
assert.equal(input.canonicalDraftField('reps','8,0'),'8');
assert.equal(input.canonicalDraftField('reps','8,5'),'8,5');
assert.equal(input.canonicalDraftField('rir','1,5'),'1.5');
assert.equal(input.canonicalMetricInput({semantic:'loadPerSideKg'},'12,5','lb'),'5.669904625125443');
assert.equal(input.canonicalMetricInput({semantic:'durationSeconds'},'1,5','lb'),'1.5');
assert.equal(input.canonicalMetricInput({semantic:'loadKg'},String(1000*2.2046226218),'lb'),'1000');
assert.equal(input.canonicalMetricInput({semantic:'reps'},'incomplete'),'incomplete');
