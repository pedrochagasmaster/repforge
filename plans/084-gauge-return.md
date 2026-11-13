# Plan 084: Your profile / Seu perfil, round 3

Status: **approved in substance**, owner decisions recorded in round 3 of
draft PR #753, 2026-11-12. Exact weighting below is the recommended execution
parameter; candidate EN/PT copy still follows owner copy review.
Design only. Base remains `991163048b9e0da288e20924660e1b285c9ac4ca`;
round 1 is preserved at `a02c7a567`, round 2 at `dac9c6c73`. No app code, tests or CI.

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

### Round-3 owner decisions

1. Stage transitions must carry about a month of a lift's training, rather than
   one date's worth. The exact recommendation is 8 units per transition and
   ¾ unit per saved depth date. Four transitions contribute up to 32 units;
   64 dates contribute up to 48. The per-lift budget is 80.
2. The 32/64-date history path is approved and earns the same stage weight as
   the test-set route. It is never called calibrated without check evidence.
3. The before/now scope screen is approved, shown once for each actual scope
   growth, with no backward fill animation. A dismissal acknowledges that
   expansion, not all future expansions.

## 2. Per-lift model

A lift is an engine-comparable identity: performed movement, equipment,
loading convention and metric semantics. Duplicate slots and display aliases
share evidence; a different machine does not. No bundled four-lift cap.

**Owner decision, 2026-11-13:** older or imported rows with unknown effort
provenance count exactly as the shipped `standing@078.1` producer treats them.
Use its comparable identity, exclusions and `CalibrationGauge.rowQuality()`;
never promote unknown provenance to explicit or give it more evidence credit.
Missing/null provenance has quality ½, numeric RIR/reps-left has quality 1,
and word/bounded answers have the same ½ weight as standing. Prefilled, unsure,
warm-up and ordinary-depth failure rows have zero quality. Valid failure checks
continue to feed only the existing check/calibration route. Unsupported or
non-comparable engine rows stay excluded.

A **depth step** is the saved evidence equivalent of two quality-1 working rows
on one calendar date. A date needs at least two distinct, valid, comparable
ordinary working rows. Its contribution is `min(1, sum(rowQuality) / 2)`:
two unknown-provenance rows contribute ½ step, three contribute ¾, and four
contribute one. Two numeric rows contribute one. Each date contributes at most
one step across all its sessions; duplicate imports/rows cannot add credit.
The physical saved dates remain available separately from weighted depth steps.
This is a dated observation count, not a streak.

Rows need valid performed load, reps and finite effort, a saved calendar date
and a supported engine configuration. An opening load recorded by session zero
or a normal saved row anchors the first stage; a declared prior, generator
answer or an unsaved draft does not. Imported/older history contributes when
those fields are recoverable even when its effort provenance is unknown.

Learning/Solid transitions cannot exceed the engine standing at the saved
boundary that earns them. Later test/history transitions still require the
engine-supported Solid boundary and their existing prerequisites. Attained
historical stages remain distinct from today's standing, which can change after
a break; rest does not erase retained evidence. The 32/64 history thresholds and
64-step date cap use weighted depth steps, not the unweighted calendar count.

### Stage rules

The labels below describe the deepest evidence ever supported by the retained
record. They are not today's `standing.word`. The per-lift page shows both.
Transitions are earned once, in order. Evidence acquired earlier can satisfy a
later stage once its prerequisites hold.

| Stage | Exact proposed rule | Ring contribution and next need |
| --- | --- | --- |
| First time | No valid saved history anchor. `standing@078.1` returns `first`, or unavailable/configuration-required. | No transition. Save comparable working sets to start. |
| Learning | At least one depth date with a saved working load, and a non-unavailable historical `standing@078.1` result of `learning` or `solid`. | First transition, plus weighted saved depth. Next need is the existing standing reason, never a fabricated date. |
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

- At **32 weighted depth steps**, the third transition reads **Long record /
  Histórico amplo**. It is evidence depth, not a check result.
- At **64 weighted depth steps**, the fourth reads **Established from history /
  Base consolidada pelo histórico**. Effort calibration still says **Not
  checked / Sem série-teste**. No claim about effort-report accuracy follows.

The test and history paths share each transition's single place. Taking a test
after reaching Long record changes the explanation, not the number of earned
transitions. A test is never required for a full ring. Disabling prompts does
not grant anything. Barbell-ineligible lifts have the same history path.

### Fill, depth and duration

For each comparable lift, recommend these exact presentation weights:

```text
date units = 0.75 × min(64, weighted saved depth steps)
stage units = 8 × attained transitions, at most 4
lift budget = 48 + 32 = 80
program fill = sum(date units + stage units) / (80 × distinct comparable lifts)
```

Each transition is worth 10⅔ comparable dates: about 3½ weeks at three
exposures per lift per week, or 5⅓ weeks at two. That is roughly a month in
the two simulated schedules. Date credit is reduced by a quarter, but its
64-date runway stays intact. Reducing the date cap instead would make the
no-test path stall before its approved 64-date final stage.

A first Solid, first valid test set after Solid, or newly confirmed agreeing
pattern each adds the same 8 stage units. Long record at 32 weighted steps and
Established from history at 64 weighted steps also add 8 each. If both routes qualify
for one transition, count it once. Existing standing/calibration thresholds,
checks, prompts and safety rules are unchanged.

No percentage or weighted-unit total is printed in the product. Today shows
the ink ring and its name; Overview shows actual observations and attained
stages separately. The reader names the evidence behind each. Fractional units
are presentation arithmetic, never fractional workouts or an engine setting.
No daily bonus, time-in-app credit, finding-open credit or acceptance reward.
The full ring allocates 40% of capacity to stage transitions and 60% to dates;
the share of the **earned fill** depends on the lifter and is shown below.

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
- **All saved evidence retained: 96 lift observations and 16 attained stages.
  Two new lifts start at First time.**

The screen is shown once per expansion, not on every visit or reload.
Its acknowledgment must survive reload and remain device-only; it never enters
a setup link, a backup programming proposal or telemetry. Before implementation,
define that UI-preference record and cover install-transfer clone fidelity and
destination eligibility, including normal boot and reload. Automatic presentation
metadata must not disqualify a fresh destination. Explicit, unknown and malformed
records keep their existing protection.

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
  checks in this example. At week 8, 200 earned units are retained while the
  budget grows from 320 to 480. This tests expansion rather than erasing old
  evidence or conveniently substituting already-known lifts.

The fractions below are design arithmetic for review, never percentage numbers
or points presented to the lifter. Every column gains saved evidence each week;
the scope change is explicitly marked. The generator produces this table and the [ink-line comparison chart](../docs/design/plan-084-gauge/simulation-chart.html).

<!-- simulation-table:start -->
| Week | Beginner, 3/week | Intermediate, 4/week, no tests | New program at week 8 |
| --- | --- | --- | --- |
| 1 | 41/320 | 76/640 | 41/320 |
| 2 | 114/320 | 152/640 | 114/320 |
| 3 | 123/320 | 164/640 | 123/320 |
| 4 | 132/320 | 176/640 | 132/320 |
| 5 | 157/320 | 188/640 | 157/320 |
| 6 | 182/320 | 200/640 | 182/320 |
| 7 | 191/320 | 212/640 | 191/320 |
| 8 | 200/320 | 224/640 | 200/480 * |
| 9 | 209/320 | 236/640 | 229.5/480 |
| 10 | 218/320 | 248/640 | 259/480 |
| 11 | 227/320 | 260/640 | 272.5/480 |
| 12 | 236/320 | 272/640 | 286/480 |
| 13 | 245/320 | 284/640 | 299.5/480 |
| 14 | 254/320 | 296/640 | 313/480 |
| 15 | 263/320 | 308/640 | 326.5/480 |
| 16 | 272/320 | 384/640 | 340/480 |
<!-- simulation-table:end -->

`*` At week 8, 200/320 becomes 200/480 because two new lifts enter the program.
No earned step is removed. The before/now scope view makes this explicit.
Results demonstrate these stated scenarios, not all schedules or noisy records.
Early stage labels finish sooner than the ring: that is why depth within the
stage is necessary. The simulation uses clean synthetic engine inputs and
machine identities, not a claim of catalog integration or physical validation.

### Week-16 composition

These percentages explain the design arithmetic to the owner; they are not
product labels. "Earned share" divides by the filled portion, while "capacity"
divides by the entire ring, including the still-empty part.

<!-- simulation-shares:start -->
| Scenario | Stage units | Date units | Stage / date share of earned fill | Stage / date share of full capacity |
| --- | --- | --- | --- | --- |
| beginner | 128 | 144 | 47.1% / 52.9% | 40.0% / 45.0% |
| intermediate | 192 | 192 | 50.0% / 50.0% | 30.0% / 30.0% |
| change | 160 | 180 | 47.1% / 52.9% | 33.3% / 37.5% |
<!-- simulation-shares:end -->

At full capacity each lift has 32 stage units and 48 date units. At week 16,
roughly half of the earned fill is stages in all three scenarios. The remaining
empty capacity still requires real evidence. The no-test path's transition at
32 dates has exactly the same 8-unit effect as its test-set counterpart.

## 6. Name and the selected prototype

The name stays **Your profile / Seu perfil**. Printing it as a gauge title
immediately below **What Taurifer knows about you / O que o Taurifer sabe sobre
você** repeats the same subject and weakens the hierarchy. Recommend the minimal
fix shown in the prototype: **Your profile** is the section heading, and the
existing explanatory sentence becomes its subtitle. The words of that sentence
stay intact. This hierarchy change is flagged for owner approval, not a rename.

[Single round-3 contact sheet](../docs/design/plan-084-gauge/contact-sheet.png).
Eight columns: Today fresh, mid-way and well-tailored, Overview, one lift's
stage reader, finish before and after a saved stage step, and scope expansion.
Rows: PT light, PT dark, EN light, EN dark. Every source frame is 390 × 844.

The ring keeps A's compact ink shape. It has no percentage, colour reward or
completion flourish. Per-lift rows open the stage reader. That reader shows the
attained stage, current standing, saved depth, check results and the next exact
condition. Current prescriptions and Start session stay dominant on Today.
Fresh means an onboarded program before saved sets; no-program stays outside.

Prototype fixtures: fresh 0/320; mid-way 157/320, beginner week 5;
well-tailored 272/320, beginner week 16. It is deliberately not full. The
finish illustrates a third agreeing row check: 157 → 168 units. Four new
lift-date observations contribute 3 units and the one stage transition adds 8.
All four exercises now have 16 saved sessions, rather than pretending that
only the featured exercise trained during a four-exercise session.

The row checks remain 11→11, 10→11, 12→12. Errors 0, -1, 0 give bias -0.2 and
spread about 0.577, so the producer says calibrated. Before the third check,
`n=2` means no correction. A finding is reused only when its own rule supports
it; the finding adds no duplicate credit.

The full saved-session change moves the program arc 12.375 degrees; its stage
alone moves it 9 degrees. At the prototype's 86px ring, the stage accounts for
about 5.7px of ink along the arc, versus about 0.53px for one ordinary date.
The prototype also has selectable finish examples for Solid, 149 → 160 units,
and the first valid test set, 157 → 168, using that same stage weight.
Use `screen=finish&event=solid` or `event=checked`; the sheet retains its
agreed eight-column layout and its agreeing-check example. This is a visible
factual step, with no overshoot, colour reward, sound or celebration.

Only the 24 frames with changed fill/numbers are recaptured. Today fresh and
the per-lift stage reader are unchanged and reuse their eight round-2 source
frames byte for byte. The contact sheet keeps the same eight-column/four-row
layout. The capture manifest records retained versus rendered sources.

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

The implementation is three dependent PRs. Tests listed here are future
implementation evidence, not commands run during this design phase.

| PR | Scope and owners | Required boundary proof in that future PR |
| --- | --- | --- |
| 1. Saved-evidence model | A pure versioned profile projection, using the shipped standing/calibration producers, canonical performed identity, opening-load and findings owners. One authoritative weight table: date ¾, transition 8, date cap 64. Update the D-6/OD-20, PRODUCT and CONTEXT records to the approved direction. Do not restore the retired percent. | Historical stage replay; exact weight arithmetic; a Solid and a valid-check transition; equal weight on both history thresholds; no duplicate credit across paths; date/identity deduplication; no rest decay; edits/deletion/backup replacement; scope carry-forward; unsupported legacy context. Keep the 16-week design scenarios as illustrative data, not production oracles. |
| 2. Today, Overview and per-lift reader | Render the selected ring and candidate copy through the real profile. Implement current versus attained standing, scope rescaling and the once-per-expansion acknowledgment. Keep findings and signal counts. Update only necessary roles, asset/cache revisions and catalog frames. | Real navigation/focus return; fresh/no-program/changed-equipment cases; before/now appears once for a growth and survives reload; a later growth appears again; no backward tween; preference clone fidelity, normal-boot/reload eligibility and production-path refusals for protected records. No new telemetry. |
| 3. Finish integration | Use the final #736 finish/finding implementation and the same projection before/after one successful save. One restrained fill transition and its stated evidence reason. | A first Solid and a first valid check each visibly add 8 stage units, plus the real new date observations; an agreeing-check transition; unchanged-stage and unchanged-evidence saves; failed/cancelled save; finding co-presence without duplicate credit; Overview/per-lift return path; reduced-motion final state. |

PR 1 lands before PR 2, then PR 3. Each implementation PR follows the repo's
then-current focused evidence, copy, revision and fidelity requirements. No new
row/draft schema or transfer validator is assumed. If replay needs a durable
contract change, design that explicitly and satisfy its Worker/clone gates
before widening this split. A device-only acknowledgment is not permission to
change the canonical training record.

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

## 9. What remains for the owner

The plan is approved in substance. Recommend **8 units per attained stage and
¾ per comparable date, retaining the 64-date limit** as the exact weighting
for implementation. No further decision on the approved no-test route or the
once-per-growth scope screen is needed.

The existing candidate EN/PT labels and heading/subtitle hierarchy still pass
through normal copy review in their implementation PR. Do not reopen the name,
ink fill, no-percent/no-celebration rule, alpha boundary or approved history path.
