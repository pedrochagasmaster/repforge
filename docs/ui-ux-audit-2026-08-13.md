# RepForge UI/UX audit — 13 Aug 2026

Hands-on audit ahead of launch. Every tab, every segment, every dialog, driven through a real
browser at phone size, in both languages, both units, both RIR modes, and across seven data
states (cold start, one session, eight weeks, two years, mid-workout, stale user, empty program).

**Verdict: the app is beautifully made and one bug away from being untrustworthy.** The visual
design, typography, information hierarchy and copy are better than most shipping fitness apps.
But the number RepForge exists to produce — *the weight to put on the machine today* — is wrong
in the most common case, and two screens disagree about whether you trained this week. Those
undermine the product's whole claim. They are also small fixes.

Below, P0 means "do not launch without this", P1 means "fix in the first week", P2/P3 are the
backlog.

---

## How this was tested

- Chromium at 390×844 (iPhone 14/15), 320×568 (SE), and 844×390 landscape, `isMobile`, touch.
- Seeded through the app's own storage layer (localStorage + IndexedDB) so every code path is
  the real one.
- Automated per-screen checks for horizontal overflow, tap targets under 40 px, clipped text,
  elements outside the viewport, controls with no accessible name, and WCAG AA contrast.
- No JavaScript errors were thrown anywhere. The app never crashed. Console was clean in every
  run — that is genuinely rare and worth saying.

---

## P0 — ship blockers

### 1. Every "hold" recommendation is a weight that cannot be loaded

`recommendation()` (app.js:934–970) uses `l.med` — the **median of last session's loads** — as
the recommended load. The `add` and `reduce` branches pass it through `round()` (app.js:880,
snaps to `minJump`, default 2.5 kg). The three `hold` branches (app.js:955, 956, 958, 959) return
it raw.

Any session with mixed loads across sets — which is what happens the moment a lifter drops weight
on the last set, i.e. nearly always — gives an even-count median landing on a half increment. On a
seeded 8-week log, **all six lifts on Day 1** recommended an impossible weight:

```
Hack squat or pendulum squat : hold  53.75 kg
Seated leg curl              : hold  68.25 kg
Incline converging chest press: hold 80.25 kg
Chest-supported machine row  : hold  92.25 kg
Machine lateral raise        : hold 104.25 kg
Hip adduction machine        : hold 113.75 kg
```

The Focus cue reads **"NOW · Drop to 51.25 kg · aim for 6 reps"**. There is no 51.25 kg pin on any
machine. The exercise page headline reads **"Hold 53.75 kg"** while the summary right below says
top load 55 kg — so "hold" is telling you to go *down*.

A lifter standing at the machine cannot act on this. It is the app's core output and it is wrong
six times out of six.

**Fix:** wrap the `hold` branches in `round()`, same as the others. One-line class of change.
Consider also snapping to the *previous session's actual working load* rather than a median, since
"hold" should mean "the weight you used", not "the average of the weights you used".

### 2. Today and Program disagree about the same week

Same state, same moment, three screens:

| Screen | Says |
|---|---|
| Today → This week | `2 of 3 sessions completed` |
| Progress → This week | `2 of 3 sessions · 16 hard sets` |
| Program → sessions | `3 / 3` and `3 / 3 days this week` |

Ground truth from the app's own helper: 2 sessions in the current week.

Cause: `weeklySnapshot()` (app.js:542) uses `weekRange(today)` — a Monday-to-Sunday calendar week.
`programAdherence()` (app.js:538) uses `daysAgo(6)` — a rolling 7-day window. Two definitions of
"this week", each rendered under a label that reads identically to the user.

A tracker that contradicts itself about whether you showed up is a tracker you stop believing.

**Fix:** make `programAdherence()` call `weekRange()`. Or, if a rolling window is deliberate, label
it "last 7 days" so the two are visibly different questions.

### 3. Pounds are unusable

Switching to lb converts but never rounds. `fmtPlain` (app.js:32) does `toFixed(2)`, so everything
gets two decimals of noise:

- Ledger of last session: `115.74 lb`, `110.23 lb`
- Focus cue: `Drop to 112.99 lb · aim for 6 reps`
- PR table: `194.01`, `199.52`, delta `+5.51`
- Metrics row: `231klb` volume, `307lb` best e1RM

Nobody loads 112.99 lb. Every US user sees this on the first screen of their first workout.
`231klb` is also a string-concatenation glitch (`kfmt` appends `k`, then the unit is appended raw).

**Fix:** round display loads to a sensible increment per unit (2.5 kg / 5 lb) and put a space or a
styled unit span between the abbreviated number and the unit.

### 4. Onboarding ignores the equipment answer

Step 5 says, verbatim: *"Pick everything you can use. We'll only program what you have."*

Select **Bodyweight only** and the generated program is:

```
Barbell back squat · Barbell Romanian deadlift · Barbell bench press
Cable pullover · Cable lateral raise · Dumbbell curl
```

`catalogForSlot()` (app.js:346) falls back to the *entire* catalogue when the equipment filter
empties a slot's pool, silently and without telling anyone. The screen makes a promise; the next
screen breaks it. This is the first thirty seconds of the product.

**Fix:** either restrict slots to what the equipment supports (drop unfillable slots, backfill from
other patterns that *are* fillable), or say plainly on the review screen which exercises needed
equipment the lifter didn't select.

### 5. Generated programs repeat the same day verbatim

`resolveSplit()` (app.js:333–341) emits N copies of the same day type and `exerciseSlotsForDay()`
returns the same slot list each time, with `usedIds` scoped per day. So every repeat of a day type
is byte-identical. Swept across all 45 reachable answer combinations:

| Answer | Result |
|---|---|
| 3 days, full body | Day 1 = Day 2 = Day 3, identical |
| 4 days, upper/lower | Day 1 = Day 3, Day 2 = Day 4 |
| 6 days, PPL | 6 days, 3 unique |
| 2 days, full body | Day 1 = Day 2 |

The step-8 review screen shows two cards headed DAY 1 and DAY 2 containing the same five lines.
It reads as a rendering bug even when the training logic is defensible, and it makes Day 1 and Day 3
indistinguishable on the Log tab forever after (Program tab shows both as "Quads · Hamstrings ·
Chest, 6 exercises · 12 sets").

**Fix (minimum):** if a day type repeats, collapse it — show "Day A ×3" on review and label the
tabs by day type, not ordinal. **Fix (better):** vary exercise selection across repeats of a type
so Day 1 and Day 3 differ.

### 6. Disabled primary buttons look fully enabled

`styles.css` has no `.btn:disabled` rule at all. On onboarding step 1, "Continue" renders as a
solid black CTA with an orange arrow — visually identical to an active button — and does nothing
when tapped. No toast, no shake, no hint that a goal must be picked first.

This is the very first interaction in the product, and the failure mode is "the app is broken".

**Fix:** add `.btn:disabled{opacity:.4;cursor:default}` (the pattern already exists for `.iconbtn`
at styles.css:1029), or better, keep the button enabled and reveal the requirement on tap.

### 7. Loads are accepted with no upper bound

Typing `1e5` into the load field commits a set at **100,000 kg**. `99999999` also commits. Both
permanently distort every chart, e1RM, PR and volume figure derived from that lift, and the only
way to find the bad row is to hunt through History → Every set.

Related: the validation toast says *"Enter a weight before saving the set."* for `abc`, `-50`, `0`
and `12.5.5` — cases where the user clearly did enter something. Wrong diagnosis, so the user
doesn't know what to change.

**Fix:** clamp to a plausible range (say 0 < load ≤ 1000 kg / 2200 lb), reject scientific notation,
and split the message into "enter a weight" vs "that isn't a valid weight".

---

## P1 — fix in the first week

### 8. The block counter runs past its own end

`mesocycleWeek()` (app.js:568) never clamps `current` to `total`. Any lifter who runs a block one
week long sees **"Week 7 of 6"** — in the Today program chip, in the workout header banner
("Block ending — Week 7 of 6."), and on the Program tab next to a progress bar with all six
segments filled. Observed at Week 7 of 6 and Week 9 of 6.

The banner is dismissible, so the state is reachable and persistent.

### 9. The volume bars contradict the numbers beside them

`renderOverviewVolume()` (app.js:2103) sets bar width to `completed7 / max`, where `max` is the
**largest value across all muscles** — but the number and the status word next to it are
per-muscle, `completed / planned`. The two scales sit in the same row:

- `Front delts — 4 / 4 — On target` → bar drawn at **67 %**
- `Lats — 5 / 5 — On target` → bar at **83 %**
- `Chest — 6 / 6 — On target` → bar at **100 %**
- `Adductors — 0 / 4 — Below` → bar at **4 %** (a visible orange nub for zero sets)

A lifter who has hit every target sees three bars of three different lengths. Set the width to
`completed / planned` and drop the `Math.max(4, …)` floor.

### 10. Overview volume silently hides the muscles that matter

The same function does `rows.slice(0, 8)` on an alphabetically sorted list. On the seeded log that
shows Adductors through Mid/upper back — and hides **Quads (0/6, Low)**, Rear delts, Side delts,
Spinal erectors and Triceps. The one entry a lifter needs to see is cut because it starts with Q.

Sort by deficit, not alphabet, and label the cut ("+5 more").

### 11. Modals are not modal

`#endBlockConfirm`, `#importChoice` and `#blockReview` all carry `aria-modal="true"` but:

- no scrim — the page behind stays fully visible and **fully tappable** (you can hit "+ Add
  exercise" behind the "End this training block?" dialog)
- focus is never moved into the dialog (`document.activeElement` stays on the trigger or `body`)
- **Escape does not close them**
- tapping outside does not close them

The exercise-note sheet gets all of this right (scrim, focus into the textarea, tap-out to close).
Apply that pattern to the other three.

### 12. There is no way to end a workout early in Focus mode

`focusWellHtml()` (app.js:1658) only renders `data-ffinish` when the current exercise's sets are
done **and** (`allDone || !hasNext`). On exercise 1 of 6 the button is "Next exercise". The `⋯`
overflow menu contains only List/Focus, Date and Voice — no "Finish workout", no "Discard".

To stop after two exercises you must either swipe through the four you're not doing, or discover
the mode switch buried in `⋯` and scroll ~2,900 px down the List view to the save button. Neither
is findable mid-session.

Add "Finish workout" to the `⋯` menu, or make the header back-chevron offer *Finish / Keep for
later / Discard* when sets are banked. (Today it silently drops you to Today with no prompt, though
the CTA does correctly become "Continue workout" — that part is good.)

### 13. Layout breaks at 320 px

On an iPhone SE inside a workout:

- the reps and RIR inputs collapse to **4 px and 6 px wide**
- the "Save" button shrinks to 38×46
- **the entire "Last session" ledger is clipped away** — the column headers render, the two data
  rows do not. The single most useful reference in the app is invisible on small phones.
- the target line truncates to `TARGET 4–8 reps · RIR…`

### 14. Landscape is broken

At 844×390 the card is sliced mid-word ("LAST SESSION" cut in half), no input is reachable without
scrolling, and the content sits in a narrow column with large dead margins. Either adapt the layout
or lock to portrait in the manifest.

### 15. The tour describes a UI that no longer exists

Step 4: *"The bar at the bottom moves between exercises with Previous exercise and Next exercise.
Turn on the mic in Settings."* — there is no bottom bar; navigation is top chevrons and swipe.

Step 5: *"On Today, the orange-dot line shows how many lifts are ready for more weight. Tap a set's
rest button to run the rest timer."* — Today shows a week-dot strip, not a readiness line
(`#heatGauge` is `visually-hidden`), and there is no per-set rest button in Focus; there is one in
the header.

A guided tour that points at absent controls is worse than no tour. It is also the first thing a
new user sees after saving their program.

### 16. Effort-mode labels are clipped to illegibility

In Easy/Hard/Max mode the picker buttons are 32×46 and `.effort__word` truncates: "Easy" renders
in 24 px of 31 px needed, "Hard" 24 of 34. The words are cut mid-glyph. This is the whole point of
the mode — it exists so beginners don't have to think in RIR.

---

## P2 — quality

### 17. The PR timeline is half duplicates

Every load PR is immediately followed by an e1RM PR for the same set, same date, same numbers:

```
August 13  Lying or seated leg curl  LOAD  69.5kg × 8  +2.5kg
August 13  Lying or seated leg curl  E1RM  69.5kg × 8  +5kg
```

Roughly half the timeline is the same achievement counted twice, which also inflates the "11 PRs"
figure on the exercise page. Collapse a same-set load+e1RM pair into one row with two badges.

Exercise names in that list also truncate at 175 px — "Machine chest dip or plate-loaded chest …" —
so you often can't tell which lift the record belongs to.

### 18. Block review numbers are internally inconsistent

The review dialog, on an 8-week seed, reports:

- **"Block complete · 6 weeks · 18 Jun – 13 Aug"** — that date range is 8 weeks
- **"24 / 18 completed100%"** — 24 of 18 shown as 100 %, and the percentage collides with the
  fraction (missing separator)
- **"18 improved / 0 stable / 0 stalled"** — while Progress, on the same data, says
  "8 improved / 3 stable / 7 attention"
- **"RECOMMENDATION"** label above a sentence that starts "Recommendation:" — said twice
- the recommendation itself is *"repeat this block or progress"*, which is two options, not a
  recommendation
- a raw 🔒 emoji in an app that otherwise uses a custom masked-icon set
- the "Block complete" headline renders in grey, reading as disabled next to everything else

### 19. Progress tab scrolls sideways

`.attn__lead` and `.attn__why` (styles.css:1174–1175) set `width:100%`, which overrides the
`width:1px` from `.visually-hidden` (styles.css:71) because they come later at equal specificity.
The nodes stay invisible (the `clip` rect survives) but they are 390 px wide with `margin:-1px`,
pushing the document to 406 px in a 390 px viewport. The whole Progress tab rubber-bands
horizontally.

Fix by adding `!important` to the `.visually-hidden` width/height, or by not setting `width` on
those two classes.

### 20. Data tables need a scroll affordance

`.table` has `overflow:auto`, so they do scroll — but there is no visual cue. Measured widths in a
390 px viewport: Strength **687 px**, History "Every set" **610 px** (833 px with long exercise
names), PR ledger **537 px**, Volume **536 px**. The "Δ vs prev" and "Signal" columns are simply
invisible unless you happen to drag sideways inside the table. Add a fade edge, or restructure to
cards on narrow screens.

### 21. The Strength table gives every lift the same answer

All 18 rows read `Hold · add reps`. Partly a property of the seeded data, but it exposes that the
signal column has very low resolution — a table where every row says the same thing is a table
nobody reads twice. Consider surfacing only the lifts whose signal differs from the default.

### 22. Skipping an exercise gives no feedback and no undo

Tap skip and the counter silently goes `EXERCISE 2 OF 6` → `EXERCISE 2 OF 5`. No toast, no undo.
The recovery affordance ("1 hidden today · Show all") exists but only appears above the deck, which
you may have scrolled past. Show a toast with Undo at the moment of the action.

### 23. Calendar and session list are decoupled

Paging the History calendar back to May shows **"0 sessions · 0 sets"** while the "Recent" list
directly underneath continues to show August sessions. Two adjacent components describing different
time ranges with no visual connection. Either filter the list to the shown month or move the
counter so it clearly belongs to the calendar.

### 24. Invalid settings are swallowed silently

Entering `-5` or `abc` in Load jump % coerces the stored value back to 2.5 but **leaves the invalid
text in the field** with no toast. The user believes they changed it.

`Target RIR ceiling = 99` is accepted outright, producing `TARGET 4–8 reps · RIR 0–99` in every
workout. Meanwhile `hardRir = -1` and `restSec = -30` are correctly rejected — so validation exists,
just inconsistently.

### 25. An empty program is a dead end

Saving `[]` through the advanced JSON editor produces a cheerful "Program saved." Today then shows
"Day 1 · 0 exercises" with a live Start workout button that opens a workout shell reading
**"EXERCISE 0 OF 0"** and nothing else — no message, no escape hatch, no "create a program" CTA.
It doesn't crash, but it is a state with no way forward.

### 26. "View exercises" starts the workout

The secondary link under Start workout sets `body.is-workout` and opens the same workout shell,
just in List mode instead of Focus. Two buttons, same destination, no explanation, and the label
promises a read-only preview. Either make it a genuine preview or rename it "Log as a list".

### 27. Priority-muscle handling has gaps

`applyPriorityMuscles()` (app.js:361–378, slot map at 367–370) maps a missing priority muscle to an exercise slot with a
chain of `includes()` tests and a final fallback of `"curl"`. **Calves has no branch** — selecting
Calves as a priority adds a biceps curl. The function also appends every backfilled exercise to
`program[0].day`, so Day 1 ends up with 7 exercises while Days 2 and 3 have 6.

### 28. Two catalogue entries share a name

`ar_mc`/`cu_mc` are both "Preacher curl machine"; `ar_db`/`cu_db` both "Dumbbell curl";
`dl_db`/`lr_db` both "Dumbbell lateral raise"; `dl_mc`/`lr_mc` both "Lateral raise machine". Because
dedup is by id, a single generated day can contain two identically-named exercises. Observed:
6-day PPL long puts Cable curl **and** Preacher curl machine on the same day, and Cable pressdown on
both Day 1 and Day 2. The filler also ignores day type — leg day ends with a biceps curl.

### 29. "Bro split" and "Machine only" don't do what they say

`resolveSplit()` (app.js:338–339) maps `bro` to a push/pull/legs cycle — a 5-day "Bro split" produces
push, pull, legs, push, pull, which is exactly the PPL option. `machine_only` maps to `full_body`
and applies no equipment restriction (that comes from the equipment step), so picking it with Cables
selected yields cable exercises. Both labels promise something the generator doesn't deliver.

### 30. "Advanced" experience is indistinguishable from "Intermediate"

`repScheme()` branches on `experience === "beginner"` only. Beginner gets 2 sets and 8–12 reps;
intermediate and advanced get identical output in every combination tested. An onboarding question
whose answer is discarded.

---

## P3 — polish

- **Contrast.** `--ink-faint` (`#98948C`) on the app background is **2.7:1** — every section label,
  every table header, every eyebrow, the calendar day-of-week row and the settings group labels fail
  AA (needs 4.5:1). The accent `#E04E14` on background is **3.57:1** — every text link, "Edit",
  "Done", "See volume ›", "Cancel", the back links. On card white it's 3.99:1. The disabled Focus
  prev-chevron is **1.31:1** — effectively invisible rather than merely dim. This is the single
  highest-volume accessibility issue in the app; darkening `--ink-faint` to roughly `#6E6A62` and the
  text-accent to about `#B33C0F` clears almost all of it in two variable changes.
- **Tap targets.** Consistently present under 44 px: `#programEditToggle` (34×35), `#viewExercises`
  (358×35), the program editor's ▲/▼/✕ (34×34), the onboarding back chevron (13×44), the install
  banner close (19×21), `select#unit` and `select#lang` (19 px tall), the toggles (51×31), and the
  set-number buttons (24×44).
- **`#notifyToggle` has no accessible name** — the voice toggle has `data-i18n-aria`, the
  notifications one doesn't.
- **The install banner overlays content mid-page** on Today, Progress and History, covering two
  list rows, with a 19×21 px dismiss target. It should sit above the bottom nav or be a settings row.
- **History header icons are raw glyphs** — `⌕` and `▤` in the markup, next to a polished masked-icon
  set everywhere else. They read as missing-font artifacts.
- **Program editor ▲/▼ are text triangles** while the delete in the same row uses the icon system.
- **Huge dead space in the Focus card.** The ledger reserves full height for `ex.sets` rows, so on
  set 1 there is ~450 px of empty white between "No sets logged yet" and the input well — on the app's
  most-used screen.
- **The exercise page header** renders `‹ Today` and `Exercise` jammed together, centred, instead of
  back-link-left / title-centre.
- **"Improved" and "Regressed"** on the exercise page and history rows use the same orange. Good and
  bad news look identical.
- **Chart axis labels are non-uniform** — `42 / 52 / 61 / 71 kg` (steps of 10, 9, 10).
- **Thin-data formatting.** With one session the trend line reads `Top load 64→64 kg · 0 kg over 1
  session` with an orphan `·` where the direction arrow belongs.
- **Portuguese is partial.** Chrome and labels translate; day names ("Day 1") and the default
  program's exercise names stay English, so a PT user sees `2026-08-13 · Day 3 · Cable pressdown`.
- **Export gives no confirmation.** Tapping Export backup JSON produces a file and no toast.
- **Delete all data uses a native `confirm()`** — inconsistent with the app's own dialogs, and the
  message ("Delete the training log?") doesn't match the row label ("Delete all data") or answer
  whether the program goes too.
- **Repetitive attention copy.** Five consecutive rows reading "Primary muscle under weekly volume
  target." Group them under one heading.
- **`#heatGauge`** is `visually-hidden` but still exposes a control named "forge" to assistive tech.

### Performance at two years of training

3,744 rows / 1 MB in localStorage:

| | |
|---|---|
| Cold boot | 743 ms |
| Progress render | 798 ms, 2,560 nodes, 8,877 px tall |
| History render | 786 ms, **32,559 nodes**, **45,650 px tall** |

The History tab builds the full "Every set" table into the DOM on every render whether the
`<details>` is open or not, and the session list has no pagination. On a mid-range Android this will
be visibly slow and memory-hungry. Also worth noting: localStorage is at 1 MB after two years and
the per-origin cap is ~5 MB — the mirror write is wrapped in try/catch and IndexedDB is primary, so
data survives, but the failure is silent.

---

## The pattern behind the bugs

Four themes account for most of what's above.

**1. Two sources of truth for the same idea.** "This week" is a calendar week in one place and a
rolling window in another. "Improved" is counted three different ways across Progress, Program and
Block review. The volume bar and the volume number use different denominators. Each of these is a
small bug, but together they teach the user that the app's numbers are decorative. Pick one
definition per concept, compute it once, and have every surface read that.

**2. Rounding and unit formatting were never centralised.** The load pipeline has a `round()`
helper that three call sites use and three don't. `fmtLoad` converts but doesn't round.
`kfmt` produces "231k" and the caller appends "lb". One function that owns "turn a kilogram into
the string a lifter reads" would kill findings 1, 3, and several P3 items at once.

**3. The generator was built as a demo and shipped as a feature.** Onboarding asks eight questions;
the answers to equipment, experience (advanced), and split type are partly or wholly discarded, and
repeated days come out identical. Either invest in it properly or cut it to three questions
(days per week, equipment, session length) that the generator actually honours — a short honest
flow beats a long one that ignores you.

**4. Dialog and disabled-state primitives are missing.** No `.btn:disabled`, no scrim/focus-trap/
Escape helper. Both are ten-line additions that fix a class of problems rather than instances.

## What I'd do before tomorrow

Ordered by damage-per-hour of work:

1. `round()` on the three `hold` branches (app.js:955–959). **~10 minutes, fixes the worst bug.**
2. Point `programAdherence()` at `weekRange()`. **~10 minutes.**
3. Round lb display and put a space before the unit in `kfmt` callers. **~30 minutes.**
4. Add `.btn:disabled{opacity:.4}`. **~2 minutes.**
5. Clamp load input to a sane maximum; fix the three wrong validation messages. **~30 minutes.**
6. Clamp `mesocycleWeek().current` to `total`. **~5 minutes.**
7. Volume bar width → `completed / planned`; sort by deficit; drop the 4 % floor. **~20 minutes.**
8. Equipment: stop the silent full-catalogue fallback, or say on the review screen what was
   substituted. **~1 hour.**
9. Collapse identical generated days on the review screen. **~1 hour.**
10. Scrim + Escape + focus-trap on the three dialogs, reusing the note-sheet pattern. **~1 hour.**
11. Darken `--ink-faint` and the text accent. **~10 minutes, clears most of the AA failures.**
12. Rewrite tour steps 4 and 5 to match the current UI, or disable the tour for launch.

Items 1–7 and 11 are under three hours together and remove every finding that makes the app look
untrustworthy. Items 13 (320 px) and 14 (landscape) are the next tier and want a real layout pass
rather than a patch.

## What's genuinely good

Worth protecting while fixing the above:

- Zero JavaScript errors across every state tested, including deliberately hostile input.
- Import validation is exemplary — malformed JSON and wrong-shape JSON are both caught with a clear
  message and the existing log is left untouched.
- Focus rings are present, consistent (2 px accent outline) and never suppressed.
- `prefers-reduced-motion` is honoured.
- The exercise-note sheet is a textbook mobile sheet: scrim, focus into the field, tap-out to close,
  a footer that explains what happens next.
- The storage note in Settings is one of the best pieces of copy in the app — it explains local-only
  storage, names the key, and tells you what to do about it, without alarm.
- Today's CTA correctly becomes "Continue workout" when a draft exists, and the draft survives reload.
- The visual language — typography, the anvil mark, the restrained accent, the card rhythm — is
  coherent and distinctive. Very little here needs redesigning; it needs its numbers to be right.
