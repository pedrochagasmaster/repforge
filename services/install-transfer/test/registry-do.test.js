import { env } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { LIVE_WINDOW_MS, TOMBSTONE_MARGIN_MS } from "../src/lifetime.js";
import { euStub } from "../src/namespaces.js";
import { routeNameForIdempotencyKey } from "../src/routing.js";

const routingKey = new Uint8Array(32).fill(1);

async function registry() {
  return euStub(env.TRANSFER_REGISTRY, "global", { allowLocalFallback: true });
}

async function transferFor(key) {
  const route = await routeNameForIdempotencyKey(key, routingKey);
  return {
    route,
    stub: euStub(env.TRANSFER_OBJECTS, route, { allowLocalFallback: true }),
  };
}

async function rows() {
  const stub = await registry();
  return runInDurableObject(stub, (_instance, state) => state.storage.sql.exec("SELECT * FROM transfer_route_registry").toArray());
}

async function expectFailure(stub, value) {
  const result = await runInDurableObject(stub, async (instance) => {
    try {
      return { ok: true, value: await instance.reserveRoute(value) };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
  expect(result.ok).toBe(false);
}

describe("bounded transfer route registry", () => {
  beforeEach(async () => {
    await reset();
  });

  it("keeps the first reservation deadline fixed across retries", async () => {
    const stub = await registry();
    const { route } = await transferFor("registry-fixed-reservation");
    const now = Date.now();
    const first = await stub.reserveRoute({ routeName: route, now });
    const retry = await stub.reserveRoute({ routeName: route, now: now + 10 * 60_000 });
    expect(first).toMatchObject({ ok: true, existing: false, maxTransferExpiresAt: now + LIVE_WINDOW_MS });
    expect(retry).toMatchObject({ ok: true, existing: true, maxTransferExpiresAt: now + LIVE_WINDOW_MS });
    expect(await rows()).toMatchObject([{
      route_name: route,
      reserved_at: now,
      reservation_expires_at: now + LIVE_WINDOW_MS,
      tombstone_until: now + LIVE_WINDOW_MS + TOMBSTONE_MARGIN_MS,
      purge_state: "reserved",
    }]);
    await expectFailure(stub, { routeName: route, now: now + LIVE_WINDOW_MS + 1 });
  });

  it("enumerates and removes an orphan reservation without bearer or clone metadata", async () => {
    const registryStub = await registry();
    const { route } = await transferFor("registry-orphan");
    const now = Date.now();
    const reservation = await registryStub.reserveRoute({ routeName: route, now });
    const result = await registryStub.purgeDue({ now: reservation.maxTransferExpiresAt, limit: 1 });
    expect(result).toMatchObject({ examined: 1, purged: 1, failed: 0, remainingDue: 0 });
    expect(await rows()).toHaveLength(0);
  });

  it("reconciles transfer expiry with the fixed reservation and purges at 75 minutes", async () => {
    const registryStub = await registry();
    const { route, stub } = await transferFor("registry-created");
    const now = Date.now();
    const reservation = await registryStub.reserveRoute({ routeName: route, now });
    const created = await stub.createRecord({
      idempotencyKey: "registry-created",
      envelopeJson: JSON.stringify({ logical: "registry-test" }),
      now,
      requestedExpiry: reservation.maxTransferExpiresAt,
    });
    await registryStub.setLifetime({ routeName: route, expiresAt: created.expiresAt, now, state: "available" });
    await expectFailure(registryStub, { routeName: route, now: now + LIVE_WINDOW_MS + TOMBSTONE_MARGIN_MS + 1 });
    const live = await rows();
    expect(live[0]).toMatchObject({ route_name: route, reservation_expires_at: now + LIVE_WINDOW_MS });
    await expect(registryStub.purgeDue({ now: created.expiresAt, limit: 1 })).resolves.toMatchObject({ examined: 1, purged: 0 });
    await expect(registryStub.purgeDue({ now: now + LIVE_WINDOW_MS + TOMBSTONE_MARGIN_MS, limit: 1 })).resolves.toMatchObject({ examined: 1, purged: 1 });
    expect(await rows()).toHaveLength(0);
  });
});
