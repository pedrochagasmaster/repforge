#!/usr/bin/env node
/**
 * RepForge year-of-usage browser simulation.
 * Run: node test/simulation.mjs
 * Requires: python3 -m http.server 8000 serving /workspace
 *
 * Env:
 *   REPFORGE_URL        App base URL (default http://localhost:8000/)
 *   REPFORGE_SIM_WEEKS  Historical weeks to seed (default 52; use 12 for quick runs)
 *   REPFORGE_PROFILE=1  Print per-phase timings at the end
 *
 * Coverage highlights:
 *   - Bulk-seeded year of history + targeted UI save regressions
 *   - Domain integrity audits (log shape, detectPRs, cross-tab metrics)
 *   - State-driven progression matrix (new / add / add2 / hold)
 *   - Import cancel, CSV e1rm/tonnage, PWA manifest, nav a11y
 *   - Fatigue trim, heat gauge, session notes, effort RIR mapping, attention board
 */

import { launchChromium } from "./browser.mjs";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SIM_WEEKS = Math.max(1, +(process.env.REPFORGE_SIM_WEEKS || 52));
const PROFILE = process.env.REPFORGE_PROFILE === "1";

const results = { passed: 0, failed: 0, bugs: [] };
const phaseTimings = [];
let phaseClock = 0;
let lastPhase = "";

function pass(name) {
  results.passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail, repro) {
  results.failed++;
  results.bugs.push({ name, detail, repro });
  console.log(`  ✗ ${name}`);
  console.log(`    ${detail}`);
  if (repro) console.log(`    Repro: ${repro}`);
}

function assert(cond, name, detail, repro) {
  if (cond) pass(name);
  else fail(name, detail, repro);
}

function beginPhase(name) {
  if (PROFILE && lastPhase) {
    phaseTimings.push([lastPhase, Date.now() - phaseClock]);
  }
  lastPhase = name;
  phaseClock = Date.now();
  console.log(name.startsWith("\n") ? name : `\n${name}`);
}

async function getState(page) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (raw) return JSON.parse(raw);
    return null;
  }, KEY);
}

async function dismissOnboardingIfPresent(page) {
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function waitForApp(page, { dismissOnboarding = true } = {}) {
  await page.waitForSelector("#dayTabs button", { timeout: 10000, state: "attached" });
  if (dismissOnboarding) await dismissOnboardingIfPresent(page);
  await page.waitForFunction(() => typeof window.detectPRs === "function", { timeout: 10000 });
}

async function loadApp(page, url = BASE) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

async function reloadApp(page, opts = {}) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page, opts);
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

/** Focus/inert/scrim snapshot for a `role=dialog` overlay. */
async function probeModal(page, sel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const stops = [...root.querySelectorAll("button, [href], input:not([type=hidden]), select, textarea")]
      .filter((el) => !el.disabled && el.tabIndex >= 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden");
    const i = stops.indexOf(document.activeElement);
    const scrim = document.getElementById("dialogScrim");
    return {
      hidden: root.classList.contains("hidden") || !!root.hidden,
      activeId: document.activeElement?.id || "",
      firstId: stops[0]?.id || "",
      lastId: stops[stops.length - 1]?.id || "",
      i,
      n: stops.length,
      inertMain: !!document.querySelector("main")?.inert,
      inertNav: !!document.querySelector("nav")?.inert,
      dialogInert: !!root.inert,
      scrimHidden: !scrim || scrim.classList.contains("hidden") || !!scrim.hidden,
      scrimInert: !!scrim?.inert,
    };
  }, sel);
}

async function waitFocusedIn(page, sel) {
  await page.waitForFunction((sel) => {
    const root = document.querySelector(sel);
    return !!root && !root.classList.contains("hidden") && !root.hidden && root.contains(document.activeElement);
  }, sel, { timeout: 5000 });
}

/** Bulk-inject a year of training history (fast path for stats/history coverage). */
async function seedHistoricalLog(page, { weeks = SIM_WEEKS, days = ["Day 1", "Day 2", "Day 3"] } = {}) {
  const state = await getState(page);
  if (!state?.program?.length) throw new Error("seedHistoricalLog: no program in state");

  const byDay = {};
  for (const ex of state.program) {
    if (!byDay[ex.day]) byDay[ex.day] = [];
    byDay[ex.day].push(ex);
  }
  for (const day of Object.keys(byDay)) {
    byDay[day].sort((a, b) => a.order - b.order);
  }

  const log = [];
  let sessions = 0;
  for (let week = 0; week < weeks; week++) {
    const day = days[week % days.length];
    const date = isoDateFromWeeksAgo(weeks - 1 - week);
    const loadBase = Math.round((60 + week * 1.25) * 2) / 2;
    const reps = 6 + (week % 3);
    const rir = week % 4 === 0 ? 2 : 1;
    const session = `${date}_${day}_seed_${week}`;
    const created = new Date(`${date}T12:00:00Z`).toISOString();
    const exs = byDay[day] || [];

    for (let i = 0; i < Math.min(2, exs.length); i++) {
      const ex = exs[i];
      const load = loadBase + i * 5;
      for (let n = 1; n <= ex.sets; n++) {
        const row = {
          session,
          date,
          day,
          name: ex.name,
          exerciseId: ex.id,
          set: n,
          load,
          reps,
          rir,
          notes: week % 13 === 0 ? `seed-week-${week}` : "",
          created,
          primary: ex.primary,
          secondary: ex.secondary,
        };
        if (week % 17 === 0 && i === 0 && n === 1) row.bodyweight = 82.5;
        log.push(row);
      }
    }
    sessions++;
  }

  await persistState(page, { ...state, log });
  await reloadApp(page);
  return { sessions, rows: log.length };
}

async function getProgramExercises(page, day) {
  await selectDay(page, day);
  return page.evaluate(() => {
    const map = new Map();
    document.querySelectorAll("#workout input[data-k]").forEach((inp) => {
      const m = inp.dataset.k.match(/^(.+)_(\d+)_(load|reps|rir)$/);
      if (!m) return;
      const [, id, setNum] = m;
      if (!map.has(id)) map.set(id, { id, sets: 0 });
      map.get(id).sets = Math.max(map.get(id).sets, +setNum);
    });
    return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  });
}

async function clearState(page) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT });
}

async function nav(page, view) {
  if (view === "settings") {
    // Profile control lives on Today (hidden during active workout / other tabs).
    await page.evaluate(() => window.__repforgeShowSettings?.());
    await page.waitForSelector(`#settings.view.active`, { timeout: 5000 });
    return;
  }
  // Tab bar is display:none on settings/exercise/onboarding — click via DOM.
  await page.evaluate((v) => {
    document.body.classList.remove("is-settings", "is-exercise", "is-onboarding");
    const b = document.querySelector(`nav button[data-view="${v}"]`);
    if (b) b.click();
  }, view);
  await page.waitForSelector(`#${view}.view.active`, { timeout: 5000 });
  if (view === "program") {
    // Editor is behind the Edit toggle (overview is the default read view).
    const hidden = await page.locator("#programEditorWrap.is-hidden").count();
    if (hidden) {
      await page.click("#programEditToggle");
      await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
    }
  }
  if (view === "log") {
    // Ensure workout shell is available for set logging assertions (List mode).
    const dash = page.locator("#todayDash:not(.hidden)");
    if (await dash.count()) {
      await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
      await page.waitForSelector("#workoutShell:not(.hidden), #workout", { timeout: 5000 });
    }
  }
}

async function selectDay(page, dayName) {
  await page.evaluate((d) => {
    // Day tabs live in the workout shell; ensure it is open in List mode
    // so notes/bodyweight/day chrome stay interactive for harness checks.
    if (typeof window.__repforgeEnterWorkout === "function") window.__repforgeEnterWorkout({ day: d, focus: false });
    else {
      const b = document.querySelector(`#dayTabs button[data-day="${CSS.escape(d)}"]`);
      if (b) b.click();
    }
  }, dayName);
  await page.waitForFunction(
    (d) => document.querySelector(`#dayTabs button[data-day="${CSS.escape(d)}"]`)?.classList.contains("active"),
    dayName,
    { timeout: 5000 }
  );
}

/** Date lives in the workout overflow menu (may be hidden) — set via DOM. */
async function setLogDate(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector("#date");
    if (!el) throw new Error("#date missing");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

/** List/Focus mode toggles live in the workout overflow menu. */
async function openWorkoutOverflow(page) {
  const panel = page.locator("#woOverflow");
  if (await panel.evaluate((el) => el.classList.contains("hidden")).catch(() => true)) {
    await page.click("#woOverflowBtn");
    await page.waitForFunction(() => {
      const el = document.querySelector("#woOverflow");
      return el && !el.classList.contains("hidden");
    }, { timeout: 3000 });
  }
}

async function clickLogMode(page, mode) {
  await openWorkoutOverflow(page);
  await page.click(mode === "focus" ? "#modeFocus" : "#modeFull");
}

async function firstDayName(page) {
  return page.locator("#dayTabs button").first().getAttribute("data-day");
}

async function fillExerciseSets(page, exId, sets, load, reps, rir) {
  await page.evaluate(
    ({ exId, sets, load, reps, rir }) => {
      for (let n = 1; n <= sets; n++) {
        for (const [suffix, val] of [
          ["load", load],
          ["reps", reps],
          ["rir", rir],
        ]) {
          const el = document.querySelector(`[data-k="${exId}_${n}_${suffix}"]`);
          if (!el) continue;
          el.value = String(val);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
    },
    { exId, sets, load, reps, rir }
  );
}

async function saveWorkout(page, { expectNewRows = true } = {}) {
  const beforeLen = (await getState(page))?.log?.length ?? 0;
  // Submit via DOM — Focus mode docks may cover / restyle .btn--save.
  await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
  if (!expectNewRows) {
    await page.waitForTimeout(120);
    return;
  }
  await page.waitForFunction(
    ({ k, len }) => {
      try {
        const s = JSON.parse(localStorage.getItem(k) || "{}");
        if ((s.log?.length ?? 0) > len) return true;
      } catch {
        /* ignore */
      }
      const toast = document.querySelector("#toast:not(.hidden)")?.textContent || "";
      return /forged|Enter weight/i.test(toast);
    },
    { k: KEY, len: beforeLen },
    { timeout: 8000 }
  );
}

async function waitForSetting(page, path, value) {
  await page.waitForFunction(
    ({ k, path: p, value: v }) => {
      const s = JSON.parse(localStorage.getItem(k) || "{}");
      return p.split(".").reduce((o, key) => o?.[key], s) === v;
    },
    { k: KEY, path, value },
    { timeout: 5000 }
  );
}

async function getExerciseMeta(page, day) {
  // Avoid selectDay when already on this workout day — selectDay forces List mode
  // and would wipe Focus mode mid-check.
  const needSelect = await page.evaluate((d) => {
    if (!document.body.classList.contains("is-workout")) return true;
    const tab = document.querySelector(`#dayTabs button[data-day="${CSS.escape(d)}"]`);
    return !(tab && tab.classList.contains("active"));
  }, day);
  if (needSelect) await selectDay(page, day);
  return page.evaluate(() =>
    [...document.querySelectorAll("#workout .exercise")].map((article) => {
      const meta = article.querySelector(".ex__meta")?.textContent || "";
      const range = meta.match(/×(\d+)-(\d+)/);
      const setsMatch = meta.match(/^(\d+)×/);
      let id = null;
      let setCount = 0;
      article.querySelectorAll("input[data-k]").forEach((inp) => {
        const m = inp.dataset.k.match(/^(.+)_(\d+)_/);
        if (m) {
          id = m[1];
          setCount = Math.max(setCount, +m[2]);
        }
      });
      return {
        id,
        sets: setsMatch ? +setsMatch[1] : setCount || 2,
        min: range ? +range[1] : 4,
        max: range ? +range[2] : 8,
      };
    })
  );
}


const LOAD_TOAST = {
  en: {
    empty: "Enter a weight before saving the set.",
    invalid: "That isn't a valid weight.",
  },
  pt: {
    empty: "Insira uma carga antes de salvar a série.",
    invalid: "Essa carga não é válida.",
  },
};
const LB_CONV = 2.2046226218;
/** Next representable float above n. Used so near-over-limit cases cannot
 *  round back onto the 1000 kg / 1000*LB boundary. */
function nextAfter(n) {
  const f64 = new Float64Array(1);
  const u64 = new BigUint64Array(f64.buffer);
  f64[0] = n;
  u64[0] += 1n;
  return f64[0];
}
const EXACT_LIMIT_LB = String(1000 * LB_CONV);
const NEAR_OVER_KG = String(nextAfter(1000));
const NEAR_OVER_LB = String(nextAfter(1000 * LB_CONV));

function loadMatches(c, stored) {
  if (stored == null || !Number.isFinite(+stored)) return false;
  if (c.name === "exact-limit") return +stored === 1000;
  return Math.abs(+stored - c.kg) < 1e-6;
}

function loadCases(unit) {
  return [
    { name: "empty", raw: "", reject: true, empty: true },
    { name: "malformed", raw: "abc", reject: true },
    { name: "malformed-dots", raw: "12.5.5", reject: true },
    { name: "non-positive", raw: "0", reject: true },
    { name: "non-positive-neg", raw: "-50", reject: true },
    { name: "exponent", raw: "1e5", reject: true },
    { name: "comma-decimal", raw: "12,5", reject: false, kg: unit === "lb" ? 12.5 / LB_CONV : 12.5 },
    { name: "exact-limit", raw: unit === "lb" ? EXACT_LIMIT_LB : "1000", reject: false, kg: 1000 },
    { name: "near-over-limit", raw: unit === "lb" ? NEAR_OVER_LB : NEAR_OVER_KG, reject: true },
    { name: "over-limit", raw: unit === "lb" ? "2205" : "1000.01", reject: true },
  ];
}

async function hideToast(page) {
  await page.evaluate(() => {
    const el = document.querySelector("#toast");
    if (el) {
      el.classList.add("hidden");
      el.textContent = "";
    }
  });
}

async function readToast(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#toast");
    return el && !el.classList.contains("hidden") && (el.textContent || "").trim();
  }, { timeout: 2500 }).catch(() => {});
  return page.evaluate(() => document.querySelector("#toast:not(.hidden)")?.textContent?.trim() || "");
}

async function logJson(page) {
  return page.evaluate((k) => {
    try {
      return JSON.stringify(JSON.parse(localStorage.getItem(k) || "{}").log || []);
    } catch {
      return "[]";
    }
  }, KEY);
}

async function resetWorkoutDraft(page) {
  await page.evaluate((d) => {
    localStorage.removeItem(d);
    window.__repforgeEnterWorkout?.({ focus: false });
  }, DRAFT);
}

async function setLangUnit(page, lang, unit) {
  const state = await getState(page);
  state.settings = { ...(state.settings || {}), lang, unit };
  await persistState(page, state);
  await reloadApp(page);
}

async function fillNamed(page, selector, raw) {
  await page.evaluate(({ selector, raw }) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error("missing " + selector);
    el.value = raw;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, { selector, raw });
}

async function seedF7History(page, loadKg = 80) {
  const state = await getState(page);
  const ex = state.program[0];
  const row = {
    session: "f7-edit-seed",
    date: "2026-08-01",
    day: ex.day,
    name: ex.name,
    exerciseId: ex.id,
    set: 1,
    load: loadKg,
    reps: 5,
    rir: 1,
    notes: "",
    created: "2026-08-01T12:00:00.000Z",
    primary: ex.primary,
    secondary: ex.secondary,
  };
  state.log = (state.log || []).filter((r) => r.session !== "f7-edit-seed").concat(row);
  await persistState(page, state);
  await reloadApp(page);
}

async function openF7HistoryEdit(page) {
  await nav(page, "history");
  const editor = page.locator('.session--edit[data-editing="f7-edit-seed"]');
  if (await editor.count()) return;
  const row = page.locator('#sessions .hist-row[data-sess="f7-edit-seed"]');
  await row.waitFor({ state: "visible", timeout: 5000 });
  await row.click();
  const editBtn = page.locator('[data-edit="f7-edit-seed"]');
  await editBtn.waitFor({ state: "visible", timeout: 5000 });
  await editBtn.click();
  await editor.waitFor({ state: "visible", timeout: 5000 });
}

async function cardInfo(page, idx) {
  return page.evaluate((i) => {
    const a = document.querySelectorAll("#workout .exercise")[i];
    if (!a) return null;
    return {
      status: [...a.classList].find((c) => c.startsWith("is-") && c !== "is-collapsed") || "",
      chip: a.querySelector(".chip")?.textContent || "",
      rec: a.querySelector(".recblock")?.textContent || "",
      setup: a.querySelector(".setup")?.textContent || "",
      collapsed: a.classList.contains("is-collapsed"),
    };
  }, idx);
}

function isoDateFromWeeksAgo(weeksAgo) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
}

/** Epley formula — must match app.js e1rm(). */
function e1rm(load, reps) {
  return load > 0 && reps > 0 ? load * (1 + reps / 30) : 0;
}

/** Structural checks on persisted training state. */
function auditLogIntegrity(state) {
  const issues = [];
  if (!state?.program?.length) issues.push("program is empty");
  if (!Array.isArray(state.log)) issues.push("log is not an array");
  const programIds = new Set((state.program || []).map((e) => e.id));
  const seen = new Set();
  for (const row of state.log || []) {
    if (!row.session) issues.push("row missing session id");
    if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) issues.push(`bad date on ${row.session}`);
    if (+row.set < 1) issues.push(`invalid set number on ${row.session}`);
    if (+row.load <= 0 && !row.warmup) issues.push(`non-warmup row with load<=0 (${row.session} set ${row.set})`);
    if (row.exerciseId && !programIds.has(row.exerciseId) && !row.name) {
      issues.push(`orphan row without name: ${row.exerciseId}`);
    }
    const key = `${row.session}|${row.exerciseId || row.name}|${row.set}`;
    if (seen.has(key)) issues.push(`duplicate set in session: ${key}`);
    seen.add(key);
  }
  return issues;
}

/** Compare Stats tiles to raw state (Sessions + Sets logged must match exactly). */
async function auditStatsMetrics(page, state) {
  await nav(page, "stats");
  const tiles = await page.evaluate(() =>
    [...document.querySelectorAll("#metrics .metric")].map((t) => ({
      label: t.querySelector(".metric__label")?.textContent?.trim(),
      val: t.querySelector(".metric__val")?.childNodes[0]?.textContent?.trim(),
    }))
  );
  const expectedSessions = String(new Set(state.log.map((r) => r.session)).size);
  const expectedSets = String(state.log.length);
  const sessionsTile = tiles.find((t) => /^sessions$/i.test(t.label || ""));
  const setsTile = tiles.find((t) => /^sets(\s+logged)?$/i.test(t.label || ""));
  return {
    ok: sessionsTile?.val === expectedSessions && setsTile?.val === expectedSets,
    detail: `Sessions UI=${sessionsTile?.val} expected=${expectedSessions}; Sets UI=${setsTile?.val} expected=${expectedSets}`,
  };
}

async function openStatsDeep(page) {
  await page.evaluate(() => {
    const d = document.querySelector("#statsDeep");
    if (d) d.open = true;
  });
}

async function cardInfoById(page, exId) {
  return page.evaluate((id) => {
    const a = document.querySelector(`.exercise[data-ex="${id}"]`);
    if (!a) return null;
    return {
      status: [...a.classList].find((c) => c.startsWith("is-") && c !== "is-collapsed") || "",
      chip: a.querySelector(".chip")?.textContent || "",
      rec: a.querySelector(".recblock")?.textContent || "",
      setup: a.querySelector(".setup")?.textContent || "",
      collapsed: a.classList.contains("is-collapsed"),
    };
  }, exId);
}

/** Inject log rows for one exercise, reload, return recommendation card for that exercise. */
async function scenarioRecommendation(page, { day, exId, rows, settingsPatch } = {}) {
  const state = await getState(page);
  const merged = {
    ...state,
    settings: { ...state.settings, ...(settingsPatch || {}) },
    log: [...(state.log || []), ...rows],
  };
  await persistState(page, merged);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, day);
  return cardInfoById(page, exId);
}

function scenarioRows({ day, ex, sessions }) {
  return sessions.flatMap(({ date, load, reps, rir, notes = "" }) => {
    const session = `${date}_${day}_scenario_${ex.id}_${load}_${reps}`;
    const created = new Date(`${date}T12:00:00Z`).toISOString();
    return Array.from({ length: ex.sets }, (_, i) => ({
      session,
      date,
      day,
      name: ex.name,
      exerciseId: ex.id,
      set: i + 1,
      load,
      reps,
      rir,
      notes,
      created,
      primary: ex.primary,
      secondary: ex.secondary,
    }));
  });
}

async function main() {
  console.log("RepForge year-of-usage simulation");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loadApp(page);
  await clearState(page);
  await reloadApp(page);

  // ── Phase 1: Historical training data ────────────────────────────
  beginPhase(`Phase 1: Historical training data (${SIM_WEEKS} weeks, bulk seed)`);

  const days = ["Day 1", "Day 2", "Day 3"];
  let sessionCount = 0;
  let uiSaveCount = 0;

  const seeded = await seedHistoricalLog(page, { weeks: SIM_WEEKS, days });
  sessionCount += seeded.sessions;
  assert(
    seeded.sessions >= SIM_WEEKS,
    `${SIM_WEEKS} unique sessions seeded`,
    `Expected ≥${SIM_WEEKS} sessions, got ${seeded.sessions}`,
    "Bulk seed historical log"
  );
  assert(
    seeded.rows > 0,
    "Seeded log rows include exercise snapshots",
    `rows=${seeded.rows}`,
    "Inspect seeded repforge_v1 log entries"
  );
  const seededSample = (await getState(page)).log[0];
  assert(
    seededSample?.exerciseId && seededSample?.primary != null,
    "Seeded rows carry exerciseId and muscle snapshot",
    JSON.stringify(seededSample),
    "Bulk seed → log rows should mirror saveWorkout shape"
  );

  beginPhase("Phase 1b: Save flow (UI smoke + edge cases)");
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const d1Exs = await getProgramExercises(page, "Day 1");

  // UI smoke: one representative save still exercises the full form pipeline
  const smokeDate = isoDateFromWeeksAgo(0);
  await setLogDate(page, smokeDate);
  await fillExerciseSets(page, d1Exs[0].id, 1, 105, 7, 1);
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;
  const smokeToast = await page.textContent("#toast");
  assert(
    /1 set logged\./.test(smokeToast),
    "Finish toast uses singular set for one-set save",
    `Toast: ${smokeToast}`,
    "Log tab → fill one set → Save workout → toast reads '1 set logged.'"
  );
  assert(
    !/1 sets/.test(smokeToast),
    "Finish toast does not use plural sets for one-set save",
    `Toast: ${smokeToast}`,
    "Log tab → fill one set → Save workout → toast must not read '1 sets'"
  );
  assert(
    (await getState(page)).log.some((r) => r.date === smokeDate && +r.load === 105),
    "Save workout UI persists after bulk seed",
    "No row with load 105 on smoke date",
    "Log tab → fill one set → Save workout"
  );

  // A touched 0 kg row is invalid (F7): abort the whole save instead of
  // dropping that set and persisting the sibling 100 kg rows.
  await setLogDate(page, isoDateFromWeeksAgo(1));
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await page.fill(`[data-k="${d1Exs[0].id}_1_load"]`, "0");
  await page.fill(`[data-k="${d1Exs[0].id}_1_reps"]`, "0");
  const logLenBeforeZero = (await getState(page)).log.length;
  await hideToast(page);
  await saveWorkout(page, { expectNewRows: false });
  const zeroToast = await readToast(page);
  assert(
    (await getState(page)).log.length === logLenBeforeZero &&
      zeroToast === LOAD_TOAST.en.invalid,
    "Touched zero load aborts save atomically",
    `len ${logLenBeforeZero}→${(await getState(page)).log.length} toast="${zeroToast}"`,
    "Log tab → fill sets → set one load to 0 → Save workout"
  );

  // Empty kg on a touched set aborts (F7 empty toast); log stays unchanged.
  await setLogDate(page, isoDateFromWeeksAgo(2));
  await fillExerciseSets(page, d1Exs[0].id, 1, 100, 8, 1);
  await page.fill(`[data-k="${d1Exs[0].id}_1_load"]`, "");
  const logLenBeforeEmpty = (await getState(page)).log.length;
  await hideToast(page);
  await saveWorkout(page, { expectNewRows: false });
  const emptyKgToast = await readToast(page);
  assert(
    (await getState(page)).log.length === logLenBeforeEmpty &&
      emptyKgToast === LOAD_TOAST.en.empty,
    "Empty kg field blocks save (no new rows)",
    `Log grew from ${logLenBeforeEmpty}; toast="${emptyKgToast}"`,
    "Log tab → clear kg on only filled set → Save workout"
  );

  // Multiple sessions same day (use a date not in the seed loop)
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const sameDay = "2018-03-20";
  await setLogDate(page, sameDay);
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;

  await setLogDate(page, sameDay);
  await fillExerciseSets(page, d1Exs[1].id, d1Exs[1].sets, 50, 10, 0);
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;

  let state = await getState(page);
  const uniqueSessions = new Set(state.log.map((x) => x.session)).size;
  assert(
    uniqueSessions >= SIM_WEEKS,
    `${SIM_WEEKS}+ unique sessions logged`,
    `Expected ≥${SIM_WEEKS} sessions, got ${uniqueSessions}`,
    "Bulk seed + UI saves → unique session count"
  );

  const sameDaySessions = [
    ...new Set(state.log.filter((x) => x.date === sameDay).map((x) => x.session)),
  ];
  assert(
    sameDaySessions.length >= 2,
    "Multiple sessions on same day",
    `Expected 2+ sessions on ${sameDay}, got ${sameDaySessions.length}`,
    `Log tab → set date to ${sameDay} → save twice`
  );

  const zeroLoadRows = state.log.filter((x) => x.load === 0);
  assert(
    zeroLoadRows.length === 0,
    "Zero-load sets are not persisted",
    `Found ${zeroLoadRows.length} zero-load rows — empty sets should be skipped on save`,
    "Log tab → enter 0 kg on a set → Save workout → row should not appear in log"
  );

  beginPhase("Phase 1c: Domain invariants");
  state = await getState(page);
  const integrityIssues = auditLogIntegrity(state);
  assert(
    integrityIssues.length === 0,
    "Seeded log passes structural integrity audit",
    integrityIssues.slice(0, 5).join("; "),
    "Inspect repforge_v1 for duplicate sets, bad dates, or orphan rows"
  );
  assert(
    state.log.some((r) => r.notes?.includes("seed-week")),
    "Seeded history includes session notes on some rows",
    "No notes field populated in bulk seed",
    "Bulk seed → periodic notes for History/CSV coverage"
  );
  assert(
    state.log.some((r) => +r.bodyweight > 0),
    "Seeded history includes bodyweight snapshots",
    "No bodyweight on seeded rows",
    "Bulk seed → bodyweight on select sessions"
  );
  const prEvents = await page.evaluate((k) => {
    const log = JSON.parse(localStorage.getItem(k)).log;
    return window.detectPRs(log);
  }, KEY);
  assert(
    prEvents.length > 0 && prEvents.some((e) => e.kind === "load"),
    "detectPRs finds load PRs in seeded progression",
    `events=${prEvents.length}`,
    "Bulk seed with rising loads → detectPRs returns load PR events"
  );
  assert(
    prEvents.some((e) => e.kind === "e1rm"),
    "detectPRs finds e1RM PRs in seeded progression",
    JSON.stringify(prEvents.map((e) => e.kind)),
    "Progressive overload seed → e1RM PR events exist"
  );

  beginPhase("Phase 1d: Attention board (P15)");
  await nav(page, "stats");
  assert(
    (await page.locator("#attention .attn__grp").count()) > 0,
    "Attention board renders at least one group after seed",
    "No .attn__grp in #attention",
    "Bulk seed → Stats Overview → attention board"
  );
  assert(
    (await page.locator("#attention .attn__lead").count()) > 0,
    "Attention group exposes a lead label",
    "No .attn__lead found",
    "Stats Overview → inspect attention board headings"
  );
  assert(
    (await page.locator("#attention .attn__why").count()) > 0,
    "Attention group shows a why line",
    "No .attn__why found",
    "Stats Overview → each signal group has a why line"
  );
  const attnGroups = await page.evaluate(() =>
    typeof window.__repforgeAttention === "function" ? window.__repforgeAttention() : null
  );
  assert(
    Array.isArray(attnGroups) && attnGroups.length > 0 && attnGroups.every((g) => g.lead && g.items?.length),
    "__repforgeAttention returns grouped structure",
    JSON.stringify(attnGroups?.map((g) => g.key)),
    "page.evaluate window.__repforgeAttention after seed"
  );
  const seedAttnChip = page.locator(
    "#attention .attn--reduce .attn__chip, #attention .attn--vol .attn__chip, #attention .attn--fatigue .attn__chip"
  ).first();
  if ((await seedAttnChip.count()) > 0) {
    await seedAttnChip.click();
    assert(
      (await page.locator("#statsDeep").evaluate((el) => el.open)),
      "Analysis attention chip opens stats deep section",
      "statsDeep not open after analysis chip click",
      "Stats → click reduce/vol/fatigue attention chip"
    );
  } else {
    pass("Analysis attention chip click skipped (no analysis-group chips)");
  }
  const actionAttnChip = page.locator("#readyList [data-ready], #attention .attn--new .attn__chip").first();
  if ((await actionAttnChip.count()) > 0) {
    const actionMeta = await page.evaluate(() => {
      const ready = document.querySelector("#readyList [data-ready]");
      if (ready) return { id: ready.getAttribute("data-ready"), day: null, via: "ready" };
      const groups = typeof window.__repforgeAttention === "function" ? window.__repforgeAttention() : [];
      const newChip = document.querySelector("#attention .attn--new .attn__chip");
      if (newChip) {
        const grp = groups.find((g) => g.key === "new");
        const item = grp?.items?.[0];
        return item ? { id: item.ex.id, day: item.ex.day, via: "attn" } : null;
      }
      return null;
    });
    await actionAttnChip.click();
    let actionNavOk = false;
    if (actionMeta?.via === "ready") {
      await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
      actionNavOk = await page.evaluate((id) => {
        const detail = document.querySelector("#exDetail");
        return !!detail && (!id || (detail.textContent || "").length > 0);
      }, actionMeta?.id || "");
    } else {
      await page.waitForFunction(() => document.querySelector("#log")?.classList.contains("active"), null, { timeout: 5000 });
      actionNavOk = await page.evaluate(
        ({ id, day }) => {
          const tab = document.querySelector("#dayTabs button.active");
          const card = document.querySelector(`#workout [data-ex="${id}"]`);
          return document.querySelector("#log")?.classList.contains("active") && tab?.dataset.day === day && !!card;
        },
        actionMeta || { id: "", day: "" }
      );
    }
    assert(
      actionMeta && actionNavOk,
      "Action attention/ready row navigates to the lift",
      `meta=${JSON.stringify(actionMeta)} navOk=${actionNavOk}`,
      "Stats → click new attention chip or ready row → destination view"
    );
  } else {
    pass("Action attention chip navigation skipped (no new/add chips)");
  }

  // PWA shell loads (manifest + service worker registration)
  const pwaOk = await page.evaluate(async () => {
    const manifestOk = (await fetch("./manifest.webmanifest")).ok;
    const swOk = "serviceWorker" in navigator;
    return { manifestOk, swOk };
  });
  assert(
    pwaOk.manifestOk && pwaOk.swOk,
    "PWA manifest fetchable and service worker API available",
    JSON.stringify(pwaOk),
    "Serve app over HTTP → manifest.webmanifest returns 200"
  );

  // Nudging load or reps is a burst of taps on one target; none of it may zoom
  await nav(page, "log");
  const zoomPolicy = await page.evaluate(() => {
    const step = document.querySelector("#workout .stepbtn");
    const field = document.querySelector("#workout input[data-k]");
    return {
      meta: document.querySelector('meta[name="viewport"]')?.content || "",
      root: getComputedStyle(document.documentElement).touchAction,
      step: step ? getComputedStyle(step).touchAction : null,
      field: field ? getComputedStyle(field).touchAction : null,
      fieldFont: field ? parseFloat(getComputedStyle(field).fontSize) : null,
    };
  });
  assert(
    /\bmaximum-scale=1\b/.test(zoomPolicy.meta) && /\buser-scalable=no\b/.test(zoomPolicy.meta),
    "Viewport meta pins the scale, so the page cannot be zoomed",
    JSON.stringify(zoomPolicy),
    "Inspect <meta name=viewport> → maximum-scale=1, user-scalable=no"
  );
  assert(
    zoomPolicy.root === "manipulation" &&
      zoomPolicy.step === "manipulation" &&
      zoomPolicy.field === "manipulation",
    "Controls drop the double-tap gesture, so repeated ± taps cannot zoom",
    JSON.stringify(zoomPolicy),
    "Log tab → computed touch-action on a ± step button and a set field"
  );
  assert(
    zoomPolicy.fieldFont >= 16,
    "Set fields are at least 16px, so focusing one does not zoom iOS Safari",
    JSON.stringify(zoomPolicy),
    "Log tab → computed font-size on a set input"
  );

  // Nav accessibility: each tab exposes aria-current when active
  for (const view of ["log", "stats", "history", "program"]) {
    await nav(page, view);
    const current = await page.locator(`nav button[data-view="${view}"]`).getAttribute("aria-current");
    assert(
      current === "page",
      `Nav tab ${view} sets aria-current=page when active`,
      `aria-current=${current}`,
      `Click ${view} tab → inspect aria-current`
    );
  }
  await nav(page, "settings");
  assert(
    await page.locator("#settings.view.active").count() === 1,
    "Settings view opens via profile control (no nav tab)",
    "settings view not active",
    "Today header profile → Settings"
  );
  const dimContrast = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const hex = (name) => css.getPropertyValue(name).trim();
    const lum = (h) => {
      const c = [1, 3, 5]
        .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    return { token: hex("--ink-soft"), onBg: ratio(hex("--ink-soft"), hex("--bg")), onSurface: ratio(hex("--ink-soft"), hex("--surface")) };
  });
  assert(
    dimContrast.onBg >= 4.5 && dimContrast.onSurface >= 4.5,
    "Secondary text token meets AA contrast on cream surfaces",
    `--ink-soft=${dimContrast.token} bg=${dimContrast.onBg.toFixed(2)} surface=${dimContrast.onSurface.toFixed(2)}`,
    "Computed style on :root → contrast(--ink-soft vs --bg/--surface)"
  );
  await nav(page, "log");

  // ── Phase 2: Draft persistence ───────────────────────────────────
  beginPhase("Phase 2: Draft persistence");

  await nav(page, "log");
  await selectDay(page, "Day 2");
  const d2Exs = await getProgramExercises(page, "Day 2");
  const draftEx = d2Exs[0];
  const draftLoad = "137.5";
  await page.fill(`[data-k="${draftEx.id}_1_load"]`, draftLoad);
  await page.fill(`[data-k="${draftEx.id}_1_reps"]`, "7");
  await page.waitForFunction(
    ({ d, load }) => localStorage.getItem(d)?.includes(load),
    { d: DRAFT, load: draftLoad },
    { timeout: 5000 }
  );

  const draftBefore = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(
    draftBefore && draftBefore.includes(draftLoad),
    "Draft saved to localStorage on input",
    `Draft missing expected load ${draftLoad}`,
    "Log tab → type kg value → check localStorage repforge_draft_v1"
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 2");
  const restoredLoad = await page.inputValue(`[data-k="${draftEx.id}_1_load"]`);
  assert(
    restoredLoad === draftLoad,
    "Draft restored after reload",
    `Expected ${draftLoad}, got "${restoredLoad}"`,
    "Log tab → enter values → reload page → values should persist unsaved"
  );

  // Saving clears draft
  await saveWorkout(page);
  const draftAfterSave = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(
    !draftAfterSave || draftAfterSave === "{}",
    "Draft cleared after save",
    `Draft still present: ${draftAfterSave?.slice(0, 80)}`,
    "Log tab → fill draft → Save workout → draft key should be empty"
  );

  // ── Phase 3: Switch days & verify tabs ───────────────────────────
  beginPhase("Phase 3: Day switching");

  await nav(page, "log");
  for (const d of days) {
    await selectDay(page, d);
    const active = await page.locator(`#dayTabs button.active`).textContent();
    assert(
      active === d,
      `Active tab is ${d}`,
      `Tab shows "${active}" instead of "${d}"`,
      `Log tab → click ${d} tab`
    );
    const workoutCount = await page.locator("#workout .exercise").count();
    const expected = (await getProgramExercises(page, d)).length;
    assert(
      workoutCount === expected,
      `${d} renders ${expected} exercises`,
      `Rendered ${workoutCount}, expected ${expected}`,
      `Log tab → select ${d}`
    );
  }

  // ── Phase 4: Program editing — rename, add, remove, reorder ──────
  beginPhase("Phase 4: Program editing");

  await nav(page, "program");

  // Rename Day 1
  const renameInput = page.locator('[data-act="renameDay"][data-day="Day 1"]');
  await renameInput.fill("Push Day");
  await renameInput.blur();
  await page.waitForTimeout(150);

  state = await getState(page);
  const hasPushDay = state.program.some((e) => e.day === "Push Day");
  const noDay1 = !state.program.some((e) => e.day === "Day 1");
  assert(
    hasPushDay && noDay1,
    "Rename day (Day 1 → Push Day)",
    `program days: ${[...new Set(state.program.map((e) => e.day))].join(", ")}`,
    "Program tab → rename Day 1 input → blur"
  );

  // Log tab should reflect renamed day
  await nav(page, "log");
  const tabText = await page.locator("#dayTabs").textContent();
  assert(
    tabText.includes("Push Day"),
    "Renamed day appears in log tabs",
    `Tabs: ${tabText}`,
    "Program tab → rename day → Log tab → check day tabs"
  );

  // Rename exercise (pick one that already has log history)
  await nav(page, "program");
  state = await getState(page);
  const loggedOnDay2 = state.log.find((x) => x.day === "Day 2");
  assert(loggedOnDay2, "Day 2 has log history before rename test", "No Day 2 log rows", "Phase 1 should log Day 2 sessions");
  const targetInput = page.locator(`.pex__name[value="${loggedOnDay2.name.replace(/"/g, '\\"')}"]`).first();
  const oldName = await targetInput.inputValue();
  const newName = "Custom Leg Press";
  await targetInput.fill(newName);
  await targetInput.blur();
  await page.waitForTimeout(100);

  state = await getState(page);
  assert(
    state.program.some((e) => e.name === newName),
    "Rename exercise persists",
    `Could not find "${newName}" in program`,
    "Program tab → edit exercise name field"
  );
  const renamedEx = state.program.find((e) => e.name === newName);
  const historyLinked =
    renamedEx && state.log.some((x) => x.exerciseId === renamedEx.id || x.name === oldName);
  assert(
    historyLinked,
    "Historical logs stay linked after exercise rename",
    `No log rows matched exerciseId or prior name "${oldName}"`,
    "Rename exercise → log entries should keep exerciseId or original name snapshot"
  );

  await nav(page, "log");
  await selectDay(page, "Day 2");
  const lastLine = await page
    .locator("#workout .exercise")
    .filter({ has: page.locator(`.ex__name:text-is("${newName}")`) })
    .locator(".prev")
    .textContent()
    .catch(() => "");
  assert(
    lastLine.includes("Last:"),
    "Renamed exercise still shows last session via exerciseId",
    `Expected Last: line after rename, got "${lastLine}"`,
    "Rename exercise → Log tab → previous session should still display"
  );

  // Add exercise
  await nav(page, "program");
  const exCountBefore = state.program.filter((e) => e.day === "Push Day").length;
  await page.click('[data-act="addEx"][data-day="Push Day"]');
  await page.waitForTimeout(100);
  state = await getState(page);
  const exCountAfter = state.program.filter((e) => e.day === "Push Day").length;
  assert(
    exCountAfter === exCountBefore + 1,
    "Add exercise to day",
    `Before ${exCountBefore}, after ${exCountAfter}`,
    "Program tab → + Add exercise on a day"
  );

  // Reorder — move second exercise down (swaps with third)
  const pushExs = state.program
    .filter((e) => e.day === "Push Day")
    .sort((a, b) => a.order - b.order);
  if (pushExs.length >= 3) {
    const secondId = pushExs[1].id;
    const thirdId = pushExs[2].id;
    await page.click(`button[data-act="down"][data-id="${secondId}"]`);
    await page.waitForTimeout(100);
    state = await getState(page);
    const reordered = state.program
      .filter((e) => e.day === "Push Day")
      .sort((a, b) => a.order - b.order);
    assert(
      reordered[1].id === thirdId && reordered[2].id === secondId,
      "Reorder exercise (move down swaps with below)",
      `Order: ${reordered.map((e) => e.name).join(", ")}`,
      "Program tab → ▼ on second exercise (should swap with third)"
    );
  }

  // Remove added exercise (last one named "New exercise")
  const newEx = state.program.find((e) => e.name === "New exercise" && e.day === "Push Day");
  if (newEx) {
    await page.click(`button[data-act="delEx"][data-id="${newEx.id}"]`);
    await page.waitForTimeout(100);
    state = await getState(page);
    assert(
      !state.program.find((e) => e.id === newEx.id),
      "Remove exercise",
      "Exercise still in program after delete",
      "Program tab → ✕ on exercise"
    );
  }

  // Add new day
  await page.click("#addDay");
  await page.waitForTimeout(100);
  state = await getState(page);
  const dayNames = [...new Set(state.program.map((e) => e.day))];
  assert(
    dayNames.some((d) => d.match(/^Day \d+$/)),
    "Add new training day",
    `Days: ${dayNames.join(", ")}`,
    "Program tab → + Add day"
  );

  // Duplicate day rename rejected
  const dupInput = page.locator('[data-act="renameDay"][data-day="Day 2"]');
  await dupInput.fill("Push Day");
  await dupInput.blur();
  await page.waitForTimeout(150);
  state = await getState(page);
  assert(
    state.program.some((e) => e.day === "Day 2"),
    "Duplicate day rename rejected",
    `Day 2 missing after duplicate rename attempt; days: ${[...new Set(state.program.map((e) => e.day))].join(", ")}`,
    "Program tab → rename Day 2 to existing Push Day → should revert"
  );

  // ── Phase: Program metadata ──────────────────────────────────────
  beginPhase("Phase: program metadata");

  await nav(page, "program");
  state = await getState(page);
  assert(
    state.programMeta?.id && typeof state.programMeta.id === "string",
    "programMeta exists with stable id",
    `programMeta=${JSON.stringify(state.programMeta)}`,
    "Open Program tab → inspect state.programMeta"
  );
  const metaBefore = await page.locator("#programMeta").textContent();
  assert(
    metaBefore.includes("days this week"),
    "Program tab shows adherence chip",
    `Meta card: ${metaBefore?.slice(0, 120)}`,
    "Program tab → check summary card"
  );
  await page.fill("#programName", "Simulation Split");
  await page.waitForTimeout(150);
  state = await getState(page);
  assert(
    state.programMeta.name === "Simulation Split",
    "Program name persists on edit",
    `name=${state.programMeta?.name}`,
    "Program tab → edit program name"
  );
  await nav(page, "log");
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  const todayProg = await page.locator("#todayProgram").textContent();
  assert(
    todayProg.includes("Simulation Split"),
    "Log tab eyebrow shows the program name",
    `todayProgram=${todayProg}`,
    "Program tab → name program → Today program strip"
  );
  // Compatibility hook: #logContext still deep-links to Stats → Review (may be visually hidden).
  await page.evaluate(() => document.querySelector("#logContext")?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  const eyebrowNavOk = await page.evaluate(() => {
    const stats = document.querySelector("#stats.view.active");
    const seg = document.querySelector("#segReview");
    return !!stats && seg?.classList.contains("active");
  });
  assert(
    eyebrowNavOk,
    "Log week eyebrow opens Stats Review segment",
    `eyebrowNavOk=${eyebrowNavOk}`,
    "Today → #logContext click → Stats Review active"
  );
  await nav(page, "program");
  const startedIso = (() => {
    const d = new Date(Date.now() - 15 * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  await page.fill("#programStarted", startedIso);
  await page.waitForTimeout(150);
  const metaAfterDate = await page.locator("#programMeta").textContent();
  assert(
    /Week 3/.test(metaAfterDate),
    "Week chip appears immediately after setting start date",
    `Meta card after date edit: ${metaAfterDate?.slice(0, 140)}`,
    "Program tab → set start date 15 days back → Week chip without leaving the tab"
  );
  state = await getState(page);
  assert(
    state.programMeta.started === startedIso,
    "Start date persists on edit",
    `started=${state.programMeta?.started}`,
    "Program tab → edit start date"
  );
  await page.evaluate(async (k) => {
    const s = JSON.parse(localStorage.getItem(k));
    delete s.programMeta;
    localStorage.setItem(k, JSON.stringify(s));
    await new Promise((res, rej) => {
      const req = indexedDB.open("repforge", 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(s, k);
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      };
      req.onerror = () => rej(req.error);
    });
  }, KEY);
  await page.waitForTimeout(200);
  await reloadApp(page);
  state = await getState(page);
  assert(
    state.programMeta?.id,
    "Legacy backup migrates programMeta on load",
    `programMeta missing after reload: ${JSON.stringify(state.programMeta)}`,
    "Remove programMeta from storage → reload app"
  );

  // ── Phase 4b: Program overview day disclosure ────────────────────
  beginPhase("Phase 4b: Program overview disclosure");

  // Drop only the disclosure pref so the tour stays dismissed for later phases.
  await page.evaluate(() => {
    const k = "repforge_ui_v1";
    const o = JSON.parse(localStorage.getItem(k) || "{}");
    delete o.overviewOpenDays;
    localStorage.setItem(k, JSON.stringify(o));
  });
  await reloadApp(page);
  await nav(page, "program");
  // nav() forces the editor open; the day disclosure lives on the read-only overview.
  await page.click("#programEditToggle");
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });

  const readOvDay = (idx) =>
    page.evaluate((i) => {
      const el = document.querySelectorAll("#programOverview .prog-day")[i];
      if (!el) return null;
      const head = el.querySelector(".prog-day__head");
      return { day: head?.dataset.ovday, open: !!el.querySelector(".prog-day__body"), expanded: head?.getAttribute("aria-expanded") === "true" };
    }, idx);

  const ovDefault = await readOvDay(0);
  assert(
    ovDefault?.open && ovDefault.expanded,
    "Program overview opens the first day by default",
    `first day: ${JSON.stringify(ovDefault)}`,
    "Program tab → overview → first training day"
  );

  const ovDayName = ovDefault?.day;
  await page.click(`#programOverview [data-ovday="${ovDayName}"]`);
  await page.waitForTimeout(200);
  const ovCollapsed = await readOvDay(0);
  assert(
    ovCollapsed && !ovCollapsed.open && !ovCollapsed.expanded,
    "First training day collapses when tapped",
    `first day after tap: ${JSON.stringify(ovCollapsed)}`,
    "Program tab → overview → tap the first day header"
  );

  await reloadApp(page);
  await nav(page, "program");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });
  const ovAfterReload = await readOvDay(0);
  assert(
    ovAfterReload && !ovAfterReload.open,
    "Collapsed first day survives a reload",
    `first day after reload: ${JSON.stringify(ovAfterReload)}`,
    "Program tab → collapse first day → reload → Program tab"
  );

  await page.click(`#programOverview [data-ovday="${ovDayName}"]`);
  await page.waitForTimeout(200);
  const ovReopened = await readOvDay(0);
  assert(
    ovReopened?.open,
    "First training day re-opens when tapped again",
    `first day after second tap: ${JSON.stringify(ovReopened)}`,
    "Program tab → overview → tap the first day header twice"
  );

  await page.click(`#programOverview [data-ovdetails="${ovDayName}"]`);
  await page.waitForTimeout(400);
  const seeDetails = await page.evaluate((d) => {
    const card = document.querySelector(`#programEditor .pday[data-day="${CSS.escape(d)}"]`);
    return {
      exerciseView: document.body.classList.contains("is-exercise"),
      editorOpen: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
      cardFound: !!card,
      cardExpanded: !!card && !card.classList.contains("is-collapsed"),
    };
  }, ovDayName);
  assert(
    !seeDetails.exerciseView && seeDetails.editorOpen && seeDetails.cardExpanded,
    "See details opens the day in the program editor",
    `see details result: ${JSON.stringify(seeDetails)}`,
    "Program tab → overview → See details on a training day"
  );

  // ── Phase 5: Delete sessions ─────────────────────────────────────
  beginPhase("Phase 5: Delete sessions");

  await nav(page, "history");
  const sessionsBefore = (await getState(page)).log.length;
  // Delete lives in the expanded session row (mock 04).
  const firstSession = page.locator("#sessions .hist-row.session, #sessions .session").first();
  await firstSession.click();
  const delBtn = page.locator(".session__del").first();
  await delBtn.waitFor({ state: "visible", timeout: 5000 });
  const delSessionId = await delBtn.getAttribute("data-del");
  await delBtn.click();
  await page.waitForTimeout(150);

  state = await getState(page);
  const sessionsAfter = state.log.length;
  const deletedGone = !state.log.some((x) => x.session === delSessionId);
  assert(
    sessionsAfter < sessionsBefore && deletedGone,
    "Delete session removes all its sets",
    `Before ${sessionsBefore} sets, after ${sessionsAfter}; session ${delSessionId} still present: ${!deletedGone}`,
    "History tab → Delete on a session → confirm"
  );

  // ── Phase 6: Settings ────────────────────────────────────────────
  beginPhase("Phase 6: Settings");

  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#progressionDetails")?.classList.add("is-open"));
  await page.fill("#jumpPct", "5");
  await page.fill("#minJump", "5");
  await page.fill("#rirHigh", "3");
  await page.click("#saveSettings");
  await page.waitForTimeout(100);

  state = await getState(page);
  assert(
    state.settings.jumpPct === 5 && state.settings.minJump === 5 && state.settings.rirHigh === 3,
    "Settings saved",
    JSON.stringify(state.settings),
    "Settings tab → change values → Save settings"
  );
  assert(
    state.settings.commandParserHints === undefined,
    "commandParserHints removed from settings",
    JSON.stringify(state.settings),
    "Settings save → commandParserHints field dropped"
  );

  // Settings affect recommendations (add load when at max reps)
  await nav(page, "log");
  await selectDay(page, "Push Day");
  const pushFirst = (await getExerciseMeta(page, "Push Day"))[0];
  // Fill at max reps with high RIR to trigger add load
  await fillExerciseSets(page, pushFirst.id, pushFirst.sets, 200, pushFirst.max, 3);
  await saveWorkout(page);

  await nav(page, "log");
  await selectDay(page, "Push Day");
  const recText = await page.locator("#workout .exercise").first().locator(".recblock").textContent();
  const hasAddLoad =
    /Add load|Add weight|Hold \d/i.test(recText) ||
    (await page.locator("#workout .exercise").first().getAttribute("class") || "").includes("is-add");
  assert(
    hasAddLoad,
    "Recommendation reacts to settings + history",
    `Rec text: ${recText?.slice(0, 100)}`,
    "Settings → high jumpPct → log max reps → next session should recommend load increase"
  );

  // ── Phase 7: Stats integrity ─────────────────────────────────────
  beginPhase("Phase 7: Stats");

  state = await getState(page);
  await nav(page, "stats");
  await openStatsDeep(page);

  const metricsAudit = await auditStatsMetrics(page, state);
  assert(
    metricsAudit.ok,
    "Stats session/set counts match persisted log",
    metricsAudit.detail,
    "Stats tab → Sessions and Sets logged tiles vs repforge_v1"
  );

  const metricsText = await page.locator("#metrics").textContent();
  assert(
    /sessions/i.test(metricsText) && /sets/i.test(metricsText),
    "Stats metrics render",
    metricsText?.slice(0, 120),
    "Stats tab → check metric tiles"
  );

  const statOptions = await page.locator("#statExercise option").count();
  assert(
    statOptions > 0,
    "Stats exercise dropdown populated",
    `Option count: ${statOptions}`,
    "Stats tab → exercise select"
  );

  // Chart should not throw on render
  const chartRendered = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c && c.width > 0;
  });
  assert(
    chartRendered,
    "Chart canvas renders with data",
    "Canvas width is 0 or missing",
    "Stats tab → select exercise with history"
  );

  const trendText = await page.locator("#trend").textContent();
  assert(
    trendText && trendText.length > 5,
    "Trend summary shows progression",
    `Trend: "${trendText}"`,
    "Stats tab → select logged exercise"
  );

  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForFunction(() => {
    const c = document.querySelector("#chart");
    return c && c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
  });
  const okWide = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
  });
  await page.setViewportSize({ width: 380, height: 900 });
  await page.waitForFunction(() => {
    const c = document.querySelector("#chart");
    return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
  });
  const okNarrow = await page.evaluate(() => {
    const c = document.querySelector("#chart");
    return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
  });
  assert(
    okWide && okNarrow,
    "Chart canvas tracks viewport width on resize",
    `wide=${okWide} narrow=${okNarrow}`,
    "Stats → resize viewport → canvas backing width follows clientWidth"
  );

  const chartLabelDecimalsNarrow = await page.evaluate(() => window.__repforgeChartLabelDecimals(1));
  assert(
    chartLabelDecimalsNarrow === 1,
    "Chart label decimals for narrow range (flat data fallback)",
    `Expected 1, got ${chartLabelDecimalsNarrow}`,
    "page.evaluate(() => window.__repforgeChartLabelDecimals(1))"
  );
  const chartLabelDecimalsWide = await page.evaluate(() => window.__repforgeChartLabelDecimals(30));
  assert(
    chartLabelDecimalsWide === 0,
    "Chart label decimals for wide range",
    `Expected 0, got ${chartLabelDecimalsWide}`,
    "page.evaluate(() => window.__repforgeChartLabelDecimals(30))"
  );
  await page.setViewportSize({ width: 390, height: 844 });

  // ── Phase 8: Export JSON, modify, re-import ──────────────────────
  beginPhase("Phase 8: JSON export/import");

  await nav(page, "settings");
  const tmpDir = mkdtempSync(join(tmpdir(), "repforge-test-"));
  const jsonPath = join(tmpDir, "backup.json");

  await page.evaluate(() => document.querySelector("#dataBackupPanel")?.classList.add("is-open"));
  await page.waitForSelector("#dataBackupPanel.is-open", { timeout: 3000 });
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportJson"),
  ]);
  await jsonDownload.saveAs(jsonPath);

  let exported;
  try {
    exported = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (e) {
    fail("JSON export is valid JSON", String(e), "Settings → Export backup JSON");
    exported = null;
  }
  if (exported) {
    assert(
      exported.program && Array.isArray(exported.log) && exported.settings,
      "JSON export has program/log/settings",
      `Keys: ${Object.keys(exported).join(", ")}`,
      "Settings → Export backup JSON → inspect file"
    );

    // Cancel import preserves current state
    const beforeCancel = await getState(page);
    const cancelPayload = JSON.parse(readFileSync(jsonPath, "utf8"));
    cancelPayload.settings.jumpPct = 99;
    const cancelPath = join(tmpDir, "cancel-test.json");
    writeFileSync(cancelPath, JSON.stringify(cancelPayload));
    await page.setInputFiles("#importJson", cancelPath);
    await page.waitForSelector("#importChoice:not(.hidden)");
    await page.click("#importCancel");
    const afterCancel = await getState(page);
    assert(
      afterCancel.settings.jumpPct === beforeCancel.settings.jumpPct &&
        afterCancel.log.length === beforeCancel.log.length,
      "Import cancel leaves state unchanged",
      `jumpPct ${beforeCancel.settings.jumpPct}→${afterCancel.settings.jumpPct}, log ${beforeCancel.log.length}→${afterCancel.log.length}`,
      "Settings → Import backup → Cancel → settings and log unchanged"
    );
    assert(
      (await page.locator("#importChoice").getAttribute("class")).includes("hidden"),
      "Import choice dialog closes on cancel",
      "importChoice still visible",
      "Import → Cancel → dialog hidden"
    );

    // Modify and re-import
    const modNote = "SIMULATION_MODIFIED";
    exported.log[0].notes = modNote;
    exported.settings.jumpPct = 7.5;
    writeFileSync(jsonPath, JSON.stringify(exported, null, 2));

    await page.setInputFiles("#importJson", jsonPath);
    await page.waitForSelector("#importChoice:not(.hidden)");
    await page.click("#importReplace");
    await page.waitForTimeout(200);

    state = await getState(page);
    assert(
      state.settings.jumpPct === 7.5,
      "JSON import applies settings",
      `jumpPct=${state.settings.jumpPct}`,
      "Modify exported JSON settings → Import backup JSON"
    );
    assert(
      state.log.some((x) => x.notes === modNote),
      "JSON import applies log modifications",
      "Modified notes not found in imported log",
      "Modify exported JSON log entry → Import"
    );

    // Merge: file with one session this device doesn't have
    const mergeSrc = JSON.parse(readFileSync(jsonPath, "utf8"));
    const donor = mergeSrc.log
      .filter((r) => r.session === mergeSrc.log[0].session)
      .map((r) => ({ ...r, session: "merge_test_session_1" }));
    writeFileSync(
      join(tmpDir, "merge.json"),
      JSON.stringify({ ...mergeSrc, log: [...mergeSrc.log, ...donor] })
    );
    const beforeMerge = (await getState(page)).log.length;
    await page.setInputFiles("#importJson", join(tmpDir, "merge.json"));
    await page.waitForSelector("#importChoice:not(.hidden)");
    await page.click("#importMerge");
    await page.waitForTimeout(200);
    const afterMerge = await getState(page);
    assert(
      afterMerge.log.length === beforeMerge + donor.length &&
        afterMerge.log.some((r) => r.session === "merge_test_session_1"),
      "Merge adds only the new session's rows",
      `rows ${beforeMerge} → ${afterMerge.log.length}, expected +${donor.length}`,
      "Import file with 1 new session → Merge"
    );
    state = afterMerge;

    // Import without settings merges defaults
    const noSettingsPath = join(tmpDir, "no-settings.json");
    writeFileSync(
      noSettingsPath,
      JSON.stringify({ program: exported.program, log: exported.log.slice(0, 6) })
    );
    await page.setInputFiles("#importJson", noSettingsPath);
    await page.waitForSelector("#importChoice:not(.hidden)");
    await page.click("#importReplace");
    await page.waitForTimeout(200);
    state = await getState(page);
    assert(
      state.settings.jumpPct === 2.5 && state.settings.minJump === 2.5 && state.settings.rirHigh === 2,
      "Import without settings uses defaults",
      JSON.stringify(state.settings),
      "Import backup JSON missing settings key"
    );
  }
  beginPhase("Phase 9: CSV export");

  const csvPath = join(tmpDir, "log.csv");
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportCsv"),
  ]);
  await csvDownload.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8");
  const csvLines = csv.trim().split("\n");
  assert(
    csvLines.length > 1,
    "CSV export has header + rows",
    `Lines: ${csvLines.length}`,
    "Settings → Export log CSV"
  );
  const header = csvLines[0];
  assert(
    header.includes("session") &&
      header.includes("date") &&
      header.includes("load") &&
      header.includes("reps") &&
      header.includes("exercise_id") &&
      header.includes("e1rm") &&
      header.includes("is_hard_set") &&
      header.includes("is_warmup") &&
      header.includes("bodyweight") &&
      header.includes("performed_name"),
    "CSV header has expected columns",
    `Header: ${header}`,
    "Settings → Export log CSV → check first line"
  );
  assert(
    csvLines.length - 1 === state.log.length,
    "CSV row count matches log length",
    `CSV data rows ${csvLines.length - 1}, log entries ${state.log.length}`,
    "Export CSV → compare row count to log"
  );
  assert(
    /"[01]","[01]"/.test(csv),
    "CSV data rows include is_hard_set values",
    `sample=${csvLines[1]?.slice(0, 80)}`,
    "Export CSV → rows carry is_hard_set / is_warmup 0/1 flags"
  );
  const sampleRow = state.log.find((r) => +r.load > 0 && +r.reps > 0 && !r.warmup);
  if (sampleRow) {
    const csvDataLine = csvLines.find((line) => line.includes(sampleRow.session) && line.includes(String(sampleRow.set)));
    const e1rmIdx = header.split(",").indexOf("e1rm");
    const tonIdx = header.split(",").indexOf("tonnage");
    if (csvDataLine && e1rmIdx >= 0 && tonIdx >= 0) {
      const cols = csvDataLine.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const csvE1rm = +cols[e1rmIdx]?.replaceAll('"', "");
      const csvTonnage = +cols[tonIdx]?.replaceAll('"', "");
      const expectedE1rm = +e1rm(+sampleRow.load, +sampleRow.reps).toFixed(2);
      const expectedTonnage = +((+sampleRow.load || 0) * (+sampleRow.reps || 0)).toFixed(2);
      assert(
        Math.abs(csvE1rm - expectedE1rm) < 0.02 && Math.abs(csvTonnage - expectedTonnage) < 0.02,
        "CSV e1rm and tonnage match computed values",
        `e1rm csv=${csvE1rm} expected=${expectedE1rm}; tonnage csv=${csvTonnage} expected=${expectedTonnage}`,
        "Export CSV → compare e1rm/tonnage to Epley formula and load×reps"
      );
    }
  }

  beginPhase("Phase: warmup flag");
  await nav(page, "log");
  const warmupDay = await firstDayName(page);
  const wMeta = await getExerciseMeta(page, warmupDay);
  const wEx = wMeta[0];
  await fillExerciseSets(page, wEx.id, wEx.sets, 100, 6, 2);
  await page.click(`[data-warm="${wEx.id}_1"]`);
  await page.fill(`[data-k="${wEx.id}_1_load"]`, "20");
  await saveWorkout(page);
  const wState = await getState(page);
  const todayStr = new Date().toISOString().slice(0, 10);
  const wRows = wState.log.filter((r) => r.exerciseId === wEx.id && r.date === todayStr);
  assert(
    wRows.some((r) => r.warmup === true && +r.load === 20),
    "Warmup flag persists on the saved row",
    JSON.stringify(wRows),
    "Mark set 1 W → save"
  );
  assert(
    wRows.some((r) => !r.warmup && +r.load === 100),
    "Working sets save without warmup key",
    JSON.stringify(wRows),
    "Save workout with mixed warmup/working sets"
  );
  await nav(page, "history");
  const sessText = await page.textContent("#sessions");
  assert(
    !/\b20×/.test(sessText.split("·")[2] || sessText),
    "History session top ignores the warmup set",
    sessText.slice(0, 120),
    "History → newest session summary"
  );
  await nav(page, "log");
  await selectDay(page, warmupDay);
  const recAfterWarmup = await cardInfo(page, 0);
  assert(
    recAfterWarmup.status === "is-add" || recAfterWarmup.status === "is-add2" || recAfterWarmup.status === "is-hold",
    "Recommendation ignores warmup loads in history",
    `status=${recAfterWarmup.status} chip="${recAfterWarmup.chip}"`,
    "Log warmup + working sets → recommendation uses working history"
  );

  beginPhase("Phase: PR ledger");
  await nav(page, "log");
  const prDay = await firstDayName(page);
  const prMeta = await getExerciseMeta(page, prDay);
  // Another exercise at a higher load first — global max must exceed the PR exercise's new top
  await fillExerciseSets(page, prMeta[1].id, prMeta[1].sets, 250, 6, 2);
  await saveWorkout(page);
  await nav(page, "log");
  await selectDay(page, prDay);
  // PR for exercise 0: beats its own prior top (~125) but stays below the 250 global max elsewhere
  await fillExerciseSets(page, prMeta[0].id, prMeta[0].sets, 150, 6, 2);
  await saveWorkout(page);
  const prToast = await page.textContent("#toast");
  assert(
    /PR:/.test(prToast),
    "Save toast announces a per-exercise top-load PR (not global max)",
    `Toast: ${prToast}`,
    "Log another exercise at 250 kg, then PR the first exercise at 150 kg → Save"
  );
  await nav(page, "stats");
  await page.evaluate(() => {
    document.querySelector("#statsDeep").open = true;
  });
  await page.waitForTimeout(100);
  const ledger = await page.textContent("#prLedger");
  assert(
    /load/i.test(ledger) && /e1RM/i.test(ledger),
    "PR ledger renders load and e1RM PRs",
    `Ledger: ${ledger}`,
    "Stats → Dig deeper → PR ledger under the trend"
  );
  await nav(page, "log");
  await selectDay(page, "Day 3");
  const prMeta3 = await getExerciseMeta(page, "Day 3");
  const prEx = prMeta3[prMeta3.length - 1];
  await fillExerciseSets(page, prEx.id, prEx.sets, 80, 8, 2);
  await saveWorkout(page);
  await nav(page, "log");
  await selectDay(page, "Day 3");
  await fillExerciseSets(page, prEx.id, prEx.sets, 85, 8, 2);
  await saveWorkout(page);
  const detectLoadPr = await page.evaluate((id) => {
    const log = JSON.parse(localStorage.getItem("repforge_v1")).log;
    return window.detectPRs(log).filter((e) => e.exerciseId === id && e.kind === "load" && e.deltaLoad > 0);
  }, prEx.id);
  assert(
    detectLoadPr.length > 0,
    "detectPRs finds load PR with positive delta",
    JSON.stringify(detectLoadPr),
    "Staged 80×8 then 85×8 → load PR event"
  );

  beginPhase("Phase: program-only export/import");
  await nav(page, "program");
  await page.locator("#program details.advanced summary").click();
  const progPath = join(tmpDir, "program.json");
  const [progDl] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportProgram"),
  ]);
  await progDl.saveAs(progPath);
  const progFile = JSON.parse(readFileSync(progPath, "utf8"));
  const progExercises = Array.isArray(progFile) ? progFile : progFile.exercises;
  assert(
    progFile.version === 2 && Array.isArray(progExercises) && progExercises.length > 0 && progFile.meta?.id,
    "Program export is v2 with meta and exercises",
    `Got: ${JSON.stringify(progFile).slice(0, 120)}`,
    "Program → Advanced → Export program JSON"
  );
  assert(
    /^repforge_program_.+\.json$/.test(progDl.suggestedFilename()),
    "Program export filename carries a slug segment",
    `filename=${progDl.suggestedFilename()}`,
    "Program → Advanced → Export program JSON with a named program"
  );
  const logBefore = (await getState(page)).log.length;
  progExercises[0].name = "IMPORTED_RENAME";
  if (progFile.version === 2) {
    progFile.exercises = progExercises;
    progFile.meta = { ...progFile.meta, name: "Imported Template", started: "2020-01-01", id: "foreign-id" };
    writeFileSync(progPath, JSON.stringify(progFile));
  } else {
    writeFileSync(progPath, JSON.stringify(progExercises));
  }
  const metaBeforeImport = (await getState(page)).programMeta;
  await page.setInputFiles("#importProgram", progPath);
  await page.waitForFunction(
    ({ k, name }) => JSON.parse(localStorage.getItem(k) || "{}").program?.some((x) => x.name === name),
    { k: KEY, name: "IMPORTED_RENAME" },
    { timeout: 5000 }
  );
  const stAfter = await getState(page);
  assert(
    stAfter.program.some((x) => x.name === "IMPORTED_RENAME"),
    "Program import applies the file",
    "Renamed exercise not found",
    "Export program → rename in file → Import program JSON"
  );
  assert(
    stAfter.programMeta?.name === "Imported Template",
    "Program import applies meta from v2 export",
    `programMeta.name=${stAfter.programMeta?.name}`,
    "Export v2 program → edit meta.name → Import program JSON"
  );
  assert(
    stAfter.programMeta.started === metaBeforeImport.started &&
      stAfter.programMeta.id === metaBeforeImport.id,
    "Program import keeps the recipient's start date and id",
    `started ${metaBeforeImport.started} → ${stAfter.programMeta?.started}; id ${metaBeforeImport.id} → ${stAfter.programMeta?.id}`,
    "Export v2 → edit meta.started/id in file → Import program JSON"
  );
  assert(
    stAfter.log.length === logBefore,
    "Program import leaves the log untouched",
    `log ${logBefore} → ${stAfter.log.length}`,
    "Import program JSON → History unchanged"
  );

  // Legacy array-only import still works
  const legacyPath = join(tmpDir, "program-legacy.json");
  writeFileSync(legacyPath, JSON.stringify(stAfter.program.slice(0, 3)));
  await page.setInputFiles("#importProgram", legacyPath);
  await page.waitForFunction(
    ({ k, len }) => JSON.parse(localStorage.getItem(k) || "{}").program?.length === len,
    { k: KEY, len: 3 },
    { timeout: 5000 }
  );
  const stLegacy = await getState(page);
  assert(
    stLegacy.program.length === 3,
    "Legacy array-only program import works",
    `program length=${stLegacy.program.length}`,
    "Import bare exercise array JSON"
  );
  writeFileSync(progPath, JSON.stringify(progFile));
  await page.setInputFiles("#importProgram", progPath);
  await page.waitForFunction(
    ({ k, name }) => JSON.parse(localStorage.getItem(k) || "{}").programMeta?.name === name,
    { k: KEY, name: "Imported Template" },
    { timeout: 5000 }
  );
  await page.evaluate(() => {
    document.querySelector("#programJson")?.blur();
    const d = document.querySelector("#program details.advanced");
    if (d) d.removeAttribute("open");
  });

  // ── Phase 10: Program JSON editor ────────────────────────────────
  beginPhase("Phase 10: Program JSON editor");

  await nav(page, "program");
  await page.locator("#program details.advanced summary").click();
  const jsonArea = page.locator("#programJson");
  let progJson = JSON.parse(await jsonArea.inputValue());
  const testExName = "JSON Editor Test Lift";
  progJson.push({
    day: "Day 4",
    order: 1,
    name: testExName,
    sets: 3,
    min: 5,
    max: 10,
    primary: "Test",
    secondary: "",
  });
  await jsonArea.fill(JSON.stringify(progJson, null, 2));
  await page.click("#saveProgram");
  await page.waitForTimeout(150);

  state = await getState(page);
  assert(
    state.program.some((e) => e.name === testExName),
    "Program JSON editor saves new exercise",
    "Exercise not found after JSON save",
    "Program → Advanced → edit JSON → Save JSON"
  );

  // Invalid JSON toast
  await jsonArea.fill("{ invalid json");
  await page.click("#saveProgram");
  await page.waitForTimeout(200);
  const toastText = await page.locator("#toast").textContent();
  assert(
    toastText.includes("parse") || toastText.includes("JSON"),
    "Invalid program JSON shows error toast",
    `Toast: "${toastText}"`,
    "Program → Advanced → enter invalid JSON → Save JSON"
  );

  // JSON round-trip preserves exercise ids
  await nav(page, "program");
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  const before = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
  const firstId = before[0].id;
  assert(
    !!firstId,
    "Program JSON exposes exercise ids",
    "No id field in program JSON",
    "Program → Advanced → JSON shows id"
  );
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  await page.click("#saveProgram");
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => JSON.parse(document.querySelector("#programJson").value));
  assert(
    after[0].id === firstId,
    "JSON round-trip preserves exercise ids",
    `id changed ${firstId} → ${after[0].id}`,
    "Program → Save JSON with no edits → ids unchanged"
  );

  // ── Phase 11: Edge cases & invariants ────────────────────────────
  beginPhase("Phase 11: Edge cases");

  // Backdated date in UI
  await nav(page, "log");
  const backdate = "2020-01-15";
  await setLogDate(page, backdate);
  const logDay =
    (await page.locator('#dayTabs button[data-day="Day 2"]').count()) > 0
      ? "Day 2"
      : await page.locator("#dayTabs button").first().getAttribute("data-day");
  await selectDay(page, logDay);
  const d2 = await getExerciseMeta(page, logDay);
  await fillExerciseSets(page, d2[0].id, 1, 40, 10, 2);
  await saveWorkout(page);
  state = await getState(page);
  assert(
    state.log.some((x) => x.date === backdate),
    "Backdated session saved",
    `No log entry with date ${backdate}`,
    "Log tab → set date to past → Save workout"
  );

  // Session ID collision on rapid double-save (same millisecond)
  await nav(page, "log");
  await selectDay(page, logDay);
  const collisionDate = "2019-06-01";
  await setLogDate(page, collisionDate);
  const d2b = (await getExerciseMeta(page, logDay))[0];
  await fillExerciseSets(page, d2b.id, 1, 55, 8, 1);
  await page.fill("#notes", "collision-test-A");
  await page.evaluate(() => { const f=document.querySelector("#logForm"); f?.requestSubmit(); f?.requestSubmit(); });
  await page.waitForTimeout(300);
  state = await getState(page);
  const collisionSessions = [
    ...new Set(
      state.log.filter((x) => x.date === collisionDate && x.notes === "collision-test-A").map((x) => x.session)
    ),
  ];
  assert(
    collisionSessions.length === 1,
    "Double-click save commits once (no duplicate session)",
    `Expected 1 session from double-click, got ${collisionSessions.length}`,
    "Log tab → fill workout → double-click Save workout rapidly"
  );

  // Invalid step value blocks save silently (HTML5 validation)
  await nav(page, "log");
  await selectDay(page, "Day 3");
  await setLogDate(page, "2018-04-01");
  const d3 = (await getExerciseMeta(page, "Day 3"))[0];
  await fillExerciseSets(page, d3.id, 1, 61.25, 8, 1);
  const logLenBeforeInvalid = (await getState(page)).log.length;
  await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
  await page.waitForTimeout(200);
  const logLenAfterInvalid = (await getState(page)).log.length;
  const formValid = await page.evaluate(() => document.querySelector("#logForm").checkValidity());
  if (!formValid && logLenAfterInvalid === logLenBeforeInvalid) {
    fail(
      "Silent save failure when load is not a 0.5 increment",
      "Entering 61.25 kg blocks HTML5 form validation with no toast or inline error. Input step=0.5 rejects .25 endings.",
      "Log tab → enter 61.25 kg → Save workout — nothing happens, no error shown"
    );
  } else {
    pass("Load validation allows save or shows user feedback");
  }

  // History sorted / sessions list
  await nav(page, "history");
  state = await getState(page);
  const sessionCards = await page.locator(".session").count();
  assert(
    sessionCards > 0,
    "History sessions list populated",
    `Count: ${sessionCards}`,
    "History tab after logging"
  );

  const historyTableRows = await page.locator("#historyTable tbody tr").count();
  assert(
    historyTableRows === state.log.length,
    "History table row count matches log",
    `Table ${historyTableRows} vs log ${state.log.length}`,
    "History tab → Every set table"
  );

  // Volume audit renders
  await nav(page, "program");
  const volRows = await page.locator(".vrow").count();
  assert(
    volRows > 0,
    "Volume audit renders muscle rows",
    `vrow count: ${volRows}`,
    "Program tab → Weekly volume audit"
  );

  // Delete log (reset) — test then stop (wipes data for clean exit)
  await nav(page, "settings");
  const logLenBeforeReset = (await getState(page)).log.length;
  await page.click("#reset");
  await page.waitForTimeout(150);
  state = await getState(page);
  assert(
    state.log.length === 0 && logLenBeforeReset > 0,
    "Delete log clears all sessions",
    `Log length ${state.log.length}, was ${logLenBeforeReset}`,
    "Settings → Delete log → confirm"
  );

  // Program should survive reset
  assert(
    state.program.length > 0,
    "Delete log preserves program",
    "Program was wiped with log",
    "Settings → Delete log → Program tab should still have exercises"
  );

  // Invalid import
  const badJsonPath = join(tmpDir, "bad.json");
  writeFileSync(badJsonPath, '{"not": "a backup"}');
  await page.setInputFiles("#importJson", badJsonPath);
  await page.waitForTimeout(200);
  const badToast = await page.locator("#toast").textContent();
  assert(
    badToast.includes("valid") || badToast.includes("backup"),
    "Invalid import shows error toast",
    `Toast: "${badToast}"`,
    "Settings → Import non-RepForge JSON file"
  );

  // ── Phase 12: All-tier upgrades ──────────────────────────────────
  beginPhase("Phase 12: Progression + UX + hypertrophy upgrades");

  await clearState(page);
  await reloadApp(page);

  beginPhase("Phase 12a: Progression matrix (state-driven scenarios)");
  const matrixDay = "Day 1";
  await nav(page, "log");
  const matrixEx = await getExerciseMeta(page, matrixDay);
  assert(matrixEx.length >= 4, "Day 1 has enough exercises for progression matrix", `count=${matrixEx.length}`, "Default program → Day 1");

  const [exNew, exAdd, exAdd2, exHold] = matrixEx;
  const newCard = await cardInfoById(page, exNew.id);
  assert(
    newCard?.status === "is-new" && /new/i.test(newCard.chip),
    "Fresh exercise recommends New lift status",
    JSON.stringify(newCard),
    "Clear state → Log Day 1 → exercise with no history is is-new"
  );

  const addCard = await scenarioRecommendation(page, {
    day: matrixDay,
    exId: exAdd.id,
    rows: scenarioRows({
      day: matrixDay,
      ex: exAdd,
      sessions: [{ date: "2025-02-01", load: 100, reps: exAdd.max, rir: 1 }],
    }),
  });
  assert(
    addCard?.status === "is-add" && /add load/i.test(addCard.chip),
    "Max reps at target RIR triggers Add load",
    JSON.stringify(addCard),
    "One session all sets at max reps → is-add recommendation"
  );

  const add2Card = await scenarioRecommendation(page, {
    day: matrixDay,
    exId: exAdd2.id,
    rows: scenarioRows({
      day: matrixDay,
      ex: exAdd2,
      sessions: [{ date: "2025-02-02", load: 100, reps: exAdd2.max, rir: 3 }],
    }),
    settingsPatch: { rirHigh: 2 },
  });
  assert(
    add2Card?.status === "is-add2" && /\+\+/i.test(add2Card.chip),
    "Max reps with spare RIR triggers Add load ++",
    JSON.stringify(add2Card),
    "Top range + RIR above ceiling → is-add2"
  );

  const holdReps = Math.max(exHold.min, Math.min(exHold.max, exHold.min + 1));
  const holdCard = await scenarioRecommendation(page, {
    day: matrixDay,
    exId: exHold.id,
    rows: scenarioRows({
      day: matrixDay,
      ex: exHold,
      sessions: [{ date: "2025-02-03", load: 100, reps: holdReps, rir: 1 }],
    }),
  });
  assert(
    holdCard?.status === "is-hold" && /hold/i.test(holdCard.chip),
    "In-range performance triggers Hold recommendation",
    JSON.stringify(holdCard),
    "Reps inside range → is-hold"
  );

  // ── Phase 12a-dyn: Dynamic per-set suggestions (session + block signals) ──
  beginPhase("Phase 12a-dyn: Dynamic load/reps suggestions");
  await clearState(page);
  await reloadApp(page);
  {
    const st = await getState(page);
    const dynEx = st.program
      .filter((e) => e.day === "Day 1")
      .sort((a, b) => a.order - b.order)[0];
    dynEx.sets = Math.max(3, dynEx.sets);
    const { min, max, sets } = dynEx;
    const dISO = (daysAgo) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };
    const mkSess = (date, load, reps, rir, tag) => {
      const session = `${date}_Day 1_dyn_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return Array.from({ length: sets }, (_, i) => ({
        session, date, day: "Day 1", name: dynEx.name, exerciseId: dynEx.id,
        set: i + 1, load, reps, rir, notes: "", created,
        primary: dynEx.primary, secondary: dynEx.secondary,
      }));
    };
    // Three in-range sessions with rising load → block trend "rising", last → hold.
    const dynLog = [
      ...mkSess(dISO(21), 100, min, 1, "s1"),
      ...mkSess(dISO(14), 105, min, 1, "s2"),
      ...mkSess(dISO(7), 110, min, 1, "s3"),
    ];
    await persistState(page, {
      ...st,
      programMeta: { ...st.programMeta, started: dISO(28), mesocycleStatus: "active", onboarded: true },
      log: dynLog,
    });
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");

    const blockNote = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .rec__block`)
      .textContent()
      .catch(() => "");
    assert(
      /rising/i.test(blockNote || ""),
      "Block-trend note reflects rising strength across the block",
      `note="${blockNote}"`,
      "Seed 3 rising in-range sessions → card shows a rising block-trend note"
    );

    const dynBaseLoad1 = await page.inputValue(`[data-k="${dynEx.id}_1_load"]`);
    assert(
      dynBaseLoad1 === "110",
      "Set 1 base load comes from the previous session median",
      `load=${dynBaseLoad1}`,
      "Previous session median 110 → set 1 pre-fills 110"
    );
    const dynBaseReps1 = +(await page.inputValue(`[data-k="${dynEx.id}_1_reps"]`));
    assert(
      dynBaseReps1 === min + 1,
      "Hold auto-increments the rep target to last reps + 1 (double progression)",
      `reps=${dynBaseReps1} expected=${min + 1}`,
      `Previous session ${min} reps at a held load → set 1 target ${min + 1}`
    );
    const dynBaseLoad2 = +(await page.inputValue(`[data-k="${dynEx.id}_2_load"]`));

    // In-session: easy top-rep set 1 nudges set 2 UP with an explanatory note.
    await page.fill(`[data-k="${dynEx.id}_1_load"]`, "110");
    await page.fill(`[data-k="${dynEx.id}_1_reps"]`, String(max));
    await page.fill(`[data-k="${dynEx.id}_1_rir"]`, "3");
    await page.click(`.saveset[data-save="${dynEx.id}_1"]`);
    await page.waitForTimeout(120);
    const dynUpLoad2 = +(await page.inputValue(`[data-k="${dynEx.id}_2_load"]`));
    const dynUpReps2 = +(await page.inputValue(`[data-k="${dynEx.id}_2_reps"]`));
    const dynUpNote = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      dynUpLoad2 > dynBaseLoad2,
      "Easy set 1 (top reps, high RIR) nudges set 2 load up in-session",
      `base2=${dynBaseLoad2} now=${dynUpLoad2}`,
      "Save an easy set 1 → set 2 suggested load increases"
    );
    // Plan 039 / ADR 0003: a load bump re-enters on predicted capacity at the new
    // load, not on a blind reset to the range bottom.
    assert(
      dynUpReps2 > min && dynUpReps2 <= max,
      "After an in-session load bump, set 2 reps re-enter inside the range on capacity",
      `reps=${dynUpReps2} range=${min}-${max}`,
      "Load bump mid-session → reps target is the capacity-predicted re-entry, above the range bottom"
    );
    assert(
      /nudged up/i.test(dynUpNote || ""),
      "In-session note explains the upward nudge",
      `note="${dynUpNote}"`,
      "Easy set 1 → highlighted 'nudged up' note"
    );

    // Editing a still-committed set must immediately recompute later suggestions.
    await page.fill(`[data-k="${dynEx.id}_1_reps"]`, String(Math.max(1, min - 2)));
    await page.fill(`[data-k="${dynEx.id}_1_rir"]`, "0");
    await page.waitForTimeout(120);
    const dynEditedLoad2 = +(await page.inputValue(`[data-k="${dynEx.id}_2_load"]`));
    const dynEditedNote = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      dynEditedLoad2 < dynBaseLoad2 && /fell short|eased/i.test(dynEditedNote || ""),
      "Editing a committed set refreshes its later load suggestion and note",
      `base2=${dynBaseLoad2} now=${dynEditedLoad2} note="${dynEditedNote}"`,
      "Save an easy set, then edit it below range → set 2 changes from up to down"
    );

    // In-session: short set 1 (below min reps) eases set 2 DOWN.
    const beforePortuguese = await getState(page);
    await persistState(page, {
      ...beforePortuguese,
      settings: { ...beforePortuguese.settings, lang: "pt" },
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const dynBase2b = +(await page.inputValue(`[data-k="${dynEx.id}_2_load"]`));
    await page.fill(`[data-k="${dynEx.id}_1_load"]`, "110");
    await page.fill(`[data-k="${dynEx.id}_1_reps"]`, String(Math.max(1, min - 2)));
    await page.fill(`[data-k="${dynEx.id}_1_rir"]`, "0");
    await page.click(`.saveset[data-save="${dynEx.id}_1"]`);
    await page.waitForTimeout(120);
    const dynDownLoad2 = +(await page.inputValue(`[data-k="${dynEx.id}_2_load"]`));
    const dynDownNote = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      dynDownLoad2 < dynBase2b,
      "Short set 1 (below min reps) eases set 2 load down in-session",
      `base2=${dynBase2b} now=${dynDownLoad2}`,
      "Save a below-range set 1 → set 2 suggested load decreases"
    );
    assert(
      /abaixo da faixa|caiu para/i.test(dynDownNote || ""),
      "In-session note explains the downward ease in Portuguese",
      `note="${dynDownNote}"`,
      "Portuguese UI + short set 1 → localized highlighted note"
    );
    const blockNotePt = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .rec__block`)
      .textContent()
      .catch(() => "");
    assert(
      /tendência do bloco|força subindo/i.test(blockNotePt || ""),
      "Block-trend note is localized in Portuguese",
      `note="${blockNotePt}"`,
      "Portuguese UI + seeded block trend → localized trend note"
    );

    // A falling block is weak evidence: it tempers a double jump to one step.
    const fallingLog = [
      ...mkSess(dISO(21), 140, max, 1, "f1"),
      ...mkSess(dISO(14), 120, max, 1, "f2"),
      ...mkSess(dISO(7), 100, max, 3, "f3"),
    ];
    const beforeFalling = await getState(page);
    await persistState(page, {
      ...beforeFalling,
      settings: { ...beforeFalling.settings, lang: "en" },
      log: fallingLog,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const tempered = await page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      const rec = window.__repforgeRecommendation?.(ex);
      return rec && { status: rec.status, text: rec.text, block: rec.block };
    }, dynEx.id);
    assert(
      tempered?.status === "add" &&
        tempered?.block?.dir === "falling" &&
        /one step|not a big jump/i.test(tempered?.text || ""),
      "Falling block trend tempers a bold double jump to one load step",
      JSON.stringify(tempered),
      "Seed falling e1RM trend + easy top-range latest session → Add load, not Add load ++"
    );

    // Block direction follows best-set e1RM, matching the rest of the app.
    const mkMixedSess = (date, heavyReps, backoffLoad, tag) => {
      const session = `${date}_Day 1_dyn_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return Array.from({ length: sets }, (_, i) => ({
        session, date, day: "Day 1", name: dynEx.name, exerciseId: dynEx.id,
        set: i + 1, load: i === 0 ? 100 : backoffLoad,
        reps: i === 0 ? Math.min(max, heavyReps) : max, rir: 1, notes: "", created,
        primary: dynEx.primary, secondary: dynEx.secondary,
      }));
    };
    const bestSetRisingLog = [
      ...mkMixedSess(dISO(21), min, 80, "best1"),
      ...mkMixedSess(dISO(14), min + 1, 75, "best2"),
      ...mkMixedSess(dISO(7), min + 2, 70, "best3"),
    ];
    const beforeBestSetTrend = await getState(page);
    await persistState(page, {
      ...beforeBestSetTrend,
      programMeta: { ...beforeBestSetTrend.programMeta, started: dISO(28) },
      log: bestSetRisingLog,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    const bestSetTrend = await page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      return window.__repforgeRecommendation?.(ex)?.block;
    }, dynEx.id);
    assert(
      bestSetTrend?.dir === "rising",
      "Block trend uses each session's best-set e1RM",
      JSON.stringify(bestSetTrend),
      "Seed rising best-set e1RM with falling back-off loads → trend remains rising"
    );

    const noBlockState = await getState(page);
    await persistState(page, {
      ...noBlockState,
      programMeta: { ...noBlockState.programMeta, started: null },
    });
    await reloadApp(page);
    const noBlockTrend = await page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      return window.__repforgeRecommendation?.(ex)?.block;
    }, dynEx.id);
    assert(
      noBlockTrend?.dir == null && noBlockTrend?.sessions === 0,
      "No block start disables lifetime-history trend tempering",
      JSON.stringify(noBlockTrend),
      "Clear program start date → recommendation has no block trend"
    );

    if (sets >= 3) {
      const partialHistoryState = await getState(page);
      await persistState(page, {
        ...partialHistoryState,
        programMeta: { ...partialHistoryState.programMeta, started: dISO(28) },
        log: dynLog.filter((row) => row.set <= 2),
      });
      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      await reloadApp(page);
      await nav(page, "log");
      await selectDay(page, "Day 1");
      const newSetReps = +(await page.inputValue(`[data-k="${dynEx.id}_3_reps"]`));
      assert(
        newSetReps === min,
        "A newly added set without prior history starts at the range minimum",
        `set3 reps=${newSetReps} expected=${min}`,
        "History has two sets, program has three → third set does not invent last reps + 1"
      );
    }

    // Saving out of order must preserve an edited earlier row and explain set 3.
    const beforeOutOfOrder = await getState(page);
    await persistState(page, {
      ...beforeOutOfOrder,
      settings: { ...beforeOutOfOrder.settings, lang: "en" },
      programMeta: { ...beforeOutOfOrder.programMeta, started: dISO(28) },
      log: dynLog,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.fill(`[data-k="${dynEx.id}_1_load"]`, "109");
    await page.fill(`[data-k="${dynEx.id}_2_load"]`, "110");
    await page.fill(`[data-k="${dynEx.id}_2_reps"]`, String(max));
    await page.fill(`[data-k="${dynEx.id}_2_rir"]`, "3");
    await page.click(`.saveset[data-save="${dynEx.id}_2"]`);
    await page.waitForTimeout(120);
    const preservedSet1 = +(await page.inputValue(`[data-k="${dynEx.id}_1_load"]`));
    const adjustedSet3 = +(await page.inputValue(`[data-k="${dynEx.id}_3_load"]`));
    const outOfOrderNote = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      preservedSet1 === 109 && adjustedSet3 > 110 && /set 3/i.test(outOfOrderNote || ""),
      "Out-of-order save preserves touched rows and explains the next adjusted set",
      `set1=${preservedSet1} set3=${adjustedSet3} note="${outOfOrderNote}"`,
      "Edit set 1, save easy set 2 → set 1 stays edited; set 3 nudges up with note"
    );
  }

  // ── Phase 12a-cap: Capacity engine (plan 039 / ADR 0003) ─────────
  // Capacity = performed reps + trusted RIR, normalized across loads as
  // capacity-e1RM and inverted to predict performable reps at any load.
  beginPhase("Phase 12a-cap: Capacity-driven load & rep suggestions");
  {
    const capRows = (ex, day, date, load, reps, rir, tag) => {
      const session = `${date}_${day}_cap_${ex.id}_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return Array.from({ length: ex.sets }, (_, i) => ({
        session, date, day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps, rir, notes: "", created,
        primary: ex.primary, secondary: ex.secondary,
      }));
    };

    // ── Pure capacity math ────────────────────────────────────────
    await clearState(page);
    await reloadApp(page);
    const capMath = await page.evaluate(() => {
      const C = window.__repforgeCapacity;
      if (!C) return null;
      return {
        plain: C.capReps(6, 3),
        capped: C.capReps(6, 99),
        blank: C.capReps(6, ""),
        negative: C.capReps(6, -3),
        roundTrip: C.repsAtLoad(100 * (1 + 9 / 30), 100),
        constants: C.CAPACITY,
      };
    });
    assert(
      capMath?.plain === 9,
      "Capacity is performed reps plus trusted reps in reserve",
      JSON.stringify(capMath),
      "capReps(6, 3) → 9"
    );
    assert(
      capMath?.capped === 10,
      "RIR credit is capped at the hard-set ceiling (fantasy far from failure)",
      `capReps(6, 99)=${capMath?.capped} hardRir=4`,
      "capReps(6, 99) → 10, not 105"
    );
    assert(
      capMath?.blank === 7,
      "Blank RIR keeps the conservative default of 1",
      `capReps(6, "")=${capMath?.blank}`,
      'capReps(6, "") → 7'
    );
    assert(
      capMath?.negative === 6,
      "Negative RIR floors at zero credit",
      `capReps(6, -3)=${capMath?.negative}`,
      "capReps(6, -3) → 6, never below performed reps"
    );
    assert(
      capMath?.roundTrip === 9,
      "Inverse Epley round-trips exactly onto whole reps",
      `repsAtLoad(e1rm(100, 9), 100)=${capMath?.roundTrip}`,
      "repsAtLoad(e1rm(100, 9), 100) → exactly 9, so integer triggers cannot be missed by float noise"
    );
    assert(
      capMath?.constants?.jumpMargin === 1 && capMath?.constants?.bigJumpMargin === 3 &&
        capMath?.constants?.pushGap === 2 && capMath?.constants?.temperClamp === 0.05,
      "Capacity tuning constants live in one table",
      JSON.stringify(capMath?.constants),
      "window.__repforgeCapacity.CAPACITY exposes the tunables the engine reads"
    );

    // ── Trigger table: capacity extends jumps, never retracts them ──
    const capState = await getState(page);
    const capDay = "Day 1";
    const capDay1 = capState.program
      .filter((e) => e.day === capDay)
      .sort((a, b) => a.order - b.order);
    assert(
      capDay1.length >= 6,
      "Day 1 has enough exercises for the capacity trigger table",
      `count=${capDay1.length}`,
      "Default program → Day 1 has six slots"
    );
    // A 6-8 range with three sets makes the plan's worked examples apply directly.
    for (const e of capDay1) { e.min = 6; e.max = 8; e.sets = 3; }
    const [exCapAdd, exReentry, exCapCapped, exPerfFloor, exCapReduce, exCapHold] = capDay1;
    await persistState(page, {
      ...capState,
      // No block start → no block tempering, so these read the raw trigger chain.
      programMeta: { ...capState.programMeta, started: null, onboarded: true },
      log: [
        // Demonstrated capacity 9 in a 6-8 range, but only 6 performed reps.
        ...capRows(exCapAdd, capDay, "2025-04-01", 100, 6, 3, "add"),
        // Top of the range at one RIR → re-entry has real surplus to spend.
        ...capRows(exReentry, capDay, "2025-04-02", 100, 8, 1, "reentry"),
        // RIR 6 is credited as 4, so capacity is 10 — short of the ++ margin.
        ...capRows(exCapCapped, capDay, "2025-04-03", 100, 6, 6, "capped"),
        // Performed reps at the top with nothing in reserve.
        ...capRows(exPerfFloor, capDay, "2025-04-04", 100, 8, 0, "floor"),
        // Capacity itself falls short of the range bottom.
        ...capRows(exCapReduce, capDay, "2025-04-05", 100, 5, 0, "reduce"),
        // Stopped early, but capacity still reaches into the range.
        ...capRows(exCapHold, capDay, "2025-04-06", 100, 5, 2, "hold"),
      ],
    });
    await reloadApp(page);
    const capRecs = await page.evaluate((ids) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const out = {};
      for (const [key, id] of Object.entries(ids)) {
        const ex = (raw.program || []).find((e) => e.id === id);
        const rec = window.__repforgeRecommendation?.(ex);
        out[key] = rec && { status: rec.status, load: rec.load, cap: rec.cap, typRir: rec.typRir };
      }
      return out;
    }, {
      add: exCapAdd.id, reentry: exReentry.id, capped: exCapCapped.id,
      floor: exPerfFloor.id, reduce: exCapReduce.id, hold: exCapHold.id,
    });
    assert(
      capRecs.add?.status === "add",
      "Demonstrated capacity above the range top fires the load jump early",
      JSON.stringify(capRecs.add),
      "6 reps @ RIR 3 in a 6-8 range (capacity 9) → Add load now, without grinding reps to the top first"
    );
    assert(
      capRecs.capped?.status === "add",
      "Capped RIR credit does not over-trigger the double jump",
      JSON.stringify(capRecs.capped),
      "6 reps @ RIR 6 is credited as capacity 10 → Add load, not Add load ++"
    );
    assert(
      capRecs.floor?.status === "add",
      "Performed reps at the range top still fire the jump on their own",
      JSON.stringify(capRecs.floor),
      "All sets 8 reps @ RIR 0 (capacity 8) → Add load — capacity extends triggers, never retracts them"
    );
    assert(
      capRecs.reduce?.status === "reduce" && capRecs.reduce?.load < 100,
      "Capacity below the range bottom backs the load off",
      JSON.stringify(capRecs.reduce),
      "5 reps @ RIR 0 in a 6-8 range (capacity 5) → Back off with a lighter target"
    );
    assert(
      capRecs.hold?.status === "hold",
      "Stopping short of the range is not failing it",
      JSON.stringify(capRecs.hold),
      "5 reps @ RIR 2 in a 6-8 range (capacity 7) → hold family, NOT Back off"
    );

    // ── Capacity re-entry after a load change ─────────────────────
    await nav(page, "log");
    await selectDay(page, capDay);
    const reentryLoad = +(await page.inputValue(`[data-k="${exReentry.id}_1_load"]`));
    const reentryReps = +(await page.inputValue(`[data-k="${exReentry.id}_1_reps"]`));
    assert(
      reentryLoad > 100 && reentryReps > exReentry.min && reentryReps <= exReentry.max,
      "A new load re-enters at capacity-predicted reps, not the range bottom",
      `load=${reentryLoad} reps=${reentryReps} range=${exReentry.min}-${exReentry.max}`,
      "Add load with surplus capacity → set 1 targets predicted reps at the new load, above the bottom"
    );
    const reentryNote = await page
      .locator(`.exercise[data-ex="${exReentry.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      /should land at your usual effort/i.test(reentryNote || ""),
      "The re-entry note explains the new load's rep target",
      `note="${reentryNote}"`,
      "Add load with re-entry above the range bottom → log.insession.reentry renders"
    );

    // A jump dominated by minJump is a big percentage move — the clamp still bites.
    const lightState = await getState(page);
    const lightEx = lightState.program.find((e) => e.id === exReentry.id);
    lightEx.min = 6; lightEx.max = 8; lightEx.sets = 3;
    await persistState(page, {
      ...lightState,
      log: capRows(lightEx, capDay, "2025-04-02", 10, 8, 1, "light"),
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, capDay);
    const lightReps = +(await page.inputValue(`[data-k="${exReentry.id}_1_reps"]`));
    assert(
      lightReps === lightEx.min,
      "A big-percentage jump still lands at the range bottom via the clamp",
      `reps=${lightReps} min=${lightEx.min}`,
      "10 kg lift where minJump dominates → 12.5 kg predicts fewer reps than the range holds → clamp to the bottom"
    );

    // ── Anticipatory in-session prediction ────────────────────────
    const dropState = await getState(page);
    const dropEx = dropState.program.find((e) => e.id === exReentry.id);
    dropEx.min = 6; dropEx.max = 8; dropEx.sets = 3;
    await persistState(page, {
      ...dropState,
      log: [
        ...capRows(dropEx, capDay, "2025-04-08", 100, 7, 1, "d1"),
        ...capRows(dropEx, capDay, "2025-04-15", 100, 7, 1, "d2"),
      ],
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, capDay);
    // Two declining sets: capacity 130 then 126.67 → the third is projected lower still.
    for (const [n, reps] of [[1, 8], [2, 7]]) {
      await page.fill(`[data-k="${dropEx.id}_${n}_load"]`, "100");
      await page.fill(`[data-k="${dropEx.id}_${n}_reps"]`, String(reps));
      await page.fill(`[data-k="${dropEx.id}_${n}_rir"]`, "1");
      await page.click(`.saveset[data-save="${dropEx.id}_${n}"]`);
      await page.waitForTimeout(120);
    }
    const dropSet3 = +(await page.inputValue(`[data-k="${dropEx.id}_3_reps"]`));
    assert(
      dropSet3 <= 7,
      "The next set anticipates the observed per-set drop instead of echoing the last one",
      `set3 reps=${dropSet3} set2 performed=7`,
      "Commit 8 then 7 reps @ RIR 1 → set 3 targets no more than the second set's performed reps"
    );
    const dropNote = await page
      .locator(`.exercise[data-ex="${dropEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      /trending down/i.test(dropNote || ""),
      "The anticipated-drop note names the trend, not the arithmetic",
      `note="${dropNote}"`,
      "Declining sets → log.insession.drop renders"
    );

    // Only an anticipated drop makes it a trend. A target eased purely by the
    // lifter's own typical RIR is steady state, and must not claim otherwise.
    const steadyState = await getState(page);
    const steadyEx = steadyState.program.find((e) => e.id === exReentry.id);
    steadyEx.min = 6; steadyEx.max = 8; steadyEx.sets = 3;
    await persistState(page, {
      ...steadyState,
      // Identical sets within each session → zero historical drop; RIR 2 → typical RIR 2.
      log: [
        ...capRows(steadyEx, capDay, "2025-04-22", 100, 7, 2, "s1"),
        ...capRows(steadyEx, capDay, "2025-04-29", 100, 7, 2, "s2"),
      ],
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, capDay);
    await page.fill(`[data-k="${steadyEx.id}_1_load"]`, "100");
    await page.fill(`[data-k="${steadyEx.id}_1_reps"]`, "8");
    await page.fill(`[data-k="${steadyEx.id}_1_rir"]`, "1");
    await page.click(`.saveset[data-save="${steadyEx.id}_1"]`);
    await page.waitForTimeout(150);
    const steadySet2 = +(await page.inputValue(`[data-k="${steadyEx.id}_2_reps"]`));
    const steadyNote = await page
      .locator(`.exercise[data-ex="${steadyEx.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      steadySet2 < 8 && /holding/i.test(steadyNote || "") && !/trending down/i.test(steadyNote || ""),
      "A target eased only by the lifter's typical RIR is not reported as a downward trend",
      `set2 reps=${steadySet2} note="${steadyNote}"`,
      "One completed set of 8 @ RIR 1, typical RIR 2, no drop history → set 2 targets 7 reps with log.insession.hold, NOT log.insession.drop"
    );

    // ── Session freshness: temper-only cross-exercise signal ──────
    await clearState(page);
    await reloadApp(page);
    const freshState = await getState(page);
    const freshDay1 = freshState.program
      .filter((e) => e.day === capDay)
      .sort((a, b) => a.order - b.order);
    const [exGrind, exOverlap, exApart, exOther] = freshDay1;
    // Explicit muscles make the overlap weights deterministic.
    exGrind.primary = "Chest"; exGrind.secondary = "";
    exOverlap.primary = "Chest"; exOverlap.secondary = "";
    exApart.primary = "Calves"; exApart.secondary = "";
    exOther.primary = "Calves"; exOther.secondary = "";
    for (const e of [exGrind, exOverlap, exApart, exOther]) { e.min = 6; e.max = 8; e.sets = 3; }
    await persistState(page, {
      ...freshState,
      programMeta: { ...freshState.programMeta, started: null, onboarded: true },
      log: [
        // Two sessions each → a real capacity baseline for every contributor.
        ...capRows(exGrind, capDay, "2025-05-01", 100, 8, 2, "g1"),
        ...capRows(exGrind, capDay, "2025-05-08", 100, 8, 2, "g2"),
        ...capRows(exOverlap, capDay, "2025-05-01", 100, 8, 1, "o1"),
        ...capRows(exOverlap, capDay, "2025-05-08", 100, 8, 1, "o2"),
        ...capRows(exApart, capDay, "2025-05-01", 100, 8, 1, "a1"),
        ...capRows(exApart, capDay, "2025-05-08", 100, 8, 1, "a2"),
        ...capRows(exOther, capDay, "2025-05-01", 100, 8, 2, "t1"),
        ...capRows(exOther, capDay, "2025-05-08", 100, 8, 2, "t2"),
      ],
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    const freshness = await page.evaluate((ids) => {
      const C = window.__repforgeCapacity;
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const find = (id) => (raw.program || []).find((e) => e.id === id);
      const mkDraft = (entries) => {
        const d = { __done: [], __warm: [], __touched: [] };
        for (const [exId, n, load, reps, rir] of entries) {
          d[`${exId}_${n}_load`] = String(load);
          d[`${exId}_${n}_reps`] = String(reps);
          d[`${exId}_${n}_rir`] = String(rir);
          d.__done.push(`${exId}_${n}`);
        }
        return d;
      };
      const sets = (id, reps, rir) => [1, 2, 3].map((n) => [id, n, 100, reps, rir]);
      // Grind lift runs 5% under its capacity baseline; the other lift sits on its own.
      const below = mkDraft([...sets(ids.grind, 6, 2), ...sets(ids.other, 8, 2)]);
      return {
        overlap: C.sessionFreshness(find(ids.overlap), below),
        apart: C.sessionFreshness(find(ids.apart), below),
        // Above baseline must never boost a downstream lift.
        above: C.sessionFreshness(find(ids.overlap), mkDraft(sets(ids.grind, 10, 4))),
        // Two completed sets is not enough evidence to say anything.
        thin: C.sessionFreshness(find(ids.overlap), mkDraft([
          [ids.grind, 1, 100, 4, 0], [ids.grind, 2, 100, 4, 0],
        ])),
        // A deep deficit is still capped at temperClamp.
        deep: C.sessionFreshness(find(ids.overlap), mkDraft(sets(ids.grind, 2, 0))),
      };
    }, { grind: exGrind.id, overlap: exOverlap.id, apart: exApart.id, other: exOther.id });
    assert(
      freshness.overlap < freshness.apart && freshness.overlap < 1 && freshness.apart <= 1,
      "Session freshness weights the deficit by muscle overlap",
      JSON.stringify(freshness),
      "Grind a chest lift below baseline → a second chest lift tempers more than a calf lift"
    );
    assert(
      freshness.above === 1,
      "Session freshness never boosts a suggestion",
      `factor=${freshness.above}`,
      "Earlier lift ABOVE its capacity baseline → factor clamps to exactly 1"
    );
    assert(
      freshness.thin === 1,
      "Session freshness stays silent without enough completed sets",
      `factor=${freshness.thin}`,
      "Only two completed working sets → evidence gate returns a no-op factor"
    );
    assert(
      Math.abs(freshness.deep - 0.95) < 1e-9,
      "The total freshness adjustment is capped at 5% of capacity",
      `factor=${freshness.deep}`,
      "A deep capacity deficit → factor floors at 1 - temperClamp"
    );

    // The temper reaches the ghost values and says so, on a lift with no sets yet.
    await nav(page, "log");
    await selectDay(page, capDay);
    const beforeTemperReps = +(await page.inputValue(`[data-k="${exOverlap.id}_1_reps"]`));
    for (const n of [1, 2, 3]) {
      await page.fill(`[data-k="${exGrind.id}_${n}_load"]`, "100");
      await page.fill(`[data-k="${exGrind.id}_${n}_reps"]`, "4");
      await page.fill(`[data-k="${exGrind.id}_${n}_rir"]`, "0");
      await page.click(`.saveset[data-save="${exGrind.id}_${n}"]`);
      await page.waitForTimeout(120);
    }
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, capDay);
    const afterTemperReps = +(await page.inputValue(`[data-k="${exOverlap.id}_1_reps"]`));
    assert(
      afterTemperReps < beforeTemperReps && afterTemperReps >= exOverlap.min,
      "Grinding an earlier lift eases the first set of a lift not yet started",
      `before=${beforeTemperReps} after=${afterTemperReps} min=${exOverlap.min}`,
      "Commit three chest sets well under baseline → the untouched chest lift's set 1 asks for fewer reps"
    );
    const temperNote = await page
      .locator(`.exercise[data-ex="${exOverlap.id}"] .insession`)
      .textContent()
      .catch(() => "");
    assert(
      /ran hot today/i.test(temperNote || ""),
      "The temper note names the signal, not the arithmetic",
      `note="${temperNote}"`,
      "Tempered first set → log.insession.temper renders, with no percentages in the copy"
    );

    // Effort words feed capacity through the same 3/1/0 mapping.
    const effortCaps = await page.evaluate(() => {
      const C = window.__repforgeCapacity;
      return { easy: C.capReps(6, 3), hard: C.capReps(6, 1), max: C.capReps(6, 0) };
    });
    assert(
      effortCaps.easy === 9 && effortCaps.hard === 7 && effortCaps.max === 6,
      "Effort words map into capacity through the unchanged 3/1/0 RIR scale",
      JSON.stringify(effortCaps),
      "easy/hard/max → capacity 9/7/6 on a 6-rep set, all inside the hard-set cap"
    );
  }

  // Performance-gated Hold · recover (spec 2026-07-10 / plan 037)
  beginPhase("Phase 12a2: Hold · recover performance gate");

  function setRows(ex, day, date, load, setSpecs) {
    const session = `${date}_${day}_recover_${ex.id}_${date}_${load}`;
    const created = new Date(`${date}T12:00:00Z`).toISOString();
    const specs = [];
    for (let i = 0; i < ex.sets; i++) specs.push(setSpecs[Math.min(i, setSpecs.length - 1)]);
    return specs.map((s, i) => ({
      session, date, day, name: ex.name || "Recover test", exerciseId: ex.id, set: i + 1,
      load, reps: s.reps, rir: s.rir, notes: "", created,
      primary: ex.primary || "", secondary: ex.secondary || "",
    }));
  }

  const recoverCaseDefs = [
    {
      name: "Grind + rep gain → Hold · add reps",
      build: (ex, day, mid) => [
        ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 1 }, { reps: mid, rir: 1 }]),
        ...setRows(ex, day, "2025-03-08", 60, [{ reps: mid + 1, rir: 0 }, { reps: mid, rir: 0 }]),
      ],
      expectChip: /hold\s*·\s*add reps/i,
      expectRecover: false,
    },
    {
      name: "Grind + flat reps → Hold · recover",
      build: (ex, day, mid) => [
        ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
        ...setRows(ex, day, "2025-03-08", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
      ],
      expectChip: /hold\s*·\s*recover/i,
      expectRecover: true,
    },
    {
      name: "Grind + load jump → Hold · add reps",
      build: (ex, day, mid) => {
        const low = Math.max(ex.min, mid - 1);
        return [
          ...setRows(ex, day, "2025-03-01", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
          ...setRows(ex, day, "2025-03-08", 62.5, [{ reps: low, rir: 0 }, { reps: low, rir: 0 }]),
        ];
      },
      expectChip: /hold\s*·\s*add reps/i,
      expectRecover: false,
    },
    {
      name: "Single grinding session → Hold · add reps",
      build: (ex, day, mid) => setRows(ex, day, "2025-03-08", 60, [{ reps: mid, rir: 0 }, { reps: mid, rir: 0 }]),
      expectChip: /hold\s*·\s*add reps/i,
      expectRecover: false,
    },
  ];

  for (const c of recoverCaseDefs) {
    await clearState(page);
    await reloadApp(page);
    const recoverEx = (await getExerciseMeta(page, matrixDay))[0];
    const mid = Math.max(recoverEx.min, Math.min(recoverEx.max - 1, recoverEx.min + 1));
    const card = await scenarioRecommendation(page, {
      day: matrixDay,
      exId: recoverEx.id,
      rows: c.build(recoverEx, matrixDay, mid),
    });
    const signal = await page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      return {
        recover: window.__repforgeRecoverSignal?.(ex),
        label: window.__repforgeRecommendation?.(ex)?.label,
      };
    }, recoverEx.id);
    assert(
      c.expectChip.test(card?.chip || "") && signal.recover === c.expectRecover,
      c.name,
      JSON.stringify({ card, signal }),
      `Seed sessions → ${c.name}`
    );
    if (c.expectRecover) {
      const targetReps = +(await page.inputValue(`[data-k="${recoverEx.id}_1_reps"]`));
      assert(
        targetReps === mid,
        "Hold · recover keeps the previous rep target instead of auto-incrementing",
        `target=${targetReps} expected=${mid}`,
        "Flat grinding sessions → Hold · recover → next target stays at prior reps"
      );
    }
  }


  beginPhase("Phase: F1 history-derived recommendation rounding");
  {
    const MIXED = [52.5, 55];
    const RAW_MED = (MIXED[0] + MIXED[1]) / 2; // 53.75 — off the 2.5 kg grid
    const GRID = 2.5;
    const onGrid = (kg) => Number.isFinite(kg) && Math.abs(kg / GRID - Math.round(kg / GRID)) < 1e-9;
    const mixedRows = (ex, date, reps, rir, tag) => {
      const session = `${date}_${ex.day}_f1_${ex.id}_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return MIXED.map((load, i) => ({
        session, date, day: ex.day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps, rir, notes: "", created, primary: ex.primary, secondary: ex.secondary,
      }));
    };
    const f1Cases = [
      {
        key: "stalled",
        status: "reduce",
        stalled: true,
        label: /stalled/i,
        dates: ["2025-05-01", "2025-05-08", "2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 7, 1, `stall_${i}`),
      },
      {
        key: "recover",
        status: "hold",
        stalled: false,
        label: /recover/i,
        dates: ["2025-05-01", "2025-05-08"],
        session: (ex, date, i) => mixedRows(ex, date, 7, i === 1 ? 0 : 1, `rec_${i}`),
      },
      {
        key: "push_reps",
        status: "hold",
        stalled: false,
        label: /push reps/i,
        dates: ["2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 6, 2, `push_${i}`),
      },
      {
        key: "hold",
        status: "hold",
        stalled: false,
        label: /hold\s*·\s*add reps/i,
        dates: ["2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 7, 1, `hold_${i}`),
      },
    ];

    await clearState(page);
    await reloadApp(page);
    const f1State = await getState(page);
    const day1Exs = f1State.program
      .filter((e) => e.day === "Day 1")
      .sort((a, b) => a.order - b.order);
    assert(day1Exs.length >= 4, "F1: Day 1 has four exercises for the raw-load branches", `count=${day1Exs.length}`, "Default program → Day 1");
    const patchedIds = new Set();
    const f1Log = [];
    f1Cases.forEach((c, idx) => {
      const ex = { ...day1Exs[idx], sets: 2, min: 6, max: 8 };
      patchedIds.add(ex.id);
      c.ex = ex;
      c.dates.forEach((date, i) => f1Log.push(...c.session(ex, date, i)));
    });
    await persistState(page, {
      ...f1State,
      settings: { ...f1State.settings, minJump: 2.5, unit: "kg", lang: "en", rirMode: "numeric" },
      program: f1State.program.map((e) => (patchedIds.has(e.id) ? { ...e, sets: 2, min: 6, max: 8 } : e)),
      log: f1Log,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);

    for (const c of f1Cases) {
      const rec = await page.evaluate((id) => {
        const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
        const ex = (raw.program || []).find((e) => e.id === id);
        const r = window.__repforgeRecommendation?.(ex);
        return r && { status: r.status, load: r.load, stalled: !!r.stalled, label: r.label };
      }, c.ex.id);
      assert(
        rec?.status === c.status && rec?.stalled === c.stalled && c.label.test(rec?.label || ""),
        `F1: ${c.key} branch fires on mixed previous-set loads`,
        JSON.stringify(rec),
        `Seed even-set 52.5/55 history → recommendation() ${c.key}`
      );
      assert(
        rec?.load === 55 && onGrid(rec.load) && RAW_MED === 53.75 && !onGrid(RAW_MED),
        `F1: ${c.key} load snaps to the 2.5 kg grid`,
        `load=${rec?.load} rawMedian=${RAW_MED}`,
        `${c.key} mixed loads 52.5+55 → round(median) = 55, not 53.75`
      );

      await nav(page, "log");
      await selectDay(page, "Day 1");
      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      const cardHead = await page.locator(`.exercise[data-ex="${c.ex.id}"] .recblock__head`).textContent();
      assert(
        /55/.test(cardHead || "") && !/53\.75/.test(cardHead || ""),
        `F1: ${c.key} kg card shows the grid load`,
        `head="${cardHead}"`,
        `Log list → ${c.key} recblock headline`
      );

      await page.click(`.exercise[data-ex="${c.ex.id}"] [data-exopen="${c.ex.id}"]`);
      await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
      const pageHead = await page.locator("#exDetail .recblock__head").textContent();
      assert(
        /55/.test(pageHead || "") && !/53\.75/.test(pageHead || ""),
        `F1: ${c.key} exercise-page headline shows the grid load`,
        `head="${pageHead}"`,
        `Tap exercise name → #exDetail recblock headline`
      );
      await page.click("#exBack");
      await page.waitForSelector("#log.view.active", { timeout: 5000 });

      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      await page.evaluate(({ id, day }) => {
        window.__repforgeEnterWorkout?.({ focus: true, day });
        const fl = window.__repforgeFocus?.list?.() || [];
        const i = fl.findIndex((e) => e.id === id);
        if (i >= 0) window.__repforgeFocus.to(i);
      }, { id: c.ex.id, day: "Day 1" });
      await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
      const cue = await page.locator(".exercise.is-current .focus-cue__text").textContent();
      const cueLoad = await page.locator(".exercise.is-current .curset__val[data-k$='_load']").inputValue();
      assert(
        /55/.test(cue || "") && !/53\.75/.test(cue || "") && cueLoad === "55",
        `F1: ${c.key} untouched Focus first-set cue is on-grid`,
        `cue="${cue}" input=${cueLoad}`,
        `Focus → first set of ${c.key} lift`
      );
      await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    }

    const holdEx = f1Cases.find((c) => c.key === "hold").ex;
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.fill(`[data-k="${holdEx.id}_1_load"]`, "53.75");
    await page.fill(`[data-k="${holdEx.id}_1_reps"]`, "7");
    await page.fill(`[data-k="${holdEx.id}_1_rir"]`, "1");
    await page.click(`.saveset[data-save="${holdEx.id}_1"]`);
    await page.waitForTimeout(120);
    const echoed = +(await page.inputValue(`[data-k="${holdEx.id}_2_load"]`));
    assert(
      echoed === 53.75,
      "F1: in-session hold still echoes an off-grid committed load",
      `set2=${echoed}`,
      "Commit 53.75 kg on set 1 → set 2 suggestion stays 53.75 (not F3)"
    );

    const lbState = await getState(page);
    await persistState(page, { ...lbState, settings: { ...lbState.settings, unit: "lb" } });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    const lbLoad = await page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      return window.__repforgeRecommendation?.(ex)?.load;
    }, holdEx.id);
    assert(
      lbLoad === 55 && onGrid(lbLoad),
      "F1: lb mode keeps the internal kilogram grid (no F3 display snap)",
      `load=${lbLoad}`,
      "Switch unit to lb → recommendation().load remains 55 kg"
    );
  }

  await clearState(page);
  await reloadApp(page);

  // Settings auto-save on change (no Save click)
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#progressionDetails")?.classList.add("is-open"));
  await page.fill("#hardRir", "3");
  await page.locator("#hardRir").blur();
  await waitForSetting(page, "settings.hardRir", 3);
  assert(
    (await getState(page)).settings.hardRir === 3,
    "Settings auto-save on change",
    `hardRir=${(await getState(page)).settings.hardRir}`,
    "Settings → change Hard-set RIR ceiling → blur (no Save click)"
  );

  // Setup notes persist and show on the Log card
  await nav(page, "program");
  const note = "Seat 4, feet high";
  const noteInput = page.locator('.pex [data-field="notes"]').first();
  await noteInput.fill(note);
  await noteInput.blur();
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const info0 = await cardInfo(page, 0);
  assert(
    info0.setup.includes(note),
    "Setup notes show on Log card",
    `Setup text: "${info0.setup}"`,
    "Program → add setup notes → Log card shows them"
  );

  const day1 = await getExerciseMeta(page, "Day 1");
  const ex0 = day1[0].id;

  assert(
    (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-suggested"),
    "Untouched suggestion row is greyed",
    "Set row not marked is-suggested before edit",
    "Log → open exercise → set rows show as suggestions until touched"
  );

  await page.fill(`[data-k="${ex0}_1_load"]`, "100");
  await page.click(`.saveset[data-save="${ex0}_1"]`);
  await page.waitForTimeout(80);
  assert(
    (await page.getAttribute(`.setrow[data-set="${ex0}_1"]`, "class")).includes("is-done"),
    "Save set marks the set done",
    "Row not is-done after Save set",
    "Log → enter weight → Save set → row shows done"
  );

  const setGrid = await page.evaluate((exId) => {
    const cols = (el) => [...el.children].map((c) => Math.round(c.getBoundingClientRect().x * 10) / 10);
    const done = document.querySelector(`.setrow[data-set="${exId}_1"]`);
    const next = document.querySelector(`.setrow[data-set="${exId}_2"]`);
    return {
      done: cols(done),
      next: next ? cols(next) : null,
      head: cols(done.closest(".exercise").querySelector(".sets__head")),
      saveWidths: [done, next]
        .filter(Boolean)
        .map((r) => Math.round(r.querySelector(".saveset").getBoundingClientRect().width)),
    };
  }, ex0);
  const colDrift = (a, b) => Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  assert(
    setGrid.next && colDrift(setGrid.done, setGrid.next) < 0.5 && setGrid.saveWidths[0] === setGrid.saveWidths[1],
    "Saved set row keeps the same columns as the rows below it",
    `done=[${setGrid.done}] next=[${setGrid.next}] saveWidths=[${setGrid.saveWidths}]`,
    "Log → Save set → the ✓ stays as wide as the Save label, so the row's fields stay put"
  );
  assert(
    colDrift(setGrid.head, setGrid.done) < 2,
    "Set table header lines up with the set rows",
    `head=[${setGrid.head}] row=[${setGrid.done}]`,
    "Log → the SET / KG / REPS / RIR labels sit over their own columns"
  );

  assert(
    (await page.getAttribute('#dayTabs button[data-day="Day 1"]', "aria-selected")) === "true",
    "Active day tab exposes aria-selected",
    "Active day tab missing aria-selected=true",
    "Log → select a day → its tab is aria-selected"
  );

  await saveWorkout(page);
  const stAfterFinish = await getState(page);
  const loggedEx0 = stAfterFinish.log.filter((r) => r.exerciseId === ex0);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForTimeout(80);
  const thisWeekPlural = await page.locator("#thisWeek").innerText();
  assert(
    /1 hard set(?!s)/.test(thisWeekPlural),
    "This Week card uses singular hard set for one hard set",
    `text=${thisWeekPlural.slice(0, 120)}`,
    "Clear state → save one hard set → Stats Overview → #thisWeek reads '1 hard set'"
  );
  await nav(page, "history");
  const newLiftDelta = await page.locator(".session__delta").first().textContent();
  assert(
    /1 new lift/.test(newLiftDelta || ""),
    "History session delta names new lifts",
    `delta=${newLiftDelta}`,
    "Clear state → save first lift → History → session card shows '1 new lift'"
  );
  await nav(page, "log");
  assert(
    loggedEx0.length === 1 && +loggedEx0[0].set === 1,
    "Finish logs only committed/edited sets, not pristine suggestions",
    `logged sets for ex0: ${loggedEx0.map((r) => r.set).join(",")}`,
    "Log → Save one set, leave others suggested → Finish logs only the saved set"
  );

  // Stepper-edited suggested load is touched and persists on Finish
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const stepKey = `${ex0}_2`;
  assert(
    (await page.getAttribute(`.setrow[data-set="${stepKey}"]`, "class")).includes("is-suggested"),
    "Second set starts as suggested before stepper",
    "Set row not is-suggested before stepper edit",
    "Log → untouched set row → is-suggested"
  );
  await page.click(`.stepbtn[data-step="${ex0}_2_load"][data-dir="1"]`);
  await page.waitForTimeout(60);
  assert(
    !(await page.getAttribute(`.setrow[data-set="${stepKey}"]`, "class")).includes("is-suggested"),
    "Stepper click un-greys the set row",
    "Row still is-suggested after stepper",
    "Log → tap kg + stepper → row leaves suggested state"
  );
  await saveWorkout(page);
  const stAfterStepper = await getState(page);
  const stepperLogged = stAfterStepper.log.filter((r) => r.exerciseId === ex0 && +r.set === 2);
  assert(
    stepperLogged.length === 1 && +stepperLogged[0].load > 0,
    "Stepper-edited set is saved on Finish",
    `set 2 rows: ${stepperLogged.map((r) => r.load).join(",")}`,
    "Log → stepper-edit one suggested set → Finish → set is logged"
  );

  const exX = day1[0].id, exY = day1[1].id;

  // Session 1 for X
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);

  // Prefill: hold auto-increments the rep target (last reps + 1); RIR follows last session
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue(`[data-k="${exX}_1_reps"]`)) === "7" &&
      (await page.inputValue(`[data-k="${exX}_1_rir"]`)) === "1",
    "Log auto-increments the hold rep target (last reps + 1) and prefills RIR from last session",
    `reps=${await page.inputValue(`[data-k="${exX}_1_reps"]`)} rir=${await page.inputValue(`[data-k="${exX}_1_rir"]`)}`,
    "Log → save 6 reps at a held load → reopen → reps target 7 (chase a rep), RIR matches last session"
  );

  // kg stepper adds the minimum jump (2.5)
  await page.click(`.stepbtn[data-step="${exX}_1_load"][data-dir="1"]`);
  assert(
    (await page.inputValue(`[data-k="${exX}_1_load"]`)) === "102.5",
    "kg stepper increments by minimum jump",
    `value=${await page.inputValue(`[data-k="${exX}_1_load"]`)}`,
    "Log → click + on kg → increases by 2.5"
  );

  // Copy last refills from previous session
  await page.click(`.copylast[data-copy="${exX}"]`);
  assert(
    (await page.inputValue(`[data-k="${exX}_1_load"]`)) === "100",
    "Copy last refills from previous session",
    `load=${await page.inputValue(`[data-k="${exX}_1_load"]`)}`,
    "Log → Copy → inputs match last session"
  );

  // Collapse toggle
  await page.click(`.ex__caret[data-collapse="${exX}"]`);
  await page.waitForTimeout(80);
  assert(
    (await cardInfo(page, 0)).collapsed,
    "Exercise collapses on caret click",
    "Card not collapsed after caret click",
    "Log → tap caret → card collapses"
  );
  await page.click(`.ex__caret[data-collapse="${exX}"]`);

  // Sessions 2 and 3 for X (same load, same reps → stall)
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exX, day1[0].sets, 100, 6, 1);
  await saveWorkout(page);

  // Y: reps below min → back off with a lower target
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exY, day1[1].sets, 80, 2, 1);
  await saveWorkout(page);

  // Inspect recommendations
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const xInfo = await cardInfo(page, 0);
  assert(
    xInfo.status === "is-reduce" && /stall/i.test(xInfo.chip),
    "Stall detection flags deload after 3 flat sessions",
    `status=${xInfo.status} chip="${xInfo.chip}"`,
    "Log → 3 sessions same load, no rep gain → Stalled · deload"
  );
  const yInfo = await cardInfo(page, 1);
  const yTarget = +(yInfo.rec.match(/(?:Hold|Target)\s+([\d.]+)\s*kg/)?.[1] || 0);
  assert(
    yInfo.status === "is-reduce" && yTarget > 0 && yTarget < 80,
    "Back off returns a real lighter target",
    `status=${yInfo.status} target=${yTarget}`,
    "Log → sets below min reps → Back off with target < logged load"
  );

  // Fatigue banner (2 lifts backing off on this day)
  const fatigue = await page.evaluate(() => {
    const el = document.querySelector("#fatigue");
    return { hidden: el.classList.contains("hidden"), text: el.textContent };
  });
  assert(
    !fatigue.hidden && /fatigue/i.test(fatigue.text),
    "Fatigue-watch banner appears when lifts back off",
    `hidden=${fatigue.hidden} text="${fatigue.text}"`,
    "Log → multiple lifts reduce/stall → fatigue banner"
  );

  // Fatigue trim keeps only add-load priority lifts visible
  await page.click("#fatigue .fatigue__trim");
  const hiddenAfterTrim = await page.locator("#workout .exercise.is-skipped").count();
  assert(
    hiddenAfterTrim >= 2,
    "Fatigue trim hides backing-off lifts",
    `hidden count=${hiddenAfterTrim}`,
    "Log → Fatigue watch → Trim to essentials"
  );
  assert(
    (await page.locator(".skipbar").count()) > 0,
    "Skip bar reports hidden exercise count",
    "No skipbar after trim",
    "After trim → skip bar shows N hidden today"
  );
  await page.click(".skipbar__show");
  assert(
    (await page.locator("#workout .exercise.is-skipped").count()) === 0,
    "Show all restores trimmed exercises",
    "Exercises still skipped after Show all",
    "Skip bar → Show all → exercises visible again"
  );

  // Heat gauge reflects add-load readiness on a separate lift
  const exHot = day1[2];
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillExerciseSets(page, exHot.id, exHot.sets, 90, exHot.max, 1);
  await saveWorkout(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const hotCard = await cardInfoById(page, exHot.id);
  assert(
    hotCard?.status === "is-add" || hotCard?.status === "is-add2",
    "Max-rep history surfaces add-load on next visit",
    JSON.stringify(hotCard),
    "Log max-rep session → reopen → is-add/is-add2"
  );
  // Leave workout to see Today readiness line, then re-enter via it
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  const readyText = await page.locator("#readyLine, .today-ready").first().textContent();
  assert(
    /ready|prontos|hot|increase|aumentar/i.test(readyText || ""),
    "Today readiness line shows lifts ready to increase",
    `label="${readyText}"`,
    "Log → after add-load recs → Today shows N ready"
  );
  await page.locator("#readyLine, .today-ready").first().click();
  await page.waitForSelector("#workoutShell:not(.hidden), #workout .exercise", { timeout: 5000 });
  assert(
    await page.evaluate(
      (id) => {
        const el = document.querySelector(`.exercise[data-ex="${id}"]`);
        return !!el && !el.classList.contains("is-collapsed");
      },
      exHot.id
    ),
    "Readiness line opens workout and expands a hot lift card",
    "Card still collapsed after readiness click",
    "Tap Today readiness → first hot exercise expands"
  );

  // Session notes persist on saved rows (notes field is Focus-chrome-hidden; set via DOM)
  await page.evaluate(() => {
    const el = document.querySelector("#notes");
    if (!el) throw new Error("#notes missing");
    el.value = "Simulation session note";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await fillExerciseSets(page, exHot.id, 1, 92, 6, 1);
  await saveWorkout(page);
  assert(
    (await getState(page)).log.some((r) => r.notes === "Simulation session note"),
    "Session notes persist on saved rows",
    "No row with session note",
    "Log → fill notes → Save workout"
  );

  // Stats: completed hard sets + attention board
  await nav(page, "stats");
  await page.evaluate(() => {
    const d = document.querySelector("#statsDeep");
    if (d) d.open = true;
  });
  await page.waitForTimeout(150);
  assert(
    (await page.locator("#completedVolume .vrow").count()) > 0,
    "Completed hard sets render per muscle",
    "No completed-volume rows",
    "Stats → Completed hard sets shows logged volume"
  );
  assert(
    (await page.locator("#attention .attn--reduce .attn__chip").count()) > 0,
    "Attention board lists lifts to back off",
    "No reduce chips in attention board",
    "Stats → action board shows Back off / stalled group"
  );
  assert(
    (await page.locator("#attention .attn__why").count()) > 0,
    "Attention board groups include why lines",
    "No .attn__why in attention board",
    "Stats → action board → each group has a why line"
  );
  const attnChip = page.locator("#attention .attn--reduce .attn__chip").first();
  const attnLift = await attnChip.getAttribute("data-attn");
  await attnChip.click();
  assert(
    (await page.inputValue("#statExercise")) &&
      (await page.locator("#statsDeep").evaluate((el) => el.open)),
    "Reduce attention chip focuses exercise and opens stats deep section",
    `statExercise=${await page.inputValue("#statExercise")}`,
    "Stats → click reduce attention chip → chart exercise selected"
  );
  await page.click('#volWindow button[data-win="28"]');
  assert(
    (await page.locator('#volWindow button[data-win="28"]').getAttribute("class")).includes("active"),
    "Volume window toggle selects 28-day range",
    "28d button not active",
    "Stats → Completed hard sets → 28d window"
  );

  // Edit a logged session in History
  await nav(page, "history");
  await page.locator("#sessions .hist-row.session, #sessions .session").first().click();
  const editBtn = page.locator("[data-edit], .session__edit").first();
  await editBtn.waitFor({ state: "visible", timeout: 5000 });
  await editBtn.click();
  await page.waitForTimeout(100);
  const editInput = page.locator('.session--edit [data-ek^="load|"]').first();
  await editInput.fill("123");
  await page.locator("[data-edsave]").first().click();
  await page.waitForTimeout(150);
  assert(
    (await getState(page)).log.some((r) => +r.load === 123),
    "Edit session writes changes back to the log",
    "No log row with edited load 123",
    "History → Edit → change a load → Save changes"
  );

  // Rest timer starts and is visible
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.click("#workout .ex__rest");
  await page.waitForTimeout(120);
  assert(
    !(await page.locator("#restBar").getAttribute("class")).includes("hidden"),
    "Rest timer shows on demand",
    "restBar still hidden after tapping ⏱",
    "Log → tap ⏱ on an exercise → rest timer appears"
  );
  await page.click("#restBar");

  // Glossary explains RIR on tap
  await page.click("#workout .term[data-term='RIR']");
  await page.waitForTimeout(80);
  assert(
    !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
      /reserve/i.test(await page.locator("#glossary .glossary__body").textContent()),
    "Glossary explains RIR on tap",
    "Glossary popover did not open with RIR definition",
    "Log → tap 'RIR' → definition popover opens"
  );
  await page.click("#glossary .glossary__close");

  // Skipped exercise is not saved
  const metaSkip = await getExerciseMeta(page, "Day 1");
  const skipId = metaSkip[0].id;
  await page.fill(`[data-k="${skipId}_1_load"]`, "50");
  await page.click(`.ex__skip[data-skip="${skipId}"]`);
  await page.waitForTimeout(80);
  const skipSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  const stSkip = await getState(page);
  const newSessions = [...new Set(stSkip.log.map((r) => r.session))].filter((s) => !skipSessionsBefore.has(s));
  const skipSavedInNewSession = newSessions.some((sid) =>
    stSkip.log.some((r) => r.session === sid && r.exerciseId === skipId)
  );
  assert(
    !skipSavedInNewSession,
    "Skipped exercise is not saved",
    "A skipped exercise's set was persisted in a new session",
    "Log → fill a set → Skip it → Save → that exercise has no new rows"
  );

  beginPhase("Phase: exercise substitution");
  await nav(page, "program");
  let subState = await getState(page);
  const d1First = subState.program.filter((e) => e.name.includes("Hack squat") || e.name.includes("pendulum")).sort((a, b) => a.order - b.order)[0];
  await page.fill(`[data-id="${d1First.id}"][data-field="alternates"]`, "Leg press, Pendulum squat");
  await page.waitForTimeout(100);
  await nav(page, "log");
  const subDay = d1First.day;
  await selectDay(page, subDay);
  await page.evaluate((id) => {
    const art = document.querySelector(`.exercise[data-ex="${id}"]`);
    if (art?.classList.contains("is-skipped")) document.querySelector(`.ex__skip[data-skip="${id}"]`)?.click();
    if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
  }, d1First.id);
  await page.waitForTimeout(80);
  await page.evaluate(({ id, val }) => {
    const sel = document.querySelector(`.subst__pick[data-sub="${id}"]`);
    if (!sel) return;
    sel.value = val;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, { id: d1First.id, val: "Leg press" });
  await page.waitForTimeout(80);
  await page.evaluate(({ id, load, reps, rir }) => {
    const set = (k, v) => {
      const el = document.querySelector(`[data-k="${id}_1_${k}"]`);
      if (el) {
        el.value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    set("load", load);
    set("reps", reps);
    set("rir", rir);
  }, { id: d1First.id, load: 120, reps: 6, rir: 1 });
  const subSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  subState = await getState(page);
  const subSession = [...new Set(subState.log.map((r) => r.session))].find((s) => !subSessionsBefore.has(s));
  const subRow = subState.log.find((r) => r.session === subSession && r.exerciseId === d1First.id);
  assert(
    subRow && subRow.performedName === "Leg press",
    "Substituted session saves performedName",
    JSON.stringify(subRow),
    "Program alternates → Log pick Leg press → save"
  );
  assert(
    subRow && subRow.name === d1First.name,
    "Substituted row keeps program slot name",
    `name=${subRow?.name} slot=${d1First.name}`,
    "Save with substitute → row.name is still the program exercise"
  );
  await nav(page, "history");
  const histText = await page.textContent("#historyTable");
  assert(
    histText.includes("Leg press"),
    "History table shows performed substitute name",
    histText.slice(0, 200),
    "History → Every set table after substitute save"
  );
  await nav(page, "stats");
  await page.evaluate(() => document.querySelector("#statsDeep")?.setAttribute("open", ""));
  await page.selectOption("#statExercise", d1First.id);
  await page.waitForTimeout(80);
  const chartRows = await page.evaluate(() => {
    const sel = document.querySelector("#statExercise").value;
    const log = JSON.parse(localStorage.getItem("repforge_v1")).log.filter((r) => !r.warmup);
    const keys = new Set(log.map((r) => r.exerciseId || r.name));
    return keys.has(sel);
  });
  assert(
    chartRows,
    "Stats chart aggregates substituted sessions under exerciseId",
    `exerciseId=${d1First.id}`,
    "Stats → select substituted lift → chart has data"
  );

  // Unit toggle: draft loads convert on unit change; persisted log stays kg
  await clearState(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const unitMeta = await getExerciseMeta(page, "Day 1");
  const unitEx = unitMeta[0].id;
  await page.fill(`[data-k="${unitEx}_1_load"]`, "100");
  await page.fill(`[data-k="${unitEx}_1_reps"]`, "6");
  await page.fill(`[data-k="${unitEx}_1_rir"]`, "1");
  await page.waitForTimeout(80);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const lbDraft = +(await page.inputValue(`[data-k="${unitEx}_1_load"]`));
  assert(
    Math.abs(lbDraft - 220.46226218) < 0.15,
    "Draft load converts kg to lb on unit switch",
    `draft load=${lbDraft}`,
    "Log → enter 100 kg → Settings unit=lb → draft shows ~220.46 lb"
  );
  await saveWorkout(page);
  const kgFromLbDraft = (await getState(page)).log.find((r) => r.exerciseId === unitEx && +r.set === 1);
  assert(
    kgFromLbDraft && Math.abs(kgFromLbDraft.load - 100) < 0.1,
    "Draft saved after kg→lb switch stores canonical kg",
    `stored load=${kgFromLbDraft?.load}`,
    "Log → 100 kg draft → switch lb → save → log row is ~100 kg"
  );

  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${unitEx}_1_load"]`, "100");
  await page.waitForTimeout(60);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue(`[data-k="${unitEx}_1_load"]`)) === "100",
    "Draft load round-trips kg→lb→kg",
    `draft load=${await page.inputValue(`[data-k="${unitEx}_1_load"]`)}`,
    "Log → 100 kg draft → switch lb → switch kg → draft shows 100 again"
  );

  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${unitEx}_1_load"]`, "225");
  await page.fill(`[data-k="${unitEx}_1_reps"]`, "5");
  await page.fill(`[data-k="${unitEx}_1_rir"]`, "2");
  await saveWorkout(page);
  const lbEntry = (await getState(page)).log.filter((r) => r.exerciseId === unitEx).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  assert(
    lbEntry && Math.abs(lbEntry.load - 102.058283) < 0.1,
    "Direct lb entry stores canonical kg",
    `stored load=${lbEntry?.load}`,
    "Log → unit=lb → enter 225 lb → save → log row is ~102.06 kg"
  );

  assert(
    (await getState(page)).log.every((r) => r.load < 1000),
    "Stored loads remain kg after unit switch",
    "A stored load looks converted to lb",
    "Settings → unit=lb → repforge_v1 loads still kg"
  );
  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);

  await nav(page, "settings");
  await page.selectOption("#unit", "kg");
  await page.waitForTimeout(80);

  beginPhase("Phase: effort RIR mode");
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#rirModePanel")?.classList.add("is-open"));
  await page.waitForSelector("#rirModePanel.is-open", { timeout: 3000 });
  await page.check('input[name="rirMode"][value="effort"]');
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const effMeta = await getExerciseMeta(page, "Day 1");
  const effEx = effMeta[0];
  assert(
    (await page.locator('#workout .term[data-term="Effort"]').count()) > 0,
    "Effort mode Log header has Effort glossary term",
    "No #workout .term[data-term=\"Effort\"]",
    "Settings effort mode → Log → Effort column header is a term"
  );
  await page.click('#workout .term[data-term="Effort"]');
  await page.waitForTimeout(80);
  const effortGlossaryBody = await page.locator("#glossary .glossary__body").textContent();
  assert(
    !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
      /RIR 0|≈ 0|reps in reserve/i.test(effortGlossaryBody || ""),
    "Effort glossary popover shows RIR mapping",
    `glossary body: ${effortGlossaryBody?.slice(0, 80)}`,
    "Log → tap Effort header → glossary popover shows mapping"
  );
  await page.click("#glossary .glossary__close");
  await page.fill(`[data-k="${effEx.id}_1_load"]`, "90");
  await page.fill(`[data-k="${effEx.id}_1_reps"]`, "6");
  await page.click(`.effort__btn[data-eff="${effEx.id}_1"][data-e="easy"]`);
  let effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  let effortState = await getState(page);
  let effortSession = [...new Set(effortState.log.map((r) => r.session))].find((s) => !effortSessionsBefore.has(s));
  let effortRow = effortState.log.find((r) => r.session === effortSession && r.exerciseId === effEx.id && +r.set === 1);
  assert(
    effortRow && effortRow.rir === 3,
    "Effort mode Easy saves as RIR 3",
    `rir=${effortRow?.rir}`,
    "Settings effort mode → Log Easy → save"
  );

  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${effEx.id}_1_load"]`, "92");
  await page.fill(`[data-k="${effEx.id}_1_reps"]`, "5");
  await page.click(`.effort__btn[data-eff="${effEx.id}_1"][data-e="hard"]`);
  effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  effortState = await getState(page);
  effortSession = [...new Set(effortState.log.map((r) => r.session))].find((s) => !effortSessionsBefore.has(s));
  effortRow = effortState.log.find((r) => r.session === effortSession && r.exerciseId === effEx.id && +r.set === 1);
  assert(
    effortRow && effortRow.rir === 1,
    "Effort mode Hard saves as RIR 1",
    `rir=${effortRow?.rir}`,
    "Settings effort mode → Log Hard → save"
  );

  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill(`[data-k="${effEx.id}_1_load"]`, "95");
  await page.fill(`[data-k="${effEx.id}_1_reps"]`, "4");
  await page.click(`.effort__btn[data-eff="${effEx.id}_1"][data-e="max"]`);
  effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  effortState = await getState(page);
  effortSession = [...new Set(effortState.log.map((r) => r.session))].find((s) => !effortSessionsBefore.has(s));
  effortRow = effortState.log.find((r) => r.session === effortSession && r.exerciseId === effEx.id && +r.set === 1);
  assert(
    effortRow && effortRow.rir === 0,
    "Effort mode Max saves as RIR 0",
    `rir=${effortRow?.rir}`,
    "Settings effort mode → Log Max → save"
  );
  assert(
    effortState.settings.rirMode === "effort",
    "Settings persist rirMode effort",
    JSON.stringify(effortState.settings),
    "Toggle effort mode in Settings"
  );

  // ---- The picker itself: it has to fit, read as a single choice, and be
  // ---- reachable from the keyboard. Three words never fit a table column.
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const pickerUi = await page.evaluate((exId) => {
    const row = document.querySelector(`.setrow[data-set="${exId}_1"]`);
    const group = row?.querySelector(".effort");
    const btns = group ? [...group.querySelectorAll(".effort__btn")] : [];
    const rowBox = row?.getBoundingClientRect();
    return {
      hasGroup: !!group,
      role: group?.getAttribute("role"),
      groupClipped: group ? group.scrollWidth > group.clientWidth + 1 : null,
      wordsClipped: btns.some((b) => {
        const w = b.querySelector(".effort__word");
        return !w || w.scrollWidth > w.clientWidth + 1;
      }),
      insideRow: btns.every((b) => {
        const r = b.getBoundingClientRect();
        return r.left >= rowBox.left - 1 && r.right <= rowBox.right + 1 && r.height >= 44;
      }),
      checked: btns.filter((b) => b.getAttribute("aria-checked") === "true").map((b) => b.dataset.e),
      roles: btns.map((b) => b.getAttribute("role")),
      suggestedUntouched: !!document
        .querySelector(`.setrow[data-set="${exId}_2"] .effort`)
        ?.classList.contains("effort--suggested"),
    };
  }, effEx.id);
  assert(
    pickerUi.hasGroup && pickerUi.groupClipped === false && !pickerUi.wordsClipped && pickerUi.insideRow,
    "Effort picker fits its set row with all three words readable",
    JSON.stringify(pickerUi),
    "Settings effort mode → Log (List) → set row picker is not clipped"
  );
  assert(
    pickerUi.role === "radiogroup" &&
      pickerUi.roles.every((r) => r === "radio") &&
      pickerUi.checked.length === 1,
    "Effort picker exposes one checked radio in a radiogroup",
    JSON.stringify(pickerUi),
    "Log (List) → inspect .effort roles / aria-checked"
  );
  assert(
    pickerUi.suggestedUntouched,
    "An untouched set's effort reads as a suggestion",
    JSON.stringify(pickerUi),
    "Log (List) → set 2 picker carries .effort--suggested until tapped"
  );
  await page.focus(`.setrow[data-set="${effEx.id}_1"] .effort__btn[aria-checked="true"]`);
  const beforeArrow = await page.evaluate(
    (exId) =>
      document.querySelector(`.setrow[data-set="${exId}_1"] .effort__btn[aria-checked="true"]`)?.dataset.e,
    effEx.id
  );
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(120);
  const afterArrow = await page.evaluate(
    ({ exId, d }) => {
      const btns = [
        ...document.querySelectorAll(`.setrow[data-set="${exId}_1"] .effort__btn`),
      ];
      const checked = btns.find((b) => b.getAttribute("aria-checked") === "true");
      return {
        checked: checked?.dataset.e,
        focused: document.activeElement === checked,
        draft: JSON.parse(localStorage.getItem(d) || "{}")[`${exId}_1_effort`],
        suggested: checked?.closest(".effort")?.classList.contains("effort--suggested"),
      };
    },
    { exId: effEx.id, d: DRAFT }
  );
  assert(
    afterArrow.checked && afterArrow.checked !== beforeArrow && afterArrow.focused &&
      afterArrow.draft === afterArrow.checked && afterArrow.suggested === false,
    "Arrow keys move the effort pick and write it to the draft",
    `before=${beforeArrow} after=${JSON.stringify(afterArrow)}`,
    "Log (List) → focus the checked effort button → ArrowRight"
  );
  // Copy carries the effort of the last session, not just its numbers.
  await page.click(`.copylast[data-copy="${effEx.id}"]`);
  await page.waitForTimeout(160);
  const copied = await page.evaluate(
    ({ exId, d }) => ({
      checked: document.querySelector(`.setrow[data-set="${exId}_1"] .effort__btn[aria-checked="true"]`)
        ?.dataset.e,
      draft: JSON.parse(localStorage.getItem(d) || "{}")[`${exId}_1_effort`],
    }),
    { exId: effEx.id, d: DRAFT }
  );
  assert(
    copied.checked === "max" && copied.draft === "max",
    "Copy last fills the effort picker from the last session",
    JSON.stringify(copied),
    "Log (List) → Copy after a Max session → picker shows Max"
  );

  // ---- Focus mode: effort takes the third column of the well as a spinner, and
  // ---- a logged set reads back as the word that was tapped.
  await clickLogMode(page, "focus");
  await page.waitForTimeout(200);
  const focusEffort = await page.evaluate(() => {
    const cell = document.querySelector(".focus-well .curset__cell.is-effort");
    const spin = cell?.querySelector("[data-effspin]");
    const steps = [...(cell?.querySelectorAll("[data-effstep]") || [])];
    return {
      hasCell: !!cell,
      role: spin?.getAttribute("role") || "",
      named: !!spin?.getAttribute("aria-label"),
      valueText: spin?.getAttribute("aria-valuetext") || "",
      hint: cell?.querySelector(".curset__hint")?.textContent?.trim() || "",
      steps: steps.length,
      tall: steps.every((b) => b.getBoundingClientRect().height >= 44),
      clipped: !!spin && spin.scrollWidth > spin.clientWidth + 1,
      radioLeak: !!cell?.querySelector(".effort__btn"),
      markupLeak: /<button|<span/.test(document.querySelector("#workout")?.textContent || ""),
    };
  });
  assert(
    focusEffort.hasCell && focusEffort.role === "spinbutton" && focusEffort.named &&
      focusEffort.valueText && focusEffort.hint && focusEffort.steps === 2 &&
      focusEffort.tall && !focusEffort.clipped && !focusEffort.radioLeak,
    "Focus mode logs effort with a labelled spinner and two 44px nudge buttons",
    JSON.stringify(focusEffort),
    "Settings effort mode → Log → Focus → the well's third column steps through the effort words"
  );
  const focusAlign = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".exercise.is-current .focus-well .curset__cell")];
    const band = (sel) => cells.map((c) => {
      const el = c.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    const lines = band(".curset__underline");
    const steps = band(".curset__steps");
    return {
      n: cells.length,
      labs: band(".curset__cell-lab"),
      vals: band(".curset__val"),
      lines,
      steps,
      // The steppers hang off the hairline; a caption may not wedge in between.
      gap: Math.max(...steps.map((s, i) => s - lines[i])),
    };
  });
  const alignSpread = (arr) => Math.max(...arr) - Math.min(...arr);
  assert(
    focusAlign.n === 3 &&
      alignSpread(focusAlign.labs) <= 1 &&
      alignSpread(focusAlign.vals) <= 1 &&
      alignSpread(focusAlign.lines) <= 1 &&
      alignSpread(focusAlign.steps) <= 1 &&
      focusAlign.gap <= 6,
    "Focus effort column lines up with load and reps",
    JSON.stringify(focusAlign),
    "Log → Focus in effort mode → the three well cells share one baseline"
  );
  assert(
    !focusEffort.markupLeak,
    "Focus mode renders the Effort heading as an element, not escaped markup",
    JSON.stringify(focusEffort),
    "Log → Focus in effort mode → card text contains no literal <button>"
  );
  // Before the first set lands the ledger reads from the top: last session is
  // what the lifter is aiming at, and it must not open half-scrolled.
  const restingScroll = await page.evaluate(() => {
    const ledger = document.querySelector(".exercise.is-current .fcard__ledger");
    const first = ledger?.querySelector(".ledger__top");
    return {
      scrollTop: Math.round(ledger?.scrollTop ?? -1),
      firstFullyVisible: first
        ? first.getBoundingClientRect().top >= ledger.getBoundingClientRect().top - 1
        : null,
    };
  });
  assert(
    restingScroll.scrollTop === 0 && restingScroll.firstFullyVisible === true,
    "Focus mode opens the ledger at the top before the first set",
    JSON.stringify(restingScroll),
    "Log → Focus in effort mode → last session is not scrolled half out of view"
  );
  await page.fill(`.focus-well [data-k="${effEx.id}_1_load"]`, "97");
  await page.fill(`.focus-well [data-k="${effEx.id}_1_reps"]`, "5");
  // The spinner walks the three words in order, and each step is announced.
  const STEPS = ["easy", "hard", "max"];
  const effAt = () => page.evaluate((k) => {
    const el = document.querySelector(`[data-effspin="${k}"]`);
    return { e: el?.dataset.e, now: el?.getAttribute("aria-valuenow"), text: el?.getAttribute("aria-valuetext") };
  }, `${effEx.id}_1`);
  const effStart = await effAt();
  await page.click(`.focus-well [data-effstep="${effEx.id}_1"][data-dir="-1"]`);
  await page.waitForTimeout(80);
  const effDown = await effAt();
  await page.click(`.focus-well [data-effstep="${effEx.id}_1"][data-dir="1"]`);
  await page.waitForTimeout(80);
  const effUp = await effAt();
  assert(
    effDown.e === STEPS[Math.max(0, STEPS.indexOf(effStart.e) - 1)] &&
      effUp.e === effStart.e &&
      effUp.now === String(STEPS.indexOf(effUp.e) + 1) && !!effUp.text,
    "The effort spinner steps down and back up through the effort words",
    JSON.stringify({ effStart, effDown, effUp }),
    "Focus → effort column → − then + → one step back, one step forward"
  );
  // Land on Hard, whatever the card was showing, so the saved RIR is checkable.
  while ((await effAt()).e !== "hard") {
    const dir = STEPS.indexOf((await effAt()).e) > STEPS.indexOf("hard") ? -1 : 1;
    await page.click(`.focus-well [data-effstep="${effEx.id}_1"][data-dir="${dir}"]`);
    await page.waitForTimeout(80);
  }
  await page.click(".focus-well .saveset");
  await page.waitForTimeout(300);
  const loggedRow = await page.evaluate(() => {
    const row = document.querySelector(".ledger__row[data-editn]");
    return {
      cells: row ? [...row.querySelectorAll("span")].map((s) => s.textContent.trim()) : [],
      head: [...document.querySelectorAll("#workout .exercise.is-current .ledger__head > span")].map((s) => s.textContent.trim()),
    };
  });
  assert(
    /effort|esforço/i.test(loggedRow.head[3] || "") && /^(easy|hard|max|fácil|difícil|máx)$/i.test(loggedRow.cells[3] || ""),
    "A logged set reads back as its effort word in Focus mode",
    JSON.stringify(loggedRow),
    "Log → Focus → step to Hard → Registrar série → logged row shows Hard"
  );
  // Once a set is logged the ledger does have an end worth showing.
  const parkedRow = await page.evaluate(() => {
    const ledger = document.querySelector(".exercise.is-current .fcard__ledger");
    const rows = ledger?.querySelectorAll(".ledger__row[data-editn]") || [];
    const last = rows[rows.length - 1];
    return last
      ? { fullyVisible: last.getBoundingClientRect().bottom <= ledger.getBoundingClientRect().bottom + 1 }
      : { fullyVisible: null };
  });
  assert(
    parkedRow.fullyVisible === true,
    "The set just logged stays fully in view in the Focus ledger",
    JSON.stringify(parkedRow),
    "Log → Focus → Registrar série → the logged row is not cut off by the ledger"
  );
  effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  effortState = await getState(page);
  effortSession = [...new Set(effortState.log.map((r) => r.session))].find((s) => !effortSessionsBefore.has(s));
  effortRow = effortState.log.find((r) => r.session === effortSession && r.exerciseId === effEx.id && +r.set === 1);
  assert(
    effortRow && effortRow.rir === 1 && effortRow.reps === 5,
    "Focus-mode effort pick saves through the RIR mapping",
    `row=${JSON.stringify(effortRow)}`,
    "Log → Focus → Hard → Registrar série → Save workout → stored rir is 1"
  );
  await clickLogMode(page, "full");
  await page.waitForTimeout(150);

  // Spoken / typed effort works in either language, and only on whole words.
  const parsedMax = await page.evaluate(() => window.__repforgeParseCommand("80 x 8 Max."));
  const parsedMaximum = await page.evaluate(() => window.__repforgeParseCommand("80 x 8 maximum"));
  assert(
    parsedMax.effort === "max" && parsedMaximum.effort == null,
    "Command parser reads a whole effort word only",
    `max=${parsedMax.effort} maximum=${parsedMaximum.effort}`,
    '__repforgeParseCommand("80 x 8 Max.") vs ("80 x 8 maximum")'
  );
  const beforeEffortPt = await getState(page);
  await persistState(page, { ...beforeEffortPt, settings: { ...beforeEffortPt.settings, lang: "pt" } });
  await reloadApp(page);
  const parsedPt = await page.evaluate(() => window.__repforgeParseCommand("80 x 8 difícil"));
  assert(
    parsedPt.effort === "hard",
    "Command parser reads the Portuguese effort word",
    JSON.stringify(parsedPt),
    'Portuguese UI → __repforgeParseCommand("80 x 8 difícil")'
  );
  const afterEffortPt = await getState(page);
  await persistState(page, { ...afterEffortPt, settings: { ...afterEffortPt.settings, lang: "en" } });
  await reloadApp(page);

  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#rirModePanel")?.classList.add("is-open"));
  await page.waitForSelector("#rirModePanel.is-open", { timeout: 3000 });
  assert(
    /RIR 3/i.test((await page.locator("#settings").textContent()) || ""),
    "Settings shows effort scale legend with RIR 3",
    "Settings text missing RIR 3 legend",
    "Settings → RIR logging → legend line under radio group"
  );
  await page.check('input[name="rirMode"][value="numeric"]');
  await page.waitForTimeout(80);

  beginPhase("Phase: beginner program");
  const logBeforeBeginner = (await getState(page)).log.length;
  await page.click("#beginnerProgram");
  await page.waitForTimeout(200);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const begName = await page.locator("#workout .exercise .ex__name").first().textContent();
  assert(
    /Leg press/i.test(begName) && !/Hack squat/i.test(begName),
    "Beginner program shows plain exercise names",
    `name="${begName}"`,
    "Settings → Use beginner-friendly program → Log Day 1"
  );
  const begSetup = await cardInfo(page, 0);
  assert(
    begSetup.setup.length > 10,
    "Beginner program setup hint visible on Log",
    `setup="${begSetup.setup}"`,
    "Log Day 1 after beginner switch"
  );
  assert(
    (await getState(page)).log.length === logBeforeBeginner,
    "Beginner program switch preserves log",
    `log length changed ${logBeforeBeginner} → ${(await getState(page)).log.length}`,
    "Switch beginner program with existing history"
  );

  // Bodyweight persists on save and prefills on reopen
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.fill("#bodyweight", "80");
  const bwMeta = await getExerciseMeta(page, "Day 1");
  await fillExerciseSets(page, bwMeta[0].id, bwMeta[0].sets, 100, 6, 1);
  await saveWorkout(page);
  const stBw = await getState(page);
  assert(
    stBw.log.some((r) => +r.bodyweight === 80),
    "Bodyweight persists on saved rows",
    "No saved row carries bodyweight 80",
    "Log → set bodyweight → Save → rows carry bodyweight"
  );
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue("#bodyweight")) === "80",
    "Bodyweight prefills from last session",
    `bodyweight input = ${await page.inputValue("#bodyweight")}`,
    "Log → reopen → bodyweight prefilled"
  );

  // Focus mode shows one exercise; Finish saves like list mode
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await clickLogMode(page, "focus");
  await page.waitForTimeout(80);
  // Only the deck's card shows; the List markup that carries the other
  // exercises' fields is display:none, and the peeks are parked out of sight.
  const visible = await page.locator("#workout > .exercise").evaluateAll((els) =>
    els.every((e) => getComputedStyle(e).display === "none")
  );
  assert(
    visible,
    "Focus mode shows one exercise at a time",
    "Non-current exercises visible in focus mode",
    "Log → Focus → only current card shown"
  );
  const overflowClosed = await page.evaluate(() => ({
    hidden: document.querySelector("#woOverflow")?.classList.contains("hidden"),
    expanded: document.querySelector("#woOverflowBtn")?.getAttribute("aria-expanded"),
  }));
  assert(
    overflowClosed.hidden === true && overflowClosed.expanded === "false",
    "picking a log mode closes the overflow menu",
    JSON.stringify(overflowClosed),
    "Log → ⋯ → Focus → menu collapses on its own"
  );
  // Rest lives in the workout header in Focus: one control, never over the card.
  await page.click("#woRest");
  await page.waitForTimeout(200);
  const restSurfaces = await page.evaluate(() => {
    const chip = document.querySelector("#woRest");
    const bar = document.querySelector("#restBar");
    const card = document.querySelector("#workout .exercise.is-current");
    const chipBox = chip.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();
    return {
      chipVisible: !chip.classList.contains("hidden") && getComputedStyle(chip).display !== "none",
      running: chip.classList.contains("is-running"),
      counting: /^\d+:\d\d$/.test(chip.querySelector(".wo-rest__time")?.textContent?.trim() || ""),
      labelled: /\d+:\d\d/.test(chip.getAttribute("aria-label") || ""),
      floatingHidden: getComputedStyle(bar).display === "none",
      inCard: card.querySelectorAll("[data-rest], .ex__rest").length,
      overlapsCard: chipBox.bottom > cardBox.top,
      tapTarget: Math.round(Math.min(chipBox.width, chipBox.height)),
    };
  });
  assert(
    restSurfaces.chipVisible && restSurfaces.running && restSurfaces.counting &&
      restSurfaces.labelled && restSurfaces.floatingHidden && restSurfaces.inCard === 0 &&
      !restSurfaces.overlapsCard && restSurfaces.tapTarget >= 44,
    "Focus rest counts down in the workout header, clear of the card's controls",
    JSON.stringify(restSurfaces),
    "Log → Focus → tap the header timer → it becomes a counting pill above the card"
  );
  await page.click("#woRest");
  await page.waitForTimeout(150);
  assert(
    await page.evaluate(() => !document.querySelector("#woRest").classList.contains("is-running")),
    "tapping the running rest chip stops it",
    `running=${await page.evaluate(() => document.querySelector("#woRest").classList.contains("is-running"))}`,
    "Focus → tap the counting pill → rest stops and the stopwatch returns"
  );

  // Focus mode is a swipeable card deck: no fixed dock, and the card owns the
  // whole screen rather than sharing it with the tab bar.
  assert(
    (await page.locator("#workoutDock").count()) === 0,
    "focus mode has no fixed bottom dock",
    `workoutDock count=${await page.locator("#workoutDock").count()}`,
    "Focus mode navigates by swipe + header chevrons instead of a dock"
  );
  const deck = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const wrap = card?.closest(".deck");
    const slot = card?.closest(".deck__slot");
    return {
      wrapped: !!wrap,
      tracked: slot?.parentElement?.classList.contains("deck__track") === true,
      // Nothing sits under or behind the card; the deck is the card.
      layers: wrap.querySelectorAll(".deck__layer").length,
      slack: Math.round(window.innerHeight - card.getBoundingClientRect().bottom),
      surface: getComputedStyle(card).backgroundColor,
      pageBg: getComputedStyle(document.body).backgroundColor,
      radius: parseFloat(getComputedStyle(card).borderTopLeftRadius),
      upNext: document.querySelectorAll(".focus-next").length,
      cueInsideCard: !!card.querySelector(".focus-well .focus-cue"),
      navHidden: getComputedStyle(document.querySelector("nav")).display === "none",
      peeksHidden: [...wrap.querySelectorAll(".deck__slot--next, .deck__slot--prev")].every(
        (p) => getComputedStyle(p).visibility === "hidden"
      ),
      peekHasFields: [...wrap.querySelectorAll(".deck__slot--next, .deck__slot--prev")].some((p) => !!p.querySelector("[data-k]")),
    };
  });
  assert(
    deck.wrapped && deck.tracked && deck.radius >= 12 && deck.surface !== deck.pageBg,
    "the current exercise renders as a raised card on a paged track",
    JSON.stringify(deck),
    "Focus mode → the exercise sits on its own rounded surface, not flat on the page"
  );
  assert(
    deck.layers === 0 && deck.slack <= 16,
    "no card stack sits under the card, and the space is the card's",
    JSON.stringify(deck),
    "Focus mode → the card runs to the bottom edge with nothing stacked beneath it"
  );
  assert(
    deck.upNext === 0,
    "the up-next row is gone from the focus card",
    `focus-next count=${deck.upNext}`,
    "Focus mode → navigation is the deck itself, no 'Up next' row"
  );
  assert(
    deck.cueInsideCard,
    "the recommendation cue sits in the card's attached well",
    JSON.stringify(deck),
    "Focus mode → the guidance line rides with the inputs, not above the fold"
  );
  assert(
    deck.navHidden,
    "focus mode gives the card the whole screen",
    JSON.stringify(deck),
    "Focus mode → the tab bar steps aside so the card is full height"
  );
  assert(
    deck.peeksHidden && !deck.peekHasFields,
    "the neighbouring cards stay parked and carry no duplicate fields",
    JSON.stringify(deck),
    "Focus mode → the peek copies are invisible at rest and hold no data-k inputs"
  );
  const pageFit = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current").getBoundingClientRect();
    return {
      pageScrollsY: document.documentElement.scrollHeight > window.innerHeight + 2,
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      gapToBottom: Math.round(window.innerHeight - card.bottom),
    };
  });
  assert(
    !pageFit.pageScrollsY && !pageFit.pageScrollsX && pageFit.gapToBottom >= 0 && pageFit.gapToBottom <= 48,
    "the focus screen neither scrolls nor spills sideways",
    JSON.stringify(pageFit),
    "Focus → the card runs to just above the bottom edge and the page holds still"
  );
  await page.evaluate(() => window.scrollTo(0, 0));

  // Dragging the card sideways advances the deck (Tinder-style).
  const swipeFrom = await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex);
  const cardBox = await page.locator("#workout .exercise.is-current").boundingBox();
  // Grab the card by its header — steppers and buttons keep their own gestures.
  const swipeY = Math.round(cardBox.y + 40);
  const swipeX = Math.round(cardBox.x + cardBox.width - 30);
  await page.mouse.move(swipeX, swipeY);
  await page.mouse.down();
  for (const step of [-40, -110, -200, -260]) {
    await page.mouse.move(swipeX + step, swipeY);
    await page.waitForTimeout(20);
  }
  const lifted = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const track = document.querySelector("#focusTrack");
    const peek = document.querySelector(".deck__slot--next");
    return {
      trackMoved: getComputedStyle(track).transform !== "none",
      // The cards travel flat and upright; nothing tilts.
      cardUpright: getComputedStyle(card).transform === "none",
      peekShown: !!peek && getComputedStyle(peek).visibility === "visible",
      peekNamed: peek?.querySelector(".focus-ex__name")?.textContent?.trim() || "",
    };
  });
  assert(
    lifted.trackMoved && lifted.cardUpright && lifted.peekShown && lifted.peekNamed,
    "dragging carries the card and the next exercise's card as one",
    JSON.stringify(lifted),
    "Focus → hold a drag halfway → the next card rides in beside the one being pushed"
  );
  await page.mouse.up();
  await page.waitForTimeout(600);
  const swipeTo = await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex);
  assert(
    swipeFrom && swipeTo && swipeFrom !== swipeTo,
    "swiping the focus card left advances to the next exercise",
    `from=${swipeFrom} to=${swipeTo}`,
    "Focus → drag the card leftwards past the threshold → next exercise"
  );
  await page.click("#woPrev");
  await page.waitForTimeout(450);
  assert(
    (await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex)) === swipeFrom,
    "header chevron returns to the previous exercise",
    `back=${await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex)}`,
    "Focus → tap ‹ in the progress header → previous exercise"
  );

  // Real thumbs don't swipe in straight lines: an arc that starts with a vertical
  // nudge, and a short fast flick, both have to count.
  const currentEx = () => page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex);
  const dragPath = async (path) => {
    const box = await page.locator("#workout .exercise.is-current").boundingBox();
    const ox = Math.round(box.x + box.width - 40);
    const oy = Math.round(box.y + 60);
    const before = await currentEx();
    await page.mouse.move(ox, oy);
    await page.mouse.down();
    for (const [dx, dy] of path) {
      await page.mouse.move(ox + dx, oy + dy);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    return { before, after: await currentEx() };
  };
  const arc = await dragPath([[-4, 14], [-30, 20], [-90, 26], [-160, 30], [-230, 32]]);
  assert(
    arc.before !== arc.after,
    "a swipe that starts with a vertical nudge still changes the exercise",
    JSON.stringify(arc),
    "Focus → swipe in an arc, as a thumb does → the deck advances"
  );
  const flick = await dragPath([[-18, 2], [-52, 4], [-74, 6]]);
  assert(
    flick.before !== flick.after,
    "a short fast flick changes the exercise",
    JSON.stringify(flick),
    "Focus → flick the card without dragging it far → the deck advances"
  );
  const straightDown = await dragPath([[0, 20], [-2, 60], [-4, 120], [-6, 170]]);
  assert(
    straightDown.before === straightDown.after,
    "a vertical drag leaves the deck where it is",
    JSON.stringify(straightDown),
    "Focus → drag straight down → no exercise change"
  );
  const scrollPolicy = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const ledger = card.querySelector(".fcard__ledger");
    const overflows = ledger.scrollHeight > ledger.clientHeight + 1;
    return {
      overflows,
      marked: ledger.classList.contains("is-scrollable"),
      touch: getComputedStyle(card).touchAction,
      wellScrolls: (() => { const w = card.querySelector(".focus-well");
        return w.scrollHeight > w.clientHeight + 1 })(),
    };
  });
  assert(
    scrollPolicy.overflows === scrollPolicy.marked &&
      scrollPolicy.touch === "pan-y" && !scrollPolicy.wellScrolls,
    "the ledger is the only scrolling region of the card",
    JSON.stringify(scrollPolicy),
    "Focus → vertical gestures scroll the ledger; the well never scrolls"
  );
  while ((await page.evaluate(() => document.querySelector("#woPrev")?.disabled)) === false) {
    await page.click("#woPrev");
    await page.waitForTimeout(450);
  }
  assert(
    await page.evaluate(() => document.querySelector("#woPrev")?.disabled === true),
    "previous chevron is disabled on the first exercise",
    `disabled=${await page.evaluate(() => document.querySelector("#woPrev")?.disabled)}`,
    "Focus → first exercise → ‹ cannot be tapped"
  );
  // The card is screen-height: same box on every exercise, with the page itself
  // never scrolling and the well pinned in view.
  const cardMetrics = () =>
    page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current").getBoundingClientRect();
      const well = document.querySelector(".focus-well")?.getBoundingClientRect();
      return {
        h: Math.round(card.height),
        top: Math.round(card.top),
        inlineH: document.querySelector("#workout.is-focus .deck")?.style.height || "",
        gapToBottom: Math.round(window.innerHeight - card.bottom),
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 2,
        wellVisible: !!well && well.bottom <= card.bottom + 1 && well.top >= card.top,
      };
    });
  const sizeFirst = await cardMetrics();
  await page.click("#woNext");
  await page.waitForTimeout(450);
  const sizeSecond = await cardMetrics();
  await page.click("#woPrev");
  await page.waitForTimeout(450);
  assert(
    sizeFirst.h === sizeSecond.h && sizeFirst.top === sizeSecond.top && sizeFirst.h > 300,
    "the focus card is the same size on every exercise",
    `first=${JSON.stringify(sizeFirst)} second=${JSON.stringify(sizeSecond)}`,
    "Focus → swipe between exercises → the card box never changes"
  );
  assert(
    !sizeFirst.pageScrolls && sizeFirst.gapToBottom >= 0 && sizeFirst.gapToBottom <= 44,
    "the card fills the screen without scrolling the page",
    JSON.stringify(sizeFirst),
    "Focus → the card runs from the progress header to just above the bottom edge"
  );
  // Both sizes are read on the frame the viewport changes, before any debounced
  // handler could run: a card sized by the layout is never briefly — or, if the
  // resize is missed, lastingly — left short of the screen.
  await page.setViewportSize({ width: 390, height: 600 });
  const sizeShrunk = await cardMetrics();
  await page.setViewportSize({ width: 390, height: 844 });
  const sizeRestored = await cardMetrics();
  assert(
    sizeShrunk.gapToBottom >= 0 && sizeShrunk.gapToBottom <= 44 &&
      sizeRestored.gapToBottom >= 0 && sizeRestored.gapToBottom <= 44,
    "the card follows the viewport with no measurement to catch up",
    JSON.stringify({ sizeShrunk, sizeRestored }),
    "Focus → shrink the viewport and give it back → the card fills the screen on the very next frame"
  );
  assert(
    sizeRestored.inlineH === "",
    "the deck carries no measured height that could go stale",
    `inline height="${sizeRestored.inlineH}"`,
    "Focus → the deck takes its height from the layout instead of JS arithmetic"
  );
  await page.waitForTimeout(200);
  assert(
    sizeFirst.wellVisible,
    "the current set stays pinned inside the card",
    JSON.stringify(sizeFirst),
    "Focus → the set controls and the commit button sit at the bottom of the card, not below the fold"
  );
  const split = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current").getBoundingClientRect();
    const ledger = document.querySelector("#workout .fcard__ledger").getBoundingClientRect();
    const save = document.querySelector("#workout .focus-well .saveset").getBoundingClientRect();
    return {
      ledgerShare: Math.round((ledger.height / card.height) * 100),
      slackUnderSave: Math.round(card.bottom - save.bottom),
    };
  });
  assert(
    split.ledgerShare >= 30 && split.slackUnderSave <= 24,
    "the logged sets get the space, not the gap under the commit button",
    JSON.stringify(split),
    "Focus → the ledger keeps a third of the card and nothing pads the bottom of it"
  );

  // A short screen must not cost the card its commit button: the set entry is
  // the last thing to give, and the first logged set must not push it out.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.waitForTimeout(260);
  const fitMetrics = () =>
    page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current");
      const ledgerBox = card.querySelector(".fcard__ledger").getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const save = card.querySelector(".focus-well .saveset");
      const saveBox = save?.getBoundingClientRect();
      return {
        wellH: card.querySelector(".focus-well").offsetHeight,
        cueLines: card.querySelector(".focus-cue") ? 1 : 0,
        spill: card.scrollHeight - card.clientHeight,
        saveWhole: !!saveBox && saveBox.bottom <= cardBox.bottom + 1 && saveBox.height >= 44,
        rowsWhole: [...card.querySelectorAll(".ledger__row")].filter((r) => {
          const b = r.getBoundingClientRect();
          return b.top >= ledgerBox.top - 1 && b.bottom <= ledgerBox.bottom + 1;
        }).length,
      };
    });
  // Drop the harness's own prefills so the card behaves like a fresh session.
  await page.evaluate((d) => {
    const draft = JSON.parse(localStorage.getItem(d) || "{}");
    draft.__touched = [];
    localStorage.setItem(d, JSON.stringify(draft));
  }, DRAFT);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: true }));
  await page.waitForTimeout(260);
  const fitBefore = await fitMetrics();
  await page.evaluate(() => {
    const cur = document.querySelector("#workout .exercise.is-current");
    const key = cur.querySelector(".focus-well .curset").dataset.set;
    for (const [suffix, val] of [["load", 90], ["reps", 6], ["rir", 1]]) {
      const el = cur.querySelector(`.focus-well [data-k="${key}_${suffix}"]`);
      if (!el) continue;
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    cur.querySelector(".focus-well .saveset").click();
  });
  await page.waitForTimeout(300);
  const fitAfter = await fitMetrics();
  assert(
    fitAfter.saveWhole && fitAfter.spill <= 1,
    "the commit button survives the first logged set on a short screen",
    `before=${JSON.stringify(fitBefore)} after=${JSON.stringify(fitAfter)}`,
    "360×640 → Focus → log set 1 → the button for set 2 is still whole inside the card"
  );
  assert(
    fitAfter.wellH === fitBefore.wellH,
    "the attached well keeps its height when a set lands",
    `before=${JSON.stringify(fitBefore)} after=${JSON.stringify(fitAfter)}`,
    "Focus → log a set → only the ledger changes"
  );
  assert(
    fitAfter.rowsWhole >= 1,
    "the set just logged shows whole on a short screen",
    JSON.stringify(fitAfter),
    "360×640 → Focus → log set 1 → the logged row is in view, not scrolled off the top"
  );
  // A window short enough that the set entry cannot fit at full size still has
  // to hand over a whole commit button.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  const fitCramped = await fitMetrics();
  assert(
    fitCramped.saveWhole && fitCramped.spill <= 1,
    "a cramped card thins the set entry rather than clipping it",
    JSON.stringify(fitCramped),
    "320×568 → Focus → the card sheds ornament and the commit button stays whole inside it"
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(260);

  // Focus carries List's per-exercise controls: last session's numbers and skip.
  // A fresh card for an exercise with history: last session is what it leads on.
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: true }));
  await page.waitForTimeout(300);
  const lastSession = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const past = [...card.querySelectorAll(".ledger__row.is-past")];
    return {
      label: card.querySelector(".ledger__lab")?.textContent?.trim() || "",
      rows: past.length,
      firstRow: past[0] ? [...past[0].querySelectorAll("span")].map((s) => s.textContent.trim()) : [],
      head: [...card.querySelectorAll(".ledger__head > span")].map((s) => s.textContent.replace(/\s+/g, " ").trim()),
      tools: card.querySelectorAll(".focus-ex__tools .focus-tool").length,
      skip: !!card.querySelector(".focus-ex__tools [data-skip]"),
      note: !!card.querySelector(".focus-ex__tools [data-exnote-open]"),
      restInCard: card.querySelectorAll("[data-rest]").length,
    };
  });
  assert(
    lastSession.rows > 0 && lastSession.label &&
      /^\d/.test(lastSession.firstRow[1] || "") && /kg|lb/i.test(lastSession.head[1] || ""),
    "the focus card shows last session's load, reps and RIR",
    JSON.stringify(lastSession),
    "Focus → an exercise with history lists what was lifted last time"
  );
  assert(
    lastSession.tools === 2 && lastSession.skip && lastSession.note && lastSession.restInCard === 0,
    "the focus card carries note and skip; rest stays in the workout chrome",
    JSON.stringify(lastSession),
    "Focus → the card header holds the note and Skip, and no timer of its own"
  );
  const beforeSkip = await page.evaluate(() => ({
    ex: document.querySelector("#workout .exercise.is-current")?.dataset.ex,
    count: document.querySelectorAll("#woProgress .segbar--ex .segbar__seg").length,
  }));
  await page.click("#workout .exercise.is-current [data-skip]");
  await page.waitForTimeout(320);
  const afterSkip = await page.evaluate(() => ({
    ex: document.querySelector("#workout .exercise.is-current")?.dataset.ex,
    count: document.querySelectorAll("#woProgress .segbar--ex .segbar__seg").length,
    skipbar: !!document.querySelector("#workout .skipbar"),
  }));
  assert(
    afterSkip.ex !== beforeSkip.ex && afterSkip.count === beforeSkip.count - 1 && afterSkip.skipbar,
    "skipping from the focus card drops it out of the session",
    `${JSON.stringify(beforeSkip)} -> ${JSON.stringify(afterSkip)}`,
    "Focus → tap skip → the deck moves on and the hidden-exercises bar appears"
  );
  await page.click("#workout .skipbar__show");
  await page.waitForTimeout(320);
  assert(
    (await page.evaluate(() => document.querySelectorAll("#woProgress .segbar--ex .segbar__seg").length)) === beforeSkip.count,
    "restoring skipped exercises puts them back in the deck",
    `count=${await page.evaluate(() => document.querySelectorAll("#woProgress .segbar--ex .segbar__seg").length)}`,
    "Focus → Show all in the hidden bar → the skipped exercise returns"
  );
  await page.evaluate(() => {
    const fl = [...document.querySelectorAll("#workout .exercise")];
    const at = fl.findIndex((e) => e.classList.contains("is-current"));
    if (at > 0) document.querySelector("#woPrev")?.click();
  });
  await page.waitForTimeout(450);

  const focusMeta = await getExerciseMeta(page, "Day 1");
  await fillExerciseSets(page, focusMeta[0].id, focusMeta[0].sets, 90, 6, 1);
  // Focus mode commits per set via the "Log set" button next to the current set
  // (values must be filled first), navigates exercises with the dock, and only
  // offers Finish once every set is logged.
  const fillCurrentFocusSet = () =>
    page.evaluate(() => {
      const cur = document.querySelector("#workout .exercise.is-current");
      const key = cur?.querySelector(".focus-well .curset")?.dataset.set;
      if (!key) return false;
      for (const [suffix, val] of [["load", 90], ["reps", 6], ["rir", 1]]) {
        const el = cur.querySelector(`.focus-well [data-k="${key}_${suffix}"]`);
        if (!el || el.value === String(val)) continue;
        el.value = String(val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    });
  let recAfterLog = null;
  for (let guard = 0; guard < 80; guard++) {
    const finish = await page.evaluate(() => {
      const f = document.querySelector("[data-ffinish]");
      return f && !f.classList.contains("visually-hidden") && f.offsetParent !== null;
    });
    if (finish) break;
    if (recAfterLog === null) {
      recAfterLog = await page.evaluate(() => {
        const card = document.querySelector("#workout .exercise.is-current");
        const logged = card?.querySelectorAll(".ledger__row[data-editn]").length || 0;
        return logged
          ? { logged, rec: card.querySelectorAll(".recblock").length,
              cue: card.querySelector(".focus-cue__text")?.textContent?.trim() || "" }
          : null;
      });
    }
    let acted = false;
    if (await fillCurrentFocusSet()) {
      acted = await page.evaluate(() => {
        const b = document.querySelector("#workout .exercise.is-current .focus-well .saveset");
        if (b) { b.click(); return true; }
        return false;
      });
    }
    if (!acted) {
      acted = await page.evaluate(() => {
        const b = document.querySelector("#woNext");
        if (b && !b.disabled) { b.click(); return true; }
        return false;
      });
    }
    if (!acted) break;
    await page.waitForTimeout(280);
  }
  assert(
    recAfterLog && recAfterLog.logged > 0 && recAfterLog.rec === 0 && !!recAfterLog.cue,
    "the recommendation stays as the well's one-line cue once a set is logged",
    JSON.stringify(recAfterLog),
    "Focus → log a set → List's recommendation block is gone and the cue names the next set"
  );
  await page.evaluate(() => document.querySelector("[data-ffinish]")?.click());
  await page.waitForTimeout(120);
  assert(
    (await getState(page)).log.some((r) => r.exerciseId === focusMeta[0].id && +r.load === 90),
    "Finish workout saves focus-mode sets",
    "No saved row from focus mode",
    "Log → Focus → fill → Finish → rows saved"
  );
  await clickLogMode(page, "full");

  beginPhase("Phase: workout entry CTA + transition");
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  const ctaFresh = (await page.locator("#startWorkout").textContent())?.trim();
  assert(
    /start/i.test(ctaFresh || ""),
    "Today CTA reads Start workout with no session in progress",
    `cta="${ctaFresh}"`,
    "Clear draft → Today → CTA says Start workout"
  );
  await page.evaluate(() => {
    window.__animSeen = { enter: false, leave: false };
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (el.id === "workoutShell" && el.classList.contains("wo-anim-enter")) window.__animSeen.enter = true;
        if (el.id === "todayDash" && el.classList.contains("wo-anim-leave")) window.__animSeen.leave = true;
      }
    });
    obs.observe(document.querySelector("#workoutShell"), { attributes: true, attributeFilter: ["class"] });
    obs.observe(document.querySelector("#todayDash"), { attributes: true, attributeFilter: ["class"] });
  });
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(120);
  const ctaMeta = await getExerciseMeta(page, "Day 1");
  await fillExerciseSets(page, ctaMeta[0].id, 1, 80, 6, 1);
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  await page.waitForTimeout(120);
  const ctaResume = (await page.locator("#startWorkout").textContent())?.trim();
  assert(
    /continue/i.test(ctaResume || ""),
    "Today CTA reads Continue workout while a session is in progress",
    `cta="${ctaResume}"`,
    "Start a session → leave → Today CTA says Continue workout"
  );
  const animSeen = await page.evaluate(() => window.__animSeen);
  assert(
    animSeen.enter === true && animSeen.leave === true,
    "entering and leaving a workout each play a transition",
    JSON.stringify(animSeen),
    "Today → Start workout → shell animates in; leave → dashboard animates back"
  );
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  assert(
    (await getState(page)) &&
      (await page.evaluate((k) => {
        const d = JSON.parse(localStorage.getItem(k) || "{}");
        return Object.keys(d).some((x) => /_load$/.test(x) && +d[x] === 80);
      }, DRAFT)),
    "Continue workout resumes the in-progress draft",
    "draft load 80 missing after resume",
    "Today → Continue workout → previously entered sets are still there"
  );
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");

  // IndexedDB holds primary state (localStorage mirror kept for harness)
  const idbHasState = await page.evaluate(async (k) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const val = await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readonly");
      const req = tx.objectStore("kv").get(k);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return val != null && Array.isArray(val.log);
  }, KEY);
  assert(
    idbHasState,
    "IndexedDB stores training state",
    "repforge/kv missing state blob",
    "Log a session → DevTools IndexedDB → repforge → kv"
  );
  const mirrorState = await getState(page);
  assert(
    mirrorState && Array.isArray(mirrorState.log) && mirrorState.log.length > 0,
    "localStorage mirror populated after save",
    `mirror log length=${mirrorState?.log?.length ?? "null"}`,
    "Save workout → localStorage repforge_v1 mirrors persisted state"
  );

  beginPhase("Phase: analytics shell (P10)");
  await nav(page, "stats");
  const segBtnCount = await page.locator("#statsSeg button").count();
  assert(
    segBtnCount === 5,
    "Stats segmented control has 5 segments",
    `button count=${segBtnCount}`,
    "Stats tab → inspect #statsSeg buttons"
  );
  const segLabels = await page.locator("#statsSeg button").allTextContents();
  assert(
    segLabels.includes("Overview") && segLabels.includes("Strength") && segLabels.includes("Volume") && segLabels.includes("PRs") && segLabels.includes("Review"),
    "Stats segments include Overview, Strength, Volume, PRs, Review",
    `labels=${segLabels.join(",")}`,
    "Stats tab → segment button labels"
  );
  await page.click('#statsSeg button[data-seg="strength"]');
  await page.waitForTimeout(80);
  const strengthVisible = await page.evaluate(() => {
    const s = document.querySelector("#segStrength");
    const o = document.querySelector("#segOverview");
    return s?.classList.contains("active") && !o?.classList.contains("active");
  });
  assert(
    strengthVisible,
    "Strength segment shows and Overview hides on click",
    `strengthVisible=${strengthVisible}`,
    "Stats → click Strength → #segStrength active, #segOverview not"
  );
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForTimeout(80);
  const overviewRestored = await page.evaluate(() => {
    const s = document.querySelector("#segOverview");
    const str = document.querySelector("#segStrength");
    return s?.classList.contains("active") && !str?.classList.contains("active");
  });
  assert(
    overviewRestored,
    "Overview segment restores as default after switching back",
    `overviewRestored=${overviewRestored}`,
    "Stats → Strength → Overview → #segOverview active again"
  );
  const weekHelpers = await page.evaluate(() => {
    const w = window.__repforgeWeek;
    if (!w?.weekStart || !w?.weekRange || !w?.sessionsInRange) return { ok: false, reason: "hook missing" };
    const wed = "2025-07-02";
    const mon = w.weekStart(wed);
    const range = w.weekRange(wed);
    const monDow = new Date(`${mon}T12:00:00`).getDay();
    return {
      ok: monDow === 1 && range.start <= range.end && range.start === mon,
      mon,
      monDow,
      range,
    };
  });
  assert(
    weekHelpers.ok,
    "weekStart returns Monday and weekRange start<=end",
    JSON.stringify(weekHelpers),
    "page.evaluate window.__repforgeWeek.weekStart/weekRange on a Wednesday"
  );
  const sessionsInRange = await page.evaluate(() => {
    const w = window.__repforgeWeek;
    const r = w.weekRange(today());
    return w.sessionsInRange(r.start, r.end).length;
    function today() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  });
  assert(
    sessionsInRange > 0,
    "sessionsInRange returns sessions for the current week",
    `count=${sessionsInRange}`,
    "After logging → __repforgeWeek.sessionsInRange(this week)"
  );

  beginPhase("Phase: this week (P11)");
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForTimeout(80);
  const thisWeekVisible = await page.locator("#thisWeek").count();
  assert(
    thisWeekVisible === 1,
    "This Week card exists in Overview",
    `count=${thisWeekVisible}`,
    "Stats → Overview → #thisWeek"
  );
  const thisWeekText = await page.locator("#thisWeek").innerText();
  assert(
    /improved|stable|attention/i.test(thisWeekText),
    "This Week card shows status line",
    `text=${thisWeekText.slice(0, 80)}`,
    "Stats → Overview → #thisWeek shows improved/stable/attention"
  );
  const snap = await page.evaluate(() => window.__repforgeWeeklySnapshot());
  const validStatuses = ["On track", "Productive week", "Under target", "High fatigue", "Needs more data", "Rebuilding"];
  assert(
    snap && typeof snap === "object" && validStatuses.includes(snap.status),
    "weeklySnapshot returns object with valid status label",
    `status=${snap?.status}`,
    "page.evaluate window.__repforgeWeeklySnapshot()"
  );
  assert(
    Number.isFinite(snap.completedDays) && Number.isFinite(snap.completedSessions) && Number.isFinite(snap.totalHardSets),
    "weeklySnapshot includes numeric completedDays, completedSessions, totalHardSets",
    `days=${snap?.completedDays} sessions=${snap?.completedSessions} hard=${snap?.totalHardSets}`,
    "__repforgeWeeklySnapshot() numeric fields"
  );
  assert(
    Number.isFinite(snap.improvedLifts) && Number.isFinite(snap.readyToAdd) && Array.isArray(snap.prs),
    "weeklySnapshot includes improvedLifts, readyToAdd, prs array",
    `improved=${snap?.improvedLifts} ready=${snap?.readyToAdd} prs=${snap?.prs?.length}`,
    "__repforgeWeeklySnapshot() lift tallies"
  );

  beginPhase("Phase: F2 calendar-week adherence");
  {
    const f2Restore = await getState(page);
    await clearState(page);
    await reloadApp(page);
    const f2State = await getState(page);
    const days = [...new Set((f2State.program || []).map((e) => e.day))];
    assert(days.length >= 3, "F2: program has at least three training days", `days=${days.join(",")}`, "Default program days");
    const bounds = await page.evaluate(() => {
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const r = window.__repforgeWeek.weekRange(iso);
      const shift = (isoDate, n) => {
        const x = new Date(`${isoDate}T12:00:00`);
        x.setDate(x.getDate() + n);
        return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      };
      return { ...r, today: iso, prevSunday: shift(r.start, -1), nextMonday: shift(r.end, 1), mid: shift(r.start, 2) };
    });
    const row = (day, date, tag) => {
      const ex = f2State.program.find((e) => e.day === day);
      return {
        session: `${date}_${day}_f2_${tag}`, date, day, name: ex.name, exerciseId: ex.id, set: 1,
        load: 100, reps: 8, rir: 1, notes: "", created: `${date}T12:00:00.000Z`,
        primary: ex.primary, secondary: ex.secondary,
      };
    };
    await persistState(page, {
      ...f2State,
      programMeta: { ...f2State.programMeta, name: "F2 Split" },
      log: [
        row(days[0], bounds.prevSunday, "prevSun"),
        row(days[0], bounds.start, "mon"),
        row(days[1], bounds.mid, "mid"),
        row(days[0], bounds.mid, "dupDay"),
        row(days[2], bounds.nextMonday, "nextMon"),
      ],
    });
    await reloadApp(page);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.evaluate(() => {
      document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
      document.querySelector('nav button[data-view="log"]')?.click();
    });
    await page.waitForSelector("#todayWeek", { timeout: 5000 });
    const planned = days.length;
    const expected = 2;
    const todayText = await page.evaluate(() =>
      `${document.querySelector("#todayProgram")?.textContent || ""}\n${document.querySelector("#todayWeek")?.textContent || ""}`
    );
    assert(
      todayText.includes(`${expected} of ${planned} sessions`) && !todayText.includes(`${expected + 1} of ${planned}`),
      "F2: Today counts only Monday–Sunday planned days",
      `today="${todayText.replace(/\s+/g, " ").slice(0, 180)}" bounds=${JSON.stringify(bounds)}`,
      "Seed prev Sunday + Mon + midweek duplicate + next Monday → Today shows 2 of N"
    );
    await nav(page, "stats");
    const progressText = await page.locator("#thisWeek").textContent();
    assert(
      progressText.includes(`${expected} of ${planned} sessions`),
      "F2: Progress This week matches Today",
      `progress="${progressText.replace(/\s+/g, " ").slice(0, 160)}"`,
      "Stats → Overview → #thisWeek"
    );
    await page.evaluate(() => {
      document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
      document.querySelector('nav button[data-view="program"]')?.click();
    });
    await page.waitForSelector("#programOverview", { timeout: 5000 });
    const overviewVal = await page.locator("#programOverview .statrow__cell").first().locator(".statrow__val").textContent();
    assert(
      overviewVal.trim() === `${expected} / ${planned}`,
      "F2: Program sessions stat matches the calendar week",
      `val="${overviewVal}"`,
      "Program overview → sessions this week"
    );
    const editHidden = await page.locator("#programEditorWrap.is-hidden").count();
    if (editHidden) {
      await page.click("#programEditToggle");
      await page.waitForSelector("#pmetaChipsBottom", { timeout: 5000 });
    }
    const chip = await page.locator("#pmetaChipsBottom").textContent();
    assert(
      chip.includes(`${expected} / ${planned} days this week`),
      "F2: Program days-this-week chip matches the calendar week",
      `chip="${chip}"`,
      "Program → days this week chip"
    );
    await persistState(page, f2Restore);
    await reloadApp(page);
  }

  beginPhase("\nPhase: session deltas");
  await page.waitForFunction(() => typeof window.__repforgeTestDeltas === "function");
  const deltaFix = (session, set, load, reps, rir = 2, warmup = false) => ({
    session,
    date: "2026-01-01",
    created: session,
    exerciseId: "delta-test-ex",
    set,
    load,
    reps,
    rir,
    warmup,
  });
  const runDelta = (prevRows, curRows) =>
    page.evaluate(
      ([prev, cur]) => window.__repforgeTestDeltas(prev, cur),
      [prevRows, curRows]
    );

  const sameLoadMoreReps = await runDelta(
    [deltaFix("s1", 1, 100, 8, 2)],
    [deltaFix("s2", 1, 100, 10, 2)]
  );
  assert(
    sameLoadMoreReps.status === "improved",
    "Session delta: same load + more reps → improved",
    `status=${sameLoadMoreReps.status}`,
    "__repforgeTestDeltas: 100×8 → 100×10"
  );
  assert(
    sameLoadMoreReps.metrics?.deltas?.repsDelta === 2,
    "Session delta: repsDelta reflects extra reps",
    `repsDelta=${sameLoadMoreReps.metrics?.deltas?.repsDelta}`,
    "100×8 → 100×10"
  );

  const higherLoadFewerReps = await runDelta(
    [deltaFix("s1", 1, 100, 10, 2)],
    [deltaFix("s2", 1, 110, 8, 2)]
  );
  assert(
    ["improved", "changed_load"].includes(higherLoadFewerReps.status),
    "Session delta: higher load + fewer reps → improved or changed_load",
    `status=${higherLoadFewerReps.status}`,
    "100×10 → 110×8"
  );
  assert(
    higherLoadFewerReps.metrics?.deltas?.e1rmDelta > 0,
    "Session delta: higher-load scenario e1rmDelta positive",
    `e1rmDelta=${higherLoadFewerReps.metrics?.deltas?.e1rmDelta}`,
    "100×10 → 110×8"
  );

  const lowerLoadMoreReps = await runDelta(
    [deltaFix("s1", 1, 100, 8, 1)],
    [deltaFix("s2", 1, 95, 9, 2)]
  );
  assert(
    lowerLoadMoreReps.status === "changed_load",
    "Session delta: lower load + more reps (similar e1RM) → changed_load",
    `status=${lowerLoadMoreReps.status}`,
    "100×8@RIR1 → 95×9@RIR2"
  );
  assert(
    lowerLoadMoreReps.status !== "regressed",
    "Session delta: load-changed comparable session not regressed",
    `status=${lowerLoadMoreReps.status}`,
    "100×8@RIR1 → 95×9@RIR2"
  );

  const warmupIgnored = await runDelta(
    [deltaFix("s1", 1, 100, 8, 2)],
    [deltaFix("s2", 1, 1000, 1, 5, true), deltaFix("s2", 2, 100, 10, 2)]
  );
  assert(
    warmupIgnored.metrics?.current?.topLoad === 100,
    "Session delta: warmup rows ignored for topLoad",
    `topLoad=${warmupIgnored.metrics?.current?.topLoad}`,
    "warmup 1000kg must not affect metrics"
  );
  assert(
    warmupIgnored.status === "improved",
    "Session delta: warmup present does not block improved detection",
    `status=${warmupIgnored.status}`,
    "working set 100×10 vs prev 100×8"
  );

  beginPhase("Phase: P4 schema + migration");
  state = await getState(page);
  assert(
    Array.isArray(state.programHistory),
    "P4: state has programHistory array",
    `programHistory=${typeof state.programHistory}`,
    "Load app → inspect state.programHistory"
  );
  assert(
    state.programMeta.mesocycleLengthWeeks === 6 &&
      state.programMeta.mesocycleStatus === "active" &&
      state.programMeta.onboarded === false,
    "P4: programMeta phase-2 defaults",
    JSON.stringify({
      mesocycleLengthWeeks: state.programMeta.mesocycleLengthWeeks,
      mesocycleStatus: state.programMeta.mesocycleStatus,
      onboarded: state.programMeta.onboarded,
    }),
    "Load app → inspect programMeta defaults"
  );
  const historyEntry = { id: "hist-sim-1", name: "Prior block", endedAt: "2026-01-01" };
  await persistState(page, { ...state, programHistory: [historyEntry] });
  await reloadApp(page);
  state = await getState(page);
  assert(
    state.programHistory.length === 1 && state.programHistory[0].id === historyEntry.id,
    "P4: programHistory round-trips on persist/reload",
    `programHistory=${JSON.stringify(state.programHistory)}`,
    "persistState with programHistory → reload"
  );
  const legacyMeta = {
    id: state.programMeta.id,
    name: state.programMeta.name,
    started: state.programMeta.started,
    created: state.programMeta.created,
    updated: state.programMeta.updated,
  };
  await persistState(page, { ...state, programMeta: legacyMeta });
  await reloadApp(page);
  const legacyNorm = await getState(page);
  assert(
    legacyNorm.programMeta.mesocycleLengthWeeks === 6 &&
      legacyNorm.programMeta.mesocycleStatus === "active" &&
      legacyNorm.programMeta.onboarded === false &&
      legacyNorm.programMeta.goal === null,
    "P4: legacy programMeta normalizes without error",
    JSON.stringify(legacyNorm.programMeta),
    "Strip new programMeta fields → reload"
  );
  state = legacyNorm;

  beginPhase("Phase: P7 mesocycle lifecycle");
  const twoWeeksStarted = isoDateFromWeeksAgo(2);
  await persistState(page, {
    ...state,
    programMeta: {
      ...state.programMeta,
      started: twoWeeksStarted,
      mesocycleLengthWeeks: 6,
      mesocycleStatus: "active",
    },
  });
  await reloadApp(page);
  const mc = await page.evaluate(() => window.__repforgeMesocycleWeek());
  assert(
    mc.current >= 2 && mc.current <= 3,
    "P7: mesocycleWeek current ~2 after ~2 weeks",
    JSON.stringify(mc),
    "Set started ~2 weeks ago → __repforgeMesocycleWeek"
  );
  assert(
    mc.total === 6,
    "P7: mesocycleWeek total is 6",
    `total=${mc.total}`,
    "mesocycleLengthWeeks=6 → total 6"
  );
  await nav(page, "log");
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  const logCtxMeso = await page.locator("#todayProgram").textContent();
  assert(
    /of 6/.test(logCtxMeso),
    "P7: Log context shows Week X of 6",
    `todayProgram=${logCtxMeso}`,
    "Today dashboard → program strip includes of 6"
  );
  await nav(page, "program");
  const weekChipText = await page.locator("#pmetaChipsTop").textContent();
  assert(
    /of 6/.test(weekChipText),
    "P7: Program week chip shows of 6",
    `chips=${weekChipText}`,
    "Program tab → week chip includes of 6"
  );
  assert(
    (await page.locator("#endBlock").count()) === 1,
    "P7: #endBlock button exists",
    "endBlock missing from Program tab",
    "Program tab → End block button near program meta"
  );

  beginPhase("Phase: F8 mesocycle lifecycle display");
  {
    const f8Restore = await getState(page);
    const overrunText = (s) => {
      const m = String(s || "").match(/(?:Week|Semana)\s+(\d+)\s+(?:of|de)\s+(\d+)/i);
      return m && +m[1] > +m[2] ? `${m[1]} of ${m[2]}` : null;
    };
    const localDaysAgo = (n) => page.evaluate((days) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }, n);

    await clearState(page);
    await reloadApp(page);
    let f8 = await getState(page);
    await persistState(page, {
      ...f8,
      settings: { ...f8.settings, lang: "en" },
      programMeta: { ...f8.programMeta, started: null, mesocycleLengthWeeks: 6, mesocycleStatus: "active" },
    });
    await reloadApp(page);
    const noStart = await page.evaluate(() => window.__repforgeMesocycleWeek());
    assert(
      noStart.current === null && noStart.elapsedWeek == null && noStart.overrunWeeks === 0 && !noStart.isFinalWeek && !noStart.isComplete,
      "F8: no start date stays null (never Week 0)",
      JSON.stringify(noStart),
      "programMeta.started = null → mesocycleWeek()"
    );
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    const noStartUi = `${await page.locator("#todayProgram").textContent()}\n${await page.locator("#woDaySub").textContent()}`;
    assert(
      !/Week\s*0/i.test(noStartUi) && !overrunText(noStartUi),
      "F8: Today does not render Week 0 without a start date",
      `ui="${noStartUi.replace(/\s+/g, " ").slice(0, 160)}"`,
      "Today program strip / workout subtitle"
    );

    const startedW8 = await localDaysAgo(7 * 7);
    f8 = await getState(page);
    await persistState(page, {
      ...f8,
      settings: { ...f8.settings, lang: "en" },
      programMeta: { ...f8.programMeta, started: startedW8, mesocycleLengthWeeks: 6, mesocycleStatus: "active" },
    });
    await reloadApp(page);
    const w8 = await page.evaluate(() => window.__repforgeMesocycleWeek());
    const snap8 = await page.evaluate(() => window.__repforgeBlockSnapshot(state.programMeta, state.log));
    assert(
      w8.elapsedWeek === 8 && w8.current === 6 && w8.overrunWeeks === 2 && w8.isFinalWeek === true && w8.isComplete === false,
      "F8: week 8 of 6 clamps display week and keeps stored-completed false",
      JSON.stringify(w8),
      "started 7 weeks ago, status active → current 6, overrun 2"
    );
    assert(
      snap8.weekCurrent === 6 && snap8.elapsedWeek === 8 && snap8.overrunWeeks === 2 && snap8.isFinalWeek === true && snap8.isComplete === false,
      "F8: blockSnapshot consumes the same clamped lifecycle",
      JSON.stringify({ weekCurrent: snap8.weekCurrent, elapsedWeek: snap8.elapsedWeek, overrunWeeks: snap8.overrunWeeks, isFinalWeek: snap8.isFinalWeek, isComplete: snap8.isComplete }),
      "__repforgeBlockSnapshot after week 8 of 6"
    );
    const statusStillActive = (await getState(page)).programMeta.mesocycleStatus;
    assert(
      statusStillActive === "active",
      "F8: passing the target date does not mutate mesocycleStatus to completed",
      `status=${statusStillActive}`,
      "elapsed >= total, still active"
    );

    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    const todayW8 = await page.locator("#todayProgram").textContent();
    assert(
      /Week 6 of 6/.test(todayW8) && /ready for review/i.test(todayW8) && !overrunText(todayW8),
      "F8: Today shows clamped ready-for-review copy",
      `today="${todayW8.replace(/\s+/g, " ").slice(0, 180)}"`,
      "Today program strip at week 8 of 6"
    );
    const logBanner = await page.locator("#logBlockBanner").textContent();
    assert(
      /Week 6 of 6/.test(logBanner) && /ready for review/i.test(logBanner) && !overrunText(logBanner),
      "F8: workout block banner uses clamped ready-for-review copy",
      `banner="${(logBanner || "").replace(/\s+/g, " ").slice(0, 180)}"`,
      "#logBlockBanner at week 8 of 6"
    );
    await nav(page, "log");
    const woSub = await page.locator("#woDaySub").textContent();
    assert(
      /Week 6/.test(woSub) && !/Week 8/.test(woSub),
      "F8: workout subtitle uses the clamped week",
      `woSub="${woSub}"`,
      "#woDaySub at week 8 of 6"
    );
    await page.evaluate(() => {
      document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
      document.querySelector('nav button[data-view="program"]')?.click();
    });
    await page.waitForSelector("#programOverview", { timeout: 5000 });
    const progWeek = await page.locator("#programOverview .prog-overview__week").textContent();
    const progBanner = await page.locator("#programBlockBanner").textContent();
    assert(
      /Week 6 of 6/.test(progWeek) && /ready for review/i.test(progWeek) && !overrunText(progWeek),
      "F8: Program overview week is clamped",
      `week="${progWeek}"`,
      "Program overview at week 8 of 6"
    );
    assert(
      /Week 6 of 6/.test(progBanner) && /ready for review/i.test(progBanner) && !overrunText(progBanner),
      "F8: Program block banner is clamped",
      `banner="${(progBanner || "").replace(/\s+/g, " ").slice(0, 180)}"`,
      "#programBlockBanner at week 8 of 6"
    );
    const editHidden = await page.locator("#programEditorWrap.is-hidden").count();
    if (editHidden) {
      await page.click("#programEditToggle");
      await page.waitForSelector("#pmetaChipsTop", { timeout: 5000 });
    }
    const chipW8 = await page.locator("#pmetaChipsTop").textContent();
    assert(
      /Week 6 of 6/.test(chipW8) && /ready for review/i.test(chipW8) && !overrunText(chipW8),
      "F8: Program week chip is clamped",
      `chip="${chipW8}"`,
      "#pmetaChipsTop at week 8 of 6"
    );
    await nav(page, "stats");
    await page.click('#statsSeg button[data-seg="review"]');
    await page.waitForTimeout(80);
    const reviewText = await page.locator("#reviewPanel").textContent();
    const summary = await page.evaluate(() => window.__repforgeBuildPlainSummary(window.__repforgeBlockSnapshot(state.programMeta, state.log)));
    assert(
      /Week 6 of 6/.test(reviewText) && /ready for review/i.test(reviewText) && !overrunText(reviewText),
      "F8: Review panel uses clamped ready-for-review copy",
      `review="${(reviewText || "").replace(/\s+/g, " ").slice(0, 200)}"`,
      "Stats → Review at week 8 of 6"
    );
    assert(
      /week 6 of 6/i.test(summary) && /ready for review/i.test(summary) && !overrunText(summary),
      "F8: review summary uses clamped ready-for-review copy",
      `summary="${summary}"`,
      "buildPlainSummary at week 8 of 6"
    );

    f8 = await getState(page);
    await persistState(page, {
      ...f8,
      programMeta: { ...f8.programMeta, started: startedW8, mesocycleLengthWeeks: 6, mesocycleStatus: "completed" },
    });
    await reloadApp(page);
    const done = await page.evaluate(() => window.__repforgeMesocycleWeek());
    const snapDone = await page.evaluate(() => window.__repforgeBlockSnapshot(state.programMeta, state.log));
    assert(
      done.isComplete === true && done.current === 6 && done.overrunWeeks === 2 && done.elapsedWeek === 8,
      "F8: stored completed status is distinct from overrun",
      JSON.stringify(done),
      "mesocycleStatus=completed at week 8 of 6"
    );
    assert(snapDone.isComplete === true && snapDone.weekCurrent === 6, "F8: blockSnapshot completed flag follows stored status", JSON.stringify({ isComplete: snapDone.isComplete, weekCurrent: snapDone.weekCurrent }), "blockSnapshot isComplete");
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    const todayDone = await page.locator("#todayProgram").textContent();
    const reviewDoneSummary = await page.evaluate(() => window.__repforgeBuildPlainSummary(window.__repforgeBlockSnapshot(state.programMeta, state.log)));
    await nav(page, "stats");
    await page.click('#statsSeg button[data-seg="review"]');
    await page.waitForTimeout(80);
    const reviewDone = await page.locator("#reviewPanel").textContent();
    assert(
      /Block complete/i.test(todayDone) && !overrunText(todayDone) && !/Week 8 of 6/.test(todayDone),
      "F8: completed-state copy on Today, no N>M week fraction",
      `today="${todayDone.replace(/\s+/g, " ").slice(0, 180)}"`,
      "Today after mesocycleStatus=completed"
    );
    assert(
      /This block is complete/i.test(reviewDoneSummary) && /Block complete/i.test(reviewDone) && !overrunText(reviewDone),
      "F8: completed-state copy on review surfaces",
      `summary="${reviewDoneSummary}" review="${(reviewDone || "").replace(/\s+/g, " ").slice(0, 160)}"`,
      "Review panel + plain summary when completed"
    );
    await persistState(page, f8Restore);
    await reloadApp(page);
  }

  beginPhase("Phase: P8 block review");
  const blockStarted = isoDateFromWeeksAgo(5);
  await persistState(page, {
    ...state,
    programMeta: { ...state.programMeta, started: blockStarted, mesocycleLengthWeeks: 6 },
  });
  await reloadApp(page);
  await nav(page, "program");
  const blockBanner = await page.evaluate(() => {
    const el = document.querySelector("#programBlockBanner");
    return {
      hidden: el?.classList.contains("hidden"),
      text: el?.textContent?.trim() || "",
      dismiss: !!el?.querySelector(".blockprompt__dismiss"),
      cta: !!el?.querySelector(".blockprompt__act"),
    };
  });
  assert(
    !blockBanner.hidden && blockBanner.dismiss && blockBanner.cta,
    "P8: block-ending prompt is visible and dismissible",
    JSON.stringify(blockBanner),
    "Final week → #programBlockBanner with Review block and dismiss"
  );
  await page.click("#programBlockBanner .blockprompt__dismiss");
  await page.waitForTimeout(120);
  const afterDismiss = await page.evaluate(() => {
    const el = document.querySelector("#programBlockBanner");
    const st = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    return {
      hidden: el?.classList.contains("hidden"),
      dismissedId: st.programMeta?.blockPromptDismissedId || null,
      id: st.programMeta?.id || null,
    };
  });
  assert(
    afterDismiss.hidden && afterDismiss.dismissedId && afterDismiss.dismissedId === afterDismiss.id,
    "P8: dismissing the block prompt hides it for this mesocycle",
    JSON.stringify(afterDismiss),
    "Tap dismiss on #programBlockBanner → hidden, blockPromptDismissedId = program id"
  );
  await reloadApp(page);
  await nav(page, "program");
  const afterReloadBanner = await page.evaluate(() =>
    document.querySelector("#programBlockBanner")?.classList.contains("hidden")
  );
  assert(
    afterReloadBanner,
    "P8: dismissed block prompt stays gone after reload",
    `hidden=${afterReloadBanner}`,
    "Reload → #programBlockBanner still hidden"
  );
  state = await getState(page);
  const blockReview = await page.evaluate(() =>
    window.__repforgeBuildBlockReview(state.programMeta, state.program, state.log)
  );
  const recLabels = [
    "repeat_with_simpler_schedule",
    "reduce_volume_or_deload",
    "repeat_or_progress",
    "keep_program_improve_completion",
    "repeat_with_small_swaps",
  ];
  assert(
    blockReview && recLabels.includes(blockReview.recommendation),
    "P8: buildBlockReview recommendation is a known label",
    `recommendation=${blockReview?.recommendation}`,
    "Seed history → __repforgeBuildBlockReview → recommendation field"
  );
  assert(
    ["plannedSessions", "completedSessions", "improvedLifts", "flatLifts", "stalledLifts", "prs"].every(
      (k) => typeof blockReview[k] === "number"
    ),
    "P8: buildBlockReview count fields are numbers",
    JSON.stringify({
      plannedSessions: blockReview?.plannedSessions,
      completedSessions: blockReview?.completedSessions,
      improvedLifts: blockReview?.improvedLifts,
      flatLifts: blockReview?.flatLifts,
      stalledLifts: blockReview?.stalledLifts,
      prs: blockReview?.prs,
    }),
    "__repforgeBuildBlockReview → numeric count fields"
  );
  assert(
    blockReview.completedSessions > 0 && blockReview.plannedSessions > 0,
    "P8: block review has planned and completed sessions",
    `completed=${blockReview.completedSessions} planned=${blockReview.plannedSessions}`,
    "Seeded log within block window → completedSessions > 0"
  );
  assert(
    typeof blockReview.adherenceRatio === "number" && blockReview.adherenceRatio >= 0 && blockReview.adherenceRatio <= 1,
    "P8: adherenceRatio is a guarded ratio",
    `adherenceRatio=${blockReview?.adherenceRatio}`,
    "__repforgeBuildBlockReview → adherenceRatio between 0 and 1"
  );
  assert(
    typeof blockReview.volumeCompliance === "number" && blockReview.volumeCompliance >= 0 && blockReview.volumeCompliance <= 1,
    "P8: volumeCompliance is a guarded ratio",
    `volumeCompliance=${blockReview?.volumeCompliance}`,
    "__repforgeBuildBlockReview → volumeCompliance capped at 1"
  );
  await nav(page, "program");
  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  assert(
    await page.evaluate(() => document.querySelector("#blockReview")?.classList.contains("hidden")),
    "P8: confirm open — block review stays hidden",
    `blockReview hidden=${await page.evaluate(() => document.querySelector("#blockReview")?.classList.contains("hidden"))}`,
    "End block → #endBlockConfirm visible, #blockReview still hidden"
  );
  await page.click("#endBlockCancel");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.querySelector("#blockReview")?.classList.contains("hidden")),
    "P8: cancel confirm — block review stays hidden",
    `blockReview hidden=${await page.evaluate(() => document.querySelector("#blockReview")?.classList.contains("hidden"))}`,
    "Cancel #endBlockConfirm → overlay hides, review not opened"
  );
  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  const REC_STRATEGY = {
    repeat_or_progress: "repeat",
    repeat_with_small_swaps: "repeat_swaps",
    reduce_volume_or_deload: "reduce_volume",
    keep_program_improve_completion: "repeat",
    repeat_with_simpler_schedule: "reduce_volume",
  };
  const expectedStrategy = REC_STRATEGY[blockReview.recommendation];
  const recommendedInfo = await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".blockreview__act.is-recommended")];
    return { count: btns.length, strategy: btns[0]?.dataset.strategy ?? null };
  });
  assert(
    recommendedInfo.count === 1,
    "P8: exactly one recommended strategy button",
    `count=${recommendedInfo.count}`,
    "Open block review → one .blockreview__act.is-recommended"
  );
  assert(
    recommendedInfo.strategy === expectedStrategy,
    "P8: recommended strategy matches buildBlockReview recommendation",
    `got=${recommendedInfo.strategy} expected=${expectedStrategy} recommendation=${blockReview.recommendation}`,
    "REC_STRATEGY map → highlighted data-strategy"
  );
  const reviewText = await page.locator("#blockReview").textContent();
  assert(
    /Recommendation:/i.test(reviewText) && /Why:/i.test(reviewText),
    "P8: block review panel shows recommendation and Why",
    reviewText?.slice(0, 160),
    "Program tab → End block → review panel opens"
  );
  const recSnippets = {
    repeat_with_simpler_schedule: "simpler schedule",
    reduce_volume_or_deload: "reduce volume",
    repeat_or_progress: "repeat this block or progress",
    keep_program_improve_completion: "improve completion",
    repeat_with_small_swaps: "small swaps",
  };
  assert(
    reviewText.toLowerCase().includes(recSnippets[blockReview.recommendation]),
    "P8: review panel shows friendly recommendation copy",
    `panel=${reviewText?.slice(0, 200)} recommendation=${blockReview.recommendation}`,
    "End block → panel body includes mapped recommendation line"
  );
  await page.click("#blockReviewClose");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));

  beginPhase("Phase: F11 dialog modality");
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, "program");

  const assertTrap = async (sel, label) => {
    await page.keyboard.press("Shift+Tab");
    let info = await probeModal(page, sel);
    assert(
      info && info.n > 1 && info.i === info.n - 1,
      `F11: ${label} reverse-Tab wraps to the last control`,
      JSON.stringify(info),
      `Open ${sel} → Shift+Tab`
    );
    await page.keyboard.press("Tab");
    info = await probeModal(page, sel);
    assert(
      info && info.i === 0,
      `F11: ${label} Tab wraps to the first control`,
      JSON.stringify(info),
      `Open ${sel} → Shift+Tab → Tab`
    );
    return info;
  };

  await page.locator("#endBlock").focus();
  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#endBlockConfirm");
  let f11 = await probeModal(page, "#endBlockConfirm");
  assert(
    f11 && f11.i === 0 && f11.firstId === "endBlockGo",
    "F11: #endBlockConfirm focuses the first enabled control",
    JSON.stringify(f11),
    "Program → End block"
  );
  assert(
    f11.inertMain && f11.inertNav && !f11.dialogInert,
    "F11: #endBlockConfirm makes the background inert",
    JSON.stringify(f11),
    "Program → End block → main/nav inert"
  );
  assert(
    !f11.scrimHidden && !f11.scrimInert,
    "F11: #endBlockConfirm shows the shared scrim",
    JSON.stringify(f11),
    "Program → End block → #dialogScrim visible"
  );
  await assertTrap("#endBlockConfirm", "#endBlockConfirm");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.activeElement?.id === "endBlock"),
    "F11: Escape on #endBlockConfirm restores the End block opener",
    `active=${await page.evaluate(() => document.activeElement?.id)}`,
    "End block → Escape"
  );
  assert(
    await page.evaluate(() => !document.querySelector("main")?.inert && !document.querySelector("nav")?.inert),
    "F11: closing #endBlockConfirm clears background inert",
    "main/nav still inert",
    "End block → Escape → inert removed"
  );

  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#endBlockConfirm");
  await page.locator("#dialogScrim").click({ position: { x: 4, y: 4 } });
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden")),
    "F11: #endBlockConfirm closes on backdrop tap",
    "confirm still visible",
    "End block → tap #dialogScrim"
  );
  assert(
    await page.evaluate(() => document.activeElement?.id === "endBlock"),
    "F11: backdrop close restores the End block opener",
    `active=${await page.evaluate(() => document.activeElement?.id)}`,
    "End block → tap scrim"
  );

  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#blockReview");
  f11 = await probeModal(page, "#blockReview");
  assert(
    f11 && f11.i === 0 && f11.firstId === "blockReviewClose",
    "F11: #blockReview focuses the first enabled control",
    JSON.stringify(f11),
    "End block → Review block"
  );
  assert(
    f11.inertMain && f11.inertNav && !f11.dialogInert,
    "F11: #blockReview makes the background inert",
    JSON.stringify(f11),
    "Review block → main/nav inert"
  );
  assert(
    f11.scrimHidden,
    "F11: #blockReview has no second visible scrim",
    JSON.stringify(f11),
    "Review block → #dialogScrim stays hidden"
  );
  assert(
    await page.evaluate(() => document.activeElement?.id !== "endBlockGo"),
    "F11: chained review does not leave focus on hidden #endBlockGo",
    `active=${await page.evaluate(() => document.activeElement?.id)}`,
    "End block → Review block → focus inside #blockReview"
  );
  await assertTrap("#blockReview", "#blockReview");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.activeElement?.id === "endBlock"),
    "F11: Escape on chained #blockReview restores the Program End block opener",
    `active=${await page.evaluate(() => document.activeElement?.id)}`,
    "End block → Review block → Escape"
  );

  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  await page.click("#blockDecideLater");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.activeElement?.id === "endBlock"),
    "F11: Decide later restores the original Program-page opener",
    `active=${await page.evaluate(() => document.activeElement?.id)}`,
    "End block → Review block → Decide later"
  );

  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#endBlockConfirm");
  await page.evaluate(() => document.querySelector("#endBlock")?.classList.add("hidden"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  const hiddenOpener = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      tag: el?.tagName || "",
      isBody: el === document.body || el === document.documentElement,
    };
  });
  assert(
    !hiddenOpener.isBody && (hiddenOpener.id === "programEditToggle" || hiddenOpener.id === "reviewBlockLink"),
    "F11: hidden opener falls back to a visible Program control",
    JSON.stringify(hiddenOpener),
    "End block → hide #endBlock → Escape"
  );
  await page.evaluate(() => document.querySelector("#endBlock")?.classList.remove("hidden"));

  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#endBlockConfirm");
  await page.evaluate(() => document.querySelector("#endBlock")?.remove());
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#endBlockConfirm")?.classList.contains("hidden"));
  const absentOpener = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      isBody: el === document.body || el === document.documentElement,
    };
  });
  assert(
    !absentOpener.isBody && (absentOpener.id === "programEditToggle" || absentOpener.id === "reviewBlockLink"),
    "F11: absent opener falls back to a visible Program control",
    JSON.stringify(absentOpener),
    "End block → remove #endBlock → Escape"
  );
  await reloadApp(page);
  await nav(page, "program");

  const f11BeforeStart = await getState(page);
  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  await page.click("#blockStartNext");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  const startNextFocus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      isBody: el === document.body || el === document.documentElement,
      connected: !!el?.isConnected,
    };
  });
  assert(
    !startNextFocus.isBody && startNextFocus.connected &&
      (startNextFocus.id === "endBlock" || startNextFocus.id === "reviewBlockLink" || startNextFocus.id === "programEditToggle"),
    "F11: Start next restores a visible Program review control",
    JSON.stringify(startNextFocus),
    "End block → Review block → Start next"
  );
  await persistState(page, f11BeforeStart);
  await reloadApp(page);
  await nav(page, "program");

  const f11BeforeOnb = await getState(page);
  await page.click("#endBlock");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  await page.click('[data-strategy="onboarding"]');
  await page.click("#blockStartNext");
  await page.waitForSelector("#onboarding.active", { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  const onbStartFocus = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      isBody: el === document.body || el === document.documentElement,
      connected: !!el?.isConnected,
      inOnboarding: !!el?.closest?.("#onboarding.active"),
    };
  });
  assert(
    !onbStartFocus.isBody && onbStartFocus.connected &&
      (onbStartFocus.id === "onbCancel" || onbStartFocus.inOnboarding),
    "F11: Start next onboarding restores a visible onboarding control",
    JSON.stringify(onbStartFocus),
    "End block → Review block → onboarding → Start next"
  );
  await persistState(page, f11BeforeOnb);
  await reloadApp(page);
  await nav(page, "program");

  const f11BeforeBanner = await getState(page);
  await persistState(page, {
    ...f11BeforeBanner,
    programMeta: { ...f11BeforeBanner.programMeta, blockPromptDismissedId: null },
  });
  await reloadApp(page);
  await nav(page, "log");
  await page.waitForSelector("#logBlockBanner:not(.hidden) .blockprompt__act", { timeout: 5000 });
  await page.click("#logBlockBanner .blockprompt__act");
  await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
  await page.click("#endBlockGo");
  await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
  await page.click("#blockStartNext");
  await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
  const bannerStartFocus = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el?.getBoundingClientRect?.();
    return {
      id: el?.id || "",
      isBody: el === document.body || el === document.documentElement,
      connected: !!el?.isConnected,
      visible: !!(r && (r.width > 0 || r.height > 0)),
      inDayTabs: !!el?.closest?.("#dayTabs"),
      inOnboarding: !!el?.closest?.("#onboarding.active"),
    };
  });
  assert(
    !bannerStartFocus.isBody && bannerStartFocus.connected && bannerStartFocus.visible &&
      (bannerStartFocus.id === "leaveWorkout" || bannerStartFocus.id === "startWorkout" ||
        bannerStartFocus.inDayTabs || bannerStartFocus.id === "onbCancel" || bannerStartFocus.inOnboarding),
    "F11: Start next from workout banner restores a visible destination",
    JSON.stringify(bannerStartFocus),
    "Workout banner → Review block → Start next"
  );
  await persistState(page, f11BeforeBanner);
  await reloadApp(page);
  await nav(page, "program");

  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#dataImportPanel")?.classList.add("is-open"));
  const f11BackupPath = join(tmpDir, "f11-import.json");
  writeFileSync(f11BackupPath, JSON.stringify(await getState(page)));
  await page.locator("#dataImportRow").focus();
  await page.setInputFiles("#importJson", f11BackupPath);
  await page.waitForSelector("#importChoice:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#importChoice");
  f11 = await probeModal(page, "#importChoice");
  assert(
    f11 && f11.i === 0 && f11.firstId === "importMerge",
    "F11: #importChoice focuses the first enabled control",
    JSON.stringify(f11),
    "Settings → Import backup"
  );
  assert(
    f11.inertMain && f11.inertNav && !f11.dialogInert,
    "F11: #importChoice makes the background inert",
    JSON.stringify(f11),
    "Import backup → main/nav inert"
  );
  assert(
    !f11.scrimHidden && !f11.scrimInert,
    "F11: #importChoice shows the shared scrim",
    JSON.stringify(f11),
    "Import backup → #dialogScrim visible"
  );
  await assertTrap("#importChoice", "#importChoice");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#importChoice")?.classList.contains("hidden"));
  const importOpener = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      isRow: el?.id === "dataImportRow",
      isLabel: !!el?.closest?.("label.file"),
    };
  });
  assert(
    importOpener.isRow || importOpener.isLabel,
    "F11: Escape on #importChoice restores the visible import opener",
    JSON.stringify(importOpener),
    "Import backup → Escape"
  );

  await page.locator("#dataImportRow").focus();
  await page.setInputFiles("#importJson", f11BackupPath);
  await page.waitForSelector("#importChoice:not(.hidden)", { timeout: 5000 });
  await waitFocusedIn(page, "#importChoice");
  await page.locator("#dialogScrim").click({ position: { x: 4, y: 4 } });
  await page.waitForFunction(() => document.querySelector("#importChoice")?.classList.contains("hidden"));
  assert(
    await page.evaluate(() => document.querySelector("#importChoice")?.classList.contains("hidden")),
    "F11: #importChoice closes on backdrop tap",
    "import dialog still visible",
    "Import backup → tap #dialogScrim"
  );

  beginPhase("Phase: P9 next-block flow");
  await page.waitForFunction(() => typeof window.__repforgeCompleteProgram === "function");
  const p9Before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      historyLen: s.programHistory.length,
      metaId: s.programMeta.id,
      sets: s.program.map((e) => e.sets),
    };
  });
  const p9Review = await page.evaluate(() =>
    window.__repforgeBuildBlockReview(state.programMeta, state.program, state.log)
  );
  await page.evaluate((review) => window.__repforgeCompleteProgram(review), p9Review);
  const p9AfterComplete = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return { historyLen: s.programHistory.length, status: s.programMeta.mesocycleStatus };
  });
  assert(
    p9AfterComplete.historyLen === p9Before.historyLen + 1,
    "P9: completeCurrentProgram appends programHistory entry",
    `history ${p9Before.historyLen} → ${p9AfterComplete.historyLen}`,
    "__repforgeCompleteProgram(review) → programHistory.length +1"
  );
  assert(
    p9AfterComplete.status === "completed",
    "P9: completeCurrentProgram sets mesocycleStatus completed",
    `status=${p9AfterComplete.status}`,
    "__repforgeCompleteProgram → programMeta.mesocycleStatus === completed"
  );
  await page.evaluate(() => window.__repforgeStartNextMeso("increase_volume"));
  const p9Today = new Date().toISOString().slice(0, 10);
  const p9AfterStart = await page.evaluate((todayStr) => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      historyLen: s.programHistory.length,
      metaId: s.programMeta.id,
      status: s.programMeta.mesocycleStatus,
      started: s.programMeta.started,
      sets: s.program.map((e) => e.sets),
    };
  }, p9Today);
  assert(
    p9AfterStart.metaId !== p9Before.metaId,
    "P9: startNextMesocycle mints new programMeta.id",
    `id ${p9Before.metaId} → ${p9AfterStart.metaId}`,
    "__repforgeStartNextMeso → new programMeta.id"
  );
  assert(
    p9AfterStart.status === "active",
    "P9: startNextMesocycle sets mesocycleStatus active",
    `status=${p9AfterStart.status}`,
    "__repforgeStartNextMeso → mesocycleStatus === active"
  );
  assert(
    p9AfterStart.started === p9Today,
    "P9: startNextMesocycle sets started to today",
    `started=${p9AfterStart.started} today=${p9Today}`,
    "__repforgeStartNextMeso → started === today()"
  );
  assert(
    p9AfterStart.historyLen === p9AfterComplete.historyLen,
    "P9: programHistory preserved across startNextMesocycle",
    `historyLen=${p9AfterStart.historyLen}`,
    "startNextMesocycle does not clear programHistory"
  );
  assert(
    p9AfterStart.sets.length === p9Before.sets.length &&
      p9AfterStart.sets.every((n, i) => n === p9Before.sets[i] + 1),
    "P9: increase_volume adds one set per exercise",
    `before=${p9Before.sets.join(",")} after=${p9AfterStart.sets.join(",")}`,
    "__repforgeStartNextMeso(increase_volume) → each exercise sets +1"
  );

  beginPhase("Phase: P5 program generation");
  await page.waitForFunction(() => typeof window.__repforgeGenerateProgram === "function");
  const genCases = [
    { goal: "hypertrophy", experience: "beginner", daysPerWeek: 3, splitType: "full_body", equipment: ["machine"], priorityMuscles: ["Chest"], sessionLength: "normal" },
    { goal: "strength", experience: "intermediate", daysPerWeek: 4, splitType: "upper_lower", equipment: ["barbell", "dumbbell", "machine"], priorityMuscles: [], sessionLength: "short" },
    { goal: "hypertrophy", experience: "beginner", daysPerWeek: 5, splitType: "ppl", equipment: ["machine"], priorityMuscles: ["Quads"], sessionLength: "long" },
  ];
  const genResults = await page.evaluate((cases) => {
    const catalogById = new Map();
    const bounds = { short: [4, 5], normal: [5, 7], long: [7, 9] };
    return cases.map((answers) => {
      const raw = window.__repforgeGenerateProgram(answers);
      const prog = new Program(raw);
      const json = prog.toJSON();
      const days = [...new Set(json.map((e) => e.day))];
      const perDay = days.map((d) => json.filter((e) => e.day === d).length);
      const [lo, hi] = bounds[answers.sessionLength] || bounds.normal;
      const withinBounds = perDay.every((n) => n >= lo && n <= hi);
      const fieldsOk = json.every((e) => e.name && e.sets > 0 && e.min > 0 && e.max >= e.min && e.primary);
      const machineOnly = answers.equipment.length === 1 && answers.equipment[0] === "machine";
      let equipOk = true;
      if (machineOnly) {
        for (const ex of json) {
          const libId = ex.libraryId;
          if (!libId) { equipOk = false; break; }
          catalogById.set(libId, libId);
        }
      }
      return {
        answers,
        dayCount: days.length,
        perDay,
        withinBounds,
        fieldsOk,
        programOk: json.length > 0,
        days,
      };
    });
  }, genCases);

  const case0 = genResults[0];
  assert(
    case0.dayCount === 3,
    "P5: generated program has daysPerWeek distinct days",
    `expected 3 days, got ${case0.dayCount} (${case0.days.join(", ")})`,
    "__repforgeGenerateProgram full_body 3-day"
  );
  assert(
    case0.withinBounds && case0.fieldsOk,
    "P5: exercises within session bounds with valid fields",
    `perDay=${case0.perDay.join(",")} fieldsOk=${case0.fieldsOk}`,
    "sessionLength normal → 5–7 exercises per day, name/sets/min/max/primary"
  );
  assert(
    case0.programOk,
    "P5: Program constructor accepts generated output",
    `length=${case0.programOk}`,
    "new Program(__repforgeGenerateProgram(answers)).toJSON().length > 0"
  );

  const machineEquip = await page.evaluate(() => {
    const answers = { goal: "hypertrophy", experience: "beginner", daysPerWeek: 3, splitType: "machine_only", equipment: ["machine"], priorityMuscles: [], sessionLength: "normal" };
    const raw = window.__repforgeGenerateProgram(answers);
    const barbellOnly = ["Barbell back squat", "Barbell bench press", "Barbell row", "Barbell Romanian deadlift", "Barbell incline press", "Barbell overhead press"];
    const hasBarbell = raw.some((e) => barbellOnly.some((n) => e.name === n) || /barbell/i.test(e.name));
    return { count: raw.length, hasBarbell, names: raw.map((e) => e.name) };
  });
  assert(
    !machineEquip.hasBarbell && machineEquip.count > 0,
    "P5: machine-only equipment filter excludes barbell picks",
    `hasBarbell=${machineEquip.hasBarbell} names=${machineEquip.names.slice(0, 4).join(", ")}`,
    "equipment=[machine] → no barbell-only exercises"
  );

  const case2 = genResults[2];
  assert(
    case2.dayCount === 5 && case2.withinBounds,
    "P5: PPL 5-day split respects long session length bounds",
    `days=${case2.dayCount} perDay=${case2.perDay.join(",")}`,
    "daysPerWeek=5 splitType=ppl sessionLength=long → 7–9 per day"
  );

  const pplDays = await page.evaluate(() => {
    const raw = window.__repforgeGenerateProgram({ goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3, splitType: "ppl", equipment: ["machine", "cable"], priorityMuscles: [], sessionLength: "normal" });
    const days = [...new Set(raw.map((e) => e.day))];
    return { dayCount: days.length, exerciseCount: raw.length };
  });
  assert(
    pplDays.dayCount === 3 && pplDays.exerciseCount > 0,
    "P5: PPL generates one day per training slot",
    JSON.stringify(pplDays),
    "splitType=ppl daysPerWeek=3 → Day 1–3"
  );

  const upperLower = genResults[1];
  assert(
    upperLower.dayCount === 4 && upperLower.withinBounds,
    "P5: upper/lower 4-day short session fits 4–5 exercises",
    `perDay=${upperLower.perDay.join(",")}`,
    "upper_lower 4-day sessionLength=short"
  );

  beginPhase("Phase: F4/F5 equipment fidelity and day-type rotation");
  await page.waitForFunction(
    () =>
      typeof window.__repforgeGenerateProgram === "function" &&
      window.__repforgeExerciseCatalog &&
      typeof window.__repforgeEquipmentSupportsSplit === "function" &&
      window.__repforgeOnboarding?.eqUi &&
      typeof window.__repforgeResolveSplit === "function"
  );
  const f45 = await page.evaluate(() => {
    const generate = window.__repforgeGenerateProgram;
    const catalog = window.__repforgeExerciseCatalog;
    const catalogById = new Map(catalog.map((e) => [e.id, e]));
    const EQ_UI = ["machines", "cables", "dumbbells", "barbells"];
    const EQ_GEN = { machines: "machine", cables: "cable", dumbbells: "dumbbell", barbells: "barbell" };
    const DAY_SLOTS = {
      full_body: ["squat", "hinge", "press", "pull", "delts", "arms"],
      upper: ["press", "row", "pulldown", "delts", "chest_iso", "arms"],
      lower: ["squat", "hinge", "leg_curl", "leg_extension", "calves"],
      push: ["press", "incline_press", "shoulder_press", "lateral_raise", "triceps"],
      pull: ["row", "pulldown", "rear_delt", "curl"],
      legs: ["squat", "hinge", "leg_curl", "leg_extension", "adduction", "calves"],
    };
    const EXPECTED_SPLITS = [
      { daysPerWeek: 2, splitType: "full_body", dayTypes: ["full_body", "full_body"] },
      { daysPerWeek: 2, splitType: "upper_lower", dayTypes: ["upper", "lower"] },
      { daysPerWeek: 3, splitType: "full_body", dayTypes: ["full_body", "full_body", "full_body"] },
      { daysPerWeek: 3, splitType: "machine_only", dayTypes: ["full_body", "full_body", "full_body"] },
      { daysPerWeek: 3, splitType: "ppl", dayTypes: ["push", "pull", "legs"] },
      { daysPerWeek: 4, splitType: "upper_lower", dayTypes: ["upper", "lower", "upper", "lower"] },
      { daysPerWeek: 4, splitType: "full_body", dayTypes: ["full_body", "full_body", "full_body", "full_body"] },
      { daysPerWeek: 5, splitType: "ppl", dayTypes: ["push", "pull", "legs", "push", "pull"] },
      { daysPerWeek: 5, splitType: "bro", dayTypes: ["push", "pull", "legs", "push", "pull"] },
      { daysPerWeek: 5, splitType: "upper_lower", dayTypes: ["upper", "lower", "upper", "lower", "upper"] },
      { daysPerWeek: 6, splitType: "ppl", dayTypes: ["push", "pull", "legs", "push", "pull", "legs"] },
    ];
    const FILLER_SLOTS = ["curl", "triceps", "lateral_raise", "chest_iso", "calves", "leg_curl"];
    const SESSION_BOUNDS = { short: [4, 5], normal: [5, 7], long: [7, 9] };
    const MUSCLES = ["Chest", "Back", "Quads", "Hamstrings", "Glutes", "Side delts", "Arms", "Calves"];
    const visible = (rows) =>
      rows.map((e) => ({
        day: e.day,
        order: e.order,
        name: e.name,
        sets: e.sets,
        min: e.min,
        max: e.max,
        primary: e.primary,
        secondary: e.secondary || "",
        notes: e.notes || "",
        libraryId: e.libraryId,
      }));
    const byDay = (rows) => {
      const names = [...new Set(rows.map((e) => e.day))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      return names.map((d) =>
        rows.filter((e) => e.day === d).sort((a, b) => a.order - b.order)
      );
    };
    const slotPool = (slot, equipment) =>
      catalog
        .filter(
          (e) =>
            e.pattern === slot &&
            e.equipment.some((x) => equipment.includes(String(x).toLowerCase()))
        )
        .sort((a, b) => a.id.localeCompare(b.id));
    const pickFromSlot = (slot, equipment, used, occ) => {
      const pool = slotPool(slot, equipment);
      if (!pool.length) return null;
      const n = pool.length;
      const i = ((occ % n) + n) % n;
      const rotated = pool.slice(i).concat(pool.slice(0, i)).filter((e) => !used.has(e.id));
      return rotated[0] || null;
    };
    const dayHasPrimary = (dayType, equipment) =>
      (DAY_SLOTS[dayType] || []).some((slot) => slotPool(slot, equipment).length > 0);
    const splitSupported = (dayTypes, equipment) =>
      dayTypes.every((dt) => dayHasPrimary(dt, equipment));
    const expectedFullDay = (dayType, equipment, occ, sessionLength) => {
      const picks = [];
      const used = new Set();
      for (const slot of DAY_SLOTS[dayType] || []) {
        const entry = pickFromSlot(slot, equipment, used, occ);
        if (!entry) continue;
        used.add(entry.id);
        picks.push({ slot, id: entry.id, phase: "primary" });
      }
      let ids = picks.map((p) => p.id);
      const [lo, hi] = SESSION_BOUNDS[sessionLength] || SESSION_BOUNDS.normal;
      if (ids.length > hi) {
        ids = ids.slice(0, hi);
        picks.length = ids.length;
      }
      const have = new Set(ids);
      while (ids.length < lo) {
        let extra = null;
        for (const slot of FILLER_SLOTS) {
          const entry = pickFromSlot(slot, equipment, have, occ);
          if (!entry) continue;
          extra = { slot, id: entry.id, phase: "filler" };
          break;
        }
        if (!extra) break;
        have.add(extra.id);
        ids.push(extra.id);
        picks.push(extra);
      }
      return { ids, picks };
    };
    const matchesEq = (ex, equipment) => {
      const entry = catalogById.get(ex.libraryId);
      if (!entry) return false;
      return entry.equipment.some((x) => equipment.includes(String(x).toLowerCase()));
    };
    const subsets = (items) => {
      const out = [];
      for (let mask = 1; mask < 1 << items.length; mask++) {
        out.push(items.filter((_, i) => mask & (1 << i)));
      }
      return out;
    };
    const onb = window.__repforgeOnboarding;
    const optionParity = {
      eqUi: JSON.stringify(onb.eqUi) === JSON.stringify(EQ_UI),
      eqGen: EQ_UI.every((k) => onb.eqGen?.[k] === EQ_GEN[k]),
      splits:
        JSON.stringify(
          Object.entries(onb.splits || {}).flatMap(([n, opts]) => opts.map((st) => `${+n}|${st}`))
        ) === JSON.stringify(EXPECTED_SPLITS.map((p) => `${p.daysPerWeek}|${p.splitType}`)),
    };
    const failures = [];
    if (!optionParity.eqUi) failures.push(`eqUi drift: ${JSON.stringify(onb.eqUi)} want ${JSON.stringify(EQ_UI)}`);
    if (!optionParity.eqGen) failures.push(`eqGen drift: ${JSON.stringify(onb.eqGen)}`);
    if (!optionParity.splits) {
      failures.push(
        `split option drift: ${JSON.stringify(onb.splits)} want ${EXPECTED_SPLITS.map((p) => `${p.daysPerWeek}|${p.splitType}`).join(",")}`
      );
    }
    const eqSubsets = subsets(EQ_UI);
    let checked = 0;
    let blocked = 0;
    let generated = 0;
    let supportParity = 0;
    let seqParity = 0;
    let completeOk = 0;
    let rotated = 0;
    let reused = 0;
    let stable = 0;
    let priorityOk = 0;
    const prodSupports = window.__repforgeEquipmentSupportsSplit;
    const prodResolve = window.__repforgeResolveSplit;
    for (const uiEq of eqSubsets) {
      const equipment = uiEq.map((k) => EQ_GEN[k]);
      for (const pair of EXPECTED_SPLITS) {
        checked++;
        const { daysPerWeek, splitType, dayTypes } = pair;
        const label = `${uiEq.join("+")}|${daysPerWeek}|${splitType}`;
        const ok = splitSupported(dayTypes, equipment);
        const prodOk = prodSupports(daysPerWeek, splitType, equipment, "intermediate");
        if (prodOk !== ok) {
          failures.push(`${label}: production support ${prodOk} independent ${ok}`);
        } else supportParity++;
        if (JSON.stringify(prodResolve(daysPerWeek, splitType)) !== JSON.stringify(dayTypes)) {
          failures.push(`${label}: resolveSplit ${JSON.stringify(prodResolve(daysPerWeek, splitType))} want ${JSON.stringify(dayTypes)}`);
        } else seqParity++;
        const answers = {
          goal: "hypertrophy",
          experience: "intermediate",
          daysPerWeek,
          splitType,
          equipment,
          priorityMuscles: [],
          sessionLength: "normal",
        };
        const raw = generate(answers);
        const days = byDay(raw);
        const dayNames = days.map((d) => d[0]?.day);
        const expectedNames = Array.from({ length: daysPerWeek }, (_, i) => `Day ${i + 1}`);
        if (!ok) {
          blocked++;
          if (days.length === daysPerWeek && days.every((d) => d.length)) {
            failures.push(`${label}: blocked combo still produced every training day`);
          }
          continue;
        }
        generated++;
        if (dayNames.join("|") !== expectedNames.join("|")) {
          failures.push(`${label}: day sequence ${dayNames.join(",")} want ${expectedNames.join(",")}`);
          continue;
        }
        if (days.some((d) => !d.length)) failures.push(`${label}: empty day`);
        for (const ex of raw) {
          if (!ex.libraryId || !matchesEq(ex, equipment)) {
            failures.push(`${label}: equipment-invalid ${ex.name} (${ex.libraryId})`);
            break;
          }
        }
        const expectedDays = dayTypes.map((dt, di) =>
          expectedFullDay(dt, equipment, dayTypes.slice(0, di).filter((x) => x === dt).length, "normal")
        );
        let daysMatch = true;
        dayTypes.forEach((dt, di) => {
          const ids = days[di].map((e) => e.libraryId);
          if (new Set(ids).size !== ids.length) {
            failures.push(`${label}: within-day duplicate on ${expectedNames[di]}`);
            daysMatch = false;
          }
          const expected = expectedDays[di].ids;
          if (ids.join("|") !== expected.join("|")) {
            failures.push(`${label}: ${expectedNames[di]} [${ids.join("|")}] want [${expected.join("|")}]`);
            daysMatch = false;
          }
        });
        if (daysMatch) completeOk++;
        const occ = {};
        dayTypes.forEach((dt, i) => {
          (occ[dt] ||= []).push(i);
        });
        for (const [dt, idxs] of Object.entries(occ)) {
          if (idxs.length < 2) continue;
          const slots = [...new Set([...(DAY_SLOTS[dt] || []), ...FILLER_SLOTS])];
          for (const slot of slots) {
            const pool = slotPool(slot, equipment);
            if (!pool.length) continue;
            const modeled = idxs.map((di) => expectedDays[di].picks.filter((p) => p.slot === slot).map((p) => p.id));
            const actual = idxs.map((di) =>
              days[di]
                .map((e) => e.libraryId)
                .filter((id) => catalogById.get(id)?.pattern === slot)
            );
            for (let k = 0; k < idxs.length; k++) {
              if (modeled[k].join("|") !== actual[k].join("|")) {
                failures.push(
                  `${label}: ${dt} occ ${k} slot ${slot} got ${actual[k].join("|") || "∅"} want ${modeled[k].join("|") || "∅"}`
                );
              }
            }
            const firsts = modeled.map((xs) => xs[0] || null);
            const present = firsts.filter(Boolean);
            if (pool.length > 1 && present.length >= 2) {
              if (new Set(present).size > 1) rotated++;
            }
            if (idxs.length > pool.length) {
              const wrap = firsts[pool.length];
              const zero = firsts[0];
              if (zero && wrap === zero) reused++;
            } else if (pool.length === 1 && present.length && present.every((id) => id === pool[0].id)) reused++;
          }
        }
        const vis1 = JSON.stringify(visible(raw));
        const vis2 = JSON.stringify(visible(generate(answers)));
        if (vis1 !== vis2) failures.push(`${label}: unstable visible/library fields`);
        else stable++;
        const withPri = generate({ ...answers, priorityMuscles: MUSCLES });
        const priDays = byDay(withPri);
        const priNames = priDays.map((d) => d[0]?.day);
        if (priNames.join("|") !== expectedNames.join("|")) failures.push(`${label}: priority dropped a day`);
        let priBad = priDays.some((d) => !d.length);
        for (const ex of withPri) {
          if (!ex.libraryId || !matchesEq(ex, equipment)) {
            failures.push(`${label}: priority equipment-invalid ${ex.name}`);
            priBad = true;
            break;
          }
        }
        for (const d of priDays) {
          const ids = d.map((e) => e.libraryId);
          if (new Set(ids).size !== ids.length) {
            failures.push(`${label}: priority within-day duplicate`);
            priBad = true;
          }
        }
        if (!priBad && priNames.join("|") === expectedNames.join("|")) priorityOk++;
      }
    }
    const squatPool = slotPool("squat", ["machine"]);
    const usedAll = new Set(squatPool.map((e) => e.id));
    const exhausted = window.__repforgeChooseExercise("squat", ["machine"], "intermediate", usedAll, 0);
    const skipPri = generate({
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 3,
      splitType: "full_body",
      equipment: ["cable"],
      priorityMuscles: ["Quads"],
      sessionLength: "short",
    });
    return {
      eqUi: window.__repforgeOnboarding?.eqUi,
      subsetCount: eqSubsets.length,
      splitCount: EXPECTED_SPLITS.length,
      checked,
      blocked,
      generated,
      supportParity,
      seqParity,
      completeOk,
      optionParity,
      rotated,
      reused,
      stable,
      priorityOk,
      failures: failures.slice(0, 24),
      failureCount: failures.length,
      exhaustedIsNull: exhausted === null,
      addedLegExt: skipPri.some((e) => e.libraryId === "le_mc" || /leg extension/i.test(e.name)),
      legacyBw: window.__repforgeOnboarding?.eqGen?.bodyweight === "bodyweight",
      bwInUi: (window.__repforgeOnboarding?.eqUi || []).includes("bodyweight"),
      strings: {
        en: window.RepForgeI18n.STRINGS.en["onb.equipment.unsupported"],
        pt: window.RepForgeI18n.STRINGS.pt["onb.equipment.unsupported"],
      },
    };
  });

  assert(
    !f45.bwInUi && f45.eqUi.length === 4 && f45.legacyBw,
    "F4: Bodyweight is absent from new onboarding UI, legacy mapping retained",
    JSON.stringify({ eqUi: f45.eqUi, bwInUi: f45.bwInUi, legacyBw: f45.legacyBw }),
    "ONB_EQ_UI excludes bodyweight; ONB_EQ_GEN.bodyweight still maps"
  );
  assert(
    f45.subsetCount === 15 && f45.splitCount === 11 && f45.checked === 165,
    "F4/F5: matrix covers every non-empty equipment subset and reachable split",
    JSON.stringify({ subsets: f45.subsetCount, splits: f45.splitCount, checked: f45.checked }),
    "4 equipment choices → 15 subsets × 11 fixtured split/day sequences"
  );
  assert(
    f45.optionParity.eqUi && f45.optionParity.eqGen && f45.optionParity.splits,
    "F4: fixtures match exported selectable equipment and split options",
    JSON.stringify(f45.optionParity),
    "eqUi, eqGen mappings, and flattened ONB_SPLITS pairs must equal the independent fixtures"
  );
  assert(
    f45.supportParity === f45.checked && f45.seqParity === f45.checked,
    "F4: production support and resolveSplit equal independently derived expectations for every combo",
    `supportParity=${f45.supportParity} seqParity=${f45.seqParity} checked=${f45.checked} ${f45.failures.join(" | ")}`,
    "__repforgeEquipmentSupportsSplit === independent primary-slot support; resolveSplit === fixtured dayTypes"
  );
  assert(
    f45.failureCount === 0 && f45.generated + f45.blocked === f45.checked && f45.generated > 0 && f45.blocked > 0,
    "F4: every combo generates the fixtured day sequence or is independently unsupported",
    `generated=${f45.generated} blocked=${f45.blocked} failures=${f45.failureCount} ${f45.failures.join(" | ")}`,
    "Catalogue-derived support; allowed cases keep Day 1..N with equipment-valid libraryIds"
  );
  assert(
    f45.completeOk === f45.generated,
    "F5: every generated day's complete ordered libraryId sequence matches independent primary+filler filling",
    `completeOk=${f45.completeOk} generated=${f45.generated} ${f45.failures.join(" | ")}`,
    "FILLER_SLOTS + session bounds modeled independently; includes filler rotation, within-day exhaustion, wrap reuse"
  );
  assert(
    f45.stable === f45.generated && f45.priorityOk === f45.generated,
    "F4/F5: supported combos are deterministic (excluding row ids) and keep equipment-valid priority additions",
    `stable=${f45.stable} priorityOk=${f45.priorityOk} generated=${f45.generated} ${f45.failures.join(" | ")}`,
    "Two generations match visible/library fields; generated ids are unique"
  );
  assert(
    f45.rotated > 0 && f45.reused > 0 && f45.exhaustedIsNull && !f45.addedLegExt,
    "F5: every repeated occurrence rotates, reuses after wrap, and skips unavailable priorities",
    `rotated=${f45.rotated} reused=${f45.reused} exhaustedIsNull=${f45.exhaustedIsNull} addedLegExt=${f45.addedLegExt} ${f45.failures.join(" | ")}`,
    "Per-slot occ k → pool[k % n]; wrap equals occ 0; chooseExercise returns null when the within-day pool is empty"
  );
  assert(
    f45.strings.en === "Choose equipment that supports every training day." &&
      f45.strings.pt === "Escolha equipamentos compatíveis com todos os dias de treino.",
    "F4: unsupported-equipment copy is localized in both dictionaries",
    JSON.stringify(f45.strings),
    "onb.equipment.unsupported EN/PT"
  );

  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
  await page.click('[data-onb-pick="goal"][data-onb-val="hypertrophy"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="experience"][data-onb-val="beginner"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="daysPerWeek"][data-onb-val="2"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="splitType"][data-onb-val="upper_lower"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-onb-pick="equipment"]');
  const eqVals = await page.$$eval("[data-onb-pick='equipment']", (els) =>
    els.map((el) => el.getAttribute("data-onb-val"))
  );
  assert(
    !eqVals.includes("bodyweight") && eqVals.length === 4,
    "F4: equipment step has no Bodyweight choice",
    `vals=${eqVals.join(",")}`,
    "Onboarding step 5 equipment cards"
  );
  async function setEquipOnly(vals) {
    const want = new Set(vals);
    for (const val of eqVals) {
      const selected = await page.locator(`[data-onb-pick="equipment"][data-onb-val="${val}"].is-selected`).count();
      if (want.has(val) !== !!selected) await page.click(`[data-onb-pick="equipment"][data-onb-val="${val}"]`);
    }
  }
  await setEquipOnly(["cables"]);
  await page.waitForSelector("#onbEquipUnsupported", { timeout: 5000 });
  const blockedCopy = ((await page.locator("#onbEquipUnsupported").textContent()) || "").trim();
  const nextDisabled = await page.locator("#onbNext").isDisabled();
  assert(
    nextDisabled && blockedCopy === "Choose equipment that supports every training day.",
    "F4: cables-only upper/lower blocks Continue with the localized explanation",
    `disabled=${nextDisabled} copy="${blockedCopy}"`,
    "2-day upper/lower → cables only → Continue disabled"
  );
  await setEquipOnly([]);
  await page.waitForSelector("#onbEquipUnsupported", { timeout: 5000 });
  const emptyEn = {
    copy: ((await page.locator("#onbEquipUnsupported").textContent()) || "").trim(),
    disabled: await page.locator("#onbNext").isDisabled(),
  };
  assert(
    emptyEn.disabled && emptyEn.copy === "Choose equipment that supports every training day.",
    "F4: deselecting all equipment keeps Continue disabled and shows the explanation",
    JSON.stringify(emptyEn),
    "Equipment step → uncheck every card"
  );
  await page.evaluate(() => window.RepForgeI18n.setLang("pt"));
  await page.click('[data-onb-pick="equipment"][data-onb-val="cables"]');
  await page.click('[data-onb-pick="equipment"][data-onb-val="cables"]');
  const emptyPt = ((await page.locator("#onbEquipUnsupported").textContent()) || "").trim();
  const emptyPtDisabled = await page.locator("#onbNext").isDisabled();
  assert(
    emptyPtDisabled && emptyPt === "Escolha equipamentos compatíveis com todos os dias de treino.",
    "F4: empty-equipment explanation renders in Portuguese",
    `disabled=${emptyPtDisabled} copy="${emptyPt}"`,
    "setLang(pt) → all equipment unchecked"
  );
  await page.click('[data-onb-pick="equipment"][data-onb-val="cables"]');
  const blockedCopyPt = ((await page.locator("#onbEquipUnsupported").textContent()) || "").trim();
  assert(
    blockedCopyPt === "Escolha equipamentos compatíveis com todos os dias de treino.",
    "F4: unsupported-equipment explanation renders in Portuguese",
    `copy="${blockedCopyPt}"`,
    "setLang(pt) → cables-only upper/lower"
  );
  await page.evaluate(() => window.RepForgeI18n.setLang("en"));
  await page.click('[data-onb-pick="equipment"][data-onb-val="machines"]');
  const unblocked = !(await page.locator("#onbNext").isDisabled()) && !(await page.locator("#onbEquipUnsupported").count());
  assert(
    unblocked,
    "F4: adding machines clears the block and enables Continue",
    `disabled=${await page.locator("#onbNext").isDisabled()} warn=${await page.locator("#onbEquipUnsupported").count()}`,
    "cables-only upper/lower → add machines"
  );

  beginPhase("Phase: P6 onboarding UI");
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
  assert(
    await page.locator("#onboarding.active").isVisible(),
    "P6: first-run onboarding is visible on fresh load",
    "onboarding section not active",
    "Clear storage → reload → onboarding overlay shows"
  );
  await page.click('[data-onb-pick="goal"][data-onb-val="hypertrophy"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="experience"][data-onb-val="beginner"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="daysPerWeek"][data-onb-val="3"]');
  await page.click("#onbNext");
  await page.click('[data-onb-pick="splitType"][data-onb-val="full_body"]');
  await page.click("#onbNext");
  await page.click("#onbNext");
  await page.click("#onbNext");
  await page.click('[data-onb-pick="sessionLength"][data-onb-val="normal"]');
  await page.click("#onbNext");
  await page.waitForSelector("#onbSave", { timeout: 5000 });
  await page.click("#onbSave");
  await page.waitForFunction(
    () => !document.querySelector("#onboarding")?.classList.contains("active"),
    { timeout: 8000 }
  );
  state = await getState(page);
  const onbDays = [...new Set(state.program.map((e) => e.day))];
  assert(
    state.programMeta?.onboarded === true,
    "P6: Save program sets onboarded=true",
    `onboarded=${state.programMeta?.onboarded}`,
    "Complete onboarding → Save program"
  );
  assert(
    onbDays.length === state.programMeta?.daysPerWeek,
    "P6: generated program days match daysPerWeek",
    `days=${onbDays.length} expected=${state.programMeta?.daysPerWeek}`,
    "Onboarding review → Save → program day count"
  );
  assert(
    !(await page.locator("#onboarding.active").count()),
    "P6: onboarding hidden after save",
    "onboarding still active",
    "Save program → overlay closes"
  );
  await nav(page, "settings");
  assert(
    (await page.locator("#createProgram").count()) === 1,
    "P6: Settings has Create new program control",
    "createProgram button missing",
    "Settings → Progression card"
  );

  beginPhase("Phase: delta write surfaces");
  await clearState(page);
  await reloadApp(page);
  let deltaState = await getState(page);
  const deltaDay = "Day 1";
  const deltaEx = deltaState.program
    .filter((e) => e.day === deltaDay)
    .sort((a, b) => a.order - b.order)[0];
  const deltaDate = "2026-06-15";
  const sess1 = `${deltaDate}_${deltaDay}_delta_seed`;
  const created1 = `${deltaDate}T10:00:00.000Z`;
  const seedRows = Array.from({ length: deltaEx.sets }, (_, i) => ({
    session: sess1,
    date: deltaDate,
    day: deltaDay,
    name: deltaEx.name,
    exerciseId: deltaEx.id,
    set: i + 1,
    load: 100,
    reps: 8,
    rir: 1,
    notes: "",
    created: created1,
    primary: deltaEx.primary,
    secondary: deltaEx.secondary,
  }));
  await persistState(page, { ...deltaState, log: seedRows });
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, deltaDay);
  await setLogDate(page, deltaDate);
  await fillExerciseSets(page, deltaEx.id, deltaEx.sets, 100, 10, 1);
  const sessionsBeforeDelta = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  deltaState = await getState(page);
  const deltaSession = [...new Set(deltaState.log.map((r) => r.session))].find(
    (s) => !sessionsBeforeDelta.has(s)
  );
  const deltaToast = await page.textContent("#toast");
  assert(
    /improved/i.test(deltaToast),
    "Save toast includes session delta improved summary",
    `Toast: ${deltaToast}`,
    "Seed 100×8 → save 100×10 → toast mentions improved"
  );
  assert(
    /\d+ improved/.test(deltaToast),
    "Save toast delta uses count format",
    `Toast: ${deltaToast}`,
    "Toast should read like '1 improved'"
  );
  const compareImproved = await page.evaluate(
    ({ exId, sid }) => {
      const s = JSON.parse(localStorage.getItem("repforge_v1"));
      const ex = s.program.find((e) => e.id === exId);
      const rows = s.log.filter((r) => r.session === sid);
      return window.__repforgeCompareExercise(ex, rows);
    },
    { exId: deltaEx.id, sid: deltaSession }
  );
  assert(
    compareImproved.status === "improved",
    "Second session compares improved vs seeded session",
    `status=${compareImproved.status}`,
    "persistState seed + UI save with more reps"
  );
  await nav(page, "history");
  const deltaCard = await page.locator(".session").first().textContent();
  assert(
    /improved/i.test(deltaCard),
    "History session card shows delta improved summary",
    `Card: ${deltaCard?.slice(0, 160)}`,
    "History → newest card after improved session"
  );
  assert(
    (await page.locator(".session__delta").count()) > 0,
    "History session card renders session__delta element",
    "No .session__delta on history cards",
    "History → session card includes delta line"
  );

  beginPhase("Phase: command parser");
  const parseCmd = (t) => page.evaluate((x) => window.__repforgeParseCommand(x), t);
  const p80x8 = await parseCmd("80 x 8");
  assert(p80x8.ok && p80x8.load === 80 && p80x8.reps === 8 && p80x8.confidence === "high", "parse: 80 x 8", JSON.stringify(p80x8));
  const p80for8 = await parseCmd("80 for 8");
  assert(p80for8.ok && p80for8.load === 80 && p80for8.reps === 8 && p80for8.confidence === "high", "parse: 80 for 8", JSON.stringify(p80for8));
  const p808 = await parseCmd("80 8");
  assert(p808.ok && p808.load === 80 && p808.reps === 8 && p808.confidence === "low", "parse: 80 8 fallback", JSON.stringify(p808));
  const pRir = await parseCmd("80 x 8 rir 1");
  assert(pRir.ok && pRir.load === 80 && pRir.reps === 8 && pRir.rir === 1, "parse: 80 x 8 rir 1", JSON.stringify(pRir));
  const pAt = await parseCmd("80 x 8 @1");
  assert(pAt.ok && pAt.load === 80 && pAt.reps === 8 && pAt.rir === 1, "parse: 80 x 8 @1", JSON.stringify(pAt));
  const pSet2 = await parseCmd("set 2 80 x 8");
  assert(pSet2.ok && pSet2.set === 2 && pSet2.load === 80 && pSet2.reps === 8, "parse: set 2 80 x 8", JSON.stringify(pSet2));
  const pS2 = await parseCmd("s2 80x8");
  assert(pS2.ok && pS2.set === 2 && pS2.load === 80 && pS2.reps === 8, "parse: s2 80x8", JSON.stringify(pS2));
  const pEasy = await parseCmd("80 for 8 easy");
  assert(pEasy.ok && pEasy.load === 80 && pEasy.reps === 8 && pEasy.effort === "easy", "parse: 80 for 8 easy", JSON.stringify(pEasy));
  const pHard = await parseCmd("80 for 8 hard");
  assert(pHard.ok && pHard.load === 80 && pHard.reps === 8 && pHard.effort === "hard", "parse: 80 for 8 hard", JSON.stringify(pHard));
  const pMax = await parseCmd("80 for 8 max");
  assert(pMax.ok && pMax.load === 80 && pMax.reps === 8 && pMax.effort === "max", "parse: 80 for 8 max", JSON.stringify(pMax));
  const pDec = await parseCmd("80.5 x 8");
  assert(pDec.ok && pDec.load === 80.5 && pDec.reps === 8, "parse: 80.5 x 8 decimal", JSON.stringify(pDec));
  const pLb = await parseCmd("180 lb x 8");
  assert(pLb.ok && pLb.load === 180 && pLb.reps === 8 && pLb.unit === "lb", "parse: 180 lb x 8", JSON.stringify(pLb));
  const pBad = await parseCmd("not a set");
  assert(!pBad.ok && pBad.error === "Could not read a set from that.", "parse: invalid text", JSON.stringify(pBad));
  const pNoReps = await parseCmd("80");
  assert(!pNoReps.ok && pNoReps.error === "Could not find reps.", "parse: load only", JSON.stringify(pNoReps));

  beginPhase("Phase: spoken set apply");
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const cmdEx0 = await page.evaluate(() => document.querySelector("#workout .exercise")?.dataset.ex);
  assert(cmdEx0, "spoken set: first exercise present", "no .exercise on Log tab", "Open Log with program loaded");
  const applyCmd = (t) => page.evaluate((x) => window.__repforgeApplyCommandText(x), t);
  const applied1 = await applyCmd("80 x 8 @1");
  await page.waitForTimeout(120);
  assert(
    applied1 === true &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)) === "80" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)) === "8" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_rir"]`)) === "1",
    "spoken set: 80 x 8 @1 fills set 1",
    `applied=${applied1} load=${await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)} rir=${await page.inputValue(`[data-k="${cmdEx0}_1_rir"]`)}`,
    "Log → say 80 x 8 @1 → set 1 inputs updated"
  );
  await applyCmd("set 2 60 x 10");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_2_load"]`)) === "60" &&
      (await page.inputValue(`[data-k="${cmdEx0}_2_reps"]`)) === "10",
    "spoken set: set 2 60 x 10 targets set 2",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_2_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_2_reps"]`)}`,
    "Log → say set 2 60 x 10 → set 2 inputs updated"
  );
  const appliedBad = await applyCmd("not a set");
  await page.waitForTimeout(120);
  const cmdBadToast = await page.locator("#toast").textContent();
  assert(
    appliedBad === false && cmdBadToast.includes("Could not read"),
    "spoken set: unparseable text shows error toast",
    `applied=${appliedBad} toast=${cmdBadToast}`,
    "Log → say nonsense → error toast, no crash"
  );

  assert(
    (await page.locator("#commandInput").count()) === 0 &&
      (await page.locator("#commandApply").count()) === 0 &&
      (await page.locator("#commandBarWrap").count()) === 0,
    "quick-entry text field removed from the Log surface",
    `input=${await page.locator("#commandInput").count()} apply=${await page.locator("#commandApply").count()} wrap=${await page.locator("#commandBarWrap").count()}`,
    "Log tab → no free-text command bar in the redesign"
  );

  beginPhase("Phase: voice input settings");
  let voiceState = await getState(page);
  assert(
    voiceState.settings.voiceInputEnabled === false && voiceState.settings.commandParserHints === undefined,
    "voice settings default on fresh load",
    JSON.stringify({ voiceInputEnabled: voiceState.settings.voiceInputEnabled, commandParserHints: voiceState.settings.commandParserHints }),
    "Clear state → reload → voiceInputEnabled false, commandParserHints absent"
  );
  await persistState(page, { ...voiceState, settings: { ...voiceState.settings, voiceInputEnabled: true } });
  await page.addInitScript(() => {
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
  });
  await reloadApp(page);
  assert(
    await page.evaluate(() => {
      const b = document.querySelector("#voiceBtn");
      return !b || b.classList.contains("hidden");
    }),
    "voice button hidden without SpeechRecognition",
    "voiceBtn visible in headless Chromium",
    "Enable voice setting → headless browser → mic stays hidden"
  );
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.evaluate((x) => window.__repforgeApplyCommandText(x), "75 x 7 @1");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)) === "75" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)) === "7",
    "spoken set still applies with voice setting enabled",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)}`,
    "Log → enable voice (unsupported) → apply 75 x 7 @1"
  );

  beginPhase("Phase: P16 review tab");
  const reviewStarted = isoDateFromWeeksAgo(3);
  await persistState(page, {
    ...state,
    programMeta: { ...state.programMeta, started: reviewStarted, mesocycleLengthWeeks: 6 },
  });
  await reloadApp(page);
  state = await getState(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="review"]');
  await page.waitForTimeout(80);
  const reviewSegActive = await page.evaluate(() => {
    const seg = document.querySelector("#segReview");
    const btn = document.querySelector('#statsSeg button[data-seg="review"]');
    return seg?.classList.contains("active") && btn?.classList.contains("active");
  });
  assert(
    reviewSegActive,
    "P16: Review segment activates on click",
    `reviewSegActive=${reviewSegActive}`,
    "Stats → click Review → #segReview active"
  );
  const reviewPanelText = await page.locator("#reviewPanel").textContent();
  assert(
    /Week/.test(reviewPanelText),
    "P16: review panel shows Week progress",
    reviewPanelText?.slice(0, 160),
    "Stats → Review → #reviewPanel includes Week"
  );
  assert(
    /Sessions/.test(reviewPanelText) && /completed/.test(reviewPanelText),
    "P16: review panel shows sessions completed",
    reviewPanelText?.slice(0, 200),
    "Stats → Review → sessions line in #reviewPanel"
  );
  const plainReview = await page.evaluate(() => {
    const snap = window.__repforgeBlockSnapshot(state.programMeta, state.log);
    const summary = window.__repforgeBuildPlainSummary(snap);
    return { weekCurrent: snap.weekCurrent, summary };
  });
  assert(
    plainReview.weekCurrent != null && plainReview.weekCurrent >= 3,
    "P16: blockSnapshot includes week current from start date",
    JSON.stringify(plainReview),
    "__repforgeBlockSnapshot → weekCurrent from programMeta.started"
  );
  assert(
    typeof plainReview.summary === "string" && plainReview.summary.length > 20,
    "P16: buildPlainSummary returns non-empty paragraph",
    plainReview.summary?.slice(0, 120),
    "__repforgeBuildPlainSummary(__repforgeBlockSnapshot(...)) → string"
  );
  const summaryInPanel = await page.locator(".review__summary").textContent();
  assert(
    summaryInPanel && summaryInPanel.length > 20,
    "P16: review panel renders plain summary paragraph",
    summaryInPanel?.slice(0, 120),
    "Stats → Review → .review__summary visible"
  );

  beginPhase("Phase: strength dashboard (P12)");
  await clearState(page);
  await reloadApp(page);
  await seedHistoricalLog(page);
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="strength"]');
  await page.waitForTimeout(80);
  assert(
    (await page.locator("#strengthDash table").count()) > 0,
    "Strength dashboard renders a table",
    "No table inside #strengthDash",
    "Stats → Strength segment → #strengthDash table"
  );
  const dashRows = await page.locator("#strengthDash table tbody tr").count();
  assert(
    dashRows > 0,
    "Strength dashboard table has data rows",
    `row count=${dashRows}`,
    "Stats → Strength → table rows for logged lifts"
  );
  const dashData = await page.evaluate(() => window.__repforgeStrengthDashboard());
  assert(
    Array.isArray(dashData) && dashData.length > 0,
    "__repforgeStrengthDashboard returns non-empty array",
    `type=${typeof dashData} len=${dashData?.length}`,
    "page.evaluate window.__repforgeStrengthDashboard()"
  );
  const dashFields = ["exercise", "latest", "best", "blockDelta", "prs", "lastTrained", "signal"];
  const dashSample = dashData[0];
  assert(
    dashFields.every((f) => f in dashSample),
    "Strength dashboard row includes expected fields",
    `keys=${Object.keys(dashSample).join(",")}`,
    "__repforgeStrengthDashboard()[0] field shape"
  );
  assert(
    typeof dashSample.exercise === "string" &&
      typeof dashSample.latest === "string" &&
      Number.isFinite(dashSample.best) &&
      Number.isFinite(dashSample.blockDelta) &&
      Number.isFinite(dashSample.prs),
    "Strength dashboard field types are sensible",
    JSON.stringify(dashSample),
    "__repforgeStrengthDashboard()[0] value types"
  );

  beginPhase("Phase: volume dashboard (P13)");
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="volume"]');
  await page.waitForTimeout(80);
  const volSegActive = await page.evaluate(() => document.querySelector("#segVolume")?.classList.contains("active"));
  assert(
    volSegActive,
    "Volume segment activates on click",
    `volSegActive=${volSegActive}`,
    "Stats → click Volume → #segVolume active"
  );
  assert(
    (await page.locator("#volumeDash table").count()) > 0,
    "#volumeDash table exists",
    "No table in #volumeDash",
    "Stats → Volume segment → volume dashboard table"
  );
  const volRowCount = await page.locator("#volumeDash table tbody tr").count();
  assert(
    volRowCount > 0,
    "Volume dashboard has muscle rows",
    `rowCount=${volRowCount}`,
    "Stats → Volume → table has tbody rows"
  );
  const volStatuses = await page.evaluate(() => {
    const th = [...document.querySelectorAll("#volumeDash th")].map((t) => t.textContent);
    const idx = th.indexOf("Status");
    if (idx < 0) return [];
    return [...document.querySelectorAll("#volumeDash tbody tr")].map((tr) => tr.cells[idx]?.textContent);
  });
  const validStatus = new Set(["Low", "On target", "High"]);
  assert(
    volStatuses.length > 0 && volStatuses.every((s) => validStatus.has(s)),
    "Status column values are Low, On target, or High",
    `statuses=${volStatuses.slice(0, 5).join(",")}`,
    "Stats → Volume → Status column in {Low, On target, High}"
  );
  const volDashApi = await page.evaluate(() => {
    const fn = window.__repforgeVolumeDashboard;
    if (!fn) return { ok: false, reason: "hook missing" };
    const rows = fn(7);
    if (!Array.isArray(rows) || !rows.length) return { ok: false, reason: "empty" };
    const fields = ["muscle", "planned", "completed7", "completed28", "status"];
    const ok = rows.every((r) => fields.every((f) => f in r));
    return { ok, sample: rows[0] };
  });
  assert(
    volDashApi.ok,
    "window.__repforgeVolumeDashboard(7) returns rows with required fields",
    JSON.stringify(volDashApi),
    "page.evaluate __repforgeVolumeDashboard(7) after logging"
  );

  beginPhase("Phase: PR timeline (P14)");
  await page.click('#statsSeg button[data-seg="prs"]');
  await page.waitForTimeout(80);
  const prSegActive = await page.evaluate(() => document.querySelector("#segPRs")?.classList.contains("active"));
  assert(
    prSegActive,
    "PRs segment activates on click",
    `segPRs active=${prSegActive}`,
    "Stats → click PRs → #segPRs.active"
  );
  const timelineCount = await page.locator("#prTimeline .prtl__row").count();
  assert(
    timelineCount > 0,
    "PR timeline renders entries after logging",
    `row count=${timelineCount}`,
    "Stats → PRs → #prTimeline has .prtl__row entries"
  );
  await page.click('#prFilterSeg button[data-prf="load"]');
  await page.waitForTimeout(80);
  const loadFilterUi = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#prTimeline .prtl__row")];
    const active = document.querySelector('#prFilterSeg button[data-prf="load"]')?.classList.contains("active");
    return { count: rows.length, allLoad: rows.length === 0 || rows.every((r) => !!r.querySelector(".pr-kind--load")), active };
  });
  assert(
    loadFilterUi.active && loadFilterUi.count > 0 && loadFilterUi.allLoad,
    "Load filter shows only load PRs in timeline",
    JSON.stringify(loadFilterUi),
    "Stats → PRs → Load filter → timeline rows are Load PR only"
  );
  const loadPrApi = await page.evaluate(() => window.__repforgePrTimeline("load"));
  assert(
    loadPrApi.length > 0 && loadPrApi.every((e) => e.kind === "load"),
    "__repforgePrTimeline(load) returns only load PR events",
    `count=${loadPrApi.length} kinds=${[...new Set(loadPrApi.map((e) => e.kind))].join(",")}`,
    "page.evaluate window.__repforgePrTimeline('load')"
  );
  const allPrApi = await page.evaluate(() => window.__repforgePrTimeline("all"));
  assert(
    allPrApi.length >= loadPrApi.length,
    "__repforgePrTimeline(all) includes at least as many events as load filter",
    `all=${allPrApi.length} load=${loadPrApi.length}`,
    "page.evaluate __repforgePrTimeline('all') vs ('load')"
  );

  beginPhase("\nPhase: delta browse surfaces");
  await nav(page, "log");
  const browseDay = "Day 1";
  await selectDay(page, browseDay);
  const browseExs = await getExerciseMeta(page, browseDay);
  const browseEx = browseExs[0];
  await setLogDate(page, "2026-01-15");
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 8, 2);
  await saveWorkout(page);
  await setLogDate(page, "2026-01-16");
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 10, 2);
  await saveWorkout(page);
  await nav(page, "stats");
  await page.evaluate(() => {
    document.querySelector("#statsDeep").open = true;
  });
  await page.waitForTimeout(150);
  const recentDeltasEl = await page.$("#recentDeltas table");
  assert(
    recentDeltasEl,
    "Recent session deltas table renders in statsDeep",
    "Missing #recentDeltas table",
    "Stats → Dig deeper → Recent session deltas"
  );
  const recentDeltasText = await page.textContent("#recentDeltas");
  assert(
    /Improved|Flat|New|Regressed|Changed load/.test(recentDeltasText || ""),
    "Recent deltas table includes a status label",
    `Content: ${(recentDeltasText || "").slice(0, 240)}`,
    "Seed 2+ comparable sessions with working sets"
  );
  await nav(page, "log");
  await selectDay(page, browseDay);
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 12, 2);
  await page.waitForTimeout(100);
  const deltaPreview = await page
    .locator(`[data-ex="${browseEx.id}"] .delta-prev`)
    .textContent()
    .catch(() => "");
  assert(
    /vs last:/.test(deltaPreview || ""),
    "Log tab live delta preview vs last session",
    `Preview: ${deltaPreview || "(empty)"}`,
    "Enter draft kg/reps for an exercise with prior sessions"
  );

  beginPhase("\nPhase: program day collapse");
  await nav(page, "program");
  const collapseDay = await page.locator("#programEditor .pday").first().getAttribute("data-day");
  const expandedVisible = await page
    .locator(`#programEditor .pday[data-day="${collapseDay}"] .pexlist`)
    .isVisible();
  assert(
    expandedVisible,
    "Program days start expanded",
    `Exercise list not visible for ${collapseDay}`,
    "Program tab → first day card"
  );
  await page.click(`#programEditor .pday[data-day="${collapseDay}"] [data-act="toggleDay"]`);
  await page.waitForTimeout(120);
  const collapsedHidden = await page
    .locator(`#programEditor .pday[data-day="${collapseDay}"] .pexlist`)
    .isHidden();
  assert(
    collapsedHidden,
    "Toggling a day collapses its exercise list",
    `Exercise list still visible for ${collapseDay}`,
    "Program tab → day card → caret button"
  );
  const collapseAria = await page.getAttribute(
    `#programEditor .pday[data-day="${collapseDay}"] [data-act="toggleDay"]`,
    "aria-expanded"
  );
  assert(
    collapseAria === "false",
    "Collapse caret reports aria-expanded=false",
    `aria-expanded=${collapseAria}`,
    "Program tab → day card → caret button"
  );
  const collapsePref = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").collapsedProgramDays || [];
    } catch {
      return [];
    }
  });
  assert(
    collapsePref.includes(collapseDay),
    "Collapsed day is stored in UI prefs",
    `Prefs: ${JSON.stringify(collapsePref)}`,
    "Collapse a day → inspect localStorage repforge_ui_v1"
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#log.view.active", { timeout: 8000 });
  await nav(page, "program");
  const stillCollapsed = await page
    .locator(`#programEditor .pday[data-day="${collapseDay}"]`)
    .evaluate((el) => el.classList.contains("is-collapsed"));
  assert(
    stillCollapsed,
    "Collapsed day survives a reload",
    `${collapseDay} re-rendered expanded`,
    "Collapse a day → reload → Program tab"
  );
  await page.click(`#programEditor .pday[data-day="${collapseDay}"] [data-act="toggleDay"]`);
  await page.waitForTimeout(120);

  beginPhase("\nPhase: exercise session notes + exercise page");
  await nav(page, "log");
  const noteDay = "Day 1";
  await selectDay(page, noteDay);
  const noteExs = await getExerciseMeta(page, noteDay);
  const noteEx = noteExs[0];
  const noteExName = (
    await page.textContent(`#workout [data-ex="${noteEx.id}"] .ex__name`)
  ).trim();
  const NOTE_TEXT = "Seat 4, pin 6, wide grip";
  // The exercise page lists only the 8 most recent sessions for the lift —
  // a months-old date falls out of the window once a year of history exists.
  await setLogDate(page, isoDateFromWeeksAgo(0));
  await fillExerciseSets(page, noteEx.id, noteEx.sets, 90, 8, 2);
  await page.click(`[data-exnote-toggle="${noteEx.id}"]`);
  await page.fill(`[data-exnote="${noteEx.id}"]`, NOTE_TEXT);
  await page.waitForTimeout(120);
  const noteDraft = await page.evaluate((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "{}").__exnotes || {};
    } catch {
      return {};
    }
  }, DRAFT);
  assert(
    noteDraft[noteEx.id] === NOTE_TEXT,
    "Exercise note is kept in the draft",
    `Draft notes: ${JSON.stringify(noteDraft)}`,
    "Log tab → exercise card → Note → type"
  );
  const noteSessionsBeforeSave = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  const noteState = await getState(page);
  const savedNoteRows = noteState.log.filter(
    (r) => r.exerciseId === noteEx.id && !noteSessionsBeforeSave.has(r.session)
  );
  assert(
    savedNoteRows.length > 0 && savedNoteRows.every((r) => r.exNote === NOTE_TEXT),
    "Saved log rows carry the exercise note",
    `Rows: ${JSON.stringify(savedNoteRows.map((r) => r.exNote))}`,
    "Log a session with an exercise note → inspect state.log"
  );
  const notePrefill = await page.inputValue(`[data-exnote="${noteEx.id}"]`);
  assert(
    notePrefill === NOTE_TEXT,
    "Next session prefills the last exercise note",
    `Prefill: "${notePrefill}"`,
    "Save a session with a note → note field for that exercise"
  );
  await page.click(`#workout [data-ex="${noteEx.id}"] .ex__namebtn`);
  await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
  const exDetailText = await page.textContent("#exDetail");
  assert(
    exDetailText.includes(noteExName),
    "Exercise page shows the exercise name",
    `Content: ${(exDetailText || "").slice(0, 200)}`,
    "Log tab → tap an exercise name"
  );
  assert(
    /sessions/i.test(exDetailText) && /best e1rm/i.test(exDetailText),
    "Exercise page shows summary metrics",
    `Content: ${(exDetailText || "").slice(0, 300)}`,
    "Log tab → tap an exercise name"
  );
  const exSessionNote = await page.textContent(".exsessions");
  assert(
    exSessionNote.includes(NOTE_TEXT),
    "Exercise page shows the session note",
    `Session history: ${(exSessionNote || "").slice(0, 300)}`,
    "Log a note → tap the exercise name → Session history"
  );
  const exChart = await page.$("#exChart");
  assert(exChart, "Exercise page renders its chart canvas", "Missing #exChart", "Exercise page");
  const navActiveWhileDetail = await page.$$eval("nav button.active", (b) => b.length);
  assert(
    navActiveWhileDetail === 0,
    "No bottom-nav tab is marked active on the exercise page",
    `Active nav buttons: ${navActiveWhileDetail}`,
    "Open the exercise page → inspect nav"
  );
  await page.click("#exBack");
  await page.waitForSelector("#log.view.active", { timeout: 5000 });
  assert(
    await page.locator('nav button[data-view="log"].active').count(),
    "Back from the exercise page restores the Log tab",
    "Log tab not active after Back",
    "Exercise page → Back"
  );
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#dataBackupPanel")?.classList.add("is-open"));
  await page.waitForSelector("#dataBackupPanel.is-open", { timeout: 3000 });
  const noteCsvPath = join(tmpDir, "log-notes.csv");
  const [noteCsvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportCsv"),
  ]);
  await noteCsvDownload.saveAs(noteCsvPath);
  const noteCsv = readFileSync(noteCsvPath, "utf8");
  assert(
    noteCsv.split("\n")[0].includes("exercise_note"),
    "CSV export includes an exercise_note column",
    `Header: ${noteCsv.split("\n")[0]}`,
    "Settings → Export log CSV"
  );
  assert(
    noteCsv.includes(NOTE_TEXT),
    "CSV export carries the exercise note value",
    "NOTE_TEXT missing from CSV body",
    "Log a note → Settings → Export log CSV"
  );

  beginPhase("Phase: F7 load validation");
  await clearState(page);
  await reloadApp(page);

  const parserKinds = await page.evaluate(({ nearKg, nearLb, exactLb }) => {
    const p = window.__repforgeParseLoad;
    if (typeof p !== "function") return null;
    const rows = [];
    for (const unit of ["kg", "lb"]) {
      const cases = [
        ["empty", "", "empty"],
        ["whitespace", "  ", "empty"],
        ["malformed", "abc", "invalid"],
        ["malformed-dots", "12.5.5", "invalid"],
        ["non-positive-zero", "0", "invalid"],
        ["non-positive-neg", "-50", "invalid"],
        ["exponent", "1e5", "invalid"],
        ["comma-decimal", "12,5", "valid"],
        ["exact-limit", unit === "lb" ? exactLb : "1000", "valid"],
        ["near-over-limit", unit === "lb" ? nearLb : nearKg, "invalid"],
        ["over-limit", unit === "lb" ? "2205" : "1000.01", "invalid"],
      ];
      for (const [name, raw, kind] of cases) rows.push({ unit, name, raw, got: p(raw, unit), kind });
    }
    return rows;
  }, { nearKg: NEAR_OVER_KG, nearLb: NEAR_OVER_LB, exactLb: EXACT_LIMIT_LB });
  assert(!!parserKinds, "parseLoadInput is exposed for harness checks", "window.__repforgeParseLoad missing");
  if (parserKinds) {
    for (const row of parserKinds) {
      const okKind = row.got?.kind === row.kind;
      const kgOk = row.kind !== "valid" || Number.isFinite(row.got.kg);
      assert(okKind && kgOk, `parser ${row.unit} ${row.name} → ${row.kind}`, JSON.stringify(row.got));
      if (row.name === "comma-decimal" && row.kind === "valid") {
        const expect = row.unit === "lb" ? 12.5 / LB_CONV : 12.5;
        assert(Math.abs(row.got.kg - expect) < 1e-9, `parser ${row.unit} comma-decimal kg`, `kg=${row.got.kg}`);
      }
      if (row.name === "exact-limit" && row.kind === "valid") {
        assert(row.got.kg === 1000, `parser ${row.unit} exact-limit equals 1000 kg`, `kg=${row.got.kg}`);
      }
    }
  }

  for (const lang of ["en", "pt"]) {
    for (const unit of ["kg", "lb"]) {
      await setLangUnit(page, lang, unit);
      await nav(page, "log");
      await selectDay(page, "Day 1");
      const meta = await getExerciseMeta(page, "Day 1");
      const exId = meta[0].id;
      const setKey = `${exId}_1`;
      const toasts = LOAD_TOAST[lang];
      const cases = loadCases(unit);
      const rejects = cases.filter((x) => x.reject);

      await seedF7History(page, 80);
      await openF7HistoryEdit(page);

      for (const c of rejects) {
        const expectToast = c.empty ? toasts.empty : toasts.invalid;

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, c.raw);
        await hideToast(page);
        const beforeSet = await logJson(page);
        await page.click(`.saveset[data-save="${setKey}"]`);
        const toastSet = await readToast(page);
        const doneCls = await page.getAttribute(`.setrow[data-set="${setKey}"]`, "class");
        assert(
          toastSet === expectToast && !(doneCls || "").includes("is-done") && (await logJson(page)) === beforeSet,
          `per-set ${lang}/${unit} ${c.name} rejects`,
          `toast="${toastSet}" class="${doneCls}"`,
          `Log → type ${c.raw || "(empty)"} → Save set`
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await hideToast(page);
        const beforeSave = await logJson(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        const toastSave = await readToast(page);
        assert(
          toastSave === expectToast && (await logJson(page)) === beforeSave,
          `final-save ${lang}/${unit} ${c.name} aborts`,
          `toast="${toastSave}"`,
          `Log → type ${c.raw || "(empty)"} on a touched set → Save workout`
        );

        await openF7HistoryEdit(page);
        await fillNamed(page, '.session--edit [data-ek^="load|"]', c.raw);
        await hideToast(page);
        const beforeEdit = await logJson(page);
        await page.locator("[data-edsave]").first().click();
        const toastEdit = await readToast(page);
        const stillSeed = (await getState(page)).log.find((r) => r.session === "f7-edit-seed");
        assert(
          toastEdit === expectToast && (await logJson(page)) === beforeEdit && stillSeed && +stillSeed.load === 80,
          `history-edit ${lang}/${unit} ${c.name} aborts`,
          `toast="${toastEdit}" load=${stillSeed?.load}`,
          `History → Edit → type ${c.raw || "(empty)"} → Save`
        );
      }

      for (const c of cases.filter((x) => !x.reject)) {
        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await hideToast(page);
        await page.click(`.saveset[data-save="${setKey}"]`);
        const doneOk = (await page.getAttribute(`.setrow[data-set="${setKey}"]`, "class") || "").includes("is-done");
        const beforePerLen = ((await getState(page)).log || []).length;
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        await page.waitForFunction(({ k, n }) => {
          try { return (JSON.parse(localStorage.getItem(k) || "{}").log || []).length > n; }
          catch { return false; }
        }, { k: KEY, n: beforePerLen }, { timeout: 5000 }).catch(() => {});
        const afterPer = (await getState(page)).log || [];
        const savedPer = afterPer.filter((r) => r.exerciseId === exId).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
        assert(
          doneOk && afterPer.length > beforePerLen && loadMatches(c, savedPer?.load),
          `per-set ${lang}/${unit} ${c.name} persists`,
          `done=${doneOk} load=${savedPer?.load} len ${beforePerLen}→${afterPer.length}`,
          `Log → type ${c.raw} → Save set → Save workout`
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        const beforeFinalLen = ((await getState(page)).log || []).length;
        await fillNamed(page, `[data-k="${setKey}_load"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await hideToast(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        await page.waitForFunction(({ k, n }) => {
          try { return (JSON.parse(localStorage.getItem(k) || "{}").log || []).length > n; }
          catch { return false; }
        }, { k: KEY, n: beforeFinalLen }, { timeout: 5000 }).catch(() => {});
        const afterFinal = (await getState(page)).log || [];
        const savedFinal = afterFinal.filter((r) => r.exerciseId === exId).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
        assert(
          afterFinal.length > beforeFinalLen && loadMatches(c, savedFinal?.load),
          `final-save ${lang}/${unit} ${c.name} persists`,
          `load=${savedFinal?.load} len ${beforeFinalLen}→${afterFinal.length}`,
          `Log → type ${c.raw} on a touched set → Save workout`
        );

        await seedF7History(page, 80);
        await openF7HistoryEdit(page);
        await fillNamed(page, '.session--edit [data-ek^="load|"]', c.raw);
        await hideToast(page);
        await page.locator("[data-edsave]").first().click();
        await page.waitForFunction(() => {
          const el = document.querySelector("#toast");
          return el && !el.classList.contains("hidden") && /updated|atualizada/i.test(el.textContent || "");
        }, { timeout: 4000 }).catch(() => {});
        const edited = (await getState(page)).log.find((r) => r.session === "f7-edit-seed");
        assert(
          loadMatches(c, edited?.load),
          `history-edit ${lang}/${unit} ${c.name} persists`,
          `load=${edited?.load}`,
          `History → Edit → type ${c.raw} → Save`
        );
      }

      if (lang === "en" && unit === "kg") {
        const wiped = await getState(page);
        wiped.log = [];
        await persistState(page, wiped);
        await reloadApp(page);
        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await page.click(`.saveset[data-save="${setKey}"]`);
        const beforeAtomic = await logJson(page);
        await fillNamed(page, `[data-k="${exId}_2_load"]`, "1e5");
        await fillNamed(page, `[data-k="${exId}_2_reps"]`, "5");
        await hideToast(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        const toastAtomic = await readToast(page);
        assert(
          toastAtomic === toasts.invalid && (await logJson(page)) === beforeAtomic,
          "final-save aborts atomically when a touched row is invalid",
          `toast="${toastAtomic}"`,
          "Commit set 1 at 80 kg, type 1e5 on set 2, Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await page.click(`.saveset[data-save="${setKey}"]`);
        await fillNamed(page, `[data-k="${exId}_2_load"]`, "");
        await hideToast(page);
        const beforeEmpty = await logJson(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        const toastEmptyTouched = await readToast(page);
        assert(
          toastEmptyTouched === toasts.empty && (await logJson(page)) === beforeEmpty,
          "final-save empty touched row uses the empty-weight toast",
          `toast="${toastEmptyTouched}"`,
          "Commit set 1, clear set 2 (touched), Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await page.click(`.saveset[data-save="${setKey}"]`);
        await page.click(`[data-warm="${exId}_2"]`);
        await fillNamed(page, `[data-k="${exId}_2_load"]`, "abc");
        await hideToast(page);
        const beforeWarm = await logJson(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        const toastWarm = await readToast(page);
        assert(
          toastWarm === toasts.invalid && (await logJson(page)) === beforeWarm,
          "final-save aborts atomically when a warm-up row is invalid",
          `toast="${toastWarm}"`,
          "Commit set 1, mark set 2 warm-up with abc, Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_load"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_reps"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await page.click(`.saveset[data-save="${setKey}"]`);
        const beforeBlank = ((await getState(page)).log || []).length;
        await hideToast(page);
        await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
        await page.waitForFunction(({ k, n }) => {
          try { return (JSON.parse(localStorage.getItem(k) || "{}").log || []).length > n; }
          catch { return false; }
        }, { k: KEY, n: beforeBlank }, { timeout: 5000 }).catch(() => {});
        const afterBlank = ((await getState(page)).log || []).filter((r) => r.exerciseId === exId);
        assert(
          afterBlank.length === 1 && +afterBlank[0].load === 80,
          "untouched blank workout rows stay ignorable on final save",
          `rows=${JSON.stringify(afterBlank.map((r) => ({ set: r.set, load: r.load })))}`,
          "Commit set 1, leave set 2 untouched, Save workout"
        );
      }
    }
  }
  beginPhase("Phase: presentation audit (F6/F9/F10/C1)");
  await page.setViewportSize({ width: 390, height: 844 });

  const contrastAudit = await page.evaluate(() => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const hexToRgb = (hex) => {
      const n = parseInt(String(hex).replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const contrastHex = (a, b) => {
      const [r1, g1, b1] = hexToRgb(a);
      const [r2, g2, b2] = hexToRgb(b);
      const L1 = lum(r1, g1, b1);
      const L2 = lum(r2, g2, b2);
      const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
      return (hi + 0.05) / (lo + 0.05);
    };
    const root = getComputedStyle(document.documentElement);
    const token = (n) => root.getPropertyValue(n).trim();
    const rules = [];
    for (const sheet of document.styleSheets) {
      let cssRules;
      try {
        cssRules = [...sheet.cssRules];
      } catch {
        continue;
      }
      for (const r of cssRules) {
        if (!r.selectorText || !r.style) continue;
        rules.push({
          sel: r.selectorText,
          color: r.style.getPropertyValue("color"),
          bg: r.style.getPropertyValue("background-color") || r.style.getPropertyValue("background"),
          outline: r.style.getPropertyValue("outline") || r.style.getPropertyValue("outline-color"),
          opacity: r.style.getPropertyValue("opacity"),
          cursor: r.style.getPropertyValue("cursor"),
          minWidth: r.style.getPropertyValue("min-width"),
        });
      }
    }
    const hasSel = (sel) =>
      rules.filter((r) => r.sel.split(",").map((s) => s.trim()).includes(sel));
    return {
      accent: token("--accent"),
      accentText: token("--accent-text"),
      inkFaint: token("--ink-faint"),
      bg: token("--bg"),
      surface: token("--surface"),
      contrastFaintBg: contrastHex(token("--ink-faint"), token("--bg")),
      contrastFaintWhite: contrastHex(token("--ink-faint"), token("--surface")),
      contrastAccentTextBg: contrastHex(token("--accent-text"), token("--bg")),
      contrastAccentTextWhite: contrastHex(token("--accent-text"), token("--surface")),
      ctaAfter: hasSel(".btn--cta::after").map((r) => r.color),
      backLink: rules.filter((r) => r.sel.includes(".back-link") || r.sel.includes(".pagehead__back")).map((r) => r.color),
      linkAccent: hasSel(".link-accent").map((r) => r.color),
      textBtnAccent: hasSel(".text-btn--accent").map((r) => r.color),
      vrowStatus: hasSel(".vrow__status").map((r) => r.color),
      vrowFill: hasSel(".vrow__fill").map((r) => ({ bg: r.bg, minWidth: r.minWidth })),
      focusVisible: rules.filter((r) => r.sel.includes(":focus-visible")).map((r) => r.outline),
      navIcon: hasSel("nav button.active .nav__icon").map((r) => r.bg),
      btnDisabled: hasSel(".btn:disabled").map((r) => ({ opacity: r.opacity, cursor: r.cursor })),
      iconbtnDisabled: hasSel(".iconbtn:disabled").map((r) => ({ opacity: r.opacity, cursor: r.cursor })),
      focusnavDisabled: hasSel(".focusnav:disabled").map((r) => r.color),
      accentTextSels: rules.filter((r) => r.color.includes("--accent-text")).map((r) => r.sel),
    };
  });
  assert(
    contrastAudit.accent === "#E04E14" && contrastAudit.accentText === "#B8410E" && contrastAudit.inkFaint === "#6E6A62",
    "C1: contrast tokens keep brand orange and add accent-text / ink-faint",
    JSON.stringify({
      accent: contrastAudit.accent,
      accentText: contrastAudit.accentText,
      inkFaint: contrastAudit.inkFaint,
    }),
    "Inspect :root --accent, --accent-text, --ink-faint"
  );
  assert(
    contrastAudit.contrastFaintBg >= 4.5 &&
      contrastAudit.contrastFaintWhite >= 4.5 &&
      contrastAudit.contrastAccentTextBg >= 4.5 &&
      contrastAudit.contrastAccentTextWhite >= 4.5,
    "C1: ink-faint and accent-text meet 4.5:1 on cream and white",
    JSON.stringify({
      faintBg: contrastAudit.contrastFaintBg,
      faintWhite: contrastAudit.contrastFaintWhite,
      accentBg: contrastAudit.contrastAccentTextBg,
      accentWhite: contrastAudit.contrastAccentTextWhite,
    }),
    "Compute WCAG contrast for --ink-faint and --accent-text against --bg and --surface"
  );
  assert(
    contrastAudit.ctaAfter.includes("var(--accent)") &&
      contrastAudit.navIcon.some((b) => b.includes("var(--accent)")) &&
      contrastAudit.vrowFill.some((v) => v.bg.includes("var(--accent)")) &&
      contrastAudit.focusVisible.some((o) => o.includes("var(--accent)")),
    "C1: brand-orange fills, CTA arrow and focus rings still use --accent",
    JSON.stringify({
      ctaAfter: contrastAudit.ctaAfter,
      navIcon: contrastAudit.navIcon,
      vrowFill: contrastAudit.vrowFill,
      focusVisible: contrastAudit.focusVisible,
    }),
    "Inspect .btn--cta::after, nav icon, .vrow__fill, :focus-visible"
  );
  assert(
    contrastAudit.backLink.filter(Boolean).every((c) => c.includes("var(--accent-text)")) &&
      contrastAudit.backLink.some((c) => c.includes("var(--accent-text)")) &&
      contrastAudit.linkAccent.every((c) => c.includes("var(--accent-text)")) &&
      contrastAudit.textBtnAccent.every((c) => c.includes("var(--accent-text)")) &&
      contrastAudit.vrowStatus.every((c) => c.includes("var(--accent-text)")) &&
      contrastAudit.accentTextSels.length >= 8,
    "C1: accent foreground text on light surfaces uses --accent-text",
    JSON.stringify({
      backLink: contrastAudit.backLink,
      linkAccent: contrastAudit.linkAccent,
      textBtnAccent: contrastAudit.textBtnAccent,
      vrowStatus: contrastAudit.vrowStatus,
      n: contrastAudit.accentTextSels.length,
    }),
    "Inspect .back-link, .link-accent, .text-btn--accent, .vrow__status"
  );
  assert(
    contrastAudit.vrowFill.every((v) => !v.minWidth || v.minWidth === "0px" || v.minWidth === "0"),
    "F9: .vrow__fill has no CSS min-width nub",
    JSON.stringify(contrastAudit.vrowFill),
    "Inspect .vrow__fill min-width"
  );
  assert(
    contrastAudit.btnDisabled.some((r) => r.opacity === "0.4" && r.cursor === "default") &&
      contrastAudit.iconbtnDisabled.some((r) => r.opacity === "0.3" && r.cursor === "default"),
    "F6: .btn:disabled is dimmed; .iconbtn:disabled is unchanged",
    JSON.stringify({ btn: contrastAudit.btnDisabled, icon: contrastAudit.iconbtnDisabled }),
    "Inspect .btn:disabled vs .iconbtn:disabled"
  );
  assert(
    contrastAudit.focusnavDisabled.every((c) => c.includes("var(--ink-faint)")),
    "C1: disabled Focus navigation uses the passing faint token",
    JSON.stringify(contrastAudit.focusnavDisabled),
    "Inspect .focusnav:disabled color"
  );

  await page.evaluate(() => window.startOnboarding());
  await page.waitForSelector("#onboarding.active #onbNext", { timeout: 5000 });
  const onbDisabled = await page.evaluate(() => {
    const b = document.querySelector("#onbNext");
    const cs = getComputedStyle(b);
    const step = document.querySelector("#onbStepLabel")?.textContent;
    b.click();
    return {
      disabled: b.disabled,
      opacity: cs.opacity,
      cursor: cs.cursor,
      bg: cs.backgroundColor,
      step,
      stepAfter: document.querySelector("#onbStepLabel")?.textContent,
    };
  });
  assert(
    onbDisabled.disabled === true &&
      onbDisabled.opacity === "0.4" &&
      onbDisabled.cursor === "default" &&
      onbDisabled.step === onbDisabled.stepAfter,
    "F6: disabled onboarding Continue cannot advance and is visually dimmed",
    JSON.stringify(onbDisabled),
    "Onboarding step 1 → Continue with no goal selected"
  );
  await page.click('[data-onb-pick="goal"][data-onb-val="hypertrophy"]');
  const onbEnabled = await page.evaluate(() => {
    const b = document.querySelector("#onbNext");
    const cs = getComputedStyle(b);
    return { disabled: b.disabled, opacity: cs.opacity, cursor: cs.cursor, bg: cs.backgroundColor };
  });
  assert(
    onbEnabled.disabled === false &&
      onbEnabled.opacity === "1" &&
      onbEnabled.cursor === "pointer" &&
      (onbEnabled.opacity !== onbDisabled.opacity || onbEnabled.cursor !== onbDisabled.cursor),
    "F6: enabled Continue is visually distinct from the disabled state",
    JSON.stringify({ onbEnabled, onbDisabled }),
    "Onboarding step 1 → pick a goal → Continue"
  );
  await page.evaluate(() => window.closeOnboarding());

  const isoToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const volumeAuditState = (base, lang) => {
    const specs = [
      { id: "va-quads", muscle: "Quads", sets: 10, done: 0 },
      { id: "va-rear", muscle: "Rear delts", sets: 8, done: 0 },
      { id: "va-add", muscle: "Adductors", sets: 4, done: 0 },
      { id: "va-side", muscle: "Side delts", sets: 4, done: 0 },
      { id: "va-chest", muscle: "Chest", sets: 3, done: 0 },
      { id: "va-glutes", muscle: "Glutes", sets: 3, done: 0 },
      { id: "va-spine", muscle: "Spinal erectors", sets: 2, done: 0 },
      { id: "va-front", muscle: "Front delts", sets: 4, done: 4 },
      { id: "va-lats", muscle: "Lats", sets: 5, done: 5 },
      { id: "va-calves", muscle: "Calves", sets: 4, done: 12 },
      { id: "va-hams", muscle: "Hamstrings", sets: 4, done: 4 },
      { id: "va-tri", muscle: "Triceps", sets: 2, done: 2 },
    ];
    const date = isoToday();
    const program = specs.map((s, i) => ({
      id: s.id,
      day: "Day 1",
      order: i + 1,
      name: `${s.muscle} raise`,
      sets: s.sets,
      min: 6,
      max: 10,
      primary: s.muscle,
      secondary: "",
      notes: "",
      alternates: [],
    }));
    const created = `${date}T12:00:00.000Z`;
    const log = [];
    for (const s of specs) {
      for (let n = 1; n <= s.done; n++) {
        log.push({
          session: `${date}_Day 1_vol`,
          date,
          day: "Day 1",
          name: `${s.muscle} raise`,
          exerciseId: s.id,
          set: n,
          load: 40,
          reps: 8,
          rir: 1,
          notes: "",
          created,
          primary: s.muscle,
          secondary: "",
        });
      }
    }
    for (let n = 1; n <= 3; n++) {
      log.push({
        session: `${date}_Day 1_vol`,
        date,
        day: "Day 1",
        name: "Curl",
        exerciseId: "va-biceps-log",
        set: n,
        load: 15,
        reps: 10,
        rir: 1,
        notes: "",
        created,
        primary: "Biceps",
        secondary: "",
      });
    }
    return {
      ...base,
      program,
      log,
      programMeta: { ...(base.programMeta || {}), onboarded: true, started: date, mesocycleStatus: "active" },
      settings: { ...base.settings, lang, unit: "kg", hardRir: 4 },
    };
  };

  const readOverview = async () =>
    page.evaluate(() => {
      const rows = [...document.querySelectorAll("#overviewVolume .vrow")].map((row) => {
        const fill = row.querySelector(".vrow__fill");
        const bar = row.querySelector(".vrow__bar");
        return {
          muscle: row.getAttribute("data-muscle"),
          name: row.querySelector(".vrow__name")?.textContent,
          num: row.querySelector(".vrow__num")?.textContent.trim(),
          status: row.querySelector(".vrow__status")?.textContent.trim(),
          on: fill?.classList.contains("is-on") || false,
          width: fill?.style.width,
          fillBox: fill?.getBoundingClientRect().width || 0,
          barBox: bar?.getBoundingClientRect().width || 0,
        };
      });
      return {
        rows,
        more: document.querySelector("#overviewVolumeMore")?.textContent.trim() || "",
        hook: window.__repforgeOverviewVolume
          ? window.__repforgeOverviewVolume.sorted().map((r) => ({
              muscle: r.muscle,
              planned: r.planned,
              completed7: r.completed7,
              pct: window.__repforgeOverviewVolume.pct(r.planned, r.completed7),
              label: window.__repforgeOverviewVolume.label(r.muscle),
            }))
          : [],
      };
    });

  const baseVol = await getState(page);
  await persistState(page, volumeAuditState(baseVol, "en"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#overviewVolume .vrow", { timeout: 5000 });
  const enVol = await readOverview();
  assert(
    enVol.rows.map((r) => r.muscle).join("|") ===
      "Quads|Rear delts|Adductors|Side delts|Chest|Glutes|Spinal erectors|Front delts",
    "F10: English overview sorts by deficit, then ratio, then localized name",
    enVol.rows.map((r) => r.muscle).join("|"),
    "Stats → Overview volume rows"
  );
  const addEn = enVol.rows.find((r) => r.muscle === "Adductors");
  const frontEn = enVol.rows.find((r) => r.muscle === "Front delts");
  assert(
    addEn?.width === "0%" && addEn.fillBox < 1 && addEn.num.includes("0") && /below/i.test(addEn.status),
    "F9: 0/4 is an empty bar and keeps Below",
    JSON.stringify(addEn),
    "Overview → Adductors 0/4"
  );
  assert(
    frontEn?.width === "100%" && frontEn.num.includes("4") && /on target/i.test(frontEn.status) && frontEn.on,
    "F9: 4/4 is a full On target bar",
    JSON.stringify(frontEn),
    "Overview → Front delts 4/4"
  );
  const lats = enVol.hook.find((r) => r.muscle === "Lats");
  const calves = enVol.hook.find((r) => r.muscle === "Calves");
  const biceps = enVol.hook.find((r) => r.muscle === "Biceps");
  assert(
    lats?.pct === 100 && lats.planned === 5 && lats.completed7 === 5,
    "F9: 5/5 width computes to 100%",
    JSON.stringify(lats),
    "__repforgeOverviewVolume.pct(5,5)"
  );
  assert(
    calves?.pct === 100 && calves.completed7 > calves.planned,
    "F9: over-target width is capped at 100%",
    JSON.stringify(calves),
    "__repforgeOverviewVolume.pct for Calves 12/4"
  );
  assert(
    biceps?.planned === 0 && biceps.pct === 0 && biceps.completed7 > 0,
    "F9: unplanned rows use 0% width",
    JSON.stringify(biceps),
    "__repforgeOverviewVolume.pct for Biceps with no plan"
  );

  await page.waitForFunction(() => Array.isArray(window.__repforgeChartPaint?.fillText), { timeout: 5000 });
  const chartPaint = await page.evaluate(() => {
    const norm = (c) => {
      const raw = String(c).trim().toLowerCase().replace(/\s+/g, "");
      if (raw.startsWith("#") && raw.length === 7) return raw;
      const m = raw.match(/^rgba?\((\d+),(\d+),(\d+)/);
      if (!m) return raw;
      return "#" + [+m[1], +m[2], +m[3]].map((n) => n.toString(16).padStart(2, "0")).join("");
    };
    const paint = window.__repforgeChartPaint || { fillText: [], stroke: [], fill: [] };
    return {
      fillText: paint.fillText.map((x) => ({
        text: x.text,
        fillStyle: norm(x.fillStyle),
        font: String(x.font || ""),
      })),
      stroke: paint.stroke.map((x) => ({ strokeStyle: norm(x.strokeStyle) })),
      fill: paint.fill.map((x) => ({ fillStyle: norm(x.fillStyle) })),
    };
  });
  const latestValueText = chartPaint.fillText.find(
    (x) => /\b(kg|lb)\b/i.test(x.text) && /600/.test(x.font)
  );
  const unitTexts = chartPaint.fillText.filter((x) => /\b(kg|lb)\b/i.test(x.text));
  assert(
    latestValueText && latestValueText.fillStyle === "#b8410e",
    "C1: latest-value canvas text uses accent-text, not brand orange",
    JSON.stringify(latestValueText || { fillText: chartPaint.fillText }),
    "Stats → Overview chart → latest-value fillText"
  );
  assert(
    unitTexts.length > 0 && unitTexts.every((x) => x.fillStyle !== "#e04e14") &&
      chartPaint.fillText.every((x) => x.fillStyle !== "#e04e14"),
    "C1: no canvas fillText uses brand orange",
    JSON.stringify(chartPaint.fillText.map((x) => ({ text: x.text, fillStyle: x.fillStyle }))),
    "Inspect __repforgeChartPaint.fillText colors"
  );
  assert(
    chartPaint.stroke.some((x) => x.strokeStyle === "#e04e14") &&
      chartPaint.stroke.some((x) => x.strokeStyle === "#e4e1da"),
    "C1: chart data stroke stays brand orange; grid stays rule",
    JSON.stringify(chartPaint.stroke),
    "Inspect __repforgeChartPaint.stroke colors"
  );
  assert(
    chartPaint.fill.some((x) => x.fillStyle === "#e04e14") &&
      chartPaint.fill.every((x) => x.fillStyle === "#e04e14"),
    "C1: chart points stay brand orange",
    JSON.stringify(chartPaint.fill),
    "Inspect __repforgeChartPaint.fill colors"
  );

  assert(
    enVol.more === "+5 more" && enVol.hook.length - enVol.rows.length === 5,
    "F10: English +{n} more matches hidden row count",
    `more="${enVol.more}" hidden=${enVol.hook.length - enVol.rows.length} total=${enVol.hook.length}`,
    "Overview volume truncation"
  );
  await page.click("#overviewVolumeMore");
  await page.waitForSelector("#segVolume.active", { timeout: 5000 });
  const volTableCount = await page.locator("#volumeDash tbody tr").count();
  const volActive = await page.evaluate(
    () =>
      document.querySelector('#statsSeg button[data-seg="volume"]')?.classList.contains("active") &&
      document.querySelector("#segVolume")?.classList.contains("active")
  );
  assert(
    volActive && volTableCount === enVol.hook.length,
    "F10: +more opens the complete Volume segment",
    `active=${volActive} rows=${volTableCount} expected=${enVol.hook.length}`,
    "Overview → +n more → Volume"
  );

  await persistState(page, volumeAuditState(await getState(page), "pt"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#overviewVolume .vrow", { timeout: 5000 });
  const ptVol = await readOverview();
  assert(
    ptVol.rows.map((r) => r.muscle).join("|") ===
      "Quads|Rear delts|Adductors|Side delts|Glutes|Chest|Spinal erectors|Front delts",
    "F10: Portuguese overview applies localized name ties (Glúteos before Peito)",
    ptVol.rows.map((r) => `${r.muscle}:${r.name}`).join("|"),
    "Stats → Overview volume rows in PT"
  );
  assert(
    ptVol.rows[4]?.name === "Glúteos" && ptVol.rows[5]?.name === "Peito",
    "F10: Portuguese labels follow the localized sort",
    ptVol.rows.map((r) => r.name).join("|"),
    "Overview volume names in PT"
  );
  assert(
    ptVol.more === "+5 mais",
    "F10: Portuguese +{n} more copy",
    `more="${ptVol.more}"`,
    "Overview volume truncation in PT"
  );
  await page.click("#overviewVolumeMore");
  await page.waitForSelector("#segVolume.active", { timeout: 5000 });
  assert(
    await page.evaluate(() => document.querySelector("#segVolume")?.classList.contains("active")),
    "F10: Portuguese +more still opens Volume",
    "segVolume not active",
    "PT Overview → +n mais → Volume"
  );

  const focusState = volumeAuditState(await getState(page), "en");
  focusState.program = focusState.program.slice(0, 2);
  await persistState(page, focusState);
  await reloadApp(page);
  await nav(page, "log");
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: true }));
  await page.waitForSelector("#woPrev", { timeout: 5000 });
  const focusNavContrast = await page.evaluate(() => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const hexToRgb = (hex) => {
      const n = parseInt(String(hex).replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };
    const parseRgb = (c) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [+m[1], +m[2], +m[3]] : null;
    };
    const prev = document.querySelector("#woPrev");
    const color = getComputedStyle(prev).color;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const rgb = parseRgb(color);
    const [br, bgc, bb] = hexToRgb(bg);
    const L1 = lum(...rgb);
    const L2 = lum(br, bgc, bb);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return { disabled: prev.disabled, color, bg, contrast: (hi + 0.05) / (lo + 0.05) };
  });
  assert(
    focusNavContrast.disabled === true && focusNavContrast.contrast >= 3,
    "C1: disabled Focus navigation reaches the 3:1 usability target",
    JSON.stringify(focusNavContrast),
    "Focus → first exercise → #woPrev contrast against --bg"
  );
  // Console errors
  assert(
    consoleErrors.length === 0,
    "No console errors during simulation",
    consoleErrors.slice(0, 5).join("; ") || "(none listed)",
    "Run simulation with DevTools console open"
  );

  rmSync(tmpDir, { recursive: true, force: true });
  await browser.close();

  if (PROFILE && lastPhase) {
    phaseTimings.push([lastPhase, Date.now() - phaseClock]);
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`PASSED: ${results.passed}`);
  console.log(`FAILED: ${results.failed}`);
  console.log(`Sessions simulated: ${sessionCount} (${uiSaveCount} via UI, ${sessionCount - uiSaveCount} bulk-seeded)`);
  console.log("=".repeat(60));

  if (PROFILE && phaseTimings.length) {
    console.log("\nPhase timings (ms):");
    const sorted = [...phaseTimings].sort((a, b) => b[1] - a[1]);
    for (const [name, ms] of sorted) {
      console.log(`  ${String(ms).padStart(6)}  ${name}`);
    }
    console.log(`  ${"─".repeat(6)}  total tracked: ${sorted.reduce((s, [, ms]) => s + ms, 0)} ms`);
  }

  if (results.bugs.length) {
    console.log("\nBUG REPORT\n");
    results.bugs.forEach((b, i) => {
      console.log(`${i + 1}. ${b.name}`);
      console.log(`   Detail: ${b.detail}`);
      console.log(`   Repro:  ${b.repro}`);
      console.log("");
    });
  } else {
    console.log("\nNo bugs found — all checks passed.\n");
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Simulation crashed:", err);
  process.exit(2);
});
