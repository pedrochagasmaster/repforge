# Interaction runtime — physical-device validation gate

This is the manual gate for the interaction-runtime work in PR #232. It reuses the repository's existing `test/manual-matrix.mjs` device cells rather than creating a second device taxonomy.

The automated browser suites prove state, accessibility semantics, interruption contracts, runtime pins, offline behavior, and source-level motion rules. They cannot prove how a spring feels under real touch input, whether one-handed drag auto-scroll engages at a comfortable distance on a physical phone, or whether VoiceOver/TalkBack announcement pacing is usable. Those three residuals must be checked on hardware before this PR is moved out of draft.

## Owner disposition for merge

On 2026-09-08, the owner explicitly directed that PR #232 be merged with the
physical-device rows below still blank. This is acceptance of the residual
gesture-feel and assistive-technology pacing risk, not evidence that C2, C3, C5,
or C6 passed. Keep the matrix available for later validation and do not cite
this merge decision as physical-device proof in Plan 059.

## Required cells

| Cell | Device surface | Locale / unit | Required assistive-tech pass |
| --- | --- | --- | --- |
| C2 | Physical iOS Safari, 390×844-class viewport | EN / kg | VoiceOver |
| C3 | Physical Android Chrome, 430×932-class viewport | EN / kg | TalkBack |
| C5 | Physical iOS Safari, 390×844-class viewport | PT / lb | VoiceOver |
| C6 | Physical Android Chrome, 430×932-class viewport | PT / lb | TalkBack |

Use the same test date and fixtures produced by `test/manual-matrix.mjs`; the existing C2/C3/C5/C6 definitions remain the source of truth for platform, locale and unit setup.

## Gate A — bottom sheets

Run on C2 and C3, then repeat the accessibility-observable parts on C5/C6.

1. Open a sheet with a scrollable body and drag from its header/grab area.
2. Release after a short slow pull: it must continue at the finger's velocity and settle without a jump.
3. Flick downward from a shorter distance: projected momentum should dismiss when the trajectory clearly points to dismissal.
4. Release short of dismissal, then re-grab while the spring is still returning: the sheet must continue from its visible position with no snap to rest.
5. Reverse direction after re-grab and release: the new gesture must own the surface immediately.
6. Scroll the sheet body away from the top and drag vertically inside the scroller: scrolling must win; the sheet must not steal the gesture.
7. Dismiss by scrim/Escape-equivalent path after a partial gesture: no inline transform, stuck scrim opacity or body lock may remain.
8. Provoke a `pointercancel` mid-swipe — take a call, switch apps, trigger the browser's own edge/pull-to-refresh pan, or start a second touch — and return. The sheet must be back at rest and open: the gesture was taken away, not finished. Real hardware produces these constantly and a desktop browser almost never does, which is why this cell exists.

Pass condition: direct 1:1 tracking, no visible discontinuity on handoff/re-grab, no input lock, no accidental dismissal while an inner scroller still has content above it, and nothing committed from a gesture the system cancelled.

## Gate B — Focus deck

Run on C2 and C3.

1. Slowly drag between exercises and release before commitment: the deck must spring back continuously.
2. Flick to the next exercise: projected momentum must make a short decisive flick capable of advancing.
3. During the 210 ms carry, immediately swipe or tap the opposite direction: the deck must reverse toward the current card rather than ignore input.
4. During the same carry, issue the same direction twice: the second navigation must queue rather than disappear.
5. Re-grab the moving card mid-carry and reverse it.
6. Pull beyond the first and last card: edge resistance must remain continuous rather than hard-stop.
7. Repeat while a long Focus ledger can scroll vertically; vertical intent must still win when clear.
8. Interrupt a carry the same way Gate A step 8 interrupts a swipe: the deck must return to the card it was on rather than advance on momentum the system cancelled.

Pass condition: no discarded navigation, no position jump when interrupted, no accidental horizontal capture of a clearly vertical scroll, no card advanced by a cancelled gesture, and no visible oscillation/wobble beyond the intended settle.

## Gate C — program-editor drag and auto-scroll

Run on C3 and C6; repeat keyboard/screen-reader semantics on C2/C5.

1. Use a program day long enough to require vertical scrolling.
2. Drag an exercise toward the bottom edge one-handed and hold it there.
3. Auto-scroll must start before the finger becomes uncomfortably pinned to the physical screen edge, remain controllable, and stop when the pointer leaves the edge zone.
4. Drag into another collapsed day, hold until it opens, then drop into it.
5. Verify a fast mouse/trackpad drag in desktop coverage still has no artificial pickup delay; touch retains the 90 ms discrimination delay.
6. Keyboard drag: pick up with Space/Enter, move with arrows, cancel with Escape, then complete a second drag.

Pass condition: no lost drop target during auto-scroll, no surprise day expansion, no double animation after drop, and the explicit Move controls remain usable if drag enhancement is unavailable.

## Gate D — VoiceOver / TalkBack pacing

Run VoiceOver on C2/C5 and TalkBack on C3/C6.

1. Start a keyboard/assistive drag and listen to pickup, over-position and drop/cancel announcements.
2. Confirm the announcement names the visible day and exercise and uses the current EN/PT locale.
3. Move through several positions quickly. Announcements must remain understandable rather than stacking into a long stale queue.
4. Cancel once with Escape/back and confirm the final announcement describes cancellation rather than a drop.
5. Confirm focus remains on a live, visible control after the operation.

Pass condition: no untranslated library-default English on PT cells, no materially stale announcement after the operation has ended, and no focus loss.

## Gate E — system accessibility preferences

Where the OS/browser exposes the corresponding media query:

- Reduced Motion: sheets/deck/disclosures use their non-animated alternate state without losing information.
- Reduced Transparency: the dock becomes opaque and blur is removed.
- Increased Contrast: boundaries and dock contrast strengthen without changing Taurifer's light/dark theme choice.

Mark unsupported media queries as `N/A`, not failed.

## Evidence record

Record one row per required cell:

| Cell | Device / OS | Browser / PWA mode | Sheets | Focus deck | DnD auto-scroll | Screen reader | Preferences | Evidence / notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C2 |  |  |  |  |  |  |  |  |
| C3 |  |  |  |  |  |  |  |  |
| C5 |  |  |  |  |  |  |  |  |
| C6 |  |  |  |  |  |  |  |  |

A cell is complete only when every applicable gate is `PASS` or has a concrete issue linked from the PR. PR #232 should stay draft while any required cell is blank.
