// Scheduled health watcher for the production install-transfer Worker (#397).
// A separate Worker, `taurifer-install-transfer-watcher`, runs one pass per
// cron tick and does exactly what one devbox `production-health-loop.mjs` pass
// did: the registry purge sweep, the provider enumeration purge backstop, then
// the owner-attested heartbeats and billing receipt (owner override,
// 2026-10-14; see src/attestation.js), and finally reads /_ops/health.
//
// It reaches the transfer Worker through the TRANSFER service binding: a
// Worker cannot fetch another Worker's route on the same zone. The request
// still enters that Worker's fetch handler, so every call passes the same
// /_ops/* bearer checks as a public request would.
//
// A failed pass throws, so the invocation is recorded as an error in the cron
// events and Workers logs. Output is limited to counts and fixed error text.
import { ATTESTED_EVIDENCE_REF, HEALTH_KINDS, attestedReceipts } from "./attestation.js";
import { parseBillingObservation, parseProviderHealthObservation } from "./observation.js";

const PROVIDER_API_BASE = "https://api.cloudflare.com/client/v4";
const PURGE_LIMIT = 100;
const PURGE_CHECK_VERSION = "scheduled-purge-v1";
const PROVIDER_PAGE_LIMIT = 100;
const PROVIDER_MAX_OBJECTS = 288;
const PROVIDER_MAX_PAGES = 128;
const PURGE_BATCH = 32;
const REQUEST_TIMEOUT_MS = 10_000;

function configured(env) {
  const invalid = (name) => { throw new Error(`watcher configuration is invalid: ${name}`); };
  const secret = (name) => {
    const value = env[name];
    if (typeof value !== "string" || value.length < 32 || value.length > 256) invalid(name);
    return value;
  };
  const matching = (name, expression) => {
    const value = env[name];
    if (typeof value !== "string" || !expression.test(value)) invalid(name);
    return value;
  };
  if (!env.TRANSFER || typeof env.TRANSFER.fetch !== "function") invalid("TRANSFER");
  let origin;
  try { origin = new URL(env.TRANSFER_SERVICE_ORIGIN); } catch { invalid("TRANSFER_SERVICE_ORIGIN"); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    invalid("TRANSFER_SERVICE_ORIGIN");
  }
  return {
    target: env.TRANSFER,
    origin: origin.origin,
    watchdogSecret: secret("TRANSFER_WATCHDOG_SECRET"),
    billingSecret: secret("TRANSFER_BILLING_SECRET"),
    purgeSecret: secret("TRANSFER_PURGE_SECRET"),
    providerToken: matching("TRANSFER_CF_API_TOKEN", /^[A-Za-z0-9_-]{32,256}$/u),
    accountId: matching("TRANSFER_CF_ACCOUNT_ID", /^[0-9a-f]{32}$/u),
    namespaceId: matching("TRANSFER_DO_NAMESPACE_ID", /^[A-Za-z0-9_-]{1,128}$/u),
    monthlyCostCents: Number(matching("TRANSFER_ATTESTED_MONTHLY_COST_CENTS", /^(?:0|[1-9][0-9]{0,8})$/u)),
  };
}

export async function runWatcherPass(env, { now = () => Date.now() } = {}) {
  const config = configured(env);
  const ops = operationsClient(config);

  // The deletion canary runs first. Failed or still-due rows are evidence of a
  // deletion incident, not a successful health receipt.
  const purge = await ops.post(config.purgeSecret, "/_ops/purge-due", {
    operationId: crypto.randomUUID(),
    checkVersion: PURGE_CHECK_VERSION,
    evidenceRef: ATTESTED_EVIDENCE_REF,
    limit: PURGE_LIMIT,
  });
  assertPurgeResponse(purge);
  if (purge.failed > 0 || purge.remainingDue > 0) {
    await reportDeletionFailure(ops, config, now(), "scheduled-purge-failure-v1", `purge-${ATTESTED_EVIDENCE_REF}`);
    throw new Error("scheduled purge did not clear due rows");
  }

  let enumerated;
  try {
    enumerated = await enumerateAndPurge(ops, config);
  } catch {
    await reportDeletionFailure(ops, config, now(), "provider-enumeration-failure-v1", "provider-enumeration-failed");
    throw new Error("provider enumeration did not complete");
  }

  const stampedAt = now();
  const receipts = attestedReceipts(stampedAt, config.monthlyCostCents);
  const health = parseProviderHealthObservation(receipts.watchdog, { now: stampedAt });
  const billing = parseBillingObservation(receipts.billing, { now: stampedAt });
  for (const kind of HEALTH_KINDS) {
    const value = health.health[kind];
    await ops.post(config.watchdogSecret, "/_ops/heartbeat", {
      operationId: crypto.randomUUID(),
      checkVersion: value.checkVersion,
      kind,
      result: value.result,
      observedAt: value.observedAt,
      evidenceRef: value.evidenceRef,
    });
  }
  await ops.post(config.billingSecret, "/_ops/billing", {
    operationId: crypto.randomUUID(),
    checkVersion: billing.checkVersion,
    monthlyCostCents: billing.monthlyCostCents,
    result: billing.result,
    observedAt: billing.observedAt,
    evidenceRef: billing.evidenceRef,
  });

  const snapshot = await ops.get(config.watchdogSecret, "/_ops/health");
  assertHealthResponse(snapshot);
  return {
    examined: purge.examined,
    purged: purge.purged,
    providerObjects: enumerated.examined,
    createsEnabled: snapshot.createsEnabled,
  };
}

async function enumerateAndPurge(ops, config) {
  let cursor = null;
  const seenCursors = new Set();
  const seenIds = new Set();
  const pendingIds = [];
  for (let pages = 0; ; pages += 1) {
    if (pages >= PROVIDER_MAX_PAGES) throw new Error("provider enumeration is too long");
    const page = await fetchProviderPage(config, cursor);
    if (seenIds.size + page.objectIds.length > PROVIDER_MAX_OBJECTS) throw new Error("provider enumeration exceeds its bounded work limit");
    for (const objectId of page.objectIds) {
      if (seenIds.has(objectId)) throw new Error("provider enumeration repeated an object");
      seenIds.add(objectId);
      pendingIds.push(objectId);
    }
    while (pendingIds.length >= PURGE_BATCH) await postPurgeBatch(ops, config, pendingIds.splice(0, PURGE_BATCH));
    if (page.cursor === null) {
      if (pendingIds.length > 0) await postPurgeBatch(ops, config, pendingIds.splice(0));
      return { examined: seenIds.size };
    }
    if (seenCursors.has(page.cursor)) throw new Error("provider enumeration cursor repeated");
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }
}

async function postPurgeBatch(ops, config, objectIds) {
  const result = await ops.post(config.purgeSecret, "/_ops/purge-objects", { operationId: crypto.randomUUID(), objectIds }, { requireOk: false });
  const keys = ["examined", "purged", "deferred", "failed"];
  if (!exactKeys(result, keys) || !keys.every((key) => safeCount(result[key]))) throw new Error("provider purge response is invalid");
  if (result.failed !== 0
    || result.examined !== objectIds.length
    || result.purged + result.deferred + result.failed !== result.examined) {
    throw new Error("provider purge was incomplete");
  }
}

async function fetchProviderPage(config, cursor) {
  const url = new URL(`${PROVIDER_API_BASE}/accounts/${config.accountId}/workers/durable_objects/namespaces/${config.namespaceId}/objects`);
  url.searchParams.set("limit", String(PROVIDER_PAGE_LIMIT));
  if (cursor !== null) url.searchParams.set("cursor", cursor);
  let response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.providerToken}`, Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error("provider enumeration request failed");
  }
  if (!response.ok) throw new Error("provider enumeration rejected");
  const value = parseJson(await boundedResponseText(response, 64 * 1024, "provider enumeration response"), "provider enumeration response");
  if (!value || value.success !== true || !Array.isArray(value.result)) throw new Error("provider enumeration response is not successful");
  if (value.result.length > PROVIDER_PAGE_LIMIT) throw new Error("provider page exceeded its limit");
  const objectIds = value.result.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || typeof entry.id !== "string" || !/^[0-9a-f]{64}$/u.test(entry.id)
      || ("hasStoredData" in entry && typeof entry.hasStoredData !== "boolean")) {
      throw new Error("provider object entry is invalid");
    }
    return entry.id;
  });
  const info = value.result_info;
  if (info !== undefined && (!info || typeof info !== "object" || Array.isArray(info))) throw new Error("provider pagination metadata is invalid");
  const next = info?.cursor;
  if (next === undefined || next === null || next === "") {
    const totalCount = info?.total_count;
    if (value.result.length === PROVIDER_PAGE_LIMIT
      || (totalCount !== undefined && (!Number.isSafeInteger(totalCount) || totalCount > value.result.length))) {
      throw new Error("provider pagination ended without a cursor");
    }
    return { objectIds, cursor: null };
  }
  if (typeof next !== "string" || next.length > 512 || !/^[\x21-\x7e]+$/u.test(next)) throw new Error("provider cursor is invalid");
  return { objectIds, cursor: next };
}

async function reportDeletionFailure(ops, config, observedAt, checkVersion, evidenceRef) {
  try {
    await ops.post(config.watchdogSecret, "/_ops/heartbeat", {
      operationId: crypto.randomUUID(),
      checkVersion,
      kind: "deletion",
      result: "fail",
      observedAt,
      evidenceRef,
    });
  } catch {
    // A failed report cannot turn an incomplete pass into a success; the pass
    // throws with no positive receipts either way.
  }
}

function operationsClient({ target, origin }) {
  async function send(path, init, name) {
    let response;
    try {
      response = await target.fetch(`${origin}${path}`, { ...init, redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new Error(`scheduled ${name} request failed: ${path}`);
    }
    if (!response.ok) throw new Error(`scheduled ${name} request rejected: ${path}`);
    return parseJson(await boundedResponseText(response, 4_096, `scheduled ${name} response`), `scheduled ${name} response`);
  }
  return {
    async post(secret, path, value, { requireOk = true } = {}) {
      const result = await send(path, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Cache-Control": "no-store", "Content-Type": "application/json" },
        body: JSON.stringify(value),
      }, "operations");
      if (!result || (requireOk && result.ok !== true)) throw new Error(`scheduled operations response rejected: ${path}`);
      return result;
    },
    get(secret, path) {
      return send(path, { headers: { Authorization: `Bearer ${secret}`, "Cache-Control": "no-store" } }, "health");
    },
  };
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

function parseJson(text, name) {
  try { return JSON.parse(text); } catch { throw new Error(`${name} is invalid JSON`); }
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
      if (total > maxBytes - value.byteLength) throw new Error(`${name} is too large`);
      chunks.push(value);
      total += value.byteLength;
    }
  } catch (error) {
    try { await reader.cancel(); } catch { /* the fixed error is the only observable result */ }
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

export default {
  async scheduled(controller, env) {
    const result = await runWatcherPass(env);
    console.log(`health pass ok; purge examined=${result.examined} purged=${result.purged}; provider objects=${result.providerObjects}; createsEnabled=${result.createsEnabled}`);
  },
};
