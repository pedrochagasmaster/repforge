# Native-fidelity audit — set E (program, program editor, programlab, library)

Re-checked against main 5d2ca411 on 2026-10-24, per `/tmp/uikit-audit/RECHECK.md`. 25 screen
states, both themes read directly from the recaptured committed PNGs. CSS references are to
`/tmp/taurifer-ui-kit/styles.css` unless noted; JS references to `app.js` / `program-editor.js`.
All PNGs for this set exist in both `-light-en` and `-dark-en`; none were missing. `ls` of
`docs/ui-screens/screens/{program,programlab,library}/*390-light-en.png` turns up exactly the 25
screens already in this set's list — no new screens to cover.

Out of scope per the recheck brief: the Today screen mid-session and its mini bar (#502), the rest
timer page (rest-timer packet). Neither appears in this set.

**Empty exercise art tiles** (per the recheck's explicit ask): every list/picker in this set
renders an un-illustrated movement as a plain `--well`-filled `.exthumb` square with a 1px
`--boundary-decorative` border and no placeholder glyph — it's just a blank cream/charcoal box.
Seen on library/list, library/list-selected, program/overview (via the day's exercise rows reusing
`.exthumb--sm`/`--md`), program/progression-editor, program/editor-day-name-refused, and
program/exercise-picker (most rows are blank; only exercises with licensed art, e.g. "Barbell
Romanian deadlift" in exercise-picker, show an illustration). This is the same boxed-thumbnail
deviation as shared #2 below, not a separate bug — noted here because the recheck asked for it by
name.

**Degenerate ranges** (per the recheck's explicit ask): checked every rep/RIR/set range visible in
this set's screens (program/overview's "4–8", "8–12", "10–15"; library/exercise-detail's "RIR 0–2";
program/progression-editor's "4–8"; program/editor-suggest-loads's "Current rep target · 4–8").
None collapse to a single repeated bound (no "RIR 1–1" equivalent found in area E).

## Shared components

### 1. CTA/secondary buttons are rectangular 8px-radius boxes, not pills — open
`.btn` (styles.css:649, radius line 651) and `.btn--cta` (styles.css:671, radius line 672) are
unchanged: both still set `border-radius:var(--radius-control)` (8px), `.btn` keeps its 1px
`--rule` border. Still affects every primary/secondary button in this set: "Set up a program"
(no-program), "Add 1 to Day 1"/"Add to Day 1" (library/list-selected, library/exercise-preview),
"Done"/"Save" on every editor and custom-exercise sheet (progression-editor's own page-sheet uses
text "Cancel"/"Done" links instead — see finding 8 — but its exercise/rename/custom-exercise
sub-sheets all end in a rectangular full-width CTA), "+ Create custom exercise" secondary in
exercise-picker, "Copy link"/"Share link"/"Share as file" (share-setup, share-ready,
share-too-large), "Copy"/"Share or save" (text-export), "Retry recovery" (custom-exercise-recovery).
Fix: `border-radius:var(--radius-pill)` on `.btn`/`.btn--cta`. Effort: M.

### 2. Artwork thumbnails are boxed — open
`.exthumb` (styles.css:2147) still sets `border:1px solid var(--boundary-decorative)`; dark theme
still strengthens it to `--rule-strong` for the small variant (styles.css:~452). See the empty-art
callout above for where this shows as a blank bordered box vs. a bordered illustration. Fix: drop
the border, keep the `--well` fill. Effort: S. Affects: library/list, library/list-selected,
program/overview, program/progression-editor, program/editor-day-name-refused,
program/exercise-picker (`.pickrow__eq` equipment chip, styles.css:2196, is still bordered too).

### 3. Context/row menu material — fixed by #485
`.native-context__menu` (styles.css:8370) now draws `border:0` with
`box-shadow:var(--menu-shadow)` where `--menu-shadow:var(--elevation-popover-shadow),0 0 0 .5px
var(--bar-edge)` (styles.css:129) — exactly the kit's hairline-in-shadow recipe, no border.
`.native-context__preview` (styles.css:8366), the lifted row copy, is also border-free now
(`--surface` + `--elevation-drag-shadow`). Confirmed visually: program/editor-context-menu and
program/editor-alternate-context-menu both show a borderless menu and an unbordered lifted row
preview in light and dark.

### 4. Context/row menu trailing icons — only on Today's menu; editor's own menu has none (new)
`.native-context__menu button` supports a trailing 20px icon (`.native-context__icon`,
styles.css:8376) when the item carries `item.icon`, and `openRowContextMenu` (app.js:9142) renders
it. The single call site that supplies icons is Today's exercise-row menu (app.js:9189-9192:
why→`target`, swap→`reset`, details→`dumbbell`, skip/restore→`close`/`reset`). The program editor's
own row/alternate menu is a *different* caller — `rowContext()` in program-editor.js:2958-2977 —
and it builds `items` with only `label`/`value`/`disabled`/`destructive`, never `icon`. Confirmed
in both program/editor-context-menu and program/editor-alternate-context-menu (light and dark):
"Move up", "Move down", "Move to another day", "Remove exercise"/"Remove" render with no trailing
glyph at all, even though the menu chrome around them is already fixed. Not covered by #485 — that
PR's icon work only reached the Today-row action set the kit explicitly names. Fix: give
`rowContext()`'s items an icon (e.g. up/down arrows for move, a day icon for "Move to another
day", `close` for remove) using the same `.native-context__icon` slot. Effort: S. Affects:
program/editor-context-menu, program/editor-alternate-context-menu.

### 5. Glossary definition popover — open, not covered
`.glossary` (styles.css:3444) is unchanged: `border:1px solid var(--rule)` + shadow + 12px radius,
the exact hard-bordered-popover pattern that motivated this kit, still live on a surface the
fidelity pass never touched. `.glossary__close` (styles.css:3450) is still a bare 44px `×` with no
disc — unlike `.sheetband__close`, which was fixed (finding 8). Confirmed in both themes; the pale
1px border is more visible against the dark background. Fix: reuse `--menu-shadow`
(hairline-in-shadow) in place of the border, and the `.sheetband__close` disc for the close button.
Effort: M. Affects: library/exercise-detail-glossary.

### 6. Radio-card choices are individually boxed — open, not covered
`.radio-card` (styles.css:893) is still `border:1px solid var(--control-selection-boundary);
border-radius:var(--radius-surface)` per option, each choice its own bordered card rather than a
row in an unboxed list. Confirmed in both themes for program/editor-suggest-loads's "Both sides
together" / "One side at a time" — the pale ring is more visible in dark. Effort: M (shared pattern
beyond this set). Affects (in this set): program/editor-suggest-loads.

### 7. Ledger row numbers: heavier Mono than spec, target not de-emphasized — open
`.rxrow__load` (styles.css:7887) is still `font-weight:var(--weight-medium)`; `.rxrow__target`
(styles.css:7891) is still full `color:var(--color-ink)` instead of `--ink-soft`. Unchanged since
the last pass. Affects: program/overview (every exercise row), program/share-setup,
program/share-ready, program/share-too-large, program/text-export (their collapsed
program-preview rows above the sheet).

### 8. Sheet close button disc — fixed by #485 for `.sheetband__close`; two related corrections
`.sheetband__close` (styles.css:7820, disc rule 7827) now draws a 30px `rgba(ink,.07)` disc behind
a 16px `×`, matching the kit exactly — confirmed present (not just an artifact of the disabled
state, as the previous pass suspected) on program/editor-alternates, program/editor-suggest-loads,
program/editor-day-name-refused, program/custom-exercise and its saving/deleting/archiving/recovery
variants, in both themes.
Two corrections to the previous write-up: (a) program/progression-editor is a *page sheet* (Plan
075 phase 2B) whose bar is text "Cancel"/"Done" links, not an `×` at all — there is no close-disc
finding to make there; this is the native Cancel/title/Save convention, not a kit violation. (b)
program/exercise-picker no longer opens as a modal with an `×` — it's now a full-page "‹ Back / Add
exercises / Close" flow with a text "Close" link (STEP 1 OF 2), so the old "close × has no disc"
note for this screen no longer applies either.

### 9. Persistent bottom action bar is not glass — open
`.libbar` (styles.css:2010) is still `background:var(--color-surface); border-top:1px solid
var(--boundary-persistent)` — a solid panel with a hard 1px top border, not `--bar-glass` +
`--bar-edge`. Affects: library/list-selected.

### 10. Group-label tracking: 0.08em vs the kit's 0.06em — open, low priority
`.section-label` (styles.css:548) is still `letter-spacing:0.08em`; the kit itself still lists this
as an open decision rather than a clear verdict. Affects: library/exercise-detail ("MUSCLES",
"PROGRESSION"), program/share-setup/ready/too-large ("PLANNED WEEKLY VOLUME"),
program/exercise-picker-adjacent chip labels.

### 11. Exercise-detail stat band draws a full-bleed rule, and its numbers aren't Mono — open, new (carried forward)
`.statrow` (styles.css:854) still sets `border-top:1px solid var(--rule); border-bottom:1px solid
var(--rule)` around the "1 sessions / 50 kg top load / 60 kg best e1RM / 2 PRs" group — the kit
says space, never a rule, separates groups. `.statrow__val` (styles.css:868) still has no
`font-family:var(--font-training-data)`, so the stat numbers still fall back to Plex Sans (the
`#sessionSummary`/`#todayDash` override at styles.css:3518 sets Mono correctly for that sibling
surface, `#exDetail`'s statrow still doesn't). Effort: S each. Affects: library/exercise-detail.

### 12. One sheet, two stepper styles side by side — new
program/editor-suggest-loads renders "RIR on every set" with the old bordered stepper (`.review-step`,
styles.css:2268: `border:1px solid var(--control-adjustment-boundary)`, vertical `1px` dividers,
plain text glyphs) immediately above "Smallest load change", which uses the fidelity-pass's fixed
stepper (`.native-stepper__buttons`, styles.css:8333: borderless, `--control-track` fill, masked
minus/plus icons). Both are built by the same `stepper(...)` helper call site family in
program-editor.js — RIR via `stepper()` at program-editor.js:2434 (the generic, unfixed helper),
Smallest-load-change via the dedicated `renderLoadStep()` at program-editor.js:1216 (already using
`.native-stepper__buttons`). The mismatch is visible in both themes and more glaring in dark, where
the RIR box's border reads as a pale ring the kit explicitly warns about. Not "covered by fidelity
pass 1/2/4" as the previous write-up assumed — that pass reached the load-step control but not its
sibling three lines down. Fix: route the RIR stepper through the same `.native-stepper__buttons`
markup. Effort: S. Affects: program/editor-suggest-loads.

### 13. Program Lab ignores dark theme entirely — open (confirmed again)
`cmp` on both programlab PNG pairs: `editor__phone-390-{light,dark}-en.png` and
`comparison__phone-390-{light,dark}-en.png` are still byte-identical. This is a functional gap
(the dark capture never applies the app's theme tokens), not a cosmetic one. Affects:
programlab/editor, programlab/comparison.

## Screens

### library/list
- light: docs/ui-screens/screens/library/list__phone-390-light-en.png · dark: ...dark-en.png
- severity: medium
- deviations:
  - Exercise thumbnails boxed → unbox `.exthumb` (S) [shared #2, open]
  - Filter chips and radio circles meet kit (pill, control-extent ring is the control's own
    affordance).

### library/list-selected
- light/dark: docs/ui-screens/screens/library/list-selected__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise thumbnails boxed [shared #2, open]
  - `#libBar` persistent bar is still a solid bordered panel, not glass [shared #9, open]
  - "Add 1 to Day 1" CTA still an 8px-radius rectangle, not a pill [shared #1, open]

### library/exercise-preview
- light/dark: docs/ui-screens/screens/library/exercise-preview__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations:
  - "Add to Day 1" CTA rectangular, not pill [shared #1, open]
  - Otherwise meets kit: illustration tile has no border, Muscles rows use hairlines only.

### library/exercise-detail
- light/dark: docs/ui-screens/screens/library/exercise-detail__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - `.statrow` full-bleed top/bottom rule around the stat group [shared #11, open]
  - `.statrow__val` falls back to Plex Sans instead of Mono [shared #11, open]
  - Illustration hero tile has no border — meets kit there.
  - "Day 3 · 2 × 4–8 reps · RIR 0–2" meta line checked for a degenerate range — none; meets kit.

### library/exercise-detail-glossary
- light/dark: docs/ui-screens/screens/library/exercise-detail-glossary__phone-390-light-en.png /
  ...dark-en.png
- severity: high
- deviations:
  - `.glossary` hard-bordered popover, unfixed, pale border more visible in dark [shared #5, open,
    not covered by any named PR]
  - `.glossary__close` bare 44px `×`, no disc, unlike the now-fixed `.sheetband__close` [shared #5,
    open]
  - Inherits `.statrow` issues from the parent exercise-detail screen underneath [shared #11].

### program/no-program
- light/dark: docs/ui-screens/screens/program/no-program__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations:
  - "Set up a program" CTA rectangular, not pill [shared #1, open]
  - Large title weight/tracking match kit — meets kit.
  - Dock's selected-tab styling is unchanged, out of this kit's amendment scope — not a deviation.

### program/overview
- light/dark: docs/ui-screens/screens/program/overview__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise rows (`.rxrow`) still use heavier-than-spec Mono load weight and full-ink target
    color [shared #7, open]
  - Exercise thumbnails on the row (empty-art tiles) boxed [shared #2, open]
  - "Edit" text link, day progress bar, hairline separators all meet kit.

### program/progression-editor
- light/dark: docs/ui-screens/screens/program/progression-editor__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise thumbnails boxed [shared #2, open]
  - This is a page sheet with "Cancel"/"Done" text links in its bar, not an `×` — the previous
    "close has no disc" note does not apply here (native Cancel/title/Save convention) [changed]
  - Day tabs, "..." overflow, chevron-drill row are consistent with kit's row anatomy.

### program/editor-alternates
- light/dark: docs/ui-screens/screens/program/editor-alternates__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Close `×` now has its 30px disc [shared #8, fixed by #485]
  - "Done" CTA rectangular [shared #1, open]
  - "Day 2"/"Day 3" move-to-day chips are correctly pills with a control-extent ring — meets kit.

### program/editor-suggest-loads
- light/dark: docs/ui-screens/screens/program/editor-suggest-loads__phone-390-light-en.png /
  ...dark-en.png
- severity: high
- deviations:
  - "Both sides together" / "One side at a time" are individually boxed `.radio-card`s, pale
    ring glare visible in dark [shared #6, open]
  - Close `×` has its disc [shared #8, fixed by #485]
  - "Done" CTA rectangular [shared #1, open]
  - "RIR on every set" keeps the old bordered stepper box while "Smallest load change" three lines
    below already uses the fixed borderless icon stepper — same sheet, two different components
    [shared #12, new]
  - "Suggest loads" switch meets kit (fidelity pass).

### program/editor-day-name-refused
- light/dark: docs/ui-screens/screens/program/editor-day-name-refused__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise thumbnails boxed (visible behind the sheet) [shared #2, open]
  - Close `×` has its disc [shared #8, fixed by #485]
  - "Save" CTA rectangular [shared #1, open]
  - Invalid-field error ring (thick orange outline) is a legitimate control-extent boundary — meets
    kit.

### program/exercise-picker
- light/dark: docs/ui-screens/screens/program/exercise-picker__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise thumbnails boxed, `.pickrow__eq` equipment chip also bordered [shared #2, open]
  - Now a full-page "‹ Back / Add exercises / Close" flow (STEP 1 OF 2) with a text "Close" link,
    not a modal sheet with `×` — the previous close-disc note no longer applies [changed]
  - "Done" CTA and "+ Create custom exercise" secondary both rectangular [shared #1, open]
  - Selection marks render as circles (radio-style) in this capture rather than the square
    checkbox the previous pass described — both exist in code for different picker modes; neither
    is a boxed surface, so not a new deviation [changed, cosmetic only].

### program/custom-exercise
- light/dark: docs/ui-screens/screens/program/custom-exercise__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations:
  - Close `×` has its disc [shared #8, fixed by #485]
  - "Save" CTA rectangular [shared #1, open]
  - Equipment/muscle pill chips are correctly pills with control-extent ring — meets kit.

### program/custom-exercise-saving
- light/dark: docs/ui-screens/screens/program/custom-exercise-saving__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations:
  - Close `×` keeps its disc even disabled — confirmed deliberate, not an accident of the disabled
    style as previously suspected [shared #8, fixed by #485]
  - "Saving..." bottom bar rectangular [shared #1, open]

### program/custom-exercise-deleting
- light/dark: docs/ui-screens/screens/program/custom-exercise-deleting__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations: same as custom-exercise-saving [shared #1 open, #8 fixed]; "Deleting..." label reads
  as a named, disabled action — no new issue.

### program/custom-exercise-archiving
- light/dark: docs/ui-screens/screens/program/custom-exercise-archiving__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations: same as above [shared #1 open, #8 fixed]. Archive rationale footnote renders as plain
  text under the hairline, no box — meets kit.

### program/custom-exercise-recovery
- light/dark: docs/ui-screens/screens/program/custom-exercise-recovery__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations: [shared #1 open, #8 fixed]. "Retry recovery" secondary action is a bordered
  rectangle, same `.btn` radius issue as elsewhere — no new pattern.

### program/share-setup
- light/dark: docs/ui-screens/screens/program/share-setup__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations:
  - Exercise-row numbers [shared #7, open]
  - "Copy link" CTA rectangular [shared #1, open]
  - Close `×` has its disc [shared #8, fixed by #485]
  - The setup-link textarea's 1px border is a legitimate control-extent field boundary — meets kit.

### program/share-ready
- light/dark: docs/ui-screens/screens/program/share-ready__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations: same as share-setup, plus "Copy link"/"Share link" pair both rectangular [shared #1
  open, #7 open, #8 fixed].

### program/share-too-large
- light/dark: docs/ui-screens/screens/program/share-too-large__phone-390-light-en.png /
  ...dark-en.png
- severity: medium
- deviations: same family [shared #1 open, #7 open, #8 fixed]; "Share as file" rectangular.

### program/text-export
- light/dark: docs/ui-screens/screens/program/text-export__phone-390-light-en.png /
  ...dark-en.png
- severity: low
- deviations: [shared #1 open on "Copy"/"Share or save", #7 open on the background preview rows,
  #8 fixed]. The plain-text body itself is expected to be Plex Sans (literal export content) — not
  a deviation.

### programlab/editor
- light: docs/ui-screens/screens/programlab/editor__phone-390-light-en.png · dark:
  ...dark-en.png
- severity: high
- deviations:
  - Dark variant is still byte-identical to light (`cmp` confirms again) — Program Lab still does
    not apply the dark theme [shared #13, open]
  - Desktop-style boxed form chrome (select, text inputs, listbox, Move up/down/Remove case
    buttons) is expected for an internal scenario-authoring tool, not scored against the mobile
    kit's vocabulary — not a finding, noting scope.

### programlab/comparison
- light: docs/ui-screens/screens/programlab/comparison__phone-390-light-en.png · dark:
  ...dark-en.png
- severity: high
- deviations:
  - Same missing-dark-theme issue, confirmed again via `cmp` [shared #13, open]
  - Candidate metric numbers ("96.0 min", "100", "80.0% (80/100)") are correctly Plex Mono with
    tabular figures — meets kit despite the rest of the screen being a developer tool.
  - "Changed in candidate" tag is a bordered pill chip, acceptable as a control-style badge.

### program/editor-context-menu
- light: docs/ui-screens/screens/program/editor-context-menu__phone-390-light-en.png · dark:
  ...dark-en.png
- severity: medium (down from high — the material is fixed; the remaining gap is icons only)
- deviations:
  - Menu material now borderless with the hairline-in-shadow edge; lifted "Hack squat" preview
    card now unbordered too [shared #3, fixed by #485]
  - "Move up" / "Move down" / "Move to another day" / "Remove exercise" still render with no
    trailing icon at all — this is a different code path from Today's menu and was never given
    icon assignments [shared #4, new]

### program/editor-alternate-context-menu
- light: docs/ui-screens/screens/program/editor-alternate-context-menu__phone-390-light-en.png ·
  dark: ...dark-en.png
- severity: medium (down from high, same reason as editor-context-menu)
- deviations: same pattern — menu material and lifted "45° leg press" preview fixed [shared #3,
  fixed by #485]; "Move up" / "Move down" / "Remove" still have no icons [shared #4, new].

## Worst 3

1. **programlab/editor and programlab/comparison** — not cosmetic, a broken contract: re-confirmed
   via `cmp` that the dark-theme capture is still byte-identical to light. Program Lab ignores dark
   mode entirely, unchanged since the last pass despite everything else in this set moving forward.
2. **library/exercise-detail-glossary** — still reproduces the kit's own origin complaint (hard
   1px-bordered floating layer, bare close button) on the one surface in this set the fidelity pass
   never reached, even after that pass fixed the identical pattern everywhere else (context menus,
   sheets).
3. **program/editor-suggest-loads** — the busiest sheet in the set, and the clearest sign the
   fidelity pass's reach is uneven within a single screen: boxed radio-cards, a rectangular Done
   CTA, and now a visibly inconsistent pair of steppers (one fixed, one not) stacked three rows
   apart.
