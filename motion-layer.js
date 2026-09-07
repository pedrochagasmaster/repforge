/* ============================================================
   Taurifer — Motion integration layer
   Runtime: vendor/motion/motion.js (pinned Motion, window.Motion)

   Gesture-driven movement lives here so release velocity, interruption and
   momentum projection have one implementation. The runtime remains optional:
   when it is absent the application keeps its existing CSS/controller paths.
   ============================================================ */
(function (global) {
  "use strict";

  const runtime = global.Motion || null;
  const animate = runtime && typeof runtime.animate === "function" ? runtime.animate : null;
  const motionValue = runtime && typeof runtime.motionValue === "function" ? runtime.motionValue : null;
  const available = !!(animate && motionValue);

  const VOCABULARY = {
    gestureSettle: { type: "spring", stiffness: 600, damping: 40, mass: 1, restDelta: 0.5, restSpeed: 10 },
    gestureExit: { type: "spring", stiffness: 700, damping: 53, mass: 1, restDelta: 1, restSpeed: 40 },
    layoutShift: { type: "spring", stiffness: 600, damping: 48, mass: 1, restDelta: 0.5, restSpeed: 20 },
    revealIn: { duration: 0.2, ease: [0.2, 0.7, 0.2, 1] },
    revealOut: { duration: 0.15, ease: [0.4, 0, 0.8, 0.2] },
  };

  const reduceQuery = typeof global.matchMedia === "function"
    ? global.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const reducedMotion = () => !!reduceQuery?.matches;
  const perSecond = vPerMs => (Number.isFinite(vPerMs) ? vPerMs * 1000 : 0);
  const settled = Promise.resolve(false);

  function hint(el, value) {
    if (!el) return;
    if (value) el.style.willChange = value;
    else el.style.removeProperty("will-change");
  }

  /* Apple's exponential projection from Designing Fluid Interfaces. Pointer
     velocity is kept in px/ms by app.js, so the original /1000 px/s conversion
     cancels and the projected distance is velocity * rate / (1-rate). */
  const PROJECTION_DECELERATION = 0.998;
  function projectMomentum(position, velocityPerMs, decelerationRate = PROJECTION_DECELERATION) {
    const positionNow = Number.isFinite(position) ? position : 0;
    const velocity = Number.isFinite(velocityPerMs) ? velocityPerMs : 0;
    const rate = Math.min(0.9999, Math.max(0, Number(decelerationRate) || 0));
    if (!rate || !velocity) return positionNow;
    return positionNow + velocity * rate / (1 - rate);
  }
  function nearestSnap(projected, candidates) {
    const points = (Array.isArray(candidates) ? candidates : []).filter(point => Number.isFinite(point?.position));
    if (!points.length) return null;
    return points.reduce((best, point) =>
      Math.abs(point.position - projected) < Math.abs(best.position - projected) ? point : best);
  }
  function rubberband(overshoot, dimension, constant = 0.55) {
    const distance = Math.abs(Number(overshoot) || 0);
    const size = Math.max(1, Number(dimension) || 1);
    const resisted = distance * size * constant / (size + constant * distance);
    return Math.sign(overshoot || 1) * resisted;
  }

  function trackSheetGesture(sheet, scrim, { from = 0 } = {}) {
    if (!available || !sheet) return null;
    const origin = Math.max(0, Number(from) || 0);
    const y = motionValue(origin);
    const height = sheet.offsetHeight || 1;
    const paint = value => {
      const position = Math.max(0, value);
      sheet.style.transform = `translate3d(0,${position}px,0)`;
      if (scrim) scrim.style.opacity = String(Math.max(0, 1 - position / height));
    };
    const stopPaint = y.on("change", paint);
    paint(origin);
    hint(sheet, "transform");

    let disposed = false;
    const handOff = () => {
      sheet.style.transform = "";
      if (scrim) scrim.style.opacity = "";
      hint(sheet, null);
    };
    const dispose = ({ preserve = false } = {}) => {
      if (disposed) return;
      disposed = true;
      y.stop();
      stopPaint();
      if (!preserve) handOff();
    };

    return {
      follow(dy) {
        if (disposed) return;
        y.set(Math.max(0, origin + (Number(dy) || 0)));
      },
      current: () => Math.max(0, y.get()),
      takeover() {
        const value = Math.max(0, y.get());
        dispose({ preserve: true });
        return value;
      },
      settle({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        return animate(y, 0, { ...VOCABULARY.gestureSettle, velocity: perSecond(velocity) })
          .then(() => { dispose(); return true; }, () => false);
      },
      dismiss({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        return animate(y, height, { ...VOCABULARY.gestureExit, velocity: perSecond(velocity) })
          .then(() => true, () => false)
          .finally(() => dispose());
      },
      cancel: dispose,
    };
  }

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

  function animateExerciseReorder(rows, before) {
    if (!available || !rows?.length || !before?.size) return false;
    if (reducedMotion()) return false;
    let moved = false;
    for (const row of rows) {
      const previous = before.get(row.dataset.id);
      if (!previous) continue;
      const delta = previous.top - row.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) continue;
      moved = true;
      const y = motionValue(delta);
      const stopPaint = y.on("change", value => {
        row.style.transform = value ? `translate3d(0,${value}px,0)` : "";
      });
      hint(row, "transform");
      animate(y, 0, VOCABULARY.layoutShift).then(() => true, () => false).finally(() => {
        stopPaint();
        y.stop();
        row.style.transform = "";
        hint(row, null);
      });
    }
    return moved;
  }

  const disclosureRuns = new WeakMap();
  const COLLAPSING = "is-collapsing";
  function animateDisclosure(panel, open, applyVisualState) {
    const apply = typeof applyVisualState === "function" ? applyVisualState : () => {};
    if (!available || !panel) { apply(); return null; }
    if (reducedMotion()) { apply(); panel.classList.remove(COLLAPSING); return settled; }

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
      if (disclosureRuns.get(panel) !== token) return;
      disclosureRuns.delete(panel);
      panel.classList.remove(COLLAPSING);
      panel.style.height = "";
      panel.style.overflow = "";
      hint(panel, null);
    });
  }

  /* Independent accessibility signals. They are CSS media queries rather than
     JS preferences so a system change takes effect live without another state
     store or a reload. */
  const PREFERENCE_STYLE_ID = "taurifer-apple-accessibility";
  function installPreferenceStyles() {
    if (document.getElementById(PREFERENCE_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PREFERENCE_STYLE_ID;
    style.textContent = `
@media (prefers-reduced-transparency: reduce) {
  nav {
    --dock-glass: var(--dock-glass-opaque);
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }
}
@media (prefers-contrast: more) {
  :root {
    --rule: var(--ink-faint);
    --rule-strong: var(--ink-soft);
    --dock-edge: var(--ink-soft);
    --dock-glass: var(--dock-glass-opaque);
  }
  nav { border-color: var(--dock-edge); }
  nav button { color: var(--ink); }
}`;
    document.head.append(style);
  }

  /* Once app.js has installed its fallback gesture listeners, replace only the
     two physical surfaces that need presentation-value interruption. The app's
     logical state functions remain authoritative. */
  const SHEET_LOCK = 8;
  const FOCUS_LOCK = 10;
  const FOCUS_SLIDE_MS = 210;
  const sheetRuns = new Map();
  let sheetGesture = null;
  let focusGesture = null;
  let focusSlide = null;

  function visibleSheetFrom(target) {
    const sheet = target?.closest?.(".sheet.is-open");
    return sheet && !sheet.hidden ? sheet : null;
  }
  function currentScrim() {
    const scrims = [...document.querySelectorAll("[id$='Scrim'].is-open")];
    return scrims[scrims.length - 1] || null;
  }
  function sheetScrollHeld(target, sheet) {
    for (let node = target; node instanceof Element && node !== sheet; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight + 1 && node.scrollTop > 0) return true;
    }
    return false;
  }
  function clearSheetGesture({ clearRun = false } = {}) {
    if (!sheetGesture) return;
    const active = sheetGesture;
    sheetGesture = null;
    active.sheet.classList.remove("is-dragging");
    active.scrim?.classList.remove("is-dragging");
    try { active.sheet.releasePointerCapture?.(active.id); } catch {}
    if (clearRun) {
      active.motion?.cancel();
      if (sheetRuns.get(active.sheet) === active.motion) sheetRuns.delete(active.sheet);
    }
  }
  function sheetPointerDown(event) {
    if (sheetGesture) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const sheet = visibleSheetFrom(target);
    if (!target || !sheet) return;
    if (event.pointerType === "mouse" && target.closest("input,select,textarea,[contenteditable]")) return;
    if (sheetScrollHeld(target, sheet)) return;
    sheetGesture = {
      id: event.pointerId, sheet, scrim: currentScrim(), x: event.clientX, y: event.clientY,
      anchorY: event.clientY, dy: 0, live: false, velocity: 0,
      lastY: event.clientY, lastT: event.timeStamp || performance.now(), motion: null,
    };
  }
  function sheetPointerMove(event) {
    const gesture = sheetGesture;
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.sheet.isConnected || gesture.sheet.hidden || !gesture.sheet.classList.contains("is-open")) {
      clearSheetGesture({ clearRun: true }); return;
    }
    const dy = event.clientY - gesture.y;
    const dx = event.clientX - gesture.x;
    if (!gesture.live) {
      if (dy <= -SHEET_LOCK || (Math.abs(dx) >= SHEET_LOCK && Math.abs(dx) > Math.abs(dy))) {
        sheetGesture = null; return;
      }
      if (dy < SHEET_LOCK) return;
      gesture.live = true;
      gesture.sheet.classList.add("is-dragging");
      gesture.scrim?.classList.add("is-dragging");
      try { gesture.sheet.setPointerCapture?.(gesture.id); } catch {}
      const previous = sheetRuns.get(gesture.sheet);
      const from = previous?.takeover?.() || 0;
      if (previous) sheetRuns.delete(gesture.sheet);
      gesture.motion = trackSheetGesture(gesture.sheet, gesture.scrim, { from });
      if (gesture.motion) sheetRuns.set(gesture.sheet, gesture.motion);
      gesture.anchorY = event.clientY - SHEET_LOCK;
    }
    const now = event.timeStamp || performance.now();
    const dt = now - gesture.lastT;
    if (dt > 0) {
      gesture.velocity = (event.clientY - gesture.lastY) / dt;
      gesture.lastY = event.clientY;
      gesture.lastT = now;
    }
    gesture.dy = Math.max(0, event.clientY - gesture.anchorY);
    gesture.motion?.follow(gesture.dy);
  }
  function dismissSheetByExistingPath(sheet) {
    sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  }
  function sheetPointerEnd(event) {
    const gesture = sheetGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    sheetGesture = null;
    if (!gesture.live) return;
    gesture.sheet.classList.remove("is-dragging");
    gesture.scrim?.classList.remove("is-dragging");
    try { gesture.sheet.releasePointerCapture?.(gesture.id); } catch {}
    if (gesture.dy > SHEET_LOCK) global.swallowNextClick?.();

    const motion = gesture.motion;
    if (!motion || gesture.sheet.hidden || !gesture.sheet.classList.contains("is-open")) {
      motion?.cancel();
      if (sheetRuns.get(gesture.sheet) === motion) sheetRuns.delete(gesture.sheet);
      return;
    }
    const current = motion.current();
    const projected = projectMomentum(current, gesture.velocity);
    const threshold = Math.min(160, Math.max(64, (gesture.sheet.offsetHeight || 0) * 0.32));
    const choice = nearestSnap(projected, [
      { position: 0, dismiss: false },
      { position: threshold * 2, dismiss: true },
    ]);
    if (choice?.dismiss) {
      motion.dismiss({ velocity: gesture.velocity });
      dismissSheetByExistingPath(gesture.sheet);
    } else {
      motion.settle({ velocity: gesture.velocity }).finally(() => {
        if (sheetRuns.get(gesture.sheet) === motion) sheetRuns.delete(gesture.sheet);
      });
    }
  }

  function matrixTranslateX(el) {
    if (!el) return 0;
    const value = getComputedStyle(el).transform;
    if (!value || value === "none") return 0;
    try {
      if (typeof global.DOMMatrixReadOnly === "function") return new global.DOMMatrixReadOnly(value).m41 || 0;
    } catch {}
    const match = value.match(/^matrix(3d)?\(([^)]+)\)$/);
    if (!match) return 0;
    const numbers = match[2].split(",").map(Number);
    return match[1] ? numbers[12] || 0 : numbers[4] || 0;
  }
  function focusActive() {
    return !!document.querySelector("#workout.is-focus") && document.body.classList.contains("is-focus-wo");
  }
  function focusTrack() { return global.focusTrack?.() || document.querySelector("#focusTrack"); }
  function focusCard() { return global.focusCard?.() || document.querySelector("#workout.is-focus .exercise.is-current"); }
  function focusStep() {
    const step = global.focusStep?.();
    return Number.isFinite(step) && step > 0 ? step : (focusCard()?.offsetWidth || 320) + 14;
  }
  function focusCanGo(dir) { return !!global.focusCanGo?.(dir); }
  function setFocusTrack(track, value) {
    if (global.focusSetTrack) global.focusSetTrack(track, value);
    else if (track) track.style.transform = `translate3d(${value}px,0,0)`;
  }
  function freezeFocusPresentation(track) {
    const current = matrixTranslateX(track);
    track.style.transition = "none";
    track.classList.remove("is-settling");
    setFocusTrack(track, current);
    track.getBoundingClientRect();
    track.style.removeProperty("transition");
    hint(track, "transform");
    return current;
  }
  function cleanupFocusSlide(run, { clearTransform = true } = {}) {
    if (!run) return;
    clearTimeout(run.timer);
    run.track.classList.remove("is-settling");
    run.deck?.classList.remove("is-swiping");
    run.track.style.removeProperty("transition");
    if (clearTransform) run.track.style.transform = "";
    hint(run.track, null);
    if (focusSlide === run) focusSlide = null;
  }
  function finishFocusSlide(run) {
    if (!run || focusSlide !== run) return;
    const commit = run.commitDir;
    const queued = run.queuedDir;
    cleanupFocusSlide(run);
    if (commit) global.focusGo?.(commit);
    if (commit && queued) requestAnimationFrame(() => fluidFocusAnimateTo(queued));
  }
  function retargetFocusSlide(run, target) {
    freezeFocusPresentation(run.track);
    run.track.classList.add("is-settling");
    run.deck?.classList.add("is-swiping");
    run.track.getBoundingClientRect();
    setFocusTrack(run.track, target);
    clearTimeout(run.timer);
    run.timer = setTimeout(() => finishFocusSlide(run), FOCUS_SLIDE_MS);
  }
  function fluidFocusAnimateTo(dir, { from = null } = {}) {
    dir = Math.sign(Number(dir) || 0);
    if (!dir || !focusActive()) return false;
    if (reducedMotion()) {
      if (focusSlide) cleanupFocusSlide(focusSlide);
      return focusCanGo(dir) ? !!global.focusGo?.(dir) : false;
    }
    const track = focusTrack();
    const deck = document.querySelector("#focusDeck");
    if (!track) return false;

    if (focusSlide && focusSlide.track !== track) cleanupFocusSlide(focusSlide);
    if (focusSlide) {
      const run = focusSlide;
      if (run.commitDir === dir) {
        run.queuedDir = dir;
        return true;
      }
      /* An opposite input is reversal, not navigation to a logical previous
         item. Return the live presentation to this card first, even at index 0
         where focusCanGo(-1) is correctly false. */
      if (run.commitDir) {
        run.commitDir = 0;
        run.queuedDir = 0;
        retargetFocusSlide(run, 0);
        return true;
      }
      /* The transition is already returning to this card. A valid direction
         can reverse that return again without waiting for it to finish. */
      if (!focusCanGo(dir)) return false;
      run.commitDir = dir;
      retargetFocusSlide(run, -dir * focusStep());
      return true;
    }

    if (!focusCanGo(dir)) return false;
    if (from != null) {
      track.style.transition = "none";
      setFocusTrack(track, Number(from) || 0);
      track.getBoundingClientRect();
      track.style.removeProperty("transition");
    }
    const run = { track, deck, commitDir: dir, queuedDir: 0, timer: null };
    focusSlide = run;
    retargetFocusSlide(run, -dir * focusStep());
    return true;
  }
  function cancelFocusSlideForDrag() {
    const run = focusSlide;
    if (!run) return 0;
    const current = freezeFocusPresentation(run.track);
    clearTimeout(run.timer);
    run.track.classList.remove("is-settling");
    run.deck?.classList.add("is-swiping");
    focusSlide = null;
    return current;
  }
  function focusPointerDown(event) {
    if (!focusActive() || focusGesture) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#focusDeck")) return;
    if (target.closest("input,select,textarea,[contenteditable]")) return;
    const card = focusCard(), track = focusTrack(), deck = document.querySelector("#focusDeck");
    if (!card || !track || !deck) return;
    const ledger = card.querySelector(".fcard__ledger");
    focusGesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY, anchorX: event.clientX,
      dx: 0, axis: null, card, track, deck, baseX: 0,
      scrolls: !!ledger && ledger.scrollHeight > ledger.clientHeight + 1,
      velocity: 0, lastX: event.clientX, lastT: event.timeStamp || performance.now(),
    };
  }
  function focusPointerMove(event) {
    const gesture = focusGesture;
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.track.isConnected) { focusGesture = null; return; }
    const mx = event.clientX - gesture.x;
    const my = event.clientY - gesture.y;
    if (!gesture.axis) {
      if (gesture.scrolls && Math.abs(my) >= 18 && Math.abs(my) > Math.abs(mx) * 2) {
        focusGesture = null; return;
      }
      if (Math.abs(mx) < FOCUS_LOCK || Math.abs(mx) <= Math.abs(my)) return;
      gesture.axis = "x";
      gesture.baseX = cancelFocusSlideForDrag();
      gesture.card.classList.add("is-dragging");
      gesture.deck.classList.add("is-swiping");
      try { gesture.deck.setPointerCapture?.(gesture.id); } catch {}
      gesture.anchorX = event.clientX - Math.sign(mx) * FOCUS_LOCK;
    }
    const now = event.timeStamp || performance.now();
    const dt = now - gesture.lastT;
    if (dt > 0) {
      gesture.velocity = (event.clientX - gesture.lastX) / dt;
      gesture.lastX = event.clientX;
      gesture.lastT = now;
    }
    const raw = gesture.baseX + event.clientX - gesture.anchorX;
    const step = focusStep();
    if (raw > 0 && !focusCanGo(-1)) gesture.dx = rubberband(raw, step);
    else if (raw < 0 && !focusCanGo(1)) gesture.dx = rubberband(raw, step);
    else gesture.dx = raw;
    setFocusTrack(gesture.track, gesture.dx);
  }
  function focusPointerEnd(event) {
    const gesture = focusGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    focusGesture = null;
    if (gesture.axis !== "x") return;
    gesture.card.classList.remove("is-dragging");
    try { gesture.deck.releasePointerCapture?.(gesture.id); } catch {}
    if (Math.abs(gesture.dx) > 8) global.swallowNextClick?.();

    const step = focusStep();
    const projected = projectMomentum(gesture.dx, gesture.velocity);
    const snaps = [{ position: 0, dir: 0 }];
    if (focusCanGo(-1)) snaps.push({ position: step, dir: -1 });
    if (focusCanGo(1)) snaps.push({ position: -step, dir: 1 });
    const choice = nearestSnap(projected, snaps) || snaps[0];
    if (!choice.dir) {
      gesture.track.classList.add("is-settling");
      const run = settleFocusDeck(gesture.track, { from: gesture.dx, velocity: gesture.velocity });
      if (run) run.finally(() => {
        gesture.track.classList.remove("is-settling");
        gesture.deck.classList.remove("is-swiping");
      });
      else {
        setFocusTrack(gesture.track, 0);
        setTimeout(() => {
          gesture.track.classList.remove("is-settling");
          gesture.deck.classList.remove("is-swiping");
        }, 220);
      }
      return;
    }
    fluidFocusAnimateTo(choice.dir, { from: gesture.dx });
  }

  function cancelSheetRunsThatClosed() {
    for (const [sheet, motion] of sheetRuns) {
      if (sheet.hidden || !sheet.classList.contains("is-open")) {
        motion?.cancel();
        sheetRuns.delete(sheet);
      }
    }
    if (sheetGesture && (sheetGesture.sheet.hidden || !sheetGesture.sheet.classList.contains("is-open")))
      clearSheetGesture({ clearRun: true });
  }
  function normalizeInstallBannerSemantics() {
    const banner = document.getElementById("installBanner");
    if (banner?.getAttribute("role") === "dialog") banner.setAttribute("role", "region");
  }
  function installFluidControllers() {
    if (!available || global.__tauriferFluidControllersInstalled || global.__repforgeBooted !== true) return false;
    global.__tauriferFluidControllersInstalled = true;

    document.removeEventListener("pointerdown", global.sheetDragStart);
    global.removeEventListener("pointermove", global.sheetDragMove);
    global.removeEventListener("pointerup", global.sheetDragEnd);
    global.removeEventListener("pointercancel", global.sheetDragEnd);
    const workout = document.getElementById("workout");
    workout?.removeEventListener("pointerdown", global.focusDragStart);
    global.removeEventListener("pointermove", global.focusDragMove);
    global.removeEventListener("pointerup", global.focusDragEnd);
    global.removeEventListener("pointercancel", global.focusDragEnd);

    document.addEventListener("pointerdown", sheetPointerDown);
    global.addEventListener("pointermove", sheetPointerMove, { passive: true });
    global.addEventListener("pointerup", sheetPointerEnd);
    global.addEventListener("pointercancel", sheetPointerEnd);
    workout?.addEventListener("pointerdown", focusPointerDown);
    global.addEventListener("pointermove", focusPointerMove, { passive: true });
    global.addEventListener("pointerup", focusPointerEnd);
    global.addEventListener("pointercancel", focusPointerEnd);

    global.focusAnimateTo = fluidFocusAnimateTo;
    if (global.__repforgeFocus) global.__repforgeFocus.go = fluidFocusAnimateTo;

    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      if (sheetGesture) clearSheetGesture({ clearRun: true });
      for (const [sheet, motion] of sheetRuns) {
        if (!sheet.hidden && sheet.classList.contains("is-open")) {
          motion?.cancel();
          sheetRuns.delete(sheet);
        }
      }
    }, true);
    new MutationObserver(cancelSheetRunsThatClosed).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ["class", "hidden"],
    });
    return true;
  }

  global.RepForgeMotion = {
    available: () => available,
    reducedMotion,
    vocabulary: VOCABULARY,
    projectMomentum,
    nearestSnap,
    trackSheetGesture,
    settleFocusDeck,
    animateExerciseReorder,
    animateDisclosure,
  };

  installPreferenceStyles();

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", normalizeInstallBannerSemantics, { once: true });
  else normalizeInstallBannerSemantics();

  let attempts = 0;
  const controllerTimer = global.setInterval(() => {
    normalizeInstallBannerSemantics();
    if (global.__repforgeBooted === true) {
      installFluidControllers();
      global.clearInterval(controllerTimer);
    } else if (++attempts > 1200) global.clearInterval(controllerTimer);
  }, 25);
})(typeof window !== "undefined" ? window : this);