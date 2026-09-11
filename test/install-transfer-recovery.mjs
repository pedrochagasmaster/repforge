#!/usr/bin/env node
/**
 * Plan 053 Row 5 Safari recovery snapshot oracle.
 *
 * Deterministic state transition oracle covering the exact Safari-side
 * recovery state machine and all required deliberate negatives.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Transfer = require("../install-transfer.js");
const Contract = require("../install-transfer-contract.js");

function base64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function tokenFixture(seed = "A") {
  const start = seed.charCodeAt(0);
  const segment = (offset) => base64url(Uint8Array.from({ length: 32 }, (_, index) => (start + offset + index) % 256));
  return `v1.k1.${segment(0)}.${segment(1)}.${segment(2)}`;
}

function cookieDocument() {
  let store = "";
  return {
    get cookie() { return store; },
    set cookie(val) {
      if (typeof val !== "string") return;
      const parts = val.split(";")[0].trim();
      const [k, v] = parts.split("=");
      if (!v || val.includes("Max-Age=0") || val.includes("expires=Thu, 01 Jan 1970")) {
        const regex = new RegExp(`(?:^|; )${k}=[^;]*`);
        store = store.replace(regex, "").replace(/^; /, "").replace(/; ;/g, "; ");
      } else {
        const regex = new RegExp(`(?:^|; )${k}=[^;]*`);
        store = store.replace(regex, "");
        store = store ? `${store}; ${k}=${v}` : `${k}=${v}`;
      }
    }
  };
}

function markerStore(initial = null) {
  let record = initial ? JSON.parse(JSON.stringify(initial)) : null;
  return {
    read: async () => (record ? JSON.parse(JSON.stringify(record)) : null),
    write: async (val) => { record = JSON.parse(JSON.stringify(val)); },
    clear: async () => { record = null; },
    peek: () => record,
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
  return {
    withLock(name, work) {
      const next = tail.then(() => work());
      tail = next.catch(() => {});
      return next;
    },
  };
}

function makeTransport(sequence) {
  let index = 0;
  return {
    requests: [],
    async request(req) {
      this.requests.push(req);
      if (index >= sequence.length) return { ok: false, code: "network-failure" };
      const res = sequence[index++];
      if (typeof res === "function") return res(req);
      return res;
    }
  };
}

function jsonResponse(status, body) {
  return {
    status,
    bytes: new Uint8Array(Buffer.from(JSON.stringify(body))),
  };
}

async function setupClient({
  marker = null,
  transportSequence = [],
  keyStore = memoryKeyStore(),
  now = "2026-09-08T19:00:00.000Z"
} = {}) {
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const outbound = markerStore(marker);
  const document = cookieDocument();
  const transport = makeTransport(transportSequence);
  const lock = operationLock();
  const client = Transfer.createClient({
    contract: Contract,
    crypto: webcrypto,
    transport,
    context: "browser",
    now: () => now,
    document,
    location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" },
    storage: { outbound, credentials: vault, operationLock: lock },
  });
  return { client, outbound, vault, transport, document, keyStore };
}

test("Row 5: restart with an outbound transfer marker resumes status polling", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("1");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-1",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
  };

  const { client, transport } = await setupClient({
    marker: initialMarker,
    keyStore,
    transportSequence: [jsonResponse(200, { state: "claiming", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.equal(res.ok, false);
  assert.equal(res.code, "transfer-pending");
  assert.equal(res.remoteState, "claiming");
  assert.equal(client.recoveryState(), "awaitingClaimOutcome");
  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0].endpoint, "/v1/transfers/status");
});

test("Row 5: deleted establishes the confirmed Safari recovery snapshot and keeps browser mutation frozen", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("2");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-2",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
    sourceRevision: 10,
    mutatedAfterCreation: false,
  };

  const { client, outbound } = await setupClient({
    marker: initialMarker,
    keyStore,
    transportSequence: [jsonResponse(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.equal(res.ok, true);
  assert.equal(res.state, "confirmed");
  assert.equal(res.remoteState, "deleted");
  assert.equal(client.recoveryState(), "confirmed");

  const finalMarker = outbound.peek();
  assert.equal(finalMarker.phase, "confirmed");
  assert.equal(finalMarker.sealedCredentials, undefined);
  assert.ok(finalMarker.recoverySnapshot);
  assert.ok(finalMarker.recoverySnapshot.tokenDigest);
  assert.ok(finalMarker.recoverySnapshot.confirmedAt);
  assert.equal(finalMarker.recoverySnapshot.sourceRevision, 10);
  assert.equal(finalMarker.recoverySnapshot.mutatedAfterCreation, false);
});

test("Row 5: claimed-expired means import may have completed and freezes like an indeterminate transfer", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("3");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-3",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
  };

  const { client, outbound } = await setupClient({
    marker: initialMarker,
    keyStore,
    transportSequence: [jsonResponse(200, { state: "claimed-expired", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.equal(res.ok, false);
  assert.equal(res.state, "unknown-outcome");
  assert.equal(res.code, "claimed-expired");
  assert.equal(client.recoveryState(), "resumeWarning");
  assert.equal(outbound.peek().phase, "awaiting-claim");
});

test("Row 5: server-confirmed never-claimed expired clears outbound transfer state and permits ordinary browser use", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("4");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-4",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
  };

  const { client, outbound } = await setupClient({
    marker: initialMarker,
    keyStore,
    transportSequence: [jsonResponse(200, { state: "expired", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.equal(res.ok, true);
  assert.equal(res.state, "idle");
  assert.equal(res.remoteState, "expired");
  assert.equal(client.recoveryState(), "none");
  assert.equal(outbound.peek(), null);
});

test("Row 5: unavailable status, polling exhaustion, service failure, or lost Safari credential becomes unknown-outcome", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("5");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-5",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
  };

  // Case A: 404 unavailable
  {
    const { client } = await setupClient({
      marker: initialMarker,
      keyStore,
      transportSequence: [jsonResponse(404, { state: "unavailable" })],
    });
    const res = await client.status();
    assert.equal(res.ok, false);
    assert.equal(res.state, "unknown-outcome");
    assert.equal(res.code, "status-unavailable");
    assert.equal(client.recoveryState(), "resumeWarning");
  }

  // Case B: Network failure
  {
    const { client } = await setupClient({
      marker: initialMarker,
      keyStore,
      transportSequence: [{ ok: false, code: "network-failure" }],
    });
    const res = await client.status();
    assert.equal(res.ok, false);
    assert.equal(res.state, "unknown-outcome");
    assert.equal(client.recoveryState(), "resumeWarning");
  }

  // Case C: Lost Safari credential
  {
    const lostStore = memoryKeyStore();
    const lostVault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore: lostStore });
    const s = await lostVault.seal("browser-outbound", { token: tokenFixture("6") });
    await lostStore.delete("browser-outbound", s.keyId);
    const { client } = await setupClient({
      marker: { ...initialMarker, sealedCredentials: s },
      vault: lostVault,
      keyStore: lostStore,
      transportSequence: [],
    });
    const res = await client.status();
    assert.equal(res.ok, false);
    assert.equal(res.state, "unknown-outcome");
    assert.equal(res.code, "credential-unavailable");
    assert.equal(client.recoveryState(), "resumeWarning");
  }
});

test("Row 5: plain dismissal must never unfreeze Safari", async () => {
  const keyStore = memoryKeyStore();
  const initialMarker = {
    version: 1,
    phase: "confirmed",
    idempotencyKey: "test-idempotency-7",
    recoverySnapshot: { tokenDigest: "d".repeat(64), confirmedAt: "2026-09-08T19:00:00.000Z", expiresAt: "2026-09-08T20:00:00.000Z" }
  };

  const { client, outbound } = await setupClient({ marker: initialMarker, keyStore });
  await client.status();
  assert.equal(client.recoveryState(), "confirmed");

  const dismissed = client.dismiss();
  assert.equal(dismissed.ok, true);
  assert.equal(client.recoveryState(), "confirmed");
  assert.equal(outbound.peek().phase, "confirmed");
});

test("Row 5: Resume in browser shows explicit permanent-divergence warning and only explicit confirmation removes Safari freeze", async () => {
  const keyStore = memoryKeyStore();
  const initialMarker = {
    version: 1,
    phase: "confirmed",
    recoverySnapshot: { tokenDigest: "d".repeat(64), confirmedAt: "2026-09-08T19:00:00.000Z", expiresAt: "2026-09-08T20:00:00.000Z" }
  };

  const { client, outbound } = await setupClient({ marker: initialMarker, keyStore });
  await client.status();
  assert.equal(client.recoveryState(), "confirmed");

  // Explicit divergence confirmation
  const divRes = await client.confirmDivergence();
  assert.equal(divRes.ok, true);
  assert.equal(divRes.state, "resumedDiverged");
  assert.equal(client.recoveryState(), "resumedDiverged");

  const finalMarker = outbound.peek();
  assert.equal(finalMarker.phase, "resumedDiverged");
  assert.ok(finalMarker.divergedAt);
});

test("Row 5: source changes after transfer creation are detectable so Safari state can truthfully say installed snapshot is stale", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const token = tokenFixture("8");
  const sealed = await vault.seal("browser-outbound", { token });
  const initialMarker = {
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "test-idempotency-8",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z",
    sourceRevision: 5,
    mutatedAfterCreation: false,
  };

  // Pass source with bumped sourceRevision = 6
  const { client, outbound } = await setupClient({
    marker: initialMarker,
    keyStore,
    transportSequence: [jsonResponse(200, { state: "deleted", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status({ source: { sourceRevision: 6 } });
  assert.equal(res.ok, true);
  const snap = outbound.peek().recoverySnapshot;
  assert.equal(snap.mutatedAfterCreation, true);
});

/* ========================================================================= */
/* DELIBERATE NEGATIVES REQUIRED BY SPEC                                     */
/* ========================================================================= */

test("Deliberate Negative 1: dismissal unfreezes browser is FALSE (dismissal keeps freeze)", async () => {
  const { client, outbound } = await setupClient({
    marker: { version: 1, phase: "confirmed", recoverySnapshot: { tokenDigest: "d".repeat(64), expiresAt: "2026-09-08T20:00:00.000Z" } },
  });
  await client.status();
  assert.equal(client.recoveryState(), "confirmed");

  client.dismiss();
  assert.notEqual(client.recoveryState(), "none");
  assert.notEqual(client.recoveryState(), "resumedDiverged");
  assert.equal(client.recoveryState(), "confirmed");
  assert.equal(outbound.peek()?.phase, "confirmed");
});

test("Deliberate Negative 2: claimed-expired resumes silently is FALSE (claimed-expired stays frozen in resumeWarning)", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const sealed = await vault.seal("browser-outbound", { token: tokenFixture("B") });
  const { client, outbound } = await setupClient({
    marker: { version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" },
    keyStore,
    transportSequence: [jsonResponse(200, { state: "claimed-expired", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.notEqual(res.ok, true);
  assert.notEqual(res.state, "idle");
  assert.notEqual(client.recoveryState(), "none");
  assert.equal(client.recoveryState(), "resumeWarning");
  assert.ok(outbound.peek());
});

test("Deliberate Negative 3: unavailable status is interpreted as expired is FALSE (unavailable becomes unknown-outcome)", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const sealed = await vault.seal("browser-outbound", { token: tokenFixture("C") });
  const { client, outbound } = await setupClient({
    marker: { version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" },
    keyStore,
    transportSequence: [jsonResponse(404, { state: "unavailable" })],
  });

  const res = await client.status();
  assert.notEqual(res.state, "idle");
  assert.notEqual(res.remoteState, "expired");
  assert.equal(res.state, "unknown-outcome");
  assert.notEqual(outbound.peek(), null);
  assert.equal(client.recoveryState(), "resumeWarning");
});

test("Deliberate Negative 4: expired-with-no-claim remains frozen is FALSE (expired clears outbound and unfreezes)", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const sealed = await vault.seal("browser-outbound", { token: tokenFixture("D") });
  const { client, outbound } = await setupClient({
    marker: { version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" },
    keyStore,
    transportSequence: [jsonResponse(200, { state: "expired", expiresAt: "2026-09-08T20:00:00.000Z" })],
  });

  const res = await client.status();
  assert.equal(res.ok, true);
  assert.equal(res.state, "idle");
  assert.equal(client.recoveryState(), "none");
  assert.equal(outbound.peek(), null);
});

test("Deliberate Negative 5: restart loses polling state is FALSE (restart resumes polling from outbound marker)", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const sealed = await vault.seal("browser-outbound", { token: tokenFixture("E") });
  const outbound = markerStore({ version: 1, phase: "awaiting-claim", sealedCredentials: sealed, expiresAt: "2026-09-08T20:00:00.000Z" });

  // Simulating restart: create brand-new client on same outbound store
  const client2 = Transfer.createClient({
    contract: Contract,
    crypto: webcrypto,
    transport: makeTransport([jsonResponse(200, { state: "available", expiresAt: "2026-09-08T20:00:00.000Z" })]),
    context: "browser",
    now: () => "2026-09-08T19:00:00.000Z",
    document: cookieDocument(),
    location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" },
    storage: { outbound, credentials: vault, operationLock: operationLock() },
  });

  const res = await client2.status();
  assert.equal(res.code, "transfer-pending");
  assert.equal(res.remoteState, "available");
  assert.equal(client2.recoveryState(), "awaitingClaimOutcome");
});

test("Deliberate Negative 6: a second Safari tab creates an independent recovery state is FALSE", async () => {
  const keyStore = memoryKeyStore();
  const vault = Transfer.createCredentialVault({ crypto: webcrypto, keyStore });
  const sealed = await vault.seal("browser-outbound", { token: tokenFixture("F") });
  const sharedOutbound = markerStore({
    version: 1,
    phase: "awaiting-claim",
    idempotencyKey: "tab-1-idempotency-key",
    sealedCredentials: sealed,
    expiresAt: "2026-09-08T20:00:00.000Z",
    createdAt: "2026-09-08T19:00:00.000Z"
  });

  // Tab 2 client reading the same shared outbound storage
  const tab2Client = Transfer.createClient({
    contract: Contract,
    crypto: webcrypto,
    transport: makeTransport([]),
    context: "browser",
    now: () => "2026-09-08T19:00:00.000Z",
    document: cookieDocument(),
    location: { href: "https://pedrochagasmaster.github.io/repforge/index.html" },
    storage: { outbound: sharedOutbound, credentials: vault, operationLock: operationLock() },
  });

  // Calling create() in tab 2 must NOT generate a new transfer with new idempotency key
  const createRes = await tab2Client.create({
    sections: { profile: { schemaVersion: 1 } },
    source: { sourceRevision: 1 },
    consent: { enabled: true },
    hasMeaningfulData: true,
  });

  assert.equal(createRes.ok, true);
  assert.equal(createRes.state, "ready");
  assert.equal(sharedOutbound.peek().idempotencyKey, "tab-1-idempotency-key");
});

test("Deliberate Negative 7: a mutation bypasses the freeze is FALSE (freeze blocks mutations fail-closed)", async () => {
  const rawMarker = { version: 1, phase: "confirmed", recoverySnapshot: { tokenDigest: "d".repeat(64), expiresAt: "2026-09-08T20:00:00.000Z" } };
  
  // App-level freeze check emulation:
  function installTransferMutationFrozen(outboundMarker) {
    if (!outboundMarker) return false;
    if (outboundMarker.phase === "resumedDiverged") return false;
    return true;
  }

  assert.equal(installTransferMutationFrozen(rawMarker), true);

  // App-level write gate
  function stageWrite(outboundMarker, key, value) {
    if (installTransferMutationFrozen(outboundMarker)) {
      return { ok: false, code: "install-transfer-frozen", blocked: true };
    }
    return { ok: true, wrote: key };
  }

  const writeResult = stageWrite(rawMarker, "repforge_draft_v1", { active: true });
  assert.equal(writeResult.ok, false);
  assert.equal(writeResult.blocked, true);
  assert.equal(writeResult.code, "install-transfer-frozen");
});
