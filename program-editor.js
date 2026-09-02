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
    "alternates", "exercise_move", "save_draft", "apply", "apply_discard_workout",
  ]);
  const INTENT_SET = new Set(PROGRAM_EDITOR_INTENTS);
  const FALLBACK = Object.freeze({
    programName: "Program name",
    namePlaceholder: "Untitled program",
    dayName: "Day name",
    dayCount: ({ n }) => `${n} exercise${n === 1 ? "" : "s"}`,
    exercises: ({ n }) => `${n} exercise${n === 1 ? "" : "s"}`,
    sets: "SETS",
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
    moved: "Exercise moved",
    undo: "Undo",
    invalid: "Fix the highlighted values before continuing.",
    saved: "Draft saved",
    emptyDays: "Add an exercise to each training day.",
    more: "More",
    close: "Close",
    context: "",
  });
  const I18N_KEYS = Object.freeze({
    programName: "program.editor.program_name", namePlaceholder: "program.editor.name_placeholder",
    dayName: "program.editor.day_name", dayCount: "program.editor.day_count", exercises: "program.editor.day_count",
    sets: "program.editor.sets", repRange: "program.editor.rep_range", min: "program.editor.min", max: "program.editor.max",
    addExercise: "program.editor.add_exercise", replaceExercise: "program.editor.replace_exercise",
    removeExercise: "program.editor.remove_exercise", removeDay: "program.editor.remove_day",
    details: "program.editor.details", notes: "program.editor.notes", primary: "program.editor.primary",
    secondary: "program.editor.secondary", alternates: "program.editor.alternates", chooseAlternates: "program.editor.choose_alternates",
    move: "program.editor.move", moveUp: "program.editor.move_up", moveDown: "program.editor.move_down",
    moveOther: "program.editor.move_other", moved: "program.editor.moved", undo: "program.editor.undo",
    invalid: "program.editor.invalid", saved: "program.editor.draft_saved", emptyDays: "program.editor.empty_days",
    more: "program.editor.more", close: "dialog.close",
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
  function exerciseEntry(adapter, id) {
    try { return adapter?.exerciseEntry?.(id) || null; } catch { return null; }
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
    if (field === "sets") return positiveInt(value, positiveInt(exercise.sets, 1));
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
    let collapsedDays = new Set();
    let collapsedDaysInitialized = false;
    let destroyed = false;
    let drag = null;
    let undoMove = null;
    let reorderMode = false;
    let settleMoveId = null;
    let settleTimer = null;
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
        if (value?.token !== undefined && value?.staged !== false) token = clone(value.token);
        if (value?.ok === false || value?.localOk === false && value?.staged !== true && value?.setupDraft !== true) {
          setStatus(value?.message || label("invalid"), { error: true });
        }
        return value;
      }, error => { setStatus(error?.message || label("invalid"), { error: true }); return { ok: false, error }; });
    };
    const setExerciseField = (id, field, value, { redraw = true } = {}) => {
      const next = clone(document), exercise = next.program?.find(item => item.id === id);
      if (!exercise) return Promise.resolve({ ok: false });
      const previous = field === "alternates" ? clone(exercise.alternates || []) : exercise[field];
      const normalized = fieldValue(exercise, field, value);
      if (equal(previous, normalized)) return Promise.resolve({ ok: true, unchanged: true });
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
    const addForDay = day => chooseExercise({ mode: "add", day, exclude: exercisesFor(document, day).map(item => item.libraryId).filter(Boolean) }).then(entry => {
      if (!entry) return null;
      const next = clone(document), exercise = addExercise(next, day, entry);
      collapsedDays.delete(day); expandedExercises.add(exercise.id);
      return stage(next, { kind: "exercise_add", targetDay: day, targetId: exercise.id, libraryId: entry.id, exercise: exercise });
    });
    const replaceForExercise = id => {
      const current = document.program?.find(item => item.id === id);
      if (!current) return Promise.resolve(null);
      return chooseExercise({ mode: "replace", day: current.day, exercise: clone(current), exclude: exercisesFor(document, current.day).filter(item => item.id !== id).map(item => item.libraryId).filter(Boolean) }).then(entry => {
        if (!entry) return null;
        const next = clone(document); if (!replaceExercise(next, id, entry)) return null;
        const replacement = next.program?.find(item => item.id === id);
        return stage(next, { kind: "exercise_replace", targetId: id, beforeLibraryId: current.libraryId, afterLibraryId: entry.id, exercise: replacement });
      });
    };
    const removeExercise = id => {
      const exercise = document.program?.find(item => item.id === id);
      if (!exercise) return Promise.resolve(null);
      const next = clone(document); next.program = (next.program || []).filter(item => item.id !== id); normalizeOrders(next);
      return stage(next, { kind: "exercise_remove", targetId: id, sourceDay: exercise.day });
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
    const moveExercise = (id, toDay, toIndex, { announce = true } = {}) => {
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
        if (reducedMotion(adapter)) return;
        const frame = root.requestAnimationFrame || (callback => setTimeout(callback, 0));
        frame(() => {
          for (const row of host.querySelectorAll('[data-role="exercise"][data-id]')) {
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
      baseDocument = clone(document); edits = []; undoMove = null; expandedExercises.clear(); collapsedDays.clear(); collapsedDaysInitialized = false;
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
      const sets = format(adapter, exercise.sets), min = format(adapter, exercise.min), max = format(adapter, exercise.max);
      return `${sets} × ${min}${min === max ? "" : `–${max}`}`;
    }
    function dayCount(count) {
      const value = adapter?.dayCount ? adapter.dayCount(count) : label("dayCount", { n: count, word: count === 1 ? "exercise" : "exercises" });
      return value;
    }
    function renderExercise(exercise, index, count, day) {
      const open = expandedExercises.has(exercise.id);
      const linked = exerciseEntry(adapter, exercise.libraryId);
      const name = exerciseName(adapter, exercise);
      const min = number(exercise.min), max = number(exercise.max);
      const details = open ? `<div class="program-editor__exercise-body pex__body">
          <div class="program-editor__sets" data-role="sets-control" aria-label="${esc(label("sets"))}">
            <span class="program-editor__field-label">${esc(label("sets"))}</span>
            <div class="program-editor__stepper">
              <button type="button" data-role="adjust" data-id="${esc(exercise.id)}" data-field="sets" data-delta="-1" aria-label="Decrease sets">−</button>
              <output data-role="sets-value">${esc(format(adapter, exercise.sets))}</output>
              <button type="button" data-role="adjust" data-id="${esc(exercise.id)}" data-field="sets" data-delta="1" aria-label="Increase sets">+</button>
            </div>
          </div>
          <div class="program-editor__rep-rule" aria-hidden="true"></div>
          <fieldset class="program-editor__range">
            <legend>${esc(label("repRange"))}</legend>
            <label><span>${esc(label("min"))}</span><input type="number" inputmode="numeric" min="1" step="1" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="min" value="${esc(exercise.min)}"></label>
            <label><span>${esc(label("max"))}</span><input type="number" inputmode="numeric" min="1" step="1" data-role="exercise-field" data-id="${esc(exercise.id)}" data-field="max" value="${esc(exercise.max)}"></label>
          </fieldset>
          <div class="program-editor__exercise-actions">
            <button type="button" class="program-editor__replace" data-role="replace" data-id="${esc(exercise.id)}">${esc(label("replaceExercise"))}</button>
            <button type="button" class="program-editor__remove" data-role="remove-exercise" data-id="${esc(exercise.id)}">${esc(label("removeExercise"))}</button>
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
          <button type="button" class="program-editor__drag-handle" data-role="drag-handle" data-id="${esc(exercise.id)}" aria-label="${esc(label("move", undefined, `${label("moveUp")} ${name}`))}" title="${esc(label("move"))}">≡</button>
          <button type="button" class="program-editor__exercise-toggle" data-role="toggle-exercise" data-id="${esc(exercise.id)}" aria-expanded="${open ? "true" : "false"}" aria-label="${esc(open ? "Collapse" : "Expand")} ${esc(name)}"><span class="icon-mask icon-mask--chev-${open ? "up" : "down"}" aria-hidden="true"></span></button>
          <button type="button" class="program-editor__exercise-menu" data-role="exercise-menu" data-id="${esc(exercise.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label("more"))}">⋮</button>
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
      return `<section class="program-editor__day pday${open ? " is-expanded" : " is-collapsed"}" data-role="day" data-day="${esc(day)}">
        <header class="program-editor__day-head pday__head" data-role="day-header">
          <input class="program-editor__day-name pday__name" data-role="day-name" data-day="${esc(day)}" value="${esc(titleFor(day, index))}" aria-label="${esc(label("dayName"))}">
          <span class="program-editor__day-count pday__count">${esc(dayCount(list.length))}</span>
          <button type="button" class="program-editor__day-menu" data-role="day-menu" data-day="${esc(day)}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(label("more"))}">⋮</button>
          <button type="button" class="program-editor__day-toggle pday__caret" data-role="toggle-day" data-day="${esc(day)}" aria-expanded="${open ? "true" : "false"}" aria-label="${esc(open ? "Collapse" : "Expand")} ${esc(titleFor(day, index))}"><span class="icon-mask icon-mask--chev-${open ? "up" : "down"}" aria-hidden="true"></span></button>
        </header>
        <div class="program-editor__day-menu-panel" data-role="day-menu-panel" data-day="${esc(day)}" hidden role="menu">
          <button type="button" role="menuitem" data-role="toggle-reorder">${esc(label("reorder", undefined, "Reorder exercises"))}</button>
          <button type="button" role="menuitem" data-role="remove-day" data-day="${esc(day)}">${esc(label("removeDay", undefined, "Remove day"))}</button>
        </div>
        <div class="program-editor__day-body pexlist" data-role="day-body"${open ? "" : " hidden"}>
          ${list.map((exercise, itemIndex) => renderExercise(exercise, itemIndex, list.length, day)).join("") || `<p class="program-editor__empty pday__empty" data-role="day-empty">${esc(label("emptyDays"))}</p>`}
          <button type="button" class="program-editor__add pday__add" data-role="add-exercise" data-day="${esc(day)}"><span aria-hidden="true">＋</span> ${esc(label("addExercise"))}</button>
        </div>
      </section>`;
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
      host.innerHTML = `<div class="program-editor${reorderMode ? " is-reorder-mode" : ""}" data-role="editor" aria-label="${esc(t(adapter, "program.editor.aria", undefined, "Program editor"))}">
        <div class="program-editor__meta" data-role="meta">
          <label class="program-editor__program-name"><span>${esc(label("programName"))}</span><input data-role="program-name" value="${esc(document.programMeta?.name || "")}" placeholder="${esc(label("namePlaceholder"))}" maxlength="80" aria-label="${esc(label("programName"))}"></label>
          ${context() ? `<p class="program-editor__context" data-role="context">${esc(context())}</p>` : ""}
          <p class="program-editor__status" data-role="editor-status" role="status" aria-live="polite" tabindex="-1"${adapter.status?.(document) ? "" : " hidden"}>${esc(adapter.status?.(document) || "")}</p>
        </div>
        <div class="program-editor__days" data-role="days">${days.map((day, index) => renderDay(day, index)).join("") || `<p class="program-editor__empty">${esc(label("emptyDays"))}</p>`}</div>
        <button type="button" class="program-editor__add-day" data-role="add-day">＋ <span>${esc(t(adapter, "program.add_day", undefined, "Add day"))}</span></button>
      </div>`;
      bind();
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
        setExerciseField(exercise.id, button.dataset.field, number(exercise[button.dataset.field]) + number(button.dataset.delta));
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
      host.querySelectorAll('[data-role="drag-handle"]').forEach(button => button.addEventListener("pointerdown", beginDrag));
    }
    function beginDrag(event) {
      if (destroyed || event.button != null && event.button !== 0) return;
      const handle = event.currentTarget, id = handle.dataset.id, row = handle.closest('[data-role="exercise"]');
      const exercise = document.program?.find(item => item.id === id); if (!exercise || !row) return;
      event.preventDefault();
      const rect = row.getBoundingClientRect();
      drag = { id, row, pointerId: event.pointerId, startY: event.clientY, top: rect.top, day: exercise.day, started: false, pickup: setTimeout(() => { if (drag) { drag.started = true; row.classList.add("is-dragging"); } }, 90), overDay: null, hold: null };
      try { handle.setPointerCapture(event.pointerId); } catch { /* Safari may not expose capture on buttons. */ }
      window.addEventListener("pointermove", dragMove, { passive: false });
      window.addEventListener("pointerup", endDrag, { once: true });
      window.addEventListener("pointercancel", cancelDrag, { once: true });
    }
    function dragMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      if (!drag.started) return;
      const dy = event.clientY - drag.startY;
      drag.lastX = event.clientX; drag.lastY = event.clientY;
      const lift = reducedMotion(adapter) ? "" : " scale(1.01)";
      drag.row.style.transform = `translate3d(0,${dy}px,0)${lift}`;
      drag.row.classList.add("is-dragging");
      const target = documentElementAt(event.clientX, event.clientY), day = target?.closest?.('[data-role="day"]');
      if (!day) return;
      const targetDay = day.dataset.day;
      if (targetDay !== drag.overDay) {
        if (drag.hold) clearTimeout(drag.hold);
        drag.overDay = targetDay;
        drag.hold = setTimeout(() => day.classList.add("is-drag-target-expanded"), 450);
      }
    }
    function documentElementAt(x, y) { try { return root.document?.elementFromPoint?.(x, y) || null; } catch { return null; } }
    function finishDrag(cancelled) {
      if (!drag) return;
      const current = drag; drag = null; clearTimeout(current.pickup); if (current.hold) clearTimeout(current.hold);
      current.row.classList.remove("is-dragging"); current.row.style.transform = "";
      host.querySelectorAll(".is-drag-target-expanded").forEach(day => day.classList.remove("is-drag-target-expanded"));
      if (cancelled || !current.started) return;
      const point = root.document?.elementFromPoint?.(current.lastX, current.lastY);
      const day = point?.closest?.('[data-role="day"]'); if (!day) return;
      const targetDay = day.dataset.day, targetExercise = point.closest?.('[data-role="exercise"]');
      let targetIndex = exercisesFor(document, targetDay).length;
      if (targetExercise && targetExercise.dataset.id !== current.id) {
        const list = exercisesFor(document, targetDay), index = list.findIndex(item => item.id === targetExercise.dataset.id);
        targetIndex = index + (current.lastY > targetExercise.getBoundingClientRect().top + targetExercise.getBoundingClientRect().height / 2 ? 1 : 0);
      }
      moveExercise(current.id, targetDay, targetIndex);
    }
    function endDrag(event) {
      if (drag && event.pointerId === drag.pointerId) { drag.lastX = event.clientX; drag.lastY = event.clientY; }
      window.removeEventListener("pointermove", dragMove);
      finishDrag(false);
      window.removeEventListener("pointercancel", cancelDrag);
    }
    function cancelDrag() { window.removeEventListener("pointermove", dragMove); finishDrag(true); }

    render();
    return {
      refresh,
      dispose() { destroyed = true; if (drag) cancelDrag(); if (statusTimer) clearTimeout(statusTimer); host.classList.remove("program-editor-host"); host.dataset.editorMounted = "false"; host.replaceChildren(); },
      getDocument: () => clone(document),
      getToken: () => clone(token),
      isDirty: () => edits.length > 0 || changed(),
      validationIssues: () => validation(document),
      commit: apply,
      discard,
    };
  }

  return { mountProgramEditor, PROGRAM_EDITOR_INTENTS };
});
