(function (root) {
  "use strict";

  // Session planner — deterministic Free one-off generation and user-directed
  // planned-session adaptation (one-off spec §7.3, §8.2, §8.4–§8.6, §9).
  //
  // Pure: every function takes normalized inputs (catalogue, program snapshot,
  // history rows, constraints) and returns a frozen plan or an explicit
  // failure. Nothing here reads storage, the DOM, the clock, or randomness, and
  // no input is ever written to — the active program is only read.
  //
  // The accepted plan is not a workout. It becomes one only when the existing
  // workout-session owner creates its single DraftV2 aggregate from
  // `oneOffDraftContext` / `adaptedDraftContext`; execution, recovery and save
  // stay with that owner. Program-mix (Pro) planning is intentionally absent.

  const ENGINE_VERSION = 1;
  const Intent = root?.RepForgeSessionIntent ||
    (typeof require === "function" ? require("./session-intent.js") : null);
  const Compiler = root?.RepForgeProgramCompiler ||
    (typeof require === "function" ? require("./program-compiler.js") : null);
  // One time model for the product: the compiler's per-set, warm-up,
  // transition and buffer constants (the same ones that size program days).
  const TIME = Compiler.RULES.time;
  const EQUIPMENT_CODES = Intent.EQUIPMENT_CODES;
  const MUSCLE_TOKENS = new Set((root?.RepForgeProgramEntry ||
    (typeof require === "function" ? require("./program-entry.js") : null))?.MUSCLE_TOKENS || []);

  // Program metadata stores a plural equipment vocabulary
  // (shared-setup.js EQUIPMENT_VALUES). The two vocabularies are never
  // compared implicitly (spec §7.3 step 3); this table is the whole mapping.
  const PROGRAM_EQUIPMENT_CODES = Object.freeze({
    machines: Object.freeze(["machine"]),
    cables: Object.freeze(["cable"]),
    dumbbells: Object.freeze(["dumbbell"]),
    barbells: Object.freeze(["barbell"]),
    bodyweight: Object.freeze(["bodyweight"]),
  });

  // Starting checklists only. Each expands to an exact inventory the athlete
  // must still see and may edit; none of them asserts what a real gym has.
  const EQUIPMENT_SHORTCUTS = Object.freeze({
    full_gym: Object.freeze([...EQUIPMENT_CODES]),
    hotel_basic: Object.freeze(["dumbbell", "cable", "machine", "bodyweight"]),
    dumbbells_only: Object.freeze(["dumbbell", "bodyweight"]),
    barbell_rack: Object.freeze(["barbell", "bodyweight"]),
    machines_cables: Object.freeze(["cable", "machine"]),
    bodyweight: Object.freeze(["bodyweight"]),
    customize: Object.freeze([]),
  });
  const SHORTCUT_IDS = Object.freeze(["same_as_program", ...Object.keys(EQUIPMENT_SHORTCUTS)]);

  const COMPOUND_PATTERNS = new Set(["squat", "hinge", "press", "incline_press", "shoulder_press", "row", "pulldown"]);
  const DEFAULT_SETS = 3;
  const MIN_SETS = 2;
  const REPS = Object.freeze({ compound: Object.freeze([6, 10]), isolation: Object.freeze([10, 15]) });
  const TARGET_RIR = Object.freeze({ compound: 2, isolation: 1 });
  const MAX_MANUAL_EXERCISES = 20;

  const slot = (id, patterns, { required = false, priority = 0, distinctFrom = null } = {}) =>
    Object.freeze({ id, patterns: Object.freeze(patterns), required, priority, distinctFrom });

  // Original, versioned Taurifer one-session blueprints (spec §8.4). Slot
  // order is session order; `priority` orders optional slots for time
  // (lower is kept first); `distinctFrom` asks for a different movement
  // pattern than another slot's pick. No blueprint declares its own
  // progression engine.
  const CLASSIC_BLUEPRINTS = Object.freeze({
    full_body: Object.freeze({ id: "classic-full-body", version: 1, name: "Full body", slots: Object.freeze([
      slot("lower", ["squat", "hinge"], { required: true }),
      slot("press", ["press", "incline_press", "shoulder_press"], { required: true }),
      slot("pull", ["row", "pulldown"], { required: true }),
      slot("lower_second", ["squat", "hinge"], { priority: 1, distinctFrom: "lower" }),
      slot("delts", ["lateral_raise", "rear_delt", "delts"], { priority: 2 }),
      slot("arms", ["curl", "triceps"], { priority: 3 }),
    ]) }),
    upper: Object.freeze({ id: "classic-upper", version: 1, name: "Upper body", slots: Object.freeze([
      slot("press", ["press", "incline_press", "shoulder_press"], { required: true }),
      slot("pull", ["row", "pulldown"], { required: true }),
      slot("press_second", ["incline_press", "shoulder_press", "press"], { priority: 1, distinctFrom: "press" }),
      slot("pull_second", ["pulldown", "row"], { priority: 1, distinctFrom: "pull" }),
      slot("delts", ["lateral_raise", "rear_delt", "delts"], { priority: 2 }),
      slot("biceps", ["curl"], { priority: 3 }),
      slot("triceps", ["triceps"], { priority: 3 }),
    ]) }),
    lower: Object.freeze({ id: "classic-lower", version: 1, name: "Lower body", slots: Object.freeze([
      slot("knee", ["squat"], { required: true }),
      slot("hip", ["hinge"], { required: true }),
      slot("hamstrings", ["leg_curl"], { priority: 1 }),
      slot("glutes", ["abduction", "hinge"], { priority: 2 }),
      slot("calves", ["calves"], { priority: 3 }),
    ]) }),
    push: Object.freeze({ id: "classic-push", version: 1, name: "Push", slots: Object.freeze([
      slot("chest_press", ["press", "incline_press"], { required: true }),
      slot("delts", ["shoulder_press", "lateral_raise", "delts"], { required: true }),
      slot("triceps", ["triceps"], { priority: 1 }),
      slot("press_second", ["incline_press", "press", "chest_iso"], { priority: 2, distinctFrom: "chest_press" }),
    ]) }),
    pull: Object.freeze({ id: "classic-pull", version: 1, name: "Pull", slots: Object.freeze([
      slot("lat", ["pulldown"], { required: true }),
      slot("row", ["row"], { required: true }),
      slot("rear_delts", ["rear_delt"], { priority: 1 }),
      slot("biceps", ["curl"], { priority: 2 }),
    ]) }),
    legs: Object.freeze({ id: "classic-legs", version: 1, name: "Legs", slots: Object.freeze([
      slot("quads", ["squat", "leg_extension"], { required: true }),
      slot("hamstrings_glutes", ["hinge", "leg_curl"], { required: true }),
      slot("calves", ["calves"], { priority: 1 }),
      slot("lower_second", ["squat", "hinge", "leg_curl", "leg_extension"], { priority: 2 }),
    ]) }),
    arms_shoulders: Object.freeze({ id: "classic-arms-shoulders", version: 1, name: "Arms and shoulders", slots: Object.freeze([
      slot("biceps", ["curl"], { required: true }),
      slot("triceps", ["triceps"], { required: true }),
      slot("delts", ["lateral_raise", "shoulder_press", "delts", "rear_delt"], { required: true }),
      slot("extra", ["curl", "triceps", "lateral_raise", "rear_delt"], { priority: 1 }),
    ]) }),
  });

  // Compiler slot statuses carried on projected program rows as `priority`.
  // Lower removal rank is removed first when a planned day must shrink.
  const REMOVAL_RANK = Object.freeze({ optional: 0, conditional: 1, reducible: 2 });

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
    return value;
  }

  function fail(code, details) {
    return deepFreeze({ ok: false, code, ...(details || {}) });
  }

  function tokens(value) {
    return String(value ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  }

  function compareText(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // FNV-1a, for stable version fingerprints only (not security).
  function fingerprint(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  // ---------------------------------------------------------------- equipment

  // Maps the program's plural metadata to catalogue codes. Unknown values are
  // reported, never guessed.
  function programEquipmentCodes(programEquipment) {
    if (!Array.isArray(programEquipment) || !programEquipment.length) {
      return deepFreeze({ equipment: [], unmapped: [], known: false });
    }
    const codes = new Set();
    const unmapped = [];
    for (const value of programEquipment) {
      const mapped = typeof value === "string" && hasOwn(PROGRAM_EQUIPMENT_CODES, value) ? PROGRAM_EQUIPMENT_CODES[value] : null;
      if (mapped) mapped.forEach((code) => codes.add(code));
      else unmapped.push(String(value));
    }
    return deepFreeze({ equipment: EQUIPMENT_CODES.filter((code) => codes.has(code)), unmapped, known: codes.size > 0 });
  }

  // Expands a shortcut to its exact starting inventory. The result is a
  // proposal for the athlete to confirm or edit, not a stored profile.
  function expandEquipmentShortcut(shortcut, { programEquipment = null } = {}) {
    if (!SHORTCUT_IDS.includes(shortcut)) return fail("unknown-equipment-shortcut", { shortcut: String(shortcut) });
    if (shortcut === "same_as_program") {
      const mapped = programEquipmentCodes(programEquipment);
      if (!mapped.known) return fail("program-equipment-unknown", { unmapped: mapped.unmapped });
      return deepFreeze({ ok: true, shortcut, equipment: mapped.equipment, unmapped: mapped.unmapped, editable: true });
    }
    return deepFreeze({ ok: true, shortcut, equipment: [...EQUIPMENT_SHORTCUTS[shortcut]], unmapped: [], editable: true });
  }

  // Normalizes single-session constraints through the session-intent schema so
  // the plan and the stored context can never disagree about them.
  function normalizeConstraints(raw, { requireEquipment = false, requireMinutes = false } = {}) {
    if (!isPlainObject(raw)) return fail("invalid-constraints", { issues: ["constraints:object"] });
    const candidate = {
      minutes: raw.minutes ?? null,
      equipment: raw.equipment ?? null,
      minimizeEquipmentChanges: raw.minimizeEquipmentChanges ?? false,
    };
    const unknown = Object.keys(raw).filter((key) => !hasOwn(candidate, key));
    const probe = Intent.normalizeContext({
      schemaVersion: Intent.SCHEMA_VERSION, sessionKind: "one_off", oneOffIntent: "manual", name: "probe",
      source: { programId: null, programFingerprint: null, dayId: null, dayLabel: null }, focus: null,
      constraints: candidate, generation: { engineVersion: ENGINE_VERSION, blueprintId: null, blueprintVersion: null, catalogVersion: null },
      exercises: { probe: { origin: "manual", sourceExerciseId: null, sourceDay: null, isNew: false } }, adaptation: null,
    });
    const issues = [...unknown.map((key) => `constraints.${key}:unknown`),
      ...(probe.ok ? [] : probe.issues.filter((issue) => issue.startsWith("constraints")))];
    if (requireEquipment && candidate.equipment === null) issues.push("constraints.equipment:required");
    if (requireMinutes && candidate.minutes === null) issues.push("constraints.minutes:required");
    if (issues.length) return fail("invalid-constraints", { issues });
    return deepFreeze({ ok: true, constraints: probe.context.constraints });
  }

  function budgetSeconds(minutes) {
    // "90+" is a ceiling the athlete removed, not a quota to fill.
    return minutes == null || minutes >= 90 ? Infinity : minutes * 60;
  }

  // ---------------------------------------------------------------- catalogue

  // One normalized view of built-in library entries plus custom definitions.
  // Entries without trustworthy equipment, muscle and pattern metadata stay
  // available to manual sessions but are never ranked or auto-selected.
  function normalizeCatalogue(library, customExercises = []) {
    const entries = [];
    const seen = new Set();
    const add = (raw, custom) => {
      if (!isPlainObject(raw) || typeof raw.id !== "string" || !raw.id || seen.has(raw.id)) return;
      if (raw.archived === true) return;
      seen.add(raw.id);
      const equipment = Array.isArray(raw.equipment) ? EQUIPMENT_CODES.filter((code) => raw.equipment.includes(code)) : [];
      const primary = tokens(raw.primary).filter((token) => MUSCLE_TOKENS.has(token));
      const patterns = Array.isArray(raw.patterns) ? raw.patterns.filter((value) => typeof value === "string") : [];
      entries.push(deepFreeze({
        id: raw.id,
        name: String(raw.name || raw.id),
        equipment,
        primary: primary.join(","),
        secondary: tokens(raw.secondary).filter((token) => MUSCLE_TOKENS.has(token)).join(","),
        primaryTokens: primary,
        patterns,
        rank: Number.isFinite(raw.rank) ? raw.rank : 50,
        custom,
        compound: patterns.some((value) => COMPOUND_PATTERNS.has(value)),
        automatic: equipment.length > 0 && primary.length > 0 && patterns.length > 0,
      }));
    };
    for (const raw of Array.isArray(library) ? library : []) add(raw, false);
    for (const raw of Array.isArray(customExercises) ? customExercises : []) add(raw, true);
    entries.sort((a, b) => compareText(a.id, b.id));
    const version = `catalog-${fingerprint(entries.map((entry) =>
      [entry.id, entry.equipment.join("+"), entry.primary, entry.patterns.join("+"), entry.rank, entry.automatic ? 1 : 0].join("|")).join("\n"))}`;
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    return deepFreeze({ version, entries, get: (id) => byId.get(id) || null });
  }

  function resolveEntry(catalogue, id, legacyIds) {
    if (typeof id !== "string" || !id) return null;
    const direct = catalogue.get(id);
    if (direct) return direct;
    // Legacy aliases only locate metadata for an already-stored program row;
    // the row keeps its own identity.
    const alias = legacyIds && typeof legacyIds[id] === "string" ? legacyIds[id] : null;
    return alias ? catalogue.get(alias) : null;
  }

  // ---------------------------------------------------------------- ranking

  // Familiarity: distinct sessions per performed library identity across the
  // athlete's whole training history (one-offs included — this is a fact about
  // what they know, not program progression authority).
  function familiarity(rows) {
    const bySession = new Map();
    for (const row of Intent.selectRows(rows, "all_training")) {
      const id = row.performedLibraryId;
      if (typeof id !== "string" || !id || !(Number(row.load) > 0) || row.warmup === true) continue;
      if (!bySession.has(id)) bySession.set(id, new Set());
      bySession.get(id).add(String(row.session ?? row.date ?? ""));
    }
    return new Map([...bySession].map(([id, set]) => [id, set.size]));
  }

  function programLibraryOrder(program) {
    const order = new Map();
    (Array.isArray(program) ? program : []).forEach((row, index) => {
      if (row && typeof row.libraryId === "string" && !order.has(row.libraryId)) order.set(row.libraryId, index);
    });
    return order;
  }

  function stationFor(entry, available, used) {
    const compatible = entry.equipment.filter((code) => available.includes(code));
    return compatible.find((code) => used.has(code)) || compatible[0] || entry.equipment[0] || null;
  }

  function rankCandidates(candidates, { patterns = [], available, used, minimize, programOrder, familiar, avoidPatterns = [] }) {
    const patternIndex = (entry) => {
      const index = patterns.findIndex((value) => entry.patterns.includes(value));
      return index < 0 ? patterns.length : index;
    };
    const score = (entry) => [
      minimize && !entry.equipment.some((code) => available.includes(code) && used.has(code)) ? 1 : 0,
      entry.patterns.some((value) => avoidPatterns.includes(value)) ? 1 : 0,
      programOrder.has(entry.id) ? 0 : 1,
      programOrder.has(entry.id) ? programOrder.get(entry.id) : 0,
      -(familiar.get(entry.id) || 0),
      patternIndex(entry),
      entry.rank,
    ];
    return candidates.slice().sort((a, b) => {
      const left = score(a), right = score(b);
      for (let index = 0; index < left.length; index++) if (left[index] !== right[index]) return left[index] - right[index];
      return compareText(a.id, b.id);
    });
  }

  // ---------------------------------------------------------------- time model

  // Spec §9.3: working sets + expected warm-ups + rest at the saved preference
  // + transitions + a conservative buffer, reported as a bounded range. Rest is
  // never shortened to make an estimate fit.
  function estimate(exercises, restSeconds) {
    const rest = Number.isFinite(restSeconds) && restSeconds >= 0 ? restSeconds : 120;
    let subtotal = 0;
    let firstCompound = true;
    exercises.forEach((exercise, index) => {
      subtotal += exercise.sets * TIME.workingSetSeconds;
      subtotal += Math.max(0, exercise.sets - 1) * rest;
      if (exercise.compound) {
        subtotal += firstCompound ? TIME.warmupSeconds.primary : TIME.warmupSeconds.compound;
        firstCompound = false;
      } else {
        subtotal += TIME.warmupSeconds.assistance;
      }
      if (index) {
        const same = exercise.station && exercise.station === exercises[index - 1].station;
        subtotal += same ? TIME.transitionSeconds.same_station : TIME.transitionSeconds.new_station;
      }
    });
    const high = subtotal + Math.max(TIME.bufferMinimumSeconds, Math.ceil(subtotal * TIME.bufferPercent / 100));
    return { lowMinutes: Math.floor(subtotal / 60), highMinutes: Math.ceil(high / 60), highSeconds: high };
  }

  // ---------------------------------------------------------------- plan assembly

  function planExercise(entry, { index, sets, station, origin, isNew, purpose, source = null, substitutedFor = null }) {
    const kind = entry.compound ? "compound" : "isolation";
    return {
      exerciseInstanceId: `oneoff:${index + 1}:${entry.id}`,
      libraryId: entry.id,
      movementId: entry.custom ? null : `library:${entry.id}`,
      displayName: entry.name,
      primary: entry.primary,
      secondary: entry.secondary,
      sets,
      minReps: REPS[kind][0],
      maxReps: REPS[kind][1],
      targetRir: TARGET_RIR[kind],
      compound: entry.compound,
      equipment: entry.equipment.slice(),
      station,
      origin,
      isNew,
      purpose,
      sourceExerciseId: source?.sourceExerciseId ?? null,
      sourceDay: source?.sourceDay ?? null,
      substitutedFor,
    };
  }

  function contextFor({ sessionKind, intent, name, source, focus, constraints, blueprint, catalogue, exercises, adaptation = null }) {
    const normalized = Intent.normalizeContext({
      schemaVersion: Intent.SCHEMA_VERSION,
      sessionKind,
      oneOffIntent: intent,
      name,
      source,
      focus,
      constraints,
      generation: {
        engineVersion: ENGINE_VERSION,
        blueprintId: blueprint ? blueprint.id : null,
        blueprintVersion: blueprint ? blueprint.version : null,
        catalogVersion: catalogue.version,
      },
      exercises: Object.fromEntries(exercises.map((exercise) => [exercise.exerciseInstanceId, {
        origin: exercise.origin,
        sourceExerciseId: exercise.sourceExerciseId,
        sourceDay: exercise.sourceDay,
        isNew: exercise.isNew,
      }])),
      adaptation,
    });
    return normalized;
  }

  function finishPlan({ context, exercises, restSeconds, omitted = [], reducedSets = [], warnings = [] }) {
    if (!context.ok) return fail("invalid-plan-context", { issues: context.issues });
    const time = estimate(exercises, restSeconds);
    return deepFreeze({
      ok: true,
      plan: {
        engineVersion: ENGINE_VERSION,
        context: context.context,
        exercises: exercises.map((exercise) => ({ ...exercise })),
        estimate: { lowMinutes: time.lowMinutes, highMinutes: time.highMinutes },
        requiredEquipment: EQUIPMENT_CODES.filter((code) => exercises.some((exercise) => exercise.station === code)),
        omitted,
        reducedSets,
        warnings,
        effect: Intent.classify(context.context),
      },
    });
  }

  function sourceFromProgram(active) {
    return {
      programId: typeof active?.programId === "string" && active.programId ? active.programId : null,
      programFingerprint: typeof active?.programFingerprint === "string" && active.programFingerprint ? active.programFingerprint : null,
      dayId: null,
      dayLabel: null,
    };
  }

  // Shared slot-filling generator for classic and muscle-focus sessions.
  function generateFromSlots(slots, env) {
    const { catalogue, constraints, programOrder, familiar } = env;
    const available = constraints.equipment;
    const pool = catalogue.entries.filter((entry) => entry.automatic && entry.equipment.some((code) => available.includes(code)));
    const picks = new Map();
    const usedIds = new Set();
    const used = new Set();
    const unsupported = [];
    const omitted = [];
    const ordered = [
      ...slots.filter((item) => item.required),
      ...slots.filter((item) => !item.required).sort((a, b) => a.priority - b.priority || slots.indexOf(a) - slots.indexOf(b)),
    ];
    for (const item of ordered) {
      const distinct = item.distinctFrom && picks.get(item.distinctFrom)
        ? picks.get(item.distinctFrom).entry.patterns.filter((value) => item.patterns.includes(value)) : [];
      const avoid = (item.avoidFrom || []).flatMap((id) => picks.get(id)?.entry.patterns || []);
      const candidates = pool.filter((entry) => !usedIds.has(entry.id) && item.accepts(entry) &&
        !entry.patterns.some((value) => distinct.includes(value)));
      const [best] = rankCandidates(candidates, { patterns: item.patterns, available, used,
        minimize: constraints.minimizeEquipmentChanges, programOrder, familiar, avoidPatterns: avoid });
      if (!best) {
        if (item.required) unsupported.push(item.id);
        else omitted.push({ purpose: item.id, reason: "equipment" });
        continue;
      }
      const station = stationFor(best, available, used);
      picks.set(item.id, { item, entry: best, station });
      usedIds.add(best.id);
      used.add(station);
    }
    if (unsupported.length) return fail("equipment-unsupported-focus", { purposes: unsupported, equipment: available.slice() });

    const budget = budgetSeconds(constraints.minutes);
    const sessionOrder = (list) => list.slice().sort((a, b) => env.orderOf(a) - env.orderOf(b));
    const build = (chosen, setsFor) => sessionOrder(chosen).map((pick) => ({
      sets: setsFor(pick), compound: pick.entry.compound, station: pick.station,
    }));
    const required = slots.filter((item) => item.required).map((item) => picks.get(item.id));
    const sets = new Map(required.map((pick) => [pick.item.id, DEFAULT_SETS]));
    let chosen = required.slice();
    const reducedSets = [];
    if (estimate(build(chosen, (pick) => sets.get(pick.item.id)), env.restSeconds).highSeconds > budget) {
      // Required work does not fit at full volume: no optional work is added,
      // and required sets shrink (latest slot first) but never below two.
      const reverse = sessionOrder(required).reverse();
      let reduced = true;
      while (reduced && estimate(build(chosen, (pick) => sets.get(pick.item.id)), env.restSeconds).highSeconds > budget) {
        reduced = false;
        for (const pick of reverse) {
          if (sets.get(pick.item.id) > MIN_SETS) {
            sets.set(pick.item.id, sets.get(pick.item.id) - 1);
            reduced = true;
            break;
          }
        }
      }
      const minimum = estimate(build(chosen, () => MIN_SETS), env.restSeconds);
      if (minimum.highSeconds > budget) {
        return fail("time-infeasible", { minimumMinutes: minimum.highMinutes, budgetMinutes: constraints.minutes,
          suggestion: env.timeSuggestion });
      }
      for (const pick of required) {
        if (sets.get(pick.item.id) < DEFAULT_SETS) reducedSets.push({ purpose: pick.item.id, from: DEFAULT_SETS, to: sets.get(pick.item.id) });
      }
      for (const item of slots.filter((entry) => !entry.required && picks.has(entry.id))) omitted.push({ purpose: item.id, reason: "time" });
    } else {
      const optional = ordered.filter((item) => !item.required && picks.has(item.id));
      for (const item of optional) {
        const pick = picks.get(item.id);
        const next = [...chosen, pick];
        sets.set(item.id, DEFAULT_SETS);
        if (estimate(build(next, (entry) => sets.get(entry.item.id)), env.restSeconds).highSeconds <= budget) chosen = next;
        else {
          sets.delete(item.id);
          omitted.push({ purpose: item.id, reason: "time" });
        }
      }
    }
    const exercises = sessionOrder(chosen).map((pick, index) => planExercise(pick.entry, {
      index,
      sets: sets.get(pick.item.id),
      station: pick.station,
      origin: "catalogue",
      isNew: !programOrder.has(pick.entry.id) && !familiar.get(pick.entry.id),
      purpose: pick.item.id,
    }));
    omitted.sort((a, b) => env.orderOfPurpose(a.purpose) - env.orderOfPurpose(b.purpose));
    return { ok: true, exercises, omitted, reducedSets };
  }

  function commonEnv(input) {
    const catalogue = input?.catalogue;
    if (!catalogue || !Array.isArray(catalogue.entries) || typeof catalogue.get !== "function") return fail("invalid-catalogue");
    return {
      catalogue,
      programOrder: programLibraryOrder(input.program),
      familiar: familiarity(input.history),
      restSeconds: input.restSeconds,
    };
  }

  // Classic session (spec §8.4).
  function planClassic(input) {
    const blueprint = hasOwn(CLASSIC_BLUEPRINTS, input?.classic) ? CLASSIC_BLUEPRINTS[input.classic] : null;
    if (!blueprint) return fail("unknown-classic", { classic: String(input?.classic) });
    const env = commonEnv(input);
    if (env.ok === false) return env;
    const constraints = normalizeConstraints(input.constraints || {}, { requireEquipment: true });
    if (!constraints.ok) return constraints;
    const slots = blueprint.slots.map((item) => ({ ...item, accepts: (entry) => entry.patterns.some((value) => item.patterns.includes(value)) }));
    const position = new Map(blueprint.slots.map((item, index) => [item.id, index]));
    const generated = generateFromSlots(slots, { ...env, constraints: constraints.constraints,
      orderOf: (pick) => position.get(pick.item.id), orderOfPurpose: (id) => position.get(id), timeSuggestion: "narrower-focus-or-more-time" });
    if (!generated.ok) return generated;
    const name = typeof input.name === "string" && input.name.trim() ? input.name : blueprint.name;
    return finishPlan({
      context: contextFor({ sessionKind: "one_off", intent: "classic", name, source: sourceFromProgram(input.activeProgram),
        focus: { classic: input.classic, primaryMuscles: [], secondaryMuscles: [] }, constraints: constraints.constraints,
        blueprint, catalogue: env.catalogue, exercises: generated.exercises }),
      exercises: generated.exercises, restSeconds: env.restSeconds, omitted: generated.omitted, reducedSets: generated.reducedSets,
    });
  }

  // Muscle-focus session (spec §8.5): one primary focus, up to two secondary.
  function planMuscleFocus(input) {
    const env = commonEnv(input);
    if (env.ok === false) return env;
    const primary = Array.isArray(input?.primaryMuscles) ? input.primaryMuscles : [];
    const secondary = Array.isArray(input?.secondaryMuscles) ? input.secondaryMuscles : [];
    const all = [...primary, ...secondary];
    if (primary.length !== 1 || secondary.length > 2 || new Set(all).size !== all.length ||
      all.some((token) => !MUSCLE_TOKENS.has(token))) {
      return fail("invalid-focus", { primaryMuscles: primary.slice(), secondaryMuscles: secondary.slice() });
    }
    const constraints = normalizeConstraints(input.constraints || {}, { requireEquipment: true });
    if (!constraints.ok) return constraints;
    const trains = (token) => (entry) => entry.primaryTokens.includes(token);
    const [main] = primary;
    const slots = [
      { id: `primary:${main}`, patterns: [], required: true, priority: 0, distinctFrom: null, accepts: trains(main) },
      ...secondary.map((token) => ({ id: `secondary:${token}`, patterns: [], required: true, priority: 0, distinctFrom: null, accepts: trains(token) })),
      { id: `primary:${main}:2`, patterns: [], required: false, priority: 1, distinctFrom: null, avoidFrom: [`primary:${main}`], accepts: trains(main) },
      { id: `primary:${main}:3`, patterns: [], required: false, priority: 2, distinctFrom: null,
        avoidFrom: [`primary:${main}`, `primary:${main}:2`], accepts: trains(main) },
    ];
    const allocation = new Map(slots.map((item, index) => [item.id, index]));
    // Primary focus first, compounds before isolation within the allocation.
    const orderOf = (pick) => (pick.entry.compound ? 0 : 100) + allocation.get(pick.item.id);
    const generated = generateFromSlots(slots, { ...env, constraints: constraints.constraints, orderOf,
      orderOfPurpose: (id) => allocation.get(id), timeSuggestion: secondary.length ? "remove-secondary" : "more-time" });
    if (!generated.ok) return generated;
    const name = typeof input.name === "string" && input.name.trim() ? input.name : `${main} focus`;
    return finishPlan({
      context: contextFor({ sessionKind: "one_off", intent: "muscle_focus", name, source: sourceFromProgram(input.activeProgram),
        focus: { classic: null, primaryMuscles: primary.slice(), secondaryMuscles: secondary.slice() },
        constraints: constraints.constraints, blueprint: null, catalogue: env.catalogue, exercises: generated.exercises }),
      exercises: generated.exercises, restSeconds: env.restSeconds, omitted: generated.omitted, reducedSets: generated.reducedSets,
    });
  }

  function validPrescription(item) {
    return Number.isSafeInteger(item.sets) && item.sets >= 1 && item.sets <= 10 &&
      Number.isSafeInteger(item.minReps) && item.minReps >= 1 && item.minReps <= 100 &&
      Number.isSafeInteger(item.maxReps) && item.maxReps >= item.minReps && item.maxReps <= 100;
  }

  // Manual session (spec §8.6): the athlete authors order, sets and ranges.
  // Constraints only inform; a deliberate mismatch is shown, not blocked.
  function planManual(input) {
    const env = commonEnv(input);
    if (env.ok === false) return env;
    const items = Array.isArray(input?.exercises) ? input.exercises : null;
    if (!items || !items.length) return fail("empty-session");
    if (items.length > MAX_MANUAL_EXERCISES) return fail("too-many-exercises", { max: MAX_MANUAL_EXERCISES });
    const constraints = normalizeConstraints(input.constraints || {});
    if (!constraints.ok) return constraints;
    const available = constraints.constraints.equipment;
    const used = new Set();
    const seen = new Set();
    const exercises = [];
    const mismatched = [];
    const unverified = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!isPlainObject(item)) return fail("invalid-manual-exercise", { index });
      // Exact identity only: no fuzzy matching and no alias repointing.
      const entry = env.catalogue.get(item.exerciseId);
      if (!entry) return fail("unknown-exercise", { index, exerciseId: String(item.exerciseId) });
      if (seen.has(entry.id)) return fail("duplicate-movement", { index, exerciseId: entry.id });
      if (!validPrescription(item)) return fail("invalid-manual-prescription", { index });
      seen.add(entry.id);
      const station = available ? stationFor(entry, available, used) : entry.equipment[0] || null;
      if (station) used.add(station);
      const exercise = planExercise(entry, { index, sets: item.sets, station, origin: "manual",
        isNew: !env.programOrder.has(entry.id) && !env.familiar.get(entry.id), purpose: `manual:${index + 1}` });
      exercise.minReps = item.minReps;
      exercise.maxReps = item.maxReps;
      exercises.push(exercise);
      if (available && !entry.equipment.length) unverified.push(exercise.exerciseInstanceId);
      else if (available && !entry.equipment.some((code) => available.includes(code))) mismatched.push(exercise.exerciseInstanceId);
    }
    const warnings = [];
    if (mismatched.length) warnings.push({ code: "equipment-mismatch", exerciseInstanceIds: mismatched });
    if (unverified.length) warnings.push({ code: "equipment-unverified", exerciseInstanceIds: unverified });
    const time = estimate(exercises, env.restSeconds);
    if (time.highSeconds > budgetSeconds(constraints.constraints.minutes)) {
      warnings.push({ code: "time-over-budget", highMinutes: time.highMinutes, budgetMinutes: constraints.constraints.minutes });
    }
    const hasConstraints = constraints.constraints.minutes !== null || constraints.constraints.equipment !== null;
    const name = typeof input.name === "string" && input.name.trim() ? input.name : "One-off session";
    return finishPlan({
      context: contextFor({ sessionKind: "one_off", intent: "manual", name, source: sourceFromProgram(input.activeProgram),
        focus: null, constraints: hasConstraints ? constraints.constraints : null, blueprint: null,
        catalogue: env.catalogue, exercises }),
      exercises, restSeconds: env.restSeconds, warnings,
    });
  }

  // ---------------------------------------------------------------- adaptation

  // Primary-purpose derivation for a program day (spec §8.2, Slice 3). A
  // compiled program declares it: `priority: "protected"` rows are primary.
  // A program without that metadata derives it deterministically: compound
  // movements are primary; a day with no compound keeps its first exercise.
  function primaryPurposes(dayRows, catalogue, legacyIds) {
    const declared = dayRows.some((row) => typeof row.priority === "string");
    if (declared) return new Set(dayRows.filter((row) => row.priority === "protected").map((row) => row.id));
    const compound = dayRows.filter((row) => resolveEntry(catalogue, row.libraryId, legacyIds)?.compound);
    return new Set((compound.length ? compound : dayRows.slice(0, 1)).map((row) => row.id));
  }

  function removalRank(row, primary) {
    if (primary.has(row.id)) return Infinity;
    return hasOwn(REMOVAL_RANK, row.priority) ? REMOVAL_RANK[row.priority] : 3;
  }

  function adaptedExercise(row, entry, { sets, station, origin, substitute = null }) {
    const performed = substitute || entry;
    const kindEntry = performed || { compound: false };
    return {
      exerciseInstanceId: String(row.id),
      libraryId: typeof row.libraryId === "string" ? row.libraryId : null,
      movementId: typeof row.movementId === "string" ? row.movementId : null,
      displayName: String(row.name),
      primary: String(row.primary || ""),
      secondary: String(row.secondary || ""),
      sets,
      minReps: row.min,
      maxReps: row.max,
      targetRir: null,
      compound: !!kindEntry.compound,
      equipment: performed ? performed.equipment.slice() : [],
      station,
      origin,
      isNew: false,
      purpose: String(row.id),
      sourceExerciseId: String(row.id),
      sourceDay: String(row.day),
      substitutedFor: null,
      replacement: substitute ? {
        libraryId: substitute.id,
        movementId: substitute.custom ? null : `library:${substitute.id}`,
        displayName: substitute.name,
        primary: substitute.primary,
        secondary: substitute.secondary,
      } : null,
    };
  }

  // User-directed adaptation of one planned program day under temporary time
  // and/or equipment constraints. The result counts as that planned session
  // only when every primary purpose survives; otherwise the caller receives an
  // explicit failure and, when useful, the proposed result as a one-off.
  function adaptPlannedSession(input) {
    const env = commonEnv(input);
    if (env.ok === false) return env;
    const day = input?.plannedDay;
    if (!isPlainObject(day) || typeof day.programId !== "string" || !day.programId ||
      typeof day.programFingerprint !== "string" || !day.programFingerprint ||
      typeof day.dayId !== "string" || !day.dayId || typeof day.dayLabel !== "string" || !day.dayLabel ||
      !Array.isArray(day.exercises) || !day.exercises.length) return fail("invalid-planned-day");
    const rows = day.exercises;
    if (rows.some((row) => !isPlainObject(row) || typeof row.id !== "string" || !row.id || row.day !== day.dayLabel ||
      !Number.isSafeInteger(row.sets) || row.sets < 1 || !Number.isSafeInteger(row.min) || !Number.isSafeInteger(row.max)) ||
      new Set(rows.map((row) => row.id)).size !== rows.length) return fail("invalid-planned-day");
    const constraints = normalizeConstraints(input.constraints || {});
    if (!constraints.ok) return constraints;
    const { minutes, equipment: available, minimizeEquipmentChanges } = constraints.constraints;
    if (minutes === null && available === null) return fail("nothing-to-adapt");
    const legacyIds = isPlainObject(input.legacyIds) ? input.legacyIds : null;
    const primary = primaryPurposes(rows, env.catalogue, legacyIds);
    const planIdentities = new Set(rows.map((row) => row.libraryId).filter(Boolean));
    const used = new Set();
    const kept = [];
    const omitted = [];
    const lost = [];
    const warnings = [];
    for (const row of rows) {
      const entry = resolveEntry(env.catalogue, row.libraryId, legacyIds);
      if (!available) {
        kept.push(adaptedExercise(row, entry, { sets: row.sets, station: entry?.equipment[0] || null, origin: "program" }));
        continue;
      }
      if (!entry || !entry.equipment.length) {
        // Custom work without equipment metadata: kept as the athlete's own
        // program choice, never ranked or substituted, and shown as unverified.
        kept.push(adaptedExercise(row, entry, { sets: row.sets, station: null, origin: "program" }));
        warnings.push({ code: "equipment-unverified", exerciseInstanceIds: [String(row.id)] });
        continue;
      }
      if (entry.equipment.some((code) => available.includes(code))) {
        const station = stationFor(entry, available, used);
        used.add(station);
        kept.push(adaptedExercise(row, entry, { sets: row.sets, station, origin: "program" }));
        continue;
      }
      const candidates = env.catalogue.entries.filter((candidate) => candidate.automatic && !planIdentities.has(candidate.id) &&
        candidate.equipment.some((code) => available.includes(code)) &&
        candidate.patterns.some((value) => entry.patterns.includes(value)) &&
        candidate.primaryTokens.some((token) => entry.primaryTokens.includes(token)));
      const [substitute] = rankCandidates(candidates, { patterns: entry.patterns, available, used,
        minimize: minimizeEquipmentChanges, programOrder: env.programOrder, familiar: env.familiar });
      if (!substitute) {
        omitted.push({ purpose: String(row.id), reason: "equipment" });
        if (primary.has(row.id)) lost.push(String(row.id));
        continue;
      }
      planIdentities.add(substitute.id);
      const station = stationFor(substitute, available, used);
      used.add(station);
      kept.push(adaptedExercise(row, entry, { sets: row.sets, station, origin: "substitute", substitute }));
    }
    const budget = budgetSeconds(minutes);
    const rowById = new Map(rows.map((row) => [String(row.id), row]));
    const reducedSets = [];
    let chosen = kept.slice();
    // Reduction order: remove lowest-priority non-primary work (latest first
    // within a rank), then reduce working sets, never touching rest.
    const removable = chosen.filter((exercise) => !primary.has(exercise.exerciseInstanceId))
      .sort((a, b) => removalRank(rowById.get(a.exerciseInstanceId), primary) - removalRank(rowById.get(b.exerciseInstanceId), primary) ||
        chosen.indexOf(b) - chosen.indexOf(a));
    for (const exercise of removable) {
      if (estimate(chosen, env.restSeconds).highSeconds <= budget) break;
      chosen = chosen.filter((item) => item !== exercise);
      omitted.push({ purpose: exercise.exerciseInstanceId, reason: "time" });
    }
    const floorFor = (exercise) => {
      const row = rowById.get(exercise.exerciseInstanceId);
      const floor = Number.isSafeInteger(row.minSets) && row.minSets >= 1 ? row.minSets : MIN_SETS;
      return Math.min(row.sets, floor);
    };
    const reduceOrder = [...chosen].reverse().sort((a, b) =>
      Number(primary.has(a.exerciseInstanceId)) - Number(primary.has(b.exerciseInstanceId)));
    let progress = true;
    while (progress && estimate(chosen, env.restSeconds).highSeconds > budget) {
      progress = false;
      for (const exercise of reduceOrder) {
        if (exercise.sets > floorFor(exercise)) {
          exercise.sets--;
          progress = true;
          break;
        }
      }
    }
    for (const exercise of chosen) {
      const from = rowById.get(exercise.exerciseInstanceId).sets;
      if (exercise.sets !== from) reducedSets.push({ purpose: exercise.exerciseInstanceId, from, to: exercise.sets });
    }
    const time = estimate(chosen, env.restSeconds);
    if (time.highSeconds > budget) {
      return fail("time-infeasible", { minimumMinutes: time.highMinutes, budgetMinutes: minutes, suggestion: "more-time-or-planned-day" });
    }
    const source = { programId: day.programId, programFingerprint: day.programFingerprint, dayId: day.dayId, dayLabel: day.dayLabel };
    omitted.sort((a, b) => rows.findIndex((row) => row.id === a.purpose) - rows.findIndex((row) => row.id === b.purpose));
    if (lost.length) {
      // Never silently convert a substantially changed session into a planned
      // completion (spec §5.2). Offer the surviving work as an honest one-off.
      const survivors = chosen.map((exercise, index) => ({ ...exercise,
        exerciseInstanceId: `oneoff:${index + 1}:${exercise.replacement?.libraryId || exercise.libraryId || exercise.sourceExerciseId}` }));
      const alternative = survivors.length ? finishPlan({
        context: contextFor({ sessionKind: "one_off", intent: "manual",
          name: typeof input.name === "string" && input.name.trim() ? input.name : day.dayLabel,
          source, focus: null, constraints: constraints.constraints, blueprint: null, catalogue: env.catalogue, exercises: survivors }),
        exercises: survivors, restSeconds: env.restSeconds, omitted, reducedSets, warnings,
      }) : null;
      return fail("purpose-not-preserved", { lostPurposes: lost, oneOffAlternative: alternative?.ok ? alternative.plan : null });
    }
    const preservedPurposes = rows.filter((row) => primary.has(row.id)).map((row) => String(row.id));
    return finishPlan({
      context: contextFor({ sessionKind: "planned_adapted", intent: null, name: day.dayLabel, source, focus: null,
        constraints: constraints.constraints, blueprint: null, catalogue: env.catalogue, exercises: chosen,
        adaptation: { preservedPurposes, omittedExerciseIds: omitted.map((item) => item.purpose), purposePreserved: true } }),
      exercises: chosen, restSeconds: env.restSeconds, omitted, reducedSets, warnings,
    });
  }

  // ---------------------------------------------------------------- owner adapters

  function setIds(count) {
    return Array.from({ length: count }, (_, index) => `set-${index + 1}`);
  }

  function movementSnapshot(exerciseInstanceId, sourceExerciseId, movement) {
    const snapshot = {
      exerciseInstanceId,
      sourceExerciseId,
      displayName: movement.displayName,
      primary: movement.primary,
      secondary: movement.secondary,
    };
    if (movement.libraryId) snapshot.libraryId = movement.libraryId;
    if (movement.movementId) snapshot.movementId = movement.movementId;
    return snapshot;
  }

  // Input for the existing workout owner's WorkoutDraft.create for an
  // accepted one-off. `base` carries the owner-supplied facts (active program
  // identity, revision, date, units). A one-off never carries the block id.
  function oneOffDraftContext(plan, base) {
    if (!plan || plan.context?.sessionKind !== "one_off") return fail("not-a-one-off-plan");
    if (!isPlainObject(base)) return fail("invalid-draft-base");
    return deepFreeze({
      ok: true,
      programContext: {
        programId: base.programId,
        programFingerprint: base.programFingerprint,
        durableRevision: base.durableRevision,
        dayId: Intent.oneOffDayId(plan.context.oneOffIntent),
        dayLabel: plan.context.name,
        scheduleDate: base.scheduleDate,
        unit: base.unit,
        rirMode: base.rirMode,
        sessionContext: plan.context,
        exercises: plan.exercises.map((exercise) => {
          const source = {
            exerciseInstanceId: exercise.exerciseInstanceId,
            sourceExerciseId: exercise.sourceExerciseId || exercise.libraryId,
            displayName: exercise.displayName,
            sets: exercise.sets,
            setIds: setIds(exercise.sets),
            minReps: exercise.minReps,
            maxReps: exercise.maxReps,
            targetRir: exercise.targetRir,
            notes: "",
            primary: exercise.primary,
            secondary: exercise.secondary,
            progressionStrategy: null,
            movementPattern: null,
            sourceFingerprint: `one-off:${exercise.libraryId}:${exercise.sets}x${exercise.minReps}-${exercise.maxReps}`,
          };
          if (exercise.libraryId) source.libraryId = exercise.libraryId;
          if (exercise.movementId) source.movementId = exercise.movementId;
          if (exercise.replacement) source.substitution = movementSnapshot(exercise.exerciseInstanceId, source.sourceExerciseId, exercise.replacement);
          return source;
        }),
      },
    });
  }

  // Narrows the owner's own planned-day create input (with its normal
  // recommendations) to an accepted adaptation: the same day, the same
  // exercise instances, fewer exercises or sets, session-only substitutions
  // expressed through the owner's existing substitution semantics.
  function adaptedDraftContext(plannedContext, plan) {
    if (!plan || plan.context?.sessionKind !== "planned_adapted") return fail("not-an-adapted-plan");
    if (!isPlainObject(plannedContext) || !Array.isArray(plannedContext.exercises)) return fail("invalid-planned-context");
    const source = plan.context.source;
    if (plannedContext.programId !== source.programId || plannedContext.dayId !== source.dayId ||
      plannedContext.dayLabel !== source.dayLabel || plannedContext.programFingerprint !== source.programFingerprint) {
      return fail("planned-context-mismatch");
    }
    const byId = new Map(plannedContext.exercises.map((exercise) => [exercise.exerciseInstanceId, exercise]));
    const exercises = [];
    for (const item of plan.exercises) {
      const original = byId.get(item.exerciseInstanceId);
      if (!original) return fail("planned-context-mismatch", { exerciseInstanceId: item.exerciseInstanceId });
      const narrowed = {
        ...original,
        sets: item.sets,
        setIds: (original.setIds || []).slice(0, item.sets),
        programmedSets: Array.isArray(original.programmedSets) ? original.programmedSets.slice(0, item.sets) : original.programmedSets,
      };
      if (item.replacement) narrowed.substitution = movementSnapshot(item.exerciseInstanceId, original.sourceExerciseId, item.replacement);
      exercises.push(narrowed);
    }
    const programContext = { ...plannedContext, exercises, sessionContext: plan.context };
    return deepFreeze({ ok: true, programContext });
  }

  const api = Object.freeze({
    ENGINE_VERSION,
    PROGRAM_EQUIPMENT_CODES,
    EQUIPMENT_SHORTCUTS,
    SHORTCUT_IDS,
    CLASSIC_BLUEPRINTS,
    programEquipmentCodes,
    expandEquipmentShortcut,
    normalizeConstraints,
    normalizeCatalogue,
    familiarity,
    estimate,
    planClassic,
    planMuscleFocus,
    planManual,
    adaptPlannedSession,
    primaryPurposes,
    oneOffDraftContext,
    adaptedDraftContext,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSessionPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
