import { describe, expect, it } from "vitest";
import {
  TOKEN_FORMAT,
  digestIdempotencyKey,
  digestClaimId,
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
    // Computed independently with Node createHmac("sha256") over the published
    // UTF-8 route-domain preimage, without production encoding/crypto helpers.
    expect(first).toBe("transfer-v1-WOsgLwsbdQwOVESzSm0_4DjVsvm0ishiCN9NuqTKlQE");
    expect(await routeNameForIdempotencyKey("same-key", new Uint8Array(32).fill(0x77))).not.toBe(first);
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

  it("accepts a retained previous MAC key only when its public key id selects it", async () => {
    const previous = new Uint8Array(32).fill(0x55);
    const { token } = await mintToken({
      idempotencyKey: "rotated-key",
      routingSecret,
      tokenMacSecret: previous,
      keyId: "k0",
      randomSource: sourceWith(0x45),
    });
    await expect(verifyToken(token, new Map([["k1", tokenMacSecret], ["k0", previous]]))).resolves.toMatchObject({ keyId: "k0" });
    await expect(verifyToken(token, new Map([["k1", tokenMacSecret]]))).rejects.toThrow("invalid transfer token");
  });

  it("pins secret-dependent, domain-separated digest known answers", async () => {
    // Independent Node createHmac("sha256") vectors. Each preimage is the
    // literal domain `taurifer/install-transfer/<kind>/v1\0` plus the input.
    // The token's three binary components are fixed 32-byte values, not minted
    // by the implementation whose digest is being checked.
    const token = "v1.k1.AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE.AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI.AwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwM";
    for (const [digest, input, differentInput, expected] of [
      [digestToken, token, token.replace("v1.k1.", "v1.k2."), "5YiZC_k6yJQCExlpJtlmWR58f-v7bH5ugbpoTfr2Ajw"],
      [digestIdempotencyKey, "same-preimage", "same-preimage!", "QFuCS2ZgCRZ_whvfX5Mw4mzlGwOGagK_Wrw-jdzppRE"],
      [digestClaimId, "same-preimage", "same-preimage!", "1ZuxZyg15rsb7E4yykZycuXws35pv3bqORH15KS8B8A"],
    ]) {
      expect(await digest(input, digestSecret)).toBe(expected);
      expect(await digest(input, new Uint8Array(32).fill(0x77))).not.toBe(expected);
      expect(await digest(differentInput, digestSecret)).not.toBe(expected);
    }
  });
});
