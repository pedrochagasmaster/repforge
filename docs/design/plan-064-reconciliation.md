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
| `today/done` | 8 | drawn (OG-6 round 1, `e04e7f3`) | `redesign (D)` | I-01 §4.1, L-01, OG-6, I-02 | R3 | built in R3x (2026-10-02) |
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
| `history/edit-dirty` | 8 | drawn (OG-6 round 2, `b891de0`) | `redesign (D)` | I-01 §4.7, §4.8, L-01, OG-6, I-02 | R3 | built in R3j2 (2026-10-02) |
| `history/edit-invalid` | 8 | drawn (OG-6 round 2, `b891de0`) | `redesign (D)` | I-01 §4.7, §4.8, L-01, OG-6, I-02 | R3 | built in R3j2 (2026-10-02) |
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
| `workout/rest-timer-paused` | `985606c` | `retire` | R3 | It is the paused state of the `rest-timer` sheet that C-07 retires. D's inline rest carries pause and resume as the Pausar/Retomar pad (D §4.2), so the paused sheet has no counterpart once the sheet goes. If R3 keeps a rest-presets sheet for the header timer (D §4.2 says the timer opens one), the owning slice re-decides this row. Re-decided in R3f and the audit fix RT-04 (2026-10-02): the presets sheet stays and carries its own Pause/Resume (`#restHold`), so pausing remains reachable at large text and after a field tap, but the paused state has no catalog frame of its own; the row stays retired. | classified by rule, confirm |
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

Resolves C-01 for the shelf, inline rest, prescription row, frequency counts and
the landing surface pair, on the semantic contract's existing roles where one
exists. This is a record, not an amendment: nothing here is added to
`docs/design/ui-system-semantic-contract.md` or `tools/ui-role-inventory.json`.
R1 writes the amendment for whatever the owner accepts. No value, tier or
radius below is decided; every PROPOSED line quotes the value the drawing used
or an existing palette value, and carries one of two labels:

- **owner gate OG-4**: one of the seven "proposed 058 content jobs" in the
  2026-09-30 polish comment on #272.
- **contract review proposal**: needed by a Direction D or landing job that the
  comment does not list. The Plan 064 locked rows leave its acceptance route
  open (open question 1 at the end of this section).

Sources, all read-only at their pinned SHAs: `docs/design/ui-system-semantic-contract.md`,
`tools/ui-role-inventory.json` and `styles.css` at `eeb885cf`; #272 at
`2f2fc044` (`direction-d-implementation-spec.md` §3, §5, §7, §9;
`DIRECTION-D-SPEC.md`; `POLISH-AUDIT.md`; `phone.css`, `review.css`, `kit-d.js`,
`dir-d.js`); the #272 polish comment of 2026-09-30, read through the GitHub
tool ([issuecomment-5902522837](https://github.com/pedrochagasmaster/repforge/pull/272#issuecomment-5902522837));
#276 at `336b492d` (`docs/design/landing-candidates/final/index.html`).
Contrast values are WCAG 2.x relative-luminance ratios computed from the hex
values in `styles.css` `:root` and `:root[data-theme="dark"]` (opaque pairs, so
no compositing); thresholds are the contract's: 4.5:1 text, 3:1 large text,
required boundaries, icons and state marks.

### Result in brief

- The prototype uses 18 custom properties that `styles.css` lacks (section 1).
  They fall into four groups: three tokens or scales to propose
  (`--boundary-selected-quiet`; `--space-*` with `--gut`; `--rule-on-surface`,
  conditionally), one conditional exception (`--art-bg`), review-frame
  constants and local arithmetic that need no role (`--dock-b`, `--shelf-h`,
  `--fld-label`, `--fld-value`), and motion durations that belong to the
  interaction audit (`--motion-*`). The rest of the prototype's token names
  match `main` by name.
- Every type tier, radius step, control role, layer and elevation role the nine
  jobs use already exists. No job needs a new type size, radius step, control
  role, layer or elevation shadow. The additions this review proposes are
  tokens, three selector extensions to existing variants and exceptions, one
  new variant row, and inventory rows.
- The one job that cannot be expressed on existing roles is the landing night
  band (section 2.9): no existing token pair holds it in both themes, so under
  §8.2 it is not built unless the pair below is approved.
- The drawing's `--control-adjustment-bg` (`--bg`) and `--control-field-bg`
  (`--well`) differ from `main` (`--surface` for both). The rest clock differs
  too (C-02). Those three are the only same-name overrides with a different
  resolved value; every other shared token name resolves to the same value.

### 1. Token map (C-01)

| Prototype property (value at `2f2fc044`) | Used by | Existing token or role on `main` | Result |
| --- | --- | --- | --- |
| `--boundary-selected-quiet` = `var(--ink)` | Selected shelf field, open and corrected ledger row, timer preset, tab indicator | Layer role `selected` is defined as an "inset high-contrast boundary or fill", so ink fits the role. The token `--boundary-selected` is `--accent-deep`, which §8.8 keeps off these surfaces. `--color-ink` holds the same value. | PROPOSED token alias. Shelf field and ledger row: owner gate OG-4 (jobs 1 and 2). Tab indicator: contract review proposal. |
| `--rule-on-surface` = `--rule` in light, `--rule-strong` in dark | Separators inside sheets and the shelf, empty art-tile ring, live timer ring | No single token. `--boundary-decorative` (`--rule`) serves light. `--boundary-modal` and `--boundary-persistent` (both `--rule-strong`) serve dark. `styles.css` already splits this exact pair by theme for one consumer, `:root[data-theme="dark"] .exthumb--sm`. On `--surface`: `--rule` 1.31:1 light, 1.21:1 dark; `--rule-strong` 1.46:1 light, 1.79:1 dark. | Contract review proposal, conditional: no addition if sheet and shelf separators take `--boundary-modal` and `--boundary-persistent` in both themes (light separators become `--rule-strong`, a visible change for R1 and the owner to accept). A named pair is needed only to keep light at `--rule`. |
| `--space-4`, `-8`, `-12`, `-14`, `-16`, `-18`, `-26` (`--space-32` is declared, unused) | Every D margin, padding and gap | The contract defines no spacing roles, and `node tools/check-ui-system.mjs --strict-css` scans only type, weight, radius, shadow and color. The only scale in the repository is `DESIGN.md` front matter `spacing` (xs 4, sm 8, md 12, card 14, gutter 16, section 18, band 26, run 32), whose values the prototype copied. | Contract review proposal: give that scale contract status as `--space-*` custom properties with `DESIGN.md`'s values. Plan 064 R1 already lists "the spacing scale"; §8.3 says "from the contract", which today holds none. |
| `--gut` = 16px | Page gutter | `DESIGN.md` `gutter` 16; `--settings-inset` is Settings-only. | Covered by the spacing row. |
| `--dock-b` = 24px | Bottom offset of the dock and shelf in the phone frame | `--dock-gap` (10px) and `--nav` plus the safe-area inset in the app. | Review-frame constant; no role. Not carried. |
| `--shelf-h` (computed) | Scroll reserve under the shelf | Same job as `--nav` for the dock (§8.3 "CTA reservation"). | Layout reservation, not a role. R3c derives it from the built shelf. |
| `--fld-label`, `--fld-value` | Row heights inside one shelf field | Calc of `--font-size-caption`, `--font-size-metric`, `--line-tight`. | Local layout arithmetic; no role. |
| `--motion-in` (.2s), `--motion-out` (.15s), `--motion-cross` (.16s) | Sheet rise, row commit, disclosure, pad crossfade | No motion tokens in `styles.css`. `motion-layer.js` owns `revealIn` (0.2 s) and `revealOut` (0.15 s); §8.11 limits the shelf crossfade to 160 ms. | Governed by the interaction audit, not the contract. R1 records the additions there. |
| `--art-bg` (inline, per movement) | 56px header art tile | `--exercise-art-bg`, the existing per-element property behind `.exdet-art`. The exception for sampled `mediaBg` paper is selector-exact (`.exdet-art`); `.exthumb` paints `--well`. | Contract review proposal only if the Focus tile paints the sampled paper (extend the selector-exact exception). No addition if it reuses `.exthumb`. |
| `--sans`, `--mono` | Font stacks | `--font-language`, `--font-training-data`. The `--body`/`--mono` aliases were removed in P6 and the strict scan rejects them. | Existing role. |
| `--shelf-shadow`, `--dock-shadow`, `--dock-pill-shadow`, `--sheet-lift` (unused after polish) | None | `--elevation-persistent-shadow`, `--elevation-nav-shadow`, `--elevation-nav-selected-shadow`, `--elevation-sheet-shadow`. | Existing roles. |
| `--r-*`, `--i`, `--m`, `--end`, `--strip` | Review-page chrome and the A family | Not product tokens. | Ignore. |

Same name, different resolved value (light and dark alike): `--font-size-rest-clock`
(`clamp(2rem,10cqi,2.625rem)` against `main`'s `clamp(2rem,10vw,2.625rem)`;
C-02, section 3), `--control-adjustment-bg` (`--bg` against `--surface`) and
`--control-field-bg` (`--well` against `--surface`). The pad and field grounds
belong to OG-4 jobs 5 and 1. Every other shared name resolves identically
(`--control-focus-outline`, `--control-error-boundary` and the nav shadows differ
only in how they are spelled).

### 2. Content jobs

Type tiers use the §8.1 names (label 11, caption 12, body-small 14, body and
control 16, subtitle 18, metric 22, section-title 24, feature-title and
focal-data 28, title 30); D §7 is the mapping source.

#### 2.1 Workout shelf (`persistent-action`)

- **Layer and elevation:** `persistent-action`, which the contract defines as
  "actions kept reachable while content scrolls" with a "shallow edge and depth;
  no second raised card inside". Today's inventory owners are `nav`,
  `#restBar`, `#libBar` and `.sum-actions`; the shelf is a fifth row. Tokens it
  uses exist: ground `--color-surface`, top edge `--boundary-persistent`, depth
  `--elevation-persistent-shadow`. Fields and pads carry a boundary and no
  shadow, so the nested-elevation rule holds.
- **Radius:** the drawing puts `--radius-prominent` (16) on the top corners.
  Existing `persistent-action` recipes use pill (dock), none (Program dock) and
  surface (`.restbar`). The step exists; pairing it with this layer is the
  question.
- **Controls:** field button `selection` (`aria-pressed`, §8.12) and field input
  `field`; pads `adjustment`; CTA `primary` (`Registrar série N`, 54px,
  `subtitle` 18/600, radius `--radius-control`, as the shipped `.btn--cta`);
  the Próximo row keeps `quiet-navigation` (`#woNext`).
- **Type:** field caption `caption`, value `metric` 22 Mono (D §7), pad labels
  `control` 16 Sans, CTA `subtitle`. The shipped current-set value is
  `focal-data` 28 (`.curset__val`, `--font-size-focal-data-max`); D's `metric`
  is a role-mapping change, not a new tier (OG-4 job 1).
- **Verdict:** role exists; **no new role, tier or elevation**. PROPOSED, as
  contract review proposals (the shell is spec §7 "the shelf", not one of the
  comment's seven): a contextual variant row "Workout shelf" under
  `persistent-action` in the contract's variants table (the table is closed, so
  a new row is an amendment), full width and flush to the bottom, top-corner
  radius as drawn (`--radius-prominent`; R1 or the owner may substitute
  `--radius-none`, the Program dock's recipe); selector chosen by R1. AA method:
  the rendered-role audit on `workout/focus` in both themes.
- **Shelf field (owner gate OG-4, job 1):** two selector-exact inventory rows
  rather than a new role, because the inventory models one control role per
  selector and the field is `selection` as a button and `field` as an input.
  PROPOSED: (a) `--boundary-selected-quiet` = `var(--ink)` (`#1B1A17` light,
  `#F2EFE9` dark; existing palette values, no new value), 2px, used as the
  selected boundary because §8.8 keeps orange off the shelf. Measured against
  the surfaces it sits on: 17.40:1 and 14.82:1 on `--surface`, 16.42:1 and
  15.60:1 on `--well` (3:1 required). (b) Ground: the drawing uses `--well`;
  `--control-field-bg` is `--surface`. Keeping `--surface` needs no addition;
  `--well` is a contextual ground on existing tokens. (c) Untouched value in
  `--ink-soft`: 5.71:1 and 7.12:1 on `--surface`, 5.39:1 and 7.49:1 on `--well`
  (4.5:1 required). (d) Invalid: `--control-error-boundary` (`--danger`,
  5.09:1 and 5.98:1 on `--surface`), CTA disabled with
  `--control-primary-disabled-*`. The invalid reason is proposal 4 in section 3.
- **Pads (owner gate OG-4, job 5):** `adjustment`, boundary `--boundary-required`
  (5.71:1 and 7.12:1 on `--surface`; 5.11:1 and 7.78:1 on `--bg`), pressed
  `--well` and `--control-pressed-transform` (the shipped `.stepbtn:active`),
  focus `--control-focus-outline`. In rest mode: −30 s and +30 s are
  `adjustment` (as `#restMinus`, `#restPlus`), Pausar and Retomar `selection`
  (as `#restPlayPause`, with a text label instead of an icon), Pular
  `secondary` (as `#restStop`). PROPOSED: the "Rapid workout stepper" variant
  (selector `.stepbtn`, 44px icon steppers) is selector-exact, so the 56px text
  pads need their selector added to it; the role and boundary stay. The drawing
  also overrides the ground to `--bg` (existing token) where
  `--control-adjustment-bg` is `--surface`: keep `--surface` (no addition) or
  accept the contextual `--bg` ground (OG-4 job 5).

#### 2.2 Inline rest (owner gate OG-4, job 3)

- **Layer:** `flat`; the block replaces the cue slot and is not a card. The
  `rest-timer` sheet retires; the timer-presets sheet stays `modal`.
- **Type:** "Descanso" and "de 2:00" `body` 16; clock the protected rest-clock
  variant (Mono); next cue `subtitle` 18 with Mono values; "Descanso concluído
  · +0:15" `subtitle` 18 in `--ink-soft` (5.11:1 and 7.78:1 on `--bg`); Why link
  `control` 16/500, `quiet-navigation` (as `.text-link.focus-ex__why`). The cue
  that returns after rest is the drawing's `section-title` 24 line (D §7). The
  contract defines `section-title` as naming "a section or sheet", and the
  shipped `.focus-cue` is `body-small`, so the cue line is a role-meaning
  question: contract review proposal (same 24px step, no new tier).
- **Controls:** as in 2.1 (rest pads).
- **Progress and exceptions:** the drain bar is `--accent` on a `--rule` track,
  4px, driven by a transform. It measures 3.05:1 and 4.80:1 against its track
  and 3.57:1 and 6.33:1 against `--bg` (3:1 required; the contract marks the
  rest arc `required`). It is temporal status like `#restSheet .restdial__arc`,
  which has a selector-exact exception ("assigning block, week, exercise-set or
  task would falsify its denominator"). PROPOSED (OG-4 job 3): the same
  exception and rationale for the inline bar's selector, and the bar must not
  match a progress candidate selector. The drawing's 2px bar radius is a
  literal; use an existing step (`--radius-compact` 4 or `--radius-none`).
- **Rest clock variant:** the "Responsive rest clock" variant is selector-exact
  (`.restdial__clock`) and "no other surface inherits [it] by visual
  resemblance", so the inline clock's selector must be added to it. PROPOSED
  (OG-4 job 3): extend the variant's selector; role and value
  `--font-size-rest-clock` unchanged (C-02 below).
- **Overrun:** the shipped overtime facet uses `--color-warning` (`--accent-deep`)
  with a danger arc and the `restover` pulse. The drawing counts up in
  `--ink-soft`, consistent with the §8.8 orange budget, which lists only the
  running drain bar. Both tokens exist. The choice belongs to R3 and proposal 5
  in section 3; it needs no contract addition. Settled in R3f: the inline line
  and the header timer chip both count up in `--ink-soft`; the chip's warning
  facet and `restover` pulse are retired (owner decision, #295 comment
  5948281184).
- **Motion:** crossfade of at most 160 ms, drain bar as `scaleX`, reduced motion
  removes both; recorded in `docs/design/interaction-runtime-audit.md` by R1,
  not in the contract.
- **Verdict:** no new role, tier or radius. The additions are two selector
  extensions and one exception row (owner gate OG-4, job 3).

#### 2.3 Prescription row, including rows on a first baseline (owner gate OG-4, jobs 4 and 7)

- **Layer and control:** `flat` rows on `--boundary-decorative` hairlines, at
  least 48px (§8.3). The whole row opens the exercise: `quiet-navigation`, which
  the contract names for "drill-in rows" (a chevron there does not make it
  `disclosure`). Manual rows have no mark.
- **Type:** name `body` 16 Sans; sub-line `body-small` 14; load `metric` 22 Mono;
  target `body-small` 14 Mono (`3 × 12–15`); column heads `label` 11 uppercase,
  `--ink-faint` 4.60:1 light and 6.10:1 dark on `--bg` (4.5:1 required; the
  shipped ledger head uses `--color-ink-secondary`, 5.11:1 and 7.78:1).
  Operators and units in `--ink-soft` (5.11:1 and 7.78:1).
- **Composition:** first-baseline alignment with the mark shifted `.15em`, and
  a kg and target column sized from the widest forms (66px and 78px at the
  default root size), reflowing at 200% text. These are layout recipes, not
  roles.
- **Verdict:** **no contract addition needed.** Every role, tier and boundary
  exists. R1 adds an inventory component row; OG-4 acceptance confirms the
  composition recipe and the first-baseline rule that Today, Program, attention
  and strength rows share.

#### 2.4 Frequency counts (contract review proposal)

- **Layer and control:** `flat`; not interactive. The pair is one image for
  assistive technology (`role="img"`, labelled with the block total), as D §4.8
  and §9 require.
- **Type:** the heading "Frequência no bloco" is `subtitle` 18/600 in the
  drawing (proposal 2, section 3); counts and labels `caption` 12 Mono and
  `body-small` 14 in `--ink-soft` (5.11:1 and 7.78:1 on `--bg`).
- **Marks:** bars in `--ink` (15.57:1 and 16.19:1 on `--bg`, 3:1 required); the
  baseline in `--boundary-decorative`. The planned-sessions line is drawn
  dashed in `--rule-strong`, which measures 1.31:1 and 1.95:1 on `--bg` and
  fails 3:1 if the line carries a value. Existing `--boundary-required`
  measures 5.11:1 and 7.78:1; or the line stays decorative and the planned
  count is stated in text. Either choice uses existing tokens.
- **Radius and literals:** the drawing's `2px 2px 0 0` bar radius and 2px
  segment radii are not on the scale and are caught by `--strict-css`; use an
  existing step.
- **Progress classification:** per-week bars compare a count with a planned
  denominator. The progress rule requires a declared dimension and scope for
  every candidate selector; a new class does not match `progressCandidateSelectors`
  and so is not checked, but an unclassified denominator is the case the contract
  warns about. The by-weekday bars have no denominator and resemble
  `#completedVolume .vrow__bar` (a selector-exact exclusion).
- **Verdict:** **no new role, tier, radius or palette value.** PROPOSED
  (contract review proposal): an inventory row stating the layer, the labelled
  image, the required-versus-decorative status of each mark above, and the
  classification: per-week bars as dimension `week` with a new scope name; by-
  weekday bars as a selector-exact exclusion with the `#completedVolume`
  rationale. The exclusion is a contract change. R1 and the owner choose
  between this and keeping the bars outside the progress checker.

#### 2.5 Verdict mark (contract review proposal for new masks only)

- **Role:** a glyph beside a `rec.*.label`, not a control and not a layer. The
  label carries the meaning; the glyph is redundant.
- **Colour:** up uses `--color-action` (`--accent`: 3.57:1 and 6.33:1 on `--bg`,
  3.99:1 and 5.80:1 on `--surface`; 3:1 required); down, stalled and recover use
  `--color-ink`; hold, new and manual use `--color-maintained` or no mark.
  Records use `--color-improved` (`--positive`, 4.58:1 and 8.35:1 on `--bg`).
  §8.8 permits verdict glyphs among the orange uses. D does not use
  `--color-declined` for declines ("declines are ink"); that token stays for
  other surfaces.
- **Size:** the drawing uses 18, 20, 22, 24 and 26px boxes. Existing icon-mask
  sizes are 16 (`.icon-mask--sm`), 20 and 24 (`--control-icon-size`). Any size
  outside those is a contract question; R1 should choose from them.
- **Glyphs:** the drawing's arrow (rotated up and down), equal, reset, pause and
  plus. `styles.css` has masks for `reset`, `pause`, `plus` and `trend`, and the
  CTA's `--arrow` mask (rotatable); the equal sign is a new mask. §8.7 allows
  new masks through the same mechanism with inventory rows.
- **Verdict:** **no contract addition needed.**

#### 2.6 Ledger row (owner gate OG-4, job 2)

- **Layer and control:** done and queued rows `flat` on `--boundary-decorative`;
  a done row that reopens a set is the same action as the shipped
  `.ledger__row.is-editing` (`secondary`). The open row and the row being
  corrected are layer `selected`: well ground, inset boundary, no outward
  shadow, `--radius-surface` 12.
- **Type:** values `body` 16 Mono, right-aligned on a shared 12px inset; index
  `body-small` 14 Mono (accepts a warm-up label); heads `label` 11; previous-set
  line `body-small` 14 in `--ink-soft`. The shipped row is 52px and
  left-aligned; D's is at least 48px.
- **PROPOSED (owner gate OG-4, job 2):** the selected boundary reuses
  `--boundary-selected-quiet` from 2.1 (16.42:1 and 15.60:1 on `--well`, 3:1
  required); the shipped corrected row uses an accent rail and accent check, so
  this is the orange-budget variant of an existing state. The drawing draws it
  1.5px; the contract's only inset-selected recipe is 2px
  (`--elevation-selected-shadow`), so 1.5px would be a new value. Use 2px unless
  the owner accepts 1.5px. Values on the open row in `--ink-soft`: 5.39:1 and
  7.49:1 on `--well`. The demoted open row returns to the queued look.

#### 2.7 Tab row (contract review proposal; consumer of the 2.1 token)

- **Roles:** the shipped `#stats button[role="tab"]` is `selection`, layers
  `flat` and `selected`, boundary `required`. D's row of five has the same role.
- **Differences from the shipped tab styles (`.tabs`, `.seg--stats`):** label
  `control` 16/500 (selected 600) instead of `body-small` 14/500; selected
  indicator 2px `--ink` instead of 2px `--accent`; horizontal scroll with a
  paper fade drawn only while the row overflows. Each tab is at least 44 × 44
  in both.
- **PROPOSED:** the indicator uses `--boundary-selected-quiet` (15.57:1 and
  16.19:1 on `--bg`; unselected label `--ink-soft` 5.11:1 and 7.78:1). The fade
  is a gradient: text under it is `unsupported` in the rendered-role audit, not
  a pass, so R1 keeps labels out of the fade or needs a checker-supported
  treatment. Nothing else is new.

#### 2.8 Sheet header band (owner gate OG-4, job 6)

- **Layer and roles:** `modal`, as `#whySheet`, `#dayPickSheet`, `#sessionSheet`
  and `#restSheet` today. Handle on `--boundary-floating` (the shipped Focus
  sheets already do this); close button `quiet-navigation`, icon-only, 44px
  reserve; title `section-title` 24/600, which the contract defines as naming a
  section or sheet; optional `body-small` line. The Why sheet's eyebrow is
  `body-small`, and its cue takes the title role with Mono load and reps.
- **Today:** the shipped sheets already mix three title tiers (`subtitle` by
  default, `section-title` on five, `feature-title` on `#exActionsSheet`), so
  the single band is a convergence onto an existing tier.
- **Literals not to carry:** the drawing's sheet title line height is 1.2; the
  contract's line heights are 1.1, 1.4 and 1.55.
- **Verdict:** **no contract addition needed.** The band is a composition recipe
  (handle margins, close button centred on the title's first line, 16px to
  content) for R1's component row. Title `--ink` is 17.40:1 and 14.82:1 on
  `--surface`; sub-line `--ink-soft` 5.71:1 and 7.12:1. Separators inside the
  sheet are the `--rule-on-surface` question in section 1.

#### 2.9 Landing night band pair (contract review proposal; §8.2)

The final page's `.night` class redeclares the dark palette on the hero, the
proof band and the footer in both themes. Its values are the existing
`:root[data-theme="dark"]` values, so the question is the mechanism, not a new
colour.

| Pair on the final page | Foreground | Field | Ratio | Needs |
| --- | --- | --- | --- | --- |
| Hero heading and body | `#F2EFE9` | `#141310` | 16.19:1 | 4.5:1 |
| Hero subline, meta | `#ADA79D` | `#141310` | 7.78:1 | 4.5:1 |
| Meta separators, footer text (13px) | `#99938A` | `#141310` | 6.10:1 | 4.5:1 |
| Proof heading and body | `#F2EFE9` | `#1E1C18` | 14.82:1 | 4.5:1 |
| Proof caption (16px) | `#ADA79D` | `#1E1C18` | 7.12:1 | 4.5:1 |
| Proof result (26px Mono, large) | `#FF8A3D` | `#1E1C18` | 7.25:1 | 3:1 |
| Rail current step | `#F2703B` | `#1E1C18` | 5.80:1 | 3:1 |
| Rail inactive step, "Abrir o app" pill border | `#4A453D` | `#1E1C18`, `#141310` | 1.79:1, 1.95:1 | 3:1, if required |

- **Does an existing pair pass?** No existing token pair holds this band in
  both themes. In dark, `--bg` and `--ink` give the same colours but also make
  the band indistinguishable from the page. In light there is no token with
  these values: `--bg`, `--surface`, `--ink`, `--ink-soft` and `--ink-faint` are
  all the light palette. The closest pair, `--cta` and `--cta-ink`, measures
  18.25:1 in light (`#FFFFFF` on `#161513`) but is the `primary` control pair, so
  borrowing it changes its role, and in dark it resolves to `#161513` on
  `#DED7CC` (12.77:1), a parchment band. It also has no soft or faint ink.
- **Consequence under §8.2:** unless a pair is approved, the night band is not
  built. R2 then builds the hero and proof as bands on the live theme's paper
  (§8.2's first sentence). Even with a pair approved, the two `#4A453D` marks
  fail 3:1 as drawn (1.79:1 on the proof field, 1.95:1 on the hero), so the rail
  inactive step and the pill border need a required-boundary treatment before
  the band passes the rendered-role audit.
- **PROPOSED (contract review proposal):** five surface and ink tokens declared
  with identical values in both themes: `--surface-night` `#141310`,
  `--surface-night-raised` `#1E1C18`, `--ink-night` `#F2EFE9`,
  `--ink-night-soft` `#ADA79D`, `--ink-night-faint` `#99938A`. The names are
  placeholders for R1. All five values already exist in the dark palette, so
  the proposal adds a role (an always-dark band) and no palette value. AA
  measurement: the table above, repeated in the rendered-role audit on every
  landing state in both themes and EN and PT, plus `test/appearance.mjs` as the
  palette guard. Alternative for the owner: scope the existing dark block to
  the band, so every role (CTA, accent, rules) resolves inside it with no new
  names, at the cost of audit support for a themed region inside the other
  theme.
- **Other fields on the final page** (outside §8.2's sentence, reported, not
  proposed): the orange stripe and closing band use `--accent` as a field with
  the literal `#141310` as ink (4.66:1 light, 6.33:1 dark); the ink band uses
  `--ink` as the field and `--bg` as ink (15.57:1 and 16.19:1) with
  alpha-derived secondary text (9.38:1 light, 7.98:1 dark at .76). These pass
  AA but have no named surface pair, and a full-bleed orange field is a use
  that §8.8's orange budget does not list. OG-3 should ask about them with the
  night band.

### 3. OG-4 and C-02

**Five open polish proposals** (source: "Proposals" in the #272 polish comment;
`POLISH-AUDIT.md` "Not fixed here" lists four, differs in two, see below):

| # | Proposal | What accepting it would change |
| --- | --- | --- |
| 1 | Focal exercise name role (comment 1; audit 1) | The drawing keeps `.d-exname` on `subtitle` 18/600. The shipped `.focus-ex__name` is already `feature-title` 28, so keeping 18 changes a shipped role, and choosing `feature-title` makes the name larger than the 24px cue. |
| 2 | Section heading role (comment 2; audit 2) | "Prescrição de hoje" and peers on `subtitle` 18/600 instead of `section-title` 24, which the contract defines as the tier that names a section. Accepting amends that definition or the mapping. |
| 3 | Exercise-complete shelf drawing (comment 3; audit 3) | Spec §4.2 shows `focus.next_ex` or `log.finish` in place of the fields. Not drawn, so an OG-6 drawing. It needs no new role: the two actions reuse existing control roles, which the drawing assigns. |
| 4 | Invalid-set reason string (comment 4; not in the audit) | A readable reason beside the disabled CTA: "Informe carga e reps para registrar." / "Enter a load and reps to log the set." Meets the contract's readable-reason rule, adds one i18n key (not in the strings appendix), `body-small` in `--color-disabled-reason` (5.71:1 and 7.12:1 on `--surface`). No contract addition. |
| 5 | Overrun after Skip (comment 5; not in the audit) | The drawing counts up after Pular as after zero. Rejecting means a skipped rest ends with no overrun line; a state decision, no contract effect. |

The audit lists four. Its fourth, the selected field's ink boundary, is folded
into content job 1 in the comment (section 2.1 above); the comment's fourth and
fifth are not in the audit.

**Seven proposed 058 content jobs** (comment, "Proposed 058 content jobs"):

| # | Comment's job | Section | Review outcome |
| --- | --- | --- | --- |
| 1 | Shelf field | 2.1 | PROPOSED token alias, two inventory rows, optional ground (OG-4) |
| 2 | Ledger open row | 2.6 | PROPOSED, reuses the job 1 token; 1.5px against the contract's 2px (OG-4) |
| 3 | Inline rest block | 2.2 | PROPOSED selector extension and exception row (OG-4) |
| 4 | Prescription row | 2.3 | No contract addition needed (OG-4 confirms the recipe) |
| 5 | Pads on the shelf | 2.1 | PROPOSED variant-selector extension, optional ground (OG-4) |
| 6 | Sheet header band | 2.8 | No contract addition needed (OG-4 confirms the recipe) |
| 7 | Rows on a first baseline | 2.3 | No contract addition needed (OG-4 confirms the rule) |

Jobs outside the comment's seven that this review also touches, all labelled
contract review proposal: the shelf shell variant (2.1), the frequency counts
(2.4), the verdict-mark masks (2.5), the tab row (2.7), the night pair (2.9),
the spacing scale, `--rule-on-surface` and the cue line (section 1, 2.2).

**C-02, rest clock:** the protected `clamp(32px,10vw,42px)`
(`--font-size-rest-clock`) stands unless the owner accepts the polish proposal
under OG-4. Evidence for the owner: the proposal's stated reason is that the
review page's phone frame, not the viewport, is the container. In the app,
`:root` is already the size container (`container-type:inline-size` in
`styles.css`), so `10cqi` and `10vw` resolve to the same length on a phone to
within a scrollbar width.

### 4. Prototype values that conflict with an existing contract rule

Not contract additions; R1 and R3 must not carry them:

- Future segments and the week rule on `--rule-strong` (1.31:1 light, 1.95:1
  dark on `--bg`). The inventory marks `#todayProgram .segbar` and
  `#woProgress .segbar--ex` `required`, which needs 3:1 (`--boundary-required`
  is what the shipped exercise bar uses).
- Line heights 1.15, 1.2, 1.25, 1.3 and 1.35 (contract: 1.1, 1.4, 1.55).
- The 2px radius on bars and segments (contract steps: 0, 4, 8, 12, 16, pill,
  round).
- Disabled primary label `--ink-soft` on `--rule` measures 4.37:1 in light
  (5.90:1 dark). This pair already ships on `.btn--cta:disabled`, so the shelf
  adds nothing new; the rendered-role audit's treatment of disabled controls
  governs.

### 5. Open questions

1. OG-4 names "the seven proposed 058 content jobs", and R1 consumes "OG-4
   outcome for any token D proposed". No locked row or gate names who accepts
   the "contract review proposal" items: the shelf shell variant, frequency
   counts, tab row, spacing scale, `--rule-on-surface`, the art-tile exception
   and the night pair. R1 says only "the landing surface pair if approved". The
   orchestrator needs to decide whether they ride OG-4 (Direction D items) and
   OG-3 (the night pair) or get their own question.
2. The owner choices this review leaves open: the shelf's top radius
   (2.1); `--rule-on-surface` or `--boundary-modal` in light (section 1);
   `--well` or `--surface` field ground and `--bg` or `--surface` pad ground
   (2.1); 1.5px or 2px selected outline (2.6); progress classification of the
   frequency bars (2.4); the night pair or scoped dark block (2.9).

## Terminology inventory (input to OG-2)

Input to owner gate OG-2 ("Confirm or reject issue #274 as the product-wide rule
for landing, entry and app"). Generated from `i18n-pt.json`, `i18n-en.json`, the
landing final page at `336b492d` and `CONTEXT.md` on this branch (base
`eeb885cf`). It records what #274 would touch and where it is silent. It
applies nothing: no i18n value, no `CONTEXT.md` text and no landing file was
edited.

### 1. What #274 asks

Issue #274, "PT: rename "programa" to "treino" across the app and glossary"
(owner-authored, `needs-triage`, open; read from GitHub, created 2026-09-26).
Quoted from the issue body (the `## Problem`, `## Scope` and `## Follow-up` headings are flattened to plain lines):

> Round 3 of the landing (candidate S, `docs/design/landing-candidates/round-3/`) says **"treino"** in Portuguese wherever the app says **"programa"**, and uses the possessive ("seu treino" rather than "o programa"). "Programa" reads as app jargon to Brazilian lifters, who call their plan their *treino*. "Sessão" stays the word for one day's workout, so the two never collide.
>
> The app still says "programa" everywhere, so the landing and the app now disagree:
>
> - The landing CTA says **Montar meu treino**; the first-run button it links to says **Montar meu programa**.
> - The landing's secondary link says **Acompanhar meu treino atual**; the app button says **Acompanhar meu programa atual**.
> - When the landing tells visitors which app buttons to tap (the paste hand-off), it has to quote the app's "programa" labels and add a line explaining that the app still calls the treino a programa.
>
> Scope
>
> - Every PT string in `i18n-pt.json` that uses "programa"/"programas" for the lifter's plan, including `landing.build`, `landing.track`, `entry.hub.*`, `onb.*`, `program.*`, `today.no_program.*`, and the share/setup-link copy.
> - Use the possessive where it reads naturally ("seu treino").
> - Wherever PT uses "treino" to mean one day's workout (for example `focus.wo_done_title` "Treino concluído", "histórico de treinos", "dados de treino"), move it to "sessão" so the two meanings don't collide.
> - `CONTEXT.md` glossary: record *treino* as the PT term for **program** and *sessão* for **session**, and add "programa" (PT, user-facing) under *Avoid*.
> - Leave internal identifiers and i18n **keys** unchanged (`program.*`, `landing.build`, and so on). Only values change.
> - Regenerate `i18n.js`, run the cache ritual, and refresh the UI screen catalog.
>
> Follow-up: When this lands, remove the `P` table and the "o app ainda chama…" line from `docs/design/landing-candidates/round-3/index.html`. Its `verify.mjs` fails on purpose as soon as those catalog values move.

Four facts from the catalog that shape the tables below:

- "Programa" and "treino" are both masculine nouns. Replacing the one with the
  other changes no article, possessive or adjective ("o programa atual" becomes
  "o treino atual"); only the plural form changes ("programas" becomes
  "treinos"). Table A therefore has no agreement edits, only collisions.
- "Sessão" is feminine. Every existing "treino" that moves to "sessão" changes
  the articles, possessives and participles around it ("o treino inacabado"
  becomes "a sessão inacabada"). Table B lists each one.
- "Sessão"/"sessões" already appears in 119 PT values, mostly for logged
  or planned sessions, so the second half of the rule extends an existing
  use rather than introducing a word.
- Four PT values call the plan "plano" (`review.diagnosis.continue`,
  `review.preview.title`, `review.staged.done`, `review.done.committed`). #274
  does not mention them; they are a third word for the plan under §8.10 "one
  Portuguese word per thing".

### How the tables were generated

Script kept outside the repository: `/tmp/plan064-terminology-inventory.py`
(tables, counts, landing parse) and `/tmp/plan064-assemble.py` (this section).
Both are read-only over `i18n-pt.json`, `i18n-en.json` and
`git show 336b492d:docs/design/landing-candidates/final/index.html`.

- Table A regex, applied to every PT value, case-insensitive:
  `\bprogramas?\b`. It matches `programa`, `programas`, `Programa`,
  `Programas`. It deliberately does not match `programada(s)` (scheduled, in
  `ex.actions.setup_notes` and `ex.actions.no_setup_notes`) or the placeholder
  `{program}`. Mechanical substitution: `programas` to `treinos`, `programa` to
  `treino`, capital preserved. Nothing else is rewritten.
- Table B regex, applied to every PT value, case-insensitive:
  `\btreinos?\b`. Verb and agent forms (`treinar`, `treina`, `treinou`,
  `treinei`, `treinando`, `Treine`, `Treinados`, `treinador`: 18 keys) are not
  nouns for a workout or a plan, are not touched by #274 and are not listed.
- Table B meaning classes were assigned per occurrence by the script from the
  words before the noun (`dia(s) de`, `bloco de`, `histórico/dados de`,
  `programa de`) and, for the rest, by hand reading of every row. They are
  engineering readings for the owner to check, not decisions.
- Table B "mechanical `sessão` draft" rewrites only the classes #274 names (W and
  H below) and fixes gender on the determiner chain before the noun and on
  participles within three words after it (W only), plus two predicate
  participles by key. It is an agreement check, not proposed copy. Any
  "histórico de sessões" or "dados de sessão" phrasing still needs a copy read.
- Long values show windows around the matches ("…" marks the cut). Every other
  value is complete. EN is shown as it stands; #274 changes no EN value
  (checked for the `P` entries: EN CHANGED).

### 2. Table A: every PT value that says "programa" (211 keys, 227 occurrences, 11 plural)

Surface is derived from the key namespace: `landing`, `meta` are landing;
`entry`, `onb`, `setup` are entry; everything else is app.
Flags: PLURAL (a "programas" in the value), COLLISION (the substituted value
contains "treino" in an existing sense, so after the swap one word carries two
meanings in one string), LABEL (a tab, title or chip, where the word is the
destination name), plus hand notes.

| Key | Surface | Current PT | EN | PT under #274 (mechanical) | Flags |
|---|---|---|---|---|---|
| `meta.description` | landing | O Taurifer mantém seus treinos, rascunhos e histórico neste dispositivo. Links de configuração compartilham um programa e ajustes selecionados. | Taurifer keeps workout logs, drafts, and history on this device. Setup links share a program and selected settings. | O Taurifer mantém seus treinos, rascunhos e histórico neste dispositivo. Links de configuração compartilham um treino e ajustes selecionados. | COLLISION: value already says treino x1 |
| `nav.program` | app | Programa | Program | Treino | LABEL: bottom-nav tab label |
| `stats.pr_filter.program` | app | Programa | Program | Treino | LABEL: filter chip label |
| `exercise.not_in_program` | app | Fora do programa atual | Not in the current program | Fora do treino atual | - |
| `program.aria` | app | Programa | Program | Treino | LABEL: tab aria label |
| `program.eyebrow` | app | Programa | Program | Treino | LABEL: screen eyebrow |
| `program.title` | app | Programa | Program | Treino | LABEL: screen title |
| `program.summary_aria` | app | Resumo do programa | Program summary | Resumo do treino | - |
| `program.advanced.lede` | app | Editar aqui substitui o programa inteiro. Use o editor visual acima para mudanças do dia a dia. | Editing here replaces the whole program. Use the visual editor above for everyday changes. | Editar aqui substitui o treino inteiro. Use o editor visual acima para mudanças do dia a dia. | - |
| `program.json` | app | JSON do programa | Program JSON | JSON do treino | - |
| `program.export_json` | app | Exportar JSON do programa | Export program JSON | Exportar JSON do treino | - |
| `program.import_json` | app | Importar arquivo do programa | Import program file | Importar arquivo do treino | - |
| `program.name` | app | Nome do programa | Program name | Nome do treino | - |
| `program.name.placeholder` | app | Programa sem título | Untitled program | Treino sem título | - |
| `program.beginner_name` | app | Programa iniciante | Beginner program | Treino iniciante | - |
| `program.name_aria` | app | Nome do programa | Program name | Nome do treino | - |
| `program.started_aria` | app | Data de início do programa | Program start date | Data de início do treino | - |
| `program.empty.no_program_exercises` | app | Nenhum exercício no programa. | No exercises in the program. | Nenhum exercício no treino. | - |
| `program.editor.aria` | app | Editor de programa | Program editor | Editor de treino | LABEL: editor aria label |
| `program.editor.program_name` | app | Nome do programa | Program name | Nome do treino | - |
| `program.editor.name_placeholder` | app | Programa sem nome | Untitled program | Treino sem nome | - |
| `program.editor.conflict` | app | Este programa mudou noutra aba. Reveja as suas alterações antes de continuar. | This program changed in another tab. Review your changes before continuing. | Este treino mudou noutra aba. Reveja as suas alterações antes de continuar. | - |
| `settings.create_program` | app | Criar novo programa | Create new program | Criar novo treino | - |
| `settings.beginner_program` | app | Usar programa iniciante | Use beginner-friendly program | Usar treino iniciante | - |
| `settings.danger_lede` | app | O Taurifer exclui o histórico salvo e qualquer treino inacabado. Ele mantém o programa e os ajustes. Exporte um backup antes. | Taurifer deletes the saved log and any unfinished workout. It keeps your program and settings. Export a backup first. | O Taurifer exclui o histórico salvo e qualquer treino inacabado. Ele mantém o treino e os ajustes. Exporte um backup antes. | COLLISION: value already says treino x1 |
| `dialog.block_review.onboarding` | app | Criar outro programa | Start from onboarding again | Criar outro treino | - |
| `dialog.import.program_only` | app | Só o programa | Program only | Só o treino | - |
| `dialog.import.body_program` | app | …ns} sessões novas e não muda mais nada. Substituir tudo sobrescreve o programa, os ajustes e o histórico. Você não pode desfazer essa ação. Só o programa importa os exercícios e mantém seu histórico. | …ns} new sessions and changes nothing else. Replace all overwrites the program, settings, and log. You cannot undo it. Program only imports the exercises and leaves your history unchanged. | …ns} sessões novas e não muda mais nada. Substituir tudo sobrescreve o treino, os ajustes e o histórico. Você não pode desfazer essa ação. Só o treino importa os exercícios e mantém seu histórico. | - |
| `dialog.import.body` | app | … as sessões novas e não muda mais nada. Substituir tudo sobrescreve o programa, os ajustes e o histórico. Você não pode desfazer essa ação. | …the new sessions and changes nothing else. Replace all overwrites the program, settings, and log. You cannot undo it. | … as sessões novas e não muda mais nada. Substituir tudo sobrescreve o treino, os ajustes e o histórico. Você não pode desfazer essa ação. | - |
| `dialog.import.body_program_nolog` | app | Este backup completo tem detalhes do programa e ajustes, mas não tem sessões. ⏎  ⏎ Substituir tudo sobrescreve este dispositivo com o backup. Você não pode desfazer essa ação. Só o programa importa os exercícios e mantém seus ajustes. | This full backup has program details and settings, but no sessions. ⏎  ⏎ Replace all overwrites this device with the backup. You cannot undo it. Program only imports the exercises and leaves your settings unchanged. | Este backup completo tem detalhes do treino e ajustes, mas não tem sessões. ⏎  ⏎ Substituir tudo sobrescreve este dispositivo com o backup. Você não pode desfazer essa ação. Só o treino importa os exercícios e mantém seus ajustes. | - |
| `dialog.import.body_nolog` | app | Este dispositivo tem {curSessions} sessões e {curSets} séries. ⏎ O backup não tem sessões. ⏎  ⏎ Substituir tudo sobrescreve este dispositivo com o programa e os ajustes do backup. Você não pode desfazer essa ação. | This device has {curSessions} sessions and {curSets} sets. ⏎ The backup has no sessions. ⏎  ⏎ Replace all overwrites this device with the backup's program and settings. You cannot undo it. | Este dispositivo tem {curSessions} sessões e {curSets} séries. ⏎ O backup não tem sessões. ⏎  ⏎ Substituir tudo sobrescreve este dispositivo com o treino e os ajustes do backup. Você não pode desfazer essa ação. | - |
| `dialog.storage_recovery.unnamed` | app | Programa sem nome | Untitled program | Treino sem nome | - |
| `review.no_start` | app | Defina uma data de início do bloco na aba Programa para acompanhar o progresso deste mesociclo. | Set a block start date on the Program tab to track progress through this mesocycle. | Defina uma data de início do bloco na aba Treino para acompanhar o progresso deste mesociclo. | - |
| `review.summary.volume` | app | O volume de séries efetivas está em {pct}% do programa. | Hard-set volume is at {pct}% of the program. | O volume de séries efetivas está em {pct}% do treino. | - |
| `block_rec.keep_program_improve_completion.line` | app | Mantenha o programa e conclua mais sessões. | Keep the program and complete more sessions. | Mantenha o treino e conclua mais sessões. | - |
| `rec.block.rising` | app | A força subiu em {sessions} sessões. Mantenha o programa atual. | Strength rose across {sessions} sessions. Keep the current program. | A força subiu em {sessions} sessões. Mantenha o treino atual. | - |
| `glossary.Max effort` | app | Escolha Máx na falha ou perto dela, ou RIR 0. Use na última série ou quando o programa pedir. | Choose Max at or near failure, or RIR 0. Use it for your last set or when the program calls for it. | Escolha Máx na falha ou perto dela, ou RIR 0. Use na última série ou quando o treino pedir. | - |
| `onb.aria` | entry | Criar um programa | Create a program | Criar um treino | - |
| `onb.eyebrow` | entry | Novo programa | New program | Novo treino | - |
| `onb.title.default` | entry | Crie seu programa | Create your program | Crie seu treino | - |
| `onb.title.7` | entry | Revise seu programa | Review your program | Revise seu treino | - |
| `onb.review.save` | entry | Salvar programa | Save program | Salvar treino | - |
| `custom.in_use` | app | Em uso no seu programa ou histórico. Arquivar mantém esses registros intactos. | In use by your program or history. Archiving keeps those records intact. | Em uso no seu treino ou histórico. Arquivar mantém esses registros intactos. | - |
| `toast.custom_in_use` | app | Esse exercício ainda é usado pelo seu programa. | That exercise is still used by your program. | Esse exercício ainda é usado pelo seu treino. | - |
| `toast.program_imported_partial` | app | Programa importado. {n} de {total} exercícios encontrados na biblioteca. | Program imported. {n} of {total} exercises matched the library. | Treino importado. {n} de {total} exercícios encontrados na biblioteca. | - |
| `import.aria` | app | Revisar programa importado | Review imported program | Revisar treino importado | - |
| `import.title` | app | Importar programa | Import program | Importar treino | - |
| `import.commit` | app | Importar programa | Import program | Importar treino | - |
| `toast.program_imported` | app | Programa importado com {n} {exercise}. | Program imported with {n} {exercise}. | Treino importado com {n} {exercise}. | - |
| `toast.program_import_failed` | app | Não foi possível importar o programa. | The program could not be imported. | Não foi possível importar o treino. | - |
| `toast.program_save_failed` | app | Não foi possível salvar o programa. | The program could not be saved. | Não foi possível salvar o treino. | - |
| `guide.entry.body` | app | Monte um programa com orientação, escolha uma opção pronta ou traga um programa que você já tem. | Build a program with guidance, browse a released option, or bring a program you already have. | Monte um treino com orientação, escolha uma opção pronta ou traga um treino que você já tem. | - |
| `setup.shared.title` | entry | Começar este programa | Start this program | Começar este treino | - |
| `setup.shared.invalid` | entry | Este link de programa compartilhado é inválido ou está incompleto. | This shared program link is invalid or incomplete. | Este link de treino compartilhado é inválido ou está incompleto. | - |
| `setup.shared.unsupported` | entry | Este programa compartilhado foi criado por uma versão mais recente do Taurifer. | This shared program was created by a newer version of Taurifer. | Este treino compartilhado foi criado por uma versão mais recente do Taurifer. | - |
| `setup.shared.browser_unsupported` | entry | Este navegador não pode abrir links de programas compartilhados. | This browser cannot open shared program links. | Este navegador não pode abrir links de treinos compartilhados. | PLURAL |
| `setup.shared.too_large` | entry | Este programa é grande demais para caber em um link de configuração. | This program is too large to share as an install-safe link. | Este treino é grande demais para caber em um link de configuração. | - |
| `setup.shared.commit_failed` | entry | Não foi possível iniciar o programa. Tente novamente. | The program could not be started. Try again. | Não foi possível iniciar o treino. Tente novamente. | - |
| `landing.build` | landing | Montar meu programa | Build my program | Montar meu treino | - |
| `landing.track` | landing | Acompanhar meu programa atual | Track my current program | Acompanhar meu treino atual | - |
| `landing.shared.eyebrow` | landing | Programa recebido | Program received | Treino recebido | - |
| `landing.shared.headline` | landing | Seu programa está pronto para treinar. | Your program is ready to train. | Seu treino está pronto para treinar. | - |
| `landing.shared.body` | landing | Revise o programa que enviaram para você e depois comece neste dispositivo. | Review the program that was sent to you, then start it on this device. | Revise o treino que enviaram para você e depois comece neste dispositivo. | - |
| `landing.shared.invalid_headline` | landing | Este link de programa não pode ser usado. | This program link cannot be used. | Este link de treino não pode ser usado. | - |
| `landing.shared.invalid_body` | landing | Nada do link foi salvo. Você ainda pode montar ou importar um programa. | Nothing from the link was saved. You can still build or import a program. | Nada do link foi salvo. Você ainda pode montar ou importar um treino. | - |
| `landing.preview.alt` | landing | O Taurifer mostra três séries de supino registradas com 60 kg e 10 repetições, RIR 2. A próxima meta é 62,5 kg e 8 repetições, dentro das 8–10 repetições e RIR 0–2 do programa. | Taurifer showing three bench-press sets logged at 60 kg for 10 reps, RIR 2. The next target is 62.5 kg for 8 reps, within the program's 8–10 reps and RIR 0–2. | O Taurifer mostra três séries de supino registradas com 60 kg e 10 repetições, RIR 2. A próxima meta é 62,5 kg e 8 repetições, dentro das 8–10 repetições e RIR 0–2 do treino. | - |
| `landing.program.body` | landing | De qualquer forma, o Taurifer transforma isso em um programa completo: seis semanas, divididas nos dias em que você treina, com cada série editável antes de começar. | Either way, Taurifer turns it into a full program: six weeks, split across the days you train, with every set editable before you start. | De qualquer forma, o Taurifer transforma isso em um treino completo: seis semanas, divididas nos dias em que você treina, com cada série editável antes de começar. | - |
| `landing.program.fact1.value` | landing | 5 perguntas → um programa | 5 questions → a program | 5 perguntas → um treino | - |
| `landing.shot.entry_hub.alt` | landing | A tela Criar um programa, com quatro caminhos: recomendar um programa, criar um programa personalizado, explorar programas do Taurifer, ou usar o seu colando um programa ou importando um arquivo. | The Create a program screen offering routes to recommend a program, create a custom program, browse Taurifer programs, or use your own by pasting a program or importing a file. | A tela Criar um treino, com quatro caminhos: recomendar um treino, criar um treino personalizado, explorar treinos do Taurifer, ou usar o seu colando um treino ou importando um arquivo. | PLURAL |
| `landing.shot.recommend_result.alt` | landing | A tela de programa recomendado: Build Muscle, 3 dias, cerca de 55 a 59 minutos, com a lista de motivos pelos quais o programa serve. | The recommended program screen: Build Muscle, three days, about 55 to 59 minutes, with a list of reasons the program fits. | A tela de treino recomendado: Build Muscle, 3 dias, cerca de 55 a 59 minutos, com a lista de motivos pelos quais o treino serve. | - |
| `toast.program_saved` | app | Programa salvo. | Program saved. | Treino salvo. | - |
| `toast.program_saved_muscles_linked` | app | Programa salvo. {name} usa a lista de músculos da biblioteca. Desvincule o exercício para editar os músculos. | Program saved. {name} uses the library's muscle list. Detach it to edit the muscles. | Treino salvo. {name} usa a lista de músculos da biblioteca. Desvincule o exercício para editar os músculos. | - |
| `toast.program_saved_muscles_linked_many` | app | Programa salvo. {n} exercícios vinculados usam as listas de músculos da biblioteca. Desvincule-os para editar os músculos. | Program saved. {n} linked exercises use the library's muscle lists. Detach them to edit the muscles. | Treino salvo. {n} exercícios vinculados usam as listas de músculos da biblioteca. Desvincule-os para editar os músculos. | - |
| `toast.program_import_cancelled` | app | Importação do programa cancelada. | Program import cancelled. | Importação do treino cancelada. | - |
| `toast.program_import_invalid` | app | Esse arquivo não é uma exportação de programa do Taurifer. | That file isn't a Taurifer program export. | Esse arquivo não é uma exportação de treino do Taurifer. | - |
| `toast.freeform_unreadable` | app | Essa resposta não é um programa que o Taurifer consiga ler. Peça o JSON de novo e cole a resposta inteira. | That reply is not a program Taurifer can read. Ask for the JSON again, then paste the whole reply. | Essa resposta não é um treino que o Taurifer consiga ler. Peça o JSON de novo e cole a resposta inteira. | - |
| `toast.program_text_copied` | app | Programa copiado. | Program copied. | Treino copiado. | - |
| `toast.beginner_loaded` | app | Programa para iniciantes carregado. Seu histórico não mudou. | Beginner-friendly program loaded. Your log is unchanged. | Treino para iniciantes carregado. Seu histórico não mudou. | - |
| `toast.onboarding_saved` | app | Programa salvo. | Program saved. | Treino salvo. | - |
| `toast.tweak_program` | app | Ajuste seu programa e salve quando estiver pronto. | Tweak your program, then save when ready. | Ajuste seu treino e salve quando estiver pronto. | - |
| `draft.recovery.program.title` | app | Este treino pertence a um programa anterior | This workout belongs to an earlier program | Este treino pertence a um treino anterior | COLLISION: value already says treino x1 |
| `draft.recovery.program.body` | app | O treino salvo não corresponde ao programa atual. Os dados ficam neste dispositivo até você descartá-los. | The saved workout does not match the current program. Its data remains on this device until you discard it. | O treino salvo não corresponde ao treino atual. Os dados ficam neste dispositivo até você descartá-los. | COLLISION: value already says treino x1 |
| `toast.new_block_same` | app | Novo bloco iniciado com o mesmo programa. | New block started with the same program. | Novo bloco iniciado com o mesmo treino. | - |
| `confirm.remove_exercise` | app | Remover este modelo de exercício do programa? O histórico já registrado permanecerá neste dispositivo. | Remove this exercise template from your program? Its logged history will stay on this device. | Remover este modelo de exercício do treino? O histórico já registrado permanecerá neste dispositivo. | - |
| `confirm.replace_program_template` | app | Substituir seu programa atual? O histórico já registrado será mantido. | Replace your current program? Your logged history stays. | Substituir seu treino atual? O histórico já registrado será mantido. | - |
| `confirm.import_program_replace` | app | Substituir seu programa atual por {n} modelos de exercício deste arquivo? ⏎  ⏎ Seu histórico de treinos e seus ajustes continuam iguais. O nome do programa vem do arquivo. Sua data de início permanece. | Replace your current program with {n} exercise templates from this file? ⏎  ⏎ Your training log and settings are not touched. The program name comes from the file; your start date stays. | Substituir seu treino atual por {n} modelos de exercício deste arquivo? ⏎  ⏎ Seu histórico de treinos e seus ajustes continuam iguais. O nome do treino vem do arquivo. Sua data de início permanece. | COLLISION: value already says treino x1 |
| `confirm.delete_log` | app | Apagar o histórico de treinos? Isso remove as séries salvas e qualquer rascunho de treino inacabado. O programa e os Ajustes permanecem. | Delete workout history? This removes saved log rows and any unfinished workout draft. Your program and Settings stay. | Apagar o histórico de treinos? Isso remove as séries salvas e qualquer rascunho de treino inacabado. O treino e os Ajustes permanecem. | COLLISION: value already says treino x2 |
| `confirm.replace_program_discard_draft` | app | Substituir seu programa descartará este treino inacabado. O histórico de treinos salvo e os Ajustes permanecerão. Continuar? | Replacing your program will discard this unfinished workout. Saved workout history and Settings will stay. Continue? | Substituir seu treino descartará este treino inacabado. O histórico de treinos salvo e os Ajustes permanecerão. Continuar? | COLLISION: value already says treino x2 |
| `untitled_program` | app | Programa sem título | Untitled program | Treino sem título | - |
| `privacy.setup.title` | app | Links de configuração de programa | Program setup links | Links de configuração de treino | - |
| `privacy.setup.body` | app | Um link de configuração leva uma proposta de programa no fragmento #setup=. Ele é um link portador sem criptografia: qualqu… … … até sete dias. Ele nunca inclui registros de treino nem histórico de programas. | A setup link carries a program proposal in its #setup= fragment. It is an unencrypted bearer link, s… … …e static host for up to seven days. It never includes workout logs or program history. | Um link de configuração leva uma proposta de treino no fragmento #setup=. Ele é um link portador sem criptografia: qualqu… … …sta ao host estático por até sete dias. Ele nunca inclui registros de treino nem histórico de treinos. | PLURAL; COLLISION: value already says treino x1 |
| `privacy.controls.body` | app | …s registros e o rascunho ativo do armazenamento local, mas mantém seu programa e as Configurações. A ação separada de apagar tudo informa o que será… | …moves logs and the active draft from local storage while keeping your program and Settings. The separate delete-all action names everything it remo… | …SON antes de mudar de navegador ou limpar este. Apagar o histórico de treinos remove definitivamente os registros e o rascunho ativo do armazenamento local, mas mantém seu treino e as Configurações. A ação separada de apagar tudo informa o que será… | COLLISION: value already says treino x1 |
| `privacy.transfer.contents` | app | A cópia lógica criptografada inclui o programa e o estado de treino normalizados, histórico, arquivo e proveniência, rascunho de treino ativo, configuração de programa não concluída, preferências da interface, consentimento de análise e … | The encrypted logical clone includes your normalized program and workout state, history, archive and provenance, active workout draft, unfinished program setup, UI preferences, analytics consent, and stable telemetry identi… | A cópia lógica criptografada inclui o treino e o estado de treino normalizados, histórico, arquivo e proveniência, rascunho de treino ativo, configuração de treino não concluída, preferências da interface, consentimento de análise e … | COLLISION: value already says treino x2 |
| `settings.group.program` | app | Programa e progressão | Program & progression | Treino e progressão | LABEL: settings group title |
| `today.no_program.title` | app | Nenhum programa ainda | No program yet | Nenhum treino ainda | - |
| `today.no_program.body` | app | O Taurifer planeja suas sessões a partir de um programa. Configure um e o treino de hoje aparece aqui. | Taurifer plans your sessions from a program. Set one up and today's training appears here. | O Taurifer planeja suas sessões a partir de um treino. Configure um e o treino de hoje aparece aqui. | COLLISION: value already says treino x1 |
| `today.no_program.cta` | app | Configurar um programa | Set up a program | Configurar um treino | - |
| `today.choose_day_sub` | app | Escolha qual dia do seu programa você quer treinar hoje. | Pick which day of your program to train today. | Escolha qual dia do seu treino você quer treinar hoje. | - |
| `program.ready.back` | app | ‹ Voltar ao programa | ‹ Back to program | ‹ Voltar ao treino | - |
| `program.export_text.title` | app | Programa em texto | Program as text | Treino em texto | - |
| `program.share_setup_sub` | app | Programa, ajustes e idioma do app · sem histórico de treinos | Program, settings and app language · no workout history | Treino, ajustes e idioma do app · sem histórico de treinos | COLLISION: value already says treino x1 |
| `program.share_setup_title` | app | Compartilhar configuração do programa | Share program setup | Compartilhar configuração do treino | - |
| `program.share_setup_body` | app | Crie um link de configuração para este programa. Copie o link ou abra o menu de compartilhamento do sistema. | Create a setup link for this program. Copy the link or open the system Share sheet. | Crie um link de configuração para este treino. Copie o link ou abra o menu de compartilhamento do sistema. | - |
| `program.share_setup_invalid` | app | Este programa tem ajustes que um link de configuração não aceita. | This program has settings that cannot be included in a setup link. | Este treino tem ajustes que um link de configuração não aceita. | - |
| `onb.import_footer` | entry | Já tenho um programa · Importar | I already have a program · Import | Já tenho um treino · Importar | - |
| `block_strategy.onboarding.cap` | app | Criar um novo programa | Create a new program | Criar um novo treino | - |
| `onb.have_program` | entry | Já tenho um programa | I already have a program | Já tenho um treino | - |
| `entry.eyebrow` | entry | Criar um programa | Create a program | Criar um treino | - |
| `entry.route.custom` | entry | Programa personalizado | Custom program | Treino personalizado | - |
| `entry.route.browse` | entry | Explorar programas | Browse programs | Explorar treinos | PLURAL |
| `entry.route.build` | entry | Montar um programa | Build a program | Montar um treino | - |
| `entry.route.import` | entry | Importar um programa | Import a program | Importar um treino | - |
| `entry.route.shared` | entry | Programa compartilhado | Shared program | Treino compartilhado | - |
| `entry.cancel_confirm.title` | entry | Sair da configuração do programa? | Leave program setup? | Sair da configuração do treino? | - |
| `entry.active_notice` | entry | Seu programa atual permanece ativo até você confirmar uma substituição. | Your current program stays active until you confirm a replacement. | Seu treino atual permanece ativo até você confirmar uma substituição. | - |
| `entry.resume.body` | entry | Há uma configuração de programa incompleta neste dispositivo. | You have an unfinished program setup on this device. | Há uma configuração de treino incompleta neste dispositivo. | - |
| `entry.corrupt.body` | entry | A configuração incompleta foi limpa. Seu programa ativo não foi alterado. | The unfinished setup was cleared. Your active program was not changed. | A configuração incompleta foi limpa. Seu treino ativo não foi alterado. | - |
| `entry.save_failed.body` | entry | Seu programa ativo não foi alterado. Mantenha esta página aberta e tente novamente. | Your active program was not changed. Keep this page open and try again. | Seu treino ativo não foi alterado. Mantenha esta página aberta e tente novamente. | - |
| `entry.save_conflict.body` | entry | Seu programa ativo não foi alterado. Recarregue para continuar com o rascunho mais recente. | Your active program was not changed. Reload to continue from the newer saved draft. | Seu treino ativo não foi alterado. Recarregue para continuar com o rascunho mais recente. | - |
| `entry.durable_conflict.body` | entry | Este programa não foi ativado. Recarregue para revisar o estado salvo mais recente antes de tentar novamente. | This program was not activated. Reload to review the latest saved state before trying again. | Este treino não foi ativado. Recarregue para revisar o estado salvo mais recente antes de tentar novamente. | - |
| `entry.rules_changed.title` | entry | As regras do programa mudaram | Program rules have changed | As regras do treino mudaram | - |
| `entry.rules_changed.body_rebuild` | entry | A Taurifer mudou a forma como cria programas desde que guardou este. Reconstrua-o para usar as regras atuais. | Taurifer changed how programs are built since you saved this one. Rebuild it to use the current rules. | A Taurifer mudou a forma como cria treinos desde que guardou este. Reconstrua-o para usar as regras atuais. | PLURAL |
| `entry.rules_changed.body_keep` | entry | A Taurifer mudou a forma como cria programas desde que guardou este. Continua a funcionar como está, por isso pode mantê-lo. | Taurifer changed how programs are built since you saved this one. It still runs as saved, so you can keep it. | A Taurifer mudou a forma como cria treinos desde que guardou este. Continua a funcionar como está, por isso pode mantê-lo. | PLURAL |
| `entry.conflict.title` | entry | Seu programa ativo mudou | Your active program changed | Seu treino ativo mudou | - |
| `entry.conflict.body` | entry | Outra alteração atualizou o programa ativo enquanto esta configuração estava aberta. Revise de novo antes de substituí-lo. | Another change updated the active program while this setup was open. Review again before replacing it. | Outra alteração atualizou o treino ativo enquanto esta configuração estava aberta. Revise de novo antes de substituí-lo. | - |
| `entry.activation_conflict.title` | entry | Seu programa ativo mudou | Your active program changed | Seu treino ativo mudou | - |
| `entry.hub.title` | entry | Criar um programa | Create a program | Criar um treino | - |
| `entry.hub.lede` | entry | Escolha como começar seu primeiro programa. | Choose how to start your first program. | Escolha como começar seu primeiro treino. | - |
| `entry.hub.group.written` | entry | O Taurifer monta o programa | Taurifer builds the program | O Taurifer monta o treino | - |
| `entry.hub.group.browse` | entry | Escolha um programa pronto | Choose a ready-made program | Escolha um treino pronto | - |
| `entry.hub.recommend.title` | entry | Recomendar um programa | Recommend a program | Recomendar um treino | - |
| `entry.hub.recommend.cap` | entry | Responda a algumas perguntas. O Taurifer monta o programa. | Answer a few questions. Taurifer builds the program. | Responda a algumas perguntas. O Taurifer monta o treino. | - |
| `entry.hub.custom.title` | entry | Criar um programa personalizado | Create a custom program | Criar um treino personalizado | - |
| `entry.hub.custom.cap` | entry | Escolha prioridades musculares e exercícios para incluir ou evitar. O Taurifer monta o programa. | Choose muscle priorities and exercises to include or avoid. Taurifer builds the program. | Escolha prioridades musculares e exercícios para incluir ou evitar. O Taurifer monta o treino. | - |
| `entry.hub.browse.title` | entry | Explorar programas Taurifer | Browse Taurifer programs | Explorar treinos Taurifer | PLURAL |
| `entry.hub.browse.cap` | entry | Escolha um programa completo por objetivo e frequência. | Choose a complete program by purpose and schedule. | Escolha um treino completo por objetivo e frequência. | - |
| `entry.hub.own.title` | entry | Usar meu próprio programa | Use my own program | Usar meu próprio treino | - |
| `entry.hub.own.cap` | entry | Comece com dias vazios, cole qualquer programa ou importe um arquivo Taurifer. | Start with empty days, paste any program, or import a Taurifer file. | Comece com dias vazios, cole qualquer treino ou importe um arquivo Taurifer. | - |
| `entry.hub.build.title` | entry | Montar um programa | Build a program | Montar um treino | - |
| `entry.hub.import.title` | entry | Importar um programa | Import a program | Importar um treino | - |
| `entry.hub.import.cap` | entry | Revise o arquivo ou a configuração antes de usar o programa. | Review a Taurifer program file or setup before using it. | Revise o arquivo ou a configuração antes de usar o treino. | - |
| `entry.desired_result.title` | entry | O que você quer deste programa? | What do you want from this program? | O que você quer deste treino? | - |
| `entry.desired_result.lede` | entry | Escolha o que este programa deve priorizar. | Choose what this program should prioritize. | Escolha o que este treino deve priorizar. | - |
| `entry.background.experience.label` | entry | Há quanto tempo você segue programas estruturados de resistência | How long you've followed structured resistance programs | Há quanto tempo você segue treinos estruturados de resistência | PLURAL; generic sense (experience with structured programs), not the active plan |
| `entry.background.experience.first` | entry | Primeiro programa estruturado | First structured program | Primeiro treino estruturado | generic sense (first structured program), not the active plan |
| `entry.priorities.must_hint` | entry | O Taurifer inclui um exercício selecionado apenas quando ele combina com a estrutura do programa e seu equipamento. | Taurifer includes a selected exercise only when it fits the program structure and your equipment. | O Taurifer inclui um exercício selecionado apenas quando ele combina com a estrutura do treino e seu equipamento. | - |
| `entry.custom_shape.title_sole` | entry | A estrutura do seu programa | Your weekly structure | A estrutura do seu treino | - |
| `entry.custom_shape.generate` | entry | Gerar programa | Generate program | Gerar treino | - |
| `entry.result.title` | entry | Programa recomendado | Recommended program | Treino recomendado | - |
| `entry.result.custom_title` | entry | Seu programa personalizado | Your custom program | Seu treino personalizado | - |
| `entry.result.lede` | entry | As mesmas respostas e regras produzem o mesmo programa todas as vezes. | The same answers and rules produce the same program every time. | As mesmas respostas e regras produzem o mesmo treino todas as vezes. | - |
| `entry.result.explain` | entry | Este programa usa seu objetivo, seu treino recente, sua agenda e sua principal restrição. | This program uses your goal, recent training, schedule, and main constraint. | Este treino usa seu objetivo, seu treino recente, sua agenda e sua principal restrição. | COLLISION: value already says treino x1 |
| `entry.result.why_interrupted` | entry | Como você completou cerca de metade dos treinos recentes, a primeira semana reduz temporariamente o trabalho antes de retomar o programa normal. | Because you completed about half of your recent training, the first week temporarily reduces work before the normal program resumes. | Como você completou cerca de metade dos treinos recentes, a primeira semana reduz temporariamente o trabalho antes de retomar o treino normal. | COLLISION: value already says treino x1 |
| `entry.result.review` | entry | Revisar este programa | Review this program | Revisar este treino | - |
| `entry.result.change_custom` | entry | Alterar escolhas do programa | Change custom choices | Alterar escolhas do treino | - |
| `entry.catalogue.title` | entry | Programas Taurifer | Taurifer programs | Treinos Taurifer | PLURAL |
| `entry.catalogue.lede` | entry | Programas completos que você pode executar, renomear e editar depois de ativá-los. | Complete programs you can run, rename, and edit after activation. | Treinos completos que você pode executar, renomear e editar depois de ativá-los. | PLURAL |
| `entry.catalogue.select` | entry | Pré-visualizar este programa | Preview this program | Pré-visualizar este treino | - |
| `entry.catalogue.mismatch_frequency` | entry | Você escolheu {requested} dias; este programa usa {actual}. | You chose {requested} days; this program uses {actual}. | Você escolheu {requested} dias; este treino usa {actual}. | - |
| `entry.catalogue.review` | entry | Revisar programa | Review program | Revisar treino | - |
| `entry.catalogue.empty_title` | entry | Nenhum programa disponível combina com estas respostas | No available program fits these answers | Nenhum treino disponível combina com estas respostas | - |
| `entry.catalogue.empty_body` | entry | Mude a agenda ou os equipamentos. O Taurifer só mostra programas completos que podem ser executados como estão. | Change the schedule or equipment. Taurifer only shows complete programs that can run as listed. | Mude a agenda ou os equipamentos. O Taurifer só mostra treinos completos que podem ser executados como estão. | PLURAL |
| `entry.build_setup.title` | entry | Montar um programa | Build a program | Montar um treino | - |
| `entry.build_setup.name` | entry | Nome do programa | Program name | Nome do treino | - |
| `entry.build_setup.name_placeholder` | entry | O meu programa | My program | O meu treino | - |
| `entry.build_editor_title` | entry | Montar um programa | Build a program | Montar um treino | - |
| `entry.editor.use` | entry | Usar este programa | Use this program | Usar este treino | - |
| `entry.import_source.title` | entry | Importar um programa | Import a program | Importar um treino | - |
| `entry.import_source.lede` | entry | Escolha um arquivo de programa Taurifer. Revise cada exercício antes de ativar o programa. | Choose a Taurifer program file. Review every exercise before you activate the program. | Escolha um arquivo de treino Taurifer. Revise cada exercício antes de ativar o treino. | - |
| `entry.import_source.to_freeform` | entry | Colar um programa | Paste a program instead | Colar um treino | - |
| `entry.freeform.title` | entry | Colar um programa de qualquer lugar | Paste a program from anywhere | Colar um treino de qualquer lugar | - |
| `entry.freeform.lede` | entry | Cole da forma que tiver: de um treinador, notas, folha de cálculo ou de outro local. O Taurifer cria um comando para o ChatGPT ou Claude, que devolve o programa no formato da aplicação. | Paste it however you have it: from a coach, notes app, spreadsheet or anywhere else. Taurifer wraps it in a prompt for ChatGPT or Claude, which sends the program back in the format this app reads. | Cole da forma que tiver: de um treinador, notas, folha de cálculo ou de outro local. O Taurifer cria um comando para o ChatGPT ou Claude, que devolve o treino no formato da aplicação. | - |
| `entry.freeform.input_label` | entry | Seu programa | Your program | Seu treino | - |
| `entry.freeform.needs_input` | entry | Cole o seu programa acima primeiro. | Paste your program above first. | Cole o seu treino acima primeiro. | - |
| `entry.freeform.review` | entry | Rever o programa | Review the program | Rever o treino | - |
| `entry.freeform.source_name` | entry | Programa colado | Pasted program | Treino colado | - |
| `entry.freeform.prompt` | entry | Reescreva este programa de treino como JSON para o app Taurifer. Responda apenas com o JSON: … … …o. ⏎  ⏎ Use exatamente este formato: ⏎ {"version":3,"meta":{"name":"Nome do programa"},"exercises":[{"day":"Nome do dia","order":1,"name":"Nome do exercíc… … …de fora aquecimentos, cardio e tudo que não for série de trabalho. ⏎  ⏎ O programa: ⏎  ⏎ {program} | Rewrite this training program as JSON for the Taurifer app. Reply with the JSON and nothing else: n… … …no code fences. ⏎  ⏎ Use exactly this shape: ⏎ {"version":3,"meta":{"name":"Program name"},"exercises":[{"day":"Day label","order":1,"name":"Exercise nam… … …ut warm-ups, cardio and anything that is not a working exercise. ⏎  ⏎ The program: ⏎  ⏎ {program} | Reescreva este treino de treino como JSON para o app Taurifer. Responda apenas com o JSON: sem explic… … …o. ⏎  ⏎ Use exatamente este formato: ⏎ {"version":3,"meta":{"name":"Nome do treino"},"exercises":[{"day":"Nome do dia","order":1,"name":"Nome do exercíc… … …e origem, no mesmo idioma. ⏎ - Uma entrada por exercício de cada dia de treino. Repita "day" em todos os exercícios do dia e numere "order" a partir… … …de fora aquecimentos, cardio e tudo que não for série de trabalho. ⏎  ⏎ O treino: ⏎  ⏎ {program} | COLLISION: value already says treino x2; COLLISION: "programa de treino" becomes "treino de treino"; placeholder {program} untouched; LLM PROMPT: text sent to ChatGPT or Claude |
| `entry.preview.title` | entry | Revisar programa | Review program | Revisar treino | - |
| `entry.preview.lede` | entry | Este rascunho pode ser editado. Seu programa ativo permanece igual até você confirmar. | This draft is editable. Your active program stays unchanged until you confirm. | Este rascunho pode ser editado. Seu treino ativo permanece igual até você confirmar. | - |
| `entry.preview.activate_first` | entry | Usar este programa | Use this program | Usar este treino | - |
| `entry.preview.activate_replace` | entry | Arquivar o programa atual e usar este | Archive current program and use this one | Arquivar o treino atual e usar este | - |
| `entry.preview.source.custom` | entry | Programa personalizado pelo Taurifer | Taurifer custom program | Treino personalizado pelo Taurifer | - |
| `entry.preview.source.import` | entry | Programa importado | Imported program | Treino importado | - |
| `entry.preview.source.shared` | entry | Programa Taurifer compartilhado | Shared Taurifer program | Treino Taurifer compartilhado | - |
| `entry.preview.equipment_unspecified` | entry | Este programa não especificou equipamentos. | This program did not specify equipment. | Este treino não especificou equipamentos. | - |
| `entry.preview.progression_manual` | entry | O programa define a meta de cada exercício, ou você a define. O Taurifer não inventa carga nem repetições. | The program sets each exercise's target, or you set it yourself. Taurifer does not invent load or rep suggestions. | O treino define a meta de cada exercício, ou você a define. O Taurifer não inventa carga nem repetições. | - |
| `entry.preview.progression_incompatible` | entry | Este programa inclui detalhes de progressão que o Taurifer ainda não consegue verificar. | This program includes progression details Taurifer cannot verify yet. | Este treino inclui detalhes de progressão que o Taurifer ainda não consegue verificar. | - |
| `entry.preview.activation_blocked` | entry | Você ainda não pode ativar este programa. Revise ou remova primeiro os detalhes de progressão incompatíveis. | You cannot activate this program yet. Review or remove the unsupported progression details first. | Você ainda não pode ativar este treino. Revise ou remova primeiro os detalhes de progressão incompatíveis. | - |
| `entry.editor.exercise_invalid` | entry | Corrija os dados inválidos do exercício antes de usar este programa. | Fix the invalid exercise details before using this program. | Corrija os dados inválidos do exercício antes de usar este treino. | - |
| `entry.editor.progression_invalid` | entry | Escolha uma progressão compatível para cada exercício antes de usar este programa. | Choose a supported progression for every exercise before using this program. | Escolha uma progressão compatível para cada exercício antes de usar este treino. | - |
| `entry.editor.title` | entry | Montar um programa | Build a program | Montar um treino | - |
| `entry.confirm.replace` | entry | Substituir o programa atual? O histórico salvo permanece. O Taurifer arquiva o programa ativo. | Replace your current program? Logged history stays. Taurifer archives the active program. | Substituir o treino atual? O histórico salvo permanece. O Taurifer arquiva o treino ativo. | - |
| `entry.freeform.edit_source_warning` | entry | Editar o programa colado limpará a resposta do assistente. | Editing your pasted program will clear the assistant's reply. | Editar o treino colado limpará a resposta do assistente. | - |
| `entry.freeform.gaps_lede` | entry | O assistente devolveu a estrutura do programa, mas faltam algumas séries ou repetições. Preencha abaixo para continuar. | The assistant returned the program structure, but some sets or rep ranges were not specified. Enter them below to continue. | O assistente devolveu a estrutura do treino, mas faltam algumas séries ou repetições. Preencha abaixo para continuar. | - |
| `entry.freeform.gaps_submit` | entry | Rever o programa | Review the program | Rever o treino | - |
| `entry.freeform.unreadable_title` | entry | Não foi possível ler o programa | Could not read program | Não foi possível ler o treino | - |
| `entry.freeform.unreadable_body` | entry | A resposta do assistente não pôde ser lida como um programa Taurifer. Pode editar a resposta, tentar outro assistente ou copiar um comando de correção. | The assistant's reply could not be read as a Taurifer program. You can edit the reply, try another assistant, or copy a repair prompt. | A resposta do assistente não pôde ser lida como um treino Taurifer. Pode editar a resposta, tentar outro assistente ou copiar um comando de correção. | - |
| `entry.freeform.repair_invalid_rows` | entry | Não consegui ler a tua última resposta como um programa. Algumas entradas não tinham "day" ou "name", ou traziam números fora… … …vez, com todas as entradas completas. Não inventes nenhum valor que o programa não indique: deixa o campo de fora e nomeia-o em "missing". | I could not read your last reply as a program. Some entries were missing "day" or "name", or carried numbers outsid… … …ole JSON again with every entry complete. Do not invent any value the program does not state: leave the field out and name it in "missing" instead. | Não consegui ler a tua última resposta como um treino. Algumas entradas não tinham "day" ou "name", ou traziam números fora… … …vez, com todas as entradas completas. Não inventes nenhum valor que o treino não indique: deixa o campo de fora e nomeia-o em "missing". | - |
| `entry.freeform.repair_assemble_failed` | entry | O programa continuou a ser rejeitado depois de eu preencher os números em falta.… | The program was still rejected after I filled in the missing numbers. Send the wh… | O treino continuou a ser rejeitado depois de eu preencher os números em falta.… … …mente no formato que te dei, com uma entrada por exercício por dia de treino e com "day", "order" e "name" em todas as entradas. | COLLISION: value already says treino x1 |
| `landing.proof.program` | landing | 01 / O programa | 01 / The program | 01 / O treino | - |
| `landing.closing.body` | landing | Monte um programa do zero, ou traga o que você já treina. De qualquer jeito, sua próxima série já está decidida. | Build a program from scratch, or bring the one you already run. Either way, your next set is already decided. | Monte um treino do zero, ou traga o que você já treina. De qualquer jeito, sua próxima série já está decidida. | - |
| `review.action.repeat` | app | Repetir este programa no próximo bloco | Repeat this program next block | Repetir este treino no próximo bloco | - |
| `review.action.guided_edit` | app | Ajustar meu programa manualmente | Adjust my program manually | Ajustar meu treino manualmente | - |
| `review.diagnosis.edit` | app | Abrir meu programa no editor | Open my program in the editor | Abrir meu treino no editor | - |
| `review.preview.provenance` | app | Recompilado a partir da configuração original do seu programa pelo compilador do Taurifer. | Recompiled from your program's original setup by the Taurifer compiler. | Recompilado a partir da configuração original do seu treino pelo compilador do Taurifer. | - |
| `review.preview.cancel` | app | Manter o programa atual | Keep current program | Manter o treino atual | - |
| `review.staged.done` | app | Nenhum plano compilado corresponde a essa restrição. Seu programa foi carregado no editor com o diagnóstico anexado; nada muda até você editar e ativar. | No compiled plan matches that constraint. Your program was loaded into the editor with the diagnosis attached; nothing changes until you edit and activate. | Nenhum plano compilado corresponde a essa restrição. Seu treino foi carregado no editor com o diagnóstico anexado; nada muda até você editar e ativar. | - |
| `review.error.stale` | app | Esta proposta está desatualizada porque o programa mudou. Nada foi modificado. Revise e tente de novo. | This proposal is out of date because the program changed. Nothing was modified. Review and try again. | Esta proposta está desatualizada porque o treino mudou. Nada foi modificado. Revise e tente de novo. | - |
| `review.volume.body` | app | O Taurifer removerá primeiro o trabalho opcional e manterá o trabalho protegido e cada mínimo definido pelo compilador. Você revisará o programa exato antes de confirmar. | Taurifer will remove optional work first and keep protected work and each compiler-authored minimum. You will review the exact program before confirming. | O Taurifer removerá primeiro o trabalho opcional e manterá o trabalho protegido e cada mínimo definido pelo compilador. Você revisará o treino exato antes de confirmar. | - |
| `review.volume.committed` | app | Programa de menor volume ativo. | Lower-volume program active. | Treino de menor volume ativo. | - |
| `review.recovery.week1_body` | app | A prescrição de recuperação aprovada está ativa nesta semana. A segunda semana volta ao programa canônico. | The approved recovery prescription is active this week. Week two returns to the canonical program. | A prescrição de recuperação aprovada está ativa nesta semana. A segunda semana volta ao treino canônico. | compiler term ("programa canônico") |

### 3. Table B: every PT value that says "treino" or "treinos" today (118 keys, 124 occurrences)

Current meaning classes, counted per occurrence:

| Class | Meaning today | Occurrences | Keys | #274 |
|---|---|---|---|---|
| W | one workout | 61 | 59 | named: move to `sessão` |
| H | workout history / data | 25 | 25 | named: move to `sessão` |
| TD | training day | 20 | 20 | not covered by the issue text |
| TB | training block | 3 | 3 | not covered by the issue text |
| ACT | training (activity, general) | 12 | 12 | not covered by the issue text |
| AMB | ambiguous (plan or workouts) | 2 | 2 | not covered by the issue text |
| PC | the plan ("programa de treino") | 1 | 1 | not covered by the issue text |

No existing value uses "treino" for the plan in a way that is unambiguous. The
two AMB rows are the closest: `landing.body` ("monta seus treinos") and
`entry.schedule.title` ("Encaixe o treino na sua semana") can read as the plan
or as workouts. One more row, `entry.freeform.prompt`, writes "programa de
treino" for the plan, so the swap there reads "treino de treino".

Where #274 is silent, the rows say "owner reading needed": the issue names one
workout ("Treino concluído"), the history ("histórico de treinos") and the data
("dados de treino"), but not the training day ("dia de treino"), the block
("bloco de treino") or training as an activity. The training day is a separate
glossary term in `CONTEXT.md` (**Training day**, Avoid: Session).

| Key | Surface | Current PT | EN | Current meaning | #274 | Mechanical `sessão` draft (agreement changes) |
|---|---|---|---|---|---|---|
| `meta.description` | landing | O Taurifer mantém seus treinos, rascunhos e histórico neste dispositivo. Links de configuração compartilham um programa e ajustes selecionados. | Taurifer keeps workout logs, drafts, and history on this device. Setup links share a program and selected settings. | H (workout history / data) | named by #274: move to sessão | O Taurifer mantém suas sessões, rascunhos e histórico neste dispositivo. Links de configuração compartilham um programa e ajustes selecionados. <br>agreement: seus->suas |
| `focus.wo_done_title` | app | Treino concluído | Workout complete | W (one workout) | named by #274: move to sessão | Sessão concluída <br>agreement: concluído->concluída |
| `log.aria` | app | Registrar treino | Log workout | W (one workout) | named by #274: move to sessão | Registrar sessão |
| `log.training_day_aria` | app | Dia de treino | Training day | TD (training day) | #274 text silent; owner reading needed | - |
| `log.finish` | app | Finalizar treino | Finish workout | W (one workout) | named by #274: move to sessão | Finalizar sessão |
| `log.unfinished.body` | app | Você tem séries não salvas. Abra Hoje e toque em Finalizar treino. | You have unsaved sets. Open Today and tap Finish workout. | W (one workout) | named by #274: move to sessão | Você tem séries não salvas. Abra Hoje e toque em Finalizar sessão. |
| `session_banner.today.title` | app | O treino de hoje é {day} | Today's workout is {day} | W (one workout) | named by #274: move to sessão | A sessão de hoje é {day} <br>agreement: O->A |
| `stats.empty.body` | app | Registre um treino para ver as estatísticas das suas séries. | Log a workout to see stats from your sets. | W (one workout) | named by #274: move to sessão | Registre uma sessão para ver as estatísticas das suas séries. <br>agreement: um->uma |
| `stats.empty.cta` | app | Registrar seu primeiro treino | Log your first workout | W (one workout) | named by #274: move to sessão | Registrar sua primeira sessão <br>agreement: primeiro->primeira, seu->sua |
| `attention.stale.lead` | app | Sem treino recente | Not trained recently | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `attention.stale.why` | app | Último treino há {n} dias. | Last trained {n} days ago. | W (one workout) | named by #274: move to sessão | Última sessão há {n} dias. <br>agreement: Último->Última |
| `program.planned_volume.lede` | app | Estes totais contam cada dia de treino uma vez por semana. Veja <b>Progresso → Séries efetivas concluídas</b> para comparar com o que você registrou. | These totals count each training day once per week. See <b>Stats → Completed hard sets</b> to compare them with your log. | TD (training day) | #274 text silent; owner reading needed | - |
| `program.no_program.body` | app | Configure um e os dias de treino, o volume e as configurações de progressão ficam aqui. | Set one up and its training days, volume and progression settings live here. | TD (training day) | #274 text silent; owner reading needed | - |
| `program.empty.days` | app | Nenhum dia de treino ainda. Adicione um para começar a montar sua divisão. | No training days yet. Add one to start building your split. | TD (training day) | #274 text silent; owner reading needed | - |
| `program.editor.empty_days` | app | Adicione um exercício a cada dia de treino. | Add an exercise to each training day. | TD (training day) | #274 text silent; owner reading needed | - |
| `program.editor.workout_conflict.title` | app | Treino em andamento | Workout in progress | W (one workout) | named by #274: move to sessão | Sessão em andamento |
| `program.editor.workout_conflict.body` | app | Estas alterações afetam o seu treino inacabado. Aplique-as e descarte esse treino, ou continue a editar. | These changes affect your unfinished workout. Apply them and discard that workout, or keep editing. | W (one workout) | named by #274: move to sessão | Estas alterações afetam a sua sessão inacabada. Aplique-as e descarte essa sessão, ou continue a editar. <br>agreement: seu->sua, o->a, inacabado->inacabada, esse->essa |
| `program.editor.apply_discard_workout` | app | Aplicar e descartar treino | Apply and discard workout | W (one workout) | named by #274: move to sessão | Aplicar e descartar sessão |
| `program.progression.sets` | app | Séries do treino | Workout sets | W (one workout) | named by #274: move to sessão | Séries da sessão <br>agreement: do->da |
| `program.progression.error.active_sets` | app | Conclua ou descarte este treino antes de reduzir séries já iniciadas. | Finish or discard this workout before reducing sets you have started. | W (one workout) | named by #274: move to sessão | Conclua ou descarte esta sessão antes de reduzir séries já iniciadas. <br>agreement: este->esta |
| `settings.voice_lede` | app | O navegador determina se a entrada por voz está disponível. Quando você ativa a opção, o menu ⋯ do treino mostra Entrada por voz. O provedor do navegador pode processar o que você diz. | Your browser controls whether voice input is available. When you enable it, the workout ⋯ menu shows Voice input. Your browser provider may process what you say. | W (one workout) | named by #274: move to sessão | O navegador determina se a entrada por voz está disponível. Quando você ativa a opção, o menu ⋯ da sessão mostra Entrada por voz. O provedor do navegador pode processar o que você diz. <br>agreement: do->da |
| `settings.notifications.missed` | app | Dia perdido (após o horário usual de treino) | Missed day (after usual training hour) | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `settings.guides_body` | app | Veja um guia novamente sem alterar seus dados de treino. | Replay one guide without changing your training data. | H (workout history / data) | named by #274: move to sessão | Veja um guia novamente sem alterar seus dados de sessão. |
| `settings.danger_lede` | app | O Taurifer exclui o histórico salvo e qualquer treino inacabado. Ele mantém o programa e os ajustes. Exporte um backup antes. | Taurifer deletes the saved log and any unfinished workout. It keeps your program and settings. Export a backup first. | W (one workout) | named by #274: move to sessão | O Taurifer exclui o histórico salvo e qualquer sessão inacabada. Ele mantém o programa e os ajustes. Exporte um backup antes. <br>agreement: inacabado->inacabada |
| `settings.delete_log` | app | Apagar histórico de treinos | Delete log | H (workout history / data) | named by #274: move to sessão | Apagar histórico de sessões |
| `dialog.storage_recovery.none_valid` | app | O Taurifer não conseguiu ler um histórico de treinos válido neste navegador. Seus dados brutos salvos ainda estão aqui. | Taurifer could not read a valid training log from this browser. Your raw saved data is still here. | H (workout history / data) | named by #274: move to sessão | O Taurifer não conseguiu ler um histórico de sessões válido neste navegador. Seus dados brutos salvos ainda estão aqui. |
| `dialog.storage_recovery.invalid_copy` | app | Esta cópia está danificada, então o Taurifer não pode abri-la como histórico de treinos. | This copy is damaged, so Taurifer cannot open it as a training log. | H (workout history / data) | named by #274: move to sessão | Esta cópia está danificada, então o Taurifer não pode abri-la como histórico de sessões. |
| `dialog.end_block.aria` | app | Encerrar bloco de treino | End training block | TB (training block) | #274 text silent; owner reading needed | - |
| `dialog.end_block.title` | app | Encerrar este bloco de treino? | End this training block? | TB (training block) | #274 text silent; owner reading needed | - |
| `onb.title.1` | entry | Experiência de treino | Training experience | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `onb.split.lede` | entry | Divisões disponíveis para {n} dias de treino por semana. | Available splits for {n} training days per week. | TD (training day) | #274 text silent; owner reading needed | - |
| `onb.equipment.unsupported` | entry | Escolha equipamentos compatíveis com todos os dias de treino. | Choose equipment that supports every training day. | TD (training day) | #274 text silent; owner reading needed | - |
| `guide.focus-utilities.title` | app | Mantenha o treino em andamento | Keep the workout moving | W (one workout) | named by #274: move to sessão | Mantenha a sessão em andamento <br>agreement: o->a |
| `guide.focus-utilities.body` | app | Use o menu do treino para entrada de voz e ferramentas da sessão sem sair do exercício atual. | Use the workout menu for voice input and the session tools while you stay on the current lift. | W (one workout) | named by #274: move to sessão | Use o menu da sessão para entrada de voz e ferramentas da sessão sem sair do exercício atual. <br>agreement: do->da |
| `guide.block-transition.title` | app | Revise um bloco de treino | Review a training block | TB (training block) | #274 text silent; owner reading needed | - |
| `guide.backup.body` | app | Exporte um backup JSON antes de limpar este navegador ou mover seus dados de treino. | Export a JSON backup before clearing this browser or moving your training data. | H (workout history / data) | named by #274: move to sessão | Exporte um backup JSON antes de limpar este navegador ou mover seus dados de sessão. |
| `install.transfer.confirmed_title` | app | Dados de treino transferidos | Workout data transferred | H (workout history / data) | named by #274: move to sessão | Dados de sessão transferidos |
| `install.transfer.stale_body` | app | Seus dados de treino foram transferidos para o app instalado, mas você os alterou neste navegador depois. O app instalado pode não ter as mudanças mais recentes. | Your workout data was transferred to the installed app, but you changed it here afterward. The installed app may not have your latest changes. | H (workout history / data) | named by #274: move to sessão | Seus dados de sessão foram transferidos para o app instalado, mas você os alterou neste navegador depois. O app instalado pode não ter as mudanças mais recentes. |
| `install.transfer.confirmed_body` | app | Seus dados de treino foram transferidos para o app instalado. | Your workout data was transferred to the installed app. | H (workout history / data) | named by #274: move to sessão | Seus dados de sessão foram transferidos para o app instalado. |
| `landing.body` | landing | É só aparecer e treinar. O Taurifer monta seus treinos, registra suas séries e já diz a próxima carga. | Just show up and lift. Taurifer builds your workouts, logs your sets, and already tells you the next load. | AMB (ambiguous (plan or workouts)) | #274 text silent; owner reading needed | - |
| `landing.system.title` | landing | Registre o treino. O Taurifer decide o próximo passo. | Log the work. Taurifer decides what's next. | W (one workout) | named by #274: move to sessão | Registre a sessão. O Taurifer decide o próximo passo. <br>agreement: o->a |
| `landing.privacy` | landing | Funciona sem conexão. Sem conta. Seu histórico de treino fica neste dispositivo e nunca sai dele. | Works offline. No account required. Your training history is stored on this device and never leaves it. | H (workout history / data) | named by #274: move to sessão | Funciona sem conexão. Sem conta. Seu histórico de sessão fica neste dispositivo e nunca sai dele. |
| `landing.shot.today_ready.alt` | landing | A tela de Hoje: Corpo inteiro, semana 5 de 6, 0 de 3 sessões concluídas. A sessão de hoje é o Dia 1, com quadríceps, peito e posteriores em cinco exercícios, e o botão Começar treino. | The Today screen: Full body, week 5 of 6, zero of three sessions completed. Today's session is Day 1, with quads, chest and hamstrings across five exercises, and a Start workout button. | W (one workout) | named by #274: move to sessão | A tela de Hoje: Corpo inteiro, semana 5 de 6, 0 de 3 sessões concluídas. A sessão de hoje é o Dia 1, com quadríceps, peito e posteriores em cinco exercícios, e o botão Começar sessão. |
| `toast.workout_forged` | app | Treino salvo com {n} {sets}. | Workout saved. {n} {sets} logged. | W (one workout) | named by #274: move to sessão | Sessão salva com {n} {sets}. <br>agreement: salvo->salva |
| `toast.log_deleted` | app | Histórico de treinos apagado. | Workout history deleted. | H (workout history / data) | named by #274: move to sessão | Histórico de sessões apagado. |
| `toast.draft_conflict_retry` | app | Um treino inacabado mais recente foi salvo em outra aba. Sua alteração não foi aplicada. Revise o treino e tente de novo. | A newer unfinished workout was saved in another tab. Your change wasn't applied. Review it and try again. | W (one workout) | named by #274: move to sessão | Uma sessão inacabada mais recente foi salva em outra aba. Sua alteração não foi aplicada. Revise a sessão e tente de novo. <br>agreement: Um->Uma, inacabado->inacabada, o->a, foi salvo->foi salva |
| `draft.recovery.persist.body` | app | O Taurifer manteve o treino salvo sem alterações. Tente novamente quando o armazenamento do dispositivo estiver disponível. | Taurifer kept the saved workout unchanged. Retry when device storage is available. | W (one workout) | named by #274: move to sessão | O Taurifer manteve a sessão salva sem alterações. Tente novamente quando o armazenamento do dispositivo estiver disponível. <br>agreement: o->a, salvo->salva |
| `draft.recovery.unavailable.title` | app | O armazenamento do treino está indisponível | Workout storage is unavailable | W (one workout) | named by #274: move to sessão | O armazenamento da sessão está indisponível <br>agreement: do->da |
| `draft.recovery.unavailable.body` | app | O Taurifer não conseguiu bloquear ou ler este treino com segurança. Tente novamente sem fechar esta aba. | Taurifer could not safely lock or read this workout. Retry without closing this tab. | W (one workout) | named by #274: move to sessão | O Taurifer não conseguiu bloquear ou ler esta sessão com segurança. Tente novamente sem fechar esta aba. <br>agreement: este->esta |
| `draft.recovery.stale.title` | app | Há um treino mais recente salvo | A newer workout is saved | W (one workout) | named by #274: move to sessão | Há uma sessão mais recente salva <br>agreement: um->uma, salvo->salva |
| `draft.recovery.stale.body` | app | A alteração desta aba não foi aplicada. Copie o valor pendente se precisar e carregue o treino mais recente. | This tab's change was not applied. Copy the pending value if you need it, then reload the latest workout. | W (one workout) | named by #274: move to sessão | A alteração desta aba não foi aplicada. Copie o valor pendente se precisar e carregue a sessão mais recente. <br>agreement: o->a |
| `draft.recovery.program.title` | app | Este treino pertence a um programa anterior | This workout belongs to an earlier program | W (one workout) | named by #274: move to sessão | Esta sessão pertence a um programa anterior <br>agreement: Este->Esta |
| `draft.recovery.program.body` | app | O treino salvo não corresponde ao programa atual. Os dados ficam neste dispositivo até você descartá-los. | The saved workout does not match the current program. Its data remains on this device until you discard it. | W (one workout) | named by #274: move to sessão | A sessão salva não corresponde ao programa atual. Os dados ficam neste dispositivo até você descartá-los. <br>agreement: O->A, salvo->salva |
| `draft.recovery.invalid.title` | app | Este treino inacabado precisa de recuperação | This unfinished workout needs recovery | W (one workout) | named by #274: move to sessão | Esta sessão inacabada precisa de recuperação <br>agreement: Este->Esta, inacabado->inacabada |
| `draft.recovery.discard` | app | Descartar treino inacabado | Discard unfinished workout | W (one workout) | named by #274: move to sessão | Descartar sessão inacabada <br>agreement: inacabado->inacabada |
| `toast.rir_locked_draft` | app | Conclua ou descarte este treino antes de mudar o modo de esforço. | Finish or discard this workout before changing effort mode. | W (one workout) | named by #274: move to sessão | Conclua ou descarte esta sessão antes de mudar o modo de esforço. <br>agreement: este->esta |
| `toast.set_count_locked_draft` | app | Conclua ou descarte este treino antes de reduzir séries já iniciadas. | Finish or discard this workout before reducing sets you've started. | W (one workout) | named by #274: move to sessão | Conclua ou descarte esta sessão antes de reduzir séries já iniciadas. <br>agreement: este->esta |
| `confirm.remove_exercise_discard_draft` | app | Remover este modelo de exercício e descartar seu treino inacabado? O histórico já registrado permanecerá neste dispositivo. | Remove this exercise template and discard your unfinished workout? Its logged history will stay on this device. | W (one workout) | named by #274: move to sessão | Remover este modelo de exercício e descartar sua sessão inacabada? O histórico já registrado permanecerá neste dispositivo. <br>agreement: seu->sua, inacabado->inacabada |
| `confirm.delete_day_discard_draft` | app | Excluir {day}, todos os seus modelos de exercício e seu treino inacabado? O histórico já registrado será mantido. | Delete {day}, all its exercise templates, and your unfinished workout? Their logged history will remain. | W (one workout) | named by #274: move to sessão | Excluir {day}, todos os seus modelos de exercício e sua sessão inacabada? O histórico já registrado será mantido. <br>agreement: seu->sua, inacabado->inacabada |
| `confirm.import_program_replace` | app | Substituir seu programa atual por {n} modelos de exercício deste arquivo? ⏎  ⏎ Seu histórico de treinos e seus ajustes continuam iguais. O nome do programa vem do arquivo. Sua data de início permanece. | Replace your current program with {n} exercise templates from this file? ⏎  ⏎ Your training log and settings are not touched. The program name comes from the file; your start date stays. | H (workout history / data) | named by #274: move to sessão | Substituir seu programa atual por {n} modelos de exercício deste arquivo? ⏎  ⏎ Seu histórico de sessões e seus ajustes continuam iguais. O nome do programa vem do arquivo. Sua data de início permanece. |
| `confirm.delete_log` | app | Apagar o histórico de treinos? Isso remove as séries salvas e qualquer rascunho de treino inacabado. O programa e os Ajustes permanecem. | Delete workout history? This removes saved log rows and any unfinished workout draft. Your program and Settings stay. | H (workout history / data) + W (one workout) | named by #274: move to sessão | Apagar o histórico de sessões? Isso remove as séries salvas e qualquer rascunho de sessão inacabada. O programa e os Ajustes permanecem. <br>agreement: inacabado->inacabada |
| `confirm.discard_draft` | app | Este treino inacabado será descartado se você trocar de dia. Continuar? | This unfinished workout will be discarded if you switch days. Continue? | W (one workout) | named by #274: move to sessão | Esta sessão inacabada será descartada se você trocar de dia. Continuar? <br>agreement: Este->Esta, inacabado->inacabada, será descartado->será descartada |
| `confirm.replace_program_discard_draft` | app | Substituir seu programa descartará este treino inacabado. O histórico de treinos salvo e os Ajustes permanecerão. Continuar? | Replacing your program will discard this unfinished workout. Saved workout history and Settings will stay. Continue? | W (one workout) + H (workout history / data) | named by #274: move to sessão | Substituir seu programa descartará esta sessão inacabada. O histórico de sessões salvo e os Ajustes permanecerão. Continuar? <br>agreement: este->esta, inacabado->inacabada |
| `settings.local_data` | app | Os dados de treino ficam neste dispositivo | Workout data stays on this device | H (workout history / data) | named by #274: move to sessão | Os dados de sessão ficam neste dispositivo |
| `settings.group.training` | app | Comportamento do treino | Training behavior | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `settings.group.data_summary` | app | Backups, privacidade, análise de uso e exclusão dos dados de treino. | Backups, privacy, analytics, and deleting training data. | H (workout history / data) | named by #274: move to sessão | Backups, privacidade, análise de uso e exclusão dos dados de sessão. |
| `settings.analytics.disclosure` | app | …o pseudônimos e gravações de sessão totalmente mascaradas. Valores do treino, nomes de exercícios, anotações, texto livre, links de configuração e… | Taurifer sends pseudonymous usage events and fully masked session recordings to PostHog. Workout values, exercise names, notes, free text, setup links, and backups are excluded. Turn this off at any time. | H (workout history / data) | named by #274: move to sessão | O Taurifer envia ao PostHog eventos de uso pseudônimos e gravações de sessão totalmente mascaradas. Valores da sessão, nomes de exercícios, anotações, texto livre, links de configuração e… <br>agreement: do->da |
| `privacy.local_first` | app | Seus dados de treino ficam neste dispositivo, exceto quando você cria explicitamente uma transferência para instalação. | Your training data stays on this device except when you explicitly create an install transfer. | H (workout history / data) | named by #274: move to sessão | Seus dados de sessão ficam neste dispositivo, exceto quando você cria explicitamente uma transferência para instalação. |
| `privacy.setup.body` | app | …sta ao host estático por até sete dias. Ele nunca inclui registros de treino nem histórico de programas. | …t proposal to the static host for up to seven days. It never includes workout logs or program history. | H (workout history / data) | named by #274: move to sessão | …sta ao host estático por até sete dias. Ele nunca inclui registros de sessão nem histórico de programas. |
| `privacy.telemetry.body` | app | …erais do produto com uma identidade anônima estável, nunca valores de treino, nomes de exercícios, notas, texto livre, links de configuração, toke… | … sends coarse product funnels with a stable anonymous identity, never workout values, exercise names, notes, free text, setup links, transfer token… | H (workout history / data) | named by #274: move to sessão | …erais do produto com uma identidade anônima estável, nunca valores de sessão, nomes de exercícios, notas, texto livre, links de configuração, toke… |
| `privacy.controls.body` | app | …SON antes de mudar de navegador ou limpar este. Apagar o histórico de treinos remove definitivamente os registros e o rascunho ativo do armazenamen… | …o export a JSON backup before moving or clearing this browser. Delete workout history permanently removes logs and the active draft from local stor… | H (workout history / data) | named by #274: move to sessão | …SON antes de mudar de navegador ou limpar este. Apagar o histórico de sessões remove definitivamente os registros e o rascunho ativo do armazenamen… |
| `privacy.transfer.contents` | app | A cópia lógica criptografada inclui o programa e o estado de treino normalizados, histórico, arquivo e proveniência, rascunho de treino ativo, configuração de programa não concluída, preferências da interf… | The encrypted logical clone includes your normalized program and workout state, history, archive and provenance, active workout draft, unfinished program setup, UI preferences, analytics consent, a… … … transaction markers, cookies, permissions, cache state, and provider session state. | H (workout history / data) + W (one workout) | named by #274: move to sessão | A cópia lógica criptografada inclui o programa e o estado de sessão normalizados, histórico, arquivo e proveniência, rascunho de sessão ativo, configuração de programa não concluída, preferências da interf… … …adores de transação, cookies, permissões, estado do cache e estado de sessão do provedor. |
| `settings.notifications.lede_short` | app | Timer, sessão de hoje e treino não finalizado | Timer, today's session, and unfinished workout | W (one workout) | named by #274: move to sessão | Timer, sessão de hoje e sessão não finalizada <br>agreement: finalizado->finalizada |
| `today.no_program.body` | app | O Taurifer planeja suas sessões a partir de um programa. Configure um e o treino de hoje aparece aqui. | Taurifer plans your sessions from a program. Set one up and today's training appears here. | W (one workout) | named by #274: move to sessão | O Taurifer planeja suas sessões a partir de um programa. Configure um e a sessão de hoje aparece aqui. <br>agreement: o->a |
| `today.start` | app | Começar treino | Start workout | W (one workout) | named by #274: move to sessão | Começar sessão |
| `today.continue` | app | Continuar treino | Continue workout | W (one workout) | named by #274: move to sessão | Continuar sessão |
| `today.done_title` | app | Treino concluído | Session complete | W (one workout) | named by #274: move to sessão | Sessão concluída <br>agreement: concluído->concluída |
| `today.done_review` | app | Ver o treino de hoje | View today's session | W (one workout) | named by #274: move to sessão | Ver a sessão de hoje <br>agreement: o->a |
| `today.done_another` | app | Registrar outro treino | Log another session | W (one workout) | named by #274: move to sessão | Registrar outra sessão <br>agreement: outro->outra |
| `today.last_trained` | app | Último treino há {n} dias | Last workout {n} days ago | W (one workout) | named by #274: move to sessão | Última sessão há {n} dias <br>agreement: Último->Última |
| `today.last_trained_one` | app | Último treino ontem | Last workout yesterday | W (one workout) | named by #274: move to sessão | Última sessão ontem <br>agreement: Último->Última |
| `today.last_trained_today` | app | Treino hoje | Trained today | W (one workout) | named by #274: move to sessão | Sessão hoje |
| `program.days_label` | app | Dias de treino | Training days | TD (training day) | #274 text silent; owner reading needed | - |
| `program.share_setup_sub` | app | Programa, ajustes e idioma do app · sem histórico de treinos | Program, settings and app language · no workout history | H (workout history / data) | named by #274: move to sessão | Programa, ajustes e idioma do app · sem histórico de sessões |
| `program.training_days` | app | Dias de treino | Training days | TD (training day) | #274 text silent; owner reading needed | - |
| `settings.notifications.caption` | app | Timer, sessão de hoje e treino não finalizado | Timer, today's session and unfinished workout | W (one workout) | named by #274: move to sessão | Timer, sessão de hoje e sessão não finalizada <br>agreement: finalizado->finalizada |
| `settings.delete_all` | app | Apagar histórico de treinos | Delete workout history | H (workout history / data) | named by #274: move to sessão | Apagar histórico de sessões |
| `summary.eyebrow` | app | Treino salvo | Session saved | W (one workout) | named by #274: move to sessão | Sessão salva <br>agreement: salvo->salva |
| `entry.durable_conflict.title` | entry | Seus dados de treino mudaram em outra aba | Your training data changed in another tab | H (workout history / data) | named by #274: move to sessão | Seus dados de sessão mudaram em outra aba |
| `entry.catalogue.group_fits` | entry | Combina com seus {days} dias de treino | Matches your {days} training days | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.hub.build.cap` | entry | Comece com dias de treino vazios e preencha você mesmo. | Start with empty training days and fill them in yourself. | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.background.title` | entry | Seu contexto recente de treino | Your recent training background | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.background.lede` | entry | Responda com base no seu treino recente, não em uma autoavaliação. | Answer based on your recent training, not on a self-rating. | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.schedule.title` | entry | Encaixe o treino na sua semana | Fit training into your week | AMB (ambiguous (plan or workouts)) | #274 text silent; owner reading needed | - |
| `entry.schedule.days.label` | entry | Dias de treino por semana | Training days per week | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.custom_shape.summary` | entry | {days} dias de treino, cerca de {min}–{max} minutos cada. | {days} training days, about {min}–{max} minutes each. | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.result.explain` | entry | Este programa usa seu objetivo, seu treino recente, sua agenda e sua principal restrição. | This program uses your goal, recent training, schedule, and main constraint. | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.result.why_schedule` | entry | Encaixa em {days} dias de treino, cada um limitado a {minutes} minutos. | Fits {days} training days, each capped at {minutes} minutes. | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.result.why_reductions` | entry | A primeira semana reduz o trabalho em {n} pontos para acompanhar seu treino recente. | The first week reduces work in {n} places to match your recent training. | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.result.why_interrupted` | entry | Como você completou cerca de metade dos treinos recentes, a primeira semana reduz temporariamente o trabalho antes de retomar o programa normal. | Because you completed about half of your recent training, the first week temporarily reduces work before the normal program resumes. | W (one workout) | named by #274: move to sessão | Como você completou cerca de metade das sessões recentes, a primeira semana reduz temporariamente o trabalho antes de retomar o programa normal. <br>agreement: dos->das |
| `entry.build_setup.lede` | entry | Dê um nome e escolha quantos dias de treino vazios criar. | Name it and choose how many empty training days to start with. | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.build_setup.days` | entry | Dias de treino | Training days | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.freeform.prompt` | entry | Reescreva este programa de treino como JSON para o app Taurifer. Responda apenas com o JSON: sem explic… … …e origem, no mesmo idioma. ⏎ - Uma entrada por exercício de cada dia de treino. Repita "day" em todos os exercícios do dia e numere "order" a partir… | Rewrite this training program as JSON for the Taurifer app. Reply with the JSON and nothing… … …e writes them, in the source's language. ⏎ - One entry per exercise per training day. Repeat "day" on every exercise in that day, and number "order" from 1 within each day. ⏎ - "sets" is the number of working sets, a whole number from 1 to 100. ⏎ - "min" and "max" are the rep ran… … …other_notes". ⏎ - Leave out warm-ups, cardio and anything that is not a working exercise. ⏎  ⏎ The program: ⏎  ⏎ {program} | PC (the plan ("programa de treino")) + TD (training day) | #274 text silent; owner reading needed | - |
| `entry.preview.progression_body` | entry | O Taurifer atualiza as metas com base nos treinos concluídos, usando a progressão compatível de cada exercício. | Taurifer updates targets from completed training, using each exercise's supported progression. | W (one workout) | named by #274: move to sessão | O Taurifer atualiza as metas com base nas sessões concluídas, usando a progressão compatível de cada exercício. <br>agreement: nos->nas, concluídos->concluídas |
| `entry.editor.incomplete` | entry | Rascunho incompleto. Adicione pelo menos um exercício a cada dia de treino. | Incomplete draft. Add at least one exercise to every training day. | TD (training day) | #274 text silent; owner reading needed | - |
| `entry.env_correct.capabilities` | entry | Capacidades de treino | Training capabilities | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.env_correct.note` | entry | A lista mostra apenas capacidades de treino compatíveis. O Taurifer considera equipamentos além do peso corporal como resistência externa. | Only supported training capabilities are listed. External resistance is inferred from equipment beyond bodyweight. | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `entry.freeform.repair_assemble_failed` | entry | …mente no formato que te dei, com uma entrada por exercício por dia de treino e com "day", "order" e "name" em todas as entradas. | …gain in exactly the shape I gave you, with one entry per exercise per training day and "day", "order" and "name" present on every entry. | TD (training day) | #274 text silent; owner reading needed | - |
| `landing.proof.example` | landing | Um exemplo de treino | A training example | W (one workout) | named by #274: move to sessão | Um exemplo de sessão |
| `session.sheet.subtitle` | app | Visão geral e notas do treino | Overview and workout notes | W (one workout) | named by #274: move to sessão | Visão geral e notas da sessão <br>agreement: do->da |
| `session.sheet.early_finish` | app | Concluir treino mais cedo | Finish session early | W (one workout) | named by #274: move to sessão | Concluir sessão mais cedo |
| `session.sheet.reorder_up_aria` | app | Mover {name} para antes no treino | Move {name} earlier in workout | W (one workout) | named by #274: move to sessão | Mover {name} para antes na sessão <br>agreement: no->na |
| `session.sheet.reorder_down_aria` | app | Mover {name} para depois no treino | Move {name} later in workout | W (one workout) | named by #274: move to sessão | Mover {name} para depois na sessão <br>agreement: no->na |
| `workout.leave_failed` | app | Não foi possível salvar o progresso do treino. Tente novamente. | Could not save workout progress. Please try again. | W (one workout) | named by #274: move to sessão | Não foi possível salvar o progresso da sessão. Tente novamente. <br>agreement: do->da |
| `toast.finish_incomplete` | app | Conclua as séries planejadas ou use Concluir treino mais cedo. | Complete the planned sets, or use Finish session early. | W (one workout) | named by #274: move to sessão | Conclua as séries planejadas ou use Concluir sessão mais cedo. |
| `review.action.reduce_volume` | app | Reduzir o volume de treino permanentemente | Reduce training volume permanently | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |
| `review.preview.frequency` | app | Dias de treino: {before} → {after} | Training days: {before} → {after} | TD (training day) | #274 text silent; owner reading needed | - |
| `review.recovery.question` | app | Durante este bloco, a recuperação pareceu pior do que o normal com frequência suficiente para afetar seu treino? | During this block, did recovery feel worse than usual often enough to affect your training? | ACT (training (activity, general)) | #274 text silent; owner reading needed | - |

### 4. Table C: the landing final page's `P` override table (`336b492d`)

The page is `docs/design/landing-candidates/final/index.html`. Its `P` table is
quoted below with the catalog value each entry replaces. The page's `verify.mjs`
checks that `cat.pt[key]` and `cat.en[key]` still equal `from`, so it fails as
soon as any of these catalog values moves. It also fails on any plain
"programa" in the page's PT text (outside an app label) and on the PT phrases
"o treino" and "histórico de treinos".

| `P` key | `P` PT (landing) | Catalog PT it replaces (`from`) | Table A mechanical result | Same as `P`? | Relation |
|---|---|---|---|---|---|
| `landing.build` | Montar meu treino | Montar meu programa | Montar meu treino | yes | Table A row `landing.build` |
| `landing.track` | Acompanhar meu treino atual | Acompanhar meu programa atual | Acompanhar meu treino atual | yes | Table A row `landing.track` |
| `entry.hub.group.written` | O Taurifer monta seu treino | O Taurifer monta o programa | O Taurifer monta o treino | no | Table A row `entry.hub.group.written`; the page adds the possessive ("seu") where the mechanical rule keeps the article ("o") |
| `entry.hub.group.browse` | Escolha um treino pronto | Escolha um programa pronto | Escolha um treino pronto | yes | Table A row `entry.hub.group.browse` |

The page's `K` table copies catalog values verbatim and `verify.mjs` checks
them. Three `K` entries contain "programa" and one is the European Portuguese
string:

| `K` key (verbatim from catalog) | Catalog PT | In Table A | What moves under #274 |
|---|---|---|---|
| `landing.track` | Acompanhar meu programa atual | yes | value becomes "Acompanhar meu treino atual"; also overridden in `P` |
| `entry.hub.title` | Criar um programa | yes | value becomes "Criar um treino" |
| `entry.hub.own.title` | Usar meu próprio programa | yes | value becomes "Usar meu próprio treino" |
| `entry.freeform.privacy` | O que colar é mantido neste separador apenas para esta importação. Nunca entra no histórico, exportações ou telemetria, e o Taurifer descarta-o quando o fluxo termina. | no (no "programa"), see C-05 | European Portuguese; the page renders its own PT-BR line (`FREEFORM_PRIVACY_PT_BR`) and checks the catalog value as its source |

Page wording that already follows #274 without being in `P` (so no catalog
value to compare), from `final/index.html`:

- "treino" for the plan: "Treinos Taurifer completos", "seu treino atual",
  "Três jeitos de começar seu treino.", "Ver como colar um treino", "Meu
  treinador pode me mandar um treino?", "confere seu treino", the share list
  item "Treino", "quem o receber pode ler seu treino", "Montar seu treino".
- "sessão" for one workout: "Próxima sessão", "uma sessão de supino", "Estas
  são as três respostas que o Taurifer dá depois de uma sessão", "registrar as
  sessões".
- One mixed use: "a tela de treino do app" (the workout screen) and the line
  "No app, seu treino ainda aparece como programa", which is the line #274 says
  to remove once the catalog moves.

Relation to Tables A and B: all four `P` keys and the three `K` keys are Table A
rows. `P` matches the mechanical substitution on three of four; for
`entry.hub.group.written` the page uses "seu treino" where the catalog has "o
programa", which is #274's possessive preference and not the mechanical rule.
`landing.proof.example` ("Um exemplo de treino") and the other landing values
that say "treino" for one workout are Table B rows the page does not copy.

### 5. Counts

Keys affected by namespace (Table A, Table B, both):

| Namespace | Surface | Table A keys (programa) | Table B keys (treino) | In both | Union |
|---|---|---|---|---|---|
| `entry.*` | entry | 92 | 20 | 4 | 108 |
| `program.*` | app | 24 | 12 | 1 | 35 |
| `toast.*` | app | 16 | 6 | 0 | 22 |
| `landing.*` | landing | 14 | 5 | 0 | 19 |
| `review.*` | app | 12 | 3 | 0 | 15 |
| `settings.*` | app | 4 | 12 | 1 | 15 |
| `today.*` | app | 4 | 9 | 1 | 12 |
| `dialog.*` | app | 7 | 4 | 0 | 11 |
| `onb.*` | entry | 7 | 3 | 0 | 10 |
| `draft.*` | app | 2 | 9 | 2 | 9 |
| `confirm.*` | app | 5 | 6 | 3 | 8 |
| `privacy.*` | app | 4 | 5 | 3 | 6 |
| `setup.*` | entry | 6 | 0 | 0 | 6 |
| `guide.*` | app | 1 | 4 | 0 | 5 |
| `log.*` | app | 0 | 4 | 0 | 4 |
| `session.*` | app | 0 | 4 | 0 | 4 |
| `import.*` | app | 3 | 0 | 0 | 3 |
| `install.*` | app | 0 | 3 | 0 | 3 |
| `stats.*` | app | 1 | 2 | 0 | 3 |
| `attention.*` | app | 0 | 2 | 0 | 2 |
| `block_rec.*` | app | 1 | 0 | 0 | 1 |
| `block_strategy.*` | app | 1 | 0 | 0 | 1 |
| `custom.*` | app | 1 | 0 | 0 | 1 |
| `exercise.*` | app | 1 | 0 | 0 | 1 |
| `focus.*` | app | 0 | 1 | 0 | 1 |
| `glossary.*` | app | 1 | 0 | 0 | 1 |
| `meta.*` | landing | 1 | 1 | 1 | 1 |
| `nav.*` | app | 1 | 0 | 0 | 1 |
| `rec.*` | app | 1 | 0 | 0 | 1 |
| `session_banner.*` | app | 0 | 1 | 0 | 1 |
| `summary.*` | app | 0 | 1 | 0 | 1 |
| `untitled_program.*` | app | 1 | 0 | 0 | 1 |
| `workout.*` | app | 0 | 1 | 0 | 1 |
| **Total** | | **211** | **118** | **16** | **313** |

By surface:

| Surface | Table A keys | Table B keys | Union |
|---|---|---|---|
| landing | 15 | 6 | 20 |
| entry | 105 | 23 | 124 |
| app | 91 | 89 | 169 |

Under the literal #274 scope: Table A is 211 keys ("programa" to "treino"),
plus Table B classes W and H move "treino" to "sessão". The union of keys with
either word is 313; 16 keys carry both words, and those are the strings
where the two-way swap has to be read together.

#### European Portuguese strings noticed on the way (R2/R4 copy work, stands regardless of OG-2)

These are PT values written in European Portuguese (tu-forms, "separador",
"ficheiro", "folha de cálculo", "aplicação", "guardar", "rever", "em falta",
"noutra") in a catalog whose brand-guide voice is "você" and which Plan 064 treats as PT-BR. C-05 names
`entry.freeform.privacy`; Plan 064 §11 lists the wider PT-BR entry catalog
correction (PD-5, Q625) as optional and absorbed by R4 if it has not landed. The
rows below come from a marker scan followed by hand reading, so they are
candidates for a native review, not a finished list. "Weaker signal" rows are
words that Brazilian copy can also use. 25 keys, 10 of them also in
Table A (so the OG-2 pass and the PT-BR pass touch the same strings).

| Key | EP markers | In Table A | In Table B | Note |
|---|---|---|---|---|
| `entry.freeform.privacy` | separador, descarta-o, "O que colar é mantido" | no | no | C-05 (named in the plan); R2 rewrites in PT-BR with the same meaning |
| `entry.freeform.lede` | folha de cálculo, aplicação, comando | yes | no | - |
| `entry.freeform.needs_input` | "Cole o seu programa" | yes | no | - |
| `entry.freeform.review` | "Rever o programa" | yes | no | - |
| `entry.freeform.gaps_title` | "em falta" | no | no | - |
| `entry.freeform.gaps_submit` | "Rever o programa" | yes | no | - |
| `entry.freeform.unreadable_body` | "Pode editar" | yes | no | - |
| `entry.freeform.confirm_discard` | ficheiro, "irá descartar" | no | no | - |
| `entry.freeform.repair_no_json` | tu-form: "A tua", "Envia-a", "te dei" | no | no | text sent to the external assistant |
| `entry.freeform.repair_invalid_rows` | tu-form: "Não consegui", "a tua", "Envia", "nomeia-o" | yes | no | text sent to the external assistant |
| `entry.freeform.repair_assemble_failed` | tu-form: "Envia", "te dei"; "a ser rejeitado", "em falta" | yes | yes | text sent to the external assistant |
| `entry.freeform.preview_prompt` | "comando" (weaker signal) | no | no | - |
| `entry.freeform.stage2_hint` | "comando" (weaker signal) | no | no | - |
| `entry.freeform.copy_repair_prompt` | "comando" (weaker signal) | no | no | - |
| `entry.freeform.toast_repair_copied` | "comando" (weaker signal) | no | no | - |
| `entry.catalogue.review_aria` | "Rever" | no | no | - |
| `entry.rules_changed.body_rebuild` | "A Taurifer", "guardou" | yes | no | - |
| `entry.rules_changed.body_keep` | "A Taurifer", "guardou", "Continua a funcionar", "pode mantê-lo" | yes | no | - |
| `entry.resume.detail` | "Parou em", "guardado a" | no | no | - |
| `entry.cancel_confirm.body` | "Guarde este rascunho" (weaker signal) | no | no | - |
| `entry.cancel_confirm.keep` | "Guardar rascunho" (weaker signal) | no | no | - |
| `entry.hub.freeform.cap` | "as suas anotações" (weaker signal) | no | no | - |
| `program.editor.conflict` | "noutra aba", "Reveja as suas alterações" | yes | no | - |
| `program.editor.workout_conflict.body` | "continue a editar" | no | yes | also a Table B row |
| `program.editor.leave.body` | "As suas alterações" (weaker signal) | no | no | - |

### 6. Draft `CONTEXT.md` glossary amendment under #274 (draft for the owner, not applied)

If the owner confirms #274, the issue asks for the two terms below. The wording
is a draft; `CONTEXT.md` is unchanged on this branch.

```markdown
**Program**:
The active training split: metadata (name, start date) plus the exercise templates that define each training day.
_PT (user-facing)_: treino ("seu treino").
_Avoid_: Template (when meaning the whole program), split (in user-facing copy unless the lifter uses that word), routine, plan; in Portuguese user-facing copy, "programa"

**Session**:
All log rows saved together in one workout, sharing a session id, date, and training day.
_PT (user-facing)_: sessão.
_Avoid_: Workout (acceptable in casual copy; session is the domain term); in Portuguese user-facing copy, "treino" for one workout
```

Terms the amendment leaves open because #274 does not address them: the PT label
for **Training day** (20 keys say "dia de treino"), **Mesocycle** / training
block ("bloco de treino", 3 keys), and "plano" (4 keys). The glossary
**Program** entry already lists "plan" under Avoid in English.

### 7. Open points this inventory surfaces for OG-2 (questions, not recommendations)

- Training day, training block and training-as-activity wording: 20 + 3 + 14
  Table B keys that #274 does not name.
- The bottom-navigation tab and the Program screen title (`nav.program`,
  `program.title`, `program.eyebrow`, `program.aria`, `settings.group.program`,
  `stats.pr_filter.program`) are single-word labels; under the mechanical rule
  each reads "Treino".
- `entry.freeform.prompt` is the text a lifter sends to ChatGPT or Claude. Its
  JSON example contains `"name":"Nome do programa"` and the sentence "Reescreva
  este programa de treino", and `test/program-freeform-import.mjs` (line 750)
  asserts that the PT prompt matches `/programa/i`. Changing it changes what an
  external model is told.
- Possessive ("seu treino") versus article ("o treino"): the page uses the
  possessive in `P`; the mechanical column keeps the article.
- Generic uses of "programa" that are not the active plan:
  `entry.background.experience.label` and `entry.background.experience.first`.
- Test and doc references that pin current PT values (not edited here): files
  under `test/` that mention "programa" are `test/i18n.mjs` (pins
  `meta.description` and `privacy.setup.body` verbatim),
  `test/program-freeform-import.mjs`, `test/pt-copy-shots.mjs`,
  `test/ui-screens.mjs`, `test/shared-setup-flow.mjs`, `test/simulation.mjs`,
  `test/install-modes.mjs`, `test/progress-model.mjs`,
  `test/progression-strategies-ui.mjs` and the two
  `test/program-transition-recovery-*.mjs` suites. Which of them pin catalog
  values and which only use the word is not audited here.

This inventory decides nothing; OG-2 is the owner's.

## Onboarding reconciliation board (input to OG-1)

The board is evidence for the owner, built in R0 from existing sources only
(Plan 064 §7.2). Tournament captures and prototype code never enter `main`
(§11.2), so the frames are not committed here. They are published to the owner
as a private board, [OG-1 Onboarding Board](https://claude.ai/artifact/B4wecGe3ThNu26nMM7v73V),
and the batch gate comment on PR #295 links it.

- **Sources, read-only and unmodified:** candidates G, H, I, J, K and L from
  #279 at `1acee97a` (`docs/design/onboarding-tournament/`); Direction D's
  Today and Focus drawings from the #272 review page at `2f2fc044`
  (`docs/design/main-screen-directions/`). The D frames are drawings, not
  production screens. The five polish proposals of 2026-09-30 are not asserted
  as accepted; they are OG-4.
- **Frames:** 52 required (6 candidates × entry hub, first Recommend step,
  merged result and preview, activation × PT-BR light and EN dark at 390 css
  px; plus D Today and Focus in both cells) and 12 supplementary (each
  candidate's own Today after activation). No cell is missing.
- **Normalization:** no candidate was restyled. Every frame uses the same
  viewport (390 × 844 css px, DPR 2), cells and first-viewport crop, and is
  annotated with §8 deltas measured from its DOM by one function: type
  families and tiers against Plan 058's ten tiers, contained cards versus
  hairline bands, orange and other hues, sheet header band, dock. D's frames
  are measured by the same function.
- **Not on the board:** G rendered on the §8 shared rules. The tournament has
  no such render and inventing one would not be an existing source. G is shown
  on the harness's vendored Plan 058 tokens. Once R1 and R3 exist, the chosen
  direction may be re-rendered beside them as confirming evidence (§7.2); that
  is not a prerequisite for asking OG-1. No R1 or R3 screen exists at the end
  of R0, and none is shown.
- **Reopenings, stated on the board:** advancing J reopens Q622 (PD-1) and
  advancing L reopens Q624 (PD-4); both also omit Custom, Browse and Build, so
  either needs an explicit owner reopening of L-07 before it can be built. G,
  H, I and K reopen nothing.
- **Evidence matrix (from the tournament's own records):** taps from landing
  to Today are G 13, H 18, I 13, J 11, K 14 and L 10, and a correction from the
  review costs 6 in every direction. G is built on all 45 checkpoints; H to L
  are built on the 21 core checkpoints, and the Round 4 freeze table is
  recorded as incomplete. Each of H to L brings type families outside Plex. The
  engine finding PF-1 appears in every candidate and is not a candidate
  difference.

## OG-6 drawing approvals

Each Direction D screen that needed a drawing is drawn on the review page (`redesign/direction-d`, drawing only, never shipped) and approved by the owner on PR #295. A state is buildable in R3 once its row is here; the treatment table above keeps its original "needs drawing" note as history.

| Round | State | Review page | Path on that branch | Owner approval |
|---|---|---|---|---|
| 1 | `today/done` | `e04e7f3` | `docs/design/main-screen-directions/dir-d.js` (`today-done`) | [#295, 2026-10-01](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5933076242) |
| 1 | `today/draft-resume` | `e04e7f3` | `dir-d.js` (`today-draft-resume`) | same |
| 1 | `workout/exercise-note` | `e04e7f3` | `dir-d.js` (`workout-exercise-note`) | same |
| 1 | `workout/session` | `e04e7f3` | `dir-d.js` (`workout-session`) | same |
| 1 | `workout/early-finish` | `e04e7f3` | `dir-d.js` (`workout-early-finish`) | same |
| 1 | `workout/warmup-actions` | `e04e7f3` | `dir-d.js` (`workout-warmup-actions`) | same |
| 1 | `workout/reorder` | `e04e7f3` | `dir-d.js` (`workout-reorder`) | same |
| 1 | `workout/skipped-actions` | `e04e7f3` | `dir-d.js` (`workout-skipped-actions`) | same |
| 1 | `workout/substituted-actions` | `e04e7f3` | `dir-d.js` (`workout-substituted-actions`) | same |

| 2 | `workout/exercise-actions` (redraw) | `b891de0` | `dir-d.js` (`workout-exercise-actions`) | [#295, 2026-10-01](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5937151704) |
| 2 | exercise-complete shelf (OG-4 proposal 3) | `b891de0` | `dir-d.js` (`workout-exercise-complete`) | same |
| 2 | session-complete shelf | `b891de0` | `dir-d.js` (`workout-session-complete`) | same |
| 2 | `progress/overview-baseline` | `b891de0` | `dir-d.js` (`progress-overview-baseline`) | same |
| 2 | `progress/strength`, `progress/strength-current-block` | `b891de0` | `dir-d.js` (`progress-strength`, `progress-strength-current-block`; one renderer, as the catalog frames are identical) | same |
| 2 | `progress/strength-all-history` | `b891de0` | `dir-d.js` (`progress-strength-all-history`) | same |
| 2 | `progress/strength-comparison` | `b891de0` | `dir-d.js` (`progress-strength-comparison`) | same |
| 2 | `progress/strength-sparse` | `b891de0` | `dir-d.js` (`progress-strength-sparse`) | same |
| 2 | `history/edit-dirty` | `b891de0` | `dir-d.js` (`history-edit-dirty`, with the discard confirmation) | same |
| 2 | `history/edit-invalid` | `b891de0` | `dir-d.js` (`history-edit-invalid`) | same |

Each approval includes that screen's listed differences from today's app (the round's board). Round 1 carried two items into round 2 by the same decision: the redraw of `workout/exercise-actions` (decision 11) and the exercise-complete shelf (OG-4 proposal 3). Both are now drawn and approved.

Round 2 decisions recorded with the approvals:
- Focus's "Change since last session" line (`delta.preview`) is retired.
- On the Progress overview, the 3-segment week bar, the all-time tiles and the overview's volume block are retired; the Volume tab is unchanged.
- The PT heading is "Precisa de atenção".
- Strength rows expand in place, and a rep-only improvement hides its "0 kg (0%)" change.
- The History editor pins Cancel/Save with the dock hidden, groups rows under each lift with a quiet remove and an undo, asks before discarding in a sheet, and keeps an invalid value's reason under its row.

Undrawn states keep today's design: the shelf for "last exercise done while earlier ones are unfinished", a Strength slot with no history, the keep-one-set toast, and History's save failure and conflict.

Build decisions recorded on [#295](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5937182678):
- The §8.8 "active dock icon" covers the shipped active dock item: its icon, label and highlight.
- `.verdictmark` gains "=" (hold) and "↻" (recover).
- The session summary keeps its count ramp (owner, motion amendment M2, comment 5941747309); its row stagger stays removed.
- The PT outcome labels read "Manteve" and "Regressou".

### Owner decisions before R6

Recorded on [#295](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5961176728), 2026-10-02:
- **RF-4, manual slot load: kept as built.** Direction D spec §4.9 and §5 draw a manual slot's program-authored load. The program has no such field, and adding one would change the program schema, the editor, import and the setup-link format. Manual rows therefore show sets × range and "manual" with no load and no mark. This is a recorded deviation from the D spec, and the authored-load field is a backlog item (Product and UX debt, "Manual-slot authored load").
- **RF-10, Portuguese exercise names: localized at display.** In PT, a library exercise whose stored name still equals the library's English name shows the library's PT name. Stored data, setup links, telemetry and exercises the lifter renamed are unchanged. R6 builds it.
- **Icon set (corrected 2026-10-03).** An earlier version of this line said the G icon set was not adopted. That was an orchestrator record, not an owner decision, and it contradicted the owner's Q-D ([#295 comment 5927122354](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5927122354)): G's 28-glyph set becomes the app-wide icon set through the shared mask mechanism, inventoried. It is adopted after R7, and the correction is recorded on [#295](https://github.com/pedrochagasmaster/repforge/pull/295#issuecomment-5968535491).

## R6 rules-only sweep

The 62 states the treatment table classes `rules only` keep their layouts and follow the shared rules of Plan 064 section 8 and nothing else. `tools/check-rules-only.mjs` (self-test `test/rules-only-gate.mjs`, `workout` lane) renders every one in PT and EN at 360 and checks four things, reusing the Direction D gate's `gatherEvidence`, `checkOrange`, `checkTargets` and `checkOverflow`:

- **Orange budget:** the accent appears only in the five budget uses. The rules-only allowlist is the D list (`ORANGE_ALLOWLIST`) plus `RULES_ONLY_EXTRA_ALLOWLIST`, which is empty: no rules-only surface needed a new entry.
- **Targets:** every control is at least 44 by 44.
- **Overflow:** no element is wider than its box, and no `text-overflow: ellipsis` (section 8.13: names wrap, never ellipsized). Progress' tab row is excepted, as in the D gate, and so are the sideways filter rails (below).
- **Sheet band:** every open `.sheet` is headed by `.sheetband` with its handle and title, no legacy head is left beside it, and no open dialog is unclassified (`NON_SHEET_DIALOGS` documents the ones that are not sheets).

The focused control's focus ring, halo and field border are painted from `--color-focus`, the contract's focus-visible role. They are not an accent use and moving them off the accent would change a token value, so the audit lists the one focused element's indicator separately (`evidence.accent.focusIndicators`) and does not count it. The same paint on an unfocused element is still a violation.

**RED (BASE `cc0a58c`):** 466 findings in 48 of the 64 states (orange 168, overflow 246, sheet band 52, targets 0).

**GREEN (this branch):** 0 findings in PT and EN at 360, in light and in dark. A probe over the 64 states found every rendered text size on a 058 role (11, 12, 14, 16, 18, 22, 24, 28, 30, 40).

| State | What was wrong at BASE | What changed |
| --- | --- | --- |
| `today/no-program` | Already conforming. | None. |
| `workout/stale-draft` | Already conforming. The discard question already wears `.sheetband`. | None. |
| `workout/persist-retry` | Already conforming. The discard question already wears `.sheetband`. | None. |
| `workout/invalid-draft` | Already conforming. The discard question already wears `.sheetband`. | None. |
| `progress/volume` | The window underline on `#volumeScopeSeg` and the status words were painted with the accent. | The underline takes `--boundary-selected-quiet`; the status is `--color-ink` (`--color-improved` when on target). |
| `progress/volume-drill-in` | The window underline on `#volumeScopeSeg` and the status words were painted with the accent. | The underline takes `--boundary-selected-quiet`; the status is `--color-ink` (`--color-improved` when on target). |
| `progress/volume-block` | The bar fill and the status words were painted with the accent. | The fill is `--color-ink` (`--color-improved` when on target) and the status is ink. |
| `progress/prs` | The filter underline, and the load and e1RM record tags (text and wash) were painted with the accent; `.prtl__ex` truncated the exercise name with an ellipsis. | The underline takes `--boundary-selected-quiet`; the tags are `--color-improved` (a record) on `--well`; the name wraps. A record delta is `--color-improved` too. |
| `progress/prs-drill-in` | The filter underline, and the load and e1RM record tags (text and wash) were painted with the accent; `.prtl__ex` truncated the exercise name with an ellipsis. | The underline takes `--boundary-selected-quiet`; the tags are `--color-improved` (a record) on `--well`; the name wraps. A record delta is `--color-improved` too. |
| `progress/review` | The read-only notice used `--color-warning`, which is the accent. | The notice is `--color-ink`. |
| `progress/review-active` | The read-only notice used `--color-warning`, which is the accent. | The notice is `--color-ink`. |
| `progress/recovery-ineligible` | The read-only notice used `--color-warning`, which is the accent. | The notice is `--color-ink`. |
| `progress/recovery-active` | The read-only notice used `--color-warning`, which is the accent. | The notice is `--color-ink`. |
| `progress/recovery-reassessment` | The read-only notice used `--color-warning`, which is the accent. | The notice is `--color-ink`. |
| `progress/schedule-diagnosis` | The chosen diagnosis card and its mark were ringed and filled with the accent. | The card takes the quiet selected ring (`--elevation-selected-quiet-shadow`) and the mark is an ink ring with an ink dot, as the entry radios are. |
| `progress/review-complete` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/review-insufficient` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/sibling-lower-frequency` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/sibling-shorter-session` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/guided-repair` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/volume-reduction-preview` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/recovery-questions` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `progress/recovery-preview` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `history/delete-confirm` | Already conforming. The delete question is an in-page alert with its own actions (not a native dialog) and the conflict banner paints no accent. | None. |
| `history/conflict` | Already conforming. The delete question is an in-page alert with its own actions (not a native dialog) and the conflict banner paints no accent. | None. |
| `library/list` | Back, Close and "Create custom exercise" were accent text; the active tab underline and the active filter chip (wash, ring) were accent; the muscle and equipment filter rails scroll sideways inside a narrow box; `.librow__meta` truncated with an ellipsis. | Back, Close and the link are `--control-quiet-ink` (the link underlined); the tab underline is `--boundary-selected-quiet`; the chip is `--well` with the quiet ring; the meta line wraps. The filter rail keeps scrolling sideways (excepted, see "Filter rails"). |
| `library/list-selected` | Back, Close and "Create custom exercise" were accent text; the active tab underline and the active filter chip (wash, ring) were accent; the muscle and equipment filter rails scroll sideways inside a narrow box; `.librow__meta` truncated with an ellipsis. The ticked row discs were accent. | Back, Close and the link are `--control-quiet-ink` (the link underlined); the tab underline is `--boundary-selected-quiet`; the chip is `--well` with the quiet ring; the meta line wraps. The filter rail keeps scrolling sideways (excepted, see "Filter rails"). The ticked disc is `--boundary-selected-quiet` with the tick cut out of it. |
| `library/exercise-preview` | Back was accent text. | Back is `--control-quiet-ink`. |
| `library/exercise-detail` | Back, "Understand RIR", "Why this weight" and the recommendation label and rail were accent; the illustration field bleeds past `#exercise` and `#exDetail`, which then overflow their boxes; `.listrow__sub` and `.statrow__cap` truncated with an ellipsis. | The links are `--control-quiet-ink` underlined, the label is `--color-ink-secondary` and the rail is `--boundary-selected-quiet`. `#exercise` and `#exDetail` carry the 16px gutter as padding and give it back as margin, so the bleed stays inside their boxes with no pixel moved (the pinned layer a push draws takes no negative margin); the lines wrap. |
| `library/exercise-detail-glossary` | Back, "Understand RIR", "Why this weight" and the recommendation label and rail were accent; the illustration field bleeds past `#exercise` and `#exDetail`, which then overflow their boxes; `.listrow__sub` and `.statrow__cap` truncated with an ellipsis. | The links are `--control-quiet-ink` underlined, the label is `--color-ink-secondary` and the rail is `--boundary-selected-quiet`. `#exercise` and `#exDetail` carry the 16px gutter as padding and give it back as margin, so the bleed stays inside their boxes with no pixel moved (the pinned layer a push draws takes no negative margin); the lines wrap. |
| `program/no-program` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `program/progression-editor` | The "Edit" toggle was accent text. | The toggle is `--control-quiet-ink`. The editor's Undo, Replace, Detach and unlinked-swap marks, which no catalog state renders, are ink for the same reason. |
| `program/exercise-picker` | The head was the old grab and three-slot head with Cancel and an accent "Done"; the active chip was accent; `.pickrow__meta` truncated with an ellipsis; the filter rail scrolls sideways. | The sheet is headed by `.sheetband` (title, subtitle, close as Cancel); "Done" is the first action in the foot (`btn--cta`); the chip is `--well` with the quiet ring; the meta wraps. The filter rail keeps scrolling sideways (excepted, see "Filter rails"). |
| `program/custom-exercise` | The head was the old grab and three-slot head with Cancel and an accent "Save". | The sheet is headed by `.sheetband` (title, close as Cancel); "Save" is the foot action (`btn--cta`); the "Reload" link is underlined ink. |
| `program/custom-exercise-saving` | The head was the old grab and three-slot head with Cancel and an accent "Save". | The sheet is headed by `.sheetband` (title, close as Cancel); "Save" is the foot action (`btn--cta`); the "Reload" link is underlined ink. |
| `program/custom-exercise-deleting` | The head was the old grab and three-slot head with Cancel and an accent "Save". | The sheet is headed by `.sheetband` (title, close as Cancel); "Save" is the foot action (`btn--cta`); the "Reload" link is underlined ink. |
| `program/custom-exercise-archiving` | The head was the old grab and three-slot head with Cancel and an accent "Save". | The sheet is headed by `.sheetband` (title, close as Cancel); "Save" is the foot action (`btn--cta`); the "Reload" link is underlined ink. |
| `program/custom-exercise-recovery` | The head was the old grab and three-slot head with Cancel and an accent "Save". "Reload" was accent text. | The sheet is headed by `.sheetband` (title, close as Cancel); "Save" is the foot action (`btn--cta`); the "Reload" link is underlined ink. |
| `program/share-setup` | The head was the old grab and three-slot head with a text Close. | The sheet is headed by `.sheetband` (title, subtitle, icon close). |
| `program/share-ready` | The head was the old grab and three-slot head with a text Close. | The sheet is headed by `.sheetband` (title, subtitle, icon close). |
| `program/text-export` | The head was the old three-slot head with an accent "Copy" and an ellipsised subtitle. | The sheet is headed by `.sheetband` (the subtitle wraps); "Copy" joins "Share or save" in the foot as a `btn--steel` pair. |
| `settings/main` | Back was accent text, the guide cue sat on the accent wash, and the "on" track of the switches was the accent. | Back is `--control-quiet-ink`; the cue is `--well`; the on track is `--boundary-selected-quiet` (ink). The storage warning line is ink. |
| `settings/appearance` | Back was accent text, the guide cue sat on the accent wash, and the "on" track of the switches was the accent. | Back is `--control-quiet-ink`; the cue is `--well`; the on track is `--boundary-selected-quiet` (ink). The storage warning line is ink. |
| `settings/guides` | Back was accent text, the guide cue sat on the accent wash, and the "on" track of the switches was the accent. | Back is `--control-quiet-ink`; the cue is `--well`; the on track is `--boundary-selected-quiet` (ink). The storage warning line is ink. |
| `settings/guides-replay` | Back was accent text, the guide cue sat on the accent wash, and the "on" track of the switches was the accent. | Back is `--control-quiet-ink`; the cue is `--well`; the on track is `--boundary-selected-quiet` (ink). The storage warning line is ink. |
| `settings/privacy` | Back was accent text, the guide cue sat on the accent wash, and the "on" track of the switches was the accent. | Back is `--control-quiet-ink`; the cue is `--well`; the on track is `--boundary-selected-quiet` (ink). The storage warning line is ink. |
| `settings/privacy-disclosure` | The sheet was headed by a wrapper, the old three-slot head and a typed "x" close. | The sheet is headed by `.sheetband` (title, the transfer-exception subtitle, icon close); the body keeps its scroller. |
| `install/banner` | Already conforming. The BASE audit found nothing and no off-role type size is rendered. | None. |
| `install/ios-sheet` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x"; the drawn Safari bar ringed its target in the accent, its step numbers were accent, the host line used an ellipsis and the PT "Toque" label overflowed its 38px target. | The sheet is headed by `.sheetband` (title, subtitle, icon close; the app-icon mark is dropped, see the open question); the ring is `--boundary-selected-quiet`, step numbers `--color-ink-secondary`, the host clips without an ellipsis and the label is right-aligned on its target. |
| `install/transfer-ready` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x"; the drawn Safari bar ringed its target in the accent, its step numbers were accent, the host line used an ellipsis and the PT "Toque" label overflowed its 38px target. The status rail was accent. | The sheet is headed by `.sheetband` (title, subtitle, icon close; the app-icon mark is dropped, see the open question); the ring is `--boundary-selected-quiet`, step numbers `--color-ink-secondary`, the host clips without an ellipsis and the label is right-aligned on its target. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-eligible` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". | The sheet is headed by `.sheetband`. |
| `install/transfer-creating` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-retryable` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-claiming` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-importing` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-success` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-cleanup` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-terminal` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-destination` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-interrupted` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-unknown` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |
| `install/transfer-claimed-expired` | The sheet was headed by the old grab and a custom head with the app icon and a typed "x". The status rail was accent. | The sheet is headed by `.sheetband`. The status rail is `--boundary-selected-quiet`. |

### Filter rails: excepted, for review

The Library's muscle and equipment filters and the exercise picker's filter row are single-line rows of chips that scroll sideways by design (the picker's own comment: they must not wrap to three lines and eat the list). Their `scrollWidth` exceeds their box, so the overflow check reported them (10 findings in 3 states, in each theme). The two Library rails are already registered as intentional scrollers by the plan-050 catalog checks (`docs/ui-screens/manifest.json` `catalogChecks.intentionalScrollers`; the rows carry `data-allow-horizontal-scroll="x"` and a partly visible last chip as the cue), so `RULES_ONLY_OVERFLOW_EXCEPTIONS` excepts `[data-allow-horizontal-scroll='x']`, and `#exPickFilters` by id. A scrolling row without the marker is still reported. This is a second overflow exception beside Progress' tab row, so it is flagged for the owner: wrapping the chips is the alternative, and it would change the layout. The rails' two wrappers (`#libBrowse`, `#libFilters`) reported the rails' bleed as their own overflow; their gutter moved from margin to padding, which moves no pixel.

### Measured and not changed (RF-1)

On the live head, light and dark: the future segments and the planned line the D surfaces draw are `--boundary-required`, which measures 5.11:1 and 7.78:1 on `--bg` (3:1 required); no D surface uses `--rule-strong` for them (1.31:1 and 1.95:1). The light disabled-CTA label (`--control-primary-disabled-ink` = `--ink-soft` on `--control-primary-disabled-bg` = `--rule`) still measures 4.37:1 (5.90:1 in dark), under 4.5:1. Raising it needs a token value change, so it is left for the owner.

### Changed although no catalog state renders it

`.settings-warn`, the program editor's `.program-editor__undo`, `.program-editor__replace`, `.pex__detach` and the unlinked `.pex__swap`, `.libstep__bar.is-done`, the PR timeline's `.prtl__delta`, and the install-transfer divergence dialog (a `.sheet` built in `app.js` with the old head) are painted or headed under the same rules.

### Not changed

- The focused control's focus indicator (the library search field, the custom exercise name, the focused Done button) is `--color-focus`, the accent; see the audit note above.
- The delete confirmation on `history/delete-confirm` is an in-page alert, not a native `confirm()` (corrected by R7 N-1).
- `#restSheet` (timer presets) keeps its own head: R3f owns it.
- The "x" close glyph is replaced by the existing close mask on the sheets listed above; no new icon is added.
- The six converted bands do not select their text (`user-select: none`): the band is the sheet's drag rail, and a mouse push that starts on selected band text begins a text drag and cancels the sheet gesture (`test/sheet-swipe-dismiss.mjs` caught it).

## Reconcilable rows

Each Plan 064 §5.3 row is either resolved here, with its evidence, or assigned
to the slice that resolves it. None of these is an owner decision; where a row
touches one, the owner gate is named.

| ID | Resolution | Evidence or owner | State |
|---|---|---|---|
| C-01 | Every token the Direction D prototype introduced is mapped to an existing contract role, or listed as a proposal. No content job needs a new type size, radius step, control role, layer or elevation. The proposals are the ink quiet-selected boundary, the spacing scale with its gutter, `--rule-on-surface`, the art-tile exception, the shelf variant row, and the frequency-count, tab-row and cue-line rows. They route to the owner under OG-4, and the landing night pair under OG-3 (Plan 064 §8.2: not built without an approved pair). R1 implements only what those gates approve. | "Contract review for Direction D content jobs" above | Resolved for R0; acceptance held by OG-3/OG-4 |
| C-02 | The protected `clamp(32px,10vw,42px)` rest clock stands unless the owner accepts the polish proposal. In the app `:root` is already the size container, so `10cqi` and `10vw` resolve alike, and the proposal's stated reason does not apply there. | Contract review §3 | Held by OG-4 |
| C-03 | The landing's in-app product shots are regenerated from the R3 Today, Focus and Why states before R6 closes. R2 ships with the shots `main` already carries, so no screenshot of a retired UI ships at the end. | Assigned R6 (with R2 recording which shots are interim) | Assigned |
| C-04 | R2b aligns `rec.add2.text`, `rec.add.tempered.text`, `rec.hold_add_reps.text_effort` and `rec.push_reps.text` to the I-05 vocabulary in both languages. The recommendation baseline fixture records every change. | Assigned R2b | Assigned |
| C-05 | `entry.freeform.privacy` is rewritten in PT-BR with ADR 0014's meaning unchanged. The terminology inventory lists 25 European-Portuguese keys to fix the same way, whatever OG-2 decides: landing keys in R2, entry keys in R4. | Terminology inventory §5 | Assigned R2/R4 |
| C-06 | The treatment table is re-derived from the 148-screen manifest. Five screens newer than Direction D's inventory are classified by rule and flagged for the owning slice to confirm. `onboarding-shared/gate` and `/invalid` are landing states (R2). | "Surface treatment table" above | Resolved |
| C-07 | The retire and add list names the planned removals and Direction D's added states. Each slice edits the manifest and scenarios for its own states in the commit that removes or adds the route, and the orchestrator captures and commits frames. `program/readiness` retires only after OG-5. | Treatment table, "Retire and add list" | Assigned per slice |
| C-08 | A slice that moves a control that anchors a contextual guide moves the anchor in the same commit and proves the cue still fires once and replays from Settings (G-49, G-62, G-69). | Assigned to the moving slice; R5 re-proves the journeys | Assigned |
| C-09 | N01: R3d replaces the hardcoded `${setsTotal} sets` with a complete translated message and count handling, proved by rendered PT output. The `⋯` actions stay per G-42. | Assigned R3d (with I-08) | Assigned |

### Gate routing for the contract review's open choices

The contract review leaves choices that no slice may make. They are asked in
the R0 owner batch:

- **OG-4 (Direction D polish and content jobs):** the five polish proposals; the seven 058 content jobs; the shelf variant row, top radius and field/pad grounds; the 1.5px or 2px selected outline; `--rule-on-surface` versus `--boundary-modal` in light; the progress classification of the History frequency bars; the spacing scale; the art-tile exception; the rest-clock proposal (C-02).
- **OG-3 (landing final page):** the night hero band, either as an approved surface token pair in both themes or as a scoped dark block, and the two `#4A453D` marks that fail 3:1 as drawn. The orange and ink fields pass AA and need only a named pair.

Measured conflicts that no slice may carry, whatever the gates decide:

- Future segments and planned lines on `--rule-strong` fail 3:1 where the inventory marks them `required`.
- The 2px bar radius is CSS literal debt under `--strict-css`.
- The light disabled-CTA label measures 4.37:1. It already ships on `.btn--cta:disabled`, so R1 records it as a finding rather than copying it.
