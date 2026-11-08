# The coach layer: calibration from day zero, a thirty-day cadence, and the Pro funnel

**Status:** owner decisions recorded (2026-11-08, §10). The decided items govern the plans
in §11; the items the owner deferred to after the alpha stay open and are marked so. Agents
do not amend the thesis, ADR 0010, PRODUCT.md or Plan 077 on the strength of this note; the
owner does, or instructs it explicitly, per §8.
**Source:** the owner's statements of 2026-11-08 (§1) and the discussion that followed.
Written against `main` 0fbae7b; check for drift before executing anything derived from it.
**Form:** the same shape as the calibration synthesis behind Plan 077: a problem, a
position, the product shape, the commercial cut, what it amends, and the open decisions.

## 1. The problem, in the owner's words

Three statements reopen earlier owner decisions. The owner may override their own
decisions; agents may not.

1. **The app is not beginner friendly.** RIR and the rest of the bodybuilding vocabulary
   frighten newcomers. Plan 077 PR 2 (#628) already built the answer: three effort stages,
   words (Easy / Hard / Max), reps left (0 · 1 · 2 · 3+) and RIR as a number, switchable
   from the effort field's menu on the workout screen, with tips that climb the ladder
   after six qualifying workouts (OD-4, OD-6). One default keeps it from running for a
   newcomer: a fresh install starts at the top, in numeric RIR (`DEFAULTS.rirMode:
   "numeric"`, `app.js:1711`; a missing setting normalizes to numeric; onboarding never
   asks), and OD-6 never suggests a stage down, so the tips never reach them. Separately,
   onboarding asks a beginner to pick a load they can hold for a rep range they have never
   felt. The owner also notes (2026-11-08) that reps left and RIR are the same quantity
   with different bounds, and that two stages for one quantity is a design failure (§3.2,
   D-15).
2. **The Pro boundary is weak.** Nothing pulls a lifter to keep logging until the value of
   consistently logged data is real. A lifter who churns at week two never sees it; a lifter
   who stays can ignore the paywall and keep using Free, because the thing Pro sells is not
   visible until the first block ends.
3. **The engine is a formula.** Per-set double progression over a capacity number is
   something a spreadsheet can hold. To compete with hiring a coach, Taurifer needs the
   personalization and judgement a good coach gives, within what a deterministic,
   local-first app can honestly do.

The constraint the owner set: not gamification. The app has to be interesting and engaging
from day zero so that the lifter reaches day thirty and is hooked by what it has learned
about them, never by points, streaks or celebrations (PRODUCT.md, brand commitments).

## 2. Position

> **Calibration is the right core, in the wrong place.** Plan 077 ships it as a correction
> that arrives after three test sets, on a fourteen-day calendar, and moves one load step.
> That is a coach who stays silent for six weeks. Moved to the first session and made the
> engine's own mechanism, calibration is the one thing a spreadsheet and a formula cannot
> be: the app learns how this lifter judges effort, finds their weights with them, and says
> on every target how well-founded it is.

What a good coach does in the first month, once technique and motivation are set aside as
things a static PWA cannot do, is four things. The table maps each to today's product and
to this proposal.

| Coach function | Today | Proposed |
| --- | --- | --- |
| Finds your starting weights in the first session | The lifter guesses a load for a range ("Pick a load you can hold for {min}-{max} reps") | **Session zero**: a guided first session that ramps each exercise and sets the loads from reps and a word (§3.1) |
| Teaches you to feel effort by correcting your perception | The three-stage ladder exists but new installs start at numeric RIR and are never offered a stage down; a test set every 14 days; a correction after three | **The effort ladder as teaching**: words by default, one numeric stage, test sets as lessons (§3.2) |
| Watches the week and adjusts | Block review at the end of the block | **Weekly review**: facts for everyone, bounded proposals for Pro (§5) |
| Remembers you across programs | Nothing survives the block as a model of the lifter | **The profile**: what Taurifer knows about you, compounding across programs in Pro (§3.5) |

Everything that follows is deterministic, explained in the Why reader, and bounded, as
ADR 0003 requires. It adds no account, no sync and no AI to Free or core (ADR 0011).

**How far the framing goes (D-1).** The four functions are an engineering frame: coaches are
a real competitor, so the product is built and judged against what a coach does in the
first month. They are not the thesis's core proposition and not the selling point. In
marketing the comparison stays subtle; the subject is sensitive in Brazil, where
prescribing training is a regulated profession, and the owner requires a CREF-registered
physical education professional (Conselho Regional de Educação Física) on board before
commercialization. Copy never calls Taurifer a coach and never implies professional
supervision.

## 3. The product shape

### 3.1 Session zero: find your weights

A beginner's first session is an assessment, not program day one. A coach does exactly
this, and it is the most beginner-friendly thing they do.

- For each exercise in the first training day, the app proposes a conservative opening
  load (a declared prior, §3.3), the lifter does a set, and the app asks one question in
  words: *Could you have done more?* with the answers *none*, *a couple*, *several*. From
  the reps and the answer it steps the load and asks again, at most three times per
  exercise, then sets the starting load.
- No RIR, no numbers to invent. The answers map to the existing effort vocabulary
  (Max / Hard / Easy) and are stored with their provenance (`effortSource`, Plan 077 OD-1),
  so they are ordinary rows the engine already reads.
- It is skippable, and it is skipped by default for a lifter bringing their own program with
  known loads, or receiving a shared program whose author set them. A received program
  without loads is the strongest case for it.
- It replaces the "pick a load" prompt rather than adding to it. The first real program
  session is then session one, and its targets already fit.
- Starting-load calibration follows for free: the lifter's own opening guess against what
  the first sessions demonstrated is a genuine self-report-with-ground-truth pair, the same
  structure as effort calibration, and it improves the next program's starting loads
  (§5, Pro).

### 3.2 The effort ladder as teaching

Plan 077's ladder exists (OD-4, OD-6, shipped in #628). Two changes: where it starts, and
how many rungs it has.

- **Words are the default for a new install, and onboarding asks once (D-3).** `DEFAULTS.rirMode`
  becomes `"effort"` with `effortScale:"feel"`; existing installs keep their setting. One
  onboarding question lets a lifter who already counts reps left start on the numeric stage,
  so an experienced lifter never has to climb. Otherwise the numeric stage is where a lifter
  arrives after the ladder's tip, or by choice in the menu or Settings. OD-6's "never a
  stage down" rule is then harmless, because nobody starts at the top without choosing to.
- **One numeric stage, not two.** Reps left and RIR are the same quantity. The engine
  credits performed RIR only up to the cap of 5 (OD-23b, #624), and the mechanics doc
  already says nobody knows whether they had 6 or 9 left, so the number field's extra
  range is never used. Stages B and C merge into one stage labelled *reps left*, with chips
  0 · 1 · 2 · 3 · 4 · 5+ and "5+" stored as 5, the cap. RIR becomes a glossary word, never
  a mode label. Storage is unaffected: `rirMode` keeps its two values for setup links and
  the transfer contract, provenance rows keep `reps_left` and `reps_left_3plus`, and
  `effortScale` is retired or kept for compatibility, decided in the plan. The letters RIR
  do not appear on a working surface; the glossary stays available.
- **A test set is a lesson, not a measurement.** The result line already says "You guessed
  11 and did 14". For a stage-A lifter the lesson reads in their own words: *you said a
  couple left, you had five*. That is how a coach corrects perception, and it is the
  engaging moment of the first month: a true thing about yourself you did not know.
- **The cadence is driven by uncertainty, not the calendar** (§3.3). The safety rules in
  OD-12 (one per workout, never after a max set, never on the big barbell lifts, never after
  pain) stay. The fourteen-day and two-per-week rules become ceilings, not the schedule.

### 3.3 The engine as an estimator

This is the answer to "it is a formula".

- **Each lift carries a capacity estimate and an uncertainty.** The estimate is the capacity
  the engine computes today. The uncertainty comes from three things the record already
  holds: how many comparable rows there are, how well consecutive sets agree (the gauge's
  A signal), and how reliable this lifter's effort reports are on this lift (the test-set
  errors behind OD-14). It is deterministic and versioned like everything else in
  `progression-engine.js`.
- **Targets say how well-founded they are, in words.** *Solid*, *still learning this lift*,
  *first time at this load*. Never a percentage on the target itself. The Why reader shows
  what the word rests on.
- **The engine asks for a test set when it is unsure**, within OD-12's safety ceilings. A
  lift with a solid estimate is rarely tested; a new machine or a lift whose reports keep
  disagreeing is tested sooner. The lifter still chooses each time (OD-13).
- **Declared priors for the first session.** Opening loads in session zero, and a first
  suggestion for a substituted or new lift, come from a small, versioned, openly declared
  table of population ratios. ADR 0003 permits declared training rules; a coach's
  experience is exactly such a prior. The table is Free, visible in the mechanics doc, and
  is replaced by the lifter's own data as soon as it exists.
- **Not in scope:** rest calibration from set timestamps, time-of-day effects, and
  deload-need detection. Each was examined and rejected as contaminated or underpowered for
  a solo lifter's record. They are recorded in §9 so they are not reinvented.

### 3.4 A thirty-day cadence of findings

The only non-gamified retention lever a logging app has is that each visit returns
something true about the lifter. The cadence below is designed, not emergent: each finding
needs a few more sessions of data than the last, and each names what the next one needs.

| When | Finding | Needs |
| --- | --- | --- |
| Session zero | Your starting weights, found with you | one session |
| Session one | The first target with its reason | session zero's rows |
| Week one | The first test set and what it showed | one eligible lift with two working sets |
| Week two | "On rows, the app now reads your effort as a little low" | three test sets on one lift, or the estimator's first stage change |
| Week three | The first record and the first week-to-week trend | two weeks on one lift |
| Week four | What changed in a month and what the app now knows about you | four weeks |

Each finding ends with its next step stated plainly: *two more sessions on leg press before
the app can tell you whether your estimates there are on target*. This is the forward-looking
form of Plan 077's "nothing changes until three test sets". It is close to the line the
scores ban draws; it stays inside because every line is specific, true, and about the
lifter's training, and none is a bar, a point or a streak. The test is PRODUCT.md's:
would a quiet training partner say it.

### 3.5 One surface: what Taurifer knows about you

Plan 077 excluded a Training Profile dashboard. This note proposes it as the hub of the
cadence, and proposes dissolving the 0–100 gauge into it.

- The profile lists, per lift in the active program, the estimate's standing in words, the
  test sets and their results, and what the next finding needs. Program-wide it shows the
  effort stage, the findings so far, and the signals the gauge computes today, as counts.
- The percentage goes (D-6). With test sets at 55 % of its weight (`calibration-gauge.js`),
  the number is mostly "have you done your test sets", which is a bar to fill. The Today
  ring and the Progress percent are replaced by the profile's counts and standing words.
- During the alpha the whole profile is Free, current program and across programs (D-8).
  Where the Pro line falls is decided after the alpha, together with OD-21 (D-7), which
  stays open: whether any calibration surface becomes a Pro lever is not decided here.

## 4. The landing, briefly

The landing follows from §3 and is not designed here. The owner chose the additive change
now (D-14): a proof chapter, one band, two FAQ entries, with the headline, structure and
actions kept. Per D-1 the coach comparison stays out of the copy; the page shows the
mechanism, never the profession. Session zero becomes the proof scene
instead of a bench press table with an RIR column: a beginner finding their weights in
twenty minutes is the most beginner-friendly demonstration the product can make, and it is
true on day one rather than six weeks later. The headline stays outcome-shaped; the lede
says the mechanism in words; one band carries two numbers per set, what you said and what
you did, rendered from the real modules as every landing figure is. The two FAQ entries
"What is a test set?" and "Will it make me train to failure all the time?" stay.

## 5. The Free and Pro cut

Free hooks; Pro compounds. The cut below is the **proposed target** for the commercial
beta, not the alpha's configuration. The owner decided (D-7, D-8, D-9, D-12) that the alpha
runs with every feature on for every participant, facts and proposals alike, and that each
Free/Pro line is drawn afterwards from what the alpha shows, as ADR 0010 already sequences.
The cut keeps thesis §8.2's current-program execution boundary whole and places the coach's
attention and memory in Pro.

| | Free | Pro |
| --- | --- | --- |
| Session zero and starting loads | yes | the next program's starting loads from your record |
| Effort ladder, test sets, the estimator's corrections | yes | — |
| Targets with their standing and Why | yes | — |
| Weekly review | the week's facts: sessions done, lifts that moved, lifts that stalled, pain reported | a bounded, cause-matched proposal with approval (thesis §8.3 job 3), from week two |
| Profile | the current program | persists and compounds across programs |
| Block review | yes, with the free transition retrospective (§8.2) | the next program built from the record (job 2) |
| First program | the baseline generator | advanced generation around schedule, equipment, recovery and priorities (job 1) |

Two rules make the cut honest:

- **Facts are Free, proposals are Pro.** A Free lifter is never shown "what Pro would have
  changed". The thesis forbids fake doors (§8.4), and a withheld proposal is a tease. Free
  gets the week's facts in full; Pro gets the proposal.
- **Safety and execution never move.** Pain capture and the stop-or-substitute path are
  Free (§8.3). A received program trains without a second paywall (§13.3).

## 6. The funnel: present, try, decide

The owner deferred the funnel's shape to after the alpha (D-10, D-11); this section records
the reasoning and the proposed target so the alpha can be instrumented to decide it. A single
paywall at the first block transition is too late as the only moment: the users who finish
onboarding outnumber the users who train for two months many times over. A hard wall
at onboarding, as MacroFactor Workouts runs (§5.5), is wrong for Taurifer for structural
reasons: no brand to carry a refund rate, a creator channel that dies if a received program
hits a wall (§13.3), and an alpha that learns nothing if nobody trains. The answer separates
three things the competitor models blur.

**Present at day zero.** Advanced first-program generation is Pro's first job and it happens
at the end of onboarding, the largest-volume point in the funnel. The choice is real, not a
tease: *a baseline program, free* against *a program built around your schedule, equipment
and recovery, try it free*. Every lifter who finishes onboarding sees Pro.

**Try for the first program, not fourteen days.** A calendar trial expires before any
compounding value exists. A trial that runs for the lifter's first block ends when the
demonstrated value is largest: weeks of their own data, a profile, and a next program drawn
from it. Declared as a trial at enrolment, it does not trip the no-clawback rule (§8.1).

**Decide wherever the lifter first needs the coach.** In descending funnel volume: the end
of onboarding; the first weekly proposal in week two; the first skipped day or painful
exercise where adaptation would reshuffle the week; the block transition. Each is a thesis
Pro job already. The block transition is only where conversion is strongest, not where Pro
is first met.

**Price against the coach, not against apps.** Online coaching in Brazil costs several times
the recorded pair of R$24.90 a month and R$179.90 a year (thesis §9). The paywall copy says
what a coach does that Pro does, and what each costs.

**Put the wall after the hook, not before it.** The right position is where the retention
curve flattens, which is unknown until the alpha runs. Plan 071's onboarding funnel events
and `landing_action` exist to find it. The position is decided with alpha data, not by
analogy to apps with brands.

## 7. What gates this

- **Entitlement without accounts is unsolved** and decides what is possible. A trial that
  asks for a card at day zero needs a payment provider at day zero; Brazil means Pix as
  much as cards; app-store billing is not available to a PWA without wrapping it (thesis
  §4.4, §11.1). ADR 0010 requires term, expiry, restoration, refund handling and purchase
  reconciliation before any money changes hands. The owner decided (D-13) that a new ADR
  records this before any funnel work; nothing in §6 ships before it exists.
- **The alpha runs with everyone on Pro.** ADR 0010 sequences a noncommercial alpha before
  payment, and it is also the only way to learn whether the weekly review and the profile
  move day-thirty retention at all. If they do not, they deserve no paywall anywhere.
- **The documents.** §8 lists what this amends. None of it is agent-amendable.

## 8. What this amends, if approved

| Document | Change |
| --- | --- |
| `docs/business-product-thesis.md` §8.3 | Pro MVP gains the weekly review as the visible form of job 3; the profile across programs is named; the trial-as-first-program and the day-zero presentation are recorded |
| `docs/business-product-thesis.md` §8.4, ADR 0010 | Unchanged until the alpha decides D-10 and D-11; the entitlement ADR (D-13) is written first |
| `docs/adr/` | A new ADR for the entitlement lifecycle (D-13): provider, Pix and card, device-side token, restoration, refunds, reconciliation |
| `PRODUCT.md` | The coach-function frame is recorded as an engineering frame with the D-1 limits (subtle in marketing, never the selling point, CREF-registered professional before commercialization); the gauge is recorded as dissolved into the profile (D-6) |
| `plans/077-calibration-free-layer.md` | OD-12's calendar cadence becomes a ceiling under the estimator; OD-20's percentage is dissolved into the profile; OD-21 stays open, to be decided after the alpha |
| `app.js` `DEFAULTS` | `rirMode:"effort"`, `effortScale:"feel"` for new installs (existing installs keep their setting) |
| `plans/077-calibration-free-layer.md` OD-3, OD-4, OD-6 | Two stages instead of three: words and reps left (0–4, 5+ stored as 5); the B→C tip and `effortScale` are retired or kept for compatibility |
| `docs/progressive-overload-mechanics.md` §4 | The estimator, the standing words, and the declared priors table |
| `docs/backlog.md` | A Now row for session zero and the ladder default, Next rows for the estimator, the cadence and the profile, a Gated row for the funnel behind entitlement |
| `CONTEXT.md` | Terms: *session zero*, *standing* (of an estimate), *finding*, *profile*, *weekly review*; the coach is the human comparison only, never a product name |

## 9. Examined and rejected

Recorded so the next discussion does not start from zero.

- **"Declared versus demonstrated" as a seven-domain abstraction.** Only effort, the slow-rep
  tap and starting loads share the self-report-with-ground-truth structure. Step size and
  the fatigue profile are engine behaviour and belong in Why; schedule fit measures the
  person and crosses the brand line; deload need, rest from timestamps and time-of-day are
  contaminated or underpowered. Stacked corrections also break ADR 0003's single bounded
  adjustment.
- **The percentage gauge on the landing or in the hero.** A bar to fill, and a 45 % ceiling
  without test sets makes it one by construction.
- **Showing Free users what Pro would have proposed.** A fake door by another name.
- **A hard paywall at onboarding.** Converts near zero without a brand, kills the creator
  channel, and teaches nothing in the alpha.
- **A fourteen-day calendar trial.** Ends before the product's compounding value exists.
- **"Sob medida" as the Portuguese frame.** The most used phrase in Brazilian fitness
  marketing, and it implies tailored generation, which is Pro.

## 10. Owner decisions

Recorded 2026-11-08 from the owner's answers. "After the alpha" means the item stays open and
is decided from alpha evidence; agents treat it as undecided.

| # | Question | Decision |
| --- | --- | --- |
| D-1 | Is the coach-function framing the product's positioning? | **Adopted as an engineering frame only.** Not the thesis's core proposition, not the selling point; subtle in marketing. The subject is sensitive in Brazil; a CREF-registered physical education professional is required before commercialization. |
| D-2 | Does session zero replace the "pick a load" prompt for new programs without loads? | **Yes**, skippable; skipped by default when loads are known. |
| D-3 | Do words become the default stage for new installs? | **Yes, and onboarding asks once**, so a lifter who already counts reps left can start on the numeric stage. |
| D-4 | Does the engine become an estimator with uncertainty-driven test sets, keeping OD-12's safety rules as ceilings? | **Yes**, as `ENGINE_VERSION` 078.x with its own plan. |
| D-5 | Declared population priors for opening loads and new-lift ratios, published in the mechanics doc? | **Yes**, published and versioned. |
| D-6 | The gauge: dissolve into the profile, or keep the percentage? | **Dissolve.** The Today ring and the Progress percent go; counts and standing words replace them. |
| D-7 | Is any part of calibration a Pro lever (OD-21)? | **Open, after the alpha.** The alpha runs with every Pro feature on; the gate comes after, as ADR 0010 plans. |
| D-8 | The profile surface: Free for the current program, Pro across programs? | **All Free during the alpha; split decided after.** |
| D-9 | The weekly review: facts Free, proposals Pro, from week two? | **Facts and proposals both ship in the alpha; split decided after.** |
| D-10 | Pro presented at the end of onboarding as a real baseline-versus-advanced choice? | **After the alpha.** |
| D-11 | Is the trial the first program rather than a calendar period? | **After the alpha.** |
| D-12 | Does the alpha run with every participant on Pro, no payment? | **Yes** (ADR 0010 already says so; D-7 to D-9 restate it). |
| D-13 | Where and when is the entitlement-lifecycle decision recorded? | **A new ADR before any funnel work.** |
| D-14 | Does the landing wait for the alpha, or change additively now? | **Additive now, small**, with the coach comparison kept out of the copy (D-1). |
| D-15 | Do reps left and RIR merge into one numeric stage? | **Yes**: chips 0 · 1 · 2 · 3 · 4 · 5+, with 5+ stored as 5; RIR becomes a glossary word. |

## 11. Sequencing

The decided items, in the order they should be built. Each needs its own plan under
`plans/`, within the backlog's authority.

1. The owner amends, or instructs the amendment of, the documents in §8 for the decided
   items (D-1 to D-6, D-12 to D-15). The deferred items (D-7 to D-11) are recorded as open.
2. **Plan: the effort ladder** (D-3, D-15). Words by default with one onboarding question;
   two stages instead of three; `effortScale` retired or kept for compatibility; the B→C tip
   retired. Small, Free, before the alpha.
3. **Plan: session zero** (D-2, D-5). The guided first session, the declared priors table in
   the mechanics doc, the skip rules. Free, before the alpha.
4. **Plan: the estimator** (D-4). `ENGINE_VERSION` 078.x: per-lift estimate and uncertainty,
   standing words in the target and Why, uncertainty-driven test sets under OD-12's ceilings.
5. **Plan: the profile and the thirty-day cadence** (D-6, D-8). The gauge dissolved; the
   findings designed; everything Free in the alpha.
6. **Plan: the weekly review** (D-9). Facts and proposals, both on in the alpha; the
   proposal path reuses the within-block adaptation contract from thesis §8.3 job 3.
7. **The landing's additive change** (D-14), small, at any point after step 2 so the proof
   can show the words stage.
8. **The alpha** runs with steps 2 to 6 on for every participant. Its funnel and retention
   evidence decides D-7 to D-11.
9. **An ADR for the entitlement lifecycle** (D-13), then and only then the funnel work of §6
   as the alpha evidence shapes it.
