#!/usr/bin/env node
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
let failed = 0, passed = 0;
const assert = (condition, name, detail = "") => {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? `\n    ${detail}` : ""}`); }
};

const prescription = {
  schemaVersion: 1,
  strategy: { id: "rep_goal", version: 1, params: {
    workingSets: 3, repGoal: 30, repFloor: 6, repCeiling: 12,
    targetRirMin: 1, targetRirMax: 3, minLoadIncrement: 2.5,
    jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
  } },
  modifiers: [],
};
const state = {
  settings: { jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "", unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false, notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true } },
  programMeta: { id: "offline-progression", name: "Offline progression", started: "2026-08-01", created: "2026-08-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z", onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: null, experience: null, daysPerWeek: 1, splitType: "full_body", equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null },
  program: [{ id: "offline-slot", day: "Day 1", order: 1, name: "Bench press", sets: 3, min: 6, max: 12, primary: "Chest", secondary: "Triceps", notes: "", alternates: [], progression: prescription }],
  log: [], programHistory: [],
};

const browser = await launchChromium();
const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 390, height: 844 } });
const page = await context.newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: KEY, value: state });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  assert(await page.evaluate(() => !!navigator.serviceWorker.controller), "the online load installs and controls the cached shell");
  await context.setOffline(true);
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  assert(response?.fromServiceWorker() === true, "the cached app boots offline");
  await page.click('nav button[data-view="program"]');
  await page.click("#programEditToggle");
  const editor = page.locator('[data-progression-editor="offline-slot"]');
  await editor.locator("summary").click();
  assert(await editor.locator('[data-progression-strategy]').inputValue() === "rep_goal", "the progression editor renders from cached JS and copy");
  await editor.locator('[data-progression-strategy]').selectOption("manual");
  await editor.locator('button[type="submit"]').click();
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").program?.[0]?.progression?.strategy?.id === "manual", KEY);
  assert((await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").program[0].progression.strategy.id, KEY)) === "manual", "an editor save remains local and works offline");
  const config = await page.evaluate(async () => {
    try { const response = await fetch("./posthog-config.js"); return { ok: response.ok, status: response.status }; }
    catch (error) { return { ok: false, error: String(error) }; }
  });
  assert(config.ok || config.status === 404, "optional analytics config never blocks offline progression", JSON.stringify(config));
} finally {
  await context.setOffline(false).catch(() => {});
  await browser.close();
}

console.log(`\nprogression strategies offline: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
