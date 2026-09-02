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
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { key: KEY, value: state });
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
  await page.waitForSelector('#programEditor [data-role="editor"]');
  const editor = page.locator('#programEditor [data-role="exercise"][data-id="offline-slot"]');
  const shape = await editor.evaluate((element) => ({
    summary: element.querySelector('[data-role="exercise-summary"]')?.textContent?.trim(),
    sets: element.querySelector('[data-role="sets-value"]')?.textContent?.trim(),
    min: element.querySelector('[data-field="min"]')?.value,
    max: element.querySelector('[data-field="max"]')?.value,
  }));
  assert(shape.summary === "3 × 6–12" && shape.sets === "3" && shape.min === "6" && shape.max === "12",
    "the installed editor renders its prescription from the cached shell", JSON.stringify(shape));
  await page.locator('#programEditor [data-role="program-name"]').fill("Offline progression edited");
  await page.click("#programEditToggle");
  await page.waitForFunction((key) => {
    const saved = JSON.parse(localStorage.getItem(key) || "{}");
    return document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") &&
      saved.programMeta?.name === "Offline progression edited";
  }, KEY);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
  assert(saved.program?.[0]?.progression?.strategy?.id === "rep_goal",
    "an offline staged edit remains local and preserves its progression", JSON.stringify(saved.program?.[0]?.progression));
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
