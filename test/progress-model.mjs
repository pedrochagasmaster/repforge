#!/usr/bin/env node
// Plan 056 packet 1 — characterization and independent oracles.
// The fixture expectations are computed by hand from the known schedule in
// test/fixtures/progress-evidence-v1.json. The model matrix below runs against
// progress-model.js once 056-P2 lands; until then those sections are recorded
// as planned, never passed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "test/fixtures/progress-evidence-v1.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const modelPath = path.join(root, "progress-model.js");

assert.equal(fixture.kind, "taurifer-progress-evidence-fixtures");
assert.equal(fixture.schemaVersion, 1);

const { program, log, expected } = fixture;
const anchor = fixture.anchorDate;

// --- Section A: independent recomputation of every hand-written denominator.
// These sums are derived here from the raw schedule/log rows, not from the
// fixture's expected block, so a stale expectation fails loudly.

function weekBounds(startISO, weekIndex) {
  const start = new Date(`${startISO}T12:00:00`);
  start.setUTCDate(start.getUTCDate() + (weekIndex - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

for (const [week, bounds] of Object.entries(expected.weekBoundaries)) {
  const n = Number(week.slice(4));
  assert.deepEqual(weekBounds(program.started, n), bounds, `${week} bounds`);
}

const elapsedDays = Math.floor((new Date(`${anchor}T12:00:00`) - new Date(`${program.started}T12:00:00`)) / 86400000);
const elapsedWeek = Math.floor(elapsedDays / 7) + 1;
assert.equal(elapsedWeek, expected.elapsedWeekAtAnchor, "elapsed week at anchor");

function workRows(range) {
  return log.filter((r) => r.work && r.load > 0 && r.reps > 0 &&
    (!range || (r.date >= range.start && r.date <= range.end)));
}
function sessions(rows) {
  return new Set(rows.map((r) => r.session)).size;
}

for (const [week, exp] of Object.entries(expected.completedWeeks)) {
  const n = Number(week.slice(4));
  const rows = workRows(weekBounds(program.started, n));
  assert.equal(sessions(rows), exp.completedSessions, `${week} completed sessions`);
  assert.equal(rows.length, exp.completedWorkingSets, `${week} completed working sets`);
}

const currentBounds = weekBounds(program.started, elapsedWeek);
const currentRows = workRows(currentBounds);
assert.deepEqual(
  { start: currentBounds.start, end: currentBounds.end, completedSessions: sessions(currentRows), completedWorkingSets: currentRows.length },
  { start: expected.currentWeek.start, end: expected.currentWeek.end, completedSessions: expected.currentWeek.completedSessions, completedWorkingSets: expected.currentWeek.completedWorkingSets },
  "current week facts");

const elapsedNumberedWeeks = Math.min(elapsedWeek, program.mesocycleLengthWeeks);
const blockRows = workRows({ start: program.started, end: anchor });
assert.equal(sessions(blockRows), expected.blockToDate.completedSessions, "block-to-date completed sessions");
assert.equal(blockRows.length, expected.blockToDate.completedWorkingSets, "block-to-date completed working sets");
assert.equal(elapsedNumberedWeeks * fixture.canonicalPlan.plannedSessionsPerWeek, expected.blockToDate.plannedSessions, "block-to-date planned sessions");
assert.equal(elapsedNumberedWeeks * fixture.canonicalPlan.plannedWorkingSetsPerWeek, expected.blockToDate.plannedWorkingSets, "block-to-date planned working sets");
assert.ok(elapsedNumberedWeeks <= program.mesocycleLengthWeeks, "block-to-date denominator capped at block length");

function pointsFor(exerciseId, range) {
  const byDate = new Map();
  for (const r of workRows(range)) {
    if (r.exercise !== exerciseId) continue;
    byDate.set(`${r.date}|${r.session}`, r.load);
  }
  return [...byDate.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, load]) => load);
}

const strength = expected.strengthEvidence;
const blockRange = { start: program.started, end: anchor };
const benchAll = pointsFor("bench", { start: "2026-08-01", end: anchor });
assert.deepEqual(pointsFor("bench", blockRange), strength.bench.currentBlock.loads, "bench block points");
assert.equal(pointsFor("bench", blockRange).length, strength.bench.currentBlock.points);
assert.deepEqual(benchAll, strength.bench.allHistory.loads, "bench all-history points");
assert.deepEqual(pointsFor("rdl", blockRange), strength.rdl.currentBlock.loads, "rdl block points");
assert.deepEqual(pointsFor("squat", blockRange), strength.squat.currentBlock.loads, "squat block points");
assert.equal(pointsFor("lateral", blockRange).length, 0, "lateral has no current-block points");

// --- Section B: vocabulary and sparse/period contracts (pure data).

const vocab = expected.vocabulary;
assert.ok(vocab.outcomes.every((o) => !vocab.recommendations.includes(o)) &&
  vocab.recommendations.every((r) => !vocab.outcomes.includes(r)),
  "outcome and recommendation vocabularies are disjoint");
assert.ok(vocab.evidenceStates.includes("insufficient") && vocab.evidenceStates.includes("sufficient"));

const sparse = expected.sparsePolicy;
assert.equal(sparse["0"].presentation, "empty");
assert.equal(sparse["0"].evidenceState, "insufficient");
assert.equal(sparse["1"].presentation, "snapshot");
assert.equal(sparse["1"].evidenceState, "insufficient", "one compatible point is a snapshot, never a trend or an outcome");
assert.equal(sparse["2"].presentation, "comparison");
assert.equal(sparse["2"].evidenceState, "sufficient");
assert.equal(sparse["3"].presentation, "trend");
assert.equal(sparse["3"].evidenceState, "sufficient");

// A fresh program (no log rows) yields no action items and no attention rows;
// zero evidence can never enable a performance transition.
assert.deepEqual(expected.freshProgram.actionItems, []);
assert.equal(expected.freshProgram.attentionRows, 0);
assert.equal(expected.freshProgram.transitionEligible, false);

// Rejection oracles: these candidate labels are invalid under the Plan 056
// contract. Keeping them here records what a model must never return.
const forbiddenLabels = [...vocab.outcomes, ...vocab.recommendations];
assert.ok(!forbiddenLabels.includes("attention"), "fresh-program rows must not be styled as attention outcomes");

// --- Section C: model matrix (planned until 056-P2 provides progress-model.js).

let plannedSections = 0;
if (fs.existsSync(modelPath)) {
  const { default: model } = await import(`${pathToFileURL(modelPath).href}?p=${fs.statSync(modelPath).mtimeMs}`);
  const now = `${anchor}T12:00:00`;
  const weekStatus = model.buildWeekStatus(program, { started: program.started, mesocycleLengthWeeks: program.mesocycleLengthWeeks }, log, now);
  assert.equal(weekStatus.status, "in-progress");
  assert.equal(weekStatus.completedSessions, expected.currentWeek.completedSessions);
  assert.equal(weekStatus.plannedSessions, expected.currentWeek.plannedSessions);
  assert.equal(weekStatus.completedWorkingSets, expected.currentWeek.completedWorkingSets);
  assert.equal(weekStatus.plannedWorkingSets, expected.currentWeek.plannedWorkingSets);
  assert.equal(weekStatus.outcome, undefined, "partial week must not carry a final weekly outcome");

  const freshStatus = model.buildWeekStatus(program, { started: program.started, mesocycleLengthWeeks: program.mesocycleLengthWeeks }, [], now);
  assert.equal(freshStatus.status, "not-started");
  assert.equal(freshStatus.outcome, undefined, "fresh program must not infer an outcome");

  const freshQueue = model.buildProgramActionQueue(program, { started: program.started }, [], {});
  assert.deepEqual(freshQueue, expected.freshProgram.actionItems, "fresh program has no action items");

  const review = model.buildReviewCheckpoint(program, { started: program.started, mesocycleLengthWeeks: program.mesocycleLengthWeeks }, log, now);
  assert.equal(review.lifecycle, "active-block");
  assert.equal(review.structuralActions.length, 0, "active-block checkpoint exposes no structural confirms");

  for (const [exerciseId, exp] of Object.entries(strength)) {
    const series = model.buildStrengthEvidence("current-block", exerciseId, log, { started: program.started });
    assert.equal(series.points.length, exp.currentBlock.points, `${exerciseId} block points`);
    assert.equal(series.presentation, exp.currentBlock.presentation, `${exerciseId} presentation`);
    if (exp.currentBlock.evidenceState) {
      assert.equal(series.evidenceState, exp.currentBlock.evidenceState, `${exerciseId} evidence state`);
      assert.equal(series.reason, exp.currentBlock.reason, `${exerciseId} insufficiency reason`);
      assert.equal(series.outcome, undefined, `${exerciseId} insufficient carries no outcome`);
    }
  }

  const volume = model.buildVolumeEvidence("block-to-date", program, { started: program.started }, log, now);
  assert.equal(volume.completedWorkingSets, expected.blockToDate.completedWorkingSets);
  assert.equal(volume.plannedWorkingSets, expected.blockToDate.plannedWorkingSets);
  assert.equal(volume.period.plannedSessions, expected.blockToDate.plannedSessions);

  const freshVolume = model.buildVolumeEvidence("block-to-date", program, { started: program.started }, [], now);
  assert.equal(freshVolume.completedWorkingSets, 0);
  assert.equal(freshVolume.evidenceState, "insufficient", "zero completed work is insufficient, not zero progress");

  console.log("model matrix: exercised against progress-model.js");
} else {
  plannedSections = 1;
  console.log("planned: model matrix pending 056-P2 (progress-model.js not present)");
}

console.log(`PASS: progress evidence oracles${plannedSections ? " (model matrix planned)" : " incl. model matrix"}`);
