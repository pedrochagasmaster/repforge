(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.mountProgramEditor = api.mountProgramEditor;
  if (root) root.ProgramEditorIntents = api.PROGRAM_EDITOR_INTENTS;
  if (root) root.ProgramEditorSuggestLoads = Object.freeze({
    confirm: api.confirmSuggestLoads, issues: api.suggestLoadsIssues, set: api.setSuggestLoads, setRir: api.setSlotRir,
  });
  if (root) root.ProgramEditorDayOrder = Object.freeze({ reorder: api.reorderTrainingDays, conflict: api.dayOrderConflict });
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  /*
   * The program editor is deliberately a small browser module.  It receives a
   * complete document from its host and gives a complete document back; it
   * never reads a route, storage key, tab, or activation flag.  That makes the
   * exact same editor useful to the setup draft and to an installed program.
   */
  const PROGRAM_EDITOR_INTENTS = Object.freeze([
    "program_name", "day_name", "day_add", "exercise_field", "prescription",
    "exercise_add", "exercise_remove", "day_remove", "exercise_replace",
    "exercise_move", "slot_alternates", "metric_target", "metric_composition",
    "prescription_field", "load_step", "suggest_loads", "suggest_loads_rir", "execution_mode",
    "day_move", "save_draft", "apply", "apply_discard_workout",
  ]);
  const INTENT_SET = new Set(PROGRAM_EDITOR_INTENTS);
  const maxAlternates = () => root?.RepForgeProgramCompiler?.MAX_SLOT_ALTERNATES || 5;
  const METRIC_DOMAIN = root?.RepForgeExerciseMetrics ||
    (typeof require === "function" ? require("./exercise-metrics.js") : null);
  const FALLBACK = Object.freeze({
    programName: "Program name",
    namePlaceholder: "Untitled program",
    dayName: "Day name",
    dayCount: ({ n }) => `${n} exercise${n === 1 ? "" : "s"}`,
    exercises: ({ n }) => `${n} exercise${n === 1 ? "" : "s"}`,
    sets: "SETS",
    setsDecrease: "Decrease sets",
    setsIncrease: "Increase sets",
    expandExercise: ({ name }) => `Expand ${name}`,
    collapseExercise: ({ name }) => `Collapse ${name}`,
    expandDay: ({ day }) => `Expand ${day}`,
    collapseDay: ({ day }) => `Collapse ${day}`,
    repRange: "REP RANGE",
    min: "MIN",
    max: "MAX",
    addExercise: "Add exercise",
    replaceExercise: "Replace exercise",
    removeExercise: "Remove exercise",
    details: "More exercise details",
    notes: "Setup notes",
    primary: "Primary",
    secondary: "Secondary",
    alternates: "Alternates",
    alternatesHint: "Offered first when you swap this exercise during a workout.",
    addAlternate: "Add alternate",
    alternateUp: ({ name }) => `Move ${name} up`,
    alternateDown: ({ name }) => `Move ${name} down`,
    alternateRemove: ({ name }) => `Remove ${name} from alternates`,
    move: "Reorder exercise",
    moveUp: "Move up",
    moveDown: "Move down",
    moveOther: "Move to another day",
    dragInstructions: "Press space bar or enter to start reordering this exercise. Use the arrow keys to move it, space bar or enter to drop it, and escape to cancel.",
    dragPickedUp: ({ name, index, count, day }) => `Picked up ${name}, position ${index} of ${count} in ${day}.`,
    dragOver: ({ name, index, count, day }) => `${name} is now at position ${index} of ${count} in ${day}.`,
    dragDropped: ({ name, index, count, day }) => `Dropped ${name} at position ${index} of ${count} in ${day}.`,
    dragCancelled: ({ name }) => `Reordering cancelled. ${name} stayed where it was.`,
    moved: "Exercise moved",
    exerciseAdded: "Exercise added.",
    exerciseChanged: "Exercise changed.",
    exerciseRemoved: "Exercise removed.",
    undo: "Undo",
    invalid: "Fix the highlighted values before continuing.",
    dayNameExists: "That day name already exists.",
    saved: "Draft saved",
    emptyDays: "Add an exercise to each training day.",
    more: "More",
    close: "Close",
    context: "",
    metricTargets: "Training targets",
    metricCycle: ({ n }) => `Cycle ${n}`,
    metricSet: ({ n }) => `Set ${n}`,
    metricComposition: "Metric composition",
    metricUnconfigured: "Not configured",
    metricTargetAria: ({ cycle, set, metric }) => `${cycle}, ${set}, ${metric}`,
    metricTargetMinAria: ({ cycle, set, metric }) => `${cycle}, ${set}, ${metric} minimum`,
    metricTargetMaxAria: ({ cycle, set, metric }) => `${cycle}, ${set}, ${metric} maximum`,
    metricRir: "Target RIR",
    loadStep: "Smallest load change",
    loadStepHint: "Suggested loads move in steps of this size.",
    suggestLoads: "Suggest loads",
    suggestLoadsRange: ({ min, max }) => `Current rep target · ${min}–${max}`,
    suggestLoadsCustom: "Custom exercises use the targets you set.",
    suggestLoadsUnsupported: "Taurifer doesn't suggest loads for timed or distance work.",
    executionModeQuestion: "How do you do this exercise?",
    executionModeBilateral: "Both sides together",
    executionModeUnilateral: "One side at a time",
    metricRestSeconds: "Rest between sets (seconds)",
    prescriptionFieldAria: ({ cycle, set, field }) => `${cycle}, ${set}, ${field}`,
  });
  const I18N_KEYS = Object.freeze({
    programName: "program.editor.program_name", namePlaceholder: "program.editor.name_placeholder",
    dayName: "program.editor.day_name", dayCount: "program.editor.day_count", exercises: "program.editor.day_count",
    sets: "program.editor.sets", setsDecrease: "program.editor.sets_decrease", setsIncrease: "program.editor.sets_increase",
    expandExercise: "program.editor.expand_exercise", collapseExercise: "program.editor.collapse_exercise",
    expandDay: "program.day.expand", collapseDay: "program.day.collapse", repRange: "program.editor.rep_range", min: "program.editor.min", max: "program.editor.max",
    addExercise: "program.editor.add_exercise", replaceExercise: "program.editor.replace_exercise",
    removeExercise: "program.editor.remove_exercise", removeDay: "program.editor.remove_day",
    details: "program.editor.details", notes: "program.editor.notes", primary: "program.editor.primary",
    secondary: "program.editor.secondary",
    alternates: "program.editor.alternates", alternatesHint: "program.editor.alternates_hint",
    addAlternate: "program.editor.add_alternate", alternateUp: "program.editor.alternate_up",
    alternateDown: "program.editor.alternate_down", alternateRemove: "program.editor.alternate_remove",
    move: "program.editor.move", moveUp: "program.editor.move_up", moveDown: "program.editor.move_down",
    moveOther: "program.editor.move_other", moved: "program.editor.moved", undo: "program.editor.undo",
    exerciseAdded: "toast.exercise_added", exerciseChanged: "toast.exercise_changed", exerciseRemoved: "toast.exercise_removed",
    dragInstructions: "program.editor.drag.instructions", dragPickedUp: "program.editor.drag.picked_up",
    dragOver: "program.editor.drag.over", dragDropped: "program.editor.drag.dropped",
    dragCancelled: "program.editor.drag.cancelled",
    invalid: "program.editor.invalid", dayNameExists: "toast.day_name_exists", saved: "program.editor.draft_saved", emptyDays: "program.editor.empty_days",
    more: "program.editor.more", close: "dialog.close",
    metricTargets: "program.editor.metric_targets", metricCycle: "program.editor.metric_cycle",
    metricSet: "program.editor.metric_set", metricComposition: "program.editor.metric_composition",
    metricUnconfigured: "program.editor.metric_unconfigured", metricTargetAria: "program.editor.metric_target_aria",
    metricTargetMinAria: "program.editor.metric_target_min_aria", metricTargetMaxAria: "program.editor.metric_target_max_aria",
    metricRir: "program.editor.metric_rir", loadStep: "program.editor.load_step", loadStepHint: "program.editor.load_step_hint", metricRestSeconds: "program.editor.metric_rest_seconds",
    suggestLoads: "program.editor.suggest_loads", suggestLoadsRange: "program.editor.suggest_loads_range",
    suggestLoadsCustom: "program.editor.suggest_loads_custom", suggestLoadsUnsupported: "program.editor.suggest_loads_unsupported",
    executionModeQuestion: "entry.review.execution_mode.question", executionModeBilateral: "entry.review.execution_mode.bilateral",
    executionModeUnilateral: "entry.review.execution_mode.unilateral",
    prescriptionFieldAria: "program.editor.prescription_field_aria",
  });

  const clone = value => {
    if (value == null || typeof value !== "object") return value;
    return JSON.parse(JSON.stringify(value));
  };
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const uid = () => {
    try { return root?.crypto?.randomUUID?.() || `program-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
    catch { return `program-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  };
  const number = value => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const positiveInt = (value, fallback) => {
    const n = Math.round(number(value));
    return n > 0 ? n : fallback;
  };
  const stable = value => {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  };
  const equal = (a, b) => stable(a) === stable(b);
  const cssEscape = value => {
    try { return root.CSS?.escape ? root.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
    catch { return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  };

  function t(adapter, key, vars, fallback) {
    try {
      const translated = adapter?.t?.(key, vars);
      if (translated && translated !== key) return translated;
    } catch { /* A host without i18n still gets a usable editor. */ }
    const value = fallback ?? FALLBACK[key];
    return typeof value === "function" ? value(vars || {}) : value ?? key;
  }
  function format(adapter, value) {
    try { return adapter?.formatNumber ? adapter.formatNumber(value) : String(value); }
    catch { return String(value); }
  }
  function reducedMotion(adapter) {
    try { return !!adapter?.reducedMotion?.() || !!root?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches; }
    catch { return false; }
  }

  function metaDays(document) {
    const entries = document?.programMeta?.programStructure?.days;
    return Array.isArray(entries) ? entries : [];
  }
  function labels(document) {
    const out = [], seen = new Set();
    for (const entry of metaDays(document)) {
      const label = String(entry?.label || entry?.dayId || "").trim();
      if (label && !seen.has(label)) { seen.add(label); out.push(label); }
    }
    for (const exercise of Array.isArray(document?.program) ? document.program : []) {
      const label = String(exercise?.day || "").trim();
      if (label && !seen.has(label)) { seen.add(label); out.push(label); }
    }
    return out;
  }
  function exercisesFor(document, day) {
    return (Array.isArray(document?.program) ? document.program : [])
      .filter(exercise => exercise?.day === day)
      .sort((a, b) => number(a.order) - number(b.order) || String(a.name || "").localeCompare(String(b.name || "")));
  }
  function normalizeOrders(document) {
    const rows = Array.isArray(document.program) ? document.program : [];
    for (const day of labels(document)) exercisesFor({ program: rows }, day).forEach((exercise, index) => { exercise.order = index + 1; });
    return document;
  }
  function structureFor(document, label) {
    return metaDays(document).find(entry => String(entry?.label || entry?.dayId || "") === label) || null;
  }
  function dayDisplay(adapter, document, day, index) {
    // Staged renames live in the editor document until the host applies them.
    // Prefer that value over the host's live resolver so a redraw cannot make
    // an in-progress rename appear to have been lost.
    const stored = structureFor(document, day);
    if (typeof stored?.nameOverride === "string" && stored.nameOverride.trim())
      return stored.nameOverride.trim();
    try {
      const value = adapter?.dayLabel?.(day, index, stored);
      if (value) return value;
    } catch { /* fall through to the stored label */ }
    return String(day || `Day ${index + 1}`);
  }
  function exerciseName(adapter, exercise) {
    try {
      const value = adapter?.exerciseLabel?.(exercise);
      if (value) return value;
    } catch { /* stored name is authoritative for the editor */ }
    return String(exercise?.name || "Exercise");
  }
  /* The read-only label for an exercise (aria-labels, drag announcements): the host may
     localise a stored library name for display. The editable name field keeps the stored text. */
  function exerciseDisplayLabel(adapter, exercise) {
    try {
      const value = adapter?.exerciseDisplayLabel?.(exercise);
      if (value) return value;
    } catch { /* fall back to the stored name */ }
    return exerciseName(adapter, exercise);
  }
  function exerciseEntry(adapter, id) {
    try { return adapter?.exerciseEntry?.(id) || null; } catch { return null; }
  }
  function movementLabel(adapter, id) {
    try {
      const value = adapter?.movementLabel?.(id);
      if (value) return String(value);
    } catch { /* fall back to the library entry's own name */ }
    return String(exerciseEntry(adapter, id)?.name || id);
  }
  function exerciseMetricDefinitions(adapter, exercise) {
    if (Array.isArray(exercise?.metricDefinitions)) return clone(exercise.metricDefinitions);
    try {
      const supplied = adapter?.metricDefinitionsForExercise?.(exercise?.libraryId || exercise?.exerciseId);
      if (Array.isArray(supplied)) return clone(supplied);
    } catch { /* the stored canonical definitions remain available */ }
    return [];
  }
  function metricOptions(adapter) {
    try {
      const supplied = adapter?.metricOptions?.();
      if (Array.isArray(supplied)) return supplied;
    } catch { /* use the shared metric domain */ }
    return METRIC_DOMAIN?.DEFINITIONS || [];
  }
  function metricCompositions(adapter) {
    try {
      const supplied = adapter?.metricCompositions?.();
      if (Array.isArray(supplied)) return supplied;
    } catch { /* use the shared metric domain */ }
    return METRIC_DOMAIN?.SOURCE_COMPOSITIONS || [];
  }
  function metricLabel(adapter, definition) {
    try {
      const supplied = adapter?.metricLabel?.(definition);
      if (supplied) return supplied;
    } catch { /* canonical source name is still useful */ }
    return String(definition?.sourceName || definition?.semantic || "Metric");
  }
  function metricDisplayUnit(adapter, definition) {
    try { return String(adapter?.metricDisplayUnit?.(definition) || ""); }
    catch { return ""; }
  }
  function formatMetricValue(adapter, definition, value) {
    try {
      const supplied = adapter?.formatMetricValue?.(definition, value);
      if (supplied !== undefined && supplied !== null) return String(supplied);
    } catch { /* canonical value remains editable */ }
    return format(adapter, value);
  }
  function parseMetricInput(adapter, definition, raw) {
    try {
      const supplied = adapter?.parseMetricInput?.(definition, raw);
      if (supplied && typeof supplied === "object") return supplied;
    } catch { /* fall through to the shared numeric validator */ }
    const parsed = METRIC_DOMAIN?.parseMetricValue?.(definition, raw);
    return parsed?.ok ? { value: parsed.value } : { field: "metric" };
  }
  function metricCycleIndex(adapter, document) {
    try {
      const value = Number(adapter?.cycleIndex?.(document));
      if (Number.isInteger(value) && value > 0) return value;
    } catch { /* cycle one is the safe editing default */ }
    return 1;
  }
  function definitionFor(document) {
    const value = document?.programMeta?.programDefinition;
    return value && Array.isArray(value.days) ? value : null;
  }
  function definitionSlot(document, slotId) {
    const definition = definitionFor(document);
    for (const day of definition?.days || []) {
      const slot = (day.slots || []).find(candidate => candidate?.id === slotId);
      if (slot) return slot;
    }
    return null;
  }
  function definitionCycle(slot, cycleIndex) {
    return (slot?.prescriptionsByCycle || []).find(cycle => cycle?.cycleIndex === cycleIndex) || null;
  }
  function definitionSet(document, slotId, cycleIndex, setIndex) {
    const cycle = definitionCycle(definitionSlot(document, slotId), cycleIndex);
    return (cycle?.sets || []).find(set => set?.setIndex === setIndex) || null;
  }
  function setCountFor(document, exercise, cycleIndex) {
    const slot = definitionSlot(document, exercise?.slotId || exercise?.id);
    const cycle = definitionCycle(slot, cycleIndex);
    return Array.isArray(cycle?.sets) ? cycle.sets.length : positiveInt(exercise?.sets, 1);
  }
  function editableMetricComposition(slot) {
    return !!slot && (slot.metricOrigin === "user_defined" || !slot.metricIds?.length);
  }
  function replaceMetricComposition(document, exercise, metricIds, definitions) {
    const slotId = exercise?.slotId || exercise?.id;
    const slot = definitionSlot(document, slotId);
    if (!editableMetricComposition(slot)) return false;
    const keepSemantics = new Set(definitions.map(definition => definition.semantic));
    slot.metricIds = clone(metricIds);
    slot.metricDefinitions = clone(definitions);
    slot.metricOrigin = String(slot.exerciseId || exercise.libraryId || "").startsWith("custom:") || metricIds.length
      ? "user_defined" : "source_catalog";
    // Schema v2: a set derives its metric composition from its slot rather
    // than storing it again, so only the slot above is rewritten here.
    for (const cycle of slot.prescriptionsByCycle || []) for (const set of cycle.sets || []) {
      set.targets = Object.fromEntries(Object.entries(set.targets || {}).filter(([semantic]) => keepSemantics.has(semantic)));
      set.status = metricIds.length ? "manual" : "configuration_required";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    }
    const custom = (document.customExercises || []).find(entry => entry?.id === slot.exerciseId);
    if (custom) {
      custom.metricIds = clone(metricIds);
      custom.metricDefinitions = clone(definitions);
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row) {
      row.metricIds = clone(metricIds);
      row.metricDefinitions = clone(definitions);
      row.metricOrigin = slot.metricOrigin;
      row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    }
    return true;
  }
  function replaceMetricTarget(document, slotId, cycleIndex, setIndex, semantic, after) {
    const set = definitionSet(document, slotId, cycleIndex, setIndex);
    if (!set) return false;
    const targets = { ...(set.targets || {}) };
    if (after.present) targets[semantic] = clone(after.value);
    else delete targets[semantic];
    set.targets = targets;
    // Plan 069 D3: the rep range is an input of the suggestion, so editing it
    // keeps an adaptive set adaptive. Any other target is the lifter's own.
    if (!(set.status === "ready" && REP_TARGET_SEMANTICS.has(semantic))) {
      set.status = "manual";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    }
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    const slot = definitionSlot(document, slotId);
    if (row && slot) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    return true;
  }

  /*
   * Plan 069 S4: the per-slot "Suggest loads" opt-in. Turning the switch on
   * only marks the slot as pending (programMeta.suggestLoadsPending), which a
   * saved setup draft keeps. A pending slot stays manual and drives nothing.
   * The host's commit points (Build's "Use this program", the installed
   * editor's Done) confirm it: every set in every cycle becomes ready with
   * the RIR the lifter gave and manual-adaptive provenance.
   */
  const REP_TARGET_SEMANTICS = new Set(["reps", "repsPerSide"]);
  const ADAPTIVE_POLICY_VERSION = "manual-adaptive@1";
  const EXECUTION_MODES = new Set(["bilateral", "unilateral"]);
  function slotSets(slot) {
    return (slot?.prescriptionsByCycle || []).flatMap(cycle => cycle?.sets || []);
  }
  function slotAdaptive(slot) {
    const sets = slotSets(slot);
    return sets.length > 0 && sets.every(set => set.status === "ready");
  }
  function pendingSuggestLoads(document) {
    const list = document?.programMeta?.suggestLoadsPending;
    return Array.isArray(list) ? list.filter(id => typeof id === "string" && id) : [];
  }
  function setPendingSuggestLoads(document, list) {
    document.programMeta = document.programMeta || {};
    const unique = [...new Set(list)];
    if (unique.length) document.programMeta.suggestLoadsPending = unique;
    else delete document.programMeta.suggestLoadsPending;
  }
  function slotRepSemantic(slot) {
    return (slot?.metricDefinitions || []).find(definition => REP_TARGET_SEMANTICS.has(definition.semantic))?.semantic || null;
  }
  function repRange(target) {
    const range = Number.isSafeInteger(target) ? { min: target, max: target }
      : target && typeof target === "object" ? { min: target.min, max: target.max } : null;
    return range && Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) &&
      range.min >= 1 && range.max >= range.min && range.max <= 30 ? range : null;
  }
  function validRir(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 6;
  }
  function uniformRir(slot) {
    const values = slotSets(slot).map(set => set.rir);
    return values.length && values.every(value => validRir(value) && value === values[0]) ? values[0] : null;
  }
  function executionModeRequired(slot, policy) {
    return !!policy?.executionModeQuestion?.(slot) && !EXECUTION_MODES.has(slot?.executionMode);
  }
  /**
   * The first input a pending slot still needs, or null when it can be
   * confirmed. The opt-in asks for one RIR for the slot: sets that disagree
   * leave its field empty, so they need the lifter's answer too.
   */
  function suggestLoadsIssue(slot, policy) {
    if (!slot || policy?.eligibility?.(slot) !== "eligible") return "eligibility";
    const semantic = slotRepSemantic(slot), sets = slotSets(slot);
    if (!semantic || !sets.length || sets.some(set => !repRange(set.targets?.[semantic]))) return "range";
    if (uniformRir(slot) == null) return "rir";
    if (executionModeRequired(slot, policy)) return "execution_mode";
    return null;
  }
  function suggestLoadsIssues(document, policy) {
    return pendingSuggestLoads(document).flatMap(slotId => {
      const slot = definitionSlot(document, slotId);
      const field = slot ? suggestLoadsIssue(slot, policy) : null;
      return field ? [{ slotId, field }] : [];
    });
  }
  /** Confirms every pending opt-in, or refuses the whole document. */
  function confirmSuggestLoads(input, policy) {
    const document = clone(input);
    const issues = suggestLoadsIssues(document, policy);
    if (issues.length) return { ok: false, issues };
    const confirmed = [];
    for (const slotId of pendingSuggestLoads(document)) {
      const slot = definitionSlot(document, slotId);
      if (!slot) continue;
      for (const set of slotSets(slot)) {
        set.status = "ready";
        set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: ADAPTIVE_POLICY_VERSION };
      }
      const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
      if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
      confirmed.push(slotId);
    }
    if (document.programMeta) setPendingSuggestLoads(document, []);
    return { ok: true, document, confirmed };
  }
  function setSuggestLoads(document, slotId, on) {
    const slot = definitionSlot(document, slotId);
    if (!slot) return false;
    const pending = pendingSuggestLoads(document).filter(id => id !== slotId);
    if (on) {
      if (!slotAdaptive(slot)) pending.push(slotId);
    } else {
      // Off restores manual and keeps every value the lifter typed.
      for (const set of slotSets(slot)) {
        set.status = "manual";
        set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
      }
      const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
      if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    }
    setPendingSuggestLoads(document, pending);
    return true;
  }
  function setSlotRir(document, slotId, rir) {
    const slot = definitionSlot(document, slotId);
    if (!slot) return false;
    for (const set of slotSets(slot)) set.rir = rir;
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    if (row && row.prescriptionsByCycle) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
    return true;
  }

  function ensureStructure(document) {
    if (!document.programMeta || typeof document.programMeta !== "object") document.programMeta = {};
    const current = metaDays(document);
    if (!current.length) {
      document.programMeta.programStructure = {
        ...(document.programMeta.programStructure || {}),
        days: labels(document).map((label, index) => ({ dayId: `manual_d${index + 1}`, label, order: index + 1 })),
      };
    }
    return document;
  }
  function setDayLabel(document, oldLabel, nextLabel) {
    const value = String(nextLabel || "").trim();
    if (!value || value === oldLabel || labels(document).includes(value)) return false;
    for (const exercise of document.program || []) if (exercise.day === oldLabel) exercise.day = value;
    const structure = metaDays(document);
    const entry = structure.find(item => String(item?.label || item?.dayId || "") === oldLabel);
    if (entry) {
      entry.label = value;
      entry.nameOverride = value;
    } else {
      document.programMeta.programStructure = {
        ...(document.programMeta.programStructure || {}),
        days: structure.concat({ dayId: `manual_d${structure.length + 1}`, label: value, order: structure.length + 1 }),
      };
    }
    normalizeOrders(document);
    return true;
  }
  function appendDay(document) {
    const current = labels(document);
    let n = current.length + 1, label = `Day ${n}`;
    while (current.includes(label)) label = `Day ${++n}`;
    const structure = metaDays(document).slice();
    structure.push({ dayId: `manual_d${structure.length + 1}`, label, order: structure.length + 1 });
    document.programMeta.programStructure = { ...(document.programMeta.programStructure || {}), days: structure };
    return label;
  }
  function removeDayFromDocument(document, day) {
    document.program = (document.program || []).filter(exercise => exercise.day !== day);
    const structure = metaDays(document).filter(entry => String(entry?.label || entry?.dayId || "") !== day);
    document.programMeta.programStructure = structure.length
      ? { ...(document.programMeta.programStructure || {}), days: structure }
      : null;
    normalizeOrders(document);
  }
  /* Plan 074 S2: the training days' order is programStructure's order. A move
     reorders that list; the host puts the definition's days in the same order. */
  function moveDayInDocument(document, day, toIndex) {
    const structure = metaDays(document).slice();
    const from = structure.findIndex(entry => String(entry?.label || entry?.dayId || "") === day);
    if (from < 0 || !Number.isInteger(toIndex) || toIndex < 0 || toIndex >= structure.length || toIndex === from) return null;
    const before = structure.map(entry => String(entry?.label || entry?.dayId || ""));
    const [moved] = structure.splice(from, 1);
    structure.splice(toIndex, 0, moved);
    document.programMeta.programStructure = {
      ...(document.programMeta.programStructure || {}),
      days: structure.map((entry, index) => ({ ...entry, order: index + 1 })),
    };
    return { before, after: structure.map(entry => String(entry?.label || entry?.dayId || "")), fromIndex: from, toIndex };
  }
  /** The definition's days with its training days in `after`'s order, each in a position a training day
      already holds; rest days stay put and every day is renumbered. Null unless `after` names each
      training day exactly once. */
  function reorderTrainingDays(definition, after) {
    const days = Array.isArray(definition?.days) ? definition.days : [];
    const training = days.filter(day => day?.kind === "training");
    if (!Array.isArray(after) || after.length !== training.length) return null;
    const wanted = after.map(String), byName = new Map(training.map(day => [String(day.name), day]));
    if (byName.size !== training.length || new Set(wanted).size !== wanted.length || wanted.some(name => !byName.has(name))) return null;
    let next = 0;
    return days.map(day => (day?.kind === "training" ? byName.get(wanted[next++]) : day)).map((day, index) => ({ ...day, order: index + 1 }));
  }
  /** Why a day_move made against `edit.before` cannot apply over the training days now named `current`. */
  function dayOrderConflict(current, edit) {
    const now = (Array.isArray(current) ? current : []).map(String);
    const before = Array.isArray(edit?.before) ? edit.before.map(String) : null, after = Array.isArray(edit?.after) ? edit.after.map(String) : null;
    if (!before || !after || JSON.stringify(before) !== JSON.stringify(now)) return "day_order_changed";
    if (after.length !== now.length || new Set(after).size !== after.length || after.some(name => !now.includes(name))) return "invalid_day_order";
    return null;
  }
  function fieldValue(exercise, field, value) {
    if (field === "sets") return Math.max(1, Math.min(100, positiveInt(value, positiveInt(exercise.sets, 1))));
    if (field === "min") return positiveInt(value, positiveInt(exercise.min, 1));
    if (field === "max") return positiveInt(value, positiveInt(exercise.max, 1));
    return String(value ?? "").trim();
  }
  function entryFields(entry, day, order) {
    return {
      id: uid(), day, order, name: String(entry?.name || entry?.namePt || "Exercise"),
      sets: positiveInt(entry?.sets, 3), min: positiveInt(entry?.min, 6), max: positiveInt(entry?.max, 10),
      primary: String(entry?.primary || ""), secondary: String(entry?.secondary || ""), notes: String(entry?.notes || ""),
      ...(entry?.id ? { libraryId: String(entry.id), movementId: `library:${String(entry.id)}` } : {}),
    };
  }
  function addExercise(document, day, entry) {
    const list = exercisesFor(document, day), exercise = entryFields(entry, day, list.length + 1);
    document.program = (document.program || []).concat(exercise);
    return exercise;
  }
  function replaceExercise(document, id, entry) {
    const exercise = (document.program || []).find(item => item.id === id);
    if (!exercise || !entry) return false;
    const old = { id: exercise.id, day: exercise.day, order: exercise.order, notes: exercise.notes };
    const replacement = entryFields(entry, old.day, old.order);
    // A replacement repoints the slot's movement identity but keeps its
    // authored prescription and notes. Leaving the old movementId behind
    // would make a paired-exposure relation look valid after a swap.
    delete exercise.libraryId; delete exercise.movementId; delete exercise.displayName;
    Object.assign(exercise, {
      name: replacement.name, primary: replacement.primary, secondary: replacement.secondary,
      ...(replacement.libraryId ? { libraryId: replacement.libraryId, movementId: replacement.movementId } : {}),
      notes: old.notes,
    });
    return true;
  }
  function reorder(document, id, toDay, toIndex) {
    const rows = document.program || [], exercise = rows.find(item => item.id === id);
    if (!exercise || !labels(document).includes(toDay)) return false;
    const sourceDay = exercise.day, source = exercisesFor(document, sourceDay), sourceIndex = source.findIndex(item => item.id === id);
    if (sourceIndex < 0) return false;
    const destination = exercisesFor(document, toDay).filter(item => item.id !== id);
    const at = Math.max(0, Math.min(Number.isInteger(toIndex) ? toIndex : destination.length, destination.length));
    exercise.day = toDay;
    destination.splice(at, 0, exercise);
    for (const item of rows) if (item.id !== id && item.day === sourceDay && !destination.includes(item)) item.order = 0;
    destination.forEach((item, index) => { item.day = toDay; item.order = index + 1; });
    normalizeOrders(document);
    return sourceDay !== toDay || sourceIndex !== at;
  }

  function validation(document) {
    const issues = [];
    for (const day of labels(document)) {
      const list = exercisesFor(document, day);
      if (!list.length) issues.push(`day_empty:${day}`);
      for (const exercise of list) {
        if (!exercise.id) issues.push("exercise_invalid:id");
        if (!String(exercise.name || "").trim()) issues.push(`exercise_invalid:${exercise.id}:name`);
        const sets = number(exercise.sets), min = number(exercise.min), max = number(exercise.max);
        // A metric composition without repetitions (duration, distance, or a
        // custom movement not yet configured) carries no rep range to check.
        const reps = exercise.hasRepTarget !== false;
        if (!(sets > 0) || reps && (!(min > 0) || !(max >= min))) issues.push(`exercise_invalid:${exercise.id}:prescription`);
      }
    }
    return issues;
  }

  function mountProgramEditor(host, adapter) {
    if (!host || !adapter || typeof adapter.read !== "function" || typeof adapter.commit !== "function")
      throw new TypeError("mountProgramEditor(host, adapter) requires read and commit");
    const initial = adapter.read() || {};
    let document = clone(initial.document || initial.nextDocument || initial);
    let token = clone(initial.token);
    // Older snapshots may not have a structure section yet. Materialize it
    // before taking the baseline; otherwise mounting an untouched editor would
    // incorrectly make the document dirty.
    ensureStructure(document);
    let baseDocument = clone(document);
    let edits = [];
    let expandedExercises = new Set();
    let expandedMetricCycles = new Set();
    let initializedMetricCycleSlots = new Set();
    let collapsedDays = new Set();
    let collapsedDaysInitialized = false;
    let destroyed = false;
    let undoMove = null;
    let reorderMode = false;
    let settleMoveId = null;
    let settleTimer = null;
    let pendingFocus = null;
    let renderQueued = false;
    let statusTimer = null;
    const reviewLayout = adapter.layout === "review";

    host.classList.add("program-editor-host");
    host.dataset.editorMounted = "true";
    host.dataset.editorRole = "program-editor";

    const rootElement = () => host;
    const label = (key, vars, fallback) => t(adapter, I18N_KEYS[key] || key, vars, fallback ?? FALLBACK[key]);
    // The review layout redraws its status line with every render, so it keeps the message to draw.
    let reviewStatus = null;
    const setStatus = (message, { error = false, undo = false } = {}) => {
      if (reviewLayout) reviewStatus = message && !undo ? { message, error } : null;
      const status = host.querySelector('[data-role="editor-status"]');
      if (!status) return;
      status.classList.toggle("is-error", error);
      status.innerHTML = message
        ? `${esc(message)}${undo ? ` <button type="button" class="program-editor__undo" data-role="undo-move">${esc(label("undo"))}</button>` : ""}`
        : "";
      // The status line is written outside the render, so the undo it offers has
      // to be wired here. Waiting for the next render to bind it left the
      // control live only if something else happened to redraw the editor.
      status.querySelector('[data-role="undo-move"]')?.addEventListener("click", undoLastMove);
      status.hidden = !message;
      if (statusTimer) clearTimeout(statusTimer);
      if (message && !undo) statusTimer = setTimeout(() => { reviewStatus = null; if (status.isConnected) status.hidden = true; }, 2600);
    };
    const context = () => {
      try { return adapter.context?.(document) || ""; } catch { return ""; }
    };
    const titleFor = (day, index) => dayDisplay(adapter, document, day, index);
    const changed = () => !equal(document, baseDocument);
    const intent = (kind, detail = {}) => {
      if (!INTENT_SET.has(kind)) throw new TypeError(`Unknown program editor intent: ${kind}`);
      return Object.freeze({ kind, ...clone(detail) });
    };
    const scheduleRender = () => {
      if (renderQueued || destroyed) return;
      renderQueued = true;
      Promise.resolve().then(() => { renderQueued = false; if (!destroyed) render(); });
    };
    const stage = (next, edit, { redraw = true } = {}) => {
      // The host's returned document redraws the list a second time; the focus
      // the caller asked for has to land on that final DOM, not the first one.
      const focusRequest = pendingFocus;
      document = normalizeOrders(clone(next));
      edits.push(intent(edit.kind, edit));
      if (redraw) scheduleRender();
      let result;
      try {
        result = adapter.commit({ expectedToken: clone(token), nextDocument: clone(document), intent: intent(edit.kind, edit) });
      } catch (error) {
        setStatus(error?.message || label("invalid"), { error: true });
        return Promise.resolve({ ok: false, error });
      }
      return Promise.resolve(result).then(value => {
        const returnedDocument = value?.document?.document || value?.document?.nextDocument || value?.document;
        if (value?.ok !== false && returnedDocument?.program && returnedDocument?.programMeta) {
          document = clone(returnedDocument);
          ensureStructure(document);
          if (redraw) {
            if (!pendingFocus && focusRequest) pendingFocus = focusRequest;
            scheduleRender();
          }
        }
        if (value?.token !== undefined && value?.staged !== false) token = clone(value.token);
        if (value?.ok === false || value?.localOk === false && value?.staged !== true && value?.setupDraft !== true) {
          setStatus(value?.message || label("invalid"), { error: true });
        }
        return value;
      }, error => { setStatus(error?.message || label("invalid"), { error: true }); return { ok: false, error }; });
    };
    const setExerciseField = (id, field, value, { redraw = true, cycleIndex: requestedCycle } = {}) => {
      const next = clone(document), exercise = next.program?.find(item => item.id === id);
      if (!exercise) return Promise.resolve({ ok: false });
      const requestedIndex = Number(requestedCycle);
      const cycleIndex = Number.isInteger(requestedIndex) && requestedIndex > 0
        ? requestedIndex : metricCycleIndex(adapter, document);
      const slot = field === "sets" ? definitionSlot(next, exercise.slotId || exercise.id) : null;
      const cycle = slot ? definitionCycle(slot, cycleIndex) : null;
      const previous = field === "sets" && cycle ? cycle.sets.length : exercise[field];
      const normalized = fieldValue(exercise, field, value);
      if (equal(previous, normalized)) return Promise.resolve({ ok: true, unchanged: true });
      if (field === "sets" && cycle) {
        const beforeSetIds = cycle.sets.map(set => set.id), addedSets = [], removedSetIds = [];
        // A set added to an adaptive slot joins it (Plan 069 D3): the opt-in
        // covers every set, so the new one takes the slot's RIR and status.
        const adaptive = slotAdaptive(slot);
        while (cycle.sets.length < normalized) {
          const source = cycle.sets.at(-1);
          if (!source) return Promise.resolve({ ok: false });
          const added = adaptive
            ? { ...clone(source), id: uid(), cycleIndex, setIndex: cycle.sets.length + 1 }
            : { ...clone(source), id: uid(), cycleIndex, setIndex: cycle.sets.length + 1,
              rir: null, status: slot.metricIds?.length ? "manual" : "configuration_required",
              provenance: { source: "manual", policyVersion: "manual@1" } };
          cycle.sets.push(added);
          addedSets.push(clone(added));
        }
        while (cycle.sets.length > normalized) removedSetIds.push(cycle.sets.pop().id);
        cycle.sets.forEach((set, index) => { set.setIndex = index + 1; });
        exercise.sets = normalized;
        exercise.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
        return stage(next, { kind: "prescription", targetId: id, field: "sets", before: previous, after: normalized,
          cycleIndex, beforeSetIds, addedSets, removedSetIds }, { redraw });
      }
      if (field === "min" && normalized > number(exercise.max)) exercise.max = normalized;
      if (field === "max" && normalized < number(exercise.min)) exercise.min = normalized;
      exercise[field] = normalized;
      // Linked movements keep their stable library identity while allowing a
      // program-specific display alias. The persisted model resolves `name`
      // from `displayName`, so carry the alias explicitly in the complete
      // document sent to the host.
      if (field === "name" && exercise.libraryId) {
        if (normalized) exercise.displayName = normalized;
        else delete exercise.displayName;
      }
      return stage(next, { kind: field === "sets" || field === "min" || field === "max" ? "prescription" : "exercise_field", targetId: id, field, before: previous, after: normalized }, { redraw });
    };
    const toggleExercise = id => { expandedExercises.has(id) ? expandedExercises.delete(id) : expandedExercises.add(id); scheduleRender(); };
    const toggleDay = day => { collapsedDays.has(day) ? collapsedDays.delete(day) : collapsedDays.add(day); scheduleRender(); };
    const chooseExercise = request => {
      try { return Promise.resolve(adapter.chooseExercise?.(request)); }
      catch (error) { setStatus(error?.message || label("invalid"), { error: true }); return Promise.resolve(null); }
    };
    /* A commit that rebuilds the list leaves nothing focused: the row that changed (or, after a remove, the day's
       Add control) takes focus once the rebuild has drawn, and the change is announced once through the host. */
    // A change that shows its own toast with Undo is announced by that toast alone.
    let quietChange = false;
    const announceChange = key => { if (quietChange) return; try { adapter.announce?.(label(key), { change: true }); } catch { /* the focus move still says it */ } };
    const applyPendingFocus = () => {
      const want = pendingFocus; pendingFocus = null;
      if (!want) return;
      const find = selector => host.querySelector(selector) || (reviewLayout ? sheetParts()?.el?.querySelector(selector) : null);
      const target = want.selector ? find(want.selector) : want.id
        ? (want.roles || ["toggle-exercise", "exercise-row"]).map(role => find(`[data-role="${role}"][data-id="${cssEscape(want.id)}"]`)).find(Boolean)
        : find(`[data-role="add-exercise"][data-day="${cssEscape(want.day)}"]`);
      try { target?.focus(); } catch { /* a control that cannot take focus is left alone */ }
    };
    // The picker that returned the choice is still open when the list redraws, and everything behind it is inert:
    // the host says when it has closed, and focus lands then.
    const schedulePendingFocus = () => {
      if (!pendingFocus) return;
      const run = () => { if (!destroyed) applyPendingFocus(); };
      if (typeof adapter.afterModal === "function") adapter.afterModal(run); else run();
    };
    const pickForAdd = day => chooseExercise({ mode: "add", day, exclude: exercisesFor(document, day).map(item => item.libraryId).filter(Boolean) });
    const addForDay = day => pickForAdd(day).then(entry => entry ? stageAdd(day, entry) : null);
    const stageAdd = (day, entry) => {
      const next = clone(document), exercise = addExercise(next, day, entry);
      collapsedDays.delete(day); expandedExercises.add(exercise.id);
      pendingFocus = { id: exercise.id };
      return stage(next, { kind: "exercise_add", targetDay: day, targetId: exercise.id, libraryId: entry.id, exercise: exercise }).then(value => {
        if (value?.ok !== false) announceChange("exerciseAdded");
        return value;
      });
    };
    const pickReplacement = (id, { repair = false } = {}) => {
      const current = document.program?.find(item => item.id === id);
      if (!current) return Promise.resolve(null);
      return chooseExercise({ mode: "replace", day: current.day, exercise: clone(current), repair, exclude: exercisesFor(document, current.day).filter(item => item.id !== id).map(item => item.libraryId).filter(Boolean) });
    };
    const replaceForExercise = (id, options) => pickReplacement(id, options).then(choice => stageReplacement(id, choice));
    const stageReplacement = (id, choice) => {
      const current = document.program?.find(item => item.id === id);
      if (!current) return Promise.resolve(null);
      if (!choice) return Promise.resolve(null);
      const handoff = choice?.entry ? choice : { entry: choice, stagedCustomDefinition: null };
      const entry = handoff.entry;
      if (!entry) return Promise.resolve(null);
      const next = clone(document), customExercise = handoff.stagedCustomDefinition ? clone(handoff.stagedCustomDefinition) : null;
      if (customExercise && customExercise.id !== entry.id) return Promise.resolve(null);
      if (customExercise) {
        const customExercises = Array.isArray(next.customExercises) ? next.customExercises : [];
        const existing = customExercises.find(item => item?.id === customExercise.id);
        if (!existing) next.customExercises = customExercises.concat(customExercise);
      }
      if (!replaceExercise(next, id, entry)) return Promise.resolve(null);
      const replacement = next.program?.find(item => item.id === id);
      pendingFocus = { id, roles: ["replace", "toggle-exercise", "exercise-row"] };
      return stage(next, { kind: "exercise_replace", targetId: id, beforeLibraryId: current.libraryId, afterLibraryId: entry.id, exercise: replacement, ...(customExercise ? { customExercise } : {}) }).then(value => {
        if (value?.ok !== false) announceChange("exerciseChanged");
        return value;
      });
    };
    const removeExercise = id => {
      const exercise = document.program?.find(item => item.id === id);
      if (!exercise) return Promise.resolve(null);
      const next = clone(document); next.program = (next.program || []).filter(item => item.id !== id); normalizeOrders(next);
      pendingFocus = { day: exercise.day };
      return stage(next, { kind: "exercise_remove", targetId: id, sourceDay: exercise.day }).then(value => {
        if (value?.ok !== false) announceChange("exerciseRemoved");
        return value;
      });
    };
    /* A slot's alternates live on its canonical slot, so only a definition-backed
       exercise offers them. The list is replaced whole: before/after let the host
       rebase it onto a head another tab has moved on. */
    const setAlternates = (id, alternates, focus) => {
      const exercise = document.program?.find(item => item.id === id);
      const slotId = exercise?.slotId || exercise?.id, next = clone(document), slot = definitionSlot(next, slotId);
      if (!slot) return Promise.resolve({ ok: false });
      const before = clone(slot.alternates || []), after = alternates.map(String);
      if (equal(before, after)) return Promise.resolve({ ok: true, unchanged: true });
      if (after.length) slot.alternates = after; else delete slot.alternates;
      pendingFocus = focus;
      return stage(next, { kind: "slot_alternates", targetId: id, slotId, before, after });
    };
    const pickAlternate = id => {
      const exercise = document.program?.find(item => item.id === id), slot = definitionSlot(document, exercise?.slotId || exercise?.id);
      if (!slot || (slot.alternates || []).length >= maxAlternates()) return Promise.resolve(null);
      return chooseExercise({ mode: "alternate", day: exercise.day, exercise: clone(exercise),
        exclude: [slot.exerciseId, ...(slot.alternates || [])] });
    };
    const addAlternate = id => pickAlternate(id).then(choice => stageAlternate(id, choice));
    const stageAlternate = (id, choice) => {
      const exercise = document.program?.find(item => item.id === id), slot = definitionSlot(document, exercise?.slotId || exercise?.id);
      if (!slot) return Promise.resolve(null);
      const entry = choice?.entry || choice;
      if (!entry?.id) return null;
      const current = definitionSlot(document, slot.id)?.alternates || [];
      if (entry.id === slot.exerciseId || current.includes(entry.id) || current.length >= maxAlternates()) return null;
      return setAlternates(id, [...current, entry.id], { selector: `[data-role="alternate-remove"][data-id="${cssEscape(id)}"][data-exercise-id="${cssEscape(entry.id)}"]` });
    };
    const editAlternate = (id, exerciseId, role) => {
      const exercise = document.program?.find(item => item.id === id), slot = definitionSlot(document, exercise?.slotId || exercise?.id);
      const list = clone(slot?.alternates || []), index = list.indexOf(exerciseId);
      if (index < 0) return Promise.resolve(null);
      if (role === "alternate-remove") {
        list.splice(index, 1);
        const neighbour = list[Math.min(index, list.length - 1)];
        return setAlternates(id, list, { selector: neighbour
          ? `[data-role="alternate-remove"][data-id="${cssEscape(id)}"][data-exercise-id="${cssEscape(neighbour)}"]`
          : `[data-role="add-alternate"][data-id="${cssEscape(id)}"]` });
      }
      const to = index + (role === "alternate-up" ? -1 : 1);
      if (to < 0 || to >= list.length) return Promise.resolve(null);
      list.splice(to, 0, list.splice(index, 1)[0]);
      // Focus stays on the control that moved, or on its opposite once the row hits an end.
      const edge = to === 0 || to === list.length - 1;
      const keep = edge ? (role === "alternate-up" ? "alternate-down" : "alternate-up") : role;
      return setAlternates(id, list, { selector: `[data-role="${keep}"][data-id="${cssEscape(id)}"][data-exercise-id="${cssEscape(exerciseId)}"]` });
    };
    const renameDay = (oldDay, value) => {
      const next = clone(document), wanted = String(value || "").trim();
      // Another day can store a different name yet show this one (a translated generated name).
      const shown = labels(document).some((day, index) => day !== oldDay && dayDisplay(adapter, document, day, index) === wanted);
      if (!wanted || wanted === oldDay) return Promise.resolve({ ok: false, refused: true });
      if (shown || !setDayLabel(next, oldDay, value)) return Promise.resolve({ ok: false, refused: true, duplicate: true });
      if (collapsedDays.delete(oldDay)) collapsedDays.add(String(value).trim());
      return stage(next, { kind: "day_name", targetDay: oldDay, before: oldDay, after: String(value).trim() });
    };
    const removeDay = day => {
      const next = clone(document); removeDayFromDocument(next, day);
      return stage(next, { kind: "day_remove", targetDay: day });
    };
    const moveExercise = (id, toDay, toIndex, { announce = true, settle = true } = {}) => {
      const before = clone(document), exercise = before.program?.find(item => item.id === id);
      if (!exercise) return Promise.resolve({ ok: false });
      const sourceDay = exercise.day, sourceIndex = exercisesFor(before, sourceDay).findIndex(item => item.id === id);
      const next = clone(before);
      if (!reorder(next, id, toDay, toIndex)) return Promise.resolve({ ok: false, cancelled: true });
      undoMove = { before, id, sourceDay, sourceIndex, targetDay: toDay, targetIndex: toIndex };
      const beforeRects = new Map([...host.querySelectorAll('[data-role="exercise"][data-id]')]
        .map(row => [row.dataset.id, row.getBoundingClientRect()]));
      settleMoveId = id;
      const result = stage(next, { kind: "exercise_move", targetId: id, sourceDay, sourceIndex, targetDay: toDay, targetIndex: toIndex });
      Promise.resolve(result).then(value => {
        if (value?.ok === false && value?.staged !== true && value?.setupDraft !== true) {
          settleMoveId = null;
          return;
        }
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => { settleMoveId = null; }, 220);
        // A drag has already been animated by the drag library, row for row.
        // Only a move with no gesture behind it — Move up, Move down, Move to
        // another day, Undo — has a jump left to cover.
        if (!settle || reducedMotion(adapter)) return;
        const frame = root.requestAnimationFrame || (callback => setTimeout(callback, 0));
        frame(() => {
          const rows = [...host.querySelectorAll('[data-role="exercise"][data-id]')];
          // A spring per row, retargeted rather than restarted. Nudging a row up
          // three times used to replay one keyframe from zero on each tap, so the
          // second and third moves flickered; a spring picks each row up from
          // wherever it currently is, at whatever speed it is already moving.
          if (root.RepForgeMotion?.animateExerciseReorder(rows, beforeRects)) return;
          for (const row of rows) {
            const beforeRect = beforeRects.get(row.dataset.id);
            if (!beforeRect) continue;
            const delta = beforeRect.top - row.getBoundingClientRect().top;
            if (Math.abs(delta) < 1) continue;
            row.style.setProperty("--program-editor-flip-y", `${delta}px`);
            row.classList.remove("is-reordered");
            void row.offsetWidth;
            row.classList.add("is-reordered");
            row.addEventListener("animationend", () => {
              row.classList.remove("is-reordered");
              row.style.removeProperty("--program-editor-flip-y");
            }, { once: true });
          }
        });
      });
      if (announce) result.then(value => {
        if (value?.ok !== false && (value?.localOk !== false || value?.staged === true || value?.setupDraft === true)) {
          setStatus(label("moved"), { undo: true });
          try { adapter.announce?.(`${label("moved")} · ${label("undo")}`, { undo: () => undoLastMove() }); } catch { /* inline undo remains */ }
        }
      });
      return result;
    };
    const undoLastMove = () => {
      if (!undoMove) return Promise.resolve({ ok: false });
      const previous = undoMove.before, move = undoMove;
      undoMove = null;
      return stage(previous, { kind: "exercise_move", targetId: move.id, sourceDay: move.targetDay, sourceIndex: move.targetIndex, targetDay: move.sourceDay, targetIndex: move.sourceIndex }).then(result => {
        if (result?.ok !== false) setStatus("");
        return result;
      });
    };
    const apply = ({ kind = "apply" } = {}) => {
      if (!INTENT_SET.has(kind) || (kind !== "apply" && kind !== "apply_discard_workout"))
        return Promise.resolve({ ok: false, invalidIntent: true });
      // A name typed in the rename sheet and not yet saved is part of what Apply applies (#445).
      if (reviewLayout && (pendingRename() || heldRename)) return flushPendingRename().then(saved => saved === false
        ? { ok: false, invalid: true, renameRefused: true } : apply({ kind }));
      if (!edits.length && !changed()) return Promise.resolve({ ok: true, unchanged: true, document: clone(document), token: clone(token) });
      const issues = validation(document);
      if (issues.length) {
        setStatus(label("invalid"), { error: true });
        return Promise.resolve({ ok: false, invalid: true, issues });
      }
      const optIn = checkSuggestLoads();
      if (!optIn.ok) return Promise.resolve(optIn);
      const result = adapter.commit({ expectedToken: clone(token), nextDocument: clone(document), intent: intent(kind, { edits: clone(edits) }) });
      return Promise.resolve(result).then(value => {
        if (value?.ok === false || value?.conflict || value?.staleRevision) return value;
        baseDocument = clone(document); edits = []; undoMove = null; undoStack = [];
        if (value?.token !== undefined) token = clone(value.token);
        return value;
      });
    };
    const discard = () => {
      const latest = adapter.read() || {};
      document = clone(latest.document || latest.nextDocument || latest); token = clone(latest.token);
      baseDocument = clone(document); edits = []; undoMove = null; undoStack = []; heldRename = null; expandedExercises.clear(); expandedMetricCycles.clear(); initializedMetricCycleSlots.clear(); collapsedDays.clear(); collapsedDaysInitialized = false;
      scheduleRender();
      return document;
    };
    const refresh = () => {
      const latest = adapter.read() || {};
      const latestDocument = clone(latest.document || latest.nextDocument || latest);
      if (!edits.length && !changed()) {
        document = latestDocument; token = clone(latest.token); baseDocument = clone(document); scheduleRender();
        return { refreshed: true, dirty: false };
      }
      if (!equal(latestDocument, baseDocument)) {
        setStatus(label("invalid"), { error: true });
        host.dataset.editorConflict = "true";
        return { refreshed: false, dirty: true, conflict: true };
      }
      return { refreshed: false, dirty: true };
    };

    function summary(exercise) {
      const cycleIndex = metricCycleIndex(adapter, document);
      const sets = format(adapter, setCountFor(document, exercise, cycleIndex));
      const slot = definitionSlot(document, exercise.slotId || exercise.id);
      if (!slot) {
        const min = format(adapter, exercise.min), max = format(adapter, exercise.max);
        return `${sets} × ${min}${min === max ? "" : `–${max}`}`;
      }
      const definitions = exerciseMetricDefinitions(adapter, slot);
      const repetition = definitions.find(metric => metric.semantic === "reps" || metric.semantic === "repsPerSide");
      if (!repetition) return `${sets} ${label("sets").toLocaleLowerCase()}`;
      const cycle = definitionCycle(slot, cycleIndex);
      const targets = (cycle?.sets || []).map(set => set.targets?.[repetition.semantic]);
      if (!targets.length || targets.some(target => target == null) || targets.some(target => !equal(target, targets[0])))
        return `${sets} ${label("sets").toLocaleLowerCase()}`;
      const target = formatMetricValue(adapter, repetition, targets[0]);
      return `${sets} × ${target} ${metricLabel(adapter, repetition).toLocaleLowerCase()}`;
    }
    function updateExerciseSummary(id) {
      const exercise = document.program?.find(item => item.id === id);
      const node = host.querySelector(`[data-role="exercise"][data-id="${cssEscape(id)}"] [data-role="exercise-summary"]`);
      if (exercise && node) node.textContent = summary(exercise);
    }
    function dayCount(count) {
      const value = adapter?.dayCount ? adapter.dayCount(count) : label("dayCount", { n: count, word: count === 1 ? "exercise" : "exercises" });
      return value;
    }
    function metricInputMarkup(exercise, slot, cycle, set, definition, target) {
      const slotId = slot.id, cycleIndex = cycle.cycleIndex, setIndex = set.setIndex;
      const labelValue = metricLabel(adapter, definition), unit = metricDisplayUnit(adapter, definition);
      const reps = definition.semantic === "reps" || definition.semantic === "repsPerSide";
      const range = reps || !!target && typeof target === "object" && Number.isFinite(target.min) && Number.isFinite(target.max);
      const rangeMin = target && typeof target === "object" ? target.min : target;
      const rangeMax = target && typeof target === "object" ? target.max : target;
      const input = (bound, value, labelKey) => `<label class="program-editor__metric-field"><span>${esc(labelValue)}${unit ? ` <small>${esc(unit)}</small>` : ""}</span><input type="text" inputmode="${reps ? "numeric" : "decimal"}" autocomplete="off" data-role="metric-target" data-id="${esc(exercise.id)}" data-slot-id="${esc(slotId)}" data-cycle-index="${cycleIndex}" data-set-index="${setIndex}" data-metric-id="${esc(definition.id)}" data-semantic="${esc(definition.semantic)}" data-bound="${bound}" value="${value == null ? "" : esc(formatMetricValue(adapter, definition, value))}" aria-label="${esc(label(labelKey, { cycle: label("metricCycle", { n: cycleIndex }), set: label("metricSet", { n: setIndex }), metric: labelValue }))}"></label>`;
      if (range) return `<fieldset class="program-editor__metric-range"><legend>${esc(labelValue)}${unit ? ` (${esc(unit)})` : ""}</legend>${input("min", rangeMin, "metricTargetMinAria")}${input("max", rangeMax, "metricTargetMaxAria")}</fieldset>`;
      return input("value", target, "metricTargetAria");
    }
    function compositionText(metricIds, options) {
      const byId = new Map(options.map(definition => [definition.id, definition]));
      return metricIds.map(id => byId.get(id)).filter(Boolean).map(definition => metricLabel(adapter, definition)).join(" + ");
    }
    function prescriptionFieldMarkup(exercise, slot, cycle, set, field) {
      const rir = field === "rir", fieldLabel = label(rir ? "metricRir" : "metricRestSeconds");
      const unit = rir ? "" : "s", value = set[field];
      const cycleTitle = label("metricCycle", { n: cycle.cycleIndex }), setTitle = label("metricSet", { n: set.setIndex });
      return `<label class="program-editor__metric-field program-editor__prescription-field"><span>${esc(fieldLabel)}${unit ? ` <small>${esc(unit)}</small>` : ""}</span><input type="number" inputmode="decimal" min="0" max="${rir ? "6" : "86400"}" step="${rir ? "any" : "1"}" data-role="prescription-field" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" data-cycle-index="${cycle.cycleIndex}" data-set-index="${set.setIndex}" data-field="${field}" value="${value == null ? "" : esc(String(value))}" aria-label="${esc(label("prescriptionFieldAria", { cycle: cycleTitle, set: setTitle, field: fieldLabel }))}"></label>`;
    }
    function renderMetricComposition(exercise, slot) {
      const currentIds = Array.isArray(slot.metricIds) ? slot.metricIds : [];
      const options = metricOptions(adapter);
      if (!editableMetricComposition(slot)) {
        return `<p class="program-editor__metric-composition" data-role="metric-composition-summary"><span>${esc(label("metricComposition"))}</span> ${esc(compositionText(currentIds, options))}</p>`;
      }
      const choices = [], seen = new Set();
      for (const candidate of metricCompositions(adapter)) {
        if (!Array.isArray(candidate)) continue;
        const ids = candidate.map(String);
        const key = JSON.stringify(ids);
        if (seen.has(key)) continue;
        seen.add(key);
        choices.push(ids);
      }
      if (!seen.has("[]")) choices.unshift([]);
      return `<label class="program-editor__metric-composition"><span>${esc(label("metricComposition"))}</span><select data-role="metric-composition" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" aria-label="${esc(label("metricComposition"))}">${choices.map(ids => {
        const key = JSON.stringify(ids), name = ids.length ? compositionText(ids, options) : label("metricUnconfigured");
        return `<option value="${esc(key)}"${equal(ids, currentIds) ? " selected" : ""}>${esc(name || label("metricUnconfigured"))}</option>`;
      }).join("")}</select></label>`;
    }
    function renderMetricTargets(exercise) {
      const slot = definitionSlot(document, exercise.slotId || exercise.id);
      if (!slot) return "";
      const definitions = exerciseMetricDefinitions(adapter, slot);
      const activeCycle = metricCycleIndex(adapter, document);
      if (!initializedMetricCycleSlots.has(slot.id)) {
        expandedMetricCycles.add(`${slot.id}:${activeCycle}`);
        initializedMetricCycleSlots.add(slot.id);
      }
      const cycles = (slot.prescriptionsByCycle || []).slice().sort((a, b) => a.cycleIndex - b.cycleIndex);
      const contents = cycles.map(cycle => `<details class="program-editor__metric-cycle" data-role="metric-cycle" data-cycle-index="${cycle.cycleIndex}"${expandedMetricCycles.has(`${slot.id}:${cycle.cycleIndex}`) ? " open" : ""}>
        <summary>${esc(label("metricCycle", { n: cycle.cycleIndex }))}</summary>
        ${(cycle.sets || []).map(set => `<fieldset class="program-editor__metric-set"><legend>${esc(label("metricSet", { n: set.setIndex }))}</legend>
          ${definitions.length ? "" : `<p class="program-editor__metric-unconfigured">${esc(label("metricUnconfigured"))}</p>`}
          ${(slot.metricIds || []).map(metricId => {
            const definition = definitions.find(candidate => candidate.id === metricId);
            return definition ? metricInputMarkup(exercise, slot, cycle, set, definition, set.targets?.[definition.semantic]) : "";
          }).join("")}
          <div class="program-editor__metric-prescription-fields">${prescriptionFieldMarkup(exercise, slot, cycle, set, "rir")}${prescriptionFieldMarkup(exercise, slot, cycle, set, "restSeconds")}</div>
        </fieldset>`).join("")}
      </details>`).join("");
      return `<section class="program-editor__metric-targets" data-role="metric-targets" data-slot-id="${esc(slot.id)}">
        <h4>${esc(label("metricTargets"))}</h4>
        ${renderMetricComposition(exercise, slot)}
        ${contents}
      </section>`;
    }
    function targetState(slotId, cycleIndex, setIndex, semantic) {
      const set = definitionSet(document, slotId, cycleIndex, setIndex);
      return set && hasOwn(set.targets, semantic)
        ? { present: true, value: clone(set.targets[semantic]) }
        : { present: false, value: null };
    }
    function editMetricTarget(input) {
      const slotId = input.dataset.slotId, cycleIndex = Number(input.dataset.cycleIndex);
      const setIndex = Number(input.dataset.setIndex), metricId = input.dataset.metricId;
      const semantic = input.dataset.semantic, slot = definitionSlot(document, slotId);
      const definition = slot?.metricDefinitions?.find(item => item.id === metricId);
      const set = definitionSet(document, slotId, cycleIndex, setIndex);
      if (!slot || !definition || !set || !(slot.metricIds || []).includes(metricId)) return;
      const peers = [...host.querySelectorAll('[data-role="metric-target"]')].filter(candidate =>
        candidate.dataset.slotId === slotId && candidate.dataset.cycleIndex === String(cycleIndex) &&
        candidate.dataset.setIndex === String(setIndex) && candidate.dataset.metricId === metricId);
      const ranged = peers.some(candidate => candidate.dataset.bound === "min" || candidate.dataset.bound === "max");
      const raw = Object.fromEntries(peers.map(candidate => [candidate.dataset.bound, candidate.value.trim()]));
      let after;
      if (ranged) {
        const minRaw = raw.min || "", maxRaw = raw.max || "";
        if (!minRaw && !maxRaw) after = { present: false, value: null };
        else if (!minRaw || !maxRaw) {
          setStatus(label("invalid"), { error: true });
          return;
        } else {
          const min = parseMetricInput(adapter, definition, minRaw), max = parseMetricInput(adapter, definition, maxRaw);
          if (!hasOwn(min, "value") || !hasOwn(max, "value") || min.value == null || max.value == null || max.value < min.value) {
            const issue = !hasOwn(min, "value") ? min : !hasOwn(max, "value") ? max : null;
            setStatus(issue?.key ? label(issue.key) : label("invalid"), { error: true });
            return;
          }
          after = { present: true, value: { min: min.value, max: max.value } };
        }
      } else if (!raw.value) after = { present: false, value: null };
      else {
        const parsed = parseMetricInput(adapter, definition, raw.value);
        if (!hasOwn(parsed, "value") || parsed.value == null) {
          setStatus(parsed?.key ? label(parsed.key) : label("invalid"), { error: true });
          return;
        }
        after = { present: true, value: parsed.value };
      }
      const before = targetState(slotId, cycleIndex, setIndex, semantic);
      if (equal(before, after)) return;
      if (set.status === "ready" && REP_TARGET_SEMANTICS.has(semantic) && !repRange(after.value)) {
        setStatus(label("invalid"), { error: true });
        return;
      }
      const next = clone(document);
      if (!replaceMetricTarget(next, slotId, cycleIndex, setIndex, semantic, after)) return;
      const result = stage(next, {
        kind: "metric_target", slotId, cycleIndex, setIndex, metricId, semantic,
        metricIds: clone(slot.metricIds || []), metricDefinitions: clone(slot.metricDefinitions || []),
        before, after,
      }, { redraw: false });
      updateExerciseSummary(input.dataset.id);
      return Promise.resolve(result).then(value => { updateExerciseSummary(input.dataset.id); return value; });
    }
    // The lifter's smallest load change per movement owns the adaptive engine's
    // candidate loads. Only hosts that persist it offer the field.
    const LOAD_SEMANTICS = new Set(["loadKg", "assistanceKg", "loadPerSideKg", "persistentLoadPerSideKg"]);
    function slotLoadMetric(slot) {
      return (slot?.metricDefinitions || []).find(definition => LOAD_SEMANTICS.has(definition.semantic)) || null;
    }
    function renderLoadStep(exercise, slot) {
      const loadMetric = slotLoadMetric(slot);
      if (!loadMetric || typeof adapter.defaultLoadStepKg !== "function") return "";
      const own = document.programMeta?.loadingConfiguration?.byExerciseId?.[slot.exerciseId]?.loadStepKg;
      const value = Number.isFinite(own) ? own : adapter.defaultLoadStepKg();
      const unit = metricDisplayUnit(adapter, loadMetric);
      return `<label class="program-editor__metric-field program-editor__load-step"><span>${esc(label("loadStep"))}${unit ? ` <small>${esc(unit)}</small>` : ""}</span>` +
        `<input type="text" inputmode="decimal" autocomplete="off" data-role="load-step" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" value="${esc(formatMetricValue(adapter, loadMetric, value))}"></label>` +
        `<p class="program-editor__hint">${esc(label("loadStepHint"))}</p>`;
    }
    function editLoadStep(input) {
      const slot = definitionSlot(document, input.dataset.slotId), loadMetric = slotLoadMetric(slot);
      if (!slot || !loadMetric) return;
      const raw = input.value.trim();
      let after = null;
      if (raw) {
        const parsed = parseMetricInput(adapter, loadMetric, raw);
        after = hasOwn(parsed || {}, "value") ? parsed.value : NaN;
        if (!Number.isFinite(after) || after <= 0 || after > 100) {
          setStatus(label("invalid"), { error: true });
          return;
        }
      }
      const before = document.programMeta?.loadingConfiguration?.byExerciseId?.[slot.exerciseId]?.loadStepKg ?? null;
      if (Object.is(before, after)) return;
      const next = clone(document);
      next.programMeta = next.programMeta || {};
      const byExerciseId = { ...(next.programMeta.loadingConfiguration?.byExerciseId || {}) };
      if (after == null) delete byExerciseId[slot.exerciseId];
      else byExerciseId[slot.exerciseId] = { loadStepKg: after };
      next.programMeta.loadingConfiguration = { ...(next.programMeta.loadingConfiguration || {}), byExerciseId };
      return stage(next, { kind: "load_step", exerciseId: slot.exerciseId, before, after }, { redraw: false });
    }
    // Plan 069 S4. Only a host that supplies the eligibility policy offers the
    // switch; the others keep the load step where it always was.
    function renderSuggestLoads(exercise, slot) {
      const policy = adapter.suggestLoads;
      if (!policy || !slot) return renderLoadStep(exercise, slot);
      const eligibility = policy.eligibility?.(slot);
      if (eligibility === "custom" || eligibility === "unsupported") {
        return `<p class="program-editor__hint program-editor__suggest-loads-note" data-role="suggest-loads-note">${esc(label(eligibility === "custom" ? "suggestLoadsCustom" : "suggestLoadsUnsupported"))}</p>` +
          renderLoadStep(exercise, slot);
      }
      if (eligibility !== "eligible") return renderLoadStep(exercise, slot);
      const on = slotAdaptive(slot) || pendingSuggestLoads(document).includes(slot.id);
      const semantic = slotRepSemantic(slot);
      const activeCycle = definitionCycle(slot, metricCycleIndex(adapter, document)) || slot.prescriptionsByCycle?.[0];
      const range = repRange(activeCycle?.sets?.[0]?.targets?.[semantic]);
      const rangeMissing = slotSets(slot).some(set => !repRange(set.targets?.[semantic]));
      const labelId = `program-editor-suggest-${esc(slot.id)}`;
      const toggle = `<div class="program-editor__suggest-loads-row"><span class="program-editor__field-label" id="${labelId}">${esc(label("suggestLoads"))}</span>` +
        `<button type="button" class="toggle" role="switch" aria-checked="${on ? "true" : "false"}" aria-labelledby="${labelId}" data-role="suggest-loads" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}"${!on && rangeMissing ? " disabled" : ""}></button></div>`;
      if (!on) return `<section class="program-editor__suggest-loads" data-role="suggest-loads-section" data-slot-id="${esc(slot.id)}">${toggle}</section>` +
        renderLoadStep(exercise, slot);
      const rir = uniformRir(slot);
      const question = policy.executionModeQuestion?.(slot);
      const modeLabelId = `program-editor-mode-${esc(slot.id)}`;
      const mode = question ? `<div class="program-editor__execution-mode" role="radiogroup" aria-labelledby="${modeLabelId}" data-role="execution-mode-group" data-slot-id="${esc(slot.id)}">` +
        `<span class="program-editor__field-label" id="${modeLabelId}">${esc(label("executionModeQuestion"))}</span>` +
        [["bilateral", "executionModeBilateral"], ["unilateral", "executionModeUnilateral"]].map(([value, key]) =>
          `<button type="button" role="radio" class="radio-card${slot.executionMode === value ? " is-selected" : ""}" aria-checked="${slot.executionMode === value ? "true" : "false"}" data-role="execution-mode" data-mode="${value}" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}"><span class="radio-card__body"><span class="radio-card__title">${esc(label(key))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`).join("") +
        `</div>` : "";
      return `<section class="program-editor__suggest-loads is-on" data-role="suggest-loads-section" data-slot-id="${esc(slot.id)}">${toggle}` +
        (range ? `<p class="program-editor__suggest-loads-range" data-role="suggest-loads-range">${esc(label("suggestLoadsRange", { min: format(adapter, range.min), max: format(adapter, range.max) }))}</p>` : "") +
        `<label class="program-editor__metric-field"><span>${esc(label("metricRir"))}</span><input type="number" inputmode="decimal" min="0" max="6" step="any" required data-role="suggest-loads-rir" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" value="${rir == null ? "" : esc(String(rir))}"></label>` +
        renderLoadStep(exercise, slot) + mode + `</section>`;
    }
    function toggleSuggestLoads(button) {
      const slotId = button.dataset.slotId, slot = definitionSlot(document, slotId);
      if (!slot) return;
      const on = button.getAttribute("aria-checked") !== "true";
      const before = { exerciseId: slot.exerciseId,
        state: slotAdaptive(slot) ? "ready" : pendingSuggestLoads(document).includes(slotId) ? "pending" : "off" };
      const next = clone(document);
      if (!setSuggestLoads(next, slotId, on)) return;
      pendingFocus = { selector: `[data-role="suggest-loads"][data-slot-id="${cssEscape(slotId)}"]` };
      return stage(next, { kind: "suggest_loads", slotId, on, before });
    }
    function editSuggestLoadsRir(input) {
      const slotId = input.dataset.slotId, slot = definitionSlot(document, slotId);
      if (!slot) return;
      setFieldError(input, null);
      const raw = input.value.trim(), after = raw ? Number(raw) : null;
      if (after != null && !validRir(after)) {
        setFieldError(input, label("invalid"));
        return;
      }
      if (after == null && slotAdaptive(slot)) {
        const kept = uniformRir(slot);
        input.value = kept == null ? "" : String(kept);
        setFieldError(input, label("invalid"));
        return;
      }
      const before = slotSets(slot).map(set => set.rir ?? null);
      if (before.every(value => Object.is(value, after))) return;
      const next = clone(document);
      if (!setSlotRir(next, slotId, after)) return;
      return stage(next, { kind: "suggest_loads_rir", slotId, before, after }, { redraw: false });
    }
    function editExecutionMode(button) {
      const slotId = button.dataset.slotId, slot = definitionSlot(document, slotId), after = button.dataset.mode;
      if (!slot || !EXECUTION_MODES.has(after) || slot.executionMode === after) return;
      const before = EXECUTION_MODES.has(slot.executionMode) ? slot.executionMode : null;
      const next = clone(document);
      definitionSlot(next, slotId).executionMode = after;
      pendingFocus = { selector: `[data-role="execution-mode"][data-slot-id="${cssEscape(slotId)}"][data-mode="${after}"]` };
      return stage(next, { kind: "execution_mode", slotId, before, after });
    }
    /** The field carries its own error: aria-invalid and an alert linked by aria-describedby. */
    function setFieldError(input, message) {
      const current = input.getAttribute("aria-describedby");
      if (current) input.ownerDocument.getElementById(current)?.remove();
      input.removeAttribute("aria-describedby");
      input.removeAttribute("aria-invalid");
      if (!message) return;
      const note = input.ownerDocument.createElement("p");
      note.id = `program-editor-field-error-${uid()}`;
      note.className = "program-editor__field-error";
      note.setAttribute("role", "alert");
      note.textContent = message;
      (input.closest(".program-editor-a__line, label, [role=radiogroup]") || input).after(note);
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", note.id);
    }
    /**
     * A commit point's check. An incomplete opt-in opens its exercise, puts
     * the error on the first field it still needs and refuses the commit.
     */
    function checkSuggestLoads() {
      const issue = suggestLoadsIssues(document, adapter.suggestLoads)[0];
      if (!issue) return { ok: true };
      const exercise = (document.program || []).find(item => (item.slotId || item.id) === issue.slotId);
      if (exercise) {
        expandedExercises.add(exercise.id);
        const day = exercise.day;
        if (collapsedDays.has(day)) collapsedDays.delete(day);
        if (reviewLayout) { view.tab = day; openSheetView({ kind: "exercise", id: exercise.id }); }
      }
      render();
      const selector = issue.field === "execution_mode"
        ? `[data-role="execution-mode"][data-slot-id="${cssEscape(issue.slotId)}"]`
        : issue.field === "rir" ? `[data-role="${reviewLayout ? "suggest-loads-rir-step" : "suggest-loads-rir"}"][data-slot-id="${cssEscape(issue.slotId)}"]`
          : `[data-role="suggest-loads"][data-slot-id="${cssEscape(issue.slotId)}"]`;
      const field = host.querySelector(selector) || (reviewLayout ? sheetParts()?.el?.querySelector(selector) : null);
      if (field) {
        setFieldError(field, label("invalid"));
        try { field.focus(); } catch { /* detached */ }
      }
      return { ok: false, invalid: true, suggestLoads: issue };
    }
    function editPrescriptionField(input) {
      const slotId = input.dataset.slotId, cycleIndex = Number(input.dataset.cycleIndex);
      const setIndex = Number(input.dataset.setIndex), field = input.dataset.field;
      if (field !== "rir" && field !== "restSeconds") return;
      const currentSet = definitionSet(document, slotId, cycleIndex, setIndex);
      const slot = definitionSlot(document, slotId);
      if (!currentSet || !slot) return;
      const raw = input.value.trim();
      let after = null;
      if (raw) {
        after = Number(raw);
        const valid = field === "rir"
          ? Number.isFinite(after) && after >= 0 && after <= 6
          : Number.isSafeInteger(after) && after >= 0 && after <= 86400;
        if (!valid) {
          setStatus(label("invalid"), { error: true });
          return;
        }
      }
      const before = currentSet[field] == null ? null : currentSet[field];
      if (Object.is(before, after)) return;
      // Plan 069 D3: an adaptive set keeps adapting through an RIR edit, and
      // cannot lose the RIR its suggestion needs.
      const keepsAdaptive = field === "rir" && currentSet.status === "ready";
      if (keepsAdaptive && after == null) {
        input.value = String(before);
        setStatus(label("invalid"), { error: true });
        return;
      }
      const next = clone(document), set = definitionSet(next, slotId, cycleIndex, setIndex);
      if (!set) return;
      set[field] = after;
      if (!keepsAdaptive) {
        set.status = "manual";
        set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
      }
      const row = (next.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
      if (row) row.prescriptionsByCycle = clone(definitionSlot(next, slotId).prescriptionsByCycle || []);
      const result = stage(next, { kind: "prescription_field", slotId, cycleIndex, setIndex, field, before, after }, { redraw: false });
      updateExerciseSummary(input.dataset.id);
      return Promise.resolve(result).then(value => { updateExerciseSummary(input.dataset.id); return value; });
    }
    function editMetricComposition(select) {
      const slotId = select.dataset.slotId, exerciseId = select.dataset.id;
      const exercise = document.program?.find(item => item.id === exerciseId);
      const slot = definitionSlot(document, slotId);
      if (!exercise || !editableMetricComposition(slot)) return;
      let metricIds;
      try { metricIds = JSON.parse(select.value); } catch { return; }
      if (!Array.isArray(metricIds) || !metricCompositions(adapter).some(candidate => equal(candidate, metricIds))) {
        setStatus(label("invalid"), { error: true });
        return;
      }
      const byId = new Map(metricOptions(adapter).map(definition => [definition.id, definition]));
      const definitions = metricIds.map(id => byId.get(id)).filter(Boolean).map(clone);
      if (definitions.length !== metricIds.length) {
        setStatus(label("invalid"), { error: true });
        return;
      }
      const beforeMetricIds = clone(slot.metricIds || []), beforeMetricDefinitions = clone(slot.metricDefinitions || []);
      if (equal(beforeMetricIds, metricIds) && equal(beforeMetricDefinitions, definitions)) return;
      const next = clone(document), nextExercise = next.program?.find(item => item.id === exerciseId);
      if (!replaceMetricComposition(next, nextExercise, metricIds, definitions)) return;
      pendingFocus = { selector: `[data-role="metric-composition"][data-id="${cssEscape(exerciseId)}"][data-slot-id="${cssEscape(slotId)}"]` };
      return stage(next, {
        kind: "metric_composition", slotId,
        beforeMetricIds, beforeMetricDefinitions,
        metricIds: clone(metricIds), metricDefinitions: clone(definitions),
      });
    }
    function renderAlternates(exercise, slot) {
      if (!slot) return "";
      const list = Array.isArray(slot.alternates) ? slot.alternates : [];
      const items = list.map((id, index) => {
        const name = movementLabel(adapter, id), attrs = `data-id="${esc(exercise.id)}" data-exercise-id="${esc(id)}"`;
        return `<li class="program-editor__alternate" data-role="alternate" data-exercise-id="${esc(id)}">
          <span class="program-editor__alternate-name" data-role="alternate-name">${esc(name)}</span>
          <button type="button" class="program-editor__alternate-move" data-role="alternate-up" ${attrs} aria-label="${esc(label("alternateUp", { name }))}"${index === 0 ? " disabled" : ""}><span class="icon-mask icon-mask--chev-up" aria-hidden="true"></span></button>
          <button type="button" class="program-editor__alternate-move" data-role="alternate-down" ${attrs} aria-label="${esc(label("alternateDown", { name }))}"${index === list.length - 1 ? " disabled" : ""}><span class="icon-mask icon-mask--chev-down" aria-hidden="true"></span></button>
          <button type="button" class="program-editor__alternate-remove" data-role="alternate-remove" data-action-role="removal" ${attrs} aria-label="${esc(label("alternateRemove", { name }))}"><span class="icon-mask icon-mask--close" aria-hidden="true"></span></button>
        </li>`;
      }).join("");
      const full = list.length >= maxAlternates();
      return `<section class="program-editor__alternates" data-role="alternates" data-id="${esc(exercise.id)}" aria-labelledby="alternates-${esc(exercise.id)}">
          <span class="program-editor__field-label" id="alternates-${esc(exercise.id)}">${esc(label("alternates"))}</span>
          ${items ? `<ol class="program-editor__alternate-list">${items}</ol>` : ""}
          <button type="button" class="program-editor__add-alternate" data-role="add-alternate" data-id="${esc(exercise.id)}"${full ? " disabled" : ""}><span aria-hidden="true">＋</span> ${esc(label("addAlternate"))}</button>
          <p class="program-editor__hint">${esc(label("alternatesHint"))}</p>
        </section>`;
    }
    function renderExercise(exercise, index, count, day) {
      const open = expandedExercises.has(exercise.id);
      const linked = exerciseEntry(adapter, exercise.libraryId);
      const name = exerciseName(adapter, exercise);
      const shownName = exerciseDisplayLabel(adapter, exercise);
      const slot = definitionSlot(document, exercise.slotId || exercise.id);
      const legacyMetrics = exerciseMetricDefinitions(adapter, exercise);
      const hasLegacyRepMetric = legacyMetrics.some(metric => metric.semantic === "reps" || metric.semantic === "repsPerSide");
      const legacyRepControls = !slot && (!exercise.metricIds?.length || hasLegacyRepMetric)
        ? `<div class="program-editor__rep-rule" aria-hidden="true"></div>
          <fieldset class="program-editor__range"><legend>${esc(label("repRange"))}</legend>
            <label><span>${esc(label("min"))}</span><input type="number" inputmode="numeric" min="1" step="1" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="min" value="${esc(exercise.min)}"></label>
            <label><span>${esc(label("max"))}</span><input type="number" inputmode="numeric" min="1" step="1" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="max" value="${esc(exercise.max)}"></label>
          </fieldset>` : "";
      const activeCycle = metricCycleIndex(adapter, document);
      const currentSetCount = setCountFor(document, exercise, activeCycle);
      const details = open ? `<div class="program-editor__exercise-body pex__body">
          <div class="program-editor__sets" data-role="sets-control" aria-label="${esc(`${label("sets")} · ${label("metricCycle", { n: activeCycle })}`)}">
            <span class="program-editor__field-label">${esc(label("sets"))} · ${esc(label("metricCycle", { n: activeCycle }))}</span>
            <div class="program-editor__stepper">
              <button type="button" data-role="adjust" data-id="${esc(exercise.id)}" data-cycle-index="${activeCycle}" data-field="sets" data-delta="-1" aria-label="${esc(label("setsDecrease"))}"${currentSetCount <= 1 ? " disabled" : ""}>−</button>
              <output data-role="sets-value">${esc(format(adapter, currentSetCount))}</output>
              <button type="button" data-role="adjust" data-id="${esc(exercise.id)}" data-cycle-index="${activeCycle}" data-field="sets" data-delta="1" aria-label="${esc(label("setsIncrease"))}"${currentSetCount >= 100 ? " disabled" : ""}>+</button>
            </div>
          </div>
          ${legacyRepControls}
          ${renderMetricTargets(exercise)}
          ${renderSuggestLoads(exercise, slot)}
          ${renderAlternates(exercise, slot)}
          <div class="program-editor__exercise-actions">
            <button type="button" class="program-editor__replace" data-role="replace" data-action-role="replacement" data-id="${esc(exercise.id)}">${esc(label("replaceExercise"))}</button>
            <button type="button" class="program-editor__remove" data-role="remove-exercise" data-action-role="removal" data-id="${esc(exercise.id)}">${esc(label("removeExercise"))}</button>
          </div>
          <details class="program-editor__more" data-role="more-details" data-id="${esc(exercise.id)}">
            <summary>${esc(label("details"))}</summary>
            <label><span>${esc(label("notes"))}</span><input data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="notes" value="${esc(exercise.notes || "")}"></label>
            ${["primary", "secondary"].map(field => linked
              // A linked movement's muscles come from the catalog: shown read-only, and
              // allowed to wrap, since a full attribution can outrun one input line.
              ? `<label><span>${esc(label(field))}</span><textarea class="program-editor__muscles" rows="${Math.min(4, Math.max(1, Math.ceil(String(exercise[field] || "").length / 24)))}" readonly data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="${field}">${esc(exercise[field] || "")}</textarea></label>`
              : `<label><span>${esc(label(field))}</span><input data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="${field}" value="${esc(exercise[field] || "")}"></label>`).join("")}
          </details>
        </div>` : "";
      return `<article class="program-editor__exercise pex${open ? " is-expanded" : " is-collapsed"}${settleMoveId === exercise.id ? " is-settling" : ""}" data-role="exercise" data-id="${esc(exercise.id)}" data-day="${esc(day)}">
        <header class="program-editor__exercise-head pex__head">
          <textarea class="program-editor__exercise-name pex__name" rows="1" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="name" placeholder="${esc(label("namePlaceholder"))}" aria-label="${esc(name)}">${esc(name)}</textarea>
          <span class="program-editor__summary" data-role="exercise-summary">${esc(summary(exercise))}</span>
          <button type="button" class="program-editor__drag-handle" data-role="drag-handle" data-id="${esc(exercise.id)}" aria-label="${esc(label("move", undefined, `${label("moveUp")} ${shownName}`))}" title="${esc(label("move"))}">≡</button>
          <button type="button" class="program-editor__exercise-toggle" data-role="toggle-exercise" data-action-role="expansion" data-id="${esc(exercise.id)}" aria-expanded="${open ? "true" : "false"}" aria-label="${esc(label(open ? "collapseExercise" : "expandExercise", { name: shownName }))}"><span class="icon-mask icon-mask--chev-${open ? "up" : "down"}" aria-hidden="true"></span></button>
          <button type="button" class="program-editor__exercise-menu" data-role="exercise-menu" data-action-role="expansion" data-id="${esc(exercise.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label("more"))}">⋮</button>
        </header>${details}
        <div class="program-editor__menu" data-role="move-menu" data-id="${esc(exercise.id)}" hidden role="menu">
          <button type="button" role="menuitem" data-role="more-details" data-id="${esc(exercise.id)}">${esc(label("details"))}</button>
          <button type="button" role="menuitem" data-role="move-up" data-id="${esc(exercise.id)}">${esc(label("moveUp"))}</button>
          <button type="button" role="menuitem" data-role="move-down" data-id="${esc(exercise.id)}">${esc(label("moveDown"))}</button>
          <button type="button" role="menuitem" data-role="move-other" data-id="${esc(exercise.id)}">${esc(label("moveOther"))}</button>
          <div data-role="move-days" hidden>${labels(document).filter(target => target !== day).map(target => `<button type="button" role="menuitem" data-role="move-to-day" data-id="${esc(exercise.id)}" data-day="${esc(target)}">${esc(titleFor(target, labels(document).indexOf(target)))}</button>`).join("")}</div>
        </div>
      </article>`;
    }
    function renderDay(day, index) {
      const list = exercisesFor(document, day), open = !collapsedDays.has(day);
      // Hosts choose the grouping that fits their surrounding chrome. The
      // onboarding draft keeps Add exercise inside each day card; the
      // installed editor puts it between cards so the next day remains a
      // distinct, scannable section. The editor itself stays unaware of the
      // host's route or persistence mode.
      const addOutside = adapter?.dayAddPlacement?.(document, day) === "outside";
      const addButton = `<button type="button" class="program-editor__add pday__add" data-role="add-exercise" data-day="${esc(day)}"><span aria-hidden="true">＋</span> ${esc(label("addExercise"))}</button>`;
      return `<section class="program-editor__day pday${open ? " is-expanded" : " is-collapsed"}" data-role="day" data-day="${esc(day)}">
        <header class="program-editor__day-head pday__head" data-role="day-header">
          <input class="program-editor__day-name pday__name" data-role="day-name" data-day="${esc(day)}" value="${esc(titleFor(day, index))}" aria-label="${esc(label("dayName"))}">
          <span class="program-editor__day-count pday__count">${esc(dayCount(list.length))}</span>
          <button type="button" class="program-editor__day-menu" data-role="day-menu" data-action-role="expansion" data-day="${esc(day)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label("more"))}">⋮</button>
          <button type="button" class="program-editor__day-toggle pday__caret" data-role="toggle-day" data-action-role="expansion" data-day="${esc(day)}" aria-expanded="${open ? "true" : "false"}" aria-label="${esc(label(open ? "collapseDay" : "expandDay", { day: titleFor(day, index) }))}"><span class="icon-mask icon-mask--chev-${open ? "up" : "down"}" aria-hidden="true"></span></button>
        </header>
        <div class="program-editor__day-menu-panel" data-role="day-menu-panel" data-day="${esc(day)}" hidden role="menu">
          <button type="button" role="menuitem" data-role="toggle-reorder">${esc(label("reorder", undefined, "Reorder exercises"))}</button>
          <button type="button" role="menuitem" data-role="remove-day" data-action-role="removal" data-day="${esc(day)}">${esc(label("removeDay", undefined, "Remove day"))}</button>
        </div>
        <div class="program-editor__day-body pexlist" data-role="day-body"${open ? "" : " hidden"}>
          ${list.map((exercise, itemIndex) => renderExercise(exercise, itemIndex, list.length, day)).join("") || `<p class="program-editor__empty pday__empty" data-role="day-empty">${esc(label("emptyDays"))}</p>`}
          ${addOutside ? "" : addButton}
        </div>
      </section>${addOutside && open ? addButton : ""}`;
    }
    /* A render can land while the lifter is mid-edit in a field that has not
       yet committed (blurred) — most often a delayed confirmation from an
       earlier structural change (adding a day/exercise, nudging the set
       count) that resolves only after the lifter has already tabbed on to
       type the next value. Rebuilding the list wholesale would otherwise
       throw away whatever is sitting, uncommitted, in that focused input.
       Capture it before the rebuild and restore it — value, caret, and focus
       — onto its rebuilt counterpart afterward. */
    function liveEditSnapshot(scope = host) {
      const active = host.ownerDocument?.activeElement;
      if (!scope || !active || !scope.contains(active)) return null;
      if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") return null;
      if (!active.dataset.role) return null;
      const parts = [];
      for (const attribute of active.attributes) {
        if (attribute.name.startsWith("data-")) parts.push(`[${attribute.name}="${cssEscape(attribute.value)}"]`);
      }
      if (!parts.length) return null;
      let selectionStart = null, selectionEnd = null;
      // type="number" inputs (the rir/restSeconds prescription fields) throw
      // on selection access in some engines; losing the caret position there
      // is a minor cosmetic cost next to losing the value itself.
      try { selectionStart = active.selectionStart; selectionEnd = active.selectionEnd; } catch { /* unsupported */ }
      const snapshot = { selector: parts.join(""), value: active.value, selectionStart, selectionEnd, committedDuringTeardown: false };
      // A genuinely dirty field (real typing) fires its own "change"
      // synchronously when the rebuild below tears its node out — the
      // engine commits it the ordinary way before this render call ever
      // reaches restoreLiveEdit. Listening for that here, on the node that
      // is about to be removed, is how restoreLiveEdit later knows not to
      // schedule a second commit for a value that already landed.
      active.addEventListener("change", () => { snapshot.committedDuringTeardown = true; }, { once: true });
      return snapshot;
    }
    /** The focused control in the editor, as a selector its redrawn twin answers to. */
    function focusSnapshot() {
      const active = host.ownerDocument?.activeElement;
      if (!active || !host.contains(active) || !active.dataset?.role) return null;
      return ["role", "id", "day", "delta", "bound", "setIndex"].filter(key => active.dataset[key] != null)
        .map(key => `[data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}="${cssEscape(active.dataset[key])}"]`).join("");
    }
    function restoreLiveEdit(snapshot, scope = host) {
      if (!snapshot || !scope) return false;
      const next = scope.querySelector(snapshot.selector);
      if (!next || (next.tagName !== "INPUT" && next.tagName !== "TEXTAREA")) return false;
      const renderedValue = next.value;
      next.value = snapshot.value;
      try { if (snapshot.selectionStart != null) next.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd); }
      catch { /* unsupported on this input type */ }
      next.focus();
      // Setting .value before focus() leaves the element's own dirty-value
      // tracking believing nothing changed from here, so a plain blur never
      // fires "change" for this restored value: the lifter would see it on
      // screen, but it would never reach the document. Every commit path
      // here is wired to "change" (editMetricTarget, editPrescriptionField,
      // renameDay, …), so finish the commit through that same path, on this
      // field's next exit — unless the snapshot above already saw the old
      // node commit this exact value during teardown, in which case doing
      // it again would be a duplicate write with the same value.
      if (snapshot.value !== renderedValue && !snapshot.committedDuringTeardown) {
        next.dataset.editorPendingCommit = "1";
        const clearPending = () => { delete next.dataset.editorPendingCommit; };
        next.addEventListener("change", clearPending, { once: true });
        next.addEventListener("focusout", () => {
          if (next.dataset.editorPendingCommit !== "1") return;
          clearPending();
          next.dispatchEvent(new Event("change", { bubbles: true }));
        }, { once: true });
      }
      return true;
    }
    function render() {
      if (destroyed) return;
      ensureStructure(document);
      if (reviewLayout) {
        const liveEdit = liveEditSnapshot();
        const focused = focusSnapshot();
        renderReview();
        if (restoreLiveEdit(liveEdit)) pendingFocus = null;
        else if (!pendingFocus && focused) {
          // A redraw replaces every control; the one that had focus keeps it.
          try { host.querySelector(focused)?.focus({ preventScroll: true }); } catch { /* not focusable */ }
        }
        schedulePendingFocus();
        return;
      }
      const liveEdit = liveEditSnapshot();
      const days = labels(document);
      if (!expandedExercises.size) {
        for (const day of days) {
          const first = exercisesFor(document, day)[0];
          if (first) expandedExercises.add(first.id);
        }
      }
      // An empty set is a meaningful user choice: all days are expanded. Keep
      // the initial compact layout behind its own flag instead of treating
      // that choice as an uninitialised editor on every redraw.
      if (!collapsedDaysInitialized) {
        days.slice(1).forEach(day => collapsedDays.add(day));
        collapsedDaysInitialized = true;
      }
      // The glyph is drawn here; a host string that already starts with a plus ("+ Add day") would double it.
      const addDayText = String(t(adapter, "program.add_day", undefined, "Add day")).replace(/^\s*[+＋]\s*/, "");
      host.innerHTML = `<div class="program-editor${reorderMode ? " is-reorder-mode" : ""}" data-role="editor" aria-label="${esc(t(adapter, "program.editor.aria", undefined, "Program editor"))}">
        <div class="program-editor__meta" data-role="meta">
          <label class="program-editor__program-name"><span>${esc(label("programName"))}</span><input data-role="program-name" value="${esc(document.programMeta?.name || "")}" placeholder="${esc(label("namePlaceholder"))}" maxlength="80" aria-label="${esc(label("programName"))}"></label>
          ${context() ? `<p class="program-editor__context" data-role="context">${esc(context())}</p>` : ""}
          <p class="program-editor__status" data-role="editor-status" role="status" aria-live="polite" tabindex="-1"${adapter.status?.(document) ? "" : " hidden"}>${esc(adapter.status?.(document) || "")}</p>
        </div>
        <div class="program-editor__days" data-role="days">${days.map((day, index) => renderDay(day, index)).join("") || `<p class="program-editor__empty">${esc(label("emptyDays"))}</p>`}</div>
        <button type="button" class="program-editor__add-day" data-role="add-day">＋ <span>${esc(addDayText)}</span></button>
      </div>`;
      bind();
      // Restoring an in-progress edit wins over a queued structural focus
      // request (e.g. refocusing the sets-adjust button): the lifter is
      // demonstrably already typing somewhere else by the time this landed.
      if (restoreLiveEdit(liveEdit)) pendingFocus = null;
      // A host that annotates the status line (an id other controls describe
      // themselves by, an error state) re-applies it to each fresh render.
      adapter.afterRender?.(host);
      schedulePendingFocus();
    }
    /** The field carries its own error: aria-invalid and an alert linked by aria-describedby, not a toast alone. */
    function setDayNameError(input, message) {
      const id = `program-editor-day-error-${uid()}`;
      const current = input.getAttribute("aria-describedby");
      if (current) input.ownerDocument.getElementById(current)?.remove();
      input.removeAttribute("aria-describedby");
      input.removeAttribute("aria-invalid");
      if (!message) return;
      const note = input.ownerDocument.createElement("p");
      note.id = id;
      note.className = "program-editor__field-error";
      note.setAttribute("role", "alert");
      note.textContent = message;
      (input.closest('[data-role="day-header"]') || input).after(note);
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", id);
    }
    function bind() {
      if (destroyed) return;
      host.querySelectorAll('[data-role="program-name"]').forEach(input => {
        input.addEventListener("change", () => {
          const before = document.programMeta?.name || "", value = String(input.value || "").trim();
          if (value === before) return;
          const next = clone(document); next.programMeta = { ...(next.programMeta || {}), name: value };
          stage(next, { kind: "program_name", before, after: value });
        });
      });
      host.querySelectorAll('[data-role="day-name"]').forEach(input => {
        input.addEventListener("change", () => {
          const day = input.dataset.day;
          setDayNameError(input, null);
          renameDay(day, input.value).then(result => {
            // A refused rename leaves the day as it was, so the field says so (#343).
            if (!result?.refused || !input.isConnected) return;
            input.value = titleFor(day, labels(document).indexOf(day));
            if (result.duplicate) setDayNameError(input, label("dayNameExists"));
          });
        });
        input.addEventListener("input", () => setDayNameError(input, null));
        input.addEventListener("keydown", event => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          input.blur();
        });
      });
      host.querySelectorAll('[data-role="exercise-field"]').forEach(input => {
        input.addEventListener("focus", () => { input.dataset.editorFocusValue = input.value; });
        const handler = () => {
          // The name wraps in a one-row textarea; it is still one line of text.
          const field = input.dataset.field, text = String(input.value || "");
          const raw = field === "name" ? text.replace(/\s*\n\s*/g, " ") : text;
          // A blank exercise name is useful while the lifter is editing, but
          // leaving the field blank is an abandoned rename. Restore the value
          // captured on focus instead of manufacturing the model's fallback.
          if (field === "name" && !raw.trim() && String(input.dataset.editorFocusValue || "").trim())
            input.value = input.dataset.editorFocusValue;
          else if (["name", "notes", "primary", "secondary"].includes(field)) input.value = raw.trim();
          return setExerciseField(input.dataset.id, field, input.value);
        };
        input.addEventListener("change", handler);
        // Enter commits a name the way it did when the name was a text input.
        if (input.dataset.field === "name") input.addEventListener("keydown", event => {
          if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); input.blur(); }
        });
        if (input.dataset.field === "name" || input.dataset.field === "notes") {
          input.addEventListener("input", () => setExerciseField(input.dataset.id, input.dataset.field, input.value, { redraw: false }));
          input.addEventListener("blur", handler);
        }
      });
      host.querySelectorAll('[data-role="metric-target"]').forEach(input => input.addEventListener("change", () => editMetricTarget(input)));
      host.querySelectorAll('[data-role="prescription-field"]').forEach(input => input.addEventListener("change", () => editPrescriptionField(input)));
      host.querySelectorAll('[data-role="load-step"]').forEach(input => input.addEventListener("change", () => editLoadStep(input)));
      host.querySelectorAll('[data-role="suggest-loads"]').forEach(button => button.addEventListener("click", () => toggleSuggestLoads(button)));
      host.querySelectorAll('[data-role="suggest-loads-rir"]').forEach(input => input.addEventListener("change", () => editSuggestLoadsRir(input)));
      host.querySelectorAll('[data-role="execution-mode"]').forEach(button => button.addEventListener("click", () => editExecutionMode(button)));
      host.querySelectorAll('[data-role="metric-composition"]').forEach(select => select.addEventListener("change", () => editMetricComposition(select)));
      host.querySelectorAll('[data-role="metric-cycle"]').forEach(details => details.addEventListener("toggle", () => {
        const slotId = details.closest('[data-role="metric-targets"]')?.dataset.slotId;
        const cycleIndex = Number(details.dataset.cycleIndex);
        if (!slotId || !Number.isInteger(cycleIndex)) return;
        initializedMetricCycleSlots.add(slotId);
        const key = `${slotId}:${cycleIndex}`;
        if (details.open) expandedMetricCycles.add(key); else expandedMetricCycles.delete(key);
      }));
      host.querySelectorAll('[data-role="toggle-day"]').forEach(button => button.addEventListener("click", () => toggleDay(button.dataset.day)));
      host.querySelectorAll('[data-role="day-menu"]').forEach(button => button.addEventListener("click", () => {
        const card = button.closest('[data-role="day"]'), menu = card?.querySelector('[data-role="day-menu-panel"]');
        if (!menu) return;
        const open = menu.hidden;
        host.querySelectorAll('[data-role="day-menu-panel"]').forEach(item => { item.hidden = true; });
        menu.hidden = !open;
        button.setAttribute("aria-expanded", open ? "true" : "false");
      }));
      host.querySelectorAll('[data-role="remove-day"]').forEach(button => button.addEventListener("click", () => {
        const day = button.dataset.day;
        const confirm = adapter.confirm;
        if (typeof confirm === "function" && !confirm({ kind: "day_remove", day })) return;
        removeDay(day);
      }));
      host.querySelectorAll('[data-role="toggle-reorder"]').forEach(button => button.addEventListener("click", () => {
        reorderMode = !reorderMode;
        host.querySelectorAll('[data-role="day-menu-panel"]').forEach(item => { item.hidden = true; });
        scheduleRender();
      }));
      host.querySelectorAll('[data-role="toggle-exercise"]').forEach(button => button.addEventListener("click", () => toggleExercise(button.dataset.id)));
      host.querySelectorAll('[data-role="add-exercise"]').forEach(button => button.addEventListener("click", () => addForDay(button.dataset.day)));
      host.querySelectorAll('[data-role="add-day"]').forEach(button => button.addEventListener("click", () => { const next = clone(document); const day = appendDay(next); collapsedDays.delete(day); stage(next, { kind: "day_add", targetDay: day, after: day }); }));
      host.querySelectorAll('[data-role="adjust"]').forEach(button => button.addEventListener("click", () => {
        const exercise = document.program?.find(item => item.id === button.dataset.id); if (!exercise) return;
        const cycleIndex = Number(button.dataset.cycleIndex) || metricCycleIndex(adapter, document);
        const current = button.dataset.field === "sets" ? setCountFor(document, exercise, cycleIndex) : number(exercise[button.dataset.field]);
        const delta = number(button.dataset.delta);
        if (button.dataset.field === "sets") pendingFocus = { selector: `[data-role="adjust"][data-id="${cssEscape(exercise.id)}"][data-cycle-index="${cycleIndex}"][data-delta="${delta}"]` };
        setExerciseField(exercise.id, button.dataset.field, current + delta, { cycleIndex });
      }));
      host.querySelectorAll('[data-role="replace"]').forEach(button => button.addEventListener("click", () => replaceForExercise(button.dataset.id)));
      host.querySelectorAll('[data-role="remove-exercise"]').forEach(button => button.addEventListener("click", () => removeExercise(button.dataset.id)));
      host.querySelectorAll('[data-role="add-alternate"]').forEach(button => button.addEventListener("click", () => addAlternate(button.dataset.id)));
      host.querySelectorAll('[data-role="alternate-up"],[data-role="alternate-down"],[data-role="alternate-remove"]').forEach(button =>
        button.addEventListener("click", () => editAlternate(button.dataset.id, button.dataset.exerciseId, button.dataset.role)));
      host.querySelectorAll('[data-role="exercise-menu"]').forEach(button => button.addEventListener("click", () => {
        const menu = host.querySelector(`[data-role="move-menu"][data-id="${cssEscape(button.dataset.id)}"]`); if (!menu) return;
        const open = menu.hidden; host.querySelectorAll('[data-role="move-menu"]').forEach(item => { item.hidden = true; });
        menu.hidden = !open; button.setAttribute("aria-expanded", open ? "true" : "false");
      }));
      host.querySelectorAll('[data-role="more-details"][role="menuitem"]').forEach(button => button.addEventListener("click", () => {
        const details = host.querySelector(`[data-role="more-details"][data-id="${cssEscape(button.dataset.id)}"]`);
        if (details?.tagName === "DETAILS") details.open = true;
        host.querySelectorAll('[data-role="move-menu"]').forEach(item => { item.hidden = true; });
      }));
      host.querySelectorAll('[data-role="move-up"],[data-role="move-down"]').forEach(button => button.addEventListener("click", () => {
        const ex = document.program?.find(item => item.id === button.dataset.id); if (!ex) return;
        const list = exercisesFor(document, ex.day), index = list.findIndex(item => item.id === ex.id), to = index + (button.dataset.role === "move-up" ? -1 : 1);
        if (to >= 0 && to < list.length) moveExercise(ex.id, ex.day, to);
      }));
      host.querySelectorAll('[data-role="move-other"]').forEach(button => button.addEventListener("click", () => {
        const menu = button.closest('[data-role="move-menu"]'), days = menu?.querySelector('[data-role="move-days"]'); if (days) days.hidden = !days.hidden;
      }));
      host.querySelectorAll('[data-role="move-to-day"]').forEach(button => button.addEventListener("click", () => {
        const target = exercisesFor(document, button.dataset.day).length;
        moveExercise(button.dataset.id, button.dataset.day, target);
      }));
      host.querySelectorAll('[data-role="undo-move"]').forEach(button => button.addEventListener("click", undoLastMove));
      // Every render replaces the rows, so the sortables are rebuilt against
      // the DOM that now exists rather than patched.
      mountSorting();
    }
    /* ============================================================
       Reordering — @dnd-kit/dom
       ------------------------------------------------------------
       The editor used to carry its own pointer-drag: a pickup timer, manual
       pointer capture, `elementFromPoint` on every move to find the row and day
       under the thumb, and hand-computed drop indices. It worked, but it was a
       drag-and-drop library written by hand, and the parts it did not have were
       the expensive ones — a keyboard drag, live-region announcements, and
       auto-scrolling a long day list while dragging near its edge.

       @dnd-kit/dom owns all of that now. What the editor keeps is what is
       actually about programs rather than about dragging: the 90ms pickup that
       tells a drag from a tap, the 450ms hold that opens a collapsed day, and
       the single `moveExercise` call that every path — drag, keyboard drag,
       Move up, Move down, Move to another day — goes through, so one document
       transaction, one announcement and one undo cover them all.

       The library is optional in the same sense the rest of the app's runtimes
       are: if it is missing, the handle simply does not drag, and every reorder
       remains reachable through the explicit Move controls in each row's menu,
       which are also the keyboard path this editor shipped with.
       ============================================================ */
    let sorting = null;

    /** Screen-reader copy for the drag, in the lifter's language.
     *  dnd-kit ships English defaults; a Portuguese install must not hear them. */
    function dragAnnouncements() {
      const place = operation => {
        const source = operation?.source;
        const sortable = source?.sortable || source;
        const day = String(sortable?.group ?? "");
        const item = document.program?.find(candidate => candidate.id === source?.id);
        const name = item ? exerciseDisplayLabel(adapter, item) : "";
        return { name, day: titleForDay(day), index: (sortable?.index ?? 0) + 1, count: exercisesFor(document, day).length };
      };
      const say = (key, operation) => label(key, place(operation));
      return {
        dragstart: ({ operation }) => say("dragPickedUp", operation),
        dragover: ({ operation }) => say("dragOver", operation),
        dragend: ({ operation, canceled }) =>
          canceled ? label("dragCancelled", { name: place(operation).name }) : say("dragDropped", operation),
      };
    }
    /** The day's display title, so an announcement names what the lifter sees. */
    function titleForDay(day) {
      const index = labels(document).indexOf(day);
      return index >= 0 ? titleFor(day, index) : day;
    }

    function teardownSorting() {
      const current = sorting;
      sorting = null;
      if (!current) return;
      clearTimeout(current.expandTimer);
      for (const sortable of current.sortables) { try { sortable.destroy(); } catch { /* already gone */ } }
      try { current.manager.destroy(); } catch { /* already gone */ }
    }

    function mountSorting() {
      teardownSorting();
      const Dnd = root.DndKit;
      if (destroyed) return;
      // The heavy @dnd-kit bundle is deferred past the document bootstrap, so
      // an editor rendered during boot can arrive before it. Ask the bootstrap
      // for it and mount against the rows that exist when it lands; the Move
      // controls carry reordering in the meantime, and on the far side of the
      // window `available()` is already true and nothing is scheduled.
      if (!Dnd) {
        const runtime = root.RepForgeDndRuntime;
        if (runtime && !runtime.available())
          runtime.load().then(() => { if (!destroyed && !sorting) mountSorting(); }, () => {});
        return;
      }
      const reduced = reducedMotion(adapter);
      // Reduced motion is a different interaction, not a faster one: the row
      // still follows the thumb, but nothing slides into place behind it and
      // nothing animates on the drop.
      const glide = reduced ? null : { duration: 200, easing: "cubic-bezier(.2,.7,.2,1)" };
      const manager = new Dnd.DragDropManager({
        plugins: defaults => defaults.map(plugin =>
          plugin === Dnd.Accessibility
            ? Dnd.Accessibility.configure({
                announcements: dragAnnouncements(),
                screenReaderInstructions: { draggable: label("dragInstructions") },
              })
            : plugin === Dnd.Feedback
              ? Dnd.Feedback.configure({
                  // The library's own feedback: a copy of the row is carried,
                  // and a placeholder holds the gap it came from. `feedback:
                  // "move"` looked closer to the old hand-rolled drag, but it
                  // takes the row out of the layout the sortable collision
                  // detection measures against, and no drop target is ever
                  // found. The stylesheet gives the copy and the gap the same
                  // language the old drag had instead.
                  dropAnimation: glide,
                  keyboardTransition: glide,
                })
              : plugin),
        sensors: defaults => defaults.map(sensor =>
          sensor === Dnd.PointerSensor
            ? Dnd.PointerSensor.configure({
                // A thumb on the handle waits out the same 90ms this editor has
                // always used to tell a drag from a tap, and gives the gesture
                // back if it travels more than 10px inside it — which is how a
                // page scroll that started on the handle escapes.
                //
                // A mouse on the handle does not wait at all. The library's own
                // default makes the same distinction, and it matters: with a
                // delay, a tolerance that cancels on movement would throw away
                // exactly the fast, deliberate drags a mouse is good at.
                activationConstraints: (event, source) =>
                  event.pointerType === "mouse" &&
                  (source.handle === event.target || source.handle?.contains(event.target))
                    ? undefined
                    : [new Dnd.PointerActivationConstraints.Delay({ value: 90, tolerance: 10 })],
              })
            : sensor),
      });

      const sortables = [];
      const sectionSelector = reviewLayout ? '[data-role="reorder-list"]' : '[data-role="day"]';
      const rowSelector = reviewLayout ? '[data-role="reorder-row"][data-id]' : '[data-role="exercise"][data-id]';
      for (const section of host.querySelectorAll(sectionSelector)) {
        const day = section.dataset.day;
        // The day itself accepts a drop, at lower priority than the rows inside
        // it, so an empty day and a collapsed one are both reachable.
        sortables.push(new Dnd.Droppable({
          id: `day:${day}`, type: "day", accept: ["exercise"],
          element: section, data: { day },
          collisionPriority: Dnd.CollisionPriority.Low,
        }, manager));
        [...section.querySelectorAll(rowSelector)].forEach((row, index) => {
          const handle = row.querySelector('[data-role="drag-handle"]');
          if (!handle) return;
          sortables.push(new Dnd.Sortable({
            id: row.dataset.id, index, group: day,
            type: "exercise", accept: ["exercise"],
            element: row, handle, data: { day },
            transition: glide,
          }, manager));
        });
      }

      sorting = { manager, sortables, expandTimer: null, overDay: null };

      // Holding a row over another day opens it, exactly as before. The library
      // reports what is under the pointer; the timing is the editor's.
      manager.monitor.addEventListener("dragover", event => {
        if (!sorting) return;
        const over = dayOf(event.operation?.target);
        if (over === sorting.overDay) return;
        clearTimeout(sorting.expandTimer);
        sorting.overDay = over;
        if (!over) return;
        sorting.expandTimer = setTimeout(() => {
          host.querySelector(`[data-role="day"][data-day="${cssEscape(over)}"]`)
            ?.classList.add("is-drag-target-expanded");
        }, 450);
      });

      manager.monitor.addEventListener("dragend", event => {
        if (sorting) { clearTimeout(sorting.expandTimer); sorting.overDay = null; }
        host.querySelectorAll(".is-drag-target-expanded").forEach(section => section.classList.remove("is-drag-target-expanded"));
        if (event.canceled || destroyed) return;
        const source = event.operation?.source;
        const sortable = source?.sortable || source;
        const id = source?.id;
        if (!id || !document.program?.some(item => item.id === id)) return;
        // Released between two rows, the sortable already knows its new day and
        // place. Released on a day itself — an empty one, or a collapsed one the
        // hold above just opened — it goes to that day's end, which is where
        // letting go over open space has always put it.
        const target = event.operation?.target;
        const onDay = dayOf(target);
        const droppedOnDay = target?.type === "day" && !!onDay;
        const day = droppedOnDay ? onDay : (sortable?.group != null ? String(sortable.group) : onDay);
        if (!day) return;
        const index = droppedOnDay || typeof sortable?.index !== "number"
          ? exercisesFor(document, day).filter(item => item.id !== id).length
          : sortable.index;
        const from = document.program.find(item => item.id === id);
        // dnd-kit has already put the row where it belongs. Re-running the same
        // position through the document would be a no-op transaction and an
        // announcement for a move that did not happen.
        if (from && from.day === day && exercisesFor(document, day).findIndex(item => item.id === id) === index) {
          scheduleRender();
          return;
        }
        // The library animated the drop, so the re-render must not animate it
        // a second time from where the row already is.
        if (reviewLayout) recorded(() => moveExercise(id, day, index, { settle: false, announce: false }));
        else moveExercise(id, day, index, { settle: false });
      });
    }
    /** The day a drop target belongs to, whether it is a row or the day itself. */
    function dayOf(target) {
      if (!target) return null;
      const data = target.data;
      if (data && typeof data.day === "string") return data.day;
      const element = target.element;
      return element?.closest?.('[data-role="day"]')?.dataset.day || null;
    }

    /* ============================================================
       Plan 074 (ADR 0021): the installed editor in onboarding B's
       editing language.
       ------------------------------------------------------------
       A host that asks for `layout: "review"` gets candidate A: day
       tabs, rows with one line per set, one sheet per exercise, a
       Weeks sheet for per-week values, a Loads block, the changes bar
       with Undo, and a pinned Apply. It draws with onboarding's review
       classes so the two screens read the same.

       The edit rules stay this module's. A sheet control that means
       "every week" stages one ordinary intent per week, so the host's
       canonical sync, rebase and workout checks see exactly what they
       see for the classic layout.
       ============================================================ */
    const view = { tab: null, sheet: null, reorderDay: null };
    let undoStack = [];
    let heldRename = null; // a typed name that Back set aside while the host asks about leaving
    let busy = 0;
    let reviewQueue = Promise.resolve();
    let toastEl = null, toastTimer = 0;
    const REST_PRESETS = Array.isArray(root?.RepForgeProgramReview?.REST_PRESETS)
      ? root.RepForgeProgramReview.REST_PRESETS : [60, 90, 120, 150, 180, 240];
    const MAX_REVIEW_RIR = 6, MAX_OPT_IN_RIR = 4, MAX_REVIEW_SETS = 100, MAX_REVIEW_REPS = 30;
    const SUGGESTED_SWAPS = 3;
    const rt = (key, vars, fallback) => t(adapter, key, vars, fallback);
    const nums = text => {
      try { if (typeof adapter.nums === "function") return adapter.nums(String(text)); } catch { /* plain text below */ }
      return esc(text);
    };
    const icon = name => `<span class="icon-mask icon-mask--${name} icon-mask--sm" aria-hidden="true"></span>`;
    const sheetParts = () => { try { return adapter.sheet?.() || null; } catch { return null; } };
    const tile = (id, size) => { try { return adapter.tile?.(id, size) || ""; } catch { return ""; } };
    const isDeloadCycle = (slot, cycle) => (cycle?.sets || []).some(set => set?.provenance?.deload === true) ||
      (definitionFor(document)?.deloadCycles || []).includes(cycle?.cycleIndex);
    const cyclesOf = slot => (slot?.prescriptionsByCycle || []).slice().sort((a, b) => a.cycleIndex - b.cycleIndex);
    const displayCycleIndex = () => metricCycleIndex(adapter, document);
    const displayCycle = slot => definitionCycle(slot, displayCycleIndex()) || cyclesOf(slot)[0] || null;
    /* The current week is staged last, so the row projection the host keeps
       for it is the one left standing after an every-week change. */
    const weekOrder = slot => {
      const current = displayCycle(slot)?.cycleIndex;
      const list = cyclesOf(slot).map(cycle => cycle.cycleIndex);
      return current == null ? list : list.filter(index => index !== current).concat(current);
    };
    const repDefinition = slot => exerciseMetricDefinitions(adapter, slot).find(metric => REP_TARGET_SEMANTICS.has(metric.semantic)) || null;
    const rangeOf = target => Number.isFinite(target) ? { min: target, max: target }
      : target && typeof target === "object" && Number.isFinite(target.min) && Number.isFinite(target.max) ? { min: target.min, max: target.max } : null;
    const exerciseById = id => (document.program || []).find(item => item.id === id) || null;
    const slotOfExercise = exercise => exercise ? definitionSlot(document, exercise.slotId || exercise.id) : null;
    const customMovement = exercise => !exercise?.libraryId || String(exercise.libraryId).startsWith("custom:");

    function repsText(definition, target) {
      const range = rangeOf(target);
      if (!range) return "";
      const key = definition.semantic === "repsPerSide" ? "entry.review.reps_side" : "entry.review.reps";
      if (range.min !== range.max) return rt(key, { min: format(adapter, range.min), max: format(adapter, range.max) }, `${range.min}–${range.max} reps`);
      // One figure: the same words around it, without a range.
      return rt(key, { min: "\u0000", max: "\u0001" }, "\u0000–\u0001 reps").replace("\u0000–\u0001", format(adapter, range.min));
    }
    /** One set in words and figures: the rep range, or each target the movement records. */
    function setText(slot, set) {
      const definitions = exerciseMetricDefinitions(adapter, slot);
      const rep = definitions.find(metric => REP_TARGET_SEMANTICS.has(metric.semantic));
      if (rep && set?.targets?.[rep.semantic] != null) return repsText(rep, set.targets[rep.semantic]);
      const parts = definitions.filter(metric => set?.targets?.[metric.semantic] != null).map(metric => {
        const unit = metricDisplayUnit(adapter, metric);
        return `${formatMetricValue(adapter, metric, set.targets[metric.semantic])}${unit ? ` ${unit}` : ""}`;
      });
      return parts.join(" · ") || "–";
    }
    function legacySetLines(exercise) {
      const count = positiveInt(exercise.sets, 1), min = format(adapter, exercise.min), max = format(adapter, exercise.max);
      const text = exercise.hasRepTarget === false ? "–"
        : rt("entry.review.reps", { min, max }, `${min}–${max} reps`);
      return Array.from({ length: count }, () => ({ text, rir: null }));
    }
    function setLines(exercise) {
      const slot = slotOfExercise(exercise);
      if (!slot) return legacySetLines(exercise);
      return (displayCycle(slot)?.sets || []).map(set => ({ text: setText(slot, set), rir: Number.isFinite(set.rir) ? set.rir : null }));
    }
    function rowChanged(exercise) {
      const before = (baseDocument.program || []).find(item => item.id === exercise.id);
      if (!before) return "added";
      const slotId = exercise.slotId || exercise.id;
      const was = definitionSlot(baseDocument, slotId), now = definitionSlot(document, slotId);
      const shape = (row, slot) => stable([row?.libraryId, row?.name, row?.day, row?.notes, row?.primary, row?.secondary,
        row?.sets, row?.min, row?.max, slot?.exerciseId, slot?.prescriptionsByCycle, slot?.alternates || [], slot?.executionMode || null]);
      return shape(before, was) === shape(exercise, now) ? "" : "edited";
    }
    function dayMinutes(doc, day) {
      try {
        const value = Number(adapter.dayMinutes?.(doc, day));
        return Number.isFinite(value) && value > 0 ? value : null;
      } catch { return null; }
    }

    // ----- weeks -----
    function weekPattern(cycle) {
      return stable((cycle?.sets || []).map(set => [set.targets || {}, set.rir ?? null, set.restSeconds ?? null]));
    }
    /** The pattern most weeks share; a tie goes to the earliest week. */
    function commonWeek(slot) {
      const counts = new Map(), first = new Map();
      for (const cycle of cyclesOf(slot)) {
        const key = weekPattern(cycle);
        counts.set(key, (counts.get(key) || 0) + 1);
        if (!first.has(key)) first.set(key, cycle);
      }
      let best = null, bestCount = 0;
      for (const [key, count] of counts) if (count > bestCount) { best = key; bestCount = count; }
      return best == null ? null : first.get(best);
    }
    function differingWeeks(slot) {
      const common = commonWeek(slot);
      if (!common) return [];
      const key = weekPattern(common);
      return cyclesOf(slot).filter(cycle => weekPattern(cycle) !== key).map(cycle => cycle.cycleIndex);
    }
    function weekSummary(slot, cycle) {
      const sets = cycle?.sets || [];
      const texts = [...new Set(sets.map(set => setText(slot, set)))];
      const rirs = sets.map(set => set.rir);
      const parts = [texts.length === 1 ? `${format(adapter, sets.length)} × ${texts[0]}` : rt("entry.review.sheet.n_sets", { n: sets.length }, `${sets.length} sets`)];
      if (rirs.some(value => Number.isFinite(value)))
        parts.push(rt("entry.review.rir", { n: rirs.map(value => Number.isFinite(value) ? format(adapter, value) : "–").join("·") }, "RIR"));
      return parts.join(" · ");
    }

    // ----- one change at a time, each staged as an ordinary intent -----
    function buildSetsChange(doc, id, cycleIndex, wanted) {
      const next = clone(doc), exercise = next.program?.find(item => item.id === id);
      const slot = exercise ? definitionSlot(next, exercise.slotId || exercise.id) : null;
      const cycle = slot ? definitionCycle(slot, cycleIndex) : null;
      if (!cycle || !cycle.sets.length) return null;
      const normalized = Math.max(1, Math.min(MAX_REVIEW_SETS, Math.round(wanted)));
      const previous = cycle.sets.length;
      if (previous === normalized) return null;
      const beforeSetIds = cycle.sets.map(set => set.id), addedSets = [], removedSetIds = [];
      const adaptive = slotAdaptive(slot);
      while (cycle.sets.length < normalized) {
        const source = cycle.sets.at(-1);
        const added = adaptive
          ? { ...clone(source), id: uid(), cycleIndex, setIndex: cycle.sets.length + 1 }
          : { ...clone(source), id: uid(), cycleIndex, setIndex: cycle.sets.length + 1,
            rir: null, status: slot.metricIds?.length ? "manual" : "configuration_required",
            provenance: { source: "manual", policyVersion: "manual@1" } };
        cycle.sets.push(added);
        addedSets.push(clone(added));
      }
      while (cycle.sets.length > normalized) removedSetIds.push(cycle.sets.pop().id);
      cycle.sets.forEach((set, index) => { set.setIndex = index + 1; });
      exercise.sets = normalized;
      exercise.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
      return { next, edit: { kind: "prescription", targetId: id, field: "sets", before: previous, after: normalized,
        cycleIndex, beforeSetIds, addedSets, removedSetIds } };
    }
    function buildFieldChange(doc, slotId, cycleIndex, setIndex, field, after) {
      const current = definitionSet(doc, slotId, cycleIndex, setIndex);
      if (!current || (field !== "rir" && field !== "restSeconds")) return null;
      const before = current[field] == null ? null : current[field];
      if (Object.is(before, after)) return null;
      const keepsAdaptive = field === "rir" && current.status === "ready";
      if (keepsAdaptive && after == null) return null;
      const next = clone(doc), set = definitionSet(next, slotId, cycleIndex, setIndex);
      set[field] = after;
      if (!keepsAdaptive) {
        set.status = "manual";
        set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
      }
      const row = (next.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
      if (row) row.prescriptionsByCycle = clone(definitionSlot(next, slotId).prescriptionsByCycle || []);
      return { next, edit: { kind: "prescription_field", slotId, cycleIndex, setIndex, field, before, after } };
    }
    function buildTargetChange(doc, slotId, cycleIndex, setIndex, metricId, after) {
      const slot = definitionSlot(doc, slotId);
      const definition = slot?.metricDefinitions?.find(item => item.id === metricId);
      const set = definitionSet(doc, slotId, cycleIndex, setIndex);
      if (!slot || !definition || !set || !(slot.metricIds || []).includes(metricId)) return null;
      const semantic = definition.semantic;
      const before = hasOwn(set.targets, semantic) ? { present: true, value: clone(set.targets[semantic]) } : { present: false, value: null };
      if (equal(before, after)) return null;
      if (set.status === "ready" && REP_TARGET_SEMANTICS.has(semantic) && !repRange(after.value)) return null;
      const next = clone(doc);
      if (!replaceMetricTarget(next, slotId, cycleIndex, setIndex, semantic, after)) return null;
      return { next, edit: { kind: "metric_target", slotId, cycleIndex, setIndex, metricId, semantic,
        metricIds: clone(slot.metricIds || []), metricDefinitions: clone(slot.metricDefinitions || []), before, after } };
    }

    // ----- the queue, undo and the toast -----
    function markBusy() {
      const editor = host.querySelector('[data-role="editor"]');
      if (!editor) return;
      if (busy) editor.setAttribute("aria-busy", "true"); else editor.removeAttribute("aria-busy");
    }
    function act(task) {
      busy++;
      markBusy();
      const runTask = async () => {
        try { return await task(); }
        finally { busy--; if (!destroyed) render(); }
      };
      reviewQueue = reviewQueue.then(runTask, runTask);
      return reviewQueue;
    }
    async function revertTo(entry) {
      document = clone(entry.document);
      edits = edits.slice(0, entry.editCount);
      try { await adapter.revert?.(entry.editCount, clone(document)); } catch { /* the editor's own copy is restored */ }
    }
    /** One user action: the steps run in order, each on the document the last one left. All of it undoes at once. */
    function userAction(steps, options) { return act(() => userActionTask(steps, options)); }
    /* As in the classic layout, a change the host could not stage (a legacy
       program with no definition, a custom movement it has not seen yet) stays
       in the editor's document, which Apply commits whole; the status line
       says so. Undo takes it back like any other change. */
    async function userActionTask(steps, { toast = null } = {}) {
      const entry = { document: clone(document), editCount: edits.length };
      let staged = 0;
      for (const step of steps) {
        const change = step(document);
        if (!change) continue;
        await stage(change.next, change.edit, { redraw: false });
        staged++;
      }
      if (!staged) return false;
      undoStack.push(entry);
      if (toast) showToast(toast);
      return true;
    }
    /** An existing edit path (add, swap, remove, alternates, loads…) recorded for Undo. */
    function recorded(run, options) { return act(() => recordedTask(run, options)); }
    async function recordedTask(run, { toast = null } = {}) {
      const entry = { document: clone(document), editCount: edits.length };
      quietChange = !!toast;
      let result;
      try { result = await run(); } finally { quietChange = false; }
      if (edits.length <= entry.editCount) return result;
      undoStack.push(entry);
      if (toast) showToast(toast);
      return result;
    }
    /** The sheet steps aside first, inside the same queued task, so the editor reads busy from the tap on. */
    function afterSheet(task) {
      return act(async () => { await closeSheetView(); return task(); });
    }
    function undoLast() {
      return act(async () => {
        const entry = undoStack.pop();
        if (!entry) return false;
        await revertTo(entry);
        hideToast();
        try { adapter.announce?.(rt("entry.review.toast.undone", undefined, "Undone.")); } catch { /* the redraw shows it */ }
        return true;
      });
    }
    function showToast(text) {
      hideToast();
      const doc = host.ownerDocument;
      toastEl = doc.createElement("div");
      toastEl.className = "review-toast";
      toastEl.dataset.role = "editor-toast";
      toastEl.setAttribute("role", "status");
      toastEl.innerHTML = `<span class="review-toast__text">${esc(text)}</span><button type="button" class="review-toast__undo" data-role="toast-undo">${esc(label("undo"))}</button>`;
      toastEl.querySelector('[data-role="toast-undo"]').addEventListener("click", () => { hideToast(); undoLast(); });
      doc.body.append(toastEl);
      try { root.RepForgeMotion?.revealToast?.(toastEl); } catch { /* shown without motion */ }
      toastTimer = setTimeout(hideToast, 4200);
    }
    function hideToast() {
      clearTimeout(toastTimer);
      toastEl?.remove();
      toastEl = null;
    }

    // ----- the overview -----
    /* "4 days · Week 3 of 7": the week comes from the host's block copy, which
       also says when the block is ready for review. */
    function factsHtml() {
      const days = labels(document).length, cycles = definitionFor(document)?.cycles;
      const daysText = rt(days === 1 ? "program.editor.days_count_one" : "program.editor.days_count", { n: days }, `${days} days`);
      const weekText = context() || (Number.isInteger(cycles)
        ? rt(cycles === 1 ? "entry.review.block.week_one" : "entry.review.block.weeks", { n: cycles }, `${cycles} weeks`) : "");
      return nums(daysText) + (weekText ? ` · <span data-role="context">${nums(weekText)}</span>` : "");
    }
    function rowHtml(exercise) {
      const name = exerciseDisplayLabel(adapter, exercise);
      const changedState = rowChanged(exercise);
      const mark = changedState === "added" ? rt("entry.review.mark.added", undefined, "Added")
        : changedState ? rt("entry.review.mark.edited", undefined, "Adjusted") : "";
      const lines = setLines(exercise);
      return `<article class="review__row program-editor-a__row${mark ? " is-changed" : ""}" data-role="exercise-row" data-id="${esc(exercise.id)}" role="button" tabindex="0" aria-label="${esc(name)}">` +
        tile(exercise.libraryId, "md") +
        `<div class="review__rowbody"><h3 class="review__name">${esc(name)}</h3>` +
        (mark ? `<span class="review__mark" data-role="row-mark"><span class="review__dot" aria-hidden="true"></span>${esc(mark)}</span>` : "") +
        `<ol class="review__sets">${lines.map((line, index) => `<li data-role="set-line"><span class="review__setn num">${index + 1}</span><span class="review__reps">${nums(line.text)}</span>` +
          (line.rir == null ? "" : `<span class="review__rir">${nums(rt("entry.review.rir", { n: format(adapter, line.rir) }, `RIR ${line.rir}`))}</span>`) + `</li>`).join("")}</ol>` +
        `</div>${icon("chev-right")}</article>`;
    }
    function dayPanelHtml(day) {
      const days = labels(document), index = days.indexOf(day);
      if (index < 0) return "";
      const list = exercisesFor(document, day), name = titleFor(day, index);
      const minutes = dayMinutes(document, day);
      const meta = list.length
        ? [dayCount(list.length), minutes ? rt("entry.review.about_minutes", { n: minutes }, `about ${minutes} min`) : ""].filter(Boolean).join(" · ")
        : rt("program.editor.no_exercises", undefined, "No exercises");
      const head = `<div class="review__dayhead"><div class="review__dayid">` +
        `<button type="button" class="review__dayname" data-role="day-name-edit" data-day="${esc(day)}" aria-label="${esc(rt("entry.review.rename_day_aria", { day: name }, `Rename ${name}`))}">${esc(name)}${icon("pencil")}</button>` +
        `<p class="review__daymeta" data-role="day-meta">${nums(meta)}</p></div>` +
        (view.reorderDay === day ? "" : `<button type="button" class="review__more" data-role="day-menu" data-day="${esc(day)}" aria-label="${esc(rt("entry.review.day_menu_aria", { day: name }, `More actions for ${name}`))}" aria-haspopup="dialog">${icon("overflow")}</button>`) +
        `</div>`;
      if (view.reorderDay === day) {
        return head + `<p class="review__hint">${esc(rt("entry.review.reorder_hint", undefined, ""))}</p><ol class="review__reorder" data-role="reorder-list" data-day="${esc(day)}">` +
          list.map((exercise, position) => {
            const shown = exerciseDisplayLabel(adapter, exercise);
            return `<li class="review__ro" data-role="reorder-row" data-id="${esc(exercise.id)}">` +
              `<button type="button" class="review__handle" data-role="drag-handle" data-id="${esc(exercise.id)}" aria-label="${esc(label("move", undefined, shown))}">${icon("grip")}</button>` +
              `<span class="review__ro-name">${esc(shown)}</span>` +
              `<button type="button" class="review__ro-btn" data-role="reorder-move" data-id="${esc(exercise.id)}" data-delta="-1" aria-label="${esc(rt("entry.review.move_up", { name: shown }, `Move ${shown} up`))}"${position === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
              `<button type="button" class="review__ro-btn" data-role="reorder-move" data-id="${esc(exercise.id)}" data-delta="1" aria-label="${esc(rt("entry.review.move_down", { name: shown }, `Move ${shown} down`))}"${position === list.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button></li>`;
          }).join("") + `</ol><button type="button" class="btn btn--cta btn--noarrow review__reorder-done" data-role="reorder-done">${esc(rt("entry.review.reorder_done", undefined, "Done"))}</button>`;
      }
      const empty = list.length ? "" : `<p class="review__empty" data-role="day-empty" role="alert">${icon("alert")}<span>${esc(rt("entry.review.empty_day", undefined, "This day has no exercises."))}</span></p>`;
      return head + empty + list.map(rowHtml).join("") +
        `<button type="button" class="review__add" data-role="add-exercise" data-day="${esc(day)}">${icon("plus")}<span>${esc(label("addExercise"))}</span></button>`;
    }
    function renderReview() {
      const days = labels(document);
      if (view.tab == null || !days.includes(view.tab)) view.tab = days[0] ?? null;
      const issues = validation(document);
      const blocked = issues.some(issue => issue.startsWith("day_empty:"));
      const name = document.programMeta?.name || label("namePlaceholder");
      const count = undoStack.length;
      const changesBar = count
        ? `<div class="review__changes" data-role="changes" role="status"><span class="review__count" data-role="changes-count"><span class="review__dot" aria-hidden="true"></span>${esc(rt(count === 1 ? "entry.review.changes_one" : "entry.review.changes", { n: count }, `${count} changes`))}</span>` +
          `<button type="button" class="text-link" data-role="undo">${esc(label("undo"))}</button></div>`
        : `<p class="review__hint program-editor-a__hint">${esc(rt("entry.review.tap_hint", undefined, ""))}</p>`;
      const tabs = `<div class="review__tabs" role="tablist" aria-label="${esc(rt("program.days_label", undefined, "Training days"))}">${days.map((day, index) => {
        const on = day === view.tab, empty = !exercisesFor(document, day).length;
        return `<button type="button" role="tab" class="review__tab${on ? " is-on" : ""}" data-role="day-tab" data-day="${esc(day)}" aria-selected="${on}" aria-controls="programEditorPanel" tabindex="${on ? 0 : -1}">` +
          `${esc(titleFor(day, index))}${empty ? `<span class="review__pip" data-role="empty-pip" aria-label="${esc(rt("entry.review.empty_pip", undefined, "No exercises"))}"></span>` : ""}</button>`;
      }).join("")}</div>`;
      host.innerHTML = `<div class="program-editor program-editor-a review" data-role="editor" data-layout="review"${busy ? ' aria-busy="true"' : ""} aria-label="${esc(rt("program.editor.aria", undefined, "Program editor"))}">` +
        `<h2 class="onb__q review__title program-editor-a__title"><button type="button" class="review__titlebtn" data-role="program-name-edit" aria-label="${esc(rt("entry.review.rename_program_aria", { name }, `Rename ${name}`))}"><span>${esc(name)}</span>${icon("pencil")}</button></h2>` +
        `<p class="review__daymeta program-editor-a__facts" data-role="facts">${factsHtml()}</p>` +
        `<p class="program-editor__status${reviewStatus?.error ? " is-error" : ""}" data-role="editor-status" role="status" aria-live="polite" tabindex="-1"${reviewStatus ? "" : " hidden"}>${esc(reviewStatus?.message || "")}</p>` +
        changesBar + tabs +
        `<div class="review__panel" id="programEditorPanel" role="tabpanel" data-role="day-panel">${view.tab == null ? `<p class="program-editor__empty">${esc(label("emptyDays"))}</p>` : dayPanelHtml(view.tab)}</div>` +
        `<div class="program-editor-a__bar" data-role="apply-bar" data-elevation="persistent-action">` +
          (blocked ? `<p class="program-editor-a__reason" data-role="apply-reason">${esc(label("emptyDays"))}</p>` : "") +
          `<button type="button" class="btn btn--cta" data-role="apply"${blocked ? " disabled" : ""}>${esc(rt("program.editor.apply_changes", undefined, "Apply changes"))}</button>` +
        `</div></div>`;
      adapter.afterRender?.(host);
      // Only the Reorder exercises list drags; every other render has nothing to sort.
      if (view.reorderDay != null) mountSorting(); else teardownSorting();
      paintSheet();
    }

    // ----- the sheets -----
    function openSheetView(next, { focus = null } = {}) {
      const wasOpen = !!view.sheet;
      view.sheet = next;
      paintSheet();
      if (!wasOpen) {
        try { adapter.openSheet?.({ onClose: () => { view.sheet = null; } }); } catch { /* the host has no sheet */ }
      }
      const parts = sheetParts();
      const target = focus && parts?.el?.querySelector(focus);
      if (target) { try { target.focus({ preventScroll: true }); } catch { /* not focusable */ } }
      else if (wasOpen) { try { parts?.body?.scrollTo?.({ top: 0 }); } catch { /* nothing to scroll */ } }
    }
    async function closeSheetView() {
      if (!view.sheet) return;
      view.sheet = null;
      try { await adapter.closeSheet?.(); } catch { /* already closed */ }
    }
    function stepper(role, attrs, value, { down = true, up = true, downLabel = "−", upLabel = "+", small = false } = {}) {
      return `<span class="review-step${small ? " review-step--sm" : ""}"><button type="button" data-role="${role}" ${attrs} data-delta="-1" aria-label="${esc(downLabel)}"${down ? "" : " disabled"}>−</button>` +
        `<b class="num" data-role="${role}-value">${esc(value)}</b><button type="button" data-role="${role}" ${attrs} data-delta="1" aria-label="${esc(upLabel)}"${up ? "" : " disabled"}>+</button></span>`;
    }
    function loadsHtml(exercise, slot) {
      const policy = adapter.suggestLoads;
      const loadStep = renderLoadStep(exercise, slot);
      const stepLine = loadStep ? `<div class="program-editor-a__line program-editor-a__loadstep">${loadStep}</div>` : "";
      if (!policy || !slot) return stepLine ? `<section class="review-sheet__sec" data-role="loads">${stepLine}</section>` : "";
      const eligibility = policy.eligibility?.(slot);
      if (eligibility === "custom" || eligibility === "unsupported") {
        return `<section class="review-sheet__sec" data-role="loads"><p class="review-sheet__note program-editor__suggest-loads-note" data-role="suggest-loads-note">${esc(label(eligibility === "custom" ? "suggestLoadsCustom" : "suggestLoadsUnsupported"))}</p>${stepLine}</section>`;
      }
      if (eligibility !== "eligible") return stepLine ? `<section class="review-sheet__sec" data-role="loads">${stepLine}</section>` : "";
      const on = slotAdaptive(slot) || pendingSuggestLoads(document).includes(slot.id);
      const semantic = slotRepSemantic(slot);
      const range = repRange(displayCycle(slot)?.sets?.[0]?.targets?.[semantic]);
      const rangeMissing = slotSets(slot).some(set => !repRange(set.targets?.[semantic]));
      const labelId = `program-editor-suggest-${esc(slot.id)}`;
      const toggle = `<div class="program-editor-a__line program-editor__suggest-loads-row"><span class="review-sheet__lab" id="${labelId}">${esc(label("suggestLoads"))}</span>` +
        `<button type="button" class="toggle program-editor-a__switch" role="switch" aria-checked="${on ? "true" : "false"}" aria-labelledby="${labelId}" data-role="suggest-loads" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}"${!on && rangeMissing ? " disabled" : ""}></button></div>`;
      if (!on) return `<section class="review-sheet__sec program-editor__suggest-loads" data-role="loads">${toggle}${stepLine}</section>`;
      const rir = uniformRir(slot);
      const question = policy.executionModeQuestion?.(slot);
      const modeLabelId = `program-editor-mode-${esc(slot.id)}`;
      const mode = question ? `<div class="program-editor__execution-mode program-editor-a__mode" role="radiogroup" aria-labelledby="${modeLabelId}" data-role="execution-mode-group" data-slot-id="${esc(slot.id)}">` +
        `<span class="review-sheet__lab" id="${modeLabelId}">${esc(label("executionModeQuestion"))}</span>` +
        [["bilateral", "executionModeBilateral"], ["unilateral", "executionModeUnilateral"]].map(([value, key]) =>
          `<button type="button" role="radio" class="radio-card${slot.executionMode === value ? " is-selected" : ""}" aria-checked="${slot.executionMode === value ? "true" : "false"}" data-role="execution-mode" data-mode="${value}" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}"><span class="radio-card__body"><span class="radio-card__title">${esc(label(key))}</span></span><span class="radio-card__mark" aria-hidden="true"></span></button>`).join("") +
        (slot.executionMode === "unilateral" ? `<p class="review-sheet__note" data-role="per-side-note">${esc(rt("program.editor.per_side_note", undefined, "Load and reps are now counted per side."))}</p>` : "") +
        `</div>` : "";
      return `<section class="review-sheet__sec program-editor__suggest-loads is-on" data-role="loads">${toggle}` +
        (range ? `<p class="review-sheet__note program-editor__suggest-loads-range" data-role="suggest-loads-range">${nums(label("suggestLoadsRange", { min: format(adapter, range.min), max: format(adapter, range.max) }))}</p>` : "") +
        `<div class="program-editor-a__line" data-role="suggest-loads-rir-line"><span class="review-sheet__lab">${esc(rt("program.editor.rir_all", undefined, "RIR on every set"))}</span>` +
        stepper("suggest-loads-rir-step", `data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}"`, rir == null ? "–" : format(adapter, rir),
          { down: rir == null || rir > 0, up: rir == null || rir < MAX_OPT_IN_RIR, downLabel: label("metricRir"), upLabel: label("metricRir") }) + `</div>` +
        stepLine + mode + `</section>`;
    }
    function alternatesHtml(exercise, slot) {
      if (!slot) return "";
      const list = Array.isArray(slot.alternates) ? slot.alternates : [];
      const full = list.length >= maxAlternates();
      return `<section class="review-sheet__sec" data-role="alternates" data-id="${esc(exercise.id)}"><h3 class="sheetgroup__head">${esc(rt("entry.review.sheet.alts", undefined, label("alternates")))}</h3>` +
        `<p class="review-sheet__lede">${esc(rt("entry.review.sheet.alts_lede", undefined, label("alternatesHint")))}</p>` +
        (list.length ? `<ol class="review-sheet__alts">${list.map((id, index) => {
          const name = movementLabel(adapter, id), attrs = `data-id="${esc(exercise.id)}" data-exercise-id="${esc(id)}"`;
          return `<li data-role="alternate" data-exercise-id="${esc(id)}"><span class="review__setn">${index + 1}</span><span class="review-sheet__alt-name" data-role="alternate-name">${esc(name)}</span>` +
            `<button type="button" class="review__ro-btn" data-role="alternate-up" ${attrs} aria-label="${esc(label("alternateUp", { name }))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
            `<button type="button" class="review__ro-btn" data-role="alternate-down" ${attrs} aria-label="${esc(label("alternateDown", { name }))}"${index === list.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button>` +
            `<button type="button" class="review__ro-btn" data-role="alternate-remove" ${attrs} aria-label="${esc(label("alternateRemove", { name }))}">${icon("close")}</button></li>`;
        }).join("")}</ol>` : "") +
        `<div class="review-sheet__links"><button type="button" class="text-link" data-role="add-alternate" data-id="${esc(exercise.id)}"${full ? " disabled" : ""}>${icon("plus")}${esc(label("addAlternate"))}</button></div></section>`;
    }
    function detailsHtml(exercise, slot) {
      const linked = !customMovement(exercise) && exerciseEntry(adapter, exercise.libraryId);
      const field = (name, value, { readonly = false } = {}) => readonly
        ? `<label class="field review-sheet__field"><span class="field__lab">${esc(label(name))}</span><textarea class="input program-editor__muscles" rows="${Math.min(4, Math.max(1, Math.ceil(String(value || "").length / 30)))}" readonly data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="${name}">${esc(value || "")}</textarea></label>`
        : `<label class="field review-sheet__field"><span class="field__lab">${esc(label(name))}</span><input class="input" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="${name}" value="${esc(value || "")}"></label>`;
      const nameField = customMovement(exercise)
        ? `<label class="field review-sheet__field"><span class="field__lab">${esc(rt("program.exercise.name_aria", undefined, "Exercise name"))}</span><input class="input" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="name" value="${esc(exerciseName(adapter, exercise))}" maxlength="80"></label>` : "";
      let composition = "";
      if (slot && editableMetricComposition(slot)) {
        // The same control, named in the lifter's words rather than "Metric composition".
        composition = renderMetricComposition(exercise, slot).split(esc(label("metricComposition"))).join(esc(rt("program.editor.records", undefined, "What you record")));
      }
      return `<details class="review-sheet__sec program-editor-a__details" data-role="more-details" data-id="${esc(exercise.id)}"><summary>${esc(label("details"))}</summary>` +
        nameField + field("notes", exercise.notes) + field("primary", exercise.primary, { readonly: !!linked }) + field("secondary", exercise.secondary, { readonly: !!linked }) +
        composition + `</details>`;
    }
    function exerciseSheetHtml(exercise) {
      const slot = slotOfExercise(exercise);
      const cycle = slot ? displayCycle(slot) : null;
      const sets = cycle?.sets || [];
      const rep = slot ? repDefinition(slot) : null;
      const firstRange = rep ? rangeOf(sets[0]?.targets?.[rep.semantic]) : null;
      const count = slot ? sets.length : positiveInt(exercise.sets, 1);
      const rest = sets[0]?.restSeconds ?? null;
      const base = (baseDocument.program || []).find(item => item.id === exercise.id);
      const was = dayMinutes(baseDocument, base?.day || exercise.day), now = dayMinutes(document, exercise.day);
      const muscles = [exercise.primary, exercise.secondary].filter(Boolean).join(", ");
      const others = labels(document).filter(day => day !== exercise.day);
      const differs = slot ? differingWeeks(slot) : [];
      const cycles = cyclesOf(slot).length;
      const ledger = slot ? `<div class="review-sheet__ledger" role="table" aria-label="${esc(rt("entry.review.sheet.sets", undefined, "Sets"))}">` +
        `<div class="review-sheet__lh" role="row"><span role="columnheader">${esc(rt("entry.review.sheet.set_col", undefined, "Set"))}</span><span role="columnheader">${esc(rt("entry.review.sheet.reps_col", undefined, "Reps"))}</span><span role="columnheader">${esc(rt("entry.review.sheet.rir_col", undefined, "RIR"))}</span></div>` +
        sets.map((set, index) => `<div class="review-sheet__lr" role="row" data-role="set-ledger-row"><span class="review__setn num" role="cell">${index + 1}</span><span role="cell" data-role="set-reps">${nums(setText(slot, set))}</span>` +
          `<span class="review-step review-step--sm" role="cell"><button type="button" data-role="rir-step" data-set-index="${index + 1}" data-delta="-1" aria-label="${esc(rt("entry.review.sheet.rir_down", { n: index + 1 }, `Lower set ${index + 1}'s RIR`))}"${set.rir != null && set.rir <= 0 ? " disabled" : ""}>−</button><b class="num" data-role="set-rir">${esc(set.rir == null ? "–" : format(adapter, set.rir))}</b>` +
          `<button type="button" data-role="rir-step" data-set-index="${index + 1}" data-delta="1" aria-label="${esc(rt("entry.review.sheet.rir_up", { n: index + 1 }, `Raise set ${index + 1}'s RIR`))}"${set.rir != null && set.rir >= MAX_REVIEW_RIR ? " disabled" : ""}>+</button></span></div>`).join("") + `</div>` : "";
      const setsControl = `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(rt("entry.review.sheet.sets", undefined, "Sets"))}</span>` +
        stepper("sets-step", `data-id="${esc(exercise.id)}"`, rt(count === 1 ? "entry.review.sheet.n_sets_one" : "entry.review.sheet.n_sets", { n: count }, `${count} sets`),
          { down: count > 1, up: count < MAX_REVIEW_SETS, downLabel: label("setsDecrease"), upLabel: label("setsIncrease") }) + `</div>`;
      const rangeControl = firstRange ? `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(rt("entry.review.sheet.range", undefined, "Rep range"))}</span><span class="review-sheet__range">` +
        stepper("range-step", `data-bound="min"`, format(adapter, firstRange.min), { down: firstRange.min > 1, up: firstRange.min < firstRange.max, small: true,
          downLabel: rt("entry.review.sheet.min_down", undefined, "−"), upLabel: rt("entry.review.sheet.min_up", undefined, "+") }) +
        `<span aria-hidden="true">–</span>` +
        stepper("range-step", `data-bound="max"`, format(adapter, firstRange.max), { down: firstRange.max > firstRange.min, up: firstRange.max < MAX_REVIEW_REPS, small: true,
          downLabel: rt("entry.review.sheet.max_down", undefined, "−"), upLabel: rt("entry.review.sheet.max_up", undefined, "+") }) + `</span></div>` : "";
      const restControl = slot ? `<div class="review-sheet__ctl review-sheet__ctl--col"><span class="review-sheet__lab" id="programEditorRestLab">${esc(rt("entry.review.sheet.rest", undefined, "Rest between sets"))}</span><div class="review-seg" role="radiogroup" aria-labelledby="programEditorRestLab">` +
        REST_PRESETS.map(seconds => `<button type="button" role="radio" class="review-seg__opt num${seconds === rest ? " is-on" : ""}" aria-checked="${seconds === rest}" data-role="rest-preset" data-seconds="${seconds}">${esc(rt("entry.review.sheet.seconds", { n: seconds }, `${seconds} s`))}</button>`).join("") + `</div></div>` : "";
      const time = now ? `<p class="review-sheet__time" data-role="day-time">${nums(was && was !== now
        ? rt("entry.review.sheet.day_time_change", { from: was, to: now }, `Day: about ${was} → ${now} min`)
        : rt("entry.review.sheet.day_time", { n: now }, `Day: about ${now} min`))}</p>` : "";
      const weeksRow = slot && cycles > 1 ? `<button type="button" class="program-editor-a__navrow" data-role="weeks-open" data-id="${esc(exercise.id)}">` +
        `<span class="program-editor-a__navtext"><span class="review-sheet__lab">${esc(rt("program.editor.weeks", undefined, "Weeks"))}</span>` +
        `<span class="review-sheet__note">${esc(differs.length
          ? rt(differs.length === 1 ? "program.editor.weeks_differ_one" : "program.editor.weeks_differ", { n: differs.length }, `${differs.length} weeks differ`)
          : rt("program.editor.weeks_same", { n: cycles }, `Same in all ${cycles} weeks`))}</span></span>` +
        `<span class="program-editor-a__navaction">${esc(rt("program.editor.adjust", undefined, "Adjust"))}</span>${icon("chev-right")}</button>` : "";
      const legacy = !slot ? `<div class="review-sheet__ctl"><span class="review-sheet__lab">${esc(label("repRange"))}</span><span class="review-sheet__range">` +
        `<input class="input program-editor-a__num" type="text" inputmode="numeric" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="min" value="${esc(exercise.min)}" aria-label="${esc(label("min"))}">` +
        `<span aria-hidden="true">–</span><input class="input program-editor-a__num" type="text" inputmode="numeric" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="max" value="${esc(exercise.max)}" aria-label="${esc(label("max"))}"></span></div>` : "";
      return `<div data-pe-sheet="exercise" data-id="${esc(exercise.id)}">` +
        `<div class="review-sheet__head">${tile(exercise.libraryId, "lg")}<div>${muscles ? `<p class="review-sheet__note">${esc(muscles)}</p>` : ""}</div></div>` +
        `<section class="review-sheet__sec">${ledger}${setsControl}${rangeControl}${legacy}${restControl}${time}</section>` +
        (weeksRow ? `<section class="review-sheet__sec">${weeksRow}</section>` : "") +
        loadsHtml(exercise, slot) +
        `<section class="review-sheet__sec">` +
          `<button type="button" class="program-editor-a__navrow" data-role="swap-open" data-action-role="replacement" data-id="${esc(exercise.id)}"><span class="program-editor-a__navtext"><span class="review-sheet__lab">${esc(rt("entry.review.sheet.swap", undefined, label("replaceExercise")))}</span></span>${icon("chev-right")}</button></section>` +
        alternatesHtml(exercise, slot) +
        (others.length ? `<section class="review-sheet__sec"><h3 class="sheetgroup__head">${esc(rt("entry.review.sheet.move", undefined, label("moveOther")))}</h3><div class="review-sheet__chips">${others.map(day =>
          `<button type="button" class="review-chipbtn" data-role="move-to-day" data-id="${esc(exercise.id)}" data-day="${esc(day)}">${esc(titleForDay(day))}</button>`).join("")}</div></section>` : "") +
        detailsHtml(exercise, slot) +
        `<section class="review-sheet__sec"><button type="button" class="btn btn--steel btn--destructive" id="programEditorRemove" data-role="remove-exercise" data-action-role="removal" data-id="${esc(exercise.id)}">${esc(rt("entry.review.sheet.remove", undefined, label("removeExercise")))}</button></section>` +
        `</div>`;
    }
    function weekTableHtml(exercise, slot, cycle, common) {
      const definitions = (slot.metricIds || []).map(id => (slot.metricDefinitions || []).find(metric => metric.id === id)).filter(Boolean);
      const reference = common && common.cycleIndex !== cycle.cycleIndex ? common : null;
      const differsAt = (index, read) => !!reference && !equal(read(cycle.sets[index]), read(reference.sets?.[index]));
      const header = `<span class="program-editor-a__th">#</span>` + definitions.map(metric => {
        const unit = metricDisplayUnit(adapter, metric);
        const text = LOAD_SEMANTICS.has(metric.semantic) ? rt("program.editor.week_load", { unit }, `Load ${unit}`)
          : REP_TARGET_SEMANTICS.has(metric.semantic) ? rt("entry.review.sheet.reps_col", undefined, "Reps")
            : `${metricLabel(adapter, metric)}${unit ? ` ${unit}` : ""}`;
        return `<span class="program-editor-a__th">${esc(text)}</span>`;
      }).join("") + `<span class="program-editor-a__th">${esc(label("metricRir"))}</span><span class="program-editor-a__th">${esc(rt("program.editor.week_rest", undefined, "Rest"))}</span>`;
      const weekTitle = rt("program.editor.week", { n: cycle.cycleIndex }, `Week ${cycle.cycleIndex}`);
      const cells = (cycle.sets || []).map((set, index) => {
        const setTitle = label("metricSet", { n: set.setIndex });
        const metricCells = definitions.map(metric => {
          const target = set.targets?.[metric.semantic];
          const ranged = REP_TARGET_SEMANTICS.has(metric.semantic) || !!rangeOf(target) && typeof target === "object";
          const diff = differsAt(index, value => value?.targets?.[metric.semantic] ?? null);
          return `<input class="program-editor-a__cell${diff ? " is-diff" : ""}" type="text" inputmode="${REP_TARGET_SEMANTICS.has(metric.semantic) ? "numeric" : "decimal"}" autocomplete="off" data-role="metric-target" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" data-cycle-index="${cycle.cycleIndex}" data-set-index="${set.setIndex}" data-metric-id="${esc(metric.id)}" data-semantic="${esc(metric.semantic)}" data-bound="${ranged ? "range" : "value"}"` +
            ` value="${target == null ? "" : esc(formatMetricValue(adapter, metric, target))}"${LOAD_SEMANTICS.has(metric.semantic) ? ` placeholder="${esc(rt("program.editor.week_auto", undefined, "auto"))}"` : ""}` +
            ` aria-label="${esc(label("metricTargetAria", { cycle: weekTitle, set: setTitle, metric: metricLabel(adapter, metric) }))}">`;
        }).join("");
        const fieldCell = (field, fieldLabel) => {
          const diff = differsAt(index, value => value?.[field] ?? null);
          return `<input class="program-editor-a__cell${diff ? " is-diff" : ""}" type="text" inputmode="numeric" autocomplete="off" data-role="prescription-field" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" data-cycle-index="${cycle.cycleIndex}" data-set-index="${set.setIndex}" data-field="${field}" value="${set[field] == null ? "" : esc(String(set[field]))}" aria-label="${esc(label("prescriptionFieldAria", { cycle: weekTitle, set: setTitle, field: fieldLabel }))}">`;
        };
        return `<span class="program-editor-a__setn num">${index + 1}</span>${metricCells}${fieldCell("rir", label("metricRir"))}${fieldCell("restSeconds", rt("program.editor.week_rest", undefined, "Rest"))}`;
      }).join("");
      const columns = definitions.length + 3;
      return `<div class="program-editor-a__weekbody" data-role="week-body" data-cycle-index="${cycle.cycleIndex}">` +
        `<div class="program-editor-a__grid" style="--program-editor-a-columns:${columns - 1}">${header}${cells}</div>` +
        `<div class="program-editor-a__weektools">` +
          `<button type="button" class="text-link" data-role="week-sets" data-cycle-index="${cycle.cycleIndex}" data-delta="1">${icon("plus")}${esc(rt("program.editor.week_add_set", { n: cycle.cycleIndex }, `Add a set to week ${cycle.cycleIndex}`))}</button>` +
          (cycle.sets.length > 1 ? `<button type="button" class="text-link" data-role="week-sets" data-cycle-index="${cycle.cycleIndex}" data-delta="-1">${esc(rt("program.editor.week_remove_set", { n: cycle.cycleIndex }, `Remove the last set from week ${cycle.cycleIndex}`))}</button>` : "") +
        `</div>` +
        `<p class="review-sheet__note">${esc(rt("program.editor.week_legend", undefined, "Outlined: differs from the other weeks. Empty load: Taurifer suggests it."))}</p>` +
        (reference && weekPattern(reference) !== weekPattern(cycle) ? `<button type="button" class="text-link" data-role="week-match" data-cycle-index="${cycle.cycleIndex}">${esc(rt("program.editor.week_match", undefined, "Match the other weeks"))}</button>` : "") +
        `</div>`;
    }
    function weeksSheetHtml(exercise) {
      const slot = slotOfExercise(exercise);
      if (!slot) return "";
      const common = commonWeek(slot), differs = differingWeeks(slot), open = view.sheet?.open ?? null;
      const name = exerciseDisplayLabel(adapter, exercise);
      const subtitle = differs.length
        ? rt(differs.length === 1 ? "program.editor.weeks_differ_one" : "program.editor.weeks_differ", { n: differs.length }, `${differs.length} weeks differ`)
        : rt("program.editor.weeks_same", { n: cyclesOf(slot).length }, "Same in every week");
      return `<div data-pe-sheet="weeks" data-id="${esc(exercise.id)}">` +
        `<button type="button" class="text-link program-editor-a__back" data-role="weeks-back">${icon("chev-left")}${esc(name)}</button>` +
        `<p class="review-sheet__lede">${esc(subtitle)}</p>` +
        cyclesOf(slot).map(cycle => {
          const isOpen = open === cycle.cycleIndex, differ = differs.includes(cycle.cycleIndex);
          return `<div class="program-editor-a__week${isOpen ? " is-open" : ""}">` +
            `<button type="button" class="program-editor-a__weekrow" data-role="week-row" data-cycle-index="${cycle.cycleIndex}" aria-expanded="${isOpen}">` +
            `<span class="program-editor-a__weekname">${esc(rt("program.editor.week", { n: cycle.cycleIndex }, `Week ${cycle.cycleIndex}`))}` +
              (differ ? `<span class="review__mark" data-role="week-differs"><span class="review__dot" aria-hidden="true"></span>${esc(rt("program.editor.week_differs", undefined, "Differs"))}</span>` : "") + `</span>` +
            `<span class="program-editor-a__weeksum">${isOpen ? "" : nums(weekSummary(slot, cycle))}</span>${icon(isOpen ? "chev-up" : "chev-down")}</button>` +
            (isOpen ? weekTableHtml(exercise, slot, cycle, common) : "") + `</div>`;
        }).join("") + `</div>`;
    }
    function substitutionIds(exercise) {
      try {
        const list = adapter.substitutions?.(document, exercise.slotId || exercise.id);
        return Array.isArray(list) ? list.filter(id => typeof id === "string" && id && id !== exercise.libraryId) : [];
      } catch { return []; }
    }
    function swapSheetHtml(exercise) {
      const slot = slotOfExercise(exercise);
      const alternates = (slot?.alternates || []).filter(id => id !== exercise.libraryId);
      const same = substitutionIds(exercise).filter(id => !alternates.includes(id));
      const shown = view.sheet?.showAll ? same : same.slice(0, SUGGESTED_SWAPS);
      const choice = id => `<li>${tile(id, "sm")}<span>${esc(movementLabel(adapter, id))}</span><button type="button" class="btn btn--steel review-sheet__swap-btn" data-role="swap-choice" data-id="${esc(exercise.id)}" data-exercise-id="${esc(id)}">${esc(rt("entry.review.sheet.swap_btn", undefined, "Swap"))}</button></li>`;
      const group = (title, ids, lede = "") => ids.length ? `<section class="review-sheet__sec" data-role="swap-group"><h3 class="sheetgroup__head" data-role="swap-group-title">${esc(title)}</h3>` +
        (lede ? `<p class="review-sheet__lede">${esc(lede)}</p>` : "") + `<ul class="review-sheet__list">${ids.map(choice).join("")}</ul></section>` : "";
      return `<div data-pe-sheet="swap" data-id="${esc(exercise.id)}">` +
        `<button type="button" class="text-link program-editor-a__back" data-role="swap-back">${icon("chev-left")}${esc(exerciseDisplayLabel(adapter, exercise))}</button>` +
        group(rt("program.editor.your_alternates", undefined, "Your alternates"), alternates) +
        group(rt("program.editor.same_job", undefined, "Same job"), shown, rt("entry.review.sheet.swap_lede", undefined, "")) +
        `<div class="review-sheet__links">${!view.sheet?.showAll && same.length > SUGGESTED_SWAPS ? `<button type="button" class="text-link" data-role="swap-more">${esc(rt("entry.review.sheet.show_more", { n: same.length - SUGGESTED_SWAPS }, "Show more"))}</button>` : ""}` +
        `<button type="button" class="text-link" data-role="swap-search" data-id="${esc(exercise.id)}">${icon("search")}${esc(rt("entry.review.sheet.search", undefined, "Search the catalog"))}</button></div></div>`;
    }
    function renameSheetHtml() {
      const sheet = view.sheet, isDay = sheet.target === "day";
      const value = sheet.inputValue ?? (isDay ? titleForDay(sheet.day) : document.programMeta?.name || "");
      const errorAttrs = sheet.error ? ' aria-invalid="true" aria-describedby="programEditorRenameError"' : "";
      return `<div data-pe-sheet="rename"><label class="field review-sheet__field"><span class="field__lab">${esc(isDay ? rt("entry.review.day_name", undefined, label("dayName")) : rt("entry.review.program_name", undefined, label("programName")))}</span>` +
        `<input class="input" id="programEditorRenameInput" data-role="rename-input" maxlength="${isDay ? 40 : 80}" value="${esc(value)}"${errorAttrs} enterkeyhint="done" autocomplete="off"></label>` +
        (sheet.error ? `<p class="program-editor__field-error" id="programEditorRenameError" role="alert">${esc(sheet.error)}</p>` : "") + `</div>`;
    }
    function dayMenuHtml(day) {
      const count = exercisesFor(document, day).length;
      return `<div data-pe-sheet="day-menu" data-day="${esc(day)}"><div class="review-sheet__menu">` +
        `<button type="button" class="exactions__act" data-role="day-action" data-action="rename" data-day="${esc(day)}">${icon("pencil")}<span>${esc(rt("entry.review.day_menu.rename", undefined, "Rename day"))}</span></button>` +
        `<button type="button" class="exactions__act" data-role="day-action" data-action="reorder" data-day="${esc(day)}"${count < 2 ? " disabled" : ""}>${icon("grip")}<span>${esc(rt("entry.review.day_menu.reorder", undefined, "Reorder exercises"))}</span></button>` +
        `<button type="button" class="exactions__act" data-role="day-action" data-action="add" data-day="${esc(day)}">${icon("plus")}<span>${esc(label("addExercise"))}</span></button>` +
        `<button type="button" class="exactions__act" data-role="day-action" data-action="days" data-day="${esc(day)}">${icon("grip")}<span>${esc(rt("program.days_label", undefined, "Training days"))}</span></button>` +
        `<button type="button" class="exactions__act" data-role="day-action" data-action="add-day" data-day="${esc(day)}">${icon("plus")}<span>${esc(String(rt("program.add_day", undefined, "Add day")).replace(/^\s*[+＋]\s*/, ""))}</span></button>` +
        `<button type="button" class="exactions__act exactions__act--danger" data-role="day-action" data-action="remove-day" data-action-role="removal" data-day="${esc(day)}">${icon("close")}<span>${esc(label("removeDay", undefined, "Remove day"))}</span></button>` +
        `</div></div>`;
    }
    function daysSheetHtml() {
      const days = labels(document);
      return `<div data-pe-sheet="days"><p class="review-sheet__lede">${esc(rt("program.editor.days_hint", undefined, ""))}</p>` +
        `<ol class="review__reorder program-editor-a__days" data-role="days-list">` +
        days.map((day, index) => {
          const name = titleFor(day, index), count = exercisesFor(document, day).length;
          return `<li class="review__ro" data-role="days-row" data-day="${esc(day)}">` +
            `<button type="button" class="review__handle" data-role="day-handle" data-day="${esc(day)}" aria-label="${esc(label("move", undefined, name))}">${icon("grip")}</button>` +
            `<button type="button" class="program-editor-a__dayrename" data-role="days-rename" data-day="${esc(day)}" aria-label="${esc(rt("entry.review.rename_day_aria", { day: name }, `Rename ${name}`))}">` +
              `<span class="review__ro-name">${esc(name)}</span><span class="review-sheet__note">${nums(count ? dayCount(count) : rt("program.editor.no_exercises", undefined, "No exercises"))}</span></button>` +
            `<button type="button" class="review__ro-btn" data-role="day-move" data-day="${esc(day)}" data-delta="-1" aria-label="${esc(rt("entry.review.move_up", { name }, `Move ${name} up`))}"${index === 0 ? " disabled" : ""}>${icon("chev-up")}</button>` +
            `<button type="button" class="review__ro-btn" data-role="day-move" data-day="${esc(day)}" data-delta="1" aria-label="${esc(rt("entry.review.move_down", { name }, `Move ${name} down`))}"${index === days.length - 1 ? " disabled" : ""}>${icon("chev-down")}</button>` +
            `</li>`;
        }).join("") + `</ol>` +
        `<div class="review-sheet__links"><button type="button" class="text-link" data-role="days-add">${icon("plus")}${esc(String(rt("program.add_day", undefined, "Add day")).replace(/^\s*[+＋]\s*/, ""))}</button></div></div>`;
    }
    function moveDay(day, toIndex, { focus = null } = {}) {
      return userAction([doc => {
        const next = clone(doc), moved = moveDayInDocument(next, day, toIndex);
        if (!moved) return null;
        return { next, edit: { kind: "day_move", targetDay: day, ...moved } };
      }]).then(result => {
        if (focus) {
          const parts = sheetParts();
          (parts?.body?.querySelector(focus) || parts?.body?.querySelector(`[data-role="day-move"][data-day="${cssEscape(day)}"]:not([disabled])`))?.focus({ preventScroll: true });
        }
        return result;
      });
    }
    function paintSheet() {
      const sheet = view.sheet, parts = sheetParts();
      if (!sheet || !parts || destroyed) return;
      const done = `<button type="button" class="btn btn--cta btn--noarrow" data-role="sheet-done">${esc(rt("entry.review.sheet.done", undefined, "Done"))}</button>`;
      const live = liveEditSnapshot(parts.el);
      if (sheet.kind === "exercise" || sheet.kind === "weeks" || sheet.kind === "swap") {
        const exercise = exerciseById(sheet.id);
        if (!exercise) { closeSheetView(); return; }
        parts.title.textContent = sheet.kind === "weeks" ? rt("program.editor.weeks", undefined, "Weeks")
          : sheet.kind === "swap" ? rt("entry.review.sheet.swap", undefined, label("replaceExercise")) : exerciseDisplayLabel(adapter, exercise);
        parts.body.innerHTML = sheet.kind === "weeks" ? weeksSheetHtml(exercise) : sheet.kind === "swap" ? swapSheetHtml(exercise) : exerciseSheetHtml(exercise);
        parts.foot.innerHTML = sheet.kind === "swap" ? "" : done;
      } else if (sheet.kind === "rename") {
        parts.title.textContent = sheet.target === "day" ? rt("entry.review.day_menu.rename", undefined, "Rename day") : rt("entry.review.rename_program", undefined, "Rename program");
        parts.body.innerHTML = renameSheetHtml();
        parts.foot.innerHTML = `<button type="button" class="btn btn--cta btn--noarrow" data-role="rename-save">${esc(rt("entry.review.save", undefined, "Save"))}</button>`;
      } else if (sheet.kind === "day-menu") {
        parts.title.textContent = titleForDay(sheet.day);
        parts.body.innerHTML = dayMenuHtml(sheet.day);
        parts.foot.innerHTML = "";
      } else if (sheet.kind === "days") {
        parts.title.textContent = rt("program.days_label", undefined, "Training days");
        parts.body.innerHTML = daysSheetHtml();
        parts.foot.innerHTML = done;
      }
      restoreLiveEdit(live, parts.el);
    }

    // ----- what each control does -----
    function stepSets(exercise, delta) {
      const slot = slotOfExercise(exercise);
      if (!slot) return userAction([doc => {
        const next = clone(doc), row = next.program?.find(item => item.id === exercise.id);
        if (!row) return null;
        const before = positiveInt(row.sets, 1), after = Math.max(1, Math.min(MAX_REVIEW_SETS, before + delta));
        if (before === after) return null;
        row.sets = after;
        return { next, edit: { kind: "prescription", targetId: exercise.id, field: "sets", before, after } };
      }]);
      const shownCycle = displayCycle(slot), shown = shownCycle?.sets?.length || 0;
      const wanted = Math.max(1, Math.min(MAX_REVIEW_SETS, shown + delta));
      if (!shown || wanted === shown) return Promise.resolve(false);
      const deload = count => Math.max(1, Math.ceil(count / 2));
      return userAction(weekOrder(slot).map(cycleIndex => doc => {
        const currentSlot = definitionSlot(doc, slot.id), cycle = definitionCycle(currentSlot, cycleIndex);
        if (!cycle) return null;
        const reduced = isDeloadCycle(currentSlot, cycle) && !(shownCycle && isDeloadCycle(slot, shownCycle));
        if (cycle.sets.length !== (reduced ? deload(shown) : shown)) return null;
        return buildSetsChange(doc, exercise.id, cycleIndex, reduced ? deload(wanted) : wanted);
      }));
    }
    function stepRange(exercise, bound, delta) {
      const slot = slotOfExercise(exercise), rep = slot ? repDefinition(slot) : null;
      const shown = rep ? rangeOf(displayCycle(slot)?.sets?.[0]?.targets?.[rep.semantic]) : null;
      if (!shown) return Promise.resolve(false);
      const next = { ...shown, [bound]: shown[bound] + delta };
      if (next.min < 1 || next.max > MAX_REVIEW_REPS || next.max < next.min) return Promise.resolve(false);
      const value = next.min === next.max && Number.isFinite(displayCycle(slot)?.sets?.[0]?.targets?.[rep.semantic]) ? next.min : { min: next.min, max: next.max };
      const steps = [];
      for (const cycleIndex of weekOrder(slot)) {
        for (const set of definitionCycle(slot, cycleIndex)?.sets || []) {
          steps.push(doc => {
            const current = definitionSet(doc, slot.id, cycleIndex, set.setIndex);
            if (!current || !equal(rangeOf(current.targets?.[rep.semantic]), shown)) return null;
            return buildTargetChange(doc, slot.id, cycleIndex, set.setIndex, rep.id, { present: true, value });
          });
        }
      }
      return userAction(steps);
    }
    function stepRir(exercise, setIndex, delta) {
      const slot = slotOfExercise(exercise);
      const shownCycle = slot ? displayCycle(slot) : null, shownSet = shownCycle?.sets?.[setIndex - 1];
      if (!shownSet) return Promise.resolve(false);
      const shown = Number.isFinite(shownSet.rir) ? shownSet.rir : null;
      const after = Math.max(0, Math.min(MAX_REVIEW_RIR, (shown ?? 2) + delta));
      if (Object.is(shown, after)) return Promise.resolve(false);
      const shownIsDeload = isDeloadCycle(slot, shownCycle);
      return userAction(weekOrder(slot).map(cycleIndex => doc => {
        const currentSlot = definitionSlot(doc, slot.id), cycle = definitionCycle(currentSlot, cycleIndex);
        const set = cycle?.sets?.[setIndex - 1];
        if (!set) return null;
        const offset = isDeloadCycle(currentSlot, cycle) && !shownIsDeload;
        const expected = shown == null ? null : offset ? Math.min(MAX_REVIEW_RIR, shown + 2) : shown;
        if (!Object.is(Number.isFinite(set.rir) ? set.rir : null, expected)) return null;
        return buildFieldChange(doc, slot.id, cycleIndex, set.setIndex, "rir", offset ? Math.min(MAX_REVIEW_RIR, after + 2) : after);
      }));
    }
    function setRest(exercise, seconds) {
      const slot = slotOfExercise(exercise), shownSet = slot ? displayCycle(slot)?.sets?.[0] : null;
      if (!shownSet) return Promise.resolve(false);
      const shown = shownSet.restSeconds ?? null;
      if (shown === seconds) return Promise.resolve(false);
      const steps = [];
      for (const cycleIndex of weekOrder(slot)) for (const set of definitionCycle(slot, cycleIndex)?.sets || []) {
        steps.push(doc => {
          const current = definitionSet(doc, slot.id, cycleIndex, set.setIndex);
          if (!current || !Object.is(current.restSeconds ?? null, shown)) return null;
          return buildFieldChange(doc, slot.id, cycleIndex, set.setIndex, "restSeconds", seconds);
        });
      }
      return userAction(steps);
    }
    function stepWeekSets(exercise, cycleIndex, delta) {
      const slot = slotOfExercise(exercise), cycle = slot ? definitionCycle(slot, cycleIndex) : null;
      if (!cycle) return Promise.resolve(false);
      return userAction([doc => buildSetsChange(doc, exercise.id, cycleIndex, cycle.sets.length + delta)]);
    }
    function matchWeek(exercise, cycleIndex) {
      const slot = slotOfExercise(exercise), common = slot ? commonWeek(slot) : null;
      if (!common || common.cycleIndex === cycleIndex) return Promise.resolve(false);
      const model = clone(common.sets || []);
      const steps = [doc => buildSetsChange(doc, exercise.id, cycleIndex, model.length)];
      model.forEach((source, index) => {
        const setIndex = index + 1;
        for (const metricId of slot.metricIds || []) {
          const metric = (slot.metricDefinitions || []).find(item => item.id === metricId);
          if (!metric) continue;
          steps.push(doc => buildTargetChange(doc, slot.id, cycleIndex, setIndex, metricId,
            hasOwn(source.targets, metric.semantic) ? { present: true, value: clone(source.targets[metric.semantic]) } : { present: false, value: null }));
        }
        steps.push(doc => buildFieldChange(doc, slot.id, cycleIndex, setIndex, "rir", source.rir ?? null));
        steps.push(doc => buildFieldChange(doc, slot.id, cycleIndex, setIndex, "restSeconds", source.restSeconds ?? null));
      });
      return userAction(steps);
    }
    function parseCell(input) {
      const raw = String(input.value || "").trim();
      if (input.dataset.role === "prescription-field") {
        if (!raw) return { ok: true, value: null };
        const value = Number(raw.replace(",", "."));
        const valid = input.dataset.field === "rir" ? Number.isFinite(value) && value >= 0 && value <= MAX_REVIEW_RIR
          : Number.isSafeInteger(value) && value >= 0 && value <= 86400;
        return valid ? { ok: true, value } : { ok: false };
      }
      const slot = definitionSlot(document, input.dataset.slotId);
      const definition = slot?.metricDefinitions?.find(item => item.id === input.dataset.metricId);
      if (!definition) return { ok: false };
      if (!raw) return { ok: true, value: { present: false, value: null } };
      if (input.dataset.bound === "range") {
        const parts = raw.split(/\s*[–—-]\s*/).filter(Boolean);
        if (parts.length < 1 || parts.length > 2) return { ok: false };
        const parsed = parts.map(part => parseMetricInput(adapter, definition, part));
        if (parsed.some(item => !hasOwn(item, "value") || item.value == null)) return { ok: false };
        const min = parsed[0].value, max = parsed[parsed.length - 1].value;
        if (max < min) return { ok: false };
        return { ok: true, value: { present: true, value: { min, max } } };
      }
      const parsed = parseMetricInput(adapter, definition, raw);
      return hasOwn(parsed, "value") && parsed.value != null ? { ok: true, value: { present: true, value: parsed.value } } : { ok: false };
    }
    function editCell(input) {
      setFieldError(input, null);
      const parsed = parseCell(input);
      if (!parsed.ok) { setFieldError(input, label("invalid")); return Promise.resolve(false); }
      const slotId = input.dataset.slotId, cycleIndex = Number(input.dataset.cycleIndex), setIndex = Number(input.dataset.setIndex);
      const step = input.dataset.role === "prescription-field"
        ? doc => buildFieldChange(doc, slotId, cycleIndex, setIndex, input.dataset.field, parsed.value)
        : doc => buildTargetChange(doc, slotId, cycleIndex, setIndex, input.dataset.metricId, parsed.value);
      if (!step(document)) {
        // Unchanged, or refused (an adaptive set can't lose its range or RIR): show what is stored.
        const unchanged = input.dataset.role === "prescription-field"
          ? Object.is(definitionSet(document, slotId, cycleIndex, setIndex)?.[input.dataset.field] ?? null, parsed.value)
          : equal(parsed.value, (() => { const set = definitionSet(document, slotId, cycleIndex, setIndex); return set && hasOwn(set.targets, input.dataset.semantic) ? { present: true, value: set.targets[input.dataset.semantic] } : { present: false, value: null }; })());
        if (!unchanged) setFieldError(input, label("invalid"));
        return Promise.resolve(false);
      }
      return userAction([step]);
    }
    function stepOptInRir(slotId, delta) {
      const slot = definitionSlot(document, slotId);
      if (!slot) return Promise.resolve(false);
      const current = uniformRir(slot);
      const after = Math.max(0, Math.min(MAX_OPT_IN_RIR, (current ?? 2) + delta));
      const before = slotSets(slot).map(set => set.rir ?? null);
      if (before.every(value => Object.is(value, after))) return Promise.resolve(false);
      return userAction([doc => {
        const next = clone(doc);
        if (!setSlotRir(next, slotId, after)) return null;
        return { next, edit: { kind: "suggest_loads_rir", slotId, before, after } };
      }]);
    }
    function swapTo(exercise, libraryId) {
      const entry = exerciseEntry(adapter, libraryId);
      if (!entry) return Promise.resolve(false);
      const name = movementLabel(adapter, libraryId);
      return recorded(() => {
        const next = clone(document);
        if (!replaceExercise(next, exercise.id, entry)) return Promise.resolve({ ok: false });
        const replacement = next.program?.find(item => item.id === exercise.id);
        return stage(next, { kind: "exercise_replace", targetId: exercise.id, beforeLibraryId: exercise.libraryId, afterLibraryId: libraryId, exercise: replacement }, { redraw: false });
      }, { toast: rt("entry.review.toast.swapped", { name }, `${name} is now in the program.`) }).then(result => {
        if (view.sheet) openSheetView({ kind: "exercise", id: exercise.id });
        return result;
      });
    }
    /** Saves the open rename sheet, or a name Back set aside (`held`) without reopening its sheet. */
    async function saveRename(held = null) {
      const parts = sheetParts(), input = parts?.body?.querySelector('[data-role="rename-input"]');
      const sheet = held ? { kind: "rename", ...held } : view.sheet;
      const value = String((held ? held.value : input?.value) || "").trim();
      if (!sheet) return;
      if (sheet.target === "day") {
        const day = sheet.day;
        if (!value || value === titleForDay(day) || value === day) { await closeSheetView(); return; }
        const result = await recorded(() => renameDay(day, value));
        if (result?.refused && held) {
          heldRename = { ...held, error: result.duplicate ? label("dayNameExists") : label("invalid") };
          return false;
        }
        if (result?.refused) {
          view.sheet = { ...sheet, inputValue: value, error: result.duplicate ? label("dayNameExists") : label("invalid") };
          paintSheet();
          const next = sheetParts()?.body?.querySelector('[data-role="rename-input"]');
          try { next?.focus({ preventScroll: true }); next?.setSelectionRange?.(value.length, value.length); } catch { /* not focusable */ }
          return;
        }
        if (view.tab === day) view.tab = value;
        if (sheet.back === "days") { openSheetView({ kind: "days" }); render(); return; }
        await closeSheetView();
        render();
        return;
      }
      await closeSheetView();
      const before = document.programMeta?.name || "";
      if (value === before) return;
      return userAction([doc => {
        const next = clone(doc);
        next.programMeta = { ...(next.programMeta || {}), name: value };
        return { next, edit: { kind: "program_name", before, after: value } };
      }]);
    }
    /* The picker is the lifter's to answer, and may leave for the full library
       and come back without an answer: only the staging joins the queue. */
    function reviewAdd(day) {
      return pickForAdd(day).then(entry => entry ? recorded(() => stageAdd(day, entry)) : null);
    }
    /* #445: a name typed in the open rename sheet is an unsaved edit until Save. Browser Back
       does not blur it first, so the host asks about it through isDirty, and Apply saves it. */
    function pendingRename() {
      if (view.sheet?.kind !== "rename") return null;
      const value = String(sheetParts()?.body?.querySelector('[data-role="rename-input"]')?.value ?? view.sheet.inputValue ?? "").trim();
      const current = view.sheet.target === "day" ? titleForDay(view.sheet.day) : String(document.programMeta?.name || "");
      return value && value !== current && !(view.sheet.target === "day" && value === view.sheet.day) ? value : null;
    }
    async function flushPendingRename() {
      if (heldRename) {
        // Back set the sheet aside; a refused name is held again with its reason.
        const held = heldRename;
        heldRename = null;
        return (await saveRename(held)) !== false;
      }
      if (!pendingRename()) return true;
      await saveRename();
      // A refused name keeps the sheet open with its reason; Apply waits for it.
      return view.sheet?.kind === "rename" ? false : true;
    }
    /** Browser Back over a typed, unsaved name: keep the text, close the sheet so the host can ask. */
    function holdPendingRename() {
      const value = pendingRename();
      if (!value) return null;
      heldRename = { target: view.sheet.target, day: view.sheet.day, value };
      return closeSheetView();
    }
    function resumePendingRename() {
      if (!heldRename) return;
      const held = heldRename;
      heldRename = null;
      openSheetView({ kind: "rename", target: held.target, day: held.day, inputValue: held.value, ...(held.error ? { error: held.error } : {}) },
        { focus: '[data-role="rename-input"]' });
    }
    /** Resolves once no modal (the picker, say) is open or closing. */
    function afterModals() {
      return new Promise(resolve => {
        try { if (typeof adapter.afterModal === "function") { adapter.afterModal(resolve); return; } } catch { /* resolve now */ }
        resolve();
      });
    }
    function requestApply() {
      if (validation(document).length) { render(); return; }
      try { if (typeof adapter.done === "function") { adapter.done(); return; } } catch { /* fall through */ }
      apply();
    }

    function onReviewClick(event) {
      const target = event.target instanceof Element ? event.target : null;
      const hit = selector => target?.closest(selector);
      let el;
      if ((el = hit('[data-role="day-tab"]'))) { view.tab = el.dataset.day; view.reorderDay = null; render(); host.querySelector(`[data-role="day-tab"][data-day="${cssEscape(view.tab)}"]`)?.focus(); return; }
      if (hit('[data-role="undo"]')) { undoLast(); return; }
      if (hit('[data-role="apply"]')) { requestApply(); return; }
      if (hit('[data-role="program-name-edit"]')) { openSheetView({ kind: "rename", target: "program" }, { focus: '[data-role="rename-input"]' }); return; }
      if ((el = hit('[data-role="day-name-edit"]'))) { openSheetView({ kind: "rename", target: "day", day: el.dataset.day }, { focus: '[data-role="rename-input"]' }); return; }
      if ((el = hit('[data-role="day-menu"]'))) { openSheetView({ kind: "day-menu", day: el.dataset.day }); return; }
      if ((el = hit('[data-role="add-exercise"]'))) { reviewAdd(el.dataset.day); return; }
      if (hit('[data-role="reorder-done"]')) { view.reorderDay = null; render(); host.querySelector('[data-role="day-menu"]')?.focus(); return; }
      if ((el = hit('[data-role="reorder-move"]'))) {
        const exercise = exerciseById(el.dataset.id), delta = Number(el.dataset.delta);
        if (!exercise) return;
        const list = exercisesFor(document, exercise.day), index = list.findIndex(item => item.id === exercise.id), to = index + delta;
        if (to < 0 || to >= list.length) return;
        recorded(() => moveExercise(exercise.id, exercise.day, to, { announce: false })).then(() => {
          (host.querySelector(`[data-role="reorder-move"][data-id="${cssEscape(exercise.id)}"][data-delta="${delta}"]:not([disabled])`) ||
            host.querySelector(`[data-role="reorder-move"][data-id="${cssEscape(exercise.id)}"][data-delta="${-delta}"]`))?.focus({ preventScroll: true });
        });
        return;
      }
      if ((el = hit('[data-role="exercise-row"]'))) openSheetView({ kind: "exercise", id: el.dataset.id });
    }
    function onReviewKey(event) {
      const target = event.target instanceof Element ? event.target : null;
      const row = target?.closest?.('[data-role="exercise-row"]');
      if (row && target === row && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openSheetView({ kind: "exercise", id: row.dataset.id }); return; }
      const tab = target?.closest?.('[data-role="day-tab"]');
      if (tab && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        event.preventDefault();
        const days = labels(document), index = days.indexOf(view.tab) + (event.key === "ArrowRight" ? 1 : -1);
        if (index < 0 || index >= days.length) return;
        view.tab = days[index];
        render();
        host.querySelector(`[data-role="day-tab"][data-day="${cssEscape(view.tab)}"]`)?.focus();
      }
    }
    function onSheetClick(event) {
      const sheet = view.sheet;
      if (!sheet) return;
      const target = event.target instanceof Element ? event.target : null;
      const hit = selector => target?.closest(selector);
      let el;
      if (hit('[data-role="sheet-done"]')) { closeSheetView(); return; }
      if (sheet.kind === "rename") { if (hit('[data-role="rename-save"]')) saveRename(); return; }
      if (sheet.kind === "days") {
        if ((el = hit('[data-role="day-move"]'))) {
          const day = el.dataset.day, delta = Number(el.dataset.delta), index = labels(document).indexOf(day);
          moveDay(day, index + delta, { focus: `[data-role="day-move"][data-day="${cssEscape(day)}"][data-delta="${delta}"]:not([disabled])` });
          return;
        }
        if ((el = hit('[data-role="days-rename"]'))) { openSheetView({ kind: "rename", target: "day", day: el.dataset.day, back: "days" }, { focus: '[data-role="rename-input"]' }); return; }
        if (hit('[data-role="days-add"]')) {
          userAction([doc => {
            const next = clone(doc), added = appendDay(next);
            return { next, edit: { kind: "day_add", targetDay: added, after: added } };
          }]);
        }
        return;
      }
      if (sheet.kind === "day-menu") {
        const action = hit('[data-role="day-action"]')?.dataset.action, day = sheet.day;
        if (!action) return;
        if (action === "rename") { openSheetView({ kind: "rename", target: "day", day }, { focus: '[data-role="rename-input"]' }); return; }
        if (action === "days") { openSheetView({ kind: "days" }, { focus: '[data-role="day-move"]:not([disabled])' }); return; }
        if (action === "reorder") { closeSheetView().then(() => { view.tab = day; view.reorderDay = day; render(); host.querySelector('[data-role="reorder-move"]:not([disabled])')?.focus({ preventScroll: true }); }); return; }
        if (action === "add") { closeSheetView().then(() => reviewAdd(day)); return; }
        if (action === "add-day") {
          afterSheet(async () => {
            let added = null;
            await userActionTask([doc => {
              const next = clone(doc);
              added = appendDay(next);
              return { next, edit: { kind: "day_add", targetDay: added, after: added } };
            }]);
            if (added && labels(document).includes(added)) view.tab = added;
          });
          return;
        }
        if (action === "remove-day") {
          if (typeof adapter.confirm === "function" && !adapter.confirm({ kind: "day_remove", day })) return;
          afterSheet(() => userActionTask([doc => {
            const next = clone(doc);
            removeDayFromDocument(next, day);
            return { next, edit: { kind: "day_remove", targetDay: day } };
          }]));
        }
        return;
      }
      const exercise = exerciseById(sheet.id);
      if (!exercise) return;
      if (sheet.kind === "weeks") {
        if (hit('[data-role="weeks-back"]')) { openSheetView({ kind: "exercise", id: exercise.id }, { focus: '[data-role="weeks-open"]' }); return; }
        if ((el = hit('[data-role="week-row"]'))) {
          const index = Number(el.dataset.cycleIndex);
          view.sheet = { ...sheet, open: sheet.open === index ? null : index };
          paintSheet();
          sheetParts()?.body?.querySelector(`[data-role="week-row"][data-cycle-index="${index}"]`)?.focus({ preventScroll: true });
          return;
        }
        if ((el = hit('[data-role="week-sets"]'))) { stepWeekSets(exercise, Number(el.dataset.cycleIndex), Number(el.dataset.delta)); return; }
        if ((el = hit('[data-role="week-match"]'))) { matchWeek(exercise, Number(el.dataset.cycleIndex)); return; }
        return;
      }
      if (sheet.kind === "swap") {
        if (hit('[data-role="swap-back"]')) { openSheetView({ kind: "exercise", id: exercise.id }, { focus: '[data-role="swap-open"]' }); return; }
        if (hit('[data-role="swap-more"]')) { view.sheet = { ...sheet, showAll: true }; paintSheet(); return; }
        if ((el = hit('[data-role="swap-choice"]'))) { swapTo(exercise, el.dataset.exerciseId); return; }
        if (hit('[data-role="swap-search"]')) {
          closeSheetView().then(() => pickReplacement(exercise.id))
            .then(choice => choice ? recorded(() => stageReplacement(exercise.id, choice)) : null);
        }
        return;
      }
      if ((el = hit('[data-role="sets-step"]'))) { stepSets(exercise, Number(el.dataset.delta)); return; }
      if ((el = hit('[data-role="range-step"]'))) { stepRange(exercise, el.dataset.bound, Number(el.dataset.delta)); return; }
      if ((el = hit('[data-role="rir-step"]'))) { stepRir(exercise, Number(el.dataset.setIndex), Number(el.dataset.delta)); return; }
      if ((el = hit('[data-role="rest-preset"]'))) { setRest(exercise, Number(el.dataset.seconds)); return; }
      if (hit('[data-role="weeks-open"]')) { openSheetView({ kind: "weeks", id: exercise.id, open: null }, { focus: '[data-role="weeks-back"]' }); return; }
      if (hit('[data-role="swap-open"]')) { openSheetView({ kind: "swap", id: exercise.id, showAll: false }, { focus: '[data-role="swap-back"]' }); return; }
      if ((el = hit('[data-role="suggest-loads"]'))) { recorded(() => toggleSuggestLoads(el)); return; }
      if ((el = hit('[data-role="suggest-loads-rir-step"]'))) { stepOptInRir(el.dataset.slotId, Number(el.dataset.delta)); return; }
      if ((el = hit('[data-role="execution-mode"]'))) { recorded(() => editExecutionMode(el)); return; }
      if ((el = hit('[data-role="add-alternate"]'))) {
        // The picker is its own modal: the sheet steps aside for it and comes back with the choice.
        closeSheetView()
          .then(() => pickAlternate(exercise.id))
          .then(choice => choice ? recorded(() => stageAlternate(exercise.id, choice)) : null)
          .then(afterModals)
          .then(() => { if (!destroyed && exerciseById(exercise.id)) openSheetView({ kind: "exercise", id: exercise.id }); });
        return;
      }
      if ((el = hit('[data-role="alternate-up"],[data-role="alternate-down"],[data-role="alternate-remove"]'))) {
        recorded(() => editAlternate(exercise.id, el.dataset.exerciseId, el.dataset.role));
        return;
      }
      if ((el = hit('[data-role="move-to-day"]'))) {
        const day = el.dataset.day, name = titleForDay(day);
        afterSheet(() => recordedTask(() => moveExercise(exercise.id, day, exercisesFor(document, day).length, { announce: false }),
          { toast: rt("entry.review.toast.moved", { day: name }, `Moved to ${name}.`) }));
        return;
      }
      if (hit('[data-role="remove-exercise"]')) {
        const name = exerciseDisplayLabel(adapter, exercise);
        afterSheet(() => recordedTask(() => removeExercise(exercise.id),
          { toast: rt("entry.review.toast.removed", { name }, `Removed ${name}.`) }));
      }
    }
    function onSheetChange(event) {
      if (!view.sheet) return;
      const input = event.target instanceof Element ? event.target : null;
      if (!input) return;
      const role = input.dataset.role;
      if (role === "metric-target" || role === "prescription-field") { editCell(input); return; }
      if (role === "load-step") { recorded(() => editLoadStep(input)); return; }
      if (role === "metric-composition") { recorded(() => editMetricComposition(input)); return; }
      if (role === "exercise-field") {
        const field = input.dataset.field, text = String(input.value || "");
        if (field === "name" && !text.trim()) { input.value = exerciseName(adapter, exerciseById(input.dataset.id)); return; }
        recorded(() => setExerciseField(input.dataset.id, field, ["name", "notes", "primary", "secondary"].includes(field) ? text.trim() : text, { redraw: false }));
      }
    }
    function onSheetKey(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (view.sheet?.kind === "rename" && event.key === "Enter" && target?.dataset.role === "rename-input") { event.preventDefault(); saveRename(); return; }
      if (event.key === "Enter" && (target?.dataset.role === "metric-target" || target?.dataset.role === "prescription-field" || target?.dataset.role === "load-step")) {
        event.preventDefault();
        target.blur();
      }
    }
    function onSheetInput(event) {
      const input = event.target instanceof Element ? event.target : null;
      if (view.sheet?.kind !== "rename" || input?.dataset.role !== "rename-input") return;
      view.sheet.inputValue = input.value;
      if (!view.sheet.error) return;
      view.sheet.error = null;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      sheetParts()?.body?.querySelector("#programEditorRenameError")?.remove();
    }
    /* The handle drag of onboarding's reorder list, for the days: the row follows
       the pointer, the rows it passes make room, the drop is one day_move. The
       arrows are the accessible path to the same move. */
    let dayDrag = null;
    function onSheetPointerDown(event) {
      const handle = event.target instanceof Element ? event.target.closest('[data-role="day-handle"]') : null;
      if (!handle || view.sheet?.kind !== "days") return;
      event.preventDefault();
      // The sheet's drag-to-dismiss listens on the document; a day drag is not a dismiss.
      event.stopPropagation();
      const rows = [...handle.closest('[data-role="days-list"]').querySelectorAll('[data-role="days-row"]')];
      const row = handle.closest('[data-role="days-row"]');
      dayDrag = { id: event.pointerId, row, rows, from: rows.indexOf(row), to: rows.indexOf(row), y0: event.clientY, h: row.offsetHeight || 1 };
      row.classList.add("is-lifted");
      handle.setPointerCapture?.(event.pointerId);
    }
    function onSheetPointerMove(event) {
      if (!dayDrag || event.pointerId !== dayDrag.id) return;
      const dy = event.clientY - dayDrag.y0;
      dayDrag.row.style.transform = `translate3d(0,${dy}px,0)`;
      dayDrag.to = Math.max(0, Math.min(dayDrag.rows.length - 1, dayDrag.from + Math.round(dy / dayDrag.h)));
      dayDrag.rows.forEach((row, index) => {
        if (row === dayDrag.row) return;
        const shift = dayDrag.from < dayDrag.to && index > dayDrag.from && index <= dayDrag.to ? -dayDrag.h
          : dayDrag.from > dayDrag.to && index < dayDrag.from && index >= dayDrag.to ? dayDrag.h : 0;
        row.style.transform = shift ? `translate3d(0,${shift}px,0)` : "";
      });
    }
    function onSheetPointerUp(event) {
      if (!dayDrag || event.pointerId !== dayDrag.id) return;
      const { rows, row, from, to } = dayDrag;
      dayDrag = null;
      rows.forEach(item => { item.style.transform = ""; });
      row.classList.remove("is-lifted");
      if (event.type === "pointercancel" || to === from) return;
      moveDay(row.dataset.day, to);
    }
    let reviewSheetEl = null;
    function mountReviewLayout() {
      host.addEventListener("click", onReviewClick);
      host.addEventListener("keydown", onReviewKey);
      reviewSheetEl = sheetParts()?.el || null;
      reviewSheetEl?.addEventListener("click", onSheetClick);
      reviewSheetEl?.addEventListener("change", onSheetChange);
      reviewSheetEl?.addEventListener("keydown", onSheetKey);
      reviewSheetEl?.addEventListener("input", onSheetInput);
      reviewSheetEl?.addEventListener("pointerdown", onSheetPointerDown);
      reviewSheetEl?.addEventListener("pointermove", onSheetPointerMove);
      reviewSheetEl?.addEventListener("pointerup", onSheetPointerUp);
      reviewSheetEl?.addEventListener("pointercancel", onSheetPointerUp);
    }
    function unmountReviewLayout() {
      host.removeEventListener("click", onReviewClick);
      host.removeEventListener("keydown", onReviewKey);
      reviewSheetEl?.removeEventListener("click", onSheetClick);
      reviewSheetEl?.removeEventListener("change", onSheetChange);
      reviewSheetEl?.removeEventListener("keydown", onSheetKey);
      reviewSheetEl?.removeEventListener("input", onSheetInput);
      reviewSheetEl?.removeEventListener("pointerdown", onSheetPointerDown);
      reviewSheetEl?.removeEventListener("pointermove", onSheetPointerMove);
      reviewSheetEl?.removeEventListener("pointerup", onSheetPointerUp);
      reviewSheetEl?.removeEventListener("pointercancel", onSheetPointerUp);
      reviewSheetEl = null;
      hideToast();
      if (view.sheet) { view.sheet = null; try { adapter.closeSheet?.(); } catch { /* already closed */ } }
    }

    if (reviewLayout) mountReviewLayout();
    render();
    return {
      refresh,
      dispose() { destroyed = true; if (reviewLayout) unmountReviewLayout(); teardownSorting(); if (statusTimer) clearTimeout(statusTimer); host.classList.remove("program-editor-host"); host.dataset.editorMounted = "false"; host.replaceChildren(); },
      getDocument: () => clone(document),
      getToken: () => clone(token),
      isDirty: () => edits.length > 0 || changed() || (reviewLayout && (!!pendingRename() || !!heldRename)),
      holdPendingRename: () => (reviewLayout ? holdPendingRename() : null),
      resumePendingRename: () => { if (reviewLayout) resumePendingRename(); },
      validationIssues: () => validation(document),
      checkSuggestLoads,
      commit: apply,
      discard,
      replaceExercise: exerciseInstanceId => replaceForExercise(exerciseInstanceId, { repair: true }),
    };
  }

  return { mountProgramEditor, PROGRAM_EDITOR_INTENTS, confirmSuggestLoads, suggestLoadsIssues, setSuggestLoads, setSlotRir, reorderTrainingDays, dayOrderConflict };
});
