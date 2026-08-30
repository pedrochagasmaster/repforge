#!/usr/bin/env node
/**
 * Production-backed entry property. Unlike the pure model suite this drives
 * the shipped app and crosses the real draft/activation transaction. Each
 * generated route must leave the durable active snapshot untouched while it is
 * being reviewed, then change it only after the explicit activation action.
 */
import assert from "node:assert/strict";
import fc from "fast-check";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const seed = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: { id: "runtime-active", name: "Current block", started: "2026-08-01", created: "2026-08-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z", onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, daysPerWeek: 1, goal: "hypertrophy", equipment: ["barbell"] },
  program: [{ id: "active-row", day: "Day 1", order: 1, name: "Barbell row", sets: 2, min: 6, max: 10, primary: "Back", secondary: "Biceps", notes: "", alternates: [], libraryId: "rw_bb" }],
  log: [{ session: "runtime-session", date: "2026-08-29", day: "Day 1", exerciseId: "active-row", set: 1, load: 50, reps: 8, rir: 2 }],
  programHistory: [], customExercises: [], _storageRevision: 7,
};

async function open(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.removeItem("repforge_program_setup_draft_v1");
    await window.__repforgeStorage.flush();
  }, { key: KEY, value: seed });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function recommend(page) {
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.click('[data-entry-route="recommend"]');
  for (const [key, value] of [["desiredResult", "muscle_growth"], ["structuredExperience", "6_to_24m"], ["recentConsistency", "most"]]) {
    await page.click(`[data-entry-pick="${key}"][data-entry-val="${value}"]`);
    if (key !== "structuredExperience") await page.click("#onbNext");
  }
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]'); await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]'); await page.click("#onbNext"); await page.click("#onbNext");
  if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click();
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

async function importRoute(page) {
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.click("#entryOwnToggle"); await page.click('[data-entry-route="import"]');
  await page.setInputFiles("#importProgram", { name: "runtime.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ meta: { name: "Imported runtime" }, exercises: [{ id: "r", day: "Day 1", name: "Barbell bench press", sets: 2, repLow: 6, repHigh: 10, muscles: ["Chest"] }] })) });
  await page.waitForSelector("#importReview.active", { timeout: 10000 }); await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

async function buildRoute(page) {
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.click("#entryOwnToggle"); await page.click('[data-entry-route="build"]');
  await page.fill("#entryProgramName", "Built runtime"); await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]'); await page.click("#onbNext");
  await page.waitForSelector("#programEditor .pday", { timeout: 10000 });
  const addCount = await page.locator('#programEditor [data-act="addEx"]').count();
  for (let index = 0; index < addCount; index++) {
    await page.locator('#programEditor [data-act="addEx"]').nth(index).click(); await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await page.locator("#exPickList [data-pick]").first().click(); await page.click("#exPickDone");
  }
  await page.waitForFunction(() => document.querySelector("#entryEditorActivate")?.disabled === false, { timeout: 10000 });
}

const browser = await launchChromium();
try {
  await fc.assert(fc.asyncProperty(fc.constantFrom("recommend", "import", "build"), async (route) => {
    const { context, page } = await open(browser);
    try {
      const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
      if (route === "recommend") await recommend(page);
      else if (route === "import") await importRoute(page);
      else await buildRoute(page);
      const review = await page.evaluate((key) => localStorage.getItem(key), KEY);
      assert.equal(review, before, `${route}: review/edit changed active bytes before activation`);
      await page.click(route === "build" ? "#entryEditorActivate" : "#entryActivate");
      await page.waitForTimeout(500);
      const after = await page.evaluate((key) => localStorage.getItem(key), KEY);
      assert.notEqual(after, before, `${route}: explicit activation commits a durable replacement`);
    } finally { await context.close(); }
  }), { numRuns: 3, seed: 201 });
  console.log("generative entry runtime: 3 production Build/Import/preview activation journeys pass");
} finally { await browser.close(); }
