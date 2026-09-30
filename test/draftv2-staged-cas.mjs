#!/usr/bin/env node
import assert from "node:assert/strict";
import { installSeedProgram } from "./fixtures/seed-program.mjs";
import { launchChromium } from "./browser.mjs";

const base = process.env.REPFORGE_URL || "http://localhost:8000/";
const browser = await launchChromium();
let context;
let first;
let second;
let releaseBarrier;
let releaseStateLock;
let stateCommit;

try {
  context = await browser.newContext({ serviceWorkers: "block" });
  first = await context.newPage();
  await first.goto(base, { waitUntil: "domcontentloaded" });
  await first.waitForFunction(() => window.__repforgeBooted === true);
  await installSeedProgram(first, { waitFor: (page) => page.waitForFunction(() => window.__repforgeBooted === true) });
  await first.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  await first.evaluate(() => window.__repforgeWorkoutDraft.flush());

  second = await context.newPage();
  await second.goto(base, { waitUntil: "domcontentloaded" });
  await second.waitForFunction(() => window.__repforgeBooted === true);
  await second.evaluate(() => window.__repforgeEnterWorkout({ day: "Day 1" }));
  await first.evaluate(() => window.__repforgeStorage.flush());
  await second.evaluate(() => window.__repforgeStorage.flush());

  const predecessors = await Promise.all([first, second].map((page) => page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return { draftId: draft.draftId, revision: draft.revision };
  })));
  assert.deepEqual(predecessors[0], predecessors[1], "both production dispatchers start from the same DraftV2 predecessor");
  assert.equal(predecessors[0].revision, 0);

  await first.evaluate(() => {
    window.__a01StateLockHeld = false;
    window.__a01StateLock = navigator.locks.request("repforge:state-write", () => new Promise((resolve) => {
      window.__a01ReleaseStateLock = resolve;
      window.__a01StateLockHeld = true;
    }));
  });
  await first.waitForFunction(() => window.__a01StateLockHeld === true);
  await first.evaluate(() => {
    const hook = window.__repforgeWorkoutDraft;
    const proposal = hook.state();
    proposal.settings.restSec = 123;
    window.__a01StateCommit = hook.commitEffect(proposal, hook.effect.preserve());
  });
  await first.waitForFunction(() => Object.keys(localStorage).some((key) => key.startsWith("repforge_pending_v1:")));

  let arriveAtBarrier;
  const atBarrier = new Promise((resolve) => { arriveAtBarrier = resolve; });
  let openBarrier;
  const barrier = new Promise((resolve) => { openBarrier = resolve; });
  releaseBarrier = openBarrier;
  await first.route("**/__a01_sidecar_barrier", async (route) => {
    arriveAtBarrier();
    await barrier;
    await route.fulfill({ status: 200, body: "released" });
  });
  await first.evaluate(() => {
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
  await second.evaluate(() => {
    window.__a01LockRequests = 0;
    const originalRequest = navigator.locks.request.bind(navigator.locks);
    Object.defineProperty(navigator.locks, "request", { configurable: true, value: (...args) => {
      window.__a01LockRequests++;
      return originalRequest(...args);
    } });
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("repforge_draft_v1:pending:")) window.__a01SidecarAttempt = true;
      return originalSetItem.call(this, key, value);
    };
  });

  const edit = ({ field, value }) => {
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const key = `${draft.session.selectedExerciseId}_1_load`;
    return hook.dispatch("editSetField", { ...hook.target(key), field, value });
  };
  const firstWrite = first.evaluate(edit, { field: "load", value: "80" });
  await Promise.race([
    atBarrier,
    new Promise((_, reject) => setTimeout(() => reject(new Error("A01 sidecar barrier was not reached")), 10000)),
  ]);

  const secondWritePromise = second.evaluate(edit, { field: "reps", value: "12" });
  await second.waitForFunction(() => window.__a01LockRequests > 0 || window.__a01SidecarAttempt === true,
    undefined, { timeout: 10000 });
  const secondBeforeResume = await Promise.race([
    secondWritePromise.then((result) => ({ settled: true, result })),
    new Promise((resolve) => setTimeout(() => resolve({ settled: false }), 1000)),
  ]);
  releaseBarrier();
  const firstResult = await firstWrite;
  const secondWrite = secondBeforeResume.settled ? secondBeforeResume.result : await secondWritePromise;

  await first.evaluate(() => window.__a01ReleaseStateLock());
  const stateResult = await first.evaluate(() => window.__a01StateCommit);
  const beforeReload = await first.evaluate(() => ({
    raw: localStorage.getItem("repforge_draft_v1"),
    checkpoint: JSON.parse(localStorage.getItem("repforge_draft_v1:v2-checkpoint") || "null"),
    sidecars: Object.keys(localStorage).filter((key) => key.startsWith("repforge_draft_v1:pending:")),
  }));
  await first.reload({ waitUntil: "domcontentloaded" });
  await first.waitForFunction(() => window.__repforgeBooted === true);
  const afterReload = await first.evaluate(() => ({
    raw: localStorage.getItem("repforge_draft_v1"),
    checkpoint: JSON.parse(localStorage.getItem("repforge_draft_v1:v2-checkpoint") || "null"),
    sidecars: Object.keys(localStorage).filter((key) => key.startsWith("repforge_draft_v1:pending:")),
  }));
  const parseEdits = (raw) => {
    const draft = JSON.parse(raw);
    const exercise = draft.exercises[draft.session.selectedExerciseId];
    const set = exercise.sets[exercise.setOrder[0]];
    return { revision: draft.revision, load: set.edited.load, reps: set.edited.reps };
  };
  const observation = {
    predecessor: predecessors[0],
    first: { status: firstResult.status, staged: firstResult.staged === true },
    second: { status: secondWrite.status, staged: secondWrite.staged === true },
    secondAcceptedBeforeAResumed: secondBeforeResume.settled && secondBeforeResume.result.status === "applied",
    stateCommit: { localOk: stateResult.localOk, idbOk: stateResult.idbOk, code: stateResult.code,
      conflict: stateResult.conflict === true },
    beforeReload: { ...parseEdits(beforeReload.raw), checkpointMatches: beforeReload.checkpoint?.raw === beforeReload.raw,
      checkpointKind: beforeReload.checkpoint?.kind, sidecarCount: beforeReload.sidecars.length },
    afterReload: { ...parseEdits(afterReload.raw), exactRaw: afterReload.raw === beforeReload.raw,
      checkpointMatches: afterReload.checkpoint?.raw === afterReload.raw,
      checkpointKind: afterReload.checkpoint?.kind, sidecarCount: afterReload.sidecars.length },
  };
  const accepted = [
    firstResult.status === "applied" ? { field: "load", value: "80" } : null,
    secondWrite.status === "applied" ? { field: "reps", value: "12" } : null,
  ].filter(Boolean);
  const durable = parseEdits(afterReload.raw);
  const acknowledgedInputsSurvive = accepted.every(({ field, value }) => durable[field] === value);
  const stateTransactionHandled = stateResult.code === "draft_conflict" ||
    stateResult.localOk === true && stateResult.idbOk === true;
  const invariantHolds = accepted.length <= 1 && acknowledgedInputsSurvive && stateTransactionHandled &&
    beforeReload.checkpoint?.raw === beforeReload.raw && afterReload.raw === beforeReload.raw &&
    afterReload.checkpoint?.raw === afterReload.raw && beforeReload.sidecars.length === 0 &&
    afterReload.sidecars.length === 0;
  assert.ok(invariantHolds, `same-predecessor staged acceptance lost or falsely acknowledged a DraftV2 edit: ${JSON.stringify(observation)}`);
} finally {
  releaseBarrier?.();
  if (first) {
    await first.evaluate(() => window.__a01ReleaseStateLock?.()).catch(() => {});
    await first.evaluate(() => window.__a01StateCommit).catch(() => {});
  }
  await context?.close();
  await browser.close();
}

console.log("A01 same-predecessor staged CAS preserves one truthful accepted DraftV2 edit through promotion and reload");
