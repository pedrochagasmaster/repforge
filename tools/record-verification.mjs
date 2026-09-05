// Record one real command at an unchanged clean Git commit. This records
// execution provenance; the reviewer still owns semantic coverage and approval.
import { spawn, execFileSync } from "node:child_process";
import { openSync, closeSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const USAGE = "node tools/record-verification.mjs --output /tmp/check.json [--timeout-ms 1200000] -- node test/check.mjs";

function parseArgs(args) {
  const separator = args.indexOf("--");
  if (separator < 0 || separator === args.length - 1) throw new Error(USAGE);
  const options = args.slice(0, separator);
  const values = new Map();
  for (let i = 0; i < options.length; i += 2) {
    if (!["--output", "--timeout-ms"].includes(options[i]) ||
        !options[i + 1] || values.has(options[i])) throw new Error(USAGE);
    values.set(options[i], options[i + 1]);
  }
  if (!values.has("--output")) throw new Error(USAGE);
  const timeoutMs = Number(values.get("--timeout-ms") || 1200000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000) {
    throw new Error("timeout must be an integer from 1 to 3600000 milliseconds");
  }
  return { output: resolve(values.get("--output")), timeoutMs, command: args.slice(separator + 1) };
}

function git(args, cwd = process.cwd()) {
  return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
}

function sourceAt(root) {
  return {
    head: git(["rev-parse", "HEAD"], root),
    tree: git(["rev-parse", "HEAD^{tree}"], root),
    status: git(["status", "--porcelain=v1", "--untracked-files=all"], root),
  };
}

function runCommand(command, timeoutMs) {
  return new Promise((finish) => {
    const group = process.platform !== "win32";
    const child = spawn(command[0], command.slice(1), {
      cwd: process.cwd(), env: process.env, shell: false, detached: group,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = { stdout: [], stderr: [] };
    let bytes = 0;
    let failure = null;
    const stop = (reason) => {
      if (failure) return;
      failure = reason;
      if (!child.pid) return;
      try {
        if (group) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") failure += `; termination failed: ${error.message}`;
      }
    };
    const timer = setTimeout(() => stop("timeout"), timeoutMs);
    for (const channel of ["stdout", "stderr"]) {
      child[channel].on("data", (data) => {
        const remaining = Math.max(0, MAX_OUTPUT_BYTES - bytes);
        output[channel].push(data.subarray(0, remaining));
        bytes += data.length;
        if (bytes > MAX_OUTPUT_BYTES) stop("output-limit");
      });
    }
    child.on("error", (error) => { failure = `spawn-error: ${error.message}`; });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      finish({
        exitCode, signal, failure,
        stdout: Buffer.concat(output.stdout).toString("utf8"),
        stderr: Buffer.concat(output.stderr).toString("utf8"),
        outputTruncated: bytes > MAX_OUTPUT_BYTES,
      });
    });
  });
}

async function main() {
  if (process.argv.length === 3 && process.argv[2] === "--help") {
    console.log(USAGE);
    return;
  }
  const options = parseArgs(process.argv.slice(2));
  const root = realpathSync(git(["rev-parse", "--show-toplevel"]));
  // Resolve the parent to reject symlinks that would place the report in the
  // worktree. Exclusive creation also protects existing reports and symlinks.
  const outputParent = realpathSync(dirname(options.output));
  const fromRoot = relative(root, outputParent);
  if (fromRoot === "" || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith("../") && !fromRoot.startsWith("..\\"))) {
    throw new Error("Report must be outside the source worktree; use a temporary directory");
  }
  const descriptor = openSync(options.output, "wx", 0o600);
  const report = {
    schemaVersion: 1,
    meaning: "Command execution evidence only; semantic coverage and owner approval require review.",
    root, cwd: process.cwd(), command: options.command, timeoutMs: options.timeoutMs,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    startedAt: new Date().toISOString(), sourceBefore: null, sourceAfter: null,
    result: null, outcome: "recorder-error", error: null,
  };
  const started = Date.now();
  try {
    report.sourceBefore = sourceAt(root);
    if (report.sourceBefore.status !== "") {
      report.outcome = "refused-dirty-source";
    } else {
      report.result = await runCommand(options.command, options.timeoutMs);
      report.sourceAfter = sourceAt(root);
      if (report.sourceAfter.status !== "" || report.sourceAfter.head !== report.sourceBefore.head || report.sourceAfter.tree !== report.sourceBefore.tree) {
        report.outcome = "source-changed";
      } else if (report.result.failure || report.result.exitCode !== 0 || report.result.signal) {
        report.outcome = "command-failed";
      } else {
        report.outcome = "command-passed";
      }
    }
  } catch (error) {
    report.error = error.message;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.durationMs = Date.now() - started;
    try { writeFileSync(descriptor, JSON.stringify(report, null, 2) + "\n"); }
    finally { closeSync(descriptor); }
  }
  console.log(`${report.outcome}: ${options.output}`);
  if (report.outcome !== "command-passed") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
