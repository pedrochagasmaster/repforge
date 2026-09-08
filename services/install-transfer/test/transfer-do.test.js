import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { base64UrlEncode } from "../src/crypto.js";
import { euStub } from "../src/namespaces.js";
import { routeNameForIdempotencyKey } from "../src/routing.js";

const routingKey = new Uint8Array(32).fill(1);
const baseNow = Date.now();

async function objectFor(key) {
  return euStub(env.TRANSFER_OBJECTS, await routeNameForIdempotencyKey(key, routingKey), { allowLocalFallback: true });
}

async function rows(stub) {
  return runInDurableObject(stub, (_instance, state) => state.storage.sql.exec("SELECT * FROM transfer_record").toArray());
}

describe("SQLite Durable Object encrypted record foundation", () => {
  it("deduplicates lost create responses and never stores a bearer or plaintext envelope", async () => {
    const stub = await objectFor("lost-response-key");
    const first = await stub.createRecord({
      idempotencyKey: "lost-response-key",
      envelopeJson: JSON.stringify({ logical: "source", history: [1, 2] }),
      now: baseNow,
      requestedExpiry: baseNow + 60_000,
    });
    const retry = await stub.createRecord({
      idempotencyKey: "lost-response-key",
      envelopeJson: JSON.stringify({ logical: "different-retry-payload" }),
      now: baseNow + 1,
    });

    expect(first.kind).toBe("created");
    expect(first.token).toMatch(/^v1\.[A-Za-z0-9_-]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u);
    expect(retry).toEqual({ kind: "duplicate", expiresAt: baseNow + 60_000 });
    const stored = await rows(stub);
    expect(stored).toHaveLength(1);
    expect(stored[0].envelope_ciphertext).not.toContain("source");
    expect(JSON.stringify(stored[0])).not.toContain(first.token);
    expect(stored[0].token_digest).not.toBe(first.token);
    await evictDurableObject(stub);
    await expect(stub.statusRecord({ token: first.token, now: baseNow + 2 })).resolves.toMatchObject({ kind: "status", state: "available" });
  });

  it("binds one claim, returns the clone, and makes commit idempotent without retaining claim identity", async () => {
    const stub = await objectFor("claim-commit-key");
    const created = await stub.createRecord({
      idempotencyKey: "claim-commit-key",
      envelopeJson: JSON.stringify({ logical: "clone" }),
      now: baseNow,
      requestedExpiry: baseNow + 60_000,
    });
    const claim = await stub.claimRecord({ token: created.token, claimId: "claim-right", now: baseNow + 1 });
    const wrongClaim = await stub.claimRecord({ token: created.token, claimId: "claim-wrong", now: baseNow + 2 });
    const retryClaim = await stub.claimRecord({ token: created.token, claimId: "claim-right", now: baseNow + 3 });
    expect(wrongClaim).toEqual({ kind: "unavailable" });
    expect(claim).toEqual({ kind: "claimed", envelopeJson: JSON.stringify({ logical: "clone" }), expiresAt: baseNow + 60_000 });
    expect(retryClaim).toEqual(claim);

    await expect(stub.commitRecord({ token: created.token, claimId: "claim-right", now: baseNow + 4 })).resolves.toEqual({ kind: "deleted", state: "deleted", expiresAt: baseNow + 60_000 });
    await expect(stub.commitRecord({ token: created.token, claimId: "claim-lost", now: baseNow + 5 })).resolves.toEqual({ kind: "deleted", state: "deleted", expiresAt: baseNow + 60_000 });
    const stored = await rows(stub);
    expect(stored[0].state).toBe("deleted");
    expect(stored[0].claim_digest).toBeNull();
    expect(stored[0].idempotency_digest).toBeNull();
    expect(stored[0].created_at).toBeNull();
    expect(stored[0].claimed_at).toBeNull();
    expect(stored[0].envelope_ciphertext).toBeNull();
    expect(stored[0].envelope_salt).toBeNull();
    expect(stored[0].envelope_nonce).toBeNull();
    expect(stored[0].envelope_aad).toBeNull();
    await expect(stub.statusRecord({ token: created.token, now: baseNow + 6 })).resolves.toEqual({ kind: "status", state: "deleted", expiresAt: baseNow + 60_000 });
  });

  it("distinguishes unclaimed expiry from claimed-expired and purges the tombstone", async () => {
    const availableStub = await objectFor("expiry-available-key");
    const available = await availableStub.createRecord({
      idempotencyKey: "expiry-available-key",
      envelopeJson: JSON.stringify({ logical: "never-claimed" }),
      now: baseNow,
      requestedExpiry: baseNow + 10,
    });
    await expect(availableStub.statusRecord({ token: available.token, now: baseNow + 10 })).resolves.toEqual({ kind: "status", state: "expired", expiresAt: baseNow + 10 });
    const availableStored = await rows(availableStub);
    expect(availableStored[0].envelope_ciphertext).toBeNull();

    const claimedStub = await objectFor("expiry-claimed-key");
    const claimed = await claimedStub.createRecord({
      idempotencyKey: "expiry-claimed-key",
      envelopeJson: JSON.stringify({ logical: "claimed" }),
      now: baseNow,
      requestedExpiry: baseNow + 10,
    });
    await claimedStub.claimRecord({ token: claimed.token, claimId: "claim-before-expiry", now: baseNow + 1 });
    await expect(claimedStub.statusRecord({ token: claimed.token, now: baseNow + 10 })).resolves.toEqual({ kind: "status", state: "claimed-expired", expiresAt: baseNow + 10 });
    await expect(claimedStub.commitRecord({ token: claimed.token, claimId: "claim-before-expiry", now: baseNow + 11 })).resolves.toEqual({ kind: "unavailable" });

    await expect(claimedStub.statusRecord({ token: claimed.token, now: baseNow + 15 * 60_000 + 10 })).resolves.toEqual({ kind: "unavailable" });
    expect(await rows(claimedStub)).toHaveLength(0);
  });

  it("fails closed when any authenticated record metadata or AAD is tampered", async () => {
    const mutations = [
      {
        name: "expiry",
        sql: "UPDATE transfer_record SET expires_at = ?, tombstone_until = ?, created_at = ? WHERE singleton = 1",
        values: [baseNow + 60 * 60_000, baseNow + 60 * 60_000 + 15 * 60_000, baseNow + 1],
      },
      {
        name: "creation",
        sql: "UPDATE transfer_record SET created_at = ? WHERE singleton = 1",
        values: [baseNow + 1],
      },
      {
        name: "schema",
        sql: "UPDATE transfer_record SET record_version = ? WHERE singleton = 1",
        values: [2],
      },
      {
        name: "route",
        sql: "UPDATE transfer_record SET transfer_id = ? WHERE singleton = 1",
        values: ["wrong-transfer-route"],
      },
      {
        name: "aad",
        sql: "UPDATE transfer_record SET envelope_aad = ? WHERE singleton = 1",
        values: [base64UrlEncode(new TextEncoder().encode("tampered-aad"))],
      },
    ];

    for (const mutation of mutations) {
      const key = `metadata-tamper-${mutation.name}`;
      const stub = await objectFor(key);
      const created = await stub.createRecord({
        idempotencyKey: key,
        envelopeJson: JSON.stringify({ logical: "must-not-decrypt" }),
        now: baseNow,
        requestedExpiry: baseNow + 10,
      });
      expect(created.kind).toBe("created");
      await runInDurableObject(stub, (_instance, state) => {
        state.storage.sql.exec(mutation.sql, ...mutation.values);
      });

      await expect(stub.claimRecord({ token: created.token, claimId: `claim-${mutation.name}`, now: baseNow + 20 })).resolves.toEqual({ kind: "unavailable" });
      await expect(stub.statusRecord({ token: created.token, now: baseNow + 20 })).resolves.toEqual({ kind: "unavailable" });
    }
  });

  it("uses conditional transitions under concurrent create, claim, and commit calls", async () => {
    const key = "concurrent-transition-key";
    const stub = await objectFor(key);
    const creates = await Promise.all(Array.from({ length: 8 }, () => stub.createRecord({
      idempotencyKey: key,
      envelopeJson: JSON.stringify({ logical: "one-record" }),
      now: baseNow,
      requestedExpiry: baseNow + 60_000,
    })));
    expect(creates.filter((result) => result.kind === "created")).toHaveLength(1);
    expect(creates.filter((result) => result.kind === "duplicate")).toHaveLength(7);
    const created = creates.find((result) => result.kind === "created");

    const claims = await Promise.all([
      stub.claimRecord({ token: created.token, claimId: "claim-a", now: baseNow + 1 }),
      stub.claimRecord({ token: created.token, claimId: "claim-b", now: baseNow + 1 }),
    ]);
    expect(claims.filter((result) => result.kind === "claimed")).toHaveLength(1);
    expect(claims.filter((result) => result.kind === "unavailable")).toHaveLength(1);
    const winnerClaimId = claims[0].kind === "claimed" ? "claim-a" : "claim-b";

    const commits = await Promise.all([
      stub.commitRecord({ token: created.token, claimId: winnerClaimId, now: baseNow + 2 }),
      stub.commitRecord({ token: created.token, claimId: winnerClaimId, now: baseNow + 2 }),
    ]);
    expect(commits).toEqual([
      { kind: "deleted", state: "deleted", expiresAt: baseNow + 60_000 },
      { kind: "deleted", state: "deleted", expiresAt: baseNow + 60_000 },
    ]);
    expect((await rows(stub))[0]).toMatchObject({ state: "deleted", envelope_ciphertext: null, claim_digest: null });
  });

  it("keeps the manual purge backstop payload-free and bounded by the tombstone deadline", async () => {
    const key = "manual-purge-key";
    const stub = await objectFor(key);
    await stub.createRecord({
      idempotencyKey: key,
      envelopeJson: JSON.stringify({ logical: "purge-me" }),
      now: baseNow,
      requestedExpiry: baseNow + 10,
    });

    await expect(stub.purgeDue({ now: baseNow + 10 })).resolves.toMatchObject({ purged: false, state: "expired" });
    expect((await rows(stub))[0]).toMatchObject({ state: "expired", envelope_ciphertext: null, envelope_aad: null, claim_digest: null });
    await expect(stub.purgeDue({ now: baseNow + 15 * 60_000 + 10 })).resolves.toEqual({ purged: true });
    expect(await rows(stub)).toHaveLength(0);
  });

  it("quarantines corrupt metadata on the real alarm path and reports deletion health failure", async () => {
    const key = "alarm-corrupt-record-key";
    const stub = await objectFor(key);
    const created = await stub.createRecord({
      idempotencyKey: key,
      envelopeJson: JSON.stringify({ logical: "alarm-corruption" }),
      now: baseNow,
      requestedExpiry: baseNow + 10,
    });
    expect(created.kind).toBe("created");
    await runInDurableObject(stub, (_instance, state) => {
      // The expiry is intentionally impossible for the authenticated record;
      // the alarm must not trust it to schedule another unbounded purge.
      state.storage.sql.exec(
        "UPDATE transfer_record SET expires_at = ?, tombstone_until = ? WHERE singleton = 1",
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
      );
    });

    await runInDurableObject(stub, async (instance) => {
      await instance.alarm();
    });
    expect(await rows(stub)).toHaveLength(0);
    await expect(euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true }).snapshot({ now: Date.now() })).resolves.toMatchObject({
      deletionHealthy: false,
      createsEnabled: false,
    });
  });
});
