#!/usr/bin/env node
/**
 * Focus-mode screenshot harness.
 * Drives the app into each state the definitive mockups document and writes a
 * PNG per state, so the implementation can be compared against the references.
 *
 * Run: node test/focus-shots.mjs [outDir]
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const OUT = process.argv[2] || "/tmp/focus-shots";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

// Reference canvas from the mockups (853x1844 @3x ≈ 284x615 CSS) plus a compact
// and a large device, so every state is checked on more than one viewport.
const DEVICES = {
  ref: { width: 393, height: 852, dsr: 2.17 },       // iPhone 15 Pro-ish (mockup ratio)
  compact: { width: 320, height: 568, dsr: 2 },      // iPhone SE 1st gen
  large: { width: 430, height: 932, dsr: 3 },        // iPhone 15 Pro Max
};

/** The app restores from IndexedDB first; write both, like the sim harness. */
async function persist(page, mutate) {
  await page.evaluate(async ({ k, src }) => {
    const blob = JSON.parse(localStorage.getItem(k) || "{}");
    // eslint-disable-next-line no-new-func
    new Function("s", "w", src)(blob, window);
    localStorage.setItem(k, JSON.stringify(blob));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(blob, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, src: mutate });
}

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function boot(page, { lang = "pt", rirMode = "numeric", device = "ref" } = {}) {
  const dev = DEVICES[device];
  await page.setViewportSize({ width: dev.width, height: dev.height });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // Day tabs, not a hoisted function name: boot assigns state asynchronously,
  // and everything below reads it.
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
  await page.evaluate((d) => {
    if (window.stopRest) window.stopRest();
    localStorage.removeItem(d);
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  }, DRAFT);
  await persist(page, `s.settings = { ...(s.settings || {}), lang: ${JSON.stringify(lang)}, rirMode: ${JSON.stringify(rirMode)} };`);
  await page.reload({ waitUntil: "domcontentloaded" });
  // Day tabs, not a hoisted function name: boot assigns state asynchronously,
  // and everything below reads it.
  await page.waitForSelector("#dayTabs button", { state: "attached", timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

/** Enter an active workout in Focus mode at a given exercise index. */
async function enterFocus(page, index = 0) {
  await page.evaluate((i) => {
    window.__repforgeEnterWorkout({ focus: true });
    window.__repforgeFocus.to(i);
  }, index);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
}

/** Seed a previous session for the exercise at focus index `i`. */
async function seedPrev(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    const date = ${JSON.stringify(isoDaysAgo(7))};
    s.log = (s.log || []).concat(${JSON.stringify(sets)}.map((row, n) => ({
      session: date + "_" + ex.day + "_seed", date, day: ex.day, name: ex.name,
      exerciseId: ex.id, set: n + 1, load: row.load, reps: row.reps, rir: row.rir,
      notes: "", created: date + "T12:00:00.000Z", primary: ex.primary, secondary: ex.secondary,
    })));`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.closeOnboarding === "function");
}

/** Give the exercise at focus index `i` a set count, so the busy states are
 *  reachable on the stock program. */
async function setSetCount(page, i, sets) {
  await persist(page, `
    const ex = w.__repforgeFocus.list()[${i}];
    s.program = s.program.map((e) => (e.id === ex.id ? { ...e, sets: ${sets} } : e));`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.closeOnboarding === "function");
}

/** Commit `n` sets on the focused exercise through the real UI path. */
async function logSets(page, n, { load = 100, reps = 4 } = {}) {
  for (let i = 0; i < n; i++) {
    const loadInput = page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_load']");
    if (!(await loadInput.count())) break;
    await loadInput.first().fill(String(load));
    const repsInput = page.locator("#workout .exercise.is-current .focus-well .curset__val[data-k$='_reps']");
    if (await repsInput.count()) await repsInput.first().fill(String(reps));
    await page.locator("#workout .exercise.is-current .focus-well .saveset").first().click();
    await page.waitForTimeout(140);
  }
}

/** Seed a finished session straight into the draft, the way a reload would. */
async function fillWholeSession(page) {
  await page.evaluate(
    ({ d }) => {
      const exs = window.__repforgeFocus.list();
      const draft = { __done: [], __touched: [] };
      for (const ex of exs) {
        for (let n = 1; n <= ex.sets; n++) {
          const key = `${ex.id}_${n}`;
          draft[`${key}_load`] = "70";
          draft[`${key}_reps`] = String(11 - n);
          draft[`${key}_rir`] = String(Math.max(0, 3 - n));
          draft[`${key}_effort`] = "hard";
          draft.__done.push(key);
          draft.__touched.push(key);
        }
      }
      localStorage.setItem(d, JSON.stringify(draft));
    },
    { d: DRAFT }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.closeOnboarding === "function");
}

/** A focus card must never spill its own box: the well is what would go. */
async function checkFit(page, name) {
  const bad = await page.evaluate(() => {
    const card = document.querySelector("#workout.is-focus .exercise.is-current");
    if (!card) return null;
    const over = card.scrollHeight - card.clientHeight;
    const ledger = card.querySelector(".fcard__ledger");
    return {
      overflow: over,
      ledger: ledger ? Math.round(ledger.clientHeight) : 0,
      pageScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (!bad) return;
  const notes = [];
  if (bad.overflow > 1) notes.push(`card overflows by ${bad.overflow}px`);
  if (bad.ledger < 40) notes.push(`ledger only ${bad.ledger}px`);
  if (bad.pageScrollX > 0) notes.push(`page scrolls x by ${bad.pageScrollX}px`);
  if (notes.length) console.log(`    ! ${name}: ${notes.join("; ")}`);
}

async function shot(page, name) {
  mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(180);
  await checkFit(page, name);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`  → ${name}.png`);
}

async function main() {
  // The CI image ships a Chromium under PLAYWRIGHT_BROWSERS_PATH that may not
  // match this playwright build; point at it explicitly when it is there.
  const browser = await launchChromium();
  const ctx = await browser.newContext({ deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  ! page error: ${e.message}`));

  // 01 — new exercise, no history
  await boot(page);
  await enterFocus(page, 0);
  await shot(page, "01-new-exercise");

  // 02 — returning exercise with previous-session context
  await seedPrev(page, 1, [
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 10, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
    { load: 100, reps: 9, rir: 2 },
  ]);
  await enterFocus(page, 1);
  await shot(page, "02-returning-exercise");

  // 03 — mid-exercise, numeric RIR
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  await logSets(page, 2);
  await shot(page, "03-mid-exercise-rir");

  // 07 — active rest timer (same card, timer running)
  await page.evaluate(() => window.startRest(102));
  await shot(page, "07-active-rest");
  await page.evaluate(() => window.stopRest());

  // 06 — editing a previously logged set
  await logSets(page, 1);
  await page.locator(".ledger__row[data-editn]").nth(1).click();
  await shot(page, "06-editing-set");
  const cancel = page.locator("#workout .exercise.is-current .focus-well__cancel");
  if (await cancel.count()) await cancel.click();

  // 08 — note editor sheet
  await page.locator("[data-exnote-open]").first().click();
  await page.waitForSelector("#exNoteSheet:not(.hidden)");
  await page.fill("#exNoteText", "Pés firmes. Manter a lombar apoiada.");
  await shot(page, "08-note-editor");
  await page.locator("#exNoteCancel").click();

  // 04 — effort mode
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 0, 6);
  await enterFocus(page, 0);
  await logSets(page, 4, { load: 7.5, reps: 4 });
  await shot(page, "04-effort-mode");
  // 04b — the effort explainer, popped open off the word it explains
  await page.locator(".exercise.is-current .focus-well [data-effspin]").click();
  await page.waitForTimeout(420);
  await shot(page, "04b-effort-explainer");
  await page.locator(".exercise.is-current .focus-ex__muscle").click();
  await page.waitForTimeout(300);

  // 05 — high-volume exercise with folded history
  await boot(page, { rirMode: "effort" });
  await setSetCount(page, 4, 10);
  await enterFocus(page, 4);
  await logSets(page, 8, { load: 70, reps: 8 });
  await shot(page, "05-folded-history");

  // 09 — exercise complete, another exercise remaining
  await boot(page);
  await setSetCount(page, 0, 3);
  await enterFocus(page, 0);
  await logSets(page, 3);
  await shot(page, "09-exercise-complete");

  // 10 — workout complete on the final exercise
  await boot(page);
  await fillWholeSession(page);
  await enterFocus(page, 5);
  await shot(page, "10-workout-complete");

  // 11 — swipe transition mid-drag
  await boot(page);
  await setSetCount(page, 0, 5);
  await enterFocus(page, 0);
  await logSets(page, 2);
  const card = await page.locator("#workout.is-focus .exercise.is-current").boundingBox();
  await page.mouse.move(card.x + card.width - 20, card.y + 120);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width - 120, card.y + 122, { steps: 6 });
  await page.mouse.move(card.x + 60, card.y + 124, { steps: 10 });
  await shot(page, "11-card-swipe");
  await page.mouse.up();

  // Compact + large viewport sanity for the busiest state
  for (const device of ["compact", "large"]) {
    await boot(page, { device });
    await setSetCount(page, 0, 5);
    await enterFocus(page, 0);
    await logSets(page, 2);
    await shot(page, `vp-${device}`);
    await page.evaluate(() => window.startRest(102));
    await shot(page, `vp-${device}-rest`);
    await page.evaluate(() => window.stopRest());
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
