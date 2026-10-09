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
import { metricLogRow } from "../../test/fixtures/history-metric-rows.mjs";

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
    },
    programMeta, program, log, programHistory: [], customExercises, _storageRevision: 40,
  };
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
