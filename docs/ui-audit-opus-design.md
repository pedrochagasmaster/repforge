# Taurifer UI Audit

**Design audit · against `anthropics/skills` · `skills/frontend-design`**

Taurifer has a real point of view and a genuinely distinctive first screen. What follows it
is a competent utility that keeps quietly contradicting its own design system — and clips the
one number the product exists to show.

| Scope | |
| --- | --- |
| Screens | 70 |
| Committed frames | 215 |
| Themes / locales | 2 / 2 |
| Viewports | 320 / 390 / 430 |
| Text scale | 100% / 200% |

> **Status:** audit only. This document records findings; it does not change behaviour. Nothing
> in it is scheduled until it appears in `docs/backlog.md`.

---

## 01 · Overall assessment

*Read as one product across all 215 frames, not as isolated mockups.*

Taurifer passes the test the frontend-design skill actually sets: it is *not* templated. The warm
paper, the burnt-orange single accent, the Plex Sans/Mono pairing, the hairline-and-whitespace
grammar, and above all the first-run hero — a Milo-of-Croton engraving with a mono-set poem — are
grounded in the subject's own world. Almost nothing here looks like it was generated. That is the
hardest part of the brief, and it is already done.

The problem is that the identity stops at the door. The first-run gate promises an editorial
instrument: centred composition, illustration, typeset verse, real restraint. Everything past it is
a capable but ordinary mobile utility built from bordered boxes, pill chips, iOS toggles and stacked
tab strips. The skill's line about spending your boldness in one place assumes the quiet around it
is *disciplined*. Here it is merely quiet — the restraint reads as absence of decision rather than
as decision.

Underneath that sits a sharper issue. The repository documents a design system in
`docs/brand-guide.md` — "no cards, no borders-as-boxes", "no drop shadows on surfaces", "one accent
used sparingly" — and the shipped CSS contradicts all three. When the written system and the built
system disagree, every new screen re-litigates the rules, which is exactly the drift visible across
these frames: three stat-strip variants, three sheet-dismissal patterns, two set-entry components
for the same task, four date formats, three vocabularies for the same lift outcome.

> **The most damaging single defect is not stylistic.** On a progressive-overload tracker, the
> Strength and Volume tables are 520 px wide inside a 358 px column — so the change-versus-previous
> column, the number the entire product exists to produce, is off-screen by default with no
> scrollbar, no fade, and no cue that anything is there.

Accessibility is the other systemic gap, and it is measurable rather than arguable. The accent is
used for small interactive text throughout at 3.57:1 against paper. Control borders sit at 1.17:1
against a 3:1 requirement. At 200% text — a variant this repo deliberately captures — headings
overflow the viewport horizontally and segmented controls clip their labels mid-word. The catalog is
already photographing these failures; nothing is currently reading them.

### The specimen bench

Every colour below is taken from `:root` in `styles.css` and measured against `--bg #F4F2EF`.
AA for normal-size text is 4.5:1.

| Token | Hex | Role | Contrast | Verdict |
| --- | --- | --- | ---: | --- |
| `--ink` | `#1B1A17` | body and headings | 15.57:1 | **Pass** |
| `--accent` | `#E04E14` | links, eyebrows, "Cancel", "Edit" | 3.57:1 | **Fail** |
| `--accent-deep` | `#B8410E` | "Replace exercise" | 4.95:1 | **Pass** |
| `--danger` | `#C93A2B` | "Remove exercise", errors | 4.56:1 | Edge |
| `--positive` | `#2F7D33` | used in only 4 CSS rules | 4.58:1 | Edge |
| `--ink-soft` | `#6E6A63` | secondary prose | 4.81:1 | Edge |
| `--ink-faint` | `#716D66` | tertiary prose — 5.2 RGB from `--ink-soft` | 4.60:1 | Edge |
| `--rule` | `#E4E1DA` | chip, input and radio borders | 1.17:1 | **Fail** |

**Two structural results.** The accent fails AA wherever it carries text below 18.7 px bold — which
is most of its uses. And `--rule` is doing double duty as a decorative hairline *and* as the visible
boundary of interactive controls; at 1.17:1 it clears the first job and fails the second
(WCAG 1.4.11 requires 3:1).

---

## 02 · Recurring system-level problems

*Ranked by product impact. These are patterns, not one-off slips — each recurs across multiple
flows, so each needs a system fix rather than a screen fix.*

### SYS-01 · Critical — The product's core number is off-screen by default

Progress → Strength and Progress → Volume render a table with a hard `min-width:520px` inside a
scroll container. At the canonical 390 px viewport the content column is 358 px, so roughly 162 px
is always hidden. Mobile scrollbars are suppressed, so the only cue is a header sliced mid-word.

The hidden column is *Δ e1RM* on Strength and the fourth completion column on Volume. For an app
whose whole thesis is progressive overload, the delta is the payload — and it is the part nobody
sees.

```
styles.css:1746–1747
.table{…overflow:auto…}
table{width:100%;border-collapse:separate;border-spacing:0;min-width:520px}
```

```
Visible in
progress/strength__phone-390-light-en.png — header reads "Δ E", values read "+3", "+6"
                                            against the right edge
progress/volume__phone-390-light-en.png   — header reads "COMP"
```

> skill · "Structure is information" — a column that is never seen encodes nothing.

### SYS-02 · Critical — Internal identifiers reach the user in error copy

The Build-a-program editor's primary validation error prints raw compiler tokens. This is the
most-read string on a blocked screen, and it is the one place the machine's vocabulary leaks
completely.

```
onboarding-build/editor-empty__phone-390-light-en.png
"Add an exercise to: day_empty:manual_d1, day_empty:manual_d2, day_empty:manual_d3."
```

A second copy collision ships on the exercise detail page in both themes: a label and a link render
adjacent with no separator, producing *"Understand Why this weight?"* — where the same control reads
simply "Why this weight?" on the workout screen.

> skill · "Name things by what people control and recognize, never by how the system is built."
> Brand guide · "Name the fact or action."

### SYS-03 · Critical — 200% text breaks layout, and the catalog already proves it

The manifest deliberately captures a `text200` variant. Two of those frames show hard reflow
failures that no test is currently reading.

```
onboarding-recommend/result__…-text200.png
H1 renders "Recommende" — "Recommended program" overflows the viewport horizontally
instead of wrapping.

onboarding-custom/priorities__…-text200.png
Segmented control clips labels mid-word: "Prioritiz", "De-emphas".
Four fixed tracks that never reflow to a column.
```

This is WCAG 1.4.4 (Resize Text) and 1.4.10 (Reflow). It is also the cheapest class of bug to
prevent, because the evidence is regenerated on every commit.

> skill · "Build to a quality floor without announcing it: responsive down to mobile…"

### SYS-04 · Major — The documented design system and the built one disagree

`docs/brand-guide.md` states three rules that the stylesheet does not follow. Because the doc is
treated as authoritative for new work, every screen re-decides them independently — which is the
mechanism behind most of the inconsistency below.

| Claimed | Built |
| --- | --- |
| "no cards, no borders-as-boxes" | focus-mode card, chart card, entry-hub selected card, program-editor nested boxes |
| "No drop shadows on surfaces (`--shadow:none` is deliberate)" | `box-shadow` at `styles.css` lines 439, 751, 1201, 1257, 2098, 2124, 2181, 2250, 2405, 2413, 2526, 2550 |
| "Never decorative washes or large orange fields" | rest-timer ring, PR badge bands, analytics toggle, session-summary volume bar |

Either the rules are real and the CSS should be brought back to them, or the CSS is right and the
guide is a decade of good intentions. Both are defensible; the current split is not.

### SYS-05 · Major — One concept, three vocabularies and two colours

"Did this lift go up?" is the app's central question, and it is answered in a different language on
every surface that asks it.

```
Same concept, three lexicons
Progress → Overview  ·  improved / stable / attention
Progress → Review    ·  improved / flat / stalled
Session summary      ·  improved / regressed
```

```
Same concept, two colours
progress/exercise-chart · "▲ 5 kg over 2 sessions" in --positive green
progress/prs            · "+2.5kg" in --accent orange
session/summary         · "+87.5 kg over your best" in --accent orange
```

Dates fare no better: *Monday, August 31* (Today), *SUN · 30 AUG* (History list), *August 30*
(PRs), *2026-08-21* (exercise chart), *08/30/2026* (History edit). Five formats, one app.

> skill · "An action keeps the same name through the whole flow… Cohesion and consistency are how
> people learn their way around."

### SYS-06 · Major — Disabled controls outweigh enabled ones

The primary-action-disabled state is a filled grey pill with white text and a live orange arrow.
Beside it, the enabled secondary is a white outlined pill. The heavier, more saturated, more
arrow-bearing element is the one you cannot press.

```
Recurs in
onboarding-build/editor-empty   · "Save draft" (enabled, outlined)
                                  vs "Use this program" (disabled, filled grey + orange arrow)
onboarding-recommend/schedule   · "Back" (enabled, outlined)
                                  vs "Continue" (disabled, filled grey)
```

White on the grey fill also lands near 3:1, so the disabled label is itself hard to read — the state
is signalled by contrast failure rather than by design.

### SYS-07 · Major — Core components exist in three or more variants

Repeated objects are not composed as one object, so the app teaches its grammar three times.

```
Stat strip
3-up with dividers      (Progress overview, Program, Session summary)
4-up with dividers      (exercise chart)
4-up without dividers   (library exercise detail)
3-up as a bordered card with orange icons (Recommend review)
```

```
Set entry — same task, two components
workout/list  · boxed −/value/+ steppers in a row, "SAVE" as an outlined box
workout/focus · large mono numerals with an underline rail, −/+ beneath,
                "Log set" as a filled black pill
```

```
Sheet dismissal
× top-right (rest timer) · "Close" top-right (library) · "Close" bottom-left (share setup)
```

```
Selected chip
black fill (library "All") · orange outline + pale wash (rest-timer "2:00")
· orange outline + wash on a card (entry hub)
```

> skill · "Compose repeated things as one object… same edges, baselines and inner padding from one
> to the next."

### SYS-08 · Minor — The type hierarchy has two tokens for one tier

`--ink-soft #6E6A63` and `--ink-faint #716D66` are 5.2 units apart in RGB. They are the same
colour. The system believes it has three text tiers; the eye receives two, which is why secondary
and tertiary content flattens together on dense screens like Settings and the Recommend review.

Similarly `--accent-deep #B8410E` and `--danger #C93A2B` sit side by side on the program editor as
"Replace exercise" and "Remove exercise". The semantic distinction is correctly encoded in the
tokens but reads as two shades of the same warm red at 15 px.

---

## 03 · Screen-specific issues

*Defects tied to a single surface. Screen paths are relative to `docs/ui-screens/screens/`.*

| Screen | Sev | Issue |
| --- | --- | --- |
| `history/session` | Crit | Expanding a past session drops into a raw edit form: a native `MM/DD/YYYY` date input with the browser's own calendar icon, boxed kg/reps/RIR fields, and a per-row × delete. Exercise names — the only useful scanning key — are the one thing truncated ("Assisted pull-up…"), while the destructive × gets a full-size control. Reading and editing should not be the same view. |
| `progress/overview` | Major | Headline reads "Needs more data" directly above a confident 10-item Attention list. All ten rows carry an identical orange dot, identical weight and the same one-line reason, so the list ranks nothing — a repeated marker that encodes no difference is decoration. |
| `progress/review` | Major | A bold label/value block is followed by a paragraph restating the same four numbers in prose. The single actionable output — "Repeat with a simpler schedule." — is the last clause of that paragraph with no control attached. Roughly 45% of the screen is empty below it. |
| `progress/prs` | Major | The LOAD / E1RM badges stretch to ~45% of screen width instead of hugging their text, producing a pale-orange band down the left column. Exercise names are right-aligned against ragged load and delta values, so nothing shares an edge. |
| `library/list` | Major | Equipment filter chips visibly overlap — "Barbell" is drawn over "Chest" with a doubled outline — and the row clips at "Ma…". The screen also stacks five navigational systems (Back/Close, "Step 1 of 2" progress, search field, Search/Browse/Yours tabs, filter chips) above the first result. |
| `program/progression-editor` | Major | "REP RANGE" and "MIN" labels collide vertically. Three levels of nested bordered containers (day → exercise → field). "Replace exercise" and "Remove exercise" sit as equal-weight adjacent links despite one being destructive. |
| `program/share-setup` | Major | "Copy link" is the sheet's only action and is styled as its weakest element — grey text in a white outlined pill, indistinguishable from disabled. A seven-line privacy paragraph carries the visual weight instead. |
| `today/done` | Minor | "1 of 3 sessions completed" appears twice on one screen, and three separate progress encodings coexist: the six-segment mesocycle bar, the sentence, and the M–S week dot strip. |
| `workout/list` | Minor | The exercise name renders twice — as the heading and again inside a text field below it. Four right-hand controls (chevron, timer, SKIP, disclosure) crowd a wrapping two-line title, and SKIP is bare text among boxed siblings. |
| `workout/focus` | Minor | The header timer changes geometry when running (square button → pill with dot and countdown), shifting the centred "Day 1" title left by ~44 px mid-session. Below the last-session table the card holds ~150 px of empty white. |
| `install/tour` | Minor | "Skip tour" renders as a square-cornered orange box — the only square corner in the app, reading as a stray focus ring. The tour is 11 steps and opens on a dense privacy disclosure rather than an action. |
| `onboarding-recommend/preview` | Minor | Orange icons in the stat card sit directly above grey icons in the list below — one icon system, two colours, adjacent. Cells wrap unevenly ("49 working sets" over two lines) against top-aligned icons, so baselines never settle. Program name "Build Muscle" is Title Case where Program overview writes the same goal as "Build muscle". |
| `settings/main` | Minor | Content sits at a 32 px gutter against 16 px everywhere else (`--settings-inset` nested inside page padding). Deliberate per the CSS comment, but it makes Settings read as a different app. Sub-label patterns also differ row to row: inline under the title (Notifications) vs a paragraph under the whole row (voice input). |
| `settings/privacy` | Minor | The analytics opt-in toggle, when on, is a filled orange pill — the most saturated element on the screen. A privacy control should not be the loudest thing in Settings. |
| `session/summary` | Minor | "4 improved" gets a green outlined pill; "1 regressed" gets a neutral grey one — the item needing attention is the quieter of the two. The "hard sets by muscle" bar runs full-bleed orange at what appears to be 100% for 1.5 sets, and is clipped by the Done button. |
| `workout/rest-timer` | Minor | A ~200 px orange ring and a filled orange circle button stack in one sheet — two dominant orange fields against a "used sparingly" rule. Control glyph weights are mixed: hairline −/+ beside a solid square Stop and a stroked Reset. |
| `onboarding-build/editor-empty` | Minor | Day 1 carries a hamburger handle where Days 2–3 carry chevrons, so identical rows offer different affordances. The error text and the "Add exercise" link are near-identical warm reds. "Cancel" sits inline with a 44 px title here but above the title on sibling routes. |
| `program/overview` | Minor | The expanded Day 1 ends in "See details ›" while collapsed Day 2 shows only "›" on the header row — visually equivalent rows, one expanding and one navigating. "0 ready" in the stat strip names no recognizable quantity. |

### One deliberate divergence, flagged rather than filed

The bottom dock drops its floating-capsule treatment for a flat full-width bar inside the installed
program editor. A CSS comment says this is intentional, so it is not a bug — but it means the app's
single most persistent piece of chrome changes shape on one screen, and the reason ("the four
destinations remain quiet while editing") is served just as well by dimming the existing dock. Worth
revisiting; not worth ranking.

---

## 04 · Recommended changes, by impact

*Ordered so that each step makes the next cheaper. The first four are correctness; the rest are
identity.*

### 1 · Give the delta a home that fits the phone

Drop the 520 px table on Strength and Volume and render each row as a two-line list item — name and
latest on line one, best and Δ on line two — the pattern History and Program already use
successfully. If the table must stay, the Δ column has to lead rather than trail, and the scroll
needs an edge fade so it is discoverable.

This is the single change that most improves the product, because it restores the number the product
is for.

*Addresses SYS-01 · `progress/strength`, `progress/volume`*

### 2 · Fix the two leaked strings, then gate the class of bug

Replace the `day_empty:manual_d1` token list with day names ("Add an exercise to Day 1, Day 2 and
Day 3."), and separate the collided "Understand" / "Why this weight?" strings on the exercise detail
page.

Then add an assertion to the i18n suite that no rendered string matches `/[a-z_]+:[a-z0-9_]+/`. The
repo already tests key parity and control-name pairing; this is the same shape of test.

*Addresses SYS-02 · `onboarding-build`, `library/exercise-detail`*

### 3 · Raise the accent for text, and split the rule token

Two token changes clear most of the accessibility debt at once. Use `--accent-deep #B8410E` (4.95:1)
wherever the accent carries text below 18.7 px — links, eyebrows, "Cancel", "Edit", "Why this
weight?" — and reserve `--accent #E04E14` for large numerals, rails, dots and fills where it already
passes.

Then introduce `--rule-control` at ≥3:1 for anything with a hit target — chips, radios, steppers,
inputs — and leave `--rule` at 1.17:1 for decorative hairlines, which is the job it is actually good
at.

While in the palette: collapse `--ink-faint` into `--ink-soft` or push it to a genuinely distinct
value. Two names for one colour is a hierarchy the design cannot spend.

*Addresses SYS-08 · global · WCAG 1.4.3 / 1.4.11*

### 4 · Make the text200 frames a gate, not a photograph

The capture tool already produces these frames. Extend `tools/compare-ui-screens.mjs`, or add a
check beside it, that fails when `scrollWidth > clientWidth` on the document at any captured
variant. That one assertion catches both the overflowing H1 and any future instance of it.

Separately, the four-track emphasis control needs to wrap to a column below ~340 px of available
width rather than clip its labels.

*Addresses SYS-03 · `onboarding-recommend`, `onboarding-custom`*

### 5 · Settle one vocabulary and one date format

Pick a single triad for lift outcome — *improved / stable / needs attention* reads best and already
matches the Attention board — and use it on Overview, Review and the session summary alike. Retire
"flat", "stalled" and "regressed" from the catalogs.

Then bind improvement to one colour. `--positive` appears in only four CSS rules today, which means
green is currently an exception rather than a semantic; either commit to it for all gains and demote
orange to pure accent, or drop `--positive` and let orange carry it everywhere. Both work. The split
does not.

Dates: one long form ("Monday, 31 August") for Today, one short form ("Sun · 30 Aug") for lists, and
never the browser's native `MM/DD/YYYY` in a locale-switching app.

*Addresses SYS-05 · `i18n-en` / `i18n-pt`*

### 6 · Separate reading from editing in History

Expanding a session should show the session: exercise, load × reps, RIR, and what changed against
last time — full names, no inputs, no delete affordance. Put editing behind an explicit "Edit
session" action, which is also where a native date field becomes acceptable because the user asked
for it.

*`history/session`*

### 7 · Reconcile the brand guide with the stylesheet, then hold one line

Decide whether cards and shadows are in the system. Given that focus mode, the chart, sheets,
modals, toasts and the dock all already depend on them, the honest answer is yes — so amend the
guide to describe elevation as a real, bounded tier (which surfaces may lift, and by how much),
rather than leaving a "no shadows" rule that twelve rules already break.

Then consolidate the component variants that drift filled the gap with: one stat strip, one
set-entry component shared by list and focus mode, one sheet header, one selected-chip treatment,
one disabled-button style that is visually lighter than its enabled sibling.

*Addresses SYS-04, SYS-06, SYS-07 · `docs/brand-guide.md`*

### 8 · Carry one thread of the first-run identity into the app

The strongest work in this repository is the first-run gate, and it currently ends at the threshold.
Choose one device from it and let it recur: the letterspaced wordmark treatment, the mono face used
for something other than digits, or the generous centred measure. One is enough — the skill's point
is that boldness is spent in a single place, not that it appears once and is never referenced again.

The best candidate is the session summary. It is already the app's ceremonial moment, it already
uses a centred composition and an eyebrow, and it is the one screen where a reader is finished
rather than working.

*`session/summary` · brand coherence*

---

## 05 · What is working, and should survive the fixes

*A refactor of this size can easily sand off the things that make Taurifer not generic. These are
the load-bearing ones.*

### The first-run hero

A bull-horned monogram, a Milo-of-Croton engraving, and a poem typeset in mono with hand-authored
line breaks that travel with the translation. It is grounded entirely in the subject's own world, it
takes a real aesthetic risk, and it is the clearest evidence in the repo that a person made
decisions here. Do not touch it.

### The refusal to fill the empty exercise tiles

96 licensed illustrations, 174 movements that deliberately render an empty tile, and a documented
rule against filling the gap with initials or silhouettes. Holding that line is harder than breaking
it, and it is why the illustrated tiles read as real rather than as stock.

### The copy discipline

Sentence case throughout, zero exclamation marks in either catalog, toasts as complete sentences,
and a tested rule that a string naming a control repeats that control's exact label. "Time is a
ceiling, not a volume target." is a genuinely good line. The failures catalogued above are lapses
*from* a real standard, not the absence of one.

### Mono for data, sans for prose

Plex Mono on loads, reps, RIR, timers and table figures against Plex Sans everywhere else is the
right call and is applied consistently. It gives the numbers — the actual content — a distinct
voice, and it is the one typographic decision that already does what the skill asks of type.

### The recommendation block

An orange left rail, a small caps eyebrow, a plain-language verdict ("Hold 105 kg"), the reasoning
in one sentence, and an inspector link. It states a fact, gives the evidence, and offers a way to
check the work — exactly the "quiet training partner" the brand set out to be, and the only
component that appears identically on three surfaces.

### The onboarding's honesty

"Same answers and rules always produce the same result." "Editable draft. The active program stays
until you confirm." "Nothing had to be traded off." A generative flow that tells you it is
deterministic, shows its compromises, and refuses to write anything until you press an explicit
button is a rare and genuinely trust-building piece of interaction design.

### The screen catalog itself

70 screens, 215 frames, every onboarding state, both themes, both locales, three viewports, 200%
text, reduced motion — regenerated on every user-visible change and failing CI on drift. Most
products this size have no visual record at all. Every finding in this audit was read out of it,
which is the strongest possible argument for keeping it.

---

## Method

- Reference standard: `anthropics/skills` · `skills/frontend-design/SKILL.md`, fetched in full.
- Evidence: committed PNGs under `docs/ui-screens/screens/`, read directly; `styles.css` token and
  rule inspection; `docs/brand-guide.md`.
- Contrast figures computed from `:root` hex values using the WCAG 2.x relative-luminance formula.
- Audit only — no application code, styles, copy or screens were modified in producing it.
