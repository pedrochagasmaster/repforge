#!/usr/bin/env node
/**
 * Canonical syntax gate for the browser application's JavaScript modules.
 *
 * Keep the inventory derived from git so a newly added production module cannot
 * quietly fall outside CI. Test-only modules are intentionally .mjs and have
 * their own gate; the generated, ignored PostHog config is checked after its
 * build step by the config contract.
 */
import { execFileSync, spawnSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "-z", "--", "*.js"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.includes("/"));
const expected = [
  "app.js",
  "exercises.js",
  "i18n.js",
  "notify.js",
  "posthog-init.js",
  "program-compiler.js",
  "program-entry-adapter.js",
  "program-entry.js",
  "progression-engine.js",
  "schedule.js",
  "shared-setup.js",
  "sw.js",
  "telemetry.js",
];
const missing = expected.filter((file) => !files.includes(file));
const unexpected = files.filter((file) => !expected.includes(file));
if (missing.length || unexpected.length) {
  console.error(JSON.stringify({ missing, unexpected, files }, null, 2));
  process.exit(1);
}
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`production syntax: ${files.length} modules pass`);
