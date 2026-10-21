#!/usr/bin/env node
/**
 * Plan 057-P2: History Delete must survive an interrupted durable write.
 *
 * The fault is injected into the production storage adapter after the local
 * replica has accepted the proposed snapshot and before the adapter can
 * settle. Reloading the same page then exercises the real WAL/boot replay
 * owner. The oracle accepts only the complete old session or the complete
 * deleted session, never a mixed or half-deleted result.
 */
import assert from "node:assert/strict";
import { launchChromium, waitForAsyncCondition } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function",
    undefined,
    { timeout: 15000 },
  );
  await page.evaluate(() => {
    window.closeFirstRun?.();
    if (document.querySelector("#onboarding.active")) window.closeOnboarding?.();
  });
}

async function clearSite(page) {
  await page.evaluate(async (key) => {
    localStorage.removeItem(key);
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  }, KEY);
}

async function writeBoth(page, value) {
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
  }, { key: KEY, value });
}

async function readReplicas(page) {
  return page.evaluate(async (key) => {
    const local = JSON.parse(localStorage.getItem(key) || "null");
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
    const pending = Object.keys(localStorage).filter((name) =>
      name.startsWith("repforge_pending_v1:"));
    return { local, idb, pending };
  }, KEY);
}

function rows(session, day, name, exerciseId, load) {
  return [1, 2].map((set) => ({
    session,
    date: "2026-09-18",
    day,
    name,
    exerciseId,
    set,
    load,
    reps: 8,
    rir: 1,
    notes: "",
    created: "2026-09-18T12:00:00.000Z",
    primary: "Chest",
    secondary: "",
  }));
}

const browser = await launchChromium();
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearSite(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await installSeedProgram(page, { key: KEY, waitFor: waitForApp });

  const seed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
  const day = seed.program[0].day;
  const target = rows("delete-crash-target", day, seed.program[0].name, seed.program[0].id, 77);
  const survivor = rows("delete-crash-survivor", seed.program[1].day, seed.program[1].name, seed.program[1].id, 55).slice(0, 1);
  const original = { ...seed, log: [...target, ...survivor], _storageRevision: 12 };
  await writeBoth(page, original);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.locator('nav button[data-view="history"]').click();
  await page.waitForSelector("#history.view.active");
  await page.locator('#sessions [data-sess="delete-crash-target"] .session__open').click();
  await page.waitForSelector('[data-reading="delete-crash-target"]');
  // The ESM controller must use its injected window; the former classic
  // `root` alias is unavailable and a swallowed ReferenceError loses this call.
  await page.evaluate(() => {
    window.__historyScrollCalls=0;
    window.__historyOriginalScroll=window.scrollTo;
    window.scrollTo=function(...args){window.__historyScrollCalls++;return window.__historyOriginalScroll.apply(window,args)};
  });
  await page.locator('[data-history-edit="delete-crash-target"]').click();
  await page.waitForSelector('[data-editing="delete-crash-target"]');
  assert.equal(await page.evaluate(()=>window.__historyScrollCalls),1,'entering the actual History editor scrolls through its owned window capability');
  await page.evaluate(()=>{window.scrollTo=window.__historyOriginalScroll;delete window.__historyOriginalScroll});
  await page.locator('[data-history-back]').click();
  await page.locator('#sessions [data-sess="delete-crash-target"] .session__open').click();
  await page.waitForSelector('[data-reading="delete-crash-target"]');
  await page.locator('[data-reading="delete-crash-target"] [data-del="delete-crash-target"]').click();
  await page.waitForSelector('[data-history-delete-confirm="delete-crash-target"]');

  await page.evaluate(() => {
    const io = window.__repforgeStorage.durable.storageIO;
    const originalWriteLocal = io.writeLocal;
    io.writeLocal = async function (snapshot) {
      const accepted = await originalWriteLocal.call(this, snapshot);
      window.__historyDeleteCrashReached = true;
      await new Promise(() => {});
      return accepted;
    };
  });
  await page.locator('[data-history-delete-confirm="delete-crash-target"]').click();
  await page.waitForFunction(() => window.__historyDeleteCrashReached === true, undefined, { timeout: 8000 });

  // Navigation interrupts the in-flight write exactly as a renderer crash
  // would. The retained journal is the only evidence available to the next
  // boot.
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.waitForFunction((key) => !Object.keys(localStorage).some((name) => name.startsWith("repforge_pending_v1:")) &&
    Boolean(JSON.parse(localStorage.getItem(key) || "null")?._storageRevision), KEY, { timeout: 10000 });
  const recovered = await readReplicas(page);
  const localTarget = recovered.local.log.filter((row) => row.session === "delete-crash-target");
  const idbTarget = recovered.idb.log.filter((row) => row.session === "delete-crash-target");
  const localSurvivor = recovered.local.log.filter((row) => row.session === "delete-crash-survivor");
  const idbSurvivor = recovered.idb.log.filter((row) => row.session === "delete-crash-survivor");
  const completeTargetState =
    (localTarget.length === 0 && idbTarget.length === 0) ||
    (localTarget.length === target.length && idbTarget.length === target.length &&
      localTarget.every((row, index) => row.set === target[index].set && row.load === target[index].load) &&
      idbTarget.every((row, index) => row.set === target[index].set && row.load === target[index].load));
  assert.equal(JSON.stringify(recovered.local), JSON.stringify(recovered.idb),
    "History Delete crash replay converges localStorage and IndexedDB");
  assert.equal(completeTargetState, true,
    "crash replay retains the complete old session or deletes it completely",
    JSON.stringify({ localTarget, idbTarget }));
  assert.equal(localSurvivor.length, 1, "crash replay keeps the unrelated survivor in localStorage");
  assert.equal(idbSurvivor.length, 1, "crash replay keeps the unrelated survivor in IndexedDB");
  assert.equal(new Set(recovered.local.log.map((row) => row.session)).size, 1 + (localTarget.length ? 1 : 0),
    "crash replay keeps unrelated History rows and never duplicates the target");
  assert.equal(recovered.pending.length, 0,
    "History Delete crash replay drains its WAL evidence");

  // A correction that reached only one replica remains a retryable operation,
  // not a settled save. Retry must use the durable owner even when the desired
  // rows are already visible in localStorage.
  await page.locator('nav button[data-view="history"]').click();
  await page.locator('#sessions [data-sess="delete-crash-survivor"] .session__open').click();
  await page.locator('[data-reading="delete-crash-survivor"] [data-history-edit]').click();
  const loadInput=page.locator('.session--edit input[data-ek^="load|"],.session--edit input[data-ek^="metric|"]').first();
  await loadInput.fill("56");
  await page.evaluate(() => {
    const io=window.__repforgeStorage.durable.storageIO;
    window.__historyRetryWriteIdb=io.writeIdb;
    io.writeIdb=async()=>false;
  });
  await page.locator('[data-edsave="delete-crash-survivor"]').click();
  await page.waitForSelector('[data-history-retry]',{timeout:10000});
  const unsettled=await readReplicas(page);
  assert.equal(unsettled.local.log.find(row=>row.session==="delete-crash-survivor")?.load,56,
    "one replica retains the requested correction");
  assert.equal(unsettled.idb.log.find(row=>row.session==="delete-crash-survivor")?.load,55,
    "failed replica proves the correction is not settled");
  await page.evaluate(() => {
    window.__repforgeStorage.durable.storageIO.writeIdb=window.__historyRetryWriteIdb;
    delete window.__historyRetryWriteIdb;
  });
  await page.locator('[data-history-retry]').click();
  await page.waitForSelector('[data-reading="delete-crash-survivor"]',{timeout:15000});
  const retried=await readReplicas(page);
  assert.deepEqual(retried.local,retried.idb,"Retry publishes only a converged acknowledged history head");
  assert.equal(retried.local.log.find(row=>row.session==="delete-crash-survivor")?.load,56,
    "Retry preserves the requested correction and original session identity");
  assert.equal(retried.pending.length,0,"Retry leaves no unsettled WAL before returning to read mode");

  await context.close();

  // A History write can queue behind another tab's storage lock. Cancelling
  // while it waits must win: the lock-held preflight rechecks the operation,
  // so neither replica changes and no success is announced.
  for (const operation of ["delete", "edit"]) {
    const cancelContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const app = await cancelContext.newPage();
    await app.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(app);
    await clearSite(app);
    await app.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(app);
    await installSeedProgram(app, { key: KEY, waitFor: waitForApp });
    const seeded = await app.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}"), KEY);
    const session = `cancel-${operation}`;
    const before = { ...seeded, log: rows(session, seeded.program[0].day, seeded.program[0].name, seeded.program[0].id, 77), _storageRevision: 12 };
    await writeBoth(app, before);
    await app.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(app);
    await app.locator('nav button[data-view="history"]').click();
    await app.waitForSelector("#history.view.active");
    await app.locator(`#sessions [data-sess="${session}"] .session__open`).click();
    await app.waitForSelector(`[data-reading="${session}"]`);
    if (operation === "delete") {
      await app.locator(`[data-reading="${session}"] [data-del="${session}"]`).click();
      await app.waitForSelector(`[data-history-delete-confirm="${session}"]`);
    } else {
      await app.locator(`[data-history-edit="${session}"]`).click();
      await app.locator(".session--edit .edrow__in").first().fill("80");
    }

    const holder = await cancelContext.newPage();
    await holder.goto(new URL("manifest.webmanifest", BASE).href);
    await holder.evaluate(() => {
      void navigator.locks.request("repforge:state-write", async () => {
        window.__storageLockHeld = true;
        await new Promise((resolve) => { window.__releaseStorageLock = resolve; });
      });
    });
    await holder.waitForFunction(() => window.__storageLockHeld === true);
    await app.evaluate(() => {
      window.__historyToasts = [];
      new MutationObserver(() => {
        const text = document.querySelector("#toast")?.textContent?.trim();
        if (text) window.__historyToasts.push(text);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await app.locator(operation === "delete" ? `[data-history-delete-confirm="${session}"]` : `[data-edsave="${session}"]`).click();
    await waitForAsyncCondition(holder, async () =>
      (await navigator.locks.query()).pending.some((lock) => lock.name === "repforge:state-write"));
    if (operation === "delete") {
      await app.locator("[data-history-delete-cancel]").click();
    } else {
      await app.locator("[data-edcancel]").click();
      await app.locator("#historyDiscardDrop").click();
    }
    await app.waitForSelector(`[data-reading="${session}"]`);
    await holder.evaluate(() => window.__releaseStorageLock());
    await waitForAsyncCondition(holder, async () => {
      const held = await navigator.locks.query();
      return ![...held.held, ...held.pending].some((lock) => lock.name === "repforge:state-write");
    });
    await app.evaluate(() => window.__repforgeStorage.flush());
    const after = await readReplicas(app);
    for (const [name, replica] of [["localStorage", after.local], ["IndexedDB", after.idb]]) {
      assert.deepEqual(replica.log.filter((row) => row.session === session).map((row) => row.load), [77, 77],
        `${operation} cancelled while queued for the storage lock leaves ${name} unchanged`);
    }
    assert.equal(after.pending.length, 0, `cancelled ${operation} leaves no pending journal`);
    const announced = await app.evaluate(() => window.__historyToasts);
    assert.equal(announced.some((text) => /deleted|updated|excluída|atualizada/i.test(text)), false,
      `cancelled ${operation} never announces success: ${JSON.stringify(announced)}`);
    await cancelContext.close();
  }
} finally {
  await browser.close();
}

console.log("PASS: history delete crash/replay");
