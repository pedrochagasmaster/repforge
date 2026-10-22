# Plan 075: An iOS-native feel, in Taurifer's look

- **Status:** APPROVED — IMPLEMENTATION IN PROGRESS (phase 1).
- **Decision:** [ADR 0023](../docs/adr/0023-ios-native-feel.md), with the 12 resolutions and the
  owner's amendment to choice 8.
- **Spec:** PR #477, `docs/design/native-feel/` (README, `app.html`, `lab.html`, `native.js`,
  `native.css`). The prototype is the behavioural reference. Its code is a prototype: map it
  onto the production owners and tokens, don't copy it.
- **Audit:** PR #476, `docs/design/apple-design-audit-2026-10.md`.
- **Base:** `7a6bede3` (main on 22 October 2026).
- **Out of scope:** the anchored and inline tips (choice 9), haptics and anything else the
  README lists under "What a web app can't close", the copy and semantics findings (F-4, F-6,
  F-17, F-21, F-22), and any change to stored-data shape or its validators.

## 1. Sequence

One PR per phase, each from current `origin/main`, in this order. Each starts with a proof
that fails for the stated reason, at the highest realistic boundary.

| # | PR | Findings |
| --- | --- | --- |
| 1 | Touch physics, with this plan and ADR 0023 | F-3 |
| 2 | Sheets | F-8, F-18, F-19 |
| 2W | Wheel picker for load and reps (owner amendment to choice 8) | — |
| 3 | Navigation | F-9, F-11 |
| 4 | Controls | F-10, F-14 |
| 5 | Large text | F-1, F-5 |

## 2. Owners, proofs and amendments per phase

### Phase 1: touch physics

- **Owners:** `motion-layer.js` gets one delegated press module, installed when the layer
  loads (it does not need the Motion runtime). It sets `.is-pressed` on touch-down, mouse-down
  and Space/Enter; holds 60 ms first for a touch in a scroller; removes it when the pointer
  slides more than 10 px outside the control and restores it on sliding back; clears it on
  release, cancel and scroll. It writes `--ease-press-release` and `--press-release-duration`,
  sampled from `VOCABULARY.pressRelease`. `styles.css` and `motion-polish.css` style
  `.is-pressed` in place of `:active` for buttons, links, summaries, labels and button roles.
  Form fields keep `:active`.
- **Tokens:** `--control-primary-pressed-bg` (light `#3A3833`, dark `#C9C1B4`),
  `--control-pressed-scale` (`.97`) and `--control-primary-pressed-transform`. Primary fills
  take the tone and the scale. Every other control keeps its current wash and
  `--control-pressed-transform`. The toggle's knob stretch moves to `.is-pressed`.
- **Release:** `.btn`, the dock's buttons and the toggle's knob return on the `pressRelease`
  curve. Touch-down has no transition. Under reduced motion the tone stays and the scale goes.
- **Proofs** (`test/native-feel.mjs`, real touch through CDP at 390×844):
  pressed on touch-down with the primary tone and 0.97 scale and no transition; cleared by a
  slide off the control and restored by a slide back; a release off the control doesn't
  activate it; the scroller delay; Space shows the pressed state; reduced motion drops the
  scale and keeps the tone; no `:active` press rule is left outside form fields.
  `test/motion-vocabulary.mjs` and `test/vendor-runtimes.mjs` hold the vocabulary amendment.
- **Amendments:** the interaction audit's vocabulary table (`pressRelease`) and its press row;
  the semantic contract's pressed rows for primary actions.
- **Catalog:** no new state. A pressed control is transient and is proved by the suite.

### Phase 2: sheets

- **Owners:** the sheet controller in `motion-layer.js` (detents `fit`, `medium`, `large`,
  rubber-banding, the scroll hand-off at `large`); `app.js` for each sheet's exit, the day
  picker's commit on tap and its Undo toast, and the Program editor as a page sheet with
  Cancel and Done in its bar and a guarded dismiss; `styles.css` for the bar and the
  pushed-back app.
- **Proofs:** one exit per sheet across the nine sheets; the day picker commits on tap and
  Undo restores the previous day; a drag snaps to the nearest detent and a fast flick
  dismisses; a guarded dismiss asks Discard changes / Keep editing; reduced motion
  cross-fades.
- **Amendments:** the interaction audit's reduced-motion rule (F-18, 160–180 ms cross-fade
  for sheets) and its sheet rows. `today.choose_day_confirm` and the read-only sheets'
  "Got it" are retired.
- **Catalog:** the day-changed toast with Undo; the editor as a page sheet; its discard
  prompt.

### Phase 2W: wheel picker for load and reps

- **Owners:** `app.js` (the Focus shelf: the second tap on Load or Reps opens the wheel in a
  `fit` sheet; typed entry stays reachable from the sheet); `progression-engine.js` and the
  exercise's load step for the values; `styles.css` for the wheel.
- **Values:** load steps follow the exercise's load step or smallest load change, per-side
  included; reps run over a range around the target. If the rules don't define a range, the
  question goes to the owner before building.
- **Proofs:** a wheel selection writes the same draft value as typing, survives a reload and
  logs the same set; `role=spinbutton` with arrow keys; reduced motion; the keyboard band
  (#443) is unaffected.
- **Copy:** `focus.field.picker_hint`.
- **Catalog:** the wheel sheet for load and for reps.

### Phase 3: navigation

- **Owners:** `motion-layer.js` (the full-width swipe in a Safari tab under *Auto*, parallax and
  dim under a pushed page); `app.js` (large-title collapse and the scroll-edge bar material,
  tab re-tap to top and then to root, the history integration that lets Safari's swipe pop
  cleanly).
- **Proofs:** an edge-swipe pop and its cancel; the full-width swipe in a tab and its opt-outs
  for horizontal content; the title collapse; tab re-tap; a `popstate` from Safari's swipe
  pops without a second animation.
- **Amendments:** the interaction audit's page-push section and reduced motion (cross-fade for
  pushes).
- **Catalog:** a root page scrolled with the collapsed title and the bar material.

### Phase 4: controls

- **Owners:** `styles.css` for the switch, segmented controls and steppers; `motion-layer.js`
  for the segmented thumb drag, stepper repeat and long press; `app.js` for the Focus ⋯ action
  sheet and the context menus on Today's rows and the editor's rows (replacing the per-row
  move and remove buttons).
- **Proofs:** the switch's off state and its ring; a segmented control by tap, drag and arrow
  keys; a stepper's hold-to-repeat and its limits; the action sheet's Cancel and its confirmed
  End without saving; a context menu by long press, slide-to-select, right-click and
  Shift+F10.
- **Amendments:** the semantic contract's switch (choice 6).
- **Copy:** `today.row_actions_hint`, `today.skip_today`, `session.sheet.keep_training`,
  `program.editor.remove_alternate`, `program.editor.day`, `settings.rest_shorter`,
  `settings.rest_longer`, `program.editor.step_smaller`, `program.editor.step_larger`.
- **Catalog:** the action sheet, a context menu open on a Today row and on an editor row, the
  new switch, segmented and stepper rows in Settings.

### Phase 5: large text

- **Owners:** `styles.css` for Focus at 200% (stacked rest, capped clock and bar title, sideways
  pads) and the dock's capped labels; `app.js` for keeping the open set in view and for the
  dock's large-content viewer.
- **Proofs:** Focus at 200% in Portuguese keeps the open set above the shelf; the dock keeps one
  row at 200%; touch and hold shows the large-content viewer and a slide-and-lift switches tab.
- **Amendments:** the semantic contract's dock at large text (F-5).
- **Catalog:** 200% frames for Focus (PT) and the dock's viewer.

## 3. Throughout

Reduced motion, safe areas, the keyboard band (#443) and the semantic contract hold in every
phase. Chromium proofs are not device evidence; each PR says so and the owner checks it on an
iPhone. A phase that would touch stored-data shape or its validators stops and asks first,
because that needs the install-transfer Worker redeployed.
