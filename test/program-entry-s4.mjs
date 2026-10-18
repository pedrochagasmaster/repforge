#!/usr/bin/env node
/** Packet 1.3 production journey: review deload edit → activation → Today/Focus. */
import assert from "node:assert/strict";
import {installBrowserTraining} from "./training-browser.mjs";
import { answerRecommend, launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const START = new Date("2026-09-01T12:00:00.000Z");
const state = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.state());
const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());

async function editFirstSlotToSixSets(page, slotId) {
  const dayIndex = await page.evaluate((id) => window.__repforgeEntryState().result.preview.programDefinition.days
    .findIndex((day) => day.slots.some((slot) => slot.id === id)), slotId);
  assert.ok(dayIndex >= 0, "the edited slot belongs to the current recommendation");
  await page.locator(`#entryReview [data-review-tab="${dayIndex}"]`).click();
  await page.locator(`#entryReview [data-review-slot="${slotId}"]`).click();
  await page.locator("#reviewSheet.is-open [data-review-sets]").first().waitFor({ state: "visible", timeout: 5000 });
  const locale = await page.locator("html").getAttribute("lang");
  const expectedDeloadNote = locale?.toLowerCase().startsWith("pt")
    ? "Uma semana mais leve, com menos séries e mais repetições em reserva."
    : "A lighter week with fewer sets and more reps in reserve.";
  assert.equal((await page.locator("#reviewSheet .review-sheet__note").innerText()).trim(), expectedDeloadNote,
    "the exercise sheet explains the compiler's deload rule with approved copy");
  for (;;) {
    const count = await page.evaluate((id) => window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id).prescriptionsByCycle[0].sets.length, slotId);
    if (count === 6) break;
    const direction = count < 6 ? 1 : -1;
    await page.locator(`#reviewSheet [data-review-sets="${direction}"]`).click();
    await page.waitForFunction(({ id, want }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id)?.prescriptionsByCycle[0]?.sets.length === want,
    { id: slotId, want: count + direction }, { timeout: 10000 });
  }
}

async function installOfferWorkerHarness(page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const harness = { hold: false, nextWorkerId: 0, held: [], requests: [], released: [], terminated: [], releaseOne(workerId, id) {
      const index = this.held.findIndex((item) => item.workerId === workerId && item.id === id);
      if (index < 0) return false;
      const [item] = this.held.splice(index, 1);
      this.released.push({ workerId: item.workerId, id: item.id });
      item.handler.call(item.worker, item.event);
      return true;
    }, releaseHeld() {
      const pending = this.held.splice(0);
      for (const item of pending) {
        this.released.push({ workerId: item.workerId, id: item.id });
        item.handler.call(item.worker, item.event);
      }
      return pending.length;
    } };
    class ObservedWorker extends NativeWorker {
      constructor(...args) { super(...args); this.requestsById = new Map(); this.harnessWorkerId = ++harness.nextWorkerId; }
      terminate() { harness.terminated.push(this.harnessWorkerId); return super.terminate(); }
      postMessage(message, transfer) {
        if (message?.type === "generate") {
          this.requestsById.set(message.id, message);
          const state = window.__repforgeEntryState?.();
          harness.requests.push({ workerId: this.harnessWorkerId, id: message.id, request: message.request,
            draftId: state?.draftId || null, step: state?.step || null, resultFingerprint: state?.result?.fingerprint || null,
            answersFingerprint: state?.result?.answersFingerprint || null });
        }
        super.postMessage(message, transfer);
      }
      set onmessage(handler) {
        super.onmessage = event => {
          const request = this.requestsById.get(event.data?.id);
          if (harness.hold && request?.type === "generate" &&
            Object.keys(request.request?.movementConfirmations || {}).length) {
            const requestRecord = harness.requests.find((item) => item.workerId === this.harnessWorkerId && item.id === event.data.id);
            const current = window.__repforgeEntryState?.();
            harness.held.push({ worker: this, workerId: this.harnessWorkerId, id: event.data.id,
              handler, event, request, requestResultFingerprint: requestRecord?.resultFingerprint || null,
              requestAnswersFingerprint: requestRecord?.answersFingerprint || null,
              requestDraftId: requestRecord?.draftId || null, requestStep: requestRecord?.step || null,
              responseResultFingerprint: current?.result?.fingerprint || null });
            return;
          }
          handler.call(this, event);
        };
      }
      get onmessage() { return null; }
    }
    Object.defineProperty(window, "__repforgeOfferWorkerHarness", { configurable: true, value: harness });
    window.Worker = ObservedWorker;
  });
}

async function resumeEntryReview(page) {
  await page.waitForSelector("#entryReview [data-review-slot], #entryResumeContinue, #firstRunCreate", { timeout: 15000 });
  if (!await page.locator("#entryReview [data-review-slot]").count()) {
    if (!await page.locator("#entryResumeContinue").count()) await page.click("#firstRunCreate");
    await page.click("#entryResumeContinue");
  }
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 15000 });
}

async function findAmbiguousPerSideMovement(page) {
  return page.evaluate(() => {
    const catalog = window.__repforgeTrainingTest.catalog;
    const metrics = window.__repforgeTrainingTest.metrics;
    const current = window.__repforgeEntryState().result.preview.programDefinition;
    const used = new Set(current.days.flatMap((day) => day.slots || []).map((slot) => slot.exerciseId));
    const supportedPerSide = [["repsPerSide", "loadPerSideKg"], ["persistentLoadPerSideKg", "repsPerSide"]];
    return catalog.exercises.find((exercise) => {
      if (used.has(exercise.id)) return false;
      const definitions = metrics.definitionsForIds(exercise.exerciseMetrics || []);
      if (!definitions.ok || !supportedPerSide.some((semantics) =>
        JSON.stringify(definitions.value.map((metric) => metric.semantic)) === JSON.stringify(semantics)) ||
        !Number.isFinite(exercise.bodyweight)) return false;
      const sides = (exercise.laterality || []).map((id) => catalog.uuidIndex[id]?.name);
      const unilateral = sides.includes("Unilateral"), bilateral = sides.includes("Bilateral");
      const executionMode = unilateral && bilateral ? null : unilateral ? "unilateral" : bilateral ? "bilateral" : null;
      return executionMode === null;
    }) || null;
  });
}

async function fallbackOfferFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.addInitScript(() => { delete window.Worker; });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await installBrowserTraining(page);
  await page.evaluate(() => {
    window.__s4FallbackEvents = [];
    const record = () => {
      const current = window.__repforgeEntryState?.();
      if (current?.step === "result" && document.querySelector("#entryReview [data-review-slot]") &&
        !window.__s4FallbackEvents.includes("result")) window.__s4FallbackEvents.push("result");
      if (document.querySelector("#entryReview [data-review-confirm-offer]") &&
        !window.__s4FallbackEvents.includes("offer")) window.__s4FallbackEvents.push("offer");
    };
    window.__s4FallbackObserver = new MutationObserver(record);
    window.__s4FallbackObserver.observe(document.querySelector("#onbBody"), { subtree: true, childList: true, attributes: true });
  });
  await page.click("#firstRunCreate");
  await answerRecommend(page, { skipBasics: true });
  await page.locator("#entryReview [data-review-confirm-offer-action]").first().waitFor({ state: "visible", timeout: 15000 });
  const fallback = await page.evaluate(() => ({
    mode: window.__repforgeProgramEngine.stats().mode,
    events: window.__s4FallbackEvents,
    result: window.__repforgeEntryState()?.step,
  }));
  assert.equal(fallback.mode, "main", "without Worker, the same program engine honestly reports main-thread fallback");
  assert.equal(fallback.result, "result", "the fallback publishes the main recommendation before offer verification");
  assert.ok(fallback.events.indexOf("result") >= 0 && fallback.events.indexOf("offer") > fallback.events.indexOf("result"),
    `the no-Worker journey renders its usable result before attaching an offer (${JSON.stringify(fallback.events)})`);
  assert.deepEqual(errors, [], "the no-Worker offer fallback has no page errors");
  await context.close();
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "UTC" });
  const page = await context.newPage();
  await installOfferWorkerHarness(page);
  await page.clock.setFixedTime(START);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await installBrowserTraining(page);
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active #entryHeading", { timeout: 10000 });
  await answerRecommend(page, { skipBasics: true });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 15000 });

  const initial = await entry(page);
  const firstDay = initial.result.preview.programDefinition.days.find((day) => day.kind === "training");
  let firstSlot = firstDay.slots[0];
  const offerProbe = await page.evaluate(async () => {
    const current = window.__repforgeEntryState();
    const mapped = window.__repforgeTrainingTest.entryAdapter.programRequestFromAnswers(
      current.answers, window.__repforgeTrainingTest.catalog);
    if (!mapped.ok) return { ok: false, conflicts: mapped.conflicts, offers: [] };
    const generated = await window.__repforgeProgramEngine.generate(mapped.value);
    return { ok: generated.ok, offers: generated.confirmationOffers || [] };
  });
  assert.equal(offerProbe.ok, true, "the production Worker can regenerate the displayed recommendation");
  assert.ok(offerProbe.offers.length > 0, "this skipped-abilities recommendation has a deterministic confirmation offer");
  await page.locator("#entryReview [data-review-confirm-offer-action]").first().waitFor({ state: "visible", timeout: 15000 });
  assert.ok(await page.locator("#entryReview [data-review-confirm-offer]").count() > 0,
    "the production result shows a verified inline offer beneath its exercise row");
  const offerTarget = await page.locator("#entryReview [data-review-confirm-offer-action]").first().evaluate((button) => {
    const row = button.closest("[data-review-confirm-offer]");
    return { slotId: button.dataset.reviewConfirmOfferAction, exerciseId: row?.dataset.reviewOfferExerciseId };
  });
  const offerPosition = initial.result.preview.programDefinition.days.flatMap((day, dayIndex) =>
    day.slots.map((slot, slotIndex) => ({ id: slot.id, dayIndex, slotIndex }))).find(({ id }) => id === offerTarget.slotId);
  const expectedOffer = offerProbe.offers.find((offer) => offer.slotId === offerTarget.slotId &&
    offer.offeredExerciseId === offerTarget.exerciseId);
  assert.ok(expectedOffer, "each shown offer came from this result's compiler report");
  const offerRebuildProbe = await page.evaluate(async ({ offer }) => {
    const current = window.__repforgeEntryState();
    const mapped = window.__repforgeTrainingTest.entryAdapter.programRequestFromAnswers(
      current.answers, window.__repforgeTrainingTest.catalog);
    if (!mapped.ok) return { ok: false, conflicts: mapped.conflicts };
    const request = { ...mapped.value, movementConfirmations: {
      ...(mapped.value.movementConfirmations || {}), [offer.offeredExerciseId]: [...offer.prerequisiteIds],
    } };
    const generated = await window.__repforgeProgramEngine.generate(request);
    if (!generated.ok) return { ok: false, conflicts: generated.conflicts };
    const before = current.result.preview.programDefinition.days.flatMap((day, dayIndex) =>
      day.slots.map((slot, slotIndex) => ({ slot, dayIndex, slotIndex })));
    return { ok: true, definition: generated.value,
      changedSlotIds: before.filter(({ slot, dayIndex, slotIndex }) =>
        generated.value.days[dayIndex]?.slots[slotIndex]?.exerciseId !== slot.exerciseId).map(({ slot }) => slot.id) };
  }, { offer: expectedOffer });
  assert.equal(offerRebuildProbe.ok, true, "the production Worker can compile the offer from the canonical confirmed request");
  const beforeOffer = await entry(page);
  const beforeOfferDefinition = beforeOffer.result.preview.programDefinition;
  const changedByOffer = new Set(offerRebuildProbe.changedSlotIds);
  const offerEditedSlot = beforeOfferDefinition.days.flatMap((day) => day.slots)
    .find((slot) => slot.id !== offerTarget.slotId && !changedByOffer.has(slot.id));
  assert.ok(offerEditedSlot, "the result has an unrelated row whose sets can be edited without changing the offered slot");
  const offerEditedSlotSetsBefore = offerEditedSlot.prescriptionsByCycle[0].sets.length;
  const unrelatedDayIndex = beforeOfferDefinition.days.findIndex((day) => day.slots.some((slot) => slot.id === offerEditedSlot.id));
  await page.locator(`#entryReview [data-review-tab="${unrelatedDayIndex}"]`).click();
  await page.locator(`#entryReview [data-review-slot="${offerEditedSlot.id}"]`).click();
  await page.locator("#reviewSheet.is-open [data-review-sets]").first().waitFor({ state: "visible", timeout: 5000 });
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await page.waitForFunction(({ slotId, want }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
    .flatMap((day) => day.slots).find((slot) => slot.id === slotId)?.prescriptionsByCycle[0]?.sets.length === want,
  { slotId: offerEditedSlot.id, want: offerEditedSlotSetsBefore + 1 }, { timeout: 10000 });
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.waitForFunction(() => !document.querySelector("#reviewSheet.is-open"), undefined, { timeout: 5000 });
  await page.locator(`#entryReview [data-review-tab="${offerPosition.dayIndex}"]`).click();
  const afterUnrelatedEdit = await entry(page);
  const editProbe = await page.evaluate(({ target, slotId }) => {
    const current = window.__repforgeEntryState();
    const slots = current.result.preview.programDefinition.days.flatMap((day) => day.slots);
    const visibleOffers = [...document.querySelectorAll("#entryReview [data-review-confirm-offer-action]")]
      .map((button) => button.dataset.reviewConfirmOfferAction);
    return { step: current.step, route: current.route, beforeFingerprint: target.fingerprint,
      afterFingerprint: current.result.fingerprint, beforeAnswersFingerprint: target.answersFingerprint,
      afterAnswersFingerprint: current.result.answersFingerprint, editedSlot: slotId,
      offeredSlotExercise: slots.find((slot) => slot.id === target.offerSlot)?.exerciseId,
      offeredExercise: target.offeredExercise, visibleOffers };
  }, { target: { fingerprint: beforeOffer.result.fingerprint,
    answersFingerprint: beforeOffer.result.answersFingerprint, offerSlot: offerTarget.slotId,
    offeredExercise: offerTarget.exerciseId }, slotId: offerEditedSlot.id });
  console.log("S4_OFFER_UNRELATED_EDIT_PROBE", JSON.stringify({
    setsBefore: offerEditedSlotSetsBefore, setsAfter: afterUnrelatedEdit.result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === offerEditedSlot.id)?.prescriptionsByCycle[0]?.sets.length,
    ...editProbe,
  }));
  assert.ok(await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).count() > 0,
    "an unrelated sets edit preserves a still-eligible verified offer on its unchanged slot");

  await page.locator(`#entryReview [data-review-slot="${offerTarget.slotId}"]`).click();
  await page.locator("#reviewSheet.is-open [data-review-sets]").first().waitFor({ state: "visible", timeout: 5000 });
  const swapButtons = page.locator("#reviewSheet [data-review-swap]");
  let swappedExerciseId;
  if (await swapButtons.count()) {
    swappedExerciseId = await swapButtons.first().getAttribute("data-review-swap");
    await swapButtons.first().click();
    await page.waitForFunction(({ slotId, exerciseId }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === slotId)?.exerciseId === exerciseId,
    { slotId: offerTarget.slotId, exerciseId: swappedExerciseId }, { timeout: 10000 });
    await page.locator("#reviewSheet [data-review-done]").click();
    await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  } else {
    await page.locator("#reviewSheet [data-review-search]").click();
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
    const replacement = page.locator("#exPickList .pickrow").first();
    await replacement.waitFor({ state: "visible", timeout: 5000 });
    swappedExerciseId = await replacement.getAttribute("data-pick");
    await replacement.click();
    await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
    await page.waitForFunction(({ slotId, exerciseId }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === slotId)?.exerciseId === exerciseId,
    { slotId: offerTarget.slotId, exerciseId: swappedExerciseId }, { timeout: 10000 });
  }
  assert.notEqual(swappedExerciseId, expectedOffer.currentExerciseId,
    "the ordinary swap changes the movement occupying the offered slot");
  assert.equal(await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).count(), 0,
    "a swapped offered slot no longer renders an invalid confirmation action");
  await page.locator("#entryReview [data-review-undo]").click();
  await page.waitForFunction(({ slotId, exerciseId }) => window.__repforgeEntryState()?.result?.preview?.programDefinition.days
    .flatMap((day) => day.slots).find((slot) => slot.id === slotId)?.exerciseId === exerciseId,
  { slotId: offerTarget.slotId, exerciseId: expectedOffer.currentExerciseId }, { timeout: 10000 });
  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).waitFor({ state: "visible", timeout: 10000 });
  const beforeGuard = await entry(page);
  const editedDefinition = beforeGuard.result.preview.programDefinition;
  assert.equal(editedDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === offerEditedSlot.id)
    .prescriptionsByCycle[0].sets.length, offerEditedSlotSetsBefore + 1,
  "undoing the target swap preserves the unrelated sets edit");

  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).click();
  await page.locator("#reviewConfirmGo").waitFor({ state: "visible", timeout: 5000 });
  const waitingToCancel = await entry(page);
  assert.deepEqual(waitingToCancel.result.preview.programDefinition, editedDefinition,
    "the offer first asks before replacing the lifter's Review edits");
  assert.equal(waitingToCancel.answers.movementConfirmations?.[offerTarget.exerciseId], undefined,
    "opening the discard guard does not commit the offered answer");
  await page.locator("#reviewConfirmKeep").click();
  await page.locator("#entryDialog").waitFor({ state: "hidden", timeout: 5000 });
  const afterGuardCancel = await entry(page);
  assert.deepEqual(afterGuardCancel.result.preview.programDefinition, editedDefinition,
    "canceling the rebuild guard preserves the exact edited Review definition");
  assert.deepEqual(afterGuardCancel.answers, beforeGuard.answers,
    "canceling the rebuild guard preserves all answers");
  assert.equal(afterGuardCancel.answers.movementConfirmations?.[offerTarget.exerciseId], undefined,
    "canceling the rebuild leaves the movement unconfirmed");
  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).waitFor({ state: "visible", timeout: 5000 });

  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).click();
  await page.locator("#reviewConfirmGo").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#reviewConfirmGo").click();
  await page.waitForFunction(({ dayIndex, slotIndex, exerciseId }) => {
    const current = window.__repforgeEntryState();
    const slot = current?.result?.preview?.programDefinition?.days[dayIndex]?.slots[slotIndex];
    return current?.answers?.movementConfirmations?.[exerciseId] && slot?.exerciseId === exerciseId;
  }, { ...offerPosition, exerciseId: offerTarget.exerciseId }, { timeout: 20000 });
  const afterOffer = await entry(page);
  assert.equal(Object.hasOwn(afterOffer.result.preview.programDefinition, "seed"), false,
    "the confirmed recommendation carries no caller seed");
  assert.deepEqual(afterOffer.answers.movementConfirmations[offerTarget.exerciseId], expectedOffer.prerequisiteIds,
    "confirming an offer stores only that movement's prerequisites in the answers");
  assert.deepEqual(afterOffer.result.preview.programDefinition, offerRebuildProbe.definition,
    "confirming an offer rebuilds from the compiler baseline, discarding the canceled Review edits");
  const changedOfferRows = await page.evaluate(({ before, target }) => {
    const current = window.__repforgeEntryState().result.preview.programDefinition;
    const positions = before.days.flatMap((day, dayIndex) => day.slots.map((slot, slotIndex) => ({ slot, dayIndex, slotIndex })));
    const changed = positions.filter(({ slot, dayIndex, slotIndex }) => current.days[dayIndex]?.slots[slotIndex]?.exerciseId !== slot.exerciseId)
      .map(({ dayIndex, slotIndex }) => current.days[dayIndex]?.slots[slotIndex]).filter(Boolean);
    const rowName = (slot) => {
      const rendered = document.querySelector(`#entryReview [data-review-slot="${CSS.escape(slot.id)}"] .review__name`)?.textContent.trim();
      const entry = window.RepForgeExercises.library.find((exercise) => exercise.id === slot.exerciseId);
      return rendered || slot.displayName || (document.documentElement.lang.startsWith("pt") && entry?.namePt) || entry?.name ||
        window.__repforgeEntryState().result.preview.program.find((row) => row.slotId === slot.id)?.name;
    };
    const names = changed.map(rowName).filter(Boolean);
    const unchanged = positions.filter(({ slot, dayIndex, slotIndex }) => current.days[dayIndex]?.slots[slotIndex]?.exerciseId === slot.exerciseId)
      .map(({ dayIndex, slotIndex }) => current.days[dayIndex]?.slots[slotIndex]).filter(Boolean);
    const unchangedNames = unchanged.map(rowName).filter(Boolean);
    return { changed: changed.map((slot) => slot.id), names, unchangedNames,
      announcedNames: document.querySelector("#entryChange[role='status'] .entry__change-line .visually-hidden")?.textContent.trim() || "",
      status: document.querySelector("#entryChange[role='status']")?.textContent || "" };
  }, { before: beforeOfferDefinition, target: offerTarget });
  const confirmedSlotId = afterOffer.result.preview.programDefinition.days[offerPosition.dayIndex].slots[offerPosition.slotIndex].id;
  assert.ok(changedOfferRows.changed.includes(confirmedSlotId), "the offered movement lands at its promised position");
  assert.ok(changedOfferRows.names.length > 0 && changedOfferRows.names.every((name) => changedOfferRows.status.includes(name)),
    "the polite change status names every row the confirmation moved");
  assert.ok(changedOfferRows.unchangedNames.length > 0, "this confirmation leaves actual exercise positions unchanged");
  assert.equal(changedOfferRows.announcedNames, changedOfferRows.names.join(", "),
    "the polite change status names only movements that changed at corresponding day/slot positions");
  await page.locator(`#entryReview [data-review-confirmed="${offerTarget.exerciseId}"]`).waitFor({ state: "visible", timeout: 5000 });
  assert.match(await page.locator(`#entryReview [data-review-slot="${confirmedSlotId}"] [data-review-mark]`).innerText(),
    /confirmed by you|confirmado por você/i, "the changed row is marked as confirmed by the lifter");
  await page.waitForFunction((exerciseId) =>
    document.activeElement?.dataset?.reviewConfirmationUndo === exerciseId,
  offerTarget.exerciseId, { timeout: 5000 });
  console.log("S4_OFFER_FOCUS_PROBE", JSON.stringify(await page.evaluate(() => ({
    activeUndoId: document.activeElement?.dataset?.reviewConfirmationUndo || null,
    resultFingerprint: window.__repforgeEntryState()?.result?.fingerprint || null,
  }))));
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.reviewConfirmationUndo), offerTarget.exerciseId,
    "confirming an offer moves focus to its Undo control");
  await page.locator(`#entryReview [data-review-confirmation-undo="${offerTarget.exerciseId}"]`).click();
  await page.waitForFunction((exerciseId) => !window.__repforgeEntryState()?.answers?.movementConfirmations?.[exerciseId],
    offerTarget.exerciseId, { timeout: 20000 });
  assert.deepEqual((await entry(page)).result.preview.programDefinition, beforeOfferDefinition,
    "Undo removes the answer confirmation and rebuilds the original recommendation");
  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).waitFor({ state: "visible", timeout: 15000 });
  await page.locator(`[data-review-confirm-offer-action="${offerTarget.slotId}"]`).click();
  await page.waitForFunction(({ dayIndex, slotIndex, exerciseId }) => {
    const current = window.__repforgeEntryState();
    const slot = current?.result?.preview?.programDefinition?.days[dayIndex]?.slots[slotIndex];
    return current?.answers?.movementConfirmations?.[exerciseId] && slot?.exerciseId === exerciseId;
  }, { ...offerPosition, exerciseId: offerTarget.exerciseId }, { timeout: 20000 });
  const confirmedBeforeReload = await entry(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await installBrowserTraining(page);
  await resumeEntryReview(page);
  await page.locator(`#entryReview [data-review-confirmed="${offerTarget.exerciseId}"]`).waitFor({ state: "visible", timeout: 15000 });
  const confirmedAfterReload = await entry(page);
  assert.deepEqual(confirmedAfterReload.result.preview.programDefinition, confirmedBeforeReload.result.preview.programDefinition,
    "the confirmed movement and regenerated program survive setup-draft reload");
  await page.evaluate(() => { window.__repforgeOfferWorkerHarness.hold = true; });
  await page.locator(`#entryReview [data-review-confirmation-undo="${offerTarget.exerciseId}"]`).click();
  await page.waitForFunction(({ exerciseId, previousFingerprint }) => {
    const current = window.__repforgeEntryState();
    return current?.step === "result" && !current.answers?.movementConfirmations?.[exerciseId] &&
      current.result?.fingerprint && current.result.fingerprint !== previousFingerprint;
  }, { exerciseId: offerTarget.exerciseId, previousFingerprint: confirmedAfterReload.result.fingerprint }, { timeout: 20000 });
  const undoResult = await entry(page);
  assert.deepEqual(undoResult.result.preview.programDefinition, beforeOfferDefinition,
    "Undo settles back to the canonical compiler baseline before its verifier is held");
  const undoIdentity = {
    resultFingerprint: undoResult.result.fingerprint,
    answersFingerprint: undoResult.result.answersFingerprint,
    draftId: undoResult.draftId,
  };
  await page.waitForFunction((identity) => {
    const harness = window.__repforgeOfferWorkerHarness;
    return harness?.held.some((held) => {
      const request = harness.requests.find((item) => item.workerId === held.workerId && item.id === held.id);
      return request?.step === "result" && request.resultFingerprint === identity.resultFingerprint &&
        request.answersFingerprint === identity.answersFingerprint && request.draftId === identity.draftId;
    }) || false;
  }, undoIdentity, { timeout: 15000 });
  const oldVerifier = await page.evaluate((identity) => {
    const harness = window.__repforgeOfferWorkerHarness;
    const held = harness.held.find((item) => {
      const request = harness.requests.find((candidate) => candidate.workerId === item.workerId && candidate.id === item.id);
      return request?.step === "result" && request.resultFingerprint === identity.resultFingerprint &&
        request.answersFingerprint === identity.answersFingerprint && request.draftId === identity.draftId;
    });
    return held && { workerId: held.workerId, id: held.id, resultFingerprint: held.requestResultFingerprint,
      answersFingerprint: held.requestAnswersFingerprint, responseResultFingerprint: held.responseResultFingerprint,
      draftMatchesOperation: held.requestDraftId === identity.draftId, step: held.requestStep };
  }, undoIdentity);
  assert.ok(oldVerifier, "the held Worker request belongs to the settled Undo result being left");
  assert.equal(oldVerifier.resultFingerprint, undoResult.result.fingerprint,
    "the held verifier's original request fingerprint matches the Undo result");
  assert.equal(oldVerifier.answersFingerprint, undoResult.result.answersFingerprint,
    "the held verifier's original request carries the Undo result's answer fingerprint");
  assert.equal(oldVerifier.draftMatchesOperation, true, "the held verifier belongs to the current draft operation");
  assert.equal(oldVerifier.step, "result", "the held verifier starts from the settled result screen");
  console.log("S4_OFFER_STALE_WORKER_PROBE", JSON.stringify({
    workerId: oldVerifier.workerId, requestId: oldVerifier.id,
    resultFingerprint: oldVerifier.resultFingerprint, answersFingerprint: oldVerifier.answersFingerprint,
    draftMatchesOperation: oldVerifier.draftMatchesOperation, responseResultFingerprint: oldVerifier.responseResultFingerprint,
  }));
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "abilities", undefined, { timeout: 5000 });
  await page.waitForFunction((workerId) => window.__repforgeOfferWorkerHarness?.terminated.includes(workerId),
    oldVerifier.workerId, { timeout: 5000 });
  await page.locator('[data-entry-pick="competencyAnswer"][data-entry-val="benchPress10|yes"]').click();
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined, { timeout: 20000 });
  const pendingOfferResult = await entry(page);
  assert.equal(pendingOfferResult.answers.competencyAnswers.benchPress10, true,
    "a changed answer produces a distinct current result while its offer checks are pending");
  assert.notEqual(pendingOfferResult.result.fingerprint, oldVerifier.resultFingerprint,
    "the current result has a different identity from the stale verifier");
  const foregroundRequest = await page.evaluate(({ oldVerifier }) => window.__repforgeOfferWorkerHarness.requests.find((item) =>
    item.step === "building" && item.workerId !== oldVerifier.workerId &&
    !Object.keys(item.request?.movementConfirmations || {}).length), { oldVerifier });
  assert.ok(foregroundRequest, "foreground Generate used its own Worker while the old verifier reply remained held");
  assert.equal(await page.locator("#entryReview [data-review-confirm-offer]").count(), 0,
    "an unverified offer is absent while the new result is already reviewable");
  const released = await page.evaluate(({ workerId, id }) =>
    window.__repforgeOfferWorkerHarness.releaseOne(workerId, id), oldVerifier);
  assert.equal(released, true, "the test released the held old-result Worker verification reply by request identity");
  assert.equal((await entry(page)).result.fingerprint, pendingOfferResult.result.fingerprint,
    "a late old verifier reply leaves the newer result current");
  assert.equal(await page.locator("#entryReview [data-review-confirm-offer]").count(), 0,
    "a stale verifier reply cannot attach its old offer to the current result");
  await page.evaluate(() => { window.__repforgeOfferWorkerHarness.hold = false; window.__repforgeOfferWorkerHarness.releaseHeld(); });
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "abilities", undefined, { timeout: 5000 });
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState()?.step === "result", undefined, { timeout: 20000 });
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ state: "visible", timeout: 15000 });

  firstSlot = (await entry(page)).result.preview.programDefinition.days.find((day) => day.kind === "training").slots[0];
  assert.equal(await page.locator("#entryReview [data-review-block-edit]").count(), 1,
    "the production review exposes the block row's Change action");
  await page.locator("#entryReview [data-review-block-edit]").click();
  await page.locator("#reviewSheet.is-open [data-review-block-weeks]").waitFor({ state: "visible", timeout: 5000 });
  const initialBlockSheet = await page.evaluate(() => ({
    title: document.querySelector("#reviewSheetTitle")?.textContent.trim(),
    weeks: document.querySelector("[data-review-block-weeks]")?.textContent.trim(),
    patternCount: document.querySelectorAll("#reviewSheet [data-review-block-pattern]").length,
    selectedPattern: document.querySelector("#reviewSheet [data-review-block-pattern][aria-checked='true']")?.dataset.reviewBlockPattern,
    deload: document.querySelector("#reviewSheet [data-review-block-deload]")?.getAttribute("aria-checked"),
  }));
  const expectedBlockTitle = await page.evaluate(() => window.RepForgeI18n.t("entry.review.block.sheet.title"));
  const expectedSevenWeeks = await page.evaluate(() => window.RepForgeI18n.t("entry.review.block.regular_weeks", { n: 7 }));
  assert.equal(initialBlockSheet.title, expectedBlockTitle, "the block sheet uses the approved title");
  assert.equal(initialBlockSheet.weeks, expectedSevenWeeks, "the block sheet defaults to seven weeks");
  assert.equal(initialBlockSheet.patternCount, 4, "all four approved rep patterns are available");
  assert.equal(initialBlockSheet.selectedPattern, "static", "the default pattern is static");
  assert.equal(initialBlockSheet.deload, "true", "the recommended deload switch starts on");
  await page.locator("#reviewSheet [data-review-block-deload]").click();
  assert.equal(await page.locator("#reviewSheet [data-review-block-deload]").getAttribute("aria-checked"), "false",
    "the deload switch can be turned off");
  await page.locator("#reviewSheet [data-review-block-deload]").click();
  await page.locator("#reviewSheet [data-review-sheet-close]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });

  await editFirstSlotToSixSets(page, firstSlot.id);
  const editedBeforeBlock = await entry(page);
  const editedBeforeSlot = editedBeforeBlock.result.preview.programDefinition.days.flatMap((day) => day.slots)
    .find((slot) => slot.id === firstSlot.id);
  assert.equal(editedBeforeSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the production review editor's six-set edit produces three sets in the deload cycle");
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });

  await page.locator("#entryReview [data-review-block-edit]").click();
  await page.locator("#reviewSheet.is-open [data-review-block-weeks]").waitFor({ state: "visible", timeout: 5000 });
  assert.equal(await page.locator('#reviewSheet [data-review-block-step]').count(), 0,
    "the recovered block keeps seven regular weeks without unsupported length controls");
  await page.locator('#reviewSheet [data-review-block-pattern="undulating"]').click();
  await page.locator("#reviewSheet [data-review-block-apply]").click();
  await page.waitForFunction(() => document.querySelector("#entryDialog")?.open === true,
    undefined, { timeout: 5000 });
  const heldForConfirmation = await page.evaluate((id) => {
    const current = window.__repforgeEntryState();
    const slot = current.result.preview.programDefinition.days.flatMap((day) => day.slots).find((item) => item.id === id);
    return { cycles: current.result.preview.programDefinition.cycles, sets: slot.prescriptionsByCycle[0].sets.length };
  }, firstSlot.id);
  assert.equal(heldForConfirmation.cycles, 8, "block answers do not change before the edit-discard confirmation");
  assert.equal(heldForConfirmation.sets, 6, "the existing review edit remains while confirmation is open");
  await page.locator("#reviewConfirmGo").click();
  await page.waitForFunction(() => window.__repforgeEntryState()?.result?.preview?.programDefinition?.cycles === 8 &&
    window.__repforgeEntryState()?.answers?.block?.periodization === "undulating" &&
    window.__repforgeEntryState()?.answers?.deload === true,
  undefined, { timeout: 20000 });
  const rebuilt = await entry(page);
  const canonicalRebuilt = await page.evaluate(() => {
    const current = window.__repforgeEntryState();
    const catalog = window.__repforgeTrainingTest.catalog;
    const mapped = window.__repforgeTrainingTest.entryAdapter.programRequestFromAnswers(current.answers, catalog);
    return mapped.ok ? window.__repforgeTrainingTest.compiler.generateProgram(mapped.value, catalog).value : null;
  });
  assert.deepEqual(rebuilt.result.preview.programDefinition, canonicalRebuilt,
    "the block edit commits the complete canonical program for its new answers");
  assert.deepEqual(rebuilt.result.preview.programDefinition.deloadCycles, [8], "deload moves to the new last week");
  assert.equal(rebuilt.result.preview.programDefinition.days.flatMap((day) => day.slots)[0]
    .prescriptionsByCycle[0].sets[0].provenance.periodization, "undulating", "the new rep pattern reaches the compiler output");

  firstSlot = rebuilt.result.preview.programDefinition.days.find((day) => day.kind === "training").slots[0];
  await editFirstSlotToSixSets(page, firstSlot.id);
  const edited = await entry(page);
  const editedSlot = edited.result.preview.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(editedSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the production review editor's six-set edit produces three sets in the deload cycle");

  await page.locator("#reviewSheet [data-review-done]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });
  const dayNamesForRename = await page.evaluate(() => {
    const definition = window.__repforgeEntryState().result.preview.programDefinition;
    return definition.days.map((day, index) => ({ index, id: day.id, kind: day.kind, stored: day.name,
      shown: document.querySelector(`#entryReview [data-review-tab="${index}"]`)?.textContent.trim() || null }))
      .filter((day) => day.kind === "training");
  });
  assert.ok(dayNamesForRename.length > 1, "the production recommendation has two training days to exercise duplicate refusal");
  const renameTarget = dayNamesForRename[0], renameSource = dayNamesForRename[1];
  const duplicateValues = [...new Set([renameSource.stored, renameSource.shown].filter(Boolean))];
  const originalReviewNames = (await entry(page)).result.preview.programDefinition.days.map((day) => day.name);
  const expectedDuplicateMessage = await page.evaluate(() => window.RepForgeI18n.t("toast.day_name_exists"));
  for (const duplicateValue of duplicateValues) {
    await page.locator(`#entryReview [data-review-tab="${renameTarget.index}"]`).click();
    await page.locator("#entryReview [data-review-day-menu]").click();
    await page.locator('#reviewSheet [data-review-day-action="rename"]').click();
    const renameInput = page.locator("#reviewSheet #reviewRenameInput");
    await renameInput.fill(duplicateValue);
    await page.locator("#reviewSheet [data-review-rename-save]").click();
    await page.waitForFunction(() => {
      const input = document.querySelector("#reviewSheet #reviewRenameInput");
      return input?.getAttribute("aria-invalid") === "true" || !document.querySelector("#reviewSheet")?.classList.contains("is-open");
    }, undefined, { timeout: 5000 });
    const refusedRename = await page.evaluate(() => {
      const sheet = document.querySelector("#reviewSheet");
      const input = sheet?.querySelector("#reviewRenameInput");
      const error = input?.getAttribute("aria-describedby") && document.getElementById(input.getAttribute("aria-describedby"));
      return { open: sheet?.classList.contains("is-open"), value: input?.value,
        invalid: input?.getAttribute("aria-invalid") || null, note: error?.textContent.trim() || null,
        role: error?.getAttribute("role") || null };
    });
    assert.deepEqual(refusedRename, { open: true, value: duplicateValue, invalid: "true",
      note: expectedDuplicateMessage, role: "alert" },
    `renaming to another day's ${duplicateValue === renameSource.stored ? "stored" : "shown"} name is refused on the field`);
    await renameInput.fill(renameTarget.shown);
    assert.deepEqual(await renameInput.evaluate((input) => ({ invalid: input.getAttribute("aria-invalid"), describedBy: input.getAttribute("aria-describedby") })),
      { invalid: null, describedBy: null }, "editing a refused day name clears its field error");
    await page.locator("#reviewSheet [data-review-rename-save]").click();
    await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });
    assert.deepEqual((await entry(page)).result.preview.programDefinition.days.map((day) => day.name), originalReviewNames,
      "restoring the current name is quiet and commits no review edit");
  }
  await page.locator(`#entryReview [data-review-tab="${renameTarget.index}"]`).click();
  await page.locator("#entryReview [data-review-day-menu]").click();
  await page.locator('#reviewSheet [data-review-day-action="rename"]').click();
  await page.locator("#reviewSheet #reviewRenameInput").fill("");
  await page.locator("#reviewSheet [data-review-rename-save]").click();
  await page.locator("#reviewSheet").waitFor({ state: "hidden", timeout: 5000 });
  assert.deepEqual((await entry(page)).result.preview.programDefinition.days.map((day) => day.name), originalReviewNames,
    "a blank day name is quiet and leaves the recommendation unchanged");

  const ambiguousMovement = await findAmbiguousPerSideMovement(page);
  assert.ok(ambiguousMovement, "the loaded production catalog has an unused ambiguous movement that records reps per side");
  await page.locator(`#entryReview [data-review-slot="${firstSlot.id}"]`).click();
  await page.locator("#reviewSheet [data-review-search]").click();
  await page.locator("#exPickSheet.is-open").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#exPickSearch").fill(ambiguousMovement.name);
  await page.locator(`[data-pick="${ambiguousMovement.id}"]`).waitFor({ state: "visible", timeout: 5000 });
  await page.locator(`[data-pick="${ambiguousMovement.id}"]`).click();
  await page.waitForFunction(({ slotId, exerciseId }) => {
    const slot = window.__repforgeEntryState()?.result?.preview?.programDefinition?.days
      .flatMap((day) => day.slots).find((item) => item.id === slotId);
    return slot?.exerciseId === exerciseId && !document.querySelector("#exPickSheet.is-open");
  }, { slotId: firstSlot.id, exerciseId: ambiguousMovement.id }, { timeout: 15000 });
  await page.locator(`#entryReview [data-review-slot="${firstSlot.id}"]`).click();
  const expectedExecutionLabels = await page.evaluate(() => {
    const pt = document.documentElement.lang.toLowerCase().startsWith("pt");
    return pt
      ? ["Como você faz este exercício?", "Os dois lados juntos", "Um lado de cada vez", "Precisa de ajuste"]
      : ["How do you do this exercise?", "Both sides together", "One side at a time", "Needs adjustment"];
  });
  const unresolvedExecution = await page.evaluate((slotId) => {
    const slot = window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((item) => item.id === slotId);
    const row = document.querySelector(`#entryReview [data-review-slot="${CSS.escape(slotId)}"]`);
    return {
      executionMode: slot.executionMode,
      semantics: [...new Set(slot.metricDefinitions.map((metric) => metric.semantic))],
      statuses: [...new Set(slot.prescriptionsByCycle.flatMap((cycle) => cycle.sets).map((set) => set.status))],
      question: document.querySelector("#reviewSheet [data-review-execution-question]")?.textContent.trim() || null,
      choices: [...document.querySelectorAll("#reviewSheet [data-review-execution-mode]")].map((button) => button.textContent.trim()),
      rowCue: row?.querySelector("[data-review-execution-cue]")?.textContent.trim() || null,
      rowAccessibleName: row?.getAttribute("aria-label") || null,
      rowName: row?.querySelector(".review__name")?.textContent.trim() || null,
    };
  }, firstSlot.id);
  assert.equal(unresolvedExecution.executionMode, null, "an ambiguous per-side catalog pick has no guessed mode");
  assert.ok(unresolvedExecution.semantics.includes("repsPerSide"), "the selected catalog movement records reps per side");
  assert.deepEqual(unresolvedExecution.statuses, ["configuration_required"],
    "an unanswered ambiguous per-side pick stays configuration-required");
  assert.equal(unresolvedExecution.question, expectedExecutionLabels[0], "the exercise sheet asks the approved question");
  assert.deepEqual(unresolvedExecution.choices, expectedExecutionLabels.slice(1, 3), "the exercise sheet offers both approved answers");
  assert.equal(unresolvedExecution.rowCue, expectedExecutionLabels[3], "the review row shows the owner-approved unresolved cue");
  assert.equal(unresolvedExecution.rowAccessibleName, `${unresolvedExecution.rowName} · ${expectedExecutionLabels[3]}`,
    "the review row announces the unresolved cue to assistive technology");
  const executionMode = "unilateral";
  await page.locator(`#reviewSheet [data-review-execution-mode="${executionMode}"]`).click();
  await page.waitForFunction(({ slotId, mode }) => {
    const slot = window.__repforgeEntryState()?.result?.preview?.programDefinition?.days
      .flatMap((day) => day.slots).find((item) => item.id === slotId);
    return slot?.executionMode === mode && slot.prescriptionsByCycle.every((cycle) =>
      cycle.sets.every((set) => set.status !== "configuration_required"));
  }, { slotId: firstSlot.id, mode: executionMode }, { timeout: 15000 });
  assert.equal(await page.locator(`#entryReview [data-review-slot="${firstSlot.id}"] [data-review-execution-cue]`).count(), 0,
    "the resolved review row clears its configuration cue");
  assert.equal((await entry(page)).result.preview.programDefinition.days.flatMap((day) => day.slots)
    .find((slot) => slot.id === firstSlot.id).executionMode, executionMode,
  "the review-sheet intent stores the selected execution mode on its slot");
  for (let attempts = 0; attempts < 7; attempts++) {
    const rir = await page.evaluate((id) => window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id).prescriptionsByCycle[0].sets[0].rir, firstSlot.id);
    if (rir === 6) break;
    await page.locator('#reviewSheet [data-review-rir="1:1"]').click();
    await page.waitForFunction(({ id, want }) => window.__repforgeEntryState().result.preview.programDefinition.days
      .flatMap((day) => day.slots).find((slot) => slot.id === id).prescriptionsByCycle[0].sets[0].rir === want,
    { id: firstSlot.id, want: (rir ?? 2) + 1 }, { timeout: 10000 });
  }
  assert.equal((await entry(page)).result.preview.programDefinition.days.flatMap((day) => day.slots)
    .find((slot) => slot.id === firstSlot.id).prescriptionsByCycle[0].sets[0].rir, 6,
    "Review accepts a six-RIR target on the actual edited source slot");
  await page.locator("#reviewSheet [data-review-done]").click();

  await page.locator("#entryActivate").click();
  await page.waitForFunction(() => window.__repforgeWorkoutDraft.state()?.programMeta?.onboarded === true,
    undefined, { timeout: 20000 });
  await page.evaluate(() => window.__repforgeStorage?.flush?.());
  const active = await state(page);
  const activeTrainingNames = active.programMeta.programDefinition.days.filter((day) => day.kind === "training").map((day) => day.name);
  assert.equal(new Set(activeTrainingNames).size, activeTrainingNames.length,
    "no duplicate stored day names reach the activated program");
  const activeSlot = active.programMeta.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(activeSlot.executionMode, executionMode, "activation carries the chosen execution mode");
  assert.equal(activeSlot.prescriptionsByCycle[0].sets[0].rir, 6, "activation preserves the six-RIR target");
  assert.equal(activeSlot.prescriptionsByCycle.at(-1).sets[0].rir, 6, "the activated recovery-week target remains six, without a four-RIR clamp");
  assert.equal(active.programMeta.programDefinition.cycles, 8, "activation retains the edited block length");
  assert.equal(active.programMeta.programDefinition.days.flatMap((day) => day.slots)[0]
    .prescriptionsByCycle[0].sets[0].provenance.periodization, "undulating", "activation retains the edited rep pattern");
  assert.equal(activeSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "activation retains the review editor's deload prescription");
  assert.deepEqual(active.programMeta.programDefinition.deloadCycles, [8], "the generated program has its last-week deload");
  const firstWeek = await page.evaluate(() => window.__repforgeMesocycleWeek());
  assert.deepEqual([firstWeek.current, firstWeek.total], [1, 8], "Today starts at week one of eight after activation");

  await page.clock.setFixedTime(new Date(START.getTime() + 49 * 24 * 60 * 60 * 1000));
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await installBrowserTraining(page);
  const reloaded = await state(page);
  assert.equal(reloaded.programMeta.programDefinition.cycles, 8, "the edited block length survives reload");
  const reloadedSlot = reloaded.programMeta.programDefinition.days.flatMap((day) => day.slots).find((slot) => slot.id === firstSlot.id);
  assert.equal(reloadedSlot.prescriptionsByCycle.at(-1).sets.length, 3,
    "the activated six-set edit survives the ordinary reload");
  assert.equal(reloadedSlot.prescriptionsByCycle[0].sets[0].rir, 6, "the six-RIR target survives the production save/load boundary");
  assert.equal(reloadedSlot.prescriptionsByCycle.at(-1).sets[0].rir, 6, "the recovery-week six-RIR target survives ordinary reload");
  assert.deepEqual(reloaded.programMeta.programDefinition.deloadCycles, [8],
    "the active program keeps its final deload cycle after reload");
  const today = await page.evaluate(() => ({
    block: window.__repforgeMesocycleWeek(),
    deload: [...document.querySelectorAll("#todayDash *")].some((node) =>
      node.children.length === 0 && node.textContent.trim() === window.RepForgeI18n.t("today.deload_week")),
    text: document.querySelector("#todayDash")?.innerText || "",
  }));
  assert.equal(today.block.current, 8, "Today is in the active program's final week");
  assert.equal(today.deload, true, "Today shows the approved deload-week line");

  await page.locator("#startWorkout").click();
  await page.locator("#workoutShell").waitFor({ state: "visible", timeout: 10000 });
  const focus = await page.evaluate(() => ({
    visible: getComputedStyle(document.querySelector("#woDaySub")).display !== "none" &&
      getComputedStyle(document.querySelector("#woDaySub")).visibility !== "hidden",
    text: document.querySelector("#woDaySub")?.textContent.trim() || "",
    expected: window.RepForgeI18n.t("today.deload_week"),
  }));
  assert.equal(focus.visible && focus.text.includes(focus.expected), true,
    "Focus shows the approved deload-week line in its visible header");
  assert.deepEqual(errors, [], "the production journey has no page errors");
  await context.close();
  await fallbackOfferFlow(browser);
} finally {
  await browser.close();
}

console.log("PASS P072-S4-BLOCK/DELOAD: guarded canonical rebuild, activation, Today and Focus");
