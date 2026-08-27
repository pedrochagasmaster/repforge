#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modulePath = path.join(root, "progression-engine.js");
const require = createRequire(import.meta.url);
const Engine = require(modulePath);

assert.equal(Engine.ENGINE_VERSION, 1);
assert.deepEqual(Engine.STRATEGY_IDS, ["range", "rep_goal", "anchor_backoff", "manual"]);
assert.ok(Object.isFrozen(Engine));
assert.ok(Object.isFrozen(Engine.CAPACITY));

const imported = await import(`${pathToFileURL(modulePath).href}?purity=${Date.now()}`);
assert.equal(imported.default.ENGINE_VERSION, 1, "dynamic import must expose the CommonJS UMD API");

const source = fs.readFileSync(modulePath, "utf8");
for (const forbidden of ["document", "localStorage", "sessionStorage", "XMLHttpRequest", "fetch("]) {
  assert.ok(!source.includes(forbidden), `pure module must not contain ${forbidden}`);
}

assert.equal(Engine.capRir(3, 4), 3);
assert.equal(Engine.capRir(99, 4), 4);
assert.equal(Engine.capRir(-2, 4), 0);
assert.equal(Engine.capRir("", 4), 1);
assert.equal(Engine.capRir(null, 4), 1);
assert.equal(Engine.capReps(6, 3, 4), 9);
assert.equal(Engine.capE1rm(100, 6, 3, 4), 130);
assert.equal(Engine.repsAtLoad(Engine.e1rm(100, 9), 100), 9);
assert.equal(Engine.roundToGrid(101, 2.5), 100);
assert.equal(Engine.jumpAmount(20, 1, { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 }), 2.5);

const prescription = {
  schemaVersion: 1,
  strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 6, repMax: 8 } },
  modifiers: [],
};
const settings = { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 };
const history = [{
  sessionId: "s1",
  date: "2026-01-01",
  sets: [
    { load: 100, reps: 6, rir: 3 },
    { load: 100, reps: 6, rir: 99 },
    { load: 100, reps: 5, rir: null },
  ],
}];

const frozenPrescription = structuredClone(prescription);
const frozenSettings = structuredClone(settings);
const frozenHistory = structuredClone(history);
Object.freeze(prescription.strategy.params);
Object.freeze(prescription.strategy);
Object.freeze(prescription.modifiers);
Object.freeze(prescription);
Object.freeze(settings);
for (const set of history[0].sets) Object.freeze(set);
Object.freeze(history[0].sets);
Object.freeze(history[0]);
Object.freeze(history);

assert.equal(Engine.validateRangePrescription(prescription).ok, true);
assert.equal(Engine.validateSettings(settings).ok, true);
const normalized = Engine.normalizeHistory(history);
assert.equal(normalized.ok, true);
assert.deepEqual(prescription, frozenPrescription, "prescription validation must not mutate input");
assert.deepEqual(settings, frozenSettings, "settings validation must not mutate input");
assert.deepEqual(history, frozenHistory, "history normalization must not mutate input");

const summarizedA = Engine.summarizeHistory(history, settings.hardRir);
const summarizedB = Engine.summarizeHistory(history, settings.hardRir);
assert.deepEqual(summarizedA, summarizedB, "summary must be deterministic");
assert.deepEqual(summarizedA.value[0], {
  sessionId: "s1",
  date: "2026-01-01",
  sets: [
    { load: 100, reps: 6, rir: 3 },
    { load: 100, reps: 6, rir: 99 },
    { load: 100, reps: 5, rir: null },
  ],
  medianLoad: 100,
  minimumReps: 5,
  maximumReps: 6,
  medianReps: 6,
  averageRir: 34,
  bestE1rm: 120,
  bestCapacity: 133.33333333333331,
  medianCapacity: 130,
  medianCappedRir: 3,
});
assert.equal(Engine.typicalRir(summarizedA.value), 3);
assert.ok(Math.abs(Engine.expectedSetDrop([130, 126.6666666667], []) - 0.025641025640769) < 1e-12);
assert.equal(Engine.expectedSetDrop([100, 10], []), 0.05, "observed drop must cap at 5%");
assert.equal(Engine.expectedSetDrop([100], [0.02, 0.04, 0.03]), 0.03, "historical median is the fallback");

const invalidInputs = [
  ["unknown prescription key", () => Engine.validateRangePrescription({ ...frozenPrescription, familyId: "growth" })],
  ["unsupported strategy", () => Engine.validateRangePrescription({ ...frozenPrescription, strategy: { ...frozenPrescription.strategy, id: "rep_goal" } })],
  ["inverted range", () => Engine.validateRangePrescription({ ...frozenPrescription, strategy: { ...frozenPrescription.strategy, params: { ...frozenPrescription.strategy.params, repMin: 9 } } })],
  ["unknown setting", () => Engine.validateSettings({ ...frozenSettings, entitlement: "pro" })],
  ["non-finite setting", () => Engine.validateSettings({ ...frozenSettings, jumpPercent: Number.NaN })],
  ["unknown history key", () => Engine.normalizeHistory([{ ...frozenHistory[0], programId: "p1" }])],
  ["non-finite history", () => Engine.normalizeHistory([{ ...frozenHistory[0], sets: [{ load: Number.POSITIVE_INFINITY, reps: 6, rir: 1 }] }])],
];
for (const [name, run] of invalidInputs) {
  const result = run();
  assert.equal(result.ok, false, `${name}: must fail`);
  assert.equal(result.code, "invalid-input", `${name}: typed failure required`);
  assert.ok(result.issues.length, `${name}: issue list required`);
}

console.log("PASS: progression primitives are pure, bounded, deterministic, and Node-reachable");
