#!/usr/bin/env node
/**
 * Plan 077 PR 3: which exercises can take a max set, what the guess is prefilled with, how often one is offered,
 * and how a guess compares with what was done (effort-calibration.js, OD-9 to OD-12).
 *
 * Run: node test/effort-calibration.mjs
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Calibration = require("../effort-calibration.js");
const catalog = require("../assets/exercise-catalog.json");
const lookup = (id) => catalog.uuidIndex[id] || null;
const byName = (name) => catalog.exercises.find((exercise) => exercise.name.toLowerCase() === name.toLowerCase());
const fit = (name, extra = {}) => Calibration.eligibility({ exercise: byName(name), lookup, ...extra });

// OD-11: everything except the squat, hinge and horizontal-push families done with a free barbell.
for (const name of ["Barbell back squat", "Barbell bench press", "Conventional deadlift", "Barbell Romanian deadlift", "Front squat"]) {
  assert.ok(byName(name), `${name} is in the catalog`);
  assert.equal(fit(name).eligible, false, `${name} is a big barbell lift`);
}
for (const name of ["Dumbbell bench press", "Smith machine back squat", "Dumbbell Romanian deadlift", "45° leg press",
  "Barbell overhead press", "Pin-loaded machine shoulder press"]) {
  assert.ok(byName(name), `${name} is in the catalog`);
  assert.equal(fit(name).eligible, true, `${name} can take a max set`);
}
assert.equal(fit("Dumbbell bench press").press, true, "a dumbbell press carries the press safety line");
assert.equal(fit("Barbell overhead press").press, true, "an overhead press carries it too");
assert.equal(fit("45° leg press").press, false, "a leg press is not a press for the safety line");
// The performed equipment decides when it is known.
assert.equal(fit("Barbell bench press", { equipmentName: "Dumbbells" }).eligible, true, "a bench press done with dumbbells is eligible");
assert.equal(fit("Barbell bench press", { equipmentName: "Barbell" }).eligible, false, "with the barbell it is not");
// Custom exercises: the name is the only clue.
const custom = (customName) => Calibration.eligibility({ customName });
assert.equal(custom("My cable fly").eligible, true);
assert.equal(custom("Paused bench").eligible, false);
assert.equal(custom("Agachamento livre").eligible, false);
assert.equal(custom("Levantamento terra romeno").eligible, false);
assert.equal(custom("Supino inclinado").press, true);
// The catalog's excluded set is pinned, so a catalog or rule change is a reviewed change.
const excluded = catalog.exercises.filter((exercise) => !Calibration.eligibility({ exercise, lookup }).eligible)
  .map((exercise) => exercise.id).sort();
assert.equal(excluded.length, 113, "the rule excludes 113 of the catalog's exercises");
assert.equal(createHash("sha256").update(excluded.join("\n")).digest("hex"),
  "5afa7b8dbd7bf5ede49b12fc248b6902ca28e0ebb0403a5421cfdd3de0505afc", "the excluded set is the reviewed one");
assert.equal(Calibration.VERSION, "eligibility@077.1");

// OD-9: reps + reps left − 1; the reps alone without a known RIR; clamped to the stepper.
assert.deepEqual(Calibration.prefillGuess(12, 2), { predictedReps: 13, prefillBasis: "reps_rir" });
assert.deepEqual(Calibration.prefillGuess(10, 1), { predictedReps: 10, prefillBasis: "reps_rir" });
assert.deepEqual(Calibration.prefillGuess(8, null), { predictedReps: 8, prefillBasis: "reps" });
assert.deepEqual(Calibration.prefillGuess(29, 5), { predictedReps: 30, prefillBasis: "reps_rir" });
assert.equal(Calibration.prefillGuess(0, 2), null);

// OD-12: once a workout, once a lift in 14 days, twice a calendar week (ISO, from Monday).
const allows = (history, today, inWorkout = 0) => Calibration.frequencyAllows({ history, today, exerciseKey: "curl", inWorkout });
assert.equal(allows([], "2026-11-06").ok, true);
assert.equal(allows([], "2026-11-06", 1).reason, "per_workout");
assert.equal(allows([{ exerciseKey: "curl", date: "2026-10-24" }], "2026-11-06").reason, "per_exercise", "13 days ago is too soon");
assert.equal(allows([{ exerciseKey: "curl", date: "2026-10-23" }], "2026-11-06").ok, true, "14 days ago is fine");
const week = [{ exerciseKey: "row", date: "2026-11-02" }, { exerciseKey: "press", date: "2026-11-04" }];
assert.equal(allows(week, "2026-11-06").reason, "per_week", "two this week (Monday 2 November on) already");
assert.equal(allows(week, "2026-11-09").ok, true, "the next Monday starts a new week");
assert.equal(allows([{ exerciseKey: "row", date: "2026-11-01" }, { exerciseKey: "press", date: "2026-11-04" }], "2026-11-06").ok, true,
  "Sunday 1 November belongs to the week before");

// The result: guess − did; positive means fewer than guessed.
assert.deepEqual(Calibration.result(13, 16), { guess: 13, did: 16, error: -3 });
assert.deepEqual(Calibration.result(10, 9), { guess: 10, did: 9, error: 1 });
assert.equal(Calibration.result(10, null), null);

console.log("PASS effort calibration (Plan 077 PR 3)");
