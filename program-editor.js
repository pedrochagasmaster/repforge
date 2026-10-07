(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.mountProgramEditor = api.mountProgramEditor;
  if (root) root.ProgramEditorIntents = api.PROGRAM_EDITOR_INTENTS;
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
    "alternates", "exercise_move", "metric_target", "metric_composition",
    "prescription_field", "load_step", "save_draft", "apply", "apply_discard_workout",
  ]);
  const INTENT_SET = new Set(PROGRAM_EDITOR_INTENTS);
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
    chooseAlternates: "Choose alternates",
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
    secondary: "program.editor.secondary", alternates: "program.editor.alternates", chooseAlternates: "program.editor.choose_alternates",
    move: "program.editor.move", moveUp: "program.editor.move_up", moveDown: "program.editor.move_down",
    moveOther: "program.editor.move_other", moved: "program.editor.moved", undo: "program.editor.undo",
    exerciseAdded: "toast.exercise_added", exerciseChanged: "toast.exercise_changed", exerciseRemoved: "toast.exercise_removed",
    dragInstructions: "program.editor.drag.instructions", dragPickedUp: "program.editor.drag.picked_up",
    dragOver: "program.editor.drag.over", dragDropped: "program.editor.drag.dropped",
    dragCancelled: "program.editor.drag.cancelled",
    invalid: "program.editor.invalid", saved: "program.editor.draft_saved", emptyDays: "program.editor.empty_days",
    more: "program.editor.more", close: "dialog.close",
    metricTargets: "program.editor.metric_targets", metricCycle: "program.editor.metric_cycle",
    metricSet: "program.editor.metric_set", metricComposition: "program.editor.metric_composition",
    metricUnconfigured: "program.editor.metric_unconfigured", metricTargetAria: "program.editor.metric_target_aria",
    metricTargetMinAria: "program.editor.metric_target_min_aria", metricTargetMaxAria: "program.editor.metric_target_max_aria",
    metricRir: "program.editor.metric_rir", loadStep: "program.editor.load_step", loadStepHint: "program.editor.load_step_hint", metricRestSeconds: "program.editor.metric_rest_seconds",
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
    for (const cycle of slot.prescriptionsByCycle || []) for (const set of cycle.sets || []) {
      set.metricIds = clone(metricIds);
      set.metricDefinitions = clone(definitions);
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
    set.status = "manual";
    set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
    const row = (document.program || []).find(candidate => (candidate.slotId || candidate.id) === slotId);
    const slot = definitionSlot(document, slotId);
    if (row && slot) row.prescriptionsByCycle = clone(slot.prescriptionsByCycle || []);
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
  function fieldValue(exercise, field, value) {
    if (field === "sets") return Math.max(1, Math.min(100, positiveInt(value, positiveInt(exercise.sets, 1))));
    if (field === "min") return positiveInt(value, positiveInt(exercise.min, 1));
    if (field === "max") return positiveInt(value, positiveInt(exercise.max, 1));
    if (field === "alternates") return Array.isArray(value) ? value.map(String).filter(Boolean) : String(value || "").split(",").map(item => item.trim()).filter(Boolean);
    return String(value ?? "").trim();
  }
  function entryFields(entry, day, order) {
    return {
      id: uid(), day, order, name: String(entry?.name || entry?.namePt || "Exercise"),
      sets: positiveInt(entry?.sets, 3), min: positiveInt(entry?.min, 6), max: positiveInt(entry?.max, 10),
      primary: String(entry?.primary || ""), secondary: String(entry?.secondary || ""), notes: String(entry?.notes || ""),
      alternates: Array.isArray(entry?.alternates) ? clone(entry.alternates) : [],
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
    const old = { id: exercise.id, day: exercise.day, order: exercise.order, notes: exercise.notes, alternates: exercise.alternates };
    const replacement = entryFields(entry, old.day, old.order);
    // A replacement repoints the slot's movement identity but keeps its
    // authored prescription and notes. Leaving the old movementId behind
    // would make a paired-exposure relation look valid after a swap.
    delete exercise.libraryId; delete exercise.movementId; delete exercise.displayName;
    Object.assign(exercise, {
      name: replacement.name, primary: replacement.primary, secondary: replacement.secondary,
      ...(replacement.libraryId ? { libraryId: replacement.libraryId, movementId: replacement.movementId } : {}),
      notes: old.notes, alternates: old.alternates,
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
        if (!(sets > 0) || !(min > 0) || !(max >= min)) issues.push(`exercise_invalid:${exercise.id}:prescription`);
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

    host.classList.add("program-editor-host");
    host.dataset.editorMounted = "true";
    host.dataset.editorRole = "program-editor";

    const rootElement = () => host;
    const label = (key, vars, fallback) => t(adapter, I18N_KEYS[key] || key, vars, fallback ?? FALLBACK[key]);
    const setStatus = (message, { error = false, undo = false } = {}) => {
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
      if (message && !undo) statusTimer = setTimeout(() => { if (status.isConnected) status.hidden = true; }, 2600);
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
          if (redraw) scheduleRender();
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
      const previous = field === "alternates" ? clone(exercise.alternates || [])
        : field === "sets" && cycle ? cycle.sets.length : exercise[field];
      const normalized = fieldValue(exercise, field, value);
      if (equal(previous, normalized)) return Promise.resolve({ ok: true, unchanged: true });
      if (field === "sets" && cycle) {
        const beforeSetIds = cycle.sets.map(set => set.id), addedSets = [], removedSetIds = [];
        while (cycle.sets.length < normalized) {
          const source = cycle.sets.at(-1);
          if (!source) return Promise.resolve({ ok: false });
          const added = { ...clone(source), id: uid(), cycleIndex, setIndex: cycle.sets.length + 1,
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
      return stage(next, { kind: field === "sets" || field === "min" || field === "max" ? "prescription" : field === "alternates" ? "alternates" : "exercise_field", targetId: id, field, before: previous, after: normalized }, { redraw });
    };
    const toggleExercise = id => { expandedExercises.has(id) ? expandedExercises.delete(id) : expandedExercises.add(id); scheduleRender(); };
    const toggleDay = day => { collapsedDays.has(day) ? collapsedDays.delete(day) : collapsedDays.add(day); scheduleRender(); };
    const chooseExercise = request => {
      try { return Promise.resolve(adapter.chooseExercise?.(request)); }
      catch (error) { setStatus(error?.message || label("invalid"), { error: true }); return Promise.resolve(null); }
    };
    /* A commit that rebuilds the list leaves nothing focused: the row that changed (or, after a remove, the day's
       Add control) takes focus once the rebuild has drawn, and the change is announced once through the host. */
    const announceChange = key => { try { adapter.announce?.(label(key), { change: true }); } catch { /* the focus move still says it */ } };
    const applyPendingFocus = () => {
      const want = pendingFocus; pendingFocus = null;
      if (!want) return;
      const find = selector => host.querySelector(selector);
      const target = want.selector ? find(want.selector) : want.id
        ? (want.roles || ["toggle-exercise"]).map(role => find(`[data-role="${role}"][data-id="${cssEscape(want.id)}"]`)).find(Boolean)
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
    const addForDay = day => chooseExercise({ mode: "add", day, exclude: exercisesFor(document, day).map(item => item.libraryId).filter(Boolean) }).then(entry => {
      if (!entry) return null;
      const next = clone(document), exercise = addExercise(next, day, entry);
      collapsedDays.delete(day); expandedExercises.add(exercise.id);
      pendingFocus = { id: exercise.id };
      return stage(next, { kind: "exercise_add", targetDay: day, targetId: exercise.id, libraryId: entry.id, exercise: exercise }).then(value => {
        if (value?.ok !== false) announceChange("exerciseAdded");
        return value;
      });
    });
    const replaceForExercise = (id, { repair = false } = {}) => {
      const current = document.program?.find(item => item.id === id);
      if (!current) return Promise.resolve(null);
      return chooseExercise({ mode: "replace", day: current.day, exercise: clone(current), repair, exclude: exercisesFor(document, current.day).filter(item => item.id !== id).map(item => item.libraryId).filter(Boolean) }).then(choice => {
        if (!choice) return null;
        const handoff = choice?.entry ? choice : { entry: choice, stagedCustomDefinition: null };
        const entry = handoff.entry;
        if (!entry) return null;
        const next = clone(document), customExercise = handoff.stagedCustomDefinition ? clone(handoff.stagedCustomDefinition) : null;
        if (customExercise && customExercise.id !== entry.id) return null;
        if (customExercise) {
          const customExercises = Array.isArray(next.customExercises) ? next.customExercises : [];
          const existing = customExercises.find(item => item?.id === customExercise.id);
          if (!existing) next.customExercises = customExercises.concat(customExercise);
        }
        if (!replaceExercise(next, id, entry)) return null;
        const replacement = next.program?.find(item => item.id === id);
        pendingFocus = { id, roles: ["replace", "toggle-exercise"] };
        return stage(next, { kind: "exercise_replace", targetId: id, beforeLibraryId: current.libraryId, afterLibraryId: entry.id, exercise: replacement, ...(customExercise ? { customExercise } : {}) }).then(value => {
          if (value?.ok !== false) announceChange("exerciseChanged");
          return value;
        });
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
    const renameDay = (oldDay, value) => {
      const next = clone(document);
      if (!setDayLabel(next, oldDay, value)) return Promise.resolve({ ok: false, duplicate: true });
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
      if (!edits.length && !changed()) return Promise.resolve({ ok: true, unchanged: true, document: clone(document), token: clone(token) });
      const issues = validation(document);
      if (issues.length) {
        setStatus(label("invalid"), { error: true });
        return Promise.resolve({ ok: false, invalid: true, issues });
      }
      const result = adapter.commit({ expectedToken: clone(token), nextDocument: clone(document), intent: intent(kind, { edits: clone(edits) }) });
      return Promise.resolve(result).then(value => {
        if (value?.ok === false || value?.conflict || value?.staleRevision) return value;
        baseDocument = clone(document); edits = []; undoMove = null;
        if (value?.token !== undefined) token = clone(value.token);
        return value;
      });
    };
    const discard = () => {
      const latest = adapter.read() || {};
      document = clone(latest.document || latest.nextDocument || latest); token = clone(latest.token);
      baseDocument = clone(document); edits = []; undoMove = null; expandedExercises.clear(); expandedMetricCycles.clear(); initializedMetricCycleSlots.clear(); collapsedDays.clear(); collapsedDaysInitialized = false;
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
      return `<label class="program-editor__metric-field program-editor__prescription-field"><span>${esc(fieldLabel)}${unit ? ` <small>${esc(unit)}</small>` : ""}</span><input type="number" inputmode="decimal" min="0" max="${rir ? "4" : "86400"}" step="${rir ? "any" : "1"}" data-role="prescription-field" data-id="${esc(exercise.id)}" data-slot-id="${esc(slot.id)}" data-cycle-index="${cycle.cycleIndex}" data-set-index="${set.setIndex}" data-field="${field}" value="${value == null ? "" : esc(String(value))}" aria-label="${esc(label("prescriptionFieldAria", { cycle: cycleTitle, set: setTitle, field: fieldLabel }))}"></label>`;
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
          ? Number.isFinite(after) && after >= 0 && after <= 4
          : Number.isSafeInteger(after) && after >= 0 && after <= 86400;
        if (!valid) {
          setStatus(label("invalid"), { error: true });
          return;
        }
      }
      const before = currentSet[field] == null ? null : currentSet[field];
      if (Object.is(before, after)) return;
      const next = clone(document), set = definitionSet(next, slotId, cycleIndex, setIndex);
      if (!set) return;
      set[field] = after;
      set.status = "manual";
      set.provenance = { ...(set.provenance || {}), source: "manual", policyVersion: "manual@1" };
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
          ${renderLoadStep(exercise, slot)}
          <div class="program-editor__exercise-actions">
            <button type="button" class="program-editor__replace" data-role="replace" data-action-role="replacement" data-id="${esc(exercise.id)}">${esc(label("replaceExercise"))}</button>
            <button type="button" class="program-editor__remove" data-role="remove-exercise" data-action-role="removal" data-id="${esc(exercise.id)}">${esc(label("removeExercise"))}</button>
          </div>
          <details class="program-editor__more" data-role="more-details" data-id="${esc(exercise.id)}">
            <summary>${esc(label("details"))}</summary>
            <label><span>${esc(label("notes"))}</span><input data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="notes" value="${esc(exercise.notes || "")}"></label>
            <label><span>${esc(label("primary"))}</span><input data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="primary" value="${esc(exercise.primary || "")}"${linked ? " readonly" : ""}></label>
            <label><span>${esc(label("secondary"))}</span><input data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="secondary" value="${esc(exercise.secondary || "")}"${linked ? " readonly" : ""}></label>
            <button type="button" data-role="alternates" data-id="${esc(exercise.id)}">${esc((exercise.alternates || []).join(", ") || label("chooseAlternates"))}</button>
          </details>
        </div>` : "";
      return `<article class="program-editor__exercise pex${open ? " is-expanded" : " is-collapsed"}${settleMoveId === exercise.id ? " is-settling" : ""}" data-role="exercise" data-id="${esc(exercise.id)}" data-day="${esc(day)}">
        <header class="program-editor__exercise-head pex__head">
          <input class="program-editor__exercise-name pex__name" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="name" value="${esc(name)}" placeholder="${esc(label("namePlaceholder"))}" aria-label="${esc(name)}">
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
    function render() {
      if (destroyed) return;
      ensureStructure(document);
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
      // A host that annotates the status line (an id other controls describe
      // themselves by, an error state) re-applies it to each fresh render.
      adapter.afterRender?.(host);
      schedulePendingFocus();
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
        input.addEventListener("change", () => renameDay(input.dataset.day, input.value));
        input.addEventListener("keydown", event => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          input.blur();
        });
      });
      host.querySelectorAll('[data-role="exercise-field"]').forEach(input => {
        input.addEventListener("focus", () => { input.dataset.editorFocusValue = input.value; });
        const handler = () => {
          const field = input.dataset.field, raw = String(input.value || "");
          // A blank exercise name is useful while the lifter is editing, but
          // leaving the field blank is an abandoned rename. Restore the value
          // captured on focus instead of manufacturing the model's fallback.
          if (field === "name" && !raw.trim() && String(input.dataset.editorFocusValue || "").trim())
            input.value = input.dataset.editorFocusValue;
          else if (["name", "notes", "primary", "secondary"].includes(field)) input.value = raw.trim();
          return setExerciseField(input.dataset.id, field, input.value);
        };
        input.addEventListener("change", handler);
        if (input.dataset.field === "name" || input.dataset.field === "notes") {
          input.addEventListener("input", () => setExerciseField(input.dataset.id, input.dataset.field, input.value, { redraw: false }));
          input.addEventListener("blur", handler);
        }
      });
      host.querySelectorAll('[data-role="metric-target"]').forEach(input => input.addEventListener("change", () => editMetricTarget(input)));
      host.querySelectorAll('[data-role="prescription-field"]').forEach(input => input.addEventListener("change", () => editPrescriptionField(input)));
      host.querySelectorAll('[data-role="load-step"]').forEach(input => input.addEventListener("change", () => editLoadStep(input)));
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
      host.querySelectorAll('[data-role="alternates"]').forEach(button => button.addEventListener("click", () => chooseExercise({ mode: "alternates", exercise: clone(document.program?.find(item => item.id === button.dataset.id)) }).then(entries => {
        if (!Array.isArray(entries)) return;
        setExerciseField(button.dataset.id, "alternates", entries.map(entry => entry.name || entry.namePt || entry.id));
      })));
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
      for (const section of host.querySelectorAll('[data-role="day"]')) {
        const day = section.dataset.day;
        // The day itself accepts a drop, at lower priority than the rows inside
        // it, so an empty day and a collapsed one are both reachable.
        sortables.push(new Dnd.Droppable({
          id: `day:${day}`, type: "day", accept: ["exercise"],
          element: section, data: { day },
          collisionPriority: Dnd.CollisionPriority.Low,
        }, manager));
        [...section.querySelectorAll('[data-role="exercise"][data-id]')].forEach((row, index) => {
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
        moveExercise(id, day, index, { settle: false });
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

    render();
    return {
      refresh,
      dispose() { destroyed = true; teardownSorting(); if (statusTimer) clearTimeout(statusTimer); host.classList.remove("program-editor-host"); host.dataset.editorMounted = "false"; host.replaceChildren(); },
      getDocument: () => clone(document),
      getToken: () => clone(token),
      isDirty: () => edits.length > 0 || changed(),
      validationIssues: () => validation(document),
      commit: apply,
      discard,
      replaceExercise: exerciseInstanceId => replaceForExercise(exerciseInstanceId, { repair: true }),
    };
  }

  return { mountProgramEditor, PROGRAM_EDITOR_INTENTS };
});
