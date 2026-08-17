#!/usr/bin/env node
/**
 * Today's completed-session state: once a session is saved for the calendar day,
 * the Home tab recaps it instead of offering the same day again.
 * Run: node test/today-done.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
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

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeEnterWorkout === "function",
    { timeout: 15000 }
  );
}

async function clearState(page) {
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
}

async function persistState(page, state) {
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
}

async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

function ymd(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function readState(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
}

/** Log rows for one saved session of `day`, two sets per exercise template. */
function sessionRows(program, day, date, load = 60) {
  const session = `${date}_${day}_seed`;
  const created = `${date}T12:00:00.000Z`;
  const rows = [];
  for (const ex of program.filter((e) => e.day === day)) {
    for (let set = 1; set <= 2; set++) {
      rows.push({
        session, date, day, name: ex.name, exerciseId: ex.id, set,
        load, reps: ex.min || 8, rir: 1, notes: "", created,
        primary: ex.primary, secondary: ex.secondary,
      });
    }
  }
  return rows;
}

async function todayView(page) {
  return page.evaluate(() => {
    const visible = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.classList.contains("hidden");
    };
    const text = (sel) => document.querySelector(sel)?.textContent?.trim() || "";
    return {
      label: text("#todaySessionLabel"),
      session: text("#todaySession"),
      hasDoneCard: !!document.querySelector(".today-done"),
      prLine: text(".today-done__pr"),
      hasExercisePreview: !!document.querySelector("#todayExList"),
      startVisible: visible("#startWorkout"),
      viewExVisible: visible("#viewExercises"),
      reviewVisible: visible("#reviewTodaySession"),
      anotherVisible: visible("#logAnotherSession"),
      startText: text("#startWorkout"),
      upNext: text("#todayUpNext"),
      footer: text("#todayLast"),
      i18n: {
        doneLabel: window.RepForgeI18n.t("today.done_label"),
        sessionLabel: window.RepForgeI18n.t("today.session_label"),
        start: window.RepForgeI18n.t("today.start"),
        continue: window.RepForgeI18n.t("today.continue"),
      },
    };
  });
}

async function logAndSaveToday(page, day) {
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d, focus: false }), day);
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.evaluate((d) => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    for (const ex of (state.program || []).filter((e) => e.day === d)) {
      for (let n = 1; n <= (ex.sets || 1); n++) {
        for (const [suffix, val] of [["load", 60], ["reps", ex.min || 8], ["rir", 1]]) {
          const el = document.querySelector(`[data-k="${ex.id}_${n}_${suffix}"]`);
          if (!el) continue;
          el.value = String(val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    }
  }, day);
  await page.evaluate(async () => {
    await window.__repforgeSaveWorkout();
    await window.__repforgeStorage?.flush?.();
  });
  await page.waitForFunction(
    () => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || []).length > 0,
    { timeout: 8000 }
  );
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
}

const browser = await launchChromium();

console.log("\nToday — completed session state");

// ---------------------------------------------------------------------------
// 1. Saving a session through the UI flips Today out of its start state
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const before = await todayView(page);
  assert(
    before.startVisible && !before.reviewVisible && !before.hasDoneCard,
    "Untrained day: Today offers the start CTA",
    JSON.stringify({ start: before.startVisible, review: before.reviewVisible, card: before.hasDoneCard })
  );
  assert(before.startText === before.i18n.start, "Untrained day: CTA reads Start workout", before.startText);

  await logAndSaveToday(page, "Day 1");
  const after = await todayView(page);
  assert(after.hasDoneCard, "Saved session: Today renders the completed-session recap", after.session);
  assert(
    !after.startVisible && !after.viewExVisible,
    "Saved session: the start CTA and View exercises are gone",
    JSON.stringify({ start: after.startVisible, viewEx: after.viewExVisible })
  );
  assert(
    after.reviewVisible && after.anotherVisible,
    "Saved session: Today offers review and an explicit log-another action",
    JSON.stringify({ review: after.reviewVisible, another: after.anotherVisible })
  );
  assert(after.label === after.i18n.doneLabel, "Saved session: section label switches to the done label", after.label);
  assert(
    !after.hasExercisePreview,
    "Saved session: the completed day's exercise preview is not re-offered",
    after.session
  );
  assert(
    after.session.includes("Day 1") && /\d/.test(after.session),
    "Saved session: the recap names the day that was trained and what it held",
    after.session
  );
  assert(!after.upNext.includes("Day 1"), "Saved session: Up next moves past the day just trained", after.upNext);
  assert(after.upNext.includes("Day 2"), "Saved session: Up next points at the following program day", after.upNext);
  assert(after.prLine === "", "First session of a lift is not counted as a record", after.prLine);
  await context.close();
}

// ---------------------------------------------------------------------------
// 1b. Beating a previous best does show up in the recap
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, {
    ...state,
    log: [...sessionRows(state.program, "Day 1", ymd(-7), 50), ...sessionRows(state.program, "Day 1", ymd(0), 60)],
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(/\d/.test(view.prLine), "Recap reports the records broken today", view.prLine);
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. A reload of a day already trained never returns to the start state
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, { ...state, log: sessionRows(state.program, "Day 1", ymd(0)) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(view.hasDoneCard && !view.startVisible, "Reload after training: Today stays in the done state", JSON.stringify(view));
  assert(view.footer === "", "Reload after training: the footer drops its redundant Trained today line", view.footer);

  const opened = await page.evaluate(() => {
    document.querySelector("#logAnotherSession").click();
    return {
      day: document.querySelector("#woDayTitle")?.textContent?.trim(),
      shell: !document.querySelector("#workoutShell")?.classList.contains("hidden"),
    };
  });
  assert(
    opened.shell && opened.day === "Day 2",
    "Log another session opens the next program day, not the one already done",
    JSON.stringify(opened)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. The recap hands off to the saved session on History
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  const rows = sessionRows(state.program, "Day 1", ymd(0));
  await persistState(page, { ...state, log: rows });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  await page.click("#reviewTodaySession");
  await page.waitForSelector("#history.view.active", { timeout: 5000 });
  const opened = await page.evaluate((session) => {
    const art = document.querySelector(`#sessions [data-sess="${session}"]`);
    return { found: !!art, open: !!art?.classList.contains("is-open") };
  }, rows[0].session);
  assert(opened.found && opened.open, "View today's session opens that session on History", JSON.stringify(opened));
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Yesterday's session leaves today's suggestion alone
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const state = await readState(page);
  await persistState(page, { ...state, log: sessionRows(state.program, "Day 1", ymd(-1)) });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const view = await todayView(page);
  assert(
    view.startVisible && !view.hasDoneCard && view.hasExercisePreview,
    "Trained yesterday: Today still offers a session to start",
    JSON.stringify({ start: view.startVisible, card: view.hasDoneCard, preview: view.hasExercisePreview })
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 5. A second session already in progress outranks the recap
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  await logAndSaveToday(page, "Day 1");
  assert((await todayView(page)).hasDoneCard, "Second session: starts from the done state");

  await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 2", focus: false }));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const ex = (state.program || []).find((e) => e.day === "Day 2");
    for (const [suffix, val] of [["load", 40], ["reps", 8], ["rir", 1]]) {
      const el = document.querySelector(`[data-k="${ex.id}_1_${suffix}"]`);
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });

  const view = await todayView(page);
  assert(
    view.startVisible && !view.hasDoneCard && view.startText === view.i18n.continue,
    "Unsaved second session: Today reverts to Continue workout",
    JSON.stringify({ start: view.startVisible, card: view.hasDoneCard, cta: view.startText })
  );
  await context.close();
}

await browser.close();

console.log(`\nToday done-state: ${results.passed} passed, ${results.failed} failed`);
if (pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(results.failed > 0 ? 1 : 0);
