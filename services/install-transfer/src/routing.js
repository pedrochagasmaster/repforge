import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  hmacSha256,
  utf8,
} from "./crypto.js";

export const TOKEN_VERSION = "v1";
export const ROUTE_BYTES = 32;
export const TOKEN_RANDOM_BYTES = 32;
export const TOKEN_MAC_BYTES = 32;
export const TOKEN_FORMAT = "v1.<keyId>.<route-b64url-32>.<random-b64url-32>.<mac-b64url-32>";

const routeDomain = utf8("taurifer/install-transfer/route/v1\0");
const tokenMacDomain = utf8("taurifer/install-transfer/token-mac/v1\0");
const digestDomain = utf8("taurifer/install-transfer/token-digest/v1\0");
const idempotencyDomain = utf8("taurifer/install-transfer/idempotency/v1\0");
const claimDomain = utf8("taurifer/install-transfer/claim-id/v1\0");

function concat(...values) {
  const total = values.reduce((sum, value) => sum + value.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const value of values) {
    result.set(value, offset);
    offset += value.length;
  }
  return result;
}

function tokenMacInput(keyId, route, random) {
  return concat(tokenMacDomain, utf8(`${TOKEN_VERSION}.${keyId}.${base64UrlEncode(route)}.${base64UrlEncode(random)}`));
}

function assertSecret(secret, name) {
  if (!(secret instanceof Uint8Array) || secret.length < 32) throw new RangeError(`${name} must contain at least 256 bits`);
}

export async function deriveRoute(idempotencyKey, routingSecret) {
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) throw new TypeError("idempotencyKey must be non-empty");
  assertSecret(routingSecret, "routingSecret");
  return hmacSha256(routingSecret, concat(routeDomain, utf8(idempotencyKey)));
}

export function routeName(route) {
  if (!(route instanceof Uint8Array) || route.length !== ROUTE_BYTES) throw new RangeError("route must be 32 bytes");
  return `transfer-v1-${base64UrlEncode(route)}`;
}

export async function routeNameForIdempotencyKey(idempotencyKey, routingSecret) {
  return routeName(await deriveRoute(idempotencyKey, routingSecret));
}

export function parseToken(token) {
  if (typeof token !== "string" || token.length === 0 || token.length > 512) throw new TypeError("invalid transfer token");
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) throw new TypeError("invalid transfer token");
  const [version, keyId, routePart, randomPart, macPart] = parts;
  if (!/^[A-Za-z0-9_-]{1,16}$/u.test(keyId) || ![routePart, randomPart, macPart].every((part) => /^[A-Za-z0-9_-]+$/u.test(part))) throw new TypeError("invalid transfer token");
  const route = base64UrlDecode(routePart);
  const random = base64UrlDecode(randomPart);
  const mac = base64UrlDecode(macPart);
  if (route.length !== ROUTE_BYTES || random.length !== TOKEN_RANDOM_BYTES || mac.length !== TOKEN_MAC_BYTES) {
    throw new TypeError("invalid transfer token");
  }
  return { version, keyId, route, random, mac, routePart, randomPart, macPart };
}

export function routeFromToken(token) {
  return routeName(parseToken(token).route);
}

export async function mintToken({ idempotencyKey, routingSecret, tokenMacSecret, keyId = "k1", randomSource = crypto.getRandomValues.bind(crypto) }) {
  assertSecret(tokenMacSecret, "tokenMacSecret");
  if (!/^[A-Za-z0-9_-]{1,16}$/u.test(keyId)) throw new RangeError("keyId must be 1-16 ASCII key characters");
  const route = await deriveRoute(idempotencyKey, routingSecret);
  const random = new Uint8Array(TOKEN_RANDOM_BYTES);
  randomSource(random);
  const routePart = base64UrlEncode(route);
  const randomPart = base64UrlEncode(random);
  const mac = await hmacSha256(tokenMacSecret, tokenMacInput(keyId, route, random));
  const token = `${TOKEN_VERSION}.${keyId}.${routePart}.${randomPart}.${base64UrlEncode(mac)}`;
  return { token, keyId, route, random, mac };
}

export async function verifyToken(token, tokenMacSecrets) {
  const parsed = parseToken(token);
  const secret = tokenMacSecrets instanceof Map ? tokenMacSecrets.get(parsed.keyId) : tokenMacSecrets?.[parsed.keyId];
  if (secret) {
    assertSecret(secret, "tokenMacSecret");
    const candidate = await hmacSha256(secret, tokenMacInput(parsed.keyId, parsed.route, parsed.random));
    if (constantTimeEqual(candidate, parsed.mac)) return parsed;
  }
  throw new Error("invalid transfer token");
}

export async function digestToken(token, digestSecret) {
  assertSecret(digestSecret, "tokenDigestSecret");
  parseToken(token);
  return base64UrlEncode(await hmacSha256(digestSecret, concat(digestDomain, utf8(token))));
}

export async function digestIdempotencyKey(idempotencyKey, digestSecret) {
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) throw new TypeError("idempotencyKey must be non-empty");
  assertSecret(digestSecret, "idempotencyDigestSecret");
  return base64UrlEncode(await hmacSha256(digestSecret, concat(idempotencyDomain, utf8(idempotencyKey))));
}

export async function digestClaimId(claimId, digestSecret) {
  if (typeof claimId !== "string" || claimId.length === 0) throw new TypeError("claimId must be non-empty");
  assertSecret(digestSecret, "claimDigestSecret");
  return base64UrlEncode(await hmacSha256(digestSecret, concat(claimDomain, utf8(claimId))));
}
