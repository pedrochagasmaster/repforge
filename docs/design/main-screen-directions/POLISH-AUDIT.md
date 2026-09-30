# Direction D polish audit

Status: audit of the D drawing at `6e2a70f` (branch `redesign/direction-d`),
2026-09-30, before any visual change. Every finding below was measured on the
review page driven through `play.html?d=4` with Playwright at 360, 390 and
430, PT and EN, light and dark, at device pixel ratio 3, and through a whole
session: Today, start, the shelf in every state, rest, Why, finish, summary,
Progress, the exercise chart, History, the session page and Program.

Findings are ranked by how much they cost the premium feel. Each gives the
screen and state, what is off with the measured numbers, the fix, and the
Plan 058 role the fix lands on. Numbers are CSS px at 390 PT light unless a
width is named.

## Baseline

- `checks/acceptance.mjs` on D in this container: targets, orange, parity and
  strings pass; overflow reports one real item, P13 below (a 75.6 px mono
  target in a 74 px column). The committed report at `f824d4e` passed 5/5 on
  the same code: the owner's Chromium rounded the same 1.6 px under the 1 px
  tolerance and this build (Chromium 141) rounds it over. It is a genuine
  overflow and is fixed here, not waived.
- E, F and G: 5/5 in this container (132 renders, 68 states).
- The baseline capture matrix (D, 264 captures) is kept outside the repo.

## How the fixes are organised

One theme per commit, each independently revertible:

1. **Roles and tokens.** Every D size, weight, radius, boundary and shadow
   moves onto Plan 058's tokens (P03, P04, P05, P07, P29), which also makes
   200 % text real on the drawing.
2. **Numeric alignment and tabular columns** (P08, P09, P13, P18, P19, P30).
3. **Spacing scale, hairlines and section rhythm** (P10, P12, P14, P15, P16, P27, P28).
4. **Dark theme and depth** (P06, P31).
5. **The shelf's states** (P01, P02, P25, P32).
6. **Sheet headers** (P17).
7. **Chart and tab craft** (P11, P21, P22, P23).
8. **Motion** (P26).
9. **Edge states** (P20, P24).

## Findings, ranked

### P01. Shelf, editing state: the input paints over its own label

- **Screen and state:** Focus, second tap on the selected Reps field (also
  Carga and RIR).
- **What is off:** the field turns into an absolutely positioned
  `<input>` with `padding-top: 20px`; its text box starts at y 671.0 while the
  label "Reps" occupies y 670.8 to 685.2, so the value is drawn on top of the
  label. The selection is the browser's default blue, and the caret is
  unstyled. This is the one state a lifter sees every time they type a number.
- **Fix:** the field is a two-row grid (caption label, metric value) in both
  the button and the input form; the input occupies only the value row, with
  no padding tricks; `::selection` is the accent at 24 % and `caret-color` is
  ink.
- **058 role:** `field` control; label on `caption` 12, value on `metric` 22 Mono.

### P02. Shelf, correction: two identical outlines, so the edited set is ambiguous

- **Screen and state:** rest, after tapping done row 1 (CTA reads "Salvar
  série 1").
- **What is off:** row 1 (`is-editing`) and row 2 (`is-open`) both carry the
  same 1.5 px ink inset outline on the same well ground. Nothing says which
  set the shelf is holding.
- **Fix:** while correcting, the open row demotes to the queued look (soft
  values, no outline) and the corrected row keeps the outline and shows its
  set number in place of the check, since it is open again.
- **058 role:** `selected` boundary on the ledger row (ink, per D §3, not the
  accent).

### P03. 200 % text has no effect on the drawing

- **Screen and state:** every screen at 360 PT with the root font at 32 px.
- **What is off:** every D size is a px literal, so the captures at 200 % are
  pixel-identical to 100 %. The app scales by rem and reflows rows through
  `is-text-scaled` (root font above 16.1 px). The drawing cannot show what
  Plan 063 must build.
- **Fix:** express every D type size in 058's rem tokens (`--font-size-*`),
  add the app's `is-text-scaled` hook to the review runtime, and give the
  prescription rows, ledger rows, totals and shelf fields a scaled layout
  (figures under the name, fields stacked).
- **058 role:** the whole type scale; 200 % fit is a P4 gate in 058.

### P04. Type sizes off the 058 scale

- **Screen and state:** everywhere.
- **What is off** (measured computed sizes): body 15; cue sub-line 17; CTA
  17/600; ledger values 17; Today load figure 20; Focus exercise name 20; sheet
  titles 20/650; page titles 30/650; secondaries at 13, 13.5 and 14.5; rest
  clock 56; chart axis text 10; section headings 17. Weight 650 is not one of
  058's three weights.
- **Fix:** body and controls 16; cue sub-line and next-cue 18 `subtitle`; CTA
  18/600 as the production `.btn--cta`; ledger values 16 Mono `body`; Today
  load, shelf values and totals 22 `metric`; cue and sheet titles 24
  `section-title`; page titles 30/600 `title`; section headings 18/600
  `subtitle`; Focus exercise name 18/600 `subtitle` (the nearest correct role
  that keeps the approved hierarchy cue > name; 058's `feature-title` 28 is
  listed under Proposals); all 13 to 14.5 px secondaries on `body-small` 14,
  field labels and evidence counts on `caption` 12; the rest clock on the
  protected `clamp(2rem, 10cqi, 2.625rem)` (owner decision 3); chart axis on
  `label` 11; weights 400/500/600 only; line heights 1.1 / 1.4 / 1.55.
- **058 role:** as named per element.

### P05. Required control boundaries at hairline contrast

- **Screen and state:** shelf fields and pads (Focus, rest), the four rest
  pads, both segmented controls (chart), timer presets, and every secondary
  button on a sheet ("Entendi", "Confirmar dia").
- **What is off:** all use `--rule` as their only edge: 1.27:1 in light on
  white, 1.2:1 in dark on the sheet surface. On a white sheet the secondary
  button's fill equals the sheet, so the hairline is the entire affordance.
  058 requires 3:1 for a boundary that supplies the affordance, and its
  adjustment, field and selection recipes use the required boundary
  (`--boundary-required`, ink-soft: 5.5:1 light, 7.0:1 dark).
- **Fix:** required boundary on fields, pads, presets, segmented tracks and
  secondary buttons; decorative separators stay `--rule`; the selected field
  keeps its 2 px ink boundary above the 1 px required one.
- **058 role:** `adjustment`, `field`, `selection`, `secondary` boundaries.

### P06. Dark theme: hairlines inside sheets and the shelf vanish; depth by shadow does not work on charcoal

- **Screen and state:** Why, day picker, timer, calendar and actions sheets;
  the shelf; EN dark.
- **What is off:** `--rule` #2E2B26 on the sheet surface #1E1C18 is 1.2:1, so
  the reason blocks, the disclosure and "Got it" lose their rules at DPR 3.
  The shelf's `0 -10px 30px rgba(0,0,0,.5)` is invisible on #141310, so the
  shelf is separated only by the surface step, which is right, but the light
  theme's shadow then does the same job with a different recipe.
- **Fix:** a `--rule-on-surface` token (`--rule` in light, `--rule-strong` in
  dark) for every separator drawn on `--surface`; the shelf on 058's
  `--elevation-persistent-shadow` and sheets on `--elevation-sheet-shadow`,
  both with the theme's shadow channel, so dark never casts pale shadows and
  light stops using a bespoke recipe.
- **058 role:** `persistent-action` (shelf), `modal` (sheets), decorative rules.

### P07. Radii off the 058 scale

- **Screen and state:** CTA, secondary buttons, pads, presets and the
  segmented track at 14; sheet and shelf tops at 20; segmented option at 11;
  calendar cells at 10; the timer pill at 22; the day-picker and open ledger
  row at 12.
- **Fix:** controls on `--radius-control` 8 (the production `.btn--cta` and
  `.stepbtn`), sheet and shelf tops on `--radius-prominent` 16 (the production
  `.sheet`), the open ledger row and art tile on `--radius-surface` 12,
  segmented options on `--radius-compact` 4 inside an 8 track, pills on
  `--radius-pill`.
- **058 role:** radius scale 4 / 8 / 12 / 16 / pill.

### P08. Today: the load figure sits 3 px below the row's baseline

- **Screen and state:** Today, every row.
- **What is off:** first-line baselines in row 1: name 292.33, target 292.33,
  load figure 295.33. The row aligns items to the top and the 20 px figure's
  line box (1.1) lands its baseline 3 px lower than the 15 px name's.
- **Fix:** align the prescription row on the first baseline
  (`align-items: baseline`), with the mark centred on the name's first line.
- **058 role:** `metric` 22 Mono for the figure, `body` 16 for the name,
  `body-small` 14 Mono for the target.

### P09. Ledger: column heads 4 to 12 px off their columns, and no decimal alignment

- **Screen and state:** Focus ledger (all states), History session rows.
- **What is off:** the head row has an 8 px column gap and the set rows have
  none, so the KG head is centred at x 113 while the values centre at x 109,
  drifting by 4, 8 and 12 px across the three columns. Values are centred in
  their column, so "102,5", "80" and "45" on the session page share no edge
  and decimals never line up. The "antes …" line starts at the column's edge
  (x 56), aligned with nothing.
- **Fix:** one column template for heads and rows; numbers right-aligned to a
  shared edge with a 12 px inset; heads on the same edge; the index left with
  the same inset; the previous-set line starts on the index inset. This gives
  decimal alignment for free with tabular Mono.
- **058 role:** `body` 16 Mono values, `label` 11 heads.

### P10. Double hairlines bracketing empty bands

- **Screen and state:** Today (last row rule at y 624.1, split rule at 646.1:
  two rules 22 px apart with nothing between); Progress (tab rule at 110.5,
  totals rule at 128.5); chart (segmented controls, then a ruled totals band);
  session summary (ruled totals band under the lede).
- **What is off:** D's rule is space and one hairline per break; these are two.
- **Fix:** a rule belongs to the block above; the block that follows uses
  space only. The totals band keeps its bottom rule and drops its top one
  wherever a rule already precedes it.
- **058 role:** decorative rule (`--rule`), `flat` layer.

### P11. Progress rows: figure off baseline, text wrapping beside an empty column

- **Screen and state:** Progress, attention rows and strength rows.
- **What is off:** attention row 1: name baseline 310.97, figure baseline
  304.97 (6 px high). The verdict sentence wraps inside 258 px beside a 60 px
  figure column that is empty below its first line, so rows run to 128 px.
  Strength rows centre the figure on the two-line block instead (figure
  baseline 20 px below the name's), so the two row kinds disagree.
- **Fix:** name and figure share the first baseline in both row kinds; the
  verdict and evidence lines span the full width under them.
- **058 role:** `body` 16/600 name, `body-small` 14 verdict, `caption` 12
  evidence, `body-small` Mono figure.

### P12. Program: two-line column heads on a one-line rule; next load off baseline

- **Screen and state:** Program, every day.
- **What is off:** "SÉRIES × FAIXA" and "PRÓXIMA (KG)" wrap to two lines
  (31.9 px tall) while "EXERCÍCIO" stays on one; the row is top-aligned, so
  the single-line head floats 17 px above the rule the others touch. In rows,
  the next-load figure's baseline is 362.7 against the name's 368.2.
- **Fix:** the head row aligns to its bottom, so every last line sits on the
  rule; the row aligns on the first baseline with the mark inline.
- **058 role:** `label` 11 heads, `body` 16 Mono next load.

### P13. Mixed Today at 360 PT: the manual target overflows its column by 1.6 px

- **Screen and state:** today-mixed, 360 PT, the manual row.
- **What is off:** "3 × 12–15" at 14 px Mono measures 75.6 px in a 74 px
  column (`scrollWidth` 76). The kg column beside it is 62 px.
- **Fix:** the target column is sized from the widest form the app produces
  (`3 × 12–15`, nine Mono cells at `body-small` = 75.6 px) plus inset, and the
  kg column from `102,5` at `metric`; the name column takes the rest.
- **058 role:** `body-small` 14 Mono.

### P14. Focus header: the name block does not sit on the art tile

- **Screen and state:** Focus, one-line exercise names (390 and 430).
- **What is off:** the tile is 56 px (y 83 to 139); the name and meta block
  ends at 127.5, leaving 11.5 px of tile under the text with the block pinned
  to the top.
- **Fix:** centre the block on the tile; a two-line name at 360 grows past
  the tile and stays top-anchored by the same rule.
- **058 role:** `subtitle` 18/600 name, `body-small` 14 meta.

### P15. Tally line wraps with a dangling separator

- **Screen and state:** today-mixed, 360 PT.
- **What is off:** "↑ 3 sobem · = 1 mantém · ⏸ 1 recupera ·" then "1 manual"
  on the next line: the separator is its own span and ends the line.
- **Fix:** the separator is drawn by the item that follows it, inside the
  same no-wrap span, so a wrap never strands it.
- **058 role:** `body` 16.

### P16. Week rule: the current segment reads heavier than the finished ones

- **Screen and state:** Today, Program.
- **What is off:** done segments are 3 px ink; the current one is 3 px
  ink-soft plus a 1 px ring (5 px), so it is the heaviest mark on the rule and
  inverts the order done > now > future.
- **Fix:** done ink, now ink-soft, future rule-strong, all 3 px, no ring.
- **058 role:** `block` progress dimension, decorative.

### P17. Sheet headers: four different headers on five sheets

- **Screen and state:** Why (eyebrow 14 + cue 22/600), day picker (title
  20/650 + sub), timer (title only), calendar (arrows flanking a title),
  actions (title only).
- **What is off:** the close button, the grab handle and the title sit at
  different offsets and sizes on each sheet; two weights (600, 650) and two
  title sizes (20, 22) for the same job.
- **Fix:** one header band: handle, then the title on `section-title` 24/600
  with a 44 px right reserve for the close button, then an optional
  `body-small` line; the Why sheet keeps its eyebrow above the cue and the
  cue takes the title role; the calendar keeps its arrows and its title
  centres between them.
- **058 role:** `section-title` for sheet titles, `quiet-navigation` close.

### P18. Words set in Mono

- **Screen and state:** summary next line ("Próxima:"), shelf pads
  ("− 1 rep"), History rows ("13 séries"), chart readout ("Maior carga"),
  the Program legend's column, the sets-range column.
- **What is off:** 058 chooses the family by value: Sans for language, Mono
  for loads, reps, RIR, time and counts. A word in Mono reads as a typewriter,
  not a ledger.
- **Fix:** split label and value; pads on Sans `control` 16/500 with tabular
  figures; History counts as Mono number plus Sans unit; the readout as Sans
  with Mono values.
- **058 role:** `control`, `body-small`; Mono by value only.

### P19. Why sheet: the load in the headline is Sans while the page cue sets it in Mono

- **Screen and state:** every Why variant.
- **What is off:** "Subir para 102,5 kg, buscar 7 reps" is one Sans string;
  the same cue on the page sets `102,5` in Mono.
- **Fix:** the headline sets the load and the reps in Mono, as the cue does.
- **058 role:** `section-title` with Mono values.

### P20. Rest done: check off the mark column, and no overrun

- **Screen and state:** rest, timer at zero.
- **What is off:** the done line's check is an 18 px glyph at x 0 while the
  cue's mark below is a 26 px box at x −2, so the two glyphs do not share a
  column. Owner decision 14 ("Descanso concluído · +0:15", counting up) is not
  drawn: the review timer stops at zero.
- **Fix:** the done line uses the cue's mark box; the timer keeps counting
  past zero and the line reads `rest.inline.done_over`, already in the
  strings appendix.
- **058 role:** `subtitle` 18 for the done line.

### P21. Chart craft

- **Screen and state:** exercise chart, both metrics and scopes.
- **What is off:** the dashed cursor is drawn after the selected point (SVG
  children 16 and 17), so it crosses the dot; the ▲ load-up ticks sit on the
  bottom gridline and read as axis marks; axis text is 10 px (no role); the
  readout is all Mono; in the table the "×" drifts because "102,5" and "100"
  differ in width.
- **Fix:** cursor under the points; ticks 4 px above the axis in ink-soft;
  axis on `label` 11 Mono; readout in Sans with Mono values; loads padded to
  five Mono cells so "×" and the reps align down the column.
- **058 role:** `label` 11, `body-small` 14.

### P22. Tab row fade shows when nothing overflows

- **Screen and state:** Progress at 390 PT (row overflows by 5 px) and 430
  (does not overflow).
- **What is off:** the paper fade is unconditional, so "Revisão" is dimmed at
  every width, and at 430 it dims a row that fits.
- **Fix:** the runtime marks the row `is-overflow` when `scrollWidth >
  clientWidth` and clears it at the scroll end; the fade only draws then.
  Tabs on `control` 16.
- **058 role:** `selection` (tabs), `horizontal-scroller` region.

### P23. Segmented control: the selected option is marked by a 1.3:1 ring

- **Screen and state:** chart scope and metric controls; timer presets.
- **What is off:** the selected option's `--rule` ring on a white pill over
  the well track is 1.3:1; only the label weight carries the state.
- **Fix:** selected option gets the required boundary (5.5:1 light, 7.0:1
  dark) and the track drops to a hairline.
- **058 role:** `selection`, selected boundary at 3:1.

### P24. Focus back glyph disagrees with D's other back links

- **Screen and state:** Focus header versus the chart and session pages.
- **What is off:** the Focus header uses a down chevron for "Voltar para
  Hoje"; the chart and session back links use a left chevron.
- **Fix:** the left chevron everywhere a control returns to the previous
  page.
- **058 role:** `quiet-navigation`.

### P25. Interactive states are not designed

- **Screen and state:** every control.
- **What is off:** pressed is a transform only, with no ground change; no
  `:focus-visible` recipe beyond the browser default on rows and pads; the
  CTA has no disabled recipe; there is no invalid field recipe; on touch,
  hover styles would stick.
- **Fix:** pressed = well ground + `--control-pressed-transform`;
  focus-visible = `--control-focus-outline` at 2 px offset; disabled CTA =
  `--rule` fill with soft ink (production `.btn--cta:disabled`); invalid
  field = danger boundary with the CTA disabled; hover only under
  `(hover: hover)`.
- **058 role:** shared control facets.

### P26. Motion is undrawn

- **Screen and state:** shelf pads ↔ rest controls, drain bar, Why
  disclosure, sheets opening, a row committing, chart snapping.
- **What is off:** every state change cuts. The spec limits new motion to a
  160 ms crossfade, a transform-driven drain bar and the disclosure height
  helper; none is on the page, and there is no reduced-motion variant.
- **Fix:** CSS-only transitions on `motion-layer.js`'s vocabulary (`revealIn`
  200 ms `[0.2, 0.7, 0.2, 1]`, `revealOut` 150 ms `[0.4, 0, 0.8, 0.2]`): sheet
  slide-in, shelf-pad crossfade 160 ms, drain bar as `scaleX` with a 1 s
  linear step, a 200 ms ground fade when a row commits, chart cursor 150 ms;
  `prefers-reduced-motion: reduce` removes all of them.
- **058 role:** interaction runtime audit owners; no new palette or role.

### P27. Row heights disagree across the ledgers

- **Screen and state:** Focus ledger 48 min; History session rows 40; Today
  rows 48; History list rows 56; Program rows 52; chart table 48.
- **Fix:** ledger rows 48 minimum everywhere (spec §4); list rows that carry
  two lines 56.
- **058 role:** `body` rows on the 4 px grid.

### P28. Spacing off the scale

- **Screen and state:** everywhere.
- **What is off:** margins and paddings use 2, 3, 5, 6, 10, 18, 22 and 26 px
  beside the scale's 4 / 8 / 12 / 16 / 24 / 32 (DESIGN.md: 4 / 8 / 12 / 14 /
  16 / 18 / 26 / 32).
- **Fix:** named spacing tokens on the 4 px grid; the section band stays 26 as
  D §3 and DESIGN.md define it; sub-line leads come from line height, not
  2 px margins.
- **058 role:** layout rhythm (DESIGN.md scale).

### P29. `.ph` tokens drift from `styles.css`

- **What is off:** `--ink-soft` is #6E6A63 on the review page and #6A665F on
  `main` (058 raised its contrast). The `.ph` set also lacks the 058 tokens
  (`--font-size-*`, `--radius-*`, `--elevation-*`, `--boundary-*`,
  `--control-*`).
- **Fix:** carry the 058 token block into `.ph`, same names and values, so
  the drawing's CSS reads like production CSS.

### P30. Units and operators at full weight beside their figures

- **Screen and state:** summary sets lines, totals ("kg movimentados"), Today
  targets ("3 × 7"), Program sets column, History counts.
- **What is off:** "kg" and "×" are set in the same ink and size as the
  figures they qualify.
- **Fix:** operators and units in soft ink inside Mono cells; units in Sans
  where they follow a Mono count.
- **058 role:** ink hierarchy (soft ink for support).

### P31. Empty art tile in dark

- **Screen and state:** a non-illustrated or custom movement in Focus (the
  mixed day's skull crusher and the custom row), dark.
- **What is off:** the tile is `--well` with a `--rule` ring: #191713 with
  #2E2B26 on #141310, a near-invisible square.
- **Fix:** the tile keeps its deliberate emptiness but reads as a plate: the
  surface step with the `--rule-on-surface` ring in both themes.
- **058 role:** `flat` surface, decorative boundary.

### P32. Untouched shelf values read as confirmed

- **Screen and state:** Focus, the shelf on opening.
- **What is off:** engine values (load 102,5, reps 7, RIR 1) render in ink as
  if the lifter had entered them. Spec §4.2: values the lifter has not
  confirmed show in soft ink, as the app's suggested-but-untouched inputs.
- **Fix:** the review runtime tracks a touched flag per field (pad or input
  sets it); untouched values are soft ink; the ledger's open row already does
  this.
- **058 role:** `field` with the suggested-value ink.

## Not fixed here (proposals)

- **Focal exercise name on `feature-title`.** 058 names `feature-title` 28
  for a focal exercise; D's approved hierarchy puts the name under the 24 px
  cue. The polish keeps the hierarchy on `subtitle` 18. If 058's role
  inventory requires `feature-title` for `.d-exname`, that is a content-job
  decision, not a polish.
- **Section headings on `subtitle`.** D's quiet section headings ("Prescrição
  de hoje") sit on `subtitle` 18/600. 058's `section-title` is 24; using it
  would compete with the 30 px page title and change D's rhythm.
- **Exercise-complete shelf.** Spec §4.2 says the shelf shows the completion
  actions when an exercise is done. It is not drawn, and drawing it is a P1
  screen, not a polish.
- **The selected field's boundary.** 058's `selected` boundary is
  `--boundary-selected` (accent-deep, 2 px). D §3 forbids orange on the shelf,
  so the selected field keeps a 2 px ink boundary. 058's contract review
  should record the shelf's selected recipe as ink.
