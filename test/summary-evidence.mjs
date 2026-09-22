#!/usr/bin/env node
/**
 * Plan 057 F057-02: Summary evidence must distinguish a first observation from
 * prior observations that cannot support an outcome. The canonical producer is
 * the independent oracle for every case.
 */
import { chromium } from "playwright";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const PROGRAM = seedProgram();
const META = seedProgramMeta({ id: "summary-evidence", started: "2026-09-14", blockId: "block-current" });
const results = { passed: 0, failed: 0 };

function check(condition, name, detail = "") {
  if (condition) {
    results.passed++;
    console.log("  ✓ " + name);
  } else {
    results.failed++;
    console.log("  ✗ " + name);
    if (detail) console.log("    " + detail);
  }
}

function row(session, date, exerciseId, load, reps, rir) {
  const name = PROGRAM.find((item) => item.id === exerciseId)?.name || exerciseId;
  return {
    session, date, created: date + "T09:00:00.000Z", blockId: "block-current",
    day: "Day 1", exerciseId, performedMovementId: "slot:" + exerciseId,
    performedName: name, name, load, reps, ...(rir === undefined ? {} : { rir }), set: 1, work: true,
    primary: "Chest", secondary: "Triceps",
  };
}

async function boot(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function seed(page, log) {
  await page.evaluate(async ({ key, program, meta, nextLog }) => {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const next = {
      ...raw, program, programMeta: meta, log: nextLog, programHistory: [],
      settings: { ...raw.settings, lang: "en", unit: "kg", rirMode: "numeric", hardRir: 4 },
    };
    localStorage.setItem(key, JSON.stringify(next));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(next, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, program: PROGRAM, meta: META, nextLog: log });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function build(page, previous, current) {
  await page.evaluate(() => window.__repforgeSessionSummary.close());
  await seed(page, [...previous, ...current]);
  return page.evaluate(({ previousRows, currentRows }) => {
    const summary = window.__repforgeSessionSummary.build({
      rows: currentRows, prevLog: previousRows, session: currentRows[0]?.session || "summary-current",
      date: currentRows[0]?.date || "2026-09-17", day: "Day 1", startedAt: 0,
    });
    const ids = new Set(currentRows.map((item) => item.performedMovementId ? "movement:" + item.performedMovementId : ""));
    const records = window.__repforgeProgressEvidence.records("current-block")
      .filter((record) => ids.has(record.exerciseId));
    window.__repforgeSessionSummary.open(summary);
    return {
      summary,
      records,
      baselineVisible: !!document.querySelector("#sessionSummary .sum-baseline"),
      outcomes: [...document.querySelectorAll("#sessionSummary .sum-outcome")].map((element) => ({
        exerciseId: element.dataset.exerciseId, outcome: element.dataset.outcome,
      })),
    };
  }, { previousRows: previous, currentRows: current });
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  await boot(page);

  const first = await build(page, [], [row("first-current", "2026-09-17", "seed-ex-3", 60, 8, 2)]);
  const firstRecord = first.records[0];
  check(first.baselineVisible, "a genuinely first observation shows baseline copy", JSON.stringify(first));
  check(firstRecord?.evidenceState === "insufficient" && firstRecord?.evidenceCount === 1 &&
    firstRecord?.reason === "single-observation" && first.outcomes.length === 0,
  "the first-session claim is backed by the canonical one-observation record", JSON.stringify(firstRecord));

  const sufficient = await build(page,
    [row("sufficient-previous", "2026-09-16", "seed-ex-3", 55, 8, 2)],
    [row("sufficient-current", "2026-09-17", "seed-ex-3", 60, 8, 2)]);
  check(sufficient.records[0]?.evidenceState === "sufficient" && sufficient.records[0]?.outcome === "improved" &&
    sufficient.outcomes.length === 1 && !sufficient.baselineVisible,
  "a comparable second observation shows only the canonical outcome", JSON.stringify(sufficient));

  const missingEffort = await build(page,
    [row("missing-previous", "2026-09-15", "seed-ex-3", 55, 8, 2)],
    [row("missing-current", "2026-09-17", "seed-ex-3", 60, 8)]);
  check(missingEffort.records[0]?.evidenceState === "insufficient" &&
    missingEffort.records[0]?.reason === "missing-effort" &&
    missingEffort.outcomes.length === 0 && !missingEffort.baselineVisible,
  "missing effort removes both the outcome and the false first-session copy", JSON.stringify(missingEffort));

  const changedExposure = await build(page,
    [row("changed-previous", "2026-09-15", "seed-ex-4", 100, 8, 2)],
    [row("changed-current", "2026-09-17", "seed-ex-4", 103, 7, 2)]);
  check(changedExposure.records[0]?.evidenceState === "insufficient" &&
    changedExposure.records[0]?.reason === "changed-load" &&
    changedExposure.outcomes.length === 0 && !changedExposure.baselineVisible,
  "a canonical non-effort insufficiency reason also stays neutral", JSON.stringify(changedExposure));

  const sameLoadNoEffort = await build(page,
    [row("same-previous", "2026-09-15", "seed-ex-5", 55, 8, 2)],
    [row("same-current", "2026-09-17", "seed-ex-5", 55, 8)]);
  check(sameLoadNoEffort.records[0]?.evidenceState === "insufficient" &&
    sameLoadNoEffort.records[0]?.reason === "missing-effort" &&
    sameLoadNoEffort.summary.prs.length === 0 && sameLoadNoEffort.outcomes.length === 0 &&
    !sameLoadNoEffort.baselineVisible,
  "same load and reps without effort cannot become a false first observation", JSON.stringify(sameLoadNoEffort));

  const mixed = await build(page,
    [
      row("mixed-b-previous", "2026-09-15", "seed-ex-4", 50, 8, 2),
      row("mixed-c-previous", "2026-09-15", "seed-ex-5", 55, 8, 2),
    ],
    [
      row("mixed-a-current", "2026-09-17", "seed-ex-3", 60, 8, 2),
      row("mixed-b-current", "2026-09-17", "seed-ex-4", 50, 8, 2),
      row("mixed-c-current", "2026-09-17", "seed-ex-5", 60, 8),
    ]);
  const mixedById = Object.fromEntries(mixed.records.map((record) => [record.exerciseId, record]));
  check(mixed.summary.evidence?.length === 3 &&
    mixed.summary.evidence.some((item) => item.kind === "baseline") &&
    mixed.summary.evidence.some((item) => item.kind === "outcome" && item.outcome === "maintained") &&
    mixed.summary.evidence.some((item) => item.kind === "insufficient" && item.reason === "missing-effort") &&
    mixed.outcomes.length === 1 && !mixed.baselineVisible,
  "a mixed completion carries new, sufficient, and prior-insufficient evidence without a global false claim",
  JSON.stringify({ evidence: mixed.summary.evidence, records: mixedById, outcomes: mixed.outcomes }));

  const prInsufficient = await build(page,
    [row("pr-previous", "2026-09-15", "seed-ex-6", 40, 8, 2)],
    [row("pr-current", "2026-09-17", "seed-ex-6", 45, 8)]);
  check(prInsufficient.summary.prs.length === 1 &&
    prInsufficient.records[0]?.evidenceState === "insufficient" &&
    prInsufficient.outcomes.length === 0 && !prInsufficient.baselineVisible,
  "a PR may render while insufficient evidence still forbids new/outcome claims", JSON.stringify(prInsufficient));

  await context.close();
} finally {
  await browser.close();
}
console.log("\nsummary-evidence: " + results.passed + " passed, " + results.failed + " failed");
if (results.failed) process.exitCode = 1;

