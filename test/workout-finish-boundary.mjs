#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
const stateKey = "repforge_v1";
const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, null, { timeout: 15000 });
}

async function freshWorkout(browser, settings) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: stateKey, waitFor: waitForApp, settings });
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

async function beginEarlyFinishPrompt(page) {
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet.is-open");
  await page.locator("#sessionEarlyFinish").click();
  await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
}

async function dismissSessionSheet(page, route) {
  if (route === "close button") {
    await page.locator("#sessionSheetClose").click();
  } else if (route === "scrim") {
    const point = await page.evaluate(() => {
      const scrim = document.querySelector("#sessionSheetScrim").getBoundingClientRect();
      const sheet = document.querySelector("#sessionSheet").getBoundingClientRect();
      return { x: 12, y: Math.max(1, Math.floor(Math.min(sheet.top - 1, scrim.height - 1) / 2)) };
    });
    await page.locator("#sessionSheetScrim").click({ position: point });
  } else if (route === "Escape") {
    await page.keyboard.press("Escape");
  } else if (route === "swipe") {
    const start = await page.locator("#sessionSheet .sheetband__handle").boundingBox();
    assert.ok(start, "the session sheet grab handle is visible for swipe dismissal");
    const x = start.x + start.width / 2;
    const y = start.y + start.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 240, { steps: 5 });
    await page.mouse.up();
  } else {
    throw new Error(`unknown session sheet dismissal route: ${route}`);
  }
  await page.waitForSelector("#sessionSheet", { state: "hidden", timeout: 5000 });
}

async function finishThroughButton(page) {
  await page.evaluate(() => {
    window.__finishOperationIds = [];
    window.__repforgeDraftBeforeSaveCommit = ({ operationId }) => window.__finishOperationIds.push(operationId);
  });
  const lastExercise = await page.evaluate(() => window.__repforgeFocus.list().at(-1)?.id || null);
  assert.ok(lastExercise, "the workout has a final exercise to finish from");
  const currentExercise = await page.locator("#workout .exercise.is-current:not(.is-peek)").getAttribute("data-ex");
  if (currentExercise !== lastExercise) {
    const lastProgressIndex = await page.evaluate((id) => window.__repforgeFocus.list().findIndex((item) => item.id === id), lastExercise);
    await page.locator(`#woProgress button[data-focusgo="${lastProgressIndex}"]`).click();
    await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current:not(.is-peek)")?.dataset.ex === id,
      lastExercise, { timeout: 5000 });
  }
  await page.locator("#workout .exercise.is-current:not(.is-peek) [data-ffinish]").click();
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 5000 });
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

/* Voice input. A recognizer is retained with the draft it was started for. The
   fake keeps every instance so a test can end, deliver or leave one at will. */
const VOICE_FAKE = () => {
  window.__recognizers = [];
  window.SpeechRecognition = class {
    constructor() { this.lang = ""; this.onresult = null; this.onerror = null; this.onend = null; window.__recognizers.push(this); }
    start() { this.started = true; }
    abort() { this.aborted = true; }
  };
};

/* A rest that runs past the one-hour cap ends, and the Early finish question may open with a reason line. Each guard below
   drives the real controls. The clock is brought to one second short of the cap and the live tick carries it over. */
const REST_REASON = "Your rest ran past an hour. Finished for today?";

async function logOneSet(page) {
  const [target] = await draftTargets(page);
  await completeSet(page, target.exerciseInstanceId, target.setId);
  await page.evaluate(() => window.renderWorkout?.());
}

async function endedAtCap(page) {
  return page.waitForFunction(() => !window.__repforgeRest.state().active, null, { timeout: 8000 }).then(() => true, () => false);
}

async function runRestToCap(page) {
  await page.evaluate(() => { startRest(120); window.__repforgeRest.setLeft(-3599 * 1000); });
  return endedAtCap(page);
}

async function reasonState(page) {
  return page.evaluate(() => {
    const reason = document.querySelector("#sessionEarlyReason");
    const msg = document.querySelector("#sessionEarlyMsg");
    return {
      reasonShown: !!reason && !reason.classList.contains("hidden"),
      reasonText: reason?.textContent.trim() ?? null,
      omissionShown: !!msg && !msg.classList.contains("hidden"),
      reasonBeforeOmission: !!reason && !!msg && !!(reason.compareDocumentPosition(msg) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
}

async function promptOpen(page) {
  return page.evaluate(() => !document.querySelector("#sessionEarlyPrompt").classList.contains("hidden"));
}


/* Writes a record for the draft the lifter is in, as the app itself would have left it. */
async function plantRest(page, rest) {
  await page.evaluate(({ rest }) => {
    const draft = JSON.parse(localStorage.getItem("repforge_draft_v1"));
    localStorage.setItem("repforge_rest_v1", JSON.stringify({ draftId: draft.draftId, rest }));
  }, { rest });
}

/* A guard reports its own failure and lets the rest run, so one run shows every guard that fails. */
const guardFailures = [];
async function softly(name, guard) {
  try {
    await guard();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    guardFailures.push(name);
    console.log(`  ✗ ${name}\n    ${String(error.message).split("\n")[0]}`);
  }
}

async function restOverrunOffer(browser) {
  // Offered at the live cap: the question opens with its reason line, the rest is ended, nothing saved.
  await softly("Offered at the live cap: the question opens with its reason line, the rest is ended, nothing saved", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    assert.equal(await runRestToCap(page), true, "a rest reaching the one-hour cap ends");
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 3000 }).catch(() => {});
    const reason = await reasonState(page);
    assert.equal(reason.reasonShown && reason.reasonText === REST_REASON && reason.reasonBeforeOmission && reason.omissionShown, true,
      "a rest that passes the cap opens Early finish with the reason line above the omission sentence: " + JSON.stringify(reason));
    assert.equal(await promptOpen(page), true, "the rest that passed the cap offers the finish question");
    assert.equal(await page.evaluate(() => window.__repforgeLastWorkoutFinish == null && !!window.__repforgeWorkoutDraft.current()), true,
      "offering the question saves nothing: the draft is still open and no finish has run");
    await page.waitForTimeout(1500);
    assert.equal(await promptOpen(page) && await page.evaluate(() => window.__repforgeLastWorkoutFinish == null), true,
      "nothing saves without the confirm tap, however long the question stays open");
    await context.close();
  });

  // Dismissal leaves the workout open, and the same rest offers nothing again.
  await softly("Dismissal leaves the workout open, and the same rest offers nothing again", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    assert.equal(await runRestToCap(page), true, "a rest reaching the one-hour cap ends");
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 3000 });
    await page.locator("#sessionEarlyCancel").click();
    await page.waitForSelector("#sessionEarlyPrompt.hidden", { state: "attached", timeout: 3000 });
    await page.waitForTimeout(2500);
    assert.equal(await promptOpen(page), false, "dismissing the question does not offer it again");
    assert.equal(await page.locator("#sessionEarlyFinish").isVisible(), true,
      "dismissing the question returns the sheet to its own Early finish control");
    assert.equal(await page.evaluate(() => document.querySelector("#sessionEarlyReason").classList.contains("hidden")), true,
      "dismissing the question hides the reason line with it");
    assert.equal(await page.locator("#workoutShell").isVisible(), true, "the workout stays open after dismissal");
    assert.equal(await page.evaluate(() => !!window.__repforgeWorkoutDraft.current() && window.__repforgeLastWorkoutFinish == null), true,
      "dismissal saves nothing");
    await context.close();
  });

  // The lifter's own Early finish never shows the reason line.
  await softly("The lifter's own Early finish never shows the reason line", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await page.evaluate(() => startRest(120));
    await beginEarlyFinishPrompt(page);
    const reason = await reasonState(page);
    assert.equal(reason.reasonShown, false, "a lifter who opens Early finish sees no rest reason line: " + JSON.stringify(reason));
    assert.equal(reason.omissionShown, true, "the omission sentence is unchanged for the lifter's own Early finish");
    await page.locator("#sessionEarlyCancel").click();
    await context.close();
  });

  // Nothing logged: the rest just ends, no question.
  await softly("Nothing logged: the rest just ends, no question", async () => {
    const { context, page } = await freshWorkout(browser);
    assert.equal(await runRestToCap(page), true, "with nothing logged, a rest reaching the cap still ends");
    await page.waitForTimeout(1500);
    assert.equal(await promptOpen(page), false, "with nothing logged, a rest past the cap offers no finish question");
    assert.equal(await page.evaluate(() => !!window.__repforgeWorkoutDraft.current()), true, "with nothing logged the workout stays open");
    await context.close();
  });

  // Another modal open: the rest ends, the question does not open over it.
  await softly("Another modal open: the rest ends, the question does not open over it", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await page.locator("#woOverflowBtn").click();
    await page.waitForFunction(() => !!activeModal, null, { timeout: 3000 });
    await page.evaluate(() => startRest(120));
    await page.evaluate(() => window.__repforgeRest.setLeft(-3599 * 1000));
    assert.equal(await endedAtCap(page), true, "a rest reaching the cap ends under another modal");
    await page.waitForTimeout(1200);
    assert.equal(await promptOpen(page), false, "a rest past the cap does not open the question over another modal");
    assert.equal(await page.evaluate(() => !!activeModal), true, "the modal the lifter had open stays open");
    await context.close();
  });

  // A recovery panel showing: the rest ends, the question does not stack on the panel.
  await softly("A recovery panel showing: the rest ends, the question does not stack on the panel", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await page.evaluate(() => startRest(120));
    await failSaveBeforePersistence(page);
    await page.waitForSelector("#draftRecovery:not(.hidden)", { timeout: 5000 });
    // The failed save leaves its own Early finish question open: close that first, so the check below sees only the cap.
    await page.evaluate(() => { if (!document.querySelector("#sessionEarlyPrompt").classList.contains("hidden")) document.querySelector("#sessionEarlyCancel").click(); });
    await page.waitForSelector("#sessionEarlyPrompt.hidden", { state: "attached", timeout: 3000 });
    await page.evaluate(() => { window.__repforgeRest.setLeft(-3599 * 1000); });
    assert.equal(await endedAtCap(page), true, "a rest reaching the cap ends with a recovery panel showing");
    await page.waitForTimeout(1200);
    assert.equal(await promptOpen(page), false, "a recovery panel showing means the rest passing the cap offers no question");
    assert.equal(await page.locator("#draftRecovery").isVisible(), true, "the recovery panel stays as it was");
    await context.close();
  });

  // A record that is malformed, or whose deadline and expiry disagree, opens no question and is dropped without a word.
  await softly("A record that is malformed, or whose deadline and expiry disagree, opens no question and is dropped without a word", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await plantRest(page, { kind: "running", expiresAt: 1 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForTimeout(1500);
    assert.equal(await promptOpen(page), false, "a malformed record opens no finish question");
    assert.deepEqual(await page.evaluate(() => ({ active: window.__repforgeRest.state().active, record: localStorage.getItem("repforge_rest_v1") })),
      { active: false, record: null }, "a malformed record restores no rest and is dropped");
    await context.close();
  });
  await softly("A deadline still ahead with an expiry past opens no finish question", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    const now = await page.evaluate(() => Date.now());
    await plantRest(page, { kind: "running", deadlineMs: now + 120000, lengthSec: 120, exerciseId: null, rang: false, expiresAt: now - 1000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForTimeout(1500);
    assert.equal(await promptOpen(page), false, "a deadline still ahead with an expiry past opens no finish question");
    assert.equal(await page.evaluate(() => window.__repforgeRest.state().active), false, "and restores no rest");
    await context.close();
  });

  // The minus control that carries a rest past the cap ends it, with the sheet open (so no question opens over the sheet).
  await softly("The minus control that carries a rest past the cap ends it, with the sheet open (so no question opens over the sheet)", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await page.evaluate(() => { startRest(120); window.__repforgeRest.setLeft(-3590 * 1000); });
    await page.locator("#restTab").click();
    await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
    await page.locator("#restMinus").click();
    assert.equal(await endedAtCap(page), true, "minus 30 seconds from +59:50 ends the rest at the cap");
    assert.equal(await page.evaluate(() => localStorage.getItem("repforge_rest_v1")), null, "and its record goes");
    await context.close();
  });

  // Another route (the Program tab): the rest ends and the offer is dropped.
  await softly("Another route (the Program tab): the rest ends and the offer is dropped", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await page.evaluate(() => { startRest(120); navTo("program"); });
    await page.evaluate(() => window.__repforgeRest.setLeft(-3599 * 1000));
    assert.equal(await endedAtCap(page), true, "a rest reaching the cap ends on another route");
    await page.waitForTimeout(1200);
    assert.equal(await promptOpen(page), false, "on another route a rest past the cap offers no finish question");
    await context.close();
  });

  // Restore: a rest that passed the cap while the app was away opens the question after a reload, on the logging route. The
  // stored record is written as the app leaves it: a running rest whose deadline is an hour and ten minutes past, its expiry
  // one hour after that deadline.
  await softly("Restore: a stored, consistent rest past the cap opens the question after a reload, once", async () => {
    const { context, page } = await freshWorkout(browser);
    await logOneSet(page);
    await plantRest(page, { kind: "running", deadlineMs: Date.now() - 4200000, lengthSec: 120, exerciseId: null, rang: false,
      expiresAt: Date.now() - 4200000 + 3600000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)", { timeout: 5000 }).catch(() => {});
    const reason = await reasonState(page);
    assert.equal(reason.reasonShown && reason.reasonText === REST_REASON, true,
      "a rest that passed the cap while the app was away opens the question after a reload: " + JSON.stringify(reason));
    assert.equal(await page.evaluate(() => !window.__repforgeRest.state().active), true, "the restored rest is ended");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.waitForTimeout(1200);
    assert.equal(await promptOpen(page), false, "a second reload offers nothing: the rest was offered once");
    await context.close();
  });
}

async function voiceWorkout(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await context.addInitScript(VOICE_FAKE);
  const page = await context.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate((k) => {
    const saved = JSON.parse(localStorage.getItem(k) || "{}");
    localStorage.setItem(k, JSON.stringify({ ...saved, settings: { ...(saved.settings || {}), voiceInputEnabled: true } }));
  }, stateKey);
  await installSeedProgram(page, { key: stateKey, waitFor: waitForApp });
  await page.locator("#startWorkout").click();
  await page.waitForSelector("#workoutShell:not(.hidden)");
  return { context, page };
}

async function tapVoice(page) {
  await page.locator("#woOverflowBtn").click();
  await page.locator('#workoutActionSheet [data-workout-action="voice"]').click();
  await page.waitForSelector("#workoutActionSheet", { state: "hidden" });
}

const recognizerCount = (page) => page.evaluate(() => window.__recognizers.length);
const recognizerAborted = (page, index) => page.evaluate((i) => window.__recognizers[i]?.aborted === true, index);
const draftRevision = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.current()?.revision ?? null);

/** Delivers a transcript the way the browser does, then drains the draft queue so
 *  any edit it dispatched has been acknowledged before the revision is read. */
async function deliverTranscript(page, index, transcript) {
  await page.evaluate(({ index, transcript }) => window.__recognizers[index].onresult({ results: [[{ transcript }]] }),
    { index, transcript });
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function voiceProof(browser) {
  const failures = [];
  const expect = (condition, message, detail) => {
    if (condition) return console.log(`  ✓ ${message}`);
    failures.push(message);
    console.error(`  ✗ ${message}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
  };

  // A tap while listening stops that recognizer and starts nothing, so the next tap starts cleanly.
  {
    const { context, page } = await voiceWorkout(browser);
    await tapVoice(page);
    expect(await recognizerCount(page) === 1, "a tap starts one recognizer");
    await tapVoice(page);
    expect(await recognizerCount(page) === 1 && await recognizerAborted(page, 0),
      "a second tap aborts the first recognizer and starts no second one", await recognizerCount(page));
    await tapVoice(page);
    expect(await recognizerCount(page) === 2, "a third tap starts a new recognizer after the abort", await recognizerCount(page));
    const before = await draftRevision(page);
    await deliverTranscript(page, 1, "62.5 x 8 @2");
    expect(await draftRevision(page) > before, "a transcript from the live recognizer applies to the workout it was started in");
    await page.evaluate(() => window.__recognizers[1].onend?.());
    await tapVoice(page);
    expect(await recognizerCount(page) === 3, "after the recognizer ends, the next tap starts a new one");
    // Leaving the workout aborts the listening recognizer, so no microphone stays open for a transcript that would be dropped.
    const beforeLeave = await draftRevision(page);
    await page.locator("#leaveWorkout").click();
    await page.waitForSelector("#workoutShell", { state: "hidden" });
    expect(await recognizerAborted(page, 2), "leaving the workout aborts its recognizer");
    await deliverTranscript(page, 2, "70 x 5 @2");
    expect(await draftRevision(page) === beforeLeave, "a transcript that arrives after leaving the workout does not dispatch edits",
      { before: beforeLeave, after: await draftRevision(page) });
    await context.close();
  }

  // A transcript for a workout that has finished, or been replaced, never reaches the next one.
  {
    const { context, page } = await voiceWorkout(browser);
    await tapVoice(page);
    const firstIndex = (await recognizerCount(page)) - 1;
    for (const target of await draftTargets(page)) await completeSet(page, target.exerciseInstanceId, target.setId);
    await page.evaluate(() => document.querySelector("#logForm").requestSubmit());
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    await page.keyboard.press("Escape");
    await page.waitForSelector("#sessionSummary", { state: "hidden" });
    await page.locator("#logAnotherSession").click();
    await page.waitForSelector("#workoutShell:not(.hidden)");
    expect(await recognizerAborted(page, firstIndex), "finishing the workout aborts its recognizer");
    const replaced = await draftRevision(page);
    await deliverTranscript(page, firstIndex, "62.5 x 8 @2");
    expect(await draftRevision(page) === replaced, "a late transcript from a finished workout does not edit the next workout",
      { before: replaced, after: await draftRevision(page) });
    await tapVoice(page);
    expect(await recognizerCount(page) === firstIndex + 2, "a stale listening recognizer does not block the next workout's voice input");
    await context.close();
  }

  // Ending the workout without saving also drops the draft, and must abort the recognizer too.
  {
    const { context, page } = await voiceWorkout(browser);
    await tapVoice(page);
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionAbandon").click();
    await page.locator("#sessionAbandonConfirm").click();
    await page.waitForSelector("#workoutShell", { state: "hidden" });
    expect(await recognizerAborted(page, 0), "ending the workout without saving aborts its recognizer");
    await context.close();
  }

  // Opening an exercise page leaves the workout. The recognizer is aborted, a late transcript writes nothing, and
  // returning to the workout does not revive the old operation.
  {
    const { context, page } = await voiceWorkout(browser);
    await tapVoice(page);
    await page.locator("#woDayTitle [data-exopen]").click();
    await page.waitForSelector("#exercise.active");
    expect(await recognizerAborted(page, 0), "opening an exercise page aborts the listening recognizer");
    const onExercise = await draftRevision(page);
    await deliverTranscript(page, 0, "62.5 x 8 @2");
    expect(await draftRevision(page) === onExercise, "a transcript delivered on the exercise page writes nothing",
      { before: onExercise, after: await draftRevision(page) });
    await page.locator("#exBack").click();
    await page.waitForSelector("#exercise", { state: "hidden" });
    await deliverTranscript(page, 0, "62.5 x 8 @2");
    expect(await draftRevision(page) === onExercise, "returning to the workout does not revive the old transcript",
      { before: onExercise, after: await draftRevision(page) });
    await tapVoice(page);
    expect(await recognizerCount(page) === 2, "voice starts again after returning from the exercise page");
    await context.close();
  }

  // The dock leaves the workout too. Focus hides the dock, so the proof calls the dock button's own handler.
  {
    const { context, page } = await voiceWorkout(browser);
    await tapVoice(page);
    await page.evaluate(() => document.querySelector('nav button[data-view="history"]').click());
    expect(await recognizerAborted(page, 0), "navigating from the dock aborts the listening recognizer");
    const left = await draftRevision(page);
    await deliverTranscript(page, 0, "62.5 x 8 @2");
    expect(await draftRevision(page) === left, "a transcript after dock navigation writes nothing",
      { before: left, after: await draftRevision(page) });
    await context.close();
  }

  if (failures.length) throw new Error(`voice proofs failed: ${failures.join("; ")}`);
}

async function pastZero(browser) {
  const { context, page } = await freshWorkout(browser, { rirMode: "numeric", effortScale: "reps" });
  try {
    const shelf = page.locator("#workout .exercise.is-current:not(.is-peek) .focus-shelf");
    const setupBefore = await page.evaluate(() => buildSharedSetupPayload());
    const [target] = await draftTargets(page);
    await page.evaluate(async ({ target, weight, reps }) => {
      for (const [metricId, value] of [[weight, "105"], [reps, "6"]]) {
        await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { ...target, metricId, value });
      }
      renderWorkout();
      const draft = window.__repforgeWorkoutDraft.current();
      const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const completedAt = date + "T12:00:00.000Z";
      const command = (draft, type, fields) => {
        const operationId = "past-zero-fixture-" + type;
        return window.RepForgeWorkoutDraft.reduce(draft, {
          ...target, ...fields, type, operationId, expectedRevision: draft.revision, updatedAt: completedAt,
          writer: { ...draft.writer, operationId },
        });
      };
      const entered = command(draft, "editSetField", { field: "rir", value: "0" });
      const completed = command(entered, "completeSet", { completedAt });
      const rows = window.RepForgeWorkoutDraft.toHistoryRows(command(completed, "beginFinish", {}), completedAt);
      if (!Array.isArray(rows)) throw new Error(JSON.stringify({ rows, entered: entered.code, completed: completed.code }));
      const [previous] = rows;
      const proposal = window.__repforgeWorkoutDraft.state();
      proposal.log = [{ ...previous, session: "past-zero-previous", date, partialReps: 2 }];
      const result = await window.__repforgeCommitProposedState(proposal);
      if (!result.committed) throw new Error("Could not seed the previous comparable set");
    }, { target, weight: WEIGHT, reps: REPS });
    await shelf.locator('[data-shelf-field="rir"]').click();
    await shelf.getByRole("button", { name: "0", exact: true }).click();
    const chips = shelf.getByRole("group", { name: "Partial reps after 0 reps left" });
    await chips.waitFor();
    assert.equal(await chips.evaluate(el => getComputedStyle(el).animationDuration), "0.24s");
    assert.equal(await chips.locator("button:focus").getAttribute("aria-pressed"), "true");
    await chips.getByRole("button", { name: "3 partial reps" }).click({ timeout: 3000 });
    await shelf.locator('[data-shelf-field="rir"]').click();
    await shelf.getByRole("group", { name: "Reps left", exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await shelf.locator('[data-shelf-field="rir"]').click();
    assert.equal(await chips.evaluate(el => getComputedStyle(el).animationName), "none");
    assert.equal(await chips.getByRole("button", { name: "3 partial reps" }).getAttribute("aria-pressed"), "true");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await chips.getByRole("button", { name: "Zero partial reps, back to Reps left" }).click();
    const zero = shelf.getByRole("group", { name: "Reps left", exact: true }).getByRole("button", { name: "0", exact: true });
    assert.equal(await zero.getAttribute("aria-pressed"), "true");
    await zero.click();
    await chips.getByRole("button", { name: "3 partial reps" }).click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await shelf.locator('[data-shelf-field="rir"]').click();
    assert.equal(await chips.getByRole("button", { name: "3 partial reps" }).getAttribute("aria-pressed"), "true");
    const effortText = await shelf.locator('[data-shelf-field="rir"]').evaluate(el => el.textContent.replace(/\s+/g, " "));
    assert.match(effortText, /0\+3/, `the effort tile reads 0+3: ${effortText}`);
    assert.doesNotMatch(effortText, /full/, `the tile does not call reps left "full reps": ${effortText}`);
    const log = shelf.getByRole("button", { name: "Log set 1, 6 full reps and 3 partial reps" });
    assert.equal((await log.innerText()).replace(/\s+/g, " ").trim(), "Log set 1 · 6+3", "the visible CTA stays compact");
    await log.click();
    await page.getByText("+1 partial since last time. Tie broken.", { exact: true }).waitFor({ timeout: 5000 });
    const loggedRow = page.locator("#workout .exercise.is-current [data-editn='1']");
    await loggedRow.click();
    await page.locator("[data-fcancel]").waitFor();
    const effortTile = shelf.locator('[data-shelf-field="rir"]');
    if (await effortTile.getAttribute("aria-pressed") !== "true") await effortTile.click();
    await chips.getByRole("button", { name: "4 partial reps" }).click();
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator("[data-fcancel]").click();
    assert.match(await loggedRow.innerText(), /6\+3/, "cancelling after reload restores the acknowledged partials");
    await beginEarlyFinishPrompt(page);
    await page.locator("#sessionEarlyConfirm").click();
    await page.locator("#sessionSummary:not(.hidden)").waitFor();
    const saved = await page.evaluate(() => window.__repforgeWorkoutDraft.state().log.filter(row => row.session !== "past-zero-previous"));
    assert.deepEqual(saved.map(({ load, reps, rir, partialReps }) => ({ load, reps, rir, partialReps })),
      [{ load: 105, reps: 6, rir: 0, partialReps: 3 }]);
    assert.deepEqual(await page.evaluate(() => buildSharedSetupPayload()), setupBefore,
      "performed partials leave the canonical v4/v5 setup encoder input unchanged");
    const summary = await page.evaluate(() => window.__repforgeSessionSummary.current());
    assert.deepEqual({ reps: summary.reps, volume: summary.volume, records: summary.prs.length },
      { reps: 6, volume: 630, records: 0 });
    await page.evaluate(() => {
      window.__fills = [];
      const draw = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
        window.__fills.push({ text: String(text), font: this.font, fill: String(this.fillStyle) });
        return draw.call(this, text, ...rest);
      };
    });
    await page.locator("#sumShare").click();
    await page.waitForFunction(() => window.__repforgeShareSheet.state()?.file, undefined, { timeout: 15000 });
    const fills = await page.evaluate(() => window.__fills);
    const px = font => Number(/([\d.]+)px/.exec(font)?.[1]);
    const suffix = fills.find(draw => draw.text === "+3"), base = fills.find(draw => /(^|\s)6$/.test(draw.text));
    assert.ok(suffix && base, `a share card draws 6 and +3 as separate runs: ${JSON.stringify(fills.map(draw => draw.text).slice(0, 40))}`);
    assert.ok(px(suffix.font) < px(base.font), "the partial count is drawn smaller than the full reps");
    assert.notEqual(suffix.fill, base.fill, "the partial count is drawn in the accent colour");
    await page.keyboard.press("Escape");
    await page.locator("#sumSee").click();
    await page.locator(".session--read").getByText("6+3", { exact: true }).waitFor();
    await page.locator("[data-history-edit]").click();
    const partialsField = page.locator('[data-ek="partialReps|0"]');
    await partialsField.fill("6");
    await page.locator("[data-edsave]").click();
    await page.getByText("Enter a whole number of partial reps from 0 to 5.").waitFor({ timeout: 3000 });
    assert.ok((await partialsField.evaluate(el => el.getBoundingClientRect().width)) < 120, "the partials field keeps its narrow width");
    await partialsField.fill("4");
    await page.locator('[data-ek="rir|0"]').fill("1");
    assert.equal(await page.locator(".history-partials-edit").isHidden(), true, "partials are offered only while reps left is 0");
    await page.locator('[data-ek="rir|0"]').fill("0");
    assert.equal(await page.locator(".history-partials-edit").isVisible(), true, "entering 0 reps left shows the partials field live");
    await page.locator("[data-edsave]").click();
    await page.locator(".session--read").getByText("6+4", { exact: true }).waitFor();
    await page.evaluate(() => window.__repforgeShowSettings());
    await page.locator("#dataBackupRow").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#exportCsv").click()]);
    const csv = (await readFile(await download.path(), "utf8")).trim().split("\n");
    const columns = csv[0].split(",");
    const row = [...csv.at(-1).matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map(match => match[1]);
    assert.deepEqual([row[columns.indexOf("load")], row[columns.indexOf("reps")], row[columns.indexOf("partial_reps")]],
      ["105", "6", "4"], "CSV keeps the full reps and corrected count separate");
    const merged = await page.evaluate(async () => {
      const incoming = window.__repforgeWorkoutDraft.state();
      const row = incoming.log.find(candidate => candidate.session !== "past-zero-previous");
      incoming.log = [{ ...row, session: "zero-import", partialReps: 0 }];
      await mergeLog(incoming);
      return window.__repforgeWorkoutDraft.state().log.find(candidate => candidate.session === "zero-import");
    });
    assert.ok(merged && !Object.hasOwn(merged, "partialReps"), "a merged import canonicalises a printed zero to omission");
    const counted = await page.evaluate(async () => {
      const proposal = window.__repforgeWorkoutDraft.state();
      const base = proposal.log.find(row => row.session !== "past-zero-previous");
      const { partialReps, ...plain } = base;
      proposal.log.push({ ...plain, session: "warm-count", date: base.date, set: 1, warmup: true },
        { ...plain, session: "warm-count", date: base.date, set: 2 });
      await window.__repforgeCommitProposedState(proposal);
      return historyShareSummary("warm-count").sets;
    });
    assert.equal(counted, 1, "a shared History summary counts working sets, not warm-ups");
    // A zero that was not typed as a number: partials are an explicit statement on a prefilled row, never on Max alone.
    const seeded = await page.evaluate(async () => {
      const proposal = window.__repforgeWorkoutDraft.state();
      const base = proposal.log.find(row => row.session !== "past-zero-previous" && row.session !== "warm-count");
      const { partialReps, ...plain } = base;
      for (const [session, effortSource, rirMeasured] of [["edit-prefilled", "prefilled", false], ["edit-max", "effort", true]]) {
        proposal.log.push({ ...plain, session, date: base.date, set: 1, rir: 0, effortSource, rirMeasured });
      }
      await window.__repforgeCommitProposedState(proposal);
      return true;
    });
    assert.ok(seeded);
    const mixedTop = await page.evaluate(async () => {
      const proposal = window.__repforgeWorkoutDraft.state();
      const base = proposal.log.find(row => row.session !== "past-zero-previous" && row.session !== "warm-count");
      const { partialReps, ...plain } = base;
      proposal.log.push({ ...plain, session: "mixed-left", date: base.date, set: 1, rir: 1, effortSource: "rir", rirMeasured: true },
        { ...plain, session: "mixed-left", date: base.date, set: 2, rir: 0, effortSource: "rir", rirMeasured: true, partialReps: 2 });
      await window.__repforgeCommitProposedState(proposal);
      return summaries().find(entry => entry.session === "mixed-left");
    });
    const exported = await page.evaluate(() => prog.exercises.map(ex => JSON.stringify(window.__repforgeProgression.explainRecommendation(ex))).join("|"));
    assert.ok(!/[\uE0A0\uE0A1]/.test(exported), "the exported explanation carries no private rendering marks");
    assert.ok(mixedTop && mixedTop.partialReps === undefined, "the strength summary needs both sets at 0 reps left to apply a partial tie-break");
    const openEdit = async session => {
      await page.evaluate(() => {
        document.querySelector('nav button[data-view="history"]').click();
        document.querySelector("[data-history-back]")?.click();
      });
      await page.evaluate(id => document.querySelector(`#sessions [data-sess="${id}"] .session__open`).click(), session);
      await page.evaluate(() => document.querySelector("[data-history-edit]").click());
      await page.locator(".session--edit").waitFor({ timeout: 4000 });
    };
    const savedRow = session => page.evaluate(id => window.__repforgeWorkoutDraft.state().log.find(row => row.session === id), session);
    await openEdit("edit-prefilled");
    assert.equal(await page.locator(".history-partials-edit").isVisible(), true, "a prefilled zero offers partials");
    await page.locator('[data-ek="partialReps|0"]').fill("2");
    await page.locator("[data-edsave]").click();
    await page.getByText("Session updated.").waitFor({ timeout: 5000 });
    await page.locator(".session--edit").waitFor({ state: "detached", timeout: 5000 });
    const prefilled = await savedRow("edit-prefilled");
    assert.deepEqual([prefilled.partialReps, prefilled.effortSource, prefilled.rirMeasured], [2, "rir", true],
      "entering partials on a prefilled zero is an explicit numeric statement and is kept");
    await openEdit("edit-max");
    assert.equal(await page.locator(".history-partials-edit").isHidden(), true, "Max alone does not offer partials");
    await page.locator('[data-ek="rir|0"]').fill("1");
    await page.locator('[data-ek="rir|0"]').fill("0");
    assert.equal(await page.locator(".history-partials-edit").isVisible(), true, "choosing a numeric 0 reps left offers them");
    await page.locator('[data-ek="partialReps|0"]').fill("3");
    await page.locator("[data-edsave]").click();
    await page.getByText("Session updated.").waitFor({ timeout: 5000 });
    await page.locator(".session--edit").waitFor({ state: "detached", timeout: 5000 });
    const max = await savedRow("edit-max");
    assert.deepEqual([max.partialReps, max.effortSource], [3, "rir"], "a Max row keeps partials once reps left is typed as 0");
    // A hidden field's error goes with it.
    await openEdit("edit-prefilled");
    await page.locator('[data-ek="partialReps|0"]').fill("9");
    await page.locator("[data-edsave]").click();
    await page.getByText("Enter a whole number of partial reps from 0 to 5.").waitFor({ timeout: 3000 });
    await page.locator('[data-ek="rir|0"]').fill("1");
    assert.equal(await page.locator("[data-histedit-error]").count(), 0, "hiding the partials field clears its error");
    console.log("PASS: Past zero survives reload, correction, finish, History edit and CSV export");
  } finally {
    await context.close();
  }
}

/* Plan 085 slice 3: suggested warm-ups. The cue is the warm-up until the sequence is done; the warm-ups sit beside the sets, not
   in them, and they never count. Edit one, log it, reload, log the rest, work three sets and finish: one observation, work
   numbered 1 to 3, warm-up rows numbered by their own ordinal. */
async function prelude(browser) {
  const { context, page } = await freshWorkout(browser, { rirMode: "numeric", effortScale: "reps" });
  try {
    const card = page.locator("#workout .exercise.is-current:not(.is-peek)");
    const shelf = card.locator(".focus-shelf");
    const [target] = await draftTargets(page);
    await page.evaluate(async ({ target, weight, reps }) => {
      for (const [metricId, value] of [[weight, "105"], [reps, "6"]]) {
        await window.__repforgeWorkoutDraft.dispatch("editMetricValue", { ...target, metricId, value });
      }
      renderWorkout();
      const draft = window.__repforgeWorkoutDraft.current();
      const date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const completedAt = date + "T12:00:00.000Z";
      const command = (draft, type, fields) => {
        const operationId = "prelude-fixture-" + type;
        return window.RepForgeWorkoutDraft.reduce(draft, {
          ...target, ...fields, type, operationId, expectedRevision: draft.revision, updatedAt: completedAt,
          writer: { ...draft.writer, operationId },
        });
      };
      const entered = command(draft, "editSetField", { field: "rir", value: "0" });
      const completed = command(entered, "completeSet", { completedAt });
      const rows = window.RepForgeWorkoutDraft.toHistoryRows(command(completed, "beginFinish", {}), completedAt);
      if (!Array.isArray(rows)) throw new Error(JSON.stringify({ rows }));
      const proposal = window.__repforgeWorkoutDraft.state();
      proposal.log = [{ ...rows[0], session: "prelude-previous", date }];
      const result = await window.__repforgeCommitProposedState(proposal);
      if (!result.committed) throw new Error("Could not seed the previous comparable set");
    }, { target, weight: WEIGHT, reps: REPS });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);

    // The first warm-up is the cue: its load, its reps, the rail to the working load, and the way to skip.
    const cue = card.locator(".fx-cue--warm");
    await cue.waitFor({ timeout: 5000 });
    assert.match(await cue.locator(".fx-cue__l1").innerText(), /^Warm up \d/, "the hero says what to warm up with");
    const rail = cue.getByRole("list", { name: "Warm-up steps" });
    const stepsBefore = await rail.locator("li").count();
    assert.ok(stepsBefore >= 3, `the rail ends at the working load: ${stepsBefore} dots`);
    assert.equal(await rail.locator("li.fx-rail__step--work").count(), 1, "the rail ends in one work marker");
    assert.equal(await rail.locator('li[aria-current="step"]').count(), 1, "one step is current");
    assert.match(await cue.locator(".fx-cue__standing").innerText(), /^Warm-up 1 of \d+, then 105 kg$/);
    await cue.getByRole("button", { name: "Skip warm-ups" }).waitFor();
    assert.equal(await card.locator(".ledgerline--open").count(), 0, "the table's open ring waits for the work");
    assert.equal(await card.locator(".ledgerline--warmup").count(), 0, "no warm-up row before one is logged");
    assert.equal(await page.evaluate(() => Object.values(window.__repforgeWorkoutDraft.current().exercises)[0].warmupPrelude ?? null), null,
      "opening the cue writes nothing: browsing is not input");
    assert.equal(await shelf.getByRole("button", { name: /^Done · .* next$/ }).count(), 1, "the action names what follows");

    // Edit the first warm-up to 60 × 5 and log it.
    const first = await cue.locator(".fx-cue__load").innerText();
    await shelf.locator('[data-wu-field="load"]').click();
    await shelf.locator('[data-wu-field="load"]').click();
    await page.locator("#wheelDone").click();
    await shelf.locator('[data-wu-field="load"]').click();
    const loadInput = shelf.locator('input[data-wu-kind="load"]');
    await loadInput.evaluate((el) => { el.value = "60"; el.oninput(); });
    const repsInput = shelf.locator('input[data-wu-kind="reps"]');
    await repsInput.evaluate((el) => { el.value = "5"; el.oninput(); });
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    const edited = await page.evaluate(() => {
      const record = Object.values(window.__repforgeWorkoutDraft.current().exercises)[0].warmupPrelude;
      return record.steps.map((step) => [step.source, step.touched, step.completion]);
    });
    assert.deepEqual(edited[0], ["suggested", true, "pending"], "an edit stores the plan and marks the step touched");
    await shelf.getByRole("button", { name: /^Done · .* next$/ }).click();
    await page.locator(".resttab__label", { hasText: "Warm-up rest" }).waitFor({ timeout: 5000 });
    assert.match(await page.locator("#restTab").getAttribute("aria-label"), /^Warm-up rest, 0?[01]:\d\d$/, "the spoken label names the warm-up rest");
    assert.equal(await page.evaluate(() => RepForgeRestTimer.view(restClock, Date.now()).lengthSec), 60, "a warm-up rest runs a minute");
    const afterFirst = await page.evaluate(() => {
      const exercise = Object.values(window.__repforgeWorkoutDraft.current().exercises)[0];
      return { sets: exercise.setOrder.length, done: exercise.warmupPrelude.steps.filter((step) => step.completion !== "pending").length,
        ordinal: exercise.warmupPrelude.steps[0].completion.ordinal, values: Object.values(exercise.warmupPrelude.steps[0].values) };
    });
    assert.deepEqual({ sets: afterFirst.sets, done: afterFirst.done, ordinal: afterFirst.ordinal }, { sets: 3, done: 1, ordinal: 1 },
      "the warm-up is outside the sets and takes warm-up ordinal 1");
    assert.deepEqual(afterFirst.values.sort(), ["5", "60"], "what was logged is what was typed");

    // A reload shows the acknowledged plan, with the rest still running.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await cue.waitFor({ timeout: 5000 });
    assert.match(await cue.locator(".fx-cue__standing").innerText(), /^Warm-up 2 of \d+/, "after a reload the cue is the next step");
    assert.equal(await rail.locator("li.is-done").count(), 1, "the logged step stays done on the rail");
    assert.match(await rail.locator("li.is-done").first().innerText(), /60/, "a done step shows what was logged");
    await page.locator(".resttab__label", { hasText: "Warm-up rest" }).waitFor({ timeout: 5000 });

    // Log the rest. The last one hands over to set 1.
    for (let guard = 0; guard < 6 && await card.locator(".fx-cue--warm").count(); guard++) {
      await shelf.locator(".saveset").click();
      await page.waitForFunction(() => window.__repforgeWorkoutDraft.current() && true);
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    }
    await page.getByText("Warmed up. Set 1 is next.", { exact: true }).waitFor({ timeout: 5000 });
    const summary = card.locator(".ledgerline--warmup");
    await summary.waitFor();
    assert.match(await summary.innerText(), /^W\s+60 · \d+(\.\d+)? · \d+(\.\d+)? kg · not counted$/, "one quiet W row lists the logged loads in order");
    await shelf.getByRole("button", { name: "Log set 1" }).waitFor();

    // Work three sets as the program prescribes.
    for (const n of [1, 2, 3]) {
      await shelf.getByRole("button", { name: new RegExp(`^Log set ${n}`) }).click();
      await page.waitForFunction((count) => Object.values(window.__repforgeWorkoutDraft.current().exercises)[0].setOrder
        .filter((id) => Object.values(window.__repforgeWorkoutDraft.current().exercises)[0].sets[id].completion !== "pending").length >= count, n);
    }
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await beginEarlyFinishPrompt(page);
    await page.locator("#sessionEarlyConfirm").click();
    await page.locator("#sessionSummary:not(.hidden)").waitFor();
    const saved = await page.evaluate(() => {
      const state = window.__repforgeWorkoutDraft.state();
      return { rows: state.log.filter((row) => row.session !== "prelude-previous"), observations: state.warmupObservations ?? null };
    });
    const warmRows = saved.rows.filter((row) => row.warmup), workRows = saved.rows.filter((row) => !row.warmup);
    assert.deepEqual(workRows.map((row) => row.set), [1, 2, 3], "work is numbered 1, 2, 3");
    assert.ok(warmRows.length >= 2 && warmRows.every((row) => row.origin === "suggested-warmup" && row.set === 0 && row.rir === null),
      "the warm-ups are projected as warm-up rows");
    assert.deepEqual(warmRows.map((row) => row.warmupOrdinal), warmRows.map((_, index) => index + 1), "their ordinals are distinct and in order");
    assert.deepEqual([warmRows[0].load, warmRows[0].reps], [60, 5], "the edit is what was saved");
    const sessions = Object.keys(saved.observations || {});
    assert.equal(sessions.length, 1, "one session entry is written with the save");
    const [observation, ...more] = saved.observations[sessions[0]].observations;
    assert.equal(more.length, 0, "one observation per lift");
    assert.equal(observation.decision, "edited", "the edit is what the observation records");
    assert.deepEqual(observation.warmupOrdinals, warmRows.map((row) => row.warmupOrdinal), "it names the warm-up rows by ordinal");
    assert.equal(observation.workingOrdinal, 1, "and the first working set");
    const totals = await page.evaluate(() => window.__repforgeSessionSummary.current());
    assert.equal(totals.volume, workRows.reduce((sum, row) => sum + row.load * row.reps, 0), "volume counts work only");
    assert.equal(totals.reps, workRows.reduce((sum, row) => sum + row.reps, 0), "reps count work only");
    console.log("PASS: Prelude warm-ups survive reload, finish with work numbered 1 to 3, and teach once");
  } finally {
    await context.close();
  }
}

const browser = await launchChromium();
const pastZeroOnly = process.env.REPFORGE_PAST_ZERO_ONLY === "1";
const preludeOnly = process.env.REPFORGE_PRELUDE_ONLY === "1";
try {
  if (!preludeOnly) await pastZero(browser);
  await prelude(browser);
  if (!pastZeroOnly && !preludeOnly) await otherFinishContracts(browser);
} finally {
  await browser.close();
}

async function otherFinishContracts(browser) {
  for (const route of ["close button", "scrim", "Escape", "swipe"]) {
    const { context, page } = await freshWorkout(browser);
    const targets = await draftTargets(page);
    const sessionId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().draftId);
    await beginEarlyFinishPrompt(page);
    await dismissSessionSheet(page, route);
    for (const target of targets) await completeSet(page, target.exerciseInstanceId, target.setId);
    await finishThroughButton(page);
    const finished = await page.evaluate((id) => {
      const state = window.__repforgeWorkoutDraft.state();
      return {
        rows: state.log.filter((row) => row.session === id).length,
        operations: window.__finishOperationIds,
        draftActive: Boolean(window.__repforgeWorkoutDraft.current()),
      };
    }, sessionId);
    assert.ok(finished.rows > 0, `normal Finish saves the workout after ${route} dismissal: ${JSON.stringify(finished)}`);
    assert.equal(finished.operations.length, 1, `the ${route} path starts one save operation: ${JSON.stringify(finished)}`);
    assert.equal(finished.draftActive, false, `the ${route} path clears the finished draft`);
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    const sessionId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().draftId);
    await page.evaluate(() => {
      window.__finishOperationIds = [];
      window.__repforgeDraftBeforeSaveCommit = ({ operationId }) => window.__finishOperationIds.push(operationId);
    });
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.locator("#sessionEarlyConfirm").click();
    await page.waitForFunction(() => window.__repforgeModalState() === "closing", null,
      { polling: 10, timeout: 3000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__repforgeLastWorkoutFinish != null, null, { timeout: 5000 });
    const result = await page.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    assert.equal(result?.committed, true,
      "Escape during the confirmed sheet close does not cancel its save: " + JSON.stringify(result));
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    const saved = await page.evaluate((id) => {
      const state = window.__repforgeWorkoutDraft.state();
      return {
        rows: state.log.filter((row) => row.session === id).length,
        operations: window.__finishOperationIds,
        draftActive: Boolean(window.__repforgeWorkoutDraft.current()),
      };
    }, sessionId);
    assert.equal(saved.rows, 1, "the interrupted confirmation commits the completed set once: " + JSON.stringify(saved));
    assert.equal(saved.operations.length, 1, "the interrupted confirmation starts one save operation: " + JSON.stringify(saved));
    assert.equal(saved.draftActive, false, "the interrupted confirmation clears the completed draft");
    await context.close();
  }

  {
    const { context, page } = await freshWorkout(browser);
    const sessionId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().draftId);
    await beginEarlyFinishPrompt(page);
    await dismissSessionSheet(page, "Escape");
    const reps = page.locator(`#workout .exercise.is-current:not(.is-peek) [data-metric-id="${REPS}"]`).first();
    await reps.focus();
    await reps.press("Enter");
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      const summary = document.querySelector("#sessionSummary");
      return (!toast?.classList.contains("hidden") && toast.textContent.includes("Complete the planned sets")) ||
        !summary?.classList.contains("hidden");
    }, null, { timeout: 5000 });
    const incomplete = await page.evaluate((id) => ({
      toast: document.querySelector("#toast")?.textContent || "",
      summaryVisible: !document.querySelector("#sessionSummary")?.classList.contains("hidden"),
      draftActive: Boolean(window.__repforgeWorkoutDraft.current()),
      sessionRows: window.__repforgeWorkoutDraft.state().log.filter((row) => row.session === id).length,
    }), sessionId);
    assert.equal(incomplete.toast, "Complete the planned sets, or use Finish session early.",
      "normal Finish after dismissing early consent gives the usual incomplete-workout message: " + JSON.stringify(incomplete));
    assert.equal(incomplete.summaryVisible, false, "incomplete work cannot be saved using stale early consent");
    assert.equal(incomplete.draftActive, true, "incomplete normal Finish keeps the draft");
    assert.equal(incomplete.sessionRows, 0, "incomplete normal Finish adds no history rows");
    await context.close();
  }

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
    const [first] = await draftTargets(page);
    await completeSet(page, first.exerciseInstanceId, first.setId);
    await page.locator("#sessionSheetBtn").click();
    await page.locator("#sessionEarlyFinish").click();
    await page.waitForSelector("#sessionEarlyPrompt:not(.hidden)");
    await page.evaluate((draftKey) => {
      window.__finishOperationIds = [];
      window.__repforgeDraftBeforeSaveCommit = ({ operationId }) => window.__finishOperationIds.push(operationId);
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
    const partialState = await page.evaluate(async ({ exerciseInstanceId, setId, metricId }) => {
      const result = await window.__repforgeLastWorkoutFinish;
      const draft = window.__repforgeWorkoutDraft.current();
      const sessionRows = window.__repforgeWorkoutDraft.state().log.filter((row) => row.session === draft.draftId);
      window.__restoreFinishFault?.();
      const edit = await window.__repforgeWorkoutDraft.dispatch("editMetricValue", {
        exerciseInstanceId, setId, metricId, value: "70",
      });
      await window.__repforgeWorkoutDraft.flush();
      const editedDraft = window.__repforgeWorkoutDraft.current();
      const save = await window.__repforgeSaveWorkout();
      return {
        result: { committed: result?.committed, finalizationPending: result?.finalizationPending },
        sessionRows: sessionRows.length,
        savedLoad: sessionRows.find((row) => row.set === 1)?.load,
        canonicalDraftRaw: localStorage.getItem("repforge_draft_v1"),
        checkpointKind: window.__repforgeWorkoutDraft.checkpoint().value?.kind,
        editStatus: edit.status,
        editedLoad: editedDraft?.exercises?.[exerciseInstanceId]?.sets?.[setId]?.edited?.metrics?.[metricId],
        saveIgnored: save?.ignored,
        operationIds: window.__finishOperationIds,
      };
    }, { ...first, metricId: WEIGHT });
    assert.equal(partialState.result.committed, false,
      "a close-finalization failure is unsettled: " + JSON.stringify(partialState));
    assert.equal(partialState.result.finalizationPending, true,
      "this failure occurs after the durable snapshot was accepted: " + JSON.stringify(partialState));
    assert.equal(partialState.sessionRows, 1,
      "the accepted partial snapshot contains this operation's row: " + JSON.stringify(partialState));
    assert.equal(partialState.savedLoad, 62.5,
      "the accepted row carries the original set value: " + JSON.stringify(partialState));
    assert.equal(partialState.canonicalDraftRaw, null,
      "accepting the row also publishes the draft tombstone: " + JSON.stringify(partialState));
    assert.equal(partialState.checkpointKind, "tombstone",
      "the draft checkpoint confirms removal was accepted with the row: " + JSON.stringify(partialState));
    assert.equal(partialState.editStatus, "stale",
      "the stale in-memory draft cannot accept a set edit after the tombstone: " + JSON.stringify(partialState));
    assert.equal(partialState.editedLoad, "62.5",
      "the attempted edit does not alter the stale in-memory draft: " + JSON.stringify(partialState));
    assert.equal(partialState.saveIgnored, true,
      "Save remains refused in Recovery, so no fresh operation can replace these rows: " + JSON.stringify(partialState));
    assert.equal(partialState.operationIds.length, 1,
      "the only operation is the original one whose retry retains its captured rows: " + JSON.stringify(partialState));
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

    await page.evaluate(() => window.__repforgeSessionSheet.open());
    await page.evaluate(() => {
      window.__recoveryFocusAttempt = document.querySelector("#sessionEarlyFinish").onclick();
    });
    await page.waitForFunction(() => window.__repforgeModalState() === "closing", null, { timeout: 5000 });
    const cancelledClose = await page.evaluate(async () => {
      window.__repforgeSessionSheet.open();
      await window.__recoveryFocusAttempt;
      return {
        modal: window.__repforgeModalState(),
        sheetOpen: !document.querySelector("#sessionSheet").hidden,
        recoveryVisible: !document.querySelector("#draftRecovery").classList.contains("hidden"),
        recoveryFocused: document.activeElement === document.querySelector("#draftRecovery"),
      };
    });
    assert.deepEqual(cancelledClose, {
      modal: "closed",
      sheetOpen: false,
      recoveryVisible: true,
      recoveryFocused: true,
    }, "a refused Early finish still exposes Recovery when reopening cancels the sheet close: " + JSON.stringify(cancelledClose));
    await context.close();
  }
  await restOverrunOffer(browser);
  await voiceProof(browser);
}

if (guardFailures.length) throw new Error(`guards failed: ${guardFailures.join("; ")}`);
console.log("PASS: workout finish boundary");

if (!pastZeroOnly && !preludeOnly) await import("./session-zero-browser.mjs");
