import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { BROWSER_LANES, CI_SHARDS, FULL_SHARDS, FULL_SUITES, INVENTORY, SUITES, SUPPORT, UI_SYSTEM_SHARDS, VISUAL_SHARDS, browserEntries, commandArgs, inventoryErrors, parseShard, shardSuites, suiteId, suiteSeconds } from "./suites.mjs";
import { changedFiles, selectVisuals } from "../tools/ci-selection.mjs";
import { classifyChange, classifyVisualOnly, gateFullResults, gateResults, mergeFullUiSystemReports, planOutputs, pullRequestFiles, resolvePlan, shardMatrix } from "../tools/ci-plan.mjs";
import { placeCiCaptures } from "../tools/fetch-ci-captures.mjs";
import { markDeterministicFailure, recordCiCaptures } from "../tools/ci-captures.mjs";
import { deterministicAuditFailure, findShardReports, mergeShardReports, shardCaptures } from "../tools/ui-system-core.mjs";
import { mergeUiSystemReports } from "../tools/ci-plan.mjs";
import { criticalCaptures, deterministicCriticalFailure, validateCriticalReport } from "../tools/critical-ui.mjs";
import { selectCaptures, verifyCatalog } from "../tools/capture-ui-screens.mjs";
import { captureKey, capturePath, expandCaptures, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { domainsForAppDiff } from "../tools/visual-domains.mjs";
import { stabilizeShareUrlForCapture } from "../tools/ui-screens/screens-app.mjs";
import { changedFilesForTests, changedFilesForEdit, changedFilesForPacket, fullLaneEntries, fullShardCount, selectAffected, selectEdit, selectFullLane, selectPacket } from "../tools/test-selection.mjs";
import { execute, maybeStartLocalPreview, runLane, shardPlan } from "../tools/run-tests.mjs";
import { summarizeBenchmark } from "../tools/benchmark-tests.mjs";

test("paired benchmark reports complete scope and refuses missing, duplicate, or failed evidence", () => {
  const inventory = ["fast:a", "service:b", "entry:c", "visual:d"].map(id => ({ id, file: `${id}.mjs` }));
  const worker = (scope, ids) => ({ scope, base: "a".repeat(40), head: "b".repeat(40), seed: "147443",
    phases: ["before", "after"].map((phase) => ({ phase, durationMs: phase === "before" ? 100 : 80,
      inventory, expected: ids, rows: ids.map(id => ({ id, status: "passed", durationMs: phase === "before" ? 90 : 70 })),
      commandsPassed: true })) });
  const records = [worker("fast", ["fast:a"]), worker("service", ["service:b"]), worker("1/2", ["entry:c"]), worker("2/2", ["visual:d"])];
  const gates = { before: { passed: true, durationMs: 0, source: "a".repeat(40) }, after: { passed: true, durationMs: 0, source: "b".repeat(40) } };
  assert.throws(() => summarizeBenchmark(records, 2), /catalog-wide/);
  assert.throws(() => summarizeBenchmark(records, 2, { ...gates, before: { ...gates.before, passed: false } }), /catalog-wide/);
  const summary = summarizeBenchmark(records, 2, gates);
  assert.equal(summary.before.commands, 4);
  assert.equal(summary.after.commands, 4);
  assert.equal(summary.after.files, 4);
  assert.equal(summary.before.runnerMs, 360);
  assert.equal(summary.after.runnerMs, 280);
  assert.equal(summary.before.executionWallMs, 100);
  assert.equal(summary.after.executionWallMs, 80);
  assert.equal(summary.runtimeRatio, 0.8);
  assert.equal(summarizeBenchmark(records, 2, { ...gates, before: { ...gates.before, durationMs: 3 } }).before.executionWallMs, 103);
  assert.throws(() => summarizeBenchmark(records.slice(1), 2), /scope/);
  const duplicate = structuredClone(records);
  duplicate[3].phases[0].rows[0].id = "entry:c";
  assert.throws(() => summarizeBenchmark(duplicate, 2), /inventory|duplicate/);
  const omitted = structuredClone(records);
  omitted[0].phases[1].rows = [];
  assert.throws(() => summarizeBenchmark(omitted, 2), /inventory/);
  const failed = structuredClone(records);
  failed[0].phases[0].rows[0].status = "failed";
  assert.throws(() => summarizeBenchmark(failed, 2), /passed/);
  const differentSeed = structuredClone(records);
  differentSeed[1].seed = "2";
  assert.throws(() => summarizeBenchmark(differentSeed, 2), /identity/);
  const missingEverywhere = structuredClone(records);
  missingEverywhere[0].phases[0].expected = [];
  missingEverywhere[0].phases[0].rows = [];
  assert.throws(() => summarizeBenchmark(missingEverywhere, 2), /complete inventory/);
});

const manifest = { screens: [{ flow: "app", id: "today" }, { flow: "onboarding", id: "start" }] };
const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), "taurifer-ci-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
function serviceWorkerFixture(t) {
  const cwd = scratch(t);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "--quiet");
  git("config", "user.name", "CI fixture");
  git("config", "user.email", "ci-fixture@example.invalid");
  const source = readFileSync(join(process.cwd(), "sw.js"), "utf8");
  writeFileSync(join(cwd, "sw.js"), source);
  git("add", "sw.js");
  git("commit", "-qm", "service worker baseline");
  return { cwd, base: git("rev-parse", "HEAD").trim(), source,
    write: (next) => writeFileSync(join(cwd, "sw.js"), next) };
}
function replaceOnce(source, before, after) {
  assert.ok(source.includes(before), `fixture contains ${before}`);
  return source.replace(before, after);
}
const suiteFiles = (plan) => [...new Set(plan.entries.map(({ suite }) => suite.file))].sort();
const lanes = (plan) => [...new Set(plan.entries.map(({ lane }) => lane))].sort();
const commandKeys = (plan) => plan.entries.map(({ lane, suite }) => `${lane}:${JSON.stringify(commandArgs(suite))}`).sort();
const allCommands = Object.values(SUITES).flat().length;

// ------------------------------------------------------------------ inventory

test("inventory schedules each command once and classifies support explicitly", () => {
  const files = [...new Set(Object.values(INVENTORY).flat().map((s) => s.file))];
  files.push(...Object.keys(SUPPORT).filter((f) => !f.endsWith("/")));
  assert.deepEqual(inventoryErrors(files), []);
  assert.match(inventoryErrors([...files, "test/forgotten.mjs"]).join("\n"), /Unclassified/);
  assert.match(inventoryErrors(files.filter((f) => f !== "test/shared-setup-unit.mjs")).join("\n"), /Missing suite/);
  assert.match(inventoryErrors(files, { ...SUITES, duplicate: [SUITES.fast[0]] }).join("\n"), /Duplicate command/);
  assert.match(inventoryErrors(files, { ...INVENTORY, "full-fast": [...FULL_SUITES["full-fast"], SUITES.fast[0]] }).join("\n"), /Duplicate command/,
    "a command lives in exactly one of the pull-request and full lanes");
  assert.match(inventoryErrors(files, SUITES).join("\n"), /Unclassified test file: test\/simulation\.mjs/,
    "full-lane suites are classified by the full inventory, not by being forgotten");
  assert.match(inventoryErrors(files, { hidden: [SUITES.fast[0]] }).join("\n"), /Unknown lane: hidden/,
    "a new inventory lane must not disappear outside the workflow's known execution owners");
  assert.ok(SUITES.fast.some((s) => s.file === "test/shared-setup-unit.mjs"));
  assert.equal(Object.values(SUITES).flat().filter((s) => s.file === "test/vendor-runtimes.mjs").length, 1);
  assert.deepEqual(SUITES.service.map((s) => s.file), ["test/install-transfer-service.mjs"]);
  assert.equal(Object.values(SUITES).flat().some((s) => s.file === "tools/build-vendor-runtimes.mjs"), false);
  assert.deepEqual(commandArgs({ file: "test/x.mjs", args: ["--self-test"], nodeArgs: ["--test"] }), ["--test", "test/x.mjs", "--self-test"]);
  assert.ok(Object.values(SUITES).flat().every((s) => s.domains.length && s.cost && s.tier));
  assert.match(inventoryErrors(files, { fast: [{ ...SUITES.fast[0], domains: ["imaginary"] }] }).join("\n"), /Invalid domains/);
  assert.match(inventoryErrors(files, { fast: [{ ...SUITES.fast[0], seconds: -1 }] }).join("\n"), /Invalid seconds/);
  assert.ok(SUITES.fast.some((s) => s.file === "tools/build-i18n.mjs" && s.args.includes("--check")), "generated i18n drift is a CI contract");
});

test("the ledger places every baseline execution in a lane and records both lanes' counts", () => {
  const ledger = JSON.parse(readFileSync("docs/test-retirement-ledger.json", "utf8"));
  assert.match(ledger.baseline, /^[0-9a-f]{40}$/);
  assert.equal(ledger.entries.length, ledger.baselineCommands);
  assert.equal(new Set(ledger.entries.map(row => row.baselineCommand)).size, ledger.baselineCommands);
  const originalFiles = ledger.entries.map(row => row.baselineCommand.split(" ").find(word => word.endsWith(".mjs")));
  assert.equal(new Set(originalFiles).size, ledger.baselineFiles);
  const command = (s) => ["node", ...commandArgs(s)].join(" ");
  const pr = new Set(Object.values(SUITES).flat().map(command));
  const full = new Set(Object.values(FULL_SUITES).flat().map(command));
  for (const row of ledger.entries) {
    assert.ok(["retained", "consolidated", "full"].includes(row.disposition), row.baselineCommand);
    assert.ok(row.evidence);
    if (row.disposition === "retained") assert.ok(pr.has(row.baselineCommand), `${row.baselineCommand}: retained but not in the PR lane`);
    if (row.disposition === "full") {
      assert.ok(full.has(row.baselineCommand), `${row.baselineCommand}: marked full but not in the full lane`);
      assert.ok(row.retainedRisk && row.prGuaranteeReduced && row.owners.length);
    }
    for (const file of row.owners || []) assert.ok(existsSync(file), `${row.baselineCommand}: missing risk owner ${file}`);
  }
  // Nothing the baseline ran disappears: each command is in a lane or consolidated into a named owner.
  for (const row of ledger.entries) {
    if (row.disposition === "consolidated") assert.ok(row.owners.every((file) => [...pr, ...full].some((c) => c.includes(file))));
  }
  const current = Object.values(SUITES).flat(), fullLane = Object.values(FULL_SUITES).flat();
  assert.equal(ledger.prCommands, current.length, "the ledger's PR command count matches the inventory");
  assert.equal(ledger.prFiles, new Set(current.map(s => s.file)).size);
  assert.equal(ledger.fullCommands, fullLane.length, "the ledger's full-lane command count matches the inventory");
  assert.equal(ledger.fullFiles, new Set(fullLane.map(s => s.file)).size);
  assert.ok(current.length <= ledger.baselineCommands / 2, "the PR lane schedules at most half the baseline commands");
});

test("browser suites use the shared preview origin and never own fixed-port servers", () => {
  const browserSuites = [...BROWSER_LANES].flatMap((lane) => INVENTORY[lane] || []);
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

/** The first argument of every `.waitForFunction(` call, skipping comments, strings, templates and regex literals. */
function waitForFunctionPredicates(source) {
  const found = [];
  const call = /\.waitForFunction\(/g;
  for (let match; (match = call.exec(source));) {
    let depth = 0, index = call.lastIndex, previous = "(";
    const start = index;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === "/" && source[index + 1] === "/") { index = source.indexOf("\n", index); if (index < 0) break; continue; }
      if (char === "/" && source[index + 1] === "*") { index = source.indexOf("*/", index + 2) + 1; continue; }
      if (char === '"' || char === "'" || char === "`") {
        for (index++; index < source.length && source[index] !== char; index++) if (source[index] === "\\") index++;
        previous = char;continue;
      }
      if (char === "/" && /[(,=:[!&|?{};+\-*%<>~^]/.test(previous)) {
        for (let inClass = false, at = index + 1; at < source.length; at++) {
          if (source[at] === "\\") { at++;continue; }
          if (source[at] === "[") inClass = true;
          else if (source[at] === "]") inClass = false;
          else if (source[at] === "/" && !inClass) { index = at;break; }
        }
        previous = "/";continue;
      }
      if ("([{".includes(char)) depth++;
      else if (")]}".includes(char)) { if (depth === 0) break; depth--; }
      else if (char === "," && depth === 0) break;
      if (!/\s/.test(char)) previous = char;
    }
    found.push({ line: source.slice(0, match.index).split("\n").length, predicate: source.slice(start, index).trim() });
  }
  return found;
}

const PROMISE_PREDICATE = /^async\b|\bawait\b|\bcaches\.|\bnavigator\.locks\b|\bindexedDB\b|\bserviceWorker\.(?:ready|getRegistrations?)\b|\.then\(|\bnew Promise\b|\bfetch\(/;

test("waitForFunction predicates are synchronous, so every wait really waits", () => {
  // Playwright takes the promise an async predicate returns as a truthy result:
  // such a wait resolves on its first poll (#348, #361). Await-needing
  // conditions go through waitForAsyncCondition in test/browser.mjs.
  // The samples spell the call through a placeholder so this file's own scan skips them.
  const scan = (text) => waitForFunctionPredicates(text.replaceAll("WFF(", "waitForFunction("));
  assert.deepEqual(scan("page.WFF(() => /isn't|é/.test(x), undefined, { timeout: 1 })"),
    [{ line: 1, predicate: "() => /isn't|é/.test(x)" }], "a regex literal with a quote stays inside the predicate");
  assert.match(scan("p.WFF(\n  async () => (await caches.keys()).length,\n  undefined)")[0].predicate, PROMISE_PREDICATE);
  assert.match(scan("p.WFF((c) => caches.has(c), name)")[0].predicate, PROMISE_PREDICATE);
  assert.doesNotMatch(scan("p.WFF(() => window.ready === true /* not async */)")[0].predicate, PROMISE_PREDICATE);

  const sources = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(process.cwd(), dir))) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const path = join(dir, name);
      if (statSync(join(process.cwd(), path)).isDirectory()) walk(path);
      else if (/\.m?js$/.test(name)) sources.push(path);
    }
  };
  walk("test");walk("tools");
  const offenders = sources.flatMap((file) => waitForFunctionPredicates(readFileSync(join(process.cwd(), file), "utf8"))
    .filter(({ predicate }) => PROMISE_PREDICATE.test(predicate))
    .map(({ line, predicate }) => `${file}:${line}: ${predicate.split("\n")[0]}`));
  assert.deepEqual(offenders, [], "an async waitForFunction predicate never waits; use waitForAsyncCondition");
});

// --------------------------------------------------------------------- shards

test("shards partition the whole browser inventory deterministically and evenly", () => {
  const entries = browserEntries();
  const bins = shardSuites(entries, CI_SHARDS);
  const ids = bins.flatMap((bin) => bin.entries.map(({ lane, suite }) => `${lane}:${suiteId(suite)}`));
  assert.equal(ids.length, entries.length, "every browser command lands in exactly one shard");
  assert.deepEqual([...new Set(ids)].sort(), entries.map(({ lane, suite }) => `${lane}:${suiteId(suite)}`).sort());
  assert.equal(SUITES.fast.some((s) => ids.includes(`fast:${suiteId(s)}`)), false, "pure-node commands are not sharded");
  assert.deepEqual(bins, shardSuites(entries, CI_SHARDS), "packing is deterministic");
  const total = entries.reduce((sum, entry) => sum + suiteSeconds(entry.suite), 0);
  const heaviest = Math.max(...entries.map((entry) => suiteSeconds(entry.suite)));
  const ceiling = Math.max(heaviest, total / CI_SHARDS) * 1.35;
  for (const bin of bins) assert.ok(bin.seconds <= ceiling, `shard of ${bin.seconds}s exceeds the balance ceiling ${ceiling.toFixed(0)}s`);
  assert.ok(bins.every((bin) => bin.entries.length), "no shard is empty");
  assert.deepEqual(shardPlan({ index: 1, count: CI_SHARDS }).entries, bins[0].entries);
  const last = shardPlan({ index: CI_SHARDS, count: CI_SHARDS });
  assert.match(last.reasons.join(" "), /Browser shard/);
  assert.ok(last.entries.length, "the last one-based shard has work");
  assert.throws(() => shardPlan({ index: entries.length + 1, count: entries.length + 1 }), /non-empty shards/,
    "an oversized matrix must not report a successful empty runner");
  assert.deepEqual(parseShard("3/16"), { index: 3, count: 16 });
  for (const bad of ["0/4", "5/4", "1", "1/0", "a/b", "", undefined]) assert.throws(() => parseShard(bad), /Shard must be k\/n/);
  assert.throws(() => shardSuites(entries, 0), /positive integer/);
});

test("the PR browser packing isolates the observed long native-gesture bottleneck", () => {
  const bins = shardSuites(browserEntries(), CI_SHARDS);
  const native = bins.find(bin => bin.entries.some(({ suite }) => suite.file === "test/native-feel.mjs"));
  assert.ok(native, "native-feel must remain in the PR inventory");
  assert.deepEqual(native.entries.filter(({ suite }) => suiteSeconds(suite) >= 60).map(({ suite }) => suite.file),
    ["test/native-feel.mjs"],
    "do not co-locate a second long suite with the variable native gesture gate");
  const loads = bins.map(bin => bin.seconds);
  assert.ok(Math.max(...loads) - Math.min(...loads) <= 6,
    "calibrated shard loads diverged: " + loads.join(", ") + "; review the measured timings");
});

test("full-lane shards partition every full browser command apart from the PR shards", () => {
  const entries = browserEntries(FULL_SUITES);
  assert.ok(entries.length && entries.every(({ lane }) => lane === "full-browser"));
  const bins = shardSuites(entries, FULL_SHARDS);
  const ids = bins.flatMap((bin) => bin.entries.map(({ suite }) => JSON.stringify(commandArgs(suite))));
  assert.deepEqual([...ids].sort(), entries.map(({ suite }) => JSON.stringify(commandArgs(suite))).sort(), "every full browser command lands in exactly one shard");
  assert.ok(bins.every((bin) => bin.entries.length), "no full shard is empty");
  const prIds = new Set(browserEntries().map(({ suite }) => JSON.stringify(commandArgs(suite))));
  assert.equal(ids.some((id) => prIds.has(id)), false, "no command runs in both lanes");
  const plan = shardPlan({ index: 1, count: FULL_SHARDS }, FULL_SUITES);
  assert.deepEqual(plan.entries, bins[0].entries);
  assert.match(plan.reasons.join(" "), /Full-lane browser shard 1\//);
  assert.ok(FULL_SUITES["full-browser"].some((suite) => suite.file === "test/simulation.mjs" && suite.env?.REPFORGE_SIM_WEEKS === "52"),
    "the year-long emergent simulation runs in the full lane");
  for (const file of ["test/direction-d-gate.mjs", "test/rules-only-gate.mjs", "test/accessibility.mjs"]) {
    assert.ok(FULL_SUITES["full-browser"].some((suite) => suite.file === file), `${file} runs in the full lane`);
  }
  assert.ok(FULL_SUITES["full-fast"].every((suite) => !BROWSER_LANES.has("full-fast") && suite.file), "full-fast is a pure-node lane");
});

test("the entire declared critical matrix is required, with source and failure provenance", (t) => {
  const keys = criticalCaptures().map(captureKey), source = "a".repeat(40);
  const report = { schemaVersion: 1, kind: "critical-ui", source, status: "passed",
    cells: keys.map(key => ({ key, status: "passed", pixelComparison: true, semanticComparison: true,
      pixelDigest: "b".repeat(64), roleMeasurements: 1, problems: [] })) };
  const check = r => validateCriticalReport(r, { source, keys });
  assert.deepEqual(check(report), []);
  for (const mutate of [
    r => r.cells.pop(), r => r.cells.push(r.cells[0]), r => r.cells[0].key = "foreign",
    r => r.source = "foreign", r => r.source = "not-a-sha", r => r.status = "failed", r => r.cells[0].pixelComparison = false,
    r => r.cells[0].semanticComparison = false, r => r.cells[0].pixelDigest = "",
    r => r.cells[0].roleMeasurements = 0, r => r.cells[0].problems.push("injected defect"),
  ]) { const bad = structuredClone(report); mutate(bad); assert.ok(check(bad).length); }
  const root = scratch(t), dir = join(root, "workout", "test-ui-system-mjs", "initial");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "ui-critical-report.json");
  assert.ok(mergeUiSystemReports(root, { source, keys }).problems.length);
  writeFileSync(path, JSON.stringify(report));
  assert.ok(mergeUiSystemReports(root, { source, keys }).problems.length, "metadata alone cannot stand in for actual frame/execution evidence");
  const manifest = loadManifest();
  for (const capture of criticalCaptures(manifest)) {
    const bytes = readFileSync(capturePath(manifest, capture));
    const target = capturePath(manifest, capture, join(dir, "frames"));
    mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes);
    report.cells.find(c => c.key === captureKey(capture)).pixelDigest = createHash("sha256").update(bytes).digest("hex");
  }
  writeFileSync(path, JSON.stringify(report));
  const evidencePath = join(dir, "..", "evidence.json");
  const execution = { kind: "browser-contract-execution", result: "passed", source: { head: source, dirty: false }, command: ["node", "test/ui-system.mjs"] };
  writeFileSync(evidencePath, JSON.stringify(execution));
  assert.deepEqual(mergeUiSystemReports(root, { source, keys }).problems, []);
  const pairedReports = scratch(t);
  symlinkSync(root, join(pairedReports, "0"), "dir");
  assert.deepEqual(mergeUiSystemReports(pairedReports, { source, keys }).problems, [],
    "paired benchmark phase directories retain frame and execution evidence through artifact links");
  const firstFrame = capturePath(manifest, criticalCaptures(manifest)[0], join(dir, "frames"));
  const originalBytes = readFileSync(firstFrame);
  writeFileSync(firstFrame, "tampered frame");
  assert.ok(mergeUiSystemReports(root, { source, keys }).problems.some(p => p.includes("digest mismatch")));
  writeFileSync(firstFrame, originalBytes);
  const invalidSource = { ...report, source: "not-a-sha" };
  writeFileSync(path, JSON.stringify(invalidSource));
  assert.ok(mergeUiSystemReports(root, { source: "not-a-sha", keys }).problems.length, "matching malformed identities still fail the real gate");
  writeFileSync(path, JSON.stringify(report));
  writeFileSync(evidencePath, JSON.stringify({ ...execution, result: "failed" }));
  assert.ok(mergeUiSystemReports(root, { source, keys }).problems.length);
  writeFileSync(evidencePath, JSON.stringify(execution));
  const duplicate = join(root, "duplicate"); mkdirSync(duplicate);
  writeFileSync(join(duplicate, "ui-critical-report.json"), JSON.stringify(report));
  assert.ok(mergeUiSystemReports(root, { source, keys }).problems.length);
  const scheduled = Object.values(SUITES).flat();
  assert.equal(scheduled.filter(s => s.file === "test/ui-system.mjs").length, 1);
  assert.equal(scheduled.some(s => ["tools/check-ui-system.mjs", "tools/capture-ui-screens.mjs"].includes(s.file)), false,
    "the exhaustive sweeps are full-lane commands, not PR evidence");
});

test("the full lane splits the two catalog sweeps into commands whose shards cover every render once", () => {
  const uiSystem = FULL_SUITES["full-browser"].filter((suite) => suite.file === "tools/check-ui-system.mjs");
  assert.equal(uiSystem.length, UI_SYSTEM_SHARDS);
  assert.deepEqual(uiSystem.map((suite) => suite.args), Array.from({ length: UI_SYSTEM_SHARDS }, (_, i) => ["--shard", `${i + 1}/${UI_SYSTEM_SHARDS}`]));
  const manifestForRoles = loadManifest();
  const roleStates = manifestForRoles.screens.length * 2 * Object.keys(manifestForRoles.locales).length;
  const renders = Array.from({ length: roleStates }, (_, i) => ({ i }));
  const parts = uiSystem.map((suite) => shardCaptures(renders, parseShard(suite.args[1])));
  assert.deepEqual(parts.flat().map((r) => r.i).sort((a, b) => a - b), renders.map((r) => r.i));
  assert.ok(Math.max(...parts.map((p) => p.length)) - Math.min(...parts.map((p) => p.length)) <= 1, "striping is even");
  assert.ok(parts.every((part) => part.length > 0), "no UI-system shard is empty for the committed catalog");
  assert.throws(() => shardCaptures(renders, parseShard(`${renders.length + 1}/${renders.length + 1}`)), /non-empty shards/);
  assert.deepEqual(shardCaptures(renders, null), renders);

  const visual = FULL_SUITES["full-browser"].filter((suite) => suite.file === "tools/capture-ui-screens.mjs");
  assert.equal(visual.length, VISUAL_SHARDS);
  assert.ok(visual.every((suite) => suite.args[0] === "--verify" && suite.args[1] === "--shard"), "every visual command verifies a shard");
  const frames = expandCaptures(loadManifest());
  const captured = visual.map((suite) => selectCaptures({ shard: parseShard(suite.args[2]) }));
  assert.equal(captured.flat().length, frames.length);
  assert.equal(new Set(captured.flat().map((c) => JSON.stringify(c))).size, frames.length);
  assert.ok(Math.max(...captured.map((c) => c.length)) - Math.min(...captured.map((c) => c.length)) <= 1);
  assert.ok(captured.every((part) => part.length > 0), "no visual shard is empty for the committed frame catalog");
  assert.equal(selectCaptures({}).length, frames.length);
});

test("full-lane UI-system shard reports merge into the catalog-wide never-rendered rule", (t) => {
  const inventory = {
    components: [{ id: "a", selector: ".a" }, { id: "b", selector: ".b", sourceOnly: true }, { id: "c", selector: ".c" }],
    exceptions: [{ selector: ".x" }, { selector: ".y", sourceOnlyReason: "documented" }],
  };
  const one = { schemaVersion: 2, shard: { index: 1, count: 2 }, screens: 3, captureKeys: ["state/a", "state/b", "state/c"], matched: ["a"], matchedExceptions: [".x"], problems: 0 };
  const two = { schemaVersion: 2, shard: { index: 2, count: 2 }, screens: 2, captureKeys: ["state/d", "state/e"], matched: ["c"], matchedExceptions: [], problems: 0 };
  const expected = { expectedShardCount: 2, expectedScreenCount: 5, expectedCaptureKeysByShard: [one.captureKeys, two.captureKeys] };
  assert.deepEqual(mergeShardReports([one, two], inventory, expected), { problems: [], shards: 2, screens: 5 });
  assert.match(mergeShardReports([one], inventory, expected).problems.join("\n"), /shard 2\/2 reported 0 time\(s\)/);
  assert.match(mergeShardReports([one, one, two], inventory, expected).problems.join("\n"), /shard 1\/2 reported 2 time\(s\)/);
  assert.match(mergeShardReports([one, { ...two, shard: { index: 2, count: 3 } }], inventory, expected).problems.join("\n"), /disagree/);
  assert.match(mergeShardReports([one, { ...two, problems: 4 }], inventory, expected).problems.join("\n"), /shard\(s\) 2\/2 reported role problems/);
  assert.deepEqual(mergeShardReports([one, { ...two, matched: [] }], inventory, expected).problems, ["inventory selector never rendered: .c"]);
  assert.deepEqual(mergeShardReports([{ ...one, matchedExceptions: [] }, two], inventory, expected).problems, ["inventory exception never rendered: .x"]);
  assert.match(mergeShardReports([], inventory, expected).problems.join("\n"), /expected 2 reports, got 0/);
  assert.match(mergeShardReports([{ ...one, shard: { index: 1, count: 1 }, matched: ["a", "c"], matchedExceptions: [".x"], screens: 5 }], inventory, expected).problems.join("\n"), /declared 1 shards, expected 2/,
    "a self-consistent partial report must not lower the required catalog sweep");
  assert.match(mergeShardReports([{ ...one, schemaVersion: 1 }, two], inventory, expected).problems.join("\n"), /unsupported schemaVersion/);
  assert.match(mergeShardReports([one, { ...two, screens: 1 }], inventory, expected).problems.join("\n"), /rendered 4 catalog states, expected 5/);
  assert.match(mergeShardReports([one, { ...two, matched: "c" }], inventory, expected).problems.join("\n"), /matched must be an array/);
  assert.match(mergeShardReports([one, { ...two, captureKeys: ["state/c", "state/e"] }], inventory, expected).problems.join("\n"), /capture keys do not match shard/,
    "equal screen counts cannot conceal a cross-shard substitution");
  assert.match(mergeShardReports([one, { ...two, captureKeys: ["state/d"] }], inventory, expected).problems.join("\n"), /capture key\(s\), but reports 2 rendered states/,
    "a report cannot claim more rendered states than its capture evidence identifies");
  const root = scratch(t);
  const realManifest = loadManifest();
  const roleCaptureKeys = realManifest.screens.flatMap((screen) => ["light", "dark"].flatMap((theme) =>
    Object.keys(realManifest.locales).map((locale) => captureKey({
      flow: screen.flow, screen: screen.id, viewport: "phone-390", theme, locale, text: "normal", motion: "normal",
    }))));
  const roleKeysByShard = Array.from({ length: UI_SYSTEM_SHARDS }, (_, index) =>
    shardCaptures(roleCaptureKeys, { index: index + 1, count: UI_SYSTEM_SHARDS }));
  const expectedScreens = roleCaptureKeys.length;
  const perShard = Array.from({ length: UI_SYSTEM_SHARDS }, (_, index) => ({
    schemaVersion: 2,
    shard: { index: index + 1, count: UI_SYSTEM_SHARDS },
    screens: roleKeysByShard[index].length,
    captureKeys: roleKeysByShard[index],
    matched: index === 0 ? ["a"] : index === 1 ? ["c"] : [],
    matchedExceptions: index === 0 ? [".x"] : [],
    problems: 0,
  }));
  for (const [index, report] of perShard.entries()) {
    const name = `full-shard-${index}/full-browser/x-${index}/initial`;
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "ui-system-shard.json"), JSON.stringify(report));
    writeFileSync(join(root, name, "output.log"), "noise");
  }
  assert.equal(findShardReports(root).length, UI_SYSTEM_SHARDS);
  assert.deepEqual(findShardReports(join(root, "missing")), []);
  const gateMerge = mergeFullUiSystemReports(root, { inventory, manifest: realManifest });
  assert.equal(gateMerge.shards, UI_SYSTEM_SHARDS, "the gate requires the complete declared sweep");
  assert.equal(gateMerge.problems.some((p) => /never rendered/.test(p)), false);

  // CI artifacts are named shard-<job index>-<run attempt>, and the gate downloads
  // every attempt. Re-running a failed job must replace its earlier report, not
  // count twice; a re-run that wrote no report must not fall back to the stale one.
  const attempts = scratch(t);
  const writeAttempt = (job, attempt, report) => {
    const dir = join(attempts, `full-shard-${job}-${attempt}`, "full-browser", `x-${job}`, "initial");
    mkdirSync(dir, { recursive: true });
    if (report) writeFileSync(join(dir, "ui-system-shard.json"), JSON.stringify(report));
  };
  for (const [index, report] of perShard.entries()) writeAttempt(index * 2, 1, { ...report, problems: index === 0 ? 3 : 0 });
  writeAttempt(0, 2, perShard[0]);
  const rerun = mergeFullUiSystemReports(attempts, { inventory, manifest: realManifest });
  const mergeProblems = (problems) => problems.filter((p) => /duplicates capture key|reported \d+ time|expected \d+ reports|catalog states, expected|reported role problems/.test(p));
  assert.deepEqual(mergeProblems(rerun.problems), [], "a re-run job's report replaces its earlier attempt");
  assert.equal(rerun.shards, UI_SYSTEM_SHARDS);
  writeAttempt(2, 2, null);
  assert.match(mergeFullUiSystemReports(attempts, { inventory, manifest: realManifest }).problems.join("\n"), /expected \d+ reports, got \d+/,
    "a re-run that wrote no report leaves its shard missing instead of reviving the stale report");
});

test("verify mode compares a staged capture with the committed catalog and keeps evidence for failures", (t) => {
  const real = loadManifest();
  const dir = scratch(t);
  const stagingRoot = join(dir, "staging");
  const committedRoot = join(process.cwd(), real.artifactRoot);
  for (const capture of expandCaptures(real)) {
    const target = capturePath(real, capture, stagingRoot);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(capturePath(real, capture, committedRoot), target);
  }
  const semantic = JSON.parse(readFileSync(join(process.cwd(), "docs/ui-screens/entry-semantics.json"), "utf8"));
  const artifactDir = join(dir, "artifacts");
  assert.equal(verifyCatalog({ stagingRoot, semanticArtifact: semantic, artifactDir, manifest: real }), true);
  assert.equal(JSON.parse(readFileSync(join(artifactDir, "visual-report.json"), "utf8")).ok, true);
  assert.equal(existsSync(join(artifactDir, "visual-failures")), false);

  const [victim] = expandCaptures(real).filter((capture) => capture.flow === "workout");
  const [impostor] = expandCaptures(real).filter((capture) => capture.flow === "progress" && capture.viewport === victim.viewport
    && capture.theme === victim.theme && capture.locale === victim.locale && capture.text === victim.text);
  const victimPath = capturePath(real, victim, stagingRoot);
  rmSync(victimPath);
  cpSync(capturePath(real, impostor, committedRoot), victimPath);
  const committedBytes = readFileSync(capturePath(real, victim, committedRoot));
  assert.equal(verifyCatalog({ stagingRoot, semanticArtifact: semantic, artifactDir, manifest: real }), false);
  const relativePath = relative(stagingRoot, victimPath);
  assert.ok(existsSync(join(artifactDir, "visual-failures", "current", relativePath)), "the failing capture is retained");
  assert.ok(existsSync(join(artifactDir, "visual-failures", "baseline", relativePath)), "its committed baseline is retained beside it");
  const report = JSON.parse(readFileSync(join(artifactDir, "visual-report.json"), "utf8"));
  assert.equal(report.ok, false);
  assert.deepEqual(report.comparison.failures.map((f) => f.path), [relativePath]);
  assert.deepEqual(readFileSync(capturePath(real, victim, committedRoot)), committedBytes, "the committed catalog is never rewritten");
});

// -------------------------------------------------------------------- CI plan

test("nothing the app, its tests or its tools load depends on the design mocks the selectors skip", () => {
  // The selectors skip docs/design/native-fidelity-mocks/ because nothing executable reads it. If a test, tool or app
  // file starts to, a change there could alter a result while CI skips it, so the only files that may name the folder
  // are the selectors that skip it, this contract and prose.
  const allowed = new Set(["tools/ci-plan.mjs", "tools/ci-selection.mjs", "tools/test-selection.mjs", "test/ci.mjs"]);
  const referencing = execFileSync("git", ["grep", "-l", "native-fidelity-mocks"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const executable = referencing.filter((file) => !file.startsWith("docs/design/native-fidelity-mocks/") && !/\.md$/.test(file) && !allowed.has(file));
  assert.deepEqual(executable, [], `executable files that reference the skipped design mocks: ${executable.join(", ")}`);
});

test("standalone native-fidelity design mocks are inert across CI and local selectors", () => {
  const mockFiles = [
    "docs/design/native-fidelity-mocks/after/equipment-dark.png",
    "docs/design/native-fidelity-mocks/compare/equipment-light.png",
    "docs/design/native-fidelity-mocks/capture.mjs",
    "docs/design/native-fidelity-mocks/kit.css",
    "docs/design/native-fidelity-mocks/equipment.html",
  ];
  assert.equal(classifyChange(mockFiles).run, false, "only nonproduction mock changes may skip PR jobs");
  assert.equal(selectFullLane(mockFiles).mode, "none", "standalone design references cannot require the full lane");
  assert.equal(selectAffected(mockFiles).mode, "none", "local selectors agree with the PR planner");
  assert.equal(selectVisuals(mockFiles, manifest).mode, "none", "standalone prototypes do not alter production captures");

  const mixed = [...mockFiles, "app.js"];
  assert.equal(classifyChange(mixed).run, true, "real application changes still require the PR lane");
  assert.equal(selectFullLane(mixed).mode, "all", "an unbounded production change cannot be hidden by mock assets");
  assert.equal(selectAffected(mixed).mode !== "none", true);
  assert.equal(selectVisuals(mixed, manifest).mode, "full");
  for (const path of [
    "docs/design/prototype.html", "docs/design/unreviewed-example.js",
    "docs/ui-screens/screens/history/session__phone-390-light-en.png",
    "docs/ui-screens/entry-semantics.json", "docs/ui-screens/manifest.json",
  ]) {
    assert.equal(classifyChange([path]).run, true, path + " remains an executable/unknown input");
    assert.equal(selectFullLane([path]).mode !== "none", true, path + " is not allowlisted");
  }
});

test("CI runs everything unless a change is provably prose-only", () => {
  assert.equal(classifyChange(null).run, true);
  assert.equal(classifyChange([]).run, true);
  assert.equal(classifyChange(["docs/backlog.md", "plans/062.md", ".gitignore", "LICENSE", "docs/ui-screens/README.md"]).run, false);
  for (const document of ["README.md", "NOTICE.md", "docs/recovery-week-policy.md", "tools/README.md"]) {
    assert.equal(classifyChange([document]).run, true, `${document} is an input to a verification contract`);
  }
  for (const fixture of ["test/fixtures/coach-program.txt", "docs/fixtures/catalog-notes.md"]) {
    assert.equal(classifyChange([fixture]).run, true, `${fixture} can be executable test input despite its prose extension`);
  }
  for (const file of ["app.js", "docs/design/prototype.html", "test/fixtures/x.json", ".github/workflows/ci.yml", "docs/ui-screens/screens/app/today__phone-390-light-en.png", "mystery.bin", "tools/serve.py"]) {
    const plan = classifyChange(["docs/note.md", file]);
    assert.equal(plan.run, true, file);
    assert.match(plan.reason, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.deepEqual(shardMatrix(3), ["1/3", "2/3", "3/3"]);
  assert.equal(shardMatrix().length, CI_SHARDS);
});

test("pull-request file lists use GitHub first-page comparison and fail open on incomplete data", async (t) => {
  // GitHub returns up to 300 changed files ONLY on page 1, independently of commit pagination.
  const first = { files: [
    ...Array.from({ length: 100 }, (_, i) => ({ filename: "src/" + i + ".js", ...(i === 3
      ? { status: "renamed", previous_filename: "src/old.js" } : {}) })),
    { filename: "docs/a.md" },
    { filename: "app.js", patch: "@@ -1 +1 @@\n-old\n+new" },
  ] };
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); return { ok: true, json: async () => first }; };
  const patches = {};
  const files = await pullRequestFiles({ apiUrl: "https://api.example", repository: "o/r", base: "b".repeat(40),
    head: "h".repeat(40), token: "t", fetchImpl, patches });
  assert.equal(files.length, 103);
  assert.ok(files.includes("src/old.js") && files.includes("app.js"));
  assert.equal(patches["app.js"], "@@ -1 +1 @@\n-old\n+new");
  assert.equal(urls.length, 1, "commit pagination must not trigger further file-list requests");
  assert.match(urls[0], /\/repos\/o\/r\/compare\/b{40}\.\.\.h{40}\?per_page=100&page=1$/);

  const answer = (body) => async () => ({ ok: true, json: async () => body });
  const args = { apiUrl: "x", repository: "o/r", base: "b", head: "h" };
  assert.equal(await pullRequestFiles({ ...args, fetchImpl: answer({
    files: Array.from({ length: 300 }, (_, i) => ({ filename: "f" + i })) }) }), null,
    "300 files may be a truncated comparison and must run the full suite");
  for (const payload of [{}, { files: [] }, { files: [{}] },
    { files: [{ filename: "" }] }, { files: [{ filename: "new.js", status: "renamed" }] }]) {
    assert.equal(await pullRequestFiles({ ...args, fetchImpl: answer(payload) }), null,
      "malformed or empty diff must not suppress the full lane: " + JSON.stringify(payload));
  }
  await assert.rejects(pullRequestFiles({ ...args, fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);

  const dir = scratch(t);
  const eventPath = join(dir, "event.json");
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: "b".repeat(40) }, head: { sha: "h".repeat(40) } } }));
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: "https://api.example" };
  const prose = await resolvePlan(env, { fetchImpl: answer({ files: [{ filename: "docs/a.md" }] }) });
  assert.equal(prose.run, false);
  assert.equal(prose.head, "h".repeat(40));
  const code = await resolvePlan(env, { fetchImpl: answer({ files: [{ filename: "app.js" }] }) });
  assert.equal(code.run, true);
  for (const payload of [{ files: [] }, {}]) {
    const incomplete = await resolvePlan(env, { fetchImpl: answer(payload) });
    assert.equal(incomplete.run, true);
    assert.equal(incomplete.full.mode, "all", "unavailable file evidence must run every full-lane test");
  }
  const broken = await resolvePlan(env, { fetchImpl: async () => { throw new Error("offline"); } });
  assert.equal(broken.run, true);
  assert.equal(broken.files, null);
  const push = await resolvePlan({ GITHUB_EVENT_NAME: "push", GITHUB_SHA: "m".repeat(40) });
  assert.equal(push.run, true);
  assert.equal(push.head, "m".repeat(40));
  const manual = await resolvePlan({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_SHA: "d".repeat(40) });
  assert.equal(manual.run, true, "manual dispatch cannot select a weaker scope");
  assert.equal(manual.head, "d".repeat(40));
});

test("the gate accepts skipped jobs only when the plan skipped them", () => {
  const fullShards = JSON.stringify(shardMatrix(CI_SHARDS));
  const selected = { plan: { result: "success", outputs: { run: "true", shards: fullShards } }, fast: { result: "success" }, browser: { result: "success" }, service: { result: "success" } };
  assert.doesNotThrow(() => gateResults(selected, { log() {} }));
  assert.throws(() => gateResults({ ...selected, browser: { result: "failure" } }, { log() {} }), /browser: expected success, got failure/);
  assert.throws(() => gateResults({ ...selected, service: { result: "skipped" } }, { log() {} }), /service: expected success, got skipped/);
  assert.throws(() => gateResults({ ...selected, browser: { result: "cancelled" } }, { log() {} }), /browser: expected success, got cancelled/);
  const prose = { plan: { result: "success", outputs: { run: "false", reason: "Only prose changed", shards: fullShards } }, fast: { result: "skipped" }, browser: { result: "skipped" }, service: { result: "skipped" } };
  assert.doesNotThrow(() => gateResults(prose, { log() {} }));
  assert.throws(() => gateResults({ ...prose, fast: { result: "success" } }, { log() {} }), /fast: expected skipped, got success/);
  assert.throws(() => gateResults({ ...prose, fast: { result: "cancelled" } }, { log() {} }), /fast: expected skipped, got cancelled/);
  assert.throws(() => gateResults({ ...selected, plan: { result: "failure" } }, { log() {} }), /plan job failure/);
  assert.throws(() => gateResults({}, { log() {} }), /missing required job plan/);
  const missingService = { ...selected };
  delete missingService.service;
  assert.throws(() => gateResults(missingService, { log() {} }), /missing required job service/);
  const unplanned = { ...prose, plan: { result: "success", outputs: {} } };
  assert.throws(() => gateResults(unplanned, { log() {} }), /run output must be "true" or "false"/);
  for (const run of ["yes", "", null]) {
    assert.throws(() => gateResults({ ...prose, plan: { result: "success", outputs: { run } } }, { log() {} }), /run output must be "true" or "false"/);
  }
  for (const shards of [undefined, "not-json", JSON.stringify(shardMatrix(CI_SHARDS).slice(1)), JSON.stringify(["1/14", "1/14"])]) {
    assert.throws(() => gateResults({ ...selected, plan: { result: "success", outputs: { run: "true", shards } } }, { log() {} }), /plan shards output/);
  }
});

test("every full-history browser runner uses blobless checkout without losing historical commits", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const section = (name) => {
    const start = workflow.indexOf(`\n  ${name}:\n`);
    assert.ok(start !== -1, `${name} exists`);
    return workflow.slice(start + 1).split(/\n  (?=[a-z][a-z0-9-]*:\n)/)[0];
  };
  for (const name of ["browser", "full-browser"]) {
    const body = section(name);
    assert.match(body, /uses: actions\/checkout@v5\n\s+with:\n\s+ref: .*\n\s+persist-credentials: false\n\s+filter: blob:none\n(?:\s*#.*\n)*\s+fetch-depth: 0/,
      `${name} fetches all historical commits but only needed file blobs`);
    assert.equal((body.match(/fetch-depth: 0/g) || []).length, 1, `${name} keeps exactly one full-history checkout`);
  }
  assert.doesNotMatch(section("plan"), /filter: blob:none/, "the planner keeps its ordinary shallow checkout");
});

test("the workflow stages the targeted full lane behind a passing PR lane", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /shard: \$\{\{ fromJSON\(needs\.plan\.outputs\.shards\) \}\}/, "the shard list comes from the inventory, not the YAML");
  assert.match(workflow, /node tools\/run-tests\.mjs shard "\$\{\{ matrix\.shard \}\}" --keep-going/);
  assert.match(workflow, /node tools\/ci-plan\.mjs gate\n/);
  const jobsSection = workflow.split(/^jobs:\s*$/m)[1] || "";
  const job = (name) => jobsSection.slice(jobsSection.indexOf(`\n  ${name}:\n`) + 1).split(/\n  (?=[a-z][a-z0-9-]*:\n)/)[0];
  const gateJob = job("ci");
  const guard = gateJob.indexOf('if [ "$RUN" != "true" ] && [ "$RUN" != "false" ]; then');
  assert.ok(guard > 0 && guard < gateJob.indexOf("uses: actions/checkout"),
    "the gate rejects a missing run decision in YAML, before it trusts any checked-out planner code");
  assert.match(gateJob, /RUN: \$\{\{ needs\.plan\.outputs\.run \}\}/);
  assert.match(workflow, /node tools\/ci-plan\.mjs merge-ui-system /);
  assert.match(gateJob, /needs: \[plan, fast, browser, service\]\n\s+if: \$\{\{ always\(\) \}\}/, "the gate evaluates cancelled and unexpectedly skipped jobs as failures");
  const declaredJobs = [...jobsSection.matchAll(/^  ([a-z][a-z0-9-]*):$/gm)].map(([, name]) => name);
  const needsOf = (name) => job(name).match(/^    needs: \[([^\]]+)\]$/m)?.[1].split(",").map((value) => value.trim()) || [];
  assert.deepEqual([...new Set([...needsOf("ci"), ...needsOf("ci-full")])].sort(), declaredJobs.filter((name) => name !== "ci-full").sort(),
    "the two aggregates together wait for every workflow job, including any newly added verification lane");
  assert.deepEqual(needsOf("ci-full"), ["plan", "ci", "full-fast", "full-browser", "full-capture"]);
  assert.match(workflow, /^  schedule:\n    - cron: "[^"]+"$/m, "the full lane also runs nightly");
  assert.match(workflow, /^  push:\n    branches: \[main\]$/m, "the full lane runs on every push to main");
  for (const [name, output] of [["full-fast", "full_fast"], ["full-browser", "full_browser"]]) {
    const body = job(name);
    assert.deepEqual(needsOf(name), ["plan", "ci"], `${name} waits for the PR lane`);
    assert.ok(body.includes(`if: \${{ !cancelled() && needs.plan.outputs.${output} == 'true' && (github.event_name != 'pull_request' || needs.ci.result == 'success') }}`),
      `${name} starts on a PR only after the PR lane passed, and always on main and nightly`);
    assert.match(body, /REPFORGE_FULL_SELECTION: \$\{\{ needs\.plan\.outputs\.full_selection \}\}/, `${name} runs the planned selection`);
  }
  const fullGate = job("ci-full");
  assert.match(fullGate, /if: \$\{\{ always\(\) \}\}/, "even cancellation reaches the full aggregate instead of silently skipping it");
  assert.match(fullGate, /EVENT: \$\{\{ github\.event_name \}\}/);
  assert.match(fullGate, /node tools\/ci-plan\.mjs gate-full/);
  assert.match(fullGate, /node tools\/ci-plan\.mjs merge-ui-system-full/);
  assert.match(workflow, /shard: \$\{\{ fromJSON\(needs\.plan\.outputs\.full_shards\) \}\}/);
  assert.match(workflow, /node tools\/run-tests\.mjs full-shard "\$\{\{ matrix\.shard \}\}" --keep-going/);
  assert.match(workflow, /node tools\/run-tests\.mjs full-fast --keep-going/);
  assert.equal((workflow.match(/if: needs\.plan\.outputs\.run == 'true'/g) || []).length >= 3, true, "test jobs obey the plan");
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/, "a newer push cancels both lanes of any branch run; main never cancels");
  assert.doesNotMatch(workflow, /expected_sha|simulation-feedback|candidate/, "there is one mode");
  for (const name of ["browser", "full-browser"]) {
    const body = job(name);
    assert.match(body, /REPFORGE_CI_CAPTURES_DIR: \$\{\{ github\.workspace \}\}\/\.ci-captures/, `${name} publishes changed frames`);
    assert.match(body, /name: ci-captures-\$\{\{ github\.job \}\}-\$\{\{ strategy\.job-index \}\}-\$\{\{ github\.run_attempt \}\}\n\s+path: \.ci-captures\/\n\s+include-hidden-files: true\n\s+if-no-files-found: ignore/,
      "the dot-directory is uploaded (upload-artifact skips hidden paths by default)");
    assert.match(body, /uses: actions\/cache@v4\n\s+with:\n\s+path: \|\n\s+~\/\.cache\/ms-playwright\n\s+~\/\.cache\/playwright-apt/,
      `${name} reuses the browser and its system packages instead of a slow mirror`);
  }
});

// ------------------------------------------------------------ visual selection

test("share-link visual fixtures pin random preview origins without changing the payload", () => {
  const hash = "#setup=v3.fixture-payload";
  assert.equal(stabilizeShareUrlForCapture(`http://127.0.0.1:43129/index.html${hash}`),
    `http://localhost:8765/index.html${hash}`);
  const production = "https://pedrochagasmaster.github.io/repforge/index.html#setup=v3.fixture-payload";
  assert.equal(stabilizeShareUrlForCapture(production), production);
});

test("local visual selection ignores non-rendering tests/tools but remains conservative for real inputs", () => {
  for (const file of ["README.md", "docs/backlog.md", "plans/060.md", "advisor-plans/001-example.md", "test/accessibility.mjs", "test/ci.mjs", "tools/run-tests.mjs", "tools/test-selection.mjs", "tools/ci-plan.mjs", "tools/check-production-syntax.mjs", "tools/check-test-syntax.mjs", ".github/workflows/ci.yml"]) {
    assert.equal(selectVisuals([file], manifest).mode, "none", file);
  }
  for (const file of ["app.js", "index.html", "styles.css", "i18n-en.json", "sw.js", "shared-setup.js", "fonts/new.woff2", "assets/exercises/foo.png", "test/browser.mjs", "test/fixtures/shared-setup.mjs", "tools/ui-screens/session.mjs", "tools/ui-screens/screens-app.mjs", "tools/capture-ui-screens.mjs", "docs/ui-screens/manifest.json", "docs/ui-screens/entry-semantics.json", "unknown.txt"]) {
    assert.equal(selectVisuals([file], manifest).mode, "full", file);
  }
  for (const file of ["test/fixtures/seed-program.mjs", "test/fixtures/telemetry.mjs", "test/fixtures/README.md", "test/fixtures/nested/AGENTS.md"]) {
    assert.equal(selectVisuals([file], manifest).mode, "none", file);
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
  assert.deepEqual([...domainsForAppDiff(source, "@@ -5 +5 @@\n-// @ci-domain history\n+// @ci-domain progress\n")], ["global"]);
  const sample = { screens: [{ flow: "history", id: "edit" }, { flow: "progress", id: "overview" }] };
  assert.deepEqual(selectVisuals(["app.js"], sample, { appSource: source, appDiff: "@@ -5 +5 @@\n-old\n+new\n" }).screens, ["history/edit"]);
});

test("deletions at an annotation boundary retain the deleted region's tests", () => {
  // Context can advance the new-file pointer onto the next domain's marker.
  const source = ["// @ci-domain history", "// @ci-domain progress", "function progress() {}"].join("\n");
  const patch = "@@ -1,4 +1,3 @@\n // @ci-domain history\n-function history() {}\n // @ci-domain progress\n function progress() {}";
  assert.ok(domainsForAppDiff(source, patch).has("history"), "deleted History code requires History verification");
  // A deletion at EOF has no successor: keep its known owner, not global.
  const endSource = ["// @ci-domain history", "const kept = 1;"].join("\n");
  const endPatch = "@@ -1,3 +1,2 @@\n // @ci-domain history\n const kept = 1;\n-const deleted = 2;";
  assert.deepEqual([...domainsForAppDiff(endSource, endPatch)], ["history"]);

  const selection = selectFullLane(["app.js"], { sources: { "app.js": source }, patches: { "app.js": patch } });
  assert.equal(selection.mode, "selected");
  assert.ok(selection.screens.some((key) => key.startsWith("history/")), "affected History frames must be selected");

  const css = ["/* @ci-domain history */", "/* @ci-domain progress */", ".progress { color: inherit; }"].join("\n");
  const cssPatch = "@@ -1,4 +1,3 @@\n /* @ci-domain history */\n-.history { color: inherit; }\n /* @ci-domain progress */\n .progress { color: inherit; }";
  const cssSelection = selectFullLane(["styles.css"], { sources: { "styles.css": css }, patches: { "styles.css": cssPatch } });
  assert.ok(cssSelection.screens.some((key) => key.startsWith("history/")), "deleted History CSS requires History verification");
});

test("app.js hunks after the reviewed History block never inherit History", () => {
  const source = readFileSync(join(process.cwd(), "app.js"), "utf8");
  for (const [marker, expected] of [["function exerciseSessionsDetail", ["global"]], ["function renderProgramOverview", ["program"]],
    ["function renderCatalogueStep", ["entry", "program"]], ["function init()", ["global"]]]) {
    const line = source.split("\n").findIndex((value) => value.startsWith(marker)) + 1;
    assert.ok(line > 0, `production app contains ${marker}`);
    const diff = `@@ -${line} +${line} @@\n-old\n+new\n`;
    assert.deepEqual([...domainsForAppDiff(source, diff)].sort(), expected, marker);
  }
});

test("baseline-only selection recaptures whole screens, never isolated variants", () => {
  const plan = selectVisuals(["docs/ui-screens/screens/app/today__phone-390-light-en.png", "docs/ui-screens/README.md"], manifest);
  assert.equal(plan.mode, "screens");
  assert.deepEqual(plan.screens, ["app/today"]);
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/unknown__phone.png"], manifest).mode, "full");
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/today__phone.png", "styles.css"], manifest).mode, "full");
});

// ------------------------------------------------------- targeted full lane

const realLine = (path, startsWith) => {
  const line = readFileSync(join(process.cwd(), path), "utf8").split("\n").findIndex((value) => value.startsWith(startsWith)) + 1;
  assert.ok(line > 0, `${path} contains ${startsWith}`);
  return line;
};
const hunkAt = (line) => `@@ -${line} +${line} @@\n-old\n+new`;
const revisionPatch = (before, after) => `@@ -1 +1 @@\n-${before}\n+${after}`;
const fullIds = (selection) => fullLaneEntries(selection).map(({ suite }) => suiteId(suite));
const fullFiles = (selection) => [...new Set(fullLaneEntries(selection).map(({ suite }) => suite.file))].sort();
const flowsOf = (selection) => [...new Set(selection.screens.map((key) => key.split("/")[0]))].sort();

test("a Focus-only change runs the Focus flows and their full-lane journeys, nothing unrelated", () => {
  const files = ["app.js", "styles.css", "sw.js", "index.html", "docs/ui-screens/screens/workout/focus__phone-390-light-en.png", "docs/design/note.md"];
  const patches = {
    "app.js": hunkAt(realLine("app.js", "function focusCardHtml(")),
    "styles.css": hunkAt(realLine("styles.css", "article.exercise--focus{")),
    "sw.js": [revisionPatch('const CACHE = "repforge-v510";', 'const CACHE = "repforge-v511";'),
      revisionPatch('  "./app.js", "./app.js?v=510",', '  "./app.js", "./app.js?v=511",')].join("\n"),
    "index.html": revisionPatch('  <script src="app.js?v=510"></script>', '  <script src="app.js?v=511"></script>'),
  };
  const selection = selectFullLane(files, { patches });
  assert.equal(selection.mode, "selected", selection.reasons.join(" "));
  const flows = flowsOf(selection);
  for (const flow of ["workout", "session"]) assert.ok(flows.includes(flow), `${flow} screens are verified`);
  for (const flow of ["progress", "settings", "install", "library", "program", "onboarding-recommend", "onboarding-start", "programlab"]) {
    assert.equal(flows.includes(flow), false, `${flow} screens are not touched by a Focus change`);
  }
  const selectedFiles = fullFiles(selection);
  for (const file of ["test/focus-mode.mjs", "test/focus-geometry.mjs", "test/why-sheet.mjs", "test/focus-space-summary.mjs",
    "tools/check-ui-system.mjs", "tools/capture-ui-screens.mjs"]) assert.ok(selectedFiles.includes(file), `${file} runs`);
  for (const file of ["test/programlab-ui.mjs", "test/install-modes.mjs", "test/settings-groups.mjs", "test/library-flow.mjs",
    "test/program-editor-sorting.mjs", "test/entry-chooser.mjs", "test/programlab-archive.mjs"]) assert.equal(selectedFiles.includes(file), false, `${file} is not selected`);
  const catalog = fullLaneEntries(selection).filter(({ suite }) => suite.file === "tools/check-ui-system.mjs" || suite.file === "tools/capture-ui-screens.mjs");
  assert.ok(catalog.length && catalog.every(({ suite }) => suite.env?.REPFORGE_CATALOG_SCREENS === selection.screens.join(",")),
    "every catalog sweep is restricted to the selected states");
  assert.ok(fullLaneEntries(selection).length < Object.values(FULL_SUITES).flat().length);
});

test("foundations, unknown inputs and unmappable diffs run the complete full lane", () => {
  const tokens = selectFullLane(["styles.css"], { patches: { "styles.css": hunkAt(realLine("styles.css", "  --color-ink:")) } });
  assert.equal(tokens.mode, "all", "a token change selects everything");
  assert.equal(tokens.screens, null);
  assert.deepEqual(fullIds(tokens), Object.values(FULL_SUITES).flat().map(suiteId));
  const shellHunk = { "app.js": hunkAt(realLine("app.js", "function init()")) };
  assert.equal(selectFullLane(["app.js"], { patches: shellHunk }).mode, "all", "unannotated app.js widens");
  for (const file of ["motion-layer.js", "motion-polish.css", "durable-state.js", "workout-draft.js", "i18n-en.json", "exercises.js",
    "vendor/x.js", "fonts/a.woff2", "test/browser.mjs", "tools/ui-screens/session.mjs", "docs/ui-screens/manifest.json",
    "tools/ui-role-inventory.json", ".github/workflows/ci.yml", "tools/test-selection.mjs", "test/suites.mjs", "mystery.bin",
    "tools/capture-ui-screens.mjs", "tools/check-ui-system.mjs", "tools/ci-selection.mjs"]) {
    assert.equal(selectFullLane([file], { patches: {} }).mode, "all", file);
  }
  assert.equal(selectFullLane(["sw.js"], { patches: { "sw.js": revisionPatch('  "./app.js",', '  "./app.js", "./new.js",') } }).mode, "all",
    "a changed precache inventory is not a revision bump");
  assert.equal(selectFullLane(["index.html"], { patches: { "index.html": revisionPatch("<main>", "<main class=x>") } }).mode, "all");
  assert.equal(selectFullLane(["app.js"], { patches: {} }).mode, "all", "a missing patch cannot be narrowed");
  assert.equal(selectFullLane(null).mode, "all");
  assert.equal(selectFullLane(["styles.css"], { patches: { "styles.css": "@@ -1 +1 @@\n-/* @ci-domain workout */\n+/* @ci-domain history */" } }).mode, "all",
    "moving an ownership marker widens");
});

test("full-lane selection is exact for suite, fixture, prose and Program Lab changes", () => {
  assert.equal(selectFullLane(["docs/backlog.md", "plans/080.md"]).mode, "none");
  assert.equal(selectFullLane([]).mode, "none");
  const history = selectFullLane(["test/history.mjs"]);
  assert.equal(history.mode, "selected");
  assert.deepEqual(fullFiles(history), ["test/history.mjs"]);
  assert.deepEqual(history.screens, []);
  assert.equal(selectFullLane(["test/native-feel.mjs"]).mode, "none", "a pull-request suite already ran in the PR lane");
  const design = selectFullLane(["DESIGN.md"]);
  assert.deepEqual(fullFiles(design), ["tools/check-design-md.mjs"], "DESIGN.md is a full-lane input despite being prose");
  const lab = selectFullLane(["programlab/ui.js"]);
  assert.equal(lab.mode, "selected");
  assert.ok(fullFiles(lab).includes("test/programlab-ui.mjs"));
  assert.deepEqual(flowsOf(lab), ["programlab"]);
  const baseline = selectFullLane(["docs/ui-screens/screens/history/conflict__phone-390-light-en.png"]);
  assert.deepEqual(baseline.screens, ["history/conflict"]);
});

test("targeted catalog sweeps re-stripe only the selected states and the plan sizes the matrix from data", () => {
  const real = loadManifest();
  const screens = real.screens.filter((screen) => screen.flow === "workout").map((screen) => `${screen.flow}/${screen.id}`);
  const selection = { mode: "selected", ids: [suiteId(FULL_SUITES["full-browser"].find((suite) => suite.file === "test/focus-mode.mjs"))], screens };
  const entries = fullLaneEntries(selection);
  const uiSystem = entries.filter(({ suite }) => suite.file === "tools/check-ui-system.mjs");
  const visual = entries.filter(({ suite }) => suite.file === "tools/capture-ui-screens.mjs");
  assert.ok(uiSystem.length >= 1 && uiSystem.length <= UI_SYSTEM_SHARDS && visual.length >= 1 && visual.length <= VISUAL_SHARDS);
  const roleKeys = screens.length * real.themes.length * Object.keys(real.locales).length;
  const roleParts = uiSystem.map(({ suite }) => shardCaptures(Array.from({ length: roleKeys }, (_, i) => i), parseShard(suite.args[1])));
  assert.equal(roleParts.flat().length, roleKeys);
  assert.ok(roleParts.every((part) => part.length), "no targeted UI-system stripe is empty");
  const frames = visual.map(({ suite }) => selectCaptures({ screens, shard: parseShard(suite.args[2]) }));
  assert.equal(frames.flat().length, selectCaptures({ screens }).length);
  assert.ok(frames.every((part) => part.length), "no targeted verify stripe is empty");
  // A targeted stripe never costs more than a full one; it costs the same when the selection is exactly one full
  // stripe's worth of states (the workout flow's 32 states against 224 / 7, 2026-10-24).
  assert.ok(suiteSeconds(uiSystem[0].suite) <= suiteSeconds(FULL_SUITES["full-browser"].find((suite) => suite.file === "tools/check-ui-system.mjs")));
  const browser = entries.filter(({ lane }) => lane === "full-browser");
  const count = fullShardCount(browser);
  assert.ok(count >= 1 && count <= FULL_SHARDS && count <= browser.length);
  const bins = shardSuites(browser, count);
  assert.equal(bins.flatMap((bin) => bin.entries).length, browser.length);
  assert.equal(fullShardCount(browserEntries(FULL_SUITES)), FULL_SHARDS, "the complete lane keeps its full matrix");
  assert.deepEqual(fullLaneEntries({ mode: "none", ids: [], screens: [] }), []);
  assert.deepEqual(fullLaneEntries(JSON.parse(JSON.stringify(selection))), entries, "the plan output round-trips to the same commands");
  const planned = shardPlan({ index: 1, count }, FULL_SUITES, selection);
  assert.deepEqual(planned.entries, bins[0].entries, "a runner computes the same targeted split as the plan");
});

test("the plan publishes the targeted full lane for pull requests and the complete one elsewhere", async (t) => {
  const dir = scratch(t);
  const eventPath = join(dir, "event.json");
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: "b".repeat(40) }, head: { sha: "h".repeat(40) } } }));
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: "https://api.example" };
  const answer = (files) => async () => ({ ok: true, json: async () => ({ files }) });
  const suite = await resolvePlan(env, { fetchImpl: answer([{ filename: "test/history.mjs", patch: "@@ -1 +1 @@\n-a\n+b" }]) });
  assert.equal(suite.full.mode, "selected");
  assert.deepEqual(fullFiles(suite.full), ["test/history.mjs"]);
  const outputs = planOutputs(suite);
  assert.equal(outputs.full_run, "true");
  assert.equal(outputs.full_fast, "false");
  assert.equal(outputs.full_browser, "true");
  assert.deepEqual(JSON.parse(outputs.full_shards), ["1/1"]);
  assert.deepEqual(JSON.parse(outputs.full_selection), { mode: suite.full.mode, ids: suite.full.ids, screens: suite.full.screens });
  const prose = planOutputs(await resolvePlan(env, { fetchImpl: answer([{ filename: "docs/a.md" }]) }));
  assert.equal(prose.full_run, "false");
  assert.equal(prose.full_browser, "false");
  const push = planOutputs(await resolvePlan({ GITHUB_EVENT_NAME: "push", GITHUB_SHA: "m".repeat(40) }));
  assert.equal(JSON.parse(push.full_selection).mode, "all", "main never narrows");
  assert.deepEqual(JSON.parse(push.full_shards), shardMatrix(FULL_SHARDS));
  assert.equal(push.full_fast, "true");
  const broken = planOutputs(await resolvePlan(env, { fetchImpl: async () => { throw new Error("offline"); } }));
  assert.equal(JSON.parse(broken.full_selection).mode, "all", "an unknown change list runs everything");
});

test("the full gate is staged behind the PR lane and accepts only what the plan skipped", () => {
  const selection = { mode: "selected", ids: [suiteId(FULL_SUITES["full-browser"].find((suite) => suite.file === "test/history.mjs"))], screens: [] };
  const plan = (outputs) => ({ result: "success", outputs: { full_run: "true", full_fast: "false", full_browser: "true", full_shards: '["1/1"]', full_selection: JSON.stringify(selection), ...outputs } });
  const targeted = { plan: plan(), ci: { result: "success" }, "full-fast": { result: "skipped" }, "full-browser": { result: "success" } };
  assert.doesNotThrow(() => gateFullResults(targeted, { event: "pull_request", log() {} }));
  assert.throws(() => gateFullResults({ ...targeted, ci: { result: "failure" } }, { event: "pull_request", log() {} }), /PR lane/);
  assert.throws(() => gateFullResults({ ...targeted, "full-fast": { result: "success" } }, { event: "pull_request", log() {} }), /full-fast: expected skipped/);
  assert.throws(() => gateFullResults({ ...targeted, "full-browser": { result: "skipped" } }, { event: "pull_request", log() {} }), /full-browser: expected success/);
  assert.throws(() => gateFullResults({ ...targeted, "full-browser": { result: "cancelled" } }, { event: "pull_request", log() {} }), /full-browser: expected success, got cancelled/);
  assert.throws(() => gateFullResults({ ...targeted, ci: { result: "cancelled" } }, { event: "pull_request", log() {} }), /PR lane/);
  const nothing = { plan: plan({ full_run: "false", full_browser: "false", full_selection: '{"mode":"none","ids":[],"screens":[]}' }),
    ci: { result: "success" }, "full-fast": { result: "skipped" }, "full-browser": { result: "skipped" } };
  assert.doesNotThrow(() => gateFullResults(nothing, { event: "pull_request", log() {} }));
  assert.throws(() => gateFullResults(targeted, { event: "push", log() {} }), /complete/, "main and nightly never accept a narrowed lane");
  const complete = { plan: plan({ full_fast: "true", full_shards: JSON.stringify(shardMatrix(FULL_SHARDS)), full_selection: '{"mode":"all","ids":null,"screens":null}' }), ci: { result: "failure" },
    "full-fast": { result: "success" }, "full-browser": { result: "success" } };
  assert.doesNotThrow(() => gateFullResults(complete, { event: "push", log() {} }), "a red PR lane on main still lets the full lane report");
  assert.throws(() => gateFullResults({ ...complete, plan: { result: "failure" } }, { event: "push", log() {} }), /plan job/);
});

test("targeted UI-system reports merge against the selected states without the catalog-wide rule", () => {
  const inventory = { components: [{ id: "a", selector: ".a" }, { id: "b", selector: ".b" }], exceptions: [] };
  const real = loadManifest();
  const screens = ["workout/focus", "workout/rest-running"];
  const selection = { mode: "selected", ids: [], screens };
  const sweeps = fullLaneEntries(selection).filter(({ suite }) => suite.file === "tools/check-ui-system.mjs");
  const keys = real.screens.filter((screen) => screens.includes(`${screen.flow}/${screen.id}`)).flatMap((screen) => real.themes.flatMap((theme) =>
    Object.keys(real.locales).map((locale) => captureKey({ flow: screen.flow, screen: screen.id, viewport: "phone-390", theme, locale, text: "normal", motion: "normal" }))));
  const reports = sweeps.map(({ suite }) => {
    const shard = parseShard(suite.args[1]);
    const captureKeys = shardCaptures(keys, shard);
    return { schemaVersion: 2, shard, screens: captureKeys.length, captureKeys, matched: ["a"], matchedExceptions: [], problems: 0 };
  });
  const dir = mkdtempSync(join(tmpdir(), "taurifer-targeted-ui-"));
  try {
    reports.forEach((report, index) => { mkdirSync(join(dir, `full-shard-${index}-1`, "x"), { recursive: true });
      writeFileSync(join(dir, `full-shard-${index}-1`, "x", "ui-system-shard.json"), JSON.stringify(report)); });
    // The synthetic inventory fails the real catalog's metadata rules; only the merge's own verdict matters here.
    const mergeProblems = (problems) => problems.filter((p) => /never rendered|duplicates capture key|reported \d+ time|expected \d+ reports|catalog states, expected|capture keys do not match|reported role problems/.test(p));
    const merged = mergeFullUiSystemReports(dir, { inventory, manifest: real, selection });
    assert.equal(merged.shards, sweeps.length);
    assert.deepEqual(mergeProblems(merged.problems), [], "selector b is not required in a targeted sweep");
    const complete = mergeFullUiSystemReports(dir, { inventory, manifest: real });
    assert.ok(mergeProblems(complete.problems).length, "the same reports cannot pass as the complete sweep");
    const short = mergeFullUiSystemReports(dir, { inventory, manifest: real, selection: { ...selection, screens: [...screens, "workout/why-manual"] } });
    assert.ok(mergeProblems(short.problems).length, "a targeted sweep must render every selected state");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CI-captured frames are published with a manifest and placed only onto registered catalog paths", (t) => {
  const real = loadManifest();
  const dir = scratch(t);
  const [capture] = expandCaptures(real).filter((value) => value.flow === "workout");
  const relativePath = relative(process.cwd(), capturePath(real, capture)).replaceAll("\\", "/");
  const rendered = join(dir, "rendered.png");
  writeFileSync(rendered, "new-pixels");
  const published = join(dir, "published");
  recordCiCaptures({ dir: published, producer: "verify-1-6", source: "a".repeat(40),
    frames: [{ path: relativePath, file: rendered, state: `${capture.flow}/${capture.screen}`, reasons: ["pixels differ"] }] });
  assert.equal(recordCiCaptures({ dir: undefined, producer: "x", source: "a".repeat(40), frames: [] }), null, "local runs publish nothing");
  const changes = JSON.parse(readFileSync(join(published, "changes-verify-1-6.json"), "utf8"));
  assert.deepEqual(changes.frames.map((frame) => frame.path), [relativePath]);
  const download = join(dir, "download");
  cpSync(published, join(download, "ci-captures-full-browser-0-1"), { recursive: true });
  const target = join(dir, "repo");
  const placed = placeCiCaptures({ downloadRoot: download, targetRoot: target, manifest: real, expectedSource: "a".repeat(40) });
  assert.deepEqual(placed.written, [relativePath]);
  assert.deepEqual(placed.states, [`${capture.flow}/${capture.screen}`]);
  assert.equal(readFileSync(join(target, relativePath), "utf8"), "new-pixels");
  assert.throws(() => placeCiCaptures({ downloadRoot: download, targetRoot: target, manifest: real, expectedSource: "b".repeat(40) }), /source/,
    "frames rendered from another commit are refused");
  const forged = join(dir, "forged");
  mkdirSync(join(forged, "ci-captures-x", "frames"), { recursive: true });
  writeFileSync(join(forged, "ci-captures-x", "frames", "app.js"), "x");
  writeFileSync(join(forged, "ci-captures-x", "changes-x.json"), JSON.stringify({ schemaVersion: 1, kind: "ci-captures", source: "a".repeat(40), producer: "x",
    frames: [{ path: "app.js", state: "workout/focus", reasons: [] }] }));
  assert.throws(() => placeCiCaptures({ downloadRoot: forged, targetRoot: target, manifest: real, expectedSource: "a".repeat(40) }), /registered catalog/);
});

test("verify publishes the changed frames it rendered when CI asks for captures", (t) => {
  const real = loadManifest();
  const dir = scratch(t);
  const stagingRoot = join(dir, "staging");
  const committedRoot = join(process.cwd(), real.artifactRoot);
  for (const capture of expandCaptures(real)) {
    const target = capturePath(real, capture, stagingRoot);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(capturePath(real, capture, committedRoot), target);
  }
  const [victim] = expandCaptures(real).filter((capture) => capture.flow === "workout");
  const [impostor] = expandCaptures(real).filter((capture) => capture.flow === "progress" && capture.viewport === victim.viewport
    && capture.theme === victim.theme && capture.locale === victim.locale && capture.text === victim.text);
  const victimPath = capturePath(real, victim, stagingRoot);
  rmSync(victimPath);
  cpSync(capturePath(real, impostor, committedRoot), victimPath);
  const semantic = JSON.parse(readFileSync(join(process.cwd(), "docs/ui-screens/entry-semantics.json"), "utf8"));
  const captures = join(dir, "captures");
  assert.equal(verifyCatalog({ stagingRoot, semanticArtifact: semantic, artifactDir: join(dir, "artifacts"), manifest: real,
    captures: { dir: captures, producer: "verify-test", source: "c".repeat(40) } }), false);
  const changes = JSON.parse(readFileSync(join(captures, "changes-verify-test.json"), "utf8"));
  const repoPath = `${real.artifactRoot}/${relative(stagingRoot, victimPath).replaceAll("\\", "/")}`;
  assert.deepEqual(changes.frames.map((frame) => frame.path), [repoPath]);
  assert.deepEqual(readFileSync(join(captures, "frames", repoPath)), readFileSync(capturePath(real, impostor, committedRoot)));
});


const AREA_CASES = [
  // [area, file, line that starts with, flows that must be verified, flows that must not]
  ["Today", "app.js", "function renderToday(", ["today"], ["progress", "settings", "install", "library", "onboarding-start"]],
  ["Today", "styles.css", ".today-session{", ["today"], ["workout", "progress", "history", "settings"]],
  ["History", "app.js", "function historySessionOutcome(", ["history"], ["today", "workout", "settings", "onboarding-start"]],
  ["History", "styles.css", "/* ---- History session page", ["history"], ["today", "progress", "settings"]],
  ["Progress", "app.js", "function renderStrengthDash(", ["progress"], ["today", "workout", "history", "settings"]],
  ["Progress", "styles.css", "/* ---- Progress: the exercise chart", ["progress"], ["today", "workout", "history", "settings"]],
  ["Program", "app.js", "function renderProgramOverview(", ["program"], ["today", "workout", "progress", "onboarding-start"]],
  ["Program", "styles.css", "/* ---- Program overview as a ledger", ["program"], ["today", "workout", "progress", "settings"]],
  ["Editor", "app.js", "function enterProgramEditorSheet(", ["program", "onboarding-build"], ["today", "workout", "progress", "settings"]],
  ["Onboarding", "app.js", "function renderOnboarding(", ["onboarding-start", "onboarding-recommend", "program"], ["today", "workout", "progress", "settings"]],
  ["Onboarding", "styles.css", "/* ---- Plan 064 R4b: Recommend", ["onboarding-recommend"], ["today", "workout", "progress", "settings"]],
  ["Landing", "app.js", "function renderFirstRunInstall(", ["onboarding-start", "install"], ["today", "workout", "progress"]],
  ["Settings", "app.js", "function renderSettings(", ["settings"], ["today", "workout", "progress", "onboarding-start"]],
  ["Settings", "styles.css", "/* ---- Cards (rare", ["settings"], ["today", "workout", "progress", "onboarding-start"]],
  ["Summary", "app.js", "function renderSessionSummary(", ["session", "today"], ["progress", "settings", "onboarding-start"]],
  ["Library", "app.js", "function renderLibrary(", ["library", "program"], ["today", "progress", "settings"]],
];

test("each annotated app.js and styles.css area narrows the full lane to its own flows", () => {
  for (const [area, file, startsWith, must, mustNot] of AREA_CASES) {
    const selection = selectFullLane([file], { patches: { [file]: hunkAt(realLine(file, startsWith)) } });
    const label = `${area} (${file}: ${startsWith})`;
    assert.equal(selection.mode, "selected", `${label}: ${selection.reasons.join(" ")}`);
    const flows = flowsOf(selection);
    for (const flow of must) assert.ok(flows.includes(flow), `${label} verifies ${flow}`);
    for (const flow of mustNot) assert.equal(flows.includes(flow), false, `${label} leaves ${flow} alone`);
    assert.ok(fullLaneEntries(selection).length < Object.values(FULL_SUITES).flat().length, `${label} runs less than the complete lane`);
  }
});

test("shared, durable and core app.js lines between the areas still run the complete lane", () => {
  for (const startsWith of ["function render(){", "async function commitProgramEditorProposal(", "const SETUP_DRAFT_KEY", "function detectPRs(",
    "async function activateEntryPreview(", "async function commitSharedSetup(", "function summaries(", "function setFieldVals(", "function interpretedProfile(",
    "async function commitImportReview(", "const sameDefinition="]) {
    assert.equal(selectFullLane(["app.js"], { patches: { "app.js": hunkAt(realLine("app.js", startsWith)) } }).mode, "all", startsWith);
  }
  assert.equal(selectFullLane(["styles.css"], { patches: { "styles.css": hunkAt(realLine("styles.css", ".btn--cta.btn--noarrow:disabled")) } }).mode, "all",
    "a shared button rule inside the entry block stays global");
});

// ------------------------------------------------ deterministic failures and one-round visuals

test("a failure its suite marks deterministic is not replayed; any other browser failure still is", async (t) => {
  const cwd = scratch(t);
  writeFileSync(join(cwd, "frames.mjs"), [
    'import { markDeterministicFailure } from ' + JSON.stringify(join(process.cwd(), "tools/ci-captures.mjs")) + ";",
    'if (process.env.REPFORGE_TRACE === "1") { process.exitCode = 0; } else { markDeterministicFailure("catalog frames differ"); process.exitCode = 1; }',
  ].join("\n"));
  writeFileSync(join(cwd, "flips.mjs"), 'process.exitCode = process.env.REPFORGE_TRACE === "1" ? 0 : 9;\n');
  const report = await runLane("fixture", [{ file: "frames.mjs", args: [] }, { file: "flips.mjs", args: [] }], {
    cwd, outputDir: join(cwd, "results"), env: { ...process.env, REPFORGE_TRACE: "0" }, browser: true,
    diagnosticReplay: true, summaryPath: join(cwd, "summary.md"), source: { head: "fixture-clean-head", dirty: false },
  });
  assert.equal(report.results[0].status, "failed");
  assert.equal(report.results[0].diagnostic, undefined, "a deterministic mismatch is not replayed");
  assert.equal(report.results[0].deterministicFailure, "catalog frames differ");
  assert.notEqual(report.results[0].suspectedFlake, true);
  assert.ok(report.results[1].diagnostic, "an unmarked failure keeps its diagnostic replay");
  assert.equal(report.results[1].suspectedFlake, true);
  assert.match(readFileSync(join(cwd, "summary.md"), "utf8"), /deterministic/);
  assert.equal(markDeterministicFailure("x", { dir: null }), null, "nothing is written without an artifact directory");
});

test("only pure frame, semantic and role findings count as deterministic", () => {
  const frame = { key: "a", status: "failed", pixelComparison: false, semanticComparison: true, problems: ["changed-cell ratio 5% exceeds 4.5%"], frameProblems: 1 };
  const passed = { key: "b", status: "passed", pixelComparison: true, semanticComparison: true, problems: [], frameProblems: 0 };
  assert.match(deterministicCriticalFailure([frame, passed]), /1 critical frame/);
  assert.equal(deterministicCriticalFailure([passed]), null);
  assert.equal(deterministicCriticalFailure([{ ...frame, problems: [...frame.problems, "TimeoutError: waiting for #x"] }]), null, "a scenario error keeps the replay");
  assert.equal(deterministicCriticalFailure([{ ...frame, problems: [...frame.problems, "x: has no inventory role"] }]), null, "a live role finding in the PR matrix keeps the replay");
  assert.match(deterministicAuditFailure(["workout/focus [en/light]: .x contrast 3.1 below 4.5"]), /role/);
  assert.equal(deterministicAuditFailure(["workout/focus: scenario failed: Timeout 5000ms exceeded"]), null);
  assert.equal(deterministicAuditFailure([]), null);
});

test("verify marks a catalog mismatch deterministic", (t) => {
  const real = loadManifest();
  const dir = scratch(t);
  const stagingRoot = join(dir, "staging");
  const committedRoot = join(process.cwd(), real.artifactRoot);
  for (const capture of expandCaptures(real)) {
    const target = capturePath(real, capture, stagingRoot);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(capturePath(real, capture, committedRoot), target);
  }
  const semantic = JSON.parse(readFileSync(join(process.cwd(), "docs/ui-screens/entry-semantics.json"), "utf8"));
  const artifactDir = join(dir, "artifacts");
  assert.equal(verifyCatalog({ stagingRoot, semanticArtifact: semantic, artifactDir, manifest: real }), true);
  assert.equal(existsSync(join(artifactDir, "deterministic-failure.json")), false);
  const [victim] = expandCaptures(real).filter((capture) => capture.flow === "workout");
  const [impostor] = expandCaptures(real).filter((capture) => capture.flow === "progress" && capture.viewport === victim.viewport
    && capture.theme === victim.theme && capture.locale === victim.locale && capture.text === victim.text);
  rmSync(capturePath(real, victim, stagingRoot));
  cpSync(capturePath(real, impostor, committedRoot), capturePath(real, victim, stagingRoot));
  assert.equal(verifyCatalog({ stagingRoot, semanticArtifact: semantic, artifactDir, manifest: real }), false);
  assert.match(JSON.parse(readFileSync(join(artifactDir, "deterministic-failure.json"), "utf8")).reason, /1 catalog frame/);
});

test("a PR lane red only on deterministic critical frames is visual-only", (t) => {
  const root = scratch(t);
  const write = (job, rows) => {
    mkdirSync(join(root, `shard-${job}-1`, "workout"), { recursive: true });
    writeFileSync(join(root, `shard-${job}-1`, "workout", "results.json"), JSON.stringify({ lane: "workout", results: rows }));
  };
  const ok = (id) => ({ id, command: ["node", id], status: "passed" });
  write(0, [ok("test/native-feel.mjs")]);
  write(1, [{ id: "test-ui-system-mjs", command: ["node", "test/ui-system.mjs"], status: "failed", deterministicFailure: "2 critical frame(s) differ" }]);
  const needs = { plan: { result: "success", outputs: { run: "true" } }, fast: { result: "success" }, service: { result: "success" }, browser: { result: "failure" } };
  assert.equal(classifyVisualOnly(needs, root), true);
  assert.equal(classifyVisualOnly({ ...needs, fast: { result: "failure" } }, root), false, "a red fast lane is not a visual change");
  assert.equal(classifyVisualOnly({ ...needs, browser: { result: "success" } }, root), false, "a green PR lane needs no capture run");
  write(2, [{ id: "test-persistence-mjs", command: ["node", "test/persistence.mjs"], status: "failed" }]);
  assert.equal(classifyVisualOnly(needs, root), false, "any behavioural failure keeps the normal path");
  rmSync(join(root, "shard-2-1"), { recursive: true });
  write(1, [{ id: "test-ui-system-mjs", command: ["node", "test/ui-system.mjs"], status: "failed" }]);
  assert.equal(classifyVisualOnly(needs, root), false, "an unmarked ui-system failure is not visual-only");
});

test("a visual-only PR lane runs the targeted verify stripes so one fetch takes every affected frame", () => {
  const real = loadManifest();
  const screens = real.screens.filter((screen) => screen.flow === "workout").map((screen) => `${screen.flow}/${screen.id}`);
  const selection = { mode: "selected", ids: [], screens };
  const outputs = planOutputs({ run: true, reason: "x", full: selection });
  const verify = fullLaneEntries(selection).filter(({ suite }) => suite.file === "tools/capture-ui-screens.mjs");
  assert.deepEqual(JSON.parse(outputs.capture_shards), shardMatrix(verify.length));
  const planned = JSON.parse(outputs.capture_shards).map((shard) => shardPlan(parseShard(shard), FULL_SUITES, selection, { only: "tools/capture-ui-screens.mjs" }).entries);
  assert.deepEqual(planned.flat().map(({ suite }) => suiteId(suite)).sort(), verify.map(({ suite }) => suiteId(suite)).sort(), "each capture runner verifies one stripe");
  const complete = planOutputs({ run: true, reason: "x", full: { mode: "all", ids: null, screens: null } });
  assert.deepEqual(JSON.parse(complete.capture_shards), shardMatrix(VISUAL_SHARDS));
  const none = planOutputs({ run: true, reason: "x", full: { mode: "none", ids: [], screens: [] } });
  assert.deepEqual(JSON.parse(none.capture_shards), []);
  const fullShards = JSON.stringify(shardMatrix(1));
  const sel = JSON.stringify({ mode: "selected", ids: [suiteId(FULL_SUITES["full-browser"].find((suite) => suite.file === "test/history.mjs"))], screens: [] });
  const red = { plan: { result: "success", outputs: { full_run: "true", full_fast: "false", full_browser: "true", full_shards: fullShards, full_selection: sel } },
    ci: { result: "failure", outputs: { visual_only: "true" } }, "full-fast": { result: "skipped" }, "full-browser": { result: "skipped" }, "full-capture": { result: "success" } };
  assert.throws(() => gateFullResults(red, { event: "pull_request", log() {} }), /fetch-ci-captures/, "the gate stays red and says how to take the frames");
});

test("the workflow runs the capture stripes only for a visual-only red PR lane", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const jobsSection = workflow.split(/^jobs:\s*$/m)[1] || "";
  const job = (name) => jobsSection.slice(jobsSection.indexOf(`\n  ${name}:\n`) + 1).split(/\n  (?=[a-z][a-z0-9-]*:\n)/)[0];
  const capture = job("full-capture");
  assert.match(capture, /needs: \[plan, ci\]/);
  assert.ok(capture.includes("if: ${{ !cancelled() && github.event_name == 'pull_request' && needs.ci.outputs.visual_only == 'true' && needs.plan.outputs.capture_shards != '[]' }}"));
  assert.match(capture, /shard: \$\{\{ fromJSON\(needs\.plan\.outputs\.capture_shards\) \}\}/);
  assert.match(capture, /node tools\/run-tests\.mjs full-verify "\$\{\{ matrix\.shard \}\}" --keep-going/);
  assert.match(capture, /REPFORGE_CI_CAPTURES_DIR: \$\{\{ github\.workspace \}\}\/\.ci-captures/);
  const ci = job("ci");
  assert.match(ci, /visual_only: \$\{\{ steps\.visual\.outputs\.visual_only \}\}/);
  assert.ok(ci.indexOf("node tools/ci-plan.mjs visual-only") < ci.indexOf("node tools/ci-plan.mjs gate\n"), "the classification runs before the gate can stop the job");
});

test("every plan or job output the workflow reads is declared and published", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const jobsSection = workflow.split(/^jobs:\s*$/m)[1] || "";
  const job = (name) => jobsSection.slice(jobsSection.indexOf(`\n  ${name}:\n`) + 1).split(/\n  (?=[a-z][a-z0-9-]*:\n)/)[0];
  const declared = (name) => new Set([...(job(name).match(/^    outputs:\n((?:      .+\n)+)/m)?.[1] || "").matchAll(/^      ([a-z_]+):/gm)].map(([, key]) => key));
  for (const [, name, key] of workflow.matchAll(/needs\.([a-z][a-z0-9-]*)\.outputs\.([a-z_]+)/g)) {
    assert.ok(declared(name).has(key), `${name} declares the ${key} output the workflow reads`);
  }
  const published = Object.keys(planOutputs({ run: true, reason: "x", full: { mode: "all", ids: null, screens: null } }));
  assert.deepEqual([...declared("plan")].filter((key) => key !== "reason" && key !== "run" && key !== "shards").sort(),
    published.filter((key) => !["reason", "run", "shards"].includes(key)).sort(), "the plan job maps every output tools/ci-plan.mjs publishes");
});

test("frames rendered by both the critical matrix and a verify stripe resolve to the verify render", (t) => {
  const real = loadManifest();
  const dir = scratch(t);
  const [capture] = expandCaptures(real).filter((value) => value.flow === "workout");
  const path = relative(process.cwd(), capturePath(real, capture)).replaceAll("\\", "/");
  const publish = (artifact, producer, bytes) => {
    const file = join(dir, `${producer}.png`);
    writeFileSync(file, bytes);
    recordCiCaptures({ dir: join(dir, "download", artifact), producer, source: "a".repeat(40), frames: [{ path, file, state: "workout/focus", reasons: [] }] });
  };
  publish("ci-captures-browser-4-1", "critical-ui", "critical-render");
  publish("ci-captures-full-capture-0-1", "verify-1-2", "verify-render");
  const placed = placeCiCaptures({ downloadRoot: join(dir, "download"), targetRoot: join(dir, "repo"), manifest: real, expectedSource: "a".repeat(40) });
  assert.deepEqual(placed.written, [path]);
  assert.equal(readFileSync(join(dir, "repo", path), "utf8"), "verify-render");
  publish("ci-captures-full-capture-1-1", "verify-2-2", "other-render");
  assert.throws(() => placeCiCaptures({ downloadRoot: join(dir, "download"), targetRoot: join(dir, "repo"), manifest: real, expectedSource: "a".repeat(40) }), /different bytes/);
});

// ------------------------------------------------------------- local selection

test("pure service-worker cache revision selects only cache relationship contracts", (t) => {
  const fixture = serviceWorkerFixture(t);
  const context = { cwd: fixture.cwd, base: fixture.base };
  const cache = fixture.source.match(/^const CACHE = "repforge-v(\d+)";$/m);
  assert.ok(cache, "baseline worker has one canonical cache declaration");
  const bumped = fixture.source.replace(cache[0], cache[0].replace(cache[1], String(Number(cache[1]) + 1)));
  fixture.write(bumped);

  const packet = selectPacket(["sw.js"], context);
  const owners = ["test/exercise-library.mjs", "test/sw-upgrade.mjs", "test/vendor-runtimes.mjs"];
  assert.deepEqual(suiteFiles(packet), owners);
  assert.deepEqual(lanes(packet), ["fast", "state"]);
  assert.deepEqual(suiteFiles(selectEdit(["sw.js"], context)), owners);
  assert.match(packet.reasons.join(" "), /cache revision/i);
  assert.equal(selectVisuals(["sw.js"], manifest, context).mode, "none");

  const uiPacket = selectPacket(["styles.css"], context);
  const combined = selectPacket(["styles.css", "sw.js"], context);
  assert.deepEqual(commandKeys(combined), [...new Set([...commandKeys(uiPacket), ...commandKeys(packet)])].sort());
  const uiEdit = selectEdit(["styles.css"], context);
  const combinedEdit = selectEdit(["styles.css", "sw.js"], context);
  const revisionEdit = selectEdit(["sw.js"], context);
  assert.deepEqual(commandKeys(combinedEdit), [...new Set([...commandKeys(uiEdit), ...commandKeys(revisionEdit)])].sort());
  assert.ok(combined.entries.length < allCommands);
});

test("substantive or unprovable service-worker changes retain the full SW owner set", (t) => {
  const fixture = serviceWorkerFixture(t);
  const context = { cwd: fixture.cwd, base: fixture.base };
  const cache = fixture.source.match(/^const CACHE = "repforge-v(\d+)";$/m);
  assert.ok(cache, "baseline worker has one canonical cache declaration");
  const appQuery = fixture.source.match(/"\.\/app\.js\?v=(\d+)"/);
  assert.ok(appQuery, "baseline worker has a protected app.js query revision");
  const substantive = [
    ["release asset expansion", replaceOnce(fixture.source, '"./program-editor.js"', '"./program-editor.js", "./new-shell.js"')],
    ["ASSETS", replaceOnce(fixture.source, '"./styles.css"', '"./styles.css", "./new.css"')],
    ["install behavior", replaceOnce(fixture.source, ".then(() => self.skipWaiting())", ".then(() => self.clients.claim())")],
    ["activate behavior", replaceOnce(fixture.source, ".then(() => self.clients.claim())", ".then(() => self.skipWaiting())")],
    ["fetch behavior", replaceOnce(fixture.source, 'if (event.request.method !== "GET") return;', 'if (event.request.method !== "GET") { event.respondWith(fetch(event.request)); return; }')],
    ["protected runtime query", replaceOnce(fixture.source, appQuery[0], appQuery[0].replace(appQuery[1], String(Number(appQuery[1]) + 1)))],
    ["malformed cache declaration", replaceOnce(fixture.source, cache[0], cache[0].replace(cache[1], "X"))],
    ["cache downgrade", replaceOnce(fixture.source, cache[0], cache[0].replace(cache[1], "120"))],
  ];
  const expectedLanes = ["fast", "state", "workout"];
  for (const [name, next] of substantive) {
    fixture.write(next);
    const plan = selectPacket(["sw.js"], context);
    assert.deepEqual(lanes(plan), expectedLanes, name);
    assert.ok(suiteFiles(plan).includes("test/exercise-library.mjs"), name);
    assert.ok(suiteFiles(plan).includes("test/vendor-runtimes.mjs"), name);
    assert.equal(selectVisuals(["sw.js"], manifest, context).mode, "full", name);
  }
});

test("affected selection is narrow when proven and fail-safe when it is not", () => {
  assert.equal(selectAffected(["docs/ci.md"]).mode, "none");
  assert.equal(selectAffected(["advisor-plans/README.md"]).mode, "none");
  const direct = selectAffected(["test/focus-pending-field.mjs"]);
  assert.equal(direct.mode, "selected");
  assert.ok(direct.entries.some(({ suite }) => suite.file === "test/focus-pending-field.mjs"));
  const runner = selectAffected(["tools/run-tests.mjs"]);
  assert.ok(runner.entries.some(({ suite }) => suite.file === "test/ci.mjs"));
  assert.ok(runner.entries.length < allCommands);
  const workflow = selectAffected([".github/workflows/ci.yml", "tools/ci-plan.mjs"]);
  assert.deepEqual(suiteFiles(workflow), ["test/ci.mjs"]);
  const telemetry = selectAffected(["telemetry.js"]);
  assert.deepEqual(lanes(telemetry), ["fast", "privacy"]);
  const telemetryFixture = selectAffected(["test/fixtures/telemetry.mjs"]);
  assert.equal(telemetryFixture.mode, "selected");
  assert.deepEqual(suiteFiles(telemetryFixture), ["test/telemetry-leakage.mjs", "test/telemetry-unit.mjs"]);
  const generativeProperty = selectAffected(["test/generative/properties/malformed-inputs.mjs"]);
  assert.equal(generativeProperty.mode, "selected");
  assert.deepEqual(suiteFiles(generativeProperty), ["test/generative/run.mjs", "test/generative/self-test.mjs"]);
  const captureScenario = selectAffected(["tools/ui-screens/screens-app.mjs"]);
  assert.equal(captureScenario.mode, "selected");
  assert.ok(suiteFiles(captureScenario).includes("test/ui-system.mjs"), "capture scenarios select the fresh representative checker");
  assert.ok(suiteFiles(captureScenario).every(file => existsSync(join(process.cwd(), file))));
  const captureTool = selectAffected(["tools/compare-ui-screens.mjs"]);
  assert.ok(suiteFiles(captureTool).includes("test/ui-screens.mjs"));
  assert.ok(suiteFiles(captureTool).includes("test/ui-system.mjs"), "the representative checker depends on the comparison it runs");
  const manifestInput = selectAffected(["docs/ui-screens/manifest.json"]);
  assert.equal(manifestInput.mode, "selected");
  assert.deepEqual(suiteFiles(manifestInput), ["test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"]);
  const baselineInput = selectAffected(["docs/ui-screens/screens/app/today__phone-390-light-en.png"]);
  assert.equal(baselineInput.mode, "selected");
  assert.deepEqual(suiteFiles(baselineInput), ["test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"]);
  const semanticInput = selectAffected(["docs/ui-screens/entry-semantics.json"]);
  assert.equal(semanticInput.mode, "selected");
  assert.deepEqual(suiteFiles(semanticInput), ["test/ui-screens.mjs", "test/ui-system.mjs"]);
  const roleInventory = selectAffected(["tools/ui-role-inventory.json"]);
  assert.equal(roleInventory.mode, "selected");
  assert.deepEqual(suiteFiles(roleInventory), ["test/ui-system-checker.mjs", "test/ui-system.mjs"]);
  const fullOnly = selectAffected(["test/simulation.mjs"]);
  assert.deepEqual(suiteFiles(fullOnly), ["test/simulation.mjs"], "a directly changed full-lane suite selects itself");
  assert.equal(fullOnly.mode, "selected");
  const fullTool = selectAffected(["tools/check-direction-d.mjs"]);
  assert.deepEqual(suiteFiles(fullTool), ["test/direction-d-gate.mjs", "test/rules-only-gate.mjs"],
    "a tool only full-lane suites import selects them instead of widening to everything");
  const app = selectAffected(["app.js"]);
  assert.equal(app.entries.length, allCommands - SUITES.service.length, "application changes select every retained application proof");
  const service = selectAffected(["services/install-transfer/src/index.js"]);
  assert.deepEqual(lanes(service), ["service"]);
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

// --------------------------------------------------------------------- runner

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

test("standalone artifact preview preserves shipped bytes without app preparation", async (t) => {
  const cwd = scratch(t);
  const index = Buffer.from('<!doctype html><title>Standalone packaged lab</title>\n');
  writeFileSync(join(cwd, "index.html"), index);
  const child = { pid: 4322, once() { return this; } };
  const preview = await maybeStartLocalPreview([{ lane: "entry" }], {
    cwd, prepareApp: false,
    env: { ...process.env, REPFORGE_URL: "" },
    signalSource: new EventEmitter(),
    execFileSyncImpl: () => { throw new Error("Artifact preview must not generate application config"); },
    fetchImpl: async url => ({ ok: true, text: async () => readFileSync(join(cwd, new URL(url).pathname), "utf8") }),
    spawnImpl: () => child, killGroup: () => {}, allocatePort: async () => 29342,
    identityToken: "fixture-artifact-token",
  });
  assert.equal(preview.env.REPFORGE_URL, "http://127.0.0.1:29342/");
  assert.deepEqual(readFileSync(join(cwd, "index.html")), index);
  assert.equal(existsSync(join(cwd, "posthog-config.js")), false);
  preview.cleanup();
  assert.deepEqual(readFileSync(join(cwd, "index.html")), index);
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
    source: { head: "fixture-clean-head", dirty: false },
  });
  assert.equal(report.failed, 1); assert.equal(report.notRun, 0);
  assert.equal(report.results[0].initial.exitCode, 9); assert.equal(report.results[0].diagnostic.exitCode, 0);
  assert.equal(report.results[0].status, "failed");
  assert.equal(report.results[0].suspectedFlake, true);
  const evidence = JSON.parse(readFileSync(join(cwd, "results", "flips-mjs", "evidence.json"), "utf8"));
  assert.equal(evidence.kind, "browser-contract-execution");
  assert.equal(evidence.result, "failed");
  assert.match(evidence.outputSha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(evidence.command, ["node", "flips.mjs"]);
  assert.deepEqual(evidence.source, { head: "fixture-clean-head", dirty: false });
  assert.equal(evidence.rerun, "node flips.mjs");
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
