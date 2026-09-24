#!/usr/bin/env node
/**
 * Plan 057 F057-01 reproduction: an already-committed History edit must settle
 * under the same durable lock as replica reconciliation.  If reconciliation
 * happens after the lock is released, an unrelated cross-document commit can be
 * overwritten by the stale head captured by the first document.
 */
import { pathToFileURL } from "node:url";
import { launchChromium } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const A_SESSION = "history-race-a";
const B_SESSION = "history-race-b";
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
    () => typeof window.__repforgeStorage?.flush === "function",
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

async function writeReplicas(page, value) {
  await page.evaluate(async ({ key, state }) => {
    localStorage.setItem(key, JSON.stringify(state));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("kv", "readwrite");
      transaction.objectStore("kv").put(state, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { key: KEY, state: value });
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

function sessionRows(session, date, day, exerciseId, load) {
  return [1, 2].map((set) => ({
    session, date, day, exerciseId, set, load, reps: 8, rir: 1, notes: "",
    created: `${date}T12:00:00.000Z`, name: "Hack squat", primary: "Quads", secondary: "Glutes",
  }));
}

function rowFor(state, session, set = 1) {
  return state.log.find((row) => row.session === session && row.set === set);
}

async function main() {
  const browser = await launchChromium();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      serviceWorkers: "block",
    });
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(pageA);
    await clearState(pageA);
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(pageA);
    const seeded = await installSeedProgram(pageA, { key: KEY, waitFor: waitForApp });
    const day = seeded.program[0];
    const base = {
      ...seeded,
      log: [
        ...sessionRows(A_SESSION, "2026-08-20", day.day, day.id, 80),
        ...sessionRows(B_SESSION, "2026-08-19", day.day, day.id, 60),
      ],
    };
    await writeReplicas(pageA, base);
    await pageA.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(pageA);
    await pageA.locator('nav button[data-view="history"]').click();
    await pageA.locator(`#sessions [data-sess="${A_SESSION}"] .session__open`).click();
    await pageA.locator(`[data-history-edit="${A_SESSION}"]`).click();
    const aInput = pageA.locator(`.session--edit[data-editing="${A_SESSION}"] input[data-ek^="load|"]`).first();
    await aInput.fill("123.5");

    await pageB.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(pageB);

    // The independent document commits A' through the production durable path.
    // A's editor in page A is now an exact delayed retry, not a second merge.
    const aCommit = await pageB.evaluate(async ({ key, session }) => {
      const proposal = JSON.parse(localStorage.getItem(key));
      const row = proposal.log.find((item) => item.session === session && item.set === 1);
      row.load = 123.5;
      return window.__repforgeCommitProposedState(proposal);
    }, { key: KEY, session: A_SESSION });
    assert(aCommit?.committed === true && aCommit?.settled === true,
      "the first document's desired edit is durably committed before the delayed retry", JSON.stringify(aCommit));
    const afterA = await readReplicas(pageA);
    const aRevision = Number(afterA.local?._storageRevision || 0);
    assert(Number(afterA.local?._storageRevision || 0) > Number(base._storageRevision || 0) &&
      Number(afterA.idb?._storageRevision || 0) === aRevision,
    "the exact desired session is present in both replicas at one revision");

    // Force the already-committed branch to observe a non-equivalent replica.
    // This is a fault injection, not the mutation under test.
    await writeReplicas(pageA, { ...base, _storageRevision: Number(base._storageRevision || 0) });
    await pageA.evaluate(async (state) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("repforge", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("kv", "readwrite");
        transaction.objectStore("kv").put(state, "repforge_v1");
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    }, base);
    // Restore the committed A' to localStorage while retaining the stale IDB.
    await pageA.evaluate((state) => localStorage.setItem("repforge_v1", JSON.stringify(state)), afterA.local);

    // The durable owner exposes this test-only synchronization seam while the
    // shared lock is held. No production timing or retry is involved.
    await pageA.evaluate(() => {
      window.__historyRace = { entered: false, released: false };
      window.__repforgeDurableStateTestHooks = {
        durableSettlementLockHeld: async () => {
          window.__historyRace.entered = true;
          await new Promise((resolve) => { window.__releaseHistoryRace = resolve; });
        },
      };
    });
    const savePromise = pageA.locator(`[data-edsave="${A_SESSION}"]`).click();
    await pageA.waitForFunction(() => window.__historyRace?.entered === true, undefined, { timeout: 5000 });

    // Start B' through the normal durable owner. A correct settlement owns the
    // shared lock here, so B's mutation must be pending until A's reconciliation
    // has reread the replicas and healed them. The old UI heal is outside that
    // lock, allowing B' to commit and then be overwritten by the stale A head.
    await pageB.evaluate(({ key, session }) => {
      const proposal = JSON.parse(localStorage.getItem(key));
      const row = proposal.log.find((item) => item.session === session && item.set === 1);
      row.load = 65;
      window.__historyRaceBStarted = true;
      void window.__repforgeCommitProposedState(proposal).then((result) => {
        window.__historyRaceBResult = result;
        window.__historyRaceBDone = true;
      }).catch((error) => {
        window.__historyRaceBResult = { error: String(error) };
        window.__historyRaceBDone = true;
      });
    }, { key: KEY, session: B_SESSION });

    const ordering = await Promise.race([
      pageA.waitForFunction(async () => {
        const locks = await navigator.locks.query();
        return locks.pending.some((lock) => lock.name === "repforge:state-write");
      }, undefined, { timeout: 5000 }).then(() => "queued"),
      pageB.waitForFunction(() => window.__historyRaceBDone === true, undefined, { timeout: 5000 }).then(() => "done"),
    ]);
    assert(ordering === "queued",
      "the unrelated durable mutation remains queued behind History settlement", ordering);
    const bResult = await pageB.evaluate(() => window.__historyRaceBResult);
    assert(ordering === "queued" && bResult == null,
      "B' has not committed while the first durable settlement owns the lock", JSON.stringify(bResult));

    await pageA.evaluate(() => {
      window.__historyRace.released = true;
      window.__releaseHistoryRace?.();
    });
    await savePromise;
    await pageB.waitForFunction(() => window.__historyRaceBDone === true, undefined, { timeout: 5000 });
    const committedB = await pageB.evaluate(() => window.__historyRaceBResult);
    assert(committedB?.committed === true && committedB?.settled === true,
      "the unrelated document commits after History settlement releases the lock", JSON.stringify(committedB));
    await pageA.evaluate(() => { delete window.__repforgeDurableStateTestHooks; });
    await pageA.waitForSelector(`[data-history-edit="${A_SESSION}"]`, { timeout: 5000 });
    await pageA.evaluate(() => window.__repforgeStorage.flush());
    const final = await readReplicas(pageA);
    const finalA = rowFor(final.local, A_SESSION);
    const finalB = rowFor(final.local, B_SESSION);
    const pending = await pageA.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("repforge_pending_v1:")));
    assert(Number(finalA?.load) === 123.5 && Number(finalB?.load) === 65,
      "settlement preserves both the exact A' edit and unrelated B'", JSON.stringify({ finalA, finalB }));
    assert(final.local.log.filter((row) => row.session === A_SESSION).length === 2 &&
      final.local.log.filter((row) => row.session === B_SESSION).length === 2,
    "settlement does not duplicate either History session", JSON.stringify(final.local.log));
    assert(JSON.stringify(final.local) === JSON.stringify(final.idb),
      "settlement leaves localStorage and IndexedDB equal");
    assert(Number(final.local?._storageRevision || 0) >= Number(committedB?.revision || 0) &&
      Number(final.local?._storageRevision || 0) >= aRevision,
    "settlement never moves the durable revision backwards", JSON.stringify({ final: final.local?._storageRevision, aRevision, bRevision: committedB?.revision }));
    assert(pending.length === 0,
      "settlement clears the pending write-ahead entry", JSON.stringify(pending));

    await context.close();
  } finally {
    await browser.close();
  }
  console.log(`\nhistory-persistence-race: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) main().catch((error) => { console.error(error); process.exit(2); });
