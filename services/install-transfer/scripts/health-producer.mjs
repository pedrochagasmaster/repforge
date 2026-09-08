import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseProviderObservation } from "../src/observation.js";

const serviceUrl = requiredUrl();
const watchdogSecret = requiredSecret("TRANSFER_WATCHDOG_SECRET");
const billingSecret = requiredSecret("TRANSFER_BILLING_SECRET");
const observationPath = requiredEnv("TRANSFER_PROVIDER_OBSERVATION_FILE");
const observation = await readObservation(observationPath);
const now = Date.now();
const parsed = parseProviderObservation(observation, {
  now,
  allowTestFixture: process.env.TRANSFER_ALLOW_TEST_OBSERVATION === "true",
});

for (const kind of ["alarm", "watchdog", "log", "key", "deletion"]) {
  const value = parsed.health[kind];
  await post(serviceUrl, watchdogSecret, "/_ops/heartbeat", {
    operationId: randomUUID(),
    checkVersion: value.checkVersion,
    kind,
    result: value.result,
    observedAt: value.observedAt,
    evidenceRef: value.evidenceRef,
  });
}
await post(serviceUrl, billingSecret, "/_ops/billing", {
  operationId: randomUUID(),
  checkVersion: parsed.billing.checkVersion,
  monthlyCostCents: parsed.billing.monthlyCostCents,
  result: parsed.billing.result,
  observedAt: parsed.billing.observedAt,
  evidenceRef: parsed.billing.evidenceRef,
});
console.log("provider health and billing evidence accepted");

async function readObservation(path) {
  let text;
  try { text = await readFile(path, "utf8"); } catch { throw new Error("provider observation file is unavailable"); }
  if (text.length > 16_384) throw new Error("provider observation file is too large");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("provider observation file is invalid JSON"); }
  return value;
}

function requiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function requiredUrl() {
  const value = requiredEnv("TRANSFER_SERVICE_URL");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TRANSFER_SERVICE_URL is invalid"); }
  if (parsed.search || parsed.hash || !((parsed.protocol === "https:") || (parsed.protocol === "http:" && parsed.hostname === "localhost"))) {
    throw new Error("TRANSFER_SERVICE_URL must be an HTTPS origin or localhost URL without query or fragment");
  }
  return parsed.origin;
}

function requiredSecret(name) {
  const value = requiredEnv(name);
  if (value.length < 32 || value.length > 256) throw new Error(`${name} length is invalid`);
  return value;
}

async function post(origin, secret, path, value) {
  let response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(value),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(`provider observation request failed: ${path}`);
  }
  if (!response.ok) throw new Error(`provider observation request rejected: ${path} (${response.status})`);
}
