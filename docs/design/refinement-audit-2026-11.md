# Refinement audit of the main app (2026-11)

Front 1's whole-app audit for the owner's design refinement brief of 2026-11-01. It inspects the main journeys (Today,
the workout and Focus, Progress, History, Program, the exercise library, the session summary and Settings) and
lists the problems that, in my judgement, materially affect comprehension, workout execution or confidence. These go
beyond the brief's P1–P4. I also list every candidate I rejected, with its reason. Taurifer's own principles (DESIGN.md,
the brand guide, the native UI kit, the semantic contract, the interaction-runtime audit) win where a generic Enmera
rule conflicts with them.

**Method.**
- Read every catalog state of the eight journeys at 390 light EN. Re-checked the key states in dark, at 320 and in PT
  at 200% text.
- Rendered live full-page captures where the catalog frame is only viewport-tall (Settings, the exercise detail).
- Inspected the app's own data where a frame looked wrong (the exercise detail's recommendation).
- Ran the Enmera checker (`/tmp/ai-design-check`, no npm install) three ways:
  - on the source files it can read (`index.html`, `styles.css`, `motion-polish.css` and the two catalogs);
  - on the rendered DOM of 21 key states (the checker cannot read `app.js`, which renders the app);
  - in its `narrow` mode at 320 px on 12 of those states.

**Evidence.** Contact sheets, side-by-side frames, full-page captures and the checker output are in
`~/taurifer-design-refs/fidelity/refine-audit/`: `*-390.png`, `w1/p1/p2/h1/g1/d1/d2/n1/v1.png`, `sl-full.png`,
`enmera-before.json`, `enmera-dom.json` and `enmera-narrow.txt`.

Out of scope here (other fronts): P1 the Progress Review (front 2), P2 the Progress tab row and the share sheet
(front 3). P3, motion consistency, is front 1's and is in #599.

## Confirmed

Ranked by what each costs the lifter.

### A1 · High · The exercise detail shows an empty "Recommendation" for a Manual lift

**What.** For a lift on Manual progression, `recommendation()` returns `status: "manual"` with an empty `label` and
`text`. `renderExerciseDetail` (app.js, the `recblock` at "today.recommendation") still renders the block, so the
lifter sees a RECOMMENDATION heading over nothing, followed by "Understand RIR" and "Why this weight?" on the same line.
Verified in `library/exercise-detail` (Leg extension, `recblock is-manual`, empty `recblock__head` and
`recblock__body`).

**Impact.** The page promises advice it does not have, on the screen a lifter opens to understand a lift. Focus already
says the true thing for the same lift: "Your targets. This lift is set to Manual, so Taurifer doesn't suggest a
weight" (`focus.cue.your_targets`).

**Principles.** One true statement per screen; the explanation is anchored to its value; no empty containers.

**Direction.** Give the Manual case its words, the ones Focus uses. Keep "Why this weight?" (it explains Manual) and
"Understand RIR" as separate quiet links under it, not inline with an empty heading.

**Same screen.** The Progression chart plots one session on a y-axis stepped in 0.2 kg (59.8 to 60.3 kg). One point is
a statement, not a trend. With fewer than two sessions it should say so (the Records block below already lists the one
session) rather than draw an axis.

### A2 · High · Settings warns that data can be lost, and its remedy is 1,200 px away

**What.** The first thing in Settings, beside the app icon, reads "No backup exported yet. This browser may clear
Taurifer's data if space runs low. Export a backup regularly." There is no action with it. "Backup & export" is the
13th row, under Data & privacy, about 1,200 px down at 390 (`settings/main`, full-page capture `sl-full.png`).

**Impact.** Confidence, in a local-first app whose whole promise is "your data stays on this device". The warning
raises the risk at the moment it can be addressed, then makes the lifter hunt for the fix, or leaves it unfixed.

**Principles.** Local-first trust (AGENTS.md privacy and storage rules); every warning names its remedy; no new
destinations.

**Direction.** Put the remedy on the warning: a quiet "Back up now" action that opens the existing Backup & export
flow, shown only while no backup exists (`settings.storage.last_backup_never`). The copy stays the same.
Alternatives: move the Backup row up (that moves a whole group to fix one sentence), or a banner on Today (louder than
the risk warrants).

### A3 · High · The session summary prints three verdicts in one row, unlabelled

**What.** In the session summary and Today's done state, one exercise row can read `= Maintained` (top right),
`✓ PR +2.5 kg over your best` and `↑ Next: 105 kg × 6` (`session/summary`, `today/done`, light and dark). These three
signals answer three different questions: how today compared, whether a record fell, and what next time asks. The row
says none of that. "Maintained" next to a PR and an up arrow reads as a contradiction.

**Impact.** Comprehension of the most motivating moment in the app: what did I just achieve, and what does it mean for
next time.

**Principles.** Training-data hierarchy; a result carries its comparison; one status system.

**Coordination.** This is the same outcome vocabulary P1 is redesigning for the Progress Review. It should take P1's
answer, not invent a second one. I recommend front 2 owns it as P1's extension to the summary and Today's done list.

### A4 · Medium · Swap exercise puts an optional reason between the filter and the results

**What.** In the swap sheet the muscle filter (All · Chest · Back · Shoulders · Arms) and the optional "Why swap?"
reason (Equipment · Preference · Pain · Crowded · Other) are the same pill, one block over the other. The reason sits
between the filter and the list it filters (`workout/swap-alternates`, `workout/swap-reason`).

**Impact.** In the middle of a set the lifter's task is to find a replacement. A second row of identical pills reads
as more filters, pushes the alternates down, and breaks the search, filter, pick order. Enmera's selector-language rule
agrees, and so does the native kit's segmented and chip discipline.

**Direction.** Keep the reason, which feeds the swap telemetry Plan 071 §10 relies on, but take it out of the
filtering path. Two options:
- ask it after the pick, on the confirmation the swap already makes;
- or render it as a quiet single-line choice under the list.

Either way, keep the event payload. The first option asks only once there is something to explain.

### A5 · Medium · Progress Volume states each count three times

**What.** Each muscle row reads "Adductors · 0 / 7", then "0 of 7 sets toward the full period", then shows a bar of
the same share (`progress/volume`, `progress/volume-drill-in`). At the start of a week that is a column of identical
rows saying zero three ways.

**Impact.** Scanability. The muscles that need sets are the information, and the repetition buries them.

**Direction.** One numeral and the bar. Keep the sentence only where it adds something the numeral cannot ("No
compatible sets logged yet" already does this on one row). Consider ordering by the share still to do, not by name;
that needs a product call, since alphabetical is predictable.

### A6 · Medium · A per-side lift's chart says "per side" in every label

**What.** On a dumbbell lift's chart the qualifier is repeated:
- in the KPI labels ("best e1RM, kg · Load per side");
- in the caption ("Aug 30 · Best e1RM · Load per side 34.8 kg · 27.5 × 8 · Reps per side");
- in two of the table's column heads, which wrap to three uppercase lines ("TOP SET · LOAD PER SIDE · REPS PER SIDE",
  "E1RM · LOAD PER SIDE").

Seen in `progress/exercise-chart` at 390, and worse at 320 and at 200%.

**Impact.** Legibility of the numbers the chart exists to show.

**Direction.** Say "per side" once, where the scale is set (beside the Top load / Best e1RM control or in the chart's
title line), and drop it from the columns and the caption.

### A7 · Low · PRs list one set twice

**What.** One set that raised both the load record and the e1RM record shows as two rows: "Leg press · 42.5 kg × 6 ·
LOAD · +2.5 kg" and the same set again tagged E1RM (`progress/prs`).

**Impact.** The list reads twice as long as the lifter's achievements, and a quick scan double-counts.

**Direction.** One row per set, carrying both deltas. The Load / e1RM filters keep working on the row's tags.

### A8 · Low · Program overview shows each lift's progression method without saying what it is

**What.** Under every exercise in the Program ledger is "Rep range". That is the progression strategy's name
(`program.progression.strategy.range`), but nothing labels it as one, so beside "3 × 4–8" it reads as a repeated
caption for the range.

**Direction.** Name it once, for example in the column head or as "Progression: rep range". Or show the method only on
rows that differ from the program's usual one. Low priority: it is only noise until a program mixes methods.

## Rejected

| Candidate | Source | Why rejected |
| --- | --- | --- |
| Tracked uppercase labels (`no-decorative-uppercase`) | Enmera | Taurifer's ledger heads (SET · KG · REPS · RIR) and section labels are the identity: the ledger's printed column heads. DESIGN.md sets them as the `--font-size-label` uppercase tracked style |
| 11 px text at 320 (`no-shrunk-text`, ~70 findings) | Enmera narrow | The 11 px `--font-size-label` token: the ledger heads, section labels, chart ticks and dock labels (iOS tab bars use about 10 pt). Not shrunk to fit; set on purpose, and it scales with text size (verified at 200%) |
| "Text cut off at 320" (`text-not-clipped`: ", kg", "Exercise 1 of 5", "Hold load", "Back off"…) | Enmera narrow | Every one is a visually hidden accessible name (clipped by design for assistive technology), not visible text |
| `no-layout-animation` ×9 | Enmera | False positives: the checker's window runs into the next rule (`transition: transform` beside a rotate, `transition: none`, a background-colour transition) |
| `no-greeting-headline` | Enmera | False positive: the exercise "Barbell good morning" in the swap and library lists |
| Overshoot easing (`no-bounce-easing` ×5) | Enmera, P3 | Confirmed and fixed in #599. Momentum springs and `pressRelease` are kept |
| Glow (`glow-in-charts-only`) | Enmera | The rest light on the shelf's contour and the mini bar's line is the owner-approved rest-glow direction (2026-10-28): light that carries the clock, not decoration |
| A second accent (`one-accent`) | Enmera | The green on PRs and improvements is the established status system, not a brand accent. Orange stays inside its budget |
| Side stripe (`no-side-stripe`) on the recommendation and evidence rail | Enmera | The accent rail on a change statement is a settled decision (Q637). A1 changes the block's content, not its rail |
| Placeholder glyph tiles in the library list | Visual review | Rows keep one rhythm whatever art exists. More art is an asset pipeline, not a design refinement; the detail page already renders nothing without art |
| Focus at 320 × 568 cuts the first ledger row under the shelf | Visual review | Intentional and tested (#523, #541, focus-geometry): at the first set the shelf already shows that set, so the card opens on the prescription |
| "Out of time" preselected when ending without saving | Visual review | The catalog scenario taps it; the app starts with no reason |
| Today in PT shows "Barbell deadlift" in English | Visual review | A fixture artefact: the catalog lifter's deadlift has a made-up library id, so no PT name resolves |
| The bright illustration plate in dark mode | Visual review | Deliberate: licensed art is painted on its own paper, so in dark it is an archival plate (`.exdet-art`) |
| The schedule diagnosis's day counts in Mono | Visual review | Counts in the training-data face are the convention. Restyling would be cosmetic |
| "From Aug 31 to Aug 31" on an active block's review | Visual review | True for a block that started that day. The review is read-only until the block ends |
| Progress tabs clipped at 390 | Brief, P2 | Front 3 |
| Share sheet's long URL | Brief, P2 | Front 3 |
| Progress Review hierarchy | Brief, P1 | Front 2 (A3 should follow its vocabulary) |

## Physical device or owner judgement

- A3's vocabulary follows P1's; the owner should see both together.
- A4: ask the reason after the pick, or as a quiet line under the list. Both keep the telemetry; the first changes
  when the question is asked, and that is the owner's call.
- A5's ordering by need, not by name: this changes what is predictable, so it is a product call.
