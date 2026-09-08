import { base64UrlEncode, hmacSha256, utf8 } from "./crypto.js";

const RATE_DOMAIN = utf8("taurifer/install-transfer/rate-bucket/v1\0");

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

export async function rateBucketName({ scope, identity, pepper }) {
  if (typeof scope !== "string" || !/^[a-z-]{1,32}$/u.test(scope)) throw new TypeError("invalid rate scope");
  if (typeof identity !== "string" || identity.length === 0) throw new TypeError("identity must be non-empty");
  if (!(pepper instanceof Uint8Array) || pepper.length < 32) throw new RangeError("pepper must contain at least 256 bits");
  const digest = await hmacSha256(pepper, concat(RATE_DOMAIN, utf8(scope), utf8("\0"), utf8(identity)));
  return `rate-v1-${scope}-${base64UrlEncode(digest)}`;
}

export function rateLimitForScope(scope) {
  if (scope === "create") return 5;
  if (scope === "transfer") return 60;
  throw new TypeError("unknown rate scope");
}
