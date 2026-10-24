#!/usr/bin/env node
/**
 * Today with a workout in progress: one live card (owner, 2026-10-23, option A).
 *
 * Driven through the real Today screen with a real DraftV2 session, built by the
 * draft's own commands (one lift done, one partly done, one skipped, the next one
 * selected):
 *
 *   - the session's name appears once, in the card, and nothing floats above the
 *     dock: no "Session in progress" band, no session label and day heading, no
 *     floating Continue; the card leads straight into the rows, with no verdict
 *     tally, prescription heading or column heads;
 *   - the card says where the lifter is and how many sets are done, and its bar
 *     matches the share;
 *   - each row's leading mark and subtitle say how that lift stands: done, partial,
 *     skipped, current, and a lift not started keeps its "Last …" line;
 *   - Resume and a tap on the card open Focus on the current exercise;
 *   - reduced motion leaves the live dot still;
 *   - with no workout open, Today is unchanged: Start, the label and the heading.
 *
 * Run: node test/today-live-card.mjs
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
    if (detail != null) console.log(`    ${detail}`);
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

/** Open the day, then shape the session with the draft's own commands: all of the first lift's working sets done,
 *  one of the second's, the third skipped and the fourth selected. Returns the exercise ids in the draft's order. */
async function shapeSession(page) {
  const day = seedProgram()[0].day;
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), day);
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  const order = await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft;
    const draft = api.current();
    const ids = draft.exerciseOrder.slice();
    const working = (id) => draft.exercises[id].setOrder.filter((setId) => draft.exercises[id].sets[setId].role !== "warmup");
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
    await api.dispatch("skipExercise", { exerciseInstanceId: ids[2] });
    await api.dispatch("selectExercise", { exerciseInstanceId: ids[3] });
    await api.flush();
    const now = api.current();
    return { ids, working: ids.map((id) => working(id).length), done: ids.map((id) => now.exercises[id].setOrder
      .filter((setId) => now.exercises[id].sets[setId].role !== "warmup" && now.exercises[id].sets[setId].completion !== "pending").length),
      selected: now.session.selectedExerciseId, name: now.program?.dayLabel || null };
  });
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(450);
  return order;
}

/** What Today shows: the card, the rows' marks and subtitles, and anything else that names or resumes the session. */
const reading = (page) => page.evaluate(() => {
  const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const card = document.querySelector("#todayLive .today-live");
  const name = card?.querySelector(".today-live__name")?.textContent || "";
  const dash = document.querySelector("#todayDash");
  // Every visible text node that is exactly the session name, anywhere on Today.
  const walker = document.createTreeWalker(dash, NodeFilter.SHOW_TEXT);
  let occurrences = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (name && node.textContent.trim() === name && shown(node.parentElement)) occurrences++;
  }
  const rows = [...document.querySelectorAll("#todayExList [data-context-row]")].map((row) => ({
    id: row.dataset.contextRow,
    mark: row.querySelector(".rxstat")?.className.replace("rxstat ", "") || (row.querySelector(".verdictmark") ? "verdict" : ""),
    sub: row.querySelector(".rxrow__sub")?.textContent || "",
    current: row.classList.contains("is-current"),
    weight: getComputedStyle(row.querySelector(".rxrow__name")).fontWeight,
  }));
  const fill = card?.querySelector(".today-live__fill"), bar = card?.querySelector(".today-live__bar");
  const dot = card ? getComputedStyle(card.querySelector(".today-live__dot"), "::after") : null;
  const program = document.querySelector("#todayProgram"), host = document.querySelector("#todayLive");
  return {
    card: shown(card), name, occurrences,
    tag: card?.querySelector('[data-live="elapsed"]')?.textContent || "",
    where: card?.querySelector('[data-live="where"]')?.textContent || "",
    share: fill && bar ? Math.round(100 * fill.getBoundingClientRect().width / bar.getBoundingClientRect().width) : null,
    resume: card?.querySelector("#todayLiveResume")?.textContent.trim() || "",
    underProgram: !!program && !!host && program.compareDocumentPosition(host) === Node.DOCUMENT_POSITION_FOLLOWING
      && host.getBoundingClientRect().top >= program.getBoundingClientRect().bottom - 1,
    start: shown(document.querySelector("#startWorkout")),
    startText: document.querySelector("#startWorkout span")?.textContent || "",
    label: shown(document.querySelector("#todaySessionLabel")),
    heading: shown(document.querySelector("#todaySession .today-session__name--day")),
    band: !!document.querySelector(".today-resume__band"),
    tally: shown(document.querySelector("#todaySession .today-tally")),
    rxHead: shown(document.querySelector("#todaySession .today-rx__head")),
    cols: shown(document.querySelector("#todaySession .today-rx__cols")),
    figures: [...document.querySelectorAll("#todayExList .rxrow")].map((row) => [row.querySelector(".rxrow__load")?.textContent || "", row.querySelector(".rxrow__target")?.textContent || ""]),
    dotAnimation: dot?.animationName || "", dotDisplay: dot?.display || "",
    rows,
  };
});

const browser = await launchChromium();
try {
  phase("No workout open: Today is unchanged");
  {
    const { context, page, errors } = await freshPage(browser);
    const r = await reading(page);
    assert(!r.card && r.start && r.startText === "Start workout" && r.label && r.heading && r.rxHead && r.cols,
      "Start, the session label, the day heading and the prescription head, and no live card",
      JSON.stringify({ card: r.card, start: r.start, label: r.label, heading: r.heading, head: r.rxHead, cols: r.cols }));
    assert(r.rows.length > 4 && r.rows.every((row) => row.mark !== "rxstat--done" && !row.current),
      "the rows carry their verdicts, with no session marks", JSON.stringify(r.rows));
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("A workout in progress: one live card");
  {
    const { context, page, errors } = await freshPage(browser);
    const s = await shapeSession(page);
    const r = await reading(page);
    const [done, partial, skipped, current, notStarted] = s.ids;
    const total = s.working.reduce((sum, n, i) => sum + (i === 2 ? 0 : n), 0);
    const doneSets = s.done.reduce((sum, n, i) => sum + (i === 2 ? 0 : n), 0);
    assert(r.card && r.underProgram, "one live card stands right under the program block", JSON.stringify({ card: r.card, underProgram: r.underProgram }));
    assert(r.occurrences === 1, "the session's name appears exactly once on Today", JSON.stringify({ name: r.name, occurrences: r.occurrences }));
    assert(!r.start && !r.label && !r.heading && !r.band,
      "no floating Continue, no session label, no repeated day heading and no in-progress band",
      JSON.stringify({ start: r.start, label: r.label, heading: r.heading, band: r.band }));
    assert(!r.tally && !r.rxHead && !r.cols && r.figures.length > 4 && r.figures.every(([load, target]) => load && target),
      "the card leads straight into the rows: no verdict tally, heading row or column heads, and each row keeps its load and target",
      JSON.stringify({ tally: r.tally, head: r.rxHead, cols: r.cols, figures: r.figures }));
    assert(/^In progress · \d+ min$/.test(r.tag), "the tag reads In progress and the time so far", r.tag);
    assert(r.where === `Exercise 3 of ${s.ids.length - 1} · ${doneSets} of ${total} sets`,
      "it says where the lifter is, skipped lifts left out, and how many sets are done", JSON.stringify({ where: r.where, s }));
    assert(Math.abs(r.share - Math.round(100 * doneSets / total)) <= 2, "the bar fills to the share of sets done", JSON.stringify({ share: r.share, doneSets, total }));
    assert(r.resume === "Resume workout", "its action is Resume workout", r.resume);
    const row = (id) => r.rows.find((item) => item.id === id) || {};
    assert(row(done).mark === "rxstat--done" && row(done).sub === `${s.done[0]} of ${s.working[0]} sets`,
      "a finished lift: a filled check and its sets", JSON.stringify(row(done)));
    assert(row(partial).mark === "rxstat--partial" && row(partial).sub === `1 of ${s.working[1]} sets`,
      "a lift part done: a filled ring and its sets", JSON.stringify(row(partial)));
    assert(row(skipped).mark === "rxstat--skipped" && row(skipped).sub === "Skipped today",
      "a skipped lift: an empty ring and Skipped today", JSON.stringify(row(skipped)));
    assert(row(current).mark === "rxstat--current" && row(current).sub === "Up next" && row(current).current && +row(current).weight >= 600,
      "the current lift: an accent ring, its name in semibold, and Up next", JSON.stringify(row(current)));
    assert(!row(notStarted).mark.startsWith("rxstat") && /^Last |^First time/.test(row(notStarted).sub),
      "a lift not started keeps its verdict and its Last line", JSON.stringify(row(notStarted)));
    assert(r.dotAnimation === "taurifer-live-dot", "the live dot pulses", r.dotAnimation);

    phase("Resume opens Focus on the current exercise");
    await page.click("#todayLiveResume");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    await page.waitForSelector("#workout .exercise.is-current", { timeout: 5000 });
    const opened = await page.evaluate(() => ({ selected: window.__repforgeWorkoutDraft.current().session.selectedExerciseId,
      shown: document.querySelector("#workout .exercise.is-current")?.dataset.ex || document.querySelector("#workout .exercise.is-current")?.dataset.exerciseId || null }));
    assert(opened.selected === current && (!opened.shown || opened.shown === current),
      "Resume opens the session on the current exercise", JSON.stringify({ opened, current }));

    phase("A tap on the card opens it too");
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
    await page.waitForTimeout(450);
    await page.locator("#todayLive .today-live__name").click();
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    const tapped = await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId);
    assert(tapped === current, "a tap anywhere on the card opens the current exercise", JSON.stringify({ tapped, current }));
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }

  phase("Reduced motion: the dot is still");
  {
    const { context, page, errors } = await freshPage(browser, { reducedMotion: "reduce" });
    await shapeSession(page);
    const r = await reading(page);
    assert(r.card && r.dotAnimation === "none", "the live dot does not pulse", JSON.stringify({ card: r.card, dot: r.dotAnimation, display: r.dotDisplay }));
    assert(errors.length === 0, "no page errors", errors.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\nToday live card: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
