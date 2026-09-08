import { randomBytes, randomUUID } from "node:crypto";

const serviceUrl = requiredUrl();
const secret = requiredSecret();
const evidenceRef = process.env.TRANSFER_ACK_EVIDENCE_REF;
const checkVersion = process.env.TRANSFER_ACK_CHECK_VERSION ?? "manual-ack-v1";
const operationId = process.env.TRANSFER_ACK_OPERATION_ID ?? randomUUID();
if (process.env.TRANSFER_ACK_CONFIRM !== "I_HAVE_REVIEWED_DELETION") {
  throw new Error("set TRANSFER_ACK_CONFIRM=I_HAVE_REVIEWED_DELETION after the deletion runbook checks");
}
if (typeof evidenceRef !== "string" || !/^[A-Za-z0-9_-]{1,128}$/u.test(evidenceRef)) throw new Error("TRANSFER_ACK_EVIDENCE_REF is required and invalid");
if (!/^[A-Za-z0-9._-]{1,32}$/u.test(checkVersion)) throw new Error("TRANSFER_ACK_CHECK_VERSION is invalid");
if (!/^[A-Za-z0-9_-]{16,96}$/u.test(operationId)) throw new Error("TRANSFER_ACK_OPERATION_ID is invalid");

const health = await getHealth(serviceUrl, secret);
if (health.deletionHealthy === true) throw new Error("deletion health is already enabled; refusing an automatic acknowledgement");
if (!Number.isSafeInteger(health.incidentGeneration) || health.incidentGeneration < 1) {
  throw new Error("health response has no current incident generation");
}

const response = await acknowledge(serviceUrl, secret, {
  operationId,
  generation: health.incidentGeneration,
  checkVersion,
  proofNonce: randomBytes(32).toString("base64url"),
  observedAt: Date.now(),
  evidenceRef,
});
const result = await boundedJson(response);
if (!exactKeys(result, ["ok", "acknowledged", "createsEnabled"]) || result.ok !== true || result.acknowledged !== true) {
  throw new Error("deletion acknowledgement response is invalid");
}
console.log("deletion incident acknowledgement accepted");

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
  const value = process.env.TRANSFER_ACK_SECRET;
  if (typeof value !== "string" || value.length < 32 || value.length > 256) throw new Error("TRANSFER_ACK_SECRET must contain 32-256 characters");
  return value;
}

async function getHealth(origin, operatorSecret) {
  let response;
  try {
    response = await fetch(`${origin}/_ops/health`, {
      headers: { Authorization: `Bearer ${operatorSecret}`, "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error("operator health request failed");
  }
  if (!response.ok) throw new Error(`operator health request rejected (${response.status})`);
  const value = await boundedJson(response);
  if (!exactKeys(value, ["ok", "leaseFresh", "deletionHealthy", "billingHealthy", "createsEnabled", "incidentGeneration", "ackGeneration"]) || value.ok !== true) {
    throw new Error("operator health response is invalid");
  }
  return value;
}

async function acknowledge(origin, operatorSecret, value) {
  try {
    const response = await fetch(`${origin}/_ops/deletion-ack`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${operatorSecret}`,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`operator acknowledgement rejected (${response.status})`);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("operator acknowledgement rejected")) throw error;
    throw new Error("operator acknowledgement request failed");
  }
}

async function boundedJson(response) {
  const text = await response.text();
  if (text.length > 4_096) throw new Error("operator response is too large");
  try { return JSON.parse(text); } catch { throw new Error("operator response is not JSON"); }
}

function exactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
