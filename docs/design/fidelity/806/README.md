# Fidelity: Prelude suggested warm-ups (PR 806)

Reference: the approved Prelude prototype (`?wu=C&p=C`, served from `warmup-proto-build/serve`), compared with the
production Focus screen. Pairs are `<state>__<frame>-prototype.png` and `<state>__<frame>-production.png`.

States: `prelude` (baseline), `prelude-warm` (already warm, pair against the prototype's `ramp=warm`), `prelude-rest` (first warm-up logged, Warm-up rest running), `prelude-summary` (W row, set 1
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
9. **Already warm.** `prelude-warm` is built from two earlier sessions in which the squat followed a leg press by ten minutes, and a
   leg press set logged ten minutes before today's squat. It reads "You just trained {muscle} with {lift}. One feeler set."
   with one step; the muscle shown is the first entry of the squat's catalog attribution (Glutes), not the prototype's "quads".
10. **Chrome.** The prototype's "PROTO" tab does not exist in production.
11. **Controls.** Load and Reps use production's stepper, wheel and keyboard paths; the prototype's pads are fixed ±2.5.

Not checked here (browser frames are not the phone): momentum and snapping of the wheel, keyboard-open clearance, the physical
rest bell, VoiceOver and TalkBack reading of the rail and the W row. These need the owner's device pass.

## Added in the review round

12. **Folding.** The prototype's table always shows three working rows; production folds what does not fit above the shelf,
    so a card with an upcoming row can show two rows (`prelude-learned`, `prelude-suppressed`, `prelude-warm`).
13. **`prelude-suppressed` at 320×568 with text200.** The quiet "No warm-ups suggested · Why? · Add one" row scrolls out of the
    window under the hero and the shelf; it is reachable by scrolling the context, like the rest of the card.
14. **Fixtures are consistent.** Saved sessions are injected, then a fresh workout is started, so the hero, the shelf and the
    rows agree (learned: 20 · 50 · 72.5 · 92.5 → 107.5; suppressed: "Go up to 107.5 kg" with 107.5 in set 1). Every earlier
    session logged all working sets, so each row has its "last …" line.
15. **Touch targets.** Skip, the suppressed row's links and the Exercise actions links are at least `--control-target` tall, which
    makes the standing row and the quiet row slightly taller than the prototype's.
16. **Reset placement.** The Why sheet's reset follows the first (source) block, so it is visible at the medium detent.
17. **Strings outside the approved §8 (owner approval pending):** `prelude.rail.now` ("{load} {unit}, now" / "agora"),
    `prelude.manage.title` ("Warm-ups" / "Aquecimentos"), and the reps-only / no-work-load lines: `prelude.cue_reps`
    ("Warm up {reps}"), `prelude.cue.plain` ("Log what you actually do."), `prelude.standing_plain`
    ("Warm-up {step} of {total}"), `prelude.cta.next_reps` ("Done · {reps} next"), `prelude.row.vals_reps` and
    `prelude.row.spoken_reps` ("{reps} reps · not counted"). A reps-only lift has no rail and one Reps tile.
