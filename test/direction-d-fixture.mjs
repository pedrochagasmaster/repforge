#!/usr/bin/env node
/**
 * Direction D catalog fixture: `directionDState()` must make the engine produce
 * the targets the Direction D review page draws (Plan 063 P3b, Direction D
 * spec section 11). Pure Node: no browser, no server, no network, and it never
 * reads the review page. The review page is prototype code that stays out of
 * `main`; its targets are listed below as constants with their source lines at
 * the pinned commit, and the fixture is the committed output of
 * `tools/generate-direction-d-fixture.mjs`.
 *
 * Source: pedrochagasmaster/repforge 2f2fc04455def511f57fd22331943735625ef988,
 * docs/design/main-screen-directions/data.js and data-d.js. Review dates are
 * shifted by -21 days in the fixture, so the review page's "today" (Monday
 * 21 Sep 2026) is the pinned capture clock (Monday 31 Aug 2026).
 *
 * The engine input is built the way app.js builds it (progressionInput and
 * progressionHistory): the slot's own progression envelope, every logged work
 * row of the lift matched by performedLibraryId, load > 0, and no set roles.
 * If a target here differs from the engine's, the conversion is wrong.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as fixtures from "../tools/ui-screens/fixtures.mjs";
import { DIRECTION_D_SOURCE } from "../tools/ui-screens/direction-d-fixture.generated.mjs";
import { OUTPUT, SHIFT_DAYS, SOURCE_DIR, SOURCE_FILES, SOURCE_SHA } from "../tools/generate-direction-d-fixture.mjs";
import { CAPTURE_NOW } from "../tools/ui-screens/session.mjs";

const require = createRequire(import.meta.url);
const Engine = require("../progression-engine.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

assert.equal(typeof fixtures.directionDState, "function", "tools/ui-screens/fixtures.mjs must export directionDState()");
assert.equal(typeof fixtures.catalogState, "function", "catalogState() stays for non-D states");

// The committed output names the commit and shift its generator pins.
assert.equal(OUTPUT, "tools/ui-screens/direction-d-fixture.generated.mjs");
assert.equal(SOURCE_SHA, "2f2fc04455def511f57fd22331943735625ef988");
assert.equal(DIRECTION_D_SOURCE.commit, SOURCE_SHA, "generated fixture was converted from the pinned commit");
assert.equal(DIRECTION_D_SOURCE.directory, SOURCE_DIR);
assert.equal(DIRECTION_D_SOURCE.shiftDays, SHIFT_DAYS);
assert.equal(SHIFT_DAYS, -21);
assert.deepEqual(Object.keys(DIRECTION_D_SOURCE.files), SOURCE_FILES);

const state = fixtures.directionDState();
const TODAY = "2026-08-31"; // review TODAY 2026-09-21 (data.js:249), shifted -21 days
const MIXED_TODAY = "2026-09-02"; // review MIX.today 2026-09-23 (data-d.js:78), shifted -21 days

/* ---------------------------------------------------------------- targets */

// A. Dia 1 before the session starts: data.js TODAY_REC (lines 98-102).
// glyph is the review verdict; load/reps are the drawn target; from is the
// previous top load the "up" arrows start from.
const TODAY_REC = {
  sq: { glyph: "up", from: 100, load: 102.5, reps: 7, sets: 3 }, // data.js:98
  pr: { glyph: "hold", from: 80, load: 80, reps: 8, sets: 3 }, // data.js:99
  lc: { glyph: "up", from: 42.5, load: 45, reps: 10, sets: 2 }, // data.js:100
  rw: { glyph: "hold", from: 55, load: 55, reps: 12, sets: 3 }, // data.js:101
  lr: { glyph: "stalled", from: 10, load: 10, reps: 12, sets: 2 }, // data.js:102
};

// B. Next exposure of each lift after its latest session: data.js NEXT (lines 110-124).
const NEXT = {
  sq: { glyph: "hold", load: 102.5, reps: 8 }, // data.js:110
  pr: { glyph: "hold", load: 80, reps: 8 }, // data.js:111
  lc: { glyph: "hold", load: 45, reps: 11 }, // data.js:112
  rw: { glyph: "stalled", load: 55, reps: 10 }, // data.js:113
  lr: { glyph: "hold", load: 10, reps: 14 }, // data.js:114
  hg: { glyph: "hold", load: 82.5, reps: 10 }, // data.js:115
  pd: { glyph: "hold", load: 57.5, reps: 12 }, // data.js:116
  sp: { glyph: "hold", load: 22.5, reps: 9 }, // data.js:117
  lp: { glyph: "up", from: 170, load: 175, reps: 14 }, // data.js:118
  cz: { glyph: "hold", load: 27.5, reps: 10 }, // data.js:119
  hk: { glyph: "hold", load: 105, reps: 10 }, // data.js:120
  ip: { glyph: "hold", load: 25, reps: 10 }, // data.js:121
  rd: { glyph: "hold", load: 30, reps: 12 }, // data.js:122
  lcl: { glyph: "recover", load: 37.5, reps: 10 }, // data.js:123
  tr: { glyph: "recover", load: 45, reps: 9 }, // data.js:124
};

// C. The mixed day, Wednesday 23 Sep in the review: data-d.js rec(k, MIX.today)
// (lines 368-402) on MIX_SESSIONS (lines 52-76) with MIX_RX (lines 39-47) and
// MANUAL (line 48). The review page computes these live with
// progression-engine.js; the values below are what it renders.
const MIXED = {
  dl: { strategy: "anchor_backoff", glyph: "up", sets: [[137.5, 5], [117.5, 8], [117.5, 8]] }, // "137,5 kg x 5 + 2 x 117,5 x 8", target "1 + 2"
  ht: { strategy: "rep_goal", glyph: "hold", sets: [[100, 12], [100, 12], [100, 12]] }, // "100 kg x 12, 12, 12", target "total 36"
  ts: { strategy: "effort_target", glyph: "up", sets: [[35, 10], [35, 10], [35, 10]] }, // "35 kg x 10", target "3 x 10"
  cp: { strategy: "manual", glyph: "manual", authored: { sets: 3, min: 12, max: 15, load: 120 } }, // data-d.js:48, "120 kg x 12-15"
  cr: { strategy: "range", glyph: "up", sets: [[52.5, 10], [52.5, 10], [52.5, 10]] }, // "52,5 kg x 10", target "3 x 10"
  hc: { strategy: "range", glyph: "recover", sets: [[15, 13], [15, 13]] }, // "15 kg x 13", target "2 x 13"
};

/* ----------------------------------------------------------------- engine */

const num = (value) => Number(value);
const isWork = (row) => !row.warmup;

function matches(slot, row) {
  const rowKey = row.performedLibraryId ? `library:${row.performedLibraryId}` : `name:${String(row.performedName || row.name).toLowerCase()}`;
  const slotKey = slot.libraryId ? `library:${slot.libraryId}` : `name:${String(slot.name).toLowerCase()}`;
  return rowKey === slotKey;
}

function historyFor(slot, { before, migrated } = {}) {
  const sessions = new Map();
  for (const row of state.log) {
    if (!matches(slot, row) || !(num(row.load) > 0) || !isWork(row)) continue;
    if (before && !(row.date < before)) continue;
    if (!sessions.has(row.session)) sessions.set(row.session, { sessionId: row.session, date: row.date, created: row.created, sets: [] });
    // migrateLogSnapshot (app.js) turns a blank RIR on a range slot into 0 at load; other strategies keep null.
    const blank = migrated && slot.progression.strategy.id === "range" ? 0 : null;
    sessions.get(row.session).sets.push({ load: num(row.load), reps: num(row.reps), rir: row.rir == null ? blank : num(row.rir) });
  }
  return [...sessions.values()]
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.created).localeCompare(String(b.created)))
    .map(({ sessionId, date, sets }) => ({ sessionId, date, sets }));
}

function evaluate(slot, options = {}) {
  const input = {
    engineVersion: 1,
    prescription: slot.progression,
    relation: null,
    modifiers: [],
    settings: { minLoadIncrement: num(state.settings.minJump), jumpPercent: num(state.settings.jumpPct), hardRir: num(state.settings.hardRir) },
    history: historyFor(slot, options),
    currentSession: [],
    context: { weekNumber: options.weekNumber ?? 4, blockLength: num(state.programMeta.mesocycleLengthWeeks), blockStart: state.programMeta.started },
  };
  return Engine.evaluateProgression(input);
}

// The review page's verdict glyph for one engine result (data-d.js verdictOf,
// lines 214-263, range, rep_goal, effort_target and anchor_backoff branches).
function glyphOf(strategy, result) {
  const codes = result.reasonCodes;
  if (result.kind === "manual") return "manual";
  if (strategy === "range") {
    if (codes[0] === "range.no_history") return "new";
    if (["range.capacity_top_double", "range.performed_top", "range.capacity_top", "range.current_advance"].includes(codes[0])) return "up";
    if (codes[0] === "range.below_floor" || codes[0] === "range.current_reduce") return "down";
    if (codes[0] === "range.stalled") return "stalled";
    if (codes[0] === "range.recovery") return "recover";
    return "hold";
  }
  if (strategy === "rep_goal") {
    if (codes.includes("rep_goal.no_history")) return "new";
    if (codes.includes("rep_goal.advance")) return "up";
    if (codes.includes("rep_goal.effort_too_high")) return "recover";
    if (codes.includes("rep_goal.capacity_below_floor")) return "down";
    return "hold";
  }
  if (strategy === "effort_target") {
    if (codes.includes("effort_target.no_history")) return "new";
    if (codes.includes("effort_target.too_easy")) return "up";
    if (codes.includes("effort_target.rep_miss") || codes.includes("effort_target.too_hard")) return "down";
    return "hold";
  }
  if (codes.includes("anchor_backoff.no_history")) return "new";
  if (codes.includes("anchor_backoff.anchor_advance")) return "up";
  if (codes.includes("anchor_backoff.anchor_below_floor")) return "down";
  return "hold";
}

const slotById = new Map(state.program.map((slot) => [slot.id, slot]));
const slotFor = (key) => {
  const slot = slotById.get(`ex-${key}`);
  assert(slot, `fixture has a program slot ex-${key}`);
  return slot;
};
const setsOf = (result) => result.target.sets.map((set) => [set.load, set.reps]);

/* ------------------------------------------------------------- the checks */

// The review page passes week 4 and a blank RIR as null; app.js passes week 1 and
// has turned that blank into 0 on a range slot by the time it recommends. The
// targets must not depend on either difference.
const VARIANTS = [
  { weekNumber: 4, migrated: false },
  { weekNumber: 1, migrated: false },
  { weekNumber: 1, migrated: true },
];
for (const variant of VARIANTS) {
  for (const [key, want] of Object.entries(TODAY_REC)) {
    const slot = slotFor(key);
    const result = evaluate(slot, { before: TODAY, ...variant });
    const label = `today ${key} (${JSON.stringify(variant)})`;
    assert.equal(glyphOf("range", result), want.glyph, `${label} verdict`);
    assert.equal(result.target.sets.length, want.sets, `${label} set count`);
    assert.deepEqual(setsOf(result), Array.from({ length: want.sets }, () => [want.load, want.reps]), `${label} target`);
    assert.equal(result.facts.latestLoad, want.from, `${label} previous load`);
  }

  for (const [key, want] of Object.entries(NEXT)) {
    const slot = slotFor(key);
    const result = evaluate(slot, { ...variant });
    const label = `next ${key} (${JSON.stringify(variant)})`;
    assert.equal(glyphOf("range", result), want.glyph, `${label} verdict`);
    assert(result.target.sets.length > 0, `${label} has a target`);
    for (const set of result.target.sets) assert.deepEqual([set.load, set.reps], [want.load, want.reps], `${label} target`);
    if (want.from !== undefined) assert.equal(result.facts.latestLoad, want.from, `${label} previous load`);
  }

  for (const [key, want] of Object.entries(MIXED)) {
    const slot = slotFor(key);
    const result = evaluate(slot, { before: MIXED_TODAY, ...variant });
    const label = `mixed ${key} (${JSON.stringify(variant)})`;
    assert.equal(slot.progression.strategy.id, want.strategy, `${label} strategy envelope`);
    assert.equal(glyphOf(want.strategy, result), want.glyph, `${label} verdict`);
    if (want.strategy === "manual") {
      assert.equal(result.kind, "manual", `${label} engine returns no target`);
      assert.deepEqual(result.target.sets, [], `${label} no engine sets`);
      assert.deepEqual({ sets: slot.sets, min: slot.min, max: slot.max, load: slot.load }, want.authored, `${label} authored template is a program field`);
    } else {
      assert.deepEqual(setsOf(result), want.sets, `${label} target`);
    }
  }
}

/* ------------------------------------------------ conversion invariants */

// One lifter, the review page's block: 3 days, Mon/Wed/Fri, started 10 Aug, today 31 Aug.
assert.equal(state.programMeta.started, "2026-08-10", "the block starts 21 days before the review page's 31 Aug");
assert.equal(new Date(`${state.programMeta.started}T00:00:00Z`).getUTCDay(), 1, "the block starts on a Monday");
assert.equal(CAPTURE_NOW.slice(0, 10), TODAY, "the review page's today lands on the pinned capture clock");
assert.equal(new Date(`${TODAY}T00:00:00Z`).getUTCDay(), 1, "capture today is a Monday");
assert.equal(state.programMeta.mesocycleLengthWeeks, 6);
assert.equal(state.settings.rirHigh, 2, "range RIR 0-2");

// data.js SESSIONS (lines 65-76) shifted by -21 days: weekday and order preserved.
const BLOCK_DATES = ["2026-08-10", "2026-08-12", "2026-08-14", "2026-08-17", "2026-08-19", "2026-08-21", "2026-08-24", "2026-08-26", "2026-08-28", "2026-08-31"];
const BLOCK_DAYS = ["Day 1", "Day 2", "Day 3", "Day 1", "Day 2", "Day 3", "Day 1", "Day 2", "Day 3", "Day 1"];
const blockSessions = new Map();
for (const row of state.log) {
  if (row.date < state.programMeta.started || row.day === "Day 2 · mixed") continue;
  blockSessions.set(row.session, { date: row.date, day: row.day });
}
assert.deepEqual([...blockSessions.values()].map((entry) => entry.date), BLOCK_DATES, "block session dates are the review dates minus 21 days");
assert.deepEqual([...blockSessions.values()].map((entry) => entry.day), BLOCK_DAYS, "block sessions keep their day");
for (const date of BLOCK_DATES) assert([1, 3, 5].includes(new Date(`${date}T00:00:00Z`).getUTCDay()), `${date} keeps its Mon/Wed/Fri weekday`);
assert(state.log.every((row) => row.date <= TODAY), "nothing is logged after the capture clock");
assert(state.log.every((row, index, rows) => index === 0 || rows[index - 1].date <= row.date), "log is oldest first");

// Library ids and names come from exercises.js; the one custom exercise is a real definition.
const library = new Map(EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));
const custom = state.customExercises;
assert.equal(custom.length, 1, "exactly one custom exercise");
assert.equal(custom[0].id, "custom:remada-articulada");
assert.equal(custom[0].name, "Remada articulada no aparelho", "a typed name reads the same in both languages");
assert.equal(custom[0].namePt, custom[0].name);
assert.equal(custom[0].custom, true);
const unlinked = [];
for (const slot of state.program) {
  const entry = library.get(slot.libraryId);
  if (!entry) { unlinked.push(slot.libraryId); continue; }
  assert.equal(slot.name, entry.name, `${slot.id} name is the library name`);
  assert.equal(slot.primary, entry.primary, `${slot.id} primary muscles are the library's`);
  assert.equal(slot.secondary, entry.secondary, `${slot.id} secondary muscles are the library's`);
}
assert.deepEqual(unlinked, [custom[0].id], "only the custom exercise is not a library movement");
assert.deepEqual(state.program.filter((slot) => slot.libraryId === custom[0].id).map((slot) => slot.id), ["ex-cr"]);

// Program: 3 main days plus the mixed day; strategy envelopes per slot.
assert.deepEqual([...new Set(state.program.map((slot) => slot.day))], ["Day 1", "Day 2", "Day 3", "Day 2 · mixed"]);
assert.deepEqual(state.program.filter((slot) => slot.day === "Day 2 · mixed").map((slot) => slot.progression.strategy.id), ["anchor_backoff", "rep_goal", "effort_target", "manual", "range", "range"]);
for (const slot of state.program.filter((entry) => !entry.day.includes("mixed"))) {
  assert.equal(slot.progression.strategy.id, "range", `${slot.id} is a range slot`);
  const params = slot.progression.strategy.params;
  assert.deepEqual([params.workingSets, params.repMin, params.repMax, params.targetRirMin, params.targetRirMax], [slot.sets, slot.min, slot.max, 0, 2], `${slot.id} range prescription with RIR 0-2`);
}

// Log rows use the existing row shape; the one missing-effort set is blank, everything else is a number.
const ROW_KEYS = ["session", "date", "day", "name", "exerciseId", "set", "load", "reps", "rir", "work", "created", "primary", "secondary", "performedLibraryId"];
for (const row of state.log) {
  assert.deepEqual(Object.keys(row), ROW_KEYS, `row shape ${row.session} ${row.exerciseId} set ${row.set}`);
  assert.equal(row.work, true);
  assert(slotById.has(row.exerciseId), `${row.exerciseId} is a program slot`);
}
const blank = state.log.filter((row) => row.rir === null && row.date >= state.programMeta.started);
assert.deepEqual(blank.map((row) => [row.date, row.exerciseId, row.set]), [["2026-08-26", "ex-hc", 2]], "the mixed day has the one set logged without RIR");
assert(state.log.filter((row) => row.date >= state.programMeta.started).every((row) => row.rir === null || Number.isFinite(row.rir)));
assert(state.log.filter((row) => row.performedLibraryId === custom[0].id).length === 9, "the custom exercise has its three logged sessions");

// Nothing in the fixture is shared with the caller: a second call is a fresh deep copy.
const again = fixtures.directionDState();
assert.deepEqual(again, state);
again.log[0].load = -1;
again.program[0].name = "mutated";
assert.notEqual(fixtures.directionDState().log[0].load, -1);
assert.notEqual(fixtures.directionDState().program[0].name, "mutated");

// Non-D states keep the catalog designer fixture.
assert.equal(fixtures.catalogState().programMeta.id, "catalog-program");
assert.notEqual(state.programMeta.id, fixtures.catalogState().programMeta.id);

console.log("direction-d-fixture: ok");
