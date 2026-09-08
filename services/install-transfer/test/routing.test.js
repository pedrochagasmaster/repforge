import { describe, expect, it } from "vitest";
import {
  TOKEN_FORMAT,
  digestIdempotencyKey,
  digestToken,
  mintToken,
  parseToken,
  routeFromToken,
  routeNameForIdempotencyKey,
  verifyToken,
} from "../src/routing.js";

const routingSecret = new Uint8Array(32).fill(0x11);
const tokenMacSecret = new Uint8Array(32).fill(0x22);
const digestSecret = new Uint8Array(32).fill(0x33);

function sourceWith(byte) {
  return (target) => {
    target.fill(byte);
    return target;
  };
}

describe("opaque transfer routing", () => {
  it("uses a deterministic route and a fresh 256-bit bearer component", async () => {
    const first = await mintToken({
      idempotencyKey: "idem-1",
      routingSecret,
      tokenMacSecret,
      randomSource: sourceWith(0x41),
    });
    const second = await mintToken({
      idempotencyKey: "idem-1",
      routingSecret,
      tokenMacSecret,
      randomSource: sourceWith(0x42),
    });

    expect(TOKEN_FORMAT).toBe("v1.<keyId>.<route-b64url-32>.<random-b64url-32>.<mac-b64url-32>");
    expect(first.token).not.toBe(second.token);
    expect(routeFromToken(first.token)).toBe(routeFromToken(second.token));
    expect(first.random).toHaveLength(32);
    expect(parseToken(first.token).mac).toHaveLength(32);
    expect(first.token.split(".")).toHaveLength(5);
    expect(first.token.length).toBe(137);
    await expect(verifyToken(first.token, new Map([["k1", tokenMacSecret]]))).resolves.toMatchObject({ version: "v1", keyId: "k1" });
  });

  it("routes the same idempotency key to one DO and separates another key", async () => {
    const first = await routeNameForIdempotencyKey("same-key", routingSecret);
    const retry = await routeNameForIdempotencyKey("same-key", routingSecret);
    const other = await routeNameForIdempotencyKey("other-key", routingSecret);
    expect(first).toBe(retry);
    expect(other).not.toBe(first);
    expect(first).toMatch(/^transfer-v1-[A-Za-z0-9_-]{43}$/u);
  });

  it("rejects malformed, tampered, or wrongly keyed bearers", async () => {
    const { token } = await mintToken({
      idempotencyKey: "idem-2",
      routingSecret,
      tokenMacSecret,
      randomSource: sourceWith(0x43),
    });
    const parsed = parseToken(token);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(parsed.route).toHaveLength(32);
    expect(() => parseToken("plain-base64url-token")).toThrow();
    expect(() => parseToken(token.replace(/\.([^.]*)$/, ".$1A"))).toThrow();
    await expect(verifyToken(tampered, new Map([["k1", tokenMacSecret]]))).rejects.toThrow("invalid transfer token");
    await expect(verifyToken(token, new Map([["k1", new Uint8Array(32).fill(0x99)]]))).rejects.toThrow("invalid transfer token");
  });

  it("stores only keyed digests for idempotency and token lookup", async () => {
    const { token } = await mintToken({
      idempotencyKey: "idem-3",
      routingSecret,
      tokenMacSecret,
      randomSource: sourceWith(0x44),
    });
    const tokenDigest = await digestToken(token, digestSecret);
    const idempotencyDigest = await digestIdempotencyKey("idem-3", digestSecret);
    expect(tokenDigest).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(idempotencyDigest).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(tokenDigest).not.toContain(token);
    expect(idempotencyDigest).not.toContain("idem-3");
  });
});
