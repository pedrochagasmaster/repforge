/**
 * Small, valid v4 setup documents built from the committed raw UUID catalog.
 * The compiler in the domain adapter is the ProgramDefinition schema owner.
 */
import fc from "fast-check";
import { intIn } from "./numbers.mjs";
import { loadDomain } from "../adapters/domain-adapter.mjs";

const domain = loadDomain();
const { BUILT_IN_ID_LIST, CATALOG_SNAPSHOT, Compiler, EXERCISES_BY_ID, Metrics } = domain;

const LOAD_ID = Metrics.DEFINITIONS.find((metric) => metric.semantic === "loadKg")?.id;
const REPS_ID = Metrics.DEFINITIONS.find((metric) => metric.semantic === "reps")?.id;
const LOAD_REPS_IDS = Object.freeze([LOAD_ID, REPS_ID]);

/** Unicode-rich text. Lone surrogates are excluded so JSON round trips stay exact. */
export function text(maxLength = 24) {
  const codePoint = fc.oneof(
    { weight: 5, arbitrary: fc.integer({ min: 0x20, max: 0x7e }) },
    { weight: 2, arbitrary: fc.integer({ min: 0xa1, max: 0x2027 }).filter((cp) => cp < 0xd800 || cp > 0xdfff) },
    { weight: 1, arbitrary: fc.constantFrom(0x4e16, 0x5f3a, 0x2026, 0x2014, 0x1f3cb, 0x27bf, 0x00e7, 0x00e3) },
  );
  return fc.array(codePoint, { minLength: 0, maxLength }).map((cps) => String.fromCodePoint(...cps));
}

export function nameText(maxLength = 40) {
  return fc.oneof(
    { weight: 7, arbitrary: text(Math.min(maxLength, 24)).filter((value) => value.trim().length > 0 && [...value.trim()].length <= maxLength) },
    { weight: 1, arbitrary: text(Math.max(1, Math.floor(maxLength / 3))).map((value) => `  ${value}`).filter((value) => value.trim().length > 0) },
    { weight: 1, arbitrary: fc.constantFrom("A", "Leg day", "Dia de perna", "Back & Biceps") },
  );
}

function settingsArbitrary() {
  return fc.record({
    jumpPct: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    minJump: fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true }),
    rirHigh: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    hardRir: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    restSec: intIn(0, 86400),
    unit: fc.constantFrom("kg", "lb"),
    lang: fc.constantFrom("en", "pt"),
    rirMode: fc.constantFrom("numeric", "effort"),
  });
}

function rawMetrics(exercise) {
  const metricIds = Array.isArray(exercise.exerciseMetrics) ? [...exercise.exerciseMetrics] : [];
  const definitions = Metrics.definitionsForIds(metricIds);
  if (!definitions.ok) throw new Error(`catalog exercise ${exercise.id} has invalid metric IDs: ${definitions.issues.join(", ")}`);
  return { metricIds, metricDefinitions: definitions.value };
}

function initialTargets(metricDefinitions) {
  const reps = metricDefinitions.find((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide");
  return reps ? { [reps.semantic]: { min: 6, max: 10 } } : {};
}

export function programDefinitionForExercise(exerciseId, { notes = "" } = {}) {
  const exercise = EXERCISES_BY_ID.get(exerciseId);
  if (!exercise) throw new Error(`unknown raw exercise UUID: ${exerciseId}`);
  const { metricIds, metricDefinitions } = rawMetrics(exercise);
  const set = {
    id: "set-1",
    cycleIndex: 1,
    setIndex: 1,
    metricType: "source_metrics@1",
    metricIds: [...metricIds],
    metricDefinitions: structuredClone(metricDefinitions),
    targets: initialTargets(metricDefinitions),
    rir: metricDefinitions.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide") ? 2 : null,
    restSeconds: 120,
    status: metricIds.length ? "ready" : "configuration_required",
    provenance: { source: "manual_build", policyVersion: "manual@1" },
  };
  const slot = {
    id: "slot-1",
    purposeId: "manual_slot_1",
    exerciseId: exercise.id,
    sourceExerciseIds: [exercise.id],
    role: "manual",
    musclePurposeIds: [...(exercise.primaryFeatureMuscle || [])],
    movementPatternIds: [...(exercise.movementPattern || [])],
    ...(exercise.exerciseType ? { exerciseTypeId: exercise.exerciseType } : {}),
    metricIds,
    metricDefinitions,
    metricOrigin: "source_catalog",
    loadingModel: { bodyweightCoefficient: Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null },
    prescriptionsByCycle: [{ cycleIndex: 1, sets: [set] }],
    order: 1,
    displayName: exercise.name,
    setupNotes: notes,
    lateralityIds: [...(exercise.laterality || [])],
    executionMode: null,
  };
  const days = Array.from({ length: 7 }, (_, index) => ({
    id: `day-${index + 1}`,
    name: `Day ${index + 1}`,
    kind: index === 0 ? "training" : "rest",
    order: index + 1,
    slots: index === 0 ? [slot] : [],
  }));
  return {
    schemaVersion: 1,
    generatorVersion: Compiler.GENERATOR_VERSION,
    seed: "generative-manual",
    request: {},
    days,
    cycles: 1,
    deloadCycles: [],
    provenance: {
      source: "manual_build",
      policyVersion: "manual@1",
      approximations: [],
      estimatedSessionSeconds: { "day-1": 120 },
      focusNotApplied: [],
    },
  };
}

export function makePayload({ exerciseId, settings, name = "Generated program", notes = "" }) {
  const language = settings.lang;
  return {
    kind: "taurifer-shared-setup",
    version: 2,
    program: {
      name,
      definition: programDefinitionForExercise(exerciseId, { notes }),
      customExercises: [],
    },
    settings: structuredClone(settings),
    language,
  };
}

export function rawUuidArbitrary() {
  return fc.constantFrom(...BUILT_IN_ID_LIST);
}

export function payloadArbitrary() {
  return fc.record({
    exerciseId: rawUuidArbitrary(),
    settings: settingsArbitrary(),
    name: nameText(80),
    notes: text(120),
  }).map(makePayload);
}

export function attachCustomReference(payload, { id = "custom:gen-1", name = "Coach movement", notes = "" } = {}) {
  const target = structuredClone(payload);
  const definitions = Metrics.definitionsForIds(LOAD_REPS_IDS);
  if (!definitions.ok) throw new Error(`canonical custom metric fixture failed: ${definitions.issues.join(", ")}`);
  const custom = {
    id,
    name,
    equipment: ["machine"],
    primary: "",
    secondary: "",
    notes,
    metricIds: [...LOAD_REPS_IDS],
    metricDefinitions: definitions.value,
  };
  target.program.customExercises = [custom];
  const slot = target.program.definition.days[0].slots[0];
  slot.exerciseId = id;
  slot.sourceExerciseIds = [id];
  slot.role = "manual";
  slot.musclePurposeIds = [];
  slot.movementPatternIds = [];
  delete slot.exerciseTypeId;
  slot.metricIds = [...custom.metricIds];
  slot.metricDefinitions = structuredClone(custom.metricDefinitions);
  slot.metricOrigin = "user_defined";
  slot.loadingModel = { bodyweightCoefficient: null };
  slot.displayName = name;
  slot.lateralityIds = [];
  slot.executionMode = null;
  for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
    set.metricIds = [...custom.metricIds];
    set.metricDefinitions = structuredClone(custom.metricDefinitions);
    set.targets = { reps: { min: 6, max: 10 } };
    set.rir = 2;
    set.status = "manual";
  }
  return target;
}

export function customPayloadArbitrary() {
  return fc.record({
    payload: payloadArbitrary(),
    name: nameText(80),
    notes: text(120),
    suffix: fc.integer({ min: 1, max: 0xffffffff }),
  }).map(({ payload, name, notes, suffix }) => attachCustomReference(payload, {
    id: `custom:gen-${suffix}`,
    name,
    notes,
  }));
}

const POLLUTION_SITES = Object.freeze([
  "top_history",
  "settings_theme",
  "definition_performed_values",
  "custom_performed_values",
  "custom_archive_metadata",
]);

/** Invalid proposals carry realistic state-shaped sentinels and must be refused whole. */
export function pollutedPayloadArbitrary() {
  return fc.record({
    base: customPayloadArbitrary(),
    site: fc.constantFrom(...POLLUTION_SITES),
    sentinelSeed: fc.integer({ min: 1, max: 0xffffffff }),
  }).map(({ base, site, sentinelSeed }) => {
    const payload = structuredClone(base);
    const sentinel = `rf-private-${sentinelSeed}`;
    if (site === "top_history") payload.log = [{ note: sentinel }];
    if (site === "settings_theme") payload.settings.theme = sentinel;
    if (site === "definition_performed_values") {
      payload.program.definition.days[0].slots[0].prescriptionsByCycle[0].sets[0].metricValues = [
        { metricId: REPS_ID, value: 777, unit: "reps", note: sentinel },
      ];
    }
    if (site === "custom_performed_values") {
      payload.program.customExercises[0].performedValues = [
        { metricId: REPS_ID, value: 777, unit: "reps", note: sentinel },
      ];
    }
    if (site === "custom_archive_metadata") payload.program.customExercises[0].archived = sentinel;
    return { payload, sentinels: [sentinel] };
  });
}

export const ALLOWLISTED_SETTING_KEYS = Object.freeze([
  "jumpPct", "minJump", "rirHigh", "hardRir", "restSec", "unit", "lang", "rirMode",
]);
