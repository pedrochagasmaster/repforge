import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import contract from "../../../install-transfer-contract.js";
import programEntry from "../../../program-entry.js";
import definitionFixture from "./fixtures/program-definition-plan067-worker.json" with { type: "json" };
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";

const require = createRequire(import.meta.url);
const ProgramCompiler = require("../../../program-compiler.js");
const rawCatalog = require("../../../assets/exercise-catalog.json");

const definition = structuredClone(definitionFixture);

const slotRows = definition.days.flatMap((day) => day.slots.map((slot) => {
  const sets = slot.prescriptionsByCycle[0].sets;
  const repetition = slot.metricDefinitions.find((metric) => ["reps", "repsPerSide"].includes(metric.semantic));
  const target = repetition ? sets.map((set) => set.targets[repetition.semantic]).find((value) => value != null) : null;
  return {
    id: slot.id,
    slotId: slot.id,
    day: day.name,
    dayId: day.id,
    order: slot.order,
    name: slot.exerciseId,
    libraryId: slot.exerciseId,
    sets: sets.length,
    min: typeof target === "number" ? target : target?.min ?? 1,
    max: typeof target === "number" ? target : target?.max ?? 1,
    notes: slot.setupNotes || "",
    metricIds: [...slot.metricIds],
    metricDefinitions: structuredClone(slot.metricDefinitions),
    prescriptionsByCycle: structuredClone(slot.prescriptionsByCycle),
    loadingModel: structuredClone(slot.loadingModel),
    metricOrigin: slot.metricOrigin,
  };
}));
const actualSlot = definition.days.flatMap((day) => day.slots).find((slot) =>
  slot.metricDefinitions.some((metric) => metric.semantic === "loadKg") &&
  slot.metricDefinitions.some((metric) => metric.semantic === "reps"));
if (!actualSlot) throw new Error("Worker fixture needs a real source load-plus-reps slot");
const actualValues = actualSlot.metricDefinitions.map((metric) => ({
  metricId: metric.id,
  value: metric.semantic === "loadKg" ? 0 : metric.semantic === "reps" ? 8 : 1,
  unit: metric.unit,
}));

function setupPreview(programDefinition) {
  const trainingDays = programDefinition.days.filter((day) => day.kind === "training");
  const rows = [];
  for (const day of trainingDays) {
    for (const slot of day.slots) {
      const cycle = slot.prescriptionsByCycle[0];
      const repSemantic = slot.metricDefinitions.find((metric) =>
        metric.semantic === "reps" || metric.semantic === "repsPerSide")?.semantic;
      const target = repSemantic ? cycle.sets.map((set) => set.targets[repSemantic]).find((value) => value != null) : null;
      rows.push({
        id: slot.id,
        slotId: slot.id,
        dayId: day.id,
        day: day.name,
        order: slot.order,
        name: slot.exerciseId,
        libraryId: slot.exerciseId,
        sets: cycle.sets.length,
        hasRepTarget: Boolean(repSemantic),
        ...(repSemantic ? {
          min: typeof target === "number" ? target : target?.min,
          max: typeof target === "number" ? target : target?.max,
        } : {}),
      });
    }
  }
  return {
    source: "compiler",
    frequency: programDefinition.request.daysPerWeek,
    program: rows,
    programDefinition: structuredClone(programDefinition),
    programStructure: {
      schemaVersion: 1,
      days: trainingDays.map((day) => ({ dayId: day.id, label: day.name, order: day.order })),
    },
    days: trainingDays.map((day) => ({
      dayId: day.id,
      label: day.name,
      order: day.order,
      exercises: structuredClone(rows.filter((row) => row.dayId === day.id)),
    })),
    customExercises: [],
  };
}

const entryNow = "2026-10-06T09:00:00.000Z";
const entryVersions = {
  compiler: "067.1",
  family: "retired",
  blueprint: "1",
  catalogue: "raw-uuid@1",
  rules: "source-metrics@1",
  context: "program-definition@1",
  progression: "067.1",
  recentConsistency: "retired",
  simpleStart: "retired",
};
let entryState = programEntry.selectRoute(programEntry.createState({
  draftId: "entry-worker-canonical-candidate",
  activeProgramRevisionAtStart: 9,
  now: entryNow,
  versions: entryVersions,
}), "build");
entryState = programEntry.setAnswers(entryState, {
  programName: "Worker canonical candidate",
  daysPerWeek: definition.request.daysPerWeek,
});
entryState = programEntry.advance(entryState).state;
entryState = programEntry.setResult(entryState, {
  fingerprint: "worker-canonical-program-entry",
  name: "Worker canonical candidate",
  selected: { id: "worker-canonical-program" },
  preview: setupPreview(definition),
});
globalThis.RepForgeProgramCompiler = ProgramCompiler;
globalThis.RepForgeExerciseCatalog = { snapshot: () => rawCatalog };
const normalizedEntryState = programEntry.normalizeSetupDraft(entryState);
delete globalThis.RepForgeProgramCompiler;
delete globalThis.RepForgeExerciseCatalog;
if (!normalizedEntryState.ok) {
  throw new Error("Worker proof setup state must normalize before crossing the Worker boundary");
}
entryState = normalizedEntryState.value;

// The test compiles an authentic candidate outside the Worker module graph,
// then removes every browser-style global. Worker validation must resolve the
// compiler, entry, metric/workout validators, and the full raw JSON catalog itself.
delete globalThis.RepForgeProgramCompiler;
delete globalThis.RepForgeExerciseMetrics;
delete globalThis.RepForgeWorkoutDraft;
delete globalThis.RepForgeExerciseCatalog;
delete globalThis.RepForgeProgramEntry;

const sourceEnvelope = {
  kind: "taurifer-install-transfer",
  schemaVersion: 1,
  createdAt: "2026-10-06T09:00:00.000Z",
  source: { context: "browser", logicalInstallationId: "li-worker-runtime" },
  sourceRevision: 9,
  durableState: {
    settings: {},
    programMeta: { id: "program-worker-runtime", programDefinition: definition },
    program: slotRows,
    log: [{
      session: "2026-10-06T09:00:00.000Z",
      date: "2026-10-06",
      day: "Worker runtime proof",
      name: "Compiler-authored source movement",
      exerciseId: actualSlot.exerciseId,
      set: 1,
      setIndex: 0,
      load: 0,
      reps: 8,
      rir: 2,
      notes: "",
      created: "2026-10-06T09:05:00.000Z",
      metricType: "source_metrics@1",
      sourceLibraryId: actualSlot.exerciseId,
      metricOrigin: actualSlot.metricOrigin,
      metricIds: [...actualSlot.metricIds],
      metricDefinitions: structuredClone(actualSlot.metricDefinitions),
      metricValues: actualValues,
      equipmentId: null,
      loadingConvention: "external",
      bodyweight: null,
      loadingModel: structuredClone(actualSlot.loadingModel),
      loadingContext: {
        loadingConvention: "external",
        bodyweightContributionEnabled: false,
        bodyweightKg: null,
        externalLoadMultiplier: 1,
        bodyweightCoefficient: actualSlot.loadingModel.bodyweightCoefficient,
      },
      restSeconds: actualSlot.prescriptionsByCycle[0].sets[0].restSeconds,
    }],
    programHistory: [],
    customExercises: [],
  },
  workoutDraft: null,
  programEntryDraft: entryState,
  uiPreferences: {},
  analytics: { enabled: false },
  telemetryIdentity: {
    schemaVersion: 1,
    installationId: "telemetry-worker-runtime",
    createdAt: "2026-10-06T09:00:00.000Z",
  },
  integrity: { canonicalPayloadHash: "" },
};
sourceEnvelope.integrity.canonicalPayloadHash = createHash("sha256")
  .update(contract.canonicalJson({ ...sourceEnvelope, integrity: {} }), "utf8")
  .digest("hex");

async function refreshWorkerHealth() {
  const now = Date.now();
  const stub = euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
  await stub.markDeletionUnhealthy({ now });
  for (const kind of ["alarm", "watchdog", "log", "key"]) {
    await stub.recordHeartbeat({ kind, observedAt: now, now });
  }
  await stub.recordDeletionHealth({ healthy: true, observedAt: now, now });
  await stub.recordBilling({ monthlyCostCents: 1, observedAt: now, now });
  const snapshot = await stub.snapshot({ now });
  await stub.acknowledgeDeletion({ generation: snapshot.incidentGeneration, proofNonce: "W".repeat(32), now });
}

describe("Worker canonical runtime dependencies", () => {
  beforeEach(async () => {
    await reset();
    await refreshWorkerHealth();
  });

  it("validates a real compiler definition and UUID metric actual without app globals", async () => {
    expect(globalThis.RepForgeProgramCompiler).toBeUndefined();
    expect(globalThis.RepForgeExerciseMetrics).toBeUndefined();
    expect(globalThis.RepForgeWorkoutDraft).toBeUndefined();
    expect(globalThis.RepForgeExerciseCatalog).toBeUndefined();
    expect(globalThis.RepForgeProgramEntry).toBeUndefined();

    const request = new Request("https://transfer.example/v1/transfers", {
      method: "POST",
      headers: {
        Origin: "https://taurifer.example",
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "CF-Connecting-IP": "198.51.100.86",
      },
      body: JSON.stringify({ envelope: sourceEnvelope, idempotencyKey: "canonical-worker-runtime-proof" }),
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ token: expect.stringMatching(/^v1\./) });
    expect(globalThis.RepForgeProgramCompiler).toBeUndefined();
    expect(globalThis.RepForgeExerciseMetrics).toBeUndefined();
    expect(globalThis.RepForgeWorkoutDraft).toBeUndefined();
    expect(globalThis.RepForgeExerciseCatalog).toBeUndefined();
    expect(globalThis.RepForgeProgramEntry).toBeUndefined();
  });
});
