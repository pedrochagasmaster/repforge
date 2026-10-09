// Generates test/fixtures/landing-proof.json: a canonical generated program
// (Plan 067 ProgramDefinition) whose Focus screen recommends the exact
// numbers the landing's own `landingEvaluate` (app.js) computes for its "add"
// outcome case, so tools/capture-landing-proof.mjs can prove the landing's
// claims against the real app instead of a legacy flat-row fixture.
//
// Why a generated program at all: app.js `recommendation()` only calls the
// adaptive engine (RepForgeProgression.recommendSets) when a prescription's
// `status` is "ready"; Build/manual programs carry "manual" prescriptions and
// never get a suggested load (Plan 067 brief). So this program is produced by
// the real compiler (Compiler.generateProgram), then one slot's identity and
// prescriptions are overridden to the landing's bench case so the numbers the
// real engine returns for the real app equal `landingEvaluate(LANDING_CASES.add)`.
//
// BENCH_ID, the rep range, RIR and logged sets below are copied from
// LANDING_CASES.add in app.js; keep them in sync if that case changes.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAppRuntime } from "./app-runtime-harness.mjs";
import { metricLogRow } from "../test/fixtures/history-metric-rows.mjs";

const BENCH_ID = "19f5c6f170d8808bb424e98de4472a7e"; // LANDING_CASES.add.ex
const REP_MIN = 8, REP_MAX = 10; // LANDING_CASES.add.{repMin,repMax}
const RIR_TARGET = 1; // the landing's hand-built prescription's rir
const SETS = 3; // LANDING_CASES.add.sets
const LOGGED = [[60, 10, 2], [60, 10, 2], [60, 10, 2]]; // LANDING_CASES.add.logged

const { Compiler, canonicalProgramDefinition, durableProgramRows, normalizeLoaded, catalogSnapshot, ROOT } =
  await loadAppRuntime(["canonicalProgramDefinition", "durableProgramRows", "normalizeLoaded"]);

const DATA = join(ROOT, "plans/067/data");
const gym = JSON.parse(readFileSync(join(DATA, "gym.json"), "utf8"));
const observations = JSON.parse(readFileSync(join(DATA, "programs.json"), "utf8"));
const appFile = JSON.parse(readFileSync(join(DATA, "app_file.json"), "utf8"));
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];

const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...appFile.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [BENCH_ID], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 6, deloadCycles: [],
};

const generated = Compiler.generateProgram(REQUEST, catalogSnapshot, "landing-proof-067");
if (!generated.ok) throw new Error(`generation failed: ${JSON.stringify(generated.conflicts || generated)}`);
const definition = generated.value;

// Pick the first training day, and within it a weighted (Weight + Reps) slot
// to become the landing's bench. `excludedExerciseIds` above keeps the real
// bench out of the generated selection, so no other slot can collide with it.
const day = definition.days.find((entry) => entry.kind === "training");
if (!day) throw new Error("no training day in the generated program");
const benchMetrics = catalogSnapshot.exercises.find((entry) => entry.id === BENCH_ID)?.exerciseMetrics;
if (!Array.isArray(benchMetrics) || benchMetrics.length !== 2) throw new Error("bench exercise metrics missing from the catalog");
const slot = day.slots.find((entry) => JSON.stringify(entry.metricIds) === JSON.stringify(benchMetrics)
  && (entry.loadingModel?.bodyweightCoefficient ?? 0) >= 0 && entry.prescriptionsByCycle?.[0]?.sets?.length >= 1);
if (!slot) throw new Error("no weighted slot available to become the landing's bench movement in the first training day");

// Keep only the chosen slot on this day, at order 1, and give the day a
// short name: Focus's day header reads "<day name> · exercise 1 of N", and
// English and Portuguese must wrap the same way at this frame width (the
// capture asserts every hotspot is identical across languages) or every
// hotspot below the header shifts by a line height between captures. A
// generated split name ("Upper A") plus the longer Portuguese phrasing
// ("exercício" vs "exercise") was just long enough to wrap in Portuguese
// only; neither the day name nor the exercise count is part of what this
// fixture proves, so both are trimmed to the shortest safe form instead of
// chasing exact pixel budgets per language.
day.name = "Day 1";
day.slots = [slot];
slot.order = 1;

slot.exerciseId = BENCH_ID;
slot.sourceExerciseIds = [BENCH_ID];
delete slot.displayName;
slot.metricOrigin = "source_catalog";
slot.metricIds = [...benchMetrics];
// metricDefinitions must mirror the slot's own prior shape (id/sourceName/semantic/unit per metric);
// reuse the already-generated canonical definitions for the same universal metric IDs.
const catalogExerciseWithSameMetrics = definition.days.flatMap((d) => d.slots)
  .find((entry) => JSON.stringify(entry.metricIds) === JSON.stringify(benchMetrics) && entry !== slot);
if (!catalogExerciseWithSameMetrics) throw new Error("no other generated slot shares the bench's metric composition to copy canonical metric definitions from");
slot.metricDefinitions = catalogExerciseWithSameMetrics.metricDefinitions.map((entry) => ({ ...entry }));
const benchExercise = catalogSnapshot.exercises.find((entry) => entry.id === BENCH_ID);
slot.loadingModel = { bodyweightCoefficient: benchExercise.bodyweight ?? 0, assistanceDirection: null };

for (const cycle of slot.prescriptionsByCycle) {
  cycle.sets = Array.from({ length: SETS }, (_, index) => ({
    id: `${slot.id}:cycle-${cycle.cycleIndex}:set-${index + 1}`,
    cycleIndex: cycle.cycleIndex, setIndex: index + 1,
    metricType: "source_metrics@1", metricIds: [...slot.metricIds], metricDefinitions: slot.metricDefinitions.map((entry) => ({ ...entry })),
    targets: { reps: { min: REP_MIN, max: REP_MAX } }, rir: RIR_TARGET, restSeconds: 120, status: "ready",
    provenance: { source: "landing-proof-fixture", policyVersion: "1" },
  }));
}

const checkedDefinitions = Compiler.validateProgramDefinition(definition, catalogSnapshot, []);
if (!checkedDefinitions.ok) throw new Error(`mutated definition fails validation: ${checkedDefinitions.issues.join("; ")}`);
const canonical = canonicalProgramDefinition(definition, []);
if (!canonical) throw new Error("canonicalProgramDefinition rejected the mutated definition");

const programMeta = {
  id: "landing-proof-program", name: "Landing proof program", started: "2026-08-10",
  created: "2026-07-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z",
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: definition.days.filter((d) => d.kind === "training").length,
  splitType: null, equipment: [], priorityMuscles: [], sessionLength: "60",
  mesocycleLengthWeeks: definition.cycles, mesocycleStatus: "active", completedAt: null,
  onboarded: true, progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
  programStructure: null, entrySource: null, blockPromptDismissedId: null, programDefinition: canonical,
};
const program = durableProgramRows(canonical, [], programMeta);
const row = program.find((entry) => entry.id === slot.id);
if (!row) throw new Error("the bench slot produced no durable program row");

const log = LOGGED.flatMap(([load, reps, rir], index) => [
  metricLogRow(programMeta, row, {
    session: "2026-08-28_landing", date: "2026-08-28", day: row.day, set: index + 1, load, reps, rir,
  }),
]);

const settings = {
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
  unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
};

const fixture = { settings, programMeta, program, log, programHistory: [], customExercises: [], _storageRevision: 1 };
const normalized = normalizeLoaded(JSON.parse(JSON.stringify(fixture)));
if (JSON.stringify(normalized.programMeta.programDefinition) !== JSON.stringify(canonical))
  throw new Error("normalization changed the mutated program definition");
if (JSON.stringify(normalized.program) !== JSON.stringify(program))
  throw new Error("normalization changed the durable program rows");
if (normalized.log.length !== log.length) throw new Error("normalization dropped or added log rows");

writeFileSync(join(ROOT, "test/fixtures/landing-proof.json"), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`landing-proof fixture regenerated: bench slot ${slot.id} on ${row.day}, ${SETS} sets, ${log.length} log rows`);
