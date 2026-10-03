#!/usr/bin/env node
/**
 * Today's Start / Continue control stays in reach above the dock (#303).
 *
 * Driven through the real Today screen on compact and ordinary phones, in EN
 * and PT:
 *
 *   - while the prescription scrolls, `#startWorkout` stays on screen, floating
 *     a deliberate gap above the dock and never touching or overlapping it;
 *   - the gap is derived from the dock reservation (`--nav` plus the safe area),
 *     so it is the same on every viewport;
 *   - at the end of the page the control is back in the flow above Choose
 *     another day, which stays an ordinary flow control, and nothing under the
 *     control is left covered;
 *   - Continue (a draft with progress) takes the same placement;
 *   - a spent day and a device with no program leave no floating surface.
 *
 * Run: node test/today-sticky-start.mjs
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

async function freshPage(browser, { width, height, locale }) {
  const context = await browser.newContext({ viewport: { width, height }, locale, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((res) => { const r = indexedDB.deleteDatabase("repforge"); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

/** Where the control sits against the dock and the content around it. */
const geometry = (page) => page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el || !el.getClientRects().length) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  };
  const cta = document.querySelector("#startWorkout");
  const style = cta ? getComputedStyle(cta) : null;
  // The reservation the dock asks every bottom layer to respect, resolved by the browser.
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;height:calc(var(--nav) + env(safe-area-inset-bottom))";
  document.body.append(probe);
  const reserve = probe.getBoundingClientRect().height;
  probe.remove();
  return {
    cta: box("#startWorkout"), dock: box("nav"), other: box("#chooseAnotherDay"), session: box("#todaySession"),
    week: box("#todayWeek"), last: box("#todayLast"),
    display: style?.display || "", position: style?.position || "", text: cta?.textContent?.trim() || "",
    otherPosition: getComputedStyle(document.querySelector("#chooseAnotherDay")).position,
    reserve, inner: window.innerHeight, scroll: window.scrollY,
    max: document.documentElement.scrollHeight - window.innerHeight,
    keys: { start: window.RepForgeI18n.t("today.start"), cont: window.RepForgeI18n.t("today.continue") },
  };
});

const scrollTo = async (page, y) => {
  await page.evaluate((v) => window.scrollTo(0, v === "end" ? document.documentElement.scrollHeight : v), y);
  await page.waitForTimeout(80);
};

/** Floating: on screen, clear of the dock by the reservation's gap, in front of the prescription. */
function floats(g) {
  const gap = g.dock ? g.dock.top - g.cta.bottom : NaN;
  const fromReserve = g.inner - g.reserve - g.cta.bottom;
  return g.cta && g.dock && g.cta.top >= 0 && gap >= 8 && gap <= 20 && Math.abs(fromReserve - 12) <= 1.5;
}

const browser = await launchChromium();

for (const [width, height] of [[320, 568], [390, 844]]) {
  for (const locale of ["en-US", "pt-BR"]) {
    phase(`Today ${width}×${height}, ${locale}`);
    const { context, page } = await freshPage(browser, { width, height, locale });

    // No program: the control is hidden and nothing floats in its place.
    let g = await geometry(page);
    assert(g.display === "none" && !g.cta, "with no program the Start control is gone and leaves no floating surface", JSON.stringify(g));

    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
    await page.waitForSelector("#startWorkout:not(.hidden)", { timeout: 5000 });
    await scrollTo(page, 0);
    g = await geometry(page);
    assert(g.text === g.keys.start && g.position === "sticky", "Today offers Start as a sticky control", JSON.stringify({ text: g.text, position: g.position }));
    assert(g.max > 0, "the prescription is long enough to scroll on this phone", JSON.stringify({ max: g.max }));
    assert(floats(g), "at the top of Today, Start floats a deliberate gap above the dock, derived from --nav and the safe area",
      JSON.stringify({ cta: g.cta, dock: g.dock, reserve: g.reserve, inner: g.inner }));
    const sessionUnder = g.session && g.session.bottom > g.cta.top;
    assert(sessionUnder, "the prescription runs on beneath the floating control", JSON.stringify({ cta: g.cta, session: g.session }));

    await scrollTo(page, Math.round(g.max / 3));
    const mid = await geometry(page);
    if (mid.other && mid.other.top > mid.inner - mid.reserve) {
      assert(floats(mid), "part way down, Start stays in the same place above the dock", JSON.stringify({ cta: mid.cta, dock: mid.dock, scroll: mid.scroll }));
    }

    await scrollTo(page, "end");
    g = await geometry(page);
    assert(g.cta && g.other && g.cta.bottom <= g.other.top + 0.5 && g.otherPosition === "static",
      "at the end of Today, Start is back in the flow above Choose another day, which stays an ordinary control",
      JSON.stringify({ cta: g.cta, other: g.other, otherPosition: g.otherPosition }));
    assert(g.cta.bottom <= g.dock.top && (!g.week || g.cta.bottom <= g.week.top) && (!g.last || !g.last.top || g.cta.bottom <= g.last.top),
      "scrolled to the end, nothing under the control stays covered", JSON.stringify({ cta: g.cta, week: g.week, last: g.last }));

    // Continue: a draft with progress takes the same placement.
    const day = seedProgram()[0].day;
    await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), day);
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    await page.evaluate(async () => {
      const draft = window.__repforgeWorkoutDraft.current();
      const id = draft.session.selectedExerciseId || Object.keys(draft.exercises)[0];
      const setId = draft.exercises[id].setOrder[0];
      await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId: id, setId, field: "load", value: "60" });
      await window.__repforgeWorkoutDraft.flush();
    });
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
    await scrollTo(page, 0);
    g = await geometry(page);
    assert(g.text === g.keys.cont && floats(g), "Continue takes the same floating place above the dock",
      JSON.stringify({ text: g.text, cta: g.cta, dock: g.dock }));

    await context.close();
  }
}

// A spent day recaps instead of offering the session again: no floating control.
phase("Spent day");
{
  const { context, page } = await freshPage(browser, { width: 390, height: 844, locale: "en-US" });
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const program = seedProgram();
  const day = program[0].day;
  const rows = program.filter((e) => e.day === day).flatMap((ex) => [1, 2].map((set) => ({
    session: `${today}_${day}_seed`, date: today, day, name: ex.name, exerciseId: ex.id, set,
    load: 60, reps: 8, rir: 1, notes: "", created: `${today}T12:00:00.000Z`, primary: ex.primary, secondary: ex.secondary,
  })));
  await page.evaluate(async ({ k, rows }) => {
    const state = JSON.parse(localStorage.getItem(k) || "{}");
    state.log = rows;
    localStorage.setItem(k, JSON.stringify(state));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, rows });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.waitForSelector("#reviewTodaySession:not(.hidden)", { timeout: 5000 });
  const g = await geometry(page);
  assert(g.display === "none" && !g.cta, "a spent day hides Start and leaves no floating surface", JSON.stringify({ display: g.display, cta: g.cta }));
  await context.close();
}

await browser.close();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
