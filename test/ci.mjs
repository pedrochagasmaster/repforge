import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SUITES, SUPPORT, BROWSER_LANES, commandArgs, inventoryErrors } from "./suites.mjs";
import { changedFiles, selectVisuals } from "../tools/ci-selection.mjs";
import { makeCiPlan } from "../tools/ci-plan.mjs";
import { domainsForAppDiff } from "../tools/visual-domains.mjs";
import { changedFilesForTests, changedFilesForEdit, changedFilesForPacket, selectAffected, selectEdit } from "../tools/test-selection.mjs";
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
  assert.ok(Object.values(SUITES).flat().every((s) => s.domains.length && s.cost && s.tier));
  assert.match(inventoryErrors(files, { fast: [{ ...SUITES.fast[0], domains: ["imaginary"] }] }).join("\n"), /Invalid domains/);
});

test("browser suites use the shared preview origin and never own fixed-port servers", () => {
  const browserSuites = [...BROWSER_LANES].flatMap((lane) => SUITES[lane]);
  for (const suite of browserSuites) {
    assert.equal(suite.env?.REPFORGE_URL, undefined, `${suite.file} must inherit the runner-owned REPFORGE_URL`);
    const source = readFileSync(join(process.cwd(), suite.file), "utf8");
    const fallbacks = [...source.matchAll(/process\.env\.REPFORGE_URL\s*\|\|\s*["'](https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)\/)["']/g)];
    for (const [, origin, port] of fallbacks) {
      assert.equal(port, "8000", `${suite.file} has a noncanonical REPFORGE_URL fallback: ${origin}`);
    }
    const documentedOrigins = [...source.matchAll(/REPFORGE_URL=http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/g)];
    for (const [, port] of documentedOrigins) {
      assert.equal(port, "8000", `${suite.file} documents a stale fixed-port REPFORGE_URL example: ${port}`);
    }
    assert.doesNotMatch(source, /spawn\(\s*["']python3["'][\s\S]{0,240}http\.server/,
      `${suite.file} must not start its own static server; the shared runner owns browser preview lifecycle`);
  }
});

test("visual capture ignores non-rendering tests/tools but remains conservative for real inputs", () => {
  for (const file of ["README.md", "docs/backlog.md", "plans/060.md", "test/accessibility.mjs", "test/ci.mjs", "tools/run-tests.mjs", "tools/test-selection.mjs", "tools/ci-plan.mjs", "tools/check-test-syntax.mjs", ".github/workflows/simulation.yml"]) {
    assert.equal(selectVisuals([file], manifest).mode, "none", file);
  }
  for (const file of ["app.js", "index.html", "styles.css", "i18n-en.json", "sw.js", "shared-setup.js", "fonts/new.woff2", "assets/exercises/foo.png", "test/browser.mjs", "test/fixtures/shared-setup.mjs", "test/fixtures/seed-program.mjs", "test/fixtures/telemetry.mjs", "test/fixtures/README.md", "test/fixtures/nested/AGENTS.md", "tools/ui-screens/session.mjs", "tools/capture-ui-screens.mjs", "docs/ui-screens/manifest.json", "docs/ui-screens/entry-semantics.json", "unknown.txt"]) {
    assert.equal(selectVisuals([file], manifest).mode, "full", file);
  }
  assert.equal(selectVisuals(null, manifest).mode, "full");
  assert.equal(selectVisuals([], manifest, { force: true }).mode, "full");
});

test("annotated app hunks select visual domains and unknown regions widen", () => {
  const source = ["const boot = 1;", "// @ci-domain progress", "const stats = 2;", "// @ci-domain history", "const history = 3;", "// @ci-domain global", "const shared = 4;"].join("\n");
  assert.deepEqual([...domainsForAppDiff(source, "@@ -3 +3 @@\n-const stats = 1;\n+const stats = 2;\n")], ["progress"]);
  assert.deepEqual([...domainsForAppDiff(source, "@@ -5 +5 @@\n-const history = 1;\n+const history = 3;\n")], ["history"]);
  assert.deepEqual([...domainsForAppDiff(source, "@@ -1 +1 @@\n-const boot = 0;\n+const boot = 1;\n")], ["global"]);
  assert.deepEqual([...domainsForAppDiff(source, "@@ -3 +3 @@\n-old\n+new\n@@ -5 +5 @@\n-old\n+new\n")].sort(), ["history", "progress"]);
  assert.throws(() => domainsForAppDiff("// @ci-domain imaginary\n", "@@ -1 +1 @@\n-old\n+new\n"), /invalid/);
  const sample = { screens: [{ flow: "history", id: "edit" }, { flow: "progress", id: "overview" }] };
  assert.deepEqual(selectVisuals(["app.js"], sample, { appSource: source, appDiff: "@@ -5 +5 @@\n-old\n+new\n" }).screens, ["history/edit"]);
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
  const manifestInput = selectAffected(["docs/ui-screens/manifest.json"]);
  assert.equal(manifestInput.mode, "selected");
  assert.deepEqual(manifestInput.entries.map(({ suite }) => suite.file).sort(), [
    "test/ui-catalog-contract.mjs",
    "test/ui-plan-050-build-hierarchy.mjs",
    "test/ui-plan-050-editor.mjs",
    "test/ui-screens.mjs",
    "tools/check-ui-screens.mjs",
  ].sort());
  const baselineInput = selectAffected(["docs/ui-screens/screens/app/today__phone-390-light-en.png"]);
  assert.equal(baselineInput.mode, "selected");
  assert.deepEqual(baselineInput.entries.map(({ suite }) => suite.file).sort(), [
    "test/ui-screens.mjs",
    "tools/check-ui-screens.mjs",
  ].sort());
  const semanticInput = selectAffected(["docs/ui-screens/entry-semantics.json"]);
  assert.equal(semanticInput.mode, "selected");
  assert.deepEqual(semanticInput.entries.map(({ suite }) => suite.file), ["test/ui-screens.mjs"]);
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
      env: { ...process.env, REPFORGE_URL: "", CF_PAGES_BRANCH: "main", POSTHOG_ENABLE_PREVIEWS: "true", POSTHOG_PROJECT_TOKEN: "phc_secret" },
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
    env: { ...process.env, REPFORGE_URL: "" },
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
  assert.equal(fetchCalls, 40);
  assert.equal(deadlineAborts, 39);
  assert.deepEqual(timeoutDelays, Array.from({ length: 40 }, () => 500));
  assert.deepEqual(killSignals, ["SIGTERM"]);
  assert.deepEqual(readFileSync(indexPath), originalIndex);
  assert.equal(existsSync(configPath), false);
});

test("temporary preview exports its isolated origin to browser suites", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "index.html"), "original index bytes\n");
  const signalSource = new EventEmitter();
  const spawned = [];
  const child = { pid: 4321, once() { return this; }, kill() {} };
  const fakeExecFileSync = () => {};
  const fakeFetch = async (url) => ({
    ok: true,
    async text() {
      const marker = readFileSync(join(cwd, new URL(url).pathname), "utf8");
      return marker;
    },
  });
  const preview = await maybeStartLocalPreview([{ lane: "entry" }], {
    cwd,
    env: { ...process.env, REPFORGE_URL: "" },
    signalSource,
    fetchImpl: fakeFetch,
    execFileSyncImpl: fakeExecFileSync,
    spawnImpl: (...args) => { spawned.push(args); return child; },
    killGroup: () => {},
    allocatePort: async () => 29341,
    identityToken: "fixture-preview-token",
  });
  assert.equal(preview.env.REPFORGE_URL, "http://127.0.0.1:29341/");
  assert.deepEqual(spawned[0][1], ["-m", "http.server", "29341", "--bind", "127.0.0.1", "--directory", cwd]);
  preview.cleanup();
});

test("explicit loopback preview must prove current-worktree identity", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "index.html"), "original index bytes\n");
  const signalSource = new EventEmitter();
  await assert.rejects(
    () => maybeStartLocalPreview([{ lane: "state" }], {
      cwd,
      env: { ...process.env, REPFORGE_URL: "http://127.0.0.1:8658/" },
      signalSource,
      fetchImpl: async () => ({ ok: false, async text() { return ""; } }),
      identityToken: "wrong-worktree-proof",
    }),
    /is not serving this worktree/
  );
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
  assert.equal(report.results[0].suspectedFlake, true);
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

test("edit selects a directly changed suite without scheduling its whole lane", () => {
  const plan = selectEdit(["test/shared-setup-unit.mjs"]);
  assert.deepEqual(plan.entries.map(({ suite }) => suite.file), ["test/shared-setup-unit.mjs"]);
});

test("edit and packet resolve their distinct Git boundaries", (t) => {
  const cwd = scratch(t);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "-q"); git("config", "user.email", "test@example.com"); git("config", "user.name", "Test");
  writeFileSync(join(cwd, "initial.js"), "initial\n"); git("add", "."); git("commit", "-qm", "initial");
  const base = git("rev-parse", "HEAD");
  writeFileSync(join(cwd, "committed.js"), "committed\n"); git("add", "."); git("commit", "-qm", "second");
  assert.deepEqual(changedFilesForEdit({ cwd }).files, ["committed.js"]);
  writeFileSync(join(cwd, "dirty.js"), "dirty\n");
  assert.deepEqual(changedFilesForEdit({ cwd }).files, ["dirty.js"]);
  assert.deepEqual(changedFilesForPacket({ cwd, base }).files, ["committed.js", "dirty.js"]);
  assert.throws(() => changedFilesForPacket({ cwd }), /requires --base/);
  assert.throws(() => changedFilesForPacket({ cwd, base: "missing" }), /common ancestor/);
});

test("fail-fast records unexecuted commands while keep-going runs them", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "fail.mjs"), "process.exit(2)\n");
  writeFileSync(join(cwd, "later.mjs"), 'import { writeFileSync } from "node:fs"; writeFileSync("later-ran", "yes")\n');
  const entries = [{ file: "fail.mjs", args: [] }, { file: "later.mjs", args: [] }];
  const first = await runLane("fixture", entries, { cwd, outputDir: join(cwd, "one"), failFast: true });
  assert.equal(first.failed, 1); assert.equal(first.notRun, 1);
  assert.equal(first.results[1].status, "not-run-after-failure");
  assert.equal(existsSync(join(cwd, "later-ran")), false);
  const second = await runLane("fixture", entries, { cwd, outputDir: join(cwd, "two"), failFast: false });
  assert.equal(second.failed, 1); assert.equal(second.notRun, 0);
  assert.equal(existsSync(join(cwd, "later-ran")), true);
});

test("CI feedback is selected and candidate/main retain the exhaustive exact-SHA gate", () => {
  const baseSha = "a".repeat(40), headSha = "b".repeat(40);
  const common = { event: "pull_request", draft: true, baseSha, headSha, files: ["test/shared-setup-unit.mjs"], manifest };
  const feedback = makeCiPlan(common);
  assert.equal(feedback.mode, "feedback");
  assert.equal(feedback.baseSha, baseSha); assert.equal(feedback.headSha, headSha);
  assert.equal(feedback.browser.length, 0);
  assert.equal(feedback.visual.mode, "none");
  assert.ok(feedback.tests.fast.includes("test-shared-setup-unit-mjs"));
  assert.equal(feedback.tests.state.length, 0);
  const candidate = makeCiPlan({ ...common, draft: false });
  assert.equal(candidate.mode, "candidate");
  assert.equal(candidate.visual.mode, "full");
  assert.equal(Object.values(candidate.tests).flat().length, Object.values(SUITES).flat().length);
  assert.equal(makeCiPlan({ ...common, event: "push" }).mode, "candidate");
  assert.throws(() => makeCiPlan({ ...common, event: "workflow_dispatch", requestedMode: "candidate", expectedSha: baseSha }), /mismatch/);
  assert.equal(makeCiPlan({ ...common, event: "workflow_dispatch", requestedMode: "candidate", expectedSha: headSha }).headSha, headSha);
  const service = makeCiPlan({ ...common, files: ["services/install-transfer/src/index.js"] });
  assert.equal(service.service.required, true);
  assert.deepEqual(service.browser, []);
  const workflow = makeCiPlan({ ...common, files: [".github/workflows/simulation.yml"] });
  assert.equal(workflow.visual.mode, "none");
  assert.deepEqual(workflow.tests.fast, ["test-ci-mjs"]);
  const unknown = makeCiPlan({ ...common, files: ["future-runtime.js"] });
  assert.equal(Object.values(unknown.tests).flat().length, Object.values(SUITES).flat().length);
});

test("workflow keeps feedback separate from candidate and installs browsers only after planning", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/simulation.yml"), "utf8");
  assert.match(workflow, /expected_sha:/);
  assert.match(workflow, /simulation-feedback:/);
  assert.match(workflow, /if: needs\.plan\.outputs\.browser != '\[\]'/);
  assert.match(workflow, /if: needs\.plan\.outputs\.visual != 'none'/);
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.draft \}\}/);
  assert.match(workflow, /node tools\/ci-plan\.mjs/);
  assert.match(workflow, /node tools\/run-tests\.mjs "\$LANE" --suite-ids/);
});
