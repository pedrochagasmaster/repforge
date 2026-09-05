# Plan 056: Progress and block lifecycle

Implementation and review use the [evidence protocol](../docs/agents/implementation-evidence.md)
and this plan's [first proof checkpoint](../docs/agents/ui-overhaul-proof-checkpoints.md).

- **Plan number:** 056
- **Phase:** 5 — Progress and block lifecycle
- **Status:** Planned; implementation has not started
- **Owner approval state:** Flow and evidence policy plus recovery policy
  version 2 are approved; implementation must preserve the closed recovery
  contract and still provide its required evidence
- **Depends on:** Plan 049; Plan 050; Plan 052 transition/provenance foundation. Progress contextual cues integrate with Plan 054's registry
- **Blocks:** Progress-owned Plan 057 integration, Plan 058 system convergence, and Plan 059 launch validation
- **Governing G decisions:** G-11, G-24, G-27, G-29–G-36, G-38, G-49, G-53–G-56, G-60–G-61, G-69–G-70
- **Governing UI findings:** UI-08, UI-09, UI-10, UI-11, UI-12, and chart-policy part of UI-29
- **Affected surfaces:** Progress Overview/Review/Evidence, Strength/Volume/PRs, Program end-block entry, transition diagnosis/preview/confirmation, guided editor handoff, recovery-week status
- **Complexity:** Very high
- **Risk:** Very high — product decisions are derived from sparse evidence and can replace a program

## Problem statement

Progress currently presents five equal tabs, wide clipped tables, a generic attention list, misleading fresh-program warnings, mixed outcome/action vocabulary, fixed-window volume comparisons, and a Review surface that can compare a partial block with a full block and suggest structurally unfaithful changes. The Program tab separately exposes **End block**, fragmenting one lifecycle task. Sparse charts draw a trend even with only one or two observations.

This phase makes Progress a two-level decision guide and evidence record, and consumes Plan 052's reconstructable transition proposals rather than mutating programs in the UI.

## Approved direction

- Primary navigation: Overview and Review. Secondary Evidence: Strength, Volume, PRs.
- Overview answers two distinct questions: current-week status and actionable program-wide items.
- Untested/insufficient evidence is neutral baseline-building, never poor performance or progress.
- Observed outcomes: improved, maintained, declined. Recommendations/actions: progress, repeat, review.
- Review is read-only during an active block; at block end it exposes confirmed transition actions.
- Diagnose schedule failure as fewer days or sessions too long, then preview a lower-frequency or shorter-session same-family sibling. Fall back to exact-program guided manual repair.
- **Reduce training volume** is a separate explicit, protected/minimum-aware action.
- Recovery week follows only approved policy version 2: sufficient maintained or
  declined evidence across at least two of the canonical primary patterns
  (`knee-dominant`, `horizontal press`, and `hip/hinge`) plus the local Yes
  checkpoint, Rule B allocation, the two allowlisted misses, and the
  week-one/reassessment lifecycle. It never silently mutates.
- Strength defaults to current block with explicit all-history context.
- Volume shows this week and block-to-date against matching plan periods.
- One point is a snapshot; two points a comparison/delta; three or more a trend.
- Mobile uses summary rows and drill-in, not clipped desktop tables.

## Preserved strengths

Preserve deterministic progression/`Why this weight?` facts, compiler provenance, explicit activation/confirmation, immutable workout history, local-first/offline analysis, core outcome evidence, warm palette and Sans/Mono data roles, accessible adjacent explanations, and catalog truth. Evidence presentation changes must not rewrite progression thresholds or claim certainty the logs do not support.

## Non-goals

- No general intervention/cause-routing framework beyond these exact transition actions.
- No autonomous lifecycle decisions, background program mutation, or new scientific claims.
- No new progression thresholds/formulas, load/RIR/frequency recovery formula, or universal deload assertion.
- No desktop table as primary mobile UI; export/secondary detail may retain complete tables.
- No general program-lifecycle expansion, creator attribution, Pro/AI/cloud/native work.
- No fixture correction; Plan 050 already owns the implausible lateral-raise value.

## Current-state audit

- `index.html` has one five-button `statsSeg` tablist (`overview`, `strength`, `volume`, `prs`, `review`), wide dashboards, and separate `#endBlock`/`#blockReview`/`#endBlockConfirm` surfaces.
- `STATS_SEG` and `setStatsSeg()` in `app.js` switch all five views at one level.
- `weeklySnapshot()` computes current week; `buildBlockReview()`/`blockSnapshot()` build lifecycle facts. Review currently uses full-block planned sessions/volume even mid-block.
- `DELTA_THRESHOLDS` and paired exposure logic produce improved/flat/regressed signals. Some UI labels still conflate status/recommendation. Current fresh-program Overview can produce ten orange “attention” rows despite no evidence.
- `successorProgramList()` changes sets by ±1 or chooses the first alternate. Plan 052 removes this as a transition source and provides immutable proposals.
- Strength dashboard uses all available history in primary rows. Volume dashboard compares completed 7/28-day totals with one weekly planned map; this makes the 28-day comparison dimensionally false.
- `.table` scrolls; Strength/Volume table content has minimum width around 520px inside ~358px and lacks a reliable continuation cue.
- Chart rendering connects sparse points. Dates are often raw ISO/short strings in tables while headings/inputs use inconsistent roles.
- Current catalog has Overview, exercise chart, Strength, Volume, PRs, and Review frames. Baseline runtime exposes fresh-program attention and partial-block arithmetic that this plan replaces.

## Architecture

### Progress view model boundary

Extract pure, dependency-free evidence/view-model logic from DOM rendering, either into `progress-model.js` or a similarly scoped module loaded before `app.js`:

```text
buildWeekStatus(program, meta, log, now) -> WeekStatus
buildProgramActionQueue(program, meta, log, progressionFacts) -> ActionItem[]
buildReviewCheckpoint(program, meta, log, now) -> Checkpoint
buildStrengthEvidence(scope, exerciseId, log, meta) -> EvidenceSeries
buildVolumeEvidence(scope, program, meta, log, now) -> VolumeComparison[]
buildPREvidence(scope, log, meta) -> PREntry[]
```

The module returns codes, values, scopes, evidence counts, and destination IDs—not localized HTML. It consumes authoritative progression results and Plan 052 proposal APIs; it does not reimplement progression/transition math.

### Navigation model

Use a primary tablist with `overview` and `review`. Evidence is a labelled secondary group containing `strength`, `volume`, and `prs`. Opening evidence sets `evidenceView`; it does not masquerade as a third primary task. Browser/back/focus behavior returns to the invoking Evidence row/group and preserves selected exercise/scope where safe.

Program's old **End block** action becomes a route to Progress → Review. It must not open a separate competing review/confirmation dialog. The single Review surface changes capabilities based on lifecycle eligibility.

### Evidence and outcome model

Every observation has `evidenceState: insufficient | sufficient` and, only when sufficient, `outcome: improved | maintained | declined`. `insufficient` carries reason (`untested`, `one-incompatible-exposure`, `missing-effort`, etc.) and baseline-building copy. It cannot enter action counts, warning colors, success counts, transition eligibility, or “progress” claims.

Recommendations use `progress | repeat | review` plus structured rationale and destination. They are not styled/labeled as observed outcomes. Existing engine facts and paired-exposure compatibility remain authoritative; this plan changes presentation/scope, not thresholds.

### Overview scopes

Render two named sections:

1. **This week:** schedule position, completed/planned sessions/working sets for the current program week, and neutral in-progress wording. It does not infer a final weekly outcome before the period closes.
2. **Needs action:** program-wide items backed by sufficient evidence and a concrete destination/action. Empty state says there is nothing requiring action; it does not say all lifts improved.

Baseline-building/untested counts may appear as neutral context outside Needs action. Never mix current-week adherence with all-program progression evidence in one percentage/status.

### Review lifecycle

`buildReviewCheckpoint()` has explicit states:

- active block: read-only checkpoint, correctly scoped through today/current program week; no structural confirm actions;
- block complete: final observed outcomes plus explicit choices (continue/repeat/progress where already valid, schedule repair, reduce training volume, eligible recovery week, guided edit);
- insufficient final evidence: shows neutral facts and only non-evidence structural/manual routes allowed by the audit; no performance-triggered transition;
- proposal preview/stale/confirm/commit/failure/success.

Every structural choice calls Plan 052 to create an immutable proposal, renders its exact diff, and confirms the same proposal hash. Archive/activation happens only at confirm.

### Schedule repair and guided handoff

Ask one diagnosed question first:

- **Fewer days available** → request lower-frequency sibling.
- **Sessions take too long** → request shorter-duration sibling at current frequency.

If Plan 052 returns a safe candidate, show before/after frequency/duration/day/exercise/prescription diff and provenance. If unavailable, clone the exact current program into the existing candidate editor, annotate the diagnosed constraint, highlight the relevant day/frequency/duration controls, and require explicit user edits plus activation. Opening/canceling guided repair never archives or changes the program.

### Volume periods

- **This week:** completed hard-set totals from the current locale-aware week/program-week boundary against one current-week canonical prescription. During an incomplete week, label progress toward the full week; do not call it decline/underperformance solely because time remains.
- **Block to date:** completed hard sets from block start through now against the sum of canonical weekly prescriptions for elapsed numbered block weeks, including each versioned `weekPrescription`/recovery overlay that actually applied. Cap at block length and never substitute a 28-day window.
- Show the period/bounds in accessible text. Historical program changes use their archived prescription/provenance; do not compare old work with the current plan.

### Sparse Strength charts

Return `snapshot` for one compatible point, `comparison` for exactly two (dates/values/absolute and percentage delta), and `trend` for three or more. Zero points shows baseline-building. A comparison may include a restrained connector only as secondary decoration; it is not a trend. Always show values/dates in text.

### Mobile evidence rows

Primary mobile Strength/Volume/PR views use compact summary rows with full exercise/muscle labels, current value/scope/outcome, and a drill-in action. Drill-in shows the complete evidence and optional horizontally scrollable/export table with explicit label/cue. No primary row relies on clipped columns or hidden scrollbar.

## Domain/state model

- `EvidenceSeries`: scope, compatible observations, evidence state/reasons, presentation (`empty|snapshot|comparison|trend`), outcome if sufficient.
- `WeekStatus`: exact date/program-week bounds, plan/completed quantities, status (`not-started|in-progress|complete`), no outcome inference.
- `ActionItem`: stable evidence/destination ID, recommendation verb, rationale codes; no raw localized text.
- `Checkpoint`: lifecycle state, date/period bounds, observed outcomes, eligible transition kinds/reasons.
- `ProgressNav`: primary and optional evidence view plus selected entity/scope; UI-only persistence if needed.

Do not serialize rendered chart coordinates or localized labels. Transition proposals/records remain owned by Plan 052.

## Migrations

- Map old `statsSeg` values: `overview` → Overview, `review` → Review, and `strength|volume|prs` → matching Evidence view. Unknown values return to Overview.
- Remove obsolete separate end-block modal state after routing Program's action to Review.
- Preserve all historical log/program/archive rows. Do not backfill outcomes/transitions from display names or current rules.
- New transition/recovery schema parsing comes from Plan 052; old blocks remain readable without fabricated provenance.
- Update i18n/generated files and service-worker/current script revisions. Add new pure module to cache inventory.

## UX state specification

### Overview

- Fresh program/no logs; partial current week; completed week; no actionable evidence; one/many action items; stale/current block context.
- Baseline rows neutral, action rows linked, outcome/recommendation clearly separate.

### Review

- Active-block checkpoint; end-of-block sufficient evidence; end-of-block insufficient evidence.
- Diagnosis choice; sibling loading/unavailable; lower-frequency preview; shorter-session preview; guided-editor handoff/cancel/activate.
- Permanent volume reduction available/unavailable and exact preview.
- Recovery ineligible reasons; readiness questions; eligible preview; confirmation; active week-one marker; canonical week two; reassessment.
- Stale proposal, commit failure/retry, success/new-block destination.

### Evidence

- Strength scope current block/all history; exercise selection; 0/1/2/3+ compatible points; incompatible/missing evidence.
- Volume this week/block-to-date; in-progress/complete periods; zero plan/no completed work; drill-in.
- PRs empty/list/drill-in with locale dates.

## Accessibility

Primary and Evidence navigation use accurate tab/navigation semantics without nested conflicting tablists. Scope selectors expose names/selected state. Baseline, outcomes, and recommendations are text/icon-labelled; green/warning/neutral color is supplemental. Summary rows are buttons/links with full accessible names. Charts have equivalent textual tables/summaries; SVG/canvas decoration is hidden where redundant. Transition dialogs/sheets restore focus, announce stale/failure/success, and keep explicit confirmation. Readiness questions have groups and validation. Date controls are platform-native while editing.

## Localization

Create complete EN/PT-BR messages for each evidence reason, outcome, recommendation, time scope, diagnosis, proposal, and recovery state. Use long locale dates for headings, short locale dates in rows, platform date input for editing. Do not interpolate title-cased display labels into sentences or persist translations.

## Responsive behavior

At 320px and 200%, primary tabs remain two usable controls; Evidence rows stack and drill in; metric values/units wrap without truncating names. Canonical/430 phones use summary density without desktop tables. Desktop may show secondary detail table beside/under summary but uses the same evidence/scope model. Demanding PT+200 covers Overview action queue, Review metrics/questions/diffs, Strength comparison, Volume scopes, and PR rows.

## Light/dark

Use Phase 049 roles. Improved uses restrained green, declined reserved warning, maintained/baseline neutral; words/icons carry meaning. Orange remains action/accent where contrast permits and is not a general outcome color. Charts/rules/boundaries pass rendered-role AA in both themes.

## Offline/PWA

All evidence, diagnosis, compiler proposals, preview, confirmation, archive, and recovery schedule work offline. Update cached module/script revisions. Test browser/installed navigation, SW upgrade during an open preview, and restoration of a stale proposal without committing it.

## Failure and recovery

- Insufficient/incompatible evidence returns baseline, never zero-progress or transition eligibility.
- Missing historical plan period/provenance displays unavailable comparison rather than substituting current plan.
- Proposal unavailable routes to exact-program guided repair.
- Stale proposal/current program change rejects confirmation and rebuilds only after user review.
- Crash/duplicate/two-tab commit uses Plan 052 atomic/idempotent behavior; one archive and one successor.
- Guided editor cancel/failure preserves active program.
- Corrupt recovery overlay falls back to canonical prescription with explicit recovery warning per Plan 052.

## Privacy

Readiness answers, evidence details, and proposal diffs stay local/backup and out of setup shares. No Progress view requires network. Contextual guidance does not expose workout facts externally.

## Telemetry

Only approved coarse task outcomes: Progress Overview/Review/Evidence opened; baseline/action item opened; transition kind previewed/confirmed/canceled/failed by coarse reason; guide completed/dismissed. Do not send exercise/program IDs, performance values, readiness answers, exact dates, diffs, or recovery eligibility facts. Owner interpretation only; no automatic redesign or transition.

## Testing and executable evidence

### Pure/scoped evidence

- Fresh/zero data is baseline, has no outcome/action, and cannot propose a performance transition.
- Outcome/action vocabulary is disjoint and every label matches its time scope.
- Active-block checkpoint uses elapsed scope and has no transition confirms; final block enables only evidence-valid actions.
- Strength 0/1/2/3+ policies and current-block/all-history filtering.
- Volume current-week and block-to-date denominators across block start, week boundaries, re-entry/recovery prescriptions, time zones, and archived program versions; no 28-day/one-week mismatch.

### Transition journeys

- Fewer-days → correct lower-frequency sibling exact diff; too-long → shorter-duration sibling; unavailable → exact guided draft/no archive.
- Permanent reduction respects protected/minimum work.
- Recovery requires maintained/declined evidence plus corroboration under policy
  version 2, preview/confirm, week-one volume only, week-two canonical
  restoration, and reassessment.
- Stale/duplicate/two-tab/crash/backup behavior from Plan 052 through visible UI.

### UI/catalog

- Two-level navigation, keyboard/focus/back restoration, mobile summary drill-in, full names, scroller cues for secondary table only.
- EN/PT, light/dark, 320/390/430, 200%, PT+200, reduced motion, rendered-role contrast, overflow, locale dates.
- Program End block routes to the same Review surface; obsolete dialogs/actions absent.
- Run focused progress/progression/compiler/transition tests, accessibility/catalog gates, then full browser/generative regression.

## Screen catalog changes

- **New states:** Overview baseline/action/weekly variants; active Review checkpoint; end-block actions; schedule diagnosis; lower-frequency/shorter-session preview; guided repair; volume-reduction preview; recovery ineligible/questions/preview/active/reassessment; Strength 0/1/2/3+ and scope variants; Volume two scopes/drill-in; PR drill-in.
- **Removed states:** separate Program end-block confirm/review dialog; five-equal-tab composition; desktop-table-as-primary states.
- **Changed states:** all six current Progress states and Program overview end-block entry.
- **Matrix expansion:** demanding Review/diff/evidence states get PT+200; all public states get broad EN/PT and light/dark; charts include reduced motion/semantic evidence. Record exact state/frame delta.

## Owner gates

1. Preserve Plan 049 recovery policy version 2: its exact eligibility question
   and answers, two-pattern evidence requirement, Rule B allocation and rescue,
   allowlisted misses, 40–60% eligibility boundary, and Better/About the
   same/Worse reassessment outcomes. Future out-of-band versions require a new
   version-specific decision; runtime percentage clamping is prohibited.
2. Owner reviews real-device interpretation of baseline/action scopes, all transition previews, and recovery wording. Plan 059 performs final physical accessibility/sign-off.

## STOP conditions

- Stop if a label's actual time scope/denominator cannot be reconstructed.
- Stop if insufficient/untested evidence would be colored negative, called progress, or enable a performance transition.
- Stop if schedule repair cannot come from Plan 052 provenance or exact guided repair.
- Stop recovery if policy version 2, its evidence/allowlist/reassessment
  contract, or canonical week-two prescription drifts; it must not change
  load/RIR/frequency or introduce a runtime percentage clamp.
- Stop if transition preview and commit hashes differ or archive/history/progression identity cannot be preserved.
- Stop before building general lifecycle/intervention infrastructure.

## Rollback

Keep parsers for new navigation prefs and transition records. The UI can temporarily route back to read-only Overview/legacy evidence while disabling structural confirms, but must never restore unsafe `successorProgramList()` transitions. Each evidence/navigation/transition UI slice is independently feature-disableable; committed successor/archive data remains readable. Roll forward any schema recovery issue rather than stripping provenance/recovery overlays.

## Atomic commit sequence

| # | Exact commit message | Contract delivered | Likely files | Prerequisite | Focused proof | Broader regression | Catalog impact | PR-body update | Rollback boundary |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `test(progress): pin evidence scope and lifecycle invariants` | Baseline, vocabulary, period arithmetic, sparse data, active/final review characterization | progress/simulation fixtures/tests | Plan 050/052 | Pure failing/characterization matrix | Progress/progression tests | None | Record old defects and desired invariants | Tests only |
| 2 | `feat(progress): add scoped evidence view models` | Week/action separation, evidence states/outcomes/actions, Strength/Volume/PR scopes | new progress model, app adapter, pure/property tests, cache | Commit 1 | Scope/zero/sparse/period tests | Progression/generative smoke | None | Record model API/reason codes | Revert module before UI switch |
| 3 | `feat(progress): establish Overview Review and Evidence navigation` | Two-level navigation, migration/back/focus, Program Review route | `index.html`, `app.js`, styles/i18n/tests, SW | Commit 2 | Navigation/Program-route/semantic tests | App/accessibility suites | All Progress composition changes | Record migration/route proof | Revert view switch; retain pref parser |
| 4 | `feat(progress): adapt Strength Volume and PR evidence` | Mobile summaries/drill-in, current-block/all-history, correct periods, sparse chart policy, locale dates | progress renderers/styles/i18n/tests | Commits 2–3 | 0/1/2/3+, denominator, geometry/a11y | Progress/progression/catalog | Evidence states added/changed | Record time-scope assertions | Revert renderers, retain model |
| 5 | `feat(progress): unify Review and end-block lifecycle` | Active checkpoint vs end actions; obsolete competing dialogs removed | app/index/styles/i18n/tests | Commit 3 and Plan 052 | Active/final/insufficient capability matrix | Program/progress/accessibility | Review/Program states change | Record no-action active proof | Disable confirms; retain read-only Review |
| 6 | `feat(progress): add reconstructable schedule repair` | Diagnosis, sibling exact preview, guided editor fallback/cancel/activate | app + transition/entry adapters, styles/i18n/tests | Commit 5; Plan 052 | Both diagnoses, supported/unavailable, stale/no-archive tests | Compiler/entry/storage suites | Diagnosis/preview/guided states | Record candidate provenance/diffs | Disable schedule actions; records remain |
| 7 | `feat(progress): add protected volume and recovery actions` | Separate permanent reduction and policy-version-2 recovery questions/preview/week status | app/progress/schedule adapters, styles/i18n/tests | Commit 5; Plan 049 policy version 2 | Constraint/eligibility/week1-week2/reassessment/stale tests | Transition/progression/storage suites | Volume/recovery states | Link policy version and exact proofs | Disable actions/overlay; keep parsers |
| 8 | `feat(help): attach Progress lifecycle guidance` | Interpretation/review cues through Plan 054 registry | progress UI/i18n/tests | Relevant anchors stable; Plan 054 | Complete/dismiss/replay/missing-anchor focus | Help/accessibility suites | Cue states | Record guide IDs/versions | Disable cues; no behavior loss |
| 9 | `test(progress): prove lifecycle and catalog acceptance` | Full locales/themes/text/reduced/transition fault/catalog/owner phone evidence | tests/manifest/scenarios/PNGs/docs | Commits 3–8 | Required Progress matrix | Full browser/generative/audit checks | Exact delta recorded | Fill owner/completion/handoff evidence | Evidence rolls back with owner slices |

For each row: mark 🟡; implement only the row; run its focused proof; inspect the complete diff; remove unrelated changes; commit; push immediately; update the PR; proceed only from a truthful remote boundary.

## Implementation-agent operating protocol

### Branch/worktree contract

- **Branch:** `ui-overhaul/056-progress-lifecycle`
- **Worktree:** `../repforge-ui-056-progress`
- **Base:** current `origin/main`
- **Dependency gate:** Plans 049/050/052 merged with policy version 2; recovery slice preserves that contract; cue slice waits for Plan 054 registry
- **Primary files:** Progress portions of `app.js`/`index.html`/`styles.css`, new progress model, transition/entry adapters, i18n, progress/catalog tests
- **Shared hotspots:** `app.js`, `styles.css`, `index.html`, i18n/generated, SW, program compiler/entry adapter, manifest
- **Conflicting phases:** Plan 052 owns proposal/provenance; Plan 057 consumes outcomes in summary/Today/Program; Plan 058 owns final tokens
- **Safe parallelism:** Plan 054/055 feature-owned modules can proceed; serialize shell/i18n/SW/manifest and Progress/Program editor integration. Plan 057 should wait for outcome/view models it consumes
- **Integration order:** 049/050/052 → 056; relevant 054 guide registry → cue slice; 056 before Progress consumers in 057/058/059

Fetch/inspect main, branches, worktrees, PRs; resume existing work. Use one dedicated worktree; keep coordination checkout clean; never copy uncommitted files or delete others' work. Push `chore(plan-056): start implementation`, open a draft PR, and complete its body before substantive work. Target main. When prerequisites merge, fetch and explicitly merge `origin/main`, resolve deliberately, rerun affected proof, push, and update the PR. Never rebase published history.

### Required implementation PR body

```markdown
## Objective
## Scope boundary
### In this PR
### Explicitly out of scope
## Dependencies
- Depends on:
- Blocks:
- Required main state:
- Current dependency status:
## Planned commit sequence
| # | Status | Atomic commit | SHA | Focused verification |
|---|---|---|---|---|
<!-- ⬜ planned; 🟡 in progress; ✅ pushed and verified; ⛔ blocked; ↪ changed -->
## Current state
- Current slice:
- Last pushed SHA:
- Worktree:
- Worktree clean:
- Relationship to main:
- Active blocker:
- Owner decision required:
- Completion-gate status:
## Completed work
## Verification evidence
| Check | Result | SHA |
|---|---|---|
## Risks and decisions
### Confirmed decisions
### Assumptions
### Newly discovered risks
### Outstanding owner decisions
## Next exact steps
1.
2.
3.
## Future plan steps
## Handoff
- Branch:
- Worktree:
- PR:
- Base:
- Current main SHA:
- Last known-good SHA:
- Latest focused tests:
- Latest full regression:
- Latest catalog evidence:
- Latest physical-device evidence:
- Files owned:
- Shared hotspots:
- Blocked on:
- Owner approval required:
- Exact next action:
- Last updated:
```

### Push, history, and handoff discipline

Push every coherent tested slice immediately and update PR status/evidence/next steps. Published SHAs are stable: no amend, rebase, force-push, silent rewrite, or stash handoff. Never checkpoint known-broken or structurally unsafe transition work; return to the last pushed boundary. Do not duplicate Plan 052 or copy unpublished dependencies. Record the policy version, proposal hashes/fixtures, time-scope evidence, device results, and exact next action. Run `git status --short` before stopping; handoff is clean. Do not merge without authorization; owner review requires every row and owner/device/catalog/accessibility gate complete.

## Completion gate

- Primary Overview/Review and secondary Evidence navigation are correct and accessible.
- Overview cleanly separates current-week status from program-wide action; insufficient evidence is neutral and enables no performance transition.
- Outcomes and recommendations use the approved disjoint vocabularies.
- Active Review is read-only; end-block Review owns all confirmed actions and Program routes to it.
- Schedule/volume/recovery proposals show exact Plan 052 diffs/provenance, preserve/archive atomically, reject stale/insufficient state, and require confirmation.
- Strength, Volume, PRs, sparse charts, mobile rows, drill-ins, period denominators, and locale dates match actual scope.
- Recovery uses only approved policy version 2 and canonical week two.
- EN/PT, themes, 320/390/430, 200%, PT+200, reduced motion, AA roles, overflow, offline/SW, fault, catalog, and owner-phone evidence pass.
- Branch/PR are pushed, current, clean, and stopped at owner review.
