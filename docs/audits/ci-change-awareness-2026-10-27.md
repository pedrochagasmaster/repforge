# CI change-awareness evidence — 2026-10-27

## Sample and limitations

Read-only GitHub Actions audit of the most recent CI run for **64 distinct PR head branches** observed in three pages of recent PR-triggered workflow history (2026-10-20 through 2026-10-27). For each, the plan job's own log and, where available, browser-job start/completion timestamps were inspected. **27** of the 64 runs exposed the current targeted-full-lane plan format: **22 full**, **4 targeted**, **1 none**. The other 37 predated this format or had no parseable plan classification and are excluded from that denominator.

This is a convenience sample, not a representative random sample of PRs. It includes experiments, failed runs, and unmerged PRs. One run per branch avoids repeatedly counting revisions of the same work; observed runner-second totals are not end-to-end latency. The planner reports only its **first** reason for an all-lane decision, not proof that removing that reason alone would reduce scope.

## Observed causes and reviewed disposition

- Unannotated app.js/styles.css changes and motion-layer.js frequently widened the selection. These are shared or potentially cross-flow changes; **do not relax them** without source-level ownership proof.
- Changes to the catalog manifest, entry semantics, localization, and test infrastructure also widened selection. The three onboarding PRs where docs/ui-screens/entry-semantics.json was the first reason also changed docs/ui-screens/manifest.json, i18n*, test/browser.mjs and/or role inventory. Narrowing semantics alone would not save those runs.
- [PR #504](https://github.com/pedrochagasmaster/repforge/pull/504) changed **63 files**, all under docs/design/; its HTML/CSS/JS demos and before/after PNG comparisons live under docs/design/native-fidelity-mocks/. Inspection found no imports of that directory from production code, scheduled tests, or CI. The planner nevertheless selected **full** solely because the first PNG was not classified.

[PR #504's CI run](https://github.com/pedrochagasmaster/repforge/actions/runs/40116733451), October 24:
- Full-browser: **12 jobs, 13,608 runner-seconds** (sum of completed-job elapsed durations).
- PR-browser: **5 jobs, 2,258 runner-seconds**.
- Combined browser time: **15,866 runner-seconds** (4h 24m 26s of aggregate runner occupation); excludes other jobs.
- Workflow elapsed from run start to last update: approximately **46 minutes**. This is not a controlled before/after comparison.

The new mapping treats **only** docs/design/native-fidelity-mocks/ as non-production documentation, across the PR gate, full-lane gate, local selector and visual selector. A replay of all 63 changed paths from PR #504 now yields PR gate **skip**, full lane **none**, local **none**, visual **none**. Other design HTML/JS, docs/ui-screens/, unknown source paths and all production changes remain conservative.

## Decision and verification

This is a narrowly evidenced exclusion, not a general license to skip checks for files under docs/. It does not change the accepted two-lane architecture, test inventory, or main/nightly/full verification policy. Revisit the exception if any production or scheduled test starts importing the mock gallery. Future optimization of app.js or CSS needs an explicit before/after impact trace, not filename-based guesswork.

Verification: node --test test/ci.mjs (56/56), node tools/run-tests.mjs --check (106 PR + 122 full commands, complete inventory), git diff --check, and the historical 63-path replay. This is a change-selection proof; actual savings remain to be measured on a subsequent gallery-only PR.
