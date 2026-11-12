# Plan 084: Your profile / Seu perfil, round 2

Status: owner-directed second design round on draft PR #753, 2026-11-12.
Design only. Base remains `991163048b9e0da288e20924660e1b285c9ac4ca`;
round 1 is preserved in commit `a02c7a567`. No app code, tests or CI.

## 1. Decisions and problem

The owner chose A's ink ring, named it **Your profile / Seu perfil**, allowed
an ink fill without a percentage number or celebration, and kept everything
Free during alpha. Post-alpha commercialization remains notes only. Directions
B and C are removed from this branch's current artifacts.

Round 1 counted a lift once after its history informed a target. Four lifts
could finish the ring in two weeks. That does not show months of learning or
investment. Round 2 gives each comparable lift stages and depth within them.
Every increment must come from saved evidence. Time alone never adds or removes
anything, and the ring never affects recommendations or test-set frequency.

A five-label ladder alone still fails: three agreeing checks can establish
calibration in weeks. Delaying the words Solid or Well calibrated for months
would misrepresent the existing estimator. The proposed ring therefore counts
saved comparable-session steps within the attained stage as well as the four
stage transitions. The 16-week simulation below exposes this choice rather
than hiding an early plateau behind slower animation.

## 2. Proposed per-lift model

A lift is an engine-comparable identity: performed movement, equipment,
loading convention and metric semantics. Duplicate slots and display aliases
share evidence; a different machine does not. No bundled four-lift cap.

A **depth step** is one distinct saved calendar date with at least two normal,
comparable, non-warm-up working rows whose effort was explicitly chosen. Both
rows need valid performed load, reps and finite effort, and a supported engine
configuration. Numeric and word answers count equally as dates; standing still
uses its own quality weights. A failure row does not replace those two ordinary
rows. A repeated import/session id or two sessions on the same date cannot add
a second step for that lift. This is a dated observation count, not a streak.

An opening load recorded by session zero or a normal saved row anchors the
first stage; a declared prior, generator answer or an unsaved draft does not.
Imported history can contribute when its comparable identity, dates and explicit
effort are recoverable; unknown provenance cannot be promoted to explicit.

### Stage rules

The labels below describe the deepest evidence ever supported by the retained
record. They are not today's `standing.word`. The per-lift page shows both.
Transitions are earned once, in order. Evidence acquired earlier can satisfy a
later stage once its prerequisites hold.

| Stage | Exact proposed rule | Ring contribution and next need |
| --- | --- | --- |
| First time | No valid saved history anchor. `standing@078.1` returns `first`, or unavailable/configuration-required. | No transition. Save comparable working sets to start. |
| Learning | At least one depth date with a saved working load, and a non-unavailable historical `standing@078.1` result of `learning` or `solid`. | First transition, plus each saved depth date. Next need is the existing standing reason, never a fabricated date. |
| Solid | At a saved boundary the actual `standing@078.1` result is `solid`. | Second transition. Current production rule: at least 6 weighted sets over 2 sessions; if at least 4 pairs, agreement at least 0.6; no inconsistent-check reason and no gap of at least 42 days. The producer owns weights, 90-day weighting and comparability. |
| Checked by a test set | Historical Solid, plus at least one valid saved `calibration` guess/result on this comparable identity. | Third transition. A check is evidence even when the guess is wrong. Next: the existing estimator's need, usually 2 more checks after the first. Safety and prompt ceilings stay unchanged. |
| Well calibrated | Previous stages, plus at a historical boundary at least 3 valid checks and `calibration@077.1` state `calibrated`: absolute shrunken bias below 0.75 and sample spread at most 1.25 reps. | Fourth transition. More comparable-session depth still fills the ring afterwards; this stage does not imply perfect future targets. |

Plan 077's arithmetic remains authoritative. Errors are predicted minus actual
reps, clipped to ±5. Bias is their sum divided by `n + 2`. Spread is their sample
standard deviation. `checkErrors` takes the last six valid checks, no older than
180 days at the historical boundary, after the latest 42-day reset. Never pool
checks from different equipment to make them agree.

A consistent bias is also useful learning. With at least 3 checks, spread at
most 1.25 and state `under` or `over`, the fourth transition instead reads
**Consistent bias understood / Tendência consistente identificada**. It is
not labelled Well calibrated or accurate. The same bound for both directions
avoids treating a high-spread `over` state as agreement just because the engine
permits its conservative correction. The existing calibration state and delta
remain unchanged.

### A lifter who skips test sets must keep moving

Do not give that lifter imaginary calibration. After historical Solid:

- At **32 depth dates**, the third transition can instead read **Long record /
  Histórico amplo**. It is evidence depth, not a check result.
- At **64 depth dates**, the fourth can read **Established from history /
  Base consolidada pelo histórico**. Effort calibration still says **Not
  checked / Sem série-teste**. No claim about effort-report accuracy follows.

The test and history paths share each transition's single place. Taking a test
after reaching Long record changes the explanation, not the number of earned
transitions. A test is never required for a full ring. Disabling prompts does
not grant anything. Barbell-ineligible lifts have the same history path.

### Fill, depth and duration

For each comparable lift:

```text
steps = min(64, qualifying saved depth dates) + attained transitions, at most 4
budget = 68
program fill = sum(lift steps) / (68 × distinct comparable lifts in this program)
```

No percentage is printed. Today shows only the ink ring and its name. Overview
explains the saved-date and stage counts separately; the per-lift reader names
every next condition. The 64-date budget is a proposed presentation threshold,
not a discovered physiological constant or an engine setting. It is the main
remaining product choice. One date and one transition each contribute one
visible step; their counts stay distinguishable in the reader. No invented
points, daily bonus, time-in-app credit, finding-open credit or acceptance reward.

A full ring needs at least 64 trained dates **per lift** as well as the stage
path, even if test sets agree early. At three exposures per lift per week that
is at least 22 weeks; at two it is 32 weeks. Each is months of actual records,
not elapsed time. A training break can make that take longer, never undo it.
The ring can finish; it is not an endless meter. Afterwards it stays full while
findings and history continue. New comparable lifts add genuine learning room.

The next-depth line states what is being observed, not an instruction to train
extra, hit an authored load, take a test or lift through pain. A saved date can
count even if a load goes down. There is no promised weekly increase for an
actual person whose evidence is missing or unsupported.

## 3. Current standing, findings and honesty over time

The ring uses historical attained stages, re-derived at each original saved
boundary. Current standing still comes from the current engine result. After
rest, a lift can read **Solid reached on 16 Jan; current estimate Learning
after a break**. A historical check remains a historical check when its current
180-day window expires. Neither record claims the engine still uses the old
bias. The per-lift view distinguishes those statements.

The profile from #731 and the seven findings from #737 remain. The finish
integration follows #736's final finding slot. Findings such as weights found,
first target, first check, first Solid and month one explain the transitions
with their existing release dates; they do not add a second step for the same
fact. Never derive a stage from a `findingsSeen` preference, tap or calendar
finding. Opening loads explain the first evidence. Accepted adaptations stay
out because acceptance is not proof of a training result.

No decay for rest, age, missed weeks or subscription state. Recompute from
surviving evidence after a correction, deletion, backup replacement or a model
version change. If support disappears, state the exact reason and affected
lift before showing the revised reading. Never keep an unsupported high-water
counter. Clearing history clears its stages. No new persistent ledger is
assumed by this plan; versioned replay must be feasible before implementation.
The historical standing calculation may need more than the old gauge's bounded
30-set H replay. Do not silently infer unavailable historical prescriptions.

## 4. New lifts, new programs and the ring's denominator

Carry a stage only when the full comparability identity carries. A renamed
slot is the same lift; a new machine starts its own evidence. A retained lift
keeps its depth dates across programs. Archived lifts keep their facts in the
profile but leave the active program's denominator.

An expanded denominator necessarily lowers the proportion for the same earned
steps. A fixed-size single ring cannot keep the same angle **and** tell the
truth. Do not animate a drain or claim that nothing visually changes.

On the first Overview visit after expansion, show a quiet **Profile scope
changed / O perfil agora cobre mais exercícios** explanation:

- A small static previous-scope ring, labelled **4 lifts, before**.
- The current A ring, labelled **6 lifts, now**.
- **112 saved steps retained. Two new lifts start at First time.**

The new ring appears at its new reading without a backward tween. Today uses
that same new scope immediately, with a temporary factual line **2 new lifts
in your profile** leading to the explanation. This is presentation of an actual
scope change, not a loss of learned evidence. The eighth contact-sheet column
shows it. If scope shrinks, show the same before/now comparison rather than
celebrating a larger fill. No extra Settings dial, notification or telemetry.

## 5. Sixteen-week simulation, executed as design legwork

Run `node docs/design/plan-084-gauge/simulate.mjs`. This is a synthetic scenario
generator, not a test suite. It calls the shipped `recommendSets` and
`Calibration.checkErrors/estimate/shouldOffer` interfaces. It writes the
[weekly table](../docs/design/plan-084-gauge/simulation-table.md) and
[per-week, per-lift evidence](../docs/design/plan-084-gauge/simulation.json).
No test file is imported, no private helper is scraped, and no app data is read
or written. The proposed step aggregation is disposable code in this directory.

Assumptions are deliberately explicit:

- Beginner: four machine lifts, full body Monday/Wednesday/Friday. Three working
  sets with explicitly chosen words per lift, same equipment, controlled
  comparable rows. Checks rotate on at most Monday and Friday, one per session,
  at least 14 days per lift, only when shipped uncertainty/recheck policy permits.
  Every simulated guess equals the measured result. This is an optimistic
  calibration path, not a forecast of beginner accuracy.
- Intermediate: eight lifts, upper/lower four days per week; each lift gets two
  comparable exposures per week. Explicit numeric effort, no test sets at all.
  It reaches Long record at week 16 and keeps room for another 16 weeks.
- Program change: the beginner's schedule, retaining its four lifts and adding
  two new machine identities **after** the last session of week 8. Six lifts
  thereafter. New lifts have no invented earlier history and no scheduled
  checks in this example. At week 8, 112 earned steps are retained while the
  budget grows from 272 to 408. This tests expansion rather than erasing old
  evidence or conveniently substituting already-known lifts.

The fractions below are design arithmetic for review, never percentage numbers
or points presented to the lifter. Every column gains saved evidence each week;
the scope change is explicitly marked. The generator produces this table and the [ink-line comparison chart](../docs/design/plan-084-gauge/simulation-chart.html).

<!-- simulation-table:start -->
| Week | Beginner, 3/week | Intermediate, 4/week, no tests | New program at week 8 |
| --- | --- | --- | --- |
| 1 | 16/272 | 24/544 | 16/272 |
| 2 | 36/272 | 48/544 | 36/272 |
| 3 | 48/272 | 64/544 | 48/272 |
| 4 | 60/272 | 80/544 | 60/272 |
| 5 | 74/272 | 96/544 | 74/272 |
| 6 | 88/272 | 112/544 | 88/272 |
| 7 | 100/272 | 128/544 | 100/272 |
| 8 | 112/272 | 144/544 | 112/408 * |
| 9 | 124/272 | 160/544 | 132/408 |
| 10 | 136/272 | 176/544 | 152/408 |
| 11 | 148/272 | 192/544 | 170/408 |
| 12 | 160/272 | 208/544 | 188/408 |
| 13 | 172/272 | 224/544 | 206/408 |
| 14 | 184/272 | 240/544 | 224/408 |
| 15 | 196/272 | 256/544 | 242/408 |
| 16 | 208/272 | 280/544 | 260/408 |
<!-- simulation-table:end -->

`*` At week 8, 112/272 becomes 112/408 because two new lifts enter the program.
No earned step is removed. The before/now scope view makes this explicit.
Results demonstrate these stated scenarios, not all schedules or noisy records.
Early stage labels finish sooner than the ring: that is why depth within the
stage is necessary. The simulation uses clean synthetic engine inputs and
machine identities, not a claim of catalog integration or physical validation.

## 6. Name and the selected prototype

The name stays **Your profile / Seu perfil**. Printing it as a gauge title
immediately below **What Taurifer knows about you / O que o Taurifer sabe sobre
você** repeats the same subject and weakens the hierarchy. Recommend the minimal
fix shown in the prototype: **Your profile** is the section heading, and the
existing explanatory sentence becomes its subtitle. The words of that sentence
stay intact. This hierarchy change is flagged for owner approval, not a rename.

[Single round-2 contact sheet](../docs/design/plan-084-gauge/contact-sheet.png).
Eight columns: Today fresh, mid-way and well-tailored, Overview, one lift's
stage reader, finish before and after a saved stage step, and scope expansion.
Rows: PT light, PT dark, EN light, EN dark. Every source frame is 390 × 844.

The ring keeps A's compact ink shape. It has no percentage, colour reward or
completion flourish. Per-lift rows open the stage reader. That reader shows the
attained stage, current standing, saved depth, check results and the next exact
condition. Current prescriptions and Start session stay dominant on Today.
Fresh means an onboarded program before saved sets; no-program stays outside.

Prototype fixtures: fresh 0/272; mid-way 74/272, based on beginner week 5;
well-tailored 208/272, beginner week 16. It is deliberately not full. The finish
illustrates a third agreeing row check: 74 → 76 steps, comprising one saved
depth date and one new stage transition. That row has checks 11→11, 10→11,
12→12. Errors 0, -1, 0 give bias -0.2 and spread about 0.577, so the production
estimator says calibrated. Its pre-save errors 0, -1 give `n=2`, no correction.
The whole program's other evidence stays fixed. A concurrent finding comes
from the existing rule if supported, never a duplicate reward.

An unchanged-stage finish can still gain a depth date. An unchanged-depth and
unchanged-stage save leaves the ring unchanged. Failed/cancelled saves add
nothing. The fill moves once after save, linearly over 500ms in this disposable
comparison, no bounce or celebration. Reduced motion shows the end state
immediately. Production motion would go through the existing motion layer;
no vendor or app module is loaded into this prototype.

## 7. Rules and implementation split

The owner has resolved the visual exception, name and alpha boundary. Record
those decisions here instead of asking them again. A later implementation
updates the D-6/OD-20/PRODUCT/CONTEXT references to the selected model without
erasing their rationale. No orange category, Settings tuning, scoring system,
telemetry event/property, account or new transfer field is authorized.

1. Freeze the remaining depth/alternate-path rules and exact EN/PT labels.
   Build a pure, versioned saved-evidence projection using the existing standing,
   calibration, opening-load and findings owners. Prove actual identity,
   deduplication, historical support, rest, edits/deletions, scope carry-forward
   and unknown historical contexts in that future implementation packet.
2. Today and Overview, including scope explanation and per-lift stage reader.
   Keep diagnostic signals and findings; no percentages. Approved copy, semantic
   controls, focus/return, asset revisions and targeted catalog artifacts belong
   to that implementation, not this design round.
3. Finish integration against the final #736 slot, stage and depth changes from
   the same successful save, unchanged state, navigation and reduced motion.

This PR remains docs and a static prototype. The simulation is scenario
arithmetic requested by the owner, not an application test or completion gate.
Browser capture alone uses `flock /tmp/taurifer-browser.lock`. No tests or CI
are run or awaited in this round.

## 8. Post-alpha notes only

Everything stays Free in alpha, including the whole profile, stages, findings
and both evidence paths. Keep post-alpha commercial discussion separate from
fill, eligibility, recommendations and saved facts. A later history-aware next
program or bounded adaptation may use the record under the thesis's evidence
gates and entitlement ADR. This plan defines no paid boundary, offer, trial,
price, checkout or trigger. Paying, lapsing and declining never move the ring.

## 9. Remaining owner questions

1. **Recommend the 64-date depth budget with four attained transitions per
   comparable lift.** Approve depth within stages so calibrated lifts still
   move for months, and the 32/64-date history path so skipping tests never
   creates an artificial ceiling? These are proposed presentation rules, not
   existing estimator thresholds. Labels alone cannot deliver the requested
   duration without suppressing what the app already knows.
2. **Recommend the alternate labels in §2.** Approve Long record / Histórico
   amplo and Established from history / Base consolidada pelo histórico for
   the no-test route, and Consistent bias understood / Tendência consistente
   identificada for stable biased checks? They avoid claiming calibration
   without supporting evidence.
3. **Recommend Your profile as the heading with the existing sentence as its
   subtitle.** Approve that minimal hierarchy change and the before/now scope
   explanation, with no backwards fill animation or concealment of re-scaling?
