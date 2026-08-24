/**
 * Malformed-input robustness.
 *
 * decode is the first code a received setup link touches. Whatever string
 * arrives — truncated, corrupted, hostile, or merely weird — it must answer
 * with a typed result and never throw. (Proposal §11.)
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary } from "../arbitraries/setup-payload.mjs";
import {
  envelopeShapeArbitrary,
  junkString,
  truncateEnvelope,
  flipEnvelopeBytes,
  applyMutationOp,
  encodeVersionedEnvelope,
} from "../arbitraries/malformed.mjs";
import { deepEqual } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup } = domain;
const OPTS = domain.opts();

export const DECODE_FAILURE_CODES = new Set([
  "missing",
  "unsupported-version",
  "encoded-too-large",
  "invalid-base64",
  "invalid-gzip",
  "decompressed-too-large",
  "invalid-utf8",
  "invalid-json",
  "invalid-schema",
]);

async function assertDecodeTotality(input) {
  let result;
  try {
    result = await Setup.decode(input, OPTS);
  } catch (error) {
    throw new Error(`decode threw on ${describeInput(input)}: ${error.stack}`);
  }
  if (!result || typeof result.ok !== "boolean") {
    throw new Error(`decode returned a non-result for ${describeInput(input)}`);
  }
  if (!result.ok && !DECODE_FAILURE_CODES.has(result.code)) {
    throw new Error(`untyped failure code "${result.code}" for ${describeInput(input)}`);
  }
  if (result.ok && !Setup.validate(result.value, OPTS).ok) {
    throw new Error("decode accepted an envelope whose value fails validation");
  }
  return result;
}

function describeInput(input) {
  if (typeof input !== "string") return String(input);
  return JSON.stringify(input.length > 80 ? `${input.slice(0, 77)}…` : input);
}

export function buildSuites() {
  return [
    {
      name: "decode totality: adversarial envelopes never throw and always answer typed results",
      property: fc.asyncProperty(envelopeShapeArbitrary(), async (shape) => {
        const reference = await Setup.encode(
          {
            kind: "taurifer-shared-setup",
            version: 1,
            program: {
              meta: { name: "Reference", daysPerWeek: 1, mesocycleLengthWeeks: 4 },
              exercises: [
                { day: "Day 1", order: 1, libraryId: "pr_mc", sets: 3, min: 6, max: 10, notes: "", alternates: [] },
              ],
              customExercises: [],
            },
            settings: {
              jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120,
              unit: "kg", lang: "en", rirMode: "numeric",
            },
          },
          OPTS,
        );
        if (!reference.ok) throw new Error("precondition: reference encode failed");
        const env = reference.value;

        switch (shape.kind) {
          case "junk":
            await assertDecodeTotality(junkString(shape.textSeed, shape.length));
            break;
          case "prefixed-junk":
            await assertDecodeTotality(`v${shape.versionDigit}.${junkString(shape.textSeed, shape.length)}`);
            break;
          case "truncated":
            await assertDecodeTotality(truncateEnvelope(env, shape.truncationRatio));
            break;
          case "byte-flipped":
            await assertDecodeTotality(flipEnvelopeBytes(env, shape.flips));
            break;
          case "mutated-json": {
            // Rebuild the canonical payload, mutate it structurally, ship as v1.
            const decoded = await Setup.decode(env, OPTS);
            if (!decoded.ok) throw new Error("precondition: reference decode failed");
            const { value: mutated } = applyMutationOp(decoded.value, shape.mutation);
            await assertDecodeTotality(await encodeVersionedEnvelope(1, JSON.stringify(mutated)));
            break;
          }
          default:
            throw new Error(`unknown envelope kind ${shape.kind}`);
        }
      }),
    },
    {
      name: "decode totality: oversized envelopes are rejected up front with a typed code",
      property: fc.asyncProperty(
        fc.integer({ min: -1, max: 64 }),
        fc.constantFrom("a", "=", "\u00e7", '"'),
        async (deltaFromCeiling, filler) => {
          // delta > 0 exceeds the character ceiling and must be rejected as
          // encoded-too-large before any decoding work. At or below the
          // ceiling the envelope may fail later, but only with a typed code.
          const bodyLength = Setup.MAX_ENCODED_CHARS - 3 + Math.max(0, deltaFromCeiling);
          const input = `v1.${filler.repeat(bodyLength)}`;
          const result = await assertDecodeTotality(input);
          if (!result.ok && input.length > Setup.MAX_ENCODED_CHARS && result.code !== "encoded-too-large") {
            throw new Error(`expected encoded-too-large for oversize input, got ${result.code}`);
          }
          if (result.ok) {
            throw new Error(`an all-filler "${filler}" envelope unexpectedly decoded`);
          }
        },
      ),
    },
    {
      name: "decode consistency: whatever decodes must equal what validates",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`precondition rejected: ${checked.issues}`);
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) return; // size ceiling rejections covered elsewhere
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok || !deepEqual(decoded.value, checked.value)) {
          throw new Error(`pipeline inconsistency: ${decoded.code ?? "semantic drift"}`);
        }
      }),
    },
  ];
}
