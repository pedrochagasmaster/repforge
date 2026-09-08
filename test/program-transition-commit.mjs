#!/usr/bin/env node
/**
 * Focused vertical slice test for Plan 052-P6a:
 * Commit transitions with atomic provenance and draft preservation.
 *
 * Runs end-to-end against a live Taurifer server at REPFORGE_URL.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);
const Transition = require("../program-transition.js");
const Compiler = require("../program-compiler.js");
const Adapter = require("../program-entry-adapter.js");
const WorkoutDraft = require("../workout-draft.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
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
    console.log("\n1. Activate real balanced 4-day/90-minute Recommend program");
    const activationResult = await page.evaluate(async () => {
      if (!window.RepForgeProgramEntryAdapter || !window.RepForgeProgramCompiler) {
        return { ok: false, error: "compiler or entry adapter unavailable in window" };
      }
      const services = window.RepForgeProgramEntryAdapter.createProductionServices({
        Compiler: window.RepForgeProgramCompiler,
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
      if (!compiled.ok) return { ok: false, error: "compilation failed", issues: compiled.issues };

      const baseProposal = JSON.parse(JSON.stringify(window.state || {}));
      baseProposal.programMeta = baseProposal.programMeta || {};
      baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
      baseProposal.programMeta.progressionModifiers = [];
      baseProposal.programMeta.progressionIncompatibilities = [];
      baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
      baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));

      const finalized = await window.__repforgeFinalizeProgramSetup({
        exercises: compiled.preview.program,
        name: compiled.name || "Balanced 4-Day",
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
      return { ok: true, finalized, compiled };
    });

    check(activationResult.ok, "predecessor compiled and activated through production finalization seam", activationResult.issues || activationResult.error);
    if (!activationResult.ok) {
      throw new Error(`Step 1 failed: ${activationResult.error}`);
    }

    // Verify persisted state before reload
    const predecessorMetaBeforeReload = await page.evaluate(() => window.state?.programMeta);
    check(predecessorMetaBeforeReload?.onboarded === true, "predecessor is onboarded");
    check(predecessorMetaBeforeReload?.daysPerWeek === 4, "predecessor has 4 days per week");
    check(predecessorMetaBeforeReload?.compilerContext?.frequency === 4, "predecessor holds compilerContext with frequency 4");
    check(predecessorMetaBeforeReload?.compilerContext?.sessionMinutes === 90, "predecessor holds compilerContext with 90 minutes");
    check(predecessorMetaBeforeReload?.programStructure?.provenance?.blueprintId === "balanced_4_v1", "predecessor blueprint is balanced_4_v1");

    // Reload page and check that compiler context and program survived reload
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const predecessorHead = await page.evaluate(() => ({
      state: window.state,
      storageRevision: window.state?._storageRevision,
      meta: window.state?.programMeta,
      programLength: (window.state?.program || []).length,
      programStructure: window.state?.programMeta?.programStructure,
      relations: window.state?.programMeta?.progressionRelations,
      compilerContext: window.state?.programMeta?.compilerContext,
    }));

    check(predecessorHead.meta?.onboarded === true, "predecessor survived reload onboarded");
    check(predecessorHead.programLength > 0, "predecessor has program rows", predecessorHead.programLength);
    check(predecessorHead.compilerContext?.frequency === 4, "durable compiler context frequency matches 4", predecessorHead.compilerContext);
    check(predecessorHead.compilerContext?.sessionMinutes === 90, "durable compiler context sessionMinutes matches 90");
    check(predecessorHead.programStructure?.provenance?.familyId === "balanced", "durable structure provenance family is balanced");
    check(predecessorHead.meta?.entrySource?.route === "recommend", "durable entrySource route is recommend");

    const predecessorProgramId = predecessorHead.meta?.id;
    const predecessorRevision = predecessorHead.storageRevision;

    // -------------------------------------------------------------------------
    // Step 2: Populate active workout draft state via RepForgeWorkoutDraft on Day 1
    // -------------------------------------------------------------------------
    console.log("\n2. Populate active workout draft with edits, notes, and checkpoint");
    const draftSetup = await page.evaluate(async (dayArg) => {
      const dayLabel = dayArg || (window.state?.program || [])[0]?.day || "Day 1";
      if (!window.__repforgeWorkoutDraft || typeof window.__repforgeEnterWorkout !== "function") {
        return { ok: false, error: "workout draft or enter workout unavailable" };
      }
      await window.__repforgeEnterWorkout({ day: dayLabel, focus: false });
      const hook = window.__repforgeWorkoutDraft;
      const draft = hook.current();
      if (!draft || !draft.exercises) return { ok: false, error: "draft not initialized" };

      const exIds = Object.keys(draft.exercises);
      if (!exIds.length) return { ok: false, error: "no exercises in draft" };
      const ex0Id = exIds[0];
      const setIds = Object.keys(draft.exercises[ex0Id].sets || {});
      if (!setIds.length) return { ok: false, error: "no sets in exercise" };
      const set0Id = setIds[0];

      // Dirty edits
      await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "reps", value: "11" });
      await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "load", value: "72.5" });
      await hook.dispatch("completeSet", { exerciseInstanceId: ex0Id, setId: set0Id, completedAt: new Date().toISOString() });
      await hook.dispatch("setSessionNotes", { value: "Draft session notes before sibling transition" });
      await hook.flush();

      const raw = localStorage.getItem("repforge_draft_v1");
      const checkpointRaw = localStorage.getItem("repforge_draft_v1:v2-checkpoint");
      return { ok: true, raw, checkpointRaw, draft: hook.current() };
    });

    check(draftSetup.ok, "workout draft populated and flushed", draftSetup.error);
    if (!draftSetup.ok) throw new Error(`Step 2 failed: ${draftSetup.error}`);

    const preDraftRaw = draftSetup.raw;
    const preCheckpointRaw = draftSetup.checkpointRaw;
    check(typeof preDraftRaw === "string" && preDraftRaw.length > 0, "repforge_draft_v1 has raw string in storage");
    check(typeof preCheckpointRaw === "string" && preCheckpointRaw.length > 0, "repforge_draft_v1:v2-checkpoint has raw string in storage");
    check(draftSetup.draft.program?.programId === predecessorProgramId, "draft is bound to predecessor programId");

    // -------------------------------------------------------------------------
    // Step 3: Propose sibling transition through production transition adapter
    // -------------------------------------------------------------------------
    console.log("\n3. Propose sibling transition through production transition adapter");
    const transitionHookAvailable = await page.evaluate(() => {
      return typeof window.__repforgeProgramTransition === "object" && window.__repforgeProgramTransition !== null;
    });
    check(transitionHookAvailable, "window.__repforgeProgramTransition is defined");
    if (!transitionHookAvailable) {
      throw new Error("window.__repforgeProgramTransition unavailable; production transition adapter not implemented");
    }

    const diagnosisInput = {
      kind: "fewer_days",
      answers: { availableDays: 3 },
      eligibleEvidenceIds: ["sessions-14d-6-of-3"],
      insufficientEvidenceReasons: [],
    };
    const transitionId = "tr_p6a_test_b4_to_b3";
    const successorProgramId = "prog_balanced_3_p6a_succ";
    const proposalCreatedAt = "2026-10-02T14:00:00.000Z";

    const proposalResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.proposeSibling(args);
    }, {
      targetConstraint: { frequency: 3 },
      diagnosis: diagnosisInput,
      transitionId,
      successorProgramId,
      createdAt: proposalCreatedAt,
    });

    check(proposalResult?.ok === true, "proposeSibling succeeds", proposalResult?.code || proposalResult?.error);
    if (!proposalResult?.ok) throw new Error(`Step 3 failed: ${JSON.stringify(proposalResult)}`);

    const proposal = proposalResult.proposal;
    check(proposalResult.status === "preview", "proposal status is preview");
    check(proposal.kind === "lower_frequency_sibling", "proposal kind is lower_frequency_sibling");
    check(proposal.predecessor?.programId === predecessorProgramId, "proposal predecessor programId matches head");
    check(proposal.successor?.programId === successorProgramId, "proposal successor programId matches requested");
    check(Array.isArray(proposal.diff?.exercises) && proposal.diff.exercises.length === 24, "proposal has 24 exercise diff rows");
    check(typeof proposal.proposalHash === "string" && proposal.proposalHash.length === 64, "proposal carries 64-char proposalHash");
    check(proposalResult.successorCompilerContext?.frequency === 3, "successor compiler context frequency is 3");
    check(proposalResult.successorCompilerContext?.sessionMinutes === 90, "successor compiler context retains 90 min session");

    // Verify hash matches independent Transition domain calculation
    const expectedHash = await Transition.hashProposal(proposal);
    check(proposal.proposalHash === expectedHash, "proposalHash matches independent hashProposal calculation");

    // -------------------------------------------------------------------------
    // Step 4: Failure injections before commit
    // -------------------------------------------------------------------------
    console.log("\n4. Failure injections (stale revision, rehashed semantic-invalid, draft mismatch)");

    // 4a. Stale confirmation attempt (mismatched durable revision)
    const staleProposal = structuredClone(proposal);
    staleProposal.predecessor.durableRevision = 99999;
    const staleHash = await Transition.hashProposal(staleProposal);
    staleProposal.proposalHash = staleHash;

    const staleResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.confirmTransition(args);
    }, {
      proposal: staleProposal,
      transitionId: staleProposal.transitionId,
      successorProgramId: staleProposal.successor.programId,
      confirmedAt: "2026-10-02T14:05:00.000Z",
      proposalHash: staleHash,
      acknowledgedDraftRaw: preDraftRaw,
    });

    check(staleResult?.localOk === false && staleResult?.idbOk === false, "stale confirmation rejected");
    check(staleResult?.staleRevision === true || staleResult?.stale === true || staleResult?.code === "stale_proposal", "stale confirmation returns typed stale result");

    const stateAfterStale = await page.evaluate(() => ({
      id: window.state?.programMeta?.id,
      rev: window.state?._storageRevision,
      historyLen: (window.state?.programHistory || []).length,
    }));
    check(stateAfterStale.id === predecessorProgramId, "stale rejection produced zero mutation on active program");
    check(stateAfterStale.rev === predecessorRevision, "stale rejection produced zero storage revision bump");
    check(stateAfterStale.historyLen === 0, "stale rejection created zero archives");

    // 4b. Freshly rehashed semantic-invalid proposal (tampered diff prescription)
    const invalidProposal = structuredClone(proposal);
    invalidProposal.diff.prescriptions[0].after.sets = 999; // invalid prescription sets
    const invalidHash = await Transition.hashProposal(invalidProposal);
    invalidProposal.proposalHash = invalidHash;

    const invalidResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.confirmTransition(args);
    }, {
      proposal: invalidProposal,
      transitionId: invalidProposal.transitionId,
      successorProgramId: invalidProposal.successor.programId,
      confirmedAt: "2026-10-02T14:05:00.000Z",
      proposalHash: invalidHash,
      acknowledgedDraftRaw: preDraftRaw,
    });

    check(invalidResult?.localOk === false && invalidResult?.idbOk === false, "rehashed invalid proposal rejected in preflight");
    check(invalidResult?.invalid === true || invalidResult?.code?.includes("invalid"), "rehashed invalid proposal returns typed invalid result");

    const stateAfterInvalid = await page.evaluate(() => ({
      id: window.state?.programMeta?.id,
      rev: window.state?._storageRevision,
      historyLen: (window.state?.programHistory || []).length,
    }));
    check(stateAfterInvalid.id === predecessorProgramId, "invalid proposal produced zero mutation on active program");
    check(stateAfterInvalid.historyLen === 0, "invalid proposal created zero archives");

    // 4c. Acknowledged draft raw mismatch
    const draftMismatchResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.confirmTransition(args);
    }, {
      proposal,
      transitionId: proposal.transitionId,
      successorProgramId: proposal.successor.programId,
      confirmedAt: "2026-10-02T14:05:00.000Z",
      proposalHash: proposal.proposalHash,
      acknowledgedDraftRaw: JSON.stringify({ mismatched: true }),
    });

    check(draftMismatchResult?.localOk === false && draftMismatchResult?.idbOk === false, "draft mismatch rejected");
    check(draftMismatchResult?.draftConflict === true || draftMismatchResult?.conflict === true, "draft mismatch returns draftConflict");

    // -------------------------------------------------------------------------
    // Step 5: Confirm valid transition via production adapter
    // -------------------------------------------------------------------------
    console.log("\n5. Confirm valid transition through production adapter");
    const confirmedAt = "2026-10-02T14:10:00.000Z";
    const commitResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.confirmTransition(args);
    }, {
      proposal,
      transitionId: proposal.transitionId,
      successorProgramId: proposal.successor.programId,
      confirmedAt,
      proposalHash: proposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });

    check(commitResult?.localOk === true || commitResult?.idbOk === true, "confirmTransition successfully commits");
    check(commitResult?.committed === true, "confirmTransition returns committed: true");

    await page.evaluate(() => window.__repforgeStorage.flush());

    // -------------------------------------------------------------------------
    // Step 6: Reload page and assert durable state, archive, and draft preservation
    // -------------------------------------------------------------------------
    console.log("\n6. Reload and assert durable state, archive, and DraftV2 exact preservation");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const postState = await page.evaluate(() => window.state);
    const postLocalStorageRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const postIdbState = await readIdbState(page);

    check(postState?.programMeta?.id === successorProgramId, "active program is the successor programId");
    check(postState?.programMeta?.daysPerWeek === 3, "successor daysPerWeek is 3");
    check(postState?.programMeta?.compilerContext?.frequency === 3, "successor compilerContext frequency is 3");
    check(postState?.programMeta?.compilerContext?.sessionMinutes === 90, "successor compilerContext sessionMinutes is 90");
    check(postState?.programMeta?.programStructure?.provenance?.blueprintId === "balanced_3_v1", "successor blueprint is balanced_3_v1");

    // Transition-in record on successor
    const transitionIn = postState?.programMeta?.transitionIn;
    check(isPlainObject(transitionIn), "successor programMeta carries transitionIn object");
    check(transitionIn?.status === "committed", "transitionIn status is committed");
    check(transitionIn?.confirmedAt === confirmedAt, "transitionIn confirmedAt matches");
    check(transitionIn?.proposalHash === proposal.proposalHash, "transitionIn proposalHash matches proposal");
    check(transitionIn?.transitionId === transitionId, "transitionIn transitionId matches");
    check(transitionIn?.successor?.programId === successorProgramId, "transitionIn successor programId matches");
    check(transitionIn?.predecessor?.programId === predecessorProgramId, "transitionIn predecessor programId matches");

    // Program history archive entry
    const history = postState?.programHistory || [];
    check(history.length === 1, "exactly one archive entry exists in programHistory", history.length);
    const archive = history[0];
    check(archive?.id === predecessorProgramId || archive?.archiveId === predecessorProgramId, "archive links to predecessor program");
    check(archive?.transitionOut?.schemaVersion === 1, "archive transitionOut has schemaVersion 1");
    check(archive?.transitionOut?.transitionId === transitionId, "archive transitionOut transitionId matches");
    check(archive?.transitionOut?.proposalHash === proposal.proposalHash, "archive transitionOut proposalHash matches");
    check(archive?.transitionOut?.successorProgramId === successorProgramId, "archive transitionOut successorProgramId matches");

    // Replicas match
    const parsedLocal = JSON.parse(postLocalStorageRaw || "{}");
    check(parsedLocal.programMeta?.id === successorProgramId, "localStorage replica has successor programId");
    check(postIdbState?.programMeta?.id === successorProgramId, "IndexedDB replica has successor programId");
    check(parsedLocal._storageRevision === postIdbState?._storageRevision, "localStorage and IndexedDB revisions match", {
      local: parsedLocal._storageRevision,
      idb: postIdbState?._storageRevision,
    });
    check(isDeepStrictEqual(parsedLocal.programMeta?.transitionIn, postIdbState?.programMeta?.transitionIn), "transitionIn matches across localStorage and IndexedDB");
    check(isDeepStrictEqual(parsedLocal.programHistory, postIdbState?.programHistory), "programHistory matches across localStorage and IndexedDB");

    // Exact DraftV2 preservation
    const postDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const postCheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(postDraftRaw === preDraftRaw, "DraftV2 raw in localStorage is byte-for-byte identical to pre-transition");
    check(postCheckpointRaw === preCheckpointRaw, "DraftV2 checkpoint raw in localStorage is byte-for-byte identical to pre-transition");

    const parsedDraft = WorkoutDraft.parse(postDraftRaw);
    check(parsedDraft?.kind === "valid" && parsedDraft?.draft?.program?.programId === predecessorProgramId, "workout draft remains bound to predecessor programId", {
      kind: parsedDraft?.kind,
      draftProgramId: parsedDraft?.draft?.program?.programId,
      predecessorProgramId,
    });
    check(parsedDraft?.draft?.session?.notes === "Draft session notes before sibling transition", "draft notes preserved", {
      notes: parsedDraft?.draft?.session?.notes,
    });

    // -------------------------------------------------------------------------
    // Step 7: Idempotent retry
    // -------------------------------------------------------------------------
    console.log("\n7. Idempotent retry returns already-committed result without second archive");
    const revisionBeforeRetry = postState._storageRevision;
    const retryResult = await page.evaluate(async (args) => {
      return window.__repforgeProgramTransition.confirmTransition(args);
    }, {
      proposal,
      transitionId: proposal.transitionId,
      successorProgramId: proposal.successor.programId,
      confirmedAt,
      proposalHash: proposal.proposalHash,
      acknowledgedDraftRaw: preDraftRaw,
    });

    check(retryResult?.alreadyCommitted === true, "idempotent retry reports alreadyCommitted: true");
    check(retryResult?.committed === true, "idempotent retry reports committed: true");

    await page.evaluate(() => window.__repforgeStorage.flush());

    const stateAfterRetry = await page.evaluate(() => ({
      rev: window.state?._storageRevision,
      historyLen: (window.state?.programHistory || []).length,
      programId: window.state?.programMeta?.id,
      draftRaw: localStorage.getItem("repforge_draft_v1"),
    }));

    check(stateAfterRetry.rev === revisionBeforeRetry, "idempotent retry does not increment storage revision");
    check(stateAfterRetry.historyLen === 1, "idempotent retry does not create a second archive entry");
    check(stateAfterRetry.programId === successorProgramId, "active program remains successor");
    check(stateAfterRetry.draftRaw === preDraftRaw, "DraftV2 raw unchanged after idempotent retry");

    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    process.exit(1);
  }
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
