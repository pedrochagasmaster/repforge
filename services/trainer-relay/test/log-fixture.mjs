// A realistic saved log for the four-day, seven-week program: one session per
// training day per week, one row per prescribed set, shaped as
// workout-draft.js toHistoryRows writes them (metric fields, loading context,
// session body weight, exercise and session notes). Deterministic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./local-relay.mjs";

const SESSION_NOTES = [
  "",
  "Dormi mal, treino mais pesado que o normal.",
  "Joelho direito incomodou um pouco no agachamento, reduzi a carga na última série.",
  "",
  "Ótimo treino, senti boa recuperação.",
  "Academia cheia, troquei a ordem de dois exercícios.",
];
const EXERCISE_NOTES = ["Pegada fechada", "Banco no 3", "Pausa de 1 s embaixo", "Usar cinto a partir da 2ª série"];

let names;
function catalogNames() {
  if (!names) {
    const source = JSON.parse(readFileSync(join(ROOT, "plans/067/data/app_file.json"), "utf8"));
    names = new Map(source.exercises.map((entry) => [entry.id, entry.name || entry.id]));
  }
  return names;
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Rows for `weeks` weeks of the program, starting at `start`, tagged with
 * `blockId`. Body weight is recorded on every session, as a lifter who weighs
 * in each time would.
 */
export function logRows(definition, { weeks, blockId, start = "2026-09-07T18:00:00.000Z", seed = 86, sessionPrefix = "s" }) {
  const random = rng(seed);
  const exerciseNames = catalogNames();
  const rows = [];
  const training = definition.days.filter((day) => day.kind === "training");
  let sessionIndex = 0;
  for (let week = 0; week < weeks; week += 1) {
    training.forEach((day, dayIndex) => {
      const completed = new Date(Date.parse(start) + (week * 7 + dayIndex * 2) * 86_400_000 + 75 * 60_000);
      const session = `${sessionPrefix}-${String(sessionIndex).padStart(4, "0")}-${Math.floor(random() * 1e9).toString(36)}`;
      const bodyweight = Math.round((81 + random() * 2) * 10) / 10;
      const notes = SESSION_NOTES[sessionIndex % SESSION_NOTES.length];
      sessionIndex += 1;
      for (const slot of day.slots) {
        const cycle = slot.prescriptionsByCycle.find((entry) => entry.cycleIndex === Math.min(week + 1, slot.prescriptionsByCycle.length))
          || slot.prescriptionsByCycle[0];
        const name = exerciseNames.get(slot.exerciseId) || slot.exerciseId;
        const definitions = slot.metricDefinitions;
        const semantics = definitions.map((metric) => metric.semantic);
        const convention = semantics.includes("assistanceKg") ? "assistance"
          : semantics.includes("loadPerSideKg") ? "per_side"
            : definitions.length === 1 && semantics.includes("reps") ? "bodyweight" : "external";
        const exNote = random() < 0.15 ? EXERCISE_NOTES[Math.floor(random() * EXERCISE_NOTES.length)] : "";
        cycle.sets.forEach((set, setIndex) => {
          const target = set.targets?.reps || set.targets?.repsPerSide || { min: 8, max: 12 };
          const reps = target.min + Math.floor(random() * (target.max - target.min + 1));
          const load = Math.round((20 + random() * 80 + week * 2.5) * 4) / 4;
          const metricValues = definitions.map((metric) => ({
            metricId: metric.id,
            value: /reps/i.test(metric.semantic) ? reps : /kg/i.test(metric.semantic) ? load : Math.round(random() * 60),
            unit: metric.unit ?? null,
          }));
          rows.push({
            session,
            date: completed.toISOString().slice(0, 10),
            day: day.name,
            name,
            exerciseId: `${slot.id}#${session}`,
            set: setIndex + 1,
            setIndex,
            load: semantics.includes("loadKg") ? load : null,
            reps: semantics.includes("reps") ? reps : null,
            rir: set.rir ?? 2,
            notes,
            created: completed.toISOString(),
            effortSource: "rir",
            blockId,
            primary: [],
            secondary: [],
            performedName: name,
            performedPrimary: [],
            performedSecondary: [],
            metricIds: [...slot.metricIds],
            metricDefinitions: structuredClone(definitions),
            metricOrigin: slot.metricOrigin,
            sourceLibraryId: slot.exerciseId,
            metricValues,
            equipmentId: null,
            loadingConvention: convention,
            loadingModel: structuredClone(slot.loadingModel),
            loadingContext: {
              loadingConvention: convention,
              bodyweightKg: bodyweight,
              externalLoadMultiplier: convention === "per_side" ? null : convention === "bodyweight" ? 0 : 1,
              bodyweightCoefficient: slot.loadingModel?.bodyweightCoefficient ?? 0,
              bodyweightContributionEnabled: false,
            },
            performedLibraryId: slot.exerciseId,
            ...(exNote ? { exNote } : {}),
            bodyweight,
          });
        });
      }
    });
  }
  return rows;
}
