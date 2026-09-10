#!/usr/bin/env node
/**
 * Plan 052-R5b1: recovery-carrier corruption/quarantine classification oracle.
 *
 * This is one production-backed browser file for the R5b1 slice. It starts
 * from a real compiler-backed predecessor and obtains valid recovery records
 * from RepForgeProgramTransition, then exercises the public boot/storage
 * boundary with bounded parsed values. It does not call normalizeLoaded or
 * any other private app function.
 *
 * Independent expected results:
 *   - docs/block-transition-provenance.md and docs/recovery-week-policy.md
 *     own carrier classification, limits, quarantine shape, source semantics,
 *     and the no-union rule;
 *   - test/fixtures/program-families-v1.json plus the executable policy parser
 *     independently supply canonical and Rule-B per-slot prescriptions;
 *   - Node crypto independently computes every expected SHA-256 digest.
 *   - a bounded known-schema malformed candidate is omitted while the
 *     canonical projection remains, and its exact v1 quarantine entry is
 *     persisted, deduplicated by digest+reason, and source-attributed;
 *   - two independently valid records from a small real compiler-backed
 *     predecessor remain retained but apply neither, with one independently
 *     sorted/hash-computed conflict bundle;
 *   - the real normalized producer pair is measured as an over-bound conflict
 *     bundle and must preserve both replicas through full storage recovery;
 *   - unknown required policy versions, unknown schemas, over-bound values,
 *     and malformed quarantine containers preserve both replicas byte-for-
 *     byte and open the existing full Storage Recovery boundary.
 *
 * Correction checkpoint coverage: R5B1-DUP-001, R5B1-Q-002,
 * R5B1-DEDUPE-003, R5B1-UNKNOWN-004, R5B1-SOURCE-005, R5B1-INDEP-006,
 * R5B1-CLASSIFIER-007, R5B1-REVISION-008, and R5B1-DIGEST-009.
 *
 * Intended failure cases on the published R5a head:
 *   - bounded known-schema malformed candidates are routed to full storage
 *     recovery instead of normalized/quarantined;
 *   - persistent quarantine warning/deduplication/source attribution is
 *     absent;
 *   - duplicate-target conflict evidence is not quarantined or retained;
 *   - the carrier classification does not preserve exact replica equality or
 *     full-recovery bytes for unknown required policy data;
 *   - the existing full-recovery cases and replica no-union boundary must stay
 *     green while the R5b1 behavior is added;
 *   - a bounded semantic corruption that the authoritative transition validator
 *     rejects is still omitted/quarantined at the public boot boundary; and
 *   - known-malformed normalization advances both durable revisions exactly
 *     once, then leaves the full normalized state unchanged on second boot.
 *
 * Completion barrier: this file turns green at the R5b1 implementation head
 * without production, shared suite/catalog, docs, cache, or generated edits.
 * A missing warning surface is reported as a product assertion; this oracle
 * does not invent a UI. The contract defines quarantine presence as the
 * persistent warning state, with #storageDegraded observed when applicable.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { applyRuleB, parseExecutablePolicy } from "../tools/recovery-policy-contract.mjs";

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8162/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";
const STORE_NAME = "kv";
const CREATED_AT = "2026-10-01T09:00:00.000Z";
const CONFIRMED_AT = "2026-10-01T09:12:00.000Z";
const REASSESSMENT_DUE_AT = "2026-10-08T09:12:00.000Z";
const MALFORMED_DETECTED_AT = "2026-10-01T09:30:00.000Z";
const EXPECTED_BOUNDED_CONFLICT_RAW_LENGTH = 9949;
const EXPECTED_OVER_BOUND_CONFLICT_RAW_LENGTH = 16033;

const APPROVED_POLICY_V2 = parseExecutablePolicy(
  readFileSync(new URL("../docs/recovery-week-policy.md", import.meta.url), "utf8"),
);
const PROGRAM_FAMILY_FIXTURE = JSON.parse(
  readFileSync(new URL("./fixtures/program-families-v1.json", import.meta.url), "utf8"),
);
const BALANCED_4_FIXTURE = PROGRAM_FAMILY_FIXTURE.reviewCompilations.find(
  (compilation) => compilation.blueprintId === "balanced_4_v1",
);
if (!BALANCED_4_FIXTURE) throw new Error("balanced_4_v1 fixture is required by the corruption oracle");
const FIXED_FIXTURE_DAY = BALANCED_4_FIXTURE.days[0];
const FIXED_FIXTURE_DAY_ID = FIXED_FIXTURE_DAY?.dayId;
const FIXED_FIXTURE_SLOT_IDS = (FIXED_FIXTURE_DAY?.slots || []).map((slot) => slot.slotId);
if (typeof FIXED_FIXTURE_DAY_ID !== "string" || FIXED_FIXTURE_SLOT_IDS.length === 0) {
  throw new Error("balanced_4_v1 first day and slot identities are required by the corruption oracle");
}
const BALANCED_4_SLOTS = BALANCED_4_FIXTURE.days.flatMap((day) => day.slots);
const BALANCED_4_RULE_B = applyRuleB(
  BALANCED_4_SLOTS.map((slot) => ({
    templateId: slot.templateId,
    status: slot.status,
    sets: slot.sets,
  })),
  { ...APPROVED_POLICY_V2, slotContracts: PROGRAM_FAMILY_FIXTURE.slotContracts },
);
const WEEK_ONE_BY_SLOT = new Map(
  BALANCED_4_SLOTS.map((slot, index) => [slot.slotId, BALANCED_4_RULE_B.effective[index]]),
);
const EXPECTED_CANONICAL = new Map(
  FIXED_FIXTURE_DAY.slots.map((slot) => [slot.slotId, slot.sets]),
);
const EXPECTED_WEEK_ONE = new Map(
  FIXED_FIXTURE_DAY.slots.map((slot) => [slot.slotId, WEEK_ONE_BY_SLOT.get(slot.slotId)]),
);
const BOUNDED_DUPLICATE_FIXTURE = PROGRAM_FAMILY_FIXTURE.reviewCompilations.find(
  (compilation) => compilation.blueprintId === "strength_2_v1",
);
if (!BOUNDED_DUPLICATE_FIXTURE) throw new Error("strength_2_v1 fixture is required by the bounded duplicate oracle");
const BOUNDED_DUPLICATE_DAY = BOUNDED_DUPLICATE_FIXTURE.days[0];
const BOUNDED_DUPLICATE_DAY_SLOTS = BOUNDED_DUPLICATE_DAY.slots.filter((slot) => slot.status !== "optional");
const BOUNDED_DUPLICATE_EXPECTATIONS = {
  dayId: BOUNDED_DUPLICATE_DAY.dayId,
  slotIds: BOUNDED_DUPLICATE_DAY_SLOTS.map((slot) => slot.slotId),
  canonical: new Map(BOUNDED_DUPLICATE_DAY_SLOTS.map((slot) => [slot.slotId, slot.sets])),
};

const results = { passed: 0, failed: 0, harnessFailed: 0, failures: [] };
const QUARANTINE_V1_KEYS = ["schemaVersion", "digest", "raw", "sourceReplica", "detectedAt", "reason"];

function check(condition, message, detail, classification = "product") {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${message}`);
    return true;
  }
  results.failed++;
  if (classification === "harness") results.harnessFailed++;
  results.failures.push({ message, classification });
  console.error(`  ✗ ${message} [${classification}]`);
  if (detail !== undefined) {
    console.error(`    Detail: ${typeof detail === "object" ? JSON.stringify(detail, null, 2) : detail}`);
  }
  return false;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sha256Utf8(raw) {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function quarantineEntry(raw, sourceReplica = "both", detectedAt = MALFORMED_DETECTED_AT, reason = "known-schema-malformed-recovery") {
  return {
    schemaVersion: 1,
    digest: sha256Utf8(raw),
    raw,
    sourceReplica,
    detectedAt,
    reason,
  };
}

function carrierOf(snapshot) {
  return snapshot?.recoveryTransitions ?? null;
}

function recordsOf(snapshot) {
  return Array.isArray(carrierOf(snapshot)?.records) ? carrierOf(snapshot).records : [];
}

function stateWithCarrier(base, carrier, blockId = base?.programMeta?.blockId) {
  const state = clone(base);
  state.programMeta = { ...state.programMeta, ...(blockId === undefined ? {} : { blockId }) };
  if (carrier === undefined) delete state.recoveryTransitions;
  else state.recoveryTransitions = clone(carrier);
  return state;
}

function stateRevision(state) {
  return Number.isInteger(state?._storageRevision) ? state._storageRevision : 0;
}

function incrementedState(state) {
  const next = clone(state);
  next._storageRevision = stateRevision(state) + 1;
  return next;
}

function recordTarget(record) {
  return record?.diff?.recoveryWeek?.blockId ?? null;
}

function sortedConflictRecords(records) {
  const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  return [...records].sort((a, b) => {
    const proposalOrder = compare(String(a?.proposalHash || ""), String(b?.proposalHash || ""));
    return proposalOrder || compare(String(a?.transitionId || ""), String(b?.transitionId || ""));
  });
}

function expectedConflictRaw(targetBlockId, records) {
  return JSON.stringify({ targetBlockId, records: sortedConflictRecords(records) });
}

function exactQuarantineKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...QUARANTINE_V1_KEYS].sort());
}

function exactQuarantineEntry(value, expected) {
  return exactQuarantineKeys(value) && QUARANTINE_V1_KEYS.every((key) => value[key] === expected[key]);
}

async function idbRead(page) {
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

async function idbWrite(page, value) {
  await page.evaluate(async ({ dbName, storeName, key, value: next }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(next, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { dbName: DB_NAME, storeName: STORE_NAME, key: KEY, value });
}

async function readReplicas(page) {
  const localRaw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  let local = null;
  try { local = localRaw == null ? null : JSON.parse(localRaw); } catch { local = null; }
  return { localRaw, local, idb: await idbRead(page) };
}

async function seedReplicas(page, localValue, idbValue = localValue, localRaw = JSON.stringify(localValue)) {
  await page.evaluate(({ key, raw, draftKey, checkpointKey }) => {
    localStorage.setItem(key, raw);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
  }, { key: KEY, raw: localRaw, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
  await idbWrite(page, idbValue);
}

async function clearStorage(page) {
  await page.evaluate(async ({ key, draftKey, checkpointKey, dbName }) => {
    localStorage.removeItem(key);
    localStorage.removeItem(draftKey);
    localStorage.removeItem(checkpointKey);
    localStorage.removeItem("repforge_program_setup_draft_v1");
    localStorage.setItem("repforge_ui_v1", JSON.stringify({ tourDone: true }));
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = resolve;
      request.onblocked = resolve;
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, dbName: DB_NAME });
}

async function activateBalancedPredecessor(page, options = {}) {
  return page.evaluate(async (input) => {
    if (!window.RepForgeProgramEntryAdapter || !window.RepForgeProgramCompiler) {
      return { ok: false, code: "compiler_or_entry_adapter_missing" };
    }
    const desiredResult = input.desiredResult || "balanced";
    const structuredExperience = input.structuredExperience || "6_to_24m";
    const daysPerWeek = input.daysPerWeek || 4;
    const sessionMinutes = input.sessionMinutes || 90;
    const preferredRestSeconds = input.preferredRestSeconds || 90;
    const environment = input.environment || { kind: "commercial_gym" };
    const services = window.RepForgeProgramEntryAdapter.createProductionServices({
      Compiler: window.RepForgeProgramCompiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const compiled = services.compile({
      mode: "recommend",
      answers: {
        desiredResult,
        structuredExperience,
        recentConsistency: "most",
        daysPerWeek,
        sessionMinutes,
        preferredRestSeconds,
        environment,
        primaryMuscles: [],
        deEmphasizedMuscles: [],
        ignoredMuscles: [],
        priorityMovements: [],
        mustHaveExercises: [],
        exerciseConstraints: [],
      },
      versions: services.currentVersions(),
    });
    if (!compiled.ok) return { ok: false, code: "compilation_failed", issues: compiled.issues };
    const baseProposal = window.__repforgeWorkoutDraft.state();
    baseProposal.programMeta = baseProposal.programMeta || {};
    baseProposal.programMeta.progressionRelations = JSON.parse(JSON.stringify(compiled.preview.progressionRelations || []));
    baseProposal.programMeta.progressionModifiers = [];
    baseProposal.programMeta.progressionIncompatibilities = [];
    baseProposal.programMeta.programStructure = JSON.parse(JSON.stringify(compiled.preview.programStructure));
    baseProposal.programMeta.compilerContext = JSON.parse(JSON.stringify(compiled.compilerContext));
    const finalized = await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: compiled.name || input.name || "Balanced predecessor",
      answers: { goal: input.goal || "strength_hypertrophy", daysPerWeek },
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
  }, options);
}

async function buildValidRecord(page, {
  transitionId,
  targetBlockId,
  createdAt = CREATED_AT,
  confirmedAt = CONFIRMED_AT,
  reassessmentDueAt = REASSESSMENT_DUE_AT,
  approvedPolicy = APPROVED_POLICY_V2,
} = {}) {
  return page.evaluate(async (input) => {
    const Transition = window.RepForgeProgramTransition;
    const Compiler = window.RepForgeProgramCompiler;
    const catalogue = window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY;
    const snapshot = window.__repforgeWorkoutDraft?.state?.();
    const sourceBlockId = snapshot?.programMeta?.blockId;
    const context = snapshot?.programMeta?.compilerContext;
    if (!Transition || !Compiler || !sourceBlockId || !context) {
      return { ok: false, code: "valid-record_setup_missing" };
    }
    const predecessorInstance = Compiler.compile(context, catalogue);
    const result = await Transition.proposeRecoveryWeek({
      predecessorInstance,
      predecessor: {
        programId: snapshot.programMeta.id,
        blockId: sourceBlockId,
        durableRevision: snapshot._storageRevision,
        source: "Recommend",
        compilerProvenance: snapshot.programMeta.programStructure?.provenance,
      },
      approvedPolicy: input.approvedPolicy,
      evidence: {
        sourceBlockId,
        outcomesByPattern: { "knee-dominant": "maintained", "horizontal press": "declined" },
        checkpointAnswer: "Yes",
      },
      transitionId: input.transitionId,
      blockId: input.targetBlockId,
      createdAt: input.createdAt,
      supportedVersions: Compiler.VERSIONS,
      existingRecoveryRecords: [],
    });
    if (!result?.ok) return { ok: false, code: result?.code || "valid-record_proposal_failed", result };
    try {
      const record = Transition.commitRecord(result.proposal, {
        confirmedAt: input.confirmedAt,
        reassessmentDueAt: input.reassessmentDueAt,
        archiveId: null,
      });
      return { ok: true, sourceBlockId, proposal: result.proposal, record };
    } catch (error) {
      return { ok: false, code: "valid-record_commit_failed", error: String(error?.message || error) };
    }
  }, { transitionId, targetBlockId, createdAt, confirmedAt, reassessmentDueAt, approvedPolicy: clone(approvedPolicy) });
}

async function alignProgramIdentity(page, programId, blockId = undefined) {
  return page.evaluate(async ({ nextProgramId, nextBlockId }) => {
    const hook = window.__repforgeWorkoutDraft;
    if (!hook || typeof window.__repforgeCommitProposedState !== "function" ||
      !window.__repforgeStorage?.flush) {
      return { ok: false, code: "program-identity-alignment_seam_missing" };
    }
    const snapshot = hook.state();
    const programMeta = { ...snapshot.programMeta, id: nextProgramId };
    if (nextBlockId !== undefined) programMeta.blockId = nextBlockId;
    const proposal = { ...snapshot, programMeta };
    const result = await window.__repforgeCommitProposedState(proposal);
    await window.__repforgeStorage.flush();
    return {
      ok: result?.localOk || result?.idbOk,
      liveProgramId: window.__repforgeWorkoutDraft.state()?.programMeta?.id,
      liveBlockId: window.__repforgeWorkoutDraft.state()?.programMeta?.blockId,
      result,
    };
  }, { nextProgramId: programId, nextBlockId: blockId });
}

async function validateRecordAgainstLive(page, record, approvedPolicy = APPROVED_POLICY_V2) {
  return page.evaluate(async ({ record: candidate, approvedPolicy: policy }) => {
    const Transition = window.RepForgeProgramTransition;
    const Compiler = window.RepForgeProgramCompiler;
    const catalogue = window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY;
    const snapshot = window.__repforgeWorkoutDraft?.state?.();
    if (!Transition || !Compiler || !snapshot?.programMeta?.compilerContext) {
      return { ok: false, code: "record-validation_seam_missing" };
    }
    let predecessorInstance;
    try {
      predecessorInstance = Compiler.compile(snapshot.programMeta.compilerContext, catalogue);
    } catch (error) {
      return { ok: false, code: "record-validation_compile_failed", error: String(error?.message || error) };
    }
    const validation = await Transition.validateRecoveryRecord(candidate, {
      predecessor: candidate?.predecessor,
      predecessorInstance,
      approvedPolicy: policy,
      supportedVersions: Compiler.VERSIONS,
      existingRecoveryRecords: [],
    });
    return {
      ok: validation?.ok === true,
      code: validation?.code,
      liveProgramId: snapshot.programMeta.id,
      predecessorProgramId: candidate?.predecessor?.programId,
      sourceBlockId: candidate?.predecessor?.blockId,
      targetBlockId: candidate?.diff?.recoveryWeek?.blockId,
    };
  }, { record: clone(record), approvedPolicy: clone(approvedPolicy) });
}

async function observeProjection(page, expectations = {}) {
  return page.evaluate(async ({ expectedDayId, slotIds }) => {
    const hook = window.__repforgeWorkoutDraft;
    const snapshot = hook?.state?.();
    const liveRow = (snapshot?.program || []).find((row) => slotIds.includes(String(row?.slotId || row?.id || "")));
    if (!hook || typeof window.__repforgeEnterWorkout !== "function" || !liveRow?.day) {
      return { ok: false, code: "projection_seam_missing", expectedDayId, liveDayId: liveRow?.dayId ?? null };
    }
    const entered = await window.__repforgeEnterWorkout({ day: liveRow.day, focus: false });
    const draft = hook.current?.();
    const rows = [];
    for (const exerciseId of draft?.exerciseOrder || []) {
      const exercise = draft.exercises?.[exerciseId];
      rows.push({ slotId: String(exercise?.sourceExerciseId || ""), sets: exercise?.programmed?.sets ?? null });
    }
    await hook.clear?.();
    await hook.flush?.();
    window.__repforgeLeaveWorkout?.();
    return {
      ok: entered === true,
      expectedDayId,
      draftDayId: draft?.program?.dayId ?? null,
      rows,
      blockId: draft?.program?.blockId ?? null,
    };
  }, {
    expectedDayId: expectations.dayId || FIXED_FIXTURE_DAY_ID,
    slotIds: expectations.slotIds || FIXED_FIXTURE_SLOT_IDS,
  });
}

function projectionMatches(observed, expected, expectedDayId = FIXED_FIXTURE_DAY_ID) {
  if (!observed?.ok || observed.draftDayId !== expectedDayId) return false;
  const actual = observed.rows || [];
  const expectedRows = [...expected].filter(([, sets]) => sets > 0);
  return actual.length === expectedRows.length && expectedRows.every(([slotId, sets], index) =>
    actual[index]?.slotId === slotId && actual[index]?.sets === sets
  );
}

async function openCleanPage(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await clearStorage(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page };
}

async function waitForReadyOrRecovery(page) {
  await page.waitForFunction(
    () => window.__repforgeBooted === true || document.querySelector("#storageRecovery")?.open === true,
    { timeout: 15000 },
  );
  return page.evaluate(() => ({
    booted: window.__repforgeBooted === true,
    recoveryOpen: document.querySelector("#storageRecovery")?.open === true,
  }));
}

async function observeReadyOrRecovery(page, timeout = 5000) {
  let timedOut = false;
  try {
    await page.waitForFunction(
      () => window.__repforgeBooted === true || document.querySelector("#storageRecovery")?.open === true,
      { timeout },
    );
  } catch {
    timedOut = true;
  }
  return {
    ...await page.evaluate(() => ({
      booted: window.__repforgeBooted === true,
      recoveryOpen: document.querySelector("#storageRecovery")?.open === true,
    })),
    timedOut,
  };
}

async function storageRecoveryState(page) {
  return page.evaluate(() => ({
    booted: window.__repforgeBooted === true,
    open: document.querySelector("#storageRecovery")?.open === true,
    degradedWarning: (() => {
      const el = document.querySelector("#storageDegraded");
      return !!el && !el.hidden && !el.classList.contains("hidden") && !!el.textContent?.trim();
    })(),
  }));
}

async function assertFullRecoveryPreserves(page, localRaw, idbValue, label) {
  const mode = await waitForReadyOrRecovery(page);
  const after = await readReplicas(page);
  check(mode.booted === false, `${label}: boot remains incomplete before recovery choice`, mode);
  check(mode.recoveryOpen === true, `${label}: existing Storage Recovery dialog is open`, mode);
  check(after.localRaw === localRaw, `${label}: localStorage bytes remain exact before choice`, {
    expectedLength: localRaw.length,
    actualLength: after.localRaw?.length,
  });
  check(isDeepStrictEqual(after.idb, idbValue), `${label}: IndexedDB object remains exact before choice`);
  check(after.localRaw === localRaw && isDeepStrictEqual(after.idb, idbValue), `${label}: zero durable writes occur before user choice`);
}

async function malformedCarrierScenario(browser, base, validRecord) {
  console.log("\n3. Bounded known-schema malformed record is quarantined, warned, and canonical");
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const malformed = clone(validRecord);
  malformed.diff.recoveryWeek.entries = [];
  const malformedRaw = JSON.stringify(malformed);
  const carrier = { schemaVersion: 1, records: [malformed], quarantine: [] };
  const seeded = incrementedState(stateWithCarrier(base, carrier, recordTarget(validRecord)));
  const seedRevision = stateRevision(seeded);
  const expectedNormalizationRevision = seedRevision + 1;
  await seedReplicas(page, seeded, seeded);
  await page.reload({ waitUntil: "domcontentloaded" });
  const mode = await waitForReadyOrRecovery(page);
  const after = await readReplicas(page);
  const expectedDigest = sha256Utf8(malformedRaw);
  check(mode.booted === true, "bounded malformed carrier boots without full recovery dialog", mode);
  check(mode.recoveryOpen === false, "bounded malformed carrier does not open full Storage Recovery", mode);
  if (mode.booted) {
    const state = after.local;
    const records = recordsOf(state);
    const quarantine = carrierOf(state)?.quarantine || [];
    check(records.length === 0, "malformed record is omitted from normalized records", records);
    check(quarantine.length === 1, "malformed candidate creates exactly one quarantine v1 entry", quarantine);
    const entry = quarantine[0];
    check(entry?.schemaVersion === 1 && entry?.raw === malformedRaw && entry?.digest === expectedDigest,
      "malformed quarantine preserves parsed-own-data raw and Node SHA-256 digest", entry);
    check(exactQuarantineKeys(entry),
      "malformed quarantine closes exactly over the published v1 keys", entry);
    check(entry?.sourceReplica === "both" && entry?.reason === "known-schema-malformed-recovery",
      "malformed quarantine records exact both-replica source and reason", entry);
    check(typeof entry?.detectedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.detectedAt),
      "malformed quarantine detectedAt is canonical ISO-8601", entry?.detectedAt);
    const projection = await observeProjection(page);
    check(projectionMatches(projection, EXPECTED_CANONICAL),
      "malformed record falls back to the independent canonical prescription", projection);
    const warning = await storageRecoveryState(page);
    check(quarantine.length > 0 || warning.degradedWarning,
      "persistent malformed-data warning is observable at the reviewed storage boundary", warning);
    check(isDeepStrictEqual(after.idb?.recoveryTransitions, state?.recoveryTransitions),
      "malformed normalized carrier is mirrored without recursive record union");
    check(isDeepStrictEqual(after.local, after.idb),
      "malformed normalized localStorage and IndexedDB snapshots are exactly equal");
    check(after.local?._storageRevision === expectedNormalizationRevision &&
      after.idb?._storageRevision === expectedNormalizationRevision,
    "known-malformed normalization advances both durable revisions exactly once", {
      seedRevision,
      expectedNormalizationRevision,
      localRevision: after.local?._storageRevision,
      idbRevision: after.idb?._storageRevision,
    });
    check(isDeepStrictEqual(after.local?.programHistory, seeded.programHistory) &&
      isDeepStrictEqual(after.idb?.programHistory, seeded.programHistory) &&
      after.local?.programMeta?.transitionIn == null && after.idb?.programMeta?.transitionIn == null,
    "known-malformed normalization creates no archive or replacement transition");
    const firstDetectedAt = entry?.detectedAt;
    const firstNormalized = clone(after.local);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const reloaded = await readReplicas(page);
    const reloadedEntry = reloaded.local?.recoveryTransitions?.quarantine?.[0];
    check(reloaded.local?.recoveryTransitions?.quarantine?.length === 1 &&
      reloadedEntry?.raw === malformedRaw && reloadedEntry?.digest === expectedDigest &&
      reloadedEntry?.reason === "known-schema-malformed-recovery" && reloadedEntry?.detectedAt === firstDetectedAt,
    "first quarantine raw/digest/reason/detectedAt is stable across reload");
    check(isDeepStrictEqual(reloaded.local?.recoveryTransitions, reloaded.idb?.recoveryTransitions),
      "reloaded malformed quarantine remains exactly mirrored in both replicas");
    check(reloaded.local?._storageRevision === expectedNormalizationRevision &&
      reloaded.idb?._storageRevision === expectedNormalizationRevision &&
      isDeepStrictEqual(reloaded.local, firstNormalized) &&
      isDeepStrictEqual(reloaded.idb, firstNormalized),
    "second boot performs zero durable writes and retains the exact normalized state", {
      expectedNormalizationRevision,
      localRevision: reloaded.local?._storageRevision,
      idbRevision: reloaded.idb?._storageRevision,
    });
  } else {
    check(false, "malformed candidate is not misclassified as unknown/full-recovery data");
    check(false, "malformed candidate normalizes to zero valid records and one quarantine entry");
    check(false, "malformed candidate exposes the canonical prescription and persistent warning");
  }
  await context.close();
  return { malformed, malformedRaw, expectedDigest };
}

async function semanticMalformedCarrierScenario(browser, base, validRecord) {
  console.log("\n3b. Bounded semantic corruption is quarantined instead of silently retained");
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  await seedReplicas(page, base, base);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });

  const malformed = clone(validRecord);
  malformed.diff.recoveryWeek.baseProgramFingerprint = 123;
  const validation = await validateRecordAgainstLive(page, malformed);
  check(validation.ok === false && validation.code === "base_fingerprint_mismatch",
    "authoritative Transition.validateRecoveryRecord rejects the bounded semantic corruption",
    validation, "harness");
  if (validation.ok || validation.code !== "base_fingerprint_mismatch") {
    throw new Error("HARNESS FAILURE: semantic corruption was not independently rejected by the authoritative validator");
  }

  const malformedRaw = JSON.stringify(malformed);
  const expectedDigest = sha256Utf8(malformedRaw);
  const carrier = { schemaVersion: 1, records: [malformed], quarantine: [] };
  const seeded = incrementedState(stateWithCarrier(base, carrier, recordTarget(validRecord)));
  await seedReplicas(page, seeded, seeded);
  await page.reload({ waitUntil: "domcontentloaded" });
  const mode = await waitForReadyOrRecovery(page);
  const after = await readReplicas(page);
  check(mode.booted === true, "semantic malformed carrier boots without full recovery", mode);
  check(mode.recoveryOpen === false, "semantic malformed carrier does not open full Storage Recovery", mode);
  if (mode.booted) {
    const state = after.local;
    const quarantine = carrierOf(state)?.quarantine || [];
    const entry = quarantine[0];
    check(recordsOf(state).length === 0 && recordsOf(after.idb).length === 0,
      "semantic malformed record is omitted from both normalized replicas", {
        localRecords: recordsOf(state).length,
        idbRecords: recordsOf(after.idb).length,
      });
    check(quarantine.length === 1,
      "semantic malformed candidate creates exactly one quarantine v1 warning entry", quarantine);
    check(exactQuarantineEntry(entry, {
      schemaVersion: 1,
      digest: expectedDigest,
      raw: malformedRaw,
      sourceReplica: "both",
      detectedAt: entry?.detectedAt,
      reason: "known-schema-malformed-recovery",
    }) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry?.detectedAt || ""),
    "semantic malformed quarantine preserves exact raw/digest/source/reason and canonical time", entry);
    const warning = await storageRecoveryState(page);
    check(quarantine.length === 1 && warning.booted === true && warning.open === false,
      "semantic malformed quarantine remains the persistent warning while boot stays available", warning);
    const projection = await observeProjection(page);
    check(projectionMatches(projection, EXPECTED_CANONICAL),
      "semantic malformed record falls back to the independent canonical prescription", projection);
    check(isDeepStrictEqual(after.local, after.idb),
      "semantic malformed normalization mirrors exact localStorage and IndexedDB snapshots");
  } else {
    check(false, "semantic malformed candidate is not misclassified as full-recovery data");
    check(false, "semantic malformed candidate normalizes to zero valid records and one quarantine warning");
    check(false, "semantic malformed candidate exposes the canonical prescription");
  }
  await context.close();
}

async function digestFailureScenario(browser, base, validRecord) {
  console.log("\n3c. Recovery digest failure fails closed into untouched full storage recovery");
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  page.on("pageerror", (error) => pageErrors.push(String(error?.message || error)));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  const malformed = clone(validRecord);
  malformed.diff.recoveryWeek.entries = [];
  const malformedRaw = JSON.stringify(malformed);
  const carrier = { schemaVersion: 1, records: [malformed], quarantine: [] };
  const seeded = incrementedState(stateWithCarrier(base, carrier, recordTarget(validRecord)));
  const localRaw = JSON.stringify(seeded);
  const seedRevision = stateRevision(seeded);
  await seedReplicas(page, seeded, seeded, localRaw);
  await page.addInitScript((targetRaw) => {
    const target = new TextEncoder().encode(targetRaw);
    const originalDigest = crypto.subtle.digest.bind(crypto.subtle);
    const sameBytes = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
    window.__repforgeRecoveryDigestRejectionHits = 0;
    Object.defineProperty(crypto.subtle, "digest", {
      configurable: true,
      value: async (algorithm, data) => {
        const bytes = new Uint8Array(data);
        if ((algorithm === "SHA-256" || algorithm?.name === "SHA-256") && sameBytes(bytes, target)) {
          window.__repforgeRecoveryDigestRejectionHits += 1;
          throw new Error("injected recovery digest failure");
        }
        return originalDigest(algorithm, data);
      },
    });
  }, malformedRaw);
  await page.reload({ waitUntil: "domcontentloaded" });
  const mode = await observeReadyOrRecovery(page);
  const digestHits = await page.evaluate(() => window.__repforgeRecoveryDigestRejectionHits || 0);
  check(digestHits > 0,
    "digest-failure harness actually rejects the known-malformed candidate digest",
    { digestHits, malformedRawLength: malformedRaw.length }, "harness");
  if (digestHits < 1) {
    throw new Error("HARNESS FAILURE: injected recovery digest rejection did not fire");
  }
  const after = await readReplicas(page);
  check(mode.booted === false && mode.recoveryOpen === true && pageErrors.length === 0,
    "digest failure opens full Storage Recovery without an uncaught page error or unusable boot",
    { mode, pageErrors });
  check(after.localRaw === localRaw && isDeepStrictEqual(after.idb, seeded) &&
    after.local?._storageRevision === seedRevision && after.idb?._storageRevision === seedRevision,
  "digest failure preserves both replica bytes and performs zero durable writes", {
    localRawExact: after.localRaw === localRaw,
    idbExact: isDeepStrictEqual(after.idb, seeded),
    seedRevision,
    localRevision: after.local?._storageRevision,
    idbRevision: after.idb?._storageRevision,
  });
  await context.close();
}

async function repeatDetectionScenario(browser, base, validRecord, malformedRaw, expectedDigest) {
  console.log("\n4. Repeat detection matrix dedupes by digest/reason and never auto-prunes");
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const malformed = clone(validRecord);
  malformed.diff.recoveryWeek.entries = [];
  const first = quarantineEntry(malformedRaw, "localStorage", MALFORMED_DETECTED_AT);
  const sameDigestSameReason = quarantineEntry(
    malformedRaw,
    "indexedDB",
    "2026-10-02T09:30:00.000Z",
  );
  const sameDigestDifferentReason = quarantineEntry(
    malformedRaw,
    "both",
    "2026-10-03T09:30:00.000Z",
    "duplicate-target-conflict",
  );
  const distinctRaw = JSON.stringify({ schemaVersion: 1, marker: "r5b1-distinct-quarantine" });
  const distinctDigest = quarantineEntry(distinctRaw, "both", "2026-10-04T09:30:00.000Z");
  const carrier = {
    schemaVersion: 1,
    records: [malformed],
    quarantine: [first, sameDigestSameReason, sameDigestDifferentReason, distinctDigest],
  };
  const seeded = incrementedState(stateWithCarrier(base, carrier, recordTarget(validRecord)));
  await seedReplicas(page, seeded, seeded);
  await page.reload({ waitUntil: "domcontentloaded" });
  const mode = await waitForReadyOrRecovery(page);
  const firstAfter = await readReplicas(page);
  check(mode.booted === true, "repeat-detection fixture boots instead of full recovery", mode);
  if (mode.booted) {
    const quarantine = firstAfter.local?.recoveryTransitions?.quarantine || [];
    const expectedFirst = { ...first, sourceReplica: "both" };
    const expectedDifferentReason = { ...sameDigestDifferentReason, sourceReplica: "both" };
    const expectedDistinctDigest = { ...distinctDigest, sourceReplica: "both" };
    check(quarantine.length === 3,
      "same digest/reason dedupes while same digest/different reason and distinct digests remain", quarantine);
    const firstEntry = quarantine.find((entry) => entry?.digest === expectedDigest && entry?.reason === first.reason);
    const differentReasonEntry = quarantine.find((entry) => entry?.digest === expectedDigest && entry?.reason === "duplicate-target-conflict");
    const distinctEntry = quarantine.find((entry) => entry?.digest === distinctDigest.digest);
    check(exactQuarantineEntry(firstEntry, expectedFirst),
      "redetection changes only sourceReplica and preserves first raw/digest/reason/detectedAt", firstEntry);
    check(exactQuarantineEntry(differentReasonEntry, expectedDifferentReason),
      "same digest with a different reason remains a distinct exact v1 entry", differentReasonEntry);
    check(exactQuarantineEntry(distinctEntry, expectedDistinctDigest),
      "a distinct digest remains retained as an exact v1 entry", distinctEntry);
    check(isDeepStrictEqual(firstAfter.local, firstAfter.idb),
      "deduplicated quarantine matrix is exactly equal in localStorage and IndexedDB");
    const persisted = clone(firstAfter.local);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const secondAfter = await readReplicas(page);
    check(isDeepStrictEqual(secondAfter.local?.recoveryTransitions?.quarantine, persisted.recoveryTransitions?.quarantine),
      "reload never auto-prunes or rewrites quarantine membership");
    check(isDeepStrictEqual(secondAfter.idb?.recoveryTransitions?.quarantine, persisted.recoveryTransitions?.quarantine),
      "reload retains the deduplicated quarantine in IndexedDB");
    check(isDeepStrictEqual(secondAfter.local, secondAfter.idb),
      "reloaded deduplicated localStorage and IndexedDB snapshots remain exactly equal");
  } else {
    check(false, "repeat detection matrix preserves its exact dedupe/reason/digest membership");
    check(false, "repeat detection matrix retains quarantine without auto-pruning");
  }
  await context.close();
}

async function sourceAttributionScenario(browser, base, validRecord, sourceReplica) {
  const label = `malformed candidate source attribution (${sourceReplica})`;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const malformed = clone(validRecord);
  malformed.diff.recoveryWeek.entries = [];
  const malformedRaw = JSON.stringify(malformed);
  const carrier = { schemaVersion: 1, records: [malformed], quarantine: [] };
  const targetBlockId = recordTarget(validRecord);
  const canonical = stateWithCarrier(base, undefined, targetBlockId);
  const malformedState = incrementedState(stateWithCarrier(base, carrier, targetBlockId));
  const localValue = sourceReplica === "localStorage" ? malformedState :
    sourceReplica === "indexedDB" ? canonical : malformedState;
  const idbValue = sourceReplica === "indexedDB" ? malformedState :
    sourceReplica === "localStorage" ? canonical : malformedState;
  await seedReplicas(page, localValue, idbValue, JSON.stringify(localValue));
  await page.reload({ waitUntil: "domcontentloaded" });
  const mode = await waitForReadyOrRecovery(page);
  const after = await readReplicas(page);
  const expectedDigest = sha256Utf8(malformedRaw);
  check(mode.booted === true, `${label} boots without full recovery`, mode);
  check(mode.recoveryOpen === false, `${label} does not open full Storage Recovery`, mode);
  if (mode.booted) {
    const normalized = carrierOf(after.local);
    const entry = normalized?.quarantine?.find((candidate) => candidate?.digest === expectedDigest);
    check(recordsOf(after.local).length === 0 && recordsOf(after.idb).length === 0,
      `${label} omits the malformed record from both normalized replicas`);
    check(normalized?.quarantine?.length === 1,
      `${label} creates one bounded quarantine entry`, normalized?.quarantine);
    check(exactQuarantineEntry(entry, {
      schemaVersion: 1,
      digest: expectedDigest,
      raw: malformedRaw,
      sourceReplica,
      detectedAt: entry?.detectedAt,
      reason: "known-schema-malformed-recovery",
    }) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry?.detectedAt || ""),
    `${label} records exact raw/digest/reason and isolated sourceReplica`, entry);
    check(isDeepStrictEqual(after.local, after.idb),
      `${label} heals to exactly equal localStorage and IndexedDB snapshots`);
    const projection = await observeProjection(page);
    check(projectionMatches(projection, EXPECTED_CANONICAL),
      `${label} falls back to the independent canonical prescription`, projection);
  }
  await context.close();
}

async function duplicateTargetScenario(browser, base, firstRecord, secondRecord, expectations = {
  dayId: FIXED_FIXTURE_DAY_ID,
  slotIds: FIXED_FIXTURE_SLOT_IDS,
  canonical: EXPECTED_CANONICAL,
}) {
  console.log("\n5. Two independently valid bounded records targeting one block conflict deterministically");
  const targetBlockId = recordTarget(firstRecord);
  const records = [firstRecord, secondRecord];
  const expectedRaw = expectedConflictRaw(targetBlockId, records);
  const expectedDigest = sha256Utf8(expectedRaw);
  const outcomes = [];
  for (const [index, record] of records.entries()) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    const carrier = { schemaVersion: 1, records: [record], quarantine: [] };
    const seeded = incrementedState(stateWithCarrier(base, carrier, targetBlockId));
    await seedReplicas(page, seeded, seeded);
    await page.reload({ waitUntil: "domcontentloaded" });
    const mode = await waitForReadyOrRecovery(page);
    const after = await readReplicas(page);
    check(mode.booted === true, `bounded valid record ${index + 1} boots without full recovery`, mode);
    check(mode.recoveryOpen === false, `bounded valid record ${index + 1} is accepted without full recovery`, mode);
    check(recordsOf(after.local).length === 1 && recordsOf(after.idb).length === 1 &&
      isDeepStrictEqual(recordsOf(after.local)[0], record) &&
      isDeepStrictEqual(recordsOf(after.idb)[0], record),
    `bounded valid record ${index + 1} retains its independently validated carrier envelope`);
    await context.close();
  }
  for (const permutation of [records, [...records].reverse()]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    const carrier = { schemaVersion: 1, records: clone(permutation), quarantine: [] };
    const seeded = incrementedState(stateWithCarrier(base, carrier, targetBlockId));
    await seedReplicas(page, seeded, seeded);
    await page.reload({ waitUntil: "domcontentloaded" });
    const mode = await waitForReadyOrRecovery(page);
    const after = await readReplicas(page);
    check(mode.booted === true, `duplicate permutation ${outcomes.length + 1} boots without full recovery`, mode);
    check(mode.recoveryOpen === false, `duplicate permutation ${outcomes.length + 1} does not open full recovery`, mode);
    if (mode.booted) {
      check(recordsOf(after.local).length === 2 && recordsOf(after.idb).length === 2,
        `duplicate permutation ${outcomes.length + 1} retains both valid records`, after.local?.recoveryTransitions);
      const projection = await observeProjection(page, expectations);
      check(projectionMatches(projection, expectations.canonical, expectations.dayId),
        `duplicate permutation ${outcomes.length + 1} applies neither record and renders canonical`, projection);
      const quarantine = carrierOf(after.local)?.quarantine || [];
      check(quarantine.length === 1, `duplicate permutation ${outcomes.length + 1} creates one conflict quarantine entry`, quarantine);
      const entry = quarantine[0];
      check(entry?.reason === "duplicate-target-conflict" && entry?.raw === expectedRaw && entry?.digest === expectedDigest,
        `duplicate permutation ${outcomes.length + 1} uses independent sorted conflict raw/digest`, entry);
      check(exactQuarantineKeys(entry) && entry?.schemaVersion === 1 && entry?.sourceReplica === "both" &&
        typeof entry?.detectedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.detectedAt),
        `duplicate permutation ${outcomes.length + 1} closes the exact v1 conflict quarantine key set`, entry);
      check(isDeepStrictEqual(after.local, after.idb),
        `duplicate permutation ${outcomes.length + 1} mirrors exact localStorage and IndexedDB snapshots`);
      const beforeReload = clone(after.local);
      const firstDetectedAt = entry?.detectedAt;
      await page.reload({ waitUntil: "domcontentloaded" });
      const reloadedMode = await waitForReadyOrRecovery(page);
      const reloaded = await readReplicas(page);
      const reloadedEntry = carrierOf(reloaded.local)?.quarantine?.[0];
      check(reloadedMode.booted === true && reloadedMode.recoveryOpen === false,
        `duplicate permutation ${outcomes.length + 1} reload remains booted without recovery`, reloadedMode);
      check(isDeepStrictEqual(reloaded.local, beforeReload) && isDeepStrictEqual(reloaded.idb, beforeReload),
        `duplicate permutation ${outcomes.length + 1} reload retains both records and exact quarantine without auto-pruning`);
      check(recordsOf(reloaded.local).length === 2 && recordsOf(reloaded.idb).length === 2 &&
        reloadedEntry?.detectedAt === firstDetectedAt && reloadedEntry?.raw === expectedRaw &&
        reloadedEntry?.digest === expectedDigest && reloadedEntry?.reason === "duplicate-target-conflict",
        `duplicate permutation ${outcomes.length + 1} reload retains the conflict entry first-seen fields`);
      const reloadedProjection = await observeProjection(page, expectations);
      check(projectionMatches(reloadedProjection, expectations.canonical, expectations.dayId),
        `duplicate permutation ${outcomes.length + 1} reload still applies neither record`, reloadedProjection);
      outcomes.push({ raw: entry?.raw, digest: entry?.digest });
    } else {
      check(false, `duplicate permutation ${outcomes.length + 1} retains both valid records and quarantines one conflict bundle`);
      outcomes.push({ raw: null, digest: null });
    }
    await context.close();
  }
  check(outcomes[0]?.raw === outcomes[1]?.raw && outcomes[0]?.digest === outcomes[1]?.digest &&
    outcomes[0]?.raw === expectedRaw && outcomes[0]?.digest === expectedDigest,
  "permutations produce identical deterministic conflict raw/digest", outcomes);
}

async function overBoundDuplicateScenario(browser, base, firstRecord, secondRecord) {
  const targetBlockId = recordTarget(firstRecord);
  const raw = expectedConflictRaw(targetBlockId, [firstRecord, secondRecord]);
  console.log(`  measured over-bound duplicate conflict raw length: ${raw.length}`);
  check(raw.length === EXPECTED_OVER_BOUND_CONFLICT_RAW_LENGTH,
    "real normalized duplicate conflict raw length remains pinned at 16,033 characters",
    { rawLength: raw.length, expected: EXPECTED_OVER_BOUND_CONFLICT_RAW_LENGTH }, "harness");
  check(raw.length > 10000,
    "real normalized duplicate conflict raw independently exceeds the 10,000-character bound",
    { rawLength: raw.length, limit: 10000 }, "harness");
  if (raw.length <= 10000) {
    throw new Error("HARNESS FAILURE: real normalized duplicate conflict bundle is not over-bound");
  }
  await fullRecoveryScenario(
    browser,
    base,
    "over-bound duplicate conflict bundle",
    { schemaVersion: 1, records: [firstRecord, secondRecord], quarantine: [] },
    targetBlockId,
  );
}

async function fullRecoveryScenario(browser, base, label, carrier, blockId = base.programMeta?.blockId) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });
  const seeded = incrementedState(stateWithCarrier(base, carrier, blockId));
  const localRaw = JSON.stringify(seeded);
  await seedReplicas(page, seeded, seeded, localRaw);
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertFullRecoveryPreserves(page, localRaw, seeded, label);
  await context.close();
}

async function main() {
  console.log("052-R5b1: recovery-carrier corruption/quarantine production-backed oracle");
  console.log("Effective settings: model=native gpt-5.6-luna; reasoning_effort=max; fork_turns=none");
  await assertServingApp(BASE);
  const browser = await launchChromium();
  try {
    const { context, page } = await openCleanPage(browser);
    console.log("\n1. Absent carrier follows the legacy canonical path and remains absent");
    const activation = await activateBalancedPredecessor(page);
    check(activation.ok, "real Recommend predecessor activated through production finalization", activation, "harness");
    if (!activation.ok) {
      throw new Error("HARNESS FAILURE: could not establish compiler-backed predecessor");
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const base = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
    const absent = await readReplicas(page);
    check(!Object.prototype.hasOwnProperty.call(absent.local || {}, "recoveryTransitions") &&
      !Object.prototype.hasOwnProperty.call(absent.idb || {}, "recoveryTransitions"),
    "absent recoveryTransitions stays absent in both replicas");
    const absentProjection = await observeProjection(page);
    check(projectionMatches(absentProjection, EXPECTED_CANONICAL),
      "absent carrier uses the independent canonical prescription", absentProjection);
    check((await storageRecoveryState(page)).booted === true && (await storageRecoveryState(page)).open === false,
      "absent carrier follows the legacy boot path without Storage Recovery");

    console.log("\n2. Supported valid v1 carrier retains records and applies only one valid target");
    const firstRecordResult = await buildValidRecord(page, {
      transitionId: "tr_r5b1_valid_target",
      targetBlockId: "r5b1-target-block",
    });
    check(firstRecordResult.ok, "production transition seam creates an individually valid v1 record", firstRecordResult, "harness");
    if (!firstRecordResult.ok) throw new Error("HARNESS FAILURE: could not create valid recovery record");
    const firstRecord = firstRecordResult.record;
    const firstValidation = await validateRecordAgainstLive(page, firstRecord);
    check(firstValidation.ok && firstValidation.predecessorProgramId === firstValidation.liveProgramId,
      "first conflict fixture record validates independently against its live program identity", firstValidation, "harness");
    if (!firstValidation.ok || firstValidation.predecessorProgramId !== firstValidation.liveProgramId) {
      throw new Error("HARNESS FAILURE: first conflict fixture record did not validate against its live program");
    }
    const duplicateSource = await openCleanPage(browser);
    const duplicateActivation = await activateBalancedPredecessor(duplicateSource.page);
    check(duplicateActivation.ok, "distinct production source block activated for duplicate-target record", duplicateActivation, "harness");
    if (!duplicateActivation.ok) throw new Error("HARNESS FAILURE: could not establish duplicate-target source block");
    await duplicateSource.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(duplicateSource.page, { base: BASE });
    const identityAlignment = await alignProgramIdentity(duplicateSource.page, firstRecord.predecessor.programId);
    check(identityAlignment.ok && identityAlignment.liveProgramId === firstRecord.predecessor.programId,
      "second conflict fixture aligns to the seeded live program identity before sealing", identityAlignment, "harness");
    if (!identityAlignment.ok || identityAlignment.liveProgramId !== firstRecord.predecessor.programId) {
      throw new Error("HARNESS FAILURE: could not align second conflict fixture program identity");
    }
    const secondRecordResult = await buildValidRecord(duplicateSource.page, {
      transitionId: "tr_r5b1_duplicate_target",
      targetBlockId: recordTarget(firstRecord),
    });
    check(secondRecordResult.ok, "production transition seam creates the second individually valid target record", secondRecordResult, "harness");
    if (!secondRecordResult.ok) throw new Error("HARNESS FAILURE: could not create duplicate-target record");
    const secondRecord = secondRecordResult.record;
    const secondValidation = await validateRecordAgainstLive(duplicateSource.page, secondRecord);
    check(secondValidation.ok && secondValidation.predecessorProgramId === secondValidation.liveProgramId &&
      secondValidation.predecessorProgramId === firstRecord.predecessor.programId,
      "second conflict fixture record validates independently with the aligned live program identity", secondValidation, "harness");
    if (!secondValidation.ok || secondValidation.predecessorProgramId !== secondValidation.liveProgramId ||
      secondValidation.predecessorProgramId !== firstRecord.predecessor.programId) {
      throw new Error("HARNESS FAILURE: second conflict fixture record did not validate against the aligned live program");
    }
    check(firstRecord.predecessor?.blockId !== secondRecord?.predecessor?.blockId,
      "duplicate-target records retain distinct source block identities", undefined, "harness");
    check(firstRecord.transitionId !== secondRecord.transitionId && firstRecord.proposalHash !== secondRecord.proposalHash,
      "duplicate-target records retain distinct transition and proposal identities", undefined, "harness");
    check(recordTarget(firstRecord) === recordTarget(secondRecord) && recordTarget(firstRecord) !== firstRecord.predecessor?.blockId &&
      recordTarget(secondRecord) !== secondRecord.predecessor?.blockId,
      "duplicate-target records retain one shared target distinct from each valid source", undefined, "harness");
    await duplicateSource.context.close();
    const validCarrier = { schemaVersion: 1, records: [firstRecord], quarantine: [] };
    const validSeed = incrementedState(stateWithCarrier(base, validCarrier, recordTarget(firstRecord)));
    await seedReplicas(page, validSeed, validSeed);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const validAfter = await readReplicas(page);
    check(recordsOf(validAfter.local).length === 1 && recordsOf(validAfter.idb).length === 1,
      "supported v1 retains the valid record in both replicas");
    check(carrierOf(validAfter.local)?.schemaVersion === 1 && carrierOf(validAfter.local)?.quarantine?.length === 0,
      "supported v1 carrier/quarantine shape remains unchanged");
    const validProjection = await observeProjection(page);
    check(projectionMatches(validProjection, EXPECTED_WEEK_ONE),
      "one unconflicted valid target alone applies the independent Rule-B week-one projection", validProjection);
    const validBeforeReload = clone(validAfter.local?.recoveryTransitions);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const validReload = await readReplicas(page);
    check(isDeepStrictEqual(validReload.local?.recoveryTransitions, validBeforeReload) &&
      isDeepStrictEqual(validReload.idb?.recoveryTransitions, validBeforeReload),
    "valid v1 carrier membership survives reload without pruning");

    const malformedResult = await malformedCarrierScenario(browser, base, firstRecord);
    await semanticMalformedCarrierScenario(browser, base, firstRecord);
    await digestFailureScenario(browser, base, firstRecord);
    await repeatDetectionScenario(browser, base, firstRecord, malformedResult.malformedRaw, malformedResult.expectedDigest);
    await sourceAttributionScenario(browser, base, firstRecord, "localStorage");
    await sourceAttributionScenario(browser, base, firstRecord, "indexedDB");
    await sourceAttributionScenario(browser, base, firstRecord, "both");
    const boundedSource = await openCleanPage(browser);
    const boundedActivation = await activateBalancedPredecessor(boundedSource.page, {
      desiredResult: "strength",
      structuredExperience: "first",
      daysPerWeek: 2,
      sessionMinutes: 60,
      preferredRestSeconds: 60,
      name: "Bounded duplicate source",
      goal: "strength",
    });
    check(boundedActivation.ok, "small real compiler-backed predecessor activated for bounded duplicates", boundedActivation, "harness");
    if (!boundedActivation.ok) throw new Error("HARNESS FAILURE: could not establish bounded duplicate predecessor");
    await boundedSource.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(boundedSource.page, { base: BASE });
    const boundedProgramAlignment = await alignProgramIdentity(boundedSource.page, "p", "a");
    check(boundedProgramAlignment.ok && boundedProgramAlignment.liveProgramId === "p" &&
      boundedProgramAlignment.liveBlockId === "a",
    "bounded duplicate source uses short independent program/block identities", boundedProgramAlignment, "harness");
    if (!boundedProgramAlignment.ok || boundedProgramAlignment.liveProgramId !== "p" ||
      boundedProgramAlignment.liveBlockId !== "a") {
      throw new Error("HARNESS FAILURE: could not establish bounded duplicate source identity");
    }
    const boundedBase = await boundedSource.page.evaluate(() => window.__repforgeWorkoutDraft.state());
    const boundedFirstResult = await buildValidRecord(boundedSource.page, {
      transitionId: "b1",
      targetBlockId: "t",
    });
    check(boundedFirstResult.ok, "small production transition seam creates bounded duplicate record one", boundedFirstResult, "harness");
    if (!boundedFirstResult.ok) throw new Error("HARNESS FAILURE: could not create bounded duplicate record one");
    const boundedFirstRecord = boundedFirstResult.record;
    const boundedFirstValidation = await validateRecordAgainstLive(boundedSource.page, boundedFirstRecord);
    check(boundedFirstValidation.ok && boundedFirstValidation.predecessorProgramId === "p" &&
      boundedFirstValidation.sourceBlockId === "a" && boundedFirstValidation.targetBlockId === "t",
    "bounded duplicate record one passes the authoritative transition validator", boundedFirstValidation, "harness");
    if (!boundedFirstValidation.ok || boundedFirstValidation.predecessorProgramId !== "p" ||
      boundedFirstValidation.sourceBlockId !== "a" || boundedFirstValidation.targetBlockId !== "t") {
      throw new Error("HARNESS FAILURE: bounded duplicate record one is not independently valid");
    }

    const boundedDuplicateSource = await openCleanPage(browser);
    const boundedDuplicateActivation = await activateBalancedPredecessor(boundedDuplicateSource.page, {
      desiredResult: "strength",
      structuredExperience: "first",
      daysPerWeek: 2,
      sessionMinutes: 60,
      preferredRestSeconds: 60,
      name: "Bounded duplicate source",
      goal: "strength",
    });
    check(boundedDuplicateActivation.ok, "second small compiler-backed predecessor activated for bounded duplicates", boundedDuplicateActivation, "harness");
    if (!boundedDuplicateActivation.ok) throw new Error("HARNESS FAILURE: could not establish second bounded duplicate predecessor");
    await boundedDuplicateSource.page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(boundedDuplicateSource.page, { base: BASE });
    const boundedDuplicateAlignment = await alignProgramIdentity(boundedDuplicateSource.page, "p", "b");
    check(boundedDuplicateAlignment.ok && boundedDuplicateAlignment.liveProgramId === "p" &&
      boundedDuplicateAlignment.liveBlockId === "b",
    "second bounded duplicate source shares only the program identity", boundedDuplicateAlignment, "harness");
    if (!boundedDuplicateAlignment.ok || boundedDuplicateAlignment.liveProgramId !== "p" ||
      boundedDuplicateAlignment.liveBlockId !== "b") {
      throw new Error("HARNESS FAILURE: could not establish second bounded duplicate source identity");
    }
    const boundedSecondResult = await buildValidRecord(boundedDuplicateSource.page, {
      transitionId: "b2",
      targetBlockId: "t",
    });
    check(boundedSecondResult.ok, "small production transition seam creates bounded duplicate record two", boundedSecondResult, "harness");
    if (!boundedSecondResult.ok) throw new Error("HARNESS FAILURE: could not create bounded duplicate record two");
    const boundedSecondRecord = boundedSecondResult.record;
    const boundedSecondValidation = await validateRecordAgainstLive(boundedDuplicateSource.page, boundedSecondRecord);
    check(boundedSecondValidation.ok && boundedSecondValidation.predecessorProgramId === "p" &&
      boundedSecondValidation.sourceBlockId === "b" && boundedSecondValidation.targetBlockId === "t",
    "bounded duplicate record two passes the authoritative transition validator", boundedSecondValidation, "harness");
    if (!boundedSecondValidation.ok || boundedSecondValidation.predecessorProgramId !== "p" ||
      boundedSecondValidation.sourceBlockId !== "b" || boundedSecondValidation.targetBlockId !== "t") {
      throw new Error("HARNESS FAILURE: bounded duplicate record two is not independently valid");
    }
    const boundedDuplicateRecords = [boundedFirstRecord, boundedSecondRecord];
    check(boundedFirstRecord.predecessor?.blockId !== boundedSecondRecord.predecessor?.blockId &&
      boundedFirstRecord.transitionId !== boundedSecondRecord.transitionId &&
      boundedFirstRecord.proposalHash !== boundedSecondRecord.proposalHash &&
      recordTarget(boundedFirstRecord) === recordTarget(boundedSecondRecord),
    "bounded duplicate records retain distinct sources and identities with one shared target", undefined, "harness");
    if (boundedFirstRecord.predecessor?.blockId === boundedSecondRecord.predecessor?.blockId ||
      boundedFirstRecord.transitionId === boundedSecondRecord.transitionId ||
      boundedFirstRecord.proposalHash === boundedSecondRecord.proposalHash ||
      recordTarget(boundedFirstRecord) !== recordTarget(boundedSecondRecord)) {
      throw new Error("HARNESS FAILURE: bounded duplicate records are not an independent same-target pair");
    }
    const boundedConflictRaw = expectedConflictRaw("t", boundedDuplicateRecords);
    console.log(`  measured bounded duplicate conflict raw length: ${boundedConflictRaw.length}`);
    check(boundedConflictRaw.length === EXPECTED_BOUNDED_CONFLICT_RAW_LENGTH,
      "independently valid bounded duplicate conflict raw length remains pinned at 9,949 characters",
      { rawLength: boundedConflictRaw.length, expected: EXPECTED_BOUNDED_CONFLICT_RAW_LENGTH }, "harness");
    check(boundedConflictRaw.length <= 10000,
      "independently valid bounded duplicate conflict raw stays within the 10,000-character bound",
      { rawLength: boundedConflictRaw.length, limit: 10000 }, "harness");
    if (boundedConflictRaw.length > 10000) {
      throw new Error("HARNESS FAILURE: independently valid bounded duplicate conflict bundle is over-bound");
    }
    await boundedSource.context.close();
    await boundedDuplicateSource.context.close();
    await duplicateTargetScenario(browser, boundedBase, ...boundedDuplicateRecords, BOUNDED_DUPLICATE_EXPECTATIONS);
    console.log("\n6. Real normalized duplicate overflow preserves untouched replicas through full recovery");
    await overBoundDuplicateScenario(browser, base, firstRecord, secondRecord);

    console.log("\n7. Unknown, over-bound, and malformed-quarantine inputs enter exact full storage recovery");
    const unknownTopLevel = { schemaVersion: 2, records: [], quarantine: [] };
    await fullRecoveryScenario(browser, base, "unknown top-level carrier schema", unknownTopLevel);
    const unknownRecord = clone(firstRecord);
    unknownRecord.schemaVersion = 2;
    await fullRecoveryScenario(browser, base, "unknown record schema", { schemaVersion: 1, records: [unknownRecord], quarantine: [] });
    const unknownOverlay = clone(firstRecord);
    unknownOverlay.diff.recoveryWeek.schemaVersion = 2;
    await fullRecoveryScenario(browser, base, "unknown overlay schema", { schemaVersion: 1, records: [unknownOverlay], quarantine: [] });
    const unknownRequiredPolicy = clone(firstRecord);
    unknownRequiredPolicy.diff.recoveryWeek.policyVersion = 99;
    await fullRecoveryScenario(browser, base, "unknown required recoveryWeek.policyVersion", {
      schemaVersion: 1,
      records: [unknownRequiredPolicy],
      quarantine: [],
    });
    const overBoundCandidate = { schemaVersion: 1, records: [{ schemaVersion: 1, rawCandidate: "x".repeat(10001) }], quarantine: [] };
    await fullRecoveryScenario(browser, base, "over-bound candidate", overBoundCandidate);
    const boundedEntry = quarantineEntry("", "localStorage", MALFORMED_DETECTED_AT);
    const overBoundAggregate = { schemaVersion: 1, records: [], quarantine: Array.from({ length: 257 }, () => clone(boundedEntry)) };
    await fullRecoveryScenario(browser, base, "over-bound aggregate", overBoundAggregate);
    await fullRecoveryScenario(browser, base, "malformed quarantine container", { schemaVersion: 1, records: [], quarantine: {} });

    console.log("\n8. Replica disagreement never recursively unions whole carriers");
    const disagreementContext = await browser.newContext();
    const disagreementPage = await disagreementContext.newPage();
    disagreementPage.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await disagreementPage.goto(BASE);
    await waitForAppBoot(disagreementPage, { base: BASE });
    const recordA = clone(firstRecord);
    const recordB = clone(secondRecordResult.record);
    const localState = incrementedState(stateWithCarrier(base, { schemaVersion: 1, records: [recordA], quarantine: [] }, recordTarget(recordA)));
    const idbState = stateWithCarrier(localState, { schemaVersion: 1, records: [recordB], quarantine: [] }, recordTarget(recordB));
    const localRaw = JSON.stringify(localState);
    await seedReplicas(disagreementPage, localState, idbState, localRaw);
    await disagreementPage.reload({ waitUntil: "domcontentloaded" });
    const disagreementMode = await waitForReadyOrRecovery(disagreementPage);
    const disagreementAfter = await readReplicas(disagreementPage);
    check(disagreementMode.booted === false && disagreementMode.recoveryOpen === true,
      "divergent same-revision carrier opens existing full Storage Recovery", disagreementMode);
    check(disagreementAfter.localRaw === localRaw && isDeepStrictEqual(disagreementAfter.idb, idbState),
      "divergent carrier preserves exact localStorage and IndexedDB replicas before choice");
    check(recordsOf(disagreementAfter.local).length === 1 && recordsOf(disagreementAfter.idb).length === 1 &&
      recordsOf(disagreementAfter.local)[0]?.transitionId === recordA.transitionId &&
      recordsOf(disagreementAfter.idb)[0]?.transitionId === recordB.transitionId,
    "divergent carriers are not recursively unioned across replicas");
    await disagreementContext.close();
    await context.close();
  } finally {
    await browser.close();
  }

  console.log(`\nResult: ${results.passed} passed, ${results.failed} failed (harness failures: ${results.harnessFailed})`);
  if (results.failures.length) {
    console.error("Intended failure list / classifications:");
    for (const { message, classification } of results.failures) console.error(` - [${classification}] ${message}`);
    process.exitCode = results.harnessFailed ? 2 : 1;
  }
}

main().catch((error) => {
  console.error("HARNESS FAILURE (not an intended product assertion):");
  console.error(error?.stack || error);
  process.exitCode = 2;
});
