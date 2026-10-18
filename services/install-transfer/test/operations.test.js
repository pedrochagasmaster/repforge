import { describe, expect, it } from "vitest";
import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { createsAreEnabled, operationalServiceHealth, serviceHealth } from "../src/operations.js";
import { euStub } from "../src/namespaces.js";

const key = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";

function healthyEnv(overrides = {}) {
  return {
    TRANSFER_ROUTING_KEY_B64: key,
    TRANSFER_TOKEN_MAC_KEY_ID: "k1",
    TRANSFER_TOKEN_MAC_KEY_B64: key,
    TRANSFER_DIGEST_KEY_B64: key,
    TRANSFER_RATE_PEPPER_B64: key,
    TRANSFER_ALLOWED_ORIGIN: "https://taurifer.example",
    TRANSFER_ALARM_HEALTH: "healthy",
    TRANSFER_WATCHDOG_HEALTH: "healthy",
    TRANSFER_LOG_HEALTH: "healthy",
    TRANSFER_KEY_HEALTH: "healthy",
    TRANSFER_DELETION_HEALTH: "healthy",
    TRANSFER_CREATES_ENABLED: "true",
    TRANSFER_KILL_SWITCH: "false",
    ...overrides,
  };
}

describe("create safety gate", () => {
  it("keeps creates disabled by default and exposes no configuration detail", () => {
    expect(serviceHealth({})).toEqual({
      configurationReady: false,
      operationalHealth: false,
      createsEnabled: false,
      killSwitch: false,
    });
    expect(createsAreEnabled({})).toBe(false);
  });

  it("requires every static health flag independently", () => {
    expect(serviceHealth(healthyEnv())).toMatchObject({ configurationReady: true, operationalHealth: true, createsEnabled: false });
    for (const flag of ["TRANSFER_ALARM_HEALTH", "TRANSFER_WATCHDOG_HEALTH", "TRANSFER_LOG_HEALTH", "TRANSFER_KEY_HEALTH", "TRANSFER_DELETION_HEALTH"]) {
      for (const value of [undefined, "unknown", "unhealthy"]) {
        expect(serviceHealth(healthyEnv({ [flag]: value })).operationalHealth, `${flag}=${value}`).toBe(false);
      }
    }
  });

  it("applies health and operator vetoes after a real fresh lease has enabled creates", async () => {
    await reset();
    const now = Date.now();
    const target = healthyEnv({ TRANSFER_HEALTH: env.TRANSFER_HEALTH, TRANSFER_LOCAL_TEST_EU: "true" });
    const health = euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
    await health.markDeletionUnhealthy({ now });
    for (const kind of ["alarm", "watchdog", "log", "key"]) await health.recordHeartbeat({ kind, observedAt: now, now });
    await health.recordDeletionHealth({ healthy: true, observedAt: now, now });
    await health.recordBilling({ monthlyCostCents: 1, observedAt: now, now });
    const snapshot = await health.snapshot({ now });
    await health.acknowledgeDeletion({ generation: snapshot.incidentGeneration, proofNonce: "O".repeat(32), now });
    expect(await operationalServiceHealth(target, { now })).toMatchObject({ operationalHealth: true, createsEnabled: true });

    for (const [flag, value] of [
      ["TRANSFER_ALARM_HEALTH", "unknown"], ["TRANSFER_WATCHDOG_HEALTH", "unknown"],
      ["TRANSFER_LOG_HEALTH", "unknown"], ["TRANSFER_KEY_HEALTH", "unknown"],
      ["TRANSFER_DELETION_HEALTH", "unknown"], ["TRANSFER_KILL_SWITCH", "true"],
      ["TRANSFER_CREATES_ENABLED", "false"], ["TRANSFER_HEALTH", undefined],
    ]) {
      expect((await operationalServiceHealth({ ...target, [flag]: value }, { now })).createsEnabled, flag).toBe(false);
    }
  });
});
