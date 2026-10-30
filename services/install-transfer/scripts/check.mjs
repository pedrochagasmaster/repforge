import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const sourceDir = join(root, "src");
const sourceFiles = readdirSync(sourceDir)
  .filter((file) => file.endsWith(".js"))
  .sort()
  .map((file) => join(sourceDir, file));
const scriptsDir = join(root, "scripts");
const scriptFiles = readdirSync(scriptsDir)
  .filter((file) => file.endsWith(".mjs"))
  .sort()
  .map((file) => join(scriptsDir, file));

for (const file of [...sourceFiles, ...scriptFiles]) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const config = JSON.parse(readFileSync(join(root, "wrangler.jsonc"), "utf8"));
if (config.main !== "src/index.js") throw new Error("wrangler main must be src/index.js");
const bindings = config.durable_objects?.bindings ?? [];
if (!bindings.some((binding) => binding.name === "TRANSFER_OBJECTS" && binding.class_name === "TransferDurableObject")) {
  throw new Error("TRANSFER_OBJECTS binding is missing");
}
if (!bindings.some((binding) => binding.name === "RATE_LIMIT_BUCKETS" && binding.class_name === "RateLimitDurableObject")) {
  throw new Error("RATE_LIMIT_BUCKETS binding is missing");
}
if (!bindings.some((binding) => binding.name === "TRANSFER_HEALTH" && binding.class_name === "TransferHealthDurableObject")) {
  throw new Error("TRANSFER_HEALTH binding is missing");
}
if (!bindings.some((binding) => binding.name === "TRANSFER_REGISTRY" && binding.class_name === "TransferRouteRegistryDurableObject")) {
  throw new Error("TRANSFER_REGISTRY binding is missing");
}
const sqliteClasses = config.migrations?.flatMap((migration) => migration.new_sqlite_classes ?? []) ?? [];
for (const className of ["TransferDurableObject", "RateLimitDurableObject", "TransferHealthDurableObject", "TransferRouteRegistryDurableObject"]) {
  if (!sqliteClasses.includes(className)) throw new Error(`${className} SQLite migration is missing`);
}

// The scheduled health watcher (#397) is a separate Worker with no route of its
// own. It reaches the production Worker only through the TRANSFER service
// binding, every two minutes, well inside the five-minute health lease.
const watcher = JSON.parse(readFileSync(join(root, "wrangler.watcher.jsonc"), "utf8"));
if (watcher.name !== "taurifer-install-transfer-watcher" || watcher.main !== "src/watcher.js") throw new Error("watcher name or main is wrong");
if (watcher.workers_dev !== false || watcher.preview_urls !== false || watcher.routes !== undefined || watcher.route !== undefined) {
  throw new Error("watcher must have no route, workers.dev, or preview URL");
}
if (JSON.stringify(watcher.triggers?.crons) !== JSON.stringify(["*/2 * * * *"])) throw new Error("watcher cron must be every two minutes");
if (JSON.stringify(watcher.services) !== JSON.stringify([{ binding: "TRANSFER", service: config.env?.production?.name }])) {
  throw new Error("watcher must bind TRANSFER to the production Worker");
}
// TRANSFER_ALERT_REPO names the one repository the latch alert writes to; its
// token is a secret, never a var.
if (JSON.stringify(watcher.vars) !== JSON.stringify({ TRANSFER_SERVICE_ORIGIN: "https://taurifer.com", TRANSFER_ALERT_REPO: "pedrochagasmaster/repforge" })) {
  throw new Error("watcher vars must hold only the target origin and the alert repository");
}
if (watcher.durable_objects !== undefined || watcher.observability?.enabled !== true) throw new Error("watcher owns no Durable Objects and keeps Workers Logs on");

console.log(`checked ${sourceFiles.length} service source files, ${scriptFiles.length} scripts, and Wrangler configuration`);
