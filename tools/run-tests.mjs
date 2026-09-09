#!/usr/bin/env node
/** Run existing scripts in isolated processes; report all failures, never retry to green. */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUITES, BROWSER_LANES, commandArgs, inventoryErrors, suiteId } from "../test/suites.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LOG_BYTES = 20 * 1024 * 1024;

export function execute(suite, { cwd = ROOT, outputDir, env = process.env, timeoutMs = suite.timeoutMs || 600000 } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const log = openSync(join(outputDir, "output.log"), "w");
  const started = Date.now();
  return new Promise((resolveResult) => {
    let bytes = 0, timedOut = false, interrupted = false, done = false, spawnError = null, forceTimer;
    const child = spawn(process.execPath, commandArgs(suite), {
      cwd, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
      env: { ...env, ...suite.env, REPFORGE_ARTIFACT_DIR: outputDir },
    });
    const tee = (destination) => (chunk) => {
      destination.write(chunk);
      if (bytes < MAX_LOG_BYTES) writeSync(log, chunk.subarray(0, MAX_LOG_BYTES - bytes));
      bytes += chunk.length;
    };
    child.stdout.on("data", tee(process.stdout));
    child.stderr.on("data", tee(process.stderr));
    const kill = (signal) => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill(signal);
        else process.kill(-child.pid, signal);
      } catch (error) { if (error.code !== "ESRCH") spawnError ||= error.message; }
    };
    const stop = () => {
      kill("SIGTERM");
      forceTimer ||= setTimeout(() => kill("SIGKILL"), 3000);
      forceTimer.unref();
    };
    const interrupt = () => { interrupted = true; stop(); };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const finish = (code, signal) => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(forceTimer);
      process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
      if (bytes > MAX_LOG_BYTES) writeSync(log, "\n[artifact log truncated; full stream is in the CI job log]\n");
      closeSync(log);
      resolveResult({
        command: ["node", ...commandArgs(suite)], startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started, exitCode: code, signal: signal || null,
        timedOut, interrupted, error: spawnError,
        status: !timedOut && !interrupted && !spawnError && code === 0 ? "passed" : "failed",
      });
    };
    child.once("error", (error) => { spawnError = error.message; finish(null, null); });
    child.once("close", finish);
  });
}

export async function runLane(lane, entries, {
  cwd = ROOT, outputDir = join(ROOT, ".ci-results", lane), env = process.env,
  diagnosticReplay = false, browser = BROWSER_LANES.has(lane), summaryPath = env.GITHUB_STEP_SUMMARY,
} = {}) {
  mkdirSync(outputDir, { recursive: true });
  const report = { lane, revision: env.GITHUB_SHA || null, results: [] };
  const save = () => writeFileSync(join(outputDir, "results.json"), JSON.stringify(report, null, 2) + "\n");
  for (const suite of entries) {
    const id = suiteId(suite);
    const suiteDir = join(outputDir, id);
    rmSync(suiteDir, { recursive: true, force: true });
    const row = { id, command: ["node", ...commandArgs(suite)], status: "running" };
    report.results.push(row); save();
    console.log(`\n=== ${row.command.join(" ")} ===`);
    row.initial = await execute(suite, { cwd, outputDir: join(suiteDir, "initial"), env });
    row.status = row.initial.status;
    save(); // Keep the authoritative result even if a later diagnostic process is interrupted.
    if (row.status === "failed" && browser && diagnosticReplay && !row.initial.timedOut && !row.initial.interrupted) {
      console.log(`Diagnostic replay for ${id}; its result cannot change the original failure.`);
      row.diagnostic = await execute(suite, {
        cwd, outputDir: join(suiteDir, "diagnostic"), env: { ...env, REPFORGE_TRACE: "1" },
      });
      console.log(`Diagnostic replay: ${row.diagnostic.status}; original result remains FAILED.`);
      save();
    }
    if (row.initial.interrupted || row.diagnostic?.interrupted) break;
  }
  report.notRun = entries.length - report.results.length;
  report.failed = report.results.filter((r) => r.status !== "passed").length;
  save();
  const lines = [
    `## Tests: ${lane}`, "", "| Suite | Result | Initial time | Diagnostic time |", "| --- | --- | ---: | ---: |",
    ...report.results.map((r) => `| \`${r.command.join(" ").replaceAll("|", "\\|")}\` | ${r.status} | ${(r.initial.durationMs / 1000).toFixed(2)}s | ${r.diagnostic ? (r.diagnostic.durationMs / 1000).toFixed(2) + "s (diagnostic only)" : "—"} |`),
    "", `${report.failed} failed; ${report.notRun} not run. Diagnostic replays never make a failed gate pass.`, "",
  ];
  if (summaryPath) appendFileSync(summaryPath, lines.join("\n"));
  console.log(`${lane}: ${report.results.length - report.failed}/${entries.length} passed`);
  return report;
}

function repositoryFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "test", "tools", "scripts"],
    { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--check") {
    const errors = inventoryErrors(repositoryFiles());
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Inventory: ${Object.values(SUITES).flat().length} commands; every test script classified.`);
    return;
  }
  const lane = argv.shift();
  if (lane !== "all" && !Object.hasOwn(SUITES, lane || "")) throw new Error("Usage: node tools/run-tests.mjs fast|state|entry|workout|privacy|all [--list] [--suite file-or-stem], or --check");
  let list = false, filter;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === "--list") list = true;
    else if (arg === "--suite" && argv[0] && !argv[0].startsWith("--")) filter = argv.shift();
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  let selected = 0, failed = false;
  for (const name of lane === "all" ? Object.keys(SUITES) : [lane]) {
    const entries = SUITES[name].filter((s) => !filter || s.file === filter || s.file.split("/").at(-1).replace(/\.mjs$/, "") === filter);
    selected += entries.length;
    if (list) { for (const entry of entries) console.log(`${name}\tnode ${commandArgs(entry).join(" ")}`); continue; }
    if (!entries.length) continue;
    const report = await runLane(name, entries, { diagnosticReplay: process.env.REPFORGE_DIAGNOSTIC_REPLAY === "1" });
    failed ||= report.failed > 0 || report.notRun > 0;
    if (report.notRun) break;
  }
  if (!selected) throw new Error(`No suite matches ${JSON.stringify(filter)}`);
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
