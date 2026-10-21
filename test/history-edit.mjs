#!/usr/bin/env node
/**
 * Plan 057-P0: prove the persisted History edit/delete boundary.
 *
 * The durable snapshot is the independent oracle: typing and cancelling must
 * not change either replica; Save changes only the selected session; failed,
 * partial, and stale operations retain their explicit recovery state; Delete
 * removes only its confirmed target.
 */
import { pathToFileURL } from "node:url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

const results = { passed: 0, failed: 0 };

function assert(condition, name, detail = "") {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${detail}`);
  }
}

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage === "object" && typeof window.__repforgeStorage.flush === "function",
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onboarding = document.querySelector("#onboarding");
    if (onboarding?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
  });
}

async function clearState(page) {
  await page.evaluate(async (key) => {
    localStorage.removeItem(key);
    for (const name of Object.keys(localStorage)) {
      if (name.startsWith("repforge_ui_v1")) localStorage.removeItem(name);
    }
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  }, KEY);
}

async function writeState(page, state) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { key: KEY, value: state });
}

async function readReplicas(page) {
  return page.evaluate(async (key) => {
    const localRaw = localStorage.getItem(key);
    const idb = await new Promise((resolve) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("kv", "readonly");
        const get = transaction.objectStore("kv").get(key);
        get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
        get.onerror = () => { db.close(); resolve(null); };
      };
      request.onerror = () => resolve(null);
    });
    return { local: localRaw ? JSON.parse(localRaw) : null, idb };
  }, KEY);
}

function canonical(value) {
  return JSON.stringify(value);
}

function sessionRows(session, date, day, name, exerciseId, load) {
  return [1, 2].map((set) => ({
    session,
    date,
    day,
    name,
    exerciseId,
    set,
    load,
    reps: 8,
    rir: 1,
    notes: "",
    created: `${date}T12:00:00.000Z`,
    primary: "Chest",
    secondary: "Front delts",
  }));
}

async function main() {
  const browser = await launchChromium();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    // Plan 064 R3j2: the discard question is a sheet, so a native dialog is a regression. Any that opens is
    // dismissed (keep editing) and recorded; the run asserts there were none.
    const nativeDialogs = [];
    page.on("dialog", async (dialog) => {
      nativeDialogs.push(dialog.message());
      await dialog.dismiss();
    });
    const answerDiscard = async (choice) => {
      await page.waitForSelector("#historyDiscardSheet.is-open", { timeout: 5000 });
      await page.locator(choice === "keep" ? "#historyDiscardKeep" : "#historyDiscardDrop").click();
      await page.waitForSelector("#historyDiscardSheet", { state: "hidden", timeout: 5000 });
    };
    const clickDiscarding = async (selector) => {
      await page.locator(selector).click();
      await answerDiscard("discard");
    };
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearState(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });

    const seed = await readReplicas(page);
    const day1 = seed.local.program.find((row) => row.day === "Day 1") || seed.local.program[0];
    const day2 = seed.local.program.find((row) => row.day === "Day 2") || seed.local.program[1] || day1;
    const state = {
      ...seed.local,
      log: [
        ...sessionRows("history-edit-a", "2026-08-20", day1.day,
          "A Very Long Exercise Name That Must Remain Whole In History", day1.id, 80),
        ...sessionRows("history-other", "2026-08-19", day2.day, day2.name, day2.id, 60),
      ],
    };
    await writeState(page, state);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.waitForSelector("#history.view.active", { timeout: 5000 });

    const beforeEdit = await readReplicas(page);
    assert(beforeEdit.local?.log?.length === 4 && beforeEdit.idb?.log?.length === 4,
      "History starts from two persisted sessions", JSON.stringify({ local: beforeEdit.local?.log?.length, idb: beforeEdit.idb?.log?.length }));

    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    // R7 J-06: Edit may be pressed with the page scrolled (a long read page); the editor opens at its top.
    await page.setViewportSize({ width: 390, height: 420 });
    await page.locator('[data-history-edit="history-edit-a"]').scrollIntoViewIfNeeded();
    const readScroll = await page.evaluate(() => Math.round(window.scrollY));
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { timeout: 5000 });
    const editEntry = await page.evaluate(() => {
      const el = document.activeElement, box = el?.getBoundingClientRect();
      return { scrollY: Math.round(window.scrollY), tag: el?.tagName, editing: !!el?.matches?.("[data-history-editing-heading]"),
        visible: !!box && box.top >= 0 && box.bottom <= window.innerHeight && box.height > 0 };
    });
    assert(readScroll > 1 && editEntry.scrollY <= 1 && editEntry.editing && editEntry.visible,
      "History Edit opens at the top with focus on its visible heading (R7 J-06)", JSON.stringify({ readScroll, ...editEntry }));
    await page.setViewportSize({ width: 390, height: 844 });
    const editingA11y = await page.evaluate(() => ({
      heading: document.querySelector('[data-history-editing-heading]')?.textContent.trim() || "",
      status: document.querySelector('[data-history-editing-status]')?.textContent.trim() || "",
      role: document.querySelector('[data-history-editing-status]')?.getAttribute("role") || "",
      focused: document.activeElement?.matches?.('[data-history-editing-heading], .session--edit input, .session--edit [data-ed="date"]') || false,
    }));
    assert(editingA11y.heading.length > 0 && editingA11y.status.length > 0 && editingA11y.role === "status" && editingA11y.focused,
      "entering History Edit announces and focuses the editing state", editingA11y);
    const editorName = await page.locator('.session--edit[data-editing="history-edit-a"] .edgroup__name').first().textContent();
    assert(editorName?.includes("A Very Long Exercise Name That Must Remain Whole"),
      "The characterized editor exposes the complete exercise identity", editorName);

    const input = page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first();
    await input.fill("123.5");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterTyping = await readReplicas(page);
    assert(canonical(afterTyping.local) === canonical(beforeEdit.local) && canonical(afterTyping.idb) === canonical(beforeEdit.idb),
      "Typing an edit field makes zero durable change before Save",
      JSON.stringify({ localChanged: canonical(afterTyping.local) !== canonical(beforeEdit.local), idbChanged: canonical(afterTyping.idb) !== canonical(beforeEdit.idb) }));

    await clickDiscarding("[data-edcancel]");
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    assert(await page.evaluate(() => document.activeElement?.matches?.('[data-history-edit="history-edit-a"]') || false),
      "Cancel restores focus to the selected session Edit action");
    const afterCancel = await readReplicas(page);
    assert(canonical(afterCancel.local) === canonical(beforeEdit.local) && canonical(afterCancel.idb) === canonical(beforeEdit.idb),
      "Cancel restores the exact persisted snapshot");

    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("123.5");
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { state: "detached", timeout: 5000 });
    assert(await page.evaluate(() => document.activeElement?.matches?.('[data-history-edit="history-edit-a"]') || false),
      "successful History Save restores focus to the read-state Edit action");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterSave = await readReplicas(page);
    const savedRows = afterSave.local.log.filter((row) => row.session === "history-edit-a");
    const untouchedRows = afterSave.local.log.filter((row) => row.session === "history-other");
    assert(savedRows.length === 2 && Number(savedRows[0].load) === 123.5 && Number(savedRows[1].load) === 80,
      "Save commits the complete selected-session copy", JSON.stringify(savedRows));
    assert(untouchedRows.length === 2 && untouchedRows.every((row) => Number(row.load) === 60),
      "Save preserves unrelated sessions", JSON.stringify(untouchedRows));
    assert(canonical(afterSave.local) === canonical(afterSave.idb),
      "Save leaves localStorage and IndexedDB at the same session result");

    // The History working copy must stay canonical when the display unit changes
    // or a render replaces its inputs. A typed 100 lb is about 45.36 kg; it must
    // not become 100 kg merely because the editor was rendered again.
    const historyBaseline = structuredClone(afterSave.local);
    const poundState = structuredClone(historyBaseline);
    poundState.settings.unit = "lb";
    await writeState(page, poundState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    await page.locator('[data-history-edit="history-edit-a"]').click();
    const poundInput = page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first();
    await poundInput.fill("100");
    // The dock is hidden while a session is edited (R3j2), so the route changes the way a notification or a deep link would.
    await page.evaluate(() => document.querySelector('nav button[data-view="log"]').click());
    await page.locator('nav button[data-view="history"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { timeout: 5000 });
    const rerenderedPounds = await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().inputValue();
    assert(Math.abs(Number(rerenderedPounds) - 100) < 0.01,
      "History keeps the typed pound value across navigation and render", rerenderedPounds);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    const afterPoundSave = await readReplicas(page);
    const poundLoad = Number(afterPoundSave.local.log.find((row) => row.session === "history-edit-a" && row.set === 1)?.load);
    assert(Math.abs(poundLoad - (100 / 2.2046226218)) < 0.02,
      "Saving a rerendered pound edit stores canonical kilograms", poundLoad);

    // Row removal belongs to the working copy, not only to the current DOM.
    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] [data-edrm="1"]').click();
    // The dock is hidden while a session is edited (R3j2), so the route changes the way a notification or a deep link would.
    await page.evaluate(() => document.querySelector('nav button[data-view="log"]').click());
    await page.locator('nav button[data-view="history"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { timeout: 5000 });
    const removedAfterRender = await page.evaluate(() => {
      const row = document.querySelector('.session--edit[data-editing="history-edit-a"] .edrow[data-edidx="1"]');
      return { removed: row?.classList.contains("is-removed") === true, disabled: row?.querySelector("input")?.disabled === true };
    });
    assert(removedAfterRender.removed && removedAfterRender.disabled,
      "History keeps a removed row marked through navigation and render", removedAfterRender);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    const afterRemovedSave = await readReplicas(page);
    assert(afterRemovedSave.local.log.filter((row) => row.session === "history-edit-a").length === 1,
      "Saving after a rerender removes exactly the selected row", afterRemovedSave.local.log);

    // Entering Delete from a dirty editor is destructive navigation. Dismissing
    // its confirmation must leave the edit and its value intact.
    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.locator('[data-history-edit="history-edit-a"]').click();
    const dirtyBeforeDelete = page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first();
    await dirtyBeforeDelete.fill("175");
    await page.locator('.session--edit[data-editing="history-edit-a"] [data-del="history-edit-a"]').click();
    await answerDiscard("keep");
    await page.waitForFunction(() => document.querySelector('.session--edit[data-editing="history-edit-a"]') || document.querySelector('[data-history-delete-confirm="history-edit-a"]'), undefined, { timeout: 5000 });
    const retainedDirtyEdit = await page.locator('.session--edit[data-editing="history-edit-a"]').count() === 1 &&
      await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().inputValue() === "175";
    assert(retainedDirtyEdit, "Delete asks before discarding a dirty History edit");

    // Retry must remain under the durable owner. Blocking only WAL cleanup makes
    // replica equality look successful to the old UI even though settlement is
    // still pending.
    if (retainedDirtyEdit) await clickDiscarding('[data-edcancel]');
    else await page.locator('[data-history-delete-cancel]').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("180");
    await page.evaluate(() => {
      const removeItem = Storage.prototype.removeItem;
      window.__historyWalCleanup = true;
      window.__historyWalRemoveOriginal = removeItem;
      Storage.prototype.removeItem = function (key) {
        if (window.__historyWalCleanup && String(key).startsWith("repforge_pending_v1:")) return;
        return removeItem.call(this, key);
      };
    });
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    const pendingAfterSave = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")).length);
    assert(pendingAfterSave > 0, "History failure retains the pending WAL for Retry", pendingAfterSave);
    await page.locator('[data-history-retry="1"], [data-history-retry]').click();
    await page.waitForFunction(() => document.querySelector('[data-history-operation="failure"]') || document.querySelector('.session--read[data-reading="history-edit-a"]'), undefined, { timeout: 5000 });
    const retryWhileBlocked = await page.evaluate(() => ({
      failure: !!document.querySelector('[data-history-operation="failure"]'),
      pending: Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")).length,
    }));
    assert(retryWhileBlocked.failure && retryWhileBlocked.pending > 0,
      "Retry does not claim success while WAL cleanup remains pending", retryWhileBlocked);
    if (retryWhileBlocked.failure) {
      await page.evaluate(() => { window.__historyWalCleanup = false; });
      await page.evaluate(() => document.querySelector('[data-history-retry]')?.click());
      await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
      const afterWalSettlement = await page.evaluate(() => ({
        pending: Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")).length,
        load: JSON.parse(localStorage.getItem("repforge_v1") || "{}").log?.find((row) => row.session === "history-edit-a" && row.set === 1)?.load,
      }));
      assert(afterWalSettlement.pending === 0 && Math.abs(Number(afterWalSettlement.load) - 180) < 0.01,
        "Retry settles the preserved History edit after WAL cleanup recovers", afterWalSettlement);
    } else {
      await page.evaluate(() => { window.__historyWalCleanup = false; });
    }

    // A late completion for session A must not reset a newer dirty selection B.
    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("181");
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const original = io.writeLocal;
      window.__historyCommitGate = { release: null, original };
      io.writeLocal = (snapshot) => new Promise((resolve) => {
        window.__historyCommitGate.release = () => original(snapshot).then(resolve);
      });
    });
    const pendingSave = page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForFunction(() => typeof window.__historyCommitGate?.release === "function", undefined, { timeout: 5000 });
    await clickDiscarding('[data-history-back]');
    await page.locator('#sessions [data-sess="history-other"] .session__open').click();
    await page.locator('[data-history-edit="history-other"]').click();
    const newerInput = page.locator('.session--edit[data-editing="history-other"] input[data-ek^="load|"]').first();
    await newerInput.fill("222");
    await page.evaluate(async () => { await window.__historyCommitGate.release(); });
    await pendingSave;
    await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").log?.some((row) => row.session === "history-edit-a" && row.set === 1 && Number(row.load) === 181), KEY, { timeout: 5000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      if (window.__historyCommitGate?.original) io.writeLocal = window.__historyCommitGate.original;
      delete window.__historyCommitGate;
    });
    assert(await page.locator('.session--edit[data-editing="history-other"]').count() === 1 && await newerInput.inputValue() === "222",
      "A stale History completion cannot replace a newer dirty selection");
    await clickDiscarding('[data-edcancel]');
    await page.waitForSelector('.session--read[data-reading="history-other"]', { timeout: 5000 });

    // The already-committed recovery branch also awaits durable settlement.
    // Navigate to another dirty session while its lock-held test gate is open;
    // the late completion must settle storage without rewriting this view.
    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("183");
    const alreadyCommitted = structuredClone((await readReplicas(page)).local);
    alreadyCommitted.log.find((row) => row.session === "history-edit-a" && row.set === 1).load = 183;
    alreadyCommitted._storageRevision = Number(alreadyCommitted._storageRevision || 0) + 1;
    await writeState(page, alreadyCommitted);
    await page.evaluate(() => {
      window.__historySettlementGate = { release: null };
      window.__repforgeDurableStateTestHooks = {
        durableSettlementLockHeld: async () => new Promise((resolve) => {
          window.__historySettlementGate.release = resolve;
        }),
      };
    });
    const pendingAlreadyCommitted = page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForFunction(() => typeof window.__historySettlementGate?.release === "function", undefined, { timeout: 5000 });
    await clickDiscarding('[data-history-back]');
    await page.waitForSelector('#historyCalBtn:not(.hidden)', { timeout: 5000 });
    await page.locator('#sessions [data-sess="history-other"] .session__open').click();
    await page.locator('[data-history-edit="history-other"]').click();
    const newerAlreadyInput = page.locator('.session--edit[data-editing="history-other"] input[data-ek^="load|"]').first();
    await newerAlreadyInput.fill("223");
    await page.evaluate(() => window.__historySettlementGate.release());
    await pendingAlreadyCommitted;
    assert(await page.locator('.session--edit[data-editing="history-other"]').count() === 1 &&
      await newerAlreadyInput.inputValue() === "223",
    "an already-committed late completion cannot replace a newer dirty selection");
    await page.evaluate(() => { delete window.__repforgeDurableStateTestHooks; });

    await writeState(page, historyBaseline);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await page.locator('nav button[data-view="history"]').click();
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });

    // F057-01: a complete storage failure keeps the immutable desired copy
    // attached to the operation. Retry must not silently rebuild it from the
    // durable head; the user has to see the value they tried to save.
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("150");
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      window.__historyFaultOriginal = { writeLocal: io.writeLocal, writeIdb: io.writeIdb };
      io.writeLocal = async () => false;
      io.writeIdb = async () => false;
    });
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    assert(await page.evaluate(() => document.activeElement?.matches?.('[data-history-operation="failure"] h3') || false),
      "History failure moves focus to its live operation heading");
    const failedSelection = await page.evaluate(() => window.__repforgeHistory.selection());
    assert(failedSelection.mode === "failure" && failedSelection.desiredFingerprint &&
      Number(failedSelection.workingCopy?.[0]?.load) === 150,
      "failed History Save retains its exact desired working copy", JSON.stringify(failedSelection));
    assert(await page.locator('[data-history-retry]').count() === 1,
      "failed History Save exposes a retry action while retaining the operation");
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const original = window.__historyFaultOriginal;
      io.writeLocal = original.writeLocal;
      io.writeIdb = original.writeIdb;
      delete window.__historyFaultOriginal;
    });
    await page.locator('[data-history-retry]').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    const afterFailedRetry = await readReplicas(page);
    assert(afterFailedRetry.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 150 &&
      canonical(afterFailedRetry.local) === canonical(afterFailedRetry.idb),
      "Retry commits the preserved failed edit to both replicas", JSON.stringify(afterFailedRetry));

    // A one-replica outcome is a separate deferred/partial proof. The retry
    // remains the same desired copy even when the first attempt advanced one
    // durable replica before settlement stopped.
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("160");
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      window.__historyFaultOriginal = { writeLocal: io.writeLocal, writeIdb: io.writeIdb };
      io.writeIdb = async () => false;
    });
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const original = window.__historyFaultOriginal;
      io.writeLocal = original.writeLocal;
      io.writeIdb = original.writeIdb;
      delete window.__historyFaultOriginal;
    });
    await page.locator('[data-history-retry]').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    const afterPartialRetry = await readReplicas(page);
    assert(afterPartialRetry.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 160 &&
      canonical(afterPartialRetry.local) === canonical(afterPartialRetry.idb),
      "Partial/deferred retry settles one complete state in both replicas", JSON.stringify(afterPartialRetry));

    // A dirty failed operation must ask before Back discards its desired copy.
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("170");
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      window.__historyFaultOriginal = { writeLocal: io.writeLocal, writeIdb: io.writeIdb };
      io.writeLocal = async () => false;
      io.writeIdb = async () => false;
    });
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const original = window.__historyFaultOriginal;
      io.writeLocal = original.writeLocal;
      io.writeIdb = original.writeIdb;
      delete window.__historyFaultOriginal;
    });
    await page.locator('[data-history-back]').click();
    await answerDiscard("keep");
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    assert(await page.locator('[data-history-operation="failure"]').count() === 1,
      "Back from a dirty failed edit requires explicit discard confirmation");
    await clickDiscarding('[data-history-back]');
    await page.waitForSelector('#historyCalBtn:not(.hidden)', { timeout: 5000 });
    const calendarFocus = await page.evaluate(() => document.activeElement?.matches?.('[data-sess="history-edit-a"] .session__open') || false);
    assert(calendarFocus, "Back from History selection returns focus to the selected calendar session");
    await page.locator('#sessions [data-sess="history-edit-a"] .session__open').click();
    await page.waitForSelector('.session--read[data-reading="history-edit-a"]', { timeout: 5000 });
    const durableAfterDiscard = await readReplicas(page);
    assert(durableAfterDiscard.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 160,
      "Explicit discard returns to the durable session rather than the failed copy");

    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("130");
    const changedElsewhere = structuredClone((await readReplicas(page)).local);
    changedElsewhere.log.find((row) => row.session === "history-edit-a" && row.set === 2).load = 81;
    changedElsewhere._storageRevision = Number(changedElsewhere._storageRevision || 0) + 1;
    await writeState(page, changedElsewhere);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="conflict"]', { timeout: 5000 });
    assert(await page.evaluate(() => document.activeElement?.matches?.('[data-history-operation="conflict"] h3') || false),
      "History conflict moves focus to its live operation heading");
    const afterConflict = await readReplicas(page);
    assert(afterConflict.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 160 &&
      afterConflict.local.log.find((row) => row.session === "history-edit-a" && row.set === 2).load === 81,
      "Stale Save refuses to merge over a changed session", JSON.stringify(afterConflict.local.log));

    // Reload must fail closed when the two replicas disagree at one revision;
    // the durable owner exposes no safe head for History to adopt.
    const unresolvedLocal = structuredClone(afterConflict.local);
    const unresolvedIdb = structuredClone(afterConflict.idb);
    unresolvedIdb.log.find((row) => row.session === "history-other" && row.set === 1).load = 999;
    await page.evaluate(async ({ key, value }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    }, { key: KEY, value: unresolvedIdb });
    await page.evaluate(async () => window.__repforgeHistory.reloadLatest());
    const afterUnresolvedReload = await readReplicas(page);
    assert(await page.locator('[data-history-operation="conflict"]').count() === 1 &&
      Number(afterUnresolvedReload.idb.log.find((row) => row.session === "history-other" && row.set === 1).load) === 999 &&
      Number(afterUnresolvedReload.local.log.find((row) => row.session === "history-other" && row.set === 1).load) !== 999,
      "Unresolved replica disagreement leaves History in conflict without adopting a fallback head",
      JSON.stringify({ selection: await page.evaluate(() => window.__repforgeHistory.selection()), afterUnresolvedReload }));

    await writeState(page, afterConflict.local);
    await page.locator('[data-history-reload]').click();
    await page.waitForSelector('[data-history-edit="history-edit-a"]', { timeout: 5000 });
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("140");
    const exactRetry = structuredClone((await readReplicas(page)).local);
    exactRetry.log.find((row) => row.session === "history-edit-a" && row.set === 1).load = 140;
    exactRetry._storageRevision = Number(exactRetry._storageRevision || 0) + 1;
    await writeState(page, exactRetry);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-edit="history-edit-a"]', { timeout: 5000 });
    const afterAlreadyCommitted = await readReplicas(page);
    assert(afterAlreadyCommitted.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 140 &&
      afterAlreadyCommitted.local.log.find((row) => row.session === "history-edit-a" && row.set === 2).load === 81,
      "An exact delayed retry is accepted without a second merge", JSON.stringify(afterAlreadyCommitted.local.log));

    await page.locator('[data-history-back]').click();
    await page.locator('#sessions [data-sess="history-other"] .session__open').click();
    const deleteButton = page.locator('[data-reading="history-other"] [data-del="history-other"]');
    assert(await deleteButton.count() === 1 && await deleteButton.isVisible(),
      "Delete is a separate named action on the selected session");
    await deleteButton.click();
    await page.waitForSelector('[data-history-delete-confirm="history-other"]', { timeout: 5000 });
    const changedForDelete = structuredClone((await readReplicas(page)).local);
    changedForDelete.log.find((row) => row.session === "history-other" && row.set === 2).load = 61;
    changedForDelete._storageRevision = Number(changedForDelete._storageRevision || 0) + 1;
    await writeState(page, changedForDelete);
    await page.locator('[data-history-delete-confirm="history-other"]').click();
    await page.waitForSelector('[data-history-operation="conflict"]', { timeout: 5000 });
    const afterStaleDelete = await readReplicas(page);
    assert(afterStaleDelete.local.log.some((row) => row.session === "history-other") &&
      afterStaleDelete.local.log.some((row) => row.session === "history-edit-a"),
      "Stale Delete refuses to remove a changed session", JSON.stringify(afterStaleDelete.local.log));
    await page.locator('[data-history-reload]').click();
    await page.waitForSelector('[data-history-edit="history-other"]', { timeout: 5000 });
    await page.locator('[data-del="history-other"]').click();
    await page.locator('[data-history-delete-confirm="history-other"]').click();
    await page.waitForFunction(() => {
      const value = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return !value.log?.some((row) => row.session === "history-other");
    }, undefined, { timeout: 5000 });
    const afterDelete = await readReplicas(page);
    assert(afterDelete.local.log.every((row) => row.session !== "history-other") &&
      afterDelete.local.log.every((row) => row.session === "history-edit-a"),
      "Confirmed Delete removes only its targeted persisted session", JSON.stringify(afterDelete.local.log));
    assert(canonical(afterDelete.local) === canonical(afterDelete.idb),
      "Delete leaves localStorage and IndexedDB at the same session result");

    // A02: an explicit RIR correction is measured evidence. Legacy rows carry
    // numeric RIR with rirMeasured:false; Strength evidence filters those, so the
    // History editor must record user intent. Semantics: a valid input to a RIR
    // field marks that row measured, even when the typed value equals the old one.
    const legacyRow = (session, date, set, load, measured, rir = 1) => ({
      session, date, day: day1.day, name: day1.name, exerciseId: day1.id, set, load, reps: 8, rir,
      ...(measured === undefined ? {} : { rirMeasured: measured }),
      notes: "", created: `${date}T12:00:00.000Z`, primary: "Chest", secondary: "Front delts", work: true,
    });
    const seedA02 = async (rows) => {
      await writeState(page, { ...historyBaseline, log: rows });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForApp(page);
      await page.locator('nav button[data-view="history"]').click();
    };
    const openEdit = async (sid) => {
      await page.evaluate((id) => window.__repforgeHistory.startReading(id), sid);
      await page.locator(`[data-history-edit="${sid}"]`).click();
      await page.waitForSelector(`.session--edit[data-editing="${sid}"]`, { timeout: 5000 });
    };
    const editor = (sid) => page.locator(`.session--edit[data-editing="${sid}"]`);
    const saveEdit = async (sid) => {
      await page.locator(`[data-edsave="${sid}"]`).click();
      await page.waitForSelector(`.session--edit[data-editing="${sid}"]`, { state: "detached", timeout: 5000 });
      await page.evaluate(() => window.__repforgeStorage.flush());
      return readReplicas(page);
    };
    const flags = (replicas, sid) => replicas.local.log.filter((row) => row.session === sid)
      .sort((a, b) => a.set - b.set).map((row) => `${row.set}:${row.rir}/${row.rirMeasured}`);
    const a02Rows = () => [
      legacyRow("a02-old", "2026-08-10", 1, 50, false, 0),
      legacyRow("a02-new", "2026-08-17", 1, 50, true, 2),
    ];

    // Production path: real editor -> durable save -> reload -> Strength evidence owner.
    await seedA02(a02Rows());
    await openEdit("a02-old");
    await editor("a02-old").locator('input[data-ek="rir|0"]').fill("2");
    const a02Saved = await saveEdit("a02-old");
    const a02Row = a02Saved.local.log.find((row) => row.session === "a02-old");
    assert(canonical(a02Saved.local) === canonical(a02Saved.idb) && a02Row.rir === 2 && a02Row.rirMeasured === true,
      "A02 History RIR correction persists rir:2 with rirMeasured:true in both replicas",
      JSON.stringify({ rir: a02Row.rir, rirMeasured: a02Row.rirMeasured }));
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    const a02Evidence = await page.evaluate(() => window.__repforgeProgressEvidence.records().filter((r) => r.evidenceCount));
    const a02Reloaded = (await readReplicas(page)).local.log.find((row) => row.session === "a02-old");
    assert(a02Reloaded.rir === 2 && a02Reloaded.rirMeasured === true &&
      a02Evidence.length > 0 && a02Evidence[0].reason !== "missing-effort" && a02Evidence[0].evidenceState === "sufficient",
      "A02 reloaded Strength evidence accepts the corrected RIR instead of missing-effort",
      JSON.stringify({ rir: a02Reloaded.rir, rirMeasured: a02Reloaded.rirMeasured, evidence: a02Evidence }));

    // Non-RIR edits preserve provenance; an explicit RIR edit marks only its own row.
    const a02Controls = () => [
      legacyRow("a02-old", "2026-08-10", 1, 50, false, 1),
      legacyRow("a02-old", "2026-08-10", 2, 50, false, 1),
      legacyRow("a02-old", "2026-08-10", 3, 50, true, 1),
      legacyRow("a02-new", "2026-08-17", 1, 50, false, 1),
    ];
    const allFalse = ["1:1/false", "2:1/false", "3:1/true"];
    for (const [label, mutate] of [
      ["load-only", (ed) => ed.locator('input[data-ek="load|0"]').fill("55")],
      ["reps-only", (ed) => ed.locator('input[data-ek="reps|0"]').fill("9")],
      ["date-only", (ed) => ed.locator('[data-ed="date"]').fill("2026-08-11")],
    ]) {
      await seedA02(a02Controls());
      await openEdit("a02-old");
      await mutate(editor("a02-old"));
      const saved = await saveEdit("a02-old");
      assert(flags(saved, "a02-old").join() === allFalse.join() && flags(saved, "a02-new").join() === "1:1/false",
        `A02 ${label} edit preserves rirMeasured provenance (false stays false, true stays true)`,
        JSON.stringify(flags(saved, "a02-old")));
    }

    await seedA02(a02Controls());
    await openEdit("a02-old");
    await editor("a02-old").locator('input[data-ek="rir|0"]').fill("2");
    await editor("a02-old").locator('input[data-ek="rir|2"]').fill("3");
    const rirSaved = await saveEdit("a02-old");
    assert(flags(rirSaved, "a02-old").join() === "1:2/true,2:1/false,3:3/true" && flags(rirSaved, "a02-new").join() === "1:1/false",
      "A02 RIR edit on one row marks only that row; sibling rows and other sessions keep provenance; measured stays measured",
      JSON.stringify({ old: flags(rirSaved, "a02-old"), other: flags(rirSaved, "a02-new") }));

    await seedA02(a02Controls());
    await openEdit("a02-old");
    await editor("a02-old").locator('input[data-ek="rir|1"]').fill("1");
    assert(flags(await saveEdit("a02-old"), "a02-old")[1] === "2:1/true",
      "A02 explicitly re-entering the same RIR value confirms it as measured");

    await seedA02(a02Controls());
    await openEdit("a02-old");
    const beforeInvalid = await readReplicas(page);
    await editor("a02-old").locator('input[data-ek="rir|0"]').fill("abc");
    await page.locator('[data-edsave="a02-old"]').click();
    await page.waitForFunction(() => document.querySelector('.session--edit [data-ek="rir|0"][aria-invalid="true"]'), undefined, { timeout: 5000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterInvalid = await readReplicas(page);
    assert(canonical(afterInvalid.local) === canonical(beforeInvalid.local) && flags(afterInvalid, "a02-old").join() === allFalse.join(),
      "A02 invalid RIR is rejected and does not upgrade provenance");

    await editor("a02-old").locator('input[data-ek="rir|0"]').fill("2");
    await clickDiscarding('[data-edcancel]');
    await page.waitForSelector('.session--read[data-reading="a02-old"]', { timeout: 5000 });
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterA02Cancel = await readReplicas(page);
    assert(canonical(afterA02Cancel.local) === canonical(beforeInvalid.local) && canonical(afterA02Cancel.idb) === canonical(beforeInvalid.idb),
      "A02 cancelled RIR edit persists nothing");

    // Plan 064 R3j2: the dirty editor on Direction D. Groups, a quiet remove with Undo, the dock hidden with
    // Cancel and Save pinned, and the discard question as a sheet instead of the native confirm.
    await seedA02(a02Controls());
    await openEdit("a02-old");
    const layoutA = await page.evaluate(() => {
      const card = document.querySelector('.session--edit[data-editing="a02-old"]');
      const rm = card.querySelector(".edrow__rm");
      const rmStyle = getComputedStyle(rm);
      const bar = card.querySelector(".histedit__bar").getBoundingClientRect();
      return {
        groups: card.querySelectorAll(".histedit__lift").length,
        names: [...card.querySelectorAll(".edgroup__name")].map((el) => el.textContent.trim()),
        rows: card.querySelectorAll(".edrow").length,
        perRowNames: card.querySelectorAll(".edrow__name").length,
        navShown: getComputedStyle(document.querySelector("nav")).display !== "none",
        barBottom: Math.round(innerHeight - bar.bottom),
        rmGlyph: rm.textContent.trim(), rmBorder: rmStyle.borderTopColor, rmBg: rmStyle.backgroundColor,
        rmInk: rmStyle.color, ink: getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim(),
        saveArrow: getComputedStyle(card.querySelector("[data-edsave]"), "::after").content,
      };
    });
    assert(layoutA.groups === 1 && layoutA.names.length === 1 && layoutA.rows === 3 && layoutA.perRowNames === 0,
      "R3j2: the editor names the lift once for its group of sets, not on every row", JSON.stringify(layoutA));
    assert(!layoutA.navShown && layoutA.barBottom === 0,
      "R3j2: the dock is hidden and Cancel/Save are pinned to the bottom edge while a session is edited", JSON.stringify(layoutA));
    assert(layoutA.rmGlyph === "×" && layoutA.rmBorder === "rgba(0, 0, 0, 0)" && layoutA.rmBg === "rgba(0, 0, 0, 0)" && layoutA.saveArrow === "none",
      "R3j2: the remove control is a quiet ink × (no box, no destructive colour) and Save carries no CTA arrow", JSON.stringify(layoutA));

    // Nothing asks while nothing changed.
    await page.locator("[data-edcancel]").click();
    await page.waitForSelector('.session--read[data-reading="a02-old"]', { timeout: 5000 });
    assert(await page.locator("#historyDiscardSheet.is-open").count() === 0, "R3j2: Cancel on an unchanged editor leaves without asking");
    await openEdit("a02-old");

    await editor("a02-old").locator('[data-edrm="1"]').click();
    const struck = await page.evaluate(() => {
      const row = document.querySelector('.session--edit .edrow[data-edidx="1"]');
      const input = row.querySelector(".edrow__in");
      return {
        removed: row.classList.contains("is-removed"), line: getComputedStyle(input).textDecorationLine, visible: getComputedStyle(input).visibility,
        idx: getComputedStyle(row.querySelector(".ledgerline__idx")).textDecorationLine,
        undo: row.querySelector("[data-edrm]").textContent.trim(), aria: row.querySelector("[data-edrm]").getAttribute("aria-label"),
      };
    });
    assert(struck.removed && struck.line.includes("line-through") && struck.idx.includes("line-through") && struck.visible === "visible" && struck.undo === "↺",
      "R3j2: a removed set stays on the page struck through, with Undo in place", JSON.stringify(struck));
    await editor("a02-old").locator('[data-edrm="1"]').click();

    // The discard question: once changed, Cancel asks in a sheet.
    await editor("a02-old").locator('input[data-ek="load|0"]').fill("77");
    await page.locator("[data-edcancel]").click();
    await page.waitForSelector("#historyDiscardSheet.is-open", { timeout: 5000 });
    const ask = await page.evaluate(() => {
      const sheet = document.querySelector("#historyDiscardSheet");
      return {
        role: sheet.getAttribute("role"), modal: sheet.getAttribute("aria-modal"),
        title: document.getElementById(sheet.getAttribute("aria-labelledby"))?.textContent.trim(),
        keep: document.querySelector("#historyDiscardKeep")?.textContent.trim(), drop: document.querySelector("#historyDiscardDrop")?.textContent.trim(),
        focus: document.activeElement?.id, behindInert: document.querySelector("main")?.inert === true,
        keepBg: getComputedStyle(document.querySelector("#historyDiscardKeep")).backgroundColor,
        dropInk: getComputedStyle(document.querySelector("#historyDiscardDrop")).color,
      };
    });
    assert(ask.role === "dialog" && ask.modal === "true" && /^Discard these unsaved changes\?$/.test(ask.title) &&
      ask.keep === "Keep editing" && ask.drop === "Discard changes" && ask.focus === "historyDiscardKeep" && ask.behindInert,
    "R3j2: the discard question is a modal sheet that starts on Keep editing, with the page behind it inert", JSON.stringify(ask));
    await page.keyboard.press("Escape");
    await page.waitForSelector("#historyDiscardSheet", { state: "hidden", timeout: 5000 });
    const keptByEscape = await page.evaluate(() => ({
      value: document.querySelector('.session--edit input[data-ek="load|0"]')?.value,
      focus: document.activeElement?.matches("[data-edcancel]"),
      scrollLocked: document.body.classList.contains("is-sheet-open"),
    }));
    assert(keptByEscape.value === "77" && keptByEscape.focus && !keptByEscape.scrollLocked,
      "R3j2: Escape on the discard question is Keep editing: the value stays and focus returns to Cancel", JSON.stringify(keptByEscape));
    await page.locator("[data-history-back]").click();
    await page.waitForSelector("#historyDiscardSheet.is-open", { timeout: 5000 });
    await page.locator("#historyDiscardScrim").click({ position: { x: 5, y: 5 } });
    await page.waitForSelector("#historyDiscardSheet", { state: "hidden", timeout: 5000 });
    assert(await editor("a02-old").locator('input[data-ek="load|0"]').inputValue() === "77",
      "R3j2: Back asks the same question, and a tap on the scrim keeps editing");
    const beforeDiscard = await readReplicas(page);
    await page.locator("[data-edcancel]").click();
    await answerDiscard("discard");
    await page.waitForSelector('.session--read[data-reading="a02-old"]', { timeout: 5000 });
    const afterDiscard = await readReplicas(page);
    assert(canonical(afterDiscard.local) === canonical(beforeDiscard.local) && canonical(afterDiscard.idb) === canonical(beforeDiscard.idb) &&
      afterDiscard.local.log.find((row) => row.session === "a02-old" && row.set === 1).load === 50,
    "R3j2: Discard changes returns to the saved session and writes nothing");
    assert(nativeDialogs.length === 0, "R3j2: no native confirm opened anywhere in the History editor", JSON.stringify(nativeDialogs));

    // Plan 064 R3j2: an invalid value keeps its reason under its row. The toast it replaced faded after
    // 2.4 seconds, so a lifter who looked away lost the only statement of what was wrong.
    await seedA02(a02Controls());
    await openEdit("a02-old");
    const beforeReason = await readReplicas(page);
    await editor("a02-old").locator('input[data-ek="load|0"]').fill("x");
    await page.locator('[data-edsave="a02-old"]').click();
    await page.waitForSelector(".session--edit [data-histedit-error]", { timeout: 5000 });
    const reason = await page.evaluate(() => {
      document.getAnimations().forEach((animation) => animation.finish());
      const input = document.querySelector('.session--edit input[data-ek="load|0"]');
      const row = input.closest(".edrow"), note = document.querySelector("[data-histedit-error]");
      const probe = document.createElement("i");
      probe.style.color = "var(--control-error-boundary)";
      document.body.append(probe);
      const errorColor = getComputedStyle(probe).color;
      probe.remove();
      const toast = document.querySelector("#toast");
      return {
        underRow: row.nextElementSibling === note, text: note.textContent.trim(), role: note.getAttribute("role"),
        invalid: input.getAttribute("aria-invalid"), describedBy: input.getAttribute("aria-describedby") === note.id && note.id.length > 0,
        focused: document.activeElement === input,
        border: getComputedStyle(input).borderTopColor === errorColor, noteInk: getComputedStyle(note).color === errorColor,
        toastShowsReason: !!toast && !toast.classList.contains("hidden") && toast.textContent.trim() === note.textContent.trim(),
      };
    });
    assert(reason.underRow && reason.text.length > 0 && reason.role === "alert" && reason.invalid === "true" && reason.describedBy && reason.focused,
      "R3j2: an invalid value is flagged on its field and its reason sits under that row as an alert", JSON.stringify(reason));
    assert(reason.border && reason.noteInk, "R3j2: the invalid field takes the error boundary and the reason reads in the same colour", JSON.stringify(reason));
    assert(!reason.toastShowsReason, "R3j2: the reason is not left to a toast", JSON.stringify(reason));
    await page.waitForTimeout(3200);
    assert(await page.locator(".session--edit [data-histedit-error]").count() === 1 &&
      await editor("a02-old").locator('input[data-ek="load|0"][aria-invalid="true"]').count() === 1,
    "R3j2: the reason is still on the page after the time a toast would have lasted");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterReason = await readReplicas(page);
    assert(canonical(afterReason.local) === canonical(beforeReason.local) && canonical(afterReason.idb) === canonical(beforeReason.idb),
      "R3j2: an invalid Save writes nothing");

    await editor("a02-old").locator('input[data-ek="load|0"]').fill("55");
    const fixed = await page.evaluate(() => {
      const input = document.querySelector('.session--edit input[data-ek="load|0"]');
      return { notes: document.querySelectorAll("[data-histedit-error]").length, invalid: input.hasAttribute("aria-invalid"), described: input.hasAttribute("aria-describedby") };
    });
    assert(fixed.notes === 0 && !fixed.invalid && !fixed.described,
      "R3j2: fixing the value removes the reason and the error state", JSON.stringify(fixed));

    // Still invalid after typing another bad value: the reason stays. Removing the row takes it away.
    await editor("a02-old").locator('input[data-ek="load|0"]').fill("y");
    await page.locator('[data-edsave="a02-old"]').click();
    await page.waitForSelector(".session--edit [data-histedit-error]", { timeout: 5000 });
    await editor("a02-old").locator('input[data-ek="load|0"]').fill("z");
    assert(await page.locator(".session--edit [data-histedit-error]").count() === 1,
      "R3j2: a value that is still invalid keeps its reason while the lifter types");
    await editor("a02-old").locator('[data-edrm="0"]').click();
    assert(await page.locator(".session--edit [data-histedit-error]").count() === 0 &&
      await page.locator(".session--edit [aria-invalid='true']").count() === 0,
    "R3j2: removing the row takes its reason with it");

    // The date field keeps its reason under the field, in its own words.
    await seedA02(a02Controls());
    await openEdit("a02-old");
    await page.evaluate(() => {
      const el = document.querySelector('.session--edit [data-ed="date"]');
      el.setAttribute("type", "text");
      el.value = "2024-02-30";
    });
    await page.locator('[data-edsave="a02-old"]').click();
    await page.waitForSelector(".session--edit [data-histedit-error]", { timeout: 5000 });
    const dateReason = await page.evaluate(() => {
      const field = document.querySelector('.session--edit [data-ed="date"]'), note = document.querySelector("[data-histedit-error]");
      return { under: field.closest(".histedit__date").nextElementSibling === note, text: note.textContent.trim(), expected: t("validation.date"),
        invalid: field.getAttribute("aria-invalid"), describedBy: field.getAttribute("aria-describedby") === note.id };
    });
    assert(dateReason.under && dateReason.text === dateReason.expected && dateReason.invalid === "true" && dateReason.describedBy,
      "R3j2: an impossible date keeps its reason under the date field", JSON.stringify(dateReason));
    await page.locator("[data-edcancel]").click();
    await page.waitForSelector('.session--read[data-reading="a02-old"]', { timeout: 5000 });
    assert(nativeDialogs.length === 0, "R3j2: no native confirm opened for an invalid edit either", JSON.stringify(nativeDialogs));

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\nhistory-edit: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((error) => { console.error("history-edit.mjs crashed:", error); process.exit(2); });
