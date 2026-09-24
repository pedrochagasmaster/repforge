#!/usr/bin/env node
/** Conservative local test selection for implementation feedback, not a CI coverage replacement. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SUITES, commandArgs } from "../test/suites.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALL = Object.entries(SUITES).flatMap(([lane, suites]) => suites.map((suite) => ({ lane, suite })));
const PROSE = /(^|\/)(README|AGENTS|CLAUDE|CONTEXT)\.md$|^(docs|plans|advisor-plans)\/.+\.(md|html)$/;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function zlist(value) { return value.split("\0").filter(Boolean); }
function repoPath(path, cwd = ROOT) { return relative(cwd, resolve(cwd, path)).replaceAll("\\", "/"); }

export function resolveAffectedBase(cwd = ROOT, requested) {
  if (requested) {
    // A branch/ref means "changes made by this branch", so use its fork point.
    // This keeps long-lived worktrees from retesting unrelated commits that
    // landed on main after the branch began. A detached commit still resolves
    // to the same value when it is already an ancestor of HEAD.
    try { return git(["merge-base", "HEAD", requested], cwd).trim(); }
    catch {
      try { return git(["rev-parse", "--verify", requested], cwd).trim(); }
      catch { return null; }
    }
  }
  for (const ref of ["origin/main", "main"]) {
    try { return git(["merge-base", "HEAD", ref], cwd).trim(); } catch {}
  }
  try { return git(["rev-parse", "HEAD^"], cwd).trim(); } catch { return null; }
}

export function changedFilesForTests({ cwd = ROOT, base } = {}) {
  const resolvedBase = resolveAffectedBase(cwd, base);
  if (!resolvedBase) return { base: null, files: null };
  try {
    const tracked = zlist(git(["diff", "--name-only", "--no-renames", "-z", resolvedBase, "--"], cwd));
    const untracked = zlist(git(["ls-files", "--others", "--exclude-standard", "-z"], cwd));
    return { base: resolvedBase, files: [...new Set([...tracked, ...untracked])].sort() };
  } catch { return { base: resolvedBase, files: null }; }
}

export function changedFilesForEdit({ cwd = ROOT } = {}) {
  try {
    const dirty = zlist(git(["status", "--porcelain=v1", "-z", "--untracked-files=all"], cwd));
    if (dirty.length) {
      const tracked = zlist(git(["diff", "--name-only", "--no-renames", "-z", "HEAD", "--"], cwd));
      const untracked = zlist(git(["ls-files", "--others", "--exclude-standard", "-z"], cwd));
      return { base: "HEAD (working tree)", files: [...new Set([...tracked, ...untracked])].sort() };
    }
    const parent = git(["rev-parse", "HEAD^"], cwd).trim();
    return { base: parent, files: zlist(git(["diff", "--name-only", "--no-renames", "-z", parent, "HEAD", "--"], cwd)) };
  } catch { return changedFilesForTests({ cwd }); }
}

export function changedFilesForPacket({ cwd = ROOT, base } = {}) {
  if (!base) throw new Error("packet requires --base <sha-or-ref> (or REPFORGE_PACKET_BASE)");
  let ancestor;
  try { ancestor = git(["merge-base", "HEAD", base], cwd).trim(); }
  catch { throw new Error(`Cannot resolve a common ancestor for packet base ${base}`); }
  if (!ancestor) throw new Error(`Cannot resolve a common ancestor for packet base ${base}`);
  const tracked = zlist(git(["diff", "--name-only", "--no-renames", "-z", ancestor, "--"], cwd));
  const untracked = zlist(git(["ls-files", "--others", "--exclude-standard", "-z"], cwd));
  return { base: ancestor, files: [...new Set([...tracked, ...untracked])].sort() };
}

function listedCodeFiles(cwd) {
  try {
    return zlist(git(["ls-files", "-z", "--", "test", "tools", "scripts"], cwd))
      .filter((file) => [".js", ".mjs"].includes(extname(file)));
  } catch { return []; }
}

function resolveImport(fromFile, specifier, cwd) {
  if (!specifier.startsWith(".")) return null;
  const base = normalize(resolve(cwd, dirname(fromFile), specifier));
  for (const candidate of [base, `${base}.mjs`, `${base}.js`, resolve(base, "index.mjs"), resolve(base, "index.js")]) {
    if (existsSync(candidate)) return repoPath(candidate, cwd);
  }
  return null;
}

function reverseImports(cwd) {
  const reverse = new Map();
  const patterns = [
    /(?:import|export)\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const file of listedCodeFiles(cwd)) {
    let source;
    try { source = readFileSync(resolve(cwd, file), "utf8"); } catch { continue; }
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const dependency = resolveImport(file, match[1], cwd);
        if (!dependency) continue;
        if (!reverse.has(dependency)) reverse.set(dependency, new Set());
        reverse.get(dependency).add(file);
      }
    }
  }
  return reverse;
}

function dependentScheduledFiles(files, cwd) {
  const reverse = reverseImports(cwd);
  const scheduled = new Set(ALL.map(({ suite }) => suite.file));
  const selected = new Set();
  const queue = [...files];
  const seen = new Set(queue);
  while (queue.length) {
    const file = queue.shift();
    if (scheduled.has(file)) selected.add(file);
    for (const dependent of reverse.get(file) || []) {
      if (seen.has(dependent)) continue;
      seen.add(dependent); queue.push(dependent);
    }
  }
  return selected;
}

function entriesForLanes(lanes) {
  return ALL.filter(({ lane }) => lanes.has(lane));
}
function entriesForSuiteFiles(files) {
  return ALL.filter(({ suite }) => files.has(suite.file));
}
function addEntries(target, additions) {
  for (const entry of additions) target.set(JSON.stringify(commandArgs(entry.suite)), entry);
}

const EXPLICIT_INPUT_RULES = [
  {
    match: /^\.github\/workflows\/simulation\.yml$|^tools\/(?:ci-plan|visual-domains)\.mjs$|^test\/suites\.mjs$/,
    suiteFiles: ["test/ci.mjs"], why: "CI planning and selection contracts",
  },
  {
    match: /^tools\/ui-screens\/screens-(?:app|onboarding)\.mjs$/,
    suiteFiles: ["test/ui-screens.mjs", "tools/check-ui-screens.mjs"],
    why: "UI capture scenarios",
  },
  {
    match: /^docs\/ui-screens\/manifest\.json$/,
    suiteFiles: [
      "test/ui-screens.mjs",
      "tools/check-ui-screens.mjs",
      "test/ui-plan-050-build-hierarchy.mjs",
      "test/ui-plan-050-editor.mjs",
      "test/ui-catalog-contract.mjs",
    ],
    why: "UI screen manifest consumers",
  },
  {
    match: /^docs\/ui-screens\/entry-semantics\.json$/,
    suiteFiles: ["test/ui-screens.mjs"],
    why: "UI screen semantic baseline",
  },
  {
    match: /^docs\/ui-screens\/screens\/.+\.png$/,
    suiteFiles: ["test/ui-screens.mjs", "tools/check-ui-screens.mjs"],
    why: "UI screen catalog baselines",
  },
];

const DOMAIN_RULES = [
  { match: /^(services\/install-transfer\/|\.github\/workflows\/install-transfer-service\.yml$)/, lanes: ["service"], why: "install-transfer service gate" },
  { match: /^(telemetry\.js|posthog-(?:adapter|init)\.js|posthog-config\.js|scripts\/generate-posthog-config\.mjs)$/, lanes: ["fast", "privacy"], why: "telemetry boundary" },
  { match: /^durable-state\.js$/, lanes: ["fast", "state", "workout"], why: "durable state and persistence engine" },
  { match: /^workout-draft\.js$/, lanes: ["fast", "state", "workout"], why: "durable workout draft" },
  { match: /^(program-entry(?:-adapter)?\.js|program-compiler\.js)$/, lanes: ["fast", "state", "entry", "workout"], why: "program entry/compiler contract" },
  { match: /^program-editor\.js$/, lanes: ["entry", "workout"], why: "program editor UI" },
  { match: /^progress-model\.js$/, lanes: ["fast", "workout"], why: "Progress projections and History consumers" },
  { match: /^progression-engine\.js$/, lanes: ["fast", "state", "workout"], why: "progression domain and offline behavior" },
  { match: /^shared-setup\.js$/, lanes: ["fast", "state", "entry", "workout"], why: "shared setup contract" },
  { match: /^(motion-layer\.js|motion-polish\.css|vendor\/)/, lanes: ["fast", "workout"], why: "interaction runtime" },
  { match: /^(schedule\.js|notify\.js|i18n\.js|i18n-(?:en|pt)\.json|exercises\.js)$/, lanes: ["fast", "entry", "workout"], why: "shared display/domain module" },
  { match: /^sw\.js$/, lanes: ["fast", "state", "workout"], why: "offline/cache behavior" },
  { match: /^(styles\.css|manifest\.webmanifest|assets\/|icons\/|fonts\/)/, lanes: ["entry", "workout"], why: "rendered UI asset" },
  { match: /^(app\.js|index\.html)$/, lanes: ["fast", "state", "entry", "workout", "privacy"], why: "shared application shell" },
];

export function selectAffected(files, { cwd = ROOT } = {}) {
  if (!files) return { mode: "all", entries: ALL, files: [], reasons: ["Diff base unavailable; run everything rather than guess."] };
  const changed = [...new Set(files)].sort();
  if (!changed.length) return { mode: "none", entries: [], files: [], reasons: ["No changes from the selected base or working tree."] };
  const code = changed.filter((file) => !PROSE.test(file));
  if (!code.length) return { mode: "none", entries: [], files: changed, reasons: ["Only allowlisted prose changed."] };

  const chosen = new Map();
  const reasons = [];
  const dependencyFiles = dependentScheduledFiles(code.filter((file) => /^(test|tools|scripts)\//.test(file)), cwd);
  if (dependencyFiles.size) {
    addEntries(chosen, ALL.filter(({ suite }) => dependencyFiles.has(suite.file)));
    reasons.push(`Dependency graph reaches ${dependencyFiles.size} scheduled suite file(s).`);
  }

  for (const file of code) {
    const explicitRule = EXPLICIT_INPUT_RULES.find(({ match }) => match.test(file));
    if (explicitRule) {
      addEntries(chosen, entriesForSuiteFiles(new Set(explicitRule.suiteFiles)));
      reasons.push(`${file}: ${explicitRule.why} → ${explicitRule.suiteFiles.join(", ")}`);
      continue;
    }
    if (/^(test|tools|scripts)\//.test(file)) {
      if (dependencyFiles.has(file) || ALL.some(({ suite }) => suite.file === file)) continue;
      // A support/tool file with no proven scheduled consumer is not safe to ignore.
      if (!PROSE.test(file) && ![...dependencyFiles].some((candidate) => candidate === file)) {
        const knownDirect = ALL.some(({ suite }) => suite.file === file);
        if (knownDirect) continue;
        if (!/^tools\/(?:test-selection|run-tests|ci-selection|check-test-syntax|measure-ci-selection)\.mjs$/.test(file)) {
          return { mode: "all", entries: ALL, files: changed, reasons: [`Unmapped test/tool input: ${file}`] };
        }
      }
      continue;
    }
    const rule = DOMAIN_RULES.find(({ match }) => match.test(file));
    if (!rule) return { mode: "all", entries: ALL, files: changed, reasons: [`Unmapped executable/input path: ${file}`] };
    addEntries(chosen, entriesForLanes(new Set(rule.lanes)));
    reasons.push(`${file}: ${rule.why} → ${rule.lanes.join(", ")}`);
  }

  const entries = [...chosen.values()];
  return { mode: entries.length ? "selected" : "none", entries, files: changed, reasons: reasons.length ? reasons : ["No executable consumer selected."] };
}

export const selectBranch = selectAffected;
const HIGH_RISK = /^(durable-state|workout-draft|shared-setup|program-compiler|program-transition|sw|telemetry|posthog-adapter)\.js$/;
export function selectPacket(files, context = {}) {
  const plan = selectBranch(files, context);
  if (!files || plan.mode === "all" || files.some((file) => HIGH_RISK.test(file))) return plan;
  const entries = plan.entries.filter(({ suite }) => suite.tier !== "candidate" || files.includes(suite.file));
  return { ...plan, entries, reasons: [...plan.reasons, "Candidate-tier contracts run at the final gate unless directly changed or required by a high-risk owner."] };
}

export function selectEdit(files, context = {}) {
  if (!files) return selectBranch(null, context);
  const direct = new Set(ALL.map(({ suite }) => suite.file));
  const directFiles = files.filter((file) => direct.has(file));
  const otherFiles = files.filter((file) => !direct.has(file));
  if (!directFiles.length) {
    const selected = selectPacket(otherFiles, context);
    if (!files.some((file) => HIGH_RISK.test(file)) && selected.mode !== "all")
      return { ...selected, entries: selected.entries.filter(({ suite }) => suite.tier === "feedback") };
    return selected;
  }
  const selected = selectPacket(otherFiles, context);
  const chosen = new Map();
  addEntries(chosen, selected.entries);
  addEntries(chosen, entriesForSuiteFiles(new Set(directFiles)));
  return { ...selected, entries: [...chosen.values()], files,
    reasons: [...selected.reasons, `Direct changed suite(s): ${directFiles.join(", ")}`] };
}

export function formatAffected(plan) {
  const lanes = [...new Set(plan.entries.map(({ lane }) => lane))];
  return `${plan.mode}: ${plan.entries.length} command(s)${lanes.length ? ` across ${lanes.join(", ")}` : ""}; ${plan.reasons.join(" ")}`;
}
