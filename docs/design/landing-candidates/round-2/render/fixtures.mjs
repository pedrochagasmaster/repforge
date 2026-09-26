// App states for the round-2 renders. Each state is saved straight into
// localStorage the way tools/landing-prototype/capture.mjs does it, so the
// shipped app draws every pixel and computes every target itself.
//
// The training data mirrors the page: S's three engine cases (engine-cases.mjs)
// and U's six-week block (six-weeks.mjs). Names come from exercises.js.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "../index.html"), "utf8");
const embedded = (name) => JSON.parse(new RegExp("var " + name + " = (\\{.*?\\});/\\*@end").exec(page)[1]);
export const CASES = embedded("CASES");
export const WEEKS = embedded("WEEKS");

// [id, EN, PT, libraryId, sets, min, max, primary, secondary]
const LIFTS = {
  bench: ["ex-bench", "Barbell bench press", "Supino com barra", "pr_bb", 3, 8, 10, "Chest", "Triceps,Front delts"],
  squat: ["ex-squat", "Barbell back squat", "Agachamento livre com barra", "sq_bb", 3, 5, 8, "Quads", "Glutes,Hamstrings,Calves"],
  incline: ["ex-inc", "Dumbbell incline press", "Supino inclinado com halteres", "ip_db", 3, 10, 12, "Chest", "Front delts,Triceps"],
  fly: ["ex-fly", "Cable fly", "Crucifixo na polia", "ci_cb", 3, 12, 15, "Chest", ""],
  pressdown: ["ex-tri", "Cable pressdown", "Tríceps na polia", "tr_cb", 3, 12, 15, "Triceps", ""],
  rdl: ["ex-rdl", "Barbell Romanian deadlift", "Levantamento terra romeno com barra", "hg_bb", 3, 8, 12, "Hamstrings,Glutes", "Spinal erectors"],
  extension: ["ex-ext", "Leg extension", "Cadeira extensora", "le_mc", 3, 10, 15, "Quads", ""],
  curl: ["ex-ham", "Seated leg curl", "Cadeira flexora", "lc_mc", 3, 10, 15, "Hamstrings", ""],
};
// Accessory loads for the logged history, so a session reads like a real one.
const ACCESSORY = { incline: [24, [11, 10, 10], [2, 2, 1]], fly: [15, [14, 13, 12], [2, 2, 1]], pressdown: [25, [13, 13, 12], [2, 1, 1]],
  rdl: [80, [10, 10, 9], [2, 2, 1]], extension: [50, [13, 12, 12], [2, 2, 1]], curl: [40, [13, 12, 12], [2, 2, 1]] };

const settings = (lang) => ({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 150, lastExport: "",
  unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
});

function build(lang, { lead, accessories, sessions, started, name }) {
  const day = lang === "pt" ? "Dia 1" : "Day 1";
  const ids = [lead, ...accessories];
  const program = ids.map((key, i) => {
    const [id, en, pt, libraryId, sets, min, max, primary, secondary] = LIFTS[key];
    return { id, day, order: i + 1, name: lang === "pt" ? pt : en, sets, min, max, primary, secondary, notes: "", alternates: [], libraryId };
  });
  const log = [];
  for (const s of sessions) {
    const session = s.date + "_" + day + "_r2";
    const rows = [[lead, s.sets], ...accessories.map((k) => [k, ACCESSORY[k][1].map((r, j) => [ACCESSORY[k][0], r, ACCESSORY[k][2][j]])])];
    for (const [key, sets] of rows) {
      const [id, en, pt, libraryId, , , , primary, secondary] = LIFTS[key];
      sets.forEach(([load, reps, rir], j) => log.push({
        session, date: s.date, day, name: lang === "pt" ? pt : en, exerciseId: id, set: j + 1, load, reps, rir,
        notes: "", created: s.date + "T18:" + String(10 + log.length % 40).padStart(2, "0") + ":00.000Z", primary, secondary, performedLibraryId: libraryId,
      }));
    }
  }
  return {
    settings: settings(lang),
    programMeta: {
      id: "r2-program", name: name[lang === "pt" ? 0 : 1], started, created: started + "T00:00:00.000Z", updated: started + "T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: "hypertrophy", experience: "intermediate",
      daysPerWeek: 1, splitType: "custom", equipment: ["barbell", "dumbbells", "machines", "cables"], priorityMuscles: [],
      sessionLength: "60", completedAt: null,
    },
    program, log, programHistory: [], customExercises: [], _storageRevision: 12,
  };
}

const CHEST = ["incline", "fly", "pressdown"];
const LEGS = ["rdl", "extension", "curl"];
const NAME = { chest: ["Peito e tríceps", "Chest and triceps"], legs: ["Pernas", "Legs"] };

// One logged session per case, a week before "today".
export const STATES = {
  add: (lang) => build(lang, { lead: CASES.add.ex, accessories: CHEST, name: NAME.chest, started: "2026-08-24",
    sessions: [{ date: "2026-08-24", sets: CASES.add.logged }] }),
  hold: (lang) => build(lang, { lead: CASES.hold.ex, accessories: LEGS, name: NAME.legs, started: "2026-08-24",
    sessions: [{ date: "2026-08-24", sets: CASES.hold.logged }] }),
  reduce: (lang) => build(lang, { lead: CASES.reduce.ex, accessories: CHEST, name: NAME.chest, started: "2026-08-24",
    sessions: [{ date: "2026-08-24", sets: CASES.reduce.logged }] }),
  // U's block: six weekly sessions at the loads the engine chose.
  six: (lang) => build(lang, { lead: "bench", accessories: CHEST, name: NAME.chest, started: "2026-08-03",
    sessions: WEEKS.weeks.map((w, i) => ({ date: ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31", "2026-09-07"][i],
      sets: w.logged.map(([reps, rir]) => [w.load, reps, rir]) })) }),
};
// "Today" for each state: one week after the last logged session.
export const TODAY = { add: "2026-08-31T12:00:00Z", hold: "2026-08-31T12:00:00Z", reduce: "2026-08-31T12:00:00Z", six: "2026-09-14T12:00:00Z" };

export const EMPTY = (lang) => ({
  settings: settings(lang),
  programMeta: { id: "", name: "", started: null, created: null, updated: null, onboarded: false, mesocycleStatus: "active",
    mesocycleLengthWeeks: 6, goal: null, experience: null, daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [],
    sessionLength: null, completedAt: null, progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
    programStructure: null, entrySource: null },
  program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
});

// The coach message the page's hand-off demo shows, and the reply an assistant
// would send back for it (the shape entry.freeform.prompt asks for). The reply
// is authored input, like the logs above; the app's review screen is real.
export const COACH_MESSAGE = {
  pt: "TREINO A · peito e tríceps\nSupino reto 3x8-10\nSupino inclinado halter 3x10-12\nCrucifixo polia 3x12-15\nTríceps polia 3x12-15",
  en: "WORKOUT A · chest and triceps\nBench press 3x8-10\nIncline DB press 3x10-12\nCable fly 3x12-15\nTriceps pushdown 3x12-15",
};
export function assistantReply(lang) {
  const pt = lang === "pt";
  const day = pt ? "Treino A" : "Workout A";
  const rows = pt
    ? [["Supino reto", 3, 8, 10], ["Supino inclinado halter", 3, 10, 12], ["Crucifixo polia", 3, 12, 15], ["Tríceps polia", 3, 12, 15]]
    : [["Bench press", 3, 8, 10], ["Incline DB press", 3, 10, 12], ["Cable fly", 3, 12, 15], ["Triceps pushdown", 3, 12, 15]];
  return JSON.stringify({ version: 3, meta: { name: pt ? "Peito e tríceps" : "Chest and triceps" },
    exercises: rows.map(([name, sets, min, max], i) => ({ day, order: i + 1, name, sets, min, max })), missing: [], notImported: [] });
}
