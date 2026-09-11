import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SUITES, SUPPORT, commandArgs, inventoryErrors } from "./suites.mjs";
import { changedFiles, selectVisuals } from "../tools/ci-selection.mjs";
import { changedFilesForTests, selectAffected } from "../tools/test-selection.mjs";
import { execute, maybeStartLocalPreview, runLane } from "../tools/run-tests.mjs";

const manifest = { screens: [{ flow: "app", id: "today" }, { flow: "onboarding", id: "start" }] };
const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "taurifer-ci-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test("inventory schedules each command once and classifies support explicitly", () => {
  const files = [...new Set(Object.values(SUITES).flat().map((s) => s.file))];
  files.push(...Object.keys(SUPPORT).filter((f) => !f.endsWith("/")));
  assert.deepEqual(inventoryErrors(files), []);
  assert.match(inventoryErrors([...files, "test/forgotten.mjs"]).join("\n"), /Unclassified/);
  assert.match(inventoryErrors(files.filter((f) => f !== "test/shared-setup-unit.mjs")).join("\n"), /Missing suite/);
  assert.match(inventoryErrors(files, { ...SUITES, duplicate: [SUITES.fast[0]] }).join("\n"), /Duplicate command/);
  assert.ok(SUITES.fast.some((s) => s.file === "test/shared-setup-unit.mjs"));
  assert.equal(Object.values(SUITES).flat().filter((s) => s.file === "test/vendor-runtimes.mjs").length, 1);
  assert.deepEqual(SUITES.service.map((s) => s.file), ["test/install-transfer-service.mjs"]);
  assert.equal(Object.values(SUITES).flat().some((s) => s.file === "tools/build-vendor-runtimes.mjs"), false);
  assert.deepEqual(commandArgs({ file: "test/x.mjs", args: ["--self-test"], nodeArgs: ["--test"] }), ["--test", "test/x.mjs", "--self-test"]);
});

test("visual capture ignores non-rendering tests/tools but remains conservative for real inputs", () => {
  for (const file of ["README.md", "docs/backlog.md", "plans/060.md", "test/accessibility.mjs", "test/ci.mjs", "tools/run-tests.mjs", "tools/check-test-syntax.mjs"]) {
    assert.equal(selectVisuals([file], manifest).mode, "none", file);
  }
  for (const file of ["app.js", "index.html", "styles.css", "i18n-en.json", "sw.js", "shared-setup.js", "fonts/new.woff2", "assets/exercises/foo.png", "test/browser.mjs", "test/fixtures/shared-setup.mjs", "test/fixtures/seed-program.mjs", "test/fixtures/telemetry.mjs", "test/fixtures/README.md", "test/fixtures/nested/AGENTS.md", "tools/test-selection.mjs", "tools/ci-selection.mjs", "tools/ui-screens/session.mjs", "tools/capture-ui-screens.mjs", ".github/workflows/simulation.yml", "docs/ui-screens/manifest.json", "docs/ui-screens/entry-semantics.json", "unknown.txt"]) {
    assert.equal(selectVisuals([file], manifest).mode, "full", file);
  }
  assert.equal(selectVisuals(null, manifest).mode, "full");
  assert.equal(selectVisuals([], manifest, { force: true }).mode, "full");
});

test("baseline-only selection recaptures whole screens, never isolated variants", () => {
  const plan = selectVisuals(["docs/ui-screens/screens/app/today__phone-390-light-en.png", "docs/ui-screens/README.md"], manifest);
  assert.equal(plan.mode, "screens");
  assert.deepEqual(plan.screens, ["app/today"]);
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/unknown__phone.png"], manifest).mode, "full");
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/today__phone.png", "styles.css"], manifest).mode, "full");
});

test("affected selection is narrow when proven and fail-safe when it is not", () => {
  assert.equal(selectAffected(["docs/ci.md"]).mode, "none");
  const direct = selectAffected(["test/accessibility.mjs"]);
  assert.equal(direct.mode, "selected");
  assert.ok(direct.entries.some(({ suite }) => suite.file === "test/accessibility.mjs"));
  const runner = selectAffected(["tools/run-tests.mjs"]);
  assert.ok(runner.entries.some(({ suite }) => suite.file === "test/ci.mjs"));
  assert.ok(runner.entries.length < Object.values(SUITES).flat().length);
  const telemetry = selectAffected(["telemetry.js"]);
  assert.deepEqual([...new Set(telemetry.entries.map(({ lane }) => lane))].sort(), ["fast", "privacy"]);
  const app = selectAffected(["app.js"]);
  assert.equal(app.entries.length, Object.values(SUITES).flat().length - SUITES.service.length);
  const service = selectAffected(["services/install-transfer/src/index.js", ".github/workflows/install-transfer-service.yml"]);
  assert.deepEqual([...new Set(service.entries.map(({ lane }) => lane))], ["service"]);
  assert.equal(selectAffected(["mystery.bin"]).mode, "all");
});

test("git selection includes working-tree and untracked changes, and visual diff includes rename sides", (t) => {
  const cwd = scratch(t);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet"); git("config", "user.name", "CI fixture"); git("config", "user.email", "ci-fixture@example.invalid");
  writeFileSync(join(cwd, "note with spaces.md"), "content\n"); git("add", "."); git("commit", "-qm", "before");
  const base = git("rev-parse", "HEAD").trim();
  git("mv", "note with spaces.md", "runtime.js"); git("commit", "-qm", "rename");
  writeFileSync(join(cwd, "runtime.js"), "changed\n");
  writeFileSync(join(cwd, "untracked.mjs"), "export {};\n");
  assert.deepEqual(changedFiles(base, { cwd }).sort(), ["note with spaces.md", "runtime.js"]);
  assert.deepEqual(changedFilesForTests({ cwd, base }).files.sort(), ["note with spaces.md", "runtime.js", "untracked.mjs"]);
  assert.equal(changedFiles("0".repeat(40), { cwd }), null);
  assert.equal(changedFilesForTests({ cwd, base: "does-not-exist" }).files, null);
});

test("runner records full output while returning only a bounded diagnostic tail", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "fixture.mjs"), 'console.log("stdout marker"); console.error("stderr marker"); process.exitCode = 7;\n');
  const outputDir = join(cwd, "result");
  const result = await execute({ file: "fixture.mjs", args: [] }, { cwd, outputDir });
  assert.equal(result.status, "failed"); assert.equal(result.exitCode, 7);
  assert.ok(result.durationMs >= 0); assert.match(result.tail, /stderr marker/);
  const log = readFileSync(join(outputDir, "output.log"), "utf8");
  assert.match(log, /stdout marker/); assert.match(log, /stderr marker/);
});

test("runner retains output beyond the terminal excerpt bound", async (t) => {
  const cwd = scratch(t);
  const outputSize = 20 * 1024 * 1024 + 257;
  writeFileSync(join(cwd, "fixture.mjs"), `process.stdout.write("x".repeat(${outputSize}));\n`);
  const outputDir = join(cwd, "result");
  const result = await execute({ file: "fixture.mjs", args: [] }, { cwd, outputDir });
  const log = readFileSync(join(outputDir, "output.log"));
  assert.equal(result.status, "passed");
  assert.equal(log.length, outputSize);
  assert.ok(result.tail.length <= 12 * 1024);
});

test("temporary preview disables analytics and restores generated files on interruption", async (t) => {
  const cwd = scratch(t);
  const indexPath = join(cwd, "index.html");
  const configPath = join(cwd, "posthog-config.js");
  const originalIndex = Buffer.from("original index bytes\n");
  writeFileSync(indexPath, originalIndex);
  const signalSource = new EventEmitter();
  const killSignals = [];
  let calls = 0;
  let generatedEnv;
  const child = { pid: 1234, once() { return this; }, kill(signal) { killSignals.push(signal); } };
  const fakeExecFileSync = (_file, _args, options) => {
    generatedEnv = options.env;
    writeFileSync(indexPath, "generated index bytes\n");
    writeFileSync(configPath, "generated config bytes\n");
  };
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) throw new Error("preview is not running");
    signalSource.emit("SIGINT");
    return { ok: true };
  };
  await assert.rejects(
    () => maybeStartLocalPreview([{ lane: "entry" }], {
      cwd,
      env: { ...process.env, REPFORGE_URL: "http://localhost:8000/", CF_PAGES_BRANCH: "main", POSTHOG_ENABLE_PREVIEWS: "true", POSTHOG_PROJECT_TOKEN: "phc_secret" },
      signalSource,
      fetchImpl: fakeFetch,
      execFileSyncImpl: fakeExecFileSync,
      spawnImpl: () => child,
      killGroup: (_pid, signal) => killSignals.push(signal),
    }),
    /interrupted/
  );
  assert.equal(generatedEnv.CF_PAGES_BRANCH, "");
  assert.equal(generatedEnv.POSTHOG_ENABLE_PREVIEWS, "false");
  assert.equal(generatedEnv.POSTHOG_PROJECT_TOKEN, "");
  assert.deepEqual(killSignals, ["SIGTERM"]);
  assert.deepEqual(readFileSync(indexPath), originalIndex);
  assert.equal(existsSync(configPath), false);
});

test("temporary preview bounds every hanging readiness request and cleans up", async (t) => {
  const cwd = scratch(t);
  const indexPath = join(cwd, "index.html");
  const configPath = join(cwd, "posthog-config.js");
  const originalIndex = Buffer.from("original index bytes\n");
  writeFileSync(indexPath, originalIndex);
  const signalSource = new EventEmitter();
  const killSignals = [];
  const timeoutDelays = [];
  let fetchCalls = 0;
  let deadlineAborts = 0;
  const child = { pid: 5678, once() { return this; } };
  const fakeExecFileSync = () => {
    writeFileSync(indexPath, "generated index bytes\n");
    writeFileSync(configPath, "generated config bytes\n");
  };
  const fakeFetch = async (_url, { signal }) => {
    fetchCalls += 1;
    if (fetchCalls === 1) throw new Error("preview is not running");
    if (signal.aborted) deadlineAborts += 1;
    return new Promise((_, reject) => {
      if (signal.aborted) return;
      signal.addEventListener("abort", () => {
        deadlineAborts += 1;
        if (signal.reason?.message !== "Local preview readiness request timed out") reject(new Error("request aborted"));
      }, { once: true });
    });
  };
  const startup = maybeStartLocalPreview([{ lane: "entry" }], {
    cwd,
    env: { ...process.env, REPFORGE_URL: "http://localhost:8000/" },
    signalSource,
    fetchImpl: fakeFetch,
    execFileSyncImpl: fakeExecFileSync,
    spawnImpl: () => child,
    killGroup: (_pid, signal) => killSignals.push(signal),
    setTimeoutImpl: (callback, milliseconds) => {
      timeoutDelays.push(milliseconds);
      callback();
      return Symbol("deadline");
    },
    clearTimeoutImpl: () => {},
    wait: async () => {},
  });
  const outcome = await Promise.race([
    startup.then(() => ({ kind: "resolved" }), (error) => ({ kind: "rejected", error })),
    new Promise((resolveOutcome) => setImmediate(() => resolveOutcome({ kind: "pending" }))),
  ]);
  if (outcome.kind === "pending") {
    signalSource.emit("SIGINT");
    await startup.catch(() => {});
  }
  assert.equal(outcome.kind, "rejected");
  assert.match(outcome.error.message, /Could not start the temporary local preview/);
  assert.equal(fetchCalls, 41);
  assert.equal(deadlineAborts, 40);
  assert.deepEqual(timeoutDelays, Array.from({ length: 40 }, () => 500));
  assert.deepEqual(killSignals, ["SIGTERM"]);
  assert.deepEqual(readFileSync(indexPath), originalIndex);
  assert.equal(existsSync(configPath), false);
});

test("runner continues after failure and cannot replay a failed suite to green", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "flips.mjs"), 'process.exitCode = process.env.REPFORGE_TRACE === "1" ? 0 : 9;\n');
  writeFileSync(join(cwd, "later.mjs"), 'import { writeFileSync } from "node:fs"; writeFileSync("later-ran", "yes");\n');
  const report = await runLane("fixture", [{ file: "flips.mjs", args: [] }, { file: "later.mjs", args: [] }], {
    cwd, outputDir: join(cwd, "results"), env: { ...process.env, REPFORGE_TRACE: "0" }, browser: true,
    diagnosticReplay: true, summaryPath: join(cwd, "summary.md"),
  });
  assert.equal(report.failed, 1); assert.equal(report.notRun, 0);
  assert.equal(report.results[0].initial.exitCode, 9); assert.equal(report.results[0].diagnostic.exitCode, 0);
  assert.equal(report.results[0].status, "failed");
  assert.equal(report.results[1].status, "passed"); assert.ok(existsSync(join(cwd, "later-ran")));
  assert.equal(JSON.parse(readFileSync(join(cwd, "results/results.json"), "utf8")).failed, 1);
  assert.match(readFileSync(join(cwd, "summary.md"), "utf8"), /diagnostic only/);
});

test("a hung suite is bounded and remains a failure", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "hang.mjs"), 'setInterval(() => {}, 1000);\n');
  const result = await execute({ file: "hang.mjs", args: [] }, { cwd, outputDir: join(cwd, "result"), timeoutMs: 100 });
  assert.equal(result.status, "failed"); assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 10000);
});
