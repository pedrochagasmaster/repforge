import { randomUUID } from "node:crypto";

const serviceUrl = requiredUrl();
const secret = requiredSecret();
const limit = parseLimit(process.env.TRANSFER_PURGE_LIMIT ?? "100");
const operationId = process.env.TRANSFER_PURGE_OPERATION_ID ?? randomUUID();
const checkVersion = process.env.TRANSFER_PURGE_CHECK_VERSION ?? "manual-purge-v1";
const evidenceRef = process.env.TRANSFER_PURGE_EVIDENCE_REF;
if (!/^[A-Za-z0-9_-]{16,96}$/u.test(operationId)) throw new Error("TRANSFER_PURGE_OPERATION_ID is invalid");
if (!/^[A-Za-z0-9._-]{1,32}$/u.test(checkVersion)) throw new Error("TRANSFER_PURGE_CHECK_VERSION is invalid");
if (typeof evidenceRef !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(evidenceRef)) throw new Error("TRANSFER_PURGE_EVIDENCE_REF is required and invalid");

const response = await post(serviceUrl, secret, {
  operationId,
  checkVersion,
  evidenceRef,
  limit,
});
const result = await boundedJson(response);
if (!exactKeys(result, ["ok", "examined", "purged", "failed", "remainingDue"]) || result.ok !== true
  || !["examined", "purged", "failed", "remainingDue"].every((key) => safeCount(result[key]))) {
  throw new Error("purge response is invalid");
}
console.log(`purge examined=${result.examined} purged=${result.purged} failed=${result.failed} remainingDue=${result.remainingDue}`);

function requiredUrl() {
  const value = process.env.TRANSFER_SERVICE_URL;
  if (typeof value !== "string" || value.length === 0) throw new Error("TRANSFER_SERVICE_URL is required");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TRANSFER_SERVICE_URL is invalid"); }
  if (parsed.search || parsed.hash || !((parsed.protocol === "https:") || (parsed.protocol === "http:" && parsed.hostname === "localhost"))) {
    throw new Error("TRANSFER_SERVICE_URL must be an HTTPS origin or localhost URL without query or fragment");
  }
  return parsed.origin;
}

function requiredSecret() {
  const value = process.env.TRANSFER_PURGE_SECRET;
  if (typeof value !== "string" || value.length < 32 || value.length > 256) throw new Error("TRANSFER_PURGE_SECRET must contain 32-256 characters");
  return value;
}

function parseLimit(value) {
  if (!/^(?:[1-9][0-9]*)$/u.test(value)) throw new Error("TRANSFER_PURGE_LIMIT must be a positive integer");
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > 100) throw new Error("TRANSFER_PURGE_LIMIT must be between 1 and 100");
  return limit;
}

async function post(origin, operatorSecret, value) {
  try {
    const response = await fetch(`${origin}/_ops/purge-due`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${operatorSecret}`,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`operator request rejected (${response.status})`);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("operator request rejected")) throw error;
    throw new Error("operator request failed");
  }
}

async function boundedJson(response) {
  const text = await response.text();
  if (text.length > 4_096) throw new Error("purge response is too large");
  try { return JSON.parse(text); } catch { throw new Error("purge response is not JSON"); }
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
