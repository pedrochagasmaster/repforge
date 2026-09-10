#!/usr/bin/env node
/** Conservative visual selection: only inputs that can alter rendered evidence trigger capture. */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROSE = /(^|\/)(README|AGENTS|CLAUDE|CONTEXT)\.md$|^(docs|plans)\/.+\.md$/;
const NON_RENDERING_TEST = /^test\/(?!browser\.mjs$|fixtures(?:\/|$)).+\.(?:mjs|js)$/;
const NON_RENDERING_TOOL = /^tools\/(?:run-tests|check-test-syntax)\.mjs$/;

export function selectVisuals(files, manifest, { force = false } = {}) {
  const full = (reason) => ({ mode: "full", screens: [], reason });
  if (force) return full("Explicit full sweep (manual or scheduled run).");
  if (!files) return full("Comparison base unavailable; do not guess the affected scope.");
  const known = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  const screens = new Set();
  for (const file of files) {
    if (PROSE.test(file) || NON_RENDERING_TEST.test(file) || NON_RENDERING_TOOL.test(file)) continue;
    const match = file.match(/^docs\/ui-screens\/screens\/([^/]+)\/([^/]+)__[^/]+\.png$/);
    if (match && known.has(`${match[1]}/${match[2]}`)) { screens.add(`${match[1]}/${match[2]}`); continue; }
    return full(`Rendered, capture-harness, structural, or unknown input: ${file}`);
  }
  return screens.size
    ? { mode: "screens", screens: [...screens].sort(), reason: "Baseline-only change: recapture every variant of each affected screen." }
    : { mode: "none", screens: [], reason: "No changed file can alter rendered catalog evidence." };
}

export function changedFiles(base, { cwd = ROOT } = {}) {
  if (!/^[a-f0-9]{40}$/i.test(base || "") || /^0+$/.test(base)) return null;
  try {
    return execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base, "HEAD", "--"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).split("\0").filter(Boolean);
  } catch { return null; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = JSON.parse(readFileSync(resolve(ROOT, "docs/ui-screens/manifest.json"), "utf8"));
  const plan = selectVisuals(changedFiles(process.env.CI_BASE_SHA), manifest, {
    force: ["workflow_dispatch", "schedule"].includes(process.env.GITHUB_EVENT_NAME),
  });
  mkdirSync(resolve(ROOT, ".ci-results"), { recursive: true });
  writeFileSync(resolve(ROOT, ".ci-results/visual-plan.json"), JSON.stringify(plan, null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `mode=${plan.mode}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Visual scope\n\n**${plan.mode}** — ${plan.reason}\n\n${plan.screens.join(", ")}\n`);
  console.log(JSON.stringify(plan, null, 2));
}
