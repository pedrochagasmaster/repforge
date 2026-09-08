#!/usr/bin/env node
/**
 * Plan 053 P3 isolated browser-client contract tests.
 *
 * The shared install-transfer contract is deliberately injected. P1b owns
 * that module and this suite must not copy or claim parity with an unpublished
 * implementation. These tests prove the client boundary, transport policy,
 * cookie separation, retry credentials, and clone producer seam against an
 * explicitly named local contract double.
 */
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const Transfer = require("../install-transfer.js");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTATIONS = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-client/expectations.json"), "utf8"));

const results = { passed: 0, failed: 0 };
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(name, run) {
  try {
    await run();
    results.passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.failed += 1;
    console.log(`  ✗ ${name}`);
    console.log(`    ${error?.message || error}`);
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function hashOf(value) {
  const preimage = clone(value);
  if (preimage.integrity) delete preimage.integrity.canonicalPayloadHash;
  return createHash("sha256").update(canonicalJson(preimage), "utf8").digest("hex");
}

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

const LIMITS = {
  requestBytes: {
    [EXPECTATIONS.endpoints.create]: 2_000_000,
    [EXPECTATIONS.endpoints.claim]: 4_096,
    [EXPECTATIONS.endpoints.commit]: 4_096,
    [EXPECTATIONS.endpoints.status]: 4_096,
    "/envelope": 2_000_000,
  },
};

// This is a test-only injected contract. It intentionally reports parity as
// pending until P1b publishes the reviewed shared module and loading SHA.
function makeContract({ calls = [] } = {}) {
  return {
    LIMITS,
    calls,
    canonicalJson,
    parseBoundedJson(bytes, endpoint) {
      calls.push(["parseBoundedJson", endpoint]);
      if (!(bytes instanceof Uint8Array) && !(bytes instanceof ArrayBuffer)) return { ok: false, code: "invalid-parser-input" };
      const raw = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const max = LIMITS.requestBytes[endpoint] ?? 4_096;
      if (raw.byteLength > max) return { ok: false, code: "body-too-large" };
      try { return { ok: true, value: JSON.parse(textDecoder.decode(raw)) }; }
      catch { return { ok: false, code: "invalid-json" }; }
    },
    validateEnvelope(value) {
      calls.push(["validateEnvelope"]);
      if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, code: "invalid-envelope" };
      if (!exactKeys(value, ["kind", "schemaVersion", "createdAt", "source", "sourceRevision", "durableState", "workoutDraft", "programEntryDraft", "uiPreferences", "analytics", "telemetryIdentity", "integrity"])) {
        return { ok: false, code: "invalid-envelope" };
      }
      if (value.kind !== EXPECTATIONS.kind || value.schemaVersion !== EXPECTATIONS.schemaVersion) return { ok: false, code: "unsupported-schema-version" };
      if (value.workoutDraft !== null && value.workoutDraft?.schemaVersion !== 2) return { ok: false, code: "unsupported-workout-draft-version" };
      if (value.programEntryDraft !== null && value.programEntryDraft?.schemaVersion !== 1) return { ok: false, code: "unsupported-program-entry-draft-version" };
      if (Object.hasOwn(value, "logicalStateDigest")) return { ok: false, code: "unknown-envelope-field" };
      return { ok: true, value: clone(value) };
    },
    async validateEnvelopeIntegrity(value) {
      calls.push(["validateEnvelopeIntegrity"]);
      const valid = this.validateEnvelope(value);
      if (!valid.ok) return valid;
      return valid.value.integrity?.canonicalPayloadHash === hashOf(valid.value)
        ? { ok: true, value: valid.value }
        : { ok: false, code: "integrity-mismatch" };
    },
    validateRequest(value, endpoint) {
      calls.push(["validateRequest", endpoint]);
      if (!Object.hasOwn(LIMITS.requestBytes, endpoint)) return { ok: false, code: "invalid-endpoint" };
      if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, code: "invalid-request" };
      const allowed = {
        [EXPECTATIONS.endpoints.create]: ["idempotencyKey", "envelope"],
        [EXPECTATIONS.endpoints.claim]: ["token", "claimId"],
        [EXPECTATIONS.endpoints.commit]: ["token", "claimId"],
        [EXPECTATIONS.endpoints.status]: ["token"],
      }[endpoint];
      return exactKeys(value, allowed) ? { ok: true, value } : { ok: false, code: "invalid-request" };
    },
    validateClaimId(value) {
      calls.push(["validateClaimId"]);
      return typeof value === "string" && /^[A-Za-z0-9_-]{22,43}$/.test(value)
        ? { ok: true, value }
        : { ok: false, code: "claim-id-invalid" };
    },
  };
}

function response(status, body) {
  return { status, bytes: textEncoder.encode(JSON.stringify(body)) };
}

function transportSequence(sequence) {
  const requests = [];
  return {
    requests,
    async request(request) {
      requests.push(clone(request));
      const next = sequence.shift();
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next(request);
      if (!next) throw new Error("test transport exhausted");
      return next;
    },
  };
}

function markerStore(initial = null) {
  let value = clone(initial);
  const writes = [];
  return {
    writes,
    async read() { return clone(value); },
    async write(next) { value = clone(next); writes.push(clone(next)); },
    async clear() { value = null; writes.push(null); },
    peek() { return clone(value); },
  };
}

function cookieDocument(initial = "") {
  let cookie = initial;
  const writes = [];
  return {
    writes,
    get cookie() { return cookie; },
    set cookie(value) {
      writes.push(String(value));
      const [pair, ...attributes] = String(value).split(";");
      const [name, rawValue = ""] = pair.split("=");
      const path = attributes.find((entry) => /^\s*Path=/i.test(entry))?.split("=")[1] || "/";
      const maxAge = attributes.find((entry) => /^\s*Max-Age=/i.test(entry))?.split("=")[1];
      const parts = cookie.split(";").map((part) => part.trim()).filter(Boolean).filter((part) => !part.startsWith(`${name}=`));
      if (maxAge === "0" || rawValue === "") {
        cookie = parts.join("; ");
      } else {
        parts.push(`${name}=${rawValue}`);
        cookie = parts.join("; ");
      }
      void path;
    },
    textContent: "",
  };
}

function memoryKeyStore() {
  const records = new Map();
  return {
    records,
    async get(context, keyId) { return records.get(`${context}:${keyId}`) || null; },
    async put(context, keyId, key) { records.set(`${context}:${keyId}`, key); },
    async delete(context, keyId) { records.delete(`${context}:${keyId}`); },
  };
}

function makeSource() {
  const logicalDraft = {
    schemaVersion: 2,
    draftId: "draft-seed-01",
    program: { programFingerprint: "program-v1:seed", dayId: "day-1" },
    session: { startedAt: "2026-09-08T18:00:00.000Z", notes: "" },
    exerciseOrder: ["exercise-1"],
    exercises: { "exercise-1": { setOrder: ["set-1"], sets: { "set-1": { edited: { load: "123" } } } } },
  };
  const current = {
    ...clone(logicalDraft),
    writer: { installationId: "writer-only", tabId: "tab-only", operationId: "op-only" },
    revision: 4,
    program: { ...clone(logicalDraft.program), durableRevision: 17 },
  };
  const raw = JSON.stringify(current);
  const checkpoint = {
    status: "valid",
    value: { version: 1, kind: "committed", draftId: current.draftId, revision: current.revision, raw },
  };
  const draft = {
    flushCalls: 0,
    async flush() { this.flushCalls += 1; },
    current: () => clone(current),
    checkpoint: () => clone(checkpoint),
    read: () => ({ status: "ok", raw }),
    logicalCloneSection: () => clone(logicalDraft),
  };
  return {
    durableState: { settings: { unit: "kg" }, programMeta: { id: "pm_seed01" }, program: [{ id: "exercise-1" }], log: [] },
    workoutDraft: draft,
    programEntryDraft: {
      schemaVersion: 1,
      draftId: "entry-seed-01",
      revision: 3,
      ownerId: "owner-only",
      state: {
        schemaVersion: 1,
        draftId: "entry-seed-01",
        route: "build",
        step: "program",
        answers: { goal: "muscle_growth" },
        legacyHints: [],
        result: null,
        versions: { schema: 1 },
        activeProgramRevisionAtStart: 7,
        futureRequiredField: { preserved: true },
        createdAt: "2026-09-08T17:00:00.000Z",
        updatedAt: "2026-09-08T17:30:00.000Z",
      },
    },
    uiPreferences: { theme: "dark", importSourceMode: "manual" },
    analytics: { enabled: true },
    telemetryIdentity: { schemaVersion: 1, installationId: "3e1f5c8a-9d02-4b77-8a31-6e4d2c9f0ab5", createdAt: "2026-08-01T10:00:00.000Z" },
    sourceRevision: 42,
    logicalDraft,
  };
}

function sourceDescriptor(source) {
  return {
    context: "browser",
    logicalInstallationId: source.telemetryIdentity.installationId,
    sourceRevision: source.sourceRevision,
  };
}

function makeClient({ transport, contract = makeContract(), context = "browser", document = cookieDocument(), outbound = markerStore(), inbound = markerStore(), vault, now = "2026-09-08T19:00:00.000Z" } = {}) {
  return Transfer.createClient({
    contract,
    crypto: webcrypto,
    transport,
    context,
    now: () => now,
    document,
    location: { href: context === "browser" ? "https://pedrochagasmaster.github.io/repforge/index.html" : "https://pedrochagasmaster.github.io/repforge/index.html" },
    storage: { outbound, inbound, credentials: vault },
  });
}

async function main() {
  console.log("Plan 053 P3 install-transfer client (injected contract; parity pending P1b publication)");

  await test("published state and endpoint fixtures are explicit", () => {
    check(EXPECTATIONS.kind === "taurifer-install-transfer", "unexpected envelope kind");
    check(EXPECTATIONS.schemaVersion === 1, "unexpected envelope version");
    check(Object.values(EXPECTATIONS.endpoints).every((path) => path.startsWith("/v1/transfers")), "endpoint path escaped the approved prefix");
    check(new Set(EXPECTATIONS.clientStates).size === EXPECTATIONS.clientStates.length, "client state enum repeats a value");
  });

  await test("exports the same API through a classic browser global", () => {
    const browserGlobal = {};
    runInNewContext(readFileSync(join(ROOT, "install-transfer.js"), "utf8"), { globalThis: browserGlobal });
    check(browserGlobal.RepForgeInstallTransfer?.COOKIE_NAME === EXPECTATIONS.cookieName, "classic global was not published");
    check(browserGlobal.RepForgeInstallTransfer?.ENDPOINTS?.claim === EXPECTATIONS.endpoints.claim, "classic global endpoint contract drifted");
  });

  await test("builds a fresh semantic envelope from acknowledged producers", async () => {
    const source = makeSource();
    const calls = [];
    const built = await Transfer.buildEnvelope({
      sections: source,
      source: { context: "browser", logicalInstallationId: source.telemetryIdentity.installationId, sourceRevision: source.sourceRevision },
      createdAt: "2026-09-08T19:00:00.000Z",
      contract: makeContract({ calls }),
      crypto: webcrypto,
    });
    check(built.ok, `envelope build failed: ${built.code}`);
    check(exactKeys(built.value, ["kind", "schemaVersion", "createdAt", "source", "sourceRevision", "durableState", "workoutDraft", "programEntryDraft", "uiPreferences", "analytics", "telemetryIdentity", "integrity"]), "wire envelope has an unexpected shape");
    check(built.value.integrity.canonicalPayloadHash === hashOf(built.value), "canonical payload hash does not cover the fresh envelope");
    check(!Object.hasOwn(built.value, "logicalStateDigest"), "source-local digest leaked onto the wire");
    check(EXPECTATIONS.draftLogicalKeys.every((key) => Object.hasOwn(built.value.workoutDraft, key)), "logical DraftV2 section lost a field");
    check(!Object.hasOwn(built.value.workoutDraft, "writer") && !Object.hasOwn(built.value.workoutDraft, "revision"), "DraftV2 operational fields crossed the clone boundary");
    check(EXPECTATIONS.candidateLogicalKeys.every((key) => Object.hasOwn(built.value.programEntryDraft, key)), "candidate inner state lost a field");
    check(built.value.programEntryDraft.activeProgramRevisionAtStart === 7, "candidate precondition was discarded");
    check(!Object.hasOwn(built.value.programEntryDraft, "revision") && !Object.hasOwn(built.value.programEntryDraft, "ownerId"), "candidate persistence wrapper crossed the clone boundary");
    check(built.value.programEntryDraft.futureRequiredField?.preserved === true, "unknown candidate state was silently discarded");
    check(calls.some(([name]) => name === "validateEnvelopeIntegrity"), "shared integrity boundary was not invoked");
  });

  await test("flushes acknowledged DraftV2 before building and accepts absent/tombstone null", async () => {
    const source = makeSource();
    const activeBuilt = await Transfer.buildEnvelope({ sections: source, source: sourceDescriptor(source), contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    check(activeBuilt.ok, "active draft could not be built before null cases");
    const absent = { ...source, workoutDraft: {
      flush: async () => {}, current: () => null,
      checkpoint: () => ({ status: "absent", raw: null }),
      read: () => ({ status: "ok", raw: null }),
      logicalCloneSection: () => { throw new Error("logical clone must not run for absence"); },
    } };
    const absentBuilt = await Transfer.buildEnvelope({ sections: absent, source: { context: "browser", logicalInstallationId: "li_absent", sourceRevision: 1 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    check(absentBuilt.ok && absentBuilt.value.workoutDraft === null, "confirmed absent draft did not become null");
    const tombstone = { ...source, workoutDraft: {
      flush: async () => {}, current: () => null,
      checkpoint: () => ({ status: "valid", value: { kind: "tombstone" } }),
      read: () => ({ status: "ok", raw: null }),
      logicalCloneSection: () => { throw new Error("logical clone must not run for tombstone"); },
    } };
    const tombstoneBuilt = await Transfer.buildEnvelope({ sections: tombstone, source: { context: "browser", logicalInstallationId: "li_tombstone", sourceRevision: 1 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    check(tombstoneBuilt.ok && tombstoneBuilt.value.workoutDraft === null, "acknowledged tombstone was not trusted as null");
    check(source.workoutDraft.flushCalls === 1, "DraftV2 flush barrier was not awaited");
  });

  await test("rejects an untrusted active draft without returning user values", async () => {
    const source = makeSource();
    source.workoutDraft = {
      flush: async () => {}, current: () => null,
      checkpoint: () => ({ status: "invalid", raw: "malformed" }),
      read: () => ({ status: "ok", raw: "{\"draftId\":\"secret\"}" }),
      logicalCloneSection: () => null,
    };
    const result = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_bad", sourceRevision: 1 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    assert.deepEqual(result, { ok: false, code: "untrusted-workout-draft" });
  });

  await test("source-local logical digest covers ordered sections but never enters the envelope", async () => {
    const source = makeSource();
    const contract = makeContract();
    const first = await Transfer.logicalStateDigest(source, contract, webcrypto);
    const changed = { ...source, durableState: clone(source.durableState) };
    changed.durableState.program.push({ id: "exercise-2" });
    const second = await Transfer.logicalStateDigest(changed, contract, webcrypto);
    check(first.ok && second.ok && first.value !== second.value, "logical digest ignored a logical section change");
    const built = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_digest", sourceRevision: 1 }, contract, crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    check(!JSON.stringify(built.value).includes("logicalStateDigest"), "logical digest was serialized into the envelope");
  });

  await test("context eligibility blocks empty sources and standalone creation", () => {
    assert.deepEqual(Transfer.contextEligibility({ action: "create", context: "browser", hasMeaningfulData: false }), { eligible: false, code: "no-transferable-data" });
    assert.deepEqual(Transfer.contextEligibility({ action: "create", context: "standalone", hasMeaningfulData: true }), { eligible: false, code: "wrong-context" });
    assert.deepEqual(Transfer.contextEligibility({ action: "create", context: "browser", hasMeaningfulData: true }), { eligible: true, code: null });
    assert.deepEqual(Transfer.contextEligibility({ action: "claim", context: "standalone", hasMeaningfulData: false }), { eligible: true, code: null });
  });

  const vaultStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: vaultStore });

  await test("seals credentials with nonextractable AES-GCM keys in the injected context store", async () => {
    const sealed = await vault.seal("browser-outbound", { token: "T".repeat(43), claimId: "C".repeat(22) });
    check(sealed.version === 1 && sealed.algorithm === "AES-GCM", "sealed credential metadata is not versioned AES-GCM");
    check(!JSON.stringify(sealed).includes("T".repeat(43)), "plaintext token crossed the sealed credential boundary");
    const key = [...vaultStore.records.values()][0];
    check(key.extractable === false, "credential key is extractable");
    await assert.rejects(() => webcrypto.subtle.exportKey("raw", key));
    assert.deepEqual(await vault.unseal("browser-outbound", sealed), { token: "T".repeat(43), claimId: "C".repeat(22) });
    await vault.forget("browser-outbound", sealed);
    await assert.rejects(() => vault.unseal("browser-outbound", sealed));
  });

  await test("does not create before analytics consent", async () => {
    const transport = transportSequence([response(201, { token: "A".repeat(43), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const client = makeClient({ transport, outbound, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: false }, hasMeaningfulData: true });
    assert.deepEqual(result, { ok: false, state: "idle", code: "consent-required" });
    check(transport.requests.length === 0 && outbound.writes.length === 0, "pre-consent create touched transport or marker storage");
  });

  await test("does not create for an empty first-run source", async () => {
    const transport = transportSequence([response(201, { token: "Z".repeat(43), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const client = makeClient({ transport, outbound, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: false });
    assert.deepEqual(result, { ok: false, state: "idle", code: "no-transferable-data" });
    check(transport.requests.length === 0 && outbound.writes.length === 0, "empty source touched transport or marker storage");
  });

  await test("lost create response retries the same idempotency key without recovering a token", async () => {
    const transport = transportSequence([new Error("network timeout"), response(200, { duplicate: true, expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const document = cookieDocument();
    const client = makeClient({ transport, outbound, document, vault });
    const source = makeSource();
    const first = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(!first.ok && first.state === "unknown-outcome" && first.code === "create-unknown-outcome", "lost create did not enter unknown outcome");
    check(client.recoveryState() === "resumeWarning", "lost create did not require a browser divergence warning");
    check(outbound.peek()?.phase === "creating" && !outbound.peek()?.token, "lost create marker retained a plaintext token");
    const retrySource = makeSource();
    const second = await client.create({ sections: retrySource, source: sourceDescriptor(retrySource), consent: { enabled: true }, hasMeaningfulData: true });
    check(!second.ok && second.state === "unknown-outcome" && !Object.hasOwn(second, "token"), "same-key duplicate recovered or exposed a token");
    check(transport.requests[0].body.idempotencyKey === transport.requests[1].body.idempotencyKey, "create retry minted a second idempotency key");
    check(!document.cookie.includes("repforge_transfer_v1="), "lost create wrote a transfer cookie without a bearer");
  });

  await test("successful create stores only sealed credentials and writes the dedicated cookie", async () => {
    const token = "B".repeat(43);
    const transport = transportSequence([response(201, { token, expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const client = makeClient({ transport, outbound, document, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(result.ok && result.state === "ready" && result.expiresAt === "2026-09-08T20:00:00.000Z", "successful create did not become ready");
    check(client.recoveryState() === "awaitingClaimOutcome", "ready create did not retain an awaiting-claim recovery state");
    check(!Object.hasOwn(result, "token"), "create result exposed the bearer");
    check(outbound.peek()?.phase === "awaiting-claim" && !JSON.stringify(outbound.peek()).includes(token), "outbound marker contains plaintext token");
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary") && document.cookie.includes("repforge_transfer_v1="), "setup and transfer cookies did not coexist");
    check(!document.textContent.includes(token), "token reached DOM text");
    check(!transport.requests[0].path.includes("?"), "create token or envelope reached a URL query");
  });

  await test("cookie parser uses the exact index path and preserves setup-cookie coexistence", () => {
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const location = { href: "https://pedrochagasmaster.github.io/repforge/" };
    const wrote = Transfer.writeTransferCookie({ token: "D".repeat(43), expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location, now: "2026-09-08T19:00:00.000Z" });
    check(wrote === true, "transfer cookie write failed");
    const last = document.writes.at(-1);
    check(last.includes("repforge_transfer_v1=") && last.includes("Path=/repforge/index.html") && last.includes("Max-Age=3600") && /SameSite=Lax/.test(last) && /Secure/.test(last), "production cookie attributes drifted");
    check(Transfer.readTransferCookie({ document })?.token === "D".repeat(43), "transfer cookie did not parse");
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary"), "transfer cookie write overwrote setup cookie");
    Transfer.clearTransferCookie({ document, location });
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary") && !document.cookie.includes("repforge_transfer_v1="), "transfer cookie clear touched setup cookie");
    const local = cookieDocument();
    Transfer.writeTransferCookie({ token: "E".repeat(43), expiresAt: "2026-09-08T20:00:00.000Z" }, { document: local, location: { href: "http://localhost:8055/" }, now: "2026-09-08T19:00:00.000Z" });
    check(local.writes[0].includes("Path=/index.html") && !/;\s*Secure(?:;|$)/i.test(local.writes[0]), "localhost cookie path/security drifted");
  });

  await test("fetch transport enforces body-only no-store/no-redirect requests", async () => {
    const calls = [];
    const fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return { status: 200, arrayBuffer: async () => textEncoder.encode(JSON.stringify({ state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })).buffer };
    };
    const transport = Transfer.createFetchTransport({ fetch, baseUrl: "https://transfer.example/" });
    const reply = await transport.request({ path: EXPECTATIONS.endpoints.status, body: { token: "F".repeat(43) } });
    check(reply.status === 200 && reply.bytes instanceof Uint8Array, "fetch transport did not return bounded response bytes");
    check(calls[0].url === "https://transfer.example/v1/transfers/status", "transport changed the exact endpoint URL");
    check(calls[0].options.cache === "no-store" && calls[0].options.redirect === "error", "transport allows caching or redirects");
    check(calls[0].options.headers["Cache-Control"] === "no-store" && calls[0].options.credentials === "omit", "transport headers/credentials drifted");
    check(!calls[0].url.includes("F".repeat(43)), "transport put token in the URL");
  });

  await test("claim retries the same sealed claim and validates the returned envelope", async () => {
    const source = makeSource();
    const built = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_claim", sourceRevision: 42 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    const token = "G".repeat(43);
    const transport = transportSequence([new Error("claim response lost"), response(200, { envelope: built.value, expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const inbound = markerStore();
    const document = cookieDocument();
    Transfer.writeTransferCookie({ token, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" });
    const client = makeClient({ transport, inbound, document, context: "standalone", vault });
    const first = await client.claim();
    check(!first.ok && first.state === "unknown-outcome", "lost claim did not retain an indeterminate state");
    check(inbound.peek()?.phase === "claiming" && !JSON.stringify(inbound.peek()).includes(token), "inbound marker exposed plaintext token");
    const second = await client.claim();
    check(second.ok && second.state === "validating" && second.envelope.kind === EXPECTATIONS.kind, "same-claim retry did not return the validated envelope");
    check(transport.requests[0].body.claimId === transport.requests[1].body.claimId, "claim retry minted a second claim ID");
    check(transport.requests[0].body.token === token && transport.requests[1].body.token === token, "claim body lost the bearer required by the service");
    check(inbound.peek()?.phase === "claimed", "claim marker did not advance after the bound response");
    check(!document.cookie.includes("repforge_transfer_v1="), "installed claim did not consume the transfer cookie");
  });

  await test("rejects extra response fields and preserves closed failure shapes", async () => {
    const transport = transportSequence([response(201, { token: "H".repeat(43), expiresAt: "2026-09-08T20:00:00.000Z", clone: "forbidden" })]);
    const client = makeClient({ transport, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(!result.ok && result.state === "retryable" && result.code === "invalid-response", "extra response field was accepted");
    check(!Object.hasOwn(result, "token") && !Object.hasOwn(result, "body") && !Object.hasOwn(result, "message"), "failure result carried user values");
  });

  await test("commit clears only sealed inbound credentials after verified deletion", async () => {
    const token = "I".repeat(43);
    const claimId = "J".repeat(22);
    const sealed = await vault.seal("standalone-inbound", { token, claimId });
    const inbound = markerStore({ version: 1, phase: "local-committed", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, inbound, context: "standalone", vault });
    const result = await client.commit();
    check(result.ok && result.state === "complete", "verified commit did not complete");
    check(inbound.peek() === null && transport.requests[0].body.token === token && transport.requests[0].body.claimId === claimId, "commit credential lifecycle was incorrect");
    await assert.rejects(() => vault.unseal("standalone-inbound", sealed));
  });

  await test("status reports only approved state and expiry and treats unavailable as indeterminate", async () => {
    const token = "K".repeat(43);
    const sealed = await vault.seal("browser-outbound", { token });
    const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, outbound, vault });
    const result = await client.status();
    check(result.ok && result.state === "confirmed" && result.remoteState === "deleted", "deleted status did not confirm recovery");
    check(client.recoveryState() === "confirmed", "deleted status did not confirm the browser recovery state");
    check(exactKeys(result, ["ok", "state", "remoteState", "expiresAt"]), "status result disclosed an unapproved field");
    const unavailableTransport = transportSequence([response(404, { state: "unavailable" })]);
    const unavailable = makeClient({ transport: unavailableTransport, outbound: markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" }), vault }).status();
    const uncertain = await unavailable;
    check(!uncertain.ok && uncertain.state === "unknown-outcome" && uncertain.code === "status-unavailable", "unavailable status silently resumed");
  });

  await test("lost browser outbound credentials stay indeterminate", async () => {
    const lostStore = memoryKeyStore();
    const lostVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: lostStore });
    const sealed = await lostVault.seal("browser-outbound", { token: "L".repeat(43) });
    await lostVault.forget("browser-outbound", sealed);
    const client = makeClient({ outbound: markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed }), vault: lostVault, transport: transportSequence([]) });
    const result = await client.status();
    check(!result.ok && result.state === "unknown-outcome" && result.code === "credential-unavailable", "lost outbound credential silently resumed");
  });

  console.log(`install-transfer client tests: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

await main();
