(function (root) {
  "use strict";

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function compilerApi(injected) {
    const compiler = injected || root?.RepForgeProgramCompiler ||
      (typeof require === "function" ? require("./program-compiler.js") : null);
    if (!compiler || typeof compiler.generateProgram !== "function" ||
      typeof compiler.validateProgramDefinition !== "function") {
      throw new TypeError("Canonical program compiler unavailable");
    }
    return compiler;
  }

  function rawCatalogSnapshot(injected) {
    const catalog = injected || null;
    if (!isPlainObject(catalog) || !Array.isArray(catalog.exercises) || !catalog.exercises.length ||
      !isPlainObject(catalog.uuidIndex) || !Object.keys(catalog.uuidIndex).length ||
      typeof catalog.generatedAt !== "string" || !catalog.generatedAt) {
      throw new TypeError("A checked raw catalog snapshot is required");
    }
    return catalog;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function fingerprint(value) {
    const text = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `pe-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function currentVersions(Compiler) {
    return {
      compiler: String(Compiler.GENERATOR_VERSION ?? "manual@1"),
      family: "retired",
      blueprint: String(Compiler.PROGRAM_SCHEMA_VERSION ?? 1),
      catalogue: "raw-uuid@1",
      rules: "source-metrics@1",
      context: "program-definition@1",
      progression: String(Compiler.GENERATOR_VERSION ?? "manual@1"),
      recentConsistency: "retired",
      simpleStart: "retired",
    };
  }

  function buildEmptyProgram(answers, Compiler, catalog) {
    const name = typeof answers?.programName === "string" ? answers.programName.trim() : "";
    const daysPerWeek = answers?.daysPerWeek;
    if (!name || name.length > 80 || !Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) {
      return { ok: false, code: "build_setup_incomplete", conflicts: [] };
    }
    const cycles = Number.isInteger(answers.cycles) ? answers.cycles : 7;
    if (cycles < 1 || cycles > 12) return { ok: false, code: "build_setup_incomplete", conflicts: [] };
    const days = Array.from({ length: 7 }, (_, index) => ({
      id: `manual-day-${index + 1}`,
      name: `Day ${index + 1}`,
      kind: index < daysPerWeek ? "training" : "rest",
      order: index + 1,
      slots: [],
    }));
    const programDefinition = {
      schemaVersion: 1,
      generatorVersion: "manual@1",
      seed: "manual",
      request: {},
      days,
      cycles,
      deloadCycles: [],
      provenance: { source: "manual", policyVersion: "manual@1" },
    };
    const checked = Compiler.validateProgramDefinition(programDefinition, catalog);
    if (!checked.ok) return { ok: false, code: "build_definition_invalid", conflicts: checked.issues };
    const previewDays = days.slice(0, daysPerWeek).map((day) => ({
      dayId: day.id,
      label: day.name,
      order: day.order,
      exercises: [],
    }));
    const programStructure = {
      schemaVersion: 1,
      days: previewDays.map(({ dayId, label, order }) => ({ dayId, label, order })),
      provenance: { source: "manual" },
    };
    const preview = {
      source: "manual_build",
      frequency: daysPerWeek,
      program: [],
      programDefinition,
      programStructure,
      days: previewDays,
      customExercises: [],
      primaryMuscles: [],
    };
    return {
      ok: true,
      fingerprint: fingerprint({ name, programDefinition }),
      name,
      program: [],
      programDefinition,
      programStructure,
      preview,
    };
  }

  function foldName(value) {
    return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/\s+/g, " ");
  }

  function exerciseIdentity(row) {
    return row && row.libraryId ? `lib:${row.libraryId}` : `name:${foldName(row && row.name)}`;
  }

  function identityDiff(before, after) {
    const rows = (value) => (Array.isArray(value && value.program) ? value.program : Array.isArray(value) ? value : []);
    const tally = (list) => {
      const counts = new Map();
      for (const row of list) {
        const key = exerciseIdentity(row);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return counts;
    };
    const was = tally(rows(before)), now = tally(rows(after));
    let added = 0, removed = 0;
    for (const [key, count] of now) added += Math.max(0, count - (was.get(key) || 0));
    for (const [key, count] of was) removed += Math.max(0, count - (now.get(key) || 0));
    const total = rows(after).length;
    return { added, removed, n: Math.min(total, Math.max(added, removed)), total };
  }

  // ---- Generate answers -> canonical generator request ---------------------
  const GOALS = Object.freeze({ muscle_growth: "hypertrophy", balanced: "hybrid", strength: "strength" });
  const EXPERIENCE = Object.freeze({ first: "beginner", under_6m: "beginner", "6_to_24m": "intermediate", over_24m: "advanced" });
  // The source catalog flags each equipment item for its gym templates.
  const GYM_FLAGS = Object.freeze({
    commercial_gym: "commercialGym", basic_gym: "localGym", full_home: "garageGym", limited_home: "homeGym", other: "localGym",
  });
  const MUSCLE_NAMES = Object.freeze({
    chest: "Chest", back: "Upper Back", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes",
    side_delts: "Side Delts", rear_delts: "Rear Delts", front_delts: "Front Delts", biceps: "Biceps",
    triceps: "Triceps", calves: "Calves", lats: "Lats",
  });
  const COMPETENCY_KEYS = Object.freeze([
    "pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10",
  ]);
  const TIME_CEILINGS = Object.freeze([20, 40, 60, 90, 120, 150]);

  // Explicit split choices are the generator's authored splits for this day count.
  function splitChoices(answers, Compiler) {
    const days = answers?.daysPerWeek;
    if (!Number.isInteger(days)) return { choices: [] };
    return { choices: Object.entries(Compiler.SPLITS || {})
      .filter(([, split]) => split.compatibleDays.includes(days))
      .map(([id], index) => ({ id, default: index === 0 })) };
  }

  function compatibleSplit(preference, days) {
    const split = compilerApi().SPLITS?.[preference];
    return split && split.compatibleDays.includes(days) ? preference : "auto";
  }

  function programRequestFromAnswers(answers, catalog) {
    const conflicts = [];
    const conflict = (code) => conflicts.push({ field: code.replace(/_(required|unsupported)$/, ""), code });
    const source = isPlainObject(answers) ? answers : {};
    if (!catalog || !isPlainObject(catalog.uuidIndex)) return { ok: false, conflicts: [{ field: "catalog", code: "catalog_unavailable" }] };
    const index = catalog.uuidIndex;
    const goal = GOALS[source.desiredResult];
    if (!goal) conflict("goal_required");
    const experience = EXPERIENCE[source.structuredExperience];
    if (!experience) conflict("experience_required");
    const days = source.daysPerWeek;
    if (!Number.isInteger(days) || days < 2 || days > 6) conflict("days_unsupported");
    const flag = GYM_FLAGS[source.environment?.kind];
    if (!flag) conflict("environment_required");
    if (conflicts.length) return { ok: false, conflicts };
    const minutes = Number.isFinite(source.sessionMinutes) ? source.sessionMinutes : 60;
    const ceiling = [...TIME_CEILINGS].reverse().find((value) => value <= minutes) ?? TIME_CEILINGS[0];
    const ids = (type, predicate) => Object.keys(index).filter((id) => index[id]?.type === type && predicate(index[id])).sort();
    const muscleIds = (tokens) => (Array.isArray(tokens) ? tokens : []).map((token) =>
      ids("featureMuscleGroup", (entry) => entry.name === MUSCLE_NAMES[token])[0]).filter(Boolean);
    const exerciseIds = (values) => (Array.isArray(values) ? values : [])
      .filter((id) => typeof id === "string" && index[id]?.type === "exercise");
    const answersIn = isPlainObject(source.competencyAnswers) ? source.competencyAnswers : {};
    return {
      ok: true,
      value: {
        goal,
        experience,
        daysPerWeek: days,
        timeCeilingMinutes: ceiling,
        gymProfile: { equipmentIds: ids("equipment", (entry) => entry[flag] === 1) },
        competencyAnswers: Object.fromEntries(COMPETENCY_KEYS.map((key) =>
          [key, typeof answersIn[key] === "boolean" ? answersIn[key] : null])),
        movementConfirmations: {},
        emphasisMuscleIds: muscleIds(source.primaryMuscles).slice(0, 5),
        deprioritizedMuscleIds: muscleIds(source.deEmphasizedMuscles).slice(0, 5),
        excludedExerciseIds: exerciseIds((source.exerciseConstraints || []).map((item) => item?.exerciseId)),
        excludedMuscleIds: muscleIds(source.ignoredMuscles),
        preferredExerciseIds: exerciseIds(source.mustHaveExercises),
        split: compatibleSplit(source.splitPreference, days),
        periodization: "static",
        cycles: 7,
        deloadCycles: [],
      },
    };
  }

  function createProductionServices(options) {
    const opts = isPlainObject(options) ? options : {};
    const Compiler = compilerApi(opts.Compiler);
    const catalog = rawCatalogSnapshot(opts.catalog);
    const versions = currentVersions(Compiler);
    return Object.freeze({
      version: versions.compiler,
      currentVersions: () => ({ ...versions }),
      generateProgram: ({ request, seed } = {}) => Compiler.generateProgram(request, catalog, seed),
      buildEmptyProgram: (answers) => buildEmptyProgram(answers, Compiler, catalog),
      splitChoices: (answers) => splitChoices(answers, Compiler),
      fingerprint,
      identityDiff,
    });
  }

  const api = Object.freeze({
    createProductionServices,
    programRequestFromAnswers,
    currentVersions: (Compiler) => currentVersions(compilerApi(Compiler)),
    fingerprint,
    identityDiff,
    buildEmptyProgram: (answers, options) => {
      const opts = isPlainObject(options) ? options : {};
      return buildEmptyProgram(answers, compilerApi(opts.Compiler), rawCatalogSnapshot(opts.catalog));
    },
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEntryAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
