#!/usr/bin/env node
/** Run isolated suites with terse default output; full logs always go to .ci-results. */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUITES, BROWSER_LANES, commandArgs, inventoryErrors, suiteId } from "../test/suites.mjs";
import { changedFilesForTests, formatAffected, selectAffected } from "./test-selection.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FAILURE_EXCERPT = 12 * 1024;
const PREVIEW_GENERATED_FILES = ["index.html", "posthog-config.js"];
const PREVIEW_READINESS_TIMEOUT_MS = 500;

export function execute(suite, { cwd = ROOT, outputDir, env = process.env, timeoutMs = suite.timeoutMs || 600000, verbose = false } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const log = openSync(join(outputDir, "output.log"), "w");
  const started = Date.now();
  return new Promise((resolveResult) => {
    let tail = "", timedOut = false, interrupted = false, done = false, spawnError = null, forceTimer;
    const child = spawn(process.execPath, commandArgs(suite), {
      cwd, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"],
      env: { ...env, ...suite.env, REPFORGE_ARTIFACT_DIR: outputDir },
    });
    const capture = (destination) => (chunk) => {
      if (verbose) destination.write(chunk);
      writeSync(log, chunk);
      tail = (tail + chunk.toString("utf8")).slice(-MAX_FAILURE_EXCERPT);
    };
    child.stdout.on("data", capture(process.stdout));
    child.stderr.on("data", capture(process.stderr));
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
      closeSync(log);
      resolveResult({
        command: ["node", ...commandArgs(suite)], startedAt: new Date(started).toISOString(),
        durationMs: Date.now() - started, exitCode: code, signal: signal || null,
        timedOut, interrupted, error: spawnError, tail,
        status: !timedOut && !interrupted && !spawnError && code === 0 ? "passed" : "failed",
      });
    };
    child.once("error", (error) => { spawnError = error.message; finish(null, null); });
    child.once("close", finish);
  });
}

export async function runLane(lane, entries, {
  cwd = ROOT, outputDir = join(ROOT, ".ci-results", lane), env = process.env,
  diagnosticReplay = false, browser = BROWSER_LANES.has(lane), summaryPath = env.GITHUB_STEP_SUMMARY, verbose = false,
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
    if (verbose) console.log(`\n=== ${row.command.join(" ")} ===`);
    row.initial = await execute(suite, { cwd, outputDir: join(suiteDir, "initial"), env, verbose });
    row.status = row.initial.status;
    save();
    const seconds = (row.initial.durationMs / 1000).toFixed(2);
    console.log(`${row.status === "passed" ? "✓" : "✗"} ${row.command.join(" ")}  ${seconds}s`);
    if (row.status === "failed" && !verbose && row.initial.tail.trim()) {
      console.error(`--- failure excerpt (full log: ${join(suiteDir, "initial/output.log")}) ---\n${row.initial.tail.trim()}\n--- end excerpt ---`);
    }
    if (row.status === "failed" && browser && diagnosticReplay && !row.initial.timedOut && !row.initial.interrupted) {
      console.log(`↻ diagnostic replay: ${id} (cannot change the gate result)`);
      row.diagnostic = await execute(suite, {
        cwd, outputDir: join(suiteDir, "diagnostic"), env: { ...env, REPFORGE_TRACE: "1" }, verbose,
      });
      console.log(`  diagnostic ${row.diagnostic.status} in ${(row.diagnostic.durationMs / 1000).toFixed(2)}s; original remains FAILED`);
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

function snapshotPreviewFiles(cwd) {
  return PREVIEW_GENERATED_FILES.map((relativePath) => {
    const path = join(cwd, relativePath);
    try {
      return { path, exists: true, bytes: readFileSync(path) };
    } catch (error) {
      if (error.code === "ENOENT") return { path, exists: false, bytes: null };
      throw error;
    }
  });
}

function restorePreviewFiles(snapshot) {
  for (const file of snapshot) {
    if (file.exists) writeFileSync(file.path, file.bytes);
    else rmSync(file.path, { force: true });
  }
}

export async function maybeStartLocalPreview(entries, {
  cwd = ROOT,
  env = process.env,
  fetchImpl = globalThis.fetch,
  execFileSyncImpl = execFileSync,
  spawnImpl = spawn,
  signalSource = process,
  killGroup = (pid, signal) => process.kill(-pid, signal),
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  wait = (milliseconds) => new Promise((resolveWait) => setTimeout(resolveWait, milliseconds)),
} = {}) {
  if (!entries.some(({ lane }) => BROWSER_LANES.has(lane))) return null;
  const target = new URL(env.REPFORGE_URL || "http://localhost:8000/");
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || !["", "8000"].includes(target.port)) return null;
  try {
    await fetchImpl(target, { signal: AbortSignal.timeout(700) });
    return null;
  } catch {}
  const snapshot = snapshotPreviewFiles(cwd);
  let serverLog = null;
  let child = null;
  let childExited = false;
  let cleanupDone = false;
  let cleanupError = null;
  let interrupted = false;
  let spawnError = null;
  const abort = new AbortController();
  const removeSignalListener = () => {
    signalSource.removeListener("SIGINT", onSignal);
    signalSource.removeListener("SIGTERM", onSignal);
  };
  const cleanup = () => {
    if (cleanupDone) return cleanupError;
    cleanupDone = true;
    removeSignalListener();
    const errors = [];
    if (child && !childExited && child.pid) {
      try {
        if (process.platform === "win32") child.kill("SIGTERM");
        else killGroup(child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") errors.push(error);
      }
    }
    if (serverLog !== null) {
      try { closeSync(serverLog); } catch (error) { if (error.code !== "EBADF") errors.push(error); }
    }
    try { restorePreviewFiles(snapshot); } catch (error) { errors.push(error); }
    cleanupError = errors.length ? new AggregateError(errors, "Could not clean up the temporary local preview") : null;
    return cleanupError;
  };
  const onSignal = () => {
    interrupted = true;
    abort.abort();
    cleanup();
  };
  const fetchWithDeadline = async (url) => {
    const requestAbort = new AbortController();
    let rejectDeadline;
    let rejectLifecycle;
    let lifecycleRejected = false;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const lifecycle = new Promise((_, reject) => { rejectLifecycle = reject; });
    const rejectOnLifecycle = () => {
      if (lifecycleRejected) return;
      lifecycleRejected = true;
      rejectLifecycle(abort.signal.reason || new Error("Local preview startup interrupted"));
    };
    const relayAbort = () => requestAbort.abort(abort.signal.reason);
    const onLifecycleAbort = () => {
      relayAbort();
      rejectOnLifecycle();
    };
    if (abort.signal.aborted) onLifecycleAbort();
    else abort.signal.addEventListener("abort", onLifecycleAbort, { once: true });
    const timeout = setTimeoutImpl(() => {
      const error = new Error("Local preview readiness request timed out");
      requestAbort.abort(error);
      rejectDeadline(error);
    }, PREVIEW_READINESS_TIMEOUT_MS);
    try {
      const response = await Promise.race([
        Promise.resolve().then(() => fetchImpl(url, { signal: requestAbort.signal })), deadline, lifecycle,
      ]);
      return response;
    } finally {
      clearTimeoutImpl(timeout);
      abort.signal.removeEventListener("abort", onLifecycleAbort);
    }
  };
  signalSource.once("SIGINT", onSignal);
  signalSource.once("SIGTERM", onSignal);
  try {
    execFileSyncImpl(process.execPath, ["scripts/generate-posthog-config.mjs"], {
      cwd,
      stdio: "ignore",
      env: { ...env, CF_PAGES_BRANCH: "", POSTHOG_ENABLE_PREVIEWS: "false", POSTHOG_PROJECT_TOKEN: "" },
    });
    if (interrupted) throw new Error("Temporary local preview startup interrupted");
    mkdirSync(join(cwd, ".ci-results"), { recursive: true });
    serverLog = openSync(join(cwd, ".ci-results/local-server.log"), "w");
    child = spawnImpl("python3", ["-m", "http.server", "8000"], {
      cwd, detached: process.platform !== "win32", stdio: ["ignore", serverLog, serverLog],
    });
    child.once?.("error", (error) => { spawnError = error; });
    child.once?.("exit", () => { childExited = true; });
    child.once?.("close", () => { childExited = true; });
    for (let attempt = 0; attempt < 40; attempt++) {
      if (interrupted) throw new Error("Temporary local preview startup interrupted");
      if (spawnError) throw spawnError;
      try {
        const response = await fetchWithDeadline(target);
        if (interrupted) throw new Error("Temporary local preview startup interrupted");
        if (response.ok) {
          console.log("Started temporary local preview for affected browser checks.");
          return () => {
            const error = cleanup();
            if (error) throw error;
          };
        }
      } catch (error) {
        if (interrupted) throw new Error("Temporary local preview startup interrupted", { cause: error });
        if (spawnError) throw spawnError;
      }
      await wait(100);
    }
    throw new Error("Could not start the temporary local preview on http://localhost:8000/");
  } catch (error) {
    removeSignalListener();
    const cleanupFailure = cleanup();
    if (cleanupFailure) throw new AggregateError([error, cleanupFailure], "Temporary local preview failed");
    throw error;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 1 && argv[0] === "--check") {
    const errors = inventoryErrors(repositoryFiles());
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Inventory: ${Object.values(SUITES).flat().length} commands; every test script classified.`);
    return;
  }
  const target = argv.shift();
  if (target !== "all" && target !== "affected" && !Object.hasOwn(SUITES, target || "")) {
    throw new Error("Usage: node tools/run-tests.mjs fast|state|entry|workout|privacy|all|affected [--list] [--suite file-or-stem] [--base ref] [--verbose], or --check");
  }
  let list = false, verbose = false, filter, base;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === "--list") list = true;
    else if (arg === "--verbose") verbose = true;
    else if (arg === "--suite" && argv[0] && !argv[0].startsWith("--")) filter = argv.shift();
    else if (arg === "--base" && argv[0] && !argv[0].startsWith("--")) base = argv.shift();
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  let groups;
  if (target === "affected") {
    if (filter) throw new Error("affected already selects suites; use a lane plus --suite for one explicit rerun");
    const changed = changedFilesForTests({ cwd: ROOT, base });
    const plan = selectAffected(changed.files, { cwd: ROOT });
    console.log(`Affected base: ${changed.base || "unavailable"}`);
    console.log(formatAffected(plan));
    if (list) {
      for (const { lane, suite } of plan.entries) console.log(`${lane}\tnode ${commandArgs(suite).join(" ")}`);
      return;
    }
    if (!plan.entries.length) return;
    groups = Object.entries(SUITES).map(([lane]) => [lane, plan.entries.filter((entry) => entry.lane === lane).map((entry) => entry.suite)]).filter(([, entries]) => entries.length);
    const cleanup = await maybeStartLocalPreview(plan.entries, { cwd: ROOT });
    try { await runGroups(groups, { verbose }); } finally { cleanup?.(); }
    return;
  }

  groups = (target === "all" ? Object.entries(SUITES) : [[target, SUITES[target]]]).map(([lane, entries]) => [lane,
    entries.filter((suite) => !filter || suite.file === filter || suite.file.split("/").at(-1).replace(/\.mjs$/, "") === filter)]);
  const selected = groups.reduce((sum, [, entries]) => sum + entries.length, 0);
  if (!selected) throw new Error(`No suite matches ${JSON.stringify(filter)}`);
  if (list) {
    for (const [lane, entries] of groups) for (const suite of entries) console.log(`${lane}\tnode ${commandArgs(suite).join(" ")}`);
    return;
  }
  await runGroups(groups, { verbose });
}

async function runGroups(groups, { verbose }) {
  let failed = false;
  for (const [lane, entries] of groups) {
    if (!entries.length) continue;
    const report = await runLane(lane, entries, { diagnosticReplay: process.env.REPFORGE_DIAGNOSTIC_REPLAY === "1", verbose });
    failed ||= report.failed > 0 || report.notRun > 0;
    if (report.notRun) break;
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
