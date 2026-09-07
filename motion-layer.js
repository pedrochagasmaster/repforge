/* ============================================================
   Taurifer — Motion integration layer
   Runtime: vendor/motion/motion.js (pinned Motion, window.Motion)

   Everything in the app that hands an interaction to Motion goes through here.
   Nothing else in the codebase touches `window.Motion` directly, so there is
   exactly one place that answers "what does a settle feel like in Taurifer",
   one place that knows what reduced motion means, and one place that has to
   survive the runtime being absent.

   What belongs here, and what does not:

   - Motion earns its place where an interaction has *physics*: a thumb let go
     mid-gesture, a row that must keep travelling the way it was thrown, a
     panel whose height nobody can know until it is measured, a list whose rows
     swap places while an earlier swap is still settling. Those need velocity
     transfer, retargeting and real interruption, which a CSS keyframe cannot
     do — a keyframe restarts from zero every time it is re-triggered.
   - The stylesheet keeps everything else. Set completion, view navigation,
     button presses, popovers, toasts, the install banner and the session
     crest are CSS transitions and keyframes, tuned in `motion-polish.css`, and
     this file must not quietly take them over. They are frequent, simple, and
     already correct; re-implementing them in JavaScript would cost payload and
     main-thread work and buy nothing.

   The runtime is optional by construction. Every entry point returns `null` or
   `false` when Motion is not on the page, and every caller keeps its original
   CSS path for that case, so a stale service-worker cache degrades to the
   behaviour shipped before Motion rather than to a broken gesture.
   ============================================================ */
(function (global) {
  "use strict";

  const runtime = global.Motion || null;
  const animate = runtime && typeof runtime.animate === "function" ? runtime.animate : null;
  const motionValue = runtime && typeof runtime.motionValue === "function" ? runtime.motionValue : null;
  const available = !!(animate && motionValue);

  /* ---- The motion vocabulary ----
     Four settings, named for what the interface is doing rather than for the
     numbers in them. Anything that shares a name is meant to feel the same;
     anything that needs a different feel gets a new entry here rather than a
     spring literal at the call site.

     The three springs are written as physics — stiffness, damping, mass —
     rather than as Motion's `visualDuration`/`bounce` shorthand, and that is
     not a style choice. A duration-parameterised spring solves for a fixed
     arrival time, so the release velocity a gesture hands it barely changes
     what it does; measured, a sheet thrown at 900px/s and one let go at rest
     travelled the same distance. Carrying that velocity is the entire reason
     any of this is Motion rather than a CSS transition, so these are real
     springs. Every one is damped between 0.8 and 1.0 of critical: enough to
     read as caught rather than switched off, never enough to wobble.

     Each moves a value measured in pixels, so `restDelta` and `restSpeed` sit
     well above Motion's defaults. Settling the last hundredth of a pixel is
     invisible, and it delays whatever waits on the animation — a tail the
     lifter cannot see is a delay they can.

     The two curves are tweens, because content measuring itself open is not a
     thrown object and pretending otherwise would be decoration. Both stay
     inside the 300ms ceiling the interaction discipline pass set. */
  const VOCABULARY = {
    /* A surface the thumb just released, returning to rest. Slightly under
       critical, so it reads as being caught rather than switched off.
       Visually arrives in about 170ms and is finished inside 320ms. */
    gestureSettle: { type: "spring", stiffness: 600, damping: 40, mass: 1, restDelta: 0.5, restSpeed: 10 },
    /* A surface leaving because the gesture asked it to. Critically damped: it
       is on its way out and must not overshoot on the way. */
    gestureExit: { type: "spring", stiffness: 700, damping: 53, mass: 1, restDelta: 1, restSpeed: 40 },
    /* Rows trading places. Firm and quick — a list being reordered has to stay
       readable while it moves, and several rows move at once. */
    layoutShift: { type: "spring", stiffness: 600, damping: 48, mass: 1, restDelta: 0.5, restSpeed: 20 },
    /* Content measuring itself open or shut. There is no thrown object here,
       so there is no physics to model — a curve is the honest description.
       Exit is shorter than entry: the system responds faster than it offers. */
    revealIn: { duration: 0.2, ease: [0.2, 0.7, 0.2, 1] },
    revealOut: { duration: 0.15, ease: [0.4, 0, 0.8, 0.2] },
  };

  const reduceQuery = typeof global.matchMedia === "function"
    ? global.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  /* Read live rather than cached: the setting can change while the app is open,
     and a lifter who turns it on mid-session should not have to reload. */
  const reducedMotion = () => !!reduceQuery?.matches;

  /* Velocities arrive from the app's own pointer bookkeeping in px/ms, which is
     what its thresholds are written in. Motion works in px/s. */
  const perSecond = vPerMs => (Number.isFinite(vPerMs) ? vPerMs * 1000 : 0);

  /* A layer promotion that is removed again on the way out. Motion promotes
     automatically for the animations it drives through WAAPI, but these are
     motion values painted by hand, so the hint is ours to manage. Leaving it
     on permanently costs memory on exactly the cheap Android hardware this
     app is meant to stay quick on. */
  function hint(el, value) {
    if (!el) return;
    if (value) el.style.willChange = value;
    else el.style.removeProperty("will-change");
  }

  const settled = Promise.resolve(false);

  /* ============================================================
     Bottom sheets
     ------------------------------------------------------------
     The grab handle promises a sheet that can be pushed back down, and the
     existing gesture already answers that promise well: it locks an axis,
     yields to a scroller that has something to scroll, measures velocity, and
     treats a flick as equal to a long push. None of that judgement changes.

     What changes is the last 250ms. Before, release handed the sheet back to a
     fixed 260ms CSS transition, so a sheet nudged 20px and a sheet hurled
     halfway down arrived at the same speed, and re-grabbing one mid-flight
     restarted the gesture from a standstill. A spring seeded with the thumb's
     own velocity carries the throw through, and because the position lives in
     a motion value, a new grab reads where the sheet actually is.
     ============================================================ */
  function trackSheetGesture(sheet, scrim) {
    if (!available || !sheet) return null;

    const y = motionValue(0);
    const height = () => sheet.offsetHeight || 1;
    const paint = value => {
      sheet.style.transform = `translate3d(0,${value}px,0)`;
      /* The scrim thins as the sheet leaves, so the page behind is already on
         its way back before the sheet has finished going. */
      if (scrim) scrim.style.opacity = String(Math.max(0, 1 - value / height()));
    };
    const stopPaint = y.on("change", paint);
    hint(sheet, "transform");

    let disposed = false;
    const handOff = () => {
      /* Give the sheet back to the stylesheet in one tick: drop the inline
         transform at the same moment the dragging class goes, so the CSS rule
         resumes ownership without a frame of disagreement. */
      sheet.style.transform = "";
      if (scrim) scrim.style.opacity = "";
      hint(sheet, null);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      y.stop();
      stopPaint();
      handOff();
    };

    return {
      /* The sheet under the thumb. Set, not animate: the thumb is the clock. */
      follow(dy) {
        if (disposed) return;
        y.set(dy);
      },
      current: () => y.get(),
      /* Changed their mind: back to rest, carrying whatever the thumb was
         doing at the moment it let go. */
      settle({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        return animate(y, 0, { ...VOCABULARY.gestureSettle, velocity: perSecond(velocity) })
          .then(() => { dispose(); return true; }, () => false);
      },
      /* Committed: the sheet keeps going the way it was thrown and is gone.
         The caller still runs the sheet's own dismiss, so what closes is
         exactly what Escape and a scrim tap close. */
      dismiss({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        return animate(y, height(), { ...VOCABULARY.gestureExit, velocity: perSecond(velocity) })
          .then(() => true, () => false)
          .finally(() => dispose());
      },
      /* Torn down from underneath — Escape, a save, a tour step. */
      cancel: dispose,
    };
  }

  /* ============================================================
     Focus-mode exercise deck — the abandoned swipe
     ------------------------------------------------------------
     One horizontal track carries the previous, current and next exercise. A
     swipe past the commitment carries the deck one card over; a swipe short of
     it has to come back.

     Only the coming back is here. Carrying the deck across stays the 210ms CSS
     transition it always was: the card is delivered to a fixed slot, the deck
     is locked for the length of the slide, and a spring's tail delayed the
     index change that waits on it. A swipe that stopped short is the opposite
     case — the distance is whatever the thumb chose, the speed is whatever the
     thumb had, and the two together are the difference between a half-hearted
     push and an abandoned flick. That is a catch, and a catch is a spring.
     ============================================================ */
  function settleFocusDeck(track, { from = 0, velocity = 0 } = {}) {
    if (!available || !track) return null;
    if (reducedMotion()) {
      track.style.transform = "";
      track.style.removeProperty("transition");
      hint(track, null);
      return settled;
    }
    const x = motionValue(from);
    const stopPaint = x.on("change", value => {
      track.style.transform = `translate3d(${value}px,0,0)`;
    });
    /* The caller keeps `is-settling` on the track, because that class is also
       how the rest of the app recognises a slide in progress. Its CSS
       transition would smear every frame this writes, so it is switched off
       inline for the length of the animation and handed straight back. */
    track.style.transition = "none";
    hint(track, "transform");
    return animate(x, 0, { ...VOCABULARY.gestureSettle, velocity: perSecond(velocity) })
      .then(() => true, () => false)
      .finally(() => {
        stopPaint();
        x.stop();
        track.style.removeProperty("transition");
        track.style.transform = "";
        hint(track, null);
      });
  }

  /* ============================================================
     Program editor — dragging and reordering exercises
     ------------------------------------------------------------
     The editor's pointer handling is kept as it is: the pickup delay that
     tells a drag from a tap, pointer capture, the day the row is hovering
     over, the hold that expands a collapsed day, and the drop-target maths all
     stay exactly where they were. Only the parts with physics move to Motion.

     Two things were visibly wrong before:

     - Releasing a dragged row set `transform = ""`, so the row teleported from
       under the thumb back to its old slot, and only then did a keyframe play
       it towards its new one. The row never travelled the distance the lifter
       had just dragged it.
     - The reorder used a CSS keyframe. Nudging a row up three times in a row
       restarted that keyframe from zero each time, so the second and third
       moves flickered instead of continuing.

     A spring per row fixes both: the drop starts where the thumb left the row
     and carries its velocity into the slot, and a row already in flight
     retargets from its current position and speed instead of restarting.
     ============================================================ */
  function trackExerciseDrag(row) {
    if (!available || !row) return null;

    const y = motionValue(0);
    const lift = motionValue(0);
    let disposed = false;

    const paint = () => {
      const scale = 1 + lift.get() * 0.01;
      row.style.transform = `translate3d(0,${y.get()}px,0) scale(${scale})`;
    };
    const stopY = y.on("change", paint);
    const stopLift = lift.on("change", paint);
    hint(row, "transform");

    const clear = () => {
      row.style.transform = "";
      hint(row, null);
    };
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      y.stop(); lift.stop();
      stopY(); stopLift();
      clear();
    };

    return {
      /* Picked up. The row swells a hair so it reads as being held above the
         list; reduced motion keeps the row flat and lets the border do it. */
      pickUp() {
        if (disposed || reducedMotion()) return;
        animate(lift, 1, VOCABULARY.layoutShift);
      },
      follow(dy) {
        if (disposed) return;
        y.set(dy);
      },
      offset: () => y.get(),
      /* Dropped, and the list is about to re-render the row into its new
         place. Hand back a resting row immediately so the re-render is not
         fighting an inline transform — the spring that closes the remaining
         distance belongs to the reorder below, which knows where the row
         actually landed. */
      release: dispose,
      /* Dropped somewhere that is not a move: no re-render is coming, so this
         row springs home itself rather than snapping. */
      returnToRest({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        animate(lift, 0, VOCABULARY.gestureSettle);
        return animate(y, 0, { ...VOCABULARY.gestureSettle, velocity: perSecond(velocity) })
          .then(() => true, () => false)
          .finally(() => dispose());
      },
      cancel: dispose,
    };
  }

  /* Move every row that changed place from where it used to be to where it now
     is. `before` maps a row id to the rectangle it occupied before the
     re-render; rows absent from it are new and are left to the stylesheet.

     `carry` names the one row the thumb was holding and how fast it was
     moving, so the row the lifter is watching keeps its momentum through the
     re-render instead of restarting from rest with its neighbours. */
  function animateExerciseReorder(rows, before, carry = null) {
    if (!available || !rows?.length || !before?.size) return false;
    if (reducedMotion()) return false;
    let moved = false;
    for (const row of rows) {
      const previous = before.get(row.dataset.id);
      if (!previous) continue;
      const delta = previous.top - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      moved = true;
      const carried = carry && carry.id === row.dataset.id;
      const y = motionValue(delta);
      const stopPaint = y.on("change", value => {
        row.style.transform = value ? `translate3d(0,${value}px,0)` : "";
      });
      hint(row, "transform");
      animate(y, 0, {
        ...VOCABULARY.layoutShift,
        velocity: carried ? perSecond(carry.velocity) : 0,
      }).finally(() => {
        stopPaint();
        y.stop();
        row.style.transform = "";
        hint(row, null);
      });
    }
    return moved;
  }

  /* ============================================================
     Disclosure panels
     ------------------------------------------------------------
     Settings rows open panels whose height nobody can state in advance — the
     progression panel is a paragraph on one strategy and a table on another,
     and both localisations differ again. They used to swap `display:none` for
     `display:block`, so the rest of the page jumped by however much content
     had appeared, with nothing to connect the row that was tapped to the
     content that arrived.

     Height is a layout property and animating it is not free, so this is
     deliberately narrow: one small subtree, a fifth of a second, and only for
     a control that a lifter touches a handful of times in the life of the
     install. It earns that cost because it is the one case in the app where
     the target value has to be measured at the moment of the interaction, and
     because toggling the row twice quickly must reverse from the height the
     panel currently has rather than from zero.
     ============================================================ */
  /* One token per panel, so the clean-up of an animation that a second tap
     superseded cannot wipe the inline height the new one is still writing. */
  const disclosureRuns = new WeakMap();

  /* `applyVisualState` is the caller's *visual* toggle — the class that decides
     whether the panel is displayed. It is applied immediately and exactly once,
     whichever branch runs, because that class is also what the next tap reads
     to decide which way it is toggling. A disclosure whose truth lagged its
     animation answered a second tap with the direction of the first.

     Since the closed class hides the panel outright, a closing panel is kept on
     screen for the length of its animation by `is-collapsing` — a marker that
     exists only while the height is travelling and is never part of a resting
     state. */
  const COLLAPSING = "is-collapsing";

  function animateDisclosure(panel, open, applyVisualState) {
    const apply = typeof applyVisualState === "function" ? applyVisualState : () => {};
    if (!available || !panel) { apply(); return null; }
    if (reducedMotion()) { apply(); panel.classList.remove(COLLAPSING); return settled; }

    /* Measured before the class changes: whatever the panel is showing now,
       including a height an interrupted animation was part-way through. */
    const from = panel.getBoundingClientRect().height;
    apply();
    panel.classList.toggle(COLLAPSING, !open);
    panel.style.height = "";
    const to = open ? panel.getBoundingClientRect().height : 0;
    if (Math.abs(to - from) < 1) {
      panel.classList.remove(COLLAPSING);
      panel.style.overflow = "";
      hint(panel, null);
      return settled;
    }

    const token = {};
    disclosureRuns.set(panel, token);
    panel.style.overflow = "hidden";
    hint(panel, "height");
    return animate(
      panel,
      { height: [`${from}px`, `${to}px`] },
      open ? VOCABULARY.revealIn : VOCABULARY.revealOut
    ).then(() => true, () => false).finally(() => {
      /* A run a later tap superseded must not clear the height its replacement
         is still writing. */
      if (disclosureRuns.get(panel) !== token) return;
      disclosureRuns.delete(panel);
      panel.classList.remove(COLLAPSING);
      /* A resting panel carries no inline geometry, so one left open looks
         exactly like one that was never animated. */
      panel.style.height = "";
      panel.style.overflow = "";
      hint(panel, null);
    });
  }

  global.RepForgeMotion = {
    available: () => available,
    reducedMotion,
    vocabulary: VOCABULARY,
    trackSheetGesture,
    settleFocusDeck,
    trackExerciseDrag,
    animateExerciseReorder,
    animateDisclosure,
  };
})(typeof window !== "undefined" ? window : this);
