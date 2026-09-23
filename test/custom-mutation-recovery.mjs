#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DB = "repforge";
const STORE = "kv";

const results = { passed: 0, failed: 0 };
function check(condition, name, detail) {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.error(`  ✗ ${name}`);
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
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
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

async function openNewCustom(page, name) {
  await page.evaluate(() => window.__repforgeOpenLibrary({}));
  await page.waitForSelector("#library.active", { timeout: 5000 });
  await page.click("#libCustom");
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
  await page.locator("#exCustomName").fill(name);
  await page.locator("#exCustomEquip .pchip").first().click();
  await page.locator("#exCustomPrimary .pchip").first().click();
}

async function seedCustomFixture(page, name) {
  const outcome = await page.evaluate(async (exerciseName) => {
    const saved = await window.__repforgeSaveCustomExercise({
      name: exerciseName,
      equipment: ["machine"],
      primary: "Chest",
      secondary: "",
      notes: "Seeded for custom mutation recovery",
    });
    return { id: saved.entry?.id || null, committed: saved.result?.committed, settled: saved.result?.settled };
  }, name);
  if (!outcome.id || outcome.committed !== true || outcome.settled !== true)
    throw new Error(`Could not seed custom exercise ${name}: ${JSON.stringify(outcome)}`);
  return outcome.id;
}

async function openCustomEdit(page, id) {
  await page.evaluate((customId) => window.__repforgeEditCustom(customId), id);
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
}

async function installLocalOnlyFault(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeIdb;
    let calls = 0;
    io.writeIdb = (snapshot) => {
      calls++;
      window.__customIdbWriteCalls = calls;
      if (calls === 1) return Promise.resolve(false);
      if (calls === 2) return new Promise((resolve, reject) => {
        window.__releaseCustomRecoveryWrite = () => original.call(io, snapshot).then(resolve, reject);
      });
      return original.call(io, snapshot);
    };
  });
}

async function installImmediateLocalOnlyFault(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeIdb;
    let calls = 0;
    io.writeIdb = snapshot => {
      calls++;
      if (calls === 1) return Promise.resolve(false);
      return original.call(io, snapshot);
    };
  });
}

async function installIdbOnlyFault(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeLocal;
    let calls = 0;
    io.writeLocal = (snapshot) => {
      calls++;
      window.__customLocalWriteCalls = calls;
      if (calls === 1) return Promise.resolve(false);
      if (calls === 2) return new Promise((resolve, reject) => {
        window.__releaseCustomRecoveryWrite = () => original.call(io, snapshot).then(resolve, reject);
      });
      return original.call(io, snapshot);
    };
  });
}

async function installTwoPhaseReplicaFault(page, successfulReplica) {
  await page.evaluate((target) => {
    const io = window.RepForgeDurableState.storageIO;
    const method = target === "local" ? "writeIdb" : "writeLocal";
    const original = io[method];
    let calls = 0;
    io[method] = (snapshot) => {
      calls++;
      window.__customMutationWriteCalls = calls;
      if (calls === 1) return new Promise((resolve) => {
        window.__releaseInitialCustomWrite = () => resolve(false);
      });
      if (calls === 2) return new Promise((resolve, reject) => {
        window.__releaseCustomRecoveryWrite = () => original.call(io, snapshot).then(resolve, reject);
      });
      return original.call(io, snapshot);
    };
  }, successfulReplica);
}

async function installRecoverableCreateRetryFault(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeIdb;
    const settle = window.RepForgeDurableState.settleCustomExerciseMutation;
    let calls = 0;
    io.writeIdb = (snapshot) => {
      calls++;
      window.__customMutationWriteCalls = calls;
      if (calls < 3) return Promise.resolve(false);
      return original.call(io, snapshot);
    };
    window.__customSettlementResults = [];
    window.RepForgeDurableState.settleCustomExerciseMutation = async (...args) => {
      const result = await settle(...args);
      window.__customSettlementResults.push(result);
      return result;
    };
  });
}

async function installBothReplicaFailure(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const writeLocal = io.writeLocal;
    const writeIdb = io.writeIdb;
    io.writeLocal = async () => false;
    io.writeIdb = async () => false;
    window.__restoreCustomStorageIO = () => {
      io.writeLocal = writeLocal;
      io.writeIdb = writeIdb;
      delete window.__restoreCustomStorageIO;
    };
  });
}

async function installDeferredJournalCleanup(page) {
  await page.evaluate(() => {
    const originalRemove = Storage.prototype.removeItem;
    let failed = false;
    localStorage.removeItem = function (key) {
      if (!failed && String(key).startsWith("repforge_pending_v1:")) {
        failed = true;
        throw new DOMException("Injected WAL cleanup failure", "QuotaExceededError");
      }
      return originalRemove.call(this, key);
    };
    window.__restoreStorageRemoval = () => {
      delete localStorage.removeItem;
      delete window.__restoreStorageRemoval;
    };
    window.__repforgeDurableStateTestHooks ||= {};
    window.__repforgeDurableStateTestHooks.durableSettlementLockHeld = async ({ pendingJournalId }) => {
      window.__customSettlementJournalId = pendingJournalId;
      const io = window.RepForgeDurableState.storageIO;
      const originalLocal = io.writeLocal;
      let gated = false;
      io.writeLocal = (snapshot) => {
        if (!gated) {
          gated = true;
          return new Promise((resolve, reject) => {
            window.__releaseUnrelatedJournalWrite = () => originalLocal.call(io, snapshot).then(resolve, reject);
          });
        }
        return originalLocal.call(io, snapshot);
      };
      const unrelated = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      unrelated.programMeta.name = "Unrelated queued mutation";
      window.__customUnrelatedPromise = window.__repforgeCommitProposedState(unrelated);
      window.__releaseCustomSettlement = null;
      await new Promise((resolve) => { window.__releaseCustomSettlement = resolve; });
    };
  });
}

async function installTransferFreezeAfterFirstCustomWrite(page) {
  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const writeLocal = io.writeLocal;
    let frozen = false;
    io.writeLocal = async snapshot => {
      const result = await writeLocal.call(io, snapshot);
      if (!frozen) {
        frozen = true;
        window.RepForgeDurableState.setMutationFreezeCheck(() => true);
      }
      return result;
    };
  });
}

async function testCreateWaitsForReplicaRecovery(page) {
  const name = "Local only until recovery";
  await reset(page);
  await openNewCustom(page, name);
  await installLocalOnlyFault(page);
  await page.click("#exCustomSave");

  await page.waitForFunction(() => typeof window.__releaseCustomRecoveryWrite === "function",
    undefined, { timeout: 5000 });

  const ui = await page.evaluate(() => ({
    visible: !document.querySelector("#exCustomSheet")?.hidden,
    phase: document.querySelector("#exCustomSheet")?.dataset.phase || null,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    recoveryWriteGated: typeof window.__releaseCustomRecoveryWrite === "function",
    idbWriteCalls: window.__customIdbWriteCalls || 0,
    localWriteCalls: window.__customLocalWriteCalls || 0,
  }));
  const replicas = await readReplicas(page);
  const localEntry = replicas.local?.customExercises?.find((entry) => entry.name === name) || null;
  const idbEntry = replicas.idb?.customExercises?.find((entry) => entry.name === name) || null;

  check(ui.visible && ui.phase === "recovering" && ui.busy === "true" && ui.inert === true,
    "a local-only create stays in an inert recovery phase", ui);
  check(ui.recoveryWriteGated && !!localEntry && !idbEntry,
    "recovery waits after independently observing the local-only replica", { ui, localEntry, idbEntry });
  check(!ui.toast.includes("Exercise created."),
    "create success is not announced before replica settlement", ui.toast);

  if (ui.recoveryWriteGated) {
    await page.evaluate(() => window.__releaseCustomRecoveryWrite());
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    const settled = await readReplicas(page);
    const localRows = settled.local?.customExercises?.filter((entry) => entry.name === name) || [];
    const idbRows = settled.idb?.customExercises?.filter((entry) => entry.name === name) || [];
    check(localRows.length === 1 && idbRows.length === 1 && localRows[0].id === idbRows[0].id,
      "recovery settles the same single custom identity in both replicas", { localRows, idbRows });
  }
}

async function testCreateWaitsForIdbRecovery(page) {
  const name = "IDB only until recovery";
  await reset(page);
  await openNewCustom(page, name);
  await installIdbOnlyFault(page);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => typeof window.__releaseCustomRecoveryWrite === "function",
    undefined, { timeout: 5000 });

  const ui = await page.evaluate(() => ({
    visible: !document.querySelector("#exCustomSheet")?.hidden,
    phase: document.querySelector("#exCustomSheet")?.dataset.phase || null,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    recoveryWriteGated: typeof window.__releaseCustomRecoveryWrite === "function",
  }));
  const replicas = await readReplicas(page);
  const localEntry = replicas.local?.customExercises?.find((entry) => entry.name === name) || null;
  const idbEntry = replicas.idb?.customExercises?.find((entry) => entry.name === name) || null;

  check(ui.visible && ui.phase === "recovering" && ui.busy === "true" && ui.inert === true,
    "an IDB-only create stays in an inert recovery phase", ui);
  check(ui.recoveryWriteGated && !localEntry && !!idbEntry,
    "recovery waits after independently observing the IDB-only replica", { ui, localEntry, idbEntry });
  check(!ui.toast.includes("Exercise created."),
    "IDB-only create success is not announced before settlement", ui.toast);

  if (ui.recoveryWriteGated) {
    await page.evaluate(() => window.__releaseCustomRecoveryWrite());
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
    const settled = await readReplicas(page);
    const localRows = settled.local?.customExercises?.filter((entry) => entry.name === name) || [];
    const idbRows = settled.idb?.customExercises?.filter((entry) => entry.name === name) || [];
    check(localRows.length === 1 && idbRows.length === 1 && localRows[0].id === idbRows[0].id,
      "IDB-only recovery settles the same single custom identity in both replicas", { localRows, idbRows });
  }
}

async function testCreateBothReplicasFail(page) {
  const name = "Both writes fail";
  await reset(page);
  await openNewCustom(page, name);
  await installBothReplicaFailure(page);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => {
    const sheet = document.querySelector("#exCustomSheet");
    const save = document.querySelector("#exCustomSave");
    return sheet?.dataset.phase === "editing" && !save?.disabled;
  }, undefined, { timeout: 5000 });

  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    name: document.querySelector("#exCustomName")?.value,
    focus: document.activeElement?.id,
  }));
  const failed = await readReplicas(page);
  const localRows = failed.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const idbRows = failed.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  check(ui.phase === "editing" && ui.busy !== "true" && ui.inert === false && ui.name === name,
    "a fully rejected create returns to an actionable form with its draft intact", ui);
  check(localRows.length === 0 && idbRows.length === 0,
    "both failed replicas contain no custom definition", { localRows, idbRows });
  check(ui.focus === "exCustomSave", "focus returns to Save after a failed write", ui.focus);

  await page.evaluate(() => window.__restoreCustomStorageIO());
  await page.click("#exCustomSave");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const retried = await readReplicas(page);
  const localRetried = retried.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const idbRetried = retried.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  check(localRetried.length === 1 && idbRetried.length === 1 && localRetried[0].id === idbRetried[0].id,
    "an actionable retry creates one definition in both replicas", { localRetried, idbRetried });
}

async function testCreateNormalCommitAndReload(page) {
  const name = "Normal durable custom create";
  await reset(page);
  await openNewCustom(page, name);
  await page.click("#exCustomSave");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const saved = await readReplicas(page);
  const localRows = saved.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const idbRows = saved.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  check(localRows.length === 1 && idbRows.length === 1 && localRows[0].id === idbRows[0].id,
    "normal create writes one matching definition to both replicas", { localRows, idbRows });
  check(await page.locator("#toast").textContent().then((value) => value.includes("Exercise created.")),
    "normal create announces success only after the sheet closes");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const reloaded = await readReplicas(page);
  const reloadLocal = reloaded.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const reloadIdb = reloaded.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  check(reloadLocal.length === 1 && reloadIdb.length === 1 &&
      JSON.stringify(reloadLocal[0]) === JSON.stringify(localRows[0]) &&
      JSON.stringify(reloadIdb[0]) === JSON.stringify(localRows[0]),
    "normal custom create reloads with the exact durable definition", { reloadLocal, reloadIdb, expected: localRows[0] });
}

async function testCreateReconcilesBeforeRetryWithStableIdentity(page) {
  const name = "Create identity survives recovery retry";
  await reset(page);
  await openNewCustom(page, name);
  await installRecoverableCreateRetryFault(page);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => {
    const sheet = document.querySelector("#exCustomSheet");
    return sheet?.dataset.phase === "recovering" &&
      document.querySelector("#exCustomRecoveryRetry")?.hidden === false;
  }, undefined, { timeout: 5000 });
  const unresolved = await readReplicas(page);
  const localRows = unresolved.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const idbRows = unresolved.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  const beforeRevision = unresolved.local?._storageRevision;
  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    retryVisible: !document.querySelector("#exCustomRecoveryRetry")?.hidden,
    retryEnabled: !document.querySelector("#exCustomRecoveryRetry")?.disabled,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    calls: window.__customMutationWriteCalls,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  check(localRows.length === 1 && idbRows.length === 0 &&
      ui.phase === "recovering" && ui.retryVisible && ui.retryEnabled && ui.busy === "true" && ui.inert === true,
    "an unresolved partial create remains recovery-owned with an explicit retry route", { ui, localRows, idbRows });
  check(!ui.toast.includes("Exercise created."), "partial create does not announce success before retry", ui.toast);
  const stableId = localRows[0]?.id;

  await page.evaluate(() => document.querySelector("#exCustomSave")?.click());
  const beforeRetry = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    calls: window.__customMutationWriteCalls,
  }));
  check(beforeRetry.phase === "recovering" && beforeRetry.calls === 2,
    "recovery does not expose or perform a blind second Save", beforeRetry);

  await page.click("#exCustomRecoveryRetry");
  await page.waitForFunction(() => window.__customSettlementResults?.length === 2,
    undefined, { timeout: 5000 });
  const retryDebug = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    calls: window.__customMutationWriteCalls,
    retry: document.querySelector("#exCustomRecoveryRetry")?.disabled,
    receipts: window.__customSettlementResults?.map(result => ({
      status: result.status, kind: result.kind, committed: result.committed,
      settled: result.settled, code: result.code, revision: result.revision,
    })),
  }));
  check(retryDebug.calls === 3 && retryDebug.receipts?.at(-1)?.committed === true &&
      retryDebug.receipts?.at(-1)?.settled === true,
    "owner recovery retry returns a normalized settled receipt", retryDebug);
  if (retryDebug.receipts?.at(-1)?.committed !== true || retryDebug.receipts?.at(-1)?.settled !== true) return;
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const settled = await readReplicas(page);
  const finalLocal = settled.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const finalIdb = settled.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  check(finalLocal.length === 1 && finalIdb.length === 1 &&
      finalLocal[0].id === stableId && finalIdb[0].id === stableId,
    "owner recovery retry settles the original create identity once", { stableId, finalLocal, finalIdb });
  check(settled.local?._storageRevision === beforeRevision && settled.idb?._storageRevision === beforeRevision,
    "replica healing and journal cleanup do not create a second semantic revision", {
      beforeRevision, localRevision: settled.local?._storageRevision, idbRevision: settled.idb?._storageRevision,
    });
}

async function testCreateRecoveryWaitsForTransferFreezeRelease(page) {
  const name = "Create interrupted by install transfer freeze";
  await reset(page);
  await openNewCustom(page, name);
  await installTransferFreezeAfterFirstCustomWrite(page);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.dataset.phase === "recovering" &&
    document.querySelector("#exCustomRecoveryRetry")?.hidden === false,
  undefined, { timeout: 5000 });

  const partial = await readReplicas(page);
  const localRows = partial.local?.customExercises?.filter(entry => entry.name === name) || [];
  const idbRows = partial.idb?.customExercises?.filter(entry => entry.name === name) || [];
  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    retryVisible: !document.querySelector("#exCustomRecoveryRetry")?.hidden,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  check(ui.phase === "recovering" && ui.retryVisible && localRows.length === 1 && idbRows.length === 0,
    "a mid-write transfer freeze leaves Create unresolved after one-replica adoption", { ui, localRows, idbRows });
  check(!ui.toast.includes("Exercise created."),
    "a transfer-frozen custom mutation withholds Create success", ui.toast);
  const stableId = localRows[0]?.id;
  const revision = partial.local?._storageRevision;

  await page.evaluate(() => window.RepForgeDurableState.setMutationFreezeCheck(null));
  await page.click("#exCustomRecoveryRetry");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const settled = await readReplicas(page);
  const localSettled = settled.local?.customExercises?.filter(entry => entry.name === name) || [];
  const idbSettled = settled.idb?.customExercises?.filter(entry => entry.name === name) || [];
  check(localSettled.length === 1 && idbSettled.length === 1 &&
      localSettled[0].id === stableId && idbSettled[0].id === stableId,
    "after transfer unfreezes, owner recovery settles the same Create identity", { localSettled, idbSettled });
  check(settled.local?._storageRevision === revision && settled.idb?._storageRevision === revision,
    "transfer-freeze recovery heals the original revision without a semantic retry", {
      revision, local: settled.local?._storageRevision, idb: settled.idb?._storageRevision,
    });
}

async function testCreateWaitsForDeferredJournalCleanup(page) {
  const name = "Deferred journal cleanup";
  await reset(page);
  await openNewCustom(page, name);
  await installDeferredJournalCleanup(page);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => typeof window.__releaseCustomSettlement === "function", undefined,
    { timeout: 5000 });

  const ui = await page.evaluate(() => ({
    visible: !document.querySelector("#exCustomSheet")?.hidden,
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    journalId: window.__customSettlementJournalId || null,
    pendingJournalCount: Object.keys(localStorage).filter(key => key.startsWith("repforge_pending_v1:")).length,
  }));
  const replicas = await readReplicas(page);
  const localRows = replicas.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const idbRows = replicas.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  const committedRevision = replicas.local?._storageRevision;
  const pendingJournalIds = await page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith("repforge_pending_v1:"))
    .map(key => key.slice("repforge_pending_v1:".length)));
  check(ui.visible && ui.phase === "recovering" && ui.busy === "true" && ui.inert === true,
    "a committed snapshot with deferred WAL cleanup remains recovery-owned", ui);
  check(!!ui.journalId && ui.pendingJournalCount > 0 && localRows.length === 1 && idbRows.length === 1,
    "deferred recovery is bound to its own journal and sees both written replicas", { ui, localRows, idbRows });
  check(pendingJournalIds.length === 2 && pendingJournalIds.includes(ui.journalId),
    "a distinct unrelated mutation remains queued behind its own journal", { ui, pendingJournalIds });
  check(!ui.toast.includes("Exercise created."), "deferred cleanup does not announce create success", ui.toast);

  await page.evaluate(() => window.__releaseCustomSettlement());
  await page.waitForFunction(() => typeof window.__releaseUnrelatedJournalWrite === "function",
    undefined, { timeout: 5000 });
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  await page.evaluate(() => window.__restoreStorageRemoval());
  const settled = await readReplicas(page);
  const settledLocal = settled.local?.customExercises?.filter((entry) => entry.name === name) || [];
  const settledIdb = settled.idb?.customExercises?.filter((entry) => entry.name === name) || [];
  const remainingJournalIds = await page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith("repforge_pending_v1:"))
    .map(key => key.slice("repforge_pending_v1:".length)));
  check(settledLocal.length === 1 && settledIdb.length === 1 && settledLocal[0].id === settledIdb[0].id &&
      remainingJournalIds.length === 1 && !remainingJournalIds.includes(ui.journalId) &&
      remainingJournalIds.some(id => pendingJournalIds.includes(id) && id !== ui.journalId),
    "owner recovery closes only its own journal and leaves the unrelated operation pending", {
      settledLocal, settledIdb, pendingJournalIds, remainingJournalIds,
    });
  check(settled.local?._storageRevision === committedRevision && settled.idb?._storageRevision === committedRevision,
    "deferred journal cleanup preserves the already committed revision", {
      committedRevision, localRevision: settled.local?._storageRevision, idbRevision: settled.idb?._storageRevision,
    });

  await page.evaluate(() => window.__releaseUnrelatedJournalWrite());
  const unrelated = await page.evaluate(async () => window.__customUnrelatedPromise);
  const afterUnrelated = await readReplicas(page);
  check(unrelated?.committed === true && unrelated?.settled === true &&
      afterUnrelated.local?.programMeta?.name === "Unrelated queued mutation" &&
      afterUnrelated.idb?.programMeta?.name === "Unrelated queued mutation",
    "the unrelated queued operation commits after custom recovery releases the lock", {
      unrelated, localName: afterUnrelated.local?.programMeta?.name, idbName: afterUnrelated.idb?.programMeta?.name,
    });
}

async function testEditOneReplicaRecovery(page, successfulReplica) {
  await reset(page);
  const id = await seedCustomFixture(page, `Edit original ${successfulReplica}`);
  await openCustomEdit(page, id);
  const nextName = `Edit recovered ${successfulReplica}`;
  await page.locator("#exCustomName").fill(nextName);
  await installTwoPhaseReplicaFault(page, successfulReplica);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => typeof window.__releaseInitialCustomWrite === "function", undefined,
    { timeout: 5000 });
  const saving = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    ariaBusy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
  }));
  check(saving.phase === "saving" && saving.ariaBusy === "true" && saving.inert,
    `an ${successfulReplica}-only edit locks fields before its first write settles`, saving);
  await assertNoCompetingCustomAction(page, "saving", 1);
  await page.evaluate(() => window.__releaseInitialCustomWrite());
  await page.waitForFunction(() => typeof window.__releaseCustomRecoveryWrite === "function", undefined,
    { timeout: 5000 });

  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    busy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  const partial = await readReplicas(page);
  const localEntry = partial.local?.customExercises?.find((entry) => entry.id === id) || null;
  const idbEntry = partial.idb?.customExercises?.find((entry) => entry.id === id) || null;
  const expectedLocal = successfulReplica === "local";
  check(ui.phase === "recovering" && ui.busy === "true" && ui.inert === true,
    `an ${successfulReplica}-only edit stays recovery-owned`, ui);
  check((localEntry?.name === nextName) === expectedLocal && (idbEntry?.name === nextName) === !expectedLocal,
    `the ${successfulReplica}-only edit is observed independently in both replicas`, { localEntry, idbEntry });
  check(!ui.toast.includes("Exercise saved."), "edit success waits for settlement", ui.toast);

  await page.evaluate(() => window.__releaseCustomRecoveryWrite());
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const settled = await readReplicas(page);
  const localRows = settled.local?.customExercises?.filter((entry) => entry.id === id) || [];
  const idbRows = settled.idb?.customExercises?.filter((entry) => entry.id === id) || [];
  check(localRows.length === 1 && idbRows.length === 1 && localRows[0].name === nextName &&
      idbRows[0].name === nextName && localRows[0].id === idbRows[0].id,
    `the ${successfulReplica}-only edit settles without changing custom identity`, { localRows, idbRows });
}

async function linkCustomToProgram(page, id) {
  return page.evaluate(async (customId) => {
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const entry = proposal.customExercises?.find((value) => value.id === customId);
    const row = proposal.program?.[0];
    if (!entry || !row) throw new Error("A custom program reference needs a seeded program and definition");
    row.libraryId = customId;
    row.movementId = `library:${customId}`;
    row.name = entry.name;
    row.primary = entry.primary;
    row.secondary = entry.secondary;
    const result = await window.__repforgeCommitProposedState(proposal);
    return { committed: result?.committed, settled: result?.settled, result };
  }, id);
}

async function testDeleteRecoveryRestoresNewReference(page, otherPage) {
  await reset(page);
  const id = await seedCustomFixture(page, "Delete recovery reference winner");
  await otherPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(otherPage);
  const staleProposal = await otherPage.evaluate(async () =>
    (await window.__debugProgramEditor()).state);
  await openCustomEdit(page, id);
  await installImmediateLocalOnlyFault(page);
  await page.evaluate(() => {
    const durable = window.RepForgeDurableState;
    const settle = durable.settleCustomExerciseMutation;
    durable.settleCustomExerciseMutation = async options => {
      window.__customDeleteRecoveryWaiting = true;
      window.__customDeletePendingJournalId = options.pendingJournalId;
      await new Promise(resolve => { window.__releaseCustomDeleteRecovery = resolve; });
      durable.settleCustomExerciseMutation = settle;
      window.__customDeleteRecoveryStarted = true;
      const hooks = window.__repforgeDurableStateTestHooks ||= {};
      hooks.durableSettlementLockHeld = async () => { window.__customDeleteRecoveryLockHeld = true; };
      try {
        const receipt = await settle(options);
        if (typeof receipt?.pendingJournalId === "string")
          window.__customDeletePendingJournalId = receipt.pendingJournalId;
        window.__customDeleteRecoveryReceipt = receipt;
        return receipt;
      } catch (error) {
        window.__customDeleteRecoveryError = String(error);
        throw error;
      }
    };
  });
  await page.click("#exCustomDelete");
  await page.waitForFunction(() => window.__customDeleteRecoveryWaiting === true,
    undefined, { timeout: 5000 });
  const partial = await readReplicas(page);
  check(!partial.local?.customExercises?.some(entry => entry.id === id) &&
      partial.idb?.customExercises?.some(entry => entry.id === id) === true,
    "recovery fixture reaches a local-only Delete before the competing reference", {
      localRevision: partial.local?._storageRevision, idbRevision: partial.idb?._storageRevision,
      localDefined: partial.local?.customExercises?.some(entry => entry.id === id) === true,
      idbDefined: partial.idb?.customExercises?.some(entry => entry.id === id) === true,
    });
  const originalDeleteJournal = await page.evaluate(() => {
    const id = window.__customDeletePendingJournalId;
    const raw = localStorage.getItem(`repforge_pending_v1:${id}`);
    return { raw, journal: raw ? JSON.parse(raw) : null };
  });

  // Submit a real two-tab durable commit from the other tab's pre-Delete
  // snapshot. The mandatory installed-editor regression separately proves
  // the current UI producer now rejects this stale custom identity under lock.
  const concurrent = await otherPage.evaluate(async ({ proposal, customId }) => {
    const row = proposal.program?.[0];
    if (!row) throw new Error("Delete recovery fixture needs a program row");
    row.libraryId = customId;
    row.movementId = "library:" + customId;
    row.name = "Delete recovery reference winner";
    const result = await window.__repforgeCommitProposedState(proposal);
    return { committed: result?.committed, settled: result?.settled, revision: result?.revision, code: result?.code };
  }, { proposal: staleProposal, customId: id });
  const raced = await readReplicas(otherPage);
  check(concurrent.committed === true && concurrent.settled === true &&
      raced.local?.program?.some(row => row.libraryId === id) === true &&
      raced.idb?.program?.some(row => row.libraryId === id) === true &&
      !raced.local?.customExercises?.some(entry => entry.id === id) &&
      !raced.idb?.customExercises?.some(entry => entry.id === id),
    "a stale peer commit introduces the referenced identity after partial Delete", {
      concurrent, localRevision: raced.local?._storageRevision, idbRevision: raced.idb?._storageRevision,
      localReference: raced.local?.program?.some(row => row.libraryId === id) === true,
      idbReference: raced.idb?.program?.some(row => row.libraryId === id) === true,
      localDefined: raced.local?.customExercises?.some(entry => entry.id === id) === true,
      idbDefined: raced.idb?.customExercises?.some(entry => entry.id === id) === true,
    });

  await page.evaluate(() => {
    const io = window.RepForgeDurableState.storageIO;
    const original = io.writeIdb;
    let failed = false;
    io.writeIdb = async snapshot => {
      if (!failed) { failed = true; window.__customSemanticRecoveryIdbFailed = true; return false; }
      return original.call(io, snapshot);
    };
    window.__restoreCustomSemanticRecoveryIO = () => { io.writeIdb = original; };
  });
  await page.evaluate(() => window.__releaseCustomDeleteRecovery());
  try {
    await page.waitForFunction(() => window.__customDeleteRecoveryReceipt !== undefined ||
      window.__customDeleteRecoveryError, undefined, { timeout: 10000 });
  } catch {}
  const recoveryReceipt = await page.evaluate(() => ({
    status: window.__customDeleteRecoveryReceipt?.status,
    code: window.__customDeleteRecoveryReceipt?.code,
    semanticRecovery: window.__customDeleteRecoveryReceipt?.semanticRecovery,
    pendingJournalId: window.__customDeleteRecoveryReceipt?.pendingJournalId || null,
    revision: window.__customDeleteRecoveryReceipt?.revision,
    localOk: window.__customDeleteRecoveryReceipt?.localOk,
    idbOk: window.__customDeleteRecoveryReceipt?.idbOk,
    pendingJournalCleanup: window.__customDeleteRecoveryReceipt?.pendingJournalCleanup,
    lockHeld: window.__customDeleteRecoveryLockHeld === true,
    idbFaultInjected: window.__customSemanticRecoveryIdbFailed === true,
    error: window.__customDeleteRecoveryError || null,
  }));
  check(recoveryReceipt.lockHeld && recoveryReceipt.status === "deferred" &&
      recoveryReceipt.code === "custom_recovery_replica_write_failed" &&
      recoveryReceipt.semanticRecovery !== true && recoveryReceipt.pendingJournalCleanup === true &&
      typeof recoveryReceipt.pendingJournalId === "string" &&
      recoveryReceipt.idbFaultInjected,
    "an interrupted semantic recovery remains owned and does not claim Delete success",
    recoveryReceipt);
  const interrupted = await readReplicas(page);
  const recoveryJournal = await page.evaluate(customId => {
    const journalId = window.__customDeletePendingJournalId;
    const key = `repforge_pending_v1:${journalId}`;
    const raw = localStorage.getItem(key), value = JSON.parse(raw || "null");
    return { key, raw, marker: value?.customMutationRecovery || null,
      intent: value?.customMutationIntent || null,
      proposalHasDefinition: value?.proposal?.customExercises?.some(entry => entry.id === customId) === true,
      proposalHasReference: value?.proposal?.program?.some(row => row.libraryId === customId) === true };
  }, id);
  check(recoveryJournal.raw === originalDeleteJournal.raw && recoveryJournal.marker === null &&
      recoveryJournal.intent?.version === 1 && recoveryJournal.intent?.operation === "delete" &&
      recoveryJournal.intent?.id === id && recoveryJournal.intent?.entry?.id === id &&
      !recoveryJournal.proposalHasDefinition && !recoveryJournal.proposalHasReference &&
      interrupted.local?._storageRevision > interrupted.idb?._storageRevision &&
      interrupted.local?.customExercises?.some(entry => entry.id === id) === true &&
      interrupted.local?.program?.some(row => row.libraryId === id) === true &&
      interrupted.idb?.customExercises?.some(entry => entry.id === id) !== true &&
      interrupted.idb?.program?.some(row => row.libraryId === id) === true,
    "the immutable Delete intent and its source definition remain owned while semantic recovery has healed only one replica", {
      recoveryJournal, localRevision: interrupted.local?._storageRevision, idbRevision: interrupted.idb?._storageRevision,
      localDefined: interrupted.local?.customExercises?.some(entry => entry.id === id) === true,
      idbDefined: interrupted.idb?.customExercises?.some(entry => entry.id === id) === true,
    });
  await page.evaluate(() => window.__restoreCustomSemanticRecoveryIO?.());
  await page.click("#exCustomRecoveryRetry");
  await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.dataset.phase === "editing" &&
    document.querySelector("#exCustomDelete")?.dataset.i18n === "custom.archive", undefined, { timeout: 10000 });
  const restored = await readReplicas(page);
  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    action: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
    disabled: document.querySelector("#exCustomDelete")?.disabled,
    inUseVisible: !document.querySelector("#exCustomInUse")?.classList.contains("hidden"),
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  const safe = snapshot => snapshot?.customExercises?.some(entry => entry.id === id) === true &&
    snapshot?.program?.some(row => row.libraryId === id) === true;
  check(safe(restored.local) && safe(restored.idb) && ui.phase === "editing" &&
      ui.action === "custom.archive" && ui.text === "Archive exercise" && !ui.disabled &&
      ui.inUseVisible && ui.toast.includes("now in use") && !ui.toast.includes("Exercise deleted.") &&
      !recoveryJournal.key.includes("undefined") &&
      await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("repforge_pending_v1:")).length === 0),
    "retry heals the owner-validated definition, closes only its Delete journal, and requires explicit Archive", {
      ui,
      local: { revision: restored.local?._storageRevision, safe: safe(restored.local) },
      idb: { revision: restored.idb?._storageRevision, safe: safe(restored.idb) },
    });
  check(restored.local?._storageRevision === restored.idb?._storageRevision,
    "semantic Delete recovery advances one shared revision for the restored identity", {
      local: restored.local?._storageRevision, idb: restored.idb?._storageRevision,
    });

  await page.click("#exCustomDelete");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const archived = await readReplicas(page);
  check(archived.local?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      archived.idb?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      archived.local?.program?.some(row => row.libraryId === id) &&
      archived.idb?.program?.some(row => row.libraryId === id),
    "the explicit follow-up Archive retains the concurrent reference in both replicas", {
      local: { revision: archived.local?._storageRevision, archived: archived.local?.customExercises?.find(entry => entry.id === id)?.archived },
      idb: { revision: archived.idb?._storageRevision, archived: archived.idb?.customExercises?.find(entry => entry.id === id)?.archived },
    });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const reloaded = await readReplicas(page);
  check(reloaded.local?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      reloaded.idb?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      reloaded.local?.program?.some(row => row.libraryId === id) &&
      reloaded.idb?.program?.some(row => row.libraryId === id),
    "reload preserves the explicitly archived custom identity after recovery", {
      local: { revision: reloaded.local?._storageRevision, archived: reloaded.local?.customExercises?.find(entry => entry.id === id)?.archived },
      idb: { revision: reloaded.idb?._storageRevision, archived: reloaded.idb?.customExercises?.find(entry => entry.id === id)?.archived },
    });
}

async function testDeleteRecoveryPreservesPostPartialEdit(page, otherPage) {
  await reset(page);
  const id = await seedCustomFixture(page, "Delete recovery edit winner");
  await otherPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(otherPage);
  const staleProposal = await otherPage.evaluate(async () =>
    (await window.__debugProgramEditor()).state);
  await openCustomEdit(page, id);
  await installImmediateLocalOnlyFault(page);
  await page.evaluate(() => {
    const durable = window.RepForgeDurableState;
    const settle = durable.settleCustomExerciseMutation;
    durable.settleCustomExerciseMutation = async options => {
      window.__customDeleteEditRecoveryWaiting = true;
      await new Promise(resolve => { window.__releaseCustomDeleteEditRecovery = resolve; });
      durable.settleCustomExerciseMutation = settle;
      window.__repforgeDurableStateTestHooks ||= {};
      window.__repforgeDurableStateTestHooks.durableSettlementLockHeld = async () => {
        window.__customDeleteEditRecoveryLockHeld = true;
      };
      const receipt = await settle(options);
      window.__customDeleteEditRecoveryReceipt = receipt;
      return receipt;
    };
  });
  await page.click("#exCustomDelete");
  await page.waitForFunction(() => window.__customDeleteEditRecoveryWaiting === true,
    undefined, { timeout: 5000 });

  const definition = staleProposal.customExercises?.find(entry => entry.id === id);
  if (!definition) throw new Error("Stale peer fixture lost its custom definition");
  definition.name = "Another tab custom edit";
  definition.namePt = definition.name;
  definition.notes = "Committed after the partial Delete";
  const concurrent = await otherPage.evaluate(async proposal => {
    const result = await window.__repforgeCommitProposedState(proposal);
    return { committed: result?.committed, settled: result?.settled, revision: result?.revision };
  }, staleProposal);
  const beforeRecovery = await readReplicas(otherPage);
  check(concurrent.committed === true && concurrent.settled === true &&
      beforeRecovery.local?.customExercises?.find(entry => entry.id === id)?.name === definition.name &&
      beforeRecovery.idb?.customExercises?.find(entry => entry.id === id)?.name === definition.name,
    "a newer custom definition lands after partial Delete while owner recovery is gated", {
      concurrent,
      localName: beforeRecovery.local?.customExercises?.find(entry => entry.id === id)?.name,
      idbName: beforeRecovery.idb?.customExercises?.find(entry => entry.id === id)?.name,
    });

  await page.evaluate(() => window.__releaseCustomDeleteEditRecovery());
  await page.waitForFunction(() => window.__customDeleteEditRecoveryReceipt !== undefined,
    undefined, { timeout: 10000 });
  const settled = await readReplicas(page);
  const ui = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    action: document.querySelector("#exCustomDelete")?.dataset.i18n,
    name: document.querySelector("#exCustomName")?.value,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    lockHeld: window.__customDeleteEditRecoveryLockHeld === true,
    receipt: {
      status: window.__customDeleteEditRecoveryReceipt?.status,
      code: window.__customDeleteEditRecoveryReceipt?.code,
      semanticRecovery: window.__customDeleteEditRecoveryReceipt?.semanticRecovery,
      committed: window.__customDeleteEditRecoveryReceipt?.committed,
      pendingJournalCleanup: window.__customDeleteEditRecoveryReceipt?.pendingJournalCleanup,
    },
  }));
  check(settled.local?.customExercises?.find(entry => entry.id === id)?.name === definition.name &&
      settled.idb?.customExercises?.find(entry => entry.id === id)?.name === definition.name &&
      ui.phase === "editing" && ui.action === "custom.delete" && ui.name === definition.name &&
      ui.toast.includes("changed elsewhere") && !ui.toast.includes("Exercise deleted.") &&
      ui.lockHeld && ui.receipt.status === "rejected" &&
      ui.receipt.code === "custom_delete_changed_elsewhere" &&
      ui.receipt.semanticRecovery === true && ui.receipt.committed === false &&
      ui.receipt.pendingJournalCleanup !== true,
    "recovery cancels its stale Delete journal and preserves the newer definition", {
      ui,
      localName: settled.local?.customExercises?.find(entry => entry.id === id)?.name,
      idbName: settled.idb?.customExercises?.find(entry => entry.id === id)?.name,
      pending: await page.evaluate(() => Object.keys(localStorage)
        .filter(key => key.startsWith("repforge_pending_v1:")).length),
    });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const reloaded = await readReplicas(page);
  check(reloaded.local?.customExercises?.find(entry => entry.id === id)?.name === definition.name &&
      reloaded.idb?.customExercises?.find(entry => entry.id === id)?.name === definition.name,
    "reload cannot replay the canceled Delete over the newer custom definition", {
      localName: reloaded.local?.customExercises?.find(entry => entry.id === id)?.name,
      idbName: reloaded.idb?.customExercises?.find(entry => entry.id === id)?.name,
    });
}

async function assertNoCompetingCustomAction(page, phase, calls) {
  await page.evaluate(() => {
    document.querySelector("#exCustomSave")?.click();
    document.querySelector("#exCustomCancel")?.click();
    document.querySelector("#exCustomDelete")?.click();
    document.querySelector("#exCustomScrim")?.click();
  });
  await page.keyboard.press("Escape");
  const after = await page.evaluate(() => ({
    visible: !document.querySelector("#exCustomSheet")?.hidden,
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    calls: window.__customMutationWriteCalls,
    saveDisabled: document.querySelector("#exCustomSave")?.disabled,
    cancelDisabled: document.querySelector("#exCustomCancel")?.disabled,
    deleteDisabled: document.querySelector("#exCustomDelete")?.disabled,
    formInert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    ariaBusy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
  }));
  check(after.visible && after.phase === phase && after.calls === calls &&
      after.saveDisabled && after.cancelDisabled && after.formInert && after.ariaBusy === "true" &&
      (after.deleteDisabled || document.querySelector("#exCustomDelete")?.classList.contains("hidden")),
    `Save, Cancel, Delete, Escape, and scrim cannot compete during ${phase}`, after);
}

async function testDestructiveOneReplicaRecovery(page, operation, successfulReplica, pendingLanguage = "en") {
  const label = operation === "archive" ? "Archive" : "Delete";
  const name = `${label} ${successfulReplica} recovery`;
  await reset(page);
  const id = await seedCustomFixture(page, name);
  if (operation === "archive") {
    const linked = await linkCustomToProgram(page, id);
    check(linked.committed === true && linked.settled === true,
      `archive ${successfulReplica} fault fixture references its custom identity`, linked);
  }
  await openCustomEdit(page, id);
  await installTwoPhaseReplicaFault(page, successfulReplica);
  await page.click("#exCustomDelete");
  await page.waitForFunction(() => typeof window.__releaseInitialCustomWrite === "function",
    undefined, { timeout: 5000 });

  const pendingPhase = operation === "archive" ? "archiving" : "deleting";
  const expectedKey = operation === "archive" ? "custom.archiving" : "custom.deleting";
  const expectedEn = operation === "archive" ? "Archiving…" : "Deleting…";
  const pending = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    key: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
    ariaBusy: document.querySelector("#exCustomSheet")?.getAttribute("aria-busy"),
    inert: document.querySelector("#exCustomSheet .custom__form")?.inert,
    saveDisabled: document.querySelector("#exCustomSave")?.disabled,
    cancelDisabled: document.querySelector("#exCustomCancel")?.disabled,
    deleteDisabled: document.querySelector("#exCustomDelete")?.disabled,
  }));
  check(pending.phase === pendingPhase && pending.key === expectedKey && pending.text === expectedEn &&
      pending.ariaBusy === "true" && pending.inert && pending.saveDisabled && pending.cancelDisabled && pending.deleteDisabled,
    `${label} uses its distinct English pending copy and an inert busy form`, pending);
  await assertNoCompetingCustomAction(page, pendingPhase, 1);

  if (pendingLanguage === "pt")
    await page.evaluate(() => window.RepForgeI18n.setLang("pt"));
  await page.evaluate(() => window.__releaseInitialCustomWrite());
  await page.waitForFunction(() => typeof window.__releaseCustomRecoveryWrite === "function",
    undefined, { timeout: 5000 });

  const recovering = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    key: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
    recoveryText: document.querySelector("#exCustomRecoveryStatus")?.textContent?.trim() || "",
    recoveryHidden: document.querySelector("#exCustomRecovery")?.hidden,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  const partial = await readReplicas(page);
  const localEntry = partial.local?.customExercises?.find((entry) => entry.id === id) || null;
  const idbEntry = partial.idb?.customExercises?.find((entry) => entry.id === id) || null;
  const successIsLocal = successfulReplica === "local";
  const hasResult = entry => operation === "archive" ? entry?.archived === true : entry === null;
  const noResult = entry => operation === "archive" ? entry?.archived !== true : !!entry;
  check(recovering.phase === "recovering" && recovering.recoveryHidden === false &&
      noResult(successIsLocal ? idbEntry : localEntry) && hasResult(successIsLocal ? localEntry : idbEntry),
    `${successfulReplica}-only ${operation} is independently visible in both replicas during recovery`, {
      recovering, localEntry, idbEntry,
    });
  if (pendingLanguage === "pt") {
    const expectedPt = operation === "archive" ? "Arquivando…" : "Excluindo…";
    check(recovering.key === expectedKey && recovering.text === expectedPt,
      `${label} pending copy is localized in Portuguese`, recovering);
    await page.evaluate(() => window.RepForgeI18n.setLang("en"));
  }
  const successToast = operation === "archive" ? "Exercise archived." : "Exercise deleted.";
  check(!recovering.toast.includes(successToast), `${operation} success is withheld before settlement`, recovering.toast);
  await assertNoCompetingCustomAction(page, "recovering", 2);

  await page.evaluate(() => window.__releaseCustomRecoveryWrite());
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const settled = await readReplicas(page);
  const finalLocal = settled.local?.customExercises?.find((entry) => entry.id === id) || null;
  const finalIdb = settled.idb?.customExercises?.find((entry) => entry.id === id) || null;
  check(operation === "archive"
      ? finalLocal?.id === id && finalIdb?.id === id && finalLocal.archived === true && finalIdb.archived === true
      : finalLocal === null && finalIdb === null,
    `${successfulReplica}-only ${operation} settles the same semantic result in both replicas`, {
      finalLocal, finalIdb,
    });
  check(await page.locator("#toast").textContent().then((value) => value.includes(successToast)),
    `settled ${operation} announces its success copy`);
  if (operation === "archive") {
    check(settled.local?.program?.some((row) => row.libraryId === id) === true &&
        settled.idb?.program?.some((row) => row.libraryId === id) === true,
      "archive recovery preserves the exact program reference", { local: settled.local?.program, idb: settled.idb?.program });
  }
  const revision = partial[successfulReplica === "local" ? "local" : "idb"]?._storageRevision;
  check(settled.local?._storageRevision === revision && settled.idb?._storageRevision === revision,
    `${operation} recovery settles replicas without a duplicate revision`, {
      revision, local: settled.local?._storageRevision, idb: settled.idb?._storageRevision,
    });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const reloaded = await readReplicas(page);
  const reloadedLocal = reloaded.local?.customExercises?.find((entry) => entry.id === id) || null;
  const reloadedIdb = reloaded.idb?.customExercises?.find((entry) => entry.id === id) || null;
  check(operation === "archive"
      ? reloadedLocal?.archived === true && reloadedIdb?.archived === true
      : reloadedLocal === null && reloadedIdb === null,
    `reloaded ${operation} remains exact in both replicas`, { reloadedLocal, reloadedIdb });
}

async function testArchiveRecoveryPreservesUnrelatedProgramEdit(page, otherPage) {
  await reset(page);
  const id = await seedCustomFixture(page, "Archive with concurrent program edit");
  const linked = await linkCustomToProgram(page, id);
  check(linked.committed === true && linked.settled === true,
    "unrelated-edit Archive fixture has a valid custom program reference", linked);
  await otherPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(otherPage);
  await openCustomEdit(page, id);
  await installTwoPhaseReplicaFault(page, "local");
  await page.click("#exCustomDelete");
  await page.waitForFunction(() => typeof window.__releaseInitialCustomWrite === "function",
    undefined, { timeout: 5000 });
  await page.evaluate(() => window.__releaseInitialCustomWrite());
  await page.waitForFunction(() => typeof window.__releaseCustomRecoveryWrite === "function",
    undefined, { timeout: 5000 });

  const partial = await readReplicas(page);
  check(partial.local?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      partial.idb?.customExercises?.find(entry => entry.id === id)?.archived !== true,
    "Archive recovery pauses with only its owner replica updated", {
      localArchived: partial.local?.customExercises?.find(entry => entry.id === id)?.archived,
      idbArchived: partial.idb?.customExercises?.find(entry => entry.id === id)?.archived,
    });
  await otherPage.evaluate(() => {
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    proposal.programMeta.name = "Program edit queued during Archive recovery";
    window.__archiveUnrelatedEditStatus = { settled: false };
    window.__archiveUnrelatedEditPromise = window.__repforgeCommitProposedState(proposal)
      .then(result => {
        window.__archiveUnrelatedEditStatus = { settled: true, committed: result?.committed,
          status: result?.status, code: result?.code };
        return result;
      }, error => {
        window.__archiveUnrelatedEditStatus = { settled: true, error: String(error) };
        return null;
      });
  });
  try {
    await otherPage.waitForFunction(() => Object.keys(localStorage)
      .filter(key => key.startsWith("repforge_pending_v1:")).length >= 2,
    undefined, { timeout: 5000 });
  } catch {}
  const pending = await page.evaluate(() => ({
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    journals: Object.keys(localStorage).filter(key => key.startsWith("repforge_pending_v1:")).length,
  }));
  const editStatus = await otherPage.evaluate(() => window.__archiveUnrelatedEditStatus);
  check(pending.phase === "recovering" && (pending.journals >= 2 || editStatus?.settled === false) &&
      !pending.toast.includes("Exercise archived."),
    "a distinct program edit starts while Archive recovery owns settlement without early success",
    { pending, editStatus });

  await page.evaluate(() => window.__releaseCustomRecoveryWrite());
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 10000 });
  const concurrent = await otherPage.evaluate(async () => window.__archiveUnrelatedEditPromise);
  const final = await readReplicas(page);
  check(concurrent?.committed === true && concurrent?.settled === true &&
      final.local?.programMeta?.name === "Program edit queued during Archive recovery" &&
      final.idb?.programMeta?.name === "Program edit queued during Archive recovery" &&
      final.local?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      final.idb?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      final.local?.program?.some(row => row.libraryId === id) &&
      final.idb?.program?.some(row => row.libraryId === id),
    "Archive recovery preserves both its archive and the newer unrelated program edit", {
      concurrent: { committed: concurrent?.committed, settled: concurrent?.settled, revision: concurrent?.revision },
      local: { name: final.local?.programMeta?.name, revision: final.local?._storageRevision,
        archived: final.local?.customExercises?.find(entry => entry.id === id)?.archived },
      idb: { name: final.idb?.programMeta?.name, revision: final.idb?._storageRevision,
        archived: final.idb?.customExercises?.find(entry => entry.id === id)?.archived },
    });
  check(await page.locator("#toast").textContent().then(value => value.includes("Exercise archived.")),
    "settled Archive announces its success after the unrelated write survives");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  const reloaded = await readReplicas(page);
  check(reloaded.local?.programMeta?.name === "Program edit queued during Archive recovery" &&
      reloaded.idb?.programMeta?.name === "Program edit queued during Archive recovery" &&
      reloaded.local?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      reloaded.idb?.customExercises?.find(entry => entry.id === id)?.archived === true,
    "reload preserves unrelated edits alongside Archive recovery", {
      local: { name: reloaded.local?.programMeta?.name, archived: reloaded.local?.customExercises?.find(entry => entry.id === id)?.archived },
      idb: { name: reloaded.idb?.programMeta?.name, archived: reloaded.idb?.customExercises?.find(entry => entry.id === id)?.archived },
    });
}

async function testArchiveNormalAndHistoryOnly(page) {
  await reset(page);
  const id = await seedCustomFixture(page, "Normal archive semantics");
  const linked = await linkCustomToProgram(page, id);
  check(linked.committed === true && linked.settled === true, "normal archive fixture has an in-use custom row", linked);
  await openCustomEdit(page, id);
  const action = await page.evaluate(() => ({
    key: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
  }));
  check(action.key === "custom.archive" && action.text === "Archive exercise",
    "in-use custom exercise offers Archive semantics", action);
  await page.click("#exCustomDelete");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const archived = await readReplicas(page);
  check(archived.local?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      archived.idb?.customExercises?.find(entry => entry.id === id)?.archived === true &&
      archived.local?.program?.some(row => row.libraryId === id) && archived.idb?.program?.some(row => row.libraryId === id),
    "normal archive retains its definition and program identity", { local: archived.local, idb: archived.idb });
  check(await page.locator("#toast").textContent().then((value) => value.includes("Exercise archived.")),
    "normal archive announces Exercise archived only after settlement");

  await reset(page);
  const historyId = await seedCustomFixture(page, "History-only archive semantics");
  const historyCommit = await page.evaluate(async (customId) => {
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const entry = proposal.customExercises.find(value => value.id === customId);
    proposal.log.push({
      session: "custom-history-only",
      date: "2026-01-01",
      day: "Day 1",
      exerciseId: "custom-history-slot",
      name: entry.name,
      performedName: entry.name,
      performedLibraryId: customId,
      performedMovementId: `library:${customId}`,
      set: 1,
      load: 10,
      reps: 8,
      rir: 1,
      created: "2026-01-01T12:00:00.000Z",
    });
    const result = await window.__repforgeCommitProposedState(proposal);
    const deletion = await window.__repforgeDeleteCustomExercise(customId);
    return { result, deletion, local: JSON.parse(localStorage.getItem("repforge_v1") || "{}") };
  }, historyId);
  const historyIdb = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction("kv", "readonly").objectStore("kv").get("repforge_v1");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  });
  check(historyCommit.result?.committed === true && historyCommit.result?.settled === true &&
      historyCommit.deletion?.operation === "archive" && historyCommit.deletion?.committed === true &&
      historyCommit.deletion?.settled === true,
    "history-only custom references select and settle Archive", historyCommit);
  check(historyCommit.local.customExercises?.find(entry => entry.id === historyId)?.archived === true &&
      historyCommit.local.log?.some(row => row.performedLibraryId === historyId) &&
      historyIdb?.customExercises?.find(entry => entry.id === historyId)?.archived === true &&
      historyIdb?.log?.some(row => row.performedLibraryId === historyId),
    "history-only archive preserves log attribution in both replicas", { local: historyCommit.local, historyIdb });
}

async function testProgramHistoryOnlyArchive(page) {
  await reset(page);
  const id = await seedCustomFixture(page, "Program history only archive");
  const historyCommit = await page.evaluate(async customId => {
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const entry = proposal.customExercises?.find(value => value.id === customId);
    const row = structuredClone(proposal.program?.[0]);
    if (!entry || !row) throw new Error("A history-only archive needs its seeded custom definition and program row");
    Object.assign(row, {
      libraryId: customId,
      movementId: `library:${customId}`,
      name: entry.name,
      primary: entry.primary,
      secondary: entry.secondary,
    });
    const meta = structuredClone(proposal.programMeta);
    meta.id = "custom-program-history-only";
    meta.name = "Archived program with custom reference";
    meta.started = "2026-01-01";
    meta.created = "2026-01-01T00:00:00.000Z";
    meta.updated = "2026-01-01T00:00:00.000Z";
    proposal.program = [];
    proposal.programHistory = [{
      id: meta.id,
      meta,
      program: [row],
      completedAt: "2026-01-02T00:00:00.000Z",
      review: null,
    }];
    const result = await window.__repforgeCommitProposedState(proposal);
    return { result, snapshot: JSON.parse(localStorage.getItem("repforge_v1") || "{}") };
  }, id);
  check(historyCommit.result?.committed === true && historyCommit.result?.settled === true &&
      !historyCommit.snapshot.program?.some(row => row.libraryId === id) &&
      historyCommit.snapshot.programHistory?.some(history => history.program?.some(row => row.libraryId === id)),
    "programHistory is the only durable reference to this custom exercise", historyCommit);
  const before = await readReplicas(page);
  check(!before.local?.program?.some(row => row.libraryId === id) &&
      !before.idb?.program?.some(row => row.libraryId === id) &&
      before.local?.programHistory?.some(history => history.program?.some(row => row.libraryId === id)) &&
      before.idb?.programHistory?.some(history => history.program?.some(row => row.libraryId === id)),
    "the programHistory-only fixture is independently present in both replicas", { local: before.local, idb: before.idb });

  await openCustomEdit(page, id);
  const action = await page.evaluate(() => ({
    key: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
    inUse: !document.querySelector("#exCustomInUse")?.classList.contains("hidden"),
  }));
  check(action.key === "custom.archive" && action.text === "Archive exercise" && action.inUse,
    "a programHistory-only reference selects Archive", action);
  await page.click("#exCustomDelete");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const archived = await readReplicas(page);
  check(archived.local?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      archived.idb?.customExercises?.some(entry => entry.id === id && entry.archived === true) &&
      archived.local?.programHistory?.some(history => history.program?.some(row => row.libraryId === id)) &&
      archived.idb?.programHistory?.some(history => history.program?.some(row => row.libraryId === id)),
    "programHistory-only archive preserves the exact historical identity in both replicas", {
      local: archived.local, idb: archived.idb,
    });
  check(await page.locator("#toast").textContent().then(value => value.includes("Exercise archived.")),
    "programHistory-only Archive announces success after settlement");
}

async function testCrossTabStaleEditAndDeleteBecomesArchive(page, otherPage) {
  await reset(page);
  const editId = await seedCustomFixture(page, "Cross-tab original edit");
  await otherPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(otherPage);
  await openCustomEdit(page, editId);
  await page.locator("#exCustomName").fill("Local stale draft");
  const concurrentEdit = await otherPage.evaluate(async (id) => window.__repforgeSaveCustomExercise({
    id,
    name: "Other tab committed edit",
    equipment: ["machine"],
    primary: "Lats",
    secondary: "Biceps",
    notes: "Newer definition",
  }), editId);
  check(concurrentEdit?.result?.committed === true && concurrentEdit?.result?.settled === true,
    "other tab durably edits the custom source while the first sheet is open", concurrentEdit?.result);
  await page.click("#exCustomSave");
  await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.dataset.phase === "editing",
    undefined, { timeout: 5000 });
  const staleUi = await page.evaluate(() => ({
    visible: !document.querySelector("#exCustomSheet")?.hidden,
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    name: document.querySelector("#exCustomName")?.value,
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
  }));
  const staleReplicas = await readReplicas(page);
  check(staleUi.visible && staleUi.phase === "editing" && staleUi.name === "Local stale draft" &&
      staleUi.toast.includes("changed elsewhere"),
    "stale edit is rejected without losing the user's unsaved fields", staleUi);
  check(staleReplicas.local?.customExercises?.find(entry => entry.id === editId)?.name === "Other tab committed edit" &&
      staleReplicas.idb?.customExercises?.find(entry => entry.id === editId)?.name === "Other tab committed edit",
    "stale edit cannot overwrite the newer cross-tab definition", { local: staleReplicas.local, idb: staleReplicas.idb });

  await reset(page);
  const deleteId = await seedCustomFixture(page, "Cross-tab delete race");
  await otherPage.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(otherPage);
  await openCustomEdit(page, deleteId);
  const linked = await linkCustomToProgram(otherPage, deleteId);
  check(linked.committed === true && linked.settled === true,
    "other tab adds a program reference after the Delete sheet opens", linked);
  const linkedReplicas = await readReplicas(otherPage);
  check(linkedReplicas.local?.program?.some(row => row.libraryId === deleteId) === true &&
      linkedReplicas.idb?.program?.some(row => row.libraryId === deleteId) === true,
    "the concurrent program reference is present in both replicas", { local: linkedReplicas.local?.program, idb: linkedReplicas.idb?.program });
  await page.click("#exCustomDelete");
  await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.dataset.phase === "editing" ||
    document.querySelector("#exCustomSheet")?.hidden === true, undefined, { timeout: 5000 });
  const nowUsed = await readReplicas(page);
  const usedUi = await page.evaluate(() => ({
    phase: document.querySelector("#exCustomSheet")?.dataset.phase,
    action: document.querySelector("#exCustomDelete")?.dataset.i18n,
    text: document.querySelector("#exCustomDelete")?.textContent?.trim(),
    toast: document.querySelector("#toast")?.textContent?.trim() || "",
    inUseVisible: !document.querySelector("#exCustomInUse")?.classList.contains("hidden"),
  }));
  check(usedUi.phase === "editing" && usedUi.action === "custom.archive" &&
      usedUi.text === "Archive exercise" && usedUi.toast.includes("now in use"),
    "a stale Delete fails closed and updates the explicit action to Archive", usedUi);
  check(nowUsed.local?.customExercises?.some(entry => entry.id === deleteId && entry.archived !== true) &&
      nowUsed.idb?.customExercises?.some(entry => entry.id === deleteId && entry.archived !== true) &&
      nowUsed.local?.program?.some(row => row.libraryId === deleteId) &&
      nowUsed.idb?.program?.some(row => row.libraryId === deleteId),
    "the concurrent program reference and custom definition survive the rejected Delete", {
      local: nowUsed.local, idb: nowUsed.idb,
    });
  await page.click("#exCustomDelete");
  await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
  const archived = await readReplicas(page);
  check(archived.local?.customExercises?.some(entry => entry.id === deleteId && entry.archived === true) &&
      archived.idb?.customExercises?.some(entry => entry.id === deleteId && entry.archived === true) &&
      archived.local?.program?.some(row => row.libraryId === deleteId) &&
      archived.idb?.program?.some(row => row.libraryId === deleteId),
    "the user's follow-up Archive preserves the cross-tab program reference", {
      local: archived.local, idb: archived.idb,
    });
}

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const otherPage = await context.newPage();
  try {
    await testCreateNormalCommitAndReload(page);
    await testCreateWaitsForReplicaRecovery(page);
    await testCreateWaitsForIdbRecovery(page);
    await testCreateBothReplicasFail(page);
    await testCreateReconcilesBeforeRetryWithStableIdentity(page);
    await testCreateRecoveryWaitsForTransferFreezeRelease(page);
    await testCreateWaitsForDeferredJournalCleanup(page);
    await testEditOneReplicaRecovery(page, "local");
    await testEditOneReplicaRecovery(page, "idb");
    await testDeleteRecoveryRestoresNewReference(page, otherPage);
    await testDeleteRecoveryPreservesPostPartialEdit(page, otherPage);
    await testDestructiveOneReplicaRecovery(page, "delete", "local");
    await testDestructiveOneReplicaRecovery(page, "delete", "idb", "pt");
    await testDestructiveOneReplicaRecovery(page, "archive", "local");
    await testDestructiveOneReplicaRecovery(page, "archive", "idb", "pt");
    await testArchiveRecoveryPreservesUnrelatedProgramEdit(page, otherPage);
    await testArchiveNormalAndHistoryOnly(page);
    await testProgramHistoryOnlyArchive(page);
    await testCrossTabStaleEditAndDeleteBecomesArchive(page, otherPage);
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`\ncustom mutation recovery: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
