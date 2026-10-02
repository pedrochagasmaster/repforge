#!/usr/bin/env node
/* The motion vocabulary added for Plan 064 rule 11, proved offline.
 *
 * `motion-layer.js` is evaluated in a sandbox over a runtime whose clock the
 * test owns, so an interruption can be placed exactly mid-flight. Covered here:
 * `animateIndicator` (travel, retarget from the live transform, reduced motion,
 * no runtime), `animateCoordinates` (the chart's coordinate travel: painted from
 * the start layout, supersession, reduced motion), `animateSlot` (the swap runs once on every path, grow and shrink
 * pick the right tween, an interrupted run reverses from the live height),
 * `navPush` (critically damped, no overshoot, seedable) and the rule that no
 * spring literal exists at a call site. The browser-side proofs of the same
 * helpers are in `test/motion-integration.mjs`; the edge-swipe owner is proved
 * in `test/sheet-swipe-dismiss.mjs`. No browser, network or dependency. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(join(ROOT, file), "utf8");
const layer = read("motion-layer.js");
let passed = 0, failed = 0;
function assert(condition, name, detail = "") {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}`); if (detail) console.log(`    ${detail}`); }
}
const near = (a, b, tolerance = 0.01) => Math.abs(a - b) <= tolerance;
/* A helper that does not exist yet must fail its own section, not stop the file. */
async function section(body) {
  try { await body(); } catch (error) { failed++; console.log(`  ✗ the section threw: ${error.message}`); }
}

/* A runtime the test steps by hand. `animate` records the run and returns a
   promise the test settles. As in the real runtime, a run that is stopped or
   replaced never settles on its own; the layer has to report it as not arrived. */
function load({ withRuntime = true } = {}) {
  const runs = [];
  const query = { matches: false };
  const runtime = {
    motionValue(initial) {
      let value = initial;
      const listeners = new Set();
      const mv = {
        pending: null,
        get: () => value,
        set(next) { value = next; for (const fn of listeners) fn(value); },
        stop() { mv.pending = null; },
        on(_event, fn) { listeners.add(fn); return () => listeners.delete(fn); },
      };
      return mv;
    },
    animate(target, to, options) {
      const run = { target, to, options, settled: false };
      run.promise = new Promise((resolve, reject) => { run.resolve = resolve; run.reject = reject; });
      runs.push(run);
      /* A new animation of the same target replaces the old one, as in the real runtime. */
      target.pending = run;
      return run.promise;
    },
  };
  const sandbox = {
    document: { readyState: "loading", getElementById: () => null, createElement: () => ({}), head: { append() {} }, addEventListener() {} },
    matchMedia: () => query,
  };
  if (withRuntime) sandbox.Motion = runtime;
  vm.runInNewContext(layer, sandbox, { filename: "motion-layer.js", timeout: 1000 });
  const arrive = run => { run.target.set?.(run.to); if (run.target.pending === run) run.target.pending = null; run.resolve(); };
  return { api: sandbox.RepForgeMotion, runs, query, arrive };
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

/* An element with a layout box and the geometry a transform gives it, so the
   layer's measurements (transform-origin 0 0) read what a browser would. */
function box(rect) {
  const el = {
    layout: { ...rect },
    style: {
      transform: "", transformOrigin: "", willChange: "", height: "", overflow: "",
      removeProperty(name) { this[name === "will-change" ? "willChange" : name === "transform-origin" ? "transformOrigin" : name] = ""; },
    },
    classList: { add() {}, remove() {}, toggle() {} },
    getBoundingClientRect() {
      const m = /translate3d\(([-\d.e]+)px,([-\d.e]+)px,0\) scale\(([-\d.e]+),([-\d.e]+)\)/.exec(el.style.transform);
      const [tx, ty, sx, sy] = m ? m.slice(1).map(Number) : [0, 0, 1, 1];
      return { left: el.layout.left + tx, top: el.layout.top + ty, width: el.layout.width * sx, height: el.layout.height * sy };
    },
  };
  return el;
}
const rectOf = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

console.log("animateIndicator");
await section(async () => {
  const t = load();
  assert(typeof t.api.animateIndicator === "function", "the layer publishes animateIndicator");
  const el = box({ left: 200, top: 10, width: 50, height: 2 });
  const from = { left: 100, top: 10, width: 80, height: 2 };
  const done = t.api.animateIndicator(el, from);
  const run = t.runs[0];
  assert(t.runs.length === 1 && run.to === 0, "one run counts the distance down to zero");
  assert(JSON.stringify(run.options) === JSON.stringify(t.api.vocabulary.layoutShift), "it travels on the layoutShift entry, not a literal");
  const first = rectOf(el);
  assert(near(first.left, 100) && near(first.width, 80) && near(first.top, 10),
    "the first frame sits exactly where the element was", JSON.stringify(first));
  assert(el.style.transformOrigin === "0 0" && el.style.willChange === "transform", "the transform is promoted for the run only");
  run.target.set(run.target.get() / 2);
  const half = rectOf(el);
  assert(near(half.left, 150) && near(half.width, 65), "halfway through the distance it is halfway between the two rects", JSON.stringify(half));
  t.arrive(run);
  assert(await done === true, "it resolves true when it arrives");
  assert(el.style.transform === "" && el.style.transformOrigin === "" && el.style.willChange === "",
    "an arrived indicator carries no inline transform, origin or layer hint", JSON.stringify(el.style));
});
await section(async () => {
  // Interrupted mid-flight: the indicator is part-way along, and layout moves it again.
  const t = load();
  const el = box({ left: 200, top: 10, width: 50, height: 2 });
  const first = t.api.animateIndicator(el, { left: 100, top: 10, width: 80, height: 2 });
  const run1 = t.runs[0];
  run1.target.set(50);
  const live = rectOf(el);
  assert(near(live.left, 150), "the first run is part-way (left 150) when it is interrupted", JSON.stringify(live));
  // The next layout puts the element at left 300. A caller that hands over a stale
  // layout rect must still start the new run from where the element is on screen.
  el.layout = { left: 300, top: 10, width: 70, height: 2 };
  const second = t.api.animateIndicator(el, { left: 200, top: 10, width: 50, height: 2 });
  const run2 = t.runs[1];
  const start = rectOf(el);
  assert(near(start.left, 150) && near(start.width, 65),
    "the second run starts from the live transform, not from the rect the caller passed", JSON.stringify(start));
  assert(await first === false, "the superseded run reports that it did not arrive");
  assert(run2 !== run1 && near(run2.target.get(), 150), "the retarget counts down its own, longer distance", String(run2.target.get()));
  assert(el.style.transform !== "", "the superseded run's clean-up did not clear the replacement's transform");
  t.arrive(run2);
  assert(await second === true && el.style.transform === "" && el.style.willChange === "",
    "the replacement arrives and leaves nothing behind", JSON.stringify(el.style));
});
await section(async () => {
  // Retargeting with no caller rect still works from the live transform alone.
  const t = load();
  const el = box({ left: 40, top: 0, width: 10, height: 10 });
  t.api.animateIndicator(el, { left: 0, top: 0, width: 10, height: 10 });
  t.runs[0].target.set(20);
  const live = rectOf(el);
  el.layout = { left: 90, top: 0, width: 10, height: 10 };
  t.api.animateIndicator(el, null);
  assert(near(rectOf(el).left, live.left), "a null from-rect retargets from where the element is", `${rectOf(el).left} vs ${live.left}`);
});
await section(async () => {
  const t = load();
  const el = box({ left: 10, top: 10, width: 40, height: 4 });
  const still = t.api.animateIndicator(el, { left: 10.3, top: 10, width: 40, height: 4 });
  assert(await still === false && t.runs.length === 0 && el.style.transform === "", "a move under one pixel is not animated");
  assert(await t.api.animateIndicator(null, { left: 0, top: 0, width: 1, height: 1 }) === false, "a missing element is ignored");
  assert(await t.api.animateIndicator(el, { left: NaN, top: 0, width: 1, height: 1 }) === false && t.runs.length === 0,
    "an unmeasurable rect is ignored rather than animated from NaN");
});
await section(async () => {
  const t = load();
  const el = box({ left: 200, top: 10, width: 50, height: 2 });
  t.api.animateIndicator(el, { left: 100, top: 10, width: 80, height: 2 });
  const run = t.runs[0];
  t.query.matches = true;
  const result = await t.api.animateIndicator(el, { left: 0, top: 10, width: 50, height: 2 });
  assert(result === false && t.runs.length === 1, "under reduced motion no run starts");
  assert(el.style.transform === "" && el.style.willChange === "" && el.style.transformOrigin === "",
    "and a run already in flight is cleared: the indicator jumps to the end state", JSON.stringify(el.style));
  assert(run.target.pending === null, "the interrupted run is stopped");
  t.query.matches = false;
});
await section(async () => {
  const t = load({ withRuntime: false });
  const el = box({ left: 200, top: 10, width: 50, height: 2 });
  const result = await t.api.animateIndicator(el, { left: 100, top: 10, width: 80, height: 2 });
  assert(result === false && el.style.transform === "", "without the runtime the element simply sits in its new place");
});

console.log("\nanimateCoordinates");
/* The Progress chart's scope change (C2): the caller paints, the layer owns the clock. */
await section(async () => {
  const t = load();
  assert(typeof t.api.animateCoordinates === "function", "the layer publishes animateCoordinates");
  const host = {}, frames = [];
  const done = t.api.animateCoordinates(host, [0, 100, 40, 60], [100, 100, 40, 20], (values, progress) => frames.push({ values, progress }));
  const run = t.runs[0];
  assert(t.runs.length === 1 && run.to === 0 && near(run.target.get(), 100), "one run counts the largest displacement (100) down to zero", String(run.target.get()));
  assert(JSON.stringify(run.options) === JSON.stringify(t.api.vocabulary.layoutShift), "it travels on the layoutShift entry, not a literal");
  assert(frames.length === 1 && frames[0].progress === 0 && frames[0].values.join() === "0,100,40,60",
    "the start layout is painted before it returns, so the end state is never seen first", JSON.stringify(frames[0]));
  run.target.set(50);
  const half = frames.at(-1);
  assert(near(half.progress, 0.5) && half.values.join() === "50,100,40,40", "halfway through the distance every coordinate is halfway", JSON.stringify(half));
  assert(half.values[1] === 100 && half.values[2] === 40, "a coordinate that does not move stays put");
  t.arrive(run);
  assert(await done === true, "it resolves true when it arrives");
  const last = frames.at(-1);
  assert(last.progress === 1 && last.values.join() === "100,100,40,20", "the end layout is painted exactly on arrival", JSON.stringify(last));
});
await section(async () => {
  // A second run on the same host supersedes the first, which is never painted again.
  const t = load();
  const host = {}, first = [], second = [];
  const one = t.api.animateCoordinates(host, [0, 0], [100, 0], (v) => first.push(v.slice()));
  const run1 = t.runs[0];
  run1.target.set(40);
  const seen = first.length;
  const two = t.api.animateCoordinates(host, [60, 0], [0, 0], (v) => second.push(v.slice()));
  const run2 = t.runs[1];
  assert(await one === false, "the superseded run reports that it did not arrive");
  run1.target.set(10);
  assert(first.length === seen, "and is not painted after it is superseded", `${first.length} vs ${seen}`);
  assert(second[0].join() === "60,0" && near(run2.target.get(), 60), "the next run starts from the layout the caller hands it", JSON.stringify(second[0]));
  t.arrive(run2);
  assert(await two === true && second.at(-1).join() === "0,0", "and arrives on its own end layout");
});
await section(async () => {
  const t = load();
  const host = {}, paint = () => { throw new Error("painted"); };
  assert(await t.api.animateCoordinates(host, [0, 0], [0.4, 0], paint) === false && t.runs.length === 0, "a move under one pixel is not animated");
  assert(await t.api.animateCoordinates(host, [0, 0], [10], paint) === false && t.runs.length === 0, "mismatched layouts are ignored");
  assert(await t.api.animateCoordinates(host, [NaN], [10], paint) === false && t.runs.length === 0, "an unmeasurable layout is ignored rather than animated from NaN");
  assert(await t.api.animateCoordinates(null, [0], [10], paint) === false && t.runs.length === 0, "a missing host is ignored");
  assert(await t.api.animateCoordinates(host, [], [], paint) === false && t.runs.length === 0, "an empty layout is ignored");
});
await section(async () => {
  const t = load();
  const host = {}, painted = [];
  t.api.animateCoordinates(host, [0], [100], (v) => painted.push(v.slice()));
  const run = t.runs[0];
  t.query.matches = true;
  const result = await t.api.animateCoordinates(host, [0], [100], (v) => painted.push(v.slice()));
  assert(result === false && t.runs.length === 1 && painted.length === 1, "under reduced motion no run starts and nothing is painted");
  assert(run.target.pending === null, "a run already in flight is stopped: the caller's end state stands");
  t.query.matches = false;
});
await section(async () => {
  const t = load({ withRuntime: false });
  let painted = 0;
  assert(await t.api.animateCoordinates({}, [0], [100], () => painted++) === false && painted === 0, "without the runtime nothing is painted and the end state stands");
});

console.log("\nanimateSlot");
function slot(natural) {
  const el = {
    natural, style: { height: "", overflow: "", willChange: "", removeProperty(name) { this[name === "will-change" ? "willChange" : name] = ""; } },
    classList: { add() {}, remove() {}, toggle() {} },
    getBoundingClientRect() {
      const inline = /^([\d.]+)px$/.exec(el.style.height);
      return { height: inline ? Number(inline[1]) : el.natural };
    },
  };
  return el;
}
await section(async () => {
  const t = load();
  assert(typeof t.api.animateSlot === "function", "the layer publishes animateSlot");
  const el = slot(40);
  let swaps = 0;
  const growing = t.api.animateSlot(el, () => { swaps++; el.natural = 120; });
  const run = t.runs[0];
  assert(swaps === 1, "the swap runs exactly once");
  assert(run.target === el && run.to.height[0] === "40px" && run.to.height[1] === "120px", "the slot animates from its old height to its new one", JSON.stringify(run.to));
  assert(JSON.stringify(run.options) === JSON.stringify(t.api.vocabulary.revealIn), "growing uses revealIn");
  assert(el.style.overflow === "hidden" && el.style.willChange === "height", "the slot clips and is promoted while it moves");
  t.arrive(run);
  assert(await growing === true && el.style.height === "" && el.style.overflow === "" && el.style.willChange === "",
    "settled, it carries no inline height, overflow or layer hint", JSON.stringify(el.style));
  el.natural = 120;
  t.api.animateSlot(el, () => { swaps++; el.natural = 40; });
  const shrink = t.runs[1];
  assert(swaps === 2 && JSON.stringify(shrink.options) === JSON.stringify(t.api.vocabulary.revealOut), "shrinking uses revealOut, and the swap ran once more");
});
await section(async () => {
  // Interrupted: swap back while the slot is 70px of the way to 120.
  const t = load();
  const el = slot(40);
  const first = t.api.animateSlot(el, () => { el.natural = 120; });
  el.style.height = "70px";
  const second = t.api.animateSlot(el, () => { el.natural = 40; });
  const run2 = t.runs[1];
  assert(run2.to.height[0] === "70px" && run2.to.height[1] === "40px", "an interrupted slot reverses from its live height", JSON.stringify(run2.to));
  assert(await first === false, "the superseded run reports that it did not finish");
  t.arrive(run2);
  assert(await second === true && el.style.height === "" && el.style.overflow === "",
    "the reversal settles with no inline geometry", JSON.stringify(el.style));
});
await section(async () => {
  const t = load();
  const el = slot(40);
  let swaps = 0;
  const same = t.api.animateSlot(el, () => { swaps++; });
  assert(swaps === 1 && await same === false && t.runs.length === 0, "a swap that does not change the height animates nothing");
  t.query.matches = true;
  el.natural = 40;
  const reduced = await t.api.animateSlot(el, () => { swaps++; el.natural = 90; });
  assert(swaps === 2 && reduced === false && t.runs.length === 0 && el.style.height === "", "under reduced motion the content swaps with no run");
  t.query.matches = false;
  const bare = load({ withRuntime: false });
  let bareSwaps = 0;
  const result = bare.api.animateSlot(slot(40), () => { bareSwaps++; });
  assert(bareSwaps === 1 && result === null, "without the runtime the content still swaps once");
  assert(bare.api.animateSlot(null, () => { bareSwaps++; }) === null && bareSwaps === 2, "a missing slot still runs the swap");
});

console.log("\nnavPush");
await section(async () => {
  const t = load();
  const { navPush, gestureExit } = t.api.vocabulary;
  assert(navPush && navPush.type === "spring" && JSON.stringify(navPush) === JSON.stringify(gestureExit),
    "navPush is gestureExit's constants under its own name");
  const zeta = navPush.damping / (2 * Math.sqrt(navPush.stiffness * navPush.mass));
  assert(zeta >= 1 && zeta <= 1.05, "it is critically damped, so a page lands without overshoot", zeta.toFixed(3));
  // Integrate the spring the way the runtime does: a push across a 390px screen.
  const simulate = velocity => {
    let x = 0, v = velocity, time = 0, peak = 0;
    const dt = 0.0005, to = 390;
    while (time < 2) {
      v += (-navPush.stiffness * (x - to) - navPush.damping * v) * dt;
      x += v * dt; time += dt; peak = Math.max(peak, x);
      if (Math.abs(x - to) <= navPush.restDelta && Math.abs(v) <= navPush.restSpeed) break;
    }
    return { ms: Math.round(time * 1000), peak: Math.round(peak * 10) / 10 };
  };
  const rest = simulate(0), thrown = simulate(3000), backwards = simulate(-1500);
  assert(rest.peak <= 390 && thrown.peak <= 390.5 && backwards.peak <= 390, "seeded with any release velocity it never passes the target",
    JSON.stringify({ rest, thrown, backwards }));
  assert([rest, thrown, backwards].every(r => r.ms >= 150 && r.ms <= 340), "and it comes to rest inside the time a push may take",
    JSON.stringify({ rest, thrown, backwards }));
});

console.log("\nno spring literal at a call site");
await section(async () => {
  const vocab = layer.slice(layer.indexOf("const VOCABULARY"), layer.indexOf("};", layer.indexOf("const VOCABULARY")));
  const outside = layer.replace(vocab, "");
  assert(!/stiffness|damping|restDelta|restSpeed/.test(outside), "no spring parameter appears in the layer outside the vocabulary");
  for (const file of ["app.js", "program-editor.js", "history-ui.js"]) {
    assert(!/\bstiffness\b|type\s*:\s*["']spring["']/.test(read(file)), `${file} declares no spring`);
  }
  for (const name of ["animateIndicator", "animateCoordinates", "animateSlot", "animatePush", "trackEdgeSwipe"]) {
    const start = layer.indexOf(`function ${name}(`);
    const body = layer.slice(start, layer.indexOf("\n  }\n", start));
    assert(start > 0 && /VOCABULARY\.\w+/.test(body), `${name} takes its timing from the named vocabulary`);
  }
  assert(!/\bwindow\.Motion\b|\broot\.Motion\b|\bMotion\.animate\b/.test(read("app.js")), "application code still cannot reach window.Motion");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
