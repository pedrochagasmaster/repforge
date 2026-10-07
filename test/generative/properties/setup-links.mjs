/** v4 setup proposal preservation, privacy, and size properties. */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary, pollutedPayloadArbitrary } from "../arbitraries/setup-payload.mjs";
import { deepEqual, stableStringify, containsText } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup } = domain;
const OPTS = domain.opts();

function containsSentinel(value, sentinels) {
  return sentinels.some((sentinel) => containsText(value, sentinel));
}

function containsNumber(value, expected) {
  if (typeof value === "number") return value === expected;
  if (Array.isArray(value)) return value.some((entry) => containsNumber(entry, expected));
  if (value && typeof value === "object") return Object.values(value).some((entry) => containsNumber(entry, expected));
  return false;
}

export function buildSuites() {
  return [
    {
      name: "setup links: v4 decode(encode(payload)) preserves the canonical proposal exactly",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const before = stableStringify(payload);
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`generated v4 proposal rejected: ${checked.issues}`);
        if (stableStringify(payload) !== before) throw new Error("validate mutated the source proposal");
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) throw new Error(`small valid source UUID fixture failed to encode: ${encoded.code}`);
        if (!/^v4\.[A-Za-z0-9_-]+$/.test(encoded.value)) throw new Error(`malformed v4 envelope: ${encoded.value.slice(0, 10)}`);
        if (encoded.value.length > Setup.MAX_ENCODED_CHARS) throw new Error("writer crossed the hard envelope ceiling");
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok) throw new Error(`v4 decode failed: ${decoded.code}`);
        if (!deepEqual(decoded.value, checked.value)) {
          throw new Error(`v4 round trip changed the proposal\nexpected: ${stableStringify(checked.value)}\nactual: ${stableStringify(decoded.value)}`);
        }
      }),
    },
    {
      name: "setup links: performed and device-state pollution is refused whole and never encoded",
      property: fc.asyncProperty(pollutedPayloadArbitrary(), async ({ payload, sentinels }) => {
        const before = stableStringify(payload);
        const checked = Setup.validate(payload, OPTS);
        if (checked.ok) throw new Error("state-shaped or performed values were accepted into a setup proposal");
        if (!stableStringify(payload).includes(sentinels[0])) throw new Error("pollution fixture lost its private sentinel");
        if (containsSentinel(checked, sentinels)) throw new Error("validation result echoed private actual data");
        if (containsNumber(checked, 777)) throw new Error("validation result retained the performed metric actual");
        const encoded = await Setup.encode(payload, OPTS);
        if (encoded.ok) throw new Error("writer encoded a proposal that the validator refused");
        if (containsSentinel(encoded, sentinels)) throw new Error("encode failure echoed private actual data");
        if (containsNumber(encoded, 777)) throw new Error("encode failure retained the performed metric actual");
        if (stableStringify(payload) !== before) throw new Error("privacy rejection mutated the input proposal");
      }),
    },
    {
      name: "setup links: accepted proposals are validation fixed points",
      property: fc.property(payloadArbitrary(), (payload) => {
        const once = Setup.validate(payload, OPTS);
        if (!once.ok) throw new Error(`valid fixture rejected: ${once.issues}`);
        const twice = Setup.validate(once.value, OPTS);
        if (!twice.ok || !deepEqual(once.value, twice.value)) throw new Error("canonical proposal changed on revalidation");
      }),
    },
    {
      name: "setup links: v4 writer enforces the character ceiling with typed refusal",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const encoded = await Setup.encode(payload, OPTS);
        if (encoded.ok) {
          if (encoded.value.length > Setup.MAX_ENCODED_CHARS) throw new Error(`v4 output exceeded ${Setup.MAX_ENCODED_CHARS} characters`);
        } else if (encoded.code !== "encoded-too-large" && encoded.code !== "decompressed-too-large") {
          throw new Error(`valid proposal failed for an unrelated reason: ${encoded.code}`);
        }
      }),
    },
  ];
}
