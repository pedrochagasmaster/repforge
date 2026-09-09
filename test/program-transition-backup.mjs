#!/usr/bin/env node
/**
 * Plan 052-P7: prove that an ordinary backup round-trip keeps transition
 * provenance and the user's program/log identities.
 *
 * This suite deliberately crosses the production boundaries that matter:
 * transition proposal/commit, the Settings backup download, the Settings
 * backup parser/Replace action, both durable replicas, and a real reload.
 * It does not import or call an app normalizer as an oracle. The expected
 * logical document is the JSON file emitted by the production export path;
 * the transition fields below are the independent contract assertions from
 * docs/block-transition-provenance.md.
 *
 * Set P052_MUTATE_BACKUP to transitionIn, transitionOut, or archiveId to run
 * a controlled negative. The run must fail because the imported document no
 * longer matches the pre-mutation backup identity. This makes a green normal
 * run distinguishable from proof that the oracle detects field loss.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { readFileSync } from "node:fs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
const KEY = "repforge_v1";
const DB_NAME = "repforge";
const STORE_NAME = "kv";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DRAFT_RECOVERY_KEY = "repforge_draft_v1:recovery";
const PENDING_PREFIX = "repforge_pending_v1";
const DRAFT_CLOSING_PREFIX = `${DRAFT_KEY}:closing:`;
const VOLATILE_STATE_KEYS = [
  "_storageRevision",
  "_storageFollowUp",
  "_storageDraftTransaction",
  "_storageSetupActivation",
];
const IMPORT_MARKER_KEYS = VOLATILE_STATE_KEYS.filter((key) => key !== "_storageRevision");
const NEGATIVE_MUTATIONS = new Set(["transitionIn", "transitionOut", "archiveId"]);

const failures = [];
let passed = 0;

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function withoutStorageMetadata(value) {
  const out = clone(value);
  for (const key of VOLATILE_STATE_KEYS) delete out?.[key];
  return out;
}

function sameLogicalDocument(actual, expected) {
  return JSON.stringify(canonicalize(withoutStorageMetadata(actual))) ===
    JSON.stringify(canonicalize(withoutStorageMetadata(expected)));
}

function sameValue(actual, expected) {
  return JSON.stringify(canonicalize(actual)) === JSON.stringify(canonicalize(expected));
}

function mutateBackupForNegative(backup, mutation) {
  const mutated = clone(backup);
  const history = Array.isArray(mutated?.programHistory) ? mutated.programHistory : [];
  if (mutation === "transitionIn") {
    if (!mutated.programMeta || !Object.prototype.hasOwnProperty.call(mutated.programMeta, "transitionIn")) {
      throw new Error("transitionIn negative could not find programMeta.transitionIn to remove");
    }
    delete mutated.programMeta?.transitionIn;
    if (Object.prototype.hasOwnProperty.call(mutated.programMeta, "transitionIn")) {
      throw new Error("transitionIn negative did not remove programMeta.transitionIn");
    }
  } else if (mutation === "transitionOut") {
    const archiveIndex = history.findIndex((entry) => entry?.transitionOut);
    if (archiveIndex < 0) throw new Error("transitionOut negative could not find an archive transitionOut");
    const archive = history[archiveIndex];
    delete archive.transitionOut;
    if (Object.prototype.hasOwnProperty.call(history[archiveIndex], "transitionOut")) {
      throw new Error("transitionOut negative did not remove the archive transitionOut");
    }
  } else if (mutation === "archiveId") {
    const archiveIndex = history.findIndex((entry) => entry?.archiveId);
    if (archiveIndex < 0) throw new Error("archiveId negative could not find an archiveId to mutate");
    const archive = history[archiveIndex];
    const originalArchiveId = archive.archiveId;
    archive.archiveId = "mutated-by-p052-negative";
    if (archive.archiveId === originalArchiveId) {
      throw new Error("archiveId negative did not change the archiveId value");
    }
  } else {
    throw new Error(`Unknown P052_MUTATE_BACKUP value: ${mutation}`);
  }
  if (sameValue(mutated, backup)) {
    throw new Error(`${mutation} negative did not change the backup document`);
  }
  return mutated;
}

async function readIdb(page) {
  return page.evaluate(async ({ dbName, storeName, key }) => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          resolve(null);
          return;
        }
        const transaction = db.transaction(storeName, "readonly");
        const get = transaction.objectStore(storeName).get(key);
        get.onsuccess = () => {
          db.close();
          resolve(get.result ?? null);
        };
        get.onerror = () => {
          db.close();
          reject(get.error);
        };
      };
    });
  }, { dbName: DB_NAME, storeName: STORE_NAME, key: KEY });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  return { local: JSON.parse(localRaw || "null"), idb: await readIdb(page), localRaw };
}

async function reloadAndBoot(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function activatePredecessor(page) {
  return page.evaluate(async () => {
    const adapter = window.RepForgeProgramEntryAdapter;
    const compiler = window.RepForgeProgramCompiler;
    if (!adapter || !compiler || typeof window.__repforgeFinalizeProgramSetup !== "function") {
      return { ok: false, error: "production program entry services unavailable" };
    }
    const services = adapter.createProductionServices({
      Compiler: compiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const compiled = services.compile({
      mode: "recommend",
      answers: {
        desiredResult: "balanced",
        structuredExperience: "6_to_24m",
        recentConsistency: "most",
        daysPerWeek: 4,
        sessionMinutes: 90,
        preferredRestSeconds: 90,
        environment: { kind: "commercial_gym" },
        primaryMuscles: [],
        deEmphasizedMuscles: [],
        ignoredMuscles: [],
        priorityMovements: [],
        mustHaveExercises: [],
        exerciseConstraints: [],
      },
      versions: services.currentVersions(),
    });
    if (!compiled.ok) return { ok: false, error: "production compilation failed", issues: compiled.issues };

    const baseProposal = window.__repforgeWorkoutDraft.state();
    baseProposal.programMeta = baseProposal.programMeta || {};
    baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
    baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: compiled.name || "Backup proof predecessor",
      answers: { goal: "strength_hypertrophy", daysPerWeek: 4 },
      destination: "log",
      origin: "first-run",
      draftConfirmed: true,
      telemetryRoute: "recommend",
      entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure,
      compilerContext: compiled.compilerContext,
      baseProposal,
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(finalized?.localOk || finalized?.idbOk), finalized };
  });
}

async function saveRealWorkout(page) {
  const day = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?.program?.[0]?.day || "Day 1");
  const entered = await page.evaluate((dayLabel) => window.__repforgeEnterWorkout({ day: dayLabel, focus: false }), day);
  if (!entered || entered.status && entered.status !== "ready") {
    throw new Error(`Could not enter production workout: ${JSON.stringify(entered)}`);
  }
  await page.locator("#workout input[data-k$='_load']").first().waitFor({ state: "visible" });
  await page.locator("#workout input[data-k$='_load']").first().fill("60");
  await page.locator("#workout input[data-k$='_reps']").first().fill("8");
  await page.locator("#workout input[data-k$='_rir']").first().fill("2");
  await page.locator("#workout button[data-save]").first().click();
  await page.waitForFunction(() => document.querySelector("#workout button[data-save]")?.getAttribute("aria-pressed") === "true");
  await page.locator("#logForm .btn--save").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === false, undefined, { timeout: 10000 });
  await page.locator("#sumDone").click();
  await page.waitForFunction(() => document.querySelector("#sessionSummary")?.hidden === true, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function commitReplacement(page) {
  const proposalResult = await page.evaluate(async () => window.__repforgeProgramTransition.proposeSibling({
    targetConstraint: { frequency: 3 },
    diagnosis: {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["p052-backup-evidence"],
      insufficientEvidenceReasons: [],
    },
    transitionId: "tr_p052_backup_a_to_b",
    successorProgramId: "prog_p052_backup_successor",
    createdAt: "2026-10-05T12:00:00.000Z",
  }));
  if (!proposalResult?.ok) throw new Error(`Could not propose A→B: ${JSON.stringify(proposalResult)}`);
  const proposal = proposalResult.proposal;
  const confirmed = await page.evaluate(async (p) => window.__repforgeProgramTransition.confirmTransition({
    proposal: p,
    transitionId: p.transitionId,
    successorProgramId: p.successor.programId,
    confirmedAt: "2026-10-05T12:10:00.000Z",
    proposalHash: p.proposalHash,
    acknowledgedDraftRaw: null,
  }), proposal);
  if (!(confirmed?.ok && confirmed?.committed && confirmed?.localOk && confirmed?.idbOk)) {
    throw new Error(`Could not commit A→B: ${JSON.stringify(confirmed)}`);
  }
  await page.evaluate(() => window.__repforgeStorage.flush());
  return { proposal, confirmed };
}

async function exportBackup(page) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await page.locator("#dataBackupRow").click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportJson").click(),
  ]);
  return JSON.parse(readFileSync(await download.path(), "utf8"));
}

async function importBackupThroughUi(page, text) {
  await page.evaluate(() => window.closeFirstRun?.());
  await page.evaluate(() => window.__repforgeShowSettings?.());
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({
    name: "taurifer-transition-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await page.locator("#importChoice").waitFor({ state: "visible" });
  await page.locator("#importReplace").click();
  await page.waitForFunction(() => document.querySelector("#importChoice")?.open === false, undefined, { timeout: 10000 });
  await page.evaluate(() => window.__repforgeStorage.flush());
}

async function volatileStorageKeys(page) {
  return page.evaluate(({ pending, draft, checkpoint, recovery, pendingPrefix, closingPrefix }) =>
    Object.keys(localStorage).filter((key) =>
      key === pending || key.startsWith(`${pendingPrefix}:`) ||
      key === draft || key === checkpoint || key === recovery ||
      key.startsWith(pendingPrefix) || key.startsWith(`${draft}:pending:`) ||
      key.startsWith(`${closingPrefix}`)), {
    pending: PENDING_PREFIX,
    draft: DRAFT_KEY,
    checkpoint: CHECKPOINT_KEY,
    recovery: DRAFT_RECOVERY_KEY,
    pendingPrefix: PENDING_PREFIX,
    closingPrefix: DRAFT_CLOSING_PREFIX,
  });
}

function transitionIdentity(snapshot) {
  const transitionIn = snapshot?.programMeta?.transitionIn;
  const archive = (snapshot?.programHistory || []).find((entry) => entry?.id === transitionIn?.archiveId);
  return {
    programId: snapshot?.programMeta?.id ?? null,
    transitionIn: transitionIn ?? null,
    archive: archive ?? null,
    archiveId: archive?.archiveId ?? null,
    transitionOut: archive?.transitionOut ?? null,
    log: snapshot?.log ?? [],
    program: snapshot?.program ?? [],
    programHistory: snapshot?.programHistory ?? [],
  };
}

function backupProvenance(snapshot) {
  const transitionIn = snapshot?.programMeta?.transitionIn ?? null;
  const history = Array.isArray(snapshot?.programHistory) ? snapshot.programHistory : [];
  const archive = history.find((entry) => entry?.id === transitionIn?.archiveId) ?? null;
  return {
    transitionIn: clone(transitionIn),
    archive: clone(archive),
    programHistory: clone(history),
    log: clone(snapshot?.log ?? []),
  };
}

function hasCompleteTransitionIn(transitionIn) {
  if (!transitionIn || typeof transitionIn !== "object" || Array.isArray(transitionIn)) return false;
  return [
    "schemaVersion", "transitionId", "kind", "status", "createdAt", "confirmedAt",
    "predecessor", "diagnosis", "derivation", "successor", "diff",
    "progressionContract", "archiveId", "proposalHash",
  ].every((key) => Object.prototype.hasOwnProperty.call(transitionIn, key));
}

function hasCompleteArchive(archive) {
  return !!archive && typeof archive === "object" && !Array.isArray(archive) &&
    typeof archive.id === "string" && archive.id === archive.archiveId &&
    archive.meta && typeof archive.meta === "object" && !Array.isArray(archive.meta) &&
    Array.isArray(archive.program) &&
    archive.transitionOut && typeof archive.transitionOut === "object" && !Array.isArray(archive.transitionOut);
}

async function main() {
  console.log("052-P7: program transition backup round-trip proof");
  await assertServingApp(BASE);
  const browser = await launchChromium();
  let sourceContext;
  let targetContext;
  try {
    sourceContext = await browser.newContext();
    const source = await sourceContext.newPage();
    source.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await source.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(source, { base: BASE });
    await source.evaluate(() => window.closeFirstRun?.());

    const activation = await activatePredecessor(source);
    check(activation.ok, "A predecessor was activated through production entry finalization", activation);
    if (!activation.ok) throw new Error(JSON.stringify(activation));
    await reloadAndBoot(source);

    await saveRealWorkout(source);
    const beforeTransition = await readReplicas(source);
    check(beforeTransition.local?.log?.length === 1 && beforeTransition.idb?.log?.length === 1,
      "A real saved workout supplies the non-empty log identity sentinel", {
        local: beforeTransition.local?.log?.length,
        idb: beforeTransition.idb?.log?.length,
      });

    const transition = await commitReplacement(source);
    check(transition.proposal.predecessor.programId === beforeTransition.local?.programMeta?.id,
      "A→B proposal pins the actual predecessor program identity");

    await reloadAndBoot(source);
    const sourceAfterTransition = await readReplicas(source);
    const sourceLocalProvenance = backupProvenance(sourceAfterTransition.local);
    const sourceIdbProvenance = backupProvenance(sourceAfterTransition.idb);
    const sourceProvenance = clone(sourceLocalProvenance);
    const sourceIdentity = transitionIdentity(sourceAfterTransition.local);
    check(sourceAfterTransition.local?.programMeta?.id === "prog_p052_backup_successor" &&
      sourceAfterTransition.idb?.programMeta?.id === "prog_p052_backup_successor",
      "A→B successor is present in both durable replicas");
    check(hasCompleteTransitionIn(sourceLocalProvenance.transitionIn) &&
      sourceLocalProvenance.transitionIn.status === "committed" &&
      sourceLocalProvenance.transitionIn.transitionId === transition.proposal.transitionId &&
      sourceLocalProvenance.transitionIn.proposalHash === transition.proposal.proposalHash &&
      sourceLocalProvenance.transitionIn.predecessor?.programId === transition.proposal.predecessor.programId &&
      sourceLocalProvenance.transitionIn.successor?.programId === transition.proposal.successor.programId,
      "Source successor programMeta.transitionIn is complete and matches the committed proposal");
    check(sourceIdentity.archiveId === transition.proposal.predecessor.programId &&
      sourceIdentity.archive?.id === transition.proposal.predecessor.programId &&
      sourceIdentity.archive?.archiveId === transition.proposal.predecessor.programId,
      "Predecessor archive identity and archiveId link match the contract");
    check(hasCompleteArchive(sourceLocalProvenance.archive) &&
      sourceLocalProvenance.archive.transitionOut.schemaVersion === 1 &&
      sourceLocalProvenance.archive.transitionOut.transitionId === transition.proposal.transitionId &&
      sourceLocalProvenance.archive.transitionOut.proposalHash === transition.proposal.proposalHash &&
      sourceLocalProvenance.archive.transitionOut.successorProgramId === transition.proposal.successor.programId,
      "Source predecessor archive retains complete transitionOut, meta, and program values");
    check(sameValue(sourceLocalProvenance.transitionIn, sourceIdbProvenance.transitionIn) &&
      sameValue(sourceLocalProvenance.archive, sourceIdbProvenance.archive) &&
      sameValue(sourceLocalProvenance.programHistory, sourceIdbProvenance.programHistory) &&
      sameValue(sourceLocalProvenance.log, sourceIdbProvenance.log),
      "Source localStorage and IndexedDB agree on complete transitionIn, archive, history, and log");
    check(sameValue(sourceLocalProvenance.log, beforeTransition.local?.log) &&
      sameValue(sourceIdbProvenance.log, beforeTransition.idb?.log),
      "A→B preserves the real workout log identity and values in both source replicas");

    // Create a real acknowledged DraftV2 after the transition. Ordinary backup
    // must omit it even though it is present at export time.
    const successorDay = await source.evaluate(() => window.__repforgeWorkoutDraft.state()?.program?.[0]?.day || "Day 1");
    await source.evaluate((day) => window.__repforgeEnterWorkout({ day, focus: false }), successorDay);
    const sourceDraftState = await source.evaluate(() => ({
      raw: localStorage.getItem("repforge_draft_v1"),
      checkpoint: localStorage.getItem("repforge_draft_v1:v2-checkpoint"),
    }));
    check(typeof sourceDraftState.raw === "string" && sourceDraftState.raw.length > 0 &&
      typeof sourceDraftState.checkpoint === "string" && sourceDraftState.checkpoint.length > 0,
      "Source has an acknowledged DraftV2 at ordinary backup export time");

    const exported = await exportBackup(source);
    const expectedExport = clone(exported);
    const mutation = process.env.P052_MUTATE_BACKUP || "";
    if (mutation && !NEGATIVE_MUTATIONS.has(mutation)) {
      throw new Error(`Unknown P052_MUTATE_BACKUP value: ${mutation}`);
    }
    const importedDocument = mutation ? mutateBackupForNegative(exported, mutation) : exported;
    if (mutation) console.log(`\nControlled negative: mutating ${mutation} before the production import UI`);

    check(!VOLATILE_STATE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(exported, key)),
      "Ordinary backup excludes storage revisions, follow-up, and transaction markers");
    check(!Object.prototype.hasOwnProperty.call(exported, "workoutDraft") &&
      !Object.prototype.hasOwnProperty.call(exported, "sharedSetup"),
      "Ordinary backup excludes DraftV2 and shared-setup payload fields");
    check(!JSON.stringify(exported).includes("repforge_pending_v1") &&
      !JSON.stringify(exported).includes("repforge_draft_v1"),
      "Ordinary backup contains no volatile journal or DraftV2 storage key");
    const exportedProvenance = backupProvenance(exported);
    check(sameValue(exportedProvenance.transitionIn, sourceProvenance.transitionIn) &&
      sameValue(exportedProvenance.archive, sourceProvenance.archive) &&
      sameValue(exportedProvenance.programHistory, sourceProvenance.programHistory) &&
      sameValue(exportedProvenance.log, sourceProvenance.log),
      "Production export preserves the complete source transitionIn, archive, history, and log values");

    targetContext = await browser.newContext();
    const target = await targetContext.newPage();
    target.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await target.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForAppBoot(target, { base: BASE });
    await importBackupThroughUi(target, JSON.stringify(importedDocument, null, 2));
    await target.waitForFunction(
      () => window.__repforgeWorkoutDraft.state()?.programMeta?.id === "prog_p052_backup_successor",
      undefined,
      { timeout: 10000 },
    );
    await target.evaluate(() => window.__repforgeStorage.flush());

    const targetBeforeReload = await readReplicas(target);
    const targetIdentity = transitionIdentity(targetBeforeReload.local);
    const targetLocalProvenance = backupProvenance(targetBeforeReload.local);
    const targetIdbProvenance = backupProvenance(targetBeforeReload.idb);
    check(sameLogicalDocument(targetBeforeReload.local, expectedExport) &&
      sameLogicalDocument(targetBeforeReload.idb, expectedExport),
      "Fresh-context Replace imports the exact exported logical document into both replicas", {
        mutation,
        localProgramId: targetBeforeReload.local?.programMeta?.id,
        idbProgramId: targetBeforeReload.idb?.programMeta?.id,
      });
    check(sameValue(targetLocalProvenance, sourceProvenance) &&
      sameValue(targetIdbProvenance, sourceProvenance),
      "Both imported replicas preserve complete transitionIn, archive, history, and log source values");
    check(!IMPORT_MARKER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(targetBeforeReload.local || {}, key)) &&
      !IMPORT_MARKER_KEYS.some((key) => Object.prototype.hasOwnProperty.call(targetBeforeReload.idb || {}, key)),
      "Fresh-context import leaves no follow-up or transaction marker in either durable replica");
    check(targetIdentity.programId === expectedExport.programMeta?.id &&
      JSON.stringify(targetIdentity.program) === JSON.stringify(expectedExport.program) &&
      JSON.stringify(targetIdentity.log) === JSON.stringify(expectedExport.log) &&
      JSON.stringify(targetIdentity.programHistory) === JSON.stringify(expectedExport.programHistory),
      "Fresh-context import preserves program/log/history identity from the backup file");
    check(targetIdentity.transitionIn?.transitionId === sourceIdentity.transitionIn?.transitionId &&
      targetIdentity.transitionIn?.proposalHash === sourceIdentity.transitionIn?.proposalHash &&
      targetIdentity.transitionIn?.archiveId === sourceIdentity.transitionIn?.archiveId,
      "Fresh-context import preserves successor transitionIn identity and archive link");
    check(targetIdentity.transitionOut?.transitionId === sourceIdentity.transitionOut?.transitionId &&
      targetIdentity.transitionOut?.proposalHash === sourceIdentity.transitionOut?.proposalHash &&
      targetIdentity.transitionOut?.successorProgramId === sourceIdentity.transitionOut?.successorProgramId &&
      targetIdentity.archive?.id === sourceIdentity.archive?.id &&
      targetIdentity.archive?.archiveId === sourceIdentity.archive?.archiveId,
      "Fresh-context import preserves predecessor transitionOut and archive identity");
    check((await volatileStorageKeys(target)).length === 0,
      "Fresh-context backup import creates no DraftV2, journal, checkpoint, recovery, or closing markers",
      await volatileStorageKeys(target));
    check(!target.url().includes("#setup="), "Backup import does not enter or modify the shared-setup URL route", target.url());

    const targetReloadBefore = clone(targetBeforeReload);
    await reloadAndBoot(target);
    const targetAfterReload = await readReplicas(target);
    const reloadedLocalProvenance = backupProvenance(targetAfterReload.local);
    const reloadedIdbProvenance = backupProvenance(targetAfterReload.idb);
    check(sameLogicalDocument(targetAfterReload.local, targetReloadBefore.local) &&
      sameLogicalDocument(targetAfterReload.idb, targetReloadBefore.idb),
      "Reload preserves the imported logical document exactly in both replicas");
    check(sameValue(reloadedLocalProvenance, sourceProvenance) &&
      sameValue(reloadedIdbProvenance, sourceProvenance) &&
      sameValue(reloadedLocalProvenance, reloadedIdbProvenance),
      "Reload keeps complete transitionIn, archive, history, and log replicas equal");
  } finally {
    await targetContext?.close().catch(() => {});
    await sourceContext?.close().catch(() => {});
    await browser.close();
  }

  console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Test error:", error);
  process.exit(1);
});
