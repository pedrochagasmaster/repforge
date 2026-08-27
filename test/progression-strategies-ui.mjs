#!/usr/bin/env node
/**
 * The strategies approved in the Plan 046 numeric gate have to be usable, not
 * merely computable.
 *
 * `test/progression-engine.mjs` proves the arithmetic against the locked
 * fixture. This gate proves the other half: that a program slot carrying a
 * `rep_goal@1` or `anchor_backoff@1` prescription actually renders a
 * recommendation, per-set targets, and an explanation in the running app — in
 * both English and Portuguese, without ever leaking an internal strategy id or
 * a raw translation key at the lifter.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/progression-strategies-ui.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";

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

const iso = (daysAgo) => {
  const d = new Date("2026-08-27T12:00:00.000Z");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const settings = (lang) => ({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
  unit: "kg", lang, rirMode: "numeric", voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
});

const REP_GOAL = {
  schemaVersion: 1,
  strategy: {
    id: "rep_goal",
    version: 1,
    params: {
      workingSets: 3, repGoal: 30, repFloor: 6, repCeiling: 12,
      targetRirMin: 1, targetRirMax: 3,
      minLoadIncrement: 2.5, jumpPercent: 2.5,
      distributionPolicy: "balanced_frontload_v1",
    },
  },
  modifiers: [],
};

const ANCHOR = {
  schemaVersion: 1,
  strategy: {
    id: "anchor_backoff",
    version: 1,
    params: {
      anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 1, anchorTargetRirMax: 3,
      backoffSets: 3, backoffRepMin: 6, backoffRepMax: 10, backoffPercent: 0.8,
      minLoadIncrement: 2.5, jumpPercent: 2.5,
    },
  },
  modifiers: [],
};

function slot({ sets, min, max, progression }) {
  return [{
    id: "ex0", day: "Day 1", order: 1, name: "Bench press", sets, min, max,
    primary: "Chest", secondary: "Triceps", notes: "", alternates: [], progression,
  }];
}

function log(sessions) {
  const rows = [];
  for (const [daysAgo, sets] of sessions) {
    const date = iso(daysAgo);
    const session = `${date}_Day 1_seed`;
    sets.forEach(([load, reps, rir], i) => {
      rows.push({
        session, date, day: "Day 1", name: "Bench press", exerciseId: "ex0",
        set: i + 1, load, reps, rir, notes: "",
        created: `${date}T12:00:00.00${i}Z`, primary: "Chest", secondary: "Triceps",
      });
    });
  }
  return rows;
}

const three = (load, reps, rir) => [[load, reps, rir], [load, reps, rir], [load, reps, rir]];

async function seed(page, blob) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT_KEY });
  await page.evaluate(async ({ k, value }) => {
    localStorage.setItem(k, JSON.stringify(value));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, value: blob });
}

async function capture(page, { lang, program, rows, current }) {
  await seed(page, {
    settings: settings(lang),
    programMeta: {
      id: "prog-strategy", name: "Strategy fixture", started: iso(90),
      created: "2026-05-01T00:00:00.000Z", updated: "2026-05-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 1, splitType: "full_body",
      equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
    },
    program,
    log: rows,
    programHistory: [],
  });
  await page.reload();
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.closeFirstRun?.());
  return page.evaluate((done) => {
    const P = window.__repforgeProgression;
    const ex = P.programSlot("ex0");
    if (!ex) throw new Error("strategy fixture slot ex0 did not load");
    const rec = P.recommendation(ex);
    const draft = { __done: [], __warm: [], __touched: [] };
    (done || []).forEach(([load, reps, rir], i) => {
      const key = `ex0_${i + 1}`;
      draft.__done.push(key);
      draft[`${key}_load`] = String(load);
      draft[`${key}_reps`] = String(reps);
      draft[`${key}_rir`] = String(rir);
    });
    const suggestions = [];
    for (let n = 1; n <= ex.sets; n++) suggestions.push(P.setSuggestion(ex, n, rec, draft, null));
    return { rec, suggestions, explain: P.explainRecommendation(ex) };
  }, current || []);
}

/** Nothing the lifter reads may carry an internal identifier or a raw key. */
const LEAKS = [/rep_goal/i, /anchor_backoff/i, /@1\b/, /\brange@/i, /^[a-z]+\.[a-z_.]+$/];
function prose(capture) {
  return [capture.rec.label, capture.rec.text, ...capture.explain.flatMap((row) => [row.label, row.text])]
    .filter((value) => typeof value === "string" && value.length);
}
function leaked(capture) {
  return prose(capture).filter((text) => LEAKS.some((pattern) => pattern.test(text)));
}

const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  const repGoalProgram = slot({ sets: 3, min: 6, max: 12, progression: REP_GOAL });
  const anchorProgram = slot({ sets: 4, min: 3, max: 10, progression: ANCHOR });

  console.log("rep_goal@1");
  const goalMet = await capture(page, { lang: "en", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(goalMet.rec.status === "add", "the earned total advances the load", goalMet.rec.status);
  assert(goalMet.rec.load === 102.5, "the advanced load reaches the lifter", goalMet.rec.load);
  assert(goalMet.rec.label.length > 0 && goalMet.rec.text.includes("30"),
    "the copy names the authored total", goalMet.rec.text);
  assert(goalMet.suggestions.every((s) => s.reps === 10 && s.load === 102.5),
    "every set carries the redistributed target", JSON.stringify(goalMet.suggestions));
  assert(goalMet.explain.length > 0, "the explanation sheet has rows");
  assert(leaked(goalMet).length === 0, "no strategy id or raw key reaches the lifter", leaked(goalMet).join(" | "));

  const goalMissed = await capture(page, { lang: "en", program: repGoalProgram, rows: log([[7, three(100, 8, 2)]]) });
  assert(goalMissed.rec.status === "hold", "missing the total holds the load", goalMissed.rec.status);
  assert(goalMissed.rec.text.includes("24") && goalMissed.rec.text.includes("30"),
    "the copy names progress toward the total", goalMissed.rec.text);

  const partial = await capture(page, {
    lang: "en", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]),
    current: [[100, 11, 3], [100, 10, 3]],
  });
  assert(partial.suggestions[2].reps === 9, "the third set asks for the exact remaining reps", partial.suggestions[2].reps);
  assert(partial.suggestions[2].load === 100, "an in-session target holds the session load", partial.suggestions[2].load);

  console.log("anchor_backoff@1");
  const anchorAdvance = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
  });
  assert(anchorAdvance.rec.status === "add", "a top set at the range top advances", anchorAdvance.rec.status);
  assert(anchorAdvance.suggestions[0].load === 102.5, "the anchor set carries the advanced load", anchorAdvance.suggestions[0].load);
  assert(anchorAdvance.suggestions.slice(1).every((s) => s.load === 82.5),
    "the back-off sets carry the derived load", JSON.stringify(anchorAdvance.suggestions.slice(1)));
  assert(anchorAdvance.suggestions[0].load > anchorAdvance.suggestions[1].load,
    "the anchor is always heavier than its back-offs");
  assert(leaked(anchorAdvance).length === 0, "no strategy id or raw key reaches the lifter", leaked(anchorAdvance).join(" | "));

  const anchorLogged = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
    current: [[100, 5, 2]],
  });
  assert(anchorLogged.suggestions[1].load === 80,
    "today's anchor re-derives the untouched back-offs", anchorLogged.suggestions[1].load);
  assert(anchorLogged.rec.text.length > 0, "the in-session copy explains the lighter sets");

  const anchorFailed = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
    current: [[100, 2, 0]],
  });
  // The header recommendation is the next-session decision; the recalibration
  // is what the still-unlogged sets get, which is where it has to land.
  assert(anchorFailed.suggestions[1].src === "session-down",
    "a failed anchor recalibrates the untouched sets rather than pushing on", anchorFailed.suggestions[1].src);
  assert(anchorFailed.suggestions[1].load < anchorAdvance.suggestions[1].load,
    "the recalibrated back-off is lighter than the advancing one",
    `${anchorFailed.suggestions[1].load} vs ${anchorAdvance.suggestions[1].load}`);
  assert(leaked(anchorFailed).length === 0, "a recalibration says so in plain language", leaked(anchorFailed).join(" | "));

  console.log("Portuguese");
  const ptGoal = await capture(page, { lang: "pt", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(ptGoal.rec.label !== goalMet.rec.label, "the label follows the UI language", ptGoal.rec.label);
  assert(ptGoal.rec.load === 102.5, "the target is language-independent", ptGoal.rec.load);
  assert(leaked(ptGoal).length === 0, "Portuguese copy leaks nothing either", leaked(ptGoal).join(" | "));

  const ptAnchor = await capture(page, {
    lang: "pt", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
  });
  assert(ptAnchor.rec.label !== anchorAdvance.rec.label, "the anchor label follows the UI language", ptAnchor.rec.label);
  assert(leaked(ptAnchor).length === 0, "Portuguese anchor copy leaks nothing", leaked(ptAnchor).join(" | "));

  console.log("legacy programs are untouched");
  const legacySlot = slot({ sets: 3, min: 6, max: 10, progression: null });
  delete legacySlot[0].progression;
  const legacy = await capture(page, {
    lang: "en", program: legacySlot,
    rows: log([[14, three(60, 10, 1)], [7, three(60, 10, 1)]]),
  });
  assert(legacy.rec.status === "add", "a slot with no prescription still runs range@1", legacy.rec.status);
  assert(legacy.rec.strategy === undefined, "range@1 keeps its released result shape");
} finally {
  await browser.close();
}

console.log(`\nprogression strategies UI: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
