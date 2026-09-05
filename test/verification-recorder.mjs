import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RECORDER = join(ROOT, "tools/record-verification.mjs");

function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), "taurifer-verification-test-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const repo = join(temp, "repo");
  mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-q");
  git("config", "user.email", "verification@example.invalid");
  git("config", "user.name", "Verification test");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "/dev/null");
  writeFileSync(join(repo, "source.txt"), "original\n");
  git("add", "source.txt");
  git("commit", "-qm", "fixture");
  let count = 0;
  const record = (command, extra = [], output = join(temp, `report-${++count}.json`)) => {
    const run = spawnSync(process.execPath, [RECORDER, "--output", output, ...extra, "--", ...command], {
      cwd: repo, encoding: "utf8", timeout: 15000,
    });
    return { run, output, report: existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : null };
  };
  return { temp, repo, git, record };
}

test("records actual output and clean commit identity, preserving literal arguments", (t) => {
  const f = fixture(t);
  const literal = "$(touch should-not-exist); `echo accidental`";
  const command = [process.execPath, "-e", "console.log(process.argv[1]); console.error('stderr evidence')", literal];
  const { run, report } = f.record(command);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(report.outcome, "command-passed");
  assert.equal(report.result.stdout, literal + "\n");
  assert.equal(report.result.stderr, "stderr evidence\n");
  assert.deepEqual(report.command, command);
  assert.equal(report.sourceBefore.head, f.git("rev-parse", "HEAD"));
  assert.deepEqual(report.sourceAfter, report.sourceBefore);
  assert.equal(existsSync(join(f.repo, "should-not-exist")), false);
});

test("nonzero exit, missing executable, timeout, and excessive output cannot pass", (t) => {
  const f = fixture(t);
  const failed = f.record([process.execPath, "-e", "console.log('false PASS'); process.exit(7)"]);
  assert.equal(failed.run.status, 1);
  assert.equal(failed.report.result.exitCode, 7);
  assert.equal(failed.report.outcome, "command-failed");
  const missing = f.record([join(f.temp, "absent-command")]);
  assert.equal(missing.run.status, 1);
  assert.match(missing.report.result.failure, /spawn-error/);
  const timeout = f.record([process.execPath, "-e", "setInterval(()=>{}, 1000)"], ["--timeout-ms", "100"]);
  assert.equal(timeout.run.status, 1);
  assert.equal(timeout.report.result.failure, "timeout");
  const overflow = f.record([process.execPath, "-e", "process.stdout.write('x'.repeat(9*1024*1024))"]);
  assert.equal(overflow.run.status, 1);
  assert.equal(overflow.report.result.failure, "output-limit");
  assert.equal(overflow.report.result.outputTruncated, true);
});

test("dirty tracked or untracked source refuses to execute", (t) => {
  const f = fixture(t);
  const command = [process.execPath, "-e", "throw new Error('must not run')"];
  writeFileSync(join(f.repo, "source.txt"), "dirty");
  const dirty = f.record(command);
  assert.equal(dirty.run.status, 1);
  assert.equal(dirty.report.outcome, "refused-dirty-source");
  assert.equal(dirty.report.result, null);
  writeFileSync(join(f.repo, "source.txt"), "original\n");
  writeFileSync(join(f.repo, "untracked.txt"), "dirty");
  assert.equal(f.record(command).report.outcome, "refused-dirty-source");
});

test("exit zero cannot hide changed source or a changed clean HEAD", (t) => {
  const f = fixture(t);
  const changed = f.record([process.execPath, "-e", "require('node:fs').writeFileSync('source.txt', 'changed')"]);
  assert.equal(changed.run.status, 1);
  assert.equal(changed.report.result.exitCode, 0);
  assert.equal(changed.report.outcome, "source-changed");
  writeFileSync(join(f.repo, "source.txt"), "original\n");
  const head = f.record(["git", "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-qm", "changed head"]);
  assert.equal(head.run.status, 1);
  assert.equal(head.report.sourceAfter.status, "");
  assert.equal(head.report.outcome, "source-changed");
  assert.notEqual(head.report.sourceAfter.head, head.report.sourceBefore.head);
});

test("refuses report overwrite and in-worktree destinations, including symlink parents", (t) => {
  const f = fixture(t);
  const command = [process.execPath, "-e", "console.log('run')"];
  const output = join(f.temp, "existing.json");
  writeFileSync(output, '{"old":true}');
  assert.equal(f.record(command, [], output).run.status, 1);
  assert.equal(readFileSync(output, "utf8"), '{"old":true}');
  const inside = join(f.repo, "report.json");
  assert.equal(f.record(command, [], inside).run.status, 1);
  assert.equal(existsSync(inside), false);
  const alias = join(f.temp, "alias");
  symlinkSync(f.repo, alias, "dir");
  assert.equal(f.record(command, [], join(alias, "report.json")).run.status, 1);
  assert.equal(existsSync(inside), false);
});

test("rejects malformed arguments and imports without executing commands", (t) => {
  const f = fixture(t);
  for (const args of [[], ["--timeout-ms", "0", "--", "node"], ["--output", "x", "--"], ["--output", "x", "--unknown", "yes", "--", "node"]]) {
    const run = spawnSync(process.execPath, [RECORDER, ...args], { cwd: f.repo, encoding: "utf8" });
    assert.notEqual(run.status, 0);
  }
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", "await import(process.argv[2])", join(f.temp, "other-entry.mjs"), RECORDER], { cwd: f.repo, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "");
});

test("all overhaul plans and review entry points reach the same evidence protocol", () => {
  const plans = readdirSync(join(ROOT, "plans")).filter((p) => /^(049|05[0-9])-.*\.md$/.test(p));
  assert.equal(plans.length, 11);
  for (const plan of plans) {
    const text = readFileSync(join(ROOT, "plans", plan), "utf8");
    assert.match(text, /\.\.\/docs\/agents\/implementation-evidence\.md/);
    assert.match(text, /\.\.\/docs\/agents\/ui-overhaul-proof-checkpoints\.md/);
  }
  for (const file of ["AGENTS.md", ".agents/skills/code-review/SKILL.md", "plans/README.md"]) {
    assert.match(readFileSync(join(ROOT, file), "utf8"), /docs\/agents\/implementation-evidence\.md/);
  }
  const checkpoints = readFileSync(join(ROOT, "docs/agents/ui-overhaul-proof-checkpoints.md"), "utf8");
  for (const plan of plans) assert.match(checkpoints, new RegExp(`^## Plan ${plan.slice(0, 3)}:`, "m"));
  // This checks adoption links only. It makes no claim about product correctness.
  for (const file of ["docs/agents/implementation-evidence.md", "docs/agents/ui-overhaul-proof-checkpoints.md"]) {
    const body = readFileSync(join(ROOT, file), "utf8");
    for (const [, target] of body.matchAll(/\]\(([^)]+)\)/g)) {
      assert.ok(existsSync(resolve(ROOT, dirname(file), target.split("#")[0])), `${file}: ${target}`);
    }
  }
});
