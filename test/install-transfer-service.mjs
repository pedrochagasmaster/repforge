#!/usr/bin/env node
/** Runs the complete isolated Worker gate from the repository inventory. */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE = resolve(dirname(fileURLToPath(import.meta.url)), "../services/install-transfer");

for (const args of [["run", "check"], ["test"], ["run", "deploy:dry"]]) {
  execFileSync("npm", args, { cwd: SERVICE, env: process.env, stdio: "inherit" });
}

console.log("install-transfer service: check, tests, and dry deployment passed");
