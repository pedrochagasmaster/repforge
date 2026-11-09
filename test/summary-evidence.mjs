#!/usr/bin/env node
/**
 * Plan 057 F057-02: Summary evidence must distinguish a first observation from
 * prior observations that cannot support an outcome. The canonical producer is
 * the independent oracle for every case.
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { metricLogRow } from "./fixtures/history-metric-rows.mjs";

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

/** One saved Weight+Reps set in the shape a finished DraftV2 workout commits.
 *  An omitted `rir` is a set logged without effort (stored as null). */
function row(session, date, exerciseId, load, reps, rir) {
  const ex = PROGRAM.find((item) => item.id === exerciseId);
  return metricLogRow(META, ex, {
    session, date, day: "Day 1", set: 1, load, reps, rir: rir === undefined ? null : rir,
    created: date + "T09:00:00.000Z",
  });
}

async function boot(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function seed(page, log, lang = "en") {
  await page.evaluate(async ({ key, program, meta, nextLog, lang }) => {
    const raw = JSON.parse(localStorage.getItem(key) || "{}");
    const next = {
      ...raw, program, programMeta: meta, log: nextLog, programHistory: [],
      settings: { ...raw.settings, lang, unit: "kg", rirMode: "numeric", hardRir: 4 },
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
  }, { key: KEY, program: PROGRAM, meta: META, nextLog: log, lang });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
}

async function build(page, previous, current, { open = true, lang = "en" } = {}) {
  await page.evaluate(() => window.__repforgeSessionSummary.close());
  await seed(page, [...previous, ...current], lang);
  return page.evaluate(({ previousRows, currentRows, open }) => {
    const summary = window.__repforgeSessionSummary.build({
      rows: currentRows, prevLog: previousRows, session: currentRows[0]?.session || "summary-current",
      date: currentRows[0]?.date || "2026-09-17", day: "Day 1", startedAt: 0,
    });
    const ids = new Set(currentRows.map((item) => "library:" + item.performedLibraryId));
    const records = window.__repforgeProgressEvidence.records("current-block")
      .filter((record) => ids.has(record.exerciseId));
    if (open) window.__repforgeSessionSummary.open(summary);
    return {
      summary,
      records,
      baselineVisible: !!document.querySelector("#sessionSummary .sum-baseline"),
      outcomes: [...document.querySelectorAll("#sessionSummary .sum-outcome")].map((element) => ({
        exerciseId: element.dataset.exerciseId, outcome: element.dataset.outcome,
      })),
    };
  }, { previousRows: previous, currentRows: current, open });
}

const browser = await launchChromium();
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

  // A lower load with no more strength or work is the one exposure change the
  // session-outcome rule refuses to judge (CONTEXT.md "Session outcome").
  const changedExposure = await build(page,
    [row("changed-previous", "2026-09-15", "seed-ex-4", 100, 8, 2)],
    [row("changed-current", "2026-09-17", "seed-ex-4", 95, 8, 2)]);
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

  const checkRow = { ...row("finding-current", "2026-09-17", "seed-ex-3", 60, 12, 0),
    effortSource: "failure", calibration: { v: 1, predictedReps: 10, predictionEdited: false, prefillBasis: "reps_rir" } };
  const finding = await build(page, [], [checkRow], { open: false });
  const unopened = await page.evaluate(summary => {
    const element = document.querySelector("#sessionSummary"), parent = element.parentElement;
    element.remove();
    const opened = window.__repforgeSessionSummary.open(summary);
    parent.append(element);
    return { opened, seen: JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").findingsSeen };
  }, finding.summary);
  check(unopened.opened === false && !unopened.seen?.includes("first_check"),
    "deriving a finding or failing to open the finish screen does not mark it seen");
  await page.evaluate(summary => window.__repforgeSessionSummary.open(summary), finding.summary);
  const findingLine = page.locator("#sumFinding");
  check(await findingLine.count() === 1 && /New today/.test(await findingLine.textContent() || ""),
    "a test set released by this session appears above the tiles as New today");
  check(await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").findingsSeen?.includes("first_check")),
    "opening the real finish screen marks the displayed finding seen in device preferences");
  check(!Object.hasOwn(finding.summary, "streak") && !await page.locator('[data-tile="streak"]').count(),
    "neither the summary model nor its tiles retain the consecutive-week count");
  if (await findingLine.count()) {
    await findingLine.click();
    check(await page.locator("#overviewProfile").isVisible() &&
      await page.locator("#overviewProfile").evaluate(el => document.activeElement === el),
      "the finding opens Progress Overview and focuses the profile");
  } else check(false, "the finding opens Progress Overview and focuses the profile");
  const repeated = await build(page, [], [checkRow]);
  check(await page.locator("#sumFinding").count() === 1 &&
    !/New today/.test(await page.locator("#sumFinding").textContent() || ""),
    "after reload the same finding is no longer new and the next need takes its place");
  check(!Object.hasOwn(JSON.parse(await page.evaluate(() => localStorage.getItem("repforge_v1"))), "findingsSeen"),
    "seen findings stay outside durable training state");

  for (const lang of ["pt", "en"]) {
    await page.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}");
      delete prefs.findingsSeen;
      localStorage.setItem("repforge_ui_v1", JSON.stringify(prefs));
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await build(page, [], [checkRow], { lang });
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    const layout = await page.evaluate(() => {
      const line = document.querySelector("#sumFinding"), box = line?.getBoundingClientRect();
      return { label: line?.querySelector(".sum-finding__label")?.textContent,
        fits: box && box.width <= innerWidth && line.scrollWidth <= line.clientWidth && box.height >= 44 };
    });
    check(layout.fits && layout.label === (lang === "pt" ? "Novidade de hoje" : "New today"),
      `${lang}: the finding fits a 320px phone at 200% text with its localized label`, layout);
  }

  await context.close();
} finally {
  await browser.close();
}
console.log("\nsummary-evidence: " + results.passed + " passed, " + results.failed + " failed");
if (results.failed) process.exitCode = 1;
