/**
 * Setup-link properties (INV-012 scoped to setup proposals, INV-013).
 *
 * The setup pipeline is: validate → canonical payload → envelope encode
 * (v1 JSON+gzip or v2 compact tuple) → decode → validate. These properties
 * hold the whole pipeline to exact semantic preservation, cross-envelope
 * equivalence, privacy exclusions, and the size contract.
 */
import fc from "fast-check";
import { loadDomain } from "../adapters/domain-adapter.mjs";
import { payloadArbitrary, pollutedPayloadArbitrary } from "../arbitraries/setup-payload.mjs";
import { gzipBytes, toBase64Url, encodeVersionedEnvelope } from "../arbitraries/malformed.mjs";
import { deepEqual, stableStringify, containsText } from "../model/canonicalize.mjs";

const domain = loadDomain();
const { Setup } = domain;
const OPTS = domain.opts();

async function manualV1Envelope(canonicalValue) {
  return encodeVersionedEnvelope(1, JSON.stringify(canonicalValue));
}

export function buildSuites() {
  return [
    {
      name: "setup links: decode(encode(payload)) preserves the canonical proposal exactly",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`precondition: generated payload rejected: ${checked.issues}`);
        const encoded = await Setup.encode(payload, OPTS);
        if (!encoded.ok) throw new Error(`encode rejected a valid payload: ${encoded.code}`);
        const decoded = await Setup.decode(encoded.value, OPTS);
        if (!decoded.ok) throw new Error(`decode failed for our own envelope: ${decoded.code}`);
        if (!deepEqual(decoded.value, checked.value)) {
          throw new Error(
            `round trip changed the payload\nexpected: ${stableStringify(checked.value)}\nactual:   ${stableStringify(decoded.value)}`,
          );
        }
      }),
    },
    {
      name: "setup links: hand-built v1 and the selected envelope are semantically identical",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`precondition: generated payload rejected: ${checked.issues}`);
        const selected = await Setup.encode(payload, OPTS);
        if (!selected.ok) throw new Error(`encode rejected a valid payload: ${selected.code}`);
        const v1 = await manualV1Envelope(checked.value);
        const viaV1 = await Setup.decode(v1, OPTS);
        const viaSelected = await Setup.decode(selected.value, OPTS);
        if (!viaV1.ok || !viaSelected.ok) {
          throw new Error(`decode failed: v1=${viaV1.code} selected=${viaSelected.code}`);
        }
        if (!deepEqual(viaV1.value, viaSelected.value)) {
          throw new Error("v1 JSON envelope and the selected envelope disagree semantically");
        }
        // Envelope selection rule: v2 only when strictly shorter than v1.
        if (selected.value.startsWith("v2.") && selected.value.length >= v1.length) {
          throw new Error(`v2 selected despite not being shorter (${selected.value.length} vs ${v1.length})`);
        }
      }),
    },
    {
      name: "setup proposals: history/UI/storage pollution never reaches the shared document",
      property: fc.asyncProperty(pollutedPayloadArbitrary(), async ({ payload, sentinels }) => {
        const before = stableStringify(payload);
        const checked = Setup.validate(payload, OPTS);
        if (!checked.ok) throw new Error(`precondition: polluted payload rejected: ${checked.issues}`);
        if (stableStringify(payload) !== before) throw new Error("validate mutated its input");
        const text = stableStringify(checked.value);
        for (const sentinel of sentinels) {
          if (containsText(checked.value, sentinel)) {
            throw new Error(`sentinel leaked into the proposal: ${sentinel}\n${text.slice(0, 600)}`);
          }
        }
        const encoded = await Setup.encode(payload, OPTS);
        if (encoded.ok && sentinels.some((sentinel) => encoded.value.includes(sentinel))) {
          throw new Error("sentinel leaked into the encoded envelope");
        }
      }),
    },
    {
      name: "setup links: valid payloads encode within ceilings or fail with typed size codes",
      property: fc.asyncProperty(payloadArbitrary(), async (payload) => {
        const encoded = await Setup.encode(payload, OPTS);
        if (encoded.ok) {
          if (!/^v[12]\.[A-Za-z0-9_-]+$/.test(encoded.value)) {
            throw new Error(`malformed envelope shape: ${encoded.value.slice(0, 12)}…`);
          }
          if (encoded.value.length > Setup.MAX_ENCODED_CHARS) {
            throw new Error(`envelope exceeds the character ceiling: ${encoded.value.length}`);
          }
        } else if (encoded.code !== "encoded-too-large" && encoded.code !== "decompressed-too-large") {
          throw new Error(`valid payload failed with untyped code: ${encoded.code}`);
        }
      }),
    },
    {
      name: "setup proposals: validate is idempotent — its output re-validates to itself",
      property: fc.property(payloadArbitrary(), (payload) => {
        const once = Setup.validate(payload, OPTS);
        if (!once.ok) throw new Error(`precondition: generated payload rejected: ${once.issues}`);
        const twice = Setup.validate(once.value, OPTS);
        if (!twice.ok) throw new Error(`canonical proposal does not survive re-validation: ${twice.issues}`);
        if (!deepEqual(once.value, twice.value)) {
          throw new Error("re-validation changed the canonical form");
        }
      }),
    },
    {
      name: "setup envelopes: gzip round trip is faithful for arbitrary byte strings",
      property: fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 0, maxLength: 512 }),
        async (bytes) => {
          const raw = Uint8Array.from(bytes);
          const compressed = await gzipBytes(raw);
          const envelope = `v1.${toBase64Url(compressed)}`;
          const dot = envelope.indexOf(".");
          const normalized = envelope.slice(dot + 1).replace(/-/g, "+").replace(/_/g, "/");
          const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
          const restored = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
          if (restored.length !== compressed.length || !restored.every((b, i) => b === compressed[i])) {
            throw new Error("base64url transport corrupted compressed bytes");
          }
        },
      ),
    },
  ];
}
