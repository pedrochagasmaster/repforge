/**
 * Seeded storage fixtures for the UI screen catalog.
 *
 * `catalogState` is the designer program: three days, real logged sessions and
 * a progression strategy, so Progress/History/PR surfaces have something true
 * to draw. The entry fixtures stay deliberately minimal — onboarding evidence
 * must not depend on a rich program that the flow itself has not created yet.
 *
 * Session dates are measured back from the pinned capture clock, never from
 * the real one. History, Progress and Today all render dates, so a fixture
 * built from `new Date()` would produce a different catalog every day and the
 * drift gate would fail on any day but the one the evidence was captured.
 */
import { CAPTURE_NOW } from "./session.mjs";

function isoDaysAgo(n) {
  const d = new Date(Date.parse(CAPTURE_NOW));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function catalogState() {
  const program = [
    { id: "ex-sq", day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 4, max: 8, primary: "Quads", secondary: "Glutes,Hamstrings", notes: "", alternates: [], libraryId: "sq_bb",
      progression: { schemaVersion: 1, strategy: { id: "rep_goal", version: 1, params: {
        workingSets: 3, repGoal: 18, repFloor: 4, repCeiling: 8,
        targetRirMin: 1, targetRirMax: 3, minLoadIncrement: 2.5,
        jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
      } }, modifiers: [] } },
    { id: "ex-curl", day: "Day 1", order: 2, name: "Seated leg curl", sets: 2, min: 6, max: 10, primary: "Hamstrings", secondary: "", notes: "", alternates: [] },
    { id: "ex-bench", day: "Day 1", order: 3, name: "Barbell bench press", sets: 3, min: 4, max: 8, primary: "Chest", secondary: "Triceps,Front delts", notes: "Pause on the chest.", alternates: [], libraryId: "pr_bb" },
    { id: "ex-row", day: "Day 1", order: 4, name: "Chest-supported row", sets: 2, min: 6, max: 10, primary: "Mid/upper back", secondary: "Lats,Rear delts,Biceps", notes: "", alternates: [] },
    { id: "ex-lat", day: "Day 1", order: 5, name: "Machine lateral raise", sets: 2, min: 8, max: 12, primary: "Side delts", secondary: "", notes: "", alternates: [] },
    { id: "ex-pd", day: "Day 2", order: 1, name: "Assisted pull-up", sets: 3, min: 4, max: 8, primary: "Lats", secondary: "Biceps,Forearms", notes: "", alternates: [], libraryId: "pd_bw" },
    { id: "ex-rdl", day: "Day 2", order: 2, name: "Barbell deadlift", sets: 2, min: 3, max: 6, primary: "Hamstrings,Glutes", secondary: "Spinal erectors", notes: "", alternates: [], libraryId: "dl_bb" },
    { id: "ex-ohp", day: "Day 2", order: 3, name: "Machine shoulder press", sets: 2, min: 6, max: 10, primary: "Front delts", secondary: "Side delts,Triceps", notes: "", alternates: [] },
    { id: "ex-curl2", day: "Day 2", order: 4, name: "Barbell curl", sets: 2, min: 8, max: 12, primary: "Biceps", secondary: "Forearms", notes: "", alternates: [], libraryId: "cu_bb" },
    { id: "ex-ext", day: "Day 3", order: 1, name: "Leg extension", sets: 2, min: 8, max: 12, primary: "Quads", secondary: "", notes: "", alternates: [] },
    { id: "ex-fly", day: "Day 3", order: 2, name: "Pec deck", sets: 2, min: 8, max: 12, primary: "Chest", secondary: "", notes: "", alternates: [] },
    { id: "ex-press", day: "Day 3", order: 3, name: "Cable pressdown", sets: 2, min: 8, max: 12, primary: "Triceps", secondary: "", notes: "", alternates: [] },
  ];
  const log = [];
  const pushSession = (day, date, loads) => {
    const session = `${date}_${day}_catalog`;
    program.filter((e) => e.day === day).forEach((ex, i) => {
      const load = loads[i] ?? 60;
      for (let set = 1; set <= Math.min(ex.sets, 2); set++) {
        log.push({
          session, date, day, name: ex.name, exerciseId: ex.id, set,
          load, reps: ex.min + 2, rir: 1, notes: "", created: `${date}T12:00:00.000Z`,
          primary: ex.primary, secondary: ex.secondary,
          performedLibraryId: ex.libraryId || undefined,
        });
      }
    });
  };
  pushSession("Day 1", isoDaysAgo(10), [100, 45, 70, 55, 12]);
  pushSession("Day 2", isoDaysAgo(8), [40, 120, 40, 30]);
  pushSession("Day 3", isoDaysAgo(6), [50, 40, 35]);
  pushSession("Day 1", isoDaysAgo(3), [105, 47.5, 72.5, 57.5, 12.5]);
  pushSession("Day 2", isoDaysAgo(1), [42.5, 125, 42.5, 32.5]);

  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "catalog-program", name: "Designer catalog", started: isoDaysAgo(21),
      created: "2026-07-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3,
      splitType: "full_body", equipment: ["barbell", "machines", "cables"],
      priorityMuscles: ["Quads", "Chest"], sessionLength: "60", completedAt: null,
    },
    program, log, programHistory: [], customExercises: [], _storageRevision: 40,
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
      id: "catalog-active", name: lang === "pt" ? "Programa atual" : "Current program",
      started: "2026-08-01", created: "2026-08-01T00:00:00.000Z",
      updated: "2026-08-01T00:00:00.000Z", onboarded: true, daysPerWeek: 3,
      splitType: "full_body", equipment: ["machines"], goal: "hypertrophy",
      experience: "intermediate", sessionLength: "60",
    },
    program: [{
      id: "catalog-active-1", day: "Day 1", order: 1, name: "Cable row", sets: 3,
      min: 8, max: 12, primary: "Back", secondary: "Biceps", notes: "", libraryId: "row_cable",
    }],
    _storageRevision: 3,
  };
}

export function localeState(state, lang) {
  return { ...state, settings: { ...state.settings, lang } };
}
