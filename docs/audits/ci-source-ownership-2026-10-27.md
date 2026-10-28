# Source ownership refinement — 2026-10-27

## Why and what was reviewed

After the 2026-10-27 CI audit (64 distinct recent PR branches, 27 with modern full-lane plans, 22 selecting all), inspected current production app.js and styles.css at main SHA 2cc12e15 and the actual changed-file lists/patches of PRs #499–#513. The full-run planner uses conservative @ci-domain ownership; this refinement adds ONLY specific boundaries supported by UI function and selector ownership.

- app.js: the block-review legacy panel and schedule/recovery diagnosis rendering/actions, through bindFlowCancel, map to progress, history, entry and program. The subsequent transition/commit operations are restored to global, because changing them affects activated training programs beyond the panel itself.
- styles.css: Program/editor-specific rules from the Program heading to (but not including) the bottom navigation dock map to program, entry and library. The installed Program editor, onboarding editor and pushed library surface share these layout rules.
- styles.css: onboarding entry card/choice styling maps to entry and program. The generic disabled radio state in the middle remains global, as does the exercise-detail header at the end. The immediately preceding settings controls remain global.
- Deliberately NOT scoped: design tokens, nav/dock, generic control states, exercise picker/search helpers and shared exercise media; the exercise media helper is also used by exercise detail accessible from Progress and History.

There is no behavioral CSS/JS change: added comments are understood only by the existing CI diff mapper. The source-owning code, test inventory, runner allocation, visual baseline and accepted two-lane design remain unchanged.

## Measured selector impact (NOT observed CI run time)

Replayed representative synthetic one-hunk modifications at exact present-day source anchors through the production full-lane selector. Exhaustive reference: 122 full-lane commands.

| Representative changed region | Selection | Commands | Catalog states |
| --- | --- | ---: | ---: |
| Block-review panel or diagnosis (app.js) | selected | 78 | 142 |
| Program/editor rules (styles.css) | selected | 65 | 107 |
| Onboarding entry choices (styles.css) | selected | 64 | 102 |
| Shared nav dock or root design tokens (styles.css) | all | 122 | all |
| Shared exercise-media/picker helper or init() (app.js) | all | 122 | all |

A review+entry edit across the two annotated files stays targeted. A mixed shared+scoped edit widens. Moving an annotation also widens. Expected wall-clock improvements depend on actual shard occupancy, selected screens, and other changed files; the counts above are NOT a benchmark.

## Historical counterfactuals and limits

Historical PR #513 altered the block-review panel and onboarding CSS, but also changed tools/ui-screens/screens-app.mjs (the capture harness). The complete lane remains mandatory, **even if the source edits had these markers**. PR #510 also changed shared design tokens, and PRs #508/#503 modified the shared motion layer, so these runs would also remain all-lane. PR #509 touched the app boot/init function, and PR #511 changed generic controls; both correctly remain all-lane.

This refinement is therefore a bounded investment in future focused Program/Entry/Review PRs, **not evidence of retroactive CI minutes saved in the recent sample**. Do not relax remaining unannotated blocks solely to boost targeting ratios. Source ownership should be re-reviewed as UI dependencies evolve.

## Verification

The regression test in test/ci.mjs pins ownership at real production anchors and verifies fail-open behavior around each boundary, mixed hunks, and capture-harness changes. Run node --test test/ci.mjs and node tools/run-tests.mjs --check. Main/nightly remain exhaustive by policy. Previous boundary-deletion fix is separately proposed in PR #531, and may require test/docs conflict reconciliation at merge.
