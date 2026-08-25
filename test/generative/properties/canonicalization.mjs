/**
 * Canonicalization properties.
 *
 * shared-setup.canonicalize defines the canonical semantic form every
 * round-trip property compares against. These properties pin its own
 * contract directly: idempotence, deterministic key order, purity, and
 * typed rejection of JSON-unsafe values. (Proposal §10.)
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { jsonJunkArbitrary } from "../arbitraries/malformed.mjs";
import { deepEqual, stableStringify } from "../model/canonicalize.mjs";

const { Setup } = loadDomain();

/** Every object level keeps exactly the same key set after canonicalization. */
function keySetsPreserved(input, output, path = "$") {
  if (typeof input !== "object" || input === null) return null;
  if (Array.isArray(input)) {
    if (!Array.isArray(output) || input.length !== output.length) {
      return `${path}: array shape changed`;
    }
    for (let i = 0; i < input.length; i++) {
      const violation = keySetsPreserved(input[i], output[i], `${path}[${i}]`);
      if (violation) return violation;
    }
    return null;
  }
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return `${path}: container became a different kind`;
  }
  const before = Object.keys(input).sort();
  const after = Object.keys(output).sort();
  if (before.join("\u0000") !== after.join("\u0000")) {
    return `${path}: key set changed (${before} -> ${after})`;
  }
  for (const key of before) {
    const violation = keySetsPreserved(input[key], output[key], `${path}.${key}`);
    if (violation) return violation;
  }
  return null;
}

/** Rebuild the value with every object's keys inserted in reverse order. */
function reverseKeyOrder(value) {
  if (Array.isArray(value)) return value.map(reverseKeyOrder);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).reverse()) out[key] = reverseKeyOrder(value[key]);
    return out;
  }
  return value;
}

export function buildSuites() {
  return [
    {
      name: "canonicalize: idempotent on JSON-safe values",
      property: fc.property(jsonJunkArbitrary(), (value) => {
        const once = Setup.canonicalize(value);
        const twice = Setup.canonicalize(once);
        if (!deepEqual(once, twice)) {
          throw new Error(`canonicalize is not idempotent\nonce:   ${stableStringify(once)}\ntwice:  ${stableStringify(twice)}`);
        }
      }),
    },
    {
      name: "canonicalize: independent of input key order (true canonical form)",
      // NB: the naive "output keys are sorted" assertion is untestable via
      // Object.keys because JS engines enumerate integer-like keys first
      // regardless of insertion order. The honest contract is that two
      // inputs differing only in key order canonicalize identically.
      property: fc.property(jsonJunkArbitrary(), (value) => {
        const twin = reverseKeyOrder(value);
        const direct = Setup.canonicalize(value);
        const shuffled = Setup.canonicalize(twin);
        if (!deepEqual(direct, shuffled)) {
          throw new Error(
            `key order changed the canonical form\noriginal: ${stableStringify(direct).slice(0, 400)}\nreordered: ${stableStringify(shuffled).slice(0, 400)}`,
          );
        }
        const violation = keySetsPreserved(value, direct);
        if (violation) throw new Error(violation);
        // Array order preservation: reversing a generated array must yield
        // a canonically different array whenever elements differ.
        if (Array.isArray(value) && value.length > 1 && !deepEqual(value[0], value[value.length - 1])) {
          const reversed = Setup.canonicalize([...value].reverse());
          if (deepEqual(reversed, direct)) {
            throw new Error("array element order was lost during canonicalization");
          }
        }
      }),
    },
    {
      name: "canonicalize: does not mutate its input",
      property: fc.property(jsonJunkArbitrary(), (value) => {
        const before = stableStringify(value);
        Setup.canonicalize(value);
        const after = stableStringify(value);
        if (before !== after) throw new Error("input object was mutated");
      }),
    },
    {
      name: "canonicalize: rejects JSON-unsafe leaves with TypeError",
      property: fc.property(
        fc.constantFrom(undefined, NaN, Infinity, -Infinity, () => {}, new Date(0), Symbol("x"), 10n),
        (poison) => {
          let error;
          try {
            Setup.canonicalize(poison);
          } catch (caught) {
            error = caught;
          }
          if (!(error instanceof TypeError)) {
            throw new Error(`expected TypeError for ${String(poison)}, got ${error}`);
          }
          // Nested poison must be rejected as well.
          let nestedError;
          try {
            Setup.canonicalize({ ok: [1, { deeper: poison }] });
          } catch (caught) {
            nestedError = caught;
          }
          if (!(nestedError instanceof TypeError)) {
            throw new Error("nested JSON-unsafe leaf was accepted");
          }
        },
      ),
    },
  ];
}
