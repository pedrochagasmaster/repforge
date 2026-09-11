export const OBSERVATION_CLOCK_SKEW_MS = 60 * 1000;
export const OBSERVATION_HEALTH_MAX_AGE_MS = 5 * 60 * 1000;
export const OBSERVATION_BILLING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const HEALTH_KINDS = ["alarm", "watchdog", "log", "key", "deletion"];
const SOURCES = new Set(["cloudflare-runtime", "owner-watchdog", "owner-billing-receipt", "test-fixture"]);
const CHECK_VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/u;
const EVIDENCE_REF_RE = /^[A-Za-z0-9_-]{1,128}$/u;

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validTime(value, now, maxAge) {
  return Number.isSafeInteger(value)
    && value >= 0
    && value <= now + OBSERVATION_CLOCK_SKEW_MS
    && value >= now - maxAge - OBSERVATION_CLOCK_SKEW_MS;
}

function observation(value, now, maxAge, expectedResult, allowedSources, name) {
  if (!exactKeys(value, ["source", "observedAt", "checkVersion", "result", "evidenceRef"])) throw new TypeError(`${name} shape is invalid`);
  if (typeof value.source !== "string" || !SOURCES.has(value.source) || !allowedSources.has(value.source)) throw new TypeError(`${name} source is invalid`);
  if (!validTime(value.observedAt, now, maxAge)) throw new RangeError(`${name} observation is stale or in the future`);
  if (typeof value.checkVersion !== "string" || !CHECK_VERSION_RE.test(value.checkVersion)) throw new TypeError(`${name} checkVersion is invalid`);
  if (value.result !== expectedResult) throw new TypeError(`${name} result is invalid`);
  if (typeof value.evidenceRef !== "string" || !EVIDENCE_REF_RE.test(value.evidenceRef)) throw new TypeError(`${name} evidenceRef is invalid`);
  return { ...value };
}

function allowedSources(kind, allowTestFixture) {
  const result = kind === "health"
    ? new Set(["cloudflare-runtime", "owner-watchdog"])
    : new Set(["owner-billing-receipt"]);
  if (allowTestFixture) {
    result.add("test-fixture");
  }
  return result;
}

export function parseProviderHealthObservation(value, { now = Date.now(), allowTestFixture = false } = {}) {
  if (!exactKeys(value, ["schemaVersion", "health"]) || value.schemaVersion !== 1) {
    throw new TypeError("provider health observation schema is invalid");
  }
  if (!exactKeys(value.health, HEALTH_KINDS)) throw new TypeError("provider health observations are incomplete");
  const sources = allowedSources("health", allowTestFixture);
  return {
    schemaVersion: 1,
    health: Object.fromEntries(HEALTH_KINDS.map((kind) => [
      kind,
      observation(value.health[kind], now, OBSERVATION_HEALTH_MAX_AGE_MS, "pass", sources, kind),
    ])),
  };
}

export function parseBillingObservation(value, { now = Date.now(), allowTestFixture = false } = {}) {
  if (!exactKeys(value, ["source", "observedAt", "checkVersion", "result", "evidenceRef", "monthlyCostCents"])) {
    throw new TypeError("billing observation shape is invalid");
  }
  const { monthlyCostCents, ...billingEvidence } = value;
  const billing = { ...observation(billingEvidence, now, OBSERVATION_BILLING_MAX_AGE_MS, "observed", allowedSources("billing", allowTestFixture), "billing"), monthlyCostCents };
  if (!Number.isSafeInteger(billing.monthlyCostCents) || billing.monthlyCostCents < 0) {
    throw new TypeError("billing monthly cost is invalid");
  }
  return billing;
}

export function parseProviderObservation(value, { now = Date.now(), allowTestFixture = false } = {}) {
  if (!exactKeys(value, ["schemaVersion", "health", "billing"]) || value.schemaVersion !== 1) {
    throw new TypeError("provider observation schema is invalid");
  }
  const health = parseProviderHealthObservation(
    { schemaVersion: value.schemaVersion, health: value.health },
    { now, allowTestFixture },
  );
  return {
    ...health,
    billing: parseBillingObservation(value.billing, { now, allowTestFixture }),
  };
}
