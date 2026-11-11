# Plan 081: the profile and the thirty-day cadence of findings

Status: **approved in substance by owner decisions D-6 and D-8 (2026-11-08)**: the 0–100 calibration gauge
is dissolved into a profile of counts and standing words; the profile is all Free during the alpha, with the
Free/Pro line decided after it. The cadence's rules marked *proposed* are defaults for the PRs; copy is
reviewed in each PR (#315). Docs only.
Source: `docs/coach-layer-strategy-2026-11-08.md` §3.4, §3.5 and §10. Step 5 of its §11; follows Plan 080
(the standing words it shows) and Plan 079 (the opening-load record it reads).
Written against `main` 0fbae7b; check for drift before executing.

Out of scope: any Free/Pro split (D-8: after the alpha), the weekly review (Plan 082), telemetry, Pro.

## 1. Problem

The gauge reads `floor(100 × (0.55·T + …))` (`calibration-gauge.js:5, 11`). Test sets carry 55 % of it, so
the number mostly says "have you done your test sets", and it cannot pass 45 % without them. It sits in a
ring beside Today's title and in the bar (`renderTodayCalibration`, `app.js:7686–7693`; `#todayCalRing`,
`index.html:153, 155`) and as a percent with six bars on Progress › Overview (`renderOverviewCalibration`,
`app.js:7636–7665`). A number that rises when the lifter does the thing the app asks for is a bar to fill,
which PRODUCT.md's scores ban names outright. The six signals underneath it are honest and useful; the
percent on top is the problem.

Separately, the first month returns nothing designed. The finish screen's tiles are strength, records, a
weeks-in-a-row streak and volume (`buildSessionSummary`, `app.js:11240`; `weeksInARow`, `:11206`); the
`weeklySnapshot` status word is computed and never shown (`app.js:3968–3990`). A lifter learns what the app
has learned about them only by inferring it from targets.

## 2. Owner decisions (2026-11-08)

| # | Decision |
| --- | --- |
| D-6 | Dissolve the gauge into the profile. The Today ring and the Progress percent go; counts and standing words replace them. |
| D-8 | The profile surface is all Free during the alpha; the split is decided after. |

And from the strategy note's §3.4, accepted with the note: a designed cadence of findings, each a true
thing the record now shows, each ending with what the next one needs, never a bar, a point or a streak.

## 3. The profile. Proposed.

### 3.1 Where

**Progress › Overview**, replacing the "Effort calibration" block at `#overviewCalibration`
(`index.html:250`) with "What Taurifer knows about you" (`profile.title`). Its block id becomes
`#overviewProfile`; the Today ring and its bar twin are removed, and `openCalibrationFromToday`
(`app.js:7695`) goes with them. The exercise page (`renderExerciseView`, `:13289`) shows its own lift's
section under the recommendation block.

### 3.2 What it shows

1. **Per lift in the active program** (one row each, ordered by training day):
   - the standing word from Plan 080 (`recommendation(ex).standing.word`) and its first reason in plain
     words ("4 sets over 2 sessions", "a break of 7 weeks");
   - test sets: "2 test sets · on target" / "1 test set · 2 more before anything changes" / none, from
     `liftCalibration` (`app.js:6367`) with the `maxset.status_*` vocabulary;
   - the opening load and what the first sets showed, when `startingLoad` exists (Plan 079): "started at
     40 kg, worked at 47.5 kg".
2. **Program-wide**:
   - the effort stage and how many of the last ten workouts' sets were chosen rather than prefilled (the
     stage tip's own count, `stageTipQualifyingWorkouts`, `app.js:6955`);
   - the signals as **counts only**: pairs that agree of pairs counted, sets that hit the suggestion of sets
     at the suggested load, weeks that held of week pairs, slow-rep answers that matched of answers, sets of
     history per lift. `CalibrationGauge.compute` keeps producing `evidence` and `counts`
     (`calibration-gauge.js:207–240`); its `percent` is no longer rendered anywhere and `gaugeFull` leaves
     `frequencyAllows` under Plan 080;
   - the findings so far, dated, newest first (§4), and the next one with what it needs.
3. **Recent test sets** stay as they are (`calcheck`, `app.js:7655`): guessed → did, with the result line.

No percentage, no bars, no colour scale. Rates are not shown ("82 % agree" goes); the pair of counts says
it. The copy keys move from `calib.*` to `profile.*`; `calib.full`, `calib.fade`, `calib.percent`,
`calib.aria`, `calib.ring_aria` retire.

### 3.3 The gauge module

`calibration-gauge.js` stays as the owner of the six signals' arithmetic. `compute` keeps returning
`percent` for one release so a stale replica cannot break a reader, with a comment that nothing renders it;
`GAUGE_VERSION` becomes `gauge@081.1` when `percent` is removed in the following release. The 90-day
half-life and the row weights are unchanged and shared with Plan 080's standing.

## 4. Findings. Proposed.

### 4.1 What a finding is

A finding is a dated sentence about the lifter that the record now supports, released the first time its
rule holds, ending with what the next one needs. It is **derived**, never stored: `buildFindings(log,
program, meta, now, standings)` in `progress-model.js` (pure Progress and history projections) returns the
released findings with their release dates and the next pending finding with its need. The only stored
state is `uiPrefs.findingsSeen` (the ids the lifter has seen on a finish screen), so the summary can mark one
as new. A later version can change a rule, and the whole history re-derives; nothing has to migrate.

### 4.2 The sequence

Each finding names its rule in terms the model already computes, and the **need** is the distance to the
rule, said as sessions or sets on a named lift.

| Id | Finding (EN; PT reviewed first) | Rule | Need, until then |
| --- | --- | --- | --- |
| `weights_found` | "Your starting weights are set: {n} lifts found their working load with you." | ≥ 1 row with `startingLoad` (Plan 079), or every lift has an anchor | "{m} lifts still start from a guess" |
| `first_target` | "Your first target with its reason: {lift} at {load} for {reps}, because of what you did on {date}." | the first session where ≥ 1 lift has `history_anchor` | "one more session of {lift}" |
| `first_check` | "Your first test set: you guessed {g} on {lift} and did {d}." | the first `failure` row with `calibration` | "a lift that can take a test set, after two working sets" |
| `effort_read` | "On {lift}, the app now reads your effort as a little {low/high} and allows for it." / "…your estimates on {lift} match your test sets." | the first key whose `liftCalibration.state` leaves `uncalibrated` | "{k} more test sets on {lift}" |
| `first_solid` | "{lift} is on solid footing: {sets} sets over {sessions} sessions that agree." | the first key whose standing is `solid` | "{m} more sets on {lift}" |
| `first_trend` | "Two weeks in a row on {lift}: {cap1} then {cap2}." (with the first record, if one fell) | the first W pair for a key (`weeksFrom`, `calibration-gauge.js:110–134`) | "another week of {lift}" |
| `month_one` | "Four weeks in: {sessions} sessions, {improved} lifts moved up, {solid} on solid footing." | 28 days after the first session | "{d} more days" |

Later findings (a second block, the first comparable program) are left to Plan 082 and the block review.
Nothing in a finding is a verdict on the person: no "you missed", no "keep it up".

### 4.3 Where a finding appears

- **The finish screen** (`sessionSummaryHtml`, `app.js:11648`): one line, "New today", above the tiles when
  this session released a finding; tapping opens Progress › Overview at the profile. The streak tile is
  **removed** in the same PR: `weeksInARow` is a streak by name and by shape, and the scores ban is explicit
  about streaks. Its space takes the finding line when there is one and the next need when there is not.
- **The profile** lists them with dates.
- No notification, no toast, no rest tip: a finding is read after the work, not during it.

## 5. Changes by owner module

| Owner | Change |
| --- | --- |
| `progress-model.js` | `buildFindings` and the seven rules; a `FINDINGS_VERSION`; pure |
| `calibration-gauge.js` | Comment on `percent`; otherwise unchanged in this plan |
| `app.js` | `renderOverviewProfile` replaces `renderOverviewCalibration`; the Today ring, `calRingSvg`, `renderTodayCalibration` and `openCalibrationFromToday` are removed; the exercise page section; the finish screen's finding line and the streak tile's removal; `uiPrefs.findingsSeen` |
| `index.html` | `#todayCalRing`, `#todayCalRingBar` removed; `#overviewProfile`; script revisions |
| `styles.css` | The ring styles removed; the profile rows |
| `i18n-en.json`, `i18n-pt.json` | `profile.*`, `finding.*` (seven findings and their needs), `summary.new_today`; `calib.*` retired except the test-set rows; regenerate `i18n.js` |
| `sw.js` | Revisions from live `main` at merge |
| `docs/ui-screens/README.md`, `manifest.json` | §7 |
| `CONTEXT.md` | *Finding* and *Profile* already defined (2026-11-08); no change unless copy review renames |

No draft, row or contract change; no Worker redeploy. No telemetry change: the profile and findings are
unmeasured in the alpha (frozen allowlist).

## 6. Safety and the scores ban, checked

- No number on the profile rises because the lifter did what the app asked, except counts of what they did,
  stated as counts. The test is PRODUCT.md's: would a quiet training partner say it.
- Findings are released by the record, not by taps; dismissing nothing changes nothing.
- A lifter who never takes a test set still gets `weights_found`, `first_target`, `first_solid`,
  `first_trend` and `month_one`. The cadence does not depend on the optional instrument.

## 7. Tests (each red before its change)

- New `test/findings.mjs` (Node, pure): each rule on fixtures; release dates are the first session on which
  the rule holds; the need's arithmetic; re-derivation after a History edit; a lifter with no test sets
  releases five of seven.
- `test/calibration-gauge-browser.mjs` → `test/profile-browser.mjs`: the Overview block shows per-lift rows
  with standing words, counts without percentages, the findings list; the Today ring is absent; the exercise
  page section; EN and PT at 200 % text.
- `test/session-summary.mjs`, `test/summary-evidence.mjs`: the "New today" line appears once per finding and
  is marked seen; the streak tile is gone; the layout holds with and without a finding.
- `test/today-*.mjs`: no ring in the title or the bar; the large-title layout without it.
- `test/i18n.mjs`; the production syntax check.

## 8. Catalog states

- Retire `today/calibration-mini` and `today/calibration-ring-bar`; `today/ready` is recaptured without the
  ring.
- `progress/overview-calibration` → `progress/overview-profile` (per-lift rows, counts, two findings, the
  next need); new `progress/overview-profile-first` (a device after two sessions: one finding, the need).
- `session/summary` recaptured without the streak tile; new `session/summary-finding`.
- `library/exercise-detail-suggested` with its profile section.
- `workout/why-calibration` unchanged.

## 9. PR split

| PR | Content |
| --- | --- |
| 1 | The profile replaces the gauge: Overview block, Today ring removal, exercise page section, copy, frames. Findings not yet shown. |
| 2 | `buildFindings` and the seven rules in `progress-model.js`, the Node test; the profile lists them. |
| 3 | The finish screen: the finding line, the streak tile's removal, `findingsSeen`, frames. |
