#!/usr/bin/env node
/** Program review candidate lifetime, queue ordering and exact Undo replay through production controls. */
import { createRequire } from "node:module";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const Metrics = require("../exercise-metrics.js");
const Review = require("../program-review.js");
const REVIEW_CTX = { compiler: Compiler, catalog: Catalog, metrics: Metrics };

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

async function fresh(browser, { uuid, hasTouch = false, reducedMotion, withoutMotion = false, withoutWorker = false, fakeWorker = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch,
    ...(reducedMotion ? { reducedMotion } : {}) });
  await context.addInitScript(() => {
    window.__reviewActions = [];
    localStorage.setItem("repforge_telemetry_enabled_v1", "true");
    let installed;
    Object.defineProperty(window, "RepForgeTelemetry", { configurable: true, get: () => installed, set(next) {
      installed = next;
      next.boot({ adapter: { capture: (name, properties) => {
        if (name === "program_review_action") window.__reviewActions.push({ ...properties });
      }, setEnabled() {} }, appVersion: "test", crypto: window.crypto, location: window.location,
        now: () => new Date(), releaseChannel: "preview", storage: window.localStorage });
    } });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  if (withoutMotion) await page.route("**/motion-layer.js*", (route) => route.abort());
  if (withoutWorker) await page.addInitScript(() => { window.Worker = undefined; });
  if (fakeWorker) await page.addInitScript(() => {
    const engine = window.__heldReviewWorker = { hold: false, requests: [], releaseAll() {
      for (const item of this.requests) if (!item.sent) {
        item.sent = true;
        const value = window.RepForgeProgramCompiler.generateProgram(item.message.request,
          window.RepForgeExerciseCatalog.snapshot(), item.message.generationOptions);
        item.worker.onmessage({ data: { id: item.message.id, ok: true, value } });
      }
    } };
    window.Worker = class {
      constructor() { this.onmessage = null; }
      postMessage(message) {
        if (message.type === "init") { queueMicrotask(() => this.onmessage({ data: { type: "ready" } })); return; }
        if (message.type !== "generate") return;
        const item = { worker: this, message, sent: false };
        engine.requests.push(item);
        if (!engine.hold) { engine.hold = true; engine.releaseAll(); engine.hold = false; }
      }
      terminate() {}
    };
  });
  // Fix draft identity where a scenario needs a reproducible setup fixture.
  if (uuid) {
    await page.addInitScript((fixed) => {
      try { Object.defineProperty(globalThis.crypto, "randomUUID", { value: () => fixed, configurable: true }); }
      catch { globalThis.crypto.randomUUID = () => fixed; }
    }, uuid);
  }
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function answerGenerate(page, { days = 4, minutes = 60, environment = "commercial_gym", abilities = null, ...rest } = {}) {
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { days, minutes, environment, abilities, skipBasics: true, ...rest });
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result");
}

// Plan 070: review and adjust -------------------------------------------------
const reviewed = (page) => page.evaluate(() => window.__repforgeEntryState?.()?.result?.preview?.programDefinition);
const reviewLog = (page) => page.evaluate(() => JSON.parse(sessionStorage.getItem("repforge_entry_review_v1") || "null"));
const slotsOf = (definition) => definition.days.flatMap((day) => day.slots || []);
const trainingDays = (definition) => definition.days.filter((day) => day.kind === "training");

/** One adjustment through the screen, mirrored as one edit in the expected log.
 *  The setup draft must then hold exactly that log replayed on the
 *  recommendation, so the screen can neither skip nor invent a change. */
async function step(page, run, edit, act, label) {
  await act();
  if (edit) run.log.push(edit);
  const expected = Review.replay(run.baseline, run.log, REVIEW_CTX);
  if (!expected.ok) throw new Error(`${label}: the expected log does not replay (${expected.code} at ${expected.failedAt})`);
  const want = JSON.stringify(expected.definition);
  const settled = await page.waitForFunction((value) =>
    JSON.stringify(window.__repforgeEntryState?.()?.result?.preview?.programDefinition) === value, want, { timeout: 10000 })
    .then(() => true, () => false);
  const painted = settled && await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 10000 })
    .then(() => true, () => false);
  check(settled && painted, `review: ${label}`, settled ? undefined : { log: run.log });
  run.expected = expected.definition;
}

async function openSlot(page, slotId) {
  await page.locator(`#entryReview [data-review-slot="${slotId}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-sets]", { timeout: 5000 });
}
async function closeSheet(page) {
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
}
/** N14: an edit, undo or discard still queued or committing when the review leaves must not publish into the
 *  candidate the lifter has left. The setup-draft write lock holds the commit for real until the test releases it. */
async function holdSetupWrites(page) {
  await page.evaluate(() => new Promise((granted) => {
    navigator.locks.request("repforge:state-write", () => new Promise((release) => {
      window.__releaseSetupWrites = release;
      granted();
    }));
  }));
}
const releaseSetupWrites = (page) => page.evaluate(() => window.__releaseSetupWrites?.());
/** Queued review work enqueues its own draft write when it starts, so one flush can miss it: flush twice. */
const settleSetupWrites = (page) => page.evaluate(async () => {
  await window.__repforgeStorage.flush();
  await window.__repforgeStorage.flush();
});

async function undoAfterLeaving(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const session = { page, baseline: await reviewed(page), log: [] };
  const [dayA] = trainingDays(session.baseline);
  const [kept, removed] = dayA.slots;
  await openSlot(page, kept.id);
  await step(page, session, { kind: "sets", slotId: kept.id, count: kept.prescriptionsByCycle[0].sets.length + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "a set added before the held removal");
  await closeSheet(page);
  await holdSetupWrites(page);
  await openSlot(page, removed.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  // The sheet closes before the removal reaches its commit; only then is the commit held.
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  // Undo is queued behind the held removal; Back leaves the mounted screen,
  // but the candidate is still current and owns the queued work.
  await page.locator("#entryReview [data-review-undo]").click();
  await page.locator("#onbBack").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.step !== "result", undefined, { timeout: 10000 });
  await releaseSetupWrites(page);
  await settleSetupWrites(page);
  const expected = Review.replay(session.baseline, [{ kind: "sets", slotId: kept.id, count: kept.prescriptionsByCycle[0].sets.length + 1 }], REVIEW_CTX);
  check(expected.ok && JSON.stringify(await reviewed(page)) === JSON.stringify(expected.definition),
    "review: an undo queued before Back still reverses the removal on its current candidate");
  check(JSON.stringify((await reviewLog(page))?.edits) === JSON.stringify([{ kind: "sets", slotId: kept.id, count: kept.prescriptionsByCycle[0].sets.length + 1 }]),
    "review: the queued undo leaves only the earlier edit in the candidate log");
  await run.context.close();
  return run.errors;
}

async function editAcrossRemount(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const baseline = await reviewed(page);
  const [dayA] = trainingDays(baseline);
  await holdSetupWrites(page);
  await openSlot(page, dayA.slots[1].id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  // Back then forward rebuilds the recommendation while the removal is still committing.
  await page.locator("#onbBack").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.step !== "result", undefined, { timeout: 10000 });
  await continueReviewRebuild(page);
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined, { timeout: 15000 });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ timeout: 10000 });
  await releaseSetupWrites(page);
  await settleSetupWrites(page);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline),
    "review: the rebuilt recommendation is what the screen keeps after the held removal lands");
  check(await page.locator(".review-toast").count() === 0,
    "review: a removal that landed after the review remounted shows no toast");
  check(!await reviewLog(page), "review: nor writes its edit log into the rebuilt candidate");
  await run.context.close();
  return run.errors;
}

async function sameCandidateEditsAcrossRemount(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const baseline = await reviewed(page);
  const [day] = trainingDays(baseline);
  const [first, second] = day.slots;
  await holdSetupWrites(page);
  await openSlot(page, first.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#onbCancel").click();
  await page.waitForSelector("#entryCancelDiscard", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForSelector("#entryCancelDiscard", { state: "hidden", timeout: 5000 });
  await page.locator(`#entryReview [data-review-slot="${second.id}"]`).waitFor({ timeout: 10000 });
  await openSlot(page, second.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await releaseSetupWrites(page);
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await settleSetupWrites(page);
  const edits = (await reviewLog(page))?.edits;
  const replayed = Review.replay(baseline, edits || [], REVIEW_CTX);
  check(replayed.ok && JSON.stringify(replayed.definition) === JSON.stringify(await reviewed(page)),
    "review: edits across a same-candidate remount keep the log equal to the saved definition",
    { edits, replayed: replayed.ok && replayed.definition, saved: await reviewed(page) });
  check(edits?.length === 2, "review: both removals remain undoable after the same-candidate remount", edits);
  await run.context.close();
  return run.errors;
}

async function restoreDoesNotCrossCandidate(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const baseline = await reviewed(page);
  const [day] = trainingDays(baseline);
  const [edited, queuedRemoval, newRemoval] = day.slots;
  const session = { page, baseline, log: [] };
  await openSlot(page, edited.id);
  await step(page, session, { kind: "sets", slotId: edited.id, count: edited.prescriptionsByCycle[0].sets.length + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "a set added before the held restore");
  await closeSheet(page);
  await holdSetupWrites(page);
  await openSlot(page, queuedRemoval.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#entryReview [data-review-restore]").click();
  await page.locator("#reviewConfirmGo").click();
  await page.locator("#onbBack").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.step !== "result", undefined, { timeout: 10000 });
  await continueReviewRebuild(page);
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined, { timeout: 15000 });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ timeout: 10000 });
  await openSlot(page, newRemoval.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await releaseSetupWrites(page);
  await settleSetupWrites(page);
  const expected = Review.replay(baseline, [{ kind: "remove", slotId: newRemoval.id }], REVIEW_CTX);
  check(expected.ok && JSON.stringify(await reviewed(page)) === JSON.stringify(expected.definition),
    "review: a queued restore cannot erase an edit on the replacement candidate",
    { expected: expected.ok && expected.definition, saved: await reviewed(page) });
  check((await reviewLog(page))?.edits?.length === 1,
    "review: the replacement candidate keeps its edit log after the old restore settles", await reviewLog(page));
  await run.context.close();
  return run.errors;
}

async function restoreQuestionDoesNotCrossCandidate(browser) {
  const run = await fresh(browser, { fakeWorker: true });
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const [day] = trainingDays(await reviewed(page));
  await openSlot(page, day.slots[0].id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 10000 });
  await closeSheet(page);
  await page.evaluate(() => { window.__heldReviewWorker.hold = true; });
  const requestCount = await page.evaluate(() => window.__heldReviewWorker.requests.length);
  await page.click('[data-entry-chip="days"]');
  await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]').click();
  await page.click("#entryChipApply");
  await page.click("#reviewConfirmGo");
  await page.waitForFunction((count) => window.__heldReviewWorker.requests.length > count, requestCount, { timeout: 10000 });
  await page.click('[data-entry-chip="days"]');
  await page.locator("#entryReview [data-review-restore]").click();
  await page.waitForSelector("#reviewConfirmGo", { timeout: 5000 });
  await page.evaluate(() => window.__heldReviewWorker.releaseAll());
  await page.waitForFunction(() => window.__repforgeEntryState()?.answers?.daysPerWeek === 3 &&
    window.__repforgeEntryState()?.step === "result", undefined, { timeout: 15000 });
  const rebuilt = await reviewed(page);
  const toastsBefore = await page.evaluate(() => [...document.querySelectorAll(".review-toast, .toast, #toast")]
    .filter((el) => el.offsetParent !== null || el.getClientRects().length).map((el) => el.textContent.trim()).filter(Boolean));
  await page.click("#reviewConfirmGo");
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"), undefined, { timeout: 10000 });
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(rebuilt),
    "review: answering a stale Restore question cannot replace the rebuilt candidate", await reviewed(page));
  const toastsAfter = await page.evaluate(() => [...document.querySelectorAll(".review-toast, .toast, #toast")]
    .filter((el) => el.offsetParent !== null || el.getClientRects().length).map((el) => el.textContent.trim()).filter(Boolean));
  check(JSON.stringify(toastsAfter) === JSON.stringify(toastsBefore),
    "review: a stale Restore question does not announce success on the replacement candidate", toastsAfter);
  await run.context.close();
  return run.errors;
}

async function renameDoesNotCrossCandidate(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const baseline = await reviewed(page);
  const [day] = trainingDays(baseline);
  await holdSetupWrites(page);
  await openSlot(page, day.slots[1].id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#entryReview [data-review-title]").click();
  await page.fill("#reviewRenameInput", "Old candidate name");
  await page.locator("#reviewSheet [data-review-rename-save]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#onbBack").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.step !== "result", undefined, { timeout: 10000 });
  await continueReviewRebuild(page);
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined, { timeout: 15000 });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ timeout: 10000 });
  const rebuiltName = await entry(page).then((value) => value.result.name);
  await releaseSetupWrites(page);
  await settleSetupWrites(page);
  check((await entry(page)).result.name === rebuiltName && rebuiltName !== "Old candidate name",
    "review: a queued program rename cannot publish into the replacement candidate", await entry(page).then((value) => value.result.name));
  await run.context.close();
  return run.errors;
}

async function sameCandidateCommitRepaintsRemount(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const baseline = await reviewed(page);
  const [day] = trainingDays(baseline);
  const removed = day.slots[1];
  await holdSetupWrites(page);
  await openSlot(page, removed.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.waitForFunction((definition) => JSON.stringify(window.__repforgeEntryState()?.result?.preview?.programDefinition) !== definition,
    JSON.stringify(baseline), { timeout: 10000 });
  await page.locator("#onbCancel").click();
  await page.waitForSelector("#entryCancelDiscard", { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.waitForSelector("#entryCancelDiscard", { state: "hidden", timeout: 5000 });
  await page.locator("#entryReview").waitFor({ state: "visible", timeout: 10000 });
  await page.evaluate(() => {
    const host = document.querySelector("#entryReview");
    window.__reviewRepaintRecords = 0;
    window.__reviewRepaintObserver = new MutationObserver((records) => { window.__reviewRepaintRecords += records.length; });
    window.__reviewRepaintObserver.observe(host, { childList: true, subtree: true });
  });
  await releaseSetupWrites(page);
  await settleSetupWrites(page);
  const repaints = await page.evaluate(() => {
    const count = window.__reviewRepaintRecords;
    window.__reviewRepaintObserver.disconnect();
    return count;
  });
  check(repaints > 0,
    "review: the same-candidate commit repaints the remounted review", repaints);
  check(!await page.locator(`#entryReview [data-review-slot="${removed.id}"]`).count() &&
    await page.locator("#entryReview [data-review-count]").count() === 1,
    "review: a same-candidate commit repaints the remount with its saved edit",
    await page.locator("#entryReview").innerText());
  check((await reviewLog(page))?.edits?.length === 1,
    "review: the remounted screen's Undo matches the committed edit log", await reviewLog(page));
  await run.context.close();
  return run.errors;
}

// Round 3 journeys reuse U1, RS1, RN1, RS3, Q7, Q8, MO1b and Q1 from the independent review probes.
async function queuedReviewSetup(browser) {
  const run = await fresh(browser, { fakeWorker: true });
  const { page } = run;
  await answerGenerate(page);
  await page.locator("#entryReview [data-review-slot]").first().waitFor();
  const baseline = await reviewed(page);
  const [a, b, c] = trainingDays(baseline)[0].slots;
  await openSlot(page, a.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"));
  await closeSheet(page);
  await holdSetupWrites(page);
  await openSlot(page, b.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden" });
  // A closed sheet precedes commit: prove the removal has reached the held write.
  await page.waitForFunction((id) => !window.__repforgeEntryState().result.preview.programDefinition.days
    .flatMap(day => day.slots || []).some(slot => slot.id === id), b.id);
  return { ...run, baseline, a, b, c };
}
async function settleQueuedReviewWrites(page) {
  // Reuse the probes' flush/frame boundary: a queued task can enqueue the next write after a flush.
  for (let i = 0; i < 4; i++) {
    await settleSetupWrites(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }
}
async function remountQueuedReview(page) {
  await page.click("#onbCancel");
  await page.locator("#entryCancelDiscard").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#entryCancelDiscard").waitFor({ state: "hidden" });
  await page.locator("#entryReview").waitFor();
}
async function queueReviewRestore(page) {
  await page.locator("#entryReview [data-review-restore]").click();
  await page.click("#reviewConfirmGo");
  await page.locator("#reviewConfirmGo").waitFor({ state: "hidden" });
}
const reviewToasts = page => page.evaluate(() => [...document.querySelectorAll(".review-toast, .toast, #toast")]
  .filter(el => el.getClientRects().length).map(el => el.textContent.trim()));
async function checkReviewScreen(page, baseline, finding) {
  const facts = await page.evaluate(() => {
    const host = document.querySelector("#entryReview"), st = window.__repforgeEntryState();
    const tab = Number(host.querySelector(".review__tab.is-on").dataset.reviewTab);
    return { rows: [...host.querySelectorAll("[data-review-slot]")].map(el => el.dataset.reviewSlot),
      wanted: st.result.preview.programDefinition.days[tab].slots.map(slot => slot.id),
      count: host.querySelector("[data-review-count]")?.textContent.trim() || null,
      title: host.querySelector("[data-review-title] span").textContent,
      name: st.result.name };
  });
  const def = await reviewed(page), log = (await reviewLog(page))?.edits || [];
  const count = Review.changes(baseline, def).count;
  check(JSON.stringify(facts.rows) === JSON.stringify(facts.wanted), `${finding}: painted rows equal the saved candidate`, facts);
  check(facts.count === (count ? `${count} ${count === 1 ? "change" : "changes"} of yours` : null),
    `${finding}: painted change count equals the saved candidate`, facts);
  check(facts.title === facts.name, `${finding}: painted title equals the saved candidate`, facts);
  const replayed = Review.replay(baseline, log, REVIEW_CTX);
  check(replayed.ok && JSON.stringify(replayed.definition) === JSON.stringify(def), `${finding}: replay equals saved candidate`);
}

async function revisionF7(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, b } = run;
  await page.locator("#entryReview [data-review-undo]").click();
  await remountQueuedReview(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  await checkReviewScreen(page, baseline, "F7");
  check((await reviewToasts(page)).includes("Change undone."), "F7: remounted review announces the queued Undo");
  const shown = await page.locator("#entryReview [data-review-slot]").evaluateAll(rows => rows.map(row => row.dataset.reviewSlot));
  await page.click("#entryActivate");
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state().programMeta.onboarded === true);
  const active = (await state(page)).programMeta.programDefinition;
  check(shown.includes(b.id) && active.days.some(day => day.slots?.some(slot => slot.id === b.id)),
    "F7: Activate commits the restored row shown on review");
  await run.context.close();
  return run.errors;
}

async function revisionF8(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline } = run;
  await queueReviewRestore(page);
  await remountQueuedReview(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline), "F8: queued Restore lands on its candidate");
  await checkReviewScreen(page, baseline, "F8");
  check((await reviewToasts(page)).includes("Recommendation restored."), "F8: remounted review announces Restore");
  await run.context.close();
  return run.errors;
}

async function revisionF9(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline } = run;
  await page.locator("#entryReview [data-review-title]").click();
  await page.fill("#reviewRenameInput", "Queued name");
  await page.locator("#reviewSheet [data-review-rename-save]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden" });
  await remountQueuedReview(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check((await entry(page)).result.name === "Queued name", "F9: queued rename lands");
  await checkReviewScreen(page, baseline, "F9");
  await run.context.close();
  return run.errors;
}

async function revisionF10(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline } = run;
  await queueReviewRestore(page);
  await page.click("#onbCancel");
  await page.click("#entryCancelKeep");
  await releaseSetupWrites(page);
  await page.waitForFunction(() => !document.querySelector("#onboarding.active"));
  await settleQueuedReviewWrites(page);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline), "F10: Restore still lands after Keep");
  check(!(await reviewToasts(page)).includes("Recommendation restored."), "F10: Restore does not announce on Today");
  await run.context.close();
  return run.errors;
}

async function revisionF13(browser) {
  const run = await fresh(browser), { page } = run;
  await page.click("#firstRunCreate");
  await answerRecommend(page, { skipBasics: true });
  const offer = page.locator("#entryReview [data-review-confirm-offer-action]").first();
  await offer.waitFor();
  const slotId = await offer.getAttribute("data-review-confirm-offer-action");
  const base = await reviewed(page);
  const other = trainingDays(base).flatMap(day => day.slots).find(slot => slot.id !== slotId);
  await holdSetupWrites(page);
  await openSlot(page, other.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden" });
  await offer.click();
  await page.click("#onbBack");
  await continueReviewRebuild(page);
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result");
  await page.locator(`#entryReview [data-review-confirm-offer-action="${slotId}"]`).waitFor();
  const rebuilt = await reviewed(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check(Object.keys((await entry(page)).answers.movementConfirmations || {}).length === 0,
    "F13: queued movement offer cannot confirm on the rebuilt candidate");
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(rebuilt), "F13: rebuilt movement slot stays unchanged");
  check(!(await reviewToasts(page)).some(text => text.includes("could not be saved")), "F13: stale movement offer does not report a false save failure");
  await run.context.close();
  return run.errors;
}

async function revisionF11(browser) {
  const run = await queuedReviewSetup(browser), { page, b } = run;
  await page.locator("#entryReview [data-review-undo]").click();
  await page.evaluate(() => { window.__heldReviewWorker.hold = true; });
  await page.click("#onbBack");
  const n = await page.evaluate(() => window.__heldReviewWorker.requests.length);
  await continueReviewRebuild(page);
  await page.waitForFunction(n => window.__heldReviewWorker.requests.length > n, n);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check(!slotsOf(await reviewed(page)).some(slot => slot.id === b.id), "F11: queued Undo is dropped once result generation starts");
  await page.evaluate(() => { window.__heldReviewWorker.hold = false; window.__heldReviewWorker.releaseAll(); });
  const landed = await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined,
    { timeout: 6000 }).then(() => true, () => false);
  check(landed, "F11: result generation lands after the held write drains");
  await run.context.close();
  return run.errors;
}

async function revisionF12(browser) {
  const run = await queuedReviewSetup(browser), { page, b } = run;
  await page.locator("#entryReview [data-review-undo]").click();
  await page.evaluate(() => { window.__heldReviewWorker.hold = true; });
  const n = await page.evaluate(() => window.__heldReviewWorker.requests.length);
  await page.click('[data-entry-chip="days"]');
  await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]').click();
  await page.click("#entryChipApply");
  await page.click("#reviewConfirmGo");
  await page.waitForFunction(n => window.__heldReviewWorker.requests.length > n, n);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check(!slotsOf(await reviewed(page)).some(slot => slot.id === b.id), "F12: queued Undo is dropped once answer rebuild starts");
  await page.evaluate(() => { window.__heldReviewWorker.hold = false; window.__heldReviewWorker.releaseAll(); });
  const landed = await page.waitForFunction(() => window.__repforgeEntryState()?.answers.daysPerWeek === 3, undefined,
    { timeout: 6000 }).then(() => true, () => false);
  check(landed && trainingDays(await reviewed(page)).length === 3, "F12: three-day answer rebuild wins over queued Undo");
  // Q6 / F18: changing an answer clears result before the held write resumes.
  const changed = await queuedReviewSetup(browser), nextPage = changed.page;
  await nextPage.locator("#entryReview [data-review-undo]").click();
  await nextPage.click("#onbBack");
  await nextPage.locator('#onbBody [data-entry-pick]:not(.is-selected):not([aria-checked="true"]):not([aria-pressed="true"])').first().click();
  check(!(await entry(nextPage)).result, "F18: answer change clears the previous result");
  await releaseSetupWrites(nextPage);
  await settleQueuedReviewWrites(nextPage);
  check(changed.errors.length === 0, "F18: invalidated review work never reads a cleared result", changed.errors);
  await changed.context.close();
  await run.context.close();
  return run.errors;
}

async function revisionF14(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, b, c } = run;
  await openSlot(page, c.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await closeSheet(page);
  await page.locator("#entryReview [data-review-undo]").click();
  await remountQueuedReview(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  const edits = (await reviewLog(page))?.edits || [];
  check(edits.length === 2 && edits[1].kind === "remove" && edits[1].slotId === b.id,
    "F14: queued edit lands across remount so Undo reverses the set edit, keeping removal", edits);
  await checkReviewScreen(page, baseline, "F14");
  await run.context.close();
  return run.errors;
}

async function discardAfterQueuedUndo(browser) {
  const run = await fresh(browser);
  const { page } = run;
  await answerGenerate(page);
  await page.waitForSelector("#entryReview [data-review-slot]", { timeout: 15000 });
  const session = { page, baseline: await reviewed(page), log: [] };
  const [dayA] = trainingDays(session.baseline);
  const [kept, removed] = dayA.slots;
  await openSlot(page, kept.id);
  await step(page, session, { kind: "sets", slotId: kept.id, count: kept.prescriptionsByCycle[0].sets.length + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "a set added before the held removal");
  await closeSheet(page);
  await holdSetupWrites(page);
  await openSlot(page, removed.id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  await page.locator("#entryReview [data-review-undo]").click();
  await page.locator("#onbCancel").click();
  await page.locator("#entryCancelDiscard").click({ timeout: 5000 });
  await releaseSetupWrites(page);
  await page.waitForFunction(() => !document.querySelector("#onboarding.active"), undefined, { timeout: 10000 });
  await settleSetupWrites(page);
  check(!await reviewLog(page), "review: a discarded draft leaves no edit log behind, even when an undo was queued");
  await run.context.close();
  return run.errors;
}


const seedCustom = async (page, url) => {
  await page.evaluate(async () => {
    window.startOnboarding('first-run', { userInitiated: true, forceFresh: true });
    const Entry = window.RepForgeProgramEntry, active = window.__repforgeEntryState();
    let draft = Entry.selectRoute(Entry.createState({ draftId: 'review-custom', activeProgramRevisionAtStart: active.activeProgramRevisionAtStart, now: new Date().toISOString(), versions: window.RepForgeProgramEntryAdapter.currentVersions(window.RepForgeProgramCompiler) }), 'custom');
    draft = Entry.setAnswers(draft, { desiredResult: 'balanced', structuredExperience: 'over_24m', daysPerWeek: 4, sessionMinutes: 60, environment: { kind: 'everything' }, primaryMuscles: [], deEmphasizedMuscles: [], ignoredMuscles: [], mustHaveExercises: [], exerciseConstraints: [], block: { cycles: 7, periodization: 'static' }, deload: true });
    return window.__repforgePersistSetupDraft({ ...draft, step: 'exercise_preferences' });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAppBoot(page, { base: url });
  await page.click('#firstRunCreate');
  await page.click('#entryResumeContinue');
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === 'exercise_preferences');
  for (let i = 0; i < 4 && (await entry(page)).step !== 'result'; i++) {
    const before = (await entry(page)).step;
    await continueReviewRebuild(page);
    await page.waitForFunction((b) => window.__repforgeEntryState()?.step !== b, before);
  }
  await page.locator('#entryReview [data-review-slot]').first().waitFor();
  await settleQueuedReviewWrites(page);
};

// Reuse the review-3 failure and abandoned-Custom journeys with the production write lock.
async function beginAnswerRebuild(page) {
  await page.evaluate(() => { window.__heldReviewWorker.hold = true; });
  const n = await page.evaluate(() => window.__heldReviewWorker.requests.length);
  await page.click('[data-entry-chip="days"]');
  await page.locator('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]').click();
  await page.click("#entryChipApply");
  await page.click("#reviewConfirmGo");
  await page.waitForFunction(n => window.__heldReviewWorker.requests.length > n, n);
}
async function failAnswerRebuild(page) {
  await page.evaluate(() => {
    const item = window.__heldReviewWorker.requests.findLast(item => !item.sent);
    item.sent = true;
    item.worker.onmessage({ data: { id: item.message.id, ok: false, message: "injected generation failure" } });
    window.__heldReviewWorker.hold = false;
  });
  await page.waitForFunction(() => !document.querySelector("#entryCandidateReview[aria-busy]"));
  await page.click("#entryChipKeep");
}
async function returnToCustomReview(page) {
  await page.click("#onbBack");
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState()?.step !== "result");
  await continueReviewRebuild(page);
  await page.locator("#entryReview [data-review-slot]").first().waitFor();
}
const releaseAnswerRebuild = page => page.evaluate(() => {
  window.__heldReviewWorker.hold = false;
  window.__heldReviewWorker.releaseAll();
});
const reviewActions = page => page.evaluate(() => window.__reviewActions);
const setCount = (definition, id) => slotsOf(definition).find(slot => slot.id === id).prescriptionsByCycle[0].sets.length;
async function removeReviewSlot(page, id, { queued = false } = {}) {
  await openSlot(page, id);
  await page.locator("#reviewSheet [data-review-remove]").click();
  if (!queued) {
    await page.locator("#reviewSheet").waitFor({ state: "hidden" });
    await page.waitForFunction(id => !window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap(day => day.slots || []).some(slot => slot.id === id), id);
  }
}
async function replayMatchesSaved(page, baseline) {
  const replayed = Review.replay(baseline, (await reviewLog(page))?.edits || [], REVIEW_CTX);
  return replayed.ok && JSON.stringify(replayed.definition) === JSON.stringify(await reviewed(page));
}

async function revisionF21(browser) {
  const run = await fresh(browser, { fakeWorker: true }), { page } = run;
  await seedCustom(page, BASE);
  const baseline = await reviewed(page), a = trainingDays(baseline)[0].slots[0];
  await openSlot(page, a.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await settleQueuedReviewWrites(page);
  await closeSheet(page);
  const count = setCount(await reviewed(page), a.id);
  check((await reviewActions(page)).filter(action => action.action === "edit").length === 1,
    "F21: the initial landed edit is observed before rebuilding");
  await beginAnswerRebuild(page);
  await returnToCustomReview(page);
  check(await page.locator("#entryCandidateReview").getAttribute("aria-busy") !== "true", "F21: returned Custom candidate is editable");
  await openSlot(page, a.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await settleQueuedReviewWrites(page);
  check(setCount(await reviewed(page), a.id) === count + 1,
    "F21: a fresh edit lands before the obsolete worker responds");
  check((await reviewLog(page))?.edits?.length === 2 && await replayMatchesSaved(page, baseline),
    "F21: the fresh edit is logged and replay equals the saved candidate");
  check((await reviewActions(page)).filter(action => action.action === "edit").length === 2,
    "F21: each landed edit is observed once while the obsolete response is pending");
  await closeSheet(page);
  await releaseAnswerRebuild(page);
  await settleQueuedReviewWrites(page);
  await openSlot(page, a.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await settleQueuedReviewWrites(page);
  check(setCount(await reviewed(page), a.id) === count + 2 && await replayMatchesSaved(page, baseline),
    "F21: the obsolete response cannot erase fresh work or stop the next edit");
  await run.context.close();
  return run.errors;
}

async function revisionF19(browser) {
  const errors = [];
  for (const mode of ["failure", "abandoned"]) {
    const run = await fresh(browser, { fakeWorker: true }), { page } = run;
    if (mode === "abandoned") await seedCustom(page, BASE); else await answerGenerate(page);
    await page.locator("#entryReview [data-review-slot]").first().waitFor();
    const baseline = await reviewed(page), [, b, c] = trainingDays(baseline)[0].slots;
    await holdSetupWrites(page);
    await removeReviewSlot(page, b.id);
    await beginAnswerRebuild(page);
    if (mode === "failure") await failAnswerRebuild(page);
    else { await returnToCustomReview(page); await releaseAnswerRebuild(page); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve))); }
    await removeReviewSlot(page, c.id, { queued: true });
    await releaseSetupWrites(page);
    await page.locator("#reviewSheet").waitFor({ state: "hidden" });
    await settleQueuedReviewWrites(page);
    check((await reviewLog(page))?.edits?.length === 2 && await replayMatchesSaved(page, baseline),
      `F19: ${mode} rebuild keeps both removals in one replayable queue`, await reviewLog(page));
    const saved = await reviewed(page);
    const durable = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")).state.result.preview.programDefinition);
    check(JSON.stringify(durable) === JSON.stringify(saved), `F19: ${mode} rebuild persists the reviewed definition`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    await page.click("#firstRunResumeSetup");
    await page.locator("#entryReview [data-review-slot]").first().waitFor();
    check((await reviewLog(page))?.edits?.length === 2 && await replayMatchesSaved(page, baseline),
      `F19: ${mode} rebuild preserves Undo history across reload`);
    await page.locator("#entryReview [data-review-undo]").click();
    await settleQueuedReviewWrites(page);
    const expected = Review.replay(baseline, [{ kind: "remove", slotId: b.id }], REVIEW_CTX);
    check(expected.ok && JSON.stringify(expected.definition) === JSON.stringify(await reviewed(page)),
      `F19: ${mode} rebuild Undo reverses only the last removal`);
    errors.push(...run.errors);
    await run.context.close();
  }
  return errors;
}

async function revisionF20(browser) {
  const errors = [];
  for (const mode of ["failure", "abandoned"]) {
    const run = await fresh(browser, { fakeWorker: true }), { page } = run;
    if (mode === "abandoned") await seedCustom(page, BASE); else await answerGenerate(page);
    await page.locator("#entryReview [data-review-slot]").first().waitFor();
    const baseline = await reviewed(page), [, b, c] = trainingDays(baseline)[0].slots;
    await holdSetupWrites(page);
    await removeReviewSlot(page, b.id);
    await beginAnswerRebuild(page);
    await releaseSetupWrites(page);
    await settleQueuedReviewWrites(page);
    if (mode === "failure") await failAnswerRebuild(page);
    else { await returnToCustomReview(page); await releaseAnswerRebuild(page); await settleQueuedReviewWrites(page); }
    check(!slotsOf(await reviewed(page)).some(slot => slot.id === b.id) && await replayMatchesSaved(page, baseline),
      `F20: ${mode} rebuild retains the durable removal and its log`);
    check((await reviewActions(page)).filter(action => action.action === "edit" && action.kind === "remove").length === 1,
      `F20: ${mode} rebuild observes the started write exactly once after it lands`, await reviewActions(page));
    await removeReviewSlot(page, c.id);
    await settleQueuedReviewWrites(page);
    check((await reviewActions(page)).filter(action => action.action === "edit" && action.kind === "remove").length === 2,
      `F20: ${mode} rebuild observes both surviving removals once`, await reviewActions(page));
    errors.push(...run.errors);
    await run.context.close();
  }
  return errors;
}

async function revisionF22(browser) {
  const run = await fresh(browser), { page } = run;
  await answerGenerate(page);
  await page.locator("#entryReview [data-review-slot]").first().waitFor();
  const baseline = await reviewed(page), [a, b, c] = trainingDays(baseline)[0].slots;
  const session = { baseline, log: [] };
  await openSlot(page, a.id);
  await step(page, session, { kind: "sets", slotId: a.id, count: setCount(baseline, a.id) + 1 },
    () => page.locator('#reviewSheet [data-review-sets="1"]').click(), "F22 N0 adds a set to A");
  await closeSheet(page);
  await step(page, session, { kind: "remove", slotId: b.id },
    () => removeReviewSlot(page, b.id), "F22 N0 removes B");
  session.log.pop();
  await step(page, session, null, () => page.locator("#entryReview [data-review-undo]").click(),
    "F22 N0 Undo restores B and keeps the set edit");
  await step(page, session, { kind: "remove", slotId: c.id },
    () => removeReviewSlot(page, c.id), "F22 N0 removes C");
  check(await page.locator(".review-toast [data-review-toast-undo]").isVisible(),
    "F22: the completed removal exposes its actionable Undo before Restore");
  await queueReviewRestore(page);
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]") &&
    window.__reviewActions.some(action => action.action === "restore"));
  const durable = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")).state.result.preview.programDefinition);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline) &&
    JSON.stringify(durable) === JSON.stringify(baseline) && !(await reviewLog(page))?.edits?.length,
    "F22: completed Restore agrees with the recommendation, durable draft and empty edit log");
  check(await page.locator("[data-review-toast-undo]:visible, #entryReview [data-review-undo]:visible").count() === 0,
    "F22: completed Restore leaves no actionable Undo", await reviewToasts(page));
  await run.context.close();
  return run.errors;
}

async function continueReviewRebuild(page) {
  const previous = (await entry(page)).step;
  await page.click("#onbNext");
  await page.waitForFunction(step => window.__repforgeEntryState().step !== step ||
    !!document.querySelector("#reviewConfirmGo")?.getClientRects().length, previous);
  if (await page.locator("#reviewConfirmGo").isVisible()) await page.click("#reviewConfirmGo");
}

async function backNextAsksBeforeDiscard(browser) {
  const run = await fresh(browser, { fakeWorker: true }), { page } = run;
  await answerGenerate(page);
  await page.locator("#entryReview [data-review-slot]").first().waitFor();
  const baseline = await reviewed(page), a = trainingDays(baseline)[0].slots[0];
  await openSlot(page, a.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"));
  await closeSheet(page);
  const edited = await reviewed(page), log = await reviewLog(page);
  await page.click("#onbBack");
  const previous = (await entry(page)).step;
  await page.click("#onbNext");
  const asked = await page.locator("#reviewConfirmGo").waitFor({ timeout: 3000 }).then(() => true, () => false);
  check(asked && (await entry(page)).step === previous,
    "#679: Back then Next asks before discarding landed edits");
  if (asked) {
    await page.keyboard.press("Escape");
    check(JSON.stringify(await reviewed(page)) === JSON.stringify(edited) &&
      JSON.stringify(await reviewLog(page)) === JSON.stringify(log), "#679: Keep preserves the saved edit and its log");
    await page.click("#onbNext");
    await page.click("#reviewConfirmGo");
    await page.waitForFunction(() => window.__repforgeEntryState().step === "result");
    await page.locator("#entryReview [data-review-slot]").first().waitFor();
    check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline) && !await reviewLog(page),
      "#679: confirming rebuild replaces the edits and clears their log");
  }
  await run.context.close();
  return run.errors;
}

const failNextReviewWrite = page => page.evaluate(() => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === "repforge_program_setup_draft_v1") {
      Storage.prototype.setItem = original;
      throw new DOMException("injected quota failure", "QuotaExceededError");
    }
    return original.call(this, key, value);
  };
});
async function failedReviewWriteRepaints(browser) {
  const run = await fresh(browser, { fakeWorker: true }), { page } = run;
  await answerGenerate(page);
  await page.locator("#entryReview [data-review-slot]").first().waitFor();
  const baseline = await reviewed(page), b = trainingDays(baseline)[0].slots[1];
  await openSlot(page, b.id);
  await failNextReviewWrite(page);
  await page.locator("#reviewSheet [data-review-remove]").click();
  await page.waitForFunction(() => window.__reviewActions.some(action => action.action === "save_failed"));
  await settleQueuedReviewWrites(page);
  const durable = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")).state.result.preview.programDefinition);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline) && JSON.stringify(durable) === JSON.stringify(baseline),
    "#677: failed removal keeps the saved recommendation");
  await checkReviewScreen(page, baseline, "#677");
  check(await page.locator(`#entryReview [data-review-slot="${b.id}"]`).count() === 1,
    "#677: the failed removal's row is restored on screen");
  await run.context.close();
  return run.errors;
}
async function failedReviewWriteAfterRemount(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, a } = run;
  await remountQueuedReview(page);
  await failNextReviewWrite(page);
  await releaseSetupWrites(page);
  await page.waitForFunction(() => window.__reviewActions.some(action => action.action === "save_failed"));
  await settleQueuedReviewWrites(page);
  const expected = Review.replay(baseline, [{ kind: "sets", slotId: a.id, count: setCount(baseline, a.id) + 1 }], REVIEW_CTX);
  const durable = await page.evaluate(() => JSON.parse(localStorage.getItem("repforge_program_setup_draft_v1")).state.result.preview.programDefinition);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(expected.definition) &&
    JSON.stringify(durable) === JSON.stringify(expected.definition),
    "#677: Cancel and stay cannot save an edit whose own write failed");
  await checkReviewScreen(page, baseline, "#677 remount");
  await run.context.close();
  return run.errors;
}
async function activateQueuedUndo(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, a, b } = run;
  await page.locator("#entryReview [data-review-undo]").click();
  await page.click("#entryActivate");
  await releaseSetupWrites(page);
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state().programMeta.onboarded === true);
  await settleQueuedReviewWrites(page);
  const active = (await state(page)).programMeta.programDefinition;
  const expected = Review.replay(baseline, [{ kind: "sets", slotId: a.id, count: setCount(baseline, a.id) + 1 }], REVIEW_CTX);
  check(JSON.stringify(active) === JSON.stringify(expected.definition) && slotsOf(active).some(slot => slot.id === b.id),
    "#678: Activate includes the queued Undo and retains the earlier edit");
  check(await page.evaluate(() => localStorage.getItem("repforge_program_setup_draft_v1") === null) && !await reviewLog(page),
    "#678: Activate leaves no setup draft or edit log after queued work settles");
  await run.context.close();
  return run.errors;
}
async function failedEditQueuedUndo(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, a } = run;
  await page.locator("#entryReview [data-review-undo]").click();
  await failNextReviewWrite(page);
  await releaseSetupWrites(page);
  await page.waitForFunction(() => window.__reviewActions.some(action => action.action === "save_failed"));
  await settleQueuedReviewWrites(page);
  const expected = Review.replay(baseline, [{ kind: "sets", slotId: a.id, count: setCount(baseline, a.id) + 1 }], REVIEW_CTX);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(expected.definition),
    "F15: Undo queued for a failed edit preserves the earlier landed edit");
  check(!(await reviewActions(page)).some(action => action.action === "undo"),
    "F15: a failed edit's queued Undo does not report undoing an earlier edit");
  await checkReviewScreen(page, baseline, "F15");
  await page.locator("#entryReview [data-review-undo]").click();
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"));
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(baseline),
    "F15: a fresh Undo after failure still reverses the earlier landed edit");
  await run.context.close();
  return run.errors;
}
async function queuedStepperTaps(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, c } = run;
  await openSlot(page, c.id);
  await page.locator('#reviewSheet [data-review-sets="1"]').click({ clickCount: 2 });
  await closeSheet(page);
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  const count = setCount(baseline, c.id);
  check(setCount(await reviewed(page), c.id) === count + 2,
    "F16: two queued stepper taps add two sets");
  const edits = (await reviewLog(page)).edits;
  check(edits.at(-2)?.count === count + 1 && edits.at(-1)?.count === count + 2,
    "F16: each tap records a separate change in the replay log", edits);
  await page.locator("#entryReview [data-review-undo]").click();
  await page.waitForFunction(() => !document.querySelector("#entryReview[aria-busy]"));
  check(setCount(await reviewed(page), c.id) === count + 1, "F16: one Undo reverses only the last stepper tap");
  await run.context.close();
  return run.errors;
}
async function remountedQueueBusy(browser) {
  const run = await queuedReviewSetup(browser), { page } = run;
  await remountQueuedReview(page);
  check(await page.locator("#entryReview").getAttribute("aria-busy") === "true",
    "F17: the remounted review exposes the candidate's pending work");
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  check(await page.locator("#entryReview").getAttribute("aria-busy") === null,
    "F17: the remounted review stops reporting busy when its queue drains");
  await run.context.close();
  return run.errors;
}

async function undoAfterFailedRename(browser) {
  const run = await queuedReviewSetup(browser), { page, baseline, a } = run;
  await page.locator("#entryReview [data-review-title]").click();
  await page.fill("#reviewRenameInput", "Unsaved rename");
  await page.locator("#reviewSheet [data-review-rename-save]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden" });
  await page.locator("#entryReview [data-review-undo]").click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "repforge_program_setup_draft_v1" && JSON.parse(value).state.result.name === "Unsaved rename") {
        Storage.prototype.setItem = original;
        throw new DOMException("injected rename failure", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await releaseSetupWrites(page);
  await settleQueuedReviewWrites(page);
  const expected = Review.replay(baseline, [{ kind: "sets", slotId: a.id, count: setCount(baseline, a.id) + 1 }], REVIEW_CTX);
  check(JSON.stringify(await reviewed(page)) === JSON.stringify(expected.definition),
    "F15 control: a failed rename does not suppress Undo of the preceding logged edit");
  await checkReviewScreen(page, baseline, "F15 rename control");
  await run.context.close();
  return run.errors;
}

const lifetimeCases = { F15control: undoAfterFailedRename, X677: async browser => [...await failedReviewWriteRepaints(browser), ...await failedReviewWriteAfterRemount(browser)], X678: activateQueuedUndo, F15: failedEditQueuedUndo, F16: queuedStepperTaps, F17: remountedQueueBusy, X679: backNextAsksBeforeDiscard, F22: revisionF22, F20: revisionF20, F19: revisionF19, F21: revisionF21, F1: restoreDoesNotCrossCandidate, F2: restoreQuestionDoesNotCrossCandidate,
  F3: renameDoesNotCrossCandidate, F4: sameCandidateEditsAcrossRemount, F5: undoAfterLeaving,
  F6: sameCandidateCommitRepaintsRemount, F7: revisionF7, F8: revisionF8, F9: revisionF9,
  F10: revisionF10, F11: revisionF11, F12: revisionF12, F13: revisionF13, F14: revisionF14,
  replacement: editAcrossRemount, discard: discardAfterQueuedUndo };
async function main() {
  const browser = await launchChromium(), errors = [];
  try {
    const selected = process.env.N14_ONLY ? process.env.N14_ONLY.split(",") : Object.keys(lifetimeCases);
    for (const id of selected) {
      if (!lifetimeCases[id]) throw new Error(`Unknown lifetime proof: ${id}`);
      console.log(`Review lifetime: ${id}`);
      errors.push(...await lifetimeCases[id](browser));
    }
    check(errors.length === 0, "no page errors during review lifetime proofs", errors);
  } catch (error) {
    failures.push(String(error?.stack || error));
    console.error(error?.stack || error);
  } finally { await browser.close(); }
  console.log(`Review lifetime: ${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exitCode = 1;
}
await main();
