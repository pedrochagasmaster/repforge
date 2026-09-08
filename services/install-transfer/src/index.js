import contract from "../../../install-transfer-contract.js";
import { base64UrlDecode } from "./crypto.js";
import { operationalServiceHealth } from "./operations.js";
import { rateBucketName, rateLimitForScope } from "./rate-limit.js";
import { routeFromToken, routeNameForIdempotencyKey } from "./routing.js";
import { RateLimitDurableObject } from "./rate-limit-do.js";
import { TransferDurableObject } from "./transfer-do.js";
import { TransferHealthDurableObject } from "./health-do.js";
import { euStub } from "./namespaces.js";
import {
  TRANSPORT_ERROR_CODES,
  TransportError,
  assertJsonRequest,
  readBoundedRequestBytes,
} from "./transport.js";

export { TransferDurableObject, RateLimitDurableObject, TransferHealthDurableObject };
export { routeFromToken, routeNameForIdempotencyKey };

const ENDPOINTS = contract.ENDPOINTS;
const noStoreHeaders = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...noStoreHeaders, ...extraHeaders },
  });
}

function unavailable(status = 404, headers = {}) {
  return json({ state: "unavailable" }, status, headers);
}

function expiresAtIso(value) {
  if (!Number.isSafeInteger(value)) throw new Error("invalid expiry");
  return new Date(value).toISOString();
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (typeof origin !== "string" || origin !== env.TRANSFER_ALLOWED_ORIGIN) return null;
  return origin;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type, Cache-Control",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function preflightAllowed(request) {
  if (request.headers.get("Access-Control-Request-Method") !== "POST") return false;
  const requested = request.headers.get("Access-Control-Request-Headers");
  if (!requested) return true;
  const allowed = new Set(["accept", "content-type", "cache-control"]);
  return requested.split(",").map((header) => header.trim().toLowerCase()).every((header) => allowed.has(header));
}

function configKey(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value.length === 0) throw new Error("configuration unavailable");
  const decoded = base64UrlDecode(value);
  if (decoded.length < 32) throw new Error("configuration unavailable");
  return decoded;
}

async function parseRequest(request, endpoint) {
  assertJsonRequest(request);
  const maxBytes = endpoint === ENDPOINTS.create
    ? contract.LIMITS.requestBodyCreateBytes
    : contract.LIMITS.requestBodySmallEndpointBytes;
  const rawBytes = await readBoundedRequestBytes(request, maxBytes);
  const parsed = contract.parseBoundedJson(rawBytes, endpoint);
  if (!parsed?.ok) throw new TransportError(parsed?.code || TRANSPORT_ERROR_CODES.INVALID_JSON);
  const validated = contract.validateRequest(parsed.value, endpoint);
  if (!validated?.ok) throw new TransportError(validated.code || "invalid-request");
  if (endpoint !== ENDPOINTS.create) return validated.value;
  const checked = await contract.validateEnvelopeIntegrity(validated.value.envelope, globalThis.crypto);
  if (!checked?.ok) throw new TransportError(checked.code || "invalid-envelope");
  return { ...validated.value, envelope: checked.value };
}

async function consumeRate(env, scope, identity) {
  const pepper = configKey(env, "TRANSFER_RATE_PEPPER_B64");
  const name = await rateBucketName({ scope, identity, pepper });
  const stub = env.RATE_LIMIT_BUCKETS ? euStub(env.RATE_LIMIT_BUCKETS, name) : null;
  if (!stub) return { allowed: false };
  return stub.consume({ limit: rateLimitForScope(scope) });
}

function sourceIp(request) {
  const cfIp = request.cf?.connectingIp;
  if (typeof cfIp === "string" && cfIp.length > 0) return cfIp;
  const headerIp = request.headers.get("CF-Connecting-IP");
  return typeof headerIp === "string" && headerIp.length > 0 ? headerIp : null;
}

function transferStub(env, token) {
  const route = routeFromToken(token);
  const stub = env.TRANSFER_OBJECTS ? euStub(env.TRANSFER_OBJECTS, route) : null;
  if (!stub) throw new Error("transfer binding unavailable");
  return stub;
}

async function handleCreate(request, env, headers) {
  const health = await operationalServiceHealth(env);
  if (!health.createsEnabled) return unavailable(503, headers);
  const ip = sourceIp(request);
  if (!ip) return unavailable(429, headers);
  let body;
  try {
    body = await parseRequest(request, ENDPOINTS.create);
  } catch {
    return unavailable(404, headers);
  }
  let rate;
  try {
    rate = await consumeRate(env, "create", ip);
  } catch {
    return unavailable(429, headers);
  }
  if (!rate?.allowed) return unavailable(429, headers);
  try {
    const routingKey = configKey(env, "TRANSFER_ROUTING_KEY_B64");
    const stub = env.TRANSFER_OBJECTS
      ? euStub(env.TRANSFER_OBJECTS, await routeNameForIdempotencyKey(body.idempotencyKey, routingKey))
      : null;
    if (!stub) return unavailable(500, headers);
    const result = await stub.createRecord({
      idempotencyKey: body.idempotencyKey,
      envelopeJson: contract.canonicalJson(body.envelope),
    });
    if (result.kind === "created") return json({ token: result.token, expiresAt: expiresAtIso(result.expiresAt) }, 201, headers);
    if (result.kind === "duplicate") return json({ duplicate: true, expiresAt: expiresAtIso(result.expiresAt) }, 200, headers);
    return unavailable(404, headers);
  } catch {
    return unavailable(500, headers);
  }
}

async function handleTokenEndpoint(request, env, endpoint, headers) {
  let body;
  try {
    body = await parseRequest(request, endpoint);
  } catch {
    return unavailable(404, headers);
  }
  let stub;
  try {
    stub = transferStub(env, body.token);
  } catch {
    return unavailable(404, headers);
  }
  try {
    const rate = await consumeRate(env, "transfer", body.token);
    if (!rate?.allowed) return unavailable(429, headers);
  } catch {
    return unavailable(429, headers);
  }
  try {
    if (endpoint === ENDPOINTS.claims) {
      const result = await stub.claimRecord({ token: body.token, claimId: body.claimId });
      if (result.kind !== "claimed") return unavailable(404, headers);
      let envelope;
      try { envelope = JSON.parse(result.envelopeJson); } catch { return unavailable(500, headers); }
      return json({ envelope, expiresAt: expiresAtIso(result.expiresAt) }, 200, headers);
    }
    if (endpoint === ENDPOINTS.commit) {
      const result = await stub.commitRecord({ token: body.token, claimId: body.claimId });
      if (result.kind !== "deleted") return unavailable(404, headers);
      return json({ state: "deleted", expiresAt: expiresAtIso(result.expiresAt) }, 200, headers);
    }
    const result = await stub.statusRecord({ token: body.token });
    if (result.kind !== "status") return unavailable(404, headers);
    return json({ state: result.state, expiresAt: expiresAtIso(result.expiresAt) }, 200, headers);
  } catch {
    return unavailable(500, headers);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      const health = await operationalServiceHealth(env);
      return json({
        ok: true,
        service: "install-transfer-foundation",
        createsEnabled: health.createsEnabled,
        operationalHealth: health.operationalHealth,
      });
    }

    const endpoint = url.pathname;
    if (![ENDPOINTS.create, ENDPOINTS.claims, ENDPOINTS.commit, ENDPOINTS.status].includes(endpoint) || url.search || url.hash) {
      return unavailable(404);
    }
    const origin = allowedOrigin(request, env);
    if (!origin) return unavailable(404);
    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      return preflightAllowed(request)
        ? new Response(null, { status: 204, headers: { ...noStoreHeaders, ...headers } })
        : unavailable(404, headers);
    }
    if (request.method !== "POST") return unavailable(404, headers);
    if (endpoint === ENDPOINTS.create) return handleCreate(request, env, headers);
    return handleTokenEndpoint(request, env, endpoint, headers);
  },
};
