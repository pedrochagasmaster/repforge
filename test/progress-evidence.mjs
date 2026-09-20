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
  { session: "h-lat", date: "2026-09-05", day: "Day 1", exerciseId: "pev-2", name: "Machine lateral raise", load: 62.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "h0", date: "2026-09-05", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 50, reps: 8, rir: 2, set: 1, work: true },
  { session: "b1", date: "2026-09-14", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 55, reps: 8, rir: 2, set: 1, work: true },
  { session: "b2", date: "2026-09-15", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 57.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 60, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 75, reps: 8, rir: 1, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 72.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 3", exerciseId: "pev-4", name: "Leg extension", load: 40, reps: 8, rir: 2, set: 1, work: true },
];
const meta = seedProgramMeta({ id: "evidence-program", started });

async function freshPage({ lang = "en", unit = "kg", seededLog = log, seededMeta = meta, seededProgram = program,
  seededHistory = [], fixedNow = "2026-09-17T12:00:00.000Z" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  await context.addInitScript((fixedNow) => {
    globalThis.__repforgeTestNow = sessionStorage.getItem("__repforge_test_now") || fixedNow;
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [globalThis.__repforgeTestNow])); }
      static now() { return new NativeDate(globalThis.__repforgeTestNow).getTime(); }
    }
    globalThis.Date = FixedDate;
  }, fixedNow);
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
  await page.evaluate(async ({ program, meta, log, history, lang, unit }) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    raw.program = program;
    raw.programMeta = meta;
    raw.log = log;
    raw.programHistory = history;
    raw.settings = { ...raw.settings, lang, unit };
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
  }, { program: seededProgram, meta: seededMeta, log: seededLog, history: seededHistory, lang, unit });
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
  assert.equal(seam.bench.outcome, "improved", "the real producer's sufficient outcome reaches Strength");

  // Scope: current block excludes pre-block rows; all history includes them.
  assert.equal(seam.bench.points.length, 3);
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.waitForSelector("#segStrength.active", { timeout: 5000 });
  const blockRows = await page.locator("#strengthDash .evrow").count();
  assert.ok(blockRows >= 4, "every program lift has a summary row");
  const lateralBlock = page.locator(`#strengthDash [data-evkey="${keys.lateral}"]`);
  assert.match(await lateralBlock.textContent(), /—/, "current-block latest excludes historical-only observations");
  await page.click('#strengthScopeSeg button[data-scope="all-history"]');
  const seamAll = await page.evaluate(({ keys }) => window.__repforgeProgressEvidence.strength(keys.bench), { keys });
  assert.equal(seamAll.points.length, 4, "all-history scope includes pre-block rows");
  assert.equal(seamAll.presentation, "trend");
  const lateralAll = page.locator(`#strengthDash [data-evkey="${keys.lateral}"]`);
  assert.match(await lateralAll.locator(".evrow__val").textContent(), /62\.5×8/, "all-history latest includes historical observations");
  await lateralAll.click();
  assert.equal(await page.locator(`#strengthDash [data-evdetail="${keys.lateral}"] tbody tr`).count(), 1,
    "all-history drill-in includes the historical session");
  // Switching back restores current-block scope.
  await page.click('#strengthScopeSeg button[data-scope="current-block"]');
  const seamBack = await page.evaluate(({ keys }) => window.__repforgeProgressEvidence.strength(keys.bench), { keys });
  assert.equal(seamBack.points.length, 3);
  const lateralBack = page.locator(`#strengthDash [data-evkey="${keys.lateral}"]`);
  assert.match(await lateralBack.locator(".evrow__val").textContent(), /—/, "current-block latest excludes the historical observation");
  await lateralBack.click();
  assert.equal(await page.locator(`#strengthDash [data-evdetail="${keys.lateral}"] tbody tr`).count(), 0,
    "current-block drill-in excludes the historical session");

  const rdlRow = page.locator(`#strengthDash [data-evkey="${keys.rdl}"]`);
  assert.match(await rdlRow.textContent(), /-2\.5 kg \(-3\.33/, "two-point comparison shows absolute and percentage change");

  // The same producer output drives the action queue, Review, and Strength.
  // This is deliberately exercised through the live app, not shaped consumer
  // fixtures, so a producer/model contract drift cannot hide behind a mock.
  const canonicalJourney = await page.evaluate(({ keys }) => ({
    records: window.__repforgeProgressEvidence.records("current-block"),
    actions: window.__repforgeAttention().flatMap((group) => group.items.map((item) => item.item.destinationId)),
    bench: window.__repforgeProgressEvidence.strength(keys.bench),
  }), { keys });
  const benchRecord = canonicalJourney.records.find((record) => record.exerciseId === keys.bench);
  assert.equal(benchRecord?.evidenceState, "sufficient", "the producer emits sufficient evidence for the live bench series");
  assert.equal(benchRecord?.outcome, canonicalJourney.bench.outcome, "Strength consumes the producer's canonical outcome");
  assert.ok(canonicalJourney.actions.includes(keys.bench), "sufficient evidence reaches the Overview action destination");
  assert.ok(!canonicalJourney.actions.includes(keys.lateral), "insufficient evidence never reaches the action destination");
  await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("review"));
  assert.match(await page.locator("#reviewPanel").textContent(), /Incline chest press/,
    "the same sufficient record reaches the live Review renderer");
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));

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

// Numeric loads stay numeric until the locale/unit display boundary.
{
  const en = await freshPage({ lang: "en", unit: "kg" });
  await en.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const enKey = await en.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("pev-2"));
  await en.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await en.page.locator(`#strengthDash [data-evkey="${enKey}"] .evrow__val`).textContent(), /62\.5×8/,
    "English kg renders the decimal once without reparsing it");
  await en.context.close();

  const pt = await freshPage({ lang: "pt", unit: "kg" });
  await pt.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const key = await pt.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("pev-2"));
  await pt.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await pt.page.locator(`#strengthDash [data-evkey="${key}"] .evrow__val`).textContent(), /62,5×8/,
    "Portuguese kg renders the decimal once without reparsing it");
  await pt.context.close();

  const lb = await freshPage({ lang: "en", unit: "lb" });
  await lb.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const lbKey = await lb.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("pev-2"));
  await lb.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await lb.page.locator(`#strengthDash [data-evkey="${lbKey}"] .evrow__val`).textContent(), /137\.79×8/,
    "62.5 kg converts to pounds exactly once");
  await lb.context.close();
}

// Legacy/imported rows may omit `created`; every live ordering surface keeps
// the calendar workout date primary in that case.
{
  const mixedTimestampLog = [
    { session: "older-created", date: "2026-09-15", created: "2026-09-15T18:00:00.000Z", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "newer-no-created", date: "2026-09-16", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 105, reps: 8, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: mixedTimestampLog });
  const mixed = await page.evaluate(() => {
    const key = window.__repforgeProgressEvidence.keyForExerciseId("pev-1");
    return {
      strength: window.__repforgeProgressEvidence.strength(key),
      loadPrs: window.__repforgePrTimeline("load").filter((entry) => entry.exerciseId === "pev-1"),
    };
  });
  assert.deepEqual(mixed.strength.points.map((point) => point.value), [100, 105],
    "live Strength chronology is date-first when created is absent");
  assert.equal(mixed.strength.latest.value, 105, "live Strength latest follows the newer dated session");
  assert.deepEqual(mixed.loadPrs.map((entry) => ({ date: entry.date, load: entry.load, delta: entry.deltaLoad })),
    [{ date: "2026-09-16", load: 105, delta: 5 }, { date: "2026-09-15", load: 100, delta: undefined }],
    "live PR chronology uses the same date-first ordering");
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
  await page.locator("#volumeDash [data-volume-muscle]").first().click();
  assert.ok(await page.locator("#volumeDash .evrow__detail:not([hidden]) tbody tr").count() > 0,
    "a primary Volume muscle row drills into its scoped sessions");

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

// Sparse observations remain neutral throughout Overview and Review.
{
  const sparseLog = log.filter((row) => ["b1", "b4"].includes(row.session));
  const { context, page } = await freshPage({ seededLog: sparseLog });
  const overview = await page.locator("#segOverview").textContent();
  assert.doesNotMatch(overview, /Attention|Below/, "legacy warning labels are absent for baseline-building evidence");
  assert.match(overview, /Needs action\s*0|Needs action[\s\S]*Nothing requires action/,
    "insufficient evidence contributes zero Needs action items");
  await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("review"));
  assert.match(await page.locator("#reviewPanel").textContent(), /baseline building/i,
    "the same insufficient records reach Review as neutral baseline state");
  await context.close();
}

// Modern rows carry block provenance. Same-day rows from another block and
// legacy rows without provenance must stay out of every current-block surface,
// while explicit all-history mode retains them.
{
  const scopedMeta = seedProgramMeta({ id: "evidence-program", started: "2026-09-14", blockId: "block-current" });
  const scopedLog = [
    { session: "old", date: "2026-09-16", created: "2026-09-16T08:00:00.000Z", blockId: "block-old", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 200, reps: 8, rir: 2, set: 1, work: true },
    { session: "current-early", date: "2026-09-16", created: "2026-09-16T09:00:00.000Z", blockId: "block-current", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "current-late", date: "2026-09-16", created: "2026-09-16T18:00:00.000Z", blockId: "block-current", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 105, reps: 8, rir: 2, set: 1, work: true },
    { session: "legacy", date: "2026-09-17", created: "2026-09-17T08:00:00.000Z", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 300, reps: 8, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: scopedLog, seededMeta: scopedMeta });
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.waitForSelector("#segStrength.active", { timeout: 5000 });
  const key = await page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("pev-1"));
  const current = await page.evaluate((key) => ({
    series: window.__repforgeProgressEvidence.strength(key),
    volume: window.__repforgeProgressEvidence.volume("this-week"),
    records: window.__repforgeProgressEvidence.records("current-block"),
    actions: window.__repforgeAttention().flatMap((group) => group.items.map((item) => item.item.destinationId)),
  }), key);
  assert.deepEqual(current.series.points.map((point) => point.value), [100, 105],
    "current-block Strength excludes same-day foreign and legacy rows");
  assert.equal(current.series.outcome, "improved", "the scoped pair reaches the authoritative outcome");
  assert.equal(current.volume.completedWorkingSets, 2,
    "current-block Volume uses the same provenance projection");
  const currentRecord = current.records.find((record) => record.exerciseId === key);
  assert.equal(currentRecord?.evidenceState, "sufficient", "the producer emits the canonical sufficient state");
  assert.equal(currentRecord?.outcome, current.series.outcome, "Strength consumes the producer's canonical outcome");
  assert.ok(current.actions.includes(key), "only scoped sufficient evidence reaches Needs action");

  await page.click('#strengthScopeSeg button[data-scope="all-history"]');
  const all = await page.evaluate((key) => window.__repforgeProgressEvidence.strength(key), key);
  assert.deepEqual(all.points.map((point) => point.value), [200, 100, 105, 300],
    "all-history Strength explicitly includes foreign and legacy observations");
  const currentRow = page.locator(`#strengthDash [data-evkey="${key}"]`);
  await currentRow.click();
  assert.equal(await page.locator(`#strengthDash [data-evdetail="${key}"] tbody tr`).count(), 4,
    "all-history drill-in shows exactly the selected scope's sessions");
  await page.click('#strengthScopeSeg button[data-scope="current-block"]');
  const scopedRow = page.locator(`#strengthDash [data-evkey="${key}"]`);
  await scopedRow.click();
  assert.equal(await page.locator(`#strengthDash [data-evdetail="${key}"] tbody tr`).count(), 2,
    "current-block drill-in excludes foreign and legacy sessions");
  await context.close();
}

// Two visible observations are still baseline-building when effort is absent,
// and a changed exposure is not promoted to an action outcome. Both cases use
// the real producer → model → renderer path.
{
  const scopedMeta = seedProgramMeta({ id: "evidence-contract", started: "2026-09-14", blockId: "block-contract" });
  const contractLog = [
    { session: "bench-1", date: "2026-09-15", created: "2026-09-15T09:00:00.000Z", blockId: "block-contract", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 100, reps: 8, set: 1, work: true },
    { session: "bench-2", date: "2026-09-16", created: "2026-09-16T09:00:00.000Z", blockId: "block-contract", day: "Day 1", exerciseId: "pev-1", name: "Incline chest press", load: 101, reps: 8, set: 1, work: true },
    { session: "rdl-1", date: "2026-09-15", created: "2026-09-15T10:00:00.000Z", blockId: "block-contract", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "rdl-2", date: "2026-09-16", created: "2026-09-16T10:00:00.000Z", blockId: "block-contract", day: "Day 2", exerciseId: "pev-3", name: "Romanian deadlift", load: 103, reps: 7, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: contractLog, seededMeta: scopedMeta });
  const values = await page.evaluate(() => {
    const bench = window.__repforgeProgressEvidence.keyForExerciseId("pev-1");
    const rdl = window.__repforgeProgressEvidence.keyForExerciseId("pev-3");
    const records = window.__repforgeProgressEvidence.records("current-block");
    const actions = window.__repforgeAttention().flatMap((group) => group.items.map((item) => item.item.destinationId));
    return {
      bench: window.__repforgeProgressEvidence.strength(bench),
      rdl: window.__repforgeProgressEvidence.strength(rdl),
      benchRecord: records.find((record) => record.exerciseId === bench),
      rdlRecord: records.find((record) => record.exerciseId === rdl),
      actions,
    };
  });
  assert.equal(values.bench.evidenceState, "insufficient", "two no-RIR observations remain insufficient: " + JSON.stringify(values));
  assert.equal(values.bench.reason, "missing-effort");
  assert.equal(values.bench.outcome, undefined);
  assert.equal(values.benchRecord.evidenceState, "insufficient", "the producer carries the same neutral state");
  assert.equal(values.rdl.evidenceState, "insufficient", "changed exposure fails closed");
  assert.equal(values.rdl.reason, "changed-load");
  assert.equal(values.rdl.outcome, undefined);
  assert.equal(values.rdlRecord.reason, "changed-load");
  assert.ok(!values.actions.includes(values.bench.exerciseId) && !values.actions.includes(values.rdl.exerciseId),
    "insufficient canonical records never reach Needs action");
  await page.evaluate(() => window.__repforgeStatsNav.setStatsSeg("review"));
  assert.match(await page.locator("#reviewPanel").textContent(), /baseline building/i,
    "Review renders the same insufficient evidence as neutral baseline building");
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

// Historical prescriptions become a compact aggregate at the installed-editor
// boundary. This covers a recovery week, the following edited week, a second
// edit in week three, and a later block-to-date total across a reload.
{
  const provenanceProgram = [
    { id: "prov-ex-1", slotId: "prov-slot-1", dayId: "prov-day-1", day: "Day 1", order: 1, name: "Incline chest press", sets: 2, min: 6, max: 10, primary: "Chest", secondary: "" },
    { id: "prov-ex-2", slotId: "prov-slot-2", dayId: "prov-day-2", day: "Day 2", order: 1, name: "Romanian deadlift", sets: 2, min: 6, max: 10, primary: "Hamstrings", secondary: "" },
  ];
  const weekEntry = (week, firstSets, secondSets) => ({ week, phase: week === 1 ? "recovery" : "normal", days: [
    { dayId: "prov-day-1", slots: [{ slotId: "prov-slot-1", sets: firstSets, primary: "Chest", secondary: "" }] },
    { dayId: "prov-day-2", slots: [{ slotId: "prov-slot-2", sets: secondSets, primary: "Hamstrings", secondary: "" }] },
  ] });
  const provenanceMeta = seedProgramMeta({
    id: "provenance-program", name: "Prescription provenance", started: "2026-09-01",
    blockId: "block-provenance", mesocycleLengthWeeks: 4,
    programStructure: {
      schemaVersion: 1,
      days: [
        { dayId: "prov-day-1", label: "Day 1", order: 1 },
        { dayId: "prov-day-2", label: "Day 2", order: 2 },
      ],
      provenance: { source: "manual_test", compilerVersion: null },
      weekPrescriptions: [weekEntry(1, 1, 1), weekEntry(2, 2, 2), weekEntry(3, 2, 2), weekEntry(4, 2, 2)],
    },
  });
  const { context, page } = await freshPage({
    seededProgram: provenanceProgram, seededMeta: provenanceMeta, seededLog: [], fixedNow: "2026-09-10T12:00:00.000Z",
  });
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector('#programEditor [data-role="exercise"][data-id="prov-ex-1"]', { timeout: 5000 });
  await page.locator('#programEditor [data-role="adjust"][data-id="prov-ex-1"][data-field="sets"][data-delta="1"]').click();
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForFunction(async () => {
    const debug = await window.__debugProgramEditor();
    return debug.state.program.find((row) => row.id === "prov-ex-1")?.sets === 3;
  }, undefined, { timeout: 10000 });
  const weekTwo = await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const debug = await window.__debugProgramEditor();
    return {
      evidence: window.__repforgeProgressEvidence.volume("block-to-date"),
      program: debug.state.program,
      structure: debug.state.programMeta.programStructure,
      programMeta: debug.state.programMeta,
    };
  });
  assert.equal(weekTwo.evidence.plannedWorkingSets, 7,
    "week two block-to-date keeps the recovery prescription and uses the edited week-two prescription");
  assert.equal(weekTwo.structure.programVersions, undefined,
    "the durable structure does not retain full historical program snapshots");
  assert.deepEqual(weekTwo.structure.weekPrescriptions, [],
    "historical weeks and redundant normal future receipts are not materialized in the durable schedule");
  assert.equal(weekTwo.programMeta.plannedVolumeHistory.throughWeek, 1,
    "the compact history records the completed recovery week once");
  assert.equal(weekTwo.programMeta.plannedVolumeHistory.plannedWorkingSets, 2,
    "the compact history preserves the recovery prescription total");
  assert.equal(weekTwo.programMeta.plannedVolumeHistory.muscles.direct.Hamstrings, 1,
    "the compact history preserves direct recovery-week muscle volume");
  assert.equal(weekTwo.programMeta.plannedVolumeHistory.muscles.direct.Chest, 1,
    "the compact history preserves each direct recovery-week muscle");

  await page.evaluate(() => sessionStorage.setItem("__repforge_test_now", "2026-09-17T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  const weekThreeBeforeEdit = await page.evaluate(() => window.__repforgeProgressEvidence.volume("block-to-date"));
  assert.equal(weekThreeBeforeEdit.period.elapsedNumberedWeeks, 3, "the reloaded fixture is in the week after recovery");
  assert.equal(weekThreeBeforeEdit.plannedWorkingSets, 12,
    "week three block-to-date retains both earlier prescriptions after reload");

  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  if (!(await page.locator('#programEditor [data-role="exercise"][data-id="prov-ex-2"]').isVisible())) {
    await page.locator('#programEditor [data-role="day"][data-day="Day 2"] [data-role="toggle-day"]').click();
  }
  await page.waitForSelector('#programEditor [data-role="exercise"][data-id="prov-ex-2"]', { timeout: 5000 });
  await page.locator('#programEditor [data-role="adjust"][data-id="prov-ex-2"][data-field="sets"][data-delta="1"]').click();
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForFunction(async () => {
    const debug = await window.__debugProgramEditor();
    return debug.state.program.find((row) => row.id === "prov-ex-2")?.sets === 3;
  }, undefined, { timeout: 10000 });
  const afterWeekThreeEdit = await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const debug = await window.__debugProgramEditor();
    return {
      evidence: window.__repforgeProgressEvidence.volume("block-to-date"),
      structure: debug.state.programMeta.programStructure,
      programMeta: debug.state.programMeta,
    };
  });
  assert.equal(afterWeekThreeEdit.evidence.plannedWorkingSets, 13,
    "a week-three edit does not reproject the recovery or week-two denominator");
  assert.equal(afterWeekThreeEdit.structure.programVersions, undefined,
    "later edits keep one bounded receipt representation instead of appending snapshots");
  assert.equal(afterWeekThreeEdit.structure.weekPrescriptions.length, 0,
    "later edits continue to derive normal current/future weeks from the authored program");
  assert.equal(afterWeekThreeEdit.programMeta.plannedVolumeHistory.throughWeek, 2,
    "later edits advance the aggregate only through the newly completed week");
  assert.equal(afterWeekThreeEdit.programMeta.plannedVolumeHistory.plannedWorkingSets, 7,
    "later edits add the predecessor program's exact week-two prescription");

  await page.evaluate(() => sessionStorage.setItem("__repforge_test_now", "2026-09-24T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  const later = await page.evaluate(() => window.__repforgeProgressEvidence.volume("block-to-date"));
  assert.equal(later.period.elapsedNumberedWeeks, 4, "the later block-to-date period is capped at the block length");
  assert.equal(later.plannedWorkingSets, 19,
    "later totals sum the exact recovery, week-two, week-three, and week-four prescriptions");
  await context.close();
}

// Legacy programVersions are migrated into the same aggregate. A version
// boundary at week three must freeze weeks one and two, retain the future
// version-specific facts while the live horizon stops at week two, and consume
// that version once its numbered week is reached.
{
  const legacyProgram = [
    { id: "legacy-ex-1", slotId: "legacy-slot-1", dayId: "legacy-day-1", day: "Day 1", order: 1, name: "Incline chest press", sets: 2, min: 6, max: 10, primary: "Chest", secondary: "" },
    { id: "legacy-ex-2", slotId: "legacy-slot-2", dayId: "legacy-day-2", day: "Day 2", order: 1, name: "Romanian deadlift", sets: 2, min: 6, max: 10, primary: "Hamstrings", secondary: "" },
  ];
  const version = (sets) => legacyProgram.map((row) => ({ ...row, sets }));
  const legacyMeta = seedProgramMeta({
    id: "legacy-versions-program", name: "Legacy versions", started: "2026-09-01",
    blockId: "block-legacy-versions", mesocycleLengthWeeks: 4,
    programStructure: {
      schemaVersion: 1,
      days: [
        { dayId: "legacy-day-1", label: "Day 1", order: 1 },
        { dayId: "legacy-day-2", label: "Day 2", order: 2 },
      ],
      provenance: { source: "legacy_test", compilerVersion: null },
      weekPrescriptions: [],
      programVersions: [
        { fromWeek: 1, program: version(1) },
        { fromWeek: 3, program: version(3) },
      ],
    },
  });
  const { context, page } = await freshPage({
    seededProgram: legacyProgram, seededMeta: legacyMeta, seededLog: [], fixedNow: "2026-09-17T12:00:00.000Z",
  });
  const migrated = await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const state = window.__repforgeWorkoutDraft.state();
    return {
      volume: window.__repforgeProgressEvidence.volume("block-to-date"),
      structure: state.programMeta.programStructure,
      history: state.programMeta.plannedVolumeHistory,
      valid: window.__repforgeValidateStateShape(JSON.parse(localStorage.getItem("repforge_v1"))),
    };
  });
  assert.equal(migrated.valid, true, "legacy programVersions migrate through the durable validator");
  assert.equal(migrated.structure.programVersions?.length, 2,
    "a future legacy program version remains lossless while the aggregate stops at the current week");
  assert.equal(migrated.structure.programVersions?.find((entry) => entry.fromWeek === 3)?.program[0]?.sets, 3,
    "the future legacy version keeps its version-specific prescription facts");
  assert.deepEqual(migrated.structure.weekPrescriptions, [], "legacy migration leaves normal future schedule sparse");
  assert.equal(migrated.history.throughWeek, 2, "legacy migration freezes the two completed weeks");
  assert.equal(migrated.history.plannedWorkingSets, 4, "legacy migration preserves version-specific planned totals");
  assert.equal(migrated.history.muscles.direct.Chest, 2, "legacy migration preserves version-specific direct volume");
  assert.equal(migrated.volume.plannedWorkingSets, 8, "the live model combines migrated history with the current week");
  await page.evaluate(() => sessionStorage.setItem("__repforge_test_now", "2026-09-24T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  const materialized = await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const state = window.__repforgeWorkoutDraft.state();
    return {
      volume: window.__repforgeProgressEvidence.volume("block-to-date"),
      structure: state.programMeta.programStructure,
      history: state.programMeta.plannedVolumeHistory,
    };
  });
  assert.equal(materialized.history.throughWeek, 3,
    "the preserved legacy version is materialized when its numbered week is reached");
  assert.equal(materialized.history.plannedWorkingSets, 10,
    "the reached legacy version contributes its exact historical prescription");
  assert.equal(materialized.structure.programVersions, undefined,
    "legacy version facts are removed only after the future boundary is materialized");
  assert.equal(materialized.volume.plannedWorkingSets, 14,
    "the live model combines the materialized legacy history with the current week");
  await context.close();

  const historicalMeta = {
    ...structuredClone(legacyMeta),
    id: "legacy-historical-program",
    plannedVolumeHistory: {
      schemaVersion: 1,
      throughWeek: 2,
      plannedSessions: 2,
      plannedWorkingSets: 4,
      muscles: { direct: { Chest: 2, Hamstrings: 2 }, secondary: {} },
    },
    programStructure: structuredClone(legacyMeta.programStructure),
  };
  const historical = await freshPage({
    seededProgram: legacyProgram,
    seededMeta: seedProgramMeta({ id: "legacy-active-control", started: "2026-09-01", blockId: "legacy-active-control-block" }),
    seededHistory: [{
      id: historicalMeta.id,
      meta: historicalMeta,
      program: structuredClone(legacyProgram),
      completedAt: "2026-09-17T12:00:00.000Z",
    }],
    seededLog: [],
    fixedNow: "2026-10-10T12:00:00.000Z",
  });
  const historicalSnapshot = await historical.page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const archive = window.__repforgeWorkoutDraft.state().programHistory[0];
    const idbState = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("kv", "readonly").objectStore("kv").get("repforge_v1");
        read.onerror = () => reject(read.error);
        read.onsuccess = () => { db.close(); resolve(read.result); };
      };
    });
    return {
      archive,
      idbArchive: idbState.programHistory[0],
      meta: archive.meta || archive.programMeta,
      completedAt: archive.completedAt,
      valid: window.__repforgeValidateStateShape(JSON.parse(localStorage.getItem("repforge_v1"))),
    };
  });
  assert.equal(historicalSnapshot.valid, true, "mixed legacy archive state remains valid after historical normalization");
  assert.deepEqual(historicalSnapshot.archive, historicalSnapshot.idbArchive,
    "historical legacy normalization mirrors the complete archive in localStorage and IndexedDB");
  assert.deepEqual(historicalSnapshot.meta.programStructure.programVersions,
    legacyMeta.programStructure.programVersions,
    "historical legacy normalization preserves the complete future version envelope");
  assert.equal(historicalSnapshot.meta.plannedVolumeHistory.throughWeek, 2,
    "historical legacy normalization does not project beyond the captured aggregate");
  assert.equal(historicalSnapshot.meta.plannedVolumeHistory.plannedWorkingSets, 4,
    "historical legacy normalization preserves the captured aggregate totals");
  assert.equal(historicalSnapshot.meta.programStructure.programVersions?.length, 2,
    "historical legacy normalization preserves future version records losslessly");
  assert.equal(historicalSnapshot.meta.programStructure.programVersions?.find((entry) => entry.fromWeek === 3)?.program[0]?.sets, 3,
    "historical legacy normalization preserves version-specific future prescriptions");
  assert.equal(historicalSnapshot.completedAt, "2026-09-17T12:00:00.000Z",
    "historical legacy normalization leaves the archive boundary timestamp unchanged");
  await historical.context.close();
}

// The historical aggregate remains bounded at the scale of a real generated
// program. This deliberately uses all 18 seed movements and mutates the same
// slot once in every numbered week, with a reload after every commit.
{
  const productionProgram = seedProgram().map((row, index) => ({
    ...row,
    id: `prod-ex-${index + 1}`,
    slotId: `prod-slot-${index + 1}`,
    dayId: `prod-day-${row.day.slice(-1)}`,
    sets: 3,
  }));
  const productionDays = [...new Map(productionProgram.map((row) => [row.dayId, { dayId: row.dayId, label: row.day, order: Number(row.day.slice(-1)) }])).values()];
  const productionReceipt = (week, firstSets = 3) => ({
    week,
    phase: "normal",
    days: productionDays.map((day) => ({
      dayId: day.dayId,
      slots: productionProgram.filter((row) => row.dayId === day.dayId).map((row) => ({
        slotId: row.slotId,
        sets: row.id === "prod-ex-1" ? firstSets : 3,
        primary: row.primary,
        secondary: row.secondary,
      })),
    })),
  });
  const productionMeta = seedProgramMeta({
    id: "production-provenance-program", name: "Production provenance", started: "2026-09-01",
    blockId: "block-production-provenance", mesocycleLengthWeeks: 6,
    programStructure: {
      schemaVersion: 1,
      days: productionDays,
      provenance: { source: "manual_test", compilerVersion: null },
      weekPrescriptions: Array.from({ length: 6 }, (_, index) => productionReceipt(index + 1)),
    },
  });
  const { context, page } = await freshPage({
    seededProgram: productionProgram, seededMeta: productionMeta, seededLog: [], fixedNow: "2026-09-03T12:00:00.000Z",
  });
  const boundedNodeCount = (value) => {
    if (value === null || typeof value !== "object") return 1;
    return 1 + (Array.isArray(value) ? value.reduce((sum, item) => sum + boundedNodeCount(item), 0)
      : Object.values(value).reduce((sum, item) => sum + boundedNodeCount(item), 0));
  };
  const weekTotals = [];
  let maximumNodes = 0;
  const dates = [null, "2026-09-03T12:00:00.000Z", "2026-09-10T12:00:00.000Z", "2026-09-17T12:00:00.000Z", "2026-09-24T12:00:00.000Z", "2026-10-01T12:00:00.000Z", "2026-10-08T12:00:00.000Z"];
  const inspectProductionState = async (week) => {
    const snapshot = await page.evaluate(async () => {
      await window.__repforgeStorage.flush();
      const raw = JSON.parse(localStorage.getItem("repforge_v1"));
      return {
        raw,
        valid: window.__repforgeValidateStateShape(raw),
        booted: window.__repforgeBooted === true,
        volume: window.__repforgeProgressEvidence.volume("block-to-date"),
        programLength: window.__repforgeWorkoutDraft.state().program.length,
      };
    });
    const structure = snapshot.raw.programMeta.programStructure;
    const history = snapshot.raw.programMeta.plannedVolumeHistory;
    maximumNodes = Math.max(maximumNodes, boundedNodeCount(structure), boundedNodeCount(history));
    assert.equal(snapshot.valid, true, `week ${week} persisted state passes the production validator`);
    assert.equal(snapshot.booted, true, `week ${week} remains booted before reload`);
    assert.equal(snapshot.programLength, 18, `week ${week} keeps all production exercises`);
    assert.ok(maximumNodes < 1000, `week ${week} aggregate stays below the 1000-node bound (${maximumNodes})`);
    assert.deepEqual(structure.programVersions, undefined, `week ${week} has no full historical program snapshots`);
    assert.deepEqual(structure.weekPrescriptions, [], `week ${week} derives normal current/future weeks from the authored program`);
    const expectedTotal = weekTotals.reduce((sum, total) => sum + total, 0);
    assert.equal(snapshot.volume.period.elapsedNumberedWeeks, week, `week ${week} elapsed period`);
    assert.equal(snapshot.volume.plannedWorkingSets, expectedTotal, `week ${week} exact historical denominator`);
    assert.equal(history?.throughWeek || 0, Math.max(0, week - 1),
      `week ${week} aggregate covers only completed predecessor weeks`);
    assert.equal(history?.plannedWorkingSets || 0, weekTotals.slice(0, -1).reduce((sum, total) => sum + total, 0),
      `week ${week} aggregate preserves every prior prescription exactly`);
    assert.equal(snapshot.raw.program.find((row) => row.id === "prod-ex-1")?.sets, 3 + week,
      `week ${week} authored current/future projection carries the edit once`);
  };
  const editProductionWeek = async (week) => {
    await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
    await page.waitForSelector("#program.view.active", { timeout: 5000 });
    if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
      await page.click("#programEditToggle");
    }
    await page.waitForSelector('#programEditor [data-role="exercise"][data-id="prod-ex-1"]', { timeout: 5000 });
    await page.locator('#programEditor [data-role="adjust"][data-id="prod-ex-1"][data-field="sets"][data-delta="1"]').click();
    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
    await page.waitForFunction(async (expected) => (await window.__debugProgramEditor()).state.program.find((row) => row.id === "prod-ex-1")?.sets === expected,
      3 + week, { timeout: 10000 });
  };
  for (let week = 1; week <= 6; week++) {
    if (week > 1) {
      await page.evaluate((date) => sessionStorage.setItem("__repforge_test_now", date), dates[week]);
      await page.reload({ waitUntil: "domcontentloaded" });
      const booted = await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 5000 })
        .then(() => true).catch(() => false);
      assert.equal(booted, true, `week ${week} reload completes boot`);
    }
    await editProductionWeek(week);
    weekTotals.push(54 + week);
    await inspectProductionState(week);
  }
  assert.ok(maximumNodes < 1000, `maximum production aggregate size remains bounded (${maximumNodes})`);
  console.log(`production aggregate maximum structural nodes: ${maximumNodes}`);
  const rejected = await page.evaluate(async () => {
    const invalid = structuredClone(window.__repforgeWorkoutDraft.state());
    invalid.programMeta.programStructure = { oversized: Array.from({ length: 1200 }, () => ({ value: 1 })) };
    const writes = [];
    const result = await window.__repforgeStorage.writeWithAdapter(invalid, {
      writeLocal: async () => { writes.push("local"); return true; },
      writeIdb: async () => { writes.push("idb"); return true; },
    });
    return { result, writes };
  });
  assert.equal(rejected.result.code, "invalid-state", "an over-bound proposal is rejected at the write boundary");
  assert.deepEqual(rejected.writes, [], "an over-bound proposal touches neither durable replica");
  const malformedHistory = await page.evaluate(async () => {
    const invalid = structuredClone(window.__repforgeWorkoutDraft.state());
    invalid.programMeta.plannedVolumeHistory.plannedWorkingSets = -1;
    const writes = [];
    const result = await window.__repforgeStorage.writeWithAdapter(invalid, {
      writeLocal: async () => { writes.push("local"); return true; },
      writeIdb: async () => { writes.push("idb"); return true; },
    });
    return { result, writes };
  });
  assert.equal(malformedHistory.result.code, "invalid-state", "malformed aggregate history is rejected symmetrically");
  assert.deepEqual(malformedHistory.writes, [], "malformed aggregate history touches neither durable replica");
  await context.close();

  // A completed block has no active edit boundary. Its aggregate still owns
  // the historical denominator, so editing the authored program afterwards
  // must not rewrite any completed week's prescription.
  const completedMeta = seedProgramMeta({
    id: "completed-production-provenance-program", name: "Completed production provenance",
    started: "2026-09-01", mesocycleLengthWeeks: 6, mesocycleStatus: "completed",
    completedAt: "2026-10-08T12:00:00.000Z", blockId: "block-completed-production-provenance",
    programStructure: structuredClone(productionMeta.programStructure),
  });
  const completed = await freshPage({
    seededProgram: productionProgram, seededMeta: completedMeta, seededLog: [],
    fixedNow: "2026-10-09T12:00:00.000Z",
  });
  const completedBefore = await completed.page.evaluate(() => ({
    volume: window.__repforgeProgressEvidence.volume("block-to-date"),
    structure: window.__repforgeWorkoutDraft.state().programMeta.programStructure,
    history: window.__repforgeWorkoutDraft.state().programMeta.plannedVolumeHistory,
  }));
  assert.equal(completedBefore.volume.plannedWorkingSets, 324,
    "a completed block includes every recorded weekly prescription in the aggregate");
  assert.deepEqual(completedBefore.structure.weekPrescriptions, [],
    "a completed block does not retain redundant dense receipts");
  assert.equal(completedBefore.history.throughWeek, 6,
    "completed migration records all numbered weeks");
  assert.equal(completedBefore.history.muscles.direct.Quads, 54,
    "completed migration preserves exact direct per-muscle volume");
  assert.equal(completedBefore.history.muscles.secondary.Glutes, 18,
    "completed migration preserves exact secondary per-muscle volume");
  await completed.page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await completed.page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await completed.page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await completed.page.click("#programEditToggle");
  }
  await completed.page.waitForSelector('#programEditor [data-role="exercise"][data-id="prod-ex-1"]', { timeout: 5000 });
  await completed.page.locator('#programEditor [data-role="adjust"][data-id="prod-ex-1"][data-field="sets"][data-delta="1"]').click();
  await completed.page.click("#programEditToggle");
  await completed.page.waitForFunction(async () =>
    (await window.__debugProgramEditor()).state.program.find((row) => row.id === "prod-ex-1")?.sets === 4,
  undefined, { timeout: 10000 });
  const completedAfter = await completed.page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const state = window.__repforgeWorkoutDraft.state();
    return {
      volume: window.__repforgeProgressEvidence.volume("block-to-date"),
      state,
      history: state.programMeta.plannedVolumeHistory,
    };
  });
  assert.equal(completedAfter.volume.plannedWorkingSets, 324,
    "editing after completion does not reproject the closed block denominator");
  assert.equal(completedAfter.history.throughWeek, 6,
    "the completed aggregate remains immutable after a post-block edit");
  assert.equal(completedAfter.history.muscles.direct.Quads, 54,
    "post-block editing does not rewrite completed direct volume");
  assert.equal(completedAfter.history.muscles.secondary.Glutes, 18,
    "post-block editing does not rewrite completed secondary volume");
  assert.equal(completedAfter.state.program.find((row) => row.id === "prod-ex-1").sets, 4,
    "the authored program still records the post-block edit separately");
  assert.deepEqual(completedAfter.state.programMeta.programStructure.weekPrescriptions, [],
    "post-block editing keeps the schedule sparse");
  assert.equal(completedAfter.state.programMeta.programStructure.programVersions, undefined,
    "completed-block editing does not reintroduce full historical snapshots");
  assert.equal(await completed.page.evaluate(() => window.__repforgeValidateStateShape(
    JSON.parse(localStorage.getItem("repforge_v1")))), true,
  "the completed-block edit remains within the durable state contract");
  await completed.context.close();
}

// The accepted 18-exercise/6, 8, 10, and 12-week domains must remain writable even when the
// imported structure has no receipts yet. The editor's first mutation is the
// boundary that previously expanded the whole future schedule and crossed the
// durable progression node limit.
{
  const longProgram = seedProgram().map((row, index) => ({
    ...row,
    id: `long-ex-${index + 1}`,
    slotId: `long-slot-${index + 1}`,
    dayId: `long-day-${row.day.slice(-1)}`,
    sets: 3,
  }));
  const longDays = [...new Map(longProgram.map((row) => [row.dayId,
    { dayId: row.dayId, label: row.day, order: Number(row.day.slice(-1)) }])).values()];
  for (const weeks of [6, 8, 10, 12]) {
    const longMeta = seedProgramMeta({
      id: `long-editor-program-${weeks}`, name: `Long editor program ${weeks}`, started: "2026-09-01",
      blockId: `block-long-editor-${weeks}`, mesocycleLengthWeeks: weeks,
      programStructure: {
        schemaVersion: 1,
        days: longDays,
        provenance: { source: "manual_test", compilerVersion: null },
        weekPrescriptions: [],
      },
    });
    const { context, page } = await freshPage({
      seededProgram: longProgram, seededMeta: longMeta, seededLog: [], fixedNow: "2026-09-03T12:00:00.000Z",
    });
    await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
    await page.waitForSelector("#program.view.active", { timeout: 5000 });
    if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
      await page.click("#programEditToggle");
    }
    await page.waitForSelector('#programEditor [data-role="exercise"][data-id="long-ex-1"]', { timeout: 5000 });
    await page.locator('#programEditor [data-role="adjust"][data-id="long-ex-1"][data-field="sets"][data-delta="1"]').click();
    await page.click("#programEditToggle");
    await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const longEdit = await page.evaluate(async () => {
      await window.__repforgeStorage.flush();
      const state = window.__repforgeWorkoutDraft.state();
      const boundedNodeCount = (value) => value === null || typeof value !== "object" ? 1
        : 1 + (Array.isArray(value)
          ? value.reduce((sum, item) => sum + boundedNodeCount(item), 0)
          : Object.values(value).reduce((sum, item) => sum + boundedNodeCount(item), 0));
      return {
        sets: state.program.find((row) => row.id === "long-ex-1")?.sets,
        valid: window.__repforgeValidateStateShape(JSON.parse(localStorage.getItem("repforge_v1"))),
        structureNodes: boundedNodeCount(state.programMeta.programStructure),
        historyNodes: boundedNodeCount(state.programMeta.plannedVolumeHistory),
      };
    });
    assert.equal(longEdit.sets, 4, `${weeks}-week editor mutation commits at the accepted domain boundary`);
    assert.equal(longEdit.valid, true, `${weeks}-week editor mutation remains valid durable state`);
    assert.ok(longEdit.structureNodes + longEdit.historyNodes < 1000,
      `${weeks}-week history stays below the progression node bound (${longEdit.structureNodes + longEdit.historyNodes})`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => window.__repforgeWorkoutDraft.state().program.find((row) => row.id === "long-ex-1")?.sets), 4,
      `${weeks}-week editor mutation survives reload`);
    await context.close();
  }
}

// Upper envelope: 100 accepted exercise rows and a 52-week block still use a
// constant-size progression-history representation through a real editor
// Apply and reload.
{
  const upperProgram = Array.from({ length: 100 }, (_, index) => {
    const dayNumber = index % 5 + 1;
    return {
      id: `upper-ex-${index + 1}`, slotId: `upper-slot-${index + 1}`, dayId: `upper-day-${dayNumber}`,
      day: `Day ${dayNumber}`, order: Math.floor(index / 5) + 1, name: `Upper exercise ${index + 1}`,
      sets: 3, min: 4, max: 8, primary: index % 2 ? "Chest" : "Quads", secondary: index % 2 ? "Triceps" : "Glutes",
    };
  });
  const upperDays = Array.from({ length: 5 }, (_, index) => ({
    dayId: `upper-day-${index + 1}`, label: `Day ${index + 1}`, order: index + 1,
  }));
  const upperMeta = seedProgramMeta({
    id: "upper-envelope-program", name: "Upper envelope", started: "2026-09-01",
    blockId: "block-upper-envelope", mesocycleLengthWeeks: 52,
    programStructure: {
      schemaVersion: 1, days: upperDays, provenance: { source: "manual_test", compilerVersion: null }, weekPrescriptions: [],
    },
  });
  const { context, page } = await freshPage({
    seededProgram: upperProgram, seededMeta: upperMeta, seededLog: [], fixedNow: "2026-09-03T12:00:00.000Z",
  });
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector('#programEditor [data-role="exercise"][data-id="upper-ex-1"]', { timeout: 10000 });
  await page.locator('#programEditor [data-role="adjust"][data-id="upper-ex-1"][data-field="sets"][data-delta="1"]').click();
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  const upperEdit = await page.evaluate(async () => {
    await window.__repforgeStorage.flush();
    const state = window.__repforgeWorkoutDraft.state();
    const boundedNodeCount = (value) => value === null || typeof value !== "object" ? 1
      : 1 + (Array.isArray(value)
          ? value.reduce((sum, item) => sum + boundedNodeCount(item), 0)
          : Object.values(value).reduce((sum, item) => sum + boundedNodeCount(item), 0));
    const maximumMuscleMap = Object.fromEntries(window.RepForgeProgramEntry.MUSCLE_TOKENS.map((token, index) => [token, index + 1]));
    const maximumHistory = {
      schemaVersion: 1, throughWeek: 52, plannedSessions: 520, plannedWorkingSets: 5200,
      muscles: { direct: maximumMuscleMap, secondary: { ...maximumMuscleMap } },
    };
    const maximumEnvelope = structuredClone(state);
    maximumEnvelope.programMeta.plannedVolumeHistory = maximumHistory;
    return {
      programLength: state.program.length,
      weeks: state.programMeta.mesocycleLengthWeeks,
      sets: state.program[0]?.sets,
      valid: window.__repforgeValidateStateShape(JSON.parse(localStorage.getItem("repforge_v1"))),
      nodes: boundedNodeCount(state.programMeta.programStructure) + boundedNodeCount(state.programMeta.plannedVolumeHistory),
      maximumHistoryNodes: boundedNodeCount(maximumHistory),
      maximumEnvelopeValid: window.__repforgeValidateStateShape(maximumEnvelope),
    };
  });
  assert.equal(upperEdit.programLength, 100, "the accepted upper-envelope program remains intact");
  assert.equal(upperEdit.weeks, 52, "the accepted upper-envelope block length remains intact");
  assert.equal(upperEdit.sets, 4, "the upper-envelope editor mutation commits");
  assert.equal(upperEdit.valid, true, "the upper-envelope state passes the durable validator");
  assert.ok(upperEdit.nodes < 1000, `the upper-envelope history stays below the progression node bound (${upperEdit.nodes})`);
  assert.ok(upperEdit.maximumHistoryNodes < 1000,
    `the maximum bounded aggregate stays below the progression node bound (${upperEdit.maximumHistoryNodes})`);
  assert.equal(upperEdit.maximumEnvelopeValid, true,
    "the complete canonical direct/secondary muscle aggregate passes read validation");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  assert.deepEqual(await page.evaluate(() => {
    const state = window.__repforgeWorkoutDraft.state();
    return { length: state.program.length, sets: state.program[0]?.sets, weeks: state.programMeta.mesocycleLengthWeeks };
  }), { length: 100, sets: 4, weeks: 52 }, "the upper-envelope edit survives reload");
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
