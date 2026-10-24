# Native-fidelity audit — Progress, History (set D)

Re-check against current main (5d2ca411), after #483 (wheel picker), #484 (phase 3 nav: large titles,
scroll-edge bar glass, bottom fade), #485 (fidelity pass: context menu, segmented control, steppers,
day picker, sheet close disc, row-pressed wash), #486/#488/#489 (owner bug fixes), #498/#500/#501
(onboarding inputs), and #499 (phase 5 large text, concentric shelf). Kit:
`/tmp/taurifer-ui-kit/docs/design/native-ui-kit.md` (yardstick, rules unchanged since the prior pass).
Production CSS: `/tmp/taurifer-ui-kit/styles.css`. Both themes viewed for every screen at
`phone-390-{light,dark}-en`; `cmp` run across the full set to catch a dark capture that is byte-identical
to its light twin.

**Headline: none of area D's prior findings were fixed by #483–#499.** The segmented-control fix in
#485 explicitly did not reach `.segpill`/`#strengthScopeSeg` (the kit's own inventory, line 254, says
so: "`.native-segments` matches since #485; the older `.segpill`, `.entry-seg` and `.seg` groups do
not"). Every shared-component and per-screen deviation below is re-confirmed open against current
`styles.css`, with refreshed line numbers (several shifted).

Checked per the recheck brief and found not present in this area: empty exercise-art thumbnail tiles
(Progress/History render numeric rows and sparkline paths only, no image tiles), and a degenerate
range like "RIR 1–1" (every RIR/range figure observed is a single value or a `kept →` delta, never a
collapsed equal-bound range).

## Shared components

### 1. Buttons are rectangles, not pills — `.btn`, `.btn--cta`, `.btn--steel` (styles.css:649, :671, :670)
Status: **open**. `.btn{border:1px solid var(--rule);border-radius:var(--radius-control)}` (styles.css:651)
and `.btn--cta{border:0;border-radius:var(--radius-control)}` (styles.css:672) still use the 8px
control radius; `.btn--cta` still fills with a 1px-equivalent flat rectangle. Kit §3/§10: buttons are
pills (`--radius-pill:999px`). Still the single most widely-visible deviation in the set — every
CTA/secondary pair in Progress and History renders as a bordered rounded-rectangle instead of a pill.
Effort: L (global component). Affects: progress/overview-guide, progress/review-guide,
progress/review-complete, progress/review-insufficient, progress/schedule-diagnosis,
progress/guided-repair, progress/recovery-ineligible, progress/recovery-questions,
progress/recovery-preview, history/session, history/per-side-session, history/edit-dirty,
history/edit-invalid, history/delete-confirm, history/conflict.

### 2. Dialog keeps a 1px border — `.entry-dialog` (styles.css:7725-7728)
Status: **open**. `border:1px solid var(--boundary-modal)` alongside `box-shadow:var(--elevation-dialog-shadow)`.
Kit §2 Dialog row: "no border" — shadow only; this is the exact pattern the kit calls out. Effort: S.
Affects: progress/overview-guide, progress/review-guide.

### 3. Scope toggle is a boxed pair, not a segmented pill — `.segpill`, `#strengthScopeSeg` (styles.css:4895-4909)
Status: **open**, explicitly not touched by #485 (kit doc itself, native-ui-kit.md:254). Outer group:
`1px solid var(--boundary-decorative)` + `--radius-control` (8px, styles.css:4898). Each button:
`border:2px solid transparent` that turns `--boundary-selected-quiet` (a visible black/white 2px ring
in both themes) when active, `--radius-compact` (4px) inner radius (styles.css:4900-4909). Kit §3/§10
wants a raised thumb (`--seg-thumb-bg`, `--radius-segment:9px`/`--radius-segment-thumb:7px`), no
borders — selection shown by the thumb's own surface + shadow, as `.native-segments` already does.
Effort: M. Affects: progress/exercise-chart, progress/strength, progress/strength-current-block,
progress/strength-all-history, progress/strength-comparison (confirmed boxed at the top of this
screen's capture), progress/strength-sparse (present, scrolled out of this particular capture).

### 4. PR timeline row misplaces its chevron and boxes its kind tag — `.prtl__row`, `.pr-kind` (styles.css:2707-2722, 7155-7158)
Status: **open**. `.prtl__row` is a 5-column grid (date / exercise / kind badge / set / delta,
styles.css:2712) that collapses to 2 columns under 520px (styles.css:2718-2722); the drill-in chevron
isn't part of that grid and lands on its own line below-left of each entry instead of trailing on the
row per kit §5/§7. `.pr-kind` (LOAD/E1RM/REPS tag, styles.css:2707) and its `#stats` override
(styles.css:7155) both use `--radius-compact` — a rounded-rectangle tag, not a pill. Fix: rebuild on
the standard row anatomy (label left, value + trailing chevron right) or at minimum re-anchor the
chevron inline with the delta; move the kind tag to `--radius-pill`. Effort: M. Affects: progress/prs,
progress/prs-drill-in.

## Screens

### progress/overview
- light/dark: progress/overview__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none). Rows hairline-separated, no card box, tabular Mono numbers,
  dock renders as a glass pill with the selected tab filled (no ring, per #485). Unchanged from the
  prior pass.

### progress/overview-guide
- light/dark: progress/overview-guide__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: dialog has a visible 1px border around the panel [shared #2]
  - open: "Got it" CTA is an 8px rounded rectangle, not a pill [shared #1]

### progress/overview-baseline
- light/dark: progress/overview-baseline__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none). Same row/dock treatment as overview.

### progress/overview-action
- light/dark: progress/overview-action__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none). Identical row anatomy to overview.

### progress/exercise-chart
- light/dark: progress/exercise-chart__phone-390-{light,dark}-en.png
- severity: medium
- note: **the dark capture is byte-identical to the light one** (`cmp` returns no difference) — dark-theme
  fidelity cannot be judged from this pair; flag for a recapture. `new`
- deviations:
  - open: both scope toggles ("Current block"/"All history", "Top load"/"Best e1RM") are the boxed
    `.segpill` pattern [shared #3]
  - meets kit otherwise: chart, axis labels and table are hairline-separated with tabular numerals.

### progress/strength
- light/dark: progress/strength__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: `#strengthScopeSeg` boxed toggle, clearly visible as a black-bordered rectangle on the active
    button in both themes [shared #3]
  - per-exercise rows (`.evrow--d`, styles.css:4910) remain a bespoke multi-line card rather than the
    kit's single-row anatomy — low priority per the kit's own §5 text naming this gap app-wide; not
    re-flagged as a new item.

### progress/strength-current-block
- light/dark: progress/strength-current-block__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: boxed scope toggle [shared #3]. Row anatomy note as above (strength).

### progress/strength-all-history
- light/dark: progress/strength-all-history__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: boxed scope toggle [shared #3]. Otherwise identical, unboxed list below.

### progress/strength-comparison
- light/dark: progress/strength-comparison__phone-390-{light,dark}-en.png
- severity: medium
- note: **the dark capture is byte-identical to the light one** (`cmp`) — same recapture flag as
  exercise-chart. `new`
- deviations:
  - open: boxed scope toggle at top of screen [shared #3]
  - meets kit: the comparison table (DATE / LOAD PER SIDE / REPS PER SIDE / E1RM / RIR) is
    hairline-separated with tabular Mono figures.

### progress/strength-sparse
- light/dark: progress/strength-sparse__phone-390-{light,dark}-en.png
- severity: low
- deviations: capture is scrolled past the scope toggle (see progress/strength for that finding, still
  open); what's visible — snapshot rows, "One compatible set is a snapshot, not a trend." caption,
  table — is hairline-only and meets kit. The collapsed large-title bar (centered "Progress", #484) is
  visible here; it is the intended collapsed state, not a deviation.

### progress/volume
- light/dark: progress/volume__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none). "This week"/"Block to date" is a plain text-tab-with-underline
  control, not boxed like `.segpill`. Progress bars (`#stats .vrow__bar`) use `--radius-compact`
  track/fill with no surrounding card.

### progress/volume-block
- light/dark: progress/volume-block__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none); same as volume with "Block to date" active.

### progress/volume-drill-in
- light/dark: progress/volume-drill-in__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none); empty-state caption ("No compatible sets logged yet.") sits
  inline under the row with no extra chrome.

### progress/prs
- light/dark: progress/prs__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: `.prtl__row` chevron lands on its own line below-left instead of trailing the row [shared #4]
  - open: `.pr-kind` LOAD/E1RM tags are rounded rectangles, not pills [shared #4]

### progress/prs-drill-in
- light/dark: progress/prs-drill-in__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: same `.prtl__row`/`.pr-kind` issues as progress/prs [shared #4]. The expanded
  detail line ("August 30, 2026 / Load · 42.5kg × 6 · +2.5kg") reads fine, tabular Mono, no box.

### progress/review
- light/dark: progress/review__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none) in the active-block state. "REVIEW" section caption + hairline,
  "BLOCK PROGRESS"/"OBSERVED OUTCOMES" group labels at `t-label` styling — matches kit §6 grouped
  section.

### progress/review-guide
- light/dark: progress/review-guide__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: dialog border + rectangular CTA, same as overview-guide [shared #1, #2].

### progress/review-active
- light/dark: progress/review-active__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none); identical treatment to progress/review.

### progress/review-complete
- light/dark: progress/review-complete__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - open: "Structural actions" still renders each route ("Start a recovery week", "Repeat this program
    next block", …) as a stacked, individually-bordered rectangle (`.btn`, styles.css:649) [shared #1].
    Still the clearest, most repeated instance of the box-button pattern in the set.

### progress/review-insufficient
- light/dark: progress/review-insufficient__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - open: same as review-complete but with all five routes visible at once (Start a recovery week /
    Repeat this program next block / Repair my schedule / Reduce training volume permanently / Adjust
    my program manually), each its own bordered 8px rectangle [shared #1]. Still the heaviest
    concentration of the box-button issue in the whole set — see Worst 3.

### progress/schedule-diagnosis
- light/dark: progress/schedule-diagnosis__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - open: `.radio-card` choice rows ("Fewer days available" / "Sessions take too long") still draw a
    visible border (`.radio-card`, styles.css:895, 1px `--control-selection-boundary`; `.is-selected`
    bumps to 1.5px, styles.css:899) around each option, plus a trailing circular radio mark
    (`.radio-card__mark`, styles.css:903-906, 22px circle) rather than the kit's quiet inset ring or
    trailing check (§4 "Selected" row, §5 "Check"). `#reviewPanel .radio-card.is-selected` additionally
    adds `box-shadow:var(--elevation-selected-quiet-shadow)` and an outlined-circle mark
    (styles.css:8210-8214) — still a bordered box with a circular affordance, not the kit pattern.
    Effort: M.
  - open: "See the proposed plan"/"Cancel" pair is the same boxed `.btn` pattern [shared #1]. The CTA
    label now wraps to three lines ("See the / proposed → / plan") with the arrow glyph sitting beside
    "proposed" on line 2 — unlike history/conflict this does not visibly collide with the text in this
    capture, so not flagged as a second instance of that bug, just noted as the same fragile
    `position:absolute` arrow under heavy wrap.
  - Combined, still the most boxed-looking screen in the set — see Worst 3.

### progress/sibling-lower-frequency
- light/dark: progress/sibling-lower-frequency__phone-390-{light,dark}-en.png
- severity: meets kit (for what's visible)
- deviations: the visible diff list is plain bulleted text, no boxes — meets kit. CTA/Cancel actions
  remain below the fold in this capture; they almost certainly inherit shared #1 like the
  sibling-shorter-session and guided-repair screens that do show them.

### progress/sibling-shorter-session
- light/dark: progress/sibling-shorter-session__phone-390-{light,dark}-en.png
- severity: meets kit (for what's visible)
- deviations: same as sibling-lower-frequency — visible content is an unboxed bulleted diff list.

### progress/guided-repair
- light/dark: progress/guided-repair__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: "Open the editor"/"Cancel" pair is the boxed `.btn` pattern [shared #1].

### progress/volume-reduction-preview
- light/dark: progress/volume-reduction-preview__phone-390-{light,dark}-en.png
- severity: low
- deviations: capture shows only the bulleted diff list (unboxed, meets kit); the confirm/cancel
  actions seen on the equivalent recovery-preview screen are below the fold here and presumably share
  #1.

### progress/recovery-ineligible
- light/dark: progress/recovery-ineligible__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: "Yes"/"No"/"Not sure" still render as three separately-bordered `.btn` rectangles side by
    side rather than a single segmented control or unboxed choice row [shared #1, related to shared #3]
  - open: "Cancel" is the same boxed pattern [shared #1]

### progress/recovery-questions
- light/dark: progress/recovery-questions__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: same three-button boxed row and Cancel as recovery-ineligible [shared #1].

### progress/recovery-preview
- light/dark: progress/recovery-preview__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: "Confirm recovery week"/"Keep current program" pair is the boxed `.btn`/`.btn--cta`
  pattern [shared #1].

### progress/recovery-active
- light/dark: progress/recovery-active__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none) against the kit. Same caveat as before: this capture is visually
  identical to progress/review-active — no distinct "confirmed recovery overlay" chrome is visible in
  this scenario, so fidelity for that specific overlay still can't be judged from this screenshot.

### progress/recovery-reassessment
- light/dark: progress/recovery-reassessment__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none) against the kit. Same caveat as recovery-active — no distinct
  reassessment-question chrome ("Better / About the same / Worse") is visible in this capture.

### history/list
- light/dark: history/list__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found (open: none). Search/calendar/view-toggle are 44px icon-only circular buttons
  with no visible box; session rows are hairline-separated with right-aligned tabular Mono values
  ("6,453 kg", "3 PRs" in `--color-improved`) and no card.

### history/list-scrolled
- light/dark: history/list-scrolled__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found. `new` screen in this catalog pass. The scrolled state shows the collapsed
  large-title scroll-edge bar (centered "History", #484) with the same icon-only circular buttons;
  "Every set" renders as an unboxed disclosure row with a trailing chevron-down, hairline above and
  below — matches kit §5/§6 disclosure-row anatomy. No new deviation.

### history/session
- light/dark: history/session__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: "Edit" is the boxed `.btn` pattern (icon + label inside an 8px-radius bordered rectangle)
    [shared #1]
  - meets kit: "Delete session" is unboxed red text.
  - meets kit: set tables (SET / LOAD (KG) / REPS / RIR) are hairline rows with tabular Mono numerals.

### history/per-side-session
- light/dark: history/per-side-session__phone-390-{light,dark}-en.png
- severity: medium
- note: **the dark capture is byte-identical to the light one** (`cmp`) — same recapture flag as the
  two progress screens above. `new`
- deviations: open: same boxed "Edit" button [shared #1]. Per-side table columns (REPS PER SIDE / LOAD
  PER SIDE (KG)) are clean hairline rows, tabular numerals — meets kit.

### history/edit-dirty
- light/dark: history/edit-dirty__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: "Cancel"/"Save changes" bottom bar is the boxed `.btn`/`.btn--cta` pair [shared #1]
  - meets kit: per-field 1px borders on the Load/Reps/RIR inputs (kit §4 control-extent boundary, not
    a card box).
  - meets kit: the struck-through, dimmed "removed" set row communicates its state with strikethrough +
    an undo icon, no extra chrome.

### history/edit-invalid
- light/dark: history/edit-invalid__phone-390-{light,dark}-en.png
- severity: medium
- deviations: open: same boxed Cancel/Save pair [shared #1]. The invalid field's red ring + inline
  error text ("Enter a valid load: zero or more, within the 1,000 kg limit.") is a legitimate
  required-boundary state, matches kit intent.

### history/delete-confirm
- light/dark: history/delete-confirm__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - open: this remains a dedicated full-page destructive confirmation (icon-in-circle, title, body,
    then Cancel/Delete side by side) rather than the kit's inset action-sheet group (§6). History's own
    in-flow delete pattern may be intentional IA; the button styling is the clear fidelity gap:
    "Cancel" is the boxed `.btn` rectangle [shared #1]. "Delete session" is unboxed red text — meets
    kit.

### history/conflict
- light/dark: history/conflict__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - open: three boxed `.btn` rectangles in a row (Cancel / Reload durable session / Retry preserved
    edit) [shared #1]
  - open: rendering bug, confirmed still present in both themes: "Retry preserved edit" wraps to three
    lines inside its CTA, and the arrow glyph (`.btn--cta::after`, styles.css:676-682,
    `position:absolute;right:18px;top:50%`) sits on top of the wrapped word "preserved" instead of
    beside the label — the arrow and text visibly collide. Fix: either let the CTA grow/reflow so the
    arrow stays clear of wrapped text, or move the arrow inline with the label instead of absolutely
    positioning it. Effort: S. See Worst 3.

## Worst 3

1. **history/conflict** — the clearest outright bug in the set, still unfixed: the CTA arrow icon
   overlaps the wrapped label text on "Retry preserved edit" in both themes, on top of the usual three
   boxed buttons. Not shown in the prototype.
2. **progress/schedule-diagnosis** — two `.radio-card` options with a visible border plus a circular
   radio mark, and a boxed CTA/Cancel pair whose label now wraps three lines, stack into the most
   visibly "web form"-like screen in the set, furthest from the kit's row/pill vocabulary. Not shown in
   the prototype.
3. **progress/review-insufficient** — five separately-bordered rectangular buttons stacked under
   "Structural actions" remains the heaviest single concentration of the box-button deviation anywhere
   in Progress or History. Not shown in the prototype.
