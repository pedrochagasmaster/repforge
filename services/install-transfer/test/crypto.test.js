import { describe, expect, it } from "vitest";
import {
  AEAD_NONCE_BYTES,
  AEAD_SALT_BYTES,
  base64UrlDecode,
  decryptJson,
  decryptRecord,
  encryptJson,
  encryptRecord,
  wipeBytes,
} from "../src/crypto.js";

const token = "t1.route-placeholder.random-placeholder.mac-placeholder";

describe("token-derived encrypted records", () => {
  it("round-trips JSON while storing ciphertext and fresh record material", async () => {
    const first = await encryptJson({ token, value: JSON.stringify({ logical: "payload", count: 3 }) });
    const second = await encryptJson({ token, value: JSON.stringify({ logical: "payload", count: 3 }) });

    expect(first.version).toBe(1);
    expect(base64UrlDecode(first.salt)).toHaveLength(AEAD_SALT_BYTES);
    expect(base64UrlDecode(first.nonce)).toHaveLength(AEAD_NONCE_BYTES);
    expect(first.salt).not.toBe(second.salt);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toContain("payload");
    expect(JSON.stringify(first)).not.toContain(token);
    await expect(decryptJson({ token, record: first })).resolves.toBe(JSON.stringify({ logical: "payload", count: 3 }));
  });

  it("rejects ciphertext, associated-data, and credential tampering", async () => {
    const record = await encryptJson({ token, value: JSON.stringify({ logical: "payload" }) });
    const ciphertext = base64UrlDecode(record.ciphertext);
    ciphertext[0] ^= 1;
    await expect(decryptRecord({ token, record: { ...record, ciphertext: btoa(String.fromCharCode(...ciphertext)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "") } })).rejects.toThrow("aead authentication failed");
    await expect(decryptJson({ token: `${token}-wrong`, record })).rejects.toThrow("aead authentication failed");
    await expect(decryptJson({ token, record: { ...record, associatedData: record.associatedData.slice(0, -1) + (record.associatedData.endsWith("A") ? "B" : "A") } })).rejects.toThrow();
  });

  it("wipes transient byte material when explicitly disposed", () => {
    const transient = new Uint8Array([1, 2, 3, 4]);
    wipeBytes(transient);
    expect([...transient]).toEqual([0, 0, 0, 0]);
  });
});
