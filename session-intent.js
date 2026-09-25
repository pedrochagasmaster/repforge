(function (root) {
  "use strict";

  // Session intent — what a performed session *was*, and therefore what it may
  // count for. The one-off specification
  // (docs/superpowers/specs/2026-08-25-one-off-session-design.md §10–§11)
  // separates three ledgers that the flat log would otherwise conflate:
  //
  //   athlete history      every performed set (History, PRs, general stats)
  //   program completion   completed program days, adherence, block volume
  //   progression evidence the history automatic program progression reads
  //
  // A normal planned session and an adapted planned session belong to all
  // three. A pure one-off belongs only to athlete history. The distinction is
  // carried explicitly by a validated session context and by flat fields
  // stamped on each saved row, never inferred from a UI path or a day label.
  //
  // This module is pure: no DOM, storage, globals, clock, or randomness. It
  // owns the vocabulary, the context normalizer, the row stamp, and the scoped
  // selectors consumers use instead of re-deriving eligibility themselves.

  const SCHEMA_VERSION = 1;
  const PLANNED = "planned";
  const PLANNED_ADAPTED = "planned_adapted";
  const ONE_OFF = "one_off";
  const SESSION_KINDS = Object.freeze([PLANNED, PLANNED_ADAPTED, ONE_OFF]);
  // Free intents only. The Pro program mix (spec §8.3, Slice 4) extends this
  // enum when it ships; until then a stored "program_mix" is rejected rather
  // than executed under a capability that does not exist.
  const ONE_OFF_INTENTS = Object.freeze(["classic", "muscle_focus", "manual"]);
  // The exercise-library equipment vocabulary (exercises.js). Program metadata
  // uses a different plural vocabulary; session-planner.js owns that mapping.
  const EQUIPMENT_CODES = Object.freeze(["barbell", "dumbbell", "cable", "machine", "smith", "bodyweight"]);
  // Total gym-time budgets offered by the builder. 90 means "90+ minutes".
  const TIME_BUDGETS = Object.freeze([20, 30, 45, 60, 75, 90]);
  const EXERCISE_ORIGINS = Object.freeze(["program", "substitute", "catalogue", "manual"]);
  const SCOPES = Object.freeze(["all_training", "program_completion", "program_progression", "active_block"]);
  const ONE_OFF_DAY_PREFIX = "one-off:";
  const MAX_ID = 240;
  const MAX_NAME = 500;

  const MuscleDomain = root?.RepForgeProgramEntry ||
    (typeof require === "function" ? require("./program-entry.js") : null);
  const MUSCLE_TOKENS = new Set(MuscleDomain?.MUSCLE_TOKENS || []);

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function isText(value, max = MAX_ID) {
    return typeof value === "string" && value.trim().length > 0 && value.length <= max;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function rejectUnknownKeys(value, allowed, path, issues) {
    for (const key of Object.keys(value)) if (!allowed.includes(key)) issues.push(`${path}.${key}:unknown`);
  }

  function nullableText(value, path, issues, max = MAX_ID) {
    if (value === null) return null;
    if (!isText(value, max)) {
      issues.push(path);
      return null;
    }
    return value;
  }

  function normalizeMuscles(value, path, issues, maxItems) {
    if (!Array.isArray(value)) {
      issues.push(`${path}:array`);
      return [];
    }
    if (value.length > maxItems) issues.push(`${path}:too-many`);
    const out = [];
    for (const token of value) {
      if (!MUSCLE_TOKENS.has(token)) issues.push(`${path}:unknown-muscle`);
      else if (out.includes(token)) issues.push(`${path}:duplicate`);
      else out.push(token);
    }
    return out;
  }

  function normalizeEquipmentList(value, path, issues) {
    if (!Array.isArray(value)) {
      issues.push(`${path}:array`);
      return [];
    }
    const seen = new Set();
    for (const code of value) {
      if (!EQUIPMENT_CODES.includes(code)) issues.push(`${path}:unknown-equipment`);
      else if (seen.has(code)) issues.push(`${path}:duplicate`);
      else seen.add(code);
    }
    // Canonical order so equal inventories normalize to equal values.
    return EQUIPMENT_CODES.filter((code) => seen.has(code));
  }

  function normalizeConstraints(value, path, issues) {
    if (value === null) return null;
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return null;
    }
    rejectUnknownKeys(value, ["minutes", "equipment", "minimizeEquipmentChanges"], path, issues);
    const out = {};
    if (value.minutes === null) out.minutes = null;
    else if (TIME_BUDGETS.includes(value.minutes)) out.minutes = value.minutes;
    else issues.push(`${path}.minutes`);
    if (value.equipment === null) out.equipment = null;
    else {
      out.equipment = normalizeEquipmentList(value.equipment, `${path}.equipment`, issues);
      // A selected inventory is a real constraint. An empty one is a failure
      // to choose, never permission to ignore equipment.
      if (Array.isArray(value.equipment) && value.equipment.length === 0) issues.push(`${path}.equipment:empty`);
    }
    if (typeof value.minimizeEquipmentChanges !== "boolean") issues.push(`${path}.minimizeEquipmentChanges`);
    out.minimizeEquipmentChanges = value.minimizeEquipmentChanges === true;
    return out;
  }

  function normalizeSource(value, kind, issues) {
    const path = "source";
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return null;
    }
    rejectUnknownKeys(value, ["programId", "programFingerprint", "dayId", "dayLabel"], path, issues);
    const out = {
      programId: nullableText(value.programId ?? null, `${path}.programId`, issues),
      programFingerprint: nullableText(value.programFingerprint ?? null, `${path}.programFingerprint`, issues, 2000),
      dayId: nullableText(value.dayId ?? null, `${path}.dayId`, issues),
      dayLabel: nullableText(value.dayLabel ?? null, `${path}.dayLabel`, issues, MAX_NAME),
    };
    // An adapted planned session *is* a program day; it must name the exact
    // program and day it executes. A one-off may record the program it was
    // built beside (explanation only) but is never bound to it.
    if (kind === PLANNED_ADAPTED) {
      for (const field of ["programId", "programFingerprint", "dayId", "dayLabel"]) {
        if (out[field] === null) issues.push(`${path}.${field}:required`);
      }
    }
    if ((out.dayId === null) !== (out.dayLabel === null)) issues.push(`${path}.day:pair`);
    return out;
  }

  function normalizeFocus(value, intent, issues) {
    const path = "focus";
    if (value === null) {
      if (intent === "classic" || intent === "muscle_focus") issues.push(`${path}:required`);
      return null;
    }
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return null;
    }
    rejectUnknownKeys(value, ["classic", "primaryMuscles", "secondaryMuscles"], path, issues);
    const out = {
      classic: nullableText(value.classic ?? null, `${path}.classic`, issues, 80),
      primaryMuscles: normalizeMuscles(value.primaryMuscles ?? [], `${path}.primaryMuscles`, issues, 1),
      secondaryMuscles: normalizeMuscles(value.secondaryMuscles ?? [], `${path}.secondaryMuscles`, issues, 2),
    };
    if (out.secondaryMuscles.some((token) => out.primaryMuscles.includes(token))) issues.push(`${path}:overlap`);
    if (intent === "classic" && (out.classic === null || out.primaryMuscles.length || out.secondaryMuscles.length)) {
      issues.push(`${path}:classic-shape`);
    }
    if (intent === "muscle_focus" && (out.classic !== null || out.primaryMuscles.length !== 1)) {
      issues.push(`${path}:muscle-shape`);
    }
    if (intent !== "classic" && intent !== "muscle_focus") issues.push(`${path}:unexpected`);
    return out;
  }

  function normalizeGeneration(value, intent, issues) {
    const path = "generation";
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return null;
    }
    rejectUnknownKeys(value, ["engineVersion", "blueprintId", "blueprintVersion", "catalogVersion"], path, issues);
    const out = {
      engineVersion: value.engineVersion,
      blueprintId: nullableText(value.blueprintId ?? null, `${path}.blueprintId`, issues, 80),
      blueprintVersion: value.blueprintVersion ?? null,
      catalogVersion: nullableText(value.catalogVersion ?? null, `${path}.catalogVersion`, issues, 200),
    };
    if (!Number.isSafeInteger(out.engineVersion) || out.engineVersion < 1) issues.push(`${path}.engineVersion`);
    if (out.blueprintVersion !== null && (!Number.isSafeInteger(out.blueprintVersion) || out.blueprintVersion < 1)) {
      issues.push(`${path}.blueprintVersion`);
    }
    if ((out.blueprintId === null) !== (out.blueprintVersion === null)) issues.push(`${path}.blueprint:pair`);
    if ((intent === "classic") !== (out.blueprintId !== null)) issues.push(`${path}.blueprintId:intent`);
    return out;
  }

  function normalizeExercises(value, kind, issues) {
    const path = "exercises";
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return {};
    }
    const out = {};
    const ids = Object.keys(value);
    if (!ids.length) issues.push(`${path}:empty`);
    for (const id of ids) {
      const item = value[id];
      const itemPath = `${path}.${id}`;
      if (!isText(id) || !isPlainObject(item)) {
        issues.push(itemPath);
        continue;
      }
      rejectUnknownKeys(item, ["origin", "sourceExerciseId", "sourceDay", "isNew"], itemPath, issues);
      const origin = item.origin;
      if (!EXERCISE_ORIGINS.includes(origin)) issues.push(`${itemPath}.origin`);
      const sourceExerciseId = nullableText(item.sourceExerciseId ?? null, `${itemPath}.sourceExerciseId`, issues);
      const sourceDay = nullableText(item.sourceDay ?? null, `${itemPath}.sourceDay`, issues, MAX_NAME);
      const programDerived = origin === "program" || origin === "substitute";
      // Program-derived work names the exact program exercise it came from;
      // anything else must not pretend to.
      if (programDerived && (sourceExerciseId === null || sourceDay === null)) issues.push(`${itemPath}.source:required`);
      if (!programDerived && (sourceExerciseId !== null || sourceDay !== null)) issues.push(`${itemPath}.source:unexpected`);
      // An adapted planned session contains only the day's own exercises or
      // their session-only substitutes. Catalogue fill would make it a
      // different session.
      if (kind === PLANNED_ADAPTED && !programDerived) issues.push(`${itemPath}.origin:adapted`);
      if (typeof item.isNew !== "boolean") issues.push(`${itemPath}.isNew`);
      out[id] = { origin, sourceExerciseId, sourceDay, isNew: item.isNew === true };
    }
    return out;
  }

  function normalizeAdaptation(value, kind, issues) {
    const path = "adaptation";
    if (kind !== PLANNED_ADAPTED) {
      if (value !== null) issues.push(`${path}:unexpected`);
      return null;
    }
    if (!isPlainObject(value)) {
      issues.push(`${path}:object`);
      return null;
    }
    rejectUnknownKeys(value, ["preservedPurposes", "omittedExerciseIds", "purposePreserved"], path, issues);
    const list = (field) => {
      const raw = value[field];
      if (!Array.isArray(raw) || raw.some((id) => !isText(id)) || new Set(raw).size !== raw.length) {
        issues.push(`${path}.${field}`);
        return [];
      }
      return raw.slice();
    };
    const out = {
      preservedPurposes: list("preservedPurposes"),
      omittedExerciseIds: list("omittedExerciseIds"),
      purposePreserved: value.purposePreserved,
    };
    // Spec §8.2: the adapted session counts as the planned session only when
    // every declared primary purpose remains represented. A context claiming
    // otherwise is not an adapted planned session; it is a one-off.
    if (out.purposePreserved !== true) issues.push(`${path}.purposePreserved`);
    if (!out.preservedPurposes.length) issues.push(`${path}.preservedPurposes:empty`);
    return out;
  }

  // Validates and canonicalizes a session context. Returns
  // { ok: true, context } with a deep-frozen canonical value, or
  // { ok: false, issues }. `planned` is accepted for completeness but normal
  // planned drafts do not carry a context at all: absence means planned.
  function normalizeContext(value) {
    const issues = [];
    if (!isPlainObject(value)) return deepFreeze({ ok: false, issues: ["context:object"] });
    rejectUnknownKeys(value, ["schemaVersion", "sessionKind", "oneOffIntent", "name", "source", "focus",
      "constraints", "generation", "exercises", "adaptation"], "context", issues);
    if (value.schemaVersion !== SCHEMA_VERSION) issues.push("schemaVersion");
    const kind = value.sessionKind;
    if (!SESSION_KINDS.includes(kind)) issues.push("sessionKind");
    const intent = value.oneOffIntent ?? null;
    if (kind === ONE_OFF ? !ONE_OFF_INTENTS.includes(intent) : intent !== null) issues.push("oneOffIntent");
    if (!isText(value.name, MAX_NAME)) issues.push("name");
    const context = {
      schemaVersion: SCHEMA_VERSION,
      sessionKind: kind,
      oneOffIntent: kind === ONE_OFF ? intent : null,
      name: value.name,
      source: normalizeSource(value.source, kind, issues),
      focus: normalizeFocus(value.focus ?? null, intent, issues),
      constraints: normalizeConstraints(value.constraints ?? null, "constraints", issues),
      generation: normalizeGeneration(value.generation, intent, issues),
      exercises: normalizeExercises(value.exercises, kind, issues),
      adaptation: normalizeAdaptation(value.adaptation ?? null, kind, issues),
    };
    if (kind === PLANNED_ADAPTED && context.constraints === null) issues.push("constraints:required");
    if (kind === PLANNED && (context.constraints !== null || context.focus !== null)) issues.push("planned:shape");
    return issues.length ? deepFreeze({ ok: false, issues }) : deepFreeze({ ok: true, context });
  }

  // The consequences table of spec §10, as data. Derived from the kind alone,
  // so no stored flag can disagree with it.
  const CONSEQUENCES = deepFreeze({
    [PLANNED]: { countsAsProgramDay: true, adherenceEligible: true, blockVolumeEligible: true,
      progressionEligible: true, altersDayQueue: true },
    [PLANNED_ADAPTED]: { countsAsProgramDay: true, adherenceEligible: true, blockVolumeEligible: true,
      progressionEligible: true, altersDayQueue: true },
    [ONE_OFF]: { countsAsProgramDay: false, adherenceEligible: false, blockVolumeEligible: false,
      progressionEligible: false, altersDayQueue: false },
  });

  // Answers every provenance question for an accepted context (or for a draft
  // with no context, which is a normal planned session).
  function classify(context) {
    const value = context == null ? { sessionKind: PLANNED, oneOffIntent: null, name: null, source: null, constraints: null, generation: null } : context;
    const kind = value.sessionKind;
    if (!SESSION_KINDS.includes(kind)) return null;
    return deepFreeze({
      sessionKind: kind,
      isPlanned: kind === PLANNED,
      isAdaptedPlanned: kind === PLANNED_ADAPTED,
      isOneOff: kind === ONE_OFF,
      oneOffIntent: kind === ONE_OFF ? value.oneOffIntent : null,
      generatedBy: kind === ONE_OFF
        ? { intent: value.oneOffIntent, blueprintId: value.generation?.blueprintId ?? null,
          blueprintVersion: value.generation?.blueprintVersion ?? null,
          engineVersion: value.generation?.engineVersion ?? null,
          catalogVersion: value.generation?.catalogVersion ?? null }
        : kind === PLANNED_ADAPTED
          ? { intent: "adaptation", blueprintId: null, blueprintVersion: null,
            engineVersion: value.generation?.engineVersion ?? null,
            catalogVersion: value.generation?.catalogVersion ?? null }
          : { intent: "program", blueprintId: null, blueprintVersion: null, engineVersion: null, catalogVersion: null },
      constraints: value.constraints ?? null,
      historyVisible: true,
      allTrainingEligible: true,
      ...CONSEQUENCES[kind],
      historyClass: kind,
    });
  }

  function exerciseProgressionEvidence(context, exerciseInstanceId) {
    const facts = classify(context);
    if (!facts || !facts.progressionEligible) return false;
    if (context == null) return true;
    return hasOwn(context.exercises, exerciseInstanceId);
  }

  // Flat fields repeated on each saved row of a session with a context
  // (spec §11.4). Planned sessions with no context stamp nothing, so their
  // rows stay byte-identical to today's.
  function rowFields(context, exerciseInstanceId) {
    const facts = classify(context);
    if (!facts || context == null) return {};
    const out = {
      sessionKind: facts.sessionKind,
      programCompletionEligible: facts.countsAsProgramDay,
      progressionEligible: facts.progressionEligible,
    };
    if (facts.isOneOff) out.oneOffIntent = facts.oneOffIntent;
    if (facts.isAdaptedPlanned) out.sourceProgramId = context.source.programId;
    const exercise = hasOwn(context.exercises, exerciseInstanceId) ? context.exercises[exerciseInstanceId] : null;
    if (exercise?.sourceExerciseId) {
      out.sourceExerciseId = exercise.sourceExerciseId;
      out.sourceDay = exercise.sourceDay;
    }
    return out;
  }

  // Eligibility of one stored row. Older rows without the new fields keep
  // today's behavior (spec §11.4): they are planned and eligible, and nothing
  // retroactively guesses which were one-offs. A row that names a kind this
  // version does not know, or a one-off that claims eligibility, fails closed
  // for the program ledgers while staying in athlete history.
  function rowEligibility(row) {
    if (!row || typeof row !== "object") {
      return { sessionKind: "invalid", legacy: false, programCompletion: false, progression: false };
    }
    const hasKind = hasOwn(row, "sessionKind") && row.sessionKind != null;
    const kind = hasKind ? row.sessionKind : null;
    if (hasKind && !SESSION_KINDS.includes(kind)) return { sessionKind: "unknown", legacy: false, programCompletion: false, progression: false };
    const base = hasKind ? CONSEQUENCES[kind] : CONSEQUENCES[PLANNED];
    return {
      sessionKind: hasKind ? kind : PLANNED,
      legacy: !hasKind,
      programCompletion: base.countsAsProgramDay && row.programCompletionEligible !== false,
      progression: base.progressionEligible && row.progressionEligible !== false,
    };
  }

  function belongsToBlock(row, blockId) {
    const id = String(blockId ?? "").trim();
    // Mirrors progress-model: a modern block needs row provenance; a program
    // without a block id has no block boundary to enforce.
    return !id || String(row?.blockId ?? "").trim() === id;
  }

  function rowInScope(row, scope, { blockId = null } = {}) {
    if (!SCOPES.includes(scope)) throw new RangeError(`unknown history scope: ${scope}`);
    if (!row || typeof row !== "object") return false;
    if (scope === "all_training") return true;
    const eligibility = rowEligibility(row);
    if (scope === "program_progression") return eligibility.progression;
    if (scope === "program_completion") return eligibility.programCompletion;
    return eligibility.programCompletion && belongsToBlock(row, blockId);
  }

  function selectRows(rows, scope, options) {
    return (Array.isArray(rows) ? rows : []).filter((row) => rowInScope(row, scope, options));
  }

  // Spec §11.5: general stats and PRs read all_training; load/rep
  // recommendations read program_progression; block trends read active_block.
  // `matches` is the caller's existing performed-identity predicate (matchLift);
  // this selector never weakens identity, it only narrows authority.
  function historyForMovement(rows, matches, scope, options) {
    if (typeof matches !== "function") throw new TypeError("movement matcher required");
    return selectRows(rows, scope, options).filter((row) => matches(row));
  }

  function chronologyKey(row) {
    return `${String(row?.date ?? "")}\u0000${String(row?.created ?? "")}`;
  }

  // One entry per distinct session id, in chronological order, restricted to
  // a scope. Duplicate rows of the same session (a repeated completion attempt
  // or an import merge) never produce a second session.
  function sessions(rows, scope = "all_training", options) {
    const bySession = new Map();
    for (const row of selectRows(rows, scope, options)) {
      const id = String(row.session ?? row.date ?? "");
      if (!id) continue;
      let entry = bySession.get(id);
      if (!entry) {
        entry = { session: id, date: row.date ?? null, day: row.day ?? null, created: row.created ?? null,
          sessionKind: rowEligibility(row).sessionKind };
        bySession.set(id, entry);
      } else if (chronologyKey(row) > chronologyKey(entry)) {
        entry.date = row.date ?? entry.date;
        entry.created = row.created ?? entry.created;
      }
    }
    return [...bySession.values()].sort((a, b) =>
      chronologyKey(a) < chronologyKey(b) ? -1 : chronologyKey(a) > chronologyKey(b) ? 1 : a.session.localeCompare(b.session));
  }

  // The three-ledger oracle of spec §17.2 for a whole log.
  function ledgers(rows, options) {
    return {
      athleteHistory: sessions(rows, "all_training"),
      programCompletion: sessions(rows, "program_completion"),
      progressionEvidence: sessions(rows, "program_progression"),
      activeBlock: sessions(rows, "active_block", options),
    };
  }

  // Mirrors Today's queue rule (the day after the last program session trained
  // today, else the current day) but reads only the program-completion ledger,
  // so a one-off can never move the queue — including a one-off whose name
  // equals a program day label.
  function nextProgramDay(programDays, rows, { date, currentDay } = {}) {
    const days = Array.isArray(programDays) ? programDays.filter((day) => typeof day === "string") : [];
    if (!days.length) return null;
    const done = sessions(rows, "program_completion").filter((entry) => date == null || entry.date === date);
    const from = done.length ? done.at(-1).day : currentDay;
    const index = days.indexOf(from);
    if (index < 0) return days[0];
    return days.length > 1 ? days[(index + 1) % days.length] : null;
  }

  // History projection of one saved session: its class and the stored label.
  // Labels are never rewritten; a one-off keeps the name it was saved with.
  function historyClass(sessionRows) {
    const rows = (Array.isArray(sessionRows) ? sessionRows : []).filter((row) => row && typeof row === "object");
    if (!rows.length) return null;
    const kinds = new Set(rows.map((row) => rowEligibility(row).sessionKind));
    const kind = kinds.size === 1 ? [...kinds][0] : "mixed";
    const intent = kind === ONE_OFF ? rows.find((row) => ONE_OFF_INTENTS.includes(row.oneOffIntent))?.oneOffIntent ?? null : null;
    return deepFreeze({
      historyClass: kind,
      legacy: rows.every((row) => rowEligibility(row).legacy),
      oneOffIntent: intent,
      label: rows[0].day ?? null,
      countsAsProgramDay: rows.every((row) => rowEligibility(row).programCompletion),
    });
  }

  // Parse-time rule for the workout draft: a pure one-off preserves its
  // accepted snapshot when the program changes (spec §13); planned and adapted
  // sessions stay bound to their program day exactly as today.
  function bindsToProgram(context) {
    return context == null || context.sessionKind !== ONE_OFF;
  }

  function oneOffDayId(intent) {
    return `${ONE_OFF_DAY_PREFIX}${intent}`;
  }

  // Cross-checks between an accepted context and the draft aggregate that
  // carries it. Returns issue codes; empty means coherent.
  function draftIssues(context, draft) {
    const issues = [];
    const ids = Array.isArray(draft?.exerciseOrder) ? draft.exerciseOrder : [];
    const contextIds = Object.keys(context.exercises);
    if (contextIds.length !== ids.length || ids.some((id) => !hasOwn(context.exercises, id))) {
      issues.push("sessionContext.exercises:coverage");
    }
    const program = draft?.program || {};
    if (context.sessionKind === ONE_OFF) {
      if (program.dayId !== oneOffDayId(context.oneOffIntent)) issues.push("sessionContext:one-off-day");
      if (program.dayLabel !== context.name) issues.push("sessionContext:one-off-label");
      // A one-off never carries the active block, so no block-scoped consumer
      // can count it even before it learns to read eligibility.
      if (hasOwn(program, "blockId")) issues.push("sessionContext:one-off-block");
    }
    if (context.sessionKind === PLANNED_ADAPTED) {
      if (program.programId !== context.source.programId || program.dayId !== context.source.dayId ||
        program.dayLabel !== context.source.dayLabel) issues.push("sessionContext:adapted-day");
    }
    if (context.sessionKind === PLANNED) issues.push("sessionContext:planned-implicit");
    return issues;
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    SESSION_KINDS,
    ONE_OFF_INTENTS,
    EQUIPMENT_CODES,
    TIME_BUDGETS,
    EXERCISE_ORIGINS,
    SCOPES,
    normalizeContext,
    classify,
    exerciseProgressionEvidence,
    rowFields,
    rowEligibility,
    rowInScope,
    selectRows,
    historyForMovement,
    sessions,
    ledgers,
    nextProgramDay,
    historyClass,
    bindsToProgram,
    oneOffDayId,
    draftIssues,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSessionIntent = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
