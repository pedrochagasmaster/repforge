import contract from "../../../trainer-relay-contract.js";

export const { base64UrlEncode, base64UrlDecode } = contract;

export function utf8(text) {
  return new TextEncoder().encode(text);
}

export async function hmacSha256(keyBytes, messageBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, messageBytes));
}

/** A configured secret of at least 256 bits, as unpadded base64url. */
export function configKey(env, name) {
  const value = env[name];
  const decoded = typeof value === "string" ? base64UrlDecode(value) : null;
  if (!decoded || decoded.length < 32) throw new Error("configuration unavailable");
  return decoded;
}

/** Constant-time comparison of two strings' UTF-8 bytes. */
export function timingSafeEqualText(left, right) {
  const a = utf8(typeof left === "string" ? left : "");
  const b = utf8(typeof right === "string" ? right : "");
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

// The Durable Object for a record is named by a keyed hash of its id, so the
// provider's object names and a storage image never contain a link's id.
const RECORD_DOMAIN = "taurifer/trainer-relay/record/v1\0";
const RATE_DOMAIN = "taurifer/trainer-relay/rate/v1\0";

export async function recordObjectName(id, routingKey) {
  return "record-v1-" + base64UrlEncode(await hmacSha256(routingKey, utf8(RECORD_DOMAIN + id)));
}

export async function rateBucketName(scope, identity, pepper) {
  if (!/^[a-z-]{1,32}$/u.test(scope) || typeof identity !== "string" || !identity) throw new TypeError("invalid rate bucket");
  return "rate-v1-" + scope + "-" + base64UrlEncode(await hmacSha256(pepper, utf8(RATE_DOMAIN + scope + "\0" + identity)));
}
