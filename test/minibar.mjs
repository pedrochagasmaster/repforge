#!/usr/bin/env node
/**
 * The mini bar on the other tabs, which absorbs the rest timer (owner addendum, 2026-10-23).
 *
 * Driven through the real app with a real DraftV2 session (one lift done, one part done, the next one selected):
 *
 *   - on Progress, History and Program while a session is open, exactly one bar sits above the dock, with the
 *     session's name and "Exercise {i} of {n} · {elapsed}"; Today has none (its live card says it);
 *   - while a rest runs, the bar is the rest timer ("Rest m:ss", the next set, +30s) and no separate #restBar shows,
 *     there or on Today, where the card's tag carries the rest instead;
 *   - +30s extends the real rest;
 *   - when the rest ends the bar says Rest done, then returns to the session;
 *   - Resume, and a tap on the bar, open Focus on the current exercise;
 *   - the end of each tab scrolls clear of the bar, and a pushed page or Settings hides it;
 *   - with no session there is no bar, and a rest's pill behaves as before.
 *
 * Run: node test/minibar.mjs
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

async function freshPage(browser, { reducedMotion = "no-preference" } = {}) {
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
  await page.waitForSelector("#startWorkout:not(.hidden)", { timeout: 5000 });
  return { context, page, errors };
}

/** One lift done, one set of the second, the third selected; then back to Today. */
async function shapeSession(page) {
  const day = seedProgram()[0].day;
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), day);
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  const shape = await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft;
    const ids = api.current().exerciseOrder.slice();
    const working = (id) => api.current().exercises[id].setOrder.filter((setId) => api.current().exercises[id].sets[setId].role !== "warmup");
    const complete = async (id, setId) => {
      const set = api.current().exercises[id].sets[setId];
      if (Array.isArray(set.programmed.metrics)) {
        for (const metric of set.programmed.metrics) {
          const value = /rep/i.test(metric.semantic || "") ? "8" : /time|duration|second/i.test(metric.semantic || "") ? "45" : "60";
          await api.dispatch("editMetricValue", { exerciseInstanceId: id, setId, metricId: metric.id, value });
        }
      } else {
        await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "load", value: "60" });
        await api.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "reps", value: "8" });
      }
      await api.dispatch("completeSet", { exerciseInstanceId: id, setId, completedAt: new Date().toISOString() });
    };
    for (const setId of working(ids[0])) await complete(ids[0], setId);
    await complete(ids[1], working(ids[1])[0]);
    await api.dispatch("selectExercise", { exerciseInstanceId: ids[2] });
    await api.flush();
    return { ids, count: ids.length };
  });
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(300);
  return shape;
}

const tab = async (page, view) => {
  await page.click(`nav button[data-view="${view}"]`);
  await page.waitForFunction((v) => document.querySelector(`#${v}`)?.classList.contains("active"), view, { timeout: 5000 });
  await page.waitForTimeout(250);
};

/** Everything floating above the dock, and the bar's words. */
const above = (page) => page.evaluate(() => {
  const nav = document.querySelector("nav").getBoundingClientRect();
  const drawn = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden";
  // Fixed layers that end within a band above the dock: the bar, the rest pill, a floating CTA.
  const floating = [...document.querySelectorAll("body *")].filter((el) => {
    if (!drawn(el)) return false;
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    if (el.closest("nav") || el === document.querySelector("nav")) return false;
    const r = el.getBoundingClientRect();
    return r.height > 20 && r.bottom <= nav.top + 1 && r.bottom >= nav.top - 140 && r.width > 40;
  }).map((el) => el.id || el.className);
  const bar = document.querySelector("#miniBar");
  const rect = bar && drawn(bar) ? bar.getBoundingClientRect() : null;
  return {
    floating, bar: !!rect, rect: rect && { top: rect.top, bottom: rect.bottom }, navTop: nav.top,
    restBar: drawn(document.querySelector("#restBar")),
    title: bar?.querySelector(".minibar__title")?.textContent || "",
    sub: bar?.querySelector(".minibar__sub")?.textContent || "",
    resume: bar?.querySelector("#miniBarResume")?.textContent || "",
    plus: drawn(bar?.querySelector("#miniBarPlus")),
    // The progress is the thin light along the top edge (no ring, owner 2026-10-31): the scale of its fill.
    line: bar?.querySelector(".minibar__fill") ? new DOMMatrix(getComputedStyle(bar.querySelector(".minibar__fill")).transform).a : null,
    rings: bar ? bar.querySelectorAll(".minibar__ring, [class*='ring']").length : 0,
    loops: bar ? bar.getAnimations({ subtree: true }).length : 0,
    tag: document.querySelector('#todayLive [data-live="elapsed"]')?.textContent || "",
  };
});

const browser = await launchChromium();
try {
  phase("No session: no bar on any tab");
  {
    const { context, page, errors } = await freshPage(browser);
    for (const view of ["stats", "history", "program"]) {
      await tab(page, view);
      const a = await above(page);
      assert(!a.bar, `${view}: no mini bar without a session`, a);
    }
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("A session open: one bar above the dock on the other tabs");
  {
    const { context, page, errors } = await freshPage(browser);
    const shape = await shapeSession(page);
    const today = await above(page);
    assert(!today.bar, "Today has no bar: its live card says the session", today);
    for (const view of ["stats", "history", "program"]) {
      await tab(page, view);
      const a = await above(page);
      assert(a.bar && a.floating.length === 1 && a.rect.bottom <= a.navTop,
        `${view}: exactly one element floats above the dock, the mini bar`, a);
      assert(a.title === "Day 1" && new RegExp(`^Exercise 3 of ${shape.count} · \\d+ min$`).test(a.sub) && a.resume === "Resume",
        `${view}: the session's name, where the lifter is and the time so far, and Resume`, a);
      assert(!a.plus && a.line > 0 && a.line < 1 && a.rings === 0, `${view}: no +30s without a rest, no ring, and the top edge's light shows the sets done`, a);
    }

    phase("The end of a tab scrolls clear of the bar");
    for (const view of ["history", "program", "stats"]) {
      await tab(page, view);
      const clear = await page.evaluate(async (v) => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await new Promise((r) => setTimeout(r, 200));
        const bar = document.querySelector("#miniBar").getBoundingClientRect();
        const leaves = [...document.querySelectorAll(`#${v} *`)].filter((el) => el.children.length === 0 && el.getClientRects().length
          && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden"
          && getComputedStyle(el).position !== "fixed" && !el.closest("[hidden],.hidden,[inert]"));
        const lowest = Math.max(...leaves.map((el) => el.getBoundingClientRect().bottom));
        return { lowest, barTop: bar.top };
      }, view);
      assert(clear.lowest <= clear.barTop + 1, `${view}: scrolled to the end, nothing is left under the bar`, clear);
    }

    phase("Resume and a tap on the bar open the current exercise");
    await tab(page, "history");
    await page.click("#miniBarResume");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    const opened = await page.evaluate(() => ({ selected: window.__repforgeWorkoutDraft.current().session.selectedExerciseId,
      shown: document.querySelector("#workout .exercise.is-current")?.dataset.ex || null, bar: !document.querySelector("#miniBar")?.classList.contains("hidden") }));
    assert(opened.selected === shape.ids[2] && (!opened.shown || opened.shown === shape.ids[2]) && !opened.bar,
      "Resume opens Focus on the current exercise, and the bar gives way to it", { opened, current: shape.ids[2] });
    // Coordinator note (2026-10-24): an effort window of one value reads "RIR 1", never "RIR 1–1".
    const rir = await page.evaluate(() => ({
      one: singleRir("3 × 8–10 reps · RIR 1–1"), comma: singleRir("3 × 8–10 reps · RIR 1,5–1,5"), range: singleRir("3 × 8–10 reps · RIR 1–2"),
      shown: document.querySelector("#workout .exercise.is-current .focus-ex__meta")?.textContent || "" }));
    assert(rir.one === "3 × 8–10 reps · RIR 1" && rir.comma === "3 × 8–10 reps · RIR 1,5" && rir.range === "3 × 8–10 reps · RIR 1–2"
      && !/RIR (\S+)–\1(?![\d.,])/.test(rir.shown), "the Focus meta line names a one-value effort window once", rir);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
    await tab(page, "program");
    await page.locator("#miniBar .minibar__title").click();
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    assert(await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId) === shape.ids[2],
      "a tap on the bar opens the current exercise too");
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });

    phase("A rest: the bar is the rest timer, and no pill floats");
    await page.evaluate(() => window.startRest(120));
    await page.waitForTimeout(400);
    const onToday = await above(page);
    assert(!onToday.restBar && /^Rest \d:\d\d$/.test(onToday.tag) && !onToday.bar,
      "Today: the live card's tag reads the rest, and no rest pill floats", onToday);
    await tab(page, "history");
    const resting = await above(page);
    assert(resting.bar && !resting.restBar && resting.floating.length === 1, "History: one bar, and no separate rest pill", resting);
    assert(/^Rest \d:\d\d$/.test(resting.title) && /^Next: set \d+ · .+/.test(resting.sub) && resting.plus,
      "the bar reads Rest and the clock, the next set, and offers +30s", resting);
    // One line, whatever the exercise's name (coordinator review, 2026-10-24): a long name ends in an ellipsis, and the
    // text is whole for assistive technology.
    const line = await page.evaluate(() => {
      const sub = document.querySelector("#miniBar .minibar__sub"), style = getComputedStyle(sub);
      const name = window.__repforgeWorkoutDraft.current().exercises[window.__repforgeWorkoutDraft.current().session.selectedExerciseId]?.displayName;
      sub.textContent = sub.textContent.replace(/ · .*$/, " · Single-arm cable rear delt fly with a long name"); // the longest case
      const lines = Math.round(sub.getBoundingClientRect().height / parseFloat(style.lineHeight));
      return { lines, ellipsis: style.textOverflow, whiteSpace: style.whiteSpace, text: sub.textContent, name };
    });
    assert(line.lines === 1 && line.ellipsis === "ellipsis" && line.whiteSpace === "nowrap" && /long name$/.test(line.text),
      "the rest line keeps one line, ends in an ellipsis, and keeps its whole text", line);
    const before = await page.evaluate(() => window.restLeftMs());
    await page.click("#miniBarPlus");
    const after = await page.evaluate(() => ({ left: window.restLeftMs(), shell: !document.querySelector("#workoutShell")?.classList.contains("hidden") }));
    assert(after.left - before > 25000 && after.left - before < 35000 && !after.shell, "+30s extends the real rest and opens nothing", { before, after });

    phase("The rest ends: Rest done, then the session again");
    await page.evaluate(() => { window.__repforgeRest.expire(2); window.syncRest(); });
    await page.waitForTimeout(300);
    const done = await above(page);
    assert(/^Rest done \+\d:\d\d$/.test(done.title) && /^Set \d+ · .+/.test(done.sub) && !done.plus && !done.restBar, "just after the bell the bar says Rest done and counts the overrun", done);
    await page.evaluate(() => { window.__repforgeRest.expire(20); window.syncRest(); });
    await page.waitForTimeout(300);
    const back = await above(page);
    assert(back.title === "Day 1" && /^Exercise /.test(back.sub) && !back.restBar, "a moment later it is the session's bar again", back);
    await page.evaluate(() => window.stopRest());

    phase("Pushed pages and Settings hide the bar");
    await page.evaluate(() => window.showSettings());
    await page.waitForTimeout(300);
    assert(!(await above(page)).bar, "Settings hides the bar");
    // Settings is pushed over the dock; leaving it for a root tab brings the bar back.
    await page.evaluate(() => window.navTo("program"));
    await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active") && !document.body.classList.contains("is-settings"), undefined, { timeout: 5000 });
    await page.waitForTimeout(250);
    assert((await above(page)).bar, "back on a root tab, the bar returns");
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("Reduced motion: the bar does not animate");
  {
    const { context, page, errors } = await freshPage(browser, { reducedMotion: "reduce" });
    await shapeSession(page);
    await tab(page, "stats");
    const a = await above(page);
    assert(a.bar && a.loops === 0, "the bar is drawn and nothing in it animates", a);
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }
  // The bar as the owner saw it on an iPhone (2026-10-31): no ring, the words carry the state, the pills' words sit in
  // their middles (flex and line-height 1, so no font's metrics can lift them), and the tab's end clears the bar plus
  // the dock, at 390 and 320, in both languages, at the usual and double text.
  phase("The bar's words and pills hold at every size: centred labels, no ring, nothing left under it");
  for (const width of [390, 320]) for (const lang of ["en", "pt"]) for (const text of ["normal", "text200"]) {
    const opened = await openCatalogState(browser, "history/minibar-rest", width, lang, text);
    try {
      const m = await opened.page.evaluate(async () => {
        const bar = document.querySelector("#miniBar"), nav = document.querySelector("nav").getBoundingClientRect(), box = bar.getBoundingClientRect();
        const pills = ["#miniBarPlus", "#miniBarResume"].map((sel) => {
          const pill = bar.querySelector(sel), r = pill.getBoundingClientRect(), range = document.createRange();
          range.selectNodeContents(pill); const words = range.getBoundingClientRect();
          return { sel, off: +((words.top + words.height / 2) - (r.top + r.height / 2)).toFixed(2), height: Math.round(r.height),
            within: words.left >= r.left - .5 && words.right <= r.right + .5 };
        });
        // To the end of whichever box scrolls the tab (the document, or a scrolling ancestor of the view).
        let scroller = document.querySelector("#history").parentElement;
        while (scroller && !(scroller.scrollHeight > scroller.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
        (scroller || document.scrollingElement).scrollTop = 1e7;
        window.scrollTo(0, 1e7);
        await new Promise((resolve) => setTimeout(resolve, 250));
        const top = bar.getBoundingClientRect().top;
        // What is drawn: not hidden, not clipped out of sight by a box that hides its overflow (a pane off to the side), and
        // not inside a closed disclosure (still measured, never shown).
        const clipped = (el) => { const r = el.getBoundingClientRect();
          for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
            if (getComputedStyle(n).overflow === "visible") continue;
            const c = n.getBoundingClientRect(); if (r.bottom <= c.top || r.top >= c.bottom || r.right <= c.left || r.left >= c.right) return true;
          } return false; };
        const leaves = [...document.querySelectorAll("#history *")].filter((el) => el.children.length === 0 && el.getClientRects().length
          && el.getBoundingClientRect().height > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).position !== "fixed"
          && !el.closest("[hidden],.hidden,[inert]") && !clipped(el) && !(el.closest("details:not([open])") && !el.closest("summary")));
        return { pills, rings: bar.querySelectorAll(".minibar__ring").length, line: !!bar.querySelector(".minibar__line .minibar__fill"),
          gap: Math.round(nav.top - box.bottom), lowest: Math.max(...leaves.map((el) => el.getBoundingClientRect().bottom)), barTop: top,
          title: bar.querySelector(".minibar__title").textContent };
      });
      assert(m.pills.every((p) => Math.abs(p.off) <= 1 && p.within && p.height >= 44), `[${lang} ${width} ${text}] +30s and Resume: 44 px pills with their words centred within 1 px`, m.pills);
      assert(m.rings === 0 && m.line && m.gap === 8 && /\d:\d\d$/.test(m.title), `[${lang} ${width} ${text}] no ring: the words and the top edge's light, 8 px above the dock`, m);
      assert(m.lowest <= m.barTop + 1, `[${lang} ${width} ${text}] scrolled to the end, nothing on the tab is left under the bar`, m);
    } finally {
      await opened.context.close();
    }
  }
  {
    const opened = await openCatalogState(browser, "history/minibar-rest", 390, "en", "normal");
    try {
      const held = await opened.page.evaluate(() => { restPaused = Math.max(1000, restLeftMs()); syncRest(); paintSessionRest();
        const bar = document.querySelector("#miniBar"); return { title: bar.querySelector(".minibar__title").textContent, paused: bar.classList.contains("is-paused") }; });
      assert(/^Paused \d:\d\d$/.test(held.title) && held.paused, "held, the bar says Paused and the held time, as the tab does", held);
    } finally {
      await opened.context.close();
    }
  }

} finally {
  await browser.close();
}

console.log(`\nMini bar: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
