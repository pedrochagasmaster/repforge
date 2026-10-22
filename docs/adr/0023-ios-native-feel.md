# ADR 0023: Taurifer takes an iOS-native feel, in its own look

- **Status:** Accepted, 2026-10-22 (owner: "I fully approve the design, let's build it.")
- **Decision owner:** Product owner, after reviewing the prototypes on an iPhone
- **Reference:** [`docs/design/native-feel/`](../design/native-feel/README.md) on PR #477
  (`design/native-feel`), and the Apple-design audit on PR #476
  (`docs/design/apple-design-audit-2026-10.md`)
- **Affects:** `motion-layer.js` (press module, gestures, springs), `styles.css` and
  `motion-polish.css` (presentation), `app.js` (routing and sheet wiring);
  [the interaction audit](../design/interaction-runtime-audit.md) and
  [the semantic contract](../design/ui-system-semantic-contract.md), each amended in the
  phase that needs it; [ADR 0018](0018-accessible-mobile-viewport.md) (its sizing is kept)
- **Plan:** [Plan 075](../../plans/075-ios-native-feel.md)

## Context

The owner asked Taurifer to feel like an iOS app. Depth was set on 2026-10-22: feel and
structure (touch physics, the navigation model, sheets, native-style controls), with
Taurifer's visual identity unchanged. Direction D colours, IBM Plex and the accent budget
stay. The work is web only, with no native shell.

The audit (#476) found 22 gaps. The one with the most weight is F-3: a primary action's
press feedback is a 0.5% shrink, so the lifter gets almost no response under the thumb,
dozens of times a session. PR #477 drew each pattern as a working prototype on the real
tokens, listed what a web app can't reach, and left 12 choices to the owner.

## Decision

Build the proposal in #477, in its phases, in the existing owners, with no new runtime
and no new dependency. The 12 choices are resolved as follows. The coordinator took the
README's recommendation, or the prototype's default where there was none. The owner may
override any of them.

1. **Press feedback:** a pressed tone plus a 0.97 scale on primary actions.
2. **Back swipe:** *Auto*. The app's swipe starts at the edge in the Home Screen app, and
   anywhere on the page in a Safari tab, where Safari owns the edge.
3. **Day picker:** a tap on a day commits it, and a toast offers Undo.
4. **Read-only sheets:** the × is the only exit. Their "Got it" buttons are retired.
5. **Program editor:** a page sheet with Cancel and Done in its bar, which pushes the app
   back.
6. **Switch off state:** a light track with a 3:1 ring. The semantic contract is amended in
   the same PR.
7. **Context menus:** on Today's exercise rows and on the editor's rows.
8. **Load and reps entry:** a wheel picker on a second tap of the Load or Reps field, with
   typed entry kept reachable. RIR is unchanged. *Amended by the owner on 2026-10-22: the
   wheel was first deferred, then brought in as its own PR right after phase 2.* The wheel's
   values come from the existing rules (the exercise's load step or smallest load change,
   per-side included, and a range around the rep target).
9. **Tips:** the centred dialog stays (the owner's decisions of 2026-10-17 and 2026-10-21).
   The anchored tip is not built.
10. **Dock at 200% text:** labels capped at 1.3× and a large-content viewer on touch and
    hold. The semantic contract is amended (audit F-5) in the same PR.
11. **Reduced motion:** pushes and sheets cross-fade over 160–180 ms with no travel. The
    interaction audit's "alternate state" rule is amended (audit F-18).
12. **Sequencing:** phase 1 (touch physics) ships alone first. Then phase 2 (sheets), the
    wheel picker, phase 3 (navigation), phase 4 (controls) and phase 5 (large text), one
    PR each, in that order.

The new strings in the #477 README, English and Portuguese, are approved with the design,
including `focus.field.picker_hint` under amendment 8. `guide.dismiss_aria` is not used,
because the anchored tip is not built.

The motion vocabulary gains one name, `pressRelease` (k=900, c=42, ζ≈0.7): a pressed
control returning to rest. It is used only as a CSS `linear()` curve sampled from the
spring, so a press costs no JavaScript per frame. It is the one spring below ζ 0.75 on
purpose: its overshoot on a 3% scale is under a fifth of a pixel on a 54 px button, and it
makes the release feel like a release rather than a fade.

## Consequences

- Every press in the app is owned by one delegated module in `motion-layer.js`. A control
  shows its pressed state on touch-down, loses it when the finger slides more than 10 px
  off, and gets it back on sliding back. A control in a scroller waits 60 ms first, so a
  scroll that starts on a row doesn't flash it. The stylesheets style `.is-pressed`
  instead of `:active` for these controls; form fields keep `:active`.
- The semantic contract's "pressed" rows change for primary actions: the fill takes
  `--control-primary-pressed-bg` and the scale is 0.97. Other controls keep their wash and
  `--control-pressed-transform`.
- Chromium proofs exercise the logic, not the feel. Each phase states that browser
  automation is not device evidence, and the owner checks each phase on an iPhone.
- What a web app can't close stays open and is listed in the #477 README: haptics, Safari's
  own edge swipe in a tab, system controls and materials, Dynamic Type, and the keyboard
  accessory.
