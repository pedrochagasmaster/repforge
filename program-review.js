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

  // ---------- the review screen ----------

  /*
   * mountProgramReview(host, adapter) draws the recommendation as B's editor
   * and turns every control into one edit above. Like program-editor.js it
   * never reads storage, routes or flags: the adapter supplies the document
   * (the recommendation, the edited definition, the edit log and the name),
   * persists what it is given, and lends the app's sheet, picker, dialog and
   * labels. Every animation goes through the adapter's motion layer.
   */
  const ROLE_KEYS = Object.freeze(["PrimaryCompound", "SecondaryCompound", "Accessory"]);
  const JOB_KEYS = Object.freeze([
    "additional_horizontal_pull", "additional_horizontal_push", "incline_or_overhead_push", "secondary_hip_extension",
    "quadriceps_isolation", "secondary_squat", "horizontal_pull", "horizontal_push", "chest_isolation", "hip_abduction",
    "lat_isolation", "lateral_delts", "knee_flexion", "vertical_pull", "rear_delts", "hip_hinge", "obliques", "biceps",
    "triceps", "calves", "squat", "abs",
  ]);
  const SUGGESTED_SUBSTITUTIONS = 3;
  const MAX_SUBSTITUTIONS = 12;
  const ALTERNATE_SUGGESTIONS = 4;
  const TOAST_MS = 4200;

  function minutesOf(ctx, day) {
    const seconds = ctx.compiler.estimateDaySeconds(day);
    return seconds > 0 ? Math.ceil(seconds / 60) : 0;
  }

  function mountProgramReview(host, adapter) {
    const doc = host.ownerDocument;
    const view = adapter.view || {};
    const esc = adapter.esc;
    const t = adapter.t;
    // Figures in Plex Mono, words in the language font (R7 V-18).
    const nums = adapter.nums || esc;
    let queue = Promise.resolve();
    let sheet = null;
    let toastEl = null, toastTimer = 0;
    let disposed = false;
    const subsCache = new Map();
    let repsOnly = null;

    const read = () => adapter.read();
    const trainingIndex = (definition) => Math.max(0, definition.days.findIndex((day) => day.kind === "training"));
    const findSlot = (definition, slotId) => {
      for (const [dayIndex, day] of definition.days.entries()) {
        const index = (day.slots || []).findIndex((slot) => slot.id === slotId);
        if (index >= 0) return { day, dayIndex, index, slot: day.slots[index] };
      }
      return null;
    };
    const dayName = (definition, day) => adapter.dayName(day, definition);
    const range = (set) => set?.targets?.[repKey(set?.targets)] || null;
    const repsText = (set) => {
      const value = range(set);
      if (!value) return "";
      const key = set.targets.repsPerSide ? "entry.review.reps_side" : "entry.review.reps";
      return t(key, { min: value.min, max: value.max });
    };
    const roleLabel = (role) => {
      if (role === "manual") return t("entry.review.role.manual");
      const key = ROLE_KEYS.find((item) => String(role || "").endsWith(item));
      return key ? t(`entry.review.role.${key}`) : "";
    };
    const jobLabel = (purposeId) => {
      const key = JOB_KEYS.find((item) => String(purposeId || "").endsWith(item));
      return key ? t(`entry.review.job.${key}`) : "";
    };
    const muscles = (slot) => unique((slot.musclePurposeIds || []).map(adapter.muscleName).filter(Boolean)).slice(0, 4);
    const chips = (slot) => `<span class="review__chips">${muscles(slot).map((name) => `<span class="review__chip">${esc(name)}</span>`).join("")}</span>`;
    const icon = (name) => `<span class="icon-mask icon-mask--${name} icon-mask--sm" aria-hidden="true"></span>`;

    function substitutions(definition, slotId) {
      const at = findSlot(definition, slotId);
      if (!at) return [];
      const key = `${slotId}|${at.slot.exerciseId}|${JSON.stringify(definition.days.map((day) => (day.slots || []).map((slot) => slot.exerciseId)))}`;
      if (!subsCache.has(key)) {
        const ctx = read().ctx;
        subsCache.clear();
        subsCache.set(key, (ctx.compiler.findSubstitutions(definition, slotId, {}, ctx.catalog) || [])
          .map((item) => item.exerciseId).filter((id) => id !== at.slot.exerciseId).slice(0, MAX_SUBSTITUTIONS));
      }
      return subsCache.get(key);
    }
    /* What the catalog picker may offer: movements that record reps. */
    function recordsReps(id) {
      if (!repsOnly) {
        const ctx = read().ctx;
        repsOnly = new Set((ctx.catalog.exercises || []).filter((exercise) => catalogMetrics(ctx, exercise)).map((exercise) => exercise.id));
      }
      return repsOnly.has(id);
    }

    // ----- painting -----
    function factsHtml(definition) {
      const training = definition.days.filter((day) => day.kind === "training");
      const ctx = read().ctx;
      const mins = training.filter((day) => (day.slots || []).length).map((day) => minutesOf(ctx, day));
      const exercises = training.reduce((n, day) => n + (day.slots || []).length, 0);
      const minutes = mins.length ? (Math.min(...mins) === Math.max(...mins) ? `${mins[0]}` : `${Math.min(...mins)}–${Math.max(...mins)}`) : "0";
      const cells = [
        [String(training.length), t(training.length === 1 ? "entry.facts.day_one" : "entry.facts.days")],
        [minutes, t("entry.facts.minutes")],
        [String(exercises), adapter.exerciseWord(exercises)],
        [String(definition.cycles), t(definition.cycles === 1 ? "entry.review.facts.week_one" : "entry.review.facts.weeks")],
      ];
      return `<p class="visually-hidden">${esc(cells.map(([value, unit]) => `${value} ${unit}`).join(" · "))}</p>` +
        `<div class="entry__strip review__facts" aria-hidden="true">${cells.map(([value, unit]) =>
          `<div class="entry__strip-cell"><span class="entry__strip-value">${esc(value)}</span><span class="entry__strip-unit">${esc(unit)}</span></div>`).join("")}</div>`;
    }
    function blockHtml(definition) {
      const pattern = slotsOf(definition)[0]?.prescriptionsByCycle?.[0]?.sets?.[0]?.provenance?.periodization || "static";
      const deload = (definition.deloadCycles || [])[0];
      const parts = [t(definition.cycles === 1 ? "entry.review.block.week_one" : "entry.review.block.weeks", { n: definition.cycles }),
        t(`entry.review.block.pattern.${pattern}`)];
      if (deload) parts.push(t("entry.review.block.deload", { n: deload }));
      return `<p class="review__block">${esc(parts.join(" · "))}</p>`;
    }
    function changesHtml(count) {
      if (!count) return `<p class="review__hint">${esc(t("entry.review.tap_hint"))}</p>`;
      return `<div class="review__changes" data-review-changes role="status">` +
        `<span class="review__count" data-review-count><span class="review__dot" aria-hidden="true"></span>${esc(t(count === 1 ? "entry.review.changes_one" : "entry.review.changes", { n: count }))}</span>` +
        `<button type="button" class="text-link" data-review-undo>${esc(t("entry.review.undo"))}</button>` +
        `<button type="button" class="text-link" data-review-restore aria-label="${esc(t("entry.review.restore_aria"))}" aria-haspopup="dialog">${esc(t("entry.review.restore"))}</button></div>`;
    }
    function tabsHtml(definition) {
      return `<div class="review__tabs" role="tablist" aria-label="${esc(t("entry.review.days"))}">${definition.days.map((day, index) => {
        const on = index === view.tab;
        const empty = day.kind === "training" && !(day.slots || []).length;
        const label = day.kind === "training" ? dayName(definition, day) : t("entry.review.rest_tab");
        return `<button type="button" role="tab" id="reviewTab${index}" class="review__tab${on ? " is-on" : ""}" data-review-tab="${index}" aria-selected="${on}" aria-controls="reviewPanel" tabindex="${on ? 0 : -1}">` +
          `${esc(label)}${empty ? `<span class="review__pip" aria-label="${esc(t("entry.review.empty_pip"))}"></span>` : ""}</button>`;
      }).join("")}</div>`;
    }
    function rowHtml(definition, slot, marks) {
      const name = adapter.exerciseName(slot.exerciseId);
      const mark = marks[slot.id] === "added" ? t("entry.review.mark.added") : marks[slot.id] ? t("entry.review.mark.edited") : "";
      const sets = slot.prescriptionsByCycle[0]?.sets || [];
      return `<article class="review__row${mark ? " is-changed" : ""}" data-review-slot="${esc(slot.id)}" data-id="${esc(slot.id)}" role="button" tabindex="0" aria-label="${esc(name)}">` +
        adapter.tile(slot.exerciseId, "md") +
        `<div class="review__rowbody"><h3 class="review__name">${esc(name)}</h3>` +
        (mark ? `<span class="review__mark" data-review-mark><span class="review__dot" aria-hidden="true"></span>${esc(mark)}</span>` : "") +
        `<ol class="review__sets">${sets.map((set, index) => `<li><span class="review__setn num">${index + 1}</span><span class="review__reps">${nums(repsText(set))}</span>` +
          (Number.isFinite(set.rir) ? `<span class="review__rir">${nums(t("entry.review.rir", { n: set.rir }))}</span>` : "") + `</li>`).join("")}</ol>` +
        chips(slot) + `</div>${icon("chev-right")}</article>`;
    }
    function dayHtml(definition, marks) {
      const day = definition.days[view.tab];
      if (!day) return "";
      if (day.kind !== "training") {
        return `<div class="review__rest">${icon("clock")}<p class="review__rest-title">${esc(t("entry.review.rest_title"))}</p><p>${esc(t("entry.review.rest_body"))}</p></div>`;
      }
      const ctx = read().ctx, limit = read().sessionMinutes;
      const minutes = minutesOf(ctx, day), slots = day.slots || [];
      const over = limit && minutes > limit;
      const name = dayName(definition, day);
      const head = `<div class="review__dayhead"><div class="review__dayid">` +
        `<button type="button" class="review__dayname" data-review-day-name aria-label="${esc(t("entry.review.rename_day_aria", { day: name }))}">${esc(name)}${icon("pencil")}</button>` +
        `<p class="review__daymeta" data-review-day-minutes>${nums(`${adapter.exerciseCount(slots.length)} · ${t("entry.review.about_minutes", { n: minutes })}`)}</p>` +
        (over ? `<p class="review__over">${esc(t("entry.review.over", { n: limit }))}</p>` : "") + `</div>` +
        (view.reorder == null ? `<button type="button" class="review__more" data-review-day-menu aria-label="${esc(t("entry.review.day_menu_aria", { day: name }))}" aria-haspopup="dialog">${icon("overflow")}</button>` : "") +
        `</div>`;
      if (view.reorder === view.tab) {
        return head + `<p class="review__hint">${esc(t("entry.review.reorder_hint"))}</p><ol class="review__reorder" data-review-reorder>` +
          slots.map((slot, index) => {
            const label = adapter.exerciseName(slot.exerciseId);
            return `<li class="review__ro" data-id="${esc(slot.id)}"><span class="review__handle" data-review-handle="${esc(slot.id)}" aria-hidden="true">${icon("grip")}</span>` +
              `<span class="review__ro-name">${esc(label)}</span>` +
              `<button type="button" class="review__ro-btn" data-review-reorder-move="${esc(slot.id)}:-1" aria-label="${esc(t("entry.review.move_up", { name: label }))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-reorder-move="${esc(slot.id)}:1" aria-label="${esc(t("entry.review.move_down", { name: label }))}"${index === slots.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button></li>`;
          }).join("") + `</ol><button type="button" class="btn btn--cta btn--noarrow review__reorder-done" data-review-reorder-done>${esc(t("entry.review.reorder_done"))}</button>`;
      }
      const empty = slots.length ? "" : `<p class="review__empty" data-review-empty role="alert">${icon("warn")}<span>${esc(t("entry.review.empty_day"))}</span></p>`;
      return head + empty + slots.map((slot) => rowHtml(definition, slot, marks)).join("") +
        `<button type="button" class="review__add" data-review-add>${icon("plus")}<span>${esc(t("entry.review.add"))}</span></button>`;
    }

    function paint({ before = null, focus = null } = {}) {
      if (disposed) return;
      const state = read();
      const definition = state.definition;
      if (view.tab == null || view.tab >= definition.days.length) view.tab = trainingIndex(definition);
      const count = changes(state.baseline, definition).count;
      const marks = changes(state.baseline, definition).slots;
      const name = state.name;
      host.innerHTML = `<div class="review" data-review>` +
        `<p class="entry__eyebrow review__kicker">${esc(t("entry.review.source"))}</p>` +
        `<h2 class="onb__q review__title" id="entryHeading" tabindex="-1"><button type="button" class="review__titlebtn" data-review-title aria-label="${esc(t("entry.review.rename_program_aria", { name }))}">` +
        `<span>${esc(name)}</span>${icon("pencil")}</button></h2>` +
        factsHtml(definition) + blockHtml(definition) + changesHtml(count) + tabsHtml(definition) +
        `<div class="review__panel" id="reviewPanel" role="tabpanel" aria-labelledby="reviewTab${view.tab}" data-review-panel>${dayHtml(definition, marks)}</div></div>`;
      placeIndicator(false);
      if (before) adapter.motion?.animateExerciseReorder?.([...host.querySelectorAll("[data-id]")], before);
      const target = focus && host.querySelector(focus);
      if (target) target.focus({ preventScroll: true });
      adapter.changed?.();
    }
    function measure() {
      return new Map([...host.querySelectorAll("[data-id]")].map((row) => [row.dataset.id, row.getBoundingClientRect()]));
    }
    /* The shown day's tab is scrolled into the middle of the row. Its selected
       boundary is its own, like every tab row (no travelling indicator). */
    function placeIndicator(animate) {
      const bar = host.querySelector(".review__tabs"), on = host.querySelector(".review__tab.is-on");
      if (!bar || !on) return;
      const left = on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2;
      bar.scrollTo?.({ left, behavior: animate && !adapter.reducedMotion() ? "smooth" : "auto" });
    }
    function setTab(index) {
      const definition = read().definition;
      if (index < 0 || index >= definition.days.length || index === view.tab || view.reorder != null) return;
      view.tab = index;
      const marks = changes(read().baseline, definition).slots;
      host.querySelectorAll("[data-review-tab]").forEach((tab) => {
        const on = Number(tab.dataset.reviewTab) === index;
        tab.classList.toggle("is-on", on);
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      const panel = host.querySelector("[data-review-panel]");
      panel.setAttribute("aria-labelledby", `reviewTab${index}`);
      panel.innerHTML = dayHtml(definition, marks);
      placeIndicator(true);
    }

    // ----- edits -----
    /* Edits run one at a time, each on the document the previous one left.
       While any is in flight the host says so, for assistive tech and tests. */
    let inFlight = 0;
    function run(task) {
      inFlight++;
      host.setAttribute("aria-busy", "true");
      const settle = () => { if (--inFlight === 0) host.removeAttribute("aria-busy"); };
      queue = queue.then(task, task).finally(settle);
      return queue;
    }
    function apply(edit, { toast = null, flip = false, close = false } = {}) {
      return run(async () => {
        if (disposed) return false;
        const state = read();
        const result = applyEdit(state.definition, edit, { ...state.ctx, ordinal: state.edits.length + 1 });
        if (!result.ok) { adapter.announce(t("entry.review.refused")); return false; }
        const before = flip ? measure() : null;
        if (close) await closeSheet();
        const saved = await adapter.commit({ definition: result.definition, edits: [...state.edits, edit], name: state.name });
        if (!saved?.ok) { adapter.announce(t("entry.review.save_failed")); paint(); paintSheet(); return false; }
        paint({ before });
        paintSheet();
        const count = changes(read().baseline, read().definition).count;
        if (toast) showToast(toast);
        else adapter.announce(t(count === 1 ? "entry.review.changes_one" : "entry.review.changes", { n: count }));
        return true;
      });
    }
    function undo() {
      return run(async () => {
        const state = read();
        if (!state.edits.length) return false;
        const edits = state.edits.slice(0, -1);
        const replayed = replay(state.baseline, edits, state.ctx);
        if (!replayed.ok) return false;
        const before = measure();
        const saved = await adapter.commit({ definition: replayed.definition, edits, name: state.name });
        if (!saved?.ok) { adapter.announce(t("entry.review.save_failed")); return false; }
        hideToast();
        paint({ before });
        paintSheet();
        adapter.announce(t("entry.review.toast.undone"));
        return true;
      });
    }
    async function restore() {
      const state = read();
      const count = changes(state.baseline, state.definition).count;
      const confirmed = await adapter.confirm({
        title: t("entry.review.restore_title"),
        body: t(count === 1 ? "entry.review.restore_body_one" : "entry.review.restore_body", { n: count }),
        go: t("entry.review.restore_go"), keep: t("entry.review.keep"),
      });
      if (!confirmed) return false;
      return run(async () => {
        const current = read();
        const saved = await adapter.commit({ definition: current.baseline, edits: [], name: null });
        if (!saved?.ok) { adapter.announce(t("entry.review.save_failed")); return false; }
        view.reorder = null;
        paint({ focus: "[data-review-title]" });
        adapter.announce(t("entry.review.toast.restored"));
        return true;
      });
    }

    // ----- toast -----
    function showToast(text) {
      hideToast();
      toastEl = doc.createElement("div");
      toastEl.className = "review-toast";
      toastEl.setAttribute("role", "status");
      toastEl.innerHTML = `<span class="review-toast__text">${esc(text)}</span><button type="button" class="review-toast__undo" data-review-toast-undo>${esc(t("entry.review.undo"))}</button>`;
      toastEl.querySelector("[data-review-toast-undo]").addEventListener("click", () => { hideToast(); undo(); });
      doc.body.append(toastEl);
      adapter.motion?.revealToast?.(toastEl);
      toastTimer = setTimeout(hideToast, TOAST_MS);
    }
    function hideToast() {
      clearTimeout(toastTimer);
      toastEl?.remove();
      toastEl = null;
    }

    // ----- sheets -----
    function exerciseSheet(slotId) {
      sheet = { kind: "exercise", slotId, showAll: false };
      openSheet();
    }
    function openSheet() {
      const parts = adapter.sheet();
      paintSheet();
      adapter.openSheet({ onClose: () => { sheet = null; } });
      if (sheet?.kind === "rename") {
        const input = parts.body.querySelector("#reviewRenameInput");
        input?.focus();
        input?.select();
      }
    }
    async function closeSheet() {
      if (!sheet) return;
      sheet = null;
      await adapter.closeSheet();
    }
    function paintSheet() {
      if (!sheet || disposed) return;
      const parts = adapter.sheet();
      const state = read(), definition = state.definition;
      if (sheet.kind === "exercise") {
        const at = findSlot(definition, sheet.slotId);
        if (!at) { closeSheet(); return; }
        const slot = at.slot, sets = slot.prescriptionsByCycle[0].sets, first = range(sets[0]);
        const base = (state.baseline.days.find((day) => day.id === at.day.id));
        const was = base ? minutesOf(state.ctx, base) : minutesOf(state.ctx, at.day);
        const now = minutesOf(state.ctx, at.day);
        const deload = (definition.deloadCycles || []).length > 0;
        const subs = substitutions(definition, slot.id);
        const shown = sheet.showAll ? subs : subs.slice(0, SUGGESTED_SUBSTITUTIONS);
        const alternates = slot.alternates || [];
        const max = state.ctx.compiler.MAX_SLOT_ALTERNATES || 5;
        const suggestions = subs.filter((id) => !alternates.includes(id)).slice(0, ALTERNATE_SUGGESTIONS);
        const others = definition.days.filter((day) => day.kind === "training" && day.id !== at.day.id);
        const rest = sets[0]?.restSeconds;
        const name = adapter.exerciseName(slot.exerciseId);
        parts.title.textContent = name;
        parts.body.innerHTML =
          `<div class="review-sheet__head">${adapter.tile(slot.exerciseId, "lg")}<div><p class="review-sheet__role">${esc([roleLabel(slot.role), jobLabel(slot.purposeId)].filter(Boolean).join(" · "))}</p>${chips(slot)}</div></div>` +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.sets"))}</h3>` +
          `<div class="review-sheet__ledger" role="table" aria-label="${esc(t("entry.review.sheet.sets"))}"><div class="review-sheet__lh" role="row"><span role="columnheader">${esc(t("entry.review.sheet.set_col"))}</span><span role="columnheader">${esc(t("entry.review.sheet.reps_col"))}</span><span role="columnheader">${esc(t("entry.review.sheet.rir_col"))}</span></div>` +
          sets.map((set, index) => `<div class="review-sheet__lr" role="row"><span class="review__setn num" role="cell">${index + 1}</span><span role="cell">${nums(repsText(set))}</span>` +
            `<span class="review-step review-step--sm" role="cell"><button type="button" data-review-rir="${index + 1}:-1" aria-label="${esc(t("entry.review.sheet.rir_down", { n: index + 1 }))}"${!(set.rir > 0) ? " disabled" : ""}>−</button><b class="num">${esc(String(set.rir ?? "–"))}</b>` +
            `<button type="button" data-review-rir="${index + 1}:1" aria-label="${esc(t("entry.review.sheet.rir_up", { n: index + 1 }))}"${!(set.rir < MAX_RIR) ? " disabled" : ""}>+</button></span></div>`).join("") + `</div>` +
          `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(t("entry.review.sheet.sets"))}</span><span class="review-step"><button type="button" data-review-sets="-1" aria-label="${esc(t("entry.review.sheet.fewer"))}"${sets.length <= MIN_SETS ? " disabled" : ""}>−</button>` +
          `<b class="num">${esc(t(sets.length === 1 ? "entry.review.sheet.n_sets_one" : "entry.review.sheet.n_sets", { n: sets.length }))}</b><button type="button" data-review-sets="1" aria-label="${esc(t("entry.review.sheet.more"))}"${sets.length >= MAX_SETS ? " disabled" : ""}>+</button></span></div>` +
          (first ? `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(t("entry.review.sheet.range"))}</span><span class="review-sheet__range">` +
            `<span class="review-step review-step--sm"><button type="button" data-review-min="-1" aria-label="${esc(t("entry.review.sheet.min_down"))}"${first.min <= 1 ? " disabled" : ""}>−</button><b class="num">${first.min}</b><button type="button" data-review-min="1" aria-label="${esc(t("entry.review.sheet.min_up"))}"${first.min >= first.max ? " disabled" : ""}>+</button></span>` +
            `<span aria-hidden="true">–</span><span class="review-step review-step--sm"><button type="button" data-review-max="-1" aria-label="${esc(t("entry.review.sheet.max_down"))}"${first.max <= first.min ? " disabled" : ""}>−</button><b class="num">${first.max}</b><button type="button" data-review-max="1" aria-label="${esc(t("entry.review.sheet.max_up"))}"${first.max >= MAX_REPS ? " disabled" : ""}>+</button></span></span></div>` : "") +
          `<div class="review-sheet__ctl review-sheet__ctl--col"><span class="review-sheet__lab" id="reviewRestLab">${esc(t("entry.review.sheet.rest"))}</span><div class="review-seg" role="radiogroup" aria-labelledby="reviewRestLab">` +
          REST_PRESETS.map((seconds) => `<button type="button" role="radio" class="review-seg__opt num${seconds === rest ? " is-on" : ""}" aria-checked="${seconds === rest}" data-review-rest="${seconds}">${esc(t("entry.review.sheet.seconds", { n: seconds }))}</button>`).join("") + `</div></div>` +
          `<p class="review-sheet__time" data-review-day-time>${nums(was === now ? t("entry.review.sheet.day_time", { n: now }) : t("entry.review.sheet.day_time_change", { from: was, to: now }))}` +
          `${state.sessionMinutes && now > state.sessionMinutes ? ` · ${nums(t("entry.review.over", { n: state.sessionMinutes }))}` : ""}</p>` +
          (deload ? `<p class="review-sheet__note">${esc(t("entry.review.sheet.deload_note"))}</p>` : "") + `</section>` +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.swap"))}</h3>` +
          (subs.length ? `<p class="review-sheet__lede">${esc(t("entry.review.sheet.swap_lede"))}</p><ul class="review-sheet__list">${shown.map((id) =>
            `<li>${adapter.tile(id, "sm")}<span>${esc(adapter.exerciseName(id))}</span><button type="button" class="btn btn--steel btn--sm" data-review-swap="${esc(id)}">${esc(t("entry.review.sheet.swap_btn"))}</button></li>`).join("")}</ul>` : "") +
          `<div class="review-sheet__links">${!sheet.showAll && subs.length > SUGGESTED_SUBSTITUTIONS ? `<button type="button" class="text-link" data-review-more-subs>${esc(t("entry.review.sheet.show_more", { n: subs.length - SUGGESTED_SUBSTITUTIONS }))}</button>` : ""}` +
          `<button type="button" class="text-link" data-review-search>${icon("search")}${esc(t("entry.review.sheet.search"))}</button></div></section>` +
          `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.alts"))}</h3><p class="review-sheet__lede">${esc(t("entry.review.sheet.alts_lede"))}</p>` +
          (alternates.length ? `<ol class="review-sheet__alts">${alternates.map((id, index) => {
            const label = adapter.exerciseName(id);
            return `<li><span class="review__setn">${index + 1}</span><span class="review-sheet__alt-name">${esc(label)}</span>` +
              `<button type="button" class="review__ro-btn" data-review-alt-move="${esc(id)}:-1" aria-label="${esc(t("entry.review.move_up", { name: label }))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-alt-move="${esc(id)}:1" aria-label="${esc(t("entry.review.move_down", { name: label }))}"${index === alternates.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button>` +
              `<button type="button" class="review__ro-btn" data-review-alt-remove="${esc(id)}" aria-label="${esc(t("entry.review.sheet.alt_remove", { name: label }))}">${icon("close")}</button></li>`;
          }).join("")}</ol>` : `<p class="review-sheet__empty">${esc(t("entry.review.sheet.alts_none"))}</p>`) +
          (alternates.length < max ? (suggestions.length ? `<p class="review-sheet__sub">${esc(t("entry.review.sheet.alts_add"))}</p><div class="review-sheet__chips">${suggestions.map((id) =>
            `<button type="button" class="review-chipbtn" data-review-alt-add="${esc(id)}">${icon("plus")}${esc(adapter.exerciseName(id))}</button>`).join("")}</div>` : "")
            : `<p class="review-sheet__empty">${esc(t("entry.review.sheet.alts_full", { n: max }))}</p>`) + `</section>` +
          (others.length ? `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(t("entry.review.sheet.move"))}</h3><div class="review-sheet__chips">${others.map((day) =>
            `<button type="button" class="review-chipbtn" data-review-move-to="${esc(day.id)}">${esc(dayName(definition, day))}</button>`).join("")}</div></section>` : "") +
          `<section class="review-sheet__sec"><button type="button" class="btn btn--steel btn--destructive" data-review-remove>${esc(t("entry.review.sheet.remove"))}</button></section>`;
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-review-done>${esc(t("entry.review.sheet.done"))}</button>`;
      } else if (sheet.kind === "day") {
        const day = definition.days[view.tab];
        parts.title.textContent = dayName(definition, day);
        parts.body.innerHTML = `<div class="review-sheet__menu">` +
          `<button type="button" class="exactions__act" data-review-day-action="rename">${icon("pencil")}<span>${esc(t("entry.review.day_menu.rename"))}</span></button>` +
          `<button type="button" class="exactions__act" data-review-day-action="reorder"${(day.slots || []).length < 2 ? " disabled" : ""}>${icon("grip")}<span>${esc(t("entry.review.day_menu.reorder"))}</span></button>` +
          `<button type="button" class="exactions__act" data-review-day-action="add">${icon("plus")}<span>${esc(t("entry.review.day_menu.add"))}</span></button></div>`;
        parts.foot.innerHTML = "";
      } else if (sheet.kind === "rename") {
        const isDay = sheet.target === "day";
        const value = isDay ? dayName(definition, definition.days[view.tab]) : state.name;
        parts.title.textContent = t(isDay ? "entry.review.day_menu.rename" : "entry.review.rename_program");
        parts.body.innerHTML = `<label class="field review-sheet__field"><span class="field__lab">${esc(t(isDay ? "entry.review.day_name" : "entry.review.program_name"))}</span>` +
          `<input class="input" id="reviewRenameInput" maxlength="${isDay ? MAX_DAY_NAME : 60}" value="${esc(value)}" enterkeyhint="done" autocomplete="off"></label>`;
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-review-rename-save>${esc(t("entry.review.save"))}</button>`;
      }
    }

    async function pick(mode, slotId = null) {
      const state = read(), definition = state.definition;
      const at = slotId ? findSlot(definition, slotId) : null;
      const used = new Set(slotsOf(definition).filter((slot) => slot.role !== "manual" && slot.id !== slotId).map((slot) => slot.exerciseId));
      if (at) used.add(at.slot.exerciseId);
      await closeSheet();
      const id = await adapter.pickExercise({
        mode, day: definition.days[view.tab], exercise: at?.slot || null,
        accept: (candidate) => recordsReps(candidate) && (mode !== "replace" || !used.has(candidate)),
      });
      if (!id) return;
      if (mode === "add") {
        const day = definition.days[view.tab];
        apply({ kind: "add", dayId: day.id, exerciseId: id }, { toast: t("entry.review.toast.added", { name: adapter.exerciseName(id) }), flip: true });
      } else {
        apply({ kind: "swap", slotId, exerciseId: id }, { toast: t("entry.review.toast.swapped", { name: adapter.exerciseName(id) }) });
      }
    }

    function onSheetClick(event) {
      if (!sheet) return;
      const target = event.target instanceof Element ? event.target : null;
      const hit = (selector) => target?.closest(selector);
      const state = read();
      if (hit("[data-review-done]")) { closeSheet(); return; }
      if (sheet.kind === "rename") {
        if (hit("[data-review-rename-save]")) saveRename();
        return;
      }
      if (sheet.kind === "day") {
        const action = hit("[data-review-day-action]")?.dataset.reviewDayAction;
        if (action === "rename") { sheet = { kind: "rename", target: "day" }; paintSheet(); const input = adapter.sheet().body.querySelector("#reviewRenameInput"); input?.focus(); input?.select(); }
        if (action === "reorder") { closeSheet().then(() => { view.reorder = view.tab; paint({ focus: "[data-review-reorder-move]:not([disabled])" }); }); }
        if (action === "add") pick("add");
        return;
      }
      const at = findSlot(state.definition, sheet.slotId);
      if (!at) return;
      const slot = at.slot, sets = slot.prescriptionsByCycle[0].sets, first = range(sets[0]);
      let button;
      if ((button = hit("[data-review-sets]"))) apply({ kind: "sets", slotId: slot.id, count: sets.length + Number(button.dataset.reviewSets) });
      else if ((button = hit("[data-review-rir]"))) {
        const [setIndex, dir] = button.dataset.reviewRir.split(":").map(Number);
        apply({ kind: "rir", slotId: slot.id, setIndex, rir: (sets[setIndex - 1].rir ?? 2) + dir });
      } else if ((button = hit("[data-review-min]"))) apply({ kind: "rep_range", slotId: slot.id, min: first.min + Number(button.dataset.reviewMin), max: first.max });
      else if ((button = hit("[data-review-max]"))) apply({ kind: "rep_range", slotId: slot.id, min: first.min, max: first.max + Number(button.dataset.reviewMax) });
      else if ((button = hit("[data-review-rest]"))) {
        const seconds = Number(button.dataset.reviewRest);
        if (seconds !== sets[0].restSeconds) apply({ kind: "rest", slotId: slot.id, seconds });
      } else if ((button = hit("[data-review-swap]"))) {
        const id = button.dataset.reviewSwap;
        apply({ kind: "swap", slotId: slot.id, exerciseId: id }, { toast: t("entry.review.toast.swapped", { name: adapter.exerciseName(id) }) });
      } else if (hit("[data-review-more-subs]")) { sheet.showAll = true; paintSheet(); }
      else if (hit("[data-review-search]")) pick("replace", slot.id);
      else if ((button = hit("[data-review-alt-add]"))) apply({ kind: "alternates", slotId: slot.id, alternates: [...(slot.alternates || []), button.dataset.reviewAltAdd] });
      else if ((button = hit("[data-review-alt-remove]"))) apply({ kind: "alternates", slotId: slot.id, alternates: (slot.alternates || []).filter((id) => id !== button.dataset.reviewAltRemove) });
      else if ((button = hit("[data-review-alt-move]"))) {
        const [id, dir] = button.dataset.reviewAltMove.split(":");
        const list = [...(slot.alternates || [])], from = list.indexOf(id), to = from + Number(dir);
        if (from < 0 || to < 0 || to >= list.length) return;
        [list[from], list[to]] = [list[to], list[from]];
        apply({ kind: "alternates", slotId: slot.id, alternates: list });
      } else if ((button = hit("[data-review-move-to]"))) {
        const day = state.definition.days.find((item) => item.id === button.dataset.reviewMoveTo);
        apply({ kind: "move", slotId: slot.id, toDayId: day.id }, { toast: t("entry.review.toast.moved", { day: dayName(state.definition, day) }), flip: true, close: true });
      } else if (hit("[data-review-remove]")) {
        apply({ kind: "remove", slotId: slot.id }, { toast: t("entry.review.toast.removed", { name: adapter.exerciseName(slot.exerciseId) }), flip: true, close: true });
      }
    }
    function onSheetKey(event) {
      if (sheet?.kind === "rename" && event.key === "Enter" && event.target?.id === "reviewRenameInput") { event.preventDefault(); saveRename(); }
    }
    async function saveRename() {
      const input = adapter.sheet().body.querySelector("#reviewRenameInput");
      const value = String(input?.value || "").trim();
      const state = read(), target = sheet?.target;
      await closeSheet();
      if (target === "day") {
        const day = state.definition.days[view.tab];
        if (!value || value === dayName(state.definition, day)) return;
        apply({ kind: "day_name", dayId: day.id, name: value });
      } else {
        if (!value || value === state.name) return;
        run(async () => {
          const current = read();
          const saved = await adapter.commit({ definition: current.definition, edits: current.edits, name: value });
          if (saved?.ok) paint({ focus: "[data-review-title]" });
          return !!saved?.ok;
        });
      }
    }

    // ----- the page -----
    function onClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const hit = (selector) => target?.closest(selector);
      let el;
      if ((el = hit("[data-review-tab]"))) { setTab(Number(el.dataset.reviewTab)); return; }
      if (hit("[data-review-undo]")) { undo(); return; }
      if (hit("[data-review-restore]")) { restore(); return; }
      if (hit("[data-review-title]")) { sheet = { kind: "rename", target: "program" }; openSheet(); return; }
      if (hit("[data-review-day-name]")) { sheet = { kind: "rename", target: "day" }; openSheet(); return; }
      if (hit("[data-review-day-menu]")) { sheet = { kind: "day" }; openSheet(); return; }
      if (hit("[data-review-add]")) { pick("add"); return; }
      if (hit("[data-review-reorder-done]")) { view.reorder = null; paint({ focus: "[data-review-day-menu]" }); return; }
      if ((el = hit("[data-review-reorder-move]"))) {
        const [slotId, dir] = el.dataset.reviewReorderMove.split(":");
        reorderBy(slotId, Number(dir));
        return;
      }
      if ((el = hit("[data-review-slot]"))) exerciseSheet(el.dataset.reviewSlot);
    }
    function reorderBy(slotId, dir) {
      const day = read().definition.days[view.tab];
      const ids = day.slots.map((slot) => slot.id), from = ids.indexOf(slotId), to = from + dir;
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(to, 0, ...ids.splice(from, 1));
      apply({ kind: "reorder", dayId: day.id, slotIds: ids }, { flip: true }).then(() => {
        host.querySelector(`[data-review-reorder-move="${CSS.escape(slotId)}:${dir}"]:not([disabled])`)?.focus({ preventScroll: true })
          || host.querySelector(`[data-review-reorder-move="${CSS.escape(slotId)}:${-dir}"]`)?.focus({ preventScroll: true });
      });
    }
    function onKey(event) {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest?.("[data-review-slot]");
      if (row && target === row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); exerciseSheet(row.dataset.reviewSlot); return; }
      const tab = target?.closest?.("[data-review-tab]");
      if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        const next = view.tab + (event.key === "ArrowRight" ? 1 : -1);
        setTab(next);
        host.querySelector(`[data-review-tab="${view.tab}"]`)?.focus();
      }
    }
    /* The handle drag of the prototype: the row follows the pointer, the rows it
       passes make room, and the drop is one reorder edit. The arrows are the
       accessible path to the same edit. */
    let drag = null;
    function onPointerDown(event) {
      const handle = event.target instanceof Element ? event.target.closest("[data-review-handle]") : null;
      if (!handle) return;
      event.preventDefault();
      const list = host.querySelector("[data-review-reorder]");
      const rows = [...list.querySelectorAll(".review__ro")];
      const row = handle.closest(".review__ro");
      drag = { id: event.pointerId, row, rows, from: rows.indexOf(row), to: rows.indexOf(row), y0: event.clientY, h: row.offsetHeight };
      row.classList.add("is-lifted");
      handle.setPointerCapture?.(event.pointerId);
    }
    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const dy = event.clientY - drag.y0;
      drag.row.style.transform = `translate3d(0,${dy}px,0)`;
      drag.to = Math.max(0, Math.min(drag.rows.length - 1, drag.from + Math.round(dy / drag.h)));
      drag.rows.forEach((row, index) => {
        if (row === drag.row) return;
        const shift = drag.from < drag.to && index > drag.from && index <= drag.to ? -drag.h
          : drag.from > drag.to && index < drag.from && index >= drag.to ? drag.h : 0;
        row.style.transform = shift ? `translate3d(0,${shift}px,0)` : "";
      });
    }
    function onPointerUp(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const { rows, row, from, to } = drag;
      drag = null;
      rows.forEach((item) => { item.style.transform = ""; });
      row.classList.remove("is-lifted");
      if (event.type === "pointercancel" || to === from) return;
      const day = read().definition.days[view.tab];
      const ids = day.slots.map((slot) => slot.id);
      ids.splice(to, 0, ...ids.splice(from, 1));
      apply({ kind: "reorder", dayId: day.id, slotIds: ids }, { flip: true });
    }
    /* A horizontal swipe on the day moves between days, as in the prototype. */
    let swipe = null;
    function onPanelDown(event) {
      if (!(event.target instanceof Element) || event.target.closest("[data-review-handle]") || !event.target.closest("[data-review-panel]")) return;
      swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }
    function onPanelUp(event) {
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        adapter.swallowClick?.();
        setTab(view.tab + (dx < 0 ? 1 : -1));
      }
    }

    const sheetParts = adapter.sheet();
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("pointerdown", onPanelDown);
    host.addEventListener("pointerup", onPanelUp);
    sheetParts.el.addEventListener("click", onSheetClick);
    sheetParts.el.addEventListener("keydown", onSheetKey);
    paint();

    return {
      refresh: () => { subsCache.clear(); paint(); paintSheet(); },
      dispose() {
        disposed = true;
        hideToast();
        host.removeEventListener("click", onClick);
        host.removeEventListener("keydown", onKey);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerUp);
        host.removeEventListener("pointerdown", onPanelDown);
        host.removeEventListener("pointerup", onPanelUp);
        sheetParts.el.removeEventListener("click", onSheetClick);
        sheetParts.el.removeEventListener("keydown", onSheetKey);
        if (sheet) { sheet = null; adapter.closeSheet(); }
      },
    };
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
    mountProgramReview,
  });
});
