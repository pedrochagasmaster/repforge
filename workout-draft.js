(function (root) {
  "use strict";

  const SCHEMA_VERSION = 2;
  const STATUS = new Set(["active", "finishing"]);
  const SET_ROLES = new Set(["working", "warmup"]);
  const RIR_MODES = new Set(["numeric", "effort"]);
  const UNITS = new Set(["kg", "lb"]);
  const EDIT_FIELDS = new Set(["load", "reps", "rir", "effort"]);
  const EFFORT_RIR = Object.freeze({ easy: 3, hard: 1, max: 0 });
  const DECIMAL = /^\d+(?:\.\d+)?$/;
  const INTEGER = /^\d+$/;
  const MAX_TEXT = 10000;
  const MAX_ID = 240;
  const CONTEXT_TOUCHED_FIELDS = ["day", "date", "sessionNotes", "bodyweight"];

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isSafeInteger(value, min = 0) {
    return Number.isSafeInteger(value) && value >= min;
  }

  function isText(value, { empty = false, max = MAX_TEXT } = {}) {
    return typeof value === "string" && value.length <= max && (empty || value.length > 0);
  }

  function isOptionalText(value, max = MAX_TEXT) {
    return value == null || isText(value, { empty: true, max });
  }

  function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function error(code, details) {
    return deepFreeze({ kind: "domain-error", code, ...(details || {}) });
  }

  function migrationError(code, details) {
    return deepFreeze({ kind: "migration-error", code, ...(details || {}) });
  }

  function isDomainError(value) {
    return value?.kind === "domain-error";
  }

  function editableText(value) {
    if (value == null) return null;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.length <= 64) return value;
    return undefined;
  }

  function snapshotFromExercise(exercise) {
    const programmed = exercise.programmed;
    const snapshot = {
      exerciseInstanceId: exercise.exerciseInstanceId,
      sourceExerciseId: exercise.sourceExerciseId,
      displayName: exercise.displayName,
      primary: programmed.primary,
      secondary: programmed.secondary,
    };
    if (exercise.libraryId) snapshot.libraryId = exercise.libraryId;
    if (programmed.movementId) snapshot.movementId = programmed.movementId;
    return snapshot;
  }

  function movementSnapshotMatches(left, right) {
    const fields = [
      "exerciseInstanceId",
      "sourceExerciseId",
      "libraryId",
      "movementId",
      "displayName",
      "primary",
      "secondary",
    ];
    return fields.every((field) => (left[field] ?? null) === (right[field] ?? null));
  }

  function validateMovementSnapshot(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["exerciseInstanceId", "sourceExerciseId", "displayName", "primary", "secondary"]) {
      if (!isText(value[field], { empty: field === "primary" || field === "secondary", max: field.includes("Id") ? MAX_ID : 500 })) {
        issues.push(`${path}.${field}`);
      }
    }
    for (const field of ["libraryId", "movementId"]) {
      if (hasOwn(value, field) && !isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function validateWriter(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["installationId", "tabId", "operationId"]) {
      if (!isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function emptyContextTouched() {
    return { day: false, date: false, sessionNotes: false, bodyweight: false };
  }

  function validateContextTouched(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of CONTEXT_TOUCHED_FIELDS) {
      if (typeof value[field] !== "boolean") issues.push(`${path}.${field}`);
    }
    for (const field of Object.keys(value)) {
      if (!CONTEXT_TOUCHED_FIELDS.includes(field)) issues.push(`${path}.${field}:unknown`);
    }
  }

  function contextTouchedForCreate(value) {
    if (value == null) return emptyContextTouched();
    if (!isPlainObject(value) || Object.keys(value).some((field) => !CONTEXT_TOUCHED_FIELDS.includes(field)) ||
      CONTEXT_TOUCHED_FIELDS.some((field) => typeof value[field] !== "boolean")) return null;
    return Object.fromEntries(CONTEXT_TOUCHED_FIELDS.map((field) => [field, value[field]]));
  }

  function validateTouched(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["load", "reps", "effort"]) {
      if (typeof value[field] !== "boolean") issues.push(`${path}.${field}`);
    }
  }

  function validateProgrammedSet(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    for (const field of ["suggestedLoad", "minReps", "maxReps", "targetRir"]) {
      if (hasOwn(value, field) && value[field] != null &&
        (typeof value[field] !== "number" || !Number.isFinite(value[field]) || value[field] < 0)) {
        issues.push(`${path}.${field}`);
      }
    }
  }

  function validateSet(value, setId, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.setId !== setId || !isText(value.setId, { max: MAX_ID })) issues.push(`${path}.setId`);
    if (!isSafeInteger(value.ordinal, 1)) issues.push(`${path}.ordinal`);
    if (!SET_ROLES.has(value.role)) issues.push(`${path}.role`);
    validateProgrammedSet(value.programmed, `${path}.programmed`, issues);
    if (!isPlainObject(value.edited)) issues.push(`${path}.edited:object`);
    else {
      for (const field of ["load", "reps", "rir", "effort"]) {
        if (hasOwn(value.edited, field) && !isOptionalText(value.edited[field], 64)) issues.push(`${path}.edited.${field}`);
      }
    }
    validateTouched(value.touched, `${path}.touched`, issues);
    if (value.completion !== "pending") {
      if (!isPlainObject(value.completion) || !isText(value.completion.completedAt, { max: 100 })) {
        issues.push(`${path}.completion`);
      }
    }
  }

  function validateProgrammedExercise(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (!isSafeInteger(value.order)) issues.push(`${path}.order`);
    if (!isSafeInteger(value.sets, 1)) issues.push(`${path}.sets`);
    for (const field of ["minReps", "maxReps"]) {
      if (!isSafeInteger(value[field], 1)) issues.push(`${path}.${field}`);
    }
    if (isSafeInteger(value.minReps, 1) && isSafeInteger(value.maxReps, 1) && value.minReps > value.maxReps) {
      issues.push(`${path}.repRange`);
    }
    if (hasOwn(value, "targetRir") && value.targetRir != null &&
      (typeof value.targetRir !== "number" || !Number.isFinite(value.targetRir) || value.targetRir < 0)) {
      issues.push(`${path}.targetRir`);
    }
    for (const field of ["notes", "primary", "secondary"]) {
      if (!isText(value[field], { empty: true })) issues.push(`${path}.${field}`);
    }
    if (!isOptionalText(value.progressionStrategy, 240)) issues.push(`${path}.progressionStrategy`);
    if (!isOptionalText(value.movementPattern, 240)) issues.push(`${path}.movementPattern`);
    if (!isText(value.sourceFingerprint, { max: 1000 })) issues.push(`${path}.sourceFingerprint`);
    for (const field of ["libraryId", "movementId"]) {
      if (hasOwn(value, field) && value[field] != null && !isText(value[field], { max: MAX_ID })) issues.push(`${path}.${field}`);
    }
  }

  function validateExercise(value, exerciseId, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return;
    }
    if (value.exerciseInstanceId !== exerciseId || !isText(value.exerciseInstanceId, { max: MAX_ID })) issues.push(`${path}.exerciseInstanceId`);
    if (!isText(value.sourceExerciseId, { max: MAX_ID })) issues.push(`${path}.sourceExerciseId`);
    if (!isOptionalText(value.libraryId, MAX_ID)) issues.push(`${path}.libraryId`);
    if (!isText(value.displayName, { max: 500 })) issues.push(`${path}.displayName`);
    validateProgrammedExercise(value.programmed, `${path}.programmed`, issues);
    if (value.substitution != null) {
      if (!isPlainObject(value.substitution)) issues.push(`${path}.substitution:object`);
      else {
        validateMovementSnapshot(value.substitution.original, `${path}.substitution.original`, issues);
        validateMovementSnapshot(value.substitution.replacement, `${path}.substitution.replacement`, issues);
        if (isPlainObject(value.substitution.original) && isPlainObject(value.programmed) &&
          !movementSnapshotMatches(value.substitution.original, snapshotFromExercise(value))) {
          issues.push(`${path}.substitution.original:provenance`);
        }
        if (!isText(value.substitution.selectedAt, { max: 100 })) issues.push(`${path}.substitution.selectedAt`);
      }
    }
    if (value.status !== "active" && value.status !== "skipped") issues.push(`${path}.status`);
    if (!isText(value.setupNotes, { empty: true })) issues.push(`${path}.setupNotes`);
    if (!Array.isArray(value.setOrder)) issues.push(`${path}.setOrder`);
    if (!isPlainObject(value.sets)) issues.push(`${path}.sets`);
    if (!Array.isArray(value.setOrder) || !isPlainObject(value.sets)) return;
    const unique = new Set(value.setOrder);
    if (unique.size !== value.setOrder.length || value.setOrder.some((id) => !isText(id, { max: MAX_ID }))) issues.push(`${path}.setOrder:identity`);
    const keys = Object.keys(value.sets);
    if (keys.length !== value.setOrder.length || keys.some((id) => !unique.has(id))) issues.push(`${path}.sets:coverage`);
    value.setOrder.forEach((setId, index) => {
      validateSet(value.sets[setId], setId, `${path}.sets.${setId}`, issues);
      if (value.sets[setId]?.ordinal !== index + 1) issues.push(`${path}.sets.${setId}.ordinalOrder`);
    });
    if (value.programmed?.sets !== value.setOrder.length) issues.push(`${path}.programmed.sets:coverage`);
  }

  function structuralIssues(value) {
    const issues = [];
    if (!isPlainObject(value)) return ["draft:object"];
    if (value.schemaVersion !== SCHEMA_VERSION) issues.push("schemaVersion");
    if (!isText(value.draftId, { max: MAX_ID })) issues.push("draftId");
    if (!isSafeInteger(value.revision)) issues.push("revision");
    validateWriter(value.writer, "writer", issues);
    if (!isPlainObject(value.program)) issues.push("program:object");
    else {
      for (const field of ["programId", "programFingerprint", "dayId", "dayLabel", "scheduleDate"]) {
        if (!isText(value.program[field], {
          empty: field === "scheduleDate",
          max: field === "programFingerprint" ? 2000 : 500,
        })) issues.push(`program.${field}`);
      }
      if (!isSafeInteger(value.program.durableRevision)) issues.push("program.durableRevision");
      if (!UNITS.has(value.program.unit)) issues.push("program.unit");
      if (!RIR_MODES.has(value.program.rirMode)) issues.push("program.rirMode");
    }
    if (!isPlainObject(value.session)) issues.push("session:object");
    else {
      for (const field of ["startedAt", "updatedAt"]) {
        if (!isText(value.session[field], { max: 100 })) issues.push(`session.${field}`);
      }
      if (!isOptionalText(value.session.bodyweight, 64)) issues.push("session.bodyweight");
      if (!isText(value.session.notes, { empty: true })) issues.push("session.notes");
      if (!isOptionalText(value.session.selectedExerciseId, MAX_ID)) issues.push("session.selectedExerciseId");
      if (!STATUS.has(value.session.status)) issues.push("session.status");
      validateContextTouched(value.session.contextTouched, "session.contextTouched", issues);
    }
    if (!Array.isArray(value.exerciseOrder)) issues.push("exerciseOrder");
    if (!isPlainObject(value.exercises)) issues.push("exercises");
    if (!Array.isArray(value.exerciseOrder) || !isPlainObject(value.exercises)) return issues;
    const unique = new Set(value.exerciseOrder);
    if (unique.size !== value.exerciseOrder.length || value.exerciseOrder.some((id) => !isText(id, { max: MAX_ID }))) issues.push("exerciseOrder:identity");
    const keys = Object.keys(value.exercises);
    if (keys.length !== value.exerciseOrder.length || keys.some((id) => !unique.has(id))) issues.push("exercises:coverage");
    value.exerciseOrder.forEach((exerciseId) => {
      validateExercise(value.exercises[exerciseId], exerciseId, `exercises.${exerciseId}`, issues);
    });
    if (value.session?.selectedExerciseId != null && !unique.has(value.session.selectedExerciseId)) issues.push("session.selectedExerciseId:unknown");
    return issues;
  }

  function validate(value) {
    const issues = structuralIssues(value);
    return issues.length ? { ok: false, issues } : { ok: true };
  }

  function previousByExercise(previousSessionFacts) {
    if (Array.isArray(previousSessionFacts)) {
      return new Map(previousSessionFacts.map((item) => [item?.exerciseInstanceId, item]));
    }
    if (isPlainObject(previousSessionFacts)) return new Map(Object.entries(previousSessionFacts));
    return new Map();
  }

  function create(programContext, sessionSelection, previousSessionFacts) {
    if (!isPlainObject(programContext) || !isPlainObject(sessionSelection) || !Array.isArray(programContext.exercises)) {
      return error("invalid-create-input");
    }
    const contextTouched = contextTouchedForCreate(sessionSelection.contextTouched);
    if (!contextTouched) return error("invalid-create-context-touched");
    const prior = previousByExercise(previousSessionFacts);
    const exerciseOrder = [];
    const exercises = Object.create(null);
    for (let index = 0; index < programContext.exercises.length; index++) {
      const source = programContext.exercises[index];
      if (!isPlainObject(source)) return error("invalid-create-exercise", { index });
      const exerciseInstanceId = source.exerciseInstanceId;
      const sourceExerciseId = source.sourceExerciseId;
      const setCount = Number(source.sets);
      if (!isText(exerciseInstanceId, { max: MAX_ID }) || !isText(sourceExerciseId, { max: MAX_ID }) ||
        !isSafeInteger(setCount, 1) || !Array.isArray(source.setIds) || source.setIds.length !== setCount) {
        return error("invalid-create-exercise", { index });
      }
      if (hasOwn(exercises, exerciseInstanceId)) return error("duplicate-exercise-id", { exerciseInstanceId });
      const previous = prior.get(exerciseInstanceId);
      const previousSets = Array.isArray(previous?.sets) ? previous.sets : [];
      const specifications = Array.isArray(source.programmedSets) ? source.programmedSets : [];
      const setOrder = [];
      const sets = Object.create(null);
      for (let ordinal = 1; ordinal <= setCount; ordinal++) {
        const setId = source.setIds[ordinal - 1];
        if (!isText(setId, { max: MAX_ID }) || hasOwn(sets, setId)) return error("invalid-create-set-id", { exerciseInstanceId, ordinal });
        const spec = specifications[ordinal - 1] || {};
        const old = previousSets.find((item) => item?.ordinal === ordinal || item?.set === ordinal) || previousSets[ordinal - 1] || {};
        const suggestedLoad = spec.suggestedLoad ?? source.suggestedLoad ?? old.load ?? null;
        const suggestedReps = spec.suggestedReps ?? source.suggestedReps ?? old.reps ?? source.minReps;
        const targetRir = spec.targetRir ?? source.targetRir ?? old.rir ?? null;
        const effort = spec.suggestedEffort ?? source.suggestedEffort ?? null;
        sets[setId] = {
          setId,
          ordinal,
          role: spec.role === "warmup" ? "warmup" : "working",
          programmed: {
            suggestedLoad: suggestedLoad == null ? null : Number(suggestedLoad),
            minReps: spec.minReps ?? source.minReps,
            maxReps: spec.maxReps ?? source.maxReps,
            targetRir: targetRir == null ? null : Number(targetRir),
          },
          edited: {
            load: editableText(suggestedLoad),
            reps: editableText(suggestedReps),
            rir: editableText(targetRir),
            effort: editableText(effort),
          },
          touched: { load: false, reps: false, effort: false },
          completion: "pending",
        };
        setOrder.push(setId);
      }
      const programmed = {
        order: index,
        sets: setCount,
        minReps: source.minReps,
        maxReps: source.maxReps,
        targetRir: source.targetRir ?? null,
        notes: source.notes || "",
        progressionStrategy: source.progressionStrategy ?? null,
        movementPattern: source.movementPattern ?? null,
        sourceFingerprint: source.sourceFingerprint,
        primary: source.primary || "",
        secondary: source.secondary || "",
      };
      if (source.libraryId) programmed.libraryId = source.libraryId;
      if (source.movementId) programmed.movementId = source.movementId;
      const exercise = {
        exerciseInstanceId,
        sourceExerciseId,
        libraryId: source.libraryId ?? null,
        displayName: source.displayName,
        programmed,
        substitution: null,
        status: "active",
        setupNotes: source.setupNotes ?? previous?.setupNotes ?? "",
        setOrder,
        sets,
      };
      exerciseOrder.push(exerciseInstanceId);
      exercises[exerciseInstanceId] = exercise;
    }
    const writer = sessionSelection.writer;
    const draft = {
      schemaVersion: SCHEMA_VERSION,
      draftId: sessionSelection.draftId,
      revision: 0,
      writer: writer && {
        installationId: writer.installationId,
        tabId: writer.tabId,
        operationId: writer.operationId,
      },
      program: {
        programId: programContext.programId,
        programFingerprint: programContext.programFingerprint,
        durableRevision: programContext.durableRevision,
        dayId: programContext.dayId,
        dayLabel: programContext.dayLabel,
        scheduleDate: sessionSelection.scheduleDate ?? programContext.scheduleDate,
        unit: programContext.unit,
        rirMode: programContext.rirMode,
      },
      session: {
        startedAt: sessionSelection.startedAt,
        updatedAt: sessionSelection.updatedAt ?? sessionSelection.startedAt,
        bodyweight: editableText(sessionSelection.bodyweight) ?? null,
        notes: sessionSelection.notes ?? "",
        selectedExerciseId: sessionSelection.selectedExerciseId ?? exerciseOrder[0] ?? null,
        status: "active",
        contextTouched,
      },
      exerciseOrder,
      exercises,
    };
    const checked = validate(draft);
    return checked.ok ? deepFreeze(draft) : error("invalid-created-draft", { issues: checked.issues });
  }

  function looksLegacy(value) {
    if (!isPlainObject(value) || hasOwn(value, "schemaVersion")) return false;
    const keys = Object.keys(value);
    return keys.some((key) => key.startsWith("__") || /_(?:load|reps|rir|effort)$/.test(key));
  }

  function contextMismatch(draft, context) {
    if (!isPlainObject(context)) return null;
    const fields = ["programId", "programFingerprint", "durableRevision", "dayId"];
    for (const field of fields) {
      if (hasOwn(context, field) && context[field] !== draft.program[field]) return field;
    }
    if (Array.isArray(context.dayIds) && !context.dayIds.includes(draft.program.dayId)) return "dayId";
    return null;
  }

  function parse(raw, currentProgramContext) {
    if (raw == null || raw === "") return deepFreeze({ kind: "absent" });
    let value = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        return deepFreeze({ kind: "invalid", code: "invalid-json" });
      }
    }
    if (looksLegacy(value)) return deepFreeze({ kind: "legacy", raw: jsonClone(value) });
    // DraftV2 documents written before context intent was durable have no
    // session.contextTouched. They remain readable with an explicit all-false
    // compatibility default; newly created and reduced documents always carry
    // the complete validated shape.
    if (value?.schemaVersion === SCHEMA_VERSION && isPlainObject(value.session) &&
      !hasOwn(value.session, "contextTouched")) {
      value = jsonClone(value);
      value.session.contextTouched = emptyContextTouched();
    }
    const checked = validate(value);
    if (!checked.ok) return deepFreeze({ kind: "invalid", code: "invalid-schema", issues: checked.issues });
    const draft = deepFreeze(jsonClone(value));
    const mismatch = contextMismatch(draft, currentProgramContext);
    return mismatch
      ? deepFreeze({ kind: "stale", reason: mismatch, draft })
      : deepFreeze({ kind: "valid", draft });
  }

  function serialize(draft) {
    const checked = validate(draft);
    return checked.ok ? jsonClone(draft) : error("invalid-draft", { issues: checked.issues });
  }

  function logicalCloneSection(draft) {
    const section = serialize(draft);
    if (isDomainError(section)) return section;
    delete section.writer;
    delete section.revision;
    delete section.program.durableRevision;
    return section;
  }

  function targetExercise(draft, command) {
    const exercise = hasOwn(draft.exercises, command.exerciseInstanceId)
      ? draft.exercises[command.exerciseInstanceId]
      : null;
    if (!exercise) return error("unknown-exercise", { exerciseInstanceId: command.exerciseInstanceId });
    return { exercise };
  }

  function targetSet(draft, command) {
    const found = targetExercise(draft, command);
    if (isDomainError(found)) return found;
    const exercise = found.exercise;
    const set = hasOwn(exercise.sets, command.setId) ? exercise.sets[command.setId] : null;
    if (!set) return error("unknown-set", { exerciseInstanceId: command.exerciseInstanceId, setId: command.setId });
    return { exercise, set };
  }

  function writerFromCommand(command) {
    const writer = command.writer;
    if (!isPlainObject(writer) || !isText(writer.installationId, { max: MAX_ID }) || !isText(writer.tabId, { max: MAX_ID })) return null;
    return { installationId: writer.installationId, tabId: writer.tabId, operationId: command.operationId };
  }

  function effectiveText(set, field) {
    const edited = set.edited[field];
    if (edited != null) return edited;
    if (field === "load") return editableText(set.programmed.suggestedLoad);
    if (field === "reps") return editableText(set.programmed.minReps);
    if (field === "rir") return editableText(set.programmed.targetRir);
    return null;
  }

  function validDecimal(raw, { positive = false, max = Infinity } = {}) {
    if (typeof raw !== "string" || !DECIMAL.test(raw)) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0) || value > max) return null;
    return value;
  }

  function validInteger(raw, { positive = false } = {}) {
    if (typeof raw !== "string" || !INTEGER.test(raw)) return null;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) return null;
    return value;
  }

  function validDate(raw) {
    if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    const day = Number(raw.slice(8, 10));
    const value = new Date(Date.UTC(year, month - 1, day));
    return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
  }

  function setSaveIssues(draft, exercise, set) {
    const issues = [];
    const load = validDecimal(effectiveText(set, "load"), { positive: true, max: 1000 });
    const reps = validInteger(effectiveText(set, "reps"), { positive: true });
    if (load == null) issues.push({ code: "invalid-load", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "load" });
    if (reps == null) issues.push({ code: "invalid-reps", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "reps" });
    if (draft.program.rirMode === "effort") {
      const effort = effectiveText(set, "effort");
      if (!hasOwn(EFFORT_RIR, effort)) issues.push({ code: "invalid-effort", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "effort" });
    } else if (validDecimal(effectiveText(set, "rir")) == null) {
      issues.push({ code: "invalid-rir", exerciseInstanceId: exercise.exerciseInstanceId, setId: set.setId, field: "rir" });
    }
    return issues;
  }

  function sessionSaveIssues(draft) {
    const issues = [];
    if (!validDate(draft.program.scheduleDate)) issues.push({ code: "invalid-date", field: "scheduleDate" });
    const bodyweight = draft.session.bodyweight;
    if (bodyweight != null && bodyweight !== "" && validDecimal(bodyweight, { positive: true }) == null) {
      issues.push({ code: "invalid-bodyweight", field: "bodyweight" });
    }
    return issues;
  }

  function isCandidate(set) {
    return set.completion !== "pending" || set.role === "warmup" || Object.values(set.touched).some(Boolean);
  }

  // A pristine draft holds no lifter input: untouched suggestions, navigation
  // state, and derived values recompute, so replacing it loses nothing.
  // Programmed warmup structure alone is not input; completing or editing any
  // set, skipping, substituting, annotating, or starting the finish flow is.
  // History-derived exercise notes and the schedule date need caller seeds to
  // judge, so the adapter refines this predicate before disposing a draft.
  function isPristine(draft) {
    if (!isPlainObject(draft) || !isPlainObject(draft.session)) return false;
    if (draft.session.status !== "active") return false;
    if (Object.values(draft.session.contextTouched || {}).some(Boolean)) return false;
    if (draft.session.bodyweight != null && draft.session.bodyweight !== "") return false;
    if (typeof draft.session.notes === "string" && draft.session.notes.trim() !== "") return false;
    if (!Array.isArray(draft.exerciseOrder) || !isPlainObject(draft.exercises)) return false;
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (!isPlainObject(exercise)) return false;
      if (exercise.status === "skipped" || exercise.substitution != null) return false;
      if (!Array.isArray(exercise.setOrder) || !isPlainObject(exercise.sets)) return false;
      for (const setId of exercise.setOrder) {
        const set = exercise.sets[setId];
        if (!isPlainObject(set)) return false;
        if (set.completion !== "pending" || Object.values(set.touched || {}).some(Boolean)) return false;
      }
    }
    return true;
  }

  function validateForSave(draft) {
    const checked = validate(draft);
    if (!checked.ok) return [{ code: "invalid-draft", issues: checked.issues }];
    const issues = sessionSaveIssues(draft);
    if (draft.session.status !== "finishing") issues.push({ code: "finish-required" });
    let candidates = 0;
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (exercise.status === "skipped") continue;
      for (const setId of exercise.setOrder) {
        const set = exercise.sets[setId];
        if (!isCandidate(set)) continue;
        candidates++;
        issues.push(...setSaveIssues(draft, exercise, set));
      }
    }
    if (!candidates) issues.push({ code: "no-work" });
    return issues;
  }

  function reduce(draft, command) {
    const checked = validate(draft);
    if (!checked.ok) return error("invalid-draft", { issues: checked.issues });
    if (!isPlainObject(command) || !isText(command.type, { max: 80 }) ||
      !isText(command.operationId, { max: MAX_ID }) || !isSafeInteger(command.expectedRevision) ||
      !isText(command.updatedAt, { max: 100 })) return error("invalid-command");
    if (draft.writer.operationId === command.operationId) return draft;
    if (command.expectedRevision !== draft.revision) return error("stale-revision", { expected: command.expectedRevision, actual: draft.revision });
    const nextWriter = writerFromCommand(command);
    if (!nextWriter) return error("invalid-command-writer");
    if (draft.session.status === "finishing" && command.type !== "cancelFinish") return error("finish-in-progress");
    const next = jsonClone(draft);
    let item;
    switch (command.type) {
      case "editSetField": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        if (!EDIT_FIELDS.has(command.field)) return error("unknown-set-field", { field: command.field });
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-set-field-value", { field: command.field });
        item.set.edited[command.field] = value;
        item.set.touched[command.field === "rir" || command.field === "effort" ? "effort" : command.field] = true;
        break;
      }
      case "refreshUntouchedSuggestions": {
        if (!isSafeInteger(command.sourceRevision) || command.sourceRevision !== draft.revision) {
          return error("stale-suggestion", {
            sourceRevision: command.sourceRevision,
            actualRevision: draft.revision,
          });
        }
        if (!Array.isArray(command.updates)) return error("invalid-suggestion-updates");
        const seen = new Set();
        for (const update of command.updates) {
          if (!isPlainObject(update) || !isText(update.exerciseInstanceId, { max: MAX_ID }) ||
            !isText(update.setId, { max: MAX_ID }) || !isPlainObject(update.fields)) {
            return error("invalid-suggestion-update");
          }
          const identity = `${update.exerciseInstanceId}\u0000${update.setId}`;
          if (seen.has(identity)) return error("duplicate-suggestion-update", {
            exerciseInstanceId: update.exerciseInstanceId,
            setId: update.setId,
          });
          seen.add(identity);
          if (!Object.keys(update.fields).some((field) => EDIT_FIELDS.has(field))) {
            return error("empty-suggestion-update", {
              exerciseInstanceId: update.exerciseInstanceId,
              setId: update.setId,
            });
          }
          for (const [field, value] of Object.entries(update.fields)) {
            const text = editableText(value);
            const valid = field === "load"
              ? validDecimal(text, { positive: true, max: 1000 }) != null
              : field === "reps"
                ? validInteger(text, { positive: true }) != null
                : field === "rir"
                  ? validDecimal(text) != null
                  : field === "effort" && hasOwn(EFFORT_RIR, text);
            if (!EDIT_FIELDS.has(field) || !valid) {
              return error("invalid-suggestion-value", { field });
            }
          }
          const found = targetSet(next, update);
          if (isDomainError(found)) return found;
        }
        let changed = false;
        for (const update of command.updates) {
          const found = targetSet(next, update);
          if (isDomainError(found)) return found;
          const { exercise, set } = found;
          if (exercise.status === "skipped" || set.role === "warmup" || set.completion !== "pending") continue;
          for (const [field, rawValue] of Object.entries(update.fields)) {
            const owner = field === "rir" || field === "effort" ? "effort" : field;
            if (set.touched[owner]) continue;
            const value = editableText(rawValue);
            if (set.edited[field] === value) continue;
            set.edited[field] = value;
            changed = true;
          }
        }
        if (!changed) return draft;
        break;
      }
      case "completeSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        const issues = [...sessionSaveIssues(next), ...setSaveIssues(next, item.exercise, item.set)];
        if (issues.length) return error("set-not-saveable", { issues });
        item.set.completion = { completedAt: command.completedAt };
        item.set.touched = { load: true, reps: true, effort: true };
        break;
      }
      case "uncommitSet": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        item.set.completion = "pending";
        break;
      }
      case "markWarmup":
      case "markWorking": {
        item = targetSet(next, command);
        if (isDomainError(item)) return item;
        item.set.role = command.type === "markWarmup" ? "warmup" : "working";
        break;
      }
      case "skipExercise":
      case "restoreExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        item.exercise.status = command.type === "skipExercise" ? "skipped" : "active";
        if (command.type === "skipExercise" && next.session.selectedExerciseId === item.exercise.exerciseInstanceId) {
          next.session.selectedExerciseId = next.exerciseOrder.find((id) => next.exercises[id].status === "active") ?? null;
        }
        break;
      }
      case "substituteExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        const issues = [];
        validateMovementSnapshot(command.replacement, "replacement", issues);
        if (issues.length) return error("invalid-substitution", { issues });
        if (command.replacement.exerciseInstanceId !== item.exercise.exerciseInstanceId &&
          hasOwn(next.exercises, command.replacement.exerciseInstanceId)) {
          return error("substitution-identity-in-use", {
            exerciseInstanceId: command.replacement.exerciseInstanceId,
          });
        }
        item.exercise.substitution = {
          original: item.exercise.substitution?.original || snapshotFromExercise(item.exercise),
          replacement: jsonClone(command.replacement),
          selectedAt: command.selectedAt,
        };
        item.exercise.status = "active";
        break;
      }
      case "restoreOriginalExercise": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        item.exercise.substitution = null;
        break;
      }
      case "repeatPreviousSetValues": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        if (!Array.isArray(command.values)) return error("invalid-repeat-values");
        for (const previous of command.values) {
          if (!isPlainObject(previous)) return error("invalid-repeat-values");
          if (previous.setId && !hasOwn(item.exercise.sets, previous.setId)) {
            return error("unknown-set", {
              exerciseInstanceId: command.exerciseInstanceId,
              setId: previous.setId,
            });
          }
          const set = previous.setId
            ? item.exercise.sets[previous.setId]
            : item.exercise.setOrder.find((setId) => item.exercise.sets[setId].ordinal === previous.ordinal);
          const targetSet = typeof set === "string" && hasOwn(item.exercise.sets, set)
            ? item.exercise.sets[set]
            : isPlainObject(set) ? set : null;
          if (!targetSet) continue;
          for (const field of EDIT_FIELDS) {
            if (!hasOwn(previous, field)) continue;
            const value = editableText(previous[field]);
            if (value === undefined) return error("invalid-repeat-values", { field });
            targetSet.edited[field] = value;
            targetSet.touched[field === "rir" || field === "effort" ? "effort" : field] = true;
          }
        }
        break;
      }
      case "setExerciseNotes": {
        item = targetExercise(next, command);
        if (isDomainError(item)) return item;
        if (!isText(command.value, { empty: true })) return error("invalid-exercise-notes");
        item.exercise.setupNotes = command.value;
        break;
      }
      case "setSessionNotes":
        if (!isText(command.value, { empty: true })) return error("invalid-session-notes");
        next.session.notes = command.value;
        next.session.contextTouched.sessionNotes = true;
        break;
      case "setBodyweight": {
        const value = editableText(command.value);
        if (value === undefined) return error("invalid-bodyweight-text");
        next.session.bodyweight = value;
        next.session.contextTouched.bodyweight = true;
        break;
      }
      case "setSessionDate":
        if (!isText(command.value, { empty: true, max: 64 })) return error("invalid-session-date-text");
        next.program.scheduleDate = command.value;
        next.session.contextTouched.date = true;
        break;
      case "selectExercise":
        if (!hasOwn(next.exercises, command.exerciseInstanceId)) return error("unknown-exercise", { exerciseInstanceId: command.exerciseInstanceId });
        if (next.exercises[command.exerciseInstanceId].status !== "active") return error("exercise-skipped", { exerciseInstanceId: command.exerciseInstanceId });
        next.session.selectedExerciseId = command.exerciseInstanceId;
        break;
      case "reorderExercises": {
        if (!Array.isArray(command.exerciseOrder) || command.exerciseOrder.length !== next.exerciseOrder.length ||
          new Set(command.exerciseOrder).size !== command.exerciseOrder.length ||
          command.exerciseOrder.some((id) => !hasOwn(next.exercises, id))) return error("invalid-exercise-order");
        next.exerciseOrder = command.exerciseOrder.slice();
        break;
      }
      case "beginFinish":
        next.session.status = "finishing";
        break;
      case "cancelFinish":
        next.session.status = "active";
        break;
      default:
        return error("unknown-command", { type: command.type });
    }
    next.revision++;
    next.writer = nextWriter;
    next.session.updatedAt = command.updatedAt;
    const result = validate(next);
    return result.ok ? deepFreeze(next) : error("command-produced-invalid-draft", { issues: result.issues });
  }

  function numericSetValues(draft, set) {
    const load = validDecimal(effectiveText(set, "load"), { positive: true, max: 1000 });
    const reps = validInteger(effectiveText(set, "reps"), { positive: true });
    const rir = draft.program.rirMode === "effort"
      ? EFFORT_RIR[effectiveText(set, "effort")]
      : validDecimal(effectiveText(set, "rir"));
    return { load, reps, rir };
  }

  function toHistoryRows(draft, completedAt) {
    const issues = validateForSave(draft);
    if (issues.length) return error("draft-not-saveable", { issues });
    if (!isText(completedAt, { max: 100 })) return error("invalid-completed-at");
    const rows = [];
    for (const exerciseId of draft.exerciseOrder) {
      const exercise = draft.exercises[exerciseId];
      if (exercise.status === "skipped") continue;
      const original = snapshotFromExercise(exercise);
      const performed = exercise.substitution?.replacement || original;
      for (const setId of exercise.setOrder) {
        const set = exercise.sets[setId];
        if (!isCandidate(set)) continue;
        const values = numericSetValues(draft, set);
        const row = {
          session: draft.draftId,
          date: draft.program.scheduleDate,
          day: draft.program.dayLabel,
          name: original.displayName,
          exerciseId: exercise.exerciseInstanceId,
          set: set.ordinal,
          load: values.load,
          reps: values.reps,
          rir: values.rir,
          notes: draft.session.notes.trim(),
          created: completedAt,
          primary: original.primary,
          secondary: original.secondary,
          performedName: performed.displayName,
          performedPrimary: performed.primary,
          performedSecondary: performed.secondary,
        };
        if (performed.libraryId) row.performedLibraryId = performed.libraryId;
        else if (performed.movementId) row.performedMovementId = performed.movementId;
        if (exercise.setupNotes.trim()) row.exNote = exercise.setupNotes.trim();
        if (set.role === "warmup") row.warmup = true;
        const bodyweight = draft.session.bodyweight;
        if (bodyweight != null && bodyweight !== "") row.bodyweight = Number(bodyweight);
        rows.push(row);
      }
    }
    return rows;
  }

  const LEGACY_META_FIELDS = new Set([
    "__done",
    "__touched",
    "__warm",
    "__skipped",
    "__substituted",
    "__substitutedRef",
    "__exnotes",
    "__day",
    "__date",
    "__sessionNotes",
    "__bodyweight",
    "__contextTouched",
    "__startedAt",
    "__lastCommitAt",
    "__selectedExercise",
    "__selectedExerciseId",
  ]);

  function legacyObject(raw) {
    if (typeof raw !== "string") return isPlainObject(raw) ? raw : migrationError("invalid-legacy-object");
    try {
      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : migrationError("invalid-legacy-object");
    } catch {
      return migrationError("invalid-legacy-json");
    }
  }

  function legacyCollection(legacy, field, kind) {
    if (!hasOwn(legacy, field)) return kind === "array" ? [] : Object.create(null);
    const value = legacy[field];
    if (kind === "array") {
      if (!Array.isArray(value) || value.some((item) => !isText(item, { max: MAX_ID }))) {
        return migrationError("invalid-legacy-marker", { field });
      }
      return value;
    }
    if (!isPlainObject(value)) return migrationError("invalid-legacy-marker", { field });
    return value;
  }

  function legacyTimestamp(value, field) {
    const number = typeof value === "number" ? value : /^\d+$/.test(String(value ?? "")) ? Number(value) : NaN;
    if (!Number.isFinite(number) || number <= 0) return migrationError("invalid-legacy-timestamp", { field });
    const date = new Date(number);
    return Number.isNaN(date.getTime()) ? migrationError("invalid-legacy-timestamp", { field }) : date.toISOString();
  }

  function migrateLegacy(raw, renderedProgramSnapshot) {
    const legacy = legacyObject(raw);
    if (legacy?.kind === "migration-error") return legacy;
    if (!looksLegacy(legacy)) return migrationError("not-legacy-draft");
    if (!isPlainObject(renderedProgramSnapshot) ||
      !isPlainObject(renderedProgramSnapshot.programContext) ||
      !isPlainObject(renderedProgramSnapshot.sessionSelection) ||
      !isPlainObject(renderedProgramSnapshot.valueResolutions)) {
      return migrationError("invalid-migration-snapshot");
    }

    const programContext = renderedProgramSnapshot.programContext;
    const sessionSelection = renderedProgramSnapshot.sessionSelection;
    const valueResolutions = renderedProgramSnapshot.valueResolutions;
    const substitutionResolutions = renderedProgramSnapshot.substitutionResolutions ?? Object.create(null);
    if (!isPlainObject(substitutionResolutions)) return migrationError("invalid-substitution-resolutions");
    if (!Array.isArray(programContext.exercises)) return migrationError("invalid-migration-snapshot");

    const legacyExercises = Object.create(null);
    const allowedFields = Object.create(null);
    for (const source of programContext.exercises) {
      if (!isPlainObject(source) || !isText(source.legacyExerciseId, { max: MAX_ID }) ||
        !isSafeInteger(source.sets, 1) || !Array.isArray(source.setIds) || source.setIds.length !== source.sets ||
        source.setIds.some((setId) => !isText(setId, { max: MAX_ID })) ||
        hasOwn(legacyExercises, source.legacyExerciseId)) {
        return migrationError("invalid-legacy-exercise-map");
      }
      if (source.legacyExerciseId !== source.exerciseInstanceId) {
        return migrationError("legacy-exercise-identity-mismatch", { exerciseId: source.legacyExerciseId });
      }
      legacyExercises[source.legacyExerciseId] = source;
      for (let ordinal = 1; ordinal <= source.setIds?.length; ordinal++) {
        const setId = source.setIds[ordinal - 1];
        for (const field of EDIT_FIELDS) {
          const key = `${source.legacyExerciseId}_${ordinal}_${field}`;
          allowedFields[key] = { exerciseInstanceId: source.exerciseInstanceId, setId, field };
        }
      }
    }

    for (const key of Object.keys(legacy)) {
      if (!LEGACY_META_FIELDS.has(key) && !hasOwn(allowedFields, key)) {
        return migrationError("unknown-legacy-field", { field: key });
      }
    }
    const resolvedKeys = new Set(Object.keys(valueResolutions));
    for (const key of Object.keys(legacy)) {
      if (!hasOwn(allowedFields, key) && key !== "__bodyweight") continue;
      if (editableText(legacy[key]) === undefined) return migrationError("invalid-legacy-value", { field: key });
      if (!hasOwn(valueResolutions, key)) return migrationError("missing-value-resolution", { field: key });
      if (editableText(valueResolutions[key]) === undefined) return migrationError("invalid-value-resolution", { field: key });
      resolvedKeys.delete(key);
    }
    if (resolvedKeys.size) return migrationError("unused-value-resolution", { field: [...resolvedKeys][0] });

    const done = legacyCollection(legacy, "__done", "array");
    const touched = legacyCollection(legacy, "__touched", "array");
    const warm = legacyCollection(legacy, "__warm", "array");
    const skipped = legacyCollection(legacy, "__skipped", "array");
    const substituted = legacyCollection(legacy, "__substituted", "object");
    const substitutedRefs = legacyCollection(legacy, "__substitutedRef", "object");
    const exerciseNotes = legacyCollection(legacy, "__exnotes", "object");
    const collections = [done, touched, warm, skipped, substituted, substitutedRefs, exerciseNotes];
    const invalidCollection = collections.find((value) => value?.kind === "migration-error");
    if (invalidCollection) return invalidCollection;

    const contextTouched = legacyCollection(legacy, "__contextTouched", "object");
    if (contextTouched?.kind === "migration-error") return contextTouched;
    for (const key of Object.keys(contextTouched)) {
      if (!["day", "date", "sessionNotes", "bodyweight"].includes(key) || typeof contextTouched[key] !== "boolean") {
        return migrationError("invalid-legacy-context-marker", { field: key });
      }
    }
    const contextFields = {
      day: "__day",
      date: "__date",
      sessionNotes: "__sessionNotes",
      bodyweight: "__bodyweight",
    };
    for (const [contextField, legacyField] of Object.entries(contextFields)) {
      if (contextTouched[contextField] && !hasOwn(legacy, legacyField)) {
        return migrationError("missing-legacy-context-value", { field: legacyField });
      }
    }

    const legacySetKeys = Object.create(null);
    for (const [legacyExerciseId, source] of Object.entries(legacyExercises)) {
      for (let ordinal = 1; ordinal <= source.setIds.length; ordinal++) {
        legacySetKeys[`${legacyExerciseId}_${ordinal}`] = {
          exerciseInstanceId: source.exerciseInstanceId,
          setId: source.setIds[ordinal - 1],
        };
      }
    }
    for (const [field, values] of [["__done", done], ["__touched", touched], ["__warm", warm]]) {
      const unknown = values.find((key) => !hasOwn(legacySetKeys, key));
      if (unknown) return migrationError("unmapped-legacy-set", { field, setKey: unknown });
    }
    const exerciseMarkerMaps = [
      ["__skipped", skipped],
      ["__substituted", Object.keys(substituted)],
      ["__substitutedRef", Object.keys(substitutedRefs)],
      ["__exnotes", Object.keys(exerciseNotes)],
    ];
    for (const [field, ids] of exerciseMarkerMaps) {
      const unknown = ids.find((id) => !hasOwn(legacyExercises, id));
      if (unknown) return migrationError("unmapped-legacy-exercise", { field, exerciseId: unknown });
    }

    if (hasOwn(legacy, "__day")) {
      if (!isText(legacy.__day, { max: 500 }) || legacy.__day !== programContext.dayLabel) {
        return migrationError("legacy-day-mismatch");
      }
    }
    for (const field of ["__date", "__sessionNotes"]) {
      if (hasOwn(legacy, field) && !isText(legacy[field], { empty: true })) {
        return migrationError("invalid-legacy-metadata", { field });
      }
    }

    let startedAt = sessionSelection.startedAt;
    if (hasOwn(legacy, "__startedAt")) {
      startedAt = legacyTimestamp(legacy.__startedAt, "__startedAt");
      if (startedAt?.kind === "migration-error") return startedAt;
    }
    let completedAt = renderedProgramSnapshot.completedAt ?? sessionSelection.updatedAt ?? sessionSelection.startedAt;
    if (hasOwn(legacy, "__lastCommitAt")) {
      if (!done.length) return migrationError("orphan-legacy-last-commit");
      completedAt = legacyTimestamp(legacy.__lastCommitAt, "__lastCommitAt");
      if (completedAt?.kind === "migration-error") return completedAt;
    }
    if (done.length && !isText(completedAt, { max: 100 })) return migrationError("missing-completion-timestamp");

    const selectedFields = ["__selectedExercise", "__selectedExerciseId"].filter((field) => hasOwn(legacy, field));
    if (selectedFields.length > 1) return migrationError("ambiguous-legacy-selection");
    let selectedExerciseId = sessionSelection.selectedExerciseId;
    if (selectedFields.length) {
      const legacySelected = legacy[selectedFields[0]];
      if (!isText(legacySelected, { max: MAX_ID }) || !hasOwn(legacyExercises, legacySelected)) {
        return migrationError("unmapped-legacy-selection");
      }
      selectedExerciseId = legacyExercises[legacySelected].exerciseInstanceId;
    }

    const migratedSelection = {
      ...sessionSelection,
      scheduleDate: hasOwn(legacy, "__date") ? legacy.__date : sessionSelection.scheduleDate,
      bodyweight: hasOwn(legacy, "__bodyweight") ? valueResolutions.__bodyweight : sessionSelection.bodyweight,
      notes: hasOwn(legacy, "__sessionNotes") ? legacy.__sessionNotes : sessionSelection.notes,
      contextTouched: Object.fromEntries(CONTEXT_TOUCHED_FIELDS.map((field) => [field, !!contextTouched[field]])),
      selectedExerciseId,
      startedAt,
      updatedAt: renderedProgramSnapshot.migratedAt ?? completedAt ?? sessionSelection.updatedAt ?? startedAt,
    };
    const base = create(programContext, migratedSelection, renderedProgramSnapshot.previousSessionFacts);
    if (isDomainError(base)) return migrationError("invalid-migration-snapshot", { issues: base.issues ?? [base.code] });
    const next = jsonClone(base);
    const doneSet = new Set(done);
    const touchedSet = new Set(touched);
    const warmSet = new Set(warm);
    const skippedSet = new Set(skipped);

    for (const [legacyKey, target] of Object.entries(allowedFields)) {
      if (!hasOwn(legacy, legacyKey)) continue;
      const value = editableText(valueResolutions[legacyKey]);
      if (value === undefined) return migrationError("invalid-value-resolution", { field: legacyKey });
      next.exercises[target.exerciseInstanceId].sets[target.setId].edited[target.field] = value;
    }
    for (const [legacySetKey, target] of Object.entries(legacySetKeys)) {
      const set = next.exercises[target.exerciseInstanceId].sets[target.setId];
      if (touchedSet.has(legacySetKey)) set.touched = { load: true, reps: true, effort: true };
      if (doneSet.has(legacySetKey)) set.completion = { completedAt };
      if (warmSet.has(legacySetKey)) set.role = "warmup";
    }
    for (const [legacyExerciseId, source] of Object.entries(legacyExercises)) {
      const exercise = next.exercises[source.exerciseInstanceId];
      if (skippedSet.has(legacyExerciseId)) exercise.status = "skipped";
      if (hasOwn(exerciseNotes, legacyExerciseId)) {
        if (!isText(exerciseNotes[legacyExerciseId], { empty: true })) {
          return migrationError("invalid-legacy-exercise-note", { exerciseId: legacyExerciseId });
        }
        exercise.setupNotes = exerciseNotes[legacyExerciseId];
      }
      if (!hasOwn(substituted, legacyExerciseId)) continue;
      const legacyName = substituted[legacyExerciseId];
      const legacyRef = hasOwn(substitutedRefs, legacyExerciseId) ? substitutedRefs[legacyExerciseId] : null;
      if (!isText(legacyName, { max: 500 }) || (legacyRef != null && !isText(legacyRef, { max: MAX_ID }))) {
        return migrationError("invalid-legacy-substitution", { exerciseId: legacyExerciseId });
      }
      const resolution = substitutionResolutions[legacyExerciseId];
      if (!isPlainObject(resolution) || resolution.legacyName !== legacyName ||
        (resolution.legacyRef ?? null) !== legacyRef) {
        return migrationError("unresolved-legacy-substitution", { exerciseId: legacyExerciseId });
      }
      const issues = [];
      validateMovementSnapshot(resolution.replacement, "replacement", issues);
      if (issues.length) return migrationError("invalid-substitution-resolution", { exerciseId: legacyExerciseId, issues });
      exercise.substitution = {
        original: snapshotFromExercise(exercise),
        replacement: jsonClone(resolution.replacement),
        selectedAt: resolution.selectedAt ?? renderedProgramSnapshot.migratedAt,
      };
      if (!isText(exercise.substitution.selectedAt, { max: 100 })) {
        return migrationError("missing-substitution-timestamp", { exerciseId: legacyExerciseId });
      }
    }
    for (const legacyExerciseId of Object.keys(substitutedRefs)) {
      if (!hasOwn(substituted, legacyExerciseId)) {
        return migrationError("orphan-legacy-substitution-ref", { exerciseId: legacyExerciseId });
      }
    }
    const unusedSubstitution = Object.keys(substitutionResolutions).find((legacyExerciseId) => !hasOwn(substituted, legacyExerciseId));
    if (unusedSubstitution) {
      return migrationError("unused-substitution-resolution", { exerciseId: unusedSubstitution });
    }
    if (next.session.selectedExerciseId && next.exercises[next.session.selectedExerciseId].status === "skipped") {
      return migrationError("selected-legacy-exercise-skipped");
    }

    const checked = validate(next);
    return checked.ok
      ? deepFreeze(next)
      : migrationError("invalid-migrated-draft", { issues: checked.issues });
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    create,
    parse,
    migrateLegacy,
    reduce,
    toHistoryRows,
    validate,
    validateForSave,
    isPristine,
    serialize,
    logicalCloneSection,
    isDomainError,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeWorkoutDraft = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
