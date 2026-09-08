import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  parseBillingObservation,
  parseProviderHealthObservation,
} from "../src/observation.js";

const serviceUrl = requiredServiceOrigin();
const watchdogSecret = requiredSecret("TRANSFER_WATCHDOG_SECRET");
const billingSecret = requiredSecret("TRANSFER_BILLING_SECRET");
const purgeSecret = requiredSecret("TRANSFER_PURGE_SECRET");
const billingReceiptPath = requiredPath("TRANSFER_BILLING_RECEIPT_FILE");
const purgeLimit = parseLimit(process.env.TRANSFER_PURGE_LIMIT ?? "100");
const purgeOperationId = boundedId(process.env.TRANSFER_PURGE_OPERATION_ID ?? randomUUID(), "TRANSFER_PURGE_OPERATION_ID");
const purgeCheckVersion = boundedVersion(process.env.TRANSFER_PURGE_CHECK_VERSION ?? "scheduled-purge-v1", "TRANSFER_PURGE_CHECK_VERSION");
const purgeEvidenceRef = boundedReference(requiredEnv("TRANSFER_PURGE_EVIDENCE_REF"), "TRANSFER_PURGE_EVIDENCE_REF");
const providerApiToken = requiredSecret("TRANSFER_CF_API_TOKEN");
const providerAccountId = boundedAccountId(requiredEnv("TRANSFER_CF_ACCOUNT_ID"), "TRANSFER_CF_ACCOUNT_ID");
const providerNamespaceId = boundedNamespaceId(requiredEnv("TRANSFER_DO_NAMESPACE_ID"), "TRANSFER_DO_NAMESPACE_ID");
const providerApiBase = requiredProviderApiBase();
const providerPageLimit = parseProviderPageLimit(process.env.TRANSFER_ENUM_PAGE_LIMIT ?? "32");
const providerMaxObjects = parseProviderMaxObjects(process.env.TRANSFER_ENUM_MAX_OBJECTS ?? "288");
const allowTestFixture = process.env.TRANSFER_ALLOW_TEST_OBSERVATION === "true";

// The scheduler performs the deletion canary first. A response with failed
// or still-due rows is evidence of a deletion incident, not a successful
// health receipt.
const purge = await postJson(serviceUrl, purgeSecret, "/_ops/purge-due", {
  operationId: purgeOperationId,
  checkVersion: purgeCheckVersion,
  evidenceRef: purgeEvidenceRef,
  limit: purgeLimit,
});
assertPurgeResponse(purge);
if (purge.failed > 0 || purge.remainingDue > 0) {
  await reportDeletionFailure("scheduled-purge-failure-v1", "purge-" + purgeEvidenceRef.slice(0, 120));
  throw new Error("scheduled purge did not clear due rows");
}

try {
  await enumerateAndPurge();
} catch {
  await reportDeletionFailure("provider-enumeration-failure-v1", "provider-enumeration-failed");
  throw new Error("provider enumeration did not complete");
}

const healthValue = await runWatchdogProbe();
const billingValue = await readJson(billingReceiptPath);
const now = Date.now();
const health = parseProviderHealthObservation(healthValue, { now, allowTestFixture });
const billing = parseBillingObservation(billingValue, { now, allowTestFixture });

for (const kind of ["alarm", "watchdog", "log", "key", "deletion"]) {
  const value = health.health[kind];
  await postJson(serviceUrl, watchdogSecret, "/_ops/heartbeat", {
    operationId: randomUUID(),
    checkVersion: value.checkVersion,
    kind,
    result: value.result,
    observedAt: value.observedAt,
    evidenceRef: value.evidenceRef,
  });
}
await postJson(serviceUrl, billingSecret, "/_ops/billing", {
  operationId: randomUUID(),
  checkVersion: billing.checkVersion,
  monthlyCostCents: billing.monthlyCostCents,
  result: billing.result,
  observedAt: billing.observedAt,
  evidenceRef: billing.evidenceRef,
});

const healthResponse = await getJson(serviceUrl, watchdogSecret, "/_ops/health");
assertHealthResponse(healthResponse);
console.log(`scheduled health accepted; purge examined=${purge.examined} purged=${purge.purged}`);

async function enumerateAndPurge() {
  let cursor = null;
  const seenCursors = new Set();
  const seenIds = new Set();
  const pendingIds = [];
  let pages = 0;
  for (;;) {
    if (pages >= 128) throw new Error(`provider enumeration is too long`);
    const page = await fetchProviderPage(cursor);
    pages += 1;
    if (seenIds.size + page.objectIds.length > providerMaxObjects) {
      throw new Error(`provider enumeration exceeds its bounded work limit`);
    }
    for (const objectId of page.objectIds) {
      if (seenIds.has(objectId)) throw new Error(`provider enumeration repeated an object`);
      seenIds.add(objectId);
      pendingIds.push(objectId);
    }
    while (pendingIds.length >= 32) {
      await postPurgeBatch(pendingIds.splice(0, 32));
    }
    if (page.cursor === null) {
      if (pendingIds.length > 0) await postPurgeBatch(pendingIds.splice(0));
      return { complete: true, pages, examined: seenIds.size };
    }
    if (seenCursors.has(page.cursor)) throw new Error(`provider enumeration cursor repeated`);
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }
}

async function postPurgeBatch(objectIds) {
  const result = await postPurgeObjects(objectIds);
  if (result.failed !== 0
    || result.examined !== objectIds.length
    || result.purged + result.deferred + result.failed !== result.examined) {
    throw new Error(`provider purge was incomplete`);
  }
}

async function fetchProviderPage(cursor) {
  const url = new URL(`${providerApiBase}/accounts/${providerAccountId}/workers/durable_objects/namespaces/${providerNamespaceId}/objects`);
  url.searchParams.set(`limit`, String(providerPageLimit));
  if (cursor !== null) url.searchParams.set(`cursor`, cursor);
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${providerApiToken}`,
        Accept: `application/json`,
      },
      redirect: `error`,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`provider enumeration request failed`);
  }
  if (!response.ok) throw new Error(`provider enumeration rejected`);
  const text = await boundedResponseText(response, 64 * 1024, "provider enumeration response");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(`provider enumeration response is invalid JSON`); }
  if (!value || value.success !== true || !Array.isArray(value.result)) {
    throw new Error(`provider enumeration response is not successful`);
  }
  if (value.result.length > providerPageLimit) throw new Error(`provider page exceeded its limit`);
  const objectIds = value.result.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || typeof entry.id !== "string" || !/^[0-9a-f]{64}$/u.test(entry.id)
      || ("hasStoredData" in entry && typeof entry.hasStoredData !== "boolean")) {
      throw new Error(`provider object entry is invalid`);
    }
    return entry.id;
  });
  const info = value.result_info;
  if (info !== undefined && (!info || typeof info !== `object` || Array.isArray(info))) {
    throw new Error(`provider pagination metadata is invalid`);
  }
  const next = info?.cursor;
  if (next === undefined || next === null || next === ``) {
    const totalCount = info?.total_count;
    if (value.result.length === providerPageLimit
      || (totalCount !== undefined && (!Number.isSafeInteger(totalCount) || totalCount > value.result.length))) {
      throw new Error(`provider pagination ended without a cursor`);
    }
    return { objectIds, cursor: null };
  }
  if (typeof next !== "string" || next.length > 512 || !/^[\x21-\x7e]+$/u.test(next)) {
    throw new Error(`provider cursor is invalid`);
  }
  return { objectIds, cursor: next };
}

async function postPurgeObjects(objectIds) {
  const value = await postJson(serviceUrl, purgeSecret, `/_ops/purge-objects`, {
    operationId: randomUUID(),
    objectIds,
  }, { requireOk: false });
  if (!exactKeys(value, [`examined`, `purged`, `deferred`, `failed`])
    || ![`examined`, `purged`, `deferred`, `failed`].every((key) => safeCount(value[key]))) {
    throw new Error(`provider purge response is invalid`);
  }
  return value;
}

async function reportDeletionFailure(checkVersion, evidenceRef) {
  try {
    await postJson(serviceUrl, watchdogSecret, `/_ops/heartbeat`, {
      operationId: randomUUID(),
      checkVersion,
      kind: `deletion`,
      result: `fail`,
      observedAt: Date.now(),
      evidenceRef,
    });
  } catch {
    // A failed health report cannot turn an incomplete provider pass into a
    // success. The scheduler exits with no positive receipts either way.
  }
}

async function runWatchdogProbe() {
  const command = process.env.TRANSFER_WATCHDOG_PROBE_COMMAND ?? process.execPath;
  const args = process.env.TRANSFER_WATCHDOG_PROBE_ARGS_JSON === undefined
    ? [fileURLToPath(new URL("./provider-watchdog-probe.mjs", import.meta.url))]
    : parseArgs(process.env.TRANSFER_WATCHDOG_PROBE_ARGS_JSON);
  if (typeof command !== "string" || command.length === 0 || command.length > 256 || /[\u0000-\u001f\u007f]/u.test(command)) {
    throw new Error("TRANSFER_WATCHDOG_PROBE_COMMAND is invalid");
  }
  const text = await runCommand(command, args);
  try { return JSON.parse(text); } catch { throw new Error("watchdog probe output is invalid JSON"); }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill("SIGKILL");
        reject(new Error("watchdog probe timed out"));
      }
    }, 10_000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.length > 16_384 && !settled) {
        settled = true;
        child.kill("SIGKILL");
        clearTimeout(timer);
        reject(new Error("watchdog probe output is too large"));
      }
    });
    child.once("error", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("watchdog probe could not start"));
      }
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) reject(new Error("watchdog probe failed"));
      else resolve(output);
    });
  });
}

async function readJson(path) {
  let text;
  try { text = await readFile(path, "utf8"); } catch { throw new Error("billing receipt is unavailable"); }
  if (text.length > 16_384) throw new Error("billing receipt is too large");
  try { return JSON.parse(text); } catch { throw new Error("billing receipt is invalid JSON"); }
}

async function postJson(origin, secret, path, value, options = {}) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`scheduled operations request failed: ${path}`);
  }
  if (!response.ok) throw new Error(`scheduled operations request rejected: ${path}`);
  const text = await boundedResponseText(response, 4_096, "scheduled operations response");
  let result;
  try { result = JSON.parse(text); } catch { throw new Error("scheduled operations response is invalid JSON"); }
  if (!result || (options.requireOk !== false && result.ok !== true)) throw new Error(`scheduled operations response rejected: ${path}`);
  return result;
}

async function getJson(origin, secret, path) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      headers: { Authorization: `Bearer ${secret}`, "Cache-Control": "no-store" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`scheduled health request failed: ${path}`);
  }
  if (!response.ok) throw new Error(`scheduled health request rejected: ${path}`);
  const text = await boundedResponseText(response, 4_096, "scheduled health response");
  try { return JSON.parse(text); } catch { throw new Error("scheduled health response is invalid JSON"); }
}

function assertPurgeResponse(value) {
  if (!exactKeys(value, ["ok", "examined", "purged", "failed", "remainingDue"])
    || value.ok !== true
    || !["examined", "purged", "failed", "remainingDue"].every((key) => safeCount(value[key]))) {
    throw new Error("scheduled purge response is invalid");
  }
}

function assertHealthResponse(value) {
  if (!exactKeys(value, ["ok", "leaseFresh", "deletionHealthy", "billingHealthy", "createsEnabled", "incidentGeneration", "ackGeneration"])
    || value.ok !== true
    || typeof value.leaseFresh !== "boolean"
    || typeof value.deletionHealthy !== "boolean"
    || typeof value.billingHealthy !== "boolean"
    || typeof value.createsEnabled !== "boolean"
    || !safeCount(value.incidentGeneration)
    || !safeCount(value.ackGeneration)) throw new Error("scheduled health response is invalid");
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

async function boundedResponseText(response, maxBytes, name) {
  if (!(response?.body instanceof ReadableStream)) throw new Error(`${name} is unavailable`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error(`${name} is invalid`);
      if (value.byteLength === 0) continue;
      if (total > maxBytes - value.byteLength) throw new Error(`${name} is too large`);
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* fixed error is the only observable result */ }
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch {
    throw new Error(`${name} is not UTF-8`);
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function requiredPath(name) {
  const value = requiredEnv(name);
  if (value.length > 512) throw new Error(`${name} is too long`);
  return value;
}

function requiredServiceOrigin() {
  const value = requiredEnv("TRANSFER_SERVICE_URL");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TRANSFER_SERVICE_URL is invalid"); }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash
    || !((parsed.protocol === "https:") || (parsed.protocol === "http:" && parsed.hostname === "localhost"))) {
    throw new Error("TRANSFER_SERVICE_URL must be an HTTPS origin or localhost origin without credentials, path, query, or fragment");
  }
  return parsed.origin;
}

function requiredSecret(name) {
  const value = requiredEnv(name);
  if (value.length < 32 || value.length > 256) throw new Error(`${name} length is invalid`);
  return value;
}

function parseLimit(value) {
  if (!/^(?:[1-9][0-9]*)$/u.test(value)) throw new Error("TRANSFER_PURGE_LIMIT is invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 100) throw new Error("TRANSFER_PURGE_LIMIT is invalid");
  return parsed;
}

function requiredProviderApiBase() {
  const value = process.env.TRANSFER_CF_API_BASE_URL ?? "https://api.cloudflare.com/client/v4";
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TRANSFER_CF_API_BASE_URL is invalid"); }
  const path = parsed.pathname.replace(/\/+$/u, "");
  const local = parsed.protocol === "http:" && parsed.hostname === "localhost";
  const cloudflare = parsed.protocol === "https:"
    && parsed.hostname === "api.cloudflare.com"
    && parsed.port === "";
  if (parsed.username || parsed.password || parsed.search || parsed.hash
    || path !== "/client/v4" || !(cloudflare || local)) {
    throw new Error("TRANSFER_CF_API_BASE_URL must be the Cloudflare API base or localhost test base");
  }
  return `${parsed.origin}${path}`;
}

function boundedAccountId(value, name) {
  if (!/^[0-9a-f]{32}$/u.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

function boundedNamespaceId(value, name) {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

function parseProviderPageLimit(value) {
  if (!/^(?:[1-9][0-9]*)$/u.test(value)) throw new Error("TRANSFER_ENUM_PAGE_LIMIT is invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 10 || parsed > 32) throw new Error("TRANSFER_ENUM_PAGE_LIMIT must be 10-32");
  return parsed;
}

function parseProviderMaxObjects(value) {
  if (!/^(?:[1-9][0-9]*)$/u.test(value)) throw new Error("TRANSFER_ENUM_MAX_OBJECTS is invalid");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 288) throw new Error("TRANSFER_ENUM_MAX_OBJECTS must be 1-288");
  return parsed;
}

function parseArgs(value) {
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error("TRANSFER_WATCHDOG_PROBE_ARGS_JSON is invalid"); }
  if (!Array.isArray(parsed) || parsed.length > 8 || parsed.some((item) => typeof item !== "string" || item.length > 256 || /[\u0000-\u001f\u007f]/u.test(item))) {
    throw new Error("TRANSFER_WATCHDOG_PROBE_ARGS_JSON is invalid");
  }
  return parsed;
}

function boundedId(value, name) {
  if (!/^[A-Za-z0-9_-]{16,96}$/u.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

function boundedVersion(value, name) {
  if (!/^[A-Za-z0-9._-]{1,32}$/u.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

function boundedReference(value, name) {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(value)) throw new Error(`${name} is invalid`);
  return value;
}
