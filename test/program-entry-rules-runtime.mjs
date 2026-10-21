#!/usr/bin/env node
/** Resume UI proof for compiler/rules drift. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_program_setup_draft_v1";
const state = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: seedProgramMeta({ id: "rules-active", name: "Current block", started: "2026-08-01" }),
  program: seedProgram(), log: [], programHistory: [], customExercises: [], _storageRevision: 2,
};
const browser = await launchChromium();
const context = await browser.newContext();
const page = await context.newPage();
try {
  await page.goto(BASE); await waitForAppBoot(page, { base: BASE });
  await page.evaluate(({ state, key }) => {
    localStorage.setItem(key, JSON.stringify(state));
  }, { state, key: KEY });
  await page.reload({ waitUntil: "domcontentloaded" }); await waitForAppBoot(page, { base: BASE });
  const envelope = await page.evaluate(({ key }) => {
    const Entry = window.RepForgeProgramEntry;
    const versions = window.RepForgeProgramEntryAdapter.currentVersions(window.RepForgeProgramCompiler);
    const activeRevision = JSON.parse(localStorage.getItem(key))._storageRevision;
    let draft = Entry.createState({ draftId: "rules-draft", activeProgramRevisionAtStart: activeRevision, now: new Date().toISOString(), versions: { ...versions, rules: "old-rules" } });
    draft = Entry.selectRoute(draft, "recommend");
    draft = Entry.setAnswers(draft, { desiredResult: "muscle_growth" });
    return JSON.stringify({ schemaVersion: 1, draftId: draft.draftId, revision: 1, ownerId: "rules-test", state: draft });
  }, { key: KEY });
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: DRAFT, value: envelope });
  await page.reload({ waitUntil: "domcontentloaded" }); await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.startOnboarding("settings"));
  assert.equal(await page.locator("#entryRebuildRules").count(), 1, `resume exposes a rebuild action when rules changed: ${await page.locator("#onbBody").innerText()}`);
  assert.match(await page.locator("#onbBody").innerText(), /changed|alterad|rebuild|rebuild/i, "resume explains the rules drift");
  await page.click("#entryRebuildRules");
  await page.waitForSelector("#entryRebuildRules", { state: "detached", timeout: 5000 });
  assert.equal(await page.locator("#entryRebuildRules").count(), 0, "rebuild clears the drift notice");
  console.log("program-entry rules drift: resume/rebuild UI proof passes");
} finally { await context.close(); await browser.close(); }
