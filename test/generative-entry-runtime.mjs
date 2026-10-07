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
  program: [{ id: "active-row", day: "Day 1", order: 1, name: "Barbell row", sets: 2, min: 6, max: 10, primary: "Mid/upper back", secondary: "Biceps", notes: "", alternates: [], libraryId: "rw_bb" }],
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

async function recommend(page, days) {
  await page.evaluate(() => window.startOnboarding("settings"));
  // The hub's goal tap answers Recommend's first question and opens the background step.
  await page.click('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]');
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
  await page.click("#onbNext");
  await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${days}"]`);
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]'); await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]'); await page.click("#onbNext"); await page.click("#onbNext");
  if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click();
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

async function importRoute(page, label) {
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.click("#entryOwnToggle"); await page.click('[data-entry-route="import"]');
  await page.setInputFiles("#importProgram", { name: "runtime.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ meta: { name: label }, exercises: [{ id: "r", day: "Day 1", name: "Barbell bench press", sets: 2, repLow: 6, repHigh: 10, muscles: ["Chest"] }] })) });
  await page.waitForSelector("#importReview.active", { timeout: 10000 }); await page.click("#importCommit");
  await page.waitForSelector("#entryActivate", { timeout: 10000 });
}

async function addEditorExercise(page, index) {
  const day = page.locator('#onbProgramEditor [data-role="day"]').nth(index);
  const body = day.locator('[data-role="day-body"]');
  if (!(await body.isVisible())) await day.locator('[data-role="toggle-day"]').click();
  await body.locator('[data-role="add-exercise"]').click(); await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.locator("#exPickList [data-pick]").first().click();
  await page.waitForSelector("#exPickSheet.is-open", { state: "hidden", timeout: 10000 });
}

async function buildRoute(page, days) {
  await page.evaluate(() => window.startOnboarding("settings"));
  await page.click("#entryOwnToggle"); await page.click('[data-entry-route="build"]');
  await page.fill("#entryProgramName", "Built runtime"); await page.click(`[data-entry-pick="daysPerWeek"][data-entry-val="${days}"]`); await page.click("#onbNext");
  await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 10000 });
  await addEditorExercise(page, 0);
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "{}").state?.result?.preview?.program || []).length === 1, { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" }); await waitForAppBoot(page, { base: BASE });
  if (await page.locator("#firstRunCreate").isVisible().catch(() => false)) await page.click("#firstRunCreate");
  if (!await page.locator("#entryResumeContinue").isVisible().catch(() => false)) await page.evaluate(() => window.startOnboarding("settings"));
  await page.waitForSelector("#entryResumeContinue", { timeout: 5000 }); await page.click("#entryResumeContinue");
  await page.waitForSelector('#onbProgramEditor [data-role="day"]', { timeout: 5000 });
  for (let index = 1; index < days; index++) await addEditorExercise(page, index);
  await page.waitForFunction(() => document.querySelector("#entryEditorActivate")?.disabled === false, { timeout: 10000 });
}

const browser = await launchChromium();
try {
  const routes = ["recommend", "import", "build"];
  for (const route of routes) await fc.assert(fc.asyncProperty(fc.record({
    days: fc.integer({ min: 2, max: 4 }),
    label: fc.constantFrom("Runtime block alpha", "Runtime block beta"),
  }), async ({ days, label }) => {
    const { context, page } = await open(browser);
    try {
      const before = await page.evaluate((key) => localStorage.getItem(key), KEY);
      if (route === "recommend") await recommend(page, days);
      else if (route === "import") await importRoute(page, label);
      else await buildRoute(page, days);
      const review = await page.evaluate((key) => localStorage.getItem(key), KEY);
      assert.equal(review, before, `${route}: review/edit changed active bytes before activation`);
      await page.click(route === "build" ? "#entryEditorActivate" : "#entryActivate");
      // Replacing the active program asks first; the dialog names what is archived.
      await page.click("#entryReplaceConfirm");
      await page.waitForTimeout(500);
      const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
      assert.notEqual(JSON.stringify(after), before, `${route}: explicit activation commits a durable replacement`);
      const old = JSON.parse(before);
      const archived = after.programHistory.filter((entry) => entry.id === old.programMeta.id);
      assert.equal(archived.length, 1, `${route}: activation archives the outgoing program exactly once`);
    } finally { await context.close(); }
  }), { numRuns: 2, seed: 201 + routes.indexOf(route) });
  // Editing an answer chip recompiles in place. Whatever the edit, no persisted
  // draft is ever a result-less result step or a result bound to other answers.
  const EDITS = [
    { chip: "days", key: "daysPerWeek", values: [2, 3, 4, 5] },
    { chip: "minutes", key: "sessionMinutes", values: [40, 60, 90] },
    { chip: "goal", key: "desiredResult", values: ["muscle_growth", "balanced", "strength"] },
  ];
  await fc.assert(fc.asyncProperty(fc.record({
    days: fc.integer({ min: 2, max: 4 }),
    edits: fc.array(fc.record({ which: fc.integer({ min: 0, max: EDITS.length - 1 }), pick: fc.integer({ min: 0, max: 3 }) }), { minLength: 1, maxLength: 2 }),
  }), async ({ days, edits }) => {
    const { context, page } = await open(browser);
    try {
      await recommend(page, days);
      await page.waitForFunction((key) => !!JSON.parse(localStorage.getItem(key) || "{}").state?.result, "repforge_program_setup_draft_v1", { timeout: 10000 });
      await page.evaluate(() => {
        window.__writes = [];
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (name, value) {
          if (name === "repforge_program_setup_draft_v1") {
            const state = JSON.parse(value).state || {};
            window.__writes.push({ step: state.step, hasResult: !!state.result });
          }
          return original.apply(this, arguments);
        };
      });
      for (const edit of edits) {
        const spec = EDITS[edit.which];
        const value = spec.values[edit.pick % spec.values.length];
        const writesBefore = await page.evaluate(() => window.__writes.length);
        await page.click(`[data-entry-chip="${spec.chip}"]`);
        await page.waitForSelector("#entryEditor");
        await page.click(`#entryEditor [data-entry-pick="${spec.key}"][data-entry-val="${value}"]`);
        const open = await page.evaluate(() => window.__repforgeEntryState());
        assert.ok(open.result && open.step === "result", "an open editor leaves the committed result in place");
        await page.click("#entryChipApply").catch(() => {});
        await page.waitForSelector("#entryEditor", { state: "detached" });
        await page.waitForTimeout(250);
        const settled = await page.evaluate(() => {
          const state = window.__repforgeEntryState();
          const stored = JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1") || "{}").state || {};
          const fingerprint = (candidate) => window.RepForgeProgramEntry.setResult({ ...candidate, result: null }, { fingerprint: "probe" }).result.answersFingerprint;
          return {
            step: state.step, hasResult: !!state.result, bound: !!state.result && state.result.answersFingerprint === fingerprint(state),
            storedBound: !!stored.result && stored.result.answersFingerprint === fingerprint(stored),
            storedAnswers: JSON.stringify(stored.answers) === JSON.stringify(state.answers),
            writes: window.__writes.slice(),
          };
        });
        assert.equal(settled.step, "result", `${spec.chip}: the edit stays on the result step`);
        assert.ok(settled.hasResult && settled.bound, `${spec.chip}: the live result is bound to the live answers`);
        assert.ok(settled.storedBound && settled.storedAnswers, `${spec.chip}: the stored draft is the live answers with the result built from them`);
        assert.ok(settled.writes.every((write) => write.step === "result" && write.hasResult), `${spec.chip}: no result-less draft was ever written`);
        assert.ok(settled.writes.length - writesBefore <= 1, `${spec.chip}: one persist per edit`);
      }
    } finally { await context.close(); }
  }), { numRuns: 3, seed: 311 });
  console.log("generative entry runtime: edit-in-place never leaves a stale persisted result");
  console.log("generative entry runtime: 6 production Build/Import/preview activation journeys pass");
} finally { await browser.close(); }
