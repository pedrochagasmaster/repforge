# Interaction audit — Motion, @dnd-kit, and native `<dialog>`

This is the record of one pass over Taurifer's whole interaction surface, and of
what each interaction was decided to be. It sits on top of the motion discipline
pass (PR #231), which narrowed motion in the high-frequency training loop; that
work is the baseline here, not something to be revisited.

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
| Saving a set (ledger row, tick, check) | `motion-polish.css` keyframes, ~160ms | **CSS retained** | — | Dozens of times a session. PR #231 cut this to one short acknowledgement on purpose; a runtime here would add payload and main-thread work to an interaction that must feel instant |
| Set counter increment | CSS keyframe, 140ms | **CSS retained** | — | Same frequency, same argument |
| Arming the next set (cue + current-set well) | CSS keyframe, 140ms | **CSS retained** | — | Follows every save; anything richer would be felt as lag |
| Completing an exercise (`focus-done__mark`) | CSS keyframe, 280ms | **CSS retained** | — | A few times a session. Already the larger beat PR #231 allowed it; there is no physics here, only a curve |
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
| Session summary | `div[role="dialog"]`, full-bleed | **Unchanged** | — | A staged celebratory screen whose `is-played` choreography and `delayHide` `transitionend` contract would all need re-verifying, for no behaviour a lifter would notice |
| First-run gate | `div[role="dialog"]`, full-screen | **Unchanged** | — | A boot gate rather than a dialog over content; its class semantics are what the install-mode matrix is written against |
| Tour | `div[role="dialog"]` overlay | **Unchanged** | — | A coach mark pinned over live UI, with PR #231's interruptible enter/exit. The top layer would sever it from the page it is pointing at |
| Install banner | `div[role="dialog"]` | **Unchanged** | — | Not modal at all. Its `role` is arguably wrong, but changing what it announces is a separate decision from this one |
| Glossary popover | Class toggle with an outside-click listener | **Unchanged** | — | Anchored to the term that opened it and non-modal; `showModal` would be the wrong element and a scrim the wrong behaviour |
| Session summary number ramp | Hand-rolled `requestAnimationFrame` with an easing and a background-tab fallback | **Unchanged** | — | Motion would replace it with an equivalent. It already handles the case that actually bites — a tab backgrounded mid-ramp — and rewriting working code to use a library is not a reason |
| Session summary block stagger | CSS `animation-delay: calc(var(--i) * 55ms)` | **CSS retained** | — | PR #231 kept this deliberately; the reading order is the point and a runtime adds nothing |
| History list, exercise picker, library list | Re-rendered wholesale | **Unchanged** | — | These re-render on a navigation or a search keystroke. Animating a filtered list either lags the typing or animates the wrong rows; no spatial continuity is lost because the whole surface changed |
| Focus-mode ledger fold | Full re-render of the workout | **Unchanged** | — | A candidate for a FLIP, but it sits inside the training loop and would put a layout animation on the path of a mid-session tap. Left for evidence that it is wanted |
| View navigation | CSS keyframe, 140ms | **CSS retained** | — | The highest-frequency transition in the app, already shortened by PR #231 |
| Toasts, tour, install banner transitions | CSS transitions with `@starting-style` | **CSS retained** | — | PR #231 converted these from one-way keyframes to interruptible transitions. That is exactly the right implementation; Motion would only add weight |
| Button, dock and toggle press feedback | CSS transitions, 100–240ms | **CSS retained** | — | Hundreds of times a session |

---

## The motion vocabulary

Five named settings in `motion-layer.js`, and nothing else. A spring literal at a
call site is how a codebase ends up with four slightly different settles nobody
chose, so the runtime contract test fails if one appears.

| Name | Setting | Where |
| --- | --- | --- |
| `gestureSettle` | spring, k=600, c=40, ζ≈0.82 | A surface the thumb released, returning to rest |
| `gestureExit` | spring, k=700, c=53, ζ≈1.0 | A surface leaving because the gesture asked it to |
| `layoutShift` | spring, k=600, c=48, ζ≈0.98 | Rows trading places with no gesture behind them |
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

## Reduced motion

`prefers-reduced-motion` is read live in one place and honoured on every path.
It is an alternate state, not a slower animation: the sheet returns to rest
immediately, the deck snaps, a disclosure is fully open on the next frame, rows
do not slide into place, and the drag library's drop, keyboard and reorder
animations are switched off rather than shortened. In every case the state
change and the information it carries are identical — nothing in the app depends
on an animation to say what happened.

## Known residuals

- **Re-grabbing a sheet mid-settle starts from rest.** The spring is stopped so
  the thumb has sole ownership of the transform — before this PR two writers
  would have fought — but the second gesture does not continue from the sheet's
  current offset. That is now possible, since the position lives in a motion
  value, and it would be a real improvement; it also moves the dismiss threshold,
  which is gesture semantics rather than animation, so it is left as its own
  change.
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
boundary, reduced motion, interruption and every reorder path. Three things are
left to a person on a real device:

- Whether the spring settings *feel* right on a low-end Android phone under
  load, as opposed to settling within the times measured here.
- Whether the drag's auto-scroll picks up at a comfortable distance from the
  edge of a long day list held in one hand.
- Whether the drop animation reads correctly against a screen reader's own
  pacing when both are running.
