#!/usr/bin/env node
/**
 * Plan 052-P6: production-backed recovery carrier happy-path oracle.
 *
 * This is deliberately a browser test rather than a second copy of the pure
 * recovery-policy suite. The policy and expected slot outcomes are independent
 * inputs here; the production transition adapter must derive the live source
 * identity, allocate the target identity, and write the mirrored aggregate.
 *
 * Covered in this slice:
 *   - modern source identity and immutable recovery proposal binding;
 *   - active DraftV2 refusal before any recovery write;
 *   - one atomic recovery block start with no successor/archive;
 *   - mirrored carrier, reload idempotence, Rule-B week one, canonical week two;
 *   - one outcome-only reassessment CAS preserving the original proposal hash;
 *   - stale/losing reassessment and duplicate-target rejection;
 *   - legacy current-block and duplicate-target negative controls.
 *
 * Deliberately not covered here: corruption/quarantine, full backup, import,
 * clone, and old-service-worker upgrade boundaries (those belong to P7).
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { isDeepStrictEqual } from "node:util";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";
const STORE_NAME = "kv";

// Canonical policy v2 fixture, kept independent from RepForgeProgramTransition
// exports. The pure suite owns the exhaustive truth table; this oracle only
// needs one qualifying source block to exercise the storage carrier.
const APPROVED_POLICY_V2 = {
  kind: "taurifer-recovery-policy",
  policyVersion: 2,
  status: "Approved",
  primaryPatterns: ["knee-dominant", "horizontal press", "hip/hinge"],
  patternMapping: {
    squat: "knee-dominant",
    press: "horizontal press",
    incline_press: "horizontal press",
    hinge: "hip/hinge",
  },
  eligibility: {
    qualifyingOutcomes: ["maintained", "declined"],
    minimumPatterns: 2,
    checkpointAnswers: ["Yes", "No", "Not sure"],
    qualifyingCheckpointAnswer: "Yes",
    question: "During this block, did recovery feel worse than usual often enough to affect your training?",
  },
  ruleB: {
    optional: { effectiveWorkingSets: 0, reason: "optional-removed" },
    protected: { rounding: "ceil", divisor: 2, reason: "protected-ceil" },
    reducible: { rounding: "floor", divisor: 2, reason: "reducible-floor" },
    coverageRescue: {
      minimumWorkingSets: 1,
      selection: "first-eligible-stable-order",
      reason: "pattern-rescue",
    },
  },
  acceptanceBand: { minimum: 0.4, maximum: 0.6 },
  allowlistedMisses: {
    growth_2_v1: { base: 32, effective: 12 },
    growth_3_v1: { base: 49, effective: 17 },
  },
  reassessment: {
    outcomes: ["Better", "About the same", "Worse"],
    unset: null,
    ordinaryReviewOutcomes: ["About the same", "Worse"],
    sameBlockRepeat: false,
    weekTwoCanonical: true,
  },
};

const EVIDENCE = {
  outcomesByPattern: {
    "knee-dominant": "maintained",
    "horizontal press": "declined",
  },
  checkpointAnswer: "Yes",
};
const CREATED_AT = "2026-10-01T09:00:00.000Z";
const CONFIRMED_AT = "2026-10-01T09:12:00.000Z";
const REASSESSMENT_DUE_AT = "2026-10-08T09:12:00.000Z";

let passed = 0;
const failures = [];

function check(condition, message, detail) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
    return true;
  }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
  return false;
}

function reportResult() {
  console.log(`\nResult: ${passed} passed, ${failures.length} failed`);
  if (!failures.length) return;
  console.error("Intended failing cases:");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exitCode = 1;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function carrierOf(snapshot) {
  return snapshot?.recoveryTransitions ?? null;
}

function carrierRecords(snapshot) {
  return Array.isArray(carrierOf(snapshot)?.records) ? carrierOf(snapshot).records : [];
}

function stateEvidence(snapshot) {
  const meta = snapshot?.programMeta || {};
  return {
    revision: snapshot?._storageRevision ?? null,
    programId: meta.id ?? null,
    blockId: meta.blockId ?? null,
    started: meta.started ?? null,
    program: snapshot?.program ?? [],
    programMeta: meta,
    programHistory: snapshot?.programHistory ?? [],
    recoveryTransitions: snapshot?.recoveryTransitions ?? null,
    log: snapshot?.log ?? [],
  };
}

async function readIdbState(page) {
  return page.evaluate(async ({ dbName, storeName, key }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.close();
        resolve(null);
        return;
      }
      const get = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? null);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
  }), { dbName: DB_NAME, storeName: STORE_NAME, key: KEY });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const idb = await readIdbState(page);
  return {
    local: JSON.parse(localRaw || "null"),
    idb,
    localEvidence: stateEvidence(JSON.parse(localRaw || "null")),
    idbEvidence: stateEvidence(idb),
  };
}

async function clearStorage(page) {
  await page.evaluate(async ({ key, draftKey, checkpointKey, dbName }) => {
    localStorage.removeItem(key);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
    localStorage.removeItem("repforge_program_setup_draft_v1");
    localStorage.removeItem("repforge_ui_v1");
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true }));
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, dbName: DB_NAME });
}

async function flush(page) {
  await page.evaluate(async () => {
    await window.__repforgeStorage?.flush?.();
    await window.__repforgeWorkoutDraft?.flush?.();
  });
}

async function activateBalancedRecommendPredecessor(page) {
  return page.evaluate(async () => {
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

    const baseProposal = window.__repforgeWorkoutDraft.state();
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
    return { ok: finalized?.localOk || finalized?.idbOk, finalized };
  });
}

async function currentState(page) {
  return page.evaluate(() => window.__repforgeWorkoutDraft?.state?.() || null);
}

async function draftBytes(page) {
  return page.evaluate(({ draftKey, checkpointKey }) => ({
    raw: localStorage.getItem(draftKey),
    checkpoint: localStorage.getItem(checkpointKey),
  }), { draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
}

async function openDraftWithEdit(page, note = "recovery carrier draft guard") {
  return page.evaluate(async (sessionNote) => {
    const hook = window.__repforgeWorkoutDraft;
    const snapshot = hook?.state?.();
    const day = snapshot?.program?.[0]?.day;
    if (!hook || typeof window.__repforgeEnterWorkout !== "function" || !day) {
      return { ok: false, error: "workout seam unavailable" };
    }
    const entered = await window.__repforgeEnterWorkout({ day, focus: false });
    if (!entered || !hook.current?.()) return { ok: false, error: "draft did not initialize" };
    const draft = hook.current();
    const exerciseId = draft.exerciseOrder?.[0];
    const setId = exerciseId && draft.exercises?.[exerciseId]?.setOrder?.[0];
    if (!exerciseId || !setId) return { ok: false, error: "draft has no first set" };
    await hook.dispatch("editSetField", {
      exerciseInstanceId: exerciseId,
      setId,
      field: "reps",
      value: "11",
    });
    await hook.dispatch("setSessionNotes", { value: sessionNote });
    await hook.flush();
    return {
      ok: true,
      blockId: draft.program?.blockId ?? null,
      programId: draft.program?.programId ?? null,
      raw: localStorage.getItem("repforge_draft_v1"),
      checkpoint: localStorage.getItem("repforge_draft_v1:v2-checkpoint"),
    };
  }, note);
}

async function clearDraft(page) {
  await page.evaluate(async () => {
    await window.__repforgeWorkoutDraft?.clear?.();
    await window.__repforgeWorkoutDraft?.flush?.();
    window.__repforgeLeaveWorkout?.();
  });
}

async function proposeRecovery(page, args) {
  return page.evaluate(async (input) => {
    const adapter = window.__repforgeProgramTransition;
    if (typeof adapter?.proposeRecoveryWeek !== "function") {
      return { ok: false, status: "unavailable", code: "recovery_proposal_seam_missing", missing: true };
    }
    const result = await adapter.proposeRecoveryWeek(input);
    const proposal = result?.proposal;
    const overlay = proposal?.diff?.recoveryWeek || result?.overlay;
    return {
      ...result,
      // Playwright serializes the returned proposal, so carry the browser-side
      // immutability observation as test metadata rather than pretending that
      // a frozen value survives the page boundary.
      _oracleFrozen: {
        proposal: Object.isFrozen(proposal),
        predecessor: Object.isFrozen(proposal?.predecessor),
        overlay: Object.isFrozen(overlay),
        entries: Object.isFrozen(overlay?.entries),
      },
    };
  }, args);
}

async function confirmRecovery(page, args) {
  return page.evaluate(async (input) => {
    const adapter = window.__repforgeProgramTransition;
    if (typeof adapter?.confirmTransition !== "function") {
      return { ok: false, committed: false, code: "transition_confirmation_seam_missing", missing: true };
    }
    return adapter.confirmTransition(input);
  }, args);
}

async function reassessRecovery(page, args) {
  return page.evaluate(async (input) => {
    const adapter = window.__repforgeProgramTransition;
    if (typeof adapter?.reassessRecovery !== "function") {
      return { ok: false, committed: false, code: "recovery_reassessment_seam_missing", missing: true };
    }
    return adapter.reassessRecovery(input);
  }, args);
}

function proposalOverlay(proposal) {
  return proposal?.diff?.recoveryWeek || proposal?.overlay || null;
}

function proposalSourceBlockId(proposal) {
  return proposal?.predecessor?.blockId ??
    proposal?.diff?.recoveryWeek?.eligibilityEvidence?.sourceBlockId ?? null;
}

function proposalTargetBlockId(proposal) {
  return proposal?.diff?.recoveryWeek?.blockId ?? null;
}

function recordWithOutcome(record, outcome) {
  const next = clone(record);
  if (next?.diff?.recoveryWeek) next.diff.recoveryWeek.reassessmentOutcome = outcome;
  return next;
}

function projectedSetCounts(state, draft, record) {
  const canonical = new Map((state?.program || []).map((row) => [String(row.slotId || row.id), row]));
  const entries = new Map((record?.diff?.recoveryWeek?.entries || []).map((entry) => [String(entry.slot), entry]));
  const seen = new Set();
  const mismatches = [];
  for (const exerciseId of draft?.exerciseOrder || []) {
    const exercise = draft.exercises?.[exerciseId];
    const slot = String(exercise?.sourceExerciseId || "");
    const row = canonical.get(slot);
    const entry = entries.get(slot);
    if (!row || !entry) {
      mismatches.push({ exerciseId, slot, reason: "unmatched-slot" });
      continue;
    }
    seen.add(slot);
    if (exercise.programmed?.sets !== entry.effectiveWorkingSets) {
      mismatches.push({ slot, actual: exercise.programmed?.sets, expected: entry.effectiveWorkingSets });
    }
  }
  for (const [slot, entry] of entries) {
    if (entry.effectiveWorkingSets > 0 && !seen.has(slot)) {
      mismatches.push({ slot, reason: "missing-positive-slot" });
    }
    if (entry.effectiveWorkingSets === 0 && seen.has(slot)) {
      mismatches.push({ slot, reason: "zero-slot-rendered" });
    }
  }
  return { canonical, entries, mismatches };
}

function canonicalSetCounts(state, draft) {
  const canonical = new Map((state?.program || []).map((row) => [String(row.slotId || row.id), row]));
  const mismatches = [];
  const seen = new Set();
  for (const exerciseId of draft?.exerciseOrder || []) {
    const exercise = draft.exercises?.[exerciseId];
    const slot = String(exercise?.sourceExerciseId || "");
    const row = canonical.get(slot);
    if (!row) {
      mismatches.push({ exerciseId, slot, reason: "unmatched-slot" });
      continue;
    }
    seen.add(slot);
    if (exercise.programmed?.sets !== row.sets) {
      mismatches.push({ slot, actual: exercise.programmed?.sets, expected: row.sets });
    }
  }
  if (seen.size !== canonical.size) {
    mismatches.push({ reason: "canonical-slot-coverage", seen: seen.size, expected: canonical.size });
  }
  return { canonical, mismatches };
}

async function main() {
  console.log("052-P6: recovery carrier production-backed oracle");
  console.log("Effective settings: model=native gpt-5.6-luna; reasoning_effort=max; fork_turns=none");
  await assertServingApp(BASE);

  const browser = await launchChromium();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await clearStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    console.log("\n1. Establish a modern compiler-backed source block");
    const activation = await activateBalancedRecommendPredecessor(page);
    check(activation.ok, "real Recommend predecessor activated through production finalization", activation);
    if (!activation.ok) {
      console.log("Harness/setup could not establish the real predecessor; remaining checks are not meaningful.");
      reportResult();
      return;
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const before = await currentState(page);
    const sourceBlockId = before?.programMeta?.blockId;
    const sourceProgramId = before?.programMeta?.id;
    const sourceRevision = before?._storageRevision;
    check(typeof sourceBlockId === "string" && sourceBlockId.length > 0, "source program has a modern blockId", before?.programMeta);
    check(sourceBlockId !== sourceProgramId, "source blockId is distinct from programId", { sourceBlockId, sourceProgramId });
    check(Number.isInteger(sourceRevision), "source has an integer durable revision", sourceRevision);
    check(before?.programMeta?.entrySource?.route === "recommend", "source carries reconstructable Recommend provenance");

    console.log("\n2. Propose an immutable recovery overlay through the existing transition adapter");
    const transitionId = "tr_recovery_carrier_happy_path";
    const proposalResult = await proposeRecovery(page, {
      evidence: { ...EVIDENCE },
      approvedPolicy: clone(APPROVED_POLICY_V2),
      transitionId,
      createdAt: CREATED_AT,
    });
    const proposal = proposalResult?.proposal || null;
    const overlay = proposalOverlay(proposal);
    const proposalBeforeMutation = clone(proposal);
    check(proposalResult?.ok === true, "recovery proposal is eligible and returned by production adapter", proposalResult);
    if (!proposal) {
      // Keep the run a clean, intentional red oracle on the pre-P6 production
      // head. The failure is the absent product seam, not a browser/harness
      // error; all dependent assertions are represented by the code path below
      // once the carrier implementation exists.
      check(proposalResult?.missing !== true, "recovery proposal seam exists on the production adapter", proposalResult);
      console.log("Expected red state: recovery proposal/commit carrier behavior is not present on this production head.");
      reportResult();
      return;
    }
    check(proposal.status === "preview" && proposal.kind === "recovery_week", "proposal is a recovery_week preview");
    check(proposal.predecessor?.programId === sourceProgramId, "proposal predecessor binds the live programId");
    check(proposal.predecessor?.durableRevision === sourceRevision, "proposal pins the live durable revision");
    check(proposalSourceBlockId(proposal) === sourceBlockId, "predecessor.blockId binds the live source block");
    check(overlay?.eligibilityEvidence?.sourceBlockId === sourceBlockId, "eligibility evidence carries the same sourceBlockId");
    check(proposalSourceBlockId(proposal) === overlay?.eligibilityEvidence?.sourceBlockId, "predecessor.blockId equals evidence.sourceBlockId");
    check(typeof proposalTargetBlockId(proposal) === "string" && proposalTargetBlockId(proposal) !== sourceBlockId,
      "immutable proposal allocates a distinct target blockId", { sourceBlockId, targetBlockId: proposalTargetBlockId(proposal) });
    check(overlay?.activePeriod === "nextBlockWeek1", "overlay activePeriod is nextBlockWeek1");
    check(overlay?.reassessmentOutcome === null, "proposal hashes the null reassessment outcome");
    check(overlay?.eligibilityEvidence?.checkpointAnswer === "Yes", "proposal retains the approved checkpoint answer");
    check(isObject(proposal.diff) && proposal.successor === undefined, "recovery proposal has no successor replacement");
    check(proposal.archiveId === undefined, "recovery preview has no archiveId");
    check(typeof proposal.proposalHash === "string" && proposal.proposalHash.length === 64, "proposal carries a proposalHash");
    check(proposalResult?._oracleFrozen?.proposal === true &&
      proposalResult?._oracleFrozen?.predecessor === true &&
      proposalResult?._oracleFrozen?.overlay === true &&
      proposalResult?._oracleFrozen?.entries === true,
    "production proposal and recovery entries are deeply immutable", proposalResult?._oracleFrozen);
    check(isDeepStrictEqual(proposal, proposalBeforeMutation), "proposal snapshot is immutable to the test caller");

    console.log("\n3. Active DraftV2 refuses recovery before any durable write");
    const draftSetup = await openDraftWithEdit(page);
    check(draftSetup.ok, "active DraftV2 has an edited set and checkpoint", draftSetup);
    const guardedBefore = await readReplicas(page);
    const guardedDraft = await draftBytes(page);
    const draftRefusal = await confirmRecovery(page, {
      proposal,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt: CONFIRMED_AT,
      reassessmentDueAt: REASSESSMENT_DUE_AT,
      acknowledgedDraftRaw: guardedDraft.raw,
    });
    check(draftRefusal?.committed !== true && draftRefusal?.localOk !== true && draftRefusal?.idbOk !== true,
      "active DraftV2 blocks recovery confirmation", draftRefusal);
    check(draftRefusal?.draftConflict === true || ["draft_conflict", "live_draft_blocks_next_block"].includes(draftRefusal?.code),
      "draft refusal is typed as a pre-write conflict", draftRefusal);
    const guardedAfter = await readReplicas(page);
    const guardedDraftAfter = await draftBytes(page);
    check(isDeepStrictEqual(guardedAfter.localEvidence, guardedBefore.localEvidence), "DraftV2 refusal leaves local durable state unchanged");
    check(isDeepStrictEqual(guardedAfter.idbEvidence, guardedBefore.idbEvidence), "DraftV2 refusal leaves IndexedDB durable state unchanged");
    check(guardedDraftAfter.raw === guardedDraft.raw && guardedDraftAfter.checkpoint === guardedDraft.checkpoint,
      "DraftV2 raw and checkpoint remain byte-identical after refusal");

    await clearDraft(page);
    const proposalAtCommit = await currentState(page);
    check(proposalAtCommit?._storageRevision === sourceRevision, "clearing the draft does not advance the program revision");

    console.log("\n4. Atomic recovery block-start commit writes one mirrored carrier record");
    const commitBefore = await readReplicas(page);
    const committed = await confirmRecovery(page, {
      proposal,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt: CONFIRMED_AT,
      reassessmentDueAt: REASSESSMENT_DUE_AT,
      acknowledgedDraftRaw: null,
    });
    check(committed?.committed === true && (committed?.localOk || committed?.idbOk), "recovery confirmation commits through storage", committed);
    await flush(page);
    const commitAfter = await readReplicas(page);
    const committedState = commitAfter.local;
    const committedRecords = carrierRecords(committedState);
    const committedRecord = committedRecords[0];
    check(commitAfter.localEvidence.revision === commitBefore.localEvidence.revision + 1,
      "atomic recovery start increments local revision exactly once", { before: commitBefore.localEvidence.revision, after: commitAfter.localEvidence.revision });
    check(commitAfter.idbEvidence.revision === commitBefore.idbEvidence.revision + 1,
      "atomic recovery start increments IndexedDB revision exactly once", { before: commitBefore.idbEvidence.revision, after: commitAfter.idbEvidence.revision });
    check(commitAfter.localEvidence.programId === sourceProgramId && commitAfter.idbEvidence.programId === sourceProgramId,
      "recovery keeps the current programId in both replicas");
    check(commitAfter.localEvidence.blockId === proposalTargetBlockId(proposal) && commitAfter.idbEvidence.blockId === proposalTargetBlockId(proposal),
      "the same atomic revision changes current blockId to the proposal target");
    check(commitAfter.localEvidence.programHistory.length === commitBefore.localEvidence.programHistory.length &&
      commitAfter.idbEvidence.programHistory.length === commitBefore.idbEvidence.programHistory.length,
      "recovery creates no successor archive");
    check(committedState?.programMeta?.transitionIn == null, "recovery creates no replacement transitionIn");
    check(committedRecords.length === 1, "recovery carrier contains exactly one committed record");
    check(carrierOf(committedState)?.schemaVersion === 1 && Array.isArray(carrierOf(committedState)?.quarantine),
      "recoveryTransitions is the versioned top-level carrier", carrierOf(committedState));
    check(isDeepStrictEqual(carrierOf(commitAfter.local), carrierOf(commitAfter.idb)), "recovery carrier is mirrored byte-semantically across replicas");
    check(committedRecord?.status === "committed" && committedRecord?.kind === "recovery_week", "carrier member is a committed recovery_week record");
    check(committedRecord?.archiveId === null && committedRecord?.successor === undefined, "committed recovery record has null archive and no successor");
    check(committedRecord?.predecessor?.blockId === sourceBlockId &&
      committedRecord?.diff?.recoveryWeek?.eligibilityEvidence?.sourceBlockId === sourceBlockId,
      "committed record preserves predecessor/evidence source binding");
    check(committedRecord?.diff?.recoveryWeek?.blockId === proposalTargetBlockId(proposal), "committed record preserves immutable target blockId");
    check(committedRecord?.diff?.recoveryWeek?.confirmedAt === CONFIRMED_AT &&
      committedRecord?.diff?.recoveryWeek?.reassessmentDueAt === REASSESSMENT_DUE_AT,
      "committed overlay carries explicit lifecycle timestamps");
    check(committedRecord?.diff?.recoveryWeek?.reassessmentOutcome === null, "committed record starts with null reassessmentOutcome");
    check(committedRecord?.proposalHash === proposal.proposalHash, "committed record preserves the proposalHash");
    check(isDeepStrictEqual(proposal, proposalBeforeMutation), "commit does not mutate the immutable proposal object");

    console.log("\n5. Reload/second boot is carrier-idempotent");
    const revisionAfterCommit = commitAfter.localEvidence.revision;
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const afterReload = await readReplicas(page);
    check(afterReload.localEvidence.revision === revisionAfterCommit && afterReload.idbEvidence.revision === revisionAfterCommit,
      "second boot adds no durable revision");
    check(carrierRecords(afterReload.local).length === 1 && carrierRecords(afterReload.idb).length === 1,
      "second boot adds no duplicate recovery record");
    check(afterReload.localEvidence.programHistory.length === commitAfter.localEvidence.programHistory.length &&
      afterReload.idbEvidence.programHistory.length === commitAfter.idbEvidence.programHistory.length,
      "second boot adds no archive");
    check(afterReload.localEvidence.blockId === proposalTargetBlockId(proposal) && afterReload.idbEvidence.blockId === proposalTargetBlockId(proposal),
      "second boot retains the target block identity");

    console.log("\n6. Week-one projection is reduced and week two is canonical with null reassessment");
    const weekOneEntered = await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      const day = s?.program?.[0]?.day;
      return day ? window.__repforgeEnterWorkout({ day, focus: false }) : false;
    });
    check(weekOneEntered === true, "week-one workout opens through the production draft seam");
    const weekOneDraft = await page.evaluate(() => window.__repforgeWorkoutDraft.current());
    const weekOneProjection = projectedSetCounts(afterReload.local, weekOneDraft, committedRecord);
    const effectiveTotal = [...weekOneProjection.entries.values()].reduce((sum, entry) => sum + entry.effectiveWorkingSets, 0);
    const baseTotal = [...weekOneProjection.entries.values()].reduce((sum, entry) => sum + entry.baseWorkingSets, 0);
    check(weekOneProjection.mismatches.length === 0, "week-one draft uses every Rule-B effective set count", weekOneProjection.mismatches);
    check(effectiveTotal < baseTotal, "week-one projection is reduced relative to canonical working-set volume", { effectiveTotal, baseTotal });
    check(weekOneDraft?.program?.blockId === proposalTargetBlockId(proposal), "week-one DraftV2 carries the target blockId");
    await clearDraft(page);

    const movedToWeekTwo = await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      const moved = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
      s.programMeta = { ...s.programMeta, started: moved };
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result, moved };
    });
    check(movedToWeekTwo.ok, "week-two boundary fixture committed through the existing state seam", movedToWeekTwo);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const weekTwoState = await currentState(page);
    const weekTwoMeta = await page.evaluate(() => window.__repforgeMesocycleWeek?.());
    check(weekTwoMeta?.current >= 2, "week-two fixture is past the recovery week", weekTwoMeta);
    const weekTwoEntered = await page.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      const day = s?.program?.[0]?.day;
      return day ? window.__repforgeEnterWorkout({ day, focus: false }) : false;
    });
    check(weekTwoEntered === true, "week-two workout opens through the production draft seam");
    const weekTwoDraft = await page.evaluate(() => window.__repforgeWorkoutDraft.current());
    const weekTwoCanonical = canonicalSetCounts(weekTwoState, weekTwoDraft);
    check(weekTwoCanonical.mismatches.length === 0, "week two restores the canonical prescription even while unanswered", weekTwoCanonical.mismatches);
    check(carrierRecords(weekTwoState)[0]?.diff?.recoveryWeek?.reassessmentOutcome === null,
      "week two remains canonical with a persisted null reassessmentOutcome");
    await clearDraft(page);

    console.log("\n7. One outcome-only reassessment CAS preserves the original proposal hash");
    const reassessmentDraft = await openDraftWithEdit(page, "draft must survive reassessment");
    check(reassessmentDraft.ok, "a live DraftV2 is available while reassessment is submitted", reassessmentDraft);
    const reassessBefore = await readReplicas(page);
    const reassessRecordBefore = carrierRecords(reassessBefore.local)[0];
    const reassessDraftBefore = await draftBytes(page);
    const expectedRevision = reassessBefore.localEvidence.revision;
    const reassessResult = await reassessRecovery(page, {
      expectedRevision,
      blockId: proposalTargetBlockId(proposal),
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      acknowledgedRecord: reassessRecordBefore,
      outcome: "About the same",
    });
    check(reassessResult?.committed === true && (reassessResult?.localOk || reassessResult?.idbOk),
      "reassessment CAS commits one outcome through the production storage seam", reassessResult);
    await flush(page);
    const reassessAfter = await readReplicas(page);
    const reassessRecordAfter = carrierRecords(reassessAfter.local)[0];
    check(reassessAfter.localEvidence.revision === expectedRevision + 1 && reassessAfter.idbEvidence.revision === expectedRevision + 1,
      "reassessment increments each replica revision exactly once");
    check(reassessRecordAfter?.diff?.recoveryWeek?.reassessmentOutcome === "About the same", "reassessment closes null with the submitted outcome");
    check(reassessRecordAfter?.proposalHash === proposal.proposalHash && reassessRecordBefore?.proposalHash === proposal.proposalHash,
      "reassessment preserves the original proposalHash");
    check(isDeepStrictEqual(reassessRecordAfter, recordWithOutcome(reassessRecordBefore, "About the same")),
      "reassessment changes only the outcome field in the committed record");
    check(isDeepStrictEqual(reassessAfter.localEvidence.program, reassessBefore.localEvidence.program) &&
      reassessAfter.localEvidence.blockId === reassessBefore.localEvidence.blockId &&
      isDeepStrictEqual(reassessAfter.localEvidence.programHistory, reassessBefore.localEvidence.programHistory) &&
      isDeepStrictEqual(reassessAfter.localEvidence.log, reassessBefore.localEvidence.log),
      "reassessment leaves program, block, archive, and log unchanged");
    const reassessDraftAfter = await draftBytes(page);
    check(reassessDraftAfter.raw === reassessDraftBefore.raw && reassessDraftAfter.checkpoint === reassessDraftBefore.checkpoint,
      "reassessment leaves the acknowledged DraftV2 raw/checkpoint untouched");

    console.log("\n8. Losing reassessment and duplicate target apply no state change");
    const loserBefore = await readReplicas(page);
    const loser = await reassessRecovery(page, {
      expectedRevision,
      blockId: proposalTargetBlockId(proposal),
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      acknowledgedRecord: reassessRecordBefore,
      outcome: "Worse",
    });
    check(loser?.committed !== true && loser?.localOk !== true && loser?.idbOk !== true,
      "stale/losing reassessment is not committed", loser);
    check(loser?.code === "recovery_reassessment_closed" || loser?.code === "stale" || loser?.stale === true,
      "losing reassessment returns recovery_reassessment_closed or stale", loser);
    const loserAfter = await readReplicas(page);
    check(isDeepStrictEqual(loserAfter.localEvidence, loserBefore.localEvidence) &&
      isDeepStrictEqual(loserAfter.idbEvidence, loserBefore.idbEvidence),
      "losing reassessment changes neither durable replica");

    const duplicateTargetProposal = clone(proposal);
    duplicateTargetProposal.transitionId = `${proposal.transitionId}_duplicate_target`;
    duplicateTargetProposal.predecessor.durableRevision = loserBefore.localEvidence.revision;
    duplicateTargetProposal.predecessor.blockId = proposalTargetBlockId(proposal);
    duplicateTargetProposal.diff.recoveryWeek.transitionId = duplicateTargetProposal.transitionId;
    duplicateTargetProposal.diff.recoveryWeek.eligibilityEvidence.sourceBlockId = proposalTargetBlockId(proposal);
    duplicateTargetProposal.diff.recoveryWeek.blockId = proposalTargetBlockId(proposal);
    duplicateTargetProposal.proposalHash = await page.evaluate(async (candidate) =>
      window.RepForgeProgramTransition.hashProposal(candidate), duplicateTargetProposal);
    const duplicateBefore = await readReplicas(page);
    const duplicateResult = await confirmRecovery(page, {
      proposal: duplicateTargetProposal,
      transitionId: duplicateTargetProposal.transitionId,
      proposalHash: duplicateTargetProposal.proposalHash,
      confirmedAt: "2026-10-01T09:13:00.000Z",
      reassessmentDueAt: REASSESSMENT_DUE_AT,
      acknowledgedDraftRaw: reassessDraftAfter.raw,
    });
    check(duplicateResult?.committed !== true && duplicateResult?.localOk !== true && duplicateResult?.idbOk !== true,
      "duplicate-target recovery confirmation is rejected", duplicateResult);
    check(duplicateResult?.code === "recovery_same_block_repeat" || duplicateResult?.code === "recovery_target_conflict" || duplicateResult?.stale === true,
      "duplicate-target attempt returns a typed refusal", duplicateResult);
    const duplicateAfter = await readReplicas(page);
    check(isDeepStrictEqual(duplicateAfter.localEvidence, duplicateBefore.localEvidence) &&
      isDeepStrictEqual(duplicateAfter.idbEvidence, duplicateBefore.idbEvidence),
      "duplicate-target attempt applies neither replica");
    await clearDraft(page);

    console.log("\n9. Legacy current block is recovery-ineligible");
    const legacyContext = await browser.newContext();
    const legacyPage = await legacyContext.newPage();
    legacyPage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await legacyPage.goto(BASE);
    await waitForAppBoot(legacyPage, { base: BASE });
    await clearStorage(legacyPage);
    await legacyPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(legacyPage, { base: BASE });
    const legacyActivation = await activateBalancedRecommendPredecessor(legacyPage);
    check(legacyActivation.ok, "legacy negative-control predecessor activated", legacyActivation);
    const legacyInstall = await legacyPage.evaluate(async () => {
      const s = window.__repforgeWorkoutDraft.state();
      delete s.programMeta.blockId;
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result };
    });
    check(legacyInstall.ok, "legacy current block fixture committed without a blockId", legacyInstall);
    await legacyPage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(legacyPage, { base: BASE });
    const legacyBefore = await readReplicas(legacyPage);
    const legacyResult = await proposeRecovery(legacyPage, {
      evidence: { ...EVIDENCE, sourceBlockId: null },
      approvedPolicy: clone(APPROVED_POLICY_V2),
      transitionId: "tr_recovery_legacy_source_negative",
      createdAt: CREATED_AT,
    });
    check(legacyResult?.ok !== true, "legacy current block is refused before recovery proposal");
    check(legacyResult?.code === "legacy_block_ineligible" || legacyResult?.code === "source_block_unavailable" || legacyResult?.code === "transition_source_unavailable",
      "legacy refusal is a typed source-block eligibility result", legacyResult);
    const legacyAfter = await readReplicas(legacyPage);
    check(isDeepStrictEqual(legacyAfter.localEvidence, legacyBefore.localEvidence) &&
      isDeepStrictEqual(legacyAfter.idbEvidence, legacyBefore.idbEvidence),
      "legacy negative control mutates neither replica");
    await legacyContext.close();
  } finally {
    await browser.close();
  }

  reportResult();
}

main().catch((error) => {
  console.error("HARNESS FAILURE (not an intended product assertion):");
  console.error(error?.stack || error);
  process.exitCode = 2;
});
