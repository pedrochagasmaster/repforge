# Plan 085: Suggested warm-ups and partial reps

Status: **approved, in implementation**. Base
`e844a870a04c6acbd5bfbf78da30573ff4b3535e` on `origin/main`. The owner chose
Prelude and Past zero, and on 2026-11-21 approved the section 7 defaults
(including the Q7 prototype divergences), the section 8 EN/PT copy, and the
engine ignoring warm-up rows as performed evidence. Slice 2 merged as #804;
slice 1 is #805; slice 3 follows. Scheduling lives in the
[backlog](../docs/backlog.md).

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

**Suggested warm-ups.** Store versioned `warmupPrelude` on the DraftV2
exercise. Keep its pending steps and completed actuals there, outside
`exercise.setOrder` and `exercise.sets`. Capture the original policy result,
performed movement and metric/loading snapshot, first working target, reset
generation and earlier-lift context. Each step has a stable draft-only
command ID, a suggested or manual source, and pending input or a completed
actual with a completion time. Validation in `workout-draft.js` and
`install-transfer-contract.js` checks the plan version, bounded steps and
IDs, canonical metric values, status and provenance. Keep the existing
`validateSet` origin allowlist and `validateExercise` programmed-set plus
calibration-ramp coverage. Validate the new member at the exercise level.

Commands are initialize, edit current load/reps, complete current, skip
remaining, add a manual step, correct completed and remove completed.
Allow one manual step at a time and apply the policy step cap. There are
no arbitrary pending-step inserts, deletes or reordering in v1. A swap
in `substituteExercise` retires the old pending sequence and freezes
completed actuals under the movement and loading snapshot they used.
Build a fresh sequence only for eligible replacement work. Restore the
original with the same provenance rules. Keep existing preparation and
Find your weight ahead of Prelude. Exercise actions keeps the programmed
slot switches and offers Add and Review for Prelude. Remove belongs
to the completed warm-up list.

**History projection.** In `toHistoryRows`, emit completed Prelude rows
before ordinary work for that exercise and keep the canonical metric and
performed attribution fields. Use `warmup: true`,
`origin: "suggested-warmup"`, `set: 0`, `setIndex: 0` (schema placeholder),
`warmupOrdinal: 1..6` (unique per session/exercise slot, including across
a swap), and absent effort (`rir: null`). Assign the warm-up ordinal when
first logged and leave gaps after removal. Keep that ordinal across
corrections. Order suggested rows by it wherever existing history and
share sorts use only `row.set`. `history-ui.js` uses
`warmupOrdinal` for W1–W6 in the reader and editor, including localized
spoken names. CSV uses the same W label in the set column for these
rows while retaining `is_warmup`. Leave legacy and calibration numbering
alone. Ordinary work keeps its original ordinals and `row.set` of 1..M
for Prelude exercises. No suggested row matches a one-based `row.set`
lookup. Keep `setIndex` and programmed indexing exactly as they were
for work. Add a working-only filter to shared previous-set selectors and
their fallback (`prev.at(-1)`). Verify all 12 match sites from the base:
`app.js` lines 7222, 9316, 10226, 10293, 10385, 10671, 11173, 26621,
26653, 26659, 26782 and 26799. Check `engineSetFacts` / `targetStanding`
(10492–10507), the ledger and Log set labels (10680, 11024), and the
Exercise actions `setOrder.length` count (10023). New warm-ups never
enter those work indices or the hidden programmed inputs.

**Save and learn together.** Add optional `warmupObservations`, a durable
map keyed by saved session ID, with at most one versioned observation per
comparable lift in that session. Choose the first eligible occurrence
with completed work. Store the exercise slot, original working ordinal
and performed identity, ordered warm-up ordinals, captured work load,
bar/plate basis, save timestamp, reset generation, earlier-lift context
and decision. Use natural selectors scoped to the session, slot, origin,
ordinal and performed identity. There are no new persistent row IDs.
The adapter resolves these selectors to exactly one matching row each
and reads canonical actual load/reps from those rows. A whole explicit
skip has no warm-up ordinals. Do not learn from a partial skip with
logged steps, untouched preparation, a discarded draft, a skipped
exercise or a session without matching completed work. Early finish
keeps completed actuals even when learning has no observation.

Write the session entry in `WorkoutSession.finish` alongside history,
`sessionEvents` and `sessionTiming`, using its exact-draft removal and
`reconcileSessionIds`. Replays of an already-saved session keep its
observation and do not add evidence. In `history-ui.js`,
`historySessionFromWorkingCopy` preserves selectors across corrections.
`historyEditCommit` validates the revised references against its
lock-held proposed rows and prunes an invalid observation in the same
commit. Deleting a referenced step or the first working row invalidates
that observation. `deleteSession` includes the map in the session-owned
cleanup now called `withoutSessionTiming`. These rules also cover
the index-based edit/remove controls and retries. Keep payload out of
history rows, which have an 8,000-character transfer cap.

**Reset and state lifecycle.** Store only per-lift reset generation
tokens in optional versioned `warmupPreferences`. Use the state queue,
lock and a captured generation for the exercise. A failed reset leaves
the current suggestion intact. A successful reset lets a clean plan
recompute. Keep actuals and edits in an in-progress plan and let
future suggestions use the new generation. An old draft's finish never
teaches the new generation. No empty records on boot.

| State owner | Required handling |
| --- | --- |
| `app.js isValidStateShape` and `install-transfer-contract.js validateDurableState` | Validate both optional maps, including versions, bounded keys/values and ownership. Reject malformed records; bound the session entries by live log size and validate one observation per lift and at most six step references. Also validate Prelude row shape in `isSafeLogRow` and `validateCanonicalLogRow`. |
| `app.js normalizeLoaded` and `proposalFromImport` | Preserve valid preferences and observations through load and whole-backup replacement. Omit empty maps. Drop stale references through the shared observation resolver; surface structurally invalid data through existing recovery. Whole replacement takes the backup's reset tokens. |
| `app.js mergeImportedLog` | Import observations only for newly added sessions and resolve them against their rows. Keep destination preferences. Imported evidence is eligible only when its generation matches the destination's (absent means initial). Never overwrite local reset decisions or reintroduce an observation for an existing session. |
| `app.js mergeStateValue` | Handle each collection before the generic missing-object fallback. Treat an absent base as an empty map for concurrent first writes. Merge preference entries per lift and observation entries per session as atomic leaves. Preserve different lifts/sessions. Use lock-held reset ordering for the same lift, respecting the latest committed token. Deleting a key or the history must not resurrect older evidence on a rebased retry. Reconcile joined rows against the resulting head. The shared journal replay and commit paths in `durable-state.js` call this same host rebase. |
| `app.js deleteTrainingLog` | Clear both maps in the same commit that clears the log and draft. Test deletion racing a reset or workout save. |
| `app.js installTransferStateMeaningful` | A present nonempty or malformed record in either map protects the destination. Omitted or valid empty maps alone leave a fresh boot eligible. Exercise acceptance after reload and refusal through production import. Transfer the two validated maps along with their source rows. |

Persist through the existing DraftV2 CAS and checkpoint. A pristine
plan is replaceable and browsing/Why opening does not write. Explicit
skip, manual addition, edits and logged actuals receive the existing
user-input protection. On reload or a stale-tab retry, render the
acknowledged plan. Do not replay a rest start or a confirmation toast.

**Compatibility and exports.** Keep DraftV2, history schema and storage
keys. Old rows and drafts load with absent optional fields. Validate bounds,
origin/role pairing, IDs, joins, and partial/effort combinations at the
existing draft, history import and install-transfer validation points.
Malformed new fields use the current release's refusal or recovery path.
The fetched main validators accept unknown members, and older normalization
or draft reconstruction can drop new fields. Cache revisioning alone
does not make downgrade safe. Keep the existing pre-DraftV2 fixture
(`3fbae92f`) for legacy migration. Add a second fixture pinned to a
DraftV2 release immediately before the schema change, with its own
matching shell and worker, to prove forward upgrade, late writes and
checkpoint authority after upgrade. Include a deliberately lossy rollback
attempt with partials, a pristine Prelude and populated durable maps.
Record what the older code actually keeps. Release and rollback targets
must preserve the new fields. Before enabling Prelude, certify a fallback that reads and
round-trips both maps and the draft member. If that fallback does not
exist, use a forward fix for release recovery. Do not promise transparent
downgrade to older bundles.

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

Policy owner: pure `warmup-suggestions.js` from PR #804. Its caller supplies the
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
  repeated. A logged manual step or removal of a completed step changes
  the compared sequence. Keep the
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

### Slice 3 adapter to PR #804

Use the shipped [policy interface](https://github.com/pedrochagasmaster/repforge/pull/804)
from `origin/feat/085-warmup-policy` at
`664c9ca226c8086be6b5d199866fc9aca63a41df`. The Slice 3 adapter owns these
translations into and out of the pure module.

- Call `suggestWarmups` with the performed `liftKey` and `movementId`,
  draft ID as `sessionId`, epoch milliseconds for `now`, the offered
  first work `workLoadKg`, the selected equipment's
  `availableLoadsKg`, `equipmentKind` (barbell, machine or dumbbell),
  `barKg` or null, `loadingConvention`, canonical
  `metricSemantics`, `hasMaterialBodyweight`, and the current
  `resetGeneration`. Where equipment identity is ambiguous, use the
  policy's unavailable path. Keep the load basis used by the set's shelf.
- Supply `primaryMuscle` as one stable catalog muscle key. Read the
  first canonical primary entry in catalog order. When the performed
  snapshot has only its comma-separated `primary` string, split and
  trim it and resolve the first entry through the canonical muscle
  lookup. An unknown key disables the short context. Use the same rule
  on both lifts. Supply only completed ordinary working sets in
  `completedWorkingLifts`, each with its own performed `liftKey`,
  `movementId`, `primaryMuscle`, `sessionId` and epoch
  `completedAt`. Do not use deck order or planned muscles as a proxy.
- Resolve stored `warmupObservations` against live rows before either
  policy call. Translate each natural selector to a deterministic
  call-local string for `workingSetId` or `warmupSetIds` and for
  the ordered actual `steps: [{setId, loadKg, reps}]`.
  Use distinct tagged tuple encodings (working slot and ordinal vs
  warm-up slot and ordinal). These strings exist only at the module
  interface. Reject ambiguous matches. Recover physical load/reps
  from canonical metrics; never use translated display text.
- Drive the cue and Why from `reason`, `suggestions`,
  `manualAllowed` and `evidence` (sessions, earlier lift, skip
  streak or unavailable reason). Persist the captured result only
  when a draft command first needs it. For finish call
  `classifyWarmupFinish` with that result, the final ordered
  `steps` (pending has no `setId`), explicit `skipped`, session
  and working selector, `savedAt`, current generation, resolved
  observations and the available kg grid. Map its returned observation
  back to natural selectors in the session map. Use a dry run of the
  same classification for the “once more” toast only when the complete
  changed sequence and real working evidence are available. Show the
  ordinary handoff toast if that promise cannot yet be supported. A
  pending or partly skipped sequence produces no learned observation.
- For “Add one”, use Q7's proposed default: ask the policy for the
  baseline with no observations. Take its first non-empty-bar
  five-rep step when present (60 × 5 in the prototype fixture),
  else its first available step. If there are no suggestions, seed
  five reps with the lowest reachable lighter load; if none, use
  the existing validated metric-entry defaults and require explicit
  confirmation/edit before logging. For bodyweight use reps only.
  For assistance use the selected machine's current offered
  assistance or an unset load field. Never apply the external-load
  percentage to assistance. Respect `manualAllowed`. Unsupported
  or unknown work can still be logged manually where representable.
  Only a classified observation can resume learning.
- PR #804's `platesPerSideKg` uses a hard-coded metric plate inventory
  even when the display is in pounds. Keep that result for the
  supported metric bar. For lb, do not relabel metric plates or
  round a converted decomposition. A narrow policy follow-up before
  publishing lb plates adds optional plate inventory and bar basis
  to the policy input, captured evidence and resolved observations.
  Pass the adapter's 45 lb bar and paired 45/35/25/10/5/2.5 lb
  inventory as exact canonical kg conversions, with the existing
  offered grid restricted to loads attainable on that inventory.
  The policy uses the captured basis when comparing past observations
  and the current basis when projecting actual suggestions. Validate
  the basis in DraftV2, saved state and transfer. Until that follow-up,
  pass `barKg: null` for lb, omit the empty-bar claim and plate hint,
  and use only the offered lighter load grid. Unknown bars get the
  same treatment. Cover both units and the exact hints in the adapter
  proof. Treat lb equipment inventory as proposed assumptions in Q2.

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
weekly fatigue consumer continues to read `dropped`. For “stalled” wording, keep the existing three-session
`isStalled` baseline based on median load and max full reps. Only suppress
an otherwise-stalled result when the latest comparable pair within that
window wins on the first ordinary working set. An older win, a later-set
win, a latest tie/loss or an ineligible pair leaves it stalled. Use the
canonical `progressionHistoryFor` / `performanceTrend` result for that
pair after matching slot and execution mode. Apply the same predicate
in `buildBlockReview` (4242), `weekReviewFacts` (4289) and
`weeklyPatterns` (4375). Keep their existing numerical and
effort thresholds. The fatigue consumer still reads `dropped`. Review
saved rationale replay and record the engine version decision before
landing.

In `app.js`, `enginePerformedRow` already rejects calibration origin
but passes ordinary `warmup` through to the engine. Reject warm-ups
there and keep the working-only check in `progressionCurrentSession`
(6753). `parsePerformedSet` must reject `warmup` and
`origin: "suggested-warmup"` before transformation. This covers
`parseSession`, `currentSessionAnchor` and standing (366, 440, 726).
`readSavedLift` (796) already filters `warmup` and calibration origin.
Keep it and prove it with the new origin, including a raw warm-up that
otherwise has valid numeric effort. Equal working inputs must give
equal targets with or without partial counts or warm-up rows. Cover
different load, index, movement, metrics, setup and effort.

## 5. Focus and readback

**Prelude.** On the active `#workout .exercise.is-current`, keep the
`.fcard__context` scroller, `.fx-head`, `.fx-slot` and `.fx-cue.is-now`.
Keep `focusSlotHtml` as the wrapper and route the warm-up hero through
`focusCueBlockHtml` (10523).
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
rest policy in Q4. Check `exerciseRestSec` for the actual exercise
before calling `startRest`. Its explicit 60-second argument bypasses
the current preference fallback, so a configured `restSec === 0`
must return before that call. Start only after a newly acknowledged
completion, including the handoff to work. Skip, correction, reload
and replay do not restart a timer. Add an optional `restKind` of
`"warmup"` or `"working"` to the existing model, distinct from its
running/paused `kind`. Carry it through `start`, `view`, hold/resume,
adjust/restart, `snapshot`, validation, restore and cross-tab
adoption. An older `repforge_rest_v1` snapshot with no kind means
working. In `paintRestTab` (7462) use “Warm-up rest” and its spoken
label for running warm-up rest. Keep existing paused/done states
and bell ownership. No test-set
prompt or carry from a warm-up into a working set. Pass read-only intent to
Preview and adjacent cards. Browsing, reordering and opening Why alone
leave draft state unchanged.

After preparation, keep `.fcard__ledger`, `.ledger__rows`,
`.ledgerline`, `.ledgerline__idx` and `.ledgerline__vals`. Render the
single quiet W row above work, with actual loads in order and “not counted”. Keep the summary read-only
as in the prototype. Exercise actions opens the completed warm-up list
for correction/removal and offers Add. Show the prototype's quiet “No warm-ups suggested” and “Add one”
row when suggestions are suppressed. Place “Why?” beside “Add one”
and give it the same Why sheet and reset. A skip after a logged step still yields the W
row for actual work. W and dots are decorative when the readable label
carries the meaning.

**Past zero.** Keep `focusPadsHtml` as the group wrapper. Extend `shelfPadsHtml`
(10953) and the numeric
`.shelf__pads--chips.shelf__pads--numbers` group. Tapping the ordinary 0
commits explicit zero, then reveals `0, +1, +2, +3, +4, +5` in the
same `.shelf__chip--num` controls. Numeric chips currently go
through `pickEffort` (12090–12120), which writes the hidden RIR
input. Route that branch through the acknowledged atomic command
for zero/partials and clearing, with the hidden field reflecting the
committed value. Keep keyboard chip navigation and correction on the
same path. In `focusPrevLine` use the numeric stage for “left”
explicitly. The existing `ending === "left"` branch is unreachable. Keep word effort and its existing
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
and volume keep their working-only totals. Replace the raw counts in
`buildSessionSummary` (12400), the save fallback toast (12657),
`historyShareSummary` (13432), and the History detail header
(`history-ui.js` 665) with working-only counts. Keep detailed
History's warm-up rows. Use working-only counts for both total
and committed sets in `updateSaveMeta` (12414–12415) and completed
sessions in `buildBlockReview` (4231–4232). Exercise actions' 10023
count stays on the programmed `setOrder`. In `exportCsv`
(17347–17348) leave warm-up e1RM and tonnage cells empty before
either fallback runs. Verify finish/share lift groups and the
History exercise count also exclude warm-up-only groups. Retain text and JSON distinction after
History correction, copy/share, backup and transfer.

## 6. Implementation slices and proof

Slices 1 and 2 were assigned in parallel. Slice 1 is in progress and
Slice 2's policy implementation is complete on PR #804. Apply the
precise comparator, stall and store-compatibility notes above to Slice 1.
Base Slice 3 on both and keep its production adapter and integration in
one worktree. Only Slice 3 registers the warm-up script in the app shell.
The optional lb plate follow-up is a narrow change to the policy
interface. The adapter can ship its no-hint lb path independently.

| Slice | Files and boundary | First failing proof and acceptance | Fidelity gate |
| --- | --- | --- | --- |
| 1. Past zero end to end | `workout-draft.js`, `app.js`, `progression-engine.js`, `history-ui.js`, `progress-model.js`, `share-cards.js`, `install-transfer-contract.js`, styles, translations, affected catalog and release files | In `test/workout-finish-boundary.mjs`, start from the prior 105 × 6+2, choose numeric 0 and +3, reload, log once, finish and open History. Verify 6+3, unchanged full-rep totals and no load promotion from the tie. Add malformed, stale and mode/effort-clearing cases in `test/workout-draft.mjs`, CAS and old-worker coverage in `test/workout-draft-storage.mjs` and `test/workout-draft-sw-upgrade.mjs`. `test/progression-engine-plan067.mjs` covers tie win/loss/even and invariance of numerical outputs. Exercise actual correction, transfer, JSON/CSV export/import and share through the existing owners below. | Side by side with Past zero in the tie fixture. Compare numeric-zero, chips selected, working ledger and Why. Use the nearest approved work/history/finish references for unprototyped readback and mark those frames. |
| 2. Pure warm-up policy | New `warmup-suggestions.js`, `test/warmup-suggestions.mjs` and `test/suites.mjs` registration | Red-first deterministic module-interface tests. Baseline 20/60/85 from the real inputs, available-load boundaries and rounding ties, bar and no-bar cases, kg/lb equivalence, dumbbell ladder, too-light/bodyweight/assistance, learned load scaling, two matching sequences with additions/removals, context isolation, expiry, three skips, reset, duplicates and stale/reordered input. Prove deterministic reason and evidence fields. | There is no rendered production change in this slice. Check fixture values and reason states against the four approved `RAMPS` states. Capture their full visual matrix in slice 3. |
| 3. Prelude end to end | `workout-draft.js`, `app.js`, `durable-state.js` if the existing host rebase needs a new hook, `install-transfer-contract.js`, `rest-timer.js`, `history-ui.js`, `progress-model.js`, `share-cards.js`, `progression-engine.js`, `index.html`, `sw.js`, `test/exercise-library.mjs`, styles, i18n and catalog files | First red proof in `test/workout-finish-boundary.mjs`: edit 60 × 5, log, reload, log the remaining warm-ups and finish with work numbered 1, 2, 3. Assert warm-ups never appear in `setOrder`, their projected W labels are distinct, counts and targets agree with working-only input, and the observation commits once. `test/workout-draft-storage.mjs` and `test/adversarial-draft-transactions.mjs` cover concurrent first resets for different lifts, two first sessions, reset/finish and delete/finish races, recovery and retry. `test/rest-timer-model.mjs` covers the warm-up kind across snapshot/restore and legacy records. `test/rest-timer.mjs` covers 60-second rest, zero-rest opt-out, handoff, correction and single bell after reload. Prove imported merge and replacement, transfer eligibility, History edit/delete, learned/short/suppressed, manual return and swap/calibration precedence in their owning suites. | Side by side with Prelude baseline, edited/intermediate rest, W summary, learned, already warm, suppressed, warm-up Why and reset. Compare the combined Past zero tie after Prelude as the final gate. |

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
`tools/ui-role-inventory.json`. Check existing catalog shard times after
adding states. If the suite budget requires it, adjust
`UI_SYSTEM_SHARDS` in `test/suites.mjs` with the observed timings. Include baseline Prelude, intermediate
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
| Q2 | What baseline and load assumptions should ship? | Barbell 20 kg × 8 plus 57% × 5 and 80% × 2 to reproduce 20/60/85 on the default grid. Omit the empty-bar step for dumbbells and external-load machines. Use the configured grid or dumbbell ladder, round nearest with ties down, keep only increasing loads below work. No minimum percentage gap beyond one attainable lighter load. Use the supported 20 kg bar and metric plates in section 3. Omit empty-bar and plate claims for unknown or nonstandard bars and for lb until the optional 45 lb basis and inventory follow-up is approved and proven. |
| Q3 | How fast should the feature learn or forget? | Two agreeing completed sequences; retain the last six eligible observations within 90 days and allow at most six warm-ups per exercise occurrence. Use two matching one-step observations for shortening within 15 minutes of the prior lift. Keep the approved three consecutive skips suppressed until a qualifying saved warm-up or reset, even after the learning window expires. A whole-preparation skip is an eligible skip only when work also saves. |
| Q4 | Which timer does “Done” start? | Use 60 seconds on warm-up completion when the exercise rest is enabled, including the handoff to set 1. An exercise with `restSec === 0` starts no clock. Use the already configured working rest for work. Keep the user's current rest enablement and clock controls. |
| Q5 | Which sets can record Past zero? | 0 through 5 after explicit numeric zero on ordinary working sets with at least one full rep. No partials on per-side rep counts, warm-ups or measured calibration trials in this release. The approved 0–5 chip design governs the count. |
| Q6 | What does winning a partial tie change? | Show positive tie evidence and suppress otherwise-stalled wording/proposals only when the latest comparable pair within the existing three-session window wins on the first ordinary working set. Leave load/reps, numeric trend thresholds, recovery, e1RM and PRs frozen. Keep the estimator/formula version when its numeric outputs and replay contract stay identical. If owner approval extends the solver or versioned rationale schema, specify that contract and version change first. |
| Q7 | Approve copy and prototype differences? | Sign off on each item below and the bilingual strings in section 8. |

### Q7 owner sign-off

- **W summary.** Keep the short prototype “not counted” wording and the
  read-only W row. Put the volume, records and next-weight explanation in
  Why. Approve Review in Exercise actions as the correction/removal door.
- **Suppressed suggestions.** Add “Why?” beside “Add one” in the quiet
  row. Reuse the warm-up Why sheet and place reset there.
- **Plate copy.** Use “empty bar” and “25 a side” as in the prototype.
  Approve omission on unsupported bars and inventories.
- **Partial count.** Use compact “6+2” throughout visual and plain-text
  readback, including the CTA and previous line. Use separate full and
  partial counts in spoken labels and machine-readable exports.
- **Step rail.** Show actual logged loads on completed steps. The
  prototype kept planned loads on the rail after edits. Keep upcoming
  loads planned and the work endpoint unchanged.
- **Add one.** Use the adapter's baseline seed, including the prototype's
  60 × 5 fixture. Replace “Added 60 × 5. It is yours from now on” with
  “Warm-up added. Log it when you're done.” This reflects when learning
  can begin.
- **Learning wording and feedback.** Use “warm-up” wherever the prototype
  says “ramp”, and reserve “Find your weight” for calibration. Use the
  “once more” notice only when the module can classify the complete
  change. Reset keeps sets and edits. The normal timer still controls rest.
- **Narrow layout and access.** Approve rail wrapping and focused control
  placement at 320 px and text200 where the unchanged prototype layout
  would clip. Section 8 proposes EN/PT copy, including the localized
  ledger marker.

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
| Plate hint | empty bar / {plates} a side | barra vazia / {plates} de cada lado |
| Rep and plate line | {reps} · {plates} | {reps} · {plates} |
| Rail name | Warm-up steps | Etapas do aquecimento |
| Rail completed step | {load} {unit}, done | {load} {unit}, concluído |
| Rail upcoming step | {load} {unit}, upcoming | {load} {unit}, a seguir |
| Rail work marker | Working load, {load} {unit} | Carga de trabalho, {load} {unit} |
| Standing | Warm-up {step} of {total}, then {load} {unit} | Aquecimento {step} de {total}, depois {load} {unit} |
| Skip link | Skip warm-ups | Pular aquecimento |
| Warm-up CTA | Done · {load} {unit} next / Done · set 1 next | Feito · agora {load} {unit} / Feito · agora série 1 |
| Warm-up rest and spoken clock | Warm-up rest / Warm-up rest, {time} | Descanso do aquecimento / Descanso do aquecimento, {time} |
| Ledger marker and row | W · {loads} {unit} · not counted | A · {loads} {unit} · não conta |
| Spoken warm-up row | Warm-ups, {loads} {unit}, not counted | Aquecimentos, {loads} {unit}, não conta |
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

This revision is documentation only. The review was checked against the
fetched main SHA above and the policy SHA in section 3. Slice 3's
implementation proofs, screenshots, device checks and Worker redeploy
remain with the implementation PR. Send Q7 and section 8 to the owner
before shipping the affected UI.
