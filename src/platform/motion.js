/**
 * @typedef {{get:()=>number,set:(value:number)=>void,stop:()=>void,on:(event:'change',paint:(value:number)=>void)=>()=>void}} MotionValue
 * @typedef {{type?:string,stiffness?:number,damping?:number,mass?:number,restDelta?:number,restSpeed?:number,duration?:number,ease?:number[],velocity?:number}} AnimationOptions
 * @typedef {{then:(arrived:()=>unknown,failed:()=>unknown)=>Promise<unknown>}} Playback
 * @typedef {{animate:(target:MotionValue|HTMLElement,to:number|{height:string[]},options:AnimationOptions)=>Playback,motionValue:(initial:number)=>MotionValue}} MotionRuntime
 * @typedef {Promise<boolean> & {abandon:()=>void}} Arrival
 * @typedef {{left:number,top:number,width:number,height:number}} Rect
 * @typedef {{y:MotionValue,stopPaint:()=>void,arrived?:Arrival}} ValueRun
 * @typedef {ValueRun & {distance:number,from:Rect,to:Rect}} IndicatorRun
 * @typedef {{x:MotionValue,stopPaint:()=>void,arrived?:Arrival}} PushRun
 * @typedef {{pointerId?:number,type?:string,timeStamp?:number}} PointerEnd
 * @typedef {{id:number,x:number,y:number,anchorX:number,dx:number,axis:'x'|null,card:HTMLElement,track:HTMLElement,deck:HTMLElement,baseX:number,scrolls:boolean,velocity:number,lastX:number,lastT:number}} FocusGesture
 * @typedef {{track:HTMLElement,deck:HTMLElement|null,commitDir:number,queuedDir:number,timer:number|null}} FocusSlide
 * @typedef {{page:HTMLElement,onCommit:()=>unknown}} EdgeTarget
 * @typedef {{isFluid:boolean,navigate:(direction:number)=>unknown,dispose:()=>void}} GestureController
 * @typedef {{dragStart?:(event:PointerEvent)=>void,dragMove?:(event:PointerEvent)=>void,dragEnd?:(event:PointerEnd)=>void}} DragHandlers
 * @typedef {DragHandlers & {track?:()=>HTMLElement|null,card?:()=>HTMLElement|null,step?:()=>number,canGo?:(direction:number)=>boolean,setTrack?:(track:HTMLElement|null,value:number)=>void,go?:(direction:number)=>unknown}} FocusPresentation
 * @typedef {{window:Window & typeof globalThis & {Motion?:MotionRuntime},runtime?:MotionRuntime|null,focus?:FocusPresentation,sheets?:DragHandlers,selection?:{isNativeTextSelectionTarget?:(target:Element)=>boolean,swallowNextClick?:()=>void},fallback:{mount:()=>{dispose:()=>void},navigate:(direction:number)=>unknown}}} MotionOptions
 */
/** Optional animation and gesture lifetime. No browser work happens on module import.
 * focus supplies track/card/step/canGo/setTrack/go and fallback drag handlers;
 * sheets supplies fallback drag handlers; selection owns click suppression.
 * fallback is required when mounting without the optional animation runtime.
 * These callbacks affect presentation only; training and route state stay with their owners.
 */
/** @param {MotionOptions} options */
export function createMotion({ window: global, runtime = global.Motion || null,
  focus = {}, sheets = {}, selection = {}, fallback }) {
  /** @typedef {{id:number,sheet:HTMLElement,scrim:HTMLElement|null,x:number,y:number,anchorY:number,dy:number,live:boolean,velocity:number,lastY:number,lastT:number,motion:ReturnType<typeof trackSheetGesture>}} SheetGesture */
  /** @typedef {{id:number,page:HTMLElement,target:EdgeTarget,x:number,y:number,dx:number,live:boolean,velocity:number,lastX:number,lastT:number,motion:ReturnType<typeof trackEdgeSwipe>}} EdgeGesture */
  const document = global.document;
  const Element = global.Element;
  const performance = global.performance;
  const getComputedStyle = global.getComputedStyle.bind(global);
  const requestAnimationFrame = global.requestAnimationFrame.bind(global);
  const setTimeout = global.setTimeout.bind(global);
  const clearTimeout = global.clearTimeout.bind(global);
  const MutationObserver = global.MutationObserver;
  let fluidControllersInstalled = false;

  // Every animation path checks this fixed capability pair before invocation.
  const availableAnimate = runtime && typeof runtime.animate === "function" ? runtime.animate : null;
  const animate = /** @type {MotionRuntime["animate"]} */ (availableAnimate);
  const availableValue = runtime && typeof runtime.motionValue === "function" ? runtime.motionValue : null;
  const motionValue = /** @type {MotionRuntime["motionValue"]} */ (availableValue);
  const available = !!(availableAnimate && availableValue);

  const VOCABULARY = {
    gestureSettle: { type: "spring", stiffness: 600, damping: 40, mass: 1, restDelta: 0.5, restSpeed: 10 },
    gestureExit: { type: "spring", stiffness: 700, damping: 53, mass: 1, restDelta: 1, restSpeed: 40 },
    layoutShift: { type: "spring", stiffness: 600, damping: 48, mass: 1, restDelta: 0.5, restSpeed: 20 },
    /* A tapped or swiped page push. gestureExit's constants on purpose: critically
       damped, so a page lands without overshoot and a retarget mid-flight (an
       interrupted push, a back swipe committed from a release velocity) carries
       its speed. Its own name because no gesture drives a tapped push. */
    navPush: { type: "spring", stiffness: 700, damping: 53, mass: 1, restDelta: 1, restSpeed: 40 },
    revealIn: { duration: 0.2, ease: [0.2, 0.7, 0.2, 1] },
    revealOut: { duration: 0.15, ease: [0.4, 0, 0.8, 0.2] },
  };

  const reduceQuery = typeof global.matchMedia === "function"
    ? global.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
  const reducedMotion = () => !!reduceQuery?.matches;
  /** @param {number} vPerMs */
  const perSecond = vPerMs => (Number.isFinite(vPerMs) ? vPerMs * 1000 : 0);
  const settled = Promise.resolve(false);
  /* Motion's playback `then` discards what its callbacks return, and a stopped
     or replaced run may never settle at all. So "did this run arrive, or was it
     superseded" is resolved here: from `current()` when the animation finishes,
     or false at once when the owner calls `abandon()`. */
  /** @param {Playback} animation @param {()=>boolean} current @returns {Arrival} */
  const arrival = (animation, current) => {
    let abandon = () => {};
    const promise = /** @type {Arrival} */ (new Promise(resolve => {
      abandon = () => resolve(false);
      Promise.resolve(animation.then(() => resolve(!!current()), () => resolve(false))).catch(() => resolve(false));
    }));
    promise.abandon = abandon;
    return promise;
  };

  /** @param {HTMLElement|null} el @param {string|null} value */
  function hint(el, value) {
    if (!el) return;
    if (value) el.style.willChange = value;
    else el.style.removeProperty("will-change");
  }

  /* Apple's exponential projection from Designing Fluid Interfaces. Pointer
     velocity is kept in px/ms by app.js, so the original /1000 px/s conversion
     cancels and the projected distance is velocity * rate / (1-rate). */
  const PROJECTION_DECELERATION = 0.998;
  /** @param {number} position @param {number} velocityPerMs @param {number} [decelerationRate] */
  function projectMomentum(position, velocityPerMs, decelerationRate = PROJECTION_DECELERATION) {
    const positionNow = Number.isFinite(position) ? position : 0;
    const velocity = Number.isFinite(velocityPerMs) ? velocityPerMs : 0;
    const rate = Math.min(0.9999, Math.max(0, Number(decelerationRate) || 0));
    if (!rate || !velocity) return positionNow;
    return positionNow + velocity * rate / (1 - rate);
  }
  /** @template {{position:number}} T @param {number} projected @param {T[]} candidates @returns {T|null} */
  function nearestSnap(projected, candidates) {
    const points = (Array.isArray(candidates) ? candidates : []).filter(point => Number.isFinite(point?.position));
    if (!points.length) return null;
    return points.reduce((best, point) =>
      Math.abs(point.position - projected) < Math.abs(best.position - projected) ? point : best);
  }
  /** @param {number} overshoot @param {number} dimension @param {number} [constant] */
  function rubberband(overshoot, dimension, constant = 0.55) {
    const distance = Math.abs(Number(overshoot) || 0);
    const size = Math.max(1, Number(dimension) || 1);
    const resisted = distance * size * constant / (size + constant * distance);
    return Math.sign(overshoot || 1) * resisted;
  }

  /** @param {HTMLElement|null} sheet @param {HTMLElement|null} scrim */
  function trackSheetGesture(sheet, scrim, { from = 0 } = {}) {
    if (!available || !sheet) return null;
    const origin = Math.max(0, Number(from) || 0);
    const y = motionValue(origin);
    const height = sheet.offsetHeight || 1;
    /** @param {number} value */
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
      /** @param {number} dy */
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

  /* The presentation value of a pushed page being pulled back by its left edge.
     Same shape as the sheet tracker: the page follows the thumb, a release
     either settles it home on `gestureSettle` or commits it off the right edge
     on `navPush`, seeded with the release velocity. `takeover()` hands the live
     offset to the next grab without clearing it. */
  const EDGE_SWIPING = "is-edge-swiping";
  /** @param {HTMLElement|null} page */
  function trackEdgeSwipe(page, { from = 0 } = {}) {
    if (!available || !page) return null;
    const origin = Math.max(0, Number(from) || 0);
    const width = page.offsetWidth || global.innerWidth || 1;
    const x = motionValue(origin);
    /** @param {number} value */
    const paint = value => {
      page.style.transform = `translate3d(${Math.max(0, value)}px,0,0)`;
    };
    const stopPaint = x.on("change", paint);
    paint(origin);
    page.classList.add(EDGE_SWIPING);
    hint(page, "transform");

    let disposed = false;
    /** @type {Arrival|null} */
    let commitRun = null;
    const handOff = () => {
      page.style.transform = "";
      page.classList.remove(EDGE_SWIPING);
      hint(page, null);
    };
    const dispose = ({ preserve = false } = {}) => {
      if (disposed) return;
      disposed = true;
      commitRun?.abandon();
      x.stop();
      stopPaint();
      if (!preserve) handOff();
    };

    return {
      width,
      /** @param {number} dx */
      follow(dx) {
        if (disposed) return;
        x.set(Math.max(0, origin + (Number(dx) || 0)));
      },
      current: () => Math.max(0, x.get()),
      takeover() {
        const value = Math.max(0, x.get());
        dispose({ preserve: true });
        return value;
      },
      settle({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { dispose(); return settled; }
        return animate(x, 0, { ...VOCABULARY.gestureSettle, velocity: perSecond(velocity) })
          .then(() => { dispose(); return true; }, () => false);
      },
      /* Resolves true only if the page reached the edge: a takeover or a cancel
         that stops the spring first resolves false, and the caller then does
         not navigate. */
      commit({ velocity = 0 } = {}) {
        if (disposed) return settled;
        if (reducedMotion()) { x.set(width); return Promise.resolve(true); }
        commitRun = arrival(
          animate(x, width, { ...VOCABULARY.navPush, velocity: perSecond(velocity) }),
          () => !disposed
        );
        return commitRun;
      },
      cancel: dispose,
    };
  }

  /** @param {HTMLElement|null} track */
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

  /** @param {HTMLElement[]} rows @param {Map<string|undefined,{top:number}>} before */
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

  /* One element that travels between two places: the field outline, the ledger
     open-row outline, the dock lens, the Progress tab underline, the chart
     marker. The caller moves the element to its new place, then hands over the
     rect it measured before moving it. A single motion value counts the
     distance down in pixels, so `layoutShift`'s pixel-scale rest threshold
     applies, and the transform is derived from it. That makes the run
     retargetable: a second call while one is in flight starts from where the
     element is on screen now, not from where the first call began. */
  /** @type {WeakMap<Element,IndicatorRun>} */
  const indicatorRuns = new WeakMap();
  /* Runs asked for before the same frame start together on it, on one clock,
     so a pair that travels as one (the chart's dot and cursor line) stays in
     step. A run superseded before then never starts. */
  /** @type {Array<()=>void>|null} */
  let frameStarts = null;
  /** @param {()=>void} start */
  function startOnNextFrame(start) {
    if (!frameStarts) {
      frameStarts = [];
      requestAnimationFrame(() => {
        const due = frameStarts;
        frameStarts = null;
        for (const fn of /** @type {Array<()=>void>} */ (due)) fn();
      });
    }
    frameStarts.push(start);
  }
  /** @param {IndicatorRun} run */
  function indicatorRect(run) {
    const progress = run.distance ? Math.min(1, Math.max(0, run.y.get() / run.distance)) : 0;
    /** @param {keyof Rect} key */
    const mix = key => run.to[key] + (run.from[key] - run.to[key]) * progress;
    return { left: mix("left"), top: mix("top"), width: mix("width"), height: mix("height") };
  }
  /** @param {HTMLElement|null} el @param {Rect} fromRect */
  function animateIndicator(el, fromRect) {
    if (!el) return settled;
    const live = indicatorRuns.get(el);
    const start = live ? indicatorRect(live) : fromRect;
    if (live) { indicatorRuns.delete(el); live.y.stop(); live.stopPaint(); live.arrived?.abandon(); }
    el.style.transform = "";
    if (!available || reducedMotion()) {
      el.style.removeProperty("transform-origin");
      hint(el, null);
      return settled;
    }
    const to = el.getBoundingClientRect();
    /** @param {Rect} rect */
    const measured = rect => !!rect && ["left", "top", "width", "height"].every(key => Number.isFinite(rect[/** @type {keyof Rect} */(key)]));
    if (!measured(start) || !measured(to)) { hint(el, null); return settled; }
    const dx = start.left - to.left, dy = start.top - to.top;
    const sx = to.width > 0 ? start.width / to.width : 1;
    const sy = to.height > 0 ? start.height / to.height : 1;
    const distance = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(start.width - to.width), Math.abs(start.height - to.height));
    if (distance < 1) {
      el.style.removeProperty("transform-origin");
      hint(el, null);
      return settled;
    }

    const y = motionValue(distance);
    const run = /** @type {IndicatorRun} */ ({
      y, distance, from: { left: start.left, top: start.top, width: start.width, height: start.height },
      to: { left: to.left, top: to.top, width: to.width, height: to.height },
    });
    indicatorRuns.set(el, run);
    /** @param {number} value */
    const paint = value => {
      const progress = Math.min(1, Math.max(0, value / distance));
      el.style.transform = progress
        ? `translate3d(${dx * progress}px,${dy * progress}px,0) scale(${1 + (sx - 1) * progress},${1 + (sy - 1) * progress})`
        : "";
    };
    const stopPaint = y.on("change", paint);
    run.stopPaint = stopPaint;
    el.style.transformOrigin = "0 0";
    paint(distance);
    hint(el, "transform");
    /* The spring's clock starts on the next animation frame, not now. Work the
       caller still does before that frame (a tab change renders its view) would
       otherwise be spent as travel, and on a slow phone the first frame painted
       would show the element most of the way there (#404). */
    const started = new Promise(/** @param {(value:{animation:Playback})=>void} resolve */ resolve => {
      startOnNextFrame(() => {
        if (indicatorRuns.get(el) === run) resolve({ animation: animate(y, 0, VOCABULARY.layoutShift) });
      });
    });
    run.arrived = arrival(
      { then: (onArrive, onFail) => started.then(({ animation }) => animation.then(onArrive, onFail)) },
      () => indicatorRuns.get(el) === run
    );
    return run.arrived.finally(() => {
      stopPaint();
      if (indicatorRuns.get(el) !== run) return;
      indicatorRuns.delete(el);
      el.style.transform = "";
      el.style.removeProperty("transform-origin");
      hint(el, null);
    });
  }

  /* Chart coordinate travel (C2): a set of coordinates moving from one layout to
     another, painted by the caller. The caller owns the drawing (the Progress
     chart rebuilds its step path from the interpolated points on every frame),
     this owns the clock. One motion value counts the largest displacement down in
     pixels, so `layoutShift`'s pixel-scale rest threshold applies, and every
     coordinate moves by the same eased fraction of its own distance. `host` is
     the persistent element the run belongs to: a second call while one is in
     flight supersedes it, and the caller starts the new run from the coordinates
     it last painted. `paint(values, progress)` is called with the start layout
     before this returns, on every frame, and with the end layout on arrival; a
     run that is superseded is never painted again. Without the runtime, or under
     reduced motion, nothing is painted and the caller's end state stands. */
  /** @type {WeakMap<Element,ValueRun>} */
  const coordinateRuns = new WeakMap();
  /** @param {Element|null} host @param {number[]} from @param {number[]} to @param {(values:number[],progress:number)=>void} paint */
  function animateCoordinates(host, from, to, paint) {
    const live = host ? coordinateRuns.get(host) : null;
    if (live) { coordinateRuns.delete(/** @type {Element} */(host)); live.y.stop(); live.stopPaint(); live.arrived?.abandon(); }
    if (!available || !host || reducedMotion()) return settled;
    /** @param {unknown} list @returns {list is number[]} */
    const numbers = list => Array.isArray(list) && list.every(Number.isFinite);
    if (!numbers(from) || !numbers(to) || !from.length || from.length !== to.length || typeof paint !== "function") return settled;
    const distance = from.reduce((far, value, index) => Math.max(far, Math.abs(to[index] - value)), 0);
    if (!(distance >= 1)) return settled;

    const y = motionValue(distance);
    const run = /** @type {ValueRun} */ ({ y });
    coordinateRuns.set(host, run);
    /** @param {number} value */
    const frame = value => {
      const progress = Math.min(1, Math.max(0, 1 - value / distance));
      paint(from.map((start, index) => start + (to[index] - start) * progress), progress);
    };
    run.stopPaint = y.on("change", frame);
    frame(distance);
    run.arrived = arrival(animate(y, 0, VOCABULARY.layoutShift), () => coordinateRuns.get(host) === run);
    return run.arrived.finally(() => {
      run.stopPaint();
      if (coordinateRuns.get(host) !== run) return;
      coordinateRuns.delete(host);
      paint(to.slice(), 1);
    });
  }

  /* A tapped page push (N4 drill-downs, N5 Today to Focus) and its reverse. The
     page is the one that moves: "in" brings it from the right edge to rest, "out"
     carries it back off. One motion value is the page's offset in pixels, so
     `navPush`'s pixel-scale rest threshold applies, and a second call on the same
     page starts from where that page is on screen now: an interrupted push
     reverses without a jump, and `velocity` (px/ms) seeds the spring. The caller
     owns what sits underneath and keeps both pages mounted for the run. The
     promise resolves true when the page arrived (including at once, under reduced
     motion or without the runtime, where the page jumps and no transform is ever
     set) and false when the run was superseded or cancelled. The transform is
     cleared on arrival either way, before the caller's continuation runs. */
  /** @type {WeakMap<Element,PushRun>} */
  const pushRuns = new WeakMap();
  const trueNow = Promise.resolve(true);
  /** @param {HTMLElement|null} page */
  function animatePush(page, { direction = "in", velocity = 0 } = {}) {
    if (!page) return trueNow;
    const live = pushRuns.get(page);
    const start = live ? Math.max(0, live.x.get()) : null;
    if (live) { pushRuns.delete(page); live.x.stop(); live.stopPaint(); live.arrived?.abandon(); }
    if (!available || reducedMotion()) {
      page.style.transform = "";
      hint(page, null);
      return trueNow;
    }
    const out = direction === "out";
    const width = page.offsetWidth || global.innerWidth || 1;
    const from = start != null ? Math.min(start, width) : (out ? 0 : width);
    const to = out ? width : 0;
    const x = motionValue(from);
    const run = /** @type {PushRun} */ ({ x });
    pushRuns.set(page, run);
    /** @param {number} value */
    const paint = value => {
      page.style.transform = value > 0.01 ? `translate3d(${value}px,0,0)` : "";
    };
    run.stopPaint = x.on("change", paint);
    paint(from);
    hint(page, "transform");
    run.arrived = arrival(animate(x, to, { ...VOCABULARY.navPush, velocity: perSecond(velocity) }), () => pushRuns.get(page) === run);
    const done = /** @type {Promise<boolean> & {cancel?:()=>void}} */ (run.arrived.finally(() => {
      run.stopPaint();
      if (pushRuns.get(page) !== run) return;
      pushRuns.delete(page);
      page.style.transform = "";
      hint(page, null);
    }));
    done.cancel = () => {
      if (pushRuns.get(page) !== run) return;
      pushRuns.delete(page);
      /** @type {Arrival} */(run.arrived).abandon();
      x.stop();
      run.stopPaint();
      page.style.transform = "";
      hint(page, null);
    };
    return done;
  }

  /** @type {WeakMap<Element,{abandon?:()=>void}>} */
  const disclosureRuns = new WeakMap();
  const COLLAPSING = "is-collapsing";
  /* The measured-height run shared by a disclosure opening or closing and a slot
     swapping one content for another. A superseded run must not clear the
     replacement's inline height, so each run holds a token. */
  /** @param {HTMLElement} panel @param {number} from @param {number} to @param {AnimationOptions} tween */
  function runMeasuredHeight(panel, from, to, tween) {
    disclosureRuns.get(panel)?.abandon?.();
    /** @type {{abandon?:()=>void}} */
    const token = {};
    disclosureRuns.set(panel, token);
    panel.style.overflow = "hidden";
    // Hold the measured start while Motion schedules its first keyframe.
    panel.style.height = `${from}px`;
    hint(panel, "height");
    const arrived = arrival(
      animate(panel, { height: [`${from}px`, `${to}px`] }, tween),
      () => disclosureRuns.get(panel) === token
    );
    token.abandon = arrived.abandon;
    return arrived.finally(() => {
      if (disclosureRuns.get(panel) !== token) return;
      disclosureRuns.delete(panel);
      panel.classList.remove(COLLAPSING);
      panel.style.height = "";
      panel.style.overflow = "";
      hint(panel, null);
    });
  }
  /** @param {HTMLElement|null} panel @param {boolean} open @param {()=>void} applyVisualState */
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
    return runMeasuredHeight(panel, from, to, open ? VOCABULARY.revealIn : VOCABULARY.revealOut);
  }
  /* A measured slot whose content is swapped for other content, rather than
     opened or closed: the inline rest block replacing the cue, then the cue
     replacing it. `swap` runs exactly once, on every path, and the slot grows on
     `revealIn` and shrinks on `revealOut`. Called again mid-run it measures the
     live height, so the height reverses from where it is. The slot's own
     minimum height and the crossfade of the content are the caller's CSS. */
  /** @param {HTMLElement|null} slot @param {()=>void} swap */
  function animateSlot(slot, swap) {
    const apply = typeof swap === "function" ? swap : () => {};
    if (!available || !slot) { apply(); return null; }
    if (reducedMotion()) { apply(); return settled; }

    const from = slot.getBoundingClientRect().height;
    apply();
    slot.style.height = "";
    const to = slot.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) {
      slot.style.overflow = "";
      hint(slot, null);
      return settled;
    }
    return runMeasuredHeight(slot, from, to, to > from ? VOCABULARY.revealIn : VOCABULARY.revealOut);
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
  nav::before { display: none; }
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
  /** @type {Map<HTMLElement,NonNullable<ReturnType<typeof trackSheetGesture>>>} */
  const sheetRuns = new Map();
  /** @type {SheetGesture|null} */
  let sheetGesture = null;
  /** @type {FocusGesture|null} */
  let focusGesture = null;
  /** @type {FocusSlide|null} */
  let focusSlide = null;

  /** @param {Element|null} target */
  function visibleSheetFrom(target) {
    const sheet = /** @type {HTMLElement|null|undefined} */(target?.closest?.(".sheet.is-open"));
    return sheet && !sheet.hidden ? sheet : null;
  }
  function currentScrim() {
    const scrims = /** @type {HTMLElement[]} */([...document.querySelectorAll("[id$='Scrim'].is-open")]);
    return scrims[scrims.length - 1] || null;
  }
  /** @param {Element} target @param {HTMLElement} sheet */
  function sheetScrollHeld(target, sheet) {
    for (let node = /** @type {Element|null} */(target); node instanceof Element && node !== sheet; node = node.parentElement) {
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
  /** @param {PointerEvent} event */
  function sheetPointerDown(event) {
    if (sheetGesture) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const sheet = visibleSheetFrom(target);
    if (!target || !sheet) return;
    if (event.pointerType === "mouse" && (target.closest("input,select,textarea,[contenteditable]") || selection.isNativeTextSelectionTarget?.(target))) return;
    if (sheetScrollHeld(target, sheet)) return;
    sheetGesture = {
      id: event.pointerId, sheet, scrim: currentScrim(), x: event.clientX, y: event.clientY,
      anchorY: event.clientY, dy: 0, live: false, velocity: 0,
      lastY: event.clientY, lastT: event.timeStamp || performance.now(), motion: null,
    };
  }
  /** @param {PointerEvent} event */
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
  /** @param {HTMLElement} sheet */
  function dismissSheetByExistingPath(sheet) {
    sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  }
  /** @param {PointerEnd} event */
  function sheetPointerEnd(event) {
    const gesture = sheetGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    sheetGesture = null;
    if (!gesture.live) return;
    gesture.sheet.classList.remove("is-dragging");
    gesture.scrim?.classList.remove("is-dragging");
    try { gesture.sheet.releasePointerCapture?.(gesture.id); } catch {}
    if (gesture.dy > SHEET_LOCK) selection.swallowNextClick?.();

    const motion = gesture.motion;
    if (!motion || gesture.sheet.hidden || !gesture.sheet.classList.contains("is-open")) {
      motion?.cancel();
      if (sheetRuns.get(gesture.sheet) === motion) sheetRuns.delete(gesture.sheet);
      return;
    }
    // `pointercancel` is the browser taking the gesture away — a native scroll
    // or pan claimed it — not the lifter letting go. Nothing was committed, so
    // the sheet goes back to rest, and the velocity it had when it was taken is
    // not evidence of intent: projecting it can throw a 40px push past the
    // commitment distance and dismiss a sheet nobody released.
    const released = event?.type !== "pointercancel";
    const current = motion.current();
    const projected = released ? projectMomentum(current, gesture.velocity) : 0;
    const threshold = Math.min(160, Math.max(64, (gesture.sheet.offsetHeight || 0) * 0.32));
    const choice = nearestSnap(projected, [
      { position: 0, dismiss: false },
      { position: threshold * 2, dismiss: true },
    ]);
    if (choice?.dismiss) {
      motion.dismiss({ velocity: gesture.velocity });
      dismissSheetByExistingPath(gesture.sheet);
    } else {
      motion.settle({ velocity: released ? gesture.velocity : 0 }).finally(() => {
        if (sheetRuns.get(gesture.sheet) === motion) sheetRuns.delete(gesture.sheet);
      });
    }
  }

  /** @param {HTMLElement|null} el */
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
  function focusTrack() { return focus.track?.() || /** @type {HTMLElement|null} */(document.querySelector("#focusTrack")); }
  function focusCard() { return focus.card?.() || /** @type {HTMLElement|null} */(document.querySelector("#workout.is-focus .exercise.is-current")); }
  function focusStep() {
    const step = focus.step?.();
    return Number.isFinite(step) && /** @type {number} */(step) > 0 ? /** @type {number} */(step) : (focusCard()?.offsetWidth || 320) + 14;
  }
  /** @param {number} dir */
  function focusCanGo(dir) { return !!focus.canGo?.(dir); }
  /** @param {HTMLElement|null} track @param {number} value */
  function setFocusTrack(track, value) {
    if (focus.setTrack) focus.setTrack(track, value);
    else if (track) track.style.transform = `translate3d(${value}px,0,0)`;
  }
  /** @param {HTMLElement} track */
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
  /** @param {FocusSlide|null} run */
  function cleanupFocusSlide(run, { clearTransform = true } = {}) {
    if (!run) return;
    clearTimeout(/** @type {number|undefined} */(run.timer));
    run.track.classList.remove("is-settling");
    run.deck?.classList.remove("is-swiping");
    run.track.style.removeProperty("transition");
    if (clearTransform) run.track.style.transform = "";
    hint(run.track, null);
    if (focusSlide === run) focusSlide = null;
  }
  /** @param {FocusSlide|null} run */
  function finishFocusSlide(run) {
    if (!run || focusSlide !== run) return;
    const commit = run.commitDir;
    const queued = run.queuedDir;
    cleanupFocusSlide(run);
    if (commit) focus.go?.(commit);
    const owner=activeGestureController;
    if (commit && queued) requestAnimationFrame(() => {
      if(owner && activeGestureController===owner)owner.navigate(queued);
    });
  }
  /** @param {FocusSlide} run @param {number} target */
  function retargetFocusSlide(run, target) {
    freezeFocusPresentation(run.track);
    run.track.classList.add("is-settling");
    run.deck?.classList.add("is-swiping");
    run.track.getBoundingClientRect();
    setFocusTrack(run.track, target);
    clearTimeout(/** @type {number|undefined} */(run.timer));
    run.timer = setTimeout(() => finishFocusSlide(run), FOCUS_SLIDE_MS);
  }
  /** @param {number} dir @param {{from?:number|null}} [options] */
  function fluidFocusAnimateTo(dir, { from = null } = {}) {
    dir = Math.sign(Number(dir) || 0);
    if (!dir || !focusActive()) return false;
    if (reducedMotion()) {
      if (focusSlide) cleanupFocusSlide(focusSlide);
      return focusCanGo(dir) ? !!focus.go?.(dir) : false;
    }
    const track = focusTrack();
    const deck = /** @type {HTMLElement|null} */(document.querySelector("#focusDeck"));
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
    /** @type {FocusSlide} */
    const run = { track, deck, commitDir: dir, queuedDir: 0, timer: null };
    focusSlide = run;
    retargetFocusSlide(run, -dir * focusStep());
    return true;
  }
  function cancelFocusSlideForDrag() {
    const run = focusSlide;
    if (!run) return 0;
    const current = freezeFocusPresentation(run.track);
    clearTimeout(/** @type {number|undefined} */(run.timer));
    run.track.classList.remove("is-settling");
    run.deck?.classList.add("is-swiping");
    focusSlide = null;
    return current;
  }
  /** @param {PointerEvent} event */
  function focusPointerDown(event) {
    if (!focusActive() || focusGesture) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#focusDeck")) return;
    if (target.closest("input,select,textarea,[contenteditable]")) return;
    if (event.pointerType === "mouse" && selection.isNativeTextSelectionTarget?.(target)) return;
    const card = focusCard(), track = focusTrack(), deck = /** @type {HTMLElement|null} */(document.querySelector("#focusDeck"));
    if (!card || !track || !deck) return;
    const ledger = card.querySelector(".fcard__ledger");
    focusGesture = {
      id: event.pointerId, x: event.clientX, y: event.clientY, anchorX: event.clientX,
      dx: 0, axis: null, card, track, deck, baseX: 0,
      scrolls: [ledger, card.querySelector(".fcard__context")].some(el => el && el.scrollHeight > el.clientHeight + 1),
      velocity: 0, lastX: event.clientX, lastT: event.timeStamp || performance.now(),
    };
  }
  /** @param {PointerEvent} event */
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
  /** @param {PointerEnd} event */
  function focusPointerEnd(event) {
    const gesture = focusGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    focusGesture = null;
    if (gesture.axis !== "x") return;
    gesture.card.classList.remove("is-dragging");
    try { gesture.deck.releasePointerCapture?.(gesture.id); } catch {}
    if (Math.abs(gesture.dx) > 8) selection.swallowNextClick?.();

    // A cancelled pointer is not a release: the card returns to the one it was
    // on rather than advancing on momentum the lifter never committed.
    const released = event?.type !== "pointercancel";
    const step = focusStep();
    const projected = released ? projectMomentum(gesture.dx, gesture.velocity) : 0;
    const snaps = [{ position: 0, dir: 0 }];
    if (focusCanGo(-1)) snaps.push({ position: step, dir: -1 });
    if (focusCanGo(1)) snaps.push({ position: -step, dir: 1 });
    const choice = nearestSnap(projected, snaps) || snaps[0];
    if (!choice.dir) {
      gesture.track.classList.add("is-settling");
      const run = settleFocusDeck(gesture.track, { from: gesture.dx, velocity: released ? gesture.velocity : 0 });
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

  /* The third gesture owner: an interactive edge swipe back on a pushed page.
     It is inert until a page registers itself, so no view is affected by it
     existing. It never starts in Focus, whose horizontal axis belongs to the
     deck, and only where `display-mode: standalone` matches: in a Safari tab
     the left edge belongs to the browser's own history gesture, and the visible
     back control stays the primary route everywhere. */
  const EDGE_ZONE = 24;
  const EDGE_LOCK = 10;
  const EDGE_STALE_MS = 100;
  /** @type {EdgeTarget|null} */
  let edgeTarget = null;
  /** @type {EdgeGesture|null} */
  let edgeGesture = null;
  /** @type {ReturnType<typeof trackEdgeSwipe>} */
  let edgeRun = null;

  function standaloneDisplay() {
    try { return !!global.matchMedia?.("(display-mode: standalone)")?.matches; } catch { return false; }
  }
  function edgeBlockedByOverlay() {
    return document.body.classList.contains("is-sheet-open") || !!document.querySelector("dialog[open]");
  }
  function cancelEdgeSwipe() {
    const gesture = edgeGesture;
    edgeGesture = null;
    if (gesture) {
      try { gesture.page.releasePointerCapture?.(gesture.id); } catch {}
      gesture.motion?.cancel();
    }
    const run = edgeRun;
    edgeRun = null;
    run?.cancel();
  }
  /** @param {Partial<EdgeTarget>} [options] */
  function registerEdgeSwipeBack({ page, onCommit } = {}) {
    if (!available || !(page instanceof Element) || typeof onCommit !== "function") return null;
    cancelEdgeSwipe();
    const registration = { page, onCommit };
    edgeTarget = registration;
    return {
      dispose() {
        if (edgeTarget !== registration) return;
        cancelEdgeSwipe();
        edgeTarget = null;
      },
    };
  }
  /* The edge zone is 24px wide but a page sits inside <main>'s own padding, so a
     finger at x=4 lands on <main>, not on the page. A press counts when it lands
     on the page, or on something that wraps it, at a height the page occupies
     (R7 J-11). The dock, a sheet or a sibling page are never ancestors of the
     page, so none of them can start a swipe this way. */
  /** @param {HTMLElement} page @param {PointerEvent} event */
  function edgeHitsPage(page, event) {
    const hit = event.target;
    if (!(hit instanceof Element)) return false;
    if (page.contains(hit)) return true;
    if (!hit.contains(page)) return false;
    const rect = page.getBoundingClientRect();
    return event.clientY >= rect.top && event.clientY <= rect.bottom;
  }
  /** @param {PointerEvent} event */
  function edgePointerDown(event) {
    const target = edgeTarget;
    if (!target || edgeGesture) return;
    if (event.pointerType === "mouse") return;
    if (!(event.clientX <= EDGE_ZONE)) return;
    if (focusActive() || !standaloneDisplay() || edgeBlockedByOverlay()) return;
    const { page } = target;
    if (!page.isConnected || page.hidden) return;
    if (!edgeHitsPage(page, event)) return;
    edgeGesture = {
      id: event.pointerId, page, target, x: event.clientX, y: event.clientY, dx: 0, live: false,
      velocity: 0, lastX: event.clientX, lastT: event.timeStamp || performance.now(), motion: null,
    };
  }
  /** @param {PointerEvent} event */
  function edgePointerMove(event) {
    const gesture = edgeGesture;
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!gesture.page.isConnected || gesture.page.hidden || focusActive()) { cancelEdgeSwipe(); return; }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.live) {
      if (dx <= -EDGE_LOCK || (Math.abs(dy) >= EDGE_LOCK && Math.abs(dy) >= Math.abs(dx))) {
        edgeGesture = null; return;
      }
      if (dx < EDGE_LOCK) return;
      gesture.live = true;
      try { gesture.page.setPointerCapture?.(gesture.id); } catch {}
      const previous = edgeRun;
      const from = previous?.takeover?.() || 0;
      edgeRun = null;
      gesture.motion = trackEdgeSwipe(gesture.page, { from });
      if (!gesture.motion) { edgeGesture = null; return; }
    }
    const now = event.timeStamp || performance.now();
    const dt = now - gesture.lastT;
    if (dt > 0) {
      gesture.velocity = (event.clientX - gesture.lastX) / dt;
      gesture.lastX = event.clientX;
      gesture.lastT = now;
    }
    gesture.dx = Math.max(0, dx);
    /** @type {NonNullable<typeof gesture.motion>} */(gesture.motion).follow(gesture.dx);
  }
  /** @param {PointerEnd} event */
  function edgePointerEnd(event) {
    const gesture = edgeGesture;
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.id)) return;
    edgeGesture = null;
    if (!gesture.live) return;
    try { gesture.page.releasePointerCapture?.(gesture.id); } catch {}
    if (gesture.dx > 8) selection.swallowNextClick?.();

    const motion = gesture.motion;
    if (!motion || !gesture.page.isConnected || gesture.page.hidden) { motion?.cancel(); return; }
    // `pointercancel` is the browser taking the gesture away, not the lifter
    // letting go. Nothing was committed, so the page goes home and the velocity
    // it had is not evidence of intent.
    const released = event?.type !== "pointercancel";
    // A thumb that stopped before lifting has no velocity worth carrying: the
    // last sample is how fast it was going, not how fast it left.
    const stalled = (event?.timeStamp || performance.now()) - gesture.lastT > EDGE_STALE_MS;
    const velocity = released && !stalled ? gesture.velocity : 0;
    const projected = released ? projectMomentum(motion.current(), velocity) : 0;
    const choice = nearestSnap(projected, [
      { position: 0, commit: false },
      { position: motion.width, commit: true },
    ]);
    edgeRun = motion;
    if (released && choice?.commit) {
      motion.commit({ velocity }).then(arrived => {
        if (!arrived || edgeRun !== motion) return;
        edgeRun = null;
        try { gesture.target.onCommit(); } finally { motion.cancel(); }
      });
    } else {
      motion.settle({ velocity }).finally(() => {
        if (edgeRun === motion) edgeRun = null;
      });
    }
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
    if (edgeGesture && (!edgeGesture.page.isConnected || edgeGesture.page.hidden)) cancelEdgeSwipe();
  }
  function normalizeInstallBannerSemantics() {
    const banner = document.getElementById("installBanner");
    if (banner?.getAttribute("role") === "dialog") banner.setAttribute("role", "region");
  }
  /** @type {GestureController|null} */
  let activeGestureController = null;

  function mountGestureController() {
    if (activeGestureController) return activeGestureController;

    if (!available) {
      const mountedFallback=fallback.mount();
      const controller={isFluid:false,navigate:/** @param {number} dir */ dir=>activeGestureController===controller && fallback.navigate(dir),dispose(){
        mountedFallback.dispose();
        if(activeGestureController===controller)activeGestureController=null;
      }};
      activeGestureController=controller;
      return controller;
    }
    const useFluid = available;
    const workout = document.getElementById("workout");

    /** @param {KeyboardEvent} event */
    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      if (focusSlide) cleanupFocusSlide(focusSlide);
      if (focusGesture) focusPointerEnd({pointerId:focusGesture.id,type:"pointercancel"});
      if (sheetGesture) clearSheetGesture({ clearRun: true });
      cancelEdgeSwipe();
      for (const [sheet, motion] of sheetRuns) {
        if (!sheet.hidden && sheet.classList.contains("is-open")) {
          motion?.cancel();
          sheetRuns.delete(sheet);
        }
      }
    }

    /** @type {MutationObserver|null} */
    let observer = null;
    if (useFluid && typeof MutationObserver === "function" && document.body) {
      observer = new MutationObserver(cancelSheetRunsThatClosed);
      observer.observe(document.body, {
        subtree: true, attributes: true, attributeFilter: ["class", "hidden"],
      });
    }

    const sDown = useFluid ? sheetPointerDown : sheets.dragStart;
    const sMove = useFluid ? sheetPointerMove : sheets.dragMove;
    const sEnd = useFluid ? sheetPointerEnd : sheets.dragEnd;

    const fDown = useFluid ? focusPointerDown : focus.dragStart;
    const fMove = useFluid ? focusPointerMove : focus.dragMove;
    const fEnd = useFluid ? focusPointerEnd : focus.dragEnd;

    if (sDown) document.addEventListener("pointerdown", sDown);
    if (sMove) global.addEventListener("pointermove", sMove, { passive: true });
    if (sEnd) {
      global.addEventListener("pointerup", sEnd);
      global.addEventListener("pointercancel", sEnd);
    }

    if (fDown && workout) workout.addEventListener("pointerdown", fDown);
    if (fMove) global.addEventListener("pointermove", fMove, { passive: true });
    if (fEnd) {
      global.addEventListener("pointerup", fEnd);
      global.addEventListener("pointercancel", fEnd);
    }

    if (useFluid) {
      document.addEventListener("pointerdown", edgePointerDown);
      global.addEventListener("pointermove", edgePointerMove, { passive: true });
      global.addEventListener("pointerup", edgePointerEnd);
      global.addEventListener("pointercancel", edgePointerEnd);
      document.addEventListener("keydown", onKeyDown, true);
      fluidControllersInstalled = true;
    }


    let disposed = false;
    const controller = {
      isFluid: useFluid,
      navigate: /** @param {number} dir */ dir => !disposed && (useFluid ? fluidFocusAnimateTo(dir) : fallback.navigate?.(dir)),
      dispose() {
        if (disposed) return;
        disposed = true;

        if (focusSlide) cleanupFocusSlide(focusSlide);
        if (sheetGesture) clearSheetGesture({ clearRun: true });
        cancelEdgeSwipe();
        if (focusGesture) {
          const g = focusGesture;
          focusGesture = null;
          g.card?.classList.remove("is-dragging");
          try { g.deck?.releasePointerCapture?.(g.id); } catch {}
          setFocusTrack(g.track, 0);
          g.track?.classList.remove("is-settling");
          g.deck?.classList.remove("is-swiping");
        }
        for (const [sheet, motion] of sheetRuns) {
          motion?.cancel();
        }
        sheetRuns.clear();

        if (observer) observer.disconnect();

        if (sDown) document.removeEventListener("pointerdown", sDown);
        if (sMove) global.removeEventListener("pointermove", sMove);
        if (sEnd) {
          global.removeEventListener("pointerup", sEnd);
          global.removeEventListener("pointercancel", sEnd);
        }

        if (fDown && workout) workout.removeEventListener("pointerdown", fDown);
        if (fMove) global.removeEventListener("pointermove", fMove);
        if (fEnd) {
          global.removeEventListener("pointerup", fEnd);
          global.removeEventListener("pointercancel", fEnd);
        }

        if (useFluid) {
          document.removeEventListener("pointerdown", edgePointerDown);
          global.removeEventListener("pointermove", edgePointerMove);
          global.removeEventListener("pointerup", edgePointerEnd);
          global.removeEventListener("pointercancel", edgePointerEnd);
          document.removeEventListener("keydown", onKeyDown, true);
          fluidControllersInstalled = false;
        }

        if (activeGestureController === controller) {
          activeGestureController = null;
        }
      }
    };

    activeGestureController = controller;
    return controller;
  }

  function installFluidControllers() {
    return mountGestureController();
  }


  function mount() {
    installPreferenceStyles();
    normalizeInstallBannerSemantics();
    return mountGestureController();
  }
  function dispose() {
    activeGestureController?.dispose();
    cancelEdgeSwipe();
    edgeTarget = null;
  }
  return Object.freeze({
    available: () => available,
    reducedMotion,
    vocabulary: VOCABULARY,
    projectMomentum,
    nearestSnap,
    trackSheetGesture,
    settleFocusDeck,
    animateExerciseReorder,
    animateIndicator,
    animateCoordinates,
    animateDisclosure,
    animateSlot,
    animatePush,
    registerEdgeSwipeBack,
    /** @param {number} direction */
    navigate:direction=>activeGestureController?.navigate(direction)||false,
    mountGestureController,
    mount,
    dispose,
  });

}
