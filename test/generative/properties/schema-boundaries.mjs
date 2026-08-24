/**
 * Schema boundary robustness.
 *
 * The validator is the gate between untrusted data (received setup links,
 * future import paths) and Taurifer's semantic state. It must never throw,
 * never mutate its input, never admit a non-finite number, and always
 * answer with a typed result. (Proposal §11, INV-009 adjacent.)
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary } from "../arbitraries/setup-payload.mjs";
import { hostileNumber, intIn } from "../arbitraries/numbers.mjs";
import { jsonJunkArbitrary, applyMutationOp, mutationOpArbitrary } from "../arbitraries/malformed.mjs";
import { stableStringify, containsNonFiniteNumber } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup } = domain;
const OPTS = domain.opts();

// Numeric slots with their documented inclusive ranges. `kind: "int"` slots
// must additionally receive integers when accepted.
const NUMERIC_SLOTS = [
  { label: "meta.daysPerWeek", min: 1, max: 7, int: true },
  { label: "meta.mesocycleLengthWeeks", min: 1, max: 52, int: true },
  { label: "exercise.order", min: 1, max: 1000, int: true },
  { label: "exercise.sets", min: 1, max: 100, int: true },
  { label: "exercise.min", min: 1, max: 1000, int: true },
  { label: "exercise.max", min: 1, max: 1000, int: true },
  { label: "exercise.targetRirStart", min: 0, max: 100, int: false },
  { label: "exercise.targetRirEnd", min: 0, max: 100, int: false },
  { label: "exercise.minSets", min: 1, max: 100, int: true },
  { label: "exercise.maxSets", min: 1, max: 100, int: true },
  { label: "settings.jumpPct", min: 0, max: 100, int: false },
  { label: "settings.minJump", min: 0.01, max: 1000, int: false },
  { label: "settings.rirHigh", min: 0, max: 100, int: false },
  { label: "settings.hardRir", min: 0, max: 100, int: false },
  { label: "settings.restSec", min: 0, max: 86400, int: true },
];

function injectHostile(payload, slotLabel, value) {
  const target = structuredClone(payload);
  if (slotLabel.startsWith("meta.")) {
    target.program.meta[slotLabel.slice(5)] = value;
  } else if (slotLabel.startsWith("settings.")) {
    target.settings[slotLabel.slice(9)] = value;
  } else {
    const field = slotLabel.slice("exercise.".length);
    const index = 0; // first exercise keeps minimal counterexamples
    target.program.exercises[index][field] = value;
  }
  return target;
}

export function buildSuites() {
  return [
    {
      name: "schema: hostile values in numeric slots are rejected or cleanly bounded",
      property: fc.property(
        payloadArbitrary(),
        fc.constantFrom(...NUMERIC_SLOTS),
        hostileNumber(),
        (payload, slot, hostile) => {
          const poisoned = injectHostile(payload, slot.label, hostile);
          let result;
          try {
            result = Setup.validate(poisoned, OPTS);
          } catch (error) {
            throw new Error(`validate threw for ${slot.label} = ${String(hostile)}: ${error.message}`);
          }
          if (!result.ok) return;
          const accepted = (() => {
            if (slot.label.startsWith("meta.")) return result.value.program.meta[slot.label.slice(5)];
            if (slot.label.startsWith("settings.")) return result.value.settings[slot.label.slice(9)];
            const field = slot.label.slice("exercise.".length);
            return result.value.program.exercises[0][field];
          })();
          if (typeof accepted !== "number" || !Number.isFinite(accepted)) {
            throw new Error(`${slot.label} accepted non-finite value ${String(accepted)}`);
          }
          if (accepted < slot.min || accepted > slot.max || (slot.int && !Number.isInteger(accepted))) {
            throw new Error(`${slot.label} accepted out-of-contract value ${String(accepted)}`);
          }
          if (containsNonFiniteNumber(result.value)) {
            throw new Error("validated proposal contains a non-finite number");
          }
        },
      ),
    },
    {
      name: "schema: arbitrary junk objects answer typed results without mutation",
      property: fc.property(jsonJunkArbitrary(), (junk) => {
        let snapshot;
        try {
          snapshot = stableStringify(junk);
        } catch {
          snapshot = null;
        }
        let result;
        try {
          result = Setup.validate(junk, OPTS);
        } catch (error) {
          throw new Error(`validate threw on junk input: ${error.message}\ninput: ${String(snapshot).slice(0, 300)}`);
        }
        if (typeof result.ok !== "boolean") throw new Error("result missing ok flag");
        if (!result.ok && typeof result.code !== "string") throw new Error("rejection missing typed code");
        if (snapshot !== null && stableStringify(junk) !== snapshot) throw new Error("validate mutated junk input");
        // Accepted junk must be canonical enough to re-validate (INV-009 shape).
        if (result.ok) {
          const again = Setup.validate(result.value, OPTS);
          if (!again.ok || stableStringify(again.value) !== stableStringify(result.value)) {
            throw new Error("accepted output is not a fixed point of validate");
          }
        }
      }),
    },
    {
      name: "schema: prototype-dangerous keys anywhere are rejected without pollution",
      property: fc.asyncProperty(
        payloadArbitrary(),
        mutationOpArbitrary(),
        fc.constantFrom("__proto__", "prototype", "constructor"),
        async (payload, op, keyName) => {
          // Place the dangerous key at the top level deterministically...
          const topLevel = structuredClone(payload);
          const forged = JSON.parse(`{"${keyName}":{"polluted":true}}`);
          Object.defineProperty(topLevel, keyName, {
            value: forged[keyName],
            enumerable: true,
            writable: true,
            configurable: true,
          });
          const direct = Setup.validate(topLevel, OPTS);
          if (direct.ok) throw new Error(`top-level ${keyName} was accepted`);
          if (direct.code !== "invalid-schema") throw new Error(`expected invalid-schema, got ${direct.code}`);
          // ...and at an arbitrary generated position inside the payload.
          const { value: placed, applied } = applyMutationOp(payload, { ...op, op: "forbidden-key" });
          if (!applied) return; // position could not host a forbidden key (array parent)
          const nested = Setup.validate(placed, OPTS);
          if (nested.ok) throw new Error(`nested ${keyName} at generated path was accepted`);
          // Global object must be untouched either way.
          if (Object.prototype.polluted === true) throw new Error("prototype pollution escaped");
        },
      ),
    },
    {
      name: "schema: version fuzzing answers unsupported-version or invalid-schema",
      property: fc.property(jsonJunkArbitrary(), (versionJunk) => {
        const base = Setup.validate(
          {
            kind: "taurifer-shared-setup",
            version: versionJunk,
            program: { meta: { name: "x", daysPerWeek: 1, mesocycleLengthWeeks: 1 }, exercises: [], customExercises: [] },
            settings: {},
          },
          OPTS,
        );
        if (typeof base.ok !== "boolean") throw new Error("non-boolean ok");
        if (base.ok) throw new Error("accepted a skeleton with junk version");
        if (base.code !== "unsupported-version" && base.code !== "invalid-schema" && base.code !== "$: expected object") {
          throw new Error(`unexpected code for junk version: ${base.code}`);
        }
      }),
    },
    {
      name: "schema: deeply nested but small structures fail safely through encode too",
      property: fc.asyncProperty(intIn(2, 9), async (nesting) => {
        const deep = { kind: "taurifer-shared-setup", version: 1 };
        let cursor = deep;
        for (let i = 0; i < nesting * 12; i++) {
          cursor.nested = {};
          cursor = cursor.nested;
        }
        let encoded;
        try {
          encoded = await Setup.encode(deep, OPTS);
        } catch (error) {
          throw new Error(`encode threw on nested structure: ${error.message}`);
        }
        if (encoded.ok) throw new Error("encoded an invalid payload");
        if (encoded.code !== "invalid-schema") throw new Error(`expected invalid-schema, got ${encoded.code}`);
      }),
    },
  ];
}
