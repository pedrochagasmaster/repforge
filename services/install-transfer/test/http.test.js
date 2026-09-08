import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import contract from "../../../install-transfer-contract.js";
import worker from "../src/index.js";
import { euStub } from "../src/namespaces.js";

const origin = "https://taurifer.example";
let envelope;

async function makeEnvelope() {
  const value = {
    kind: "taurifer-install-transfer",
    schemaVersion: 1,
    createdAt: "2026-10-01T09:00:00.000Z",
    source: { context: "browser", logicalInstallationId: "li-http" },
    sourceRevision: 1,
    durableState: {
      settings: {},
      programMeta: {},
      program: [],
      log: [],
      programHistory: [],
      customExercises: [],
    },
    workoutDraft: null,
    programEntryDraft: null,
    uiPreferences: {},
    analytics: { enabled: false },
    telemetryIdentity: {
      schemaVersion: 1,
      installationId: "telemetry-http",
      createdAt: "2026-08-01T10:00:00.000Z",
    },
    integrity: { canonicalPayloadHash: "" },
  };
  const preimage = { ...value, integrity: {} };
  const digest = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(contract.canonicalJson(preimage)),
  ));
  value.integrity.canonicalPayloadHash = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return value;
}

async function makeHealthFresh() {
  const now = Date.now();
  const stub = euStub(env.TRANSFER_HEALTH, "global");
  for (const kind of ["alarm", "watchdog", "log", "key"]) {
    await stub.recordHeartbeat({ kind, observedAt: now, now });
  }
  await stub.recordDeletionHealth({ healthy: true, observedAt: now, now });
  await stub.recordBilling({ monthlyCostCents: 1, observedAt: now, now });
}

function post(path, body, extraHeaders = {}) {
  return new Request(`https://transfer.example${path}`, {
    method: "POST",
    headers: {
      Origin: origin,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "CF-Connecting-IP": "198.51.100.77",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

async function responseJson(response) {
  return response.json();
}

describe("HTTP transfer adapter", () => {
  beforeEach(async () => {
    envelope = await makeEnvelope();
    await makeHealthFresh();
  });

  it("requires the exact configured origin and answers the browser preflight", async () => {
    const health = await worker.fetch(new Request("https://transfer.example/health", { method: "GET" }), env);
    expect(health.status).toBe(200);
    expect(await responseJson(health)).toMatchObject({
      ok: true,
      createsEnabled: true,
      operationalHealth: true,
    });

    const preflight = await worker.fetch(new Request("https://transfer.example/v1/transfers", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type, cache-control",
      },
    }), env);
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(preflight.headers.get("Cache-Control")).toBe("no-store");

    const wrongOrigin = await worker.fetch(post("/v1/transfers", {}, { Origin: "https://evil.example" }), env);
    expect(wrongOrigin.status).toBe(404);
    expect(await responseJson(wrongOrigin)).toEqual({ state: "unavailable" });

    await euStub(env.TRANSFER_HEALTH, "global").markDeletionUnhealthy({ now: Date.now() });
    const disabled = await worker.fetch(post("/v1/transfers", {
      envelope,
      idempotencyKey: "health-disabled-create",
    }), env);
    expect(disabled.status).toBe(503);
    expect(await responseJson(disabled)).toEqual({ state: "unavailable" });
  });

  it("routes create, duplicate, claim, commit, and status without putting the token in a URL", async () => {
    const idempotencyKey = "http-adapter-key-20260908";
    const create = await worker.fetch(post("/v1/transfers", { envelope, idempotencyKey }), env);
    expect(create.status).toBe(201);
    const created = await responseJson(create);
    expect(Object.keys(created).sort()).toEqual(["expiresAt", "token"]);
    expect(created.token).toMatch(/^v1\.[A-Za-z0-9_-]{1,16}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}$/u);
    expect(create.url).not.toContain(created.token);

    const duplicate = await worker.fetch(post("/v1/transfers", { envelope, idempotencyKey }), env);
    expect(duplicate.status).toBe(200);
    expect(await responseJson(duplicate)).toMatchObject({ duplicate: true });

    // A deletion-health incident disables only new creates; recovery of this
    // already-created transfer remains available.
    await euStub(env.TRANSFER_HEALTH, "global").markDeletionUnhealthy({ now: Date.now() });
    const claimId = "A".repeat(22);
    const claim = await worker.fetch(post("/v1/transfers/claims", { token: created.token, claimId }), env);
    expect(claim.status).toBe(200);
    const claimed = await responseJson(claim);
    expect(Object.keys(claimed).sort()).toEqual(["envelope", "expiresAt"]);
    expect(claimed.envelope).toEqual(envelope);

    const wrongClaim = await worker.fetch(post("/v1/transfers/claims", { token: created.token, claimId: "B".repeat(22) }), env);
    expect(wrongClaim.status).toBe(404);
    expect(await responseJson(wrongClaim)).toEqual({ state: "unavailable" });

    const commit = await worker.fetch(post("/v1/transfers/claims/commit", { token: created.token, claimId }), env);
    expect(commit.status).toBe(200);
    expect(await responseJson(commit)).toMatchObject({ state: "deleted" });

    const status = await worker.fetch(post("/v1/transfers/status", { token: created.token }), env);
    expect(status.status).toBe(200);
    expect(await responseJson(status)).toMatchObject({ state: "deleted" });
    expect(status.url).not.toContain(created.token);
  });
});
