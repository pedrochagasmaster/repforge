import { createHash, webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import contract from "../../../install-transfer-contract.js";
import canonicalFixture from "../../../test/fixtures/install-transfer-clone-v1.json" with { type: "json" };
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";

const require = createRequire(import.meta.url);
const Transfer = require("../../../install-transfer.js");
const WorkoutDraft = require("../../../workout-draft.js");
const ProgramEntry = require("../../../program-entry.js");
const origin = "https://taurifer.example";
const location = { href: "https://pedrochagasmaster.github.io/repforge/index.html" };
const now = "2026-09-08T19:00:00.000Z";

// These are the independent fault oracles for this boundary. The client is
// allowed to expose only the closed result codes below; service responses and
// clone data stay inside the test's assertions and are never logged.
const EXPECTED_FAULTS = Object.freeze({
  lostCreate: Object.freeze({ code: "create-unknown-outcome", state: "unknown-outcome", markerPhase: "creating" }),
  duplicateCreate: Object.freeze({ code: "create-duplicate-no-token", state: "unknown-outcome", responseStatus: 200, tokenAllowed: false }),
  sameClaim: Object.freeze({ responseStatus: 200, state: "validating" }),
  competingClaim: Object.freeze({ responseStatus: 404, code: "service-unavailable", state: "terminalUnavailable" }),
  commit: Object.freeze({ responseStatus: 200, state: "complete", remoteState: "deleted" }),
  status: Object.freeze({ remoteState: "available", state: "retryable", code: "transfer-pending" }),
});

function clone(value) {
  return value == null ? value : structuredClone(value);
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

function cookieDocument(initial = "") {
  const jar = new Map();
  for (const part of String(initial).split(";")) {
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
      const maxAge = attributes.find((entry) => /^\s*Max-Age=/iu.test(entry))?.split("=")[1]?.trim();
      if (maxAge === "0" || rawValue === "") jar.delete(name);
      else jar.set(name, rawValue);
    },
    textContent: "",
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
  return WorkoutDraft.create(programContext, {
    draftId: "draft-http-1",
    startedAt: timestamp,
    updatedAt: timestamp,
    bodyweight: null,
    notes: "",
    selectedExerciseId: "exercise-1",
    scheduleDate: "2026-09-08",
    contextTouched: { day: false, date: false, sessionNotes: false, bodyweight: false },
    writer: { installationId: "installation-1", tabId: "tab-1", operationId: "operation-1" },
  });
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
  const initial = ProgramEntry.createState({ draftId: "entry-http-1", now: timestamp, versions });
  const routed = ProgramEntry.selectRoute(initial, "build");
  const withResult = ProgramEntry.setResult(routed, {
    fingerprint: "candidate-fingerprint",
    preview: {},
    selected: { id: "candidate-1" },
  });
  const normalized = ProgramEntry.normalizeSetupDraft(withResult);
  if (!normalized.ok) throw new Error("real program-entry producer did not normalize");
  return normalized.value;
}

function makeProducers() {
  const currentDraft = producerWorkoutDraft();
  const expectedSections = {
    durableState: clone(canonicalFixture.durableState),
    workoutDraft: WorkoutDraft.logicalCloneSection(currentDraft),
    programEntryDraft: producerProgramEntryDraft(),
    uiPreferences: {
      theme: "dark",
      importSourceMode: "freeform",
      repforge_freeform_session_v1: { source: "never-export", reply: "never-export" },
      repforge_import_source_v1: "freeform",
    },
    analytics: { enabled: false },
    telemetryIdentity: clone(canonicalFixture.telemetryIdentity),
  };
  const flushes = { count: 0 };
  const raw = JSON.stringify(currentDraft);
  const sections = {
    durableState: { logicalCloneSection: () => clone(expectedSections.durableState) },
    workoutDraft: {
      async flush() { flushes.count += 1; },
      current: () => currentDraft,
      checkpoint: () => ({ status: "valid", value: { version: 1, kind: "committed", draftId: currentDraft.draftId, revision: currentDraft.revision, raw } }),
      read: () => ({ status: "ok", raw }),
      logicalCloneSection: (value) => WorkoutDraft.logicalCloneSection(value),
    },
    programEntryDraft: { logicalCloneSection: () => clone(expectedSections.programEntryDraft) },
    uiPreferences: { logicalCloneSection: () => clone(expectedSections.uiPreferences) },
    analytics: { logicalCloneSection: () => clone(expectedSections.analytics) },
    telemetryIdentity: { logicalCloneSection: () => clone(expectedSections.telemetryIdentity) },
  };
  const transferableSections = { ...expectedSections, uiPreferences: { theme: "dark", importSourceMode: "freeform" } };
  return { sections, expectedSections: transferableSections, flushes };
}

function expectedCloneHash(sections) {
  const ordered = {
    durableState: sections.durableState,
    workoutDraft: sections.workoutDraft,
    programEntryDraft: sections.programEntryDraft,
    uiPreferences: sections.uiPreferences,
    analytics: sections.analytics,
    telemetryIdentity: sections.telemetryIdentity,
  };
  return createHash("sha256").update(contract.canonicalJson(ordered)).digest("hex");
}

function sectionHash(value) {
  return createHash("sha256").update(contract.canonicalJson(value)).digest("hex");
}

async function refreshHealth() {
  const observedAt = Date.now();
  const health = euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
  await health.markDeletionUnhealthy({ now: observedAt });
  for (const kind of ["alarm", "watchdog", "log", "key"]) {
    await health.recordHeartbeat({ kind, observedAt, now: observedAt });
  }
  await health.recordDeletionHealth({ healthy: true, observedAt, now: observedAt });
  await health.recordBilling({ monthlyCostCents: 1, observedAt, now: observedAt });
  const snapshot = await health.snapshot({ now: observedAt });
  await health.acknowledgeDeletion({ generation: snapshot.incidentGeneration, proofNonce: "B".repeat(32), now: observedAt });
}

function serviceFetch({ calls, ip = "198.51.100.77", dropNextCreate = false } = {}) {
  let drop = dropNextCreate;
  return async (url, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Origin", origin);
    headers.set("CF-Connecting-IP", ip);
    // workerd's Request constructor accepts "manual" but not the browser-only
    // "error" redirect mode. The real client still supplies error; this
    // local Worker adapter maps it to the equivalent no-follow mode because
    // the test target is the Worker handler itself and it never redirects.
    const request = new Request(url, { ...init, redirect: init.redirect === "error" ? "manual" : init.redirect, headers });
    const parsed = new URL(url);
    let response;
    try {
      response = await worker.fetch(request, env);
    } catch (error) {
      calls.push({ path: parsed.pathname, status: "threw", code: error?.code || error?.name || "error" });
      throw error;
    }
    calls.push({ path: parsed.pathname, status: response.status, redirect: init.redirect });
    if (drop && parsed.pathname === Transfer.ENDPOINTS.create) {
      drop = false;
      await response.arrayBuffer();
      throw new TypeError("simulated-lost-create-response");
    }
    return response;
  };
}

function makeClient({ context, transport, document, outbound, inbound, credentials, lock }) {
  return Transfer.createClient({
    contract,
    crypto: webcrypto,
    transport,
    context,
    document,
    location,
    now: () => now,
    storage: { outbound, inbound, credentials, operationLock: lock },
  });
}

function assertNoBearerInUrls(calls) {
  for (const call of calls) {
    expect(call.path.startsWith("/v1/transfers")).toBe(true);
    expect(call.path.includes("?")).toBe(false);
    expect(call.path.includes("#")).toBe(false);
  }
}

describe("real client to local HTTP Worker transfer boundary", () => {
  beforeEach(async () => {
    await reset();
    await refreshHealth();
  });

  it("uses actual normalized producers and preserves an independently hashed six-section clone", async () => {
    const producer = makeProducers();
    const expectedHash = expectedCloneHash(producer.expectedSections);
    const calls = [];
    const transport = Transfer.createFetchTransport({
      fetch: serviceFetch({ calls }),
      baseUrl: "https://transfer.example/index.html",
    });
    const outbound = markerStore();
    const browserDocument = cookieDocument("repforge_setup_v1=v1.setup-canary");
    const browserKeys = memoryKeyStore();
    const browserClient = makeClient({
      context: "browser",
      transport,
      document: browserDocument,
      outbound,
      inbound: markerStore(),
      credentials: Transfer.createCredentialVault({ crypto: webcrypto, keyStore: browserKeys }),
      lock: operationLock(),
    });
    const created = await browserClient.create({
      sections: producer.sections,
      source: { context: "browser", logicalInstallationId: canonicalFixture.source.logicalInstallationId, sourceRevision: 42 },
      consent: { enabled: true },
      hasMeaningfulData: true,
      sourceAfter: () => producer.sections,
    });
    expect(created).toMatchObject({ ok: true, state: "ready", stale: false });
    expect(producer.flushes.count).toBeGreaterThanOrEqual(2);
    expect(outbound.peek()?.phase).toBe("awaiting-claim");
    expect(browserDocument.cookie.includes("repforge_setup_v1=v1.setup-canary")).toBe(true);
    expect(browserDocument.cookie.includes(Transfer.COOKIE_NAME)).toBe(true);

    const beforeClaimStatus = await browserClient.status();
    expect(beforeClaimStatus).toMatchObject(EXPECTED_FAULTS.status);

    const handoffCookie = browserDocument.cookie;
    const inbound = markerStore();
    const standaloneDocument = cookieDocument(handoffCookie);
    const standaloneKeys = memoryKeyStore();
    const standaloneClient = makeClient({
      context: "standalone",
      transport,
      document: standaloneDocument,
      outbound: markerStore(),
      inbound,
      credentials: Transfer.createCredentialVault({ crypto: webcrypto, keyStore: standaloneKeys }),
      lock: operationLock(),
    });
    const firstClaim = await standaloneClient.claim();
    expect(firstClaim).toMatchObject({ ok: true, state: "validating", expiresAt: expect.any(String) });
    expect((await contract.validateEnvelopeIntegrity(firstClaim.envelope, webcrypto)).ok).toBe(true);
    expect(inbound.peek()?.phase).toBe("claimed");
    expect(standaloneDocument.cookie.includes(Transfer.COOKIE_NAME)).toBe(false);
    expect(standaloneDocument.cookie.includes("repforge_setup_v1=v1.setup-canary")).toBe(true);

    const returnedSections = Object.fromEntries([
      "durableState",
      "workoutDraft",
      "programEntryDraft",
      "uiPreferences",
      "analytics",
      "telemetryIdentity",
    ].map((key) => [key, firstClaim.envelope[key]]));
    expect(expectedCloneHash(returnedSections)).toBe(expectedHash);
    for (const key of Object.keys(returnedSections)) expect(sectionHash(returnedSections[key])).toBe(sectionHash(producer.expectedSections[key]));

    const retryClaim = await standaloneClient.claim();
    expect(retryClaim).toMatchObject({ ok: true, state: "validating" });

    const competingInbound = markerStore();
    const competingDocument = cookieDocument(handoffCookie);
    const competingClient = makeClient({
      context: "standalone",
      transport,
      document: competingDocument,
      outbound: markerStore(),
      inbound: competingInbound,
      credentials: Transfer.createCredentialVault({ crypto: webcrypto, keyStore: memoryKeyStore() }),
      lock: operationLock(),
    });
    const competing = await competingClient.claim();
    expect(competing).toMatchObject({ ok: false, code: EXPECTED_FAULTS.competingClaim.code, state: EXPECTED_FAULTS.competingClaim.state });

    const pendingClaimStatus = await browserClient.status();
    expect(pendingClaimStatus).toMatchObject({ ok: false, state: "retryable", code: "transfer-pending", remoteState: "claiming" });

    const claimedMarker = inbound.peek();
    await inbound.write({ ...claimedMarker, phase: "local-committed" });
    const commit = await standaloneClient.commit();
    expect(commit).toMatchObject({ ok: true, state: EXPECTED_FAULTS.commit.state });
    expect(inbound.peek()).toBe(null);
    expect(standaloneKeys.records.size).toBe(0);
    expect(inbound.writes.map((value) => value?.phase ?? null)).toEqual([
      "staged",
      "claiming",
      "claimed",
      "local-committed",
      "cleanup-pending",
      null,
    ]);

    const confirmed = await browserClient.status();
    expect(confirmed).toMatchObject({ ok: true, state: "confirmed", remoteState: EXPECTED_FAULTS.commit.remoteState });
    expect(browserDocument.cookie.includes(Transfer.COOKIE_NAME)).toBe(false);
    expect(outbound.peek()?.phase).toBe("confirmed");
    expect(browserKeys.records.size).toBe(0);
    expect(calls.map(({ path }) => path)).toContain(Transfer.ENDPOINTS.create);
    expect(calls.map(({ path }) => path)).toContain(Transfer.ENDPOINTS.claim);
    expect(calls.map(({ path }) => path)).toContain(Transfer.ENDPOINTS.commit);
    expect(calls.map(({ path }) => path)).toContain(Transfer.ENDPOINTS.status);
    expect(calls.filter(({ path }) => path === Transfer.ENDPOINTS.claim).map(({ status }) => status)).toEqual([
      EXPECTED_FAULTS.sameClaim.responseStatus,
      EXPECTED_FAULTS.sameClaim.responseStatus,
      EXPECTED_FAULTS.competingClaim.responseStatus,
    ]);
    expect(calls.filter(({ path }) => path === Transfer.ENDPOINTS.commit).map(({ status }) => status)).toEqual([EXPECTED_FAULTS.commit.responseStatus]);
    expect(calls.filter(({ path }) => path === Transfer.ENDPOINTS.status).map(({ status }) => status)).toEqual([200, 200, 200]);
    expect(calls.find(({ path }) => path === Transfer.ENDPOINTS.create)?.status).toBe(201);
    assertNoBearerInUrls(calls);
  });

  it("freezes a lost create and same-key duplicate without recovering a token", async () => {
    const producer = makeProducers();
    const calls = [];
    const transport = Transfer.createFetchTransport({
      fetch: serviceFetch({ calls, ip: "198.51.100.78", dropNextCreate: true }),
      baseUrl: "https://transfer.example/index.html",
    });
    const outbound = markerStore();
    const document = cookieDocument();
    const keys = memoryKeyStore();
    const client = makeClient({
      context: "browser",
      transport,
      document,
      outbound,
      inbound: markerStore(),
      credentials: Transfer.createCredentialVault({ crypto: webcrypto, keyStore: keys }),
      lock: operationLock(),
    });
    const input = {
      sections: producer.sections,
      source: { context: "browser", logicalInstallationId: canonicalFixture.source.logicalInstallationId, sourceRevision: 43 },
      consent: { enabled: true },
      hasMeaningfulData: true,
    };
    const lost = await client.create(input);
    expect(lost).toMatchObject({ ok: false, code: EXPECTED_FAULTS.lostCreate.code, state: EXPECTED_FAULTS.lostCreate.state });
    expect(outbound.peek()?.phase).toBe(EXPECTED_FAULTS.lostCreate.markerPhase);
    expect(outbound.peek()?.sealedCredentials).toBeUndefined();
    expect(keys.records.size).toBe(0);
    expect(document.cookie.includes(Transfer.COOKIE_NAME)).toBe(false);

    const duplicate = await client.create(input);
    expect(duplicate).toMatchObject({
      ok: false,
      code: EXPECTED_FAULTS.duplicateCreate.code,
      state: EXPECTED_FAULTS.duplicateCreate.state,
    });
    expect(duplicate.token).toBeUndefined();
    expect(outbound.peek()?.phase).toBe(EXPECTED_FAULTS.lostCreate.markerPhase);
    expect(outbound.peek()?.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
    expect(outbound.peek()?.sealedCredentials).toBeUndefined();
    expect(document.cookie.includes(Transfer.COOKIE_NAME)).toBe(false);
    expect(calls.map(({ status }) => status)).toEqual([201, EXPECTED_FAULTS.duplicateCreate.responseStatus]);
    assertNoBearerInUrls(calls);
  });
});
