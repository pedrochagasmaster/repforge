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

async function freshPage({ lang = "en", unit = "kg", seededLog = log, seededMeta = meta, seededProgram = program, fixedNow = "2026-09-17T12:00:00.000Z" } = {}) {
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
  await page.evaluate(async ({ program, meta, log, lang, unit }) => {
    const raw = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    raw.program = program;
    raw.programMeta = meta;
    raw.log = log;
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
  }, { program: seededProgram, meta: seededMeta, log: seededLog, lang, unit });
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

// Historical prescriptions are versioned at the installed-editor boundary.
// This covers a recovery week, the following edited week, a second edit in
// week three, and a later block-to-date total across a reload.
{
  const provenanceProgram = [
    { id: "prov-ex-1", slotId: "prov-slot-1", dayId: "prov-day-1", day: "Day 1", order: 1, name: "Incline chest press", sets: 2, min: 6, max: 10, primary: "Chest", secondary: "" },
    { id: "prov-ex-2", slotId: "prov-slot-2", dayId: "prov-day-2", day: "Day 2", order: 1, name: "Romanian deadlift", sets: 2, min: 6, max: 10, primary: "Hamstrings", secondary: "" },
  ];
  const weekEntry = (week, firstSets, secondSets) => ({ week, phase: week === 1 ? "recovery" : "normal", days: [
    { dayId: "prov-day-1", slots: [{ slotId: "prov-slot-1", sets: firstSets }] },
    { dayId: "prov-day-2", slots: [{ slotId: "prov-slot-2", sets: secondSets }] },
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
    };
  });
  assert.equal(weekTwo.evidence.plannedWorkingSets, 7,
    "week two block-to-date keeps the recovery prescription and uses the edited week-two prescription");
  assert.deepEqual(weekTwo.structure.programVersions.map((entry) => entry.fromWeek), [1, 2],
    "the first installed edit records old and new program versions");
  assert.deepEqual(weekTwo.structure.weekPrescriptions.map((entry) =>
    entry.days.reduce((sum, day) => sum + day.slots.reduce((n, slot) => n + slot.sets, 0), 0)), [2, 5, 5, 5],
    "the durable weekly receipt preserves recovery and updates only current/future weeks");

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
    };
  });
  assert.equal(afterWeekThreeEdit.evidence.plannedWorkingSets, 13,
    "a week-three edit does not reproject the recovery or week-two denominator");
  assert.deepEqual(afterWeekThreeEdit.structure.programVersions.map((entry) => entry.fromWeek), [1, 2, 3],
    "later edits append one version boundary instead of replacing history");

  await page.evaluate(() => sessionStorage.setItem("__repforge_test_now", "2026-09-24T12:00:00.000Z"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 20000 });
  const later = await page.evaluate(() => window.__repforgeProgressEvidence.volume("block-to-date"));
  assert.equal(later.period.elapsedNumberedWeeks, 4, "the later block-to-date period is capped at the block length");
  assert.equal(later.plannedWorkingSets, 19,
    "later totals sum the exact recovery, week-two, week-three, and week-four prescriptions");
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
