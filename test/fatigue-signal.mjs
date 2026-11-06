#!/usr/bin/env node
/**
 * The "Possible fatigue" banner counts a lift only when its own performance dropped (owner, 2026-11-06).
 *
 * The owner's second Workout A raised "3 lifts have lower targets or have stalled today": the first session had gone
 * below the plan's rep ranges at RIR 0, so the engine suggested lighter loads to fit them. That is calibration, not
 * fatigue. A lift counts toward the warning only with at least two comparable earlier sessions, the latest of which
 * did fewer reps or less load than the one before at the same or a harder effort.
 *
 * The fixture is synthetic, shaped like the owner's data: four adaptive Weight + Reps lifts aiming for 7–9 reps at
 * RIR 1, with history rows written in the shape a finished workout saves.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/fatigue-signal.mjs
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DAY = "Day 3";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/** The seed program with Day 3's slots made adaptive: 7–9 reps at RIR 1, as a generated program prescribes. */
function adaptiveProgram() {
  const meta = seedProgramMeta();
  for (const day of meta.programDefinition.days) for (const slot of day.slots || []) {
    if (day.name !== DAY) continue;
    for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
      set.targets = { reps: { min: 7, max: 9 } };
      set.rir = 1;
      set.status = "ready";
    }
  }
  return { program: seedProgram().map((row) => (row.day === DAY ? { ...row, min: 7, max: 9 } : row)), programMeta: meta };
}

/**
 * Install the program and a history: `sessions` is a list of sessions, each a map from a Day 3 slot index to its
 * sets as [load, reps, rir]. Every row is the canonical metric-backed row a finished workout writes.
 */
async function seed(page, sessions) {
  const { program, programMeta } = adaptiveProgram();
  const dates = sessions.map((_, i) => isoDaysAgo(7 * (sessions.length - i)));
  await page.evaluate(async ({ key, program, programMeta, sessions, dates, day }) => {
    const slots = programMeta.programDefinition.days.find((item) => item.name === day).slots;
    const log = sessions.flatMap((byIndex, s) => Object.entries(byIndex).flatMap(([index, sets]) => {
      const slot = slots[+index], row = program.find((item) => item.id === slot.id), date = dates[s];
      return sets.map(([load, reps, rir], n) => ({
        session: `${date}_${day}_fatigue`, date, day, name: row.name, exerciseId: row.id, set: n + 1, setIndex: n,
        load, reps, rir, notes: "", created: `${date}T12:00:00.000Z`, primary: row.primary, secondary: row.secondary,
        performedName: row.name, performedPrimary: row.primary, performedSecondary: row.secondary,
        metricIds: [...slot.metricIds], metricDefinitions: structuredClone(slot.metricDefinitions),
        metricOrigin: slot.metricOrigin, sourceLibraryId: slot.exerciseId,
        metricValues: slot.metricDefinitions.map((metric) => ({ metricId: metric.id,
          value: metric.semantic === "loadKg" ? load : reps, unit: metric.unit })),
        equipmentId: null, loadingConvention: "external", loadingModel: structuredClone(slot.loadingModel),
        loadingContext: { bodyweightContributionEnabled: false, externalLoadMultiplier: 1,
          bodyweightCoefficient: slot.loadingModel?.bodyweightCoefficient ?? null, loadingConvention: "external", bodyweightKg: null },
        metricType: "source_metrics@1", restSeconds: null, performedLibraryId: slot.exerciseId,
      }));
    }));
    const checked = window.RepForgeProgramCompiler.validateProgramDefinition(programMeta.programDefinition);
    if (!checked.ok) throw new Error(`adaptive fixture is not a valid program: ${JSON.stringify(checked).slice(0, 400)}`);
    const base = JSON.parse(localStorage.getItem(key) || "{}");
    const state = { ...base, program, programMeta, log };
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(state, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { key: KEY, program, programMeta, sessions, dates, day: DAY });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
}

/** Open Day 3's workout and read the fatigue banner and each lift's recommendation. */
async function openDay(page) {
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), DAY);
  await page.waitForSelector("#workout .exercise.is-current", { state: "attached", timeout: 10000 });
  return page.evaluate((day) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const recs = raw.program.filter((row) => row.day === day).map((row) => {
      const rec = window.__repforgeRecommendation(row);
      return { id: row.id, status: rec.status, load: rec.load, trend: rec.performanceTrend };
    });
    const el = document.querySelector("#fatigue");
    // The four lifts the fixture gives a history; the day's other two are new.
    return { shown: !!el && !el.classList.contains("hidden"), text: el?.textContent || "", recs: recs.slice(0, 4) };
  }, DAY);
}

async function fresh(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  return { context, page };
}

const browser = await launchChromium();
try {
  console.log("The owner's second session: loads too heavy for the rep range are suggested lighter, with no warning");
  {
    const { context, page } = await fresh(browser);
    // One earlier session, every lift below its 7–9 range at RIR 0 (the owner's chin-up went 20 × 6, 6).
    await seed(page, [{ 0: [[100, 6, 0], [100, 6, 0]], 1: [[60, 6, 0], [60, 5, 0]], 2: [[80, 6, 0], [70, 8, 0]], 3: [[40, 6, 0], [40, 6, 0]] }]);
    const seen = await openDay(page);
    const lighter = seen.recs.filter((rec) => rec.status === "reduce");
    assert(lighter.length >= 3, "the engine suggests lighter loads to fit the range", JSON.stringify(seen.recs));
    assert(seen.recs.every((rec) => rec.trend?.status === "insufficient_history"),
      "one earlier session is not enough to call a drop", JSON.stringify(seen.recs));
    assert(!seen.shown, "no \"Possible fatigue\" banner on the second session", JSON.stringify(seen));
    await context.close();
  }

  console.log("Calibrated and performed: lighter loads for more reps are not fatigue");
  {
    const { context, page } = await fresh(browser);
    await seed(page, [
      { 0: [[100, 6, 0], [100, 6, 0]], 1: [[60, 6, 0], [60, 5, 0]], 2: [[80, 6, 0], [70, 8, 0]], 3: [[40, 6, 0], [40, 6, 0]] },
      { 0: [[95, 8, 1], [95, 7, 1]], 1: [[55, 8, 1], [55, 7, 1]], 2: [[72.5, 8, 1], [72.5, 7, 1]], 3: [[37.5, 8, 1], [37.5, 7, 1]] },
    ]);
    const seen = await openDay(page);
    assert(seen.recs.every((rec) => rec.trend?.status === "steady"), "each lift is steady", JSON.stringify(seen.recs));
    assert(!seen.shown, "no banner on the third session after calibrating", JSON.stringify(seen));
    await context.close();
  }

  console.log("A real drop: fewer reps at the same load and effort raises the banner on the third session");
  {
    const { context, page } = await fresh(browser);
    await seed(page, [
      { 0: [[100, 9, 1], [100, 8, 1]], 1: [[60, 9, 1], [60, 8, 1]], 2: [[80, 9, 1], [80, 8, 1]], 3: [[40, 9, 1], [40, 8, 1]] },
      { 0: [[100, 7, 1], [100, 6, 1]], 1: [[60, 7, 1], [60, 6, 1]], 2: [[80, 9, 1], [80, 8, 1]], 3: [[40, 7, 1], [40, 6, 1]] },
    ]);
    const seen = await openDay(page);
    const dropped = seen.recs.filter((rec) => rec.trend?.dropped);
    assert(dropped.length === 3, "three lifts dropped and one held", JSON.stringify(seen.recs));
    assert(seen.shown && /\b3\b/.test(seen.text), "the banner names the three lifts that dropped", JSON.stringify(seen));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
