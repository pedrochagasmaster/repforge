# Plan 064 reconciliation record

The working record for [Plan 064](../../plans/064-unified-redesign-convergence.md)
slice R0. It pins the sources the unified redesign consumes, re-derives the
surface treatment table from the live manifest, and holds the onboarding
reconciliation board, the terminology inventory and the contract-review record
for Direction D's new content jobs. Plan 064 remains the execution contract;
this file records evidence and engineering resolutions, never owner decisions.
An owner decision is recorded only as a link to the owner's reply on the
workfront PR or a linked issue.

## Workfront base

| Fact | Value at branch cut (2026-10-01) |
|---|---|
| Base `main` | `c1d643206d1c472b34d3f0c0e4b7cb425f571329` (merge of #255; the five §11.1 standalone workfronts are merged: #294 advisor 001, #291 advisor 002, #292 advisor 024, #293 advisor 023, #255) |
| Shell | `sw.js` `CACHE = "repforge-v349"`; `index.html` `app.js?v=317`, `durable-state.js?v=309`, `progress-model.js?v=308`, `history-ui.js?v=308`, every other protected script `?v=307`; `test/exercise-library.mjs` `expectedCacheRevision = "349"` |
| Catalog | 148 screens, 915 frames (`docs/ui-screens/manifest.json`) |
| Open PRs | #257, #258, #272, #276, #279, #282 |

Plan 064 §2 (`cb629036`, `repforge-v345`) is the planning snapshot; the row
above supersedes it for this branch. Facts are re-pinned at every slice
boundary in the workfront PR body.

## Source provenance

Prototype code, candidate rounds and tournament captures never enter `main`.
Their branches stay unmerged and undeleted; this table is how to find them.

| Source | PR | Branch | Pinned SHA | Consumed by | What is consumed |
|---|---|---|---|---|---|
| Direction D | #272 | `redesign/direction-d` | `2f2fc044` | R0 (documents), R3, OG-6 | ADR 0016, Plan 063, `docs/design/direction-d-implementation-spec.md`, `docs/design/direction-d-strings.md`, `DIRECTION-D-SPEC.md` by file copy; the review page stays the OG-6 drawing surface on the branch |
| Landing | #276 | `claude/landing-candidate-s-round-3-9tmm42` | `336b492d` | R2 | `docs/design/landing-candidates/final/` structure and copy; the three `rec.*.text` rewrites and their baseline fixture (I-05) |
| Onboarding tournament | #279 | `ccr-15c50ac8-pki40i` | `1acee97a` | R0 (register section, OG-1 board), R4 | Q622–Q637 register section; the selected direction's brief after OG-1 |

Each head was re-fetched at the branch cut and matched its pin; no delta was
consumed.

## Surface treatment table

Method. Every row below is generated from `docs/ui-screens/manifest.json` at
the branch cut (148 screens, 915 frames; a screen's frames are its
`variantSets` entry). Each screen gets exactly one treatment, one design
source and one owning slice. Treatments come from Plan 064 §7.1 (the governing
table) and, where §7.1 names only a flow, from Direction D's §3 class for that
screen at `2f2fc044`. Where the two disagree, Plan 064 governs, because it is
the execution contract and D's inventory predates `main`; each disagreement is
listed under "Delta versus Direction D's 143". "Source" cites ledger rows in
Plan 064 §5 (L-, I-, C-, OG-) and the Direction D spec section that draws the
screen. A screen D marks "needs drawing" keeps treatment `redesign (D)` and is
additionally gated on OG-6 and I-02 before it is built. Rules-only screens keep
the layout Plan 058 left them; only the shared components and rules from R1
reach them. The dock, sheets, dialogs, toasts and scrims row of §7.1 owns no
catalog screen of its own: those components appear inside the frames below and
belong to R1. The generator script is not committed; the counts were re-proved
by recount (see the totals). No screen is unclassified.

Treatment values: `redesign (D)` builds to the Direction D spec in R3; `redesign (landing)` builds the landing final page in R2; `redesign (onboarding, after OG-1)` builds the owner-selected onboarding direction in R4 and waits on OG-1; `rules only` receives shared components and rules but keeps its layout; `retire` is planned removal (see the retire and add list).

### Per-flow summary

| Flow | Screens | Frames | Treatment | Design source | Slice |
|---|---:|---:|---|---|---|
| `onboarding-start` first-run | 1 | 7 | `redesign (landing)` | I-04, L-08 (I-05, C-03) | R2 |
| `onboarding-start` hub states | 3 | 13 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-recommend` | 11 | 46 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-custom` | 7 | 36 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-browse` | 4 | 28 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-build` | 4 | 31 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-import` | 10 | 55 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-shared` gate, invalid | 2 | 11 | `redesign (landing)` | I-04, L-08, G-37, L-05 | R2 |
| `onboarding-shared` preview | 1 | 7 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `onboarding-recovery` | 2 | 14 | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |
| `today` | 5 | 44 | `redesign (D)` (2 need drawing) | I-01 §4.1, §4.2, L-01, OG-6, I-02 | R3 |
| `today` | 1 | 3 | `rules only` | I-03 | R3 |
| `today` | 1 | 8 | `retire` | C-07, D §3 | R3 |
| `workout` | 12 | 96 | `redesign (D)` (7 need drawing) | I-01 §4.2, §4.3, L-01, OG-6, I-02 | R3 |
| `workout` | 3 | 24 | `rules only` | I-03 | R3 |
| `workout` | 2 | 16 | `retire` | I-01 §4.2, C-07 | R3 |
| `session` | 4 | 27 | `redesign (D)` | I-01 §4.4, L-01 | R3 |
| `progress` | 9 | 42 | `redesign (D)` (6 need drawing) | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |
| `progress` | 19 | 132 | `rules only` | I-01 §4.6, I-03 | R3 |
| `history` | 4 | 27 | `redesign (D)` (2 need drawing) | I-01 §4.7, §4.8, L-01, OG-6, I-02 | R3 |
| `history` | 2 | 16 | `rules only` | I-03 | R3 |
| `library` | 5 | 30 | `rules only` | I-03 | R6 |
| `program` | 1 | 3 | `redesign (D)` | I-01 §4.9, L-01 | R3 |
| `program` | 13 | 59 | `rules only` | I-03 | R3 |
| `program` | 1 | 7 | `retire` | C-07, D §3, OG-5 | R3 |
| `settings` | 6 | 23 | `rules only` | I-03 | R6 |
| `install` | 15 | 110 | `rules only` | I-03 | R6 |
| **Total** | **148** | **915** | | | |

Totals by treatment (screens / frames):

| Treatment | Screens | Frames |
|---|---:|---:|
| `redesign (landing)` | 3 | 18 |
| `redesign (onboarding, after OG-1)` | 42 | 230 |
| `redesign (D)` | 35 | 239 |
| `rules only` | 64 | 397 |
| `retire` | 4 | 31 |
| **Total** | **148** | **915** |

Totals by owning slice (screens): R2 3, R3 77, R4 42, R6 26.

### Per-screen table

`D §3` is the class Direction D's inventory gives the screen at `2f2fc044` (`redesign`, `needs drawing`, `rules only`, `retired`, or `not in D`). `Variants` is the screen's frame count.

| Screen | Variants | D §3 | Treatment | Source | Slice | Flag |
|---|---:|---|---|---|---|---|
| `onboarding-start/first-run` | 7 | rules only | `redesign (landing)` | I-04, L-08 (I-05, C-03) | R2 |  |
| `onboarding-start/hub` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-start/hub-own-open` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-start/hub-existing` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/desired-result` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/background` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/schedule` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/environment` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/environment-correction` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/priorities` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/avoidance-pain` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/result` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/result-existing` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/replacement-confirm` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recommend/activation-conflict` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/desired-result` | 4 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/background` | 4 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/schedule` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/environment` | 4 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/priorities` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/exercise-preferences` | 4 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-custom/result` | 4 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-browse/schedule` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-browse/environment` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-browse/catalogue` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-browse/preview` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-build/setup` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-build/editor-empty` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-build/editor-partial` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-build/editor-ready` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/source` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-empty` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-filled` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-stage2` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-stage3` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-gaps` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-gaps-invalid` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/freeform-unreadable` | 3 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/review` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-import/preview` | 8 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-shared/gate` | 8 | rules only | `redesign (landing)` | I-04, L-08, G-37, L-05 | R2 | corrected by orchestrator |
| `onboarding-shared/invalid` | 3 | rules only | `redesign (landing)` | I-04, L-08, G-37, L-05 | R2 | corrected by orchestrator |
| `onboarding-shared/preview` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recovery/resume` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `onboarding-recovery/rules-drift` | 7 | rules only | `redesign (onboarding, after OG-1)` | OG-1, I-06, L-04 to L-07 | R4 |  |
| `today/no-program` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `today/ready` | 12 | redesign | `redesign (D)` | I-01 §4.1, L-01 | R3 |  |
| `today/rest-bar` | 8 | not in D | `redesign (D)` | I-01 §4.1, §4.2 | R3 | classified by rule, confirm |
| `today/day-picker` | 8 | redesign | `redesign (D)` | I-01 §4.1, L-01 | R3 |  |
| `today/done` | 8 | needs drawing | `redesign (D)` | I-01 §4.1, L-01, OG-6, I-02 | R3 |  |
| `today/preview` | 8 | retired | `retire` | C-07, D §3 | R3 |  |
| `today/draft-resume` | 8 | needs drawing | `redesign (D)` | I-01 §4.1, L-01, OG-6, I-02 | R3 |  |
| `workout/focus` | 8 | redesign | `redesign (D)` | I-01 §4.2, L-01 | R3 |  |
| `workout/focus-glossary` | 8 | not in D | `redesign (D)` | I-01 §4.2 | R3 | classified by rule, confirm |
| `workout/stale-draft` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `workout/persist-retry` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `workout/invalid-draft` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `workout/rest-timer` | 8 | redesign | `retire` | C-07, I-01 §4.2 | R3 |  |
| `workout/rest-timer-paused` | 8 | not in D | `retire` | C-07, I-01 §4.2 | R3 | classified by rule, confirm |
| `workout/exercise-note` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/why-this-weight` | 8 | redesign | `redesign (D)` | I-01 §4.3, L-01 | R3 |  |
| `workout/session` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/early-finish` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/exercise-actions` | 8 | redesign | `redesign (D)` | I-01 §4.2, L-01 | R3 |  |
| `workout/warmup-actions` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/reorder` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/correction` | 8 | redesign | `redesign (D)` | I-01 §4.2, L-01 | R3 |  |
| `workout/skipped-actions` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `workout/substituted-actions` | 8 | needs drawing | `redesign (D)` | I-01 §4.2, L-01, OG-6, I-02 | R3 |  |
| `session/summary` | 3 | redesign | `redesign (D)` | I-01 §4.4, L-01 | R3 |  |
| `session/summary-maintained` | 8 | redesign | `redesign (D)` | I-01 §4.4, L-01 | R3 |  |
| `session/summary-declined` | 8 | redesign | `redesign (D)` | I-01 §4.4, L-01 | R3 |  |
| `session/summary-mixed` | 8 | redesign | `redesign (D)` | I-01 §4.4, L-01 | R3 |  |
| `progress/overview` | 3 | redesign | `redesign (D)` | I-01 §4.5, §4.6, L-01 | R3 |  |
| `progress/overview-baseline` | 8 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/overview-action` | 3 | redesign | `redesign (D)` | I-01 §4.5, §4.6, L-01 | R3 |  |
| `progress/exercise-chart` | 3 | redesign | `redesign (D)` | I-01 §4.5, §4.6, L-01 | R3 |  |
| `progress/strength` | 3 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/strength-current-block` | 3 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/strength-all-history` | 3 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/strength-comparison` | 8 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/strength-sparse` | 8 | needs drawing | `redesign (D)` | I-01 §4.5, §4.6, L-01, OG-6, I-02 | R3 |  |
| `progress/volume` | 3 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/volume-block` | 3 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/volume-drill-in` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/prs` | 3 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/prs-drill-in` | 3 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/review` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/review-active` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/review-complete` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/review-insufficient` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/schedule-diagnosis` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/sibling-lower-frequency` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/sibling-shorter-session` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/guided-repair` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/volume-reduction-preview` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/recovery-ineligible` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/recovery-questions` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/recovery-preview` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/recovery-active` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `progress/recovery-reassessment` | 8 | rules only | `rules only` | I-03, I-01 §4.6 | R3 |  |
| `history/list` | 3 | redesign | `redesign (D)` | I-01 §4.7, §4.8, L-01 | R3 |  |
| `history/session` | 8 | redesign | `redesign (D)` | I-01 §4.7, §4.8, L-01 | R3 |  |
| `history/edit-dirty` | 8 | needs drawing | `redesign (D)` | I-01 §4.7, §4.8, L-01, OG-6, I-02 | R3 |  |
| `history/edit-invalid` | 8 | needs drawing | `redesign (D)` | I-01 §4.7, §4.8, L-01, OG-6, I-02 | R3 |  |
| `history/delete-confirm` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `history/conflict` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `library/list` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `library/list-selected` | 8 | not in D | `rules only` | I-03 | R6 | classified by rule, confirm |
| `library/exercise-preview` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `library/exercise-detail` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `library/exercise-detail-glossary` | 8 | not in D | `rules only` | I-03 | R6 | classified by rule, confirm |
| `program/no-program` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/overview` | 3 | redesign | `redesign (D)` | I-01 §4.9, L-01 | R3 |  |
| `program/progression-editor` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/exercise-picker` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/custom-exercise` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/custom-exercise-saving` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/custom-exercise-deleting` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/custom-exercise-archiving` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/custom-exercise-recovery` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `program/share-setup` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `program/share-one-blocker` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `program/share-repair-return` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `program/share-ready` | 8 | rules only | `rules only` | I-03 | R3 |  |
| `program/readiness` | 7 | retired | `retire` | C-07, D §3, OG-5 | R3 |  |
| `program/text-export` | 3 | rules only | `rules only` | I-03 | R3 |  |
| `settings/main` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `settings/appearance` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `settings/guides` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `settings/guides-replay` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `settings/privacy` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `settings/privacy-disclosure` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/banner` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `install/ios-sheet` | 3 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-eligible` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-creating` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-ready` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-retryable` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-claiming` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-importing` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-success` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-cleanup` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-terminal` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-destination` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-interrupted` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-unknown` | 8 | rules only | `rules only` | I-03 | R6 |  |
| `install/transfer-claimed-expired` | 8 | rules only | `rules only` | I-03 | R6 |  |

Per-screen rows: 148. Variant total: 915.

### Delta versus Direction D's 143

Direction D's §3 inventory counts 143 screens at `29fc1c36`. Every one of those 143 keys is still in the live manifest (checked by key), so no D-inventory screen is absent from `main`. `main` has five screens D's inventory does not have, all added on 2026-09-29 after that snapshot (`65edbc6`, `985606c`). None is named by Plan 064 §7.1 individually; each is classified by the rule of its flow and flagged for confirmation.

| Screen on `main`, not in D | Added in | Treatment | Slice | Why | Flag |
|---|---|---|---|---|---|
| `today/rest-bar` | `65edbc6` | `redesign (D)` | R3 | Today is a D redesign flow (§7.1); the frame is the redesigned Today plus the running-rest bar. D §4.2 moves rest inline in Focus and does not say whether this Today bar survives. R3 must settle that against D §5.4; this table assumes no retirement. | classified by rule, confirm |
| `workout/focus-glossary` | `65edbc6` | `redesign (D)` | R3 | Focus is redesigned (§7.1 Workout row, D §4.2). The frame is Focus with a glossary definition open; the definition surface takes the R1 sheet and popover rules. | classified by rule, confirm |
| `workout/rest-timer-paused` | `985606c` | `retire` | R3 | It is the paused state of the `rest-timer` sheet that C-07 retires. D's inline rest carries pause and resume as the Pausar/Retomar pad (D §4.2), so the paused sheet has no counterpart once the sheet goes. If R3 keeps a rest-presets sheet for the header timer (D §4.2 says the timer opens one), the owning slice re-decides this row. | classified by rule, confirm |
| `library/list-selected` | `65edbc6` | `rules only` | R6 | Library is rules only (§7.1, I-03). | classified by rule, confirm |
| `library/exercise-detail-glossary` | `65edbc6` | `rules only` | R6 | Library is rules only (§7.1, I-03). | classified by rule, confirm |

Counts: D 143 + 5 = 148. By flow: today 6 to 7, workout 15 to 17, library 3 to 5; every other flow is unchanged.

Where D §3 and Plan 064 §7.1 differ for a screen D does have, Plan 064 governs:

- Onboarding (all 45 screens): D §3 says `rules only`. Plan 064 §7.1 redesigns `first-run` to the landing (R2) and the other 44 to the owner-selected direction (R4, after OG-1). Until OG-1 resolves, I-03 is the floor for those 44 and R4 does not start.
- `workout/rest-timer`: D §3 lists it under Redesign; Plan 064 §7.1 and C-07 retire the sheet and replace it with `workout/rest-running` and `workout/rest-done`. Treated as `retire`.
- Every other D-inventory screen keeps the class D §3 gives it; D's needs-drawing screens stay gated on OG-6.

Unclassified, STOP: none. Every manifest key received a treatment, source and slice.

### Retire and add list (C-07)

Planned, not done. Each slice edits `docs/ui-screens/manifest.json` and `tools/ui-screens/screens-app.mjs` for its own states in the PR that changes them; the orchestrator owns PNGs (§10.3).

| Planned change | State | Owner | Basis |
|---|---|---|---|
| Retire | `today/preview` | R3 | D decision 9 (no Preview action); D §3 Retired; C-07 |
| Retire | `program/readiness` | R3 (Program slice) | D decision 10 (readiness route dropped); D §3 Retired; C-07; the `program_readiness_navigated` allowlist deletion is gated on OG-5 |
| Retire | `workout/rest-timer` (the sheet) | R3 | C-07; replaced by inline rest, D §4.2 |
| Retire, by rule, confirm | `workout/rest-timer-paused` | R3 | Paused state of the same sheet; see the delta list |
| Add | `workout/rest-running`, `workout/rest-done` | R3 | D §3 new catalog states (inline rest) |
| Add | `workout/why-in-session`, `workout/why-rep-goal`, `workout/why-anchor`, `workout/why-manual` | R3 | D §3 new catalog states (Why this weight) |
| Add | `today/mixed-strategies` | R3 | D §3 new catalog state; the mixed-strategy fixture follows D §6 |
| Add | `session/summary-first` | R3 | D §3 new catalog state |
| Add | onboarding states of the selected direction | R4 | OG-1; not enumerable until the owner selects a direction |
| Add | landing states | R2 | I-04, L-08; R2 names them in its own manifest edit, none are enumerated by D |

Arithmetic, as planned: 148 now, minus 3 retired (4 if `rest-timer-paused` retires), plus 8 D states, gives 152 (or 153 if R3 keeps the paused state) before the R2 landing states and the R4 onboarding states are counted. The planned figure moves with those slices and is re-pinned at each slice boundary.

## Contract review for Direction D content jobs

Pending (R0 packet: contract review). Resolves C-01 for the shelf, inline
rest, prescription row, frequency counts and any landing surface pair, on the
semantic contract's existing roles where one exists.

## Terminology inventory (input to OG-2)

Pending (R0 packet: terminology inventory).

## Onboarding reconciliation board (input to OG-1)

Pending (R0 packet: OG-1 board), built from existing sources only per Plan 064
§7.2.

## Reconcilable rows

Pending. Each of C-01 to C-09 is resolved here with its evidence or assigned to
the slice that resolves it.
