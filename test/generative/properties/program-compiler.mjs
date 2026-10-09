/** The production ProgramCompiler generates from the exact committed raw UUID snapshot. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { jsonJunkArbitrary } from "../arbitraries/malformed.mjs";
import { stableStringify } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { CATALOG_SNAPSHOT, Compiler, EXERCISES_BY_ID, Metrics, RAW_EQUIPMENT_IDS } = domain;

const movementConfirmations = Object.fromEntries(CATALOG_SNAPSHOT.exercises
  .filter((exercise) => Array.isArray(exercise.preconditions) && exercise.preconditions.length > 0)
  .map((exercise) => [
  exercise.id,
  [...(exercise.preconditions || [])],
]));
const competencyAnswers = Object.freeze({
  pullups10: null,
  pullups5: null,
  pushups15: null,
  inclineBarbell10: null,
  overheadPress10: null,
  bodyweightDips10: null,
  benchPress10: null,
});

const requestArbitrary = fc.record({
  goal: fc.constantFrom(...Compiler.GOALS),
  experience: fc.constantFrom(...Compiler.EXPERIENCES),
  daysPerWeek: fc.integer({ min: 3, max: 6 }),
  timeCeilingMinutes: fc.constantFrom(...Compiler.TIME_CEILINGS.filter((minutes) => minutes >= 40 && minutes <= 120)),
  cycles: fc.integer({ min: 1, max: 12 }),
  seed: fc.integer({ min: 0, max: 0xffffffff }),
  requestDeload: fc.boolean(),
}).map(({ goal, experience, daysPerWeek, timeCeilingMinutes, cycles, seed, requestDeload }) => ({
  seed: String(seed),
  request: {
    goal,
    experience,
    daysPerWeek,
    timeCeilingMinutes,
    gymProfile: { equipmentIds: [...RAW_EQUIPMENT_IDS] },
    competencyAnswers: { ...competencyAnswers },
    movementConfirmations,
    emphasisMuscleIds: [],
    deprioritizedMuscleIds: [],
    excludedExerciseIds: [],
    excludedMuscleIds: [],
    preferredExerciseIds: [],
    split: "auto",
    periodization: "static",
    cycles,
    deloadCycles: requestDeload ? [Math.max(1, Math.ceil(cycles / 2))] : [],
  },
}));

function assertSourceIdentity(program) {
  if (!Array.isArray(program.days) || program.days.length !== 7) throw new Error("compiler did not return a seven-day definition");
  for (const day of program.days) for (const slot of day.slots || []) {
    const exercise = EXERCISES_BY_ID.get(slot.exerciseId);
    if (!exercise) throw new Error(`compiler selected unknown raw UUID ${slot.exerciseId}`);
    if (!slot.sourceExerciseIds.includes(slot.exerciseId)) throw new Error(`slot source IDs lost selected UUID ${slot.exerciseId}`);
    if (JSON.stringify(slot.metricIds) !== JSON.stringify(exercise.exerciseMetrics || [])) {
      throw new Error(`slot metric IDs drifted from source composition ${slot.exerciseId}`);
    }
    const definitions = Metrics.definitionsForIds(slot.metricIds);
    if (!definitions.ok || stableStringify(definitions.value) !== stableStringify(slot.metricDefinitions)) {
      throw new Error(`slot metric definitions are not canonical for ${slot.exerciseId}`);
    }
    const coefficient = Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null;
    if (slot.loadingModel?.bodyweightCoefficient !== coefficient) {
      throw new Error(`unknown or captured source bodyweight coefficient changed for ${slot.exerciseId}`);
    }
    for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
      // Schema v2: a generated set stores no metric composition of its own —
      // its slot owns metricIds/metricDefinitions, and prescriptionsForCycle
      // is the one place that materializes them back for engine/app consumers.
      if (Object.hasOwn(set, "metricIds") || Object.hasOwn(set, "metricDefinitions")) {
        throw new Error(`generated set stores its own metric composition ${slot.exerciseId}`);
      }
      if (Object.hasOwn(set, "actual") || Object.hasOwn(set, "metricValues") || Object.hasOwn(set, "performedValues")) {
        throw new Error("compiler put performed data in a prescription");
      }
    }
    for (const projected of Compiler.prescriptionsForCycle(program, 1).filter((item) => item.slotId === slot.id)) {
      if (JSON.stringify(projected.metricIds) !== JSON.stringify(slot.metricIds)
        || stableStringify(projected.metricDefinitions) !== stableStringify(slot.metricDefinitions)) {
        throw new Error(`prescriptionsForCycle lost ordered slot metric identity ${slot.exerciseId}`);
      }
    }
  }
}

export function buildSuites() {
  return [
    {
      name: "program compiler: generated requests replay deterministically against the raw UUID catalog",
      property: fc.property(requestArbitrary, ({ request, seed }) => {
        const before = stableStringify(request);
        const first = Compiler.generateProgram(request, CATALOG_SNAPSHOT, seed);
        const second = Compiler.generateProgram(structuredClone(request), CATALOG_SNAPSHOT, seed);
        if (!first || typeof first.ok !== "boolean") throw new Error("compiler omitted its typed result");
        if (!first.ok) throw new Error(`feasible generated request conflicted: ${stableStringify(first.conflicts).slice(0, 600)}`);
        if (!second.ok) throw new Error(`replayed request conflicted: ${stableStringify(second.conflicts).slice(0, 600)}`);
        if (stableStringify(first.value) !== stableStringify(second.value)) throw new Error("same request and seed changed ProgramDefinition");
        if (stableStringify(request) !== before) throw new Error("compiler mutated its request");
        const checked = Compiler.validateProgramDefinition(first.value, CATALOG_SNAPSHOT);
        if (!checked.ok) throw new Error(`generated ProgramDefinition did not validate: ${checked.issues.join("; ")}`);
        assertSourceIdentity(first.value);
      }),
    },
    {
      name: "program compiler: arbitrary JSON requests fail with typed results instead of throwing",
      property: fc.property(jsonJunkArbitrary(), (request) => {
        let result;
        try { result = Compiler.generateProgram(request, CATALOG_SNAPSHOT, "hostile-json"); }
        catch (error) { throw new Error(`compiler threw on a JSON request: ${error.message}`); }
        if (!result || typeof result.ok !== "boolean") throw new Error("compiler returned an untyped result");
        if (result.ok) {
          const checked = Compiler.validateProgramDefinition(result.value, CATALOG_SNAPSHOT);
          if (!checked.ok) throw new Error(`accepted generation result failed canonical validation: ${checked.issues.join("; ")}`);
          assertSourceIdentity(result.value);
        } else if (!Array.isArray(result.conflicts)) throw new Error("compiler rejection omitted conflicts");
      }),
    },
  ];
}
