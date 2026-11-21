# Synthetic review panel: consolidated results and proposed actions

Date: 2026-11-21. Data: `reviews.csv` in this folder. Method notes: `README.md`.

This report proposes actions. It does not change `docs/backlog.md`, which stays
the only queue; each proposal names the backlog item it would touch.

## How to read this

- 200 LLM respondents, 10 per audience, each primed with one persona and shown
  the concept text plus 12 catalog screens.
- Answers inside an audience were close to identical. Read the results as 20
  audience reactions, not 200 independent people.
- There is no human baseline. Every number is a hypothesis for the alpha.
- The stimulus did not include the effort-choice onboarding, the first-set
  guide or the landing FAQ. Some of the confusion about "reps left" may be
  answered by screens the panel never saw.
- The semantic-similarity rating was not useful in this run (scores bunched
  near the midpoint). The figures below use the direct 1-5 ratings.

## Headline numbers

| Question | 1 | 2 | 3 | 4 | 5 | Mean |
| --- | --- | --- | --- | --- | --- | --- |
| Start using Taurifer | 5 | 98 | 57 | 40 | 0 | 2.66 |
| Pay for Pro at R$24.90/month | 137 | 55 | 7 | 1 | 0 | 1.36 |

Asked what they would actually do next month, 55 said they would try Taurifer
(most of them alongside their current tool) and 145 said they would stay put.

## Results by audience

Intent and pay are means on the 1-5 scale, 10 respondents each.

| Audience | Intent | Pay | Dominant blocker | Dominant ask |
| --- | --- | --- | --- | --- |
| International: privacy / local-first | 3.8 | 2.0 | Browser storage as the only copy | Scheduled export to storage they control |
| Brazil: shared-link recipient | 3.3 | 1.3 | Jargon, English exercise names | Plain "reps left" explanation, full PT |
| Brazil: self-directed lifter (core) | 3.2 | 1.6 | Data loss, no store listing | Automatic backup |
| Brazil: time-poor professional | 3.2 | 1.7 | Data loss, no store listing | Automatic backup |
| Brazil: low-income student | 3.1 | 1.1 | Data loss, no store listing | Automatic backup |
| International: home gym | 3.1 | 1.6 | Kilograms only, fixed jumps | Pounds and own plate set |
| Brazil: spreadsheet user | 3.0 | 1.5 | Starts from zero | CSV history import |
| International: paid evidence-based | 2.8 | 2.2 | Load-only progression | Weekly set volume that adjusts |
| Brazil: beginner | 2.7 | 1.3 | Jargon, no form guidance | Plain mode, a picture per exercise |
| Brazil: advanced evidence-based | 2.6 | 1.2 | Starts from zero | History import |
| Brazil: women, lower-body focus | 2.6 | 1.3 | Dense logging screen | Ready glute program, less text |
| Mixed: lapsed gym-goer | 2.5 | 1.1 | Nothing helps them show up | Reminders, a consistency cue |
| Brazil: coach | 2.4 | 1.2 | Cannot see client logs | Client opt-in to send logs back |
| Mixed: accessibility needs | 2.4 | 1.4 | Small text, unproven screen reader | Large-text and screen-reader proof |
| Brazil: uses a free tracker app | 2.3 | 1.2 | Months of history elsewhere | History import |
| Brazil: pays an online coach | 2.1 | 1.2 | Coach's app is mandatory | Coach can send program and see logs |
| Brazil: older adult | 2.1 | 1.1 | Reads as a bodybuilder's tool | Plain health-focused mode |
| International: pays for a tracker | 2.1 | 1.1 | Years of history, Apple Watch | History import, watch logging |
| International: casual app user | 2.1 | 1.1 | No videos, no cardio, no streaks | Video per exercise |
| International: powerlifter | 1.8 | 1.0 | No percentage or peaking programs | Out of declared scope |

## Themes

"Raised by" counts respondents who mentioned the theme anywhere. "Top ask"
counts those who named it as the single change that would most raise their
likelihood of using the app.

| Theme | Raised by | Top ask |
| --- | --- | --- |
| Automatic backup; data lives only on the phone | 189 | 66 |
| Not in Play Store / App Store | 188 | 27 |
| Import history from Hevy, Strong, Jefit, CSV | 65 | 53 |
| "Reps left" / RIR not explained | 189 | 23 |
| No videos; most exercises have no picture | 138 | 26 |
| Beginner or plain-language mode | 24 | 17 |
| Coach can see client logs | 21 | 15 |
| Paste or photograph the program I already have | 33 | 10 |
| Percentage and peaking programs | 11 | 10 |
| Weekly set volume that adjusts | 12 | 7 |
| Reminders, streaks, consistency cue | n/a | 7 |
| Pounds, own plates, own jumps | 13 | 6 |
| Large text, contrast, screen reader | 12 | 6 |
| Apple Watch / Apple Health | 19 | 6 |

What respondents liked: the written reason behind each target (124), free
(121), no account (118), Portuguese (102), being told the next target (101),
and the absence of gamification (85).

Items listed as confusing: "reps left" / "sobrando" / RIR (138), the
"Adaptive" label in the exercise header (125), "Still learning this lift"
(47), the profile ring (44), "Day 2 · mixed" (37), estimated one-rep strength
(24).

## Verified against the source

- `why.engine.anchor_history` (EN and PT) renders "over the last 1 sessions" /
  "nas últimas 1 sessões" when `n` is 1. Real copy defect.
- `why.performed` and `why.set1` say "RIR" while the logging screen says "reps
  left" / "sobrando". Two words for one quantity on adjacent surfaces.
- The Portuguese catalog frames show "Barbell deadlift", "Calf press on leg
  press", "Full body" and "Day 2 · mixed". The names come from the catalog
  fixture, so this is the already-known #315 (Portuguese exercise names) and
  the "PT default day labels" item, seen through a first-time reader's eyes.

## Proposed actions, in priority order

Ranking rule: reach among the audiences that were already closest to adopting
(core lifter, shared-link recipient, time-poor professional, student), then
severity as a blocker, then fit with the Phase 1 constraints, then cost.

### 1. Do before the alpha (small, inside current authority)

| # | Action | Evidence | Backlog relation |
| --- | --- | --- | --- |
| 1 | Fix the "last 1 sessions" plural in both catalogs | Verified defect | New small fix |
| 2 | Use one term for effort on the Why sheet and the logging screen | 138 confused; verified mismatch | New copy change, PT first |
| 3 | Confirm the first-set guide and effort-choice step explain "reps left" with an example at the moment of the first log; close the gap if not | 138 confused, 23 top asks; panel did not see these screens | Fits "Contextual guides" only with a reproduced problem, so check in the real-phone pass first |
| 4 | Explain or remove the "Adaptive" header label; give "Still learning this lift" and the profile ring a one-line meaning where they first appear | 125, 47 and 44 confused | New copy change |
| 5 | Finish Portuguese exercise names and decide PT default day labels | 76 noticed English in PT screens, including the core audience | #315 (waiting on owner); "PT default day labels" (Later) |

### 2. Decide before the alpha opens (owner decisions, each cheap to prototype)

| # | Action | Evidence | Backlog relation |
| --- | --- | --- | --- |
| 6 | Backup the lifter does not have to remember: a scheduled or after-session export to a location they choose, and a plain statement on the landing of where data lives and how it is kept safe | 189 raised, 66 top asks, first ask of every receptive audience | Promote "Backup reminder" from Later; stays within "no cloud sync shortcut" |
| 7 | Answer "why is this not in the store" on the landing and make install two visible steps; separately decide whether a store-listed wrapper of the same web core is in or out of Phase 1 | 188 raised, 27 top asks | Wrapper touches "Native shell" (gated); landing copy does not |
| 8 | Give "Track my current program" equal weight on the landing and show paste-from-notes working in under a minute | Core audience already has a program; 10 top asks; the feature exists | Landing copy and proof band |

### 3. Confirm ordering after the alpha

| # | Action | Evidence | Backlog relation |
| --- | --- | --- | --- |
| 9 | Keep history import first in Next, with generic CSV in the first slice | 53 top asks; the gate for every audience that already tracks | Already top of "After alpha (Next)" |
| 10 | Lifter-initiated "send my block summary to my coach" as a file or text share | All 10 coaches and 8 of 10 coached lifters; the creator channel in the thesis depends on coaches | New proposal; keeps the one-way, user-initiated privacy model |
| 11 | Exercise guidance for the 174 movements without a picture: decide between more illustrations, a short text cue, or nothing | 138 raised, 26 top asks, concentrated in beginners and casual users | "Exercise illustration style" (Later) |
| 12 | Pound display and own plate set | Home-gym audience only (6 top asks) | "Pound display" (Later); stays evidence-only for the beachhead |

### 4. Inputs to the Pro proposition (no build)

- Pro read as vague and unbuilt: 137 of 200 answered "definitely not".
- The only audience above 2.0 on paying was the one already paying for
  auto-progression apps, and it asked for weekly set volume that adjusts with
  recovery, not for program generation.
- Audiences that already own a program saw no value in "builds a program for
  you", which is two of the three Pro jobs as described.

### 5. Leave alone

- Streaks, badges and reminders: asked for by the lapsed audience only (7 top
  asks), while 85 respondents named the absence of gamification as a reason to
  like the app. The ban holds.
- Percentage and peaking programs, cardio, Apple Watch, open-sourcing: each
  came from one audience outside the declared scope.

## What the alpha should confirm or kill

1. Do real first-time lifters understand "reps left" after the existing guide?
2. Does anyone actually lose data, or decline to start because they fear to?
3. Does the missing store listing stop installs once someone has the link?
4. Do participants with history elsewhere refuse to start without import?
