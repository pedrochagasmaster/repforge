#!/usr/bin/env node
// A03 — numbered-day arithmetic must be calendar-day exact across DST.
// The zone is pinned before any Date is constructed, so the model runs in a
// real non-UTC zone. Spring DST (2026-03-08) makes a local-noon span of
// 2026-03-02 -> 2026-03-09 only 167 hours; fall DST (2026-11-01) makes a
// span across it 169 hours. Neither may change the numbered day count.
process.env.TZ = "America/New_York";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/progress-evidence-v1.json"), "utf8"));
const { default: model } = await import(pathToFileURL(path.join(root, "progress-model.js")).href);
const { program } = fixture;
const perWeek = fixture.canonicalPlan;

// Guard: the zone really is New York and really has the short/long day.
const noon = (iso) => new Date(`${iso}T12:00:00`);
assert.equal((noon("2026-03-09") - noon("2026-03-02")) / 3600000, 167, "spring span is 167 local hours");
assert.equal((noon("2026-11-02") - noon("2026-10-26")) / 3600000, 169, "fall span is 169 local hours");

const row = (session, date) => ({ session, date, day: "d1", exercise: "bench", load: 50, reps: 8, rir: 2, set: 1, work: true });
const meta = (started, weeks) => ({ started, mesocycleLengthWeeks: weeks });
const week = (started, weeks, now, log = []) => model.buildWeekStatus(program, meta(started, weeks), log, now);
const review = (started, weeks, now) => model.buildReviewCheckpoint(program, meta(started, weeks), [], now);
const vol = (scope, started, weeks, now, log = []) => model.buildVolumeEvidence(scope, program, meta(started, weeks), log, now);

// Spring DST: block starts Monday 2026-03-02, today is 2026-03-09.
{
  const log = [row("s1", "2026-03-02"), row("s2", "2026-03-09")];
  const now = "2026-03-09";
  const ws = week("2026-03-02", 4, now, log);
  assert.equal(ws.week, 2, "buildWeekStatus numbers 2026-03-09 as week 2");
  assert.equal(ws.start, "2026-03-09");
  assert.equal(ws.end, "2026-03-15");
  assert.equal(ws.completedSessions, 1, "the March 9 session belongs to the current week");

  assert.equal(review("2026-03-02", 4, now).elapsedWeek, 2, "Review elapsedWeek (elapsedWeekOf) is 2");

  const thisWeek = vol("this-week", "2026-03-02", 4, now, log);
  assert.equal(thisWeek.period.weekNumber, 2);
  assert.equal(thisWeek.start, "2026-03-09");
  assert.equal(thisWeek.end, "2026-03-15");
  assert.deepEqual(thisWeek.completedRows.map((r) => r.session), ["s2"], "March 9 session is included");

  const block = vol("block-to-date", "2026-03-02", 4, now, log);
  assert.equal(block.period.elapsedNumberedWeeks, 2);
  assert.equal(block.plannedSessions, 2 * perWeek.plannedSessionsPerWeek);
  assert.equal(block.plannedWorkingSets, 2 * perWeek.plannedWorkingSetsPerWeek);
  assert.equal(block.completedSessions, 2);

  // The last numbered day before DST is still week 1.
  const before = week("2026-03-02", 4, "2026-03-08", log);
  assert.equal(before.week, 1);
  assert.equal(before.end, "2026-03-08");
  assert.equal(vol("block-to-date", "2026-03-02", 4, "2026-03-08", log).period.elapsedNumberedWeeks, 1);

  // Completion boundary: a one-week block is complete on its exact day 8.
  assert.equal(review("2026-03-02", 1, "2026-03-08").lifecycle, "active-block");
  assert.equal(review("2026-03-02", 1, "2026-03-09").lifecycle, "block-complete", "exact block-complete day across spring DST");
  assert.equal(week("2026-03-02", 1, "2026-03-09", log).status, "complete");
  assert.equal(vol("this-week", "2026-03-02", 1, "2026-03-09", log).periodStatus, "complete");
  assert.equal(vol("block-to-date", "2026-03-02", 1, "2026-03-09", log).periodStatus, "complete");
  // Two-week block crossing DST: complete on 2026-03-16, active on 03-15.
  assert.equal(review("2026-03-02", 2, "2026-03-15").lifecycle, "active-block");
  assert.equal(review("2026-03-02", 2, "2026-03-16").lifecycle, "block-complete");
  // Before the block starts, across DST.
  assert.equal(vol("block-to-date", "2026-03-09", 4, "2026-03-08", log).periodStatus, "not-started");
}

// Fall DST control: 2026-11-01 repeats an hour; spans across it become 169
// hours (2026-10-26 -> 2026-11-02). 2026-11-02 -> 2026-11-09 is an ordinary
// 168-hour span right after the change.
{
  const log = [row("f1", "2026-11-02"), row("f2", "2026-11-09")];
  const ws = week("2026-11-02", 4, "2026-11-09", log);
  assert.equal(ws.week, 2);
  assert.equal(ws.start, "2026-11-09");
  assert.equal(ws.end, "2026-11-15");
  assert.equal(vol("this-week", "2026-11-02", 4, "2026-11-09", log).completedRows.map((r) => r.session).join(), "f2");
  assert.equal(vol("block-to-date", "2026-11-02", 4, "2026-11-09", log).period.elapsedNumberedWeeks, 2);
  assert.equal(week("2026-11-02", 4, "2026-11-08", log).week, 1);
  // Block starting before fall DST: one-week block from 2026-10-26 completes 2026-11-02.
  assert.equal(review("2026-10-26", 1, "2026-11-01").lifecycle, "active-block");
  assert.equal(review("2026-10-26", 1, "2026-11-02").lifecycle, "block-complete");
  const across = week("2026-10-26", 4, "2026-11-02", log);
  assert.equal(across.week, 2);
  assert.equal(across.start, "2026-11-02");
  assert.equal(across.end, "2026-11-08");
  assert.equal(vol("block-to-date", "2026-10-26", 4, "2026-11-02", log).period.elapsedNumberedWeeks, 2);
  assert.equal(week("2026-10-26", 4, "2026-11-01", log).week, 1);
}

// Ordinary non-DST controls keep their results.
{
  const log = [row("n1", "2026-09-14"), row("n2", "2026-09-21")];
  assert.equal(week("2026-09-14", 4, "2026-09-20", log).week, 1);
  assert.equal(week("2026-09-14", 4, "2026-09-21", log).week, 2);
  assert.equal(week("2026-09-14", 4, "2026-09-21", log).start, "2026-09-21");
  assert.equal(vol("block-to-date", "2026-09-14", 4, "2026-09-21", log).period.elapsedNumberedWeeks, 2);
  assert.equal(vol("block-to-date", "2026-09-14", 4, "2026-09-21", log).plannedWorkingSets, 2 * perWeek.plannedWorkingSetsPerWeek);
  assert.equal(review("2026-09-14", 1, "2026-09-20").lifecycle, "active-block");
  assert.equal(review("2026-09-14", 1, "2026-09-21").lifecycle, "block-complete");
  assert.equal(review("2026-09-14", 4, "2026-09-21").elapsedWeek, 2);
  assert.equal(review("2026-09-14", 4, "2027-01-01").elapsedWeek, 4, "elapsed week still clamps to block length");
  assert.equal(review("2026-09-14", 4, "2026-09-01").elapsedWeek, 1, "before-block still clamps to week 1");
}

console.log("PASS: progress model calendar-day arithmetic across DST (America/New_York)");
