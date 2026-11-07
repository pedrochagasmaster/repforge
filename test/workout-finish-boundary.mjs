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

  if (failures.length) throw new Error(`voice proofs failed: ${failures.join("; ")}`);
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

  await voiceProof(browser);
} finally {
  await browser.close();
}

console.log("PASS: workout finish boundary");
