#!/usr/bin/env node
/** Conservative local test selection for implementation feedback, not a CI coverage replacement. */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FULL_SHARDS, FULL_SUITES, SUITES, UI_SYSTEM_SHARDS, VISUAL_SHARDS, commandArgs, parseShard, suiteId, suiteSeconds } from "../test/suites.mjs";
import { expandCaptures, loadManifest } from "./ui-screens/manifest.mjs";
import { screensForDomains, visualDomains } from "./visual-domains.mjs";
import { isCacheRevisionOnlyServiceWorkerChange } from "./revision-diff.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALL = Object.entries(SUITES).flatMap(([lane, suites]) => suites.map((suite) => ({ lane, suite })));
// Full-lane commands (ci-full) are selected locally only when their own file
// changed, or when a test/tool input reaches no pull-request suite at all.
const FULL = Object.entries(FULL_SUITES).flatMap(([lane, suites]) => suites.map((suite) => ({ lane, suite })));
const PROSE = /(^|\/)(README|AGENTS|CLAUDE|CONTEXT)\.md$|^(docs|plans|advisor-plans)\/.+\.(md|html)$/;
// Design-only comparisons: not bundled, imported, or scheduled by CI.
const DESIGN_REFERENCE = /^docs\/design\/native-fidelity-mocks\//;
const CACHE_REVISION_SUITES = ["test/exercise-library.mjs", "test/sw-upgrade.mjs", "test/vendor-runtimes.mjs"];

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

function isCacheRevisionOnlyWorker(cwd, base) {
  const requested = base === "HEAD (working tree)" ? "HEAD" : base;
  const resolved = requested ? resolveAffectedBase(cwd, requested) : resolveAffectedBase(cwd);
  if (!resolved) return false;
  try {
    const before = git(["show", `${resolved}:sw.js`], cwd);
    const after = readFileSync(resolve(cwd, "sw.js"), "utf8");
    return isCacheRevisionOnlyServiceWorkerChange(before, after);
  } catch { return false; }
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

function dependentScheduledFiles(files, cwd, reverse = reverseImports(cwd), entries = ALL) {
  const scheduled = new Set(entries.map(({ suite }) => suite.file));
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
  return [...ALL, ...FULL].filter(({ suite }) => files.has(suite.file));
}
function addEntries(target, additions) {
  for (const entry of additions) target.set(JSON.stringify(commandArgs(entry.suite)), entry);
}

const EXPLICIT_INPUT_RULES = [
  {
    match: /^engine-policy\.js$/,
    suiteFiles: ["test/programlab-native-policy.mjs", "test/programlab-default-parity.mjs", "test/program-engine-worker.mjs"],
    why: "the engine-policy seam: native policies, default preservation and the worker that loads it",
  },
  {
    match: /^programlab\/(?:domain|store|archive|archive-worker)\.js$/,
    suiteFiles: ["test/programlab-domain.mjs", "test/programlab-archive.mjs", "test/programlab-archive-limits.mjs", "test/programlab-store.mjs", "test/programlab-ui.mjs", "test/programlab-package.mjs"],
    why: "lab planning, archive protocol and isolated persistence consumers",
  },
  {
    match: /^programlab\/|^tools\/build-programlab\.mjs$/,
    suiteFiles: ["test/programlab-ui.mjs", "test/programlab-package.mjs", "test/pages-deploy-boundary.mjs"],
    why: "standalone workbench presentation, services, packaged URLs and production exclusion",
  },
  {
    match: /^test\/fixtures\/programlab-integration-default-results\.json$/,
    suiteFiles: ["test/programlab-default-parity.mjs"],
    why: "pre-extraction complete-result baseline",
  },
  {
    match: /^test\/generative\/(?:adapters|arbitraries|model|properties|regressions)\//,
    suiteFiles: ["test/generative/run.mjs", "test/generative/self-test.mjs"],
    why: "generative property input",
  },
  {
    match: /^\.github\/workflows\/[^/]+\.ya?ml$|^tools\/(?:ci-plan|revision-diff|visual-domains)\.mjs$|^test\/suites\.mjs$/,
    suiteFiles: ["test/ci.mjs"], why: "CI planning and selection contracts",
  },
  {
    match: /^tools\/(?:capture-ui-screens|check-ui-screens|compare-ui-screens)\.mjs$/,
    suiteFiles: ["test/ci.mjs", "test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"],
    why: "catalog capture/verification tooling; the representative matrix is the CI gate",
  },
  {
    match: /^tools\/ui-screens\/screens-(?:app|onboarding)\.mjs$/,
    suiteFiles: ["test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"],
    why: "UI capture scenarios",
  },
  {
    match: /^docs\/ui-screens\/manifest\.json$/,
    suiteFiles: [
      "test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"],
    why: "UI screen manifest consumers",
  },
  {
    match: /^docs\/ui-screens\/entry-semantics\.json$/,
    suiteFiles: ["test/ui-screens.mjs", "test/ui-system.mjs"],
    why: "UI screen semantic baseline",
  },
  {
    match: /^tools\/ui-role-inventory\.json$/,
    suiteFiles: ["test/ui-system.mjs", "test/ui-system-checker.mjs"],
    why: "live semantic-role inventory",
  },
  {
    match: /^docs\/ui-screens\/screens\/.+\.png$/,
    suiteFiles: ["test/ui-screens.mjs", "test/ui-system.mjs", "tools/check-ui-screens.mjs"],
    why: "UI screen catalog baselines",
  },
  {
    match: /^history-ui\.js$/,
    suiteFiles: [
      "test/history-delete-replay.mjs", "test/catalog-metric-program-browser.mjs",
      "test/management-summary.mjs", "test/per-side-execution-mode-capture-browser.mjs",
      "test/progress-lifecycle.mjs",
      "test/progress-recovery.mjs",
      "test/install-transfer-client-browser.mjs",
      "test/install-transfer-import.mjs",
      "test/install-transfer-recovery.mjs",
      "test/install-transfer-ui.mjs",
      "test/ui-screens.mjs",
      "tools/check-ui-screens.mjs"],
    why: "History UI consumers, restored-log compatibility, and shared Progress readers",
  }];

const DOMAIN_RULES = [
  { match: /^services\/install-transfer\//, lanes: ["service"], why: "install-transfer service gate" },
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
  { match: /^(app\.js|index\.html)$/, lanes: ["fast", "state", "entry", "workout", "privacy"], why: "shared application shell" }];

export function selectAffected(files, { cwd = ROOT, base } = {}) {
  if (!files) return { mode: "all", entries: ALL, files: [], reasons: ["Diff base unavailable; run everything rather than guess."] };
  const changed = [...new Set(files)].sort();
  if (!changed.length) return { mode: "none", entries: [], files: [], reasons: ["No changes from the selected base or working tree."] };
  const cacheRevisionOnlySw = changed.includes("sw.js") && isCacheRevisionOnlyWorker(cwd, base);
  const code = changed.filter((file) => !PROSE.test(file) && !DESIGN_REFERENCE.test(file));
  if (!code.length) return { mode: "none", entries: [], files: changed, reasons: ["Only allowlisted prose or standalone design references changed."] };

  const chosen = new Map();
  const reasons = [];
  const supportInputs = code.filter((file) => /^(test|tools|scripts)\//.test(file));
  const reverse = supportInputs.length ? reverseImports(cwd) : new Map();
  const dependencyByInput = new Map(supportInputs.map((file) =>
    [file, dependentScheduledFiles([file], cwd, reverse)]));
  const dependencyFiles = new Set([...dependencyByInput.values()].flatMap((files) => [...files]));
  if (dependencyFiles.size) {
    addEntries(chosen, ALL.filter(({ suite }) => dependencyFiles.has(suite.file)));
    reasons.push(`Dependency graph reaches ${dependencyFiles.size} scheduled suite file(s).`);
  }
  for (const file of supportInputs) {
    if (dependencyByInput.get(file).size) continue;
    const fullFiles = FULL.some(({ suite }) => suite.file === file) ? new Set([file]) : dependentScheduledFiles([file], cwd, reverse, FULL);
    if (!fullFiles.size) continue;
    dependencyByInput.set(file, fullFiles);
    addEntries(chosen, FULL.filter(({ suite }) => fullFiles.has(suite.file)));
    reasons.push(`${file}: full-lane only → ${[...fullFiles].join(", ")}`);
  }

  for (const file of code) {
    const explicitRule = EXPLICIT_INPUT_RULES.find(({ match }) => match.test(file));
    if (explicitRule) {
      addEntries(chosen, entriesForSuiteFiles(new Set(explicitRule.suiteFiles)));
      reasons.push(`${file}: ${explicitRule.why} → ${explicitRule.suiteFiles.join(", ")}`);
      continue;
    }
    if (/^(test|tools|scripts)\//.test(file)) {
      if (ALL.some(({ suite }) => suite.file === file)) continue;
      if (dependencyByInput.get(file)?.size) continue;
      // A deleted test is an inventory change, not an unknown executable input.
      if (/^test\/.+\.(?:mjs|js)$/.test(file) && !existsSync(resolve(cwd, file))) {
        addEntries(chosen, entriesForSuiteFiles(new Set(["test/ci.mjs"])));
        reasons.push(`${file}: removed test inventory → test/ci.mjs`);
        continue;
      }
      // A support/tool file with no proven scheduled consumer is not safe to ignore.
      if (!/^tools\/(?:test-selection|run-tests|ci-selection|check-test-syntax|measure-ci-selection)\.mjs$/.test(file)) {
        return { mode: "all", entries: ALL, files: changed, reasons: [`Unmapped test/tool input: ${file}`] };
      }
      continue;
    }
    if (file === "sw.js" && cacheRevisionOnlySw) {
      addEntries(chosen, entriesForSuiteFiles(new Set(CACHE_REVISION_SUITES)));
      reasons.push("sw.js: only the CACHE revision token changed → cache/revision relationship contracts");
      continue;
    }
    const rule = DOMAIN_RULES.find(({ match }) => match.test(file));
    if (!rule) return { mode: "all", entries: ALL, files: changed, reasons: [`Unmapped executable/input path: ${file}`] };
    addEntries(chosen, entriesForLanes(new Set(rule.lanes)));
    reasons.push(`${file}: ${rule.why} → ${rule.lanes.join(", ")}`);
  }

  const entries = [...chosen.values()];
  return { mode: entries.length ? "selected" : "none", entries, files: changed,
    ...(cacheRevisionOnlySw ? { cacheRevisionOnlySw: true } : {}),
    reasons: reasons.length ? reasons : ["No executable consumer selected."] };
}

export const selectBranch = selectAffected;
const HIGH_RISK = /^(durable-state|workout-draft|shared-setup|program-compiler|program-transition|sw|telemetry|posthog-adapter)\.js$/;
function hasHighRiskOwner(files, plan) {
  return files.some((file) => HIGH_RISK.test(file) && !(file === "sw.js" && plan.cacheRevisionOnlySw));
}
export function selectPacket(files, context = {}) {
  const plan = selectBranch(files, context);
  if (!files || plan.mode === "all" || hasHighRiskOwner(files, plan)) return plan;
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
    if (!hasHighRiskOwner(files, selected) && selected.mode !== "all")
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

// ------------------------------------------------------------ targeted full lane
/**
 * The pull-request full lane (ci-full on a PR) runs only the full-lane commands
 * and catalog states its changed files can affect. It is narrowed only through
 * reviewed ownership: `@ci-domain` regions in app.js and styles.css, the source
 * mappings in tools/visual-domains.mjs, the dependency graph of test inputs and
 * the explicit rules below. Anything else is a shared foundation and runs the
 * complete lane, which every push to main and the nightly run always do.
 */
const CATALOG_SWEEPS = new Set(["tools/check-ui-system.mjs", "tools/capture-ui-screens.mjs"]);
const FULL_PROSE = /(?:^|\/)(?:[^/]+\.(?:md|txt)|\.gitignore|LICENSE)$/;
const FIXTURE_PATH = /(?:^|\/)(?:fixtures?|__fixtures__)(?:\/|$)/;
const FULL_INPUT_RULES = [
  { match: /^DESIGN\.md$/, suiteFiles: ["tools/check-design-md.mjs"], why: "DESIGN.md token contract" },
  { match: /^docs\/design\/plan-064-reconciliation\.md$/, suiteFiles: ["test/direction-d-gate.mjs"], why: "Direction-D reconciliation input" },
  { match: /^README\.md$/, suiteFiles: ["test/simulation.mjs"], why: "simulation documentation contract" },
  {
    match: /^programlab\/|^tools\/build-programlab\.mjs$|^engine-policy\.js$|^test\/fixtures\/programlab-/,
    suiteFiles: ["test/programlab-domain.mjs", "test/programlab-archive.mjs", "test/programlab-archive-limits.mjs", "test/programlab-package.mjs", "test/programlab-ui.mjs"],
    flows: ["programlab"], why: "Program Lab workbench, archive and package",
  },
];
// Shared rendering, runtime and verification foundations: no reviewed owner can bound them.
const FULL_FOUNDATION = /^(?:motion-layer\.js|motion-polish\.css|index\.html|sw\.js|manifest\.webmanifest|vendor\/|fonts\/|icons\/|assets\/|i18n(?:-(?:en|pt)\.json|\.js)|exercises\.js|\.github\/|test\/browser\.mjs|test\/suites\.mjs|tools\/ui-screens\/|tools\/(?:test-selection|run-tests|ci-plan|ci-captures|local-preview|visual-domains|critical-ui|ui-system-core|ui-system-rendered|compare-ui-screens|check-ui-screens)\.mjs$|docs\/ui-screens\/(?:manifest|entry-semantics)\.json$|tools\/ui-role-inventory\.json$)/;
const SUITE_DOMAIN_FOR_VISUAL = { session: "workout" };
const REVISION_TOKENS = [[/\?v=[A-Za-z0-9._-]+/g, "?v=REVISION"], [/\bconst CACHE = "repforge-v\d+";/g, 'const CACHE = "repforge-vREVISION";']];
export const FULL_TARGET_SHARD_SECONDS = 480;

const ALL_FULL = (reason) => ({ mode: "all", ids: null, screens: null, reasons: [reason] });

/** True when a unified diff only moves `?v=` query revisions and the CACHE token. */
export function isRevisionOnlyPatch(patch) {
  if (typeof patch !== "string" || !patch.includes("@@")) return false;
  const normalize = (line) => REVISION_TOKENS.reduce((text, [pattern, value]) => text.replace(pattern, value), line);
  const removed = [], added = [];
  for (const line of patch.split("\n")) {
    if (/^(?:\+\+\+|---) /.test(line)) continue;
    if (line.startsWith("-")) removed.push(normalize(line.slice(1)));
    else if (line.startsWith("+")) added.push(normalize(line.slice(1)));
  }
  return removed.length > 0 && JSON.stringify(removed.sort()) === JSON.stringify(added.sort());
}

function fullEntriesFor(files) {
  return FULL.filter(({ suite }) => files.has(suite.file));
}

export function selectFullLane(files, { cwd = ROOT, patches = {}, sources = {}, manifest = loadManifest() } = {}) {
  if (!Array.isArray(files)) return ALL_FULL("Changed files are unknown; run the complete full lane.");
  const changed = [...new Set(files)].sort();
  const chosen = new Map();
  const screens = new Set();
  const domains = new Set();
  const reasons = [];
  const choose = (entries) => { for (const entry of entries) chosen.set(suiteId(entry.suite), entry); };
  const known = new Set(manifest.screens.map((screen) => `${screen.flow}/${screen.id}`));
  const fullFiles = new Set(FULL.map(({ suite }) => suite.file));
  const prFiles = new Set(ALL.map(({ suite }) => suite.file));
  let reverse;
  for (const file of changed) {
    const explicit = FULL_INPUT_RULES.find(({ match }) => match.test(file));
    if (explicit) {
      choose(fullEntriesFor(new Set(explicit.suiteFiles)));
      for (const flow of explicit.flows || []) manifest.screens.filter((screen) => screen.flow === flow).forEach((screen) => screens.add(`${screen.flow}/${screen.id}`));
      reasons.push(`${file}: ${explicit.why}`);
      continue;
    }
    if (DESIGN_REFERENCE.test(file) || (FULL_PROSE.test(file) && !FIXTURE_PATH.test(file))) continue;
    if (FULL_FOUNDATION.test(file)) {
      const patch = patches[file];
      if ((file === "sw.js" || file === "index.html") && isRevisionOnlyPatch(patch)) {
        reasons.push(`${file}: revision tokens only`);
        continue;
      }
      return ALL_FULL(`Shared foundation: ${file}`);
    }
    const baseline = file.match(/^docs\/ui-screens\/screens\/([^/]+)\/([^/]+)__[^/]+\.png$/);
    if (baseline) {
      if (!known.has(`${baseline[1]}/${baseline[2]}`)) return ALL_FULL(`Unregistered catalog frame: ${file}`);
      screens.add(`${baseline[1]}/${baseline[2]}`);
      continue;
    }
    if (CATALOG_SWEEPS.has(file)) return ALL_FULL(`Catalog sweep command: ${file}`);
    if (fullFiles.has(file)) {
      choose(fullEntriesFor(new Set([file])));
      reasons.push(`${file}: changed full-lane command`);
      continue;
    }
    if (prFiles.has(file)) continue;
    if (/^(?:test|tools|scripts)\//.test(file)) {
      if (/^test\/.+\.(?:mjs|js)$/.test(file) && !existsSync(resolve(cwd, file))) continue;
      reverse ??= reverseImports(cwd);
      const dependents = dependentScheduledFiles([file], cwd, reverse, FULL);
      const prDependents = dependentScheduledFiles([file], cwd, reverse, ALL);
      if (!dependents.size && !prDependents.size) return ALL_FULL(`Unmapped test/tool input: ${file}`);
      // A catalog-sweep input can change any rendered state.
      if ([...dependents].some((dependent) => CATALOG_SWEEPS.has(dependent))) return ALL_FULL(`Catalog capture input: ${file}`);
      choose(fullEntriesFor(dependents));
      reasons.push(`${file}: imported by ${dependents.size} full-lane command file(s)`);
      continue;
    }
    if (file === "app.js" || file === "styles.css") {
      const patch = patches[file];
      if (typeof patch !== "string") return ALL_FULL(`No diff available to bound ${file}`);
      let mapped;
      try { mapped = visualDomains(file, { cwd, source: sources[file], diff: patch }); }
      catch (error) { return ALL_FULL(`${file}: ${error.message}`); }
      if (mapped.includes("global")) return ALL_FULL(`${file}: change outside a reviewed @ci-domain region`);
      mapped.forEach((domain) => domains.add(domain));
      reasons.push(`${file}: ${mapped.join(", ")}`);
      continue;
    }
    const mapped = visualDomains(file, { cwd });
    if (!mapped || mapped.includes("global")) return ALL_FULL(`Unmapped executable input: ${file}`);
    mapped.forEach((domain) => domains.add(domain));
    reasons.push(`${file}: ${mapped.join(", ")}`);
  }
  if (domains.size) {
    for (const screen of screensForDomains(domains, manifest) || []) screens.add(screen);
    const suiteDomains = new Set([...domains].map((domain) => SUITE_DOMAIN_FOR_VISUAL[domain] || domain));
    choose(FULL.filter(({ suite }) => !CATALOG_SWEEPS.has(suite.file)
      && (suite.domains.includes("global") || suite.domains.some((domain) => suiteDomains.has(domain)))));
  }
  const ids = FULL.filter(({ suite }) => !CATALOG_SWEEPS.has(suite.file) && chosen.has(suiteId(suite))).map(({ suite }) => suiteId(suite));
  const states = [...screens].filter((key) => known.has(key)).sort();
  if (!ids.length && !states.length) return { mode: "none", ids: [], screens: [], reasons: reasons.length ? reasons : ["No full-lane command can be affected."] };
  return { mode: "selected", ids, screens: states, reasons };
}

function catalogStripes(file, defaultCount, captures, totalCaptures, template, screens) {
  const perDefault = totalCaptures / defaultCount;
  const count = Math.max(1, Math.min(defaultCount, captures, Math.ceil(captures / perDefault)));
  const seconds = Math.max(30, Math.ceil(suiteSeconds(template) * (captures / count) / perDefault));
  return Array.from({ length: count }, (_, index) => {
    const shard = `${index + 1}/${count}`;
    const args = template.args.map((arg) => /^\d+\/\d+$/.test(arg) ? shard : arg);
    return { lane: "full-browser", suite: { ...template, args, seconds, env: { ...template.env, REPFORGE_CATALOG_SCREENS: screens.join(",") } } };
  });
}

/** The exact commands a full-lane selection runs; the plan, every runner and the gate derive them alike. */
export function fullLaneEntries(selection, { manifest = loadManifest() } = {}) {
  if (!selection || selection.mode === "all") return FULL;
  if (selection.mode === "none") return [];
  const ids = new Set(selection.ids || []);
  const entries = FULL.filter(({ suite }) => !CATALOG_SWEEPS.has(suite.file) && ids.has(suiteId(suite)));
  const screens = selection.screens || [];
  if (!screens.length) return entries;
  const selected = new Set(screens);
  const states = manifest.screens.filter((screen) => selected.has(`${screen.flow}/${screen.id}`));
  const roleRenders = (count) => count * manifest.themes.length * Object.keys(manifest.locales).length;
  const frames = expandCaptures(manifest);
  const template = (file) => FULL.find(({ suite }) => suite.file === file).suite;
  return [
    ...entries,
    ...catalogStripes("tools/check-ui-system.mjs", UI_SYSTEM_SHARDS, roleRenders(states.length), roleRenders(manifest.screens.length), template("tools/check-ui-system.mjs"), screens),
    ...catalogStripes("tools/capture-ui-screens.mjs", VISUAL_SHARDS, frames.filter((capture) => selected.has(`${capture.flow}/${capture.screen}`)).length, frames.length, template("tools/capture-ui-screens.mjs"), screens),
  ];
}

/** Full-lane runners for these browser commands: the complete lane keeps FULL_SHARDS, a targeted one about eight minutes each. */
export function fullShardCount(browser) {
  if (!browser.length) return 1;
  if (browser.length === FULL.filter(({ lane }) => lane === "full-browser").length
    && browser.every(({ suite }, index) => suite === FULL.filter(({ lane }) => lane === "full-browser")[index]?.suite)) return FULL_SHARDS;
  const seconds = browser.reduce((sum, { suite }) => sum + suiteSeconds(suite), 0);
  return Math.max(1, Math.min(FULL_SHARDS, browser.length, Math.ceil(seconds / FULL_TARGET_SHARD_SECONDS)));
}

/** Parse the plan's published selection; anything unreadable runs the complete lane. */
export function parseFullSelection(text) {
  if (!text) return { mode: "all", ids: null, screens: null };
  const value = JSON.parse(text);
  if (!["all", "selected", "none"].includes(value?.mode)) throw new Error(`Invalid full-lane selection mode ${JSON.stringify(value?.mode)}`);
  return value;
}
