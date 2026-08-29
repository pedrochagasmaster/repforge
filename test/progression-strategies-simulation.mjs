#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Engine = createRequire(import.meta.url)(path.join(root, "progression-engine.js"));
const SEED = 460913;
const GRID = 2.5;

const prescriptions = {
  rep_goal: {
    schemaVersion: 1,
    strategy: { id: "rep_goal", version: 1, params: {
      workingSets: 3, repGoal: 30, repFloor: 6, repCeiling: 12,
      targetRirMin: 1, targetRirMax: 3, minLoadIncrement: GRID,
      jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
    } },
    modifiers: [],
  },
  effort_target: {
    schemaVersion: 1,
    strategy: { id: "effort_target", version: 1, params: {
      workingSets: 2, targetReps: 5, targetRirMin: 2, targetRirMax: 3,
      minLoadIncrement: GRID,
    } },
    modifiers: [],
  },
  anchor_backoff: {
    schemaVersion: 1,
    strategy: { id: "anchor_backoff", version: 1, params: {
      anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 1, anchorTargetRirMax: 3,
      backoffSets: 3, backoffRepMin: 6, backoffRepMax: 10,
      backoffPercent: 0.8, minLoadIncrement: GRID, jumpPercent: 2.5,
    } },
    modifiers: [],
  },
  manual: { schemaVersion: 1, strategy: { id: "manual", version: 1, params: {} }, modifiers: [] },
};

const settings = { minLoadIncrement: GRID, jumpPercent: 2.5, hardRir: 4 };
const dateFor = (week) => `2026-${String(1 + Math.floor(week / 28)).padStart(2, "0")}-${String(1 + week % 28).padStart(2, "0")}`;
const session = (id, week, sets) => ({ sessionId: id, date: dateFor(week), sets });
const performed = (sets) => sets.map((set) => ({ role: set.role, load: set.load, reps: set.reps, rir: 2 }));
const baseInput = (prescription, history, currentSession = []) => ({
  engineVersion: 1, prescription, relation: null, modifiers: [], settings,
  history, currentSession,
  context: { weekNumber: 1, blockLength: 6, blockStart: "2026-01-01" },
});

function assertSafeResult(name, input, result, expectedSets) {
  assert.equal(result.strategy.id, name, `${name}: no silent range fallback`);
  assert.ok(!JSON.stringify(result).toLowerCase().includes("deload"), `${name}: no scheduled deload`);
  assert.equal(result.target.sets.length, expectedSets, `${name}: authored set count`);
  for (const target of result.target.sets) {
    assert.ok(target.load === null || Number.isFinite(target.load), `${name}: finite load`);
    assert.ok(target.reps === null || Number.isInteger(target.reps), `${name}: integer reps`);
    if (target.load != null) assert.equal(Engine.roundToGrid(target.load, GRID), target.load, `${name}: actionable grid`);
  }
  assert.deepEqual(Engine.evaluateProgression(input), result, `${name}: deterministic replay`);
}

function simulate(name, initialSets, expectedSets) {
  const history = [session(`${name}-seed-${SEED}`, 0, initialSets)];
  let maximumPermitted = Math.max(...initialSets.map((set) => set.load));
  let advances = 0;
  for (let week = 1; week <= 52; week++) {
    const input = baseInput(prescriptions[name], structuredClone(history));
    input.context.weekNumber = (week - 1) % 6 + 1;
    const before = structuredClone(input);
    const result = Engine.evaluateProgression(input);
    assert.deepEqual(input, before, `${name} week ${week}: evaluation mutated committed evidence`);
    assertSafeResult(name, input, result, expectedSets);
    if (name === "rep_goal") {
      const p = prescriptions.rep_goal.strategy.params;
      assert.ok(result.target.sets.every((set) => set.reps >= p.repFloor && set.reps <= p.repCeiling), `rep_goal week ${week}: impossible distribution`);
      assert.ok(result.target.sets.reduce((sum, set) => sum + set.reps, 0) <= p.repGoal, `rep_goal week ${week}: distribution exceeds goal`);
    }
    if (name === "anchor_backoff") {
      assert.equal(result.target.sets[0].role, "anchor", `anchor week ${week}: first role`);
      assert.ok(result.target.sets.slice(1).every((set) => set.role === "backoff" && set.load <= result.target.sets[0].load), `anchor week ${week}: valid lighter sets`);
    }
    if (name === "effort_target") {
      const p = prescriptions.effort_target.strategy.params;
      assert.ok(result.target.sets.every((set) => set.reps === p.targetReps
        && set.targetRirMin === p.targetRirMin && set.targetRirMax === p.targetRirMax),
      `effort_target week ${week}: authored targets drifted`);
    }
    if (result.status === "advance") advances++;
    maximumPermitted = Engine.roundToGrid(maximumPermitted + Math.max(maximumPermitted * 0.025, GRID), GRID);
    assert.ok(result.target.sets.every((set) => set.load == null || set.load <= maximumPermitted), `${name} week ${week}: runaway load`);
    const nextSets = performed(result.target.sets);
    if (name === "effort_target") nextSets.forEach((set) => { set.rir = 4; });
    history.push(session(`${name}-${SEED}-${week}`, week, nextSets));
  }
  assert.ok(advances > 0, `${name}: never advances in a completed 52-week target journey`);
  return { history, advances };
}

const rep = simulate("rep_goal", Array.from({ length: 3 }, () => ({ role: "working", load: 100, reps: 10, rir: 2 })), 3);
const effort = simulate("effort_target", Array.from({ length: 2 }, () => ({ role: "working", load: 100, reps: 5, rir: 4 })), 2);
const anchor = simulate("anchor_backoff", [
  { role: "anchor", load: 100, reps: 5, rir: 2 },
  ...Array.from({ length: 3 }, () => ({ role: "backoff", load: 80, reps: 8, rir: 2 })),
], 4);

for (let week = 1; week <= 52; week++) {
  const input = baseInput(prescriptions.manual, [session(`manual-${SEED}-${week}`, week, [{ load: 100, reps: 8, rir: null }])]);
  const result = Engine.evaluateProgression(input);
  assert.equal(result.kind, "manual", `manual week ${week}: result kind`);
  assert.equal(result.status, "manual", `manual week ${week}: status`);
  assertSafeResult("manual", input, result, 0);
}

const fixedRep = baseInput(prescriptions.rep_goal, rep.history.slice(-3));
const beforeOtherSlot = Engine.evaluateProgression(fixedRep);
Engine.evaluateProgression(baseInput(prescriptions.anchor_backoff, anchor.history.slice(-3)));
assert.deepEqual(Engine.evaluateProgression(fixedRep), beforeOtherSlot, "one slot's history cannot contaminate another slot");

const pairRelation = {
  schemaVersion: 1, id: "paired-simulation", type: "paired_exposure", version: 1,
  movementId: "barbell-bench", members: [
    { exerciseId: "heavy", role: "heavy" }, { exerciseId: "volume", role: "volume" },
  ],
};
function paired(input, selfRole, counterpartStrategy, counterpartStatus) {
  return Engine.evaluateProgression({ ...input, relation: {
    ...pairRelation, selfRole,
    counterpart: { strategy: counterpartStrategy, sessionsInWindow: 3, mostRecentExpectedExposureCompleted: true, status: counterpartStatus },
  } });
}
for (let week = 0; week < 52; week++) {
  const heavyInput = baseInput(prescriptions.anchor_backoff, anchor.history.slice(Math.max(0, week), week + 4));
  const volumeInput = baseInput(prescriptions.rep_goal, rep.history.slice(Math.max(0, week), week + 3));
  const heavyIndependent = Engine.evaluateProgression(heavyInput);
  const volumeIndependent = Engine.evaluateProgression(volumeInput);
  const heavyPaired = paired(heavyInput, "heavy", "rep_goal@1", volumeIndependent.status);
  const volumePaired = paired(volumeInput, "volume", "anchor_backoff@1", heavyIndependent.status);
  assert.ok((heavyPaired.target.sets[0]?.load ?? 0) <= (heavyIndependent.target.sets[0]?.load ?? 0), `paired week ${week + 1}: heavy became more aggressive`);
  assert.ok((volumePaired.target.sets[0]?.load ?? 0) <= (volumeIndependent.target.sets[0]?.load ?? 0), `paired week ${week + 1}: volume became more aggressive`);
  assert.equal(heavyPaired.strategy.id, "anchor_backoff", `paired week ${week + 1}: heavy strategy changed`);
  assert.equal(volumePaired.strategy.id, "rep_goal", `paired week ${week + 1}: volume strategy changed`);
}

const offGrid = baseInput(prescriptions.rep_goal, [session("off-grid", 0,
  Array.from({ length: 3 }, () => ({ role: "working", load: 101, reps: 10, rir: 2 })))]);
const snapped = Engine.evaluateProgression(offGrid);
assert.ok(snapped.target.sets.every((set) => Engine.roundToGrid(set.load, GRID) === set.load), "off-grid evidence produces deterministic on-grid targets");

console.log(`PASS: seed ${SEED}; 52-week rep_goal (${rep.advances} advances), effort_target (${effort.advances}), anchor_backoff (${anchor.advances}), manual, paired temper, grid, purity, and slot isolation`);
