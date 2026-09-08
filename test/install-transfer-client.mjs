#!/usr/bin/env node
/**
 * Plan 053 P3 isolated browser-client contract tests.
 *
 * This remains the client fault-policy suite with an explicitly named local
 * contract double. It must not duplicate or claim parity with the shared
 * module; the actual shared-module parity proof lives in
 * install-transfer-client-contract.mjs. These tests prove the client
 * boundary, transport policy, cookie separation, retry credentials, and clone
 * producer seam against the intentionally narrow double.
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
const FAULT_EXPECTATIONS = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-client/fault-expectations.json"), "utf8"));

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

function tokenFixture(seed = "A") {
  const start = seed.charCodeAt(0);
  const segment = (offset) => base64url(Uint8Array.from({ length: 32 }, (_, index) => (start + offset + index) % 256));
  return `v1.k1.${segment(0)}.${segment(1)}.${segment(2)}`;
}

function exactKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function validMarkerId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

const LIMITS = {
  requestBytes: {
    [EXPECTATIONS.endpoints.create]: 2_000_000,
    [EXPECTATIONS.endpoints.claim]: 4_096,
    [EXPECTATIONS.endpoints.commit]: 4_096,
    [EXPECTATIONS.endpoints.status]: 4_096,
    "/envelope": FAULT_EXPECTATIONS.responseBounds.claimResponseBytes,
  },
};

// This local double remains intentionally narrow; the accepted shared-module
// parity proof lives in install-transfer-client-contract.mjs.
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

function cookieDocument(initial = "", { silent = false } = {}) {
  let cookie = initial;
  const writes = [];
  return {
    writes,
    get cookie() { return cookie; },
    set cookie(value) {
      writes.push(String(value));
      if (silent) return;
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

function operationLock() {
  let tail = Promise.resolve();
  const calls = [];
  return {
    calls,
    withLock(name, work) {
      calls.push(name);
      const next = tail.then(() => work());
      tail = next.catch(() => {});
      return next;
    },
  };
}

// A small Web Locks-shaped adapter. Queues are keyed by the requested name;
// this deliberately does not hide a missing cross-method lock behind one
// process-wide promise.
function navigatorLocksDouble() {
  const queues = new Map();
  const calls = [];
  const starts = [];
  const navigator = {
    locks: {
      request(name, options, callback) {
        if (options?.mode !== "exclusive") throw new Error("exclusive-lock-required");
        const previous = queues.get(name) || Promise.resolve();
        const next = previous.then(() => {
          starts.push(name);
          return callback({ name, mode: options.mode });
        });
        queues.set(name, next.catch(() => {}));
        return next;
      },
    },
  };
  return {
    navigator,
    calls,
    starts,
    withLock(name, work) {
      calls.push(name);
      return navigator.locks.request(name, { mode: "exclusive" }, work);
    },
  };
}

function normalizedProducer(value) {
  return { logicalCloneSection: () => clone(value) };
}

function countedProducer(value, counts, name) {
  return { logicalCloneSection: () => { counts[name] = (counts[name] || 0) + 1; return clone(value); } };
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
    durableState: normalizedProducer({ settings: { unit: "kg" }, programMeta: { id: "pm_seed01" }, program: [{ id: "exercise-1" }], log: [] }),
    workoutDraft: draft,
    programEntryDraft: normalizedProducer({
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
    }),
    uiPreferences: normalizedProducer({ theme: "dark", importSourceMode: "manual" }),
    analytics: normalizedProducer({ enabled: true }),
    telemetryIdentity: normalizedProducer({ schemaVersion: 1, installationId: "3e1f5c8a-9d02-4b77-8a31-6e4d2c9f0ab5", createdAt: "2026-08-01T10:00:00.000Z" }),
    sourceRevision: 42,
    logicalDraft,
  };
}

function sourceDescriptor(source) {
  return {
    context: "browser",
    logicalInstallationId: source.telemetryIdentity.logicalCloneSection().installationId,
    sourceRevision: source.sourceRevision,
  };
}

function makeClient({ transport, contract = makeContract(), crypto = webcrypto, context = "browser", document = cookieDocument(), outbound = markerStore(), inbound = markerStore(), vault, credentials = vault, operationLock: lock = operationLock(), now = "2026-09-08T19:00:00.000Z" } = {}) {
  return Transfer.createClient({
    contract,
    crypto,
    transport,
    context,
    now: () => now,
    document,
    location: { href: context === "browser" ? "https://pedrochagasmaster.github.io/repforge/index.html" : "https://pedrochagasmaster.github.io/repforge/index.html" },
    storage: { outbound, inbound, credentials, operationLock: lock },
  });
}

function cryptoWithDigestFailure(after = 0) {
  let calls = 0;
  const subtle = new Proxy(webcrypto.subtle, {
    get(target, property) {
      if (property === "digest") return async (...args) => {
        calls += 1;
        if (calls > after) throw new Error("digest-fault");
        return target.digest.apply(target, args);
      };
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle };
}

async function main() {
  console.log("Plan 053 P3 install-transfer client (local fault-policy contract double)");

  await test("published state and endpoint fixtures are explicit", () => {
    check(EXPECTATIONS.kind === "taurifer-install-transfer", "unexpected envelope kind");
    check(EXPECTATIONS.schemaVersion === 1, "unexpected envelope version");
    check(Object.values(EXPECTATIONS.endpoints).every((path) => path.startsWith("/v1/transfers")), "endpoint path escaped the approved prefix");
    check(new Set(EXPECTATIONS.clientStates).size === EXPECTATIONS.clientStates.length, "client state enum repeats a value");
  });

  await test("validates the pinned bearer structure without pretending to verify its MAC", () => {
    const token = tokenFixture("Q");
    check(Transfer.validateTransferToken(token), "canonical service bearer shape was rejected");
    check(!Transfer.validateTransferToken("Q".repeat(43)), "legacy unconstrained bearer shape was accepted");
    check(!Transfer.validateTransferToken(token.replace("k1", "key-id-that-is-too-long")), "oversized bearer key id was accepted");
    check(!Transfer.validateTransferToken(token.replace(/\.[^.]+$/, "." + "A".repeat(42))), "non-32-byte bearer segment was accepted");
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
      source: sourceDescriptor(source),
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

  await test("requires normalized producers and strips only path-specific sidecars", async () => {
    const source = makeSource();
    source.durableState = normalizedProducer({
      settings: { unit: "kg" },
      program: [{ id: "exercise-1" }],
      _storageRevision: 88,
      _storageDraftTransaction: { secret: "must-not-cross" },
      _storageSetupActivation: { secret: "must-not-cross" },
      "repforge_pending_v1:legacy": { secret: "must-not-cross" },
      "repforge_draft_v1:pending:writer": { secret: "must-not-cross" },
      "repforge_draft_v1:closing:writer": { secret: "must-not-cross" },
      "repforge_draft_v1:recovery": { secret: "must-not-cross" },
      pending: { logical: "retain" },
      closing: { logical: "retain" },
      approvedFutureField: { retained: true },
    });
    source.uiPreferences = normalizedProducer({
      theme: "dark",
      importSourceMode: "freeform",
      freeform: { logical: "retain" },
      reply: "retain",
      stage: "review",
      lastProvider: "claude",
      repforge_freeform_session_v1: { source: "sidecar" },
      repforge_import_source_v1: "freeform",
    });
    const built = await Transfer.buildEnvelope({ sections: source, source: sourceDescriptor(source), contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    check(built.ok, "normalized producer envelope failed");
    check(!Object.hasOwn(built.value.durableState, "_storageRevision") && !Object.hasOwn(built.value.durableState, "_storageDraftTransaction") && !Object.hasOwn(built.value.durableState, "_storageSetupActivation") &&
      !Object.keys(built.value.durableState).some((key) => key.startsWith("repforge_pending_v1:") || key.startsWith("repforge_draft_v1:pending:") || key.startsWith("repforge_draft_v1:closing:") || key.startsWith("repforge_draft_v1:recovery")), "durable storage sidecars crossed the producer boundary");
    check(built.value.durableState.pending?.logical === "retain" && built.value.durableState.closing?.logical === "retain", "logical pending/closing fields were discarded");
    check(built.value.durableState.approvedFutureField?.retained === true, "approved additive durable field was discarded");
    check(built.value.uiPreferences.theme === "dark" && built.value.uiPreferences.importSourceMode === "freeform" && built.value.uiPreferences.freeform?.logical === "retain" && built.value.uiPreferences.reply === "retain" && built.value.uiPreferences.stage === "review" && built.value.uiPreferences.lastProvider === "claude", "logical UI preference fields were discarded");
    check(!Object.hasOwn(built.value.uiPreferences, "repforge_freeform_session_v1") && !Object.hasOwn(built.value.uiPreferences, "repforge_import_source_v1"), "session storage sidecars crossed the producer boundary");
    const raw = { ...source, durableState: source.durableState.logicalCloneSection() };
    const rejected = await Transfer.captureLogicalSnapshot(raw);
    check(!rejected.ok && rejected.code === "durable-state-producer-unavailable", "raw durable storage was accepted without an adapter");
  });

  await test("captures one normalized logical snapshot for upload and digest", async () => {
    const counts = {};
    const source = makeSource();
    const descriptor = sourceDescriptor(source);
    for (const name of ["durableState", "programEntryDraft", "uiPreferences", "analytics", "telemetryIdentity"]) {
      source[name] = countedProducer(source[name].logicalCloneSection(), counts, name);
    }
    const transport = transportSequence([response(201, { token: tokenFixture("S"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const testVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    const client = makeClient({ transport, outbound: markerStore(), vault: testVault });
    const result = await client.create({ sections: source, source: descriptor, consent: { enabled: true }, hasMeaningfulData: true });
    check(result.ok && result.state === "ready", "single-snapshot create did not complete");
    check(Object.values(counts).every((count) => count === 1), `producer snapshot was captured more than once: ${JSON.stringify(counts)}`);
  });

  await test("freezes the creating identity when a normalized producer cannot be trusted", async () => {
    const transport = transportSequence([response(201, { token: tokenFixture("T"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const source = makeSource();
    source.uiPreferences = { theme: "dark" };
    const testVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    const client = makeClient({ transport, outbound, vault: testVault });
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(!result.ok && result.state === FAULT_EXPECTATIONS.createFailureBoundary.captureFailure.state && result.code === FAULT_EXPECTATIONS.createFailureBoundary.captureFailure.code, "untrusted producer did not freeze the creating identity");
    check(transport.requests.length === 0 && outbound.peek()?.phase === "creating" && validMarkerId(outbound.peek()?.idempotencyKey), "producer failure did not retain the creating marker");
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
    const changedDurable = clone(source.durableState.logicalCloneSection());
    changedDurable.program.push({ id: "exercise-2" });
    const changed = { ...source, durableState: normalizedProducer(changedDurable) };
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
    const token = tokenFixture("T");
    const sealed = await vault.seal("browser-outbound", { token, claimId: "C".repeat(22) });
    check(sealed.version === 1 && sealed.algorithm === "AES-GCM", "sealed credential metadata is not versioned AES-GCM");
    check(!JSON.stringify(sealed).includes(token), "plaintext token crossed the sealed credential boundary");
    const key = [...vaultStore.records.values()][0];
    check(key.extractable === false, "credential key is extractable");
    await assert.rejects(() => webcrypto.subtle.exportKey("raw", key));
    assert.deepEqual(await vault.unseal("browser-outbound", sealed), { token, claimId: "C".repeat(22) });
    await vault.forget("browser-outbound", sealed);
    await assert.rejects(() => vault.unseal("browser-outbound", sealed));
  });

  await test("does not create before explicit transfer consent", async () => {
    const transport = transportSequence([response(201, { token: tokenFixture("A"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const client = makeClient({ transport, outbound, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: false }, hasMeaningfulData: true });
    assert.deepEqual(result, { ok: false, state: "idle", code: "consent-required" });
    check(transport.requests.length === 0 && outbound.writes.length === 0, "pre-consent create touched transport or marker storage");
  });

  await test("does not create for an empty first-run source", async () => {
    const transport = transportSequence([response(201, { token: tokenFixture("Z"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
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
    check(outbound.peek()?.phase === "creating" && outbound.peek()?.expiresAt === "2026-09-08T20:00:00.000Z", "duplicate response did not persist the server expiry on the indeterminate marker");
    check(!document.cookie.includes("repforge_transfer_v1="), "lost create wrote a transfer cookie without a bearer");
  });

  await test("successful create stores only sealed credentials and writes the dedicated cookie", async () => {
    const token = tokenFixture("B");
    const transport = transportSequence([response(201, { token, expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const outbound = markerStore();
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const client = makeClient({ transport, outbound, document, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(result.ok && result.state === "ready" && result.expiresAt === "2026-09-08T20:00:00.000Z", "successful create did not become ready");
    check(result.stale === true && outbound.peek()?.mutatedAfterCreation === true, "missing source observer was treated as proof of a fresh source");
    check(client.recoveryState() === "awaitingClaimOutcome", "ready create did not retain an awaiting-claim recovery state");
    check(!Object.hasOwn(result, "token"), "create result exposed the bearer");
    check(outbound.peek()?.phase === "awaiting-claim" && !JSON.stringify(outbound.peek()).includes(token), "outbound marker contains plaintext token");
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary") && document.cookie.includes("repforge_transfer_v1="), "setup and transfer cookies did not coexist");
    check(!document.textContent.includes(token), "token reached DOM text");
    check(!transport.requests[0].path.includes("?"), "create token or envelope reached a URL query");
  });

  await test("freezes the original idempotency marker for every possibly-successful malformed create", async () => {
    const cases = [
      ["malformed201", response(201, { token: tokenFixture("M"), expiresAt: "2026-09-08T20:00:00.000Z", extra: true })],
      ["unexpectedResponse", response(202, { accepted: true })],
    ];
    for (const [name, reply] of cases) {
      const outbound = markerStore();
      const transport = transportSequence([reply]);
      const source = makeSource();
      const client = makeClient({ transport, outbound, vault });
      const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
      check(result.state === FAULT_EXPECTATIONS.createFailureBoundary[name].state && result.code === FAULT_EXPECTATIONS.createFailureBoundary[name].code, `${name} did not freeze as unknown outcome`);
      check(outbound.peek()?.phase === "creating" && validMarkerId(outbound.peek()?.idempotencyKey), `${name} discarded the creating marker identity`);
      check(outbound.writes.every((entry) => entry !== null), `${name} cleared a possibly-successful marker`);
    }
  });

  await test("sealing or token hashing failure after create freezes without a new key", async () => {
    const source = makeSource();
    const buildOutbound = markerStore();
    const buildClient = makeClient({
      transport: transportSequence([response(201, { token: tokenFixture("Q"), expiresAt: "2026-09-08T20:00:00.000Z" })]),
      outbound: buildOutbound,
      vault,
      crypto: cryptoWithDigestFailure(0),
    });
    const buildResult = await buildClient.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(buildResult.state === FAULT_EXPECTATIONS.createFailureBoundary.buildFailure.state && buildResult.code === FAULT_EXPECTATIONS.createFailureBoundary.buildFailure.code, "build failure was retryable instead of frozen");
    check(buildOutbound.peek()?.phase === "creating" && validMarkerId(buildOutbound.peek()?.idempotencyKey), "build failure lost idempotency identity");

    const digestOutbound = markerStore();
    const digestClient = makeClient({
      transport: transportSequence([response(201, { token: tokenFixture("R"), expiresAt: "2026-09-08T20:00:00.000Z" })]),
      outbound: digestOutbound,
      vault,
      crypto: cryptoWithDigestFailure(1),
    });
    const digestResult = await digestClient.create({ sections: makeSource(), source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(digestResult.state === FAULT_EXPECTATIONS.createFailureBoundary.digestFailure.state && digestResult.code === FAULT_EXPECTATIONS.createFailureBoundary.digestFailure.code, "logical digest failure was retryable instead of frozen");
    check(digestOutbound.peek()?.phase === "creating" && validMarkerId(digestOutbound.peek()?.idempotencyKey), "logical digest failure lost idempotency identity");

    const sealOutbound = markerStore();
    const sealTransport = transportSequence([response(201, { token: tokenFixture("N"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const sealFailure = { seal: async () => { throw new Error("seal-fault"); }, unseal: async () => { throw new Error("missing"); }, forget: async () => {} };
    const sealClient = makeClient({ transport: sealTransport, outbound: sealOutbound, credentials: sealFailure, vault: sealFailure });
    const sealResult = await sealClient.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(sealResult.state === "unknown-outcome" && sealResult.code === "create-unknown-outcome", "seal failure was retryable instead of frozen");
    check(sealOutbound.peek()?.phase === "creating", "seal failure lost idempotency identity");

    const hashOutbound = markerStore();
    const hashTransport = transportSequence([response(201, { token: tokenFixture("O"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const hashSource = makeSource();
    const hashClient = makeClient({ transport: hashTransport, outbound: hashOutbound, vault, crypto: cryptoWithDigestFailure(2) });
    const hashResult = await hashClient.create({ sections: hashSource, source: sourceDescriptor(hashSource), consent: { enabled: true }, hasMeaningfulData: true });
    check(hashResult.state === "unknown-outcome" && hashResult.code === "create-unknown-outcome", "hash failure was retryable instead of frozen");
    check(hashOutbound.peek()?.phase === "creating", "hash failure lost idempotency identity");
  });

  await test("service-unavailable create responses preserve the creating marker", async () => {
    const outbound = markerStore();
    const transport = transportSequence([response(503, { state: "unavailable" })]);
    const source = makeSource();
    const client = makeClient({ transport, outbound, vault });
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(result.state === "terminalUnavailable" && result.code === "service-unavailable", "service outage did not use the terminal unavailable result");
    check(outbound.peek()?.phase === "creating" && outbound.writes.every((entry) => entry !== null), "service outage cleared the retry identity");
  });

  await test("missing transfer-operation lock fails before marker or POST", async () => {
    const outbound = markerStore();
    const transport = transportSequence([response(201, { token: tokenFixture("P"), expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const source = makeSource();
    const client = makeClient({ transport, outbound, vault, operationLock: null });
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(result.code === FAULT_EXPECTATIONS.operationLock.missingLockCode && result.state === "retryable", "missing lock did not fail closed");
    check(transport.requests.length === 0 && outbound.writes.length === 0, "missing lock touched network or marker storage");
  });

  await test("one navigator lock key serializes create and status across method boundaries", async () => {
    const lock = navigatorLocksDouble();
    const outbound = markerStore();
    const sharedVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    let releaseCreate;
    const createGate = new Promise((resolve) => { releaseCreate = resolve; });
    let createStarted;
    const createStartedPromise = new Promise((resolve) => { createStarted = resolve; });
    const transport = {
      requests: [],
      async request(request) {
        this.requests.push(clone(request));
        if (request.path === EXPECTATIONS.endpoints.create) {
          createStarted();
          await createGate;
          throw new Error("create-response-lost");
        }
        throw new Error("status-should-not-post");
      },
    };
    const source = makeSource();
    const creator = makeClient({ transport, outbound, vault: sharedVault, operationLock: lock });
    const observer = makeClient({ transport, outbound, vault: sharedVault, operationLock: lock });
    const createPromise = creator.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    await createStartedPromise;
    const statusPromise = observer.status();
    await new Promise((resolve) => setTimeout(resolve, 0));
    check(lock.starts.length === 1, "status entered a separate keyed lock while create was paused");
    releaseCreate();
    const [createResult, statusResult] = await Promise.all([createPromise, statusPromise]);
    check(createResult.state === "unknown-outcome" && statusResult.state === "unknown-outcome", "cross-method barrier did not preserve indeterminate state");
    check(new Set(lock.calls).size === 1 && lock.calls[0] === FAULT_EXPECTATIONS.operationLock.contextName, "create/status used separate operation lock names");
  });

  await test("one navigator lock key serializes claim and commit across method boundaries", async () => {
    const lock = navigatorLocksDouble();
    const token = tokenFixture("C");
    const claimId = "D".repeat(22);
    const keyStore = memoryKeyStore();
    const sharedVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
    const sealed = await sharedVault.seal("standalone-inbound", { token, claimId });
    const inbound = markerStore({ version: 1, phase: "claiming", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    let releaseClaim;
    const claimGate = new Promise((resolve) => { releaseClaim = resolve; });
    let claimStarted;
    const claimStartedPromise = new Promise((resolve) => { claimStarted = resolve; });
    const transport = {
      requests: [],
      async request(request) {
        this.requests.push(clone(request));
        claimStarted();
        await claimGate;
        throw new Error("claim-response-lost");
      },
    };
    const claimant = makeClient({ transport, inbound, context: "standalone", vault: sharedVault, operationLock: lock });
    const committer = makeClient({ transport, inbound, context: "standalone", vault: sharedVault, operationLock: lock });
    const claimPromise = claimant.claim();
    await claimStartedPromise;
    const commitPromise = committer.commit();
    await new Promise((resolve) => setTimeout(resolve, 0));
    check(lock.starts.length === 1, "commit entered a separate keyed lock while claim was paused");
    releaseClaim();
    const [claimResult, commitResult] = await Promise.all([claimPromise, commitPromise]);
    check(claimResult.state === "unknown-outcome" && commitResult.code === "local-import-required", "claim/commit barrier changed the recovery phase");
    check(new Set(lock.calls).size === 1 && lock.calls[0] === FAULT_EXPECTATIONS.operationLock.contextName, "claim/commit used separate operation lock names");
  });

  await test("cookie parser uses the exact index path and preserves setup-cookie coexistence", () => {
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const location = { href: "https://pedrochagasmaster.github.io/repforge/" };
    const tokenD = tokenFixture("D");
    const wrote = Transfer.writeTransferCookie({ token: tokenD, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location, now: "2026-09-08T19:00:00.000Z" });
    check(wrote === true, "transfer cookie write failed");
    const last = document.writes.at(-1);
    check(last.includes("repforge_transfer_v1=") && last.includes("Path=/repforge/index.html") && last.includes("Max-Age=3600") && /SameSite=Lax/.test(last) && /Secure/.test(last), "production cookie attributes drifted");
    check(Transfer.readTransferCookie({ document })?.token === tokenD, "transfer cookie did not parse");
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary"), "transfer cookie write overwrote setup cookie");
    Transfer.clearTransferCookie({ document, location });
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary") && !document.cookie.includes("repforge_transfer_v1="), "transfer cookie clear touched setup cookie");
    const local = cookieDocument();
    Transfer.writeTransferCookie({ token: tokenFixture("E"), expiresAt: "2026-09-08T20:00:00.000Z" }, { document: local, location: { href: "http://localhost:8055/" }, now: "2026-09-08T19:00:00.000Z" });
    check(local.writes[0].includes("Path=/index.html") && !/;\s*Secure(?:;|$)/i.test(local.writes[0]), "localhost cookie path/security drifted");

    const silentWrite = cookieDocument("repforge_setup_v1=v1.setup-canary", { silent: true });
    check(Transfer.writeTransferCookie({ token: tokenD, expiresAt: "2026-09-08T20:00:00.000Z" }, { document: silentWrite, location, now: "2026-09-08T19:00:00.000Z" }) === false, "silently rejected cookie write was reported as successful");
    check(Transfer.readTransferCookie({ document: silentWrite }) === null && silentWrite.cookie.includes("repforge_setup_v1=v1.setup-canary"), "silent cookie write changed neither transfer nor setup state");
    const seeded = cookieDocument();
    check(Transfer.writeTransferCookie({ token: tokenD, expiresAt: "2026-09-08T20:00:00.000Z" }, { document: seeded, location, now: "2026-09-08T19:00:00.000Z" }), "failed to seed a cookie for the clear probe");
    const silentClear = cookieDocument(seeded.cookie, { silent: true });
    check(Transfer.clearTransferCookie({ document: silentClear, location }) === false, "silently rejected cookie clear was reported as successful");
    check(Transfer.readTransferCookie({ document: silentClear })?.token === tokenD, "silent cookie clear lost the recoverable cookie value");
    check(Transfer.consumeTransferCookie({ document: silentClear, location }) === null, "consume returned a bearer after silent cookie deletion failure");
    check(Transfer.readTransferCookie({ document: silentClear })?.token === tokenD, "consume lost the bearer after silent cookie deletion failure");
  });

  await test("terminal inbound markers block cookie fallback before claim", async () => {
    for (const phase of FAULT_EXPECTATIONS.claimStateRace.protectedPhases) {
      const token = tokenFixture(phase === "local-committed" ? "L" : phase === "cleanup-pending" ? "M" : "N");
      const document = cookieDocument();
      check(Transfer.writeTransferCookie({ token, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" }), `${phase} cookie seed failed`);
      const inbound = markerStore({ version: 1, phase });
      const transport = transportSequence([response(200, { state: "unreachable", expiresAt: "2026-09-08T20:00:00.000Z" })]);
      const client = makeClient({ context: "standalone", transport, inbound, document, vault });
      const result = await client.claim();
      check(result.state === FAULT_EXPECTATIONS.claimStateRace.state && result.code === FAULT_EXPECTATIONS.claimStateRace.code, `${phase} marker did not stop claim fallback`);
      check(inbound.peek()?.phase === phase && Transfer.readTransferCookie({ document })?.token === token, `${phase} marker or cookie was mutated`);
      check(transport.requests.length === 0, `${phase} marker allowed a claim POST`);
    }
  });

  await test("every non-null malformed inbound marker fails closed before cookie fallback", async () => {
    const rows = [
      ["empty-object", {}],
      ["claimed-without-credentials", { version: 1, phase: "claimed" }],
      ["claiming-without-credentials", { version: 1, phase: "claiming" }],
      ["staged-without-credentials", { version: 1, phase: "staged" }],
      ["unknown-phase", { version: 1, phase: "future" }],
      ["null-credentials", { version: 1, phase: "claiming", sealedCredentials: null }],
      ["malformed-credentials", { version: 1, phase: "claiming", sealedCredentials: { version: 1, algorithm: "AES-GCM", context: "standalone-inbound" } }],
      ["array", []],
    ];
    for (const [index, [label, marker]] of rows.entries()) {
      const token = tokenFixture(String.fromCharCode(65 + index));
      const document = cookieDocument();
      check(Transfer.writeTransferCookie({ token, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" }), `${label} cookie seed failed`);
      const inbound = markerStore(marker);
      const before = JSON.stringify(inbound.peek());
      let sealCalled = false;
      let unsealCalled = false;
      const credentials = {
        async seal() { sealCalled = true; throw new Error("unexpected-seal"); },
        async unseal() { unsealCalled = true; throw new Error("unexpected-unseal"); },
        async forget() {},
      };
      const transport = transportSequence([response(200, { state: "unreachable", expiresAt: "2026-09-08T20:00:00.000Z" })]);
      const client = makeClient({ context: "standalone", transport, inbound, document, credentials });
      const result = await client.claim();
      check(result.state === FAULT_EXPECTATIONS.claimStateRace.malformedMarkerState && result.code === FAULT_EXPECTATIONS.claimStateRace.malformedMarkerCode, `${label} marker was not rejected with a closed failure`);
      check(JSON.stringify(inbound.peek()) === before && Transfer.readTransferCookie({ document })?.token === token, `${label} marker or cookie was mutated`);
      check(!sealCalled && !unsealCalled && transport.requests.length === 0, `${label} crossed credential or network boundaries`);
    }
  });

  await test("cookie bootstrap remains available only for truly absent markers", async () => {
    const source = makeSource();
    const built = await Transfer.buildEnvelope({ sections: source, source: sourceDescriptor(source), contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    for (const absent of [null, undefined]) {
      const token = tokenFixture(absent === null ? "Q" : "R");
      const document = cookieDocument();
      check(Transfer.writeTransferCookie({ token, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" }), "absent-marker cookie seed failed");
      const inbound = markerStore(absent);
      const transport = transportSequence([response(200, { envelope: built.value, expiresAt: "2026-09-08T20:00:00.000Z" })]);
      const client = makeClient({ context: "standalone", transport, inbound, document, vault });
      const result = await client.claim();
      check(result.ok && result.state === "validating" && transport.requests.length === 1, `${absent === null ? "null" : "undefined"} marker did not bootstrap from the cookie`);
      check(inbound.peek()?.phase === "claimed" && !document.cookie.includes("repforge_transfer_v1="), `${absent === null ? "null" : "undefined"} marker bootstrap did not complete normally`);
    }
  });

  await test("freezes create when cookie persistence cannot be confirmed", async () => {
    const token = tokenFixture("J");
    const outbound = markerStore();
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary", { silent: true });
    const transport = transportSequence([response(201, { token, expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, outbound, document, vault: Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() }) });
    const source = makeSource();
    const first = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    const marker = outbound.peek();
    check(first.state === FAULT_EXPECTATIONS.cookieBoundary.createUnconfirmedState && first.code === FAULT_EXPECTATIONS.cookieBoundary.createUnconfirmedCode, "unconfirmed cookie persistence did not freeze create");
    check(marker?.phase === "awaiting-claim" && validMarkerId(marker.idempotencyKey) && !Object.hasOwn(first, "token"), "cookie failure discarded or exposed the original transfer identity");
    const key = marker.idempotencyKey;
    const retrySource = makeSource();
    const second = await client.create({ sections: retrySource, source: sourceDescriptor(retrySource), consent: { enabled: true }, hasMeaningfulData: true });
    check(second.state === "unknown-outcome" && outbound.peek()?.idempotencyKey === key && transport.requests.length === 1, "cookie failure minted a new identity or retried before confirmation");
    check(document.cookie.includes("repforge_setup_v1=v1.setup-canary") && !document.cookie.includes("repforge_transfer_v1="), "cookie failure disturbed setup-cookie coexistence");
  });

  await test("requires millisecond UTC expiry on cookies and every protocol response", async () => {
    const invalidExpiry = "2026-09-08T20:00:00Z";
    const invalidCookie = cookieDocument();
    check(Transfer.writeTransferCookie({ token: tokenFixture("V"), expiresAt: invalidExpiry }, { document: invalidCookie, location: { href: "https://pedrochagasmaster.github.io/repforge/" }, now: "2026-09-08T19:00:00.000Z" }) === false, "cookie accepted a non-millisecond expiry");
    check(Transfer.readTransferCookie({ document: invalidCookie }) === null, "invalid cookie expiry remained readable");

    const createOutbound = markerStore();
    const createClient = makeClient({
      transport: transportSequence([response(201, { token: tokenFixture("V"), expiresAt: invalidExpiry })]),
      outbound: createOutbound,
      vault,
    });
    const createSource = makeSource();
    const createResult = await createClient.create({ sections: createSource, source: sourceDescriptor(createSource), consent: { enabled: true }, hasMeaningfulData: true });
    check(createResult.state === "unknown-outcome" && createResult.code === "create-unknown-outcome", "create accepted a non-millisecond expiry");
    check(createOutbound.peek()?.phase === "creating", "invalid create expiry changed the marker phase");

    const duplicateOutbound = markerStore();
    const duplicateClient = makeClient({
      transport: transportSequence([response(200, { duplicate: true, expiresAt: invalidExpiry })]),
      outbound: duplicateOutbound,
      vault,
    });
    const duplicateSource = makeSource();
    const duplicateResult = await duplicateClient.create({ sections: duplicateSource, source: sourceDescriptor(duplicateSource), consent: { enabled: true }, hasMeaningfulData: true });
    check(duplicateResult.state === "unknown-outcome" && duplicateResult.code === "create-unknown-outcome", "duplicate accepted a non-millisecond expiry");
    check(duplicateOutbound.peek()?.phase === "creating" && !Object.hasOwn(duplicateOutbound.peek(), "expiresAt"), "invalid duplicate expiry changed the indeterminate marker");

    const claimSource = makeSource();
    const claimEnvelope = await Transfer.buildEnvelope({ sections: claimSource, source: sourceDescriptor(claimSource), contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    const claimDocument = cookieDocument();
    Transfer.writeTransferCookie({ token: tokenFixture("W"), expiresAt: "2026-09-08T20:00:00.000Z" }, { document: claimDocument, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" });
    const claimInbound = markerStore();
    const claimClient = makeClient({
      transport: transportSequence([response(200, { envelope: claimEnvelope.value, expiresAt: invalidExpiry })]),
      inbound: claimInbound,
      document: claimDocument,
      context: "standalone",
      vault,
    });
    const claimResult = await claimClient.claim();
    check(claimResult.state === "unknown-outcome" && claimResult.code === "claim-unknown-outcome", "claim accepted a non-millisecond expiry");
    check(claimInbound.peek()?.phase === "claiming", "invalid claim expiry changed the marker phase");

    const commitToken = tokenFixture("X");
    const commitSealed = await vault.seal("standalone-inbound", { token: commitToken, claimId: "C".repeat(22) });
    const commitInbound = markerStore({ version: 1, phase: "local-committed", sealedCredentials: commitSealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const commitClient = makeClient({
      transport: transportSequence([response(200, { state: "deleted", expiresAt: invalidExpiry })]),
      inbound: commitInbound,
      context: "standalone",
      vault,
    });
    const commitResult = await commitClient.commit();
    check(commitResult.state === "unknown-outcome" && commitResult.code === "commit-unknown-outcome", "commit accepted a non-millisecond expiry");
    check(commitInbound.peek()?.phase === "local-committed", "invalid commit expiry changed the marker phase");

    const statusToken = tokenFixture("Y");
    const statusSealed = await vault.seal("browser-outbound", { token: statusToken });
    const statusOutbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: statusSealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const statusClient = makeClient({
      transport: transportSequence([response(200, { state: "deleted", expiresAt: invalidExpiry })]),
      outbound: statusOutbound,
      vault,
    });
    const statusResult = await statusClient.status();
    check(statusResult.state === "unknown-outcome" && statusResult.code === "invalid-response", "status accepted a non-millisecond expiry");
    check(statusOutbound.peek()?.phase === "awaiting-claim", "invalid status expiry changed the marker phase");
  });

  await test("fetch transport enforces body-only no-store/no-redirect requests", async () => {
    const calls = [];
    const body = new ReadableStream({ start(controller) {
      controller.enqueue(textEncoder.encode(JSON.stringify({ state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })));
      controller.close();
    } });
    const fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return { status: 200, body };
    };
    const transport = Transfer.createFetchTransport({ fetch, baseUrl: "https://transfer.example/" });
    const reply = await transport.request({ path: EXPECTATIONS.endpoints.status, body: { token: "F".repeat(43) } });
    check(reply.status === 200 && reply.bytes instanceof Uint8Array, "fetch transport did not return bounded response bytes");
    check(calls[0].url === "https://transfer.example/v1/transfers/status", "transport changed the exact endpoint URL");
    check(calls[0].options.cache === "no-store" && calls[0].options.redirect === "error", "transport allows caching or redirects");
    check(calls[0].options.headers["Cache-Control"] === "no-store" && calls[0].options.credentials === "omit", "transport headers/credentials drifted");
    check(!calls[0].url.includes("F".repeat(43)), "transport put token in the URL");
  });

  await test("bounds streamed responses before materializing their bytes", async () => {
    let cancelled = false;
    const oversized = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(FAULT_EXPECTATIONS.responseBounds.smallBytes + 1));
      },
      cancel() { cancelled = true; },
    });
    const transport = Transfer.createFetchTransport({
      fetch: async () => ({ status: 200, body: oversized }),
      baseUrl: "https://transfer.example/",
    });
    await assert.rejects(
      () => transport.request({ path: EXPECTATIONS.endpoints.status, body: { token: tokenFixture("F") } }),
      (error) => error?.code === FAULT_EXPECTATIONS.responseBounds.overflowCode,
    );
    check(cancelled, "oversized response stream was not cancelled at the byte boundary");
  });

  await test("claim retries the same sealed claim and validates the returned envelope", async () => {
    const source = makeSource();
    const built = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_claim", sourceRevision: 42 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    const token = tokenFixture("G");
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
    check(transport.requests[0].maxResponseBytes === FAULT_EXPECTATIONS.responseBounds.claimResponseBytes, "claim response used the small endpoint cap");
    check(inbound.peek()?.phase === "claimed", "claim marker did not advance after the bound response");
    check(!document.cookie.includes("repforge_transfer_v1="), "installed claim did not consume the transfer cookie");

    const claimedTransport = transportSequence([response(200, { envelope: built.value, expiresAt: "2026-09-08T20:30:00.000Z" })]);
    const claimedClient = makeClient({ transport: claimedTransport, inbound, document, context: "standalone", vault });
    const claimedRetry = await claimedClient.claim();
    check(claimedRetry.ok && claimedRetry.state === "validating", "retry from a claimed marker rejected a valid same-credential response");
    check(inbound.peek()?.phase === "claimed", "claimed retry downgraded or discarded the monotonic marker");
  });

  await test("a late paused claim cannot downgrade local commit, cleanup, or cleared state", async () => {
    const source = makeSource();
    const built = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_claim_state", sourceRevision: 42 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    for (const [phase, seed] of [["local-committed", "L"], ["cleanup-pending", "M"], ["cleared", "N"]]) {
      const token = tokenFixture(seed);
      const claimId = `${seed}`.repeat(22);
      const sharedVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
      const sealed = await sharedVault.seal("standalone-inbound", { token, claimId });
      const original = { version: 1, phase: "claiming", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" };
      const inbound = markerStore(original);
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      let requestStarted;
      const requestStartedPromise = new Promise((resolve) => { requestStarted = resolve; });
      const transport = {
        async request() {
          requestStarted();
          await gate;
          return response(200, { envelope: built.value, expiresAt: "2026-09-08T20:00:00.000Z" });
        },
      };
      const client = makeClient({ transport, inbound, context: "standalone", vault: sharedVault, operationLock: operationLock() });
      const claimPromise = client.claim();
      await requestStartedPromise;
      if (phase === "cleared") await inbound.clear();
      else await inbound.write({ ...original, phase, ...(phase === "cleanup-pending" ? { remoteState: "deleted" } : {}) });
      release();
      const result = await claimPromise;
      check(result.state === FAULT_EXPECTATIONS.claimStateRace.state && result.code === FAULT_EXPECTATIONS.claimStateRace.code, `${phase} state was overwritten by a late claim response`);
      check(phase === "cleared" ? inbound.peek() === null : inbound.peek()?.phase === phase, `${phase} marker did not remain authoritative`);
    }
  });

  await test("serializes concurrent creates around one marker and idempotency key", async () => {
    const lock = operationLock();
    const outbound = markerStore();
    const sharedVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    const requests = [];
    const transport = {
      requests,
      async request(request) {
        requests.push(clone(request));
        calls += 1;
        if (calls === 1) { await gate; throw new Error("create-response-lost"); }
        return response(200, { duplicate: true, expiresAt: "2026-09-08T20:00:00.000Z" });
      },
    };
    const sourceA = makeSource();
    const sourceB = makeSource();
    const first = makeClient({ transport, outbound, vault: sharedVault, operationLock: lock });
    const second = makeClient({ transport, outbound, vault: sharedVault, operationLock: lock });
    const firstPromise = first.create({ sections: sourceA, source: sourceDescriptor(sourceA), consent: { enabled: true }, hasMeaningfulData: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondPromise = second.create({ sections: sourceB, source: sourceDescriptor(sourceB), consent: { enabled: true }, hasMeaningfulData: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
    check(firstResult.state === "unknown-outcome" && secondResult.state === "unknown-outcome", "concurrent create did not freeze both uncertain outcomes");
    check(requests.length === 2 && requests[0].body.idempotencyKey === requests[1].body.idempotencyKey, "concurrent create minted competing idempotency keys");
    check(outbound.peek()?.phase === "creating" && lock.calls.filter((name) => name === FAULT_EXPECTATIONS.operationLock.createName).length === 2, "create arbitration did not retain one creating marker");
  });

  await test("serializes concurrent claims around one sealed claim identity", async () => {
    const source = makeSource();
    const built = await Transfer.buildEnvelope({ sections: source, source: { context: "browser", logicalInstallationId: "li_claim_race", sourceRevision: 42 }, contract: makeContract(), crypto: webcrypto, createdAt: "2026-09-08T19:00:00.000Z" });
    const lock = operationLock();
    const inbound = markerStore();
    const sharedVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    const document = cookieDocument();
    const token = tokenFixture("R");
    Transfer.writeTransferCookie({ token, expiresAt: "2026-09-08T20:00:00.000Z" }, { document, location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" }, now: "2026-09-08T19:00:00.000Z" });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    const requests = [];
    const transport = {
      requests,
      async request(request) {
        requests.push(clone(request));
        calls += 1;
        if (calls === 1) { await gate; throw new Error("claim-response-lost"); }
        return response(200, { envelope: built.value, expiresAt: "2026-09-08T20:00:00.000Z" });
      },
    };
    const first = makeClient({ transport, inbound, document, context: "standalone", vault: sharedVault, operationLock: lock });
    const second = makeClient({ transport, inbound, document, context: "standalone", vault: sharedVault, operationLock: lock });
    const firstPromise = first.claim();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const secondPromise = second.claim();
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
    check(firstResult.state === "unknown-outcome" && secondResult.ok && secondResult.state === "validating", "concurrent claim did not preserve retry semantics");
    check(requests.length === 2 && requests[0].body.claimId === requests[1].body.claimId, "concurrent claim minted competing claim IDs");
    check(inbound.peek()?.phase === "claimed" && !document.cookie.includes("repforge_transfer_v1="), "claim race left an unsafe marker or cookie");
  });

  await test("awaiting-claim create restores a missing cookie from sealed credentials", async () => {
    const token = tokenFixture("W");
    const sealed = await vault.seal("browser-outbound", { token });
    const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const document = cookieDocument();
    const transport = transportSequence([]);
    const source = makeSource();
    const client = makeClient({ transport, outbound, document, vault });
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(result.ok && result.state === "ready", "awaiting-claim retry did not resume ready state");
    check(Transfer.readTransferCookie({ document })?.token === token, "awaiting-claim retry did not restore the transfer cookie");
    check(transport.requests.length === 0, "awaiting-claim retry posted a second create");
  });

  await test("rejects extra response fields and preserves closed failure shapes", async () => {
    const transport = transportSequence([response(201, { token: tokenFixture("H"), expiresAt: "2026-09-08T20:00:00.000Z", clone: "forbidden" })]);
    const client = makeClient({ transport, vault });
    const source = makeSource();
    const result = await client.create({ sections: source, source: sourceDescriptor(source), consent: { enabled: true }, hasMeaningfulData: true });
    check(!result.ok && result.state === "unknown-outcome" && result.code === "create-unknown-outcome", "extra response field was accepted");
    check(!Object.hasOwn(result, "token") && !Object.hasOwn(result, "body") && !Object.hasOwn(result, "message"), "failure result carried user values");
  });

  await test("commit clears only sealed inbound credentials after verified deletion", async () => {
    const token = tokenFixture("I");
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
    const token = tokenFixture("K");
    const sealed = await vault.seal("browser-outbound", { token });
    const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, outbound, vault });
    const result = await client.status();
    check(result.ok && result.state === "confirmed" && result.remoteState === "deleted", "deleted status did not confirm recovery");
    check(client.recoveryState() === "confirmed", "deleted status did not confirm the browser recovery state");
    check(exactKeys(result, ["ok", "state", "remoteState", "expiresAt"]), "status result disclosed an unapproved field");
    check(outbound.peek()?.phase === FAULT_EXPECTATIONS.cleanup.deletedMarkerPhase && !outbound.peek()?.sealedCredentials && outbound.peek()?.recoverySnapshot?.tokenDigest && outbound.peek()?.recoverySnapshot?.confirmedAt, "deleted cleanup retained a bearer or omitted its recovery snapshot");
    const unavailableSealed = await vault.seal("browser-outbound", { token });
    const unavailableTransport = transportSequence([response(404, { state: "unavailable" })]);
    const unavailable = makeClient({ transport: unavailableTransport, outbound: markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: unavailableSealed, expiresAt: "2026-09-08T20:00:00.000Z" }), vault }).status();
    const uncertain = await unavailable;
    check(!uncertain.ok && uncertain.state === "unknown-outcome" && uncertain.code === "status-unavailable", "unavailable status silently resumed");
  });

  await test("available and claiming status stay known pending without a divergence warning", async () => {
    for (const remoteState of FAULT_EXPECTATIONS.remoteStatus.knownPendingStates) {
      const token = tokenFixture(remoteState === "available" ? "A" : "B");
      const sealed = await vault.seal("browser-outbound", { token });
      const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
      const client = makeClient({
        transport: transportSequence([response(200, { state: remoteState, expiresAt: "2026-09-08T20:00:00.000Z" })]),
        outbound,
        vault,
      });
      const result = await client.status();
      check(!result.ok && result.state === FAULT_EXPECTATIONS.remoteStatus.pendingState && result.code === FAULT_EXPECTATIONS.remoteStatus.pendingCode, `${remoteState} status was treated as an indeterminate failure`);
      check(result.remoteState === remoteState && result.expiresAt === "2026-09-08T20:00:00.000Z", `${remoteState} status lost its approved pending metadata`);
      check(client.recoveryState() === FAULT_EXPECTATIONS.remoteStatus.pendingRecoveryState, `${remoteState} status entered the divergence warning state`);
      check(outbound.peek()?.phase === "awaiting-claim" && outbound.peek()?.sealedCredentials, `${remoteState} status mutated recoverable credentials`);
    }
  });

  await test("unavailable and terminal remote states stay frozen indeterminate", async () => {
    for (const remoteState of FAULT_EXPECTATIONS.remoteStatus.indeterminateStates) {
      const token = tokenFixture(remoteState === "unavailable" ? "U" : remoteState === "exhausted" ? "E" : remoteState === "purged" ? "P" : "K");
      const sealed = await vault.seal("browser-outbound", { token });
      const initial = { version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" };
      const outbound = markerStore(initial);
      const client = makeClient({
        transport: transportSequence([response(200, { state: remoteState, expiresAt: "2026-09-08T20:00:00.000Z" })]),
        outbound,
        vault,
      });
      const result = await client.status();
      check(!result.ok && result.state === "unknown-outcome", `${remoteState} status did not freeze the recovery outcome`);
      check(outbound.peek()?.phase === initial.phase && outbound.peek()?.sealedCredentials?.keyId === sealed.keyId, `${remoteState} status mutated the recoverable marker`);
    }
  });

  await test("credential deletion failure keeps a recoverable cleanup marker", async () => {
    const token = tokenFixture("X");
    const sealed = await vault.seal("browser-outbound", { token });
    const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    let deleteFailures = 1;
    const flakyCredentials = {
      seal: (...args) => vault.seal(...args),
      unseal: (...args) => vault.unseal(...args),
      async forget(...args) {
        if (deleteFailures > 0) { deleteFailures -= 1; throw new Error("credential-delete-fault"); }
        return vault.forget(...args);
      },
    };
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, outbound, credentials: flakyCredentials, vault: flakyCredentials });
    const first = await client.status();
    check(first.state === FAULT_EXPECTATIONS.cleanup.credentialDeleteFailureState && first.code === FAULT_EXPECTATIONS.cleanup.credentialDeleteFailureCode, "credential deletion failure reported cleanup complete");
    check(outbound.peek()?.phase === "cleanup-pending" && outbound.peek()?.sealedCredentials, "credential deletion failure lost the retry marker");
    const second = await client.status();
    check(second.ok && second.state === "confirmed" && !outbound.peek()?.sealedCredentials, "cleanup retry did not finish without a bearer marker");
    check(transport.requests.length === 1, "cleanup retry made a second remote status request");
  });

  await test("commit credential deletion failure does not report complete", async () => {
    const token = tokenFixture("Y");
    const claimId = "Z".repeat(22);
    const sealed = await vault.seal("standalone-inbound", { token, claimId });
    const inbound = markerStore({ version: 1, phase: "local-committed", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });
    let failures = 1;
    const flakyCredentials = {
      seal: (...args) => vault.seal(...args),
      unseal: (...args) => vault.unseal(...args),
      async forget(...args) { if (failures-- > 0) throw new Error("credential-delete-fault"); return vault.forget(...args); },
    };
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })]);
    const client = makeClient({ transport, inbound, context: "standalone", credentials: flakyCredentials, vault: flakyCredentials });
    const first = await client.commit();
    check(first.state === "unknown-outcome" && inbound.peek()?.phase === "cleanup-pending", "commit deletion failure cleared its retry marker");
    const second = await client.commit();
    check(second.ok && second.state === "complete" && inbound.peek() === null, "commit cleanup retry did not complete safely");
    check(transport.requests.length === 1, "commit cleanup retry repeated remote deletion");
  });

  await test("lost browser outbound credentials stay indeterminate", async () => {
    const lostStore = memoryKeyStore();
    const lostVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: lostStore });
    const sealed = await lostVault.seal("browser-outbound", { token: tokenFixture("L") });
    await lostVault.forget("browser-outbound", sealed);
    const client = makeClient({ outbound: markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed }), vault: lostVault, transport: transportSequence([]) });
    const result = await client.status();
    check(!result.ok && result.state === "unknown-outcome" && result.code === "credential-unavailable", "lost outbound credential silently resumed");
  });

  console.log(`install-transfer client tests: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

await main();
