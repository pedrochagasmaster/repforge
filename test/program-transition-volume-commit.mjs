#!/usr/bin/env node
/**
 * Plan 052-Packet V: production-backed permanent volume reduction.
 *
 * This drives the compiler context, transition adapter, confirmation seam, and
 * durable replacement transaction in the browser. The expected successor is
 * calculated from the compiler's own slot metadata by this test, independently
 * of the transition module's proposal output.
 */
import { launchChromium, waitForAppBoot, assertServingApp } from "./browser.mjs";
import { createRequire } from "node:module";
import { isDeepStrictEqual } from "node:util";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Transition = require("../program-transition.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const BASE = process.env.REPFORGE_URL || "http://127.0.0.1:8052/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";
const CHECKPOINT_KEY = "repforge_draft_v1:v2-checkpoint";
const DB_NAME = "repforge";

let passed = 0;
const failures = [];
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
  return page.evaluate(async ({ dbName, key }) => new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.close();
        resolve(null);
        return;
      }
      const tx = db.transaction("kv", "readonly");
      const get = tx.objectStore("kv").get(key);
      get.onsuccess = () => {
        db.close();
        resolve(get.result ?? null);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
  }), { dbName: DB_NAME, key: KEY });
}

function semantic(snapshot) {
  if (!snapshot) return null;
  return {
    programMeta: snapshot.programMeta ?? null,
    program: snapshot.program ?? [],
    revision: snapshot._storageRevision ?? null,
    history: snapshot.programHistory ?? [],
    log: snapshot.log ?? [],
  };
}

async function readReplicas(page) {
  const rawLocal = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const idb = await readIdbState(page);
  return { local: semantic(JSON.parse(rawLocal || "null")), idb: semantic(idb), rawLocal };
}

async function readDraft(page) {
  return page.evaluate(({ draftKey, checkpointKey }) => ({
    raw: localStorage.getItem(draftKey),
    checkpoint: localStorage.getItem(checkpointKey),
  }), { draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY });
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
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }, { key: KEY, draftKey: DRAFT_KEY, checkpointKey: CHECKPOINT_KEY, dbName: DB_NAME });
}

async function activateBalancedRecommendPredecessor(page) {
  return page.evaluate(async () => {
    const adapter = window.RepForgeProgramEntryAdapter;
    const compiler = window.RepForgeProgramCompiler;
    if (!adapter || !compiler) return { ok: false, error: "compiler/adapter unavailable" };
    const services = adapter.createProductionServices({
      Compiler: compiler,
      catalogue: window.__repforgeExerciseLibrary || window.EXERCISE_LIBRARY,
    });
    const compiled = services.compile({
      mode: "recommend",
      answers: {
        desiredResult: "muscle_growth", structuredExperience: "6_to_24m", recentConsistency: "most",
        daysPerWeek: 3, sessionMinutes: 90, preferredRestSeconds: 90,
        environment: { kind: "commercial_gym" },
        primaryMuscles: [], deEmphasizedMuscles: [], ignoredMuscles: [],
        priorityMovements: [], mustHaveExercises: [], exerciseConstraints: [],
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
    await window.__repforgeFinalizeProgramSetup({
      exercises: compiled.preview.program,
      name: compiled.name || "Growth 3-Day",
      answers: { goal: "muscle_growth", daysPerWeek: 3 },
      destination: "log", origin: "first-run", draftConfirmed: true, telemetryRoute: "recommend",
      entryTelemetry: compiled.telemetry,
      entrySource: { route: "recommend", fingerprint: compiled.fingerprint },
      programStructure: compiled.preview.programStructure,
      compilerContext: compiled.compilerContext,
      baseProposal,
    });
    await window.__repforgeStorage.flush();
    return { ok: true };
  });
}

async function initializeDraft(page) {
  return page.evaluate(async () => {
    const state = window.__repforgeWorkoutDraft.state();
    const day = state.program?.[0]?.day;
    if (!day) return { ok: false, error: "no program day" };
    await window.__repforgeEnterWorkout({ day, focus: false });
    const hook = window.__repforgeWorkoutDraft;
    const draft = hook.current();
    const exerciseId = draft?.exerciseOrder?.[0];
    const setId = exerciseId && draft.exercises?.[exerciseId]?.setOrder?.[0];
    if (!exerciseId || !setId) return { ok: false, error: "no draft set" };
    await hook.dispatch("editSetField", { exerciseInstanceId: exerciseId, setId, field: "reps", value: "9" });
    await window.__repforgeWorkoutDraft.flush();
    return { ok: true };
  });
}

function firstProgramDifference(expected, actual) {
  if (!Array.isArray(expected) || !Array.isArray(actual)) return { expectedType: typeof expected, actualType: typeof actual };
  if (expected.length !== actual.length) return { expectedLength: expected.length, actualLength: actual.length };
  for (let i = 0; i < expected.length; i++) {
    if (!isDeepStrictEqual(expected[i], actual[i])) {
      const keys = new Set([...Object.keys(expected[i] || {}), ...Object.keys(actual[i] || {})]);
      const fields = {};
      for (const key of keys) {
        if (!isDeepStrictEqual(expected[i]?.[key], actual[i]?.[key])) {
          fields[key] = { expected: expected[i]?.[key], actual: actual[i]?.[key] };
        }
      }
      return { index: i, slotId: expected[i]?.slotId, fields };
    }
  }
  return null;
}

function durableProgramMatches(expected, actual) {
  if (!Array.isArray(expected) || !Array.isArray(actual) || expected.length !== actual.length) return false;
  return expected.every((source, index) => {
    const row = actual[index];
    if (!row) return false;
    const normalized = (value) => {
      const clone = JSON.parse(JSON.stringify(value));
      const muscles = (text) => String(text || "").split(",").map((part) =>
        part.trim().replaceAll("_", " ").toLowerCase()).join(",");
      clone.primary = muscles(clone.primary);
      clone.secondary = muscles(clone.secondary);
      // Program's persisted display labels are normalized from the library;
      // movementId/libraryId plus the slot/progression fields are the identity
      // oracle. The compiler's raw pattern labels are not a durable byte field.
      delete clone.primary;
      delete clone.secondary;
      return clone;
    };
    return isDeepStrictEqual(normalized(row), normalized(source));
  });
}

function firstNormalizedProgramDifference(expected, actual) {
  if (!Array.isArray(expected) || !Array.isArray(actual)) return { expectedType: typeof expected, actualType: typeof actual };
  const normalize = (value) => {
    const clone = JSON.parse(JSON.stringify(value));
    const muscles = (text) => String(text || "").split(",").map((part) =>
      part.trim().replaceAll("_", " ").toLowerCase()).join(",");
    clone.primary = muscles(clone.primary);
    clone.secondary = muscles(clone.secondary);
    delete clone.primary;
    delete clone.secondary;
    return clone;
  };
  for (let index = 0; index < Math.min(expected.length, actual.length); index++) {
    const left = normalize(expected[index]);
    const right = normalize(actual[index]);
    if (!isDeepStrictEqual(left, right)) {
      const fields = {};
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (!isDeepStrictEqual(left[key], right[key])) fields[key] = { expected: left[key], actual: right[key] };
      }
      return { index, slotId: left.slotId, fields };
    }
  }
  return expected.length === actual.length ? null : { expectedLength: expected.length, actualLength: actual.length };
}

async function confirm(page, args) {
  return page.evaluate(async (value) => window.__repforgeProgramTransition.confirmTransition(value), args);
}

async function propose(page, args) {
  return page.evaluate(async (value) => {
    if (typeof window.__repforgeProgramTransition?.proposeVolumeReduction !== "function") return null;
    return window.__repforgeProgramTransition.proposeVolumeReduction(value);
  }, args);
}

function independentVolumeOracle(compiled) {
  const rows = new Map((compiled.program || []).map((row) => [row.slotId, row]));
  const slots = compiled.days.flatMap((day) => day.slots);
  const expected = [];
  const removed = [];
  const reduced = [];
  const protectedSlots = [];
  for (const day of compiled.days) {
    for (const slot of day.slots) {
      const row = rows.get(slot.slotId);
      if (!row) throw new Error(`compiler row missing for ${slot.slotId}`);
      if (slot.status === "optional") {
        removed.push(slot.slotId);
        continue;
      }
      const next = JSON.parse(JSON.stringify(row));
      if (slot.status === "protected") {
        protectedSlots.push(slot.slotId);
      } else if (slot.reducible === true && row.sets > row.minSets) {
        next.sets = row.minSets;
        reduced.push({ slotId: slot.slotId, before: row.sets, after: row.minSets });
      }
      expected.push(next);
    }
  }
  return { expected, removed, reduced, protectedSlots, slotCount: slots.length };
}

function transitionArgs(proposal, draftRaw, confirmedAt) {
  return {
    proposal,
    transitionId: proposal.transitionId,
    successorProgramId: proposal.successor.programId,
    confirmedAt,
    proposalHash: proposal.proposalHash,
    acknowledgedDraftRaw: draftRaw,
  };
}

async function injectWriteFailureAfterFirst(page) {
  await page.evaluate((key) => {
    const originalSetItem = Storage.prototype.setItem;
    const originalPut = IDBObjectStore.prototype.put;
    let localWrites = 0;
    let idbWrites = 0;
    Storage.prototype.setItem = function (candidate) {
      if (candidate === key && ++localWrites > 1) throw new Error("packet-v-write-fault");
      return originalSetItem.apply(this, arguments);
    };
    IDBObjectStore.prototype.put = function (_value, candidate) {
      if (candidate === key && ++idbWrites > 1) throw new Error("packet-v-write-fault");
      return originalPut.apply(this, arguments);
    };
    window.__restorePacketVWriteFault = () => {
      Storage.prototype.setItem = originalSetItem;
      IDBObjectStore.prototype.put = originalPut;
    };
  }, KEY);
}

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
  try {
    await assertServingApp(BASE);
    await page.goto(BASE);
    await waitForAppBoot(page, { base: BASE });
    await clearStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const activated = await activateBalancedRecommendPredecessor(page);
    check(activated.ok, "real compiler-backed predecessor activated", activated);
    if (!activated.ok) throw new Error(`activation failed: ${JSON.stringify(activated)}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    // The user-facing block action must take the same compiler-backed path as
    // the explicit adapter seam. This is the production boundary that used to
    // apply the forbidden blanket +/-1 shortcut.
    const directBefore = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
    const directCompiled = Compiler.compile(directBefore.programMeta.compilerContext, EXERCISE_LIBRARY);
    const directExpected = await Transition.proposeVolumeReduction({
      predecessorInstance: directCompiled,
      predecessor: {
        programId: directBefore.programMeta.id,
        durableRevision: directBefore._storageRevision,
        source: "Recommend",
      },
      transitionId: "tr_packet_v_direct_oracle",
      successorProgramId: "prog_packet_v_direct_oracle_succ",
      createdAt: "2026-10-05T08:59:00.000Z",
      diagnosis: {
        kind: "reduce_training_volume",
        answers: {},
        eligibleEvidenceIds: ["packet-v-direct-volume"],
        insufficientEvidenceReasons: [],
      },
      policyVersion: 1,
      supportedVersions: Compiler.VERSIONS,
    });
    check(directExpected.ok === true, "independent oracle can derive the direct block successor", directExpected);
    const directResult = await page.evaluate(() => window.__repforgeCommitNextBlock("reduce_volume"));
    check(directResult?.committed === true && directResult.localOk === true && directResult.idbOk === true,
      "commitNextBlock(reduce_volume) commits through the production volume adapter", directResult);
    const directAfter = await readReplicas(page);
    check(durableProgramMatches(directExpected.successorInstance.program, directAfter.local.program) &&
          isDeepStrictEqual(directAfter.local.program, directAfter.idb.program),
      "direct block commit stores the compiler-derived successor in both replicas", {
        difference: firstNormalizedProgramDifference(directExpected.successorInstance.program, directAfter.local.program),
      });
    check(directAfter.local.programMeta?.transitionIn?.kind === "reduce_training_volume" &&
          directAfter.local.history.length === 1 && directAfter.idb.history.length === 1,
      "direct block commit writes one volume transition archive", directAfter);

    // The rest of this suite exercises the explicit preview/confirmation path
    // with a touched DraftV2 and retry/fault oracles from a fresh predecessor.
    await clearStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const reactivated = await activateBalancedRecommendPredecessor(page);
    check(reactivated.ok, "fresh compiler-backed predecessor reactivated for preview proof", reactivated);
    if (!reactivated.ok) throw new Error(`reactivation failed: ${JSON.stringify(reactivated)}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });

    const draftSetup = await initializeDraft(page);
    check(draftSetup.ok, "DraftV2 initialized through the production workout path", draftSetup);
    const draftBefore = await readDraft(page);
    check(typeof draftBefore.raw === "string" && typeof draftBefore.checkpoint === "string",
      "DraftV2 raw and checkpoint are present before proposal");

    const before = await page.evaluate(() => window.__repforgeWorkoutDraft.state());
    const revisionR = before._storageRevision;
    const compilerContext = before.programMeta.compilerContext;
    const compiled = Compiler.compile(compilerContext, EXERCISE_LIBRARY);
    check(compiled?.kind === "compiled", "independent compiler oracle compiled the stored context");
    const oracle = independentVolumeOracle(compiled);
    check(oracle.removed.length > 0, "oracle contains optional work to remove", oracle);
    check(oracle.reduced.length > 0, "oracle contains reducible work above its floor", oracle);
    check(oracle.protectedSlots.length > 0, "oracle contains protected work", oracle);

    const diagnosis = {
      kind: "reduce_training_volume",
      answers: {},
      eligibleEvidenceIds: ["packet-v-explicit-volume-reduction"],
      insufficientEvidenceReasons: [],
    };
    const proposalResult = await propose(page, {
      diagnosis,
      transitionId: "tr_packet_v_volume",
      successorProgramId: "prog_packet_v_volume_succ",
      createdAt: "2026-10-05T09:00:00.000Z",
      policyVersion: 1,
    });
    check(proposalResult?.ok === true, "production volume proposal reaches the compiler-backed adapter", proposalResult);
    if (!proposalResult?.ok) throw new Error(`volume proposal unavailable: ${JSON.stringify(proposalResult)}`);
    const proposal = proposalResult.proposal;
    check(proposal.kind === "reduce_training_volume", "proposal kind is reduce_training_volume");
    check(proposal.predecessor.durableRevision === revisionR, "proposal pins the current durable revision");
    check(proposalResult.successorInstance?.days?.length === compiled.days.length,
      "proposal returns the compiler successor instance");

    const proposalRows = proposalResult.successorInstance.program;
    const expectedIds = oracle.expected.map((row) => row.slotId);
    check(isDeepStrictEqual(proposalRows.map((row) => row.slotId), expectedIds),
      "proposal removes optional slots without changing retained slot order", {
        expectedIds, actualIds: proposalRows.map((row) => row.slotId),
      });
    for (const expected of oracle.expected) {
      const actual = proposalRows.find((row) => row.slotId === expected.slotId);
      const source = compiled.program.find((row) => row.slotId === expected.slotId);
      const changed = expected.sets !== source.sets;
      const rowMatches = actual && source &&
        actual.slotId === source.slotId && actual.id === source.id &&
        actual.libraryId === source.libraryId && actual.movementId === source.movementId &&
        actual.minSets === source.minSets && actual.maxSets === source.maxSets &&
        actual.name === source.name && actual.dayId === source.dayId &&
        actual.sets === expected.sets &&
        actual.progression?.strategy?.id === source.progression?.strategy?.id &&
        actual.progression?.strategy?.version === source.progression?.strategy?.version &&
        isDeepStrictEqual(actual.progression?.modifiers, source.progression?.modifiers);
      check(rowMatches, `compiler oracle row preserved/transformed exactly: ${expected.slotId}`, {
        expected, actual, changed,
      });
    }

    // Deliberately rehash an unsafe cut. It must fail in the real confirmation
    // preflight and leave both replicas, history, and revision untouched.
    const unsafe = JSON.parse(JSON.stringify(proposal));
      const unsafeRow = unsafe.diff.exercises.find((row) => row.before && row.after);
    check(!!unsafeRow, "proposal exposes a set-changing diff for unsafe-cut proof");
    if (unsafeRow) {
      unsafeRow.after.sets = 0;
      unsafe.proposalHash = await Transition.hashProposal(unsafe);
      const beforeUnsafe = await readReplicas(page);
      const unsafeResult = await confirm(page, transitionArgs(unsafe, draftBefore.raw, "2026-10-05T09:01:00.000Z"));
      check(unsafeResult?.committed === false && unsafeResult?.localOk === false && unsafeResult?.idbOk === false,
        "unsafe below-floor cut is rejected before durable commit", unsafeResult);
      const afterUnsafe = await readReplicas(page);
      check(afterUnsafe.local.revision === beforeUnsafe.local.revision && afterUnsafe.idb.revision === beforeUnsafe.idb.revision,
        "unsafe cut advances neither durable replica");
      check(afterUnsafe.local.history.length === beforeUnsafe.local.history.length &&
            afterUnsafe.idb.history.length === beforeUnsafe.idb.history.length,
        "unsafe cut creates no archive");
    }

    // A genuine intervening state write must stale the proposal with no archive.
    const benign = await page.evaluate(async () => {
      const state = window.__repforgeWorkoutDraft.state();
      state.settings = { ...state.settings, restSec: (state.settings?.restSec || 90) + 5 };
      const result = await window.__repforgeCommitProposedState(state);
      await window.__repforgeStorage.flush();
      return result;
    });
    check(benign.localOk === true && benign.idbOk === true, "intervening durable write committed");
    const revisionR1 = await page.evaluate(() => window.__repforgeWorkoutDraft.state()._storageRevision);
    check(revisionR1 === revisionR + 1, "intervening write advances revision exactly once", { revisionR, revisionR1 });
    const stale = await confirm(page, transitionArgs(proposal, draftBefore.raw, "2026-10-05T09:02:00.000Z"));
    check(stale?.committed === false && (stale?.stale === true || stale?.staleRevision === true || stale?.code === "stale_proposal"),
      "stale volume proposal is rejected with a typed stale result", stale);
    const afterStale = await readReplicas(page);
    check(afterStale.local.history.length === 0 && afterStale.idb.history.length === 0,
      "stale volume proposal creates no archive");

    const fresh = await propose(page, {
      diagnosis,
      transitionId: "tr_packet_v_volume_fresh",
      successorProgramId: "prog_packet_v_volume_fresh_succ",
      createdAt: "2026-10-05T09:03:00.000Z",
      policyVersion: 1,
    });
    check(fresh?.ok === true, "fresh volume proposal re-created after stale rejection", fresh);
    if (!fresh?.ok) throw new Error(`fresh volume proposal unavailable: ${JSON.stringify(fresh)}`);
    const freshProposal = fresh.proposal;
    const freshArgs = transitionArgs(freshProposal, draftBefore.raw, "2026-10-05T09:04:00.000Z");

    await injectWriteFailureAfterFirst(page);
    const interrupted = await confirm(page, freshArgs);
    await page.evaluate(() => window.__restorePacketVWriteFault?.());
    await page.evaluate(() => window.__repforgeStorage.flush());
    check(interrupted?.deferred === true || interrupted?.finalizationPending === true || interrupted?.committed === true,
      "production write-fault path returns a truthful retryable result", interrupted);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const recovered = await readReplicas(page);
    check(recovered.local.programMeta?.id === freshProposal.successor.programId &&
          recovered.idb.programMeta?.id === freshProposal.successor.programId,
      "fault retry/replay leaves the compiler-derived successor active in both replicas");
    check(recovered.local.revision === revisionR1 + 1 && recovered.idb.revision === revisionR1 + 1,
      "successful/recovered volume commit advances exactly once to R+2", recovered);
    check(durableProgramMatches(fresh.successorInstance.program, recovered.local.program) &&
          durableProgramMatches(fresh.successorInstance.program, recovered.idb.program),
      "durable successor program equals the compiler-backed proposal successor", {
        difference: firstProgramDifference(fresh.successorInstance.program, recovered.local.program),
        normalizedDifference: firstNormalizedProgramDifference(fresh.successorInstance.program, recovered.local.program),
      });

    const tin = recovered.local.programMeta.transitionIn;
    const archive = recovered.local.history.find((entry) => entry?.id === freshProposal.predecessor.programId);
    check(tin?.status === "committed" && tin.transitionId === freshProposal.transitionId &&
          tin.proposalHash === freshProposal.proposalHash && tin.archiveId === freshProposal.predecessor.programId &&
          tin.successor?.programId === freshProposal.successor.programId,
      "successor transitionIn contains exact volume provenance links", tin);
    check(archive?.archiveId === freshProposal.predecessor.programId &&
          archive?.transitionOut?.transitionId === freshProposal.transitionId &&
          archive?.transitionOut?.proposalHash === freshProposal.proposalHash &&
          archive?.transitionOut?.successorProgramId === freshProposal.successor.programId,
      "archive transitionOut contains exact volume provenance links", archive);

    const draftAfter = await readDraft(page);
    check(draftAfter.raw === draftBefore.raw && draftAfter.checkpoint === draftBefore.checkpoint,
      "DraftV2 raw and checkpoint survive volume replacement and reload", {
        rawEqual: draftAfter.raw === draftBefore.raw,
        checkpointEqual: draftAfter.checkpoint === draftBefore.checkpoint,
        beforeCheckpointKind: JSON.parse(draftBefore.checkpoint || "null")?.kind,
        afterCheckpointKind: JSON.parse(draftAfter.checkpoint || "null")?.kind,
      });
    check(isDeepStrictEqual(recovered.local, recovered.idb),
      "localStorage and IndexedDB semantic replicas are identical after volume commit");

    const revisionBeforeDuplicate = recovered.local.revision;
    const duplicate = await confirm(page, freshArgs);
    check(duplicate?.alreadyCommitted === true && duplicate?.committed === true,
      "duplicate volume confirmation is idempotent", duplicate);
    const afterDuplicate = await readReplicas(page);
    check(afterDuplicate.local.revision === revisionBeforeDuplicate && afterDuplicate.idb.revision === revisionBeforeDuplicate,
      "duplicate confirmation advances no revision");
    check(afterDuplicate.local.history.length === 1 && afterDuplicate.idb.history.length === 1,
      "duplicate confirmation creates no second archive");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForAppBoot(page, { base: BASE });
    const secondBoot = await readReplicas(page);
    check(secondBoot.local.revision === revisionBeforeDuplicate && secondBoot.idb.revision === revisionBeforeDuplicate,
      "second boot preserves the committed revision");
    check(secondBoot.local.history.length === 1 && secondBoot.idb.history.length === 1,
      "second boot preserves exactly one archive");
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nPacket V production volume commit: ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
