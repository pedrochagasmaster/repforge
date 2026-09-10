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
 *
 * Ownership: this file owns the P6 recovery-carrier browser acceptance slice;
 * production owns the existing transition/storage seams it exercises.
 * Independent oracle: policy parsing plus the fixed balanced_4_v1 fixture
 * supply expected evidence and per-slot counts; stored proposal/record data
 * is never used to manufacture an expected result.
 * Failure cases: the accepted pre-P6 head must fail only at the missing
 * recovery proposal seam. Completion barrier: the same file must turn green
 * with no edits to production, shared test registration, or cache inventory.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { applyRuleB, parseExecutablePolicy } from "../tools/recovery-policy-contract.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";
const STORE_NAME = "kv";

// Reuse the authoritative executable policy parser and the reviewed compiler
// fixture rather than copying the normative policy object into this oracle.
const APPROVED_POLICY_V2 = parseExecutablePolicy(
  readFileSync(new URL("../docs/recovery-week-policy.md", import.meta.url), "utf8"),
);
const PROGRAM_FAMILY_FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/program-families-v1.json", import.meta.url), "utf8"),
);
const BALANCED_4_FIXTURE = PROGRAM_FAMILY_FIXTURE.reviewCompilations.find(
  (compilation) => compilation.blueprintId === "balanced_4_v1",
);
if (!BALANCED_4_FIXTURE) throw new Error("balanced_4_v1 fixture is required by the recovery carrier oracle");
const FIXED_FIXTURE_DAY = BALANCED_4_FIXTURE.days[0];
const FIXED_FIXTURE_DAY_ID = FIXED_FIXTURE_DAY?.dayId;
const FIXED_FIXTURE_SLOT_IDS = (FIXED_FIXTURE_DAY?.slots || []).map((slot) => slot.slotId);
if (typeof FIXED_FIXTURE_DAY_ID !== "string" || FIXED_FIXTURE_DAY_ID.length === 0 || FIXED_FIXTURE_SLOT_IDS.length === 0) {
  throw new Error("balanced_4_v1 first day and slot identities are required by the recovery carrier oracle");
}
const BALANCED_4_FIXTURE_SLOTS = BALANCED_4_FIXTURE.days.flatMap((day) => day.slots);
const BALANCED_4_RULE_B = applyRuleB(
  BALANCED_4_FIXTURE_SLOTS.map((slot) => ({
    templateId: slot.templateId,
    status: slot.status,
    sets: slot.sets,
  })),
  { ...APPROVED_POLICY_V2, slotContracts: PROGRAM_FAMILY_FIXTURE.slotContracts },
);
const INDEPENDENT_CANONICAL_COUNTS = new Map(
  BALANCED_4_FIXTURE_SLOTS.map((slot) => [slot.slotId, slot.sets]),
);
const INDEPENDENT_WEEK_ONE_COUNTS = new Map(
  BALANCED_4_FIXTURE_SLOTS.map((slot, index) => [slot.slotId, BALANCED_4_RULE_B.effective[index]]),
);
const INDEPENDENT_DAY_EXPECTATIONS = new Map(
  BALANCED_4_FIXTURE.days.map((day) => {
    const canonicalCounts = new Map(day.slots.map((slot) => [slot.slotId, slot.sets]));
    const weekOneCounts = new Map(day.slots.map((slot) => [slot.slotId, INDEPENDENT_WEEK_ONE_COUNTS.get(slot.slotId)]));
    return [day.dayId, {
      dayId: day.dayId,
      label: day.label,
      canonicalCounts,
      weekOneCounts,
      canonicalSlotIds: [...canonicalCounts.keys()],
      weekOneSlotIds: [...weekOneCounts].filter(([, sets]) => sets > 0).map(([slotId]) => slotId),
    }];
  }),
);
const INDEPENDENT_WEEK_ONE_TOTAL = [...INDEPENDENT_WEEK_ONE_COUNTS.values()].reduce((sum, sets) => sum + sets, 0);
const INDEPENDENT_CANONICAL_TOTAL = [...INDEPENDENT_CANONICAL_COUNTS.values()].reduce((sum, sets) => sum + sets, 0);

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
  const local = JSON.parse(localRaw || "null");
  const idb = await readIdbState(page);
  return {
    localRaw,
    local,
    idb,
    localEvidence: stateEvidence(local),
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

async function locateFixedFixtureDay(page, expectedFixtureDayId) {
  return page.evaluate(({ expectedFixtureDayId, knownSlotIds }) => {
    const snapshot = window.__repforgeWorkoutDraft?.state?.();
    const liveRow = (snapshot?.program || []).find((row) =>
      knownSlotIds.includes(String(row?.slotId || row?.id || "")));
    if (!liveRow) {
      return {
        ok: false,
        code: "fixed_fixture_day_slot_missing",
        requestedDayLabel: null,
        expectedFixtureDayId,
        knownSlotIds,
      };
    }
    const requestedDayLabel = typeof liveRow.day === "string" && liveRow.day.length > 0
      ? liveRow.day
      : null;
    return {
      ok: liveRow.dayId === expectedFixtureDayId && requestedDayLabel !== null,
      code: liveRow.dayId === expectedFixtureDayId
        ? (requestedDayLabel ? null : "fixed_fixture_day_label_missing")
        : "fixed_fixture_day_id_mismatch",
      requestedDayLabel,
      expectedFixtureDayId,
      liveDayId: liveRow.dayId ?? null,
      liveSlotId: liveRow.slotId || liveRow.id || null,
      knownSlotIds,
    };
  }, { expectedFixtureDayId, knownSlotIds: FIXED_FIXTURE_SLOT_IDS });
}

async function openDraftWithEdit(page, requestedDayLabel, note = "recovery carrier draft guard") {
  return page.evaluate(async ({ requestedDayLabel, sessionNote }) => {
    const hook = window.__repforgeWorkoutDraft;
    if (!hook || typeof window.__repforgeEnterWorkout !== "function" || !requestedDayLabel) {
      return { ok: false, error: "workout seam unavailable" };
    }
    const entered = await window.__repforgeEnterWorkout({ day: requestedDayLabel, focus: false });
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
  }, { requestedDayLabel, sessionNote: note });
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
    const beforeMutation = proposal ? JSON.stringify(proposal) : null;
    try {
      if (proposal?.predecessor) proposal.predecessor.blockId = "oracle-mutation";
      if (overlay?.eligibilityEvidence) {
        overlay.eligibilityEvidence.sourceBlockId = "oracle-mutation";
        if (overlay.eligibilityEvidence.outcomesByPattern) {
          overlay.eligibilityEvidence.outcomesByPattern["knee-dominant"] = "oracle-mutation";
        }
      }
      if (proposal?.derivation) proposal.derivation.mode = "oracle-mutation";
      if (proposal?.derivation?.slotMapping?.slots?.[0]) {
        proposal.derivation.slotMapping.slots[0].predecessorSlot = "oracle-mutation";
      }
      if (overlay?.entries?.[0]) overlay.entries[0].effectiveWorkingSets += 1;
    } catch {
      // A strict deep-freeze may throw; the JSON equality below is the oracle.
    }
    return {
      ...result,
      // Playwright serializes the returned proposal, so carry the browser-side
      // immutability observation as test metadata rather than pretending that
      // a frozen value survives the page boundary.
      _oracleFrozen: {
        proposal: Object.isFrozen(proposal),
        predecessor: Object.isFrozen(proposal?.predecessor),
        overlay: Object.isFrozen(overlay),
        evidence: Object.isFrozen(overlay?.eligibilityEvidence),
        evidenceOutcomes: Object.isFrozen(overlay?.eligibilityEvidence?.outcomesByPattern),
        derivation: Object.isFrozen(proposal?.derivation),
        slotMapping: Object.isFrozen(proposal?.derivation?.slotMapping),
        slotMappingEntry: Object.isFrozen(proposal?.derivation?.slotMapping?.slots?.[0]),
        entries: Object.isFrozen(overlay?.entries),
        firstEntry: Object.isFrozen(overlay?.entries?.[0]),
      },
      _oracleMutationUnchanged: beforeMutation === (proposal ? JSON.stringify(proposal) : null),
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

function proposalTargetBlockId(proposal) {
  return proposal?.diff?.recoveryWeek?.blockId ?? null;
}

function codeUnitCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function duplicateConflictRaw(targetBlockId, records) {
  const sorted = [...records].sort((left, right) =>
    codeUnitCompare(String(left?.proposalHash || ""), String(right?.proposalHash || "")) ||
    codeUnitCompare(String(left?.transitionId || ""), String(right?.transitionId || "")));
  return JSON.stringify({ targetBlockId, records: sorted });
}

function recordWithOutcome(record, outcome) {
  const next = clone(record);
  if (next?.diff?.recoveryWeek) next.diff.recoveryWeek.reassessmentOutcome = outcome;
  return next;
}

function fixtureProjectionSetCounts(draft, projection, expectedFixtureDayId) {
  const selectedDayId = draft?.program?.dayId ?? null;
  const expectedDay = INDEPENDENT_DAY_EXPECTATIONS.get(expectedFixtureDayId);
  const expectedCounts = expectedDay?.[projection === "weekOne" ? "weekOneCounts" : "canonicalCounts"] || new Map();
  const expectedSlotIds = expectedDay?.[projection === "weekOne" ? "weekOneSlotIds" : "canonicalSlotIds"] || [];
  const actualSlotIds = [];
  const mismatches = [];
  if (!expectedDay) mismatches.push({ dayId: expectedFixtureDayId, reason: "unmatched-expected-fixture-day" });
  if (selectedDayId !== expectedFixtureDayId) {
    mismatches.push({ actualDayId: selectedDayId, expectedDayId: expectedFixtureDayId, reason: "draft-day-id-mismatch" });
  }
  for (const exerciseId of draft?.exerciseOrder || []) {
    const exercise = draft.exercises?.[exerciseId];
    const slot = String(exercise?.sourceExerciseId || "");
    actualSlotIds.push(slot);
    const expected = expectedCounts.get(slot);
    if (expected === undefined) {
      mismatches.push({ exerciseId, slot, reason: "unmatched-slot" });
      continue;
    }
    if (exercise.programmed?.sets !== expected) {
      mismatches.push({ slot, actual: exercise.programmed?.sets, expected });
    }
  }
  const expectedSet = new Set(expectedSlotIds);
  const actualSet = new Set(actualSlotIds);
  for (const slot of expectedSet) {
    if (!actualSet.has(slot)) mismatches.push({ slot, reason: "missing-selected-day-slot" });
  }
  for (const slot of actualSet) {
    if (!expectedSet.has(slot)) mismatches.push({ slot, reason: "extra-selected-day-slot" });
  }
  if (actualSlotIds.length !== actualSet.size) mismatches.push({ reason: "duplicate-selected-day-slot" });
  return {
    selectedDayId,
    expectedFixtureDayId,
    expectedSlotIds,
    actualSlotIds,
    expectedSlotSetNonempty: expectedSlotIds.length > 0,
    slotSetEqual: expectedSlotIds.length === actualSlotIds.length &&
      expectedSlotIds.every((slot, index) => slot === actualSlotIds[index]),
    mismatches,
  };
}

function fixtureWeekOneSetCounts(draft, expectedFixtureDayId) {
  return fixtureProjectionSetCounts(draft, "weekOne", expectedFixtureDayId);
}

function fixtureCanonicalSetCounts(draft, expectedFixtureDayId) {
  return fixtureProjectionSetCounts(draft, "canonical", expectedFixtureDayId);
}

function stateWithoutRecoveryCommitDelta(snapshot) {
  const copy = clone(snapshot);
  delete copy._storageRevision;
  delete copy.recoveryTransitions;
  if (copy.programMeta) delete copy.programMeta.blockId;
  return copy;
}

function exactRecoveryCommitDelta(before, after, targetBlockId) {
  return JSON.stringify(before?.program) === JSON.stringify(after?.program) &&
    JSON.stringify(before?.programHistory || []) === JSON.stringify(after?.programHistory || []) &&
    isDeepStrictEqual(stateWithoutRecoveryCommitDelta(before), stateWithoutRecoveryCommitDelta(after)) &&
    after?._storageRevision === before?._storageRevision + 1 &&
    after?.programMeta?.blockId === targetBlockId;
}

function fixtureProgramCoverage(program) {
  const rows = new Map((program || []).map((row) => [String(row.slotId || row.id), row]));
  const mismatches = [];
  for (const [slot, expectedSets] of INDEPENDENT_CANONICAL_COUNTS) {
    const row = rows.get(slot);
    if (!row) mismatches.push({ slot, reason: "missing-source-slot" });
    else if (row.sets !== expectedSets) mismatches.push({ slot, actual: row.sets, expected: expectedSets });
  }
  if (rows.size !== INDEPENDENT_CANONICAL_COUNTS.size) {
    mismatches.push({ reason: "source-slot-coverage", actual: rows.size, expected: INDEPENDENT_CANONICAL_COUNTS.size });
  }
  return { mismatches };
}

async function sealDuplicateTargetRecord(page, args) {
  return page.evaluate(async (input) => {
    const Transition = window.RepForgeProgramTransition;
    const Compiler = window.RepForgeProgramCompiler;
    const catalogue = window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY;
    const snapshot = window.__repforgeWorkoutDraft?.state?.();
    const context = snapshot?.programMeta?.compilerContext;
    const sourceBlockId = snapshot?.programMeta?.blockId;
    if (!Transition || !Compiler || !context || !sourceBlockId) {
      return { ok: false, code: "duplicate_fixture_compiler_unavailable" };
    }
    const instance = Compiler.compile(context, catalogue);
    const result = await Transition.proposeRecoveryWeek({
      predecessorInstance: instance,
      predecessor: {
        programId: snapshot.programMeta.id,
        blockId: sourceBlockId,
        durableRevision: snapshot._storageRevision,
        source: "Recommend",
      },
      approvedPolicy: input.approvedPolicy,
      evidence: { ...input.evidence, sourceBlockId },
      transitionId: input.transitionId,
      blockId: input.targetBlockId,
      createdAt: input.createdAt,
      supportedVersions: Compiler.VERSIONS,
      existingRecoveryRecords: [],
    });
    if (!result?.ok) return { ok: false, code: result?.code || "duplicate_fixture_proposal_failed", result };
    const record = Transition.commitRecord(result.proposal, {
      confirmedAt: input.confirmedAt,
      reassessmentDueAt: input.reassessmentDueAt,
      archiveId: null,
    });
    return { ok: true, sourceBlockId, proposal: result.proposal, record };
  }, args);
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
    const sourceFixtureCoverage = fixtureProgramCoverage(before?.program);
    check(sourceFixtureCoverage.mismatches.length === 0,
      "source program exactly covers the fixed balanced_4_v1 fixture slots", sourceFixtureCoverage.mismatches);
    check(INDEPENDENT_CANONICAL_TOTAL === 45 && INDEPENDENT_WEEK_ONE_TOTAL === 22,
      "independent fixture oracle pins balanced_4_v1 canonical and Rule-B totals",
      { canonical: INDEPENDENT_CANONICAL_TOTAL, weekOne: INDEPENDENT_WEEK_ONE_TOTAL });

    console.log("\n2. Propose an immutable recovery overlay through the existing transition adapter");
    const sourceBeforeProposal = await readReplicas(page);
    const proposalTransitionId = "tr_recovery_carrier_stale_source";
    let proposalResult = await proposeRecovery(page, {
      evidence: { ...EVIDENCE },
      approvedPolicy: clone(APPROVED_POLICY_V2),
      transitionId: proposalTransitionId,
      createdAt: CREATED_AT,
    });
    let proposal = proposalResult?.proposal || null;
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
    let overlay = proposalOverlay(proposal);
    let proposalBeforeMutation = clone(proposal);
    const afterProposal = await readReplicas(page);
    check(afterProposal.localRaw === sourceBeforeProposal.localRaw,
      "proposal creation causes no localStorage durable change");
    check(isDeepStrictEqual(afterProposal.idb, sourceBeforeProposal.idb),
      "proposal creation causes no IndexedDB durable change");
    check(carrierOf(afterProposal.local) == null && carrierOf(afterProposal.idb) == null,
      "proposal creation appends no recovery carrier and allocates no durable target");
    check(afterProposal.localEvidence.blockId === sourceBlockId && afterProposal.idbEvidence.blockId === sourceBlockId,
      "proposal creation leaves both live source block IDs unchanged");
    check(proposal.status === "preview" && proposal.kind === "recovery_week", "proposal is a recovery_week preview");
    check(proposal.predecessor?.programId === sourceProgramId, "proposal predecessor binds the live programId");
    check(proposal.predecessor?.durableRevision === sourceRevision, "proposal pins the live durable revision");
    check(proposal.predecessor?.blockId === sourceBlockId, "proposal.predecessor.blockId binds the live source block directly");
    check(proposal.predecessor?.fingerprint === overlay?.baseProgramFingerprint,
      "proposal predecessor fingerprint is the overlay's canonical source fingerprint");
    check(overlay?.eligibilityEvidence?.sourceBlockId === sourceBlockId, "eligibility evidence carries the same sourceBlockId");
    check(proposal.predecessor?.blockId === overlay?.eligibilityEvidence?.sourceBlockId, "predecessor.blockId equals evidence.sourceBlockId");
    check(typeof proposalTargetBlockId(proposal) === "string" && proposalTargetBlockId(proposal) !== sourceBlockId,
      "immutable proposal allocates a distinct target blockId", { sourceBlockId, targetBlockId: proposalTargetBlockId(proposal) });
    check(overlay?.activePeriod === "nextBlockWeek1", "overlay activePeriod is nextBlockWeek1");
    check(overlay?.reassessmentOutcome === null, "proposal hashes the null reassessment outcome");
    check(isDeepStrictEqual(overlay?.eligibilityEvidence?.outcomesByPattern, EVIDENCE.outcomesByPattern) &&
      Array.isArray(overlay?.eligibilityEvidence?.qualifyingPatterns),
    "proposal preserves the qualifying outcome evidence without target substitution", overlay?.eligibilityEvidence);
    check(overlay?.eligibilityEvidence?.checkpointAnswer === "Yes", "proposal retains the approved checkpoint answer");
    check(isObject(proposal.diff) && proposal.successor === undefined, "recovery proposal has no successor replacement");
    check(proposal.archiveId === undefined, "recovery preview has no archiveId");
    check(typeof proposal.proposalHash === "string" && proposal.proposalHash.length === 64, "proposal carries a proposalHash");
    check(proposalResult?._oracleFrozen?.proposal === true &&
      proposalResult?._oracleFrozen?.predecessor === true &&
      proposalResult?._oracleFrozen?.overlay === true &&
      proposalResult?._oracleFrozen?.evidence === true &&
      proposalResult?._oracleFrozen?.evidenceOutcomes === true &&
      proposalResult?._oracleFrozen?.derivation === true &&
      proposalResult?._oracleFrozen?.slotMapping === true &&
      proposalResult?._oracleFrozen?.slotMappingEntry === true &&
      proposalResult?._oracleFrozen?.entries === true &&
      proposalResult?._oracleFrozen?.firstEntry === true &&
      proposalResult?._oracleMutationUnchanged === true,
    "production proposal, evidence, derivation, and entries are deeply immutable", {
      frozen: proposalResult?._oracleFrozen,
      mutationUnchanged: proposalResult?._oracleMutationUnchanged,
    });
    check(isDeepStrictEqual(proposal, proposalBeforeMutation), "proposal snapshot is immutable to the test caller");

    console.log("\n3. Intervening revision/source change rejects the stale proposal byte-for-byte");
    const staleBefore = await readReplicas(page);
    const originalEntrySource = clone(before?.programMeta?.entrySource);
    const intervening = await page.evaluate(async ({ blockId, entrySource }) => {
      const s = window.__repforgeWorkoutDraft.state();
      s.programMeta = {
        ...s.programMeta,
        blockId: `${blockId}-intervened`,
        entrySource: { ...entrySource, fingerprint: `intervened-${entrySource.fingerprint}` },
      };
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result };
    }, { blockId: sourceBlockId, entrySource: originalEntrySource });
    check(intervening.ok, "intervening durable source/revision mutation committed", intervening);
    const staleHead = await readReplicas(page);
    check(staleHead.localEvidence.revision === staleBefore.localEvidence.revision + 1 &&
      staleHead.idbEvidence.revision === staleBefore.idbEvidence.revision + 1,
      "intervening source mutation advances both revisions exactly once");
    check(staleHead.localEvidence.blockId !== sourceBlockId && staleHead.local?.programMeta?.entrySource?.fingerprint !== originalEntrySource.fingerprint,
      "intervening mutation changes the live source block and entry fingerprint");
    const staleResult = await confirmRecovery(page, {
      proposal,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      confirmedAt: CONFIRMED_AT,
      reassessmentDueAt: REASSESSMENT_DUE_AT,
      acknowledgedDraftRaw: null,
    });
    check(staleResult?.committed !== true && staleResult?.localOk !== true && staleResult?.idbOk !== true,
      "stale recovery proposal is rejected", staleResult);
    check(staleResult?.stale === true || staleResult?.staleRevision === true ||
      ["stale_proposal", "predecessor_changed", "transition_source_changed"].includes(staleResult?.code),
      "stale recovery proposal returns a typed stale result", staleResult);
    const afterStale = await readReplicas(page);
    check(afterStale.localRaw === staleHead.localRaw,
      "stale confirmation leaves localStorage byte-identical");
    check(isDeepStrictEqual(afterStale.idb, staleHead.idb),
      "stale confirmation leaves IndexedDB byte-identical");
    check(JSON.stringify(afterStale.local?.program) === JSON.stringify(staleHead.local?.program) &&
      JSON.stringify(afterStale.local?.programHistory || []) === JSON.stringify(staleHead.local?.programHistory || []),
      "stale confirmation preserves program and history bytes");

    const restored = await page.evaluate(async ({ blockId, entrySource }) => {
      const s = window.__repforgeWorkoutDraft.state();
      s.programMeta = { ...s.programMeta, blockId, entrySource };
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result };
    }, { blockId: sourceBlockId, entrySource: originalEntrySource });
    check(restored.ok, "source identity fixture restored through the existing state seam", restored);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const sourceBeforeCommit = await readReplicas(page);
    const restoredState = await currentState(page);
    check(restoredState?.programMeta?.blockId === sourceBlockId &&
      isDeepStrictEqual(restoredState?.programMeta?.entrySource, originalEntrySource),
      "restored source identity is exact before the successful proposal");

    console.log("\n4. Active DraftV2 refuses recovery before any durable write");
    proposalResult = await proposeRecovery(page, {
      evidence: { ...EVIDENCE },
      approvedPolicy: clone(APPROVED_POLICY_V2),
      transitionId: "tr_recovery_carrier_happy_path",
      createdAt: CREATED_AT,
    });
    proposal = proposalResult?.proposal || null;
    overlay = proposalOverlay(proposal);
    proposalBeforeMutation = clone(proposal);
    check(proposalResult?.ok === true, "fresh recovery proposal is eligible after explicit stale regeneration", proposalResult);
    if (!proposal) {
      check(false, "fresh recovery proposal seam remains available after stale rejection", proposalResult);
      reportResult();
      return;
    }
    check(proposal.predecessor?.blockId === sourceBlockId, "fresh proposal predecessor.blockId binds source directly");
    check(overlay?.eligibilityEvidence?.sourceBlockId === sourceBlockId, "fresh proposal evidence sourceBlockId binds source directly");
    check(proposal.predecessor?.blockId === overlay?.eligibilityEvidence?.sourceBlockId,
      "fresh proposal source bindings are equal without fallback");
    const afterFreshProposal = await readReplicas(page);
    check(afterFreshProposal.localRaw === sourceBeforeCommit.localRaw && isDeepStrictEqual(afterFreshProposal.idb, sourceBeforeCommit.idb),
      "fresh proposal creation also causes zero durable change");
    const commitSourceRevision = sourceBeforeCommit.localEvidence.revision;
    const targetBlockId = proposalTargetBlockId(proposal);
    check(typeof targetBlockId === "string" && targetBlockId !== sourceBlockId, "fresh proposal target is distinct from source");

    const sourceFixtureDayRequest = await locateFixedFixtureDay(page, FIXED_FIXTURE_DAY_ID);
    check(sourceFixtureDayRequest?.ok === true,
      "source fixture precondition maps a known fixed-day slot to its live day label",
      sourceFixtureDayRequest);
    check(sourceFixtureDayRequest?.expectedFixtureDayId === FIXED_FIXTURE_DAY_ID,
      "source fixture request retains the fixed expected day identity",
      sourceFixtureDayRequest);
    const draftSetup = await openDraftWithEdit(page, sourceFixtureDayRequest?.requestedDayLabel);
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
    check(guardedAfter.localRaw === guardedBefore.localRaw && isDeepStrictEqual(guardedAfter.idb, guardedBefore.idb),
      "DraftV2 refusal leaves both durable replica values byte/structure-identical");
    check(guardedDraftAfter.raw === guardedDraft.raw && guardedDraftAfter.checkpoint === guardedDraft.checkpoint,
      "DraftV2 raw and checkpoint remain byte-identical after refusal");

    await clearDraft(page);
    const proposalAtCommit = await currentState(page);
    check(proposalAtCommit?._storageRevision === commitSourceRevision, "clearing the draft does not advance the program revision");

    console.log("\n5. Atomic recovery block-start commit writes one mirrored carrier record");
    const commitBefore = sourceBeforeCommit;
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
    check(exactRecoveryCommitDelta(commitBefore.local, commitAfter.local, targetBlockId),
      "local recovery commit changes only R+1, target metadata, and one carrier record");
    check(exactRecoveryCommitDelta(commitBefore.idb, commitAfter.idb, targetBlockId),
      "IndexedDB recovery commit changes only R+1, target metadata, and one carrier record");
    check(JSON.stringify(commitAfter.local?.program) === JSON.stringify(commitBefore.local?.program) &&
      JSON.stringify(commitAfter.idb?.program) === JSON.stringify(commitBefore.idb?.program),
      "recovery commit preserves exact canonical program bytes in both replicas");
    check(JSON.stringify(commitAfter.local?.programHistory || []) === JSON.stringify(commitBefore.local?.programHistory || []) &&
      JSON.stringify(commitAfter.idb?.programHistory || []) === JSON.stringify(commitBefore.idb?.programHistory || []),
      "recovery commit preserves exact programHistory bytes in both replicas");
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

    console.log("\n6. Reload/second boot is carrier-idempotent");
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

    console.log("\n7. Week-one projection is reduced and week two is canonical with null reassessment");
    const weekOneDayRequest = await locateFixedFixtureDay(page, FIXED_FIXTURE_DAY_ID);
    check(weekOneDayRequest?.ok === true,
      "week-one fixture precondition maps a known fixed-day slot to its live day label",
      weekOneDayRequest);
    check(weekOneDayRequest?.expectedFixtureDayId === FIXED_FIXTURE_DAY_ID,
      "week-one request retains the fixed expected day identity", weekOneDayRequest);
    const weekOneEntered = weekOneDayRequest?.ok
      ? await page.evaluate((requestedDayLabel) =>
        window.__repforgeEnterWorkout({ day: requestedDayLabel, focus: false }),
      weekOneDayRequest.requestedDayLabel)
      : false;
    check(weekOneEntered === true, "week-one workout opens through the production draft seam");
    const weekOneDraft = await page.evaluate(() => window.__repforgeWorkoutDraft.current());
    check(weekOneDraft?.program?.dayId === FIXED_FIXTURE_DAY_ID,
      "week-one DraftV2 program.dayId equals the fixed expected fixture day",
      { requestedDayLabel: weekOneDayRequest?.requestedDayLabel, expectedFixtureDayId: FIXED_FIXTURE_DAY_ID, actualDayId: weekOneDraft?.program?.dayId });
    const weekOneProjection = fixtureWeekOneSetCounts(weekOneDraft, FIXED_FIXTURE_DAY_ID);
    check(weekOneProjection.expectedSlotSetNonempty,
      "independent Rule-B expectation for the selected week-one day is nonempty", weekOneProjection);
    check(weekOneProjection.slotSetEqual,
      "week-one DraftV2 slot identities exactly match the selected fixture day subset", weekOneProjection);
    check(weekOneProjection.mismatches.length === 0, "week-one draft uses every Rule-B effective set count", weekOneProjection.mismatches);
    check(INDEPENDENT_WEEK_ONE_TOTAL < INDEPENDENT_CANONICAL_TOTAL,
      "independent Rule-B week-one projection is reduced relative to canonical volume",
      { effectiveTotal: INDEPENDENT_WEEK_ONE_TOTAL, baseTotal: INDEPENDENT_CANONICAL_TOTAL });
    check(weekOneDraft?.program?.blockId === proposalTargetBlockId(proposal), "week-one DraftV2 carries the target blockId");
    const afterWeekOneOpen = await readReplicas(page);
    check(JSON.stringify(afterWeekOneOpen.local?.program) === JSON.stringify(commitBefore.local?.program) &&
      JSON.stringify(afterWeekOneOpen.idb?.program) === JSON.stringify(commitBefore.idb?.program),
      "week-one projection never mutates canonical program bytes");
    await clearDraft(page);

    console.log("\n8. Two individually valid records targeting one block apply neither");
    const duplicateContext = await browser.newContext();
    const duplicatePage = await duplicateContext.newPage();
    duplicatePage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await duplicatePage.goto(BASE);
    await waitForAppBoot(duplicatePage, { base: BASE });
    await clearStorage(duplicatePage);
    await duplicatePage.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(duplicatePage, { base: BASE });
    const duplicateActivation = await activateBalancedRecommendPredecessor(duplicatePage);
    check(duplicateActivation.ok, "duplicate-target source block activated in an isolated browser context", duplicateActivation);
    const duplicateProgramAligned = await duplicatePage.evaluate(async (programId) => {
      const s = window.__repforgeWorkoutDraft.state();
      s.programMeta = { ...s.programMeta, id: programId };
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result };
    }, sourceProgramId);
    check(duplicateProgramAligned.ok,
      "duplicate-target fixture aligns both valid records to the same current program identity", duplicateProgramAligned);
    const recordBResult = await sealDuplicateTargetRecord(duplicatePage, {
      targetBlockId,
      transitionId: "tr_recovery_duplicate_target_b",
      createdAt: "2026-10-01T09:01:00.000Z",
      confirmedAt: "2026-10-01T09:13:00.000Z",
      reassessmentDueAt: REASSESSMENT_DUE_AT,
      approvedPolicy: clone(APPROVED_POLICY_V2),
      evidence: { ...EVIDENCE },
    });
    const recordB = recordBResult?.record;
    check(recordBResult?.ok === true, "second duplicate-target proposal seals independently", recordBResult);
    check(recordB?.status === "committed" && recordB?.kind === "recovery_week", "second duplicate-target record is sealed");
    check(recordB?.diff?.recoveryWeek?.blockId === targetBlockId && recordB?.diff?.recoveryWeek?.blockId !== recordB?.predecessor?.blockId,
      "second sealed record has a valid distinct source and the shared target");
    check(recordB?.predecessor?.programId === committedRecord?.predecessor?.programId,
      "both duplicate-target records bind the same program while retaining distinct source blocks");
    check(recordB?.transitionId !== committedRecord?.transitionId && recordB?.proposalHash !== committedRecord?.proposalHash,
      "duplicate-target records have distinct transition and proposal identities");
    check(committedRecord?.diff?.recoveryWeek?.blockId === recordB?.diff?.recoveryWeek?.blockId &&
      committedRecord?.diff?.recoveryWeek?.blockId !== committedRecord?.predecessor?.blockId,
      "both individually valid sealed records target the same block without source=target invalidity");
    check(committedRecord?.predecessor?.blockId !== recordB?.predecessor?.blockId,
      "duplicate-target records carry distinct source block identities");
    const duplicateSeed = await duplicatePage.evaluate(async ({ target, first, second }) => {
      const s = window.__repforgeWorkoutDraft.state();
      s.programMeta = { ...s.programMeta, blockId: target };
      s.recoveryTransitions = { schemaVersion: 1, records: [first, second], quarantine: [] };
      const result = await window.__repforgeCommitProposedState(s);
      await window.__repforgeStorage.flush();
      return { ok: result?.localOk || result?.idbOk, result };
    }, { target: targetBlockId, first: committedRecord, second: recordB });
    check(duplicateSeed.ok, "duplicate-target carrier fixture committed through the existing state seam", duplicateSeed);
    const duplicateConflictRawValue = duplicateConflictRaw(targetBlockId, [committedRecord, recordB]);
    check(duplicateConflictRawValue === duplicateConflictRaw(targetBlockId, [recordB, committedRecord]),
      "balanced duplicate-target conflict raw is independent of record arrival order",
      { rawLength: duplicateConflictRawValue.length });
    check(duplicateConflictRawValue.length > 10000,
      "balanced duplicate-target conflict is over the bounded quarantine string limit",
      { rawLength: duplicateConflictRawValue.length, limit: 10000 });
    const duplicateBeforeRecovery = await readReplicas(duplicatePage);
    await duplicatePage.reload({ waitUntil: "domcontentloaded" });
    await duplicatePage.waitForFunction(
      () => document.querySelector("#storageRecovery")?.open === true,
      undefined,
      { timeout: 15000 },
    );
    const duplicateAfterRecovery = await readReplicas(duplicatePage);
    const duplicateRecoveryMode = await duplicatePage.evaluate(() => ({
      booted: window.__repforgeBooted === true,
      recoveryOpen: document.querySelector("#storageRecovery")?.open === true,
    }));
    check(duplicateRecoveryMode.booted === false && duplicateRecoveryMode.recoveryOpen === true,
      "over-bound duplicate-target conflict enters full Storage Recovery before boot", duplicateRecoveryMode);
    check(duplicateAfterRecovery.localRaw === duplicateBeforeRecovery.localRaw,
      "over-bound duplicate-target conflict preserves localStorage bytes before choice");
    check(isDeepStrictEqual(duplicateAfterRecovery.idb, duplicateBeforeRecovery.idb),
      "over-bound duplicate-target conflict preserves IndexedDB object before choice");
    check(duplicateAfterRecovery.local?._storageRevision === duplicateBeforeRecovery.local?._storageRevision &&
      duplicateAfterRecovery.idb?._storageRevision === duplicateBeforeRecovery.idb?._storageRevision,
      "over-bound duplicate-target conflict performs no durable revision before choice");
    check(carrierRecords(duplicateAfterRecovery.local).length === 2 &&
      carrierRecords(duplicateAfterRecovery.idb).length === 2,
      "over-bound duplicate-target conflict retains the original valid records untouched");
    check(carrierOf(duplicateAfterRecovery.local)?.quarantine?.length === 0 &&
      carrierOf(duplicateAfterRecovery.idb)?.quarantine?.length === 0,
      "over-bound duplicate-target conflict adds no quarantine evidence before choice");
    check(carrierRecords(duplicateAfterRecovery.local).every((record) =>
      record.status === "committed" && record.diff?.recoveryWeek?.blockId === targetBlockId &&
      record.diff?.recoveryWeek?.blockId !== record.predecessor?.blockId),
      "over-bound duplicate-target conflict preserves each valid source/target binding");
    await duplicateContext.close();

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
    const weekTwoDayRequest = await locateFixedFixtureDay(page, FIXED_FIXTURE_DAY_ID);
    check(weekTwoDayRequest?.ok === true,
      "week-two fixture precondition maps a known fixed-day slot to its live day label",
      weekTwoDayRequest);
    check(weekTwoDayRequest?.expectedFixtureDayId === FIXED_FIXTURE_DAY_ID,
      "week-two request retains the fixed expected day identity", weekTwoDayRequest);
    check([sourceFixtureDayRequest, weekOneDayRequest, weekTwoDayRequest]
      .every((request) => request?.expectedFixtureDayId === FIXED_FIXTURE_DAY_ID),
    "all booted recovery scenarios retain the same fixed fixture day identity");
    const weekTwoEntered = weekTwoDayRequest?.ok
      ? await page.evaluate((requestedDayLabel) =>
        window.__repforgeEnterWorkout({ day: requestedDayLabel, focus: false }),
      weekTwoDayRequest.requestedDayLabel)
      : false;
    check(weekTwoEntered === true, "week-two workout opens through the production draft seam");
    const weekTwoDraft = await page.evaluate(() => window.__repforgeWorkoutDraft.current());
    check(weekTwoDraft?.program?.dayId === FIXED_FIXTURE_DAY_ID,
      "week-two DraftV2 program.dayId equals the fixed expected fixture day",
      { requestedDayLabel: weekTwoDayRequest?.requestedDayLabel, expectedFixtureDayId: FIXED_FIXTURE_DAY_ID, actualDayId: weekTwoDraft?.program?.dayId });
    const weekTwoCanonical = fixtureCanonicalSetCounts(weekTwoDraft, FIXED_FIXTURE_DAY_ID);
    check(weekTwoCanonical.expectedSlotSetNonempty,
      "independent canonical expectation for the selected week-two day is nonempty", weekTwoCanonical);
    check(weekTwoCanonical.slotSetEqual,
      "week-two DraftV2 slot identities exactly match the selected fixture day", weekTwoCanonical);
    check(weekTwoCanonical.mismatches.length === 0, "week two restores the canonical prescription even while unanswered", weekTwoCanonical.mismatches);
    check(carrierRecords(weekTwoState)[0]?.diff?.recoveryWeek?.reassessmentOutcome === null,
      "week two remains canonical with a persisted null reassessmentOutcome");
    check(JSON.stringify(weekTwoState?.program) === JSON.stringify(commitBefore.local?.program),
      "week-two baseline is the independent canonical fixture, not a mutated post-commit program");
    await clearDraft(page);

    console.log("\n9. Two browser contexts race one outcome-only reassessment CAS");
    const reassessmentDraft = await openDraftWithEdit(page, weekTwoDayRequest?.requestedDayLabel, "draft must survive reassessment");
    check(reassessmentDraft.ok, "a live DraftV2 is available while reassessment is submitted", reassessmentDraft);
    const reassessBefore = await readReplicas(page);
    const reassessRecordBefore = carrierRecords(reassessBefore.local)[0];
    const reassessDraftBefore = await draftBytes(page);
    const expectedRevision = reassessBefore.localEvidence.revision;
    const reassessArgs = {
      expectedRevision,
      blockId: targetBlockId,
      transitionId: proposal.transitionId,
      proposalHash: proposal.proposalHash,
      acknowledgedRecord: reassessRecordBefore,
      outcome: "About the same",
    };
    const reassessmentPageB = await context.newPage();
    reassessmentPageB.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await reassessmentPageB.goto(BASE);
    await waitForAppBoot(reassessmentPageB, { base: BASE });
    const [reassessResultA, reassessResultB] = await Promise.all([
      reassessRecovery(page, reassessArgs),
      reassessRecovery(reassessmentPageB, reassessArgs),
    ]);
    const reassessmentResults = [reassessResultA, reassessResultB];
    const winners = reassessmentResults.filter((result) => result?.committed === true && (result?.localOk || result?.idbOk));
    const losers = reassessmentResults.filter((result) => !result?.committed || (!result?.localOk && !result?.idbOk));
    check(winners.length === 1 && losers.length === 1,
      "concurrent reassessment has exactly one winner and one loser", reassessmentResults);
    check(losers.length === 1 &&
      (losers[0]?.code === "recovery_reassessment_closed" || losers[0]?.code === "stale" || losers[0]?.stale === true),
      "concurrent reassessment loser is stale or recovery_reassessment_closed", reassessmentResults);
    await flush(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
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
    await clearDraft(page);

    console.log("\n10. Legacy current block is recovery-ineligible");
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
    check(legacyBefore.local?.programMeta?.blockId == null && legacyBefore.idb?.programMeta?.blockId == null,
      "legacy control has no current blockId in either replica", {
        local: legacyBefore.local?.programMeta?.blockId,
        idb: legacyBefore.idb?.programMeta?.blockId,
      });
    const legacyResult = await proposeRecovery(legacyPage, {
      evidence: { ...EVIDENCE, sourceBlockId: null },
      approvedPolicy: clone(APPROVED_POLICY_V2),
      transitionId: "tr_recovery_legacy_source_negative",
      createdAt: CREATED_AT,
    });
    check(legacyResult?.ok !== true, "legacy current block is refused before recovery proposal");
    check(legacyResult?.code === "legacy_block_ineligible",
      "legacy refusal is specifically legacy_block_ineligible", legacyResult);
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
