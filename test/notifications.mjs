#!/usr/bin/env node
/** Focused Playwright checks for notification surfaces. Requires http://localhost:8000/ */
import { chromium } from "playwright";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const NOTIFY_META = "repforge_notify_v1";

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

async function clearState(page) {
  await page.evaluate(
    async ({ k, d, n }) => {
      localStorage.removeItem(k);
      localStorage.removeItem(d);
      localStorage.removeItem(n);
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT, n: NOTIFY_META }
  );
}

async function waitForApp(page) {
  await page.waitForSelector("#dayTabs button", { timeout: 10000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function")
      window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function")
      window.closeTour();
  });
  await page.waitForFunction(
    () => typeof window.RepForgeSchedule === "object" && !!window.RepForgeSchedule.mostOverdueDay,
    { timeout: 10000 }
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
  const context = await browser.newContext();
  const origin = new URL(BASE).origin;
  await context.grantPermissions(["notifications"], { origin });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

function ymdDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setRows(ex, day, date, created, load = 60) {
  const session = `${date}_${day}_notify_${ex.id}`;
  const specs = Array.from({ length: ex.sets || 2 }, () => ({ reps: ex.min || 8, rir: 1 }));
  return specs.map((s, i) => ({
    session,
    date,
    day,
    name: ex.name,
    exerciseId: ex.id,
    set: i + 1,
    load,
    reps: s.reps,
    rir: s.rir,
    notes: "",
    created,
    primary: ex.primary,
    secondary: ex.secondary,
  }));
}

async function readDefaultState(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
}

async function day1Exercise(page) {
  return page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return (raw.program || []).find((e) => e.day === "Day 1") || (raw.program || [])[0];
  });
}

async function enableNotify(state, overrides = {}) {
  return {
    ...state,
    settings: {
      ...state.settings,
      notify: {
        enabled: true,
        timer: true,
        session: true,
        unfinished: true,
        missed: true,
        ...overrides,
      },
    },
  };
}

const browser = await chromium.launch({ headless: true });

console.log("\nNotification surfaces");

// ---------------------------------------------------------------------------
// 1. Settings persist
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  await page.click('nav button[data-view="settings"]');
  await page.waitForSelector("#notifyEnabled", { state: "visible" });

  await page.check("#notifyEnabled");
  // Let the master-toggle save (and its async IDB write) finish before changing
  // a type flag — rapid back-to-back commits can race on IndexedDB.
  await page.waitForFunction(async () => {
    const ls = JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.settings?.notify;
    if (!ls?.enabled) return false;
    try {
      const idb = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("kv", "readonly");
          const g = tx.objectStore("kv").get("repforge_v1");
          g.onsuccess = () => { db.close(); res(g.result); };
          g.onerror = () => { db.close(); rej(g.error); };
        };
        r.onerror = () => rej(r.error);
      });
      return idb?.settings?.notify?.enabled === true;
    } catch {
      return false;
    }
  });
  await page.uncheck("#notifyMissed");
  await page.waitForFunction(async () => {
    const ls = JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.settings?.notify;
    if (!(ls?.enabled === true && ls?.missed === false)) return false;
    try {
      const idb = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("kv", "readonly");
          const g = tx.objectStore("kv").get("repforge_v1");
          g.onsuccess = () => { db.close(); res(g.result); };
          g.onerror = () => { db.close(); rej(g.error); };
        };
        r.onerror = () => rej(r.error);
      });
      const n = idb?.settings?.notify;
      return n?.enabled === true && n?.missed === false;
    } catch {
      return false;
    }
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.click('nav button[data-view="settings"]');
  await page.waitForSelector("#notifyEnabled", { state: "visible" });

  const checks = await page.evaluate(() => ({
    enabled: document.querySelector("#notifyEnabled")?.checked,
    missed: document.querySelector("#notifyMissed")?.checked,
    stored: JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.settings?.notify,
  }));
  assert(
    checks.enabled === true && checks.missed === false,
    "Settings persist: master on, missed off after reload",
    JSON.stringify(checks)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 2. Overdue banner (soft variant) — exactly one session → usualHour null
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const ex = await day1Exercise(page);
  const date = ymdDaysAgo(2);
  const created = new Date(`${date}T12:00:00Z`).toISOString();
  const rows = setRows(ex, "Day 1", date, created);
  let state = await enableNotify(await readDefaultState(page));
  state = { ...state, log: rows };
  await persistState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const info = await page.evaluate(() => {
    const el = document.querySelector("#sessionBanner");
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const days = [...new Set((raw.program || []).map((e) => e.day))];
    const ymd = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
    const due = RepForgeSchedule.mostOverdueDay(raw.log, days, ymd);
    const usual = RepForgeSchedule.usualHour(raw.log);
    return {
      hidden: el?.classList.contains("hidden"),
      isMissed: el?.classList.contains("is-missed"),
      text: el?.textContent || "",
      dueDay: due?.day || null,
      usual,
      className: el?.className || "",
    };
  });

  assert(!info.hidden, "Soft banner: #sessionBanner visible", JSON.stringify(info));
  assert(!info.isMissed, "Soft banner: no is-missed class", JSON.stringify(info));
  assert(info.usual === null, "Soft banner: usualHour is null (1 session)", String(info.usual));
  assert(
    info.dueDay && info.text.includes(info.dueDay),
    "Soft banner: day matches mostOverdueDay",
    JSON.stringify(info)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 3. Missed variant (escalated) — 2+ sessions at local midnight → usualHour=0
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const ex = await day1Exercise(page);
  const d1 = ymdDaysAgo(5);
  const d2 = ymdDaysAgo(3);

  const createds = await page.evaluate(([a, b]) => {
    const mk = (ymd) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0).toISOString();
    };
    return [mk(a), mk(b)];
  }, [d1, d2]);

  const rows = [
    ...setRows(ex, "Day 1", d1, createds[0]),
    ...setRows(ex, "Day 1", d2, createds[1], 62.5),
  ];
  // Distinct sessions via different dates already
  let state = await enableNotify(await readDefaultState(page));
  state = { ...state, log: rows };
  await persistState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const info = await page.evaluate(() => {
    const el = document.querySelector("#sessionBanner");
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return {
      hidden: el?.classList.contains("hidden"),
      isMissed: el?.classList.contains("is-missed"),
      className: el?.className || "",
      text: el?.textContent || "",
      usual: RepForgeSchedule.usualHour(raw.log),
    };
  });

  assert(info.usual === 0, "Missed banner: usualHour is 0", String(info.usual));
  assert(!info.hidden && info.isMissed, "Missed banner: #sessionBanner.is-missed", JSON.stringify(info));
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Banner dismissal — soft dismiss persists for the day
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  const ex = await day1Exercise(page);
  const date = ymdDaysAgo(2);
  const created = new Date(`${date}T12:00:00Z`).toISOString();
  let state = await enableNotify(await readDefaultState(page));
  state = { ...state, log: setRows(ex, "Day 1", date, created) };
  await persistState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const before = await page.evaluate(() => {
    const el = document.querySelector("#sessionBanner");
    return { hidden: el?.classList.contains("hidden"), isMissed: el?.classList.contains("is-missed") };
  });
  assert(!before.hidden && !before.isMissed, "Dismiss setup: soft banner visible", JSON.stringify(before));

  await page.click(".sessionbanner__close");
  const afterClick = await page.evaluate(() => ({
    hidden: document.querySelector("#sessionBanner")?.classList.contains("hidden"),
    meta: JSON.parse(localStorage.getItem("repforge_notify_v1") || "{}"),
  }));
  assert(afterClick.hidden, "Dismiss: banner hidden after ✕", JSON.stringify(afterClick));
  assert(
    afterClick.meta.sessionBannerDismissed === true,
    "Dismiss: sessionBannerDismissed in meta",
    JSON.stringify(afterClick.meta)
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const afterReload = await page.evaluate(() => ({
    hidden: document.querySelector("#sessionBanner")?.classList.contains("hidden"),
    meta: JSON.parse(localStorage.getItem("repforge_notify_v1") || "{}"),
  }));
  assert(afterReload.hidden, "Dismiss: stays hidden after reload", JSON.stringify(afterReload));
  assert(
    afterReload.meta.sessionBannerDismissed === true,
    "Dismiss: meta survives reload",
    JSON.stringify(afterReload.meta)
  );
  await context.close();
}

// ---------------------------------------------------------------------------
// 5. ?goto=Day 2 selects day tab and strips query
// ---------------------------------------------------------------------------
{
  const { context, page } = await freshPage(browser);
  await page.goto(BASE + "?goto=" + encodeURIComponent("Day 2"), { waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const gotoInfo = await page.evaluate(() => {
    const sel = document.querySelector('#dayTabs button[aria-selected="true"]');
    return {
      label: sel?.textContent?.trim() || sel?.dataset?.day || null,
      search: location.search,
      href: location.href,
    };
  });
  assert(gotoInfo.label === "Day 2", '?goto=Day 2: selected tab is Day 2', JSON.stringify(gotoInfo));
  assert(!gotoInfo.search.includes("goto"), "?goto=Day 2: query stripped", JSON.stringify(gotoInfo));
  await context.close();
}

// ---------------------------------------------------------------------------
// 6. Unfinished reopen — draft idle ≥15 min → prompt
// ---------------------------------------------------------------------------
let unfinishedCtx = null;
let unfinishedPage = null;
{
  const { context, page } = await freshPage(browser);
  unfinishedCtx = context;
  unfinishedPage = page;

  let state = await enableNotify(await readDefaultState(page), { unfinished: true });
  await persistState(page, state);

  const lastCommitAt = Date.now() - 16 * 60 * 1000;
  await page.evaluate(
    ({ d, at }) => {
      localStorage.setItem(d, JSON.stringify({ __done: ["x_1"], __lastCommitAt: at }));
    },
    { d: DRAFT, at: lastCommitAt }
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const unfinished = await page.evaluate(() => {
    const el = document.querySelector("#unfinishedBanner");
    return {
      prompt: document.body.dataset.unfinishedPrompt,
      hidden: el?.classList.contains("hidden") || el?.hidden === true,
      meta: JSON.parse(localStorage.getItem("repforge_notify_v1") || "{}"),
      draft: JSON.parse(localStorage.getItem("repforge_draft_v1") || "{}"),
    };
  });
  assert(
    unfinished.prompt === "1",
    'Unfinished reopen: body.dataset.unfinishedPrompt === "1"',
    JSON.stringify(unfinished)
  );
  assert(!unfinished.hidden, "Unfinished reopen: #unfinishedBanner visible", JSON.stringify(unfinished));
  assert(
    unfinished.meta.unfinishedPromptedFor === lastCommitAt,
    "Unfinished reopen: unfinishedPromptedFor recorded",
    JSON.stringify(unfinished.meta)
  );
}

// ---------------------------------------------------------------------------
// 7. Unfinished single-reminder — reload without changing draft → no re-prompt
// ---------------------------------------------------------------------------
{
  const page = unfinishedPage;
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);

  const again = await page.evaluate(() => {
    const el = document.querySelector("#unfinishedBanner");
    return {
      prompt: document.body.dataset.unfinishedPrompt,
      hidden: !el || el.classList.contains("hidden") || el.hidden === true,
      meta: JSON.parse(localStorage.getItem("repforge_notify_v1") || "{}"),
      draft: JSON.parse(localStorage.getItem("repforge_draft_v1") || "{}"),
    };
  });
  assert(
    again.prompt !== "1",
    "Unfinished single-reminder: prompt does not reappear",
    JSON.stringify(again)
  );
  assert(
    again.hidden,
    "Unfinished single-reminder: #unfinishedBanner not shown",
    JSON.stringify(again)
  );
  assert(
    typeof again.meta.unfinishedPromptedFor === "number" &&
      again.meta.unfinishedPromptedFor === again.draft.__lastCommitAt,
    "Unfinished single-reminder: unfinishedPromptedFor matches draft",
    JSON.stringify({ meta: again.meta, draftAt: again.draft.__lastCommitAt })
  );
  await unfinishedCtx.close();
}

await browser.close();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
