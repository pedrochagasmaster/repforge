#!/usr/bin/env node
// Plan 056 packet 1 — characterization and independent oracles.
// The fixture expectations are computed by hand from the known schedule in
// test/fixtures/progress-evidence-v1.json. The model matrix below runs against
// progress-model.js once 056-P2 lands; until then those sections are recorded
// as planned, never passed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  assert.equal(freshStatus.status, "in-progress", "a started week with zero logs is live, not failing");
  assert.equal(freshStatus.completedSessions, 0);
  assert.equal(freshStatus.outcome, undefined, "fresh program must not infer an outcome");

  const noBlock = model.buildWeekStatus(program, { started: null, mesocycleLengthWeeks: program.mesocycleLengthWeeks }, [], now);
  assert.equal(noBlock.status, "not-started");
  assert.equal(noBlock.outcome, undefined);

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
  assert.equal(volume.period.elapsedNumberedWeeks, expected.blockToDate.elapsedNumberedWeeks);
  assert.equal(volume.periodStatus, "in-progress");

  const thisWeek = model.buildVolumeEvidence("this-week", program, { started: program.started }, log, now);
  assert.equal(thisWeek.completedWorkingSets, expected.currentWeek.completedWorkingSets);
  assert.equal(thisWeek.plannedWorkingSets, expected.currentWeek.plannedWorkingSets);
  assert.equal(thisWeek.period.start, expected.currentWeek.start);
  assert.equal(thisWeek.period.end, expected.currentWeek.end);
  assert.equal(thisWeek.periodStatus, "in-progress", "partial week is in progress, not a decline");

  const freshVolume = model.buildVolumeEvidence("block-to-date", program, { started: program.started }, [], now);
  assert.equal(freshVolume.completedWorkingSets, 0);
  assert.equal(freshVolume.evidenceState, "insufficient", "zero completed work is insufficient, not zero progress");

  const prAll = model.buildPREvidence("all-history", log, { started: program.started })
    .filter((e) => e.exerciseId === "bench");
  assert.deepEqual(prAll.map((e) => e.date), ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"], "bench load PRs across history");
  const prBlock = model.buildPREvidence("current-block", log, { started: program.started })
    .filter((e) => e.exerciseId === "bench");
  assert.deepEqual(prBlock.map((e) => e.date), ["2026-09-07", "2026-09-14"], "bench load PRs inside the block");
  assert.equal(prBlock[0].priorValue, 80, "PR entry carries the prior top value");
  assert.ok(prAll.every((e) => e.kind === "load"));

  const benchAllSeries = model.buildStrengthEvidence("all-history", "bench", log, { started: program.started });
  assert.equal(benchAllSeries.presentation, "trend");
  assert.equal(benchAllSeries.evidenceCount, strength.bench.allHistory.points);

  // Architecture-audit acceptance: deterministic, correction-sensitive,
  // identity-stable, and archive/current-separated.
  const source = fs.readFileSync(modelPath, "utf8");
  for (const forbidden of ["document", "localStorage", "sessionStorage", "XMLHttpRequest", "fetch("]) {
    assert.ok(!source.includes(forbidden), `pure model must not contain ${forbidden}`);
  }

  const metaWith = { started: program.started, mesocycleLengthWeeks: program.mesocycleLengthWeeks };
  const runAll = () => ({
    week: model.buildWeekStatus(program, metaWith, log, now),
    queue: model.buildProgramActionQueue(program, metaWith, log, []),
    review: model.buildReviewCheckpoint(program, metaWith, log, now),
    strength: model.buildStrengthEvidence("current-block", "bench", log, metaWith),
    volume: model.buildVolumeEvidence("block-to-date", program, metaWith, log, now),
    prs: model.buildPREvidence("current-block", log, metaWith),
  });
  assert.deepEqual(runAll(), runAll(), "identical snapshots produce identical results");

  // A same-length correction (one row's load fixed in place) must change the
  // result: no memo may survive on array length or last timestamp.
  const corrected = log.map((r) => r.session === "s-b3" ? { ...r, load: 84 } : r);
  assert.notDeepEqual(
    model.buildStrengthEvidence("current-block", "bench", corrected, metaWith).points,
    model.buildStrengthEvidence("current-block", "bench", log, metaWith).points,
    "same-length correction invalidates the prior projection");

  // A display-name change never moves movement identity: matching is by
  // exercise id, so evidence is unchanged when only the display label differs.
  const renamed = log.map((r) => r.exercise === "bench" ? { ...r, name: "Bench press (renamed)" } : r);
  assert.deepEqual(
    model.buildStrengthEvidence("current-block", "bench", renamed, metaWith),
    model.buildStrengthEvidence("current-block", "bench", log, metaWith),
    "display rename does not change movement identity");

  // Archived (pre-block) evidence never leaks into the current-block scope.
  const blockPoints = model.buildStrengthEvidence("current-block", "bench", log, metaWith).points.map((p) => p.value);
  assert.deepEqual(blockPoints, [80, 82.5, 85], "current-block scope excludes archived pre-block rows");

  console.log("model matrix: exercised against progress-model.js");
} else {
  plannedSections = 1;
  console.log("planned: model matrix pending 056-P2 (progress-model.js not present)");
}

console.log(`PASS: progress evidence oracles${plannedSections ? " (model matrix planned)" : " incl. model matrix"}`);
