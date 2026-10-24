# App-wide native fidelity audit, 2026-10

**Status:** audit and batch plan for the coordinator and owner, 2026-10-24. No production change.
**Yardstick:** [`native-ui-kit.md`](native-ui-kit.md), extracted from the native-feel prototype
(`origin/design/native-feel:docs/design/native-feel/`).
**Base:** main at 5d2ca411 (after #483, #484, #485, #486, #488, #489, #498, #500, #501, #499, #503).
**Coverage:** all 220 catalog screens in `docs/ui-screens/manifest.json`, light and dark at 390×844
(English), with 200% text spot checks where a frame looked broken. Portuguese and the 320/430 widths
were not judged screen by screen.
**Per-screen detail:** six area files under [`native-fidelity-audit-2026-10/`](native-fidelity-audit-2026-10/)
(A onboarding start, build, import, shared and recovery; B onboarding Recommend; C Today, Focus and
the summary; D Progress and History; E Program, the editor, Program Lab and Library; F Settings,
install and catalog recovery). Each entry names the catalog PNGs, the deviation, the kit fix, the
effort and its status on current main.
**Mocks:** ten before/after pairs in [`native-fidelity-mocks/`](native-fidelity-mocks/) (see the last section).

## Summary

The prototype and production share one palette, one type family and one icon set. They differ in how
those pieces are combined, and the difference is concentrated in a small number of shared components.
The fidelity pass (#485) fixed the ones the prototype showed: the context menu, the dock lens,
segmented controls, steppers, the day picker, sheet close buttons and pressed washes. The same
mistakes remain everywhere the prototype didn't go:

1. **Buttons are 8px rectangles, not pills.** `.btn` and `.btn--cta` (styles.css:649, :671) are on
   nearly every screen (about 180 of 220). This is the most visible single gap.
2. **Choice lists are boxed cards.** `.entry-card`, `.radio-card` and the numeric variant draw a 1px
   box with a 12px radius around every option in onboarding, the editor and Progress review.
3. **Floating and modal surfaces draw a border with their shadow.** `.entry-dialog`, `#glossary`,
   `.glossary` and `.exercise-catalog-recovery` repeat the exact context-menu mistake #485 fixed.
4. **Older controls never got the #485 primitives.** `.segpill` (Strength scope), `.entry-seg`
   (height and weight units), `.review-step` (RIR stepper), the editor menu's missing icons, the
   editor's "Suggest loads" switch, and leading icons in the exercise-actions sheet.
5. **Small boxes everywhere.** `.review__rir` badges, `.exthumb` borders and empty art tiles,
   `.entry__notice`, `.install-transfer__disclosure`, the Settings danger row and the guide replay
   list.

Plus five bugs found on the way: "RIR 1–1" in the Focus meta line, an unstyled `.textlink` button, a
CTA arrow overlapping its label, Program Lab without a dark theme, and 11 dark catalog frames that are
byte-identical to light.

A pill radius on two classes, a border removed from four selectors, and reuse of the
`.native-segments`/`.native-stepper` primitives already in main would close most of what the owner
would see first. Batches 1–3 below are about three days of work.

## Verdicts by severity

| Severity | Screens |
| --- | --- |
| High (several kit rules broken, or a bug) | 45 |
| Medium (one or two shared-component gaps) | 104 |
| Low (minor tracking, weight or spacing) | 50 |
| Meets the kit | 21 |

Meets the kit now: Today ready and ready-scrolled, the dock viewer, the wheel sheets, the Focus
action sheet, the day picker, the install iOS and transfer-ready sheets, the privacy disclosure, most
of Progress Overview and Volume, History list and its scrolled state.

## Systemic findings

Ordered by reach × visibility. "Screens" counts catalog states in light and dark.

| # | Component | Deviation on main | Kit fix | Effort | Screens | Status |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | `.btn`, `.btn--cta`, `.btn--steel`, `.firstrun__cta` (styles.css:649, :671, :670; `.firstrun__cta` 12px) | 8px (or 12px) rectangle; base `.btn` adds a 1px `--rule` border | `--radius-pill` on every button class; no border on filled variants; secondary keeps the 1px inset `--boundary-required` ring (contract) | M (one rule; then a wrap check on long labels) | ~180 | open. Today's Start is #485 kept deviation 1 (Direction D), so it is in the owner's decision too |
| S2 | `.entry-card` (styles.css:4120), `.radio-card`, `.entry-body .radio-card`, `.onb__opts.onb__num .radio-card` | 1px box and 12px radius per option; three different selected treatments | Grouped list rows (§5): hairline between rows, trailing radio (single choice) or check circle (multi), selected mark in `--accent-deep`; the 2px selected ring goes away | M | ~25 | open |
| S3 | `.entry-dialog` (styles.css:7725), `.exercise-catalog-recovery` | `border:1px` plus `--elevation-dialog-shadow` | Drop the border (§2 Dialog) | S | 12 | open |
| S4 | `#glossary` (Focus), `.glossary` (styles.css:3444, Library detail) | Border and floating shadow | `--elevation-menu-shadow` (the #485 menu recipe: shadow plus 0.5px `--bar-edge`), no border; close disc | S | 2 | open; the last floating layer with the rejected look |
| S5 | `.segpill` / `#strengthScopeSeg`, `.entry-seg`, `.seg:not(.seg--window)` | Bordered group and a 2px ringed active option | Reuse `.native-segments` (#485); propose `--seg-thumb-bg` | M | ~12 | open |
| S6 | `.review-step` (RIR on every set), `.program-editor__stepper` | Bordered capsule with text − + and inner rules, beside the fixed stepper in the same sheet | Reuse `.native-stepper` (#485) | S | ~6 | open |
| S7 | Editor row and alternate context menu (`program-editor.js:2970-2976`) | Items carry no `icon`, so the menu shows no trailing glyphs; Today's menu has them since #485 | Pass `icon` for Move up (`chev-up`), Move down (`chev-down`), Move to another day (`cal`), Remove (`close`) | S | 2 | open |
| S8 | `.exactions__act` (exercise actions, warm-up, skipped, substituted sheets), `review-day-menu` rows | Leading action icons; per-set "Make warm-up" rectangles; copy "Substitute exercise" (`ex.actions.substitute`) | Trailing 20px icons (§7); warm-up as a row with a switch captioned "Warm-up" (accessible name "Set n warm-up"); copy "Swap exercise" (approved wording, EN and PT) | S–M | 6 | open |
| S9 | `.rxrow__load`, `.rxrow__target` (styles.css:7887) | Load in Mono 500, target in full ink | Load Mono 400, target `--ink-soft` in its own column | S | ~12 | open; same decision as #485 kept deviation 1 |
| S10 | `.review__rir`, `.exthumb` border, `.exthumb--empty`, `.entry__notice`, `.entry__active`, `.install-transfer__disclosure`, `.statrow` | 1px boxes around values, tiles, notices and previews; empty art tiles are blank bordered squares | Drop the borders; tiles on `--well` with no stroke; an empty tile shows the G `dumbbell` glyph at 40% `--ink-faint` (or the shelf caption's G dumbbell, as #499 approved); notices as an icon and text run | S each | ~30 | open |
| S11 | Settings danger row (`.settings-row.is-danger`, `#reset`), `.guide-replay .btn` | Boxed destructive row; guide list as bordered buttons | Destructive row in red, no box; guide list as §5 rows with title and subtitle | S + M | 6 | open |
| S12 | Icon-only reorder and alternate buttons in Recommend review (`.session-map__reorder-btn` variants in `review-reorder`, `review-sheet-swap`) | Bordered square buttons | No box, 44px target, dim on press (§7) | S | 2 | open; Focus header and session-map buttons fixed on main |
| S13 | Numeric inputs (`#jumpPct`, `#minJump`, `#rirHigh`, `#hardRir`, `#restSec`, Settings) | Plex Sans | `--font-training-data` with tabular figures, as `.program-editor__metric-field input` already does | S | 2 | open |
| S14 | `.toast` (styles.css:3381) | `--cta` ground, 12px radius | Pill on `--ink` with `--bg` text (§6) | S | 3 | open |
| S15 | `.libbar`, `.sheet__foot--actions`, the Recommend footer | Solid panel with a 1px top rule | Bar glass with the 0.5px `--bar-edge` (§1) | S | ~10 | open |
| S16 | Editor "Suggest loads" switch (program/editor-suggest-loads) | On state draws a parchment track with a dark knob | The shared `nf-switch` on state: `--accent-deep` track | S | 1 | open |
| S17 | Group-label tracking `.section-label`, `.settings-group__label` | 0.08em | One value; the kit says 0.06em. Low priority | S | many | open |

### Bugs

| Bug | Where | Fix | Effort |
| --- | --- | --- | --- |
| "RIR 1–1" for a single RIR value | `focus.exmeta.effort/.goal/.range` (i18n-en.json:57-60) rendered by app.js ~8382-8397; ~15 Focus frames and `onboarding-start/first-run-proof` | When `rmin === rmax`, use a single-value key ("RIR {rir}"), as `program-editor.js:1046` already does for rep ranges; new keys need EN and PT | S |
| Unstyled "Read full privacy details" | `.textlink` has no base rule (styles.css: only `.install-transfer__disclosure .textlink`); install/transfer-eligible, transfer-retryable | A base text-action rule: transparent, no border, `--accent-deep`, semibold, 44px target, trailing chevron | S |
| CTA arrow overlaps its label | `.btn--cta::after` is absolutely placed; "Retry preserved edit" on history/conflict wraps under it | Make the arrow an inline flex child (as the kit's `.btn .arrow`) | S |
| Program Lab has no dark theme | `programlab/` (its own `styles.css`); programlab/comparison and editor dark frames equal light | Owner question: Program Lab is a separate tool. Either adopt the palette tokens or mark it light-only in the manifest | M or none |
| Dark never captured | 11 frames byte-identical to light: history/per-side-session, progress/exercise-chart, progress/strength-comparison, workout/focus-per-side, why-in-session, why-per-side, why-this-weight, programlab/comparison, programlab/editor; onboarding-start/first-run and onboarding-shared/invalid are the always-dark band, so equal by design | Fix the catalog fixtures so these states set the theme; then re-audit them in dark | S (catalog) |

### Covered elsewhere (not batched here)

- **#485 fixed:** context menu material, icons, copy and lifted row; the dock's selected ring; segmented
  controls (`.native-segments`); steppers (`.native-stepper`); day picker check; sheet close disc and
  grabber; `--row-pressed-bg`; Focus header icon buttons; the Focus action sheet.
- **#485 kept deviations for the owner:** 1 Today ledger typography and the 12px Start button; 2 editor
  row content; 3 the editor exercise page as a stacked sheet; 4 End without saving prompt; 5 Exercise
  actions in the action sheet; 6 Settings label weight and bold Language value; 7 the first menu item's
  focus mark; 8 out of scope then; 9 menu opacity curve; 10 menu entry scale from .9. S1 and S9
  overlap 1 and are best decided together.
- **#499 kept deviations:** the SET column head only; the exercise title on its own row; spread ledger
  columns; dock labels at weight 500; the shelf caption's G dumbbell.
- **#503:** the wheel's feel (notch depth, free spin, coast) needs the owner's device; the catalog frames
  meet the kit.
- **#502 (in progress):** the Today screen while a session is in progress and its mini bar
  (today/draft-resume and related states).
- **Rest-timer packet (queued):** the rest timer page and its floating element (today/rest-bar,
  workout/rest-running, workout/rest-done).

## Contract notes

- **Floating boundary.** The layer table's "boundary" for `floating` should read as the 0.5px
  decorative hairline plus the shadow (kit §2). #485 already did this for the menu; S4 extends it to the
  glossary.
- **Choice rows (S2).** The contract marks choice outlines as `required` at 3:1. In the row version, the
  affordance moves to the trailing radio or check circle, a 1.5px `--boundary-required` ring (5.11:1 on
  `--bg` light, 7.78:1 dark), and the row is the target. The amendment: a choice row's required boundary
  is its mark, not its box.
- **Buttons (S1).** The radius is not a contract role; the secondary ring and primary fills keep their
  measured contrast. No amendment needed.

## Batches, in priority order

Each batch is one PR in the existing owners (`styles.css`, plus `app.js`, `program-editor.js` or the
i18n sources where named), with catalog recapture and prototype-vs-production side-by-sides as the
fidelity gate requires. The order is most visible and most used first.

| Batch | Scope | Findings | Effort | Why this position |
| --- | --- | --- | --- | --- |
| **1. Buttons and dialogs** | Pill radius on every button class, the CTA arrow as an inline child, `.textlink` base style, dialog borders off, toast as a pill | S1, S3, S14, bugs 2–3 | 1–1.5 days | Touches almost every screen at once; low risk; needs an owner call on Today's Start (#485 deviation 1) |
| **2. Choice rows** | `.entry-card`, `.radio-card` and its numeric variant as grouped rows with trailing marks; contract amendment for choice marks | S2 | 1.5–2 days | Onboarding is the first thing every new user sees, and Progress review and the editor reuse it |
| **3. Focus and workout sheets** | "RIR 1–1"; exercise-actions trailing icons, warm-up rows and "Swap exercise"; `#glossary` material; session map rows | S8, S4 (Focus), bug 1 | 1 day | The training loop; daily use |
| **4. Control primitives everywhere** | `.segpill`, `.entry-seg`, `.review-step`, `.program-editor__stepper` onto the #485 primitives; editor menu icons; the editor switch; review reorder buttons | S5, S6, S7, S12, S16 | 1.5 days | Removes the "two styles in one sheet" look |
| **5. Small boxes and tiles** | RIR badges, art tile borders and the empty-tile glyph, notices, disclosure, stat band, Library glossary | S10, S4 (Library) | 1 day | Many screens, each a small change |
| **6. Lists and bars** | Settings danger row and guide replay rows, PR timeline row anatomy, bottom action bars on glass, numeric inputs in Mono | S11, S13, S15, Progress PR rows (area D §4) | 1.5 days | Lower traffic |
| **7. Typography polish** | Ledger number weights (with the owner's #485 deviation 1 decision), tracking tokens | S9, S17 | 0.5 day | Waits on the owner |
| **Catalog fix** | Dark capture for the 11 frames; Program Lab decision | bugs 4–5 | 0.5 day | Can run in parallel with any batch |

Total: about 8–9 working days for batches 1–7.

## Mocks

Static HTML on the prototype's own stylesheet (`kit.css` = the prototype's `tokens.css`, `icons.css`,
`native.css` and `app.css`) plus the kit's proposed tokens (`mock.css`). Each one is built from the
copy on its before screen; nothing is invented, except "RIR 1" in the Focus meta, which is the fix.
`capture.mjs` renders them at 390×844 (2×) in light and dark and lays the current catalog frame
beside each one.

| Mock | Before (catalog) | Shows | Compare (light / dark) |
| --- | --- | --- | --- |
| `hub.html` | onboarding-start/hub | S1, S2: choice rows with identity icons, pill Continue on bar glass | `compare/hub-light.png`, `compare/hub-dark.png` |
| `equipment.html` | onboarding-recommend/equipment | S2 multi-select: check circles, hairline rows, pill CTA with the drawn arrow | `compare/equipment-{light,dark}.png` |
| `suggest-loads.html` | program/editor-suggest-loads | S2, S6, S16, one exit: rows, one stepper style, accent switch, no footer Done | `compare/suggest-loads-{light,dark}.png` |
| `library.html` | library/list | S5, S10: segmented Search/Browse/Yours, quiet chips, add circles, and the empty-art tile as an unbordered `--well` tile with the G dumbbell | `compare/library-{light,dark}.png` |
| `history-session.html` | history/session | Mono tables with the unit in the head, verdicts as text, Edit/Delete as rows, bar glass | `compare/history-session-{light,dark}.png` |
| `schedule-diagnosis.html` | progress/schedule-diagnosis | S1, S2: radio rows, a pull-down row for days, pill CTA with a quiet Cancel | `compare/schedule-diagnosis-{light,dark}.png` |
| `strength.html` | progress/strength | S5, S9: segmented scope, two-tone Mono figures with a spaced arrow | `compare/strength-{light,dark}.png` |
| `transfer-eligible.html` | install/transfer-eligible | Bug 2, S10: the text action, an unbordered disclosure, pill buttons | `compare/transfer-eligible-{light,dark}.png` |
| `exercise-actions.html` | workout/exercise-actions | S8, bug 1: trailing icons, "Swap exercise", warm-up switches captioned "Warm-up", "RIR 1" | `compare/exercise-actions-{light,dark}.png` |
| `session-details.html` | workout/session | S12 pattern, S1: grip rows instead of ↑ ↓ boxes, form rows, pill and text exits | `compare/session-details-{light,dark}.png` |

Two mocks propose interaction changes the owner should confirm before a batch builds them: warm-up
sets as switches (exercise actions), and reorder by drag or context menu instead of ↑ ↓ buttons
(session details), which is what the editor already does.
