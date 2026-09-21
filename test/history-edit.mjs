#!/usr/bin/env node
/**
 * Plan 057-P0: characterize the persisted History edit/delete boundary.
 *
 * This slice deliberately describes the current edit surface before the
 * read-first state machine is introduced. The durable snapshot is the
 * independent oracle: typing and cancelling must not change either replica;
 * Save changes only the selected session; Delete removes only its confirmed
 * target.
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
    page.on("dialog", (dialog) => dialog.accept());
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
    const afterCancel = await readReplicas(page);
    assert(canonical(afterCancel.local) === canonical(beforeEdit.local) && canonical(afterCancel.idb) === canonical(beforeEdit.idb),
      "Cancel restores the exact persisted snapshot");

    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("123.5");
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('.session--edit[data-editing="history-edit-a"]', { state: "detached", timeout: 5000 });
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

    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("130");
    const changedElsewhere = structuredClone((await readReplicas(page)).local);
    changedElsewhere.log.find((row) => row.session === "history-edit-a" && row.set === 2).load = 81;
    changedElsewhere._storageRevision = Number(changedElsewhere._storageRevision || 0) + 1;
    await writeState(page, changedElsewhere);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForSelector('[data-history-operation="conflict"]', { timeout: 5000 });
    const afterConflict = await readReplicas(page);
    assert(afterConflict.local.log.find((row) => row.session === "history-edit-a" && row.set === 1).load === 123.5 &&
      afterConflict.local.log.find((row) => row.session === "history-edit-a" && row.set === 2).load === 81,
      "Stale Save refuses to merge over a changed session", JSON.stringify(afterConflict.local.log));

    await page.locator('[data-history-reload]').click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[data-history-edit="history-edit-a"]', { timeout: 5000 });
    await page.locator('[data-history-edit="history-edit-a"]').click();
    await page.locator('.session--edit[data-editing="history-edit-a"] input[data-ek^="load|"]').first().fill("140");
    const exactRetry = structuredClone((await readReplicas(page)).local);
    exactRetry.log.find((row) => row.session === "history-edit-a" && row.set === 1).load = 140;
    exactRetry._storageRevision = Number(exactRetry._storageRevision || 0) + 1;
    await writeState(page, exactRetry);
    await page.locator('[data-edsave="history-edit-a"]').click();
    await page.waitForTimeout(1000);
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
