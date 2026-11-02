/** Single inventory for local commands and CI. No test-file execution glob. */
const DOMAIN_VOCABULARY = new Set(["shell", "entry", "program", "history", "today", "workout", "progress", "settings", "library", "install", "persistence", "transition", "privacy", "telemetry", "offline", "service", "global"]);
const COST_VOCABULARY = new Set(["tiny", "normal", "long"]);
const TIER_VOCABULARY = new Set(["feedback", "packet", "candidate"]);
/**
 * Two lanes (docs/test-suite-redesign.md, "Fast PRs, full on main"):
 *  - SUITES is the pull-request inventory: risk-based module contracts, the
 *    browser protocol journeys and the 21-frame critical UI matrix. The `ci`
 *    workflow runs it on every PR head and every push to main.
 *  - FULL_SUITES is everything else that main keeps: the exhaustive catalog
 *    verify, the role/contrast and Direction-D audits over every rendered
 *    state, the year-long simulation and the retired dedicated permutations.
 *    The `ci-full` workflow runs it on every push to main, nightly and on
 *    demand; a failure there is a red check on main.
 * Shard counts are inventory facts: each lane's browser commands are packed
 * across CI_SHARDS / FULL_SHARDS balanced runners, and the two catalog sweeps
 * are split into UI_SYSTEM_SHARDS / VISUAL_SHARDS commands so no single command
 * dominates a shard. `seconds` is the measured wall time on ubuntu-latest and
 * only drives shard balancing; a missing value falls back on `cost`.
 */
export const CI_SHARDS = 5;
export const FULL_SHARDS = 12;
export const UI_SYSTEM_SHARDS = 8;
/* The slowest measured cost of one UI-system render on ubuntu-latest: 6.42 s
 * across 42 green `--shard k/7` runs on 2026-10-29 (#456), rounded up.
 * test/ci.mjs holds every shard's states × this cost under 85% of its
 * timeout, so the shard count rises before the catalog outgrows the budget. */
export const UI_SYSTEM_STATE_SECONDS = 6.5;
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
  "fast": [
    s("test/ci.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/privacy-contract.mjs", [], {"domains": ["privacy"], "cost": "tiny", "tier": "feedback"}),
    s("test/pages-deploy-boundary.mjs", [], {"domains": ["privacy", "offline"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/generative/self-test.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "nodeArgs": ["--test"]}),
    s("test/shared-setup-unit.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback"}),
    s("test/program-day-names.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-day-move-shape.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
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
    s("test/program-generation-parity.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-periodization.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-source-matrix.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/generation-source-dose-boundaries.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-compiler-plan067.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback"}),
    s("test/program-compiler-search.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 10}),
    s("test/programlab-default-parity.mjs", [], { domains: ["program"], seconds: 40 }),
    s("test/programlab-native-policy.mjs", [], { domains: ["program"], seconds: 3 }),
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
    s("test/programlab-store.mjs", [], { domains: ["program", "persistence", "privacy"], seconds: 2 }),
    s("test/privacy-offline.mjs", [], {"domains": ["privacy", "offline"], "cost": "normal", "tier": "packet", "seconds": 3}),
    s("test/sw-upgrade.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 9}),
    s("test/sw-error-responses.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 6}),
    s("test/sw-launch-redirect.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 11}),
    s("test/install-transfer-sw-upgrade.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 8}),
    s("test/program-transition-sw-upgrade.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 11}),
    s("test/persistence.mjs", [], {"domains": ["persistence"], "cost": "normal", "tier": "feedback", "seconds": 46}),
    s("test/persistence-race.mjs", [], {"domains": ["persistence"], "cost": "long", "tier": "candidate", "seconds": 10}),
    s("test/thermonuclear-races.mjs", [], {"domains": ["global"], "cost": "long", "tier": "candidate", "seconds": 59}),
    s("test/program-transition-commit.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 62}),
    s("test/program-transition-crash-replay.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 250, "timeoutMs": 1200000}),
    s("test/program-transition-backup.mjs", [], {"domains": ["program", "transition"], "cost": "normal", "tier": "feedback", "seconds": 18}),
    s("test/install-transfer-client-browser.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 5}),
    s("test/install-transfer-import.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 201}),
    s("test/install-transfer-ui.mjs", [], {"domains": ["install"], "cost": "normal", "tier": "feedback", "seconds": 27}),
    s("test/workout-draft-storage.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 83}),
    s("test/draftv2-staged-cas.mjs", [], {"domains": ["persistence"], "cost": "normal", "tier": "feedback", "seconds": 26}),
    s("test/workout-draft-sw-upgrade.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 8}),
    s("test/adversarial-draft-transactions.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 42}),
  ],
  "entry": [
    s("test/program-entry-s4.mjs", [], {"domains": ["entry", "program", "today", "workout", "persistence"], "cost": "normal", "tier": "feedback", "seconds": 43}),
    s("test/program-engine-worker.mjs", [], {"domains": ["entry", "program", "offline"], "cost": "normal", "tier": "feedback", "seconds": 36}),
    s("test/per-side-engine-browser.mjs", [], {"domains": ["workout", "program", "persistence"], "cost": "normal", "tier": "packet", "seconds": 9, "timeoutMs": 900000}),
    s("test/per-side-engine-bodyweight-browser.mjs", [], {"domains": ["workout", "program", "persistence"], "cost": "normal", "tier": "packet", "seconds": 14, "timeoutMs": 900000}),
    s("test/per-side-execution-mode-capture-browser.mjs", [], {"domains": ["entry", "workout", "history", "persistence"], "cost": "normal", "tier": "packet", "seconds": 20, "timeoutMs": 900000}),
    s("test/catalog-metric-program-browser.mjs", [], {"domains": ["entry", "workout", "history", "persistence"], "cost": "long", "tier": "candidate", "seconds": 31, "timeoutMs": 900000}),
    s("test/program-editor-text-fields.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 18}),
    s("test/program-editor-a.mjs", [], {"domains": ["program", "workout", "persistence"], "cost": "normal", "tier": "feedback", "seconds": 24}),
    s("test/program-editor-a-days.mjs", [], {"domains": ["program", "today", "persistence"], "cost": "normal", "tier": "feedback", "seconds": 11}),
    s("test/custom-mutation-recovery.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 95}),
    s("test/program-import-review.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 66}),
    s("test/program-freeform-import.mjs", [], {"domains": ["program"], "cost": "normal", "tier": "feedback", "seconds": 130}),
    s("test/shared-setup-flow.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 95}),
  ],
  "workout": [
    s("test/ui-system.mjs", [], {"domains": ["shell", "entry", "program", "history", "today", "workout", "progress", "settings", "library", "install"], "cost": "normal", "tier": "feedback", "seconds": 124}),
    s("test/ui-system-checker.mjs", [], {"domains": RENDERED_DOMAINS, "cost": "normal", "tier": "feedback", "seconds": 50}),
    s("test/native-feel.mjs", [], {"domains": ["shell", "today", "workout"], "cost": "normal", "tier": "feedback", "seconds": 291}),
    s("test/guide-modal.mjs", [], {"domains": ["workout", "progress", "settings", "entry"], "cost": "normal", "tier": "feedback", "seconds": 43}),
    s("test/history-delete-replay.mjs", [], {"domains": ["history"], "cost": "normal", "tier": "feedback", "seconds": 13}),
    s("test/focus-pending-field.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 67}),
    s("test/workout-draft-parity.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 53}),
    s("test/workout-finish-boundary.mjs", [], {"domains": ["workout"], "cost": "normal", "tier": "feedback", "seconds": 8}),
    s("test/management-summary.mjs", [], {"domains": ["global"], "cost": "normal", "tier": "feedback", "seconds": 3}),
    s("test/progress-lifecycle.mjs", [], {"domains": ["progress"], "cost": "long", "tier": "candidate", "env": {"REPFORGE_LIFECYCLE_BROWSER": "1"}, "timeoutMs": 900000, "seconds": 23}),
    s("test/progress-recovery.mjs", [], {"domains": ["progress"], "cost": "long", "tier": "candidate", "timeoutMs": 900000, "seconds": 7}),
  ],
  "privacy": [
    s("test/telemetry-leakage.mjs", [], {"domains": ["telemetry"], "cost": "normal", "tier": "feedback", "seconds": 3}),
  ],
  "service": [
    s("test/install-transfer-service.mjs", [], {"domains": ["install", "service"], "cost": "normal", "tier": "feedback", "timeoutMs": 1200000}),
  ],
};

/**
 * The full lane. Lanes are named apart from SUITES so local selection never
 * mistakes a full-only command for PR evidence; `full-browser` is sharded by
 * `node tools/run-tests.mjs full-shard k/n`. A command lives in exactly one of
 * SUITES or FULL_SUITES.
 */
export const FULL_SUITES = {
  "full-fast": [
    s("test/runtime-budget.mjs"),
    s("tools/check-design-md.mjs", [], { domains: ["shell"], cost: "tiny" }),
    s("test/landing-demo-copy.mjs", [], { domains: ["entry"], cost: "tiny" }),
    s("test/manual-matrix.mjs", ["--self-test"]),
    s("test/programlab-domain.mjs", [], { domains: ["program", "persistence"] }),
    s("test/programlab-archive.mjs", [], { domains: ["program", "persistence"] }),
    s("test/programlab-package.mjs", [], { domains: ["program", "privacy"] }),
    s("test/programlab-archive-limits.mjs", [], { nodeArgs: ["--max-old-space-size=8192"], domains: ["program", "persistence"], cost: "long", tier: "candidate", seconds: 45 }),
  ],
  "full-browser": [
    s("test/programlab-ui.mjs", [], { domains: ["program", "persistence", "privacy"], seconds: 103 }),
    s("test/programlab-ui.mjs", ["--shell"], { domains: ["program", "privacy"], seconds: 3 }),
    s("test/programlab-ui.mjs", ["--corpus"], { domains: ["program", "persistence", "privacy"], cost: "long", tier: "candidate", seconds: 26, timeoutMs: 1000000 }),
    s("test/ci-browser.mjs", [], { seconds: 1 }),
    s("test/program-entry-conflict-runtime.mjs", [], { seconds: 6 }),
    s("test/landing-offline.mjs", [], { seconds: 5 }),
    s("test/program-entry-rules-runtime.mjs", [], { seconds: 5 }),
    s("test/persistence-artifacts.mjs", ["--self-test"], { seconds: 3 }),
    s("test/program-block-identity.mjs", [], { seconds: 33 }),
    s("test/program-transition-review-browser.mjs", [], { domains: ["transition", "progress", "persistence"], seconds: 77 }),
    s("test/install-transfer-clone.mjs", [], { seconds: 12 }),
    s("test/install-handoff-redirect.mjs", [], { domains: ["install", "privacy"], seconds: 7 }),
    s("test/program-draft-conflicts.mjs", [], { seconds: 61 }),
    s("test/program-draft-set-reduction.mjs", [], { seconds: 15 }),
    s("test/program-draft-day-rename.mjs", [], { seconds: 55 }),
    s("test/workout-day-context-discard.mjs", [], { seconds: 9 }),
    s("test/program-entry-rules-recovery.mjs", [], { seconds: 39 }),
    s("test/program-entry-picker-contract.mjs", [], { domains: ["entry", "persistence"], seconds: 21 }),
    s("test/ui-plan-050-build-hierarchy.mjs", [], { domains: ["entry", "program"], seconds: 27 }),
    s("test/ui-plan-050-editor.mjs", [], { domains: ["entry", "program"], seconds: 13 }),
    s("test/generative-entry-runtime.mjs", [], { seconds: 68 }),
    s("test/generate-program-browser.mjs", [], { domains: ["entry", "persistence"], seconds: 390 }),
    s("test/adaptive-workout-browser.mjs", [], { domains: ["workout", "program", "persistence"], seconds: 12 }),
    s("test/per-side-engine-transfer-browser.mjs", [], { domains: ["install", "workout", "persistence"], tier: "packet", seconds: 14, timeoutMs: 900000 }),
    s("test/session-duration-browser.mjs", [], { domains: ["workout", "history", "install", "persistence"], seconds: 20, timeoutMs: 900000 }),
    s("test/per-side-focus-cues-browser.mjs", [], { domains: ["workout", "program", "persistence"], tier: "packet", seconds: 22, timeoutMs: 900000 }),
    s("test/share-program-browser.mjs", [], { domains: ["entry", "privacy", "persistence"], seconds: 25 }),
    s("test/ui-catalog-contract.mjs", [], { seconds: 24 }),
    s("test/install-modes.mjs", [], { seconds: 115 }),
    s("test/onboarding-cancel.mjs", [], { domains: ["entry"], seconds: 16 }),
    s("test/program-editor-drag-selection.mjs", [], { seconds: 4 }),
    s("test/program-editor-sorting.mjs", [], { seconds: 17 }),
    s("test/program-editor-setup-conflict.mjs", [], { seconds: 10 }),
    s("test/adaptive-build-opt-in.mjs", [], { domains: ["entry", "program", "workout", "persistence"], tier: "packet", seconds: 14, timeoutMs: 900000 }),
    s("test/adaptive-build-opt-out.mjs", [], { domains: ["entry", "program", "workout", "persistence"], tier: "packet", seconds: 15, timeoutMs: 900000 }),
    s("test/adaptive-build-share.mjs", [], { domains: ["entry", "program", "persistence"], tier: "packet", seconds: 23, timeoutMs: 900000 }),
    s("test/program-text-export.mjs", [], { seconds: 4 }),
    s("test/exercise-picker.mjs", [], { domains: ["program", "library", "workout"], seconds: 19 }),
    s("test/library-flow.mjs", [], { seconds: 29 }),
    s("test/library-picker-spacing.mjs", [], { domains: ["library"], seconds: 20 }),
    s("test/progress-tabs.mjs", [], { domains: ["progress"], seconds: 25 }),
    s("test/program-goal-label.mjs", [], { domains: ["program"], seconds: 30 }),
    s("test/custom-delete-editor-race.mjs", [], { domains: ["program", "library"], seconds: 34 }),
    s("test/performed-attribution.mjs", [], { domains: ["workout", "history", "progress"], seconds: 12 }),
    s("test/import-matching.mjs", [], { domains: ["entry", "program", "library"], seconds: 2 }),
    s("test/program-day-names-browser.mjs", [], { seconds: 7 }),
    s("test/muscle-domain-flow.mjs", [], { domains: ["entry", "program", "progress"], seconds: 39 }),
    s("test/archived-muscle-immutability.mjs", [], { domains: ["program", "progress", "library"], seconds: 7 }),
    s("test/entry-landing.mjs", [], { seconds: 68 }),
    s("test/landing-variants.mjs", [], { domains: ["entry"], seconds: 82 }),
    s("test/landing-features.mjs", [], { domains: ["entry"], seconds: 40 }),
    s("test/boot-first-paint.mjs", [], { domains: ["shell", "entry", "today", "offline"], seconds: 45 }),
    s("test/journeys-in.mjs", [], { domains: ["entry", "today", "workout", "progress", "transition"], seconds: 32 }),
    s("test/landing-proof-capture.mjs", [], { domains: ["entry"], seconds: 97 }),
    s("test/entry-chooser.mjs", [], { seconds: 15 }),
    s("test/entry-install-policy.mjs", [], { seconds: 12 }),
    s("test/entry-guides.mjs", [], { seconds: 6 }),
    s("test/guide-eligibility.mjs", [], { seconds: 3 }),
    s("test/program-actions.mjs", [], { seconds: 10 }),
    s("test/settings-groups.mjs", [], { seconds: 3 }),
    s("test/privacy-ui.mjs", [], { domains: ["entry", "settings", "privacy"], seconds: 10 }),
    s("test/privacy-share-flow.mjs", [], { domains: ["entry", "privacy"], seconds: 3 }),
    s("test/journeys-out.mjs", [], { domains: ["entry", "settings", "install", "privacy", "transition"], seconds: 48 }),
    s("test/journeys-out.mjs", ["--seeded"], { domains: ["entry", "settings", "install", "privacy", "transition"], seconds: 10 }),
    s("test/i18n.mjs", [], { seconds: 3 }),
    s("test/notifications.mjs", [], { domains: ["today", "settings"], seconds: 39 }),
    s("test/appearance.mjs", [], { seconds: 17 }),
    s("test/direction-d-gate.mjs", [], { domains: RENDERED_DOMAINS, cost: "normal", tier: "feedback", seconds: 333 }),
    s("test/rules-only-gate.mjs", [], { domains: RENDERED_DOMAINS, cost: "normal", tier: "feedback", seconds: 53 }),
    s("test/accessibility.mjs", [], { seconds: 144 }),
    s("test/accessibility.mjs", ["--touch-targets-320"], { seconds: 4 }),
    s("test/history.mjs", [], { seconds: 10 }),
    s("test/per-side-reading-browser.mjs", [], { domains: ["history", "progress", "workout"], tier: "packet", seconds: 21, timeoutMs: 900000 }),
    s("test/per-side-completion-summary-browser.mjs", [], { domains: ["workout", "history", "progress"], seconds: 79 }),
    s("test/history-edit.mjs", [], { seconds: 42 }),
    s("test/history-persistence-race.mjs", [], { seconds: 5 }),
    s("test/today-done.mjs", [], { seconds: 19 }),
    s("test/today-day-picker.mjs", [], { seconds: 33 }),
    s("test/today-week-line.mjs", [], { seconds: 4 }),
    s("test/today-no-draft.mjs", [], { seconds: 6 }),
    s("test/today-sticky-start.mjs", [], { seconds: 19 }),
    s("test/today-live-card.mjs", [], { domains: ["today", "workout"], seconds: 20 }),
    s("test/minibar.mjs", [], { domains: ["today", "workout", "shell"], seconds: 25 }),
    s("test/rest-timer.mjs", [], { domains: ["workout"], seconds: 25 }),
    s("test/shell-chrome-clearance.mjs", [], { domains: ["shell", "today", "progress", "history", "program"], seconds: 83 }),
    s("test/focus-mode.mjs", [], { domains: ["workout"], seconds: 76 }),
    s("test/focus-only-parity.mjs", [], { domains: ["workout"], seconds: 60 }),
    s("test/focus-session-sheet.mjs", [], { domains: ["workout"], seconds: 32 }),
    s("test/focus-exercise-actions.mjs", [], { domains: ["workout"], seconds: 11 }),
    s("test/slot-alternates.mjs", [], { domains: ["program", "workout", "history"], seconds: 24 }),
    s("test/focus-navigation.mjs", [], { domains: ["workout"], seconds: 7 }),
    s("test/focus-geometry.mjs", [], { domains: ["workout"], seconds: 172 }),
    s("test/choice-rows-large-text.mjs", [], { domains: ["entry", "progress", "program"], seconds: 120 }),
    s("test/focus-space-summary.mjs", [], { domains: ["workout"], seconds: 124 }),
    s("test/manual-load-carry.mjs", [], { domains: ["workout"], seconds: 8 }),
    s("test/prefill-last-set.mjs", [], { domains: ["workout"], seconds: 60 }),
    s("test/summary-evidence.mjs", [], { domains: ["workout", "progress"], seconds: 5 }),
    s("test/why-sheet.mjs", [], { domains: ["workout"], seconds: 23 }),
    s("test/focus-hero.mjs", [], { domains: ["workout"], seconds: 60 }),
    s("test/why-verb-locale.mjs", [], { domains: ["workout"], seconds: 48 }),
    s("test/progress-navigation.mjs", [], { seconds: 15 }),
    s("test/progress-evidence.mjs", [], { seconds: 56 }),
    s("test/progress-guides.mjs", [], { seconds: 7 }),
    s("test/sheet-swipe-dismiss.mjs", [], { seconds: 31 }),
    s("test/motion-integration.mjs", [], { seconds: 195 }),
    s("test/session-summary.mjs", [], { domains: ["workout", "today", "history", "progress"], seconds: 57 }),
    s("test/exercise-display-name.mjs", [], { domains: ["workout", "history", "progress", "program", "today", "entry"], seconds: 74 }),
    s("test/simulation.mjs", ["--smoke"], { domains: ["workout", "progress", "history"], cost: "long", tier: "packet", timeoutMs: 900000, seconds: 42 }),
    s("test/simulation.mjs", [], {"domains": ["workout", "progress", "history"], "env": {"REPFORGE_SIM_WEEKS": "52", "REPFORGE_PROFILE": "1"}, "timeoutMs": 900000, seconds: 734 }),
    s("test/telemetry-runtime.mjs", [], { seconds: 174 }),
    s("test/install-transfer-telemetry.mjs", [], { seconds: 4 }),
    ...shards(UI_SYSTEM_SHARDS).map((shard) =>
      s("tools/check-ui-system.mjs", ["--shard", shard], { domains: RENDERED_DOMAINS, cost: "long", tier: "packet", timeoutMs: 900000, seconds: 680 })),
    ...shards(VISUAL_SHARDS).map((shard) =>
      s("tools/capture-ui-screens.mjs", ["--verify", "--shard", shard], { domains: RENDERED_DOMAINS, cost: "long", tier: "candidate", timeoutMs: 900000, seconds: 480 })),
  ],
};

export const SUPPORT = {
  "test/entry-privacy.mjs": "Shared privacy characterization/oracles imported by the four scoped contracts.",
  "test/suites.mjs": "CI/local inventory, imported by tools/run-tests.mjs.",
  "test/browser.mjs": "Shared Playwright launcher and boot helpers.",
  "test/redirect-host.mjs": "Loopback host with the production /index.html redirect, imported by the launch-redirect suites.",
  "test/adaptive-build-fixture.mjs": "Plan 069 S4 Build program fixtures through the real entry hub and editors.",
  "test/browser-artifacts.mjs": "Diagnostic-only tracing, imported by browser.mjs.",
  "test/program-entry-a11y.mjs": "runProgramEntryA11y is executed by ui-system.mjs (PR) and accessibility.mjs (full).",
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
export const BROWSER_LANES = new Set(["state", "entry", "workout", "privacy", "full-browser"]);
/** Every lane a suite can run in: the pure-Node lanes and the browser lanes. A lane outside it is a typo or a retired
 *  lane (#462), never "no browser needed". */
export const KNOWN_LANES = new Set(["fast", "service", "full-fast", ...BROWSER_LANES]);
/** Both lanes, for classification and local selection; CI runs each lane on its own. */
export const INVENTORY = { ...SUITES, ...FULL_SUITES };
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

export function inventoryErrors(files, suites = INVENTORY, support = SUPPORT) {
  const errors = [];
  const commands = new Set();
  const ids = new Set();
  const scheduled = new Set();
  const available = new Set(files);
  const executableLanes = KNOWN_LANES;
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
