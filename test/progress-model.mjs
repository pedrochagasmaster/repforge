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

  const effortGated = model.buildVolumeEvidence("this-week", program,
    { started: program.started, hardRir: 4 },
    [
      { session: "hard", date: "2026-09-14", load: 60, reps: 8, rir: 2, work: true },
      { session: "far", date: "2026-09-14", load: 60, reps: 8, rir: 5, work: true },
      { session: "missing", date: "2026-09-14", load: 60, reps: 8, work: true },
      { session: "warmup", date: "2026-09-14", load: 20, reps: 8, rir: 1, warmup: true, work: true },
    ], now);
  assert.equal(effortGated.completedWorkingSets, 1,
    "volume evidence counts only hard working sets with a qualifying RIR");
  assert.equal(effortGated.completedRows.length, 1,
    "the scoped volume projection exposes the same hard rows used by its total");

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

  const evidenceRecords = [
    { exerciseId: "bench", evidenceState: "sufficient", evidenceCount: 3, outcome: "improved" },
    { exerciseId: "squat", evidenceState: "insufficient", evidenceCount: 1, reason: "single-observation", outcome: "declined" },
  ];
  const scopedRecords = model.normalizeEvidenceRecords(evidenceRecords, { scope: "current-block" });
  assert.equal(scopedRecords[0].scope, "current-block", "the canonical record carries its scope");
  assert.equal(scopedRecords[1].outcome, undefined, "normalization removes outcomes from insufficient records");
  const canonicalMeta = { started: program.started, mesocycleLengthWeeks: program.mesocycleLengthWeeks, evidenceRecords };
  assert.equal(model.buildStrengthEvidence("current-block", "bench", log, canonicalMeta).outcome, "improved",
    "Strength consumes the canonical evidence record");
  assert.equal(model.buildStrengthEvidence("current-block", "squat", log, canonicalMeta).outcome, undefined,
    "an insufficient record cannot carry an outcome into Strength");
  assert.deepEqual(model.buildReviewCheckpoint(program, canonicalMeta, log, now).observedOutcomes,
    [{ exerciseId: "bench", outcome: "improved" }], "Review consumes the same canonical record");
  assert.deepEqual(model.buildProgramActionQueue(program, canonicalMeta, log, evidenceRecords).map((x) => x.destinationId),
    ["bench"], "the action queue excludes insufficient canonical records");
  const allHistoryOnly = [{ exerciseId: "bench", scope: "all-history", evidenceState: "sufficient", evidenceCount: 3, outcome: "improved" }];
  assert.deepEqual(model.buildProgramActionQueue(program, canonicalMeta, log, allHistoryOnly), [],
    "current-block action queue rejects an all-history-only record");
  assert.deepEqual(model.buildReviewCheckpoint(program, { ...canonicalMeta, evidenceRecords: allHistoryOnly }, log, now).observedOutcomes, [],
    "current-block Review rejects an all-history-only record");
  assert.equal(model.buildStrengthEvidence("current-block", "bench", log.map((row) => ({ ...row, capacity: 999 })), {
    started: program.started,
    evidenceRecords: [{ ...scopedRecords[0], scope: "current-block" }],
  }).points.at(-1).value, 85, "Strength points keep load numeric instead of accepting a capacity display value");
  assert.equal(model.buildStrengthEvidence("current-block", "bench", log, {
    started: program.started,
    evidenceRecords: [{ ...scopedRecords[0], scope: "all-history" }],
  }).outcome, undefined, "an all-history record cannot leak into current-block Strength");

  // The canonical record boundary rejects claims that do not carry an
  // authoritative outcome/recommendation pair, and strips action vocabulary
  // from neutral records.
  assert.equal(model.normalizeEvidenceRecord({ exerciseId: "bench", scope: "current-block", evidenceState: "sufficient", evidenceCount: 2 }), null,
    "sufficient evidence without an outcome is not a valid canonical record");
  assert.equal(model.normalizeEvidenceRecord({ exerciseId: "bench", scope: "current-block", evidenceState: "sufficient", evidenceCount: 2, outcome: "improved", recommendation: "review" }), null,
    "a recommendation inconsistent with the authoritative outcome is rejected");
  assert.deepEqual(model.normalizeEvidenceRecord({ exerciseId: "bench", scope: "current-block", evidenceState: "insufficient", evidenceCount: 2, outcome: "improved", recommendation: "progress" }),
    { exerciseId: "bench", scope: "current-block", evidenceState: "insufficient", evidenceCount: 2, reason: "untested" },
    "insufficient evidence is neutral and cannot carry an action outcome");
  assert.deepEqual(model.normalizeEvidenceRecord({ exerciseId: "bench", scope: "current-block", evidenceState: "insufficient", evidenceCount: 2, reason: "missing-effort", outcome: "declined" }),
    { exerciseId: "bench", scope: "current-block", evidenceState: "insufficient", evidenceCount: 2, reason: "missing-effort" },
    "insufficient evidence keeps its failure-to-prove reason without leaking an outcome");

  // Provenance, not date alone, owns current-block scope. Chronology remains
  // deterministic for two sessions recorded on the same day.
  const provenanceRows = [
    { exerciseId: "bench", session: "old", date: "2026-09-10", created: "2026-09-10T08:00:00.000Z", blockId: "old-block", load: 200, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "early", date: "2026-09-10", created: "2026-09-10T09:00:00.000Z", blockId: "current-block", load: 100, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "late", date: "2026-09-10", created: "2026-09-10T18:00:00.000Z", blockId: "current-block", load: 105, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "legacy", date: "2026-09-11", created: "2026-09-11T08:00:00.000Z", load: 300, reps: 8, rir: 2, work: true },
  ];
  const provenanceMeta = { started: "2026-09-01", mesocycleLengthWeeks: 2, blockId: "current-block" };
  const scoped = model.buildStrengthEvidence("current-block", "bench", provenanceRows, provenanceMeta);
  assert.deepEqual(scoped.points.map((point) => point.value), [100, 105],
    "current-block strength excludes foreign and legacy rows even on overlapping dates");
  assert.deepEqual(scoped.points.map((point) => point.created), ["2026-09-10T09:00:00.000Z", "2026-09-10T18:00:00.000Z"],
    "same-day strength points use creation chronology");
  const allHistory = model.buildStrengthEvidence("all-history", "bench", provenanceRows, provenanceMeta);
  assert.deepEqual(allHistory.points.map((point) => point.value), [200, 100, 105, 300],
    "all-history explicitly retains foreign and legacy rows");

  // Chronology is date-first. A missing creation timestamp is not an earlier
  // event than a dated row merely because String(null) sorts first.
  const mixedTimestampRows = [
    { exerciseId: "bench", session: "newer-date-no-created", date: "2026-09-16", load: 105, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "older-date-created", date: "2026-09-15", created: "2026-09-15T18:00:00.000Z", load: 100, reps: 8, rir: 2, work: true },
  ];
  const mixedStrength = model.buildStrengthEvidence("all-history", "bench", mixedTimestampRows, {});
  assert.deepEqual(mixedStrength.points.map((point) => point.value), [100, 105],
    "strength chronology orders by workout date before optional creation time");
  assert.equal(mixedStrength.latest.session, "newer-date-no-created",
    "latest strength value follows the latest workout date when created is absent");
  assert.deepEqual(mixedStrength.comparison, { from: 100, to: 105, absolute: 5, percentage: 5 },
    "latest/previous comparison uses the same mixed-timestamp chronology");
  const mixedPrs = model.buildPREvidence("all-history", mixedTimestampRows, {});
  assert.deepEqual(mixedPrs.map((entry) => ({ date: entry.date, value: entry.value, priorValue: entry.priorValue })),
    [{ date: "2026-09-16", value: 105, priorValue: 100 }],
    "PR chronology uses the same date-first ordering as Strength");

  const chronologyRows = [
    { exerciseId: "bench", session: "z-no-created", date: "2026-09-17", load: 120, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "a-created", date: "2026-09-17", created: "2026-09-17T10:00:00.000Z", load: 115, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "z-created", date: "2026-09-18", created: "2026-09-18T10:00:00.000Z", load: 125, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "a-no-created", date: "2026-09-18", load: 122.5, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "b-tied", date: "2026-09-19", created: "2026-09-19T10:00:00.000Z", load: 130, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "a-tied", date: "2026-09-19", created: "2026-09-19T10:00:00.000Z", load: 127.5, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "b-no-created", date: "2026-09-20", load: 135, reps: 8, rir: 2, work: true },
    { exerciseId: "bench", session: "a-no-created-later", date: "2026-09-20", load: 132.5, reps: 8, rir: 2, work: true },
  ];
  const chronology = model.buildStrengthEvidence("all-history", "bench", chronologyRows, {});
  assert.deepEqual(chronology.points.map((point) => point.session), [
    "a-created", "z-no-created", "a-no-created", "z-created", "a-tied", "b-tied",
    "a-no-created-later", "b-no-created",
  ], "same-day chronology uses both timestamps when present and stable identities otherwise");
  const legacyOnly = [{ exerciseId: "rdl", session: "legacy", date: "2026-09-10", load: 80, reps: 8, rir: 2, work: true }];
  assert.equal(model.buildStrengthEvidence("current-block", "rdl", legacyOnly, provenanceMeta).evidenceCount, 0,
    "legacy rows without block provenance do not silently enter a modern current block");
  assert.equal(model.buildStrengthEvidence("all-history", "rdl", legacyOnly, provenanceMeta).evidenceCount, 1,
    "legacy rows remain available in explicit all-history mode");
  const scopedVolume = model.buildVolumeEvidence("this-week", program, {
    ...provenanceMeta, hardRir: 4, weekPrescriptions: [{ plannedSessions: 1, plannedWorkingSets: 2 }],
  }, provenanceRows, "2026-09-10T12:00:00");
  assert.equal(scopedVolume.completedWorkingSets, 2,
    "volume uses the same current-block provenance boundary as Strength");

  const rdlComparison = model.buildStrengthEvidence("current-block", "rdl", log, { started: program.started });
  assert.equal(rdlComparison.presentation, "comparison");
  assert.equal(rdlComparison.evidenceState, "insufficient",
    "a point count alone cannot promote Strength without an authoritative comparable outcome");
  assert.equal(rdlComparison.comparison.absolute, 2.5, "two-point comparison keeps an absolute numeric delta");
  assert.ok(Math.abs(rdlComparison.comparison.percentage - 2.5) < 0.000001,
    "two-point comparison keeps the percentage delta");

  const prescribed = model.buildVolumeEvidence("block-to-date", program, {
    started: program.started,
    mesocycleLengthWeeks: program.mesocycleLengthWeeks,
    weekPrescriptions: [
      { plannedSessions: 3, plannedWorkingSets: 6 },
      { plannedSessions: 3, plannedWorkingSets: 12 },
      { plannedSessions: 3, plannedWorkingSets: 12 },
    ],
  }, log, "2026-09-16T12:00:00");
  assert.equal(prescribed.plannedWorkingSets, 30,
    "block-to-date preserves the recovery-week prescription after the overlay is inactive");

  const compactHistory = model.buildVolumeEvidence("block-to-date", program, {
    started: program.started,
    mesocycleLengthWeeks: program.mesocycleLengthWeeks,
    plannedVolumeHistory: {
      schemaVersion: 1,
      throughWeek: 2,
      plannedSessions: 6,
      plannedWorkingSets: 18,
      muscles: { direct: { Chest: 12 }, secondary: { Triceps: 3 } },
    },
    weekPrescriptions: [
      { week: 3, plannedSessions: 3, plannedWorkingSets: 12 },
    ],
  }, log, "2026-09-16T12:00:00");
  assert.equal(compactHistory.plannedWorkingSets, 30,
    "the model consumes the compact historical aggregate once and adds only uncovered weeks");
  assert.equal(compactHistory.period.plannedSessions, 9,
    "the model preserves aggregate sessions while projecting the current week");

  const completedBlock = model.buildVolumeEvidence("block-to-date", program, {
    started: program.started,
    mesocycleLengthWeeks: program.mesocycleLengthWeeks,
    weekPrescriptions: Array.from({ length: 4 }, () => ({ plannedSessions: 3, plannedWorkingSets: 11 })),
  }, [...log, { session: "after-block", date: "2026-10-01", exercise: "bench", load: 100, reps: 8, work: true }], "2026-10-02T12:00:00");
  assert.equal(completedBlock.periodStatus, "complete", "completed block volume is a closed period");
  assert.equal(completedBlock.period.end, "2026-09-27", "completed block ends at its durable block boundary");
  assert.equal(completedBlock.plannedWorkingSets, 44, "completed block sums every numbered prescription once");
  assert.equal(completedBlock.completedWorkingSets, expected.blockToDate.completedWorkingSets,
    "completed block excludes post-block work from its historical denominator");

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

  const afterBlock = [...log, { session: "s-after", date: "2026-09-28", exercise: "bench", load: 90, reps: 8, work: true }];
  assert.deepEqual(
    model.buildStrengthEvidence("current-block", "bench", afterBlock, metaWith).points.map((p) => p.value),
    [80, 82.5, 85],
    "current-block scope also excludes rows after the durable block end"
  );
  assert.equal(
    model.buildStrengthEvidence("all-history", "bench", afterBlock, metaWith).points.at(-1).value,
    90,
    "all-history scope retains post-block rows explicitly"
  );

  console.log("model matrix: exercised against progress-model.js");
} else {
  plannedSections = 1;
  console.log("planned: model matrix pending 056-P2 (progress-model.js not present)");
}

console.log(`PASS: progress evidence oracles${plannedSections ? " (model matrix planned)" : " incl. model matrix"}`);
