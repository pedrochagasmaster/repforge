#!/usr/bin/env node
import assert from "node:assert/strict";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const DRAFT = "repforge_draft_v1";
const CHECKPOINT = `${DRAFT}:v2-checkpoint`;
const SIDECAR_PREFIX = `${DRAFT}:pending:`;
const JOURNAL_PREFIX = "repforge_pending_v1:";
const browser = await launchChromium();
const contexts = [];

async function newContext() {
  const context = await browser.newContext({ serviceWorkers: "block" });
  contexts.push(context);
  return context;
}

async function openApp(context) {
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true);
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
    if (!document.querySelector("#tour")?.classList.contains("hidden")) window.closeTour?.();
  });
  return page;
}

async function startWorkout(context, { seed = false } = {}) {
  const page = await openApp(context);
  if (seed) {
    await installSeedProgram(page, { waitFor: (target) => target.waitForFunction(() => window.__repforgeBooted === true) });
  }
  await page.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page;
}

async function holdStateTransaction(page) {
  await page.evaluate(() => {
    window.__a01StateLockHeld = false;
    window.__a01StateLock = navigator.locks.request("repforge:state-write", () => new Promise((resolve) => {
      window.__a01ReleaseStateLock = resolve;
      window.__a01StateLockHeld = true;
    }));
  });
  await page.waitForFunction(() => window.__a01StateLockHeld === true);
  await page.evaluate(() => {
    const hook = window.__repforgeWorkoutDraft;
    const proposal = hook.state();
    proposal.settings.restSec = 123;
    window.__a01StateCommit = hook.commitEffect(proposal, hook.effect.preserve());
  });
  await page.waitForFunction((prefix) => Object.keys(localStorage).some((key) => key.startsWith(prefix)), JOURNAL_PREFIX);
}

async function releaseStateTransaction(page) {
  await page.evaluate(() => window.__a01ReleaseStateLock?.());
  return page.evaluate(() => window.__a01StateCommit);
}

async function stored(page) {
  return page.evaluate(({ draftKey, checkpointKey, sidecarPrefix, journalPrefix }) => {
    const parse = (key) => {
      try { return JSON.parse(localStorage.getItem(key) || "null"); }
      catch { return "invalid"; }
    };
    const sidecars = Object.keys(localStorage).filter((key) => key.startsWith(sidecarPrefix)).map((key) => ({
      key, value: parse(key),
    }));
    const journals = Object.keys(localStorage).filter((key) => key.startsWith(journalPrefix));
    return {
      raw: localStorage.getItem(draftKey),
      checkpoint: parse(checkpointKey),
      recovery: parse(`${draftKey}:recovery`),
      sidecars,
      journals,
    };
  }, { draftKey: DRAFT, checkpointKey: CHECKPOINT, sidecarPrefix: SIDECAR_PREFIX, journalPrefix: JOURNAL_PREFIX });
}

function draftEdits(raw) {
  if (typeof raw !== "string") return null;
  const draft = JSON.parse(raw);
  const exercise = draft.exercises[draft.session.selectedExerciseId];
  const set = exercise.sets[exercise.setOrder[0]];
  return { draftId: draft.draftId, revision: draft.revision, load: set.edited.load, reps: set.edited.reps };
}

function fieldValue(field) {
  return field === "load" ? "80" : "12";
}

async function dispatchField(page, field) {
  return page.evaluate(({ field, value }) => {
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const key = `${draft.session.selectedExerciseId}_1_load`;
    return hook.dispatch("editSetField", { ...hook.target(key), field, value });
  }, { field, value: fieldValue(field) });
}

async function installBeforeSidecarBarrier(page) {
  let arrive;
  const atBarrier = new Promise((resolve) => { arrive = resolve; });
  let release;
  const waitForRelease = new Promise((resolve) => { release = resolve; });
  await page.route("**/__a01_sidecar_barrier", async (route) => {
    arrive();
    await waitForRelease;
    await route.fulfill({ status: 200, body: "released" });
  });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("repforge_draft_v1:pending:") && !window.__a01PausedBeforeSidecar) {
        window.__a01PausedBeforeSidecar = true;
        const request = new XMLHttpRequest();
        request.open("GET", "/__a01_sidecar_barrier", false);
        request.send();
      }
      return original.call(this, key, value);
    };
  });
  return { atBarrier, release };
}

async function watchCompetingBoundary(page) {
  await page.evaluate(() => {
    window.__a01Watching = false;
    window.__a01LockRequests = [];
    const originalRequest = navigator.locks.request.bind(navigator.locks);
    Object.defineProperty(navigator.locks, "request", { configurable: true, value: (...args) => {
      if (window.__a01Watching) window.__a01LockRequests.push(String(args[0]));
      return originalRequest(...args);
    } });
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (window.__a01Watching && key.startsWith("repforge_draft_v1:pending:")) window.__a01SidecarAttempt = true;
      return originalSetItem.call(this, key, value);
    };
  });
}

async function runSamePredecessorRace({ pausedWriter, pausedField, competingField }) {
  const context = await newContext();
  const owner = await startWorkout(context, { seed: true });
  const writers = {
    A: await startWorkout(context),
    B: await startWorkout(context),
  };
  const predecessor = await Promise.all([writers.A, writers.B].map((page) => page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return { draftId: draft.draftId, revision: draft.revision };
  })));
  assert.deepEqual(predecessor[0], predecessor[1], "both production dispatchers start from one DraftV2 predecessor");
  assert.equal(predecessor[0].revision, 0);

  await holdStateTransaction(owner);
  const paused = writers[pausedWriter];
  const competing = writers[pausedWriter === "A" ? "B" : "A"];
  const barrier = await installBeforeSidecarBarrier(paused);
  await watchCompetingBoundary(competing);

  const pausedWrite = dispatchField(paused, pausedField);
  await Promise.race([
    barrier.atBarrier,
    new Promise((_, reject) => setTimeout(() => reject(new Error("A01 sidecar barrier was not reached")), 10000)),
  ]);
  await competing.evaluate(() => { window.__a01Watching = true; });
  const competingWrite = dispatchField(competing, competingField);
  await competing.waitForFunction(() => window.__a01LockRequests.length > 0 || window.__a01SidecarAttempt === true,
    undefined, { timeout: 10000 });
  let resumeTimer;
  const competingBeforeResume = await Promise.race([
    competingWrite.then((result) => ({ settled: true, result })),
    new Promise((resolve) => { resumeTimer = setTimeout(() => resolve({ settled: false }), 750); }),
  ]);
  clearTimeout(resumeTimer);
  barrier.release();
  const pausedResult = await pausedWrite;
  const competingResult = competingBeforeResume.settled ? competingBeforeResume.result : await competingWrite;
  const stagedFirst = await stored(owner);

  const sequentialResult = await dispatchField(paused, competingField);
  const stagedSequential = await stored(owner);
  const stateResult = await releaseStateTransaction(owner);
  const promoted = await stored(owner);
  await owner.reload({ waitUntil: "domcontentloaded" });
  await owner.waitForFunction(() => window.__repforgeBooted === true);
  const reloaded = await stored(owner);

  const firstSidecar = stagedFirst.sidecars.at(-1)?.value;
  const sequentialSidecar = stagedSequential.sidecars.at(-1)?.value;
  const firstDraft = draftEdits(firstSidecar?.raw);
  const sequentialDraft = draftEdits(sequentialSidecar?.raw);
  const committed = draftEdits(promoted.raw);
  const restored = draftEdits(reloaded.raw);
  const observation = {
    pausedWriter, pausedField, competingField, predecessor: predecessor[0],
    paused: pausedResult.status, competing: competingResult.status,
    competingAcceptedBeforeSidecarPublication: competingBeforeResume.settled && competingBeforeResume.result.status === "applied",
    stagedBeforeSequential: { count: stagedFirst.sidecars.length, draft: firstDraft },
    sequential: { status: sequentialResult.status, draft: sequentialDraft },
    stateTransaction: { code: stateResult.code, conflict: stateResult.conflict === true,
      localOk: stateResult.localOk, idbOk: stateResult.idbOk },
    promoted: { draft: committed, checkpointMatches: promoted.checkpoint?.raw === promoted.raw,
      checkpointKind: promoted.checkpoint?.kind, sidecarCount: promoted.sidecars.length },
    reloaded: { draft: restored, exactRaw: reloaded.raw === promoted.raw,
      checkpointMatches: reloaded.checkpoint?.raw === reloaded.raw,
      sidecarCount: reloaded.sidecars.length },
  };
  const stateTransactionHandled = stateResult.code === "draft_conflict" ||
    stateResult.localOk === true && stateResult.idbOk === true;
  assert.equal(pausedResult.status, "applied", JSON.stringify(observation));
  assert.equal(competingResult.status, "stale", JSON.stringify(observation));
  assert.equal(competingBeforeResume.settled, false, JSON.stringify(observation));
  assert.equal(stagedFirst.sidecars.length, 1, JSON.stringify(observation));
  assert.equal(firstDraft.revision, 1, JSON.stringify(observation));
  assert.equal(firstDraft[pausedField], fieldValue(pausedField), JSON.stringify(observation));
  assert.notEqual(firstDraft[competingField], fieldValue(competingField), JSON.stringify(observation));
  assert.equal(sequentialResult.status, "applied", JSON.stringify(observation));
  assert.equal(sequentialDraft.revision, 2, JSON.stringify(observation));
  assert.equal(sequentialDraft.load, "80", JSON.stringify(observation));
  assert.equal(sequentialDraft.reps, "12", JSON.stringify(observation));
  assert.equal(stateTransactionHandled, true, JSON.stringify(observation));
  assert.equal(committed.revision, 2, JSON.stringify(observation));
  assert.equal(committed.load, "80", JSON.stringify(observation));
  assert.equal(committed.reps, "12", JSON.stringify(observation));
  assert.equal(promoted.checkpoint?.kind, "committed", JSON.stringify(observation));
  assert.equal(promoted.checkpoint?.raw, promoted.raw, JSON.stringify(observation));
  assert.equal(promoted.sidecars.length, 0, JSON.stringify(observation));
  assert.equal(reloaded.raw, promoted.raw, JSON.stringify(observation));
  assert.equal(reloaded.checkpoint?.raw, reloaded.raw, JSON.stringify(observation));
  assert.equal(reloaded.sidecars.length, 0, JSON.stringify(observation));
  return observation;
}

async function verifyCheckpointMissingFailsClosed() {
  const context = await newContext();
  const owner = await startWorkout(context, { seed: true });
  const predecessor = (await stored(owner)).raw;
  await holdStateTransaction(owner);
  await owner.evaluate((key) => localStorage.removeItem(key), CHECKPOINT);
  const result = await dispatchField(owner, "load");
  const beforeClose = await stored(owner);
  const stateResult = await releaseStateTransaction(owner);
  await owner.reload({ waitUntil: "domcontentloaded" });
  await owner.waitForFunction(() => window.__repforgeBooted === true);
  const reloaded = await stored(owner);
  const observation = { status: result.status, unchanged: beforeClose.raw === predecessor,
    sidecars: beforeClose.sidecars.length, checkpoint: beforeClose.checkpoint,
    stateTransaction: { code: stateResult.code, localOk: stateResult.localOk, idbOk: stateResult.idbOk },
    reloadRawUnchanged: reloaded.raw === predecessor, reloadCheckpoint: reloaded.checkpoint };
  assert.equal(result.status, "checkpoint-missing", JSON.stringify(observation));
  assert.equal(beforeClose.sidecars.length, 0, JSON.stringify(observation));
  assert.equal(beforeClose.raw, predecessor, JSON.stringify(observation));
  assert.equal(reloaded.raw, predecessor, JSON.stringify(observation));
  return observation;
}

async function verifyReloadReplaysBeforePromotion() {
  const context = await newContext();
  let owner = await startWorkout(context, { seed: true });
  const writer = await startWorkout(context);
  const before = await stored(writer);
  await holdStateTransaction(owner);
  const accepted = await dispatchField(writer, "load");
  const staged = await stored(writer);
  const stagedDraft = draftEdits(staged.sidecars.at(-1)?.value?.raw);
  const journalsPresent = staged.journals.length > 0;
  await owner.close();
  owner = null;
  await writer.reload({ waitUntil: "domcontentloaded" });
  await writer.waitForFunction(() => window.__repforgeBooted === true);
  const recovered = await stored(writer);
  const restored = draftEdits(recovered.raw);
  const observation = { accepted: accepted.status, before: draftEdits(before.raw), staged: stagedDraft,
    journalsPresent, after: restored, checkpointMatches: recovered.checkpoint?.raw === recovered.raw,
    sidecars: recovered.sidecars.length, journals: recovered.journals.length };
  assert.equal(accepted.status, "applied", JSON.stringify(observation));
  assert.equal(draftEdits(before.raw).revision, 0, JSON.stringify(observation));
  assert.equal(stagedDraft.revision, 1, JSON.stringify(observation));
  assert.equal(stagedDraft.load, "80", JSON.stringify(observation));
  assert.equal(journalsPresent, true, JSON.stringify(observation));
  assert.equal(restored.revision, 1, JSON.stringify(observation));
  assert.equal(restored.load, "80", JSON.stringify(observation));
  assert.equal(recovered.checkpoint?.raw, recovered.raw, JSON.stringify(observation));
  assert.equal(recovered.sidecars.length, 0, JSON.stringify(observation));
  assert.equal(recovered.journals.length, 0, JSON.stringify(observation));
  return observation;
}

async function verifyFailedSidecarWriteCanRetry() {
  const context = await newContext();
  const owner = await startWorkout(context, { seed: true });
  const writer = await startWorkout(context);
  const predecessor = (await stored(writer)).raw;
  await holdStateTransaction(owner);
  await writer.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("repforge_draft_v1:pending:") && !window.__a01FailedSidecarOnce) {
        window.__a01FailedSidecarOnce = true;
        throw new Error("injected first sidecar write failure");
      }
      return original.call(this, key, value);
    };
  });
  const failed = await dispatchField(writer, "load");
  const afterFailure = await stored(writer);
  const retry = await writer.evaluate(() => window.__repforgeWorkoutDraft.retryRecovery());
  const afterRetry = await stored(writer);
  const failedOnce = await writer.evaluate(() => window.__a01FailedSidecarOnce);
  const stateResult = await releaseStateTransaction(owner);
  await writer.reload({ waitUntil: "domcontentloaded" });
  await writer.waitForFunction(() => window.__repforgeBooted === true);
  const reloaded = await stored(writer);
  const observation = { failed: failed.status, failedOnce,
    noPartialSidecar: afterFailure.sidecars.length === 0 && afterFailure.raw === predecessor,
    retry: retry?.status, stagedRevision: draftEdits(afterRetry.sidecars.at(-1)?.value?.raw)?.revision,
    stateTransaction: { code: stateResult.code, localOk: stateResult.localOk, idbOk: stateResult.idbOk },
    reloaded: draftEdits(reloaded.raw), checkpointMatches: reloaded.checkpoint?.raw === reloaded.raw };
  assert.equal(failed.status, "stage-failed", JSON.stringify(observation));
  assert.equal(observation.failedOnce, true, JSON.stringify(observation));
  assert.equal(observation.noPartialSidecar, true, JSON.stringify(observation));
  assert.equal(retry?.status, "applied", JSON.stringify(observation));
  assert.equal(observation.stagedRevision, 1, JSON.stringify(observation));
  assert.equal(observation.reloaded.load, "80", JSON.stringify(observation));
  assert.equal(reloaded.checkpoint?.raw, reloaded.raw, JSON.stringify(observation));
  return observation;
}

async function verifyStaleSidecarCannotRegressCanonical() {
  const context = await newContext();
  const page = await startWorkout(context, { seed: true });
  const first = await dispatchField(page, "load");
  const staleRaw = first.raw;
  const second = await dispatchField(page, "reps");
  const newerRaw = second.raw;
  await page.evaluate(({ transactionId, raw }) =>
    window.__repforgeWorkoutDraft.stageLegacy(transactionId, raw), { transactionId: "draft-write", raw: staleRaw });
  const staged = await stored(page);
  const promoted = await page.evaluate(() => window.__repforgeWorkoutDraft.promote("draft-write"));
  const afterPromotion = await stored(page);
  const reloadedBefore = afterPromotion.raw;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true);
  const reloaded = await stored(page);
  const observation = { first: first.status, second: second.status,
    staleSidecarRevision: draftEdits(staged.sidecars.at(-1)?.value?.raw)?.revision,
    promoted: promoted?.settled, canonical: draftEdits(afterPromotion.raw),
    expectedRawSurvived: afterPromotion.raw === newerRaw,
    recoveryReason: afterPromotion.recovery?.reason, sidecars: afterPromotion.sidecars.length,
    reloadExact: reloaded.raw === reloadedBefore, checkpointMatches: reloaded.checkpoint?.raw === reloaded.raw };
  assert.equal(first.status, "applied", JSON.stringify(observation));
  assert.equal(second.status, "applied", JSON.stringify(observation));
  assert.equal(observation.staleSidecarRevision, 1, JSON.stringify(observation));
  assert.equal(promoted?.settled, true, JSON.stringify(observation));
  assert.equal(afterPromotion.raw, newerRaw, JSON.stringify(observation));
  assert.equal(draftEdits(afterPromotion.raw).revision, 2, JSON.stringify(observation));
  assert.equal(draftEdits(afterPromotion.raw).load, "80", JSON.stringify(observation));
  assert.equal(draftEdits(afterPromotion.raw).reps, "12", JSON.stringify(observation));
  assert.equal(afterPromotion.checkpoint?.raw, newerRaw, JSON.stringify(observation));
  assert.equal(afterPromotion.sidecars.length, 0, JSON.stringify(observation));
  assert.equal(reloaded.raw, newerRaw, JSON.stringify(observation));
  assert.equal(reloaded.checkpoint?.raw, reloaded.raw, JSON.stringify(observation));
  return observation;
}

try {
  await runSamePredecessorRace({ pausedWriter: "A", pausedField: "load", competingField: "reps" });
  await runSamePredecessorRace({ pausedWriter: "B", pausedField: "reps", competingField: "load" });
  await verifyCheckpointMissingFailsClosed();
  await verifyReloadReplaysBeforePromotion();
  await verifyFailedSidecarWriteCanRetry();
  await verifyStaleSidecarCannotRegressCanonical();
} finally {
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
}

console.log("A01 staged DraftV2 concurrency, conflict, retry, promotion, and reload proofs passed");
