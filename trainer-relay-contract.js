/* Trainer relay contract (ADR 0026, Plan 086 slice 1).
 *
 * Shared by the relay Worker (services/trainer-relay/) and the browser client
 * (trainer-relay.js). It owns the endpoints, the limits, the request and
 * record shapes, and the link format. It holds no key material and performs
 * no I/O.
 *
 * The service only ever sees ciphertext: a record is { v, nonce, ciphertext }
 * as unpadded base64url. The 256-bit key lives in the link fragment
 * (`#r=<record id>.<key>`) and is never part of a request.
 */
(function trainerRelayContract(root) {
  "use strict";

  const PROTOCOL_VERSION = 1;

  const ENDPOINTS = Object.freeze({
    create: "/v1/relay/records",
    read: "/v1/relay/records/read",
  });

  const DAY_MS = 24 * 60 * 60 * 1000;

  const LIMITS = Object.freeze({
    // A record is readable for at most seven days (ADR 0026). The service
    // assigns the expiry; a deployment may shorten it, never lengthen it.
    recordLifetimeMs: 7 * DAY_MS,
    minRecordLifetimeMs: 60 * 1000,
    recordIdBytes: 16,
    recordIdChars: 22,
    keyBytes: 32,
    keyChars: 43,
    nonceBytes: 12,
    nonceChars: 16,
    // AES-GCM appends a 16-byte tag; an empty plaintext is refused by the client.
    minCiphertextBytes: 17,
    // The service bound on one record's ciphertext. The client compresses
    // before encrypting, so this bounds the compressed document.
    maxCiphertextBytes: 262_144,
    // The client's bound on a decompressed document.
    maxPlaintextBytes: 2_097_152,
    // JSON wrapper around base64url ciphertext: 4/3 expansion plus a small margin.
    maxCreateBodyBytes: 350_000,
    maxReadBodyBytes: 256,
    createsPerAddressPerHour: 30,
    readsPerAddressPerMinute: 120,
    // Owner decision 2026-11-26: new creates fail at $10 USD per month.
    costThresholdCents: 1_000,
  });

  const FRAGMENT_KEY = "r";
  const AAD_LABEL = "taurifer/trainer-relay/v1";
  const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function exactKeys(value, keys) {
    if (!isPlainObject(value)) return false;
    const own = Object.keys(value);
    return own.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
  }

  function base64UrlEncode(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
  }

  /** Strict unpadded base64url: refuses padding, foreign characters and non-canonical trailing bits. */
  function base64UrlDecode(text) {
    if (typeof text !== "string" || !BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    let binary;
    try { binary = atob(padded); } catch { return null; }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    if (base64UrlEncode(bytes) !== text) return null;
    return bytes;
  }

  function encodedLength(byteLength) {
    return Math.ceil((byteLength * 4) / 3);
  }

  function decodeExact(text, byteLength) {
    const bytes = base64UrlDecode(text);
    return bytes && bytes.length === byteLength ? bytes : null;
  }

  function fail(code) {
    return { ok: false, code };
  }

  /** The create request: exactly { v, nonce, ciphertext }. */
  function validateCreateRequest(value) {
    if (!exactKeys(value, ["v", "nonce", "ciphertext"])) return fail("invalid-request");
    if (value.v !== PROTOCOL_VERSION) return fail("unsupported-version");
    const nonce = decodeExact(value.nonce, LIMITS.nonceBytes);
    if (!nonce) return fail("invalid-nonce");
    if (typeof value.ciphertext !== "string"
      || value.ciphertext.length < encodedLength(LIMITS.minCiphertextBytes)
      || value.ciphertext.length > encodedLength(LIMITS.maxCiphertextBytes)) return fail("invalid-size");
    const ciphertext = base64UrlDecode(value.ciphertext);
    if (!ciphertext) return fail("invalid-ciphertext");
    if (ciphertext.length < LIMITS.minCiphertextBytes || ciphertext.length > LIMITS.maxCiphertextBytes) return fail("invalid-size");
    return { ok: true, value: { v: PROTOCOL_VERSION, nonce, ciphertext } };
  }

  function isRecordId(value) {
    return typeof value === "string" && value.length === LIMITS.recordIdChars && Boolean(decodeExact(value, LIMITS.recordIdBytes));
  }

  /** The read request: exactly { v, id }. The id travels in the body so it never appears in a URL or access log. */
  function validateReadRequest(value) {
    if (!exactKeys(value, ["v", "id"])) return fail("invalid-request");
    if (value.v !== PROTOCOL_VERSION) return fail("unsupported-version");
    if (!isRecordId(value.id)) return fail("invalid-id");
    return { ok: true, value: { v: PROTOCOL_VERSION, id: value.id } };
  }

  function validIso(value) {
    if (typeof value !== "string") return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value;
  }

  /** The create response: exactly { id, expiresAt }. */
  function validateCreateResponse(value) {
    if (!exactKeys(value, ["id", "expiresAt"]) || !isRecordId(value.id) || !validIso(value.expiresAt)) return fail("invalid-response");
    return { ok: true, value: { id: value.id, expiresAt: value.expiresAt } };
  }

  /** The read response: exactly { v, nonce, ciphertext, expiresAt }. */
  function validateReadResponse(value) {
    if (!exactKeys(value, ["v", "nonce", "ciphertext", "expiresAt"]) || !validIso(value.expiresAt)) return fail("invalid-response");
    const checked = validateCreateRequest({ v: value.v, nonce: value.nonce, ciphertext: value.ciphertext });
    if (!checked.ok) return fail(checked.code === "unsupported-version" ? "unsupported-version" : "invalid-response");
    return { ok: true, value: { ...checked.value, expiresAt: value.expiresAt } };
  }

  /** `<base>#r=<id>.<key>`. The base is a page URL without a fragment. */
  function formatLink(base, id, key) {
    if (!isRecordId(id) || typeof key !== "string" || !decodeExact(key, LIMITS.keyBytes)) throw new TypeError("invalid relay locator");
    const url = new URL(base);
    if (url.hash) throw new TypeError("relay base must not carry a fragment");
    return url.href + "#" + FRAGMENT_KEY + "=" + id + "." + key;
  }

  /** Reads `r=<id>.<key>` from a fragment or a whole link. Anything else is null. */
  function parseLocator(input) {
    if (typeof input !== "string") return null;
    const hashIndex = input.indexOf("#");
    const fragment = hashIndex >= 0 ? input.slice(hashIndex + 1) : input;
    const match = /^r=([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/u.exec(fragment);
    if (!match) return null;
    const [, id, key] = match;
    if (!isRecordId(id) || key.length !== LIMITS.keyChars || !decodeExact(key, LIMITS.keyBytes)) return null;
    return { id, key };
  }

  function utf8Bytes(text) {
    return new TextEncoder().encode(text);
  }

  function measureUtf8Bytes(text) {
    return utf8Bytes(text).length;
  }

  const api = Object.freeze({
    PROTOCOL_VERSION,
    ENDPOINTS,
    LIMITS,
    FRAGMENT_KEY,
    AAD_LABEL,
    base64UrlEncode,
    base64UrlDecode,
    encodedLength,
    isRecordId,
    validateCreateRequest,
    validateReadRequest,
    validateCreateResponse,
    validateReadResponse,
    formatLink,
    parseLocator,
    utf8Bytes,
    measureUtf8Bytes,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeTrainerRelayContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
