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
    let dialogDecision = "accept";
    page.on("dialog", async (dialog) => {
      if (dialogDecision === "dismiss") {
        dialogDecision = "accept";
        await dialog.dismiss();
        return;
      }
      await dialog.accept();
    });
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
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { timeout: 5000 });
    const editingA11y = await page.evaluate(() => ({
      heading: document.querySelector('[data-history-editing-heading]')?.textContent.trim() || "",
      status: document.querySelector('[data-history-editing-status]')?.textContent.trim() || "",
      role: document.querySelector('[data-history-editing-status]')?.getAttribute("role") || "",
      focused: document.activeElement?.matches?.('[data-history-editing-heading], .session--edit input, .session--edit [data-ed="date"]') || false,
    }));
    assert(editingA11y.heading.length > 0 && editingA11y.status.length > 0 && editingA11y.role === "status" && editingA11y.focused,
      "entering History Edit announces and focuses the editing state", editingA11y);
    const editorName = await page.locator('.session--edit[data-editing="history-edit-a"] .edrow__name').first().textContent();
    assert(editorName?.includes("A Very Long Exercise Name That Must Remain Whole"),
      "The characterized editor exposes the complete exercise identity", editorName);

    const input = page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first();
    await input.fill("123.5");
    await page.evaluate(() => window.__repforgeStorage.flush());
    const afterTyping = await readReplicas(page);
    assert(canonical(afterTyping.local) === canonical(beforeEdit.local) && canonical(afterTyping.idb) === canonical(beforeEdit.idb),
      "Typing an edit field makes zero durable change before Save",
      JSON.stringify({ localChanged: canonical(afterTyping.local) !== canonical(beforeEdit.local), idbChanged: canonical(afterTyping.idb) !== canonical(beforeEdit.idb) }));

    await page.locator("[data-edcancel]").click();
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
    dialogDecision = "dismiss";
    await page.locator('[data-history-back]').click();
    await page.waitForSelector('[data-history-operation="failure"]', { timeout: 5000 });
    assert(dialogDecision === "accept", "Back from a dirty failed edit requires explicit discard confirmation");
    await page.locator('[data-history-back]').click();
    await page.waitForSelector('#historyCalendar:not(.hidden)', { timeout: 5000 });
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

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\nhistory-edit: ${results.passed} passed, ${results.failed} failed`);
  process.exit(results.failed > 0 ? 1 : 0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch((error) => { console.error("history-edit.mjs crashed:", error); process.exit(2); });
