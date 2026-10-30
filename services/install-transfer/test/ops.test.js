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

function evidence(kind, observedAt = Date.now(), result = "pass") {
  return {
    kind,
    operationId: `ops-${kind}-operation-20260908`,
    checkVersion: "cf-test-v1",
    result,
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
      "lastDeletionCheck",
      "leaseFresh",
      "ok",
    ]);
  });

  it("accepts a failed deletion heartbeat's path and error class only from the closed lists", async () => {
    const now = Date.now();
    const failed = { ...evidence("deletion", now, "fail"), failurePath: "provider-list", errorClass: "rejected" };
    for (const invalid of [
      { ...failed, failurePath: "internal" },
      { ...failed, failurePath: "somewhere-else" },
      { ...failed, errorClass: "token=abc" },
      { ...evidence("deletion", now, "fail"), failurePath: "provider-list" },
      { ...evidence("deletion", now, "pass"), failurePath: "provider-list", errorClass: "rejected" },
      { ...evidence("alarm", now), failurePath: "provider-list", errorClass: "rejected" },
    ]) {
      const response = await worker.fetch(request("/_ops/heartbeat", "POST", invalid, "watchdog"), env);
      expect(response.status).not.toBe(200);
    }
    const accepted = await worker.fetch(request("/_ops/heartbeat", "POST", failed, "watchdog"), env);
    expect(accepted.status).toBe(200);
    const health = await json(await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env));
    expect(health.lastDeletionCheck).toEqual({
      checkVersion: "cf-test-v1",
      observedAt: now,
      result: "fail",
      path: "provider-list",
      errorClass: "rejected",
      consecutiveFailures: 1,
    });
  });

  it("reports operator dependency failure as unavailable instead of rate limiting", async () => {
    const brokenEnv = new Proxy(env, {
      get(target, property, receiver) {
        if (property === "TRANSFER_HEALTH") return undefined;
        return Reflect.get(target, property, receiver);
      },
    });
    const response = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), brokenEnv);
    expect(response.status).toBe(503);
    expect(await json(response)).toEqual({ state: "unavailable" });
  });

  it("maps EU namespace construction failures to a generic unavailable response", async () => {
    const brokenHealth = new Proxy(env, {
      get(target, property, receiver) {
        if (property === "TRANSFER_HEALTH") return { jurisdiction: () => { throw new Error("EU routing unavailable"); } };
        return Reflect.get(target, property, receiver);
      },
    });
    const healthResponse = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), brokenHealth);
    expect(healthResponse.status).toBe(503);
    expect(await json(healthResponse)).toEqual({ state: "unavailable" });

    const brokenRegistry = new Proxy(env, {
      get(target, property, receiver) {
        if (property === "TRANSFER_REGISTRY") return { jurisdiction: () => { throw new Error("EU routing unavailable"); } };
        return Reflect.get(target, property, receiver);
      },
    });
    const purgeResponse = await worker.fetch(request("/_ops/purge-due", "POST", {
      operationId: "ops-purge-jurisdiction-20260908",
      checkVersion: "purge-test-v1",
      evidenceRef: "fixture-jurisdiction",
      limit: 1,
    }, "purge"), brokenRegistry);
    expect(purgeResponse.status).toBe(503);
    expect(await json(purgeResponse)).toEqual({ state: "unavailable" });

    const objectId = env.TRANSFER_OBJECTS.idFromName("ops-jurisdiction-failure").toString();
    const brokenObjects = new Proxy(env, {
      get(target, property, receiver) {
        if (property === "TRANSFER_OBJECTS") return { jurisdiction: () => { throw new Error("EU routing unavailable"); } };
        return Reflect.get(target, property, receiver);
      },
    });
    const objectResponse = await worker.fetch(request("/_ops/purge-objects", "POST", {
      operationId: "ops-purge-objects-jurisdiction-20260908",
      objectIds: [objectId],
    }, "purge"), brokenObjects);
    expect(objectResponse.status).toBe(503);
    expect(await json(objectResponse)).toEqual({ state: "unavailable" });
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

  function flakyObjects(errorFor) {
    const calls = [];
    const namespace = {
      idFromString: (id) => id,
      get: (id) => ({
        async purgeDue() {
          calls.push(id);
          const error = errorFor(id, calls.filter((call) => call === id).length);
          if (error) throw error;
          return { purged: true };
        },
      }),
    };
    return { calls, objects: { jurisdiction: () => namespace } };
  }

  const platformError = (fields) => Object.assign(new Error("Durable Object reset because its code was updated."), fields);

  it("retries an object purge once when the platform marks the error retryable", async () => {
    const ids = ["c".repeat(64), "d".repeat(64)];
    const { calls, objects } = flakyObjects((_id, attempt) => (attempt === 1 ? platformError({ retryable: true }) : null));
    const before = await json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
    const response = await worker.fetch(request("/_ops/purge-objects", "POST", {
      operationId: "ops-purge-objects-retryable-20261030",
      objectIds: ids,
    }, "purge"), { ...env, TRANSFER_OBJECTS: objects });
    expect(await json(response)).toEqual({ examined: 2, purged: 2, deferred: 0, failed: 0 });
    expect(calls).toEqual([ids[0], ids[0], ids[1], ids[1]]);
    const after = await json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
    expect(after.incidentGeneration).toBe(before.incidentGeneration);
  });

  it("counts an overloaded, non-retryable or repeated failure as failed and records it", async () => {
    for (const [index, errorFor] of [
      () => platformError({ retryable: true, overloaded: true }),
      () => platformError({}),
      (_id, attempt) => platformError({ retryable: attempt <= 2 }),
    ].entries()) {
      const { calls, objects } = flakyObjects(errorFor);
      const before = await json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
      const response = await worker.fetch(request("/_ops/purge-objects", "POST", {
        operationId: `ops-purge-objects-failing-${index}-20261030`,
        objectIds: ["e".repeat(64)],
      }, "purge"), { ...env, TRANSFER_OBJECTS: objects });
      expect(await json(response)).toEqual({ examined: 1, purged: 0, deferred: 0, failed: 1 });
      expect(calls).toHaveLength(index === 2 ? 2 : 1);
      const after = await json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
      expect(after.incidentGeneration).toBe(before.incidentGeneration + 1);
      expect(after.lastDeletionFailure).toEqual({
        actor: "purge",
        checkVersion: "provider-enumeration-v1",
        observedAt: expect.any(Number),
        evidenceKind: "object-batch",
      });
    }
  });

  it("counts retried provider steps by path, class and outcome without touching deletion health", async () => {
    const read = async () => json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
    const before = await read();
    expect(before.providerRetries).toBeNull();
    const at = Date.now();
    const retry = (operationId, fields = {}) => ({ operationId, failurePath: "provider-list", errorClass: "rejected", outcome: "recovered", observedAt: at, ...fields });
    for (const invalid of [
      retry("ops-retry-invalid-operation-1", { failurePath: "registry-purge" }),
      retry("ops-retry-invalid-operation-2", { errorClass: "token=abc" }),
      retry("ops-retry-invalid-operation-3", { outcome: "latched" }),
      { ...retry("ops-retry-invalid-operation-4"), extra: 1 },
    ]) {
      expect((await worker.fetch(request("/_ops/provider-retry", "POST", invalid, "watchdog"), env)).status).not.toBe(200);
    }
    expect((await worker.fetch(request("/_ops/provider-retry", "POST", retry("ops-retry-wrong-role-operation"), "purge"), env)).status).toBe(404);
    for (const body of [
      retry("ops-retry-recovered-operation-1"),
      retry("ops-retry-recovered-operation-1"),
      retry("ops-retry-recovered-operation-2"),
      retry("ops-retry-failed-operation-1", { failurePath: "provider-purge", errorClass: "request-failed", outcome: "failed", observedAt: at + 1 }),
    ]) {
      expect((await worker.fetch(request("/_ops/provider-retry", "POST", body, "watchdog"), env)).status).toBe(200);
    }
    const after = await read();
    expect(after.providerRetries).toEqual({
      since: at,
      lastAt: at + 1,
      total: 3,
      recovered: 2,
      counts: [
        { path: "provider-list", errorClass: "rejected", outcome: "recovered", count: 2, lastAt: at },
        { path: "provider-purge", errorClass: "request-failed", outcome: "failed", count: 1, lastAt: at + 1 },
      ],
    });
    expect(after.incidentGeneration).toBe(before.incidentGeneration);
  });

  it("reports the failure that raised the current generation until it is acknowledged", async () => {
    const anonymous = await worker.fetch(request("/_ops/deletion-evidence", "GET"), env);
    expect(anonymous.status).toBe(404);
    const posted = await worker.fetch(request("/_ops/deletion-evidence", "POST", {}, "watchdog"), env);
    expect(posted.status).toBe(404);

    const failedAt = Date.now();
    const failed = await worker.fetch(request("/_ops/heartbeat", "POST", { ...evidence("deletion", failedAt, "fail"), checkVersion: "provider-enumeration-failure-v1", evidenceRef: "provider-enumeration-failed" }, "watchdog"), env);
    expect(failed.status).toBe(200);
    const expected = { actor: "watchdog", checkVersion: "provider-enumeration-failure-v1", observedAt: failedAt, evidenceKind: "provider-enumeration-failed" };
    const read = async () => json(await worker.fetch(request("/_ops/deletion-evidence", "GET", undefined, "watchdog"), env));
    const latched = await read();
    expect(Object.keys(latched).sort()).toEqual(["ackGeneration", "incidentGeneration", "lastDeletionFailure", "ok", "providerRetries"]);
    expect(latched.lastDeletionFailure).toEqual(expected);

    // Later passing checks do not overwrite it while the incident is open.
    await makeFreshEvidence();
    expect((await read()).lastDeletionFailure).toEqual(expected);

    const ack = await worker.fetch(request("/_ops/deletion-ack", "POST", {
      operationId: "ops-evidence-ack-operation-20261030",
      generation: latched.incidentGeneration,
      checkVersion: "ack-test-v1",
      proofNonce: "Q".repeat(32),
      observedAt: Date.now(),
      evidenceRef: "fixture-ack",
    }, "ack"), env);
    expect(ack.status).toBe(200);
    expect((await read()).lastDeletionFailure).toBeNull();
  });

  it("purges only fixed-namespace object IDs and returns counts without identifiers", async () => {
    const objectId = env.TRANSFER_OBJECTS.idFromName("ops-object-purge-empty").toString();
    const body = {
      operationId: "ops-purge-objects-20260908",
      objectIds: [objectId],
    };
    const wrongRole = await worker.fetch(request("/_ops/purge-objects", "POST", body, "watchdog"), env);
    expect(wrongRole.status).toBe(404);
    const response = await worker.fetch(request("/_ops/purge-objects", "POST", body, "purge"), env);
    expect(response.status).toBe(200);
    const value = await json(response);
    expect(value).toEqual({ examined: 1, purged: 1, deferred: 0, failed: 0 });
    expect(JSON.stringify(value)).not.toContain(objectId);
    const duplicate = await worker.fetch(request("/_ops/purge-objects", "POST", {
      ...body,
      objectIds: [objectId, objectId],
    }, "purge"), env);
    expect(duplicate.status).toBe(404);
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
    const failed = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("deletion", Date.now(), "fail"), "watchdog"), env);
    expect(failed.status).toBe(200);
    const positive = await worker.fetch(request("/_ops/heartbeat", "POST", evidence("deletion", Date.now()), "watchdog"), env);
    expect(positive.status).toBe(200);
    const health = await worker.fetch(request("/_ops/health", "GET", undefined, "watchdog"), env);
    expect(await json(health)).toMatchObject({ deletionHealthy: false, createsEnabled: false });
  });
});
