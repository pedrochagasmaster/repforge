#!/usr/bin/env node
/** One inventory-backed plan for PR feedback and exact-SHA candidate CI. */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUITES, BROWSER_LANES, suiteId } from "../test/suites.mjs";
import { selectPacket, selectBranch } from "./test-selection.mjs";
import { selectVisuals } from "./ci-selection.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHA = /^[0-9a-f]{40}$/i;
const git = (args, cwd = ROOT) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

export function makeCiPlan({ event, draft = false, requestedMode, baseSha, headSha, expectedSha,
  resolvedSha = headSha, files, manifest, cwd = ROOT }) {
  if (!SHA.test(headSha || "")) throw new Error("CI plan needs a resolved 40-character head SHA");
  const mode = event === "push" ? "candidate" : requestedMode || (draft ? "feedback" : "candidate");
  if (!["feedback", "candidate"].includes(mode)) throw new Error(`Unknown CI mode: ${mode}`);
  if (event === "workflow_dispatch") {
    if (!SHA.test(expectedSha || "") || expectedSha !== resolvedSha || headSha !== resolvedSha) {
      throw new Error(`Candidate ref SHA mismatch: expected ${expectedSha || "(missing)"}, resolved ${resolvedSha}`);
    }
  }
  if (mode === "feedback" && (!SHA.test(baseSha || "") || !files)) {
    throw new Error("Feedback requires a resolved base SHA and changed-file list");
  }
  const selected = mode === "candidate"
    ? Object.entries(SUITES).flatMap(([lane, suites]) => suites.map((suite) => ({ lane, suite })))
    : selectPacket(files, { cwd }).entries;
  const tests = Object.fromEntries(Object.keys(SUITES).map((lane) =>
    [lane, selected.filter((entry) => entry.lane === lane).map(({ suite }) => suiteId(suite))]));
  const visual = event === "push"
    ? selectVisuals([], manifest, { force: true })
    : selectVisuals(files, manifest, { cwd, base: baseSha });
  const browser = [...BROWSER_LANES].filter((lane) => tests[lane].length);
  const legacyIds = mode === "feedback" ? selectBranch(files, { cwd }).entries.map(({ suite }) => suiteId(suite)) : [];
  const selectedIds = new Set(Object.values(tests).flat());
  return {
    schemaVersion: 1, mode, event, baseSha: baseSha || null, headSha, tests,
    service: { required: tests.service.length > 0, commands: tests.service },
    browser, visual,
    shadow: mode === "feedback" ? { legacyCount: legacyIds.length,
      omittedFromFeedback: legacyIds.filter((id) => !selectedIds.has(id)),
      reason: "Candidate-tier commands remain in the exhaustive candidate/main gate unless directly changed or high-risk-owned." } : null,
    reasons: mode === "candidate"
      ? ["Exhaustive exact-SHA contract gate; visual evidence is change-proportional on PR candidates and widens to full on unknown ownership."]
      : selectPacket(files, { cwd }).reasons,
  };
}

export function resolveCiInputs(env = process.env, cwd = ROOT) {
  const event = env.GITHUB_EVENT_NAME || "workflow_dispatch";
  const payload = env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")) : {};
  const headSha = git(["rev-parse", "HEAD"], cwd);
  let baseSha = payload.pull_request?.base?.sha || env.CI_BASE_SHA || payload.before || null;
  if (!baseSha && event === "workflow_dispatch") {
    for (const ref of ["origin/main", "main"]) {
      try { baseSha = git(["merge-base", "HEAD", ref], cwd); break; } catch {}
    }
  }
  const draft = Boolean(payload.pull_request?.draft);
  const requestedMode = payload.inputs?.mode || env.CI_MODE;
  const expectedSha = payload.inputs?.expected_sha || env.CI_EXPECTED_SHA;
  let files = null;
  if (baseSha && SHA.test(baseSha)) {
    try {
      files = git(["diff", "--name-only", "--no-renames", baseSha, "HEAD", "--"], cwd).split("\n").filter(Boolean);
    } catch { files = null; }
  }
  return { event, draft, requestedMode, expectedSha, baseSha, headSha, resolvedSha: headSha, files };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const manifest = JSON.parse(readFileSync(join(ROOT, "docs/ui-screens/manifest.json"), "utf8"));
    const plan = makeCiPlan({ ...resolveCiInputs(), manifest });
    mkdirSync(join(ROOT, ".ci-results"), { recursive: true });
    writeFileSync(join(ROOT, ".ci-results/ci-plan.json"), JSON.stringify(plan, null, 2) + "\n");
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `mode=${plan.mode}\nhead=${plan.headSha}\nbrowser=${JSON.stringify(plan.browser)}\nfast=${plan.tests.fast.join(",")}\nprivacy=${plan.tests.privacy.join(",")}\nservice=${plan.service.required}\nvisual=${plan.visual.mode}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## ${plan.mode === "candidate" ? "Candidate CI — exhaustive contracts" : "Feedback CI — not merge evidence"}\n\nBase: ${plan.baseSha || "—"}  \nHead: ${plan.headSha}\n\n` +
      Object.entries(plan.tests).map(([lane, ids]) => `- ${lane}: ${ids.length} commands`).join("\n") +
      `\n- visual: ${plan.visual.mode}${plan.visual.screens.length ? ` (${plan.visual.screens.length} screens)` : ""}\n\nWhy: ${plan.reasons.join("; ")}\n`);
    console.log(`${plan.mode} ${plan.headSha}: ${Object.values(plan.tests).reduce((n, ids) => n + ids.length, 0)} commands; visual ${plan.visual.mode}`);
  } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
