// Reads the production health lease once: GET /_ops/health with the watchdog
// bearer from the 0600 ops env file. Prints only the lease and incident fields
// and the last deletion check (versions, times and failure classes; no IDs).
// Used to verify the scheduled watcher (#397) without putting a bearer in argv
// or shell history.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertPrivatePath, defaultOpsEnvPath, parseOpsEnv } from "./provision-production-secrets.mjs";

const FIELDS = ["leaseFresh", "deletionHealthy", "billingHealthy", "createsEnabled", "incidentGeneration", "ackGeneration", "lastDeletionCheck"];

export async function readHealth(opsEnvPath = defaultOpsEnvPath()) {
  assertPrivatePath(opsEnvPath);
  const values = parseOpsEnv(readFileSync(opsEnvPath, "utf8"));
  const origin = new URL(values.TRANSFER_SERVICE_URL ?? "");
  if (!(origin.protocol === "https:" || (origin.protocol === "http:" && origin.hostname === "localhost"))) throw new Error("ops env service URL is invalid");
  const response = await fetch(new URL("/_ops/health", origin), {
    headers: { Authorization: `Bearer ${values.TRANSFER_WATCHDOG_SECRET}`, "Cache-Control": "no-store" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`health request returned ${response.status}`);
  const body = await response.json();
  return Object.fromEntries(FIELDS.map((field) => [field, body?.[field]]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...(await readHealth()) }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "health read failed");
    process.exit(1);
  }
}
