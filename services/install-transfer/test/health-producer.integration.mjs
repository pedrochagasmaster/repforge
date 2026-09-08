import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const serviceScript = fileURLToPath(new URL("../scripts/health-producer.mjs", import.meta.url));
const providerToken = "provider-token-012345678901234567890123";
const secrets = {
  watchdog: "watchdog-secret-012345678901234567890123",
  billing: "billing-secret-012345678901234567890123",
  purge: "purge-secret-01234567890123456789012345",
};
const objectIds = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
const fullPageIds = Array.from({ length: 10 }, (_, index) => index.toString(16).padStart(64, "0"));
const servers = [];

try {
  await runCompletePass();
  await runAmbiguousPage();
  console.log("health producer integration passed");
} finally {
  await Promise.all(servers.splice(0).map((value) => closeServer(value)));
}

async function runCompletePass() {
  const state = createState();
  const service = await startServer((request, body) => handleService(request, body, state));
  const provider = await startServer((request) => handleProvider(request, state));
  const files = await receipts();
  const result = await runProducer(environment(service, provider, files));
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /scheduled health accepted; purge examined=0 purged=0/u);
  assert.doesNotMatch(result.stdout + result.stderr, /provider-token|watchdog-secret/u);
  assert.equal(state.providerAuth, true);
  assert.deepEqual(state.providerQueries, [null, "next-page"]);
  assert.deepEqual(state.purgeObjectBatches, [objectIds]);
  assert.equal(state.positiveHeartbeats, 5);
  assert.equal(state.failureHeartbeats, 0);
  assert.equal(state.billingPosts, 1);
  assert.equal(state.healthGets, 1);
}

async function runAmbiguousPage() {
  const state = createState();
  state.fullPageWithoutCursor = true;
  const service = await startServer((request, body) => handleService(request, body, state));
  const provider = await startServer((request) => handleProvider(request, state));
  const files = await receipts();
  const result = await runProducer(environment(service, provider, files));
  assert.notEqual(result.code, 0);
  assert.doesNotMatch(result.stdout + result.stderr, /purge-secret|provider-token/u);
  assert.equal(state.positiveHeartbeats, 0);
  assert.equal(state.failureHeartbeats, 1);
  assert.equal(state.billingPosts, 0);
}

function environment(service, provider, files) {
  return {
    TRANSFER_SERVICE_URL: "http://localhost:" + service.port,
    TRANSFER_WATCHDOG_SECRET: secrets.watchdog,
    TRANSFER_BILLING_SECRET: secrets.billing,
    TRANSFER_PURGE_SECRET: secrets.purge,
    TRANSFER_BILLING_RECEIPT_FILE: files.billing,
    TRANSFER_WATCHDOG_RECEIPT_FILE: files.health,
    TRANSFER_CF_API_TOKEN: providerToken,
    TRANSFER_CF_ACCOUNT_ID: "d".repeat(32),
    TRANSFER_DO_NAMESPACE_ID: "transfer-eu",
    TRANSFER_CF_API_BASE_URL: "http://localhost:" + provider.port + "/client/v4",
    TRANSFER_PURGE_EVIDENCE_REF: "scheduled-test",
    TRANSFER_ENUM_PAGE_LIMIT: "10",
    TRANSFER_ENUM_MAX_OBJECTS: "32",
    TRANSFER_ALLOW_TEST_OBSERVATION: "true",
  };
}

async function receipts() {
  const directory = await mkdtemp(join(tmpdir(), "taurifer-health-"));
  const health = join(directory, "watchdog.json");
  const billing = join(directory, "billing.json");
  const observedAt = Date.now();
  const healthValue = { schemaVersion: 1, health: {} };
  for (const kind of ["alarm", "watchdog", "log", "key", "deletion"]) {
    healthValue.health[kind] = {
      source: "test-fixture",
      observedAt,
      checkVersion: "fixture-" + kind,
      result: "pass",
      evidenceRef: "fixture-" + kind,
    };
  }
  await writeFile(health, JSON.stringify(healthValue), "utf8");
  await writeFile(billing, JSON.stringify({
    source: "test-fixture",
    observedAt,
    checkVersion: "fixture-billing",
    result: "observed",
    evidenceRef: "fixture-billing",
    monthlyCostCents: 1,
  }), "utf8");
  return { health, billing };
}

function createState() {
  return {
    providerAuth: false,
    providerQueries: [],
    purgeObjectBatches: [],
    positiveHeartbeats: 0,
    failureHeartbeats: 0,
    billingPosts: 0,
    healthGets: 0,
    fullPageWithoutCursor: false,
  };
}

async function handleProvider(request, state) {
  const parsed = new URL(request.url, "http://localhost");
  if (request.headers.authorization !== "Bearer " + providerToken) return jsonResponse(401, { success: false, result: [] });
  state.providerAuth = true;
  const cursor = parsed.searchParams.get("cursor");
  state.providerQueries.push(cursor);
  const ids = state.fullPageWithoutCursor
    ? fullPageIds
    : (cursor === null ? objectIds.slice(0, 2) : objectIds.slice(2));
  const result = ids.map((id) => ({ id, hasStoredData: true }));
  const payload = state.fullPageWithoutCursor
    ? { success: true, result }
    : (cursor === null
      ? { success: true, result, result_info: { cursor: "next-page" } }
      : { success: true, result, result_info: {} });
  return jsonResponse(200, payload);
}

async function handleService(request, body, state) {
  const path = new URL(request.url, "http://localhost").pathname;
  if (path === "/_ops/purge-due") return jsonResponse(200, { ok: true, examined: 0, purged: 0, failed: 0, remainingDue: 0 });
  if (path === "/_ops/purge-objects") {
    state.purgeObjectBatches.push(body.objectIds);
    return jsonResponse(200, { examined: body.objectIds.length, purged: body.objectIds.length, deferred: 0, failed: 0 });
  }
  if (path === "/_ops/heartbeat") {
    if (body.result === "fail") state.failureHeartbeats += 1;
    else state.positiveHeartbeats += 1;
    return jsonResponse(200, { ok: true, accepted: true });
  }
  if (path === "/_ops/billing") {
    state.billingPosts += 1;
    return jsonResponse(200, { ok: true, accepted: true });
  }
  if (path === "/_ops/health") {
    state.healthGets += 1;
    return jsonResponse(200, {
      ok: true,
      leaseFresh: true,
      deletionHealthy: true,
      billingHealthy: true,
      createsEnabled: false,
      incidentGeneration: 1,
      ackGeneration: 1,
    });
  }
  return jsonResponse(404, { state: "unavailable" });
}

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

function startServer(handler) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      total += chunk.length;
      if (total > 65_536) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    let body = null;
    try { body = text.length === 0 ? null : JSON.parse(text); } catch {
      response.writeHead(400).end();
      return;
    }
    const result = await handler(request, body);
    response.writeHead(result.status, Object.fromEntries(result.headers.entries()));
    response.end(await result.text());
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const value = { server, port: server.address().port };
      servers.push(value);
      resolve(value);
    });
  });
}

function closeServer(value) {
  return new Promise((resolve) => value.server.close(() => resolve()));
}

function runProducer(overrides) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serviceScript], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...process.env, ...overrides },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}
