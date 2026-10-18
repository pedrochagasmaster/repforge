/** Single inventory for local commands and CI. No test-file execution glob. */
const DOMAIN_VOCABULARY = new Set(["shell", "entry", "program", "history", "today", "workout", "progress", "settings", "library", "install", "persistence", "transition", "privacy", "telemetry", "offline", "service", "global"]);
const COST_VOCABULARY = new Set(["tiny", "normal", "long"]);
const TIER_VOCABULARY = new Set(["feedback", "packet", "candidate"]);
/**
 * Shard counts are inventory facts: CI runs every browser command across
 * CI_SHARDS balanced runners, and the two catalog sweeps are split into
 * UI_SYSTEM_SHARDS / VISUAL_SHARDS commands so no single command dominates a
 * shard. `seconds` is the measured wall time on ubuntu-latest (2026-09-30)
 * and only drives shard balancing; a missing value falls back on `cost`.
 */
export const CI_SHARDS = 14;
const DEFAULT_SECONDS = { tiny: 1, normal: 5, long: 60 };
const RENDERED_DOMAINS = ["shell", "entry", "program", "history", "today", "workout", "progress", "settings", "library", "install"];
const s = (file, args = [], extra = {}) => {
  const domains = extra.domains || [...DOMAIN_VOCABULARY].filter((domain) => domain !== "global" && new RegExp(domain).test(file));
  const long = /(?:simulation|thermonuclear|persistence-race|accessibility|progress-lifecycle|progress-recovery)/.test(file);
  return { file, args, domains: domains.length ? domains : ["global"], cost: long ? "long" : "normal",
    tier: long ? "candidate" : "feedback", ...extra };
};
const shards = (count) => Array.from({ length: count }, (_, index) => `${index + 1}/${count}`);
export const SUITES = {
  "fast": [
    s("test/platform-catalog-contract.mjs", [], {domains:["library","offline"],nodeArgs:["--test"]}),
    s("test/platform-executor-contract.mjs", [], {domains:["program","offline"],nodeArgs:["--test"]}),
    s("test/focus-rest-clock.mjs", [], {domains:["workout"],nodeArgs:["--test"]}),
    s("test/focus-state-contract.mjs", [], {domains:["workout"],nodeArgs:["--test"]}),
    s("test/interchange-native.mjs", [], {domains:["privacy","program"]}),
    s("test/interchange-protocol-native.mjs", [], {domains:["privacy","persistence"]}),
    s("test/architecture-source-inventory.mjs", [], {domains:["offline"],nodeArgs:["--test"]}),
    s("test/fixture-runtime-contracts.mjs", [], {domains:["program", "persistence"]}),
    s("test/training-installed-editor.mjs", [], {domains:["program","workout"], nodeArgs:["--test"]}),
    s("test/architecture-release.mjs", [], {domains:["shell", "offline"], nodeArgs:["--test"]}),
    s("test/training-module-contracts.mjs", [], {domains:["program", "progress"], nodeArgs:["--test"]}),
    s("test/training-model.mjs", [], {domains:["program", "persistence"], nodeArgs:["--test"]}),
    s("test/persistence-snapshot-contract.mjs", [], {domains:["persistence"], nodeArgs:["--test"]}),
    s("test/persistence-instance-contract.mjs", [], {domains:["persistence"], nodeArgs:["--test"]}),
    s("test/persistence-preferences-contract.mjs", [], {domains:["persistence", "privacy"], nodeArgs:["--test"]}),
    s("test/platform-modules.mjs", [], {domains:["install", "telemetry"], nodeArgs:["--test"]}),
    s("test/architecture/application-commands.mjs", [], {domains:["workout", "program", "history", "persistence"]}),
    s("test/ci.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/privacy-contract.mjs", [], {"domains": ["privacy"], "cost": "tiny", "tier": "feedback"}),
    s("test/pages-deploy-boundary.mjs", [], {"domains": ["privacy", "offline"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/generative/self-test.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/shared-setup-unit.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/program-day-names.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-transition-plan067.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback"}),
    s("test/durable-outcome-contract.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-client-contract.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-plan067-contract.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-client.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-limits.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-production-config.mjs", [], {"domains": ["install", "service"], "cost": "tiny", "tier": "feedback"}),
    s("test/sw-transfer-passthrough.mjs", [], {"domains": ["install", "offline"], "cost": "tiny", "tier": "feedback"}),
    s("test/verification-recorder.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("tools/check-production-syntax.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("tools/check-test-syntax.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("tools/build-i18n.mjs", ["--check"], {"domains": ["shell"], "cost": "tiny", "tier": "feedback"}),
    s("tools/move-draft-store-owner.mjs", ["--check"], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/draft-store-owner-check.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/generative/run.mjs", ["--profile", "ci"], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/program-entry.mjs", [], {"domains": ["entry", "program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-review.mjs", [], {"domains": ["entry", "program"], "cost": "normal", "tier": "feedback", "seconds": 10}),
    s("test/program-entry-production-adapter.mjs", [], {"domains": ["entry", "program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-entry-inputs.mjs", [], {"domains": ["entry", "program"], "cost": "normal", "tier": "feedback", "seconds": 10}),
    s("test/generation-identity.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-candidates.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-layout.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-duration20.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/architecture-baseline.mjs", [], { domains: ["program", "workout", "history", "persistence"], cost: "normal", tier: "feedback" }),
    s("test/program-generation-parity.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-periodization.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-source-matrix.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-source-dose-boundaries.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-compiler-plan067.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-compiler-search.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 10}),
    s("test/progression-engine-plan067.mjs", [], {"domains": ["progress"], "cost": "normal", "tier": "feedback"}),
    s("test/program-entry-contracts.mjs", [], {"domains": ["entry", "program"], "cost": "normal", "tier": "feedback"}),
    s("test/ui-screens.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/workout-draft.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback"}),
    s("test/workout-draft-migration.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback"}),
    s("test/schedule.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/history-frequency.mjs", [], {"domains": ["history"], "cost": "normal", "tier": "feedback"}),
    s("test/exercise-library.mjs", [], {"domains": ["library"], "cost": "normal", "tier": "feedback"}),
    s("test/exercise-catalog.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/review-pt-names.mjs", [], {"domains": ["library"], "cost": "tiny", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/progress-model.mjs", [], {"domains": ["progress"], "cost": "normal", "tier": "feedback"}),
    s("test/progress-model-dst.mjs", [], {"domains": ["progress"], "cost": "normal", "tier": "feedback"}),
    s("test/vendor-runtimes.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/motion-vocabulary.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/telemetry-unit.mjs", [], {"domains": ["telemetry"], "cost": "normal", "tier": "feedback"}),
    s("test/unsupported-workout-grammar.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback"}),
    s("test/posthog-adapter.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/posthog-config.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/posthog-measurement.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("tools/check-ui-screens.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("tools/check-ui-semantic-roles.mjs", ["--check"], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/install-transfer-recovery.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
  ],
  "state": [
    s("test/architecture-release-browser.mjs", [], {domains:["offline","privacy"], seconds:30}),
    s("test/shell-lifetime.mjs", [], {domains:["shell"], seconds:10}),
    s("test/privacy-offline.mjs", [], {"domains": ["privacy", "offline"], "cost": "normal", "tier": "packet", "seconds": 2.51}),
    s("test/sw-upgrade.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 6.22}),
    s("test/sw-error-responses.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 5.58}),
    s("test/sw-launch-redirect.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 5.65}),
    s("test/install-transfer-sw-upgrade.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 5.65}),
    s("test/program-transition-sw-upgrade.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 10.12}),
    s("test/persistence.mjs", [], {"domains": ["persistence"], "cost": "normal", "tier": "feedback", "seconds": 32.92}),
    s("test/persistence-race.mjs", [], {"domains": ["persistence"], "cost": "long", "tier": "candidate", "seconds": 8.68}),
    s("test/thermonuclear-races.mjs", [], {"domains": ["global"], "cost": "long", "tier": "candidate", "seconds": 38.85}),
    s("test/program-transition-commit.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 63.01}),
    s("test/program-transition-crash-replay.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 263.85, "timeoutMs": 1200000}),
    s("test/program-transition-backup.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 12.43}),
    s("test/install-transfer-client-browser.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 1.86}),
    s("test/install-transfer-import.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 161.55}),
    s("test/install-transfer-ui.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 20.41}),
    s("test/workout-draft-storage.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 65.61}),
    s("test/draftv2-staged-cas.mjs", [], {"domains": ["persistence"], "cost": "normal", "tier": "feedback", "seconds": 21.18}),
    s("test/workout-draft-sw-upgrade.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 7.94}),
    s("test/adversarial-draft-transactions.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 40.41}),
  ],
  "entry": [
    s("test/training-worker-modules.mjs", [], {domains:["program","offline"], seconds:20}),
    s("test/program-entry-s4.mjs", [], {"domains": ["entry", "program", "today", "workout", "persistence"], "cost": "normal", "tier": "feedback", "seconds": 39.14}),
    s("test/program-engine-worker.mjs", [], {"domains": ["entry", "program", "offline"], "cost": "normal", "tier": "feedback", "seconds": 28.09}),
    s("test/per-side-engine-browser.mjs", [], {"domains": ["workout", "program", "persistence"], "cost": "normal", "tier": "packet", "seconds": 8.18, "timeoutMs": 900000}),
    s("test/per-side-engine-bodyweight-browser.mjs", [], {"domains": ["workout", "program", "persistence"], "cost": "normal", "tier": "packet", "seconds": 12.01, "timeoutMs": 900000}),
    s("test/per-side-execution-mode-capture-browser.mjs", [], {"domains": ["entry", "workout", "history", "persistence"], "cost": "normal", "tier": "packet", "seconds": 16.86, "timeoutMs": 900000}),
    s("test/catalog-metric-program-browser.mjs", [], {"domains": ["entry", "workout", "history", "persistence"], "cost": "long", "tier": "candidate", "seconds": 23.72, "timeoutMs": 900000}),
    s("test/program-editor-text-fields.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 4.81}),
    s("test/custom-mutation-recovery.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 150}),
    s("test/program-import-review.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 48.85}),
    s("test/program-freeform-import.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 124.11}),
    s("test/shared-setup-flow.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 79.86}),
  ],
  "workout": [
    s("test/ui-system.mjs", [], {"domains": ["shell", "entry", "program", "history", "today", "workout", "progress", "settings", "library", "install"], "cost": "normal", "tier": "feedback", "seconds": 130}),
    s("test/history-delete-replay.mjs", [], {"domains": ["history"], "cost": "normal", "tier": "feedback", "seconds": 4.53}),
    s("test/focus-pending-field.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 42.85}),
    s("test/workout-draft-parity.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 31.57}),
    s("test/workout-finish-boundary.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 7.35}),
    s("test/management-summary.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 3.44}),
    s("test/progress-lifecycle.mjs", [], {"domains": ["progress"], "cost": "long", "tier": "candidate", "env": {"REPFORGE_LIFECYCLE_BROWSER": "1"}, "timeoutMs": 900000, "seconds": 15.27}),
    s("test/progress-recovery.mjs", [], {"domains": ["progress"], "cost": "long", "tier": "candidate", "timeoutMs": 900000, "seconds": 7.1}),
  ],
  "privacy": [
    s("test/telemetry-leakage.mjs", [], {"domains": ["telemetry"], "cost": "normal", "tier": "feedback", "seconds": 2.44}),
  ],
  "service": [
    s("test/install-transfer-service.mjs", [], {"domains": ["install", "service"], "cost": "normal", "tier": "feedback", "timeoutMs": 1200000}),
  ],
};

export const SUPPORT = {
  "test/interchange-runtime.mjs": "Separate-realm native module loader shared by retained transfer contract proofs.",
  "test/persistence-artifacts.mjs": "Imported persistence race evidence collector; standalone self-test retired in the risk ledger.",
  "test/entry-privacy.mjs": "Shared privacy characterization/oracles imported by the four scoped contracts.",
  "test/suites.mjs": "CI/local inventory, imported by tools/run-tests.mjs.",
  "test/browser.mjs": "Shared Playwright launcher and boot helpers.",
  "test/redirect-host.mjs": "Loopback host with the production /index.html redirect, imported by the launch-redirect suites.",
  "test/adaptive-build-fixture.mjs": "Plan 069 S4 Build program fixtures through the real entry hub and editors.",
  "test/browser-artifacts.mjs": "Diagnostic-only tracing, imported by browser.mjs.",
  "test/program-entry-a11y.mjs": "runProgramEntryA11y is executed by ui-system.mjs.",
  "test/first-run-shots.mjs": "Manual historical screenshot utility; canonical evidence uses tools/capture-ui-screens.mjs.",
  "test/focus-shots.mjs": "Manual focused screenshot utility, not a regression suite.",
  "test/library-shots.mjs": "Manual library screenshot utility, not a regression suite.",
  "test/pt-copy-shots.mjs": "Manual copy-review screenshot utility, not a regression suite.",
  "test/fixtures/": "Imported synthetic data and seed helpers, including the immutable old-worker fixture.",
  "test/generative/adapters/": "Production-module adapters imported by generative properties.",
  "test/generative/arbitraries/": "Generators imported by generative properties.",
  "test/generative/model/": "Independent models imported by generative properties.",
  "test/generative/properties/": "Executed by generative/run.mjs; self-test reconciles its property-module inventory.",
  "test/generative/regressions/": "Named regression fixtures imported by the property suites."
};

export const commandArgs = (suite) => [...(suite.nodeArgs || []), suite.file, ...suite.args];
export const suiteId = (suite) => [suite.file, ...suite.args].join(" ").replace(/[^a-zA-Z0-9_-]+/g, "-");
export const BROWSER_LANES = new Set(["state", "entry", "workout", "privacy", "visual"]);
export const suiteSeconds = (suite) => suite.seconds ?? DEFAULT_SECONDS[suite.cost] ?? DEFAULT_SECONDS.normal;

/** Parse `k/n` into a one-based shard index and count, rejecting anything else. */
export function parseShard(value) {
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(String(value ?? ""));
  const index = match ? Number(match[1]) : NaN;
  const count = match ? Number(match[2]) : NaN;
  if (!match || index > count) throw new Error(`Shard must be k/n with 1 <= k <= n, got ${JSON.stringify(value)}`);
  return { index, count };
}

/**
 * Deterministic longest-processing-time packing: heaviest command first, each
 * into the currently lightest shard. Every command lands in exactly one shard,
 * so the union of `shard 1/n` … `shard n/n` is the whole browser inventory.
 */
export function shardSuites(entries, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`Shard count must be a positive integer, got ${count}`);
  if (entries.length < count) throw new Error(`Cannot distribute ${entries.length} command(s) across ${count} non-empty shards`);
  const bins = Array.from({ length: count }, () => ({ seconds: 0, entries: [] }));
  const ordered = entries.map((entry, order) => ({ entry, order, seconds: suiteSeconds(entry.suite) }))
    .sort((a, b) => b.seconds - a.seconds || a.order - b.order);
  for (const item of ordered) {
    const bin = bins.reduce((lightest, candidate) => candidate.seconds < lightest.seconds ? candidate : lightest);
    bin.entries.push(item.entry);
    bin.seconds += item.seconds;
  }
  return bins.map((bin) => ({ seconds: bin.seconds,
    entries: [...bin.entries].sort((a, b) => entries.indexOf(a) - entries.indexOf(b)) }));
}

export function browserEntries(suites = SUITES) {
  return Object.entries(suites).filter(([lane]) => BROWSER_LANES.has(lane))
    .flatMap(([lane, entries]) => entries.map((suite) => ({ lane, suite })));
}

export function inventoryErrors(files, suites = SUITES, support = SUPPORT) {
  const errors = [];
  const commands = new Set();
  const ids = new Set();
  const scheduled = new Set();
  const available = new Set(files);
  const executableLanes = new Set(["fast", "service", ...BROWSER_LANES]);
  for (const [lane, entries] of Object.entries(suites)) {
    if (!executableLanes.has(lane)) errors.push(`Unknown lane: ${lane}`);
    if (!entries.length) errors.push(`Empty lane: ${lane}`);
    for (const entry of entries) {
      if (!available.has(entry.file)) errors.push(`Missing suite: ${entry.file}`);
      const command = JSON.stringify(commandArgs(entry));
      if (commands.has(command)) errors.push(`Duplicate command: ${command}`);
      commands.add(command);
      const id = suiteId(entry);
      if (!Array.isArray(entry.domains) || !entry.domains.length || entry.domains.some((domain) => !DOMAIN_VOCABULARY.has(domain))) errors.push(`Invalid domains: ${entry.file}`);
      if (!COST_VOCABULARY.has(entry.cost)) errors.push(`Invalid cost: ${entry.file}`);
      if (!TIER_VOCABULARY.has(entry.tier)) errors.push(`Invalid tier: ${entry.file}`);
      if (entry.seconds !== undefined && !(Number.isFinite(entry.seconds) && entry.seconds > 0)) errors.push(`Invalid seconds: ${id}`);
      if (ids.has(id)) errors.push(`Duplicate artifact id: ${id}`);
      ids.add(id);
      scheduled.add(entry.file);
    }
  }
  for (const file of files.filter((f) => /^test\/.+\.(mjs|js)$/.test(f))) {
    const reasons = Object.entries(support).filter(([path]) =>
      path.endsWith("/") ? file.startsWith(path) : file === path);
    if (!scheduled.has(file) && !reasons.some(([, reason]) => reason.trim())) {
      errors.push(`Unclassified test file: ${file}`);
    }
    if (scheduled.has(file) && reasons.length) errors.push(`Suite also excluded as support: ${file}`);
  }
  return errors;
}
