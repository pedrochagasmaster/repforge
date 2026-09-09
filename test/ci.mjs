import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SUITES, SUPPORT, commandArgs, inventoryErrors } from "./suites.mjs";
import { changedFiles, selectVisuals } from "../tools/ci-selection.mjs";
import { execute, runLane } from "../tools/run-tests.mjs";

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
  assert.equal(Object.values(SUITES).flat().some((s) => s.file === "tools/build-vendor-runtimes.mjs"), false, "vendor suite already exercises the build check");
  assert.deepEqual(commandArgs({ file: "test/x.mjs", args: ["--self-test"], nodeArgs: ["--test"] }), ["--test", "test/x.mjs", "--self-test"]);
});

test("prose-only changes skip captures; runtime, fixtures, harness and unknown paths select full", () => {
  assert.equal(selectVisuals(["README.md", "docs/backlog.md", "plans/060.md"], manifest).mode, "none");
  for (const file of ["app.js", "index.html", "styles.css", "motion-polish.css", "i18n-en.json", "i18n-pt.json", "i18n.js", "sw.js", "shared-setup.js", "fonts/new.woff2", "assets/exercises/foo.png", "test/browser.mjs", "test/fixtures/seed-program.mjs", "tools/ui-screens/session.mjs", "tools/capture-ui-screens.mjs", "tools/ci-selection.mjs", ".github/workflows/simulation.yml", "docs/ui-screens/manifest.json", "docs/ui-screens/entry-semantics.json", "unknown.txt"]) {
    assert.equal(selectVisuals([file], manifest).mode, "full", file);
  }
  assert.equal(selectVisuals(null, manifest).mode, "full");
  assert.equal(selectVisuals([], manifest, { force: true }).mode, "full");
});

test("baseline-only selection recaptures whole screens, never isolated variants", () => {
  const plan = selectVisuals([
    "docs/ui-screens/screens/app/today__phone-390-light-en.png",
    "docs/ui-screens/screens/app/today__phone-390-dark-pt.png", "docs/ui-screens/README.md",
  ], manifest);
  assert.equal(plan.mode, "screens");
  assert.deepEqual(plan.screens, ["app/today"]);
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/unknown__phone.png"], manifest).mode, "full");
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/today__phone.png", "styles.css"], manifest).mode, "full");
});

test("git selection includes both sides of renames and falls back when the base is missing", (t) => {
  const cwd = scratch(t);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet"); git("config", "user.name", "CI fixture"); git("config", "user.email", "ci-fixture@example.invalid");
  writeFileSync(join(cwd, "note with spaces.md"), "content\n"); git("add", "."); git("commit", "-qm", "before");
  const base = git("rev-parse", "HEAD").trim();
  git("mv", "note with spaces.md", "runtime.js"); git("commit", "-qm", "rename");
  assert.deepEqual(changedFiles(base, { cwd }).sort(), ["note with spaces.md", "runtime.js"]);
  assert.equal(changedFiles("0".repeat(40), { cwd }), null);
  assert.equal(changedFiles("f".repeat(40), { cwd }), null);
  assert.equal(changedFiles("--output=bad", { cwd }), null);
});

test("runner records stdout, stderr, exit code and duration", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "fixture.mjs"), 'console.log("stdout marker"); console.error("stderr marker"); process.exitCode = 7;\n');
  const outputDir = join(cwd, "result");
  const result = await execute({ file: "fixture.mjs", args: [] }, { cwd, outputDir });
  assert.equal(result.status, "failed"); assert.equal(result.exitCode, 7);
  assert.ok(result.durationMs >= 0);
  const log = readFileSync(join(outputDir, "output.log"), "utf8");
  assert.match(log, /stdout marker/); assert.match(log, /stderr marker/);
});

test("runner continues after failure and cannot retry a failed suite to green", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "flips.mjs"), 'process.exitCode = process.env.REPFORGE_TRACE === "1" ? 0 : 9;\n');
  writeFileSync(join(cwd, "later.mjs"), 'import { writeFileSync } from "node:fs"; writeFileSync("later-ran", "yes");\n');
  const report = await runLane("fixture", [{ file: "flips.mjs", args: [] }, { file: "later.mjs", args: [] }], {
    cwd, outputDir: join(cwd, "results"), env: { ...process.env, REPFORGE_TRACE: "0" },
    browser: true, diagnosticReplay: true, summaryPath: join(cwd, "summary.md"),
  });
  assert.equal(report.failed, 1); assert.equal(report.notRun, 0);
  assert.equal(report.results[0].initial.exitCode, 9);
  assert.equal(report.results[0].diagnostic.exitCode, 0);
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
