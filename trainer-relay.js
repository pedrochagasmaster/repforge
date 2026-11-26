/* Trainer relay client (ADR 0026, Plan 086 slice 1). No UI.
 *
 * send(text) compresses the UTF-8 text, encrypts it on this device with a
 * fresh AES-256-GCM key, uploads only { v, nonce, ciphertext }, and returns a
 * link whose fragment carries the record id and the key. receive(link) reads
 * the record, decrypts and decompresses it, and returns the exact text, or a
 * failure code with no partial output.
 *
 * The key is never sent to the service, and this module never logs.
 */
(function trainerRelayClient(root) {
  "use strict";

  const Contract = typeof module !== "undefined" && module.exports
    ? require("./trainer-relay-contract.js")
    : root.RepForgeTrainerRelayContract;
  const { LIMITS, ENDPOINTS, PROTOCOL_VERSION } = Contract;

  function fail(code) {
    return { ok: false, code };
  }

  function webCrypto(options) {
    const crypto = options?.crypto || root.crypto;
    if (!crypto?.subtle || typeof crypto.getRandomValues !== "function") throw new Error("crypto unavailable");
    return crypto;
  }

  function aad() {
    return Contract.utf8Bytes(Contract.AAD_LABEL + "\0" + PROTOCOL_VERSION);
  }

  async function readBounded(stream, maximum) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maximum) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    } catch {
      return null;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }

  async function gzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
    return readBounded(stream, Number.MAX_SAFE_INTEGER);
  }

  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    return readBounded(stream, LIMITS.maxPlaintextBytes);
  }

  /** Compress then encrypt. Returns base64url key, nonce and ciphertext; nothing is uploaded. */
  async function seal(text, options = {}) {
    if (typeof text !== "string" || text.length === 0) return fail("empty-payload");
    const plain = Contract.utf8Bytes(text);
    if (plain.length > LIMITS.maxPlaintextBytes) return fail("payload-too-large");
    const crypto = webCrypto(options);
    const compressed = await gzip(plain);
    if (!compressed) return fail("compression-failed");
    const rawKey = crypto.getRandomValues(new Uint8Array(LIMITS.keyBytes));
    const nonce = crypto.getRandomValues(new Uint8Array(LIMITS.nonceBytes));
    const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad(), tagLength: 128 }, key, compressed));
    if (ciphertext.length > LIMITS.maxCiphertextBytes) return fail("payload-too-large");
    return {
      ok: true,
      key: Contract.base64UrlEncode(rawKey),
      record: { v: PROTOCOL_VERSION, nonce: Contract.base64UrlEncode(nonce), ciphertext: Contract.base64UrlEncode(ciphertext) },
    };
  }

  /** Decrypt then decompress. Any failure returns a code and no text. */
  async function open(record, keyText, options = {}) {
    const checked = Contract.validateCreateRequest(record);
    if (!checked.ok) return fail("invalid-record");
    const rawKey = Contract.base64UrlDecode(keyText);
    if (!rawKey || rawKey.length !== LIMITS.keyBytes) return fail("invalid-key");
    const crypto = webCrypto(options);
    let compressed;
    try {
      const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
      compressed = new Uint8Array(await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: checked.value.nonce, additionalData: aad(), tagLength: 128 }, key, checked.value.ciphertext));
    } catch {
      return fail("decrypt-failed");
    }
    const plain = await gunzip(compressed);
    if (!plain) return fail("decompress-failed");
    let text;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(plain);
    } catch {
      return fail("invalid-text");
    }
    if (!text) return fail("empty-payload");
    return { ok: true, text };
  }

  function serviceUrl(endpoint, options) {
    const base = options?.serviceOrigin || root.location?.origin;
    if (!base) throw new Error("relay service origin unavailable");
    return new URL(endpoint, base).href;
  }

  async function post(endpoint, body, options, maxResponseBytes) {
    const fetchImpl = options?.fetch || root.fetch;
    let response;
    try {
      response = await fetchImpl(serviceUrl(endpoint, options), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    } catch {
      return { ok: false, code: "network" };
    }
    if (response.status === 404 || response.status === 410) return { ok: false, code: "unavailable", status: response.status };
    if (response.status === 429) return { ok: false, code: "rate-limited", status: response.status };
    if (response.status === 413) return { ok: false, code: "payload-too-large", status: response.status };
    if (response.status === 503) return { ok: false, code: "service-unavailable", status: response.status };
    if (!response.ok || !response.body) return { ok: false, code: "service-error", status: response.status };
    const bytes = await readBounded(response.body, maxResponseBytes);
    if (!bytes) return { ok: false, code: "invalid-response" };
    try {
      return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
    } catch {
      return { ok: false, code: "invalid-response" };
    }
  }

  /**
   * Encrypt `text` on this device and upload the ciphertext.
   * options.linkBase: the page the link opens (the app or the trainer site).
   * options.serviceOrigin: the relay's origin (defaults to this page's origin).
   * Resolves { ok, link, id, expiresAt } or { ok: false, code }.
   */
  async function send(text, options = {}) {
    const sealed = await seal(text, options);
    if (!sealed.ok) return sealed;
    const response = await post(ENDPOINTS.create, sealed.record, options, 1024);
    if (!response.ok) return fail(response.code);
    const created = Contract.validateCreateResponse(response.value);
    if (!created.ok) return fail("invalid-response");
    const link = Contract.formatLink(options.linkBase || root.location?.href.split("#")[0], created.value.id, sealed.key);
    return { ok: true, link, id: created.value.id, expiresAt: created.value.expiresAt };
  }

  /**
   * Read and decrypt a relay link or fragment. Resolves { ok, text, expiresAt }
   * or { ok: false, code }; a wrong key, a tampered record or an expired one
   * never yields partial text.
   */
  async function receive(linkOrFragment, options = {}) {
    const locator = Contract.parseLocator(linkOrFragment);
    if (!locator) return fail("invalid-link");
    const response = await post(ENDPOINTS.read, { v: PROTOCOL_VERSION, id: locator.id }, options,
      Contract.encodedLength(LIMITS.maxCiphertextBytes) + 1024);
    if (!response.ok) return fail(response.code);
    const record = Contract.validateReadResponse(response.value);
    if (!record.ok) return fail(record.code);
    const opened = await open({ v: response.value.v, nonce: response.value.nonce, ciphertext: response.value.ciphertext },
      locator.key, options);
    if (!opened.ok) return opened;
    return { ok: true, text: opened.text, expiresAt: record.value.expiresAt };
  }

  const api = Object.freeze({ seal, open, send, receive, parseLocator: Contract.parseLocator, formatLink: Contract.formatLink });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeTrainerRelay = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
