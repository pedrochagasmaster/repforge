(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeInstallTransfer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const KIND = "taurifer-install-transfer";
  const VERSION = 1;
  const COOKIE_NAME = "repforge_transfer_v1";
  const COOKIE_MAX_AGE = 3600;
  const COOKIE_VERSION = "v1";
  const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const ENDPOINTS = Object.freeze({
    create: "/v1/transfers",
    claim: "/v1/transfers/claims",
    commit: "/v1/transfers/claims/commit",
    status: "/v1/transfers/status",
  });
  const CLIENT_STATES = Object.freeze([
    "idle", "creating", "ready", "claiming", "validating", "importing",
    "localCommitted", "deletingRemote", "complete", "retryable",
    "terminalUnavailable", "unknown-outcome",
  ]);
  const RECOVERY_STATES = Object.freeze(["none", "awaitingClaimOutcome", "confirmed", "resumeWarning", "resumedDiverged"]);
  const REMOTE_STATES = new Set(["available", "claiming", "deleted", "expired", "claimed-expired"]);
  const BASE64URL = /^[A-Za-z0-9_-]+$/;
  const IDENTIFIER_MAX_CHARS = 256;
  const CREDENTIAL_MAX_CHARS = 8_000;

  function failure(code, state) {
    const result = { ok: false, code };
    if (state) result.state = state;
    return result;
  }

  function success(fields) {
    return { ok: true, ...fields };
  }

  function own(value, key) {
    return value !== null && typeof value === "object" && Object.hasOwn(value, key);
  }

  function exactKeys(value, keys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
  }

  function validString(value, { max = CREDENTIAL_MAX_CHARS, nonEmpty = true } = {}) {
    if (typeof value !== "string" || nonEmpty && value.length === 0) return false;
    let scalars = 0;
    for (let index = 0; index < value.length; index += 1) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next < 0xdc00 || next > 0xdfff) return false;
        index += 1;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
      scalars += 1;
      if (scalars > max) return false;
    }
    return true;
  }

  function jsonClone(value, seen = new Set()) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new TypeError("non-finite-number");
      return value;
    }
    if (typeof value !== "object" || seen.has(value)) throw new TypeError("non-json-value");
    seen.add(value);
    let result;
    if (Array.isArray(value)) result = value.map((entry) => jsonClone(entry, seen));
    else {
      result = {};
      for (const key of Object.keys(value)) {
        if (DANGEROUS_KEYS.has(key)) throw new TypeError("dangerous-key");
        result[key] = jsonClone(value[key], seen);
      }
    }
    seen.delete(value);
    return result;
  }

  function cryptoOf(value) {
    return value || root.crypto;
  }

  function encodeBytes(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return root.btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function decodeBytes(value) {
    if (typeof value !== "string" || !BASE64URL.test(value) || value.length % 4 === 1) throw new TypeError("invalid-base64url");
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(padded, "base64"));
    const binary = root.atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function textBytes(value) {
    return new TextEncoder().encode(value);
  }

  function decodeText(bytes) {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  async function sha256Hex(value, contract, crypto) {
    if (!crypto?.subtle?.digest || typeof contract?.canonicalJson !== "function") return failure("contract-unavailable");
    let serialized;
    try { serialized = contract.canonicalJson(value); }
    catch { return failure("canonical-json-invalid"); }
    if (typeof serialized !== "string") return failure("canonical-json-invalid");
    try {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(serialized)));
      return success({ value: [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("") });
    } catch { return failure("hash-failed"); }
  }

  function requireContract(contract) {
    return contract && typeof contract.canonicalJson === "function" &&
      typeof contract.validateEnvelope === "function" &&
      typeof contract.validateEnvelopeIntegrity === "function" &&
      typeof contract.validateRequest === "function" &&
      typeof contract.parseBoundedJson === "function";
  }

  async function acknowledgedDraftSection(source) {
    if (!source || typeof source !== "object" || typeof source.flush !== "function" ||
      typeof source.current !== "function" || typeof source.checkpoint !== "function" ||
      typeof source.read !== "function" || typeof source.logicalCloneSection !== "function") {
      return failure("workout-draft-source-unavailable");
    }
    try { await source.flush(); } catch { return failure("workout-draft-flush-failed"); }
    let current;
    let checkpoint;
    let read;
    try {
      current = source.current();
      checkpoint = source.checkpoint();
      read = source.read();
    } catch { return failure("workout-draft-read-failed"); }
    const empty = current === null && read?.status === "ok" && read.raw === null;
    const tombstone = checkpoint?.status === "valid" && checkpoint.value?.kind === "tombstone";
    if (empty && (checkpoint?.status === "absent" || tombstone)) return success({ value: null });
    if (current === null || read?.status !== "ok" || typeof read.raw !== "string" ||
      checkpoint?.status !== "valid" || checkpoint.value?.kind !== "committed" || checkpoint.value.raw !== read.raw) {
      return failure("untrusted-workout-draft");
    }
    let logical;
    try { logical = source.logicalCloneSection(current); } catch { return failure("workout-draft-clone-failed"); }
    if (!logical || typeof logical !== "object" || Array.isArray(logical)) return failure("untrusted-workout-draft");
    try { return success({ value: jsonClone(logical) }); } catch { return failure("untrusted-workout-draft"); }
  }

  function candidateSection(value) {
    if (value === null || value === undefined) return success({ value: null });
    if (typeof value !== "object" || Array.isArray(value)) return failure("invalid-program-entry-draft");
    // A producer may pass the parsed persistence envelope explicitly. Only the
    // normalized inner state crosses the clone boundary; wrapper revision and
    // owner identity never do. Unknown inner state fields are retained for the
    // shared contract to validate, so a future required candidate field cannot
    // be silently discarded here.
    if (own(value, "state") || own(value, "revision") || own(value, "ownerId")) {
      if (!own(value, "state") || value.state === null || typeof value.state !== "object" || Array.isArray(value.state)) {
        return failure("invalid-program-entry-draft");
      }
      value = value.state;
    }
    try { return success({ value: jsonClone(value) }); } catch { return failure("invalid-program-entry-draft"); }
  }

  async function logicalSections(sections) {
    if (!sections || typeof sections !== "object") return failure("sections-unavailable");
    const workout = await acknowledgedDraftSection(sections.workoutDraft);
    if (!workout.ok) return workout;
    const candidate = candidateSection(sections.programEntryDraft);
    if (!candidate.ok) return candidate;
    try {
      return success({ value: {
        durableState: jsonClone(sections.durableState),
        workoutDraft: workout.value,
        programEntryDraft: candidate.value,
        uiPreferences: jsonClone(sections.uiPreferences),
        analytics: jsonClone(sections.analytics),
        telemetryIdentity: jsonClone(sections.telemetryIdentity),
      } });
    } catch { return failure("sections-invalid"); }
  }

  async function logicalStateDigest(sections, contract, crypto = cryptoOf()) {
    if (!requireContract(contract)) return failure("contract-unavailable");
    const logical = await logicalSections(sections);
    if (!logical.ok) return logical;
    const ordered = {
      durableState: logical.value.durableState,
      workoutDraft: logical.value.workoutDraft,
      programEntryDraft: logical.value.programEntryDraft,
      uiPreferences: logical.value.uiPreferences,
      analytics: logical.value.analytics,
      telemetryIdentity: logical.value.telemetryIdentity,
    };
    return sha256Hex(ordered, contract, crypto);
  }

  async function buildEnvelope({ sections, source, contract, crypto = cryptoOf(), createdAt = new Date().toISOString() } = {}) {
    if (!requireContract(contract)) return failure("contract-unavailable");
    if (!source || source.context !== "browser" || typeof source.logicalInstallationId !== "string" || !source.logicalInstallationId ||
      !Number.isSafeInteger(source.sourceRevision) || source.sourceRevision < 0 || typeof createdAt !== "string") {
      return failure("invalid-source");
    }
    const logical = await logicalSections(sections);
    if (!logical.ok) return logical;
    let envelope;
    try {
      envelope = {
        kind: KIND,
        schemaVersion: VERSION,
        createdAt,
        source: { context: "browser", logicalInstallationId: source.logicalInstallationId },
        sourceRevision: source.sourceRevision,
        ...logical.value,
        integrity: { canonicalPayloadHash: "" },
      };
      const preimage = jsonClone(envelope);
      delete preimage.integrity.canonicalPayloadHash;
      const digest = await sha256Hex(preimage, contract, crypto);
      if (!digest.ok) return digest;
      envelope.integrity.canonicalPayloadHash = digest.value;
    } catch { return failure("envelope-build-failed"); }
    let checked;
    try { checked = await contract.validateEnvelopeIntegrity(jsonClone(envelope), crypto); }
    catch { return failure("integrity-validation-failed"); }
    if (!checked?.ok) return failure(checked?.code || "invalid-envelope");
    try { return success({ value: jsonClone(checked.value || envelope) }); }
    catch { return failure("invalid-envelope"); }
  }

  function contextEligibility({ action, context, hasMeaningfulData = false } = {}) {
    if (action === "create" && context !== "browser") return { eligible: false, code: "wrong-context" };
    if (action === "claim" && context !== "standalone") return { eligible: false, code: "wrong-context" };
    if (action === "create" && hasMeaningfulData !== true) return { eligible: false, code: "no-transferable-data" };
    if (!["create", "claim"].includes(action)) return { eligible: false, code: "invalid-action" };
    return { eligible: true, code: null };
  }

  function contextFrom({ window: win = root, navigator = root.navigator, matchMedia = win?.matchMedia } = {}) {
    if (navigator?.standalone === true || typeof matchMedia === "function" && matchMedia("(display-mode: standalone)")?.matches) return "standalone";
    return "browser";
  }

  function hostname(locationLike) {
    try { return new URL(locationLike?.href || locationLike || root.location?.href || "http://localhost/").hostname; }
    catch { return "localhost"; }
  }

  function cookiePath(locationLike) {
    try { return new URL("index.html", locationLike?.href || locationLike || root.location?.href || "http://localhost/").pathname; }
    catch { return "/index.html"; }
  }

  function localHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  }

  function cookieValue(value) {
    if (!value || !validString(value.token) || typeof value.expiresAt !== "string" || !Number.isFinite(Date.parse(value.expiresAt))) return null;
    return `${COOKIE_VERSION}.${encodeBytes(textBytes(JSON.stringify({ token: value.token, expiresAt: value.expiresAt })))}`;
  }

  function parseCookieValue(value) {
    if (typeof value !== "string" || !value.startsWith(`${COOKIE_VERSION}.`)) return null;
    try {
      const decoded = JSON.parse(decodeText(decodeBytes(value.slice(COOKIE_VERSION.length + 1))));
      return exactKeys(decoded, ["token", "expiresAt"]) && cookieValue(decoded) === value ? decoded : null;
    } catch { return null; }
  }

  function readCookie(document, name) {
    try {
      if (typeof document?.cookie !== "string") return null;
      for (const part of document.cookie.split(";")) {
        const separator = part.indexOf("=");
        if (separator < 0) continue;
        if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
      }
      return null;
    } catch { return null; }
  }

  function writeTransferCookie(value, { document = root.document, location = root.location, now = Date.now() } = {}) {
    const encoded = cookieValue(value);
    const at = typeof now === "function" ? now() : now;
    const nowMs = typeof at === "number" ? at : Date.parse(at);
    const expiryMs = Date.parse(value?.expiresAt || "");
    if (!document || !encoded || !Number.isFinite(nowMs) || !Number.isFinite(expiryMs)) return false;
    const maxAge = Math.min(COOKIE_MAX_AGE, Math.ceil((expiryMs - nowMs) / 1000));
    if (maxAge <= 0) return false;
    const secure = localHost(hostname(location)) ? "" : "; Secure";
    try {
      document.cookie = `${COOKIE_NAME}=${encoded}; Path=${cookiePath(location)}; Max-Age=${maxAge}; SameSite=Lax${secure}`;
      return true;
    } catch { return false; }
  }

  function readTransferCookie({ document = root.document } = {}) {
    return parseCookieValue(readCookie(document, COOKIE_NAME));
  }

  function clearTransferCookie({ document = root.document, location = root.location } = {}) {
    if (!document) return false;
    const secure = localHost(hostname(location)) ? "" : "; Secure";
    try {
      document.cookie = `${COOKIE_NAME}=; Path=${cookiePath(location)}; Max-Age=0; SameSite=Lax${secure}`;
      return true;
    } catch { return false; }
  }

  function consumeTransferCookie(adapters = {}) {
    const value = readTransferCookie(adapters);
    if (value) clearTransferCookie(adapters);
    return value;
  }

  function createFetchTransport({ fetch: fetchFn = root.fetch, baseUrl = root.location?.href } = {}) {
    return {
      async request({ path, body }) {
        if (typeof fetchFn !== "function" || typeof path !== "string" || !Object.values(ENDPOINTS).includes(path)) throw new Error("invalid-transport-request");
        const url = new URL(path, baseUrl);
        if (url.pathname !== path || url.search || url.hash) throw new Error("endpoint-must-be-exact");
        const response = await fetchFn(url.href, {
          method: "POST",
          headers: { "Accept": "application/json", "Content-Type": "application/json", "Cache-Control": "no-store" },
          body: JSON.stringify(body),
          cache: "no-store",
          redirect: "error",
          credentials: "omit",
          mode: "cors",
        });
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { status: response.status, bytes };
      },
    };
  }

  function randomBytes(crypto, length) {
    if (!crypto?.getRandomValues) throw new Error("crypto-unavailable");
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  async function digestString(value, crypto) {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", textBytes(value)));
    return encodeBytes(digest);
  }

  function idFor(crypto, bytes = 16) {
    return encodeBytes(randomBytes(crypto, bytes));
  }

  function createCredentialVault({ crypto = root.crypto, indexedDB = root.indexedDB, keyStore } = {}) {
    const store = keyStore || idbKeyStore({ indexedDB });
    async function seal(context, value) {
      const keyId = idFor(crypto);
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await store.put(context, keyId, key);
      const iv = randomBytes(crypto, 12);
      const plaintext = textBytes(JSON.stringify(value));
      const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
      return { version: 1, algorithm: "AES-GCM", context, keyId, iv: encodeBytes(iv), ciphertext: encodeBytes(ciphertext) };
    }
    async function unseal(context, sealed) {
      if (!sealed || sealed.version !== 1 || sealed.algorithm !== "AES-GCM" || sealed.context !== context) throw new Error("sealed-credential-invalid");
      const key = await store.get(context, sealed.keyId);
      if (!key) throw new Error("sealed-credential-unavailable");
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decodeBytes(sealed.iv) }, key, decodeBytes(sealed.ciphertext));
      return JSON.parse(decodeText(new Uint8Array(plaintext)));
    }
    async function forget(context, sealed) {
      if (sealed?.keyId) await store.delete(context, sealed.keyId);
    }
    return Object.freeze({ seal, unseal, forget });
  }

  function idbKeyStore({ indexedDB } = {}) {
    let dbPromise;
    function db() {
      if (!indexedDB?.open) return Promise.reject(new Error("indexeddb-unavailable"));
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge_transfer_credentials_v1", 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains("keys")) request.result.createObjectStore("keys");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("indexeddb-open-failed"));
      });
      return dbPromise;
    }
    const key = (context, keyId) => `${context}:${keyId}`;
    return {
      async get(context, keyId) {
        const database = await db();
        return new Promise((resolve, reject) => {
          const request = database.transaction("keys", "readonly").objectStore("keys").get(key(context, keyId));
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error("indexeddb-read-failed"));
        });
      },
      async put(context, keyId, value) {
        const database = await db();
        return new Promise((resolve, reject) => {
          const request = database.transaction("keys", "readwrite").objectStore("keys").put(value, key(context, keyId));
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error || new Error("indexeddb-write-failed"));
        });
      },
      async delete(context, keyId) {
        const database = await db();
        return new Promise((resolve, reject) => {
          const request = database.transaction("keys", "readwrite").objectStore("keys").delete(key(context, keyId));
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error || new Error("indexeddb-delete-failed"));
        });
      },
    };
  }

  function createClient({ contract, crypto = root.crypto, transport, context = contextFrom(), document = root.document, location = root.location, storage, now = () => new Date().toISOString() } = {}) {
    const outbound = storage?.outbound;
    const inbound = storage?.inbound;
    const credentials = storage?.credentials;
    let currentState = "idle";
    let recoveryState = "none";
    const stateResult = (result) => {
      if (result?.state && CLIENT_STATES.includes(result.state)) currentState = result.state;
      if (context === "browser" && result?.state === "ready") recoveryState = "awaitingClaimOutcome";
      if (context === "browser" && result?.state === "unknown-outcome") recoveryState = "resumeWarning";
      return result;
    };
    const unavailable = (code, state = "retryable") => stateResult(failure(code, state));
    async function request(path, body, parseEndpoint = path) {
      if (!requireContract(contract) || !transport?.request) return failure("contract-unavailable");
      let validated;
      try { validated = contract.validateRequest(body, path); } catch { return failure("invalid-request"); }
      if (!validated?.ok) return failure(validated?.code || "invalid-request");
      try {
        const reply = await transport.request({ method: "POST", path, endpoint: path, body: jsonClone(body), headers: { "Cache-Control": "no-store" } });
        if (!reply || !Number.isInteger(reply.status) || !(reply.bytes instanceof Uint8Array || reply.bytes instanceof ArrayBuffer)) return failure("invalid-response");
        const parsed = contract.parseBoundedJson(reply.bytes, parseEndpoint);
        if (!parsed?.ok) return failure(parsed.code || "invalid-response");
        return success({ status: reply.status, body: parsed.value });
      } catch { return failure("network-failure"); }
    }
    function responseFailure(reply, fallback = "invalid-response", unknownCode = "network-failure") {
      if (reply.code === "network-failure") return unavailable(unknownCode, "unknown-outcome");
      if (!reply.ok) return unavailable(reply.code || fallback);
      if ([404, 429, 503].includes(reply.status) && exactKeys(reply.body, ["state"]) && reply.body.state === "unavailable") return unavailable("service-unavailable", "terminalUnavailable");
      return null;
    }
    async function create({ sections, source, consent, sourceAfter, hasMeaningfulData = false } = {}) {
      const eligibility = contextEligibility({ action: "create", context, hasMeaningfulData });
      if (!eligibility.eligible) return stateResult(failure(eligibility.code, "idle"));
      if (consent?.enabled !== true) return stateResult(failure("consent-required", "idle"));
      if (!outbound || !credentials) return unavailable("storage-unavailable");
      const built = await buildEnvelope({ sections, source, contract, crypto, createdAt: now() });
      if (!built.ok) return stateResult(failure(built.code, "retryable"));
      const digestBefore = await logicalStateDigest(sections, contract, crypto);
      let existing;
      try { existing = await outbound.read(); }
      catch { return unavailable("marker-read-failed", "unknown-outcome"); }
      if (existing != null && (typeof existing !== "object" || Array.isArray(existing))) return unavailable("marker-invalid", "unknown-outcome");
      if (existing?.phase === "awaiting-claim") {
        if (!existing.sealedCredentials || !Number.isFinite(Date.parse(existing.expiresAt))) return unavailable("credential-unavailable", "unknown-outcome");
        try { await credentials.unseal("browser-outbound", existing.sealedCredentials); }
        catch { return unavailable("credential-unavailable", "unknown-outcome"); }
        return stateResult(success({ state: "ready", expiresAt: existing.expiresAt, stale: existing.mutatedAfterCreation === true }));
      }
      if (existing?.phase === "confirmed") return unavailable("transfer-already-complete", "terminalUnavailable");
      if (existing && !validString(existing.idempotencyKey, { max: IDENTIFIER_MAX_CHARS })) return unavailable("marker-invalid", "unknown-outcome");
      let idempotencyKey;
      try { idempotencyKey = existing?.idempotencyKey || idFor(crypto); }
      catch { return unavailable("idempotency-unavailable"); }
      const marker = {
        version: 1,
        idempotencyKey,
        createdAt: typeof existing?.createdAt === "string" ? existing.createdAt : now(),
        sourceRevision: source.sourceRevision,
        mutatedAfterCreation: existing?.mutatedAfterCreation === true,
        phase: "creating",
      };
      if (!existing) {
        try { await outbound.write(marker); }
        catch { return unavailable("marker-write-failed", "unknown-outcome"); }
      }
      currentState = "creating";
      const reply = await request(ENDPOINTS.create, { idempotencyKey, envelope: built.value });
      const knownFailure = responseFailure(reply, "invalid-response", "create-unknown-outcome");
      if (knownFailure) {
        if (reply.code === "network-failure") return stateResult(knownFailure);
        if (reply.ok && (reply.status === 429 || reply.status === 503)) {
          await outbound.clear();
          return stateResult(knownFailure);
        }
        return stateResult(knownFailure);
      }
      if (!reply.ok || (reply.status !== 201 && reply.status !== 200)) return stateResult(unavailable("invalid-response"));
      if (reply.status === 200) {
        if (!exactKeys(reply.body, ["duplicate", "expiresAt"]) || reply.body.duplicate !== true || !Number.isFinite(Date.parse(reply.body.expiresAt))) return stateResult(unavailable("invalid-response"));
        return stateResult(unavailable("create-duplicate-no-token", "unknown-outcome"));
      }
      if (!exactKeys(reply.body, ["token", "expiresAt"]) || !validString(reply.body.token) || !Number.isFinite(Date.parse(reply.body.expiresAt))) return stateResult(unavailable("invalid-response"));
      let sealed;
      try { sealed = await credentials.seal("browser-outbound", { token: reply.body.token }); }
      catch { return stateResult(unavailable("credential-seal-failed")); }
      let tokenDigest;
      try { tokenDigest = await digestString(reply.body.token, crypto); }
      catch {
        await credentials.forget("browser-outbound", sealed).catch(() => {});
        return stateResult(unavailable("credential-seal-failed"));
      }
      const readyMarker = { ...marker, phase: "awaiting-claim", sealedCredentials: sealed, tokenDigest, expiresAt: reply.body.expiresAt };
      try { await outbound.write(readyMarker); }
      catch {
        await credentials.forget("browser-outbound", sealed).catch(() => {});
        return stateResult(unavailable("marker-write-failed", "unknown-outcome"));
      }
      if (!writeTransferCookie({ token: reply.body.token, expiresAt: reply.body.expiresAt }, { document, location, now: now() })) return stateResult(unavailable("cookie-write-failed"));
      let stale = false;
      if (typeof sourceAfter === "function" && digestBefore.ok) {
        try {
          const after = await sourceAfter();
          const digestAfter = await logicalStateDigest(after, contract, crypto);
          stale = !digestAfter.ok || digestAfter.value !== digestBefore.value;
        } catch { stale = true; }
        if (stale) {
          try { await outbound.write({ ...readyMarker, mutatedAfterCreation: true }); }
          catch { return stateResult(unavailable("marker-write-failed", "unknown-outcome")); }
        }
      }
      return stateResult(success({ state: "ready", expiresAt: reply.body.expiresAt, stale }));
    }
    async function claim() {
      const eligibility = contextEligibility({ action: "claim", context });
      if (!eligibility.eligible) return stateResult(failure(eligibility.code, "idle"));
      if (!inbound || !credentials) return unavailable("storage-unavailable");
      let marker;
      try { marker = await inbound.read(); }
      catch { return unavailable("marker-read-failed", "unknown-outcome"); }
      let pair;
      if (marker?.sealedCredentials) {
        try { pair = await credentials.unseal("standalone-inbound", marker.sealedCredentials); } catch { return stateResult(unavailable("credential-unavailable", "terminalUnavailable")); }
      } else {
        const cookie = readTransferCookie({ document });
        if (!cookie) return stateResult(unavailable("transfer-cookie-missing", "terminalUnavailable"));
        let claimId;
        try { claimId = idFor(crypto); } catch { return stateResult(unavailable("claim-id-unavailable")); }
        if (!contract.validateClaimId?.(claimId)?.ok) return stateResult(unavailable("claim-id-invalid"));
        let sealedCredentials;
        try { sealedCredentials = await credentials.seal("standalone-inbound", { token: cookie.token, claimId }); }
        catch { return stateResult(unavailable("credential-seal-failed")); }
        marker = { version: 1, phase: "claiming", sealedCredentials, expiresAt: cookie.expiresAt };
        try { await inbound.write(marker); }
        catch {
          await credentials.forget("standalone-inbound", sealedCredentials).catch(() => {});
          return stateResult(unavailable("marker-write-failed", "unknown-outcome"));
        }
        clearTransferCookie({ document, location });
        pair = { token: cookie.token, claimId };
      }
      currentState = "claiming";
      // The claim response contains the full semantic envelope. The shared
      // parser's local /envelope selector applies the approved envelope bound
      // before JSON decoding; the request itself remains bounded by /claims.
      const reply = await request(ENDPOINTS.claim, { token: pair.token, claimId: pair.claimId }, "/envelope");
      const knownFailure = responseFailure(reply, "invalid-response", "claim-unknown-outcome");
      if (knownFailure) return stateResult(knownFailure.state === "terminalUnavailable" ? knownFailure : unavailable(knownFailure.code, "unknown-outcome"));
      if (!reply.ok || reply.status !== 200 || !exactKeys(reply.body, ["envelope", "expiresAt"]) || !Number.isFinite(Date.parse(reply.body.expiresAt))) return stateResult(unavailable("invalid-response"));
      let checked;
      try { checked = await contract.validateEnvelopeIntegrity(reply.body.envelope, crypto); } catch { checked = failure("integrity-validation-failed"); }
      if (!checked?.ok) return stateResult(unavailable(checked?.code || "invalid-envelope", "terminalUnavailable"));
      try { await inbound.write({ version: 1, phase: "claimed", sealedCredentials: marker.sealedCredentials, expiresAt: reply.body.expiresAt }); }
      catch { return stateResult(unavailable("marker-write-failed", "unknown-outcome")); }
      return stateResult(success({ state: "validating", envelope: checked.value || reply.body.envelope, expiresAt: reply.body.expiresAt }));
    }
    async function commit() {
      if (context !== "standalone") return stateResult(failure("wrong-context", "idle"));
      if (!inbound || !credentials) return unavailable("storage-unavailable");
      let marker;
      try { marker = await inbound.read(); }
      catch { return unavailable("marker-read-failed", "unknown-outcome"); }
      if (!marker?.sealedCredentials) return stateResult(unavailable("credential-unavailable", "terminalUnavailable"));
      if (marker.phase !== "local-committed") return stateResult(unavailable("local-import-required"));
      let pair;
      try { pair = await credentials.unseal("standalone-inbound", marker.sealedCredentials); } catch { return stateResult(unavailable("credential-unavailable", "terminalUnavailable")); }
      currentState = "deletingRemote";
      const reply = await request(ENDPOINTS.commit, { token: pair.token, claimId: pair.claimId });
      const knownFailure = responseFailure(reply, "invalid-response", "commit-unknown-outcome");
      if (knownFailure) return stateResult(knownFailure.state === "terminalUnavailable" ? knownFailure : unavailable(knownFailure.code, "unknown-outcome"));
      if (!reply.ok || reply.status !== 200 || !exactKeys(reply.body, ["state", "expiresAt"]) || reply.body.state !== "deleted" || !Number.isFinite(Date.parse(reply.body.expiresAt))) return stateResult(unavailable("invalid-response"));
      try { await inbound.clear(); }
      catch { return stateResult(unavailable("marker-clear-failed", "unknown-outcome")); }
      await credentials.forget("standalone-inbound", marker.sealedCredentials).catch(() => {});
      return stateResult(success({ state: "complete", expiresAt: reply.body.expiresAt }));
    }
    async function status() {
      if (context !== "browser") return stateResult(failure("wrong-context", "idle"));
      if (!outbound || !credentials) return unavailable("storage-unavailable");
      let marker;
      try { marker = await outbound.read(); }
      catch { return unavailable("marker-read-failed", "unknown-outcome"); }
      if (!marker?.sealedCredentials) return stateResult(unavailable("credential-unavailable", "unknown-outcome"));
      let pair;
      try { pair = await credentials.unseal("browser-outbound", marker.sealedCredentials); } catch { return stateResult(unavailable("credential-unavailable", "unknown-outcome")); }
      const reply = await request(ENDPOINTS.status, { token: pair.token });
      if (!reply.ok && reply.code === "network-failure") return stateResult(unavailable("status-unavailable", "unknown-outcome"));
      if (!reply.ok) return stateResult(unavailable("status-unavailable", "unknown-outcome"));
      if (reply.status === 404 && exactKeys(reply.body, ["state"]) && reply.body.state === "unavailable") return stateResult(unavailable("status-unavailable", "unknown-outcome"));
      if (reply.status !== 200 || !exactKeys(reply.body, ["state", "expiresAt"]) || !REMOTE_STATES.has(reply.body.state) || !Number.isFinite(Date.parse(reply.body.expiresAt))) return stateResult(unavailable("invalid-response", "unknown-outcome"));
      if (reply.body.state === "deleted") {
        recoveryState = "confirmed";
        try { await outbound.write({ version: 1, phase: "confirmed", sealedCredentials: marker.sealedCredentials, expiresAt: reply.body.expiresAt }); }
        catch { return stateResult(unavailable("marker-write-failed", "unknown-outcome")); }
        return success({ state: "confirmed", remoteState: "deleted", expiresAt: reply.body.expiresAt });
      }
      if (reply.body.state === "expired") {
        recoveryState = "none";
        try { await outbound.clear(); }
        catch { return stateResult(unavailable("marker-clear-failed", "unknown-outcome")); }
        await credentials.forget("browser-outbound", marker.sealedCredentials).catch(() => {});
        clearTransferCookie({ document, location });
        return stateResult(success({ state: "idle", remoteState: "expired", expiresAt: reply.body.expiresAt }));
      }
      recoveryState = reply.body.state === "claimed-expired" ? "awaitingClaimOutcome" : recoveryState;
      return stateResult(unavailable(reply.body.state === "claimed-expired" ? "claimed-expired" : "status-unavailable", "unknown-outcome"));
    }
    return Object.freeze({
      create,
      claim,
      commit,
      status,
      state: () => currentState,
      recoveryState: () => recoveryState,
    });
  }

  return Object.freeze({
    KIND,
    VERSION,
    COOKIE_NAME,
    COOKIE_MAX_AGE,
    ENDPOINTS,
    CLIENT_STATES,
    RECOVERY_STATES,
    buildEnvelope,
    logicalStateDigest,
    contextEligibility,
    contextFrom,
    writeTransferCookie,
    readTransferCookie,
    clearTransferCookie,
    consumeTransferCookie,
    createFetchTransport,
    createCredentialVault,
    createClient,
  });
});
