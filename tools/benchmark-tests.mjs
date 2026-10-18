#!/usr/bin/env node
/** Paired full-inventory timing; diagnostic evidence, never a substitute for ci. */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { cpus, platform, release, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { CI_SHARDS } from "../test/suites.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED = "147443";
const git = args => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function summarizeBenchmark(records, shards = CI_SHARDS) {
  const scopes = ["fast", "service", ...Array.from({ length: shards }, (_, i) => `${i + 1}/${shards}`)];
  if (records.length !== scopes.length || new Set(records.map(r => r.scope)).size !== scopes.length
      || scopes.some(scope => !records.some(r => r.scope === scope))) throw new Error("Incomplete or duplicate benchmark scope");
  const identity = JSON.stringify([records[0].base, records[0].head, records[0].seed]);
  if (records.some(r => JSON.stringify([r.base, r.head, r.seed]) !== identity)) throw new Error("Benchmark source/seed identity differs between workers");
  const totals = {};
  for (const phase of ["before", "after"]) {
    const ids = new Set();
    let inventory;
    let runnerMs = 0, executionWallMs = 0;
    for (const worker of records) {
      const parts = worker.phases.filter(p => p.phase === phase);
      if (parts.length !== 1) throw new Error(`Missing or duplicate ${phase} phase`);
      const part = parts[0];
      inventory ||= part.inventory;
      if (!Array.isArray(inventory) || JSON.stringify(inventory) !== JSON.stringify(part.inventory)) throw new Error("Complete inventory differs between workers");
      const actual = part.rows.map(r => r.id).sort();
      if (JSON.stringify(actual) !== JSON.stringify([...part.expected].sort())) throw new Error(`${phase}/${worker.scope}: incomplete inventory`);
      if (!part.commandsPassed || part.rows.some(r => r.status !== "passed")) throw new Error(`${phase}/${worker.scope}: every initial execution must have passed`);
      for (const row of part.rows) {
        if (ids.has(row.id)) throw new Error(`${phase}: duplicate suite ${row.id}`);
        if (!Number.isFinite(row.durationMs) || row.durationMs < 0) throw new Error("Invalid suite duration");
        ids.add(row.id); runnerMs += row.durationMs;
      }
      if (!Number.isFinite(part.durationMs) || part.durationMs < 0) throw new Error("Invalid worker duration");
      executionWallMs = Math.max(executionWallMs, part.durationMs);
    }
    if (JSON.stringify([...ids].sort()) !== JSON.stringify(inventory.map(e => e.id).sort())) throw new Error(`${phase}: missing complete inventory evidence`);
    totals[phase] = { commands: ids.size, files: new Set(inventory.map(e => e.file)).size, runnerMs, executionWallMs };
  }
  return { base: records[0].base, head: records[0].head, seed: records[0].seed, browserShards: shards, ...totals,
    countRatio: totals.after.commands / totals.before.commands,
    runtimeRatio: totals.after.executionWallMs / totals.before.executionWallMs,
    runnerRatio: totals.after.runnerMs / totals.before.runnerMs,
    meaning: "Same-worker paired execution. Wall is the maximum scope execution duration at the fixed shard count; checkout, installs, artifact transfer, and queue time are reported separately by Actions. Commands are not behavioral cases or assertions." };
}

function run(command, cwd, env) {
  return new Promise((done, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => done(code === 0 && !signal));
  });
}

async function benchmark(base, head, scope) {
  for (const sha of [base, head]) if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("Base and head must be full immutable commit SHAs");
  if (git(["rev-parse", "HEAD"]) !== head) throw new Error("Checkout must be the benchmark head");
  const destination = join(ROOT, ".ci-results", "paired", scope.replace("/", "-"));
  mkdirSync(destination, { recursive: true });
  const parent = mkdtempSync(join(tmpdir(), "repforge-benchmark-"));
  const report = { schemaVersion: 1, base, head, scope, seed: SEED,
    hardware: { cpus: cpus().map(c => c.model), platform: platform(), release: release(), node: process.version }, phases: [] };
  try {
    for (const [phase, sha] of [["before", base], ["after", head]]) {
      const worktree = join(parent, phase);
      git(["worktree", "add", "--detach", worktree, sha]);
      try {
        const inventory = await import(pathToFileURL(join(worktree, "test/suites.mjs")));
        if (inventory.CI_SHARDS !== CI_SHARDS) throw new Error("Paired runs require the same browser shard count");
        const browser = !["fast", "service"].includes(scope);
        const entries = browser
          ? inventory.shardSuites(inventory.browserEntries(), CI_SHARDS)[inventory.parseShard(scope).index - 1].entries
          : inventory.SUITES[scope].map(suite => ({ lane: scope, suite }));
        if (!entries?.length) throw new Error(`Invalid benchmark scope ${scope}`);
        // Locks must match before dependencies can be shared. This measures test
        // execution separately from installation, on identical dependencies.
        const dependency = scope === "service" ? "services/install-transfer" : "test";
        const lock = `${dependency}/package-lock.json`;
        if (!readFileSync(join(worktree, lock)).equals(readFileSync(join(ROOT, lock)))) throw new Error(`Dependency lock changed: ${lock}`);
        symlinkSync(join(ROOT, dependency, "node_modules"), join(worktree, dependency, "node_modules"), "dir");
        const commands = scope === "fast"
          ? [[process.execPath, "tools/run-tests.mjs", "--check"], ["python3", "-B", "plans/073/test_verify.py"], [process.execPath, "tools/run-tests.mjs", "fast", "--keep-going"]]
          : [[process.execPath, "tools/run-tests.mjs", ...(browser ? ["shard", scope] : [scope]), "--keep-going"]];
        const env = { ...process.env, CI_SOURCE_SHA: sha, REPFORGE_GENERATIVE_SEED: SEED, REPFORGE_DIAGNOSTIC_REPLAY: "0" };
        console.log(`Paired benchmark ${phase}: ${sha}, scope ${scope}, seed ${SEED}`);
        const started = performance.now();
        let commandsPassed = true;
        for (const command of commands) commandsPassed = await run(command, worktree, env) && commandsPassed;
        const durationMs = performance.now() - started;
        const rows = [];
        for (const lane of new Set(entries.map(e => e.lane))) {
          const resultPath = join(worktree, ".ci-results", lane, "results.json");
          if (!existsSync(resultPath)) continue;
          const result = JSON.parse(readFileSync(resultPath));
          rows.push(...result.results.map(r => ({ id: `${lane}:${r.id}`, status: r.status, durationMs: r.initial?.durationMs ?? null })));
        }
        report.phases.push({ phase, durationMs, commandsPassed,
          inventory: Object.entries(inventory.SUITES).flatMap(([lane, suites]) => suites.map(s => ({ id: `${lane}:${inventory.suiteId(s)}`, file: s.file }))),
          expected: entries.map(e => `${e.lane}:${inventory.suiteId(e.suite)}`), rows });
        cpSync(join(worktree, ".ci-results"), join(destination, phase), { recursive: true });
        writeFileSync(join(destination, "comparison.json"), JSON.stringify(report, null, 2) + "\n");
      } finally { git(["worktree", "remove", "--force", worktree]); }
    }
  } finally { rmSync(parent, { recursive: true, force: true }); }
  if (report.phases.some(p => !p.commandsPassed || p.rows.some(r => r.status !== "passed"))) process.exitCode = 1;
}

function recordsUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? recordsUnder(path) : entry.name === "comparison.json" ? [JSON.parse(readFileSync(path))] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [mode, ...args] = process.argv.slice(2);
    if (mode === "run" && args.length === 3) await benchmark(...args);
    else if (mode === "summarize" && args.length === 1) {
      const summary = summarizeBenchmark(recordsUnder(resolve(args[0])));
      writeFileSync(join(resolve(args[0]), "summary.json"), JSON.stringify(summary, null, 2) + "\n");
      console.log(JSON.stringify(summary, null, 2));
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `Paired complete inventory: ${summary.before.commands} → ${summary.after.commands} commands. Execution wall ratio ${(summary.runtimeRatio * 100).toFixed(1)}%; runner-time ratio ${(summary.runnerRatio * 100).toFixed(1)}%.\n\n${summary.meaning}\n`);
    } else throw new Error("Usage: node tools/benchmark-tests.mjs run <base-sha> <head-sha> <fast|service|k/n>, or summarize <artifact-directory>");
  } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
