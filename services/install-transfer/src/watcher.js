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
//
// The provider step is retried once within a pass. A failure it still has is
// reported with its path and error class only; the health record decides
// whether that is a first strike or a latch (see RUNBOOK.md, "Deletion
// incidents"). After every pass, success or not, the latch alert opens, updates
// or closes the `transfer-latched` GitHub issue when it is configured.
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
const PROVIDER_ATTEMPTS = 2;
const GITHUB_API_BASE = "https://api.github.com";
export const LATCH_LABEL = "transfer-latched";

/** A provider-step failure, carrying only where it failed and a closed error class. */
class ProviderStepError extends Error {
  constructor(path, errorClass, message) {
    super(message);
    this.path = path;
    this.errorClass = errorClass;
  }
}

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
    await reportDeletionFailure(ops, config, now(), "scheduled-purge-failure-v1", `purge-${ATTESTED_EVIDENCE_REF}`, {
      failurePath: "registry-purge",
      errorClass: purge.failed > 0 ? "incomplete" : "due-rows",
    });
    throw new Error("scheduled purge did not clear due rows");
  }

  let enumerated;
  for (let attempt = 1; !enumerated; attempt += 1) {
    try {
      enumerated = { ...(await enumerateAndPurge(ops, config)), attempt };
    } catch (error) {
      const failure = error instanceof ProviderStepError ? error : new ProviderStepError("provider-list", "invalid-response", "");
      if (attempt < PROVIDER_ATTEMPTS) {
        console.log(`provider step retry; path=${failure.path} error=${failure.errorClass}`);
        continue;
      }
      await reportDeletionFailure(ops, config, now(), "provider-enumeration-failure-v1", "provider-enumeration-failed", {
        failurePath: failure.path,
        errorClass: failure.errorClass,
      });
      throw new Error(`provider enumeration did not complete; path=${failure.path} error=${failure.errorClass}`);
    }
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
    providerSkipped: enumerated.skipped,
    providerPurged: enumerated.purged,
    providerDeferred: enumerated.deferred,
    providerFailed: enumerated.failed,
    providerAttempts: enumerated.attempt,
    createsEnabled: snapshot.createsEnabled,
    snapshot,
  };
}

async function enumerateAndPurge(ops, config) {
  let cursor = null;
  const seenCursors = new Set();
  const seenIds = new Set();
  const pendingIds = [];
  const totals = { purged: 0, deferred: 0, failed: 0 };
  let skipped = 0;
  const purgeBatch = async (objectIds) => {
    const result = await postPurgeBatch(ops, config, objectIds);
    for (const key of Object.keys(totals)) totals[key] += result[key];
  };
  const listError = (errorClass, message) => new ProviderStepError("provider-list", errorClass, message);
  for (let pages = 0; ; pages += 1) {
    if (pages >= PROVIDER_MAX_PAGES) throw listError("incomplete", "provider enumeration is too long");
    const page = await fetchProviderPage(config, cursor);
    if (seenIds.size + page.objectIds.length > PROVIDER_MAX_OBJECTS) throw listError("incomplete", "provider enumeration exceeds its bounded work limit");
    for (const objectId of page.objectIds) {
      if (seenIds.has(objectId)) throw listError("invalid-response", "provider enumeration repeated an object");
      seenIds.add(objectId);
      // An entry the provider lists with no stored data has nothing to delete
      // (owner decision, 2026-10-30): it is counted, not instantiated. An entry
      // without the flag is purged as before.
      if (page.emptyIds.has(objectId)) skipped += 1;
      else pendingIds.push(objectId);
    }
    while (pendingIds.length >= PURGE_BATCH) await purgeBatch(pendingIds.splice(0, PURGE_BATCH));
    if (page.cursor === null) {
      if (pendingIds.length > 0) await purgeBatch(pendingIds.splice(0));
      return { examined: seenIds.size, skipped, ...totals };
    }
    if (seenCursors.has(page.cursor)) throw listError("invalid-response", "provider enumeration cursor repeated");
    seenCursors.add(page.cursor);
    cursor = page.cursor;
  }
}

async function postPurgeBatch(ops, config, objectIds) {
  let result;
  try {
    result = await ops.post(config.purgeSecret, "/_ops/purge-objects", { operationId: crypto.randomUUID(), objectIds }, { requireOk: false });
  } catch (error) {
    throw new ProviderStepError("provider-purge", error?.errorClass ?? "invalid-response", "provider purge request did not complete");
  }
  const keys = ["examined", "purged", "deferred", "failed"];
  if (!exactKeys(result, keys) || !keys.every((key) => safeCount(result[key]))) {
    throw new ProviderStepError("provider-purge", "invalid-response", "provider purge response is invalid");
  }
  if (result.examined !== objectIds.length || result.purged + result.deferred + result.failed !== result.examined) {
    throw new ProviderStepError("provider-purge", "invalid-response", "provider purge counts are inconsistent");
  }
  // The transfer Worker has already recorded a failed object purge as a
  // deletion failure; it is never retried into a success.
  if (result.failed !== 0) throw new ProviderStepError("provider-purge", "incomplete", "provider purge was incomplete");
  return result;
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
    throw new ProviderStepError("provider-list", "request-failed", "provider enumeration request failed");
  }
  if (!response.ok) throw new ProviderStepError("provider-list", "rejected", "provider enumeration rejected");
  try {
    return parseProviderPage(await boundedResponseText(response, 64 * 1024, "provider enumeration response"));
  } catch (error) {
    throw new ProviderStepError("provider-list", "invalid-response", error instanceof Error ? error.message : "");
  }
}

function parseProviderPage(text) {
  const value = parseJson(text, "provider enumeration response");
  if (!value || value.success !== true || !Array.isArray(value.result)) throw new Error("provider enumeration response is not successful");
  if (value.result.length > PROVIDER_PAGE_LIMIT) throw new Error("provider page exceeded its limit");
  const emptyIds = new Set();
  const objectIds = value.result.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)
      || typeof entry.id !== "string" || !/^[0-9a-f]{64}$/u.test(entry.id)
      || ("hasStoredData" in entry && typeof entry.hasStoredData !== "boolean")) {
      throw new Error("provider object entry is invalid");
    }
    if (entry.hasStoredData === false) emptyIds.add(entry.id);
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
    return { objectIds, emptyIds, cursor: null };
  }
  if (typeof next !== "string" || next.length > 512 || !/^[\x21-\x7e]+$/u.test(next)) throw new Error("provider cursor is invalid");
  return { objectIds, emptyIds, cursor: next };
}

async function reportDeletionFailure(ops, config, observedAt, checkVersion, evidenceRef, { failurePath, errorClass }) {
  try {
    await ops.post(config.watchdogSecret, "/_ops/heartbeat", {
      operationId: crypto.randomUUID(),
      checkVersion,
      kind: "deletion",
      result: "fail",
      observedAt,
      evidenceRef,
      failurePath,
      errorClass,
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
      throw Object.assign(new Error(`scheduled ${name} request failed: ${path}`), { errorClass: "request-failed" });
    }
    if (!response.ok) throw Object.assign(new Error(`scheduled ${name} request rejected: ${path}`), { errorClass: "rejected" });
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

const HEALTH_KEYS = ["ok", "leaseFresh", "deletionHealthy", "billingHealthy", "createsEnabled", "incidentGeneration", "ackGeneration"];
const LAST_CHECK_KEYS = ["checkVersion", "observedAt", "result", "path", "errorClass", "consecutiveFailures"];

function assertHealthResponse(value) {
  // lastDeletionCheck is optional so either Worker can be deployed first.
  const check = value?.lastDeletionCheck ?? null;
  if (!exactKeys(value, [...HEALTH_KEYS, ...(value && "lastDeletionCheck" in value ? ["lastDeletionCheck"] : [])])
    || (check !== null && (!exactKeys(check, LAST_CHECK_KEYS) || !safeCount(check.observedAt) || !safeCount(check.consecutiveFailures)))
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

function alertConfig(env) {
  const token = env.TRANSFER_ALERT_GITHUB_TOKEN;
  const repo = env.TRANSFER_ALERT_REPO;
  if (token === undefined && repo === undefined) return null;
  if (token === undefined) throw new Error("latch alert token is not provisioned");
  if (typeof token !== "string" || !/^[A-Za-z0-9_]{20,255}$/u.test(token)
    || typeof repo !== "string" || !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u.test(repo)) {
    throw new Error("latch alert configuration is invalid");
  }
  return { token, repo };
}

function latchTitle(generation) {
  return `Install transfer creates are latched off: deletion incident generation ${generation}`;
}

function latchBody(snapshot) {
  const check = snapshot.lastDeletionCheck;
  const lines = [
    "The production install-transfer health record has an unacknowledged deletion incident, so new transfers are refused.",
    "",
    `- Incident generation: ${snapshot.incidentGeneration}`,
    `- Acknowledged generation: ${snapshot.ackGeneration}`,
  ];
  if (check) {
    lines.push(
      `- Last deletion check: ${check.result} at ${new Date(check.observedAt).toISOString()} (${check.checkVersion})`,
      `- Failing path: ${check.path ?? "none"}; error class: ${check.errorClass ?? "none"}; consecutive failures: ${check.consecutiveFailures}`,
    );
  }
  lines.push("", "Follow `services/install-transfer/RUNBOOK.md`, \"Deletion incidents\". This issue closes itself when the generation is acknowledged.");
  return lines.join("\n");
}

/**
 * Opens, updates or closes the one open `transfer-latched` issue from a health
 * snapshot. Best-effort: it never fails the pass. The issue carries only
 * generations, timestamps and the closed failure vocabulary.
 */
export async function syncLatchAlert(env, snapshot, { fetcher = fetch } = {}) {
  const config = alertConfig(env);
  if (!config) return "unconfigured";
  const api = async (method, path, body) => {
    const response = await fetcher(`${GITHUB_API_BASE}/repos/${config.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "taurifer-install-transfer-watcher",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok && !(method === "POST" && path === "/labels" && response.status === 422)) {
      throw new Error(`latch alert request rejected: ${method} ${response.status}`);
    }
    return method === "GET" ? parseJson(await boundedResponseText(response, 256 * 1024, "latch alert response"), "latch alert response") : null;
  };
  const open = await api("GET", `/issues?labels=${LATCH_LABEL}&state=open&per_page=1`);
  if (!Array.isArray(open)) throw new Error("latch alert response is invalid");
  const issue = open[0];
  if (issue !== undefined && (!Number.isSafeInteger(issue?.number) || typeof issue.title !== "string")) {
    throw new Error("latch alert response is invalid");
  }
  if (snapshot.incidentGeneration > snapshot.ackGeneration) {
    const title = latchTitle(snapshot.incidentGeneration);
    if (!issue) {
      await api("POST", "/labels", { name: LATCH_LABEL, color: "B60205", description: "Install transfer creates latched off by a deletion incident" });
      await api("POST", "/issues", { title, body: latchBody(snapshot), labels: [LATCH_LABEL] });
      return "opened";
    }
    if (issue.title === title) return "unchanged";
    await api("PATCH", `/issues/${issue.number}`, { title });
    await api("POST", `/issues/${issue.number}/comments`, { body: latchBody(snapshot) });
    return "updated";
  }
  if (!issue) return "clear";
  await api("POST", `/issues/${issue.number}/comments`, {
    body: `Generation ${snapshot.incidentGeneration} is acknowledged; createsEnabled=${snapshot.createsEnabled}. Closing.`,
  });
  await api("PATCH", `/issues/${issue.number}`, { state: "closed", state_reason: "completed" });
  return "closed";
}

async function alertAfterPass(env, snapshot) {
  try {
    if (!alertConfig(env)) return;
    let current = snapshot;
    if (!current) {
      const config = configured(env);
      current = await operationsClient(config).get(config.watchdogSecret, "/_ops/health");
      assertHealthResponse(current);
    }
    const outcome = await syncLatchAlert(env, current);
    if (outcome !== "unchanged" && outcome !== "clear") console.log(`latch alert ${outcome}; generation=${current.incidentGeneration} ack=${current.ackGeneration}`);
  } catch (error) {
    // Fixed messages only: a method and status at most, never a value.
    console.log(`latch alert failed: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

export default {
  async scheduled(controller, env) {
    let result;
    try {
      result = await runWatcherPass(env);
    } finally {
      await alertAfterPass(env, result?.snapshot);
    }
    console.log(`health pass ok; purge examined=${result.examined} purged=${result.purged}; provider objects=${result.providerObjects} skipped=${result.providerSkipped} purged=${result.providerPurged} deferred=${result.providerDeferred} failed=${result.providerFailed} attempts=${result.providerAttempts}; createsEnabled=${result.createsEnabled}`);
  },
};
