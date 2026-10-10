(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeProgramReview = api;
})(typeof window !== "undefined" ? window : globalThis, function (root) {
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

  const MIN_SETS = 1;
  const MAX_SETS = 8;
  const MAX_REPS = 30;
  const MAX_RIR = 4;
  const DELOAD_RIR_OFFSET = 2;
  const REST_PRESETS = Object.freeze([60, 90, 120, 150, 180, 240]);
  const MAX_DAY_NAME = 40;
  const ADDED_SETS = 3;
  const REP_SEMANTICS = Object.freeze(["reps", "repsPerSide"]);
  const EDIT_KINDS = Object.freeze([
    "sets", "rep_range", "rir", "rest", "swap", "alternates",
    "move", "remove", "reorder", "add", "day_name",
  ]);
  const EDIT_KIND_SET = new Set(EDIT_KINDS);
  const PROVENANCE_SOURCE = "lifter_review";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const unique = (list) => [...new Set(list)];
  const refuse = (code, issues = []) => ({ ok: false, code, issues });

  function slotsOf(definition) {
    return (definition?.days || []).flatMap((day) => day.slots || []);
  }
  function locate(definition, slotId) {
    for (const day of definition.days || []) {
      const index = (day.slots || []).findIndex((slot) => slot.id === slotId);
      if (index >= 0) return { day, index, slot: day.slots[index] };
    }
    return null;
  }
  const dayById = (definition, dayId) => (definition.days || []).find((day) => day.id === dayId) || null;
  const isDeload = (cycle) => (cycle.sets || []).some((set) => set.provenance?.deload === true);
  const repKey = (targets) => REP_SEMANTICS.find((key) => isObject(targets?.[key])) || null;
  const renumber = (day) => (day.slots || []).forEach((slot, index) => { slot.order = index + 1; });

  function markReviewed(set) {
    set.provenance = { ...(set.provenance || {}), source: PROVENANCE_SOURCE };
  }

  function rawExercise(catalog, id) {
    return (catalog?.exercises || []).find((exercise) => exercise.id === id) || null;
  }
  function catalogObject(catalog, id) {
    return typeof id === "string" && Object.prototype.hasOwnProperty.call(catalog?.uuidIndex || {}, id)
      ? catalog.uuidIndex[id] : null;
  }
  function ofType(catalog, ids, type) {
    return unique((Array.isArray(ids) ? ids : []).filter((id) => catalogObject(catalog, id)?.type === type));
  }

  /* A catalog movement's metric composition, through the same metric domain the
     compiler uses. Only movements that record reps can stand in a review slot. */
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
  function executionModeOf(catalog, exercise) {
    const names = (Array.isArray(exercise?.laterality) ? exercise.laterality : [])
      .map((id) => catalogObject(catalog, id)?.name);
    const unilateral = names.includes("Unilateral"), bilateral = names.includes("Bilateral");
    if (unilateral && bilateral) return null;
    if (unilateral) return "unilateral";
    if (bilateral) return "bilateral";
    return null;
  }

  function catalogFields(ctx, exercise, metrics) {
    return {
      exerciseId: exercise.id,
      sourceExerciseIds: [exercise.id],
      metricIds: metrics.metricIds,
      metricDefinitions: metrics.metricDefinitions,
      metricOrigin: "source_catalog",
      lateralityIds: Array.isArray(exercise.laterality) ? [...exercise.laterality] : [],
      loadingModel: {
        bodyweightCoefficient: Number.isFinite(exercise.bodyweight) ? exercise.bodyweight : null,
        assistanceDirection: "subtract",
      },
    };
  }
  function catalogJobFields(ctx, exercise) {
    const fields = {
      musclePurposeIds: ofType(ctx.catalog, [...(exercise.primaryFeatureMuscle || []), ...(exercise.secondaryFeatureMuscle || [])], "featureMuscleGroup"),
      movementPatternIds: ofType(ctx.catalog, exercise.movementPattern, "movementPattern"),
    };
    if (catalogObject(ctx.catalog, exercise.exerciseType)?.type === "exerciseType") fields.exerciseTypeId = exercise.exerciseType;
    return fields;
  }

  function retarget(slot, semantic) {
    for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) {
      const range = set.targets?.[repKey(set.targets)];
      set.targets = { [semantic]: range ? { min: range.min, max: range.max } : { min: 8, max: 12 } };
      markReviewed(set);
    }
  }

  // ---------- one edit ----------

  function editSets(definition, edit, ids) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    if (!Number.isInteger(edit.count) || edit.count < MIN_SETS || edit.count > MAX_SETS) return refuse("sets_out_of_range");
    for (const cycle of at.slot.prescriptionsByCycle) {
      const want = isDeload(cycle) ? Math.max(MIN_SETS, edit.count - 1) : edit.count;
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

  function editRepRange(definition, edit) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    const { min, max } = edit;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > MAX_REPS) return refuse("reps_out_of_range");
    const reference = at.slot.prescriptionsByCycle[0]?.sets?.[0];
    const key = repKey(reference?.targets);
    if (!key) return refuse("reps_missing");
    const dMin = min - reference.targets[key].min, dMax = max - reference.targets[key].max;
    for (const cycle of at.slot.prescriptionsByCycle) for (const set of cycle.sets) {
      const own = repKey(set.targets);
      if (!own) continue;
      const range = set.targets[own];
      const nextMin = Math.max(1, range.min + dMin);
      set.targets[own] = { min: nextMin, max: Math.min(MAX_REPS, Math.max(nextMin, range.max + dMax)) };
      markReviewed(set);
    }
    return null;
  }

  function editRir(definition, edit) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    if (!Number.isInteger(edit.rir) || edit.rir < 0 || edit.rir > MAX_RIR) return refuse("rir_out_of_range");
    const index = edit.setIndex - 1;
    if (!Number.isInteger(edit.setIndex) || index < 0 || index >= (at.slot.prescriptionsByCycle[0]?.sets?.length || 0)) return refuse("set_missing");
    for (const cycle of at.slot.prescriptionsByCycle) {
      const set = cycle.sets[index];
      if (!set) continue;
      set.rir = Math.min(MAX_RIR, isDeload(cycle) ? edit.rir + DELOAD_RIR_OFFSET : edit.rir);
      markReviewed(set);
    }
    return null;
  }

  function editRest(definition, edit) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    if (!REST_PRESETS.includes(edit.seconds)) return refuse("rest_not_a_preset");
    for (const cycle of at.slot.prescriptionsByCycle) for (const set of cycle.sets) {
      set.restSeconds = edit.seconds;
      markReviewed(set);
    }
    return null;
  }

  function editSwap(definition, edit, ctx) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    if (edit.exerciseId === at.slot.exerciseId) return refuse("swap_same_movement");
    const exercise = rawExercise(ctx.catalog, edit.exerciseId);
    const metrics = exercise ? catalogMetrics(ctx, exercise) : null;
    if (!metrics) return refuse(exercise ? "swap_records_no_reps" : "swap_unknown_movement");
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

  function editRemove(definition, edit) {
    const at = locate(definition, edit.slotId);
    if (!at) return refuse("slot_missing");
    at.day.slots.splice(at.index, 1);
    renumber(at.day);
    return null;
  }

  function editReorder(definition, edit) {
    const day = dayById(definition, edit.dayId);
    if (!day || day.kind !== "training") return refuse("day_missing");
    const ids = edit.slotIds;
    const current = day.slots.map((slot) => slot.id);
    if (!Array.isArray(ids) || ids.length !== current.length || new Set(ids).size !== ids.length ||
      ids.some((id) => !current.includes(id))) return refuse("reorder_mismatch");
    day.slots = ids.map((id) => day.slots.find((slot) => slot.id === id));
    renumber(day);
    return null;
  }

  /* An added movement is a manual slot of three sets, modeled on an accessory
     of the same program so its ranges, effort and rest read like the rest of
     the plan (the prototype's rule); a deload cycle keeps one set fewer. */
  function editAdd(definition, edit, ctx, ids) {
    const day = dayById(definition, edit.dayId);
    if (!day || day.kind !== "training") return refuse("day_missing");
    const exercise = rawExercise(ctx.catalog, edit.exerciseId);
    const metrics = exercise ? catalogMetrics(ctx, exercise) : null;
    if (!metrics) return refuse(exercise ? "add_records_no_reps" : "add_unknown_movement");
    const slots = slotsOf(definition);
    const model = slots.find((slot) => String(slot.role || "").endsWith("Accessory")) || slots[0] || null;
    const slotId = ids.next("slot");
    const prescriptionsByCycle = [];
    for (let cycleIndex = 1; cycleIndex <= definition.cycles; cycleIndex++) {
      const deload = (definition.deloadCycles || []).includes(cycleIndex);
      const base = model?.prescriptionsByCycle?.[cycleIndex - 1]?.sets?.[0] || null;
      const range = base?.targets?.[repKey(base?.targets)] || { min: 10, max: 12 };
      const count = deload ? ADDED_SETS - 1 : ADDED_SETS;
      const sets = [];
      for (let setIndex = 1; setIndex <= count; setIndex++) {
        sets.push({
          id: ids.next("set"), cycleIndex, setIndex, metricType: "source_metrics@1",
          targets: { [metrics.semantic]: { min: range.min, max: range.max } },
          rir: Number.isFinite(base?.rir) ? base.rir : Math.min(MAX_RIR, deload ? 2 + DELOAD_RIR_OFFSET : 2),
          restSeconds: Number.isSafeInteger(base?.restSeconds) ? base.restSeconds : 90,
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

  function editDayName(definition, edit) {
    const day = dayById(definition, edit.dayId);
    if (!day) return refuse("day_missing");
    const name = typeof edit.name === "string" ? edit.name.trim() : "";
    if (!name || name.length > MAX_DAY_NAME) return refuse("day_name_invalid");
    day.name = name;
    return null;
  }

  /* Ids for slots and sets the lifter creates come from the edit's position in
     the log, so replaying a log rebuilds identical identities. */
  function idSource(ordinal) {
    let count = 0;
    return { next: (kind) => `${kind}-review-${ordinal}-${++count}` };
  }

  function refreshEstimates(definition, ctx) {
    const estimates = definition.provenance?.estimatedSessionSeconds;
    if (!isObject(estimates) || typeof ctx.compiler.estimateDaySeconds !== "function") return;
    const next = {};
    for (const day of definition.days) if (day.kind === "training") next[day.name] = ctx.compiler.estimateDaySeconds(day);
    definition.provenance.estimatedSessionSeconds = next;
  }

  function applyEdit(definition, edit, ctx) {
    if (!isObject(definition) || !Array.isArray(definition.days)) return refuse("definition_missing");
    if (!isObject(edit) || !EDIT_KIND_SET.has(edit.kind)) return refuse("edit_unknown");
    if (!ctx?.compiler || !ctx?.catalog) return refuse("context_missing");
    const ordinal = Number.isInteger(ctx.ordinal) && ctx.ordinal > 0 ? ctx.ordinal : 1;
    const next = clone(definition);
    const ids = idSource(ordinal);
    const handlers = {
      sets: () => editSets(next, edit, ids),
      rep_range: () => editRepRange(next, edit),
      rir: () => editRir(next, edit),
      rest: () => editRest(next, edit),
      swap: () => editSwap(next, edit, ctx),
      alternates: () => editAlternates(next, edit, ctx),
      move: () => editMove(next, edit),
      remove: () => editRemove(next, edit),
      reorder: () => editReorder(next, edit),
      add: () => editAdd(next, edit, ctx, ids),
      day_name: () => editDayName(next, edit),
    };
    const refused = handlers[edit.kind]();
    if (refused) return refused;
    refreshEstimates(next, ctx);
    const checked = ctx.compiler.validateProgramDefinition(next, ctx.catalog, ctx.customDefinitions || []);
    if (!checked?.ok) return refuse("definition_invalid", (checked?.issues || []).slice(0, 12));
    return { ok: true, definition: next };
  }

  /* The log, edit by edit, on the recommendation. A log that stops applying
     (the recommendation changed under it) says where. */
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
  function changes(baseline, working) {
    const before = new Map();
    const content = (day, slot) => JSON.stringify([day.id, slot.exerciseId, slot.prescriptionsByCycle, slot.alternates || []]);
    for (const day of baseline?.days || []) for (const slot of day.slots || []) before.set(slot.id, content(day, slot));
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
  function blockers(definition) {
    return (definition?.days || [])
      .filter((day) => day.kind === "training" && !(day.slots || []).length)
      .map((day) => `day_empty:${day.id}`);
  }

  return Object.freeze({
    EDIT_KINDS,
    REST_PRESETS,
    MIN_SETS,
    MAX_SETS,
    MAX_REPS,
    MAX_RIR,
    MAX_DAY_NAME,
    applyEdit,
    replay,
    changes,
    blockers,
  });
});
