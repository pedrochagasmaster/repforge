/**
 * Seeded storage fixtures for the UI screen catalog.
 *
 * `catalogState` is the designer program: the canonical seed program (three
 * days, real catalog movements, test/fixtures/seed-program.mjs) with real
 * logged sessions layered on, so Progress/History/PR surfaces have something
 * true to draw. The entry fixtures stay deliberately minimal — onboarding
 * evidence must not depend on a rich program that the flow itself has not
 * created yet.
 *
 * Session dates are measured back from the pinned capture clock, never from
 * the real one. History, Progress and Today all render dates, so a fixture
 * built from `new Date()` would produce a different catalog every day and the
 * drift gate would fail on any day but the one the evidence was captured.
 */
import { CAPTURE_NOW } from "./session.mjs";
import { DIRECTION_D_DATA } from "./direction-d-fixture.generated.mjs";
import { DIRECTION_D_CANONICAL_DATA } from "./direction-d-canonical-fixture.generated.mjs";
import { seedProgram, seedProgramMeta } from "../../test/fixtures/seed-program.mjs";
import { definitionSlot, metricLogRow } from "../../test/fixtures/history-metric-rows.mjs";
import { createRequire } from "node:module";

const LIBRARY_BY_ID = new Map(createRequire(import.meta.url)("../../exercises.js").EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));

function isoDaysAgo(n) {
  const d = new Date(Date.parse(CAPTURE_NOW));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function catalogState() {
  // A manual program suffices here (no screen keyed off catalogState() shows
  // an adaptive recommendation), so the designer catalog is the same canonical
  // program the browser suites install: real catalog movements under the
  // seed display names, built through the app's own Build definition
  // (tools/build-seed-program-fixture.mjs), not an invented ProgramDefinition.
  const program = seedProgram();
  const programMeta = seedProgramMeta({
    id: "catalog-program", name: "Designer catalog", started: isoDaysAgo(21),
    created: "2026-07-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z",
    goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3,
    splitType: "full_body", equipment: ["barbell", "machines", "cables"],
    priorityMuscles: ["Quads", "Chest"], sessionLength: "60",
  });
  const log = [];
  // One ascending load per row, varied enough that History/Progress/PR
  // surfaces have real-looking numbers rather than a repeated constant.
  const BASE_LOAD = { "Day 1": [100, 45, 70, 55, 12, 20], "Day 2": [40, 120, 40, 30, 35, 25], "Day 3": [50, 40, 35, 45, 20, 15] };
  const pushSession = (day, date, bump = 0) => {
    const session = `${date}-${day.replace(/\s+/g, "").toLowerCase()}-catalog`;
    program.filter((row) => row.day === day).forEach((row, index) => {
      const load = (BASE_LOAD[day]?.[index] ?? 60) + bump;
      for (let set = 1; set <= Math.min(row.sets, 2); set++) {
        log.push(metricLogRow(programMeta, row, {
          session, date, day, set, load, reps: row.min + 2, rir: 1, created: `${date}T12:00:00.000Z`,
          extra: { effortSource: "rir" },
        }));
      }
    });
  };
  pushSession("Day 1", isoDaysAgo(10));
  pushSession("Day 2", isoDaysAgo(8));
  pushSession("Day 3", isoDaysAgo(6));
  pushSession("Day 1", isoDaysAgo(3), 2.5);
  pushSession("Day 2", isoDaysAgo(1), 2.5);

  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta, program, log, programHistory: [], customExercises: [], _storageRevision: 40,
  };
}

/**
 * The Direction D lifter: the one the review page draws, so an owner can hold a
 * capture next to its drawing (Direction D spec section 11). The data is the
 * committed output of `tools/generate-direction-d-fixture.mjs`, converted from
 * the review page's data layer at a pinned commit with every date shifted by
 * -21 days, so the review page's "today" (Monday 21 Sep 2026) is CAPTURE_NOW
 * (Monday 31 Aug 2026). Edit the generator, never the generated module.
 *
 * Only D-owned catalog states use this. Every other state keeps
 * `catalogState()`, so rules-only frames do not change because of it.
 */
export function directionDState() {
  // The lifter's identity and history are canonical (built by
  // tools/ui-screens/build-direction-d-canonical-fixture.mjs from the frozen
  // DIRECTION_D_DATA mockup conversion: same names, order, rep ranges, notes
  // and every logged set, now carrying a real ProgramDefinition instead of
  // flat rows under retired short library ids). Only the jump/RIR settings
  // still come from the raw mockup data; they are not part of the program.
  const { programMeta, program, customExercises, log } = structuredClone(DIRECTION_D_CANONICAL_DATA);
  const settings = DIRECTION_D_DATA.settings;
  return {
    settings: {
      ...catalogState().settings,
      jumpPct: settings.jumpPct, minJump: settings.minJump, rirHigh: settings.rirHigh, hardRir: settings.hardRir,
      // The test-set prompt (Plan 077 PR 3) is drawn by its own states, which switch it on; elsewhere it would sit over
      // whatever the state is about.
      maxSetPrompts: false,
    },
    programMeta, program, log, programHistory: [], customExercises, _storageRevision: 40,
  };
}

export function pastZeroState(lang, saved = false) {
  const state = localeState(directionDState(), lang);
  const squat = state.program[0];
  for (const cycle of definitionSlot(state.programMeta, squat).prescriptionsByCycle) {
    for (const set of cycle.sets) set.rir = 0;
  }
  const date = isoDaysAgo(7);
  state.settings = { ...state.settings, rirMode: "numeric", slowRepTaps: false };
  const partialRow = (session, date, set, reps, partialReps) => metricLogRow(state.programMeta, squat, {
    session, date, set, load: 105, reps, rir: 0, extra: { effortSource: "reps_left", partialReps },
  });
  state.log = [[6, 2], [6, 1], [5, 2]].map(([reps, count], index) =>
    partialRow("past-zero-previous", date, index + 1, reps, count));
  if (saved) state.log.push(partialRow("past-zero-saved", isoDaysAgo(0), 1, 6, 3));
  return state;
}

export function emptyFirstRunState() {
  return {
    settings: catalogState().settings,
    programMeta: {
      id: "", name: "", started: null, created: null, updated: null, onboarded: false,
      mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: null, experience: null,
      daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [],
      sessionLength: null, completedAt: null,
    },
    program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
  };
}

function entryBase(lang = "en") {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, unit: "kg",
      lang, rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "", name: "", started: null, created: null, updated: null, onboarded: false,
      mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: null, experience: null,
      daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [],
      sessionLength: null, completedAt: null, progressionRelations: [],
      progressionModifiers: [], progressionIncompatibilities: [],
      programStructure: null, entrySource: null,
    },
    program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
  };
}

/** No program yet: every entry route starts here. */
export function emptyEntryState(lang = "en") {
  return entryBase(lang);
}

/** A program is already active, so replacement consequences are in view. */
export function activeEntryState(lang = "en") {
  const base = entryBase(lang);
  return {
    ...base,
    programMeta: {
      ...base.programMeta,
      id: "catalog-active", name: lang === "pt" ? "Treino atual" : "Current program",
      started: "2026-08-01", created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z", onboarded: true, daysPerWeek: 3,
      splitType: "full_body", equipment: ["machines"], goal: "hypertrophy",
      experience: "intermediate", sessionLength: "60",
    },
    program: [{
      id: "catalog-active-1", day: "Day 1", order: 1, name: "Cable row", sets: 3,
      min: 8, max: 12, primary: "Mid/upper back", secondary: "Biceps", notes: "", libraryId: "row_cable",
    }],
    _storageRevision: 3,
  };
}

export function localeState(state, lang) {
  return { ...state, settings: { ...state.settings, lang } };
}

/* The lifter's own words in these fixtures, as a Portuguese lifter would have
   typed them. App-authored names need no entry here: "Day N" and generated day
   names are localized on screen. */
const PORTUGUESE_LIFTER_TEXT = Object.freeze({
  "Full body": "Corpo inteiro",
  "Day 2 · mixed": "Dia 2 · misto",
  "Designer catalog": "Catálogo de design",
  "Rack on pin 9": "Rack no pino 9",
  "Back pad on 4": "Encosto na posição 4",
});

/* The exercise note the lifter types in the note scenarios, in the frame's language. */
const LIFTER_EXERCISE_NOTE = Object.freeze({
  en: "Seat 4, pin 3. Wide grip and pause at the bottom of each rep.",
  pt: "Banco na 4, pino 3. Pegada aberta e pausa embaixo em cada repetição.",
});
export function lifterExerciseNote(lang) {
  return LIFTER_EXERCISE_NOTE[lang] || LIFTER_EXERCISE_NOTE.en;
}

/**
 * What a Portuguese lifter's device holds for the same program. The design
 * fixtures keep the review page's English labels on real library movements,
 * which the app reads as the lifter's own English renames. A Portuguese lifter
 * who picked those movements has the library's own names stored, and the app
 * shows their Portuguese names. Custom exercises and every id stay as they
 * are; only exact stored strings are replaced.
 */
export function portugueseLifterState(state) {
  const names = new Map(Object.entries(PORTUGUESE_LIFTER_TEXT));
  const rename = (id, labels) => {
    const entry = LIBRARY_BY_ID.get(String(id ?? ""));
    if (entry) for (const label of labels) if (label && label !== entry.name) names.set(label, entry.name);
  };
  for (const row of state.program || []) rename(row.libraryId, [row.name, row.displayName]);
  // A swapped set keeps its template's name beside the movement performed.
  for (const row of state.log || []) rename(row.performedLibraryId, row.name === row.performedName ? [row.name] : [row.performedName]);
  const replace = (value) => {
    if (typeof value === "string") return names.has(value) ? names.get(value) : value;
    if (Array.isArray(value)) return value.map(replace);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replace(item)]));
    return value;
  };
  const { settings, ...data } = state;
  return { settings, ...replace(data) };
}
