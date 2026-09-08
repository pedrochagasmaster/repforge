import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  BILLING_EVIDENCE_MAX_AGE_MS,
  CREATE_COST_THRESHOLD_CENTS,
  HEALTH_SIGNAL_MAX_AGE_MS,
} from "../src/health-do.js";
import { euStub } from "../src/namespaces.js";

const now = Date.now();

async function healthStub() {
  return euStub(env.TRANSFER_HEALTH, "global");
}

async function recordHealthy(stub, at = now) {
  for (const kind of ["alarm", "watchdog", "log", "key"]) {
    await stub.recordHeartbeat({ kind, observedAt: at, now: at });
  }
  await stub.recordDeletionHealth({ healthy: true, observedAt: at, now: at });
  await stub.recordBilling({ monthlyCostCents: CREATE_COST_THRESHOLD_CENTS - 1, observedAt: at, now: at });
}

describe("fresh create health lease", () => {
  it("requires fresh watchdog evidence and a current billing observation", async () => {
    const stub = await healthStub();
    await recordHealthy(stub);
    await expect(stub.snapshot({ now })).resolves.toEqual({
      leaseFresh: true,
      deletionHealthy: true,
      billingHealthy: true,
      createsEnabled: true,
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
    })).resolves.toMatchObject({ billingHealthy: false, createsEnabled: false });

    await recordHealthy(stub, now + HEALTH_SIGNAL_MAX_AGE_MS + 3);
    await expect(stub.snapshot({ now: now + BILLING_EVIDENCE_MAX_AGE_MS + HEALTH_SIGNAL_MAX_AGE_MS + 4 })).resolves.toMatchObject({
      billingHealthy: false,
      createsEnabled: false,
    });
  });
});
