/** @typedef {import("./review-contracts.js").ProgramDefinition} ProgramDefinition */
/** @typedef {import("./review-contracts.js").ProgramSlot} ProgramSlot */
/** @typedef {import("./review-contracts.js").ProgramSet} ProgramSet */
/** @typedef {import("./review-contracts.js").ProgramDay} ProgramDay */
/** @typedef {import("./review-contracts.js").SourceCatalog} SourceCatalog */
/** @typedef {import("./review-contracts.js").SourceExercise} SourceExercise */
/** @typedef {import("./review-contracts.js").MetricDefinition} MetricDefinition */
/** @typedef {import("./review-contracts.js").RepRange} RepRange */
/** @typedef {import("./review-contracts.js").ReviewContext} ReviewContext */
/** @typedef {import("./review-contracts.js").ReviewRefusal} ReviewRefusal */
/** @typedef {import("./review-contracts.js").ReviewResult} ReviewResult */
/** @typedef {import("./review-contracts.js").CatalogMetrics} CatalogMetrics */
"use strict";

/*
 * Onboarding B's review editor (Plan 070, ADR 0020). The recommendation is
 * a canonical ProgramDefinition; every adjustment the lifter makes on the
 * result screen is one edit on it, checked by validateProgramDefinition.
 *
 * The edit rules below are pure. They take the definition, the edit and a
 * context (the compiler, the raw catalog, the metric domain and the edit's
 * position in the log) and return a new definition or a refusal, so the same
 * log replayed on the same recommendation always rebuilds the same program.
 * That is what lets undo survive a reload.
 */

const JOB_KEYS = Object.freeze([
    "additional_horizontal_pull", "additional_horizontal_push", "incline_or_overhead_push", "secondary_hip_extension",
    "quadriceps_isolation", "secondary_squat", "horizontal_pull", "horizontal_push", "chest_isolation", "hip_abduction",
    "lat_isolation", "lateral_delts", "knee_flexion", "vertical_pull", "rear_delts", "hip_hinge", "obliques", "biceps",
    "triceps", "calves", "squat", "abs",
  ]);

const MIN_SETS = 1;
const MAX_SETS = 8;
const MAX_REPS = 30;
const MAX_RIR = 6;
const DELOAD_RIR_OFFSET = 2;
const REST_PRESETS = Object.freeze([60, 90, 120, 150, 180, 240]);
const MAX_DAY_NAME = 40;
const ADDED_SETS = 3;
const REP_SEMANTICS = Object.freeze(["reps", "repsPerSide"]);
// Keep static Review classification aligned with the ordered metric
// compositions supported by Plan 069. Runtime loading, equipment and grid
// readiness remain outside this editor boundary.
const ADAPTIVE_SEMANTICS = Object.freeze([
  ["loadKg", "reps"], ["reps", "assistanceKg"], ["reps"],
  ["loadKg", "repsPerSide"], ["repsPerSide"], ["reps", "loadPerSideKg"],
  ["repsPerSide", "loadPerSideKg"], ["persistentLoadPerSideKg", "repsPerSide"],
]);
const EDIT_KINDS = Object.freeze([
  "sets", "rep_range", "rir", "rest", "swap", "alternates",
  "execution_mode", "move", "remove", "reorder", "add", "day_name",
]);
const EDIT_KIND_SET = new Set(EDIT_KINDS);
const PROVENANCE_SOURCE = "lifter_review";

/** @template T @param {T} value @returns {T} */
const clone = (value) => JSON.parse(JSON.stringify(value));
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
/** @template T @param {T[]} list @returns {T[]} */
const unique = (list) => [...new Set(list)];
/** @param {string} code @param {string[]} [issues] @returns {ReviewRefusal} */
const refuse = (code, issues = []) => ({ ok: false, code, issues });

/** @param {ProgramDefinition|null|undefined} definition */
function slotsOf(definition) {
  return (definition?.days || []).flatMap((day) => day.slots || []);
}
/** @param {ProgramDefinition} definition @param {unknown} slotId */
function locate(definition, slotId) {
  for (const day of definition.days || []) {
    const index = (day.slots || []).findIndex((slot) => slot.id === slotId);
    if (index >= 0) return { day, index, slot: day.slots[index] };
  }
  return null;
}
/** @param {ProgramDefinition} definition @param {unknown} dayId */
const dayById = (definition, dayId) => (definition.days || []).find((day) => day.id === dayId) || null;
/** @param {ProgramSlot["prescriptionsByCycle"][number]} cycle */
const isDeload = (cycle) => (cycle.sets || []).some((set) => set.provenance?.deload === true);
/** @param {ProgramSet["targets"]|undefined} targets */
const repKey = (targets) => REP_SEMANTICS.find((key) => isObject(targets?.[key])) || null;
/** @param {ProgramDay} day */
const renumber = (day) => (day.slots || []).forEach((slot, index) => { slot.order = index + 1; });

/** @param {ProgramDefinition} definition */
function recoveredBlock(definition) {
  return definition.provenance?.source === "recovered_generation_rules";
}

/** @param {ProgramSet} set */
function markReviewed(set) {
  set.provenance = { ...(set.provenance || {}), source: PROVENANCE_SOURCE };
}

/** @param {SourceCatalog|null|undefined} catalog @param {unknown} id */
function rawExercise(catalog, id) {
  return (catalog?.exercises || []).find((exercise) => exercise.id === id) || null;
}
/** @param {SourceCatalog|null|undefined} catalog @param {unknown} id */
function catalogObject(catalog, id) {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog?.uuidIndex || {}, id)
    ? catalog?.uuidIndex[id]||null : null;
}
/** @param {SourceCatalog} catalog @param {string[]|undefined} ids @param {string} type */
function ofType(catalog, ids, type) {
  return unique((Array.isArray(ids) ? ids : []).filter((id) => catalogObject(catalog, id)?.type === type));
}

/* A catalog movement's metric composition, through the same metric domain the
   compiler uses. Only movements that record reps can stand in a review slot. */
/** @param {ReviewContext} ctx @param {SourceExercise|null|undefined} exercise @returns {CatalogMetrics|null} */
function catalogMetrics(ctx, exercise) {
  const ids = Array.isArray(exercise?.exerciseMetrics) ? exercise.exerciseMetrics : [];
  if (!ids.length || !ctx.metrics?.definitionsForIds) return null;
  const definitions = ctx.metrics.definitionsForIds(ids);
  if (!definitions.ok) return null;
  const semantic = REP_SEMANTICS.find((key) => definitions.value.some((metric) => metric.semantic === key));
  return semantic ? { metricIds: [...ids], metricDefinitions: definitions.value, semantic } : null;
}

/* The compiler's own rule (program-compiler.js executionMode): a movement
   that is only unilateral or only bilateral says so; one that can be both
   needs an explicit choice, which a search pick does not carry. */
/** @param {SourceCatalog} catalog @param {SourceExercise|null|undefined} exercise */
function executionModeOf(catalog, exercise) {
  const names = (Array.isArray(exercise?.laterality) ? exercise.laterality : [])
    .map((id) => catalogObject(catalog, id)?.name);
  const unilateral = names.includes("Unilateral"), bilateral = names.includes("Bilateral");
  if (unilateral && bilateral) return null;
  if (unilateral) return "unilateral";
  if (bilateral) return "bilateral";
  return null;
}

/** @param {ProgramSlot|null|undefined} slot */
function needsExecutionMode(slot) {
  return slot?.metricOrigin === "source_catalog" &&
    slot.metricDefinitions?.some((metric) => metric.semantic === "repsPerSide") === true &&
    !["bilateral", "unilateral"].includes(slot.executionMode||"");
}

/** @param {ProgramSlot} slot @param {ProgramSet} set */
function staticPrescriptionStatus(slot, set) {
  if (set.status === "manual" || set.provenance?.source === "manual") return "manual";
  if (needsExecutionMode(slot)) return "configuration_required";
  if (slot.metricOrigin !== "source_catalog") return "manual";
  const semantics = (slot.metricDefinitions || []).map((metric) => metric.semantic);
  if (!ADAPTIVE_SEMANTICS.some((candidate) => JSON.stringify(candidate) === JSON.stringify(semantics))) return "manual";
  const repSemantic = semantics.find((semantic) => REP_SEMANTICS.includes(semantic));
  const target = set.targets?.[repSemantic||""];
  const range = typeof target==="number"&&Number.isSafeInteger(target)
    ? { min: target, max: target }
    : isObject(target)&&typeof target.min==="number"&&typeof target.max==="number"&&Number.isSafeInteger(target.min) && Number.isSafeInteger(target.max)
      ? { min: target.min, max: target.max }
      : null;
  if (!range || range.min < 1 || range.max < range.min || range.max > MAX_REPS) return "manual";
  if (typeof set.rir!=="number"||!Number.isFinite(set.rir) || set.rir < 0 || set.rir > MAX_RIR) return "configuration_required";
  const coefficient = slot.loadingModel?.bodyweightCoefficient;
  if (typeof coefficient!=="number"||!Number.isFinite(coefficient) || coefficient < 0 || coefficient > 1) return "configuration_required";
  return "ready";
}

/** @param {ProgramSlot} slot */
function classifyExecutionModeStatus(slot) {
  for (const cycle of slot.prescriptionsByCycle || []) for (const set of cycle.sets || []) {
    set.status = staticPrescriptionStatus(slot, set);
  }
}

/** @param {ReviewContext} ctx @param {SourceExercise} exercise @param {CatalogMetrics} metrics */
function catalogFields(ctx, exercise, metrics) {
  return {
    exerciseId: exercise.id,
    sourceExerciseIds: [exercise.id],
    metricIds: metrics.metricIds,
    metricDefinitions: metrics.metricDefinitions,
    metricOrigin: "source_catalog",
    lateralityIds: Array.isArray(exercise.laterality) ? [...exercise.laterality] : [],
    loadingModel: {
      bodyweightCoefficient: typeof exercise.bodyweight==="number"&&Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null,
      assistanceDirection: "subtract",
    },
  };
}
/** @param {ReviewContext} ctx @param {SourceExercise} exercise */
function catalogJobFields(ctx, exercise) {
  /** @type {{musclePurposeIds:string[],movementPatternIds:string[],exerciseTypeId?:string}} */
  const fields = {
    musclePurposeIds: ofType(ctx.catalog, [...(exercise.primaryFeatureMuscle || []), ...(exercise.secondaryFeatureMuscle || [])], "featureMuscleGroup"),
    movementPatternIds: ofType(ctx.catalog, exercise.movementPattern, "movementPattern"),
  };
  if (catalogObject(ctx.catalog, exercise.exerciseType)?.type === "exerciseType") fields.exerciseTypeId = exercise.exerciseType;
  return fields;
}

/** @param {ProgramSlot} slot @param {string} semantic */
function retarget(slot, semantic) {
  for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
    const range = /** @type {RepRange|undefined} */(set.targets?.[repKey(set.targets)||""]);
    set.targets = { [semantic]: range ? { min: range.min, max: range.max } : { min: 8, max: 12 } };
    markReviewed(set);
  }
}

// ---------- one edit ----------

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit @param {ReturnType<typeof idSource>} ids */
function editSets(definition, edit, ids) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  if (typeof edit.count!=="number"||!Number.isInteger(edit.count) || edit.count < MIN_SETS || edit.count > MAX_SETS) return refuse("sets_out_of_range");
  for (const cycle of at.slot.prescriptionsByCycle) {
    const want = isDeload(cycle) ? Math.max(MIN_SETS, Math.ceil(edit.count / 2)) : edit.count;
    if (!cycle.sets.length) return refuse("cycle_empty");
    while (cycle.sets.length > want) cycle.sets.pop();
    while (cycle.sets.length < want) {
      const set = clone(cycle.sets[cycle.sets.length - 1]);
      set.id = ids.next("set");
      set.setIndex = cycle.sets.length + 1;
      markReviewed(set);
      cycle.sets.push(set);
    }
  }
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editRepRange(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  const { min, max } = edit;
  if (typeof min!=="number"||!Number.isInteger(min) || typeof max!=="number"||!Number.isInteger(max) || min < 1 || max < min || max > MAX_REPS) return refuse("reps_out_of_range");
  const reference = at.slot.prescriptionsByCycle[0]?.sets?.[0];
  const key = repKey(reference?.targets);
  if (!key) return refuse("reps_missing");
  const referenceRange=/** @type {RepRange} */(reference.targets[key]);
  const dMin = min - referenceRange.min, dMax = max - referenceRange.max;
  for (const cycle of at.slot.prescriptionsByCycle) for (const set of cycle.sets) {
    const own = repKey(set.targets);
    if (!own) continue;
    const range = /** @type {RepRange} */(set.targets[own]);
    const nextMin = Math.max(1, range.min + dMin);
    set.targets[own] = { min: nextMin, max: Math.min(MAX_REPS, Math.max(nextMin, range.max + dMax)) };
    markReviewed(set);
  }
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editRir(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  const maximum = MAX_RIR;
  if (typeof edit.rir!=="number"||!Number.isInteger(edit.rir) || edit.rir < 0 || edit.rir > maximum) return refuse("rir_out_of_range");
  const index = Number(edit.setIndex) - 1;
  if (typeof edit.setIndex!=="number"||!Number.isInteger(edit.setIndex) || index < 0 || index >= (at.slot.prescriptionsByCycle[0]?.sets?.length || 0)) return refuse("set_missing");
  const delta = edit.rir - Number(at.slot.prescriptionsByCycle[0].sets[index].rir);
  for (const cycle of at.slot.prescriptionsByCycle) {
    const set = cycle.sets[index];
    if (!set) continue;
    // Taurifer's manual edit preserves the generated week-to-week profile.
    set.rir = recoveredBlock(definition)
      ? Math.max(0, Math.min(maximum, Number(set.rir) + delta))
      : Math.min(maximum, isDeload(cycle) ? edit.rir + DELOAD_RIR_OFFSET : edit.rir);
    markReviewed(set);
  }
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editRest(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  if (typeof edit.seconds!=="number"||!REST_PRESETS.includes(edit.seconds)) return refuse("rest_not_a_preset");
  for (const cycle of at.slot.prescriptionsByCycle) for (const set of cycle.sets) {
    set.restSeconds = edit.seconds;
    markReviewed(set);
  }
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit @param {ReviewContext} ctx */
function editSwap(definition, edit, ctx) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  if (edit.exerciseId === at.slot.exerciseId) return refuse("swap_same_movement");
  const exercise = rawExercise(ctx.catalog, edit.exerciseId);
  const metrics = exercise ? catalogMetrics(ctx, exercise) : null;
  if (!exercise||!metrics) return refuse(exercise ? "swap_records_no_reps" : "swap_unknown_movement");
  // An engine candidate fills the same job, so the slot keeps the job's
  // fields and takes the candidate's execution mode; any other movement
  // brings its own muscles, pattern and type from the catalog.
  const candidate = (ctx.compiler.findSubstitutions(definition, at.slot.id, {}, ctx.catalog) || [])
    .find((item) => item.exerciseId === edit.exerciseId);
  const slot = at.slot;
  Object.assign(slot, catalogFields(ctx, exercise, metrics));
  if (candidate) slot.executionMode = candidate.executionMode ?? null;
  else {
    const job = catalogJobFields(ctx, exercise);
    if (!job.exerciseTypeId) delete slot.exerciseTypeId;
    Object.assign(slot, job);
    slot.executionMode = executionModeOf(ctx.catalog, exercise);
  }
  delete slot.displayName;
  if (Array.isArray(slot.alternates)) {
    slot.alternates = slot.alternates.filter((id) => id !== exercise.id);
    if (!slot.alternates.length) delete slot.alternates;
  }
  retarget(slot, metrics.semantic);
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editExecutionMode(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  if (!needsExecutionMode(at.slot)) return refuse("execution_mode_not_required");
  if (!(edit.executionMode==="bilateral"||edit.executionMode==="unilateral")) return refuse("execution_mode_invalid");
  at.slot.executionMode = edit.executionMode;
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit @param {ReviewContext} ctx */
function editAlternates(definition, edit, ctx) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  const list = edit.alternates;
  const max = ctx.compiler.MAX_SLOT_ALTERNATES || 5;
  if (!Array.isArray(list) || list.length > max || list.some((id) => typeof id !== "string" || !id) ||
    new Set(list).size !== list.length || list.includes(at.slot.exerciseId)) return refuse("alternates_invalid");
  if (list.length) at.slot.alternates = [...list];
  else delete at.slot.alternates;
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editMove(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  const target = dayById(definition, edit.toDayId);
  if (!target || target.kind !== "training" || target === at.day) return refuse("move_target_invalid");
  const [slot] = at.day.slots.splice(at.index, 1);
  target.slots.push(slot);
  renumber(at.day);
  renumber(target);
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editRemove(definition, edit) {
  const at = locate(definition, edit.slotId);
  if (!at) return refuse("slot_missing");
  at.day.slots.splice(at.index, 1);
  renumber(at.day);
  return null;
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit */
function editReorder(definition, edit) {
  const day = dayById(definition, edit.dayId);
  if (!day || day.kind !== "training") return refuse("day_missing");
  const ids = edit.slotIds;
  const current = day.slots.map((slot) => slot.id);
  if (!Array.isArray(ids) || ids.length !== current.length || new Set(ids).size !== ids.length ||
    ids.some((id) => !current.includes(id))) return refuse("reorder_mismatch");
  day.slots = ids.map((id) => {const slot=day.slots.find((slot) => slot.id === id);if(!slot)throw new TypeError("Missing reordered slot");return slot;});
  renumber(day);
  return null;
}

/* An added movement is a manual slot of three sets, modeled on an accessory
   of the same program so its ranges, effort and rest read like the rest of
   the plan (the prototype's rule); a deload cycle keeps one set fewer. */
/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit @param {ReviewContext} ctx @param {ReturnType<typeof idSource>} ids */
function editAdd(definition, edit, ctx, ids) {
  const day = dayById(definition, edit.dayId);
  if (!day || day.kind !== "training") return refuse("day_missing");
  const exercise = rawExercise(ctx.catalog, edit.exerciseId);
  const metrics = exercise ? catalogMetrics(ctx, exercise) : null;
  if (!exercise||!metrics) return refuse(exercise ? "add_records_no_reps" : "add_unknown_movement");
  const slots = slotsOf(definition);
  const model = slots.find((slot) => String(slot.role || "").endsWith("Accessory")) || slots[0] || null;
  const slotId = ids.next("slot");
  const prescriptionsByCycle = [];
  for (let cycleIndex = 1; cycleIndex <= definition.cycles; cycleIndex++) {
    const deload = (definition.deloadCycles || []).includes(cycleIndex);
    const base = model?.prescriptionsByCycle?.[cycleIndex - 1]?.sets?.[0] || null;
    const range = /** @type {RepRange} */(base?.targets?.[repKey(base?.targets)||""] || { min: 10, max: 12 });
    const count = deload ? ADDED_SETS - 1 : ADDED_SETS;
    const sets = [];
    for (let setIndex = 1; setIndex <= count; setIndex++) {
      sets.push({
        id: ids.next("set"), cycleIndex, setIndex, metricType: "source_metrics@1",
        targets: { [metrics.semantic]: { min: range.min, max: range.max } },
        rir: typeof base?.rir==="number"&&Number.isFinite(base.rir) ? base.rir : Math.min(MAX_RIR, deload ? 2 + DELOAD_RIR_OFFSET : 2),
        restSeconds: typeof base?.restSeconds==="number"&&Number.isSafeInteger(base.restSeconds) ? base.restSeconds : 90,
        status: "ready",
        provenance: {
          source: PROVENANCE_SOURCE,
          policyVersion: base?.provenance?.policyVersion || definition.provenance?.policyVersion || "review@1",
          ...(base?.provenance?.periodization ? { periodization: base.provenance.periodization } : {}),
          deload,
        },
      });
    }
    prescriptionsByCycle.push({ cycleIndex, sets });
  }
  day.slots.push({
    id: slotId, purposeId: "manual", role: "manual",
    ...catalogFields(ctx, exercise, metrics),
    ...catalogJobFields(ctx, exercise),
    executionMode: executionModeOf(ctx.catalog, exercise),
    prescriptionsByCycle,
    order: day.slots.length + 1,
  });
  return null;
}

/** @param {ProgramDefinition} definition @param {ProgramDay} day @param {string} name @param {ReviewContext|null|undefined} ctx */
function duplicateDayName(definition, day, name, ctx) {
  const wanted = String(name || "").trim();
  return definition.days.some((other) => {
    if (other.id === day.id) return false;
    const stored = typeof other.name === "string" ? other.name.trim() : "";
    const shown = typeof ctx?.dayName === "function" ? ctx.dayName(other, definition) : null;
    return stored === wanted || (typeof shown === "string" && shown.trim() === wanted);
  });
}

/** @param {ProgramDefinition} definition @param {Record<string,unknown>} edit @param {ReviewContext} ctx */
function editDayName(definition, edit, ctx) {
  const day = dayById(definition, edit.dayId);
  if (!day) return refuse("day_missing");
  const name = typeof edit.name === "string" ? edit.name.trim() : "";
  if (!name || name.length > MAX_DAY_NAME) return refuse("day_name_invalid");
  if (duplicateDayName(definition, day, name, ctx)) return refuse("day_name_exists");
  day.name = name;
  return null;
}

/* Ids for slots and sets the lifter creates come from the edit's position in
   the log, so replaying a log rebuilds identical identities. */
/** @param {number} ordinal */
function idSource(ordinal) {
  let count = 0;
  return { next: (/** @type {string} */ kind) => `${kind}-review-${ordinal}-${++count}` };
}

/** @param {ProgramDefinition} definition @param {ReviewContext} ctx */
function refreshEstimates(definition, ctx) {
  const estimates = definition.provenance?.estimatedSessionSeconds;
  if (!isObject(estimates) || typeof ctx.compiler.estimateDaySeconds !== "function") return;
  /** @type {Record<string,number>} */
  const next = {};
  for (const day of definition.days) if (day.kind === "training") next[day.name] = ctx.compiler.estimateDaySeconds(day, undefined, ctx.catalog);
  definition.provenance.estimatedSessionSeconds = next;
}

/** @param {ProgramDefinition} definition @param {unknown} edit @param {ReviewContext|null|undefined} ctx @returns {ReviewResult} */
function applyEdit(definition, edit, ctx) {
  if (!isObject(definition) || !Array.isArray(definition.days)) return refuse("definition_missing");
  if (!isObject(edit) || !isEditKind(edit.kind)) return refuse("edit_unknown");
  if (!ctx?.compiler || !ctx?.catalog) return refuse("context_missing");
  const ordinal = typeof ctx.ordinal==="number"&&Number.isInteger(ctx.ordinal) && ctx.ordinal > 0 ? ctx.ordinal : 1;
  const next = clone(definition);
  const oldSlotIds = new Set(slotsOf(next).map((slot) => slot.id));
  const ids = idSource(ordinal);
  /** @type {Record<string,()=>ReviewRefusal|null>} */
  const handlers = {
    sets: () => editSets(next, edit, ids),
    rep_range: () => editRepRange(next, edit),
    rir: () => editRir(next, edit),
    rest: () => editRest(next, edit),
    swap: () => editSwap(next, edit, ctx),
    execution_mode: () => editExecutionMode(next, edit),
    alternates: () => editAlternates(next, edit, ctx),
    move: () => editMove(next, edit),
    remove: () => editRemove(next, edit),
    reorder: () => editReorder(next, edit),
    add: () => editAdd(next, edit, ctx, ids),
    day_name: () => editDayName(next, edit, ctx),
  };
  const refused = handlers[String(edit.kind)]();
  if (refused) return refused;
  refreshEstimates(next, ctx);
  const checked = ctx.compiler.validateProgramDefinition(next, ctx.catalog, ctx.customDefinitions || []);
  if (!checked?.ok) return refuse("definition_invalid", (checked?.issues || []).slice(0, 12));
  if (["swap", "execution_mode", "add"].includes(String(edit.kind))) {
    const affected = edit.kind === "add"
      ? slotsOf(next).filter((slot) => !oldSlotIds.has(slot.id))
      : [locate(next, edit.slotId)?.slot].filter(slot=>slot!==undefined);
    for (const slot of affected) classifyExecutionModeStatus(slot);
    const classified = ctx.compiler.validateProgramDefinition(next, ctx.catalog, ctx.customDefinitions || []);
    if (!classified?.ok) return refuse("definition_invalid", (classified?.issues || []).slice(0, 12));
  }
  return { ok: true, definition: next };
}

/* The log, edit by edit, on the recommendation. A log that stops applying
   (the recommendation changed under it) says where. */
/** @param {ProgramDefinition} baseline @param {unknown} edits @param {ReviewContext} ctx */
function replay(baseline, edits, ctx) {
  let definition = baseline;
  const list = Array.isArray(edits) ? edits : [];
  for (let index = 0; index < list.length; index++) {
    const result = applyEdit(definition, list[index], { ...ctx, ordinal: index + 1 });
    if (!result.ok) return { ok: false, failedAt: index, code: result.code, definition };
    definition = result.definition;
  }
  return { ok: true, definition };
}

/* What the lifter changed against the recommendation: each edited or added
   row, plus removed rows, renamed days and reordered days, for the marks and
   the count in the changes bar. */
/** @param {ProgramDefinition} baseline @param {ProgramDefinition} working */
function changes(baseline, working) {
  const before = new Map();
  /** @param {ProgramDay} day @param {ProgramSlot} slot */
  const content = (day, slot) => JSON.stringify([day.id, slot.exerciseId, slot.prescriptionsByCycle, slot.alternates || []]);
  for (const day of baseline?.days || []) for (const slot of day.slots || []) before.set(slot.id, content(day, slot));
  /** @type {Record<string,"added"|"edited">} */
  const slots = {};
  let count = 0;
  for (const day of working?.days || []) for (const slot of day.slots || []) {
    if (!before.has(slot.id)) { slots[slot.id] = "added"; count++; }
    else if (before.get(slot.id) !== content(day, slot)) { slots[slot.id] = "edited"; count++; }
  }
  const present = new Set(slotsOf(working).map((slot) => slot.id));
  const removed = [...before.keys()].filter((id) => !present.has(id)).length;
  let renamed = 0, reordered = 0;
  for (const day of working?.days || []) {
    const was = dayById(baseline, day.id);
    if (!was) continue;
    if (was.name !== day.name) renamed++;
    const kept = (was.slots || []).map((slot) => slot.id).filter((id) => (day.slots || []).some((slot) => slot.id === id));
    const now = (day.slots || []).map((slot) => slot.id).filter((id) => kept.includes(id));
    if (kept.join() !== now.join()) reordered++;
  }
  return { slots, removed, renamed, reordered, count: count + removed + renamed + reordered };
}

/* What keeps Activate disabled. An emptied training day is a valid
   definition but not a program a lifter can follow. */
/** @param {ProgramDefinition|null|undefined} definition */
function blockers(definition) {
  return (definition?.days || [])
    .filter((day) => day.kind === "training" && !(day.slots || []).length)
    .map((day) => `day_empty:${day.id}`);
}

/** @param {unknown} kind */
const isEditKind=kind=>typeof kind==="string"&&EDIT_KIND_SET.has(kind);
const api = Object.freeze({ isEditKind,locateSlot:locate,slotsOf,repKey,recoveredBlock,catalogMetrics,needsExecutionMode,duplicateDayName, JOB_KEYS, EDIT_KINDS, REST_PRESETS, MIN_SETS, MAX_SETS, MAX_REPS, MAX_RIR, MAX_DAY_NAME, applyEdit, replay, changes, blockers });
export { isEditKind,locate as locateSlot,slotsOf,repKey,recoveredBlock,catalogMetrics,needsExecutionMode,duplicateDayName, JOB_KEYS, EDIT_KINDS, REST_PRESETS, MIN_SETS, MAX_SETS, MAX_REPS, MAX_RIR, MAX_DAY_NAME, applyEdit, replay, changes, blockers };
export default api;
