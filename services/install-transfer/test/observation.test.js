import { describe, expect, it } from "vitest";
import {
  OBSERVATION_BILLING_MAX_AGE_MS,
  OBSERVATION_HEALTH_MAX_AGE_MS,
  parseProviderObservation,
} from "../src/observation.js";

const now = 1_800_000_000_000;

function health(source = "cloudflare-runtime", observedAt = now) {
  return {
    source,
    observedAt,
    checkVersion: "provider-v1",
    result: "pass",
    evidenceRef: "health-check",
  };
}

function validObservation(overrides = {}) {
  const healthKinds = ["alarm", "watchdog", "log", "key", "deletion"];
  return {
    schemaVersion: 1,
    health: Object.fromEntries(healthKinds.map((kind) => [kind, health()])),
    billing: {
      source: "owner-billing-receipt",
      observedAt: now,
      checkVersion: "billing-v1",
      result: "observed",
      evidenceRef: "monthly-receipt",
      monthlyCostCents: 100,
    },
    ...overrides,
  };
}

describe("provider observation boundary", () => {
  it("accepts complete runtime health and owner billing evidence", () => {
    expect(parseProviderObservation(validObservation(), { now })).toMatchObject({
      schemaVersion: 1,
      billing: { monthlyCostCents: 100, source: "owner-billing-receipt" },
    });
  });

  it("rejects omitted health kinds and ambiguous sources", () => {
    const missing = validObservation();
    delete missing.health.key;
    expect(() => parseProviderObservation(missing, { now })).toThrow(/incomplete/iu);

    const ambiguous = validObservation();
    ambiguous.health.alarm.source = "owner-billing-receipt";
    expect(() => parseProviderObservation(ambiguous, { now })).toThrow(/source/iu);
  });

  it("rejects observations outside their actual observation windows", () => {
    const future = validObservation();
    future.health.alarm.observedAt = now + 60_001;
    expect(() => parseProviderObservation(future, { now })).toThrow(/stale or in the future/iu);

    const stale = validObservation();
    stale.billing.observedAt = now - OBSERVATION_BILLING_MAX_AGE_MS - 60_001;
    expect(() => parseProviderObservation(stale, { now })).toThrow(/stale or in the future/iu);

    const nearExpiry = validObservation();
    nearExpiry.health.alarm.observedAt = now - OBSERVATION_HEALTH_MAX_AGE_MS - 60_000;
    expect(() => parseProviderObservation(nearExpiry, { now })).not.toThrow();
  });

  it("requires explicit test opt-in for fixture evidence", () => {
    const fixture = validObservation();
    fixture.health = Object.fromEntries(
      Object.entries(fixture.health).map(([kind, value]) => [kind, { ...value, source: "test-fixture" }]),
    );
    fixture.billing.source = "test-fixture";
    expect(() => parseProviderObservation(fixture, { now })).toThrow(/source/iu);
    expect(parseProviderObservation(fixture, { now, allowTestFixture: true })).toMatchObject({ schemaVersion: 1 });
  });

  it("does not accept provider supplied cost without a bounded receipt", () => {
    const value = validObservation();
    value.billing.monthlyCostCents = -1;
    expect(() => parseProviderObservation(value, { now })).toThrow(/monthly cost/iu);

    const extra = validObservation();
    extra.billing.receiptToken = "should-not-be-accepted";
    expect(() => parseProviderObservation(extra, { now })).toThrow(/shape/iu);
  });
});
