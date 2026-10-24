# Native-fidelity audit — Set F (settings, install, catalog-recovery)

Re-check against current main (5d2ca411, app.js ?v=516/CACHE v516 at merge). 27 screens reviewed,
light + dark (both views read for every screen; no byte-identical light/dark pair in this set).
No new screens: the catalog directories (`settings/`, `install/`, `catalog-recovery/`) still hold
exactly the 27 PNGs this set covers.

Since the previous pass: #485 (fidelity pass — context menu, row ⋯, sheet close, segmented control,
steppers, pressed-row wash) touched this set directly — it fixed the shared sheet-close button
(finding 5 below) app-wide. #483 (wheel picker), #484 (phase 3 navigation), #486/#488/#489 (owner-bug
fixes), #498/#500/#501 (onboarding inputs) and #499 (phase 5 large text, concentric shelf) do not
touch settings, install, or catalog-recovery markup or CSS — grepped for their selectors/ids in this
set's screens and found no overlap. Out of scope per the re-check brief: the Today screen mid-session
and the rest timer page (not in this set regardless).

Also checked, as instructed: empty exercise-art tiles and degenerate ranges like "RIR 1–1" do not
appear anywhere in this set — none of the 27 screens render an exercise thumbnail or a computed
RIR/rep range; "RIR" only appears as prose copy (RIR logging row, guide text).

## Shared components

### 1. Buttons are rectangular, not pills — `open`
- **Selectors:** `.btn` (styles.css:649, `border:1px solid var(--rule);border-radius:var(
  --radius-control)`), `.btn--cta` (styles.css:671, `border:0;border-radius:var(--radius-control)`).
  `.installbanner__action` still resolves to `.btn.btn--cta`.
- **Deviation:** unchanged. Every CTA/secondary button in this set (`Got it`, `Install`, `Install and
  transfer my data`, `Install without transferring`, `Retry`, `Retry transfer`, `Continue`, `Resume in
  browser`) still renders at `--radius-control` (8px), not a pill. Confirmed in the recaptured PNGs
  (e.g. `install/transfer-eligible`, `catalog-recovery/unavailable`).
- **Fix:** unchanged — switch `.btn`/`.btn--cta` to `--radius-pill`.
- **Effort:** M (shared app-wide).
- **Affects:** settings/guides, settings/guides-replay, settings/backup-guide,
  settings/install-guide, install/banner, install/transfer-eligible, install/transfer-ready,
  install/transfer-retryable, install/transfer-success, install/transfer-cleanup,
  install/transfer-terminal, install/transfer-destination, install/transfer-interrupted,
  install/transfer-unknown, install/transfer-claimed-expired, catalog-recovery/unavailable,
  catalog-recovery/retry-failed.

### 2. Dialogs draw a border *and* a shadow on the same surface — `open`
- **Selectors:** `.entry-dialog` (styles.css:7725, used for the guide dialog via
  `guideDialogElement()` in app.js) — `border:1px solid var(--boundary-modal)` (resolves to
  `--rule-strong`, a visible line) plus `box-shadow:var(--elevation-dialog-shadow)`;
  `.exercise-catalog-recovery` (styles.css:3621) — `border:1px solid var(--rule)` plus the same
  shadow.
- **Deviation:** unchanged, confirmed visually in both themes (`settings/guides-replay`,
  `catalog-recovery/unavailable`).
- **Fix:** unchanged — drop the `border`, keep the shadow.
- **Effort:** S.
- **Affects:** settings/guides-replay, settings/backup-guide, settings/install-guide (all three
  render `#guideDialog`), catalog-recovery/unavailable, catalog-recovery/retry-failed.

### 3. Settings danger row is a boxed rectangular button — `open`
- **Selector:** `.settings-row.is-danger,#reset.settings-row` (styles.css:974) — unchanged rule,
  `border:1px solid var(--control-destructive-boundary); border-radius:var(--radius-control);
  background:var(--control-destructive-bg)`. The block still carries its own code comment ("The one
  row that is still a box...") from before this set was first audited — not a new rationale from
  #485/#499, and the kit (native-ui-kit.md §3) still names this row directly as off-kit.
- **Deviation:** unchanged.
- **Fix:** unchanged — render as a plain destructive list row, no box.
- **Effort:** S.
- **Affects:** settings/guides, settings/guides-replay, settings/backup-guide,
  settings/install-guide, settings/privacy.

### 4. Contextual-guide replay list is a stack of bordered button-cards, not rows — `open`
- **Selector:** `.guide-replay .btn` (styles.css:3688) wrapping `.guide-replay__item`
  (styles.css:3689) — unchanged.
- **Deviation:** unchanged, confirmed in the recaptured `settings/guides-replay` dark PNG: "Choose
  how to begin", "Log your first set" etc. are still full-width bordered cards, not hairline rows.
- **Fix:** unchanged — rebuild as `.li`-style rows.
- **Effort:** M.
- **Affects:** settings/guides, settings/guides-replay, settings/backup-guide,
  settings/install-guide.

### 5. Sheet close button is a bordered 44px disc, not a borderless 30px fill — `fixed by #485`
PR #485 ("Context menu, row ⋯ and sheet close match the prototype", commit 3058a364) rebuilt
`.sheetband__close` (styles.css:7820-7828) to the kit's spec: it adds a `::before` 30px disc of
`var(--control-track)` (`rgba(ink,.07)`) behind a 16px × icon, and the button's own `border-color`/
`background` resolve through `--control-quiet-boundary`/`--control-quiet-bg`, both `transparent` in
both themes (styles.css:167-169, not overridden in the dark block) — so the formerly-visible 44px
ring is gone in light and dark. Confirmed in the recaptured PNGs for `install/ios-sheet`,
`install/transfer-eligible`, `install/transfer-ready`, `settings/privacy-disclosure`, and the rest of
the `.sheetband` screens: the close control is now a plain soft disc, no outline, in both themes. The
bright ring still visible on `install/ios-sheet`'s dark close button is the `:focus-visible` outline
(`--control-focus-outline`, kit §10 — a required, never-removed state), not the old decorative
border.

### 6. Install-transfer disclosure block is a bordered card — `open`
- **Selector:** `.install-transfer__disclosure` (styles.css:5738) — unchanged,
  `background:var(--well); border:1px solid var(--boundary-decorative); border-radius:var(
  --radius-surface)`.
- **Deviation:** unchanged, confirmed in `install/transfer-eligible` and `install/transfer-retryable`
  (the Cloudflare disclosure box keeps its visible rounded border in both themes).
- **Fix:** unchanged.
- **Effort:** S.
- **Affects:** install/transfer-eligible, install/transfer-retryable.

### 7. Numeric training-data fields render in Plex Sans, not Plex Mono — `open`
- **Selector:** `input:not(:where([type=checkbox],[type=radio])),select,textarea` (styles.css:697) —
  `font-family:var(--font-language)`. No per-id override exists for `#jumpPct`, `#minJump`,
  `#rirHigh`, `#hardRir`, `#restSec` (grepped app.js/styles.css for each id — no font-family rule
  anywhere).
- **Deviation:** unchanged, confirmed visually: the typed "120" (rest seconds) and "2.5" (load jump %)
  fields in the recaptured `settings/rest-controls` / `settings/load-controls` PNGs still render in
  the same sans-serif weight as surrounding body copy, not Mono.
- **Fix:** unchanged.
- **Effort:** S.
- **Affects:** settings/rest-controls, settings/load-controls.

### 8. `.textlink` has no base style — renders as the browser's unstyled `<button>` — `open`
- **Selector:** `.textlink` — still only one rule touches this class,
  `.install-transfer__disclosure .textlink{margin-top:10px}` (styles.css:5742); no base
  `.textlink{}` rule exists anywhere in styles.css.
- **Deviation:** unchanged. Confirmed in the recaptured `install/transfer-eligible` PNGs:
  "Read full privacy details" is a bordered grey box in light (default UA button chrome, which now
  coincidentally reads as "a button" against the paper background) and a flat mid-grey slab in dark —
  the same unstyled-native-button symptom as before, still the most visibly broken control in the set.
- **Fix:** unchanged — add a `.textlink` base rule.
- **Effort:** S.
- **Affects:** install/transfer-eligible, install/transfer-retryable.

## Screens

### settings/main
- light: docs/ui-screens/screens/settings/main__phone-390-light-en.png · dark: main__phone-390-dark-en.png
- severity: low
- deviations:
  - `open`: Settings rows are 56px/medium-weight labels vs kit's 52px/regular
    (styles.css:949 min-height, styles.css:967 weight) — kit itself calls this low priority.
  - `open`: `.settings-group{margin-bottom:34px}` (styles.css:935) vs kit's 26px for a
    hairline-bounded list — kit text flags this tradeoff as open, not a hard rule (low priority).
  - `open` (no fix needed): Units segmented control (`.native-segments`, styles.css:8309) is
    borderless track + shadow-only thumb + semibold selected label — already matches the #485
    fidelity-pass spec. Switch meets kit (1.5px inset ring). No fix needed for either.

### settings/appearance
- light: docs/ui-screens/screens/settings/appearance__phone-390-light-en.png · dark: appearance__phone-390-dark-en.png
- severity: low
- deviations: same as settings/main (row height/weight, group spacing), `open`. Appearance
  segmented control meets kit (same `.native-segments` component).

### settings/guides
- light: docs/ui-screens/screens/settings/guides__phone-390-light-en.png · dark: guides__phone-390-dark-en.png
- severity: high
- deviations:
  - `open`: "Delete workout history" boxed danger row → shared component 3 (S).
  - `open`: "Contextual guides" list rendered as bordered button-cards → shared component 4 (M).

### settings/guides-replay
- light: docs/ui-screens/screens/settings/guides-replay__phone-390-light-en.png · dark: guides-replay__phone-390-dark-en.png
- severity: high
- deviations:
  - `open`: the replayed guide dialog ("Know what stays private") is `.entry-dialog.guide-dialog` →
    border+shadow combo, shared component 2 (S); its "Got it" button is `.btn.btn--cta` → shared
    component 1 (M). Confirmed in the recaptured dark PNG — dialog still carries a visible
    `--rule-strong` edge plus shadow, "Got it" is still an 8px-radius rectangle.
  - `open`: dimmed background still shows the boxed guide-replay list and danger row → shared
    components 3 and 4.

### settings/backup-guide
- light: docs/ui-screens/screens/settings/backup-guide__phone-390-light-en.png · dark: backup-guide__phone-390-dark-en.png
- severity: high
- deviations: identical pattern to guides-replay ("Keep a backup" guide dialog) → shared
  components 1, 2, 3, 4, all `open`.

### settings/install-guide
- light: docs/ui-screens/screens/settings/install-guide__phone-390-light-en.png · dark: install-guide__phone-390-dark-en.png
- severity: high
- deviations: identical pattern ("Install when it helps" guide dialog) → shared components 1, 2,
  3, 4, all `open`.

### settings/privacy
- light: docs/ui-screens/screens/settings/privacy__phone-390-light-en.png · dark: privacy__phone-390-dark-en.png
- severity: low
- deviations: `open`: same scroll region as settings/main, danger row visible at the bottom →
  shared component 3 (S). Everything else (switch, rows, hairlines) meets kit.

### settings/privacy-disclosure
- light: docs/ui-screens/screens/settings/privacy-disclosure__phone-390-light-en.png · dark: privacy-disclosure__phone-390-dark-en.png
- severity: meets kit (was medium)
- deviations:
  - `fixed by #485`: close button was a bordered 44px disc → shared component 5. Confirmed fixed
    in both themes.
  - meets kit: the sheet's left-aligned title + grabber + close-disc anatomy, and the header's lack
    of a border, already matched kit §6. With the close button fixed, this screen now has no
    outstanding deviation in this set.

### install/banner
- light: docs/ui-screens/screens/install/banner__phone-390-light-en.png · dark: banner__phone-390-dark-en.png
- severity: medium
- deviations:
  - `open`: `.installbanner` (styles.css:3698) still draws `border:1px solid var(--boundary-floating)`
    (resolves to `--rule-strong`, a visible line) plus `box-shadow:var(--elevation-floating-shadow)` —
    still the case the kit's floating-boundary amendment (§2) targets: a 0.5px `--bar-edge` hairline
    plus shadow, not a 1px ring. (S)
  - `open`: "Install" CTA is `.btn.btn--cta` → shared component 1 (M).
  - `open`, low priority, not separately tracked: `.installbanner__close` (styles.css:3709) has no
    visible disc fill at rest (`--control-quiet-bg`/`--control-quiet-boundary` transparent), matching
    the pattern that fixed `.sheetband__close`, but unlike that selector it never got the kit's 30px
    `rgba(ink,.07)` `::before` fill — it stays a bare icon until hover/press. Same low-priority gap as
    before, now slightly more visible by contrast with the fixed sheet-close pattern next to it in the
    codebase.

### install/ios-sheet
- light: docs/ui-screens/screens/install/ios-sheet__phone-390-light-en.png · dark: ios-sheet__phone-390-dark-en.png
- severity: meets kit (was medium)
- deviations:
  - `fixed by #485`: close button was a bordered 44px disc, "glaring in dark" → shared component 5.
    The dark PNG's bright ring around the close button is now the `:focus-visible` outline (kit §10,
    required state), confirmed by the capture landing with keyboard focus on that control, not a
    decorative border.
  - meets kit: numbered steps (01–04) use a Mono leading-index column and hairline separators,
    matching kit §5 "Leading index."

### install/transfer-eligible
- light: docs/ui-screens/screens/install/transfer-eligible__phone-390-light-en.png · dark: transfer-eligible__phone-390-dark-en.png
- severity: high
- deviations:
  - `open`: "Read full privacy details" renders as an unstyled native button → shared component 8
    (S), still the most visibly broken single control in this set, still worse in dark.
  - `open`: Cloudflare disclosure block is a bordered card → shared component 6 (S).
  - `open`: "Install and transfer my data" / "Install without transferring" → shared component 1 (M).
  - `fixed by #485`: close button → shared component 5.

### install/transfer-creating
- light: docs/ui-screens/screens/install/transfer-creating__phone-390-light-en.png · dark: transfer-creating__phone-390-dark-en.png
- severity: low
- deviations: unchanged — no buttons or close control in this uninterruptible in-progress state; the
  `.install-transfer__status` left-rule accent is decorative, not boxed — meets kit.

### install/transfer-ready
- light: docs/ui-screens/screens/install/transfer-ready__phone-390-light-en.png · dark: transfer-ready__phone-390-dark-en.png
- severity: meets kit (was medium)
- deviations: `fixed by #485`: close button was shared component 5; no action buttons on this
  screen (instruction list only). With the close button fixed, this screen has no outstanding
  deviation in this set.

### install/transfer-retryable
- light: docs/ui-screens/screens/install/transfer-retryable__phone-390-light-en.png · dark: transfer-retryable__phone-390-dark-en.png
- severity: high
- deviations:
  - `open`: unstyled `.textlink` button → shared component 8 (S).
  - `open`: disclosure card border → shared component 6 (S).
  - `open`: "Retry transfer" / "Install without transferring" → shared component 1 (M).
  - `fixed by #485`: close button → shared component 5.

### install/transfer-claiming
- light: docs/ui-screens/screens/install/transfer-claiming__phone-390-light-en.png · dark: transfer-claiming__phone-390-dark-en.png
- severity: low
- deviations: unchanged — none beyond the status left-rule pattern (meets kit); no buttons/close
  shown.

### install/transfer-importing
- light: docs/ui-screens/screens/install/transfer-importing__phone-390-light-en.png · dark: transfer-importing__phone-390-dark-en.png
- severity: low
- deviations: unchanged — same as transfer-claiming, meets kit.

### install/transfer-success
- light: docs/ui-screens/screens/install/transfer-success__phone-390-light-en.png · dark: transfer-success__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Continue" → shared component 1 (M). `fixed by #485`: close button, was
  shared component 5.

### install/transfer-cleanup
- light: docs/ui-screens/screens/install/transfer-cleanup__phone-390-light-en.png · dark: transfer-cleanup__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Retry transfer" and "Continue" → shared component 1 (M). `fixed by #485`:
  close button, was shared component 5.

### install/transfer-terminal
- light: docs/ui-screens/screens/install/transfer-terminal__phone-390-light-en.png · dark: transfer-terminal__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Continue" → shared component 1 (M). `fixed by #485`: close button, was
  shared component 5.

### install/transfer-destination
- light: docs/ui-screens/screens/install/transfer-destination__phone-390-light-en.png · dark: transfer-destination__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Continue" → shared component 1 (M). `fixed by #485`: close button, was
  shared component 5.

### install/transfer-interrupted
- light: docs/ui-screens/screens/install/transfer-interrupted__phone-390-light-en.png · dark: transfer-interrupted__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Retry transfer" → shared component 1 (M). `fixed by #485`: close button,
  was shared component 5.

### install/transfer-unknown
- light: docs/ui-screens/screens/install/transfer-unknown__phone-390-light-en.png · dark: transfer-unknown__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Resume in browser" → shared component 1 (M). `fixed by #485`: close
  button, was shared component 5.

### install/transfer-claimed-expired
- light: docs/ui-screens/screens/install/transfer-claimed-expired__phone-390-light-en.png · dark: transfer-claimed-expired__phone-390-dark-en.png
- severity: medium
- deviations: `open`: "Resume in browser" → shared component 1 (M). No close button in this frozen
  state (intentional, unchanged), so shared component 5 never applied here.

### catalog-recovery/unavailable
- light: docs/ui-screens/screens/catalog-recovery/unavailable__phone-390-light-en.png · dark: unavailable__phone-390-dark-en.png
- severity: high
- deviations:
  - `open`: `.exercise-catalog-recovery` border+shadow combo → shared component 2 (S).
  - `open`: "Retry" button → shared component 1 (M).
  - unchanged, no issue: underlying "Start workout" CTA is correctly disabled/dimmed behind the
    modal.

### catalog-recovery/retry-failed
- light: docs/ui-screens/screens/catalog-recovery/retry-failed__phone-390-light-en.png · dark: retry-failed__phone-390-dark-en.png
- severity: high
- deviations: `open`: same as catalog-recovery/unavailable → shared components 1, 2.

### settings/rest-controls
- light: docs/ui-screens/screens/settings/rest-controls__phone-390-light-en.png · dark: rest-controls__phone-390-dark-en.png
- severity: medium
- deviations:
  - `open`: rest-timer numeric field renders in Plex Sans, not Mono → shared component 7 (S).
    Confirmed in the recaptured PNG: the typed "120" value still uses the body sans weight.
  - unchanged, no issue: stepper field + `-`/`+` buttons use `--radius-control` (8px) with
    `--boundary-required` 1px inset ring — matches kit §3/§4 (control extent), not a deviation.

### settings/load-controls
- light: docs/ui-screens/screens/settings/load-controls__phone-390-light-en.png · dark: load-controls__phone-390-dark-en.png
- severity: medium
- deviations: `open`: load jump %, minimum jump, RIR ceiling fields all render in Plex Sans →
  shared component 7 (S). Field/stepper extent borders meet kit as above.

## Worst 3

1. **install/transfer-eligible** — the "Read full privacy details" control is still a completely
   unstyled native `<button>` (no `.textlink` base rule exists), rendering as the browser's default
   grey button chrome inside an otherwise polished sheet; combined with the bordered disclosure card
   and non-pill CTAs, this remains the single most visibly broken screen in the set. #485 fixed this
   screen's close button, but did not touch any of these three.
2. **catalog-recovery/unavailable** — a full-screen blocking dialog (the lifter cannot dismiss it
   without retrying) still draws both a border and a shadow around itself and ships a rectangular
   "Retry" button, so the one moment Taurifer forces on every user when the catalog fails still looks
   the least native of any screen reviewed. Not touched by any of the merged PRs since the last pass.
3. **settings/guides-replay** — still stacks three separate off-kit components at once (bordered
   guide dialog, bordered guide-replay list used as the backdrop, boxed danger row), making it the
   clearest single place to see the "box around everything" pattern the kit exists to remove.

Summary for the caller: open 21, fixed 1 (shared component 5, sheet close — by #485, cascading to
11 screen-level mentions), new 0. Worst 3 unchanged in substance from the previous pass (none of
their deviations involved the sheet-close component that #485 fixed).

Output written to /tmp/taurifer-ui-kit/docs/design/native-fidelity-audit-2026-10/area-F.md.
