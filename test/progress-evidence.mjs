#!/usr/bin/env node
// Plan 056 P4 — Strength/Volume/PR evidence views.
// Sparse policy 0/1/2/3+, current-block vs all-history scope, this-week and
// block-to-date denominators against model-backed values, mobile drill-ins.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assertServingApp } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://127.0.0.1:8617/";
await assertServingApp(base);
const browser = await chromium.launch();
const errors = [];

// Known log: bench 3 block points (trend), rdl 2 (comparison), squat 1
// (snapshot), lateral 0 (baseline). Two pre-block bench rows make the
// all-history scope different from the block scope.
const started = "2026-09-14"; // Monday; anchor is 2026-09-17 (week 1, partial)
const rows = [
  ["Day 1", 1, "Incline chest press", "Chest", "Triceps"],
  ["Day 1", 2, "Machine lateral raise", "Side delts", ""],
  ["Day 2", 1, "Romanian deadlift", "Hamstrings", ""],
  ["Day 3", 1, "Leg extension", "Quads", ""],
];
const program = rows.map(([day, order, name, primary, secondary], i) =>
  ({ id: `pev-${i + 1}`, day, order, name, sets: 2, min: 4, max: 8, primary, secondary }));
const log = [
  { session: "h0", date: "2026-09-05", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 50, reps: 8, rir: 2, set: 1, work: true },
  { session: "b1", date: "2026-09-14", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 55, reps: 8, rir: 2, set: 1, work: true },
  { session: "b2", date: "2026-09-15", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 57.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 60, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 75, reps: 8, rir: 1, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 72.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 3", exerciseId: "pev-4", name: "Leg extension", load: 40, reps: 8, rir: 2, set: 1, work: true },
];
const meta = seedProgramMeta({ id: "evidence-program", started });

async function freshPage() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: "domcontentloaded" });
  // Seed only after the first boot settles, so its initial persist cannot
  // overwrite the fixture.
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const reg of regs) await reg.unregister();
    for (const key of await caches?.keys?.() || []) await caches.delete(key);
  });
  await page.evaluate(async ({ program, meta, log }) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    raw.program = program;
    raw.programMeta = meta;
    raw.log = log;
    localStorage.setItem("repforge_v1", JSON.stringify(raw));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(raw, "repforge_v1");
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { program, meta, log });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  await page.evaluate(() => document.querySelector('nav button[data-view="stats"]')?.click());
  await page.waitForSelector("#stats.view.active", { timeout: 5000 });
  return { context, page };
}

// Strength: sparse policy, scopes, drill-in.
{
  const { context, page } = await freshPage();
  const keys = await page.evaluate(() => {
    const dash = window.__repforgeStrengthDashboard();
    const keyOf = (needle) => dash.find((r) => r.exercise.includes(needle))?.key;
    return { bench: keyOf("Incline chest press"), rdl: keyOf("Romanian deadlift"),
      squatRow: keyOf("Leg extension"),
      lateral: window.__repforgeProgressEvidence.keyForExerciseId("pev-2") };
  });
  assert.ok(keys.bench && keys.rdl && keys.squatRow && keys.lateral, "all four lifts resolve movement keys");
  const seam = await page.evaluate(({ keys }) => ({
    bench: window.__repforgeProgressEvidence.strength(keys.bench),
    rdl: window.__repforgeProgressEvidence.strength(keys.rdl),
    squatRow: window.__repforgeProgressEvidence.strength(keys.squatRow),
    lateral: window.__repforgeProgressEvidence.strength(keys.lateral),
  }), { keys });
  assert.equal(seam.bench.presentation, "trend", "3+ compatible points are a trend");
  assert.equal(seam.bench.points.length, 3);
  assert.equal(seam.rdl.presentation, "comparison", "2 points are a comparison");
  assert.equal(seam.squatRow.presentation, "snapshot", "1 point is a snapshot");
  assert.equal(seam.squatRow.evidenceState, "insufficient");
  assert.equal(seam.lateral.presentation, "empty");
  assert.equal(seam.lateral.evidenceState, "insufficient");
  assert.equal(seam.lateral.reason, "untested");
  assert.equal(seam.lateral.outcome, undefined, "insufficient carries no outcome");

  // Scope: current block excludes pre-block rows; all history includes them.
  assert.equal(seam.bench.points.length, 3);
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.waitForSelector("#segStrength.active", { timeout: 5000 });
  const blockRows = await page.locator("#strengthDash .evrow").count();
  assert.ok(blockRows >= 4, "every program lift has a summary row");
  await page.click('#strengthScopeSeg button[data-scope="all-history"]');
  const seamAll = await page.evaluate(({ keys }) => window.__repforgeProgressEvidence.strength(keys.bench), { keys });
  assert.equal(seamAll.points.length, 4, "all-history scope includes pre-block rows");
  assert.equal(seamAll.presentation, "trend");
  // Switching back restores current-block scope.
  await page.click('#strengthScopeSeg button[data-scope="current-block"]');
  const seamBack = await page.evaluate(({ keys }) => window.__repforgeProgressEvidence.strength(keys.bench), { keys });
  assert.equal(seamBack.points.length, 3);

  // Drill-in reveals the complete evidence table for one lift.
  const firstRow = page.locator("#strengthDash .evrow").first();
  await firstRow.click();
  const detailVisible = await page.evaluate(() => {
    const d = document.querySelector("#strengthDash .evrow__detail:not([hidden])");
    return !!d && d.querySelectorAll("tbody tr").length > 0;
  });
  assert.equal(detailVisible, true, "drill-in shows the full per-lift table");
  await context.close();
}

// Volume: model-backed denominators per scope, neutral in-progress wording.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("volume"));
  await page.waitForSelector("#segVolume.active", { timeout: 5000 });
  const week = await page.evaluate(() => ({
    ev: window.__repforgeProgressEvidence.volume("this-week"),
    periodText: document.querySelector("#volumePeriod")?.textContent || "",
    caption: document.body.textContent.includes("toward the full period"),
  }));
  assert.equal(week.ev.scope, "this-week");
  assert.equal(week.ev.completedWorkingSets, 6, "this-week completed sets come from the program week");
  assert.equal(week.ev.plannedWorkingSets, 8, "this-week planned is one canonical week (4 rows x 2 sets)");
  assert.match(week.periodText, /From /, "period bounds are stated in accessible text");
  assert.equal(week.caption, true, "partial week reads as progress toward the period, not a verdict");

  await page.click('#volumeScopeSeg button[data-vscope="block-to-date"]');
  const block = await page.evaluate(() => ({
    ev: window.__repforgeProgressEvidence.volume("block-to-date"),
  }));
  assert.equal(block.ev.period.elapsedNumberedWeeks, 1, "block-to-date denominators are elapsed numbered weeks");
  assert.equal(block.ev.completedWorkingSets, 6);
  assert.equal(block.ev.plannedWorkingSets, 8);
  assert.equal(block.ev.period.end, "2026-09-17", "block-to-date runs through today, never a fixed 28-day window");
  await context.close();
}

// PRs: drill-in rows with a long locale date.
{
  const { context, page } = await freshPage();
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("prs"));
  await page.waitForSelector("#segPRs.active", { timeout: 5000 });
  const prRows = page.locator("#prTimeline .prtl__row");
  assert.ok(await prRows.count() > 0, "PR timeline renders entries");
  await prRows.first().click();
  const detail = await page.evaluate(() => {
    const d = document.querySelector("#prTimeline .evrow__detail:not([hidden])");
    return d ? d.textContent : "";
  });
  assert.match(detail, /September 17, 2026|17 September 2026/, "drill-in shows the long locale date");
  await context.close();
}

// Chart sparse policy: two points never draw a trend line.
{
  const { context, page } = await freshPage();
  const policy = await page.evaluate(() => ({
    one: window.__repforgeProgressEvidence.chartPresentation(1),
    two: window.__repforgeProgressEvidence.chartPresentation(2),
    three: window.__repforgeProgressEvidence.chartPresentation(3),
  }));
  assert.deepEqual(policy, { one: "snapshot", two: "comparison", three: "trend" });
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during evidence journeys");
await browser.close();
console.log("PASS: progress evidence (sparse policy, scopes, periods, drill-ins)");
