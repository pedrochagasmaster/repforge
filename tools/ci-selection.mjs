#!/usr/bin/env node
/** Conservative visual selection: only inputs that can alter rendered evidence trigger capture. */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { visualDomains, screensForDomains } from "./visual-domains.mjs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PROSE = /(^|\/)(README|AGENTS|CLAUDE|CONTEXT)\.md$|^(docs|plans|advisor-plans)\/.+\.md$/;
const VISUAL_FIXTURE = /^test\/fixtures(?:\/|$)/;
const NON_RENDERING_TEST = /^test\/(?!browser\.mjs$|fixtures(?:\/|$)).+\.(?:mjs|js)$/;
const NON_RENDERING_TOOL = /^tools\/(?:run-tests|test-selection|ci-selection|ci-plan|wait-for-ci|check-test-syntax|visual-domains)\.mjs$/;
const NON_RENDERING_INFRA = /^\.github\/workflows\/|^test\/suites\.mjs$/;
function revisionOnly(file, base, cwd) {
  if (!base || !["index.html", "sw.js"].includes(file)) return false;
  try {
    const old = execFileSync("git", ["show", `${base}:${file}`], { cwd, encoding: "utf8" });
    const now = readFileSync(resolve(cwd, file), "utf8");
    const normalize = (text) => text.replace(/\?v=\d+/g, "?v=REV").replace(/repforge-v\d+/g, "repforge-vREV");
    return old !== now && normalize(old) === normalize(now);
  } catch { return false; }
}

export function selectVisuals(files, manifest, { force = false, cwd = ROOT, base, appSource, appDiff } = {}) {
  const full = (reason) => ({ mode: "full", screens: [], reason });
  if (force) return full("Explicit full sweep (manual or scheduled run).");
  if (!files) return full("Comparison base unavailable; do not guess the affected scope.");
  const known = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  const screens = new Set();
  const domains = new Set();
  for (const file of files) {
    if (VISUAL_FIXTURE.test(file)) return full(`Fixture input: ${file}`);
    if (PROSE.test(file) || NON_RENDERING_TEST.test(file) || NON_RENDERING_TOOL.test(file) || NON_RENDERING_INFRA.test(file)) continue;
    if (revisionOnly(file, base, cwd)) continue;
    const match = file.match(/^docs\/ui-screens\/screens\/([^/]+)\/([^/]+)__[^/]+\.png$/);
    if (match && known.has(`${match[1]}/${match[2]}`)) { screens.add(`${match[1]}/${match[2]}`); continue; }
    const mapped = visualDomains(file, { cwd, base, source: file === "app.js" ? appSource : undefined,
      diff: file === "app.js" ? appDiff : undefined });
    if (mapped) {
      if (mapped.includes("global")) return full(`Shared or unannotated render ownership: ${file}`);
      mapped.forEach((domain) => domains.add(domain));
      continue;
    }
    return full(`Rendered, capture-harness, structural, or unknown input: ${file}`);
  }
  const mappedScreens = screensForDomains(domains, manifest) || [];
  if (domains.size && !mappedScreens.length) return full(`No catalog screens registered for mapped domains: ${[...domains].join(", ")}`);
  for (const screen of mappedScreens) screens.add(screen);
  return screens.size
    ? { mode: "screens", screens: [...screens].sort(), reason: `Complete variants for changed baselines/domains: ${[...domains].join(", ") || "baseline"}.` }
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
