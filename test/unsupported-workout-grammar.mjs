import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Grammar = require("../unsupported-workout-grammar.js");
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

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
assert.match(index, /<script src="unsupported-workout-grammar\.js"><\/script>/,
  "the measurement module loads from the production shell");
assert.match(worker, /"\.\/unsupported-workout-grammar\.js"/,
  "the measurement module is precached for offline launch");
assert.match(worker, /const SHELL = new Set\([^;]*"\/unsupported-workout-grammar\.js"/s,
  "the measurement module is covered by shell caching");

console.log("unsupported workout grammar: canonical categories normalize safely");
