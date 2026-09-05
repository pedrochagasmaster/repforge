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
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const OPTIONAL_DEPLOYMENT_SHELL_ASSET = "/posthog-config.js";
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
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function waitForApp(page, { dismissOnboarding = true } = {}) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 10000 });
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

/** A first run now opens on the setup screen, which offers Create and Import
 *  as equals. Walks that mean to exercise the wizard go through its door. */
async function startFromFirstRun(page) {
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
}

/** Drive Plan 048 Recommend from the entry hub through activation. */
async function driveRecommendOnboarding(page, {
  desiredResult = "muscle_growth",
  experience = "6_to_24m",
  consistency = "most",
  days = 3,
  minutes = 60,
  rest = "120",
  environment = "commercial_gym",
  activate = true,
} = {}) {
  await page.click('[data-entry-route="recommend"]');
  await page.click(`[data-entry-pick="desiredResult"][data-entry-val="${desiredResult}"]`);
  await page.click("#onbNext");
  await page.click(`[data-entry-pick="structuredExperience"][data-entry-val="${experience}"]`);
  await page.click(`[data-entry-pick="recentConsistency"][data-entry-val="${consistency}"]`);
  await page.click("#onbNext");
  await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${days}"]`);
  await page.click(`[data-entry-pick="sessionMinutes"][data-entry-val="${minutes}"]`);
  await page.click(`[data-entry-pick="preferredRestSeconds"][data-entry-val="${rest}"]`);
  await page.click("#onbNext");
  await page.click(`[data-entry-pick="environment"][data-entry-val="${environment}"]`);
  await page.click("#onbNext");
  await page.click("#onbNext");
  await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 10000 });
  if (await page.locator("[data-entry-select-candidate]").count()) {
    await page.locator("[data-entry-select-candidate]").first().click();
  }
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  if (activate) {
    await page.click("#entryActivate");
    await page.waitForFunction(
      () => !document.querySelector("#onboarding")?.classList.contains("active"),
      undefined,
      { timeout: 10000 },
    );
  }
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

/** Shift every logged row back `days` days, so today reads as untrained. */
async function backdateLog(page, days) {
  const state = await getState(page);
  const shift = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  await persistState(page, { ...state, log: (state.log || []).map((r) => ({ ...r, date: shift(String(r.date)) })) });
  await reloadApp(page);
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
}

function readServiceWorkerMeta() {
  const src = readFileSync(join(ROOT, "sw.js"), "utf8");
  const cache = src.match(/const CACHE\s*=\s*"([^"]+)"/)?.[1];
  if (!cache) throw new Error("sw.js CACHE string not found");
  const shellRaw = src.match(/const SHELL\s*=\s*new Set\(\[([^\]]*)\]\)/)?.[1] || "";
  const shell = [...shellRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (!shell.length) throw new Error("sw.js SHELL set not found");
  return { cache, shell };
}

function pwaOriginFromBase() {
  const u = new URL(BASE);
  return `http://127.0.0.1:${u.port || "80"}/`;
}

function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}

function canonicalDomain(snapshot) {
  if (snapshot == null) return { revision: null, domain: null };
  const copy = JSON.parse(JSON.stringify(snapshot));
  const revision = Object.prototype.hasOwnProperty.call(copy, "_storageRevision") ? copy._storageRevision : 0;
  delete copy._storageRevision;
  delete copy._storageFollowUp;
  return { revision, domain: stableStringify(copy) };
}

async function readReplicasAndDraft(page) {
  return page.evaluate(async ({ k, d }) => {
    const localRaw = localStorage.getItem(k);
    let local = null;
    try {
      local = localRaw ? JSON.parse(localRaw) : null;
    } catch {
      local = { __parseError: true, raw: localRaw };
    }
    const draft = localStorage.getItem(d);
    let idb = null;
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      idb = await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readonly").objectStore("kv").get(k);
        tx.onsuccess = () => res(tx.result === undefined ? null : tx.result);
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch {
      idb = { __readError: true };
    }
    return { local, idb, draft };
  }, { k: KEY, d: DRAFT });
}

function replicasAgree(bundle) {
  const a = canonicalDomain(bundle.local);
  const b = canonicalDomain(bundle.idb);
  return a.domain === b.domain && a.domain != null;
}

async function wipePwaOrigin(page, context) {
  await page.evaluate(async ({ k, d }) => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((c) => caches.delete(c)));
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    sessionStorage.clear();
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
}

/**
 * Clear the device and reload onto a known program.
 *
 * A device that has not been through onboarding holds no program, so the walk
 * below — which logs, substitutes, and reads recommendations against Day 1..3 —
 * installs one rather than inheriting whatever first run leaves behind.
 */
async function resetWithSeedProgram(page) {
  await clearState(page);
  await reloadApp(page);
  // `clearState` leaves the device-only UI prefs alone, but an earlier phase
  // clears them to replay the first-run tour. Landing on a ready program with
  // `tourDone` unset reopens that tour over the app, and its overlay then eats
  // every click the walk makes. Mark it seen: this reset hands the walk a
  // device that is past first run.
  await page.evaluate(() => {
    const k = "repforge_ui_v1";
    const prefs = JSON.parse(localStorage.getItem(k) || "{}");
    prefs.tourDone = true;
    localStorage.setItem(k, JSON.stringify(prefs));
  });
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
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
  await page.evaluate(async ({ k, d, setup }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    localStorage.removeItem(setup);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT, setup: SETUP_DRAFT });
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

async function applyProgramEditor(page) {
  if (!(await page.locator("#programEditorWrap:not(.is-hidden)").count())) return;
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.evaluate(() => {
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
  await page.waitForSelector("#tour", { state: "hidden", timeout: 5000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
}

async function revealProgramExerciseDetails(page, id) {
  const day = page.locator(`#programEditor [data-role="exercise"][data-id="${id}"]`).locator('xpath=ancestor::*[@data-role="day"]');
  await day.locator('[data-role="day-menu"]').click();
  await day.locator('[data-role="toggle-reorder"]').click();
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${id}"]`);
  await row.locator('[data-role="exercise-menu"]').click();
  await row.locator('[data-role="more-details"][role="menuitem"]').click();
  return row.locator('details[data-role="more-details"]');
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

/**
 * Close the session summary a finished workout opens over the app, returning
 * the text it showed. Every save has to go through this: while the summary is
 * up the app underneath is inert, so the next interaction would never land.
 *
 * Closing it ends the session and steps the shell back to Today — which is the
 * point of the screen. This harness logs one session after another on the same
 * day, so it re-opens the workout the way a lifter starting the next one would.
 */
async function dismissSessionSummary(page) {
  const seen = await page.evaluate(() => {
    const el = document.querySelector("#sessionSummary");
    if (!el || el.classList.contains("hidden")) return null;
    return document.querySelector("#sessionSummaryBody")?.innerText || "";
  });
  if (seen == null) return null;
  await page.evaluate(() => window.__repforgeSessionSummary?.close());
  await page.waitForSelector("#sessionSummary.hidden", { state: "attached", timeout: 5000 });
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  return seen;
}

async function saveWorkout(page, { expectNewRows = true } = {}) {
  const beforeLen = (await getState(page))?.log?.length ?? 0;
  await page.evaluate(async () => {
    if (typeof window.__repforgeSaveWorkout === "function") {
      await window.__repforgeSaveWorkout();
      return;
    }
    document.querySelector("#logForm")?.requestSubmit();
    if (window.__repforgeStorage?.flush) await window.__repforgeStorage.flush();
  });
  if (!expectNewRows) {
    await page.waitForTimeout(120);
    return await dismissSessionSummary(page);
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
      return /saved|salvo|Enter weight/i.test(toast);
    },
    { k: KEY, len: beforeLen },
    { timeout: 8000 }
  );
  return await dismissSessionSummary(page);
}

async function flushStorage(page) {
  await page.evaluate(async () => {
    if (window.__repforgeStorage?.flush) await window.__repforgeStorage.flush();
  });
}

async function saveSettingsAndFlush(page) {
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#saveSettings")?.click());
  await flushStorage(page);
}

async function stopRestIfRunning(page) {
  await page.evaluate(() => {
    const bar = document.querySelector("#restBar");
    if (bar && !bar.classList.contains("hidden")) bar.click();
  });
}

async function setWorkoutField(page, selector, value) {
  await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`missing ${selector}`);
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    { selector, value }
  );
}

async function setLogDateRaw(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector("#date");
    if (!el) throw new Error("#date missing");
    el.setAttribute("type", "text");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function openSessionEditor(page, sid) {
  await nav(page, "history");
  if (await page.locator(`.session--edit[data-editing="${sid}"]`).count()) return;
  const editBtn = page.locator(`[data-edit="${sid}"]`);
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForSelector(`.session--edit[data-editing="${sid}"]`, { timeout: 5000 });
    return;
  }
  await page.locator(`#sessions .hist-row[data-sess="${sid}"]`).click();
  await page.locator(`[data-edit="${sid}"]`).waitFor({ state: "visible", timeout: 5000 });
  await page.click(`[data-edit="${sid}"]`);
  await page.waitForSelector(`.session--edit[data-editing="${sid}"]`, { timeout: 5000 });
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
    empty: "Digite uma carga antes de salvar a série.",
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
  const editBtn = page.locator('#sessions [data-edit="f7-edit-seed"]');
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

/* Decides every row still awaiting review, stages the candidate, then uses the
   same explicit activation transaction as every other entry route. Each
   decision re-renders the list, so rows are handled one at a time. */
async function reviewAndCommitImport(page) {
  await page.evaluate(() => {
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
  for (let guard = 0; guard < 40; guard++) {
    const acted = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#importRows .improw")].find((r) => r.classList.contains("is-open"));
      if (!row) return false;
      (row.querySelector('[data-imp-act="link"]') || row.querySelector('[data-imp-act="raw"]'))?.click();
      return true;
    });
    if (!acted) break;
    await page.waitForTimeout(60);
  }
  await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  await page.click("#entryActivate");
  await page.waitForTimeout(500);
}

async function main() {
  console.log("RepForge year-of-usage simulation");
  console.log(`Target: ${BASE}\n`);

  const browser = await launchChromium();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const origFillText = proto.fillText;
    const origStroke = proto.stroke;
    const origFill = proto.fill;
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (type === "2d") this.__rfPaint = { fillText: [], stroke: [], fill: [] };
      return origGetContext.call(this, type, ...rest);
    };
    const bucket = (ctx) => (ctx.canvas.__rfPaint ||= { fillText: [], stroke: [], fill: [] });
    proto.fillText = function (text, x, y, ...rest) {
      bucket(this).fillText.push({ text: String(text), fillStyle: String(this.fillStyle), font: String(this.font) });
      return origFillText.call(this, text, x, y, ...rest);
    };
    proto.stroke = function (...args) {
      bucket(this).stroke.push({ strokeStyle: String(this.strokeStyle) });
      return origStroke.apply(this, args);
    };
    proto.fill = function (...args) {
      bucket(this).fill.push({ fillStyle: String(this.fillStyle) });
      return origFill.apply(this, args);
    };
  });

  let dialogMode = "accept";
  page.on("dialog", async (dialog) => {
    try {
      if (dialogMode === "dismiss") await dialog.dismiss();
      else await dialog.accept();
    } catch {
      /* already handled */
    }
  });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loadApp(page);
  await resetWithSeedProgram(page);

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
  const smokeSummary = (await saveWorkout(page)) || "";
  sessionCount++;
  uiSaveCount++;
  assert(
    /(^|\n)set logged(\n|$)/.test(smokeSummary),
    "Session summary uses singular set for one-set save",
    `Summary: ${JSON.stringify(smokeSummary)}`,
    "Log tab → fill one set → Save workout → summary reads 'set logged'"
  );
  assert(
    !/sets logged/.test(smokeSummary),
    "Session summary does not use plural sets for one-set save",
    `Summary: ${JSON.stringify(smokeSummary)}`,
    "Log tab → fill one set → Save workout → summary must not read 'sets logged'"
  );
  assert(
    (await getState(page)).log.some((r) => r.date === smokeDate && +r.load === 105),
    "Save workout UI persists after bulk seed",
    "No row with load 105 on smoke date",
    "Log tab → fill one set → Save workout"
  );

  // A touched 0 kg row is invalid (UX-03/F7): abort the whole Finish instead of
  // dropping that set and persisting the sibling 100 kg rows.
  await setLogDate(page, isoDateFromWeeksAgo(1));
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await page.fill(`[data-k="${d1Exs[0].id}_1_load"]`, "0");
  await page.fill(`[data-k="${d1Exs[0].id}_1_reps"]`, "0");
  const logLenBeforeZero = (await getState(page)).log.length;
  const draftBeforeZero = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
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
  assert(
    (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) === draftBeforeZero,
    "Rejected zero-load Finish keeps the exact draft",
    "Draft string changed after rejected Finish",
    "Log tab → 0 kg set → Save workout → draft unchanged"
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
  // A cause every lift in a group shares is stated once above them; a group
  // whose lifts differ keeps the reason on each row. Either way the row's own
  // accessible name still answers "why this lift".
  const attnReasons = await page.evaluate(() =>
    [...document.querySelectorAll("#attention .attn__grp")].map((g) => {
      const why = g.querySelector(".attn__why");
      const subs = [...g.querySelectorAll(".attn__chip .listrow__sub")];
      return {
        hoisted: !!why && !why.classList.contains("visually-hidden"),
        identical: new Set(subs.map((s) => s.textContent.trim())).size === 1,
        rows: subs.length,
        subsPainted: subs.filter((s) => s.getBoundingClientRect().height > 2).length,
        named: subs.every((s) => s.closest(".attn__chip").textContent.includes(s.textContent.trim())),
      };
    })
  );
  assert(
    attnReasons.length > 0 &&
      attnReasons.every((g) => g.hoisted === (g.rows > 1 && g.identical)),
    "Attention hoists a reason only when every lift in the group shares it",
    JSON.stringify(attnReasons),
    "Stats Overview → compare a one-reason group against a mixed one"
  );
  assert(
    attnReasons.every((g) => (g.hoisted ? g.subsPainted === 0 : g.subsPainted === g.rows) && g.named),
    "A hoisted reason is drawn once but still named on every row it covers",
    JSON.stringify(attnReasons),
    "Stats Overview → inspect a group whose lifts share one reason"
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
    /\bmaximum-scale\s*=\s*1\b/.test(zoomPolicy.meta) && /\buser-scalable\s*=\s*no\b/i.test(zoomPolicy.meta),
    "Viewport meta pins the scale at 1",
    JSON.stringify(zoomPolicy),
    "Inspect <meta name=viewport> → maximum-scale=1 and user-scalable=no"
  );
  assert(
    zoomPolicy.root === "pan-x pan-y" &&
      zoomPolicy.step === "manipulation" &&
      zoomPolicy.field === "manipulation",
    "The page takes scrolling only, so no tap or pinch can zoom",
    JSON.stringify(zoomPolicy),
    "Log tab → computed touch-action on the root, a ± step button and a set field"
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
  const renameInput = page.locator('#programEditor [data-role="day-name"][data-day="Day 1"]');
  await renameInput.fill("Push Day");
  await renameInput.blur();
  await applyProgramEditor(page);

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
  const day2 = page.locator('#programEditor [data-role="day"][data-day="Day 2"]');
  if (!(await day2.locator('[data-role="day-body"]').isVisible())) await day2.locator('[data-role="toggle-day"]').click();
  const targetInput = page.locator(`#programEditor [data-role="exercise-field"][data-field="name"][value="${loggedOnDay2.name.replace(/"/g, '\\"')}"]`).first();
  const oldName = await targetInput.inputValue();
  const newName = "Custom Leg Press";
  await targetInput.fill(newName);
  await targetInput.blur();
  await applyProgramEditor(page);

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
    lastLine.includes("Last set"),
    "Renamed exercise still shows last session via exerciseId",
    `Expected Last set line after rename, got "${lastLine}"`,
    "Rename exercise → Log tab → previous session should still display"
  );

  // Add exercise — now via the library picker rather than a blank row
  await nav(page, "program");
  const exCountBefore = state.program.filter((e) => e.day === "Push Day").length;
  await page.click('#programEditor [data-role="add-exercise"][data-day="Push Day"]');
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  await page.fill("#exPickSearch", "pec deck");
  await page.waitForTimeout(120);
  const pickedName = ((await page.locator("#exPickList .pickrow__name").first().textContent()) || "").trim();
  await page.click("#exPickList .pickrow");
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await applyProgramEditor(page);
  state = await getState(page);
  const pushRows = state.program.filter((e) => e.day === "Push Day");
  const added = pushRows.find((e) => e.name === pickedName);
  assert(
    pushRows.length === exCountBefore + 1,
    "Add exercise to day",
    `Before ${exCountBefore}, after ${pushRows.length}`,
    "Program tab → + Add exercise → pick from the library"
  );
  assert(
    !!added && added.libraryId === "ci_mc" && added.primary === "Chest",
    "Picked exercise arrives linked, named and muscle-tagged",
    `added=${JSON.stringify(added)}`,
    "Program tab → + Add exercise → search 'pec deck' → tap the row"
  );

  // Reorder — move second exercise down (swaps with third)
  const pushExs = state.program
    .filter((e) => e.day === "Push Day")
    .sort((a, b) => a.order - b.order);
  if (pushExs.length >= 3) {
    const secondId = pushExs[1].id;
    const thirdId = pushExs[2].id;
    await nav(page, "program");
    const pushDay = page.locator('#programEditor [data-role="day"][data-day="Push Day"]');
    await pushDay.locator('[data-role="day-menu"]').click();
    await pushDay.locator('[data-role="toggle-reorder"]').click();
    const second = page.locator(`#programEditor [data-role="exercise"][data-id="${secondId}"]`);
    await second.locator('[data-role="exercise-menu"]').click();
    await second.locator('[data-role="move-down"]').click();
    await applyProgramEditor(page);
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

  // Remove the exercise added above
  const newEx = state.program.find((e) => e.name === pickedName && e.day === "Push Day");
  if (newEx) {
    await nav(page, "program");
    const row = page.locator(`#programEditor [data-role="exercise"][data-id="${newEx.id}"]`);
    if (!(await row.evaluate((element) => element.classList.contains("is-expanded"))))
      await row.locator('[data-role="toggle-exercise"]').click();
    await row.locator('[data-role="remove-exercise"]').click();
    await applyProgramEditor(page);
    state = await getState(page);
    assert(
      !state.program.find((e) => e.id === newEx.id),
      "Remove exercise",
      "Exercise still in program after delete",
      "Program tab → ✕ on exercise"
    );
  }

  // Add new day
  await nav(page, "program");
  await page.click('#programEditor [data-role="add-day"]');
  const addedDayName = await page.locator('#programEditor [data-role="day-name"]').last().inputValue();
  await page.click(`#programEditor [data-role="add-exercise"][data-day="${addedDayName}"]`);
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  await page.click("#exPickList .pickrow");
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await applyProgramEditor(page);
  state = await getState(page);
  const dayNames = (state.programMeta?.programStructure?.days || []).map((entry) => entry.label || entry.dayId);
  assert(
    dayNames.includes(addedDayName) && /^Day \d+$/.test(addedDayName) && state.program.some((exercise) => exercise.day === addedDayName),
    "Add new training day",
    `Days: ${dayNames.join(", ")}`,
    "Program tab → + Add day"
  );

  // Duplicate day rename rejected
  await nav(page, "program");
  const dupInput = page.locator('#programEditor [data-role="day-name"][data-day="Day 2"]');
  await dupInput.fill("Push Day");
  await dupInput.blur();
  await applyProgramEditor(page);
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
  await applyProgramEditor(page);
  const metaBefore = await page.locator("#programOverview").textContent();
  assert(
    metaBefore.includes("days (7d)"),
    "Program overview shows rolling-7 adherence",
    `Meta card: ${metaBefore?.slice(0, 120)}`,
    "Program tab → check overview stats"
  );
  await nav(page, "program");
  await page.fill('#programEditor [data-role="program-name"]', "Simulation Split");
  await page.locator('#programEditor [data-role="program-name"]').blur();
  await applyProgramEditor(page);
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
  state = await getState(page);
  await persistState(page, { ...state, programMeta: { ...state.programMeta, started: startedIso } });
  await reloadApp(page);
  await nav(page, "program");
  await applyProgramEditor(page);
  const metaAfterDate = await page.locator("#programOverview").textContent();
  assert(
    /Week 3/.test(metaAfterDate),
    "Program overview derives the current week from the stored block start",
    `Meta card after date edit: ${metaAfterDate?.slice(0, 140)}`,
    "Store a block start 15 days back → Program overview"
  );
  state = await getState(page);
  assert(
    state.programMeta.started === startedIso,
    "Stored block start survives the Program overview render",
    `started=${state.programMeta?.started}`,
    "Persist block start → render Program overview"
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
  // Deleting a session lives inside the session: the row opens it, and the
  // destructive action sits under the edits it belongs to.
  const openBtn = page.locator("#sessions .session__open").first();
  await openBtn.waitFor({ state: "visible", timeout: 5000 });
  await openBtn.click();
  const delBtn = page.locator(".session--edit .session__del").first();
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
    "History tab → open a session → Delete session → confirm"
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

    const malformedBackups = [
      ["program [null]", { ...exported, program: [null] }],
      ["log [null]", { ...exported, log: [null] }],
      ["programHistory [null]", { ...exported, programHistory: [null] }],
      [
        "programHistory nested program [null]",
        { ...exported, programHistory: [{ id: "old-program", program: [null] }] },
      ],
      [
        "log rows with object performedName",
        {
          ...exported,
          log: [
            { session: "unsafe-a", date: "2026-08-14", performedName: {} },
            { session: "unsafe-b", date: "2026-08-14", performedName: {} },
          ],
        },
      ],
    ];
    for (const [label, malformed] of malformedBackups) {
      const malformedPath = join(tmpDir, `invalid-${label.replace(/[^a-z]+/gi, "-").toLowerCase()}.json`);
      writeFileSync(malformedPath, JSON.stringify(malformed));
      await flushStorage(page);
      const beforeInvalid = await readReplicasAndDraft(page);
      await page.evaluate(() => {
        const toast = document.querySelector("#toast");
        if (toast) {
          toast.textContent = "";
          toast.classList.add("hidden");
        }
      });
      await page.setInputFiles("#importJson", malformedPath);
      await page.waitForFunction(
        () => {
          const toast = document.querySelector("#toast");
          const choice = document.querySelector("#importChoice");
          return !!(
            (toast && !toast.classList.contains("hidden") && toast.textContent.trim()) ||
            (choice && choice.open && !choice.classList.contains("hidden"))
          );
        },
        { timeout: 3000 }
      );
      const choiceOpened = await page.locator("#importChoice").evaluate(
        (element) => element.open && !element.classList.contains("hidden")
      );
      if (choiceOpened) {
        await page.click("#importReplace");
        await flushStorage(page);
      }
      const toastText = await page.locator("#toast").textContent();
      const afterInvalid = await readReplicasAndDraft(page);
      const storesUnchanged =
        stableStringify(afterInvalid.local) === stableStringify(beforeInvalid.local) &&
        stableStringify(afterInvalid.idb) === stableStringify(beforeInvalid.idb) &&
        afterInvalid.draft === beforeInvalid.draft;
      assert(
        !choiceOpened && /valid|válid/i.test(toastText || ""),
        `Invalid backup with ${label} shows an error and never offers Replace`,
        JSON.stringify({ choiceOpened, toastText }),
        `Settings → Import backup containing ${label}`
      );
      assert(
        storesUnchanged,
        `Invalid backup with ${label} cannot mutate either replica or the draft`,
        JSON.stringify({
          beforeRevision: canonicalDomain(beforeInvalid.local).revision,
          afterLocalRevision: canonicalDomain(afterInvalid.local).revision,
          afterIdbRevision: canonicalDomain(afterInvalid.idb).revision,
        }),
        `Settings → Import backup containing ${label} → Replace if offered`
      );
      if (choiceOpened || !storesUnchanged) {
        await persistState(page, beforeInvalid.local);
        await page.evaluate(
          ({ key, raw }) => {
            if (raw == null) localStorage.removeItem(key);
            else localStorage.setItem(key, raw);
          },
          { key: DRAFT, raw: beforeInvalid.draft }
        );
        await reloadApp(page);
        await nav(page, "settings");
        await page.evaluate(() => document.querySelector("#dataBackupPanel")?.classList.add("is-open"));
      }
    }

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
  const prSummary = (await saveWorkout(page)) || "";
  assert(
    /PERSONAL RECORDS/i.test(prSummary) && /150 kg × 6/.test(prSummary) && !/250 kg/.test(prSummary),
    "Session summary announces a per-exercise top-load PR (not global max)",
    `Summary: ${JSON.stringify(prSummary)}`,
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
  // The strength trend card holds four things about one lift. They used to keep
  // three different left edges — the picker inset 14px, the figures and the
  // canvas flush to the card's border — and the ledger was cut off mid-column
  // by a 520px floor meant for full-page tables.
  const trendCard = await page.evaluate(() => {
    const card = document.querySelector(".chartcard");
    const kids = [...card.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: el.className, left: Math.round(r.left), right: Math.round(r.right) };
    });
    const led = card.querySelector("#prLedger");
    const cap = card.querySelector(".chartcard__cap");
    const wrap = card.querySelector(".chart-wrap");
    return {
      columns: [...new Set(kids.map((k) => `${k.left}|${k.right}`))],
      kids,
      ledgerOverflow: led.scrollWidth - led.clientWidth,
      captionAboveChart:
        !!cap && !!wrap && cap.compareDocumentPosition(wrap) === Node.DOCUMENT_POSITION_FOLLOWING,
      e1rmColumns: [...led.querySelectorAll("th")].filter((h) => /e1rm/i.test(h.textContent)).length,
    };
  });
  assert(
    trendCard.columns.length === 1,
    "Every block in the strength trend card shares one text column",
    JSON.stringify(trendCard.kids)
  );
  assert(
    trendCard.ledgerOverflow === 0,
    "The record ledger fits the card instead of scrolling behind its edge",
    `overflow=${trendCard.ledgerOverflow}px`,
    "Stats → Strength trend → the ledger's last column is whole"
  );
  assert(
    trendCard.captionAboveChart && trendCard.e1rmColumns === 0,
    "The e1RM caption labels the chart it belongs to, and the number is printed once",
    JSON.stringify(trendCard)
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
    progFile.version === 3 && Array.isArray(progExercises) && progExercises.length > 0 && progFile.meta?.id &&
      Array.isArray(progFile.customExercises),
    "Program export is v3 with meta, exercises and referenced custom definitions",
    `Got: ${JSON.stringify(progFile).slice(0, 120)}`,
    "Program → Advanced → Export program JSON"
  );
  assert(
    /^taurifer_program_.+\.json$/.test(progDl.suggestedFilename()),
    "Program export filename carries a slug segment",
    `filename=${progDl.suggestedFilename()}`,
    "Program → Advanced → Export program JSON with a named program"
  );
  const logBefore = (await getState(page)).log.length;
  progExercises[0].name = "IMPORTED_RENAME";
  // A renamed row no longer matches the library, so it arrives unmatched and
  // has to be confirmed — which is the point of the review step.
  delete progExercises[0].libraryId;
  progFile.exercises = progExercises;
  progFile.meta = { ...progFile.meta, name: "Imported Template", started: "2020-01-01", id: "foreign-id" };
  writeFileSync(progPath, JSON.stringify(progFile));
  const stateBeforeImport = await getState(page);
  const metaBeforeImport = stateBeforeImport.programMeta;
  const programBeforeImport = stateBeforeImport.program;
  const importDraft = await page.evaluate((k) => {
    const raw = JSON.stringify({
      __sessionNotes: "unfinished before program import",
      __contextTouched: { sessionNotes: true },
    });
    localStorage.setItem(k, raw);
    return raw;
  }, DRAFT);
  await page.setInputFiles("#importProgram", progPath);
  await page.waitForSelector("#importReview.active", { timeout: 5000 });
  const stagedProgram = (await getState(page)).program;
  assert(
    !stagedProgram.some((x) => x.name === "IMPORTED_RENAME"),
    "Program import writes nothing until it is confirmed",
    "the imported name appeared before Import was pressed",
    "Import program JSON → review screen"
  );
  await reviewAndCommitImport(page);
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
    "Program import applies meta from the exported file",
    `programMeta.name=${stAfter.programMeta?.name}`,
    "Export v2 program → edit meta.name → Import program JSON"
  );
  assert(
    stAfter.programMeta.id !== metaBeforeImport.id && stAfter.programMeta.id !== "foreign-id" &&
      stAfter.programMeta.started !== "2020-01-01",
    "Program import creates a fresh local active-program identity",
    `started=${stAfter.programMeta?.started}; old id=${metaBeforeImport.id}; active id=${stAfter.programMeta?.id}`,
    "Export v2 → edit meta.started/id in file → Import program JSON"
  );
  const importedArchive = stAfter.programHistory.filter((entry) => entry.id === metaBeforeImport.id);
  assert(
    importedArchive.length === 1 &&
      JSON.stringify(importedArchive[0].program) === JSON.stringify(programBeforeImport) &&
      importedArchive[0].meta?.id === metaBeforeImport.id,
    "Program import archives the outgoing program exactly once",
    JSON.stringify(importedArchive),
    "Import program JSON → activate → inspect programHistory"
  );
  assert(
    stAfter.log.length === logBefore,
    "Program import leaves the log untouched",
    `log ${logBefore} → ${stAfter.log.length}`,
    "Import program JSON → History unchanged"
  );
  assert(
    importDraft && (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) == null,
    "Accepted program import clears the confirmed unfinished draft",
    "draft remained after accepted program replacement",
    "Seed active draft → Import program JSON → confirm"
  );

  // Legacy array-only import still works
  const legacyPath = join(tmpDir, "program-legacy.json");
  writeFileSync(legacyPath, JSON.stringify(stAfter.program.slice(0, 3)));
  await page.setInputFiles("#importProgram", legacyPath);
  await page.waitForSelector("#importReview.active", { timeout: 5000 });
  await reviewAndCommitImport(page);
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
  await page.waitForSelector("#importReview.active", { timeout: 5000 });
  await reviewAndCommitImport(page);
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

  // Unsaved text survives a render, so collapsing Advanced is what throws a
  // broken edit away — the only route back to the program's own JSON.
  await page.evaluate(() => document.querySelector("#program details.advanced")?.removeAttribute("open"));
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  await page.waitForTimeout(100);
  assert(
    await page
      .evaluate(() => {
        try {
          return Array.isArray(JSON.parse(document.querySelector("#programJson").value));
        } catch {
          return false;
        }
      }),
    "Collapsing Advanced discards an unsaveable JSON draft",
    "textarea still holds the invalid text after reopening Advanced",
    "Program → Advanced → invalid JSON → collapse → reopen"
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

  // Renaming a library-linked slot in raw JSON has to land. resolveIdentity
  // re-derives name from the definition, so without alias translation the edit
  // used to disappear behind a "Program saved." toast.
  const linkedIdx = after.findIndex((e) => e.libraryId);
  if (linkedIdx >= 0) {
    const linkedId = after[linkedIdx].id;
    const canonicalName = after[linkedIdx].name;
    const renamed = JSON.parse(JSON.stringify(after));
    renamed[linkedIdx].name = "Hammer Strength press";
    await jsonArea.fill(JSON.stringify(renamed, null, 2));
    await page.click("#saveProgram");
    await page.waitForTimeout(200);
    state = await getState(page);
    let linkedRow = state.program.find((e) => e.id === linkedId);
    assert(
      linkedRow?.name === "Hammer Strength press" &&
        linkedRow?.displayName === "Hammer Strength press" &&
        !!linkedRow?.libraryId,
      "Renaming a linked exercise in raw JSON saves as an alias",
      `stored ${JSON.stringify(linkedRow)}`,
      "Program → Advanced → rename a linked exercise → Save JSON"
    );

    // Muscles stay the definition's. The edit cannot be honoured, so the toast
    // has to say so instead of reverting in silence.
    const muscled = JSON.parse(await jsonArea.inputValue());
    const muscledIdx = muscled.findIndex((e) => e.id === linkedId);
    const canonicalPrimary = muscled[muscledIdx].primary;
    muscled[muscledIdx].primary = "Calves";
    await jsonArea.fill(JSON.stringify(muscled, null, 2));
    await page.click("#saveProgram");
    await page.waitForTimeout(200);
    const muscleToast = (await page.locator("#toast").textContent()) || "";
    state = await getState(page);
    linkedRow = state.program.find((e) => e.id === linkedId);
    assert(
      /detach/i.test(muscleToast) && linkedRow?.primary === canonicalPrimary,
      "Muscle edits on a linked exercise are reported, not silently dropped",
      `toast="${muscleToast}" primary=${linkedRow?.primary}`,
      "Program → Advanced → edit a linked exercise's muscles → Save JSON"
    );

    // Put the canonical name back so later phases see the stock program.
    const restored = JSON.parse(await jsonArea.inputValue());
    restored.find((e) => e.id === linkedId).name = canonicalName;
    await jsonArea.fill(JSON.stringify(restored, null, 2));
    await page.click("#saveProgram");
    await page.waitForTimeout(200);
    state = await getState(page);
    linkedRow = state.program.find((e) => e.id === linkedId);
    assert(
      linkedRow?.name === canonicalName && linkedRow?.displayName === undefined,
      "Renaming a linked exercise back to the library name clears the alias",
      `stored ${JSON.stringify(linkedRow)}`,
      "Program → Advanced → restore the library name → Save JSON"
    );
  }

  // An unsaved JSON draft must survive a render it did not cause; only a real
  // program change underneath is newer and allowed to replace it.
  const draftRows = JSON.parse(await jsonArea.inputValue());
  const originalSets = draftRows[0].sets;
  draftRows[0].sets = 9;
  await jsonArea.fill(JSON.stringify(draftRows, null, 2));
  await page.evaluate(() => document.querySelector("#programJson").blur());
  await page.evaluate(() => window.render?.());
  await page.waitForTimeout(100);
  assert(
    JSON.parse(await jsonArea.inputValue())[0].sets === 9,
    "Unsaved raw JSON survives an unrelated re-render",
    "textarea was reset before Save JSON",
    "Program → Advanced → edit JSON → blur → render() → text still there"
  );
  const firstExerciseId = draftRows[0].id;
  const firstRow = page.locator(`#programEditor [data-role="exercise"][data-id="${firstExerciseId}"]`);
  if (!(await firstRow.evaluate((element) => element.classList.contains("is-expanded"))))
    await firstRow.locator('[data-role="toggle-exercise"]').click();
  await firstRow.locator('[data-role="adjust"][data-field="sets"][data-delta="1"]').click();
  await applyProgramEditor(page);
  await nav(page, "program");
  await page.evaluate(() => document.querySelector("#program details.advanced")?.setAttribute("open", ""));
  const afterEditorChange = JSON.parse(await jsonArea.inputValue());
  assert(
    afterEditorChange[0].sets === originalSets + 1 && afterEditorChange[0].sets !== 9,
    "A visual-editor change refreshes the raw JSON over a stale draft",
    `sets0=${afterEditorChange[0].sets}`,
    "Program → edit JSON → adjust sets → Done → textarea shows the new program"
  );
  // Restore the scratch set change so later phases see the program they expect.
  afterEditorChange[0].sets = originalSets;
  await jsonArea.fill(JSON.stringify(afterEditorChange, null, 2));
  await page.click("#saveProgram");
  await page.waitForTimeout(200);

  // ── Phase 11: Edge cases & invariants ────────────────────────────
  beginPhase("Phase 11: Edge cases");

  // Backdated date in UI
  await nav(page, "log");
  const backdate = "2020-01-15";
  const logDay =
    (await page.locator('#dayTabs button[data-day="Day 2"]').count()) > 0
      ? "Day 2"
      : await page.locator("#dayTabs button").first().getAttribute("data-day");
  await selectDay(page, logDay);
  await setLogDate(page, backdate);
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
  await dismissSessionSummary(page);
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
  await dismissSessionSummary(page);
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
  const malformedProgramPath = join(tmpDir, "bad-program-shape.json");
  writeFileSync(malformedProgramPath, JSON.stringify({ ...state, program: { not: "an array" } }));
  await page.setInputFiles("#importJson", malformedProgramPath);
  await page.waitForTimeout(200);
  const malformedProgramImport = await page.evaluate(() => ({
    toast: document.querySelector("#toast")?.textContent || "",
    chooserOpen: !document.querySelector("#importChoice")?.classList.contains("hidden"),
    programIsArray: Array.isArray(JSON.parse(localStorage.getItem("repforge_v1") || "null")?.program),
  }));
  assert(
    !malformedProgramImport.chooserOpen &&
      malformedProgramImport.programIsArray &&
      /valid|backup/i.test(malformedProgramImport.toast),
    "Backup import rejects an object-shaped program before offering Replace",
    JSON.stringify(malformedProgramImport),
    "Settings → Import backup with program object instead of array"
  );

  // ── Phase 12: All-tier upgrades ──────────────────────────────────
  beginPhase("Phase 12: Progression + UX + hypertrophy upgrades");

  await resetWithSeedProgram(page);

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
  await resetWithSeedProgram(page);
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
      /strength rose across 3 sessions/i.test(blockNote || ""),
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
      /exceeded the target.*increases to/is.test(dynUpNote || ""),
      "In-session note explains the upward nudge",
      `note="${dynUpNote}"`,
      "Easy set 1 → highlighted note explains the higher target"
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
      dynEditedLoad2 < dynBaseLoad2 && /missed the target.*decreases to/is.test(dynEditedNote || ""),
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
      /abaixo da meta.*diminui para/is.test(dynDownNote || ""),
      "In-session note explains the downward ease in Portuguese",
      `note="${dynDownNote}"`,
      "Portuguese UI + short set 1 → localized highlighted note"
    );
    const blockNotePt = await page
      .locator(`.exercise[data-ex="${dynEx.id}"] .rec__block`)
      .textContent()
      .catch(() => "");
    assert(
      /força subiu em 3 sessões/i.test(blockNotePt || ""),
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
        /smallest load increase/i.test(tempered?.text || ""),
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
    await resetWithSeedProgram(page);
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
      /start with \d+ reps at your usual effort/i.test(reentryNote || ""),
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
      /reps have dropped in this session/i.test(dropNote || ""),
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
      steadySet2 < 8 && /stays at/i.test(steadyNote || "") && !/have dropped/i.test(steadyNote || ""),
      "A target eased only by the lifter's typical RIR is not reported as a downward trend",
      `set2 reps=${steadySet2} note="${steadyNote}"`,
      "One completed set of 8 @ RIR 1, typical RIR 2, no drop history → set 2 targets 7 reps with log.insession.hold, NOT log.insession.drop"
    );

    // ── Session freshness: temper-only cross-exercise signal ──────
    await resetWithSeedProgram(page);
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
      /below their usual level/i.test(temperNote || ""),
      "The temper note states the measured signal without exposing the arithmetic",
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
    await resetWithSeedProgram(page);
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
    const recOf = (id) => page.evaluate((id) => {
      const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const ex = (raw.program || []).find((e) => e.id === id);
      const r = window.__repforgeRecommendation?.(ex);
      const last = window.__repforgeCapacity.sessionsFor(ex).at(-1);
      const loads = (raw.log || []).filter((x) => x.exerciseId === id).map((x) => +x.load);
      return r && {
        status: r.status, load: r.load, stalled: !!r.stalled, label: r.label,
        reenterReps: !!r.reenterReps, med: last.med, cap: r.cap, medCap: last.medCap,
        historyLoads: loads,
      };
    }, id);
    const f1Cases = [
      {
        key: "stalled",
        status: "reduce",
        stalled: true,
        reenter: true,
        firstReps: 6,
        label: /stalled/i,
        dates: ["2025-05-01", "2025-05-08", "2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 7, 1, `stall_${i}`),
      },
      {
        key: "recover",
        status: "hold",
        stalled: false,
        reenter: true,
        firstReps: 6,
        label: /recover/i,
        dates: ["2025-05-01", "2025-05-08"],
        session: (ex, date, i) => mixedRows(ex, date, 7, i === 1 ? 0 : 1, `rec_${i}`),
      },
      {
        key: "push_reps",
        status: "hold",
        stalled: false,
        reenter: true,
        firstReps: 6,
        label: /add reps/i,
        dates: ["2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 6, 2, `push_${i}`),
      },
      {
        key: "hold",
        status: "hold",
        stalled: false,
        reenter: true,
        firstReps: 6,
        label: /hold\s*·\s*add reps/i,
        dates: ["2025-05-15"],
        session: (ex, date, i) => mixedRows(ex, date, 7, 1, `hold_${i}`),
      },
    ];

    await resetWithSeedProgram(page);
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
      const rec = await recOf(c.ex.id);
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
      assert(
        rec.reenterReps === c.reenter && rec.med === RAW_MED && rec.cap === rec.medCap,
        `F1: ${c.key} snapped hold re-enters; capacity stays at the raw median`,
        JSON.stringify(rec),
        `${c.key} 53.75 → 55 sets reenterReps; l.med stays the ADR 0003 reference`
      );

      await nav(page, "log");
      await selectDay(page, "Day 1");
      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      const logReps = +(await page.inputValue(`[data-k="${c.ex.id}_1_reps"]`));
      assert(
        logReps === c.firstReps,
        `F1: ${c.key} first-set Log reps follow capacity re-entry`,
        `reps=${logReps} expected=${c.firstReps}`,
        `Log → ${c.key} set 1 reps`
      );
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
      const cueReps = +(await page.locator(".exercise.is-current .curset__val[data-k$='_reps']").inputValue());
      assert(
        /55/.test(cue || "") && !/53\.75/.test(cue || "") && cueLoad === "55",
        `F1: ${c.key} untouched Focus first-set cue is on-grid`,
        `cue="${cue}" input=${cueLoad}`,
        `Focus → first set of ${c.key} lift`
      );
      assert(
        cueReps === c.firstReps && new RegExp(`aim for ${c.firstReps} reps`).test(cue || ""),
        `F1: ${c.key} Focus first-set reps re-enter at the snapped load`,
        `cue="${cue}" reps=${cueReps} expected=${c.firstReps}`,
        `Focus → first set of ${c.key} lift reps`
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

    const kg1Rows = (ex, date, reps, rir, tag) => {
      const session = `${date}_${ex.day}_f1_1kg_${ex.id}_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return [1, 1].map((load, i) => ({
        session, date, day: ex.day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps, rir, notes: "", created, primary: ex.primary, secondary: ex.secondary,
      }));
    };
    const kg1Log = [];
    f1Cases.forEach((c) => {
      c.dates.forEach((date, i) => {
        const sample = c.session(c.ex, date, i)[0];
        kg1Log.push(...kg1Rows(c.ex, date, sample.reps, sample.rir, `${c.key}_${i}`));
      });
    });
    const kg1State = await getState(page);
    await persistState(page, {
      ...kg1State,
      settings: { ...kg1State.settings, minJump: 2.5, unit: "kg", lang: "en", rirMode: "numeric" },
      log: kg1Log,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);

    for (const c of f1Cases) {
      const rec = await recOf(c.ex.id);
      assert(
        rec?.status === c.status && rec?.stalled === c.stalled && c.label.test(rec?.label || ""),
        `F1: 1 kg ${c.key} branch still fires`,
        JSON.stringify(rec),
        `Seed 1 kg history → recommendation() ${c.key}`
      );
      assert(
        rec?.historyLoads?.length && rec.historyLoads.every((kg) => kg === 1) && rec?.load === 2.5 && rec.load > 0 && onGrid(rec.load),
        `F1: 1 kg ${c.key} hold clamps to minJump, history stays 1 kg`,
        `load=${rec?.load} history=${JSON.stringify(rec?.historyLoads)}`,
        `${c.key} 1 kg median → round would be 0; clamp to 2.5`
      );
      assert(
        rec.reenterReps === c.reenter && rec.med === 1 && rec.cap === rec.medCap,
        `F1: 1 kg ${c.key} snapped hold re-enters; capacity stays at the raw median`,
        JSON.stringify(rec),
        `${c.key} 1 → 2.5 sets reenterReps; l.med stays the ADR 0003 reference`
      );

      await nav(page, "log");
      await selectDay(page, "Day 1");
      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      const logReps1 = +(await page.inputValue(`[data-k="${c.ex.id}_1_reps"]`));
      assert(
        logReps1 === c.firstReps,
        `F1: 1 kg ${c.key} first-set Log reps follow capacity re-entry`,
        `reps=${logReps1} expected=${c.firstReps}`,
        `Log → 1 kg ${c.key} set 1 reps`
      );

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
      const cueReps = +(await page.locator(".exercise.is-current .curset__val[data-k$='_reps']").inputValue());
      assert(
        cueLoad === "2.5" && !/^0(?:\.0+)?$/.test(cueLoad) && /2\.5/.test(cue || "") && !/\b0(?:\.0+)?\s*kg/.test(cue || ""),
        `F1: 1 kg ${c.key} first-set prefill is a positive grid load`,
        `cue="${cue}" input=${cueLoad}`,
        `Focus → first set of 1 kg ${c.key} lift`
      );
      assert(
        cueReps === c.firstReps && new RegExp(`aim for ${c.firstReps} reps`).test(cue || ""),
        `F1: 1 kg ${c.key} Focus first-set reps re-enter at the snapped load`,
        `cue="${cue}" reps=${cueReps} expected=${c.firstReps}`,
        `Focus → first set of 1 kg ${c.key} lift reps`
      );
      await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    }

    const hold1 = f1Cases.find((c) => c.key === "hold").ex;
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.fill(`[data-k="${hold1.id}_1_load"]`, "1");
    await page.fill(`[data-k="${hold1.id}_1_reps"]`, "7");
    await page.fill(`[data-k="${hold1.id}_1_rir"]`, "1");
    await page.click(`.saveset[data-save="${hold1.id}_1"]`);
    await page.waitForTimeout(120);
    const echoed1 = +(await page.inputValue(`[data-k="${hold1.id}_2_load"]`));
    assert(
      echoed1 === 1,
      "F1: in-session hold still echoes a 1 kg committed load",
      `set2=${echoed1}`,
      "Commit 1 kg on set 1 → set 2 suggestion stays 1 (history clamp does not apply)"
    );

    const gridHold = f1Cases.find((c) => c.key === "hold").ex;
    const gridRows = (ex, date, tag) => {
      const session = `${date}_${ex.day}_f1_grid_${ex.id}_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return [55, 55].map((load, i) => ({
        session, date, day: ex.day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps: 7, rir: 1, notes: "", created, primary: ex.primary, secondary: ex.secondary,
      }));
    };
    const gridState = await getState(page);
    await persistState(page, {
      ...gridState,
      settings: { ...gridState.settings, minJump: 2.5, unit: "kg", lang: "en", rirMode: "numeric" },
      log: gridRows(gridHold, "2025-05-15", "hold"),
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    const gridRec = await recOf(gridHold.id);
    assert(
      gridRec.med === 55 && gridRec.load === 55 && gridRec.reenterReps === false,
      "F1: exact on-grid hold does not re-enter",
      JSON.stringify(gridRec),
      "55/55 @ 7 → reenterReps is false"
    );
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const gridLogReps = +(await page.inputValue(`[data-k="${gridHold.id}_1_reps"]`));
    assert(
      gridLogReps === 8,
      "F1: on-grid hold first-set Log reps add one",
      `reps=${gridLogReps}`,
      "Log → on-grid hold set 1 reps"
    );
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await page.evaluate(({ id, day }) => {
      window.__repforgeEnterWorkout?.({ focus: true, day });
      const fl = window.__repforgeFocus?.list?.() || [];
      const i = fl.findIndex((e) => e.id === id);
      if (i >= 0) window.__repforgeFocus.to(i);
    }, { id: gridHold.id, day: "Day 1" });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const gridCue = await page.locator(".exercise.is-current .focus-cue__text").textContent();
    const gridCueReps = +(await page.locator(".exercise.is-current .curset__val[data-k$='_reps']").inputValue());
    assert(
      gridCueReps === 8 && /aim for 8 reps/.test(gridCue || ""),
      "F1: on-grid hold Focus first-set reps add one",
      `cue="${gridCue}" reps=${gridCueReps}`,
      "Focus → on-grid hold first set reps"
    );
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());

    const driftInc = 0.1, driftLoad = 1.2;
    const driftRows = (ex, date, tag) => {
      const session = `${date}_${ex.day}_f1_drift_${ex.id}_${tag}`;
      const created = new Date(`${date}T12:00:00Z`).toISOString();
      return [driftLoad, driftLoad].map((load, i) => ({
        session, date, day: ex.day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps: 7, rir: 1, notes: "", created, primary: ex.primary, secondary: ex.secondary,
      }));
    };
    const driftState = await getState(page);
    await persistState(page, {
      ...driftState,
      settings: { ...driftState.settings, minJump: driftInc, unit: "kg", lang: "en", rirMode: "numeric" },
      log: driftRows(gridHold, "2025-05-15", "hold"),
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    const driftRec = await recOf(gridHold.id);
    assert(
      driftRec.med === driftLoad && driftRec.reenterReps === false && driftRec.load > 0,
      "F1: fractional-grid hold does not re-enter",
      JSON.stringify(driftRec),
      "minJump 0.1, 1.2/1.2 @ 7 → reenterReps stays false"
    );
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const driftLogReps = +(await page.inputValue(`[data-k="${gridHold.id}_1_reps"]`));
    assert(
      driftLogReps === 8,
      "F1: fractional-grid hold first-set Log reps add one",
      `reps=${driftLogReps}`,
      "Log → 0.1 kg grid hold set 1 reps"
    );
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await page.evaluate(({ id, day }) => {
      window.__repforgeEnterWorkout?.({ focus: true, day });
      const fl = window.__repforgeFocus?.list?.() || [];
      const i = fl.findIndex((e) => e.id === id);
      if (i >= 0) window.__repforgeFocus.to(i);
    }, { id: gridHold.id, day: "Day 1" });
    await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 5000 });
    const driftCue = await page.locator(".exercise.is-current .focus-cue__text").textContent();
    const driftCueReps = +(await page.locator(".exercise.is-current .curset__val[data-k$='_reps']").inputValue());
    assert(
      driftCueReps === 8 && /aim for 8 reps/.test(driftCue || ""),
      "F1: fractional-grid hold Focus first-set reps add one",
      `cue="${driftCue}" reps=${driftCueReps}`,
      "Focus → 0.1 kg grid hold first set reps"
    );
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  }

  await resetWithSeedProgram(page);

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
  const noteExerciseId = await page.locator('#programEditor [data-role="exercise"]').first().getAttribute("data-id");
  await revealProgramExerciseDetails(page, noteExerciseId);
  const noteInput = page.locator(`#programEditor [data-role="exercise"][data-id="${noteExerciseId}"] [data-field="notes"]`);
  await noteInput.fill(note);
  await noteInput.blur();
  await applyProgramEditor(page);
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

  // Fatigue trim skips exactly the flagged (backing-off/stalled) lifts
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
  // Everything logged so far carries today's date, so Today is in its
  // completed-session state: a recap, and no session on offer.
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.waitForSelector("#todayDash:not(.hidden)", { timeout: 5000 });
  const doneState = await page.evaluate(() => ({
    recap: !!document.querySelector(".today-done"),
    start: !!document.querySelector("#startWorkout:not(.hidden)"),
    ready: !!document.querySelector("#readyLine"),
  }));
  assert(
    doneState.recap && !doneState.start && !doneState.ready,
    "Today recaps the day once a session is saved for it",
    JSON.stringify(doneState),
    "Save a session dated today → Today drops the start CTA for a recap"
  );

  // The readiness line belongs to the session Today is offering, so move the
  // ledger back a day to get an untrained day and the line that comes with it.
  await backdateLog(page, 1);
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
  const editBtn = page.locator("#sessions .session__open").first();
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
  // The floating clock opens the timer sheet; it never ends the rest on its own.
  await page.click("#restBar");
  await page.waitForTimeout(350);
  const restSheet = await page.evaluate(() => {
    const el = document.querySelector("#restSheet");
    return {
      open: !el.hidden && el.classList.contains("is-open"),
      running: !document.querySelector("#restBar").classList.contains("hidden"),
      clock: document.querySelector("#restSheetClock").textContent.trim(),
    };
  });
  assert(
    restSheet.open && restSheet.running && /^\d+:\d\d$/.test(restSheet.clock),
    "Tapping the floating clock opens the rest timer instead of ending it",
    JSON.stringify(restSheet),
    "Log → tap the floating clock → the rest timer sheet opens with the rest still running"
  );
  await page.click("#restStop");
  await page.waitForTimeout(350);
  assert(
    await page.evaluate(
      () =>
        document.querySelector("#restSheet").hidden &&
        document.querySelector("#restBar").classList.contains("hidden")
    ),
    "Stop in the rest sheet ends the rest and closes it",
    "sheet or floating clock still showing",
    "Rest timer → Stop → the sheet closes and the clock is gone"
  );

  // Glossary explains RIR on tap
  await page.click("#workout .term[data-term='RIR']");
  await page.waitForTimeout(80);
  assert(
    !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
      /reps you could still complete before failure/i.test(
        await page.locator("#glossary .glossary__body").textContent()
      ),
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

  // ── "Why this weight?" inspector (plan 043) ──────────────────────
  // The engine tags its own result with the branch that fired; the sheet only
  // renders those fields. These checks pin the tag-to-copy mapping per rule
  // family, the hidden-for-new-lifts rule, and the modal contract.
  beginPhase("Phase: why-this-weight inspector");
  {
    const whyRows = (ex, date, n, load, reps, rir, tag) =>
      Array.from({ length: n }, (_, i) => ({
        session: `${date}_${ex.day}_why_${ex.id}_${tag}`,
        date, day: ex.day, name: ex.name, exerciseId: ex.id, set: i + 1,
        load, reps, rir, notes: "", created: new Date(`${date}T12:00:00Z`).toISOString(),
        primary: ex.primary, secondary: ex.secondary,
      }));
    // Each seed is chosen so exactly one trigger can fire on a single session:
    // no stall history, no recover signal, and fewer than three sessions, so
    // the block trend never tempers the result.
    const whyCases = [
      { key: "cap_top", i: 0, sets: 2, reps: 6, rir: 3 },
      { key: "top", i: 1, sets: 3, reps: 8, rir: 1 },
      { key: "below_range", i: 2, sets: 2, reps: 4, rir: 0 },
    ];
    await resetWithSeedProgram(page);
    const whyState = await getState(page);
    const whyDay1 = whyState.program
      .filter((e) => e.day === "Day 1")
      .sort((a, b) => a.order - b.order);
    assert(
      whyDay1.length >= 4,
      "Why sheet: Day 1 has a lift per rule family plus one never-trained lift",
      `count=${whyDay1.length}`,
      "Default program → Day 1"
    );
    const whyPatch = new Map();
    const whyLog = [];
    for (const c of whyCases) {
      const ex = { ...whyDay1[c.i], sets: c.sets, min: 6, max: 8 };
      c.ex = ex;
      whyPatch.set(ex.id, { sets: c.sets, min: 6, max: 8 });
      whyLog.push(...whyRows(ex, "2025-05-15", c.sets, 100, c.reps, c.rir, c.key));
    }
    // The fourth Day 1 lift is deliberately left without history: status "new".
    const whyNewEx = whyDay1[3];
    await persistState(page, {
      ...whyState,
      settings: { ...whyState.settings, minJump: 2.5, jumpPct: 2.5, unit: "kg", lang: "en", rirMode: "numeric" },
      program: whyState.program.map((e) => (whyPatch.has(e.id) ? { ...e, ...whyPatch.get(e.id) } : e)),
      log: whyLog,
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);

    /** Read the engine's own result for a lift — never hard-code a target. */
    const whyRecOf = (id) =>
      page.evaluate((id) => {
        const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
        const slot = (raw.program || []).find((e) => e.id === id);
        const r = window.__repforgeRecommendation(slot);
        return { status: r.status, reason: r.reason, load: r.load, cr: r.cr, jumpMult: r.jumpMult };
      }, id);
    const openWhyFrom = async (id) => {
      await page.click(`.exercise[data-ex="${id}"] [data-why]`);
      await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
      return page.evaluate(() => ({
        target: document.querySelector("#whyTarget")?.textContent || "",
        body: document.querySelector("#whyBody")?.innerText || "",
        focus: document.activeElement?.id || "",
      }));
    };
    const closeWhy = async () => {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#whySheet")?.hidden === true, null, { timeout: 5000 });
    };

    await nav(page, "log");
    await selectDay(page, "Day 1");

    // 1. cap_top — capacity clears the range top, so the load moves on capacity.
    const capRec = await whyRecOf(whyCases[0].ex.id);
    const capSheet = await openWhyFrom(whyCases[0].ex.id);
    assert(
      capRec.reason === "cap_top" && /tops out at 8/.test(capSheet.body) && /about 9/.test(capSheet.body),
      "Why sheet: cap_top renders the range-top rule with the demonstrated reps",
      `reason=${capRec.reason} body=${JSON.stringify(capSheet.body)}`,
      "Seed 2×(100×6 @ RIR 3) on a 6-8 lift → Log card → Why this weight?"
    );
    assert(
      capSheet.body.includes(String(capRec.load)) && capSheet.target.includes(String(capRec.load)),
      "Why sheet: the load row and headline show the engine's own target",
      `load=${capRec.load} target=${JSON.stringify(capSheet.target)} body=${JSON.stringify(capSheet.body)}`,
      "Compare #whyBody against recommendation().load for the seeded lift"
    );
    await closeWhy();

    // 2. top — every performed set reached the range top; that naming wins.
    const topRec = await whyRecOf(whyCases[1].ex.id);
    const topSheet = await openWhyFrom(whyCases[1].ex.id);
    assert(
      topRec.reason === "top" && /Every set reached the top/.test(topSheet.body),
      "Why sheet: performed reps at the top name the top rule, not the capacity rule",
      `reason=${topRec.reason} body=${JSON.stringify(topSheet.body)}`,
      "Seed 3×(100×8 @ RIR 1) on a 6-8 lift → Why this weight?"
    );
    await closeWhy();

    // 3. below_range — capacity falls short of the range floor, so the load drops.
    const downRec = await whyRecOf(whyCases[2].ex.id);
    const downSheet = await openWhyFrom(whyCases[2].ex.id);
    assert(
      downRec.reason === "below_range" && /below the range floor of 6/.test(downSheet.body),
      "Why sheet: below_range renders the range-floor rule",
      `reason=${downRec.reason} body=${JSON.stringify(downSheet.body)}`,
      "Seed 2×(100×4 @ RIR 0) on a 6-8 lift → Why this weight?"
    );
    assert(
      /minus/.test(downSheet.body) && downSheet.body.includes(String(downRec.load)) && downRec.load < 100,
      "Why sheet: a reduced load renders a subtraction row ending on the new target",
      `load=${downRec.load} body=${JSON.stringify(downSheet.body)}`,
      "below_range seed → #whyBody load row"
    );
    await closeWhy();

    // 4. A never-trained lift has no arithmetic to show, so it offers no button.
    const newHasWhy = await page.locator(`.exercise[data-ex="${whyNewEx.id}"] [data-why]`).count();
    const newStatus = await whyRecOf(whyNewEx.id);
    assert(
      newStatus.status === "new" && newHasWhy === 0,
      "Why sheet: never-trained lifts render no why button",
      `status=${newStatus.status} buttons=${newHasWhy}`,
      "Log → an untrained Day 1 lift card"
    );

    // 5. Escape closes and hands focus back to the exact opener.
    await page.click(`.exercise[data-ex="${whyCases[0].ex.id}"] [data-why]`);
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const focusOnOpen = await page.evaluate(() => document.activeElement?.id || "");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#whySheet")?.hidden === true, null, { timeout: 5000 });
    const focusAfter = await page.evaluate(() => document.activeElement?.dataset?.why || "");
    assert(
      focusOnOpen === "whyClose" && focusAfter === whyCases[0].ex.id,
      "Why sheet: Escape closes the sheet and restores focus to the opener",
      `open=${focusOnOpen} after=${focusAfter} expected=${whyCases[0].ex.id}`,
      "Open the sheet from a Log card → press Escape"
    );

    // 6. Portuguese renders the affordance and the rule in real Portuguese.
    await persistState(page, { ...(await getState(page)), settings: { ...(await getState(page)).settings, lang: "pt" } });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const ptLabel = await page.locator(`.exercise[data-ex="${whyCases[0].ex.id}"] [data-why]`).textContent();
    const ptSheet = await openWhyFrom(whyCases[0].ex.id);
    assert(
      /Por que essa carga\?/.test(ptLabel || "") && /topo da faixa/.test(ptSheet.body),
      "Why sheet: Portuguese renders the affordance and the rule line",
      `label=${JSON.stringify(ptLabel)} body=${JSON.stringify(ptSheet.body)}`,
      "Switch lang to pt → Log card → Por que essa carga?"
    );
    await closeWhy();

    // 7. Effort mode never prints an RIR number in the capacity line.
    await persistState(page, {
      ...(await getState(page)),
      settings: { ...(await getState(page)).settings, lang: "en", rirMode: "effort" },
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    const effortSheet = await openWhyFrom(whyCases[0].ex.id);
    assert(
      /the effort you logged/.test(effortSheet.body) && !/up to 4 RIR/.test(effortSheet.body),
      "Why sheet: effort mode names the logged effort instead of an RIR cap",
      `body=${JSON.stringify(effortSheet.body)}`,
      "Settings → effort RIR mode → Log card → Why this weight?"
    );
    await closeWhy();

    // 8. The exercise detail page is the third entry point into the same sheet.
    await persistState(page, {
      ...(await getState(page)),
      settings: { ...(await getState(page)).settings, lang: "en", rirMode: "numeric" },
    });
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await page.click(`.exercise[data-ex="${whyCases[0].ex.id}"] [data-exopen="${whyCases[0].ex.id}"]`);
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    const detailWhy = await page.locator("#exDetail [data-why]").count();
    await page.click("#exDetail [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const detailBody = await page.evaluate(() => document.querySelector("#whyBody")?.innerText || "");
    assert(
      detailWhy === 1 && /tops out at 8/.test(detailBody),
      "Why sheet: the exercise page opens the same sheet for the same lift",
      `buttons=${detailWhy} body=${JSON.stringify(detailBody)}`,
      "Log → tap exercise name → #exDetail → Why this weight?"
    );
    await closeWhy();
    await page.click("#exBack");
    await page.waitForSelector("#log.view.active", { timeout: 5000 });

    // 9. Identity: the exercise page renders the raw slot whenever the workout is
    // not active, so a slot substituted earlier in the session must not make the
    // sheet explain the substitute's arithmetic under the slot's headline.
    const subEx = whyCases[0].ex;
    await selectDay(page, "Day 1");
    await page.evaluate((id) => {
      const art = document.querySelector(`.exercise[data-ex="${id}"]`);
      if (art?.classList.contains("is-skipped")) document.querySelector(`.ex__skip[data-skip="${id}"]`)?.click();
      if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
    }, subEx.id);
    await page.waitForTimeout(80);
    await page.click(`.subst__pick[data-sub="${subEx.id}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const subPicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll("#exPickList .pickrow")].find(
        (r) => (r.querySelector(".pickrow__name")?.textContent || "").trim().toLowerCase() === "leg press"
      );
      if (!row) return false;
      row.click();
      return true;
    });
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    assert(subPicked, "Why sheet: mid-session swap is available for the identity check", "Leg press row not found",
      "Log → the seeded lift's swap control → Leg press");
    // Leaving via a nav tab drops workoutActive but keeps the draft's substitution,
    // and closes the workout shell — so the visible way back in is the Today list,
    // which still shows the SLOT's name while the hidden card holds the substitute.
    // Click the real tab buttons rather than the harness nav(): their handler is
    // what drops workoutActive and closes the workout shell, which is the state
    // the repro needs.
    await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
    await page.waitForSelector("#stats.view.active", { timeout: 5000 });
    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    await page.waitForSelector(`#todayExList [data-exopen="${subEx.id}"]`, { timeout: 5000 });
    await page.click(`#todayExList [data-exopen="${subEx.id}"]`);
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    const idHead = (await page.locator("#exDetail .recblock__head").textContent()) || "";
    await page.click("#exDetail [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const idTarget = await page.evaluate(() => document.querySelector("#whyTarget")?.textContent || "");
    assert(
      idHead.trim().length > 0 && idTarget.trim() === idHead.trim(),
      "Why sheet: the exercise page's sheet explains the movement the page rendered",
      `head=${JSON.stringify(idHead)} target=${JSON.stringify(idTarget)}`,
      "Swap a lift mid-session → leave via a nav tab → reopen its exercise page → Why this weight?"
    );
    await closeWhy();
    await page.click("#exBack");
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    // Hand the next phase a clean draft: the swap above lives in the draft only.
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
  }

  beginPhase("Phase: exercise substitution");
  await nav(page, "program");
  let subState = await getState(page);
  const d1First = subState.program.filter((e) => e.name.includes("Hack squat") || e.name.includes("pendulum")).sort((a, b) => a.order - b.order)[0];
  // Search matches loosely ("leg press" also finds the single-leg and calf
  // variants), so rows are chosen by their exact displayed name.
  const pickExact = async (name) => {
    await page.fill("#exPickSearch", name);
    await page.waitForTimeout(150);
    return page.evaluate((n) => {
      const rows = [...document.querySelectorAll("#exPickList .pickrow")];
      const row = rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim().toLowerCase() === n.toLowerCase());
      if (!row) return false;
      row.click();
      return true;
    }, name);
  };
  // Alternates are picked from the library now, not typed as a comma string.
  // This slot ships with "Leg press" (a library movement) and "Pendulum squat"
  // (which the library has no row for) — both must come back preselected, or
  // opening the picker would quietly delete whichever it could not match.
  const altsBefore = (subState.program.find((e) => e.id === d1First.id)?.alternates || []).slice();
  await revealProgramExerciseDetails(page, d1First.id);
  await page.click(`#programEditor [data-role="alternates"][data-id="${d1First.id}"]`);
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  const preselected = await page.evaluate(() => (window.__repforgePickerSelection?.() || []).length);
  assert(
    preselected === altsBefore.length && altsBefore.length >= 2,
    "Existing alternates come back preselected, library-matched or not",
    `preselected=${preselected} existing=${JSON.stringify(altsBefore)}`,
    "Program tab → alternates row"
  );
  const altPicked = await pickExact("Pec deck");
  await page.click("#exPickDone");
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await applyProgramEditor(page);
  subState = await getState(page);
  const altRow = subState.program.find((e) => e.id === d1First.id);
  assert(
    altPicked && (altRow?.alternates || []).includes("Pec deck") &&
      altsBefore.every((n) => (altRow?.alternates || []).includes(n)),
    "Adding an alternate keeps the ones already there",
    `alternates=${JSON.stringify(altRow?.alternates)} before=${JSON.stringify(altsBefore)}`,
    "Program tab → alternates row → search 'Pec deck' → Done"
  );
  await nav(page, "log");
  const subDay = d1First.day;
  await selectDay(page, subDay);
  await page.evaluate((id) => {
    const art = document.querySelector(`.exercise[data-ex="${id}"]`);
    if (art?.classList.contains("is-skipped")) document.querySelector(`.ex__skip[data-skip="${id}"]`)?.click();
    if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
  }, d1First.id);
  await page.waitForTimeout(80);
  await page.click(`.subst__pick[data-sub="${d1First.id}"]`);
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  const swapped = await pickExact("Leg press");
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  assert(swapped, "Mid-session swap opens the library picker", "Leg press row not found in picker",
    "Log → an exercise's swap control → search 'Leg press'");
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
    "Log → swap control → pick Leg press → save"
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
  const performedLiftKey = subRow?.performedLibraryId ? `library:${subRow.performedLibraryId}` : null;
  await page.selectOption("#statExercise", performedLiftKey);
  await page.waitForTimeout(80);
  const chartRows = await page.evaluate((expected) => {
    const sel = document.querySelector("#statExercise").value;
    const log = JSON.parse(localStorage.getItem("repforge_v1")).log.filter((r) => !r.warmup);
    return sel === expected && log.some((r) =>
      r.performedLibraryId && `library:${r.performedLibraryId}` === expected);
  }, performedLiftKey);
  assert(
    chartRows,
    "Stats chart attributes substituted sessions to the performed movement",
    `performedLiftKey=${performedLiftKey}`,
    "Stats → select the performed substitute → chart has data"
  );

  // Unit toggle: draft loads convert on unit change; persisted log stays kg
  await resetWithSeedProgram(page);
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
    const cell = document.querySelector("#workout .exercise.is-current .focus-well .curset__cell.is-effort");
    const spin = cell?.querySelector("[data-effspin]");
    const steps = [...(cell?.querySelectorAll("[data-effstep]") || [])];
    return {
      hasCell: !!cell,
      role: spin?.getAttribute("role") || "",
      named: !!spin?.getAttribute("aria-label"),
      valueText: spin?.getAttribute("aria-valuetext") || "",
      hint: cell?.querySelector(".effortpop__hint")?.textContent?.trim() || "",
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
  await page.click("#workout .exercise.is-current .focus-well .saveset");
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
  const metaBeforeBeginner = (await getState(page)).programMeta;
  await page.evaluate(async () => {
    const current = JSON.parse(localStorage.getItem("repforge_v1") || "null");
    const source = current.program[0];
    const exercises = Array.from({ length: 18 }, (_, index) => ({
      ...source,
      id: `beginner-exercise-${index + 1}`,
      day: `Day ${Math.floor(index / 6) + 1}`,
      order: (index % 6) + 1,
      name: index === 0 ? "Leg press" : `Beginner exercise ${index + 1}`,
      notes: "Use a stable machine setup and controlled range.",
    }));
    await window.__repforgeFinalizeProgramSetup({
      exercises,
      name: "Beginner program",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "settings",
      draftConfirmed: true,
      telemetryRoute: "browse",
    });
    await window.__repforgeStorage.flush();
  });
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const begName = await page.locator("#workout .exercise .ex__name").first().textContent();
  assert(
    /Leg press/i.test(begName) && !/Hack squat/i.test(begName),
    "Beginner program shows plain exercise names",
    `name="${begName}"`,
    "Settings → Use beginner-friendly program → Log Day 1"
  );
  const begAfter = await getState(page);
  assert(
    begAfter.programMeta?.onboarded === true &&
      begAfter.programMeta?.id !== metaBeforeBeginner.id &&
      begAfter.programMeta?.name === "Beginner program" &&
      begAfter.programMeta?.mesocycleStatus === "active",
    "Beginner replacement mints a localized identity and start",
    JSON.stringify({
      id: begAfter.programMeta?.id,
      name: begAfter.programMeta?.name,
      onboarded: begAfter.programMeta?.onboarded,
    }),
    "Settings → beginner template → new programMeta id/name/onboarded"
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
  await page.waitForTimeout(350);
  const restChipTap = await page.evaluate(() => ({
    sheet: !document.querySelector("#restSheet").hidden,
    running: document.querySelector("#woRest").classList.contains("is-running"),
  }));
  assert(
    restChipTap.sheet && restChipTap.running,
    "tapping the running rest chip opens the timer rather than ending the rest",
    JSON.stringify(restChipTap),
    "Focus → tap the counting pill → the rest timer opens with the clock still running"
  );
  await page.click("#restStop");
  await page.waitForTimeout(350);
  assert(
    await page.evaluate(() => !document.querySelector("#woRest").classList.contains("is-running")),
    "Stop in the rest sheet returns the stopwatch chip",
    `running=${await page.evaluate(() => document.querySelector("#woRest").classList.contains("is-running"))}`,
    "Rest timer → Stop → rest ends and the stopwatch returns"
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
    "Focus → vertical gestures scroll the ledger; nothing else is claimed"
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
      const well = document.querySelector("#workout .exercise.is-current .focus-well")?.getBoundingClientRect();
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
    const ledger = document.querySelector("#workout .exercise.is-current .fcard__ledger").getBoundingClientRect();
    const save = document.querySelector("#workout .exercise.is-current .focus-well .saveset").getBoundingClientRect();
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
  await dismissSessionSummary(page);
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
  // The Start/Continue CTA only exists on a day with no session saved yet, and
  // the phases above have been logging against today.
  await backdateLog(page, 1);
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
  /* Anchor on the newest logged date rather than on today. An earlier phase
     backdates the whole log by a day so today reads as untrained, and weeks
     start on Monday — so on a Monday "today's week" holds nothing but today,
     and every backdated row sits in the week before it. What this checks is
     that sessionsInRange finds the sessions of the week it is handed. */
  const latestLogged = ((await getState(page))?.log || [])
    .map((row) => String(row.date))
    .sort()
    .at(-1);
  const sessionsInRange = await page.evaluate((anchor) => {
    const w = window.__repforgeWeek;
    const r = w.weekRange(anchor);
    return w.sessionsInRange(r.start, r.end).length;
  }, latestLogged);
  assert(
    sessionsInRange > 0,
    "sessionsInRange returns sessions for the week that was trained",
    `count=${sessionsInRange} anchor=${latestLogged}`,
    "After logging → __repforgeWeek.sessionsInRange(week of the newest logged row)"
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
  const validStatuses = [
    "On track",
    "PRs this week",
    "Below session target",
    "High fatigue",
    "Needs more data",
    "More sessions needed",
  ];
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

  beginPhase("Phase: F2 rolling-7 program adherence");
  {
    const f2Ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const f2Page = await f2Ctx.newPage();
    const f2PageErrors = [];
    f2Page.on("pageerror", (err) => f2PageErrors.push(String(err)));
    f2Page.on("dialog", async (dialog) => { await dialog.accept(); });
    try {
      const asOfNoon = new Date(2026, 7, 13, 12, 0, 0);
      await f2Page.clock.install({ time: asOfNoon });
      await loadApp(f2Page);
      await waitForApp(f2Page);
      const f2State = await getState(f2Page);
      const src = f2State.program?.[0] || {
        id: "f2-src", day: "Day 1", name: "F2 lift", order: 1, sets: 2, min: 4, max: 8,
        primary: "Quads", secondary: "",
      };
      const labels = ["F2 A", "F2 B", "F2 C", "F2 D", "F2 E"];
      const program = labels.map((day, i) => ({
        ...src, id: `f2-day-${i}`, day, name: `F2 lift ${day}`, order: 1,
      }));
      const asOf = "2026-08-13";
      const row = (day, date, tag) => {
        const ex = program.find((e) => e.day === day);
        return {
          session: `${date}_${day}_f2_${tag}`, date, day, name: ex.name, exerciseId: ex.id, set: 1,
          load: 100, reps: 8, rir: 1, notes: "", created: `${date}T12:00:00.000Z`,
          primary: ex.primary, secondary: ex.secondary,
        };
      };
      const log = [
        row(labels[0], "2026-08-07", "asOfMinus6"),
        row(labels[1], "2026-08-09", "prevSun"),
        row(labels[2], "2026-08-10", "mon"),
        row(labels[3], "2026-08-13", "asOf"),
        row(labels[3], "2026-08-13", "asOfDup"),
        row(labels[4], "2026-08-17", "nextMon"),
      ];
      await persistState(f2Page, {
        ...f2State,
        settings: { ...f2State.settings, lang: "en" },
        programMeta: { ...f2State.programMeta, name: "F2 Split", programStructure: null },
        program,
        log,
      });
      await reloadApp(f2Page);
      await f2Page.waitForFunction(() => typeof window.__repforgeProgramAdherence === "function" && typeof window.__repforgeWeeklySnapshot === "function");
      const asOfAd = await f2Page.evaluate((d) => window.__repforgeProgramAdherence(d), asOf);
      const asOfWeek = await f2Page.evaluate((d) => window.__repforgeWeeklySnapshot(d), asOf);
      const liveAd = await f2Page.evaluate(() => window.__repforgeProgramAdherence());
      const liveWeek = await f2Page.evaluate(() => window.__repforgeWeeklySnapshot());
      assert(
        asOfAd.logged === 4 && asOfAd.total === 5,
        "F2: programAdherence(asOf) is 4/5 on the rolling window",
        `ad=${JSON.stringify(asOfAd)} asOf=${asOf}`,
        "asOf-6 A + prevSun B + Mon C + asOf D(+dup) + nextMon E → rolling 4 / 5"
      );
      assert(
        asOfWeek.completedDays === 2 && asOfWeek.plannedDays === 5,
        "F2: weeklySnapshot(asOf).completedDays is 2 on the calendar week",
        `completedDays=${asOfWeek?.completedDays} planned=${asOfWeek?.plannedDays} week=${asOfWeek?.weekStart}..${asOfWeek?.weekEnd}`,
        "Same seed → calendar week 2 (Mon C + asOf D); asOf-6, prev Sunday and next Monday excluded"
      );
      assert(
        liveAd.logged === 4 && liveAd.total === 5 && liveWeek.completedDays === 2,
        "F2: frozen clock makes no-arg seams match the asOf fixture",
        `liveAd=${JSON.stringify(liveAd)} liveWeekDays=${liveWeek?.completedDays}`,
        "clock at 2026-08-13 noon → no-arg programAdherence/weeklySnapshot"
      );
      await f2Page.evaluate(() => window.__repforgeLeaveWorkout?.());
      await f2Page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
        document.querySelector('nav button[data-view="log"]')?.click();
      });
      await f2Page.waitForSelector("#todayWeek", { timeout: 5000 });
      const todayText = await f2Page.evaluate(() =>
        `${document.querySelector("#todayProgram")?.textContent || ""}\n${document.querySelector("#todayWeek")?.textContent || ""}`
      );
      assert(
        todayText.includes("2 of 5 sessions") && !todayText.includes("3 of 5") && !todayText.includes("4 of 5"),
        "F2: Today shows calendar-week 2 of 5",
        `today="${todayText.replace(/\s+/g, " ").slice(0, 180)}"`,
        "Today → #todayWeek"
      );
      await nav(f2Page, "stats");
      const progressText = await f2Page.locator("#thisWeek").textContent();
      assert(
        progressText.includes("2 of 5 sessions"),
        "F2: Progress This week shows calendar-week 2 of 5",
        `progress="${progressText.replace(/\s+/g, " ").slice(0, 160)}"`,
        "Stats → Overview → #thisWeek"
      );
      await f2Page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
        document.querySelector('nav button[data-view="program"]')?.click();
      });
      await f2Page.waitForSelector("#programOverview", { timeout: 5000 });
      const overviewCell = f2Page.locator("#programOverview .statrow__cell").first();
      const overviewVal = await overviewCell.locator(".statrow__val").textContent();
      const overviewCap = await overviewCell.locator(".statrow__cap").textContent();
      assert(
        overviewVal.trim() === "4 / 5",
        "F2: Program days stat shows rolling 4 / 5",
        `val="${overviewVal}"`,
        "Program overview → days (7d)"
      );
      assert(
        overviewCap.trim() === "days (7d)" && !/this week/i.test(overviewCap),
        "F2: Program overview names a rolling 7-day window",
        `cap="${overviewCap}"`,
        "Program overview → days (7d) caption"
      );
      const chip = await overviewCell.textContent();
      assert(
        chip.includes("4 / 5") && chip.includes("days (7d)") && !/this week/i.test(chip),
        "F2: Program overview stat shows rolling 4 / 5 and copy",
        `chip="${chip}"`,
        "Program overview → rolling days stat"
      );
      const afterEn = await getState(f2Page);
      await persistState(f2Page, { ...afterEn, settings: { ...afterEn.settings, lang: "pt" } });
      await reloadApp(f2Page);
      await f2Page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
        document.querySelector('nav button[data-view="program"]')?.click();
      });
      await f2Page.waitForSelector("#programOverview", { timeout: 5000 });
      const ptCap = await f2Page.locator("#programOverview .statrow__cell").first().locator(".statrow__cap").textContent();
      assert(
        ptCap.trim() === "dias (7d)",
        "F2: Program overview rolling label is Portuguese",
        `cap="${ptCap}"`,
        "lang=pt → Program overview → dias (7d)"
      );
      const ptChip = await f2Page.locator("#programOverview .statrow__cell").first().textContent();
      assert(
        ptChip.includes("4 / 5") && ptChip.includes("dias (7d)"),
        "F2: Program overview rolling copy is Portuguese",
        `chip="${ptChip}"`,
        "lang=pt → Program overview rolling stat"
      );
      assert(
        f2PageErrors.length === 0,
        "F2: dedicated clocked context has no page errors",
        f2PageErrors.join(" | ") || "none",
        "f2Page pageerror listener"
      );
    } finally {
      await f2Ctx.close();
    }
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
      state.programMeta.onboarded === true,
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
  const weekChipText = await page.locator('#programEditor [data-role="context"]').textContent();
  assert(
    /of 6/.test(weekChipText),
    "P7: Program editor context shows of 6",
    `context=${weekChipText}`,
    "Program tab → editor context includes of 6"
  );
  await applyProgramEditor(page);
  assert(
    await page.locator("#reviewBlockLink").isVisible(),
    "P7: Review block action is visible",
    "Review block missing from Program overview",
    "Program tab → Review block row"
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

    await resetWithSeedProgram(page);
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
      await page.waitForSelector('#programEditor [data-role="context"]', { timeout: 5000 });
    }
    const chipW8 = await page.locator('#programEditor [data-role="context"]').textContent();
    assert(
      /Week 6 of 6/.test(chipW8) && /ready for review/i.test(chipW8) && !overrunText(chipW8),
      "F8: Program editor week context is clamped",
      `chip="${chipW8}"`,
      "Program editor context at week 8 of 6"
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

    const openFullScreenReview = async () => {
      await nav(page, "program");
      await applyProgramEditor(page);
      await page.click("#reviewBlockLink");
      await page.waitForSelector("#endBlockConfirm:not(.hidden)", { timeout: 5000 });
      await page.click("#endBlockGo");
      await page.waitForSelector("#blockReview:not(.hidden)", { timeout: 5000 });
    };
    const heroOf = async () => (await page.locator("#blockReview .blockreview__hero").textContent())?.trim() || "";
    const panelOf = async () => (await page.locator("#blockReview").textContent()) || "";

    await openFullScreenReview();
    let hero = await heroOf();
    let panel = await panelOf();
    assert(
      /Week 6 of 6/.test(hero) && /ready for review/i.test(hero) && !/Block complete/i.test(hero) && !overrunText(hero),
      "F8: full-screen review headline is ready-for-review while still active",
      `hero="${hero}"`,
      "End block → #blockReview hero at week 8 of 6, mesocycleStatus=active"
    );
    assert(
      /Week 6 of 6/.test(panel) && /ready for review/i.test(panel) && !/Block complete/i.test(panel) && !overrunText(panel) && !/Week 8 of 6/.test(panel),
      "F8: full-screen review copy stays clamped and not completed while active",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "#blockReview body at active week 8 of 6"
    );
    await page.click("#blockDecideLater");
    await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
    const afterLater = (await getState(page)).programMeta.mesocycleStatus;
    assert(
      afterLater === "active",
      "F8: Decide later leaves the mesocycle active",
      `status=${afterLater}`,
      "#blockDecideLater at week 8 of 6"
    );

    f8 = await getState(page);
    await persistState(page, { ...f8, settings: { ...f8.settings, lang: "pt" } });
    await reloadApp(page);
    await openFullScreenReview();
    hero = await heroOf();
    panel = await panelOf();
    assert(
      /Semana 6 de 6/.test(hero) && /pronta para revisão/i.test(hero) && !/Bloco concluído/i.test(hero) && !overrunText(hero),
      "F8: PT full-screen review headline is ready-for-review while still active",
      `hero="${hero}"`,
      "lang=pt → #blockReview hero at active week 8 of 6"
    );
    assert(
      /Semana 6 de 6/.test(panel) && /pronta para revisão/i.test(panel) && !/Bloco concluído/i.test(panel) && !overrunText(panel) && !/Semana 8 de 6/.test(panel),
      "F8: PT full-screen review copy stays clamped and not completed while active",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "lang=pt → #blockReview body at active week 8 of 6"
    );
    await page.click("#blockDecideLater");
    await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
    await persistState(page, { ...(await getState(page)), settings: { ...(await getState(page)).settings, lang: "en" } });
    await reloadApp(page);

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

    await openFullScreenReview();
    hero = await heroOf();
    panel = await panelOf();
    assert(
      /^Block complete$/i.test(hero) && !/ready for review/i.test(hero) && !overrunText(hero),
      "F8: full-screen review headline is Block complete only when stored-completed",
      `hero="${hero}"`,
      "End block → #blockReview hero at mesocycleStatus=completed"
    );
    assert(
      /Block complete/i.test(panel) && !/Week 8 of 6/.test(panel) && !overrunText(panel),
      "F8: completed full-screen review keeps week displays clamped",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "#blockReview body when stored-completed"
    );
    await page.click("#blockReviewClose");
    await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));

    await persistState(page, { ...(await getState(page)), settings: { ...(await getState(page)).settings, lang: "pt" } });
    await reloadApp(page);
    await openFullScreenReview();
    hero = await heroOf();
    panel = await panelOf();
    assert(
      /^Bloco concluído$/i.test(hero) && !/pronta para revisão/i.test(hero),
      "F8: PT full-screen review headline is Bloco concluído when stored-completed",
      `hero="${hero}"`,
      "lang=pt → #blockReview hero at mesocycleStatus=completed"
    );
    assert(
      /Bloco concluído/i.test(panel) && !/Semana 8 de 6/.test(panel) && !overrunText(panel),
      "F8: PT completed full-screen review keeps week displays clamped",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "lang=pt → #blockReview body when stored-completed"
    );
    await page.click("#blockReviewClose");
    await page.waitForFunction(() => document.querySelector("#blockReview")?.classList.contains("hidden"));
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
  await applyProgramEditor(page);
  await page.click("#reviewBlockLink");
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
  await page.click("#reviewBlockLink");
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
    /Recommendation/i.test(reviewText) && /Why:/i.test(reviewText),
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

  beginPhase("Phase: P9 next-block flow");
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.waitForFunction(() => typeof window.__repforgeCommitNextBlock === "function");
  const p9Before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      revision: s._storageRevision || 0,
      historyLen: s.programHistory.length,
      metaId: s.programMeta.id,
      status: s.programMeta.mesocycleStatus,
      sets: s.program.map((e) => ({ sets: e.sets, maxSets: e.maxSets || 6 })),
    };
  });
  const p9LegacyHooks = await page.evaluate(() => ({
    complete: typeof window.__repforgeCompleteProgram,
    start: typeof window.__repforgeStartNextMeso,
  }));
  assert(
    p9LegacyHooks.complete === "undefined" && p9LegacyHooks.start === "undefined",
    "P9: commitNextBlock is the only exposed next-block transition",
    JSON.stringify(p9LegacyHooks),
    "legacy two-step test hooks are absent"
  );
  const p9Result = await page.evaluate(() => window.__repforgeCommitNextBlock("increase_volume"));
  await page.evaluate(() => window.__repforgeStorage.flush());
  const p9Today = new Date().toISOString().slice(0, 10);
  const p9After = await page.evaluate((oldId) => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    const archived = s.programHistory.find((entry) => entry.id === oldId);
    return {
      revision: s._storageRevision || 0,
      historyLen: s.programHistory.length,
      archivedCount: s.programHistory.filter((entry) => entry.id === oldId).length,
      archivedMetaId: archived?.meta?.id,
      archivedSets: archived?.program?.map((e) => e.sets),
      archivedReviewProgramId: archived?.review?.programId,
      metaId: s.programMeta.id,
      status: s.programMeta.mesocycleStatus,
      started: s.programMeta.started,
      sets: s.program.map((e) => e.sets),
    };
  }, p9Before.metaId);
  assert(
    p9Before.status === "active" &&
      p9Result.kind === "committed" &&
      p9Result.committed === true &&
      p9Result.localOk === true &&
      p9Result.idbOk === true &&
      p9Result.revision === p9Before.revision + 1 &&
      p9After.revision === p9Result.revision,
    "P9: canonical next-block commit reports one accepted revision",
    JSON.stringify({ before: p9Before.revision, result: p9Result, after: p9After.revision }),
    "__repforgeCommitNextBlock(increase_volume) → accepted local/idb result at revision +1"
  );
  assert(
    p9After.historyLen === p9Before.historyLen + 1 &&
      p9After.archivedCount === 1 &&
      p9After.archivedMetaId === p9Before.metaId &&
      p9After.archivedReviewProgramId === p9Before.metaId &&
      p9After.metaId !== p9Before.metaId &&
      p9After.status === "active" &&
      p9After.started === p9Today,
    "P9: one atomic transition archives the old block and activates its successor",
    JSON.stringify({
      history: `${p9Before.historyLen} → ${p9After.historyLen}`,
      archivedCount: p9After.archivedCount,
      oldId: p9Before.metaId,
      newId: p9After.metaId,
      status: p9After.status,
      started: p9After.started,
    }),
    "commitNextBlock proposal contains old archive plus active successor"
  );
  assert(
    Array.isArray(p9After.archivedSets) &&
      p9After.archivedSets.length === p9Before.sets.length &&
      p9After.archivedSets.every((n, i) => n === p9Before.sets[i].sets) &&
      p9After.sets.length === p9Before.sets.length &&
      p9After.sets.every((n, i) => n === Math.min(p9Before.sets[i].sets + 1, p9Before.sets[i].maxSets)),
    "P9: atomic increase_volume preserves archived sets and caps successor sets",
    `archived=${p9After.archivedSets.join(",")} successor=${p9After.sets.join(",")}`,
    "commitNextBlock(increase_volume) → archive unchanged, successor +1 up to maxSets"
  );

  beginPhase("Phase: P5 program generation");
  await page.waitForFunction(() => typeof window.__repforgeOnboarding?.services === "function");
  const genCases = [
    { desiredResult: "muscle_growth", structuredExperience: "first", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120, environment: { kind: "commercial_gym", equipment: ["machine"], capabilities: ["safe_pull", "training_support"] }, primaryMuscles: ["chest"], priorityMovements: [], exerciseConstraints: [] },
    { desiredResult: "strength", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 4, sessionMinutes: 45, preferredRestSeconds: 120, environment: { kind: "commercial_gym", equipment: ["barbell", "dumbbell", "machine"], capabilities: ["safe_pull", "training_support"] }, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] },
    { desiredResult: "muscle_growth", structuredExperience: "first", recentConsistency: "most", daysPerWeek: 5, sessionMinutes: 90, preferredRestSeconds: 120, environment: { kind: "commercial_gym", equipment: ["machine"], capabilities: ["safe_pull", "training_support"] }, primaryMuscles: ["quads"], priorityMovements: [], exerciseConstraints: [] },
  ];
  const genResults = await page.evaluate((cases) => {
    const services = window.__repforgeOnboarding.services();
    return cases.map((answers) => {
      const compiled = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
      const json = compiled.preview?.program || [];
      const days = [...new Set(json.map((e) => e.day))];
      const perDay = days.map((d) => json.filter((e) => e.day === d).length);
      const fieldsOk = json.every((e) => e.name && e.sets > 0 && e.min > 0 && e.max >= e.min && e.primary);
      return {
        answers,
        compileOk: compiled.ok,
        dayCount: days.length,
        perDay,
        fieldsOk,
        programOk: compiled.ok && json.length > 0,
        days,
      };
    });
  }, genCases);

  const case0 = genResults[0];
  assert(
    case0.dayCount === 3,
    "P5: generated program has daysPerWeek distinct days",
    `expected 3 days, got ${case0.dayCount} (${case0.days.join(", ")})`,
    "production adapter compile with daysPerWeek=3"
  );
  assert(
    case0.compileOk && case0.fieldsOk,
    "P5: adapter compilation returns valid exercise fields",
    `perDay=${case0.perDay.join(",")} fieldsOk=${case0.fieldsOk}`,
    "production adapter compile → name/sets/min/max/primary"
  );
  assert(
    case0.programOk,
    "P5: compiler preview serializes to an executable program",
    `length=${case0.programOk}`,
    "production adapter compile preview has exercises"
  );

  const machineEquip = await page.evaluate(() => {
    const answers = { desiredResult: "muscle_growth", structuredExperience: "first", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120, environment: { kind: "commercial_gym", equipment: ["machine"], capabilities: ["safe_pull", "training_support"] }, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] };
    const services = window.__repforgeOnboarding.services();
    const compiled = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
    const library = new Map(window.RepForgeExercises.library.map((entry) => [entry.id, entry]));
    const invalid = (compiled.preview?.program || []).filter((exercise) => {
      const entry = library.get(exercise.libraryId);
      return !entry || !entry.equipment.includes("machine") && !entry.equipment.includes("bodyweight");
    });
    return { count: compiled.preview?.program?.length || 0, hasInvalidEquipment: invalid.length > 0, names: compiled.preview?.program?.map((e) => e.name) || [] };
  });
  assert(
    !machineEquip.hasInvalidEquipment && machineEquip.count > 0,
    "P5: machine-only equipment filter keeps compatible picks",
    `hasInvalidEquipment=${machineEquip.hasInvalidEquipment} names=${machineEquip.names.slice(0, 4).join(", ")}`,
    "environment.equipment=[machine] → machine or bodyweight exercises only"
  );

  const case2 = genResults[2];
  assert(
    case2.compileOk && case2.dayCount === 5,
    "P5: adapter compilation respects a five-day frequency",
    `days=${case2.dayCount} perDay=${case2.perDay.join(",")}`,
    "production adapter compile with daysPerWeek=5"
  );

  const pplDays = await page.evaluate(() => {
    const answers = { desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most", daysPerWeek: 3, sessionMinutes: 60, preferredRestSeconds: 120, environment: { kind: "commercial_gym", equipment: ["machine", "cable"], capabilities: ["safe_pull", "training_support"] }, primaryMuscles: [], priorityMovements: [], exerciseConstraints: [] };
    const services = window.__repforgeOnboarding.services();
    const compiled = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
    const days = [...new Set((compiled.preview?.program || []).map((e) => e.day))];
    return { compileOk: compiled.ok, dayCount: days.length, exerciseCount: compiled.preview?.program?.length || 0 };
  });
  assert(
    pplDays.compileOk && pplDays.dayCount === 3 && pplDays.exerciseCount > 0,
    "P5: adapter compilation generates one day per training slot",
    JSON.stringify(pplDays),
    "production adapter compile with daysPerWeek=3"
  );

  const upperLower = genResults[1];
  assert(
    upperLower.compileOk && upperLower.dayCount === 4,
    "P5: adapter compilation respects a four-day frequency",
    `perDay=${upperLower.perDay.join(",")}`,
    "production adapter compile with daysPerWeek=4"
  );

  beginPhase("Phase: F4 compiler equipment and split support");
  await page.waitForFunction(
    () =>
      typeof window.__repforgeOnboarding?.services === "function" &&
      window.__repforgeExerciseCatalog &&
      window.__repforgeOnboarding?.entry &&
      window.RepForgeProgramEntryAdapter &&
      window.RepForgeProgramCompiler
  );
  const f45 = await page.evaluate(async () => {
    const services = window.__repforgeOnboarding.services();
    const contractResponse = await fetch("./test/fixtures/program-family-contract-v1.json", { cache: "no-store" });
    const contract = contractResponse.ok ? await contractResponse.json() : null;
    const catalog = window.__repforgeExerciseCatalog;
    const catalogById = new Map(catalog.map((e) => [e.id, e]));
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
    const matchesEq = (ex, equipment) => {
      const entry = catalogById.get(ex.libraryId);
      if (!entry) return false;
      return entry.equipment.some((x) => equipment.has(String(x).toLowerCase()) || String(x).toLowerCase() === "bodyweight");
    };
    const onb = window.__repforgeOnboarding;
    const adapter = window.RepForgeProgramEntryAdapter;
    const knownEquipment = Array.isArray(adapter.KNOWN_EQUIPMENT) ? [...adapter.KNOWN_EQUIPMENT] : [];
    const optionParity = {
      // The UI vocabulary is authoritative in the adapter. This checks that
      // it is a closed, unique vocabulary backed by the shipped catalogue;
      // the browser step below compares the rendered controls to this list.
      eqUi: knownEquipment.length > 0 &&
        new Set(knownEquipment).size === knownEquipment.length &&
        knownEquipment.every((token) => catalog.some((entry) => entry.equipment.includes(token)) || token === "band"),
      eqGen: false,
      splits: false,
      entryHook: !!(onb && typeof onb.entry === "function" && onb.setupDraftKey),
    };
    const failures = [];
    const contractBlueprints = Array.isArray(contract?.blueprints) ? contract.blueprints : [];
    const contractFamilies = new Set(Array.isArray(contract?.families) ? contract.families : []);
    let checked = contractBlueprints.length;
    let blocked = 0;
    let generated = 0;
    let splitParity = 0;
    let structureOk = 0;
    let stable = 0;
    let equipmentInvalid = 0;
    for (const blueprint of contractBlueprints) {
      const family = contractFamilies.has(blueprint.familyId);
      const familyResult = Object.entries(adapter.FAMILY_BY_RESULT || {})
        .find(([, familyId]) => familyId === blueprint.familyId)?.[0];
      const answers = {
        desiredResult: familyResult || "balanced",
        structuredExperience: "6_to_24m",
        recentConsistency: "most",
        daysPerWeek: blueprint.frequency,
        sessionMinutes: 90,
        preferredRestSeconds: 120,
        environment: blueprint.familyId === "home"
          ? { kind: "limited_home" }
          : { kind: "commercial_gym" },
        primaryMuscles: [],
        priorityMovements: [],
        exerciseConstraints: [],
      };
      const label = `${blueprint.familyId}/${blueprint.frequency}`;
      if (!family) {
        failures.push(`${label}: fixture references an unknown family`);
        continue;
      }
      const choices = services.splitChoices(answers).choices || [];
      const choice = choices.find((candidate) => candidate?.id === blueprint.blueprintId);
      const expectedLabels = Array.isArray(blueprint.dayLabels) ? blueprint.dayLabels : [];
      if (choices.length < 1 || !choice || choice.familyId !== blueprint.familyId ||
        choice.frequency !== blueprint.frequency || choice.blueprintId !== blueprint.blueprintId ||
        JSON.stringify((choice.days || []).map((day) => day.label)) !== JSON.stringify(expectedLabels)) {
        failures.push(`${label}: split choice diverges from reviewed fixture`);
      } else splitParity++;
      const first = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
      const second = services.compile({ mode: "recommend", answers, versions: services.currentVersions() });
      if (!first.ok || !first.preview?.program?.length) {
        blocked++;
        failures.push(`${label}: fixture blueprint did not compile (${first.code || "unknown"})`);
        continue;
      }
      generated++;
      const raw = first.preview.program;
      const days = byDay(raw);
      if (days.length !== blueprint.frequency || days.some((day) => !day.length)) {
        failures.push(`${label}: compiler returned ${days.length} non-empty days, want ${blueprint.frequency}`);
      }
      if (raw.every((exercise) => exercise.day && Number.isInteger(exercise.order) && exercise.order > 0)) structureOk++;
      const environment = answers.environment.kind === "limited_home"
        ? adapter.defaultEnvironment("limited_home")
        : adapter.defaultEnvironment("commercial_gym");
      const allowedEquipment = new Set(environment.equipment || []);
      if (answers.environment.kind === "limited_home") allowedEquipment.add("bodyweight");
      for (const ex of raw) {
        if (!ex.libraryId || !matchesEq(ex, allowedEquipment)) {
          equipmentInvalid++;
          failures.push(`${label}: equipment-invalid ${ex.name} (${ex.libraryId})`);
          break;
        }
      }
      const vis1 = JSON.stringify(visible(raw));
      const vis2 = JSON.stringify(visible(second.preview?.program || []));
      if (vis1 !== vis2) failures.push(`${label}: unstable visible/library fields`);
      else stable++;
    }
    optionParity.eqGen = generated === checked && equipmentInvalid === 0;
    optionParity.splits = splitParity === checked;
    return {
      familyCount: contractFamilies.size,
      blueprintCount: contractBlueprints.length,
      checked,
      blocked,
      generated,
      splitParity,
      structureOk,
      optionParity,
      stable,
      equipmentInvalid,
      failures: failures.slice(0, 24),
      failureCount: failures.length,
      eqUi: knownEquipment,
      entryHook: optionParity.entryHook,
      strings: {
        en: window.RepForgeI18n.STRINGS.en["onb.equipment.unsupported"],
        pt: window.RepForgeI18n.STRINGS.pt["onb.equipment.unsupported"],
      },
    };
  });

  assert(
    f45.optionParity.eqUi,
    "F4: entry equipment vocabulary is closed and backed by the shipped catalogue",
    JSON.stringify({ equipment: f45.eqUi }),
    "RepForgeProgramEntryAdapter.KNOWN_EQUIPMENT is unique and every token is represented by catalogue data"
  );
  assert(
    f45.familyCount === 4 && f45.blueprintCount === 20 && f45.checked === 20,
    "F4: reviewed Plan 047 fixture covers every released family/frequency blueprint",
    JSON.stringify({ families: f45.familyCount, blueprints: f45.blueprintCount, checked: f45.checked }),
    "test/fixtures/program-family-contract-v1.json is the independently authored family and frequency catalogue"
  );
  assert(
    f45.optionParity.eqUi && f45.optionParity.eqGen && f45.optionParity.splits && f45.entryHook,
    "F4: fixture-derived equipment generation and split choices remain available",
    JSON.stringify(f45.optionParity),
    "adapter vocabulary plus Plan 047 blueprints drive actual entry services"
  );
  assert(
    f45.splitParity === f45.checked,
    "F4: each reviewed blueprint is an executable split choice with fixture day labels",
    `splitParity=${f45.splitParity} checked=${f45.checked} ${f45.failures.join(" | ")}`,
    "adapter splitChoices includes the independent Plan 047 blueprint id, family, frequency, and day labels"
  );
  assert(
    f45.failureCount === 0 && f45.generated === f45.checked && f45.blocked === 0,
    "F4: every released family blueprint compiles to non-empty executable days",
    `generated=${f45.generated} blocked=${f45.blocked} failures=${f45.failureCount} ${f45.failures.join(" | ")}`,
    "fixture-derived family/frequency contexts compile through the production adapter without unsupported fallbacks"
  );
  assert(
    f45.stable === f45.generated && f45.equipmentInvalid === 0 && f45.optionParity.eqGen,
    "F4: released outputs are deterministic and equipment-compatible",
    `stable=${f45.stable} generated=${f45.generated} equipmentInvalid=${f45.equipmentInvalid} ${f45.failures.join(" | ")}`,
    "two production adapter compiles match projected fields and every libraryId fits its authoritative environment vocabulary"
  );
  assert(
    f45.structureOk === f45.generated,
    "F4: supported compiler outputs retain explicit day and order structure",
    `structureOk=${f45.structureOk} generated=${f45.generated}`,
    "Every projected exercise carries a non-empty day and positive authored order"
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
  await startFromFirstRun(page);
  await page.click('[data-entry-route="recommend"]');
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="first"]');
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-pick="environment"]');
  const envVals = await page.$$eval("[data-entry-pick='environment']", (els) =>
    els.map((el) => el.getAttribute("data-entry-val"))
  );
  assert(
    envVals.includes("commercial_gym") && envVals.includes("limited_home") && envVals.length === 5,
    "F4: environment step offers the closed shortcut set",
    `vals=${envVals.join(",")}`,
    "Onboarding environment cards"
  );
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.locator("details.entry__correct summary").click();
  const renderedEquipment = await page.$$eval("[data-entry-pick='environmentEquipment']", (els) =>
    els.map((el) => el.getAttribute("data-entry-val"))
  );
  const canonicalEquipment = await page.evaluate(() => [...window.RepForgeProgramEntryAdapter.KNOWN_EQUIPMENT]);
  assert(
    JSON.stringify(renderedEquipment) === JSON.stringify(canonicalEquipment),
    "F4: environment correction controls use the canonical equipment vocabulary",
    `rendered=${renderedEquipment.join(",")} canonical=${canonicalEquipment.join(",")}`,
    "rendered environmentEquipment choices equal RepForgeProgramEntryAdapter.KNOWN_EQUIPMENT"
  );
  await page.click('[data-entry-pick="environment"][data-entry-val="limited_home"]');
  const envSelected = await page.locator('[data-entry-pick="environment"][data-entry-val="limited_home"].is-selected').count();
  assert(
    !!envSelected && !(await page.locator("#onbNext").isDisabled()),
    "F4: limited home is a valid environment choice",
    `selected=${envSelected} disabled=${await page.locator("#onbNext").isDisabled()}`,
    "Environment step → limited_home"
  );
  await page.evaluate(() => {
    window.RepForgeI18n.setLang("pt");
    window.__repforgeOnboarding.render();
  });
  const envLabelPt = ((await page.locator('[data-entry-pick="environment"][data-entry-val="limited_home"] .radio-card__title').textContent()) || "").trim();
  assert(
    /casa|limitad/i.test(envLabelPt),
    "F4: limited-home environment label renders in Portuguese",
    `copy="${envLabelPt}"`,
    "setLang(pt) → limited_home card"
  );
  await page.evaluate(() => {
    window.RepForgeI18n.setLang("en");
    window.__repforgeOnboarding.render();
  });

  beginPhase("Phase: P6 onboarding UI");
  await clearState(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  const firstRunDoors = await page.evaluate(() => ({
    visible: !document.querySelector("#firstRun").classList.contains("hidden"),
    create: !!document.querySelector("#firstRunCreate"),
    import: !!document.querySelector("#firstRunImport"),
    wizard: document.querySelector("#onboarding").classList.contains("active"),
  }));
  assert(
    firstRunDoors.visible && firstRunDoors.create && firstRunDoors.import && !firstRunDoors.wizard,
    "P6: a fresh load offers Create and Import before the wizard",
    JSON.stringify(firstRunDoors),
    "Clear storage → reload → setup screen shows both ways to a first program"
  );
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
  assert(
    await page.locator("#onboarding.active").isVisible(),
    "P6: Create opens the onboarding overlay",
    "onboarding section not active",
    "Setup screen → Create a program → onboarding overlay shows"
  );
  await driveRecommendOnboarding(page, { days: 3, experience: "first" });
  state = await getState(page);
  const onbDays = [...new Set(state.program.map((e) => e.day))];
  assert(
    state.programMeta?.onboarded === true,
    "P6: Save program sets onboarded=true",
    `onboarded=${state.programMeta?.onboarded}`,
    "Complete onboarding → Save program"
  );
  assert(
    state.programMeta?.name === "Build Muscle",
    "P6: generated programs receive a human-readable family name",
    `name=${state.programMeta?.name}`,
    "Complete onboarding → Save program → inspect program name"
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
  await resetWithSeedProgram(page);
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
  const deltaSummary = (await saveWorkout(page)) || "";
  deltaState = await getState(page);
  const deltaSession = [...new Set(deltaState.log.map((r) => r.session))].find(
    (s) => !sessionsBeforeDelta.has(s)
  );
  assert(
    /improved/i.test(deltaSummary),
    "Session summary includes the session delta improved summary",
    `Summary: ${JSON.stringify(deltaSummary)}`,
    "Seed 100×8 → save 100×10 → summary mentions improved"
  );
  assert(
    /\d+ improved/.test(deltaSummary),
    "Session summary delta uses count format",
    `Summary: ${JSON.stringify(deltaSummary)}`,
    "Summary should read like '1 improved'"
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
  await resetWithSeedProgram(page);
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
    /Change from last session/.test(deltaPreview || ""),
    "Log tab live delta preview vs last session",
    `Preview: ${deltaPreview || "(empty)"}`,
    "Enter draft kg/reps for an exercise with prior sessions"
  );

  beginPhase("\nPhase: program day collapse");
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await nav(page, "program");
  const editorDays = await page.locator('#programEditor [data-role="day"]').evaluateAll((days) =>
    days.map((day) => day.getAttribute("data-day")).filter(Boolean)
  );
  const expandedDay = editorDays[0];
  const collapsedDay = editorDays[1];
  const expandedVisible = await page
    .locator(`#programEditor [data-role="day"][data-day="${expandedDay}"] [data-role="day-body"]`)
    .isVisible();
  assert(
    expandedVisible,
    "The first Program day starts expanded",
    `Exercise list not visible for ${expandedDay}`,
    "Program tab → first day card"
  );
  const expandedCaretHidden = await page
    .locator(`#programEditor [data-role="day"][data-day="${expandedDay}"] [data-role="toggle-day"]`)
    .isHidden();
  assert(
    expandedCaretHidden,
    "An expanded day hides its disclosure caret",
    `Disclosure caret remained visible for ${expandedDay}`,
    "Program tab → expanded day header"
  );
  const collapsedHidden = await page
    .locator(`#programEditor [data-role="day"][data-day="${collapsedDay}"] [data-role="day-body"]`)
    .isHidden();
  assert(
    collapsedHidden,
    "Later Program days start collapsed",
    `Exercise list remained visible for ${collapsedDay}`,
    "Program tab → second day card"
  );
  const collapsedCaret = page.locator(
    `#programEditor [data-role="day"][data-day="${collapsedDay}"] [data-role="toggle-day"]`
  );
  assert(
    (await collapsedCaret.isVisible()) && (await collapsedCaret.getAttribute("aria-expanded")) === "false",
    "A collapsed day exposes an aria-expanded=false caret",
    `Caret state was not collapsed for ${collapsedDay}`,
    "Program tab → second day header"
  );
  await collapsedCaret.click();
  await page.waitForTimeout(120);
  const revealed = await page
    .locator(`#programEditor [data-role="day"][data-day="${collapsedDay}"] [data-role="day-body"]`)
    .isVisible();
  assert(
    revealed,
    "The collapsed-day caret reveals its exercises",
    `Exercise list stayed hidden for ${collapsedDay}`,
    "Program tab → collapsed day → disclosure caret"
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("#log.view.active", { timeout: 8000 });
  await nav(page, "program");
  const resetExpanded = await page
    .locator(`#programEditor [data-role="day"][data-day="${expandedDay}"]`)
    .evaluate((el) => el.classList.contains("is-expanded"));
  const resetCollapsed = await page
    .locator(`#programEditor [data-role="day"][data-day="${collapsedDay}"]`)
    .evaluate((el) => el.classList.contains("is-collapsed"));
  assert(
    resetExpanded && resetCollapsed,
    "A reload restores one expanded day as the editor's scannable default",
    `expanded=${resetExpanded}, collapsed=${resetCollapsed}`,
    "Expand the second day → reload → Program tab"
  );

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

  beginPhase("Phase: complete workout draft persistence (UX-01, UX-19)");
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const draftMeta = await getExerciseMeta(page, "Day 1");
  const draftExA = draftMeta[0];
  const draftExSkip = draftMeta[1];
  const subIds = await page.evaluate(() => [...document.querySelectorAll(".subst__pick")].map((s) => s.dataset.sub));
  const draftExB = draftMeta.find((ex) => ex.id !== draftExA.id && ex.id !== draftExSkip.id && subIds.includes(ex.id)) || draftMeta.find((ex) => subIds.includes(ex.id) && ex.id !== draftExA.id) || draftMeta[2];
  const otherDay = await page.evaluate(() =>
    [...document.querySelectorAll("#dayTabs button")].map((b) => b.dataset.day).find((d) => d !== "Day 1")
  );
  const sessionNote = "Draft session note";
  const nonToday = "2024-02-29";
  await page.evaluate((v) => {
    const el = document.querySelector("#notes");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, sessionNote);
  await page.evaluate((v) => {
    const el = document.querySelector("#bodyweight");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, "82.5");
  await setLogDate(page, nonToday);
  await fillExerciseSets(page, draftExA.id, 1, 77, 6, 1);
  await fillExerciseSets(page, draftExB.id, 1, 40, 8, 1);
  await page.click(`.ex__skip[data-skip="${draftExSkip.id}"]`);
  // Swap from the library.
  await page.click(`.subst__pick[data-sub="${draftExA.id}"]`);
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  const altName = await page.evaluate(() => {
    const slot = (document.querySelector("#exPickFor")?.textContent || "").trim();
    const rows = [...document.querySelectorAll("#exPickList .pickrow")];
    const row = rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim() !== slot);
    if (!row) return "";
    const name = (row.querySelector(".pickrow__name")?.textContent || "").trim();
    row.click();
    return name;
  });
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  // Swap to something the library has never heard of. The typed search carries
  // into the custom sheet, which is the path that replaced the old prompt().
  const customName = "Custom swap 80 cap check";
  await page.click(`.subst__pick[data-sub="${draftExB.id}"]`);
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.fill("#exPickSearch", customName);
  await page.waitForTimeout(120);
  await page.click("#exPickCustom");
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
  const customPrefilled = await page.inputValue("#exCustomName");
  // A definition needs equipment and a primary muscle before it can be saved.
  await page.evaluate(() => {
    [...document.querySelectorAll("#exCustomEquip .pchip")].find((b) => b.textContent.trim() === "Machine")?.click();
    [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Quads")?.click();
  });
  await page.click("#exCustomSave");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  await page.waitForTimeout(250);
  const savedCustom = await page.evaluate(() => window.__repforgeCustomExercises?.() || []);
  assert(
    customPrefilled === customName && savedCustom.some((e) => e.name === customName),
    "Creating a custom exercise from a failed search stores it and applies it",
    `prefilled="${customPrefilled}" stored=${JSON.stringify(savedCustom.map((e) => e.name))}`,
    "Log → swap → search a name the library lacks → + Create custom exercise → Save"
  );
  await page.waitForTimeout(80);
  const draftBeforeLeave = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await reloadApp(page);
  await page.waitForSelector("#workoutShell:not(.hidden), #workout .exercise", { timeout: 5000 });
  const autoResumed = await page.evaluate(() => !document.querySelector("#workoutShell")?.classList.contains("hidden"));
  if (!autoResumed) {
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.click("#startWorkout");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  }
  const resumed = await page.evaluate(({ a, skip, b, k }) => {
    const d = JSON.parse(localStorage.getItem(k) || "{}");
    return {
      load: document.querySelector(`[data-k="${a}_1_load"]`)?.value,
      note: document.querySelector("#notes")?.value,
      bw: document.querySelector("#bodyweight")?.value,
      date: document.querySelector("#date")?.value,
      skipped: d.__skipped?.includes(skip) || document.querySelector(`.exercise[data-ex="${skip}"]`)?.classList.contains("is-skipped"),
      subA: d.__substituted?.[a],
      subB: d.__substituted?.[b],
      day: d.__day,
    };
  }, { a: draftExA.id, skip: draftExSkip.id, b: draftExB.id, k: DRAFT });
  assert(
    resumed.load === "77" && resumed.note === sessionNote && resumed.bw === "82.5" && resumed.date === nonToday,
    "Resumed list draft keeps set, note, bodyweight, and date",
    JSON.stringify(resumed),
    "Log values + leave + reload + Continue"
  );
  assert(
    resumed.skipped && resumed.subA === altName && resumed.subB === customName && resumed.day === "Day 1",
    "Resumed list draft keeps skip and substitutions",
    JSON.stringify(resumed),
    "Skip + sub + reload + Continue"
  );

  const beforeFinish = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  const afterFinish = await getState(page);
  const newSess = [...new Set(afterFinish.log.map((r) => r.session))].filter((s) => !beforeFinish.has(s));
  const newRows = afterFinish.log.filter((r) => newSess.includes(r.session));
  assert(
    !newRows.some((r) => r.exerciseId === draftExSkip.id),
    "Finished resumed workout omits skipped exercise rows",
    newRows.map((r) => r.exerciseId).join(","),
    "Resume skipped draft → Finish"
  );
  assert(
    newRows.some((r) => r.exerciseId === draftExA.id && r.performedName === altName) &&
      newRows.some((r) => r.exerciseId === draftExB.id && r.performedName === customName),
    "Finished resumed workout keeps performedName on substitutions",
    JSON.stringify(newRows.filter((r) => r.performedName)),
    "Resume substituted draft → Finish"
  );

  const afterFinishDraft = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  const fresh = await page.evaluate(({ a, b, skip }) => ({
    subA: document.querySelector(`.subst__pick[data-sub="${a}"]`)?.value || "",
    skipped: document.querySelector(`.exercise[data-ex="${skip}"]`)?.classList.contains("is-skipped"),
    note: document.querySelector("#notes")?.value,
    date: document.querySelector("#date")?.value,
    draft: localStorage.getItem("repforge_draft_v1"),
  }), { a: draftExA.id, b: draftExB.id, skip: draftExSkip.id });
  assert(
    !afterFinishDraft && !fresh.skipped && !fresh.subA && !fresh.note && fresh.date === (await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })),
    "Accepted finish clears substitution/date/note context for the next workout",
    JSON.stringify(fresh),
    "Finish → stay on Log → next workout is clean"
  );

  async function clickRir(mode) {
    await nav(page, "settings");
    await page.evaluate(() => document.querySelector("#rirModePanel")?.classList.add("is-open"));
    await page.evaluate(async (m) => {
      const el = document.querySelector(`input[name="rirMode"][value="${m}"]`);
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      await window.__repforgeStorage.flush();
    }, mode);
  }
  async function rirState() {
    return page.evaluate((k) => ({
      mode: JSON.parse(localStorage.getItem(k) || "{}")?.settings?.rirMode,
      radio: document.querySelector('input[name="rirMode"]:checked')?.value,
      draft: localStorage.getItem("repforge_draft_v1"),
    }), KEY);
  }
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await clickRir("effort");
  let rs = await rirState();
  assert(rs.mode === "effort" && rs.radio === "effort", "RIR change with no draft succeeds", JSON.stringify(rs), "Settings → effort with empty draft");
  await clickRir("numeric");

  const rirCases = [
    ["committed", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await fillExerciseSets(page, draftExA.id, 1, 41, 5, 1); await page.click(`[data-save="${draftExA.id}_1"]`); }],
    ["warmup", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.click(`[data-warm="${draftExA.id}_1"]`); }],
    ["substitution-only", async () => {
      await nav(page, "log"); await selectDay(page, "Day 1");
      await page.click(`.subst__pick[data-sub="${draftExA.id}"]`);
      await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
      await page.evaluate(() => {
        const slot = (document.querySelector("#exPickFor")?.textContent || "").trim();
        const rows = [...document.querySelectorAll("#exPickList .pickrow")];
        (rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim() !== slot) || rows[0])?.click();
      });
      await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    }],
    ["note-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#notes"); el.value = "only"; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
    ["bodyweight-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#bodyweight"); el.value = "70"; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
    ["date-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await setLogDate(page, "2026-01-15"); }],
    ["day-only", async () => { await nav(page, "log"); await selectDay(page, otherDay); }],
    ["skip-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.click(`.ex__skip[data-skip="${draftExSkip.id}"]`); }],
    ["cleared-context", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#notes"); el.value = "x"; el.dispatchEvent(new Event("input", { bubbles: true })); el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
  ];
  for (const [name, setup] of rirCases) {
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await setup();
    const raw = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    await clickRir("effort");
    rs = await rirState();
    assert(
      rs.mode !== "effort" && rs.radio === "numeric" && rs.draft === raw,
      `RIR change with ${name} progress is refused and preserves the raw draft`,
      JSON.stringify({ name, mode: rs.mode, radio: rs.radio, same: rs.draft === raw, rawLen: raw?.length }),
      `Seed ${name} progress → Settings → effort`
    );
  }

  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await selectDay(page, otherDay);
  const dayOnlyRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  dialogMode = "dismiss";
  await page.click('#dayTabs button[data-day="Day 1"]');
  dialogMode = "accept";
  const dayAfterCancel = await page.evaluate((k) => ({
    raw: localStorage.getItem(k),
    active: document.querySelector("#dayTabs button.active")?.dataset.day,
  }), DRAFT);
  assert(
    dayAfterCancel.active === otherDay && dayAfterCancel.raw === dayOnlyRaw,
    "Day-only progress asks before switching and Cancel preserves the exact draft/day",
    JSON.stringify({ active: dayAfterCancel.active, same: dayAfterCancel.raw === dayOnlyRaw }),
    `${otherDay} day-only draft → Day 1 → Cancel`
  );
  await page.click('#dayTabs button[data-day="Day 1"]');
  await page.waitForFunction(() => document.querySelector("#dayTabs button.active")?.dataset.day === "Day 1");
  const dayAfterConfirm = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), DRAFT);
  assert(
    dayAfterConfirm.__day === "Day 1" && dayAfterConfirm.__contextTouched?.day === true,
    "Confirming a day-only transition discards the old context and saves the new day",
    JSON.stringify(dayAfterConfirm),
    `${otherDay} day-only draft → Day 1 → Confirm`
  );

  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.click(`.ex__skip[data-skip="${draftExSkip.id}"]`);
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  assert(
    await page.evaluate((id) => document.querySelector(`.exercise[data-ex="${id}"]`)?.classList.contains("is-skipped"), draftExSkip.id),
    "Direct skip survives reload",
    "skip class missing",
    "Skip → reload"
  );
  if (await page.locator(".skipbar__show").count()) await page.click(".skipbar__show");
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  assert(
    !(await page.evaluate((id) => document.querySelector(`.exercise[data-ex="${id}"]`)?.classList.contains("is-skipped"), draftExSkip.id)),
    "Show all survives reload as unskipped",
    "still skipped",
    "Show all → reload"
  );

  if (otherDay) {
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 55, 5, 1);
    const rawDay = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    const currentDay = await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day);
    dialogMode = "dismiss";
    await page.click(`#dayTabs button[data-day="${otherDay}"]`);
    await page.waitForTimeout(80);
    dialogMode = "accept";
    const cancelled = await page.evaluate((k) => ({
      draft: localStorage.getItem(k),
      day: document.querySelector("#dayTabs button.active")?.dataset.day,
    }), DRAFT);
    assert(
      cancelled.draft === rawDay && cancelled.day === currentDay,
      "Day-tab Cancel keeps the raw draft and current day",
      JSON.stringify(cancelled),
      "Fill Day 1 → other day tab → Cancel"
    );
    dialogMode = "accept";
    await page.click(`#dayTabs button[data-day="${otherDay}"]`);
    await page.waitForFunction((d) => document.querySelector("#dayTabs button.active")?.dataset.day === d, otherDay, { timeout: 5000 });
    const confirmed = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), DRAFT);
    await reloadApp(page);
    const after = await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day);
    assert(
      confirmed.__day === otherDay && !Object.keys(confirmed).some((k) => /_load$/.test(k) && +confirmed[k] === 55) && after === otherDay,
      "Day-tab Confirm clears the old draft, selects the new day, and survives reload",
      JSON.stringify({ confirmed, after }),
      "Fill Day 1 → other day tab → Confirm → reload"
    );

    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 56, 5, 1);
    const rawUp = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    dialogMode = "dismiss";
    await page.click("#upNextBtn");
    const upCancel = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    assert(upCancel === rawUp, "Up next Cancel preserves the raw draft", "draft changed", "Up next → Cancel");
    dialogMode = "accept";
    await page.click("#upNextBtn");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    assert(
      (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
      "Up next Confirm selects the next day",
      "day unchanged",
      "Up next → Confirm"
    );

    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 57, 5, 1);
    const rawEnter = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    dialogMode = "dismiss";
    await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d, focus: false }), otherDay);
    assert(
      (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) === rawEnter,
      "enterWorkout({day}) Cancel preserves the raw draft",
      "draft changed",
      "enterWorkout other day → Cancel"
    );
    dialogMode = "accept";
    await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d, focus: false }), otherDay);
    assert(
      (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
      "enterWorkout({day}) Confirm selects the new day",
      "day unchanged",
      "enterWorkout other day → Confirm"
    );

    const otherEx = await page.evaluate((d) => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).find((e) => e.day === d)?.id, otherDay);
    if (otherEx) {
      await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
      await reloadApp(page);
      await nav(page, "log");
      await selectDay(page, "Day 1");
      await fillExerciseSets(page, draftExA.id, 1, 58, 5, 1);
      const rawGo = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
      dialogMode = "dismiss";
      await page.evaluate((id) => window.__repforgeGoToLogExercise(id), otherEx);
      assert(
        (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) === rawGo,
        "Deep-link Cancel preserves the raw draft",
        "draft changed",
        "goToLogExercise → Cancel"
      );
      dialogMode = "accept";
      await page.evaluate((id) => window.__repforgeGoToLogExercise(id), otherEx);
      assert(
        (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
        "Deep-link Confirm selects the destination day",
        "day unchanged",
        "goToLogExercise → Confirm"
      );
    }
  }

  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.evaluate(() => {
    const el = document.querySelector("#bodyweight");
    el.value = "80";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await fillExerciseSets(page, draftExA.id, 1, 60, 5, 1);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  const bwDisp = await page.evaluate(() => document.querySelector("#bodyweight")?.value);
  const beforeBw = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  const bwRow = (await getState(page)).log.find((r) => !beforeBw.has(r.session) && r.bodyweight);
  assert(
    bwRow && Math.abs(+bwRow.bodyweight - 80) < 0.05,
    "kg → lb → reload → finish preserves canonical stored bodyweight",
    `display=${bwDisp} stored=${bwRow?.bodyweight}`,
    "Bodyweight 80kg → unit lb → reload → Finish"
  );
  await nav(page, "settings");
  await page.selectOption("#unit", "kg");

  const adapterOutcomes = [[true, true], [true, false], [false, true], [false, false]];
  for (const [localOk, idbOk] of adapterOutcomes) {
    await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 61, 5, 1);
    const raw = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    const beforeLen = (await getState(page)).log.length;
    const result = await page.evaluate(async ({ localOk, idbOk }) => {
      const io = {
        async writeLocal(data) {
          if (!localOk) throw new Error("ls fail");
          localStorage.setItem("repforge_v1", JSON.stringify(data));
        },
        async writeIdb(data) {
          if (!idbOk) throw new Error("idb fail");
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("repforge", 1);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(data, "repforge_v1");
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        },
      };
      return window.__repforgeSaveWorkout(io);
    }, { localOk, idbOk });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    if (localOk || idbOk) {
      await reloadApp(page);
      const afterLen = (await getState(page)).log.length;
      const draftNow = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
      assert(
        afterLen > beforeLen && !draftNow && result.localOk === localOk && result.idbOk === idbOk,
        `Finish (${localOk},${idbOk}) commits one session and clears the draft`,
        JSON.stringify({ result, beforeLen, afterLen, draftNow }),
        `Adapter ${localOk}/${idbOk} finish`
      );
    } else {
      const afterLen = (await getState(page)).log.length;
      const draftNow = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
      assert(
        afterLen === beforeLen && draftNow === raw,
        "Finish total failure keeps zero new rows and the exact draft",
        JSON.stringify({ result, beforeLen, afterLen, same: draftNow === raw }),
        "Adapter false/false finish"
      );
      await saveWorkout(page);
      const retried = (await getState(page)).log.length;
      assert(retried === beforeLen + 1 || retried > beforeLen, "Total failure retry does not duplicate after a later accepted save", `len ${retried} vs ${beforeLen}`, "Retry finish after total failure");
    }
  }

  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const legacyEx = (await getExerciseMeta(page, "Day 1"))[0];
  await page.evaluate(({ id, k }) => {
    const d = {};
    d[`${id}_1_load`] = "66";
    d[`${id}_1_reps`] = "6";
    d[`${id}_1_rir`] = "1";
    d.__done = [`${id}_1`];
    d.__touched = [`${id}_1`];
    d.__warm = [];
    localStorage.setItem(k, JSON.stringify(d));
  }, { id: legacyEx.id, k: DRAFT });
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  const beforeLegacy = (await getState(page)).log.length;
  await saveWorkout(page);
  assert(
    (await getState(page)).log.length > beforeLegacy,
    "A legacy draft finishes successfully",
    "no new rows",
    "Inject legacy draft → Finish"
  );

  beginPhase("Phase: atomic set validation and rest seconds (UX-03, UX-10)");
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const valMeta = await getExerciseMeta(page, "Day 1");
  const valEx = valMeta[0];
  const valExB = valMeta[1] || valMeta[0];
  const valKey = `${valEx.id}_1`;
  const fillValidCandidate = async () => {
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await setLogDate(page, "2024-02-29");
    await fillExerciseSets(page, valEx.id, 1, 80, 8, 1);
    await setWorkoutField(page, "#bodyweight", "");
  };
  const assertRejectedFinish = async (name, mutate, fieldSel) => {
    await fillValidCandidate();
    await mutate();
    const logBefore = JSON.stringify((await getState(page)).log);
    const draftBefore = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
    await stopRestIfRunning(page);
    await saveWorkout(page, { expectNewRows: false });
    assert(
      JSON.stringify((await getState(page)).log) === logBefore,
      `${name} adds zero log rows`,
      "log changed after rejected Finish",
      `Fill a valid set → ${name} → Finish workout`
    );
    assert(
      (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) === draftBefore,
      `${name} keeps the exact draft`,
      "draft string changed",
      `Fill a valid set → ${name} → Finish workout`
    );
    if (fieldSel) {
      const marked = await page.evaluate((s) => document.querySelector(s)?.getAttribute("aria-invalid") === "true", fieldSel);
      assert(marked, `${name} marks the first bad field`, `aria-invalid missing on ${fieldSel}`, name);
    }
  };

  await assertRejectedFinish("negative load", () => setWorkoutField(page, `[data-k="${valKey}_load"]`, "-5"), `[data-k="${valKey}_load"]`);
  await assertRejectedFinish("blank load", () => setWorkoutField(page, `[data-k="${valKey}_load"]`, ""), `[data-k="${valKey}_load"]`);
  await assertRejectedFinish("non-numeric load", () => setWorkoutField(page, `[data-k="${valKey}_load"]`, "abc"), `[data-k="${valKey}_load"]`);
  await assertRejectedFinish("zero reps", () => setWorkoutField(page, `[data-k="${valKey}_reps"]`, "0"), `[data-k="${valKey}_reps"]`);
  await assertRejectedFinish("negative reps", () => setWorkoutField(page, `[data-k="${valKey}_reps"]`, "-1"), `[data-k="${valKey}_reps"]`);
  await assertRejectedFinish("fractional reps", () => setWorkoutField(page, `[data-k="${valKey}_reps"]`, "8.5"), `[data-k="${valKey}_reps"]`);
  await assertRejectedFinish("blank reps", () => setWorkoutField(page, `[data-k="${valKey}_reps"]`, ""), `[data-k="${valKey}_reps"]`);
  await assertRejectedFinish("negative RIR", () => setWorkoutField(page, `[data-k="${valKey}_rir"]`, "-0.5"), `[data-k="${valKey}_rir"]`);
  await assertRejectedFinish("blank RIR", () => setWorkoutField(page, `[data-k="${valKey}_rir"]`, ""), `[data-k="${valKey}_rir"]`);
  await assertRejectedFinish("invalid bodyweight", () => setWorkoutField(page, "#bodyweight", "0"), "#bodyweight");
  await assertRejectedFinish("blank date", () => setLogDateRaw(page, ""), "#date");
  await assertRejectedFinish("malformed date", () => setLogDateRaw(page, "not-a-date"), "#date");
  await assertRejectedFinish("impossible date", () => setLogDateRaw(page, "2024-02-30"), "#date");
  await assertRejectedFinish("invalid leap-day date", () => setLogDateRaw(page, "2023-02-29"), "#date");

  await fillValidCandidate();
  await setWorkoutField(page, `[data-k="${valKey}_load"]`, "-9");
  const surviveLog = JSON.stringify((await getState(page)).log);
  const surviveDraft = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  await stopRestIfRunning(page);
  await saveWorkout(page, { expectNewRows: false });
  await saveSettingsAndFlush(page);
  await reloadApp(page);
  assert(
    JSON.stringify((await getState(page)).log) === surviveLog,
    "Failed Finish log is unchanged after Settings save, flush, and reload",
    "log drifted after unrelated Settings save",
    "Invalid Finish → Settings save → flush → reload"
  );
  const surviveDraftAfter = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  assert(
    !!surviveDraftAfter && JSON.parse(surviveDraftAfter)[`${valKey}_load`] === "-9",
    "Failed Finish draft survives Settings save, flush, and reload",
    `draft=${surviveDraftAfter}`,
    "Invalid Finish → Settings save → flush → reload → draft still has -9 load"
  );
  void surviveDraft;

  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillValidCandidate();
  await stopRestIfRunning(page);
  await setWorkoutField(page, `[data-k="${valKey}_load"]`, "");
  const restHiddenBefore = await page.evaluate(() => document.querySelector("#restBar")?.classList.contains("hidden") !== false);
  const doneBefore = await page.evaluate((k) => document.querySelector(`[data-set="${k}"]`)?.classList.contains("is-done"), valKey);
  await page.click(`[data-save="${valKey}"]`);
  await page.waitForTimeout(80);
  const restHiddenAfter = await page.evaluate(() => document.querySelector("#restBar")?.classList.contains("hidden") !== false);
  const doneAfter = await page.evaluate((k) => document.querySelector(`[data-set="${k}"]`)?.classList.contains("is-done"), valKey);
  const draftDone = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}").__done || [], DRAFT);
  assert(
    restHiddenAfter && restHiddenBefore && doneAfter === doneBefore && !draftDone.includes(valKey),
    "Failed Save set does not commit, start rest, or arm unfinished",
    `restHidden=${restHiddenAfter} done=${doneAfter} __done=${JSON.stringify(draftDone)}`,
    "Clear kg → Save set → rest stays off and set is not committed"
  );

  await nav(page, "settings");
  await page.selectOption("#lang", "en");
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await setLogDate(page, "2024-02-29");
  await fillExerciseSets(page, valEx.id, 1, "90.5", 8, "1.5");
  const beforeEn = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;
  const enRow = (await getState(page)).log.find((r) => !beforeEn.has(r.session) && r.exerciseId === valEx.id);
  assert(
    enRow && Math.abs(+enRow.load - 90.5) < 0.001 && Math.abs(+enRow.rir - 1.5) < 0.001,
    "EN decimal load and RIR finish",
    JSON.stringify(enRow && { load: enRow.load, rir: enRow.rir }),
    "Log 90.5 kg @ 1.5 RIR → Finish"
  );

  await nav(page, "settings");
  await page.selectOption("#lang", "pt");
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await setLogDate(page, "2024-02-29");
  await setWorkoutField(page, `[data-k="${valKey}_load"]`, "90,5");
  await setWorkoutField(page, `[data-k="${valKey}_reps"]`, "7");
  await setWorkoutField(page, `[data-k="${valKey}_rir"]`, "2,5");
  const beforePt = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;
  const ptRow = (await getState(page)).log.find((r) => !beforePt.has(r.session) && r.exerciseId === valEx.id);
  assert(
    ptRow && Math.abs(+ptRow.load - 90.5) < 0.001 && Math.abs(+ptRow.rir - 2.5) < 0.001,
    "PT decimal load and RIR finish",
    JSON.stringify(ptRow && { load: ptRow.load, rir: ptRow.rir }),
    "Log 90,5 kg @ 2,5 RIR in PT → Finish"
  );
  await nav(page, "settings");
  await page.selectOption("#lang", "en");

  const beforeHist = new Set((await getState(page)).log.map((r) => r.session));
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await setLogDate(page, "2024-03-01");
  if (valEx.sets >= 2) await fillExerciseSets(page, valEx.id, 2, 70, 6, 1);
  else {
    await fillExerciseSets(page, valEx.id, 1, 70, 6, 1);
    await fillExerciseSets(page, valExB.id, 1, 40, 10, 1);
  }
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;
  const histSid = (await getState(page)).log.find((r) => !beforeHist.has(r.session)).session;
  const histSnap = () => getState(page).then((s) => s.log.filter((r) => r.session === histSid));

  await openSessionEditor(page, histSid);
  await page.evaluate((v) => {
    const el = document.querySelector('.session--edit [data-ed="date"]');
    el.setAttribute("type", "text");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, "");
  const histBeforeBlank = JSON.stringify(await histSnap());
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    JSON.stringify(await histSnap()) === histBeforeBlank,
    "History Save rejects a blank date",
    "session rows changed",
    "History editor → clear date → Save changes"
  );

  await openSessionEditor(page, histSid);
  await page.evaluate((v) => {
    const el = document.querySelector('.session--edit [data-ed="date"]');
    el.setAttribute("type", "text");
    el.value = v;
  }, "2024-02-30");
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    JSON.stringify(await histSnap()) === histBeforeBlank,
    "History Save rejects an impossible date",
    "session rows changed",
    "History editor → 2024-02-30 → Save changes"
  );

  await openSessionEditor(page, histSid);
  await page.evaluate((v) => {
    const el = document.querySelector('.session--edit [data-ed="date"]');
    el.setAttribute("type", "text");
    el.value = v;
  }, "2023-02-29");
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    JSON.stringify(await histSnap()) === histBeforeBlank,
    "History Save rejects an invalid leap-day",
    "session rows changed",
    "History editor → 2023-02-29 → Save changes"
  );

  await openSessionEditor(page, histSid);
  await page.fill('.session--edit [data-ek="load|0"]', "-3");
  const histInvalid = JSON.stringify(await histSnap());
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    JSON.stringify(await histSnap()) === histInvalid,
    "History invalid load leaves the session unchanged",
    "session rows changed",
    "History editor → negative load → Save changes"
  );
  await saveSettingsAndFlush(page);
  await reloadApp(page);
  assert(
    JSON.stringify(await histSnap()) === histInvalid,
    "History invalid edit stays deep-equal after Settings save, flush, and reload",
    "session drifted",
    "Invalid History save → Settings save → flush → reload"
  );

  await openSessionEditor(page, histSid);
  const histCount = (await histSnap()).length;
  await page.click('[data-edrm="1"]');
  assert(
    await page.evaluate(() => document.querySelector('.edrow[data-edidx="1"]')?.classList.contains("is-removed")),
    "History Remove set stages a row without writing",
    "row not marked is-removed",
    "History editor → Remove set on row 2"
  );
  await page.click('[data-edrm="1"]');
  assert(
    !(await page.evaluate(() => document.querySelector('.edrow[data-edidx="1"]')?.classList.contains("is-removed"))),
    "History Undo remove restores the staged row",
    "row still removed",
    "History editor → Remove set → Undo remove"
  );
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    (await histSnap()).length === histCount,
    "History remove + undo + save keeps every row",
    `count=${(await histSnap()).length}`,
    "History editor → remove → undo → Save changes"
  );

  await openSessionEditor(page, histSid);
  await page.click('[data-edrm="1"]');
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    (await histSnap()).length === histCount - 1,
    "History remove + save drops the staged row",
    `count=${(await histSnap()).length} expected ${histCount - 1}`,
    "History editor → Remove set → Save changes"
  );

  const beforeSibling = new Set((await getState(page)).log.map((r) => r.session));
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await setLogDate(page, "2024-03-02");
  if (valEx.sets >= 2) await fillExerciseSets(page, valEx.id, 2, 65, 5, 1);
  else {
    await fillExerciseSets(page, valEx.id, 1, 65, 5, 1);
    await fillExerciseSets(page, valExB.id, 1, 35, 8, 1);
  }
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;
  const sibSid = (await getState(page)).log.find((r) => !beforeSibling.has(r.session)).session;
  const sibSnap = () => getState(page).then((s) => s.log.filter((r) => r.session === sibSid));
  const sibBefore = JSON.stringify(await sibSnap());
  await openSessionEditor(page, sibSid);
  await page.fill('.session--edit [data-ek="load|0"]', "nope");
  await page.click('[data-edrm="1"]');
  await page.evaluate(() => window.__repforgeSaveSessionEdit(document.querySelector("[data-edsave]").dataset.edsave));
  await page.waitForTimeout(80);
  assert(
    JSON.stringify(await sibSnap()) === sibBefore,
    "History invalid sibling + remove commits nothing",
    "session changed despite invalid remaining row",
    "History editor → invalidate row 1 → remove row 2 → Save changes"
  );

  await nav(page, "settings");
  const priorRest = (await getState(page)).settings.restSec;
  await page.evaluate(() => {
    const el = document.querySelector("#restSec");
    el.value = "90.5";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(80);
  const restUser = await getState(page);
  const restInvalid = await page.evaluate(() => document.querySelector("#restSec")?.getAttribute("aria-invalid") === "true");
  assert(
    restUser.settings.restSec === priorRest && restInvalid,
    "Fractional rest user input is rejected and announced",
    `stored=${restUser.settings.restSec} aria-invalid=${restInvalid}`,
    "Settings → restSec 90.5 → change"
  );

  const st = await getState(page);
  st.settings.restSec = 90.5;
  await persistState(page, st);
  await reloadApp(page);
  await nav(page, "settings");
  const restShown = (await page.textContent("#restSecDisplay"))?.trim();
  const restInput = await page.inputValue("#restSec");
  assert(
    /^\d+:\d{2}$/.test(restShown) && restShown === "1:31" && restInput === "91",
    "Legacy 90.5 rest seconds normalize once and display as M:SS",
    `display=${restShown} input=${restInput}`,
    "Seed settings.restSec=90.5 → reload → Settings rest display"
  );

  beginPhase("Phase: transactional onboarding and block succession (UX-02, UX-08, UX-09)");
  await page.evaluate(() => localStorage.removeItem("repforge_ui_v1"));
  const beforeCreate = await getState(page);
  await nav(page, "settings");
  await page.click("#createProgram");
  await page.waitForSelector("#onboarding.active", { timeout: 5000 });
  await page.click("#onbCancel");
  await page.click("#entryCancelDiscard");
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), { timeout: 5000 });
  const afterCreateCancel = await getState(page);
  assert(
    afterCreateCancel.programMeta?.id === beforeCreate.programMeta?.id &&
      afterCreateCancel.programHistory?.length === beforeCreate.programHistory?.length,
    "Settings → Create program → Cancel is a lifecycle no-op",
    JSON.stringify({ before: beforeCreate.programMeta?.id, after: afterCreateCancel.programMeta?.id }),
    "Settings → Create new program → Cancel"
  );

  const histBeforeBlock = (await getState(page)).programHistory?.length || 0;
  const idBeforeBlock = (await getState(page)).programMeta?.id;
  const revisionBeforeBlock = (await getState(page))._storageRevision || 0;
  const onboardingDeferred = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
  await page.waitForSelector("#onboarding.active", { timeout: 5000 });
  const stateWhileOnboarding = await getState(page);
  assert(
    onboardingDeferred.kind === "deferred" &&
      onboardingDeferred.deferred === true &&
      onboardingDeferred.committed === false &&
      onboardingDeferred.localOk === false &&
      onboardingDeferred.idbOk === false &&
      onboardingDeferred.revision === revisionBeforeBlock &&
      stateWhileOnboarding._storageRevision === revisionBeforeBlock &&
      stateWhileOnboarding.programMeta?.id === idBeforeBlock &&
      (stateWhileOnboarding.programHistory?.length || 0) === histBeforeBlock,
    "Block-review onboarding is explicitly deferred without a revision change",
    JSON.stringify({ result: onboardingDeferred, before: revisionBeforeBlock, after: stateWhileOnboarding._storageRevision }),
    "commitNextBlock(onboarding) → pending only"
  );
  await page.click("#onbCancel");
  await page.click("#entryCancelDiscard");
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), { timeout: 5000 });
  assert(
    (await getState(page)).programMeta?.id === idBeforeBlock &&
      ((await getState(page)).programHistory?.length || 0) === histBeforeBlock &&
      (await page.evaluate(() => window.__repforgePendingBlock())) == null,
    "Block onboarding Cancel leaves the old block active",
    "pending leftover or history changed",
    "Block onboarding → Cancel"
  );

  const revisionBeforeBlockSave = (await getState(page))._storageRevision || 0;
  const onboardingDeferredForSave = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
  const stateBeforeBlockSave = await getState(page);
  assert(
    onboardingDeferredForSave.kind === "deferred" &&
      onboardingDeferredForSave.deferred === true &&
      onboardingDeferredForSave.committed === false &&
      onboardingDeferredForSave.localOk === false &&
      onboardingDeferredForSave.idbOk === false &&
      onboardingDeferredForSave.revision === revisionBeforeBlockSave &&
      stateBeforeBlockSave._storageRevision === revisionBeforeBlockSave,
    "Block onboarding remains deferred until the eventual Save",
    JSON.stringify({ result: onboardingDeferredForSave, before: revisionBeforeBlockSave, after: stateBeforeBlockSave._storageRevision }),
    "commitNextBlock(onboarding) → inspect result and revision before finalizeProgramSetup"
  );
  const blockSave = await page.evaluate(async () => {
    const cur = JSON.parse(localStorage.getItem("repforge_v1"));
    return window.__repforgeFinalizeProgramSetup({
      exercises: cur.program,
      name: "Block successor",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "block",
    });
  });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const afterBlockSave = await getState(page);
  assert(
    (blockSave.localOk || blockSave.idbOk) &&
      blockSave.deferred !== true &&
      blockSave.revision === revisionBeforeBlockSave + 1 &&
      afterBlockSave._storageRevision === blockSave.revision &&
      afterBlockSave.programMeta?.id !== idBeforeBlock &&
      afterBlockSave.programMeta?.onboarded === true &&
      (afterBlockSave.programHistory || []).some((h) => h.id === idBeforeBlock) &&
      (afterBlockSave.programHistory || []).filter((h) => h.id === idBeforeBlock).length === 1,
    "Block onboarding Save archives the captured block once",
    JSON.stringify({
      result: blockSave,
      newId: afterBlockSave.programMeta?.id,
      hist: (afterBlockSave.programHistory || []).map((h) => h.id),
    }),
    "pending block → finalizeProgramSetup origin=block"
  );

  const idForDup = afterBlockSave.programMeta.id;
  const histForDup = afterBlockSave.programHistory.length;
  await page.evaluate(async () => {
    await Promise.all([window.__repforgeCommitNextBlock("repeat"), window.__repforgeCommitNextBlock("repeat")]);
  });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const afterDup = await getState(page);
  assert(
    afterDup.programMeta.id !== idForDup &&
      afterDup.programHistory.length === histForDup + 1 &&
      afterDup.programHistory.filter((h) => h.id === idForDup).length === 1,
    "Double next-block commit archives the old id once",
    `hist ${histForDup} → ${afterDup.programHistory.length} id=${afterDup.programMeta.id}`,
    "Promise.all commitNextBlock(repeat) ×2"
  );
  const settledId = afterDup.programMeta.id;
  const settledHistory = afterDup.programHistory.length;
  const repeatedBlock = await page.evaluate(
    (oldId) => window.__repforgeCommitNextBlock("repeat", undefined, oldId),
    idForDup
  );
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const afterRepeatedBlock = await getState(page);
  assert(
    repeatedBlock.kind === "duplicate" &&
      repeatedBlock.committed === false &&
      repeatedBlock.duplicate === true &&
      afterRepeatedBlock.programMeta.id === settledId &&
      afterRepeatedBlock.programHistory.length === settledHistory,
    "A settled block-review activation cannot create another successor",
    JSON.stringify({ repeatedBlock, settledId, afterId: afterRepeatedBlock.programMeta.id }),
    `commitNextBlock(repeat, expected=${idForDup}) after settlement`
  );
  const beforeFailedBlock = await getState(page);
  const failedBlock = await page.evaluate(async (oldId) => {
    const io = {
      async writeLocal() { throw new Error("ls fail"); },
      async writeIdb() { throw new Error("idb fail"); },
    };
    return window.__repforgeCommitNextBlock("repeat", io, oldId);
  }, beforeFailedBlock.programMeta.id);
  const afterFailedBlock = await getState(page);
  assert(
    failedBlock.kind === "failed" &&
      failedBlock.committed === false &&
      failedBlock.localOk === false &&
      failedBlock.idbOk === false &&
      afterFailedBlock._storageRevision === beforeFailedBlock._storageRevision &&
      afterFailedBlock.programMeta.id === beforeFailedBlock.programMeta.id &&
      afterFailedBlock.programHistory.length === beforeFailedBlock.programHistory.length,
    "A total storage failure reports failed and does not commit",
    JSON.stringify({ failedBlock, beforeRevision: beforeFailedBlock._storageRevision, afterRevision: afterFailedBlock._storageRevision }),
    "commitNextBlock(repeat) with false/false storage adapter"
  );

  const adapterOutcomes4 = [[true, true], [true, false], [false, true], [false, false]];
  for (const [localOk, idbOk] of adapterOutcomes4) {
    const beforeTpl = await getState(page);
    const draftRaw = await page.evaluate((k) => {
      const raw = JSON.stringify({
        __sessionNotes: "template transition draft",
        __contextTouched: { sessionNotes: true },
      });
      localStorage.setItem(k, raw);
      return raw;
    }, DRAFT);
    const result = await page.evaluate(async ({ localOk, idbOk }) => {
      const io = {
        async writeLocal(data) {
          if (!localOk) throw new Error("ls fail");
          localStorage.setItem("repforge_v1", JSON.stringify(data));
        },
        async writeIdb(data) {
          if (!idbOk) throw new Error("idb fail");
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("repforge", 1);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("kv", "readwrite");
            tx.objectStore("kv").put(data, "repforge_v1");
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        },
      };
      const current = JSON.parse(localStorage.getItem("repforge_v1") || "null");
      return window.__repforgeFinalizeProgramSetup({
        exercises: current.program,
        name: "Beginner program",
        answers: { goal: current.programMeta?.goal || "hypertrophy" },
        destination: "log",
        origin: "settings",
        draftConfirmed: true,
      }, io);
    }, { localOk, idbOk });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    if (localOk || idbOk) {
      await reloadApp(page);
      const after = await getState(page);
      const draftNow = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
      assert(
        after.programMeta?.name === "Beginner program" &&
          after.programMeta?.id !== beforeTpl.programMeta.id &&
          after.log.length === beforeTpl.log.length &&
          result.localOk === localOk &&
          draftNow == null,
        `Beginner template (${localOk},${idbOk}) commits a new identity and preserves the log`,
        JSON.stringify({ result, name: after.programMeta?.name, logs: after.log.length, draftNow }),
        `applyProgramTemplate adapter ${localOk}/${idbOk}`
      );
    } else {
      const after = await getState(page);
      const draftNow = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
      assert(
        after.programMeta?.id === beforeTpl.programMeta.id &&
          after.log.length === beforeTpl.log.length &&
          draftNow === draftRaw,
        "Beginner template total failure rolls back and keeps the draft",
        JSON.stringify({ result, id: after.programMeta?.id }),
        "applyProgramTemplate false/false"
      );
    }
  }

  const setupDraftRaw = await page.evaluate((k) => {
    const raw = JSON.stringify({
      __sessionNotes: "settings onboarding transition draft",
      __contextTouched: { sessionNotes: true },
    });
    localStorage.setItem(k, raw);
    return raw;
  }, DRAFT);
  const setupBeforeFailure = await getState(page);
  const setupFailure = await page.evaluate(async (program) => {
    const io = {
      async writeLocal() { throw new Error("ls fail"); },
      async writeIdb() { throw new Error("idb fail"); },
    };
    return window.__repforgeFinalizeProgramSetup({
      exercises: program,
      name: "Rejected replacement",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "settings",
      draftConfirmed: true,
    }, io);
  }, setupBeforeFailure.program);
  const setupAfterFailure = await getState(page);
  const setupDraftAfterFailure = await page.evaluate((k) => localStorage.getItem(k), DRAFT);
  assert(
    !setupFailure.localOk &&
      !setupFailure.idbOk &&
      setupAfterFailure.programMeta.id === setupBeforeFailure.programMeta.id &&
      setupDraftAfterFailure === setupDraftRaw,
    "Rejected Settings onboarding replacement preserves live state and exact draft",
    JSON.stringify({ setupFailure, sameId: setupAfterFailure.programMeta.id === setupBeforeFailure.programMeta.id }),
    "finalizeProgramSetup false/false with active draft"
  );
  const setupAccepted = await page.evaluate((program) => window.__repforgeFinalizeProgramSetup({
    exercises: program,
    name: "Accepted replacement",
    answers: { goal: "hypertrophy" },
    destination: "log",
    origin: "settings",
    draftConfirmed: true,
  }), setupBeforeFailure.program);
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const setupAfterAccepted = await getState(page);
  assert(
    (setupAccepted.localOk || setupAccepted.idbOk) &&
      setupAfterAccepted.programMeta.id !== setupBeforeFailure.programMeta.id &&
      (await page.evaluate((k) => localStorage.getItem(k), DRAFT)) == null,
    "Accepted Settings onboarding replacement clears the confirmed draft",
    JSON.stringify({ setupAccepted, newId: setupAfterAccepted.programMeta.id }),
    "finalizeProgramSetup accepted with active draft"
  );

  await page.evaluate(() => localStorage.removeItem("repforge_ui_v1"));
  await clearState(page);
  await reloadApp(page, { dismissOnboarding: false });
  await startFromFirstRun(page);
  await driveRecommendOnboarding(page, { days: 3, experience: "first", activate: false });
  const activeBeforeCandidateEdit = await page.evaluate(() => localStorage.getItem("repforge_v1"));
  await page.click("#entryEdit");
  await page.waitForSelector('#onbProgramEditor [data-role="exercise"]', { timeout: 8000 });
  await page.locator('#onbProgramEditor [data-role="day-menu"]').first().click();
  await page.locator('#onbProgramEditor [data-role="toggle-reorder"]').first().click();
  await page.locator('#onbProgramEditor [data-role="exercise-menu"]').first().click();
  await page.locator('#onbProgramEditor [data-role="more-details"][role="menuitem"]').first().click();
  const candidateNote = page.locator('#onbProgramEditor [data-role="exercise-field"][data-field="notes"]').first();
  await candidateNote.fill("Simulation candidate edit");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.result?.preview?.program?.[0]?.notes === "Simulation candidate edit");
  // The durable setup draft persists asynchronously behind the storage lock;
  // the in-memory wait above does not prove the write landed. Wait for the
  // durable read the assert below performs, or slow runners observe a stale
  // draft and fail without any product defect.
  await page.waitForFunction((k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "{}").state?.result?.preview?.program?.[0]?.notes === "Simulation candidate edit";
    } catch {
      return false;
    }
  }, SETUP_DRAFT, { timeout: 10000 });
  const editState = await page.evaluate(() => ({
    activeRaw: localStorage.getItem("repforge_v1"),
    draft: JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "{}"),
    editorVisible: !!document.querySelector('#onbProgramEditor [data-role="editor"]'),
  }));
  assert(
    editState.activeRaw === activeBeforeCandidateEdit &&
      editState.draft.state?.result?.preview?.program?.[0]?.notes === "Simulation candidate edit" &&
      editState.editorVisible,
    "Onboarding Edit changes only the durable candidate draft",
    JSON.stringify({ sameActive: editState.activeRaw === activeBeforeCandidateEdit, editorVisible: editState.editorVisible }),
    "First-run onboarding → Edit before saving"
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__repforgeStorage?.flush === "function", { timeout: 10000 });
  await startFromFirstRun(page);
  await page.waitForSelector("#entryResumeContinue", { timeout: 10000 });
  await page.click("#entryResumeContinue");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
  const resumedEdit = await page.evaluate(() => {
    const draft = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "{}");
    return {
      activeRaw: localStorage.getItem("repforge_v1"),
      note: draft.state?.result?.preview?.program?.[0]?.notes,
      reviewVisible: document.querySelector("#onboarding")?.classList.contains("active"),
    };
  });
  assert(
    resumedEdit.activeRaw === activeBeforeCandidateEdit &&
      resumedEdit.note === "Simulation candidate edit" &&
      resumedEdit.reviewVisible,
    "Reload resumes the edited candidate for review without activating it",
    JSON.stringify(resumedEdit),
    "First-run onboarding → Edit before saving → reload"
  );
  await page.click("#entryActivate");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("repforge_v1") || "{}").programMeta?.onboarded === true);
  const afterDone = await getState(page);
  assert(
    afterDone.program?.[0]?.notes === "Simulation candidate edit" &&
      !Object.prototype.hasOwnProperty.call(afterDone, "_storageFollowUp"),
    "Only explicit activation installs the edited candidate",
    JSON.stringify({ note: afterDone.program?.[0]?.notes, follow: afterDone._storageFollowUp }),
    "Edit onboarding → resume review → activate"
  );
  await page.evaluate(() => {
    if (typeof window.closeTour === "function") window.closeTour();
  });

  beginPhase("Honest affordances, tour, and deletion copy");
  await nav(page, "log");
  const firstExId = await page.evaluate(() => {
    const b = document.querySelector("#todayExList [data-exopen], #workout [data-exopen]");
    return b?.getAttribute("data-exopen") || "";
  });
  if (!firstExId) {
    await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  }
  const exId = firstExId || (await page.evaluate(() => document.querySelector("#workout [data-exopen]")?.getAttribute("data-exopen") || ""));
  if (exId) {
    await page.evaluate((id) => {
      const b = document.querySelector(`[data-exopen="${id}"]`);
      if (b) b.click();
      else window.openExerciseView?.(id, "log");
    }, exId);
    await page.waitForSelector("#exercise.view.active, body.is-exercise", { timeout: 5000 });
    const residue = await page.evaluate(() => {
      const range = document.querySelector("#exDetail .range-static, #exDetail .range-quiet");
      const records = [...document.querySelectorAll("#exDetail .listrow")].filter((el) => !el.id && !el.closest("#exSeePrs"));
      const actionable = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          role: el.getAttribute("role"),
          tabindex: el.getAttribute("tabindex"),
          cursor: cs.cursor,
          cls: el.className,
          hasOnclick: typeof el.onclick === "function",
          caret: !!el.querySelector(".caret, .chevron"),
        };
      };
      return { range: actionable(range), records: records.map(actionable), seePrs: !!document.querySelector("#exSeePrs") };
    });
    assert(
      residue.range &&
        residue.range.tag !== "BUTTON" &&
        residue.range.role !== "button" &&
        residue.range.cursor !== "pointer" &&
        !residue.range.caret &&
        !/\bbtn\b|\brange-quiet\b|\blink-/.test(residue.range.cls),
      "Exercise 12-week range is static text without action residue",
      JSON.stringify(residue.range)
    );
    assert(
      residue.records.every(
        (r) => r.tag !== "BUTTON" && r.role !== "button" && r.cursor !== "pointer" && !r.caret && !r.hasOnclick
      ),
      "Exercise record rows are static without chevrons or handlers",
      JSON.stringify(residue.records)
    );
    const before = await page.evaluate((d) => ({
      view: document.querySelector(".view.active")?.id,
      draft: localStorage.getItem(d),
      log: JSON.parse(localStorage.getItem("repforge_v1") || "{}").log?.length,
    }), DRAFT);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll("#exDetail .range-static, #exDetail .listrow--static")];
      for (const el of els) {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      }
    });
    const after = await page.evaluate((d) => ({
      view: document.querySelector(".view.active")?.id,
      draft: localStorage.getItem(d),
      log: JSON.parse(localStorage.getItem("repforge_v1") || "{}").log?.length,
    }), DRAFT);
    assert(
      before.view === after.view && before.draft === after.draft && before.log === after.log,
      "Clicking static range/records does not change route, draft, or log",
      JSON.stringify({ before, after })
    );
    await page.click("#exBack");
  } else {
    assert(false, "Exercise detail opened for static-affordance checks", "no exercise id");
  }

  const statsPeriodGone = await page.evaluate(() => !document.querySelector("#statsPeriod"));
  assert(statsPeriodGone, "#statsPeriod is absent; volume window stays on #volWindow", "statsPeriod still in DOM");
  await nav(page, "stats");
  const volWindow = await page.locator("#volWindow").count();
  assert(volWindow === 1, "Completed hard sets still has the 7/28-day control", `volWindow=${volWindow}`);

  const positioning = await page.evaluate(async () => {
    const manifest = await (await fetch("./manifest.webmanifest")).json();
    const readme = await (await fetch("./README.md")).text();
    const blob = `${manifest.description}\n${readme}`;
    return {
      description: manifest.description,
      machine: /machine-only/i.test(blob),
      localOnlyStorage: /localStorage-only/i.test(blob),
      equipment: /machines/i.test(blob) && /cables/i.test(blob) && /dumbbells/i.test(blob) && /barbells/i.test(blob) && /bodyweight/i.test(blob),
    };
  });
  assert(
    positioning.equipment && !positioning.machine && !positioning.localOnlyStorage,
    "Manifest and README name broad equipment and drop machine-only/localStorage-only claims",
    JSON.stringify(positioning)
  );

  const deleteCopy = await page.evaluate(() => ({
    label: window.RepForgeI18n.t("settings.delete_all"),
    confirm: window.RepForgeI18n.t("confirm.delete_log"),
    lede: window.RepForgeI18n.t("settings.danger_lede"),
  }));
  assert(
    /workout history/i.test(deleteCopy.label) &&
      /draft/i.test(deleteCopy.confirm) &&
      /program/i.test(deleteCopy.confirm) &&
      /settings/i.test(deleteCopy.confirm),
    "Deletion copy names workout history and retained program/Settings",
    JSON.stringify(deleteCopy)
  );

  const stateBeforeDelete = await getState(page);
  await page.evaluate((d) => localStorage.setItem(d, JSON.stringify({ note: "keep-me-not" })), DRAFT);
  await nav(page, "settings");
  const progLen = stateBeforeDelete.program.length;
  const settingsUnit = stateBeforeDelete.settings.unit;
  await page.click("#reset");
  await page.waitForTimeout(100);
  const afterDelete = await getState(page);
  const draftGone = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  assert(
    afterDelete.log.length === 0 &&
      !draftGone &&
      afterDelete.program.length === progLen &&
      afterDelete.settings.unit === settingsUnit,
    "Delete workout history clears log and draft but keeps program and Settings",
    `log=${afterDelete.log.length} draft=${draftGone} program=${afterDelete.program.length}`
  );

  const tourCopy = await page.evaluate(() => {
    const en = window.RepForgeI18n.STRINGS.en;
    const pt = window.RepForgeI18n.STRINGS.pt;
    return {
      en3: en["tour.3.body"],
      pt3: pt["tour.3.body"],
      en4: en["tour.4.body"],
      pt4: pt["tour.4.body"],
    };
  });
  assert(
    /header arrows|swipe/i.test(tourCopy.en3) &&
      /setas do cabeçalho|deslize/i.test(tourCopy.pt3) &&
      !/bottom/i.test(tourCopy.en3) &&
      /header rest/i.test(tourCopy.en4),
    "Tour step 3/4 copy teaches swipe, header chevrons, and header rest in both languages",
    JSON.stringify(tourCopy)
  );

  await page.evaluate(() => window.startTour("first-run"));
  await page.waitForSelector("#tour:not(.hidden)", { timeout: 3000 });
  const tourModal = await page.evaluate(() => {
    const tour = document.querySelector("#tour");
    const focused = document.activeElement?.id;
    const inertMain = document.querySelector("main")?.inert;
    return { modal: tour?.getAttribute("aria-modal"), focused, inertMain, hidden: tour?.classList.contains("hidden") };
  });
  assert(
    tourModal.modal === "true" && tourModal.focused === "tourSkip" && tourModal.inertMain === true,
    "Tour is aria-modal with Skip focused and the preview surface inert",
    JSON.stringify(tourModal)
  );

  const stepAt = async (n) => {
    await page.evaluate((i) => {
      while (window.__repforgeUi && document.querySelector("#tour:not(.hidden)")) {
        const eyebrow = document.querySelector("#tourEyebrow")?.textContent || "";
        const cur = +(eyebrow.match(/(\d+)/) || [])[1] || 1;
        if (cur - 1 === i) break;
        if (cur - 1 < i) document.querySelector("#tourNext")?.click();
        else document.querySelector("#tourBack")?.click();
        break;
      }
    }, n);
    for (let i = 0; i < 12; i++) {
      const cur = await page.evaluate(() => {
        const t = document.querySelector("#tourEyebrow")?.textContent || "";
        return +(t.match(/(\d+)/) || [])[1] || 1;
      });
      if (cur - 1 === n) break;
      if (cur - 1 < n) await page.click("#tourNext");
      else await page.click("#tourBack");
    }
    return page.evaluate(() => ({
      view: document.querySelector(".view.active")?.id,
      workout: document.body.classList.contains("is-workout"),
      focus: document.body.classList.contains("is-focus-wo"),
      overflow: !document.querySelector("#woOverflow")?.classList.contains("hidden"),
      arrows: !!document.querySelector("#woPrev"),
      rest: !document.querySelector("#woRest")?.classList.contains("hidden"),
      finishInView: !!document.querySelector("#logForm .btn--save"),
    }));
  };
  const s0 = await stepAt(0);
  assert(s0.view === "log" && !s0.workout, "Tour step 0 shows the Today dashboard", JSON.stringify(s0));
  const s1 = await stepAt(1);
  assert(s1.workout && !s1.focus && s1.overflow, "Tour step 1 is List with overflow open", JSON.stringify(s1));
  const s2 = await stepAt(2);
  assert(s2.workout && !s2.focus && s2.overflow, "Tour step 2 keeps List overflow open for layout controls", JSON.stringify(s2));
  const s3 = await stepAt(3);
  assert(s3.workout && s3.focus && !s3.overflow && s3.arrows, "Tour step 3 is Focus with header arrows and overflow closed", JSON.stringify(s3));
  const s4 = await stepAt(4);
  assert(s4.workout && s4.focus && s4.rest, "Tour step 4 shows the header rest control", JSON.stringify(s4));
  const s5 = await stepAt(5);
  assert(s5.workout && !s5.focus && s5.finishInView, "Tour step 5 is List with Finish workout in view", JSON.stringify(s5));
  const s6 = await stepAt(6);
  assert(s6.view === "stats", "Tour step 6 opens Progress", JSON.stringify(s6));

  const draftDuring = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  const logDuring = (await getState(page)).log.length;
  await page.click("#tourSkip");
  const firstRunExit = await page.evaluate(() => ({
    hidden: document.querySelector("#tour")?.classList.contains("hidden"),
    view: document.querySelector(".view.active")?.id,
    workout: document.body.classList.contains("is-workout"),
    focus: document.activeElement?.id,
    tourDone: JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").tourDone,
  }));
  assert(
    firstRunExit.hidden && firstRunExit.view === "log" && !firstRunExit.workout && firstRunExit.focus === "startWorkout" && firstRunExit.tourDone,
    "First-run Skip ends on Today with focus on Start workout",
    JSON.stringify(firstRunExit)
  );
  assert(draftDuring == null || draftDuring === (await page.evaluate((d) => localStorage.getItem(d), DRAFT)), "Tour preview does not write a draft", draftDuring);

  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: true }));
  await page.waitForTimeout(80);
  const replaySnap = await page.evaluate(() => ({
    workout: document.body.classList.contains("is-workout"),
    focus: document.body.classList.contains("is-focus-wo"),
    day: document.querySelector("#woDayTitle")?.textContent || "",
  }));
  await page.evaluate(() => window.startTour("replay"));
  await page.waitForSelector("#tour:not(.hidden)");
  await page.click("#tourNext");
  await page.click("#tourSkip");
  const replaySkip = await page.evaluate(() => ({
    hidden: document.querySelector("#tour")?.classList.contains("hidden"),
    workout: document.body.classList.contains("is-workout"),
    focus: document.body.classList.contains("is-focus-wo"),
    focused: document.activeElement?.id,
  }));
  assert(
    replaySkip.hidden && replaySkip.workout === replaySnap.workout && replaySkip.focus === replaySnap.focus,
    "Replay Skip restores the pre-tour workout snapshot",
    JSON.stringify({ replaySnap, replaySkip })
  );

  await page.evaluate(() => window.startTour("replay"));
  await page.waitForSelector("#tour:not(.hidden)");
  for (let i = 0; i < 12; i++) {
    const last = await page.evaluate(() => document.querySelector("#tourNext")?.textContent || "");
    await page.click("#tourNext");
    if (/done|concluir|pronto/i.test(last)) break;
  }
  const replayDone = await page.evaluate(() => ({
    hidden: document.querySelector("#tour")?.classList.contains("hidden"),
    workout: document.body.classList.contains("is-workout"),
    focus: document.body.classList.contains("is-focus-wo"),
  }));
  assert(
    replayDone.hidden && replayDone.workout === replaySnap.workout && replayDone.focus === replaySnap.focus,
    "Replay Done restores the pre-tour snapshot",
    JSON.stringify(replayDone)
  );

  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await page.evaluate(() => window.__repforgeEnterWorkout?.({ focus: false }));
  await page.evaluate(() => {
    document.querySelectorAll("#workout [data-skip]").forEach((b) => b.click());
  });
  const skippedBefore = await page.evaluate(() => document.querySelectorAll("#workout .exercise.is-skipped, #workout .skipbar").length);
  const logBeforeSkipTour = (await getState(page)).log.length;
  await page.evaluate(() => window.startTour("replay"));
  await stepAt(3);
  const previewName = await page.evaluate(() => document.querySelector("#workout .focus-ex__name")?.textContent || "");
  const skippedUnchanged = await page.evaluate(() => {
    window.closeTour();
    return document.querySelectorAll("#workout [data-skip]").length;
  });
  assert(!!previewName, "All-skipped Focus preview still shows the first program exercise", `name=${previewName}`);
  assert((await getState(page)).log.length === logBeforeSkipTour, "All-skipped tour preview does not mutate the log", "");

  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#restSecPanel")?.classList.add("is-open"));
  await page.fill("#restSec", "0");
  await page.evaluate(() => document.querySelector("#restSec")?.dispatchEvent(new Event("change", { bubbles: true })));
  await page.waitForTimeout(50);
  await page.evaluate(() => window.startTour("replay"));
  await stepAt(4);
  const restPreview = await page.evaluate(() => ({
    visible: !document.querySelector("#woRest")?.classList.contains("hidden"),
    disabled: !!document.querySelector("#woRest")?.disabled,
    hint: document.querySelector("#woRestPreviewHint")?.textContent || "",
    running: document.querySelector("#woRest")?.classList.contains("is-running"),
  }));
  await page.click("#tourSkip");
  assert(
    restPreview.visible && restPreview.disabled && restPreview.hint && !restPreview.running,
    "Disabled-rest tour preview shows the header control without starting a timer",
    JSON.stringify(restPreview)
  );

  beginPhase("Coaching counts and destinations");
  {
    const dates = await page.evaluate(() => {
      const iso = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const add = (isoDate, n) => {
        const d = new Date(`${isoDate}T12:00:00`);
        d.setDate(d.getDate() + n);
        return iso(d);
      };
      const todayIso = iso(new Date());
      const wr = window.__repforgeWeek.weekRange(todayIso);
      return {
        today: todayIso,
        thisWeek: wr.start,
        lastWeek: add(wr.start, -7),
        stale: add(todayIso, -20),
        recentOffWeek: add(todayIso, -8),
      };
    });
    const mkEx = (id, day, order, name, extra = {}) => ({
      id,
      day,
      order,
      name,
      sets: extra.sets ?? 2,
      min: extra.min ?? 6,
      max: extra.max ?? 10,
      primary: extra.primary,
      secondary: "",
    });
    const mkRows = ({ id, name, day, date, session, load, reps, rir, sets = 2, primary }) =>
      Array.from({ length: sets }, (_, i) => ({
        session,
        date,
        day,
        name,
        exerciseId: id,
        set: i + 1,
        load,
        reps,
        rir,
        notes: "",
        created: `${date}T12:00:0${i}Z`,
        primary,
        secondary: "",
      }));
    const program = [
      mkEx("ex-improved", "Day 1", 1, "Coach Improved", { primary: "Chest" }),
      mkEx("ex-flat", "Day 1", 2, "Coach Flat", { primary: "Quads" }),
      mkEx("ex-regressed", "Day 1", 3, "Coach Regressed", { primary: "Lats" }),
      mkEx("ex-oneshot", "Day 1", 4, "Coach Oneshot", { primary: "Hamstrings" }),
      mkEx("ex-untrained", "Day 1", 5, "Coach Untrained", { primary: "Glutes" }),
      mkEx("ex-stale", "Day 1", 6, "Coach Stale", { primary: "Side delts" }),
      mkEx("ex-ready", "Day 1", 7, "Coach Ready", { min: 6, max: 8, primary: "Triceps" }),
      mkEx("ex-reduce", "Day 1", 8, "Coach Reduce", { min: 8, max: 12, primary: "Biceps" }),
      mkEx("ex-vol", "Day 1", 9, "Coach Volume", { sets: 4, primary: "Forearms" }),
      mkEx("ex-fatigue", "Day 1", 10, "Coach Fatigue", { min: 6, max: 12, primary: "Calves" }),
      mkEx("curl-a", "Day 1", 11, "Coach Curl", { min: 8, max: 12, primary: "Brachialis" }),
      mkEx("curl-b", "Day 2", 1, "Coach Curl", { min: 8, max: 12, primary: "Brachialis" }),
    ];
    const log = [
      ...mkRows({ id: "ex-improved", name: "Coach Improved", day: "Day 1", date: dates.lastWeek, session: "s-imp-prev", load: 80, reps: 6, rir: 1, primary: "Chest" }),
      ...mkRows({ id: "ex-improved", name: "Coach Improved", day: "Day 1", date: dates.thisWeek, session: "s-imp-cur", load: 85, reps: 8, rir: 1, primary: "Chest" }),
      ...mkRows({ id: "ex-flat", name: "Coach Flat", day: "Day 1", date: dates.lastWeek, session: "s-flat-prev", load: 70, reps: 8, rir: 1, primary: "Quads" }),
      ...mkRows({ id: "ex-flat", name: "Coach Flat", day: "Day 1", date: dates.thisWeek, session: "s-flat-cur", load: 70, reps: 8, rir: 1, primary: "Quads" }),
      ...mkRows({ id: "ex-regressed", name: "Coach Regressed", day: "Day 1", date: dates.lastWeek, session: "s-reg-prev", load: 100, reps: 8, rir: 1, primary: "Lats" }),
      ...mkRows({ id: "ex-regressed", name: "Coach Regressed", day: "Day 1", date: dates.thisWeek, session: "s-reg-cur", load: 80, reps: 5, rir: 1, primary: "Lats" }),
      ...mkRows({ id: "ex-oneshot", name: "Coach Oneshot", day: "Day 1", date: dates.thisWeek, session: "s-one-cur", load: 60, reps: 8, rir: 1, primary: "Hamstrings" }),
      ...mkRows({ id: "ex-stale", name: "Coach Stale", day: "Day 1", date: dates.stale, session: "s-stale", load: 70, reps: 8, rir: 1, primary: "Side delts" }),
      ...mkRows({ id: "ex-ready", name: "Coach Ready", day: "Day 1", date: dates.lastWeek, session: "s-rdy-prev", load: 80, reps: 6, rir: 1, primary: "Triceps" }),
      ...mkRows({ id: "ex-ready", name: "Coach Ready", day: "Day 1", date: dates.thisWeek, session: "s-rdy-cur", load: 80, reps: 8, rir: 1, primary: "Triceps" }),
      ...mkRows({ id: "ex-reduce", name: "Coach Reduce", day: "Day 1", date: dates.lastWeek, session: "s-red-prev", load: 90, reps: 10, rir: 1, primary: "Biceps" }),
      ...mkRows({ id: "ex-reduce", name: "Coach Reduce", day: "Day 1", date: dates.thisWeek, session: "s-red-cur", load: 90, reps: 3, rir: 1, primary: "Biceps" }),
      ...mkRows({ id: "ex-vol", name: "Coach Volume", day: "Day 1", date: dates.recentOffWeek, session: "s-vol", load: 70, reps: 7, rir: 1, sets: 2, primary: "Forearms" }),
      ...mkRows({ id: "ex-fatigue", name: "Coach Fatigue", day: "Day 1", date: dates.lastWeek, session: "s-fat-prev", load: 80, reps: 8, rir: 0, primary: "Calves" }),
      ...mkRows({ id: "ex-fatigue", name: "Coach Fatigue", day: "Day 1", date: dates.thisWeek, session: "s-fat-cur", load: 80, reps: 7, rir: 0, primary: "Calves" }),
    ];
    const prior = await getState(page);
    await persistState(page, {
      ...prior,
      program,
      log,
      programMeta: { ...(prior.programMeta || {}), onboarded: true, name: "Coach fixture" },
    });
    await reloadApp(page);
    await nav(page, "stats");

    const snap = await page.evaluate(() => {
      const w = window.__repforgeWeeklySnapshot();
      const groups = window.__repforgeAttention();
      const stableDom = document.querySelector('#thisWeek [data-week-metric="stable"] .statrow__val')?.textContent?.trim();
      const dest = {
        details: window.RepForgeI18n.t("stats.dest.details"),
        log: window.RepForgeI18n.t("stats.dest.log"),
        trend: window.RepForgeI18n.t("stats.dest.trend"),
      };
      const ready = [...document.querySelectorAll("#readyList [data-ready]")].map((el) => ({
        id: el.getAttribute("data-ready"),
        dest: el.getAttribute("data-dest"),
        text: el.textContent,
        name: el.getAttribute("aria-label") || el.textContent,
      }));
      const chips = [...document.querySelectorAll("#attention [data-attn]")].map((el) => ({
        id: el.getAttribute("data-attn"),
        group: el.getAttribute("data-attngo"),
        dest: el.getAttribute("data-dest"),
        text: el.textContent,
      }));
      return { w, groups: groups.map((g) => ({ key: g.key, ids: g.items.map((i) => i.ex.id) })), stableDom, dest, ready, chips };
    });
    assert(
      snap.w.flatLifts === 1 && snap.stableDom === "1",
      "Stable count equals exact flat comparisons from this week",
      JSON.stringify({ flatLifts: snap.w.flatLifts, stableDom: snap.stableDom, improved: snap.w.improvedLifts })
    );
    assert(
      snap.w.improvedLifts >= 1 && snap.w.regressedLifts >= 1,
      "Fixture includes improved and regressed comparisons this week",
      JSON.stringify({ improved: snap.w.improvedLifts, regressed: snap.w.regressedLifts })
    );
    const readyRow = snap.ready.find((r) => r.id === "ex-ready");
    assert(
      readyRow && readyRow.dest === "details" && readyRow.text.includes(snap.dest.details),
      "Ready to progress shows the Details destination in the accessible name",
      JSON.stringify(readyRow)
    );
    const expectChip = (id, group, destKey) => {
      const chip = snap.chips.find((c) => c.id === id);
      const label = snap.dest[destKey];
      assert(
        chip && chip.group === group && chip.dest === destKey && chip.text.includes(label),
        `${id} is a ${group} row labeled ${label}`,
        JSON.stringify(chip)
      );
    };
    expectChip("ex-untrained", "new", "log");
    expectChip("ex-stale", "stale", "log");
    expectChip("ex-reduce", "reduce", "trend");
    expectChip("ex-vol", "vol", "trend");
    expectChip("ex-fatigue", "fatigue", "trend");
    expectChip("curl-a", "new", "log");
    expectChip("curl-b", "new", "log");
    assert(
      snap.chips.every((c) => c.id && !["Coach Curl", "Coach Untrained"].includes(c.id)),
      "Coaching rows store exercise IDs, not display names",
      snap.chips.map((c) => c.id).join(",")
    );

    await page.click('#readyList [data-ready="ex-ready"]');
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    const readyLanded = await page.evaluate(() => ({
      view: document.querySelector("#exercise")?.classList.contains("active"),
      title: document.querySelector("#exName, #exercise h2, #exDetail")?.textContent || "",
    }));
    assert(
      readyLanded.view && /Coach Ready/i.test(readyLanded.title),
      "Details destination opens Exercise detail for the ready lift",
      JSON.stringify(readyLanded)
    );
    await page.click("#exBack");
    await nav(page, "stats");

    const landLog = async (id, day) => {
      await page.click(`#attention [data-attn="${id}"]`);
      await page.waitForFunction(() => document.querySelector("#log")?.classList.contains("active"), null, { timeout: 5000 });
      return page.evaluate(
        ({ id, day }) => {
          const card = document.querySelector(`#workout [data-ex="${id}"]`);
          const tab = document.querySelector("#dayTabs button.active");
          return {
            log: document.querySelector("#log")?.classList.contains("active"),
            card: !!card,
            day: tab?.dataset.day || "",
            want: day,
          };
        },
        { id, day }
      );
    };
    const untrainedLand = await landLog("ex-untrained", "Day 1");
    assert(untrainedLand.log && untrainedLand.card, "New-lift Log destination opens the Log card for that ID", JSON.stringify(untrainedLand));
    await nav(page, "stats");
    const curlA = await landLog("curl-a", "Day 1");
    assert(curlA.card && curlA.day === "Day 1", "Duplicate name on Day 1 routes by exercise ID", JSON.stringify(curlA));
    await nav(page, "stats");
    const curlB = await landLog("curl-b", "Day 2");
    assert(curlB.card && curlB.day === "Day 2", "Duplicate name on Day 2 routes by exercise ID", JSON.stringify(curlB));
    await nav(page, "stats");

    await page.click('#attention [data-attn="ex-reduce"]');
    const trendLand = await page.evaluate(() => ({
      deep: !!document.querySelector("#statsDeep")?.open,
      sel: document.querySelector("#statExercise")?.value || "",
      stats: document.querySelector("#stats")?.classList.contains("active"),
    }));
    assert(
      trendLand.deep && trendLand.sel === "movement:slot:ex-reduce" && trendLand.stats,
      "View trend destination opens the stats chart for that movement identity",
      JSON.stringify(trendLand)
    );
  }

  beginPhase("Phase: PWA cache, offline shell, replica agreement");
  {
    const swMeta = readServiceWorkerMeta();
    const origin = pwaOriginFromBase();
    const pwaContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "allow",
    });
    const pwaPage = await pwaContext.newPage();
    await pwaPage.goto(origin, { waitUntil: "domcontentloaded" });
    await wipePwaOrigin(pwaPage, pwaContext);
    const seedState = await getState(page);
    if (!seedState) throw new Error("PWA phase needs canonical state from the main simulation page");
    await persistState(pwaPage, seedState);
    const draftRaw = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
    if (draftRaw) {
      await pwaPage.evaluate(({ d, raw }) => localStorage.setItem(d, raw), { d: DRAFT, raw: draftRaw });
    }
    await pwaPage.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(pwaPage);
    await pwaPage.waitForFunction(
      async ({ cacheName, shell }) => {
        if (!("serviceWorker" in navigator)) return false;
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) return false;
        const names = await caches.keys();
        if (!names.includes(cacheName)) return false;
        const cache = await caches.open(cacheName);
        const reqs = await cache.keys();
        if (!reqs.length) return false;
        const paths = new Set(reqs.map((r) => new URL(r.url).pathname));
        return shell.every((path) => {
          if (path === "/") return paths.has("/") || paths.has("/index.html");
          return paths.has(path);
        });
      },
      { cacheName: swMeta.cache, shell: swMeta.shell },
      { timeout: 20000 }
    );

    const beforeStores = await readReplicasAndDraft(pwaPage);
    assert(
      replicasAgree(beforeStores),
      "Before offline, both durable replicas agree on canonical domain state",
      `localRev=${canonicalDomain(beforeStores.local).revision} idbRev=${canonicalDomain(beforeStores.idb).revision}`,
      "PWA origin → seed both stores → boot → compare localStorage vs IndexedDB"
    );

    const shellChecks = await pwaPage.evaluate(
      async ({ origin, cacheName, shell, optionalDeploymentShellAsset }) => {
        const cache = await caches.open(cacheName);
        const reqs = await cache.keys();
        const cacheUrls = reqs.map((r) => r.url);
        const results = [];
        for (const path of shell) {
          const url = new URL(path, origin).href;
          const net = await fetch(url, { cache: "reload" });
          const netBuf = new Uint8Array(await net.arrayBuffer());
          let cached = await cache.match(url);
          if (!cached) {
            for (const req of reqs) {
              const u = new URL(req.url);
              const target = new URL(url);
              if (u.pathname === target.pathname || (path === "/" && /\/index\.html$/.test(u.pathname))) {
                cached = await cache.match(req);
                if (cached) break;
              }
            }
          }
          if (!cached) {
            results.push({
              path,
              ok: false,
              reason: "cache-miss",
              cacheUrls: cacheUrls.slice(0, 12),
            });
            continue;
          }
          const cachedBuf = new Uint8Array(await cached.arrayBuffer());
          const netType = net.headers.get("content-type") || "";
          const cachedType = cached.headers.get("content-type") || "";
          const bytesEqual = netBuf.length === cachedBuf.length && netBuf.every((b, i) => b === cachedBuf[i]);
          const optionalMissing = path === optionalDeploymentShellAsset && net.status === 404;
          results.push({
            path,
            ok: optionalMissing || (net.ok && bytesEqual && netType === cachedType),
            optionalMissing,
            netOk: net.ok,
            netStatus: net.status,
            bytesEqual,
            netType,
            cachedType,
            netBytes: netBuf.length,
            cachedBytes: cachedBuf.length,
          });
        }
        return { cacheNamePresent: (await caches.keys()).includes(cacheName), results };
      },
      {
        origin,
        cacheName: swMeta.cache,
        shell: swMeta.shell,
        optionalDeploymentShellAsset: OPTIONAL_DEPLOYMENT_SHELL_ASSET,
      }
    );
    assert(
      shellChecks.cacheNamePresent,
      `CacheStorage contains the live sw.js cache (${swMeta.cache})`,
      JSON.stringify({ cache: swMeta.cache, present: shellChecks.cacheNamePresent }),
      "Register service worker → caches.keys() includes CACHE from sw.js"
    );
    const shellFail = shellChecks.results.filter((r) => !r.ok);
    const optionalDeploymentAsset = shellChecks.results.find((r) => r.path === OPTIONAL_DEPLOYMENT_SHELL_ASSET);
    assert(
      optionalDeploymentAsset && (optionalDeploymentAsset.optionalMissing || optionalDeploymentAsset.netOk === true),
      "The PostHog config is either present or explicitly identified as an optional local absence",
      JSON.stringify(optionalDeploymentAsset),
      "Fetch /posthog-config.js without a deploy-generated local config"
    );
    const noConfigBoot = optionalDeploymentAsset?.optionalMissing
      ? await pwaPage.evaluate(() => ({
        appReady: typeof window.__repforgeStorage?.flush === "function" && window.__repforgeBooted === true,
        telemetryBoundaryReady: typeof window.RepForgeTelemetry?.boot === "function",
        configAbsent: typeof window.__POSTHOG_CONFIG__ === "undefined",
      }))
      : { appReady: true, telemetryBoundaryReady: true, configAbsent: true };
    assert(
      noConfigBoot.appReady && noConfigBoot.telemetryBoundaryReady && noConfigBoot.configAbsent,
      "The app boots and telemetry stays harmless without local PostHog config",
      JSON.stringify(noConfigBoot),
      "Boot the installed app with /posthog-config.js absent"
    );
    assert(
      shellFail.length === 0,
      "Each SHELL asset matches CacheStorage bytes and content-type after cache-bypass fetch",
      JSON.stringify(shellFail.slice(0, 3)),
      "Online fetch({cache:'reload'}) vs caches.open(CACHE).match"
    );

    const cdp = await pwaContext.newCDPSession(pwaPage);
    await cdp.send("Network.clearBrowserCache");
    await pwaContext.setOffline(true);

    const offlineNav = await pwaPage.goto(origin, { waitUntil: "domcontentloaded" });
    assert(
      !!offlineNav && offlineNav.fromServiceWorker(),
      "Offline navigation is served from the service worker",
      `fromSW=${offlineNav?.fromServiceWorker?.()} status=${offlineNav?.status()}`,
      "Clear HTTP cache, stay offline, reload /"
    );

    const offlineShell = [];
    for (const path of swMeta.shell.filter((p) => p !== "/")) {
      const url = new URL(path, origin).href;
      const [resp] = await Promise.all([
        pwaPage.waitForResponse((r) => r.url() === url, { timeout: 8000 }).catch(() => null),
        pwaPage.evaluate((u) => fetch(u), url),
      ]);
      offlineShell.push({ path, fromSW: resp?.fromServiceWorker?.() === true, status: resp?.status() });
    }
    const optionalOffline = offlineShell.find((r) => r.path === OPTIONAL_DEPLOYMENT_SHELL_ASSET);
    assert(
      optionalOffline?.fromSW === true,
      "Service worker safely serves the absent local PostHog config offline",
      JSON.stringify(optionalOffline),
      "Go offline → fetch /posthog-config.js"
    );
    assert(
      offlineShell.every((r) => r.fromSW),
      "Offline SHELL fetches report fromServiceWorker()",
      JSON.stringify(offlineShell),
      "While offline, fetch each SHELL path"
    );

    for (const view of ["log", "stats", "history", "program"]) {
      await nav(pwaPage, view);
      const active = await pwaPage.locator(`#${view}.view.active`).count();
      assert(active === 1, `Offline navigation opens the ${view} tab`, `active=${active}`, `Offline → nav ${view}`);
    }

    const offlineStores = await readReplicasAndDraft(pwaPage);
    assert(
      replicasAgree(offlineStores) &&
        canonicalDomain(offlineStores.local).domain === canonicalDomain(beforeStores.local).domain &&
        offlineStores.draft === beforeStores.draft,
      "While offline, both replicas and the draft stay byte-equivalent to the pre-offline snapshot",
      `draftEqual=${offlineStores.draft === beforeStores.draft}`,
      "Read localStorage + IndexedDB + draft while offline"
    );

    await pwaContext.setOffline(false);
    await pwaPage.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(pwaPage);
    const afterStores = await readReplicasAndDraft(pwaPage);
    assert(
      replicasAgree(afterStores) &&
        canonicalDomain(afterStores.local).domain === canonicalDomain(beforeStores.local).domain &&
        afterStores.draft === beforeStores.draft,
      "After reconnect, both replicas and the draft remain canonically identical",
      `rev local=${canonicalDomain(afterStores.local).revision} idb=${canonicalDomain(afterStores.idb).revision}`,
      "Go online → reload → compare both stores and draft"
    );

    await pwaContext.close();
  }


  beginPhase("Phase: F7 load validation");
  await resetWithSeedProgram(page);

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
      accentText: token("--accent-deep"),
      inkFaint: token("--ink-faint"),
      bg: token("--bg"),
      surface: token("--surface"),
      contrastFaintBg: contrastHex(token("--ink-faint"), token("--bg")),
      contrastFaintWhite: contrastHex(token("--ink-faint"), token("--surface")),
      contrastAccentTextBg: contrastHex(token("--accent-deep"), token("--bg")),
      contrastAccentTextWhite: contrastHex(token("--accent-deep"), token("--surface")),
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
      accentTextSels: rules.filter((r) => r.color.includes("--accent-deep")).map((r) => r.sel),
    };
  });
  assert(
    contrastAudit.accent === "#E04E14" && contrastAudit.accentText === "#B8410E" && contrastAudit.inkFaint === "#716D66",
    "C1: contrast tokens keep brand orange and use compliant accent-deep / ink-faint",
    JSON.stringify({
      accent: contrastAudit.accent,
      accentText: contrastAudit.accentText,
      inkFaint: contrastAudit.inkFaint,
    }),
    "Inspect :root --accent, --accent-deep, --ink-faint"
  );
  assert(
    contrastAudit.contrastFaintBg >= 4.5 &&
      contrastAudit.contrastFaintWhite >= 4.5 &&
      contrastAudit.contrastAccentTextBg >= 4.5 &&
      contrastAudit.contrastAccentTextWhite >= 4.5,
    "C1: ink-faint and accent-deep meet 4.5:1 on cream and white",
    JSON.stringify({
      faintBg: contrastAudit.contrastFaintBg,
      faintWhite: contrastAudit.contrastFaintWhite,
      accentBg: contrastAudit.contrastAccentTextBg,
      accentWhite: contrastAudit.contrastAccentTextWhite,
    }),
    "Compute WCAG contrast for --ink-faint and --accent-deep against --bg and --surface"
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
    contrastAudit.backLink.filter(Boolean).every((c) => c.includes("var(--accent-deep)")) &&
      contrastAudit.backLink.some((c) => c.includes("var(--accent-deep)")) &&
      contrastAudit.linkAccent.every((c) => c.includes("var(--accent-deep)")) &&
      contrastAudit.textBtnAccent.every((c) => c.includes("var(--accent-deep)")) &&
      contrastAudit.vrowStatus.every((c) => c.includes("var(--accent-deep)")) &&
      contrastAudit.accentTextSels.length >= 8,
    "C1: accent foreground text on light surfaces uses --accent-deep",
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

  await page.evaluate(() => window.startOnboarding("settings", { userInitiated: true, forceFresh: true }));
  await page.waitForSelector("#onboarding.active", { timeout: 5000 });
  await page.click('[data-entry-route="recommend"]');
  await page.evaluate(() => {
    const draft = window.__repforgeOnboarding.entry();
    delete draft.answers.desiredResult;
    window.__repforgeOnboarding.render();
  });
  await page.waitForSelector("#onbNext:not(.hidden)", { timeout: 5000 });
  const onbBeforeValidation = await page.evaluate(() => {
    const b = document.querySelector("#onbNext");
    return {
      disabled: b.disabled,
      step: window.__repforgeOnboarding.entry().step,
    };
  });
  assert(
    onbBeforeValidation.disabled === true,
    "F6: incomplete onboarding disables Continue",
    JSON.stringify(onbBeforeValidation),
    "Recommend desired-result with no choice selected"
  );
  await page.locator("#onbNext").evaluate((button) => button.click());
  const onbValidation = await page.evaluate(() => {
    const alert = document.querySelector("#entryValidation");
    const button = document.querySelector("#onbNext");
    return {
      stepBefore: window.__repforgeOnboarding.entry().step,
      stepClass: document.querySelector("#onbBody")?.className || "",
      alertVisible: !!alert && getComputedStyle(alert).display !== "none",
      alertRole: alert?.getAttribute("role"),
      alertLive: alert?.getAttribute("aria-live"),
      alertFocused: document.activeElement === alert,
      continueDisabled: button?.disabled,
    };
  });
  assert(
    onbValidation.stepBefore === onbBeforeValidation.step &&
      onbValidation.stepClass.includes("entry-body--desired_result") &&
      !onbValidation.alertVisible &&
      onbValidation.continueDisabled === true,
    "F6: disabled Continue cannot advance or surface a stale validation state",
    JSON.stringify(onbValidation),
    "Recommend desired-result with no choice selected"
  );
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  const onbEnabled = await page.evaluate(() => {
    const b = document.querySelector("#onbNext");
    const cs = getComputedStyle(b);
    return {
      disabled: b.disabled,
      opacity: cs.opacity,
      cursor: cs.cursor,
      bg: cs.backgroundColor,
      validationVisible: !!document.querySelector("#entryValidation"),
    };
  });
  assert(
    onbEnabled.disabled === false &&
      onbEnabled.opacity === "1" &&
      onbEnabled.cursor === "pointer" &&
      onbEnabled.validationVisible === false,
    "F6: choosing a result enables Continue",
    JSON.stringify(onbEnabled),
    "Recommend desired-result → pick a result → Continue"
  );
  await page.click("#onbNext");
  await page.waitForFunction(
    () => window.__repforgeOnboarding.entry().step === "background",
    undefined,
    { timeout: 5000 },
  );
  pass("F6: valid desired-result selection advances");
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
  const highStatusState = (base, lang) => {
    const date = isoToday();
    const created = `${date}T12:00:00.000Z`;
    const mkEx = (id, muscle, name, sets, order) => ({
      id,
      day: "Day 1",
      order,
      name,
      sets,
      min: 6,
      max: 10,
      primary: muscle,
      secondary: "",
      notes: "",
      alternates: [],
    });
    const mkSets = (id, name, muscle, n) =>
      Array.from({ length: n }, (_, i) => ({
        session: `${date}_Day 1_hs`,
        date,
        day: "Day 1",
        name,
        exerciseId: id,
        set: i + 1,
        load: 40,
        reps: 8,
        rir: 1,
        notes: "",
        created,
        primary: muscle,
        secondary: "",
      }));
    return {
      ...base,
      program: [
        mkEx("hs-quads", "Quads", "Squat", 4, 1),
        mkEx("hs-chest", "Chest", "Bench", 4, 2),
        mkEx("hs-calves", "Calves", "Calf raise", 4, 3),
      ],
      log: [...mkSets("hs-chest", "Bench", "Chest", 4), ...mkSets("hs-calves", "Calf raise", "Calves", 12)],
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
          high: fill?.classList.contains("is-high") || false,
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
              status: r.status,
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
    calves?.pct === 100 && calves.completed7 > calves.planned && calves.status === "High",
    "F9: over-target width is capped at 100% and status is High",
    JSON.stringify(calves),
    "__repforgeOverviewVolume.pct for Calves 12/4"
  );
  assert(
    biceps?.planned === 0 && biceps.pct === 0 && biceps.completed7 > 0,
    "F9: unplanned rows use 0% width",
    JSON.stringify(biceps),
    "__repforgeOverviewVolume.pct for Biceps with no plan"
  );

  await page.waitForFunction(() => {
    const p = document.querySelector("#chart")?.__rfPaint;
    return Array.isArray(p?.fillText) && p.fillText.length > 0;
  }, { timeout: 5000 });
  const chartPaint = await page.evaluate(() => {
    const norm = (c) => {
      const raw = String(c).trim().toLowerCase().replace(/\s+/g, "");
      if (raw.startsWith("#") && raw.length === 7) return raw;
      const m = raw.match(/^rgba?\((\d+),(\d+),(\d+)/);
      if (!m) return raw;
      return "#" + [+m[1], +m[2], +m[3]].map((n) => n.toString(16).padStart(2, "0")).join("");
    };
    const paint = document.querySelector("#chart")?.__rfPaint || { fillText: [], stroke: [], fill: [] };
    return {
      exposed: "__repforgeChartPaint" in window,
      fillText: paint.fillText.map((x) => ({
        text: x.text,
        fillStyle: norm(x.fillStyle),
        font: String(x.font || ""),
      })),
      stroke: paint.stroke.map((x) => ({ strokeStyle: norm(x.strokeStyle) })),
      fill: paint.fill.map((x) => ({ fillStyle: norm(x.fillStyle) })),
    };
  });
  assert(
    chartPaint.exposed !== true,
    "C1: app.js does not ship chart paint instrumentation",
    `window.__repforgeChartPaint in page: ${chartPaint.exposed}`,
    "Inspect window after Stats → Overview chart draw"
  );
  const latestValueText = chartPaint.fillText.find(
    (x) => /\b(kg|lb)\b/i.test(x.text) && /600/.test(x.font)
  );
  const unitTexts = chartPaint.fillText.filter((x) => /\b(kg|lb)\b/i.test(x.text));
  assert(
    latestValueText && latestValueText.fillStyle === "#b8410e",
    "C1: latest-value canvas text uses accent-deep, not brand orange",
    JSON.stringify(latestValueText || { fillText: chartPaint.fillText }),
    "Stats → Overview chart → latest-value fillText"
  );
  assert(
    unitTexts.length > 0 && unitTexts.every((x) => x.fillStyle !== "#e04e14") &&
      chartPaint.fillText.every((x) => x.fillStyle !== "#e04e14"),
    "C1: no canvas fillText uses brand orange",
    JSON.stringify(chartPaint.fillText.map((x) => ({ text: x.text, fillStyle: x.fillStyle }))),
    "Inspect #chart.__rfPaint.fillText colors"
  );
  assert(
    chartPaint.stroke.some((x) => x.strokeStyle === "#e04e14") &&
      chartPaint.stroke.some((x) => x.strokeStyle === "#e4e1da"),
    "C1: chart data stroke stays brand orange; grid stays rule",
    JSON.stringify(chartPaint.stroke),
    "Inspect #chart.__rfPaint.stroke colors"
  );
  assert(
    chartPaint.fill.some((x) => x.fillStyle === "#e04e14") &&
      chartPaint.fill.every((x) => x.fillStyle === "#e04e14"),
    "C1: chart points stay brand orange",
    JSON.stringify(chartPaint.fill),
    "Inspect #chart.__rfPaint.fill colors"
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
  const ptCalves = ptVol.hook.find((r) => r.muscle === "Calves");
  assert(
    ptCalves?.status === "Alto" && ptCalves.completed7 > ptCalves.planned,
    "F9: Portuguese volumeDashboard labels over-target High as Alto",
    JSON.stringify(ptCalves),
    "PT Stats → Overview hook status for Calves 12/4"
  );

  await persistState(page, highStatusState(await getState(page), "en"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#overviewVolume .vrow", { timeout: 5000 });
  const enHigh = await readOverview();
  const hsQuads = enHigh.rows.find((r) => r.muscle === "Quads");
  const hsChest = enHigh.rows.find((r) => r.muscle === "Chest");
  const hsCalves = enHigh.rows.find((r) => r.muscle === "Calves");
  assert(
    hsQuads?.status === "Below" && !hsQuads.on && !hsQuads.high && hsQuads.width === "0%",
    "F9: Below overview copy is unchanged",
    JSON.stringify(hsQuads),
    "Overview → Quads 0/4"
  );
  assert(
    hsChest?.status === "On target" && hsChest.on && !hsChest.high && hsChest.width === "100%",
    "F9: On target overview copy is unchanged",
    JSON.stringify(hsChest),
    "Overview → Chest 4/4"
  );
  assert(
    hsCalves?.status === "High" && hsCalves.high && !hsCalves.on && hsCalves.width === "100%",
    "F9: over-target overview row renders High, not On target",
    JSON.stringify(hsCalves),
    "Overview → Calves 12/4"
  );

  await persistState(page, highStatusState(await getState(page), "pt"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#overviewVolume .vrow", { timeout: 5000 });
  const ptHigh = await readOverview();
  assert(
    ptHigh.rows.find((r) => r.muscle === "Quads")?.status === "Abaixo" &&
      ptHigh.rows.find((r) => r.muscle === "Chest")?.status === "No alvo" &&
      ptHigh.rows.find((r) => r.muscle === "Calves")?.status === "Alto" &&
      ptHigh.rows.find((r) => r.muscle === "Calves")?.high &&
      !ptHigh.rows.find((r) => r.muscle === "Calves")?.on,
    "F9: Portuguese overview uses Alto for over-target, keeping Abaixo/No alvo",
    ptHigh.rows.map((r) => `${r.muscle}:${r.status}`).join("|"),
    "PT Overview → Quads/Chest/Calves status labels"
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
  beginPhase("Phase: exercise detail illustration");
  const ART_ID = "sqk_mc";
  const ART_SRC = `assets/exercises/${ART_ID}.webp`;
  const CUSTOM_ID = "custom:artless";
  /* Three slots that span the only distinction the artwork cares about: a
     library movement that has a licensed drawing, a built-in slot that never
     linked to one, and a movement the lifter invented. */
  const artProgramState = (base) => ({
    ...base,
    settings: { ...base.settings, lang: "en" },
    log: [],
    programHistory: [],
    customExercises: [
      { id: CUSTOM_ID, name: "Bench dips at home", primary: "Triceps", secondary: "", equipment: [], patterns: [] },
    ],
    program: [
      { id: "artmapped", day: "Day 1", order: 1, name: "Hack squat machine", sets: 3, min: 4, max: 8,
        primary: "Quads", secondary: "Glutes", notes: "", alternates: [], libraryId: ART_ID },
      { id: "artplain", day: "Day 1", order: 2, name: "Calf raise off a step", sets: 3, min: 8, max: 12,
        primary: "Calves", secondary: "", notes: "", alternates: [] },
      { id: "artcustom", day: "Day 1", order: 3, name: "Bench dips at home", sets: 3, min: 8, max: 12,
        primary: "Triceps", secondary: "", notes: "", alternates: [], libraryId: CUSTOM_ID },
    ],
  });
  const artHistoryRows = (iso, session) =>
    [1, 2, 3].map((s) => ({
      date: iso, session, day: "Day 1", exerciseId: "artmapped", name: "Hack squat machine",
      performedLibraryId: ART_ID, performedName: "Hack squat machine",
      performedPrimary: "Quads", performedSecondary: "Glutes",
      set: s, load: 80 + s * 2.5, reps: 8, rir: 2, created: `${iso}T10:0${s}:00Z`,
    }));
  /** Everything the detail view says about its illustration, in one read. */
  const readDetailArt = (page) =>
    page.evaluate(() => {
      const detail = document.querySelector("#exDetail");
      const imgs = [...detail.querySelectorAll(".exdet-art__img")];
      const img = imgs[0] || null;
      const kids = [...detail.children];
      const idx = (sel) => kids.findIndex((el) => el.matches(sel) || el.querySelector(sel));
      return {
        wrappers: detail.querySelectorAll(".exdet-art").length,
        imgs: imgs.length,
        // A placeholder would be an <img> with nothing behind it, or a stray
        // empty-tile element borrowed from the picker rows.
        emptyTiles: detail.querySelectorAll(".exthumb--empty, .exdet-art__img:not([src])").length,
        srcAttr: img?.getAttribute("src") || null,
        alt: img?.getAttribute("alt") || null,
        width: img?.getAttribute("width") || null,
        height: img?.getAttribute("height") || null,
        decoding: img?.getAttribute("decoding") || null,
        loading: img?.getAttribute("loading") || null,
        complete: img ? img.complete && img.naturalWidth > 0 : null,
        afterMeta: idx(".exdet-art") > idx(".exdet__meta"),
        beforeRec: idx(".recblock") === -1 || idx(".exdet-art") < idx(".recblock"),
        hasRec: !!detail.querySelector(".recblock"),
        hasStats: detail.querySelectorAll(".exdet__stats .statrow__cell").length,
        hasChart: !!detail.querySelector("#exChart"),
      };
    });
  const openArtDetail = async (page, id) => {
    await page.evaluate((exId) => window.openExerciseView(exId, "log"), id);
    await page.waitForSelector("#exercise.view.active", { timeout: 5000 });
    await page.waitForTimeout(150);
  };

  await persistState(page, artProgramState(await getState(page)));
  await reloadApp(page);
  await openArtDetail(page, "artmapped");
  const artEmpty = await readDetailArt(page);
  assert(
    artEmpty.imgs === 1 && artEmpty.wrappers === 1 && artEmpty.srcAttr === ART_SRC && artEmpty.complete === true,
    "Mapped exercise renders exactly one detail illustration from its library asset",
    JSON.stringify(artEmpty),
    "Seed a program slot linked to sqk_mc → open its exercise page"
  );
  assert(
    artEmpty.width === "768" &&
      artEmpty.height === "768" &&
      artEmpty.decoding === "async" &&
      artEmpty.loading === null,
    "Detail illustration reserves 768×768 before decode and is not lazy",
    JSON.stringify(artEmpty),
    "Exercise page → .exdet-art__img attributes"
  );
  assert(
    !!artEmpty.alt && artEmpty.alt.trim().length > 0 && artEmpty.alt !== "Hack squat machine",
    "Detail illustration carries a localized descriptive alt, not the bare name",
    JSON.stringify({ alt: artEmpty.alt }),
    "Exercise page → .exdet-art__img alt"
  );
  assert(
    artEmpty.afterMeta && artEmpty.beforeRec,
    "Detail illustration sits between the prescription and the recommendation",
    JSON.stringify(artEmpty),
    "Exercise page → DOM order of .exdet__meta, .exdet-art, .recblock"
  );
  assert(
    artEmpty.hasRec && artEmpty.hasStats === 4 && artEmpty.hasChart,
    "No-history exercise page keeps its recommendation, four metrics, and chart",
    JSON.stringify(artEmpty),
    "Exercise page with no logged sets"
  );

  const artIso = isoDateFromWeeksAgo(1);
  await persistState(page, {
    ...(await getState(page)),
    log: [...artHistoryRows(artIso, "artsess1"), ...artHistoryRows(isoDateFromWeeksAgo(0), "artsess2")],
  });
  await reloadApp(page);
  await openArtDetail(page, "artmapped");
  const artFull = await readDetailArt(page);
  assert(
    artFull.imgs === 1 &&
      artFull.srcAttr === ART_SRC &&
      artFull.afterMeta &&
      artFull.beforeRec &&
      artFull.hasRec &&
      artFull.hasStats === 4 &&
      artFull.hasChart,
    "Populated-history exercise page keeps the illustration and every existing block",
    JSON.stringify(artFull),
    "Seed sessions for the mapped lift → open its exercise page"
  );

  const artFailures = [];
  const onArtFailed = (req) => artFailures.push(req.url());
  page.on("requestfailed", onArtFailed);
  await openArtDetail(page, "artplain");
  const artPlain = await readDetailArt(page);
  await openArtDetail(page, "artcustom");
  const artCustom = await readDetailArt(page);
  await page.waitForTimeout(200);
  page.off("requestfailed", onArtFailed);
  assert(
    artPlain.wrappers === 0 && artPlain.imgs === 0 && artPlain.emptyTiles === 0,
    "Built-in exercise without licensed art renders no media block and no placeholder",
    JSON.stringify(artPlain),
    "Open the exercise page for a slot with no libraryId"
  );
  assert(
    artCustom.wrappers === 0 && artCustom.imgs === 0 && artCustom.emptyTiles === 0,
    "Custom exercise renders no media block and no placeholder",
    JSON.stringify(artCustom),
    "Open the exercise page for a custom movement"
  );
  assert(
    artFailures.filter((u) => u.includes("assets/exercises/")).length === 0,
    "Exercises without art request no media file",
    JSON.stringify(artFailures.slice(0, 5)),
    "Open art-less exercise pages → watch network failures"
  );

  /* The point of the whole treatment: the field has to be the paper the drawing
     is already on. Sampled here straight from the decoded pixels, with a wider
     ring and a coarser step than tools/sample-media-bg.mjs uses, so this checks
     the recorded colour against the artwork rather than re-running the
     generator's arithmetic. */
  const artPaper = await page.evaluate(async () => {
    const read = (src) =>
      new Promise((res) => {
        const img = new Image();
        img.onerror = () => res(null);
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const w = img.naturalWidth, h = img.naturalHeight, px = [[], [], []];
          const take = (x, y) => {
            const d = ctx.getImageData(x, y, 1, 1).data;
            px[0].push(d[0]); px[1].push(d[1]); px[2].push(d[2]);
          };
          for (let x = 0; x < w; x += 5) { take(x, 0); take(x, 2); take(x, h - 1); take(x, h - 3); }
          for (let y = 0; y < h; y += 5) { take(0, y); take(2, y); take(w - 1, y); take(w - 3, y); }
          res(px.map((a) => a.sort((m, n) => m - n)[Math.floor(a.length / 2)]));
        };
        img.src = src;
      });
    const worst = [];
    let checked = 0;
    for (const e of window.__repforgeExerciseLibrary.filter((x) => x.media)) {
      const paper = await read(e.media);
      if (!paper) { worst.push({ id: e.id, error: "decode failed" }); continue; }
      const declared = [1, 3, 5].map((i) => parseInt(e.mediaBg.slice(i, i + 2), 16));
      const delta = Math.max(...paper.map((v, i) => Math.abs(v - declared[i])));
      checked++;
      worst.push({ id: e.id, delta, mediaBg: e.mediaBg });
    }
    worst.sort((a, b) => (b.delta ?? 99) - (a.delta ?? 99));
    return { checked, worst: worst.slice(0, 5) };
  });
  assert(
    artPaper.checked === 96 && artPaper.worst.every((w) => w.delta <= 6),
    "every illustration's field colour matches the paper it is drawn on",
    JSON.stringify(artPaper),
    "Decode each assets/exercises/*.webp → compare its border ring to mediaBg"
  );

  await openArtDetail(page, "artmapped");
  const artFieldColor = await page.evaluate(() => {
    const field = document.querySelector(".exdet-art");
    const entry = window.__repforgeExerciseLibrary.find((e) => e.id === "sqk_mc");
    return {
      declared: entry.mediaBg,
      applied: getComputedStyle(field).getPropertyValue("--exercise-art-bg").trim(),
      inline: field.getAttribute("style"),
      painted: getComputedStyle(field).backgroundImage,
    };
  });
  assert(
    artFieldColor.applied.toLowerCase() === artFieldColor.declared.toLowerCase() &&
      /gradient/.test(artFieldColor.painted),
    "The rendered field takes its colour from the movement's own artwork",
    JSON.stringify(artFieldColor),
    "Open a mapped exercise page → computed --exercise-art-bg"
  );

  await page.click("#exBack");
  await nav(page, "program");
  const sharedRules = await page.evaluate(() => {
    const row = document.querySelector("#programOverview .statrow, #metrics.metrics");
    if (!row) return null;
    const cs = getComputedStyle(row);
    const cell = row.querySelector(".statrow__cell, .metric");
    return {
      top: cs.borderTopWidth,
      bottom: cs.borderBottomWidth,
      sep: cell ? getComputedStyle(cell, "::after").content : null,
    };
  });
  assert(
    sharedRules &&
      sharedRules.top !== "0px" &&
      sharedRules.bottom !== "0px" &&
      sharedRules.sep !== "none",
    "Shared stat rows outside the exercise page keep their rules and cell separators",
    JSON.stringify(sharedRules),
    "Program tab → .statrow computed borders"
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
