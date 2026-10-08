// Generates tools/ui-screens/direction-d-canonical-fixture.generated.mjs: the
// Direction D design-review lifter (DIRECTION_D_DATA, frozen — never edit it
// by hand) re-expressed as a canonical Plan 067 ProgramDefinition instead of
// flat rows with legacy short library ids. Every exercise keeps its mockup
// identity (id, day, order, display name, sets, rep range, notes) and its
// exact logged history; only the underlying catalog identity changes, from a
// retired short id to a real 32-hex catalog movement, through the same manual
// builder the Build route uses (`manualProgramDefinitionFromRows`). The
// mockup's one custom movement keeps its identity and gains a Weight+Reps
// metric composition, since a slot needs one to log sets.
//
// Run: node tools/ui-screens/build-direction-d-canonical-fixture.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAppRuntime } from "../app-runtime-harness.mjs";
import { DIRECTION_D_DATA } from "./direction-d-fixture.generated.mjs";
import { metricLogRow } from "../../test/fixtures/history-metric-rows.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const { manualProgramDefinitionFromRows, durableProgramRows, normalizeLoaded, catalogSnapshot, rawMetricDefinitions, canonicalProgramDefinition } =
  await loadAppRuntime(["manualProgramDefinitionFromRows", "durableProgramRows", "normalizeLoaded", "rawMetricDefinitions", "canonicalProgramDefinition"]);

// Legacy short id -> real catalog movement name. The design mockup predates
// the 32-hex catalog; every one of these is a deliberate, close real-world
// equivalent of what the retired short id named, picked so the mockup's own
// display name (kept via slot.displayName) still reads naturally over it.
const CATALOG_NAME_BY_LEGACY_ID = {
  sq_bb: "Barbell back squat",
  pr_bb: "Barbell bench press",
  lc_mc: "Seated hamstring curl",
  rw_cb: "Seated dual handle cable row (elbows-in)",
  lr_db: "Band lateral raise",
  hg_bb: "Barbell Romanian deadlift",
  pd_mc: "Neutral grip pin-loaded machine lat pulldown",
  sp_db: "Pin-loaded machine shoulder press",
  sq_lp: "45° leg press",
  cu_ez: "EZ bar biceps curl",
  sqk_mc: "Hack squat",
  ip_db: "Low incline Smith machine press",
  rw_db: "Chest-supported neutral grip T-bar row",
  lcl_mc: "Lying hamstring curl",
  tr_mc: "Machine triceps extension",
  dl_bb: "Conventional deadlift",
  ht_bb: "Barbell hip thrust",
  trs_bb: "Barbell skull crusher",
  cvl_mc: "Incline plate-loaded machine calf press",
  cuh_db: "Cable rope hammer curl",
};
// Exported so the screen driver can address the same movements by their new
// canonical id instead of the retired short ones.
export const DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID = {};

const byName = new Map(catalogSnapshot.exercises.map((entry) => [entry.name, entry]));
for (const [legacyId, movementName] of Object.entries(CATALOG_NAME_BY_LEGACY_ID)) {
  const entry = byName.get(movementName);
  if (!entry) throw new Error(`catalog has no movement named ${movementName} (for legacy id ${legacyId})`);
  DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID[legacyId] = entry.id;
}

const weightRepsDefinitions = rawMetricDefinitions(byName.get("Barbell back squat").id);
const customDefinitions = DIRECTION_D_DATA.customExercises.map((entry) => ({
  ...entry,
  metricIds: weightRepsDefinitions.map((metric) => metric.id),
  metricDefinitions: weightRepsDefinitions,
}));

const rows = DIRECTION_D_DATA.program.map((row) => {
  const libraryId = row.libraryId.startsWith("custom:") ? row.libraryId : DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID[row.libraryId];
  if (!libraryId) throw new Error(`no canonical id for legacy library id ${row.libraryId}`);
  return {
    id: row.id, day: row.day, order: row.order, libraryId,
    displayName: row.name, sets: row.sets, min: row.min, max: row.max, notes: row.notes,
  };
});

const definition = manualProgramDefinitionFromRows(rows, DIRECTION_D_DATA.days, customDefinitions);
if (!definition) throw new Error("the app rejected the Direction D canonical program definition");

// The manual builder always leaves every set "manual" with no RIR target, so
// the adaptive engine has nothing to recommend against (Plan 067 retired the
// mockup's own per-exercise progression strategies, which carried exactly
// that target). Carry each strategy's authored target RIR back onto its
// slot's sets, so a lifter with real history still gets a real
// recommendation — the mockup's own intent, now computed instead of invented.
// The one exercise the mockup drew as genuinely unprescribed (the mixed day's
// "manual" strategy, ex-cp — see workout/why-manual) is left untouched.
function targetRirFor(strategy) {
  const params = strategy?.params || {};
  const pairs = [[params.targetRirMin, params.targetRirMax], [params.anchorTargetRirMin, params.anchorTargetRirMax]];
  for (const [min, max] of pairs) if (Number.isFinite(min) && Number.isFinite(max)) return Math.round((min + max) / 2);
  return null;
}
const rirBySlotId = new Map();
for (const row of DIRECTION_D_DATA.program) {
  // A user-defined (custom) movement has no catalog-sourced load policy behind
  // it; the compiler requires those slots stay "manual" regardless.
  if (row.libraryId.startsWith("custom:") || row.progression?.strategy?.id === "manual") continue;
  const rir = targetRirFor(row.progression?.strategy);
  if (rir != null) rirBySlotId.set(row.id, rir);
}
for (const day of definition.days) {
  for (const slot of day.slots) {
    const rir = rirBySlotId.get(slot.id);
    if (rir == null) continue;
    for (const cycle of slot.prescriptionsByCycle) {
      for (const set of cycle.sets) { set.rir = rir; set.restSeconds = 120; set.status = "ready"; }
    }
  }
}
if (!canonicalProgramDefinition(definition, customDefinitions)) throw new Error("the RIR-target patch broke the canonical definition");

const programMeta = {
  id: "direction-d-program", name: DIRECTION_D_DATA.programName, started: DIRECTION_D_DATA.scenario.blockStart,
  created: `${DIRECTION_D_DATA.scenario.blockStart}T00:00:00.000Z`, updated: `${DIRECTION_D_DATA.scenario.blockStart}T00:00:00.000Z`,
  goal: "hypertrophy", experience: null, daysPerWeek: 3, splitType: "full_body", equipment: [], priorityMuscles: [],
  sessionLength: null, mesocycleLengthWeeks: DIRECTION_D_DATA.scenario.blockWeeks, mesocycleStatus: "active", completedAt: null,
  onboarded: true, progressionRelations: [], progressionModifiers: [], progressionIncompatibilities: [],
  programStructure: null, entrySource: null, programDefinition: definition,
};
const program = durableProgramRows(definition, customDefinitions, programMeta);

// Every mockup log row is already one committed set; carry it over verbatim
// through the metric-row shape the durable store now writes, keyed off the
// same program row (its id is unchanged, only its libraryId is canonical).
const programById = new Map(program.map((row) => [row.id, row]));
const log = DIRECTION_D_DATA.log.map((row) => {
  const programRow = programById.get(row.exerciseId);
  if (!programRow) throw new Error(`Direction D log row references unknown exercise ${row.exerciseId}`);
  const extra = {};
  if (Object.prototype.hasOwnProperty.call(row, "work")) extra.work = row.work;
  if (Object.prototype.hasOwnProperty.call(row, "load") && row.load === null) { /* no load recorded */ }
  return metricLogRow(programMeta, programRow, {
    session: row.session, date: row.date, day: row.day, set: row.set,
    load: row.load, reps: row.reps, rir: row.rir, notes: row.notes || "", created: row.created, extra,
  });
});

const normalized = normalizeLoaded({ settings: {}, programMeta, program, log, programHistory: [], customExercises: customDefinitions });
if (JSON.stringify(normalized.programMeta.programDefinition) !== JSON.stringify(definition))
  throw new Error("normalization changed the Direction D canonical definition");

const output = `/**
 * GENERATED by tools/ui-screens/build-direction-d-canonical-fixture.mjs. Do not edit by hand.
 *
 * The Direction D design-review lifter (tools/ui-screens/direction-d-fixture.generated.mjs,
 * itself generated from the review page's data — see that file's header), re-expressed on
 * the canonical Plan 067 ProgramDefinition: every exercise keeps its mockup identity, rep
 * range, notes and logged history; only its catalog identity moved from a retired short id
 * to a real 32-hex catalog movement. Regenerate with that script after DIRECTION_D_DATA changes.
 */
export const DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID = ${JSON.stringify(DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID, null, 2)};

export const DIRECTION_D_CANONICAL_DATA = {
  programName: ${JSON.stringify(DIRECTION_D_DATA.programName)},
  scenario: ${JSON.stringify(DIRECTION_D_DATA.scenario)},
  programMeta: ${JSON.stringify(normalized.programMeta)},
  program: ${JSON.stringify(normalized.program)},
  customExercises: ${JSON.stringify(normalized.customExercises)},
  log: ${JSON.stringify(log)},
};
`;
writeFileSync(join(HERE, "direction-d-canonical-fixture.generated.mjs"), output);
console.log(`Direction D canonical fixture regenerated: ${normalized.program.length} rows, ${log.length} log rows, `
  + `${definition.days.filter((d) => d.kind === "training").length} training days.`);
