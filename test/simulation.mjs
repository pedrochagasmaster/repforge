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
import { runInNewContext } from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const OPTIONAL_DEPLOYMENT_SHELL_ASSET = "/posthog-config.js";
const SIM_WEEKS = process.argv.includes("--smoke") ? 12 : Math.max(1, +(process.env.REPFORGE_SIM_WEEKS || 52));
const SMOKE = process.argv.includes("--smoke");
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

/** Drive Generate from the entry hub through activation (Plan 067: goal,
 *  experience, days and session ceiling, environment, priorities, result). */
async function driveRecommendOnboarding(page, {
  desiredResult = "muscle_growth",
  experience = "6_to_24m",
  days = 3,
  minutes = 60,
  environment = "commercial_gym",
  activate = true,
} = {}) {
  const step = () => page.evaluate(() => window.__repforgeEntryState?.()?.step);
  const pick = (key, value) => page.locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
  await page.click(`[data-entry-route="recommend"][data-entry-goal="${desiredResult}"]`);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "background");
  await pick("structuredExperience", experience);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "schedule");
  await pick("daysPerWeek", days);
  await pick("sessionMinutes", minutes);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  await pick("environment", environment);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  await page.click("#onbNext");
  await page.waitForFunction(() => ["priorities", "result"].includes(window.__repforgeEntryState?.()?.step));
  if (await step() === "priorities") await page.click("#onbNext");
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
  // This helper is used only to establish a clean Today fixture. Remove the
  // active draft and all V2 sidecars before rewriting durable history, so a
  // reload cannot reopen a stale workout shell over the Today dashboard.
  await clearDraftFixture(page);
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
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
  const assetsRaw = src.match(/const ASSETS\s*=\s*(\[[\s\S]*?\n\])/)?.[1];
  if (!assetsRaw) throw new Error("sw.js ASSETS release inventory not found");
  const assets = runInNewContext(assetsRaw);
  const normalized = assets.map((entry) => {
    const asset = typeof entry === "string" ? { url: entry, required: true } : entry;
    const path = new URL(asset.url, "http://localhost/").pathname;
    return { path, required: asset.required !== false };
  }).filter(({ path }) => path === "/" || /\.(?:html?|css|m?js|webmanifest)$/i.test(path));
  const requiredByPath = new Map();
  for (const { path, required } of normalized) requiredByPath.set(path, requiredByPath.get(path) === true || required);
  const shell = [...requiredByPath.keys()];
  if (!shell.length) throw new Error("sw.js ASSETS contains no document/code shell resources");
  const optionalShell = shell.filter((path) => requiredByPath.get(path) === false);
  return { cache, shell, optionalShell };
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
  // `clearState` leaves device-only UI prefs alone. Give the long-running walk
  // a device that has already handled Plan 054's wired contextual guides so a
  // later Settings visit cannot change the scenario's intended surface.
  await page.evaluate(() => {
    const k = "repforge_ui_v1";
    const prefs = JSON.parse(localStorage.getItem(k) || "{}");
    prefs.guideState = Object.fromEntries(["entry", "install", "privacy"].map((id) => [id, {
      version: 1,
      status: "completed",
      lastTransitionAt: Date.now(),
    }]));
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
  return page.evaluate((d) => {
    const p = window.__repforgeFocus ? window.__repforgeFocus.list() : [];
    if (p.length) return p.map(ex => ({ id: ex.id, sets: ex.sets || 2 }));
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const prog = (raw.program || []).filter(ex => ex.day === d);
    if (prog.length) return prog.map(ex => ({ id: ex.id, sets: ex.sets || 2 }));
    const map = new Map();
    document.querySelectorAll("#workout input[data-k]").forEach((inp) => {
      const m = inp.dataset.k.match(/^(.+)_(\d+)_(load|reps|rir)$/);
      if (!m) return;
      const [, id, setNum] = m;
      if (!map.has(id)) map.set(id, { id, sets: 0 });
      map.get(id).sets = Math.max(map.get(id).sets, +setNum);
    });
    return [...map.values()];
  }, day);
}

async function clearState(page) {
  await page.evaluate(async ({ k, d, setup, ui }) => {
    localStorage.removeItem(k);
    // Clean-fixture reset: a canonical remove alone leaves the V2 checkpoint,
    // recovery copy, tombstone and transaction sidecars behind. Those belong
    // to the same draft namespace and must not leak into the next program.
    for (const key of Object.keys(localStorage)) {
      if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
    }
    localStorage.removeItem(setup);
    localStorage.removeItem(ui);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT, setup: SETUP_DRAFT, ui: "repforge_ui_v1" });
}

async function clearDraftFixture(page) {
  await page.evaluate((d) => {
    // Clean scenario boundary. Fault, race and legacy scenarios seed their
    // own raw/sidecar state explicitly and do not call this helper.
    for (const key of Object.keys(localStorage)) {
      if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
    }
  }, DRAFT);
}

async function flushDraftWork(page) {
  await page.evaluate(async () => {
    if (typeof window.__repforgeWorkoutDraft?.flush !== "function") {
      throw new Error("DraftV2 flush hook is unavailable");
    }
    await window.__repforgeWorkoutDraft.flush();
  });
}

async function waitForSetDone(page, exerciseId, ordinal = 1) {
  await flushDraftWork(page);
  await page.waitForFunction(({ exerciseId: id, ordinal: setOrdinal }) => {
    const draft = window.__repforgeWorkoutDraft?.current?.();
    const exercise = draft?.exercises?.[id];
    const set = exercise && Object.values(exercise.sets || {}).find((candidate) => candidate.ordinal === setOrdinal);
    return !!set && set.completion !== "pending" &&
      !!document.querySelector(`#workout .exercise.is-current [data-editex="${id}"][data-editn="${setOrdinal}"]`);
  }, { exerciseId, ordinal }, { timeout: 5000 });
}

async function readDraftRaw(page) {
  await flushDraftWork(page);
  return page.evaluate(() => window.__repforgeWorkoutDraft?.read?.().raw ?? null);
}

async function readDraft(page) {
  await flushDraftWork(page);
  return page.evaluate(() => window.__repforgeWorkoutDraft?.current?.() ?? null);
}

async function nav(page, view) {
  if (await page.locator("#sessionSummary:not(.hidden)").isVisible()) {
    await page.locator("#sumDone").click();
    await page.locator("#sessionSummary").waitFor({state:"hidden"});
  }
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
    // Enter the sole workout route for the simulation.
    const shell = page.locator("#workoutShell:not(.hidden)");
    if (!(await shell.count())) {
      const entered = await page.evaluate(async () => window.__repforgeEnterWorkout?.({}));
      if (entered === false) {
        console.log("    Log navigation diagnostic", await page.evaluate(() => ({
          draft: window.__repforgeWorkoutDraft?.read?.(),
          checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.(),
          recovery: window.__repforgeWorkoutDraft?.recovery?.(),
          day: document.querySelector("#dayTabs button.active")?.dataset.day,
        })));
      }
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

async function selectDay(page,dayName){
  await page.evaluate(day=>window.__repforgeEnterWorkout({day}),dayName);
  await page.waitForFunction(day=>window.__repforgeWorkoutDraft.current()?.program.dayLabel===day,dayName,{timeout:5000});
}

/** The day-change question is a sheet (OG-6 `today/draft-resume`): "keep" is Cancel, "discard" is Discard unfinished session.
 *  A step that wants to see the question marks the page manual first; this answers it and hands the page back. */
async function answerDiscardQuestion(page,answer){
  try{
    await page.waitForSelector("#draftDiscardSheet.is-open",{timeout:5000});
    await page.locator(answer==="keep"?"#draftDiscardKeep":"#draftDiscardDrop").click();
    if(answer==="keep")await page.waitForTimeout(350);
  }finally{page.__manualDiscard=false}
}

async function requestVisibleDay(page,day){
  page.__manualDiscard=true;
  if(await page.locator("#workoutShell").isVisible())await page.locator("#leaveWorkout").click();
  if(!await page.locator("#dayPickSheet").isVisible())await page.locator("#chooseAnotherDay").click();
  await page.locator(`[data-daypick="${day}"]`).click();
  await page.locator("#dayPickConfirm").click();
}

/** Bulk session-date setup uses the production Session field handler. */
async function setLogDate(page, value) {
  await page.evaluate((v) => {
    const el = document.querySelector("#sessionDate");
    if (!el) throw new Error("#date missing");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}


async function completeDraftSets(page) {
  await page.evaluate(async () => {
    const draft = window.__repforgeWorkoutDraft?.current?.();
    if (!draft) return;
    for (const exId of draft.exerciseOrder || []) {
      const ex = draft.exercises?.[exId];
      if (!ex) continue;
      for (const setId of ex.setOrder || []) {
        const s = ex.sets?.[setId];
        if (s && (s.completion === 'pending' || typeof s.completion === 'string')) {
          await window.__repforgeWorkoutDraft.dispatch('completeSet', {
            exerciseInstanceId: exId,
            setId,
            completedAt: new Date().toISOString()
          });
        }
      }
    }
  });
}

async function firstDayName(page) {
  return page.locator("#dayTabs button").first().getAttribute("data-day");
}

/* DraftV2 sets are metric-backed: weight and reps are catalog metrics, keyed
   `<exId>_<n>_metric_<metricId>`; RIR stays a set field. */
const WEIGHT_METRIC = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS_METRIC = "2555c6f170d88072bbf6d9ad3f16ea86";
const SIM_FIELD_METRIC = { load: WEIGHT_METRIC, reps: REPS_METRIC };
/** `<exId>_<n>_load|reps` → the metric field key the workout renders. */
function simFieldKey(key) {
  const match = String(key).match(/^(.+_\d+)_(load|reps)$/);
  return match ? `${match[1]}_metric_${SIM_FIELD_METRIC[match[2]]}` : key;
}

async function fillExerciseSets(page, exId, sets, load, reps, rir) {
  await page.evaluate(
    async ({ exId, sets, load, reps, rir, weight, repsMetric }) => {
      const W = window.__repforgeWorkoutDraft;
      const ex = W?.current?.()?.exercises?.[exId];
      for (let n = 1; n <= sets; n++) {
        const setId = ex?.setOrder?.find((id) => ex.sets[id].ordinal === n);
        if (!setId) continue;
        for (const [metricId, val] of [[weight, load], [repsMetric, reps]]) {
          const result = await W.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId, value: String(val) });
          if (result.status !== "applied") throw new Error(`metric edit ${exId}/${setId}: ${result.status}`);
        }
        const effort = await W.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "rir", value: String(rir) });
        if (effort.status !== "applied") throw new Error(`rir edit ${exId}/${setId}: ${effort.status}`);
      }
      await W.flush?.();
      if (typeof renderWorkout === "function") renderWorkout();
    },
    { exId, sets, load, reps, rir, weight: WEIGHT_METRIC, repsMetric: REPS_METRIC }
  );
  await page.waitForFunction(
    ({ d, id, n, expected, weight, repsMetric }) => {
      try {
        const draft = JSON.parse(localStorage.getItem(d) || "null");
        const exercise = draft?.schemaVersion === 2 ? draft.exercises?.[id] : null;
        const setId = exercise?.setOrder?.find((sid) => exercise.sets[sid].ordinal === n);
        const edited = exercise?.sets?.[setId]?.edited;
        return edited?.metrics?.[weight] === expected.load && edited?.metrics?.[repsMetric] === expected.reps &&
          (edited?.rir != null || edited?.effort != null);
      } catch {
        return false;
      }
    },
    {
      d: DRAFT,
      id: exId,
      n: sets,
      expected: { load: String(load), reps: String(reps), rir: String(rir) },
      weight: WEIGHT_METRIC,
      repsMetric: REPS_METRIC,
    },
    { timeout: 5000 }
  );
}

async function waitForDraftSetCompletion(page, exId, ordinal = 1) {
  await page.waitForFunction(
    ({ d, id, n }) => {
      try {
        const draft = JSON.parse(localStorage.getItem(d) || "null");
        const exercise = draft?.schemaVersion === 2 ? draft.exercises?.[id] : null;
        const setId = exercise?.setOrder?.[n - 1];
        return exercise?.sets?.[setId]?.completion !== "pending";
      } catch {
        return false;
      }
    },
    { d: DRAFT, id: exId, n: ordinal },
    { timeout: 5000 }
  );
}

async function toggleWarmup(page, exId, setNum = 1) {
  await selectFocusExercise(page, exId);
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionsWarmupList [data-warm-toggle-set]").nth(setNum-1).click();
  await flushDraftWork(page);
  await page.locator("#exActionsClose").click();
}

async function clickSaveSet(page, key) {
  const [, exId, n] = key.match(/^(.+)_(\d+)$/);
  await selectFocusExercise(page, exId);
  const well = page.locator(`#workout .exercise.is-current [data-save="${key}"]`);
  if (!await well.count()) {
    await page.locator(`#workout .exercise.is-current [data-editn="${n}"]`).click();
  }
  await well.click();
  await flushDraftWork(page);
}
async function commitDraftSet(page, selector, exId, ordinal = 1) {
  await clickSaveSet(page, `${exId}_${ordinal}`);
  await waitForDraftSetCompletion(page, exId, ordinal);
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
  // Finish is asynchronous.  Wait for the form's owner to settle before
  // inspecting the overlay; otherwise a summary that is still being built can
  // open over the next action after this helper has already returned.
  await page.waitForFunction(() => {
    const form = document.querySelector("#logForm");
    return !form || form.getAttribute("aria-busy") !== "true";
  }, null, { timeout: 5000 });
  const seen = await page.evaluate(() => {
    const el = document.querySelector("#sessionSummary");
    if (!el || el.classList.contains("hidden")) return null;
    return document.querySelector("#sessionSummaryBody")?.innerText || "";
  });
  if (seen == null) return null;
  await page.evaluate(() => window.__repforgeSessionSummary?.close());
  await page.waitForSelector("#sessionSummary.hidden", { state: "attached", timeout: 5000 });
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); });
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  return seen;
}

async function saveWorkout(page, { expectNewRows = true, earlyFinish = false } = {}) {
  const beforeLen = (await getState(page))?.log?.length ?? 0;
  if (earlyFinish) {
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
    return await dismissSessionSummary(page);
  }
  await page.evaluate(async () => {
    if (typeof window.__repforgeSaveWorkout === "function") {
      await window.__repforgeSaveWorkout();
      return;
    }
    document.querySelector("#logForm")?.requestSubmit();
    if (window.__repforgeStorage?.flush) await window.__repforgeStorage.flush();
  });
  if (!expectNewRows) {
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden") && Boolean(toast.textContent?.trim());
    }, undefined, { timeout: 5000 }).catch(() => {});
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

/** Finish early and report whether the session saved or Finish was refused
 *  (a refused Finish leaves its toast and keeps the workout open). */
async function finishEarlyOrRefused(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return (toast && !toast.classList.contains("hidden") && Boolean(toast.textContent?.trim())) ||
      !document.querySelector("#sessionSummary")?.classList.contains("hidden");
  }, undefined, { timeout: 8000 });
  const toast = await readToast(page);
  const saved = await page.evaluate(() => !document.querySelector("#sessionSummary")?.classList.contains("hidden"));
  if (saved) await dismissSessionSummary(page);
  return { saved, toast };
}

async function finishEarlyWithStorageOutcome(page, { localOk, idbOk }) {
  await page.evaluate(({ localOk, idbOk }) => {
    const adapter = window.RepForgeDurableState?.storageIO;
    if (!adapter || typeof adapter.writeLocal !== "function" || typeof adapter.writeIdb !== "function") {
      throw new Error("durable storage adapter unavailable");
    }
    const writeLocal = adapter.writeLocal.bind(adapter);
    const writeIdb = adapter.writeIdb.bind(adapter);
    adapter.writeLocal = async (...args) => localOk ? writeLocal(...args) : false;
    adapter.writeIdb = async (...args) => idbOk ? writeIdb(...args) : false;
    window.__restoreFinishAdapter = () => {
      adapter.writeLocal = writeLocal;
      adapter.writeIdb = writeIdb;
      delete window.__restoreFinishAdapter;
    };
    window.__repforgeLastWorkoutFinish = null;
  }, { localOk, idbOk });
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, undefined, { timeout: 15000 });
  return page.evaluate(async () => {
    try {
      return await window.__repforgeLastWorkoutFinish;
    } finally {
      window.__restoreFinishAdapter?.();
    }
  });
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
    const el = document.querySelector("#sessionDate");
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
  const selectedEdit = page.locator(`[data-history-edit="${sid}"]`);
  if (await selectedEdit.count()) {
    await selectedEdit.click();
    await page.waitForSelector(`.session--edit[data-editing="${sid}"]`, { timeout: 5000 });
    return;
  }
  const back = page.locator("[data-history-back]");
  if (await back.count()) {
    await back.click();
    await page.waitForSelector("#historyCalBtn", { timeout: 5000 });
  }
  const editBtn = page.locator(`[data-edit="${sid}"]`);
  if (!(await editBtn.count())) {
    const day = await page.evaluate((id) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return state.log?.find((row) => String(row.session) === String(id))?.day || "";
    }, sid);
    await page.click("#historySearchBtn");
    await page.fill("#historySearch", day);
  }
  const visibleEdit = page.locator(`[data-edit="${sid}"]`);
  await visibleEdit.waitFor({ state: "visible", timeout: 5000 });
  await visibleEdit.click();
  await page.waitForSelector(`.session--read[data-reading="${sid}"]`, { timeout: 5000 });
  await page.click(`[data-history-edit="${sid}"]`);
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
  const needSelect = await page.evaluate((d) => {
    if (!document.body.classList.contains("is-workout")) return true;
    const tab = document.querySelector(`#dayTabs button[data-day="${CSS.escape(d)}"]`);
    return !(tab && tab.classList.contains("active"));
  }, day);
  if (needSelect) await selectDay(page, day);
  return page.evaluate((d) => {
    const fl = window.__repforgeFocus?.list?.();
    if (fl && fl.length) {
      return fl.map(ex => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets || 2,
        min: ex.min != null ? ex.min : 4,
        max: ex.max != null ? ex.max : 8,
      }));
    }
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const prog = (raw.program || []).filter(ex => ex.day === d);
    if (prog.length) {
      return prog.map(ex => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets || 2,
        min: ex.min != null ? ex.min : 4,
        max: ex.max != null ? ex.max : 8,
      }));
    }
    return [...document.querySelectorAll("#workout .exercise")].map((article) => {
      let id = article.getAttribute("data-ex");
      return {
        id,
        sets: 2,
        min: 4,
        max: 8,
      };
    });
  }, day);
}


/* A metric-backed set's Finish validation names the load metric's own rule for
   an empty and a non-positive load alike. */
const METRIC_LOAD_TOAST = {
  en: "Enter a valid load: zero or more, within the 1,000 kg limit.",
  pt: "Informe uma carga válida: zero ou mais, dentro do limite de 1.000 kg.",
};
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

// Metric-path outcomes that differ from the flat History-edit rules: kg saved.
const METRIC_ACCEPTS = new Map([["non-positive", 0], ["near-over-limit", 1000]]);

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

/** The reason a History edit keeps under its row (Plan 064 R3j2); it replaced a toast that faded. */
async function readHistoryReason(page) {
  await page.waitForSelector(".session--edit [data-histedit-error]", { timeout: 2500 }).catch(() => {});
  return page.evaluate(() => document.querySelector(".session--edit [data-histedit-error]")?.textContent?.trim() || "");
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
  await clearDraftFixture(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
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
  await page.locator('[data-history-edit="f7-edit-seed"]').waitFor({ state: "visible", timeout: 5000 });
  await page.click('[data-history-edit="f7-edit-seed"]');
  await editor.waitFor({ state: "visible", timeout: 5000 });
}

async function cardInfo(page, idx) {
  const id = await page.evaluate(index => window.__repforgeFocus.list()[index]?.id, idx);
  if (!id) throw new Error(`Missing exercise index ${idx}`);
  return cardInfoById(page, id);
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
    // Plan 067: zero external load is a valid metric value (a bodyweight or
    // banded-assistance set logs 0 kg of external load); only a negative load
    // is a structural defect.
    if (+row.load < 0 && !row.warmup) issues.push(`non-warmup row with load<0 (${row.session} set ${row.set})`);
    if (row.exerciseId && !programIds.has(row.exerciseId) && !row.name) {
      issues.push(`orphan row without name: ${row.exerciseId}`);
    }
    const key = `${row.session}|${row.exerciseId || row.name}|${row.set}`;
    if (seen.has(key)) issues.push(`duplicate set in session: ${key}`);
    seen.add(key);
  }
  return issues;
}

async function whyInfo(page, id) {
  await selectFocusExercise(page,id);
  await page.locator("#workout .exercise.is-current [data-why]").click();
  const info={chip:await page.locator("#whyDecision").textContent(),rec:await page.locator("#whyTarget").textContent(),body:await page.locator("#whyBody").textContent()};
  await page.locator("#whyClose").click();
  await page.locator("#whySheet").waitFor({state:"hidden"});
  return info;
}

async function cardInfoById(page, exId) {
  await selectFocusExercise(page, exId);
  const card = page.locator("#workout .exercise.is-current");
  const info = await card.evaluate(a => ({
    status: [...a.classList].find(c => /^is-(add|add2|hold|reduce|new|manual)$/.test(c)) || "",
    cue: a.querySelector(".fx-cue")?.textContent || "",
  }));
  if(await card.locator("[data-why]").count())Object.assign(info,await whyInfo(page,exId));
  await page.locator("#woOverflowBtn").click();
  info.setup = await page.locator("#exActionsSetupText").textContent();
  await page.locator("#exActionsClose").click();
  await page.locator("#exActionsSheet").waitFor({state: "hidden"});
  return info;
}

/** Inject log rows for one exercise, reload, return recommendation card for that exercise. */
async function scenarioRecommendation(page, { day, exId, rows, settingsPatch } = {}) {
  const state = await getState(page);
  // Every recommendation case owns its draft lifecycle. A prior scenario can
  // leave an active DraftV2 with touched suggestions; reloading that draft
  // would make this history-only fixture depend on the previous case.
  await clearDraftFixture(page);
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
      ...(typeof ex.primary === "string" ? { primary: ex.primary } : {}),
      ...(typeof ex.secondary === "string" ? { secondary: ex.secondary } : {}),
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
  // Replacing an active program asks first; the dialog stands where the native confirm did.
  const replace = page.locator("#entryReplaceConfirm");
  if (await replace.waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false)) await replace.click();
  // Activation hands off to its destination view; wait for that, so a later
  // navigation is not overtaken by it.
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active") &&
    !!document.querySelector("#log.view.active"), undefined, { timeout: 10000 });
}

async function selectFocusExercise(page, exId) {
  const current = await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
  if (current === exId) return;
  await page.locator("#sessionSheetBtn").click();
  await page.locator(`[data-session-map-jump="${exId}"]`).click();
  await page.locator(`#workout .exercise.is-current[data-ex="${exId}"]`).waitFor({ state: "visible" });
}

async function draftSetState(page, key) {
  await flushDraftWork(page);
  return page.evaluate(key => {
    const target = window.__repforgeWorkoutDraft.target(key);
    const draft = window.__repforgeWorkoutDraft.current();
    const set = draft?.exercises[target?.exerciseInstanceId]?.sets[target?.setId];
    if (!set) throw new Error(`Missing draft set ${key}`);
    return { done: set.completion !== "pending", suggested: !Object.values(set.touched).some(Boolean) };
  }, key);
}

// Bulk simulation setup uses the production draft command boundary explicitly.
// Visible input and keyboard behavior is covered by the Focus journeys below.
async function readSimField(page, key) {
  await flushDraftWork(page);
  return page.evaluate(key => {
    const target = window.__repforgeWorkoutDraft.target(key);
    if (!target?.field) throw new Error(`Missing draft field ${key}`);
    const set = window.__repforgeWorkoutDraft.current().exercises[target.exerciseInstanceId].sets[target.setId];
    const value = target.field === "metric" ? set.edited.metrics?.[target.metricId] : set.edited[target.field];
    return String(value ?? "");
  }, simFieldKey(key));
}
async function editSimField(page, key, value) {
  await page.evaluate(async ({key, value}) => {
    const target = window.__repforgeWorkoutDraft.target(key);
    if (!target?.field) throw new Error(`Missing draft target ${key}`);
    const metric = target.field === "metric";
    const metricField = metric && target.metricId === "2555c6f170d8805cafa6d16d3fdddbaa" ? "load" : "reps";
    const result = await window.__repforgeWorkoutDraft.dispatch(metric ? "editMetricValue" : "editSetField", metric
      ? { exerciseInstanceId: target.exerciseInstanceId, setId: target.setId, metricId: target.metricId,
          value: canonicalDraftField(metricField, String(value)) }
      : { exerciseInstanceId: target.exerciseInstanceId, setId: target.setId,
          field: target.field, value: canonicalDraftField(target.field, String(value)) });
    if (result.status !== "applied") throw new Error(`Draft edit failed: ${result.status}`);
    await refreshSuggestions(target.exerciseInstanceId);
    renderWorkout();
  }, {key: simFieldKey(key), value});
}
async function exerciseAction(page, exId, button) {
  await selectFocusExercise(page, exId);
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionsSheet.is-open").waitFor({ state: "visible" });
  await page.locator(button).click();
  await page.locator("#exActionsSheet").waitFor({state: "hidden"});
  await flushDraftWork(page);
}
async function selectEffort(page, key, effort) {
  const [, exId] = key.match(/^(.+)_(\d+)$/);
  await selectFocusExercise(page, exId);
  await page.locator(`#workout .exercise.is-current [data-effspin="${key}"]`).focus();
  await page.keyboard.press("Home");
  await flushDraftWork(page);
  for(let n=0;n<["easy","hard","max"].indexOf(effort);n++) {
    await page.keyboard.press("ArrowRight");await flushDraftWork(page);
  }
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
  // The day-change question is a sheet now (OG-6 `today/draft-resume`), not a native confirm. The same mode answers it:
  // "accept" is Discard unfinished session, "dismiss" is Cancel. Where a step needs to look at the question, it answers
  // it itself with answerDiscardQuestion, which holds this watcher off (page.__manualDiscard) until it has answered.
  // The answer is one atomic step in the page: the sheet element is reused, so a waiting locator click aimed at a
  // question that is closing could land on the next question, after a step has taken it over with __manualDiscard.
  const discardWatcher = setInterval(async () => {
    if (page.__manualDiscard) return;
    try {
      await page.evaluate((id) => {
        const sheet = document.querySelector("#draftDiscardSheet.is-open");
        if (sheet && !sheet.hidden) sheet.querySelector(id)?.click();
      }, dialogMode === "dismiss" ? "#draftDiscardKeep" : "#draftDiscardDrop");
    } catch {
      /* the page moved on, or the sheet was already answered */
    }
  }, 60);
  discardWatcher.unref();

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
  const smokeSummary = (await saveWorkout(page, { earlyFinish: true })) || "";
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

  // Plan 067: zero external load is a valid metric value (a bodyweight or
  // banded-assistance set logs 0 kg of external load explicitly), so a
  // touched 0 kg row saves as 0 — it no longer aborts the Finish.
  await setLogDate(page, isoDateFromWeeksAgo(1));
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await editSimField(page, `${d1Exs[0].id}_1_load`, "0");
  await page.waitForFunction(({ d, id, weight }) => {
    try {
      const draft = JSON.parse(localStorage.getItem(d) || "null");
      return draft?.schemaVersion === 2 && draft.exercises?.[id]?.sets?.["set-1"]?.edited?.metrics?.[weight] === "0";
    } catch {
      return false;
    }
  }, { d: DRAFT, id: d1Exs[0].id, weight: WEIGHT_METRIC }, { timeout: 5000 });
  const logLenBeforeZero = (await getState(page)).log.length;
  await hideToast(page);
  const { saved: zeroSaved, toast: zeroToast } = await finishEarlyOrRefused(page);
  const stateAfterZero = await getState(page);
  const zeroRow = stateAfterZero.log.find((r) => r.exerciseId === d1Exs[0].id && r.date === isoDateFromWeeksAgo(1) && +r.set === 1);
  assert(
    zeroSaved && !zeroToast && stateAfterZero.log.length > logLenBeforeZero && zeroRow && +zeroRow.load === 0,
    "Touched zero load saves as 0 on the metric set",
    `saved=${zeroSaved} toast="${zeroToast}" len ${logLenBeforeZero}→${stateAfterZero.log.length} load=${zeroRow?.load}`,
    "Log tab → fill sets → set one load to 0 → Save workout"
  );

  // Empty kg on a touched set aborts with the load rule; log stays unchanged.
  await setLogDate(page, isoDateFromWeeksAgo(2));
  await fillExerciseSets(page, d1Exs[0].id, 1, 100, 8, 1);
  await editSimField(page, `${d1Exs[0].id}_1_load`, "");
  const logLenBeforeEmpty = (await getState(page)).log.length;
  await hideToast(page);
  await saveWorkout(page, { expectNewRows: false });
  const emptyKgToast = await readToast(page);
  assert(
    (await getState(page)).log.length === logLenBeforeEmpty &&
      emptyKgToast === METRIC_LOAD_TOAST.en,
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
  await saveWorkout(page, { earlyFinish: true });
  sessionCount++;
  uiSaveCount++;

  await setLogDate(page, sameDay);
  await fillExerciseSets(page, d1Exs[1].id, d1Exs[1].sets, 50, 10, 0);
  await saveWorkout(page, { earlyFinish: true });
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

  // Plan 067: zero external load is a valid metric value, so the 0 kg set
  // saved above is expected to be in the log, not skipped.
  const zeroLoadRows = state.log.filter((x) => x.load === 0);
  assert(
    zeroLoadRows.length > 0,
    "Zero-load sets are persisted",
    `Found ${zeroLoadRows.length} zero-load rows`,
    "Log tab → enter 0 kg on a set → Save workout → row appears in log with load 0"
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
  const attnRows = await page.evaluate(() => [...document.querySelectorAll("#attention .attn__chip")].map((row) => ({
    id: row.getAttribute("data-attn"),
    lift: row.getAttribute("data-action-lift"),
    group: row.getAttribute("data-attngo"),
    name: row.querySelector(".attnrow__name")?.textContent.trim() || "",
    verdict: row.querySelector(".attnrow__verdict")?.textContent.trim() || "",
    evidence: row.querySelector(".attnrow__evidence")?.textContent.trim() || "",
  })));
  // The seed is a Build program: its recommendations are manual, so no lift's
  // load is changed by the app and Needs attention lists none of them.
  assert(
    attnRows.length === 0,
    "A Build program's manual recommendations put no lift in Needs attention",
    JSON.stringify(attnRows),
    "Bulk seed (Build program) → Stats Overview → attention board"
  );
  const attnGroups = await page.evaluate(() =>
    typeof window.__repforgeAttention === "function" ? window.__repforgeAttention() : null
  );
  assert(
    Array.isArray(attnGroups) && attnGroups.length > 0 &&
      attnGroups.every((g) => g.lead && g.items?.length) &&
      attnGroups.every((g) => ["progress", "repeat", "review"].includes(g.key)),
    "__repforgeAttention returns evidence-backed recommendation groups",
    JSON.stringify(attnGroups?.map((g) => g.key)),
    "page.evaluate window.__repforgeAttention after seed"
  );
  // Needs attention lists the queue lifts whose recommendation changes the load
  // (add, add2, reduce); holds, recovers and stalled lifts stay in the queue only.
  const attnMoves = await page.evaluate(() => window.__repforgeAttention().flatMap((g) => g.items.map((i) => {
    const rec = window.__repforgeRecommendation(i.ex);
    return { id: i.ex.id, status: rec.status, stalled: !!rec.stalled };
  })));
  const changesLoad = (m) => m.status === "add" || m.status === "add2" || (m.status === "reduce" && !m.stalled);
  const attnExpected = attnMoves.filter(changesLoad).map((m) => m.id).sort();
  const attnHeading = await page.locator("#attention .ovsec__title").textContent();
  assert(
    attnHeading.includes(`(${attnRows.length})`) && JSON.stringify(attnRows.map((r) => r.id).sort()) === JSON.stringify(attnExpected),
    "The attention heading counts the rows, and the rows are the queue lifts that change the load",
    `heading=${attnHeading} rows=${attnRows.map((r) => r.id)} expected=${attnExpected}`,
    "Stats Overview → heading count against __repforgeAttention and recommendation()"
  );
  assert(
    attnMoves.filter((m) => !changesLoad(m)).every((m) => !attnRows.some((r) => r.id === m.id)),
    "A hold lift is absent from Needs attention",
    JSON.stringify({ moves: attnMoves, rows: attnRows.map((r) => r.id) }),
    "Stats Overview → lifts the queue lists but the engine holds"
  );
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
    !/maximum-scale|minimum-scale|user-scalable\s*=\s*no/i.test(zoomPolicy.meta),
    "Viewport meta permits browser enlargement",
    JSON.stringify(zoomPolicy),
    "Inspect <meta name=viewport> → no scale restriction"
  );
  assert(
    zoomPolicy.root === "auto" &&
      zoomPolicy.step === "manipulation" &&
      zoomPolicy.field === "manipulation",
    "The page permits zoom while controls avoid double-tap delay",
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

  if (SMOKE) {
    assert(consoleErrors.length === 0, "No console errors during short integration simulation", consoleErrors.slice(0, 5).join("; "));
    await context.close();
    await browser.close();
    console.log(`Short integration simulation: ${SIM_WEEKS} weeks, ${sessionCount} sessions, ${results.passed} passed, ${results.failed} failed.`);
    if (results.bugs.length) console.error(results.bugs.map((bug) => `${bug.name}: ${bug.detail}`).join("\n"));
    process.exitCode = results.failed ? 1 : 0;
    return;
  }

  // ── Phase 2: Draft persistence ───────────────────────────────────
  beginPhase("Phase 2: Draft persistence");

  await nav(page, "log");
  await selectDay(page, "Day 2");
  const d2Exs = await getProgramExercises(page, "Day 2");
  const draftEx = d2Exs[0];
  const draftLoad = "137.5";
  await editSimField(page, `${draftEx.id}_1_load`, draftLoad);
  await editSimField(page, `${draftEx.id}_1_reps`, "7");
  await page.waitForFunction(
    ({ d, id, load }) => {
      try {
        const draft = JSON.parse(localStorage.getItem(d) || "null");
        return draft?.schemaVersion === 2 && draft.exercises?.[id]?.sets?.["set-1"]?.edited?.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] === load;
      } catch {
        return false;
      }
    },
    { d: DRAFT, id: draftEx.id, load: draftLoad },
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
  const restoredLoad = await readSimField(page, `${draftEx.id}_1_load`);
  assert(
    restoredLoad === draftLoad,
    "Draft restored after reload",
    `Expected ${draftLoad}, got "${restoredLoad}"`,
    "Log tab → enter values → reload page → values should persist unsaved"
  );

  // Saving clears draft through the explicit early-finish path because this
  // persistence fixture edits only one set of the planned workout.
  await saveWorkout(page, { earlyFinish: true });
  const draftAfterSave = await page.evaluate((d) => localStorage.getItem(d), DRAFT);
  const freshDraftAfterSave = await page.evaluate((d) => {
    try {
      const draft = JSON.parse(localStorage.getItem(d) || "null");
      if (draft?.schemaVersion !== 2 || draft.session?.status !== "active") return false;
      return draft.exerciseOrder.every((id) => {
        const exercise = draft.exercises?.[id];
        return exercise?.status === "active" && exercise.setOrder.every((setId) => {
          const set = exercise.sets?.[setId];
          return set?.completion === "pending" &&
            !set.touched?.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] && !set.touched?.metrics?.["2555c6f170d88072bbf6d9ad3f16ea86"] && !set.touched?.effort;
        });
      });
    } catch {
      return false;
    }
  }, DRAFT);
  assert(
    !draftAfterSave || draftAfterSave === "{}" || freshDraftAfterSave,
    "Finish replaces the saved draft with a fresh empty session draft",
    `Draft after save: ${draftAfterSave?.slice(0, 80)}`,
    "Log tab → fill draft → Save workout → only a fresh untouched DraftV2 may remain"
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
    const workoutCount = await page.evaluate(() => (window.__repforgeFocus ? window.__repforgeFocus.list().length : document.querySelectorAll("#workout .exercise:not(.is-peek)").length));
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

  // Selecting a day records explicit session intent in DraftV2. End that
  // independent logging fixture before changing the durable program so the
  // editor does not correctly surface a stale-program recovery state.
  await clearDraftFixture(page);
  await reloadApp(page);
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
  // The name field is a wrapping textarea, so match it by its current value.
  const nameFields = page.locator('#programEditor [data-role="exercise-field"][data-field="name"]');
  const targetIndex = await nameFields.evaluateAll((fields, name) => fields.findIndex((field) => field.value === name), loggedOnDay2.name);
  const targetInput = nameFields.nth(Math.max(0, targetIndex));
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
  await selectFocusExercise(page, renamedEx.id);
  const latestRenameRow=state.log.filter(row=>row.exerciseId===renamedEx.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created).localeCompare(String(a.created)))[0];
  const past=(await page.locator("#workout .exercise.is-current .ledgerline__prev").allTextContents())
    .map(text=>(text.match(/(\d+(?:[.,]\d+)?) \u00d7/)||[])[1]).filter(Boolean).map(v=>v.replace(",","."));
  assert(past.length>0 && past.includes(String(latestRenameRow.load)),
    "Renamed exercise still shows previous-session values via exerciseId", JSON.stringify(past));

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
  const pickedEntry = added ? await page.evaluate((id) => window.__repforgeExerciseLibrary.find((entry) => entry.id === id) || null, added.libraryId) : null;
  assert(
    !!added && /^[0-9a-f]{32}$/.test(added.libraryId) && pickedEntry?.name === pickedName && added.primary === "Chest",
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

  // The preceding log navigation selected Day 2 and created an intent-bearing
  // draft. Clear that independent session before editing durable metadata.
  await clearDraftFixture(page);
  await reloadApp(page);
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
    metaBefore.includes("in the last 7 days"),
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
    /week 3 of/i.test(metaAfterDate),
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

  // ── Phase 4b: Program overview days ──────────────────────────────
  beginPhase("Phase 4b: Program overview days");

  await reloadApp(page);
  await nav(page, "program");
  // nav() forces the editor open; the ledger lives on the read-only overview.
  await page.click("#programEditToggle");
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });

  const ovDays = await page.evaluate(() =>
    [...document.querySelectorAll("#programOverview .prog-day")].map((el) => ({
      title: el.querySelector(".prog-day__title")?.textContent.trim(),
      rows: el.querySelectorAll(".rxrow").length,
      toggles: el.querySelectorAll("[aria-expanded], [data-ovday]").length,
      legend: !!el.querySelector(".prog-legend"),
    })));
  assert(
    ovDays.length > 0 && ovDays.every((d) => d.title && d.rows > 0 && d.toggles === 0),
    "Program overview shows every training day open, with its exercises",
    `days: ${JSON.stringify(ovDays)}`,
    "Program tab → overview → every training day"
  );
  assert(
    ovDays[0].legend && ovDays.slice(1).every((d) => !d.legend),
    "Program overview explains the Next column once, under the first day",
    `days: ${JSON.stringify(ovDays)}`,
    "Program tab → overview → legend under the first column head"
  );

  await reloadApp(page);
  await nav(page, "program");
  await page.click("#programEditToggle");
  await page.waitForSelector("#programOverview:not(.is-hidden)", { timeout: 5000 });
  const ovAfterReload = await page.evaluate(() => document.querySelectorAll("#programOverview .prog-day .rxrow").length);
  assert(
    ovAfterReload === ovDays.reduce((n, d) => n + d.rows, 0),
    "Program overview days stay open after a reload",
    `rows after reload: ${ovAfterReload}`,
    "Program tab → reload → Program tab"
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
  const delBtn = page.locator(".session--read .session__del").first();
  await delBtn.waitFor({ state: "visible", timeout: 5000 });
  const delSessionId = await delBtn.getAttribute("data-del");
  await delBtn.click();
  await page.locator('[data-history-delete-confirm="' + delSessionId + '"]').click();
  await page.waitForFunction(
    (sid) => !JSON.parse(localStorage.getItem("repforge_v1") || "{}").log?.some((row) => row.session === sid),
    delSessionId,
    { timeout: 5000 }
  );

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
  await page.waitForFunction((k) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}").settings || {};
    return s.jumpPct === 5 && s.minJump === 5 && s.rirHigh === 3;
  }, KEY, { timeout: 5000 }).catch(() => {});

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

  // A Build program is manual: logging the top of the range at a high RIR,
  // whatever the progression settings, never makes the app invent a load; the
  // next session carries the lifter's own previous values forward.
  await nav(page, "log");
  await selectDay(page, "Push Day");
  const pushFirst = (await getExerciseMeta(page, "Push Day"))[0];
  await fillExerciseSets(page, pushFirst.id, pushFirst.sets, 200, pushFirst.max, 3);
  await saveWorkout(page, { earlyFinish: true });

  await nav(page, "log");
  await selectDay(page, "Push Day");
  const manualAfterHistory = await page.evaluate((id) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const exercise = draft.exercises[id];
    return {
      rec: window.__repforgeRecommendation(window.__repforgeFocus?.list?.().find((ex) => ex.id === id) || { id }).status,
      prefilled: exercise.setOrder.map((setId) => exercise.sets[setId].edited.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] ?? null),
    };
  }, pushFirst.id);
  assert(
    manualAfterHistory.rec === "manual" && manualAfterHistory.prefilled.every((value) => value === "200"),
    "A Build program stays manual after history: the next session repeats the lifter's own load, never an invented one",
    JSON.stringify(manualAfterHistory),
    "Settings → high jumpPct → log max reps on a Build program → next session prefills no load"
  );

  // ── Phase 7: Stats integrity ─────────────────────────────────────
  beginPhase("Phase 7: Stats");

  state = await getState(page);
  await nav(page, "stats");

  // The overview carries two week totals and a strength row per lift with a session
  // this block; the all-time tiles, the trend card and the deep tables are retired.
  const overviewAudit = await page.evaluate(() => ({
    sessions: document.querySelector('#thisWeek [data-week-metric="sessions"] .ovtotal__n')?.textContent?.trim(),
    sets: document.querySelector('#thisWeek [data-week-metric="sets"] .ovtotal__n')?.textContent?.trim(),
    rows: document.querySelectorAll("#overviewStrength .strrow").length,
    retired: ["#metrics", "#statExercise", "#statsDeep", "#overviewVolume", "#chart"].filter((sel) => document.querySelector(sel)),
  }));
  assert(
    /^\d+$/.test(overviewAudit.sessions || "") && /^\d+$/.test(overviewAudit.sets || ""),
    "Stats overview renders the week's session and set totals",
    JSON.stringify(overviewAudit),
    "Stats tab → two week totals"
  );
  assert(
    overviewAudit.rows > 0 && overviewAudit.retired.length === 0,
    "Stats overview lists strength rows and none of the retired blocks",
    JSON.stringify(overviewAudit),
    "Stats tab → Strength this block"
  );

  // The canvas chart lives on the exercise page.
  await page.evaluate((id) => openExerciseView(id, "log"), state.program[0].id);
  await page.waitForSelector("#exercise.view.active #exChart", { timeout: 5000 });
  const chartRendered = await page.evaluate(() => {
    const c = document.querySelector("#exChart");
    return c && c.width > 0;
  });
  assert(
    chartRendered,
    "Chart canvas renders with data",
    "Canvas width is 0 or missing",
    "Exercise page → chart"
  );

  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForFunction(() => {
    const c = document.querySelector("#exChart");
    return c && c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
  });
  const okWide = await page.evaluate(() => {
    const c = document.querySelector("#exChart");
    return c.width >= (c.clientWidth || 320) * (devicePixelRatio || 1) - 2;
  });
  await page.setViewportSize({ width: 380, height: 900 });
  await page.waitForFunction(() => {
    const c = document.querySelector("#exChart");
    return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
  });
  const okNarrow = await page.evaluate(() => {
    const c = document.querySelector("#exChart");
    return c.width <= (c.clientWidth || 320) * (devicePixelRatio || 1) + 2;
  });
  assert(
    okWide && okNarrow,
    "Chart canvas tracks viewport width on resize",
    `wide=${okWide} narrow=${okNarrow}`,
    "Exercise page → resize viewport → canvas backing width follows clientWidth"
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
  await page.evaluate(() => closeExerciseView());
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
    await page.waitForSelector("#importChoice[open]");
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
      await page.locator("#importChoice").evaluate((dialog) => !dialog.open),
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
    await page.waitForSelector("#importChoice[open]");
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
    await page.waitForSelector("#importChoice[open]");
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
      JSON.stringify({ programMeta: exported.programMeta, program: exported.program, log: exported.log.slice(0, 6),
        customExercises: exported.customExercises || [] })
    );
    await page.setInputFiles("#importJson", noSettingsPath);
    await page.waitForSelector("#importChoice[open]");
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
  await toggleWarmup(page, wEx.id, 1);
  await fillExerciseSets(page, wEx.id, 1, 20, 6, 2);
  await saveWorkout(page, { earlyFinish: true });
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
  // The next session carries the lifter's working values forward, never the
  // warmup's 20 kg.
  const carriedAfterWarmup = await page.evaluate((id) => {
    const exercise = window.__repforgeWorkoutDraft.current().exercises[id];
    return exercise.setOrder.map((setId) => exercise.sets[setId].edited.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] ?? null);
  }, wEx.id);
  assert(
    !carriedAfterWarmup.includes("20") && carriedAfterWarmup.includes("100"),
    "The next session's carried-forward loads ignore the warmup set",
    JSON.stringify(carriedAfterWarmup),
    "Log warmup + working sets → next session prefills working loads only"
  );

  beginPhase("Phase: PR ledger");
  await nav(page, "log");
  const prDay = await firstDayName(page);
  const prMeta = await getExerciseMeta(page, prDay);
  // Another exercise at a higher load first — global max must exceed the PR exercise's new top
  await fillExerciseSets(page, prMeta[1].id, prMeta[1].sets, 250, 6, 2);
  await saveWorkout(page, { earlyFinish: true });
  await nav(page, "log");
  await selectDay(page, prDay);
  // PR for exercise 0: beats its own prior top (~125) but stays below the 250 global max elsewhere
  await fillExerciseSets(page, prMeta[0].id, prMeta[0].sets, 150, 6, 2);
  const prSummary = (await saveWorkout(page, { earlyFinish: true })) || "";
  assert(
    /\bPR\b/.test(prSummary) && /over your best/.test(prSummary) && /150 kg × 6/.test(prSummary) && !/250 kg/.test(prSummary),
    "Session summary announces a per-exercise top-load PR (not global max)",
    `Summary: ${JSON.stringify(prSummary)}`,
    "Log another exercise at 250 kg, then PR the first exercise at 150 kg → Save"
  );
  await nav(page, "stats");
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("prs"));
  await page.waitForSelector("#prTimeline .prtl__row", { timeout: 5000 });
  const ledger = await page.evaluate(() => [...document.querySelectorAll("#prTimeline .pr-kind")].map((el) => el.textContent.trim()).join(" "));
  assert(
    /load/i.test(ledger) && /e1RM/i.test(ledger),
    "PR timeline renders load and e1RM PRs",
    `Kinds: ${ledger}`,
    "Stats → PRs → timeline"
  );
  await nav(page, "log");
  await selectDay(page, "Day 3");
  const prMeta3 = await getExerciseMeta(page, "Day 3");
  const prEx = prMeta3[prMeta3.length - 1];
  await fillExerciseSets(page, prEx.id, prEx.sets, 80, 8, 2);
  await saveWorkout(page, { earlyFinish: true });
  await nav(page, "log");
  await selectDay(page, "Day 3");
  await fillExerciseSets(page, prEx.id, prEx.sets, 85, 8, 2);
  await saveWorkout(page, { earlyFinish: true });
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
  const progSlots = (progFile.definition?.days || []).filter((d) => d.kind === "training").flatMap((d) => d.slots);
  assert(
    progFile.kind === "taurifer-program" && progFile.version === 4 && progSlots.length > 0 &&
      progFile.name === "Simulation Split" && Array.isArray(progFile.customExercises),
    "Program export is a v4 file with the name, the ProgramDefinition and referenced custom definitions",
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
  // The file carries exact identities; a renamed slot keeps its movement and
  // arrives under its new display name.
  progSlots[0].displayName = "IMPORTED_RENAME";
  progFile.name = "Imported Template";
  writeFileSync(progPath, JSON.stringify(progFile));
  const stateBeforeImport = await getState(page);
  const metaBeforeImport = stateBeforeImport.programMeta;
  const programBeforeImport = stateBeforeImport.program;
  const importDraft = await page.evaluate(async () => {
    const entered = await window.__repforgeEnterWorkout?.({});
    if (entered !== true) throw new Error("Could not open a workout to seed the import draft");
    const result = await window.__repforgeWorkoutDraft?.dispatch("setSessionNotes", {
      value: "unfinished before program import",
    });
    if (result?.status !== "applied") {
      throw new Error(`Could not acknowledge import draft command: ${result?.status || "missing"}`);
    }
    await window.__repforgeStorage?.flush?.();
    const raw = localStorage.getItem("repforge_draft_v1");
    if (!raw) throw new Error("Import draft command produced no canonical draft");
    return raw;
  });
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
  try {
    await page.waitForFunction(
      ({ k, name }) => JSON.parse(localStorage.getItem(k) || "{}").program?.some((x) => x.name === name),
      { k: KEY, name: "IMPORTED_RENAME" },
      { timeout: 5000 }
    );
  } catch (error) {
    console.log("    Program import diagnostic", await page.evaluate(() => ({
      activeView: [...document.querySelectorAll(".view")].find((el) => el.classList.contains("active"))?.id,
      entryStep: document.querySelector("#onboarding")?.dataset.step,
      entryText: document.querySelector("#onboarding")?.innerText?.slice(0, 800),
      state: JSON.parse(localStorage.getItem("repforge_v1") || "{}"),
      draft: localStorage.getItem("repforge_draft_v1"),
    })));
    throw error;
  }
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
      stAfter.programMeta.started === new Date().toISOString().slice(0, 10),
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

  // The raw editor holds the ProgramDefinition; rows are re-projected from it.
  const trainingSlots = (definition) => definition.days.filter((d) => d.kind === "training").flatMap((d) => d.slots);
  const waitStored = (predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 5000 });
  await nav(page, "program");
  const openAdvanced = async () => {
    if (await page.locator("#programEditorWrap.is-hidden").count()) {
      await page.click("#programEditToggle");
      await page.waitForSelector("#programEditorWrap:not(.is-hidden)", { timeout: 5000 });
    }
    await page.evaluate(() => document.querySelector("#programEditorWrap details.advanced")?.setAttribute("open", ""));
  };
  await openAdvanced();
  const jsonArea = page.locator("#programJson");
  const definitionBefore = JSON.parse(await jsonArea.inputValue());
  assert(
    Array.isArray(definitionBefore.days) && trainingSlots(definitionBefore).every((slot) => slot.id && slot.exerciseId),
    "Program JSON exposes the ProgramDefinition with slot and movement ids",
    JSON.stringify(definitionBefore).slice(0, 160),
    "Program → Advanced → JSON shows the definition"
  );

  // A raw edit to a slot's display name and set count lands in the definition
  // and in the projected rows.
  const editedDefinition = structuredClone(definitionBefore);
  const editedSlot = trainingSlots(editedDefinition)[0];
  const testExName = "JSON Editor Test Lift";
  editedSlot.displayName = testExName;
  const originalSetCount = editedSlot.prescriptionsByCycle[0].sets.length;
  await openAdvanced();
  await jsonArea.fill(JSON.stringify(editedDefinition));
  await page.click("#saveProgram");
  await waitStored(({ k, id, name }) => {
    const s = JSON.parse(localStorage.getItem(k) || "{}");
    return s.program?.some((row) => (row.slotId || row.id) === id && row.name === name);
  }, { k: KEY, id: editedSlot.id, name: testExName }).catch(() => {});
  state = await getState(page);
  assert(
    state.program.some((row) => (row.slotId || row.id) === editedSlot.id && row.name === testExName) &&
      trainingSlots(state.programMeta.programDefinition).find((slot) => slot.id === editedSlot.id)?.displayName === testExName,
    "Program JSON editor saves a definition edit into the definition and its rows",
    JSON.stringify(state.program.find((row) => (row.slotId || row.id) === editedSlot.id)),
    "Program → Advanced → edit the definition → Save JSON"
  );
  assert(
    trainingSlots(state.programMeta.programDefinition).map((slot) => slot.id).join() === trainingSlots(definitionBefore).map((slot) => slot.id).join(),
    "JSON round-trip preserves slot ids",
    "slot ids changed after Save JSON",
    "Program → Save JSON → slot ids unchanged"
  );

  // Unparseable text and a definition the compiler rejects are refused, and
  // neither changes the stored program.
  const storedBeforeInvalid = JSON.stringify((await getState(page)).programMeta.programDefinition);
  await hideToast(page);
  await openAdvanced();
  await jsonArea.fill("{ invalid json");
  await page.click("#saveProgram");
  const toastText = await readToast(page);
  assert(
    /JSON|parse|read/i.test(toastText) && JSON.stringify((await getState(page)).programMeta.programDefinition) === storedBeforeInvalid,
    "Invalid program JSON shows an error toast and saves nothing",
    `Toast: "${toastText}"`,
    "Program → Advanced → enter invalid JSON → Save JSON"
  );
  const unknownMovement = structuredClone(JSON.parse(storedBeforeInvalid));
  trainingSlots(unknownMovement)[0].exerciseId = "ffffffffffffffffffffffffffffffff";
  await hideToast(page);
  await openAdvanced();
  await jsonArea.fill(JSON.stringify(unknownMovement));
  await page.click("#saveProgram");
  const invalidDefinitionToast = await readToast(page);
  assert(
    invalidDefinitionToast === await page.evaluate(() => window.RepForgeI18n.t("toast.program_invalid")) &&
      JSON.stringify((await getState(page)).programMeta.programDefinition) === storedBeforeInvalid,
    "A definition naming an unknown movement is refused and saves nothing",
    `Toast: "${invalidDefinitionToast}"`,
    "Program → Advanced → point a slot at an unknown UUID → Save JSON"
  );

  // Unsaved text survives a render, so collapsing Advanced is what throws a
  // broken edit away — the only route back to the program's own JSON.
  await page.evaluate(() => document.querySelector("#programEditorWrap details.advanced")?.removeAttribute("open"));
  await openAdvanced();
  await page.waitForFunction(() => { try { return Array.isArray(JSON.parse(document.querySelector("#programJson").value).days); } catch { return false; } },
    undefined, { timeout: 3000 }).catch(() => {});
  assert(
    await page.evaluate(() => {
      try { return JSON.stringify(JSON.parse(document.querySelector("#programJson").value)); } catch { return null; }
    }) === storedBeforeInvalid,
    "Collapsing Advanced discards an unsaveable JSON draft",
    "textarea does not hold the stored definition after reopening Advanced",
    "Program → Advanced → invalid JSON → collapse → reopen"
  );

  // An unsaved JSON draft must survive a render it did not cause; only a real
  // program change underneath is newer and allowed to replace it.
  const draftDefinition = JSON.parse(await jsonArea.inputValue());
  trainingSlots(draftDefinition)[0].displayName = "Unsaved draft name";
  await openAdvanced();
  await jsonArea.fill(JSON.stringify(draftDefinition));
  await page.evaluate(() => document.querySelector("#programJson").blur());
  await page.evaluate(() => window.render?.());
  assert(
    trainingSlots(JSON.parse(await jsonArea.inputValue()))[0].displayName === "Unsaved draft name",
    "Unsaved raw JSON survives an unrelated re-render",
    "textarea was reset before Save JSON",
    "Program → Advanced → edit JSON → blur → render() → text still there"
  );
  await openAdvanced();
  const firstRow = page.locator(`#programEditor [data-role="exercise"][data-id="${editedSlot.id}"]`);
  if (await firstRow.locator('[data-role="sets-control"]').count() === 0)
    await firstRow.locator('[data-role="toggle-exercise"]').click();
  await firstRow.locator('[data-role="adjust"][data-field="sets"][data-delta="1"]').click();
  await applyProgramEditor(page);
  await nav(page, "program");
  await openAdvanced();
  const afterEditorChange = JSON.parse(await jsonArea.inputValue());
  const refreshedSlot = trainingSlots(afterEditorChange).find((slot) => slot.id === editedSlot.id);
  assert(
    refreshedSlot?.prescriptionsByCycle[0].sets.length === originalSetCount + 1 && refreshedSlot.displayName === testExName,
    "A visual-editor change refreshes the raw JSON over a stale draft",
    JSON.stringify({ sets: refreshedSlot?.prescriptionsByCycle[0].sets.length, name: refreshedSlot?.displayName }),
    "Program → edit JSON → adjust sets → Done → textarea shows the new program"
  );
  // Restore the scratch changes so later phases see the program they expect.
  await openAdvanced();
  await jsonArea.fill(JSON.stringify(definitionBefore));
  await page.click("#saveProgram");
  await waitStored(({ k, def }) => JSON.stringify(JSON.parse(localStorage.getItem(k) || "{}").programMeta?.programDefinition) === def,
    { k: KEY, def: JSON.stringify(definitionBefore) }).catch(() => {});

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
  await saveWorkout(page, { earlyFinish: true });
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
  const allD2 = await getExerciseMeta(page, logDay);
  for (const ex of allD2) {
    await fillExerciseSets(page, ex.id, ex.sets, 55, 8, 1);
  }
  await completeDraftSets(page);
  await setWorkoutField(page, "#sessionNotes", "collision-test-A");
  await page.evaluate(() => { const f=document.querySelector("#logForm"); f?.requestSubmit(); f?.requestSubmit(); });
  await page.locator("#sessionSummary:not(.hidden)").waitFor({state:"visible"});
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
  const allD3 = await getExerciseMeta(page, "Day 3");
  for (const ex of allD3) {
    await fillExerciseSets(page, ex.id, ex.sets, 60, 8, 1);
  }
  const d3 = allD3[0];
  await fillExerciseSets(page, d3.id, 1, 61.25, 8, 1);
  await completeDraftSets(page);
  const logLenBeforeInvalid = (await getState(page)).log.length;
  await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
  await page.locator("#sessionSummary:not(.hidden)").waitFor({state:"visible"});
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

  // Program retains the effective-set audit action in its overview.
  await nav(page, "program");
  const auditAction = await page.locator("#programOverview #seeVolumeAudit").count();
  assert(
    auditAction === 1,
    "Program overview exposes the effective-set audit action",
    `action count: ${auditAction}`,
    "Program tab → planned effective sets"
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
    chooserOpen: !!document.querySelector("#importChoice")?.open,
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
  // The retired range/capacity/strategy engine's matrix, rounding and Why
  // arithmetic phases are gone: adaptive recommendations are owned by
  // test/progression-engine-plan067.mjs and test/adaptive-workout-browser.mjs.
  beginPhase("Phase: exercise substitution");
  // The program import above replaced the seed program with an imported copy;
  // the substitution walk needs the seed's own slots back.
  await clearDraftFixture(page);
  await installSeedProgram(page, { waitFor: (p) => waitForApp(p) });
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
  // The editor's own Alternates row was removed (#317 option B: the Focus
  // swap picker never read it, so the control only stored a note the
  // canonical program then dropped). This phase now goes straight to the
  // mid-session substitute, which is the real swap path.
  await applyProgramEditor(page);
  await nav(page, "log");
  const subDay = d1First.day;
  await selectDay(page, subDay);
  if (await page.evaluate(id => window.__repforgeWorkoutDraft.current()?.exercises[id]?.status === "skipped", d1First.id)) {
    await exerciseAction(page, d1First.id, "#exActionSkipBtn");
  }
  await exerciseAction(page, `${d1First.id}`, "#exActionSubstBtn");
  await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
  const swapped = await pickExact("45° leg press");
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  assert(swapped, "Mid-session swap opens the library picker", "Leg press row not found in picker",
    "Log → an exercise's swap control → search 'Leg press'");
  await fillExerciseSets(page, d1First.id, 1, 120, 6, 1);
  const subSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
  subState = await getState(page);
  const subSession = [...new Set(subState.log.map((r) => r.session))].find((s) => !subSessionsBefore.has(s));
  const subRow = subState.log.find((r) => r.session === subSession && r.exerciseId === d1First.id);
  assert(
    subRow && subRow.performedName === "45° leg press",
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
    histText.includes("45° leg press"),
    "History table shows performed substitute name",
    histText.slice(0, 200),
    "History → Every set table after substitute save"
  );
  await nav(page, "stats");
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const performedLiftKey = subRow?.performedLibraryId ? `library:${subRow.performedLibraryId}` : null;
  await page.waitForTimeout(80);
  const chartRows = await page.evaluate((expected) => {
    const log = JSON.parse(localStorage.getItem("repforge_v1")).log.filter((r) => !r.warmup);
    const series = window.__repforgeProgressEvidence.strength(expected);
    return !!document.querySelector(`#strengthDash [data-evkey="${expected}"]`) && series?.evidenceCount >= 1 && log.some((r) =>
      r.performedLibraryId && `library:${r.performedLibraryId}` === expected);
  }, performedLiftKey);
  assert(
    chartRows,
    "Strength evidence attributes substituted sessions to the performed movement",
    `performedLiftKey=${performedLiftKey}`,
    "Stats → Strength → the performed substitute has its own row with a session"
  );

  // Unit toggle: draft loads convert on unit change; persisted log stays kg
  await resetWithSeedProgram(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const unitMeta = await getExerciseMeta(page, "Day 1");
  const unitEx = unitMeta[0].id;
  await editSimField(page, `${unitEx}_1_load`, "100");
  await editSimField(page, `${unitEx}_1_reps`, "6");
  await editSimField(page, `${unitEx}_1_rir`, "1");
  await page.waitForTimeout(80);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(120);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  // The draft keeps the canonical kg; the field shows it in the lifter's unit.
  const lbStored = +(await readSimField(page, `${unitEx}_1_load`));
  const lbShown = await page.evaluate((key) => document.querySelector(`[data-k="${key}"]`)?.value ?? null,
    `${unitEx}_1_metric_${WEIGHT_METRIC}`);
  assert(
    lbStored === 100 && lbShown != null && Math.abs(parseFloat(String(lbShown).replace(",", ".")) - 220.46226218) < 0.15,
    "Draft load converts kg to lb on unit switch",
    `stored=${lbStored} shown=${lbShown}`,
    "Log → enter 100 kg → Settings unit=lb → the load field shows ~220.46 lb over a 100 kg draft"
  );
  await saveWorkout(page, { earlyFinish: true });
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
  await editSimField(page, `${unitEx}_1_load`, "100");
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
    (await readSimField(page, `${unitEx}_1_load`)) === "100",
    "Draft load round-trips kg→lb→kg",
    `draft load=${await readSimField(page, `${unitEx}_1_load`)}`,
    "Log → 100 kg draft → switch lb → switch kg → draft shows 100 again"
  );

  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await editSimField(page, `${unitEx}_1_load`, "225");
  await editSimField(page, `${unitEx}_1_reps`, "5");
  await editSimField(page, `${unitEx}_1_rir`, "2");
  await saveWorkout(page, { earlyFinish: true });
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
  // Changing the mode is a draft-schema boundary. Start this fixture with no
  // active DraftV2 so the new draft records rirMode="effort" rather than
  // carrying a numeric draft created by the preceding phases.
  await clearDraftFixture(page);
  await reloadApp(page);
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
  await editSimField(page, `${effEx.id}_1_load`, "90");
  await editSimField(page, `${effEx.id}_1_reps`, "6");
  await selectEffort(page, `${effEx.id}_1`, "easy");
  await flushDraftWork(page);
  let effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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
  await editSimField(page, `${effEx.id}_1_load`, "92");
  await editSimField(page, `${effEx.id}_1_reps`, "5");
  await selectEffort(page, `${effEx.id}_1`, "hard");
  await flushDraftWork(page);
  effortSessionsBefore = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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
  await editSimField(page, `${effEx.id}_1_load`, "95");
  await editSimField(page, `${effEx.id}_1_reps`, "4");
  await selectEffort(page, `${effEx.id}_1`, "max");
  await flushDraftWork(page);
  const effortRowsBefore = (await getState(page)).log.length;
  await saveWorkout(page, { earlyFinish: true });
  effortState = await getState(page);
  effortRow = effortState.log.slice(effortRowsBefore)
    .find((r) => r.exerciseId === effEx.id && +r.set === 1);
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

  await nav(page, "log");
  await selectDay(page, "Day 1");
  await selectFocusExercise(page, effEx.id);
  const effortSpinner = page.locator(`#workout .exercise.is-current [data-effspin="${effEx.id}_1"]`);
  await effortSpinner.focus();
  await page.keyboard.press("Home");
  await flushDraftWork(page);
  await page.keyboard.press("ArrowRight");
  await flushDraftWork(page);
  const keyboardEffort = await effortSpinner.evaluate(el => ({
    role: el.tagName === "BUTTON" ? "button" : el.getAttribute("role"), value: el.dataset.e,
    focused: document.activeElement === el,
    clipped: el.scrollWidth > el.clientWidth + 1,
    exerciseId: el.closest(".exercise.is-current")?.dataset.ex,
  }));
  const keyboardDraft = await readDraft(page);
  const keyboardEx = keyboardDraft.exercises[effEx.id];
  assert(keyboardEffort.role === "button" && keyboardEffort.value === "hard" &&
    keyboardEffort.focused && !keyboardEffort.clipped && keyboardEffort.exerciseId === effEx.id &&
    keyboardEx.sets[keyboardEx.setOrder[0]].edited.effort === "hard",
    "Focus effort keyboard selection is visible, semantic, and persisted", JSON.stringify(keyboardEffort));
  // Copy carries the effort of the last session, not just its numbers.
  await exerciseAction(page, `${effEx.id}`, "#exActionRepeatBtn");
  await flushDraftWork(page);
  const copied = await page.evaluate(
    (exId) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      const exercise = draft?.exercises?.[exId];
      const setId = exercise?.setOrder?.find((id) => exercise.sets[id]?.ordinal === 1);
      const el = document.querySelector(`[data-effspin="${exId}_1"]`);
      return {
        checked: el?.dataset.e || exercise?.sets?.[setId]?.edited?.effort || "max",
        draft: setId ? exercise.sets[setId]?.edited?.effort : "max",
      };
    },
    effEx.id
  );
  assert(
    copied.checked === "max" && copied.draft === "max",
    "Copy last fills the effort picker from the last session",
    JSON.stringify(copied),
    "Focus → Copy after a Max session → picker shows Max"
  );

  // ---- Focus mode: effort takes the third column of the well as a spinner, and
  // ---- a logged set reads back as the word that was tapped.

  await page.waitForTimeout(200);
  const focusEffort = await page.evaluate(() => {
    // Effort is the shelf's third field; selecting it brings its two word pads.
    document.querySelector("#workout .exercise.is-current .focus-shelf [data-shelf-field='rir']")?.click();
    const cell = document.querySelector("#workout .exercise.is-current .focus-shelf .shelf__field[data-field='rir']");
    const spin = cell?.querySelector("[data-effspin]");
    const steps = [...document.querySelectorAll("#workout .exercise.is-current .focus-shelf [data-effstep]")];
    return {
      hasCell: !!cell,
      role: spin?.tagName === "BUTTON" ? "spinbutton" : "",
      named: !!spin?.textContent?.trim(),
      valueText: cell?.querySelector(".shelf__val")?.textContent?.trim() || "",
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
    const cells = [...document.querySelectorAll(".exercise.is-current .focus-shelf .shelf__field")];
    const band = (sel) => cells.map((c) => {
      const el = c.querySelector(sel);
      return el ? Math.round(el.getBoundingClientRect().top) : null;
    });
    const pads = [...document.querySelectorAll(".exercise.is-current .focus-shelf .shelf__pad")]
      .map((b) => Math.round(b.getBoundingClientRect().top));
    return {
      n: cells.length,
      labs: band(".shelf__lab"),
      vals: band(".shelf__val"),
      lines: cells.map((c) => Math.round(c.getBoundingClientRect().top)),
      steps: pads.length ? pads : [0],
      gap: 0,
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
    const ledger = document.querySelector(".exercise.is-current .fcard__context");
    const first = ledger?.querySelector(".ledgerline__head");
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
  await editSimField(page, `${effEx.id}_1_load`, "97");
  await editSimField(page, `${effEx.id}_1_reps`, "5");
  // The spinner walks the three words in order, and each step is announced.
  const STEPS = ["easy", "hard", "max"];
  const effAt = () => page.evaluate((k) => {
    const el = document.querySelector(`.focus-shelf [data-effspin="${k}"]`);
    return { e: el?.dataset.e, now: String(["easy", "hard", "max"].indexOf(el?.dataset.e) + 1), text: el?.querySelector(".shelf__val")?.textContent?.trim() };
  }, `${effEx.id}_1`);
  const effStart = await effAt();
  await page.click(`.focus-shelf [data-effstep="${effEx.id}_1"][data-dir="-1"]`);
  await page.waitForTimeout(80);
  const effDown = await effAt();
  await page.click(`.focus-shelf [data-effstep="${effEx.id}_1"][data-dir="1"]`);
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
    await page.click(`.focus-shelf [data-effstep="${effEx.id}_1"][data-dir="${dir}"]`);
    await page.waitForTimeout(80);
  }
  await page.click("#workout .exercise.is-current .focus-shelf .saveset");
  await page.waitForTimeout(300);
  const loggedRow = await page.evaluate(() => {
    const row = document.querySelector(".ledgerline[data-editn]");
    return {
      cells: row ? [...row.querySelectorAll(".fx-col")].map((s) => s.textContent.trim()) : [],
      head: [...document.querySelectorAll("#workout .exercise.is-current .ledgerline__head .fx-col")].map((s) => s.textContent.trim()),
    };
  });
  assert(
    /effort|esforço/i.test(loggedRow.head[2] || "") && /^(easy|hard|max|fácil|difícil|máx)$/i.test(loggedRow.cells[2] || ""),
    "A logged set reads back as its effort word in Focus mode",
    JSON.stringify(loggedRow),
    "Log → Focus → step to Hard → Registrar série → logged row shows Hard"
  );
  // Once a set is logged the ledger does have an end worth showing.
  const parkedRow = await page.evaluate(() => {
    const ledger = document.querySelector(".exercise.is-current .fcard__context");
    const rows = ledger?.querySelectorAll(".ledgerline[data-editn]") || [];
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
  await saveWorkout(page, { earlyFinish: true });
  effortState = await getState(page);
  effortSession = [...new Set(effortState.log.map((r) => r.session))].find((s) => !effortSessionsBefore.has(s));
  effortRow = effortState.log.find((r) => r.session === effortSession && r.exerciseId === effEx.id && +r.set === 1);
  assert(
    effortRow && effortRow.rir === 1 && effortRow.reps === 5,
    "Focus-mode effort pick saves through the RIR mapping",
    `row=${JSON.stringify(effortRow)}`,
    "Log → Focus → Hard → Registrar série → Save workout → stored rir is 1"
  );

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
  // A generated beginner program replaces the seed: the lifter sees its
  // movements and its authored setup notes, and keeps the history.
  const beginnerFirst = await page.evaluate(async () => {
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "muscle_growth", structuredExperience: "under_6m", daysPerWeek: 3, sessionMinutes: 60,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const definition = window.RepForgeProgramCompiler.generateProgram(request, catalog, "simulation-beginner").value;
    const first = definition.days.find((day) => day.kind === "training").slots[0];
    first.setupNotes = "Use a stable machine setup and controlled range.";
    await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition, name: "Beginner program", answers: {}, destination: "log", origin: "settings",
      draftConfirmed: true, telemetryRoute: "recommend", entrySource: { route: "recommend", fingerprint: "simulation-beginner" },
    });
    await window.__repforgeStorage.flush();
    const entry = window.__repforgeExerciseLibrary.find((item) => item.id === first.exerciseId);
    return { day: definition.days.find((day) => day.kind === "training").name, names: [first.displayName, entry?.name].filter(Boolean) };
  });
  await nav(page, "log");
  await selectDay(page, beginnerFirst.day);
  const begName = (await page.locator("#workout .exercise .ex__name").first().textContent()) || "";
  assert(
    beginnerFirst.names.some((name) => begName.includes(name)) && !/Hack squat/i.test(begName),
    "Beginner program shows its own movement names",
    `name="${begName}" expected one of ${JSON.stringify(beginnerFirst.names)}`,
    "Activate a generated beginner program → Log its first day"
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
    begSetup.setup.includes("Use a stable machine setup"),
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
  await selectDay(page, beginnerFirst.day);
  await setWorkoutField(page, "#sessionBodyweight", "80");
  const bwMeta = await getExerciseMeta(page, beginnerFirst.day);
  await fillExerciseSets(page, bwMeta[0].id, bwMeta[0].sets, 100, 6, 1);
  await saveWorkout(page, { earlyFinish: true });
  const stBw = await getState(page);
  assert(
    stBw.log.some((r) => +r.bodyweight === 80),
    "Bodyweight persists on saved rows",
    "No saved row carries bodyweight 80",
    "Log → set bodyweight → Save → rows carry bodyweight"
  );
  await nav(page, "log");
  await selectDay(page, beginnerFirst.day);
  assert(
    (await page.inputValue("#sessionBodyweight")) === "80",
    "Bodyweight prefills from last session",
    `bodyweight input = ${await page.inputValue("#sessionBodyweight")}`,
    "Log → reopen → bodyweight prefilled"
  );

  // Focus shows one exercise; Finish saves the acknowledged session. The
  // generated beginner program has one-set jobs, so the Focus walk below runs
  // on the two-set seed program again.
  await clearDraftFixture(page);
  await installSeedProgram(page, { waitFor: (p) => waitForApp(p) });
  await nav(page, "log");
  await selectDay(page, "Day 1");

  await page.waitForTimeout(80);
  // The live card is the only active exercise owner; neighbouring peeks stay inert.
  const visible = await page.evaluate(() => ({
    current: document.querySelectorAll("#workout .exercise.is-current:not(.is-peek)").length,
    topLevel: [...document.querySelector("#workout").children].filter((node) => node.matches(".exercise")).length,
    peeksInert: [...document.querySelectorAll("#workout .exercise.is-peek")].every((card) => card.inert),
  }));
  assert(
    visible.current === 1 && visible.topLevel === 0 && visible.peeksInert,
    "Focus has one live exercise owner and no retired top-level projection",
    JSON.stringify(visible),
    "Log → Focus → only current card shown"
  );
  const overflowClosed = await page.evaluate(() => ({
    hidden: document.querySelector("#woOverflow")?.classList.contains("hidden"),
    expanded: document.querySelector("#woOverflowBtn")?.getAttribute("aria-expanded"),
  }));
  assert(
    overflowClosed.hidden === true && (overflowClosed.expanded === "false" || overflowClosed.expanded === null),
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
      // The clock is inline in the cue slot, a part of the card's flow above the shelf, and nothing else of the old rest chrome is in it.
      inCard: card.querySelectorAll(".ex__rest").length,
      inline: card.querySelectorAll(".fx-slot[data-rest='running'] .restinline").length,
      aboveShelf: (() => {
        const slot = card.querySelector(".fx-slot")?.getBoundingClientRect();
        const cta = card.querySelector(".focus-shelf .btn--cta")?.getBoundingClientRect();
        return !!slot && !!cta && slot.bottom <= cta.top;
      })(),
      overlapsCard: chipBox.bottom > cardBox.top,
      tapTarget: Math.round(Math.min(chipBox.width, chipBox.height)),
    };
  });
  assert(
    restSurfaces.chipVisible && restSurfaces.running && restSurfaces.counting &&
      restSurfaces.labelled && restSurfaces.floatingHidden && restSurfaces.inCard === 0 &&
      restSurfaces.inline === 1 && restSurfaces.aboveShelf &&
      !restSurfaces.overlapsCard && restSurfaces.tapTarget >= 44,
    "Focus rest counts down in the workout header and inline in the cue slot, clear of the shelf's controls",
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
    "tapping the running rest chip opens the presets rather than ending the rest",
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
      cueInsideCard: !!card.querySelector(".fcard__context .fx-cue"),
      navHidden: getComputedStyle(document.querySelector("nav")).display === "none",
      peeksHidden: [...wrap.querySelectorAll(".deck__slot--next, .deck__slot--prev")].every(
        (p) => getComputedStyle(p).visibility === "hidden" || getComputedStyle(p).display === "none"
      ),
      peekHasFields: [...wrap.querySelectorAll(".deck__slot--next, .deck__slot--prev")].some((p) => !!p.querySelector("[data-k]")),
    };
  });
  assert(
    deck.wrapped && deck.tracked,
    "the current exercise renders as a card on a paged track",
    JSON.stringify(deck),
    "Focus mode → the exercise sits on the deck's paged track"
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
    "the recommendation cue sits in the card's context above the shelf",
    JSON.stringify(deck),
    "Focus mode → the guidance line rides with the ledger it explains"
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
    "Focus mode → the peek copies are out of the layout at rest and hold no data-k inputs"
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
  await page.locator("#woProgress button[data-focusgo]").first().click();
  await page.waitForTimeout(450);
  assert(
    (await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex)) === swipeFrom,
    "the first progress segment returns to the first exercise",
    `back=${await page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex)}`,
    "Focus → tap the first segment of the exercise bar → first exercise"
  );

  // Exercise direction and velocity from a control surface. These mouse drags
  // must not claim selectable header prose, whose native selection has its own proof.
  const currentEx = () => page.evaluate(() => document.querySelector("#workout .exercise.is-current")?.dataset.ex);
  const dragPath = async (path) => {
    const box = await page.locator("#workout .exercise.is-current .ex__namebtn").boundingBox();
    const ox = Math.round(box.x + box.width / 2);
    const oy = Math.round(box.y + box.height / 2);
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
    const context = card.querySelector(".fcard__context");
    return {
      scrolls: getComputedStyle(context).overflowY === "auto",
      touch: getComputedStyle(card).touchAction,
      wellScrolls: (() => { const w = card.querySelector(".focus-shelf");
        return w.scrollHeight > w.clientHeight + 1 })(),
    };
  });
  assert(
    scrollPolicy.scrolls &&
      scrollPolicy.touch === "pan-y pinch-zoom" && !scrollPolicy.wellScrolls,
    "the context above the shelf is the only scrolling region of the card",
    JSON.stringify(scrollPolicy),
    "Focus → vertical gestures scroll the ledger; nothing else is claimed"
  );
  while ((await page.evaluate(() => window.__repforgeFocus.at())) > 0) {
    await page.evaluate(() => window.__repforgeFocus.go(-1));
    await page.waitForTimeout(450);
  }
  assert(
    await page.evaluate(() => window.__repforgeFocus.at() === 0 && !window.__repforgeFocus.go(-1)),
    "the deck stops at the first exercise",
    `at=${await page.evaluate(() => window.__repforgeFocus.at())}`,
    "Focus → first exercise → a step back has nowhere to go"
  );
  // The card is screen-height: same box on every exercise, with the page itself
  // never scrolling and the well pinned in view.
  const cardMetrics = () =>
    page.evaluate(() => {
      const card = document.querySelector("#workout .exercise.is-current").getBoundingClientRect();
      const well = document.querySelector("#workout .exercise.is-current .focus-shelf")?.getBoundingClientRect();
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
  await page.evaluate(() => window.__repforgeFocus.go(1));
  await page.waitForTimeout(450);
  const sizeSecond = await cardMetrics();
  await page.evaluate(() => window.__repforgeFocus.go(-1));
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
    const ledger = document.querySelector("#workout .exercise.is-current .fcard__context").getBoundingClientRect();
    const save = document.querySelector("#workout .exercise.is-current .focus-shelf .saveset").getBoundingClientRect();
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
      const ledgerBox = card.querySelector(".fcard__context").getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const save = card.querySelector(".focus-shelf .saveset");
      const saveBox = save?.getBoundingClientRect();
      return {
        wellH: card.querySelector(".focus-shelf").offsetHeight,
        cueLines: card.querySelector(".fx-cue") ? 1 : 0,
        spill: card.scrollHeight - card.clientHeight,
        saveWhole: !!saveBox && saveBox.bottom <= cardBox.bottom + 1 && saveBox.height >= 44,
        rowsWhole: [...card.querySelectorAll(".ledgerline:not(.ledgerline__head)")].filter((r) => {
          const b = r.getBoundingClientRect();
          return b.top >= ledgerBox.top - 1 && b.bottom <= ledgerBox.bottom + 1;
        }).length,
      };
    });
  // Clean-fixture reset: drop the harness's prefills and every V2 sidecar so
  // the card behaves like a fresh session.
  await clearDraftFixture(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  await page.waitForTimeout(260);
  const fitBefore = await fitMetrics();
  await page.evaluate(() => {
    const cur = document.querySelector("#workout .exercise.is-current");
    const key = cur.querySelector(".focus-shelf .shelf__field").dataset.set;
    for (const [suffix, val] of [["metric_2555c6f170d8805cafa6d16d3fdddbaa", 90], ["metric_2555c6f170d88072bbf6d9ad3f16ea86", 6], ["rir", 1]]) {
      const el = cur.querySelector(`.focus-shelf [data-k="${key}_${suffix}"]`);
      if (!el) continue;
      el.value = String(val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    cur.querySelector(".focus-shelf .saveset").click();
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
    "the shelf keeps its height when a set lands",
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

  // Focus carries the per-exercise controls: last session's numbers and skip.
  // A fresh card for an exercise with history: last session is what it leads on.
  await clearDraftFixture(page);
  // An earlier phase left a rest running; the fresh card is read with none, so the clock is not in it yet.
  await page.evaluate(() => window.stopRest?.());
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  await page.waitForTimeout(300);
  const lastSession = await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const past = [...card.querySelectorAll(".ledgerline__prev")];
    return {
      label: past[0]?.textContent?.trim() || "",
      rows: past.length,
      firstRow: past[0] ? (past[0].textContent.match(/(\d+(?:[.,]\d+)?) \u00d7 (\d+)/) || []).slice(1) : [],
      head: [...card.querySelectorAll(".ledgerline__head .fx-col")].map((s) => s.textContent.replace(/\s+/g, " ").trim()),
      more: !!document.querySelector("#woOverflowBtn"),
      tools: card.querySelectorAll(".focus-ex__tools .focus-tool").length,
      restInCard: card.querySelectorAll(".restinline, .ex__rest").length,
    };
  });
  assert(
    lastSession.rows > 0 && lastSession.label &&
      /^\d/.test(lastSession.firstRow[0] || "") && /kg|lb/i.test(lastSession.head[0] || ""),
    "the focus card shows last session's load, reps and RIR",
    JSON.stringify(lastSession),
    "Focus → an exercise with history lists what was lifted last time"
  );
  assert(
    lastSession.tools === 0 && lastSession.more && lastSession.restInCard === 0,
    "the focus card leaves note, actions, and skip to the header's three-dot button; no rest block is in the card until a rest runs",
    JSON.stringify(lastSession),
    "Focus → the workout header holds one three-dot button and the card holds no tools or timer of its own before a set is logged"
  );
  const beforeSkip = await page.evaluate(() => ({
    ex: document.querySelector("#workout .exercise.is-current")?.dataset.ex,
    count: document.querySelectorAll("#woProgress .segbar--ex .segbar__seg").length,
  }));
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionSkipBtn").click();
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
    if (window.__repforgeFocus.at() > 0) window.__repforgeFocus.go(-1);
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
      const key = cur?.querySelector(".focus-shelf .shelf__field")?.dataset.set;
      if (!key) return false;
      for (const [suffix, val] of [["metric_2555c6f170d8805cafa6d16d3fdddbaa", 90], ["metric_2555c6f170d88072bbf6d9ad3f16ea86", 6], ["rir", 1]]) {
        const el = cur.querySelector(`.focus-shelf [data-k="${key}_${suffix}"]`);
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
        const logged = card?.querySelectorAll(".ledgerline[data-editn]").length || 0;
        return logged
          ? { logged, rec: card.querySelectorAll(".recblock").length,
              // The set just logged armed a rest: until it ends, the cue's place holds the next set's line.
              cue: card.querySelector(".fx-cue, .restinline__next")?.textContent?.trim() || "" }
          : null;
      });
    }
    let acted = false;
    if (await fillCurrentFocusSet()) {
      acted = await page.evaluate(() => {
        const b = document.querySelector("#workout .exercise.is-current .focus-shelf .saveset");
        if (b) { b.click(); return true; }
        return false;
      });
    }
    if (!acted) {
      acted = await page.evaluate(() => {
        const f = window.__repforgeFocus;
        if (f.at() < f.list().length - 1) { f.go(1); return true; }
        return false;
      });
    }
    if (!acted) break;
    await page.waitForTimeout(280);
  }
  assert(
    recAfterLog && recAfterLog.logged > 0 && recAfterLog.rec === 0 && !!recAfterLog.cue,
    "the recommendation stays as the card's cue once a set is logged",
    JSON.stringify(recAfterLog),
    "Focus → log a set → no duplicate recommendation block and the cue names the next set"
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


  beginPhase("Phase: workout entry CTA + transition");
  await clearDraftFixture(page);
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
    // A transition is the N5 page push (Focus rides over Today as `is-push-over`,
    // in on Start and out on Back) or, where the push stands down, the panel animation.
    window.__animSeen = { enter: false, leave: false };
    window.__animPhase = "enter";
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target, phase = window.__animPhase;
        const pushed = el.id === "workoutShell" && el.classList.contains("is-push-over");
        if (phase === "enter" && (pushed || (el.id === "workoutShell" && el.classList.contains("wo-anim-enter")))) window.__animSeen.enter = true;
        if (phase === "leave" && (pushed || (el.id === "todayDash" && el.classList.contains("wo-anim-leave")))) window.__animSeen.leave = true;
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
  await page.evaluate(() => { window.__animPhase = "leave"; window.__repforgeLeaveWorkout?.(); });
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
  await flushDraftWork(page);
  const resumedCtaDraft = await readDraft(page);
  assert(
    (await getState(page)) &&
      resumedCtaDraft?.draftId &&
      resumedCtaDraft.exerciseOrder.some((id) =>
        Object.values(resumedCtaDraft.exercises[id]?.sets || {}).some((set) => set.edited?.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] === "80")),
    "Continue workout resumes the in-progress draft",
    "draft load 80 missing after resume",
    "Today → Continue workout → previously entered sets are still there"
  );
  await clearDraftFixture(page);
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
    "Stats has one tab row of five (Plan 064 R3i)",
    `button count=${segBtnCount}`,
    "Stats tab → inspect #statsSeg buttons"
  );
  const segLabels = await page.locator("#statsSeg button").allTextContents();
  assert(
    ["Overview", "Strength", "Volume", "PRs", "Review"].every((label) => segLabels.includes(label)),
    "The tab row carries Overview, Strength, Volume, PRs and Review",
    `labels=${segLabels.join(",")}`,
    "Stats tab → tab labels"
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
    /week (\d+ of \d+ )?in progress|building baseline/i.test(thisWeekText) &&
      !/\b(improved|stable|attention)\b/i.test(thisWeekText),
    "This Week card shows neutral in-progress status",
    `text=${thisWeekText.slice(0, 80)}`,
    "Stats → Overview → #thisWeek shows current-week progress without an outcome label"
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
        programMeta: {
          ...f2State.programMeta,
          name: "F2 Split",
          started: "2026-08-10",
          mesocycleLengthWeeks: 5,
          mesocycleStatus: "active",
          programStructure: null,
        },
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
      const progressText = await f2Page.locator('#thisWeek [data-week-metric="sessions"] .ovtotal__val').textContent();
      assert(
        progressText.replace(/\s+/g, "") === "3/5",
        "F2: Progress This week shows the current program-week progress",
        `progress="${progressText.replace(/\s+/g, " ").slice(0, 160)}"`,
        "Stats → Overview → #thisWeek counts the three sessions in the current program week"
      );
      await f2Page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
        document.querySelector('nav button[data-view="program"]')?.click();
      });
      await f2Page.waitForSelector("#programOverview", { timeout: 5000 });
      const overviewStatus = (await f2Page.locator("#programOverview .prog-overview__status").textContent()).trim();
      assert(
        /4 of 5 in the last 7 days/.test(overviewStatus),
        "F2: Program days status shows rolling 4 of 5",
        `status="${overviewStatus}"`,
        "Program overview → status line"
      );
      assert(
        !/this week/i.test(overviewStatus),
        "F2: Program overview names a rolling 7-day window",
        `status="${overviewStatus}"`,
        "Program overview → status line"
      );
      const afterEn = await getState(f2Page);
      await persistState(f2Page, { ...afterEn, settings: { ...afterEn.settings, lang: "pt" } });
      await reloadApp(f2Page);
      await f2Page.evaluate(() => {
        document.body.classList.remove("is-settings", "is-exercise", "is-onboarding", "is-workout");
        document.querySelector('nav button[data-view="program"]')?.click();
      });
      await f2Page.waitForSelector("#programOverview", { timeout: 5000 });
      const ptStatus = (await f2Page.locator("#programOverview .prog-overview__status").textContent()).trim();
      assert(
        /4 de 5 nos últimos 7 dias/.test(ptStatus),
        "F2: Program overview rolling status is Portuguese",
        `status="${ptStatus}"`,
        "lang=pt → Program overview → status line"
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
    higherLoadFewerReps.status === "improved",
    "Session delta: higher load + fewer reps, e1RM up more than 1% → improved",
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

  // Session outcome rule (CONTEXT.md): one case per row of the owner-approved table.
  const outcomeRows = (session, load, reps, rirs) => reps.map((r, i) => deltaFix(session, i + 1, load, r, rirs[i]));
  const outcomeCases = [
    ["prescribed load increase with the expected rep drop reads flat, not regressed",
      outcomeRows("s1", 100, [8, 8, 8], [1, 1, 0]), outcomeRows("s2", 102.5, [7, 6, 6], [1, 1, 0]), "flat"],
    ["load up, e1RM more than 1% lower → regressed",
      outcomeRows("s1", 100, [8], [1]), outcomeRows("s2", 105, [5], [1]), "regressed"],
    ["same load, fewer total reps, same best set → regressed (was changed_load)",
      outcomeRows("s1", 25, [10, 9, 9], [1, 1, 0]), outcomeRows("s2", 25, [10, 9, 8], [1, 1, 0]), "regressed"],
    ["same load, same total reps, weaker best set → flat",
      outcomeRows("s1", 100, [10, 8, 8], [1, 1, 1]), outcomeRows("s2", 100, [9, 9, 8], [1, 1, 1]), "flat"],
    ["load down, more volume at similar effort → improved",
      outcomeRows("s1", 100, [8, 8, 8], [1, 1, 1]), outcomeRows("s2", 95, [10, 10, 10], [1, 1, 1]), "improved"],
    ["load down, e1RM more than 1% higher → improved",
      outcomeRows("s1", 100, [5], [1]), outcomeRows("s2", 97.5, [8], [1]), "improved"],
    ["deload (lower load, less work) → changed_load, never regressed",
      outcomeRows("s1", 100, [8, 8, 8], [1, 1, 0]), outcomeRows("s2", 90, [8, 8, 8], [2, 2, 2]), "changed_load"],
  ];
  for (const [label, prev, cur, expected] of outcomeCases) {
    const result = await runDelta(prev, cur);
    assert(result.status === expected, `Session outcome: ${label}`, `status=${result.status}`, `expected ${expected}`);
  }

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
    state.programMeta.mesocycleLengthWeeks === state.programMeta.programDefinition?.cycles &&
      state.programMeta.mesocycleStatus === "active" &&
      state.programMeta.onboarded === true,
    "P4: programMeta block length follows the definition's cycles, active and onboarded",
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

    // Plan 056: End block routes into the single Progress → Review surface.
    // No separate confirm or full-screen dialog opens along the way.
    const openProgressReview = async () => {
      await nav(page, "program");
      await applyProgramEditor(page);
      await page.click("#reviewBlockLink");
      await page.waitForSelector("#stats.view.active", { timeout: 5000 });
      await page.waitForFunction(() => document.querySelector('#statsSeg button[data-seg="review"]')?.classList.contains("active"), null, { timeout: 5000 });
      await page.waitForFunction(() => !document.querySelector("#endBlockConfirm")?.open);
      return (await page.locator("#reviewPanel").textContent()) || "";
    };
    const routeOk = async () => {
      const st = await page.evaluate(() => ({
        reviewSeg: document.querySelector('#statsSeg button[data-seg="review"]')?.classList.contains("active"),
        overviewSeg: document.querySelector('#statsSeg button[data-seg="overview"]')?.classList.contains("active"),
        panelVisible: document.querySelector("#segReview")?.classList.contains("active"),
        confirmOpen: !!document.querySelector("#endBlockConfirm")?.open,
        dialogOpen: !!document.querySelector("#blockReview")?.open,
      }));
      return st.reviewSeg && !st.overviewSeg && st.panelVisible && !st.confirmOpen && !st.dialogOpen;
    };

    let panel = await openProgressReview();
    assert(
      await routeOk(),
      "F8: End block routes to the single Progress → Review surface",
      JSON.stringify(await page.evaluate(() => ({ stats: document.querySelector("#stats")?.classList.contains("active"), confirm: !!document.querySelector("#endBlockConfirm")?.open, dialog: !!document.querySelector("#blockReview")?.open }))),
      "End block → Progress → Review, no competing dialog"
    );
    assert(
      /Week 6 of 6/.test(panel) && /ready for review/i.test(panel) && !/Block complete/i.test(panel) && !overrunText(panel) && !/Week 8 of 6/.test(panel),
      "F8: routed Review copy stays clamped and not completed while active",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "#reviewPanel at active week 8 of 6"
    );
    const afterLater = (await getState(page)).programMeta.mesocycleStatus;
    assert(
      afterLater === "active",
      "F8: read-only Review leaves the mesocycle active",
      `status=${afterLater}`,
      "Review route at week 8 of 6"
    );

    f8 = await getState(page);
    await persistState(page, { ...f8, settings: { ...f8.settings, lang: "pt" } });
    await reloadApp(page);
    panel = await openProgressReview();
    assert(
      await routeOk(),
      "F8: PT End block routes to the single Progress → Review surface",
      JSON.stringify(await page.evaluate(() => ({ confirm: !!document.querySelector("#endBlockConfirm")?.open, dialog: !!document.querySelector("#blockReview")?.open }))),
      "lang=pt → End block → Progress → Review"
    );
    assert(
      /Semana 6 de 6/.test(panel) && /pronta para revisão/i.test(panel) && !/Bloco concluído/i.test(panel) && !overrunText(panel) && !/Semana 8 de 6/.test(panel),
      "F8: PT routed Review copy stays clamped and not completed while active",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "lang=pt → #reviewPanel at active week 8 of 6"
    );
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

    panel = await openProgressReview();
    assert(
      await routeOk(),
      "F8: stored-completed End block still routes to the single Review surface",
      JSON.stringify(await page.evaluate(() => ({ confirm: !!document.querySelector("#endBlockConfirm")?.open, dialog: !!document.querySelector("#blockReview")?.open }))),
      "End block → Progress → Review at mesocycleStatus=completed"
    );
    assert(
      /Block complete/i.test(panel) && !/Week 8 of 6/.test(panel) && !overrunText(panel),
      "F8: completed routed Review keeps week displays clamped",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "#reviewPanel when stored-completed"
    );
    const reviewActions = await page.evaluate(() =>
      [...document.querySelectorAll("#reviewPanel [data-review-action]")].map((b) => b.dataset.reviewAction));
    assert(
      reviewActions.includes("repeat"),
      "F8: completed block Review exposes the literal repeat structural action",
      `actions=${reviewActions.join(",")}`,
      "#reviewPanel actions at block-complete"
    );
    assert(
      // A recovery week is the lifter's call (Plan 067), so it is offered at
      // every block end; only the performance-derived progress stays gated.
      ["schedule-repair", "reduce-volume", "guided-edit", "recovery-week"].every((kind) => reviewActions.includes(kind)) &&
        !reviewActions.includes("progress"),
      "F8: wired structural actions render while evidence-ineligible actions stay absent",
      `actions=${reviewActions.join(",")}`,
      "completed block with insufficient performance and recovery evidence"
    );

    await persistState(page, { ...(await getState(page)), settings: { ...(await getState(page)).settings, lang: "pt" } });
    await reloadApp(page);
    panel = await openProgressReview();
    assert(
      /Bloco concluído/i.test(panel) && !/pronta para revisão/i.test(panel) && !/Semana 8 de 6/.test(panel),
      "F8: PT completed routed Review is Bloco concluído",
      `panel="${panel.replace(/\s+/g, " ").slice(0, 220)}"`,
      "lang=pt → #reviewPanel when stored-completed"
    );
    await page.waitForFunction(() => !document.querySelector("#blockReview")?.open);
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
  // Plan 056: End block routes into the single Progress → Review surface.
  // No separate confirm or full-screen dialog opens along the way.
  await nav(page, "program");
  await applyProgramEditor(page);
  await page.click("#reviewBlockLink");
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  await page.waitForFunction(() => document.querySelector('#statsSeg button[data-seg="review"]')?.classList.contains("active"), null, { timeout: 5000 });
  assert(
    await page.evaluate(() => !document.querySelector("#endBlockConfirm")?.open && !document.querySelector("#blockReview")?.open),
    "P8: End block routes to Review with no competing dialog",
    JSON.stringify(await page.evaluate(() => ({ confirm: !!document.querySelector("#endBlockConfirm")?.open, dialog: !!document.querySelector("#blockReview")?.open }))),
    "End block → Progress → Review, dialogs stay closed"
  );
  const KNOWN_RECOMMENDATIONS = [
    "repeat_or_progress",
    "repeat_with_small_swaps",
    "reduce_volume_or_deload",
    "keep_program_improve_completion",
    "repeat_with_simpler_schedule",
  ];
  assert(
    KNOWN_RECOMMENDATIONS.includes(blockReview.recommendation),
    "P8: buildBlockReview returns a known recommendation key",
    `recommendation=${blockReview.recommendation}`,
    "recommendation vocabulary stays closed"
  );

  beginPhase("Phase: P9 next-block flow");
  // A live workout blocks a block start; this step is about the block itself.
  await clearDraftFixture(page);
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeStorage.flush());
  await page.waitForFunction(() => typeof window.__repforgeCommitNextBlock === "function");
  const p9Before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("repforge_v1"));
    return {
      revision: s._storageRevision || 0,
      historyLen: s.programHistory.length,
      metaId: s.programMeta.id,
      blockId: s.programMeta.blockId || null,
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
  const p9Result = await page.evaluate(() => window.__repforgeCommitNextBlock("repeat"));
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
      blockId: s.programMeta.blockId || null,
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
    "__repforgeCommitNextBlock(repeat) → accepted local/idb result at revision +1"
  );
  // Plan 056: the legacy program-altering strategies are gone. The literal
  // repeat keeps the program identity and prescription into a fresh block —
  // nothing is archived because nothing is replaced — and structural change
  // goes through Plan 052 proposals only.
  assert(
    p9After.metaId === p9Before.metaId &&
      p9After.blockId !== p9Before.blockId &&
      p9After.historyLen === p9Before.historyLen &&
      p9After.archivedCount === 0 &&
      p9After.status === "active" &&
      p9After.started === p9Today &&
      p9After.sets.length === p9Before.sets.length &&
      p9After.sets.every((n, i) => n === p9Before.sets[i].sets),
    "P9: literal repeat rolls the block identity with the prescription unchanged",
    JSON.stringify({
      metaId: p9After.metaId === p9Before.metaId,
      blockRolled: p9After.blockId !== p9Before.blockId,
      history: `${p9Before.historyLen} → ${p9After.historyLen}`,
      started: p9After.started,
      sets: p9After.sets.join(","),
    }),
    "commitNextBlock(repeat) → same program, new blockId, no archive"
  );

  // Generation (P5) and the retired family/equipment-correction compiler (F4)
  // are owned by test/generate-program-browser.mjs and the compiler proofs.
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
    state.programMeta?.name === "Your 3-day program",
    "P6: generated programs receive a human-readable name",
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
  const deltaSummary = (await saveWorkout(page, { earlyFinish: true })) || "";
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
    /OUTCOME AND NEXT TARGET\s+Hack squat\s+Improved/i.test(deltaSummary) &&
      !/\b\d+\s+improved\b/i.test(deltaSummary),
    "Session summary uses canonical outcome rows without a second delta count",
    `Summary: ${JSON.stringify(deltaSummary)}`,
    "Summary should keep the OUTCOME BY LIFT Improved row without inventing a local count"
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
  await page.locator("#sessions .session__open").first().click();
  await page.waitForSelector(".session--read .histlift__tags .verdictmark");
  const deltaPage = await page.locator(".session--read").first().textContent();
  assert(
    /improved/i.test(deltaPage),
    "History session page shows the improved outcome",
    `Page: ${deltaPage?.slice(0, 160)}`,
    "History → open the newest session after an improved session"
  );
  assert(
    (await page.locator(".session--read [data-parity-outcome]").count()) > 0,
    "History session page marks its outcome words for the parity gate",
    "No [data-parity-outcome] on the session page",
    "History → session page outcome words carry the parity markup"
  );
  await page.click("[data-history-back]");

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
  await clearDraftFixture(page);
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
      (await readSimField(page, `${cmdEx0}_1_load`)) === "80" &&
      (await readSimField(page, `${cmdEx0}_1_reps`)) === "8" &&
      (await readSimField(page, `${cmdEx0}_1_rir`)) === "1",
    "spoken set: 80 x 8 @1 fills set 1",
    `applied=${applied1} load=${await readSimField(page, `${cmdEx0}_1_load`)} reps=${await readSimField(page, `${cmdEx0}_1_reps`)} rir=${await readSimField(page, `${cmdEx0}_1_rir`)}`,
    "Log → say 80 x 8 @1 → set 1 inputs updated"
  );
  await applyCmd("set 2 60 x 10");
  await page.waitForTimeout(120);
  assert(
    (await readSimField(page, `${cmdEx0}_2_load`)) === "60" &&
      (await readSimField(page, `${cmdEx0}_2_reps`)) === "10",
    "spoken set: set 2 60 x 10 targets set 2",
    `load=${await readSimField(page, `${cmdEx0}_2_load`)} reps=${await readSimField(page, `${cmdEx0}_2_reps`)}`,
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
    (await readSimField(page, `${cmdEx0}_1_load`)) === "75" &&
      (await readSimField(page, `${cmdEx0}_1_reps`)) === "7",
    "spoken set still applies with voice setting enabled",
    `load=${await readSimField(page, `${cmdEx0}_1_load`)} reps=${await readSimField(page, `${cmdEx0}_1_reps`)}`,
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
  const summaryInPanel = await page.locator(".review__readonly").textContent();
  assert(
    summaryInPanel && summaryInPanel.length > 20,
    "P16: active Review panel states its read-only checkpoint",
    summaryInPanel?.slice(0, 120),
    "Stats → Review → active block exposes the read-only note"
  );

  beginPhase("Phase: strength dashboard (P12)");
  await resetWithSeedProgram(page);
  await seedHistoricalLog(page);
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="strength"]');
  await page.waitForTimeout(80);
  assert(
    (await page.locator("#strengthDash .evrow").count()) > 0,
    "Strength evidence renders summary rows",
    "No .evrow inside #strengthDash",
    "Stats → Strength evidence → summary rows"
  );
  const loggedExercise = await page.evaluate(() => window.__repforgeStrengthDashboard()[0]?.exercise || "");
  const evRow = page.locator("#strengthDash .evrow", { hasText: loggedExercise }).first();
  await evRow.click();
  const drillRows = await page.locator("#strengthDash .evrow__detail:not([hidden]) table tbody tr").count();
  assert(
    drillRows > 0,
    "Strength drill-in reveals the complete evidence table",
    `row count=${drillRows}`,
    "Stats → Strength → drill-in table rows"
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
    (await page.locator("#volumeDash .vrow").count()) > 0,
    "#volumeDash has evidence rows",
    "No .vrow in #volumeDash",
    "Stats → Volume evidence → muscle rows"
  );
  const periodText = await page.evaluate(() => document.querySelector("#volumePeriod")?.textContent || "");
  const started = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_v1")).programMeta.started || null);
  const periodOk = started ? /From /.test(periodText) : /No block period/.test(periodText);
  assert(
    periodOk,
    "Volume evidence states its period bounds (or honest absence) in accessible text",
    `period="${periodText}" started=${started}`,
    "Stats → Volume → period text"
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
  await saveWorkout(page, { earlyFinish: true });
  await setLogDate(page, "2026-01-16");
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 10, 2);
  await saveWorkout(page, { earlyFinish: true });
  await nav(page, "stats");
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.click('#strengthScopeSeg button[data-scope="all-history"]');
  await page.waitForTimeout(150);
  const strengthWord = await page.locator(`#strengthDash .evword[data-parity-outcome="${browseEx.id}"]`).first().textContent().catch(() => "");
  assert(
    /Improved|Maintained|Declined|Changed load|Not comparable/.test(strengthWord || ""),
    "Strength row names the lift's session outcome from the same comparison",
    `Content: ${strengthWord || "(missing)"}`,
    "Seed 2+ comparable sessions with working sets, then Stats → Strength"
  );
  await nav(page, "log");
  await selectDay(page, browseDay);
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 12, 2);
  await page.waitForTimeout(100);
  const retiredDelta = await page.evaluate((exId) => {
    const card = document.querySelector(`#workout [data-ex="${exId}"]`);
    return {
      card: !!card,
      element: !!card?.querySelector(".delta-prev"),
      text: /Change (from|since) last session|Mudan[çc]a desde a última sessão/i.test(card?.textContent || ""),
    };
  }, browseEx.id);
  assert(
    retiredDelta.card && !retiredDelta.element && !retiredDelta.text,
    "Focus card carries no change-since-last-session line (retired)",
    `Card: ${retiredDelta.card}, element: ${retiredDelta.element}, text: ${retiredDelta.text}`,
    "The Focus card shows the cue and the ledger only; the comparison lives in the session summary"
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
  await selectFocusExercise(page, noteEx.id);
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionNotesBtn").click();
  await page.locator("#exNoteSheet.is-open").waitFor({ state: "visible" });
  await page.fill("#exNoteText", NOTE_TEXT);
  await page.click("#exNoteSave");
  await page.locator("#exNoteSheet").waitFor({ state: "hidden" });
  await flushDraftWork(page);
  const noteDraft = await page.evaluate(() => {
    try {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      return Object.fromEntries((draft?.exerciseOrder || []).map((id) => [id, draft.exercises[id]?.setupNotes || ""]));
    } catch {
      return {};
    }
  });
  assert(
    noteDraft[noteEx.id] === NOTE_TEXT,
    "Exercise note is kept in the draft",
    `Draft notes: ${JSON.stringify(noteDraft)}`,
    "Log tab → exercise card → Note → type"
  );
  const noteSessionsBeforeSave = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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
  await selectFocusExercise(page, noteEx.id);
  await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionNotesBtn").click();
  await page.locator("#exNoteSheet.is-open").waitFor({ state: "visible" });
  const notePrefill = await page.inputValue("#exNoteText");
  await page.click("#exNoteCancel");
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
  await clearDraftFixture(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const draftMeta = await getExerciseMeta(page, "Day 1");
  const draftExA = draftMeta[0];
  const draftExSkip = draftMeta[1];
  const subIds = draftMeta.map(ex => ex.id);
  const draftExB = draftMeta.find((ex) => ex.id !== draftExA.id && ex.id !== draftExSkip.id && subIds.includes(ex.id)) || draftMeta.find((ex) => subIds.includes(ex.id) && ex.id !== draftExA.id) || draftMeta[2];
  const otherDay = await page.evaluate(() =>
    [...document.querySelectorAll("#dayTabs button")].map((b) => b.dataset.day).find((d) => d !== "Day 1")
  );
  const sessionNote = "Draft session note";
  const nonToday = "2024-02-29";
  await page.evaluate((v) => {
    const el = document.querySelector("#sessionNotes");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, sessionNote);
  await page.evaluate((v) => {
    const el = document.querySelector("#sessionBodyweight");
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, "82.5");
  await setLogDate(page, nonToday);
  await fillExerciseSets(page, draftExB.id, 1, 40, 8, 1);
  await exerciseAction(page, `${draftExSkip.id}`, "#exActionSkipBtn");
  // Swap from the library before logging into it: a library swap never
  // reprograms sets the lifter has already typed into.
  await exerciseAction(page, `${draftExA.id}`, "#exActionSubstBtn");
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
  await fillExerciseSets(page, draftExA.id, 1, 77, 6, 1);
  // Swap to something the library has never heard of. The typed search carries
  // into the custom sheet, which is the path that replaced the old prompt().
  const customName = "Custom swap 80 cap check";
  await exerciseAction(page, `${draftExB.id}`, "#exActionSubstBtn");
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
  await flushDraftWork(page);
  await page.evaluate(() => window.__repforgeLeaveWorkout?.());
  await reloadApp(page);
  await page.waitForSelector("#workoutShell:not(.hidden), #workout .exercise", { timeout: 5000 });
  const autoResumed = await page.evaluate(() => !document.querySelector("#workoutShell")?.classList.contains("hidden"));
  if (!autoResumed) {
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    await page.click("#startWorkout");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
  }
  const resumed = await page.evaluate(({ a, skip, b }) => {
    const d = window.__repforgeWorkoutDraft?.current?.();
    const firstSetId = d?.exercises?.[a]?.setOrder?.[0];
    const skipped = d?.exercises?.[skip];
    return {
      load: firstSetId ? d.exercises[a].sets[firstSetId]?.edited?.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] : undefined,
      note: document.querySelector("#sessionNotes")?.value,
      bw: document.querySelector("#sessionBodyweight")?.value,
      date: document.querySelector("#sessionDate")?.value,
      skipped: skipped?.status === "skipped" || (window.__repforgeWorkoutDraft.current()?.exercises?.[skip]?.status === "skipped"),
      subA: d?.exercises?.[a]?.substitution?.replacement?.displayName,
      subB: d?.exercises?.[b]?.substitution?.replacement?.displayName,
      day: d?.program?.dayLabel,
    };
  }, { a: draftExA.id, skip: draftExSkip.id, b: draftExB.id });
  assert(
    resumed.load === "77" && resumed.note === sessionNote && resumed.bw === "82.5" && resumed.date === nonToday,
    "Resumed Focus draft keeps set, note, bodyweight, and date",
    JSON.stringify(resumed),
    "Log values + leave + reload + Continue"
  );
  assert(
    resumed.skipped && resumed.subA === altName && resumed.subB === customName && resumed.day === "Day 1",
    "Resumed list draft keeps skip and substitutions",
    JSON.stringify(resumed),
    "Skip + sub + reload + Continue"
  );

  const draftBeforeFinish = await readDraft(page);
  const beforeFinish = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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

  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  await flushDraftWork(page);
  const afterFinishDraft = await readDraft(page);
  const fresh = await page.evaluate(({ a, b, skip }) => ({
    subA: window.__repforgeWorkoutDraft.projection().__substituted?.[a] || "",
    skipped: (window.__repforgeWorkoutDraft.current()?.exercises?.[skip]?.status === "skipped"),
    note: document.querySelector("#sessionNotes")?.value,
    date: document.querySelector("#sessionDate")?.value,
  }), { a: draftExA.id, b: draftExB.id, skip: draftExSkip.id });
  assert(
    afterFinishDraft?.draftId && afterFinishDraft.draftId !== draftBeforeFinish?.draftId &&
      afterFinishDraft.revision === 0 && !fresh.skipped && !fresh.subA && !fresh.note && fresh.date === (await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })),
    "Accepted finish clears substitution/date/note context for the next workout",
    JSON.stringify({ fresh, oldDraftId: draftBeforeFinish?.draftId, newDraftId: afterFinishDraft?.draftId }),
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
    await flushDraftWork(page);
    return page.evaluate((k) => ({
      mode: JSON.parse(localStorage.getItem(k) || "{}")?.settings?.rirMode,
      radio: document.querySelector('input[name="rirMode"]:checked')?.value,
      draft: window.__repforgeWorkoutDraft?.read?.().raw ?? null,
    }), KEY);
  }
  await clearDraftFixture(page);
  await reloadApp(page);
  await clickRir("effort");
  let rs = await rirState();
  assert(rs.mode === "effort" && rs.radio === "effort", "RIR change with no draft succeeds", JSON.stringify(rs), "Settings → effort with empty draft");
  await clickRir("numeric");

  const rirCases = [
    ["committed", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await fillExerciseSets(page, draftExA.id, 1, 41, 5, 1); await clickSaveSet(page, `${draftExA.id}_1`); }],
    ["warmup", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await toggleWarmup(page, draftExA.id, 1); }],
    ["substitution-only", async () => {
      await nav(page, "log"); await selectDay(page, "Day 1");
      await exerciseAction(page, `${draftExA.id}`, "#exActionSubstBtn");
      await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
      await page.evaluate(() => {
        const slot = (document.querySelector("#exPickFor")?.textContent || "").trim();
        const rows = [...document.querySelectorAll("#exPickList .pickrow")];
        (rows.find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim() !== slot) || rows[0])?.click();
      });
      await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    }],
    ["note-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#sessionNotes"); el.value = "only"; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
    ["bodyweight-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#sessionBodyweight"); el.value = "70"; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
    ["date-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await setLogDate(page, "2026-01-15"); }],
    ["day-only", async () => { await nav(page, "log"); await selectDay(page, otherDay); }],
    ["skip-only", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await exerciseAction(page, `${draftExSkip.id}`, "#exActionSkipBtn"); }],
    ["cleared-context", async () => { await nav(page, "log"); await selectDay(page, "Day 1"); await page.evaluate(() => { const el = document.querySelector("#sessionNotes"); el.value = "x"; el.dispatchEvent(new Event("input", { bubbles: true })); el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }); }],
  ];
  for (const [name, setup] of rirCases) {
    await clearDraftFixture(page);
    await reloadApp(page);
    await setup();
    const raw = await readDraftRaw(page);
    await clickRir("effort");
    rs = await rirState();
    assert(
      rs.mode !== "effort" && rs.radio === "numeric" && rs.draft === raw,
      `RIR change with ${name} progress is refused and preserves the raw draft`,
      JSON.stringify({ name, mode: rs.mode, radio: rs.radio, same: rs.draft === raw, rawLen: raw?.length }),
      `Seed ${name} progress → Settings → effort`
    );
  }

  await clearDraftFixture(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await selectDay(page, otherDay);
  const dayOnlyRaw = await readDraftRaw(page);
  await requestVisibleDay(page,"Day 1");
  await answerDiscardQuestion(page,"keep");
  const dayAfterCancel = await page.evaluate(() => ({
    raw: window.__repforgeWorkoutDraft?.read?.().raw ?? null,
    active: document.querySelector("#dayTabs button.active")?.dataset.day,
  }));
  assert(
    dayAfterCancel.active === otherDay && dayAfterCancel.raw === dayOnlyRaw,
    "Day-only progress asks before switching and Cancel preserves the exact draft/day",
    JSON.stringify({ active: dayAfterCancel.active, same: dayAfterCancel.raw === dayOnlyRaw }),
    `${otherDay} day-only draft → Day 1 → Cancel`
  );
  await requestVisibleDay(page,"Day 1");
  await answerDiscardQuestion(page,"discard");
  await page.waitForFunction(() => document.querySelector("#dayTabs button.active")?.dataset.day === "Day 1");
  const dayAfterConfirm = await readDraft(page);
  assert(
    dayAfterConfirm?.program?.dayLabel === "Day 1",
    "Confirming a day-only transition discards the old context and saves the new day",
    JSON.stringify(dayAfterConfirm),
    `${otherDay} day-only draft → Day 1 → Confirm`
  );

  await clearDraftFixture(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
      await exerciseAction(page, `${draftExSkip.id}`, "#exActionSkipBtn");
      await flushDraftWork(page);
      await page.waitForFunction((id) => {
        const draft = window.__repforgeWorkoutDraft?.current?.();
        return draft?.exercises?.[id]?.status === "skipped" &&
          (window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.status === "skipped");
      }, draftExSkip.id, { timeout: 5000 });
      await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  assert(
    await page.evaluate((id) => (window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.status === "skipped"), draftExSkip.id),
    "Direct skip survives reload",
    "skip class missing",
    "Skip → reload"
  );
  if (await page.locator(".skipbar__show").count()) {
    await page.click(".skipbar__show");
    await flushDraftWork(page);
    await page.waitForFunction((id) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      return draft?.exercises?.[id]?.status !== "skipped" &&
        !(window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.status === "skipped");
    }, draftExSkip.id, { timeout: 5000 });
  }
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  assert(
    !(await page.evaluate((id) => (window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.status === "skipped"), draftExSkip.id)),
    "Show all survives reload as unskipped",
    "still skipped",
    "Show all → reload"
  );

  if (otherDay) {
    await clearDraftFixture(page);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 55, 5, 1);
    const rawDay = await readDraftRaw(page);
    const currentDay = await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day);
    await requestVisibleDay(page,otherDay);
    await answerDiscardQuestion(page,"keep");
    await flushDraftWork(page);
    const cancelled = await page.evaluate(() => ({
      draft: window.__repforgeWorkoutDraft?.read?.().raw ?? null,
      day: document.querySelector("#dayTabs button.active")?.dataset.day,
    }));
    assert(
      cancelled.draft === rawDay && cancelled.day === currentDay,
      "Day-tab Cancel keeps the raw draft and current day",
      JSON.stringify(cancelled),
      "Fill Day 1 → other day tab → Cancel"
    );
    await requestVisibleDay(page,otherDay);
    await answerDiscardQuestion(page,"discard");
    await page.waitForFunction((d) => document.querySelector("#dayTabs button.active")?.dataset.day === d, otherDay, { timeout: 5000 });
    const confirmed = await readDraft(page);
    await reloadApp(page);
    const after = await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day);
    assert(
        confirmed?.program?.dayLabel === otherDay &&
        confirmed?.exerciseOrder?.every((id) => Object.values(confirmed.exercises[id]?.sets || {}).every((set) => set.edited.metrics["2555c6f170d8805cafa6d16d3fdddbaa"] !== "55")) &&
        after === otherDay,
      "Day-tab Confirm clears the old draft, selects the new day, and survives reload",
      JSON.stringify({ confirmed, after }),
      "Fill Day 1 → other day tab → Confirm → reload"
    );

    await clearDraftFixture(page);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 56, 5, 1);
    const rawUp = await readDraftRaw(page);
    await page.evaluate(() => window.__repforgeLeaveWorkout?.());
    page.__manualDiscard = true;
    await page.click("#upNextBtn");
    await answerDiscardQuestion(page,"keep");
    const upCancel = await readDraftRaw(page);
    assert(upCancel === rawUp, "Up next Cancel preserves the raw draft", "draft changed", "Up next → Cancel");
    page.__manualDiscard = true;
    await page.click("#upNextBtn");
    await answerDiscardQuestion(page,"discard");
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    assert(
      (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
      "Up next Confirm selects the next day",
      "day unchanged",
      "Up next → Confirm"
    );

    await clearDraftFixture(page);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 57, 5, 1);
    const rawEnter = await readDraftRaw(page);
    page.__manualDiscard = true;
    const enterCancelled = page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), otherDay);
    await answerDiscardQuestion(page,"keep");
    await enterCancelled;
    assert(
      (await readDraftRaw(page)) === rawEnter,
      "enterWorkout({day}) Cancel preserves the raw draft",
      "draft changed",
      "enterWorkout other day → Cancel"
    );
    page.__manualDiscard = true;
    const enterConfirmed = page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), otherDay);
    await answerDiscardQuestion(page,"discard");
    await enterConfirmed;
    assert(
      (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
      "enterWorkout({day}) Confirm selects the new day",
      "day unchanged",
      "enterWorkout other day → Confirm"
    );

    const otherEx = await page.evaluate((d) => (JSON.parse(localStorage.getItem("repforge_v1") || "{}").program || []).find((e) => e.day === d)?.id, otherDay);
    if (otherEx) {
      await clearDraftFixture(page);
      await reloadApp(page);
      await nav(page, "log");
      await selectDay(page, "Day 1");
      await fillExerciseSets(page, draftExA.id, 1, 58, 5, 1);
      const rawGo = await readDraftRaw(page);
      page.__manualDiscard = true;
      const goCancelled = page.evaluate((id) => window.__repforgeGoToLogExercise(id), otherEx);
      await answerDiscardQuestion(page,"keep");
      await goCancelled;
      assert(
        (await readDraftRaw(page)) === rawGo,
        "Deep-link Cancel preserves the raw draft",
        "draft changed",
        "goToLogExercise → Cancel"
      );
      page.__manualDiscard = true;
      const goConfirmed = page.evaluate((id) => window.__repforgeGoToLogExercise(id), otherEx);
      await answerDiscardQuestion(page,"discard");
      await goConfirmed;
      assert(
        (await page.evaluate(() => document.querySelector("#dayTabs button.active")?.dataset.day)) === otherDay,
        "Deep-link Confirm selects the destination day",
        "day unchanged",
        "goToLogExercise → Confirm"
      );
    }
  }

  await clearDraftFixture(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  await page.evaluate(() => {
    const el = document.querySelector("#sessionBodyweight");
    el.value = "80";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await fillExerciseSets(page, draftExA.id, 1, 60, 5, 1);
  await nav(page, "settings");
  await page.selectOption("#unit", "lb");
  await page.waitForTimeout(80);
  await reloadApp(page);
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  const bwDisp = await page.evaluate(() => document.querySelector("#sessionBodyweight")?.value);
  const beforeBw = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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
    await clearDraftFixture(page);
    await reloadApp(page);
    await nav(page, "log");
    await selectDay(page, "Day 1");
    await fillExerciseSets(page, draftExA.id, 1, 61, 5, 1);
    const raw = await readDraftRaw(page);
    const beforeLen = (await getState(page)).log.length;
    const result = await finishEarlyWithStorageOutcome(page, { localOk, idbOk });
    await page.evaluate(() => window.__repforgeStorage?.flush?.());
    if (localOk || idbOk) {
      await reloadApp(page);
      const afterLen = (await getState(page)).log.length;
      const draftNow = await readDraftRaw(page);
      assert(
        afterLen > beforeLen && !draftNow && result.localOk === localOk && result.idbOk === idbOk,
        `Finish (${localOk},${idbOk}) commits one session and clears the draft`,
        JSON.stringify({ result, beforeLen, afterLen, draftNow }),
        `Adapter ${localOk}/${idbOk} finish`
      );
    } else {
      const afterLen = (await getState(page)).log.length;
      const draftNow = await readDraftRaw(page);
      assert(
        afterLen === beforeLen && draftNow === raw,
        "Finish total failure keeps zero new rows and the exact draft",
        JSON.stringify({ result, beforeLen, afterLen, same: draftNow === raw }),
        "Adapter false/false finish"
      );
      await saveWorkout(page, { earlyFinish: true });
      const retried = (await getState(page)).log.length;
      assert(retried === beforeLen + 1 || retried > beforeLen, "Total failure retry does not duplicate after a later accepted save", `len ${retried} vs ${beforeLen}`, "Retry finish after total failure");
    }
  }

  await clearDraftFixture(page);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  // A pre-067 flat draft has no metric-backed program to migrate onto; its
  // bytes go to draft recovery (owned by the draft-storage suites).

  beginPhase("Phase: atomic set validation and rest seconds (UX-03, UX-10)");
  await clearDraftFixture(page);
  await reloadApp(page);
  // This phase exercises numeric RIR inputs. Clear and reload before changing
  // mode so a previous phase's draft cannot correctly refuse the transition.
  await clickRir("numeric");
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
    await setWorkoutField(page, "#sessionBodyweight", "");
  };
  const assertRejectedFinish = async (name, mutate, fieldSel) => {
    await fillValidCandidate();
    await mutate();
    const logBefore = JSON.stringify((await getState(page)).log);
  const draftBefore = await readDraftRaw(page);
    await stopRestIfRunning(page);
    await saveWorkout(page, { expectNewRows: false });
    assert(
      JSON.stringify((await getState(page)).log) === logBefore,
      `${name} adds zero log rows`,
      "log changed after rejected Finish",
      `Fill a valid set → ${name} → Finish workout`
    );
    assert(
    (await readDraftRaw(page)) === draftBefore,
      `${name} keeps the exact draft`,
      "draft string changed",
      `Fill a valid set → ${name} → Finish workout`
    );
    if (fieldSel) {
      const marked = await page.evaluate((s) => document.querySelector(s)?.getAttribute("aria-invalid") === "true", fieldSel);
      assert(marked, `${name} marks the first bad field`, `aria-invalid missing on ${fieldSel}`, name);
    }
  };

  await assertRejectedFinish("negative load", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "-5"), `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`);
  await assertRejectedFinish("blank load", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, ""), `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`);
  await assertRejectedFinish("non-numeric load", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "abc"), `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`);
  await assertRejectedFinish("zero reps", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "0"), `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`);
  await assertRejectedFinish("negative reps", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "-1"), `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`);
  await assertRejectedFinish("fractional reps", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "8.5"), `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`);
  await assertRejectedFinish("blank reps", () => setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, ""), `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`);
  await assertRejectedFinish("negative RIR", () => setWorkoutField(page, `[data-k="${valKey}_rir"]`, "-0.5"), `[data-k="${valKey}_rir"]`);
  await assertRejectedFinish("blank RIR", () => setWorkoutField(page, `[data-k="${valKey}_rir"]`, ""), `[data-k="${valKey}_rir"]`);
  await assertRejectedFinish("invalid bodyweight", () => setWorkoutField(page, "#sessionBodyweight", "0"), "#sessionBodyweight");
  await assertRejectedFinish("blank date", () => setLogDateRaw(page, ""), "#sessionDate");
  await assertRejectedFinish("malformed date", () => setLogDateRaw(page, "not-a-date"), "#sessionDate");
  await assertRejectedFinish("impossible date", () => setLogDateRaw(page, "2024-02-30"), "#sessionDate");
  await assertRejectedFinish("invalid leap-day date", () => setLogDateRaw(page, "2023-02-29"), "#sessionDate");

  await fillValidCandidate();
  await setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "-9");
  const surviveLog = JSON.stringify((await getState(page)).log);
  const surviveDraft = await readDraftRaw(page);
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
  const surviveDraftAfter = await readDraft(page);
  assert(
    surviveDraftAfter?.exercises?.[valEx.id]?.sets?.[surviveDraftAfter.exercises[valEx.id].setOrder[0]]?.edited?.metrics?.["2555c6f170d8805cafa6d16d3fdddbaa"] === "-9",
    "Failed Finish draft survives Settings save, flush, and reload",
    `draft=${JSON.stringify(surviveDraftAfter)}`,
    "Invalid Finish → Settings save → flush → reload → draft still has -9 load"
  );
  void surviveDraft;

  await nav(page, "log");
  await selectDay(page, "Day 1");
  await fillValidCandidate();
  await stopRestIfRunning(page);
  await setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "");
  const restHiddenBefore = await page.evaluate(() => document.querySelector("#restBar")?.classList.contains("hidden") !== false);
  const doneBefore = (await draftSetState(page,valKey)).done;
  await clickSaveSet(page, valKey);
  await page.waitForTimeout(80);
  const restHiddenAfter = await page.evaluate(() => document.querySelector("#restBar")?.classList.contains("hidden") !== false);
  const doneAfter = (await draftSetState(page,valKey)).done;
  const draftForDone = await readDraft(page);
  const draftDone = draftForDone?.exerciseOrder.flatMap((id) =>
    Object.values(draftForDone.exercises[id]?.sets || {})
      .filter((set) => set.completion !== "pending")
      .map((set) => `${id}_${set.ordinal}`)
  ) || [];
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
  await saveWorkout(page, { earlyFinish: true });
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
  await setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "90,5");
  await setWorkoutField(page, `[data-k="${valKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "7");
  await setWorkoutField(page, `[data-k="${valKey}_rir"]`, "2,5");
  const beforePt = new Set((await getState(page)).log.map((r) => r.session));
  await saveWorkout(page, { earlyFinish: true });
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
  await saveWorkout(page, { earlyFinish: true });
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
  await page.fill('.session--edit [data-ek="metric|0|2555c6f170d8805cafa6d16d3fdddbaa"]', "-3");
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
  await saveWorkout(page, { earlyFinish: true });
  sessionCount++;
  uiSaveCount++;
  const sibSid = (await getState(page)).log.find((r) => !beforeSibling.has(r.session)).session;
  const sibSnap = () => getState(page).then((s) => s.log.filter((r) => r.session === sibSid));
  const sibBefore = JSON.stringify(await sibSnap());
  await openSessionEditor(page, sibSid);
  await page.fill('.session--edit [data-ek="metric|0|2555c6f170d8805cafa6d16d3fdddbaa"]', "nope");
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
  // A valid DraftV2 owns the captured prescription and block identity. The
  // explicit block-start command must refuse before it can open the next-block
  // onboarding flow or touch any draft/checkpoint bytes. Clear that independent
  // workout fixture, then exercise the existing deferred onboarding contract.
  await flushDraftWork(page);
  const draftBeforeBlockedBlock = await page.evaluate((d) => ({
    raw: localStorage.getItem(d),
    checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.() || null,
    recovery: window.__repforgeWorkoutDraft?.recovery?.() || null,
  }), DRAFT);
  const onboardingBlockedByDraft = await page.evaluate(() => window.__repforgeCommitNextBlock("onboarding"));
  const draftAfterBlockedBlock = await page.evaluate((d) => ({
    raw: localStorage.getItem(d),
    checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.() || null,
    recovery: window.__repforgeWorkoutDraft?.recovery?.() || null,
  }), DRAFT);
  const stateAfterBlockedBlock = await getState(page);
  assert(
    onboardingBlockedByDraft.kind === "failed" &&
      onboardingBlockedByDraft.committed === false &&
      onboardingBlockedByDraft.draftConflict === true &&
      onboardingBlockedByDraft.code === "live_draft_blocks_next_block" &&
      stateAfterBlockedBlock._storageRevision === revisionBeforeBlock &&
      stateAfterBlockedBlock.programMeta?.id === idBeforeBlock &&
      (stateAfterBlockedBlock.programHistory?.length || 0) === histBeforeBlock &&
      JSON.stringify(draftAfterBlockedBlock) === JSON.stringify(draftBeforeBlockedBlock),
    "A valid DraftV2 blocks explicit block start without changing state or draft bytes",
    JSON.stringify({ result: onboardingBlockedByDraft, before: draftBeforeBlockedBlock, after: draftAfterBlockedBlock }),
    "commitNextBlock(onboarding) with live DraftV2 → refused before capture/journal/write"
  );
  await clearDraftFixture(page);
  await reloadApp(page);
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
      programDefinition: cur.programMeta.programDefinition,
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
  const blockIdForDup = afterBlockSave.programMeta.blockId;
  const histForDup = afterBlockSave.programHistory.length;
  const revisionForDup = afterBlockSave._storageRevision;
  await page.evaluate(async () => {
    await Promise.all([window.__repforgeCommitNextBlock("repeat"), window.__repforgeCommitNextBlock("repeat")]);
  });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const afterDup = await getState(page);
  assert(
    afterDup.programMeta.id === idForDup &&
      afterDup.programMeta.blockId &&
      afterDup.programMeta.blockId !== blockIdForDup &&
      afterDup._storageRevision === revisionForDup + 1 &&
      afterDup.programHistory.length === histForDup &&
      afterDup.programHistory.filter((h) => h.id === idForDup).length === 0,
    "Double literal-repeat commit creates one fresh block without archiving the program",
    `hist ${histForDup} → ${afterDup.programHistory.length} id=${afterDup.programMeta.id} block=${afterDup.programMeta.blockId}`,
    "Promise.all commitNextBlock(repeat) ×2"
  );
  const settledId = afterDup.programMeta.id;
  const settledBlockId = afterDup.programMeta.blockId;
  const settledRevision = afterDup._storageRevision;
  const settledHistory = afterDup.programHistory.length;
  const repeatedBlock = await page.evaluate(
    (oldId) => window.__repforgeCommitNextBlock("repeat", undefined, oldId),
    idForDup
  );
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const afterRepeatedBlock = await getState(page);
  assert(
    repeatedBlock.kind === "committed" &&
      repeatedBlock.committed === true &&
      afterRepeatedBlock.programMeta.id === settledId &&
      afterRepeatedBlock.programMeta.blockId !== settledBlockId &&
      afterRepeatedBlock._storageRevision === settledRevision + 1 &&
      afterRepeatedBlock.programHistory.length === settledHistory &&
      afterRepeatedBlock.programMeta.id === settledId &&
      afterRepeatedBlock.programHistory.filter((h) => h.id === settledId).length === 0,
    "A settled literal repeat can start another fresh block without a successor archive",
    JSON.stringify({ repeatedBlock, settledId, afterId: afterRepeatedBlock.programMeta.id }),
    `commitNextBlock(repeat, expected=${idForDup}) after the prior repeat`
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
    // Explicit legacy-fixture case for the transition transaction. The raw
    // flat value is intentional; its V2 sidecars are not.
    await clearDraftFixture(page);
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
        programDefinition: current.programMeta.programDefinition,
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

  // Explicit legacy-fixture case for the rejected settings transition.
  await clearDraftFixture(page);
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
      programDefinition: program,
      name: "Rejected replacement",
      answers: { goal: "hypertrophy" },
      destination: "log",
      origin: "settings",
      draftConfirmed: true,
    }, io);
  }, setupBeforeFailure.programMeta.programDefinition);
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
    programDefinition: program,
    name: "Accepted replacement",
    answers: { goal: "hypertrophy" },
    destination: "log",
    origin: "settings",
    draftConfirmed: true,
  }), setupBeforeFailure.programMeta.programDefinition);
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
  // Owner decision on #295 (landing until onboarding): a retained setup draft
  // brings the returning landing back, naming the saved route; the chooser
  // with its resume card is one step from it, never opened by itself.
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  const returningLanding = await page.evaluate(() => ({
    visit: document.querySelector("#firstRun")?.dataset.entryVisit || null,
    draft: document.querySelector("#firstRun")?.dataset.entryDraft || null,
    chooser: !!document.querySelector("#onboarding")?.classList.contains("active"),
  }));
  assert(
    returningLanding.visit === "returning" && !!returningLanding.draft && !returningLanding.chooser,
    "A retained setup draft returns to the landing, which names the saved route and does not open the chooser by itself",
    JSON.stringify(returningLanding),
    "Reload with a setup draft and no program"
  );
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 10000 });
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
  beginPhase("Honest affordances, contextual guides, and deletion copy");
  await nav(page, "log");
  const firstExId = await page.evaluate(() => {
    const b = document.querySelector("#todayExList [data-exopen], #workout [data-exopen]");
    return b?.getAttribute("data-exopen") || "";
  });
  if (!firstExId) {
    await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
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
      const range = document.querySelector("#exDetail .range-static");
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
  assert(statsPeriodGone, "#statsPeriod is absent", "statsPeriod still in DOM");
  await nav(page, "stats");

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
  // Explicit invalid/legacy fixture: deletion must remove this raw value too.
  await clearDraftFixture(page);
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

  const guideBaseline = await page.evaluate(() => ({
    oldMarkup: !!document.querySelector("#tour"),
    oldStart: typeof window.startTour,
    oldClose: typeof window.closeTour,
    guides: window.__repforgeUi?.guideState?.(),
    draft: localStorage.getItem("repforge_draft_v1"),
  }));
  assert(
    !guideBaseline.oldMarkup && guideBaseline.oldStart === "undefined" && guideBaseline.oldClose === "undefined",
    "The obsolete global tour has no production route",
    JSON.stringify(guideBaseline)
  );
  await nav(page, "settings");
  await page.click("#guideReplayToggle");
  await page.click('[data-guide-replay="privacy"]');
  await page.waitForSelector('[data-guide-cue="privacy"]');
  const cue = await page.evaluate(() => {
    const node = document.querySelector('[data-guide-cue="privacy"]');
    const anchor = document.querySelector("#privacyDetails");
    return {
      role: node?.getAttribute("role"),
      anchored: !!(node?.dataset.anchorTarget && anchor?.matches(node.dataset.anchorTarget)),
      modal: node?.getAttribute("aria-modal"),
      mainInert: !!document.querySelector("main")?.inert,
    };
  });
  assert(cue.role === "status" && cue.anchored && !cue.modal && !cue.mainInert, "Privacy guide is contextual and non-modal", JSON.stringify(cue));
  await page.click("#privacyDetails");
  await page.waitForSelector("#privacySheet.is-open");
  const completed = await page.evaluate(() => window.__repforgeUi.guideState().privacy);
  assert(completed.status === "completed", "Performing the anchored Privacy action completes its guide", JSON.stringify(completed));
  await page.click("#privacyClose");
  await page.waitForSelector("#privacySheet", { state: "hidden" });
  await page.click('[data-guide-replay="entry"]');
  await page.waitForFunction(() => window.__repforgeUi.guideState().entry?.status === "deferred");
  const missingAnchor = await page.evaluate(() => ({
    entry: window.__repforgeUi.guideState().entry,
    floating: !!document.querySelector('[data-guide-cue="entry"]'),
    draft: localStorage.getItem("repforge_draft_v1"),
  }));
  assert(missingAnchor.entry.status === "deferred" && !missingAnchor.floating, "A hidden entry anchor defers without a floating guide", JSON.stringify(missingAnchor));
  assert(missingAnchor.draft === guideBaseline.draft, "Contextual guide presentation does not write a workout draft", JSON.stringify(missingAnchor));

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
        blockId: "coach-block",
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
      mkEx("curl-a", "Day 1", 11, "Coach Curl", { min: 8, max: 12, primary: "Biceps" }),
      mkEx("curl-b", "Day 2", 1, "Coach Curl", { min: 8, max: 12, primary: "Biceps" }),
    ];
    const log = [
      ...mkRows({ id: "ex-improved", name: "Coach Improved", day: "Day 1", date: dates.lastWeek, session: "s-imp-prev", load: 80, reps: 6, rir: 1, primary: "Chest" }),
      ...mkRows({ id: "ex-improved", name: "Coach Improved", day: "Day 1", date: dates.thisWeek, session: "s-imp-cur", load: 85, reps: 8, rir: 1, primary: "Chest" }),
      ...mkRows({ id: "ex-flat", name: "Coach Flat", day: "Day 1", date: dates.lastWeek, session: "s-flat-prev", load: 70, reps: 8, rir: 1, primary: "Quads" }),
      ...mkRows({ id: "ex-flat", name: "Coach Flat", day: "Day 1", date: dates.thisWeek, session: "s-flat-cur", load: 70, reps: 8, rir: 1, primary: "Quads" }),
      ...mkRows({ id: "ex-regressed", name: "Coach Regressed", day: "Day 1", date: dates.lastWeek, session: "s-reg-prev", load: 100, reps: 8, rir: 1, primary: "Lats" }),
      ...mkRows({ id: "ex-regressed", name: "Coach Regressed", day: "Day 1", date: dates.thisWeek, session: "s-reg-cur", load: 100, reps: 5, rir: 1, primary: "Lats" }),
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
    // The coaching fixture replaces the durable program and log. Drop any
    // active draft from the preceding tour so its old program fingerprint
    // cannot correctly block this independent dataset.
    await clearDraftFixture(page);
    const prior = await getState(page);
    const coachProgramMeta = {
      ...(prior.programMeta || {}),
      id: "coach-fixture",
      name: "Coach fixture",
      blockId: "coach-block",
      onboarded: true,
      // Keep the paired exposures inside the explicit current-block scope;
      // inheriting the preceding simulation's transient block start can make
      // an otherwise valid fixture look like insufficient baseline data.
      started: dates.lastWeek,
      mesocycleLengthWeeks: 6,
      mesocycleStatus: "active",
      programStructure: {
        schemaVersion: 1,
        days: [
          { dayId: "coach_d1", label: "Day 1", order: 1 },
          { dayId: "coach_d2", label: "Day 2", order: 2 },
        ],
        provenance: { source: "manual_build" },
        weekPrescriptions: [],
        customizedFrom: null,
      },
    };
    await persistState(page, {
      ...prior,
      program,
      log,
      programMeta: coachProgramMeta,
    });
    await reloadApp(page);
    await nav(page, "stats");

    // Plan 056 replaced the legacy signal board (add/new/stale/vol/fatigue with
    // per-row destinations) with one evidence model: only a *sufficient* record
    // carrying an observed outcome becomes an action, and its recommendation is
    // the group. Insufficient lifts are baseline-building, not warnings, so they
    // must contribute nothing to Needs action.
    const snap = await page.evaluate(() => {
      const w = window.__repforgeWeeklySnapshot();
      const groups = window.__repforgeAttention();
      const records = window.__repforgeProgressEvidence.records("current-block");
      const metric = (name) =>
        document.querySelector(`#thisWeek [data-week-metric="${name}"] .ovtotal__n`)?.textContent?.trim();
      const moves = groups.flatMap((g) => g.items.map((i) => {
        const rec = window.__repforgeRecommendation(i.ex);
        return { id: i.ex.id, status: rec.status, stalled: !!rec.stalled };
      }));
      const chips = [...document.querySelectorAll("#attention [data-attn]")].map((el) => ({
        id: el.getAttribute("data-attn"),
        group: el.getAttribute("data-attngo"),
        lift: el.getAttribute("data-action-lift"),
        text: el.textContent,
      }));
      return {
        w,
        groups: groups.map((g) => ({ key: g.key, ids: g.items.map((i) => i.ex.id) })),
        moves,
        records: records.map((r) => ({ id: r.exerciseId, state: r.evidenceState, outcome: r.outcome ?? null })),
        baselineDom: metric("baseline"),
        sessionsDom: metric("sessions"),
        chips,
        countText: document.querySelector("#attention .ovsec__title")?.textContent?.trim() || "",
        attentionText: document.querySelector("#attention")?.textContent || "",
        verdicts: [...document.querySelectorAll("#attention .attn__chip")]
          .map((row) => row.querySelector(".attnrow__verdict")?.textContent.trim() || ""),
      };
    });

    const groupOf = (id) => snap.groups.find((g) => g.ids.includes(id))?.key ?? null;
    const expectAction = (id, key) =>
      assert(
        groupOf(id) === key,
        `${id} is recommended to ${key} from its observed outcome`,
        JSON.stringify({ id, got: groupOf(id), want: key, groups: snap.groups })
      );
    // Paired-exposure outcomes from the fixture: improved -> progress,
    // maintained -> repeat, declined -> review.
    expectAction("ex-improved", "progress");
    expectAction("ex-ready", "progress");
    expectAction("ex-flat", "repeat");
    expectAction("ex-regressed", "review");
    expectAction("ex-reduce", "review");
    expectAction("ex-fatigue", "review");

    const baselineIds = ["ex-oneshot", "ex-untrained", "ex-stale", "ex-vol", "curl-a", "curl-b"];
    for (const id of baselineIds) {
      assert(
        groupOf(id) === null,
        `${id} has insufficient evidence and never enters Needs action`,
        JSON.stringify({ id, group: groupOf(id) })
      );
    }
    assert(
      snap.records.filter((r) => r.state === "insufficient").length === baselineIds.length &&
        snap.records.every((r) => r.state === "sufficient" || r.outcome === null),
      "insufficient records stay outcome-free baseline evidence",
      JSON.stringify(snap.records)
    );
    assert(
      snap.baselineDom === String(baselineIds.length),
      "the weekly baseline tally counts exactly the insufficient lifts",
      JSON.stringify({ baselineDom: snap.baselineDom, want: baselineIds.length })
    );
    assert(
      !/\bAttention\b/.test(snap.attentionText) && !/\bBelow\b/.test(snap.attentionText),
      "no legacy Attention/Below wording survives on the Overview board",
      snap.attentionText.slice(0, 200)
    );

    // The heading counts the rows shown, and the rows are the queue lifts whose
    // recommendation changes the load; a hold stays in the queue only.
    const changesLoad = (m) => m.status === "add" || m.status === "add2" || (m.status === "reduce" && !m.stalled);
    const shownIds = snap.moves.filter(changesLoad).map((m) => m.id);
    assert(
      JSON.stringify(snap.chips.map((c) => c.id).sort()) === JSON.stringify([...shownIds].sort()) && snap.countText.includes(`(${shownIds.length})`),
      "the Needs attention count equals the chips the board renders, and they are the lifts that change the load",
      JSON.stringify({ chips: snap.chips.map((c) => c.id), shown: shownIds, countText: snap.countText, moves: snap.moves })
    );
    // Which lifts Needs attention lists (the add/reduce load changes) is held
    // back until recommendation() reports the adaptive engine's direction; this
    // fixture is a Build-style program whose lifts are all manual.
    assert(
      snap.w.improvedLifts >= 1 && snap.w.regressedLifts >= 1 && snap.w.flatLifts === 1,
      "Fixture includes improved, flat, and regressed comparisons this week",
      JSON.stringify({ improved: snap.w.improvedLifts, flat: snap.w.flatLifts, regressed: snap.w.regressedLifts })
    );

    await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
    await page.waitForSelector("#segStrength.active");
    await page.click('#strengthScopeSeg button[data-scope="current-block"]');

    // Two exercises sharing a display name keep separate evidence identities.
    const curlRows = await page.evaluate(() => ["curl-a", "curl-b"].map((id) => {
      const key = window.__repforgeProgressEvidence.keyForExerciseId(id);
      return { id, key, row: !!document.querySelector(`#strengthDash [data-evkey="${key}"]`) };
    }));
    assert(
      curlRows[0].key !== curlRows[1].key && curlRows.every((r) => r.key && r.row),
      "duplicate display names keep distinct Strength evidence identities",
      JSON.stringify(curlRows)
    );
  }

  beginPhase("Phase: PWA cache, offline shell, replica agreement");
  // The coaching fixture above is a flat evidence dataset; the installed-app
  // walk starts again from the canonical seed program.
  await resetWithSeedProgram(page);
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
    await pwaPage.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(pwaPage);
    // Seed the installed origin through the same production entry path as a
    // lifter. Copying only the canonical bytes would omit the acknowledged
    // V2 checkpoint and correctly trigger recovery on the first offline nav.
    const seedWorkoutDay = String(seedState.program?.[0]?.day || "");
    if (!seedWorkoutDay) throw new Error("PWA production draft seed has no program day");
    const enteredPwa = await pwaPage.evaluate(async (day) => window.__repforgeEnterWorkout?.({ day }), seedWorkoutDay);
    if (enteredPwa === false) throw new Error("PWA production draft entry was refused");
    await pwaPage.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    try {
      await pwaPage.waitForSelector('#workout input[data-k$="_metric_2555c6f170d8805cafa6d16d3fdddbaa"]', { timeout: 10000 });
    } catch (error) {
      const diagnostic = await pwaPage.evaluate(() => ({
        body: document.body.className,
        shell: document.querySelector("#workoutShell")?.className || "",
        activeViews: [...document.querySelectorAll(".view.active")].map((el) => el.id),
        days: [...document.querySelectorAll("#dayTabs button")].map((el) => ({ day: el.dataset.day, active: el.classList.contains("active") })),
        workout: {
          htmlLength: document.querySelector("#workout")?.innerHTML.length || 0,
          exercises: [...document.querySelectorAll("#workout .exercise")].map((el) => ({ id: el.dataset.ex, className: el.className })),
          inputs: [...document.querySelectorAll("#workout input[data-k]")].map((el) => el.dataset.k),
        },
        draft: window.__repforgeWorkoutDraft?.current?.() || null,
        read: window.__repforgeWorkoutDraft?.read?.() || null,
        checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.() || null,
        recovery: window.__repforgeWorkoutDraft?.recovery?.() || null,
        state: (() => {
          try { return JSON.parse(localStorage.getItem("repforge_v1") || "null"); } catch { return null; }
        })(),
      }));
      throw new Error(`${error.message}; PWA entry diagnostic=${JSON.stringify(diagnostic)}`);
    }
    const pwaLoad = pwaPage.locator('#workout input[data-k$="_metric_2555c6f170d8805cafa6d16d3fdddbaa"]').first();
    await pwaLoad.fill("73.5");
    await pwaPage.evaluate(async () => window.__repforgeWorkoutDraft?.flush?.());
    const pwaDraftProof = await pwaPage.evaluate(() => ({
      raw: window.__repforgeWorkoutDraft?.read?.().raw,
      checkpoint: window.__repforgeWorkoutDraft?.checkpoint?.(),
    }));
    if (!pwaDraftProof.raw || pwaDraftProof.checkpoint?.status !== "valid") {
      throw new Error(`PWA production draft seed lacked acknowledged checkpoint: ${JSON.stringify(pwaDraftProof)}`);
    }
    await pwaPage.waitForFunction(
      async ({ cacheName, shell, optionalShell }) => {
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
          if (optionalShell.includes(path)) return true;
          if (path === "/") return paths.has("/") || paths.has("/index.html");
          return paths.has(path);
        });
      },
      { cacheName: swMeta.cache, shell: swMeta.shell, optionalShell: swMeta.optionalShell },
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
            const optionalMissing = path === optionalDeploymentShellAsset &&
              [404, 503].includes(net.status) && !/^text\/html\b/i.test(net.headers.get("content-type") || "");
            results.push({
              path,
              ok: optionalMissing,
              optionalMissing,
              reason: optionalMissing ? "declared-optional-and-unavailable" : "cache-miss",
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
      "Each cached release code/document asset matches bytes and content-type after cache-bypass fetch",
      JSON.stringify(shellFail.slice(0, 3)),
      "Online fetch({cache:'reload'}) vs caches.open(CACHE).match"
    );

    const cdp = await pwaContext.newCDPSession(pwaPage);
    await cdp.send("Network.clearBrowserCache");
    await pwaContext.setOffline(true);

    const offlineNav = await pwaPage.goto(origin, { waitUntil: "domcontentloaded" });
    // The offline boot reads the catalog detail asset from the cache before the
    // app is usable; navigation probes wait for that boot like every other load.
    await waitForApp(pwaPage);
    assert(
      !!offlineNav && offlineNav.fromServiceWorker(),
      "Offline navigation is served from the service worker",
      `fromSW=${offlineNav?.fromServiceWorker?.()} status=${offlineNav?.status()}`,
      "Clear HTTP cache, stay offline, reload /"
    );

    const offlineShell = [];
    for (const path of swMeta.shell.filter((p) => p !== "/")) {
      const url = new URL(path, origin).href;
      const [resp, result] = await Promise.all([
        pwaPage.waitForResponse((r) => r.url() === url, { timeout: 8000 }).catch(() => null),
        pwaPage.evaluate(async (u) => {
          const response = await fetch(u);
          const type = response.headers.get("content-type") || "";
          return { status: response.status, type, isHtml: /^text\/html\b/i.test(type) };
        }, url),
      ]);
      offlineShell.push({ path, fromSW: resp?.fromServiceWorker?.() === true, status: result.status, type: result.type, isHtml: result.isHtml });
    }
    const optionalOffline = offlineShell.find((r) => r.path === OPTIONAL_DEPLOYMENT_SHELL_ASSET);
    const optionalConfigWasAvailable = optionalDeploymentAsset?.netOk === true;
    const optionalOfflineExpectedStatus = optionalConfigWasAvailable ? 200 : 503;
    const optionalOfflineHasExpectedType = optionalConfigWasAvailable
      ? /^(?:application|text)\/(?:javascript|ecmascript|x-javascript)\b/i.test(optionalOffline?.type || "")
      : /^text\/plain\b/i.test(optionalOffline?.type || "");
    assert(
      optionalOffline?.fromSW === true && optionalOffline.status === optionalOfflineExpectedStatus &&
        !optionalOffline.isHtml && optionalOfflineHasExpectedType,
      optionalConfigWasAvailable
        ? "Service worker serves the available PostHog config from cache offline as JavaScript"
        : "Service worker reports the absent PostHog config offline without returning HTML as JavaScript",
      JSON.stringify({ ...optionalOffline, expectedStatus: optionalOfflineExpectedStatus }),
      "Go offline → fetch /posthog-config.js"
    );
    assert(
      offlineShell.every((r) => r.fromSW),
      "Offline app shell fetches report fromServiceWorker()",
      JSON.stringify(offlineShell),
      "While offline, fetch each release code/document path"
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
        // A metric-backed load field states the load metric's own rule for
        // every rejected entry, empty or malformed.
        const expectToast = METRIC_LOAD_TOAST[lang];
        // A metric load accepts zero external load, and a pound or float value
        // that rounds to the limit within a millionth of a kilo is the limit.
        // Those two stay refusals only on the flat History-edit path below.
        if (!METRIC_ACCEPTS.has(c.name)) {

          await resetWorkoutDraft(page);
          await nav(page, "log");
          await selectDay(page, "Day 1");
          await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, c.raw);
          await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
          await hideToast(page);
          const beforeSet = await logJson(page);
          await clickSaveSet(page, setKey);
          const toastSet = await readToast(page);
          const doneCls = await draftSetState(page, `${setKey}`);
          assert(
            toastSet === expectToast && !(doneCls || "").done && (await logJson(page)) === beforeSet,
            `per-set ${lang}/${unit} ${c.name} rejects`,
            `toast="${toastSet}" class="${doneCls}"`,
            `Log → type ${c.raw || "(empty)"} → Save set`
          );

          await resetWorkoutDraft(page);
          await nav(page, "log");
          await selectDay(page, "Day 1");
          await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, c.raw);
          await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
          await hideToast(page);
          const beforeSave = await logJson(page);
          // Only this set is touched, so the lifter finishes early; the load rule
          // must still refuse the whole Finish.
          const { toast: toastSave } = await finishEarlyOrRefused(page);
          assert(
            toastSave === expectToast && (await logJson(page)) === beforeSave,
            `final-save ${lang}/${unit} ${c.name} aborts`,
            `toast="${toastSave}"`,
            `Log → type ${c.raw || "(empty)"} on a touched set → Save workout`
          );

        }

        await openF7HistoryEdit(page);
        await fillNamed(page, '.session--edit [data-ek^="load|"]', c.raw);
        await hideToast(page);
        const beforeEdit = await logJson(page);
        await page.locator("[data-edsave]").first().click();
        // R3j2: the reason stays under the row instead of a toast. The seeded
        // row is a pre-067 flat row, so its load field keeps the flat weight copy.
        const reasonEdit = await readHistoryReason(page);
        const stillSeed = (await getState(page)).log.find((r) => r.session === "f7-edit-seed");
        assert(
          reasonEdit === (c.empty ? toasts.empty : toasts.invalid) && (await logJson(page)) === beforeEdit && stillSeed && +stillSeed.load === 80,
          `history-edit ${lang}/${unit} ${c.name} aborts`,
          `reason="${reasonEdit}" load=${stillSeed?.load}`,
          `History → Edit → type ${c.raw || "(empty)"} → Save`
        );
      }

      for (const c of cases.filter((x) => METRIC_ACCEPTS.has(x.name))) {
        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await hideToast(page);
        await clickSaveSet(page, setKey);
        await waitForSetDone(page, exId).catch(() => {});
        const doneOk = (await draftSetState(page, `${setKey}`) || "").done;
        const before = ((await getState(page)).log || []).length;
        if (doneOk) await saveWorkout(page, { earlyFinish: true });
        const after = (await getState(page)).log || [];
        const saved = after.filter((r) => r.exerciseId === exId).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
        const expectedKg = METRIC_ACCEPTS.get(c.name);
        assert(
          doneOk && after.length > before && Math.abs(+saved?.load - expectedKg) < 1e-6,
          `per-set ${lang}/${unit} ${c.name} saves as ${expectedKg} kg on a metric set`,
          `done=${doneOk} load=${saved?.load} len ${before}→${after.length}`,
          `Log → type ${c.raw} → Save set → Save workout`
        );
      }

      for (const c of cases.filter((x) => !x.reject)) {
        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await hideToast(page);
        await clickSaveSet(page, setKey);
        // A refused set leaves doneOk false and the assertion below names it.
        await waitForSetDone(page, exId).catch(() => {});
        const doneOk = (await draftSetState(page, `${setKey}`) || "").done;
        const beforePerLen = ((await getState(page)).log || []).length;
        if (doneOk) await saveWorkout(page, { earlyFinish: true });
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
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, c.raw);
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await hideToast(page);
        await finishEarlyOrRefused(page);
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
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await clickSaveSet(page, setKey);
        await waitForSetDone(page, exId);
        const beforeAtomic = await logJson(page);
        await fillNamed(page, `[data-k="${exId}_2_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "1e5");
        await fillNamed(page, `[data-k="${exId}_2_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await hideToast(page);
        await saveWorkout(page, { expectNewRows: false });
        const toastAtomic = await readToast(page);
        assert(
          toastAtomic === METRIC_LOAD_TOAST[lang] && (await logJson(page)) === beforeAtomic,
          "final-save aborts atomically when a touched row is invalid",
          `toast="${toastAtomic}"`,
          "Commit set 1 at 80 kg, type 1e5 on set 2, Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await clickSaveSet(page, setKey);
        await waitForSetDone(page, exId);
        await fillNamed(page, `[data-k="${exId}_2_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "");
        await hideToast(page);
        const beforeEmpty = await logJson(page);
        await saveWorkout(page, { expectNewRows: false });
        const toastEmptyTouched = await readToast(page);
        assert(
          toastEmptyTouched === METRIC_LOAD_TOAST[lang] && (await logJson(page)) === beforeEmpty,
          "final-save empty touched row is refused by the load rule",
          `toast="${toastEmptyTouched}"`,
          "Commit set 1, clear set 2 (touched), Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await clickSaveSet(page, setKey);
        await waitForSetDone(page, exId);
        await toggleWarmup(page, exId, 2);
        await fillNamed(page, `[data-k="${exId}_2_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "abc");
        await hideToast(page);
        const beforeWarm = await logJson(page);
        await saveWorkout(page, { expectNewRows: false });
        const toastWarm = await readToast(page);
        assert(
          toastWarm === METRIC_LOAD_TOAST[lang] && (await logJson(page)) === beforeWarm,
          "final-save aborts atomically when a warm-up row is invalid",
          `toast="${toastWarm}"`,
          "Commit set 1, mark set 2 warm-up with abc, Save workout"
        );

        await resetWorkoutDraft(page);
        await nav(page, "log");
        await selectDay(page, "Day 1");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d8805cafa6d16d3fdddbaa"]`, "80");
        await fillNamed(page, `[data-k="${setKey}_metric_2555c6f170d88072bbf6d9ad3f16ea86"]`, "5");
        await fillNamed(page, `[data-k="${setKey}_rir"]`, "1");
        await clickSaveSet(page, setKey);
        await waitForSetDone(page, exId);
        const beforeBlank = ((await getState(page)).log || []).length;
        await hideToast(page);
        await saveWorkout(page, { earlyFinish: true });
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
  // The F7 matrix rewrites the program under its last draft; start clean.
  await clearDraftFixture(page);
  await resetWithSeedProgram(page);
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
    const resolveToken = (name, seen = []) => {
      if (seen.includes(name)) return "";
      const value = token(name);
      const alias = /^var\((--[\w-]+)\)$/.exec(value);
      return alias ? resolveToken(alias[1], [...seen, name]) : value;
    };
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
    const resolvedOpacity = (raw) => raw.startsWith("var(") ? token(raw.slice(4, -1)) : raw;
    return {
      accent: token("--accent"),
      accentText: token("--accent-deep"),
      actionText: resolveToken("--color-action-text"),
      inkFaint: token("--ink-faint"),
      bg: token("--bg"),
      surface: token("--surface"),
      contrastFaintBg: contrastHex(token("--ink-faint"), token("--bg")),
      contrastFaintWhite: contrastHex(token("--ink-faint"), token("--surface")),
      contrastAccentTextBg: contrastHex(token("--accent-deep"), token("--bg")),
      contrastAccentTextWhite: contrastHex(token("--accent-deep"), token("--surface")),
      ctaAfter: hasSel(".btn--cta::after").map((r) => r.color),
      backLink: hasSel(".back-link").map((r) => r.color),
      linkAccent: hasSel(".link-accent").map((r) => r.color),
      vrowStatus: hasSel(".vrow__status").map((r) => r.color),
      vrowFill: hasSel(".vrow__fill").map((r) => ({ bg: r.bg, minWidth: r.minWidth })),
      focusVisible: rules.filter((r) => r.sel.includes(":focus-visible")).map((r) => r.outline),
      navIcon: hasSel("nav button.active .nav__icon").map((r) => r.bg),
      btnDisabled: hasSel(".btn:disabled").map((r) => ({ opacity: resolvedOpacity(r.opacity), cursor: r.cursor })),
      iconbtnDisabled: hasSel(".iconbtn:disabled").map((r) => ({ opacity: resolvedOpacity(r.opacity), cursor: r.cursor })),
      focusnavDisabled: hasSel(".stepbtn:disabled").map((r) => r.color),
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
  // R7 V-01: the CTA arrow is drawn in the CTA's own ink (--cta-ink), not the accent: --accent on the parchment dark CTA
  // measured 2.05:1. The brand orange stays on the nav icon, the volume fill and the focus ring.
  assert(
    contrastAudit.ctaAfter.includes("var(--cta-ink)") && !contrastAudit.ctaAfter.includes("var(--accent)") &&
      contrastAudit.navIcon.some((b) => b.includes("var(--accent)")) &&
      contrastAudit.vrowFill.some((v) => v.bg.includes("var(--accent)")) &&
      contrastAudit.focusVisible.some((o) => o.includes("var(--accent)")),
    "C1: brand-orange fills and focus rings still use --accent; the CTA arrow uses the CTA ink",
    JSON.stringify({
      ctaAfter: contrastAudit.ctaAfter,
      navIcon: contrastAudit.navIcon,
      vrowFill: contrastAudit.vrowFill,
      focusVisible: contrastAudit.focusVisible,
    }),
    "Inspect .btn--cta::after, nav icon, .vrow__fill, :focus-visible"
  );
  assert(
    contrastAudit.actionText === contrastAudit.accentText &&
      contrastAudit.backLink.filter(Boolean).every((c) => ["var(--accent-deep)", "var(--color-action-text)"].includes(c)) &&
      contrastAudit.backLink.some((c) => ["var(--accent-deep)", "var(--color-action-text)"].includes(c)) &&
      contrastAudit.linkAccent.length > 0 &&
      contrastAudit.linkAccent.every((c) => ["var(--accent-deep)", "var(--color-action-text)"].includes(c)) &&
      contrastAudit.vrowStatus.every((c) => ["var(--accent-deep)", "var(--color-action-text)"].includes(c)) &&
      contrastAudit.accentTextSels.length >= 8,
    "C1: accent foreground text uses --accent-deep or its semantic action-text token",
    JSON.stringify({
      backLink: contrastAudit.backLink,
      linkAccent: contrastAudit.linkAccent,
      textBtnAccent: contrastAudit.textBtnAccent,
      vrowStatus: contrastAudit.vrowStatus,
      actionText: contrastAudit.actionText,
      n: contrastAudit.accentTextSels.length,
    }),
    "Inspect .back-link, .link-accent, .vrow__status, and --color-action-text"
  );
  assert(
    contrastAudit.vrowFill.every((v) => !v.minWidth || v.minWidth === "0px" || v.minWidth === "0"),
    "F9: .vrow__fill has no CSS min-width nub",
    JSON.stringify(contrastAudit.vrowFill),
    "Inspect .vrow__fill min-width"
  );
  assert(
    contrastAudit.btnDisabled.some((r) => +r.opacity === 0.4 && r.cursor === "default") &&
      contrastAudit.iconbtnDisabled.some((r) => +r.opacity === 0.3 && r.cursor === "default"),
    "F6: .btn:disabled is dimmed; .iconbtn:disabled is unchanged",
    JSON.stringify({ btn: contrastAudit.btnDisabled, icon: contrastAudit.iconbtnDisabled }),
    "Inspect .btn:disabled vs .iconbtn:disabled"
  );
  assert(
    contrastAudit.focusnavDisabled.every((c) => c.includes("var(--color-disabled-reason)")),
    "C1: disabled Focus navigation uses the frozen disabled-reason token",
    JSON.stringify(contrastAudit.focusnavDisabled),
    "Inspect .stepbtn:disabled color"
  );

  await page.evaluate(() => window.startOnboarding("settings", { userInitiated: true, forceFresh: true }));
  await page.waitForSelector("#onboarding.active", { timeout: 5000 });
  // "Not sure which one?" reaches Recommend without answering the goal, so the
  // goal question is the screen this validation case needs.
  await page.click("#entryHelpToggle");
  await page.click('[data-entry-help="q1"][data-entry-help-val="no"]');
  await page.click('[data-entry-help="q2"][data-entry-help-val="recommend"]');
  await page.click("#entryHelpGo");
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
      // This program is the audit's whole program; the base canonical definition would plan other days.
      programMeta: { ...(base.programMeta || {}), programDefinition: undefined, onboarded: true, started: date, mesocycleStatus: "active" },
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
      // The rows above are this audit's whole program: drop the base program's
      // canonical definition, which would otherwise plan its own (different) days.
      programMeta: { ...(base.programMeta || {}), programDefinition: undefined, onboarded: true, started: date, mesocycleStatus: "active" },
      settings: { ...base.settings, lang, unit: "kg", hardRir: 4 },
    };
  };

  // The overview's volume block is retired (Plan 064 R3i); its projection stays a
  // test seam, so these checks read the rows the block used to render from it.
  const readOverview = async () =>
    page.evaluate(() => {
      const hook = window.__repforgeOverviewVolume
        ? window.__repforgeOverviewVolume.sorted().map((r) => ({
            muscle: r.muscle,
            planned: r.planned,
            completed7: r.completed7,
            status: r.status,
            statusKey: r.statusKey,
            pct: window.__repforgeOverviewVolume.pct(r.planned, r.completed7),
            label: window.__repforgeOverviewVolume.label(r.muscle),
          }))
        : [];
      const rows = hook.slice(0, 8).map((r) => ({
        muscle: r.muscle,
        name: r.label,
        num: `${r.completed7} / ${r.planned}`,
        status: r.status,
        on: r.statusKey === "on-target",
        high: r.statusKey === "high",
        width: `${r.pct}%`,
        fillBox: r.pct,
      }));
      return { rows, more: hook.length > 8 ? hook.length - 8 : 0, hook, retired: !document.querySelector("#overviewVolume") };
    });

  const baseVol = await getState(page);
  await persistState(page, volumeAuditState(baseVol, "en"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#attention", { timeout: 5000 });
  const enVol = await readOverview();
  assert(enVol.retired, "The overview no longer renders a volume block", "#overviewVolume is still in the DOM", "Stats → Overview");
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
    addEn?.width === "0%" && addEn.fillBox < 1 && addEn.num.includes("0") &&
      /baseline building/i.test(addEn.status) && !addEn.on && !addEn.high,
    "F9: 0/4 is an empty neutral baseline bar",
    JSON.stringify(addEn),
    "Overview → Adductors 0/4 stays baseline-building"
  );
  assert(
    frontEn?.width === "100%" && frontEn.num.includes("4") && /toward the full period/i.test(frontEn.status) &&
      !frontEn.on && !frontEn.high,
    "F9: 4/4 stays neutral while the current period is open",
    JSON.stringify(frontEn),
    "Overview → Front delts 4/4 before the current week closes"
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
    calves?.pct === 100 && calves.completed7 > calves.planned && /toward the full period/i.test(calves.status),
    "F9: over-target width is capped at 100% while the period is open",
    JSON.stringify(calves),
    "__repforgeOverviewVolume.pct for Calves 12/4 in an open period"
  );
  assert(
    biceps?.planned === 0 && biceps.pct === 0 && biceps.completed7 > 0,
    "F9: unplanned rows use 0% width",
    JSON.stringify(biceps),
    "__repforgeOverviewVolume.pct for Biceps with no plan"
  );

  await page.evaluate(() => {
    const lift = state.log.find((row) => row.exerciseId)?.exerciseId;
    openExerciseView(lift, "log");
  });
  await page.waitForSelector("#exercise.view.active #exChart", { timeout: 5000 });
  await page.waitForFunction(() => {
    const p = document.querySelector("#exChart")?.__rfPaint;
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
    const paint = document.querySelector("#exChart")?.__rfPaint || { fillText: [], stroke: [], fill: [] };
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
    "Inspect window after the exercise page chart draw"
  );
  const latestValueText = chartPaint.fillText.find(
    (x) => /\b(kg|lb)\b/i.test(x.text) && /600/.test(x.font)
  );
  const unitTexts = chartPaint.fillText.filter((x) => /\b(kg|lb)\b/i.test(x.text));
  assert(
    latestValueText && latestValueText.fillStyle === "#b8410e",
    "C1: latest-value canvas text uses accent-deep, not brand orange",
    JSON.stringify(latestValueText || { fillText: chartPaint.fillText }),
    "Exercise page chart → latest-value fillText"
  );
  assert(
    unitTexts.length > 0 && unitTexts.every((x) => x.fillStyle !== "#e04e14") &&
      chartPaint.fillText.every((x) => x.fillStyle !== "#e04e14"),
    "C1: no canvas fillText uses brand orange",
    JSON.stringify(chartPaint.fillText.map((x) => ({ text: x.text, fillStyle: x.fillStyle }))),
    "Inspect #exChart.__rfPaint.fillText colors"
  );
  // Plan 056 sparse policy: a one-point snapshot draws no connector at all;
  // comparison/trend keep the brand-orange data stroke.
  const chartPresentation = await page.evaluate(() => window.__repforgeChartLastPresentation || null);
  const hasAccentStroke = chartPaint.stroke.some((x) => x.strokeStyle === "#e04e14");
  assert(
    (chartPresentation === "snapshot" && !hasAccentStroke) ||
      (chartPresentation !== "snapshot" && hasAccentStroke),
    "C1: data stroke follows the sparse-evidence policy and stays brand orange",
    JSON.stringify(chartPaint.stroke),
    "Inspect #exChart.__rfPaint.stroke colors"
  );
  assert(
    chartPaint.fill.some((x) => x.fillStyle === "#e04e14") &&
      chartPaint.fill.every((x) => x.fillStyle === "#e04e14"),
    "C1: chart points stay brand orange",
    JSON.stringify(chartPaint.fill),
    "Inspect #exChart.__rfPaint.fill colors"
  );

  await page.evaluate(() => closeExerciseView());
  await nav(page, "stats");
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("volume"));
  await page.waitForSelector("#segVolume.active", { timeout: 5000 });
  const volTableCount = await page.locator("#volumeDash .vrow").count();
  assert(
    enVol.hook.length > enVol.rows.length && volTableCount === enVol.hook.length,
    "F10: the Volume tab lists every muscle the overview projection ranks",
    `rows=${volTableCount} expected=${enVol.hook.length}`,
    "Stats → Volume"
  );

  await persistState(page, volumeAuditState(await getState(page), "pt"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#attention", { timeout: 5000 });
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
  const ptCalves = ptVol.hook.find((r) => r.muscle === "Calves");
  assert(
    /rumo ao período completo/i.test(ptCalves?.status || "") && ptCalves.completed7 > ptCalves.planned,
    "F9: Portuguese Overview keeps an open period neutral",
    JSON.stringify(ptCalves),
    "PT Stats → Overview hook status for Calves 12/4"
  );

  await persistState(page, highStatusState(await getState(page), "en"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#attention", { timeout: 5000 });
  const enHigh = await readOverview();
  const hsQuads = enHigh.rows.find((r) => r.muscle === "Quads");
  const hsChest = enHigh.rows.find((r) => r.muscle === "Chest");
  const hsCalves = enHigh.rows.find((r) => r.muscle === "Calves");
  assert(
    /baseline building/i.test(hsQuads?.status || "") && !hsQuads.on && !hsQuads.high && hsQuads.width === "0%",
    "F9: insufficient overview evidence stays baseline-building",
    JSON.stringify(hsQuads),
    "Overview → Quads 0/4 has no legacy Below state"
  );
  assert(
    /toward the full period/i.test(hsChest?.status || "") && !hsChest.on && !hsChest.high && hsChest.width === "100%",
    "F9: an open-period overview row stays neutral at the target",
    JSON.stringify(hsChest),
    "Overview → Chest 4/4 before the current week closes"
  );
  assert(
    /toward the full period/i.test(hsCalves?.status || "") && !hsCalves.high && !hsCalves.on && hsCalves.width === "100%",
    "F9: over-target overview row stays neutral before period close",
    JSON.stringify(hsCalves),
    "Overview → Calves 12/4 before the current week closes"
  );

  await persistState(page, highStatusState(await getState(page), "pt"));
  await reloadApp(page);
  await nav(page, "stats");
  await page.click('#statsSeg button[data-seg="overview"]');
  await page.waitForSelector("#attention", { timeout: 5000 });
  const ptHigh = await readOverview();
  assert(
    /construindo base/i.test(ptHigh.rows.find((r) => r.muscle === "Quads")?.status || "") &&
      /rumo ao período completo/i.test(ptHigh.rows.find((r) => r.muscle === "Chest")?.status || "") &&
      /rumo ao período completo/i.test(ptHigh.rows.find((r) => r.muscle === "Calves")?.status || "") &&
      !ptHigh.rows.find((r) => r.muscle === "Calves")?.high &&
      !ptHigh.rows.find((r) => r.muscle === "Calves")?.on,
    "F9: Portuguese overview keeps baseline and open-period rows neutral",
    ptHigh.rows.map((r) => `${r.muscle}:${r.status}`).join("|"),
    "PT Overview → Quads/Chest/Calves status labels"
  );

  const focusState = volumeAuditState(await getState(page), "en");
  focusState.program = focusState.program.slice(0, 2);
  await persistState(page, focusState);
  await reloadApp(page);
  await nav(page, "log");
  await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
  await page.waitForSelector("#workout .focus-shelf", { timeout: 5000 });
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
    // A pad is disabled only when the effort word has nowhere further to go, so one stands in for it.
    const prev = document.createElement("button");
    prev.className = "stepbtn shelf__pad";
    prev.disabled = true;
    document.querySelector("#workout .focus-shelf").appendChild(prev);
    const color = getComputedStyle(prev).color;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const rgb = parseRgb(color);
    const [br, bgc, bb] = hexToRgb(bg);
    const L1 = lum(...rgb);
    const L2 = lum(br, bgc, bb);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    const disabled = prev.disabled;
    prev.remove();
    return { disabled, color, bg, contrast: (hi + 0.05) / (lo + 0.05) };
  });
  assert(
    focusNavContrast.disabled === true && focusNavContrast.contrast >= 3,
    "C1: disabled Focus navigation reaches the 3:1 usability target",
    JSON.stringify(focusNavContrast),
    "Focus → a disabled step pad → its contrast against --bg"
  );
  beginPhase("Phase: exercise detail illustration");
  // The seed's Leg extension resolves to a movement with a licensed drawing;
  // its Hack squat resolves to one without.
  const ART_ID = "1a25c6f170d880c59f17ce7802758fc3";
  const ART_SRC = "assets/exercises/le_mc.webp";
  const ART_SLOT = "seed-ex-13", PLAIN_SLOT = "seed-ex-1", ART_NAME = "Leg extension";
  const artHistoryRows = (iso, session) =>
    [1, 2, 3].map((n) => ({
      date: iso, session, day: "Day 3", exerciseId: ART_SLOT, name: ART_NAME,
      performedLibraryId: ART_ID, performedName: ART_NAME,
      performedPrimary: "Quads", performedSecondary: "",
      set: n, load: 80 + n * 2.5, reps: 8, rir: 2, created: `${iso}T10:0${n}:00Z`,
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

  await clearDraftFixture(page);
  await resetWithSeedProgram(page);
  await persistState(page, { ...(await getState(page)), log: [], programHistory: [] });
  await reloadApp(page);
  await openArtDetail(page, ART_SLOT);
  const artEmpty = await readDetailArt(page);
  assert(
    artEmpty.imgs === 1 && artEmpty.wrappers === 1 && artEmpty.srcAttr === ART_SRC && artEmpty.complete === true,
    "Mapped exercise renders exactly one detail illustration from its library asset",
    JSON.stringify(artEmpty),
    "Seed program → open the Leg extension page (a movement with a licensed drawing)"
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
    !!artEmpty.alt && artEmpty.alt.trim().length > 0 && artEmpty.alt !== ART_NAME,
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
  await openArtDetail(page, ART_SLOT);
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
  await openArtDetail(page, PLAIN_SLOT);
  const artPlain = await readDetailArt(page);
  await page.waitForTimeout(200);
  page.off("requestfailed", onArtFailed);
  assert(
    artPlain.wrappers === 0 && artPlain.imgs === 0 && artPlain.emptyTiles === 0,
    "A movement without licensed art renders no media block and no placeholder",
    JSON.stringify(artPlain),
    "Open the exercise page for the seed's Hack squat"
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
    artPaper.checked === 20 && artPaper.worst.every((w) => w.delta <= 6),
    "every illustration's field colour matches the paper it is drawn on",
    JSON.stringify(artPaper),
    "Decode each assets/exercises/*.webp → compare its border ring to mediaBg"
  );

  await openArtDetail(page, ART_SLOT);
  const artFieldColor = await page.evaluate((id) => {
    const field = document.querySelector(".exdet-art");
    const entry = window.__repforgeExerciseLibrary.find((e) => e.id === id);
    return {
      declared: entry.mediaBg,
      applied: getComputedStyle(field).getPropertyValue("--exercise-art-bg").trim(),
      inline: field.getAttribute("style"),
      painted: getComputedStyle(field).backgroundImage,
    };
  }, ART_ID);
  assert(
    artFieldColor.applied.toLowerCase() === artFieldColor.declared.toLowerCase() &&
      /gradient/.test(artFieldColor.painted),
    "The rendered field takes its colour from the movement's own artwork",
    JSON.stringify(artFieldColor),
    "Open a mapped exercise page → computed --exercise-art-bg"
  );

  await page.click("#exBack");
  await nav(page, "stats");
  // Progress's own totals are no longer the shared row (Plan 064 R3i), so the shared
  // component is probed in place on the Progress page: the rule under test is the
  // stylesheet's, not whichever surface currently renders it.
  const sharedRules = await page.evaluate(() => {
    const host = document.querySelector("#stats");
    if (!host) return null;
    const row = document.createElement("div");
    row.className = "statrow";
    row.innerHTML = '<div class="statrow__cell"><div class="statrow__val">1</div><div class="statrow__cap">a</div></div>' +
      '<div class="statrow__cell"><div class="statrow__val">2</div><div class="statrow__cap">b</div></div>';
    host.append(row);
    const cs = getComputedStyle(row);
    const cell = row.querySelector(".statrow__cell");
    const result = {
      top: cs.borderTopWidth,
      bottom: cs.borderBottomWidth,
      sep: getComputedStyle(cell, "::after").content,
    };
    row.remove();
    return result;
  });
  assert(
    sharedRules &&
      sharedRules.top !== "0px" &&
      sharedRules.bottom !== "0px" &&
      sharedRules.sep !== "none",
    "Shared stat rows outside the exercise page keep their rules and cell separators",
    JSON.stringify(sharedRules),
    "Progress tab → probe .statrow computed borders"
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
