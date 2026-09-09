import contract from "../../../install-transfer-contract.js";
import { base64UrlDecode } from "./crypto.js";
import { operationalServiceHealth } from "./operations.js";
import { rateBucketName, rateLimitForScope } from "./rate-limit.js";
import { routeFromToken, routeNameForIdempotencyKey, verifyToken } from "./routing.js";
import { RateLimitDurableObject } from "./rate-limit-do.js";
import { TransferDurableObject } from "./transfer-do.js";
import { TransferHealthDurableObject } from "./health-do.js";
import { TransferRouteRegistryDurableObject } from "./registry-do.js";
import { euStub } from "./namespaces.js";
import { handleOperations } from "./ops.js";
import {
  TRANSPORT_ERROR_CODES,
  TransportError,
  assertJsonRequest,
  readBoundedRequestBytes,
} from "./transport.js";

export {
  TransferDurableObject,
  RateLimitDurableObject,
  TransferHealthDurableObject,
  TransferRouteRegistryDurableObject,
};
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

function boundedJson(value, status, extraHeaders, maxBytes) {
  const body = JSON.stringify(value);
  if (contract.measureUtf8Bytes(body) > maxBytes) return unavailable(503, extraHeaders);
  return new Response(body, {
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

function euOptions(env) {
  return { allowLocalFallback: env.TRANSFER_LOCAL_TEST_EU === "true" };
}

function tokenMacKeys(env) {
  const activeId = env.TRANSFER_TOKEN_MAC_KEY_ID;
  if (typeof activeId !== "string" || !/^[A-Za-z0-9_-]{1,16}$/u.test(activeId)) throw new Error("configuration unavailable");
  const keys = new Map([[activeId, configKey(env, "TRANSFER_TOKEN_MAC_KEY_B64")]]);
  if (env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID || env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64) {
    const previousId = env.TRANSFER_TOKEN_MAC_PREVIOUS_KEY_ID;
    if (typeof previousId !== "string" || !/^[A-Za-z0-9_-]{1,16}$/u.test(previousId)) throw new Error("configuration unavailable");
    keys.set(previousId, configKey(env, "TRANSFER_TOKEN_MAC_PREVIOUS_KEY_B64"));
  }
  return keys;
}

async function verifiedRouteFromToken(env, token) {
  await verifyToken(token, tokenMacKeys(env));
  return routeFromToken(token);
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
  const stub = env.RATE_LIMIT_BUCKETS ? euStub(env.RATE_LIMIT_BUCKETS, name, euOptions(env)) : null;
  if (!stub) return { allowed: false };
  return stub.consume({ limit: rateLimitForScope(scope) });
}

function sourceIp(request) {
  const cfIp = request.cf?.connectingIp;
  if (typeof cfIp === "string" && cfIp.length > 0) return cfIp;
  const headerIp = request.headers.get("CF-Connecting-IP");
  return typeof headerIp === "string" && headerIp.length > 0 ? headerIp : null;
}

function registryStub(env) {
  const stub = env.TRANSFER_REGISTRY ? euStub(env.TRANSFER_REGISTRY, "global", euOptions(env)) : null;
  if (!stub) throw new Error("registry binding unavailable");
  return stub;
}

async function markDeletionUnhealthy(env, code) {
  try {
    const stub = env.TRANSFER_HEALTH ? euStub(env.TRANSFER_HEALTH, "global", euOptions(env)) : null;
    if (stub?.markDeletionUnhealthy) await stub.markDeletionUnhealthy({ code });
  } catch {
    // The create gate remains closed when the health object cannot be reached.
  }
}

async function handleCreate(request, env, headers) {
  const health = await operationalServiceHealth(env);
  if (!health.createsEnabled) return unavailable(503, headers);
  const ip = sourceIp(request);
  if (!ip) return unavailable(429, headers);
  let rate;
  try {
    rate = await consumeRate(env, "create", ip);
  } catch {
    return unavailable(429, headers);
  }
  if (!rate?.allowed) return unavailable(429, headers);
  let body;
  try {
    body = await parseRequest(request, ENDPOINTS.create);
  } catch {
    return unavailable(404, headers);
  }
  try {
    const routingKey = configKey(env, "TRANSFER_ROUTING_KEY_B64");
    const routeName = await routeNameForIdempotencyKey(body.idempotencyKey, routingKey);
    let registry;
    try {
      registry = registryStub(env);
    } catch {
      await markDeletionUnhealthy(env, "registry-binding");
      return unavailable(503, headers);
    }
    const reservationNow = Date.now();
    let reservation;
    try {
      reservation = await registry.reserveRoute({ routeName, now: reservationNow });
    } catch {
      await markDeletionUnhealthy(env, "registry-reservation");
      return unavailable(503, headers);
    }
    const stub = env.TRANSFER_OBJECTS ? euStub(env.TRANSFER_OBJECTS, routeName, euOptions(env)) : null;
    if (!stub) {
      await markDeletionUnhealthy(env, "transfer-binding");
      return unavailable(503, headers);
    }
    const result = await stub.createRecord({
      idempotencyKey: body.idempotencyKey,
      envelopeJson: contract.canonicalJson(body.envelope),
      requestedExpiry: reservation.maxTransferExpiresAt,
    });
    if (["created", "duplicate", "terminal"].includes(result.kind) && Number.isSafeInteger(result.expiresAt)) {
      try {
        await registry.setLifetime({
          routeName,
          expiresAt: result.expiresAt,
          state: result.kind === "terminal" ? result.state : "available",
          now: Date.now(),
        });
      } catch {
        await markDeletionUnhealthy(env, "registry-lifetime");
        return unavailable(503, headers);
      }
    }
    if (result.kind === "created") return json({ token: result.token, expiresAt: expiresAtIso(result.expiresAt) }, 201, headers);
    if (result.kind === "duplicate") return json({ duplicate: true, expiresAt: expiresAtIso(result.expiresAt) }, 200, headers);
    return unavailable(404, headers);
  } catch {
    return unavailable(503, headers);
  }
}

async function handleTokenEndpoint(request, env, endpoint, headers) {
  let body;
  try {
    body = await parseRequest(request, endpoint);
  } catch {
    return unavailable(404, headers);
  }
  let route;
  try {
    route = await verifiedRouteFromToken(env, body.token);
  } catch {
    return unavailable(404, headers);
  }
  let stub;
  try {
    const rate = await consumeRate(env, "transfer", body.token);
    if (!rate?.allowed) return unavailable(429, headers);
    stub = env.TRANSFER_OBJECTS ? euStub(env.TRANSFER_OBJECTS, route, euOptions(env)) : null;
    if (!stub) return unavailable(503, headers);
  } catch {
    return unavailable(503, headers);
  }
  try {
    if (endpoint === ENDPOINTS.claims) {
      const result = await stub.claimRecord({ token: body.token, claimId: body.claimId });
      if (result.kind !== "claimed") return unavailable(404, headers);
      let envelope;
      try { envelope = JSON.parse(result.envelopeJson); } catch { return unavailable(500, headers); }
      return boundedJson(
        { envelope, expiresAt: expiresAtIso(result.expiresAt) },
        200,
        headers,
        contract.LIMITS.claimResponseBytes,
      );
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
    return unavailable(503, headers);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const operationsResponse = await handleOperations(request, env);
    if (operationsResponse) return operationsResponse;
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
