/**
 * Exercise identity properties (INV-005, INV-006, INV-009).
 *
 * Library ids are persisted in saved programs and must never be repointed
 * at a different movement. These properties machine-check the identity
 * contract across the whole share pipeline: current built-ins resolve,
 * legacy aliases and unknown strings are rejected by the strict validator,
 * custom references require carried definitions, and every libraryId that
 * enters encode comes out byte-identical.
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary, BUILT_IN_IDS } from "../arbitraries/setup-payload.mjs";
import { deepEqual, stableStringify } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup, EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = domain;
const OPTS = domain.opts();

// Deterministic preconditions: the frozen fixture vocabulary must stay in
// lockstep with the generated exercise library. A violation here is a
// repository bug, not a property failure.
(function auditIdentitySources() {
  const ids = EXERCISE_LIBRARY.map((entry) => entry.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error("EXERCISE_LIBRARY contains duplicate ids");
  if (ids.some((id) => typeof id !== "string" || !id)) throw new Error("EXERCISE_LIBRARY contains empty ids");
  for (const fixtureId of BUILT_IN_IDS) {
    if (!unique.has(fixtureId)) throw new Error(`fixture id ${fixtureId} missing from EXERCISE_LIBRARY`);
  }
  for (const legacyId of Object.keys(LEGACY_LIBRARY_IDS || {})) {
    if (unique.has(legacyId)) {
      throw new Error(`legacy alias ${legacyId} is also a current id — repointing forbidden`);
    }
  }
})();

export function buildSuites() {
  return [
    {
      name: "identity: built-in references survive the full share pipeline verbatim",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const before = payload.program.exercises.map((entry) => entry.libraryId);
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) throw new Error(`encode rejected valid payload: ${encoded.code}`);
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok) throw new Error(`decode failed: ${decoded.code}`);
        const after = decoded.value.program.exercises.map((entry) => entry.libraryId);
        if (stableStringify(before) !== stableStringify(after)) {
          throw new Error(`libraryIds changed through the pipeline\nbefore: ${before.join(",")}\nafter:  ${after.join(",")}`);
        }
      }),
    },
    {
      name: "identity: unknown reference strings are rejected as invalid-schema",
      property: fc.property(
        payloadArbitrary(),
        fc.string({ minLength: 1, maxLength: 24 }).filter((s) => !domain.BUILT_IN_IDS.has(s) && !s.startsWith("custom:")),
        (payload, bogusId) => {
          const target = structuredClone(payload);
          target.program.exercises[0].libraryId = bogusId;
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error(`unknown libraryId accepted: ${JSON.stringify(bogusId)}`);
          if (result.code !== "invalid-schema") throw new Error(`expected invalid-schema, got ${result.code}`);
        },
      ),
    },
    {
      name: "identity: legacy aliases never resolve through the strict validator",
      property: fc.property(
        payloadArbitrary(),
        fc.constantFrom(...Object.keys(LEGACY_LIBRARY_IDS && typeof LEGACY_LIBRARY_IDS === "object" ? LEGACY_LIBRARY_IDS : { dl_mc: 1 })),
        (payload, legacyId) => {
          const target = structuredClone(payload);
          target.program.exercises[0].libraryId = legacyId;
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error(`legacy alias resolved: ${legacyId}`);
          if (result.code !== "invalid-schema") throw new Error(`expected invalid-schema for ${legacyId}, got ${result.code}`);
        },
      ),
    },
    {
      name: "identity: custom references require a carried definition",
      property: fc.property(
        payloadArbitrary(),
        fc.integer({ min: 0, max: 5 }),
        (payload, selector) => {
          const target = structuredClone(payload);
          if (selector % 2 === 0) {
            // Remove a definition that at least one exercise references.
            const referenced = new Set(target.program.exercises.map((entry) => entry.libraryId));
            const victims = target.program.customExercises.filter((custom) => referenced.has(custom.id));
            if (victims.length === 0) return; // nothing dangling-able in this sample
            const victim = victims[Math.floor(selector / 2) % victims.length].id;
            target.program.customExercises = target.program.customExercises.filter((custom) => custom.id !== victim);
          } else {
            // Point an exercise at a definition that was never carried.
            target.program.exercises[0].libraryId = `custom:orphan-${selector}`;
          }
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error("dangling custom reference was accepted");
          if (result.code !== "invalid-schema") throw new Error(`expected invalid-schema, got ${result.code}`);
        },
      ),
    },
    {
      name: "identity: unreferenced custom definitions are dropped, referenced ones preserved exactly",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`precondition rejected: ${checked.issues}`);
        const referencedIds = new Set(payload.program.exercises.map((entry) => entry.libraryId));
        for (const custom of checked.value.program.customExercises) {
          if (!referencedIds.has(custom.id)) throw new Error(`unreferenced custom survived: ${custom.id}`);
        }
        const inputReferenced = payload.program.customExercises.filter((custom) => referencedIds.has(custom.id));
        if (
          checked.value.program.customExercises.length !== inputReferenced.length ||
          !deepEqual(
            checked.value.program.customExercises.map((c) => c.id).sort(),
            inputReferenced.map((c) => c.id).sort(),
          )
        ) {
          throw new Error("referenced customs were altered or dropped");
        }
      }),
    },
    {
      name: "identity: custom ids cannot shadow built-ins or omit the custom: prefix",
      property: fc.property(
        payloadArbitrary(),
        fc.oneof(
          { weight: 1, arbitrary: fc.constantFrom(...BUILT_IN_IDS) },
          { weight: 1, arbitrary: fc.constantFrom("row", "custom:", "custom", ":x") },
        ),
        (payload, badCustomId) => {
          const target = structuredClone(payload);
          target.program.customExercises.push({
            id: badCustomId,
            name: "Shadow attempt",
            equipment: ["machine"],
          });
          const result = Setup.validate(target, OPTS);
          if (result.ok) throw new Error(`illegal custom id accepted: ${badCustomId}`);
        },
      ),
    },
  ];
}
