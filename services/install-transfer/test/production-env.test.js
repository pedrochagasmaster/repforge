import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import wranglerSource from "../wrangler.jsonc?raw";
import contract from "../../../install-transfer-contract.js";
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";
import { operationalServiceHealth, serviceHealth } from "../src/operations.js";

// The deployed production vars, read from the same file `wrangler deploy --env
// production` uses. Secrets still come from the test bindings.
const production = JSON.parse(wranglerSource).env.production;
const origin = "https://taurifer.com";

function productionEnv(overrides = {}) {
  const value = Object.create(env);
  Object.assign(value, production.vars, { TRANSFER_LOCAL_TEST_EU: "true" }, overrides);
  return value;
}

async function makeEnvelope() {
  const value = {
    kind: "taurifer-install-transfer",
    schemaVersion: 1,
    createdAt: "2026-10-14T09:00:00.000Z",
    source: { context: "browser", logicalInstallationId: "li-production" },
    sourceRevision: 1,
    durableState: { settings: {}, programMeta: {}, program: [], log: [], programHistory: [], customExercises: [] },
    workoutDraft: null,
    programEntryDraft: null,
    uiPreferences: {},
    analytics: { enabled: false },
    telemetryIdentity: { schemaVersion: 1, installationId: "telemetry-production", createdAt: "2026-08-01T10:00:00.000Z" },
    integrity: { canonicalPayloadHash: "" },
  };
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(contract.canonicalJson({ ...value, integrity: {} })),
  ));
  value.integrity.canonicalPayloadHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return value;
}

/** What the owner-attested health loop submits every two minutes. */
async function attestLease(target) {
  const now = Date.now();
  const stub = euStub(target.TRANSFER_HEALTH, "global", { allowLocalFallback: true });
  await stub.markDeletionUnhealthy({ now });
  for (const kind of ["alarm", "watchdog", "log", "key"]) await stub.recordHeartbeat({ kind, observedAt: now, now });
  await stub.recordDeletionHealth({ healthy: true, observedAt: now, now });
  await stub.recordBilling({ monthlyCostCents: 0, observedAt: now, now });
  const snapshot = await stub.snapshot({ now });
  await stub.acknowledgeDeletion({ generation: snapshot.incidentGeneration, proofNonce: "P".repeat(32), now });
}

function create(target, body, requestOrigin = origin) {
  return worker.fetch(new Request("https://taurifer.com/v1/transfers", {
    method: "POST",
    headers: {
      Origin: requestOrigin,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "CF-Connecting-IP": "198.51.100.14",
    },
    body: JSON.stringify(body),
  }), target);
}

describe("production environment configuration", () => {
  beforeEach(async () => {
    await reset();
  });

  it("is ready for creates only from https://taurifer.com, with the kill switch off", () => {
    const target = productionEnv();
    expect(production.vars.TRANSFER_ALLOWED_ORIGIN).toBe(origin);
    expect(serviceHealth(target)).toMatchObject({ configurationReady: true, operationalHealth: true, killSwitch: false });
    expect("TRANSFER_LOCAL_TEST_EU" in production.vars).toBe(false);
  });

  it("answers the taurifer.com preflight and refuses every other origin generically", async () => {
    const target = productionEnv();
    const preflight = await worker.fetch(new Request("https://taurifer.com/v1/transfers", {
      method: "OPTIONS",
      headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    }), target);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);

    for (const other of ["https://ui-overhaul-053-ios-install.taurifer.pages.dev", "https://www.taurifer.com", "http://taurifer.com"]) {
      const response = await worker.fetch(new Request("https://taurifer.com/v1/transfers", {
        method: "OPTIONS",
        headers: { Origin: other, "Access-Control-Request-Method": "POST" },
      }), target);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ state: "unavailable" });
    }
  });

  it("creates with a fresh lease, and the kill switch or a lapsed lease turns creates off", async () => {
    const target = productionEnv();
    const envelope = await makeEnvelope();
    const withoutLease = await create(target, { envelope, idempotencyKey: "production-no-lease-0001" });
    expect(withoutLease.status).toBe(503);
    expect((await operationalServiceHealth(target)).createsEnabled).toBe(false);

    await attestLease(target);
    expect((await operationalServiceHealth(target)).createsEnabled).toBe(true);
    const created = await create(target, { envelope, idempotencyKey: "production-lease-0001" });
    expect(created.status).toBe(201);

    const killed = productionEnv({ TRANSFER_KILL_SWITCH: "true" });
    const refused = await create(killed, { envelope, idempotencyKey: "production-killed-0001" });
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ state: "unavailable" });

    const disabled = productionEnv({ TRANSFER_CREATES_ENABLED: "false" });
    expect((await create(disabled, { envelope, idempotencyKey: "production-disabled-0001" })).status).toBe(503);

    const malformed = await create(target, { envelope: { kind: "not-a-transfer" }, idempotencyKey: "production-malformed-0001" });
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect(await malformed.json()).toEqual({ state: "unavailable" });
  });

  it("never falls back to a non-EU namespace: without the local test adapter the create fails closed", async () => {
    const target = productionEnv();
    await attestLease(target);
    const deployed = productionEnv({ TRANSFER_LOCAL_TEST_EU: undefined });
    const response = await create(deployed, { envelope: await makeEnvelope(), idempotencyKey: "production-eu-0001" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ state: "unavailable" });
  });
});
