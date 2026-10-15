// Watcher secret provisioning (#397).
//
//   node scripts/provision-watcher-secrets.mjs
//     Reads the 0600 production ops env file and pipes the watcher's secrets as
//     one JSON object to `wrangler secret bulk --config wrangler.watcher.jsonc`
//     on stdin. Run it again after rotating any of these values.
//
// The watcher gets only what one health pass uses: the watchdog, billing and
// purge bearers, the scoped Durable Object list token, the account and
// namespace ids, and the attested monthly cost. The ack bearer stays with the
// owner. No value is printed, logged, or passed in argv.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVICE_ORIGIN, assertPrivatePath, defaultOpsEnvPath, parseOpsEnv } from "./provision-production-secrets.mjs";
import { readyOpsValues } from "./production-health-loop.mjs";

export const WATCHER_CONFIG = "wrangler.watcher.jsonc";
export const WATCHER_SECRET_KEYS = Object.freeze([
  "TRANSFER_WATCHDOG_SECRET",
  "TRANSFER_BILLING_SECRET",
  "TRANSFER_PURGE_SECRET",
  "TRANSFER_CF_API_TOKEN",
  "TRANSFER_CF_ACCOUNT_ID",
  "TRANSFER_DO_NAMESPACE_ID",
  "TRANSFER_ATTESTED_MONTHLY_COST_CENTS",
]);

const SERVICE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export function watcherSecretPayload(values) {
  const ready = readyOpsValues(values);
  // The watcher's target origin is the TRANSFER_SERVICE_ORIGIN var in its config.
  if (ready.TRANSFER_SERVICE_URL !== SERVICE_ORIGIN) throw new Error("ops env service URL does not match the watcher's target origin");
  return Object.fromEntries(WATCHER_SECRET_KEYS.map((key) => [key, ready[key]]));
}

function wranglerSecretBulk(payload) {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["wrangler", "secret", "bulk", "--config", WATCHER_CONFIG], {
      cwd: SERVICE_DIR,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.on("error", () => reject(new Error("wrangler could not start")));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret bulk exited ${code}`))));
    child.stdin.end(JSON.stringify(payload));
  });
}

export async function provisionWatcherSecrets({ opsEnvPath = defaultOpsEnvPath(), bulk = wranglerSecretBulk } = {}) {
  assertPrivatePath(opsEnvPath);
  const payload = watcherSecretPayload(parseOpsEnv(readFileSync(opsEnvPath, "utf8")));
  await bulk(payload);
  return Object.keys(payload).length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const count = await provisionWatcherSecrets();
    console.log(`provisioned ${count} watcher secrets for taurifer-install-transfer-watcher`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "watcher provisioning failed");
    process.exit(1);
  }
}
