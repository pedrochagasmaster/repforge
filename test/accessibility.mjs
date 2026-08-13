#!/usr/bin/env node
/** Focused Playwright checks for modal, disclosure, and live-status semantics. Requires the app HTTP server. */
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const DB = "repforge";
const STORE = "kv";

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
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeStorage.flush === "function",
    { timeout: 15000 }
  );
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function")
      window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function")
      window.closeTour();
  });
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

async function idbPut(page, blob) {
  await page.evaluate(
    async ({ k, dbName, storeName, blob }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(dbName, 1);
        r.onupgradeneeded = () => r.result.createObjectStore(storeName);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, dbName: DB, storeName: STORE, blob }
  );
}

function sampleState(overrides = {}) {
  const log = overrides.log || [
    {
      session: "s1",
      date: "2026-01-02",
      day: "Day 1",
      name: "Press",
      exerciseId: "ex1",
      set: 1,
      load: 60,
      reps: 10,
      rir: 1,
      notes: "",
      created: "2026-01-02T00:00:00.000Z",
      primary: "Chest",
      secondary: "",
    },
  ];
  return {
    settings: {
      jumpPct: 2.5,
      minJump: 2.5,
      rirHigh: 2,
      hardRir: 4,
      restSec: 120,
      lastExport: "",
      unit: "kg",
      lang: "en",
      rirMode: "numeric",
      voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: overrides.programId || "prog-a",
      name: overrides.name || "Alpha",
      started: "2026-01-01",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      onboarded: true,
      mesocycleStatus: "active",
      mesocycleLengthWeeks: 6,
      goal: null,
      experience: null,
      daysPerWeek: 3,
      splitType: "full_body",
      equipment: ["machines"],
      priorityMuscles: [],
      sessionLength: "45",
      completedAt: null,
    },
    program: [
      {
        id: "ex1",
        name: "Press",
        day: "Day 1",
        order: 0,
        sets: 3,
        min: 8,
        max: 12,
        primary: "Chest",
        secondary: "",
      },
    ],
    log,
    programHistory: overrides.programHistory || [],
  };
}

async function freshPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  return { context, page };
}

async function modalInfo(page, sel) {
  return page.evaluate((selector) => {
    const el = document.querySelector(selector);
    const host = document.querySelector("#announcementHost");
    const bodyKids = [...document.body.children].map((c) => ({
      id: c.id,
      inert: !!c.inert,
      tag: c.tagName.toLowerCase(),
    }));
    const stops = [...(el?.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])") || [])]
      .filter((n) => getComputedStyle(n).display !== "none")
      .map((n) => n.id || n.tagName);
    return {
      hidden: !el || el.classList.contains("hidden") || el.hidden === true || (el.tagName === "DIALOG" && !el.open),
      open: el?.tagName === "DIALOG" ? !!el.open : !!(el && !el.classList.contains("hidden")),
      active: document.activeElement?.id || document.activeElement?.tagName || null,
      stops,
      hostInert: host ? !!host.inert : null,
      inertIds: bodyKids.filter((c) => c.inert).map((c) => c.id || c.tag),
      liveKids: bodyKids.filter((c) => !c.inert).map((c) => c.id || c.tag),
    };
  }, sel);
}

async function tabWrap(page, sel) {
  await page.keyboard.press("Tab");
  const forward = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    return { id: document.activeElement?.id, inside: !!(root && root.contains(document.activeElement)) };
  }, sel);
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  const back = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    return { id: document.activeElement?.id, inside: !!(root && root.contains(document.activeElement)) };
  }, sel);
  return { forward, back };
}

const browser = await launchChromium();
console.log("\nAccessible interactions (UX-07 / UX-16 / A11Y-02)");

{
  const { context, page } = await freshPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden) #endBlock");
  await page.locator("#endBlock").click();
  let info = await modalInfo(page, "#endBlockConfirm");
  assert(info.open && info.active === "endBlockCancel", "End Block Confirm: initial focus is #endBlockCancel", JSON.stringify(info));
  assert(info.liveKids.includes("endBlockConfirm") && info.liveKids.includes("announcementHost"), "End Block Confirm: dialog and announcement host stay interactive", JSON.stringify(info.liveKids));
  assert(info.inertIds.includes("main") || info.inertIds.length > 0, "End Block Confirm: background is inert", JSON.stringify(info.inertIds));
  const wrap = await tabWrap(page, "#endBlockConfirm");
  assert(wrap.forward.inside && wrap.back.inside, "End Block Confirm: Tab wraps inside", JSON.stringify(wrap));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  await page.waitForFunction(() => document.activeElement?.id === "endBlock");
  info = await modalInfo(page, "#endBlockConfirm");
  const afterEsc = await page.evaluate(() => ({
    hidden: document.querySelector("#endBlockConfirm")?.classList.contains("hidden"),
    active: document.activeElement?.id,
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id),
  }));
  assert(info.hidden && afterEsc.active === "endBlock", "End Block Confirm: Escape is Cancel and returns to #endBlock", JSON.stringify(afterEsc));
  assert(afterEsc.leaked.length === 0, "End Block Confirm: closing restores inertness", JSON.stringify(afterEsc.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click('nav button[data-view="program"]');
  await page.waitForSelector("#program.view.active");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programEditorWrap:not(.is-hidden) #endBlock");
  await page.locator("#endBlock").click();
  await page.locator("#endBlockGo").click();
  const review = await modalInfo(page, "#blockReview");
  const confirmGone = await page.evaluate(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  assert(review.open && review.active === "blockReviewClose", "Block Review: initial focus is #blockReviewClose after handoff", JSON.stringify(review));
  assert(confirmGone, "Block Review: End Block Confirm is hidden after handoff");
  assert(!review.liveKids.includes("endBlockConfirm") || document.querySelector("#endBlockConfirm")?.inert, "Block Review: confirm dialog is not left interactive", JSON.stringify(review.liveKids));
  const wrap = await tabWrap(page, "#blockReview");
  assert(wrap.forward.inside && wrap.back.inside, "Block Review: Tab wraps inside", JSON.stringify(wrap));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  await page.waitForFunction(() => document.activeElement?.id === "endBlock");
  const after = await page.evaluate(() => ({
    hidden: document.querySelector("#blockReview")?.classList.contains("hidden"),
    active: document.activeElement?.id,
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
  }));
  assert(after.hidden && after.active === "endBlock", "Block Review: Escape closes and returns to original #endBlock opener", JSON.stringify(after));
  assert(after.leaked.length === 0, "chained modals do not leak inertness", JSON.stringify(after.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await page.locator("#dataImportRow").click();
  await page.evaluate(() =>
    openImportChoice({
      s: { program: [], log: [], settings: {} },
      inSessions: 1,
      inSets: 1,
      curSessions: 0,
      curSets: 0,
      newSessions: 1,
    })
  );
  let info = await modalInfo(page, "#importChoice");
  assert(info.open && info.active === "importCancel", "Import Choice: initial focus is #importCancel", JSON.stringify(info));
  const wrap = await tabWrap(page, "#importChoice");
  assert(wrap.forward.inside && wrap.back.inside, "Import Choice: Tab wraps inside", JSON.stringify(wrap));
  const outside = await page.evaluate(() => {
    document.querySelector("nav")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return !document.querySelector("#importChoice")?.classList.contains("hidden");
  });
  assert(outside, "Import Choice: outside click does nothing");
  const toastWatch = await page.evaluate(async () => {
    const live = document.querySelector("#toast");
    const host = document.querySelector("#announcementHost");
    const seen = [];
    const mo = new MutationObserver(() => {
      if (live.textContent) seen.push(live.textContent);
    });
    mo.observe(live, { childList: true, characterData: true, subtree: true });
    const raw = JSON.parse(localStorage.getItem("repforge_v1"));
    await window.__repforgeStorage.writeWithAdapter(raw, {
      writeLocal() {
        throw new Error("fail ls");
      },
      async writeIdb() {
        throw new Error("fail idb");
      },
    });
    await new Promise((r) => setTimeout(r, 80));
    mo.disconnect();
    const operable = [...host.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(
      (el) => getComputedStyle(el).display !== "none"
    );
    return {
      seen,
      role: live.getAttribute("role"),
      live: live.getAttribute("aria-live"),
      operable: operable.map((el) => el.id || el.tagName),
      importOpen: !document.querySelector("#importChoice")?.classList.contains("hidden"),
    };
  });
  assert(toastWatch.role === "alert" && toastWatch.live === "assertive", "both-store failure while Import Choice is open uses assertive alert", JSON.stringify(toastWatch));
  assert(toastWatch.operable.length === 0, "#announcementHost contains no operable background content", JSON.stringify(toastWatch.operable));
  assert(toastWatch.importOpen, "Import Choice stays open during the assertive announcement");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#importChoice")?.classList.contains("hidden"));
  const after = await page.evaluate(() => {
    const el = document.activeElement;
    const trigger = !!(
      el?.id === "importJson" ||
      el?.id === "dataImportRow" ||
      el?.closest?.("#dataImportRow, #dataImportPanel, label.file")
    );
    return {
      hidden: document.querySelector("#importChoice")?.classList.contains("hidden"),
      active: el?.id,
      trigger,
    };
  });
  assert(after.hidden && after.trigger, "Import Choice: Escape is Cancel and returns to the import trigger", JSON.stringify(after));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.evaluate(() => {
    localStorage.setItem(
      "repforge_v1",
      JSON.stringify({
        program: [{ id: "a", name: "CopyA", day: "Day 1", order: 0, sets: 2, min: 8, max: 12, primary: "Chest", secondary: "" }],
        log: [{ session: "s1", date: "2026-01-02", day: "Day 1", name: "CopyA", exerciseId: "a", set: 1, load: 50, reps: 8, rir: 1, notes: "", created: "2026-01-02T00:00:00.000Z", primary: "Chest", secondary: "" }],
        settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "", unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false, notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true } },
        programMeta: { id: "prog-a", name: "CopyA", started: "2026-01-01", onboarded: true, mesocycleStatus: "active" },
        programHistory: [],
      })
    );
  });
  const other = sampleState({ name: "Beta", programId: "prog-b" });
  await idbPut(page, other);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#storageRecovery")?.open, { timeout: 15000 });
  const info = await modalInfo(page, "#storageRecovery");
  assert(info.open && (info.active === "storageExportA" || info.active === "storageRetry" || info.active === "storageRecoveryTitle"), "Storage Recovery: initial focus is a non-destructive action", JSON.stringify(info));
  const stillOpen = await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return !!document.querySelector("#storageRecovery")?.open;
  });
  assert(stillOpen, "Storage Recovery: Escape does nothing until resolved");
  await page.locator("#storageUseA").click();
  await waitForApp(page);
  const after = await page.evaluate(() => ({
    open: !!document.querySelector("#storageRecovery")?.open,
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
    heading: document.activeElement?.classList.contains("page-title") || document.activeElement?.id === "startWorkout" || document.activeElement?.closest("#todayDash"),
  }));
  assert(!after.open && after.leaked.length === 0, "Storage Recovery: close restores inertness", JSON.stringify(after));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const noteBtn = page.locator("#workout [data-exnote], #workout .focus-tool, #workout button").filter({ hasText: /note/i }).first();
  const hasNote = await page.locator("#workout [data-exnotebtn], #workout button[data-note], #workout .focus-tool").count();
  await page.evaluate(() => {
    const btn = document.querySelector("[data-exnotebtn], .focus-tool[aria-label], button[data-note]");
    const first = document.querySelector("#workout button.focus-tool, #workout .icon-btn--note, #workout [data-exnote]");
    const opener = [...document.querySelectorAll("#workout button")].find((b) => /note/i.test(b.getAttribute("aria-label") || b.textContent || ""));
    (opener || first)?.click();
  });
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return s && !s.hidden && !s.classList.contains("hidden");
  }, { timeout: 8000 });
  const info = await modalInfo(page, "#exNoteSheet");
  assert(info.open && info.active === "exNoteText", "Exercise Note: initial focus is #exNoteText", JSON.stringify({ ...info, hasNote }));
  const wrap = await tabWrap(page, "#exNoteSheet");
  assert(wrap.forward.inside && wrap.back.inside, "Exercise Note: Tab wraps inside", JSON.stringify(wrap));
  const trigger = await page.evaluate(() => document.activeElement?.id);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => {
    const s = document.querySelector("#exNoteSheet");
    return !s || s.hidden || s.classList.contains("hidden");
  });
  const after = await page.evaluate(() => ({
    hidden: document.querySelector("#exNoteSheet")?.hidden || document.querySelector("#exNoteSheet")?.classList.contains("hidden"),
    leaked: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
  }));
  assert(after.hidden, "Exercise Note: Escape is Cancel and hides the sheet", JSON.stringify({ after, trigger }));
  assert(after.leaked.length === 0, "Exercise Note: close restores inertness", JSON.stringify(after.leaked));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  const rows = [
    ["#restSecRow", "#restSecPanel"],
    ["#rirModeRow", "#rirModePanel"],
    ["#progressionRow", "#progressionDetails"],
    ["#notifyConfigRow", "#notifyTypes"],
    ["#dataBackupRow", "#dataBackupPanel"],
    ["#dataImportRow", "#dataImportPanel"],
  ];
  const start = await page.evaluate((pairs) =>
    pairs.map(([b, p]) => ({
      b,
      expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
      controls: document.querySelector(b)?.getAttribute("aria-controls"),
      open: document.querySelector(p)?.classList.contains("is-open"),
    })), rows);
  assert(
    start.every((r) => r.expanded === "false" && r.controls && r.open === false),
    "all six disclosure buttons start collapsed with aria-controls",
    JSON.stringify(start)
  );
  for (const [btn, panel] of rows) {
    await page.locator(btn).click();
    const open = await page.evaluate(
      ([b, p]) => ({
        expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
        open: document.querySelector(p)?.classList.contains("is-open"),
        controls: document.querySelector(b)?.getAttribute("aria-controls") === p.slice(1),
      }),
      [btn, panel]
    );
    assert(open.expanded === "true" && open.open && open.controls, `${btn} reports and controls its panel when open`, JSON.stringify(open));
    await page.locator(btn).click();
    const closed = await page.evaluate(
      ([b, p]) => ({
        expanded: document.querySelector(b)?.getAttribute("aria-expanded"),
        open: document.querySelector(p)?.classList.contains("is-open"),
      }),
      [btn, panel]
    );
    assert(closed.expanded === "false" && !closed.open, `${btn} collapses its panel`, JSON.stringify(closed));
  }
  await context.close();
}

{
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__repforgeNotifyAdapter = {
      canUse() { return true; },
      permission() { return "granted"; },
      async request() { return "granted"; },
    };
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
  const date = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const ex = (state.program || []).find((e) => e.day === "Day 1") || (state.program || [])[0];
  if (ex) {
    state.settings = {
      ...state.settings,
      notify: { enabled: true, timer: true, session: true, unfinished: true, missed: true },
    };
    state.log = [
      {
        session: `${date}_Day 1_ban`,
        date,
        day: "Day 1",
        name: ex.name,
        exerciseId: ex.id,
        set: 1,
        load: 60,
        reps: 8,
        rir: 1,
        notes: "",
        created: new Date(`${date}T12:00:00Z`).toISOString(),
        primary: ex.primary,
        secondary: ex.secondary,
      },
    ];
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
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    const beforeDay = await page.evaluate(() => document.querySelector('#dayTabs button[aria-selected="true"]')?.dataset?.day);
    await page.locator(".sessionbanner__act").focus();
    await page.keyboard.press("Enter");
    const afterEnter = await page.evaluate(() => ({
      hidden: document.querySelector("#sessionBanner")?.classList.contains("hidden"),
    }));
    assert(afterEnter.hidden, "session banner action activates with Enter", JSON.stringify({ beforeDay, afterEnter }));
    await page.evaluate(
      async ({ k, blob }) => {
        localStorage.setItem(k, JSON.stringify(blob));
        localStorage.removeItem("repforge_notify_v1");
      },
      { k: KEY, blob: state }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    await page.locator(".sessionbanner__act").focus();
    await page.keyboard.press(" ");
    const afterSpace = await page.evaluate(() => document.querySelector("#sessionBanner")?.classList.contains("hidden"));
    assert(afterSpace, "session banner action activates with Space");
    await page.evaluate(
      async ({ k, blob }) => {
        localStorage.setItem(k, JSON.stringify(blob));
        localStorage.removeItem("repforge_notify_v1");
      },
      { k: KEY, blob: state }
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionBanner:not(.hidden) .sessionbanner__act", { timeout: 8000 });
    await page.locator(".sessionbanner__close").focus();
    await page.keyboard.press("Enter");
    const dismissed = await page.evaluate(() => document.querySelector("#sessionBanner")?.classList.contains("hidden"));
    assert(dismissed, "session banner dismiss remains independent of the main action");
  } else {
    assert(false, "session banner fixture could not find an exercise");
  }
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const toastSeq = await page.evaluate(async () => {
    const live = document.querySelector("#toast");
    const seen = [];
    const mo = new MutationObserver(() => {
      const text = live.textContent;
      if (text) seen.push(text);
    });
    mo.observe(live, { childList: true, characterData: true, subtree: true });
    toast("alpha");
    await new Promise((r) => setTimeout(r, 50));
    toast("alpha");
    await new Promise((r) => setTimeout(r, 80));
    const polite = { role: live.getAttribute("role"), live: live.getAttribute("aria-live"), atomic: live.getAttribute("aria-atomic") };
    const raw = JSON.parse(localStorage.getItem("repforge_v1"));
    await window.__repforgeStorage.writeWithAdapter(raw, {
      writeLocal() {
        throw new Error("fail ls");
      },
      async writeIdb() {
        throw new Error("fail idb");
      },
    });
    await new Promise((r) => setTimeout(r, 80));
    const assertive = { role: live.getAttribute("role"), live: live.getAttribute("aria-live") };
    toast("beta");
    await new Promise((r) => setTimeout(r, 80));
    const restored = { role: live.getAttribute("role"), live: live.getAttribute("aria-live") };
    mo.disconnect();
    return { seen, polite, assertive, restored };
  });
  assert(
    toastSeq.polite.role === "status" && toastSeq.polite.live === "polite" && toastSeq.polite.atomic === "true",
    "toast is an atomic polite status region",
    JSON.stringify(toastSeq.polite)
  );
  assert(toastSeq.seen.filter((x) => x === "alpha").length >= 2, "new and repeated-identical toast text appears in mutation-observed order", JSON.stringify(toastSeq.seen));
  assert(toastSeq.assertive.role === "alert" && toastSeq.assertive.live === "assertive", "simulated both-store failure uses the assertive alert path", JSON.stringify(toastSeq.assertive));
  assert(toastSeq.restored.role === "status" && toastSeq.restored.live === "polite", "next routine toast restores polite semantics", JSON.stringify(toastSeq.restored));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const restLive = await page.evaluate(() => document.querySelector("#restBar")?.getAttribute("aria-live"));
  assert(!restLive || restLive === "off", "rest countdown is not a live region", restLive);
  for (const enabled of [false, true]) {
    await page.evaluate((on) => {
      state.settings.notify = { ...(state.settings.notify || {}), enabled: on, timer: true };
    }, enabled);
    await page.evaluate(() => startRest(1));
    await page.waitForFunction(() => (document.querySelector("#restAnnounce")?.textContent || "").trim().length > 0, { timeout: 4000 });
    const first = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const second = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    assert(!!first && first === second, `rest completion announces once (notify ${enabled ? "on" : "off"})`, JSON.stringify({ first, second }));
    await page.evaluate(() => stopRest());
    await page.evaluate(() => startRest(30));
    await page.evaluate(() => {
      window.__repforgeRest.expire();
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => (document.querySelector("#restAnnounce")?.textContent || "").trim().length > 0, { timeout: 4000 });
    const catchup = await page.evaluate(() => document.querySelector("#restAnnounce")?.textContent);
    assert(!!(catchup || "").trim(), `visibilitychange catch-up announces completion (notify ${enabled ? "on" : "off"})`, catchup);
    const again = await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      return document.querySelector("#restAnnounce")?.textContent;
    });
    assert(again === catchup, `repeated visibility changes do not re-announce (notify ${enabled ? "on" : "off"})`, JSON.stringify({ catchup, again }));
    await page.evaluate(() => stopRest());
  }
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const pressed = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
    fullActive: document.querySelector("#modeFull")?.classList.contains("active"),
  }));
  assert(pressed.focus === "true" && pressed.full === "false" && pressed.count === 1, "Start workout presses only the Focus button", JSON.stringify(pressed));
  await page.evaluate(() => setLogMode("focus"));
  const focus = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
  }));
  assert(focus.full === "false" && focus.focus === "true" && focus.count === 1, "Focus mode presses only the Focus button", JSON.stringify(focus));
  await page.evaluate(() => enterWorkout({ focus: false }));
  const list = await page.evaluate(() => ({
    full: document.querySelector("#modeFull")?.getAttribute("aria-pressed"),
    focus: document.querySelector("#modeFocus")?.getAttribute("aria-pressed"),
    count: [...document.querySelectorAll("#modeFull, #modeFocus")].filter((b) => b.getAttribute("aria-pressed") === "true").length,
  }));
  assert(list.full === "true" && list.focus === "false" && list.count === 1, "enterWorkout keeps exactly one pressed layout button", JSON.stringify(list));
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  await page.evaluate(() => promptEndBlock());
  await page.locator("#endBlockCancel").click();
  await page.evaluate(() => promptEndBlock());
  await page.locator("#endBlockCancel").click();
  const leaked = await page.evaluate(() => ({
    inert: [...document.body.children].filter((c) => c.inert).map((c) => c.id || c.tagName),
    confirm: document.querySelector("#endBlockConfirm")?.classList.contains("hidden"),
  }));
  assert(leaked.confirm && leaked.inert.length === 0, "two consecutive modals do not leak inertness/listeners", JSON.stringify(leaked));
  await context.close();
}

/* ---- Visual accessibility (UX-05, UX-06, A11Y-01, A11Y-02 focus/touch) ---- */

const VIEWPORTS = [
  { w: 320, h: 568, name: "320×568" },
  { w: 390, h: 844, name: "390×844" },
  { w: 430, h: 932, name: "430×932" },
];

const AUDIT_JS = `(() => {
  const parse = (str) => {
    if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") return [0, 0, 0, 0];
    const m = String(str).match(/rgba?\\((\\d+(?:\\.\\d+)?)[,\\s]+(\\d+(?:\\.\\d+)?)[,\\s]+(\\d+(?:\\.\\d+)?)(?:[,\\s\\/]+(\\d+(?:\\.\\d+)?))?\\)/i);
    if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
    const h = String(str).trim();
    if (h[0] === "#") {
      const x = h.slice(1);
      if (x.length === 3) return [parseInt(x[0] + x[0], 16), parseInt(x[1] + x[1], 16), parseInt(x[2] + x[2], 16), 1];
      if (x.length === 6 || x.length === 8) return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1];
    }
    return null;
  };
  const lum = (rgb) => {
    const c = rgb.slice(0, 3).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const mix = (fg, bg) => {
    const a = Math.max(0, Math.min(1, fg[3]));
    if (a >= 0.999) return [fg[0], fg[1], fg[2], 1];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const stackedBg = (el) => {
    let bg = [244, 242, 239, 1];
    const chain = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) chain.push(n);
    chain.push(document.body, document.documentElement);
    for (const n of chain.reverse()) {
      const st = getComputedStyle(n);
      const col = parse(st.backgroundColor);
      if (!col) continue;
      const op = Number(st.opacity);
      const withOp = [col[0], col[1], col[2], col[3] * (Number.isFinite(op) ? op : 1)];
      if (withOp[3] > 0.01) bg = mix(withOp, bg);
    }
    return bg;
  };
  const effectiveFg = (el, colorStr) => {
    let col = parse(colorStr) || [27, 26, 23, 1];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const op = Number(getComputedStyle(n).opacity);
      if (Number.isFinite(op) && op < 1) col = [col[0], col[1], col[2], col[3] * op];
    }
    return col;
  };
  const hidden = (el) => {
    if (!el || !(el instanceof Element)) return true;
    if (el.closest(".visually-hidden,[hidden]")) return true;
    if (el.classList.contains("hidden") || el.classList.contains("is-hidden")) return true;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return true;
    const r = el.getBoundingClientRect();
    return r.width < 0.5 || r.height < 0.5;
  };
  const largeText = (st) => {
    const px = parseFloat(st.fontSize) || 0;
    const weight = parseInt(st.fontWeight, 10) || 400;
    return px >= 24 || (px >= 18.66 && weight >= 700);
  };
  const contrastIssues = [];
  const exemptions = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.replace(/\\s+/g, " ").trim();
    if (!text) continue;
    const el = node.parentElement;
    if (!el || hidden(el) || el.closest("script,style,noscript")) continue;
    const st = getComputedStyle(el);
    const fg = effectiveFg(el, st.color);
    const bg = stackedBg(el);
    const composed = mix(fg, bg);
    const r = ratio(composed, bg);
    const min = largeText(st) ? 3 : 4.5;
    const disabled = !!(el.closest("[disabled], [aria-disabled='true']"));
    if (disabled) {
      exemptions.push({ text: text.slice(0, 48), why: "disabled control text", ratio: +r.toFixed(2) });
      continue;
    }
    if (largeText(st) && r >= 3 && r < 4.5) {
      exemptions.push({ text: text.slice(0, 48), why: "large text (≥18pt or ≥14pt bold) uses 3:1", ratio: +r.toFixed(2), px: parseFloat(st.fontSize) });
      continue;
    }
    if (r + 1e-6 < min) {
      contrastIssues.push({
        text: text.slice(0, 64),
        ratio: +r.toFixed(2),
        min,
        color: st.color,
        bg: st.backgroundColor,
        px: parseFloat(st.fontSize),
        tag: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className ? "." + String(el.className).trim().split(/\\s+/).slice(0, 2).join(".") : ""),
      });
    }
  }
  for (const el of document.querySelectorAll("*")) {
    if (hidden(el)) continue;
    for (const pseudo of ["::before", "::after"]) {
      const st = getComputedStyle(el, pseudo);
      const raw = st.content;
      if (!raw || raw === "none" || raw === "normal" || raw === '""' || raw === "''") continue;
      const text = raw.replace(/^["']|["']$/g, "").trim();
      if (!text || !/[\\p{L}\\p{N}]/u.test(text)) continue;
      const fg = effectiveFg(el, st.color);
      const bg = stackedBg(el);
      const r = ratio(mix(fg, bg), bg);
      const min = largeText(st) ? 3 : 4.5;
      if (r + 1e-6 < min) contrastIssues.push({ text: text.slice(0, 64), ratio: +r.toFixed(2), min, pseudo, tag: el.tagName.toLowerCase() });
    }
  }
  const sel = [
    "button", "a[href]", "summary", "input:not([type=hidden])", "select", "textarea",
    "[role=button]", "[role=tab]", "[role=switch]", "[role=checkbox]",
    "[tabindex]:not([tabindex='-1'])", ".term[data-term]",
  ].join(",");
  const seen = new Set();
  const targets = [];
  for (const el of document.querySelectorAll(sel)) {
    if (seen.has(el) || hidden(el)) continue;
    seen.add(el);
    const box = el.getBoundingClientRect();
    targets.push({
      id: el.id, tag: el.tagName.toLowerCase(), cls: String(el.className || "").split(/\\s+/).slice(0, 2).join("."),
      role: el.getAttribute("role"), w: +box.width.toFixed(2), h: +box.height.toFixed(2),
      ok: box.width + 0.01 >= 44 && box.height + 0.01 >= 44,
    });
  }
  if (window.__repforgeHeard instanceof Set) {
    for (const el of window.__repforgeHeard) {
      if (!(el instanceof Element) || seen.has(el) || hidden(el)) continue;
      seen.add(el);
      const box = el.getBoundingClientRect();
      targets.push({
        id: el.id, tag: el.tagName.toLowerCase(), cls: "heard",
        w: +box.width.toFixed(2), h: +box.height.toFixed(2),
        ok: box.width + 0.01 >= 44 && box.height + 0.01 >= 44,
      });
    }
  }
  const fields = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea")]
    .filter((el) => !hidden(el))
    .map((el) => ({ id: el.id, px: parseFloat(getComputedStyle(el).fontSize) }));
  return {
    contrastIssues,
    exemptions,
    smallTargets: targets.filter((t) => !t.ok),
    targetCount: targets.length,
    smallFields: fields.filter((f) => f.px + 1e-6 < 16),
  };
})()`;

async function installVisualHooks(context) {
  await context.addInitScript(() => {
    window.__repforgeHeard = new Set();
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (this instanceof Element && (type === "click" || type === "keydown" || type === "keyup" || type === "pointerup")) {
        window.__repforgeHeard.add(this);
      }
      return orig.call(this, type, fn, opts);
    };
    const proto = CanvasRenderingContext2D.prototype;
    const origFillText = proto.fillText;
    proto.fillText = function (text, x, y, ...rest) {
      const c = this.canvas;
      c.__fillTexts = c.__fillTexts || [];
      c.__fillTexts.push({ text: String(text), fillStyle: String(this.fillStyle), font: String(this.font) });
      return origFillText.call(this, text, x, y, ...rest);
    };
  });
}

async function seedLangUnit(page, lang, unit, populated) {
  const blob = sampleState({
    log: populated
      ? sampleState().log.concat([
          {
            session: "s2",
            date: "2026-01-09",
            day: "Day 1",
            name: "Press",
            exerciseId: "ex1",
            set: 1,
            load: 65,
            reps: 9,
            rir: 1,
            notes: "",
            created: "2026-01-09T00:00:00.000Z",
            primary: "Chest",
            secondary: "",
          },
        ])
      : [],
  });
  blob.settings.lang = lang;
  blob.settings.unit = unit;
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
    { k: KEY, blob }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
}

async function showView(page, view) {
  await page.evaluate((v) => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    const settings = document.querySelector("#settings");
    if (settings) settings.classList.remove("active");
    const btn = document.querySelector(`nav button[data-view="${v}"]`);
    if (btn) btn.click();
    else if (v === "settings") document.querySelector("#openSettings")?.click();
  }, view);
  if (view !== "settings") await page.waitForSelector(`#${view}.view.active`);
}

async function visitSurfaces(page) {
  await showView(page, "log");
  await page.evaluate(() => toast("audit toast"));
  await showView(page, "stats");
  await page.evaluate(() => {
    if (typeof setStatsSeg === "function") {
      setStatsSeg("overview");
      setStatsSeg("strength");
      setStatsSeg("volume");
      setStatsSeg("prs");
      setStatsSeg("overview");
    }
  });
  await showView(page, "history");
  await showView(page, "program");
  await showView(page, "log");
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await showView(page, "log");
  const start = page.locator("#startWorkout");
  if (await start.isVisible()) {
    await start.click();
    await page.waitForSelector("#workoutShell:not(.hidden)");
    await page.evaluate(() => {
      if (typeof setLogMode === "function") setLogMode("full");
    });
    const term = page.locator(".term[data-term]").first();
    if (await term.count()) await term.click().catch(() => {});
  }
}

function canvasContrast(page, sel) {
  return page.evaluate((selector) => {
    const parse = (str) => {
      if (!str || str === "transparent") return [0, 0, 0, 0];
      const m = String(str).match(/rgba?\((\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+(\d+(?:\.\d+)?))?\)/i);
      if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
      const h = String(str).trim();
      if (h[0] === "#" && (h.length === 7 || h.length === 9)) {
        return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), h.length === 9 ? parseInt(h.slice(7, 9), 16) / 255 : 1];
      }
      if (h[0] === "#" && h.length === 4) {
        return [parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), parseInt(h[3] + h[3], 16), 1];
      }
      return null;
    };
    const lum = (rgb) => {
      const c = rgb.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const css = getComputedStyle(document.documentElement);
    const bgHex = css.getPropertyValue("--bg").trim() || "#F4F2EF";
    const bg = parse(bgHex) || parse("rgb(244, 242, 239)");
    const c = document.querySelector(selector);
    const texts = c?.__fillTexts || [];
    const palette = window.__repforgeChartPalette?.() || null;
    const fails = [];
    for (const t of texts) {
      const fg = parse(t.fillStyle);
      if (!fg) {
        fails.push({ text: t.text, fillStyle: t.fillStyle, reason: "unparsed" });
        continue;
      }
      const r = ratio(fg, bg);
      if (r + 1e-6 < 4.5) fails.push({ text: t.text, fillStyle: t.fillStyle, ratio: +r.toFixed(2) });
    }
    return { count: texts.length, fails, palette, bg: bgHex };
  }, sel);
}

console.log("\nVisual accessibility (UX-05 / UX-06 / A11Y-01 / A11Y-02)");

{
  const { context, page } = await freshPage(browser);
  const meta = await page.evaluate(() => {
    const content = document.querySelector('meta[name="viewport"]')?.content || "";
    return {
      content,
      blocks: /\bmaximum-scale\b/.test(content) || /\buser-scalable\s*=\s*no\b/i.test(content),
      root: getComputedStyle(document.documentElement).touchAction,
    };
  });
  assert(!meta.blocks && /width=device-width/.test(meta.content) && /initial-scale=1/.test(meta.content), "viewport does not prohibit zoom", JSON.stringify(meta));
  assert(meta.root === "manipulation", "root retains touch-action:manipulation", meta.root);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)");
  const fonts = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("#workout input:not([type=hidden]):not([type=checkbox]):not([type=radio]), #workout select, #workout textarea, #notes, #bodyweight, #date")];
    return nodes.filter((el) => getComputedStyle(el).display !== "none").map((el) => ({ id: el.id, px: parseFloat(getComputedStyle(el).fontSize) }));
  });
  assert(fonts.every((f) => f.px >= 16), "visible editable fields are at least 16px", JSON.stringify(fonts));
  const touch = await page.evaluate(() => {
    const step = document.querySelector(".stepbtn, .curset__step");
    const field = document.querySelector("#workout input, #workout .curset__val");
    return {
      step: step ? getComputedStyle(step).touchAction : null,
      field: field ? getComputedStyle(field).touchAction : null,
    };
  });
  assert(touch.step === "manipulation" && touch.field === "manipulation", "controls retain touch-action:manipulation", JSON.stringify(touch));
  await page.evaluate(() => setLogMode("focus"));
  await page.waitForSelector("#workout .exercise.is-current");
  const grip = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const ledger = card?.querySelector(".fcard__ledger");
    return {
      card: card ? getComputedStyle(card).touchAction : null,
      ledger: ledger ? getComputedStyle(ledger).touchAction : null,
      scrolls: ledger ? ledger.scrollHeight > ledger.clientHeight + 1 : false,
    };
  });
  const wantLedger = grip.scrolls ? "pan-y pinch-zoom" : "pinch-zoom";
  assert(grip.card === "pan-y pinch-zoom" && grip.ledger === wantLedger, "Focus card/ledger allow pinch zoom", JSON.stringify(grip));
  await context.close();
}

{
  const context = await browser.newContext();
  await installVisualHooks(context);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  const settingsRing = await page.evaluate(() => {
    const el = document.querySelector("#unit, .settings-row select");
    el?.focus();
    const st = getComputedStyle(el);
    return { outline: st.outlineStyle, outlineW: parseFloat(st.outlineWidth) || 0, shadow: st.boxShadow };
  });
  assert(
    (settingsRing.outline !== "none" && settingsRing.outlineW > 0) || (settingsRing.shadow && settingsRing.shadow !== "none"),
    "Settings select shows a non-zero focus outline/ring",
    JSON.stringify(settingsRing)
  );
  await page.evaluate(() => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    document.querySelector("#settings")?.classList.remove("active");
    document.querySelector('nav button[data-view="stats"]')?.click();
  });
  await page.waitForSelector("#stats.view.active");
  await page.evaluate(() => typeof setStatsSeg === "function" && setStatsSeg("overview"));
  await page.waitForSelector("#statExercise", { state: "visible" });
  const strengthRing = await page.evaluate(() => {
    const el = document.querySelector("#statExercise");
    if (!el) return { missing: true };
    el.focus();
    const st = getComputedStyle(el);
    return { outline: st.outlineStyle, outlineW: parseFloat(st.outlineWidth) || 0, shadow: st.boxShadow, outlineColor: st.outlineColor };
  });
  assert(
    !strengthRing.missing && ((strengthRing.outline !== "none" && strengthRing.outlineW > 0) || (strengthRing.shadow && strengthRing.shadow !== "none")),
    "Strength select shows a non-zero focus outline/ring",
    JSON.stringify(strengthRing)
  );
  await context.close();
}

{
  const { context, page } = await freshPage(browser);
  const states = [
    ["en", "kg", "Bodyweight (kg, optional)"],
    ["en", "lb", "Bodyweight (lb, optional)"],
    ["pt", "kg", "Peso corporal (kg, opcional)"],
    ["pt", "lb", "Peso corporal (lb, opcional)"],
  ];
  for (const [lang, unit, expected] of states) {
    await page.evaluate(
      ({ lang, unit }) => {
        state.settings.lang = lang;
        state.settings.unit = unit;
        if (window.RepForgeI18n) window.RepForgeI18n.setLang(lang);
        syncLang();
        updateBodyweightField();
      },
      { lang, unit }
    );
    await page.click("#startWorkout").catch(() => {});
    const info = await page.evaluate((expected) => {
      const lbl = document.querySelector("#bodyweightLabel");
      const span = lbl?.querySelector("span");
      const extras = [...(lbl?.childNodes || [])].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent);
      const hits = (lbl?.textContent || "").match(/Bodyweight|Peso corporal/g) || [];
      return { span: (span?.textContent || "").replace(/\s+/g, " ").trim(), extras, hits: hits.length, expected };
    }, expected);
    assert(
      info.span === expected && info.extras.length === 0 && info.hits === 1,
      `bodyweight label is singular and translated (${lang}/${unit})`,
      JSON.stringify(info)
    );
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installVisualHooks(context);
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearState(page);
  for (const populated of [false, true]) {
    for (const lang of ["en", "pt"]) {
      await seedLangUnit(page, lang, "kg", populated);
      await visitSurfaces(page);
      const audit = await page.evaluate(AUDIT_JS);
      assert(
        audit.contrastIssues.length === 0,
        `visible text contrast ≥4.5:1 (${lang}, ${populated ? "populated" : "empty"})`,
        JSON.stringify({ issues: audit.contrastIssues.slice(0, 8), exemptions: audit.exemptions.slice(0, 6) })
      );
      await page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-focus-wo");
        if (typeof leaveWorkout === "function") leaveWorkout();
        document.querySelector('nav button[data-view="stats"]')?.click();
      });
      await page.waitForSelector("#stats.view.active");
      await page.evaluate(() => {
        if (typeof redrawChart === "function") redrawChart();
        const canvas = document.querySelector("#chart");
        if (canvas) canvas.__fillTexts = [];
        if (typeof draw === "function") {
          const rows = (state.log || []).filter((r) => r.exerciseId === (state.program?.[0]?.id)).map((r) => ({ date: r.date, e1rm: r.load * (1 + r.reps / 30), top: r.load }));
          draw(rows.length ? rows : [], "#chart");
        }
      });
      const chart = await canvasContrast(page, "#chart");
      assert(chart.fails.length === 0, `#chart canvas text contrast (${lang}, ${populated ? "populated" : "empty"})`, JSON.stringify(chart));
      assert(!!chart.palette && !!chart.palette.text, "window.__repforgeChartPalette exposes tokenized chart text color", JSON.stringify(chart.palette));
      await page.evaluate(() => {
        const key = state.program?.[0]?.id;
        if (key && typeof openExerciseView === "function") openExerciseView(key, "stats");
      });
      await page.waitForSelector("#exChart", { timeout: 8000 });
      await page.evaluate((populated) => {
        const ex = document.querySelector("#exChart");
        if (ex) ex.__fillTexts = [];
        if (typeof draw === "function") {
          const rows = (state.log || []).filter((r) => r.exerciseId === (state.program?.[0]?.id)).map((r) => ({ date: r.date, e1rm: r.load * (1 + r.reps / 30), top: r.load }));
          draw(populated ? rows : [], "#exChart");
        }
      }, populated);
      const exChart = await canvasContrast(page, "#exChart");
      assert(exChart.fails.length === 0, `#exChart canvas text contrast (${lang}, ${populated ? "populated" : "empty"})`, JSON.stringify(exChart));
      await page.evaluate(() => {
        document.body.classList.remove("is-exercise");
        if (typeof closeExerciseView === "function") closeExerciseView();
      });
    }
  }
  await context.close();
}

{
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    await installVisualHooks(context);
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearState(page);
    await seedLangUnit(page, "en", "kg", true);
    await visitSurfaces(page);
    const audit = await page.evaluate(AUDIT_JS);
    assert(
      audit.smallTargets.length === 0,
      `visible actions are at least 44×44 CSS px (${vp.name})`,
      JSON.stringify({ count: audit.targetCount, small: audit.smallTargets.slice(0, 12) })
    );
    await context.close();
  }
}

await browser.close();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
