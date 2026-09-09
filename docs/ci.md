# Test execution and CI

`test/suites.mjs` is the executable inventory for local work and
`.github/workflows/simulation.yml`. The workflow owns scheduling and provisioning;
it no longer duplicates the list of scripts. The app remains a static PWA. All
npm dependencies stay under `test/`; this change adds no dependencies.

## Run locally

```sh
(cd test && npm ci && npx playwright install --with-deps --only-shell chromium)
node tools/run-tests.mjs --check
node tools/run-tests.mjs fast
node scripts/generate-posthog-config.mjs
python3 -m http.server 8000
# In another terminal:
node tools/run-tests.mjs all
# Or a lane / one existing script:
node tools/run-tests.mjs state
node tools/run-tests.mjs entry --suite program-editor-sorting
node tools/run-tests.mjs all --list
```

The fast lane needs npm dependencies, but not an installed browser or server.
The inventory checks every tracked or unignored test script: runnable suites
must be scheduled; imported helpers and manual screenshot utilities have explicit
reasons in `SUPPORT`. Do not execute a filesystem glob or add the same command in
another workflow. The inventory currently contains 107 commands: fast (40),
state (25), entry (24), workout (16), and privacy (2). The PostHog measurement
contract runs once in the fast lane as `node --test test/posthog-measurement.mjs`.
Add property modules to the generative runner's inventory; its self-test rejects
orphaned modules.

## Jobs and compatibility

| Job/check | Responsibility |
| --- | --- |
| `interaction-runtime` | Fast contracts, syntax, generative properties, recorder self-tests and catalog integrity. The historical check name is preserved. |
| `browser (state)` | Persistence, recovery, draft transactions, cross-tab races and worker upgrades. |
| `browser (entry)` | Program compilation, import/share, onboarding, editor and entry UI. |
| `browser (workout)` | Browser i18n, workout interaction, accessibility, progression, history and the complete 52-week simulation. |
| `telemetry-privacy` | Runtime event meaning and hostile-sentinel leakage, not screenshots. Pure telemetry contracts are in the fast job. |
| `visual-evidence` | Selected capture, registration, perceptual and semantic comparison. |
| `verification-evidence` | Compatibility alias for the fast job, not a second recorder execution. |
| `simulation` | Aggregate gate; every dependency must succeed. Failed, cancelled or unexpectedly skipped jobs cannot produce a green aggregate. |

Browser lanes run on separate runners, with one script at a time per lane.
This preserves test isolation, avoids local CPU contention and lets unrelated
lanes finish after a failure (`fail-fast: false`). There is no job per test file.
Headless-only Chromium avoids downloading the unused headed browser; npm's
lockfile cache remains in use. Test counts and the simulation's 52-week history
are not reduced. Browser jobs retain full checkout history conservatively until
all legacy history consumers have been reconciled.

The two former single-purpose workflows are folded into Simulation. Existing
job/check names are retained to reduce branch-protection disruption. Check the
repository's required checks before merging: workflow-specific organization rules
or deployment configuration are not changed by this PR. Prefer the aggregate
`simulation` gate for future required-check configuration.

## Visual scheduling policy

This changes **CI scheduling**, not the requirement in `AGENTS.md` to regenerate
and commit screenshots with a user-visible change. Registration and comparator
self-tests remain in the fast lane. Fresh rendered evidence is separate from
privacy and follows these conservative rules:

- Only explicitly allowlisted Markdown prose changed: skip fresh captures and
  browser installation in the visual job, with an explicit scope summary.
- Only registered PNG baselines and prose changed: recapture **every variant** of
  each affected screen; compare against an immutable snapshot of the whole
  committed catalog, including semantic evidence.
- Application code, CSS, translations, fixtures, harness/tooling, manifest,
  semantic evidence, unknown paths, an unavailable comparison base, or a manual
  workflow run: regenerate and compare the **full catalog**.

There is no guessed dependency graph and no `paths-ignore` workflow that leaves
a required check pending. Global changes cannot select a convenient subset.
Renames include both old and new paths. Thresholds, overflow checks, release
variants and semantic comparison are unchanged.

## Failures and performance evidence

Every script writes its command, initial result, duration and bounded stdout /
stderr under `.ci-results/<lane>/`. Reports are updated after each script, not
only at successful job completion. The runner continues after a failing script.
Per-script timeouts terminate the process group, including abandoned browsers.
GitHub summaries show timings; artifacts upload with `if: always()` and expire
after seven days. `.ci-results/` is ignored by git.

Normal browser execution does not record traces. In CI, a failing browser script
is replayed once with diagnostic tracing (`REPFORGE_DIAGNOSTIC_REPLAY=1`). The
**initial failure remains authoritative even if the replay passes**. This is not
a retry-to-green policy. Both outcomes are recorded, exposing potential flakes.
Timed-out or cancelled scripts are not replayed. Successful runs pay no tracing
cost. For a targeted local trace:

```sh
REPFORGE_TRACE=1 node tools/run-tests.mjs entry --suite program-editor-sorting
```

The shared launcher writes page screenshots, bounded console/page-error records
and traces before context/browser closure on a trace run. Abrupt process exits
or killed browsers may prevent a complete trace; the original logs and result
remain. Fixtures are synthetic. Do not point diagnostic runs at a real user's
workout database or production telemetry configuration. The privacy fixture
intercepts `posthog-config.js` as well as its fake SDK, so a generated local
preview config cannot overwrite the fixture or redirect its requests. Its SDK
failure case also proves that a load was actually attempted.

On visual failure, retain the immutable baseline and current catalog alongside
capture/comparison logs. `visual-status.txt` distinguishes a successful fresh
capture from a failed transactional capture that left committed images untouched.
The existing capture tool's frame retries are unchanged and remain visible in
its log; no comparison failure is retried away.

Property runs now shrink failures with a bounded per-property budget. Budget
interruptions fail rather than passing a partially sampled property. Output
includes the master seed, suite seed, minimized counterexample, path and exact
`--property` replay command. `--filter` remains useful for exploration; `--path`
requires an exact property and seed. Seed zero is valid. Profile sample counts
remain 100 / 300 / 1,000 / 5,000.

## Coverage reconciliation and limits

Every directly scheduled test command from revision `ae6f7dc` is retained, with
these intentional deduplications: vendor pin verification is already invoked
inside `vendor-runtimes.mjs`; `exercise-library.mjs` and the vendor suite run once;
the recorder's self-test runs once rather than inside a separate workflow wrapper.
Syntax checking also covers nested generative, fixture, tool and script files
missed by the old shallow glob.

Previously orphaned standalone suites are now explicit: shared-setup unit and
flow tests, program day-name unit/browser tests, entry fixture-service and
rules-recovery tests, and the existing Plan 050 focused UI/fixture tests. Entry
accessibility is imported and executed by `accessibility.mjs`, not run twice.
No historical scenario is deleted merely because a focused suite overlaps it.
The restored shared-link suite reads visible preview content instead of the
removed review-grid layout selector. Expected concurrent-head rejections wait
for the conflict notice, not five swallowed ten-second success timeouts; their
no-partial-write and replica-equality assertions still run. Unexpected activation
timeouts now fail, and duration checks also require the expected day count.

Motion vocabulary values and live reduced-motion/disposal behavior are read from
the actual exported layer in a small VM fixture instead of relying on declaration
spacing or property order. Boundary/source guards, offline pins, physics limits,
translated drag announcements and modal contracts remain.

This architecture reduces serial waiting and unrelated capture work; it does not
assert an unmeasured speedup or claim lower billed runner-minutes. More independent
jobs trade some setup overhead for faster feedback. Use the per-suite reports to
rebalance lanes and identify measured overlap before deleting regressions. This
remains Chromium automation, not physical-device iOS or Android validation.
