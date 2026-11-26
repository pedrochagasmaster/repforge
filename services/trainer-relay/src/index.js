import contract from "../../../trainer-relay-contract.js";
import { base64UrlEncode, configKey, rateBucketName, recordObjectName, timingSafeEqualText } from "./crypto.js";
import { euStub } from "./namespaces.js";
import { RelayMeterDurableObject, monthOf } from "./meter-do.js";
import { RelayRateDurableObject } from "./rate-do.js";
import { RelayRecordDurableObject } from "./record-do.js";

export { RelayRecordDurableObject, RelayRateDurableObject, RelayMeterDurableObject };

const { ENDPOINTS, LIMITS } = contract;
const OPS = Object.freeze({ health: "/_ops/health", billing: "/_ops/billing" });
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const BASE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
});

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { ...BASE_HEADERS, ...headers } });
}

function refuse(status, headers = {}) {
  return json({ state: "unavailable" }, status, headers);
}

function euOptions(env) {
  return { allowLocalFallback: env.RELAY_LOCAL_TEST_EU === "true" };
}

function allowedOrigins(env) {
  return String(env.RELAY_ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function preflightAllowed(request) {
  if (request.headers.get("Access-Control-Request-Method") !== "POST") return false;
  const requested = request.headers.get("Access-Control-Request-Headers");
  if (!requested) return true;
  const allowed = new Set(["accept", "content-type"]);
  return requested.split(",").map((header) => header.trim().toLowerCase()).every((header) => allowed.has(header));
}

/** The record lifetime: seven days, or a shorter deployment setting (never longer, never under a minute). */
export function recordLifetimeMs(env) {
  const configured = Number(env.RELAY_RECORD_LIFETIME_SECONDS);
  if (!Number.isSafeInteger(configured) || configured <= 0) return LIMITS.recordLifetimeMs;
  return Math.min(LIMITS.recordLifetimeMs, Math.max(LIMITS.minRecordLifetimeMs, configured * 1000));
}

export function createsOpen(env) {
  return env.RELAY_CREATES_ENABLED === "true" && env.RELAY_KILL_SWITCH !== "true";
}

class BodyError extends Error {
  constructor(status) {
    super("body");
    this.status = status;
  }
}

async function readJsonBody(request, maxBytes) {
  const type = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new BodyError(415);
  if (request.headers.get("Content-Encoding")) throw new BodyError(415);
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new BodyError(413);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyError(413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BodyError(400);
  }
}

function sourceAddress(request) {
  const address = request.headers.get("CF-Connecting-IP");
  return typeof address === "string" && address.length > 0 ? address : null;
}

async function consumeRate(env, scope, address, now) {
  const pepper = configKey(env, "RELAY_RATE_PEPPER_B64");
  const name = await rateBucketName(scope, address, pepper);
  const stub = euStub(env.RELAY_RATE, name, euOptions(env));
  const policy = scope === "create"
    ? { limit: LIMITS.createsPerAddressPerHour, windowMs: HOUR_MS }
    : { limit: LIMITS.readsPerAddressPerMinute, windowMs: MINUTE_MS };
  return stub.consume({ now, ...policy });
}

function meterStub(env) {
  return euStub(env.RELAY_METER, "global", euOptions(env));
}

/**
 * The owner alert for a closed cost gate. It always writes one fixed log line
 * with no request data; when an alert token and repository are configured it
 * also opens a GitHub issue, as install transfer's watcher does.
 */
async function raiseCostAlert(env, month) {
  console.error("trainer-relay alert: cost threshold reached; new creates are refused");
  const token = env.RELAY_ALERT_GITHUB_TOKEN;
  const repo = env.RELAY_ALERT_REPO;
  if (typeof token !== "string" || !token || typeof repo !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repo)) return;
  try {
    await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "taurifer-trainer-relay",
      },
      body: JSON.stringify({
        title: `Trainer relay: cost threshold reached (${month})`,
        body: `The trainer relay refused a new create because this month's cost reached ${LIMITS.costThresholdCents} cents. Reads continue. See services/trainer-relay/README.md.`,
      }),
    });
  } catch {
    // The log line above remains; the gate stays closed regardless.
  }
}

async function handleCreate(request, env, ctx, headers) {
  if (!createsOpen(env)) return refuse(503, headers);
  const now = Date.now();
  const address = sourceAddress(request);
  if (!address) return refuse(429, headers);
  try {
    const rate = await consumeRate(env, "create", address, now);
    if (!rate?.allowed) return refuse(429, headers);
  } catch {
    return refuse(503, headers);
  }
  let body;
  try {
    body = await readJsonBody(request, LIMITS.maxCreateBodyBytes);
  } catch (error) {
    return refuse(error instanceof BodyError ? error.status : 400, headers);
  }
  const checked = contract.validateCreateRequest(body);
  if (!checked.ok) return refuse(checked.code === "invalid-size" ? 413 : 400, headers);
  let admitted;
  try {
    admitted = await meterStub(env).admitCreate({ now, bytes: checked.value.ciphertext.length });
  } catch {
    return refuse(503, headers);
  }
  if (admitted.alert) ctx.waitUntil(raiseCostAlert(env, monthOf(now)));
  if (!admitted.allowed) return refuse(503, headers);
  try {
    const routingKey = configKey(env, "RELAY_ROUTING_KEY_B64");
    const lifetimeMs = recordLifetimeMs(env);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const id = base64UrlEncode(crypto.getRandomValues(new Uint8Array(LIMITS.recordIdBytes)));
      const stub = euStub(env.RELAY_RECORDS, await recordObjectName(id, routingKey), euOptions(env));
      const result = await stub.create({
        version: checked.value.v,
        nonce: checked.value.nonce,
        ciphertext: checked.value.ciphertext,
        now,
        lifetimeMs,
      });
      if (result.kind === "created") return json({ id, expiresAt: new Date(result.expiresAt).toISOString() }, 201, headers);
    }
    return refuse(503, headers);
  } catch {
    return refuse(503, headers);
  }
}

async function handleRead(request, env, ctx, headers) {
  const now = Date.now();
  const address = sourceAddress(request);
  if (!address) return refuse(429, headers);
  try {
    const rate = await consumeRate(env, "read", address, now);
    if (!rate?.allowed) return refuse(429, headers);
  } catch {
    return refuse(503, headers);
  }
  let body;
  try {
    body = await readJsonBody(request, LIMITS.maxReadBodyBytes);
  } catch (error) {
    return refuse(error instanceof BodyError ? error.status : 400, headers);
  }
  const checked = contract.validateReadRequest(body);
  if (!checked.ok) return refuse(400, headers);
  ctx.waitUntil(meterStub(env).recordRead({ now }).catch(() => {}));
  try {
    const routingKey = configKey(env, "RELAY_ROUTING_KEY_B64");
    const stub = euStub(env.RELAY_RECORDS, await recordObjectName(checked.value.id, routingKey), euOptions(env));
    const result = await stub.read({ now });
    if (result.kind !== "record") return refuse(404, headers);
    return json({
      v: result.version,
      nonce: base64UrlEncode(new Uint8Array(result.nonce)),
      ciphertext: base64UrlEncode(new Uint8Array(result.ciphertext)),
      expiresAt: new Date(result.expiresAt).toISOString(),
    }, 200, headers);
  } catch {
    return refuse(503, headers);
  }
}

function opsAuthorized(request, env) {
  const secret = env.RELAY_OPS_SECRET;
  if (typeof secret !== "string" || secret.length < 32) return false;
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") && timingSafeEqualText(header.slice(7), secret);
}

async function handleOps(request, env, ctx, path) {
  if (request.method !== "POST" || !opsAuthorized(request, env)) return refuse(404);
  const now = Date.now();
  if (path === OPS.health) {
    try {
      const meter = await meterStub(env).snapshot({ now });
      return json({
        createsOpen: createsOpen(env) && !meter.costThresholdReached,
        killSwitch: env.RELAY_KILL_SWITCH === "true",
        recordLifetimeSeconds: recordLifetimeMs(env) / 1000,
        ...meter,
      });
    } catch {
      return refuse(503);
    }
  }
  let body;
  try {
    body = await readJsonBody(request, 256);
  } catch (error) {
    return refuse(error instanceof BodyError ? error.status : 400);
  }
  const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).sort().join(",") : "";
  if (keys !== "month,monthlyCostCents") return refuse(400);
  try {
    const result = await meterStub(env).attest({ now, month: body.month, monthlyCostCents: body.monthlyCostCents });
    if (!result.accepted) return refuse(409);
    if (result.alert) ctx.waitUntil(raiseCostAlert(env, body.month));
    return json({ accepted: true });
  } catch {
    return refuse(400);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.search) return refuse(404);
    if (url.pathname === OPS.health || url.pathname === OPS.billing) return handleOps(request, env, ctx, url.pathname);
    if (url.pathname !== ENDPOINTS.create && url.pathname !== ENDPOINTS.read) return refuse(404);
    const origin = request.headers.get("Origin");
    if (!origin || !allowedOrigins(env).includes(origin)) return refuse(404);
    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      return preflightAllowed(request) ? new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...headers } }) : refuse(404, headers);
    }
    if (request.method !== "POST") return refuse(404, headers);
    return url.pathname === ENDPOINTS.create ? handleCreate(request, env, ctx, headers) : handleRead(request, env, ctx, headers);
  },
};
