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
export const UI_SYSTEM_SHARDS = 6;
export const VISUAL_SHARDS = 6;
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
  fast: [
    s("test/ci.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/privacy-contract.mjs", [], { domains: ["privacy"], cost: "tiny" }),
    s("test/generative/self-test.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/shared-setup-unit.mjs"),
    s("test/program-day-names.mjs"),
    s("test/program-transition.mjs"),
    s("test/program-transition-recovery.mjs"),
    s("test/program-transition-compiler-provenance.mjs"),
    s("test/program-transition-siblings.mjs"),
    s("test/program-transition-volume.mjs"),
    s("test/durable-outcome-contract.mjs"),
    s("test/install-transfer-client-contract.mjs"),
    s("test/install-transfer-client.mjs"),
    s("test/install-transfer-limits.mjs"),
    s("test/verification-recorder.mjs", [], {"nodeArgs": ["--test"]}),
    s("tools/check-production-syntax.mjs"),
    s("tools/check-test-syntax.mjs"),
    s("tools/build-i18n.mjs", ["--check"], { domains: ["shell"], cost: "tiny" }),
    s("tools/move-draft-store-owner.mjs", ["--check"]),
    s("test/draft-store-owner-check.mjs"),
    s("test/generative/run.mjs", ["--profile", "ci"]),
    s("test/program-entry.mjs"),
    s("test/program-entry-production-adapter.mjs"),
    s("test/program-compiler-plan048-preferences.mjs"),
    s("test/program-entry-contracts.mjs"),
    s("test/ui-screens.mjs"),
    s("test/workout-draft.mjs"),
    s("test/workout-draft-migration.mjs"),
    s("test/schedule.mjs"),
    s("test/exercise-library.mjs"),
    s("test/progression-fixtures.mjs"),
    s("test/progression-engine.mjs"),
    s("test/progression-range-simulation.mjs"),
    s("test/progress-model.mjs"),
    s("test/progress-model-dst.mjs"),
    s("test/progression-strategies-simulation.mjs"),
    s("test/vendor-runtimes.mjs"),
    s("test/telemetry-unit.mjs"),
    s("test/unsupported-workout-grammar.mjs"),
    s("test/posthog-adapter.mjs"),
    s("test/posthog-config.mjs"),
    s("test/posthog-measurement.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/runtime-budget.mjs"),
    s("tools/check-ui-screens.mjs"),
    s("test/manual-matrix.mjs", ["--self-test"]),
  ],
  state: [
    s("test/ci-browser.mjs"),
    s("test/privacy-offline.mjs", [], { domains: ["privacy", "offline"], tier: "packet" }),
    s("test/program-entry-conflict-runtime.mjs"),
    s("test/sw-upgrade.mjs"),
    s("test/sw-error-responses.mjs"),
    s("test/install-transfer-sw-upgrade.mjs"),
    s("test/program-transition-sw-upgrade.mjs"),
    s("test/program-entry-rules-runtime.mjs"),
    s("test/persistence-artifacts.mjs", ["--self-test"]),
    s("test/persistence.mjs", [], { seconds: 15 }),
    s("test/persistence-race.mjs", [], { seconds: 5 }),
    s("test/thermonuclear-races.mjs", [], { seconds: 17 }),
    s("test/program-transition-commit.mjs", [], { seconds: 13 }),
    s("test/program-transition-volume-commit.mjs"),
    s("test/program-transition-crash-replay.mjs", [], { seconds: 90 }),
    s("test/program-transition-backup.mjs"),
    s("test/program-transition-guided-repair.mjs"),
    s("test/program-block-identity.mjs", [], { seconds: 11 }),
    s("test/program-transition-recovery-carrier.mjs"),
    s("test/program-transition-recovery-corruption.mjs", [], { seconds: 16 }),
    s("test/program-transition-r7-boundary.mjs", [], { seconds: 13 }),
    s("test/install-transfer-client-browser.mjs"),
    s("test/install-transfer-clone.mjs"),
    s("test/install-transfer-import.mjs", [], { seconds: 77 }),
    s("test/install-transfer-recovery.mjs"),
    s("test/install-transfer-ui.mjs", [], { seconds: 19 }),
    s("test/recover-gate.mjs"),
    s("test/workout-draft-storage.mjs", [], { seconds: 31 }),
    s("test/draftv2-staged-cas.mjs", [], { domains: ["persistence"], cost: "normal" }),
    s("test/workout-draft-sw-upgrade.mjs"),
    s("test/progression-strategies-offline.mjs"),
    s("test/adversarial-draft-transactions.mjs", [], { seconds: 9 }),
    s("test/program-draft-conflicts.mjs", [], { seconds: 18 }),
    s("test/program-draft-set-reduction.mjs", [], { seconds: 9 }),
    s("test/program-draft-day-rename.mjs", [], { seconds: 14 }),
    s("test/workout-day-context-discard.mjs"),
  ],
  entry: [
    s("test/program-entry-rules-recovery.mjs"),
    s("test/ui-plan-050-build-hierarchy.mjs", [], { seconds: 13 }),
    s("test/ui-plan-050-editor.mjs", [], { seconds: 10 }),
    s("tools/build-program-family-fixtures.mjs", ["--check"]),
    s("test/generative-entry-runtime.mjs", [], { seconds: 14 }),
    s("test/program-family-fixtures.mjs"),
    s("test/program-compiler-persistence.mjs"),
    s("test/program-compiler-runtime.mjs"),
    s("test/program-entry-browser.mjs", [], { seconds: 33 }),
    s("test/ui-catalog-contract.mjs", [], { seconds: 17 }),
    s("test/install-modes.mjs", [], { seconds: 30 }),
    s("test/onboarding-cancel.mjs"),
    s("test/program-editor-text-fields.mjs"),
    s("test/program-editor-drag-selection.mjs"),
    s("test/program-editor-sorting.mjs", [], { seconds: 13 }),
    s("test/program-text-export.mjs"),
    s("test/exercise-picker.mjs", [], { seconds: 11 }),
    s("test/library-flow.mjs", [], { seconds: 21 }),
    s("test/custom-delete-editor-race.mjs", [], { seconds: 13 }),
    s("test/custom-mutation-recovery.mjs", [], { seconds: 34 }),
    s("test/performed-attribution.mjs"),
    s("test/program-import-review.mjs", [], { seconds: 27 }),
    s("test/program-freeform-import.mjs", [], { seconds: 11 }),
    s("test/import-matching.mjs"),
    s("test/program-day-names-browser.mjs"),
    s("test/muscle-domain-flow.mjs"),
    s("test/archived-muscle-immutability.mjs"),
    s("test/shared-setup-flow.mjs", [], { seconds: 31 }),
    s("test/entry-landing.mjs"),
    s("test/entry-chooser.mjs"),
    s("test/entry-expert-controls.mjs"),
    s("test/entry-install-policy.mjs"),
    s("test/entry-guides.mjs"),
    s("test/guide-eligibility.mjs"),
    s("test/program-actions.mjs"),
    s("test/settings-groups.mjs"),
    s("test/share-repair.mjs", [], { seconds: 44 }),
    s("test/privacy-ui.mjs", [], { domains: ["entry", "settings", "privacy"] }),
    s("test/privacy-share-flow.mjs", [], { domains: ["entry", "privacy"] }),
  ],
  workout: [
    s("test/i18n.mjs"),
    s("test/notifications.mjs", [], { seconds: 13 }),
    s("test/appearance.mjs"),
    s("test/ui-system.mjs", [], { domains: RENDERED_DOMAINS, cost: "normal", tier: "feedback", seconds: 13 }),
    s("test/direction-d-gate.mjs", [], { domains: RENDERED_DOMAINS, cost: "normal", tier: "feedback", seconds: 15 }),
    ...shards(UI_SYSTEM_SHARDS).map((shard) =>
      s("tools/check-ui-system.mjs", ["--shard", shard], { domains: RENDERED_DOMAINS, cost: "long", tier: "packet", timeoutMs: 900000, seconds: 300 })),
    s("test/accessibility.mjs", [], { seconds: 46 }),
    s("test/accessibility.mjs", ["--touch-targets-320"], { seconds: 2 }),
    s("test/history.mjs"),
    s("test/history-edit.mjs"),
    s("test/history-delete-replay.mjs"),
    s("test/history-persistence-race.mjs", [], { seconds: 2 }),
    s("test/today-done.mjs"),
    s("test/today-day-picker.mjs", [], { seconds: 16 }),
    s("test/today-week-line.mjs"),
    s("test/today-preview.mjs"),
    s("test/focus-mode.mjs", [], { seconds: 31 }),
    s("test/workout-draft-parity.mjs", [], { seconds: 17 }),
    s("test/focus-only-parity.mjs", [], { seconds: 23 }),
    s("test/focus-session-sheet.mjs"),
    s("test/workout-finish-boundary.mjs"),
    s("test/focus-exercise-actions.mjs"),
    s("test/focus-navigation.mjs"),
    s("test/focus-geometry.mjs", [], { seconds: 39 }),
    s("test/recommendation-parity.mjs"),
    s("test/management-summary.mjs"),
    s("test/summary-evidence.mjs"),
    s("test/progression-strategies-ui.mjs", [], { seconds: 10 }),
    s("test/progress-navigation.mjs"),
    s("test/progress-evidence.mjs", [], { seconds: 34 }),
    s("test/progress-lifecycle.mjs", [], {"env": {"REPFORGE_LIFECYCLE_BROWSER": "1"}, "timeoutMs": 900000, seconds: 10 }),
    s("test/progress-recovery.mjs", [], {"timeoutMs": 900000, seconds: 3 }),
    s("test/progress-guides.mjs"),
    s("test/sheet-swipe-dismiss.mjs", [], { seconds: 11 }),
    s("test/motion-integration.mjs", [], { seconds: 13 }),
    s("test/session-summary.mjs", [], { seconds: 19 }),
    s("test/simulation.mjs", ["--smoke"], { domains: ["workout", "progress", "history"], cost: "long", tier: "packet", timeoutMs: 900000, seconds: 7 }),
    s("test/simulation.mjs", [], {"env": {"REPFORGE_SIM_WEEKS": "52", "REPFORGE_PROFILE": "1"}, "timeoutMs": 900000, seconds: 305 }),
  ],
  privacy: [
    s("test/telemetry-runtime.mjs", [], { seconds: 18 }),
    s("test/telemetry-leakage.mjs"),
    s("test/install-transfer-telemetry.mjs"),
  ],
  visual: shards(VISUAL_SHARDS).map((shard) =>
    s("tools/capture-ui-screens.mjs", ["--verify", "--shard", shard], { domains: RENDERED_DOMAINS, cost: "long", tier: "candidate", timeoutMs: 900000, seconds: 260 })),
  service: [
    s("test/install-transfer-service.mjs", [], { timeoutMs: 1200000 }),
  ],
};

export const SUPPORT = {
  "test/entry-privacy.mjs": "Shared privacy characterization/oracles imported by the four scoped contracts.",
  "test/suites.mjs": "CI/local inventory, imported by tools/run-tests.mjs.",
  "test/browser.mjs": "Shared Playwright launcher and boot helpers.",
  "test/browser-artifacts.mjs": "Diagnostic-only tracing, imported by browser.mjs.",
  "test/program-entry-a11y.mjs": "runProgramEntryA11y is executed by accessibility.mjs.",
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
