/** Total, typed decoding for malformed and unsupported v4 setup envelopes. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary } from "../arbitraries/setup-payload.mjs";
import {
  applyMutationOp,
  decodeEnvelopeJson,
  encodeVersionedEnvelope,
  envelopeShapeArbitrary,
  flipEnvelopeBytes,
  junkString,
  truncateEnvelope,
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
  "invalid-envelope",
  "invalid-gzip",
  "decompression-unavailable",
  "decompressed-too-large",
  "invalid-utf8",
  "invalid-json",
  "invalid-schema",
  "invalid-program-definition",
]);

async function assertDecodeTotality(input) {
  let result;
  try {
    result = await Setup.decode(input, OPTS);
  } catch (error) {
    throw new Error(`decode threw for ${describeInput(input)}: ${error.stack}`);
  }
  if (!result || typeof result.ok !== "boolean") throw new Error(`decode returned no typed result for ${describeInput(input)}`);
  if (!result.ok && !DECODE_FAILURE_CODES.has(result.code)) throw new Error(`untyped decode failure: ${result.code}`);
  if (result.ok) {
    const checked = Setup.validate(result.value, OPTS);
    if (!checked.ok || !deepEqual(checked.value, result.value)) throw new Error("decode returned a noncanonical proposal");
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
      name: "decode totality: adversarial current envelopes never throw or return untyped errors",
      property: fc.asyncProperty(payloadArbitrary(), envelopeShapeArbitrary(), async (payload, shape) => {
        const reference = await Setup.encode(payload, OPTS);
        if (!reference.ok) throw new Error(`valid reference failed to encode: ${reference.code}`);
        switch (shape.kind) {
          case "junk":
            await assertDecodeTotality(junkString(shape.textSeed, shape.length));
            break;
          case "prefixed-junk":
            await assertDecodeTotality(`v${shape.versionDigit}.${junkString(shape.textSeed, shape.length)}`);
            break;
          case "truncated":
            await assertDecodeTotality(truncateEnvelope(reference.value, shape.truncationRatio));
            break;
          case "byte-flipped":
            await assertDecodeTotality(flipEnvelopeBytes(reference.value, shape.flips));
            break;
          case "mutated-json": {
            const tuple = await decodeEnvelopeJson(reference.value);
            const { value: mutated } = applyMutationOp(tuple, shape.mutation);
            await assertDecodeTotality(await encodeVersionedEnvelope(4, JSON.stringify(mutated)));
            break;
          }
          default:
            throw new Error(`unknown adversarial shape ${shape.kind}`);
        }
      }),
    },
    {
      name: "decode totality: hard envelope overflow is refused before base64 or gzip parsing",
      property: fc.asyncProperty(
        fc.integer({ min: 1, max: 64 }),
        fc.constantFrom("a", "=", "\u00e7", '"'),
        async (excess, filler) => {
          const input = `v4.${filler.repeat(Setup.MAX_ENCODED_CHARS - 2 + excess)}`;
          const result = await assertDecodeTotality(input);
          if (input.length <= Setup.MAX_ENCODED_CHARS || result.ok || result.code !== "encoded-too-large") {
            throw new Error(`overflow should be an early encoded-too-large result, got ${result.code}`);
          }
        },
      ),
    },
    {
      name: "decode source bytes: every retired v1-v3 envelope is refused with its exact source string",
      property: fc.asyncProperty(
        fc.constantFrom(1, 2, 3),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 96 }),
        async (version, seed, length) => {
          const source = `v${version}.${junkString(seed, length)}`;
          const result = await assertDecodeTotality(source);
          if (result.ok || result.code !== "unsupported-version") throw new Error(`v${version} did not refuse as unsupported-version`);
          if (result.encoded !== source) throw new Error("unsupported-version result changed the exact source bytes");
        },
      ),
    },
    {
      name: "decode consistency: successful v4 results equal validating the same source proposal",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`valid generated proposal rejected: ${checked.issues}`);
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) throw new Error(`valid small proposal could not encode: ${encoded.code}`);
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok || !deepEqual(decoded.value, checked.value)) {
          throw new Error(`encode/decode diverged from validation: ${decoded.code ?? "semantic mismatch"}`);
        }
      }),
    },
  ];
}
