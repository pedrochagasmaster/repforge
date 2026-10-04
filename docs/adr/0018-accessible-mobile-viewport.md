# ADR 0018: Accessible mobile viewport and touch behavior

- **Status:** Accepted
- **Date:** 2026-10-04
- **Decision owner:** Product owner, explicit instruction to implement Plan 066

## Context

The previous UI-overhaul policy disabled page zoom to avoid accidental zoom during
repeated set-entry taps. Plan 066 replaces that policy: readable baseline text and
immediate control taps must coexist with a reader's ability to enlarge content.
The owner requested implementation after reviewing the planning PR (#308).

## Decision

Browser pinch, trackpad and keyboard zoom remain available. The viewport declares
device width, initial scale and safe-area coverage without restricting enlargement.
The root uses native touch behavior; tappable controls keep `manipulation` to
remove double-tap delay. Axis-owned content surfaces permit `pinch-zoom`; only
actual gesture rails and drag handles retain `none`. Editable text stays at 16px
or larger. No global listener cancels browser zoom.

The existing VisualViewport owner normalizes height by scale so pinch alone
cannot become a keyboard inset. Keyboard geometry remains available while zoomed;
automatic focus scrolling and scroll reset run only at unit scale. Sheets and
native dialogs share its visible band, offset and safe-area budget. This retains
visual-only keyboard resizing; `interactive-widget=resizes-content` is not added.

Hover decoration requires both hover and a fine pointer, at the existing cascade
position. Active and keyboard-focus states remain available on every input.
Transparent root tap highlighting relies on the app's existing press feedback.
Root overscroll is contained by CSS; inner scrollers keep native scrolling and
contain their boundaries. Selection/callout suppression applies to controls and
gesture rails; content and native editable fields remain selectable. Mouse
selection of explicitly copyable prose does not start a sheet or Focus swipe.

## Consequences and evidence

This supersedes the no-zoom paragraph in `ui-overhaul-spec.md` and the historical
zoom-policy non-change in `interaction-runtime-audit-apple-followup.md`. It does
not change appearance ownership, workout persistence, gesture physics or release
acceptance. Production browser journeys own automated contracts. Actual pinch,
keyboard, callouts, safe areas and browser boundary behavior still require the
physical-device gates in Plan 059 and Plan 066; CI cannot close those gates.
