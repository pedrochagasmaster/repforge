#!/usr/bin/env node
/** Real two-page active-program replacement conflict proof. */
import assert from "node:assert/strict";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_program_setup_draft_v1";
const state = {
  settings: { unit: "kg", lang: "en", jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120 },
  programMeta: { id: "conflict-active", name: "Current block", started: "2026-08-01", created: "2026-08-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z", onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, daysPerWeek: 1, goal: "hypertrophy", equipment: ["barbell"] },
  program: [{ id: "conflict-row", day: "Day 1", order: 1, name: "Barbell row", sets: 2, min: 6, max: 10, primary: "Back", secondary: "Biceps", notes: "", alternates: [], libraryId: "rw_bb" }],
  log: [], programHistory: [], customExercises: [], _storageRevision: 7,
};

const browser = await launchChromium();
const context = await browser.newContext();
const pageA = await context.newPage();
const pageB = await context.newPage();
pageA.on("dialog", (dialog) => dialog.accept().catch(() => {}));
pageB.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

try {
  await pageA.goto(BASE);
  await waitForAppBoot(pageA, { base: BASE });
  await pageA.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: KEY, value: state });
  await pageA.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(pageA, { base: BASE });
  await pageA.evaluate(() => window.startOnboarding("settings"));
  await pageA.click("#entryOwnToggle");
  await pageA.click('[data-entry-route="build"]');
  await pageA.fill("#entryProgramName", "Replacement draft");
  await pageA.click('[data-entry-pick="daysPerWeek"][data-entry-val="2"]');
  await pageA.click("#onbNext");
  await pageA.waitForSelector("#programEditor .pday", { timeout: 10000 });
  const addCount = await pageA.locator('#programEditor [data-act="addEx"]').count();
  for (let index = 0; index < addCount; index++) {
    await pageA.locator('#programEditor [data-act="addEx"]').nth(index).click();
    await pageA.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    await pageA.locator("#exPickList [data-pick]").first().click();
    await pageA.waitForSelector("#exPickSheet.is-open", { state: "hidden", timeout: 10000 });
  }
  await pageA.waitForFunction(() => document.querySelector("#entryEditorActivate")?.disabled === false, { timeout: 10000 }).catch(async (error) => {
    const debug = await pageA.evaluate(() => ({
      button: document.querySelector("#entryEditorActivate")?.outerHTML,
      status: document.querySelector("#entryEditorStatus")?.textContent,
      days: [...document.querySelectorAll("#programEditor .pday")].map((day) => day.textContent),
      draft: localStorage.getItem("repforge_program_setup_draft_v1"),
    }));
    console.error("editor activation remained disabled", JSON.stringify(debug));
    throw error;
  });
  const before = await pageA.evaluate((key) => localStorage.getItem(key), KEY);

  await pageB.goto(BASE);
  await waitForAppBoot(pageB, { base: BASE });
  const newer = await pageB.evaluate(async (key) => {
    const proposal = JSON.parse(localStorage.getItem(key));
    proposal.settings.restSec = 180;
    const result = await window.__repforgeCommitProposedState(proposal);
    if (!(result.localOk || result.idbOk)) throw new Error(`tab B product save failed: ${JSON.stringify(result)}`);
    await window.__repforgeStorage.flush();
    return localStorage.getItem(key);
  }, KEY);
  assert.notEqual(newer, before, "tab B creates a newer active-program revision");

  await pageA.click("#entryEditorActivate");
  await pageA.waitForFunction(() => /changed in another tab|alterado em outra aba/i.test(document.querySelector("#onbBody")?.textContent || ""), { timeout: 10000 }).catch(async (error) => {
    console.error("activation conflict UI missing", await pageA.evaluate(() => ({ body: document.querySelector("#onbBody")?.textContent, active: document.querySelector("#onboarding")?.outerHTML.slice(0, 800) })));
    throw error;
  });
  const result = await pageA.evaluate(({ key, draftKey }) => ({
    active: localStorage.getItem(key),
    draft: localStorage.getItem(draftKey),
    body: document.querySelector("#onbBody")?.textContent || "",
  }), { key: KEY, draftKey: DRAFT });
  assert.equal(result.active, newer, "stale activation preserves the newer active-program bytes");
  assert.match(result.body, /changed in another tab|alterado em outra aba/i, "UI explains the active-program conflict");
  assert.ok(result.draft, "the unactivated replacement remains resumable after the conflict");
  console.log("program-entry conflict: two-page active-program replacement UX proof passes");
} finally {
  await context.close();
  await browser.close();
}
