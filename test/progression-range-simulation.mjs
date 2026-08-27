#!/usr/bin/env node
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Engine = createRequire(import.meta.url)(path.join(root, "progression-engine.js"));

const base = {
  engineVersion: 1,
  prescription: {
    schemaVersion: 1,
    strategy: { id: "range", version: 1, params: { workingSets: 3, repMin: 6, repMax: 8 } },
    modifiers: [],
  },
  relation: null,
  modifiers: [],
  settings: { minLoadIncrement: 2.5, jumpPercent: 2.5, hardRir: 4 },
  currentSession: [],
  context: { weekNumber: 1, blockLength: 6, blockStart: "2026-01-01" },
};

const history = [{
  sessionId: "seed",
  date: "2026-01-01",
  sets: Array.from({ length: 3 }, () => ({ load: 100, reps: 6, rir: 1 })),
}];
let largestResult = 0;
let advances = 0;

for (let week = 1; week <= 52; week++) {
  const input = structuredClone(base);
  input.history = structuredClone(history);
  input.context.weekNumber = (week - 1) % 6 + 1;
  const result = Engine.evaluateProgression(input);
  const repeated = Engine.evaluateProgression(input);
  assert.deepEqual(result, repeated, `week ${week}: repeat run drifted`);
  assert.equal(result.kind, "recommendation", `week ${week}: result kind`);
  assert.equal(result.target.sets.length, 3, `week ${week}: weekly set structure changed`);
  assert.ok(result.target.sets.every((set) => set.role === "working"), `week ${week}: set role changed`);
  assert.ok(!JSON.stringify(result).includes("deload"), `week ${week}: scheduled deload appeared`);
  assert.ok(result.target.sets.every((set) => Number.isFinite(set.load) && Number.isInteger(set.reps)), `week ${week}: non-finite target`);
  if (result.status === "advance") advances++;
  largestResult = Math.max(largestResult, JSON.stringify(result).length);
  history.push({
    sessionId: `week-${week}`,
    date: `2026-${String(1 + Math.floor(week / 28)).padStart(2, "0")}-${String(1 + week % 28).padStart(2, "0")}`,
    sets: result.target.sets.map((set) => ({ load: set.load, reps: set.reps, rir: 1 })),
  });
}

assert.ok(advances > 0, "52-week simulation never advanced load");
assert.ok(largestResult < 5000, `result provenance grew without bound: ${largestResult} bytes`);

const representative = structuredClone(base);
representative.history = history.slice(-12);
for (let index = 0; index < 1000; index++) Engine.evaluateProgression(representative);
const started = performance.now();
for (let index = 0; index < 10000; index++) Engine.evaluateProgression(representative);
const elapsed = performance.now() - started;
assert.ok(elapsed < 2000, `10,000 representative evaluations took ${elapsed.toFixed(1)} ms`);

console.log(`PASS: 52-week range simulation; ${advances} advances; max result ${largestResult} bytes; 10,000 evals ${elapsed.toFixed(1)} ms`);
