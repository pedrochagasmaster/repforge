# Plan 066: Mobile viewport, touch, and scroll behavior

- **Plan number:** 066
- **Status:** IMPLEMENTED — OWNER / DEVICE REVIEW. Automated evidence is tracked in PR #308; physical acceptance remains pending Plan 059.
- **Requested:** 4 October 2026, following the owner's mobile-native checklist review.
- **Baseline:** `fd4ff35fc102bdcf1a2d0176dff2c4f504146864` (`main`, rechecked on 4 October).
- **Outcome:** Remove the six identified platform-layer gaps while preserving Taurifer's visual language, workout interactions, accessibility, and local-first behavior.
- **Sequencing:** A bounded stabilization addition to the current pre-059 candidate-construction work. Implement on then-current merged `main`; integrate before Plan 059 freezes the release candidate. Do not absorb unrelated Next work or reopen completed redesign slices. Serialize shared CSS, shell, and cache integration with other workfronts.
- **Authority:** The owner explicitly requested implementation on 4 October 2026 after the planning PR. This ratifies M01's zoom-policy replacement, recorded in ADR 0018.

## Governing sources and evidence limits

Read the live [`AGENTS.md`](../AGENTS.md), [`DESIGN.md`](../DESIGN.md),
[`docs/ci.md`](../docs/ci.md), and
[`implementation evidence protocol`](../docs/agents/implementation-evidence.md).
Plan 059 owns final release acceptance; use its existing
[`physical-device gates`](./059-public-launch-ui-validation.md) and
[`interaction device matrix`](../docs/design/interaction-runtime-device-matrix.md).
Appearance remains governed by [ADR 0009](../docs/adr/0009-appearance-setting-dark-theme.md).

The initial review was static. Chromium could not be downloaded in that environment,
and no physical phone was exercised. A missing declaration is a confirmed code gap;
a sticky hover, browser flash, callout, refresh, or clipped sheet is still a device
risk until reproduced. Do not turn these six observations into six claimed hardware
failures. Revalidate selectors and effective cascade before changing code.

The repository already provides a 16px editable-field floor, control press feedback,
`dvh`/`svh` on the main layouts, safe-area padding, inner-scroller containment,
VisualViewport keyboard handling, reduced-motion behavior, and live theme-color
updates. Preserve and verify these contracts instead of adding parallel mechanisms.

## Finding disposition and acceptance contract

| ID | Baseline evidence | Required result | Closing proof |
|---|---|---|---|
| M01 | `index.html` viewport restricts scale; `styles.css` root omits pinch zoom; `app.js` mounts `blockZoomGestures`; `test/accessibility.mjs` asserts zoom suppression. This is an intentional policy, not an accidental omission. | Allow browser zoom and at least 200% enlargement; retain immediate control taps, 16px fields, and deliberate gesture ownership. Pinch must not be mistaken for the keyboard opening. | Browser checks of production viewport, effective touch policies, keyboard/zoom discrimination, and uncancelled browser zoom shortcuts; physical pinch and keyboard cases. |
| M02 | `.picktab:hover`, `.pchip:hover`, and many later role rules in `styles.css` are ungated. `motion-polish.css` restores only a subset under coarse/no-hover media queries. | Hover-only decoration applies only under `(hover: hover) and (pointer: fine)`; every input still gets its intended pressed and focus-visible states. | Rendered CSS checks with coarse/no-hover and fine/hover capabilities; actual phone taps and hybrid pointer/touch use. |
| M03 | Tap-highlight suppression exists on selected controls, but neither `html` nor generic `.btn` has the shared suppression. | Remove the browser tap flash while retaining visible immediate feedback for all tappable controls. | Effective inherited tap-highlight styles and pointer-down/active rendering; phone visual confirmation. |
| M04 | Root `html`/`body` lack overscroll protection; many sheet/Focus children already use `contain`. | App scrolling and dragging do not trigger root pull-to-refresh or scroll the page behind a modal; inner lists keep normal native scrolling. | Root/inner-container computed policies and scroll-boundary journeys; actual Android refresh and iOS boundary behavior. |
| M05 | `.sheet` caps height using `--vvh`, but `.sheet--session,.sheet--exactions` override it with `85vh`; `.storage-recovery` and `.entry-dialog` use `90vh`. | Every sheet/dialog fits the available visible band and safe areas; title, focused input, and final action remain reachable with browser chrome or keyboard visible. | Production-backed measured geometry and scroll-end reachability, plus phone keyboard/rotation checks. |
| M06 | Generic controls lack consistent selection/callout protection; `article.exercise--focus` applies suppression across content and restores text selection only on inputs/textareas. | Control labels and drag handles do not select or open unwanted callouts; prose, errors, notes, exported text, and share URLs remain copyable. | Effective styles and real text selection on content; physical long-press tests on controls, inputs, and content. |

The runtime changes for every row are implemented; automated evidence is tracked in PR #308. Every physical portion remains **OPEN — device required** until its evidence is recorded.
Automated declarations/geometry do not close the physical portion of a row.

## Implementation delta

### M01 — restore accessible zoom without introducing tap or keyboard regressions

Why: a fixed 16px baseline cannot substitute for a reader's ability to enlarge
content. Suppressing double-tap on frequently used controls does not require
suppressing pinch everywhere. `touch-action: manipulation` preserves pinch while
removing double-tap handling and its possible click delay.

1. Remove `maximum-scale=1`, `minimum-scale=1`, and `user-scalable=no` from the
   production viewport meta. Keep `width=device-width`, `initial-scale=1`, and
   `viewport-fit=cover`.
2. Remove `blockZoomGestures()` and its boot invocation, including cancellation of
   Safari `gesture*`, multi-touch `touchmove`, Ctrl+wheel/trackpad pinch, and browser
   zoom keyboard shortcuts. Do not replace them with another global zoom blocker.
3. Set the ordinary document root to `touch-action: auto`. Retain `manipulation`
   on tappable controls. Add `pinch-zoom` to the existing axis policies on Focus
   cards/context, chart surfaces, and pushed/edge-swipe pages where ordinary content
   must remain zoomable. Inspect both stylesheets: a later `pan-y` can undo this.
4. Keep `touch-action: none` only on the actual custom-gesture pickup surfaces,
   such as sheet drag rails and program-editor drag handles. Keep scrolling and
   explicit Back/Move actions usable outside those surfaces. Recheck pointercancel,
   re-grab, vertical scroll intent, and standalone-only edge-swipe arbitration.
5. Make `trackSheetViewport()` distinguish software-keyboard geometry from pinch
   zoom. Its current `innerHeight - visualViewport.height` heuristic can classify
   zoom as a keyboard while an input is focused. Use focus, scale, and viewport
   changes together; a non-unit scale alone must not create a keyboard inset,
   trigger Focus's keyboard resize, or reset the user's scroll/zoom. Preserve the
   keyboard behavior already fixing issue #300, including keyboard open during zoom.
6. Keep editable fields at `--font-size-control` or larger and retain suitable
   `inputmode`/`enterkeyhint`. Do not add `interactive-widget=resizes-content`
   in this change: the current keyboard helper depends on visual-only viewport
   resizing, and changing that contract simultaneously would need separate proof.
7. Record the replacement decision in the next unused ADR and reconcile the live
   no-zoom section of `docs/design/ui-overhaul-spec.md`. Mark the zoom-policy
   non-change in `docs/design/interaction-runtime-audit-apple-followup.md` as
   historical and superseded by that ADR; preserve its original provenance.
   Update the owning accessibility/Focus assertions to the new behavior, rather
   than merely deleting failing assertions.

Policy scope: restoring zoom is the proposed resolution for M01. Planning approval
must make this replacement explicit; no implementation agent should retain the old
blocking tests while claiming this finding fixed.

### M02/M03/M06 — unify touch presentation and text selection

Why: hover, browser highlights, and long-press selection compete with the app's
existing pressed states. Content selection is useful and must remain available.

1. Inventory every `:hover` rule in both shipped stylesheets, including selectors
   combining `:hover` and `:active` through `:is()`, selector lists, and pseudo-elements.
   Move hover-only selectors under `(hover: hover) and (pointer: fine)` at their
   current cascade positions. Split combined hover/active rules so active styling
   stays available on touch. Preserve selected, disabled, validation, and focus states.
2. Remove the coarse/no-hover reset layer only once its entire covered contract is
   replaced by gated hover rules. Do not depend on an ever-growing exception list,
   use UA strings, or alter typography/role tokens to accomplish this.
3. Set `-webkit-tap-highlight-color: transparent` on `html`. Verify inherited
   behavior on buttons, switches, chips, tabs, disclosures, control links, and library
   rows. Reuse current pressed-state tokens and timing; fill any demonstrated
   feedback gap without inventing a new animation language or dependency.
4. Apply prefixed/unprefixed `user-select: none` and appropriate touch-callout
   suppression to actual controls and drag handles. Include label-based file
   controls, summaries, and anchor elements used as actions. Do not apply this to
   `body`, all links, or an entire content-bearing workout card.
5. Narrow the broad `.exercise--focus` selection policy to gesture/control surfaces,
   then prove that selecting recommendation/explanatory text does not initiate a
   swipe. Preserve native text selection/caret behavior for input/textarea, notes,
   ordinary prose links, errors, program exports, and share URLs. Essential copy
   controls must remain operable even on a gesture surface.
6. Keep native form controls, keyboard focus rings, disabled controls, and keyboard
   activation intact. Feedback belongs on press; the action remains on click or
   its existing accessible activation path. Do not move consequential actions to
   `pointerdown` simply to make them feel faster.

### M04 — contain scroll boundaries at the correct owner

Why: root refresh/rubber-banding can interrupt an app task, whereas a sheet's own
native scroll is useful. Preventing scroll globally in JavaScript breaks both.

1. Use CSS `overscroll-behavior: none` on the app root (`html, body`) and retain
   `contain` on scrollable sheet/list/context bodies. Taurifer's first-run landing
   is part of this app; use the same no-refresh default while preserving its normal
   vertical scrolling and pinned proof section.
2. Inspect every actual scroller, not just classes with `overflow` in their names:
   long onboarding/import routes, library/pickers, workout ledger, History edit,
   settings/privacy, and dialogs. Add containment where the end of an inner
   scroller can chain into another app surface.
3. Preserve modal body locking and its release on all existing exits. Do not use
   blanket `touchmove.preventDefault`, `touch-action: none` on a scroller, fixed-body
   hacks, or an app-wide loss of scroll as a substitute for overscroll policy.
4. Verify desktop wheel/trackpad scrolling and browser navigation still work.
   Document unsupported browser behavior from hardware; do not promise CSS can
   override every OS navigation gesture.

### M05 — converge overlays on the visible viewport

Why: plain `vh` can describe a larger viewport than the currently visible area;
a later max-height override can defeat the shared keyboard cap.

1. Audit the computed cascade for every sheet and native dialog, especially the
   session/action sheets, early-finish prompts, note/custom-exercise sheets,
   storage recovery, import choice, and entry dialogs. Do not limit the fix to
   the three selectors cited in the initial review.
2. Replace active plain-`vh` overlay limits with a cap against the shared visible
   viewport and safe-area/margin budget. Keep intended natural heights and the
   existing 74dvh/660px design ceiling where applicable. A subtype may tighten
   the cap, but may not enlarge it beyond the visible band. Retain plain-`vh`
   declarations only as genuinely superseded compatibility fallbacks.
3. For sheets keep the current bottom placement/keyboard owner. For centered
   dialogs, account for visual-viewport offset and keyboard visibility as well
   as height; changing `max-height` alone must not leave the dialog centered
   behind the keyboard. Share geometry only where the existing architecture
   supports it; do not introduce a second viewport tracker.
4. Keep the header and necessary action region reachable; let the intended body
   scroll with `min-height: 0` and containment. Check actual scroll-end geometry
   against the dock, safe areas, and keyboard, including long translated text.
5. Preserve `viewport-fit=cover`, inset-aware content padding, `svh` for stable
   landing stages, and the existing theme owner. Do not replace theme-color
   updates with OS-only meta tags: an explicit app theme must override the OS.

## Execution slices and verification owners

Before implementation, put the six-row acceptance contract into its draft PR,
with the then-current base/head and each assertion/evidence path. Follow the
existing evidence protocol and [CI workflow](../docs/ci.md); do not copy a new
exhaustive test cadence into this plan.

| Slice | Deliverable | Existing proof owners / first falsification |
|---|---|---|
| S0 | Revalidate live selectors, scroll owners, and zoom policy; record baseline phone observations when devices are available. | Reproduce one unselected library tab's touch-hover treatment and one session sheet's keyboard geometry. Record NOT REPRODUCED separately from a code gap; device absence is BLOCKED, not PASS. |
| S1 | M01 + M05: accepted zoom-policy replacement, scale-aware keyboard handling, and bounded sheets/dialogs. | Extend `test/accessibility.mjs`, `test/focus-mode.mjs`, `test/focus-geometry.mjs`, and `test/focus-session-sheet.mjs`. First risky proof: focused session notes plus a shrinking visual viewport keeps the sheet inside the visible band; a scale-only change does not become a keyboard event. Deliberate bad case: retain the subtype's `85vh` override or old zoom blocker and the owning assertion must fail. |
| S2 | M02 + M03 + M06: gated hover, shared tap feedback, scoped control selection. | Extend production-backed `test/accessibility.mjs` and affected library/entry journeys. Verify the same live control's rest/press/focus/selection states under coarse/no-hover and fine/hover. Check selectable prose/exports plus program-editor drag selection. |
| S3 | M04: root and nested scroll containment. | Extend relevant sheet/Focus/library/entry journeys. Drive real scroll boundaries and assert the parent does not move; hardware proves browser refresh suppression. Preserve `test/sheet-swipe-dismiss.mjs`, `test/motion-integration.mjs`, and editor sorting/cancel behavior. |
| S4 | Reconcile policy docs, cache inventory, and catalog; complete focused/regression evidence on a coherent implementation head. | `test/appearance.mjs`, cache/shell owners, canonical checker, affected journeys, rendered role gates, and reviewed full catalog recapture because the CSS changes are global. Exact-head remote `ci` is the automated completion gate. |
| S5 | Physical acceptance and handoff to Plan 059. | SHA-bound Android/iOS browser + installed-PWA checks below; affected device evidence invalidates after relevant source changes. Stop at OWNER REVIEW. |

Use the owning suites through `tools/run-tests.mjs`; discover exact IDs with
`--list`/`--explain`. Strengthen existing journeys before adding another suite.
Do not test CSS source order, private helper names, or declaration strings as a
substitute for rendered behavior. Synthetic viewport/capability checks can prove
bounded contracts, but cannot prove actual mobile browser chrome or touch feel.

Cached runtime changes require a live `sw.js` cache revision and aligned protected
script URLs under the repository's existing release-asset rules. Allocate from
then-current `main`, never copy this plan's baseline revision. Merge shared-file
updates serially; revalidate affected proofs after reconciliation. Capture and
review the global light/dark, EN/PT catalog without hand-editing PNGs.

## Required physical acceptance

Reuse C2/C3/C5/C6 from the interaction device matrix, adding browser and installed
PWA modes as required by Plan 059. Record candidate SHA, device/OS/browser version,
display mode, locale/unit, date, observed viewport, result, and artifact/issue link.
Use real phones, including an older/slower Android phone when available; desktop
emulation is supplementary. Unsupported behavior is a concrete limitation, not PASS.

| Check | Required observation |
|---|---|
| Pinch and text scaling | Enlarge ordinary content to at least 200%, pan/read it, then return. Repeat with a field focused and keyboard visible. No zoom gesture is globally cancelled, and keyboard bookkeeping does not reset the user's view. VoiceOver/TalkBack still operate critical actions. |
| Repeated taps and hover | Repeated load/reps presses do not double-tap zoom, retain instant feedback, and do not leave hover decoration after release. Exercise both touchscreen and mouse/trackpad where available. |
| Tap flash and long press | Controls show only their intended pressed treatment; holding labels/handles does not select them. Notes, errors, explanations, exports, URLs, and normal content remain selectable/copyable. |
| Scroll and gesture cancellation | Pull past Today/landing top, then sheet/list boundaries. No accidental app refresh or scrolling behind a modal. Vertical scrolling, sheet dismissal/re-grab, Focus paging, program reorder, and pointercancel recover normally. |
| Keyboard and overlays | Focus shelf inputs, session notes/bodyweight, library search, freeform import, and editor fields. Header/input/actions remain reachable with keyboard open and closed, browser bars expanded/collapsed, compact portrait, and one landscape pass. |
| Safe areas and appearance | Notch/home-indicator clearances remain correct in browser and installed modes. Explicit Light/Dark and System appearance retain their live theme-color behavior; inspect installed status bar and startup surface separately. |

Attach device observations to the implementation PR and existing evidence matrix.
Do not invent a separate launch gate or mark Plan 059 complete from this plan.
If hardware is unavailable, finish reviewable engineering work and identify the
pending device rows; no unqualified mobile-complete claim is allowed.

## Completion and stop conditions

- Each M01–M06 row has an implemented disposition, a named automated assertion,
  and physical evidence or an explicitly pending owner/environment gate.
- The zoom proposal is explicitly accepted before its implementation; normative
  docs, effective runtime behavior, and accessibility tests agree on the policy.
- Ordinary content remains selectable, controls remain accessible, gesture intent
  and keyboard behavior are preserved, and no workout storage/schema/telemetry
  contract changes. No framework, device-sniffing layer, new gesture engine, or
  cosmetic redesign belongs to this work.
- Exact-head `ci` is green, relevant catalog evidence is reviewed, and changed
  runtime/cache assets agree. Update this plan's status, the plan index, and the
  canonical backlog on completion; leave unrelated stale statuses to their owner.
- Stop and report a conflict if reality requires a new product decision, a
  different keyboard-resize architecture, loss of browser zoom/selection, or
  weakening an existing accessibility/data-safety gate. A browser download failure
  is an environment limit, never passing browser evidence.

## References

- [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action) — `manipulation` preserves pinch, and ancestor touch policies intersect.
- [Chrome: viewport resize behavior](https://developer.chrome.com/blog/viewport-resize-behavior/) — keyboard resizing and VisualViewport versus layout viewport.
- [WebKit: viewport-fit and safe areas](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) — edge-to-edge drawing and content inset requirements.
- [W3C: meta viewport allows zoom](https://www.w3.org/WAI/standards-guidelines/act/rules/b4f0c3/) — viewport scale restrictions and accessibility, including browser-support limitations.

## Implementation evidence and handoff

Implementation was authorized by the owner on 4 October 2026 and reconciled with
merged main `46b0f66954e8257d92f91ef84d4012127c7b7eff`. [PR #308](https://github.com/pedrochagasmaster/repforge/pull/308)
contains the runtime changes, ADR 0018, six-row assertion mapping, and final-head CI status.

The first browser proof at `58a04602f5a0c529fe4dbf46e6d3754984c0d304`
falsified the old zoom cancellation, coarse-pointer hover, tap-highlight and root
overscroll policies ([baseline run](https://github.com/pedrochagasmaster/repforge/actions/runs/37226303090)).
A test navigation mistake prevented the later baseline assertions; it was corrected
before implementation validation. The session geometry proof also injects the old
85vh override to require an observable clipped header, rather than only checking
a benign resting layout.

Owning production journeys are `test/accessibility.mjs` (mobile policies,
selection, keyboard/scale geometry, press/hover, scroll boundary),
`test/program-entry-a11y.mjs` (offset native dialog and last action),
`test/focus-mode.mjs`, `test/motion-integration.mjs`, and `test/simulation.mjs`.
Existing session-sheet, swipe-dismiss, editor selection/reorder, appearance,
offline and cache proofs remain required. The complete CI inventory includes all
six catalog recapture shards across the global light/dark, EN/PT matrix; generated
pixel differences, if any, require review before acceptance.

Local production/test syntax, release inventory, design/canonical checkers and
runtime budget are available. The local Chromium download returned a truncated
archive, so browser and catalog evidence comes from GitHub Actions, using the
repository's pinned dependencies and isolated preview. No desktop/device emulator
result is physical-device evidence. M01–M06's hardware portions remain OPEN in
Plan 059 and the existing interaction device matrix. No phone was connected and
no hardware PASS, release acceptance or merge is claimed.
