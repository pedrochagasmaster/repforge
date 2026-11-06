#!/usr/bin/env node
import assert from "node:assert/strict";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
const stateKey = "repforge_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

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
  await page.evaluate(async ({ exerciseInstanceId, setId, weight, reps }) => {
    for (const [metricId, value] of [[weight, "62.5"], [reps, "8"]]) {
      await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { exerciseInstanceId, setId, metricId, value });
    }
    await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId, setId, field: "rir", value: "2" });
    await window.__repforgeWorkoutDraft.dispatch("completeSet", {
      exerciseInstanceId,
      setId,
      completedAt: new Date().toISOString(),
    });
    await window.__repforgeWorkoutDraft.flush();
  }, { exerciseInstanceId, setId, weight: WEIGHT, reps: REPS });
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
    const reps = page.locator(`#workout .exercise.is-current:not(.is-peek) [data-metric-id="${REPS}"]`).first();
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

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.evaluate((draftKey) => {
      window.__finishOperationIds = [];
      window.__repforgeDraftBeforeSaveCommit = ({ operationId }) => {
        window.__finishOperationIds.push(operationId);
      };
      const originalRemoveItem = Storage.prototype.removeItem;
      let fail = true;
      Storage.prototype.removeItem = function (key) {
        if (fail && String(key).startsWith(`${draftKey}:closing:`)) {
          fail = false;
          throw new Error("injected closing-marker finalization failure");
        }
        return originalRemoveItem.apply(this, arguments);
      };
      window.__restoreFinishFault = () => { Storage.prototype.removeItem = originalRemoveItem; };
    }, "repforge_draft_v1");
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null);
    const deferred = await page.evaluate(async () => {
      const result = await window.__repforgeLastWorkoutFinish;
      window.__restoreFinishFault?.();
      return {
        result,
        recoveryVisible: !document.querySelector("#draftRecovery")?.classList.contains("hidden"),
        summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      };
    });
    assert.equal(deferred.result?.committed, false,
      "an unsettled save stays out of Saved: " + JSON.stringify(deferred.result));
    assert.equal(deferred.recoveryVisible, true,
      "an unsettled save enters recovery instead of opening the summary");
    assert.equal(deferred.summaryVisible, false,
      "an unsettled save has no post-save presentation");
    const originalOperationId = await page.evaluate(() => window.__finishOperationIds[0]);

    await page.evaluate(() => {
      let release;
      const gate = new Promise((resolve) => { release = resolve; });
      window.__retryFinishGate = { calls: [], release };
      window.__repforgeDraftBeforeSaveCommit = ({ operationId }) => {
        const gateState = window.__retryFinishGate;
        gateState.calls.push(operationId);
        return gateState.calls.length === 1 ? gate : undefined;
      };
    });
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForFunction(() => window.__retryFinishGate?.calls.length === 1);
    await page.locator("#draftRecoveryRetry").click();
    const competingSave = await page.evaluate(async () => await window.__repforgeSaveWorkout());
    const duringRetry = await page.evaluate(() => ({
      retryCalls: window.__retryFinishGate.calls.slice(),
      summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
    }));
    assert.equal(competingSave?.ignored, true,
      "a second Save during a recovery retry is ignored by the active save operation");
    assert.deepEqual(duringRetry, { retryCalls: [originalOperationId], summaryVisible: false },
      "retry and Save taps do not start another finish while the original retry is committing");
    await page.evaluate(() => window.__retryFinishGate.release());
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 10000 });
    const retried = await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      return {
        recoveryVisible: !document.querySelector("#draftRecovery")?.classList.contains("hidden"),
        summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
        retryCalls: window.__retryFinishGate.calls,
        sessions: new Set((saved.log || []).map((row) => row.session)).size,
        rows: (saved.log || []).length,
      };
    }, stateKey);
    assert.deepEqual(retried, {
      recoveryVisible: false,
      summaryVisible: true,
      retryCalls: [originalOperationId],
      sessions: 1,
      rows: 1,
    },
      "retry settles the same finish operation once, then leaves recovery for its summary");
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("PASS: workout finish boundary");
