const encoder = new TextEncoder();

export const AEAD_PROTOCOL = "taurifer/install-transfer/aead/v1";
export const AEAD_SALT_BYTES = 16;
export const AEAD_NONCE_BYTES = 12;
export const AEAD_TAG_BITS = 128;

function bytes(value, name) {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`${name} must be a Uint8Array`);
  }
  return value;
}

export function utf8(value) {
  if (typeof value !== "string") {
    throw new TypeError("value must be a string");
  }
  return encoder.encode(value);
}

export function wipeBytes(value) {
  if (value instanceof Uint8Array) {
    value.fill(0);
  }
}

export function base64UrlEncode(value) {
  const input = bytes(value, "value");
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/u.test(value)) {
    throw new TypeError("value must be unpadded base64url");
  }
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new TypeError("value must be valid base64url");
  }
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

export function constantTimeEqual(left, right) {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array)) return false;
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index % (left.length || 1)] ?? 0) ^ (right[index % (right.length || 1)] ?? 0);
  }
  return difference === 0;
}

function requireSecret(secret, name) {
  bytes(secret, name);
  if (secret.length < 32) throw new RangeError(`${name} must contain at least 256 bits`);
  return secret;
}

export async function hmacSha256(secret, value) {
  const keyBytes = requireSecret(secret, "secret");
  const dataBytes = bytes(value, "value");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, dataBytes));
}

async function deriveAeadKey(token, salt, usage) {
  const tokenBytes = utf8(token);
  try {
    const baseKey = await crypto.subtle.importKey("raw", tokenBytes, { name: "HKDF" }, false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt,
        info: utf8(AEAD_PROTOCOL),
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      [usage],
    );
  } finally {
    wipeBytes(tokenBytes);
  }
}

function associatedData(value) {
  return value === undefined ? utf8(AEAD_PROTOCOL) : bytes(value, "associatedData");
}

export async function encryptRecord({ token, plaintext, salt, nonce, associatedData: aad }) {
  if (typeof token !== "string" || token.length === 0) throw new TypeError("token must be non-empty");
  const clear = bytes(plaintext, "plaintext");
  const recordSalt = salt === undefined ? crypto.getRandomValues(new Uint8Array(AEAD_SALT_BYTES)) : bytes(salt, "salt");
  const recordNonce = nonce === undefined ? crypto.getRandomValues(new Uint8Array(AEAD_NONCE_BYTES)) : bytes(nonce, "nonce");
  if (recordSalt.length !== AEAD_SALT_BYTES) throw new RangeError("salt must be 16 bytes");
  if (recordNonce.length !== AEAD_NONCE_BYTES) throw new RangeError("nonce must be 12 bytes");
  const data = associatedData(aad);
  const key = await deriveAeadKey(token, recordSalt, "encrypt");
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: recordNonce, additionalData: data, tagLength: AEAD_TAG_BITS },
    key,
    clear,
  ));
  return {
    version: 1,
    salt: base64UrlEncode(recordSalt),
    nonce: base64UrlEncode(recordNonce),
    associatedData: base64UrlEncode(data),
    ciphertext: base64UrlEncode(ciphertext),
  };
}

export async function decryptRecord({ token, record }) {
  if (typeof token !== "string" || token.length === 0) throw new TypeError("token must be non-empty");
  if (!record || record.version !== 1) throw new TypeError("unsupported encrypted record");
  const salt = base64UrlDecode(record.salt);
  const nonce = base64UrlDecode(record.nonce);
  const data = base64UrlDecode(record.associatedData);
  const ciphertext = base64UrlDecode(record.ciphertext);
  if (salt.length !== AEAD_SALT_BYTES || nonce.length !== AEAD_NONCE_BYTES) {
    throw new TypeError("invalid encrypted record nonce or salt");
  }
  const key = await deriveAeadKey(token, salt, "decrypt");
  try {
    return new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: data, tagLength: AEAD_TAG_BITS },
      key,
      ciphertext,
    ));
  } catch {
    throw new Error("aead authentication failed");
  }
}

export async function encryptJson({ token, value, ...options }) {
  if (typeof value !== "string") throw new TypeError("value must be a JSON string");
  return encryptRecord({ token, plaintext: utf8(value), ...options });
}

export async function decryptJson({ token, record }) {
  const clear = await decryptRecord({ token, record });
  try {
    return new TextDecoder().decode(clear);
  } finally {
    wipeBytes(clear);
  }
}
