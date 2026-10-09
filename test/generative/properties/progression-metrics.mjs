/** Current adaptive progression properties use ordered source metric IDs and actual performed-value records. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { stableStringify } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { CATALOG_SNAPSHOT, Metrics, Progression } = domain;

function contextConvention(definitions) {
  const semantics = definitions.map((metric) => metric.semantic);
  if (semantics.some((semantic) => semantic === "loadPerSideKg" || semantic === "persistentLoadPerSideKg")) return "per_side";
  if (semantics.includes("assistanceKg")) return "assistance";
  if (semantics.includes("loadKg")) return "external";
  return "bodyweight";
}

function valuesFor(definitions) {
  return definitions.map((definition) => {
    const value = definition.semantic === "reps" || definition.semantic === "repsPerSide" ? 8
      : definition.semantic.startsWith("duration") ? 30
        : definition.semantic.startsWith("distance") ? 100
          : definition.semantic === "assistanceKg" ? 10 : 50;
    return { metricId: definition.id, value, unit: definition.unit };
  });
}

function targetFor(definitions) {
  const targets = {};
  for (const definition of definitions) {
    const semantic = definition.semantic;
    if (semantic === "reps" || semantic === "repsPerSide") targets[semantic] = { min: 6, max: 10 };
    else if (semantic.startsWith("duration")) targets[semantic] = { min: 20, max: 60 };
    else if (semantic.startsWith("distance")) targets[semantic] = { min: 50, max: 250 };
    else targets[semantic] = { min: 5, max: 100 };
  }
  return targets;
}

function fixtureFor(exercise) {
  const metricIds = [...(exercise.exerciseMetrics || [])];
  const definitions = Metrics.definitionsForIds(metricIds);
  if (!definitions.ok) throw new Error(`raw source ${exercise.id} has invalid metrics: ${definitions.issues.join("; ")}`);
  const coefficient = Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null;
  const convention = contextConvention(definitions.value);
  const slotId = `slot-${exercise.id}`;
  const prescription = {
    id: `${slotId}:c1:s1`,
    slotId,
    cycleIndex: 1,
    setIndex: 1,
    exerciseId: exercise.id,
    role: "manual",
    metricType: "source_metrics@1",
    metricIds,
    metricDefinitions: structuredClone(definitions.value),
    targets: targetFor(definitions.value),
    rir: definitions.value.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide") ? 2 : null,
    restSeconds: 120,
    status: metricIds.length ? "ready" : "configuration_required",
    loadingModel: { bodyweightCoefficient: coefficient },
  };
  const capturedContext = {
    loadingConvention: convention,
    bodyweightCoefficient: coefficient,
    bodyweightContributionEnabled: coefficient > 0,
    ...(coefficient > 0 ? { bodyweightKg: 80 } : {}),
    externalLoadMultiplier: convention === "per_side" ? 2 : 1,
  };
  const performedSet = {
    exerciseId: exercise.id,
    completed: true,
    setIndex: 0,
    rir: 2,
    equipmentId: `equipment-${exercise.id}`,
    loadingConvention: convention,
    loadingContext: structuredClone(capturedContext),
    metricIds: [...metricIds],
    metricValues: valuesFor(definitions.value),
  };
  const loadingContext = {
    bySlotId: {
      [slotId]: {
        equipmentId: performedSet.equipmentId,
        availableLoadsKg: [0, 5, 10, 20, 50, 100],
        loadingConvention: convention,
        bodyweightContributionEnabled: capturedContext.bodyweightContributionEnabled,
        ...(coefficient > 0 ? { bodyweightKg: 80 } : {}),
        externalLoadMultiplier: capturedContext.externalLoadMultiplier,
      },
    },
  };
  return {
    prescription,
    history: [{ sessionId: `session-${exercise.id}`, completed: true, sets: [performedSet] }],
    currentSession: [],
    loadingContext,
    settings: { expandRepRange: true, weightMatch: false },
    definitions: definitions.value,
    coefficient,
  };
}

const exerciseArbitrary = fc.constantFrom(...CATALOG_SNAPSHOT.exercises);
const nullCoefficientExercises = CATALOG_SNAPSHOT.exercises.filter((exercise) => {
  if (Number.isFinite(exercise.bodyweight)) return false;
  const definitions = Metrics.definitionsForIds(exercise.exerciseMetrics || []);
  return definitions.ok && definitions.value.some((metric) => metric.semantic === "loadKg")
    && definitions.value.some((metric) => metric.semantic === "reps");
});
if (!nullCoefficientExercises.length) throw new Error("raw catalog needs examples with unknown bodyweight coefficients");

function assertNoInventedMetrics(definitions, result) {
  const allowed = new Set(definitions.map((definition) => definition.semantic));
  allowed.add("rir");
  for (const key of Object.keys(result.targets || {})) if (!allowed.has(key)) {
    throw new Error(`progression invented ${key} outside the source metric composition`);
  }
  const hasRep = definitions.some((definition) => definition.semantic === "reps" || definition.semantic === "repsPerSide");
  const hasLoad = definitions.some((definition) => ["loadKg", "assistanceKg", "loadPerSideKg", "persistentLoadPerSideKg"].includes(definition.semantic));
  const onlyTimeDistance = definitions.length > 0 && !hasRep && !hasLoad
    && definitions.every((definition) => definition.semantic.startsWith("duration") || definition.semantic.startsWith("distance"));
  if (onlyTimeDistance && ["loadKg", "assistanceKg", "loadPerSideKg", "persistentLoadPerSideKg", "reps", "repsPerSide"].some((key) => Object.hasOwn(result.targets || {}, key))) {
    throw new Error("time/distance-only movement received an invented load or repetition target");
  }
}

export function buildSuites() {
  return [
    {
      name: "progression metrics: real source compositions return deterministic outcomes without mutating actuals",
      property: fc.property(exerciseArbitrary, (exercise) => {
        const fixture = fixtureFor(exercise);
        const inputs = [
          [fixture.prescription],
          fixture.history,
          fixture.currentSession,
          fixture.loadingContext,
          fixture.settings,
        ];
        const before = stableStringify(inputs);
        const first = Progression.recommendSets(...inputs);
        const second = Progression.recommendSets(...structuredClone(inputs));
        if (stableStringify(inputs) !== before) throw new Error("progression mutated a source prescription, metric actual, or loading snapshot");
        if (first.length !== 1 || second.length !== 1) throw new Error("one source prescription did not return one result");
        if (stableStringify(first) !== stableStringify(second)) throw new Error("same metric evidence changed recommendation");
        if (!["recommended", "manual", "configuration_required", "invalid"].includes(first[0].status)) {
          throw new Error(`unknown progression status ${first[0].status}`);
        }
        if (first[0].status === "invalid") throw new Error(`canonical source fixture was invalid: ${first[0].reasonCodes}`);
        assertNoInventedMetrics(fixture.definitions, first[0]);
      }),
    },
    {
      name: "progression metrics: unknown raw bodyweight coefficients stay configuration-required",
      property: fc.property(fc.constantFrom(...nullCoefficientExercises), (exercise) => {
        const fixture = fixtureFor(exercise);
        if (fixture.coefficient !== null) throw new Error("null-source fixture unexpectedly acquired a coefficient");
        const result = Progression.recommendSets(
          [fixture.prescription], fixture.history, fixture.currentSession, fixture.loadingContext, fixture.settings,
        )[0];
        if (result.status !== "configuration_required" || !result.reasonCodes.includes("configuration_required")) {
          throw new Error(`unknown coefficient was not safely refused: ${result.status}/${result.reasonCodes}`);
        }
      }),
    },
  ];
}
