# Native-fidelity audit — set A (onboarding: start / build / import / shared / recovery)

Re-check against current main (5d2ca411, worktree rebased per RECHECK.md), 2026-10-24. Kit:
`/tmp/taurifer-ui-kit/docs/design/native-ui-kit.md`. Screens: `/tmp/uikit-audit/screens-A.md` (35
states). CSS checked against `/tmp/taurifer-ui-kit/styles.css` (production, same tree as the
catalog). All 35 states re-read in both light and dark; text200 re-checked where it mattered
before.

**Result of the re-check: nothing in area A was fixed by #483/#484/#485/#486/#488/#489/#498/#500/
#501/#503.** Those PRs touched the wheel picker, phase-3 navigation chrome, the context menu/
sheet-close/segmented-control/stepper/day-picker fidelity pass, wheel-axis bugs, the editor sheet's
page gutters and bar buttons, per-side overflow in Progress, and three *other* onboarding screens
(days-per-week, exercise-preferences, birth-date) that are not in set A's screen list. None of them
touch `.entry-card`, `.entry-dialog`, `.btn`/`.btn--cta`/`.firstrun__cta`, `.program-editor__day`,
`.program-editor__stepper`, `.program-editor__alternate-move/-remove`, `.toast`, or `.review__rir`.
Every selector below was re-grepped at its current line and the rule text is byte-for-byte what it
was when the original audit ran; only the line numbers moved. Every shared finding and every
screen finding keeps its original severity, `open`, with the current line cited.

Three new things found on this pass: empty exercise-art tiles, a partial fix to the
`editor-partial` text200 bug, and one confirmed degenerate range (`RIR 1–1`) on
`onboarding-start/first-run-proof`. All three are called out in their own entries below, as
instructed, with a roundup at the end of Screens.

## Shared components

### 1. Choice cards (`.entry-card`) — boxed list, off-kit — `open`
- Selector: `styles.css:4120` `.entry-card{border:1px solid var(--rule);border-radius:var(--radius-surface);background:var(--surface)}`; selected state `.entry-card--primary` adds a 2px accent border + keyline shadow (`:4128`). Unchanged text, moved from `:3836`/`:3844`.
- Deviation: every "pick one of N" choice list (Recommend/Build/Import, file/paste) still draws a full 1px-rule box with 12px radius around each option. Kit rule 1: "no 1px outline around a surface… lists are rows with hairlines between them."
- Fix: convert to a hairline-separated row group (kit §5/§9), drop the resting 1px border, keep the 2px selected ring as the selected state.
- Effort: M.
- Affects: `onboarding-start/hub`, `hub-chosen`, `hub-existing`, `onboarding-import/source`, `onboarding-recovery/resume` — plus the `.entry__active`/`.entry__notice` boxed callouts that sit above the list on `hub-existing`, `resume`, `rules-drift`, `freeform-unreadable` and `freeform-gaps-invalid` (`styles.css:4133` `.entry__active,.entry__legacy,.entry__explain` and `:4138` `.entry__notice`, both still `border:1px solid var(--rule)` plus a 3px left accent; moved from `:3849`). The sibling `.entry__notice--info` (`:7048`) correctly drops to top/bottom hairlines only — that one meets kit and is used for `freeform-gaps`'s "Not imported: …" callout and the gate's disclosure; it is not part of this finding.

### 2. `.entry-dialog` — border + shadow on the same modal surface — `open`
- Selector: `styles.css:7725` `.entry-dialog{border:1px solid var(--boundary-modal);border-radius:var(--radius-prominent);background:var(--surface);box-shadow:var(--elevation-dialog-shadow)}`. Moved from `:7425`, text unchanged.
- Deviation: kit §2/§4: dialogs are surface + radius + shadow, never a border and a shadow together. Still visible as a hairline ring around the panel in dark theme on all three screens below.
- Fix: drop `border`, keep radius and shadow.
- Effort: S.
- Affects: `onboarding-start/hub-guide`, `onboarding-recovery/cancel-confirm`, `onboarding-recovery/restart-confirm`.

### 3. Buttons are rectangles, not pills — `open`
- Selector: `styles.css:649` `.btn{border:1px solid var(--rule);border-radius:var(--radius-control)}` (moved from `:516`); `.btn--cta` at `:671` (was `:538`) still `border-radius:var(--radius-control)`; `.firstrun__cta` at `:5388` (was `:5094`) still `border-radius:var(--radius-surface)` (12px).
- Deviation: kit §3 "buttons are pills" (`--radius-pill` 999px). Every primary/secondary CTA across the set still renders as a lightly-rounded rectangle.
- Fix: route onboarding CTAs through a pill button token.
- Effort: M.
- Affects: essentially every screen in this set.

### 4. Boxed form "pads": stepper and day-count grid — `open`
- Selector: `styles.css:2903` `.program-editor__stepper{border:1px solid var(--rule-strong);border-radius:var(--radius-control)}` with `border-left:1px solid var(--rule)` internal dividers (`:2906`). Moved from `:2632`/`:2635`, text unchanged.
- Deviation: kit §3 wants a dedicated segment/thumb radius pair, a pill track with a raised value thumb, not three cells divided by hard vertical rules.
- Fix: adopt the proposed `--radius-segment`/`--radius-segment-thumb` tokens; pill track + raised thumb.
- Effort: S/M.
- Affects: `onboarding-build/editor-partial`, `editor-ready`, `editor-alternates` (Smallest-load-change stepper, sets stepper).

### 5. Day container box — `open`
- Selector: `styles.css:2862` `.program-editor__day{border:1px solid var(--rule-strong);border-radius:var(--radius-surface)}`. Moved from `:2591`, text unchanged. `.program-editor__add-day` at `:2981` (was `:2710`) is the same boxed-rectangle pattern for "Add exercise."
- Deviation: a fully boxed card per training day — the screen's own description calls it out ("Real empty day containers"). In the light-theme PNGs the border is close to invisible because `--rule-strong` (`#D9D5CD`) sits on `--surface`/`--well` (`#FFFFFF`/`#FAF8F5`), a low-contrast pairing; it reads clearly once you know the token, and shows up more in dark theme.
- Fix: hairline-separated day groups per kit §6, no box.
- Effort: M.
- Affects: `onboarding-build/editor-empty`, `editor-partial`, `editor-ready`, `editor-alternates`.

### 6. Icon-only buttons boxed — `open`
- Selector: `styles.css:2954` `.program-editor__alternate-move,.program-editor__alternate-remove{border:1px solid var(--control-secondary-boundary);border-radius:var(--radius-control);background:var(--control-secondary-bg)}`. Moved from `:2683`, text unchanged.
- Deviation: kit §7 "icon-only buttons are 44px targets with no visible box." These are three individually-boxed squares per alternates row (up/down/remove).
- Fix: strip border/background, keep the 44px hit target, dim on press.
- Effort: S.
- Affects: `onboarding-build/editor-alternates` (2 rows shown; this plus the day-container box make it the worst screen in the set).

### 7. Toast uses `--cta` ground, 12px radius, not a pill — `open`
- Selector: `styles.css:3381` `.toast{width:min(92%,420px);background:var(--cta);border-radius:var(--radius-surface)}`. Moved from `:3098`, text unchanged.
- Deviation: kit §1/§2/§6 Toast row: `--ink` ground, `--bg` text, pill shape, `10px/18px` padding, floating `nav + 76px` above the bottom. Production still renders a near-full-width rounded rectangle in the CTA color, pinned to the textarea's bottom edge.
- Fix: swap to `--toast-bg`/`--toast-ink`, pill radius, float it rather than pin it to the field.
- Effort: M.
- Affects: `onboarding-import/freeform-stage3` (only screen in this set where it fires, still the most visible instance because it visually collides with the textarea it sits on).

### 8. Per-set RIR badge boxed — `open`
- Selector: `styles.css:7671` `.review__rir{border:1px solid var(--boundary-decorative);border-radius:var(--radius-control)}`. Moved from `:7371`, text unchanged.
- Deviation: kit rule 1 — decorative separation should be tone/hairline, not a box, around plain text in a row that otherwise follows kit anatomy well.
- Fix: drop the border, keep the value right-aligned in Mono.
- Effort: S.
- Affects: `onboarding-shared/preview` (visible on every set row, 3+ per exercise) and the backgrounded program review behind `onboarding-recovery/restart-confirm`'s scrim.

### 9. Empty exercise-art tiles — `open`, new to the shared list this pass
- Selector: `styles.css:2147` `.exthumb{border:1px solid var(--boundary-decorative);background:var(--well)}`; the empty variant `.exthumb--empty` (`:2154`) is the identical box with nothing painted inside — by design, per the adjacent comment ("no glyph, no initials, no shimmer... a missing illustration never looks like a failure"). `--boundary-decorative` resolves to `--rule`.
- Rendering: in light theme the box is `--well` (`#FAF8F5`) on a `--rule` (`#E4E1DA`) edge — near-invisible, reads as a blank cream square. In dark theme `--well` (`#191713`) on `--rule` (`#2E2B26`) is a faint but legible lighter-grey outline around a near-black square — more visible than in light, matching the kit's general "outlines glare in dark" caution (kit §Spacing/States "dark theme values").
- Kit read: this is a quiet placeholder, not a card/list/menu/dialog/preview, so kit rule 1 does not clearly forbid it the way it forbids `.entry-card`. Flagging because the brief explicitly asks for it; the 1px edge is deliberate (control-extent-style affordance so the row still has a defined leading shape) and reasonable to keep. Low priority.
- Effort: S if changed (drop the border entirely, or keep it only for the empty variant since a filled photo needs no edge of its own).
- Affects: `onboarding-import/review` (the "Zerbulator 9000 → Needs a movement" row — no match found), `onboarding-shared/preview` ("Chest-supported dumbbell row (elbows-in)" — no local art yet). Both screens show exactly one empty tile each, alongside filled tiles with real exercise photos for comparison.

## Screens

### onboarding-start/first-run
- light: docs/ui-screens/screens/onboarding-start/first-run__phone-390-light-en.png · dark: …dark-en.png
- severity: low
- deviations:
  - "Build my program" pill → shared #3, `.firstrun__cta` (M).
  - Otherwise meets kit: hairline-free hero band, no boxed surfaces, "Track my current program" is a plain underlined text link.
  - **new**: the dark and light PNGs are byte-identical (`cmp` confirms). Not a capture bug: the hero at this scroll position is always ink-toned regardless of the device theme (same pattern the kit's "inverted ink/cream band per theme" describes elsewhere), so there is nothing theme-dependent in the visible viewport yet. No deviation.

### onboarding-start/first-run-proof
- light/dark: …first-run-proof__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - The embedded workout-screen mock (rest timer + active-set row + quick-adjust row) still reproduces production's current session chrome: the in-progress set row draws a full 1px card outline and the `-30s/Pause/+30s/Skip` row renders as four hard-edged bordered rectangles, not pills → kit fix (M), but owned by the session/workout screens, not this screen list; cross-reference only.
  - Load/Reps/RIR shelf fields and the rest-pill use a 1px required boundary, which the kit explicitly allows ("control extent" exception) — meets kit there.
  - "Build my program" pill → shared #3.
  - **`new`, degenerate range**: the mock's own meta line (top of the embedded phone, partly under the rest pill) reads `3 × 8–10 reps · RIR 1–1 · Adaptive` in both themes. `RIR 1–1` is exactly the degenerate range the brief asks about — it should read `RIR 1`. This is the live `focus.exmeta.range`/`.effort` template (`app.js:8382-8397`, `t("focus.exmeta.effort",{sets,reps:p.targetReps,rmin,rmax})` etc.), which interpolates `rmin`/`rmax` with no `rmin === rmax` collapse guard — unlike the Build editor's own rep-range formatter (`program-editor.js:1046`, `` `${min}${min===max?"":`–${max}`}` ``), which does collapse correctly. Because this demo is a real DOM render of the production Focus header (not a static image), the bug is live here even though the Today/Focus screen itself is out of area A's scope. Fix: add the same `rmin === rmax` guard to the `focus.exmeta.*` templates (or compute a pre-collapsed string once and pass it in). Effort: S. Not a kit-rule (box/hairline) deviation, so it doesn't change this screen's severity bucket, but it is the clearest concrete instance of the pattern the brief asked to check for in area A.

### onboarding-start/first-run-ways
- light/dark: …first-run-ways__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Build my program" pill → shared #3. Otherwise meets kit (stripe bands, hairline divider before "See how pasting a program works", no boxes).

### onboarding-start/first-run-track
- light/dark: …first-run-track__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Metric toggle "Top load / Best e1RM" → `styles.css:845` `.seg:not(.seg--window) button{border:1px solid var(--rule);border-radius:var(--radius-control)}` (moved from `:706`, text unchanged); active state switches to an accent/ink border. Still two individually-outlined buttons, not kit §10's raised-thumb-in-one-track pattern → shared finding #4 pattern (S/M).
  - Outcome rows (Add load/Hold/Back off) are hairline-separated with large Mono metrics in `--ink` → meets kit well.
  - "Build my program" pill → shared #3.

### onboarding-start/first-run-data
- light/dark: …first-run-data__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Build my program" pill → shared #3. Otherwise meets kit (hairline rule between each promise, inverted ink/cream band per theme, no boxes).

### onboarding-start/first-run-faq-open
- light/dark: …first-run-faq-open__phone-390-{light,dark}-en.png
- severity: meets kit
- deviations: none found; FAQ rows are hairline-bounded disclosures with a leading `+`/`−` glyph, consistent with kit §5 row anatomy. The RIR answer text ("RIR 2 means two reps left…") contains no range, degenerate or otherwise.

### onboarding-start/first-run-close
- light/dark: …first-run-close__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Build my program" pill → shared #3. Otherwise meets kit.

### onboarding-start/first-run-returning
- light/dark: …first-run-returning__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Build my program" pill → shared #3. text200 variant checked: reflows cleanly, no clipping. Otherwise meets kit. Light/dark PNGs are near-identical at this scroll position (same always-ink hero as `first-run`) but not byte-identical this time (`cmp` differs) — not flagged further.

### onboarding-start/first-run-returning-resume
- light/dark: …first-run-returning-resume__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Continue choosing your program" pill → shared #3. Otherwise meets kit.

### onboarding-start/hub
- light/dark: …hub__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Choice cards → shared #1 (`.entry-card`, `styles.css:4120`).
  - "Continue" CTA → shared #3.
  - List-option selection still uses an outlined radio circle rather than the kit's "trailing `check` in `--ink`" (kit §10 "Selected, list option") — low priority, note only, unchanged.

### onboarding-start/hub-guide
- light/dark: …hub-guide__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Dialog border+shadow → shared #2 (`.entry-dialog`, `styles.css:7725`); visible as a hairline ring around the panel in dark theme.
  - Background hub correctly dims/scrims behind the dialog — meets kit there.
  - "Got it" single-action footer is fine for a centered dialog (kit's "no footer" rule targets sheets, not dialogs).

### onboarding-start/hub-chosen
- light/dark: …hub-chosen__phone-390-{light,dark}-en.png
- severity: high
- deviations: same as `hub` → shared #1, #3. Selected card's 2px accent/ink keyline still sits on top of the resting 1px-bordered card, compounding the off-kit box.

### onboarding-start/hub-existing
- light/dark: …hub-existing__phone-390-{light,dark}-en.png
- severity: high
- deviations: same as `hub` → shared #1, #3, plus the "Your current program stays active…" notice is also a bordered box (`.entry__active`, shared #1's second selector) rather than tone/hairline separation.

### onboarding-build/setup
- light/dark: …setup__phone-390-{light,dark}-en.png
- severity: low
- deviations:
  - Day-count grid cells are individually bordered (kit's "pad" control-extent exception likely covers this; same `--radius-control` token the kit already allows for pads).
  - "Open editor" CTA → shared #3.

### onboarding-build/editor-empty
- light/dark: …editor-empty__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Day containers → shared #5 (`.program-editor__day`, `styles.css:2862`) — the screen's own description calls this out ("Real empty day containers").
  - "Add exercise" → shared #5 (`.program-editor__add-day`, `:2981`), boxed rectangular button.
  - "Save draft" / "Use this program" → shared #3.

### onboarding-build/editor-partial
- light/dark: …editor-partial__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Day container box → shared #5.
  - Sets stepper (−/3/+) → shared #4 (`.program-editor__stepper`, `styles.css:2903`).
  - Individual numeric fields (Reps per side, Load per side, RIR, Rest) are plain bordered inputs — acceptable, kit doesn't forbid field borders.
  - **`changed`, text200**: re-checked `editor-partial__phone-390-light-en-text200.png`. The header overlap is gone — "Build a program" now wraps to two lines with "Cancel" sitting cleanly below-right, no collision (this screen has no "Back" control at any text size, so the earlier note that "Back disappears" described a non-issue — there was never a Back button here, only Cancel). **Still open**: the exercise target line still clips at 200% — the rendered text reads "⁻10 reps per side" with the leading "6" of "6–10" pushed off the left edge of the viewport; untagged, out of kit scope (a text-reflow bug, not a kit-rule violation), still worth a ticket.

### onboarding-build/editor-ready
- light/dark: …editor-ready__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Day container box → shared #5.
  - "Replace exercise" / "Remove exercise" / "Add exercise" / "Save draft" → shared #3.
  - Smallest-load-change stepper → shared #4.
  - "Suggest loads" switch is a proper oval track, matches kit's switch pattern — meets kit there.

### onboarding-build/editor-alternates
- light/dark: …editor-alternates__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Alternate-row move-up/move-down/remove icon buttons → shared #6 (`.program-editor__alternate-move/-remove`, `styles.css:2954`). Three individually-boxed squares per row (two rows shown here).
  - Day container box + stepper → shared #5, #4.
  - Still the single most boxed screen in the set: day card + stepper + three boxed icon buttons per alternate row, compounding.

### onboarding-import/source
- light/dark: …source__phone-390-{light,dark}-en.png
- severity: high
- deviations: "Choose file" / "Paste a program" choice cards → shared #1 (same `.entry-card`).

### onboarding-import/freeform-empty
- light/dark: …freeform-empty__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Continue" CTA → shared #3. Textarea is a standard bordered field (acceptable); character counter and privacy note are plain text, no boxes — meets kit otherwise.

### onboarding-import/freeform-filled
- light/dark: …freeform-filled__phone-390-{light,dark}-en.png
- severity: low
- deviations: same as `freeform-empty`; focused textarea gets a 2px accent ring, acceptable per kit's focus rule.

### onboarding-import/freeform-stage2
- light/dark: …freeform-stage2__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Edit" / "Open in ChatGPT" / "Open in Claude" / "Copy the prompt" buttons → shared #3 (rectangular, 8px radius).

### onboarding-import/freeform-stage3
- light/dark: …freeform-stage3__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Toast "Prompt copied. Paste it into the app." → shared #7 (`.toast`, `styles.css:3381`). Still the most visible deviation on this screen: a near-full-width rectangular banner in the CTA color, pinned to the textarea's bottom edge and visually colliding with it, rather than a floating pill.
  - "Edit" / "Import from clipboard" / "Review the program" buttons → shared #3.

### onboarding-import/freeform-gaps
- light/dark: …freeform-gaps__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Review the program" CTA → shared #3. Left-rule callout ("Not imported: …") uses `.entry__notice--info` (`styles.css:7048`), quiet top/bottom hairlines + left accent, no full box — meets kit's spirit, unchanged.

### onboarding-import/freeform-gaps-invalid
- light/dark: …freeform-gaps-invalid__phone-390-{light,dark}-en.png
- severity: low
- deviations: same as `freeform-gaps`. The "Please enter valid numbers for the highlighted fields." error callout uses the full-box `.entry__notice--error` variant (shared #1's second selector), not the quiet `--info` variant used two screens over — an internal inconsistency worth noting but not newly introduced. Invalid-field ring (red/orange outline) is a reasonable use of a required-contrast state for a true error, not flagged.

### onboarding-import/freeform-unreadable
- light/dark: …freeform-unreadable__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Could not read program" callout is the full-box `.entry__notice--error` (shared #1's second selector) — border on all four sides plus the red left accent, not just the left rule used on `freeform-gaps`. Still inconsistent with the lighter-touch notices elsewhere in the same flow.
  - "Copy repair prompt" / "Try another assistant" / "Import from clipboard" → shared #3.

### onboarding-import/review
- light/dark: …review__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Row anatomy is close to kit: hairline-separated candidate rows, leading thumbnail as item identity (acceptable leading icon per kit §7). "Change" as a plain text action under each confirmed row is fine.
  - "Choose…" / "Create custom" buttons → shared #3.
  - Empty exercise-art tile ("Zerbulator 9000 → Needs a movement") → shared #9. Visible 1px edge in dark theme, near-invisible in light.

### onboarding-import/preview
- light/dark: …preview__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Use this program" CTA → shared #3. Everything else — stat band, weekly-structure row ("Barbell bench press · 3×6–10", a genuine range, not degenerate), Priorities/Equipment/Progression rows with leading identity icons, hairline separators — meets kit closely; one of the stronger screens in the set. No exercise-art tile visible at this scroll depth.

### onboarding-shared/gate
- light/dark: …gate__phone-390-{light,dark}-en.png
- severity: low
- deviations:
  - "Coach block · 3 days per week" panel is tone-filled (tinted ground, no border) — meets kit (space/tone separation, not a box).
  - "See the program" pill → shared #3.

### onboarding-shared/invalid
- light/dark: …invalid__phone-390-{light,dark}-en.png
- severity: low
- deviations: "Build my program" pill → shared #3. Otherwise meets kit.
  - **note**: light and dark PNGs are byte-identical (`cmp` confirms) — same always-ink hero pattern as `first-run`, not a capture bug.

### onboarding-shared/preview
- light/dark: …preview__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - Per-set RIR badge → shared #8 (`.review__rir`, `styles.css:7671`). Three badges per exercise (e.g. "RIR 3", "RIR 2", "RIR 1" on the Smith machine bench press rows) — each is a distinct value, not a degenerate range.
  - Set-number badge (round, Plex Mono) already matches kit's numbering/typography intent — meets kit there.
  - Day tabs ("Upper / Rest / Lower …") use the hairline-underline tab style, not a boxed segmented control — meets kit.
  - "Use this program" CTA → shared #3.
  - Empty exercise-art tile ("Chest-supported dumbbell row (elbows-in)") → shared #9.

### onboarding-recovery/resume
- light/dark: …resume__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - "Resume setup?" notice uses the full-box `.entry__active`/`.entry__notice` pattern (shared #1's second selector), plus the three options below it reuse `.entry-card` → shared #1.
  - "Resume setup" / "Start over" / choice-card CTAs → shared #3.

### onboarding-recovery/rules-drift
- light/dark: …rules-drift__phone-390-{light,dark}-en.png
- severity: medium
- deviations:
  - "Program rules have changed" notice: full-box `.entry__notice--error` (shared #1's second selector), same pattern as `freeform-unreadable`.
  - Numbered-circle step list (Basics/Gym and equipment/Program) is hairline-separated, no boxes — meets kit well.
  - "Rebuild with current rules" / "Start with the basics" → shared #3.

### onboarding-recovery/cancel-confirm
- light/dark: …cancel-confirm__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Dialog border+shadow → shared #2.
  - "Leave" / "Discard draft and leave" / "Keep setting up" stacked buttons → shared #3.

### onboarding-recovery/restart-confirm
- light/dark: …restart-confirm__phone-390-{light,dark}-en.png
- severity: high
- deviations:
  - Dialog border+shadow → shared #2.
  - "Discard and start over" / "Back to the program" → shared #3.
  - Background program-review page visible behind the scrim repeats the `.review__rir` boxed-badge finding from `onboarding-shared/preview` → shared #8, same component, same fix.

### Degenerate-range check (Focus meta line, rep/RIR ranges), area A
Checked every screen in set A for a range collapsing to a repeated value (e.g. "RIR 1–1"). One
confirmed instance, already detailed under `onboarding-start/first-run-proof` above:
- **Found**: `onboarding-start/first-run-proof`'s embedded workout-screen mock renders
  `3 × 8–10 reps · RIR 1–1 · Adaptive` — a real degenerate range, in both light and dark PNGs. Root
  cause is `app.js:8382-8397` (`focus.exmeta.range`/`.effort`/`.goal`), which interpolates
  `rmin`/`rmax` with no `rmin === rmax` collapse guard.
- Everywhere else in area A is clean:
  - The Build editor's own range formatter already collapses correctly: `program-editor.js:1046`
    `` `${sets} × ${min}${min === max ? "" : `–${max}`}` `` — a single value never prints as a
    range in `editor-partial`/`editor-ready`/`editor-alternates`.
  - `onboarding-shared/preview` and `onboarding-recovery/restart-confirm`'s backgrounded review
    both show per-set RIR as single values per row ("RIR 3", "RIR 2", "RIR 1" — three different
    sets, not one printed as a range), via `entry.review.rir` (`i18n-en.json:2536`, `"RIR {n}"`),
    not the min–max template.
  - `onboarding-import/preview`'s weekly-structure row reads "3×6–10" — a genuine 6-to-10 range,
    not degenerate.
  - The live Today/Focus screen itself (mid-session) is out of area A's scope (#502 / rest-timer
    packet per RECHECK.md), so no other instance of `focus.exmeta.*` was checked beyond this one
    mock, which is in scope because it's one of area A's own 35 listed screens.

## Worst 3

1. **`onboarding-build/editor-alternates`** (and its siblings `editor-empty`/`editor-partial`/
   `editor-ready`) — still the most boxed screen in the whole set: every training day is a bordered
   `.program-editor__day` card, every action inside it is a bordered rectangle, the stepper is a
   divided box, and the alternates row adds three more boxed icon buttons on top of all of that.
   Nothing here resembles the kit's hairline list; the prototype never showed this screen, and nine
   days later it is unchanged.
2. **`onboarding-import/freeform-stage3`** — the toast is still the one element the kit's own owner
   specifically complained about (hard rectangle instead of a pill, wrong ground color), and it
   still visibly collides with the textarea it's pinned to.
3. **`onboarding-start/hub`** (representative of hub/hub-chosen/hub-existing) — the entry point to
   the entire onboarding flow still renders its three primary choices as fully bordered white
   cards, the single most repeated and most visible instance of the "boxed list" violation the kit
   rule 1 exists to prevent; it is the first screen most users ever see.
