import assert from "node:assert/strict";

import {unsupportedGrammar as Grammar} from '../src/interchange/program-file.js';
const expected = ["supersets", "rest_times", "rir_rpe", "tempo", "warmups", "cardio", "progression_rules", "deload"];

assert.deepEqual(Grammar.CATEGORIES, expected);
for (const category of expected) assert.deepEqual(Grammar.normalize([category]), [category]);
assert.deepEqual(Grammar.recognizedForDisplay(expected, [...expected, "other_notes"]), expected,
  "every measured category remains in the reviewed display vocabulary");
assert.deepEqual(Grammar.normalize(["tempo", "tempo", "supersets", "supersets"]), ["supersets", "tempo"]);
assert.deepEqual(Grammar.normalize(["unknown private exercise name", "tempo", "PII: person@example.test"]), ["tempo"]);
assert.deepEqual(Grammar.recognizedForDisplay(["other_notes", "tempo", "tempo", "unknown"], [
  ...expected, "other_notes",
]), ["other_notes", "tempo", "tempo"]);
for (const malformed of [undefined, null, "tempo", {}, [null, 4, {}, ["tempo"]]])
  assert.deepEqual(Grammar.normalize(malformed), []);

// Runtime graph/cache completeness belongs to release assembly, not a
// historical script-tag position. Pure vocabulary semantics remain above.
console.log('unsupported workout grammar: canonical categories normalize safely');
