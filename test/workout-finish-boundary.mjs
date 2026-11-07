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

async function failSaveBeforePersistence(page) {
  await page.evaluate(() => {
    window.__finishAttempts = [];
    let fail = true;
    window.__repforgeDraftBeforeSaveCommit = ({ operationId, session }) => {
      window.__finishAttempts.push({ operationId, session });
      if (fail) {
        fail = false;
        throw new Error("injected save operation failure before persistence");
      }
    };
  });
  await page.locator("#sessionSheetBtn").click();
  await page.locator("#sessionEarlyFinish").click();
  await page.locator("#sessionEarlyConfirm").click();
  await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null);
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
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    const before = await page.evaluate((key) => ({
      raw: localStorage.getItem("repforge_draft_v1"),
      rows: JSON.parse(localStorage.getItem(key) || "{}").log?.length || 0,
    }), stateKey);
    await page.evaluate(() => {
      const adapter = window.RepForgeDurableState?.storageIO;
      if (!adapter || typeof adapter.writeLocal !== "function" || typeof adapter.writeIdb !== "function") {
        throw new Error("durable storage adapter unavailable");
      }
      const writeLocal = adapter.writeLocal.bind(adapter);
      const writeIdb = adapter.writeIdb.bind(adapter);
      adapter.writeLocal = async () => false;
      adapter.writeIdb = async () => false;
      window.__restoreFinishAdapter = () => {
        adapter.writeLocal = writeLocal;
        adapter.writeIdb = writeIdb;
        delete window.__restoreFinishAdapter;
      };
    });
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null);
    const failed = await page.evaluate(async () => {
      try { return await window.__repforgeLastWorkoutFinish; }
      finally { window.__restoreFinishAdapter?.(); }
    });
    assert.equal(failed?.committed, false,
      "the first total save failure is not treated as committed: " + JSON.stringify(failed));
    assert.deepEqual(await page.evaluate((key) => ({
      raw: localStorage.getItem("repforge_draft_v1"),
      rows: JSON.parse(localStorage.getItem(key) || "{}").log?.length || 0,
    }), stateKey), before, "a total save failure retains the exact draft and adds no history");

    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 3000 });
    assert.equal(await page.locator("#sessionEarlyConfirm").isVisible(), true,
      "after total failure, early finish can be offered again for the unchanged draft");
    assert.equal(await page.locator("#draftRecovery").isHidden(), true,
      "starting a fresh finish removes the previous operation's Retry action");
    await page.locator("#sessionEarlyCancel").click();
    assert.equal(await page.locator("#draftRecovery").isHidden(), true,
      "canceling the fresh early-finish prompt leaves no stale Retry action");
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 10000 });
    const retried = await page.evaluate((key) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      return { rows: saved.log?.length || 0, draft: localStorage.getItem("repforge_draft_v1") };
    }, stateKey);
    assert.deepEqual(retried, { rows: before.rows + 1, draft: null },
      "the newly confirmed finish saves the retained draft once");
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

  {
    const { context, page } = await freshWorkout(browser);
    const targets = await draftTargets(page);
    const [first] = targets;
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await failSaveBeforePersistence(page);
    const firstState = await page.evaluate(async () => {
      const result = await window.__repforgeLastWorkoutFinish;
      const draft = window.__repforgeWorkoutDraft.current();
      return {
        result: { committed: result?.committed, reason: result?.reason },
        recoveryStatus: window.__repforgeWorkoutDraft.recovery()?.status,
        draftId: draft?.draftId,
        revision: draft?.revision,
        rawMatchesStorage: window.__repforgeWorkoutDraft.raw() === localStorage.getItem("repforge_draft_v1"),
      };
    });
    assert.notEqual(firstState.result?.committed, true,
      "the injected unsettled save enters Recovery: " + JSON.stringify(firstState));
    assert.equal(firstState.result?.reason, "save-operation-failed",
      "the injected pre-persistence failure is not a completed save: " + JSON.stringify(firstState));
    assert.equal(firstState.recoveryStatus, "save-failed",
      "the recoverable save failure is exposed as save-failed: " + JSON.stringify(firstState));
    assert.equal(firstState.rawMatchesStorage, true,
      "this failure leaves the acknowledged draft available for edits: " + JSON.stringify(firstState));

    const edit = await page.evaluate(async () => {
      const result = await window.__repforgeWorkoutDraft.dispatch("setSessionNotes", { value: "updated after recovery" });
      await window.__repforgeWorkoutDraft.flush();
      const draft = window.__repforgeWorkoutDraft.current();
      return {
        status: result.status,
        recoveryStatus: window.__repforgeWorkoutDraft.recovery()?.status,
        draftId: draft?.draftId,
        revision: draft?.revision,
        rawMatchesStorage: window.__repforgeWorkoutDraft.raw() === localStorage.getItem("repforge_draft_v1"),
        recoveryVisible: !document.querySelector("#draftRecovery")?.classList.contains("hidden"),
      };
    });
    assert.equal(edit.status, "applied", "the recovery edit is acknowledged: " + JSON.stringify({ firstState, edit }));
    assert.equal(edit.recoveryVisible, false, "an acknowledged field edit clears the recovery panel: " + JSON.stringify({ firstState, edit }));

    const remaining = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      return draft.exerciseOrder.flatMap((exerciseInstanceId) => {
        const exercise = draft.exercises[exerciseInstanceId];
        return exercise.setOrder.filter((setId) => exercise.sets[setId].completion === "pending")
          .map((setId) => ({ exerciseInstanceId, setId }));
      });
    });
    for (const target of remaining) await completeSet(page, target.exerciseInstanceId, target.setId);

    const saved = await page.evaluate(async () => await window.__repforgeSaveWorkout());
    assert.notEqual(saved?.ignored, true,
      "a fresh Save after Recovery is cleared is accepted, not ignored: " + JSON.stringify(saved));
    assert.equal(saved?.committed, true,
      "the fresh Save commits after Recovery is cleared: " + JSON.stringify(saved));
    const persisted = await page.evaluate((expectedRows) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const session = window.__finishAttempts[0]?.session;
      const rows = (state.log || []).filter((row) => row.session === session);
      return {
        attempts: window.__finishAttempts,
        rows: rows.length,
        expectedRows,
        uniqueSets: new Set(rows.map((row) => `${row.exerciseId}:${row.set}`)).size,
        summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      };
    }, targets.length);
    assert.equal(persisted.attempts.length, 2, "the failed finish and the later Save each start one operation");
    assert.equal(persisted.rows, persisted.expectedRows, "the session has exactly its intended rows");
    assert.equal(persisted.uniqueSets, persisted.rows, "the session has no duplicate set rows");
    assert.equal(persisted.summaryVisible, true, "the successful Save opens its summary");
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await failSaveBeforePersistence(page);
    const failed = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    assert.notEqual(failed?.committed, true, "the injected failure reaches Recovery");

    const concurrent = await page.evaluate(async () => {
      const proposal = window.__repforgeWorkoutDraft.state();
      const exercise = proposal.program[0];
      const date = new Date().toISOString().slice(0, 10);
      const row = {
        session: "other-session-during-save-recovery",
        date,
        day: exercise.day,
        name: exercise.name,
        exerciseId: exercise.id,
        set: 1,
        load: 50,
        reps: 8,
        rir: 2,
        notes: "",
        created: `${date}T09:00:00.000Z`,
        primary: exercise.primary,
        secondary: exercise.secondary,
        work: true,
      };
      proposal.log = [...(proposal.log || []), row];
      const result = await window.__repforgeCommitProposedState(proposal);
      await window.__repforgeStorage.flush();
      return {
        committed: result.committed,
        settled: result.settled,
        rowVisible: window.__repforgeWorkoutDraft.state().log.some((saved) => saved.session === row.session),
      };
    });
    assert.deepEqual(concurrent, { committed: true, settled: true, rowVisible: true },
      "a separate session is committed during save Recovery");

    await page.locator("#draftRecoveryRetry").click();
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 10000 });
    const retried = await page.evaluate(() => {
      const log = window.__repforgeWorkoutDraft.state().log;
      const operationSession = window.__finishAttempts[0].session;
      const otherRows = log.filter((row) => row.session === "other-session-during-save-recovery");
      return {
        otherSessionSurvives: otherRows.length === 1,
        operationRows: log.filter((row) => row.session === operationSession).length,
        savedSessions: new Set(log.map((row) => row.session)).size,
      };
    });
    assert.deepEqual(retried, { otherSessionSurvives: true, operationRows: 1, savedSessions: 2 },
      "Retry retains a different session committed after this operation was prepared: " + JSON.stringify(retried));
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await failSaveBeforePersistence(page);
    const failed = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    assert.notEqual(failed?.committed, true, "the injected failure reaches Recovery");

    const changed = await page.evaluate(async () => {
      document.querySelector("#openSettings").click();
      const input = document.querySelector("#restSec");
      const expected = Number(JSON.parse(localStorage.getItem("repforge_v1") || "{}").settings.restSec) + 15;
      document.querySelector("#restSecRow").click();
      input.value = String(expected);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const result = await document.querySelector("#saveSettings").onclick();
      await window.__repforgeStorage.flush();
      return {
        value: window.__repforgeWorkoutDraft.state().settings.restSec,
        expected,
        committed: result.committed,
        settled: result.settled,
      };
    });
    assert.equal(changed.value, changed.expected, "Settings commits a new rest default during Recovery");
    assert.equal(changed.committed, true, "the Settings commit is durably committed");
    assert.equal(changed.settled, true, "the Settings commit is settled");
    await page.locator("#settingsBack").click();
    await page.locator("#draftRecoveryRetry").click();
    await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 10000 });
    const retried = await page.evaluate(() => ({
      restSec: window.__repforgeWorkoutDraft.state().settings.restSec,
      savedSessions: new Set(window.__repforgeWorkoutDraft.state().log.map((row) => row.session)).size,
      rows: window.__repforgeWorkoutDraft.state().log.length,
    }));
    assert.equal(retried.restSec, changed.expected,
      "Retry keeps the setting committed during Recovery: " + JSON.stringify(retried));
    assert.equal(retried.rows, 1, "Retry commits only the operation's session row");
    assert.equal(retried.savedSessions, 1, "Retry does not duplicate the operation session");
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await failSaveBeforePersistence(page);
    const failed = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    assert.notEqual(failed?.committed, true, "the injected failure reaches Recovery");

    await page.locator("#sessionSheetBtn").click();
    await page.evaluate(async () => {
      const earlyFinish = document.querySelector("#sessionEarlyFinish");
      await earlyFinish.onclick();
    });
    const earlyFinishUi = await page.evaluate(() => ({
      sheetOpen: !document.querySelector("#sessionSheet").hidden,
      recoveryVisible: !document.querySelector("#draftRecovery").classList.contains("hidden"),
      recoveryFocused: document.activeElement === document.querySelector("#draftRecovery"),
    }));
    const refusedSave = await page.evaluate(async () => await window.__repforgeSaveWorkout());
    const saveUi = await page.evaluate(() => ({
      sheetOpen: !document.querySelector("#sessionSheet").hidden,
      recoveryVisible: !document.querySelector("#draftRecovery").classList.contains("hidden"),
      recoveryFocused: document.activeElement === document.querySelector("#draftRecovery"),
    }));
    assert.deepEqual(earlyFinishUi, { sheetOpen: false, recoveryVisible: true, recoveryFocused: true },
      "a refused Early finish closes the sheet and focuses the existing recovery explanation: " + JSON.stringify(earlyFinishUi));
    assert.equal(refusedSave?.ignored, true, "Save remains refused while Recovery owns the operation");
    assert.deepEqual(saveUi, { sheetOpen: false, recoveryVisible: true, recoveryFocused: true },
      "a refused Save focuses the existing recovery explanation: " + JSON.stringify(saveUi));
    await context.close();
  }
} finally {
  await browser.close();
}

console.log("PASS: workout finish boundary");
