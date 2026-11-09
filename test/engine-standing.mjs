// Standing boundaries are deterministic arithmetic: provenance, decay, pair agreement and breaks.
// The frozen outputs came from the base engine before standing existed, using these same real API inputs.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { cases } from "./fixtures/engine-standing.mjs";
const require = createRequire(import.meta.url);
const Engine = require("../progression-engine.js");
const Gauge = require("../calibration-gauge.js");
const frozen = JSON.parse(readFileSync(new URL("./fixtures/engine-standing.json", import.meta.url)));
const results = new Map();
for (const { name, input } of cases) {
  const before = structuredClone(input);
  const [result] = Engine.recommendSets(...input);
  const { standing, ...selection } = result;
  assert.deepEqual(selection, frozen.cases[name], `${name}: every existing result field, including selected load and reps, stays unchanged`);
  assert.deepEqual(input, before, `${name}: input is not mutated`);
  assert.equal(standing?.version, "standing@078.1", `${name}: standing exists on every result`);
  assert.deepEqual(Engine.recommendSets(...structuredClone(input))[0], result, `${name}: replay is deterministic`);
  results.set(name, standing);
}
const standing = (name, word, reasons) => {
  const value = results.get(name);
  assert.equal(value.word, word, name);
  assert.deepEqual(value.reasons, reasons, name);
  return value.evidence;
};
const empty = { sets: 0, sessions: 0, pairs: 0, agreement: null, gapDays: null, checks: 0, spread: null, state: "uncalibrated" };
assert.deepEqual(standing("no-history", "first", ["no_history"]), empty);
assert.deepEqual(standing("one-session-ten-days", "learning", ["few_sets", "few_sessions"]), {
  ...empty, sets: 3 * Gauge.decay("2026-10-30", "2026-11-09"), sessions: 1, pairs: 2, agreement: 1, gapDays: 10,
});
assert.deepEqual(standing("four-sessions", "solid", []), { ...empty, sets: 12, sessions: 4, pairs: 8, agreement: 1, gapDays: 0 });
assert.deepEqual(standing("three-on-target-checks", "solid", []), {
  sets: 12, sessions: 4, pairs: 8, agreement: 1, gapDays: 0, checks: 3, spread: 0, state: "calibrated",
});
const disagreement = standing("four-of-nine-pairs", "learning", ["disagreement"]);
assert.equal(disagreement.pairs, 9);
assert.equal(disagreement.agreement, 4 / 9);
assert.equal(standing("fifty-day-break", "learning", ["break"]).gapDays, 50);
assert.equal(standing("six-sets-two-sessions", "solid", []).sets, 6);
standing("below-six-sets", "learning", ["few_sets"]);
standing("six-sets-one-session", "learning", ["few_sessions"]);
assert.equal(standing("agreement-at-point-six", "solid", []).agreement, 0.6);
assert.equal(standing("three-disagreeing-pairs", "solid", []).pairs, 3);
assert.equal(standing("four-disagreeing-pairs", "learning", ["disagreement"]).pairs, 4);
standing("forty-one-day-gap", "solid", []);
standing("forty-two-day-gap", "learning", ["break"]);
for (const source of ["rir", "reps_left", "effort", "reps_left_3plus", "reps_left_5plus", "null"]) {
  const evidence = standing(`quality-${source}`, "solid", []);
  assert.equal(evidence.sets, ["rir", "reps_left"].includes(source) ? 12 : 6, source);
  assert.equal(evidence.sessions, 4);
  assert.equal(evidence.pairs, 8);
  assert.equal(evidence.agreement, 1);
}
for (const name of ["quality-prefilled", "quality-unsure", "quality-failure", "missing-date", "warmup"]) {
  assert.deepEqual(standing(name, "learning", ["few_sets", "few_sessions"]), empty);
}
assert.equal(standing("ninety-day-decay", "learning", ["few_sets", "break"]).sets, 3);
const identical = standing("identical-pairs", "solid", []);
assert.equal(identical.pairs, 0);
assert.equal(identical.agreement, null);
const inconsistent = standing("inconsistent-checks", "learning", ["inconsistent_checks"]);
assert.equal(inconsistent.checks, 4);
assert.equal(inconsistent.spread, 3);
assert.equal(inconsistent.state, "uncalibrated");
assert.equal(standing("foreign-calibration", "solid", []).checks, 0);
assert.deepEqual(standing("live-only", "first", ["live_only"]), empty);
assert.deepEqual(standing("configuration-required", "first", ["no_history"]), empty);
assert.deepEqual(standing("invalid", "first", ["no_history"]), empty);
for (const delta of [-1, 1, 2]) {
  const evidence = standing(`bounded-shift-${delta}`, "solid", []);
  assert.equal(evidence.checks, 4);
  assert.equal(evidence.state, delta < 0 ? "under" : "over");
}
for (const name of ["wrong-equipment", "missing-rir"]) assert.deepEqual(standing(name, "first", ["no_history"]), empty);
// The gauge and engine use exactly the same exported pair rule, including both bounds and the RIR cap.
for (const [ratio, agree] of [[0.849, false], [0.85, true], [1.03, true], [1.031, false]]) {
  const pair = Gauge.pairsFrom([
    { key: "lift", session: "s", set: 0, load: 100, reps: 10, rir: 2, q: 1 },
    { key: "lift", session: "s", set: 1, load: 100 * ratio, reps: 10, rir: 2, q: 1 },
  ], (load, reps, rir) => load * (1 + (reps + rir) / 30));
  assert.equal(pair[0].agree, agree);
}
assert.equal(Engine.STANDING_VERSION, "standing@078.1");
assert.equal(Engine.CALIBRATION_VERSION, "calibration@077.1");
console.log(`PASS engine standing: ${cases.length} frozen selection/standing cases and shared pair boundaries`);
