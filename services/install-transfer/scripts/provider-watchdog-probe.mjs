import { parseProviderHealthObservation } from "../src/observation.js";

const endpoint = requiredEndpoint();
const token = process.env.TRANSFER_WATCHDOG_INPUT_TOKEN;
if (token !== undefined && (token.length < 32 || token.length > 256)) {
  throw new Error("TRANSFER_WATCHDOG_INPUT_TOKEN length is invalid");
}

const response = await fetch(endpoint.toString(), {
  headers: token === undefined ? { Accept: "application/json" } : {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  },
  redirect: "error",
  signal: AbortSignal.timeout(10_000),
});
if (!response.ok) throw new Error("watchdog provider observation was rejected");
const text = await response.text();
if (text.length > 16_384) throw new Error("watchdog provider observation is too large");
let value;
try { value = JSON.parse(text); } catch { throw new Error("watchdog provider observation is invalid JSON"); }
const parsed = parseProviderHealthObservation(value, {
  allowTestFixture: process.env.TRANSFER_ALLOW_TEST_OBSERVATION === "true",
});
process.stdout.write(`${JSON.stringify(parsed)}\n`);

function requiredEndpoint() {
  const value = process.env.TRANSFER_WATCHDOG_INPUT_URL;
  if (typeof value !== "string" || value.length === 0) throw new Error("TRANSFER_WATCHDOG_INPUT_URL is required");
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error("TRANSFER_WATCHDOG_INPUT_URL is invalid"); }
  if (parsed.username || parsed.password || parsed.search || parsed.hash
    || !((parsed.protocol === "https:") || (parsed.protocol === "http:" && parsed.hostname === "localhost"))) {
    throw new Error("TRANSFER_WATCHDOG_INPUT_URL must be an HTTPS endpoint without credentials, query, or fragment");
  }
  return parsed;
}
