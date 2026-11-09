#!/usr/bin/env node
/**
 * Plan 077 PR 3: which exercises can take a max set, what the guess is prefilled with, how often one is offered,
 * and how a guess compares with what was done (effort-calibration.js, OD-9 to OD-12).
 *
 * Run: node test/effort-calibration.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { cases as standingCases } from "./fixtures/engine-standing.mjs";
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
// Owner decision 2026-11-09: both words in the English catalog name exclude the movement.
const namedBarbellSquats = catalog.exercises.filter(exercise => /barbell/i.test(exercise.name) && /squat/i.test(exercise.name));
assert.deepEqual(catalog.exercises.filter(exercise => /barbell/i.test(exercise.name) && /squat/i.test(exercise.name) &&
  Calibration.eligibility({exercise,lookup}).eligible).map(exercise => exercise.name), [],
  "no English catalog name containing both barbell and squat remains eligible");
for (const exercise of namedBarbellSquats) for (const name of [exercise.name,exercise.name.toUpperCase()])
  for (const equipmentName of [null,"Dumbbells","Barbell"])
    assert.equal(Calibration.eligibility({exercise:{...exercise,name},lookup,equipmentName}).eligible,false,
      `${name}: the name exclusion applies regardless of case or performed equipment`);
const additionalNames = ["Barbell Bulgarian split squat","Barbell front foot elevated split squat","Barbell split squat"];
const additionalIds = new Set(additionalNames.map(name => {
  assert.ok(byName(name),`${name} is in the catalog`); return byName(name).id;
}));
const retainedExclusions = catalog.exercises.filter(exercise => !additionalIds.has(exercise.id) &&
  !Calibration.eligibility({exercise,lookup}).eligible).map(exercise => exercise.id).sort();
assert.equal(retainedExclusions.length,113,"all 113 prior default exclusions remain");
assert.equal(createHash("sha256").update(retainedExclusions.join("\n")).digest("hex"),
  "5afa7b8dbd7bf5ede49b12fc248b6902ca28e0ebb0403a5421cfdd3de0505afc",
  "across the whole catalog, no other default eligibility changes");
assert.equal(createHash("sha256").update(JSON.stringify(catalog.exercises.map(exercise =>
  [exercise.id,Calibration.eligibility({exercise,lookup}).press]).sort())).digest("hex"),
  "7eec11fa4494cb01109d4f78355e1c4e9eb3740a6611b038bc6d4127ef11ce93","press safety classification is unchanged across the whole catalog");

// The catalog's excluded set is pinned, so a catalog or rule change is a reviewed change.
const excluded = catalog.exercises.filter((exercise) => !Calibration.eligibility({ exercise, lookup }).eligible)
  .map((exercise) => exercise.id).sort();
assert.equal(excluded.length, 116, "the rule excludes 116 of the catalog's exercises");
assert.equal(createHash("sha256").update(excluded.join("\n")).digest("hex"),
  "5ff2692cc82953d165d115df4e84af2405c75916e078367695c3be3653063540", "the excluded set is the reviewed one");
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

// Plan 080: uncertainty requests a check; frequency limits remain separate ceilings.
assert.equal(Calibration.RECHECK_DAYS, 60);
const request = (word, state, n, lastCheckDays, reason = null) => Calibration.shouldOffer({
  standing: { word }, calibration: { state, n, reason }, lastCheckDays });
assert.deepEqual(request("learning", "calibrated", 3, 1), { ok: true, reason: "learning" });
for (const word of ["first", "solid"]) {
  for (const n of [0, 1, 2]) assert.equal(request(word, "uncalibrated", n, null, "few").ok, true);
  assert.equal(request(word, "uncalibrated", 3, 1, "inconsistent").ok, true);
}
for (const state of ["calibrated", "over", "under"]) {
  assert.equal(request("solid", state, 3, 59).ok, false);
  assert.deepEqual(request("solid", state, 3, 60), { ok: true, reason: "recheck" });
  assert.equal(request("solid", state, 3, null).ok, false);
  assert.equal(request("first", state, 3, 60).ok, false);
}
assert.equal(Calibration.frequencyAllows({history:[{exerciseKey:"other",date:"2026-11-01"}],
  today:"2026-11-06",exerciseKey:"curl",gaugeFull:true}).ok, true, "the global monthly schedule is retired");

// R716-1: the real engine fallback must preserve targets without requesting a failure set.
{
  const realm = createContext({});
  for (const file of ["exercise-metrics.js", "progression-engine.js", "calibration-gauge.js"])
    runInContext(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), realm);
  const gauge = realm.RepForgeCalibrationGauge;
  const run = input => {
    realm.inputJson = JSON.stringify(input);
    return JSON.parse(runInContext("JSON.stringify(RepForgeProgression.recommendSets(...JSON.parse(inputJson)))", realm))[0];
  };
  const solid = standingCases.find(item => item.name === "three-on-target-checks").input;
  const selected = run(solid), calibration = solid[4].calibration;
  assert.equal(selected.standing.word, "solid");
  assert.equal(Calibration.shouldOffer({standing:selected.standing,calibration,lastCheckDays:20}).ok, false);
  const learning = run(standingCases.find(item => item.name === "one-session-ten-days").input);
  assert.equal(Calibration.shouldOffer({standing:learning.standing,calibration:Calibration.estimate([])}).ok, true,
    "genuine qualifying uncertainty still requests a check");
  const broken = () => { throw new Error("standing calculation failed"); };
  for (const [index,fault] of [undefined,{}, {decay:gauge.decay},
    {...gauge,decay:broken},{...gauge,rowQuality:broken},{...gauge,pairsFrom:broken}].entries()) {
    realm.RepForgeCalibrationGauge = fault;
    const fallback = run(solid);
    const {standing,...target} = fallback, {standing:normal,...expected} = selected;
    assert.deepEqual(target,expected,`fault ${index}: every selected target field survives`);
    for (const currentCalibration of [calibration,Calibration.estimate([])])
      assert.deepEqual(Calibration.shouldOffer({standing,calibration:currentCalibration,lastCheckDays:20}),
        {ok:false,reason:null},`fault ${index}: unavailable evidence never requests a failure set`);
    assert.equal(standing.unavailable,true,`fault ${index}: the fallback marks its evidence unavailable`);
  }
}

// The result: guess − did; positive means fewer than guessed.
assert.deepEqual(Calibration.result(13, 16), { guess: 13, did: 16, error: -3 });
assert.deepEqual(Calibration.result(10, 9), { guess: 10, did: 9, error: 1 });
assert.equal(Calibration.result(10, null), null);

// The estimator (Plan 077 PR 5, OD-14 to OD-18), on the plan's worked examples.
const near = (actual, expected) => Math.abs(actual - expected) < 1e-9;
assert.equal(Calibration.CALIBRATION_VERSION, "calibration@077.1");
{
  // W1: one check of −3 shrinks to −1, but under three checks nothing changes.
  const w1 = Calibration.estimate([-3]);
  assert.ok(w1.n === 1 && near(w1.bias, -1) && w1.spread === null && w1.state === "uncalibrated" && w1.reason === "few" && w1.delta === 0, JSON.stringify(w1));
  // W2: −3, −2, −2.5 → bias −1.5, spread 0.5: tends to under-estimate; the shift is held at −1.
  const w2 = Calibration.estimate([-3, -2, -2.5]);
  assert.ok(near(w2.bias, -1.5) && near(w2.spread, 0.5) && w2.state === "under" && w2.delta === -1, JSON.stringify(w2));
  // W3: +2, +1, +3, +2 → bias 4/3, spread 0.82: tends to over-estimate; the shift is the bias.
  const w3 = Calibration.estimate([2, 1, 3, 2]);
  assert.ok(near(w3.bias, 4 / 3) && Math.abs(w3.spread - 0.8165) < 1e-4 && w3.state === "over" && near(w3.delta, 4 / 3), JSON.stringify(w3));
  // W4: 0, −1, +0.5, 0, +0.5 → bias 0, spread 0.61: on target, no shift.
  const w4 = Calibration.estimate([0, -1, 0.5, 0, 0.5]);
  assert.ok(near(w4.bias, 0) && Math.abs(w4.spread - 0.6124) < 1e-4 && w4.state === "calibrated" && w4.delta === 0, JSON.stringify(w4));
  // W5: −2, +1, −3 → bias −0.8 but spread 2.08: inconsistent, so no shift; the mirror +2, −1, +3 over-estimates (its
  // shift only lowers loads, so it needs no agreement).
  const w5 = Calibration.estimate([-2, 1, -3]);
  assert.ok(near(w5.bias, -0.8) && w5.state === "uncalibrated" && w5.reason === "inconsistent" && w5.delta === 0, JSON.stringify(w5));
  const w5m = Calibration.estimate([2, -1, 3]);
  assert.ok(near(w5m.bias, 0.8) && w5m.state === "over" && near(w5m.delta, 0.8), JSON.stringify(w5m));
  // Bounds: a large over-estimate shifts at most 2; errors are clipped to ±5.
  assert.equal(Calibration.estimate([5, 5, 5, 5, 5, 5]).delta, 2);
  assert.ok(near(Calibration.estimate([9, 9, 9]).bias, 3), "a +9 counts as +5");
}
{
  // checkErrors: the last six of the counted checks, oldest first.
  const at = (date, ...pairs) => ({ date, checks: pairs.map(([predictedReps, reps]) => ({ predictedReps, reps })) });
  const steady = [at("2026-10-01", [11, 14]), at("2026-10-08"), at("2026-10-15", [10, 12]), at("2026-10-22", [12, 12])];
  assert.deepEqual(Calibration.checkErrors({ sessions: steady, today: "2026-10-29" }), [-3, -2, 0]);
  // W6, a long break: sessions on 1 June then 20 July (49 days): the June check no longer counts.
  const brk = [at("2026-06-01", [11, 14]), at("2026-07-20", [10, 10])];
  assert.deepEqual(Calibration.checkErrors({ sessions: brk, today: "2026-07-20" }), [0]);
  // A break since the last session counts too: returning after 42 days starts again.
  assert.deepEqual(Calibration.checkErrors({ sessions: steady, today: "2026-12-03" }), []);
  // Older than 180 days drops out even without a break (sessions every few weeks).
  const long = Array.from({ length: 8 }, (_, i) => at(new Date(Date.UTC(2026, 0, 1 + i * 30)).toISOString().slice(0, 10), [10, 10 + i]));
  assert.deepEqual(Calibration.checkErrors({ sessions: long, today: "2026-08-10" }), [-2, -3, -4, -5, -6, -7]);
  assert.deepEqual(Calibration.checkErrors({ sessions: long, today: "2026-08-30" }), [-3, -4, -5, -6, -7], "by 30 August the March check is over 180 days old");
  const weekly = Array.from({ length: 8 }, (_, i) => at(new Date(Date.UTC(2026, 9, 1 + i * 7)).toISOString().slice(0, 10), [10, 10 + i]));
  assert.deepEqual(Calibration.checkErrors({ sessions: weekly, today: "2026-11-20" }), [-2, -3, -4, -5, -6, -7], "the window keeps the last six");
}

console.log("PASS effort calibration (Plan 077 PR 3)");
