#!/usr/bin/env node
/**
 * Focused vertical slice test for Plan 052-P3b:
 * Guided manual repair fallback when safe sibling recompilation cannot resolve.
 *
 * Runs end-to-end against a live Taurifer server at port 8052.
 *
 * Contract verified:
 *  1. Server lifecycle: checks port 8052 is free before start, starts owned static server,
 *     verifies port free after clean stop in finally.
 *  2. Real active compiled program, nonempty log sentinel, active DraftV2/checkpoint,
 *     and both durable replicas (localStorage and IndexedDB).
 *  3. Derives guided fallback from representative real resolver Unavailable (shorter session
 *     30m on balanced 4d).
 *  4. Asserts unchanged semantic active state/revision/history/log in live clone/local/IDB,
 *     no transition-in/archive, exact DraftV2 bytes.
 *  5. Injected write failure and concurrent draft conflict return typed failure/conflict
 *     and preserve storage/newer draft.
 *  6. Staged and reload-resumed candidate program/structure/progression relations,
 *     modifiers, incompatibilities, and referenced custom definitions deep-equal the
 *     active predecessor snapshot.
 *  7. Edits candidate through real candidate editor commit seam (createOnboardingProgramEditorAdapter.commit)
 *     and asserts active state remains completely unchanged.
 *  8. After a benign durable commit, activating the still-pinned draft rejects stale via
 *     activationReadiness/CAS and creates zero archive/successor/transition-in.
 *  9. Explicit review: the stale draft is discarded and a fresh candidate is staged,
 *     pinned by production code to the then-live revision (never edited by the test).
 *     It is edited through the candidate editor and activated via __repforgeActivateEntryPreview,
 *     creating exactly one ordinary predecessor archive (transitionOut null), no transition-in,
 *     entrySource.route === "build", setup draft consumed, log sentinel preserved.
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { spawn } from "node:child_process";
import net from "node:net";
import { isDeepStrictEqual } from "node:util";

const PORT = 8052;
const BASE = `http://127.0.0.1:${PORT}/`;
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const SETUP_DRAFT_KEY = "repforge_program_setup_draft_v1";
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

async function isPortFree(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, host);
  });
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

function semanticState(s) {
  return s && {
    programId: s.programMeta?.id ?? null,
    name: s.programMeta?.name ?? null,
    revision: s._storageRevision ?? null,
    programLength: Array.isArray(s.program) ? s.program.length : 0,
    daysPerWeek: s.programMeta?.daysPerWeek ?? null,
    transitionIn: s.programMeta?.transitionIn ?? null,
    entrySource: s.programMeta?.entrySource ?? null,
    compilerContext: s.programMeta?.compilerContext ?? null,
    historyLen: Array.isArray(s.programHistory) ? s.programHistory.length : 0,
    programHistory: (s.programHistory ?? []).map((h) => ({
      id: h.id ?? null,
      transitionOut: h.transitionOut ?? null,
      archivedAt: h.archivedAt ?? null,
    })),
    logLen: Array.isArray(s.log) ? s.log.length : 0,
    logSentinels: (s.log ?? []).map((entry) => entry.session || entry.sessionId),
  };
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const idb = await readIdbState(page);
  const local = JSON.parse(localRaw || "null");
  return {
    local: semanticState(local),
    idb: semanticState(idb),
    rawLocal: localRaw,
  };
}

async function readLiveState(page) {
  return page.evaluate(() => {
    const s = window.__repforgeWorkoutDraft?.state?.();
    return s ? {
      programId: s.programMeta?.id ?? null,
      name: s.programMeta?.name ?? null,
      revision: s._storageRevision ?? null,
      programLength: Array.isArray(s.program) ? s.program.length : 0,
      daysPerWeek: s.programMeta?.daysPerWeek ?? null,
      transitionIn: s.programMeta?.transitionIn ?? null,
      entrySource: s.programMeta?.entrySource ?? null,
      compilerContext: s.programMeta?.compilerContext ?? null,
      historyLen: Array.isArray(s.programHistory) ? s.programHistory.length : 0,
      programHistory: (s.programHistory ?? []).map((h) => ({
        id: h.id ?? null,
        transitionOut: h.transitionOut ?? null,
        archivedAt: h.archivedAt ?? null,
      })),
      logLen: Array.isArray(s.log) ? s.log.length : 0,
      logSentinels: (s.log ?? []).map((entry) => entry.session || entry.sessionId),
    } : null;
  });
}

async function clearStorage(page) {
  await page.evaluate(async ({ key, draftKey, checkpointKey, setupDraftKey, dbName }) => {
    localStorage.removeItem(key);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
    localStorage.removeItem(setupDraftKey);
    localStorage.removeItem("repforge_ui_v1");
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true, installDismissedAt: Date.now() }));
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, setupDraftKey: SETUP_DRAFT_KEY, dbName: DB_NAME });
}

let serverProcess = null;

async function run() {
  console.log("Plan 052-P3b Guided Manual Repair Proof");

  // Step 0: Check port 8052 is free before starting owned static server
  const portFreeBefore = await isPortFree(PORT);
  check(portFreeBefore, `Port ${PORT} is free before static server launch`);
  if (!portFreeBefore) {
    throw new Error(`Port ${PORT} is already in use; cannot run isolated test`);
  }

  serverProcess = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(`Owned static server spawned: PID=${serverProcess.pid}, cwd=${process.cwd()}`);

  let serverReady = false;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(BASE);
      const text = await res.text();
      if (res.ok && text.includes("dayTabs")) {
        serverReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  check(serverReady, `Owned static server answering HTTP 200 at ${BASE}`);
  if (!serverReady) throw new Error("Static server failed to start");

  const browser = await launchChromium();
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));

  try {
    // Navigate and initialize clean state
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await clearStorage(page);
    await page.reload();
    await waitForAppBoot(page, { base: BASE });

    // Step 1: Seed real active compiled program with nonempty log sentinel and DraftV2 checkpoint
    console.log("\n1. Compile real predecessor, seed nonempty log sentinel and DraftV2 checkpoint");
    const initResult = await page.evaluate(async () => {
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
      if (!compiled.ok) return { ok: false, error: "compile_failed", issues: compiled.issues };

      const baseProposal = window.__repforgeWorkoutDraft.state();
      baseProposal.programMeta = baseProposal.programMeta || {};
      baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
      baseProposal.programMeta.progressionModifiers = [];
      baseProposal.programMeta.progressionIncompatibilities = [];
      baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
      baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));

      // Seed nonempty log sentinel with standard schema
      const row0 = compiled.preview.program[0];
      baseProposal.log = [
        {
          session: "sess_sentinel_p3b",
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
        },
      ];

      await window.__repforgeFinalizeProgramSetup({
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
      return { ok: true, programId: baseProposal.programMeta?.id, program: compiled.preview.program };
    });
    check(initResult.ok, "active compiled predecessor program initialized", initResult);

    // Populate valid DraftV2 and checkpoint via production draft hook
    const draftSentinels = await page.evaluate(async () => {
      const dayLabel = (window.__repforgeWorkoutDraft.state()?.program || [])[0]?.day || "Day 1";
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

      await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "reps", value: "11" });
      await hook.dispatch("editSetField", { exerciseInstanceId: ex0Id, setId: set0Id, field: "load", value: "72.5" });
      await hook.dispatch("completeSet", { exerciseInstanceId: ex0Id, setId: set0Id, completedAt: new Date().toISOString() });
      await hook.dispatch("setSessionNotes", { value: "Draft session notes before sibling transition" });
      await hook.flush();

      return {
        ok: true,
        draftRaw: localStorage.getItem("repforge_draft_v1"),
        checkpointRaw: localStorage.getItem("repforge_draft_v1:v2-checkpoint"),
      };
    });
    check(draftSentinels.ok, "DraftV2 and checkpoint initialized via production hook", draftSentinels.error);

    const draftV2Sentinel = draftSentinels.draftRaw;
    const checkpointSentinel = draftSentinels.checkpointRaw;
    check(typeof draftV2Sentinel === "string" && draftV2Sentinel.length > 0, "DraftV2 sentinel initialized");
    check(typeof checkpointSentinel === "string" && checkpointSentinel.length > 0, "checkpoint sentinel initialized");

    // Reload once to settle baseline persistence
    await page.reload();
    await waitForAppBoot(page, { base: BASE });

    // Read baseline replicas and verify exact sentinels
    const baselineReplicas = await readReplicas(page);
    const baselineLive = await readLiveState(page);
        check(baselineReplicas.local.programId !== null, "localStorage holds active compiled program");
    check(baselineReplicas.idb.programId !== null, "IndexedDB holds active compiled program");
    check(isDeepStrictEqual(baselineReplicas.local, baselineReplicas.idb), "both durable replicas semantically match at baseline");
    check(isDeepStrictEqual(baselineLive, baselineReplicas.local), "live state clone matches durable replicas at baseline");
    check(baselineLive.logLen === 1 && baselineLive.logSentinels[0] === "sess_sentinel_p3b", "nonempty log sentinel present");
    check(baselineLive.historyLen === 0, "predecessor history is empty before any replacement");

    const baselineDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const baselineCheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(baselineDraftRaw === draftV2Sentinel, "baseline DraftV2 sentinel raw exact match");
    check(baselineCheckpointRaw === checkpointSentinel, "baseline checkpoint sentinel raw exact match");

    // Full predecessor program shape — the guided candidate must be a byte-for-byte
    // copy of every one of these, not just the same number of rows.
    const predecessorSnapshot = await page.evaluate(() => {
      const s = window.__repforgeWorkoutDraft.state();
      return {
        program: s.program,
        programStructure: s.programMeta?.programStructure ?? null,
        progressionRelations: s.programMeta?.progressionRelations ?? [],
        progressionModifiers: s.programMeta?.progressionModifiers ?? [],
        progressionIncompatibilities: s.programMeta?.progressionIncompatibilities ?? [],
        customExercises: s.customExercises ?? [],
      };
    });
    const assertCandidateMatchesPredecessor = (preview, label) => {
      check(isDeepStrictEqual(preview?.program, predecessorSnapshot.program),
        `${label}: candidate program deep-equals predecessor snapshot`);
      check(isDeepStrictEqual(preview?.programStructure, predecessorSnapshot.programStructure),
        `${label}: candidate programStructure deep-equals predecessor snapshot`);
      check(isDeepStrictEqual(preview?.progressionRelations, predecessorSnapshot.progressionRelations),
        `${label}: candidate progressionRelations deep-equals predecessor snapshot`);
      check(isDeepStrictEqual(preview?.progressionModifiers, predecessorSnapshot.progressionModifiers),
        `${label}: candidate progressionModifiers deep-equals predecessor snapshot`);
      check(isDeepStrictEqual(preview?.progressionIncompatibilities, predecessorSnapshot.progressionIncompatibilities),
        `${label}: candidate progressionIncompatibilities deep-equals predecessor snapshot`);
      check(isDeepStrictEqual(preview?.customExercises, predecessorSnapshot.customExercises),
        `${label}: candidate referenced custom definitions deep-equal predecessor snapshot`);
    };

    // Step 2: Representative real resolver Unavailable
    console.log("\n2. Representative resolver Unavailable: shorter session 30m on balanced 4d");
    const diag30m = {
      kind: "sessions_too_long",
      answers: { sessionMinutes: 30 },
      eligibleEvidenceIds: ["ev_sess_30m_p3b"],
      insufficientEvidenceReasons: [],
    };
    const unavailResult = await page.evaluate(async (diagnosis) => {
      const tr = window.__repforgeProgramTransition;
      const res = await tr.proposeSibling({
        diagnosis,
        targetConstraint: { sessionMinutes: 30 },
        transitionId: "tr_p3b_30m",
        successorProgramId: "prog_p3b_30m",
      });
      return res;
    }, diag30m);
    check(unavailResult?.ok === false, "resolver returned ok: false");
    check(unavailResult?.status === "unavailable", "resolver returned status: unavailable");
    check(unavailResult?.unavailable === true, "resolver returned unavailable: true");

    // Step 3: Failure injection: storage write failure during staging
    console.log("\n3. Injected write failure during staging returns typed error without state mutation");
    const writeFailResult = await page.evaluate(async ({ diagnosis, unavailable }) => {
      const failingIO = {
        ...window.__repforgeStorage,
        writeSetupDraft: () => Promise.reject(new Error("Simulated storage write error")),
      };
      return await window.__repforgeStageGuidedManualRepair({ diagnosis, unavailable }, failingIO);
    }, { diagnosis: diag30m, unavailable: unavailResult });
    console.log("DEBUG writeFailResult:", JSON.stringify(writeFailResult));
  check(writeFailResult?.ok === false, "injected write failure returned ok: false");
    check(writeFailResult?.writeFailed === true, "injected write failure returned writeFailed: true");
    check(writeFailResult?.code === "save_failed", "injected write failure returned code: save_failed");

    // Verify state and replicas untouched after write failure
    const afterWriteFailReplicas = await readReplicas(page);
    const afterWriteFailLive = await readLiveState(page);
    check(isDeepStrictEqual(afterWriteFailReplicas.local, baselineReplicas.local), "localStorage replica unchanged after write failure");
    check(isDeepStrictEqual(afterWriteFailReplicas.idb, baselineReplicas.idb), "IndexedDB replica unchanged after write failure");
    check(isDeepStrictEqual(afterWriteFailLive, baselineLive), "live state unchanged after write failure");
    const afterWriteFailDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const afterWriteFailCheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(afterWriteFailDraftRaw === draftV2Sentinel, "DraftV2 raw unchanged after write failure");
    check(afterWriteFailCheckpointRaw === checkpointSentinel, "checkpoint raw unchanged after write failure");

    // Step 4: Competing newer draft CAS conflict
    console.log("\n4. Competing newer draft conflict returns typed conflict and preserves newer draft");
    const competingDraftRaw = JSON.stringify({
      schemaVersion: 1,
      draftId: "competing_newer_draft_uuid",
      revision: 10,
      ownerId: "competing_writer",
      state: {
        schemaVersion: 1,
        draftId: "competing_newer_draft_uuid",
        route: "build",
        step: "editor",
        answers: { programName: "Competing Draft" },
        legacyHints: {},
        result: null,
        versions: {},
        activeProgramRevisionAtStart: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    await page.evaluate(({ key, raw }) => {
      localStorage.setItem(key, raw);
    }, { key: SETUP_DRAFT_KEY, raw: competingDraftRaw });

    const conflictResult = await page.evaluate(async ({ diagnosis, unavailable }) => {
      return await window.__repforgeStageGuidedManualRepair({ diagnosis, unavailable });
    }, { diagnosis: diag30m, unavailable: unavailResult });
    console.log("DEBUG conflictResult:", JSON.stringify(conflictResult));
  check(conflictResult?.ok === false, "competing draft staging returned ok: false");
    check(conflictResult?.conflict === true, "competing draft staging returned conflict: true");
    check(conflictResult?.code === "save_conflict", "competing draft staging returned code: save_conflict");

    // Verify competing draft preserved untouched in storage
    const currentSetupDraftRaw = await page.evaluate((k) => localStorage.getItem(k), SETUP_DRAFT_KEY);
    check(currentSetupDraftRaw === competingDraftRaw, "competing newer setup draft preserved byte-for-byte in localStorage");

    // Verify active program and replicas still untouched
    const afterConflictReplicas = await readReplicas(page);
    check(isDeepStrictEqual(afterConflictReplicas.local, baselineReplicas.local), "localStorage replica unchanged after draft conflict");
    check(isDeepStrictEqual(afterConflictReplicas.idb, baselineReplicas.idb), "IndexedDB replica unchanged after draft conflict");

    // Clean up competing draft
    await page.evaluate((k) => localStorage.removeItem(k), SETUP_DRAFT_KEY);

    // Step 5: Successful staging of guided manual repair
    console.log("\n5. Stage guided manual repair candidate into setup draft");
    const stageResult = await page.evaluate(async ({ diagnosis, unavailable }) => {
      return await window.__repforgeStageGuidedManualRepair({ diagnosis, unavailable });
    }, { diagnosis: diag30m, unavailable: unavailResult });
    console.log("DEBUG stageResult:", JSON.stringify(stageResult));
  check(stageResult?.ok === true, "guided repair staged successfully");
    check(stageResult?.staged === true, "guided repair reports staged: true");
    check(stageResult?.kind === "guided_manual_repair", "guided repair reports kind: guided_manual_repair");

    // Verify active program state and durable replicas STILL UNCHANGED
    const afterStageReplicas = await readReplicas(page);
    const afterStageLive = await readLiveState(page);
    check(isDeepStrictEqual(afterStageReplicas.local, baselineReplicas.local), "localStorage replica unchanged after successful staging");
    check(isDeepStrictEqual(afterStageReplicas.idb, baselineReplicas.idb), "IndexedDB replica unchanged after successful staging");
    check(isDeepStrictEqual(afterStageLive, baselineLive), "live state unchanged after successful staging");
    check(afterStageLive.historyLen === 0, "no archive created by staging");
    check(afterStageLive.transitionIn === null, "no transition-in created by staging");

    // Verify DraftV2 sentinels untouched
    const afterStageDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    const afterStageCheckpointRaw = await page.evaluate((k) => localStorage.getItem(k), CHECKPOINT_KEY);
    check(afterStageDraftRaw === draftV2Sentinel, "DraftV2 raw unchanged after staging");
    check(afterStageCheckpointRaw === checkpointSentinel, "checkpoint raw unchanged after staging");

    // Verify staged setup draft schema and instruction facts
    const stagedDraft = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, SETUP_DRAFT_KEY);
    check(stagedDraft !== null, "setup draft persisted in localStorage");
    check(stagedDraft?.state?.route === "build", "staged draft route is build");
    check(stagedDraft?.state?.step === "editor", "staged draft step is editor");
    check(stagedDraft?.state?.activeProgramRevisionAtStart === baselineLive.revision, "staged draft pinned activeProgramRevisionAtStart matches live revision");
    check(stagedDraft?.state?.result?.diagnostics?.mainConstraint === "sessions_too_long", "diagnostics instruction mainConstraint is sessions_too_long");
    check(stagedDraft?.state?.result?.diagnostics?.sessionMinutes === 30, "diagnostics instruction sessionMinutes is 30");
    check(stagedDraft?.state?.result?.diagnostics?.daysPerWeek === undefined, "diagnostics instruction daysPerWeek is omitted for session constraint");
    check(Array.isArray(stagedDraft?.state?.result?.preview?.program) && stagedDraft.state.result.preview.program.length > 0, "preview holds candidate program");
    assertCandidateMatchesPredecessor(stagedDraft?.state?.result?.preview, "staged");

    // Step 6: Reload page and verify resumed candidate and instruction
    console.log("\n6. Reload page: verify resumed draft, candidate, and instruction");
    await page.reload();
    await waitForAppBoot(page, { base: BASE });

    const resumedState = await page.evaluate(() => window.__repforgeEntryState?.());
    check(resumedState?.route === "build", "resumed draft route is build");
    check(resumedState?.step === "editor", "resumed draft step is editor");
    check(resumedState?.result?.diagnostics?.mainConstraint === "sessions_too_long", "resumed diagnostics mainConstraint preserved");
    check(resumedState?.result?.diagnostics?.sessionMinutes === 30, "resumed diagnostics sessionMinutes preserved");
    check(resumedState?.result?.preview?.program?.length === baselineLive.programLength, "resumed preview program length matches candidate");
    assertCandidateMatchesPredecessor(resumedState?.result?.preview, "resumed");

    // Active state still completely unchanged
    const afterReloadLive = await readLiveState(page);
    check(isDeepStrictEqual(afterReloadLive, baselineLive), "live active state completely unchanged after reload");

    // Step 7: Edit candidate through the real candidate editor commit seam and
    // prove it changes only the setup draft, never the active program.
    console.log("\n7. Edit candidate through real editor commit seam; assert active state untouched");
    const staleEditCommitResult = await page.evaluate(async () => {
      const adapter = window.__repforgeCreateOnboardingProgramEditorAdapter();
      const doc = adapter.read().document;
      const origSets = doc.program[0].sets;
      doc.program[0].sets = origSets > 1 ? origSets - 1 : 1;
      doc.program[0].notes = "Edited in candidate editor before review";
      const res = await adapter.commit({ nextDocument: doc });
      return { ...res, newSets: doc.program[0].sets };
    });
    check(staleEditCommitResult?.ok === true, "candidate editor commit succeeded", staleEditCommitResult);
    check(staleEditCommitResult?.setupDraft === true, "commit confirmed setupDraft: true");
    check(staleEditCommitResult?.staged === true, "commit confirmed staged: true");

    // Assert active program is STILL UNCHANGED
    const afterEditLive = await readLiveState(page);
    const afterEditReplicas = await readReplicas(page);
    check(isDeepStrictEqual(afterEditLive, baselineLive), "live active program untouched after candidate edit");
    check(isDeepStrictEqual(afterEditReplicas.local, baselineReplicas.local), "localStorage replica untouched after candidate edit");
    check(isDeepStrictEqual(afterEditReplicas.idb, baselineReplicas.idb), "IndexedDB replica untouched after candidate edit");
    check(afterEditLive.historyLen === 0, "no archive created by candidate edit");

    // Step 8: Advance active durable revision before activation -> stale rejection
    // with zero archive/successor. Plan 052 requires regeneration only after
    // explicit review; the stale preview is never revived in place.
    console.log("\n8. Advance active durable revision -> activationReadiness/CAS rejects stale, zero archive");
    const revisionBeforeBenign = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?._storageRevision);
    await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      s.settings = { ...(s.settings || {}), restSec: (s.settings?.restSec || 90) + 15 };
      await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
    });
    const revisionAfterBenign = await page.evaluate(() => window.__repforgeWorkoutDraft.state()?._storageRevision);
    check(revisionAfterBenign === revisionBeforeBenign + 1, "active durable revision advanced by benign commit");

    const baselineLiveAtR1 = await readLiveState(page);
    const baselineReplicasAtR1 = await readReplicas(page);

    // Attempt activation while the staged draft still pins the pre-commit revision.
    const staleActivationResult = await page.evaluate(async () => {
      const res = await window.__repforgeActivateEntryPreview();
      const es = window.__repforgeEntryState();
      return { res, step: es?.step };
    });
    check(staleActivationResult?.step === "activation_conflict", "stale draft activation transitioned to activation_conflict step");

    const afterStaleLive = await readLiveState(page);
    const afterStaleReplicas = await readReplicas(page);
    check(afterStaleLive.programId === baselineLive.programId, "active programId still predecessor after stale activation rejection");
    check(afterStaleLive.historyLen === 0, "zero archive created after stale activation rejection (live)");
    check(afterStaleLive.transitionIn === null, "zero transition-in after stale activation rejection (live)");
    check(afterStaleReplicas.idb.historyLen === 0, "zero archive after stale activation rejection (IndexedDB)");
    check(isDeepStrictEqual(afterStaleLive, baselineLiveAtR1), "live active state unchanged by stale activation rejection");
    const afterStaleDraftRaw = await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY);
    check(afterStaleDraftRaw === draftV2Sentinel, "DraftV2 raw unchanged after stale activation rejection");

    // Step 9: Explicit review — discard the stale draft, then stage a fresh guided
    // candidate whose pinned revision is set by production code to the then-live
    // revision. The test never edits activeProgramRevisionAtStart itself.
    console.log("\n9. Explicit review: discard stale draft, stage fresh at live revision, edit, activate, reload");
    await page.evaluate((k) => localStorage.removeItem(k), SETUP_DRAFT_KEY);
    await page.reload();
    await waitForAppBoot(page, { base: BASE });

    const liveRevisionForFresh = await page.evaluate(() => window.__repforgeWorkoutDraft.state()._storageRevision);
    const freshStage = await page.evaluate(async ({ diagnosis, unavailable }) => {
      return await window.__repforgeStageGuidedManualRepair({ diagnosis, unavailable });
    }, { diagnosis: diag30m, unavailable: unavailResult });
    console.log("DEBUG freshStage:", JSON.stringify(freshStage));
    check(freshStage?.ok === true && freshStage?.staged === true, "fresh guided repair staged after explicit discard");

    const freshDraft = await page.evaluate((k) => {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    }, SETUP_DRAFT_KEY);
    check(freshDraft?.state?.activeProgramRevisionAtStart === liveRevisionForFresh,
      "fresh staged draft pinned by production code to the then-live durable revision");
    check(liveRevisionForFresh === revisionAfterBenign, "the then-live revision is the advanced revision R+1");
    assertCandidateMatchesPredecessor(freshDraft?.state?.result?.preview, "fresh-staged");

    // Fresh staging still mutated nothing durable.
    const afterFreshStageLive = await readLiveState(page);
    check(isDeepStrictEqual(afterFreshStageLive, baselineLiveAtR1), "live active state unchanged by fresh staging");
    check(afterFreshStageLive.historyLen === 0, "no archive created by fresh staging");

    // Reload so the fresh candidate resumes through the real draft parser.
    await page.reload();
    await waitForAppBoot(page, { base: BASE });
    const resumedFresh = await page.evaluate(() => window.__repforgeEntryState?.());
    check(resumedFresh?.route === "build" && resumedFresh?.step === "editor", "fresh candidate resumed at build/editor after reload");
    assertCandidateMatchesPredecessor(resumedFresh?.result?.preview, "fresh-resumed");

    // Edit the fresh candidate through the real candidate editor commit seam.
    const editCommitResult = await page.evaluate(async () => {
      const adapter = window.__repforgeCreateOnboardingProgramEditorAdapter();
      const doc = adapter.read().document;
      const origSets = doc.program[0].sets;
      doc.program[0].sets = origSets > 1 ? origSets - 1 : 1;
      doc.program[0].notes = "Edited in candidate editor for guided repair";
      const res = await adapter.commit({ nextDocument: doc });
      return { ...res, newSets: doc.program[0].sets };
    });
    check(editCommitResult?.ok === true, "fresh candidate editor commit succeeded", editCommitResult);
    check(editCommitResult?.setupDraft === true, "fresh commit confirmed setupDraft: true");
    check(editCommitResult?.staged === true, "fresh commit confirmed staged: true");

    const afterFreshEditLive = await readLiveState(page);
    check(isDeepStrictEqual(afterFreshEditLive, baselineLiveAtR1), "live active program untouched after fresh candidate edit");
    check(afterFreshEditLive.historyLen === 0, "no archive created by fresh candidate edit");

    // Activate through the existing editor and activateEntryPreview transaction.
    const activateResult = await page.evaluate(async () => {
      try {
        const res = await window.__repforgeActivateEntryPreview({ skipReplaceConfirm: true });
        const es = window.__repforgeEntryState();
        return { res, step: es?.step, notice: window.__repforgeEntryUiNotice?.() };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    });
    console.log("DEBUG activateResult:", JSON.stringify(activateResult));
    check(!activateResult?.error, "activation did not throw", activateResult);

    // Reload page to observe persisted post-activation state
    await page.reload();
    await waitForAppBoot(page, { base: BASE });

    const postActivationLive = await readLiveState(page);
    const postActivationReplicas = await readReplicas(page);

    // 1. Edited build candidate is active with entrySource.route === "build"
    check(postActivationLive.entrySource?.route === "build", "active program entrySource.route === build", postActivationLive.entrySource);
    const activeFirstRow = await page.evaluate(() => window.__repforgeWorkoutDraft.state().program[0]);
    check(activeFirstRow.sets === editCommitResult.newSets, "active program has edited sets from candidate editor commit", {
      expected: editCommitResult.newSets,
      actual: activeFirstRow.sets,
    });
    check(activeFirstRow.notes === "Edited in candidate editor for guided repair", "active program has edited notes from candidate editor");

    // 2. Exactly one ordinary predecessor archive in programHistory
    check(postActivationLive.historyLen === 1, "exactly one predecessor archive in programHistory", postActivationLive.historyLen);
    check(postActivationLive.programHistory[0].id === baselineLive.programId, "archive holds predecessor programId");
    check(postActivationLive.programHistory[0].transitionOut === null, "predecessor archive has no transitionOut (ordinary replacement)");

    // 3. No transition record invented
    check(postActivationLive.transitionIn === null, "active program has no transitionIn record");

    // 4. Setup draft consumed
    const postActivationSetupDraftRaw = await page.evaluate((k) => localStorage.getItem(k), SETUP_DRAFT_KEY);
    check(postActivationSetupDraftRaw === null, "setup draft consumed from localStorage");

    // 5. Both durable replicas agree
    check(isDeepStrictEqual(postActivationReplicas.local, postActivationReplicas.idb), "both durable replicas agree on activated state");
    check(isDeepStrictEqual(postActivationLive, postActivationReplicas.local), "live state clone matches durable replicas");

    // 6. Nonempty log sentinel preserved
    check(postActivationLive.logLen === 1 && postActivationLive.logSentinels[0] === "sess_sentinel_p3b", "nonempty log sentinel preserved through activation");
  } finally {
    await browser.close();
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 200));
      if (!serverProcess.killed) serverProcess.kill("SIGKILL");
    }
    let portFreeAfter = false;
    for (let i = 0; i < 30; i++) {
      portFreeAfter = await isPortFree(PORT);
      if (portFreeAfter) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    check(portFreeAfter, `Port ${PORT} is free after test teardown`);
    console.log(`Owned static server (PID=${serverProcess.pid}) stopped. Port ${PORT} free: ${portFreeAfter}`);
  }

  console.log(`\nResults: ${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error("Failures:");
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Unhandled error in test:", err);
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }
  process.exit(1);
});
