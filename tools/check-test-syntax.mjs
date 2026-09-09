#!/usr/bin/env node
/** Include nested runners, regression fixtures and scripts, not just a shallow glob. */
import { execFileSync, spawnSync } from "node:child_process";
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "test", "tools", "scripts"], { encoding: "utf8" })
  .split("\0").filter((file) => /\.(mjs|js)$/.test(file));
let failed = 0;
for (const file of [...new Set(files)].sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) { console.error(`Syntax failed: ${file}`); failed++; }
}
console.log(`Syntax: ${files.length} test/tool/script files, ${failed} failures`);
process.exitCode = failed ? 1 : 0;
