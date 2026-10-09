#!/usr/bin/env node
/**
 * The screen a finished session earns: what it claims, what it refuses to
 * claim, and what it does to the app underneath it.
 *
 * Covers the record rules (a lift with no history sets none; load outranks
 * reps outranks e1RM), the counts, the muscle and week blocks, the baseline
 * copy a first session gets instead of records, dialog behaviour (focus trap,
 * Escape, background inert), where each action lands, and the toast fallback
 * for a save that cannot open the screen. It also owns the persistent-storage
 * request (made once, at the first completed session, never at boot) and the
 * Settings durability line that reports what the browser says.
 *
 * Run: node test/session-summary.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium } from "./browser.mjs";
import { selectExercise, finishEarly, openEarlyFinish } from "./fixtures/focus-workout.mjs";
import { installGeneratedProgram, isWeightRepsSlot, definitionSlot, metricLogRow } from "./fixtures/history-metric-rows.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

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
const phase = (n) => console.log(`\n${n}`);

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const WEIGHT_REPS = [
  { id: WEIGHT, sourceName: "Weight", semantic: "loadKg", unit: "kg" },
  { id: REPS, sourceName: "Reps", semantic: "reps", unit: "reps" },
];

/** Two days: Day 1 carries the lifts under test, Day 2 exists so "Next up" has
 *  somewhere to point and the week has more than one planned session. The Day 1
 *  lifts are the lifter's own Weight+Reps movements, so their muscle attribution is
 *  exactly what the breakdown below reads; Day 2 is a catalog movement.
 *  [day, name, sets, min, max, primary, secondary, catalog movement] */
const TEMPLATES = [
  ["Day 1", "Bench press", 2, 6, 10, "Chest", "Triceps"],
  ["Day 1", "Barbell row", 2, 6, 10, "Mid/upper back", "Biceps"],
  ["Day 1", "Dumbbell curl", 1, 8, 12, "Biceps", ""],
  ["Day 2", "Back squat", 2, 4, 8, "", "", "Barbell back squat"],
];

/** The canonical program, built once through the app's own Build definition. */
let BUILT = null;

async function buildProgram(page) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.(), undefined, { timeout: 15000 });
  BUILT = await page.evaluate(({ templates, metrics, started }) => {
    const byName = new Map(window.RepForgeExerciseCatalog.snapshot().exercises.map((entry) => [entry.name, entry]));
    const customs = [];
    const perDay = new Map();
    const rows = templates.map(([day, name, sets, min, max, primary, secondary, movement], i) => {
      const order = (perDay.get(day) || 0) + 1;
      perDay.set(day, order);
      let libraryId = movement ? byName.get(movement)?.id : `custom:summary-${i}`;
      if (!libraryId) throw new Error(`catalog has no movement named ${movement}`);
      if (!movement) customs.push({ id: libraryId, name, namePt: name, archived: false, equipment: ["barbell"],
        primary, secondary, notes: "", created: "2026-07-01T00:00:00.000Z",
        metricIds: metrics.map((metric) => metric.id), metricDefinitions: metrics });
      return { id: `ex${i}`, day, order, name, ...(movement ? { displayName: name } : {}), libraryId, sets, min, max,
        primary, secondary, notes: "" };
    });
    const definition = manualProgramDefinitionFromRows(rows, ["Day 1", "Day 2"], customs);
    if (!definition) throw new Error("the app rejected the summary program");
    const programMeta = {
      id: "prog-summary", name: "Summary fixture", started,
      created: "2026-07-01T00:00:00.000Z", updated: "2026-07-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: definition.cycles,
      goal: null, experience: null, daysPerWeek: 2, splitType: null,
      equipment: [], priorityMuscles: [], sessionLength: null, completedAt: null,
      progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [], entrySource: null,
      programDefinition: definition,
    };
    return { program: durableProgramRows(definition, customs, programMeta), programMeta, customExercises: customs };
  }, { templates: TEMPLATES, metrics: WEIGHT_REPS, started: isoDaysAgo(14) });
}

function fixture({ log = [] } = {}) {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: structuredClone(BUILT.programMeta),
    program: structuredClone(BUILT.program),
    log,
    programHistory: [],
    customExercises: structuredClone(BUILT.customExercises),
  };
}

/** One past session on Day 1 so records have a bar to clear, in the metric shape a finished workout commits. */
function history(date, rows) {
  const session = `${date}_Day 1_seed`;
  return rows.map(([exerciseId, , set, load, reps, rir]) =>
    metricLogRow(BUILT.programMeta, BUILT.program.find((row) => row.id === exerciseId), {
      session, date, day: "Day 1", set, load, reps, rir,
    }));
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
}

async function seed(page, state) {
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
}

/** Fill and commit one set through the Focus well, the way a lifter logs it. */
async function logSet(page, exId, n, load, reps, rir) {
  await selectExercise(page, exId);
  for (const [field, value] of [[`metric_${WEIGHT}`, load], [`metric_${REPS}`, reps], ["rir", rir]]) {
    const input = page.locator(`#workout .exercise.is-current [data-k="${exId}_${n}_${field}"]`);
    if (await input.getAttribute("aria-hidden") === "true")
      await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${field}"]`).click();
    await input.fill(String(value));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  await page.locator(`#workout .exercise.is-current [data-save="${exId}_${n}"]`).click();
  await page.waitForFunction(
    ({ exId, n, load, reps, rir, weight, repsId }) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      const exercise = draft?.exercises?.[exId];
      const set = Object.values(exercise?.sets || {}).find(s => s.ordinal === n);
      return set?.completion !== "pending" &&
        set?.edited?.metrics?.[weight] === String(load) &&
        set?.edited?.metrics?.[repsId] === String(reps) &&
        set?.edited?.rir === String(rir);
    },
    { exId, n, load, reps, rir, weight: WEIGHT, repsId: REPS },
    { timeout: 15000 },
  );
}

async function enterLog(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
}

/** Record every figure the stat row paints from before the summary opens, so the ramp is read, not guessed. */
async function recordRamp(page) {
  await page.evaluate(() => {
    const read = () => [...document.querySelectorAll("#sessionSummary .sum-stats .statrow__val")].map((n) => n.textContent);
    const series = [];
    const body = document.querySelector("#sessionSummaryBody");
    const observer = new MutationObserver(() => {
      const figures = read();
      if (figures.length) series.push({ t: performance.now(), figures });
    });
    observer.observe(body, { subtree: true, childList: true, characterData: true });
    window.__sumRamp = { series, stop: () => observer.disconnect() };
  });
}

async function finish(page, { reduced = false } = {}) {
  await recordRamp(page);
  await finishEarly(page);
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
  await assertCountRamp(page, { reduced });
}

/**
 * The session summary keeps its count ramp (motion amendment M2): the totals count up over 600 ms through
 * the motion layer and land on the figures the markup carries. Nothing else moves: no row stagger, no
 * crest, no overshoot and no odometer digits. Reduced motion prints the final figures on the first read
 * and never paints a lower one.
 */
async function assertCountRamp(page, { reduced }) {
  const probe = () =>
    page.evaluate(() => {
      const el = document.querySelector("#sessionSummary");
      return {
        figures: [...el.querySelectorAll(".sum-stats .statrow__val")].map((n) => n.textContent),
        final: [...el.querySelectorAll(".sum-stats .statrow__val")].map((n) => n.dataset.ramp),
        running: el.getAnimations({ subtree: true }).length,
        played: el.classList.contains("is-played"),
        staged: !!el.querySelector("[style*='--i']"),
        opaque: [...el.querySelectorAll("#sessionSummaryBody > *")].every((n) => getComputedStyle(n).opacity === "1"),
        digits: el.querySelectorAll(".sum-stats .odometer, .sum-stats [class*='digit']").length,
      };
    });
  const first = await probe();
  assert(!first.played && !first.staged && first.opaque && first.digits === 0,
    "no stagger or crest: no staged class, every block fully opaque from the first frame, no odometer digits", JSON.stringify(first));
  assert(first.running === 0, "the ramp is script-driven: no CSS animation runs on the summary", String(first.running));
  if (reduced) {
    assert(first.figures.every((v) => /[1-9]/.test(v)), "reduced motion shows the final figures on the first read", JSON.stringify(first.figures));
  }
  // Wait out the ramp (600 ms) with margin, then read twice: the figures have landed and do not move.
  await page.waitForTimeout(1300);
  const landed = await probe();
  await page.waitForTimeout(400);
  const later = await probe();
  assert(landed.figures.join("|") === later.figures.join("|") && landed.figures.every((v) => /[1-9]/.test(v)),
    "the totals land on their final figures and stay put", JSON.stringify({ landed: landed.figures, later: later.figures }));
  assert(landed.running === 0 && later.running === 0, "nothing on the summary is animating once the ramp has landed");
  const numeric = (text) => {
    const n = parseFloat(String(text).replace(/[^0-9.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
    return String(text).endsWith("k") ? n * 1000 : n;
  };
  const series = await page.evaluate(() => {
    window.__sumRamp.stop();
    return window.__sumRamp.series;
  });
  const painted = series.map((entry) => entry.figures);
  const final = landed.figures;
  assert(painted.length > 0 && painted.at(-1).join("|") === final.join("|"), "the last paint is the final figures", JSON.stringify({ last: painted.at(-1), final }));
  // Never above the final figure (no overshoot), and never going back down once counting (no wobble).
  let overshoot = false, wobble = false;
  final.forEach((text, cell) => {
    let previous = -Infinity;
    for (const figures of painted) {
      const value = numeric(figures[cell]);
      if (!Number.isFinite(value)) continue;
      if (value > numeric(text) + 1e-9) overshoot = true;
      if (value + 1e-9 < previous) wobble = true;
      previous = value;
    }
  });
  assert(!overshoot && !wobble, "the ramp never overshoots a figure and never steps back", JSON.stringify(painted.slice(0, 12)));
  const lowest = painted.some((figures) => figures.some((v, cell) => numeric(v) < numeric(final[cell])));
  if (reduced) {
    assert(!lowest, "reduced motion never paints a figure below its final value", JSON.stringify(painted.slice(0, 6)));
  } else {
    assert(lowest, "the totals count up: figures below the final value are painted on the way", JSON.stringify(painted.slice(0, 6)));
    const span = series.at(-1).t - series[0].t;
    assert(span >= 300 && span <= 1300, "the count-up takes about 600 ms", String(Math.round(span)));
  }
}

const readSummary = (page) =>
  page.evaluate(() => {
    const el = document.querySelector("#sessionSummary");
    const body = document.querySelector("#sessionSummaryBody");
    const txt = (sel) => [...body.querySelectorAll(sel)].map((n) => n.textContent.trim());
    return {
      open: !el.classList.contains("hidden") && el.hidden === false,
      eyebrow: body.querySelector(".sum-eyebrow")?.textContent.trim() || "",
      hero: body.querySelector(".sum-hero")?.textContent.trim() || "",
      sub: body.querySelector(".sum-sub")?.textContent.trim() || "",
      statCaps: txt(".sum-stats .statrow__cap"),
      statVals: txt(".sum-stats .statrow__val"),
      // Direction D (spec 4.4): a record is one line inside the group of the lift that set it.
      prMarks: body.querySelectorAll(".sum-pr .verdictmark--record").length,
      prNames: [...body.querySelectorAll(".sum-grp")].filter((g) => g.querySelector(".sum-pr")).map((g) => g.querySelector(".sum-grp__n").textContent.trim()),
      prOver: txt(".sum-pr__over"),
      prSets: [...body.querySelectorAll(".sum-grp")].filter((g) => g.querySelector(".sum-pr")).map((g) => g.querySelector(".sum-grp__sets").textContent.trim()),
      overflowLine: !!body.querySelector(".sum-more"),
      chips: txt(".sum-chip"),
      outcomeRoles: [...body.querySelectorAll(".sum-outcome")].map((row) => ({
        exerciseId: row.dataset.exerciseId,
        outcome: row.dataset.outcome,
        text: row.textContent.trim(),
      })),
      baseline: body.querySelector(".sum-baseline")?.textContent.trim() || "",
      muscles: txt(".sum-muscles .vrow__name"),
      muscleNums: txt(".sum-muscles .vrow__num"),
      week: body.querySelector(".sum-week")?.textContent.trim() || "",
      weekDone: body.querySelectorAll(".sum-segbar .segbar__seg.is-done").length,
      weekSegs: body.querySelectorAll(".sum-segbar .segbar__seg").length,
      next: body.querySelector(".sum-next__day")?.textContent.trim() || "",
      focused: document.activeElement?.id || "",
      pageScrollsX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      data: window.__repforgeSessionSummary.current(),
    };
  });

/** openModal marks body-level children inert; probe the branch holding the app. */
const appInert = (page) =>
  page.evaluate(() => {
    const view = document.querySelector("#log");
    const root = [...document.body.children].find((c) => c.contains(view));
    return root?.inert === true;
  });

/** Stub the browser's storage durability API in every page of the context. The
 *  counter and the answer live in sessionStorage so they survive the reloads a
 *  seed performs; `persist()` is denied, so `persisted()` stays whatever the
 *  test set and only the app's own once-only rule can keep the count at one. */
const PERSIST_CALLS = "__persistCalls";
const PERSISTED = "__persisted";
async function stubStorageDurability(context) {
  await context.addInitScript(([calls, persisted]) => {
    try {
      const st = navigator.storage;
      if (!st) return;
      Object.defineProperty(st, "persist", {
        configurable: true,
        value: async () => {
          sessionStorage.setItem(calls, String((+sessionStorage.getItem(calls) || 0) + 1));
          return false;
        },
      });
      Object.defineProperty(st, "persisted", {
        configurable: true,
        value: async () => sessionStorage.getItem(persisted) === "1",
      });
    } catch {}
  }, [PERSIST_CALLS, PERSISTED]);
}
const persistCalls = (page) =>
  page.evaluate((k) => +sessionStorage.getItem(k) || 0, PERSIST_CALLS);
const resetPersistCalls = (page) =>
  page.evaluate((k) => sessionStorage.removeItem(k), PERSIST_CALLS);
const setBrowserPersisted = (page, value) =>
  page.evaluate(([k, v]) => sessionStorage.setItem(k, v ? "1" : "0"), [PERSISTED, value]);

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await stubStorageDurability(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message)));
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await buildProgram(page);

  // ---- 1 — a session with history behind it -----------------------------------
  phase("A session that beat its last one");
  const last = isoDaysAgo(7);
  await seed(
    page,
    fixture({
      log: history(last, [
        ["ex0", "Bench press", 1, 60, 8, 1, "Chest", "Triceps"],
        ["ex0", "Bench press", 2, 60, 7, 1, "Chest", "Triceps"],
        ["ex1", "Barbell row", 1, 50, 8, 1, "Mid/upper back", "Biceps"],
        ["ex1", "Barbell row", 2, 50, 8, 1, "Mid/upper back", "Biceps"],
        ["ex2", "Dumbbell curl", 1, 10, 8, 1, "Biceps", ""],
      ]),
    })
  );
  await enterLog(page);
  // Bench goes up in load, row holds the load and adds reps, curl repeats itself.
  await logSet(page, "ex0", 1, 62.5, 8, 1);
  await logSet(page, "ex0", 2, 62.5, 7, 1);
  await logSet(page, "ex1", 1, 50, 10, 1);
  await logSet(page, "ex1", 2, 50, 9, 1);
  await logSet(page, "ex2", 1, 10, 8, 1);
  await finish(page);
  let s = await readSummary(page);

  assert(s.open, "finishing opens the session summary", JSON.stringify({ open: s.open }));
  assert(/session saved/i.test(s.eyebrow), "the screen names the moment", s.eyebrow);
  assert(s.hero === "Day 1", "the hero is the training day just finished", s.hero);
  assert(s.statVals[0] === "5" && /^sets logged$/.test(s.statCaps[0]), "sets logged leads the stat row", JSON.stringify(s.statVals));
  // 62.5×8 + 62.5×7 + 50×10 + 50×9 + 10×8 = 1967.5 kg through the hands.
  assert(s.statVals[1] === "1,968" && /kg moved/.test(s.statCaps[1]), "volume is the load actually moved", JSON.stringify([s.statVals[1], s.statCaps[1]]));
  assert(s.statVals[2] === "3" && /^lifts$/.test(s.statCaps[2]), "the third figure counts lifts, not sets again", JSON.stringify(s.statVals));

  assert(s.prMarks === 2 && s.prNames.length === 2, "only the lifts that set a record get a line", JSON.stringify([s.prMarks, s.prNames]));
  assert(s.prNames[0] === "Bench press", "a load record sits in its lift's group", JSON.stringify(s.prNames));
  assert(/\+2\.5 kg over your best/.test(s.prOver[0]), "a load record says how much heavier", s.prOver[0]);
  assert(s.prSets[0].startsWith("62.5 kg × 8"), "the group above the record carries the set that set it", s.prSets[0]);
  assert(s.prNames[1] === "Barbell row", "holding the load and adding reps is a reps record", JSON.stringify(s.prNames));
  assert(/\+2 reps at that load/.test(s.prOver[1]), "a reps record says how many more reps", s.prOver[1]);
  assert(
    !s.prNames.includes("Dumbbell curl"),
    "repeating last session's numbers sets no record",
    JSON.stringify(s.prNames)
  );
  assert(!s.overflowLine, "every record is shown on its own lift, so there is no 'and N more' line");

  assert(s.outcomeRoles.filter((row) => row.outcome === "improved").length === 2,
    "canonical lift outcomes are on the screen", JSON.stringify(s.outcomeRoles));
  assert(!s.baseline, "a session with history is not called a baseline", s.baseline);
  assert(
    s.muscles.join(",") === "Chest,Mid/upper back,Biceps,Triceps" && /^2 sets$/.test(s.muscleNums[0]),
    "hard sets break down by muscle, and direct work outranks an equal share of assisting",
    JSON.stringify([s.muscles, s.muscleNums])
  );
  assert(
    s.muscles.includes("Triceps") && /^1 set$/.test(s.muscleNums[3]),
    "a muscle that only assisted still earns its half sets",
    JSON.stringify([s.muscles, s.muscleNums])
  );
  assert(/1 of 2 sessions/.test(s.week), "the week says where the session leaves it", s.week);
  assert(s.weekSegs === 2 && s.weekDone === 1, "the week bar fills the session just logged", JSON.stringify({ segs: s.weekSegs, done: s.weekDone }));
  assert(s.next === "Day 2", "the next training day is named", s.next);
  assert(!s.pageScrollsX, "the summary never scrolls the page sideways");

  // Direction D (spec 4.4): no mark celebrates the save. This Build program's prescriptions are manual, so
  // the engine recommends nothing and no lift claims a next target it does not have.
  const ledger = await page.evaluate(() => {
    const body = document.querySelector("#sessionSummaryBody");
    const P = window.__repforgeProgression;
    return {
      crest: !!body.querySelector(".sum-crest"),
      groups: body.querySelectorAll(".sum-grp").length,
      words: [...body.querySelectorAll(".sum-outcome")].map((w) => ({ id: w.dataset.parityOutcome, session: w.dataset.paritySession })),
      targets: body.querySelectorAll(".sum-grp__next").length,
      statuses: ["ex0", "ex1", "ex2"].map((id) => P.recommendation(P.programSlot(id)).status),
      actions: [...body.querySelectorAll(".sum-actions button")].map((b) => b.id),
    };
  });
  assert(!ledger.crest, "no check mark celebrates the save", JSON.stringify(ledger));
  assert(ledger.groups === 3 && ledger.targets === 0 && ledger.statuses.every((status) => status === "manual"),
    "each of the three lifts is a group; a manual prescription shows no engine next target", JSON.stringify(ledger));
  assert(ledger.words.length === 3 && ledger.words.every((w) => w.id && w.session),
    "outcome words carry the parity markers the Direction D gate reads", JSON.stringify(ledger.words));
  assert(ledger.actions.join(",") === "sumSee,sumDone", "both actions sit in one pinned bar", JSON.stringify(ledger.actions));

  // ---- 2 — the dialog holds the app -------------------------------------------
  phase("The screen behaves like the dialog it is");
  assert(s.focused === "sumTitle", "focus lands on the summary, not behind it", s.focused);
  assert(await appInert(page), "the app underneath is inert while the summary is up");
  const trap = await page.evaluate(() => {
    const stops = [...document.querySelectorAll("#sessionSummary button")].map((b) => b.id);
    document.querySelector("#sumSee")?.focus();
    return { stops, last: document.activeElement?.id };
  });
  assert(
    // Tab order follows the screen: the detour, then the pinned way out.
    trap.stops.join(",") === "sumSee,sumDone" && trap.last === "sumSee",
    "both actions are reachable by keyboard",
    JSON.stringify(trap)
  );

  // ---- 3 — Escape ends the session ---------------------------------------------
  phase("Leaving the summary ends the session");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterEsc = await page.evaluate(() => {
    const shown = (sel) => {
      const el = document.querySelector(sel);
      return !!el && getComputedStyle(el).display !== "none";
    };
    return {
      hidden: document.querySelector("#sessionSummary").classList.contains("hidden"),
      shellHidden: document.querySelector("#workoutShell").classList.contains("hidden"),
      dashHidden: document.querySelector("#todayDash").classList.contains("hidden"),
      focused: document.activeElement?.id || "",
      startShown: shown("#startWorkout"),
      reviewShown: shown("#reviewTodaySession"),
    };
  });
  assert(afterEsc.hidden, "Escape closes the summary");
  assert(!(await appInert(page)), "closing releases the app");
  assert(afterEsc.shellHidden && !afterEsc.dashHidden, "the workout shell steps back to Today", JSON.stringify(afterEsc));
  // The session just saved is today's, so Today leads with the recap's review
  // action instead of the start CTA — that is what focus has to find.
  assert(
    !afterEsc.startShown && afterEsc.reviewShown,
    "Today leads with the recap once the session is saved",
    JSON.stringify(afterEsc)
  );
  assert(afterEsc.focused === "reviewTodaySession", "focus lands on what Today asks for next", afterEsc.focused);

  // ---- 3b — reduced motion prints the final figures on the first read -----------
  phase("Reduced motion shows the final figures immediately");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterLog(page);
  await logSet(page, "ex2", 1, 12.5, 10, 1);
  await finish(page, { reduced: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // ---- 4 — a first session has no records to claim -----------------------------
  phase("A first session is a baseline, not a record");
  assert((await persistCalls(page)) === 0, "a session that already has history never asks for persistent storage");
  await resetPersistCalls(page);
  await seed(page, fixture());
  assert((await persistCalls(page)) === 0, "boot never asks for persistent storage");
  await enterLog(page);
  await logSet(page, "ex2", 1, 12.5, 10, 1);
  assert((await persistCalls(page)) === 0, "logging a set does not ask for persistent storage");
  await finish(page);
  s = await readSummary(page);
  await page.waitForFunction((k) => +sessionStorage.getItem(k) >= 1, PERSIST_CALLS, { timeout: 3000 }).catch(() => {});
  assert((await persistCalls(page)) === 1, "the first completed session asks for persistent storage once", String(await persistCalls(page)));
  assert(!s.prMarks, "a lift with no history sets no personal record", JSON.stringify(s.prNames));
  assert(
    /first session/i.test(s.baseline) && /compare/i.test(s.baseline),
    "the screen says what a first session is instead",
    s.baseline
  );
  assert(!s.chips.length, "a baseline is not also counted as a new lift", JSON.stringify(s.chips));
  assert(!s.outcomeRoles.length, "a baseline has no sufficient outcome rows", JSON.stringify(s.outcomeRoles));
  assert(
    s.statVals[0] === "1" && s.statCaps[0] === "set logged",
    "one set reads as one set, not '1 sets'",
    JSON.stringify([s.statVals[0], s.statCaps[0]])
  );

  // A second completed session must not ask again.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await enterLog(page);
  await logSet(page, "ex2", 1, 12.5, 10, 1);
  await finish(page);
  await page.waitForTimeout(300);
  assert((await persistCalls(page)) === 1, "a second completed session does not ask again", String(await persistCalls(page)));

  // ---- 5 — where the actions land ----------------------------------------------
  phase("See the session lands on the session");
  await page.click("#sumSee");
  await page.waitForTimeout(250);
  const hist = await page.evaluate(() => ({
    view: document.querySelector(".view.active")?.id,
    reading: [...document.querySelectorAll(".session--read")].map((el) => el.dataset.reading),
    editing: [...document.querySelectorAll(".session--edit")].map((el) => el.dataset.editing),
    summaryHidden: document.querySelector("#sessionSummary").classList.contains("hidden"),
    session: window.__repforgeSessionSummary.current()?.session || null,
  }));
  assert(hist.view === "history", "See the session opens History", JSON.stringify(hist));
  assert(hist.reading.length === 1, "it lands on the session itself, not on a row that reveals it", JSON.stringify(hist));
  assert(hist.summaryHidden, "the summary closes on its way out", JSON.stringify(hist));

  // ---- 6 — a block of one kind drops the badge ---------------------------------
  phase("Every lift's record sits on its own lift");
  await seed(
    page,
    fixture({
      log: history(isoDaysAgo(7), [
        ["ex0", "Bench press", 1, 60, 8, 1, "Chest", "Triceps"],
        ["ex1", "Barbell row", 1, 50, 8, 1, "Mid/upper back", "Biceps"],
        ["ex2", "Dumbbell curl", 1, 10, 8, 1, "Biceps", ""],
      ]),
    })
  );
  await enterLog(page);
  // Every lift goes up in load, so every record is a load record.
  await logSet(page, "ex0", 1, 62.5, 8, 1);
  await logSet(page, "ex1", 1, 52.5, 8, 1);
  await logSet(page, "ex2", 1, 12.5, 8, 1);
  await finish(page);
  s = await readSummary(page);
  assert(s.prNames.length === 3, "all three lifts set a record", JSON.stringify(s.prNames));
  assert(s.prMarks === 3, "each record carries the record mark", String(s.prMarks));
  assert(
    s.prOver.every((o) => /over your best/.test(o)),
    "the sentence under each name still says what kind of record it is",
    JSON.stringify(s.prOver)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // ---- 7 — the toast still covers a save the screen cannot ----------------------
  phase("A save that cannot open the screen still reports itself");
  await seed(page, fixture());
  await enterLog(page);
  await logSet(page, "ex2", 1, 15, 10, 1);
  // Strip the host so openSessionSummary has nothing to open, the way a
  // stripped shell or an older cached index.html would leave it.
  await page.evaluate(() => document.querySelector("#sessionSummary")?.remove());
  await finishEarly(page);
  const fallback = await page.evaluate(() => {
    return {
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
      logged: (JSON.parse(localStorage.getItem("repforge_v1") || "{}").log || []).length,
    };
  });
  assert(fallback.logged === 1, "the session is saved either way", JSON.stringify(fallback));
  assert(/saved/i.test(fallback.toast), "the toast stands in for the screen", fallback.toast);

  // ---- 8 — durable rows are not the same as a settled finish -------------------
  phase("Deferred finalization keeps the workout in recovery");
  await seed(page, fixture());
  await enterLog(page);
  await logSet(page, "ex2", 1, 15, 10, 1);
  await openEarlyFinish(page);
  await page.evaluate((draftKey) => {
    const before = window.__repforgeWorkoutDraft.current();
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (String(key).startsWith(`${draftKey}:closing:`)) throw new Error("injected closing-marker failure");
      return originalRemoveItem.apply(this, arguments);
    };
    window.__restoreFinishFault = () => { Storage.prototype.removeItem = originalRemoveItem; };
    window.__deferredFinishBefore = before;
  }, DRAFT);
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, undefined, { timeout: 15000 });
  const deferredFinish = await page.evaluate(async (draftKey) => {
    const result = await window.__repforgeLastWorkoutFinish;
    window.__restoreFinishFault?.();
    return {
      result,
      beforeId: window.__deferredFinishBefore?.draftId || null,
      activeId: window.__repforgeWorkoutDraft.current()?.draftId || null,
      recoveryVisible: !document.querySelector("#draftRecovery")?.classList.contains("hidden"),
      summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      logLength: window.__repforgeWorkoutDraft.state().log.length,
      closingKeys: Object.keys(localStorage).filter((key) => key.startsWith(`${draftKey}:closing:`)),
    };
  }, DRAFT);
  assert(deferredFinish.result?.kind === "deferred_pending" &&
    deferredFinish.result?.committed === false && deferredFinish.result?.settled === false &&
    deferredFinish.result?.finalizationPending === true,
  "closing-marker failure returns an unsettled durable outcome", JSON.stringify(deferredFinish));
  assert(deferredFinish.activeId === deferredFinish.beforeId && deferredFinish.recoveryVisible &&
    !deferredFinish.summaryVisible && deferredFinish.logLength === 1 && deferredFinish.closingKeys.length === 1,
  "an unsettled finish keeps the active workout and recovery UI instead of completing the workflow",
  JSON.stringify(deferredFinish));

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const recoveredClose = await page.evaluate((draftKey) => ({
    logLength: window.__repforgeWorkoutDraft.state().log.length,
    closingKeys: Object.keys(localStorage).filter((key) => key.startsWith(`${draftKey}:closing:`)),
  }), DRAFT);
  assert(recoveredClose.logLength === 1 && recoveredClose.closingKeys.length === 0,
    "boot clears a closing marker whose transaction and journal already settled",
    JSON.stringify(recoveredClose));

  // ---- 9 — failure to create the closing marker is unfinished recovery -------
  phase("A closing marker creation failure retains its replay witness");
  await seed(page, fixture());
  await enterLog(page);
  await logSet(page, "ex2", 1, 15, 10, 1);
  await openEarlyFinish(page);
  await page.evaluate((draftKey) => {
    const before = window.__repforgeWorkoutDraft.current();
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key) {
      if (String(key).startsWith(`${draftKey}:closing:`)) throw new Error("injected closing-marker creation failure");
      return originalSetItem.apply(this, arguments);
    };
    window.__restoreFinishFault = () => { Storage.prototype.setItem = originalSetItem; };
    window.__deferredFinishBefore = before;
  }, DRAFT);
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, undefined, { timeout: 15000 });
  const closeCreationFailure = await page.evaluate(async (draftKey) => {
    const result = await window.__repforgeLastWorkoutFinish;
    window.__restoreFinishFault?.();
    return {
      result,
      beforeId: window.__deferredFinishBefore?.draftId || null,
      activeId: window.__repforgeWorkoutDraft.current()?.draftId || null,
      recoveryVisible: !document.querySelector("#draftRecovery")?.classList.contains("hidden"),
      summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      pendingKeys: Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")),
    };
  }, DRAFT);
  assert(closeCreationFailure.result?.kind === "deferred_pending" &&
    closeCreationFailure.result?.settled === false && closeCreationFailure.result?.rejected === false &&
    closeCreationFailure.result?.pendingJournalCleanup === true && closeCreationFailure.pendingKeys.length === 1,
  "closing-marker creation failure reports the retained WAL as unfinished recovery",
  JSON.stringify(closeCreationFailure));
  assert(closeCreationFailure.activeId === closeCreationFailure.beforeId &&
    closeCreationFailure.recoveryVisible && !closeCreationFailure.summaryVisible,
  "the workout remains recoverable while closing-marker creation is blocked",
  JSON.stringify(closeCreationFailure));

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const replayedClose = await page.evaluate((draftKey) => ({
    logLength: window.__repforgeWorkoutDraft.state().log.length,
    draft: window.__repforgeWorkoutDraft.current(),
    artifacts: Object.keys(localStorage).filter((key) =>
      key.startsWith("repforge_pending_v1:") || key.startsWith(`${draftKey}:closing:`)),
  }), DRAFT);
  assert(replayedClose.logLength === 1 && replayedClose.draft === null && replayedClose.artifacts.length === 0,
    "boot replays the retained workout finish and drains its transaction artifacts",
    JSON.stringify(replayedClose));

  // ---- 10 — an adaptive program ends each lift on the engine's next target ------
  phase("A generated program ends each lift on the engine's next target");
  {
    await seed(page, { settings: fixture().settings, program: [], log: [], programHistory: [] });
    const generated = await installGeneratedProgram(page, { seed: "session-summary" });
    const dayA = generated.program[0].day;
    const lifts = generated.program.filter((row) => row.day === dayA && isWeightRepsSlot(definitionSlot(generated.programMeta, row)));
    const past = isoDaysAgo(7);
    const log = lifts.flatMap((row) => [1, 2].map((set) => metricLogRow(generated.programMeta, row, {
      session: `${past}_${dayA}_seed`, date: past, day: dayA, set, load: 50, reps: row.min, rir: 1 })));
    // The block began two weeks ago, so last week's session is comparable history.
    await seed(page, { ...generated, programMeta: { ...generated.programMeta, started: isoDaysAgo(14) }, log });
    await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), dayA);
    await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 5000 });
    const [first, second] = lifts;
    await logSet(page, first.id, 1, 52.5, first.min, 1);
    await logSet(page, second.id, 1, 50, second.min + 1, 1);
    await finishEarly(page);
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 8000 });
    const adaptive = await page.evaluate(() => {
      const body = document.querySelector("#sessionSummaryBody");
      const P = window.__repforgeProgression;
      return {
        groups: body.querySelectorAll(".sum-grp").length,
        targets: [...body.querySelectorAll(".sum-grp__next[data-parity-target]")].map((n) => ({
          text: n.textContent.trim(), id: n.dataset.parityTarget, load: P.recommendation(P.programSlot(n.dataset.parityTarget)).load,
        })),
      };
    });
    assert(adaptive.groups === 2 && adaptive.targets.length === 2 &&
      adaptive.targets.map((n) => n.id).sort().join() === [first.id, second.id].sort().join(),
    "each lift of an adaptive session is a group ending on a next target", JSON.stringify(adaptive));
    assert(adaptive.targets.every((n) => n.load != null && n.text.includes(String(n.load))),
      "every next target is the engine's recommendation() load for that lift", JSON.stringify(adaptive.targets));
    await page.keyboard.press("Escape");
    await page.locator("#sessionSummary").waitFor({ state: "hidden" });
  }

  // ---- 8 — Settings says what the browser says about durability ----------------
  phase("Settings reports whether the browser keeps the data");
  const DURABILITY = {
    en: {
      kept: "This browser keeps Taurifer's data unless you clear it.",
      mayClear: "This browser may clear Taurifer's data if space runs low. Export a backup regularly.",
    },
    pt: {
      kept: "Este navegador mantém os dados do Taurifer, a menos que você os apague.",
      mayClear: "Este navegador pode apagar os dados do Taurifer se o espaço acabar. Exporte um backup com frequência.",
    },
  };
  for (const lang of ["en", "pt"]) {
    for (const persisted of [true, false]) {
      await setBrowserPersisted(page, persisted);
      const state = fixture();
      state.settings.lang = lang;
      await seed(page, state);
      await page.click("#openSettings");
      await page.waitForSelector("#settings.view.active");
      const want = persisted ? DURABILITY[lang].kept : DURABILITY[lang].mayClear;
      await page
        .waitForFunction((w) => document.querySelector("#storageNote")?.textContent.includes(w), want, { timeout: 3000 })
        .catch(() => {});
      const note = await page.evaluate(() => document.querySelector("#storageNote")?.textContent.trim() || "");
      const other = persisted ? DURABILITY[lang].mayClear : DURABILITY[lang].kept;
      assert(
        note.includes(want) && !note.includes(other),
        `Settings (${lang}) says the browser ${persisted ? "keeps" : "may clear"} the data`,
        note
      );
    }
  }
  // A browser with no storage API reads the same as one that will not promise.
  await page.evaluate(() => sessionStorage.removeItem("__persisted"));
  await page.addInitScript(() => {
    try { Object.defineProperty(navigator.storage, "persisted", { configurable: true, value: undefined }); } catch {}
  });
  await seed(page, fixture());
  await page.click("#openSettings");
  await page.waitForSelector("#settings.view.active");
  await page
    .waitForFunction((w) => document.querySelector("#storageNote")?.textContent.includes(w), DURABILITY.en.mayClear, { timeout: 3000 })
    .catch(() => {});
  const unavailable = await page.evaluate(() => document.querySelector("#storageNote")?.textContent.trim() || "");
  assert(unavailable.includes(DURABILITY.en.mayClear), "Settings still renders when persisted() is unavailable", unavailable);

  assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

  await browser.close();
  console.log(`\nsession summary: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
