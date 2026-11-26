#!/usr/bin/env node
/**
 * Runs the isolated Worker gates from the repository inventory: install
 * transfer, then the trainer relay (Plan 086 slice 1). The relay shares this
 * service-lane command because the pull-request lane is held at half the
 * baseline command count (test/ci.mjs).
 */
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICE = resolve(dirname(fileURLToPath(import.meta.url)), "../services/install-transfer");
const RELAY = resolve(dirname(fileURLToPath(import.meta.url)), "../services/trainer-relay");

for (const args of [["run", "check"], ["test"], ["run", "deploy:dry"], ["run", "deploy:dry:production"], ["run", "deploy:dry:watcher"]]) {
  execFileSync("npm", args, { cwd: SERVICE, env: process.env, stdio: "inherit" });
}

console.log("install-transfer service: check, tests, and dry deployment passed");

for (const args of [["test"], ["run", "deploy:dry:staging"]]) {
  execFileSync("npm", args, { cwd: RELAY, env: process.env, stdio: "inherit" });
}

console.log("trainer relay service: proofs and dry deployment passed");
