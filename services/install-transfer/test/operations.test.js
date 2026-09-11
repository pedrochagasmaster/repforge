import { describe, expect, it } from "vitest";
import { createsAreEnabled, serviceHealth } from "../src/operations.js";

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

  it("requires every health flag and the explicit operator enablement", () => {
    expect(serviceHealth(healthyEnv())).toMatchObject({ configurationReady: true, operationalHealth: true, createsEnabled: false });
    expect(serviceHealth(healthyEnv({ TRANSFER_DELETION_HEALTH: "unknown" })).createsEnabled).toBe(false);
    expect(serviceHealth(healthyEnv({ TRANSFER_KILL_SWITCH: "true" }))).toMatchObject({ killSwitch: true, createsEnabled: false });
    expect(serviceHealth(healthyEnv({ TRANSFER_CREATES_ENABLED: "false" })).createsEnabled).toBe(false);
  });
});
