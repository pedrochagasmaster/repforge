#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Compiler = require(path.join(root, "program-compiler.js"));
const Metrics = require(path.join(root, "exercise-metrics.js"));
const WorkoutDraft = require(path.join(root, "workout-draft.js"));
const ProgramEntry = require(path.join(root, "program-entry.js"));
const catalogSnapshot = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/app_file.json"), "utf8"));
globalThis.crypto ||= webcrypto;
globalThis.RepForgeProgramCompiler = Compiler;
globalThis.RepForgeExerciseMetrics = Metrics;
globalThis.RepForgeExerciseCatalog = { snapshot: () => catalogSnapshot };
globalThis.RepForgeProgramEntry = ProgramEntry;
const Contract = require(path.join(root, "install-transfer-contract.js"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "test/fixtures/install-transfer-clone-v1.json"), "utf8"));
const gym = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/gym.json"), "utf8"));
const observations = JSON.parse(fs.readFileSync(path.join(root, "plans/067/data/programs.json"), "utf8"));

const observedExerciseIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
const movementConfirmations = Object.fromEntries(observedExerciseIds.map((id) => {
  const exercise = catalogSnapshot.exercises.find((entry) => entry.id === id);
  return [id, [...exercise.preconditions]];
}));
const request = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations, emphasisMuscleIds: [], deprioritizedMuscleIds: [],
  excludedExerciseIds: [], excludedMuscleIds: [], preferredExerciseIds: [],
  split: "auto", periodization: "static", cycles: 12, deloadCycles: [],
};
const compiled = Compiler.generateProgram(request, catalogSnapshot, "install-transfer-plan067");
assert.equal(compiled.ok, true, "install fixture uses a real complete compiler definition");
const programDefinition = compiled.value;
const customState = structuredClone(fixture.durableState.customExercises[0]);
customState.metricIds = [];
customState.metricDefinitions = [];
const canonicalCustomProjection = {
  id: customState.id,
  name: customState.name,
  namePt: customState.namePt,
  equipment: customState.equipment,
  primary: customState.primary,
  secondary: customState.secondary,
  notes: customState.notes,
  metricIds: customState.metricIds,
  metricDefinitions: customState.metricDefinitions,
};
assert.deepEqual(Compiler.validateProgramDefinition(programDefinition, catalogSnapshot, [canonicalCustomProjection]),
  { ok: true, issues: [] }, "state-only custom metadata is projected to the canonical compiler definition");

function flatRows(definition) {
  const rows = [];
  for (const day of definition.days) {
    if (day.kind !== "training") continue;
    for (const slot of day.slots) {
      const cycle = slot.prescriptionsByCycle[0];
      const repMetric = slot.metricDefinitions.find((metric) => ["reps", "repsPerSide"].includes(metric.semantic));
      const repTarget = repMetric ? cycle.sets.map((set) => set.targets[repMetric.semantic]).find((value) => value != null) : null;
      rows.push({
        id: slot.id, slotId: slot.id, day: day.name, dayId: day.id, order: slot.order,
        name: catalogSnapshot.exercises.find((exercise) => exercise.id === slot.exerciseId)?.name || slot.exerciseId,
        libraryId: slot.exerciseId, sets: cycle.sets.length,
        min: typeof repTarget === "number" ? repTarget : repTarget?.min ?? 1,
        max: typeof repTarget === "number" ? repTarget : repTarget?.max ?? 1,
        hasRepTarget: repTarget != null, displayName: slot.displayName || null,
        primary: "", secondary: "", notes: slot.setupNotes || "",
        metricIds: [...slot.metricIds], metricDefinitions: structuredClone(slot.metricDefinitions),
        prescriptionsByCycle: structuredClone(slot.prescriptionsByCycle),
        exerciseTypeId: slot.exerciseTypeId || null,
        movementPatternIds: [...slot.movementPatternIds], musclePurposeIds: [...slot.musclePurposeIds],
        loadingModel: structuredClone(slot.loadingModel), metricOrigin: slot.metricOrigin,
      });
    }
  }
  return rows;
}

function programEntryPreview(definition, customExercises) {
  const rows = [];
  const trainingDays = definition.days.filter((day) => day.kind === "training");
  for (const day of trainingDays) {
    for (const slot of day.slots) {
      const firstCycle = slot.prescriptionsByCycle[0];
      const repSemantic = slot.metricDefinitions.find((metric) => ["reps", "repsPerSide"].includes(metric.semantic))?.semantic;
      const target = repSemantic ? firstCycle.sets.map((set) => set.targets[repSemantic]).find((value) => value != null) : null;
      const source = catalogSnapshot.exercises.find((exercise) => exercise.id === slot.exerciseId);
      rows.push({
        id: slot.id, slotId: slot.id, dayId: day.id, day: day.name, order: slot.order,
        name: source?.name || slot.exerciseId, libraryId: slot.exerciseId,
        sets: firstCycle.sets.length,
        hasRepTarget: Boolean(repSemantic),
        ...(repSemantic ? {
          min: typeof target === "number" ? target : target?.min,
          max: typeof target === "number" ? target : target?.max,
        } : {}),
        notes: slot.setupNotes || "",
      });
    }
  }
  return {
    source: "compiler",
    frequency: definition.request.daysPerWeek,
    program: rows,
    programDefinition: structuredClone(definition),
    programStructure: {
      schemaVersion: 1,
      days: trainingDays.map((day) => ({ dayId: day.id, label: day.name, order: day.order })),
    },
    days: trainingDays.map((day) => ({
      dayId: day.id, label: day.name, order: day.order,
      exercises: structuredClone(rows.filter((row) => row.dayId === day.id)),
    })),
    customExercises: structuredClone(customExercises),
  };
}

const entryVersions = {
  compiler: Compiler.GENERATOR_VERSION,
  family: "retired",
  blueprint: String(Compiler.PROGRAM_SCHEMA_VERSION),
  catalogue: "raw-uuid@1",
  rules: "source-metrics@1",
  context: "program-definition@1",
  progression: "067.1",
  recentConsistency: "retired",
  simpleStart: "retired",
};
const entryNow = "2026-10-06T09:00:00.000Z";
let entryState = ProgramEntry.selectRoute(ProgramEntry.createState({
  draftId: "entry-p067-canonical-clone",
  activeProgramRevisionAtStart: 12,
  now: entryNow,
  versions: entryVersions,
}), "build");
entryState = ProgramEntry.setAnswers(entryState, { programName: "Plan 067 generated", daysPerWeek: programDefinition.request.daysPerWeek });
entryState = ProgramEntry.advance(entryState).state;
entryState = ProgramEntry.setResult(entryState, {
  fingerprint: "p067-generated-preview",
  name: "Plan 067 generated",
  selected: { id: "p067-generated-program" },
  preview: programEntryPreview(programDefinition, [customState]),
});
const normalizedEntry = ProgramEntry.normalizeSetupDraft(entryState);
assert.equal(normalizedEntry.ok, true, `real ProgramEntry producer normalizes its compiler preview: ${normalizedEntry.issues?.join(",") || ""}`);
const logicalProgramEntryDraft = normalizedEntry.value;
const entryEnvelope = {
  schemaVersion: ProgramEntry.SCHEMA_VERSION,
  draftId: logicalProgramEntryDraft.draftId,
  revision: 3,
  ownerId: "owner-p067-clone",
  state: structuredClone(logicalProgramEntryDraft),
};
const normalizedEntryEnvelope = ProgramEntry.normalizeSetupDraftEnvelope(entryEnvelope);
assert.equal(normalizedEntryEnvelope.ok, true,
  `real ProgramEntry storage envelope normalizes: ${normalizedEntryEnvelope.issues?.join(",") || ""}`);
function jsonShape(value, depth = 1) {
  if (value === null || typeof value !== "object") return { nodes: 1, depth };
  const children = Object.values(value).map((item) => jsonShape(item, depth + 1));
  return {
    nodes: 1 + children.reduce((sum, child) => sum + child.nodes, 0),
    depth: children.length ? Math.max(...children.map((child) => child.depth)) : depth,
  };
}
const entrySizeEvidence = [];
for (const [label, candidate, byteLimit] of [
  ["logical setup state", logicalProgramEntryDraft, ProgramEntry.MAX_DRAFT_BYTES],
  ["storage setup envelope", entryEnvelope, ProgramEntry.MAX_DRAFT_ENVELOPE_BYTES],
]) {
  const bytes = Buffer.byteLength(JSON.stringify(candidate), "utf8");
  const shape = jsonShape(candidate);
  entrySizeEvidence.push(`${label}=${bytes} bytes/${shape.nodes} nodes/depth ${shape.depth}`);
  assert.ok(bytes <= byteLimit, `${label} is ${bytes} bytes within its ${byteLimit}-byte cap`);
  assert.ok(shape.nodes <= 65536 && shape.depth <= 20,
    `${label} is ${shape.nodes} JSON nodes at depth ${shape.depth}, within the 65,536-node / depth-20 bounds`);
}
console.log(`Program-entry clone bounds: ${entrySizeEvidence.join("; ")}`);
assert.deepEqual(logicalProgramEntryDraft.result.preview.programDefinition, programDefinition,
  "the logical entry draft retains the exact canonical compiler definition");
assert.deepEqual(logicalProgramEntryDraft.result.preview.customExercises[0], customState,
  "the logical entry draft preserves complete custom metadata beside the canonical projection");
assert.ok(logicalProgramEntryDraft.result.preview.program.every((row) => !Object.hasOwn(row, "prescriptionsByCycle")),
  "the flat entry projection does not duplicate per-cycle prescriptions already in the canonical definition");

const activeSlot = programDefinition.days.flatMap((day) => day.slots)
  .find((slot) => slot.metricDefinitions.some((metric) => metric.semantic === "loadKg") &&
    slot.metricDefinitions.some((metric) => metric.semantic === "reps"));
assert.ok(activeSlot, "compiler output includes a real load-plus-reps slot for a performed row");
const metricValues = activeSlot.metricDefinitions.map((definition) => ({
  metricId: definition.id,
  value: definition.semantic === "loadKg" ? 0 : definition.semantic === "reps" ? 8 : 1,
  unit: definition.unit,
}));
assert.equal(Metrics.validateMetricValues(activeSlot.metricIds, metricValues).ok, true,
  "performed values use the exact ordered full UUID composition and canonical units");
const actualRow = {
  session: "2026-10-06T09:00:00.000Z", date: "2026-10-06", day: "Upper A",
  name: "Canonical compiler exercise", exerciseId: activeSlot.exerciseId,
  sourceLibraryId: activeSlot.exerciseId, metricOrigin: activeSlot.metricOrigin,
  set: 1, setIndex: 0, load: 0, reps: 8, rir: 2, notes: "", created: "2026-10-06T09:05:00.000Z",
  metricType: "source_metrics@1", metricIds: [...activeSlot.metricIds],
  metricDefinitions: structuredClone(activeSlot.metricDefinitions), metricValues,
  equipmentId: null, loadingConvention: "external", bodyweight: null,
  loadingModel: structuredClone(activeSlot.loadingModel),
  loadingContext: {
    loadingConvention: "external", bodyweightContributionEnabled: false, bodyweightKg: null,
    externalLoadMultiplier: 1,
    bodyweightCoefficient: activeSlot.loadingModel.bodyweightCoefficient,
  },
  restSeconds: activeSlot.prescriptionsByCycle[0].sets[0].restSeconds,
};

const activeDay = programDefinition.days.find((day) => day.kind === "training" &&
  day.slots.some((slot) => slot.id === activeSlot.id));
const actualDraftValues = activeSlot.metricDefinitions.map((definition) => ({
  id: definition.id,
  sourceName: definition.sourceName,
  semantic: definition.semantic,
  unit: definition.unit,
}));
const actualTargets = activeSlot.prescriptionsByCycle[0].sets[0].targets;
const actualRepTarget = actualTargets.reps ?? actualTargets.repsPerSide;
const actualConvention = actualDraftValues.some((metric) => metric.semantic === "assistanceKg") ? "assistance"
  : actualDraftValues.some((metric) => ["loadPerSideKg", "persistentLoadPerSideKg"].includes(metric.semantic)) ? "per_side"
    : actualDraftValues.length === 1 && actualDraftValues.some((metric) => ["reps", "repsPerSide"].includes(metric.semantic)) ? "bodyweight" : "external";
let actualDraft = WorkoutDraft.create({
  programId: "program-p067-draft-proof",
  programFingerprint: "program-p067-fingerprint",
  durableRevision: 12,
  dayId: activeDay.id,
  dayLabel: activeDay.name,
  scheduleDate: "2026-10-06",
  unit: "kg",
  rirMode: "numeric",
  exercises: [{
    exerciseInstanceId: activeSlot.id,
    sourceExerciseId: activeSlot.id,
    libraryId: activeSlot.exerciseId,
    movementId: `library:${activeSlot.exerciseId}`,
    displayName: activeSlot.exerciseId,
    sets: activeSlot.prescriptionsByCycle[0].sets.length,
    setIds: activeSlot.prescriptionsByCycle[0].sets.map((_, index) => `draft-set-${index + 1}`),
    minReps: typeof actualRepTarget === "number" ? actualRepTarget : actualRepTarget.min,
    maxReps: typeof actualRepTarget === "number" ? actualRepTarget : actualRepTarget.max,
    notes: "",
    primary: "",
    secondary: "",
    metricDefinitions: structuredClone(activeSlot.metricDefinitions),
    metricOrigin: activeSlot.metricOrigin,
    loadingModel: structuredClone(activeSlot.loadingModel),
    loadingConvention: actualConvention,
    loadingContext: {
      bodyweightContributionEnabled: null,
      externalLoadMultiplier: actualConvention === "per_side" ? null : actualConvention === "bodyweight" ? 0 : 1,
      bodyweightCoefficient: activeSlot.loadingModel.bodyweightCoefficient,
    },
    sourceFingerprint: `source-${activeSlot.id}`,
    programmedSets: activeSlot.prescriptionsByCycle[0].sets.map((set) => {
      const repTarget = set.targets.reps ?? set.targets.repsPerSide;
      return {
        suggestedLoad: null,
        suggestedReps: typeof repTarget === "number" ? repTarget : repTarget.min,
        targetRir: set.rir,
        minReps: typeof repTarget === "number" ? repTarget : repTarget.min,
        maxReps: typeof repTarget === "number" ? repTarget : repTarget.max,
        metricDefinitions: structuredClone(activeSlot.metricDefinitions),
        targets: structuredClone(set.targets),
        restSeconds: set.restSeconds,
      };
    }),
  }],
}, {
  draftId: "draft-p067-full-clone-proof",
  startedAt: "2026-10-06T09:00:00.000Z",
  scheduleDate: "2026-10-06",
  selectedExerciseId: activeSlot.id,
  writer: { installationId: "installation-p067-test", tabId: "tab-p067-test", operationId: "operation-p067-test" },
});
assert.equal(WorkoutDraft.isDomainError(actualDraft), false,
  `the actual DraftV2 producer accepts this Plan 067 source slot: ${JSON.stringify(actualDraft)}`);
const draftSetId = actualDraft.exercises[activeSlot.id].setOrder[0];
for (const restSeconds of [0.5, 86401]) {
  const invalidRest = structuredClone(actualDraft);
  invalidRest.exercises[activeSlot.id].sets[draftSetId].programmed.restSeconds = restSeconds;
  assert.equal(WorkoutDraft.validate(invalidRest).ok, false,
    `DraftV2 refuses out-of-contract rest seconds ${restSeconds}`);
}
for (const definition of activeSlot.metricDefinitions) {
  const value = definition.semantic === "loadKg" ? "0"
    : definition.semantic === "reps" ? "8" : "1";
  actualDraft = WorkoutDraft.reduce(actualDraft, {
    type: "editMetricValue",
    exerciseInstanceId: activeSlot.id,
    setId: draftSetId,
    metricId: definition.id,
    value,
    expectedRevision: actualDraft.revision,
    operationId: `install-transfer-${definition.id}`,
    updatedAt: "2026-10-06T09:01:00.000Z",
    writer: { installationId: "installation-p067-test", tabId: "tab-p067-test" },
  });
  assert.equal(WorkoutDraft.isDomainError(actualDraft), false,
    `the producer accepts a real edit for ${definition.semantic}`);
}
const logicalDraft = WorkoutDraft.logicalCloneSection(actualDraft);
assert.equal(WorkoutDraft.isDomainError(logicalDraft), false, "the full clone uses the producer's logical DraftV2 projection");
assert.equal(logicalDraft.exercises[activeSlot.id].sets[logicalDraft.exercises[activeSlot.id].setOrder[0]]
  .programmed.metricType, "source_metrics@1", "the active DraftV2 set keeps the full source metric contract");
assert.ok(Object.values(logicalDraft.exercises[activeSlot.id].sets[draftSetId].touched.metrics).every(Boolean),
  "the producer-created logical draft carries its edited metric touch map");
assert.deepEqual(logicalDraft.exercises[activeSlot.id].programmed.loadingContext,
  { bodyweightContributionEnabled: null, externalLoadMultiplier: 1, bodyweightCoefficient: activeSlot.loadingModel.bodyweightCoefficient },
  "DraftV2 retains the captured coefficient and loading context for install transfer");

function canonicalHash(envelope) {
  const preimage = structuredClone(envelope);
  delete preimage.integrity.canonicalPayloadHash;
  return createHash("sha256").update(Contract.canonicalJson(preimage), "utf8").digest("hex");
}

function currentEnvelope() {
  const envelope = structuredClone(fixture);
  const meta = envelope.durableState.programMeta;
  delete meta.programStructure;
  delete meta.compilerContext;
  meta.programDefinition = structuredClone(programDefinition);
  envelope.durableState.program = flatRows(programDefinition);
  envelope.durableState.programHistory = [];
  envelope.durableState.customExercises = [structuredClone(customState)];
  envelope.durableState.log = [structuredClone(actualRow)];
  envelope.programEntryDraft = structuredClone(logicalProgramEntryDraft);
  envelope.workoutDraft = structuredClone(logicalDraft);
  envelope.integrity.canonicalPayloadHash = canonicalHash(envelope);
  return envelope;
}

// An older clone: flat rows with family/blueprint provenance and no
// authoritative ProgramDefinition, sealed with a correct hash so only the
// schema boundary can refuse it.
const legacyClone = (() => {
  const envelope = structuredClone(fixture);
  delete envelope.durableState.programMeta.programDefinition;
  envelope.durableState.programMeta.compilerContext = { familyId: "balanced", blueprintId: "balanced_2_v1" };
  envelope.integrity.canonicalPayloadHash = canonicalHash(envelope);
  return envelope;
})();
const legacyBefore = JSON.stringify(legacyClone);
const refusedLegacy = await Contract.validateEnvelopeIntegrity(structuredClone(legacyClone), webcrypto);
assert.equal(refusedLegacy.ok, false,
  "old family/blueprint clones without authoritative ProgramDefinition are refused as unsupported data");
assert.notEqual(refusedLegacy.code, Contract.ERROR_CODES.INTEGRITY_MISMATCH,
  "legacy refusal is a schema boundary result, not a misleading hash failure");
assert.equal(JSON.stringify(legacyClone), legacyBefore, "refusing an old clone leaves its source bytes unchanged");

const valid = currentEnvelope();
const validBefore = JSON.stringify(valid);
const accepted = await Contract.validateEnvelopeIntegrity(valid, webcrypto);
assert.equal(accepted.ok, true, `canonical clone passes validation: ${accepted.code || ""}`);

// An open workout on a movement whose composition has no repetitions (here
// weight plus per-side distance) carries no flat rep range, and still transfers.
{
  const replessId = "1a35c6f170d88025a7a1f34e94c394c5";
  const source = catalogSnapshot.exercises.find((exercise) => exercise.id === replessId);
  const definitions = Metrics.definitionsForIds(source.exerciseMetrics).value;
  assert.ok(!definitions.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide"),
    "the rep-less probe movement records no repetitions");
  const targets = Object.fromEntries(definitions.map((metric) => [metric.semantic, metric.semantic.startsWith("load") ? 20 : 30]));
  const replessDraft = WorkoutDraft.create({
    programId: "program-p067-repless", programFingerprint: "program-p067-repless-fingerprint", durableRevision: 3,
    dayId: activeDay.id, dayLabel: activeDay.name, scheduleDate: "2026-10-06", unit: "kg", rirMode: "numeric",
    exercises: [{
      exerciseInstanceId: "repless-slot", sourceExerciseId: "repless-slot", libraryId: replessId,
      movementId: `library:${replessId}`, displayName: source.name, sets: 1, setIds: ["repless-set-1"],
      minReps: null, maxReps: null, notes: "", primary: "", secondary: "",
      metricDefinitions: structuredClone(definitions), metricOrigin: "source_catalog",
      loadingModel: { bodyweightCoefficient: source.bodyweight ?? null }, loadingConvention: "external",
      loadingContext: { bodyweightContributionEnabled: null, externalLoadMultiplier: 1, bodyweightCoefficient: source.bodyweight ?? null },
      sourceFingerprint: "source-repless-slot",
      programmedSets: [{ suggestedLoad: null, targetRir: 2, minReps: null, maxReps: null,
        metricDefinitions: structuredClone(definitions), targets, restSeconds: 90 }],
    }],
  }, {
    draftId: "draft-p067-repless", startedAt: "2026-10-06T09:00:00.000Z", scheduleDate: "2026-10-06",
    selectedExerciseId: "repless-slot",
    writer: { installationId: "installation-p067-test", tabId: "tab-p067-test", operationId: "operation-p067-repless" },
  });
  assert.equal(WorkoutDraft.isDomainError(replessDraft), false, `the producer creates a rep-less metric draft: ${JSON.stringify(replessDraft)}`);
  const replessEnvelope = currentEnvelope();
  replessEnvelope.workoutDraft = WorkoutDraft.logicalCloneSection(replessDraft);
  replessEnvelope.integrity.canonicalPayloadHash = canonicalHash(replessEnvelope);
  const replessResult = await Contract.validateEnvelopeIntegrity(replessEnvelope, webcrypto);
  assert.equal(replessResult.ok, true, `an open rep-less metric workout transfers: ${replessResult.code || ""}`);
}
assert.deepEqual(accepted.value.durableState.programMeta.programDefinition, programDefinition,
  "the clone preserves the complete authoritative scheduled definition");
assert.deepEqual(accepted.value.durableState.log[0], actualRow,
  "the clone preserves actual values with ordered source UUIDs and units");
assert.deepEqual(accepted.value.workoutDraft, logicalDraft,
  "the clone preserves the complete producer-created DraftV2, including edits, touch maps and loading context");
assert.deepEqual(accepted.value.programEntryDraft, logicalProgramEntryDraft,
  "the clone preserves the normalized pending setup state, canonical definition, flat projection, and custom metadata exactly");
assert.deepEqual(accepted.value.durableState.customExercises[0], customState,
  "device-only custom metadata remains byte-for-byte in the full install clone");
assert.equal(JSON.stringify(valid), validBefore, "validation does not mutate the source envelope");

const unsupportedComposition = structuredClone(valid);
unsupportedComposition.durableState.log[0].metricValues.reverse();
unsupportedComposition.integrity.canonicalPayloadHash = canonicalHash(unsupportedComposition);
const unsupportedBefore = JSON.stringify(unsupportedComposition);
const refusedComposition = await Contract.validateEnvelopeIntegrity(unsupportedComposition, webcrypto);
assert.equal(refusedComposition.ok, false, "reordered actual UUID values do not cross the clone boundary");
assert.equal(JSON.stringify(unsupportedComposition), unsupportedBefore,
  "semantic refusal retains all source actual and clone bytes");

const unsupportedDefinition = structuredClone(valid);
unsupportedDefinition.durableState.programMeta.programDefinition.days[0].slots[0].metricIds[0] = "legacy-family-weight";
unsupportedDefinition.integrity.canonicalPayloadHash = canonicalHash(unsupportedDefinition);
const refusedDefinition = await Contract.validateEnvelopeIntegrity(unsupportedDefinition, webcrypto);
assert.equal(refusedDefinition.ok, false, "a fabricated non-UUID metric composition is refused");

const unsupportedDraftMetric = structuredClone(valid);
const draftExercise = unsupportedDraftMetric.workoutDraft.exercises[activeSlot.id];
const draftSet = draftExercise.sets[draftExercise.setOrder[0]];
const replacedMetricId = draftSet.programmed.metricIds[0];
draftSet.programmed.metricIds[0] = "legacy-family-weight";
draftSet.programmed.metrics[0].id = "legacy-family-weight";
draftSet.edited.metrics = Object.fromEntries(Object.entries(draftSet.edited.metrics).map(([id, value]) =>
  [id === replacedMetricId ? "legacy-family-weight" : id, value]));
draftSet.touched.metrics = Object.fromEntries(Object.entries(draftSet.touched.metrics).map(([id, value]) =>
  [id === replacedMetricId ? "legacy-family-weight" : id, value]));
unsupportedDraftMetric.integrity.canonicalPayloadHash = canonicalHash(unsupportedDraftMetric);
const refusedDraftMetric = await Contract.validateEnvelopeIntegrity(unsupportedDraftMetric, webcrypto);
assert.equal(refusedDraftMetric.ok, false,
  "install transfer validates source metric UUIDs inside a producer-created DraftV2, not just history rows");

const validAlternativeMetrics = Metrics.SOURCE_COMPOSITIONS.find((ids) =>
  ids.length === 2 && ids[0] === "2555c6f170d8805cafa6d16d3fdddbaa" &&
  ids[1] === "25a5c6f170d88092bcead56f9fe8247e");
assert.ok(validAlternativeMetrics, "the source schema has a real Weight+Distance composition for the boundary proof");
const alternativeDefinitions = Metrics.definitionsForIds(validAlternativeMetrics);
assert.equal(alternativeDefinitions.ok, true, "the substituted metric composition is valid in isolation");
const wrongSourceComposition = currentEnvelope();
const wrongSourceSet = wrongSourceComposition.workoutDraft.exercises[activeSlot.id]
  .sets[wrongSourceComposition.workoutDraft.exercises[activeSlot.id].setOrder[0]];
wrongSourceSet.programmed.metricIds = [...validAlternativeMetrics];
wrongSourceSet.programmed.metrics = structuredClone(alternativeDefinitions.value);
wrongSourceSet.programmed.targets = {
  loadKg: 0,
  distanceShortPerSideMeters: { min: 1, max: 2 },
};
wrongSourceSet.edited.metrics = Object.fromEntries(alternativeDefinitions.value.map((definition) =>
  [definition.id, definition.semantic === "loadKg" ? "0" : "1"]));
wrongSourceSet.touched.metrics = Object.fromEntries(alternativeDefinitions.value.map((definition) => [definition.id, true]));
wrongSourceComposition.integrity.canonicalPayloadHash = canonicalHash(wrongSourceComposition);
assert.equal(Metrics.validateDefinitions(wrongSourceSet.programmed.metricIds, wrongSourceSet.programmed.metrics).ok, true,
  "the mutated draft remains internally valid as an ordered source metric composition");
assert.equal(Metrics.validateRawIds(wrongSourceSet.programmed.metricIds, catalogSnapshot.uuidIndex).ok, true,
  "every substituted metric identifier exists in the raw catalog UUID index");
const refusedWrongSourceComposition = await Contract.validateEnvelopeIntegrity(wrongSourceComposition, webcrypto);
assert.equal(refusedWrongSourceComposition.ok, false,
  "a valid but different metric composition cannot be bound to a source exercise with another raw composition");

const wrongSourceLogComposition = currentEnvelope();
const wrongSourceLog = wrongSourceLogComposition.durableState.log[0];
wrongSourceLog.metricIds = [...validAlternativeMetrics];
wrongSourceLog.metricDefinitions = structuredClone(alternativeDefinitions.value);
wrongSourceLog.metricValues = alternativeDefinitions.value.map((definition) => ({
  metricId: definition.id,
  value: definition.semantic === "loadKg" ? 0 : 1,
  unit: definition.unit,
}));
wrongSourceLog.reps = null;
wrongSourceLogComposition.integrity.canonicalPayloadHash = canonicalHash(wrongSourceLogComposition);
assert.equal(Metrics.validateMetricValues(wrongSourceLog.metricIds, wrongSourceLog.metricValues).ok, true,
  "the performed row's replacement values remain valid under the alternate source composition");
const refusedWrongSourceLogComposition = await Contract.validateEnvelopeIntegrity(wrongSourceLogComposition, webcrypto);
assert.equal(refusedWrongSourceLogComposition.ok, false,
  "a performed row cannot claim a valid metric composition that differs from its source catalog exercise");

const wrongSourceCoefficient = currentEnvelope();
const wrongCoefficientExercise = wrongSourceCoefficient.workoutDraft.exercises[activeSlot.id];
const sourceCoefficient = wrongCoefficientExercise.programmed.loadingModel.bodyweightCoefficient;
const changedCoefficient = sourceCoefficient === 0.5 ? 0.25 : 0.5;
wrongCoefficientExercise.programmed.loadingModel.bodyweightCoefficient = changedCoefficient;
wrongCoefficientExercise.programmed.loadingContext.bodyweightCoefficient = changedCoefficient;
wrongSourceCoefficient.integrity.canonicalPayloadHash = canonicalHash(wrongSourceCoefficient);
assert.equal(WorkoutDraft.validate((() => {
  const candidate = structuredClone(wrongSourceCoefficient.workoutDraft);
  candidate.revision = 0;
  candidate.writer = { installationId: "install-transfer-validator", tabId: "install-transfer-validator", operationId: "install-transfer-validator" };
  candidate.program.durableRevision = 0;
  return candidate;
})()).ok, true, "the draft's captured loading context remains structurally valid after coefficient mutation");
const refusedWrongSourceCoefficient = await Contract.validateEnvelopeIntegrity(wrongSourceCoefficient, webcrypto);
assert.equal(refusedWrongSourceCoefficient.ok, false,
  "source-bound drafts retain the exact bodyweight coefficient from their catalog record");

const repsMetric = Metrics.byName("Reps");
const customHistoryRow = {
  ...structuredClone(actualRow),
  exerciseId: "custom-slot-p067",
  name: customState.name,
  sourceLibraryId: customState.id,
  performedLibraryId: customState.id,
  metricOrigin: "user_defined",
  metricIds: [repsMetric.id],
  metricDefinitions: [repsMetric],
  metricValues: [{ metricId: repsMetric.id, value: 8, unit: repsMetric.unit }],
  load: null,
  reps: 8,
  loadingConvention: "bodyweight",
  loadingModel: { bodyweightCoefficient: null, assistanceDirection: "subtract" },
  loadingContext: {
    loadingConvention: "bodyweight", bodyweightKg: null,
    bodyweightContributionEnabled: null, externalLoadMultiplier: 0, bodyweightCoefficient: null,
  },
};
const metriclessExercise = catalogSnapshot.exercises.find((exercise) =>
  !Array.isArray(exercise.exerciseMetrics) || exercise.exerciseMetrics.length === 0);
assert.ok(metriclessExercise, "the raw catalog includes an exercise requiring manual metric configuration");
const metriclessCoefficient = typeof metriclessExercise.bodyweight === "number" && Number.isFinite(metriclessExercise.bodyweight)
  ? metriclessExercise.bodyweight : null;
const metriclessHistoryRow = {
  ...structuredClone(customHistoryRow),
  exerciseId: "metricless-slot-p067",
  name: metriclessExercise.name,
  sourceLibraryId: metriclessExercise.id,
  performedLibraryId: metriclessExercise.id,
  loadingModel: { bodyweightCoefficient: metriclessCoefficient, assistanceDirection: "subtract" },
  loadingContext: {
    loadingConvention: "bodyweight", bodyweightKg: null,
    bodyweightContributionEnabled: null, externalLoadMultiplier: 0, bodyweightCoefficient: metriclessCoefficient,
  },
};
function createCapturedUserDefinedDraft({ libraryId, exerciseInstanceId, sourceExerciseId, displayName, sourceFingerprint }) {
  return WorkoutDraft.create({
    programId: "independently-retained-program",
    programFingerprint: "independently-retained-fingerprint",
    durableRevision: 4,
    dayId: "retained-day",
    dayLabel: "Retained day",
    scheduleDate: "2026-10-06",
    unit: "kg",
    rirMode: "numeric",
    exercises: [{
      exerciseInstanceId,
      sourceExerciseId,
      libraryId,
      displayName,
      sets: 1,
      setIds: [`${exerciseInstanceId}-set-1`],
      minReps: 8,
      maxReps: 10,
      metricOrigin: "user_defined",
      metricDefinitions: [repsMetric],
      loadingModel: { bodyweightCoefficient: null, assistanceDirection: "subtract" },
      loadingConvention: "bodyweight",
      loadingContext: {
        loadingConvention: "bodyweight", bodyweightContributionEnabled: null,
        externalLoadMultiplier: 0, bodyweightCoefficient: null,
      },
      sourceFingerprint,
      programmedSets: [{
        suggestedLoad: null,
        suggestedReps: 8,
        targetRir: null,
        minReps: 8,
        maxReps: 10,
        metricDefinitions: [repsMetric],
        targets: { reps: { min: 8, max: 10 } },
        restSeconds: 90,
      }],
    }],
  }, {
    draftId: `draft-${exerciseInstanceId}`,
    startedAt: "2026-10-06T09:00:00.000Z",
    scheduleDate: "2026-10-06",
    selectedExerciseId: exerciseInstanceId,
    writer: { installationId: "installation-p067-test", tabId: "tab-p067-test", operationId: `create-${exerciseInstanceId}` },
  });
}
const capturedCustomDraft = createCapturedUserDefinedDraft({
  libraryId: customState.id,
  exerciseInstanceId: "custom-retained-slot",
  sourceExerciseId: customState.id,
  displayName: customState.name,
  sourceFingerprint: "custom-retained-source",
});
const capturedMetriclessDraft = createCapturedUserDefinedDraft({
  libraryId: metriclessExercise.id,
  exerciseInstanceId: "metricless-retained-slot",
  sourceExerciseId: metriclessExercise.id,
  displayName: metriclessExercise.name,
  sourceFingerprint: "metricless-retained-source",
});
for (const [draft, source] of [[capturedCustomDraft, "custom"], [capturedMetriclessDraft, "metricless"]]) {
  assert.equal(WorkoutDraft.isDomainError(draft), false, `the DraftV2 producer accepts captured ${source} user-defined metrics`);
  const envelope = currentEnvelope();
  envelope.workoutDraft = WorkoutDraft.logicalCloneSection(draft);
  envelope.integrity.canonicalPayloadHash = canonicalHash(envelope);
  const acceptedDraft = await Contract.validateEnvelopeIntegrity(envelope, webcrypto);
  assert.equal(acceptedDraft.ok, true,
    `install transfer preserves captured ${source} user-defined metrics independently of current program/custom configuration`);
  assert.deepEqual(acceptedDraft.value.workoutDraft, WorkoutDraft.logicalCloneSection(draft),
    `the ${source} DraftV2 clone retains its captured metric definitions exactly`);
}
const configuredHistory = currentEnvelope();
configuredHistory.durableState.log = [customHistoryRow, metriclessHistoryRow];
configuredHistory.integrity.canonicalPayloadHash = canonicalHash(configuredHistory);
const acceptedConfiguredHistory = await Contract.validateEnvelopeIntegrity(configuredHistory, webcrypto);
assert.equal(acceptedConfiguredHistory.ok, true,
  "captured user-defined custom and metricless-source History rows survive after custom metadata has changed");
assert.deepEqual(acceptedConfiguredHistory.value.durableState.log, [customHistoryRow, metriclessHistoryRow],
  "custom and metricless-source actual values and captured definitions round-trip unchanged");

for (const [description, change] of [
  ["missing", (row) => { delete row.loadingContext.loadingConvention; }],
  ["mismatched", (row) => { row.loadingContext.loadingConvention = "assistance"; }],
]) {
  const badConvention = currentEnvelope();
  change(badConvention.durableState.log[0]);
  badConvention.integrity.canonicalPayloadHash = canonicalHash(badConvention);
  const refusedConvention = await Contract.validateEnvelopeIntegrity(badConvention, webcrypto);
  assert.equal(refusedConvention.ok, false,
    `transfer refuses a performed row with a ${description} nested loading convention`);
}

const alteredMetriclessCoefficient = structuredClone(configuredHistory);
const alteredMetriclessRow = alteredMetriclessCoefficient.durableState.log[1];
const invalidMetriclessCoefficient = metriclessCoefficient === null ? 0 : metriclessCoefficient === 0 ? 0.5 : 0;
alteredMetriclessRow.loadingModel.bodyweightCoefficient = invalidMetriclessCoefficient;
alteredMetriclessRow.loadingContext.bodyweightCoefficient = invalidMetriclessCoefficient;
alteredMetriclessCoefficient.integrity.canonicalPayloadHash = canonicalHash(alteredMetriclessCoefficient);
const refusedMetriclessCoefficient = await Contract.validateEnvelopeIntegrity(alteredMetriclessCoefficient, webcrypto);
assert.equal(refusedMetriclessCoefficient.ok, false,
  "user-defined metrics on a metricless built-in retain that raw movement's exact bodyweight coefficient");

const unboundedCustomBinding = Metrics.validateExerciseSourceBinding({
  metricOrigin: "user_defined",
  metricIds: [repsMetric.id],
  metricDefinitions: [repsMetric],
  sourceId: customState.id,
  sourceExercise: null,
  bodyweightCoefficient: 1.01,
});
assert.equal(unboundedCustomBinding.ok, false,
  "captured custom loading coefficients stay within the shared [0, 1] contract");

for (const [convention, multiplier, accepted] of [
  ["external", 1, true],
  ["external", 2, false],
  ["assistance", 1, true],
  ["assistance", 2, false],
  ["bodyweight", 0, true],
  ["bodyweight", 1, false],
  ["per_side", null, true],
  ["per_side", 0.25, true],
  ["per_side", 10, true],
  ["per_side", 0, false],
  ["per_side", 10.01, false],
]) {
  const checkedContext = WorkoutDraft.validateLoadingContext({
    loadingConvention: convention,
    externalLoadMultiplier: multiplier,
    bodyweightCoefficient: null,
  });
  assert.equal(checkedContext.ok, accepted,
    `${convention} loading context multiplier ${multiplier} follows the shared convention contract`);
}
for (const convention of ["external", "assistance"]) {
  for (const [label, context] of [
    ["null", { loadingConvention: convention, externalLoadMultiplier: null, bodyweightCoefficient: null }],
    ["missing", { loadingConvention: convention, bodyweightCoefficient: null }],
  ]) {
    assert.equal(WorkoutDraft.validateLoadingContext(context).ok, false,
      `${convention} DraftV2 context refuses a ${label} multiplier because its History row must be canonical`);
  }
}

const mismatchedDraftCoefficient = structuredClone(actualDraft);
mismatchedDraftCoefficient.exercises[activeSlot.id].programmed.loadingContext.bodyweightCoefficient =
  activeSlot.loadingModel.bodyweightCoefficient === 0 ? 0.5 : 0;
assert.equal(WorkoutDraft.validate(mismatchedDraftCoefficient).ok, false,
  "DraftV2 refuses a loading-context coefficient that differs from its programmed model");

const invalidExternalDraftMultiplier = structuredClone(actualDraft);
invalidExternalDraftMultiplier.exercises[activeSlot.id].programmed.loadingContext.externalLoadMultiplier = 2;
assert.equal(WorkoutDraft.validate(invalidExternalDraftMultiplier).ok, false,
  "DraftV2 refuses an external-load multiplier that the History boundary cannot accept");

const unsupportedDraftLoadingContext = structuredClone(valid);
unsupportedDraftLoadingContext.workoutDraft.exercises[activeSlot.id].programmed.loadingContext.externalLoadMultiplier = 0;
unsupportedDraftLoadingContext.integrity.canonicalPayloadHash = canonicalHash(unsupportedDraftLoadingContext);
const refusedDraftLoadingContext = await Contract.validateEnvelopeIntegrity(unsupportedDraftLoadingContext, webcrypto);
assert.equal(refusedDraftLoadingContext.ok, false,
  "install transfer preserves loading-context consistency inside the active DraftV2");

const unsupportedDraftRest = structuredClone(valid);
unsupportedDraftRest.workoutDraft.exercises[activeSlot.id].sets[draftSetId].programmed.restSeconds = 86401;
unsupportedDraftRest.integrity.canonicalPayloadHash = canonicalHash(unsupportedDraftRest);
const refusedDraftRest = await Contract.validateEnvelopeIntegrity(unsupportedDraftRest, webcrypto);
assert.equal(refusedDraftRest.ok, false,
  "install transfer rejects producer-invalid rest prescriptions in the active DraftV2");

const unsupportedEntryDraft = structuredClone(valid);
unsupportedEntryDraft.programEntryDraft = { schemaVersion: 1, family: "growth", blueprintId: "growth_3_v1" };
unsupportedEntryDraft.integrity.canonicalPayloadHash = canonicalHash(unsupportedEntryDraft);
const refusedEntryDraft = await Contract.validateEnvelopeIntegrity(unsupportedEntryDraft, webcrypto);
assert.equal(refusedEntryDraft.ok, false, "legacy compiler-envelope drafts are refused instead of reconstructed");

console.log("PASS Plan 067 install-transfer clone contract");
