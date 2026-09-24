#!/usr/bin/env node
/** Plan 057: automatic guide eligibility stays owned by the guide registry. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DATA_KEY = "repforge_v1";
const UI_KEY = "repforge_ui_v1";

const data = {
  settings: {
    jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120,
    lastExport: "", unit: "kg", lang: "en", rirMode: "numeric",
    voiceInputEnabled: false,
    notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
  },
  programMeta: {
    id: "guide-history-program", name: "Guide history program", started: "2026-01-01",
    created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z",
    onboarded: true, daysPerWeek: 1, splitType: "full_body", mesocycleLengthWeeks: 6,
    mesocycleStatus: "active", goal: null, experience: null, equipment: [],
    priorityMuscles: [], sessionLength: null, completedAt: null,
  },
  program: [{
    id: "guide-exercise", day: "Day 1", order: 1, name: "Barbell squat", sets: 1,
    min: 6, max: 10, primary: "Quads", secondary: "Glutes", notes: "", alternates: [],
    libraryId: "sq_bb",
  }],
  log: [{
    session: "historical-session", date: "2026-09-16", created: "2026-09-16T09:00:00.000Z",
    day: "Day 1", name: "Barbell squat", exerciseId: "guide-exercise", set: 1,
    load: 80, reps: 8, rir: 2, work: true, primary: "Quads", secondary: "Glutes",
    performedName: "Barbell squat", performedMovementId: "library:sq_bb",
  }],
  programHistory: [], customExercises: [], _storageRevision: 3,
};

const ui = {
  theme: "light", lang: "en",
  guideState: {
    "first-set": { version: 1, status: "unseen", lastTransitionAt: null },
    "focus-utilities": { version: 1, status: "unseen", lastTransitionAt: null },
  },
};

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
const page = await context.newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(async ({ dataKey, uiKey, dataValue, uiValue }) => {
    localStorage.clear();
    localStorage.setItem(dataKey, JSON.stringify(dataValue));
    localStorage.setItem(uiKey, JSON.stringify(uiValue));
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(dataValue, dataKey);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
  }, { dataKey: DATA_KEY, uiKey: UI_KEY, dataValue: data, uiValue: ui });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 15000 });
  await page.waitForSelector('[data-guide-cue="first-set"]', { timeout: 15000 });

  const evidence = await page.evaluate(({ dataKey, uiKey }) => ({
    guideStatus: JSON.parse(localStorage.getItem(uiKey) || "{}").guideState?.["first-set"]?.status,
    historicalSessions: new Set((JSON.parse(localStorage.getItem(dataKey) || "{}").log || []).map((row) => row.session)).size,
    cue: document.querySelector('[data-guide-cue="first-set"]')?.dataset.anchorTarget || "",
    anchor: document.querySelector('[data-guide-cue="first-set"]')?.dataset.anchorTarget
      ? document.querySelector(document.querySelector('[data-guide-cue="first-set"]').dataset.anchorTarget)
      : null,
  }), { dataKey: DATA_KEY, uiKey: UI_KEY });
  assert.equal(evidence.guideStatus, "shown", "existing workout history does not suppress automatic first-set guide eligibility");
  assert.equal(evidence.historicalSessions, 1, "guide eligibility reads history without changing durable workout facts");
  assert.ok(evidence.cue && evidence.anchor, "automatic guide remains anchored to its real Save control");
} finally {
  await context.close();
  await browser.close();
}

console.log("guide eligibility: 3 passed, 0 failed");
