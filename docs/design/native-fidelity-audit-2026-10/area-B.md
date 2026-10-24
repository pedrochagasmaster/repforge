# Native-fidelity audit — onboarding-recommend (Direction B)

Re-checked against current main (5d2ca411, worktree rebased past #483/#503 wheel physics, #484 phase 3
navigation, #485 fidelity pass, #486/#488/#489 bug fixes, #498/#500/#501 onboarding inputs, #499 phase 5).
Re-audited against `/tmp/taurifer-ui-kit/docs/design/native-ui-kit.md`. Production CSS is
`/tmp/taurifer-ui-kit/styles.css` (line numbers below are current; most shifted from the prior pass).
All screens in `screens-B.md`, plus the screens added since (`split`, `deload-start`,
`exercise-preferences`, `exercise-preferences-chosen`, `muscle-priorities-skip`), were viewed in both
light and dark; no dark PNG is byte-identical to its light twin (`cmp` run on every pair). PT and
text200 variants exist for several screens but were not separately reported per the brief.

**Net effect of the work since the last pass.** Of #485's "fixed in this PR" items, exactly one
reaches this area's own CSS: the sheet close button now gets the 30px disc (`.sheetband__close`),
so every sheet/dialog in this set (`result-block-sheet`, `review-sheet`, `review-sheet-execution-mode`,
`review-sheet-swap`, `review-day-menu`) now closes correctly. Everything else #485 fixed — the
segmented control, the stepper, row-pressed wash, the dock, the context menu — lives in components
this area doesn't share: onboarding and review draw their own `.entry-*`, `.review__*` and
`.program-editor__*` CSS, parallel to (and still behind) the primitives #485 touched elsewhere
(`.native-segments`, `.native-stepper__buttons`). So the boxed-card, rectangle-button and
boxed-icon-button findings below are almost all still open, unchanged in substance, just at new line
numbers. One new screen-local finding (empty exercise art tiles) is added per the recheck brief.

## Shared components

### 1. Choice-card boxes (`.entry-body .radio-card`, `#onbBody .onb__opts.onb__num .radio-card`)
**Status: open.** `styles.css:4451` `.entry-body .radio-card{border:1px solid var(--rule);
border-radius:var(--radius-surface);...}`; the numeric-card variant is `styles.css:8002`
`#onbBody.entry-body .onb__opts.onb__num .radio-card{...}`. Still three different "selected"
treatments across the family (plain ink ring on enumerations; accent ring + filled accent check on
`result-block-sheet`'s rep pattern; 2px solid outline on numeric cards). Fix and effort unchanged:
hairline list rows (`.onb__opts.onb__list`) for plain enumerations, M.
Affects: sex, background, cardio-experience, environment, equipment, equipment-adjusted,
desired-result, days-per-week, session-length, deload (now also its new **When** "At the end"/"At
the start" pair, `new` — see Screens), abilities, result-block-sheet (rep-pattern options),
review-sheet-execution-mode, **split** (`new` screen, weekly-structure options), chip-editor-open's
inline day/session-length numeric cards.

### 2. Primary/secondary CTA buttons are rectangles, not pills (`.btn`, `.btn--cta`)
**Status: open.** `styles.css:649` `.btn{border:1px solid var(--rule);
border-radius:var(--radius-control);...}`, `styles.css:671` `.btn--cta{...border-radius:
var(--radius-control);...}`; `--radius-control` is still 8px (`styles.css:88`), `--radius-pill` is
999px (`styles.css:97`). `.btn--ghost` (Skip) is still correctly a pill. No change.
Affects: every screen with a Continue/Start/Use this program/Apply/Done/Save/Swap/Archive/Review
again/Rebuild/Replace button — all screens in this set except building/building-pending (ghost
pill). Also affects the three new screens (deload-start, exercise-preferences,
exercise-preferences-chosen, split, muscle-priorities-skip).

### 3. Per-set RIR value is boxed (`.review__rir`)
**Status: open.** `styles.css:7671` `.review__rir{...border:1px solid var(--boundary-decorative);
border-radius:var(--radius-control);font-family:var(--font-training-data);...}` — unchanged shape,
new line number. Fix/effort unchanged (S): drop the border, right-align in a fixed column.
Affects (static display rows): result, result-confirm-offer, result-confirmed, result-changed,
result-existing, result-corrected, result-avoided, activation-conflict, replacement-confirm,
review-rebuild-confirm.
Distinct from, but visually the same family as, the **editable** per-set stepper used in
review-sheet and review-sheet-execution-mode (`.program-editor__stepper`, `styles.css:2903`,
`border:1px solid var(--rule-strong)`) — see new note under Screens: that stepper was **not**
migrated to the borderless `.native-stepper__buttons` primitive (`styles.css:8333`, no border, icon
glyphs, 36px) that #485 shipped for Settings. Same box problem, separate component, still open.

### 4. Dialog carries both a border and a shadow (`.entry-dialog`)
**Status: open.** `styles.css:7725` `.entry-dialog{...border:1px solid var(--boundary-modal);
border-radius:var(--radius-prominent);...box-shadow:var(--elevation-dialog-shadow)}` — unchanged,
confirmed in both themes (the border is a visible lighter-grey ring against near-black in dark).
Buttons inside are still full-width stacked rectangles (`.entry-dialog__actions{flex-direction:
column}`, `.btn{width:100%}`).
Affects: birth-date-typed, birth-date-typed-invalid, review-rebuild-confirm, replacement-confirm.

### 5. Inline notice/alert is a bordered card, one variant dashed (`.entry__notice`, `.review__empty`)
**Status: open.** `styles.css:4138` `.entry__notice{...border:1px solid var(--rule);
border-left:3px solid var(--rule-strong);background:var(--surface)}` — unchanged. The
`review-empty-day` warning is a distinct, dedicated class, also unchanged:
`styles.css:7684` `.review__empty{...border:1px dashed var(--color-warning);
border-radius:var(--radius-surface);...}` — still the most "form validation"-like surface in the set.
Affects: result-equipment-conflict, activation-conflict, review-empty-day.

### 6. Icon-only buttons are drawn with a visible box
**Status: open.** Reorder arrows in `review-reorder` (`.review__ro-btn`, `styles.css:7696`,
`border:1px solid var(--control-adjustment-boundary)`) and the in-session alternates' up/down/remove
trio in `review-sheet-swap` (`.program-editor__alternate-move`/`-remove`, `styles.css:2954`,
`border:1px solid var(--control-secondary-boundary)`) both still draw a visible box. Confirmed again
in dark: both read as a light-grey outline glaring against the near-black page, the exact
dark-theme problem the kit flags generically (§7). Note for future passes: a same-named but
unrelated control, the Today session map's own reorder button (`.session-map__reorder-btn`,
`styles.css:2467`), already has `border:1px solid transparent` — i.e. that *other* feature was
already fixed to the kit's no-visible-box rule, but review-reorder's own button class was not; don't
assume the fix carried over just because a similarly-named class exists elsewhere.
Affects: review-reorder, review-sheet-swap.

### 7. Height/weight unit toggle duplicates the segmented control, with a louder selected state
**Status: open, and now confirmed to be the same component behind the muscle-priorities tri/quad-
choice.** `.entry-seg`/`.entry-seg__option` (`styles.css:8236`) is still a parallel, hand-rolled
segmented control (own track, own thumb-less logic) rather than the shipped `.native-segments`
primitive (`styles.css:8309`, which #485 already made borderless/shadow-thumb elsewhere, e.g.
Settings). Selected option still gets `border-color:var(--boundary-selected-quiet)` plus
`box-shadow:var(--elevation-selected-quiet-shadow)` (`styles.css:8238`) — a visible ring, not a
raised paper thumb. Confirmed this is also what renders muscle-priorities' Skip/Less/Normal/More
row (`.entry-b__priority>.entry-seg`, `styles.css:8235`): each option is its own bordered pill
inside the track, and the selected one gets the same ring treatment — the original "individually
bordered box" read was this same `.entry-seg`, not `.radio-card`.
Affects: height, height-ftin, weight, weight-lb, muscle-priorities, muscle-priorities-limit,
**muscle-priorities-skip** (`new` screen, same pattern).

### 8. "Add exercise" / day-menu rows use leading icons where kit wants them trailing
**Status: open.** `review-day-menu`'s Rename day / Reorder exercises / Add exercise rows, and
`review-empty-day`'s "+ Add exercise" link, still put the glyph before the label. Unchanged.
Affects: review-day-menu, review-empty-day.

### 9. Full-bleed rule used as a group separator
**Status: open.** `building`/`building-pending` still draw a full-width 1-2px solid rule between the
checklist and the "Show the program now" CTA, confirmed in both themes. Unchanged.
Affects: building, building-pending.

### 10. Empty exercise art tiles (`new`)
Several exercise rows render a plain, unillustrated placeholder instead of the line-art thumbnail:
`.exthumb--empty{background:var(--well)}` (`styles.css:2154`) — a flat muted-fill box at the same
size/radius as a populated thumbnail (`.exthumb--sm` 52px, `.exthumb--lg` 88px on review-sheet's
head), with no icon, pattern or placeholder glyph. This isn't a kit violation (the kit doesn't
specify a missing-art treatment) but it is a visible blank surface across several of this area's
screens, worth the owner's awareness as a content-completeness gap: result-confirmed's "Pause
barbell bench press", result-changed's "Pendlay row", review-sheet-execution-mode's "B-stance
dumbbell Romanian deadlift", and all three swap candidates in review-sheet-swap ("Close grip Smith
machine bench press", "Pause Smith machine bench press", "Low incline Smith machine press"). Where
the primary exercise has curated art (e.g. "Smith machine bench press" throughout), the tile is a
proper illustration. Effort: content (curation), not CSS.

**Checked, no finding:** no screen in this area renders a degenerate range (e.g. "RIR 1–1" or a
min/max pair with equal bounds) — every rep range and RIR value observed is a genuine range or a
single value. The Focus meta line does not appear in onboarding-recommend; it belongs to the
Today/session-execution screens, out of this area (and out of scope per the recheck brief, #502 /
rest-timer packet).

## Screens

### onboarding-recommend/intro
- severity: low
- deviations:
  - open: "Start with the basics" CTA is a rounded rectangle, not a pill → shared #2 (S)
  - meets kit: numbered-circle steps unboxed, single hairline above the CTA is the only separator.

### onboarding-recommend/sex
- severity: medium
- deviations:
  - open: Female/Male/Prefer not to say rows are boxed choice cards → shared #1 (M)
  - open: Continue/Skip are rectangle+pill respectively (inconsistent) → shared #2 (S)

### onboarding-recommend/birth-date
- severity: low
- deviations:
  - meets kit: wheel band (hairline above/below the centered row), no box around the wheel group.
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/birth-date-typed
- severity: medium
- deviations:
  - open: year-entry dialog has a 1px border *and* a shadow → shared #4 (S)
  - open: Done/Cancel are stacked rectangles, not pills → shared #2 (S)

### onboarding-recommend/birth-date-typed-invalid
- severity: medium
- deviations: same as birth-date-typed → shared #4, #2 (both open). Error copy itself is unboxed
  text and meets kit.

### onboarding-recommend/height
- severity: medium
- deviations:
  - open: Centimeters/Feet-and-inches toggle is `.entry-seg`, the parallel segmented control →
    shared #7 (M)
  - meets kit: wheel band
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/height-ftin
- severity: medium
- deviations: same as height → shared #7, #2 (both open).

### onboarding-recommend/weight
- severity: medium
- deviations:
  - open: Kilograms/Pounds toggle → shared #7 (M)
  - meets kit: big value ("80.5 kg") uses Plex Mono (`.entry-ruler__value b`)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/weight-lb
- severity: medium
- deviations: same as weight → shared #7, #2 (both open).

### onboarding-recommend/background
- severity: medium
- deviations:
  - open: four lifting-experience rows are boxed choice cards → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/cardio-experience
- severity: medium
- deviations: same pattern as background → shared #1, #2 (both open).

### onboarding-recommend/environment
- severity: medium
- deviations:
  - open: six gym-preset rows are boxed choice cards (leading identity icon itself is correct per
    kit) → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/equipment
- severity: medium
- deviations:
  - open: thirteen equipment checkboxes are boxed rows (ticked rows get a second, heavier border,
    plus a tinted fill) → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/equipment-adjusted
- severity: medium
- deviations: same as equipment → shared #1, #2 (both open).

### onboarding-recommend/desired-result
- severity: medium
- deviations:
  - open: three goal rows (leading identity icons correct) are boxed choice cards → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/days-per-week
- severity: medium
- deviations:
  - open: 2–6 day numeric cards are boxed; numerals correctly Plex Mono → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/session-length
- severity: medium
- deviations: same pattern as days-per-week → shared #1, #2 (both open).

### onboarding-recommend/muscle-priorities
- severity: medium
- deviations:
  - meets kit: the row list itself (Chest/Back/Quads…) is hairline-separated, unboxed.
  - open, reclassified: each row's Skip/Less/Normal/More choice is `.entry-seg` (confirmed — see
    shared #7), the selected option drawn with its own ink-bordered box rather than a raised
    segmented thumb → shared #7 (M)
  - open: Continue/Skip rectangle+pill inconsistency → shared #2 (S)

### onboarding-recommend/muscle-priorities-limit
- severity: medium
- deviations: same as muscle-priorities, now with all 22 rows showing "More" boxed.

### onboarding-recommend/muscle-priorities-skip (`new`)
- severity: medium
- deviations: same pattern as muscle-priorities, scrolled to show Calves set to Skip — no new
  deviation beyond shared #7, #2.

### onboarding-recommend/deload
- severity: medium
- deviations:
  - open: "Add a lighter week" sits in a bordered card (`.entry-b__deload`, `styles.css:8243`,
    `border:1.5px solid var(--rule)`) → related to shared #1/#5 (S)
  - meets kit: the switch itself (orange track, white thumb) — matches the kit's switch spec.
  - `new`: the screen now also shows a **When** section ("At the end" / "At the start") that the
    prior pass didn't capture — both options are boxed `.radio-card` choice cards → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/deload-start (`new`)
- severity: medium
- deviations: the same screen as deload with "At the start" selected in the When section — no
  deviation beyond deload's own (shared #1, #2).

### onboarding-recommend/abilities
- severity: medium
- deviations:
  - open: seven Yes/No/Not-sure groups render each option as its own bordered, gapped button (not a
    single segmented track) → shared #1 (M)
  - open: Continue/Skip rectangle+pill inconsistency → shared #2 (S)

### onboarding-recommend/exercise-preferences (`new`)
- severity: low
- deviations:
  - meets kit: the two search fields are plain bordered text inputs — the kit doesn't specify a
    different treatment for a search field, so this isn't a box violation in the kit's terms.
  - open: Continue is a rectangle, Skip a pill (inconsistent) → shared #2 (S)

### onboarding-recommend/exercise-preferences-chosen (`new`)
- severity: low
- deviations:
  - meets kit: the chosen-exercise chips ("Smith machine bench press ×", "45° incline dumbbell
    press ×") are pills with a 1px border — a legitimate "control whose extent is the affordance"
    per kit rule 1.
  - open: Continue/Skip rectangle+pill inconsistency → shared #2 (S)

### onboarding-recommend/split (`new`)
- severity: medium
- deviations:
  - open: the three weekly-structure options (Full body / Upper-lower-full body / Push-pull-legs)
    are boxed choice cards → shared #1 (M)
  - open: Continue is a rectangle → shared #2 (S)

### onboarding-recommend/building
- severity: medium
- deviations:
  - open: full-bleed rule between checklist and CTA → shared #9 (S)
  - meets kit: "Show the program now" CTA is a pill (`.btn--ghost`), a positive outlier.

### onboarding-recommend/building-pending
- severity: medium
- deviations: same as building; "Building…" status label is plain text, unboxed — meets kit.

### onboarding-recommend/result
- severity: high
- deviations:
  - open: per-set RIR values are boxed → shared #3 (S)
  - open: "Yes, swap it in" is a bordered rectangle, not a pill → shared #2 (S)
  - open: "Use this program" CTA is a rectangle → shared #2 (S)
  - meets kit: day-tab row (Upper/Rest/Lower…) uses an underline for the active tab, no box.
  - meets kit: stat row (3 / 49–53 / 18 / 8) is an unboxed hairline-bounded group; no degenerate
    range in the stat line.

### onboarding-recommend/result-confirm-offer
- severity: high
- deviations: same as result → shared #2, #3 (both open).

### onboarding-recommend/result-confirmed
- severity: high
- deviations: same as result, plus "Undo" is a plain text link (meets kit) next to boxed RIR values
  and a rectangular CTA → shared #2, #3. `new` note: this row's exercise ("Pause barbell bench
  press") shows an empty art tile → shared #10.

### onboarding-recommend/result-block-sheet
- severity: medium (down from high — close disc now present)
- deviations:
  - `fixed by #485`: the close control is now a 16px × in a filled 30px disc (`.sheetband__close`),
    matching the kit's one-exit spec. Previously flagged as a bare glyph.
  - open: sheet chrome (grabber, header, body scroll) otherwise matches kit anatomy, aside from the
    "Apply" CTA being a rectangle → shared #2 (S)
  - open: four rep-pattern options are still boxed choice cards, and the selected one still uses a
    third selection treatment (accent-colored border + filled accent check-circle), inconsistent
    with the ink-ring used elsewhere → shared #1 (M)

### onboarding-recommend/result-equipment-conflict
- severity: medium
- deviations:
  - open: error card ("These answers don't make a program…") is a bordered, left-accented card →
    shared #5 (S)
  - open: "Back to equipment" CTA is a rectangle → shared #2 (S)

### onboarding-recommend/result-changed
- severity: high
- deviations:
  - meets kit: "3 changes of yours" / Undo / Restore row is unboxed text.
  - open: per-set RIR values boxed on every adjusted exercise → shared #3 (S)
  - meets kit: "ADJUSTED" tag is plain caption text, unboxed.
  - open: "Yes, swap it in" and "Use this program" are rectangles → shared #2 (S)
  - `new`: "Runs past 60 min, the time you chose" warning line is plain unboxed text, in the
    destructive/warning ink — meets kit (no box, unlike the notice-card pattern elsewhere).
  - `new`: "Pendlay row"'s thumbnail is an empty art tile → shared #10.

### onboarding-recommend/review-sheet
- severity: high
- deviations:
  - open, reclassified: the per-set Reps/RIR stepper (`− value +`) is still a bordered rectangle,
    but it's a **different, still-unmigrated** component than originally described —
    `.program-editor__stepper` (`styles.css:2903`), not the Settings-style borderless
    `.native-stepper__buttons` (`styles.css:8333`) that #485 introduced. The fidelity-pass tag this
    was filed under in the prior audit doesn't actually cover this component; it remains open on its
    own, S–M to migrate.
  - `fixed by #485`: close "×" now has the 30px disc.
  - open: "Done" CTA is a rectangle → shared #2 (S)
  - open: set-index circles ("1/2/3") are filled `--well` discs rather than a plain Mono index
    column — low priority, unchanged (L→S)

### onboarding-recommend/review-sheet-execution-mode
- severity: high
- deviations:
  - open: "Both sides together"/"One side at a time" are boxed choice cards → shared #1 (M)
  - open, reclassified: steppers boxed, same `.program-editor__stepper` gap as review-sheet above —
    not actually covered by the fidelity pass
  - `fixed by #485`: close disc present.
  - open: Done CTA rectangle → shared #2 (S)
  - `new`: this exercise ("B-stance dumbbell Romanian deadlift")'s thumbnail is an empty art tile →
    shared #10.

### onboarding-recommend/review-sheet-swap
- severity: high
- deviations:
  - open: each "Swap" button is an individually bordered rectangle → shared #2 (S)
  - open: in-session alternate's up/down/remove controls are boxed icon-only buttons, confirmed
    glaring in dark (light-grey outline on near-black) → shared #6 (S)
  - `fixed by #485`: close disc present.
  - open: "Done" CTA rectangle → shared #2 (S)
  - meets kit: "Show 9 more" / "Search the catalog" are plain text links.
  - `new`: all three swap candidates ("Close grip…", "Pause Smith machine…", "Low incline Smith
    machine press") render empty art tiles → shared #10.

### onboarding-recommend/review-day-menu
- severity: medium
- deviations:
  - meets kit: row list itself is hairline-separated and unboxed.
  - open: Rename/Reorder/Add icons are leading, not trailing → shared #8 (S)
  - `fixed by #485`: close disc present (previously flagged as missing here too).

### onboarding-recommend/review-day-name-refused
- severity: medium
- deviations:
  - unaffected by shared #4: this is a sheet (grabber present), not a dialog.
  - open: text field's error/focus ring still sits flush against the field edge rather than as an
    offset outline, same treatment reused from birth-date-typed (S)
  - open: "Save" CTA rectangle → shared #2 (S)

### onboarding-recommend/review-reorder
- severity: high
- deviations:
  - open: up/down reorder buttons are boxed icon-only controls (`.review__ro-btn`), confirmed still
    glaring in dark mode → shared #6 (S)
  - meets kit: grip handle (leading, left of label) is correct per kit (identity/affordance icon).
  - open: "Done" CTA rectangle → shared #2 (S)

### onboarding-recommend/review-empty-day
- severity: high
- deviations:
  - open: "This day has no exercises" warning is still a dashed-border box (`.review__empty`), the
    most box-like surface in the set → shared #5 (S)
  - open: "+ Add exercise" uses a leading plus icon → shared #8 (S)
  - open: "Use this program" disabled CTA is a rectangle → shared #2 (S)

### onboarding-recommend/review-rebuild-confirm
- severity: high
- deviations:
  - open: dialog has border + shadow → shared #4 (S)
  - open: "Rebuild the program" / "Keep my changes" are stacked rectangles, not pills → shared #2 (S)

### onboarding-recommend/result-existing
- severity: high
- deviations:
  - open: same result-list issues (boxed RIR, rectangular Swap/CTA) → shared #2, #3
  - open: "Archive current program and use this one" CTA wraps to two lines inside a rectangle →
    shared #2 (S)

### onboarding-recommend/chip-editor-open
- severity: medium
- deviations:
  - meets kit: answer chips ("Muscle and strength", "3 days a week"…) are pills with a 1px border —
    acceptable per kit rule 1. Selected/open chip still gets a second, thicker (2px) black ring,
    confirmed unchanged — a second selection language versus the ink-ring used elsewhere.
  - open: inline "Schedule" editor still framed by a solid vertical rule down its left edge, a
    partial box where kit would use space (S)
  - open: day-count/session-length numeric cards inside the inline editor are boxed → shared #1 (M)

### onboarding-recommend/result-corrected
- severity: medium
- deviations:
  - meets kit: "Why it fits" list (Goal/Fits N days/Written for.../Loads and reps adapt) is unboxed,
    hairline-separated, leading identity icons — one of the better kit matches in the set.
  - open: "Restore" and "Start over" are bordered rectangles, not pills → shared #2 (S)
  - open: "Use this program" CTA rectangle → shared #2 (S)

### onboarding-recommend/result-avoided
- severity: medium
- deviations: same as result-corrected → shared #2; "Why it fits" list again meets kit.

### onboarding-recommend/replacement-confirm
- severity: high
- deviations:
  - open: dialog has border + shadow → shared #4 (S)
  - open: "Archive and use Your 3-day program" / "Keep Current program" stacked rectangles →
    shared #2 (S)

### onboarding-recommend/activation-conflict
- severity: medium
- deviations:
  - open: "Your active program changed" banner is a bordered, left-accented card → shared #5 (S)
  - open: "Review again" and "Archive current program and use this one" are rectangles → shared #2
    (S)

## Worst 3

Unchanged from the prior pass — none of the three screens below benefited from work landed since
(#485's segmented-control/stepper/row-wash fixes live in primitives this area's own `.entry-*` /
`.review__*` CSS doesn't yet share; only the sheet close disc crossed over).

1. **review-sheet-swap** — still the densest concentration of boxed controls in the set: every
   "Swap" button is individually bordered, and the in-session alternate's up/down/remove trio are
   boxed icon-only buttons, confirmed glaring in dark mode; three of its rows now also show empty
   art tiles. Nothing here was shown in the prototype.
2. **replacement-confirm** (and its twin review-rebuild-confirm) — the dialog still draws exactly
   the combination the kit's "what it never draws" list calls out by name: a border *and* a shadow
   on the same surface, then stacks two rectangular buttons under it instead of pills.
3. **review-empty-day** — the dashed-outline warning box is still the most visibly "form
   validation"-like surface in the whole catalog, sitting directly against kit rule 1; paired with a
   leading-icon "Add exercise" link and a disabled rectangular CTA, it reads the furthest from the
   prototype's unboxed, spacing-led layout.
