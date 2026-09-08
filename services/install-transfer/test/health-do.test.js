import { env } from "cloudflare:workers";
import { reset, runInDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BILLING_EVIDENCE_MAX_AGE_MS,
  CREATE_COST_THRESHOLD_CENTS,
  HEALTH_SIGNAL_MAX_AGE_MS,
} from "../src/health-do.js";
import { euStub } from "../src/namespaces.js";

const now = Date.now();

async function healthStub() {
  return euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
}

async function recordHealthy(stub, at = now) {
  await stub.markDeletionUnhealthy({ observedAt: at, now: at });
  for (const kind of ["alarm", "watchdog", "log", "key"]) {
    await stub.recordHeartbeat({ kind, observedAt: at, now: at });
  }
  await stub.recordDeletionHealth({ healthy: true, observedAt: at, now: at });
  await stub.recordBilling({ monthlyCostCents: CREATE_COST_THRESHOLD_CENTS - 1, observedAt: at, now: at });
  const snapshot = await stub.snapshot({ now: at });
  await stub.acknowledgeDeletion({
    generation: snapshot.incidentGeneration,
    proofNonce: "A".repeat(32),
    observedAt: at,
    now: at,
  });
}

async function expectAckFailure(stub, value) {
  const result = await runInDurableObject(stub, async (instance) => {
    try {
      await instance.acknowledgeDeletion(value);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  });
  expect(result.ok).toBe(false);
}

describe("fresh create health lease", () => {
  beforeEach(async () => {
    await reset();
  });

  it("requires fresh watchdog evidence and a current billing observation", async () => {
    const stub = await healthStub();
    await recordHealthy(stub);
    await expect(stub.snapshot({ now })).resolves.toMatchObject({
      leaseFresh: true,
      deletionHealthy: true,
      billingHealthy: true,
      createsEnabled: true,
      incidentGeneration: expect.any(Number),
      ackGeneration: expect.any(Number),
    });

    await expect(stub.snapshot({ now: now + HEALTH_SIGNAL_MAX_AGE_MS + 1 })).resolves.toMatchObject({
      leaseFresh: false,
      createsEnabled: false,
    });

    await recordHealthy(stub, now + HEALTH_SIGNAL_MAX_AGE_MS + 2);
    await expect(stub.recordBilling({
      monthlyCostCents: CREATE_COST_THRESHOLD_CENTS,
      observedAt: now + HEALTH_SIGNAL_MAX_AGE_MS + 2,
      now: now + HEALTH_SIGNAL_MAX_AGE_MS + 2,
      operationId: "billing-threshold-operation",
    })).resolves.toMatchObject({ billingHealthy: false, createsEnabled: false });

    await recordHealthy(stub, now + HEALTH_SIGNAL_MAX_AGE_MS + 3);
    await expect(stub.snapshot({ now: now + BILLING_EVIDENCE_MAX_AGE_MS + HEALTH_SIGNAL_MAX_AGE_MS + 4 })).resolves.toMatchObject({
      billingHealthy: false,
      createsEnabled: false,
    });
  });

  it("keeps a deletion incident latched until one current proof is acknowledged", async () => {
    const stub = await healthStub();
    const at = Date.now();
    await recordHealthy(stub, at);
    await stub.markDeletionUnhealthy({ observedAt: at + 1, now: at + 1 });
    const incident = await stub.snapshot({ now: at + 1 });
    await stub.recordDeletionHealth({ healthy: true, observedAt: at + 2, now: at + 2 });
    await expect(stub.snapshot({ now: at + 2 })).resolves.toMatchObject({
      deletionHealthy: false,
      createsEnabled: false,
      incidentGeneration: incident.incidentGeneration,
    });
    await expectAckFailure(stub, {
      generation: incident.incidentGeneration - 1,
      proofNonce: "C".repeat(32),
      observedAt: at + 3,
      now: at + 3,
    });
    await expectAckFailure(stub, {
      generation: incident.incidentGeneration,
      proofNonce: "short",
      observedAt: at + 3,
      now: at + 3,
    });
    await expect(stub.acknowledgeDeletion({
      generation: incident.incidentGeneration,
      proofNonce: "D".repeat(32),
      observedAt: at + 4,
      now: at + 4,
    })).resolves.toMatchObject({ deletionHealthy: true });
    await expectAckFailure(stub, {
      generation: incident.incidentGeneration,
      proofNonce: "E".repeat(32),
      observedAt: at + 5,
      now: at + 5,
    });
    await stub.markDeletionUnhealthy({ observedAt: at + 6, now: at + 6 });
    await expectAckFailure(stub, {
      generation: incident.incidentGeneration,
      proofNonce: "F".repeat(32),
      observedAt: at + 7,
      now: at + 7,
    });
  });

  it("rolls back the acknowledgement state when evidence persistence fails", async () => {
    const stub = await healthStub();
    const at = Date.now();
    await stub.markDeletionUnhealthy({ observedAt: at, now: at });
    const incident = await stub.snapshot({ now: at });
    const result = await runInDurableObject(stub, async (instance) => {
      const original = instance._insertEvidence;
      instance._insertEvidence = () => { throw new Error("injected evidence write failure"); };
      try {
        await instance.acknowledgeDeletion({
          generation: incident.incidentGeneration,
          proofNonce: "R".repeat(32),
          operationId: "ack-write-failure-20260908",
          observedAt: at + 1,
          now: at + 1,
        });
        return { ok: true };
      } catch {
        instance._insertEvidence = original;
        return { ok: false };
      }
    });
    expect(result).toEqual({ ok: false });
    await expect(stub.snapshot({ now: at + 1 })).resolves.toMatchObject({
      deletionHealthy: false,
      ackGeneration: 0,
      incidentGeneration: incident.incidentGeneration,
    });
    await expect(stub.acknowledgeDeletion({
      generation: incident.incidentGeneration,
      proofNonce: "S".repeat(32),
      operationId: "ack-write-recovery-20260908",
      observedAt: at + 2,
      now: at + 2,
    })).resolves.toMatchObject({ deletionHealthy: true });
  });

  it("rolls back failure evidence when the incident row update fails", async () => {
    const stub = await healthStub();
    const at = Date.now();
    await stub.markDeletionUnhealthy({
      observedAt: at,
      now: at,
      operationId: "delete-failure-baseline",
    });
    const before = await runInDurableObject(stub, (_instance, state) => ({
      row: state.storage.sql.exec("SELECT deletion_at, incident_generation FROM transfer_health WHERE singleton = 1").toArray()[0],
      evidence: state.storage.sql.exec("SELECT operation_id, result FROM transfer_health_evidence WHERE kind = 'deletion'").toArray()[0],
    }));
    const result = await runInDurableObject(stub, async (instance) => {
      const original = instance._execWrite;
      instance._execWrite = function patched(sql, ...args) {
        if (sql.includes("SET deletion_at")) throw new Error("injected incident row update failure");
        return original.call(this, sql, ...args);
      };
      try {
        await instance.recordDeletionHealth({
          healthy: false,
          observedAt: at + 1,
          now: at + 1,
          operationId: "delete-failure-injected",
        });
        return { ok: true };
      } catch {
        instance._execWrite = original;
        return { ok: false };
      }
    });
    expect(result).toEqual({ ok: false });
    const after = await runInDurableObject(stub, (_instance, state) => ({
      row: state.storage.sql.exec("SELECT deletion_at, incident_generation FROM transfer_health WHERE singleton = 1").toArray()[0],
      evidence: state.storage.sql.exec("SELECT operation_id, result FROM transfer_health_evidence WHERE kind = 'deletion'").toArray()[0],
    }));
    expect(after).toEqual(before);
    await expect(stub.recordDeletionHealth({
      healthy: true,
      observedAt: at + 2,
      now: at + 2,
      operationId: "delete-positive-after-failure",
    })).resolves.toMatchObject({ deletionHealthy: false });
  });
});
