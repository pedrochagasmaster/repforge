# Interaction audit — Motion, @dnd-kit, and native `<dialog>`

This is the record of one pass over Taurifer's whole interaction surface, and of
what each interaction was decided to be. It sits on top of the motion discipline
pass (PR #231), which narrowed motion in the high-frequency training loop; that
work is the baseline here, not something to be revisited.

> **Partly superseded.** `interaction-runtime-audit-apple-followup.md` records a
> later pass that changed three of the decisions below: the focus deck's drag and
> its carry to the next card are now driven by the Motion layer with momentum
> projection and retargeting rather than left to app.js and CSS, and the sheet
> re-grab listed under Known residuals is implemented. Read that note alongside
> the rows marked here, which describe the state before it.

Plan 055 replaces listener takeover with an explicit, idempotent controller
mounted by application boot. The controller owns its listeners and disposal;
Focus navigation calls its handle. Disposing cancels queued navigation, and
pointer cancellation never commits a swipe. The fallback has the same lifetime
when Motion or the whole layer is unavailable. Gesture physics and vendored
exports are unchanged. `test/focus-geometry.mjs` exercises all three runtime
configurations with and without reduced motion.

Three questions were asked of every interaction, in this order:

1. **Does it deserve motion at all?** Emil Kowalski's `emil-design-eng`
   checklist decides this: the more often a lifter triggers something, the less
   motion it may carry. Hundreds of times a session is instant; once per
   workout can be moderate; a rare milestone may have character.
2. **If it moves, is the current implementation the right one?** CSS keeps
   everything simple and frequent. A runtime earns its place only where the
   interaction has physics or state a stylesheet cannot express: a velocity
   handed over at release, a height nobody can know until it is measured, an
   animation that must retarget rather than restart, a gesture that has to be
   interruptible.
3. **If a library is the right answer, which one?** Motion for animation and
   gesture physics; @dnd-kit for drag and drop; the platform's own `<dialog>`
   for a modal, in preference to either.

The decision column reads:

- **Motion** — moved to the vendored Motion runtime via `motion-layer.js`.
- **@dnd-kit** — moved to the vendored @dnd-kit/dom runtime.
- **Native `<dialog>`** — moved from a hand-rolled `div[role="dialog"]`.
- **CSS retained** — deliberately left in the stylesheet.
- **Unchanged** — left exactly as it was, including its JavaScript.

---

## Runtimes added, and why each is there

| Runtime | Version | Bundle | What only it can do |
| --- | --- | --- | --- |
| Motion | 13.2.0 | `vendor/motion/motion.js`, 65KB min / 23KB gz | Springs that carry a gesture's release velocity, retarget mid-flight, and animate a measured height |
| @dnd-kit/dom | 0.5.0 | `vendor/dnd-kit/dnd-kit.js`, 107KB min / 36KB gz | Drag collision detection, a keyboard drag, live-region announcements, auto-scroll |

Both are bundled offline by `tools/build-vendor-runtimes.mjs` from
`tools/vendor-runtimes/`, tree-shaken to the exports actually used, committed,
pinned by version and content hash, and precached by the service worker. The
browser resolves no package and reaches no CDN, so the app behaves identically
offline. `--check` re-hashes the committed bundles with no network and no
`node_modules`, which is what CI runs.

Both are optional by construction. Without Motion every caller keeps its
stylesheet path; without @dnd-kit the editor still mounts and every reorder
stays reachable through the Move controls.

---

## The training loop — where restraint matters most

| Interaction | Current implementation | Decision | Technique | Reason |
| --- | --- | --- | --- | --- |
| Saving a set (the Focus ledger row, `.ledgerline.is-fresh`) | `styles.css` keyframe `setland-row`, 160ms, a 4px rise while fading in, written into the markup of the one render that logs the set | **CSS retained** | — | Dozens of times a session. PR #231 cut this to one short acknowledgement on purpose; a runtime here would add payload and main-thread work to an interaction that must feel instant. The shelf's first version played it over 340ms from 10px; R3e brought it back inside the budget (see [Focus after the input well](#focus-after-the-input-well)) |
| Set counter increment | CSS keyframe, 140ms | **CSS retained** | — | Same frequency, same argument |
| Arming the next set (cue + current-set well) | — | **Removed** (R3e) | — | The input well it armed is gone. The next set's cue and shelf are drawn at rest in the render that logs the set, and the only beat on a save is the ledger row above, so nothing follows every save that the lifter has to wait on |
| Completing an exercise (`focus-done__mark`) | — | **Removed** (R3e) | — | The 280ms mark beat belonged to the input well and went with it; the shelf's completion state is drawn at rest |
| Effort/RIR explainer popover | CSS keyframes with a trigger-anchored origin | **CSS retained** | — | Frequent, small, and already correct: it emerges from the value rather than growing from nothing |
| Effort value swap (`is-bump`) | CSS keyframe, 180ms | **CSS retained** | — | High frequency; a keyframe restarting is acceptable because the value it decorates has already changed |
| Rest-timer dial | 250ms interval writing a CSS-transitioned arc | **Unchanged** | — | A four-times-a-second tick with a transition smoothing it is cheaper than a per-frame animation and kinder to a phone's battery mid-session |
| Save-workout button stamp | CSS keyframe, once per session | **CSS retained** | — | Once per session, no gesture, no state to interrupt |

## Gestures — where physics is the whole point

| Interaction | Current implementation | Decision | Technique | Reason |
| --- | --- | --- | --- | --- |
| Bottom-sheet swipe: following the thumb | Inline transform per pointer event | **Motion** | Motion value painted per change | Position has to live somewhere a spring can pick it up from. The axis lock, scroller yield, flick threshold and "a swipe closes exactly what a tap closes" rule are untouched |
| Bottom-sheet swipe: release | Fixed 260ms CSS transition back to rest | **Motion** | `gestureSettle` spring seeded with the measured velocity | A sheet nudged 20px and one hurled halfway down used to arrive at the same speed. Measured, a sheet released at 900px/s now travels ~7px further before it is caught |
| Bottom-sheet swipe: committed dismiss | The sheet's CSS close, from wherever the thumb left it | **Motion** | `gestureExit` spring, critically damped | A throw carries the sheet out at the speed it was thrown, rather than restarting at the stylesheet's pace |
| Bottom-sheet swipe: cancelled by the browser | Same path as a release | **Motion** | `gestureSettle` spring, seeded at rest | `pointercancel` means a native pan claimed the pointer, not that the lifter let go. Running the release arithmetic anyway projected a stale velocity into a commitment, so a 40px push could dismiss a sheet nobody released. The gesture is abandoned and the sheet returns to rest; the focus deck does the same |
| Bottom-sheet open/close by tap, scrim or Escape | CSS transition on `.is-open` | **CSS retained** | — | No gesture, no velocity, nothing to interrupt. The transition is already interruptible |
| Focus deck: following the thumb | Inline transform on the track, with edge damping | **Unchanged** | — | Direct manipulation; the damping at the ends is a product decision the library has no opinion about |
| Focus deck: abandoned swipe | 210ms CSS transition plus a matching `setTimeout` | **Motion** | `gestureSettle` spring from the released offset | The distance is whatever the thumb chose and the speed whatever it had. That is a catch, and a catch is a spring |
| Focus deck: carrying to the next card | 210ms CSS transition, `setTimeout` completion | **CSS retained** | — | Tried as a spring and taken back out. The card is delivered to a fixed slot with the deck locked, so there is nothing to interrupt, and the spring's tail pushed the index change — which waits on the animation — from 210ms past 300ms. Motion cost responsiveness and bought nothing |
| Focus deck: chevrons and arrow keys | The same 210ms slide | **Unchanged** | — | Keyboard-initiated, so the checklist argues for less motion, not more; the slide is what makes the deck legible and it is already short |

## Program editor — reordering

| Interaction | Current implementation | Decision | Technique | Reason |
| --- | --- | --- | --- | --- |
| Dragging an exercise | Hand-rolled: pickup timer, pointer capture, `elementFromPoint` per move, hand-computed drop index | **@dnd-kit** | `Sortable` per row, `Droppable` per day | It was a drag-and-drop library written by hand, and the parts it lacked were the expensive ones |
| Reordering by keyboard | Not possible — only the explicit Move controls | **@dnd-kit** | `KeyboardSensor`, Space/arrows/Escape | A real keyboard drag, which no amount of animation work would have produced |
| Announcing a drag to a screen reader | Nothing was announced | **@dnd-kit** | `Accessibility` plugin with Taurifer's own EN/PT copy | The library's English defaults would have been the only untranslated copy in the app |
| Scrolling a long day list while dragging | Not possible | **@dnd-kit** | `AutoScroller` from the default preset | — |
| Pickup delay (drag vs. tap) | 90ms timer | **@dnd-kit** | `PointerActivationConstraints.Delay` for touch; none for a mouse on the handle | The 90ms is preserved for a thumb. A mouse on a dedicated handle drags immediately: a delay with a movement tolerance would have cancelled exactly the fast, deliberate drags a mouse is good at |
| Opening a collapsed day by holding over it | 450ms timer on `dragover` | **Unchanged** | — | The library reports what is under the pointer; the timing is a product decision and stays the editor's |
| The lift and drop animation | CSS `is-dragging` plus a FLIP keyframe | **@dnd-kit** | `Feedback` drop animation, 200ms | `feedback: "move"` looked closer to the old drag, but it removes the row from the layout the collision detection measures against and no drop target is ever found. The stylesheet gives the carried copy and the gap it left the same language the old drag had |
| Move up / Move down / Move to another day | Buttons calling `moveExercise` | **Motion** | `layoutShift` spring FLIP | No gesture, so nothing animates the jump. A CSS keyframe restarts from zero, so nudging a row up three times flickered on the second and third taps; a spring retargets from where the row currently is |
| Undo after a move | Status line with an inline Undo | **Unchanged** (bug fixed) | — | The control was only live if something else happened to redraw the editor; it is now bound at the moment it is offered |

## Panels, lists and dialogs

| Interaction | Current implementation | Decision | Technique | Reason |
| --- | --- | --- | --- | --- |
| Settings disclosures (rest, RIR mode, progression, notifications, backup, import) | `display:none` ↔ `display:block` | **Motion** | Measured height, 200ms in / 150ms out | The one place in the app where the target value cannot be known until the interaction happens. Rare enough to afford animating a layout property, and toggling twice quickly now reverses from the current height |
| Block review panel | `div[role="dialog"]`, class-toggled | **Native `<dialog>`** | `showModal()`, `::backdrop` | The platform gives the top layer, the focus trap, inertness and Escape; the app's own focus lifecycle is kept on top of it, exactly as the two dialogs that were already native |
| Restore-backup chooser | `div[role="dialog"]`, class-toggled | **Native `<dialog>`** | Same | Same |
| End-training-block confirm | `div[role="dialog"]`, class-toggled | **Native `<dialog>`** | Same | Same |
| The scrim behind those three | none — they were the only modals that did not dim the page | **Native `<dialog>`** | `::backdrop` on the shared `--scrim` token | A div has no backdrop to draw, which is the only reason these three were the exception. Moving to the element that has one made the app's modals agree; the sheets, the storage-recovery dialog and the leave-editor dialog were all already drawing it |
| The nine bottom sheets | `div[role="dialog"]` + a separate scrim element | **Unchanged** | — | Not an appropriate substitute: the top layer would break the sheet/scrim pair, the `--kb` and `--vvh` sizing that keeps a sheet above the software keyboard, and the swipe gesture that dismisses it |
| Session summary | `div[role="dialog"]`, full-bleed | **Unchanged** | — | The dialog keeps its element, focus and `delayHide` `transitionend` contract. It no longer plays a staged `is-played` choreography: every block is present and opaque on the first frame (Direction D spec section 8, 2026-10-01 owner decision on #295). The one thing that moves is the totals' count ramp, restored by the owner's motion amendment M2 (next rows) |
| First-run gate | `div[role="dialog"]`, full-screen | **Unchanged** (the gate); the page inside it adds the motion recorded in [The landing's pinned proof](#the-landings-pinned-proof) | — | A boot gate rather than a dialog over content; its class semantics are what the install-mode matrix is written against |
| Tour | `div[role="dialog"]` overlay | **Unchanged** | — | A coach mark pinned over live UI, with PR #231's interruptible enter/exit. The top layer would sever it from the page it is pointing at |
| Install banner | `div[role="dialog"]` | **Unchanged** | — | Not modal at all. Its `role` is arguably wrong, but changing what it announces is a separate decision from this one |
| Glossary popover | Class toggle with an outside-click listener | **Unchanged** | — | Anchored to the term that opened it and non-modal; `showModal` would be the wrong element and a scrim the wrong behaviour |
| Session summary number ramp | Hand-rolled `requestAnimationFrame` with an easing and a background-tab fallback | **Restored** (was removed on 2026-10-01, then kept by the owner's motion amendment M2, #295 comment 5941747309) | — | The stat row's totals count up over **600 ms** with a cubic ease-out, started as the summary opens, and land on exactly the figure the markup already carries. It rewrites the figure's text only: no overshoot, no odometer digits, no transform, no change of the other blocks. The reduced-motion decision comes from `RepForgeMotion.reducedMotion()`: under it, or in a hidden tab, the final figures are printed and never repainted, and a 1 s timer lands the final figures if rAF is throttled. Closing or re-rendering the summary cancels a running ramp. `test/session-summary.mjs` records every paint and proves the figures count up, never exceed or step back from the final value, take about 600 ms, land and stay stable; with `prefers-reduced-motion: reduce` the first read is the final figures and nothing lower is ever painted. `test/vendor-runtimes.mjs` pins the 600 ms duration, the ease-out and clamp, the reduced-motion path and the text-only rewrite |
| Session summary block stagger | CSS `animation-delay: calc(var(--i) * 55ms)` | **Removed** | — | Unchanged by M2, which keeps only the count ramp: the blocks do not settle in behind a strike. `.sumsheet.is-played`, the `--i` index, the `sum-settle` keyframes and the dead crest strike rules are deleted; `test/vendor-runtimes.mjs` asserts none remain in CSS or the app, and `test/session-summary.mjs` asserts every block is fully opaque from the first frame and no CSS animation runs on the summary |
| History list, exercise picker, library list | Re-rendered wholesale | **Unchanged** | — | These re-render on a navigation or a search keystroke. Animating a filtered list either lags the typing or animates the wrong rows; no spatial continuity is lost because the whole surface changed |
| Focus-mode ledger fold | Full re-render of the workout | **Unchanged** | — | A candidate for a FLIP, but it sits inside the training loop and would put a layout animation on the path of a mid-session tap. Left for evidence that it is wanted |
| View navigation | CSS keyframe, 140ms | **CSS retained** | — | The highest-frequency transition in the app, already shortened by PR #231 |
| Toasts, tour, install banner transitions | CSS transitions with `@starting-style` | **CSS retained** | — | PR #231 converted these from one-way keyframes to interruptible transitions. That is exactly the right implementation; Motion would only add weight |
| Button, dock and toggle press feedback | CSS transitions, 100–240ms | **CSS retained** | — | Hundreds of times a session |

---

## The landing's pinned proof

Plan 064 section 8.11 admits one scroll-linked section, "only if it degrades to
static bands without JavaScript and under reduced motion". The landing's proof is
that section. It adds no runtime: the vendored Motion bundle is not involved, and
every transition is CSS on the existing `revealIn` curve (`cubic-bezier(.2,.7,.2,1)`).

| What moves | How | Duration |
| --- | --- | --- |
| The step caption and the phone screen change with the scroll position | Opacity crossfade; the transition is only enabled one frame after the first state is painted (`.is-ready`), so no caption flashes on entry | 200ms |
| The lens glides to the element a step reads, then (last step only) to the second element 1.5s later | `left`, `top`, `width`, `height`, `margin`, `border-radius` and the background crop on one transition; the second reading is one recorded `setTimeout` | 350ms; opacity 200ms |
| The phone dims while the lens reads | `filter` on the screen layer | 200ms |
| The persistent Build control appears and steps aside | `transform` plus `visibility`; it is never rendered on the received-program gate | 200ms |
| The disclosure and question icons open | A 90 degree `transform` of one bar | 200ms |

Not carried from the prototype: the overshoot spring, the arrow nudge on hover and
press, the hover rotation of the icons, the caption lift, the sheen on the lens and
the 450ms to 750ms durations. Nothing animates to celebrate. The paste hand-off and
the questions open and close without animating height: they are state changes.

The position is read from `#firstRun`, not the window: the page scrolls inside the
fixed dialog. One `requestAnimationFrame`-coalesced passive scroll listener drives
the pinned steps, the lens and the ground the Build control reads against; two
`IntersectionObserver`s rooted on `#firstRun` watch the hero action and the closing
action. All of it, with the resize and motion-preference listeners, the timer and
the frames, lives in one controller that `openFirstRun` mounts and
`suspendFirstRun`/`closeFirstRun` dispose; `window.__repforgeLandingProof()` reports
what it holds and `test/landing-variants.mjs` proves it is nothing once the gate is
closed.

Reduced motion is an alternate state, not a slower one. The controller reads the
single decision in `motion-layer.js` (`RepForgeMotion.reducedMotion`, with the media
query as the fallback) at mount and again when the preference changes, and under
reduced motion it never builds the phone, lens or rail: the proof is the seven
static cards, each with its own crop of the screen it reads, and anything that would
scroll smoothly jumps. The same static cards are shown on a screen shorter than
600px and under enlarged root text, where a pinned phone would be unreadable. The
information is identical in every case; nothing depends on the motion to say it.

## The motion vocabulary

Six named settings in `motion-layer.js`, and nothing else. A spring literal at a
call site is how a codebase ends up with four slightly different settles nobody
chose, so the runtime contract test fails if one appears.

| Name | Setting | Where |
| --- | --- | --- |
| `gestureSettle` | spring, k=600, c=40, ζ≈0.82 | A surface the thumb released, returning to rest |
| `gestureExit` | spring, k=700, c=53, ζ≈1.0 | A surface leaving because the gesture asked it to |
| `layoutShift` | spring, k=600, c=48, ζ≈0.98 | Rows trading places with no gesture behind them, and one indicator travelling between two places |
| `navPush` | spring, k=700, c=53, ζ≈1.0 | A page pushed in by a tap, or carried off by a committed back swipe. `gestureExit`'s constants under its own name, because no gesture drives a tapped push |
| `revealIn` | 200ms `cubic-bezier(.2,.7,.2,1)` | Content measuring itself open |
| `revealOut` | 150ms `cubic-bezier(.4,0,.8,.2)` | The same content closing — faster, because the system is responding rather than offering |

Two findings shaped these:

- **Duration-parameterised springs ignore velocity.** Motion's
  `visualDuration`/`bounce` shorthand solves for an arrival time, so a sheet
  thrown at 900px/s and one released at rest travelled the same distance.
  Carrying that velocity is the entire reason any of this is Motion rather than
  a CSS transition, so every spring here is written as physics.
- **Sub-pixel settling is a delay you can feel.** Motion's default `restDelta`
  kept a 350px spring running ~200ms after it had visually arrived, which
  delayed the state change waiting on it. Every spring here sets a pixel-scale
  `restDelta` and `restSpeed`.

## Plan 064 rule 11 vocabulary (R1c)

Plan 064 section 8 rule 11 was amended by the owner on 2026-10-01 (#295, comment
5941747309; the decision record is
[`motion-rule-11-amendment.md`](motion-rule-11-amendment.md)). R1c builds the
shared vocabulary and nothing that uses it: every row below has an owner, a
reduced-motion path and the slice where its first consumer lands, and none has
a consumer yet. Everything is transform, opacity, clip or a measured height; no
spring literal is written at a call site; `window.Motion` stays unreachable from
application code and the vendored entry does not widen.

| Addition | Owner | Trigger | Reduced-motion path | Consumer |
| --- | --- | --- | --- | --- |
| One indicator travelling between two places: `RepForgeMotion.animateIndicator(el, fromRect)`, a single-element FLIP on `layoutShift` | `motion-layer.js` | The caller moves the element to its new place, then passes the rect it measured before moving it. A second call mid-run starts from the element's live position, not from where the first began | Clears any run and leaves the element at its end state; no transform, origin or layer hint is set | consumers: T1 field outline and L2 open-row outline landed in R3e (see [Focus after the input well](#focus-after-the-input-well)); N3 Progress underline and D4 chart marker land in R3; N1 dock lens in R6 |
| Page push: the `navPush` spring | `motion-layer.js` | Used by the edge-swipe commit now; a tapped push (N4 drill-downs, N5 Today to Focus) retargets it from the live transform | Jumps to the end state | consumer: lands in R5 (N4, N5 push) |
| Edge-swipe back: `RepForgeMotion.registerEdgeSwipeBack({ page, onCommit })`, the third gesture owner in `mountGestureController()` beside the sheet and Focus owners | `motion-layer.js` | A touch or pen pointer that goes down within 24 px of the left edge on a registered page, then moves right past the 10 px lock. Inert until a page registers; never in Focus; only while `display-mode: standalone` matches, since in a browser tab the left edge belongs to the browser and the visible back control stays the primary route. Release picks home or off-screen from `projectMomentum` and `nearestSnap`; home settles on `gestureSettle`, off-screen commits on `navPush` seeded with the release velocity (zeroed if the thumb stopped for 100 ms), then calls `onCommit`. `pointercancel` never commits. Same lifecycle as the other owners: mounting is idempotent, disposal and Escape cancel any run and hand the page back. While it runs the page carries `is-edge-swiping` so its own CSS can stand down; the consuming page must carry `touch-action: pan-y` or the browser may claim the horizontal drag | Dragging still follows the thumb; a settle or a commit jumps to its end state, and `onCommit` runs on release | consumer: lands in R5 (N4 pages, as part of the transition glue) |
| Measured slot height: `RepForgeMotion.animateSlot(slot, swap)`, the disclosure height run (`revealIn` growing, `revealOut` shrinking) generalised from open and close to swapping one content for another | `motion-layer.js` | `swap` runs exactly once, whichever path is taken; the slot measures its height before and after and animates between them, reversing from the live height if called again mid-run. The slot's minimum height and the content crossfade are the caller's CSS | `swap` runs and the slot is at its new height on the next frame | consumer: L3 inline rest in the cue slot landed in R3f (see [Inline rest](#inline-rest)) |
| Rise: `.motion-rise`, at most 12 px while fading in, 160 ms | `motion-polish.css` | The class is added when the shelf changes job or the completion actions arrive | `animation: none`; the element is at its end state | consumer: L4 exercise-complete shelf landed in R3e (see [Focus after the input well](#focus-after-the-input-well)); the shelf changing job lands in R3 |
| Directional value change: `.motion-value-up` and `.motion-value-down`, 6 px in the direction the value moved, 120 ms; `.motion-value-fade`, an 80 ms crossfade with no travel, is the fallback if the travel reads as busy | `motion-polish.css` | The class is set on the selected field's value when it changes. M1 is conditional on a physical phone check at logging frequency, to be recorded in the device matrix | `animation: none` on all three | consumer: M1 shelf value on a pad tap landed in R3e, pending the device check (see [Focus after the input well](#focus-after-the-input-well)) |
| Clip reveal: `.motion-clip-reveal`, a left-to-right wipe, 360 ms | `motion-polish.css` | Added to the chart line on open, or to only the new segment when a session is added | `animation: none`; the line is fully shown | consumer: lands in R3 (C1 chart line) |
| Step reveal: `.motion-steps-ready .motion-step` and `.is-in`, an 8 px rise with a fade, 200 ms on the `revealIn` curve | `motion-polish.css` | A script marks the group `motion-steps-ready` and adds `.is-in` per step. Without the parent class, which is how it renders without JavaScript, every step is simply visible | Steps are shown at once with no transition | consumer: lands in R2 (O1 landing proof) |
| Build stagger: `.motion-build > .motion-build-item`, an 8 px rise with a fade, 200 ms, each item delayed by `--build-i` times 55 ms | `motion-polish.css` | Set once per generation by the caller; the summary's removed row stagger used the same arithmetic and stays removed | `animation: none` | consumer: lands in R4 (O3 generated program, after OG-1) |
| Indeterminate hairline: `.motion-hairline.is-pending`, a 1 px sweep along the bottom of the host | `motion-polish.css` | Runs only while `.is-pending` is on the host, so it is never a loop at rest; the caller removes the class on settlement or failure. It is the only continuous loop outside the rest timer | The sweep is removed and `.motion-hairline__label` is shown in its place | consumer: lands in R3 (S1 persist-retry banner) |

Two things in the run helpers are not obvious from the call sites. Motion's own
`then` discards what its callbacks return, and a stopped or replaced run never
settles on its own, so "did this run arrive" is resolved by the layer (`false`
the moment a run is superseded) rather than read back from the animation. And
`animateIndicator` scales as well as translates, so a bordered indicator changes
thickness while it travels between different sizes; a consumer that cannot
accept that draws its indicator as a fill or a hairline.

## Focus after the input well

Plan 064 R3e (Plan 063 P5c) removes the input well that the shelf replaced in
R3c: `focusWellHtml`, `cursetHtml` and their helpers, every `.focus-well`,
`.focus-cue` and `.curset` rule, and the well's three motion-polish beats
(the cue and numbers arming, and the exercise-complete mark with its text). What
remains of the set-logging loop is recorded here, one row per beat, with the
rule 11 additions recorded by the later rows of this section.

| Addition | Owner | Trigger | Reduced-motion path | Notes |
| --- | --- | --- | --- | --- |
| Set landing: `.ledgerline.is-fresh`, a 4px rise from 68% opacity, 160ms | `styles.css` (the Focus section) | `app.js` writes `is-fresh` into the one render that logs a set (`focusLogged`); every later render draws the card at rest, and a peek copy never carries it | `animation: none`; the row is at rest on the first frame | Closes RF-11. The shelf's first version played this over 340ms from 10px, outside the training loop's 160ms acknowledgement budget; R3e brought it inside. Nothing in the shelf, the cue or the CTA waits on it |
| Shelf field, pad and action press: the pressed compression (`--control-pressed-transform`) on `.shelf__fieldbtn`, `.shelf__pad` and `.saveset`, no rebound | `styles.css` (the Focus section) and the shared `.btn` transition in `motion-polish.css` | The control's `:active` state | The compression is a transform on a held press; there is no timed animation to remove | Owner pick T2, in scope of rule 11. Swapping a field for its input on the second tap is a state change, not motion: the shelf is rebuilt at rest. Selecting another field and stepping a value are the T1 and M1 rows below |
| T1, the shelf field outline travels: `travelOutline(host, fromRect, "shelf")` in `app.js` draws a separate `.shelf__ring` (a 2px inset ring, no fill) in the newly selected `.shelf__field` and hands it to `RepForgeMotion.animateIndicator` | `app.js` (`refreshShelf`) for the trigger and the element; `motion-layer.js` for the spring (`layoutShift`) | The lifter selects a different field on the same set (Carga, Reps, RIR). A selection made while an outline is in flight starts from where that outline is on screen. A second tap on the same field (opening its input) does not travel. A new set rebuilds the whole card and does not travel | `focusMotion()` is null under reduced motion or without the runtime, so no ring is created: the field wears its own outline on the first frame, with the same `aria-pressed` and focus | A ring and a 2px border would scale differently, so the field's own border is never animated: the ring is the traveller, and the destination's outline is set aside (`.is-ring-travel`) only while it is in the air. The ring is `pointer-events: none` and the shelf action is never disabled or delayed by it (`test/motion-integration.mjs`) |
| L2, the ledger open-row outline travels on advance and on correction: `travelOutline(host, fromRect, "ledgerline")` draws a `.ledgerline__ring` in the new `.ledgerline--open` row | `app.js` (`renderWorkout`, `focusOpenRow`); `motion-layer.js` for the spring | The render after a set is logged (the open row advances) or after a logged row is tapped, saved or cancelled (it goes to the corrected row and back). Same exercise, a different open row; it measures where the outline was drawn, or where an outline still in flight is, before the render replaces the card | As T1: no ring, the open row wears its 2px ring on the first frame | Logging during a travel commits at once and starts the next one from the live position; nothing queues. The ring is a hairline ring without fill so the row's scaling between one-line and two-line heights stays invisible. The open row's well fill and the 160ms `.ledgerline.is-fresh` landing are unchanged |
| L4, the completion actions rise: `.motion-rise` (12px, 160ms) on the shelf's `.focus-done` block and its action (Next exercise or Finish) | `app.js` (`focusShelfHtml`, `settleBeats`) for the class; `motion-polish.css` for the beat | The one render that logs the last set of an exercise (`focusLogged`); the class comes off when the animation ends, so a later render of the finished exercise is at rest and the action's press compression is not held by the beat's end keyframe | `focusShelfHtml` does not write the class, and the stylesheet sets `animation: none`; the actions are there on the first frame | The action is enabled and takes a tap from the first frame (the animation changes opacity and transform only, never `pointer-events`). A tap during the rise moves to the next exercise |
| M1, the shelf value on a pad tap: `.motion-value-up` or `.motion-value-down` (6px, 120ms) on the selected `.shelf__val`, in the direction of the tap; `.motion-value-fade` (80ms crossfade, no travel) as the fallback; one switch, `shelfValueBeat` in `app.js` (`window.__repforgeShelfValueBeat("directional" \| "fade" \| "off")`) | `app.js` (`shelfValueMove`, `playBeat`); `motion-polish.css` for the beats | A pad tap that changes the value: `+` and `-` on load and reps (through the same input handler as a typed value), and the effort pads (through `setEffortPick`). A typed value and an unchanged value (a pad at its floor) play nothing | `playBeat` adds no class under reduced motion, and the stylesheet sets `animation: none` for all three beats; the value text changes on the first frame | **Pending device check.** The owner's pick is conditional on a physical phone at logging frequency; if the travel reads as busy after thirty taps, set the switch to "fade". The outcome goes in the device matrix. The class is removed on `animationend`, and thirty taps in a row each land (`test/motion-integration.mjs`) |

## Inline rest

Plan 064 R3f (Plan 063 P6) puts the rest clock in the Focus cue slot and retires
the `rest-timer` sheet (C-07), with the owner-approved L3 pick: "inline rest in
the cue slot, B, a measured height push with crossfade" (rule 11 as amended,
[`motion-rule-11-amendment.md`](motion-rule-11-amendment.md) sections 4 and 5).
It reads the existing timer (`restEnd`, `restPaused`, `restLength`, the 250ms
tick): no second clock, no stored state, and neither when a rest starts nor how
it is announced or notified changes. What moves, one row per beat. The sheet's
dial arc (`stroke-dashoffset` over 250ms) and its `stroke` colour change retired
with the sheet.

| Addition | Owner | Trigger | Reduced-motion path | Notes |
| --- | --- | --- | --- | --- |
| L3, the cue slot trades its content in a measured height run: `RepForgeMotion.animateSlot(slot, swap)` on `.fx-slot`, `revealIn` growing and `revealOut` shrinking | `app.js` (`restInlineSync`, `swapRestSlot`, `arriveRestSlot`, `renderWorkout`) for the trigger and the slot; `motion-layer.js` for the height run | The timer changes what the slot shows: a logged set starts a rest (cue to clock and next cue), time runs out or Pular is tapped (clock to the done line above the returned cue), a nudge or a restart brings time back, a rest ends from the presets sheet (back to the cue), and a logged row tapped for correction or saved or cancelled (clock to the edit cue and back). The render that logs a set measures the slot before it replaces the card and carries the new slot from that height; a swap between renders (the clock's own repaint) measures the live slot. A swap called again mid-run starts from the height the slot has | `focusMotion()` is null under reduced motion or without the runtime: `animateSlot` runs the swap and the slot is at its end height on the next frame, and no crossfade layer is made. The card is drawn with the end markup and the same information either way | The shelf and its action are outside the slot and are never disabled, delayed or re-rendered by the swap: a set logged mid-push commits at once and the render it triggers starts from the live height (`test/motion-integration.mjs`). While the rest runs the slot keeps a minimum height of the 24px cue, its 18px line and its Why target, so the ledger below moves once as the clock arrives and once when the cue returns, not twice. The restart marks the swap `restRenderPending` only for the commit handler's window, so the clock's repaint never swaps a card that a render is about to replace |
| L3, the crossfade: `.motion-fade-out` over `.motion-fade-in`, 160ms linear, on the slot and on the shelf's pad row (`crossfadeIn`) | `app.js` (`crossfadeIn`, `refreshShelf`, `swapRestPads`, `restSlotArrive`) for the layer; `motion-polish.css` for the beat | The same swaps as the row above, and the pad row trading the field pads for the rest controls (a rest starts, time runs out or Pular) and back (a tap on a shelf field brings the field pads back, D spec section 4.2) | No layer is made and the stylesheet sets `animation: none`; the new content is there on the first frame | The outgoing content is held as a copy over the incoming one, `inert` and `aria-hidden`, taken off at `animationend` or `animationcancel` (and by a 320ms timer, so a beat the stylesheet turned off cannot leave it covering the card). It is at most 160ms, inside the training loop's acknowledgement budget. When a control that held focus leaves the pad row (Pular, or time running out under Pause), focus moves to the selected shelf field so it does not fall to the page |
| The drain bar: `.restinline__fill`, `transform: scaleX(left / length)` on a 4px track, `transition: transform 250ms linear` | `styles.css` (the Focus section) for the transition; `app.js` (`restInlineSync`) writes the scale on every repaint of the clock | The 250ms tick, a nudge, a hold (the scale stops where it is) and a restart. It is a transform, not a width: no layout runs on a tick | `transition: none`; the bar steps with each tick, which says the same thing | The one continuous motion a running timer has. The live region is silent while it runs: it says "Rest started" once and "Rest done" once (`test/focus-mode.mjs` counts the mutations over a window) |

## Reduced motion

`prefers-reduced-motion` is read live in one place and honoured on every path.
It is an alternate state, not a slower animation: the sheet returns to rest
immediately, the deck snaps, a disclosure is fully open on the next frame, rows
do not slide into place, and the drag library's drop, keyboard and reorder
animations are switched off rather than shortened. In every case the state
change and the information it carries are identical — nothing in the app depends
on an animation to say what happened.

## Known residuals

- ~~**Re-grabbing a sheet mid-settle starts from rest.**~~ Implemented by the
  Apple follow-up: `takeover()` stops the spring without clearing its
  presentation value, and the next tracker adopts that pixel as its origin.
## How the Motion guidance was obtained

`motion.dev` is unreachable from this environment (blocked by the egress
policy), so the official **Motion AI Kit** was taken from its published package,
`motion-ai@14.1.0` — the same skills the kit installs: the animation
best-practices set including the vanilla-JS rules, the CSS spring/bounce
guidance, and the MotionScore audit procedure. The API surface was checked
against the pinned `motion@13.2.0` package's own types and dist rather than from
memory.

Two things the kit gates behind Motion+ were not available and are not
guessed at: the MotionScore methodology resource and a runtime `npx motionscore`
audit both need the Motion+ MCP server, which is not connected here. No
MotionScore grade is claimed anywhere in this PR. The timings quoted above are
measured in `test/motion-integration.mjs` against the real runtime.

## What is not covered by an automated test

Contract tests cover the pins, the offline shell, the load order, the layer
boundary, reduced motion, interruption and every reorder path. Four things are
left to a person on a real device:

- Whether the spring settings *feel* right on a low-end Android phone under
  load, as opposed to settling within the times measured here.
- Whether the drag's auto-scroll picks up at a comfortable distance from the
  edge of a long day list held in one hand.
- Whether the drop animation reads correctly against a screen reader's own
  pacing when both are running.
- Whether M1, the shelf value moving with a pad tap, reads as busy after thirty
  taps on a phone held in one hand (pending device check). If it does, the one
  switch moves to the 80ms crossfade; record the outcome in the device matrix.

Plan 055 compact-screen correction: the card context (exercise heading and ledger)
can scroll above the fixed active-set controls. The ledger retains a 112px
minimum, enough for its column heading and one complete previous-set row. Both
gesture owners yield vertical movement when either context or ledger scrolls;
horizontal paging retains its existing physics. The context is a named keyboard
region, and inert peeks have no tab stop. Safe-area browser emulation is automated
evidence; physical one-handed review remains an owner gate.
