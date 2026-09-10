/** Single inventory for local commands and CI. No test-file execution glob. */
const s = (file, args = [], extra = {}) => ({ file, args, ...extra });
export const SUITES = {
  fast: [
    s("test/ci.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/generative/self-test.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/shared-setup-unit.mjs"),
    s("test/program-day-names.mjs"),
    s("test/program-entry-fixture-services.mjs"),
    s("test/program-transition.mjs"),
    s("test/program-transition-recovery.mjs"),
    s("test/program-transition-compiler-provenance.mjs"),
    s("test/program-transition-siblings.mjs"),
    s("test/program-transition-volume.mjs"),
    s("test/install-transfer-client-contract.mjs"),
    s("test/install-transfer-client.mjs"),
    s("test/install-transfer-limits.mjs"),
    s("test/ui-plan-050-progress-fixture.mjs"),
    s("test/verification-recorder.mjs", [], {"nodeArgs": ["--test"]}),
    s("tools/check-production-syntax.mjs"),
    s("tools/check-test-syntax.mjs"),
    s("test/generative/run.mjs", ["--profile", "ci"]),
    s("test/program-entry.mjs"),
    s("test/program-entry-production-adapter.mjs"),
    s("test/program-compiler-plan048-preferences.mjs"),
    s("test/pr201-contracts.mjs"),
    s("test/ui-screens.mjs"),
    s("test/workout-draft.mjs"),
    s("test/workout-draft-migration.mjs"),
    s("test/schedule.mjs"),
    s("test/exercise-library.mjs"),
    s("test/progression-fixtures.mjs"),
    s("test/progression-engine.mjs"),
    s("test/progression-range-simulation.mjs"),
    s("test/progression-strategies-simulation.mjs"),
    s("test/vendor-runtimes.mjs"),
    s("test/telemetry-fixtures.mjs"),
    s("test/telemetry-unit.mjs"),
    s("test/posthog-adapter.mjs"),
    s("test/posthog-config.mjs"),
    s("test/telemetry-call-sites.mjs"),
    s("test/posthog-measurement.mjs", [], {"nodeArgs": ["--test"]}),
    s("test/motion-polish.mjs"),
    s("test/runtime-budget.mjs"),
    s("test/apple-design-followup.mjs"),
    s("tools/check-ui-screens.mjs"),
    s("test/manual-matrix.mjs", ["--self-test"]),
  ],
  state: [
    s("test/ci-browser.mjs"),
    s("test/program-entry-conflict-runtime.mjs"),
    s("test/sw-upgrade.mjs"),
    s("test/program-transition-sw-upgrade.mjs"),
    s("test/program-entry-rules-runtime.mjs"),
    s("test/persistence-artifacts.mjs", ["--self-test"]),
    s("test/persistence.mjs"),
    s("test/persistence-race.mjs"),
    s("test/thermonuclear-races.mjs"),
    s("test/program-transition-commit.mjs"),
    s("test/program-transition-volume-commit.mjs"),
    s("test/program-transition-crash-replay.mjs"),
    s("test/program-transition-backup.mjs"),
    s("test/program-transition-guided-repair.mjs"),
    s("test/program-block-identity.mjs"),
    s("test/program-transition-recovery-carrier.mjs"),
    s("test/program-transition-recovery-corruption.mjs"),
    s("test/program-transition-r7-boundary.mjs"),
    s("test/install-transfer-client-browser.mjs"),
    s("test/install-transfer-clone.mjs"),
    s("test/recover-gate.mjs"),
    s("test/workout-draft-storage.mjs"),
    s("test/workout-draft-sw-upgrade.mjs"),
    s("test/progression-strategies-offline.mjs"),
    s("test/adversarial-draft-transactions.mjs"),
    s("test/program-draft-conflicts.mjs"),
    s("test/program-draft-set-reduction.mjs"),
    s("test/program-draft-day-rename.mjs"),
    s("test/workout-day-context-discard.mjs"),
  ],
  entry: [
    s("test/program-entry-rules-recovery.mjs"),
    s("test/ui-plan-050-build-hierarchy.mjs"),
    s("test/ui-plan-050-editor.mjs"),
    s("tools/build-program-family-fixtures.mjs", ["--check"]),
    s("test/generative-entry-runtime.mjs"),
    s("test/program-family-fixtures.mjs"),
    s("test/program-compiler-persistence.mjs"),
    s("test/program-compiler-runtime.mjs"),
    s("test/program-entry-browser.mjs"),
    s("test/ui-catalog-contract.mjs"),
    s("test/install-modes.mjs"),
    s("test/onboarding-cancel.mjs"),
    s("test/program-editor-text-fields.mjs"),
    s("test/program-editor-drag-selection.mjs"),
    s("test/program-editor-sorting.mjs"),
    s("test/program-text-export.mjs"),
    s("test/exercise-picker.mjs"),
    s("test/library-flow.mjs"),
    s("test/performed-attribution.mjs"),
    s("test/program-import-review.mjs"),
    s("test/program-freeform-import.mjs"),
    s("test/import-matching.mjs"),
    s("test/program-day-names-browser.mjs"),
    s("test/shared-setup-flow.mjs"),
  ],
  workout: [
    s("test/i18n.mjs"),
    s("test/notifications.mjs"),
    s("test/appearance.mjs"),
    s("test/accessibility.mjs"),
    s("test/accessibility.mjs", ["--touch-targets-320"]),
    s("test/history.mjs"),
    s("test/today-done.mjs"),
    s("test/today-day-picker.mjs"),
    s("test/focus-mode.mjs"),
    s("test/workout-draft-parity.mjs"),
    s("test/recommendation-parity.mjs"),
    s("test/progression-strategies-ui.mjs"),
    s("test/sheet-swipe-dismiss.mjs"),
    s("test/motion-integration.mjs"),
    s("test/session-summary.mjs"),
    s("test/simulation.mjs", [], {"env": {"REPFORGE_SIM_WEEKS": "52", "REPFORGE_PROFILE": "1"}, "timeoutMs": 900000}),
  ],
  privacy: [
    s("test/telemetry-runtime.mjs"),
    s("test/telemetry-leakage.mjs"),
  ],
};

export const SUPPORT = {
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
export const BROWSER_LANES = new Set(["state", "entry", "workout", "privacy"]);

export function inventoryErrors(files, suites = SUITES, support = SUPPORT) {
  const errors = [];
  const commands = new Set();
  const ids = new Set();
  const scheduled = new Set();
  const available = new Set(files);
  for (const [lane, entries] of Object.entries(suites)) {
    if (!entries.length) errors.push(`Empty lane: ${lane}`);
    for (const entry of entries) {
      if (!available.has(entry.file)) errors.push(`Missing suite: ${entry.file}`);
      const command = JSON.stringify(commandArgs(entry));
      if (commands.has(command)) errors.push(`Duplicate command: ${command}`);
      commands.add(command);
      const id = suiteId(entry);
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
