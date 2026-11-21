# Plan 085: Suggested warm-ups and partial reps

Status: **interaction approved, implementation proposed**. Base
`e844a870a04c6acbd5bfbf78da30573ff4b3535e` on `origin/main`. The owner chose
Prelude and Past zero. Section 7 holds the policy and copy decisions for
approval. Scheduling lives in the [backlog](../docs/backlog.md).

## 1. Reference and scope

[Prelude and Past zero](https://devbox.tail3e8d7c.ts.net/warmup-partials?wu=C&p=C)
are the visual and interaction reference. The matching local reference is
`/home/ubuntu/warmup-proto-build/serve/`: `index.html` is the production Focus
snapshot, `proto.js` supplies behavior and fixtures, and `proto.css` supplies
the added treatments. Use `ramp=baseline|learned|warm|skipper`, `prog=tie`,
and `theme=light|dark` to reproduce the states. The copied
[exploration](../docs/design/warmups-and-partial-reps-ux-exploration-2026-11-13.md)
records earlier alternatives. The approved prototype and owner brief govern
the chosen interactions.

For the 105 kg squat, log the 20 × 8, 60 × 5 and 85 × 2 warm-ups with the shelf,
then log the same three working sets the program prescribed. In the tie
fixture, the first previous working set was 105 × 6+2 at 0 left. Log 105 × 6+3
at 0 left and see “Tie broken” while the load recommendation still follows the
six full reps. Authored partial-ROM prescriptions, partial-only workouts,
equipment inventory management, and new program and telemetry formats are
outside this plan.

## 2. Performed sets and durability

**Partial reps.** Add an optional integer `partialReps` to the DraftV2 set
and performed history row. Omission means zero and zero canonicalizes to
omission. Accept 1–5 on ordinary working sets with a positive full-rep metric
and an explicit numeric 0 reps left. Use the set's own effort field and
provenance. A prefilled zero, the word Max, and a calibration failure zero
alone are insufficient. Keep `metricValues`, `reps`, `rir` and effort source
in their current formats. Initially support the ordinary `reps` metric.
`repsPerSide` needs an owner decision about what a single partial count means.

In [workout-draft.js](../workout-draft.js), give numeric effort and partial
selection one atomic command, bound to the set and expected draft revision.
Selecting a nonzero effort, changing to word effort on that set, or relabeling
it as a warm-up clears its partials in the same write. A global effort-mode
change preserves logged numeric rows. New sets, repeats and suggestion
refresh start with no partials. Correction restores the original count,
updates the same set, and restores the original on cancel. Protect the
correction through reload and substitution. Untouched suggestions and old
history never supply partials to a new row.

**Suggested warm-ups.** Put the optional `warmupPrelude` plan on the DraftV2
exercise. Capture the performed lift and loading identity, first working
target, reason and evidence summary, reset generation, ordered suggestion
IDs and target values, skip status, and any pending shelf edits. Use commands
to initialize, edit, add or remove pending steps, record a completed step,
skip the remainder, and correct a logged step. Record an actual warm-up in
`sets` with `role: "warmup"`, `origin: "suggested-warmup"` and a
`warmupSuggestionId` joining it to the exercise's plan. A lifter-added step
uses the same ID space and has manual provenance in the plan. Allocate stable
IDs once per command and require a one-to-one join from completed steps to
sets. Keep unperformed steps outside `setOrder` and outside history. Keep
load and full reps in the canonical metric fields and leave effort absent.
Do not reuse calibration's `insertSet` command or `origin: "ramp"`.

Check that both `toHistoryRows` and `progressionCurrentSession` derive
working indices without counting either inserted warm-up origin, even when
preparation precedes set 1. Preserve the existing programmed index across
manual role switches and unlogged work. Audit the physical ordinal consumers in `app.js`
including draft key lookup, open-row selection, progression refresh, next
exercise, early finish, set-reduction/program edits and session set counters.
The W ledger group does not renumber the work. Exercise actions retains its
existing switch for deliberate reclassification of programmed slots.
Inserted warm-ups have edit/remove actions instead. Programmed or reclassified
warm-ups and calibration trials keep their existing rendering and provenance.
Give those paths precedence over automatic Prelude for an exercise that
already has preparation or is finding its working weight. A movement swap
recomputes unlogged suggestions under the replacement identity and retains
logged sets with their performed identity. Restore the original without
reusing preparation evidence from the replacement.

**Save and learn together.** On normal or confirmed early finish, attach a
versioned `warmupObservation` to the first completed working history row
for the eligible identity in that session. Capture the working target basis,
reset generation, decision (completed, edited or explicitly skipped),
ordered actual set IDs, and any qualifying earlier lift and completion
time. Preserve stable row IDs through history edits. Use the saved warm-up
rows for actual load/reps. Give all rows their existing session ID and a stable
exercise/slot join. Take at most one observation per comparable lift per
saved session, using its first eligible occurrence. No observation for
discard, untouched preview, exercise skip, isolated abandoned warm-ups, or
absence of an explicit preparation decision. After a partial skip with
logged sets, retain the actual rows and exclude that observation from both
the change and skip counters. Preserve explicitly logged rows on an early
finish that saves them.

Use the existing `WorkoutSession.finish` proposal, session-ID reconciliation
and exact-draft removal. A retry, failed commit, or second tab must not create
a second observation. Reset in Why writes a per-lift generation token in an
optional versioned `warmupPreferences` durable-state record, using the same
state queue and lock, with the key changed against the current durable head.
Compare the captured generation on read so an old draft finished after reset
cannot teach the new generation. Reset keeps performed rows and current shelf
edits. Before any warm-up is logged, a clean current plan can return to
baseline after a successful reset. Once edited or in progress, keep the plan
and apply reset to future sessions. A failed reset keeps the existing
suggestion and uses the storage error path. There is no second persistence
store or new UI preference.

Derive learned suggestions from live saved observations and matching actual
rows. A History correction changes the evidence on the next computation.
Delete a session and its observation with the rows. If the observed working
row or the warm-up rows needed to read its outcome disappear, ignore that
observation. Require the referenced rows only for a completed sequence.
An explicit whole-preparation skip has no warm-up row references. Delete
workout history clears observations and reset state in scope. A new block or program using the same comparable lift can use retained
history. A pristine plan seeded by rendering must remain replaceable and
must not appear on Preview, startup, or an untouched draft as performed work.
Explicit skip, additions, removals, shelf edits and completed rows receive the
existing DraftV2 protection for user input. Persist them through
`WorkoutSession.dispatch` and the CAS/checkpoint recovery path.

**Compatibility and exports.** Keep DraftV2, history schema and storage
keys. Old rows and drafts load with absent optional fields. Validate bounds,
origin/role pairing, IDs, joins, and partial/effort combinations at the
existing draft, history import and install-transfer validation points.
Malformed new fields use the existing refusal or recovery path. Preserve raw
draft bytes and respect checkpoint authority. Prove an old release through its
own matching shell and an updated worker, including a late legacy write
against an acknowledged draft. If a rollback reader cannot act on the new
draft, preserve it for recovery rather than reconstructing a lossy old draft.

Whole JSON backup and install transfer round-trip observations, performed
warm-ups, partials and reset tokens. Transfer also round-trips any pending
Prelude, skip and partial edit in DraftV2. Use current transfer bounds and
check exact schemas in [install-transfer-contract.js](../install-transfer-contract.js)
for both the service and the client. A clean boot must still qualify as a
fresh destination. CSV preserves numeric full `reps` and appends numeric
`partial_reps` (zero for none), with existing `is_warmup` and warm-up rows
retained. Leave strength/volume-derived CSV cells empty for warm-ups.
User-readable share and export text uses `6+2`. Program-only files and setup
links carry prescriptions and allowed settings, so no setup codec change.
Cover v4/v5 invariance with a setup proof. Keep the existing closed telemetry
contract and confirm existing working-set and exercise counts exclude
preparation. Never add payload fields, analytics events, warm-up counts,
partial counts, exact loads, or learned preferences to telemetry.

## 3. Warm-up suggestions and learning

Proposed owner: pure `warmup-suggestions.js`. Its caller supplies the
performed lift key, first working target, equipment load candidates,
session facts and validated saved observations. It returns ordered
suggestions, a reason, and evidence for Why. It also classifies a completed
plan or skip for the finish adapter and says whether the latest edits are
eligible for the “once more” notice. Pass time and dates in. The module does
no IO, DOM work, unit formatting or writes. The producer of canonical load
facts remains the existing progression/loading adapter.

- Key by performed movement UUID, selected equipment, canonical metric
  IDs, loading convention and execution mode. Reuse the existing comparable
  identity inputs, including materially different loading context. Share
  across slots, aliases and programs when those inputs agree. Use canonical
  kg in learning, with display rounded and localized at render.
- Baseline on the 20 kg barbell fixture is the empty bar for 8, 57% for 5,
  80% for 2. The first percentage reproduces the approved 60 kg step
  on the default 2.5 kg grid. A literal 60% would round to 62.5 kg. Use
  `availableLoadsKg` and its per-lift step or dumbbell ladder.
  For a known bar, intersect the grid with the bar and attainable paired
  plates. Recommend the nearest attainable warm-up load strictly below work,
  breaking equal distances down. Drop sub-minimum percentage steps,
  duplicates and non-increasing steps. Keep the earlier step on collision.
  Example assumptions are a 20 kg bar and repeatable pairs of 25, 20, 15, 10,
  5, 2.5 and 1.25 kg plates. With a 105 kg target these yield 20, 60 and 85.
  Use the existing display basis (per hand/per side when applicable) and
  omit the plate hint without a supported exact decomposition. Do not imply
  that Taurifer knows which plates are physically in the gym.
- For supported external-load machines and dumbbells use 60% × 5 and 80% × 2
  through the same grid rule. If no lighter valid step remains, suggest
  none. Recommend no automatic sets for bodyweight-only, assistance,
  materially bodyweight-loaded, unsupported metric shapes or unknown
  working loads. A manual warm-up remains available where its canonical
  load and rep metrics can represent it, including bodyweight or assistance
  without treating less assistance as a lighter load.
- Learn ordered step count, actual reps and load relative to the captured
  day target, with an empty bar kept as an explicit step. Normalize two
  sequences for equality by scaling and snapping the old sequence to the
  new operating load and comparing the resulting ordered load/rep pairs.
  Two consecutive agreeing complete observations in the same context
  establish a preference. A different observation is a candidate until
  repeated. Inserted/removed steps participate in that comparison. Keep the
  most recent established preference within the evidence window. A suggested
  sequence accepted as shown can establish the same preference. A single
  change does not replace it. Compute the “once more” message only on an
  eligible first change, and suppress it when the difference is likely to
  disappear during normalization. Learning only updates after workout save.
- “Already warm” requires a previous completed working set in this workout,
  a different performed lift with the same catalog primary muscle, and
  recent completion. Use the latest qualifying lift. Use that lift's
  stable identity as a separate context for learning. Shorten to one feeler
  only after two matching single-step observations after that lift. Until
  then use the ordinary sequence and let the lifter edit it. Fixture:
  squat after leg press, 10 minutes elapsed, two earlier sessions with the
  same preparation at about two thirds of the working load for 3 reps,
  so 70 × 3 at a 105 kg target. Reordering cards,
  prefilled sets, swaps without a logged working set, and prior workouts
  do not establish present readiness. A context change can recompute a
  pristine plan and must preserve a plan with user input.
- Three consecutive explicit whole-preparation skips in saved eligible
  sessions suppress suggestions for that lift. An actual logged preparation
  with saved work ends a skip streak. Suppressed sessions with no action
  neither add skips nor clear them. Derive the current skip streak from the
  latest relevant saved decisions in the reset generation, independent of
  the sequence learning window. “Add one” opens the same shelf and
  resumes future suggestions on save. Why offers reset, which immediately
  clears suppression under the reset rules above. A short-context pattern
  does not displace the ordinary learned sequence. A suppressed preference
  takes precedence over both.

## 4. Partial-rep comparison

[progression-engine.js](../progression-engine.js) currently normalizes sets
in `parsePerformedSet` and reads their first working set in
`performanceTrend`. `recommendOne` selects through capacity, history and
current-session anchors, fatigue and candidate ranking. Add the tie-break
after performed rows parse as comparable, at the performed evidence
comparison. Keep it out of `compareCandidates`, effective-load transforms,
capacity, fatigue, calibration, and the target solver. Today and next-session
targets, verdict marks, PR thresholds, e1RM, rep goals and volume use the same
numbers with or without partials.

The live Focus adapter compares the just-logged working set with the same
working index from the immediately preceding comparable session. Match
performed identity, equipment, metrics, loading context and execution mode
using the canonical adapter. Match the canonical offered load and effective
load within the existing `sameLoad` tolerance. Require equal full reps and
0 reported reps left on both, with explicit numeric provenance. Treat missing
partials as zero. A higher count wins that tie, a lower count loses the tie,
and equal counts stay even. A loss alone does not produce a drop, recovery
cue or lower target. Missing, bounded, prefilled, unsure, word-only or
failure effort evidence, and any warm-up, cannot earn a partial-rep tie.
Focus shows the positive tie reason only once on successful log. On reload
and correction, recompute the cue and Why from saved/current evidence.

Use a shared pure comparator in the engine. Expose an additive
`partialTie` result from the first-working-set `performanceTrend`
comparison. Keep the existing status and `dropped` semantics. Its current
weekly fatigue consumer continues to read `dropped`. For “stalled” wording,
`app.js` currently uses `isStalled` in block and weekly reports. Subject to
Q6, reuse the comparator on adjacent first working sets in that existing
window and suppress the stalled label when an improving comparable tie is
present. Keep the numeric outcome and goal metrics as they are. Apply the same
adapter policy in any stall-based proposal so the UI and decision agree.
A partial improvement does not replace a numeric “improved” result or make an
otherwise ineligible set comparable. Review saved rationale replay and record
the engine version decision before landing.

Both live and history progression adapters must reject warm-ups before
building ordinary evidence. Currently `enginePerformedRow` rejects
`origin: "ramp"` but otherwise passes `warmup` through, and
`parseSession` can accept a flagged warm-up with numeric effort. Cover this
at the engine input as well so direct engine callers cannot feed warm-ups
into capacity or fatigue. Prove target equality for the same working inputs
with and without attached partial counts or inserted warm-ups. Add negative
cases for differing loads, work indices, movements, metrics, setup and effort.

## 5. Focus and readback

**Prelude.** On the active `#workout .exercise.is-current`, keep the
`.fcard__context` scroller, `.fx-head`, `.fx-slot` and `.fx-cue.is-now`.
Render the warm-up in `focusSlotHtml` through the existing hero structure.
Use `.fx-cue__l1` and `.fx-cue__load` for “Warm up 60 kg”,
`.fx-cue__l2` for reps and plate hint, and `.fx-cue__standing` beside
the `.text-link` Skip control. Put Why in `.fx-cue__evidence` with
`.focus-ex__why.fx-cue__why`. Add the prototype rail as a noninteractive
ordered list between the rep hint and standing line. Its dots distinguish
done/current/upcoming, with a square work endpoint and text equivalents.
Mark the current step with `aria-current="step"`. Use actual logged loads
for completed steps and planned loads for upcoming ones. At large type let
the rail labels wrap without overlapping. Keep the same phone layout and
type hierarchy as the approved reference.

Use `.focus-shelf.workshelf`, `.shelf__fields`, `.shelf__field`,
`.shelf__fieldbtn`, `.shelf__lab`, `.shelf__valrow`, `.shelf__val`,
`.shelf__unit`, `.shelf__pads` and the existing
`.btn.btn--cta.btn--noarrow.saveset`. The two fields use the production
stepper, wheel and keyboard paths. The CTA records actual inputs and only
advances after acknowledgement. “Done · set 1 next” hands off to the
original working-set fields and position. Reuse the rest clock, contour,
pause/adjust/stop, restore and bell. Warm-up logging uses the warm-up
rest policy in Q4. Skip and correction do not restart a timer. No test-set
prompt or carry from a warm-up into a working set. Pass read-only intent to
Preview and adjacent cards. Browsing, reordering and opening Why alone
leave draft state unchanged.

After preparation, keep `.fcard__ledger`, `.ledger__rows`,
`.ledgerline`, `.ledgerline__idx` and `.ledgerline__vals`. Render the
single quiet W row above work, with actual loads in order and “excluded
from totals”. Reuse the existing row activation/edit path to open a
warm-up list for correction or removal. Exercise actions offers Add,
Remove and Review for this plan, with existing switches for programmed
sets. Show the prototype's quiet “No warm-ups suggested” and “Add one”
row when suggestions are suppressed. Give the suppressed state access
to the same Why and reset. A skip after a logged step still yields the W
row for actual work. W and dots are decorative when the readable label
carries the meaning.

**Past zero.** Extend `focusPadsHtml` and the numeric
`.shelf__pads--chips.shelf__pads--numbers` group. Tapping the ordinary 0
commits explicit zero, then reveals `0, +1, +2, +3, +4, +5` in the
same `.shelf__chip--num` controls. Keep word effort and its existing
menu. Reach 0 through the current Reps left mode; Max gets no implicit
numeric conversion. Each plus chip writes one count and exposes
`aria-pressed`. The second page's 0 clears partials and returns to
Reps left; it leaves explicit zero selected. Put a caption in the
accessible group name and give each option its spoken count. Keep the
same three working fields. The effort tile shows `0+2`, the log CTA
shows “Log set 1 · 6+2”, and current and prior ledger rows show `6+2`.
Keep `+2` smaller and use the accent text token. Match the prototype's
second tap on the selected effort tile to return to or reopen either
page at explicit zero, preserving the count. The page index is
presentation state and follows the current set. Reopen a saved positive
entry directly on its partial chips when its effort field is selected.
After replacing the chip group, move focus to the selected option,
or 0 if there is none. Tapping log with zero and no partial selection
remains a single action.

**Why, motion and access.** Use `#whySheet`, `#whyScrim`, `#whyClose`,
`#whyTitle`, `#whyTarget`, `#whyDecision`, `#whyBody` and `#whyEvidence`.
Keep `.whysheet__block`, `.whysheet__lead`, `.whysheet__text` and
`.whysheet__disc` for the reset action, with current detents, Escape,
Back, focus containment and return. Show real evidence counts and dates.
Reuse the existing toast and polite status channel for successful commits.
Restore focus to the equivalent shelf control after log or skip, to
the W row on correction return, and to the invoking control or cue on
Why dismissal. Check thumb reach, touch target sizes and keyboard
operation. Preserve the deck's gesture claim and vertical scroll; no
new swipe is required. Maintain shelf clearance with safe areas and
the keyboard-open viewport at text200 and 320 px.

Follow the [interaction runtime audit](../docs/design/interaction-runtime-audit.md).
Use the existing CSS value and row feedback and sheet motion. For the
approved 240 ms Past zero entrance, translate and fade the entering
chips in place, with no layout animation or movement of the shelf.
Interrupt by replacing the group and let taps work from the first frame.
Use the existing reduced-motion path for an immediate chip swap and the
existing reduced-motion sheet fade. Do not recreate prototype timers,
SVG light, or global handlers. Add the chip beat to the audit. Resolve
light/dark through semantic tokens and verify actual contrast of the
small suffix and rail labels in both themes.

**Readback.** Carry the separate count through `readLogRow`,
`history-ui.js` and History edit, the Progress evidence projections in
`progress-model.js`, previous-set text, Today comparable-set summaries,
session finish, history share and `share-cards.js`. Use one count
formatting convention for visual, spoken and plain text. Include
partials wherever an actual set's reps are shown. Numeric totals, chart
coordinates, PRs and prescribed targets stay full-rep values. When a
surface shows a best set, preserve its ordering rule and annotate the
selected set. Where otherwise-equal eligible sets already compete to
supply one displayed best set, use the same comparator only to choose
the displayed row. Detailed History shows actual warm-up rows as
preparation. Today, finish, charts, strength evidence, badges, calibration
and volume keep their working-only totals. Audit any fallback that uses
`rows.length` or raw load × reps. Retain text and JSON distinction after
History correction, copy/share, backup and transfer.

## 6. Implementation slices and proof

The partials slice and pure warm-up slice can start from the same agreed
implementation base in separate worktrees. The pure slice touches only
its new module, test and suite registration. The partials slice uses
existing suites and leaves shared registration to the other slice.
Land the Prelude integration on both. Only the integration slice
registers the warm-up script in the app shell. Implementation begins
after owner approval of the relevant choices and backlog scheduling.

| Slice | Files and boundary | First failing proof and acceptance | Fidelity gate |
| --- | --- | --- | --- |
| 1. Past zero end to end | `workout-draft.js`, `app.js`, `progression-engine.js`, `history-ui.js`, `progress-model.js`, `share-cards.js`, `install-transfer-contract.js`, styles, translations, affected catalog and release files | In `test/workout-finish-boundary.mjs`, start from the prior 105 × 6+2, choose numeric 0 and +3, reload, log once, finish and open History. Verify 6+3, unchanged full-rep totals and no load promotion from the tie. Add malformed, stale and mode/effort-clearing cases in `test/workout-draft.mjs`, CAS and old-worker coverage in `test/workout-draft-storage.mjs` and `test/workout-draft-sw-upgrade.mjs`. `test/progression-engine-plan067.mjs` covers tie win/loss/even and invariance of numerical outputs. Exercise actual correction, transfer, JSON/CSV export/import and share through the existing owners below. | Side by side with Past zero in the tie fixture. Compare numeric-zero, chips selected, working ledger and Why. Use the nearest approved work/history/finish references for unprototyped readback and mark those frames. |
| 2. Pure warm-up policy | New `warmup-suggestions.js`, `test/warmup-suggestions.mjs` and `test/suites.mjs` registration | Red-first deterministic module-interface tests. Baseline 20/60/85 from the real inputs, available-load boundaries and rounding ties, bar and no-bar cases, kg/lb equivalence, dumbbell ladder, too-light/bodyweight/assistance, learned load scaling, two matching sequences with additions/removals, context isolation, expiry, three skips, reset, duplicates and stale/reordered input. Prove deterministic reason and evidence fields. | There is no rendered production change in this slice. Check fixture values and reason states against the four approved `RAMPS` states. Capture their full visual matrix in slice 3. |
| 3. Prelude end to end | `workout-draft.js`, `app.js`, `durable-state.js` if state validation/reconciliation needs it, transfer validator, progression and readback owners, `index.html`, `sw.js`, styles, i18n, catalog and release files | First real journey in `test/workout-finish-boundary.mjs`: edit 60 × 5, log, reload between steps, log remaining warm-ups and finish with three working sets. Assert saved actual rows, W summary, untouched slot indices, and learned evidence exactly once. `test/workout-draft-storage.mjs` and `test/adversarial-draft-transactions.mjs` cover stale tabs, reset/finish race, recovery and retry. Then prove learned, already-warm, suppressed/manual return, discard, skip remainder, correction, substitute/restore and calibration precedence. Verify warm-ups do not affect any numeric or completion consumer. | Side by side with Prelude baseline, edited/intermediate rest, W summary, learned, already warm, suppressed, warm-up Why and reset. Compare production's combined Past zero tie after Prelude as the final gate. |

**Owning suites and catalog.** Resolve IDs against [test/suites.mjs](../test/suites.mjs)
and use the live [CI guidance](../docs/ci.md). Use
`test/workout-draft-migration.mjs` for legacy input,
`test/focus-exercise-actions.mjs` for switches and preparation actions,
`test/focus-navigation.mjs` and `test/focus-geometry.mjs` for interaction
and clearance, and `test/motion-integration.mjs` / `test/rest-timer.mjs`
for motion and timer behavior. `test/progress-lifecycle.mjs` owns the weekly
stall and unchanged fatigue consumers. `test/history-edit.mjs`,
`test/session-summary.mjs` and `test/per-side-reading-browser.mjs` own
readback and per-side regressions. `test/program-transition-backup.mjs`
owns the backup path, `test/install-transfer-import.mjs` the real clone
import and eligibility path, `test/install-transfer-service.mjs` service
validation, and `test/shared-setup-unit.mjs` setup payload invariance.
`test/telemetry-unit.mjs` and `test/telemetry-leakage.mjs` protect the closed
schema and network boundary. Use a focused production browser journey for
each durable first proof, then extend the existing owning assertions.
Follow the [implementation evidence protocol](../docs/agents/implementation-evidence.md)
with the failing case, assertion location, exact head, and recorded rerun.
Use at most only the single owning local suite while correcting on the shared devbox and
send broader work to CI.

Add catalog states through `tools/ui-screens/screens-app.mjs` and
`fixtures.mjs`, backed by normal production routes and known fixtures in
`docs/ui-screens/manifest.json`. Register new semantic roles in
`tools/ui-role-inventory.json`. Include baseline Prelude, intermediate
warm-up/rest, W summary, learned/short/suppressed reasons and Why,
Past zero active chips, working partials/tie Why, and representative
History, Progress and finish readback. Use reusable variants where the
state changes only the data. Refresh affected neighbor states in Today,
Focus, History and Progress. Captures use `tools/capture-ui-screens.mjs`
with the worktree preview. Review and commit the generated PNGs. Follow
the [fidelity gate](../.claude/skills/taurifer-fidelity-gate/SKILL.md):
390 × 844 and 320 × 568, light and dark, normal and text200, EN and PT,
top and scrolled as applicable. Save actual prototype/production pairs
at rest in the PR fidelity folder. Document prototype gaps and seek
owner approval for any visible deviation, including accessible wrapping
or copy changes. List the real device logging, timer and assistive-tech
checks for the owner. Browser evidence does not substitute for the
physical device pass.

**Release.** Regenerate `i18n.js` with `node tools/build-i18n.mjs` and
verify its source parity. Recheck the cache revision at implementation
time (base is `repforge-v770`). In every runtime slice bump the cache and
allocate live asset revisions per hard rule 5. Align changed
query-versioned URLs in `index.html` and `sw.js` `ASSETS`. Include
`warmup-suggestions.js` in load order before `app.js`, in `ASSETS`, and
in the protected `transitionAssets` list in `test/exercise-library.mjs`
when slice 3 ships it. If the pure slice precaches the module, it must
also follow the release procedure, so leave it unreferenced until
integration. Verify cache and asset revisions with `test/exercise-library.mjs`
and `test/asset-revisions.mjs`. Prove offline reload and upgrade on the
same versioned script set. Draft and validator changes in slices 1 and 3
require the exact-head Worker redeploy and probes per hard rule 18 and the
[runbook](../services/install-transfer/RUNBOOK.md) before merge. Require
green `ci` and `ci-full` on that head, independent review, and owner
fidelity and bilingual copy review before the coordinator merges.

## 7. Owner questions and recommended defaults

| ID | Decision | Recommended default |
| --- | --- | --- |
| Q1 | Who shares warm-up preferences, and when do we offer them? | Share by comparable performed lift and equipment/metric/loading identity. Offer for known, ordinary, external-load work with a lighter valid load. Manual warm-ups for representable bodyweight and assisted sets. Existing preparation and Find your weight take precedence. |
| Q2 | What baseline and load assumptions should ship? | Barbell 20 kg × 8 plus 57% × 5 and 80% × 2 to reproduce 20/60/85 on the default grid. Omit the empty-bar step for dumbbells and external-load machines. Use the configured grid or dumbbell ladder, round nearest with ties down, keep only increasing loads below work. No minimum percentage gap beyond one attainable lighter load. Show plate arithmetic only for the supported 20 kg bar and the plate pairs in section 3. Unknown, Smith or nonstandard bars get no empty-bar/plate hint unless supported by known configuration. |
| Q3 | How fast should the feature learn or forget? | Two agreeing completed sequences; retain the last six eligible observations within 90 days and allow at most six warm-ups per exercise occurrence. Use two matching one-step observations for shortening within 15 minutes of the prior lift. Keep the approved three consecutive skips suppressed until a saved warm-up or reset, even after the learning window expires. A whole-preparation skip is an eligible skip only when work also saves. |
| Q4 | Which timer does “Done” start? | Use 60 seconds on warm-up completion when rest is enabled, including the handoff to set 1. Use the already configured working rest for work. Keep the user's current rest enablement and clock controls. |
| Q5 | Which sets can record Past zero? | 0 through 5 after explicit numeric zero on ordinary working sets with at least one full rep. No partials on per-side rep counts, warm-ups or measured calibration trials in this release. The approved 0–5 chip design governs the count. |
| Q6 | What does winning a partial tie change? | Show positive tie evidence and suppress otherwise-stalled wording/proposals in the existing three-session window when adjacent eligible first sets show an improving tie. Leave load/reps, numeric trend thresholds, recovery, e1RM and PRs frozen. Keep the estimator/formula version when its numeric outputs and replay contract stay identical. If owner approval extends the solver or versioned rationale schema, specify that contract and version change first. |
| Q7 | Approve the copy and placement? | Use section 8, replacing prototype “ramp” with “warm-up” so calibration retains “Find your weight”. Put the plan at the end of After alpha (Next) to preserve the current alpha gate order. |

## 8. Candidate EN and PT strings

Use existing labels for Load, Reps, Reps left, Why?, Set, Save, Cancel,
Close, and the normal rest controls. The table lists proposed new copy
including accessible names. Split singular/plural through existing
i18n conventions and localize units, names, numbers and dates. Braces
denote interpolated values. Both languages receive the same facts.

| Use | English | Português (Brasil) |
| --- | --- | --- |
| Warm-up cue | Warm up {load} {unit} | Aqueça com {load} {unit} |
| Reps without plates | {n} rep / {n} reps | {n} repetição / {n} repetições |
| Plate hint | Empty bar / {plates} per side | Barra vazia / {plates} de cada lado |
| Rep and plate line | {reps} · {plates} | {reps} · {plates} |
| Rail name | Warm-up steps | Etapas do aquecimento |
| Rail completed step | {load} {unit}, done | {load} {unit}, concluído |
| Rail upcoming step | {load} {unit}, upcoming | {load} {unit}, a seguir |
| Rail work marker | Working load, {load} {unit} | Carga de trabalho, {load} {unit} |
| Standing | Warm-up {step} of {total}, then {load} {unit} | Aquecimento {step} de {total}, depois {load} {unit} |
| Skip link | Skip warm-ups | Pular aquecimento |
| Warm-up CTA | Done · {load} {unit} next / Done · set 1 next | Feito · agora {load} {unit} / Feito · agora série 1 |
| Warm-up rest | Warm-up rest | Descanso do aquecimento |
| Ledger marker and row | W · {loads} {unit} · excluded from totals | A · {loads} {unit} · fora dos totais |
| Spoken warm-up row | Warm-ups, {loads} {unit}, excluded from totals | Aquecimentos, {loads} {unit}, fora dos totais |
| Manage preparation | Review warm-ups / Add warm-up / Remove warm-up / Edit warm-up | Ver aquecimentos / Adicionar aquecimento / Remover aquecimento / Editar aquecimento |
| No suggestion | No warm-ups suggested / Add one | Sem aquecimento sugerido / Adicionar um |
| Baseline cue | A starting warm-up for {load} {unit}. Log what you actually do. | Um aquecimento inicial para {load} {unit}. Registre o que você fizer. |
| Learned cue | Your warm-up from recent {lift} sessions, adjusted to {load} {unit}. | Seu aquecimento das últimas sessões de {lift}, ajustado para {load} {unit}. |
| Already-warm cue | You just trained {muscle} with {lift}. One feeler set. | Você acabou de treinar {muscle} com {lift}. Uma série para sentir a carga. |
| Suppressed cue | You skipped warm-ups the last three times, so none are suggested. | Você pulou o aquecimento nas últimas três vezes. Por isso, não há sugestões. |
| Why heading | Why this warm-up | Por que este aquecimento |
| Why sequence | {sets}, then {load} {unit} / No warm-ups, then {load} {unit} | {sets}, depois {load} {unit} / Sem aquecimento, depois {load} {unit} |
| Why decision | First time / Learned from your sets / Already warm / Usually skips | Primeira vez / Aprendido com suas séries / Já aqueceu / Costuma pular |
| Why source heading | Where it comes from | De onde vem |
| Why baseline source | This is a short starting warm-up. Today's lighter loads are rounded to the steps for this exercise. | Este é um aquecimento inicial curto. As cargas mais leves de hoje seguem os incrementos deste exercício. |
| Why learned source | You prepared the same way in recent sessions. Today that comes to {sets}. | Você se aqueceu do mesmo jeito em sessões recentes. Para hoje, fica {sets}. |
| Why warm source | You trained {muscle} {minutes} minutes ago. In past sessions with {lift} first, you warmed up with one set. | Você treinou {muscle} há {minutes} minutos. Em sessões anteriores com {lift} primeiro, você fez uma série de aquecimento. |
| Why suppressed source | You skipped warm-ups in your last three sessions for this lift. Log one to resume suggestions. | Você pulou o aquecimento nas últimas três sessões deste exercício. Registre um para voltar a receber sugestões. |
| Why learning | How it learns. Log the same change twice to make it your usual warm-up. Skip three sessions in a row to pause suggestions. | Como aprende. Registre a mesma mudança duas vezes para adotá-la como seu aquecimento habitual. Pule três sessões seguidas para pausar as sugestões. |
| Why exclusions | What counts. Only working sets count toward volume, records and your next weight. | O que conta. Só as séries de trabalho contam para o volume, os recordes e a próxima carga. |
| Why evidence | Based on {n} sessions, {dates} / Based on {n} sessions with {lift} first | Com base em {n} sessões, {dates} / Com base em {n} sessões com {lift} primeiro |
| Reset | Forget my warm-up for {lift} | Esquecer meu aquecimento para {lift} |
| Reset toast | Warm-up preference cleared. | Preferência de aquecimento apagada. |
| Edited-step toast | Noted. Log {load} × {reps} once more to teach Taurifer your warm-up. | Anotado. Registre {load} × {reps} mais uma vez para o Taurifer aprender seu aquecimento. |
| Edited-sequence toast | Noted. Log this warm-up once more to make it yours. | Anotado. Registre este aquecimento mais uma vez para adotá-lo como seu. |
| Skip toast | Skipped. Skip three sessions in a row to pause suggestions. | Aquecimento pulado. Pule três sessões seguidas para pausar as sugestões. |
| Handoff toast | Warmed up. Set 1 is next. | Aquecimento concluído. Agora vem a série 1. |
| Add toast | Warm-up added. Log it when you're done. | Aquecimento adicionado. Registre quando terminar. |
| Partial chip group | Partial reps after 0 reps left | Repetições parciais após 0 repetições restantes |
| Chip spoken values | Zero partial reps, back to Reps left / {n} partial rep / {n} partial reps | Zero parciais, voltar a Repetições restantes / {n} repetição parcial / {n} repetições parciais |
| Spoken combined value | {full} full reps and {partial} partial reps | {full} repetições completas e {partial} parciais |
| Partial CTA / effort value | Log set {n} · {full}+{partial} / 0+{partial} | Registrar série {n} · {full}+{partial} / 0+{partial} |
| Tie toast | +{n} partial since last time. Tie broken. / +{n} partials since last time. Tie broken. | +{n} parcial desde a última vez. Empate desfeito. / +{n} parciais desde a última vez. Empate desfeito. |
| Tie before logging | Last time, set {n} was {set} with 0 left. One more full rep moves you toward more load. More partials break the tie. | Na última vez, a série {n} foi {set}, com 0 restantes. Mais uma repetição completa aproxima você de uma carga maior. Mais parciais desempatam. |
| Tie after logging | Set {n} was {set}, with {more} more than last time. That breaks the tie. Full reps guide the next weight. | A série {n} foi {set}, com {more} a mais que da última vez. Isso desfaz o empate. As repetições completas guiam a próxima carga. |
| Partial without a tie | Set {n} was {set}. Your partials are saved. Full reps guide the next weight. | A série {n} foi {set}. Suas parciais foram registradas. As repetições completas guiam a próxima carga. |
| Tie Why target | Aim for {reps} full reps at {load} {unit}. | Tente fazer {reps} repetições completas com {load} {unit}. |
| Why tie rule | How partials count. More partials break a tie at the same load, full reps and 0 reps left. Full reps guide the next weight. | Como as parciais contam. Mais parciais desempatam quando a carga e as repetições completas são iguais e restam 0 repetições. As repetições completas guiam a próxima carga. |

## Verification status

Plan and backlog only. Implementation proofs, screenshots, device
checks, exact-head Worker redeploys and copy review are pending in the
corresponding implementation slices. Next step is owner review of
sections 7 and 8 before implementation.
