import { base64UrlEncode, constantTimeEqual, utf8 } from "./crypto.js";
import { BILLING_EVIDENCE_MAX_AGE_MS, HEALTH_CLOCK_SKEW_MS, HEALTH_SIGNAL_MAX_AGE_MS } from "./health-do.js";
import { euNamespace, euStub } from "./namespaces.js";
import { assertJsonRequest, decodeJsonSyntax, readBoundedRequestBytes } from "./transport.js";
import { REGISTRY_BATCH_LIMIT } from "./registry-do.js";

const OPS_PREFIX = "/_ops/";
const HEALTH_PATH = `${OPS_PREFIX}health`;
const HEARTBEAT_PATH = `${OPS_PREFIX}heartbeat`;
const BILLING_PATH = `${OPS_PREFIX}billing`;
const DELETION_ACK_PATH = `${OPS_PREFIX}deletion-ack`;
const PURGE_PATH = `${OPS_PREFIX}purge-due`;
const PURGE_OBJECTS_PATH = `${OPS_PREFIX}purge-objects`;
const BODY_LIMIT = 4_096;
const AUTH_HEADER_LIMIT = 512;
const SECRET_LIMIT = 256;
const HEARTBEAT_KINDS = new Set(["alarm", "watchdog", "log", "key", "deletion"]);
const OPERATION_ID_RE = /^[A-Za-z0-9_-]{16,96}$/u;
const VERSION_RE = /^[A-Za-z0-9._-]{1,32}$/u;
const RESULT_RE = /^[A-Za-z0-9._-]{1,32}$/u;
const EVIDENCE_REF_RE = /^[A-Za-z0-9_-]{1,128}$/u;
const PROOF_NONCE_RE = /^[A-Za-z0-9_-]{32,128}$/u;
const ROLE_LIMITS = Object.freeze({ watchdog: 30, billing: 4, purge: 10, ack: 3 });
const ROLE_SECRETS = Object.freeze({
  watchdog: "TRANSFER_WATCHDOG_SECRET",
  billing: "TRANSFER_BILLING_SECRET",
  purge: "TRANSFER_PURGE_SECRET",
  ack: "TRANSFER_ACK_SECRET",
});
const OBJECT_ID_RE = /^[0-9a-f]{64}$/u;
const PURGE_OBJECT_LIMIT = 32;

const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: noStoreHeaders });
}

function unavailable(status = 404) {
  return json({ state: "unavailable" }, status);
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeInteger(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function observationInWindow(observedAt, now, maxAge) {
  return safeInteger(observedAt)
    && observedAt <= now + HEALTH_CLOCK_SKEW_MS
    && observedAt >= now - maxAge - HEALTH_CLOCK_SKEW_MS;
}

function boundedMetadata(value, expression, name) {
  if (typeof value !== "string" || !expression.test(value)) throw new TypeError(`${name} is invalid`);
  return value;
}

async function digestSecret(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(value)));
}

function roleSecret(env, role) {
  const configured = env[ROLE_SECRETS[role]];
  if (typeof configured !== "string" || configured.length < 32 || configured.length > SECRET_LIMIT) return null;
  return configured;
}

async function authorizedRole(request, env, role) {
  const configured = roleSecret(env, role);
  const header = request.headers.get("Authorization");
  if (!configured || typeof header !== "string" || header.length > AUTH_HEADER_LIMIT || !header.startsWith("Bearer ")) return false;
  const candidate = header.slice("Bearer ".length);
  if (candidate.length !== configured.length || candidate.length < 32 || candidate.length > SECRET_LIMIT) return false;
  try {
    const [expected, actual] = await Promise.all([digestSecret(configured), digestSecret(candidate)]);
    return constantTimeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function authorizedHealth(request, env) {
  if (await authorizedRole(request, env, "watchdog")) return "watchdog";
  if (await authorizedRole(request, env, "ack")) return "ack";
  return null;
}

async function boundedBody(request) {
  assertJsonRequest(request);
  return decodeJsonSyntax(await readBoundedRequestBytes(request, BODY_LIMIT));
}

function healthStub(env) {
  if (!env.TRANSFER_HEALTH) return null;
  try {
    return euStub(env.TRANSFER_HEALTH, "global", { allowLocalFallback: env.TRANSFER_LOCAL_TEST_EU === "true" });
  } catch {
    return null;
  }
}

function registryStub(env) {
  if (!env.TRANSFER_REGISTRY) return null;
  try {
    return euStub(env.TRANSFER_REGISTRY, "global", { allowLocalFallback: env.TRANSFER_LOCAL_TEST_EU === "true" });
  } catch {
    return null;
  }
}

async function consumeRoleRate(env, role) {
  const stub = healthStub(env);
  if (!stub) return { allowed: false, unavailable: true };
  try {
    return { allowed: (await stub.consumeOperatorRate({ role, limit: ROLE_LIMITS[role], now: Date.now() }))?.allowed === true, unavailable: false };
  } catch {
    return { allowed: false, unavailable: true };
  }
}

async function handleHealthGet(env, role) {
  const rate = await consumeRoleRate(env, role);
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  const stub = healthStub(env);
  if (!stub) return unavailable(503);
  try {
    const snapshot = await stub.snapshot({ now: Date.now() });
    return json({
      ok: true,
      leaseFresh: snapshot.leaseFresh === true,
      deletionHealthy: snapshot.deletionHealthy === true,
      billingHealthy: snapshot.billingHealthy === true,
      createsEnabled: snapshot.createsEnabled === true,
      incidentGeneration: snapshot.incidentGeneration,
      ackGeneration: snapshot.ackGeneration,
    });
  } catch {
    return unavailable(503);
  }
}

async function handleHeartbeat(request, env) {
  const rate = await consumeRoleRate(env, "watchdog");
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  let value;
  try { value = await boundedBody(request); } catch { return unavailable(); }
  if (!exactKeys(value, ["kind", "operationId", "checkVersion", "result", "observedAt", "evidenceRef"])
    || !HEARTBEAT_KINDS.has(value.kind)
    || !OPERATION_ID_RE.test(value.operationId)
    || !VERSION_RE.test(value.checkVersion)
    || !RESULT_RE.test(value.result)
    || !safeInteger(value.observedAt)
    || !EVIDENCE_REF_RE.test(value.evidenceRef)
    || (value.kind === "deletion" ? !["pass", "fail"].includes(value.result) : value.result !== "pass")) return unavailable();
  const now = Date.now();
  if (!observationInWindow(value.observedAt, now, HEALTH_SIGNAL_MAX_AGE_MS)) return unavailable(503);
  const stub = healthStub(env);
  if (!stub) return unavailable(503);
  try {
    const metadata = {
      actor: "watchdog",
      operationId: value.operationId,
      checkVersion: value.checkVersion,
      result: value.result,
      evidenceRef: value.evidenceRef,
      observedAt: value.observedAt,
      now,
    };
    if (value.kind === "deletion") {
      await stub.recordDeletionHealth({ healthy: value.result === "pass", ...metadata });
    } else {
      await stub.recordHeartbeat({ kind: value.kind, ...metadata });
    }
    return json({ ok: true, accepted: true });
  } catch {
    return unavailable(503);
  }
}

async function handleBilling(request, env) {
  const rate = await consumeRoleRate(env, "billing");
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  let value;
  try { value = await boundedBody(request); } catch { return unavailable(); }
  if (!exactKeys(value, ["operationId", "checkVersion", "monthlyCostCents", "result", "observedAt", "evidenceRef"])
    || !OPERATION_ID_RE.test(value.operationId)
    || !VERSION_RE.test(value.checkVersion)
    || !RESULT_RE.test(value.result)
    || !safeInteger(value.monthlyCostCents)
    || !safeInteger(value.observedAt)
    || !EVIDENCE_REF_RE.test(value.evidenceRef)) return unavailable();
  const now = Date.now();
  if (!observationInWindow(value.observedAt, now, BILLING_EVIDENCE_MAX_AGE_MS)) return unavailable(503);
  const stub = healthStub(env);
  if (!stub) return unavailable(503);
  try {
    await stub.recordBilling({ ...value, actor: "billing", now });
    return json({ ok: true, accepted: true });
  } catch {
    return unavailable(503);
  }
}

async function handleDeletionAck(request, env) {
  const rate = await consumeRoleRate(env, "ack");
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  let value;
  try { value = await boundedBody(request); } catch { return unavailable(); }
  if (!exactKeys(value, ["operationId", "generation", "checkVersion", "proofNonce", "observedAt", "evidenceRef"])
    || !OPERATION_ID_RE.test(value.operationId)
    || !VERSION_RE.test(value.checkVersion)
    || !safeInteger(value.generation, 1)
    || !PROOF_NONCE_RE.test(value.proofNonce)
    || !safeInteger(value.observedAt)
    || !EVIDENCE_REF_RE.test(value.evidenceRef)) return unavailable();
  const now = Date.now();
  if (!observationInWindow(value.observedAt, now, HEALTH_SIGNAL_MAX_AGE_MS)) return unavailable(503);
  const stub = healthStub(env);
  if (!stub) return unavailable(503);
  try {
    const snapshot = await stub.acknowledgeDeletion({ ...value, now });
    return json({ ok: true, acknowledged: true, createsEnabled: snapshot.createsEnabled === true });
  } catch {
    return unavailable();
  }
}

async function handlePurge(request, env) {
  const rate = await consumeRoleRate(env, "purge");
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  let value;
  try { value = await boundedBody(request); } catch { return unavailable(); }
  if (!exactKeys(value, ["operationId", "checkVersion", "evidenceRef", "limit"])
    || !OPERATION_ID_RE.test(value.operationId)
    || !VERSION_RE.test(value.checkVersion)
    || !EVIDENCE_REF_RE.test(value.evidenceRef)
    || !safeInteger(value.limit, 1)
    || value.limit > REGISTRY_BATCH_LIMIT) return unavailable();
  const registry = registryStub(env);
  const health = healthStub(env);
  if (!registry || !health) return unavailable(503);
  const now = Date.now();
  try {
    const result = await registry.purgeDue({ now, limit: value.limit });
    await health.recordControlEvidence({
      operationId: value.operationId,
      checkVersion: value.checkVersion,
      // The operation ID is the idempotency key.  The receipt counts may
      // change when a retried purge finds work that the first attempt did
      // not reach, so the evidence itself has one stable result.
      result: "accepted",
      evidenceRef: value.evidenceRef,
      observedAt: now,
      now,
    });
    return json({
      ok: true,
      examined: result.examined,
      purged: result.purged,
      failed: result.failed,
      remainingDue: result.remainingDue,
    });
  } catch {
    return unavailable(503);
  }
}

async function objectBatchEvidenceRef(operationId, objectIds) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    utf8(`${operationId}\n${objectIds.join("\n")}`),
  );
  return `objects-${base64UrlEncode(new Uint8Array(digest))}`.slice(0, 128);
}

async function handlePurgeObjects(request, env) {
  const rate = await consumeRoleRate(env, "purge");
  if (rate.unavailable) return unavailable(503);
  if (!rate.allowed) return unavailable(429);
  let value;
  try { value = await boundedBody(request); } catch { return unavailable(); }
  if (!exactKeys(value, ["operationId", "objectIds"])
    || !OPERATION_ID_RE.test(value.operationId)
    || !Array.isArray(value.objectIds)
    || value.objectIds.length < 1
    || value.objectIds.length > PURGE_OBJECT_LIMIT
    || value.objectIds.some((id) => typeof id !== "string" || !OBJECT_ID_RE.test(id))) {
    return unavailable();
  }
  const uniqueIds = new Set(value.objectIds);
  if (uniqueIds.size !== value.objectIds.length) return unavailable();
  const namespace = env.TRANSFER_OBJECTS
    ? (() => {
      try {
        return euNamespace(env.TRANSFER_OBJECTS, { allowLocalFallback: env.TRANSFER_LOCAL_TEST_EU === "true" });
      } catch {
        return null;
      }
    })()
    : null;
  const health = healthStub(env);
  if (!namespace || !health || typeof namespace.idFromString !== "function" || typeof namespace.get !== "function") {
    return unavailable(503);
  }
  const now = Date.now();
  const evidenceRef = await objectBatchEvidenceRef(value.operationId, value.objectIds);
  let examined = 0;
  let purged = 0;
  let deferred = 0;
  let failed = 0;
  for (const id of value.objectIds) {
    examined += 1;
    try {
      const objectId = namespace.idFromString(id);
      const result = await namespace.get(objectId).purgeDue({ now });
      if (result?.purged === true) purged += 1;
      else if (result?.purged === false && typeof result.state === "string" && result.state !== "unavailable") deferred += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  try {
    if (failed > 0) {
      await health.recordDeletionHealth({
        healthy: false,
        actor: "purge",
        operationId: value.operationId,
        checkVersion: "provider-enumeration-v1",
        result: "fail",
        evidenceRef,
        observedAt: now,
        now,
      });
    } else {
      await health.recordControlEvidence({
        operationId: value.operationId,
        checkVersion: "provider-enumeration-v1",
        result: "accepted",
        evidenceRef,
        observedAt: now,
        now,
      });
    }
  } catch {
    return unavailable(503);
  }
  return json({ examined, purged, deferred, failed });
}

export async function handleOperations(request, env) {
  const url = new URL(request.url);
  if (![HEALTH_PATH, HEARTBEAT_PATH, BILLING_PATH, DELETION_ACK_PATH, PURGE_PATH, PURGE_OBJECTS_PATH].includes(url.pathname) || url.search || url.hash) return null;
  if (url.pathname === HEALTH_PATH) {
    if (request.method !== "GET") return unavailable();
    const role = await authorizedHealth(request, env);
    return role ? handleHealthGet(env, role) : unavailable();
  }
  const role = url.pathname === HEARTBEAT_PATH ? "watchdog"
    : url.pathname === BILLING_PATH ? "billing"
      : url.pathname === PURGE_PATH || url.pathname === PURGE_OBJECTS_PATH ? "purge" : "ack";
  if (!(await authorizedRole(request, env, role))) return unavailable();
  if (request.method !== "POST") return unavailable();
  if (url.pathname === HEARTBEAT_PATH) return handleHeartbeat(request, env);
  if (url.pathname === BILLING_PATH) return handleBilling(request, env);
  if (url.pathname === DELETION_ACK_PATH) return handleDeletionAck(request, env);
  if (url.pathname === PURGE_OBJECTS_PATH) return handlePurgeObjects(request, env);
  return handlePurge(request, env);
}
