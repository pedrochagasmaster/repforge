#!/usr/bin/env node
/**
 * CI planning for .github/workflows/ci.yml.
 *
 *   node tools/ci-plan.mjs        decide whether this change needs the test
 *                                 matrix and publish the shard list
 *   node tools/ci-plan.mjs gate   fail unless every job the plan selected passed
 *   node tools/ci-plan.mjs merge-ui-system <dir>
 *                                 union the ui-system-shard.json reports under
 *                                 <dir> and apply the catalog-wide rules
 *
 * The only narrowing CI does is "prose-only changes skip the tests". Anything
 * else — an unknown file, an API failure, a push to main — runs the complete
 * inventory. Test selection by ownership stays a local feedback tool
 * (tools/test-selection.mjs); the merge gate never guesses.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { CI_SHARDS, UI_SYSTEM_SHARDS } from "../test/suites.mjs";
import { loadManifest } from "./ui-screens/manifest.mjs";
import { findShardReports, loadRoleInventory, mergeShardReports, validateRoleInventory } from "./ui-system-core.mjs";

const PROSE = /(?:^|\/)(?:[^/]+\.(?:md|txt)|\.gitignore|LICENSE)$/;
const FIXTURE_PATH = /(?:^|\/)(?:fixtures?|__fixtures__)(?:\/|$)/;
const COMPARE_PAGE = 100;
const COMPARE_LIMIT = 300;

export function classifyChange(files) {
  if (!Array.isArray(files)) return { run: true, reason: "Changed files are unknown; run everything rather than guess." };
  if (!files.length) return { run: true, reason: "No changed files were reported; run everything." };
  const code = files.filter((file) => FIXTURE_PATH.test(file) || !PROSE.test(file));
  if (!code.length) return { run: false, reason: `Only prose changed (${files.length} file(s)); nothing executable can differ.` };
  return { run: true, reason: `Executable or unknown input changed: ${code.slice(0, 6).join(", ")}${code.length > 6 ? ` and ${code.length - 6} more` : ""}.` };
}

export function shardMatrix(count = CI_SHARDS) {
  return Array.from({ length: count }, (_, index) => `${index + 1}/${count}`);
}

/** Files a pull request changes relative to its merge base, from the compare API; null when that is not knowable. */
export async function pullRequestFiles({ apiUrl, repository, base, head, token, fetchImpl = globalThis.fetch }) {
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
    for (const file of body.files || []) if (file.previous_filename) files.push(file.previous_filename);
    if (batch.length < COMPARE_PAGE) return files;
  }
  // The compare API caps the file list; a change this large is not "prose only".
  return null;
}

export async function resolvePlan(env = process.env, { fetchImpl } = {}) {
  const event = env.GITHUB_EVENT_NAME || "workflow_dispatch";
  const payload = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) : {};
  const head = payload.pull_request?.head?.sha || env.GITHUB_SHA || null;
  if (event !== "pull_request") return { event, head, ...classifyChange(null), reason: `${event} runs the complete inventory.` , files: null };
  let files = null;
  try {
    files = await pullRequestFiles({ apiUrl: env.GITHUB_API_URL || "https://api.github.com", repository: env.GITHUB_REPOSITORY,
      base: payload.pull_request.base.sha, head: payload.pull_request.head.sha, token: env.GITHUB_TOKEN, fetchImpl });
  } catch (error) {
    console.warn(`Could not list changed files (${error.message}); running everything.`);
  }
  return { event, head, files, ...classifyChange(files) };
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

/** The catalog-wide UI-system rule over every shard's report; browser-free so the gate job needs no test dependencies. */
export function mergeUiSystemReports(root, { inventory = loadRoleInventory(), manifest = loadManifest() } = {}) {
  const problems = validateRoleInventory(inventory, manifest);
  const expectedScreenCount = manifest.screens.length * 2 * Object.keys(manifest.locales).length;
  const merged = mergeShardReports(findShardReports(root), inventory, {
    expectedShardCount: UI_SYSTEM_SHARDS,
    expectedScreenCount,
  });
  return { ...merged, problems: [...problems, ...merged.problems] };
}

async function main(argv) {
  if (argv[0] === "gate") {
    gateResults(JSON.parse(process.env.NEEDS || "{}"));
    return;
  }
  if (argv[0] === "merge-ui-system") {
    if (!argv[1]) throw new Error("merge-ui-system needs a directory holding ui-system-shard.json reports");
    const merged = mergeUiSystemReports(resolve(argv[1]));
    console.log(`UI system merge: ${merged.shards} shard report(s), ${merged.screens} rendered states, ${merged.problems.length} problem(s).`);
    for (const problem of merged.problems) console.error(`FAIL: ${problem}`);
    if (merged.problems.length) process.exitCode = 1;
    return;
  }
  const plan = await resolvePlan();
  const shards = shardMatrix();
  console.log(`${plan.event} ${plan.head}: run=${plan.run} — ${plan.reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `run=${plan.run}\nreason=${plan.reason.replaceAll("\n", " ")}\nshards=${JSON.stringify(shards)}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## CI plan\n\n- Source: ${plan.head}\n- Run tests: **${plan.run ? "yes" : "no"}** — ${plan.reason}\n- Browser shards: ${shards.length}\n` +
    (plan.files ? `- Changed files: ${plan.files.length}\n` : ""));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
}
