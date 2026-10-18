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
