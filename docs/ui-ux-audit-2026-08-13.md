# RepForge UI/UX audit — 13 Aug 2026

Hands-on audit ahead of launch. Every tab, every segment, every dialog, driven through a real
browser at phone size, in both languages, both units, both RIR modes, and across seven data
states (cold start, one session, eight weeks, two years, mid-workout, stale user, empty program).

**Original verdict: the app is beautifully made but has several trust-damaging edge cases.** The
visual design, typography, information hierarchy and copy are better than most shipping fitness
apps. In the audited descending-load fixture, the weight RepForge tells a lifter to use can fall
off the configured plate/pin grid, and Program labels a rolling seven-day metric as “this week,”
making it appear to disagree with calendar-week screens. Those defects undermine the product's
claim, but the original “most common case” wording was not established.

The original severity labels below are preserved for traceability. The post-publication
verification matrix is authoritative where it changes a label or rejects a claim.

---

## Post-publication verification

Rechecked on `main` at `ee59cdf` against the live source, targeted Chromium probes, the locked
capacity decision in `docs/adr/0003-capacity-as-progression-currency.md`, the accepted rolling
adherence contract in `docs/design/program-abstraction.md`, and both browser suites:

- `REPFORGE_URL=http://localhost:8000/ npm --prefix test run simulate`: **408 passed, 0 failed**
- `REPFORGE_URL=http://localhost:8000/ npm --prefix test run test:focus`: **83 passed, 0 failed**

This review found a strong core of real defects, but the original report is not accurate enough to
execute unchanged. In particular, source plus targeted probes reject findings 13 and 16, finding 3
conflates distinct display policies, and the proposed change to the capacity engine's median would
bypass a recorded product decision.

| Finding | Verification | Correction / execution decision |
|---|---|---|
| 1 | Confirmed; claim narrowed | Four raw-load return paths exist, not three. Even-set mixed loads can put their median off-grid; not every mixed-load session does. Round those paths without replacing the capacity engine's median, and re-enter reps when normalization changes the target load. |
| 2 | Confirmed; remedy corrected | Preserve Program's accepted rolling-seven-day adherence contract and relabel both Program surfaces explicitly. Today and Progress remain Monday–Sunday; Program counts distinct planned training days in `[today-6, today]`, not sessions. |
| 3 | Partly confirmed; deferred | Decimal noise is real, but rounding every historical value to 5 lb would misstate stored data. Separate historical formatting from actionable-load policy before changing it. |
| 4 | Confirmed; scope expanded | The catalogue has zero bodyweight entries and the fallback violates selected equipment. Priority-muscle insertion bypasses the filter too, and zero-fill day types need an explicit onboarding outcome. |
| 5 | Confirmed | Repeated days are visually identical, not byte-identical (their generated ids differ). Rotate deterministic selections across repeated day types and compare stable visible/library fields, not generated ids. |
| 6 | Confirmed | Add one unambiguous disabled treatment rather than leaving the implementation choice open. |
| 7 | Confirmed; scope expanded | Per-set commit and final save accept unbounded values; History session editing is a third persistence path that needs the same parser. |
| 8 | Confirmed; scope expanded | Keep elapsed week separate from clamped display week, and update `blockSnapshot()` as well as `mesocycleWeek()`. |
| 9–10 | Confirmed; edge cases added | Remove the CSS minimum-width nub, define zero-plan rows, and use a deterministic deficit sort before truncation. |
| 11 | Confirmed; transition clarified | Compact dialogs expose the background; the full-screen review covers it visually. All three need focus, Escape, focus-return and inert handling, including opener transfer from confirmation to review. |
| 12 | Confirmed; not in this pass | Focus mode has no early-finish action. It was not in PR 107's original dispatch list and remains separate interaction design work. |
| 13 | Rejected | Source inspection and a targeted 320×568 probe contradict the reported collapsed inputs and missing ledger. The checked-in compact suite protects general fit but does not specifically prove prior-session visibility. |
| 14 | Partly confirmed; design review | Landscape leaves the CTA below the initial viewport and nearly collapses the ledger, but the inputs remain reachable. Portrait locking is not a validated fix. |
| 15 | Partly confirmed; not in this pass | The bottom navigation and per-set timer descriptions are stale; Today still conditionally renders its readiness line. |
| 16 | Rejected | Source inspection and targeted 320 px probes show full-width List choices and three usable Focus columns. The checked-in compact loop does not itself exercise 320 px effort mode. |
| 17 | Partly confirmed; product choice | A set can legitimately establish both load and e1RM records, but not every load PR does. Collapsing same-set pairs is a presentation decision, not a correctness fix. |
| 18 | Partly confirmed | The real defect is that the percentage beside the session fraction is volume compliance, plus target block length is presented beside a longer actual date range without explanation. Week-vs-block lift counts are not comparable. |
| 19–20 | Confirmed | The hidden-element width override and missing table affordance are real. |
| 21 | Observation, not defect | Uniform seeded recommendations do not establish that the signal lacks resolution. |
| 22–23 | Confirmed | Both are interaction/information-architecture defects. |
| 24 | Partly confirmed | Invalid numeric settings reset silently; they do not remain visible after `render()`. Unbounded `rirHigh` is confirmed. |
| 25 | Partly confirmed | An empty program reaches `Exercise 0 of 0`, but Back and Settings → Create new program remain escape routes. |
| 26–27 | Confirmed | “View exercises” enters the workout shell; priority-muscle insertion misroutes Calves and always appends to Day 1. |
| 28 | Partly confirmed | Duplicate names and day-inappropriate filler are real. Cable curl vs Preacher curl and cross-day reuse are not duplicate-name defects. |
| 29–30 | Confirmed | Bro/Machine-only semantics and the discarded Advanced answer reproduce in source and targeted generation. |

The original P3 bucket is mixed, and “polish” understates some accessibility and semantic defects.
Contrast, several undersized targets, the unnamed notification toggle, conditional install-banner
occlusion, raw header/editor glyphs, missing nearby export feedback, the misleading Delete all data
action, repeated attention copy, partial Portuguese, the exercise-page header selector mismatch and
the hidden heat-gauge control are confirmed. Non-uniform rounded chart labels are not by themselves
a defect and that bullet is rejected.

The corrected PR 107 dispatch scope is deliberately narrower than every confirmed audit finding:
audit findings **1, 2 and 4–11**, plus the promoted contrast work item **C1**. Finding 3 is deferred;
findings 12, 14, 15 and 17–30 remain follow-up work; findings 13, 16 and the chart-label bullet are
rejected. These identifiers are used consistently in the implementation brief.

### Finding metadata

Impact below reflects the corrected claim rather than the preserved original heading. Effort uses
S/M/L implementation complexity; risk is the risk of the fix itself; confidence reflects the
post-publication evidence. Detailed evidence and impact mechanisms remain in the numbered sections.

| Finding | Corrected impact | Effort | Fix risk | Confidence |
|---|---|---:|---:|---:|
| 1 | High — core recommendation can be unactionable | S | Medium | High |
| 2 | Medium — rolling adherence is presented as a calendar week | S | Low | High |
| 3 | Medium — pound output is noisy; policy remains unresolved | M | High | High |
| 4 | High — onboarding breaks its equipment promise | M | Medium | High |
| 5 | High — generated multi-day programs lack intended variation | M | Medium | High |
| 6 | Medium — primary onboarding action appears broken | S | Low | High |
| 7 | High — invalid loads can reach persisted training data | M | High | High |
| 8 | Medium — lifecycle copy can exceed the configured block | S | Medium | High |
| 9–10 | Medium — volume encoding contradicts and omits priorities | M | Medium | High |
| 11 | High — declared dialogs lack required modal interaction | M | High | High |
| 12 | Medium — Focus lacks an early-exit workflow | M | High | High |
| 13 | Rejected by source and targeted probe | — | — | High |
| 14 | Medium — landscape needs adaptive design | M | High | Medium |
| 15 | Low — tour copy is stale | S | Low | High |
| 16 | Rejected by source and targeted probes | — | — | High |
| 17 | Low — optional presentation consolidation | S | Medium | High |
| 18 | Medium — adjacent block-review values are mislabelled | M | Medium | High |
| 19 | Medium — hidden content can widen Progress | S | Low | High |
| 20 | Low — wide tables lack an overflow affordance | S | Low | High |
| 21 | Observation; fixture does not establish a defect | — | — | High |
| 22 | Medium — skip has no confirmation or undo | M | Medium | High |
| 23 | Medium — calendar selection does not filter sessions | M | Medium | High |
| 24 | High — settings are silently replaced or left unbounded | M | Medium | High |
| 25 | Medium — empty programs enter a broken state | S | Low | High |
| 26 | Medium — a read-only label enters the workout shell | S | Low | High |
| 27 | High — priority generation can target the wrong day | M | Medium | High |
| 28 | Medium — catalogue identity can produce duplicate names | M | Medium | High |
| 29 | High — named generator modes violate their contract | M | High | High |
| 30 | Medium — an onboarding answer has no effect | M | Medium | High |
| P3 bucket | Mixed; confirmed items range from access to polish | M | Medium | High |
| Performance | Medium structural scaling risk; exact timings unverified | L | High | High for structure, Low for timings |

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

## P0 — original ship-blocker classification

### 1. History-derived hold-family recommendations can return unloadable weights

`recommendation()` (app.js:934–970) uses `l.med` — the **median of last session's loads** — as
the recommended load. The `add` and `reduce` branches pass it through `round()` (app.js:880,
snaps to `minJump`, default 2.5 kg). The four stalled/recover/push-reps/default return paths
(app.js:955–960) return it raw.

An even-set session whose middle two loads average off the configured increment grid can produce an
unloadable median. Mixed loads do not always do this: odd set counts select an actual middle load,
and some even-set midpoints still land on-grid. On the seeded 8-week log used for the audit,
**all six lifts on Day 1** hit the defect:

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

**Validated fix:** wrap the four history-derived raw return paths in `round()`, same as the
load-change paths, and add a descending-load regression case for each branch. If normalization
changes the target load, derive reps at that normalized target with the existing capacity-based
re-entry logic; otherwise a rounded-up hold can prescribe more load and more reps at once. Exact
on-grid holds retain their existing double-progression behavior. Keep the median: the capacity
engine normalizes its trigger arithmetic at the session's typical load under ADR 0003. Changing
that reference is a separate product decision. A manually entered off-grid load may still be
echoed by the current-session `setSuggestion()` path; that is not this history-rounding defect.

### 2. Program disguises rolling adherence as a calendar week

Same state, same moment, three screens:

| Screen | Says |
|---|---|
| Today → This week | `2 of 3 sessions completed` |
| Progress → This week | `2 of 3 sessions · 16 hard sets` |
| Program → sessions | `3 / 3` and `3 / 3 days this week` |

Two distinct planned training days were completed in the current calendar week. Three were
completed in the trailing seven days. Both numbers are valid for their own windows, but Program
calls its rolling-window value both “sessions” and “days this week”; the metric actually counts
distinct planned training-day labels and never counts repeated sessions of one day twice.

Cause: `weeklySnapshot()` (app.js:542) uses `weekRange(today)` — a Monday-to-Sunday calendar week.
`programAdherence()` (app.js:538) uses `daysAgo(6)` — a rolling 7-day window. The latter is
intentional: accepted `docs/design/program-abstraction.md` defines Program adherence as unique
program days in `[today-6, today]`, and `plans/README.md` records a calendar-week conversion as a
product decision rather than a bug. The implementation defect is copy that erases that distinction.

A tracker that contradicts itself about whether you showed up is a tracker you stop believing.

**Validated fix:** preserve an inclusive rolling window from `today-6` through `today` and exclude
future rows. Relabel the Program stat as `days (7d)` and its chip as
`{done} / {planned} days in the last 7 days`, localized in both languages. Today and Progress keep
their existing Monday–Sunday labels and calculations.

### 3. Pound display exposes two unresolved formatting policies

Switching to lb converts stored kilograms and formats non-integers to at most two decimals.
That produces noisy values:

- Ledger of last session: `115.74 lb`, `110.23 lb`
- Focus cue: `Drop to 112.99 lb · aim for 6 reps`
- PR table: `194.01`, `199.52`, delta `+5.51`
- The metrics row's text alternative has no separator (`231klb`), although the visible `<small>`
  unit receives a CSS margin.

The original report called this unusable and prescribed rounding every load to 5 lb. That is too
broad. Historical rows are facts; snapping a stored 52 kg row to 115 lb would display a load the
lifter did not record. The app also explicitly stores `minJump` in kilograms regardless of display
unit, so a unit-specific recommendation grid is a product-policy change rather than a formatter fix.

**Decision:** defer the actionable-load rounding policy. A later design must distinguish concise,
truthful formatting of historical values from the increment used for editable suggestions, and
must keep switching units lossless. The accessible unit separator can be fixed independently.

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

`applyPriorityMuscles()` has a second bypass: it calls `chooseExercise()` with an empty equipment
list, so a priority addition can violate the same answer even after the catalogue fallback is
removed. Removing the fallback can also leave a resolved day type with no exercise, and the current
data model cannot represent an empty training day.

**Validated fix:** remove the unsupported Bodyweight choice from the UI while retaining its legacy
mapping/translation for existing data; remove the fallback to the unfiltered catalogue; and pass
selected equipment through primary slots, priority additions and fillers. Skip an unavailable
priority addition. If a selected equipment/split combination cannot produce any exercise for one of
its resolved day types, block continuation at the equipment step with a localized explanation.
Short non-empty days are acceptable; silently dropping a day or violating equipment is not.

### 5. Generated programs repeat the same day visually

`resolveSplit()` (app.js:333–341) emits N copies of the same day type and `exerciseSlotsForDay()`
returns the same slot list each time, with `usedIds` scoped per day. Generated ids differ, but every
user-visible field repeats. The audited scenario matrix reproduced these representative cases:

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

**Validated fix:** rotate each filtered pool by the occurrence index of its day type so repeated
days differ while alternatives remain, preserving the within-day duplicate guard. Stability is
measured on ordered `libraryId`/visible selections; generated row ids are intentionally unique.
Reuse after a pool is exhausted is acceptable. Collapsing repeat cards would hide that the saved
program still contains indistinguishable training days, so it is not an acceptable substitute.

### 6. Disabled primary buttons look fully enabled

`styles.css` has no `.btn:disabled` rule at all. On onboarding step 1, "Continue" renders as a
solid black CTA with an orange arrow — visually identical to an active button — and does nothing
when tapped. No toast, no shake, no hint that a goal must be picked first.

This is the very first interaction in the product, and the failure mode is "the app is broken".

**Validated fix:** give `.btn:disabled` an unmistakable dimmed treatment, default cursor and blocked
pointer events while retaining the native disabled state. The onboarding step already explains its
selection requirement, so turning the disabled control into a second validation interaction is not
part of this pass.

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

## P1 — original first follow-up classification

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

- the two compact dialogs have no scrim, so the page behind stays visible and tappable (you can hit
  "+ Add exercise" behind the "End this training block?" dialog)
- the full-screen block review covers the page, but does not make the background inert
- focus is never moved into the dialog (`document.activeElement` stays on the trigger or `body`)
- **Escape does not close them**
- the compact dialogs do not close when their backdrop area is tapped

The exercise-note sheet gets all of this right, including a Tab loop and focus return. Extract that
behavior into a shared dialog helper and apply the appropriate backdrop behavior to all three.
When the end-block confirmation transitions into block review, carry the original Program-page
opener forward rather than returning focus to the now-hidden confirmation button.

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

**Rejected after verification.** Source inspection and a targeted 320×568 Chromium probe show
usable numeric inputs, an intact 46 px CTA, no page overflow and at least one visible prior-session
row. `test/focus-mode.mjs` also protects general compact fit, though its 320 px case logs current
sets and does not specifically prove prior-session visibility. The original measurements do not
describe the current Focus layout and must not drive implementation.

### 14. Landscape is broken

At 844×390 the prior-session ledger nearly collapses and the primary CTA starts below the initial
viewport, while the content sits in a narrow column with large dead margins. The numeric inputs
remain reachable, contrary to the original claim. Adapting the layout remains design work; locking
to portrait is not a remedy: `manifest.webmanifest` already requests portrait, and that advisory
metadata did not prevent the reproduced landscape state.

### 15. The tour describes a UI that no longer exists

Step 4: *"The bar at the bottom moves between exercises with Previous exercise and Next exercise.
Turn on the mic in Settings."* — there is no bottom bar; navigation is top chevrons and swipe.

Step 5: *"On Today, the orange-dot line shows how many lifts are ready for more weight. Tap a set's
rest button to run the rest timer."* — the readiness line still appears conditionally when an
exercise is ready, so that clause is valid. The stale part is the per-set timer description: Focus
has one timer control in the workout header.

A guided tour that points at absent controls is worse than no tour. It is also the first thing a
new user sees after saving their program.

### 16. Effort-mode labels are clipped to illegibility

**Rejected after verification.** Since commit `4341657`, before this audit, the List picker spans a
dedicated full-width row specifically because the three words do not fit beside load and reps.
Focus uses three usable columns. Targeted 320 px probes show no clipped words; the checked-in
compact loop itself uses numeric RIR, so it is not the evidence for this rejection. The reported
32 px controls are not the current DOM geometry.

---

## P2 — quality

### 17. The PR timeline is half duplicates

When one set establishes both a load PR and an e1RM PR, the timeline emits two rows for the same
set, date and numbers:

```
August 13  Lying or seated leg curl  LOAD  69.5kg × 8  +2.5kg
August 13  Lying or seated leg curl  E1RM  69.5kg × 8  +5kg
```

The audit fixture produced enough same-set pairs that roughly half its timeline repeated the same
achievement, which also increased the exercise-page PR count. The two PR conditions are independent,
so not every load PR has an e1RM twin. Collapsing same-set pairs into one row with two badges is a
presentation option, not a data-correctness repair.

Exercise names in that list also truncate at 175 px — "Machine chest dip or plate-loaded chest …" —
so you often can't tell which lift the record belongs to.

### 18. Block review numbers are internally inconsistent

The review dialog, on an 8-week seed for a six-week target, exposes two concrete calculation/
labelling defects:

- **"Block complete · 6 weeks · 18 Jun – 13 Aug"** places target length beside an eight-week actual
  range without identifying either, so it reads as contradictory.
- The session line renders **"24 / 18 completed"** beside a percentage derived from
  `volumeCompliance`, not `adherenceRatio`. The fraction and percentage therefore describe
  different measures on one line.

The original comparison with Progress was invalid: a block-wide latest-session count and a
calendar-week summary are different windows. The highlighted recommended strategy already exists.
Remaining concerns — the repeated “Recommendation” wording, a raw 🔒 glyph, and a recommendation
that offers two paths — are copy/visual polish rather than evidence that the calculations disagree.

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

All 18 rows in the audit seed read `Hold · add reps`. That is expected when every exercise receives
the same synthetic history and does not establish a production defect or low-resolution engine.
Treat this as a fixture-quality observation only. A proposal to hide default rows needs product
evidence and is not a validated fix.

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

Entering `-5` or `abc` in Load jump % coerces the stored value back to 2.5 with no explanation.
`commitSettings()` immediately calls `render()`, so the field is reset to 2.5; the original claim
that invalid text remains visible is false. The remaining UX defect is silent correction.

`Target RIR ceiling = 99` is accepted outright, producing `TARGET 4–8 reps · RIR 0–99` in every
workout. Negative `hardRir` and `restSec` values are also replaced by defaults without explanation,
so those are silent resets rather than meaningful rejection. Validation exists, but it neither
defines a complete set of bounds nor tells the user what failed.

### 25. An empty program is a dead end

Saving `[]` through the advanced JSON editor produces a cheerful "Program saved." Today then shows
"Day 1 · 0 exercises" with a live Start workout button that opens a workout shell reading
**"EXERCISE 0 OF 0"** and nothing else — no contextual message or "create a program" CTA.
The header Back action and Settings → Create new program remain escape routes, so “no way forward”
was an overstatement. The accepted empty state is still misleading and should be rejected or
rendered intentionally.

### 26. "View exercises" starts the workout

The secondary link under Start workout sets `body.is-workout` and opens the same workout shell,
just in List mode instead of Focus. Two buttons, same destination, no explanation, and the label
promises a read-only preview. Either make it a genuine preview or rename it "Log as a list".

### 27. Priority-muscle handling has gaps

`applyPriorityMuscles()` (app.js:361–378, slot map at 367–370) maps a missing priority muscle to an exercise slot with a
chain of `includes()` tests and a final fallback of `"curl"`. **Calves has no branch** — selecting
Calves as a priority adds a biceps curl. The function also appends every backfilled exercise to
`program[0].day`, so Day 1 ends up with 7 exercises while Days 2 and 3 have 6.

### 28. Multiple catalogue entries share names

`ar_mc`/`cu_mc` are both "Preacher curl machine"; `ar_db`/`cu_db` both "Dumbbell curl";
`dl_db`/`lr_db` both "Dumbbell lateral raise"; `dl_mc`/`lr_mc` both "Lateral raise machine". Because
dedup is by id, a single generated day can contain two identically-named exercises. Observed:
machine-only full-body long can put two "Preacher curl machine" rows on one day. The filler also
ignores day type, so a leg day can end with a biceps curl. Cable curl versus Preacher curl are not
duplicate names, and reusing an exercise on different training days is not itself an error.

### 29. "Bro split" and "Machine only" don't do what they say

`resolveSplit()` (app.js:338–339) maps `bro` to a push/pull/legs cycle — a 5-day "Bro split" produces
push, pull, legs, push, pull, which is exactly the PPL option. `machine_only` maps to `full_body`
and applies no equipment restriction (that comes from the equipment step), so picking it with Cables
selected yields cable exercises. Both labels promise something the generator doesn't deliver.

### 30. "Advanced" experience is indistinguishable from "Intermediate"

`repScheme()` branches on `experience === "beginner"` only. Beginner gets 2 sets and 8–12 reps;
intermediate and advanced get identical user-visible output in every combination tested (generated
row ids still differ). An onboarding question whose answer is discarded.

---

## P3 — original polish classification

Some items below are accessibility or semantic defects and deserve higher triage than “polish.”
The original grouping is retained for traceability.

- **Contrast.** `--ink-faint` (`#98948C`) on the app background is **2.7:1** — every section label,
  every table header, every eyebrow, the calendar day-of-week row and the settings group labels fail
  AA (needs 4.5:1). The accent `#E04E14` on background is **3.57:1** — every text link, "Edit",
  "Done", "See volume ›", "Cancel", the back links. On card white it's 3.99:1. The disabled Focus
  prev-chevron is **1.31:1** — hard to perceive, although disabled controls are exempt from WCAG
  contrast criteria. Darkening `--ink-faint` to roughly `#6E6A62` and using a separate accent-text
  token around `#B8410E` clears the audited body-text failures without changing brand fills.
- **Tap targets against the product's 44 px standard.** Consistently present under 44 px:
  `#programEditToggle` (34×35), `#viewExercises`
  (358×35), the program editor's ▲/▼/✕ (34×34), the onboarding back chevron (13×44), the install
  banner close (19×21), `select#unit` and `select#lang` (19 px tall), the toggles (51×31), and the
  set-number buttons (24×44). This list is not a claim that every item fails WCAG 2.2's 24×24
  minimum: the selects sit inside larger labels and the toggles meet 24 px. The smallest standalone
  controls remain genuine failures.
- **`#notifyToggle` has no accessible name** — the voice toggle has `data-i18n-aria`, the
  notifications one doesn't.
- **The install banner can overlay content mid-page** because its fixed position reserves no layout
  space; the exact rows covered depend on scroll and data state. Its dismiss target is 19×21 px.
  It is already fixed above the bottom nav; reserve layout space, make it inline, or move installation
  into Settings.
- **History header icons are raw glyphs** — `⌕` and `▤` in the markup, next to a polished masked-icon
  set everywhere else. They read as missing-font artifacts.
- **Program editor ▲/▼ are text triangles** while the delete in the same row uses the icon system.
- **Large dead space in the Focus card.** The flexing ledger creates a measured 218–305 px gap
  between "No sets logged yet" and the input well across the audited portrait sizes — not the
  originally claimed ~450 px or a reservation of one row per configured set.
- **The exercise page header has a selector mismatch.** CSS absolutely positions `.exview__back`,
  but the markup uses `.back-link`, leaving Back and the title touching in the centred flex flow.
- **"Improved" and "Regressed"** on exercise-page rows use the same orange. History summaries use
  the same neutral grey, not orange; the underlying good/bad distinction is still weak.
- **Thin-data formatting.** With one session the trend line reads `Top load 64→64 kg · 0 kg over 1
  session` with an orphan `·` where the direction arrow belongs.
- **Portuguese is partial.** Chrome and labels translate; day names ("Day 1") and the default
  program's exercise names stay English, so a PT user sees `2026-08-13 · Day 3 · Cable pressdown`.
- **Export gives no toast or nearby completion feedback.** Backup JSON does update the last-export
  note after the action, while CSV has no in-app response.
- **Delete all data is semantically wrong.** It uses a native `confirm()` whose message says
  "Delete the training log?", and the handler clears only the log: the program and settings survive
  despite the row label. This is more than visual inconsistency and should be triaged above P3.
- **Repetitive attention copy.** Five consecutive rows reading "Primary muscle under weekly volume
  target." Group them under one heading.
- **`#heatGauge`** is `visually-hidden` but still exposes a control named "forge" to assistive tech.

### Performance at two years of training

The structural measurements reproduce on an equivalent 104-week seed: 3,744 rows, about 1.1 MB in
localStorage, roughly **32,560 History nodes**, a **45,646 px** document and 312 unpaginated session
cards. The audit's absolute boot/render timings and Progress node counts are not retained as current
baselines because it did not record hardware, throttling, cache state or a repeatable timing
protocol.

The History tab builds the full "Every set" table into the DOM on every render whether the
`<details>` is open or not, and the session list has no pagination. That creates a credible
mid-range-device performance risk, but this audit did not reproduce it on an identified Android
device. Also worth noting: localStorage is around 1 MB after two years and browser quotas vary. The
mirror write is wrapped in try/catch and IndexedDB is primary, so data survives when only the mirror
fails. That mirror-only failure emits a warning without alarming the user while durable IndexedDB
storage still succeeds; the user-facing error is reserved for failure of both stores.

---

## The pattern behind the bugs

Four themes account for most of what's above.

**1. Ambiguous labels erase meaningful boundaries.** Program's accepted rolling adherence window
is labelled as a calendar week. The block-review session fraction and adjacent percentage use
different metrics. The volume bar and its number use different denominators. Each is a small bug,
but together they teach the user that the app's numbers are decorative. Name each window and
measure explicitly, then have every surface for that concept read the same computation.

**2. Recommendation normalization and unit formatting are separate contracts.** Four
history-derived recommendation paths bypass the existing `round()` grid. Separately, `fmtLoad`
converts truthful historical values and `kfmt` abbreviates metrics. One universal formatter would
conflate recorded facts with actionable suggestions; centralize each contract without merging them.

**3. The generator's interface overpromises its contract.** Onboarding asks eight questions; the
answers to equipment, experience (advanced), and split type are partly or wholly discarded, and
repeated days come out identical. Honor each exposed answer or explicitly redesign the questionnaire
after a product decision; the audit does not establish which questions should be removed.

**4. Shared dialog and disabled-state primitives are missing.** No `.btn:disabled` rule exists, and
the note sheet's focus/Tab/Escape behavior is not reusable by the other dialogs. The button state is
a small shared style. Accessible dialog handling is a larger interaction primitive covering focus
entry, forward/reverse trapping, inert background, Escape/backdrop close and focus return.

## Validated implementation pass

This is the corrected PR 107 scope, ordered by user impact and dependency risk:

1. **F1:** Round the four history-derived raw recommendation paths, re-entering reps when the target
   changes and preserving ADR 0003's median.
2. **F2/F8:** Clarify calendar-versus-rolling labels and separate elapsed from clamped mesocycle
   display weeks.
3. **F7:** Reject malformed or implausible loads in every interactive persistence path.
4. **F4/F5:** Honor selected equipment throughout generation and rotate repeated day selections.
5. **F6:** Add one unmistakable disabled-button treatment.
6. **F9/F10:** Align overview bars with row targets, sort by deficit and disclose truncation.
7. **F11:** Give the three dialogs shared modal behavior based on the exercise-note sheet.
8. **C1:** Correct the audited body-text contrast failures without changing brand fills.

The implementation brief contains eleven work items because grouped lines above contain F2/F8,
F4/F5 and F9/F10. It intentionally does not include every confirmed finding.

Pound increment policy (F3), early workout finish (F12), landscape (F14), tour accuracy (F15),
History scale and Focus-card space remain follow-up design or implementation work. F13 and F16 are
rejected rather than deferred.

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
