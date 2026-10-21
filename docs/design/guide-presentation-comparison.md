# Contextual guides: centred dialog versus anchored cut-out (2026-10-21)

The owner's instruction of 18 October 2026, 20:20 UTC, was **"Test both and choose the best one"**. It concerned the two ways of presenting a contextual guide as a modal dialog (#435). This record holds the comparison and the result. **Variant A, the centred dialog, ships.** Variant B is archived as a patch.

## Variants

Both are the same native `<dialog>`, opened through `openModal`, with the same copy and the single "Got it" action. Both also share focus behaviour, dismissal and persistence, eligibility, and the first-set guide's held first tap. Only the placement differs.

- **A, centred and dimmed.** The entry dialog's panel is centred in the visible viewport, and the whole page is under the `--scrim`.
- **B, anchored, with a bright but inert control.** The scrim leaves the explained control uncovered, though it is still inert. The panel sits above or below the control, whichever side has room. If the control is off screen or neither side has room, B falls back to A's centred dialog.

## Method

The comparison follows a proportionate version of the comparison protocol on `refactor/agent-first-integration` (`docs/architecture/guide-variant-comparison.md`).

**Tested revision.**
- #435 at 301788f8, on main 147e4afa, with a test-only switch (`window.__repforgeGuidePlacement = "centered"` drew A).
- Variant A's gate run was on the same tree just before B's shadow repair (below), which touched only B's anchored rule.

**Paired captures.**
- 16 conditions: the first-set and progress guides, in light and dark, at 390×844 and 375×667, with normal and 200% text. That makes 32 variant frames plus a bare reference for each condition.
- Device scale factor 2, Chromium headless, reduced motion.
- A and B were drawn from the same open dialog on the same page, so the state is identical. Variant order alternated between conditions.
- The bare reference is the same page with the dialog hidden.

**Smoke.** All eight guides (entry, first-set, focus-utilities, progress, block-transition, backup, install, privacy) in both variants, at 390×844 light. Each comes from the catalog's guide states, except entry, which comes from a fresh device's chooser.

**Gates.** `test/guide-modal.mjs`, run under each variant. Every guide reachable in a browser was covered:
- the dialog's title, body and single action; focus starts on the title, and Tab and Shift+Tab stay inside the dialog;
- "Got it" and Escape record `dismissed`, which survives a reload, and Replay works;
- **inertness**:
  - taps on the explained control and on its neighbours, and Enter or Space on the title, change nothing;
  - tapping Log set through the first-set guide logs nothing;
- **the held tap reaches its pad exactly once**, after "Got it" and after Escape;
- **at 200% text on 375×667**, the panel and "Got it" are whole on screen, with no horizontal scroll;
- dark mode draws the theme's surface and ink;
- under B only, the cut-out pixel proof: the control is undimmed, and the page beside it is dimmed.

Artifacts are kept off-repo, in `taurifer-design-refs/focus-layout/`:
- `tip-ab-sheet-first-set.png` and `tip-ab-sheet-progress.png`: paired, with bare | A | B per condition;
- `tip-ab-sheet-smoke.png`;
- `tip-ab/`: the raw frames, `metrics.json` and `smoke.json`;
- `tip-ab/variant-b.patch`: restores B.

## Results

### Gates

- **A: 231 of 231 pass.**
- **B: 263 of 263 pass** (B also runs the cut-out pixel proof), but only after one repair.
  - B's first run failed the undimmed-control proof in dark first-set at 390×844: Log set read 203.3 against 204.9 for the bare page, at rest.
  - The cause was the panel's own drop shadow (`0 16px 40px`). The panel sits directly above Log set, so the shadow fell on the control the cut-out leaves undimmed.
  - The fix: the anchored panel drops its shadow. The proof then passes at its original tolerance.

### Measurements, 16 paired conditions

| | A | B |
| --- | --- | --- |
| Panel whole on screen, "Got it" visible | 16/16 | 16/16 |
| Panel needs its own scroll | 0/16 | 0/16 |
| Panel overlaps the explained control | 2/16 (progress, 375×667, 200% text, both themes: 34 px over the Overview tab) | 0/16 |
| Falls back to centred | n/a | 0/16 (smoke: 1/8, replayed privacy) |

### Scores

Each dimension is scored 0–3 per case and averaged over the 16 cases, then weighted 4:3:2:1 as the protocol sets.

| Dimension (weight) | A | B | Evidence |
| --- | --- | --- | --- |
| Readability (4) | 3 | 3 | Same panel, copy, wrapping and fit in every case. |
| Context (3) | 1.88 | 2.50 | B leaves the explained control bright: the Overview tab, Log set. On first-set, though, B's panel covers the fields and pads that the copy ("Enter the work you completed, then save the set") is about. A keeps the whole shelf in view, dimmed. A's worst cases are the two where its panel covers the Overview tab. |
| Occlusion (2) | 2.75 | 2.00 | A covers the explained control in 2/16 cases. B covers the first-set fields in all 8 first-set cases. |
| Motion and complexity (1) | 3 | 1 | A has no placement, no viewport, scroll or resize listeners, no fallback and no shadow exception. B needs all of them, and its placement would also have to follow the keyboard-up viewport that #443 changes. Neither variant moves beyond `showModal()`. |
| **Weighted total** | **26.1** | **24.5** | |

## Decision

**A.** It scores higher, and the gap comes from concrete observations:
- on first-set, B covers the fields the guide talks about;
- B needs a placement system that A doesn't.

The coordinator's rule for close results ("prefer the simpler one") points the same way. B's strength, a bright explained control, is real but narrow: on Progress, A shows the same tab dimmed and labelled.

## Other findings from the comparison

- **The red #435 CI, dark Progress at 375×667, anchor undimmed (55.71 against 58.90),** came from the measurement's timing, not the rendering. The Progress view's `rise` entrance fade was still running when the "open" frame was read. Paused at opacity 0.93, the anchor reads 56.3 against 59.25, matching the CI pair. The proof now waits for the page's animations to finish; its threshold was not relaxed.
- The catalog's `workout/logged-sets` frame at 200% text was captured before the card brought its open row into view. Its scenario now waits for the card's scroll to come to rest.

## Limits

- Headless Chromium only. No physical phone, real software keyboard, rotation or landscape cases were run (protocol C6 and C8).
- Phone acceptance stays with #425 and #300.
- No user study; the scores rest on the matched frames and measurements above.
