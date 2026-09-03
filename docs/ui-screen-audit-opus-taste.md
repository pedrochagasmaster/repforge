# Taurifer Screen Audit

**Design and UX audit / September 2026**

Seventy-one committed screens read as one product, measured against the taste-skill anti-slop
rules. The foundations are unusually good. The failures are almost all drift: the app stopped
obeying a system it already documents well.

| | |
| --- | --- |
| **Corpus** | 71 screens, 218 frames. Light + dark, EN + PT, 320/390/430px, 200% text |
| **Reference** | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill): `skills/taste-skill` + `skills/imagegen-frontend-mobile` |
| **Method** | Screenshot review, cross-checked against `styles.css` and `i18n-en.json` |
| **Changes made** | None. Audit only. |

> **On the reference standard.** taste-skill declares itself out of scope for "dashboards, dense
> product UI, data tables, multi-step forms and wizards," which is most of Taurifer. I have applied
> the parts that do transfer and said so where a rule was written for a landing page: sections 4.2
> colour lock, 4.4 shape lock, 4.5 interactive states, 4.9 content density, 4.11 theme lock, 6
> accessibility, 8 dark mode, 9 AI tells, 11 audit protocol, 14 pre-flight. For ergonomics, density
> and navigation I used the repository's mobile skill, which is written for exactly this surface.
>
> Every finding below cites a committed frame you can open, and the code-level ones cite a line in
> `styles.css`. Nothing here is inferred from the description of a screen I did not look at.

---

## 01. Overall assessment

Taurifer does not look AI-generated, and that is not a small thing. It clears the anti-slop bar that
most product UI fails: no purple gradient, no glassmorphism, no three equal feature cards, no Inter,
no stock illustration. It has a real typeface pair (Plex Sans and Plex Mono), a real accent it
commits to, a warm neutral that was chosen rather than inherited, commissioned engraving-style
artwork nobody else has, and a dark theme built as a token swap with a documented rationale in the
stylesheet comments. The stylesheet reads like it was written by someone with a point of view.

The problem is that the point of view stopped being enforced. `styles.css` opens by declaring the
system in one line: *"Separation via hairline rules and whitespace, not cards,"* with
`--shadow:none` and a single `--radius:14px`. The older surfaces obey it and they are the best
screens in the catalog. The newer surfaces, mostly onboarding and the program editor, do not: they
are built from bounded white cards nested three and four deep, using seventeen different corner
radii and roughly thirty-five font sizes, none of which are tokens. Two design languages now ship
side by side.

The second failure is that the Progress tab and the History tab put desktop data tables on a 390px
phone. Three of them clip a column off the right edge of the viewport with no scroll affordance.
This is the single most visible quality problem in the product and it recurs on the surface that is
meant to prove the app's value.

Third, and most fixable: there is a small set of outright shipped defects sitting in the committed
catalog. A raw internal identifier printed in an error message. Two labels colliding because of a
negative margin. Filter chips overlapping each other. A disabled button at roughly 2.5:1 that the
stylesheet elsewhere explicitly warns against. These are not taste calls. They are bugs that a
reviewer looking at the catalog would catch, which suggests the catalog is being regenerated but not
read.

Read as a coherent product rather than as mockups: the daily loop (Today, log, save, summary) is
confident and would survive a design review at any serious consumer app. The analysis layer and the
onboarding wizard read as a different, less finished product bolted onto it. The gap between them is
the whole audit.

---

## 02. System-level problems

Ten recurring failures. Each appears on at least three screens, so each is a system fix rather than
a screen fix.

### S1. Desktop data tables shipped to a 390px phone, with columns clipped off-screen

`BLOCKING` · *Mobile skill 29, 31 / taste 4.9*

Progress / Volume renders a four-column table of fourteen muscle rows. The fourth column is cut
mid-header at the viewport edge: the user sees `MUSCLE / PLANNED / COMPLETED 7D / COMP` and nothing
more. Progress / Strength does the same with twelve rows and a truncated `Δ E` column. The
per-exercise chart repeats it with `Δ VS PREV`. There is no horizontal scroll affordance, no shadow
at the cut edge, no responsive collapse.

Both skills forbid this directly. taste-skill 4.9: a long row list with a hairline under every row
"is the WORST default," and lists over five items need a different component. The mobile skill's
density rule is blunter: if the layout forces the type down or the content off the screen, split the
screen or change the component. Fourteen rows of five-digit data is not a phone table.

**Evidence**

- `screens/progress/volume__phone-390-light-en.png`
- `screens/progress/strength__phone-390-light-en.png`
- `screens/progress/exercise-chart__phone-390-light-en.png`

### S2. Text at 200% overflows and clips, rather than wrapping

`BLOCKING` · *Taste 14 pre-flight / WCAG 1.4.4*

The catalog captures a 200%-text variant, which is good practice, but the captures show it failing.
On the Recommend result screen the h1 renders as *"Recommende"* with the final letter cut off past
the right edge of the viewport: a hard overflow, not a wrap. On the Custom priorities screen every
segmented button clips its own label, producing *"Prioritiz"*, *"De-emphas"*, and a *"Normal"*
touching its own border.

The root cause is the same in both: fixed-width containers on text that is allowed to scale. Four
equal-width buttons in a row cannot survive a 2x text scale on a 390px viewport under any
circumstances, which makes this a component-choice problem rather than a CSS-tuning problem.

**Evidence**

- `screens/onboarding-recommend/result__phone-390-light-en-text200.png`
- `screens/onboarding-custom/priorities__phone-390-light-en-text200.png`

### S3. Internal identifiers and unfinished copy reach the user

`BLOCKING` · *Taste 4.9 copy self-audit*

The Build editor prints, as its validation message: *"Add an exercise to: day_empty:manual_d1,
day_empty:manual_d2, day_empty:manual_d3."* The catalog string in `i18n-en.json` is correct
(`"Add an exercise to: {days}."`); the interpolation in `app.js` is passing raw internal day keys
where human day labels belong.

Two more copy defects sit in the same class. The library detail screen renders *"Understand Why this
weight?"* as two orange fragments at two different sizes butted together, reading as one broken
sentence. The Recommend result injects the user's sentence-cased answers mid-sentence, producing
*"Written for a Full commercial gym."* and *"Built around Balance muscle and strength."*

**Evidence**

- `screens/onboarding-build/editor-empty__phone-390-light-en.png`
- `screens/library/exercise-detail__phone-390-light-en.png`
- `screens/onboarding-recommend/result__phone-390-light-en.png`

### S4. The stylesheet's stated system is not the shipped system

`STRUCTURAL` · *Taste 4.4 shape lock / mobile 15*

The file header commits to hairlines and whitespace over cards, and sets `--shadow:none` with one
`--radius:14px`. Counted across the file, the token is used 22 times against 22 uses of a literal
`12px`, 17 of `10px`, 17 of `999px`, 12 of `8px`, and single digit counts of `9px`, `7px`, `6px`,
`5px`, `4px`, `3px`, `2px`, `1px`, `11px`, `16px`, `18px` and `20px`: seventeen distinct radii, with
the token used under half the time.

Type is the same story. Around thirty-five distinct declared sizes coexist, mixing px and rem, with
six near-identical body sizes (12, 13, 14, 15, 16, 17) carrying no semantic distinction between
them. There is no type scale token in the file at all. Meanwhile `11px` appears 47 times and `10px`
12 times, which is where the mobile skill's rule bites: "if the text feels small, the design is not
finished yet."

The visible consequence is that the onboarding and program-editor surfaces read as a different
product from Today and Program: bounded white cards nested three and four levels deep, where the
older screens use rules and space.

**Evidence**

- `styles.css` header comment, `:root` at lines 14 to 92
- `screens/program/progression-editor__phone-390-light-en.png` (card in card in card in field)
- `screens/onboarding-custom/priorities__phone-390-light-en.png`

### S5. One interaction, many components

`STRUCTURAL` · *Taste 4.4, 4.5 / mobile 14*

The same job is done by a different control on almost every screen it appears on. This is the
clearest signal that the catalog is a set of screens rather than a system.

- **Number steppers, three designs.** Workout list mode joins minus and plus to the value in a
  filled pill. Focus mode puts minus and plus below the number with a rule under it. The program
  editor uses a full-width three-cell bordered control. Same value, same gesture, three components.
- **Bottom navigation, two components.** Every tab screen uses a floating glass capsule with a white
  pill behind the active item. The program editor uses a flat, edge-to-edge bar with a top hairline
  and no pill. Confirmed in both light and dark.
- **Dismiss actions, four labels.** Cancel, Close, Done and Back, with Close appearing in orange on
  one sheet and grey on another, and Back rendered as a chevron link on one screen and a bordered
  button on the next.
- **Row disclosure, three glyphs.** A day row ends in a chevron on Program overview, a hamburger on
  the Build editor, and a vertical kebab in the program editor.
- **Selection state, three languages.** A plain radio in a detached card (Recommend step 1); a left
  orange rail plus tint plus filled radio (Environment); a tinted bordered button (Priorities). All
  mean "pick one."
- **Skip, two representations.** The word `SKIP` in list mode, an unlabeled `>|` glyph in focus mode.

**Evidence**

- `screens/workout/list__phone-390-light-en.png` vs `screens/workout/focus__phone-390-light-en.png`
  vs `screens/program/progression-editor__phone-390-light-en.png`
- `screens/program/progression-editor__phone-390-dark-en.png` (flat nav, both themes)
- `screens/onboarding-recommend/environment-correction__phone-320-light-en.png`

### S6. "Improvement" is encoded three different ways

`STRUCTURAL` · *Taste 4.2 colour lock*

A lift getting better is the emotional core of a progressive-overload app. The product says it in
three unrelated visual languages: green text with a triangle on the exercise chart (*"▲ 5 kg over 2
sessions"*), a green outlined pill on the session summary (*"4 improved"*), orange text in the PR
list (*"+2.5kg"*), and plain black digits in the Strength table (*"+3"*). The `--positive` token
exists and is correct; it is the usage that is inconsistent.

Two knock-on problems. Green appears nowhere else in the product, so its two appearances read as
accidents rather than a semantic layer. And on the session summary the pair is asymmetric: *"4
improved"* is green while *"1 regressed"* is undifferentiated grey, so the negative half of the
comparison has no encoding at all.

**Evidence**

- `screens/progress/exercise-chart__phone-390-light-en.png`
- `screens/session/summary__phone-390-light-en.png`
- `screens/progress/prs__phone-390-light-en.png`
- `screens/progress/strength__phone-390-light-en.png`

### S7. Redundant progress indicators, and an eyebrow above everything

`STRUCTURAL` · *Taste 9.F, 4.7 eyebrow restraint*

Focus mode shows the user's position in the session four times on one screen: *"Day 1 / Week 4"* in
the header, *"EXERCISE 1 OF 5"* with arrows, a five-segment progress bar under it, and *"SET 1 OF
3"* inside the card. The onboarding wizard pairs *"SECTION 1 OF 5"* with a five-segment bar saying
the same thing. The tour pairs *"TOUR · 1 OF 11"* with eleven dots. Today shows the week three ways:
a six-segment block bar, the string *"1 of 3 sessions completed"*, and then the same string again
under *"THIS WEEK"* with a weekday dot strip.

The eyebrow is a defined component (`.eyebrow`, 11px, 600, uppercase, 0.08em) and it is applied to
nearly every group in the product. Settings alone carries six. taste-skill caps eyebrows at one per
three sections and calls it the most-violated rule in production tests; the honest translation for
product UI is that when every group is labelled, the labels stop ranking anything. Progress /
Overview stacks two eyebrows and a micro-sentence before the first row: *ATTENTION · 10*, then
*VOLUME LOW*, then *"Primary muscle under weekly volume target."*

**Evidence**

- `screens/workout/focus__phone-390-light-en.png`
- `screens/today/done__phone-390-light-en.png`
- `screens/progress/overview__phone-390-light-en.png`
- `screens/settings/privacy__phone-390-light-en.png`

### S8. Dark mode is strong, with three specific parity breaks

`STRUCTURAL` · *Taste 4.11 theme lock / 8.B parity*

The dark theme is the best-executed part of the system: a genuine token swap, hierarchy preserved,
the CTA correctly inverting to a light pill, and the accent moving up rather than down. The
stylesheet comment explaining why is better than most teams write. Three things break it.

- **The exercise illustrations keep a cream background in dark mode.** The library list in dark
  renders six bright cream tiles punched into a near-black list. This is 4.11's theme lock failing
  at the asset layer: a light-mode island inside a dark page.
- **The destructive-action distinction collapses in light mode.** In the program editor, "Replace
  exercise" and "Remove exercise" are clearly separated in dark (orange versus pink). In light,
  `--accent-deep` and `--danger` are close enough that both read as the same orange-red, so the
  destructive action loses its warning.
- **Surface elevation nearly vanishes.** `--bg:#141310` against `--surface:#1E1C18` leaves borders
  doing all the separation work, so the workout logger's input boxes almost disappear into the
  ground.

**Evidence**

- `screens/library/list__phone-390-dark-en.png`
- `screens/program/progression-editor__phone-390-dark-en.png` vs the light frame
- `screens/workout/list__phone-390-dark-en.png`

### S9. The floating dock occludes the last row on every scrolling tab

`POLISH` · *Mobile 13 safe areas / 15*

The dock is a fixed capsule of `--dock-h` plus `--dock-gap`, and `--nav` exists as the token that
everything floating is supposed to measure against. The scroll containers on History, Progress /
PRs, Progress / Overview and Today / done do not reserve it: the final row sits half-covered by the
capsule with no fade, which reads as a rendering error rather than as "keep scrolling."

**Evidence**

- `screens/progress/prs__phone-390-light-en.png` (last row bisected)
- `screens/history/session__phone-390-light-en.png`
- `screens/today/done__phone-390-light-en.png` ("UP NEXT / Day 2" clipped)

### S10. Copy tells: the middle dot as universal glue, and one em-dash

`POLISH` · *Taste 9.F separator ration / 9.G dashes*

`i18n-en.json` contains 53 middle dots. taste-skill rations the middle dot to one per line and warns
against using it as the default separator for everything. Taurifer routinely runs two or three on a
line (*"Progresses by Heavy set and lighter sets · Rep range · Total reps."*), and the Browse header
wraps mid-strip leaving an orphan dot dangling at the end of the first line.

There is exactly one em-dash in the product, and it is in the first thing a new user reads:
*"Strength, then, is yours —"* on the first-run manifesto. There are also 16 en-dashes used as range
separators (*"4–8 reps"*, *"49–55 minutes"*), which 9.G also bans. Both counts are low, which makes
this cheap to close out entirely rather than argue about.

One PT defect worth naming: the entry hub labels a section *"A TAURIFER ESCREVE-O"* (feminine
article) three lines above body copy reading *"O Taurifer escolhe a estrutura."* (masculine). The
brand's grammatical gender contradicts itself on one screen.

**Evidence**

- `i18n-en.json`: 1 em-dash, 16 en-dashes, 53 middle dots
- `screens/onboarding-start/first-run__phone-390-light-en.png`
- `screens/onboarding-browse/catalogue__phone-390-light-en.png` (orphan separator)
- `screens/onboarding-start/hub__phone-390-light-pt.png`

---

## 03. Screen-specific issues

Problems that live on one screen rather than across the system, ordered by how much of the product's
value they sit in front of.

### First run: the primary action is below the fold, behind a 55-word poem

`BLOCKING` · *Taste 4.7 hero rules*

The 390 x 844 capture shows, in order: wordmark, a three-line centered headline, the illustration,
thirteen hard-wrapped lines of manifesto, the line *"Choose how you want to begin."*, a *PROGRAM*
eyebrow, and then "Create a program" clipped at the very bottom edge. The user must scroll before
they can act. taste-skill 4.7 treats this as shipping broken work: the CTA is visible without
scroll, the headline is two lines maximum, and subtext caps at 20 words. This is three lines and
roughly 55 words.

The manifesto is also the single strongest AI-copy tell in the product under 4.9 and 9.F:
hard-wrapped free verse, an em-dash as a rhetorical pause, and the performative-craftsman register
the skill specifically names. That said, the *artwork* is the opposite of a tell and should not be
touched. The fix is to cut the poem to two lines or move it below the entry options, not to strip
the screen.

Secondary: *"Choose how you want to begin."* functions as a section heading but is set in grey at
lower contrast than the body above it, inverting the hierarchy.

**Evidence**

- `screens/onboarding-start/first-run__phone-390-light-en.png`
- `screens/onboarding-start/first-run__phone-320-light-en.png` (worse at 320)

### Build editor: a disabled CTA at roughly 2.5:1, in a pattern the stylesheet already fixed

`BLOCKING` · *Taste 4.5 button contrast*

The "Use this program" button renders as a mid-grey fill with washed white text and an orange arrow.
`styles.css` line 303 documents this exact failure and its fix in a comment: *"A blanket 40% on the
near-black CTA produced a mid-grey fill with washed white text (~2.5:1) that read as an enabled
secondary button rather than a blocked one."* `.btn--cta:disabled` at line 306 was corrected
accordingly. But line 2028 sets
`.program-editor-onboarding-actions .program-editor__activate:disabled{opacity:.5}`, which
reintroduces the exact treatment the comment warns against on the one screen where activation is the
point.

**Evidence**

- `screens/onboarding-build/editor-empty__phone-390-light-en.png`
- `styles.css` lines 303 to 306 versus line 2028

### Program editor: "REP RANGE" and "MIN" collide

`BLOCKING` · *Layout defect*

The two labels sit on top of each other with no separation. The mechanism is visible in the file:
`.program-editor__range legend` (line 1952) carries `margin:0 0 -4px`, and
`.program-editor-installed .program-editor__range` (line 2048) sets `row-gap:4px`. The negative
margin cancels the row gap exactly, leaving zero space. Both light and dark frames show it, so it is
not a capture artifact.

The same screen carries two more issues. "Replace exercise" and "Remove exercise" are equal-weight
orange links side by side, so the destructive one has no distinguishing treatment in light mode. And
this is the screen with the flat bottom navigation instead of the floating dock (S5).

**Evidence**

- `screens/program/progression-editor__phone-390-light-en.png`
- `styles.css` lines 1952 and 2048

### Exercise picker: filter chips overlap each other and clip mid-word

`BLOCKING` · *Layout defect / mobile 15*

In the Browse chip row, the "Barbell" pill's outline visibly overlaps the "Chest" pill, and a third
ellipse sits behind both. The last chip is cut mid-word at *"Ma"*. Identical in light and dark, so
it is a layout bug rather than a rendering artifact.

Beyond the bug, the screen stacks three filtering mechanisms before the first result: a search
field, a three-tab row (Search / Browse / Yours), and the chip row, together consuming roughly 500px
of an 844px viewport. The chip row also mixes two taxonomies with no grouping (Chest is a muscle,
Barbell and Dumbbell are equipment). Selection uses an empty circle, which reads as a radio in a
multi-select list.

**Evidence**

- `screens/library/list__phone-390-light-en.png`
- `screens/library/list__phone-390-dark-en.png`

### Custom priorities: 52 buttons on one screen, with duplicate state

`STRUCTURAL` · *Taste 4.9 / mobile 31*

Thirteen muscles, each with a four-option segmented control, and each row also carries a *NORMAL*
status pill that repeats the value the buttons already show. "De-emphasize" wraps to two lines
inside its own button in EN and PT alike ("Reduzir ênfase"), which taste-skill 4.5 treats as a
pre-flight failure.

This is the clearest case in the product of 4.9's rule that a long list needs a different component
rather than a longer list. The screen is also marked *Optional*, which makes its weight relative to
the rest of the wizard disproportionate: the least necessary step is the densest.

**Evidence**

- `screens/onboarding-custom/priorities__phone-390-light-en.png`
- `screens/onboarding-custom/priorities__phone-390-light-pt.png`

### History: the calendar blocks the content, and editing looks like reading

`STRUCTURAL` · *Mobile 14 navigation / 15*

Expanding a session does not collapse the month grid, so the user scrolls past roughly 700px of
calendar to reach the session they just tapped. Between them sit a *RECENT* eyebrow and about 90px
of empty space, then a second *AUGUST* eyebrow, then a third *SUN · 30 AUG* label.

The expanded session is an editable form, and the affordances work against it. The date uses a raw
native `input type=date` whose height, radius and type scale match nothing else in the app, and it
shows US `08/30/2026` in an EN build. Its *DATE* label is right-aligned while *SET / KG / REPS / RIR*
beside it are left-aligned. Exercise names truncate at roughly 200px (*"Assisted pull-up..."*) while
four numeric fields take the rest of the width, so the field a person scans for is the one that is
clipped. And the delete control is an `×` in a box identical in size and shape to the numeric inputs
immediately beside it, which is a real mis-tap hazard on a destructive action.

The column here is labelled `KG`, against `LOAD kg` in the workout logger and `LOAD` in focus mode:
three labels for one field.

**Evidence**

- `screens/history/session__phone-390-light-en.png`
- `screens/history/list__phone-390-light-en.png`

### Workout list mode: four control grammars in one header row

`STRUCTURAL` · *Taste 4.5 / mobile 15*

Beside a two-line exercise title sit a bare chevron, a bordered square icon button, a plain
uppercase text button (*SKIP*), and a second bordered square button. Four affordance styles, no
grouping, no shared shape. The set rows compound it: row 1 ends in a bordered `SAVE` button while
rows 2 and 3 end in a bare checkmark, so the same column holds two different control types.

The metadata line *"Last set 105×6 @1 105×6 @1"* is the densest string in the product and the least
parseable: two records, four values, no separators, at roughly 13px. Focus mode solves this exact
screen far better, which raises the question of whether list mode should keep its own layout at all.

**Evidence**

- `screens/workout/list__phone-390-light-en.png`

### Progress overview: an empty account is greeted with ten red flags

`STRUCTURAL` · *Taste 4.5 states / 4.9*

On a fresh program the tab reads *"Needs more data / 0 of 3 sessions"* and then *10 · attention*,
followed by ten rows each carrying an orange dot and a hairline. Nothing is wrong; the user simply
has not trained yet. This is a first-run empty state rendered as an alarm, which 4.5 treats as a
missing state rather than a designed one.

The primary tab row also clips: *Review* sits flush against the right edge on all five captures with
no scroll affordance. The PRs sub-tab then stacks a second underlined tab row beneath the first, and
its rows render with a pale orange pill stretched to roughly 350px so the word `LOAD` floats in a
mostly empty capsule opposite a right-aligned column.

The Review sub-tab restates every figure twice, once as a labelled key-value block and again as a
prose paragraph, then leaves the lower 55% of the viewport empty and ends on *"Repeat with a simpler
schedule."* with no control attached to the recommendation.

**Evidence**

- `screens/progress/overview__phone-390-light-en.png`
- `screens/progress/prs__phone-390-light-en.png`
- `screens/progress/review__phone-390-light-en.png`

### Share setup: nine lines of infrastructure prose above a Copy link that looks disabled

`STRUCTURAL` · *Taste 4.5 button contrast / 4.9*

The sheet explains temporary cookies, static hosts, matching `index.html` requests, seven-day
retention, and that compression is not encryption. That is the most technical register in the
product, sitting in a share flow. taste-skill 4.9's "one copy register per page" is the relevant
rule; the transparency is admirable and the placement is not.

Below it, "Copy link" renders as pale grey text in a pale grey outlined box: the one action the
sheet exists to offer reads as unavailable. The header uses a fourth pattern again, with "Close" in
grey on the left where other sheets put orange actions.

**Evidence**

- `screens/program/share-setup__phone-390-light-en.png`

### Install banner and tour: two primary CTAs, and a focus ring that reads as a broken border

`STRUCTURAL` · *Taste 4.5 / mobile 12, 13*

The install banner floats between "Start workout" and the dock, covering the *THIS WEEK* section
without a scrim, so the user sees two full-width black buttons with orange arrows about 250px apart.
The copy inlines two glyphs mid-prose (*"tap ••• then Share ⇧, and choose Add to Home Screen"*), with
the share glyph in orange so it reads as a link.

The tour is eleven modal steps before first use, opening with a seven-line privacy paragraph that
bolds the names of the two buttons directly beneath it. "Skip tour" renders as a sharp-cornered
orange rectangle around grey text: this is the focus outline, unstyled, and it recurs around the
*h1* on the rules-drift screen. In a system where everything else is rounded, a square orange box
reads as a rendering fault rather than as focus.

**Evidence**

- `screens/install/banner__phone-390-light-en.png`
- `screens/install/tour__phone-390-light-en.png`
- `screens/onboarding-recovery/rules-drift__phone-390-light-en.png`

### Exercise chart: two points drawn as a trend, on a scale nobody chose

`POLISH` · *Dataviz / taste 9.D*

The estimated-e1RM chart plots two data points as a straight line across the full width of the card,
turning a 7 kg change into a dramatic slope. The y-axis runs 128 / 125 / 122 / 119, a 3 kg increment
starting on an arbitrary value. Two points is a comparison, not a trend, and should be drawn as one.

Nearby, the session summary shows a machine lateral raise at 100 kg described as *"+87.5 kg over
your best"*. This is seed data, but the catalog is the visual source of truth for designers, and
implausible figures undermine the screen they appear on. taste-skill 9.D covers exactly this.

**Evidence**

- `screens/progress/exercise-chart__phone-390-light-en.png`
- `screens/session/summary__phone-390-light-en.png`

### Focus mode: a fixed-height card leaves a 180px hole, and the rest is the best screen here

`POLISH` · *Mobile 15 / taste 4.5*

The "Last session" table inside the card is followed by roughly 180px of empty white because the
card height is fixed rather than content-driven. Two more small things: the skip control is an
unlabeled `>|`, and the note control is an unlabeled document glyph, where list mode spells both
out.

Everything else about this screen is right, and it is worth saying so in the same breath: one
exercise, one decision, huge tappable numerals, a single unambiguous CTA. If list mode were rebuilt
on focus mode's grammar rather than the reverse, most of S5 would resolve itself.

**Evidence**

- `screens/workout/focus__phone-390-light-en.png`

---

## 04. Contrast: what actually checks out

Worth stating precisely, because the accent is orange on cream and that usually goes badly. It
mostly does not here. Computed against the real token values.

| Pair | Ratio | Uses as text | AA body |
| --- | ---: | ---: | --- |
| `--accent-deep` #B8410E on #F4F2EF | 4.94:1 | 73 | **Pass** |
| `--accent` #E04E14 on #F4F2EF | 3.57:1 | 12 | **Fail** |
| `--ink-soft` #6E6A63 on #F4F2EF | 4.81:1 | many | **Pass** |
| `--positive` #2F7D33 on #F4F2EF | 4.58:1 | few | **Pass** |
| `--accent` #F2703B on #141310 (dark) | 6.33:1 | many | **Pass** |

The system was clearly designed with this in mind: `--accent-deep` exists specifically as the
readable orange and carries 73 of the 85 text uses. Of the twelve uses of the failing `--accent`,
most are icon masks, where 3:1 is the correct bar for a graphical object. The one that is not is
`.entry__payoff-badge` (line 3002), which sets 3.57:1 orange text inside a 3.57:1 orange ring.

The real remaining contrast problems are the ones named above: the disabled activate button, the
greyed-out Copy link, and the off-state toggle, where a white knob on a `--rule` track leaves the
control's state near-invisible. The theme asymmetry is worth noting on its own: the light theme is
the constrained one, and dark has roughly 1.8x the accent headroom.

---

## 05. Recommended changes, by impact

Ordered by how much user-visible quality each unit of work buys back. P0 is a short list on purpose:
four of its six items are single-line fixes.

### P0. Shipped defects

*Hours, not days*

1. **Pass day labels, not day keys.** Fix the `{days}` interpolation in `app.js` so the Build editor
   stops printing `day_empty:manual_d1`. The catalog string is already correct.
2. **Delete the negative margin on the range legend.** `styles.css:1952`, `margin:0 0 -4px`. It
   cancels the 4px row-gap and collides "REP RANGE" with "MIN".
3. **Give the activate button the fixed disabled treatment.** Replace `opacity:.5` at
   `styles.css:2028` with the `--rule` / `--ink-soft` pair already used by `.btn--cta:disabled`. The
   comment explaining why is eight lines above it.
4. **Fix the chip row overlap** in the exercise picker, and give the row a visible overflow
   affordance.
5. **Style the focus ring.** A sharp orange rectangle on a heading reads as a border bug. Give
   `:focus-visible` a radius matching its element and an offset.
6. **Reserve `--nav` at the bottom of every scroll container** so the dock stops bisecting the final
   row. The token exists.

### P1. The two surfaces that are failing hardest

*One sprint each*

1. **Rebuild Progress / Volume and Progress / Strength as phone components.** The obvious move is a
   row per muscle or lift carrying name, current value, and a single delta, with the remaining
   columns behind a tap. If the full table must stay, it needs a real horizontal scroll container
   with an edge shadow, not a silent clip. Give the primary tab strip a scroll affordance so
   "Review" is not flush-cut on every frame.
2. **Cut the first-run gate to its first screenful.** Headline to two lines, artwork, one line of
   subtext, entry options visible without scrolling. Move the manifesto below the options or into
   About. Remove the em-dash. Keep the artwork exactly as it is.
3. **Collapse the History calendar when a session expands**, and give the expanded session a real
   editing surface: a styled date control matching the app's own field, left-aligned labels
   throughout, the exercise name given the width it needs, and the delete control visually separated
   from the numeric inputs.
4. **Replace the 52-button priorities screen.** One row per muscle showing its current setting,
   opening a picker on tap, with the whole section collapsed behind a "Customise emphasis"
   disclosure since the step is optional. This also resolves the 200%-text clipping, since nothing
   is fixed-width any more.

### P2. Re-converge on the documented system

*Ongoing, gate in CI*

1. **Tokenise the type scale and the radius scale, then enforce them.** Six body sizes become two or
   three. Seventeen radii become the three the system actually needs (field, container, pill). A
   lint rule rejecting literal `border-radius` and `font-size` values outside the tokens would hold
   the line, since the catalog already gates on drift.
2. **Pick one stepper, one dismiss label per role, one row-disclosure glyph, one bottom nav.** Focus
   mode's stepper and the floating dock are the right winners. The program editor's flat bar should
   go.
3. **Make improvement mean one thing.** Use `--positive` everywhere a lift improves, give regression
   `--danger`, and pair colour with a glyph or word so the encoding is not colour-only.
4. **Halve the eyebrows.** Where a group's position already says what it is, drop the label. Never
   stack two eyebrows and a micro-sentence, as Progress / Overview does.
5. **Pick one progress indicator per context.** Focus mode needs one, not four. The wizard needs the
   bar or the count, not both.
6. **Make the illustration tile background theme-aware** so the library stops punching cream holes in
   the dark list. Separate `--danger` from `--accent-deep` far enough that destructive actions read
   as destructive in light mode.
7. **Copy pass.** Remove the one em-dash and the sixteen en-dashes. Cap middle dots at one per line.
   Fix the PT gender disagreement on the entry hub. Move the share sheet's cookie and encryption
   prose behind a "How this works" disclosure and let "Copy link" look like a button. Replace the
   seed data that produces a 100 kg lateral raise.

---

## 06. What is working, and should not be touched

A redesign that lost any of these would be a downgrade. Under taste-skill 11.C, these are
preservation rules, not suggestions.

### The brand has an actual point of view

Plex Sans with Plex Mono, warm cream, burnt orange, engraving-style commissioned artwork of a figure
carrying a bull. No purple, no gradient, no glassmorphism, no Inter, no stock photography, no
hand-rolled decorative SVG. Taurifer looks like something a person decided. That is rarer than it
should be and it is the asset everything else should be brought into line with.

### Dark mode as a token swap, with the reasoning written down

One `:root[data-theme="dark"]` block, no second stylesheet, no colour named outside a token. The CTA
correctly inverts to a light pill because a near-black pill would disappear, and the accent moves
lighter because emphasis on dark means more light. The stylesheet says all of this in comments. Fix
the three parity breaks in S8; keep the architecture exactly.

### The daily loop

Today into log into save into summary is confident, well-ranked and fast to read. Today's three-tier
CTA stack (black primary, outlined secondary, plain text tertiary) is correct hierarchy, and it
holds its shape in dark. Focus mode is the best screen in the catalog: one exercise, one decision,
numerals big enough to hit mid-set.

### Explain-yourself surfaces

"Why this weight?" as a first-class, always-present control is a genuine product idea and the reason
the app is trustworthy. Same for the deterministic promise on the recommendation screen ("Same
answers and rules always produce the same result") and for the setup-link sheet naming exactly what
travels. Trim the register, keep the honesty.

### Errors adjacent to the control that failed

The Recommend validation error sits directly above the option group it belongs to, with an icon, a
heading and a plain instruction. taste-skill 4.6 asks for exactly this and most products do it with
a toast. Use this pattern as the template for the rest.

### The catalog itself

71 screens across two themes, two locales, three viewports and a 200%-text pass, CI-gated against
drift, is better coverage than most teams with designers on staff. It is why this audit could be
evidence-based at all. The one change worth making is process, not artifact: the 200% and 320px
frames are being generated but evidently not reviewed, since S2's clipped labels sit in the
committed set. Put those two variants in front of a human on every regeneration.

---

**Scope note:** taste-skill is written for landing pages, portfolios and marketing redesigns and
explicitly excludes dense product UI, data tables and multi-step wizards. Where its rules were
written for a hero section, I have said so rather than applied them literally. The mobile skill in
the same repository governs the ergonomics, density and navigation findings.

No files in the repository were modified by the audit itself. Line numbers refer to `styles.css` at
the audited commit (`a4abd24`).
