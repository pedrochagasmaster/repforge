#!/usr/bin/env node
/**
 * Plan 053 P3 client/contract parity proof.
 *
 * This suite injects the reviewed shared contract into the actual client. The
 * durable fixture and producer modules are the only source of clone data; the
 * transport supplies approved response bytes so the service remains an
 * explicitly pending boundary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Transfer = require(join(ROOT, "install-transfer.js"));
const Contract = require(join(ROOT, "install-transfer-contract.js"));
const WorkoutDraft = require(join(ROOT, "workout-draft.js"));
const ProgramEntry = require(join(ROOT, "program-entry.js"));
const canonicalFixture = JSON.parse(readFileSync(join(ROOT, "test/fixtures/install-transfer-clone-v1.json"), "utf8"));
const textEncoder = new TextEncoder();
const LOCATION = { href: "https://pedrochagasmaster.github.io/repforge/index.html" };
const NOW = "2026-10-01T10:00:00.000Z";
const EXPIRES = "2026-10-01T11:00:00.000Z";

const results = { passed: 0, failed: 0 };

function clone(value) {
  return value == null ? value : structuredClone(value);
}

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

function tokenFixture(seed = 65) {
  const segment = (offset) => Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => (seed + offset + index) % 256))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `v1.k1.${segment(0)}.${segment(1)}.${segment(2)}`;
}

function response(status, body) {
  return { status, bytes: textEncoder.encode(JSON.stringify(body)) };
}

function transportSequence(sequence) {
  const requests = [];
  return {
    requests,
    async request(request) {
      requests.push({ ...request, body: clone(request.body) });
      const next = sequence.shift();
      if (next instanceof Error) throw next;
      if (typeof next === "function") return next(request);
      if (!next) throw new Error("transport sequence exhausted");
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

function memoryKeyStore() {
  const records = new Map();
  return {
    records,
    async get(context, keyId) { return records.get(`${context}:${keyId}`) || null; },
    async put(context, keyId, key) { records.set(`${context}:${keyId}`, key); },
    async delete(context, keyId) { records.delete(`${context}:${keyId}`); },
  };
}

function cookieDocument(initial = "") {
  const jar = new Map();
  for (const part of initial.split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) jar.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  const writes = [];
  return {
    writes,
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
    },
    set cookie(value) {
      const serialized = String(value);
      writes.push(serialized);
      const [pair, ...attributes] = serialized.split(";");
      const separator = pair.indexOf("=");
      if (separator < 1) return;
      const name = pair.slice(0, separator).trim();
      const rawValue = pair.slice(separator + 1).trim();
      const maxAge = attributes.find((entry) => /^\s*Max-Age=/i.test(entry))?.split("=")[1]?.trim();
      if (maxAge === "0" || rawValue === "") jar.delete(name);
      else jar.set(name, rawValue);
    },
    textContent: "",
  };
}

function operationLock() {
  const calls = [];
  let tail = Promise.resolve();
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

function producerWorkoutDraft() {
  const timestamp = "2026-09-08T18:00:00.000Z";
  const programContext = {
    programId: "program-1",
    programFingerprint: "program-fingerprint-1",
    durableRevision: 7,
    dayId: "day-1",
    dayLabel: "Day 1",
    scheduleDate: "2026-09-08",
    unit: "kg",
    rirMode: "numeric",
    exercises: [{
      exerciseInstanceId: "exercise-1",
      sourceExerciseId: "library:leg_press",
      sets: 1,
      setIds: ["set-1"],
      programmedSets: [{ suggestedLoad: 100, minReps: 8, maxReps: 12, targetRir: 2 }],
      minReps: 8,
      maxReps: 12,
      targetRir: 2,
      notes: "",
      progressionStrategy: null,
      movementPattern: null,
      sourceFingerprint: "source-fingerprint-1",
      primary: "Quads",
      secondary: "Glutes",
      displayName: "Leg press",
      libraryId: "sq_lp",
      setupNotes: "",
    }],
  };
  const sessionSelection = {
    draftId: "draft-1",
    startedAt: timestamp,
    updatedAt: timestamp,
    bodyweight: null,
    notes: "",
    selectedExerciseId: "exercise-1",
    scheduleDate: "2026-09-08",
    contextTouched: { day: false, date: false, sessionNotes: false, bodyweight: false },
    writer: { installationId: "installation-1", tabId: "tab-1", operationId: "operation-1" },
  };
  return WorkoutDraft.create(programContext, sessionSelection);
}

function producerProgramEntryDraft() {
  const timestamp = "2026-09-08T18:00:00.000Z";
  const versions = {
    compiler: "compiler-1",
    family: "family-1",
    blueprint: "blueprint-1",
    catalogue: "catalogue-1",
    rules: "rules-1",
    context: "context-1",
    progression: "progression-1",
    recentConsistency: "consistency-1",
    simpleStart: "simple-start-1",
  };
  const initial = ProgramEntry.createState({ draftId: "entry-1", now: timestamp, versions });
  const routed = ProgramEntry.selectRoute(initial, "build");
  const withResult = ProgramEntry.setResult(routed, {
    fingerprint: "candidate-fingerprint",
    preview: {},
    selected: { id: "candidate-1" },
  });
  const normalized = ProgramEntry.normalizeSetupDraft(withResult);
  check(normalized.ok, "real ProgramEntry producer did not normalize");
  return normalized.value;
}

function makeSections({ analyticsEnabled = true } = {}) {
  const current = producerWorkoutDraft();
  const expectedWorkoutDraft = WorkoutDraft.logicalCloneSection(current);
  const raw = JSON.stringify(current);
  const expectedProgramEntryDraft = producerProgramEntryDraft();
  let flushCount = 0;
  const workoutDraft = {
    async flush() { flushCount += 1; },
    current: () => current,
    checkpoint: () => ({
      status: "valid",
      value: { version: 1, kind: "committed", draftId: current.draftId, revision: current.revision, raw },
    }),
    read: () => ({ status: "ok", raw }),
    logicalCloneSection: (value) => WorkoutDraft.logicalCloneSection(value),
  };
  return {
    sections: {
      durableState: { logicalCloneSection: () => clone(canonicalFixture.durableState) },
      workoutDraft,
      programEntryDraft: { logicalCloneSection: () => clone(expectedProgramEntryDraft) },
      uiPreferences: { logicalCloneSection: () => ({
        theme: "dark",
        importSourceMode: "freeform",
        installBannerDismissedAt: "2026-10-01T09:00:00.000Z",
      }) },
      analytics: { logicalCloneSection: () => ({ enabled: analyticsEnabled }) },
      telemetryIdentity: { logicalCloneSection: () => clone(canonicalFixture.telemetryIdentity) },
    },
    expectedWorkoutDraft,
    expectedProgramEntryDraft,
    flushCount: () => flushCount,
  };
}

function makeClient({ context, transport, outbound, inbound, credentials, document, lock, now = NOW }) {
  return Transfer.createClient({
    contract: Contract,
    crypto: webcrypto,
    transport,
    context,
    now: () => now,
    document,
    location: LOCATION,
    storage: { outbound, inbound, credentials, operationLock: lock },
  });
}

function assertRequest(request, endpoint, maxResponseBytes) {
  assert.equal(request.method, "POST", `${endpoint} uses POST`);
  assert.equal(request.path, endpoint, `${endpoint} path is exact`);
  assert.equal(request.endpoint, endpoint, `${endpoint} endpoint is exact`);
  assert.deepEqual(Object.keys(request.headers), ["Cache-Control"], `${endpoint} header shape is exact`);
  assert.equal(request.headers["Cache-Control"], "no-store", `${endpoint} disables caching`);
  assert.equal(request.maxResponseBytes, maxResponseBytes, `${endpoint} response bound is exact`);
  const validated = Contract.validateRequest(request.body, endpoint);
  assert.equal(validated.ok, true, `${endpoint} request passes the shared contract`);
}

function assertFailureShape(result, code, label) {
  assert.equal(result.ok, false, `${label} fails`);
  assert.equal(result.code, code, `${label} code`);
  assert.deepEqual(Object.keys(result).sort(), ["code", "ok"], `${label} does not expose payload data`);
}

async function browserContractForParity() {
  const browserContext = vm.createContext({ TextEncoder, TextDecoder, crypto: webcrypto });
  vm.runInContext(readFileSync(join(ROOT, "install-transfer-contract.js"), "utf8"), browserContext, {
    filename: "install-transfer-contract.js",
  });
  return browserContext.RepForgeInstallTransferContract;
}

async function main() {
  console.log("Plan 053 P3 install-transfer client/shared-contract parity");

  await test("canonical fixture and accepted shared contract agree across Node and browser consumers", async () => {
    const nodeResult = await Contract.validateEnvelopeIntegrity(canonicalFixture, webcrypto);
    assert.equal(nodeResult.ok, true, "canonical fixture integrity is valid");
    const browserContract = await browserContractForParity();
    const browserValue = JSON.parse(JSON.stringify(canonicalFixture));
    const browserResult = await browserContract.validateEnvelopeIntegrity(browserValue, webcrypto);
    assert.equal(JSON.stringify(browserResult), JSON.stringify(nodeResult), "Node and browser contract results agree");
    const tampered = clone(canonicalFixture);
    tampered.durableState.log[0].reps += 1;
    const invalid = await Contract.validateEnvelopeIntegrity(tampered, webcrypto);
    assertFailureShape(invalid, Contract.ERROR_CODES.INTEGRITY_MISMATCH, "tampered canonical fixture");
  });

  let builtEnvelope;
  await test("builds the wire envelope from real WorkoutDraft and ProgramEntry producers", async () => {
    const source = makeSections();
    const built = await Transfer.buildEnvelope({
      sections: source.sections,
      source: { context: "browser", logicalInstallationId: canonicalFixture.source.logicalInstallationId, sourceRevision: 42 },
      contract: Contract,
      crypto: webcrypto,
      createdAt: canonicalFixture.createdAt,
    });
    assert.equal(built.ok, true, "actual producer envelope builds");
    builtEnvelope = built.value;
    assert.deepEqual(built.value.durableState, canonicalFixture.durableState, "canonical durable fields survive unchanged");
    assert.deepEqual(built.value.workoutDraft, source.expectedWorkoutDraft, "DraftV2 logical state is producer output");
    assert.deepEqual(built.value.programEntryDraft, source.expectedProgramEntryDraft, "entry candidate is producer output");
    assert.equal(built.value.programEntryDraft.activeProgramRevisionAtStart, 0, "candidate precondition survives");
    assert.equal(Object.hasOwn(built.value.workoutDraft, "writer"), false, "DraftV2 writer is excluded");
    assert.equal(Object.hasOwn(built.value.workoutDraft, "revision"), false, "DraftV2 revision is excluded");
    assert.equal(Object.hasOwn(built.value.workoutDraft.program, "durableRevision"), false, "DraftV2 durable revision is excluded");
    assert.equal(Object.hasOwn(built.value.programEntryDraft, "ownerId"), false, "entry owner wrapper is excluded");
    assert.equal(Object.hasOwn(built.value.programEntryDraft, "revision"), false, "entry revision wrapper is excluded");
    assert.equal(Object.hasOwn(built.value, "logicalStateDigest"), false, "source-local digest is not serialized");
    assert.equal(source.flushCount(), 1, "draft flush barrier runs once");
    assert.equal((await Contract.validateEnvelopeIntegrity(built.value, webcrypto)).ok, true, "shared integrity validation accepts the built envelope");
  });

  await test("browser create uses exact shared request validation and seals the approved response", async () => {
    const source = makeSections({ analyticsEnabled: false });
    const token = tokenFixture(70);
    const transport = transportSequence([response(201, { token, expiresAt: EXPIRES })]);
    const outbound = markerStore();
    const document = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const keyStore = memoryKeyStore();
    const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
    const lock = operationLock();
    const client = makeClient({ context: "browser", transport, outbound, inbound: markerStore(), credentials: vault, document, lock });
    const result = await client.create({
      sections: source.sections,
      source: { context: "browser", logicalInstallationId: canonicalFixture.source.logicalInstallationId, sourceRevision: 42 },
      consent: { enabled: true },
      hasMeaningfulData: true,
    });
    assert.equal(result.ok, true, "approved create succeeds");
    assert.equal(result.state, "ready", "approved create reaches ready");
    assert.equal(Object.hasOwn(result, "token"), false, "create result does not expose bearer");
    assert.equal(transport.requests.length, 1, "create sends one request");
    const request = transport.requests[0];
    assertRequest(request, Contract.ENDPOINTS.create, Transfer.RESPONSE_LIMITS[Transfer.ENDPOINTS.create]);
    assert.deepEqual(Object.keys(request.body).sort(), ["envelope", "idempotencyKey"], "create body shape is exact");
    assert.equal(request.body.envelope.analytics.enabled, false, "analytics state stays false under explicit transfer consent");
    assert.equal((await Contract.validateEnvelopeIntegrity(request.body.envelope, webcrypto)).ok, true, "uploaded envelope has valid shared integrity");
    assert.deepEqual(request.body.envelope.workoutDraft, source.expectedWorkoutDraft, "create uploads the actual DraftV2 clone");
    assert.deepEqual(request.body.envelope.programEntryDraft, source.expectedProgramEntryDraft, "create uploads the actual entry candidate");
    assert.equal(outbound.peek()?.phase, "awaiting-claim", "create marker records awaiting claim");
    assert.equal(JSON.stringify(outbound.peek()).includes(token), false, "create marker omits plaintext bearer");
    assert.equal(document.cookie.includes("repforge_setup_v1=v1.setup-canary"), true, "setup cookie coexists");
    assert.equal(document.cookie.includes(token), false, "transfer cookie does not expose plaintext bearer");
    assert.deepEqual(lock.calls, [Transfer.OPERATION_NAMES.create], "create uses the shared transfer lock");
  });

  await test("standalone claim validates the full response with the shared envelope parser", async () => {
    const token = tokenFixture(80);
    const document = cookieDocument();
    assert.equal(Transfer.writeTransferCookie({ token, expiresAt: EXPIRES }, { document, location: LOCATION, now: NOW }), true, "approved cookie is written");
    const transport = transportSequence([response(200, { envelope: builtEnvelope, expiresAt: EXPIRES })]);
    const claimInbound = markerStore();
    const keyStore = memoryKeyStore();
    const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
    const lock = operationLock();
    const claimClient = makeClient({ context: "standalone", transport, outbound: markerStore(), inbound: claimInbound, credentials: vault, document, lock });
    const result = await claimClient.claim();
    assert.equal(result.ok, true, "approved claim succeeds");
    assert.equal(result.state, "validating", "claim reaches validating");
    assert.deepEqual(result.envelope, builtEnvelope, "claim returns the shared validated envelope");
    assert.equal(transport.requests.length, 1, "claim sends one request");
    const request = transport.requests[0];
    assertRequest(request, Contract.ENDPOINTS.claims, Transfer.RESPONSE_LIMITS[Transfer.ENDPOINTS.claim]);
    assert.deepEqual(Object.keys(request.body).sort(), ["claimId", "token"], "claim body shape is exact");
    assert.equal(Contract.validateClaimId(request.body.claimId).ok, true, "claim ID is in the shared range");
    const parsed = Contract.parseBoundedJson(response(200, { envelope: builtEnvelope, expiresAt: EXPIRES }).bytes, Contract.ENDPOINTS.envelope);
    assert.equal(parsed.ok, true, "approved claim bytes pass the shared envelope parser");
    assert.equal((await Contract.validateEnvelopeIntegrity(parsed.value.envelope, webcrypto)).ok, true, "approved claim envelope passes shared integrity");
    assert.equal(document.cookie.includes(Transfer.COOKIE_NAME), false, "claim clears the transfer cookie");
    assert.equal(claimInbound.peek()?.phase, "claimed", "claim marker records claimed");
    assert.equal(JSON.stringify(claimInbound.peek()).includes(token), false, "claim marker omits plaintext bearer");
    assert.deepEqual(lock.calls, [Transfer.OPERATION_NAMES.claim], "claim uses the shared transfer lock");
  });

  await test("standalone commit uses its own exact transport boundary", async () => {
    const token = tokenFixture(90);
    const claimId = "C".repeat(22);
    const keyStore = memoryKeyStore();
    const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
    const sealed = await vault.seal("standalone-inbound", { token, claimId });
    const inbound = markerStore({ version: 1, phase: "local-committed", sealedCredentials: sealed, expiresAt: EXPIRES });
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: EXPIRES })]);
    const lock = operationLock();
    const client = makeClient({ context: "standalone", transport, outbound: markerStore(), inbound, credentials: vault, document: cookieDocument(), lock });
    const result = await client.commit();
    assert.equal(result.ok, true, "commit succeeds with approved response");
    assert.equal(result.state, "complete", "commit reaches complete");
    assert.equal(transport.requests.length, 1, "commit sends one request");
    const request = transport.requests[0];
    assertRequest(request, Contract.ENDPOINTS.commit, Transfer.RESPONSE_LIMITS[Transfer.ENDPOINTS.commit]);
    assert.deepEqual(Object.keys(request.body).sort(), ["claimId", "token"], "commit body shape is exact");
    assert.equal(inbound.peek(), null, "commit clears the inbound marker after credential deletion");
    assert.equal(keyStore.records.size, 0, "commit forgets the nonextractable credential key");
    assert.deepEqual(lock.calls, [Transfer.OPERATION_NAMES.commit], "commit uses the shared transfer lock");
  });

  await test("browser status preserves a digest-only recovery snapshot after remote deletion", async () => {
    const token = tokenFixture(100);
    const keyStore = memoryKeyStore();
    const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
    const sealed = await vault.seal("browser-outbound", { token });
    const outbound = markerStore({
      version: 1,
      phase: "awaiting-claim",
      sealedCredentials: sealed,
      sourceRevision: 42,
      expiresAt: EXPIRES,
    });
    const document = cookieDocument();
    assert.equal(Transfer.writeTransferCookie({ token, expiresAt: EXPIRES }, { document, location: LOCATION, now: NOW }), true, "status setup cookie is written");
    const transport = transportSequence([response(200, { state: "deleted", expiresAt: EXPIRES })]);
    const lock = operationLock();
    const client = makeClient({ context: "browser", transport, outbound, inbound: markerStore(), credentials: vault, document, lock });
    const result = await client.status();
    assert.equal(result.ok, true, "deleted status succeeds");
    assert.equal(result.state, "confirmed", "deleted status reaches confirmed");
    assert.equal(transport.requests.length, 1, "status sends one request");
    const request = transport.requests[0];
    assertRequest(request, Contract.ENDPOINTS.status, Transfer.RESPONSE_LIMITS[Transfer.ENDPOINTS.status]);
    assert.deepEqual(Object.keys(request.body), ["token"], "status body shape is exact");
    const marker = outbound.peek();
    assert.equal(marker?.phase, "confirmed", "status leaves confirmed marker");
    assert.equal(Object.hasOwn(marker, "sealedCredentials"), false, "confirmed marker forgets sealed credentials");
    assert.equal(Object.hasOwn(marker?.recoverySnapshot || {}, "tokenDigest"), true, "recovery retains a token digest");
    assert.equal(JSON.stringify(marker).includes(token), false, "recovery marker omits plaintext bearer");
    assert.equal(document.cookie.includes(Transfer.COOKIE_NAME), false, "status clears the transfer cookie");
    assert.equal(keyStore.records.size, 0, "status forgets the credential key");
    assert.deepEqual(lock.calls, [Transfer.OPERATION_NAMES.status], "status uses the shared transfer lock");
  });

  await test("possibly successful malformed create freezes the same idempotency marker", async () => {
    const source = makeSections();
    const token = tokenFixture(110);
    const outbound = markerStore();
    const transport = transportSequence([response(201, { token, expiresAt: EXPIRES, extra: true })]);
    const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() });
    const client = makeClient({ context: "browser", transport, outbound, inbound: markerStore(), credentials: vault, document: cookieDocument(), lock: operationLock() });
    const result = await client.create({
      sections: source.sections,
      source: { context: "browser", logicalInstallationId: canonicalFixture.source.logicalInstallationId, sourceRevision: 42 },
      consent: { enabled: true },
      hasMeaningfulData: true,
    });
    assert.equal(result.ok, false, "malformed create response fails");
    assert.equal(result.code, "create-unknown-outcome", "malformed create response code");
    assert.deepEqual(Object.keys(result).sort(), ["code", "ok", "state"], "malformed create response does not expose payload data");
    assert.equal(result.state, "unknown-outcome", "malformed create response freezes outcome");
    assert.equal(outbound.peek()?.phase, "creating", "malformed create retains creating marker");
    assert.equal(typeof outbound.peek()?.idempotencyKey, "string", "malformed create retains idempotency identity");
    assert.equal(JSON.stringify(outbound.peek()).includes(token), false, "malformed create marker omits plaintext bearer");
  });

  await test("shared parser and client limits use the approved exact boundaries", async () => {
    const smallOver = Contract.parseBoundedJson(
      new Uint8Array(Contract.LIMITS.requestBodySmallEndpointBytes + 1),
      Contract.ENDPOINTS.status,
    );
    assertFailureShape(smallOver, Contract.ERROR_CODES.BODY_TOO_LARGE, "small endpoint over-limit bytes");
    const envelopeOver = Contract.parseBoundedJson(
      new Uint8Array(Contract.LIMITS.envelopeBytes + 1),
      Contract.ENDPOINTS.envelope,
    );
    assertFailureShape(envelopeOver, Contract.ERROR_CODES.ENVELOPE_TOO_LARGE, "envelope over-limit bytes");
    const approvedBytes = textEncoder.encode(JSON.stringify({ envelope: builtEnvelope, expiresAt: EXPIRES }));
    assert.equal(Contract.measureUtf8Bytes(approvedBytes) <= Contract.LIMITS.envelopeBytes, true, "approved claim response is within envelope bound");
    assert.equal(Transfer.RESPONSE_LIMITS[Transfer.ENDPOINTS.claim], Contract.LIMITS.envelopeBytes + Contract.LIMITS.requestBodySmallEndpointBytes, "claim response leaves only approved wrapper headroom");
    const request = Contract.validateRequest({ envelope: builtEnvelope, idempotencyKey: "idempotency-key" }, Contract.ENDPOINTS.create);
    assert.equal(request.ok, true, "canonical fixture-sized create request passes the shared request limit");
  });

  console.log(`  ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

await main();
