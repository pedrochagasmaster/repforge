#!/usr/bin/env node
/**
 * The recommendation surface must not move.
 *
 * Plan 046 commit 5 routes the range arithmetic through progression-engine.js.
 * The engine was extracted from this exact behavior, so the refactor is only
 * safe if it is invisible: every displayed target, every displayed explanation,
 * every per-set suggestion identical, for every branch of the decision tree.
 *
 * This gate captures that surface from the running app across a corpus built
 * to hit every branch — no history, performed top, near top, capacity double
 * jump, capacity top, below floor, stalled, recovery, capacity room, room in
 * range, block tempering, grid rounding, re-entry, in-session up/down/hold —
 * and compares it against a committed baseline recorded before the refactor.
 *
 * The baseline is data, not intent: it is whatever the app did beforehand.
 * A diff here is a regression to fix, never a baseline to refresh. Refresh it
 * only for a reviewed, intentional change in recommendation behavior, with
 * REPFORGE_PARITY_WRITE=1, and say so in the commit.
 *
 * Run:   node test/recommendation-parity.mjs
 * Write: REPFORGE_PARITY_WRITE=1 node test/recommendation-parity.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const BASELINE = resolve(import.meta.dirname, "fixtures", "recommendation-baseline.json");
const WRITE = process.env.REPFORGE_PARITY_WRITE === "1";
const KEY = "repforge_v1";

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

const SETTINGS = {
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
  unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
};

/** One lift, three working sets, 6-10 reps — the shape every case shares. */
function program(min = 6, max = 10, sets = 3) {
  return [{
    id: "ex0", day: "Day 1", order: 1, name: "Bench press", sets, min, max,
    primary: "Chest", secondary: "Triceps", notes: "", alternates: [],
  }];
}

/** Sessions oldest-first; each is [daysAgo, [[load, reps, rir], ...]]. */
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

/* Each case names the branch it is built to reach. Reaching it is asserted by
   the baseline itself: if a case stops hitting its branch, its recorded reason
   changes and the diff shows it. */
const CASES = [
  { name: "no history", log: [] },
  { name: "performed top of range", log: log([[14, three(60, 10, 1)], [7, three(60, 10, 1)]]) },
  { name: "near top, 3 sets, one rep short", log: log([[14, three(60, 10, 1)], [7, [[60, 10, 1], [60, 10, 1], [60, 9, 1]]]]) },
  { name: "capacity far above top (double jump)", log: log([[14, three(60, 10, 4)], [7, three(60, 10, 5)]]) },
  { name: "capacity above top, reps below", log: log([[14, three(60, 8, 3)], [7, three(60, 8, 3)]]) },
  { name: "capacity below floor", log: log([[14, three(60, 5, 0)], [7, three(60, 4, 0)]]) },
  { name: "stalled across sessions", log: log([[28, three(60, 7, 1)], [21, three(60, 7, 1)], [14, three(60, 7, 1)], [7, three(60, 7, 1)]]) },
  { name: "room in range", log: log([[14, three(60, 7, 1)], [7, three(60, 7, 1)]]) },
  { name: "capacity room, push reps", log: log([[14, three(60, 6, 3)], [7, three(60, 6, 3)]]) },
  { name: "single session only", log: log([[7, three(60, 8, 2)]]) },
  { name: "sub-increment history load", log: log([[14, three(61, 8, 2)], [7, three(61, 8, 2)]]) },
  { name: "very light load, floor clamp", log: log([[14, three(2.5, 5, 0)], [7, three(2.5, 4, 0)]]) },
  { name: "falling block trend, double jump tempered", log: log([[28, three(80, 10, 5)], [21, three(75, 10, 5)], [14, three(70, 10, 5)], [7, three(65, 10, 5)]]) },
  { name: "rising block trend", log: log([[28, three(60, 8, 2)], [21, three(65, 8, 2)], [14, three(70, 8, 2)], [7, three(75, 8, 2)]]) },
  { name: "mixed reps within session", log: log([[14, [[60, 10, 1], [60, 8, 2], [60, 6, 3]]], [7, [[60, 10, 1], [60, 8, 2], [60, 7, 2]]]]) },
  { name: "wide range 5-15", log: log([[14, three(60, 12, 2)], [7, three(60, 12, 2)]]), min: 5, max: 15 },
  { name: "narrow range 8-8", log: log([[14, three(60, 8, 1)], [7, three(60, 8, 1)]]), min: 8, max: 8 },
  { name: "single working set", log: log([[14, [[60, 10, 1]]], [7, [[60, 10, 1]]]]), sets: 1 },
  { name: "null rir throughout", log: log([[14, three(60, 8, null)], [7, three(60, 8, null)]]) },
  { name: "long history, twelve sessions", log: log(Array.from({ length: 12 }, (_, i) => [84 - i * 7, three(60 + i * 2.5, 8, 2)])) },
];

/* In-session drafts exercise evaluateCurrentRange: the second and third set
   suggestions after one or two sets are already logged today. */
const DRAFTS = [
  { name: "no sets logged today", draft: {} },
  { name: "one strong set logged", sets: [[60, 10, 0]] },
  { name: "one weak set logged", sets: [[60, 4, 0]] },
  { name: "one on-target set logged", sets: [[60, 8, 2]] },
  { name: "two fading sets logged", sets: [[60, 9, 1], [60, 7, 1]] },
];

/** Round floats so a last-bit difference in an unrelated engine cannot make
 *  the gate flap; 6 decimals is far finer than anything the UI can show. */
function stable(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : String(value);
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}

const DRAFT_KEY = "repforge_draft_v1";

/** Seed both mirrors the way the other browser gates do — localStorage alone
 *  loses to boot-time IndexedDB recovery and every case would read as new. */
async function seed(page, blob) {
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
    { k: KEY, d: DRAFT_KEY },
  );
  await page.evaluate(
    async ({ k, value }) => {
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
    },
    { k: KEY, value: blob },
  );
}

const browser = await launchChromium();
const captured = {};

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  for (const testCase of CASES) {
    const blob = {
      settings: SETTINGS,
      programMeta: {
        id: "prog-parity", name: "Parity fixture", started: iso(90),
        created: "2026-05-01T00:00:00.000Z", updated: "2026-05-01T00:00:00.000Z",
        onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
        goal: null, experience: null, daysPerWeek: 1, splitType: "full_body",
        equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
      },
      program: program(testCase.min, testCase.max, testCase.sets),
      log: testCase.log,
      programHistory: [],
    };
    await seed(page, blob);
    await page.reload();
    await waitForAppBoot(page, { base: BASE });
    await page.evaluate(() => window.closeFirstRun?.());

    captured[testCase.name] = await page.evaluate((drafts) => {
      const P = window.__repforgeProgression;
      const ex = P.programSlot("ex0");
      if (!ex) throw new Error("parity fixture slot ex0 did not load");
      const rec = P.recommendation(ex);
      const out = {
        rec,
        explain: P.explainRecommendation(ex),
        suggestions: {},
      };
      for (const spec of drafts) {
        const draft = spec.draft || (() => {
          const d = { __done: [], __warm: [], __touched: [] };
          spec.sets.forEach(([load, reps, rir], i) => {
            const key = `ex0_${i + 1}`;
            d[`${key}_load`] = String(load);
            d[`${key}_reps`] = String(reps);
            d[`${key}_rir`] = String(rir);
            d.__done.push(key);
          });
          return d;
        })();
        const perSet = [];
        for (let n = 1; n <= ex.sets; n++) perSet.push(P.setSuggestion(ex, n, rec, draft, null));
        out.suggestions[spec.name] = perSet;
      }
      return out;
    }, DRAFTS);
  }
  await context.close();
} finally {
  await browser.close();
}

const snapshot = stable(captured);

if (WRITE) {
  writeFileSync(BASELINE, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const branches = new Set(Object.values(captured).map((c) => c.rec.reason));
  console.log(`\nWROTE baseline: ${Object.keys(captured).length} cases, ${branches.size} distinct branches`);
  console.log(`branches: ${[...branches].sort().join(", ")}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`No baseline at ${BASELINE}. Record one first with REPFORGE_PARITY_WRITE=1.`);
  process.exit(2);
}

const expected = JSON.parse(readFileSync(BASELINE, "utf8"));

console.log("Recommendation parity against the recorded baseline\n");
const branches = new Set();
for (const name of Object.keys(expected)) {
  const want = expected[name];
  const got = snapshot[name];
  branches.add(want.rec?.reason);
  if (!got) {
    assert(false, `${name}: present`, "case missing from this run");
    continue;
  }
  assert(
    JSON.stringify(got.rec) === JSON.stringify(want.rec),
    `${name}: recommendation identical`,
    `want ${JSON.stringify(want.rec)}\n    got  ${JSON.stringify(got.rec)}`,
  );
  assert(
    JSON.stringify(got.explain) === JSON.stringify(want.explain),
    `${name}: explanation identical`,
    `want ${JSON.stringify(want.explain)}\n    got  ${JSON.stringify(got.explain)}`,
  );
  assert(
    JSON.stringify(got.suggestions) === JSON.stringify(want.suggestions),
    `${name}: per-set suggestions identical`,
    `want ${JSON.stringify(want.suggestions)}\n    got  ${JSON.stringify(got.suggestions)}`,
  );
}

const extra = Object.keys(snapshot).filter((name) => !(name in expected));
assert(extra.length === 0, "no undeclared case appeared", extra.join(", "));

console.log(`\ncovered branches: ${[...branches].filter(Boolean).sort().join(", ")}`);
console.log(`${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
