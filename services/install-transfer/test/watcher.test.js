import { env } from "cloudflare:workers";
import { reset } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index.js";
import watcher, { LATCH_LABEL, syncLatchAlert } from "../src/watcher.js";

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
      if (url.pathname === "/_ops/heartbeat" || url.pathname === "/_ops/billing" || url.pathname === "/_ops/provider-retry") return jsonResponse({ ok: true });
      if (url.pathname === "/_ops/health") {
        return jsonResponse({ ok: true, leaseFresh: true, deletionHealthy: true, billingHealthy: true, createsEnabled: true, incidentGeneration: 0, ackGeneration: 0, lastDeletionCheck: null });
      }
      return jsonResponse({ state: "unavailable" }, 404);
    },
  };
  return target;
}

/** Stands in for the Cloudflare API (and GitHub, when given); anything else reaching global fetch fails the test. */
function mockProvider(respond, github) {
  const calls = [];
  vi.stubGlobal("fetch", async (input, init) => {
    const request = new Request(input, init);
    if (github && request.url.startsWith("https://api.github.com/")) return github(request);
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
    expect(output).toBe("health pass ok; purge examined=3 purged=1; provider objects=2 skipped=0 purged=0 deferred=2 failed=0 attempts=1; createsEnabled=true");
    for (const secret of [...Object.values(bearers), API_TOKEN, ACCOUNT_ID]) expect(output).not.toContain(secret);
  });

  it("skips entries the provider lists with no stored data, and purges the rest", async () => {
    const OBJECT_C = "c".repeat(64);
    const target = mockTarget();
    mockProvider(() => jsonResponse({
      success: true,
      result: [{ id: OBJECT_A, hasStoredData: true }, { id: OBJECT_B, hasStoredData: false }, { id: OBJECT_C }],
    }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await watcher.scheduled(controller(), watcherEnv(target), context());

    const batches = target.calls.filter((call) => call.path === "/_ops/purge-objects");
    expect(batches.map((call) => call.body.objectIds)).toEqual([[OBJECT_A, OBJECT_C]]);
    expect(log.mock.calls.flat()).toEqual([
      "health pass ok; purge examined=3 purged=1; provider objects=3 skipped=1 purged=0 deferred=2 failed=0 attempts=1; createsEnabled=true",
    ]);
  });

  it("posts no purge batch when every listed entry has no stored data", async () => {
    const target = mockTarget();
    mockProvider(() => jsonResponse({ success: true, result: [{ id: OBJECT_A, hasStoredData: false }, { id: OBJECT_B, hasStoredData: false }] }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await watcher.scheduled(controller(), watcherEnv(target), context());

    expect(target.calls.some((call) => call.path === "/_ops/purge-objects")).toBe(false);
    expect(log.mock.calls.flat().at(-1)).toContain("provider objects=2 skipped=2 purged=0 deferred=0 failed=0 attempts=1;");
  });

  it("still rejects a repeated entry even when it has no stored data", async () => {
    const target = mockTarget();
    mockProvider(() => jsonResponse({ success: true, result: [{ id: OBJECT_A, hasStoredData: false }, { id: OBJECT_A, hasStoredData: false }] }));
    vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("path=provider-list error=invalid-response");
  });

  it("retries the provider step once, then reports where it failed and renews nothing", async () => {
    const target = mockTarget();
    const provider = mockProvider(() => jsonResponse({ success: false, errors: [{ code: 10000 }] }, 500));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("provider enumeration did not complete; path=provider-list error=rejected");

    expect(provider).toHaveLength(2);
    expect(target.calls.map((call) => call.path)).toEqual(["/_ops/purge-due", "/_ops/provider-retry", "/_ops/heartbeat"]);
    expect(target.calls[1].authorization).toBe(`Bearer ${bearers.watchdog}`);
    expect(target.calls[1].body).toMatchObject({ failurePath: "provider-list", errorClass: "rejected", outcome: "failed" });
    const report = target.calls[2];
    expect(report.authorization).toBe(`Bearer ${bearers.watchdog}`);
    expect(report.body).toMatchObject({
      kind: "deletion",
      result: "fail",
      checkVersion: "provider-enumeration-failure-v1",
      evidenceRef: "provider-enumeration-failed",
      failurePath: "provider-list",
      errorClass: "rejected",
    });
    expect(log.mock.calls.flat()).toEqual(["provider step retry; path=provider-list error=rejected"]);
  });

  it("completes the pass when the retry succeeds, without a deletion report", async () => {
    const target = mockTarget();
    let calls = 0;
    mockProvider(() => {
      calls += 1;
      if (calls === 1) throw new TypeError("network connection lost");
      return jsonResponse({ success: true, result: [{ id: OBJECT_A }] });
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await watcher.scheduled(controller(), watcherEnv(target), context());

    expect(target.calls.filter((call) => call.body?.result === "fail")).toEqual([]);
    const counted = target.calls.filter((call) => call.path === "/_ops/provider-retry");
    expect(counted.map((call) => call.body)).toEqual([{
      operationId: expect.any(String),
      failurePath: "provider-list",
      errorClass: "request-failed",
      outcome: "recovered",
      observedAt: expect.any(Number),
    }]);
    expect(target.calls.findIndex((call) => call.path === "/_ops/provider-retry"))
      .toBeLessThan(target.calls.findIndex((call) => call.path === "/_ops/heartbeat"));
    expect(log.mock.calls.flat()).toEqual([
      "provider step retry; path=provider-list error=request-failed",
      "health pass ok; purge examined=3 purged=1; provider objects=1 skipped=0 purged=0 deferred=1 failed=0 attempts=2; createsEnabled=true",
    ]);
  });

  it("keeps a pass healthy when the retry count can't be recorded (a Worker without the route)", async () => {
    const target = mockTarget({ "/_ops/provider-retry": () => jsonResponse({ state: "unavailable" }, 404) });
    let calls = 0;
    mockProvider(() => {
      calls += 1;
      return calls === 1 ? jsonResponse({ success: false }, 502) : jsonResponse({ success: true, result: [] });
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await watcher.scheduled(controller(), watcherEnv(target), context());
    expect(log.mock.calls.flat()).toEqual([
      "provider step retry; path=provider-list error=rejected",
      "provider retry count failed",
      "health pass ok; purge examined=3 purged=1; provider objects=0 skipped=0 purged=0 deferred=0 failed=0 attempts=2; createsEnabled=true",
    ]);
  });

  it("names the provider purge path when the purge batch is incomplete", async () => {
    const target = mockTarget({
      "/_ops/purge-objects": (body) => jsonResponse({ examined: body.objectIds.length, purged: 0, deferred: 0, failed: body.objectIds.length }),
    });
    mockProvider(() => jsonResponse({ success: true, result: [{ id: OBJECT_A }] }));
    vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("path=provider-purge error=incomplete");
    expect(target.calls.at(-1).body).toMatchObject({ kind: "deletion", result: "fail", failurePath: "provider-purge", errorClass: "incomplete" });
  });

  it("reports due rows left after the registry purge with the registry path", async () => {
    const target = mockTarget({ "/_ops/purge-due": () => jsonResponse({ ok: true, examined: 100, purged: 100, failed: 0, remainingDue: 4 }) });
    const provider = mockProvider(() => jsonResponse({ success: true, result: [] }));

    await expect(watcher.scheduled(controller(), watcherEnv(target), context()))
      .rejects.toThrow("scheduled purge did not clear due rows");
    expect(provider).toEqual([]);
    expect(target.calls.at(-1).body).toMatchObject({ kind: "deletion", result: "fail", failurePath: "registry-purge", errorClass: "due-rows" });
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

    async function acknowledgeCurrent(target) {
      const health = await (await target.fetch("https://taurifer.com/_ops/health", { headers: { Authorization: `Bearer ${bearers.watchdog}` } })).json();
      const ack = await target.fetch("https://taurifer.com/_ops/deletion-ack", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.TRANSFER_ACK_SECRET}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          operationId: `watcher-test-ack-${health.incidentGeneration}-operation`,
          generation: health.incidentGeneration,
          checkVersion: "ack-test-v1",
          proofNonce: "P".repeat(32),
          observedAt: Date.now(),
          evidenceRef: "fixture-ack",
        }),
      });
      expect(ack.status).toBe(200);
    }

    async function health(target) {
      return (await target.fetch("https://taurifer.com/_ops/health", { headers: { Authorization: `Bearer ${bearers.watchdog}` } })).json();
    }

    it("latches only when a transient provider failure repeats in the next pass", async () => {
      const target = { fetch: (input, init) => worker.fetch(new Request(input, init), env) };
      let failing = false;
      mockProvider(() => (failing ? jsonResponse({ success: false }, 503) : jsonResponse({ success: true, result: [] })));
      vi.spyOn(console, "log").mockImplementation(() => {});
      await watcher.scheduled(controller(), watcherEnv(target), context());
      await acknowledgeCurrent(target);
      await watcher.scheduled(controller(), watcherEnv(target), context());
      expect(await health(target)).toMatchObject({ createsEnabled: true, incidentGeneration: 1, ackGeneration: 1 });

      failing = true;
      await expect(watcher.scheduled(controller(), watcherEnv(target), context())).rejects.toThrow("provider enumeration did not complete");
      expect(await health(target)).toMatchObject({
        createsEnabled: true,
        incidentGeneration: 1,
        lastDeletionCheck: { result: "strike", path: "provider-list", errorClass: "rejected", consecutiveFailures: 1 },
      });

      // A clean pass in between resets the run.
      failing = false;
      await watcher.scheduled(controller(), watcherEnv(target), context());
      failing = true;
      await expect(watcher.scheduled(controller(), watcherEnv(target), context())).rejects.toThrow();
      expect(await health(target)).toMatchObject({ createsEnabled: true, incidentGeneration: 1 });

      await expect(watcher.scheduled(controller(), watcherEnv(target), context())).rejects.toThrow();
      const evidence = await (await target.fetch("https://taurifer.com/_ops/deletion-evidence", { headers: { Authorization: `Bearer ${bearers.watchdog}` } })).json();
      expect(evidence.providerRetries).toMatchObject({
        total: 3,
        recovered: 0,
        counts: [{ path: "provider-list", errorClass: "rejected", outcome: "failed", count: 3 }],
      });
      expect(await health(target)).toMatchObject({
        createsEnabled: false,
        deletionHealthy: false,
        incidentGeneration: 2,
        ackGeneration: 1,
        lastDeletionCheck: { result: "fail", path: "provider-list", errorClass: "rejected", consecutiveFailures: 2 },
      });
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

describe("transfer-latched alert", () => {
  const REPO = "owner/repository";
  const TOKEN = "github_pat_0123456789abcdefghijklmnop";
  const alertEnv = { TRANSFER_ALERT_GITHUB_TOKEN: TOKEN, TRANSFER_ALERT_REPO: REPO };
  const latched = {
    ok: true,
    leaseFresh: true,
    deletionHealthy: false,
    billingHealthy: true,
    createsEnabled: false,
    incidentGeneration: 3,
    ackGeneration: 2,
    lastDeletionCheck: {
      checkVersion: "provider-enumeration-failure-v1",
      observedAt: Date.UTC(2026, 9, 24, 9, 0),
      result: "fail",
      path: "provider-list",
      errorClass: "rejected",
      consecutiveFailures: 2,
    },
  };
  const acked = { ...latched, deletionHealthy: true, createsEnabled: true, ackGeneration: 3 };

  function github(openIssues) {
    const calls = [];
    const fetcher = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      calls.push({
        method: request.method,
        path: `${url.pathname}${url.search}`,
        authorization: request.headers.get("Authorization"),
        body: request.method === "GET" ? undefined : await request.json(),
      });
      if (request.method === "GET") return jsonResponse(openIssues);
      return jsonResponse({}, request.method === "POST" && url.pathname.endsWith("/issues") ? 201 : 200);
    };
    return { calls, fetcher };
  }

  it("does nothing when it is not configured, and refuses a repository without its token", async () => {
    const { calls, fetcher } = github([]);
    await expect(syncLatchAlert({}, latched, { fetcher })).resolves.toBe("unconfigured");
    await expect(syncLatchAlert({ TRANSFER_ALERT_REPO: REPO }, latched, { fetcher })).rejects.toThrow("latch alert token is not provisioned");
    await expect(syncLatchAlert({ ...alertEnv, TRANSFER_ALERT_REPO: "owner/repo/../x" }, latched, { fetcher })).rejects.toThrow("latch alert configuration is invalid");
    expect(calls).toEqual([]);
  });

  it("opens one labelled issue with generations and the failure class only", async () => {
    const { calls, fetcher } = github([]);
    await expect(syncLatchAlert(alertEnv, latched, { fetcher })).resolves.toBe("opened");
    expect(calls.map((call) => [call.method, call.path])).toEqual([
      ["GET", `/repos/${REPO}/issues?labels=${LATCH_LABEL}&state=open&per_page=1`],
      ["POST", `/repos/${REPO}/labels`],
      ["POST", `/repos/${REPO}/issues`],
    ]);
    expect(calls.every((call) => call.authorization === `Bearer ${TOKEN}`)).toBe(true);
    const issue = calls[2].body;
    expect(issue.labels).toEqual([LATCH_LABEL]);
    expect(issue.title).toBe("Install transfer creates are latched off: deletion incident generation 3");
    expect(issue.body).toContain("- Incident generation: 3");
    expect(issue.body).toContain("- Acknowledged generation: 2");
    expect(issue.body).toContain("- Last deletion check: fail at 2026-10-24T09:00:00.000Z (provider-enumeration-failure-v1)");
    expect(issue.body).toContain("- Failing path: provider-list; error class: rejected; consecutive failures: 2");
    expect(JSON.stringify(calls.map((call) => call.body))).not.toContain(TOKEN);
  });

  it("leaves a current issue alone and moves an older one to the new generation", async () => {
    const current = github([{ number: 7, title: "Install transfer creates are latched off: deletion incident generation 3" }]);
    await expect(syncLatchAlert(alertEnv, latched, { fetcher: current.fetcher })).resolves.toBe("unchanged");
    expect(current.calls.map((call) => call.method)).toEqual(["GET"]);

    const older = github([{ number: 7, title: "Install transfer creates are latched off: deletion incident generation 2" }]);
    await expect(syncLatchAlert(alertEnv, latched, { fetcher: older.fetcher })).resolves.toBe("updated");
    expect(older.calls.slice(1).map((call) => [call.method, call.path])).toEqual([
      ["PATCH", `/repos/${REPO}/issues/7`],
      ["POST", `/repos/${REPO}/issues/7/comments`],
    ]);
    expect(older.calls[1].body).toEqual({ title: "Install transfer creates are latched off: deletion incident generation 3" });
  });

  it("comments and closes the open issue once the generation is acknowledged", async () => {
    const { calls, fetcher } = github([{ number: 7, title: "Install transfer creates are latched off: deletion incident generation 3" }]);
    await expect(syncLatchAlert(alertEnv, acked, { fetcher })).resolves.toBe("closed");
    expect(calls.slice(1).map((call) => [call.method, call.path, call.body])).toEqual([
      ["POST", `/repos/${REPO}/issues/7/comments`, { body: "Generation 3 is acknowledged; createsEnabled=true. Closing." }],
      ["PATCH", `/repos/${REPO}/issues/7`, { state: "closed", state_reason: "completed" }],
    ]);
    const none = github([]);
    await expect(syncLatchAlert(alertEnv, acked, { fetcher: none.fetcher })).resolves.toBe("clear");
  });

  it("runs after a failed pass too, and its own failure never changes the pass outcome", async () => {
    const latchedTarget = mockTarget({ "/_ops/health": () => jsonResponse(latched) });
    const githubCalls = [];
    mockProvider(() => jsonResponse({ success: false }, 500), async (request) => {
      githubCalls.push(request.method);
      return request.method === "GET" ? jsonResponse([]) : jsonResponse({}, 201);
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(watcher.scheduled(controller(), watcherEnv(latchedTarget, alertEnv), context()))
      .rejects.toThrow("provider enumeration did not complete");
    expect(githubCalls).toEqual(["GET", "POST", "POST"]);
    expect(log.mock.calls.flat()).toContain("latch alert opened; generation=3 ack=2");

    vi.unstubAllGlobals();
    mockProvider(() => jsonResponse({ success: true, result: [] }), async () => jsonResponse({ message: "Bad credentials" }, 401));
    log.mockClear();
    await watcher.scheduled(controller(), watcherEnv(mockTarget(), alertEnv), context());
    expect(log.mock.calls.flat()).toEqual([
      "latch alert failed: latch alert request rejected: GET 401",
      "health pass ok; purge examined=3 purged=1; provider objects=0 skipped=0 purged=0 deferred=0 failed=0 attempts=1; createsEnabled=true",
    ]);
  });
});
