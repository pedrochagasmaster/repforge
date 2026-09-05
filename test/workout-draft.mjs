#!/usr/bin/env node
import { createRequire } from "node:module";
import fc from "fast-check";

const require = createRequire(import.meta.url);
const Draft = require("../workout-draft.js");

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

function programContext({ rirMode = "numeric" } = {}) {
  return {
    programId: "program-051",
    programFingerprint: "fingerprint-051",
    durableRevision: 17,
    dayId: "stable-day-1",
    dayLabel: "Day 1",
    scheduleDate: "2026-08-15",
    unit: "kg",
    rirMode,
    exercises: [
      {
        exerciseInstanceId: "slot-squat",
        sourceExerciseId: "source-squat",
        libraryId: "sq_hs",
        displayName: "Hack squat",
        sets: 2,
        setIds: ["squat-set-1", "squat-set-2"],
        minReps: 6,
        maxReps: 10,
        targetRir: 2,
        notes: "Feet shoulder width",
        primary: "Quads",
        secondary: "Glutes,Adductors",
        movementPattern: "squat",
        progressionStrategy: "double_progression",
        sourceFingerprint: "source-fingerprint-squat",
        programmedSets: [
          { suggestedLoad: 50, suggestedReps: 10, targetRir: 2 },
          { suggestedLoad: 52.5, suggestedReps: 8, targetRir: 1 },
        ],
      },
      {
        exerciseInstanceId: "slot-curl",
        sourceExerciseId: "source-curl",
        movementId: "slot:slot-curl",
        displayName: "Seated leg curl",
        sets: 1,
        setIds: ["curl-set-1"],
        minReps: 8,
        maxReps: 12,
        targetRir: 2,
        notes: "",
        primary: "Hamstrings",
        secondary: "",
        movementPattern: "knee_flexion",
        progressionStrategy: "double_progression",
        sourceFingerprint: "source-fingerprint-curl",
        programmedSets: [{ suggestedLoad: 30, suggestedReps: 12, targetRir: 2 }],
      },
    ],
  };
}

function sessionSelection() {
  return {
    draftId: "draft-051",
    writer: { installationId: "install-a", tabId: "tab-a", operationId: "create-051" },
    startedAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
    scheduleDate: "2026-08-15",
    selectedExerciseId: "slot-squat",
    bodyweight: "",
    notes: "",
  };
}

function fresh(options) {
  return Draft.create(programContext(options), sessionSelection(), {
    "slot-squat": {
      exerciseInstanceId: "slot-squat",
      setupNotes: "Previous rack setting",
      sets: [
        { ordinal: 1, load: 47.5, reps: 9, rir: 2 },
        { ordinal: 2, load: 47.5, reps: 8, rir: 1 },
      ],
    },
  });
}

let operation = 0;
function command(draft, type, values = {}) {
  const id = `operation-${++operation}`;
  const input = {
    type,
    operationId: id,
    expectedRevision: draft.revision,
    updatedAt: `2026-08-15T10:${String(operation).padStart(2, "0")}:00.000Z`,
    writer: { installationId: "install-a", tabId: "tab-a" },
    ...values,
  };
  return { input, result: Draft.reduce(draft, input) };
}

function apply(draft, type, values) {
  const step = command(draft, type, values);
  if (Draft.isDomainError(step.result)) throw new Error(`${type}: ${JSON.stringify(step.result)}`);
  return step.result;
}

function same(value, expected) {
  return JSON.stringify(value) === JSON.stringify(expected);
}

console.log("DraftV2 creation and serialization");
const initial = fresh();
assert(!Draft.isDomainError(initial), "create accepts explicit program, session, writer, and stable set identities", JSON.stringify(initial));
assert(initial.schemaVersion === 2 && initial.revision === 0 && initial.draftId === "draft-051", "create establishes the version and initial revision");
assert(Object.isFrozen(Draft) && Object.isFrozen(initial) && Object.isFrozen(initial.exercises["slot-squat"].sets["squat-set-1"]), "the public API and aggregate are frozen deeply");
assert(same(initial.exerciseOrder, ["slot-squat", "slot-curl"]) &&
  same(initial.exercises["slot-squat"].setOrder, ["squat-set-1", "squat-set-2"]), "create preserves explicit exercise and set order");
assert(initial.exercises["slot-squat"].sets["squat-set-1"].edited.load === "50" &&
  initial.exercises["slot-squat"].sets["squat-set-2"].edited.reps === "8", "programmed suggestions become untapped draft field text");
assert(initial.exercises["slot-squat"].programmed.notes === "Feet shoulder width" &&
  initial.exercises["slot-squat"].setupNotes === "Previous rack setting", "programmed setup instructions stay distinct from the lifter's exercise note");

const serialized = Draft.serialize(initial);
const parsed = Draft.parse(JSON.stringify(serialized), programContext());
assert(parsed.kind === "valid" && same(parsed.draft, initial), "serialize and parse round-trip the complete aggregate");
assert(Draft.parse(null).kind === "absent" && Draft.parse("{").kind === "invalid", "parse distinguishes absent and invalid storage");
assert(Draft.parse(JSON.stringify({ __day: "Day 1", slot_1_load: "50" })).kind === "legacy", "parse classifies the legacy flat shape without migrating it");
assert(Draft.parse(JSON.stringify(serialized), { programId: "other" }).kind === "stale", "parse rejects a valid draft from a different current program as stale");
const forgedSubstitution = structuredClone(serialized);
forgedSubstitution.exercises["slot-squat"].substitution = {
  original: {
    exerciseInstanceId: "slot-squat",
    sourceExerciseId: "source-curl",
    displayName: "Seated leg curl",
    primary: "Hamstrings",
    secondary: "",
  },
  replacement: {
    exerciseInstanceId: "replacement-pulldown-051",
    sourceExerciseId: "pd_mc",
    libraryId: "pd_mc",
    displayName: "Lat pulldown",
    primary: "Lats",
    secondary: "Biceps,Forearms",
  },
  selectedAt: "2026-08-15T10:00:00.000Z",
};
const forgedParsed = Draft.parse(JSON.stringify(forgedSubstitution));
assert(forgedParsed.kind === "invalid" && forgedParsed.issues.some((issue) => issue.endsWith("substitution.original:provenance")),
  "parse rejects a substitution whose original snapshot does not match its owning exercise", JSON.stringify(forgedParsed));

const clone = Draft.logicalCloneSection(initial);
assert(!hasOwn(clone, "writer") && !hasOwn(clone, "revision") && !hasOwn(clone.program, "durableRevision") &&
  hasOwn(initial, "writer") && initial.revision === 0 && initial.program.durableRevision === 17 &&
  same(clone.exercises, initial.exercises), "logical clone strips writer and operational revisions without mutating logical state");
function hasOwn(value, key) { return Object.prototype.hasOwnProperty.call(value, key); }

console.log("\nClosed command transitions and correction semantics");
let draft = initial;
const originalBytes = JSON.stringify(draft);
draft = apply(draft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "load", value: "55" });
assert(JSON.stringify(initial) === originalBytes && initial.revision === 0, "reduce never mutates its input aggregate");
assert(draft.revision === 1 && draft.exercises["slot-squat"].sets["squat-set-1"].edited.load === "55" &&
  draft.exercises["slot-squat"].sets["squat-set-1"].touched.load, "editSetField records exact field text and touch state");

draft = apply(draft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "reps", value: "10" });
draft = apply(draft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "rir", value: "2" });
draft = apply(draft, "completeSet", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", completedAt: "2026-08-15T10:05:00.000Z" });
assert(draft.exercises["slot-squat"].sets["squat-set-1"].completion.completedAt.endsWith(".000Z"), "completeSet commits a saveable set with caller time");
draft = apply(draft, "uncommitSet", { exerciseInstanceId: "slot-squat", setId: "squat-set-1" });
assert(draft.exercises["slot-squat"].sets["squat-set-1"].completion === "pending" &&
  draft.exercises["slot-squat"].sets["squat-set-1"].edited.load === "55", "uncommitSet retains corrected values and touches");
draft = apply(draft, "completeSet", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", completedAt: "2026-08-15T10:06:00.000Z" });

draft = apply(draft, "markWarmup", { exerciseInstanceId: "slot-squat", setId: "squat-set-2" });
assert(draft.exercises["slot-squat"].sets["squat-set-2"].role === "warmup", "markWarmup changes only the explicit set role");
draft = apply(draft, "markWorking", { exerciseInstanceId: "slot-squat", setId: "squat-set-2" });
assert(draft.exercises["slot-squat"].sets["squat-set-2"].role === "working", "markWorking reverses the role without changing values");
draft = apply(draft, "markWarmup", { exerciseInstanceId: "slot-squat", setId: "squat-set-2" });

const beforeSkip = JSON.stringify(draft.exercises["slot-curl"]);
draft = apply(draft, "skipExercise", { exerciseInstanceId: "slot-curl" });
draft = apply(draft, "restoreExercise", { exerciseInstanceId: "slot-curl" });
assert(JSON.stringify(draft.exercises["slot-curl"]) === beforeSkip,
  "skip and restore preserve the complete exercise subtree");

const replacement = {
  exerciseInstanceId: "replacement-pulldown-051",
  sourceExerciseId: "pd_mc",
  libraryId: "pd_mc",
  displayName: "Lat pulldown",
  primary: "Lats",
  secondary: "Biceps,Forearms",
};
const beforeSubstitution = JSON.stringify(draft.exercises["slot-squat"].sets);
draft = apply(draft, "substituteExercise", {
  exerciseInstanceId: "slot-squat",
  replacement,
  selectedAt: "2026-08-15T10:07:00.000Z",
});
assert(draft.exercises["slot-squat"].substitution.original.sourceExerciseId === "source-squat" &&
  draft.exercises["slot-squat"].substitution.replacement.libraryId === "pd_mc", "substitution snapshots distinct original and performed provenance");
const reusedIdentity = command(draft, "substituteExercise", {
  exerciseInstanceId: "slot-squat",
  replacement: { ...replacement, exerciseInstanceId: "slot-curl" },
  selectedAt: "2026-08-15T10:07:30.000Z",
}).result;
assert(reusedIdentity.code === "substitution-identity-in-use", "substitution cannot reuse another active exercise's historical identity");
draft = apply(draft, "restoreOriginalExercise", { exerciseInstanceId: "slot-squat" });
assert(draft.exercises["slot-squat"].substitution === null && JSON.stringify(draft.exercises["slot-squat"].sets) === beforeSubstitution,
  "restoreOriginalExercise retains every set value and identity");
draft = apply(draft, "substituteExercise", {
  exerciseInstanceId: "slot-squat",
  replacement,
  selectedAt: "2026-08-15T10:08:00.000Z",
});

draft = apply(draft, "repeatPreviousSetValues", {
  exerciseInstanceId: "slot-curl",
  values: [{ ordinal: 1, load: 35, reps: 12, rir: 2 }],
});
const repeated = draft.exercises["slot-curl"].sets["curl-set-1"];
assert(same(repeated.edited, { load: "35", reps: "12", rir: "2", effort: null }) &&
  repeated.completion === "pending" && repeated.touched.load && repeated.touched.reps && repeated.touched.effort,
  "repeatPreviousSetValues copies caller-supplied previous-session values as edits without completion", JSON.stringify(repeated));

draft = apply(draft, "setExerciseNotes", { exerciseInstanceId: "slot-squat", value: "Rack 7, shoulder blades down." });
draft = apply(draft, "setSessionNotes", { value: "Plan 051 parity session" });
draft = apply(draft, "setBodyweight", { value: "82.5" });
draft = apply(draft, "setSessionDate", { value: "2026-08-16" });
draft = apply(draft, "selectExercise", { exerciseInstanceId: "slot-curl" });
assert(draft.session.notes.includes("parity") && draft.session.bodyweight === "82.5" &&
  draft.program.scheduleDate === "2026-08-16" && draft.session.selectedExerciseId === "slot-curl", "session and exercise metadata commands update the aggregate");

const setOrderBeforeReorder = draft.exerciseOrder.map((id) =>
  [id, draft.exercises[id].setOrder.slice(), JSON.stringify(draft.exercises[id].sets), draft.exercises[id].programmed.order]);
draft = apply(draft, "reorderExercises", { exerciseOrder: ["slot-curl", "slot-squat"] });
assert(same(draft.exerciseOrder, ["slot-curl", "slot-squat"]) && setOrderBeforeReorder.every(([id, order, sets, programmedOrder]) =>
  same(draft.exercises[id].setOrder, order) && JSON.stringify(draft.exercises[id].sets) === sets &&
  draft.exercises[id].programmed.order === programmedOrder), "exercise reorder preserves programmed snapshots, set order, and content");

const finishStep = command(draft, "beginFinish");
const finishing = finishStep.result;
assert(finishing.session.status === "finishing", "beginFinish creates a revisioned finish snapshot");
assert(Draft.reduce(finishing, finishStep.input) === finishing, "replaying the latest operation is idempotent");
const stale = Draft.reduce(finishing, { ...finishStep.input, operationId: "stale-operation", expectedRevision: finishing.revision - 1 });
assert(stale.code === "stale-revision", "a command against an old revision fails closed");
const editWhileFinishing = command(finishing, "setSessionNotes", { value: "must not land" }).result;
assert(editWhileFinishing.code === "finish-in-progress", "ordinary edits cannot mutate an open finish snapshot");
const activeAgain = apply(finishing, "cancelFinish");
assert(activeAgain.session.status === "active", "cancelFinish reopens the same draft without losing values");
assert(command(activeAgain, "unknownCommand").result.code === "unknown-command", "the reducer rejects commands outside its closed set");
for (const [name, values, code] of [
  ["missing set id", { exerciseInstanceId: "slot-squat", field: "load", value: "5" }, "unknown-set"],
  ["unknown set id", { exerciseInstanceId: "slot-squat", setId: "missing", field: "load", value: "5" }, "unknown-set"],
  ["inherited set key", { exerciseInstanceId: "slot-squat", setId: "toString", field: "load", value: "5" }, "unknown-set"],
  ["inherited exercise key", { exerciseInstanceId: "toString", setId: "missing", field: "load", value: "5" }, "unknown-exercise"],
]) {
  const result = command(activeAgain, "editSetField", values).result;
  assert(result.code === code, `${name} returns a domain error instead of throwing`, JSON.stringify(result));
}
for (const [type, values] of [
  ["completeSet", { completedAt: "2026-08-15T10:30:00.000Z" }],
  ["uncommitSet", {}],
  ["markWarmup", {}],
  ["markWorking", {}],
]) {
  const result = command(activeAgain, type, {
    exerciseInstanceId: "slot-squat",
    setId: "toString",
    ...values,
  }).result;
  assert(result.code === "unknown-set", `${type} rejects an inherited set key without throwing`, JSON.stringify(result));
}
const inheritedRepeat = command(activeAgain, "repeatPreviousSetValues", {
  exerciseInstanceId: "slot-squat",
  values: [{ setId: "toString", load: 50 }],
}).result;
assert(inheritedRepeat.code === "unknown-set", "repeatPreviousSetValues rejects an inherited set key without throwing", JSON.stringify(inheritedRepeat));

console.log("\nDraft validity remains distinct from save readiness");
let invalidText = fresh();
invalidText = apply(invalidText, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "load", value: "1e3" });
invalidText = apply(invalidText, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "reps", value: "" });
assert(Draft.validate(invalidText).ok && Draft.parse(JSON.stringify(invalidText)).kind === "valid", "blank and invalid numeric text remains a valid reloadable draft");
assert(Draft.validateForSave(apply(invalidText, "beginFinish")).some((issue) => issue.code === "invalid-load") &&
  Draft.validateForSave(apply(invalidText, "beginFinish")).some((issue) => issue.code === "invalid-reps"), "save validation rejects exponent load and blank reps without clearing them");

function saveIssueFor(load) {
  let candidate = fresh();
  candidate = apply(candidate, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "load", value: load });
  candidate = apply(candidate, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "reps", value: "8" });
  candidate = apply(candidate, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "rir", value: "2" });
  candidate = apply(candidate, "beginFinish");
  return Draft.validateForSave(candidate);
}
assert(!saveIssueFor("1000").some((issue) => issue.code === "invalid-load"), "the inclusive 1000 kg load boundary remains saveable");
for (const value of ["1000.1", "1e3", "1,5", ".5", "-5", "0"]) {
  assert(saveIssueFor(value).some((issue) => issue.code === "invalid-load"), `load grammar rejects ${JSON.stringify(value)}`);
}

let badDate = fresh();
badDate = apply(badDate, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "load", value: "50" });
badDate = apply(badDate, "setSessionDate", { value: "2026-02-30" });
badDate = apply(badDate, "setBodyweight", { value: "-1" });
badDate = apply(badDate, "beginFinish");
assert(Draft.validateForSave(badDate).some((issue) => issue.code === "invalid-date") &&
  Draft.validateForSave(badDate).some((issue) => issue.code === "invalid-bodyweight"), "invalid editable date and bodyweight remain recoverable but block save");
let blankDate = fresh();
blankDate = apply(blankDate, "setSessionDate", { value: "" });
assert(Draft.validate(blankDate).ok && Draft.parse(JSON.stringify(blankDate)).kind === "valid", "a blank edited date remains a valid reloadable draft");
blankDate = apply(blankDate, "beginFinish");
assert(Draft.validateForSave(blankDate).some((issue) => issue.code === "invalid-date"), "a blank edited date blocks save at the boundary");

let effortDraft = fresh({ rirMode: "effort" });
effortDraft = apply(effortDraft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "effort", value: "max" });
effortDraft = apply(effortDraft, "completeSet", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", completedAt: "2026-08-15T10:00:00.000Z" });
effortDraft = apply(effortDraft, "beginFinish");
const effortRows = Draft.toHistoryRows(effortDraft, "2026-08-15T11:00:00.000Z");
assert(effortRows[0].rir === 0, "effort mode compiles its locale-neutral value to current numeric History RIR");

console.log("\nDeterministic current-meaning History compilation");
let historyDraft = fresh();
historyDraft = apply(historyDraft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "load", value: "55" });
historyDraft = apply(historyDraft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "reps", value: "10" });
historyDraft = apply(historyDraft, "editSetField", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", field: "rir", value: "2" });
historyDraft = apply(historyDraft, "completeSet", { exerciseInstanceId: "slot-squat", setId: "squat-set-1", completedAt: "2026-08-15T10:20:00.000Z" });
historyDraft = apply(historyDraft, "markWarmup", { exerciseInstanceId: "slot-squat", setId: "squat-set-2" });
historyDraft = apply(historyDraft, "repeatPreviousSetValues", { exerciseInstanceId: "slot-curl", values: [{ ordinal: 1, load: 35, reps: 12, rir: 2 }] });
historyDraft = apply(historyDraft, "substituteExercise", { exerciseInstanceId: "slot-squat", replacement, selectedAt: "2026-08-15T10:21:00.000Z" });
historyDraft = apply(historyDraft, "setExerciseNotes", { exerciseInstanceId: "slot-squat", value: "Rack 7, shoulder blades down." });
historyDraft = apply(historyDraft, "setSessionNotes", { value: "  Plan 051 parity session  " });
historyDraft = apply(historyDraft, "setBodyweight", { value: "82.5" });
historyDraft = apply(historyDraft, "beginFinish");
const rows = Draft.toHistoryRows(historyDraft, "2026-08-15T11:00:00.000Z");
const rowsAgain = Draft.toHistoryRows(historyDraft, "2026-08-15T11:00:00.000Z");
assert(!Draft.isDomainError(rows) && same(rows, rowsAgain), "toHistoryRows is deterministic and does not mutate its finish snapshot");
assert(rows.length === 3 && rows[0].exerciseId === "slot-squat" && rows[0].name === "Hack squat" &&
  rows[0].performedName === "Lat pulldown" && rows[0].performedLibraryId === "pd_mc" &&
  rows[0].primary === "Quads" && rows[0].performedPrimary === "Lats", "History rows preserve original slot and performed substitution provenance");
assert(rows[1].warmup === true && rows[2].exerciseId === "slot-curl" && rows[2].performedMovementId === "slot:slot-curl",
  "History includes explicit warm-ups and touched incomplete sets with fallback performed identity");
assert(rows.every((row) => row.day === "Day 1" && row.exerciseId !== "source-squat" &&
  row.notes === "Plan 051 parity session" && row.bodyweight === 82.5 && row.session === "draft-051"),
  "History uses display day, actual program-slot identity, trimmed notes, and stable draft identity");

console.log("\nProperty checks: immutability, round-trip, and identity preservation");
try {
  fc.assert(fc.property(
    fc.array(fc.record({
      exercise: fc.constantFrom("slot-squat", "slot-curl"),
      load: fc.integer({ min: 1, max: 1000 }),
      reps: fc.integer({ min: 1, max: 30 }),
      rir: fc.integer({ min: 0, max: 8 }),
    }), { maxLength: 25 }),
    (edits) => {
      let value = fresh();
      const identities = value.exerciseOrder.map((id) => [id, value.exercises[id].setOrder.slice()]);
      for (const edit of edits) {
        const setId = value.exercises[edit.exercise].setOrder[0];
        for (const [field, fieldValue] of [["load", edit.load], ["reps", edit.reps], ["rir", edit.rir]]) {
          const before = JSON.stringify(value);
          const next = apply(value, "editSetField", { exerciseInstanceId: edit.exercise, setId, field, value: String(fieldValue) });
          if (JSON.stringify(value) !== before) return false;
          value = next;
        }
      }
      const roundTrip = Draft.parse(JSON.stringify(Draft.serialize(value)));
      return roundTrip.kind === "valid" && same(roundTrip.draft, value) && identities.every(([id, setOrder]) =>
        same(value.exercises[id].setOrder, setOrder));
    },
  ), { numRuns: 100, seed: 510051 });
  assert(true, "100 seeded command streams round-trip without mutation or set-identity drift");
} catch (error) {
  assert(false, "100 seeded command streams round-trip without mutation or set-identity drift", error.stack);
}

try {
  fc.assert(fc.property(fc.boolean(), fc.boolean(), (skip, substitute) => {
    let value = fresh();
    const original = JSON.stringify(value.exercises["slot-squat"]);
    if (skip) {
      value = apply(value, "skipExercise", { exerciseInstanceId: "slot-squat" });
      value = apply(value, "restoreExercise", { exerciseInstanceId: "slot-squat" });
    }
    if (substitute) {
      value = apply(value, "substituteExercise", { exerciseInstanceId: "slot-squat", replacement, selectedAt: "2026-08-15T10:00:00.000Z" });
      value = apply(value, "restoreOriginalExercise", { exerciseInstanceId: "slot-squat" });
    }
    return JSON.stringify(value.exercises["slot-squat"]) === original;
  }), { numRuns: 20, seed: 510052 });
  assert(true, "skip/restore and substitute/restore preserve the prior exercise subtree");
} catch (error) {
  assert(false, "skip/restore and substitute/restore preserve the prior exercise subtree", error.stack);
}

assert(Draft.migrateLegacy({ __day: "Day 1" }).code === "legacy-migration-pending", "the row 2 module fails closed until the separately proven migration slice");

console.log(`\n${results.passed} passed, ${results.failed} failed`);
if (results.failed) process.exitCode = 1;
