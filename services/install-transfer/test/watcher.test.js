import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import watcher from "../src/watcher.js";

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const NAMESPACE_ID = "transfer-namespace-0123";
const API_TOKEN = "scoped-durable-object-list-token-0123456789";
const OBJECT_A = "a".repeat(64);
const OBJECT_B = "b".repeat(64);
const PROVIDER_PREFIX = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/durable_objects/namespaces/${NAMESPACE_ID}/objects`;

const bearers = {
  watchdog: env.TRANSFER_WATCHDOG_SECRET,
  billing: env.TRANSFER_BILLING_SECRET,
  purge: env.TRANSFER_PURGE_SECRET,
};

function watcherEnv(target, overrides = {}) {
  return {
    TRANSFER: target,
    TRANSFER_SERVICE_ORIGIN: "https://taurifer.com",
    TRANSFER_WATCHDOG_SECRET: bearers.watchdog,
    TRANSFER_BILLING_SECRET: bearers.billing,
    TRANSFER_PURGE_SECRET: bearers.purge,
    TRANSFER_CF_ACCOUNT_ID: ACCOUNT_ID,
    TRANSFER_DO_NAMESPACE_ID: NAMESPACE_ID,
    TRANSFER_CF_API_TOKEN: API_TOKEN,
    TRANSFER_ATTESTED_MONTHLY_COST_CENTS: "0",
    ...overrides,
  };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

/** A recording stand-in for the production Worker's /_ops/* surface. */
function mockTarget(overrides = {}) {
  const calls = [];
  const target = {
    calls,
    async fetch(input, init) {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const body = request.method === "POST" ? await request.json() : undefined;
      calls.push({ origin: url.origin, path: url.pathname, method: request.method, authorization: request.headers.get("Authorization"), body });
      if (overrides[url.pathname]) return overrides[url.pathname](body);
      if (url.pathname === "/_ops/purge-due") return jsonResponse({ ok: true, examined: 3, purged: 1, failed: 0, remainingDue: 0 });
      if (url.pathname === "/_ops/purge-objects") return jsonResponse({ examined: body.objectIds.length, purged: 0, deferred: body.objectIds.length, failed: 0 });
      if (url.pathname === "/_ops/heartbeat" || url.pathname === "/_ops/billing") return jsonResponse({ ok: true });
      if (url.pathname === "/_ops/health") {
        return jsonResponse({ ok: true, leaseFresh: true, deletionHealthy: true, billingHealthy: true, createsEnabled: true, incidentGeneration: 0, ackGeneration: 0 });
      }
      return jsonResponse({ state: "unavailable" }, 404);
    },
  };
  return target;
}

/** Stands in for the Cloudflare API; anything else reaching global fetch fails the test. */
function mockProvider(respond) {
  const calls = [];
  vi.stubGlobal("fetch", async (input, init) => {
    const request = new Request(input, init);
    if (!request.url.startsWith(PROVIDER_PREFIX)) throw new Error(`unexpected global fetch ${request.url}`);
    calls.push({ url: new URL(request.url), authorization: request.headers.get("Authorization") });
    return respond(new URL(request.url));
  });
  return calls;
}

function controller() {
  return { cron: "*/2 * * * *", scheduledTime: Date.now(), noRetry() {} };
}

function context() {
  const pending = [];
  return { waitUntil: (promise) => pending.push(promise), passThroughOnException() {}, pending };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scheduled health watcher", () => {
  it("runs one owner-attested pass: purge sweep, provider enumeration, five heartbeats, billing, health", async () => {
    const target = mockTarget();
    const provider = mockProvider((url) => (url.searchParams.get("cursor") === null
      ? jsonResponse({ success: true, result: [{ id: OBJECT_A, hasStoredData: true }], result_info: { cursor: "page-2" } })
      : jsonResponse({ success: true, result: [{ id: OBJECT_B }], result_info: { cursor: "" } })));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const before = Date.now();

    await watcher.scheduled(controller(), watcherEnv(target), context());

    expect(provider.map((call) => call.url.searchParams.get("cursor"))).toEqual([null, "page-2"]);
    expect(provider.every((call) => call.authorization === `Bearer ${API_TOKEN}`)).toBe(true);
    expect(target.calls.every((call) => call.origin === "https://taurifer.com")).toBe(true);
    expect(target.calls.map((call) => [call.method, call.path])).toEqual([
      ["POST", "/_ops/purge-due"],
      ["POST", "/_ops/purge-objects"],
      ["POST", "/_ops/heartbeat"],
      ["POST", "/_ops/heartbeat"],
      ["POST", "/_ops/heartbeat"],
      ["POST", "/_ops/heartbeat"],
      ["POST", "/_ops/heartbeat"],
      ["POST", "/_ops/billing"],
      ["GET", "/_ops/health"],
    ]);
    const [purgeDue, purgeObjects, ...rest] = target.calls;
    expect(purgeDue.authorization).toBe(`Bearer ${bearers.purge}`);
    expect(purgeDue.body).toMatchObject({ checkVersion: "scheduled-purge-v1", evidenceRef: "owner-override-20261014", limit: 100 });
    expect(purgeObjects.authorization).toBe(`Bearer ${bearers.purge}`);
    expect(purgeObjects.body.objectIds).toEqual([OBJECT_A, OBJECT_B]);
    const heartbeats = rest.slice(0, 5);
    expect(heartbeats.map((call) => call.body.kind)).toEqual(["alarm", "watchdog", "log", "key", "deletion"]);
    for (const call of heartbeats) {
      expect(call.authorization).toBe(`Bearer ${bearers.watchdog}`);
      expect(call.body).toMatchObject({ checkVersion: "operator-attested-v1", result: "pass", evidenceRef: "owner-override-20261014" });
      expect(call.body.observedAt).toBeGreaterThanOrEqual(before);
    }
    const billing = rest[5];
    expect(billing.authorization).toBe(`Bearer ${bearers.billing}`);
    expect(billing.body).toMatchObject({ checkVersion: "operator-attested-v1", result: "observed", evidenceRef: "owner-override-20261014", monthlyCostCents: 0 });
    expect(rest[6].authorization).toBe(`Bearer ${bearers.watchdog}`);
    const output = log.mock.calls.flat().join("\n");
    expect(output).toBe("health pass ok; purge examined=3 purged=1; provider objects=2; createsEnabled=true");
    for (const secret of [...Object.values(bearers), API_TOKEN, ACCOUNT_ID]) expect(output).not.toContain(secret);
  });

  it("reports a deletion failure and renews nothing when the provider API errors", async () => {
    const target = mockTarget();
    mockProvider(() => jsonResponse({ success: false, errors: [{ code: 10000 }] }, 500));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("provider enumeration did not complete");

    expect(target.calls.map((call) => call.path)).toEqual(["/_ops/purge-due", "/_ops/heartbeat"]);
    const report = target.calls[1];
    expect(report.authorization).toBe(`Bearer ${bearers.watchdog}`);
    expect(report.body).toMatchObject({ kind: "deletion", result: "fail", checkVersion: "provider-enumeration-failure-v1", evidenceRef: "provider-enumeration-failed" });
  });

  it("fails the run without positive receipts when the target answers 503", async () => {
    const target = mockTarget({ "/_ops/purge-due": () => jsonResponse({ state: "unavailable" }, 503) });
    const provider = mockProvider(() => jsonResponse({ success: true, result: [] }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("scheduled operations request rejected: /_ops/purge-due");

    expect(target.calls.map((call) => call.path)).toEqual(["/_ops/purge-due"]);
    expect(provider).toEqual([]);
  });

  it("refuses to run with incomplete secrets and never contacts the target", async () => {
    const target = mockTarget();
    mockProvider(() => jsonResponse({ success: true, result: [] }));
    await expect(watcher.scheduled(controller(), watcherEnv(target, { TRANSFER_CF_API_TOKEN: undefined }), context()))
      .rejects.toThrow("watcher configuration is invalid: TRANSFER_CF_API_TOKEN");
    expect(target.calls).toEqual([]);
  });

  describe("against the real operations handlers", () => {
    beforeEach(async () => {
      await reset();
    });

    it("renews the lease so creates are enabled, and the handlers still require the bearer", async () => {
      const target = { fetch: (input, init) => worker.fetch(new Request(input, init), env) };
      mockProvider(() => jsonResponse({ success: true, result: [] }));
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      // A fresh health object opens with an unacknowledged incident; production
      // cleared it with the owner's deletion ack at launch.
      await watcher.scheduled(controller(), watcherEnv(target), context());
      expect(log.mock.calls.at(-1)[0]).toMatch(/createsEnabled=false$/u);
      const ack = await target.fetch("https://taurifer.com/_ops/deletion-ack", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.TRANSFER_ACK_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: "watcher-test-ack-operation",
          generation: 1,
          checkVersion: "ack-test-v1",
          proofNonce: "P".repeat(32),
          observedAt: Date.now(),
          evidenceRef: "fixture-ack",
        }),
      });
      expect(ack.status).toBe(200);

      await watcher.scheduled(controller(), watcherEnv(target), context());
      expect(log.mock.calls.at(-1)[0]).toMatch(/createsEnabled=true$/u);
      const anonymous = await target.fetch("https://taurifer.com/_ops/health");
      expect(anonymous.status).toBe(404);
      const forged = await target.fetch("https://taurifer.com/_ops/heartbeat", {
        method: "POST",
        headers: { Authorization: `Bearer ${"x".repeat(43)}`, "Content-Type": "application/json" },
        body: "{}",
      });
      expect(forged.status).toBe(404);
    });
  });
});
