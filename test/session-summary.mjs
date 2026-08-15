#!/usr/bin/env node
/**
 * The screen a finished session earns: what it claims, what it refuses to
 * claim, and what it does to the app underneath it.
 *
 * Covers the record rules (a lift with no history sets none; load outranks
 * reps outranks e1RM), the counts, the muscle and week blocks, the baseline
 * copy a first session gets instead of records, dialog behaviour (focus trap,
 * Escape, background inert), where each action lands, and the toast fallback
 * for a save that cannot open the screen.
 *
 * Run: node test/session-summary.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

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

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Two days: Day 1 carries the lifts under test, Day 2 exists so "Next up" has
 *  somewhere to point and the week has more than one planned session. */
const TEMPLATES = [
  ["Day 1", "Bench press", 2, 6, 10, "Chest", "Triceps"],
  ["Day 1", "Barbell row", 2, 6, 10, "Mid/upper back", "Biceps"],
  ["Day 1", "Dumbbell curl", 1, 8, 12, "Biceps", ""],
  ["Day 2", "Back squat", 2, 4, 8, "Quads", "Glutes"],
];

function fixture({ log = [] } = {}) {
  const perDay = new Map();
  const program = TEMPLATES.map(([day, name, sets, min, max, primary, secondary], i) => {
    const order = (perDay.get(day) || 0) + 1;
    perDay.set(day, order);
    return { id: `ex${i}`, day, order, name, sets, min, max, primary, secondary, notes: "", alternates: [] };
  });
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "prog-summary", name: "Summary fixture", started: isoDaysAgo(14),
      created: "2026-07-01T00:00:00.000Z", updated: "2026-07-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 2, splitType: "full_body",
      equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
    },
    program,
    log,
    programHistory: [],
  };
}

/** One past session on Day 1 so records have a bar to clear. */
function history(date, rows) {
  const session = `${date}_Day 1_seed`;
  return rows.map(([exerciseId, name, set, load, reps, rir, primary, secondary]) => ({
    session, date, day: "Day 1", name, exerciseId, set, load, reps, rir,
    notes: "", created: `${date}T12:00:00.000Z`, primary, secondary,
  }));
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function seed(page, state) {
  await page.evaluate(
    async ({ k, d }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT }
  );
  await page.evaluate(
    async ({ k, blob }) => {
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
    },
    { k: KEY, blob: state }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

/** Fill and commit one set through the Focus well, the way a lifter logs it. */
async function logSet(page, exId, n, load, reps, rir) {
  await page.evaluate(
    ({ exId, n, load, reps, rir }) => {
      for (const [suffix, val] of [["load", load], ["reps", reps], ["rir", rir]]) {
        const el = document.querySelector(`[data-k="${exId}_${n}_${suffix}"]`);
        if (!el) continue;
        el.value = String(val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.querySelector(`.saveset[data-save="${exId}_${n}"]`)?.click();
    },
    { exId, n, load, reps, rir }
  );
  await page.waitForTimeout(90);
}

async function enterLog(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
}

async function finish(page) {
  await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
  await settleStats(page);
}

/** The stat row spins up to its numbers, so read it once it has landed. */
async function settleStats(page) {
  const read = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("#sessionSummary .sum-stats .statrow__val")]
        .map((n) => n.textContent)
        .join("|")
    );
  await page.waitForTimeout(900);
  let prev = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(100);
    const now = await read();
    if (now === prev) return;
    prev = now;
  }
}

const readSummary = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("#sessionSummary");
    const body = document.querySelector("#sessionSummaryBody");
    const txt = (sel) => [...body.querySelectorAll(sel)].map((n) => n.textContent.trim());
    return {
      open: !el.classList.contains("hidden") && el.hidden === false,
      eyebrow: body.querySelector(".sum-eyebrow")?.textContent.trim() || "",
      hero: body.querySelector(".sum-hero")?.textContent.trim() || "",
      sub: body.querySelector(".sum-sub")?.textContent.trim() || "",
      statCaps: txt(".sum-stats .statrow__cap"),
      statVals: txt(".sum-stats .statrow__val"),
      prBadges: txt(".sum-pr__badge"),
      prNames: txt(".sum-pr__name"),
      prOver: txt(".sum-pr__over"),
      prVals: txt(".sum-pr__val"),
      more: body.querySelector(".sum-more")?.textContent.trim() || "",
      chips: txt(".sum-chip"),
      baseline: body.querySelector(".sum-baseline")?.textContent.trim() || "",
      muscles: txt(".sum-muscles .vrow__name"),
      muscleNums: txt(".sum-muscles .vrow__num"),
      week: body.querySelector(".sum-week")?.textContent.trim() || "",
      weekDone: body.querySelectorAll(".sum-segbar .segbar__seg.is-done").length,
      weekSegs: body.querySelectorAll(".sum-segbar .segbar__seg").length,
      next: body.querySelector(".sum-next__day")?.textContent.trim() || "",
      focused: document.activeElement?.id || "",
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      data: window.__repforgeSessionSummary.current(),
    };
  });

/** openModal marks body-level children inert; probe the branch holding the app. */
const appInert = (page) =>
  page.evaluate(() => {
    const view = document.querySelector("#log");
    const root = [...document.body.children].find((c) => c.contains(view));
    return root?.inert === true;
  });

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  // ---- 1 — a session with history behind it -----------------------------------
  phase("A session that beat its last one");
  const last = isoDaysAgo(7);
  await seed(
    page,
    fixture({
      log: history(last, [
        ["ex0", "Bench press", 1, 60, 8, 1, "Chest", "Triceps"],
        ["ex0", "Bench press", 2, 60, 7, 1, "Chest", "Triceps"],
        ["ex1", "Barbell row", 1, 50, 8, 1, "Mid/upper back", "Biceps"],
        ["ex1", "Barbell row", 2, 50, 8, 1, "Mid/upper back", "Biceps"],
        ["ex2", "Dumbbell curl", 1, 10, 8, 1, "Biceps", ""],
      ]),
    })
  );
  await enterLog(page);
  // Bench goes up in load, row holds the load and adds reps, curl repeats itself.
  await logSet(page, "ex0", 1, 62.5, 8, 1);
  await logSet(page, "ex0", 2, 62.5, 7, 1);
  await logSet(page, "ex1", 1, 50, 10, 1);
  await logSet(page, "ex1", 2, 50, 9, 1);
  await logSet(page, "ex2", 1, 10, 8, 1);
  await finish(page);
  let s = await readSummary(page);

  assert(s.open, "finishing opens the session summary", JSON.stringify({ open: s.open }));
  assert(/session saved/i.test(s.eyebrow), "the screen names the moment", s.eyebrow);
  assert(s.hero === "Day 1", "the hero is the training day just finished", s.hero);
  assert(s.statVals[0] === "5" && /^sets logged$/.test(s.statCaps[0]), "sets logged leads the stat row", JSON.stringify(s.statVals));
  // 62.5×8 + 62.5×7 + 50×10 + 50×9 + 10×8 = 1967.5 kg through the hands.
  assert(s.statVals[1] === "1,968" && /kg moved/.test(s.statCaps[1]), "volume is the load actually moved", JSON.stringify([s.statVals[1], s.statCaps[1]]));
  assert(s.statVals[2] === "3" && /^lifts$/.test(s.statCaps[2]), "the third figure counts lifts, not sets again", JSON.stringify(s.statVals));

  assert(s.prBadges.length === 2, "only the lifts that set a record get a line", JSON.stringify(s.prBadges));
  assert(s.prBadges[0] === "Load" && s.prNames[0] === "Bench press", "a load record outranks a reps record", JSON.stringify([s.prBadges, s.prNames]));
  assert(/\+2\.5 kg over your best/.test(s.prOver[0]), "a load record says how much heavier", s.prOver[0]);
  assert(s.prVals[0] === "62.5 kg × 8", "the record line carries the set that set it", s.prVals[0]);
  assert(s.prBadges[1] === "Reps" && s.prNames[1] === "Barbell row", "holding the load and adding reps is a reps record", JSON.stringify([s.prBadges, s.prNames]));
  assert(/\+2 reps at that load/.test(s.prOver[1]), "a reps record says how many more reps", s.prOver[1]);
  assert(
    !s.prNames.includes("Dumbbell curl"),
    "repeating last session's numbers sets no record",
    JSON.stringify(s.prNames)
  );
  assert(!s.more, "three records or fewer need no overflow line", s.more);

  assert(s.chips.some((c) => /2 improved/.test(c)), "the lift counts are on the screen", JSON.stringify(s.chips));
  assert(!s.baseline, "a session with history is not called a baseline", s.baseline);
  assert(
    s.muscles.join(",") === "Chest,Mid/upper back,Biceps,Triceps" && /^2 sets$/.test(s.muscleNums[0]),
    "hard sets break down by muscle, and direct work outranks an equal share of assisting",
    JSON.stringify([s.muscles, s.muscleNums])
  );
  assert(
    s.muscles.includes("Triceps") && /^1 set$/.test(s.muscleNums[3]),
    "a muscle that only assisted still earns its half sets",
    JSON.stringify([s.muscles, s.muscleNums])
  );
  assert(/1 of 2 sessions/.test(s.week), "the week says where the session leaves it", s.week);
  assert(s.weekSegs === 2 && s.weekDone === 1, "the week bar fills the session just logged", JSON.stringify({ segs: s.weekSegs, done: s.weekDone }));
  assert(s.next === "Day 2", "the next training day is named", s.next);
  assert(!s.pageScrollsX, "the summary never scrolls the page sideways");

  // ---- 2 — the dialog holds the app -------------------------------------------
  phase("The screen behaves like the dialog it is");
  assert(s.focused === "sumTitle", "focus lands on the summary, not behind it", s.focused);
  assert(await appInert(page), "the app underneath is inert while the summary is up");
  const trap = await page.evaluate(() => {
    const stops = [...document.querySelectorAll("#sessionSummary button")].map((b) => b.id);
    document.querySelector("#sumSee")?.focus();
    return { stops, last: document.activeElement?.id };
  });
  assert(
    trap.stops.join(",") === "sumDone,sumSee" && trap.last === "sumSee",
    "both actions are reachable by keyboard",
    JSON.stringify(trap)
  );

  // ---- 3 — Escape ends the session ---------------------------------------------
  phase("Leaving the summary ends the session");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterEsc = await page.evaluate(() => {
    const shown = (sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== "none";
    };
    return {
      hidden: document.querySelector("#sessionSummary").classList.contains("hidden"),
      shellHidden: document.querySelector("#workoutShell").classList.contains("hidden"),
      dashHidden: document.querySelector("#todayDash").classList.contains("hidden"),
      focused: document.activeElement?.id || "",
      startShown: shown("#startWorkout"),
      reviewShown: shown("#reviewTodaySession"),
    };
  });
  assert(afterEsc.hidden, "Escape closes the summary");
  assert(!(await appInert(page)), "closing releases the app");
  assert(afterEsc.shellHidden && !afterEsc.dashHidden, "the workout shell steps back to Today", JSON.stringify(afterEsc));
  // The session just saved is today's, so Today leads with the recap's review
  // action instead of the start CTA — that is what focus has to find.
  assert(
    !afterEsc.startShown && afterEsc.reviewShown,
    "Today leads with the recap once the session is saved",
    JSON.stringify(afterEsc)
  );
  assert(afterEsc.focused === "reviewTodaySession", "focus lands on what Today asks for next", afterEsc.focused);

  // ---- 4 — a first session has no records to claim -----------------------------
  phase("A first session is a baseline, not a record");
  await seed(page, fixture());
  await enterLog(page);
  await logSet(page, "ex2", 1, 12.5, 10, 1);
  await finish(page);
  s = await readSummary(page);
  assert(!s.prBadges.length, "a lift with no history sets no personal record", JSON.stringify(s.prBadges));
  assert(/baseline/i.test(s.baseline), "the screen says what a first session is instead", s.baseline);
  assert(!s.chips.length, "a baseline is not also counted as a new lift", JSON.stringify(s.chips));
  assert(
    s.statVals[0] === "1" && s.statCaps[0] === "set logged",
    "one set reads as one set, not '1 sets'",
    JSON.stringify([s.statVals[0], s.statCaps[0]])
  );

  // ---- 5 — where the actions land ----------------------------------------------
  phase("See the session lands on the session");
  await page.click("#sumSee");
  await page.waitForTimeout(250);
  const hist = await page.evaluate(() => ({
    view: document.querySelector(".view.active")?.id,
    open: document.querySelectorAll("#sessions .session.is-open").length,
    summaryHidden: document.querySelector("#sessionSummary").classList.contains("hidden"),
  }));
  assert(hist.view === "history", "See the session opens History", JSON.stringify(hist));
  assert(hist.open === 1, "the session it opens is the one just finished", JSON.stringify(hist));
  assert(hist.summaryHidden, "the summary closes on its way out", JSON.stringify(hist));

  // ---- 6 — the toast still covers a save the screen cannot ----------------------
  phase("A save that cannot open the screen still reports itself");
  await seed(page, fixture());
  await enterLog(page);
  await logSet(page, "ex2", 1, 15, 10, 1);
  const fallback = await page.evaluate(async () => {
    // Strip the host so openSessionSummary has nothing to open, the way a
    // stripped shell or an older cached index.html would leave it.
    document.querySelector("#sessionSummary")?.remove();
    await window.__repforgeSaveWorkout();
    return {
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
      logged: (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || []).length,
    };
  });
  assert(fallback.logged === 1, "the session is saved either way", JSON.stringify(fallback));
  assert(/saved/i.test(fallback.toast), "the toast stands in for the screen", fallback.toast);

  assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nsession summary: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
