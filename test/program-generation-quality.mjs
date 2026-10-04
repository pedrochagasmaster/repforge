// Plan 065 quality gate: the 200 audited first-program contexts (3 October
// 2026 audits, R001-R100 and S001-S100) must compile into programs that keep
// every contract and none of the audited programming defects. Exercise sets
// below are written out by id on purpose: they are an independent oracle, not
// a copy of the compiler's own catalogue metadata.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Progression = require("../progression-engine.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");
const corpus = JSON.parse(readFileSync(new URL("./fixtures/program-generation-corpus-v1.json", import.meta.url), "utf8"));

// Knee-dominant movements: never acceptable in a posterior-chain job (Q01).
const KNEE_DOMINANT = new Set(["sqs_bw", "ss_bw", "ss_db", "ss_bb", "lg_bb", "lg_db", "lgr_db", "sq_bw", "sq_db", "sqd_db",
  "sqg_kb", "su_db", "su_bb", "sq_lp", "sqk_mc", "sq_sm", "sq_bb", "lp1_mc", "lph_mc", "le_mc"]);
// Knee-flexion movements (Q06).
const KNEE_FLEXION = new Set(["lc_mc", "lck_mc", "lcl_mc", "lf_db", "ghr_bw", "ilc_bw"]);
// Demanding bodyweight movements that need evidence of ability (Q08).
const DEMANDING = new Set(["chn_bw", "chnc_bw", "pup_bw", "pupn_bw", "pupw_bw", "pupw_wt", "cd_bw", "trd_bw", "ghr_bw",
  "ablr_bw", "ablrs_bw", "abok_bw", "ablr_wt", "ilc_bw"]);
// Foundation heavy-primary defaults the coaching audit rejected (Q03).
const FOUNDATION_REJECTED_HEAVY = new Set(["lg_bb", "dp_bb", "dp_db", "dp_sm", "dp_mc"]);
const byId = new Map(EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));
const hasPattern = (id, pattern) => (byId.get(id)?.patterns || []).includes(pattern);
const isBand = (id) => (byId.get(id)?.equipment || []).includes("band");
const slotsOf = (result) => result.days.flatMap((day) => day.slots);
const signature = (result) => JSON.stringify(result.days.map((day) => day.slots.map((slot) => [slot.exercise.id, slot.prescription.sets, slot.prescription.targetRirMin, slot.prescription.targetRirMax])));

let checked = 0;
const failures = [];
const fail = (id, message) => failures.push(`${id}: ${message}`);
const metrics = { exercises: new Map(), slots: 0, hamstringJobsAfterHinge: 0, hamstringJobsKneeFlexion: 0 };

assert.equal(corpus.cases.length, 200, "corpus holds the 200 audited contexts");
for (const { id, input } of corpus.cases) {
  const result = Compiler.compile(input, EXERCISE_LIBRARY);
  if (result.kind !== "compiled") { fail(id, `did not compile: ${JSON.stringify(result.conflicts || result.code)}`); continue; }
  checked++;
  const context = Compiler.validateContext(input).value;
  const evidence = (exerciseId) => context.preferences.includes(exerciseId) || context.history.some((item) => item.libraryId === exerciseId);
  const slots = slotsOf(result);

  // Contract: determinism over input order and repeated runs.
  if (signature(Compiler.compile(input, [...EXERCISE_LIBRARY].reverse())) !== signature(result)) fail(id, "catalogue order changes the program");

  // Contract: set bounds, progression envelopes and time ceiling (F01).
  for (const row of result.program) {
    const slot = slots.find((entry) => entry.slotId === row.slotId);
    if (row.progression.strategy.id !== "anchor_backoff" && (row.sets < row.minSets || row.sets > row.maxSets)) fail(id, `${row.slotId} exports ${row.sets} sets outside ${row.minSets}-${row.maxSets}`);
    if (row.minSets === 1 && slot.role !== "isolation_accessory" &&
        !result.reductions.some((entry) => entry.slotId === row.slotId && entry.step === "minimum_dose_single_set")) fail(id, `${row.slotId} is a one-set compound without a disclosed minimum-dose reduction`);
    if (row.sets === 1 && slot.prescription.targetRirMin !== Compiler.RULES.prescriptionClasses[slot.prescription.classId].efficientRir?.[0] &&
        input.profile !== "foundation" && Compiler.RULES.prescriptionClasses[slot.prescription.classId].efficientRir) fail(id, `${row.slotId} is one set without the efficient RIR range`);
    if (!Progression.validatePrescription(row.progression).ok) fail(id, `${row.slotId} has an invalid progression envelope`);
  }
  for (const day of result.days) if (Compiler.estimateDaySeconds(day) > input.sessionMinutes * 60) fail(id, `${day.dayId} exceeds ${input.sessionMinutes} minutes`);

  // Q01: no knee-dominant exercise fills a posterior job.
  for (const slot of slots) if (slot.templateId === "home_posterior" && KNEE_DOMINANT.has(slot.exercise.id)) fail(id, `${slot.slotId} uses knee-dominant ${slot.exercise.id} as posterior work`);
  for (const day of result.days) {
    // Q02: no day collapses three entries onto one exercise, no triple hinge day,
    // and no repeat inside a session unless the lifter asked for that exercise.
    if (day.slots.length >= 3 && new Set(day.slots.map((slot) => slot.exercise.id)).size === 1) fail(id, `${day.dayId} is one exercise repeated`);
    if (day.slots.filter((slot) => hasPattern(slot.exercise.id, "hinge")).length >= 3) fail(id, `${day.dayId} has three hinge entries`);
    day.slots.forEach((slot, index) => {
      if (day.slots.findIndex((other) => other.exercise.id === slot.exercise.id) !== index && !context.preferences.includes(slot.exercise.id)) fail(id, `${day.dayId} repeats ${slot.exercise.id}`);
    });
  }
  // Q06: hamstring assistance after a hinge in the week uses knee flexion when equipment allows.
  if (input.familyId !== "home") {
    const weekHasHinge = slots.some((slot) => hasPattern(slot.exercise.id, "hinge"));
    for (const slot of slots) if (slot.templateId === "hamstring_assistance" && weekHasHinge) {
      metrics.hamstringJobsAfterHinge++;
      if (KNEE_FLEXION.has(slot.exercise.id)) metrics.hamstringJobsKneeFlexion++;
      else fail(id, `${slot.slotId} hamstring assistance is ${slot.exercise.id}, not knee flexion`);
    }
  }
  // Q03/Q04: Foundation never permits 0 RIR and never defaults to lunge/decline heavy work.
  if (input.profile === "foundation") {
    for (const slot of slots) {
      if (slot.prescription.targetRirMin === 0) fail(id, `${slot.slotId} permits 0 RIR under Foundation`);
      if (slot.role === "heavy_primary" && FOUNDATION_REJECTED_HEAVY.has(slot.exercise.id) && !evidence(slot.exercise.id)) fail(id, `${slot.slotId} Foundation heavy default ${slot.exercise.id}`);
    }
  }
  // Q08: demanding bodyweight work is never a silent default.
  for (const slot of slots) if (DEMANDING.has(slot.exercise.id) && !evidence(slot.exercise.id) &&
      !result.limitations.some((entry) => entry.code === "capability.demanding_exercise_selected" && entry.slotId === slot.slotId)) fail(id, `${slot.slotId} silently defaults to ${slot.exercise.id}`);
  // Q08: a band-only lifter gets band work.
  if (input.familyId === "home" && JSON.stringify(input.equipment) === JSON.stringify(["band"]) && !slots.some((slot) => isBand(slot.exercise.id))) fail(id, "band-only context selects no band exercise");
  // Q05: a muscle priority either changes the program or says why it could not.
  if ((input.primaryMuscles || []).length) {
    const without = Compiler.compile({ ...input, primaryMuscles: [] }, EXERCISE_LIBRARY);
    if (without.kind === "compiled" && signature(without) === signature(result) &&
        !result.limitations.some((entry) => String(entry.code).startsWith("priority."))) fail(id, "muscle priority changed nothing and reported nothing");
  }
  for (const slot of slots) { metrics.slots++; metrics.exercises.set(slot.exercise.id, (metrics.exercises.get(slot.exercise.id) || 0) + 1); }
}

// X01: machines-only gyms compile Balanced and Strength.
for (const familyId of ["balanced", "strength"]) for (const frequency of [3, 4]) {
  const result = Compiler.compile({ schemaVersion: 2, familyId, frequency, sessionMinutes: 60, preferredRestSeconds: null, equipment: ["machine"], environment: ["safe_pull", "training_support"], loadIncrements: { machine: 5 }, profile: "standard" }, EXERCISE_LIBRARY);
  if (result.kind !== "compiled") failures.push(`machines-only ${familyId} ${frequency}: ${JSON.stringify(result.conflicts)}`);
}

assert.deepEqual(failures, [], `${failures.length} quality failures`);
assert.equal(checked, 200);
const top = [...metrics.exercises.entries()].sort((a, b) => b[1] - a[1]);
console.log(`program generation quality: 200/200 compiled; ${metrics.hamstringJobsKneeFlexion}/${metrics.hamstringJobsAfterHinge} hamstring jobs use knee flexion; ` +
  `${metrics.exercises.size} distinct exercises; top ten = ${(top.slice(0, 10).reduce((sum, [, count]) => sum + count, 0) / metrics.slots * 100).toFixed(1)}% of slots`);
