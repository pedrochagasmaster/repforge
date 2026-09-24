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
import { launchChromium } from "./browser.mjs";
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
  await page.locator('[data-reading="delete-crash-target"] [data-del="delete-crash-target"]').click();
  await page.waitForSelector('[data-history-delete-confirm="delete-crash-target"]');

  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
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

  await context.close();
} finally {
  await browser.close();
}

console.log("PASS: history delete crash/replay");
