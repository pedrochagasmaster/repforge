#!/usr/bin/env node
/**
 * Generates tools/ui-screens/direction-d-fixture.generated.mjs, the data behind
 * `directionDState()` (Plan 063 P3b, Direction D spec section 11).
 *
 * Source of truth: the Direction D review page's data layer at a pinned commit,
 * read straight from git so the prototype never enters `main`:
 *
 *   docs/design/main-screen-directions/data.js    program, sessions, prior block
 *   docs/design/main-screen-directions/data-d.js  the mixed day
 *
 * The files are evaluated, not parsed or retyped. The one textual change is
 * that data.js's IIFE exports two private constants (PRIOR, SQUAT_PRIOR) that
 * its TX object does not expose; the generator adds them to that export and
 * fails if the anchor text is not found. Exercise ids, names and muscles are
 * checked against the live exercises.js and the run stops on any mismatch.
 *
 * Conversion rules:
 * - Dates shift by -21 days (the review page's "today", Monday 21 Sep 2026,
 *   becomes the pinned capture clock, Monday 31 Aug 2026). The generator
 *   asserts every shifted date keeps its weekday.
 * - Main-day slots carry the range envelope the review page hands the engine
 *   (sets, min, max, RIR 0-2). Mixed-day slots carry the exact envelopes of
 *   data-d.js (MIX_RX). Row sets/min/max for non-range envelopes are derived
 *   from the envelope (see slotRange) because the program row needs them.
 * - The review page's manual-slot template (MANUAL) becomes the slot's `load`.
 * - Log rows use the app's row shape. A missing RIR is null. The previous
 *   mesocycle (SQUAT_PRIOR and PRIOR) becomes log rows dated before the block:
 *   SQUAT_PRIOR keeps its own dates; PRIOR has none, so its best sets are placed
 *   in the last prior-block week, Day 1 on the last SQUAT_PRIOR date and Days 2
 *   and 3 two and four days later. PRIOR has no RIR, so those rows carry null.
 *
 * Re-run (needs the pinned commit in the local object database):
 *
 *   node tools/generate-direction-d-fixture.mjs           write the output
 *   node tools/generate-direction-d-fixture.mjs --check   fail if the committed output differs
 *
 * CI does not run this generator: a CI checkout may not contain the pinned
 * commit. CI runs test/direction-d-fixture.mjs against the committed output.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

export const SOURCE_SHA = "2f2fc04455def511f57fd22331943735625ef988";
export const SOURCE_DIR = "docs/design/main-screen-directions/";
export const SOURCE_FILES = ["data.js", "data-d.js"];
export const SHIFT_DAYS = -21;
export const OUTPUT = "tools/ui-screens/direction-d-fixture.generated.mjs";
const MIXED_DAY = "mixed";

const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, "\n");
const readPinned = (file) => git(["show", `${SOURCE_SHA}:${SOURCE_DIR}${file}`]);
const blobOf = (file) => git(["rev-parse", `${SOURCE_SHA}:${SOURCE_DIR}${file}`]).trim();

/* ------------------------------------------------------------- the source */

function loadReviewData() {
  const win = { RepForgeProgression: {}, RepForgeI18n: {} }; // data-d.js only checks they exist at load
  win.window = win;
  const dataSource = readPinned("data.js");
  const exported = dataSource.replace("root.TX = {", "root.TX = { PRIOR, SQUAT_PRIOR,");
  if (exported === dataSource) throw new Error("data.js: expected `root.TX = {` export anchor not found");
  new Function("window", exported)(win);
  new Function("window", readPinned("data-d.js"))(win);
  if (!win.TX || !win.DX) throw new Error("review data did not load");
  return { TX: win.TX, DX: win.DX };
}

/* ------------------------------------------------------------- the dates */

const parseIso = (iso) => new Date(`${iso}T00:00:00Z`);
function shift(iso, days = SHIFT_DAYS) {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/* ----------------------------------------------------------- the slots */

function librarySlotFacts(entry, reviewLift, problems) {
  const where = `${reviewLift.id} (${reviewLift.en})`;
  if (!entry) { problems.push(`${where}: no library entry`); return null; }
  if (entry.name !== reviewLift.en) problems.push(`${where}: library name "${entry.name}" differs from review name "${reviewLift.en}"`);
  if (entry.namePt !== reviewLift.pt) problems.push(`${where}: library PT name "${entry.namePt}" differs from review "${reviewLift.pt}"`);
  if (entry.primary !== reviewLift.pri.join(",")) problems.push(`${where}: library primary "${entry.primary}" differs from review "${reviewLift.pri.join(",")}"`);
  if (entry.secondary !== reviewLift.sec.join(",")) problems.push(`${where}: library secondary "${entry.secondary}" differs from review "${reviewLift.sec.join(",")}"`);
  return { name: entry.name, primary: entry.primary, secondary: entry.secondary };
}

// Row sets/min/max for each envelope. The envelope stays authoritative; the row
// needs a range because every program slot has one.
function slotRange(envelope, manual) {
  const { id, params } = envelope.strategy;
  if (id === "range") return { sets: params.workingSets, min: params.repMin, max: params.repMax };
  if (id === "rep_goal") return { sets: params.workingSets, min: params.repFloor, max: params.repCeiling };
  if (id === "effort_target") return { sets: params.workingSets, min: params.targetReps, max: params.targetReps };
  if (id === "anchor_backoff") return { sets: 1 + params.backoffSets, min: params.anchorRepMin, max: params.backoffRepMax };
  if (id === "manual") {
    if (!manual) throw new Error("manual slot without an authored template");
    return { sets: manual.sets, min: manual.lo, max: manual.hi };
  }
  throw new Error(`unknown strategy ${id}`);
}

const rangeEnvelope = (sets, min, max, rirMin, rirMax) => ({
  schemaVersion: 1,
  strategy: { id: "range", version: 1, params: { workingSets: sets, repMin: min, repMax: max, targetRirMin: rirMin, targetRirMax: rirMax } },
  modifiers: [],
});

/* ------------------------------------------------------------- convert */

export function convert() {
  const { TX, DX } = loadReviewData();
  const { EXERCISE_LIBRARY } = require("../exercises.js");
  const library = new Map(EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));
  const problems = [];

  const mainDays = TX.PROGRAM.days.map((day) => day.name[1]);
  const mixedDay = DX.MIX.name[1];
  const dayOrder = [...mainDays, mixedDay];
  const dayIndex = new Map(dayOrder.map((day, index) => [day, index]));
  const rirHigh = TX.PROGRAM.rirHigh;

  // Every lift of the one lifter, in program order: main days, then the mixed day.
  const lifts = [];
  TX.PROGRAM.days.forEach((day, di) => {
    day.lifts.forEach((key) => {
      const ex = TX.EX[key];
      const facts = librarySlotFacts(library.get(ex.id), { id: ex.id, en: ex.en, pt: ex.pt, pri: ex.pri, sec: ex.sec }, problems);
      lifts.push({
        key, day: mainDays[di], libraryId: ex.id, custom: false, facts,
        envelope: rangeEnvelope(ex.n, ex.r[0], ex.r[1], 0, rirHigh), notes: ex.note ? ex.note[1] : "",
      });
    });
  });
  for (const key of DX.MIX.lifts) {
    const ex = DX.MIX_EX[key];
    const facts = ex.custom
      ? { name: ex.en, primary: ex.pri.join(","), secondary: ex.sec.join(",") }
      : librarySlotFacts(library.get(ex.id), { id: ex.id, en: ex.en, pt: ex.pt, pri: ex.pri, sec: ex.sec }, problems);
    lifts.push({
      key, day: mixedDay, libraryId: ex.id, custom: !!ex.custom, facts,
      envelope: JSON.parse(JSON.stringify(DX.MIX_RX[key])), notes: "", manual: DX.MANUAL[key] || null,
    });
  }
  if (problems.length) throw new Error(`Review data does not match exercises.js:\n- ${problems.join("\n- ")}`);
  if (new Set(lifts.map((lift) => lift.key)).size !== lifts.length) throw new Error("duplicate lift keys");
  const byKey = new Map(lifts.map((lift) => [lift.key, lift]));

  // Program rows.
  const program = [];
  const perDay = new Map();
  for (const lift of lifts) {
    const order = (perDay.get(lift.day) || 0) + 1;
    perDay.set(lift.day, order);
    const range = slotRange(lift.envelope, lift.manual);
    const row = {
      id: `ex-${lift.key}`, day: lift.day, order, name: lift.facts.name, sets: range.sets, min: range.min, max: range.max,
      primary: lift.facts.primary, secondary: lift.facts.secondary, notes: lift.notes, alternates: [],
      libraryId: lift.libraryId, progression: lift.envelope,
    };
    if (lift.manual) row.load = lift.manual.load; // the authored load of the manual slot
    program.push(row);
  }

  // Custom exercise definitions: the normalized shape normalizeCustomExercises writes.
  const customExercises = lifts.filter((lift) => lift.custom).map((lift) => {
    const ex = DX.MIX_EX[lift.key];
    return {
      id: ex.id, name: ex.en, namePt: ex.pt, archived: false, equipment: ["machine"],
      primary: lift.facts.primary, secondary: lift.facts.secondary, notes: "", patterns: [],
      beginnerFriendly: true, custom: true, created: `${shift(DX.MIX.first)}T12:00:00.000Z`,
    };
  });

  // Sessions: main block, mixed day, previous mesocycle. Merged by date and day.
  const sessions = new Map();
  const sessionOf = (date, day) => {
    const id = `${date}|${day}`;
    if (!sessions.has(id)) sessions.set(id, { date, day, lifts: new Map() });
    return sessions.get(id);
  };
  const addSets = (session, key, sets) => {
    if (session.lifts.has(key)) throw new Error(`${key} twice in ${session.date} ${session.day}`);
    session.lifts.set(key, sets);
  };
  const triple = ([load, reps, rir]) => ({ load, reps, rir: rir == null ? null : rir });

  for (const entry of TX.SESSIONS) {
    const session = sessionOf(shift(entry.date), mainDays[entry.day]);
    for (const key of TX.PROGRAM.days[entry.day].lifts) if (entry.lifts[key]) addSets(session, key, entry.lifts[key].map(triple));
  }
  for (const entry of DX.MIX_SESSIONS) {
    const session = sessionOf(shift(entry.date), mixedDay);
    for (const key of DX.MIX.lifts) if (entry.lifts[key]) addSets(session, key, entry.lifts[key].map((set) => ({ load: set.load, reps: set.reps, rir: set.rir == null ? null : set.rir })));
  }
  // Previous mesocycle.
  const priorWeekEnd = TX.SQUAT_PRIOR[TX.SQUAT_PRIOR.length - 1].date;
  for (const entry of TX.SQUAT_PRIOR) addSets(sessionOf(shift(entry.date), mainDays[0]), "sq", entry.sets.map(triple));
  TX.PROGRAM.days.forEach((day, di) => {
    const date = shift(new Date(parseIso(priorWeekEnd).getTime() + di * 2 * 864e5).toISOString().slice(0, 10));
    for (const key of day.lifts) {
      if (!TX.PRIOR[key]) continue;
      addSets(sessionOf(date, mainDays[di]), key, TX.PRIOR[key].map(([load, reps]) => ({ load, reps, rir: null })));
    }
  });

  // Log rows, oldest first.
  const log = [];
  const liftOrder = new Map(lifts.map((lift, index) => [lift.key, index]));
  const ordered = [...sessions.values()].sort((a, b) => a.date.localeCompare(b.date) || dayIndex.get(a.day) - dayIndex.get(b.day));
  for (const session of ordered) {
    const slug = `dd-${session.date}-${session.day === mixedDay ? "day2-mixed" : session.day.toLowerCase().replace(/\s+/g, "")}`;
    const keys = [...session.lifts.keys()].sort((a, b) => liftOrder.get(a) - liftOrder.get(b));
    for (const key of keys) {
      const lift = byKey.get(key);
      session.lifts.get(key).forEach((set, index) => {
        log.push({
          session: slug, date: session.date, day: session.day, name: lift.facts.name, exerciseId: `ex-${key}`, set: index + 1,
          load: set.load, reps: set.reps, rir: set.rir, work: true, created: `${session.date}T12:00:00.000Z`,
          primary: lift.facts.primary, secondary: lift.facts.secondary, performedLibraryId: lift.libraryId,
        });
      });
    }
  }

  // Weekday invariant for every converted date.
  const reviewDates = [
    ...TX.SESSIONS.map((entry) => entry.date), ...DX.MIX_SESSIONS.map((entry) => entry.date),
    ...TX.SQUAT_PRIOR.map((entry) => entry.date), TX.PROGRAM.started, TX.TODAY, DX.MIX.today,
  ];
  for (const iso of reviewDates) {
    if (parseIso(shift(iso)).getUTCDay() !== parseIso(iso).getUTCDay()) throw new Error(`${iso} lost its weekday`);
  }

  return {
    data: {
      scenario: {
        today: shift(TX.TODAY), mixedDayToday: shift(DX.MIX.today), blockStart: shift(TX.PROGRAM.started),
        weekNumber: DX.CONTEXT.weekNumber, blockLength: DX.CONTEXT.blockLength, blockWeeks: TX.PROGRAM.weeks,
      },
      programName: TX.PROGRAM.name[1],
      settings: { jumpPct: DX.SETTINGS.jumpPercent, minJump: DX.SETTINGS.minLoadIncrement, hardRir: DX.SETTINGS.hardRir, rirHigh },
      days: dayOrder,
      program, customExercises, log,
    },
    blobs: Object.fromEntries(SOURCE_FILES.map((file) => [file, blobOf(file)])),
  };
}

/* ------------------------------------------------------------- the output */

const oneLine = (value) => JSON.stringify(value);
const block = (items, indent = "  ") => `[\n${items.map((item) => `${indent}  ${oneLine(item)}`).join(",\n")}\n${indent}]`;

export function render({ data, blobs }) {
  const source = {
    repository: "pedrochagasmaster/repforge", commit: SOURCE_SHA, directory: SOURCE_DIR,
    files: Object.fromEntries(SOURCE_FILES.map((file) => [file, blobs[file]])), shiftDays: SHIFT_DAYS,
    generator: "tools/generate-direction-d-fixture.mjs",
  };
  return `/**
 * GENERATED by tools/generate-direction-d-fixture.mjs. Do not edit by hand.
 *
 * Direction D catalog fixture data (Plan 063 P3b, Direction D spec section 11),
 * converted from the review page's data.js and data-d.js at commit
 * ${SOURCE_SHA}.
 * Dates are shifted by ${SHIFT_DAYS} days. To regenerate: \`node tools/generate-direction-d-fixture.mjs\`
 * (needs that commit locally; CI does not run the generator and tests this
 * committed output with test/direction-d-fixture.mjs).
 */
export const DIRECTION_D_SOURCE = ${JSON.stringify(source, null, 2)};

export const DIRECTION_D_DATA = {
  scenario: ${JSON.stringify(data.scenario)},
  programName: ${JSON.stringify(data.programName)},
  settings: ${JSON.stringify(data.settings)},
  days: ${JSON.stringify(data.days)},
  program: ${block(data.program)},
  customExercises: ${block(data.customExercises)},
  log: ${block(data.log)},
};
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(root, OUTPUT);
  const text = render(convert());
  if (process.argv.includes("--check")) {
    let committed = "";
    try { committed = readFileSync(out, "utf8"); } catch { /* missing counts as different */ }
    if (committed !== text) {
      console.error(`${OUTPUT} differs from a fresh conversion of ${SOURCE_SHA}. Run: node tools/generate-direction-d-fixture.mjs`);
      process.exit(1);
    }
    console.log(`${OUTPUT} matches ${SOURCE_SHA}`);
  } else {
    writeFileSync(out, text);
    console.log(`wrote ${OUTPUT} from ${SOURCE_SHA}`);
  }
}
