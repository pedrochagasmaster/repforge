# Plan 080: the estimator, standing words and uncertainty-driven test sets

Status: **approved in substance by owner decision D-4 (2026-11-08)**: "the engine becomes an estimator with
uncertainty-driven test sets, keeping OD-12's safety rules as ceilings, as `ENGINE_VERSION` 078.x with its own
plan". The thresholds and words marked *proposed* are defaults for the PR; copy is reviewed in each PR (#315).
Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §3.3 and §10 (D-4); Plan 077's amendments block (OD-12).
Step 4 of the note's §11; it follows Plan 078 (the ladder) and Plan 079 (session zero) and precedes Plan 081
(the profile, which shows the standing per lift).
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: any change to how a load is selected (the Plan 067 candidate search and the Plan 077 bounded
shift stand), new Settings (ADR 0003 forbids them), the gauge's dissolution (Plan 081), the weekly review
(Plan 082), Pro.

## 1. Problem

The engine is a formula over an anchor: the median first-set capacity of the last three comparable sessions,
a fatigue drop, a candidate search over the available loads (`progression-engine.js:410–427`, `373–396`,
`466–496`). It says nothing about how much it knows. A target computed from one session two months ago at a
different machine reads exactly like one built on twelve recent, consistent sets, and the Why reader explains
the arithmetic but never the footing.

Test sets, the one instrument that measures the lifter's reports, run on a calendar: whenever the frequency
ceilings allow (`effort-calibration.js:71–86`, `frequencyAllows`: one per workout, 14 days per key, two per
ISO week, monthly once the gauge reads 100 %), the prompt appears. A lift the engine already knows well is
tested as often as one it has never understood. Plan 077 OD-12 also asked that no test follow pain or
discomfort on that exercise today, and `maxSetOffer` (`app.js:7729–7750`) has no such gate: pain exists only
as a swap reason sent to telemetry (`app.js:3113–3125`, `16190`) and as an abandon reason.

## 2. Owner decision (2026-11-08)

**D-4.** Each lift carries a capacity estimate plus an uncertainty from row count, set-to-set agreement and
this lifter's test-set reliability. Targets state their standing in words. Test sets are requested when the
engine is unsure, with OD-12's safety rules kept as ceilings instead of the fourteen-day schedule.
`ENGINE_VERSION` 078.x, its own plan.

## 3. What changes, and what does not

### 3.1 The estimate does not move

The selected load and reps are the Plan 067 selection with the Plan 077 bounded shift, unchanged. The
estimator adds a **standing** beside the target, never a different target. `FORMULA_VERSION`
(`rir-adjusted-epley@067.1`) and `CALIBRATION_VERSION` (`calibration@077.1`) are unchanged. `ENGINE_VERSION`
becomes `078.1` because the result object gains a field and the test-set request reads it.

### 3.2 Standing: three words and their evidence. Proposed.

The engine computes, per prescription, from the comparable rows it already parses (`parsePerformedSet`,
`:307–353`) plus two inputs app.js already has:

| Input | Where it comes from |
| --- | --- |
| `sets`, `sessions` | Comparable, countable rows (`rir` finite; `effortSource` not `prefilled`/`unsure`; warm-ups excluded), weighted by the gauge's row quality (1 for `rir`/`reps_left`, ½ for words, `reps_left_3plus`, `reps_left_5plus` and unknown) and its 90-day half-life. The engine's history rows must carry `effortSource` and `date`; `progressionHistoryFor` (`app.js:6372`) passes them. |
| `pairs`, `agreement` | The gauge's A rule applied to this key alone: consecutive countable sets in one session, capacity ratio in [0.85, 1.03] (`calibration-gauge.js:89–102`). Identical pairs skipped. |
| `gapDays` | Days from the last comparable session to today. |
| `checks`, `spread`, `state` | From `liftCalibration` (`app.js:6367–6371`), passed in `settings.calibration` beside `delta`, which already travels that way (`progression-engine.js:130–134`). |

| Word | Key | Rule |
| --- | --- | --- |
| **First time** | `first` | No history anchor: the result is `new`, `manual` with `no_comparable_history`, or `configuration_required`. The copy says "first time on this lift"; with a live anchor but no history, "first time at this load". |
| **Still learning this lift** | `learning` | An anchor exists and any of: weighted `sets` < 6 or `sessions` < 2; `pairs` ≥ 4 and `agreement` < 0.6; `state` is `uncalibrated` with reason `inconsistent`; `gapDays` ≥ 42 (OD-16's break, reason `break`). |
| **Solid** | `solid` | Everything else. |

The thresholds are the gauge's and Plan 077's where one exists (0.85–1.03, 42 days, the row weights). The
two new ones, six weighted sets over two sessions and 0.6 agreement over four pairs, are proposed and pinned
in the fixture (§7).

The result gains `standing: {version:"standing@078.1", word, reasons:[…], evidence:{sets, sessions, pairs,
agreement, gapDays, checks, spread, state}}`. Reason codes: `no_history`, `live_only`, `few_sets`,
`few_sessions`, `disagreement`, `inconsistent_checks`, `break`. The Why reader prints the evidence; the target
prints the word. Nothing else in the result changes, so the Plan 067 cases that assert loads and reps keep
passing.

### 3.3 Where the word appears. Proposed.

- **Focus target card** (`focusCue`, `app.js:9392–9437`; `focusCueBlockHtml`, `:9523`): one quiet line under
  the target for `first` and `learning`; nothing for `solid`. The card never prints a number for it.
- **Why sheet** (`engineWhyModel`, `:24455–24473`): a new block `engine-standing`, lead "Footing", one line
  per reason with its evidence in plain words ("4 sets over 2 sessions", "sets disagree more than usual",
  "a break of 7 weeks"). It sits before `engine-calibration`.
- **Exercise page** rec block (`:13314–13332`): the same quiet line.
- **Today** target column: no change; Today is a list, and the word belongs with the reason.
- Plan 081 shows the standing per lift in the profile from the same field.

Never a percentage, never a colour scale, never "confidence". The words are catalog strings in both languages
with `{curly}` placeholders for the evidence; PT is reviewed first.

### 3.4 The test-set request. Proposed.

`maxSetOffer` keeps every safety gate it has (`app.js:7731–7748`: prompts on, an active session, two working
sets, the last working set, not after a 0-RIR set, not in a lighter week, eligible, a valid prefill) and
`frequencyAllows` keeps `per_workout`, `per_exercise` 14 days and `per_week` 2 **as ceilings**. Two things
change:

1. **The reason to offer.** An eligible opportunity is taken only when the key's standing is `learning`, or
   its calibration `state` is `uncalibrated` with fewer than 3 checks, or `inconsistent`. A `solid` key
   whose calibration is `calibrated`, `over` or `under` is re-checked at most once every **60 days**, so a
   drift in the lifter's judgement is still caught. The `monthly` rule tied to the gauge reading 100 %
   (`effort-calibration.js:72–74`) goes with the gauge; the 60-day re-check replaces it and does not depend on
   a global number.
2. **The pain gate (OD-12).** A swap or skip with reason `pain` on an exercise today blocks the offer for that
   exercise today. The reason is kept in session memory on the live workout (no draft or row change); Plan 082
   decides whether pain is persisted per exercise per session for the weekly review.

When two eligible lifts in one workout both qualify, the one with the lower weighted `sets` is offered (one
per workout). The prompt's copy (`maxset.invite_body`) gains one clause saying why: "The app is still
learning this lift" or "It has been a while since the last check".

### 3.5 Priorities for a lift with no history

`first` is where Plan 079's declared priors speak: a first suggestion from the lifter's bodyweight and
experience, or from a related lift's ratio, is an engine input the way `suggestedLoad` is today, never a
history row. The standing stays `first` until the lift has its own sets. Plan 079 owns the table; this plan
only reserves the reason code `prior` in the Why block for it.

## 4. Changes by owner module

| Owner | Change |
| --- | --- |
| `progression-engine.js` | `ENGINE_VERSION "078.1"`; `STANDING_VERSION`; `standing` on every result; `settings.calibration` accepts `n`, `spread`, `state` beside `delta`; the row parser reads `effortSource` and `date` for weighting (selection unchanged) |
| `calibration-gauge.js` | Export `rowQuality`, `decay` and the pair rule so the engine and the gauge share one definition; no behaviour change |
| `effort-calibration.js` | `frequencyAllows` drops `monthly`, gains `recheckDays: 60` for solid calibrated keys; `LIMITS` unchanged otherwise; a `shouldOffer({standing, calibration, lastCheckDays})` helper |
| `app.js` | `progressionHistoryFor` passes `effortSource` and `date`; `recommendation()` carries `standing`; the target card line; the Why block; `maxSetOffer` reads `shouldOffer` and the session pain memory; the swap/skip handlers record the pain reason in session memory |
| `i18n-en.json`, `i18n-pt.json` | `standing.first`, `standing.first_load`, `standing.learning`, `why.lead.standing`, `why.standing.*` per reason, the invite clause; regenerate `i18n.js` |
| `index.html`, `sw.js` | Script revisions for the four scripts; cache revision from live `main` at merge |
| `docs/progressive-overload-mechanics.md` | §4 "What the app learns about you" is rewritten: it still describes the legacy range engine (`:188–205`) and is stale against Plan 067. New §4: the anchor, the fatigue drop, the standing and what each word rests on, when a test set is asked for |
| `docs/progression-strategy-contract.md`, ADR 0003 | No change; Plan 077 A3/A4 drift stays recorded there |

No Worker redeploy: `workout-draft.js` and the transfer contract do not change. No new settings.

## 5. Draft and data safety

- No row, draft or settings key changes. `standing` is derived at read time and never stored.
- Rows without `effortSource` weigh ½, as the gauge already treats them; rows without `date` weigh 0 in the
  standing and still count for selection (selection ignores weights).
- The 60-day re-check reads the key's last check date from `state.log`, which the gauge already computes.

## 6. Worked examples (for the fixture)

1. **New lift, no rows.** `first`, reason `no_history`. The target is `manual`; the card says "first time on
   this lift".
2. **One session of three typed sets, 10 days ago.** `learning`, reasons `few_sets` (3 < 6), `few_sessions`
   (1 < 2). The test-set prompt is offered at the next eligible opportunity.
3. **Four sessions, twelve sets, pairs agree, no test sets.** `solid` for the target; calibration
   `uncalibrated/few` with 0 checks, so the prompt is still offered (fewer than 3 checks).
4. **Same lift after three on-target test sets.** `solid`, `calibrated`; the prompt is next offered 60 days
   after the third check.
5. **Twelve sets whose consecutive pairs agree 4 times in 9.** `learning`, reason `disagreement`
   (0.44 < 0.6). Offered.
6. **A solid lift, last trained 50 days ago.** `learning`, reason `break`; the anchor still drives the target;
   the Why block says "after a break of 7 weeks". Offered.

## 7. Tests (each red before its change)

- `test/progression-engine-plan067.mjs`: `ENGINE_VERSION` becomes `078.1` (`:11`); every existing load/reps
  assertion unchanged; new cases pin the six examples' `standing` objects.
- New `test/engine-standing.mjs` (Node, pure): the weights, the pair rule shared with the gauge, the
  thresholds, the reason codes, rows without `effortSource` or `date`.
- `test/effort-calibration.mjs`: `shouldOffer` truth table; `monthly` gone; `recheckDays`. Its pinned
  excluded-set count reads 113 against the plan's 111 (`:42–47`); record the discrepancy in the PR, do not
  change the fixture here.
- `test/max-set-browser.mjs`: the prompt appears for a learning lift and not for a solid calibrated one inside
  60 days; the pain reason blocks it today; the per-workout, per-key and per-week ceilings still hold; the
  spy on `recommendSets` settings (`:229`) sees `n`, `spread`, `state`.
- `test/why-sheet.mjs`: the `engine-standing` block, its lead and one line per reason, EN and PT.
- `test/landing-variants.mjs` pins landing copy to `recommendSets` output (`:120–174`); loads and reps are
  unchanged, so it stays green; the proof shows no standing word.
- `test/i18n.mjs`, `test/exercise-library.mjs`, the production syntax check.

## 8. Catalog states

- `workout/focus`: the learning line under the target (seed a lift with one session).
- `workout/why-this-weight` gains the Footing block; new `workout/why-standing` for a `learning` lift with
  `few_sets` and `break` (the frame's `expectWhyLeads` lists the new lead).
- `workout/max-set-prompt`: the invite with its reason clause.
- `library/exercise-detail-suggested`: the quiet line.
- Frames from CI, committed with the PR.

## 9. PR split

| PR | Content |
| --- | --- |
| 1 | The engine: `standing` on the result, shared quality/pair helpers, the fixture and the Node tests. Nothing visible changes. |
| 2 | The surfaces: the target card line, the Why block, the exercise page, copy in both languages, frames. |
| 3 | The request: `shouldOffer`, the 60-day re-check, the pain memory and gate, the invite clause, the browser test, the mechanics doc §4 rewrite. |

PR 1 before 2 and 3; 2 and 3 are independent of each other.
