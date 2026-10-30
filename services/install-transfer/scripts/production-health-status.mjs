// Reads the production health lease once: GET /_ops/health with the watchdog
// bearer from the 0600 ops env file. Prints only the lease and incident fields
// and the last deletion check (versions, times and failure classes; no IDs),
// plus the failure that raised the current generation and the counts of
// provider steps the watcher retried.
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
  // The failure that raised the current generation, from its own route; a
  // Worker without that route answers the generic 404.
  const evidence = await fetch(new URL("/_ops/deletion-evidence", origin), {
    headers: { Authorization: `Bearer ${values.TRANSFER_WATCHDOG_SECRET}`, "Cache-Control": "no-store" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const unavailableEvidence = `unavailable (${evidence.status})`;
  const evidenceBody = evidence.ok ? await evidence.json() : null;
  return {
    ...Object.fromEntries(FIELDS.map((field) => [field, body?.[field]])),
    lastDeletionFailure: evidence.ok ? evidenceBody?.lastDeletionFailure ?? null : unavailableEvidence,
    providerRetries: evidence.ok ? evidenceBody?.providerRetries ?? null : unavailableEvidence,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify({ checkedAt: new Date().toISOString(), ...(await readHealth()) }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "health read failed");
    process.exit(1);
  }
}
