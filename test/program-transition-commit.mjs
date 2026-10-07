#!/usr/bin/env node
/**
 * Focused vertical slice test for Plan 052-P6a:
 * Commit transitions with atomic provenance and draft preservation.
 *
 * Runs end-to-end against a live Taurifer server at REPFORGE_URL.
 *
 * State-model contract this test pins (see 052-P6a-state-model-correction):
 *  - the preview proposal is the sole authority for every commit identity;
 *  - the pure transition module seals with explicit values only (no clock /
 *    random / identity fallback);
 *  - since Plan 067 a transition is a program_definition_replacement: the
 *    successor ProgramDefinition is the exact derivation of the hashed change
 *    from the predecessor's stored definition, validated lock-held;
 *  - the existing program-replacement capture/archive transaction creates the
 *    one linked archive;
 *  - a real intervening durable commit is what proves stale rejection, verified
 *    in BOTH durable replicas plus a committed nonempty log sentinel and the
 *    exact DraftV2 raw / checkpoint;
 *  - mismatched external pins and freshly rehashed semantic invalidity mutate
 *    neither replica.
 *
 * The oracle is the clone-returning window.__repforgeWorkoutDraft.state(); the
 * live mutable production state is never exposed to the test.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);
const Transition = require("../program-transition.js");

const PLAN_DATA = new URL("../plans/067/data/", import.meta.url);
const gym = JSON.parse(readFileSync(new URL("gym.json", PLAN_DATA), "utf8"));
const observations = JSON.parse(readFileSync(new URL("programs.json", PLAN_DATA), "utf8"));
const rawCatalog = JSON.parse(readFileSync(new URL("app_file.json", PLAN_DATA), "utf8"));
const observedIds = [...new Set(Object.values(observations).flatMap((program) =>
  program.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId))))];
// A generated four-day, 90-minute hypertrophy program: fewer days regenerates
// it on three days, shorter sessions under a 60-minute ceiling.
const REQUEST = {
  goal: "hypertrophy", experience: "intermediate", daysPerWeek: 4, timeCeilingMinutes: 90,
  gymProfile: { equipmentIds: gym.equipment.map((entry) => entry.equipmentId) },
  competencyAnswers: {
    pullups10: null, pullups5: null, pushups15: null, inclineBarbell10: null,
    overheadPress10: null, bodyweightDips10: null, benchPress10: null,
  },
  movementConfirmations: Object.fromEntries(observedIds.map((id) =>
    [id, [...rawCatalog.exercises.find((entry) => entry.id === id).preconditions]])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: [], excludedExerciseIds: [], excludedMuscleIds: [],
  preferredExerciseIds: [], split: "auto", periodization: "static", cycles: 4, deloadCycles: [],
};
const FEWER_DAYS = { kind: "fewer_days", daysPerWeek: 3 };
const SHORTER_SESSIONS = { kind: "shorter_sessions", sessionMinutes: 60 };
const trainingDays = (definition) => (definition?.days || []).filter((day) => day.kind === "training");

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";

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

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

async function readIdbState(page) {
  return page.evaluate(async ({ dbName, storeName, key }) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.close();
          return resolve(null);
        }
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result ?? null);
        };
        getReq.onerror = () => {
          db.close();
          reject(getReq.error);
        };
      };
    });
  }, { dbName: DB_NAME, storeName: "kv", key: KEY });
}

// Parse both durable replicas and return the semantic fields the state model
// pins. Byte equality is only ever used for the DraftV2 raw / checkpoint oracle.
async function readReplicas(page) {
  const localRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const idb = await readIdbState(page);
  const local = JSON.parse(localRaw || "null");
  const semantic = (s) => s && ({
    programId: s.programMeta?.id ?? null,
    revision: s._storageRevision ?? null,
    daysPerWeek: s.programMeta?.daysPerWeek ?? null,
    transitionIn: s.programMeta?.transitionIn ?? null,
    programDefinition: s.programMeta?.programDefinition ?? null,
    historyLen: Array.isArray(s.programHistory) ? s.programHistory.length : 0,
    programHistory: s.programHistory ?? [],
    storageDraftTransaction: s._storageDraftTransaction ?? null,
    log: s.log ?? [],
  });
  return { local: semantic(local), idb: semantic(idb), rawLocal: localRaw };
}

async function clearStorage(page) {
  await page.evaluate(async ({ key, draftKey, checkpointKey, dbName }) => {
    localStorage.removeItem(key);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
    localStorage.removeItem("repforge_program_setup_draft_v1");
    localStorage.removeItem("repforge_ui_v1");
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, dbName: DB_NAME });
}

async function confirmTransition(page, args) {
  return page.evaluate(async (a) => window.__repforgeProgramTransition.confirmTransition(a), args);
}

// Activate a generated four-day/90-minute program through the production
// finalization seam, with the answers the entry flow derives from it.
async function activateGeneratedPredecessor(page) {
  return page.evaluate(async (request) => {
    if (!window.RepForgeProgramCompiler || !window.RepForgeExerciseCatalog) {
      return { ok: false, error: "program generator or exercise catalog unavailable in window" };
    }
    const generated = window.RepForgeProgramCompiler.generateProgram(
      request, window.RepForgeExerciseCatalog.snapshot(), "p6a-transition-commit");
    if (!generated.ok) return { ok: false, error: "generation failed", issues: generated.conflicts };
    const definition = generated.value;
    const finalized = await window.__repforgeFinalizeProgramSetup({
      programDefinition: definition,
      name: "Generated 4-Day",
      answers: {
        daysPerWeek: definition.days.filter((day) => day.kind === "training").length,
        goal: definition.request.goal,
        experience: definition.request.experience,
        splitType: definition.request.split,
        mesocycleLengthWeeks: definition.cycles,
      },
      destination: "log", origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "p6a-transition-commit" },
    });
    await window.__repforgeStorage.flush();
    return { ok: !!(finalized?.localOk || finalized?.idbOk), finalized };
  }, REQUEST);
}

// Edit the first set's first programmed metric, complete it, and add notes.
async function populateDraft(page, { value, notes, complete = true }) {
  return page.evaluate(async ({ value, notes, complete }) => {
    const dayLabel = (window.__repforgeWorkoutDraft.state()?.program || [])[0]?.day;
    if (!dayLabel || !await window.__repforgeEnterWorkout({ day: dayLabel })) {
      return { ok: false, error: "production workout entry failed" };
    }
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const exId = draft?.exerciseOrder?.[0];
    const setId = draft?.exercises?.[exId]?.setOrder?.[0];
    const metrics = draft?.exercises?.[exId]?.sets?.[setId]?.programmed?.metrics || [];
    if (!exId || !setId || !metrics.length) return { ok: false, error: "draft has no programmed metric to edit" };
    const results = [];
    for (const [index, metric] of metrics.entries()) {
      results.push(await hook.dispatch("editMetricValue",
        { exerciseInstanceId: exId, setId, metricId: metric.id, value: index === 0 ? value : "8" }));
    }
    if (complete) results.push(await hook.dispatch("completeSet", { exerciseInstanceId: exId, setId, completedAt: new Date().toISOString() }));
    results.push(await hook.dispatch("setSessionNotes", { value: notes }));
    await hook.flush();
    if (results.some((result) => result?.status !== "applied")) {
      return { ok: false, error: "draft command refused", results: results.map((result) => ({ status: result?.status, code: result?.code })) };
    }
    return {
      ok: true,
      raw: localStorage.getItem("repforge_draft_v1"),
      checkpointRaw: localStorage.getItem("repforge_draft_v1:v2-checkpoint"),
      draft: hook.current(),
    };
  }, { value, notes, complete });
}

async function proposeChange(page, change, overrides = {}) {
  return page.evaluate(async (args) => window.__repforgeProgramTransition.proposeChange(args), {
    change,
    transitionId: "tr_p6a_link_case",
    successorProgramId: "prog_p6a_link_succ",
    createdAt: "2026-10-02T14:00:00.000Z",
    ...overrides,
  });
}

// Overwrite the single stored archive row's identity fields through the real
// proposed-state commit seam, then reload. Returns whether the commit landed so
// the caller can assert the injection actually took before probing idempotency.
async function injectArchiveIdentity(page, patch) {
  const res = await page.evaluate(async (p) => {
    const s = window.__repforgeWorkoutDraft.state();
    const hist = Array.isArray(s.programHistory) ? s.programHistory : [];
    if (!hist.length) return { ok: false, error: "no archive row to mutate" };
    if (Object.prototype.hasOwnProperty.call(p, "id")) hist[0].id = p.id;
    if (Object.prototype.hasOwnProperty.call(p, "archiveId")) hist[0].archiveId = p.archiveId;
    const r = await window.__repforgeCommitProposedState(s);
    await window.__repforgeStorage.flush();
    return { ok: r.localOk || r.idbOk, r };
  }, patch);
  if (res.ok) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
  }
  return res;
}


const STORAGE_LOCK = "repforge:state-write";

async function holdStorageLock(page) {
  await page.evaluate((lockName) => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    window.__auditReleaseStorageLock = release;
    window.__auditStorageLockHeld = false;
    window.__auditStorageLockDone = navigator.locks.request(lockName, async () => {
      window.__auditStorageLockHeld = true;
      await gate;
    });
  }, STORAGE_LOCK);
  await page.waitForFunction(() => window.__auditStorageLockHeld === true, { timeout: 10000 });
}

async function waitForPendingStorageLocks(page, count) {
  await page.waitForFunction(
    async ({ lockName, count }) => {
      const state = await navigator.locks.query();
      return state.pending.filter((lock) => lock.name === lockName).length >= count;
    },
    { lockName: STORAGE_LOCK, count },
    { timeout: 10000 }
  );
}

async function releaseStorageLock(page) {
  await page.evaluate(async () => {
    window.__auditReleaseStorageLock();
    await window.__auditStorageLockDone;
  });
}

async function setupPredecessorWithSentinelAndDraft(page, tag = "p6b") {
  const act = await activateGeneratedPredecessor(page);
  if (!act.ok) throw new Error(`Activation failed in setupPredecessor: ${JSON.stringify(act)}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const logSeed = await page.evaluate(async (t) => {
    const s = window.__repforgeWorkoutDraft.state();
    const row0 = (s.program || [])[0];
    if (!row0) return { ok: false, error: "no compiled program rows" };
    const sessionId = `p6b-sentinel-${t}`;
    const entry = {
      session: sessionId,
      date: "2026-10-01",
      day: row0.day,
      exerciseId: row0.id,
      performedName: row0.name,
      performedLibraryId: typeof row0.libraryId === "string" ? row0.libraryId : null,
      performedMovementId: typeof row0.movementId === "string" ? row0.movementId : null,
      set: 1,
      load: 60,
      reps: 8,
      rir: 2,
      created: "2026-10-01T09:00:00.000Z",
    };
    s.log = [...(s.log || []), entry];
    const res = await window.__repforgeCommitProposedState(s);
    await window.__repforgeStorage.flush();
    return { ok: res.localOk && res.idbOk, res, entry, sessionId };
  }, tag);
  if (!logSeed.ok) throw new Error(`Log seed failed: ${JSON.stringify(logSeed)}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const draftSetup = await populateDraft(page, { value: "72.5", notes: "Draft session notes before race transition" });
  if (!draftSetup.ok) throw new Error(`Draft setup failed: ${JSON.stringify(draftSetup)}`);

  const s = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
  return {
    predecessorProgramId: s.programMeta?.id,
    predecessorRevision: s._storageRevision,
    predecessorDefinition: s.programMeta?.programDefinition,
    logSentinel: s.log || [],
    preDraftRaw: draftSetup.raw,
    preCheckpointRaw: draftSetup.checkpointRaw,
  };
}

async function main() {
  console.log("052-P6a: program transition commit vertical slice");
  await assertServingApp(BASE);

  const browser = await launchChromium();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("dialog", (d) => d.dismiss().catch(() => {}));

    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await clearStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    // -------------------------------------------------------------------------
    // Step 1: Activate a real balanced 4-day/90-minute Recommend program
    // through the production finalization seam.
    // -------------------------------------------------------------------------
    console.log("\n1. Activate a generated 4-day/90-minute program");
    const activationResult = await activateGeneratedPredecessor(page);
    check(activationResult.ok, "predecessor generated and activated through production finalization seam", activationResult.issues || activationResult.error);
    if (!activationResult.ok) {
      throw new Error(`Step 1 failed: ${activationResult.error}`);
    }

    const predecessorMetaBeforeReload = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?.programMeta);
    check(predecessorMetaBeforeReload?.onboarded === true, "predecessor is onboarded");
    check(predecessorMetaBeforeReload?.daysPerWeek === 4, "predecessor has 4 days per week");
    check(trainingDays(predecessorMetaBeforeReload?.programDefinition).length === 4 &&
      predecessorMetaBeforeReload?.programDefinition?.request?.timeCeilingMinutes === 90,
      "predecessor holds a four-day, 90-minute ProgramDefinition");

    // -------------------------------------------------------------------------
    // Step 1b: Commit one schema-valid nonempty log row through the production
    // proposed-state seam, using a real compiled exercise / slot identity. This
    // is the sentinel: history identity must be provably unchanged on stale
    // rejection and provably identical on success/reload/retry.
    // -------------------------------------------------------------------------
    console.log("\n1b. Commit a real nonempty log sentinel row");
    const logSeed = await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      const row0 = (s.program || [])[0];
      if (!row0) return { ok: false, error: "no compiled program rows" };
      const sessionId = "p6a-sentinel-session";
      const entry = {
        session: sessionId,
        date: "2026-10-01",
        day: row0.day,
        exerciseId: row0.id,
        performedName: row0.name,
        performedLibraryId: typeof row0.libraryId === "string" ? row0.libraryId : null,
        performedMovementId: typeof row0.movementId === "string" ? row0.movementId : null,
        set: 1,
        load: 60,
        reps: 8,
        rir: 2,
        created: "2026-10-01T09:00:00.000Z",
      };
      s.log = [...(s.log || []), entry];
      const res = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: res.localOk || res.idbOk, res, entry, sessionId };
    });
    check(logSeed.ok, "log sentinel row committed through __repforgeCommitProposedState", logSeed.res);
    if (!logSeed.ok) throw new Error(`Step 1b failed: ${JSON.stringify(logSeed)}`);

    // Reload; capture the exact semantic log array and durable identity.
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const predecessorHead = await page.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return {
        storageRevision: s?._storageRevision,
        meta: s?.programMeta,
        programLength: (s?.program || []).length,
        log: s?.log || [],
      };
    });
    check(predecessorHead.meta?.onboarded === true, "predecessor survived reload onboarded");
    check(predecessorHead.programLength > 0, "predecessor has program rows", predecessorHead.programLength);
    check(isDeepStrictEqual(predecessorHead.meta?.programDefinition, predecessorMetaBeforeReload?.programDefinition),
      "the durable ProgramDefinition survives reload unchanged");
    check(predecessorHead.log.length === 1 && predecessorHead.log[0].session === logSeed.sessionId, "durable log holds exactly the sentinel session");

    const predecessorProgramId = predecessorHead.meta?.id;
    const predecessorRevision = predecessorHead.storageRevision;
    const predecessorDefinition = predecessorHead.meta?.programDefinition;
    const logSentinel = predecessorHead.log;

    const replicasAtPredecessor = await readReplicas(page);
    check(replicasAtPredecessor.local.programId === predecessorProgramId && replicasAtPredecessor.idb.programId === predecessorProgramId,
      "both replicas hold the predecessor programId before any transition");
    check(isDeepStrictEqual(replicasAtPredecessor.local.log, logSentinel) && isDeepStrictEqual(replicasAtPredecessor.idb.log, logSentinel),
      "both replicas hold the exact log sentinel before any transition");

    // -------------------------------------------------------------------------
    // Step 2: Populate active workout draft state via RepForgeWorkoutDraft
    // -------------------------------------------------------------------------
    console.log("\n2. Populate active workout draft with edits, notes, and checkpoint");
    const draftSetup = await populateDraft(page, { value: "72.5", notes: "Draft session notes before sibling transition" });

    check(draftSetup.ok, "workout draft populated and flushed", draftSetup.ok ? undefined : draftSetup);
    if (!draftSetup.ok) throw new Error(`Step 2 failed: ${draftSetup.error}`);

    const preDraftRaw = draftSetup.raw;
    const preCheckpointRaw = draftSetup.checkpointRaw;
    check(typeof preDraftRaw === "string" && preDraftRaw.length > 0, "repforge_draft_v1 has raw string in storage");
    check(typeof preCheckpointRaw === "string" && preCheckpointRaw.length > 0, "repforge_draft_v1:v2-checkpoint has raw string in storage");
    check(draftSetup.draft.program?.programId === predecessorProgramId, "draft is bound to predecessor programId");

    const revisionAtProposal = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?._storageRevision);

    // -------------------------------------------------------------------------
    // Step 3: Propose sibling transition through production transition adapter
    // -------------------------------------------------------------------------
    console.log("\n3. Propose a fewer-days replacement through the production transition adapter");
    const transitionHookAvailable = await page.evaluate(() =>
      typeof window.__repforgeProgramTransition === "object" && window.__repforgeProgramTransition !== null);
    check(transitionHookAvailable, "window.__repforgeProgramTransition is defined");
    if (!transitionHookAvailable) throw new Error("production transition adapter not implemented");

    const transitionId = "tr_p6a_test_b4_to_b3";
    const successorProgramId = "prog_balanced_3_p6a_succ";
    const proposalCreatedAt = "2026-10-02T14:00:00.000Z";

    const proposeArgs = {
      change: FEWER_DAYS,
      transitionId,
      successorProgramId,
      createdAt: proposalCreatedAt,
    };
    const proposalResult = await page.evaluate(async (args) =>
      window.__repforgeProgramTransition.proposeChange(args), proposeArgs);

    check(proposalResult?.ok === true, "proposeChange succeeds", proposalResult?.code || proposalResult?.error);
    if (!proposalResult?.ok) throw new Error(`Step 3 failed: ${JSON.stringify(proposalResult)}`);

    const proposal = proposalResult.proposal;
    check(proposal.status === "preview", "proposal status is preview");
    check(proposal.kind === Transition.KIND && proposal.kind === "program_definition_replacement",
      "proposal kind is program_definition_replacement");
    check(isDeepStrictEqual(proposal.change, FEWER_DAYS), "proposal carries the requested change", proposal.change);
    check(proposal.predecessor?.programId === predecessorProgramId, "proposal predecessor programId matches head");
    check(proposal.predecessor?.durableRevision === revisionAtProposal, "proposal pins the durable revision it was built at");
    check(proposal.predecessor?.definitionFingerprint === await Transition.fingerprintProgramDefinition(predecessorDefinition, []),
      "proposal pins the fingerprint of the stored predecessor definition");
    check(proposal.successor?.programId === successorProgramId, "proposal successor programId matches requested");
    check(trainingDays(proposal.successor?.programDefinition).length === 3 &&
      proposal.successor?.programDefinition?.request?.daysPerWeek === 3 &&
      proposal.successor?.programDefinition?.request?.timeCeilingMinutes === 90,
      "successor definition is regenerated on three days and keeps the 90-minute ceiling");
    check(proposal.successor?.definitionFingerprint ===
      await Transition.fingerprintProgramDefinition(proposal.successor.programDefinition, proposal.successor.customExerciseDefinitions),
      "successor fingerprint matches its definition");
    check(typeof proposal.proposalHash === "string" && proposal.proposalHash.length === 64, "proposal carries 64-char proposalHash");

    const expectedHash = await Transition.hashProposal(proposal);
    check(proposal.proposalHash === expectedHash, "proposalHash matches independent hashProposal calculation");

    // -------------------------------------------------------------------------
    // Step 4: Real stale rejection — a separate benign durable commit advances
    // the durable revision AFTER the proposal was built. The old proposal must
    // be rejected without touching either replica, the archive, or the draft.
    // -------------------------------------------------------------------------
    console.log("\n4. Real intervening durable commit → stale rejection in both replicas");
    const benignCommit = await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      const before = s.settings?.restSec ?? 90;
      s.settings = { ...(s.settings || {}), restSec: before + 5 };
      const res = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: res.localOk || res.idbOk, res, restSec: before + 5 };
    });
    check(benignCommit.ok, "benign settings commit advanced durable state", benignCommit.res);
    const revisionAfterBenign = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?._storageRevision);
    check(revisionAfterBenign === revisionAtProposal + 1, "benign commit advanced the durable revision by exactly one",
      { revisionAtProposal, revisionAfterBenign });

    const staleResult = await confirmTransition(page, {
      proposal,
      transitionId: proposal.transitionId,
      successorProgramId: proposal.successor.programId,
      confirmedAt: "2026-10-02T14:05:00.000Z",
      proposalHash: proposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });
    check(staleResult?.localOk === false && staleResult?.idbOk === false, "stale confirmation rejected");
    check(staleResult?.committed === false, "stale confirmation is not committed");
    check(staleResult?.staleRevision === true || staleResult?.stale === true || staleResult?.code === "stale_proposal",
      "stale confirmation returns a typed stale result", staleResult);

    const afterStale = await readReplicas(page);
    const liveAfterStale = await page.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return { programId: s.programMeta?.id, rev: s._storageRevision, transitionIn: s.programMeta?.transitionIn ?? null,
        historyLen: (s.programHistory || []).length, log: s.log || [] };
    });
    check(liveAfterStale.rev <= revisionAfterBenign, "transition attempt did not advance the durable revision beyond R+1",
      { rev: liveAfterStale.rev, ceiling: revisionAfterBenign });
    check(afterStale.local.programId === predecessorProgramId && afterStale.idb.programId === predecessorProgramId,
      "both replicas still hold the predecessor programId after stale rejection");
    check(afterStale.local.transitionIn == null && afterStale.idb.transitionIn == null,
      "neither replica gained a transition-in record after stale rejection");
    check(afterStale.local.historyLen === 0 && afterStale.idb.historyLen === 0,
      "neither replica gained an archive after stale rejection");
    check(isDeepStrictEqual(afterStale.local.log, logSentinel) && isDeepStrictEqual(afterStale.idb.log, logSentinel),
      "both replicas retain the exact log sentinel after stale rejection");
    const draftAfterStale = await page.evaluate((keys) => ({
      raw: localStorage.getItem(keys.d), checkpoint: localStorage.getItem(keys.c),
    }), { d: DRAFT_KEY, c: CHECKPOINT_KEY });
    check(draftAfterStale.raw === preDraftRaw, "DraftV2 raw unchanged after stale rejection");
    check(draftAfterStale.checkpoint === preCheckpointRaw, "DraftV2 checkpoint unchanged after stale rejection");

    // -------------------------------------------------------------------------
    // Step 4b: Re-propose from the current durable revision (R+1) for the
    // negative-pin and success paths.
    // -------------------------------------------------------------------------
    console.log("\n4b. Re-propose from the advanced durable revision");
    const reproposeResult = await page.evaluate(async (args) =>
      window.__repforgeProgramTransition.proposeChange(args), proposeArgs);
    check(reproposeResult?.ok === true, "re-proposal from R+1 succeeds", reproposeResult?.code);
    if (!reproposeResult?.ok) throw new Error(`Step 4b failed: ${JSON.stringify(reproposeResult)}`);
    const freshProposal = reproposeResult.proposal;
    check(freshProposal.predecessor.durableRevision === revisionAfterBenign, "fresh proposal pins R+1");
    const freshDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);

    // -------------------------------------------------------------------------
    // Step 4c: Negative pin proof — every mismatched external pin, a missing
    // confirmedAt, an early-idempotency-shaped bogus proposal, and a freshly
    // rehashed semantic-invalid preflight case. Each is typed invalid with zero
    // revision / archive / successor / draft mutation in BOTH replicas.
    // -------------------------------------------------------------------------
    console.log("\n4c. Negative pin proof (zero mutation in both replicas)");
    const negativeCases = [
      {
        name: "mismatched external proposalHash",
        args: { proposal: freshProposal, transitionId: freshProposal.transitionId,
          successorProgramId: freshProposal.successor.programId, confirmedAt: "2026-10-02T14:06:00.000Z",
          proposalHash: "0".repeat(64), acknowledgedDraftRaw: freshDraftRaw },
        expect: (r) => r.invalid === true && r.code === "proposal_hash_mismatch",
      },
      {
        name: "mismatched external transitionId",
        args: { proposal: freshProposal, transitionId: "tr_not_the_proposal",
          successorProgramId: freshProposal.successor.programId, confirmedAt: "2026-10-02T14:06:00.000Z",
          proposalHash: freshProposal.proposalHash, acknowledgedDraftRaw: freshDraftRaw },
        expect: (r) => r.invalid === true && r.code === "transition_id_mismatch",
      },
      {
        name: "mismatched external successorProgramId",
        args: { proposal: freshProposal, transitionId: freshProposal.transitionId,
          successorProgramId: "prog_attacker_choice", confirmedAt: "2026-10-02T14:06:00.000Z",
          proposalHash: freshProposal.proposalHash, acknowledgedDraftRaw: freshDraftRaw },
        expect: (r) => r.invalid === true && r.code === "successor_id_mismatch",
      },
      {
        name: "missing confirmedAt",
        args: { proposal: freshProposal, transitionId: freshProposal.transitionId,
          successorProgramId: freshProposal.successor.programId,
          proposalHash: freshProposal.proposalHash, acknowledgedDraftRaw: freshDraftRaw },
        expect: (r) => r.invalid === true && r.code === "confirmed_at_missing",
      },
      {
        name: "early-idempotency-shaped bogus proposal (caller strings only)",
        args: { proposal: { nonsense: true }, transitionId: freshProposal.transitionId,
          successorProgramId: freshProposal.successor.programId, confirmedAt: "2026-10-02T14:06:00.000Z",
          proposalHash: freshProposal.proposalHash, acknowledgedDraftRaw: freshDraftRaw },
        expect: (r) => r.invalid === true && r.code === "unsupported_transition_kind",
      },
      {
        name: "missing acknowledgedDraftRaw key",
        args: { proposal: freshProposal, transitionId: freshProposal.transitionId,
          successorProgramId: freshProposal.successor.programId, confirmedAt: "2026-10-02T14:06:00.000Z",
          proposalHash: freshProposal.proposalHash },
        expect: (r) => r.invalid === true && r.code === "acknowledged_draft_missing",
      },
    ];

    const replicasBeforeNegatives = await readReplicas(page);
    for (const nc of negativeCases) {
      const r = await confirmTransition(page, nc.args);
      check(nc.expect(r), `negative pin rejected: ${nc.name}`, r);
      check(r.localOk === false && r.idbOk === false && r.committed === false, `negative pin left nothing committed: ${nc.name}`, r);
    }

    // Freshly rehashed semantic-invalid proposal: the successor definition is
    // tampered (one more set on a slot) and both its fingerprint and the
    // proposal hash are recomputed, so only the lock-held derivation check can
    // tell it is not the derivation of the hashed change.
    const invalidProposal = JSON.parse(JSON.stringify(freshProposal));
    const tamperedSlot = trainingDays(invalidProposal.successor.programDefinition)[0].slots[0];
    const tamperedSets = tamperedSlot.prescriptionsByCycle[0].sets;
    tamperedSets.push({ ...tamperedSets[tamperedSets.length - 1], id: `${tamperedSets[tamperedSets.length - 1].id}~tampered` });
    invalidProposal.successor.definitionFingerprint = await Transition.fingerprintProgramDefinition(
      invalidProposal.successor.programDefinition, invalidProposal.successor.customExerciseDefinitions);
    const invalidHash = await Transition.hashProposal(invalidProposal);
    invalidProposal.proposalHash = invalidHash;
    const invalidResult = await confirmTransition(page, {
      proposal: invalidProposal,
      transitionId: invalidProposal.transitionId,
      successorProgramId: invalidProposal.successor.programId,
      confirmedAt: "2026-10-02T14:06:30.000Z",
      proposalHash: invalidHash,
      acknowledgedDraftRaw: freshDraftRaw,
    });
    check(invalidResult?.localOk === false && invalidResult?.idbOk === false && invalidResult?.committed === false,
      "freshly rehashed semantic-invalid proposal rejected in lock-held preflight", invalidResult);
    check(invalidResult?.invalid === true &&
      (invalidResult?.code === "successor_derivation_mismatch" || invalidResult?.code === "program_definition_invalid"),
      "semantic-invalid proposal returns a typed invalid result", invalidResult);

    // Draft-mismatch is still a typed conflict.
    const draftMismatchResult = await confirmTransition(page, {
      proposal: freshProposal,
      transitionId: freshProposal.transitionId,
      successorProgramId: freshProposal.successor.programId,
      confirmedAt: "2026-10-02T14:07:00.000Z",
      proposalHash: freshProposal.proposalHash,
      acknowledgedDraftRaw: JSON.stringify({ mismatched: true }),
    });
    check(draftMismatchResult?.localOk === false && draftMismatchResult?.idbOk === false, "draft mismatch rejected");
    check(draftMismatchResult?.draftConflict === true || draftMismatchResult?.conflict === true, "draft mismatch returns draftConflict");

    const replicasAfterNegatives = await readReplicas(page);
    check(replicasAfterNegatives.local.revision === replicasBeforeNegatives.local.revision &&
          replicasAfterNegatives.idb.revision === replicasBeforeNegatives.idb.revision,
      "no negative case advanced the durable revision in either replica",
      { before: replicasBeforeNegatives.local.revision, afterLocal: replicasAfterNegatives.local.revision, afterIdb: replicasAfterNegatives.idb.revision });
    check(replicasAfterNegatives.local.programId === predecessorProgramId && replicasAfterNegatives.idb.programId === predecessorProgramId,
      "both replicas still hold the predecessor programId after every negative case");
    check(replicasAfterNegatives.local.transitionIn == null && replicasAfterNegatives.idb.transitionIn == null,
      "neither replica gained a transition-in after any negative case");
    check(replicasAfterNegatives.local.historyLen === 0 && replicasAfterNegatives.idb.historyLen === 0,
      "neither replica gained an archive after any negative case");
    check(isDeepStrictEqual(replicasAfterNegatives.local.log, logSentinel) && isDeepStrictEqual(replicasAfterNegatives.idb.log, logSentinel),
      "both replicas retain the exact log sentinel after every negative case");
    const draftAfterNegatives = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    check(draftAfterNegatives === freshDraftRaw, "DraftV2 raw unchanged across every negative case");

    // -------------------------------------------------------------------------
    // Step 5: Confirm the valid transition via production adapter
    // -------------------------------------------------------------------------
    console.log("\n5. Confirm valid transition through production adapter");
    const confirmedAt = "2026-10-02T14:10:00.000Z";
    const commitResult = await confirmTransition(page, {
      proposal: freshProposal,
      transitionId: freshProposal.transitionId,
      successorProgramId: freshProposal.successor.programId,
      confirmedAt,
      proposalHash: freshProposal.proposalHash,
      acknowledgedDraftRaw: freshDraftRaw,
    });
    check(commitResult?.localOk === true && commitResult?.idbOk === true, "confirmTransition successfully commits", commitResult);
    check(commitResult?.committed === true, "confirmTransition returns committed: true");
    await page.evaluate(() => window.__repforgeStorage.flush());

    // -------------------------------------------------------------------------
    // Step 6: Reload and assert durable state, the single linked archive, the
    // log sentinel identity, and exact DraftV2 preservation in both replicas.
    // -------------------------------------------------------------------------
    console.log("\n6. Reload and assert durable successor state, archive, log identity, DraftV2");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const postLive = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
    const replicas = await readReplicas(page);

    check(postLive?.programMeta?.id === successorProgramId, "active program is the successor programId");
    check(postLive?.programMeta?.daysPerWeek === 3, "successor daysPerWeek is 3");
    check(isDeepStrictEqual(postLive?.programMeta?.programDefinition, freshProposal.successor.programDefinition),
      "successor programMeta holds exactly the proposal's successor definition");
    check(postLive?.programMeta?.mesocycleLengthWeeks === freshProposal.successor.programDefinition.cycles,
      "successor block length follows the successor definition's cycles");
    check(typeof postLive?.programMeta?.blockId === "string" && postLive.programMeta.blockId !== predecessorHead.meta?.blockId,
      "successor starts a new block identity");
    const successorSlotIds = new Set(trainingDays(postLive?.programMeta?.programDefinition).flatMap((day) => day.slots.map((slot) => slot.id)));
    check((postLive?.program || []).length === successorSlotIds.size &&
      (postLive?.program || []).every((row) => successorSlotIds.has(row.slotId || row.id)),
      "program rows are the successor definition's projection");

    const transitionIn = postLive?.programMeta?.transitionIn;
    check(isPlainObject(transitionIn), "successor programMeta carries transitionIn object");
    check(transitionIn?.status === "committed", "transitionIn status is committed");
    check(transitionIn?.confirmedAt === confirmedAt, "transitionIn confirmedAt matches the supplied value");
    check(transitionIn?.proposalHash === freshProposal.proposalHash, "transitionIn proposalHash matches proposal");
    check(transitionIn?.transitionId === transitionId, "transitionIn transitionId matches");
    check(transitionIn?.successor?.programId === successorProgramId, "transitionIn successor programId matches");
    check(transitionIn?.predecessor?.programId === predecessorProgramId, "transitionIn predecessor programId matches");
    check(transitionIn?.archiveId === predecessorProgramId, "transitionIn archiveId is the predecessor programId (deterministic, not caller-chosen)");

    const history = postLive?.programHistory || [];
    check(history.length === 1, "exactly one archive entry exists in programHistory", history.length);
    const archive = history[0];
    check(archive?.id === predecessorProgramId && archive?.archiveId === predecessorProgramId, "archive links to predecessor program");
    check(archive?.transitionOut?.schemaVersion === 1, "archive transitionOut has schemaVersion 1");
    check(archive?.transitionOut?.transitionId === transitionId, "archive transitionOut transitionId matches");
    check(archive?.transitionOut?.proposalHash === freshProposal.proposalHash, "archive transitionOut proposalHash matches");
    check(archive?.transitionOut?.successorProgramId === successorProgramId, "archive transitionOut successorProgramId matches");
    check(Array.isArray(archive?.program) && archive.program.length === predecessorHead.programLength &&
      isDeepStrictEqual(archive?.meta?.programDefinition, predecessorDefinition),
      "archive retains the predecessor program rows and its exact ProgramDefinition");

    // Both replicas agree on the semantic transition fields and revision.
    check(replicas.local.programId === successorProgramId, "localStorage replica has successor programId");
    check(replicas.idb.programId === successorProgramId, "IndexedDB replica has successor programId");
    check(replicas.local.revision === replicas.idb.revision, "localStorage and IndexedDB revisions match",
      { local: replicas.local.revision, idb: replicas.idb.revision });
    check(isDeepStrictEqual(replicas.local.transitionIn, replicas.idb.transitionIn), "transitionIn matches across replicas");
    check(isDeepStrictEqual(replicas.local.programHistory, replicas.idb.programHistory), "programHistory matches across replicas");

    // The log sentinel identity and content survive the transition in every store.
    const liveLog = postLive?.log || [];
    check(liveLog.length === 1 && liveLog[0].session === logSeed.sessionId, "live clone retains exactly the sentinel session");
    check(isDeepStrictEqual(liveLog, logSentinel), "live clone log row is byte-identical in content to the pre-transition sentinel");
    check(isDeepStrictEqual(replicas.local.log, logSentinel), "localStorage replica retains the exact log sentinel");
    check(isDeepStrictEqual(replicas.idb.log, logSentinel), "IndexedDB replica retains the exact log sentinel");
    check(liveLog[0].exerciseId === logSentinel[0].exerciseId && liveLog[0].day === logSentinel[0].day,
      "sentinel exercise / slot identity preserved");

    // Exact DraftV2 preservation.
    const postDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const postCheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(postDraftRaw === preDraftRaw, "DraftV2 raw in localStorage is byte-for-byte identical to pre-transition");
    check(postCheckpointRaw === preCheckpointRaw, "DraftV2 checkpoint raw in localStorage is byte-for-byte identical to pre-transition");

    // The draft binds catalog metrics, so it is parsed by the production
    // module in the page, where the raw exercise catalog is loaded.
    const parsedDraft = await page.evaluate((raw) => window.RepForgeWorkoutDraft.parse(raw), postDraftRaw);
    check(parsedDraft?.kind === "valid" && parsedDraft?.draft?.program?.programId === predecessorProgramId,
      "workout draft remains bound to predecessor programId", {
        kind: parsedDraft?.kind, code: parsedDraft?.code, path: parsedDraft?.path, draftProgramId: parsedDraft?.draft?.program?.programId, predecessorProgramId,
      });
    check(parsedDraft?.draft?.session?.notes === "Draft session notes before sibling transition", "draft notes preserved");

    // -------------------------------------------------------------------------
    // Step 7: Idempotent retry
    // -------------------------------------------------------------------------
    console.log("\n7. Idempotent retry returns already-committed without a second archive");
    const revisionBeforeRetry = replicas.local.revision;
    const retryResult = await confirmTransition(page, {
      proposal: freshProposal,
      transitionId: freshProposal.transitionId,
      successorProgramId: freshProposal.successor.programId,
      confirmedAt,
      proposalHash: freshProposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });
    check(retryResult?.alreadyCommitted === true, "idempotent retry reports alreadyCommitted: true", retryResult);
    check(retryResult?.committed === true, "idempotent retry reports committed: true");
    await page.evaluate(() => window.__repforgeStorage.flush());

    const afterRetry = await readReplicas(page);
    const liveAfterRetry = await page.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return { rev: s._storageRevision, historyLen: (s.programHistory || []).length, programId: s.programMeta?.id, log: s.log || [] };
    });
    check(afterRetry.local.revision === revisionBeforeRetry && afterRetry.idb.revision === revisionBeforeRetry,
      "idempotent retry did not increment the durable revision in either replica");
    check(liveAfterRetry.historyLen === 1 && afterRetry.local.historyLen === 1 && afterRetry.idb.historyLen === 1,
      "idempotent retry did not create a second archive entry");
    check(liveAfterRetry.programId === successorProgramId, "active program remains the successor after retry");
    check(isDeepStrictEqual(liveAfterRetry.log, logSentinel) &&
          isDeepStrictEqual(afterRetry.local.log, logSentinel) &&
          isDeepStrictEqual(afterRetry.idb.log, logSentinel),
      "the log sentinel identity and content survive success + reload + retry in every store");
    const retryDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    check(retryDraftRaw === preDraftRaw, "DraftV2 raw unchanged after idempotent retry");

    // -------------------------------------------------------------------------
    // Step 8: Partial archive identity — the history row's primary id still
    // matches archiveId, but its explicit archiveId link diverges. A retry must
    // never report already-committed and must mutate nothing durable.
    // (Hostile: on an OR-based identity match this reports alreadyCommitted.)
    // -------------------------------------------------------------------------
    console.log("\n8. Partial archive identity (matching id, divergent archiveId link) is never already-committed");
    const beforeStep8 = await readReplicas(page);
    const step8DraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const step8CheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);

    const inj8 = await injectArchiveIdentity(page, { archiveId: "p6a-divergent-archive-link" });
    check(inj8.ok, "divergent-archiveId injection committed through the proposed-state seam", inj8);
    const replicas8 = await readReplicas(page);
    check(replicas8.local.programHistory.length === 1 && replicas8.idb.programHistory.length === 1,
      "still exactly one archive row after the divergent-archiveId injection");
    check(replicas8.local.programHistory[0].id === predecessorProgramId &&
          replicas8.local.programHistory[0].archiveId === "p6a-divergent-archive-link" &&
          replicas8.idb.programHistory[0].id === predecessorProgramId &&
          replicas8.idb.programHistory[0].archiveId === "p6a-divergent-archive-link",
      "injection landed in both replicas: archive id preserved, archiveId link diverged",
      { local: replicas8.local.programHistory[0], idb: replicas8.idb.programHistory[0] });

    const revBeforeRetry8 = replicas8.local.revision;
    const retry8 = await confirmTransition(page, {
      proposal: freshProposal,
      transitionId: freshProposal.transitionId,
      successorProgramId: freshProposal.successor.programId,
      confirmedAt,
      proposalHash: freshProposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });
    check(retry8?.alreadyCommitted !== true, "divergent-archiveId retry does NOT report alreadyCommitted", retry8);
    check(retry8?.committed !== true, "divergent-archiveId retry is not committed", retry8);
    check(retry8?.invalid === true && retry8?.code === "conflicting_transition_record",
      "divergent-archiveId retry returns typed conflicting_transition_record", retry8);
    await page.evaluate(() => window.__repforgeStorage.flush());

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterStep8 = await readReplicas(page);
    const liveAfterStep8 = await page.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return { programId: s.programMeta?.id, historyLen: (s.programHistory || []).length };
    });
    check(afterStep8.local.revision === revBeforeRetry8 && afterStep8.idb.revision === revBeforeRetry8,
      "divergent-archiveId retry advanced no durable revision in either replica",
      { before: revBeforeRetry8, local: afterStep8.local.revision, idb: afterStep8.idb.revision });
    check(afterStep8.local.programId === successorProgramId && afterStep8.idb.programId === successorProgramId &&
          liveAfterStep8.programId === successorProgramId,
      "active successor programId unchanged by the divergent-archiveId retry");
    check(afterStep8.local.programHistory.length === 1 && afterStep8.idb.programHistory.length === 1 &&
          liveAfterStep8.historyLen === 1,
      "no second archive row created by the divergent-archiveId retry");
    check(isDeepStrictEqual(afterStep8.local.transitionIn, beforeStep8.local.transitionIn) &&
          isDeepStrictEqual(afterStep8.idb.transitionIn, beforeStep8.idb.transitionIn),
      "transitionIn record unchanged by the divergent-archiveId retry");
    check(isDeepStrictEqual(afterStep8.local.log, logSentinel) && isDeepStrictEqual(afterStep8.idb.log, logSentinel),
      "log sentinel intact after the divergent-archiveId retry");
    check(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY) === step8DraftRaw,
      "DraftV2 raw byte-identical after the divergent-archiveId retry");
    check(await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY) === step8CheckpointRaw,
      "DraftV2 checkpoint byte-identical after the divergent-archiveId retry");

    // -------------------------------------------------------------------------
    // Step 9: Partial archive identity — the history row's archiveId link is
    // restored to archiveId, but its primary id diverges. Same guarantee.
    // (Hostile: on an OR-based identity match this reports alreadyCommitted.)
    // -------------------------------------------------------------------------
    console.log("\n9. Partial archive identity (matching archiveId link, divergent id) is never already-committed");
    const beforeStep9 = await readReplicas(page);
    const step9DraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const step9CheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);

    const inj9 = await injectArchiveIdentity(page, { id: "p6a-divergent-history-id", archiveId: predecessorProgramId });
    check(inj9.ok, "divergent-id injection committed through the proposed-state seam", inj9);
    const replicas9 = await readReplicas(page);
    check(replicas9.local.programHistory[0].archiveId === predecessorProgramId &&
          replicas9.local.programHistory[0].id === "p6a-divergent-history-id" &&
          replicas9.idb.programHistory[0].archiveId === predecessorProgramId &&
          replicas9.idb.programHistory[0].id === "p6a-divergent-history-id",
      "injection landed in both replicas: archiveId link restored, archive id diverged",
      { local: replicas9.local.programHistory[0], idb: replicas9.idb.programHistory[0] });

    const revBeforeRetry9 = replicas9.local.revision;
    const retry9 = await confirmTransition(page, {
      proposal: freshProposal,
      transitionId: freshProposal.transitionId,
      successorProgramId: freshProposal.successor.programId,
      confirmedAt,
      proposalHash: freshProposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });
    check(retry9?.alreadyCommitted !== true, "divergent-id retry does NOT report alreadyCommitted", retry9);
    check(retry9?.committed !== true, "divergent-id retry is not committed", retry9);
    check(retry9?.invalid === true && retry9?.code === "conflicting_transition_record",
      "divergent-id retry returns typed conflicting_transition_record", retry9);
    await page.evaluate(() => window.__repforgeStorage.flush());

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterStep9 = await readReplicas(page);
    check(afterStep9.local.revision === revBeforeRetry9 && afterStep9.idb.revision === revBeforeRetry9,
      "divergent-id retry advanced no durable revision in either replica");
    check(afterStep9.local.programId === successorProgramId && afterStep9.idb.programId === successorProgramId,
      "active successor programId unchanged by the divergent-id retry");
    check(afterStep9.local.programHistory.length === 1 && afterStep9.idb.programHistory.length === 1,
      "no second archive row created by the divergent-id retry");
    check(isDeepStrictEqual(afterStep9.local.transitionIn, beforeStep9.local.transitionIn) &&
          isDeepStrictEqual(afterStep9.idb.transitionIn, beforeStep9.idb.transitionIn),
      "transitionIn record unchanged by the divergent-id retry");
    check(isDeepStrictEqual(afterStep9.local.log, logSentinel) && isDeepStrictEqual(afterStep9.idb.log, logSentinel),
      "log sentinel intact after the divergent-id retry");
    check(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY) === step9DraftRaw,
      "DraftV2 raw byte-identical after the divergent-id retry");
    check(await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY) === step9CheckpointRaw,
      "DraftV2 checkpoint byte-identical after the divergent-id retry");

    // -------------------------------------------------------------------------
    // Step 10: Occupied intended archive identity with NO transition-in must be
    // a conflict, not a clean "absent" slot. Confirmation must reject before any
    // durable mutation — no successor, no revision bump, no linked archive, no
    // DraftV2 change — in an isolated fresh context.
    // (Hostile: an "absent" classification lets archiveCapturedProgram skip the
    //  linked archive and still commit a mixed successor with no transition-out.)
    // -------------------------------------------------------------------------
    console.log("\n10. Occupied archive identity without transition-in is rejected before any durable mutation");
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    page2.on("dialog", (d) => d.dismiss().catch(() => {}));
    await page2.goto(BASE);
    await waitForAppBoot(page2, { base: BASE });
    await clearStorage(page2);
    await page2.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page2, { base: BASE });

    const act2 = await activateGeneratedPredecessor(page2);
    check(act2.ok, "isolated predecessor generated and activated", act2.issues || act2.error);
    if (!act2.ok) throw new Error(`Step 10 activation failed: ${JSON.stringify(act2)}`);
    await page2.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page2, { base: BASE });

    const pred2Id = await page2.evaluate(() => window.__repforgeWorkoutDraft.state()?.programMeta?.id);
    check(typeof pred2Id === "string" && pred2Id.length > 0, "isolated predecessor has a durable program id");

    const draft2 = await populateDraft(page2, { value: "9", notes: "Draft before occupied-archive rejection", complete: false });
    check(typeof draft2.raw === "string" && draft2.raw.length > 0, "isolated DraftV2 populated");

    // Inject a bare archive row that occupies the intended archive identity
    // (id === predecessor program id) with NO transition-in on programMeta.
    const occ = await page2.evaluate(async (predId) => {
      const s = window.__repforgeWorkoutDraft.state();
      s.programHistory = [{ id: predId, meta: {}, program: [], completedAt: "2026-01-01T00:00:00.000Z", review: null }];
      const r = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: r.localOk || r.idbOk, r };
    }, pred2Id);
    check(occ.ok, "bare occupying archive row committed", occ.r);
    await page2.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page2, { base: BASE });

    const preConfirm2 = await page2.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return {
        transitionIn: s.programMeta?.transitionIn ?? null,
        historyLen: (s.programHistory || []).length,
        row0: (s.programHistory || []).map(h => ({ id: h.id, archiveId: h.archiveId ?? null, hasOut: !!h.transitionOut }))[0] ?? null,
      };
    });
    check(preConfirm2.transitionIn == null, "isolated predecessor has no transition-in before confirm");
    check(preConfirm2.historyLen === 1 && preConfirm2.row0?.id === pred2Id && preConfirm2.row0?.hasOut === false,
      "the occupying archive row is present with no transition-out link", preConfirm2.row0);

    const propose2 = await proposeChange(page2, FEWER_DAYS);
    check(propose2?.ok === true, "isolated fewer-days proposal succeeds", propose2?.code);
    if (!propose2?.ok) throw new Error(`Step 10 proposal failed: ${JSON.stringify(propose2)}`);
    const proposal2 = propose2.proposal;
    check(proposal2.predecessor.programId === pred2Id, "isolated proposal predecessor is the occupied program id");

    const draft2Raw = await page2.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const draft2Checkpoint = await page2.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    const before2 = await readReplicas(page2);

    const occResult = await page2.evaluate(async (a) => window.__repforgeProgramTransition.confirmTransition(a), {
      proposal: proposal2,
      transitionId: proposal2.transitionId,
      successorProgramId: proposal2.successor.programId,
      confirmedAt: "2026-10-02T15:00:00.000Z",
      proposalHash: proposal2.proposalHash,
      acknowledgedDraftRaw: draft2Raw,
    });
    check(occResult?.committed !== true, "occupied-archive confirm is NOT committed", occResult);
    check(occResult?.localOk === false && occResult?.idbOk === false, "occupied-archive confirm wrote neither replica", occResult);
    check(occResult?.invalid === true && occResult?.code === "conflicting_transition_record",
      "occupied-archive confirm returns typed conflicting_transition_record", occResult);
    await page2.evaluate(() => window.__repforgeStorage.flush());

    await page2.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page2, { base: BASE });
    const after2 = await readReplicas(page2);
    const liveAfter2 = await page2.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return {
        programId: s.programMeta?.id, daysPerWeek: s.programMeta?.daysPerWeek,
        transitionIn: s.programMeta?.transitionIn ?? null, historyLen: (s.programHistory || []).length,
      };
    });
    check(liveAfter2.programId === pred2Id && after2.local.programId === pred2Id && after2.idb.programId === pred2Id,
      "no successor was produced: active program is still the predecessor in both replicas", liveAfter2);
    check(liveAfter2.daysPerWeek === 4, "predecessor schedule unchanged (still 4 days)");
    check(after2.local.revision === before2.local.revision && after2.idb.revision === before2.idb.revision,
      "occupied-archive rejection advanced no durable revision in either replica",
      { before: before2.local.revision, local: after2.local.revision, idb: after2.idb.revision });
    check(after2.local.programHistory.length === 1 && after2.idb.programHistory.length === 1 && liveAfter2.historyLen === 1,
      "no linked archive was added: history still holds exactly the bare occupying row");
    check(after2.local.programHistory[0].transitionOut == null && after2.idb.programHistory[0].transitionOut == null,
      "the occupying archive row gained no transition-out link");
    check(liveAfter2.transitionIn == null && after2.local.transitionIn == null && after2.idb.transitionIn == null,
      "no transition-in record was written to either replica");
    const draft2RawAfter = await page2.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const draft2CheckpointAfter = await page2.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(draft2RawAfter === draft2Raw && draft2CheckpointAfter === draft2Checkpoint,
      "DraftV2 raw and checkpoint byte-identical after the occupied-archive rejection");

    await ctx2.close();

    // -------------------------------------------------------------------------
    // Step 11: Exact duplicate race — two tabs concurrently confirm identical
    // proposal under repforge:state-write. Exactly one performs the write; the
    // second returns ok:true, committed:true, alreadyCommitted:true.
    // -------------------------------------------------------------------------
    console.log("\n11. Exact duplicate race converges as alreadyCommitted");
    const raceCtx1 = await browser.newContext();
    const pageA = await raceCtx1.newPage();
    const pageB = await raceCtx1.newPage();
    const locker1 = await raceCtx1.newPage();
    for (const p of [pageA, pageB, locker1]) {
      p.on("dialog", (d) => d.dismiss().catch(() => {}));
      await p.goto(BASE);
      await waitForAppBoot(p, { base: BASE });
    }
    await clearStorage(pageA);
    for (const p of [pageA, pageB, locker1]) {
      await p.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(p, { base: BASE });
    }

    const env1 = await setupPredecessorWithSentinelAndDraft(pageA, "race1");
    const propRes1 = await proposeChange(pageA, FEWER_DAYS, {
      transitionId: "tr_p6b_dup_race",
      successorProgramId: "prog_p6b_dup_succ",
      createdAt: "2026-10-02T14:00:00.000Z",
    });
    check(propRes1?.ok === true, "proposal for exact duplicate race created", propRes1?.code);
    const proposal1 = propRes1.proposal;

    for (const p of [pageB, locker1]) {
      await p.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(p, { base: BASE });
    }

    const confirmArgs1 = {
      proposal: proposal1,
      transitionId: proposal1.transitionId,
      successorProgramId: proposal1.successor.programId,
      confirmedAt: "2026-10-02T14:10:00.000Z",
      proposalHash: proposal1.proposalHash,
      acknowledgedDraftRaw: env1.preDraftRaw,
    };

    await holdStorageLock(locker1);
    await pageA.evaluate((args) => {
      window.__raceConfirmResult = window.__repforgeProgramTransition.confirmTransition(args);
    }, confirmArgs1);
    await waitForPendingStorageLocks(locker1, 1);

    await pageB.evaluate((args) => {
      window.__raceConfirmResult = window.__repforgeProgramTransition.confirmTransition(args);
    }, confirmArgs1);
    await waitForPendingStorageLocks(locker1, 2);

    await releaseStorageLock(locker1);

    const resA = await pageA.evaluate(() => window.__raceConfirmResult);
    const resB = await pageB.evaluate(() => window.__raceConfirmResult);

    const aIdem1 = resA?.alreadyCommitted === true;
    const bIdem1 = resB?.alreadyCommitted === true;
    check(aIdem1 !== bIdem1,
      "exactly one duplicate-race result reports alreadyCommitted: true and exactly one does not",
      { aAlready: resA?.alreadyCommitted, bAlready: resB?.alreadyCommitted });

    const writer1 = aIdem1 ? resB : resA;
    const follower1 = aIdem1 ? resA : resB;

    check(writer1?.ok === true && writer1?.committed === true && writer1?.localOk === true && writer1?.idbOk === true,
      "writer tab committed successfully under lock", writer1);
    check(follower1?.ok === true && follower1?.committed === true && follower1?.alreadyCommitted === true,
      "follower tab converged as alreadyCommitted: true under lock", follower1);

    const replicas1 = await readReplicas(pageA);
    check(replicas1.local.programId === proposal1.successor.programId && replicas1.idb.programId === proposal1.successor.programId,
      "both replicas hold successor programId after exact duplicate race");
    check(replicas1.local.revision === env1.predecessorRevision + 1 && replicas1.idb.revision === env1.predecessorRevision + 1,
      "revision advanced by exactly 1 to R+1 in both replicas after exact duplicate race",
      { expected: env1.predecessorRevision + 1, local: replicas1.local.revision, idb: replicas1.idb.revision });
    check(replicas1.local.historyLen === 1 && replicas1.idb.historyLen === 1,
      "exactly one archive entry exists in both replicas after exact duplicate race");

    check(replicas1.local.transitionIn?.status === "committed" &&
          replicas1.local.transitionIn?.transitionId === proposal1.transitionId &&
          replicas1.local.transitionIn?.proposalHash === proposal1.proposalHash &&
          replicas1.local.transitionIn?.archiveId === proposal1.predecessor.programId,
      "successor transitionIn identity exact after duplicate race");
    check(replicas1.local.programHistory[0]?.id === proposal1.predecessor.programId &&
          replicas1.local.programHistory[0]?.archiveId === proposal1.predecessor.programId &&
          replicas1.local.programHistory[0]?.transitionOut?.transitionId === proposal1.transitionId &&
          replicas1.local.programHistory[0]?.transitionOut?.proposalHash === proposal1.proposalHash &&
          replicas1.local.programHistory[0]?.transitionOut?.successorProgramId === proposal1.successor.programId,
      "archive transitionOut identity and links exact after duplicate race");

    check(isDeepStrictEqual(replicas1.local.log, env1.logSentinel) && isDeepStrictEqual(replicas1.idb.log, env1.logSentinel),
      "log sentinel survives exact duplicate race in both replicas");

    check(isDeepStrictEqual(replicas1.local.transitionIn, replicas1.idb.transitionIn),
      "transitionIn deep-equal across replicas after exact duplicate race");
    check(isDeepStrictEqual(replicas1.local.programHistory, replicas1.idb.programHistory),
      "programHistory deep-equal across replicas after exact duplicate race");
    check(replicas1.local.storageDraftTransaction == null && replicas1.idb.storageDraftTransaction == null,
      "no _storageDraftTransaction marker in either parsed replica after exact duplicate race",
      { local: replicas1.local.storageDraftTransaction, idb: replicas1.idb.storageDraftTransaction });

    const postDraftRaw1 = await pageA.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const postCheckpointRaw1 = await pageA.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(postDraftRaw1 === env1.preDraftRaw, "DraftV2 raw byte-identical after exact duplicate race");
    check(postCheckpointRaw1 === env1.preCheckpointRaw, "DraftV2 checkpoint byte-identical after exact duplicate race");

    const lingering1 = await pageA.evaluate(() => Object.keys(localStorage).filter((k) =>
      k.startsWith("repforge_pending_v1") || k.startsWith("repforge_draft_v1:closing") ||
      k.startsWith("repforge_draft_v1:pending")
    ));
    check(lingering1.length === 0, "zero pending journal, DraftV2 sidecar, or closing artifacts after duplicate race", lingering1);

    await raceCtx1.close();

    // -------------------------------------------------------------------------
    // Step 12: Competing proposal race — two valid proposals share predecessor
    // but differ in transition/successor identity (frequency vs session length).
    // First waiter commits; second waiter returns typed non-commit outcome.
    // -------------------------------------------------------------------------
    console.log("\n12. Competing proposal race (first commits, second returns typed non-commit)");
    const raceCtx2 = await browser.newContext();
    const pageA2 = await raceCtx2.newPage();
    const pageB2 = await raceCtx2.newPage();
    const locker2 = await raceCtx2.newPage();
    for (const p of [pageA2, pageB2, locker2]) {
      p.on("dialog", (d) => d.dismiss().catch(() => {}));
      await p.goto(BASE);
      await waitForAppBoot(p, { base: BASE });
    }
    await clearStorage(pageA2);
    for (const p of [pageA2, pageB2, locker2]) {
      await p.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(p, { base: BASE });
    }

    const env2 = await setupPredecessorWithSentinelAndDraft(pageA2, "race2");

    const propResA2 = await proposeChange(pageA2, FEWER_DAYS, {
      transitionId: "tr_p6b_compete_freq",
      successorProgramId: "prog_p6b_compete_freq",
      createdAt: "2026-10-02T14:00:00.000Z",
    });
    check(propResA2?.ok === true, "competing proposal A (fewer_days) created", propResA2?.code);
    const proposalA2 = propResA2.proposal;

    const propResB2 = await proposeChange(pageA2, SHORTER_SESSIONS, {
      transitionId: "tr_p6b_compete_time",
      successorProgramId: "prog_p6b_compete_time",
      createdAt: "2026-10-02T14:00:00.000Z",
    });
    check(propResB2?.ok === true, "competing proposal B (shorter_sessions) created", propResB2?.code);
    const proposalB2 = propResB2.proposal;

    check(proposalA2.predecessor.programId === env2.predecessorProgramId && proposalB2.predecessor.programId === env2.predecessorProgramId,
      "both competing proposals pin the predecessor programId");
    check(proposalA2.predecessor.durableRevision === env2.predecessorRevision && proposalB2.predecessor.durableRevision === env2.predecessorRevision,
      "both competing proposals pin the predecessor durableRevision");
    check(proposalA2.transitionId !== proposalB2.transitionId && proposalA2.successor.programId !== proposalB2.successor.programId,
      "competing proposals have distinct transition and successor identities");

    for (const p of [pageB2, locker2]) {
      await p.reload({ waitUntil: "domcontentloaded" });
      await waitForAppBoot(p, { base: BASE });
    }

    const confirmArgsA2 = {
      proposal: proposalA2,
      transitionId: proposalA2.transitionId,
      successorProgramId: proposalA2.successor.programId,
      confirmedAt: "2026-10-02T14:10:00.000Z",
      proposalHash: proposalA2.proposalHash,
      acknowledgedDraftRaw: env2.preDraftRaw,
    };
    const confirmArgsB2 = {
      proposal: proposalB2,
      transitionId: proposalB2.transitionId,
      successorProgramId: proposalB2.successor.programId,
      confirmedAt: "2026-10-02T14:10:00.000Z",
      proposalHash: proposalB2.proposalHash,
      acknowledgedDraftRaw: env2.preDraftRaw,
    };

    await holdStorageLock(locker2);
    await pageA2.evaluate((args) => {
      window.__raceConfirmResult = window.__repforgeProgramTransition.confirmTransition(args);
    }, confirmArgsA2);
    await waitForPendingStorageLocks(locker2, 1);

    await pageB2.evaluate((args) => {
      window.__raceConfirmResult = window.__repforgeProgramTransition.confirmTransition(args);
    }, confirmArgsB2);
    await waitForPendingStorageLocks(locker2, 2);

    await releaseStorageLock(locker2);

    const resA2 = await pageA2.evaluate(() => window.__raceConfirmResult);
    const resB2 = await pageB2.evaluate(() => window.__raceConfirmResult);

    check(resA2?.ok === true && resA2?.committed === true && resA2?.localOk === true && resA2?.idbOk === true,
      "first waiter (Tab A) commits successfully under lock", resA2);
    check(resB2?.ok === false && resB2?.committed === false,
      "second waiter (Tab B) is rejected and not committed", resB2);
    check(resB2?.localOk === false && resB2?.idbOk === false,
      "second waiter wrote neither replica", resB2);
    const isB2Typed = resB2?.duplicate === true || resB2?.conflict === true || resB2?.stale === true || resB2?.invalid === true;
    check(isB2Typed, "second waiter returns a typed outcome from closed vocabulary", resB2);

    const replicas2 = await readReplicas(pageA2);
    check(replicas2.local.programId === proposalA2.successor.programId && replicas2.idb.programId === proposalA2.successor.programId,
      "winner successor retained in both replicas");
    check(replicas2.local.revision === env2.predecessorRevision + 1 && replicas2.idb.revision === env2.predecessorRevision + 1,
      "revision advanced by exactly 1 to R+1 in both replicas after competing race",
      { expected: env2.predecessorRevision + 1, local: replicas2.local.revision, idb: replicas2.idb.revision });
    check(replicas2.local.historyLen === 1 && replicas2.idb.historyLen === 1,
      "exactly one archive entry exists in both replicas after competing race");
    check(isDeepStrictEqual(replicas2.local.log, env2.logSentinel) && isDeepStrictEqual(replicas2.idb.log, env2.logSentinel),
      "log sentinel survives competing race in both replicas");

    check(isDeepStrictEqual(replicas2.local.transitionIn, replicas2.idb.transitionIn),
      "transitionIn deep-equal across replicas after competing race");
    check(isDeepStrictEqual(replicas2.local.programHistory, replicas2.idb.programHistory),
      "programHistory deep-equal across replicas after competing race");
    check(replicas2.local.storageDraftTransaction == null && replicas2.idb.storageDraftTransaction == null,
      "no _storageDraftTransaction marker in either parsed replica after competing race",
      { local: replicas2.local.storageDraftTransaction, idb: replicas2.idb.storageDraftTransaction });

    const postDraftRaw2 = await pageA2.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const postCheckpointRaw2 = await pageA2.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(postDraftRaw2 === env2.preDraftRaw, "DraftV2 raw byte-identical after competing race");
    check(postCheckpointRaw2 === env2.preCheckpointRaw, "DraftV2 checkpoint byte-identical after competing race");

    const lingering2 = await pageA2.evaluate(() => Object.keys(localStorage).filter((k) =>
      k.startsWith("repforge_pending_v1") || k.startsWith("repforge_draft_v1:closing") ||
      k.startsWith("repforge_draft_v1:pending")
    ));
    check(lingering2.length === 0, "zero pending journal, DraftV2 sidecar, or closing artifacts after competing race", lingering2);

    await raceCtx2.close();

    // -------------------------------------------------------------------------
    // Step 13: Fingerprint pin — fresh fixture, inject predecessor program
    // fingerprint mismatch while proposal ID/revision remain pinned. Real
    // lock-held reread yields typed non-commit, zero archive/successor in both.
    // -------------------------------------------------------------------------
    console.log("\n13. Fingerprint pin rejection (zero archive/successor in both replicas)");
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    page3.on("dialog", (d) => d.dismiss().catch(() => {}));
    await page3.goto(BASE);
    await waitForAppBoot(page3, { base: BASE });
    await clearStorage(page3);
    await page3.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page3, { base: BASE });

    const env3 = await setupPredecessorWithSentinelAndDraft(page3, "fp3");
    const propRes3 = await proposeChange(page3, FEWER_DAYS, {
      transitionId: "tr_p6b_fp_pin",
      successorProgramId: "prog_p6b_fp_succ",
      createdAt: "2026-10-02T14:00:00.000Z",
    });
    check(propRes3?.ok === true, "proposal for fingerprint pin created", propRes3?.code);
    const proposal3 = propRes3.proposal;
    const predId3 = proposal3.predecessor.programId;
    const predRev3 = proposal3.predecessor.durableRevision;

    // Inject a predecessor definition mismatch into both replicas while keeping
    // the proposal's program ID and durableRevision pinned: the stored
    // definition is no longer the one the proposal fingerprinted.
    const injFp = await page3.evaluate(async ({ key, predId, predRev, dbName }) => {
      const raw = localStorage.getItem(key);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.programMeta?.id !== predId) return { ok: false, error: "pred mismatch" };
      if (!parsed.programMeta?.programDefinition) return { ok: false, error: "no stored definition" };
      parsed.programMeta.programDefinition.seed = `${parsed.programMeta.programDefinition.seed}-injected-mismatch`;
      parsed._storageRevision = predRev;
      parsed.programMeta.id = predId;
      localStorage.setItem(key, JSON.stringify(parsed));
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("kv", "readwrite");
          const store = tx.objectStore("kv");
          store.put(parsed, key);
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => { db.close(); reject(tx.error); };
        };
        req.onerror = () => reject(req.error);
      });
      return { ok: true };
    }, { key: KEY, predId: predId3, predRev: predRev3, dbName: DB_NAME });
    check(injFp.ok, "fingerprint mismatch injected into both replicas");

    await page3.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page3, { base: BASE });

    const rereadBefore3 = await readReplicas(page3);
    check(rereadBefore3.local.programId === predId3 && rereadBefore3.idb.programId === predId3,
      "predecessor ID remains pinned after reload before confirm");
    check(rereadBefore3.local.revision === predRev3 && rereadBefore3.idb.revision === predRev3,
      "predecessor revision remains pinned after reload before confirm");

    const confirmArgs3 = {
      proposal: proposal3,
      transitionId: proposal3.transitionId,
      successorProgramId: proposal3.successor.programId,
      confirmedAt: "2026-10-02T14:10:00.000Z",
      proposalHash: proposal3.proposalHash,
      acknowledgedDraftRaw: env3.preDraftRaw,
    };
    const fpResult = await confirmTransition(page3, confirmArgs3);
    check(fpResult?.ok === false && fpResult?.committed === false,
      "fingerprint mismatch rejected without commit", fpResult);
    check(fpResult?.localOk === false && fpResult?.idbOk === false,
      "fingerprint mismatch wrote neither replica", fpResult);
    check(fpResult?.stale === true && fpResult?.code === "predecessor_definition_changed",
      "definition fingerprint mismatch returns typed stale predecessor_definition_changed", fpResult);

    await page3.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page3, { base: BASE });

    const after3 = await readReplicas(page3);
    check(after3.local.programId === predId3 && after3.idb.programId === predId3,
      "active program is still the predecessor in both replicas");
    check(after3.local.revision === predRev3 && after3.idb.revision === predRev3,
      "revision unchanged in both replicas after fingerprint mismatch rejection",
      { expected: predRev3, local: after3.local.revision, idb: after3.idb.revision });
    check(after3.local.historyLen === 0 && after3.idb.historyLen === 0,
      "zero archive created in either replica after fingerprint mismatch rejection");
    check(after3.local.transitionIn == null && after3.idb.transitionIn == null,
      "zero transitionIn created in either replica after fingerprint mismatch rejection");
    check(after3.local.storageDraftTransaction == null && after3.idb.storageDraftTransaction == null,
      "no _storageDraftTransaction marker in either parsed replica after fingerprint mismatch rejection",
      { local: after3.local.storageDraftTransaction, idb: after3.idb.storageDraftTransaction });
    check(isDeepStrictEqual(after3.local.log, env3.logSentinel) && isDeepStrictEqual(after3.idb.log, env3.logSentinel),
      "log sentinel intact in both replicas after fingerprint mismatch rejection");

    const lingering3 = await page3.evaluate(() => Object.keys(localStorage).filter((k) =>
      k.startsWith("repforge_pending_v1") || k.startsWith("repforge_draft_v1:closing") ||
      k.startsWith("repforge_draft_v1:pending")
    ));
    check(lingering3.length === 0, "zero pending journal, DraftV2 sidecar, or closing persistence artifacts after fingerprint mismatch rejection", lingering3);

    const draft3RawAfter = await page3.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const draft3CheckpointAfter = await page3.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(draft3RawAfter === env3.preDraftRaw && draft3CheckpointAfter === env3.preCheckpointRaw,
      "DraftV2 raw and checkpoint byte-identical after fingerprint mismatch rejection");

    await ctx3.close();

    // -------------------------------------------------------------------------
    // Step 14: Chained transition A -> B -> C and idempotent retry under lock
    // Real compiler pair, complete proposal mapping, verifies exact two
    // revisions, two archives, both links, no identity loss, negative archive
    // collision at B's identity, and duplicate B->C retry as alreadyCommitted.
    // -------------------------------------------------------------------------
    console.log("\n14. Chained transition A -> B -> C and idempotent retry");
    const ctx14 = await browser.newContext();
    const page14 = await ctx14.newPage();
    page14.on("dialog", (d) => d.dismiss().catch(() => {}));
    await page14.goto(BASE);
    await waitForAppBoot(page14, { base: BASE });
    await clearStorage(page14);
    await page14.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page14, { base: BASE });

    const env14 = await setupPredecessorWithSentinelAndDraft(page14, "chain14");
    const predAId = env14.predecessorProgramId;
    const revA = env14.predecessorRevision;

    // Transition 1: A -> B (lower frequency: 4 -> 3)
    const propResAB = await proposeChange(page14, FEWER_DAYS, {
      transitionId: "tr_p6c_chain_ab",
      successorProgramId: "prog_p6c_chain_b",
      createdAt: "2026-10-03T10:00:00.000Z",
    });
    check(propResAB?.ok === true, "proposal A->B created", propResAB?.code);
    const proposalAB = propResAB.proposal;

    const confirmArgsAB = {
      proposal: proposalAB,
      transitionId: proposalAB.transitionId,
      successorProgramId: proposalAB.successor.programId,
      confirmedAt: "2026-10-03T10:10:00.000Z",
      proposalHash: proposalAB.proposalHash,
      acknowledgedDraftRaw: env14.preDraftRaw,
    };
    const confirmAB = await confirmTransition(page14, confirmArgsAB);
    check(confirmAB?.ok === true && confirmAB?.committed === true && confirmAB?.localOk === true && confirmAB?.idbOk === true,
      "transition A->B committed successfully", confirmAB);

    await page14.evaluate(() => window.__repforgeStorage.flush());
    await page14.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page14, { base: BASE });

    const replicasB = await readReplicas(page14);
    check(replicasB.local.programId === "prog_p6c_chain_b" && replicasB.idb.programId === "prog_p6c_chain_b",
      "both replicas hold program B after A->B");
    check(replicasB.local.revision === revA + 1 && replicasB.idb.revision === revA + 1,
      "revision advanced by 1 to R+1 after A->B");
    check(replicasB.local.historyLen === 1 && replicasB.idb.historyLen === 1,
      "exactly 1 archive entry exists after A->B");

    // Negative collision at B's new archive identity:
    // If an occupant exists for B's archive identity, confirmTransition must fail typed
    // conflicting_transition_record before committing any mutation.
    const collRes = await page14.evaluate(async (preDraftRaw) => {
      const s = window.__repforgeWorkoutDraft.state();
      const origHist = s.programHistory || [];
      s.programHistory = [...origHist, {
        id: "prog_p6c_chain_b",
        archiveId: "prog_p6c_chain_b",
      }];
      await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();

      // Propose B->C on this state
      const pRes = await window.__repforgeProgramTransition.proposeChange({
        change: { kind: "shorter_sessions", sessionMinutes: 60 },
        transitionId: "tr_p6c_chain_coll",
        successorProgramId: "prog_p6c_chain_c_coll",
        createdAt: "2026-10-03T11:00:00.000Z",
      });
      const res = await window.__repforgeProgramTransition.confirmTransition({
        proposal: pRes.proposal,
        transitionId: pRes.proposal.transitionId,
        successorProgramId: pRes.proposal.successor.programId,
        confirmedAt: "2026-10-03T11:10:00.000Z",
        proposalHash: pRes.proposal.proposalHash,
        acknowledgedDraftRaw: preDraftRaw,
      });

      // Restore clean history on B
      s.programHistory = origHist;
      await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return res;
    }, env14.preDraftRaw);

    check(collRes?.ok === false && collRes?.committed === false,
      "negative collision at B archive identity rejected without commit", collRes);
    check(collRes?.invalid === true && collRes?.code === "conflicting_transition_record",
      "negative collision at B archive identity returns typed conflicting_transition_record", collRes);

    await page14.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page14, { base: BASE });

    // Valid Transition 2 Proposal: B -> C (shorter session: 90 -> 60)
    const curReplicasB = await readReplicas(page14);
    const revB = curReplicasB.local.revision;

    const propResBC = await proposeChange(page14, SHORTER_SESSIONS, {
      transitionId: "tr_p6c_chain_bc",
      successorProgramId: "prog_p6c_chain_c",
      createdAt: "2026-10-03T11:00:00.000Z",
    });
    check(propResBC?.ok === true, "proposal B->C (shorter sessions) derived from B's stored definition", propResBC?.code);
    const proposalBC = propResBC.proposal;
    check(proposalBC.predecessor.programId === "prog_p6c_chain_b",
      "proposal B->C correctly identifies B as predecessor");
    check(proposalBC.predecessor.durableRevision === revB,
      "proposal B->C pins predecessor revision R+1");

    const confirmArgsBC = {
      proposal: proposalBC,
      transitionId: proposalBC.transitionId,
      successorProgramId: proposalBC.successor.programId,
      confirmedAt: "2026-10-03T11:10:00.000Z",
      proposalHash: proposalBC.proposalHash,
      acknowledgedDraftRaw: env14.preDraftRaw,
    };

    // Valid confirm B -> C
    const confirmBC = await confirmTransition(page14, confirmArgsBC);
    check(confirmBC?.ok === true && confirmBC?.committed === true && confirmBC?.localOk === true && confirmBC?.idbOk === true,
      "chained transition B->C committed successfully", confirmBC);

    await page14.evaluate(() => window.__repforgeStorage.flush());
    await page14.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page14, { base: BASE });

    // Assert durable state after B -> C
    const replicasC = await readReplicas(page14);
    check(replicasC.local.programId === "prog_p6c_chain_c" && replicasC.idb.programId === "prog_p6c_chain_c",
      "both replicas hold successor C after B->C");
    check(replicasC.local.revision === revB + 1 && replicasC.idb.revision === revB + 1,
      "revision advanced exactly twice to R+2 in both replicas after chained transitions",
      { expected: revB + 1, local: replicasC.local.revision, idb: replicasC.idb.revision });
    check(replicasC.local.historyLen === 2 && replicasC.idb.historyLen === 2,
      "exactly two archive entries exist in both replicas after B->C");
    check(trainingDays(replicasC.local.programDefinition).length === 3 &&
      replicasC.local.programDefinition?.request?.timeCeilingMinutes === 60 &&
      isDeepStrictEqual(replicasC.local.programDefinition, proposalBC.successor.programDefinition) &&
      isDeepStrictEqual(replicasC.idb.programDefinition, proposalBC.successor.programDefinition),
      "C keeps B's three days under a 60-minute ceiling in both replicas");

    // Successor C transitionIn identity and links
    check(replicasC.local.transitionIn?.status === "committed" &&
          replicasC.local.transitionIn?.transitionId === proposalBC.transitionId &&
          replicasC.local.transitionIn?.proposalHash === proposalBC.proposalHash &&
          replicasC.local.transitionIn?.archiveId === "prog_p6c_chain_b" &&
          replicasC.local.transitionIn?.successor?.programId === "prog_p6c_chain_c" &&
          replicasC.local.transitionIn?.predecessor?.programId === "prog_p6c_chain_b",
      "successor C transitionIn identity and links exact");

    // Find archive B and archive A
    const histLocal = replicasC.local.programHistory || [];
    const arcB = histLocal.find((h) => h?.id === "prog_p6c_chain_b");
    const arcA = histLocal.find((h) => h?.id === predAId);

    check(arcB != null && arcB.archiveId === "prog_p6c_chain_b" &&
          arcB.transitionOut?.transitionId === proposalBC.transitionId &&
          arcB.transitionOut?.proposalHash === proposalBC.proposalHash &&
          arcB.transitionOut?.successorProgramId === "prog_p6c_chain_c",
      "archive B carries exact B->C transitionOut link and matching archiveId");
    check(arcB?.meta?.transitionIn?.transitionId === proposalAB.transitionId &&
          arcB?.meta?.transitionIn?.archiveId === predAId,
      "archive B retains inherited A->B transitionIn provenance value-identically");

    check(arcA != null && arcA.archiveId === predAId &&
          arcA.transitionOut?.transitionId === proposalAB.transitionId &&
          arcA.transitionOut?.proposalHash === proposalAB.proposalHash &&
          arcA.transitionOut?.successorProgramId === "prog_p6c_chain_b",
      "archive A carries exact A->B transitionOut link and matching archiveId");

    check(isDeepStrictEqual(replicasC.local.transitionIn, replicasC.idb.transitionIn),
      "transitionIn deep-equal across replicas after chained B->C");
    check(isDeepStrictEqual(replicasC.local.programHistory, replicasC.idb.programHistory),
      "programHistory deep-equal across replicas after chained B->C");
    check(replicasC.local.storageDraftTransaction == null && replicasC.idb.storageDraftTransaction == null,
      "no _storageDraftTransaction marker in either replica after chained B->C");

    // Live clone agrees
    const liveC = await page14.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return {
        programId: s.programMeta?.id,
        historyLen: (s.programHistory || []).length,
        tin: s.programMeta?.transitionIn,
      };
    });
    check(liveC.programId === "prog_p6c_chain_c" && liveC.historyLen === 2 &&
          liveC.tin?.transitionId === proposalBC.transitionId,
      "live clone agrees with durable state on programId, history length, and transitionIn");

    // Log and DraftV2 preserved
    check(isDeepStrictEqual(replicasC.local.log, env14.logSentinel) &&
          isDeepStrictEqual(replicasC.idb.log, env14.logSentinel),
      "log sentinel intact in both replicas after chained B->C");
    const postDraftRaw14 = await page14.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const postCheckpointRaw14 = await page14.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(postDraftRaw14 === env14.preDraftRaw && postCheckpointRaw14 === env14.preCheckpointRaw,
      "DraftV2 raw and checkpoint byte-identical after chained B->C");

    // Zero lingering persistence artifacts
    const lingering14 = await page14.evaluate(() => Object.keys(localStorage).filter((k) =>
      k.startsWith("repforge_pending_v1") || k.startsWith("repforge_draft_v1:closing") ||
      k.startsWith("repforge_draft_v1:pending")
    ));
    check(lingering14.length === 0, "zero pending journal, DraftV2 sidecar, or closing artifacts after chained B->C", lingering14);

    // Idempotent duplicate retry of B->C
    const retryBC = await confirmTransition(page14, confirmArgsBC);
    check(retryBC?.ok === true && retryBC?.committed === true && retryBC?.alreadyCommitted === true,
      "duplicate B->C retry returns alreadyCommitted: true", retryBC);

    const afterRetry14 = await readReplicas(page14);
    check(afterRetry14.local.revision === revB + 1 && afterRetry14.idb.revision === revB + 1,
      "duplicate B->C retry advanced no revision in either replica");
    check(afterRetry14.local.historyLen === 2 && afterRetry14.idb.historyLen === 2,
      "duplicate B->C retry created no extra archive");

    await ctx14.close();

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
