#!/usr/bin/env node
/**
 * Focused History index / operability checks (Plan 041 Step 7).
 * Step 6 modal/disclosure coverage can merge into this file later.
 * Requires a static server; set REPFORGE_URL (default http://localhost:8000/).
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };

export function assert(cond, name, detail) {
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
  await page.waitForFunction(() => typeof window.detectPRs === "function", { timeout: 10000 });
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

function largeHistoryFixture() {
  const rows = [];
  const start = Date.UTC(2018, 0, 1);
  for (let i = 0; i < 5000; i++) {
    const d = new Date(start + i * 86400000);
    const date = d.toISOString().slice(0, 10);
    const created = `${date}T12:00:00.000Z`;
    const session = `sess-${String(i).padStart(4, "0")}`;
    const day = i % 3 === 0 ? "Push" : i % 3 === 1 ? "Day 1" : "Day 2";
    const loadA = 50 + Math.floor(i / 10);
    for (const [name, id, load, primary] of [
      ["Alpha Press", "ex-alpha", loadA, "Chest"],
      ["Beta Row", "ex-beta", 40, "Back"],
    ]) {
      for (let set = 1; set <= 2; set++) {
        rows.push({
          session,
          date,
          day,
          name,
          exerciseId: id,
          set,
          load,
          reps: 8,
          rir: 1,
          notes: "",
          created,
          primary,
          secondary: "",
        });
      }
    }
  }
  return rows;
}

const HISTORY_INDEX_SCRIPT = `(() => {
  function makeCountingLog(rows) {
    let revoked = false;
    let visits = 0;
    const target = rows;
    const proxy = new Proxy(target, {
      get(obj, prop, recv) {
        if (revoked) throw new Error("post-build source access: " + String(prop));
        if (prop === Symbol.iterator) {
          return function* () {
            for (let i = 0; i < obj.length; i++) {
              if (revoked) throw new Error("post-build iterator access");
              visits++;
              yield obj[i];
            }
          };
        }
        if (typeof prop === "string" && /^\\d+$/.test(prop)) {
          visits++;
          return obj[prop];
        }
        return Reflect.get(obj, prop, recv);
      },
    });
    return {
      proxy,
      visits: () => visits,
      revoke() { revoked = true; },
    };
  }
  function buildFixture() {
    const rows = [];
    const start = Date.UTC(2018, 0, 1);
    for (let i = 0; i < 5000; i++) {
      const d = new Date(start + i * 86400000);
      const date = d.toISOString().slice(0, 10);
      const created = date + "T12:00:00.000Z";
      const session = "sess-" + String(i).padStart(4, "0");
      const day = i % 3 === 0 ? "Push" : i % 3 === 1 ? "Day 1" : "Day 2";
      const loadA = 50 + Math.floor(i / 10);
      const lifts = [
        ["Alpha Press", "ex-alpha", loadA, "Chest"],
        ["Beta Row", "ex-beta", 40, "Back"],
      ];
      for (const [name, id, load, primary] of lifts) {
        for (let set = 1; set <= 2; set++) {
          rows.push({
            session, date, day, name, exerciseId: id, set, load, reps: 8, rir: 1,
            notes: "", created, primary, secondary: "",
          });
        }
      }
    }
    return rows;
  }
  function summarize(index) {
    const sessions = index.sessions || [];
    const first = sessions[0], last = sessions[sessions.length - 1];
    const s0 = sessions.find((s) => s.session === "sess-0000");
    const s1 = sessions.find((s) => s.session === "sess-0001");
    const s10 = sessions.find((s) => s.session === "sess-0010");
    const jan = index.months && (index.months.get ? index.months.get("2018-01") : index.months["2018-01"]);
    const byDay = jan && (jan.byDay instanceof Map ? Object.fromEntries(jan.byDay) : jan.byDay);
    const table = index.tableRows || [];
    return {
      sessionCount: sessions.length,
      firstSession: first && first.session,
      lastSession: last && last.session,
      firstDate: first && first.date,
      lastDate: last && last.date,
      s0delta: s0 && s0.delta,
      s1delta: s1 && s1.delta,
      s10delta: s10 && s10.delta,
      s0search: s0 && s0.searchText,
      janSessions: jan && (jan.sessions.size != null ? jan.sessions.size : jan.sessions.length),
      janSets: jan && jan.sets,
      janPr1: !!(byDay && byDay[1] && byDay[1].pr),
      janPr2: !!(byDay && byDay[2] && byDay[2].pr),
      janPr11: !!(byDay && byDay[11] && byDay[11].pr),
      tableCount: table.length,
      tableFirst: table[0] && { session: table[0].session, name: table[0].name || table[0].exerciseId, set: table[0].set },
      ids: sessions.slice(0, 3).map((s) => s.session),
    };
  }
  return { makeCountingLog, buildFixture, summarize };
})()`;

export async function runHistoryIndexChecks(page, check = assert) {
  const hookReady = await page.evaluate(
    () => !!(window.__repforgeHistory && typeof window.__repforgeHistory.buildIndex === "function")
  );
  check(hookReady, "window.__repforgeHistory exposes buildIndex/searchIndex/renderWithSource", hookReady ? "" : "hook missing");
  if (!hookReady) return;

  const built = await page.evaluate((helperSrc) => {
    const helpers = eval(helperSrc);
    const rows = helpers.buildFixture();
    const counted = helpers.makeCountingLog(rows);
    const t0 = performance.now();
    const index = window.__repforgeHistory.buildIndex(counted.proxy);
    const buildMs = performance.now() - t0;
    counted.revoke();
    const H = window.__repforgeHistory;
    const qPush = H.searchIndex(index, "push");
    const qAlpha = H.searchIndex(index, "alpha");
    const qDay2 = H.searchIndex(index, "day 2");
    const qNone = H.searchIndex(index, "nomatchxyz");
    const qBeta = H.searchIndex(index, "beta row");
    const afterSearchVisits = counted.visits();
    return {
      visits: counted.visits(),
      afterSearchVisits,
      buildMs,
      summary: helpers.summarize(index),
      search: {
        push: qPush.length,
        alpha: qAlpha.length,
        day2: qDay2.length,
        none: qNone.length,
        beta: qBeta.length,
      },
    };
  }, HISTORY_INDEX_SCRIPT);

  console.log(`    History index build ${built.buildMs.toFixed(1)}ms, source visits ${built.visits}`);
  check(
    built.visits === 20000,
    "buildHistoryIndex consumes exactly 20,000 source rows (one visit per row)",
    `visits=${built.visits}`
  );
  check(
    built.summary.sessionCount === 5000 &&
      built.summary.firstSession === "sess-4999" &&
      built.summary.lastSession === "sess-0000",
    "History index session ordering is newest date/created first",
    JSON.stringify({
      count: built.summary.sessionCount,
      first: built.summary.firstSession,
      last: built.summary.lastSession,
    })
  );
  check(
    built.summary.s0delta &&
      built.summary.s0delta.new === 2 &&
      built.summary.s0delta.improved === 0 &&
      built.summary.s0delta.flat === 0,
    "Oldest session precomputes two new-lift deltas",
    JSON.stringify(built.summary.s0delta)
  );
  check(
    built.summary.s1delta && built.summary.s1delta.flat === 2 && built.summary.s1delta.new === 0,
    "Next session precomputes two flat predecessor comparisons",
    JSON.stringify(built.summary.s1delta)
  );
  check(
    built.summary.s10delta &&
      built.summary.s10delta.improved === 1 &&
      built.summary.s10delta.flat === 1,
    "Load-increase session precomputes one improved and one flat delta",
    JSON.stringify(built.summary.s10delta)
  );
  check(
    typeof built.summary.s0search === "string" &&
      built.summary.s0search.includes("push") &&
      built.summary.s0search.includes("alpha press"),
    "Session search text includes day and displayed exercise names",
    built.summary.s0search
  );
  check(
    built.summary.janSessions === 31 &&
      built.summary.janSets === 124 &&
      built.summary.janPr1 === true &&
      built.summary.janPr2 === false &&
      built.summary.janPr11 === true,
    "Month grouping and calendar PR marks come from copied rows",
    JSON.stringify({
      sessions: built.summary.janSessions,
      sets: built.summary.janSets,
      pr1: built.summary.janPr1,
      pr2: built.summary.janPr2,
      pr11: built.summary.janPr11,
    })
  );
  check(
    built.summary.tableCount === 20000 &&
      built.summary.tableFirst &&
      built.summary.tableFirst.session === "sess-4999",
    "Every-set table ordering is date desc from the copied rows",
    JSON.stringify(built.summary.tableFirst) + ` count=${built.summary.tableCount}`
  );
  check(
    built.search.push === 1667 &&
      built.search.alpha === 5000 &&
      built.search.day2 === 1666 &&
      built.search.none === 0 &&
      built.search.beta === 5000 &&
      built.afterSearchVisits === 20000,
    "Five search queries use indexed search text, not the source iterable",
    JSON.stringify({ ...built.search, afterSearchVisits: built.afterSearchVisits })
  );

  const rendered = await page.evaluate((helperSrc) => {
    const helpers = eval(helperSrc);
    const rows = helpers.buildFixture();
    const counted = helpers.makeCountingLog(rows);
    const H = window.__repforgeHistory;
    H.diagnostics.reset();
    H.diagnostics.onBuilt = () => counted.revoke();
    const t0 = performance.now();
    let threw = false;
    let throwMsg = "";
    try {
      H.renderWithSource(counted.proxy);
    } catch (e) {
      threw = true;
      throwMsg = String(e && e.message || e);
    }
    const renderMs = performance.now() - t0;
    const articles = [...document.querySelectorAll("#sessions article.session, #sessions .session[data-sess]")];
    const toggles = [...document.querySelectorAll("#sessions [aria-controls][aria-expanded]")];
    const editIds = [...document.querySelectorAll("#sessions [data-edit]")].map((b) => b.getAttribute("data-edit"));
    const delIds = [...document.querySelectorAll("#sessions [data-del]")].map((b) => b.getAttribute("data-del"));
    const qPush = H.searchIndex(H.diagnostics.last, "push").length;
    return {
      threw,
      throwMsg,
      renderMs,
      visits: counted.visits(),
      builds: H.diagnostics.builds,
      restored: H.diagnostics.sourceRestored,
      articleCount: articles.length,
      firstSess: articles[0] && articles[0].getAttribute("data-sess"),
      lastSess: articles.at(-1) && articles.at(-1).getAttribute("data-sess"),
      toggleCount: toggles.length,
      editIds: editIds.slice(0, 3),
      delIds: delIds.slice(0, 3),
      qPush,
      summary: helpers.summarize(H.diagnostics.last),
    };
  }, HISTORY_INDEX_SCRIPT);

  console.log(`    History renderWithSource ${rendered.renderMs.toFixed(1)}ms, visits ${rendered.visits}`);
  check(!rendered.threw, "renderWithSource does not throw after index construction", rendered.throwMsg);
  check(rendered.builds === 1, "renderWithSource performs one index build", `builds=${rendered.builds}`);
  check(
    rendered.visits === 20000,
    "renderWithSource consumes exactly 20,000 source rows",
    `visits=${rendered.visits}`
  );
  check(rendered.restored === true, "renderWithSource restores the original state.log on success", String(rendered.restored));
  check(
    rendered.summary.sessionCount === 5000 &&
      rendered.summary.firstSession === "sess-4999" &&
      rendered.summary.s10delta &&
      rendered.summary.s10delta.improved === 1 &&
      rendered.qPush === 1667 &&
      rendered.editIds[0] === "sess-4999" &&
      rendered.delIds[0] === "sess-4999",
    "renderWithSource yields the same ordering, deltas, search, and edit/delete identities",
    JSON.stringify({
      first: rendered.summary.firstSession,
      delta: rendered.summary.s10delta,
      qPush: rendered.qPush,
      edit: rendered.editIds[0],
      del: rendered.delIds[0],
    })
  );

  const errored = await page.evaluate((helperSrc) => {
    const helpers = eval(helperSrc);
    const rows = helpers.buildFixture();
    const counted = helpers.makeCountingLog(rows);
    const H = window.__repforgeHistory;
    H.diagnostics.reset();
    H.diagnostics.onBuilt = () => {
      counted.revoke();
      throw new Error("injected-index-error");
    };
    let threw = false;
    try {
      H.renderWithSource(counted.proxy);
    } catch (e) {
      threw = String(e && e.message || e).includes("injected-index-error");
    }
    return { threw, restored: H.diagnostics.sourceRestored, visits: counted.visits() };
  }, HISTORY_INDEX_SCRIPT);
  check(errored.threw, "injected renderWithSource error still surfaces", JSON.stringify(errored));
  check(
    errored.restored === true,
    "renderWithSource restores the original state.log after an injected error",
    String(errored.restored)
  );
}

export async function runHistoryOperabilityChecks(page, check = assert) {
  const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
  if (!state?.program?.length) {
    check(false, "History operability has a program to attach sessions to", "no program");
    return;
  }
  const day1 = state.program.find((e) => e.day === "Day 1") || state.program[0];
  const day2 = state.program.find((e) => e.day === "Day 2") || state.program[1] || day1;
  const log = [
    {
      session: "ui-a",
      date: "2026-03-03",
      day: day1.day,
      name: day1.name,
      exerciseId: day1.id,
      set: 1,
      load: 80,
      reps: 8,
      rir: 1,
      notes: "",
      created: "2026-03-03T12:00:00.000Z",
      primary: day1.primary || "",
      secondary: "",
    },
    {
      session: "ui-b",
      date: "2026-03-02",
      day: day2.day,
      name: day2.name,
      exerciseId: day2.id,
      set: 1,
      load: 60,
      reps: 10,
      rir: 2,
      notes: "",
      created: "2026-03-02T12:00:00.000Z",
      primary: day2.primary || "",
      secondary: "",
    },
    {
      session: "ui-c",
      date: "2026-03-01",
      day: "Push",
      name: "Unique Lift Zeta",
      exerciseId: "ex-zeta",
      set: 1,
      load: 40,
      reps: 12,
      rir: 1,
      notes: "",
      created: "2026-03-01T12:00:00.000Z",
      primary: "Shoulders",
      secondary: "",
    },
  ];
  await persistState(page, { ...state, log });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(() => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    document.querySelector('nav button[data-view="history"]')?.click();
  });
  await page.waitForSelector("#history.view.active", { timeout: 5000 });

  const initialCount = await page.locator("#sessions article.session, #sessions .session[data-sess]").count();
  check(initialCount === 3, "History lists three seeded sessions", `count=${initialCount}`);

  const searchBtn = page.locator("#historySearchBtn");
  check(
    (await searchBtn.getAttribute("aria-controls")) === "historySearchWrap",
    "Search button has aria-controls pointing at the search wrap",
    await searchBtn.getAttribute("aria-controls")
  );

  await searchBtn.click();
  await page.waitForSelector("#historySearchWrap:not(.hidden)", { timeout: 3000 });
  check(
    (await searchBtn.getAttribute("aria-expanded")) === "true",
    "Opening search sets aria-expanded true",
    await searchBtn.getAttribute("aria-expanded")
  );
  const searchAria = await page.locator("#historySearch").getAttribute("aria-label");
  check(!!searchAria && searchAria.trim().length > 0, "Search input has a translated accessible name", searchAria);

  await page.fill("#historySearch", day1.day);
  await page.waitForTimeout(50);
  const byDay = await page.locator("#sessions article.session, #sessions .session[data-sess]").count();
  check(byDay >= 1 && byDay < 3, "Search by day filters sessions", `visible=${byDay}`);

  await page.fill("#historySearch", "Unique Lift Zeta");
  await page.waitForTimeout(50);
  const byName = await page.evaluate(() =>
    [...document.querySelectorAll("#sessions article.session, #sessions .session[data-sess]")].map((el) =>
      el.getAttribute("data-sess")
    )
  );
  check(byName.length === 1 && byName[0] === "ui-c", "Search by exercise name keeps the matching session", JSON.stringify(byName));

  await page.fill("#historySearch", "zzzz-no-session");
  await page.waitForTimeout(50);
  const noMatch = await page.locator('[data-hist-empty="nomatch"]').textContent();
  const emptyFirst = await page.evaluate(() => window.RepForgeI18n?.t?.("history.empty.sessions"));
  const emptyNone = await page.evaluate(() => window.RepForgeI18n?.t?.("history.empty.no_match"));
  check(
    !!noMatch && noMatch.trim() === (emptyNone || "").trim() && noMatch.trim() !== (emptyFirst || "").trim(),
    "No-match copy is distinct from the first-run empty state",
    `shown=${noMatch} none=${emptyNone} first=${emptyFirst}`
  );

  await searchBtn.click();
  const stayedOpen = await page.evaluate(() => !document.querySelector("#historySearchWrap")?.classList.contains("hidden"));
  check(stayedOpen, "Search cannot collapse while the query is non-empty", `open=${stayedOpen}`);

  const clearVisible = await page.locator("#historySearchClear").isVisible();
  check(clearVisible, "Clear search action is visible", `visible=${clearVisible}`);
  await page.click("#historySearchClear");
  await page.waitForTimeout(50);
  const afterClear = await page.locator("#sessions article.session, #sessions .session[data-sess]").count();
  const queryEmpty = await page.locator("#historySearch").inputValue();
  check(afterClear === 3 && queryEmpty === "", "Clear empties the query and rerenders all sessions", `count=${afterClear} q=${queryEmpty}`);

  const wrapHidden = await page.evaluate(() => document.querySelector("#historySearchWrap")?.classList.contains("hidden"));
  if (!wrapHidden) {
    await searchBtn.click();
  }
  const collapsed = await page.evaluate(() => document.querySelector("#historySearchWrap")?.classList.contains("hidden"));
  check(collapsed, "Empty search may collapse after Clear", `hidden=${collapsed}`);

  const toggle = page.locator("#sessions [data-sess='ui-a'] .session__toggle, #sessions [data-sess='ui-a'] button[aria-expanded]").first();
  await toggle.focus();
  await toggle.press("Enter");
  const entered = await page.evaluate(() => {
    const btn = document.querySelector("#sessions [data-sess='ui-a'] button[aria-expanded]");
    return { expanded: btn?.getAttribute("aria-expanded"), controls: btn?.getAttribute("aria-controls") };
  });
  check(entered.expanded === "true" && !!entered.controls, "Enter expands a session and sets aria-expanded/aria-controls", JSON.stringify(entered));
  const panel = await page.evaluate((id) => {
    const el = document.getElementById(id);
    return { exists: !!el, hidden: el?.hasAttribute("hidden"), edit: !!el?.querySelector("[data-edit]"), del: !!el?.querySelector("[data-del]") };
  }, entered.controls);
  check(panel.exists && !panel.hidden && panel.edit && panel.del, "Expanded region contains independent Edit and Delete actions", JSON.stringify(panel));

  await toggle.press(" ");
  const spaced = await page.evaluate(() =>
    document.querySelector("#sessions [data-sess='ui-a'] button[aria-expanded]")?.getAttribute("aria-expanded")
  );
  check(spaced === "false", "Space collapses the session", `aria-expanded=${spaced}`);

  await toggle.press("Enter");
  await page.click("#sessions [data-sess='ui-a'] [data-edit]");
  const editing = await page.locator('.session--edit[data-editing="ui-a"]').count();
  check(editing === 1, "Edit opens the session editor without nesting inside the toggle", `editors=${editing}`);
  await page.click("[data-edcancel]");

  await page.locator("#sessions [data-sess='ui-b'] button[aria-expanded]").press("Enter");
  await page.click("#sessions [data-sess='ui-b'] [data-del]");
  await page.waitForTimeout(80);
  const remaining = await page.evaluate(() =>
    [...document.querySelectorAll("#sessions [data-sess]")].map((el) => el.getAttribute("data-sess"))
  );
  check(!remaining.includes("ui-b") && remaining.includes("ui-a"), "Delete removes only the targeted session", JSON.stringify(remaining));
}

async function main() {
  console.log("\nAccessibility / History index");
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await runHistoryIndexChecks(page, assert);
  await runHistoryOperabilityChecks(page, assert);
  await browser.close();
  console.log(`\naccessibility: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("accessibility.mjs crashed:", err);
    process.exit(2);
  });
}
