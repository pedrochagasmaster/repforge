#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
const stateKey = "repforge_v1";

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 15000 });
}

async function freshWorkout(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: stateKey, waitFor: waitForApp });
  await page.locator("#startWorkout").click();
  await page.waitForSelector("#workoutShell:not(.hidden)");
  return { context, page };
}

async function completeSet(page, exerciseInstanceId, setId) {
  await page.evaluate(async ({ exerciseInstanceId, setId }) => {
    for (const [field, value] of [["load", "62.5"], ["reps", "8"], ["rir", "2"]]) {
      await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId, setId, field, value });
    }
    await window.__repforgeWorkoutDraft.dispatch("completeSet", {
      exerciseInstanceId,
      setId,
      completedAt: new Date().toISOString(),
    });
    await window.__repforgeWorkoutDraft.flush();
  }, { exerciseInstanceId, setId });
}

async function draftTargets(page) {
  return page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return draft.exerciseOrder.flatMap((exerciseInstanceId) =>
      draft.exercises[exerciseInstanceId].setOrder.map((setId) => ({ exerciseInstanceId, setId })));
  });
}

const browser = await launchChromium();
try {
  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await page.evaluate(() => window.__repforgeFocus.to(0));
    const reps = page.locator("#workout .exercise.is-current:not(.is-peek) [data-k$='_reps']").first();
    await reps.focus();
    await reps.press("Enter");
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden") && /incomplete|early/i.test(toast.textContent || "");
    });
    const result = await page.evaluate((key) => ({
      draftActive: Boolean(window.__repforgeWorkoutDraft.current()),
      summaryOpen: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      savedRows: JSON.parse(localStorage.getItem(key) || "{}").log?.length || 0,
    }), stateKey);
    assert.deepEqual(result, { draftActive: true, summaryOpen: false, savedRows: 0 },
      "Enter/form submit cannot normally finish an incomplete workout");
    const programmatic = await page.evaluate(() => window.__repforgeSaveWorkout());
    assert.equal(programmatic.validation, true,
      "the programmatic normal-finish seam rejects the same incomplete workout");
    assert.equal(await page.evaluate(() => typeof window.__repforgeEarlyFinishConfirmation), "undefined",
      "the early-finish capability is not exposed on the public window surface");
    const attemptedBypass = await page.evaluate(() => window.__repforgeSaveWorkout(null, {
      completion: "confirmed early finish",
    }));
    assert.equal(attemptedBypass.validation, true,
      "extra arguments cannot turn the public normal-finish seam into early completion");
    assert.ok(await page.evaluate(() => Boolean(window.__repforgeWorkoutDraft.current())),
      "programmatic normal finish cannot clear an incomplete draft");
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    for (const target of await draftTargets(page)) await completeSet(page, target.exerciseInstanceId, target.setId);
    await page.evaluate(() => document.querySelector("#logForm").requestSubmit());
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    const result = await page.evaluate((key) => ({
      draftActive: Boolean(window.__repforgeWorkoutDraft.current()),
      savedRows: JSON.parse(localStorage.getItem(key) || "{}").log?.length || 0,
    }), stateKey);
    assert.equal(result.draftActive, false, "a normally complete workout clears its draft");
    assert.ok(result.savedRows > 0, "a normally complete workout saves history");
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.evaluate(async () => {
      await window.__repforgeWorkoutDraft.dispatch("setSessionNotes", { value: "stale confirmation probe" });
      await window.__repforgeWorkoutDraft.flush();
    });
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => /updated|stale|changed|refresh/i.test(
      document.querySelector("#sessionEarlyMsg")?.textContent || ""));
    assert.ok(await page.evaluate(() => Boolean(window.__repforgeWorkoutDraft.current())),
      "a stale early-finish confirmation cannot clear the changed draft");
    assert.equal(await page.locator("#sessionSummary").isHidden(), true,
      "a stale early-finish confirmation cannot open the completed summary");
    await page.locator("#sessionEarlyCancel").click();
    assert.equal(await page.locator("#sessionEarlyPrompt").isHidden(), true,
      "canceling early finish returns to the unconfirmed session state");
    assert.ok(await page.evaluate(() => Boolean(window.__repforgeWorkoutDraft.current())),
      "canceling early finish preserves the draft");
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null);
    const finishResult = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    assert.equal(finishResult?.committed, true, "confirmed early finish commits: " + JSON.stringify(finishResult));
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    assert.equal(await page.evaluate(() => Boolean(window.__repforgeWorkoutDraft.current())), false,
      "explicit confirmed early finish saves and clears the draft");
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("PASS: workout finish boundary");
