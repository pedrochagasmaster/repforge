import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const SharedSetup = require("../shared-setup.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");
const BUILT_IN_IDS = new Set(EXERCISE_LIBRARY.map((entry) => entry.id));

const compiled = Compiler.compile({
  schemaVersion: 1,
  familyId: "balanced",
  frequency: 2,
  sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
}, EXERCISE_LIBRARY);
assert.equal(compiled.kind, "compiled");

const payload = {
  kind: SharedSetup.KIND,
  version: SharedSetup.VERSION,
  program: {
    meta: {
      name: "Balanced 2",
      goal: "strength_hypertrophy",
      experience: "intermediate",
      daysPerWeek: 2,
      splitType: "full_body",
      equipment: ["barbells", "dumbbells", "machines", "cables"],
      priorityMuscles: [],
      sessionLength: "long",
      mesocycleLengthWeeks: 6,
      progressionRelations: [],
      progressionModifiers: [],
      programStructure: compiled.programStructure,
    },
    exercises: compiled.program.map((exercise) => ({ ...exercise })),
    customExercises: [],
  },
  settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 3, hardRir: 1, restSec: 120, unit: "kg", lang: "en", rirMode: "numeric" },
};

const schemaOptions = { builtInIds: BUILT_IN_IDS };
const validated = SharedSetup.validate(payload, schemaOptions);
assert.equal(validated.ok, true, validated.issues?.join("\n"));
const encoded = await SharedSetup.encode(payload, schemaOptions);
assert.equal(encoded.ok, true, encoded.code);
const decoded = await SharedSetup.decode(encoded.value, schemaOptions);
assert.equal(decoded.ok, true, decoded.code);
assert.deepEqual(decoded.value.program.meta.programStructure, compiled.programStructure, "share preserves day structure and pinned provenance");
assert.deepEqual(decoded.value.program.exercises.map(({ slotId, dayId, loadingMode, loadIncrement }) => ({ slotId, dayId, loadingMode, loadIncrement })),
  compiled.program.map(({ slotId, dayId, loadingMode, loadIncrement }) => ({ slotId, dayId, loadingMode, loadIncrement })), "share preserves slot and loading semantics");

const legacy = compiled.program.map(({ slotId, dayId, ...exercise }) => exercise);
const first = Compiler.migrateLegacyStructure(legacy);
const second = Compiler.migrateLegacyStructure(legacy);
assert.deepEqual(second, first, "legacy migration is deterministic");
const renamed = first.program.map((exercise) => exercise.dayId === first.structure.days[0].dayId ? { ...exercise, day: "Renamed" } : exercise);
const retainedStructure = { ...first.structure, days: first.structure.days.map((day, index) => index ? day : { ...day, label: "Renamed" }) };
const afterRename = Compiler.migrateLegacyStructure(renamed, retainedStructure);
assert.equal(afterRename.structure.days[0].dayId, first.structure.days[0].dayId, "rename preserves day identity");
assert.equal(afterRename.program[0].slotId, first.program[0].slotId, "rename preserves slot identity");

console.log(`PASS compiler persistence: ${encoded.value.slice(0, 3)} ${encoded.value.length} chars, explicit days/provenance and exact loading identity round-trip`);
