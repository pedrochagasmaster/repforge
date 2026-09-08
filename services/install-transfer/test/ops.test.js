import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";

const origin = "https://taurifer.example";
const secrets = {
  watchdog: env.TRANSFER_WATCHDOG_SECRET,
  billing: env.TRANSFER_BILLING_SECRET,
  purge: env.TRANSFER_PURGE_SECRET,
  ack: env.TRANSFER_ACK_SECRET,
};

function request(path, method, body, role) {
  const headers = { Accept: "application/json", "Cache-Control": "no-store" };
  if (role) headers.Authorization = `Bearer ${secrets[role]}`;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return new Request(`https://transfer.example${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response) {
  return response.json();
}

function evidence(kind, observedAt = Date.now()) {
  return {
    kind,
    operationId: `ops-${kind}-operation-20260908`,
    checkVersion: "cf-test-v1",
    result: "pass",
    observedAt,
    evidenceRef: `fixture-${kind}`,
  };
}

async function makeFreshEvidence() {
  const now = Date.now();
  for (const kind of ["alarm", "watchdog", "log", "key", "deletion"]) {
    const response = await worker.fetch(request("/_ops/heartbeat", "POST", evidence(kind, now), "watchdog"), env);
    expect(response.status).toBe(200);
  }
  const billing = await worker.fetch(request("/_ops/billing", "POST", {
    operationId: "ops-billing-operation-20260908",
    checkVersion: "billing-test-v1",
    monthlyCostCents: 1,
    result: "observed",
    observedAt: now,
    evidenceRef: "fixture-billing",
  }, "billing"), env);
  expect(billing.status).toBe(200);
}

describe("authenticated operations boundary", () => {
  beforeEach(async () => {
    await reset();
  });

  it("scopes role credentials and keeps health private", async () => {
    const unauthenticated = await worker.fetch(request("/_ops/health", "GET"), env);
    expect(unauthenticated.status).toBe(404);
    const wrongRole = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("alarm"), "billing"), env);
    expect(wrongRole.status).toBe(404);
    const health = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    expect(health.status).toBe(200);
    expect(Object.keys(await json(health)).sort()).toEqual([
      "ackGeneration",
      "billingHealthy",
      "createsEnabled",
      "deletionHealthy",
      "incidentGeneration",
      "leaseFresh",
      "ok",
    ]);
  });

  it("rejects future and stale actual observations instead of laundering receipt time", async () => {
    const future = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("alarm", Date.now() + 61_000), "watchdog"), env);
    expect(future.status).toBe(503);
    const stale = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("alarm", Date.now() - 6 * 60_000), "watchdog"), env);
    expect(stale.status).toBe(503);
  });

  it("requires explicit current-generation acknowledgement and makes retries idempotent", async () => {
    await makeFreshEvidence();
    const before = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    const generation = (await json(before)).incidentGeneration;
    const ackBody = {
      operationId: "ops-ack-operation-20260908",
      generation,
      checkVersion: "ack-test-v1",
      proofNonce: "P".repeat(32),
      observedAt: Date.now(),
      evidenceRef: "fixture-ack",
    };
    const ack = await worker.fetch(request("/_ops/deletion-ack", "POST", ackBody, "ack"), env);
    expect(ack.status).toBe(200);
    expect(await json(ack)).toMatchObject({ ok: true, acknowledged: true });
    const retry = await worker.fetch(request("/_ops/deletion-ack", "POST", ackBody, "ack"), env);
    expect(retry.status).toBe(200);
    const health = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    expect(await json(health)).toMatchObject({ deletionHealthy: true, createsEnabled: true });
  });

  it("records a bounded purge receipt and does not expose its registry", async () => {
    const body = {
      operationId: "ops-purge-operation-20260908",
      checkVersion: "purge-test-v1",
      evidenceRef: "fixture-purge",
      limit: 10,
    };
    const wrongRole = await worker.fetch(request("/_ops/purge-due", "POST", body, "billing"), env);
    expect(wrongRole.status).toBe(404);
    const purge = await worker.fetch(request("/_ops/purge-due", "POST", body, "purge"), env);
    expect(purge.status).toBe(200);
    expect(await json(purge)).toMatchObject({ ok: true, examined: 0, purged: 0, failed: 0, remainingDue: 0 });
    const retry = await worker.fetch(request("/_ops/purge-due", "POST", body, "purge"), env);
    expect(retry.status).toBe(200);
  });

  it("latches later service deletion failures after a healthy acknowledgement", async () => {
    await makeFreshEvidence();
    const current = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    const generation = (await json(current)).incidentGeneration;
    await worker.fetch(request("/_ops/deletion-ack", "POST", {
      operationId: "ops-ack-operation-latch-20260908",
      generation,
      checkVersion: "ack-test-v1",
      proofNonce: "Q".repeat(32),
      observedAt: Date.now(),
      evidenceRef: "fixture-ack-latch",
    }, "ack"), env);
    await euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true }).markDeletionUnhealthy({ now: Date.now() });
    const positive = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("deletion", Date.now()), "watchdog"), env);
    expect(positive.status).toBe(200);
    const health = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    expect(await json(health)).toMatchObject({ deletionHealthy: false, createsEnabled: false });
  });
});
