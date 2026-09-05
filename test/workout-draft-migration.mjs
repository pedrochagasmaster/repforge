#!/usr/bin/env node
import { createRequire } from "node:module";

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

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isMigrationError(value, code) {
  return value?.kind === "migration-error" && (!code || value.code === code);
}

function programContext({ unit = "kg", rirMode = "numeric" } = {}) {
  return {
    programId: "program-migration-051",
    programFingerprint: "program-migration-fingerprint-051",
    durableRevision: 19,
    dayId: "stable-day-051",
    dayLabel: "Day 1",
    scheduleDate: "2026-08-20",
    unit,
    rirMode,
    exercises: [
      {
        legacyExerciseId: "legacy_press_primary",
        exerciseInstanceId: "legacy_press_primary",
        sourceExerciseId: "source-press-051",
        libraryId: "bp_bb",
        displayName: "Barbell bench press",
        sets: 2,
        setIds: ["press-stable-set-a", "press-stable-set-b"],
        minReps: 6,
        maxReps: 10,
        targetRir: 2,
        notes: "Pause on chest",
        primary: "Chest",
        secondary: "Triceps,Front delts",
        movementPattern: "horizontal_push",
        progressionStrategy: "double_progression",
        sourceFingerprint: "press-fingerprint-051",
        programmedSets: [
          { suggestedLoad: 80, suggestedReps: 8, targetRir: 2 },
          { suggestedLoad: 80, suggestedReps: 8, targetRir: 2 },
        ],
      },
      {
        legacyExerciseId: "legacy_row_off_screen",
        exerciseInstanceId: "legacy_row_off_screen",
        sourceExerciseId: "source-row-051",
        movementId: "slot:legacy_row_off_screen",
        displayName: "Cable row",
        sets: 1,
        setIds: ["row-stable-set-a"],
        minReps: 8,
        maxReps: 12,
        targetRir: 2,
        notes: "",
        primary: "Back",
        secondary: "Biceps",
        movementPattern: "horizontal_pull",
        progressionStrategy: "double_progression",
        sourceFingerprint: "row-fingerprint-051",
        programmedSets: [{ suggestedLoad: 45, suggestedReps: 10, targetRir: 2 }],
      },
    ],
  };
}

function sessionSelection() {
  return {
    draftId: "migrated-draft-051",
    writer: {
      installationId: "install-migration-051",
      tabId: "tab-migration-051",
      operationId: "migrate-legacy-051",
    },
    startedAt: "2026-08-20T09:00:00.000Z",
    updatedAt: "2026-08-20T09:00:00.000Z",
    scheduleDate: "2026-08-20",
    selectedExerciseId: "legacy_press_primary",
    bodyweight: null,
    notes: "fallback session note",
  };
}

function migrationSnapshot(options = {}) {
  return {
    programContext: programContext(options),
    sessionSelection: sessionSelection(),
    previousSessionFacts: {
      legacy_press_primary: {
        exerciseInstanceId: "legacy_press_primary",
        setupNotes: "Prior note must be replaced",
        sets: [{ ordinal: 1, load: 77.5, reps: 8, rir: 2 }],
      },
    },
    valueResolutions: {},
    substitutionResolutions: {},
    migratedAt: "2026-08-20T10:15:00.000Z",
    completedAt: "2026-08-20T10:14:00.000Z",
  };
}

function resolvedValues(raw) {
  return Object.fromEntries(Object.entries(raw).filter(([key]) =>
    /_(?:load|reps|rir|effort)$/.test(key) || key === "__bodyweight"));
}

console.log("Marker-complete deterministic V1 to DraftV2 conversion");
const legacy = {
  "legacy_press_primary_1_load": "82.5",
  "legacy_press_primary_1_reps": "9",
  "legacy_press_primary_1_rir": "1.5",
  "legacy_press_primary_2_load": "80",
  "legacy_press_primary_2_reps": "8",
  "legacy_press_primary_2_rir": "2",
  "legacy_row_off_screen_1_load": "47.5",
  "legacy_row_off_screen_1_reps": "11",
  "legacy_row_off_screen_1_rir": "2",
  __done: ["legacy_press_primary_1"],
  __touched: ["legacy_press_primary_1", "legacy_press_primary_2", "legacy_row_off_screen_1"],
  __warm: ["legacy_press_primary_2"],
  __skipped: ["legacy_row_off_screen"],
  __substituted: { legacy_press_primary: "Incline dumbbell press" },
  __substitutedRef: { legacy_press_primary: "bp_di" },
  __exnotes: {
    legacy_press_primary: "Bench notch 4",
    legacy_row_off_screen: "Handle at sternum",
  },
  __day: "Day 1",
  __date: "2026-08-21",
  __sessionNotes: "  late session  ",
  __bodyweight: "81,25",
  __contextTouched: { day: true, date: true, sessionNotes: true, bodyweight: true },
  __startedAt: 1787216400000,
  __lastCommitAt: 1787219100000,
  __selectedExerciseId: "legacy_press_primary",
};
const legacyBefore = JSON.stringify(legacy);
const snapshot = migrationSnapshot();
snapshot.valueResolutions = {
  ...resolvedValues(legacy),
  __bodyweight: "81.25",
};
snapshot.substitutionResolutions = {
  legacy_press_primary: {
    legacyName: "Incline dumbbell press",
    legacyRef: "bp_di",
    selectedAt: "2026-08-20T10:10:00.000Z",
    replacement: {
      exerciseInstanceId: "performed-incline-051",
      sourceExerciseId: "bp_di",
      libraryId: "bp_di",
      displayName: "Incline dumbbell press",
      primary: "Chest",
      secondary: "Triceps,Front delts",
    },
  },
};

const migrated = Draft.migrateLegacy(legacy, snapshot);
assert(!isMigrationError(migrated) && Draft.validate(migrated).ok,
  "a fully resolved legacy draft becomes a valid DraftV2", JSON.stringify(migrated));
assert(Object.isFrozen(migrated) && JSON.stringify(legacy) === legacyBefore,
  "migration freezes its result and never mutates the legacy input");
assert(migrated.draftId === "migrated-draft-051" && migrated.revision === 0 &&
  migrated.writer.operationId === "migrate-legacy-051",
  "caller-supplied stable draft, revision, and writer identity are preserved");
assert(migrated.program.dayId === "stable-day-051" && migrated.program.dayLabel === "Day 1" &&
  migrated.program.scheduleDate === "2026-08-21",
  "legacy display day and explicit date map onto the captured program snapshot");
assert(migrated.session.startedAt === new Date(1787216400000).toISOString() &&
  migrated.session.updatedAt === "2026-08-20T10:15:00.000Z" &&
  migrated.session.bodyweight === "81.25" && migrated.session.notes === "  late session  " &&
  migrated.session.selectedExerciseId === "legacy_press_primary",
  "session timestamps, normalized bodyweight, exact note, and selected exercise survive");

const first = migrated.exercises.legacy_press_primary.sets["press-stable-set-a"];
const second = migrated.exercises.legacy_press_primary.sets["press-stable-set-b"];
const offscreen = migrated.exercises.legacy_row_off_screen.sets["row-stable-set-a"];
assert(first.edited.load === "82.5" && first.edited.reps === "9" && first.edited.rir === "1.5" &&
  first.completion.completedAt === new Date(1787219100000).toISOString() &&
  same(first.touched, { load: true, reps: true, effort: true }),
  "completed and touched set markers retain resolved values and the legacy commit time");
assert(second.edited.load === "80" && second.role === "warmup" && second.completion === "pending" &&
  same(second.touched, { load: true, reps: true, effort: true }),
  "warm-up and touched state remain independent of completion");
assert(offscreen.edited.load === "47.5" && offscreen.edited.reps === "11" && offscreen.touched.load,
  "off-screen exercise values migrate by the caller's explicit stable mapping");
assert(migrated.exercises.legacy_press_primary.setupNotes === "Bench notch 4" &&
  migrated.exercises.legacy_row_off_screen.setupNotes === "Handle at sternum",
  "every legacy exercise note replaces the prior-session fallback without touching programmed notes");
assert(migrated.exercises.legacy_press_primary.programmed.notes === "Pause on chest" &&
  migrated.exercises.legacy_row_off_screen.status === "skipped" &&
  migrated.exercises.legacy_press_primary.substitution.original.sourceExerciseId === "source-press-051" &&
  migrated.exercises.legacy_press_primary.substitution.replacement.libraryId === "bp_di",
  "skip and substitution markers retain status, original slot provenance, and resolved performance identity");
const finishing = Draft.reduce(migrated, {
  type: "beginFinish",
  expectedRevision: 0,
  operationId: "finish-migrated-051",
  updatedAt: "2026-08-20T10:20:00.000Z",
  writer: { installationId: "install-migration-051", tabId: "tab-migration-051" },
});
const migratedRows = Draft.toHistoryRows(finishing, "2026-08-20T10:21:00.000Z");
assert(same(migratedRows, [
  {
    session: "migrated-draft-051",
    date: "2026-08-21",
    day: "Day 1",
    name: "Barbell bench press",
    exerciseId: "legacy_press_primary",
    set: 1,
    load: 82.5,
    reps: 9,
    rir: 1.5,
    notes: "late session",
    created: "2026-08-20T10:21:00.000Z",
    primary: "Chest",
    secondary: "Triceps,Front delts",
    performedName: "Incline dumbbell press",
    performedPrimary: "Chest",
    performedSecondary: "Triceps,Front delts",
    performedLibraryId: "bp_di",
    exNote: "Bench notch 4",
    bodyweight: 81.25,
  },
  {
    session: "migrated-draft-051",
    date: "2026-08-21",
    day: "Day 1",
    name: "Barbell bench press",
    exerciseId: "legacy_press_primary",
    set: 2,
    load: 80,
    reps: 8,
    rir: 2,
    notes: "late session",
    created: "2026-08-20T10:21:00.000Z",
    primary: "Chest",
    secondary: "Triceps,Front delts",
    performedName: "Incline dumbbell press",
    performedPrimary: "Chest",
    performedSecondary: "Triceps,Front delts",
    performedLibraryId: "bp_di",
    exNote: "Bench notch 4",
    warmup: true,
    bodyweight: 81.25,
  },
]), "migrated drafts compile exact current History rows with the original program-slot exercise ID", JSON.stringify(migratedRows));
assert(same(Draft.migrateLegacy(JSON.stringify(legacy), snapshot), migrated),
  "repeating migration with the same raw bytes and snapshot is deterministic");
assert(Draft.parse(JSON.stringify(migrated), programContext()).kind === "valid",
  "the migrated document reloads through the V2 parser without another migration");

console.log("\nLocale and presentation conversion stays at the adapter boundary");
const poundsLegacy = {
  "legacy_press_primary_1_load": "225,5",
  "legacy_press_primary_1_reps": "8",
  "legacy_press_primary_1_rir": "1,5",
  __touched: ["legacy_press_primary_1"],
  __bodyweight: "180,25",
  __contextTouched: { bodyweight: true },
  __day: "Day 1",
  __date: "",
};
const poundsSnapshot = migrationSnapshot({ unit: "lb" });
poundsSnapshot.valueResolutions = {
  "legacy_press_primary_1_load": "102.285919336",
  "legacy_press_primary_1_reps": "8",
  "legacy_press_primary_1_rir": "1.5",
  __bodyweight: "81.760189687",
};
const pounds = Draft.migrateLegacy(poundsLegacy, poundsSnapshot);
assert(!isMigrationError(pounds) && pounds.program.unit === "lb" &&
  pounds.exercises.legacy_press_primary.sets["press-stable-set-a"].edited.load === "102.285919336" &&
  pounds.exercises.legacy_press_primary.sets["press-stable-set-a"].edited.rir === "1.5" &&
  pounds.session.bodyweight === "81.760189687" && pounds.program.scheduleDate === "",
  "caller-resolved lb and decimal-comma values become locale-neutral canonical text while explicit blank date survives",
  JSON.stringify(pounds));
assert(Draft.validateForSave(pounds).some((issue) => issue.code === "invalid-date" && issue.field === "scheduleDate"),
  "the preserved blank date remains reloadable and is rejected only at save validation");

const effortLegacy = {
  "legacy_press_primary_1_load": "80",
  "legacy_press_primary_1_reps": "8",
  "legacy_press_primary_1_effort": "hard",
  __touched: ["legacy_press_primary_1"],
  __day: "Day 1",
};
const effortSnapshot = migrationSnapshot({ rirMode: "effort" });
effortSnapshot.valueResolutions = resolvedValues(effortLegacy);
const effort = Draft.migrateLegacy(effortLegacy, effortSnapshot);
assert(!isMigrationError(effort) &&
  effort.exercises.legacy_press_primary.sets["press-stable-set-a"].edited.effort === "hard" &&
  effort.exercises.legacy_press_primary.sets["press-stable-set-a"].touched.effort,
  "legacy effort-mode values migrate independently of numeric RIR");

const explicitBlankLegacy = {
  "legacy_press_primary_1_load": "partial.",
  __touched: ["legacy_press_primary_1"],
  __day: "Day 1",
  __bodyweight: "",
  __contextTouched: { bodyweight: true },
};
const explicitBlankSnapshot = migrationSnapshot();
explicitBlankSnapshot.valueResolutions = resolvedValues(explicitBlankLegacy);
const explicitBlank = Draft.migrateLegacy(explicitBlankLegacy, explicitBlankSnapshot);
assert(!isMigrationError(explicitBlank) &&
  explicitBlank.exercises.legacy_press_primary.sets["press-stable-set-a"].edited.load === "partial." &&
  explicitBlank.session.bodyweight === "",
  "invalid partial load text and explicitly blank bodyweight survive for correction");

console.log("\nFail-closed recovery cases retain the caller's legacy bytes");
function migrateChanged(changeLegacy, changeSnapshot) {
  const raw = structuredClone(legacy);
  const context = structuredClone(snapshot);
  changeLegacy?.(raw);
  context.valueResolutions = resolvedValues(raw);
  if (Object.hasOwn(raw, "__bodyweight")) context.valueResolutions.__bodyweight = "81.25";
  changeSnapshot?.(context, raw);
  return Draft.migrateLegacy(raw, context);
}

assert(isMigrationError(Draft.migrateLegacy("{"), "invalid-legacy-json"),
  "corrupt legacy JSON fails without producing a replacement");
assert(isMigrationError(Draft.migrateLegacy({ schemaVersion: 9, marker: "future" }, snapshot), "not-legacy-draft"),
  "unknown versioned schema is not reinterpreted as legacy");
assert(isMigrationError(migrateChanged((raw) => { raw.futureMeaningfulField = "retain me"; }), "unknown-legacy-field"),
  "unknown meaningful fields fail instead of being silently discarded");
assert(isMigrationError(migrateChanged((raw) => { raw.__done = "legacy_press_primary_1"; }), "invalid-legacy-marker"),
  "corrupt marker collections fail closed");
assert(isMigrationError(migrateChanged((raw) => { raw.__touched.push("legacy_press_primary_3"); }), "unmapped-legacy-set"),
  "set markers beyond the captured program fail instead of guessing an ordinal");
assert(isMigrationError(migrateChanged((raw) => { raw.legacy_press_primary_3_load = "90"; }), "unknown-legacy-field"),
  "flat values beyond planned sets remain recoverable rather than discarded");
assert(isMigrationError(migrateChanged((raw) => { raw.__skipped = ["unknown_exercise"]; }), "unmapped-legacy-exercise"),
  "unknown exercise markers fail instead of selecting a similarly named exercise");
assert(isMigrationError(migrateChanged((raw) => { raw.__day = "Renamed day"; }), "legacy-day-mismatch"),
  "a day mismatch remains recoverable for the program transaction adapter");
assert(isMigrationError(migrateChanged((raw) => {
  raw.__contextTouched.date = true;
  delete raw.__date;
}), "missing-legacy-context-value"),
  "a partial write cannot invent a context value whose touched marker survived");
assert(isMigrationError(migrateChanged(null, (context) => {
  delete context.valueResolutions["legacy_press_primary_1_load"];
}), "missing-value-resolution"),
  "migration requires an explicit adapter resolution for every legacy editable value");
assert(isMigrationError(migrateChanged(null, (context) => {
  context.valueResolutions.__bodyweight = { bad: "value" };
}), "invalid-value-resolution"),
  "invalid explicit bodyweight resolution fails instead of becoming an absent value");
assert(isMigrationError(migrateChanged(null, (context) => {
  context.valueResolutions.unused = "1";
}), "unused-value-resolution"),
  "unused adapter values are rejected so data cannot be mapped to the wrong set");
assert(isMigrationError(migrateChanged(null, (context) => {
  context.substitutionResolutions = {};
}), "unresolved-legacy-substitution"),
  "a name-only or referenced substitution is never resolved from locale/catalog globals");
assert(isMigrationError(migrateChanged((raw) => {
  delete raw.__substituted.legacy_press_primary;
  delete raw.__substitutedRef.legacy_press_primary;
}), "unused-substitution-resolution"),
  "unused substitution resolutions cannot be silently attached to another exercise");
assert(isMigrationError(migrateChanged((raw) => {
  raw.__substitutedRef.legacy_press_primary = "different-ref";
}), "unresolved-legacy-substitution"),
  "a stale substitution reference cannot reuse a resolution for another movement");
assert(isMigrationError(migrateChanged((raw) => {
  raw.__selectedExerciseId = "legacy_press_primary";
  raw.__skipped = ["legacy_press_primary"];
}), "selected-legacy-exercise-skipped"),
  "contradictory selected-and-skipped state fails rather than silently changing selection");
assert(isMigrationError(migrateChanged((raw) => { delete raw.__done; }), "orphan-legacy-last-commit"),
  "an orphan unfinished-reminder timestamp is retained through recovery rather than dropped");
assert(isMigrationError(migrateChanged(null, (context) => {
  context.programContext.exercises[0].exerciseInstanceId = "repointed-slot-051";
}), "legacy-exercise-identity-mismatch"),
  "migration cannot repoint an existing flat-draft exercise ID to a new History slot identity");

const adhocLegacy = {
  "legacy_row_off_screen_1_load": "50",
  "legacy_row_off_screen_1_reps": "9",
  "legacy_row_off_screen_1_rir": "2",
  __touched: ["legacy_row_off_screen_1"],
  __substituted: { legacy_row_off_screen: "My garage handle row" },
  __day: "Day 1",
};
const adhocSnapshot = migrationSnapshot();
adhocSnapshot.valueResolutions = resolvedValues(adhocLegacy);
adhocSnapshot.substitutionResolutions = {
  legacy_row_off_screen: {
    legacyName: "My garage handle row",
    replacement: {
      exerciseInstanceId: "performed-adhoc-row-051",
      sourceExerciseId: "custom:garage-row-051",
      movementId: "custom:garage-row-051",
      displayName: "My garage handle row",
      primary: "Back",
      secondary: "Biceps",
    },
    selectedAt: "2026-08-20T10:15:00.000Z",
  },
};
const adhoc = Draft.migrateLegacy(adhocLegacy, adhocSnapshot);
assert(!isMigrationError(adhoc) &&
  adhoc.exercises.legacy_row_off_screen.substitution.replacement.movementId === "custom:garage-row-051",
  "an old name-only substitution migrates only through an explicit adhoc identity resolution");

console.log(`\n${results.passed} passed, ${results.failed} failed`);
if (results.failed) process.exit(1);
