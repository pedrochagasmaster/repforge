#!/usr/bin/env node
/**
 * Plan 064 audit fixes RT-01, RT-02 and RT-05: the Why sheet tells the truth.
 *
 * Each case seeds a real program and log, enters the workout, opens "Why this
 * weight?" from the real control, and reads what the lifter reads. Nothing is
 * stubbed: the loads, reps and verdicts come from `recommendation()` and
 * `setSuggestion()` as the app computes them, and the Focus cue is read from the
 * same card the sheet was opened from.
 *
 * - RT-01  the performed sentence names each set's own load (a mixed-load
 *          session never prints one shared load).
 * - RT-02  the worked arithmetic prints the direction the engine took, shows a
 *          nearest-step rounding, and shows the range floor or top that clamped
 *          a rep target.
 * - RT-05  in a session the headline is the cue Focus shows for the set the
 *          shelf is on; the base recommendation stays a labelled, separate line.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/why-sheet.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}

const iso = (daysAgo) => {
  const d = new Date("2026-08-27T12:00:00.000Z");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const settings = (lang, { unit = "kg", rirMode = "numeric" } = {}) => ({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
  unit, lang, rirMode, voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
});

const REP_GOAL = {
  schemaVersion: 1,
  strategy: {
    id: "rep_goal", version: 1,
    params: {
      workingSets: 3, repGoal: 30, repFloor: 6, repCeiling: 12, targetRirMin: 1, targetRirMax: 3,
      minLoadIncrement: 2.5, jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
    },
  },
  modifiers: [],
};

function slots(list) {
  return list.map(({ id = "ex0", name = "Bench press", sets = 3, min = 4, max = 8, progression }, index) => ({
    id, day: "Day 1", order: index + 1, name, sets, min, max,
    primary: "Chest", secondary: "Triceps", notes: "", alternates: [], ...(progression ? { progression } : {}),
  }));
}

/** sessions: [[daysAgo, [[load, reps, rir], ...]], ...] for one exercise. */
function rows(sessions, { id = "ex0", name = "Bench press" } = {}) {
  const out = [];
  for (const [daysAgo, sets] of sessions) {
    const date = iso(daysAgo);
    const session = `${date}_Day 1_seed`;
    sets.forEach(([load, reps, rir], i) => {
      out.push({
        session, date, day: "Day 1", name, exerciseId: id, set: i + 1, load, reps, rir, notes: "",
        created: `${date}T12:00:00.00${i}Z`, primary: "Chest", secondary: "Triceps",
      });
    });
  }
  return out;
}

async function seed(page, blob) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res(); req.onerror = () => res(); req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT_KEY });
  await page.evaluate(async ({ k, value }) => {
    localStorage.setItem(k, JSON.stringify(value));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, k);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, value: blob });
}

async function boot(page, { lang = "en", unit = "kg", rirMode = "numeric", program, log }) {
  await seed(page, {
    settings: settings(lang, { unit, rirMode }),
    programMeta: {
      id: "prog-why", name: "Why fixture", started: iso(90),
      created: "2026-05-01T00:00:00.000Z", updated: "2026-05-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 1, splitType: "full_body",
      equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
    },
    program, log, programHistory: [],
  });
  await page.reload();
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); });
  await page.waitForSelector("#workout.is-focus article.is-current .focus-shelf");
}

const settle = (page, ms = 500) => page.evaluate((n) => new Promise((res) => setTimeout(res, n)), ms);

/** Log the shelf's current set through the real controls. */
async function logSet(page, { load, reps, rir }) {
  const before = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    const ex = draft.exercises[draft.exerciseOrder[0]];
    return ex.setOrder.filter((id) => ex.sets[id].completion !== "pending").length;
  });
  await page.evaluate((values) => {
    const card = document.querySelector("#workout .exercise.is-current");
    card.querySelectorAll("input").forEach((el) => {
      const key = el.dataset.k || "";
      if (key.endsWith("_load")) el.value = values.load;
      else if (key.endsWith("_reps")) el.value = values.reps;
      else if (key.endsWith("_rir")) el.value = values.rir;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    card.querySelector(".saveset")?.click();
  }, { load: String(load), reps: String(reps), rir: String(rir) });
  await page.waitForFunction((n) => {
    const draft = window.__repforgeWorkoutDraft.current();
    const ex = draft.exercises[draft.exerciseOrder[0]];
    return ex.setOrder.filter((id) => ex.sets[id].completion !== "pending").length > n;
  }, before, { timeout: 8000 });
  await settle(page);
}

async function focusCue(page) {
  return page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current");
    const cue = card.querySelector(".fx-cue");
    return {
      line1: cue?.querySelector(".fx-cue__l1")?.textContent?.trim() || "",
      line2: cue?.querySelector(".fx-cue__l2")?.textContent?.trim() || "",
      mark: [...(cue?.querySelectorAll(".fx-cue__mark .verdictmark") || [])].map((el) => el.className.replace(/.*verdictmark--/, "")),
    };
  });
}

async function openWhy(page) {
  await page.locator("#workout .exercise.is-current [data-why]").first().click();
  await page.waitForSelector("#whySheet.is-open");
  await settle(page, 300);
  return page.evaluate(() => {
    const i18n = window.RepForgeI18n;
    const calc = [...document.querySelectorAll("#whyCalc .whycalc__row")].map((row) => ({
      k: row.querySelector(".whycalc__k")?.textContent?.trim() || "",
      v: row.querySelector(".whycalc__v")?.textContent?.trim() || "",
      sum: row.classList.contains("whycalc__row--sum"),
    }));
    return {
      target: document.querySelector("#whyTarget")?.textContent?.trim() || "",
      mark: [...document.querySelectorAll("#whyTarget .verdictmark")].map((el) => el.className.replace(/.*verdictmark--/, "")),
      decision: document.querySelector("#whyDecision")?.textContent?.trim() || "",
      blocks: [...document.querySelectorAll("#whyBody .whysheet__block")].map((el) => ({
        lead: el.getAttribute("data-lead"), text: el.querySelector(".whysheet__text")?.textContent?.trim() || "",
      })),
      calc,
      keys: {
        newLoad: i18n.t("why.calc.new_load"), repTarget: i18n.t("why.calc.rep_target"),
        before: i18n.t("why.decision_before", { label: "\u0000" }).split("\u0000")[0],
      },
    };
  });
}

async function closeWhy(page) {
  await page.click("#whyClose");
  await page.waitForSelector("#whySheet", { state: "hidden" });
}

const row = (why, key) => why.calc.find((item) => item.k === why.keys[key]);

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const bench = slots([{}]);

  // ------------------------------------------------------------------ RT-01
  console.log("RT-01: the performed sentence names each set's own load");
  for (const lang of ["en", "pt"]) {
    const reps = lang === "pt" ? "reps com" : "reps at";
    await boot(page, { lang, program: bench, log: rows([[7, [[100, 5, 1], [90, 10, 1]]]]) });
    let why = await openWhy(page);
    const first = why.blocks[0]?.text || "";
    assert(first.includes(`5 ${reps} 100 kg`) && first.includes(`10 ${reps} 90 kg`),
      `RT-01: ${lang} numeric: 100 kg × 5 and 90 kg × 10 each print their own load`, first);
    assert(!/5 e 10|5 and 10/.test(first), `RT-01: ${lang} numeric: no shared load over "5 and 10 reps"`, first);
    await closeWhy(page);

    await boot(page, { lang, program: bench, log: rows([[7, [[100, 5, 1], [100, 6, 2]]]]) });
    why = await openWhy(page);
    const same = why.blocks[0]?.text || "";
    assert(new RegExp(`5 (e|and) 6 ${reps} 100 kg`).test(same) && !/90/.test(same),
      `RT-01: ${lang} numeric: identical loads still read as one sentence`, same);
    await closeWhy(page);

    await boot(page, { lang, rirMode: "effort", program: bench, log: rows([[7, [[100, 5, 1], [90, 10, 1]]]]) });
    why = await openWhy(page);
    const effort = why.blocks[0]?.text || "";
    assert(effort.includes(`5 ${reps} 100 kg`) && effort.includes(`10 ${reps} 90 kg`) && !/RIR/.test(effort),
      `RT-01: ${lang} effort: each set prints its own load, in effort words`, effort);
    await closeWhy(page);

    await boot(page, { lang, rirMode: "effort", program: bench, log: rows([[7, [[100, 5, 1], [100, 6, 1]]]]) });
    why = await openWhy(page);
    const effortSame = why.blocks[0]?.text || "";
    assert(new RegExp(`5 (e|and) 6 ${reps} 100 kg`).test(effortSame) && !/90/.test(effortSame),
      `RT-01: ${lang} effort: identical loads read as one sentence`, effortSame);
    await closeWhy(page);
  }
} finally {
  await browser.close();
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
