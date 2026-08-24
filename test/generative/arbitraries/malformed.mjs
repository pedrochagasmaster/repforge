/**
 * Adversarial envelope and JSON-payload builders.
 *
 * fast-check generates the *shape* parameters synchronously; the async
 * helpers here do the gzip/base64 work inside property bodies so every
 * byte of an attack string is derived deterministically from the generated
 * case.
 */
import fc from "fast-check";
import { jsonPaths } from "../model/canonicalize.mjs";

export async function gzipBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function encodeVersionedEnvelope(version, text) {
  const bytes = await gzipBytes(new TextEncoder().encode(text));
  return `v${version}.${toBase64Url(bytes)}`;
}

const MUTATION_OPS = ["delete-key", "replace-value", "duplicate-array-item", "truncate-string", "forbidden-key"];
const REPLACE_VALUES = [null, true, false, 0, -1, "", "fr", 99, [], {}];

/**
 * A mutator description whose parameters are fast-check generated;
 * applying it with `applyMutationOp` is deterministic.
 */
export function mutationOpArbitrary() {
  return fc.record({
    op: fc.constantFrom(...MUTATION_OPS),
    ratio: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    valueIndex: fc.nat(REPLACE_VALUES.length - 1),
    forbiddenKey: fc.constantFrom("__proto__", "prototype", "constructor"),
  });
}

function applyRatio(list, ratio) {
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.floor(ratio * list.length))];
}

/**
 * Apply one deterministic mutation to a structuredClone of `root`.
 * Returns `{ value, applied }` — `applied` is false when the generated
 * position could not host the operation (e.g. forbidden keys need an
 * object parent).
 */
export function applyMutationOp(root, op) {
  const target = structuredClone(root);
  const paths = jsonPaths(target);
  const path = applyRatio(paths, op.ratio);
  if (!path) return { value: target, applied: false };
  let parent = target;
  for (let i = 0; i < path.length - 1; i++) parent = parent[path[i]];
  const key = path[path.length - 1];
  const value = parent[key];
  let applied = true;
  switch (op.op) {
    case "delete-key":
      if (Array.isArray(parent)) parent.splice(key, 1);
      else delete parent[key];
      break;
    case "replace-value":
      parent[key] = REPLACE_VALUES[op.valueIndex];
      break;
    case "duplicate-array-item":
      if (Array.isArray(parent)) parent.splice(key, 0, structuredClone(value));
      else applied = false;
      break;
    case "truncate-string":
      if (typeof value === "string" && value.length > 0) {
        const keep = Math.floor(op.ratio * 997) % (value.length + 1);
        parent[key] = value.slice(0, keep);
      } else {
        applied = false;
      }
      break;
    case "forbidden-key":
      if (parent && typeof parent === "object" && !Array.isArray(parent)) {
        const forged = JSON.parse(`{"${op.forbiddenKey}":{"injected":true}}`);
        Object.defineProperty(parent, op.forbiddenKey, {
          value: forged[op.forbiddenKey],
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        applied = false;
      }
      break;
    default:
      applied = false;
      break;
  }
  return { value: target, applied };
}

/**
 * Envelope shapes for decode-robustness properties. Everything except the
 * real envelope (supplied by the property body) is generated here.
 */
export function envelopeShapeArbitrary() {
  return fc.record({
    kind: fc.constantFrom("junk", "prefixed-junk", "truncated", "byte-flipped", "mutated-json"),
    textSeed: fc.integer({ min: 0, max: 0xffffffff }),
    length: fc.integer({ min: 0, max: 96 }),
    versionDigit: fc.nat(11),
    truncationRatio: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
    flips: fc.array(fc.record({ ratio: fc.double({ min: 0, max: 1, noNaN: true }), xor: fc.nat(255) }), {
      maxLength: 6,
    }),
    mutation: mutationOpArbitrary(),
  });
}

const JUNK_ALPHABETS = [
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-",
  "v1.v2.v3.v9.====----____....",
  "\u00e7\u00e3\u4e16\u754c\u{1f3cb}\ufe0f\u2026",
  "\"'{[():],}",
];

/** Deterministic pseudo-random junk derived only from the generated seed. */
export function junkString(seed, length) {
  const alphabet = JUNK_ALPHABETS[Math.abs(seed) % JUNK_ALPHABETS.length];
  let out = "";
  let state = (Math.abs(seed) % 2147483646) + 1;
  for (let i = 0; i < length; i++) {
    state = Math.imul(state, 48271) >>> 0;
    if (state >= 2147483648) state -= 2147483648;
    if (state === 0) state = 7;
    out += alphabet[state % alphabet.length];
  }
  return out;
}

export function truncateEnvelope(envelope, ratio) {
  const cut = Math.max(0, Math.min(envelope.length, Math.floor(ratio * envelope.length)));
  return envelope.slice(0, cut);
}

/** Decode the base64url half, XOR selected offsets, re-encode. */
export function flipEnvelopeBytes(envelope, flips) {
  const dot = envelope.indexOf(".");
  if (dot === -1) return envelope;
  const prefix = envelope.slice(0, dot + 1);
  const body = envelope.slice(dot + 1);
  const normalized = body.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let bytes;
  try {
    bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  } catch {
    return `${prefix}${body}ww`;
  }
  for (const flip of flips) {
    const offset = Math.floor(flip.ratio * bytes.length) % Math.max(1, bytes.length);
    bytes[offset] ^= flip.xor || 1;
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${prefix}${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/** Bounded, JSON-safe junk: the shape of hand-edited or corrupted state. */
export function jsonJunkArbitrary() {
  const { node } = fc.letrec((tie) => ({
    leaf: fc.oneof(
      { weight: 4, arbitrary: text16 },
      { weight: 2, arbitrary: fc.constantFrom(null, true, false) },
      { weight: 2, arbitrary: fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }) },
    ),
    array: fc.array(tie("node"), { maxLength: 3 }),
    object: fc
      .uniqueArray(fc.tuple(text8, tie("node")), { maxLength: 3, comparator: (a, b) => a[0] === b[0] })
      .map(Object.fromEntries),
    node: fc.oneof(
      { weight: 3, arbitrary: tie("leaf") },
      { weight: 1, arbitrary: tie("array") },
      { weight: 1, arbitrary: tie("object") },
    ),
  }));
  return node;
}

const text8 = fc.string({ minLength: 0, maxLength: 8 });
const text16 = fc.string({ minLength: 0, maxLength: 16 });
