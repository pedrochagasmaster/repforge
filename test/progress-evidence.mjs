#!/usr/bin/env node
// Plan 056 P4 — Strength/Volume/PR evidence views.
// Sparse policy 0/1/2/3+, current-block vs all-history scope, this-week and
// block-to-date denominators against model-backed values, mobile drill-ins.
import assert from "node:assert/strict";
import { assertServingApp, launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
await assertServingApp(base);
const browser = await launchChromium();
const errors = [];

// Known log: bench 3 block points (trend), rdl 2 (comparison), squat 1
// (snapshot), lateral 0 (baseline). Two pre-block bench rows make the
// all-history scope different from the block scope.
const started = "2026-09-14"; // Monday; anchor is 2026-09-17 (week 1, partial)
// The ready seed program (18 movements over Days 1-3, two sets each); the
// evidence fixture logs four of them by their seed slot ids.
const program = seedProgram();
const log = [
  { session: "h-lat", date: "2026-09-05", day: "Day 1", exerciseId: "seed-ex-5", name: "Machine lateral raise", load: 62.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "h0", date: "2026-09-05", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 50, reps: 8, rir: 2, set: 1, work: true },
  { session: "b1", date: "2026-09-14", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 55, reps: 8, rir: 2, set: 1, work: true },
  { session: "b2", date: "2026-09-15", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 57.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 60, reps: 8, rir: 2, set: 1, work: true },
  { session: "b3", date: "2026-09-16", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 75, reps: 8, rir: 1, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 72.5, reps: 8, rir: 2, set: 1, work: true },
  { session: "b4", date: "2026-09-17", day: "Day 3", exerciseId: "seed-ex-13", name: "Leg extension", load: 40, reps: 8, rir: 2, set: 1, work: true },
];
const meta = seedProgramMeta({ id: "evidence-program", started });
const PLANNED_WEEK = program.reduce((total, row) => total + row.sets, 0);

async function freshPage({ lang = "en", unit = "kg", seededLog = log, seededMeta = meta, seededProgram = program,
  seededHistory = [], fixedNow = "2026-09-17T12:00:00.000Z", timezoneId = "UTC" } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId });
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

async function assertCanonicalOutcomeLabels(page, outcomes) {
  for (const { key, outcome } of outcomes) {
    const row = page.locator(`#strengthDash [data-evkey="${key}"]`);
    // The word is the compareExerciseSession label the summary and History read.
    const label = await page.evaluate((value) => window.RepForgeI18n.t(`delta.${{ improved: "improved", maintained: "flat", declined: "regressed" }[value]}.label`), outcome);
    const status = row.locator(".evrow__out");
    assert.ok(await status.isVisible(), `the ${outcome} outcome label stays visible in its evidence row`);
    assert.ok((await status.textContent()).includes(label),
      `the ${outcome} outcome keeps its localized text distinction in the rendered row`);
  }
}

// Strength: sparse policy, scopes, drill-in.
{
  const { context, page } = await freshPage();
  const keys = await page.evaluate(() => {
    const dash = window.__repforgeStrengthDashboard();
    const keyOf = (needle) => dash.find((r) => r.exercise.includes(needle))?.key;
    return { bench: keyOf("Incline chest press"), rdl: keyOf("Romanian deadlift"),
      squatRow: keyOf("Leg extension"),
      lateral: window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-5") };
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
  assert.match(await lateralAll.locator(".evrow__val").textContent(), /62\.5 kg/, "all-history latest includes historical observations");
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
  await page.locator(`#strengthDash [data-evkey="${keys.bench}"]`).click();
  assert.equal(await page.locator(`#strengthDash [data-evdetail="${keys.bench}"] tbody tr`).count(), 3,
    "drill-in shows the full per-lift table");
  await context.close();
}

// Outcome words stay visible beside their canonical improved/maintained/declined facts.
// The declined lift repeats its load with a rep fewer: under the Session outcome rule a
// lower load is never read as declined, so the decline must happen at the same load.
// The final assertion deliberately hides those words: the rendered semantic
// oracle must reject a presentation that leaves outcome meaning to color alone.
{
  const outcomeLog = [
    { session: "outcome-better-1", date: "2026-09-14", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 60, reps: 8, rir: 2, set: 1, work: true },
    { session: "outcome-better-2", date: "2026-09-16", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 65, reps: 8, rir: 2, set: 1, work: true },
    { session: "outcome-steady-1", date: "2026-09-14", day: "Day 3", exerciseId: "seed-ex-13", name: "Leg extension", load: 40, reps: 8, rir: 2, set: 1, work: true },
    { session: "outcome-steady-2", date: "2026-09-16", day: "Day 3", exerciseId: "seed-ex-13", name: "Leg extension", load: 40, reps: 8, rir: 2, set: 1, work: true },
    { session: "outcome-worse-1", date: "2026-09-14", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "outcome-worse-2", date: "2026-09-16", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 100, reps: 7, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: outcomeLog });
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.waitForSelector("#segStrength.active", { timeout: 5000 });
  const outcomes = await page.evaluate(() => [
    ["seed-ex-3", "improved"], ["seed-ex-13", "maintained"], ["seed-ex-8", "declined"],
  ].map(([id, expected]) => {
    const key = window.__repforgeProgressEvidence.keyForExerciseId(id);
    const record = window.__repforgeProgressEvidence.records("current-block").find((item) => item.exerciseId === key);
    return { key, expected, outcome: record?.outcome };
  }));
  assert.deepEqual(outcomes.map(({ expected, outcome }) => [expected, outcome]), [
    ["improved", "improved"], ["maintained", "maintained"], ["declined", "declined"],
  ], "the production evidence producer supplies all three canonical outcomes");
  await assertCanonicalOutcomeLabels(page, outcomes);

  await page.addStyleTag({ content: "#strengthDash .evrow__out { visibility: hidden !important; }" });
  await assert.rejects(() => assertCanonicalOutcomeLabels(page, outcomes),
    /the improved outcome label stays visible in its evidence row/,
    "the deliberate color-only presentation failure is rejected by the rendered outcome oracle");
  await context.close();
}

// Numeric loads stay numeric until the locale/unit display boundary.
{
  const en = await freshPage({ lang: "en", unit: "kg" });
  await en.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const enKey = await en.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-5"));
  await en.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await en.page.locator(`#strengthDash [data-evkey="${enKey}"] .evrow__val`).textContent(), /62\.5 kg/,
    "English kg renders the decimal once without reparsing it");
  await en.context.close();

  const pt = await freshPage({ lang: "pt", unit: "kg" });
  await pt.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const key = await pt.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-5"));
  await pt.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await pt.page.locator(`#strengthDash [data-evkey="${key}"] .evrow__val`).textContent(), /62,5 kg/,
    "Portuguese kg renders the decimal once without reparsing it");
  await pt.context.close();

  const lb = await freshPage({ lang: "en", unit: "lb" });
  await lb.page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  const lbKey = await lb.page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-5"));
  await lb.page.click('#strengthScopeSeg button[data-scope="all-history"]');
  assert.match(await lb.page.locator(`#strengthDash [data-evkey="${lbKey}"] .evrow__val`).textContent(), /137\.79 lb/,
    "62.5 kg converts to pounds exactly once");
  await lb.context.close();
}

// Legacy/imported rows may omit `created`; every live ordering surface keeps
// the calendar workout date primary in that case.
{
  const mixedTimestampLog = [
    { session: "older-created", date: "2026-09-15", created: "2026-09-15T18:00:00.000Z", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "newer-no-created", date: "2026-09-16", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 105, reps: 8, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: mixedTimestampLog });
  const mixed = await page.evaluate(() => {
    const key = window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3");
    return {
      strength: window.__repforgeProgressEvidence.strength(key),
      loadPrs: window.__repforgePrTimeline("load").filter((entry) => entry.exerciseId === "seed-ex-3"),
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
  assert.equal(week.ev.plannedWorkingSets, PLANNED_WEEK, "this-week planned is one canonical week (18 rows x 2 sets)");
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
  assert.equal(block.ev.plannedWorkingSets, PLANNED_WEEK);
  assert.equal(block.ev.period.end, "2026-09-17", "block-to-date runs through today, never a fixed 28-day window");
  await context.close();
}

// Sparse observations remain neutral throughout Overview and Review.
{
  const sparseLog = log.filter((row) => ["b1", "b4"].includes(row.session));
  const { context, page } = await freshPage({ seededLog: sparseLog });
  const overview = await page.locator("#segOverview").textContent();
  assert.doesNotMatch(overview, /Attention|Below/, "legacy warning labels are absent for baseline-building evidence");
  assert.match(overview, /Needs attention\s*\(0\)[\s\S]*Nothing requires action/,
    "insufficient evidence contributes zero Needs attention items");
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
    { session: "old", date: "2026-09-16", created: "2026-09-16T08:00:00.000Z", blockId: "block-old", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 200, reps: 8, rir: 2, set: 1, work: true },
    { session: "current-early", date: "2026-09-16", created: "2026-09-16T09:00:00.000Z", blockId: "block-current", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "current-late", date: "2026-09-16", created: "2026-09-16T18:00:00.000Z", blockId: "block-current", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 105, reps: 8, rir: 2, set: 1, work: true },
    { session: "legacy", date: "2026-09-17", created: "2026-09-17T08:00:00.000Z", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 300, reps: 8, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: scopedLog, seededMeta: scopedMeta });
  await page.evaluate(() => window.__repforgeStatsNav.setEvidenceView("strength"));
  await page.waitForSelector("#segStrength.active", { timeout: 5000 });
  const key = await page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3"));
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
// and a changed exposure (a lower load with no gain in strength or volume; a higher load is judged on e1RM) is not promoted to an action outcome. Both cases use
// the real producer → model → renderer path.
{
  const scopedMeta = seedProgramMeta({ id: "evidence-contract", started: "2026-09-14", blockId: "block-contract" });
  const contractLog = [
    { session: "bench-1", date: "2026-09-15", created: "2026-09-15T09:00:00.000Z", blockId: "block-contract", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 100, reps: 8, set: 1, work: true },
    { session: "bench-2", date: "2026-09-16", created: "2026-09-16T09:00:00.000Z", blockId: "block-contract", day: "Day 1", exerciseId: "seed-ex-3", name: "Incline chest press", load: 101, reps: 8, set: 1, work: true },
    { session: "rdl-1", date: "2026-09-15", created: "2026-09-15T10:00:00.000Z", blockId: "block-contract", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 100, reps: 8, rir: 2, set: 1, work: true },
    { session: "rdl-2", date: "2026-09-16", created: "2026-09-16T10:00:00.000Z", blockId: "block-contract", day: "Day 2", exerciseId: "seed-ex-8", name: "Romanian deadlift", load: 95, reps: 8, rir: 2, set: 1, work: true },
  ];
  const { context, page } = await freshPage({ seededLog: contractLog, seededMeta: scopedMeta });
  const values = await page.evaluate(() => {
    const bench = window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3");
    const rdl = window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-8");
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

// A mid-block program edit changes the current and future weeks only: the
// planned volume of weeks already elapsed keeps its own prescription across a
// reload, and the bounded aggregate that holds it is guarded at the write
// boundary.
{
  const editMeta = seedProgramMeta({ id: "edit-history-program", started: "2026-09-01", blockId: "block-edit-history" });
  const { context, page } = await freshPage({ seededLog: [], seededMeta: editMeta, fixedNow: "2026-09-10T12:00:00.000Z" });
  const before = await page.evaluate(() => window.__repforgeProgressEvidence.volume("block-to-date"));
  assert.equal(before.period.elapsedNumberedWeeks, 2, "the fixture is in the block's second week");
  assert.equal(before.plannedWorkingSets, PLANNED_WEEK * 2, "two unedited weeks plan two canonical weeks");
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForSelector("#program.view.active", { timeout: 5000 });
  if (await page.locator("#programEditorWrap").evaluate((element) => element.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  const editedRow = page.locator('#programEditor [data-role="exercise"][data-id="seed-ex-3"]');
  await editedRow.waitFor({ timeout: 5000 });
  if (await editedRow.locator('[data-role="sets-control"]').count() === 0) await editedRow.locator('[data-role="toggle-exercise"]').click();
  await editedRow.locator('[data-role="adjust"][data-field="sets"][data-delta="1"]').click();
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state().program.find((row) => row.id === "seed-ex-3")?.sets === 3,
    null, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
  const weekTwo = await page.evaluate(() => ({
    block: window.__repforgeProgressEvidence.volume("block-to-date"),
    week: window.__repforgeProgressEvidence.volume("this-week"),
  }));
  assert.equal(weekTwo.week.plannedWorkingSets, PLANNED_WEEK + 1, "this week plans the edited prescription");
  assert.equal(weekTwo.block.plannedWorkingSets, PLANNED_WEEK + PLANNED_WEEK + 1,
    "block-to-date keeps week one's prescription and uses the edited week two");

  await page.evaluate(() => sessionStorage.setItem("__repforge_test_now", "2026-09-17T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  const weekThree = await page.evaluate(() => window.__repforgeProgressEvidence.volume("block-to-date"));
  assert.equal(weekThree.period.elapsedNumberedWeeks, 3, "the reloaded fixture is in week three");
  // The editor's set change belongs to the cycle it was made in (cycle 2);
  // week three plans cycle 3 as the definition authors it.
  assert.equal(weekThree.plannedWorkingSets, PLANNED_WEEK + (PLANNED_WEEK + 1) + PLANNED_WEEK,
    "after a reload each elapsed week keeps its own cycle's prescription");

  const malformedHistory = await page.evaluate(async () => {
    const invalid = structuredClone(window.__repforgeWorkoutDraft.state());
    invalid.programMeta.plannedVolumeHistory = {
      schemaVersion: 1, throughWeek: 1, plannedSessions: 3, plannedWorkingSets: -1, muscles: { direct: {}, secondary: {} },
    };
    const writes = [];
    const result = await window.__repforgeStorage.writeWithAdapter(invalid, {
      writeLocal: async () => { writes.push("local"); return true; },
      writeIdb: async () => { writes.push("idb"); return true; },
    });
    return { result, writes };
  });
  assert.equal(malformedHistory.result.code, "invalid-state", "a malformed planned-volume aggregate is rejected at the write boundary");
  assert.deepEqual(malformedHistory.writes, [], "a malformed aggregate touches neither durable replica");
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

// Canvas chart labels follow the app's text scale, including the 200% setting.
// The exercise page owns the canvas now that the overview carries none.
async function openExerciseCanvas(page) {
  await page.evaluate(() => openExerciseView("seed-ex-3", "log"));
  await page.waitForSelector("#exercise.view.active #exChart", { timeout: 5000 });
}
{
  const { context, page } = await freshPage();
  await openExerciseCanvas(page);
  const fonts = await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    const seen = [];
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.fillText;
    prototype.fillText = function (...args) {
      seen.push(this.font);
      return original.apply(this, args);
    };
    try {
      draw([
        { date: "2026-09-14", e1rm: 60, top: 55 },
        { date: "2026-09-16", e1rm: 62, top: 57 },
        { date: "2026-09-18", e1rm: 65, top: 60 },
      ], "#exChart");
    } finally {
      prototype.fillText = original;
    }
    return {
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      sizes: seen.map((font) => parseFloat(font)),
    };
  });
  assert.ok(fonts.sizes.length >= 5, "the populated chart draws axis, value, and date labels");
  assert.ok(fonts.sizes.every((size) => size >= fonts.root * 0.75 - 0.5),
    `all chart labels use the frozen caption scale at 200% text (${JSON.stringify(fonts)})`);

  async function assertEmptyChartFits(lang) {
    const empty = await freshPage({ lang });
    await empty.page.setViewportSize({ width: 320, height: 844 });
    await openExerciseCanvas(empty.page);
    const lines = await empty.page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
      const canvas = document.querySelector("#exChart");
      const extents = [];
      const prototype = CanvasRenderingContext2D.prototype;
      const original = prototype.fillText;
      prototype.fillText = function (text, x, y) {
        const width = this.measureText(text).width;
        extents.push({ width, x, align: this.textAlign, canvasWidth: canvas.clientWidth });
        return original.call(this, text, x, y);
      };
      try {
        draw([], "#exChart");
      } finally {
        prototype.fillText = original;
      }
      return extents.map(({ width, x, align, canvasWidth }) => ({
        left: align === "center" ? x - width / 2 : align === "right" ? x - width : x,
        right: align === "center" ? x + width / 2 : align === "right" ? x : x + width,
        canvasWidth,
      }));
    });
    assert.ok(lines.length > 1, `the ${lang} empty-chart message wraps at 320px and 200% text`);
    assert.ok(lines.every(({ left, right, canvasWidth }) => left >= 0 && right <= canvasWidth),
      `the ${lang} empty-chart message stays inside the canvas at 320px and 200% text (${JSON.stringify(lines)})`);
    await empty.context.close();
  }
  await assertEmptyChartFits("en");
  await assertEmptyChartFits("pt");
  await context.close();
}

// A03: numbered weeks are calendar days, not elapsed local milliseconds. In
// America/New_York 2026-03-02 -> 2026-03-09 is 167 hours (spring DST), which
// once selected week 1 and planned one elapsed week on the start of week 2.
{
  const seeded = seedProgram();
  const mkRow = (session, date, reps) => ({ session, date, day: "Day 1", exerciseId: seeded[0].id, name: seeded[0].name,
    primary: seeded[0].primary, load: 50, reps, rir: 2, set: 1, work: true });
  const evidenceAt = async (started, fixedNow, dates) => {
    const { context, page } = await freshPage({ timezoneId: "America/New_York", fixedNow, seededProgram: seeded,
      seededMeta: seedProgramMeta({ id: "dst-program", started }),
      seededLog: dates.map((date, i) => mkRow(`d${i + 1}`, date, 8 + i)) });
    const result = await page.evaluate(() => ({
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      today: new Date().toLocaleDateString("en-CA"),
      week: window.__repforgeProgressEvidence.volume("this-week"),
      block: window.__repforgeProgressEvidence.volume("block-to-date"),
      lifecycle: window.__repforgeMesocycleWeek(),
    }));
    await context.close();
    return result;
  };
  const dst = await evidenceAt("2026-03-02", "2026-03-09T16:00:00.000Z", ["2026-03-02", "2026-03-09"]);
  assert.equal(dst.tz, "America/New_York");
  assert.equal(dst.today, "2026-03-09", "the fixed browser clock is 2026-03-09 local");
  assert.equal(dst.week.period.weekNumber, 2, "March 9 is numbered week 2 across spring DST");
  assert.equal(dst.week.start, "2026-03-09");
  assert.equal(dst.week.end, "2026-03-15");
  assert.deepEqual(dst.week.completedRows.map((r) => r.session), ["d2"], "the March 9 session is in this week");
  assert.equal(dst.block.period.elapsedNumberedWeeks, 2, "block-to-date elapses two numbered weeks");
  assert.equal(dst.block.plannedSessions, 6);
  assert.equal(dst.block.plannedWorkingSets, 72);
  assert.equal(dst.week.plannedSessions, 3);
  assert.equal(dst.week.plannedWorkingSets, 36);
  assert.equal(dst.block.completedSessions, 2);
  assert.equal(dst.lifecycle.elapsedWeek, 2, "app lifecycle (mesocycleLifecycle) numbers March 9 as week 2");
  assert.equal(dst.lifecycle.current, 2);

  // Fall DST: 2026-10-26 -> 2026-11-02 spans 169 hours and stays week 2.
  const fall = await evidenceAt("2026-10-26", "2026-11-02T17:00:00.000Z", ["2026-10-26", "2026-11-02"]);
  assert.equal(fall.today, "2026-11-02");
  assert.equal(fall.week.period.weekNumber, 2);
  assert.equal(fall.week.start, "2026-11-02");
  assert.equal(fall.week.end, "2026-11-08");
  assert.deepEqual(fall.week.completedRows.map((r) => r.session), ["d2"]);
  assert.equal(fall.block.period.elapsedNumberedWeeks, 2);
  assert.equal(fall.block.plannedWorkingSets, 72);
  assert.equal(fall.lifecycle.elapsedWeek, 2);

  // Ordinary control, same zone, no DST in the span: unchanged.
  const plain = await evidenceAt("2026-09-14", "2026-09-21T16:00:00.000Z", ["2026-09-14", "2026-09-21"]);
  assert.equal(plain.week.period.weekNumber, 2);
  assert.equal(plain.week.start, "2026-09-21");
  assert.equal(plain.block.period.elapsedNumberedWeeks, 2);
  assert.equal(plain.block.plannedSessions, 6);
  assert.equal(plain.block.plannedWorkingSets, 72);
  assert.equal(plain.lifecycle.elapsedWeek, 2);
}

// The exercise chart (Plan 064 R3i): opened from Progress, it draws the
// scope's top loads as the step itself, snaps one selection across the plot, the
// readout and the table, and reads every figure from the model's series.
{
  const { context, page } = await freshPage();
  const key = await page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3"));
  const model = await page.evaluate((k) => ({
    block: window.__repforgeProgressEvidence.strength(k).points.map((p) => ({ date: p.date, value: p.value, reps: p.reps })),
    sessions: strengthProjection("current-block").sessions.filter((x) => x.liftKey === k).map((x) => ({ top: x.top, e1rm: x.e1rm })),
  }), key);
  assert.equal(model.block.length, 3, "the bench series has three block points");

  await page.evaluate((k) => openExerciseView(k, "stats"), key);
  await page.waitForSelector("#exercise.view.active .exchart__plot", { timeout: 5000 });
  assert.match(await page.locator("#exBack").textContent(), /Progress/, "the page goes back to Progress");
  assert.equal(await page.locator("#exDetail #exChart").count(), 0, "Progress' chart page carries no canvas");

  const read = () => page.evaluate(() => ({
    figs: [...document.querySelectorAll(".exchart__figs div")].map((d) => d.textContent.replace(/\s+/g, " ").trim()),
    rows: [...document.querySelectorAll(".exrow")].map((b) => ({ pt: b.dataset.pt, pressed: b.getAttribute("aria-pressed"), text: b.textContent.replace(/\s+/g, " ").trim(), old: b.classList.contains("is-old") })),
    readout: document.querySelector(".exchart__readout").textContent.replace(/\s+/g, " ").trim(),
    selected: document.querySelectorAll(".exchart__svg .ex-pt--sel").length,
    ticks: document.querySelectorAll(".exchart__svg .ex-tick").length,
    block: !!document.querySelector(".exchart__svg .ch-block"),
    pressed: [...document.querySelectorAll(".segpill button")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.scope || b.dataset.metric),
    label: document.querySelector(".exchart__plot").getAttribute("aria-label"),
  }));

  // Top load, current block: three points, two rises, the latest selected.
  let view = await read();
  assert.deepEqual(view.pressed, ["current-block", "top"], "the block and top-load toggles start selected");
  assert.equal(view.rows.length, 3, "one table row per session in the scope");
  assert.deepEqual(view.rows.map((r) => r.pt), ["2", "1", "0"], "the table lists the newest session first");
  assert.equal(view.rows[0].pressed, "true", "the latest session starts selected");
  assert.equal(view.selected, 1, "the plot marks one selected point");
  assert.equal(view.ticks, 2, "a tick marks each load increase in the block");
  assert.equal(view.block, false, "no block rule is drawn when the scope is the block");
  assert.match(view.figs[0], /60/, "the first figure is the best top load");
  assert.match(view.figs[1], /\+5/, "the second figure is the change over the block");
  assert.match(view.figs[2], /^3\s*sessions/, "the third figure counts the sessions");
  assert.match(view.readout, /60/, "the readout names the selected value");
  assert.match(view.readout, /60 × 8/, "the readout names the source set");
  assert.match(view.rows[0].text, /\+2\.5/, "a row's delta is its change from the session before");
  assert.match(view.label, /Top load/, "the plot is labelled with the metric");

  // A table row selects the same point everywhere.
  await page.click('.exrow[data-pt="0"]');
  view = await read();
  assert.equal(view.rows.find((r) => r.pt === "0").pressed, "true");
  assert.equal(view.rows.filter((r) => r.pressed === "true").length, 1, "exactly one row is selected");
  assert.match(view.readout, /55/, "the readout follows the table row");
  assert.equal(view.selected, 1);

  // The whole plot is one target that snaps to the nearest session.
  const hit = await page.evaluate(() => {
    const plot = document.querySelector(".exchart__plot"), r = plot.getBoundingClientRect();
    const xs = plot.dataset.xs.split(",").map(Number), w = +plot.dataset.w;
    return { x: r.left + xs[1] / w * r.width + 6, y: r.top + r.height / 2 };
  });
  await page.mouse.click(hit.x, hit.y);
  view = await read();
  assert.equal(view.rows.find((r) => r.pt === "1").pressed, "true", "a tap near the second point selects the second session");
  assert.match(view.readout, /57\.5/, "the readout follows the plot");

  // Best e1RM is the second metric, in its own units, from the same sessions.
  await page.click('#exDetail [data-metric="e1rm"]');
  view = await read();
  assert.deepEqual(view.pressed, ["current-block", "e1rm"]);
  assert.equal(view.ticks, 0, "the e1RM line draws no load-increase ticks");
  const bestE1rm = Math.max(...model.sessions.map((x) => x.e1rm));
  assert.match(view.figs[0], new RegExp(String(Math.round(bestE1rm * 10) / 10).replace(".", "\\.")), "the first figure is the best e1RM");
  assert.match(view.figs[0], /e1RM/);

  // All history adds the earlier session, ruled off from the block.
  await page.click('#exDetail [data-metric="top"]');
  await page.click('#exDetail [data-scope="all-history"]');
  view = await read();
  assert.equal(view.rows.length, 4, "all history lists the earlier session too");
  assert.equal(view.rows.at(-1).old, true, "the earlier session is set apart from the block");
  assert.equal(view.block, true, "a rule marks where the block starts");
  assert.equal(view.ticks, 3, "every rise across the history is ticked");
  assert.match(view.figs[0], /60/);
  assert.match(view.figs[1], /\+10/, "the change spans the history");

  await page.evaluate(() => closeExerciseView());
  await context.close();
}
{
  const { context, page } = await freshPage({ unit: "lb", lang: "pt" });
  const key = await page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3"));
  await page.evaluate((k) => openExerciseView(k, "stats"), key);
  await page.waitForSelector(".exchart__plot", { timeout: 5000 });
  const text = await page.evaluate(() => ({
    figs: [...document.querySelectorAll(".exchart__figs span")].map((s) => s.textContent),
    readout: document.querySelector(".exchart__readout").textContent,
  }));
  assert.ok(text.figs[0].includes("lb") && text.figs[1].includes("lb"), `figures follow the unit setting (${text.figs})`);
  assert.match(text.readout, /132[,.]\d+/, "the readout converts 60 kg to pounds once");
  await context.close();
}

// R7 V-09: the lift's chart page at double-size text, Portuguese and pounds (the widest labels and figures). At 390 and
// at 320 the page does not scroll sideways, the three figures neither overprint nor spill, every axis label stays
// inside the drawing's viewBox, and no column of the table (the change column included) is cut or leaves the screen.
{
  const { context, page } = await freshPage({ unit: "lb", lang: "pt" });
  const key = await page.evaluate(() => window.__repforgeProgressEvidence.keyForExerciseId("seed-ex-3"));
  await page.evaluate((k) => openExerciseView(k, "stats"), key);
  await page.waitForSelector(".exchart__plot", { timeout: 5000 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  for (const [width, height] of [[390, 844], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".exchart__figs > div")];
      const boxes = cells.map((cell) => cell.getBoundingClientRect());
      const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1));
      const spill = cells.filter((cell) => { const b = cell.querySelector("b"); return b.scrollWidth > b.clientWidth + 1 || cell.querySelector("span").scrollWidth > cell.clientWidth + 1; }).length;
      const svg = document.querySelector(".exchart__svg"), vb = svg.viewBox.baseVal;
      const outside = [...svg.querySelectorAll("text")].filter((text) => {
        const bb = text.getBBox();
        return bb.x < vb.x - 0.5 || bb.x + bb.width > vb.x + vb.width + 0.5 || bb.y < vb.y - 0.5 || bb.y + bb.height > vb.y + vb.height + 0.5;
      }).map((text) => text.textContent);
      const rows = [...document.querySelectorAll(".exchart__cols, .exrow")];
      const cut = rows.flatMap((row) => [...row.children].filter((cell) => cell.scrollWidth > cell.clientWidth + 1 || cell.getBoundingClientRect().right > innerWidth + 0.5 || cell.getBoundingClientRect().left < -0.5).map((cell) => cell.textContent.trim()));
      const delta = document.querySelector(".exrow span:last-child");
      return { scrollWidth: document.documentElement.scrollWidth, width: innerWidth, overlap, spill, outside, cut, deltaShown: !!delta && delta.getBoundingClientRect().right <= innerWidth + 0.5, rows: rows.length };
    });
    const label = `${width}px PT 200%`;
    assert.ok(m.scrollWidth <= m.width, `${label}: the page does not scroll sideways (${m.scrollWidth} > ${m.width})`);
    assert.equal(m.overlap, false, `${label}: the three figures do not overprint`);
    assert.equal(m.spill, 0, `${label}: no figure or its label spills out of its cell`);
    assert.deepEqual(m.outside, [], `${label}: every axis label is inside the drawing's viewBox`);
    assert.deepEqual(m.cut, [], `${label}: no table cell is cut or leaves the screen`);
    assert.ok(m.deltaShown && m.rows > 1, `${label}: the change column is whole on screen`);
  }
  await context.close();
}

assert.deepEqual(errors, [], "no page errors during evidence journeys");
await browser.close();
console.log("PASS: progress evidence (sparse policy, scopes, periods, drill-ins)");
