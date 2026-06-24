# RepForge concepts, mechanics, and hypertrophy literature review

Date: 2026-06-17

## Executive summary

RepForge is a local-only, offline-capable progressive overload logbook for machine-based bodybuilding. Its core mechanic is conservative double progression: keep the load until every set reaches the top of the target rep range, then add load; if a set falls below the bottom of the range, flag the lift as needing a hold or trim. The app layers this with per-set RIR logging, a heat metaphor for overload readiness, a top-load chart, a tonnage/e1RM stats dashboard, a JSON program editor, and a simple weekly muscle set audit.

The concept is directionally sound. Double progression, hard sets, per-muscle volume accounting, and RIR are all useful abstractions for hypertrophy-focused resistance training. The biggest gap is that the current app logs a few key variables but does not yet turn them into the scientific quantities most relevant to hypertrophy: hard sets per muscle per week, actual frequency, proximity-to-failure trends, recovery/fatigue signals, and exercise continuity across program edits. The current implementation is best described as a deterministic overload tracker, not a full hypertrophy programming assistant.

Top improvement opportunities:

1. Replace the static "weekly volume audit" with logged hard-set volume per muscle over rolling 7-, 14-, and 28-day windows.
2. Use RIR throughout the recommendation engine, not only for the aggressive load-jump branch.
3. Track actual training frequency and adherence, because frequency is mainly useful as a way to distribute recoverable weekly volume.
4. Add deload and fatigue heuristics based on stalled performance, falling reps at stable loads, and consistently high effort.
5. Store stable exercise identifiers in log rows so renamed exercises preserve progression history.
6. Support skipped, added, and partial-session logging instead of saving every programmed set with default values.
7. Make the progression and stats metrics internally consistent: median load, top load, volume load, and e1RM currently answer different questions.

## Scope and evidence standard

This report reviews two bodies of evidence:

- The app's implemented mechanics, as observed in `README.md`, `index.html`, `app.js`, `styles.css`, `sw.js`, and `manifest.webmanifest`.
- Scientific and coaching literature on hypertrophy and resistance training variables, prioritizing position stands, umbrella reviews, systematic reviews, and meta-analyses.

This is product and programming analysis, not individualized medical advice. Users with injuries, medical constraints, or competitive goals need individualized coaching and clinical guidance.

## Current app model

### Product model

RepForge is intentionally simple:

- Static PWA, no backend, no build step, no dependencies.
- All user data stays in browser `localStorage`.
- Default program is a machine-only three-day split.
- Primary workflow is logging load, reps, and RIR for each working set.
- The app recommends whether to add load, hold load, or back off based on the last session for each exercise.

This local-first design is a strong privacy and resilience choice for a training log. It also means the app has no cloud identity, server-side analytics, coach sharing, or cross-device sync unless a user exports/imports JSON.

### Stored data

The app stores two browser keys:

- `repforge_v1`: settings, program, and log rows.
- `repforge_draft_v1`: in-progress workout input values.

The main state shape is:

- `settings.jumpPct`: default 2.5, used as a percentage load jump.
- `settings.minJump`: default 2.5 kg, used as both the minimum load jump and load rounding increment.
- `settings.rirHigh`: default 2, displayed as the target RIR ceiling.
- `program`: array of exercises.
- `log`: array of set rows.

Each exercise has:

- `id`
- `day`
- `order`
- `name`
- `sets`
- `min`
- `max`
- `primary`
- `secondary`

Each logged set has:

- `session`
- `date`
- `day`
- `name`
- `set`
- `load`
- `reps`
- `rir`
- `notes`
- `created`

Important design implication: progression history is keyed by exercise `name`, not exercise `id`. This keeps JSON editing simple, but renaming an exercise breaks the continuity of historical recommendations.

### Default program

The default program is a three-day, six-exercise split. Most lifts are 2 sets of 4-8 reps, while several isolation exercises are 2 sets of 6-8 reps.

Approximate template volume, using the app's direct-set + 0.5 secondary-set method:

| Muscle | Effective sets |
| --- | ---: |
| Quads | 6 |
| Hamstrings | 6 |
| Chest | 6 |
| Mid/upper back | 6 |
| Lats | 5 |
| Biceps | 5 |
| Triceps | 5 |
| Glutes | 4 |
| Adductors | 4 |
| Front delts | 4 |
| Rear delts | 4 |
| Side delts | 3 |
| Spinal erectors | 1 |

The template is conservative. It may be appropriate for a minimalist beginner/intermediate routine or for low-recovery phases, but it is below the commonly cited 10+ direct or effective hard sets per muscle per week threshold for maximizing hypertrophy in many muscles.

## Implemented training mechanics

### Double progression

The core recommendation engine uses the most recent session for the exercise name:

1. If no history exists, prompt the user to choose a load they can perform in the rep range at target RIR.
2. Compute the median load across sets from the last session.
3. Compute the minimum reps across sets.
4. Compute average RIR across sets.
5. If all sets hit the top of the rep range and average RIR is at least `rirHigh + 1`, recommend a double jump.
6. If all sets hit the top of the rep range, recommend a normal jump.
7. If any set falls below the bottom of the range, flag back-off.
8. Otherwise, hold the load and chase reps.

Load jumps are:

- Normal jump: `max(load * jumpPct / 100, minJump)`, rounded to `minJump`.
- Bold jump: double the percentage component, still bounded by `minJump`.

Strengths:

- Easy to understand.
- Works well with stable machine exercises.
- Avoids premature load increases when later sets lag.
- Supports microloading through configurable increments.

Limitations:

- One underperforming set can block progression even when the broader signal is positive.
- RIR only changes the jump size; it does not meaningfully affect hold/reduce decisions.
- The `reduce` recommendation returns the same median load rather than an actual reduced target.
- Median load is used for progression, but top load is used for charts and top-load rankings.
- Missing values become zeros on save, which can create misleading progression history.

### RIR and effort

The app logs RIR per set and displays a target band from 0 to `rirHigh`, default 0-2. This aligns with common hypertrophy practice: sets should usually be hard enough to recruit high-threshold motor units without requiring failure on every set.

Current gap: RIR is stored but underused. The app can identify a "topped the range with reps in reserve" scenario, but it cannot yet identify:

- Chronic overshooting, such as repeated 0 RIR sets with falling reps.
- Chronic undershooting, such as 4+ RIR sets that are probably too easy.
- Set-to-set fatigue patterns, such as a large rep drop at the same load.
- Session readiness changes, such as unexpectedly high RIR at a familiar load.

### Volume

The app currently has two volume concepts:

- Logged tonnage: sum of `load * reps`.
- Template set audit: direct sets plus 0.5 secondary sets per muscle.

Both are useful but incomplete for hypertrophy. The literature and coaching practice usually discuss hard sets per muscle per week, with sets counted only when sufficiently close to failure and performed through an appropriate range of motion. Tonnage can be informative for workload trends, but it does not map cleanly to hypertrophic stimulus across exercises, rep ranges, and machines.

The "weekly volume audit" is not actually weekly in the calendar sense. It audits the static program template and assumes each listed day is performed once per week.

### Stats and charts

The stats dashboard shows:

- Session count.
- Set count.
- Total tonnage.
- Best Epley estimated 1RM.
- Top-load trend per exercise.
- Recent performance table.
- All-time top loads.

This is useful as a logbook view, but it emphasizes heaviest load more than hypertrophy-specific signals. For bodybuilding, a better dashboard would elevate:

- Hard sets per muscle per rolling week.
- Sets by RIR bucket.
- Rep-range performance at a stable load.
- Volume adherence versus planned volume.
- Muscle frequency.
- Stalled muscles and lifts.

### Program editor

The JSON editor is powerful for technical users and preserves the static-site philosophy. It also creates sharp edges:

- Program edits regenerate exercise IDs.
- Exercise renames sever history because logs store names, not stable IDs.
- There is no exercise taxonomy beyond free-text primary/secondary muscles.
- There is no validation for rep ranges, set counts, duplicate names, or missing muscle tags.

### Offline PWA mechanics

The service worker caches core files and font assets. The repo includes a `fonts/` directory, so the service worker's font cache list is conceptually aligned with the current assets. Service worker caching means app changes require hard reloads or cache invalidation during testing.

## Literature review and product implications

### 1. Progressive overload is necessary, but not identical to adding load every session

The app's thesis is progressive overload. The ACSM 2009 position stand recommends progressive manipulation of load, volume, frequency, rest, and exercise selection, and notes that a 2-10% load increase can be appropriate when a trainee exceeds the desired repetition target. That maps well to RepForge's percentage-plus-minimum jump model.

However, overload is broader than load. For hypertrophy, useful progression can include:

- More reps at the same load.
- More hard sets for a muscle.
- Better technique or range of motion.
- Better proximity to failure control.
- Shorter or more consistent rest only when it does not compromise output.
- More recoverable weekly volume.

Product implication: keep load recommendations, but add "progression lanes" so the app can recommend adding reps, adding sets, holding for recovery, or deloading instead of treating load as the main outcome.

Key source:

- American College of Sports Medicine. "Progression models in resistance training for healthy adults." Medicine and Science in Sports and Exercise, 2009. PMID: 19204579. https://pubmed.ncbi.nlm.nih.gov/19204579/

### 2. Weekly hard-set volume is one of the strongest product opportunities

Schoenfeld, Ogborn, and Krieger found a graded dose-response relationship between weekly resistance training volume and hypertrophy, with the highest category, 10+ weekly sets per muscle, producing greater gains than lower-volume categories. A 2022 umbrella review similarly concluded that at least 10 weekly sets per muscle group is a useful target for optimizing hypertrophy.

RepForge already has muscle tags and set counts, so it is close to being able to answer the most important programming question: "Which muscles have received enough hard work recently?"

Current mismatch:

- The app audits planned template sets, not completed hard sets.
- It counts secondary muscles as 0.5 sets, which is reasonable as a first approximation, but it does not use RIR to exclude easy sets or poor data.
- It has no concept of rolling weeks, missed sessions, or actual frequency.

Recommended product behavior:

- Compute hard sets per muscle over rolling 7-, 14-, and 28-day windows.
- Count a logged set as "hard" when load and reps are valid and RIR is within a configurable range, such as 0-4.
- Show planned versus completed sets by muscle.
- Preserve the existing template audit as "planned weekly volume."
- Add a warning when a muscle is chronically below target or escalating too quickly.

Key sources:

- Schoenfeld BJ, Ogborn D, Krieger JW. "Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis." Journal of Sports Sciences, 2017. PMID: 27433992. https://pubmed.ncbi.nlm.nih.gov/27433992/
- Cuthbert M, et al. "Resistance Training Variables for Optimization of Muscle Hypertrophy: An Umbrella Review." Frontiers in Sports and Active Living, 2022. PMID: 35873210. https://pubmed.ncbi.nlm.nih.gov/35873210/
- Baz-Valle E, Fontes-Villalba M, Santos-Concejero J. "Total Number of Sets as a Training Volume Quantification Method for Muscle Hypertrophy: A Systematic Review." Journal of Strength and Conditioning Research, 2021. https://doi.org/10.1519/JSC.0000000000002776

### 3. Load range is flexible for hypertrophy, but strength tracking still matters

Schoenfeld et al. found that hypertrophy can be achieved across a wide spectrum of loads when sets are taken to failure, while heavier loads are superior for 1RM strength gains. Later network meta-analysis work similarly supports load-independent hypertrophy across low, moderate, and high loads when effort is high enough, with heavier and moderate loads favoring strength.

RepForge's default 4-8 and 6-8 rep ranges are within a productive hypertrophy range, especially for machines where technique is stable and loading is simple. They are also heavier than many bodybuilding programs use for isolations, where 8-15 or 10-20 reps may be more joint-friendly and easier to judge.

Product implications:

- Keep flexible rep ranges per exercise.
- Add exercise-level range presets such as strength-biased, hypertrophy-standard, joint-friendly, and metabolite/isolation.
- Do not imply that the only valid hypertrophy range is 4-8.
- Keep e1RM as a strength-adjacent metric, but separate it from hypertrophy readiness.

Key sources:

- Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. "Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis." Journal of Strength and Conditioning Research, 2017. PMID: 28834797. https://pubmed.ncbi.nlm.nih.gov/28834797/
- Carvalho L, Junior RM, Barreira J, Schoenfeld BJ, Orazem J, Barroso R. "Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis." Medicine and Science in Sports and Exercise, 2021. https://doi.org/10.1249/MSS.0000000000002585

### 4. Proximity to failure matters, but failure is not mandatory

Refalo et al. found no clear evidence that momentary muscular failure is superior to non-failure training for hypertrophy, while broader proximity-to-failure literature suggests that training closer to failure tends to support hypertrophy, with important uncertainty and non-linearity. In practice, many lifters can grow well with most sets around 0-3 RIR and some sets farther from failure when volume, exercise, and recovery are managed.

RepForge's target of 0-2 RIR is a strong default for a hypertrophy app. The issue is not the target; the issue is that the target is not yet deeply integrated.

Recommended product behavior:

- Show RIR distribution by exercise and muscle.
- Flag sets that are too easy to count as hard hypertrophy volume.
- Flag repeated 0 RIR grinding when performance is dropping.
- Consider first-set RIR separately from later-set RIR because later sets are affected by accumulated fatigue.
- Add optional RPE display for users familiar with RPE: approximate `RPE = 10 - RIR`.

Key sources:

- Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. "Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis." Sports Medicine, 2022. PMID: 36334240. https://pubmed.ncbi.nlm.nih.gov/36334240/
- Robinson ZP, Pelland JC, Remmert JF, et al. "Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions." Sports Medicine, 2024. https://doi.org/10.1007/s40279-024-02069-2

### 5. Frequency mainly distributes volume and recovery

The 2016 Schoenfeld frequency meta-analysis suggested a benefit to training muscles at least twice per week. The 2019 update found that when volume is equated, frequency does not significantly or meaningfully affect hypertrophy. This points to a practical interpretation: frequency is not magic by itself, but it helps distribute enough high-quality weekly sets without cramming too much fatigue into one session.

RepForge's default split has overlapping muscle exposure across three days, but the app does not calculate actual frequency from logs.

Recommended product behavior:

- Track muscle exposures per rolling 7 days.
- Pair frequency with hard-set volume, not as a standalone score.
- Flag muscles with high volume concentrated in one session if performance drops sharply.
- Show planned frequency versus completed frequency.

Key sources:

- Schoenfeld BJ, Ogborn D, Krieger JW. "Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis." Sports Medicine, 2016. PMID: 27102172. https://pubmed.ncbi.nlm.nih.gov/27102172/
- Schoenfeld BJ, Grgic J, Krieger J. "How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis." Journal of Sports Sciences, 2019. PMID: 30558493. https://pubmed.ncbi.nlm.nih.gov/30558493/

### 6. Rest intervals are secondary, but they affect performance quality

A 2024 Bayesian meta-analysis found substantial overlap in hypertrophy outcomes across rest interval durations, with a possible small benefit for rest intervals above 60 seconds and no clear additional hypertrophy difference above 90 seconds. Longer rests can preserve volume load and performance, especially on demanding exercises.

RepForge does not track rest. That is acceptable for an intentionally simple app, but rest consistency would make performance comparisons cleaner.

Recommended product behavior:

- Optional rest timer per exercise.
- Optional "rest was short/normal/long" marker rather than mandatory precise timing.
- Interpret unexpected rep drops in light of short rest when the user tracks it.

Key source:

- Singer A, et al. "Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy." Frontiers in Sports and Active Living, 2024. PMID: 39205815. https://pubmed.ncbi.nlm.nih.gov/39205815/

### 7. Exercise selection and range of motion should become first-class program metadata

Recent reviews suggest full or long range of motion tends to be at least slightly favorable for hypertrophy, and training at longer muscle lengths may be especially useful. This does not mean every set needs maximal stretch under all circumstances, but it does mean exercise execution matters.

RepForge currently records exercise names and muscle tags only. For machines, this is a missed opportunity because setup details strongly affect stimulus:

- Seat height.
- Pad alignment.
- Handle choice.
- Foot placement.
- Range of motion target.
- Tempo or pause.
- Lengthened emphasis.

Recommended product behavior:

- Add optional per-exercise setup notes that persist with the exercise.
- Add ROM/execution cues to program entries.
- Add a "same setup?" checkbox or note prompt when performance changes unexpectedly.
- Add exercise tags such as lengthened-biased, shortened-biased, compound, isolation, machine, cable, unilateral.

Key sources:

- Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J. "Partial vs full range of motion resistance training: A systematic review and meta-analysis." International Journal of Strength and Conditioning, 2023. https://doi.org/10.47206/ijsc.v3i1.182
- Pedrosa GF, et al. "Muscle hypertrophy from partial repetition at long vs. short muscle length: A systematic review and meta-analysis." Sport Sciences for Health, 2025. https://doi.org/10.1007/s11332-025-01586-5

### 8. Deloading is common practice, but should be data-informed

The deload literature is less mature than volume or load literature, but recent consensus and survey work defines deloading as a planned or reactive reduction in training demand to manage fatigue, improve recovery, and prepare for the next training cycle. Coaches commonly reduce volume, relative load, or intensity of effort, often for about a week, but there is no single evidence-proven deload recipe.

RepForge has no fatigue model. That is a natural next step because the app already tracks performance and RIR.

Recommended product behavior:

- Add a "fatigue watch" signal when multiple lifts in a session fall below minimum reps at normal loads.
- Add a "deload suggested" signal when a muscle or lift has repeated regressions over several exposures.
- Offer deload templates: reduce sets, reduce load, increase RIR target, or skip isolations.
- Avoid rigid calendar deloads as the only option; make reactive deloads possible.

Key sources:

- Bell L, Ruddock A, Maden-Wilkinson T, Rogerson D. "Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach." Sports Medicine - Open, 2023. https://doi.org/10.1186/s40798-023-00633-0
- Bell L, Ruddock A, Maden-Wilkinson T, Rogerson D. "You can't shoot another bullet until you've reloaded the gun: Coaches' perceptions, practices and experiences of deloading in strength and physique sports." Frontiers in Sports and Active Living, 2022. https://doi.org/10.3389/fspor.2022.1073223

### 9. Autoregulation should be practical and modest

Autoregulation adjusts load or volume based on performance, fatigue, and readiness. Reviews suggest autoregulated methods are plausible and useful, but not universally superior to standardized prescription. For RepForge, this argues for pragmatic rules rather than complex readiness scoring.

Current app behavior is partly autoregulated: it responds to reps and RIR from the last session. But it is not truly daily-autoregulated because current-session inputs do not update recommendations until after saving.

Recommended product behavior:

- Add live per-set feedback during logging, such as "next set hold," "next set reduce," or "stop after this set."
- Use RIR and rep drop to suggest whether to perform optional extra sets.
- Show "today is off" when several exercises underperform relative to recent baselines.
- Keep user control; recommendations should explain the signal and allow override.

Key sources:

- Thompson SW, Rogerson D, Ruddock A, Barnes A. "The Effect of Load and Volume Autoregulation on Muscular Strength and Hypertrophy: A Systematic Review and Meta-Analysis." Sports Medicine - Open, 2022. https://doi.org/10.1186/s40798-021-00404-9
- Greig L, Hemingway BHS, Aspe RR, Cooper K, Comfort P, Swinton PA. "Autoregulation in Resistance Training: Addressing the Inconsistencies." Sports Medicine, 2020. PMID: 32813181. https://pubmed.ncbi.nlm.nih.gov/32813181/

## Improvement roadmap

### Priority 1: Data correctness and logging flexibility

Why it matters: all scientific recommendations depend on trustworthy logs.

Recommendations:

- Validate that saved sets have meaningful load and reps.
- Let users skip an exercise or set without saving zeros.
- Let users add unplanned sets or exercises.
- Preserve per-exercise stable IDs in log rows.
- Keep historical name snapshots for display.
- Add migration handling from name-keyed logs to ID-aware logs.

Expected benefit:

- Cleaner progression signals.
- Better hard-set volume calculations.
- Less accidental pollution from default input values.

### Priority 2: Logged hard-set volume

Why it matters: weekly hard sets per muscle are more hypertrophy-relevant than lifetime tonnage or static template volume.

Recommendations:

- Add a volume dashboard with muscles as rows.
- Show planned sets, completed hard sets, and completion percentage.
- Use direct/secondary weighting, but let the weighting be configurable later.
- Count sets by RIR bucket: 0-1, 2-3, 4+, unknown.
- Add rolling 7-day and 28-day views.

Suggested first rule:

- Valid hard set = load > 0, reps > 0, and RIR <= 4.
- Direct muscle credit = 1 set.
- Secondary muscle credit = 0.5 set.

### Priority 3: RIR-aware progression

Why it matters: the app asks for RIR, so recommendations should use it.

Current logic:

- High reps plus high RIR can trigger a larger jump.
- Low reps trigger back-off regardless of RIR.
- RIR does not identify too-easy or too-hard training outside the bold-jump branch.

Suggested logic:

- Add load: all or most sets reach the upper rep target and average RIR is within or above target.
- Add reps: load is stable, reps are below top target, and RIR is not too low.
- Hold: performance is improving but not enough to load.
- Reduce load: reps fall below range while RIR is 0-1, or multiple recent sessions regress.
- Increase effort: reps are in range but RIR is too high for multiple sessions.
- Deload/watch: several exercises regress in the same session.

### Priority 4: Frequency and adherence

Why it matters: frequency helps users distribute recoverable volume.

Recommendations:

- Show muscle exposures per rolling 7 days.
- Show planned versus completed days.
- Track missed sessions without punishing users.
- Let users reschedule days instead of assuming Day 1/Day 2/Day 3 map to calendar weeks.

### Priority 5: Fatigue and deload heuristics

Why it matters: progressive overload fails when fatigue masks performance or users chase load through poor recovery.

Signals the app can compute now:

- Repeated below-minimum sets.
- Repeated 0 RIR across several sessions.
- Falling reps at the same load.
- Falling estimated 1RM across multiple exposures.
- More exercises than usual marked reduce in one session.

Suggested outputs:

- "Watch fatigue."
- "Hold volume this week."
- "Consider reducing sets for this muscle."
- "Deload suggested: reduce sets by 30-50% and keep 2-4 RIR."

### Priority 6: Exercise metadata and setup consistency

Why it matters: a machine-only bodybuilding app can win by making execution repeatable.

Recommendations:

- Add persistent setup notes per exercise.
- Add machine number, seat, pad, handle, stance, and ROM notes.
- Add tags for lengthened emphasis and unilateral work.
- Display setup notes on the Log tab.
- Include execution consistency prompts when performance changes sharply.

### Priority 7: Better analytics hierarchy

Why it matters: current stats are useful but not aligned with bodybuilding decisions.

Recommended hierarchy:

1. Today's recommendations.
2. Hard sets by muscle this week.
3. Exercise progression within rep range.
4. RIR distribution.
5. Estimated strength and top-load trends.
6. Tonnage as secondary workload context.

## Specific UX and copy improvements

### Clarify "heat"

Current concept: heat means ready to add load.

Risk: users may interpret heat as global readiness or recovery.

Suggested copy:

- "Heat = this lift is ready for overload based on your last logged session."
- "Forge = no lifts currently ready for load increases."
- "Cool = performance fell below the target range; hold or trim load."

### Rename "weekly volume audit"

Current label implies calendar-based completed work.

Better labels:

- "Planned weekly volume" for the current static audit.
- "Completed hard sets" for the future log-derived view.

### Explain RIR ceiling and bold jumps

Current target is RIR 0-2, but bold jump requires average RIR >= 3 when the ceiling is 2. That is logical, but needs clearer copy.

Suggested copy:

- "Target: finish most sets with 0-2 reps in reserve."
- "If you top the range with more than the target RIR, RepForge may suggest a larger jump."

### Make "Back off" actionable

Current `reduce` label says back off, but the target load remains unchanged.

Better behavior:

- "Hold load" when the app does not calculate a lower target.
- "Reduce to X kg" when it does.
- "Trim 2.5-5%" as a textual suggestion when using machine stacks with coarse jumps.

## Risks and tradeoffs

### Simplicity versus scientific completeness

RepForge's strength is speed. A comprehensive hypertrophy dashboard could make the app feel like a spreadsheet. The roadmap should preserve a fast Log tab and move detailed analysis into Stats/Program.

### RIR accuracy

RIR is subjective and often inaccurate, especially for newer lifters. The app should use RIR as a trend signal, not as a single-set truth oracle.

### Volume targets vary

The 10+ sets per muscle heuristic is useful but not universal. Recovery, training age, exercise selection, effort, nutrition, sleep, and stress all influence tolerance. The app should present ranges and trends, not rigid pass/fail judgments.

### Machines are not identical

Machine load numbers are not comparable across brands or even stations. The app should avoid global strength rankings across different machines unless users track machine identity/setup.

### Local-only data

Local-only storage supports privacy but increases backup risk. As the app grows more valuable, export/import clarity becomes more important.

## Suggested future data model changes

Add fields without breaking existing logs:

```text
Exercise:
  id
  name
  aliases[]
  day
  order
  sets
  min
  max
  primary[]
  secondary[]
  tags[]
  setupNotes
  defaultRestSeconds
  active

Log row:
  exerciseId
  exerciseNameSnapshot
  session
  date
  day
  set
  load
  reps
  rir
  skipped
  setType
  restSeconds
  notes
  created
```

Migration approach:

- Keep old `name` for display and backwards compatibility.
- On first load, match old log rows to current exercises by exact name.
- If multiple matches exist, keep name-keyed fallback and ask user to resolve later.
- New rows always store both `exerciseId` and `exerciseNameSnapshot`.

## Candidate metrics

### Lift-level metrics

- Last session set table.
- Median load at target range.
- Top load.
- Best e1RM.
- Rep PR at current load.
- Sessions since last load increase.
- RIR trend.
- Regression count.

### Muscle-level metrics

- Rolling hard sets.
- Planned sets.
- Completed percentage.
- Average RIR.
- Frequency.
- Direct versus secondary set split.
- Exercises contributing to volume.

### Session-level metrics

- Completed sets.
- Hard sets.
- Average RIR.
- Tonnage.
- Reduce flags.
- PRs.
- Notes.

## Recommended implementation sequence

1. Fix logging correctness: validation, skipped sets, and ID-aware log rows.
2. Add completed hard-set volume by muscle.
3. Add frequency/adherence views.
4. Make recommendations RIR-aware beyond bold jumps.
5. Add actionable reduce/deload heuristics.
6. Add exercise setup metadata.
7. Rework Stats around hypertrophy-first signals.

This sequence keeps the app useful at every step: first protect data quality, then compute the most important hypertrophy metric, then improve recommendations.

## Bottom line

RepForge has a strong foundation: privacy-preserving local storage, fast workout logging, editable programming, a clear overload metaphor, and a simple double-progression engine. Its main scientific gap is not that the current mechanics are wrong; it is that they stop short of the higher-level hypertrophy signals users need to make programming decisions. The next version should turn logged sets into muscle-level hard-set volume, frequency, effort, and fatigue signals while preserving the current low-friction logging experience.

## Reference list

- American College of Sports Medicine. "Progression models in resistance training for healthy adults." Medicine and Science in Sports and Exercise, 2009. PMID: 19204579. https://pubmed.ncbi.nlm.nih.gov/19204579/
- Baz-Valle E, Fontes-Villalba M, Santos-Concejero J. "Total Number of Sets as a Training Volume Quantification Method for Muscle Hypertrophy: A Systematic Review." Journal of Strength and Conditioning Research, 2021. https://doi.org/10.1519/JSC.0000000000002776
- Bell L, Ruddock A, Maden-Wilkinson T, Rogerson D. "You can't shoot another bullet until you've reloaded the gun: Coaches' perceptions, practices and experiences of deloading in strength and physique sports." Frontiers in Sports and Active Living, 2022. https://doi.org/10.3389/fspor.2022.1073223
- Bell L, Ruddock A, Maden-Wilkinson T, Rogerson D. "Integrating Deloading into Strength and Physique Sports Training Programmes: An International Delphi Consensus Approach." Sports Medicine - Open, 2023. https://doi.org/10.1186/s40798-023-00633-0
- Carvalho L, Junior RM, Barreira J, Schoenfeld BJ, Orazem J, Barroso R. "Resistance Training Load Effects on Muscle Hypertrophy and Strength Gain: Systematic Review and Network Meta-analysis." Medicine and Science in Sports and Exercise, 2021. https://doi.org/10.1249/MSS.0000000000002585
- Cuthbert M, et al. "Resistance Training Variables for Optimization of Muscle Hypertrophy: An Umbrella Review." Frontiers in Sports and Active Living, 2022. PMID: 35873210. https://pubmed.ncbi.nlm.nih.gov/35873210/
- Pedrosa GF, et al. "Muscle hypertrophy from partial repetition at long vs. short muscle length: A systematic review and meta-analysis." Sport Sciences for Health, 2025. https://doi.org/10.1007/s11332-025-01586-5
- Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. "Influence of Resistance Training Proximity-to-Failure on Skeletal Muscle Hypertrophy: A Systematic Review with Meta-analysis." Sports Medicine, 2022. PMID: 36334240. https://pubmed.ncbi.nlm.nih.gov/36334240/
- Robinson ZP, Pelland JC, Remmert JF, et al. "Exploring the Dose-Response Relationship Between Estimated Resistance Training Proximity to Failure, Strength Gain, and Muscle Hypertrophy: A Series of Meta-Regressions." Sports Medicine, 2024. https://doi.org/10.1007/s40279-024-02069-2
- Schoenfeld BJ, Grgic J, Krieger J. "How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis." Journal of Sports Sciences, 2019. PMID: 30558493. https://pubmed.ncbi.nlm.nih.gov/30558493/
- Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. "Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis." Journal of Strength and Conditioning Research, 2017. PMID: 28834797. https://pubmed.ncbi.nlm.nih.gov/28834797/
- Schoenfeld BJ, Ogborn D, Krieger JW. "Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis." Journal of Sports Sciences, 2017. PMID: 27433992. https://pubmed.ncbi.nlm.nih.gov/27433992/
- Schoenfeld BJ, Ogborn D, Krieger JW. "Effects of Resistance Training Frequency on Measures of Muscle Hypertrophy: A Systematic Review and Meta-Analysis." Sports Medicine, 2016. PMID: 27102172. https://pubmed.ncbi.nlm.nih.gov/27102172/
- Singer A, et al. "Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy." Frontiers in Sports and Active Living, 2024. PMID: 39205815. https://pubmed.ncbi.nlm.nih.gov/39205815/
- Greig L, Hemingway BHS, Aspe RR, Cooper K, Comfort P, Swinton PA. "Autoregulation in Resistance Training: Addressing the Inconsistencies." Sports Medicine, 2020. PMID: 32813181. https://pubmed.ncbi.nlm.nih.gov/32813181/
- Thompson SW, Rogerson D, Ruddock A, Barnes A. "The Effect of Load and Volume Autoregulation on Muscular Strength and Hypertrophy: A Systematic Review and Meta-Analysis." Sports Medicine - Open, 2022. https://doi.org/10.1186/s40798-021-00404-9
- Wolf M, Androulakis-Korakakis P, Fisher J, Schoenfeld B, Steele J. "Partial vs full range of motion resistance training: A systematic review and meta-analysis." International Journal of Strength and Conditioning, 2023. https://doi.org/10.47206/ijsc.v3i1.182
