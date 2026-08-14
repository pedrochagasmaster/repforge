#!/usr/bin/env node
/** Focused Playwright checks for notification surfaces. Requires http://localhost:8000/ */
import { launchChromium } from "./browser.mjs";

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
  await context.addInitScript(() => {
    let perm = "granted";
    window.__repforgeNotifyAdapter = {
      canUse() { return true; },
      permission() { return perm; },
      async request() { return perm; },
    };
    window.__repforgeNotifyTest = {
      setPermission(p) { perm = p; },
    };
  });
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

const browser = await launchChromium();

console.log("\nNotification surfaces");

// ---------------------------------------------------------------------------
// 1. Settings persist
// ---------------------------------------------------------------------------
{
  const { context, page } = await notifyContext(browser, { permission: "granted", mode: "auto", autoResult: "granted" });
  await openNotifySettings(page);

  await page.locator("#notifyToggle").click();
  await waitNotifyIdle(page);
  await page.waitForFunction(() => document.querySelector("#notifyMissed") && !document.querySelector("#notifyMissed").disabled);

  await page.locator("#notifyConfigRow").click();
  await page.waitForSelector("#notifyTypes.is-open", { timeout: 3000 });
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
  await openNotifySettings(page);

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

async function notifyContext(browser, adapter) {
  const context = await browser.newContext();
  await context.addInitScript((opts) => {
    let perm = opts.permission;
    let requestCount = 0;
    const waiters = [];
    window.__repforgeNotifyAdapter = {
      canUse() {
        return perm !== "unsupported";
      },
      permission() {
        return perm === "unsupported" ? "unsupported" : perm;
      },
      async request() {
        const generation = ++requestCount;
        if (perm === "unsupported") return "unsupported";
        if (opts.mode === "auto") {
          perm = opts.autoResult;
          return opts.autoResult;
        }
        return new Promise((resolve) => {
          waiters.push({ generation, resolve });
        });
      },
    };
    window.__repforgeNotifyTest = {
      requestCount() {
        return requestCount;
      },
      setPermission(p) {
        perm = p;
      },
      resolve(p) {
        perm = p;
        const q = waiters.splice(0);
        q.forEach(({ resolve }) => resolve(p));
      },
      resolveGeneration(generation, p) {
        const index = waiters.findIndex((waiter) => waiter.generation === generation);
        if (index < 0) return false;
        perm = p;
        const [{ resolve }] = waiters.splice(index, 1);
        resolve(p);
        return true;
      },
      pending() {
        return waiters.length;
      },
      pendingGenerations() {
        return waiters.map((waiter) => waiter.generation);
      },
    };
  }, adapter);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

async function openNotifySettings(page) {
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await page.waitForSelector("#notifyToggle");
}

async function notifyUi(page) {
  await page.evaluate(async () => {
    if (window.__repforgeStorage?.flush) await window.__repforgeStorage.flush();
  });
  return page.evaluate(async () => {
    const stored = JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.settings?.notify || {};
    let idbNotify = null;
    try {
      const idb = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction("kv", "readonly");
          const g = tx.objectStore("kv").get("repforge_v1");
          g.onsuccess = () => {
            db.close();
            res(g.result);
          };
          g.onerror = () => {
            db.close();
            rej(g.error);
          };
        };
        r.onerror = () => rej(r.error);
      });
      idbNotify = idb?.settings?.notify || null;
    } catch {
      idbNotify = null;
    }
    const tog = document.querySelector("#notifyToggle");
    const types = [...document.querySelectorAll("#notifyTypes input")];
    return {
      storedEnabled: !!stored.enabled,
      storedMissed: stored.missed !== false,
      storedTimer: stored.timer !== false,
      storedSession: stored.session !== false,
      storedUnfinished: stored.unfinished !== false,
      idbEnabled: idbNotify ? !!idbNotify.enabled : null,
      idbMissed: idbNotify ? idbNotify.missed !== false : null,
      pressed: tog?.getAttribute("aria-pressed"),
      busy: tog?.getAttribute("aria-busy"),
      name: tog?.getAttribute("aria-label") || "",
      typesDisabled: types.length > 0 && types.every((i) => i.disabled),
      status: document.querySelector("#notifyPermStatus")?.textContent || "",
      requestCount: window.__repforgeNotifyTest?.requestCount?.() ?? null,
      pending: window.__repforgeNotifyTest?.pending?.() ?? null,
      pendingGenerations: window.__repforgeNotifyTest?.pendingGenerations?.() ?? [],
    };
  });
}

async function waitNotifyIdle(page) {
  await page.waitForFunction(() => document.querySelector("#notifyToggle")?.getAttribute("aria-busy") !== "true", {
    timeout: 8000,
  });
  await page.evaluate(async () => {
    if (window.__repforgeStorage?.flush) await window.__repforgeStorage.flush();
  });
}

console.log("\nNotification permission truth (UX-04)");

{
  const { context, page } = await notifyContext(browser, { permission: "unsupported", mode: "auto", autoResult: "unsupported" });
  await openNotifySettings(page);
  const before = await notifyUi(page);
  assert(before.storedEnabled === false && before.pressed === "false" && before.typesDisabled, "unsupported: starts off with types disabled", JSON.stringify(before));
  assert(before.name.trim().length > 0, "unsupported: toggle has an accessible name", JSON.stringify(before));
  await page.locator("#notifyToggle").click();
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  const next = await page.evaluate(() => window.RepForgeI18n?.t("settings.notifications.next.unsupported"));
  assert(after.storedEnabled === false && after.idbEnabled === false && after.pressed === "false" && after.typesDisabled, "unsupported: enable does not persist on", JSON.stringify(after));
  assert(typeof next === "string" && next && after.status.includes(next), "unsupported: status shows next-step copy", JSON.stringify({ status: after.status, next }));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "auto", autoResult: "default" });
  await openNotifySettings(page);
  await page.locator("#notifyToggle").click();
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  const next = await page.evaluate(() => window.RepForgeI18n?.t("settings.notifications.next.prompt"));
  assert(after.storedEnabled === false && after.pressed === "false" && after.typesDisabled, "default: request result does not persist enabled", JSON.stringify(after));
  assert(typeof next === "string" && next && after.status.includes(next), "default: status shows prompt next-step copy", JSON.stringify({ status: after.status, next }));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "auto", autoResult: "denied" });
  let seeded = await enableNotify(await readDefaultState(page), { enabled: false, missed: false });
  seeded.settings.notify.enabled = false;
  seeded.settings.notify.missed = false;
  await persistState(page, seeded);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await openNotifySettings(page);
  const before = await notifyUi(page);
  assert(before.storedMissed === false && before.storedEnabled === false, "denied setup: missed off while master off", JSON.stringify(before));
  await page.locator("#notifyToggle").click();
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  const next = await page.evaluate(() => window.RepForgeI18n?.t("settings.notifications.next.denied"));
  assert(after.storedEnabled === false && after.pressed === "false" && after.typesDisabled, "denied: request result stores disabled", JSON.stringify(after));
  assert(after.storedMissed === false && after.idbMissed === false, "denied: reminder-type preference survives failed permission", JSON.stringify(after));
  assert(typeof next === "string" && next && after.status.includes(next), "denied: status shows denied next-step copy", JSON.stringify({ status: after.status, next }));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "auto", autoResult: "granted" });
  await openNotifySettings(page);
  await page.locator("#notifyToggle").click();
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  const granted = await page.evaluate(() => window.RepForgeI18n?.t("settings.notifications.status.granted"));
  assert(after.storedEnabled === true && after.idbEnabled === true && after.pressed === "true" && after.typesDisabled === false, "granted: stores enabled and unlocks types", JSON.stringify(after));
  assert(after.busy !== "true", "granted: pending busy clears", JSON.stringify(after));
  assert(typeof granted === "string" && granted && after.status.toLowerCase().includes(granted.toLowerCase()), "granted: status names granted permission", JSON.stringify({ status: after.status, granted }));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "granted", mode: "auto", autoResult: "granted" });
  let state = await enableNotify(await readDefaultState(page), { missed: false });
  await persistState(page, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await openNotifySettings(page);
  const on = await notifyUi(page);
  assert(on.storedEnabled === true && on.pressed === "true" && on.storedMissed === false && on.typesDisabled === false, "revocation setup: enabled with missed off", JSON.stringify(on));
  await page.evaluate(() => {
    window.__repforgeNotifyTest.setPermission("denied");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}")?.settings?.notify?.enabled === false);
  const off = await notifyUi(page);
  assert(off.storedEnabled === false && off.idbEnabled === false && off.pressed === "false" && off.typesDisabled, "revocation: visibilitychange turns effective enabled off", JSON.stringify(off));
  assert(off.storedMissed === false && off.idbMissed === false, "revocation: reminder-type choices are preserved", JSON.stringify(off));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "manual" });
  await openNotifySettings(page);
  await page.locator("#notifyToggle").click();
  await page.waitForFunction(
    () => window.__repforgeNotifyTest?.pendingGenerations?.().join(",") === "1"
  );

  await page.locator("#notifyToggle").click();
  await page.locator("#notifyToggle").click();
  await page.waitForFunction(
    () =>
      window.__repforgeNotifyTest?.requestCount?.() === 1 &&
      document.querySelector("#notifyToggle")?.getAttribute("aria-busy") === "true"
  );
  const reused = await notifyUi(page);
  assert(
    reused.busy === "true" &&
      reused.requestCount === 1 &&
      reused.pendingGenerations.join(",") === "1",
    "overlap setup: off/on reuses one pending browser permission request",
    JSON.stringify(reused)
  );

  await page.locator("#notifyToggle").click();
  await page.locator("#notifyToggle").click();
  const afterNextClick = await notifyUi(page);
  assert(
    afterNextClick.busy === "true" &&
      afterNextClick.requestCount === 1 &&
      afterNextClick.pendingGenerations.join(",") === "1",
    "overlap: another off/on cannot start another permission request",
    JSON.stringify(afterNextClick)
  );

  await page.evaluate(async () => {
    if (!window.__repforgeNotifyTest.resolveGeneration(1, "granted"))
      throw new Error("permission request generation 1 was not pending");
    await new Promise(requestAnimationFrame);
  });
  const afterSharedSettles = await notifyUi(page);
  assert(
    afterSharedSettles.storedEnabled === true &&
      afterSharedSettles.idbEnabled === true &&
      afterSharedSettles.pressed === "true" &&
      afterSharedSettles.busy === "false" &&
      afterSharedSettles.requestCount === 1 &&
      afterSharedSettles.pending === 0,
    "overlap: shared late grant follows the latest on intent",
    JSON.stringify(afterSharedSettles)
  );
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "manual" });
  await openNotifySettings(page);
  await page.evaluate(() => {
    const c = document.querySelector("#notifyEnabled");
    c.checked = true;
    c.dispatchEvent(new Event("change"));
    c.dispatchEvent(new Event("change"));
  });
  await page.waitForFunction(() => window.__repforgeNotifyTest?.pending?.() >= 1);
  const pending = await notifyUi(page);
  assert(
    pending.storedEnabled === false && pending.pressed === "false" && pending.busy === "true" && pending.requestCount === 1,
    "pending: does not persist enabled, exposes aria-busy, and coalesces duplicate on clicks",
    JSON.stringify(pending)
  );
  await page.locator("#notifyToggle").click();
  await page.evaluate(() => window.__repforgeNotifyTest.resolve("granted"));
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  assert(after.storedEnabled === false && after.pressed === "false" && after.busy !== "true", "late grant after off does not turn the setting back on", JSON.stringify(after));
  await context.close();
}

{
  const { context, page } = await notifyContext(browser, { permission: "default", mode: "manual" });
  await openNotifySettings(page);
  await page.locator("#notifyToggle").click();
  await page.waitForFunction(() => window.__repforgeNotifyTest?.pending?.() === 1);
  await page.evaluate(() => {
    window.__repforgeNotifyTest.setPermission("denied");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.evaluate(() => window.__repforgeNotifyTest.resolve("granted"));
  await waitNotifyIdle(page);
  const after = await notifyUi(page);
  assert(after.storedEnabled === false && after.pressed === "false", "revocation during pending: late grant stays off", JSON.stringify(after));
  await context.close();
}

await browser.close();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
