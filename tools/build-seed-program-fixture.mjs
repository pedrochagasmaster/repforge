// Generates test/fixtures/seed-program-v067.json, the ready-to-log program the
// browser suites install, through the app's own Build definition and durable
// projection. Each familiar seed name is the display alias of a real catalog
// movement with a Weight + Reps composition, so suites keep their names while
// the program carries canonical identity.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAppRuntime } from "./app-runtime-harness.mjs";

const { manualProgramDefinitionFromRows, durableProgramRows, normalizeLoaded, catalogSnapshot, ROOT } =
  await loadAppRuntime(["manualProgramDefinitionFromRows", "durableProgramRows", "normalizeLoaded"]);

// [day, order, seed name, catalog movement]
const ROWS = [
  ["Day 1", 1, "Hack squat", "Hack squat"],
  ["Day 1", 2, "Seated leg curl", "Seated hamstring curl"],
  ["Day 1", 3, "Incline chest press", "Low incline Smith machine press"],
  ["Day 1", 4, "Chest supported row", "Chest-supported neutral grip T-bar row"],
  ["Day 1", 5, "Machine lateral raise", "Band lateral raise"],
  ["Day 1", 6, "Hip adduction machine", "Seated machine hip adduction"],
  ["Day 2", 1, "Leg press", "45° leg press"],
  ["Day 2", 2, "Romanian deadlift", "Barbell Romanian deadlift"],
  ["Day 2", 3, "Machine shoulder press", "Pin-loaded machine shoulder press"],
  ["Day 2", 4, "Neutral grip pulldown", "Neutral grip pin-loaded machine lat pulldown"],
  ["Day 2", 5, "Pec deck", "Pec deck fly"],
  ["Day 2", 6, "Machine preacher curl", "Pin-loaded machine preacher curl"],
  ["Day 3", 1, "Leg extension", "Leg extension"],
  ["Day 3", 2, "Lying leg curl", "Lying hamstring curl"],
  ["Day 3", 3, "Machine chest dip", "Seated pin-loaded machine chest dip"],
  ["Day 3", 4, "Plate loaded high row", "Cable rope high row"],
  ["Day 3", 5, "Reverse pec deck", "Overhand grip machine rear delt fly"],
  ["Day 3", 6, "Cable pressdown", "Cable straight bar triceps pushdown"],
];
const byName = new Map(catalogSnapshot.exercises.map((entry) => [entry.name, entry]));
const rows = ROWS.map(([day, order, name, movement], index) => {
  const entry = byName.get(movement);
  if (!entry) throw new Error(`catalog has no movement named ${movement}`);
  return { id: `seed-ex-${index + 1}`, day, order, name, displayName: name, libraryId: entry.id,
    sets: 2, min: 4, max: 8, notes: "" };
});
const definition = manualProgramDefinitionFromRows(rows, ["Day 1", "Day 2", "Day 3"], []);
if (!definition) throw new Error("the app rejected the seed program definition");
const programMeta = {
  id: "seed-program", name: "Seed program", started: null,
  created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z",
  goal: null, experience: null, daysPerWeek: 3, splitType: null, equipment: [], priorityMuscles: [],
  sessionLength: null, mesocycleLengthWeeks: definition.cycles, mesocycleStatus: "active", completedAt: null,
  onboarded: true, progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
  programStructure: null, entrySource: null, programDefinition: definition,
};
const program = durableProgramRows(definition, [], programMeta);
const normalized = normalizeLoaded({ settings: {}, programMeta, program, log: [], programHistory: [], customExercises: [] });
if (JSON.stringify(normalized.programMeta.programDefinition) !== JSON.stringify(definition))
  throw new Error("normalization changed the seed definition");
const fixture = { program: normalized.program, programMeta: normalized.programMeta };
writeFileSync(join(ROOT, "test/fixtures/seed-program-v067.json"), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`seed program regenerated: ${fixture.program.length} rows, ${definition.cycles} cycles`);
