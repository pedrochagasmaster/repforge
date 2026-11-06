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
import { openCatalogState } from "./fixtures/catalog-state.mjs";

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
    ring: !!tab?.querySelector(".restring, svg, .icon-mask--check"),
    edge: document.querySelector(".restlight__half")?.style.strokeDasharray || "",
    restEnd: window.__repforgeRest.state().active, left: restLeftMs(), paused: window.__repforgeRest.state().pausedMs, length: window.__repforgeRest.state().lengthSec,
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
  window.__repforgeRest.setLeft(Math.round(share * restPlanSec() * 1000), { held: true });
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
    assert(!a.ring && a.edge && b.edge && a.edge !== b.edge, "the tab is words only, and the shelf's edge differs between two frames 100 ms apart", { a: [a.ring, a.edge], b: [b.ring, b.edge] });

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
    await page.evaluate(() => { window.__repforgeRest.setLeft(Math.round(0.5 * restPlanSec() * 1000)); syncRest(); });
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

    await page.evaluate(() => { window.__repforgeRest.setLeft(Math.round(0.4 * restPlanSec() * 1000), { held: false }); syncRest(); });
    await page.waitForTimeout(200);
    const flick = await page.evaluate(() => {
      const seen = [];
      const origin = Element.prototype.animate;
      Element.prototype.animate = function (...args) { const run = origin.apply(this, args); seen.push({ run, on: this.getAttribute("class") || "" }); return run; };
      window.__repforgeRest.expire(0); syncRest(); playRestFlick();
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
  phase("The tab is words only (owner, 2026-10-29): running, paused and done each say their state, and a press dims");
  {
    const { context, page, errors } = await focusPage(browser);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const look = () => page.evaluate(() => {
      const tab = document.querySelector("#restTab"), label = tab.querySelector(".resttab__label"), time = tab.querySelector(".resttab__time");
      const ink = (token) => { const i = document.createElement("i"); i.style.color = `var(${token})`; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; };
      return { label: label.textContent, time: time.textContent, aria: tab.getAttribute("aria-label") || "",
        labelColor: getComputedStyle(label).color, timeColor: getComputedStyle(time).color,
        ink: ink("--color-ink"), secondary: ink("--color-ink-secondary"), accent: ink("--accent-deep"),
        ring: !!tab.querySelector(".restring, svg, .icon-mask--check") };
    });
    const running = await look();
    assert(running.label === "Rest" && /^\d:\d\d$/.test(running.time) && running.labelColor === running.ink && running.timeColor === running.ink && !running.ring,
      "running: Rest and the countdown, in ink, with no ring", running);
    await page.evaluate(() => { window.__repforgeRest.setLeft(Math.max(1000, restLeftMs()), { held: true }); syncRest(); });
    const paused = await look();
    assert(paused.label === "Paused" && /^\d:\d\d$/.test(paused.time) && paused.labelColor === paused.secondary && paused.timeColor === paused.secondary,
      "paused: the word Paused and the held time, in secondary ink", paused);
    assert(/paused/i.test(paused.aria), "the paused tab announces Paused", paused.aria);
    await page.evaluate(() => { window.__repforgeRest.expire(5); syncRest(); });
    await page.waitForFunction(() => /^\+/.test(document.querySelector("#restTab .resttab__time")?.textContent || ""), undefined, { timeout: 5000 });
    const done = await look();
    assert(done.label === "Rest done" && /^\+\d:\d\d$/.test(done.time) && done.labelColor === done.accent && !done.ring,
      "done: Rest done and the + count-up, in the deep accent, with no check", done);
    // Each state differs from the others by at least two cues that are not colour: the word, and the clock's direction.
    const word = new Set([running.label, paused.label, done.label]).size, up = [running, paused, done].map((x) => x.time.startsWith("+"));
    assert(word === 3 && up.join() === "false,false,true" && running.label !== paused.label,
      "the states are told apart by the word and by countdown against count-up, not by colour alone", { word, up });

    phase("A rest that starts without a render still leaves its band: nothing in the context sits beside the tab");
    const band = async () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const card = document.querySelector("#workout .exercise--focus.is-current");
      const c = card.querySelector(".fcard__context").getBoundingClientRect(), t = card.querySelector("#restTab").getBoundingClientRect();
      done({ contextBottom: Math.round(c.bottom), tabTop: Math.round(t.top), rise: card.style.getPropertyValue("--rest-tab-rise") });
    }))));
    await page.evaluate(() => { stopRest(); startRest(90); });
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const plain = await band();
    assert(plain.contextBottom <= plain.tabTop + 1, "a started rest refits the band: the context region ends at the tab's top", plain);
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; stopRest(); startRest(90); });
    await page.waitForSelector("#restTab", { timeout: 5000 });
    await page.waitForTimeout(300);
    const large = await band();
    assert(large.contextBottom <= large.tabTop + 1, "at 200% too, the context region ends at the tab's top", large);
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.waitForTimeout(300);

    phase("A press dims the words and paints no box");
    await page.evaluate(() => { stopRest(); startRest(90); });
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const box = await page.locator("#restTab").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector("#restTab")?.classList.contains("is-pressed"), undefined, { timeout: 2000 });
    const pressed = await page.evaluate(() => {
      const tab = document.querySelector("#restTab");
      const painted = [tab, ...tab.querySelectorAll("*")].filter((el) => {
        const c = getComputedStyle(el).backgroundColor;
        return c && c !== "transparent" && !/rgba\(0, 0, 0, 0\)/.test(c) && !el.classList.contains("icon-mask");
      }).map((el) => el.className);
      return { painted, opacity: [...tab.children].map((el) => +getComputedStyle(el).opacity), tap: getComputedStyle(tab).webkitTapHighlightColor };
    });
    await page.mouse.up();
    assert(!pressed.painted.length, "during a press nothing inside the tab paints a background", pressed);
    assert(pressed.opacity.length && pressed.opacity.every((value) => value < 0.6), "the tab's words dim on press-down", pressed);
    assert(/rgba\(0, 0, 0, 0\)|transparent/.test(pressed.tap), "no platform tap highlight on the tab", pressed.tap);
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    await page.evaluate(() => closeRestSheet());

    phase("The legacy pill is retired: a running rest never floats over Settings or a pushed page");
    const floating = () => page.evaluate(() => ({
      pill: !!document.querySelector("#restBar, .restbar"),
      clocks: [...document.querySelectorAll("body *")].filter((el) => {
        const st = getComputedStyle(el);
        return st.position === "fixed" && el.getClientRects().length && /\b\d:\d\d\b/.test(el.textContent || "") && !el.closest("#miniBar") && el.checkVisibility?.();
      }).map((el) => el.id || el.className).slice(0, 4),
      mini: !document.querySelector("#miniBar")?.classList.contains("hidden"), restEnd: window.__repforgeRest.state().active,
    }));
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.waitForTimeout(400);
    const settings = await floating();
    assert(settings.restEnd > 0 && !settings.pill && !settings.clocks.length && !settings.mini,
      "with a rest running, Settings shows no rest pill and no floating clock (and no mini bar)", settings);
    assert(!errors.length, "no page errors in the text-only tab run", errors);
    await context.close();
  }

  // The tab fits its words (owner, iPhone, 2026-10-31: "Descanso concluído +0:15" at double text ran past the screen):
  // running, paused and done, in both languages, at 390 and 320, at the usual and double text, the word is never cut,
  // the tab stays inside the shelf, and the shelf's own box casts no shadow under the tab (the contour draws it).
  phase("The tab fits its words in every state, language and text size, and the shelf casts no shadow under it");
  for (const width of [390, 320]) for (const lang of ["en", "pt"]) for (const text of ["normal", "text200"]) {
    const opened = await openCatalogState(browser, "workout/rest-running", width, lang, text);
    try {
      const fits = [];
      for (const state of ["running", "paused", "done"]) {
        await opened.page.evaluate((state) => {
          if (state === "paused") { window.__repforgeRest.setLeft(Math.max(1000, restLeftMs()), { held: true }); syncRest(); }
          if (state === "done") { window.__repforgeRest.expire(5); syncRest(); }
        }, state);
        if (state === "done") await opened.page.waitForFunction(() => /^\+/.test(document.querySelector("#restTab .resttab__time")?.textContent || ""), undefined, { timeout: 5000 });
        fits.push(await opened.page.evaluate((state) => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {
          const tab = document.querySelector("#restTab"), shelf = tab.closest(".focus-shelf"), label = tab.querySelector(".resttab__label");
          const t = tab.getBoundingClientRect(), s = shelf.getBoundingClientRect();
          const parts = [...tab.querySelectorAll(".resttab__label,.resttab__time,.resttab__chev")].map((el) => el.getBoundingClientRect());
          // The clock and its chevron are one: on one line together, wherever the word puts them (their middles level).
          const mid = (r) => r.top + r.height / 2, clock = parts[1], chev = parts[2];
          done({ state, words: `${label.textContent} ${tab.querySelector(".resttab__time").textContent}`,
            cut: label.scrollWidth > label.clientWidth + .5 || tab.scrollWidth > tab.clientWidth + .5,
            inside: t.left >= s.left - .5 && t.right <= s.right + .5 && parts.every((r) => r.left >= t.left - .5 && r.right <= t.right + .5),
            together: Math.abs(mid(chev) - mid(clock)) <= 2 && chev.left >= clock.right - .5,
            shadow: getComputedStyle(shelf).boxShadow, contour: shelf.classList.contains("has-rest") && !!shelf.querySelector(".restlight__shape") });
        }))), state));
      }
      const bad = fits.filter((x) => x.cut || !x.inside || !x.together || x.shadow !== "none" || !x.contour);
      assert(bad.length === 0, `[${lang} ${width} ${text}] running, paused and done: the words fit the tab, the clock keeps its chevron, the tab fits the shelf, and only the contour casts the shadow`, { bad, fits });
    } finally {
      await opened.context.close();
    }
  }

  // The rest sheet as the owner asked for it (2026-11-04): its presets set this exercise's rest in the program and never
  // the default, the dial carries no light, and the dial turns under the finger like a volume dial.
  phase("The presets set this exercise's rest, not the default");
  {
    const { context, page, errors } = await focusPage(browser);
    const before = await page.evaluate(() => ({ dflt: state.settings.restSec, ex: focusCard()?.dataset.ex, stored: exerciseStoredRest(restExercise()) }));
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const first = await read(page);
    assert(first.length === before.dflt, "an exercise with no rest of its own rests for the Settings default", { first: first.length, before });
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    const shown = await page.evaluate(() => ({
      label: document.querySelector("#restPresetsLabel")?.textContent,
      checked: [...document.querySelectorAll('#restPresets [role="radio"][aria-checked="true"]')].map((b) => b.dataset.value),
      light: document.querySelectorAll("#restSheet .restglow, #restSheet .restflick, #restDial [class*='glow']").length,
    }));
    assert(shown.label === "Rest for this exercise" && shown.checked.join() === String(before.dflt),
      "the section reads Rest for this exercise, with the default it inherits shown as chosen", shown);
    assert(shown.light === 0, "the dial carries no light: no bloom at its head and no flick layer", shown);
    await page.locator('#restPresets [data-value="90"]').click();
    await page.waitForFunction((ex) => exerciseStoredRest(prog.find(ex)) === 90, before.ex, { timeout: 5000 });
    const after = await page.evaluate((ex) => {
      const slot = restSlotOf(prog.find(ex)), sets = slot.prescriptionsByCycle.flatMap((cycle) => cycle.sets);
      const others = state.programMeta.programDefinition.days.flatMap((day) => day.slots).filter((other) => other.id !== slot.id)
        .flatMap((other) => other.prescriptionsByCycle.flatMap((cycle) => cycle.sets.map((set) => set.restSeconds ?? null)));
      const stored = JSON.parse(localStorage.getItem("repforge_v1"));
      const storedSlot = stored.programMeta.programDefinition.days.flatMap((day) => day.slots).find((other) => other.id === slot.id);
      return { rests: [...new Set(sets.map((set) => set.restSeconds))], statuses: [...new Set(sets.map((set) => set.status))],
        others: [...new Set(others)], dflt: state.settings.restSec, storedDflt: stored.settings.restSec,
        storedRests: [...new Set(storedSlot.prescriptionsByCycle.flatMap((cycle) => cycle.sets.map((set) => set.restSeconds)))],
        draft: !!window.__repforgeWorkoutDraft.current(), recovery: localStorage.getItem("repforge_draft_v1:recovery"),
        length: window.__repforgeRest.state().lengthSec, left: restLeftMs() };
    }, before.ex);
    assert(after.rests.join() === "90" && after.storedRests.join() === "90", "the preset stores 1:30 on every set of this exercise, in the program and on disk", after);
    assert(after.dflt === before.dflt && after.storedDflt === before.dflt && after.others.every((v) => v === null),
      "the Settings default and every other exercise keep their rest", after);
    assert(after.draft && after.recovery === null, "the workout in progress keeps its draft: no recovery", after);
    assert(after.length === 90 && after.left > 85000, "the running rest restarts at 1:30", after);
    const reopen = await page.evaluate(() => [...document.querySelectorAll('#restPresets [role="radio"][aria-checked="true"]')].map((b) => b.dataset.value));
    assert(reopen.join() === "90", "the chosen preset is the exercise's rest", reopen);
    await page.locator("#restStop").click();
    await page.waitForFunction(() => !document.querySelector("#restSheet.is-open"), undefined, { timeout: 5000 });
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    const next = await read(page);
    assert(next.length === 90, "the exercise's next set rests for its own 1:30", next);
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("The dial turns under the finger: a quarter-turn is a quarter of the rest, in 15-second detents");
  {
    const { context, page, errors } = await focusPage(browser);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    await page.waitForTimeout(400);
    // A held clock at a known time, so the mapping is exact: 4:58 of 5:00.
    await page.evaluate(() => { window.__repforgeRest.setLeft(298000, { held: true, lengthSec: 300 }); syncRest(); });
    /** Drag around the ring from one angle to another (turns, 0 at the top, clockwise), in small steps. */
    const turn = async (from, to) => {
      const box = await page.locator("#restDial").boundingBox();
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width * 0.448;
      const at = (a) => [cx + r * Math.sin(a * 2 * Math.PI), cy - r * Math.cos(a * 2 * Math.PI)];
      await page.mouse.move(...at(from));
      await page.mouse.down();
      const steps = Math.max(2, Math.ceil(Math.abs(to - from) * 72));
      for (let i = 1; i <= steps; i++) await page.mouse.move(...at(from + (to - from) * i / steps));
      await page.mouse.up();
      return page.evaluate(() => ({ left: Math.round(restLeftMs() / 1000), length: window.__repforgeRest.state().lengthSec, open: !!document.querySelector("#restSheet.is-open"),
        dragging: document.querySelector("#restSheet")?.classList.contains("is-dragging"), time: document.querySelector("#restDialTime")?.textContent,
        now: document.querySelector("#restDial").getAttribute("aria-valuenow"), text: document.querySelector("#restDial").getAttribute("aria-valuetext") }));
    };
    let r = await turn(0.125, 0.375);
    assert(r.left === 375 && r.time === "6:15" && r.open, "a quarter-turn clockwise from 4:58 of 5:00 adds a quarter (1:15), snapped to 6:15; the grab keeps its offset", r);
    assert(r.length === 375, "past the rest's length the ring stays full and the length grows with the time", r);
    await page.evaluate(() => { window.__repforgeRest.setLeft(298000, { held: true, lengthSec: 300 }); syncRest(); });
    r = await turn(0.375, 0.125);
    assert(r.left === 225 && r.time === "3:45", "a quarter-turn counter-clockwise takes a quarter away: 4:58 to 3:45", r);
    r = await turn(0.9, 0.95);
    assert(r.left % 15 === 0, "every turn lands on a 15-second detent", r);
    r = await turn(0, 3);
    assert(r.left === 600 && r.time === "10:00", "turning on clockwise stops at 10:00", r);
    r = await turn(0, -4);
    assert(r.left === 15 && r.time === "0:15", "turning on counter-clockwise stops at 0:15", r);
    // The ring is the dial's: a drag down its side turns the clock and never pulls the sheet down.
    await page.evaluate(() => { window.__repforgeRest.setLeft(298000, { held: true, lengthSec: 300 }); syncRest(); });
    r = await turn(0.7, 0.55);
    assert(r.open && !r.dragging && r.left < 298, "a drag down the ring turns the dial and the sheet stays open", r);
    assert(await page.evaluate(() => getComputedStyle(document.querySelector("#restDial")).touchAction) === "none" &&
      await page.evaluate(() => getComputedStyle(document.querySelector("#restSheet .restsheet__controls")).touchAction) !== "none",
      "only the dial keeps its touches; the rest of the sheet still swipes");

    phase("The dial is a slider for the keyboard and assistive technology");
    await page.evaluate(() => { window.__repforgeRest.setLeft(298000, { held: true, lengthSec: 300 }); syncRest(); });
    const slider = await page.evaluate(() => { const d = document.querySelector("#restDial");
      return { role: d.getAttribute("role"), tab: d.tabIndex, name: d.getAttribute("aria-label"), min: d.getAttribute("aria-valuemin"), max: d.getAttribute("aria-valuemax"),
        now: d.getAttribute("aria-valuenow"), text: d.getAttribute("aria-valuetext") }; });
    assert(slider.role === "slider" && slider.tab === 0 && slider.name === "Rest time left" && slider.min === "15" && slider.max === "600"
      && slider.now === "298" && slider.text === "4 minutes 58 seconds", "role slider, its name, its range, and the time in words", slider);
    await page.locator("#restDial").focus();
    await page.keyboard.press("ArrowUp");
    let k = await page.evaluate(() => ({ left: Math.round(restLeftMs() / 1000), text: document.querySelector("#restDial").getAttribute("aria-valuetext") }));
    assert(k.left === 300 && k.text === "5 minutes", "ArrowUp steps to the next detent: 4:58 to 5:00", k);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowLeft");
    k = await page.evaluate(() => ({ left: Math.round(restLeftMs() / 1000), text: document.querySelector("#restDial").getAttribute("aria-valuetext") }));
    assert(k.left === 270 && k.text === "4 minutes 30 seconds", "ArrowDown and ArrowLeft step 15 seconds down each", k);
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("The bell with the sheet open: the light flicks along the shelf, never on the dial");
  {
    const { context, page, errors } = await focusPage(browser);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    const bell = await page.evaluate(async () => {
      const seen = [];
      const origin = Element.prototype.animate;
      Element.prototype.animate = function (...args) { const run = origin.apply(this, args); seen.push(this.closest("#restDial") ? "dial" : this.getAttribute("class") || ""); return run; };
      window.__repforgeRest.expire(0);
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((r) => setTimeout(r, 1200));
      Element.prototype.animate = origin;
      return { seen, flicks: window.__repforgeRest.flicks() };
    });
    assert(!bell.seen.includes("dial") && bell.seen.includes("restlight__lit"), "the bell's flick runs on the shelf's light and nothing animates on the dial", bell);
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  // The clock's guards: the bell once per deadline, a nudge back above zero re-arming it, a start or restart moving the
  // deadline, paused overtime holding and resuming, and the count-up stopping its ticks at the cap.
  const overSecs = (time) => { const [m, s] = time.replace("+", "").split(":").map(Number); return m * 60 + s; };
  phase("The bell rings once per deadline; a nudge back above zero re-arms it; a start or restart moves the deadline");
  {
    const { context, page, errors } = await focusPage(browser);
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    await page.evaluate(() => {
      window.__completeWrites = 0;
      const live = document.querySelector("#restAnnounce");
      new MutationObserver(() => { if (live.textContent === window.RepForgeI18n.t("rest.complete")) window.__completeWrites++; })
        .observe(live, { childList: true, characterData: true, subtree: true });
    });
    const flicksBefore = await page.evaluate(() => window.__repforgeRest.flicks());
    await page.evaluate(() => startRest(1));
    await page.waitForFunction(() => document.querySelector("#restTab")?.classList.contains("is-done"), undefined, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const once = await page.evaluate(() => ({ writes: window.__completeWrites, flicks: window.__repforgeRest.flicks() }));
    assert(once.writes === 1 && once.flicks === flicksBefore + 1,
      "the bell announces and flicks once, and the overrun keeps counting without a repeat", { flicksBefore, once });

    await page.evaluate(() => nudgeRest(30));
    await page.waitForTimeout(300);
    const rearmed = await page.evaluate(() => ({ done: document.querySelector("#restTab").classList.contains("is-done"), left: restLeftMs() }));
    assert(!rearmed.done && rearmed.left > 25000, "a nudge back above zero puts the rest back on the clock", rearmed);
    await page.evaluate(() => { window.__repforgeRest.expire(0); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForFunction(() => window.__completeWrites === 2, undefined, { timeout: 5000 });
    await page.waitForTimeout(1500);
    const again = await page.evaluate(() => window.__completeWrites);
    assert(again === 2, "re-armed by the nudge, the bell announces again, once", { again });

    phase("A start or a restart moves the deadline");
    const leftNow = () => page.evaluate(() => restLeftMs());
    await page.evaluate(() => startRest(60));
    await page.waitForTimeout(200);
    const sixty = await leftNow();
    assert(sixty > 55000 && sixty <= 60000, "starting a rest sets the deadline to its length", { sixty });
    await page.evaluate(() => startRest(120));
    await page.waitForTimeout(200);
    const restarted = await leftNow();
    assert(restarted > 115000 && restarted <= 120000, "starting again while running moves the deadline to the new length", { restarted });
    await page.evaluate(() => resetRest());
    await page.waitForTimeout(200);
    const reset = await leftNow();
    assert(reset > 115000 && reset <= 120000, "a reset moves the deadline back to the armed length", { reset });

    phase("Paused overtime is a real state: it holds the overrun, and resuming counts on from it");
    await page.evaluate(() => window.__repforgeRest.expire(5));
    await page.evaluate(() => toggleRestHold());
    const held = await page.evaluate(() => ({ paused: window.__repforgeRest.state().pausedMs, label: document.querySelector("#restTab .resttab__label").textContent,
      isPaused: document.querySelector("#restTab").classList.contains("is-paused"), time: document.querySelector("#restTab .resttab__time").textContent }));
    assert(held.paused < 0 && held.label === "Rest done" && held.isPaused, "paused past the bell: the clock holds a negative remainder and the tab says Rest done, paused", held);
    await page.waitForTimeout(1200);
    const still = await page.evaluate(() => document.querySelector("#restTab .resttab__time").textContent);
    assert(still === held.time, "a held overrun does not count", { held: held.time, still });
    await page.evaluate(() => toggleRestHold());
    await page.waitForTimeout(1200);
    const resumed = await page.evaluate(() => ({ paused: window.__repforgeRest.state().pausedMs, time: document.querySelector("#restTab .resttab__time").textContent }));
    assert(resumed.paused == null && overSecs(resumed.time) > overSecs(still), "resuming counts the overrun on from where it was held", { still, resumed });

    phase("The count-up stops ticking at its cap");
    await page.evaluate(() => { stopRest(); startRest(90); window.__repforgeRest.setLeft(-3601 * 1000); syncRest(); });
    await page.waitForFunction(() => !window.__repforgeRest.state().ticking, undefined, { timeout: 5000 });
    const capped = await page.evaluate(() => document.querySelector("#restTab .resttab__time").textContent);
    assert(capped === "+60:00", "past the hour the count-up reads +60:00 and no tick is left running", { capped });
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

} finally {
  await browser.close();
}

console.log(`\nRest timer: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
