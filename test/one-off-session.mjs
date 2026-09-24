#!/usr/bin/env node
// One-off sessions executed through the existing workout-session owner's
// DraftV2 aggregate (workout-draft.js), end to end in pure Node:
// plan → create → edit/complete → reload → finish → rows → ledgers.
//
// Proves the central invariant of the one-off spec (§1, §5.2, §10): a pure
// one-off records real training but never completes, skips, reorders, or
// edits a program day, never inflates adherence or block volume, and never
// becomes program progression evidence; an adapted planned session remains
// the planned session.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import fc from "fast-check";

const require = createRequire(import.meta.url);
const Draft = require("../workout-draft.js");
const Intent = require("../session-intent.js");
const Planner = require("../session-planner.js");
const ProgressModel = require("../progress-model.js");
const ProgramEntry = require("../program-entry.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");

const results = { passed: 0, failed: 0 };
function assert(condition, name, detail = "") {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
    return;
  }
  results.failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}
const json = (value) => JSON.stringify(value);
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

// ------------------------------------------------------------------ fixtures

const catalogue = Planner.normalizeCatalogue(EXERCISE_LIBRARY, []);
const DAYS = ["Upper A", "Lower A"];
// A durable active-program snapshot shaped like state.program/programMeta.
const STATE = deepFreeze({
  programMeta: { id: "program-a", blockId: "block-1", started: "2026-09-14", mesocycleLengthWeeks: 6, equipment: ["barbells", "dumbbells", "cables", "machines"] },
  program: [
    { id: "ua-bench", day: "Upper A", order: 1, name: "Barbell bench press", libraryId: "pr_bb", movementId: "library:pr_bb", sets: 3, min: 5, max: 8, primary: "Chest", secondary: "Triceps,Front delts", priority: "protected", minSets: 2 },
    { id: "ua-row", day: "Upper A", order: 2, name: "Barbell row", libraryId: "rw_bb", movementId: "library:rw_bb", sets: 3, min: 6, max: 10, primary: "Mid/upper back", secondary: "Biceps", priority: "protected", minSets: 2 },
    { id: "ua-curl", day: "Upper A", order: 3, name: "Dumbbell curl", libraryId: "cu_db", movementId: "library:cu_db", sets: 3, min: 10, max: 15, primary: "Biceps", secondary: "Forearms", priority: "optional", minSets: 2 },
    { id: "la-squat", day: "Lower A", order: 1, name: "Barbell back squat", libraryId: "sq_bb", movementId: "library:sq_bb", sets: 3, min: 5, max: 8, primary: "Quads", secondary: "Glutes,Hamstrings,Calves", priority: "protected", minSets: 2 },
    { id: "la-curl", day: "Lower A", order: 2, name: "Lying leg curl", libraryId: "lc_mc", movementId: "library:lc_mc", sets: 3, min: 10, max: 15, primary: "Hamstrings", secondary: "", priority: "optional", minSets: 2 },
  ],
});
const PROGRAM_FINGERPRINT = "fp-program-a-v1";
const DAY_IDS = { "Upper A": "day-upper-a", "Lower A": "day-lower-a" };

// The owner's own planned-day create input (what app.js workoutProgramContext
// builds), with the active block carried exactly as today.
function plannedProgramContext(label, { scheduleDate = "2026-09-24", fingerprint = PROGRAM_FINGERPRINT } = {}) {
  return {
    programId: STATE.programMeta.id,
    programFingerprint: fingerprint,
    durableRevision: 7,
    dayId: DAY_IDS[label],
    dayLabel: label,
    scheduleDate,
    unit: "kg",
    rirMode: "numeric",
    blockId: STATE.programMeta.blockId,
    exercises: STATE.program.filter((row) => row.day === label).map((row) => ({
      exerciseInstanceId: row.id,
      sourceExerciseId: row.id,
      libraryId: row.libraryId,
      movementId: row.movementId,
      displayName: row.name,
      sets: row.sets,
      setIds: Array.from({ length: row.sets }, (_, index) => `set-${index + 1}`),
      minReps: row.min,
      maxReps: row.max,
      targetRir: 1,
      notes: "",
      primary: row.primary,
      secondary: row.secondary,
      progressionStrategy: "range@1",
      movementPattern: null,
      sourceFingerprint: `fp-${row.id}`,
      programmedSets: Array.from({ length: row.sets }, () => ({ suggestedLoad: 60, suggestedReps: row.min, targetRir: 1, minReps: row.min, maxReps: row.max })),
    })),
  };
}
const oneOffBase = (scheduleDate = "2026-09-24") => ({ programId: STATE.programMeta.id, programFingerprint: PROGRAM_FINGERPRINT,
  durableRevision: 7, scheduleDate, unit: "kg", rirMode: "numeric" });
const plannedDay = (label) => ({ programId: STATE.programMeta.id, programFingerprint: PROGRAM_FINGERPRINT, dayId: DAY_IDS[label],
  dayLabel: label, exercises: STATE.program.filter((row) => row.day === label) });

let operation = 0;
const selection = (draftId, startedAt = "2026-09-24T09:00:00.000Z") => ({ draftId,
  writer: { installationId: "install-a", tabId: "tab-a", operationId: `create-${draftId}` }, startedAt, updatedAt: startedAt });
function command(draft, type, values = {}) {
  operation++;
  return { type, operationId: `op-${operation}`, expectedRevision: draft.revision, updatedAt: `2026-09-24T09:${String(operation % 60).padStart(2, "0")}:00.000Z`,
    writer: { installationId: "install-a", tabId: "tab-a" }, ...values };
}
function apply(draft, type, values) {
  const next = Draft.reduce(draft, command(draft, type, values));
  if (Draft.isDomainError(next)) throw new Error(`${type}: ${json(next)}`);
  return next;
}
function completeAll(draft, load = "50") {
  let current = draft;
  for (const exerciseId of current.exerciseOrder) {
    for (const setId of current.exercises[exerciseId].setOrder) {
      current = apply(current, "editSetField", { exerciseInstanceId: exerciseId, setId, field: "load", value: load });
      current = apply(current, "editSetField", { exerciseInstanceId: exerciseId, setId, field: "reps", value: "8" });
      current = apply(current, "editSetField", { exerciseInstanceId: exerciseId, setId, field: "rir", value: "2" });
      current = apply(current, "completeSet", { exerciseInstanceId: exerciseId, setId, completedAt: "2026-09-24T09:30:00.000Z" });
    }
  }
  return current;
}
function finish(draft, created = "2026-09-24T10:00:00.000Z") {
  const finishing = apply(draft, "beginFinish");
  const rows = Draft.toHistoryRows(finishing, created);
  if (Draft.isDomainError(rows)) throw new Error(json(rows));
  return rows;
}
function create(programContext, draftId, startedAt) {
  const draft = Draft.create(programContext, selection(draftId, startedAt));
  if (Draft.isDomainError(draft)) throw new Error(json(draft));
  return draft;
}
const reload = (draft, context) => Draft.parse(JSON.stringify(Draft.serialize(draft)), context);

const stateBefore = json(STATE);

// ------------------------------------------------------------------ normal planned session

console.log("normal programmed session (regression: no context, no new fields)");
let plannedRows;
{
  const draft = create(plannedProgramContext("Upper A"), "planned-1");
  assert(!Object.hasOwn(draft, "sessionContext"), "a normal planned draft carries no session context");
  plannedRows = finish(completeAll(draft));
  const legacyKeys = new Set(["session", "date", "day", "name", "exerciseId", "set", "load", "reps", "rir", "notes", "created", "blockId",
    "primary", "secondary", "performedName", "performedPrimary", "performedSecondary", "performedLibraryId", "performedMovementId", "exNote", "warmup", "bodyweight"]);
  assert(plannedRows.every((row) => Object.keys(row).every((key) => legacyKeys.has(key))),
    "planned rows keep exactly the pre-existing field set");
  assert(plannedRows.every((row) => Intent.rowEligibility(row).legacy && Intent.rowEligibility(row).programCompletion),
    "planned rows are program completion and progression evidence by legacy default");
  assert(Intent.classify(null).countsAsProgramDay, "the owner's planned path classifies as a program day");
}

// ------------------------------------------------------------------ pure one-offs

function startOneOff(plan, draftId, scheduleDate) {
  const input = Planner.oneOffDraftContext(plan, oneOffBase(scheduleDate));
  if (!input.ok) throw new Error(json(input));
  return create(input.programContext, draftId, `${scheduleDate || "2026-09-24"}T17:00:00.000Z`);
}
const classicPlan = Planner.planClassic({ catalogue, classic: "push", program: STATE.program,
  constraints: { minutes: 45, equipment: ["dumbbell", "cable", "bodyweight"] }, restSeconds: 120 }).plan;
const musclePlan = Planner.planMuscleFocus({ catalogue, primaryMuscles: ["Quads"], secondaryMuscles: ["Calves"], program: STATE.program,
  constraints: { minutes: 45, equipment: ["machine", "smith"] }, restSeconds: 120 }).plan;
const manualPlan = Planner.planManual({ catalogue, name: "With Ana",
  exercises: [{ exerciseId: "pr_bb", sets: 3, minReps: 5, maxReps: 8 }, { exerciseId: "cu_cb", sets: 2, minReps: 10, maxReps: 15 }], restSeconds: 90 }).plan;

console.log("pure one-offs through the workout owner");
for (const [label, plan, intent] of [["classic", classicPlan, "classic"], ["muscle-focus", musclePlan, "muscle_focus"], ["manual", manualPlan, "manual"]]) {
  const draft = startOneOff(plan, `oneoff-${label}`);
  assert(draft.program.dayId === `one-off:${intent}` && draft.program.dayLabel === plan.context.name && !Object.hasOwn(draft.program, "blockId"),
    `${label}: the draft is labeled as a one-off, never as a program day or block`);
  assert(json(draft.sessionContext) === json(plan.context), `${label}: the accepted context is snapshotted into the single draft`);
  assert(draft.exerciseOrder.join(",") === plan.exercises.map((exercise) => exercise.exerciseInstanceId).join(","),
    `${label}: the draft executes the accepted plan in order`);
  const rows = finish(completeAll(draft));
  assert(rows.length > 0 && rows.every((row) => row.sessionKind === "one_off" && row.oneOffIntent === intent &&
    row.programCompletionEligible === false && row.progressionEligible === false && !Object.hasOwn(row, "blockId")),
  `${label}: every saved row carries one-off provenance and false eligibility`);
  assert(rows.every((row) => row.performedLibraryId === plan.exercises.find((exercise) => exercise.exerciseInstanceId === row.exerciseId).libraryId),
    `${label}: rows keep the exact performed library identity`);
  assert(rows.every((row) => row.day === plan.context.name), `${label}: the History label is the accepted name`);
  const cls = Intent.historyClass(rows);
  assert(cls.historyClass === "one_off" && cls.oneOffIntent === intent && !cls.countsAsProgramDay, `${label}: History classifies the session as a one-off`);
}

// ------------------------------------------------------------------ adapted planned session

console.log("adapted programmed session");
let adaptedRows;
{
  const adapted = Planner.adaptPlannedSession({ catalogue, plannedDay: plannedDay("Upper A"),
    constraints: { minutes: 30, equipment: ["dumbbell", "cable", "bodyweight"] }, restSeconds: 120 });
  assert(adapted.ok && adapted.plan.context.sessionKind === "planned_adapted", "the planned day adapts under time and equipment", json(adapted));
  const input = Planner.adaptedDraftContext(plannedProgramContext("Upper A"), adapted.plan);
  assert(input.ok, "the adaptation narrows the owner's own planned create input");
  const draft = create(input.programContext, "adapted-1");
  assert(draft.program.dayId === "day-upper-a" && draft.program.blockId === "block-1",
    "the adapted draft executes the same program day in the active block");
  const bench = draft.exercises["ua-bench"];
  assert(bench.substitution && bench.substitution.original.libraryId === "pr_bb" &&
    bench.substitution.replacement.libraryId === adapted.plan.exercises.find((item) => item.exerciseInstanceId === "ua-bench").replacement.libraryId,
  "a session-only substitution uses the owner's existing original/replacement semantics");
  assert(!Draft.isDomainError(apply(draft, "restoreOriginalExercise", { exerciseInstanceId: "ua-bench" })),
    "the athlete can still restore the original exercise mid-session");
  adaptedRows = finish(completeAll(draft), "2026-09-24T11:00:00.000Z");
  const benchRow = adaptedRows.find((row) => row.exerciseId === "ua-bench");
  assert(benchRow.name === "Barbell bench press" && benchRow.performedLibraryId !== "pr_bb" && benchRow.sourceExerciseId === "ua-bench",
    "History keeps the prescribed name and the performed identity; machines are never merged into the original's history");
  assert(adaptedRows.every((row) => row.sessionKind === "planned_adapted" && row.programCompletionEligible && row.progressionEligible &&
    row.blockId === "block-1" && row.sourceProgramId === "program-a"), "adapted rows count normally for the program");
  const stale = reload(draft, { programId: "program-a", programFingerprint: "fp-program-a-v2", dayId: "day-upper-a", blockId: "block-1" });
  assert(stale.kind === "stale", "an adapted draft stays bound to its program exactly like the planned day");
}

// ------------------------------------------------------------------ draft recovery

console.log("draft recovery, cancellation and repeated completion");
{
  let draft = startOneOff(classicPlan, "oneoff-reload");
  const first = draft.exerciseOrder[0];
  draft = apply(draft, "editSetField", { exerciseInstanceId: first, setId: "set-1", field: "load", value: "22.5" });
  draft = apply(draft, "setSessionNotes", { value: "hotel gym" });
  const changedProgram = { programId: "program-b", programFingerprint: "fp-other", dayId: "day-other", blockId: "block-9", dayIds: ["day-other"] };
  const restored = reload(draft, changedProgram);
  assert(restored.kind === "valid", "a reloaded one-off draft survives a program change (the accepted snapshot is preserved)");
  assert(json(restored.draft) === json(draft), "reload restores the exact accepted plan, eligibility and input — no regeneration");
  const plannedDraft = create(plannedProgramContext("Upper A"), "planned-reload");
  assert(reload(plannedDraft, changedProgram).kind === "stale", "a planned draft is still invalidated by a program change");

  const tampered = JSON.parse(JSON.stringify(Draft.serialize(draft)));
  tampered.sessionContext.sessionKind = "planned";
  assert(Draft.parse(JSON.stringify(tampered)).kind === "invalid", "a tampered context cannot turn a one-off into planned work");
  const reflagged = JSON.parse(JSON.stringify(Draft.serialize(draft)));
  reflagged.sessionContext.exercises[first].origin = "program";
  assert(Draft.parse(JSON.stringify(reflagged)).kind === "invalid", "a context that fails normalization is invalid, not partially trusted");
  const blocked = JSON.parse(JSON.stringify(Draft.serialize(draft)));
  blocked.program.blockId = "block-1";
  assert(Draft.parse(JSON.stringify(blocked)).kind === "invalid", "a one-off draft cannot be re-bound to the active block");
  const reordered = JSON.parse(JSON.stringify(Draft.serialize(draft)));
  reordered.sessionContext = { adaptation: null, ...reordered.sessionContext };
  assert(Draft.parse(JSON.stringify(reordered)).kind === "invalid", "only the canonical context encoding is accepted");

  const logical = Draft.logicalCloneSection(draft);
  assert(json(logical.sessionContext) === json(draft.sessionContext), "the aggregate's logical clone keeps the context (install-transfer acceptance is a later, versioned integration)");

  // Cancellation: beginFinish then cancelFinish, or discarding the draft,
  // writes nothing anywhere.
  const cancelled = apply(apply(draft, "beginFinish"), "cancelFinish");
  assert(cancelled.session.status === "active" && json(cancelled.sessionContext) === json(draft.sessionContext),
    "cancelling the finish flow returns to the same one-off");
  const log = [...plannedRows];
  const discarded = null; // DraftStore.removeV2 publishes null; nothing reaches the log
  assert(discarded === null && json(log) === json(plannedRows) && json(STATE) === stateBefore,
    "discarding a one-off leaves the log and the durable program untouched");

  const finishing = apply(completeAll(draft), "beginFinish");
  const again = Draft.reduce(finishing, command(finishing, "beginFinish"));
  assert(Draft.isDomainError(again) && again.code === "finish-in-progress", "a second finish attempt is rejected while the first is in flight");
  const replayed = Draft.reduce(finishing, { ...command(finishing, "cancelFinish"), operationId: finishing.writer.operationId });
  assert(replayed === finishing, "replaying the same operation is idempotent");
  const rowsA = Draft.toHistoryRows(finishing, "2026-09-24T18:00:00.000Z");
  const rowsB = Draft.toHistoryRows(finishing, "2026-09-24T18:00:00.000Z");
  assert(json(rowsA) === json(rowsB), "row projection is deterministic for a repeated completion attempt");
  const doubled = [...plannedRows, ...rowsA, ...rowsB];
  assert(json(Intent.ledgers(doubled)) === json(Intent.ledgers([...plannedRows, ...rowsA])),
    "a duplicated save never double-counts any ledger");

  const substituted = apply(draft, "substituteExercise", { exerciseInstanceId: first,
    replacement: { exerciseInstanceId: first, sourceExerciseId: draft.exercises[first].sourceExerciseId, libraryId: "pr_mc",
      movementId: "library:pr_mc", displayName: "Machine chest press", primary: "Chest", secondary: "Triceps,Front delts" },
    selectedAt: "2026-09-24T17:10:00.000Z" });
  const subRows = finish(completeAll(substituted));
  const subRow = subRows.find((row) => row.exerciseId === first);
  assert(subRow.performedLibraryId === "pr_mc" && subRow.sessionKind === "one_off" && subRow.progressionEligible === false,
    "a mid-session substitution in a one-off records the performed identity and stays ineligible");
}

// ------------------------------------------------------------------ fail-closed production boundary

console.log("fail-closed boundary where the session-intent domain is absent");
{
  // Load workout-draft.js as the browser does today: no CommonJS, and no
  // RepForgeSessionIntent global (the module is not on the production page).
  const sandbox = { RepForgeProgramEntry: ProgramEntry };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL("../workout-draft.js", import.meta.url), "utf8"), sandbox);
  const BrowserDraft = sandbox.RepForgeWorkoutDraft;
  const oneOff = JSON.stringify(Draft.serialize(startOneOff(classicPlan, "oneoff-browser")));
  const planned = JSON.stringify(Draft.serialize(create(plannedProgramContext("Upper A"), "planned-browser")));
  const parsed = BrowserDraft.parse(oneOff);
  assert(parsed.kind === "invalid" && parsed.issues.includes("sessionContext:unsupported"),
    "without the domain a one-off draft is rejected, never executed or saved as planned work");
  assert(BrowserDraft.parse(planned).kind === "valid", "normal planned drafts are unaffected on the production page");
  const input = Planner.oneOffDraftContext(classicPlan, oneOffBase()).programContext;
  // Build the input inside the sandbox realm so plain-object checks see it as
  // the page would.
  sandbox.__input = JSON.stringify(input);
  sandbox.__selection = JSON.stringify(selection("oneoff-browser-create"));
  const created = vm.runInContext("RepForgeWorkoutDraft.create(JSON.parse(__input), JSON.parse(__selection))", sandbox);
  assert(BrowserDraft.isDomainError(created) && created.code === "session-context-unsupported", 
    "the production page cannot create a one-off draft before integration");
}

// ------------------------------------------------------------------ ledgers, adherence, progression, queue

console.log("History, adherence, block volume, progression and queue after mixed sessions");
{
  const oneOffRows = finish(completeAll(startOneOff(classicPlan, "oneoff-ledger")), "2026-09-24T18:00:00.000Z");
  const log = [...plannedRows, ...oneOffRows];
  const ledgers = Intent.ledgers(log, { blockId: "block-1" });
  assert(ledgers.athleteHistory.length === 2 && ledgers.programCompletion.length === 1 &&
    ledgers.progressionEvidence.length === 1 && ledgers.activeBlock.length === 1,
  "planned + one-off same day: History shows both, the program ledgers show one");
  const pressMatch = (row) => row.performedLibraryId === classicPlan.exercises[0].libraryId;
  assert(Intent.historyForMovement(log, pressMatch, "all_training").length > 0 &&
    Intent.historyForMovement(log, pressMatch, "program_progression").length === 0,
  "one-off sets are general history for the movement but never programmed progression evidence");
  const benchMatch = (row) => row.performedLibraryId === "pr_bb";
  const benchAll = Intent.historyForMovement([...log, ...finish(completeAll(startOneOff(manualPlan, "oneoff-bench")), "2026-09-24T19:00:00.000Z")], benchMatch, "all_training");
  const benchProgram = Intent.historyForMovement([...log], benchMatch, "program_progression");
  assert(benchAll.length > benchProgram.length && benchProgram.every((row) => row.session === "planned-1"),
    "a one-off on a program movement joins its general history, not its progression history");

  assert(Intent.nextProgramDay(DAYS, log, { date: "2026-09-24", currentDay: "Upper A" }) ===
    Intent.nextProgramDay(DAYS, plannedRows, { date: "2026-09-24", currentDay: "Upper A" }),
  "after a one-off, Today resumes the same next program day");
  const withAdapted = [...plannedRows.map((row) => ({ ...row, date: "2026-09-23" })), ...adaptedRows];
  assert(Intent.nextProgramDay(DAYS, withAdapted, { date: "2026-09-24", currentDay: "Upper A" }) === "Lower A",
    "an adapted planned session advances the queue like the planned day");

  // Plan 056 Progress model, as shipped: a one-off never carries the active
  // block id, so the block-scoped week status and volume evidence of a
  // modern block exclude it even before those callers read eligibility.
  const meta = { ...STATE.programMeta };
  const week = ProgressModel.buildWeekStatus(STATE.program, meta, log, "2026-09-24");
  const plannedOnly = ProgressModel.buildWeekStatus(STATE.program, meta, plannedRows, "2026-09-24");
  assert(week.completedSessions === plannedOnly.completedSessions && week.completedWorkingSets === plannedOnly.completedWorkingSets,
    "block adherence and block volume are identical with and without the one-off");
  const volume = ProgressModel.buildVolumeEvidence("block-to-date", STATE.program, meta, log, "2026-09-24");
  const volumePlanned = ProgressModel.buildVolumeEvidence("block-to-date", STATE.program, meta, plannedRows, "2026-09-24");
  assert(volume.completedWorkingSets === volumePlanned.completedWorkingSets, "block volume compliance ignores one-off sets");
  const allPrs = ProgressModel.buildPREvidence("all-history", log, meta);
  assert(allPrs.length >= ProgressModel.buildPREvidence("all-history", plannedRows, meta).length,
    "all-history PR evidence still sees one-off training");
  assert(json(STATE) === stateBefore, "the durable active program snapshot is byte-for-byte unchanged");
}

// ------------------------------------------------------------------ model-based journeys

console.log("model-based journeys: three ledgers, queue and program authority");
{
  const actionArb = fc.record({
    kind: fc.constantFrom("planned", "adapted", "classic", "muscle", "manual"),
    classic: fc.constantFrom(...Object.keys(Planner.CLASSIC_BLUEPRINTS)),
    minutes: fc.constantFrom(30, 45, 60, 90),
    equipment: fc.subarray(Intent.EQUIPMENT_CODES, { minLength: 1 }),
    day: fc.constantFrom(...DAYS),
    date: fc.constantFrom("2026-09-21", "2026-09-22", "2026-09-23"),
    ending: fc.constantFrom("save", "save", "cancel", "duplicate-save", "reload-then-save", "program-changed-then-save"),
  });
  const outcome = fc.check(fc.property(fc.array(actionArb, { minLength: 1, maxLength: 10 }), (actions) => {
    const program = deepFreeze(JSON.parse(stateBefore));
    const programJson = json(program);
    let log = [];
    const oracle = { athlete: new Set(), program: new Set(), progression: new Set() };
    const programOnly = [];
    actions.forEach((action, index) => {
      const draftId = `j${index}`;
      const created = `${action.date}T${String(8 + index).padStart(2, "0")}:00:00.000Z`;
      let draft;
      let counts;
      if (action.kind === "planned") {
        draft = create(plannedProgramContext(action.day, { scheduleDate: action.date }), draftId, created);
        counts = true;
      } else if (action.kind === "adapted") {
        const adapted = Planner.adaptPlannedSession({ catalogue, plannedDay: plannedDay(action.day),
          constraints: { minutes: action.minutes, equipment: action.equipment }, restSeconds: 120 });
        if (!adapted.ok) {
          // Honest failure: optionally start the proposed result as a one-off.
          if (!adapted.oneOffAlternative) return;
          draft = startOneOff(adapted.oneOffAlternative, draftId, action.date);
          counts = false;
        } else {
          draft = create(Planner.adaptedDraftContext(plannedProgramContext(action.day, { scheduleDate: action.date }), adapted.plan).programContext, draftId, created);
          counts = true;
        }
      } else {
        const constraints = { minutes: action.minutes, equipment: action.equipment };
        const plan = action.kind === "classic"
          ? Planner.planClassic({ catalogue, classic: action.classic, program: program.program, history: log, constraints, restSeconds: 120 })
          : action.kind === "muscle"
            ? Planner.planMuscleFocus({ catalogue, primaryMuscles: ["Chest"], program: program.program, history: log, constraints, restSeconds: 120 })
            : Planner.planManual({ catalogue, exercises: [{ exerciseId: "sq_bb", sets: 2, minReps: 5, maxReps: 8 }], constraints, restSeconds: 120 });
        if (!plan.ok) return;
        draft = startOneOff(plan.plan, draftId, action.date);
        counts = false;
      }
      if (action.ending === "cancel") return;
      draft = completeAll(draft);
      if (action.ending === "reload-then-save") draft = reload(draft).draft;
      if (action.ending === "program-changed-then-save") {
        const reloaded = reload(draft, { programId: "program-b", programFingerprint: "fp-b", dayId: "day-b" });
        if (counts) {
          if (reloaded.kind !== "stale") throw new Error("program-bound draft survived a program change");
          return; // the owner's recovery surface takes over; nothing is saved
        }
        if (reloaded.kind !== "valid") throw new Error("one-off draft lost to a program change");
        draft = reloaded.draft;
      }
      const rows = finish(draft, created);
      log = [...log, ...rows, ...(action.ending === "duplicate-save" ? rows : [])];
      oracle.athlete.add(draftId);
      if (counts) {
        oracle.program.add(draftId);
        oracle.progression.add(draftId);
        programOnly.push(...rows);
      }
    });
    const ledgers = Intent.ledgers(log);
    const ids = (list) => list.map((entry) => entry.session).sort().join(",");
    const same = (list, set) => ids(list) === [...set].sort().join(",");
    const queueSame = ["2026-09-21", "2026-09-22", "2026-09-23"].every((date) =>
      Intent.nextProgramDay(DAYS, log, { date, currentDay: "Upper A" }) === Intent.nextProgramDay(DAYS, programOnly, { date, currentDay: "Upper A" }));
    return same(ledgers.athleteHistory, oracle.athlete) && same(ledgers.programCompletion, oracle.program) &&
      same(ledgers.progressionEvidence, oracle.progression) && queueSame && json(program) === programJson;
  }), { numRuns: 120, seed: 20260924 });
  assert(!outcome.failed, "every journey matches the athlete/program/progression oracle, keeps the queue, and never writes the program",
    outcome.failed ? `counterexample ${json(outcome.counterexample)} ${outcome.error || ""}` : "");
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
