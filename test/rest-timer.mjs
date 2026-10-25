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
    edge: document.querySelector(".shelf__edge-fill")?.style.transform || "",
    restEnd: restEnd, left: restLeftMs(), paused: restPaused, length: restLength,
    sheet: !!document.querySelector("#restSheet.is-open"),
    hold: document.querySelector("#restHold")?.dataset.mode || "",
    dialTime: document.querySelector("#restDialTime")?.textContent || "",
    flicks: window.__repforgeRest.flicks(),
    inCard: document.querySelectorAll("#workout .restinline, #workout .restpad, #workout [data-rest-act]").length,
  };
});

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
    assert(bell.done && bell.label === "Rest done" && bell.flicks === before.flicks + 1, "the bell plays one flick on the tab and the tab says Rest done", { before: before.flicks, bell });
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

  phase("Reduced motion: no flick at the bell");
  {
    const { context, page, errors } = await focusPage(browser, { reducedMotion: "reduce" });
    await logSet(page);
    await page.waitForSelector("#restTab", { timeout: 5000 });
    // The seam stops the tick; a visibility change re-reads the clock, as the catalog's rest-done scenario does.
    await page.evaluate(() => { window.__repforgeRest.expire(0); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(1200);
    const r = await read(page);
    const glow = await page.evaluate(() => document.getAnimations().filter((a) => a.id === "rest-flick").length);
    assert(r.done && r.flicks === 0 && glow === 0, "the tab goes to Rest done at once, with no flick", { r, glow });
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nRest timer: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
