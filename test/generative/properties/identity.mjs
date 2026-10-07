/** Raw UUID identity and custom-definition integrity across the v4 share path. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { attachCustomReference, customPayloadArbitrary, payloadArbitrary, rawUuidArbitrary } from "../arbitraries/setup-payload.mjs";
import { deepEqual, stableStringify } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup, BUILT_IN_IDS, CATALOG_SNAPSHOT, EXERCISES_BY_ID } = domain;
const OPTS = domain.opts();
const RETIRED_SHORT_IDS = Object.freeze(["ab_mc", "dl_bb", "pr_mc", "sq_bb", "wc_bb"]);

(function auditRawCatalog() {
  if (BUILT_IN_IDS.size !== CATALOG_SNAPSHOT.exercises.length) throw new Error("raw catalog UUID index contains duplicate exercise identities");
  for (const exercise of CATALOG_SNAPSHOT.exercises) {
    if (!/^[a-f0-9]{32}$/.test(exercise.id) || EXERCISES_BY_ID.get(exercise.id) !== exercise) {
      throw new Error(`catalog exercise is not keyed by its exact source UUID: ${exercise.id}`);
    }
  }
  for (const retired of RETIRED_SHORT_IDS) if (BUILT_IN_IDS.has(retired)) throw new Error(`retired short ID became a catalog identity: ${retired}`);
})();

export function buildSuites() {
  return [
    {
      name: "identity: raw catalog UUID and ordered source identity survive v4 encode and decode",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const exerciseId = payload.program.definition.days[0].slots[0].exerciseId;
        if (!BUILT_IN_IDS.has(exerciseId)) throw new Error(`valid fixture used a non-catalog ID: ${exerciseId}`);
        const before = payload.program.definition.days[0].slots[0];
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) throw new Error(`small valid ProgramDefinition did not encode: ${encoded.code}`);
        if (!encoded.value.startsWith("v4.")) throw new Error("the current setup writer did not emit v4");
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok) throw new Error(`current raw UUID failed v4 decode: ${decoded.code}`);
        const after = decoded.value.program.definition.days[0].slots[0];
        if (before.exerciseId !== after.exerciseId || !deepEqual(before.sourceExerciseIds, after.sourceExerciseIds)) {
          throw new Error(`source exercise identity changed: ${before.exerciseId} → ${after.exerciseId}`);
        }
        const source = EXERCISES_BY_ID.get(after.exerciseId);
        if (!source || !deepEqual(after.metricIds, source.exerciseMetrics || [])) {
          throw new Error(`source metric order diverged for ${after.exerciseId}`);
        }
      }),
    },
    {
      name: "identity: unknown UUID-like strings and retired short IDs are rejected without aliasing",
      property: fc.property(
        payloadArbitrary(),
        fc.oneof(
          { weight: 3, arbitrary: fc.string({ minLength: 1, maxLength: 32 }).filter((value) => !BUILT_IN_IDS.has(value) && !value.startsWith("custom:")) },
          { weight: 1, arbitrary: fc.constantFrom(...RETIRED_SHORT_IDS) },
        ),
        (payload, unknownId) => {
          const target = structuredClone(payload);
          const slot = target.program.definition.days[0].slots[0];
          slot.exerciseId = unknownId;
          slot.sourceExerciseIds = [unknownId];
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error(`unknown or retired movement identity resolved: ${unknownId}`);
          if (result.code !== "invalid-schema" && result.code !== "invalid-program-definition") {
            throw new Error(`unexpected unknown-identity result: ${result.code}`);
          }
        },
      ),
    },
    {
      name: "identity: custom reference requires the exact carried compiler-approved definition",
      property: fc.property(customPayloadArbitrary(), (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`custom fixture precondition failed: ${checked.issues}`);
        const custom = checked.value.program.customExercises[0];
        if (checked.value.program.definition.days[0].slots[0].exerciseId !== custom.id) {
          throw new Error("custom slot did not retain its authored identity");
        }
        const missing = structuredClone(payload);
        missing.program.customExercises = [];
        const result = Setup.validate(missing, OPTS);
        if (result.ok) throw new Error("custom slot resolved without its exact definition");
        if (result.code !== "invalid-schema" && result.code !== "invalid-program-definition") {
          throw new Error(`unexpected missing-custom result: ${result.code}`);
        }
      }),
    },
    {
      name: "identity: custom UUIDs and canonical metric order survive the v4 share path exactly",
      property: fc.asyncProperty(customPayloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`custom fixture precondition failed: ${checked.issues}`);
        const before = checked.value.program.customExercises;
        const encoded = await Setup.encode(checked.value, OPTS);
        if (!encoded.ok) throw new Error(`small custom definition did not encode: ${encoded.code}`);
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok) throw new Error(`custom definition did not decode: ${decoded.code}`);
        if (!deepEqual(before, decoded.value.program.customExercises)) throw new Error("custom definition or metric order changed through v4");
        const slot = decoded.value.program.definition.days[0].slots[0];
        if (slot.exerciseId !== before[0].id || !deepEqual(slot.metricIds, before[0].metricIds)) {
          throw new Error("custom reference and ordered metric IDs no longer match");
        }
      }),
    },
    {
      name: "identity: unreferenced custom definitions remain exact shared program content",
      property: fc.property(customPayloadArbitrary(), (payload) => {
        const target = structuredClone(payload);
        const sourceId = [...BUILT_IN_IDS][0];
        const slot = target.program.definition.days[0].slots[0];
        const exercise = EXERCISES_BY_ID.get(sourceId);
        slot.exerciseId = sourceId;
        slot.sourceExerciseIds = [sourceId];
        slot.role = "manual";
        slot.metricIds = [...(exercise.exerciseMetrics || [])];
        const definitions = domain.Metrics.definitionsForIds(slot.metricIds);
        slot.metricDefinitions = definitions.value;
        slot.metricOrigin = "source_catalog";
        slot.loadingModel = { bodyweightCoefficient: Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null };
        slot.musclePurposeIds = [...(exercise.primaryFeatureMuscle || [])];
        slot.movementPatternIds = [...(exercise.movementPattern || [])];
        if (exercise.exerciseType) slot.exerciseTypeId = exercise.exerciseType;
        else delete slot.exerciseTypeId;
        const set = slot.prescriptionsByCycle[0].sets[0];
        set.metricIds = [...slot.metricIds];
        set.metricDefinitions = structuredClone(slot.metricDefinitions);
        set.targets = slot.metricDefinitions.some((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide")
          ? { [slot.metricDefinitions.find((metric) => metric.semantic === "reps" || metric.semantic === "repsPerSide").semantic]: { min: 6, max: 10 } }
          : {};
        set.status = slot.metricIds.length ? "ready" : "configuration_required";
        const expected = structuredClone(target.program.customExercises);
        const checked = Setup.validate(target, OPTS);
        if (!checked.ok) throw new Error(`valid unreferenced custom was rejected: ${checked.issues}`);
        if (!deepEqual(checked.value.program.customExercises, expected)) throw new Error("an unreferenced shared custom was silently dropped or altered");
      }),
    },
    {
      name: "identity: custom IDs cannot shadow source UUIDs or omit the custom prefix",
      property: fc.property(
        payloadArbitrary(),
        fc.oneof(
          { weight: 1, arbitrary: rawUuidArbitrary() },
          { weight: 1, arbitrary: fc.constantFrom("row", "custom:", "custom", ":x") },
        ),
        (payload, badId) => {
          const target = attachCustomReference(payload, { id: badId, name: "Shadow attempt" });
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error(`illegal custom ID accepted: ${badId}`);
        },
      ),
    },
  ];
}
