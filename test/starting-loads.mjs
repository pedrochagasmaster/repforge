#!/usr/bin/env node
// Algorithm boundaries: published priors, grid floors, ramp arithmetic and ratios.
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Loads = require("../starting-loads.js");
const catalog = require("../assets/exercise-catalog.json");
const lookup = id => catalog.uuidIndex[id] || null;
const exercise = name => {
  const entry = catalog.exercises.find(e => e.name === name);
  assert.ok(entry, name);
  return entry;
};
const grid = Array.from({ length: 100 }, (_, i) => (i + 1) * 2.5);
const args = (name, extra = {}) => ({ exercise: exercise(name), lookup,
  convention: "external", bodyweightKg: 80, experience: "beginner", grid, ...extra });
assert.equal(Loads.PRIORS_VERSION, "priors@079.1");
const expected = {
  Squat: [[.35,.55,.75],[.30,.50,.70],[.10,.15,.20],[.80,1.20,1.60]],
  "Hip Hinge": [[.45,.70,.95],[.40,.60,.80],[.12,.18,.25],[.30,.45,.60]],
  "Horizontal Push": [[.30,.50,.70],[.25,.45,.65],[.10,.17,.25],[.25,.40,.55]],
  "Vertical Push": [[.20,.30,.45],[.18,.28,.40],[.06,.10,.15],[.15,.25,.35]],
  "Horizontal Pull": [[.30,.45,.60],null,[.10,.17,.25],[.25,.40,.55]],
  "Vertical Pull": [null,null,null,[.35,.50,.70]],
  Accessory: [[.10,.15,.20],[.10,.15,.20],[.04,.06,.08],[.10,.15,.25]],
};
assert.deepEqual(Loads.PRIORS, expected, "exact Plan 079 draft values; absent cells stay absent");
for (const row of Object.values(Loads.PRIORS)) for (const cell of row) {
  if (cell === null) continue;
  assert.equal(cell.length, 3);
  for (const fraction of cell) assert.ok(Number.isFinite(fraction) && fraction > 0);
}
assert.deepEqual(Loads.openingLoad(args("Barbell back squat")), { loadKg: 27.5, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { experience: "advanced" })), { loadKg: 60, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("Smith machine bench press")), { loadKg: 20, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("Dumbbell bench press", { convention: "per_side", grid: [2,4,6,8,10] })), { loadKg: 8, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("45° leg press")), { loadKg: 62.5, basis: "prior" });
for (const bodyweightKg of [null, undefined, "", 0, -1, NaN, Infinity]) {
  assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { bodyweightKg })), { loadKg: 20, basis: "floor" });
  assert.deepEqual(Loads.openingLoad(args("45° leg press", { bodyweightKg, grid: [5,10,15] })), { loadKg: 5, basis: "floor" });
}
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { bodyweightKg: 30, grid: [5,12,19,26,33] })), { loadKg: 26, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { equipmentName: "Dumbbells", grid: [2,4,6,8] })), { loadKg: 8, basis: "prior" });
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { grid: [10,5,2.5,5,NaN,-1] })), { loadKg: null, basis: "floor" });
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { convention: "bodyweight" })), { loadKg: null, basis: "floor" });
assert.deepEqual(Loads.openingLoad(args("Barbell back squat", { convention: "assistance" })), { loadKg: null, basis: "floor" });
assert.deepEqual(Loads.openingLoad({ grid: [5,10], bodyweightKg: 80 }), { loadKg: 5, basis: "floor" });
assert.equal(Loads.nextRampLoad({ loadKg: 40, reps: 8, targetRir: 2, grid }), 42.5);
assert.equal(Loads.nextRampLoad({ loadKg: 8, reps: 8, targetRir: 2, grid: [2,4,6,8,10,12] }), 10);
assert.equal(Loads.nextRampLoad({ loadKg: 40, reps: 8, targetRir: 0, grid }), 42.5);
assert.equal(Loads.nextRampLoad({ loadKg: 40, reps: 8, targetRir: 2, grid: [20,40] }), null);
assert.equal(Loads.nextRampLoad({ loadKg: NaN, reps: 8, targetRir: 2, grid }), null);
const from = args("Barbell back squat");
const to = args("Dumbbell bench press", { convention: "per_side", grid: [2,4,6,8,10,12,14,16,18,20] });
assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: 60, from, to }), { loadKg: 16, basis: "ratio" });
assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: null, from, to }), { loadKg: 8, basis: "prior" });
assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: 60, from: { ...from, exercise: null }, to }), { loadKg: 8, basis: "prior" });
assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: 60, from: { ...from, bodyweightKg: null }, to: { ...to, bodyweightKg: null } }), { loadKg: 16, basis: "ratio" });
console.log("starting loads: published table and boundary cases passed");

test("catalog machine categories supply the declared prior without a machine word in the name", () => {
  assert.deepEqual(Loads.openingLoad(args("Pendulum squat", { grid: Array.from({ length: 14 }, (_, i) => (i + 1) * 5) })), { loadKg: 60, basis: "prior" });
});
test("a ratio needs only the destination grid", () => {
  assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: 60, from: { ...from, grid: undefined }, to }), { loadKg: 16, basis: "ratio" });
});
test("an exact decimal boundary does not lose a grid step", () => {
  assert.deepEqual(Loads.openingLoad(args("Barbell bench press", { bodyweightKg: 90, experience: "advanced", grid: Array.from({ length: 100 }, (_, i) => i + 1) })), { loadKg: 63, basis: "prior" });
});

test("an excluded source convention cannot supply an external-load ratio", () => {
  assert.deepEqual(Loads.ratioLoad({ anchorLoadKg: 60, from: { ...from, convention: "bodyweight" }, to }), { loadKg: 8, basis: "prior" });
});
