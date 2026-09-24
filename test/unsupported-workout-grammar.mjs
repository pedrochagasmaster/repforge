import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Grammar = require("../unsupported-workout-grammar.js");
const expected = ["supersets", "rest_times", "rir_rpe", "tempo", "warmups", "cardio", "progression_rules", "deload"];

assert.deepEqual(Grammar.CATEGORIES, expected);
for (const category of expected) assert.deepEqual(Grammar.normalize([category]), [category]);
assert.deepEqual(Grammar.normalize(["tempo", "tempo", "supersets", "supersets"]), ["supersets", "tempo"]);
assert.deepEqual(Grammar.normalize(["unknown private exercise name", "tempo", "PII: person@example.test"]), ["tempo"]);
assert.deepEqual(Grammar.normalizeForDisplay(["other_notes", "tempo", "tempo", "unknown"], [
  ...expected, "other_notes",
]), ["other_notes", "tempo"]);
for (const malformed of [undefined, null, "tempo", {}, [null, 4, {}, ["tempo"]]])
  assert.deepEqual(Grammar.normalize(malformed), []);

console.log("unsupported workout grammar: canonical categories normalize safely");
