#!/usr/bin/env node
/**
 * The rest timer redesign (owner-approved mock, 2026-10-23), driven through the real Focus screen:
 *
 *   - the header is the same height with no rest, during a rest and after the bell (no rest pill in it);
 *   - the rest tab exists only during or after a rest, and a logged set raises it;
 *   - every capability still works from the sheet behind the tab: -30s, +30s, Pause and Resume, a preset, Restart and
 *     End rest; with no rest, the actions sheet's Rest timer row opens it on Start, and Start starts one;
 *   - depletion is continuous: the tab's ring and the shelf's edge differ between two frames 100 ms apart;
 *   - the bell plays one soft flick, once, and none under reduced motion;
 *   - a bell that passes while the page is hidden shows the done state on return, with no flick.
 *
 * Run: node test/rest-timer.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { installSeedProgram, seedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function focusPage(browser, { reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", isMobile: true, hasTouch: true, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => { const r = indexedDB.deleteDatabase("repforge"); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), seedProgram()[0].day);
  await page.waitForSelector("#workout.is-focus .exercise.is-current .focus-shelf", { timeout: 10000 });
  await page.evaluate(() => window.__repforgeGuides?.dismissAll?.());
  return { context, page, errors };
}

/** Fill the current set's fields through the draft and log it with the shelf's own button. */
async function logSet(page) {
  await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft, draft = api.current(), id = draft.session.selectedExerciseId;
    const ex = draft.exercises[id], setId = ex.setOrder.find((sid) => ex.sets[sid].completion === "pending" && ex.sets[sid].role !== "warmup");
    const set = ex.sets[setId];
    if (Array.isArray(set.programmed.metrics)) {
      for (const metric of set.programmed.metrics) {
        await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: metric.id, value: /rep/i.test(metric.semantic || "") ? "8" : "60" });
      }
    } else {
      await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "load", value: "60" });
      await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "reps", value: "8" });
    }
    await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "rir", value: "1" });
    await api.flush();
    window.renderWorkout?.();
  });
  await page.locator("#workout .exercise.is-current .focus-shelf .saveset").click();
}

const read = (page) => page.evaluate(() => {
  const tab = document.querySelector("#restTab");
  const shown = (el) => !!el && el.getClientRects().length > 0;
  return {
    header: document.querySelector(".wo-head")?.getBoundingClientRect().height,
    chip: !!document.querySelector("#woRest"),
    tab: shown(tab), done: !!tab?.classList.contains("is-done"),
    label: tab?.querySelector(".resttab__label")?.textContent || "", time: tab?.querySelector(".resttab__time")?.textContent || "",
    arc: tab?.querySelector(".restring__arc")?.style.strokeDasharray || "",
    edge: document.querySelector(".restlight__half")?.style.strokeDasharray || "",
    restEnd: restEnd, left: restLeftMs(), paused: restPaused, length: restLength,
    sheet: !!document.querySelector("#restSheet.is-open"),
    hold: document.querySelector("#restHold")?.dataset.mode || "",
    dialTime: document.querySelector("#restDialTime")?.textContent || "",
    flicks: window.__repforgeRest.flicks(),
    inCard: document.querySelectorAll("#workout .restinline, #workout .restpad, #workout [data-rest-act]").length,
  };
});


/** Colours at CSS-pixel points of a screenshot of the viewport, decoded in the page as the rendered checker does. */
async function pixelsAt(page, points) {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(async ({ png, points }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const scale = canvas.width / innerWidth;
    return points.map(([x, y]) => [...context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data].slice(0, 3));
  }, { png, points });
}

/** Points just inside the panel's contour: one row under the shelf's top edge, clear of the tab, and down both of the
 *  tab's inner sides. The surface colour they must all show, resolved from the token. */
const panelProbe = (page) => page.evaluate(() => {
  const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf"), tab = document.querySelector("#restTab");
  const s = shelf.getBoundingClientRect(), t = tab.getBoundingClientRect();
  const probe = document.createElement("i");
  probe.style.cssText = "position:fixed;background:var(--color-surface)";
  document.body.append(probe);
  const surface = getComputedStyle(probe).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
  probe.remove();
  const points = [], y = Math.ceil(s.top) + 1;
  for (let x = s.left + 34; x < s.right - 34; x += 8) if (x < t.left - 14 || x > t.right + 14) points.push([x, y]);
  for (let ty = t.top + 18; ty < s.top - 2; ty += 3) points.push([t.left + 3, ty], [t.right - 3, ty]);
  return { surface, points };
});
const offSurface = (colours, surface) => colours.map((c, i) => [i, c]).filter(([, c]) => c.some((v, k) => Math.abs(v - surface[k]) > 2));

/** The reach the prototype's reach() gives for `share` of the rest left, from the contour's own half path: the shelf's
 *  edge carries the first 70% of the rest and the tab's outline (up to where it meets the shelf's top) the last 30%. */
const reachProbe = (page, share) => page.evaluate((share) => {
  restPaused = Math.round(share * restPlanSec() * 1000);
  syncRest();
  const half = document.querySelector(".restlight__half"), svg = half.ownerSVGElement;
  const T = document.querySelector("#workout .exercise.is-current .focus-shelf").getBoundingClientRect().top - svg.getBoundingClientRect().top;
  const length = half.getTotalLength();
  let lo = 0, hi = length;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (half.getPointAtLength(mid).y >= T - 0.01) hi = mid; else lo = mid; }
  const tab = hi, expected = share < 0.3 ? share / 0.3 * tab : tab + (share - 0.3) / 0.7 * (length - tab);
  const lit = +(half.style.strokeDasharray.split(/[ ,]+/)[2] || NaN);
  return { share, lit, expected: Math.round(expected * 100) / 100, length: Math.round(length), tab: Math.round(tab) };
}, share);

const browser = await launchChromium();
try {
  phase("No rest, a logged set, the bell: the header never moves, and the tab is there only for the rest");
  {
    const { context, page, errors } = await focusPage(browser);
    const idle = await read(page);
    assert(!idle.chip && !idle.tab && !idle.restEnd, "no rest pill in the header, and no tab with no rest", idle);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const running = await read(page);
    assert(running.tab && !running.done && running.label === "Rest" && /^\d:\d\d$/.test(running.time),
      "a logged set raises the tab: Rest and the time", running);
    assert(running.inCard === 0, "no clock or rest pads in the card or the shelf: the tab and the sheet carry the rest", running);
    assert(Math.abs(running.header - idle.header) < 0.5, "the header is the same height during the rest", { idle: idle.header, running: running.header });

    phase("Depletion is continuous");
    const a = await read(page);
    await page.waitForTimeout(100);
    const b = await read(page);
    assert(a.arc && b.arc && a.arc !== b.arc && a.edge !== b.edge, "the tab's ring and the shelf's edge differ between two frames 100 ms apart", { a: [a.arc, a.edge], b: [b.arc, b.edge] });

    phase("Every capability works from the sheet behind the tab");
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    let s = await read(page);
    assert(s.sheet && s.hold === "pause" && /^\d:\d\d$/.test(s.dialTime), "the tab opens the sheet: the dial's time, and Pause", s);
    await page.locator("#restMinus").click();
    const minus = await read(page);
    assert(s.left - minus.left > 25000, "-30s takes thirty seconds off the clock", { before: s.left, after: minus.left });
    await page.locator("#restPlus").click();
    const plus = await read(page);
    assert(plus.left - minus.left > 25000, "+30s adds thirty seconds", { before: minus.left, after: plus.left });
    await page.locator("#restHold").click();
    const held = await read(page);
    assert(held.paused != null && held.hold === "resume", "Pause holds the clock, and the primary control becomes Resume", held);
    await page.waitForTimeout(300);
    const still = await read(page);
    assert(still.left === held.left, "a held clock does not move", { held: held.left, later: still.left });
    await page.locator("#restHold").click();
    const resumed = await read(page);
    assert(resumed.paused == null && resumed.hold === "pause", "Resume lets it go", resumed);
    await page.locator('#restPresets [data-value="180"]').click();
    const preset = await read(page);
    assert(preset.length === 180 && preset.left > 175000, "a preset restarts the rest at its length", preset);
    await page.locator("#restMinus").click();
    await page.locator("#restReset").click();
    const restarted = await read(page);
    assert(restarted.left > 175000, "Restart runs the rest again from its full length", restarted);
    await page.locator("#restStop").click();
    await page.waitForFunction(() => !document.querySelector("#restSheet.is-open"), undefined, { timeout: 5000 });
    const ended = await read(page);
    assert(!ended.restEnd && !ended.tab, "End rest ends it and closes the sheet; the tab is gone", ended);

    phase("With no rest, the actions sheet opens the timer on Start");
    await page.locator("#woOverflowBtn").click();
    await page.locator('[data-workout-action="rest"]').click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    const idleSheet = await read(page);
    assert(idleSheet.hold === "start" && idleSheet.dialTime === "3:00", "the idle sheet offers Start, the dial at the length set", idleSheet);
    await page.locator("#restHold").click();
    const started = await read(page);
    assert(started.restEnd && started.hold === "pause", "Start starts the rest", started);
    await page.locator("#restSheetClose").click();
    await page.waitForFunction(() => !document.querySelector("#restSheet.is-open"), undefined, { timeout: 5000 });

    phase("The bell: one soft flick, once");
    const before = await read(page);
    await page.evaluate(() => { window.__repforgeRest.expire(0); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(1200);
    const bell = await read(page);
    assert(bell.done && bell.label === "Rest done" && bell.flicks === before.flicks + 1, "the bell plays one flick along the shelf's edge and the tab says Rest done", { before: before.flicks, bell });
    assert(Math.abs(bell.header - idle.header) < 0.5, "the header is the same height after the bell", { idle: idle.header, bell: bell.header });
    await page.waitForTimeout(1500);
    const later = await read(page);
    assert(later.flicks === bell.flicks && /^\+0:0\d$/.test(later.time), "it does not repeat, and the overrun counts up", later);

    phase("A bell that passes while the page is hidden: the done state on return, no flick");
    await page.evaluate(() => window.startRest(60));
    await page.waitForTimeout(300);
    const flicksBefore = (await read(page)).flicks;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__repforgeRest.expire(4));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      delete document.hidden; delete document.visibilityState;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(1200);
    const back = await read(page);
    assert(back.done && back.flicks === flicksBefore && /^\+0:0\d$/.test(back.time), "the tab shows Rest done and the overrun, and no flick plays", { flicksBefore, back });
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }


  phase("The light behind the panel (owner, 2026-10-28): one contour, light only outside it, from the clock");
  {
    const { context, page, errors } = await focusPage(browser);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    await page.evaluate(() => { restEnd = Date.now() + Math.round(0.5 * restPlanSec() * 1000); syncRest(); });
    await page.waitForTimeout(300);

    const contour = await page.evaluate(() => {
      const shelf = document.querySelector("#workout .exercise.is-current .focus-shelf"), tab = document.querySelector("#restTab");
      const shapes = shelf.querySelectorAll(".restlight__shape"), shape = shapes[0]?.getBoundingClientRect();
      const s = shelf.getBoundingClientRect(), t = tab.getBoundingClientRect(), ts = getComputedStyle(tab), ss = getComputedStyle(shelf);
      return { shapes: shapes.length, tabShadow: ts.boxShadow, tabBg: ts.backgroundColor, shelfShadow: ss.boxShadow, shelfBg: ss.backgroundColor,
        covers: !!shape && shape.top <= t.top + 0.5 && shape.bottom >= s.bottom - 0.5 && Math.abs(shape.width - s.width) < 0.5 };
    });
    assert(contour.shapes === 1 && contour.covers && contour.tabShadow === "none" && contour.tabBg === "rgba(0, 0, 0, 0)"
      && contour.shelfShadow === "none" && contour.shelfBg === "rgba(0, 0, 0, 0)",
      "the tab and the shelf are one contour: one shape from the tab's top to the shelf's foot, and no separate tab or shelf box or shadow", contour);

    const running = await panelProbe(page);
    const runningOff = offSurface(await pixelsAt(page, running.points), running.surface);
    assert(running.points.length > 20 && runningOff.length === 0, "during the rest no light falls inside the panel: every pixel just inside the contour is the panel's colour",
      { points: running.points.length, off: runningOff.slice(0, 6), surface: running.surface });

    const reaches = [];
    for (const share of [1, 0.8, 0.65, 0.3, 0.15, 0.05]) reaches.push(await reachProbe(page, share));
    assert(reaches.every((r) => Math.abs(r.lit - r.expected) < 1), "the lit length follows reach(): the shelf's edge carries the first 70% of the rest, the tab's outline the last 30%", reaches);

    const paused = await page.evaluate(async () => {
      const svg = document.querySelector(".restlight"), core = svg.querySelector(".restlight__core"), half = svg.querySelector(".restlight__half");
      const probe = document.createElement("i");
      probe.style.cssText = "position:fixed;color:var(--ink-faint)";
      document.body.append(probe);
      const faint = getComputedStyle(probe).color;
      probe.remove();
      const before = half.style.strokeDasharray;
      await new Promise((r) => setTimeout(r, 600));
      return { paused: svg.classList.contains("is-paused"), stroke: getComputedStyle(core).stroke, faint, before, after: half.style.strokeDasharray,
        opacity: +getComputedStyle(svg.querySelector(".restlight__light")).opacity };
    });
    assert(paused.paused && paused.stroke === paused.faint && paused.before === paused.after && Math.abs(paused.opacity - 0.62 * 0.55) < 0.01,
      "held, the light keeps its length and turns ink-faint at 55%", paused);

    await page.evaluate(() => { restEnd = Date.now() + Math.round(0.4 * restPlanSec() * 1000); restPaused = null; syncRest(); });
    await page.waitForTimeout(200);
    const flick = await page.evaluate(() => {
      const seen = [];
      const origin = Element.prototype.animate;
      Element.prototype.animate = function (...args) { const run = origin.apply(this, args); seen.push({ run, on: this.getAttribute("class") || "" }); return run; };
      restEnd = Date.now() - 1; syncRest(); playRestFlick();
      Element.prototype.animate = origin;
      for (const entry of seen) entry.id = entry.run.id;
      const runs = document.getAnimations().filter((a) => String(a.id).startsWith("rest-flick"));
      for (const run of runs) { run.pause(); run.currentTime = 200; }
      return { seen: seen.map((r) => `${r.id}:${r.on}`), durations: runs.map((r) => r.effect.getTiming().duration) };
    });
    // A paused frame of the flick, near its peak: the sweep is running out from the clock, and still nothing is inside.
    const peak = await panelProbe(page);
    const peakOff = offSurface(await pixelsAt(page, peak.points), peak.surface);
    assert(flick.seen.join() === "rest-flick-sweep:restlight__half,rest-flick-sweep:restlight__half,rest-flick:restlight__lit" && flick.durations.every((d) => d === 600),
      "the zero flick is one 600ms run of the light, with its sweep out along both halves", flick);
    assert(peakOff.length === 0, "mid-flick no light falls inside the panel", { off: peakOff.slice(0, 6), surface: peak.surface });
    const settled = await page.evaluate(async () => {
      for (const run of document.getAnimations().filter((a) => String(a.id).startsWith("rest-flick"))) run.finish();
      await new Promise((r) => requestAnimationFrame(r));
      const half = document.querySelector(".restlight__half");
      return { runs: document.getAnimations().filter((a) => String(a.id).startsWith("rest-flick") && a.playState === "running").length,
        rim: getComputedStyle(document.querySelector(".restlight__lit")).opacity, lit: +(half.style.strokeDasharray.split(/[ ,]+/)[2]), length: half.getTotalLength() };
    });
    assert(settled.runs === 0 && settled.rim === "0.2" && Math.abs(settled.lit - settled.length) < 1, "after the flick a faint steady rim stands the whole way round", settled);

    const themes = await page.evaluate(() => {
      const core = document.querySelector(".restlight__core"), bloom = document.querySelector(".restlight__bloom"), light = document.querySelector(".restlight__light");
      const read = () => ({ core: getComputedStyle(core).stroke, bloom: getComputedStyle(bloom).stroke, gain: +getComputedStyle(light).opacity });
      const was = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = "light"; const light_ = read();
      document.documentElement.dataset.theme = "dark"; const dark = read();
      if (was) document.documentElement.dataset.theme = was; else delete document.documentElement.dataset.theme;
      return { light: light_, dark };
    });
    assert(themes.light.gain === 0.62 && themes.light.core === themes.light.bloom && themes.dark.gain === 1 && themes.dark.core === "rgb(255, 180, 138)"
      && themes.dark.bloom !== themes.dark.core, "in dark the core is a light tint and the bloom the accent; in light the light is quieter (x0.62)", themes);

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    const clear = await page.evaluate(() => [...document.querySelectorAll(".restlight__bloom")].map((el) => getComputedStyle(el).display)
      .concat(getComputedStyle(document.querySelector(".restlight__core")).display));
    assert(clear.join() === "none,none,inline", "under reduced transparency there is no bloom, only the core hairline", clear);
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("Reduced motion: no flick at the bell");
  {
    const { context, page, errors } = await focusPage(browser, { reducedMotion: "reduce" });
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    // The seam stops the tick; a visibility change re-reads the clock, as the catalog's rest-done scenario does.
    await page.evaluate(() => { window.__repforgeRest.expire(0); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(1200);
    const r = await read(page);
    const glow = await page.evaluate(() => document.getAnimations().filter((a) => String(a.id).startsWith("rest-flick")).length);
    const rim = await page.evaluate(() => getComputedStyle(document.querySelector(".restlight__lit")).opacity);
    assert(r.done && r.flicks === 0 && glow === 0 && rim === "0.2", "the tab goes to Rest done at once, with no flick or sweep: the light is the steady rim", { r, glow, rim });
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nRest timer: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
