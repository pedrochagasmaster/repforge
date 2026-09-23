#!/usr/bin/env node
/** Run isolated suites with terse default output; full logs always go to .ci-results. */
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, closeSync, mkdirSync, openSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUITES, BROWSER_LANES, commandArgs, inventoryErrors, suiteId } from "../test/suites.mjs";
import { changedFilesForTests, changedFilesForEdit, changedFilesForPacket, formatAffected, selectBranch, selectPacket, selectEdit } from "./test-selection.mjs";
import { maybeStartLocalPreview } from "./local-preview.mjs";
export { maybeStartLocalPreview } from "./local-preview.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FAILURE_EXCERPT = 12 * 1024;

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
  failFast = false,
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
    if (row.initial.interrupted || row.diagnostic?.interrupted || (failFast && row.status === "failed")) break;
  }
  report.notRun = entries.length - report.results.length;
  for (const suite of entries.slice(report.results.length)) report.results.push({
    id: suiteId(suite), command: ["node", ...commandArgs(suite)], status: "not-run-after-failure",
  });
  report.failed = report.results.filter((r) => r.status === "failed").length;
  save();
  const lines = [
    `## Tests: ${lane}`, "", "| Suite | Result | Initial time | Diagnostic time |", "| --- | --- | ---: | ---: |",
    ...report.results.map((r) => `| \`${r.command.join(" ").replaceAll("|", "\\|")}\` | ${r.status} | ${r.initial ? (r.initial.durationMs / 1000).toFixed(2) + "s" : "—"} | ${r.diagnostic ? (r.diagnostic.durationMs / 1000).toFixed(2) + "s (diagnostic only)" : "—"} |`),
    "", `${report.failed} failed; ${report.notRun} not run. Diagnostic replays never make a failed gate pass.`, "",
  ];
  if (summaryPath) appendFileSync(summaryPath, lines.join("\n"));
  console.log(`${lane}: ${entries.length - report.failed - report.notRun}/${entries.length} passed`);
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
  const target = argv.shift();
  if (!["all", "affected", "edit", "packet", "branch", "candidate"].includes(target) && !Object.hasOwn(SUITES, target || "")) {
    throw new Error("Usage: node tools/run-tests.mjs fast|state|entry|workout|privacy|all|edit|packet|branch|candidate|affected [--list] [--explain] [--suite file-or-stem] [--base ref] [--fail-fast|--keep-going] [--verbose], or --check");
  }
  let list = false, explain = false, verbose = false, filter, base, failurePolicy, evidence;
  while (argv.length) {
    const arg = argv.shift();
    if (arg === "--list") list = true;
    else if (arg === "--explain") explain = true;
    else if (arg === "--verbose") verbose = true;
    else if (arg === "--fail-fast" || arg === "--keep-going") failurePolicy = arg === "--fail-fast";
    else if (arg === "--suite" && argv[0] && !argv[0].startsWith("--")) filter = argv.shift();
    else if (arg === "--base" && argv[0] && !argv[0].startsWith("--")) base = argv.shift();
    else if (arg === "--evidence" && argv[0] && !argv[0].startsWith("--")) evidence = resolve(argv.shift());
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }

  let groups;
  if (evidence && (list || ["all", "candidate", "branch", "packet", "affected", "edit"].includes(target))) {
    throw new Error("--evidence requires an executing exact lane with --suite");
  }
  let sourceBefore;
  if (evidence) {
    if (!filter) throw new Error("--evidence requires --suite");
    const parent = resolve(dirname(evidence));
    const fromRoot = relative(ROOT, parent);
    if (fromRoot === "" || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith("../"))) {
      throw new Error("Evidence report must be outside the worktree");
    }
    sourceBefore = sourceAtHead();
    if (sourceBefore.status) throw new Error("--evidence requires a clean source worktree");
  }
  if (["affected", "branch", "edit", "packet", "candidate"].includes(target)) {
    if (filter) throw new Error(`${target} already selects suites; use a lane plus --suite for one explicit rerun`);
    if (target === "affected") console.warn("affected is the branch-wide compatibility alias; use edit or packet for local feedback.");
    const changed = target === "edit" ? changedFilesForEdit({ cwd: ROOT })
      : target === "packet" ? changedFilesForPacket({ cwd: ROOT, base: base || process.env.REPFORGE_PACKET_BASE })
      : target === "candidate" ? { base: "HEAD", files: null }
      : changedFilesForTests({ cwd: ROOT, base });
    const plan = target === "candidate"
      ? { mode: "all", entries: Object.entries(SUITES).filter(([lane]) => lane !== "service").flatMap(([lane, suites]) => suites.map((suite) => ({ lane, suite }))), files: [], reasons: ["Complete local candidate gate; service requires its external environment."] }
      : (target === "edit" ? selectEdit : target === "packet" ? selectPacket : selectBranch)(changed.files, { cwd: ROOT });
    console.log(`${target} base: ${changed.base || "unavailable"}`);
    console.log(formatAffected(plan));
    if (target === "candidate") console.log("SKIPPED — external/environment gate: install-transfer service requires service credentials and infrastructure.");
    if (explain) {
      console.log(`Changed files: ${changed.files?.join(", ") || "(none or complete gate)"}`);
      for (const reason of plan.reasons) console.log(`Reason: ${reason}`);
    }
    if (list) {
      for (const { lane, suite } of plan.entries) console.log(`${lane}\tnode ${commandArgs(suite).join(" ")}`);
      return;
    }
    if (!plan.entries.length) return;
    groups = Object.entries(SUITES).map(([lane]) => [lane, plan.entries.filter((entry) => entry.lane === lane).map((entry) => entry.suite)]).filter(([, entries]) => entries.length);
    const preview = await maybeStartLocalPreview(plan.entries, { cwd: ROOT });
    try { await runGroups(groups, { verbose, env: preview?.env || process.env, failFast: failurePolicy ?? target !== "candidate" }); } finally { preview?.cleanup?.(); }
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
  const previewEntries = groups.flatMap(([lane, entries]) => entries.map((suite) => ({ lane, suite })));
  const preview = await maybeStartLocalPreview(previewEntries, { cwd: ROOT });
  let failure;
  try { await runGroups(groups, { verbose, env: preview?.env || process.env, failFast: failurePolicy ?? Boolean(filter) }); }
  catch (error) { failure = error; throw error; }
  finally {
    preview?.cleanup?.();
    if (evidence) {
      const after = sourceAtHead();
      const outcome = after.head !== sourceBefore.head || after.tree !== sourceBefore.tree || after.status
        ? "source-changed" : failure || process.exitCode ? "command-failed" : "command-passed";
      writeFileSync(evidence, JSON.stringify({ schemaVersion: 1,
        meaning: "Command execution provenance only; semantic coverage and owner approval require review.",
        root: ROOT, command: ["node", "tools/run-tests.mjs", target, "--suite", filter],
        runtime: { node: process.version, platform: process.platform, arch: process.arch },
        sourceBefore, sourceAfter: after, outcome,
      }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      if (outcome !== "command-passed") process.exitCode = 1;
    }
  }
}

function sourceAtHead() {
  const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trimEnd();
  return { head: git(["rev-parse", "HEAD"]), tree: git(["rev-parse", "HEAD^{tree}"]),
    status: git(["status", "--porcelain=v1", "--untracked-files=all"]) };
}

async function runGroups(groups, { verbose, env = process.env, failFast = false }) {
  let failed = false;
  for (const [lane, entries] of groups) {
    if (!entries.length) continue;
    const report = await runLane(lane, entries, { env, diagnosticReplay: env.REPFORGE_DIAGNOSTIC_REPLAY === "1", verbose, failFast });
    failed ||= report.failed > 0 || report.notRun > 0;
    if (report.failed) {
      const first = report.results.find((row) => row.status === "failed");
      console.error(`Rerun only this contract:\n  node tools/run-tests.mjs ${lane} --suite ${first.command[1]}`);
    }
    if (report.notRun || (failFast && report.failed)) break;
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
