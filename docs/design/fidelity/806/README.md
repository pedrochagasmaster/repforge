# Fidelity: Prelude suggested warm-ups (PR 806)

Reference: the approved Prelude prototype (`?wu=C&p=C`, served from `warmup-proto-build/serve`), compared with the
production Focus screen. Pairs are `<state>__<frame>-prototype.png` and `<state>__<frame>-production.png`.

States: `prelude` (baseline), `prelude-rest` (first warm-up logged, Warm-up rest running), `prelude-summary` (W row, set 1
next), `prelude-learned`, `prelude-suppressed`, `prelude-why` (Why sheet with reset), `prelude-tie` (W row, then the Past zero
tie). Frames: 390×844 and 320×568, light and dark, normal and text200, EN. `…-pt` frames are production only: the prototype
has no Portuguese. Production frames are the catalog's own (`docs/ui-screens/screens/workout/prelude*`), so CI verifies them.

## Every visible difference

1. **Fixture data.** The prototype hard-codes a 102.5 kg history; production uses the Past zero catalog fixture (105 × 6+2 last
   time). The cue above the table therefore reads "Hold 105 kg" (tie fixture) or "Go up to 107.5 kg" after the saved sessions.
   The warm-up cue, rail and shelf match: 20 · 60 · 85 → 105.
2. **Copy.** Production uses the approved section 8 strings. The prototype said "ramp"; production says "warm-up".
   "A starting warm-up for 105 kg. Log what you actually do." replaces "A starting ramp … it becomes yours".
3. **Why sheet.** Production's three blocks are "Where it comes from", "How it learns", "What counts", with the first clause of
   each learning/exclusion string as its bold lead. The reset is "Forget my warm-up for {lift}". Content is shorter than the
   prototype's, so the reset sits below the fold at the medium detent (a swipe to the large detent reaches it).
4. **Rail.** Done steps show the load actually logged (the prototype kept planned loads after an edit, approved in Q7). The
   current step also has a spoken label, "{load} {unit}, now", which section 8 does not list: new string, needs approval.
5. **Quiet row.** "Why?" sits beside "Add one" (approved in Q7); the prototype only had "Add one".
6. **Rest tab.** Reads "Warm-up rest" while the warm-up rest runs (same tab, contour and clock as work rest).
7. **Toasts.** "Warmed up. Set 1 is next.", "Skipped. Skip three sessions in a row to pause suggestions." and the Add toast use
   the approved wording, not the prototype's.
8. **Large text at 320 px.** With text200 at 320×568 the shelf covers most of the screen, as it does for every Focus state, so
   the standing line, Skip and Why? sit in the scrolling context above it (reachable by scrolling). The prototype's text200
   frames only scale the root font and do not model this window. Wrapping of the rail labels is unchanged from the prototype.
9. **Already warm.** There is no production frame: it needs two lifts in one workout. The policy proofs
   (`test/warmup-suggestions.mjs`) cover it; the cue, rail and Why use the same markup as the learned state.
10. **Chrome.** The prototype's "PROTO" tab does not exist in production.
11. **Controls.** Load and Reps use production's stepper, wheel and keyboard paths; the prototype's pads are fixed ±2.5.

Not checked here (browser frames are not the phone): momentum and snapping of the wheel, keyboard-open clearance, the physical
rest bell, VoiceOver and TalkBack reading of the rail and the W row. These need the owner's device pass.
