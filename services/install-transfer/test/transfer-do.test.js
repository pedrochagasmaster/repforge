import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { routeNameForIdempotencyKey } from "../src/routing.js";

const routingKey = new Uint8Array(32).fill(1);
const baseNow = Date.now();

async function objectFor(key) {
  return env.TRANSFER_OBJECTS.getByName(await routeNameForIdempotencyKey(key, routingKey));
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
});
