import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

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
const assetsSource = worker.match(/\bconst ASSETS\s*=\s*(\[[\s\S]*?\n\])/)?.[1];
assert.ok(assetsSource, "sw.js declares the ASSETS release inventory");
const assets = runInNewContext(assetsSource, {}, { timeout: 1000 });
const entries = assets.map((entry) => typeof entry === "string" ? { url: entry } : entry);
const moduleEntries = entries.filter((entry) => entry.url === "./unsupported-workout-grammar.js");
assert.equal(moduleEntries.length, 1, "the measurement module has exactly one release-inventory entry");
assert.equal(typeof assets.find((entry) => entry === "./unsupported-workout-grammar.js"), "string",
  "the measurement module is a plain string entry (required, network-first, no owner or cache policy)");
assert.notEqual(moduleEntries[0].required, false, "the measurement module is a required release asset");
assert.notEqual(moduleEntries[0].immutable, true, "the measurement module is not an immutable runtime");
assert.equal(index.match(/<script src="unsupported-workout-grammar\.js"><\/script>/g)?.length, 1,
  "index.html loads the measurement module exactly once, without a query revision");
assert.ok(index.indexOf('src="telemetry.js"') < index.indexOf('src="unsupported-workout-grammar.js"'),
  "the measurement module loads after telemetry.js");
assert.doesNotMatch(worker, /const SHELL\s*=/, "the retired SHELL set is not reintroduced");

console.log("unsupported workout grammar: canonical categories normalize safely");
