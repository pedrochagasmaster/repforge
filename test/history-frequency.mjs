#!/usr/bin/env node
/**
 * History's pure helpers (Plan 064 R3j, Direction D spec 4.7 and 4.8): the
 * frequency counts and the week grouping read the saved log and the block
 * bounds and nothing else. No browser, no stored state.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("../history-ui.js");
const { frequency, weekGroups } = globalThis.RepForgeHistoryUi;
assert.equal(typeof frequency, "function", "RepForgeHistoryUi exposes the frequency helper");
assert.equal(typeof weekGroups, "function", "RepForgeHistoryUi exposes the week grouping helper");

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
const s = (id, date) => ({ session: id, date });

// Block of 6 weeks from Monday 2026-08-10; "today" is Monday 2026-08-31, week 4.
const block = { started: "2026-08-10", weeks: 6, planned: 3, today: "2026-08-31" };
const log = [
  s("a", "2026-08-10"), s("b", "2026-08-12"), s("c", "2026-08-14"), // week 1: Mon, Wed, Fri
  s("d", "2026-08-17"), s("e", "2026-08-19"), s("f", "2026-08-21"), // week 2
  s("g", "2026-08-24"), s("h", "2026-08-26"), // week 3
  s("i", "2026-08-31"), // week 4
];

check("no block means no counts", () => {
  assert.equal(frequency({ sessions: log, started: null, weeks: 6, planned: 3, today: "2026-08-31" }), null);
  assert.equal(frequency({ sessions: log, started: "2026-08-10", weeks: 0, planned: 3, today: "2026-08-31" }), null);
  assert.equal(frequency({ sessions: log, started: "2026-08-10", weeks: 6, planned: 0, today: "2026-08-31" }), null);
  assert.equal(frequency({ sessions: log, started: "not a date", weeks: 6, planned: 3, today: "2026-08-31" }), null);
  assert.equal(frequency(), null);
});

check("sessions per week, with weeks not yet reached marked", () => {
  const f = frequency({ sessions: log, ...block });
  assert.deepEqual(f.weeks.map((w) => w.count), [3, 3, 2, 1, 0, 0]);
  assert.deepEqual(f.weeks.map((w) => w.reached), [true, true, true, true, false, false]);
  assert.deepEqual(f.weeks.map((w) => w.current), [false, false, false, true, false, false]);
  assert.equal(f.now, 4);
  assert.equal(f.total, 6);
});

check("sessions by weekday, Monday first", () => {
  const f = frequency({ sessions: log, ...block });
  // Mon 10, 17, 24, 31 = 4; Wed 12, 19, 26 = 3; Fri 14, 21 = 2.
  assert.deepEqual(f.weekdays.map((d) => d.count), [4, 0, 3, 0, 2, 0, 0]);
  assert.deepEqual(f.weekdays.map((d) => d.index), [0, 1, 2, 3, 4, 5, 6]);
});

check("the total and the planned total match the label", () => {
  const f = frequency({ sessions: log, ...block });
  assert.equal(f.done, 9);
  assert.equal(f.plannedTotal, 18);
  assert.equal(f.planned, 3);
});

check("bars are scaled so a heavy week stays inside the plot", () => {
  const f = frequency({ sessions: log, ...block });
  assert.equal(f.weekScale, 3, "the plan line is the top when no week passes it");
  assert.equal(f.weekdayScale, 4, "one bar per week at most, unless a weekday has more");
  const heavy = frequency({ sessions: [...log, s("x", "2026-08-11"), s("y", "2026-08-13"), s("z", "2026-08-15")], ...block });
  assert.equal(heavy.weeks[0].count, 6);
  assert.equal(heavy.weekScale, 6);
});

check("a session counts once, whatever the rows say", () => {
  const f = frequency({ sessions: [...log, s("a", "2026-08-10")], ...block });
  assert.equal(f.done, 9);
});

check("sessions outside the reached weeks are not counted", () => {
  const f = frequency({ sessions: [...log, s("early", "2026-08-09"), s("future", "2026-09-07"), s("after", "2026-09-30")], ...block });
  assert.equal(f.done, 9);
  assert.deepEqual(f.weeks.map((w) => w.count), [3, 3, 2, 1, 0, 0]);
});

check("no intensity, streak or missed-day field exists", () => {
  const f = frequency({ sessions: log, ...block });
  assert.deepEqual(Object.keys(f).sort(), ["done", "now", "planned", "plannedTotal", "total", "weekScale", "weekdayScale", "weekdays", "weeks"]);
  assert.deepEqual(Object.keys(f.weeks[0]).sort(), ["count", "current", "reached", "week"]);
  assert.deepEqual(Object.keys(f.weekdays[0]).sort(), ["count", "index"]);
});

check("a block past its length stays on its last week", () => {
  const f = frequency({ sessions: log, ...block, today: "2026-10-30" });
  assert.equal(f.now, 6);
  assert.equal(f.weeks.every((w) => w.reached), true);
  assert.deepEqual(f.weeks.map((w) => w.current), [false, false, false, false, false, true]);
});

check("a block that starts later reads as week 1", () => {
  const f = frequency({ sessions: [], ...block, today: "2026-08-01" });
  assert.equal(f.now, 1);
  assert.equal(f.done, 0);
});

check("a daylight-saving change does not move a session across a week", () => {
  // 2026-03-29 is a DST Sunday in Europe; UTC day arithmetic ignores it.
  const f = frequency({ sessions: [s("sun", "2026-03-29"), s("mon", "2026-03-30")], started: "2026-03-23", weeks: 4, planned: 3, today: "2026-03-30" });
  assert.deepEqual(f.weeks.map((w) => w.count), [1, 1, 0, 0]);
  assert.deepEqual(f.weekdays.map((d) => d.count), [1, 0, 0, 0, 0, 0, 1]);
});

// ---- week grouping ----
const newestFirst = (rows) => [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
const current = { key: "current", kind: "current", name: "Now", start: "2026-08-10", end: null, planned: 3 };

check("sessions group under numbered block weeks, newest first", () => {
  const groups = weekGroups({ sessions: newestFirst(log), blocks: [current] });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].kind, "current");
  assert.deepEqual(groups[0].weeks.map((w) => [w.week, w.done, w.planned, w.sessions.length]), [[4, 1, 3, 1], [3, 2, 3, 2], [2, 3, 3, 3], [1, 3, 3, 3]]);
  assert.deepEqual(groups[0].weeks[1].sessions.map((x) => x.session), ["h", "g"]);
});

check("a search narrows the rows but not the week tally", () => {
  const all = newestFirst(log);
  const shown = all.filter((x) => x.session === "e");
  const groups = weekGroups({ sessions: all, shown, blocks: [current] });
  assert.equal(groups[0].weeks.length, 1);
  assert.equal(groups[0].weeks[0].week, 2);
  assert.equal(groups[0].weeks[0].done, 3);
  assert.equal(groups[0].weeks[0].sessions.length, 1);
});

check("earlier blocks sit under their own name", () => {
  const archived = { key: "archive:0", kind: "archived", name: "Spring", start: "2026-06-01", end: "2026-07-12", planned: 4 };
  const rows = newestFirst([...log, s("p1", "2026-06-01"), s("p2", "2026-06-09"), s("p3", "2026-06-12")]);
  const groups = weekGroups({ sessions: rows, blocks: [current, archived] });
  assert.deepEqual(groups.map((g) => [g.kind, g.name]), [["current", "Now"], ["archived", "Spring"]]);
  assert.deepEqual(groups[1].weeks.map((w) => [w.week, w.done, w.planned]), [[2, 2, 4], [1, 1, 4]]);
});

check("sessions outside every block fall into calendar weeks, Monday first", () => {
  const rows = newestFirst([...log, s("o1", "2026-07-26"), s("o2", "2026-07-20"), s("o3", "2026-07-19")]);
  const groups = weekGroups({ sessions: rows, blocks: [current] });
  const open = groups.find((g) => g.kind === "open");
  assert.ok(open, "an open group exists");
  assert.deepEqual(open.weeks.map((w) => [w.week, w.monday, w.done, w.sessions.length]),
    [[null, "2026-07-20", 2, 2], [null, "2026-07-13", 1, 1]]);
});

check("a block with no planned days is not a block", () => {
  const groups = weekGroups({ sessions: newestFirst(log), blocks: [{ ...current, planned: 0 }] });
  assert.equal(groups.every((g) => g.kind === "open"), true);
  assert.equal(groups[0].weeks[0].week, null);
});

check("an empty log has no groups", () => {
  assert.deepEqual(weekGroups({ sessions: [], blocks: [current] }), []);
  assert.deepEqual(weekGroups(), []);
});

console.log(`\nhistory-frequency: ${passed} passed, 0 failed`);
