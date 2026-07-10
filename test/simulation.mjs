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

import { chromium } from "playwright";
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
  await page.click(`nav button[data-view="${view}"]`);
  await page.waitForSelector(`#${view}.view.active`, { timeout: 5000 });
}

async function selectDay(page, dayName) {
  await page.click(`#dayTabs button[data-day="${dayName}"]`);
  await page.waitForSelector(`#dayTabs button[data-day="${dayName}"].active`, { timeout: 5000 });
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
  await page.click(".btn--save");
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
  await selectDay(page, day);
  return page.evaluate(() =>
    [...document.querySelectorAll("#workout .exercise")].map((article) => {
      const meta = article.querySelector(".ex__meta")?.textContent || "";
      const range = meta.match(/×(\d+)-(\d+)/);
      const setsMatch = meta.match(/^(\d+)×/);
      let id = null;
      article.querySelectorAll("input[data-k]").forEach((inp) => {
        const m = inp.dataset.k.match(/^(.+)_\d+_/);
        if (m) id = m[1];
      });
      return {
        id,
        sets: setsMatch ? +setsMatch[1] : 2,
        min: range ? +range[1] : 4,
        max: range ? +range[2] : 8,
      };
    })
  );
}

async function cardInfo(page, idx) {
  return page.evaluate((i) => {
    const a = document.querySelectorAll("#workout .exercise")[i];
    if (!a) return null;
    return {
      status: [...a.classList].find((c) => c.startsWith("is-") && c !== "is-collapsed") || "",
      chip: a.querySelector(".chip")?.textContent || "",
      rec: a.querySelector(".rec")?.textContent || "",
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
  const sessionsTile = tiles.find((t) => t.label === "Sessions");
  const setsTile = tiles.find((t) => t.label === "Sets logged");
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
      rec: a.querySelector(".rec")?.textContent || "",
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

  const browser = await chromium.launch({ headless: true });
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
  await page.fill("#date", smokeDate);
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

  // Zero-load set is skipped on save (week-10 regression)
  await page.fill("#date", isoDateFromWeeksAgo(1));
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await page.fill(`[data-k="${d1Exs[0].id}_1_load"]`, "0");
  await page.fill(`[data-k="${d1Exs[0].id}_1_reps"]`, "0");
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;

  // Empty kg field is skipped (week-20 regression)
  await page.fill("#date", isoDateFromWeeksAgo(2));
  await fillExerciseSets(page, d1Exs[0].id, 1, 100, 8, 1);
  await page.fill(`[data-k="${d1Exs[0].id}_1_load"]`, "");
  const logLenBeforeEmpty = (await getState(page)).log.length;
  await saveWorkout(page, { expectNewRows: false });
  assert(
    (await getState(page)).log.length === logLenBeforeEmpty,
    "Empty kg field blocks save (no new rows)",
    `Log grew from ${logLenBeforeEmpty}`,
    "Log tab → clear kg on only filled set → Save workout"
  );

  // Multiple sessions same day (use a date not in the seed loop)
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const sameDay = "2018-03-20";
  await page.fill("#date", sameDay);
  await fillExerciseSets(page, d1Exs[0].id, d1Exs[0].sets, 100, 8, 1);
  await saveWorkout(page);
  sessionCount++;
  uiSaveCount++;

  await page.fill("#date", sameDay);
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
  const actionAttnChip = page.locator("#attention .attn--new .attn__chip, #attention .attn--add .attn__chip").first();
  if ((await actionAttnChip.count()) > 0) {
    const actionMeta = await page.evaluate(() => {
      const groups = typeof window.__repforgeAttention === "function" ? window.__repforgeAttention() : [];
      const grp = groups.find((g) => g.key === "new" || g.key === "add");
      const item = grp?.items?.[0];
      return item ? { id: item.ex.id, day: item.ex.day } : null;
    });
    await actionAttnChip.click();
    await page.waitForSelector("#log.view.active", { timeout: 5000 });
    const actionNavOk = await page.evaluate(
      ({ id, day }) => {
        const tab = document.querySelector("#dayTabs button.active");
        const card = document.querySelector(`#workout [data-ex="${id}"]`);
        return tab?.dataset.day === day && !!card;
      },
      actionMeta || { id: "", day: "" }
    );
    assert(
      actionMeta && actionNavOk,
      "Action attention chip navigates to lift on Log tab",
      `meta=${JSON.stringify(actionMeta)} navOk=${actionNavOk}`,
      "Stats → click new/add attention chip → Log day tab + exercise card"
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

  // Nav accessibility: each tab exposes aria-current when active
  for (const view of ["log", "stats", "history", "program", "settings"]) {
    await nav(page, view);
    const current = await page.locator(`nav button[data-view="${view}"]`).getAttribute("aria-current");
    assert(
      current === "page",
      `Nav tab ${view} sets aria-current=page when active`,
      `aria-current=${current}`,
      `Click ${view} tab → inspect aria-current`
    );
  }
  const dimColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--steel-dim").trim());
  assert(
    dimColor.toLowerCase() === "#7b8899",
    "Secondary dim text token meets the audited AA value",
    `--steel-dim=${dimColor}`,
    "Computed style on :root → --steel-dim"
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
  const logEyebrow = await page.locator("#logContext").textContent();
  assert(
    logEyebrow.includes("Simulation Split"),
    "Log tab eyebrow shows the program name",
    `eyebrow=${logEyebrow}`,
    "Program tab → name program → Log tab eyebrow"
  );
  await page.click("#logContext");
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
    "Log tab → click #logContext → Stats Review active"
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

  // ── Phase 5: Delete sessions ─────────────────────────────────────
  beginPhase("Phase 5: Delete sessions");

  await nav(page, "history");
  const sessionsBefore = (await getState(page)).log.length;
  const delBtn = page.locator(".session__del").first();
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
  await page.evaluate(() => document.querySelector("#settings details.advanced")?.setAttribute("open", ""));
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
  const recText = await page.locator("#workout .exercise").first().locator(".rec").textContent();
  const hasAddLoad =
    recText.includes("Add load") || recText.includes("Add load ++") || recText.includes("Target");
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
    metricsText.includes("Sessions") && metricsText.includes("Sets logged"),
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
  await page.fill("#date", backdate);
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
  await page.fill("#date", collisionDate);
  const d2b = (await getExerciseMeta(page, logDay))[0];
  await fillExerciseSets(page, d2b.id, 1, 55, 8, 1);
  await page.fill("#notes", "collision-test-A");
  await Promise.all([page.click(".btn--save"), page.click(".btn--save")]);
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
  await page.fill("#date", "2018-04-01");
  const d3 = (await getExerciseMeta(page, "Day 3"))[0];
  await fillExerciseSets(page, d3.id, 1, 61.25, 8, 1);
  const logLenBeforeInvalid = (await getState(page)).log.length;
  await page.click(".btn--save");
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

  await clearState(page);
  await reloadApp(page);

  // Settings auto-save on change (no Save click)
  await nav(page, "settings");
  await page.evaluate(() => document.querySelector("#settings details.advanced")?.setAttribute("open", ""));
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

  // Prefill: reps/RIR default to last session
  await nav(page, "log");
  await selectDay(page, "Day 1");
  assert(
    (await page.inputValue(`[data-k="${exX}_1_reps"]`)) === "6" &&
      (await page.inputValue(`[data-k="${exX}_1_rir"]`)) === "1",
    "Log prefills reps/RIR from last session",
    `reps=${await page.inputValue(`[data-k="${exX}_1_reps"]`)} rir=${await page.inputValue(`[data-k="${exX}_1_rir"]`)}`,
    "Log → save a lift → reopen → reps/RIR match last session"
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
  const yTarget = +(yInfo.rec.match(/Target\s+([\d.]+)\s*kg/)?.[1] || 0);
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
  const gaugeLabel = await page.locator("#heatGauge .gauge__label").textContent();
  assert(
    /climb/i.test(gaugeLabel),
    "Route gauge labels ready lifts as climbs",
    `label="${gaugeLabel}"`,
    "Log → after add-load recs → gauge shows N climbs"
  );
  await page.locator("#heatGauge").click();
  assert(
    await page.evaluate(
      (id) => !document.querySelector(`.exercise[data-ex="${id}"]`)?.classList.contains("is-collapsed"),
      exHot.id
    ),
    "Route gauge click expands a ready checkpoint",
    "Card still collapsed after gauge click",
    "Tap route gauge → first ready checkpoint expands"
  );

  // Session notes persist on saved rows
  await page.fill("#notes", "Simulation session note");
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
  await page.locator(".session__edit").first().click();
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
  await nav(page, "settings");
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
  await page.click("#modeFocus");
  await page.waitForTimeout(80);
  const visible = await page.locator("#workout .exercise:not(.is-current)").evaluateAll((els) =>
    els.every((e) => getComputedStyle(e).display === "none")
  );
  assert(
    visible,
    "Focus mode shows one exercise at a time",
    "Non-current exercises visible in focus mode",
    "Log → Focus → only current card shown"
  );
  const focusMeta = await getExerciseMeta(page, "Day 1");
  await fillExerciseSets(page, focusMeta[0].id, focusMeta[0].sets, 90, 6, 1);
  await page.click("[data-fnext]");
  await page.waitForTimeout(80);
  for (let i = 0; i < focusMeta.length + 1; i++) {
    if (await page.locator("[data-ffinish]").count()) {
      await page.click("[data-ffinish]");
      break;
    }
    if (await page.locator("[data-fnext]").count()) {
      await page.click("[data-fnext]");
      await page.waitForTimeout(60);
    }
  }
  await page.waitForTimeout(120);
  assert(
    (await getState(page)).log.some((r) => r.exerciseId === focusMeta[0].id && +r.load === 90),
    "Finish workout saves focus-mode sets",
    "No saved row from focus mode",
    "Log → Focus → fill → Finish → rows saved"
  );
  await page.click("#modeFull");

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
    thisWeekText.includes("Status:"),
    "This Week card shows status line",
    `text=${thisWeekText.slice(0, 80)}`,
    "Stats → Overview → #thisWeek contains Status:"
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
  const logCtxMeso = await page.locator("#logContext").textContent();
  assert(
    /of 6/.test(logCtxMeso),
    "P7: Log context shows Week X of 6",
    `logContext=${logCtxMeso}`,
    "Log tab → #logContext includes of 6"
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

  beginPhase("Phase: P8 block review");
  const blockStarted = isoDateFromWeeksAgo(5);
  await persistState(page, {
    ...state,
    programMeta: { ...state.programMeta, started: blockStarted, mesocycleLengthWeeks: 6 },
  });
  await reloadApp(page);
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
  await page.fill("#date", deltaDate);
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

  beginPhase("Phase: command bar apply");
  await page.evaluate((d) => localStorage.removeItem(d), DRAFT);
  await reloadApp(page);
  await nav(page, "log");
  await selectDay(page, "Day 1");
  const cmdEx0 = await page.evaluate(() => document.querySelector("#workout .exercise")?.dataset.ex);
  assert(cmdEx0, "command bar: first exercise present", "no .exercise on Log tab", "Open Log with program loaded");
  await page.fill("#commandInput", "80 x 8 @1");
  await page.click("#commandApply");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)) === "80" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)) === "8" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_rir"]`)) === "1",
    "command apply: 80 x 8 @1 fills set 1",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)} rir=${await page.inputValue(`[data-k="${cmdEx0}_1_rir"]`)}`,
    "Log → type 80 x 8 @1 → Apply → set 1 inputs updated"
  );
  await page.fill("#commandInput", "set 2 60 x 10");
  await page.click("#commandApply");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_2_load"]`)) === "60" &&
      (await page.inputValue(`[data-k="${cmdEx0}_2_reps"]`)) === "10",
    "command apply: set 2 60 x 10 targets set 2",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_2_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_2_reps"]`)}`,
    "Log → type set 2 60 x 10 → Apply → set 2 inputs updated"
  );
  await page.fill("#commandInput", "not a set");
  await page.click("#commandApply");
  await page.waitForTimeout(120);
  const cmdBadToast = await page.locator("#toast").textContent();
  assert(
    cmdBadToast.includes("Could not read"),
    "command apply: invalid command shows error toast",
    `toast=${cmdBadToast}`,
    "Log → type nonsense → Apply → error toast, no crash"
  );
  assert(
    (await page.locator("#commandInput").inputValue()) === "not a set",
    "command apply: invalid command keeps input",
    `input=${await page.locator("#commandInput").inputValue()}`,
    "Invalid apply should not clear the command field"
  );
  await page.fill("#commandInput", "90 x 6 @2");
  await page.locator("#commandInput").press("Enter");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)) === "90" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)) === "6",
    "command apply: Enter key submits command",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)}`,
    "Log → type command → Enter → inputs updated"
  );

  assert(
    await page.locator("#commandHelp").isVisible(),
    "command help button visible on Log tab",
    "commandHelp not visible",
    "Log tab → ? button in command bar"
  );
  assert(
    (await page.locator("#commandInput").getAttribute("aria-describedby")) === "commandHelpText" &&
      (await page.locator("#commandHelpText").count()) === 1,
    "command input aria-describedby wired",
    `aria-describedby=${await page.locator("#commandInput").getAttribute("aria-describedby")}`,
    "Log tab → command input has screen-reader description"
  );
  await page.click("#commandHelp");
  await page.waitForTimeout(80);
  const glossaryBody = await page.locator("#glossary .glossary__body").textContent();
  assert(
    !(await page.locator("#glossary").getAttribute("class")).includes("hidden") &&
      (/x 8/i.test(glossaryBody) || /80 x 8/i.test(glossaryBody)),
    "command help opens glossary with syntax examples",
    `glossary body: ${glossaryBody?.slice(0, 80)}`,
    "Log → tap ? → glossary popover shows quick entry syntax"
  );
  await page.click("#glossary .glossary__close");

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
  await page.fill("#commandInput", "75 x 7 @1");
  await page.click("#commandApply");
  await page.waitForTimeout(120);
  assert(
    (await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)) === "75" &&
      (await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)) === "7",
    "typed command still applies with voice setting enabled",
    `load=${await page.inputValue(`[data-k="${cmdEx0}_1_load"]`)} reps=${await page.inputValue(`[data-k="${cmdEx0}_1_reps"]`)}`,
    "Log → enable voice (unsupported) → type 75 x 7 @1 → Apply"
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
    return { count: rows.length, allLoad: rows.length === 0 || rows.every((r) => /Load PR/i.test(r.textContent)), active };
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
  await page.fill("#date", "2026-01-15");
  await fillExerciseSets(page, browseEx.id, browseEx.sets, 100, 8, 2);
  await saveWorkout(page);
  await page.fill("#date", "2026-01-16");
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
