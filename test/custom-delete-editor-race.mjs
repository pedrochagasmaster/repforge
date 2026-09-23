#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DB = "repforge";
const STORE = "kv";

let passed = 0;
let failed = 0;
function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}`);
    if (detail !== undefined) console.error(`    ${JSON.stringify(detail)}`);
  }
}

async function waitForApp(page) {
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding.active")) window.closeOnboarding?.();
    if (!document.querySelector("#tour.hidden")) window.closeTour?.();
  });
}

async function reset(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.evaluate(async key => {
    localStorage.clear();
    await new Promise(resolve => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });
}

async function readReplicas(page) {
  return page.evaluate(async ({ key, dbName, storeName }) => {
    const local = JSON.parse(localStorage.getItem(key) || "null");
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const idb = await new Promise((resolve, reject) => {
      const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { local, idb };
  }, { key: KEY, dbName: DB, storeName: STORE });
}

async function seedCustom(page, name) {
  const result = await page.evaluate(async exerciseName => {
    const saved = await window.__repforgeSaveCustomExercise({
      name: exerciseName,
      equipment: ["machine"],
      primary: "Chest",
      secondary: "",
      notes: "F057-12 two-tab race fixture",
    });
    return { id: saved.entry?.id, committed: saved.result?.committed, settled: saved.result?.settled };
  }, name);
  if (!result.id || result.committed !== true || result.settled !== true)
    throw new Error(`Could not seed the custom exercise: ${JSON.stringify(result)}`);
  return result.id;
}

async function stageCustomReplacementInInstalledEditor(page, id, name) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"),
    undefined, { timeout: 5000 });
  if (await page.locator("#programEditorWrap.is-hidden").count())
    await page.click("#programEditToggle");
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 5000 });

  const slot = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = state.program?.find(item => !String(item.libraryId || "").startsWith("custom:"));
    return row ? { id: row.id, libraryId: row.libraryId || null } : null;
  });
  if (!slot) throw new Error("Seed program has no non-custom slot to replace");
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${slot.id}"]`);
  if (!(await row.locator('[data-role="replace"]').count()))
    await row.locator('[data-role="toggle-exercise"]').click();
  await row.locator('[data-role="replace"]').click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  await page.locator("#exPickSearch").fill(name);
  await page.waitForFunction(customId =>
    [...document.querySelectorAll("#exPickList .pickrow")].some(button => button.dataset.pick === customId),
  id, { timeout: 5000 });
  await page.evaluate(customId =>
    [...document.querySelectorAll("#exPickList .pickrow")]
      .find(button => button.dataset.pick === customId)?.click(), id);
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await page.waitForFunction(({ slotId, expectedName }) => {
    const element = document.querySelector(`#programEditor [data-role="exercise"][data-id="${CSS.escape(slotId)}"]`);
    return element?.querySelector('[data-role="exercise-field"][data-field="name"]')?.value === expectedName;
  }, { slotId: slot.id, expectedName: name }, { timeout: 5000 });
  return slot;
}

async function replaceCustomSlotWithBuiltIn(page, customId) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await page.waitForFunction(() => document.querySelector("#program")?.classList.contains("active"),
    undefined, { timeout: 5000 });
  if (await page.locator("#programEditorWrap.is-hidden").count())
    await page.click("#programEditToggle");
  await page.waitForSelector('#programEditor [data-role="exercise"]', { timeout: 5000 });
  const slot = await page.evaluate(id => {
    const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = state.program?.find(item => item.libraryId === id);
    return row ? { id: row.id, day: row.day } : null;
  }, customId);
  if (!slot) throw new Error("Custom-reference fixture has no installed Program slot for X");
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${slot.id}"]`);
  if (!(await row.locator('[data-role="replace"]').count()))
    await row.locator('[data-role="toggle-exercise"]').click();
  await row.locator('[data-role="replace"]').click();
  await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
  const builtinId = await page.evaluate(() =>
    window.__repforgeExerciseLibrary.find(entry => entry.name === "Lat pulldown")?.id || null);
  if (!builtinId) throw new Error("Expected built-in Lat pulldown fixture is unavailable");
  await page.locator("#exPickSearch").fill("Lat pulldown");
  await page.waitForSelector(`#exPickList .pickrow[data-pick="${builtinId}"]`, { timeout: 5000 });
  await page.locator(`#exPickList .pickrow[data-pick="${builtinId}"]`).click();
  await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
  await page.click("#programEditToggle");
  await page.waitForFunction(() => {
    const leave = document.querySelector("#programEditorLeave");
    const wrapper = document.querySelector("#programEditorWrap");
    const status = document.querySelector('#programEditor [data-role="editor-status"]');
    return leave?.open || wrapper?.classList.contains("is-hidden") || (!status?.hidden && !!status?.textContent.trim());
  }, undefined, { timeout: 10000 });
  const discardDialog = await page.locator("#programEditorLeave").evaluate(dialog => dialog.open);
  if (discardDialog) await page.click("#programEditorApply");
  try {
    await page.waitForFunction(({ slotId, customId: id }) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return state.program?.some(item => item.id === slotId && item.libraryId === id) === false;
    }, { slotId: slot.id, customId }, { timeout: 10000 });
  } catch {
    const diagnostic = await page.evaluate(async () => ({
      editorVisible: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
      status: document.querySelector('#programEditor [data-role="editor-status"]')?.textContent?.trim() || "",
      toggle: document.querySelector("#programEditToggle")?.textContent?.trim() || "",
      durableRow: JSON.parse(localStorage.getItem("repforge_v1") || "{}").program
        ?.find(item => item.libraryId?.startsWith("custom:")) || null,
      editor: await window.__debugProgramEditor?.().then(value => ({
        edits: value?.session?.edits,
        row: value?.session?.document?.program?.find(item => item.libraryId?.startsWith("custom:")),
      })),
    }));
    throw new Error(`Could not apply the built-in replacement: ${JSON.stringify(diagnostic)}`);
  }
  return { ...slot, workoutDiscardRequired: discardDialog };
}

async function openCustomManagement(page, id) {
  await page.evaluate(() => window.__repforgeOpenLibrary({}));
  await page.waitForSelector("#library.active", { timeout: 5000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("#libTabs .picktab")]
      .find(button => button.textContent.trim() === "Yours")?.click());
  await page.waitForFunction(customId =>
    [...document.querySelectorAll("[data-lib-edit]")].some(button => button.dataset.libEdit === customId),
  id, { timeout: 5000 });
  await page.evaluate(customId =>
    [...document.querySelectorAll("[data-lib-edit]")]
      .find(button => button.dataset.libEdit === customId)?.click(), id);
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
}

async function testStaleFullLibraryAddAfterDelete(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  try {
    await reset(tabA);
    const id = await seedCustom(tabA, "F057-12 stale library selection");
    await tabB.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(tabB);

    // Stage X through the actual full Library UI while its definition exists.
    await tabB.evaluate(() => window.__repforgeOpenLibrary({}));
    await tabB.waitForSelector(`#libList [data-lib-toggle="${id}"]`, { timeout: 5000 });
    await tabB.locator(`#libList [data-lib-toggle="${id}"]`).click();
    await tabB.click("#libPrimary");
    await tabB.waitForSelector(`#libConfigureRows [data-cfg="${id}"]`, { timeout: 5000 });

    // Delete fully settles in Tab A before Tab B applies its stale selection.
    await openCustomManagement(tabA, id);
    await tabA.click("#exCustomDelete");
    await tabA.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 10000 });
    const afterDelete = await readReplicas(tabA);
    check([afterDelete.local, afterDelete.idb].every(snapshot =>
      !snapshot?.customExercises?.some(entry => entry.id === id)),
    "the full-library race starts after Delete is fully settled in both replicas", {
      local: stateSummary(afterDelete.local, id, null),
      idb: stateSummary(afterDelete.idb, id, null),
    });

    await tabB.click("#libPrimary");
    await tabB.waitForFunction(() => {
      const library = document.querySelector("#library");
      const toast = document.querySelector("#toast")?.textContent?.trim() || "";
      return !library?.classList.contains("active") || !!toast;
    }, undefined, { timeout: 10000 });
    const afterApply = await readReplicas(tabB);
    const applyUi = await tabB.evaluate(() => ({
      libraryOpen: document.querySelector("#library")?.classList.contains("active") === true,
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
    }));
    const safe = [afterApply.local, afterApply.idb].every(snapshot =>
      customReferenceHasDefinition(snapshot, id));
    check(safe && [afterApply.local, afterApply.idb].every(snapshot =>
        !snapshot?.program?.some(row => row.libraryId === id)) && applyUi.libraryOpen &&
        !applyUi.toast.includes("exercises added"),
    "the full-library ingress rejects a stale custom identity after Delete", {
      applyUi,
      local: stateSummary(afterApply.local, id, null),
      idb: stateSummary(afterApply.idb, id, null),
    });

    await Promise.all([tabA, tabB].map(async page => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
    }));
    const [reloadA, reloadB] = await Promise.all([readReplicas(tabA), readReplicas(tabB)]);
    check([reloadA.local, reloadA.idb, reloadB.local, reloadB.idb].every(snapshot =>
      customReferenceHasDefinition(snapshot, id)) &&
      [reloadA.local, reloadA.idb, reloadB.local, reloadB.idb].every(snapshot =>
        !snapshot?.program?.some(row => row.libraryId === id)),
    "both tabs reload without a dangling full-library custom reference", {
      tabA: { local: stateSummary(reloadA.local, id, null), idb: stateSummary(reloadA.idb, id, null) },
      tabB: { local: stateSummary(reloadB.local, id, null), idb: stateSummary(reloadB.idb, id, null) },
    });
  } finally {
    await context.close();
  }
}

async function gateDeleteRecoveryBeforeOwnerLock(page, id) {
  await page.evaluate(customId => {
    const durable = window.RepForgeDurableState;
    const settle = durable.settleCustomExerciseMutation;
    durable.settleCustomExerciseMutation = async options => {
      window.__f05712RecoveryWaiting = true;
      window.__f05712RecoveryPendingJournalId = options.pendingJournalId || null;
      const references = [
        { program: [{ id: "probe-program", libraryId: customId }] },
        { log: [{ performedLibraryId: customId }] },
        { programHistory: [{ program: [{ id: "probe-history", libraryId: customId }] }] },
      ];
      window.__f05712DeleteReferenceVerifier = references.map(reference =>
        options.verify({ snapshot: { customExercises: [], ...reference } }));
      await new Promise(resolve => { window.__releaseF05712Recovery = resolve; });
      durable.settleCustomExerciseMutation = settle;
      return settle(options);
    };
  }, id);
}

async function gateEditorApplyAfterUnlockedRefresh(page, id) {
  await page.evaluate(customId => {
    const durable = window.RepForgeDurableState;
    const refresh = durable.refreshPersistenceHead;
    let captured = false;
    durable.refreshPersistenceHead = async (...args) => {
      const result = await refresh(...args);
      if (captured) return result;
      captured = true;
      const snapshot = result.head;
      window.__f05712UnlockedHead = {
        revision: snapshot?._storageRevision ?? null,
        customDefined: snapshot?.customExercises?.some(entry => entry.id === customId) === true,
      };
      await new Promise(resolve => { window.__releaseF05712UnlockedRefresh = resolve; });
      durable.refreshPersistenceHead = refresh;
      return result;
    };

    const enqueue = durable.enqueueStateChange;
    durable.enqueueStateChange = function (base, proposal, io, options = {}) {
      if (typeof options.preflight === "function" &&
          proposal?.program?.some(row => row.libraryId === customId)) {
        const preflight = options.preflight;
        durable.enqueueStateChange = enqueue;
        options = { ...options, preflight: async context => {
          const locked = context.head;
          window.__f05712LockedHead = {
            revision: locked?._storageRevision ?? null,
            customDefined: locked?.customExercises?.some(entry => entry.id === customId) === true,
          };
          const result = await preflight(context);
          window.__f05712LockedOutcome = {
            rejected: result?.reject === true,
            code: result?.result?.code ?? null,
          };
          return result;
        } };
      }
      return enqueue.call(durable, base, proposal, io, options);
    };
  }, id);
}

async function testPostPartialStaleWorkoutLog(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  try {
    await reset(tabA);
    const name = "F057-12 stale workout attribution";
    const id = await seedCustom(tabA, name);
    const slot = await stageCustomReplacementInInstalledEditor(tabA, id, name);
    await tabA.click("#programEditToggle");
    await tabA.waitForFunction(({ slotId, customId }) => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return state.program?.some(item => item.id === slotId && item.libraryId === customId) === true;
    }, { slotId: slot.id, customId: id }, { timeout: 10000 });

    await tabB.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(tabB);
    await tabB.evaluate(day => window.__repforgeEnterWorkout({ day }), slot.day);
    await tabB.waitForSelector("#workoutShell:not(.hidden)", { timeout: 10000 });
    const target = await tabB.evaluate(customId => {
      const draft = window.__repforgeWorkoutDraft.current();
      const exerciseInstanceId = draft.exerciseOrder.find(id => draft.exercises[id]?.libraryId === customId);
      const exercise = draft.exercises[exerciseInstanceId];
      return exercise ? { exerciseInstanceId, setId: exercise.setOrder[0] } : null;
    }, id);
    if (!target) throw new Error("The stale workout draft omitted its custom exercise X");
    await tabB.evaluate(async ({ exerciseInstanceId, setId }) => {
      for (const [field, value] of [["load", "45"], ["reps", "8"], ["rir", "2"]])
        await window.__repforgeWorkoutDraft.dispatch("editSetField", { exerciseInstanceId, setId, field, value });
      await window.__repforgeWorkoutDraft.dispatch("completeSet", {
        exerciseInstanceId, setId, completedAt: new Date().toISOString(),
      });
      await window.__repforgeWorkoutDraft.flush();
    }, target);

    const replaced = await replaceCustomSlotWithBuiltIn(tabA, id);
    const beforeDelete = await readReplicas(tabA);
    const clearedDraft = await tabA.evaluate(() => ({
      raw: localStorage.getItem("repforge_draft_v1"),
      checkpoint: JSON.parse(localStorage.getItem("repforge_draft_v1:v2-checkpoint") || "null"),
    }));
    check(replaced.workoutDiscardRequired === true && clearedDraft.raw === null &&
        beforeDelete.local?.program?.some(row => row.libraryId === id) !== true &&
        beforeDelete.idb?.program?.some(row => row.libraryId === id) !== true &&
        beforeDelete.local?.customExercises?.some(entry => entry.id === id) === true &&
        beforeDelete.idb?.customExercises?.some(entry => entry.id === id) === true,
      "removing X from Program requires the explicit cross-tab workout discard", {
        replaced, clearedDraft, local: stateSummary(beforeDelete.local, id, slot.id),
        idb: stateSummary(beforeDelete.idb, id, slot.id),
      });

    await openCustomManagement(tabA, id);
    const actionBeforeDelete = await tabA.locator("#exCustomDelete").getAttribute("data-i18n");
    await installLocalOnlyDeleteFault(tabA);
    await gateDeleteRecoveryBeforeOwnerLock(tabA, id);
    await tabA.click("#exCustomDelete");
    await tabA.waitForFunction(() => typeof window.__releaseF05712InitialDeleteWrite === "function",
      undefined, { timeout: 5000 });
    await tabA.evaluate(() => window.__releaseF05712InitialDeleteWrite());
    await tabA.waitForFunction(() => window.__f05712RecoveryWaiting === true &&
      document.querySelector("#exCustomSheet")?.dataset.phase === "recovering",
    undefined, { timeout: 5000 });
    const partial = await readReplicas(tabA);
    check(actionBeforeDelete === "custom.delete" &&
        !partial.local?.customExercises?.some(entry => entry.id === id) &&
        partial.idb?.customExercises?.some(entry => entry.id === id) === true,
      "the real workflow reaches a one-replica Delete after X becomes unused", {
        actionBeforeDelete, local: stateSummary(partial.local, id, slot.id),
        idb: stateSummary(partial.idb, id, slot.id),
      });

    await tabB.locator("#sessionSheetBtn").click();
    await tabB.locator("#sessionEarlyFinish").click();
    await tabB.locator("#sessionEarlyConfirm").click();
    await tabB.waitForFunction(() => window.__repforgeLastWorkoutFinish != null,
      undefined, { timeout: 10000 });
    const finishOutcome = await tabB.evaluate(async () => await window.__repforgeLastWorkoutFinish);
    const workout = await readReplicas(tabB);
    const attribution = workout.local?.log?.find(row => row.session ===
      workout.local?.log?.at(-1)?.session && row.performedLibraryId === id) || null;
    check(finishOutcome?.committed === true && finishOutcome?.settled === true && !!attribution &&
        workout.idb?.log?.some(row => row.session === attribution.session &&
          row.performedLibraryId === id) === true &&
        !workout.local?.customExercises?.some(entry => entry.id === id) &&
        !workout.idb?.customExercises?.some(entry => entry.id === id),
      "a completed stale-tab workout publishes its exact custom attribution after partial Delete", {
        outcome: { committed: finishOutcome?.committed, settled: finishOutcome?.settled,
          draftConflict: finishOutcome?.draftConflict, code: finishOutcome?.code },
        row: attribution, local: stateSummary(workout.local, id, slot.id),
        idb: stateSummary(workout.idb, id, slot.id),
      });

    const beforeCrash = await tabA.evaluate(() => {
      const id = window.__f05712RecoveryPendingJournalId;
      const key = `repforge_pending_v1:${id}`;
      const raw = localStorage.getItem(key);
      return { id, raw, journal: raw ? JSON.parse(raw) : null,
        phase: document.querySelector("#exCustomSheet")?.dataset.phase,
        toast: document.querySelector("#toast")?.textContent?.trim() || "" };
    });
    check(beforeCrash.phase === "recovering" && !beforeCrash.toast.includes("Exercise deleted."),
      "Delete remains recovery-owned when the stale workout attribution commits", beforeCrash);
    check(beforeCrash.id && beforeCrash.journal?.customMutationIntent?.id === id &&
        beforeCrash.journal.customMutationIntent.entry?.id === id,
      "the immutable partial-Delete journal retains X identity and its source definition through a concurrent log commit", {
        id: beforeCrash.id, rawPresent: typeof beforeCrash.raw === "string",
        intent: beforeCrash.journal?.customMutationIntent || null,
      });

    // Reload while the UI recovery promise is still gated. Boot must recover
    // from the durable Delete intent and the newly committed log, without the
    // in-memory custom sheet or mutation object.
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(tabA);
    const recovered = await readReplicas(tabA);
    check([recovered.local, recovered.idb].every(snapshot =>
        snapshot?.customExercises?.some(entry => entry.id === id) === true &&
        snapshot?.log?.some(row => row.performedLibraryId === id) === true),
      "boot recovery preserves the definition for the post-partial log identity", {
        pendingBeforeCrash: { id: beforeCrash.id, rawPresent: typeof beforeCrash.raw === "string",
          customMutationIntent: beforeCrash.journal?.customMutationIntent || null },
        local: stateSummary(recovered.local, id, slot.id),
        idb: stateSummary(recovered.idb, id, slot.id),
      });
    await openCustomManagement(tabA, id);
    const ui = await tabA.evaluate(() => ({
      phase: document.querySelector("#exCustomSheet")?.dataset.phase,
      action: document.querySelector("#exCustomDelete")?.dataset.i18n,
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
    }));
    const safe = snapshot => snapshot?.customExercises?.some(entry => entry.id === id) === true &&
      snapshot?.log?.some(row => row.performedLibraryId === id) === true;
    check([recovered.local, recovered.idb].every(safe) && ui.action === "custom.archive" &&
        !ui.toast.includes("Exercise deleted."),
      "Delete recovery restores X for the new log identity and requires explicit Archive", {
        ui, local: stateSummary(recovered.local, id, slot.id), idb: stateSummary(recovered.idb, id, slot.id),
      });
    await tabA.click("#exCustomDelete");
    await tabA.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 10000 });
    await Promise.all([tabA, tabB].map(async page => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
    }));
    const [reloadA, reloadB] = await Promise.all([readReplicas(tabA), readReplicas(tabB)]);
    check([reloadA.local, reloadA.idb, reloadB.local, reloadB.idb].every(snapshot =>
      snapshot?.customExercises?.some(entry => entry.id === id && entry.archived === true) === true &&
      snapshot?.log?.some(row => row.performedLibraryId === id) === true),
      "both tabs reload with Archive preserving the stale workout attribution", {
        tabA: { local: stateSummary(reloadA.local, id, slot.id), idb: stateSummary(reloadA.idb, id, slot.id) },
        tabB: { local: stateSummary(reloadB.local, id, slot.id), idb: stateSummary(reloadB.idb, id, slot.id) },
      });
  } finally {
    await context.close();
  }
}

async function installLocalOnlyDeleteFault(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeIdb;
    let calls = 0;
    io.writeIdb = (snapshot) => {
      calls++;
      if (calls === 1) return new Promise(resolve => {
        window.__releaseF05712InitialDeleteWrite = () => resolve(false);
      });
      return original.call(io, snapshot);
    };
  });
}

function customReferenceHasDefinition(snapshot, id) {
  const referenced = snapshot?.program?.some(row => row.libraryId === id) === true;
  const defined = snapshot?.customExercises?.some(entry => entry.id === id) === true;
  return !referenced || defined;
}

function stateSummary(snapshot, id, slotId) {
  const slot = snapshot?.program?.find(row => row.id === slotId);
  return {
    revision: snapshot?._storageRevision ?? null,
    customDefined: snapshot?.customExercises?.some(entry => entry.id === id) === true,
    slotLibraryId: slot?.libraryId ?? null,
    programReferences: snapshot?.program?.filter(row => row.libraryId === id).length ?? 0,
    logReferences: snapshot?.log?.filter(row => row.performedLibraryId === id).length ?? 0,
    programHistoryReferences: snapshot?.programHistory?.reduce((count, history) =>
      count + (history?.program?.filter(row => row.libraryId === id).length ?? 0), 0) ?? 0,
  };
}

async function run() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tabA = await context.newPage();
  const tabB = await context.newPage();
  try {
    await reset(tabA);
    const name = "F057-12 staged custom reference";
    const id = await seedCustom(tabA, name);
    await tabB.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(tabB);

    // Tab B stages its replacement through the installed Program editor while X exists.
    const slot = await stageCustomReplacementInInstalledEditor(tabB, id, name);
    const staged = await readReplicas(tabB);
    check(staged.local?.customExercises?.some(entry => entry.id === id) === true &&
        staged.idb?.customExercises?.some(entry => entry.id === id) === true,
      "Tab B opens the installed editor with X durably defined", { local: staged.local, idb: staged.idb });
    check((staged.local?.program?.find(row => row.id === slot.id)?.libraryId ?? null) === slot.libraryId &&
        (staged.idb?.program?.find(row => row.id === slot.id)?.libraryId ?? null) === slot.libraryId,
      "Tab B stages, but does not yet persist, replacement with X", {
        slotId: slot.id, local: staged.local?.program?.find(row => row.id === slot.id),
        idb: staged.idb?.program?.find(row => row.id === slot.id),
      });

    // Tab A starts a one-replica Delete. The owner recovery call is stopped before
    // it can acquire the canonical storage lock, allowing Tab B to race for it.
    await openCustomManagement(tabA, id);
    await installLocalOnlyDeleteFault(tabA);
    await gateDeleteRecoveryBeforeOwnerLock(tabA, id);

    // Start Tab B's UI Apply against a captured head that still contains X.
    // The injected gate pauses after that optimistic read and before the
    // installed editor submits its durable transaction.
    await gateEditorApplyAfterUnlockedRefresh(tabB, id);
    await tabB.click("#programEditToggle");
    await tabB.waitForFunction(() => window.__releaseF05712UnlockedRefresh &&
      window.__f05712UnlockedHead?.customDefined === true, undefined, { timeout: 10000 });

    await tabA.click("#exCustomDelete");
    await tabA.waitForFunction(() => typeof window.__releaseF05712InitialDeleteWrite === "function",
      undefined, { timeout: 5000 });
    await tabA.evaluate(() => window.__releaseF05712InitialDeleteWrite());
    await tabA.waitForFunction(() => window.__f05712RecoveryWaiting === true &&
      document.querySelector("#exCustomSheet")?.dataset.phase === "recovering",
    undefined, { timeout: 5000 });

    const partial = await readReplicas(tabA);
    const recoveryUi = await tabA.evaluate(() => ({
      phase: document.querySelector("#exCustomSheet")?.dataset.phase,
      busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
      inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
      toast: document.querySelector("#toast")?.textContent?.trim() || "",
    }));
    check(recoveryUi.phase === "recovering" && recoveryUi.busy === "true" && recoveryUi.inert === true &&
        !recoveryUi.toast.includes("Exercise deleted."),
      "Tab A remains inert and does not announce Delete before recovery", recoveryUi);
    const deleteReferenceVerifier = await tabA.evaluate(() => window.__f05712DeleteReferenceVerifier);
    check(deleteReferenceVerifier?.length === 3 && deleteReferenceVerifier.every(result =>
      result?.ok === false && result?.code === "custom_delete_became_used"),
      "Delete recovery rejects program, log-attribution, and program-history references", deleteReferenceVerifier);
    check(!partial.local?.customExercises?.some(entry => entry.id === id) &&
        partial.idb?.customExercises?.some(entry => entry.id === id) === true,
      "the gated partial Delete changes only localStorage", {
        localDefinition: partial.local?.customExercises?.find(entry => entry.id === id) || null,
        idbDefinition: partial.idb?.customExercises?.find(entry => entry.id === id) || null,
      });

    // Resume the in-flight UI Apply. Its optimistic read is deliberately
    // stale; the editor must reject against the deleted identity under lock.
    await tabB.evaluate(() => window.__releaseF05712UnlockedRefresh());
    await tabB.waitForFunction(() => {
      const wrapper = document.querySelector("#programEditorWrap");
      const status = document.querySelector('#programEditor [data-role="editor-status"]');
      return wrapper?.classList.contains("is-hidden") || (!status?.hidden && !!status?.textContent.trim());
    }, undefined, { timeout: 10000 });
    const applied = await tabB.evaluate(() => ({
      editorVisible: !document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"),
      status: document.querySelector('#programEditor [data-role="editor-status"]')?.textContent?.trim() || "",
      unlockedHead: window.__f05712UnlockedHead,
      lockedHead: window.__f05712LockedHead,
      lockedOutcome: window.__f05712LockedOutcome,
    }));
    const afterApply = await readReplicas(tabB);
    const localSlot = afterApply.local?.program?.find(row => row.id === slot.id);
    const idbSlot = afterApply.idb?.program?.find(row => row.id === slot.id);
    const rejected = applied.editorVisible && applied.status.includes("changed in another tab") &&
      applied.unlockedHead?.customDefined === true && applied.lockedHead?.customDefined === false &&
      applied.lockedOutcome?.rejected === true && applied.lockedOutcome?.code === "missing_custom_definition";
    check(rejected && localSlot?.libraryId !== id && idbSlot?.libraryId !== id &&
      customReferenceHasDefinition(afterApply.local, id) && customReferenceHasDefinition(afterApply.idb, id),
      "the installed editor rejects its stale custom reference against the rebased head", {
        applied, local: stateSummary(afterApply.local, id, slot.id),
        idb: stateSummary(afterApply.idb, id, slot.id),
      });

    await tabA.evaluate(() => window.__releaseF05712Recovery());
    await tabA.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 10000 });
    const final = await readReplicas(tabA);
    const deleteToast = await tabA.locator("#toast").textContent();
    const finalSafe = customReferenceHasDefinition(final.local, id) &&
      customReferenceHasDefinition(final.idb, id);
    check(finalSafe && !final.local?.customExercises?.some(entry => entry.id === id) &&
        !final.idb?.customExercises?.some(entry => entry.id === id) &&
        !final.local?.program?.some(row => row.libraryId === id) &&
        !final.idb?.program?.some(row => row.libraryId === id) &&
      String(deleteToast).includes("Exercise deleted."),
      "Delete settles only after the stale editor is rejected, leaving no reference to X", {
        deleteToast, local: stateSummary(final.local, id, slot.id),
        idb: stateSummary(final.idb, id, slot.id),
      });

    await Promise.all([tabA, tabB].map(async page => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
    }));
    const [reloadA, reloadB] = await Promise.all([readReplicas(tabA), readReplicas(tabB)]);
    const reloadSafe = [reloadA.local, reloadA.idb, reloadB.local, reloadB.idb]
      .every(snapshot => customReferenceHasDefinition(snapshot, id));
    check(reloadSafe && [reloadA.local, reloadA.idb, reloadB.local, reloadB.idb]
        .every(snapshot => !snapshot?.program?.some(row => row.libraryId === id)),
      "both tabs reload with the no-dangling-custom-reference invariant intact", {
        tabA: { local: stateSummary(reloadA.local, id, slot.id), idb: stateSummary(reloadA.idb, id, slot.id) },
        tabB: { local: stateSummary(reloadB.local, id, slot.id), idb: stateSummary(reloadB.idb, id, slot.id) },
      });
    await testPostPartialStaleWorkoutLog(browser);
    await testStaleFullLibraryAddAfterDelete(browser);
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`\ncustom Delete vs installed editor race: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  run().catch(error => { console.error(error); process.exit(1); });
