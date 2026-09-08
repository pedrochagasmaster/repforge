import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(new URL("..", import.meta.url).pathname);
const sourceDir = join(root, "src");
const sourceFiles = readdirSync(sourceDir)
  .filter((file) => file.endsWith(".js"))
  .sort()
  .map((file) => join(sourceDir, file));

for (const file of sourceFiles) {
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

console.log(`checked ${sourceFiles.length} service source files and Wrangler configuration`);
