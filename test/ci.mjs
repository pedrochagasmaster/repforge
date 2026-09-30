import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { BROWSER_LANES, CI_SHARDS, SUITES, SUPPORT, UI_SYSTEM_SHARDS, VISUAL_SHARDS, browserEntries, commandArgs, inventoryErrors, parseShard, shardSuites, suiteId, suiteSeconds } from "./suites.mjs";
import { changedFiles, selectVisuals } from "../tools/ci-selection.mjs";
import { classifyChange, gateResults, pullRequestFiles, resolvePlan, shardMatrix } from "../tools/ci-plan.mjs";
import { findShardReports, mergeShardReports, shardCaptures } from "../tools/ui-system-core.mjs";
import { mergeUiSystemReports } from "../tools/ci-plan.mjs";
import { selectCaptures, verifyCatalog } from "../tools/capture-ui-screens.mjs";
import { capturePath, expandCaptures, loadManifest } from "../tools/ui-screens/manifest.mjs";
import { domainsForAppDiff } from "../tools/visual-domains.mjs";
import { stabilizeShareUrlForCapture } from "../tools/ui-screens/screens-app.mjs";
import { changedFilesForTests, changedFilesForEdit, changedFilesForPacket, selectAffected, selectEdit, selectPacket } from "../tools/test-selection.mjs";
import { execute, maybeStartLocalPreview, runLane, shardPlan } from "../tools/run-tests.mjs";

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
  const files = [...new Set(Object.values(SUITES).flat().map((s) => s.file))];
  files.push(...Object.keys(SUPPORT).filter((f) => !f.endsWith("/")));
  assert.deepEqual(inventoryErrors(files), []);
  assert.match(inventoryErrors([...files, "test/forgotten.mjs"]).join("\n"), /Unclassified/);
  assert.match(inventoryErrors(files.filter((f) => f !== "test/shared-setup-unit.mjs")).join("\n"), /Missing suite/);
  assert.match(inventoryErrors(files, { ...SUITES, duplicate: [SUITES.fast[0]] }).join("\n"), /Duplicate command/);
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

test("the two catalog sweeps are split into inventory commands whose shards cover every render once", () => {
  const uiSystem = SUITES.workout.filter((suite) => suite.file === "tools/check-ui-system.mjs");
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

  assert.equal(SUITES.visual.length, VISUAL_SHARDS);
  const frames = expandCaptures(loadManifest());
  const captured = SUITES.visual.map((suite) => selectCaptures({ shard: parseShard(suite.args[2]) }));
  assert.equal(captured.flat().length, frames.length);
  assert.equal(new Set(captured.flat().map((c) => JSON.stringify(c))).size, frames.length);
  assert.ok(Math.max(...captured.map((c) => c.length)) - Math.min(...captured.map((c) => c.length)) <= 1);
  assert.ok(captured.every((part) => part.length > 0), "no visual shard is empty for the committed frame catalog");
  assert.equal(selectCaptures({}).length, frames.length);
});

test("UI-system shard reports merge into the catalog-wide never-rendered rule", (t) => {
  const inventory = {
    components: [{ id: "a", selector: ".a" }, { id: "b", selector: ".b", sourceOnly: true }, { id: "c", selector: ".c" }],
    exceptions: [{ selector: ".x" }, { selector: ".y", sourceOnlyReason: "documented" }],
  };
  const one = { schemaVersion: 1, shard: { index: 1, count: 2 }, screens: 3, matched: ["a"], matchedExceptions: [".x"], problems: 0 };
  const two = { schemaVersion: 1, shard: { index: 2, count: 2 }, screens: 2, matched: ["c"], matchedExceptions: [], problems: 0 };
  const expected = { expectedShardCount: 2, expectedScreenCount: 5 };
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
  assert.match(mergeShardReports([{ ...one, schemaVersion: 2 }, two], inventory, expected).problems.join("\n"), /unsupported schemaVersion/);
  assert.match(mergeShardReports([one, { ...two, screens: 1 }], inventory, expected).problems.join("\n"), /rendered 4 catalog states, expected 5/);
  assert.match(mergeShardReports([one, { ...two, matched: "c" }], inventory, expected).problems.join("\n"), /matched must be an array/);
  const root = scratch(t);
  const realManifest = loadManifest();
  const expectedScreens = realManifest.screens.length * 2 * Object.keys(realManifest.locales).length;
  const perShard = Array.from({ length: UI_SYSTEM_SHARDS }, (_, index) => ({
    schemaVersion: 1,
    shard: { index: index + 1, count: UI_SYSTEM_SHARDS },
    screens: Math.floor((expectedScreens + UI_SYSTEM_SHARDS - index - 1) / UI_SYSTEM_SHARDS),
    matched: index === 0 ? ["a"] : index === 1 ? ["c"] : [],
    matchedExceptions: index === 0 ? [".x"] : [],
    problems: 0,
  }));
  for (const [index, report] of perShard.entries()) {
    const name = `shard-${index}/workout/x-${index}/initial`;
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "ui-system-shard.json"), JSON.stringify(report));
    writeFileSync(join(root, name, "output.log"), "noise");
  }
  assert.equal(findShardReports(root).length, UI_SYSTEM_SHARDS);
  assert.deepEqual(findShardReports(join(root, "missing")), []);
  const gateMerge = mergeUiSystemReports(root, { inventory, manifest: realManifest });
  assert.equal(gateMerge.shards, UI_SYSTEM_SHARDS, "the gate requires the complete declared sweep");
  assert.equal(gateMerge.problems.some((p) => /never rendered/.test(p)), false);
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

test("CI runs everything unless a change is provably prose-only", () => {
  assert.equal(classifyChange(null).run, true);
  assert.equal(classifyChange([]).run, true);
  assert.equal(classifyChange(["README.md", "docs/backlog.md", "plans/062.md", ".gitignore", "LICENSE", "docs/ui-screens/README.md"]).run, false);
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

test("pull-request file lists come from the compare API and fail safe when it cannot answer", async (t) => {
  const pages = [
    { files: Array.from({ length: 100 }, (_, i) => ({ filename: `src/${i}.js`, ...(i === 3 ? { previous_filename: "src/old.js" } : {}) })) },
    { files: [{ filename: "docs/a.md" }, { filename: "app.js" }] },
  ];
  const urls = [];
  const fetchImpl = async (url) => { urls.push(url); const page = Number(new URL(url).searchParams.get("page")); return { ok: true, json: async () => pages[page - 1] }; };
  const files = await pullRequestFiles({ apiUrl: "https://api.example", repository: "o/r", base: "b".repeat(40), head: "h".repeat(40), token: "t", fetchImpl });
  assert.equal(files.length, 103);
  assert.ok(files.includes("src/old.js") && files.includes("app.js"));
  assert.equal(urls.length, 2);
  assert.match(urls[0], /\/repos\/o\/r\/compare\/b{40}\.\.\.h{40}\?per_page=100&page=1$/);
  const huge = async () => ({ ok: true, json: async () => ({ files: Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}` })) }) });
  assert.equal(await pullRequestFiles({ apiUrl: "x", repository: "o/r", base: "b", head: "h", fetchImpl: huge }), null, "a capped list is not knowable");
  await assert.rejects(pullRequestFiles({ apiUrl: "x", repository: "o/r", base: "b", head: "h", fetchImpl: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);

  const dir = scratch(t);
  const eventPath = join(dir, "event.json");
  writeFileSync(eventPath, JSON.stringify({ pull_request: { base: { sha: "b".repeat(40) }, head: { sha: "h".repeat(40) } } }));
  const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: eventPath, GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: "https://api.example" };
  const prose = await resolvePlan(env, { fetchImpl: async () => ({ ok: true, json: async () => ({ files: [{ filename: "docs/a.md" }] }) }) });
  assert.equal(prose.run, false);
  assert.equal(prose.head, "h".repeat(40));
  const code = await resolvePlan(env, { fetchImpl: async () => ({ ok: true, json: async () => ({ files: [{ filename: "app.js" }] }) }) });
  assert.equal(code.run, true);
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
  const selected = { plan: { result: "success", outputs: { run: "true" } }, fast: { result: "success" }, browser: { result: "success" }, service: { result: "success" } };
  assert.doesNotThrow(() => gateResults(selected, { log() {} }));
  assert.throws(() => gateResults({ ...selected, browser: { result: "failure" } }, { log() {} }), /browser: expected success, got failure/);
  assert.throws(() => gateResults({ ...selected, service: { result: "skipped" } }, { log() {} }), /service: expected success, got skipped/);
  const prose = { plan: { result: "success", outputs: { run: "false", reason: "Only prose changed" } }, fast: { result: "skipped" }, browser: { result: "skipped" }, service: { result: "skipped" } };
  assert.doesNotThrow(() => gateResults(prose, { log() {} }));
  assert.throws(() => gateResults({ ...prose, fast: { result: "success" } }, { log() {} }), /fast: expected skipped, got success/);
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
});

test("the workflow is one sharded matrix behind one aggregate check", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /shard: \$\{\{ fromJSON\(needs\.plan\.outputs\.shards\) \}\}/, "the shard list comes from the inventory, not the YAML");
  assert.match(workflow, /node tools\/run-tests\.mjs shard "\$\{\{ matrix\.shard \}\}" --keep-going/);
  assert.match(workflow, /node tools\/ci-plan\.mjs gate/);
  assert.match(workflow, /node tools\/ci-plan\.mjs merge-ui-system/);
  assert.match(workflow, /needs: \[plan, fast, browser, service\]\n\s+if: always\(\)/, "the gate observes every job");
  const jobsSection = workflow.split(/^jobs:\s*$/m)[1] || "";
  const declaredJobs = [...jobsSection.matchAll(/^  ([a-z][a-z0-9-]*):$/gm)].map(([, name]) => name);
  const aggregateNeeds = jobsSection.match(/^    needs: \[([^\]]+)\]$/m)?.[1].split(",").map((name) => name.trim()) || [];
  assert.deepEqual(aggregateNeeds.sort(), declaredJobs.filter((name) => name !== "ci").sort(),
    "the aggregate waits for every workflow job, including any newly added verification lane");
  assert.equal((workflow.match(/if: needs\.plan\.outputs\.run == 'true'/g) || []).length >= 3, true, "test jobs obey the plan");
  assert.match(workflow, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/);
  assert.doesNotMatch(workflow, /expected_sha|simulation-feedback|candidate/, "there is one mode");
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

test("app.js hunks after the reviewed History block widen instead of inheriting History", () => {
  const source = readFileSync(join(process.cwd(), "app.js"), "utf8");
  for (const marker of ["function exerciseSessionsDetail", "function renderProgramOverview", "function renderCatalogueStep", "function init()"]){
    const line = source.split("\n").findIndex((value) => value.startsWith(marker)) + 1;
    assert.ok(line > 0, `production app contains ${marker}`);
    const diff = `@@ -${line} +${line} @@\n-old\n+new\n`;
    assert.deepEqual([...domainsForAppDiff(source, diff)], ["global"], marker);
    assert.equal(selectVisuals(["app.js"], manifest, { appSource: source, appDiff: diff }).mode, "full", marker);
  }
});

test("baseline-only selection recaptures whole screens, never isolated variants", () => {
  const plan = selectVisuals(["docs/ui-screens/screens/app/today__phone-390-light-en.png", "docs/ui-screens/README.md"], manifest);
  assert.equal(plan.mode, "screens");
  assert.deepEqual(plan.screens, ["app/today"]);
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/unknown__phone.png"], manifest).mode, "full");
  assert.equal(selectVisuals(["docs/ui-screens/screens/app/today__phone.png", "styles.css"], manifest).mode, "full");
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
  const direct = selectAffected(["test/accessibility.mjs"]);
  assert.equal(direct.mode, "selected");
  assert.ok(direct.entries.some(({ suite }) => suite.file === "test/accessibility.mjs"));
  const runner = selectAffected(["tools/run-tests.mjs"]);
  assert.ok(runner.entries.some(({ suite }) => suite.file === "test/ci.mjs"));
  assert.ok(runner.entries.length < allCommands);
  const workflow = selectAffected([".github/workflows/ci.yml", "tools/ci-plan.mjs"]);
  assert.deepEqual(suiteFiles(workflow), ["test/ci.mjs"]);
  const telemetry = selectAffected(["telemetry.js"]);
  assert.deepEqual(lanes(telemetry), ["fast", "privacy"]);
  const telemetryFixture = selectAffected(["test/fixtures/telemetry.mjs"]);
  assert.equal(telemetryFixture.mode, "selected");
  assert.deepEqual(suiteFiles(telemetryFixture), ["test/telemetry-leakage.mjs", "test/telemetry-runtime.mjs", "test/telemetry-unit.mjs"]);
  const generativeProperty = selectAffected(["test/generative/properties/malformed-inputs.mjs"]);
  assert.equal(generativeProperty.mode, "selected");
  assert.deepEqual(suiteFiles(generativeProperty), ["test/generative/run.mjs", "test/generative/self-test.mjs"]);
  const progressionFixture = selectAffected(["test/fixtures/progression-strategies-v1.json"]);
  assert.equal(progressionFixture.mode, "selected");
  assert.deepEqual(suiteFiles(progressionFixture), ["test/progression-engine.mjs", "test/progression-fixtures.mjs"]);
  const captureScenario = selectAffected(["tools/ui-screens/screens-app.mjs"]);
  assert.equal(captureScenario.mode, "selected");
  assert.deepEqual(suiteFiles(captureScenario),
    ["test/ci.mjs", "test/ui-catalog-contract.mjs", "test/ui-plan-050-editor.mjs", "test/ui-screens.mjs", "test/ui-system.mjs", "tools/capture-ui-screens.mjs", "tools/check-ui-screens.mjs", "tools/check-ui-system.mjs"]);
  const captureTool = selectAffected(["tools/compare-ui-screens.mjs"]);
  assert.ok(suiteFiles(captureTool).includes("test/ui-screens.mjs"));
  assert.ok(suiteFiles(captureTool).includes("tools/capture-ui-screens.mjs"), "the verify gate depends on the comparison it runs");
  const manifestInput = selectAffected(["docs/ui-screens/manifest.json"]);
  assert.equal(manifestInput.mode, "selected");
  assert.deepEqual(suiteFiles(manifestInput), ["test/ui-catalog-contract.mjs", "test/ui-plan-050-build-hierarchy.mjs", "test/ui-plan-050-editor.mjs", "test/ui-screens.mjs", "tools/check-ui-screens.mjs"]);
  const baselineInput = selectAffected(["docs/ui-screens/screens/app/today__phone-390-light-en.png"]);
  assert.equal(baselineInput.mode, "selected");
  assert.deepEqual(suiteFiles(baselineInput), ["test/ui-screens.mjs", "tools/check-ui-screens.mjs"]);
  const semanticInput = selectAffected(["docs/ui-screens/entry-semantics.json"]);
  assert.equal(semanticInput.mode, "selected");
  assert.deepEqual(suiteFiles(semanticInput), ["test/ui-screens.mjs"]);
  const roleInventory = selectAffected(["tools/ui-role-inventory.json"]);
  assert.equal(roleInventory.mode, "selected");
  assert.deepEqual(suiteFiles(roleInventory), ["test/ui-system.mjs", "tools/check-ui-system.mjs"]);
  const app = selectAffected(["app.js"]);
  assert.equal(app.entries.length, allCommands - SUITES.service.length - SUITES.visual.length, "the visual gate is candidate-tier, not a local owner");
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
