#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    const compiler = window.RepForgeProgramCompiler;
    const compiled = compiler.compile({
      schemaVersion: 1,
      familyId: "balanced",
      frequency: 4,
      sessionMinutes: 90,
      equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
      environment: ["safe_pull", "training_support"],
      loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
    }, window.RepForgeExercises.library);
    const now = new Date().toISOString();
    localStorage.setItem("repforge_v1", JSON.stringify({
      settings: {
        jumpPct: 2.5, minJump: 2.5, rirHigh: 3, hardRir: 1, restSec: 120,
        unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
        notifyEnabled: false, notifyTimer: true, notifySession: true,
        notifyUnfinished: false, notifyMissed: false,
      },
      programMeta: {
        id: "day-name-browser", name: "Generated browser fixture", started: "2026-09-02",
        created: now, updated: now, goal: "balanced", experience: "intermediate",
        daysPerWeek: 4, splitType: "full_body", equipment: ["barbell"], priorityMuscles: [],
        sessionLength: "long", mesocycleLengthWeeks: 6, mesocycleStatus: "active",
        completedAt: null, onboarded: true, progressionRelations: [], progressionModifiers: [],
        progressionIncompatibilities: [], blockPromptDismissedId: null,
        programStructure: compiled.programStructure,
      },
      program: compiled.program,
      log: [], programHistory: [], customExercises: [], _storageRevision: 1,
    }));
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const english = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll("#dayTabs button")].map((button) => button.textContent.trim()),
    structure: JSON.parse(localStorage.getItem("repforge_v1")).programMeta.programStructure.days,
  }));
  assert.deepEqual(english.tabs, [
    "Lower body strength", "Upper body strength", "Lower body volume", "Upper body volume",
  ]);
  assert.equal(english.structure[0].label, "Lower primary");
  assert.equal(english.structure[0].displayNameKey, "program.day.balanced_4_d1");

  await page.click('nav button[data-view="program"]');
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll("#programOverview .prog-day__title")].map((node) => node.textContent.trim())),
    english.tabs,
  );
  await page.click("#programEditToggle");
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll("#programEditor .pday__name")].map((input) => input.value)),
    english.tabs,
  );

  await page.locator("#programEditor .pday__name").first().fill("My lower day");
  await page.locator("#programEditor .pday__name").first().press("Enter");
  await page.waitForTimeout(250);
  const renamed = await page.evaluate(() => ({
    input: document.querySelector("#programEditor .pday__name")?.value,
    day: JSON.parse(localStorage.getItem("repforge_v1")).programMeta.programStructure.days[0],
  }));
  assert.equal(renamed.input, "My lower day");
  assert.equal(renamed.day.dayId, "balanced_4_d1");
  assert.equal(renamed.day.nameOverride, "My lower day");
  assert.equal(renamed.day.displayNameKey, "program.day.balanced_4_d1");

  await page.evaluate(() => window.__repforgeShowSettings());
  await page.selectOption("#lang", "pt");
  await page.waitForTimeout(350);
  const portuguese = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll("#dayTabs button")].map((button) => button.textContent.trim()),
    day: JSON.parse(localStorage.getItem("repforge_v1")).programMeta.programStructure.days[0],
  }));
  assert.equal(portuguese.tabs[0], "My lower day");
  assert.equal(portuguese.tabs[1], "Força de membros superiores");
  assert.equal(portuguese.tabs[3], "Volume de membros superiores");
  assert.equal(portuguese.day.nameOverride, "My lower day");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  assert.deepEqual(
    await page.evaluate(() => [...document.querySelectorAll("#dayTabs button")].map((button) => button.textContent.trim())),
    portuguese.tabs,
    "language and custom day name survive reload",
  );
  await context.close();
  console.log("PASS browser day names: authored localization and exact custom rename survive language switch");
} finally {
  await browser.close();
}
