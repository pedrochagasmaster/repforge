#!/usr/bin/env node
/**
 * CI planning for .github/workflows/ci.yml.
 *
 *   node tools/ci-plan.mjs        decide whether this change needs the test
 *                                 matrix and publish the shard list
 *   node tools/ci-plan.mjs gate   fail unless every job the plan selected passed
 *   node tools/ci-plan.mjs merge-ui-system <dir>
 *                                 validate the one ui-critical-report.json under
 *                                 <dir>: the complete critical UI matrix
 *   node tools/ci-plan.mjs gate-full
 *                                 fail unless every ci-full job passed
 *   node tools/ci-plan.mjs merge-ui-system-full <dir>
 *                                 union the ui-system-shard.json reports under
 *                                 <dir> and apply the catalog-wide rules
 *
 * The PR lane's only narrowing is "prose-only changes skip the tests". On a
 * pull request the full lane (ci-full) runs only what the changed files can
 * affect, as decided by selectFullLane in tools/test-selection.mjs from the
 * compare API's file list and patches, and starts only after the PR lane
 * passed. An unknown file, an unmappable diff, an API failure, a push to main,
 * the nightly schedule and a manual run all get the complete full lane.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BROWSER_LANES, CI_SHARDS, FULL_SHARDS, UI_SYSTEM_SHARDS, parseShard } from "../test/suites.mjs";
import { fullLaneEntries, fullShardCount, parseFullSelection, selectFullLane } from "./test-selection.mjs";
import { captureKey, loadManifest } from "./ui-screens/manifest.mjs";
import { findShardReports, loadRoleInventory, mergeShardReports, shardCaptures, validateRoleInventory } from "./ui-system-core.mjs";

const PROSE = /(?:^|\/)(?:[^/]+\.(?:md|txt)|\.gitignore|LICENSE)$/;
const FIXTURE_PATH = /(?:^|\/)(?:fixtures?|__fixtures__)(?:\/|$)/;
// Manual standalone gallery, not shipped in the PWA or imported by tests.
// Unlike docs/ui-screens, these are NOT production verification inputs.
const DESIGN_REFERENCE = /^docs\/design\/native-fidelity-mocks\//;
// These Markdown files are inputs to committed verification contracts. A
// prose-only shortcut must still run those contracts when their input changes.
const VERIFICATION_DOCUMENTS = new Set([
  "README.md",
  "NOTICE.md",
  "docs/recovery-week-policy.md",
  "tools/README.md",
]);
const COMPARE_PAGE = 100;
const COMPARE_LIMIT = 300;

export function classifyChange(files) {
  if (!Array.isArray(files)) return { run: true, reason: "Changed files are unknown; run everything rather than guess." };
  if (!files.length) return { run: true, reason: "No changed files were reported; run everything." };
  const code = files.filter((file) => !DESIGN_REFERENCE.test(file) && (FIXTURE_PATH.test(file) || VERIFICATION_DOCUMENTS.has(file) || !PROSE.test(file)));
  if (!code.length) return { run: false, reason: `Only prose or standalone design references changed (${files.length} file(s)); nothing executable can differ.` };
  return { run: true, reason: `Executable or unknown input changed: ${code.slice(0, 6).join(", ")}${code.length > 6 ? ` and ${code.length - 6} more` : ""}.` };
}

export function shardMatrix(count = CI_SHARDS) {
  return Array.from({ length: count }, (_, index) => `${index + 1}/${count}`);
}

/** Files a pull request changes relative to its merge base, from the compare API; null when that is not knowable. */
export async function pullRequestFiles({ apiUrl, repository, base, head, token, fetchImpl = globalThis.fetch, patches = null }) {
  const files = [];
  for (let page = 1; files.length < COMPARE_LIMIT; page++) {
    const response = await fetchImpl(`${apiUrl}/repos/${repository}/compare/${base}...${head}?per_page=${COMPARE_PAGE}&page=${page}`, {
      headers: { accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`compare API answered HTTP ${response.status}`);
    const body = await response.json();
    const batch = (body.files || []).map((file) => file.filename);
    files.push(...batch);
    for (const file of body.files || []) {
      if (file.previous_filename) files.push(file.previous_filename);
      // The API omits a patch for binary files and for diffs too large to show; selection then widens.
      if (patches && typeof file.patch === "string") patches[file.filename] = file.patch;
    }
    if (batch.length < COMPARE_PAGE) return files;
  }
  // The compare API caps the file list; a change this large is not "prose only".
  return null;
}

export async function resolvePlan(env = process.env, { fetchImpl } = {}) {
  const event = env.GITHUB_EVENT_NAME || "workflow_dispatch";
  const payload = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) : {};
  const head = payload.pull_request?.head?.sha || env.GITHUB_SHA || null;
  if (event !== "pull_request") return { event, head, ...classifyChange(null), reason: `${event} runs the complete inventory.`, files: null,
    full: { mode: "all", ids: null, screens: null, reasons: [`${event} runs the complete full lane.`] } };
  let files = null;
  const patches = {};
  try {
    files = await pullRequestFiles({ apiUrl: env.GITHUB_API_URL || "https://api.github.com", repository: env.GITHUB_REPOSITORY,
      base: payload.pull_request.base.sha, head: payload.pull_request.head.sha, token: env.GITHUB_TOKEN, fetchImpl, patches });
  } catch (error) {
    console.warn(`Could not list changed files (${error.message}); running everything.`);
  }
  return { event, head, files, ...classifyChange(files), full: selectFullLane(files, { patches }) };
}

/** The plan job's outputs: the PR lane decision and the full lane's runners and selection. */
export function planOutputs(plan) {
  const full = plan.full || { mode: "all", ids: null, screens: null };
  const entries = fullLaneEntries(full);
  const browser = entries.filter(({ lane }) => BROWSER_LANES.has(lane));
  return {
    run: String(plan.run), reason: plan.reason.replaceAll("\n", " "), shards: JSON.stringify(shardMatrix()),
    full_run: String(entries.length > 0),
    full_fast: String(entries.some(({ lane }) => lane === "full-fast")),
    full_browser: String(browser.length > 0),
    full_shards: JSON.stringify(shardMatrix(fullShardCount(browser))),
    full_selection: JSON.stringify({ mode: full.mode, ids: full.ids, screens: full.screens }),
    // The verify stripes a visual-only red PR lane runs so CI captures every affected state in one round.
    capture_shards: JSON.stringify(shardMatrix(entries.filter(({ suite }) => suite.file === "tools/capture-ui-screens.mjs").length)),
  };
}

/** The aggregate: every job the plan selected must have succeeded, and nothing selected may have been skipped. */
export function gateResults(needs, { log = console.log } = {}) {
  const requiredJobs = ["plan", "fast", "browser", "service"];
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) throw new Error("CI gate: needs must be an object");
  for (const name of requiredJobs) {
    if (!Object.hasOwn(needs, name)) throw new Error(`CI gate: missing required job ${name}`);
  }
  const plan = needs?.plan;
  if (plan?.result !== "success") throw new Error(`CI gate: plan job ${plan?.result || "missing"}`);
  const runOutput = plan.outputs?.run;
  if (runOutput !== "true" && runOutput !== "false") throw new Error(`CI gate: plan run output must be "true" or "false", got ${JSON.stringify(runOutput)}`);
  let shards;
  try {
    shards = JSON.parse(plan.outputs?.shards);
  } catch {
    throw new Error("CI gate: plan shards output must be valid JSON");
  }
  const expectedShards = shardMatrix(CI_SHARDS);
  if (JSON.stringify(shards) !== JSON.stringify(expectedShards)) {
    throw new Error(`CI gate: plan shards output must exactly match ${JSON.stringify(expectedShards)}`);
  }
  const run = runOutput === "true";
  const failures = [];
  for (const [name, job] of Object.entries(needs)) {
    if (name === "plan") continue;
    const expected = run ? "success" : "skipped";
    log(`${name}: ${job.result}${run ? " (required)" : " (not selected)"}`);
    if (job.result !== expected) failures.push(`${name}: expected ${expected}, got ${job.result}`);
  }
  if (failures.length) throw new Error(`CI gate failed: ${failures.join("; ")}`);
  log(run ? "Every selected job passed." : `Nothing to run: ${plan.outputs?.reason || "prose-only change"}.`);
}

/**
 * The gate downloads every attempt's artifacts, named shard-<job index>-<run attempt>.
 * Re-running a failed job adds a newer attempt beside the old one; only the newest
 * attempt of each job is that job's result. Other layouts (a local sweep) are read whole.
 */
function latestShardReports(root) {
  const latest = new Map();
  const entries = existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [];
  for (const entry of entries) {
    const match = entry.isDirectory() && /^(?:full-)?shard-(\d+)-(\d+)$/.exec(entry.name);
    if (!match) continue;
    const [, job, attempt] = match;
    if (!latest.has(job) || Number(attempt) > latest.get(job).attempt) latest.set(job, { attempt: Number(attempt), dir: join(root, entry.name) });
  }
  if (!latest.size) return findShardReports(root);
  return [...latest.values()].flatMap(({ dir }) => findShardReports(dir));
}

/** Complete representative UI proof from this source, including fresh pixels. */
export { mergeCriticalReports as mergeUiSystemReports } from "./critical-ui.mjs";
import { mergeCriticalReports as mergeUiSystemReports } from "./critical-ui.mjs";

/**
 * The full lane's UI-system rule over every shard's report; browser-free so the gate job needs no
 * test dependencies. A targeted sweep is checked against exactly its selected states and stripes;
 * the catalog-wide "every selector rendered somewhere" rule needs the complete sweep.
 */
export function mergeFullUiSystemReports(root, { inventory = loadRoleInventory(), manifest = loadManifest(), selection = null } = {}) {
  const problems = validateRoleInventory(inventory, manifest);
  const targeted = Boolean(selection && selection.mode !== "all");
  const selected = targeted ? new Set(selection.screens || []) : null;
  const captureKeys = manifest.screens.filter((screen) => !selected || selected.has(`${screen.flow}/${screen.id}`))
    .flatMap((screen) => manifest.themes.flatMap((theme) =>
      Object.keys(manifest.locales).map((locale) => captureKey({
        flow: screen.flow, screen: screen.id, viewport: "phone-390", theme, locale, text: "normal", motion: "normal",
      }))));
  const stripes = targeted
    ? fullLaneEntries(selection, { manifest }).filter(({ suite }) => suite.file === "tools/check-ui-system.mjs").map(({ suite }) => parseShard(suite.args[1]))
    : Array.from({ length: UI_SYSTEM_SHARDS }, (_, index) => ({ index: index + 1, count: UI_SYSTEM_SHARDS }));
  const merged = mergeShardReports(latestShardReports(root), inventory, {
    expectedShardCount: stripes.length,
    expectedScreenCount: captureKeys.length,
    expectedCaptureKeysByShard: stripes.map((shard) => shardCaptures(captureKeys, shard)),
    catalogWide: !targeted,
  });
  return { ...merged, problems: [...problems, ...merged.problems] };
}

/**
 * The PR lane failed only because critical frames differ from the committed catalog (the browser shards'
 * only failures are test/ui-system.mjs runs marked deterministic) while everything else passed. Such a run
 * is a visual change waiting for its frames, so the workflow runs the targeted verify stripes to capture
 * every affected state at once. The gates stay red either way.
 */
export function classifyVisualOnly(needs, root) {
  if (needs?.plan?.result !== "success" || needs.plan.outputs?.run !== "true") return false;
  if (needs.fast?.result !== "success" || needs.service?.result !== "success" || needs.browser?.result !== "failure") return false;
  const failed = [];
  const walk = (dir) => {
    for (const entry of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "results.json") failed.push(...(JSON.parse(readFileSync(path, "utf8")).results || []).filter((row) => row.status !== "passed"));
    }
  };
  walk(root);
  return failed.length > 0 && failed.every((row) => row.command?.[1] === "test/ui-system.mjs" && row.deterministicFailure);
}

/**
 * The full aggregate. Every job the plan selected must pass and nothing selected
 * may be skipped. On a pull request the full lane is staged behind the PR lane,
 * so a PR lane that did not pass fails this check too. Pushes to main, the
 * nightly schedule and manual runs accept only the complete lane.
 */
export function gateFullResults(needs, { event = "workflow_dispatch", log = console.log } = {}) {
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) throw new Error("CI full gate: needs must be an object");
  for (const name of ["plan", "ci", "full-fast", "full-browser"]) {
    if (!Object.hasOwn(needs, name)) throw new Error(`CI full gate: missing required job ${name}`);
  }
  const plan = needs.plan;
  if (plan?.result !== "success") throw new Error(`CI full gate: plan job ${plan?.result || "missing"}`);
  const outputs = plan.outputs || {};
  for (const name of ["full_run", "full_fast", "full_browser"]) {
    if (outputs[name] !== "true" && outputs[name] !== "false") throw new Error(`CI full gate: plan ${name} output must be "true" or "false"`);
  }
  let selection;
  try { selection = parseFullSelection(outputs.full_selection); }
  catch (error) { throw new Error(`CI full gate: plan full_selection output is invalid (${error.message})`); }
  if (!outputs.full_selection) throw new Error("CI full gate: plan full_selection output is missing");
  if (event !== "pull_request" && selection.mode !== "all") throw new Error(`CI full gate: ${event} must run the complete full lane, got ${selection.mode}`);
  const entries = fullLaneEntries(selection);
  const browser = entries.filter(({ lane }) => BROWSER_LANES.has(lane));
  const expected = { full_run: entries.length > 0, full_fast: entries.some(({ lane }) => lane === "full-fast"), full_browser: browser.length > 0 };
  for (const [name, value] of Object.entries(expected)) {
    if (outputs[name] !== String(value)) throw new Error(`CI full gate: plan ${name} output disagrees with its selection`);
  }
  if (expected.full_browser && outputs.full_shards !== JSON.stringify(shardMatrix(fullShardCount(browser)))) {
    throw new Error("CI full gate: plan full_shards output disagrees with its selection");
  }
  if (event === "pull_request" && needs.ci?.result !== "success") {
    if (needs.ci?.outputs?.visual_only === "true") {
      throw new Error(`CI full gate: the PR lane (ci) is red only on catalog frames. CI captured every affected state (full-capture: ${needs["full-capture"]?.result || "missing"}); take them with node tools/fetch-ci-captures.mjs <run-id>, review and commit them`);
    }
    throw new Error(`CI full gate: the PR lane (ci) is ${needs.ci?.result || "missing"}, so the full lane did not start; fix the PR lane first`);
  }
  const failures = [];
  for (const [name, output] of [["full-fast", "full_fast"], ["full-browser", "full_browser"]]) {
    const required = outputs[output] === "true";
    const want = required ? "success" : "skipped";
    log(`${name}: ${needs[name].result}${required ? " (required)" : " (not selected)"}`);
    if (needs[name].result !== want) failures.push(`${name}: expected ${want}, got ${needs[name].result}`);
  }
  if (failures.length) throw new Error(`CI full gate failed: ${failures.join("; ")}`);
  log(selection.mode === "all" ? "Every full-lane job passed." : selection.mode === "none"
    ? "Nothing in the full lane can be affected by this change." : `Every targeted full-lane job passed (${entries.length} command(s), ${selection.screens.length} catalog state(s)).`);
}

async function main(argv) {
  if (argv[0] === "gate") {
    gateResults(JSON.parse(process.env.NEEDS || "{}"));
    return;
  }
  if (argv[0] === "visual-only") {
    const visual = classifyVisualOnly(JSON.parse(process.env.NEEDS || "{}"), resolve(argv[1] || ".ci-results/shards"));
    console.log(`Visual-only PR lane failure: ${visual ? "yes; the capture stripes run" : "no"}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `visual_only=${visual}\n`);
    return;
  }
  if (argv[0] === "gate-full") {
    gateFullResults(JSON.parse(process.env.NEEDS || "{}"), { event: process.env.EVENT || process.env.GITHUB_EVENT_NAME });
    return;
  }
  if (argv[0] === "merge-ui-system-full") {
    if (!argv[1]) throw new Error("merge-ui-system-full needs a directory holding ui-system-shard.json reports");
    const selection = parseFullSelection(process.env.REPFORGE_FULL_SELECTION);
    if (!fullLaneEntries(selection).some(({ suite }) => suite.file === "tools/check-ui-system.mjs")) {
      console.log(`UI system merge: the ${selection.mode} full-lane selection renders no catalog state; nothing to merge.`);
      return;
    }
    const merged = mergeFullUiSystemReports(resolve(argv[1]), { selection });
    console.log(`UI system merge: ${merged.shards} shard report(s), ${merged.screens} rendered states, ${merged.problems.length} problem(s).`);
    for (const problem of merged.problems) console.error(`FAIL: ${problem}`);
    if (merged.problems.length) process.exitCode = 1;
    return;
  }
  if (argv[0] === "merge-ui-system") {
    if (!argv[1]) throw new Error("merge-ui-system needs a directory holding ui-critical-report.json reports");
    const merged = mergeUiSystemReports(resolve(argv[1]));
    console.log(`UI system merge: ${merged.shards} shard report(s), ${merged.screens} rendered states, ${merged.problems.length} problem(s).`);
    for (const problem of merged.problems) console.error(`FAIL: ${problem}`);
    if (merged.problems.length) process.exitCode = 1;
    return;
  }
  const plan = await resolvePlan();
  const outputs = planOutputs(plan);
  const full = plan.full;
  console.log(`${plan.event} ${plan.head}: run=${plan.run} — ${plan.reason}`);
  console.log(`full lane: ${full.mode}${full.mode === "selected" ? ` — ${full.ids.length} command(s), ${full.screens.length} catalog state(s), ${JSON.parse(outputs.full_shards).length} runner(s)` : ""}`);
  for (const reason of full.reasons || []) console.log(`  ${reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(""));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## CI plan\n\n- Source: ${plan.head}\n- Run tests: **${plan.run ? "yes" : "no"}** — ${plan.reason}\n- Browser shards: ${JSON.parse(outputs.shards).length}\n` +
    (plan.files ? `- Changed files: ${plan.files.length}\n` : "") +
    `- Full lane: **${full.mode}**${full.mode === "selected" ? ` — ${full.ids.length} command(s), ${full.screens.length} catalog state(s) on ${JSON.parse(outputs.full_shards).length} runner(s)` : ""}\n` +
    (full.reasons || []).map((reason) => `  - ${reason}\n`).join(""));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
