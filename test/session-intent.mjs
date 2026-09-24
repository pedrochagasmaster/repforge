#!/usr/bin/env node
// Session provenance and eligibility contract (one-off spec §10–§11).
// Pure Node: exercises session-intent.js directly, no browser.
import { createRequire } from "node:module";
import fc from "fast-check";

const require = createRequire(import.meta.url);
const Intent = require("../session-intent.js");

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

function oneOffContext(overrides = {}) {
  return {
    schemaVersion: 1,
    sessionKind: "one_off",
    oneOffIntent: "classic",
    name: "Push",
    source: { programId: "program-a", programFingerprint: "fp-a", dayId: null, dayLabel: null },
    focus: { classic: "push", primaryMuscles: [], secondaryMuscles: [] },
    constraints: { minutes: 45, equipment: ["cable", "dumbbell"], minimizeEquipmentChanges: false },
    generation: { engineVersion: 1, blueprintId: "classic-push", blueprintVersion: 1, catalogVersion: "catalog-x" },
    exercises: { "oneoff:1:pr_db": { origin: "catalogue", sourceExerciseId: null, sourceDay: null, isNew: false } },
    adaptation: null,
    ...overrides,
  };
}

function adaptedContext(overrides = {}) {
  return {
    schemaVersion: 1,
    sessionKind: "planned_adapted",
    oneOffIntent: null,
    name: "Upper A",
    source: { programId: "program-a", programFingerprint: "fp-a", dayId: "day-upper-a", dayLabel: "Upper A" },
    focus: null,
    constraints: { minutes: 30, equipment: null, minimizeEquipmentChanges: false },
    generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "catalog-x" },
    exercises: {
      bench: { origin: "program", sourceExerciseId: "bench", sourceDay: "Upper A", isNew: false },
      row: { origin: "substitute", sourceExerciseId: "row", sourceDay: "Upper A", isNew: false },
    },
    adaptation: { preservedPurposes: ["bench"], omittedExerciseIds: ["fly"], purposePreserved: true },
    ...overrides,
  };
}

const row = (fields) => ({ session: "s1", date: "2026-09-20", day: "Upper A", name: "Bench", exerciseId: "bench",
  set: 1, load: 80, reps: 8, rir: 2, created: "2026-09-20T10:00:00Z", ...fields });

console.log("session context normalization");
{
  const ok = Intent.normalizeContext(oneOffContext());
  assert(ok.ok && Object.isFrozen(ok.context), "a classic one-off context normalizes to a frozen canonical value");
  assert(ok.ok && json(ok.context.constraints.equipment) === json(["dumbbell", "cable"]),
    "equipment normalizes into canonical catalogue order");
  const adapted = Intent.normalizeContext(adaptedContext());
  assert(adapted.ok, "an adapted planned context naming its exact program day normalizes");
  const manual = Intent.normalizeContext(oneOffContext({ oneOffIntent: "manual", focus: null, constraints: null,
    generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: null } }));
  assert(manual.ok, "a manual one-off needs no focus, constraints, or blueprint");
  const muscle = Intent.normalizeContext(oneOffContext({ oneOffIntent: "muscle_focus", name: "Chest",
    focus: { classic: null, primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps", "Side delts"] },
    generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } }));
  assert(muscle.ok, "a muscle-focus context uses canonical muscle tokens");

  const malformed = [
    ["unknown kind", oneOffContext({ sessionKind: "quick" })],
    ["Pro program mix before it exists", oneOffContext({ oneOffIntent: "program_mix" })],
    ["one-off without intent", oneOffContext({ oneOffIntent: null })],
    ["adapted with an intent", adaptedContext({ oneOffIntent: "classic" })],
    ["unsupported equipment code", oneOffContext({ constraints: { minutes: 45, equipment: ["kettlebell"], minimizeEquipmentChanges: false } })],
    ["plural program vocabulary leaking in", oneOffContext({ constraints: { minutes: 45, equipment: ["dumbbells"], minimizeEquipmentChanges: false } })],
    ["empty equipment selection", oneOffContext({ constraints: { minutes: 45, equipment: [], minimizeEquipmentChanges: false } })],
    ["duplicate equipment", oneOffContext({ constraints: { minutes: 45, equipment: ["cable", "cable"], minimizeEquipmentChanges: false } })],
    ["off-menu time budget", oneOffContext({ constraints: { minutes: 44, equipment: ["cable"], minimizeEquipmentChanges: false } })],
    ["non-boolean minimize flag", oneOffContext({ constraints: { minutes: 45, equipment: ["cable"], minimizeEquipmentChanges: "yes" } })],
    ["unknown constraint key", oneOffContext({ constraints: { minutes: 45, equipment: ["cable"], minimizeEquipmentChanges: false, gym: "hotel" } })],
    ["invented muscle token", oneOffContext({ oneOffIntent: "muscle_focus", focus: { classic: null, primaryMuscles: ["Pecs"], secondaryMuscles: [] },
      generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } })],
    ["two primary muscles", oneOffContext({ oneOffIntent: "muscle_focus", focus: { classic: null, primaryMuscles: ["Chest", "Lats"], secondaryMuscles: [] },
      generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } })],
    ["three secondary muscles", oneOffContext({ oneOffIntent: "muscle_focus", focus: { classic: null, primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps", "Side delts", "Abs"] },
      generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } })],
    ["primary repeated as secondary", oneOffContext({ oneOffIntent: "muscle_focus", focus: { classic: null, primaryMuscles: ["Chest"], secondaryMuscles: ["Chest"] },
      generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } })],
    ["classic without blueprint", oneOffContext({ generation: { engineVersion: 1, blueprintId: null, blueprintVersion: null, catalogVersion: "c" } })],
    ["no exercises", oneOffContext({ exercises: {} })],
    ["program-derived exercise without its source", oneOffContext({ exercises: { a: { origin: "program", sourceExerciseId: null, sourceDay: null, isNew: false } } })],
    ["catalogue exercise pretending to a program source", oneOffContext({ exercises: { a: { origin: "catalogue", sourceExerciseId: "bench", sourceDay: "Upper A", isNew: false } } })],
    ["adapted session without its program day", adaptedContext({ source: { programId: "program-a", programFingerprint: "fp-a", dayId: null, dayLabel: null } })],
    ["adapted session with catalogue fill", adaptedContext({ exercises: { x: { origin: "catalogue", sourceExerciseId: null, sourceDay: null, isNew: true } } })],
    ["adapted session that lost its purpose", adaptedContext({ adaptation: { preservedPurposes: ["bench"], omittedExerciseIds: [], purposePreserved: false } })],
    ["adapted session without constraints", adaptedContext({ constraints: null })],
    ["one-off carrying adaptation data", oneOffContext({ adaptation: { preservedPurposes: ["a"], omittedExerciseIds: [], purposePreserved: true } })],
    ["unknown top-level field", oneOffContext({ progressionEligible: true })],
    ["wrong schema version", oneOffContext({ schemaVersion: 2 })],
    ["blank name", oneOffContext({ name: "   " })],
  ];
  for (const [label, value] of malformed) {
    const result = Intent.normalizeContext(value);
    assert(!result.ok && result.issues.length > 0, `rejects ${label}`, json(result));
  }
  assert(!Intent.normalizeContext(null).ok && !Intent.normalizeContext([]).ok, "rejects non-object contexts");
}

console.log("classification (spec §10 consequences)");
{
  const planned = Intent.classify(null);
  const adapted = Intent.classify(Intent.normalizeContext(adaptedContext()).context);
  const oneOff = Intent.classify(Intent.normalizeContext(oneOffContext()).context);
  assert(planned.isPlanned && planned.countsAsProgramDay && planned.adherenceEligible && planned.progressionEligible &&
    planned.altersDayQueue, "no context is a normal planned session with every program consequence");
  assert(adapted.isAdaptedPlanned && adapted.countsAsProgramDay && adapted.adherenceEligible &&
    adapted.blockVolumeEligible && adapted.progressionEligible && adapted.altersDayQueue,
  "an adapted planned session keeps normal completion and progression semantics");
  assert(oneOff.isOneOff && !oneOff.countsAsProgramDay && !oneOff.adherenceEligible && !oneOff.blockVolumeEligible &&
    !oneOff.progressionEligible && !oneOff.altersDayQueue, "a pure one-off has no program consequence");
  assert(oneOff.historyVisible && oneOff.allTrainingEligible && adapted.historyVisible && planned.historyVisible,
    "every kind remains athlete history");
  assert(oneOff.generatedBy.intent === "classic" && oneOff.generatedBy.blueprintId === "classic-push" &&
    oneOff.generatedBy.catalogVersion === "catalog-x", "classification says what generated the session");
  assert(json(oneOff.constraints.equipment) === json(["dumbbell", "cable"]), "classification exposes the shaping constraints");
  assert(Intent.classify({ sessionKind: "mystery" }) === null, "an unknown kind has no classification");
  const context = Intent.normalizeContext(oneOffContext()).context;
  assert(Intent.exerciseProgressionEvidence(context, "oneoff:1:pr_db") === false,
    "no performed one-off exercise is progression evidence");
  assert(Intent.exerciseProgressionEvidence(Intent.normalizeContext(adaptedContext()).context, "row") === true,
    "adapted exercises, substitutes included, remain progression evidence by performed identity");
  assert(Intent.exerciseProgressionEvidence(null, "anything") === true, "planned exercises remain progression evidence");
}

console.log("row stamp and eligibility");
{
  const oneOff = Intent.normalizeContext(oneOffContext()).context;
  const adapted = Intent.normalizeContext(adaptedContext()).context;
  assert(json(Intent.rowFields(null, "bench")) === "{}", "planned rows gain no fields (backward compatible)");
  assert(json(Intent.rowFields(oneOff, "oneoff:1:pr_db")) === json({ sessionKind: "one_off", programCompletionEligible: false,
    progressionEligible: false, oneOffIntent: "classic" }), "one-off rows carry kind, intent and false eligibility");
  assert(json(Intent.rowFields(adapted, "row")) === json({ sessionKind: "planned_adapted", programCompletionEligible: true,
    progressionEligible: true, sourceProgramId: "program-a", sourceExerciseId: "row", sourceDay: "Upper A" }),
  "adapted rows name their program and source exercise");

  const legacy = Intent.rowEligibility(row({}));
  assert(legacy.legacy && legacy.programCompletion && legacy.progression, "older rows without fields keep legacy eligibility");
  const explicitFalse = Intent.rowEligibility(row({ programCompletionEligible: false }));
  assert(!explicitFalse.programCompletion && explicitFalse.progression, "an explicit false flag is honored field by field");
  const claiming = Intent.rowEligibility(row({ sessionKind: "one_off", programCompletionEligible: true, progressionEligible: true }));
  assert(!claiming.programCompletion && !claiming.progression, "a one-off row claiming eligibility still fails closed");
  const future = Intent.rowEligibility(row({ sessionKind: "program_mix" }));
  assert(future.sessionKind === "unknown" && !future.programCompletion && !future.progression,
    "an unknown kind is excluded from the program ledgers");
  assert(!Intent.rowEligibility(null).programCompletion, "a malformed row is never program evidence");
}

console.log("scoped selectors (spec §11.5)");
{
  const log = [
    row({ session: "planned", day: "Upper A" }),
    row({ session: "adapted", day: "Lower A", sessionKind: "planned_adapted", programCompletionEligible: true, progressionEligible: true }),
    row({ session: "oneoff", day: "Push", sessionKind: "one_off", oneOffIntent: "classic", programCompletionEligible: false, progressionEligible: false }),
  ];
  const ids = (scope, options) => Intent.selectRows(log, scope, options).map((item) => item.session).join(",");
  assert(ids("all_training") === "planned,adapted,oneoff", "all_training keeps every performed set (History, PRs, general stats)");
  assert(ids("program_completion") === "planned,adapted", "program_completion excludes pure one-offs");
  assert(ids("program_progression") === "planned,adapted", "program_progression excludes pure one-offs");
  const blockLog = log.map((item) => item.session === "oneoff" ? item : { ...item, blockId: "block-1" });
  assert(Intent.selectRows(blockLog, "active_block", { blockId: "block-1" }).map((item) => item.session).join(",") === "planned,adapted",
    "active_block requires completion eligibility and block provenance");
  const withBlock = log.map((item) => ({ ...item, blockId: "block-1" }));
  assert(Intent.selectRows(withBlock, "active_block", { blockId: "block-1" }).every((item) => item.session !== "oneoff"),
    "a one-off row is excluded from the active block even if it carried the block id");
  let thrown = false;
  try { Intent.rowInScope(log[0], "everything"); } catch { thrown = true; }
  assert(thrown, "an unknown scope is a programming error, not a silent fallback");
  const matches = (item) => item.name === "Bench";
  assert(Intent.historyForMovement(log, matches, "all_training").length === 3 &&
    Intent.historyForMovement(log, matches, "program_progression").length === 2,
  "historyForMovement narrows authority without weakening the identity matcher");
}

console.log("sessions, repeated completion, and the three ledgers");
{
  const log = [
    row({ session: "a", date: "2026-09-21", day: "Upper A", created: "2026-09-21T09:00:00Z" }),
    row({ session: "a", date: "2026-09-21", day: "Upper A", set: 2, created: "2026-09-21T09:00:00Z" }),
    row({ session: "b", date: "2026-09-21", day: "Upper B", sessionKind: "one_off", oneOffIntent: "manual",
      programCompletionEligible: false, progressionEligible: false, created: "2026-09-21T18:00:00Z" }),
  ];
  const duplicated = [...log, ...log];
  assert(json(Intent.ledgers(duplicated)) === json(Intent.ledgers(log)), "a repeated completion attempt never adds a session to any ledger");
  const ledgers = Intent.ledgers(log);
  assert(ledgers.athleteHistory.length === 2 && ledgers.programCompletion.length === 1 && ledgers.progressionEvidence.length === 1,
    "planned + one-off on one date: two History sessions, one program session");
  assert(ledgers.athleteHistory[1].sessionKind === "one_off", "athlete history keeps the one-off's kind");
}

console.log("program day queue projection");
{
  const days = ["Upper A", "Lower A", "Upper B", "Lower B"];
  const planned = [row({ session: "p1", date: "2026-09-21", day: "Upper A", created: "2026-09-21T09:00:00Z" })];
  const expected = Intent.nextProgramDay(days, planned, { date: "2026-09-21", currentDay: "Upper A" });
  assert(expected === "Lower A", "the queue advances after a planned session");
  const withOneOff = [...planned, row({ session: "o1", date: "2026-09-21", day: "Upper B", sessionKind: "one_off",
    oneOffIntent: "classic", programCompletionEligible: false, progressionEligible: false, created: "2026-09-21T18:00:00Z" })];
  assert(Intent.nextProgramDay(days, withOneOff, { date: "2026-09-21", currentDay: "Upper A" }) === expected,
    "a later one-off named like a program day does not move the queue");
  const onlyOneOff = withOneOff.slice(1);
  assert(Intent.nextProgramDay(days, onlyOneOff, { date: "2026-09-21", currentDay: "Lower B" }) ===
    Intent.nextProgramDay(days, [], { date: "2026-09-21", currentDay: "Lower B" }),
  "a one-off alone leaves Today on the same next program day it would have shown");
  const adapted = [row({ session: "a1", date: "2026-09-21", day: "Upper A", sessionKind: "planned_adapted",
    programCompletionEligible: true, progressionEligible: true })];
  assert(Intent.nextProgramDay(days, adapted, { date: "2026-09-21", currentDay: "Upper A" }) === "Lower A",
    "an adapted planned session advances the queue exactly like the planned day");
  assert(Intent.nextProgramDay([], planned, {}) === null && Intent.nextProgramDay(["Only"], [row({ day: "Only" })], { currentDay: "Only" }) === null,
    "degenerate programs keep Today's existing null answer");

  fc.assert(fc.property(
    fc.array(fc.record({ kind: fc.constantFrom("planned", "one_off"), day: fc.constantFrom(...days, "Push", "Legs") }), { maxLength: 12 }),
    fc.constantFrom(...days),
    (journey, current) => {
      const all = journey.map((item, index) => row({
        session: `s${index}`, date: "2026-09-22", created: `2026-09-22T${String(10 + index).padStart(2, "0")}:00:00Z`,
        day: item.kind === "planned" ? (days.includes(item.day) ? item.day : days[0]) : item.day,
        ...(item.kind === "one_off" ? { sessionKind: "one_off", oneOffIntent: "manual", programCompletionEligible: false, progressionEligible: false } : {}),
      }));
      const withoutOneOffs = all.filter((item) => item.sessionKind !== "one_off");
      return Intent.nextProgramDay(days, all, { date: "2026-09-22", currentDay: current }) ===
        Intent.nextProgramDay(days, withoutOneOffs, { date: "2026-09-22", currentDay: current });
    }), { numRuns: 300, seed: 5701 });
  assert(true, "property: removing every one-off from any journey never changes the next program day");
}

console.log("History classification");
{
  const oneOffRows = [row({ day: "Push", sessionKind: "one_off", oneOffIntent: "classic", programCompletionEligible: false, progressionEligible: false })];
  const cls = Intent.historyClass(oneOffRows);
  assert(cls.historyClass === "one_off" && cls.oneOffIntent === "classic" && cls.label === "Push" && !cls.countsAsProgramDay,
    "a one-off session projects as One-off with its saved label unchanged");
  const legacy = Intent.historyClass([row({})]);
  assert(legacy.historyClass === "planned" && legacy.legacy && legacy.countsAsProgramDay, "legacy sessions stay planned");
  assert(Intent.historyClass([]) === null, "an empty session has no class");
}

console.log("draft coherence rules");
{
  const context = Intent.normalizeContext(oneOffContext()).context;
  const draft = { exerciseOrder: ["oneoff:1:pr_db"], program: { programId: "program-a", dayId: "one-off:classic", dayLabel: "Push" } };
  assert(Intent.draftIssues(context, draft).length === 0, "a coherent one-off draft has no issues");
  assert(Intent.draftIssues(context, { ...draft, program: { ...draft.program, blockId: "block-1" } }).includes("sessionContext:one-off-block"),
    "a one-off draft may not carry the active block");
  assert(Intent.draftIssues(context, { ...draft, program: { ...draft.program, dayId: "day-upper-a" } }).includes("sessionContext:one-off-day"),
    "a one-off draft may not impersonate a program day id");
  assert(Intent.draftIssues(context, { ...draft, exerciseOrder: ["other"] }).includes("sessionContext.exercises:coverage"),
    "context exercise provenance must cover the draft exactly");
  const adapted = Intent.normalizeContext(adaptedContext()).context;
  assert(Intent.draftIssues(adapted, { exerciseOrder: ["bench", "row"], program: { programId: "program-a", dayId: "day-lower", dayLabel: "Upper A" } })
    .includes("sessionContext:adapted-day"), "an adapted draft must execute its own program day");
  assert(Intent.bindsToProgram(adapted) && !Intent.bindsToProgram(context) && Intent.bindsToProgram(null),
    "only pure one-offs are released from program binding");
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
