(function (root) {
  "use strict";

  const FAMILY_BY_RESULT = Object.freeze({
    muscle_growth: "growth",
    balanced: "balanced",
    strength: "strength",
  });
  const TELEMETRY_FAMILY = Object.freeze({
    growth: "growth",
    balanced: "balanced",
    strength: "strength",
    home: "home",
    foundation: "foundation",
  });
  const ENV_EQUIPMENT = Object.freeze({
    commercial_gym: Object.freeze(["barbell", "dumbbell", "machine", "cable", "smith"]),
    basic_gym: Object.freeze(["dumbbell", "machine", "cable", "smith", "barbell"]),
    limited_home: Object.freeze([]),
    full_home: Object.freeze(["barbell", "dumbbell", "machine", "cable", "smith"]),
    other: Object.freeze(["dumbbell", "cable", "bodyweight"]),
  });
  const ENV_CAPABILITIES = Object.freeze({
    commercial_gym: Object.freeze(["safe_pull", "training_support"]),
    basic_gym: Object.freeze(["safe_pull", "training_support"]),
    limited_home: Object.freeze([]),
    full_home: Object.freeze(["safe_pull", "training_support"]),
    other: Object.freeze(["safe_pull"]),
  });
  const KNOWN_EQUIPMENT = Object.freeze(["barbell", "dumbbell", "machine", "cable", "smith", "bodyweight"]);
  const KNOWN_CAPABILITIES = Object.freeze(["safe_pull", "training_support"]);

  function environmentKind(answers) {
    return answers?.environment?.kind || "commercial_gym";
  }

  function resolveEquipment(answers) {
    const kind = environmentKind(answers);
    const corrected = answers?.environment?.equipment;
    if (Array.isArray(corrected)) {
      return corrected.filter((token) => KNOWN_EQUIPMENT.includes(token));
    }
    return [...(ENV_EQUIPMENT[kind] || ENV_EQUIPMENT.other)];
  }

  function resolveCapabilities(answers) {
    const kind = environmentKind(answers);
    const corrected = answers?.environment?.capabilities;
    if (Array.isArray(corrected)) {
      return corrected.filter((token) => KNOWN_CAPABILITIES.includes(token));
    }
    return [...(ENV_CAPABILITIES[kind] || ENV_CAPABILITIES.other)];
  }

  function defaultEnvironment(kind) {
    const key = ENV_EQUIPMENT[kind] ? kind : "other";
    return {
      kind: key,
      equipment: [...(ENV_EQUIPMENT[key] || ENV_EQUIPMENT.other)],
      capabilities: [...(ENV_CAPABILITIES[key] || ENV_CAPABILITIES.other)],
    };
  }

  function compilerApi(injected) {
    if (injected) return injected;
    if (typeof root !== "undefined" && root.RepForgeProgramCompiler) return root.RepForgeProgramCompiler;
    if (typeof require === "function") return require("./program-compiler.js");
    throw new TypeError("RepForgeProgramCompiler unavailable");
  }

  function catalogueApi(injected, Compiler) {
    if (Array.isArray(injected)) return injected;
    if (typeof root !== "undefined" && Array.isArray(root.EXERCISE_LIBRARY)) return root.EXERCISE_LIBRARY;
    if (typeof require === "function") {
      try {
        return require("./exercises.js").EXERCISE_LIBRARY;
      } catch {
        return [];
      }
    }
    return [];
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
    const versions = Compiler.VERSIONS || {};
    return {
      compiler: String(versions.compiler ?? "1"),
      family: String(versions.schema ?? "1"),
      blueprint: String(versions.blueprint ?? "1"),
      catalogue: String(versions.catalogue ?? "1"),
      rules: String(versions.rules ?? "1"),
      context: String(versions.context ?? "1"),
      progression: "range-1",
    };
  }

  function resolveFamilyId(answers) {
    if (answers?.environment?.kind === "limited_home") return "home";
    return FAMILY_BY_RESULT[answers?.desiredResult] || null;
  }

  function resolveProfile(answers) {
    if (answers?.structuredExperience === "first") return "foundation";
    return "standard";
  }

  function resolveRecentConsistency(answers) {
    switch (answers?.recentConsistency) {
      case "most": return { recentConsistency: "consistent", reentryEnabled: false };
      case "about_half": return { recentConsistency: "interrupted", reentryEnabled: true };
      case "few":
      case "none":
        return { recentConsistency: "returning", reentryEnabled: true };
      default: return { recentConsistency: "consistent", reentryEnabled: false };
    }
  }

  function answersToCompilerContext(answers, options) {
    const opts = options && typeof options === "object" ? options : {};
    const familyId = opts.familyId || resolveFamilyId(answers);
    const frequency = opts.frequency || answers?.daysPerWeek;
    if (!familyId || !Number.isInteger(frequency)) {
      return { ok: false, code: "incomplete_answers", issues: ["family_or_frequency_required"] };
    }
    const recent = resolveRecentConsistency(answers);
    const context = {
      schemaVersion: 2,
      familyId,
      frequency,
      sessionMinutes: answers.sessionMinutes === 90 ? 90 : Number(answers.sessionMinutes) || 60,
      preferredRestSeconds: Object.prototype.hasOwnProperty.call(answers || {}, "preferredRestSeconds")
        ? answers.preferredRestSeconds
        : null,
      equipment: resolveEquipment(answers),
      environment: resolveCapabilities(answers),
      loadIncrements: familyId === "home" ? {} : { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
      preferences: Array.isArray(answers.mustHaveExercises) ? answers.mustHaveExercises.slice() : [],
      dislikes: Array.isArray(answers.exerciseConstraints)
        ? answers.exerciseConstraints.map((item) => item.exerciseId).filter(Boolean)
        : [],
      history: [],
      primaryMuscles: Array.isArray(answers.primaryMuscles) ? answers.primaryMuscles.slice(0, 2) : [],
      deEmphasizedMuscles: Array.isArray(answers.deEmphasizedMuscles) ? answers.deEmphasizedMuscles.slice(0, 10) : [],
      ignoredMuscles: Array.isArray(answers.ignoredMuscles) ? answers.ignoredMuscles.slice(0, 10) : [],
      priorityMovements: Array.isArray(answers.priorityMovements) ? answers.priorityMovements.slice(0, 2) : [],
      profile: resolveProfile(answers),
      recentConsistency: recent.recentConsistency,
      reentryEnabled: recent.reentryEnabled,
      weekNumber: 1,
    };
    if (opts.splitId) context.splitId = opts.splitId;
    else if (answers.splitPreference) context.splitId = answers.splitPreference;
    return { ok: true, value: context };
  }

  function explanationFor(answers, familyId, diagnostics) {
    return {
      desiredResult: answers.desiredResult || null,
      structuredExperience: answers.structuredExperience || null,
      recentConsistency: answers.recentConsistency || null,
      daysPerWeek: answers.daysPerWeek || null,
      sessionMinutes: answers.sessionMinutes || null,
      mainConstraint: answers.environment?.kind || null,
      familyId,
      diagnostics: diagnostics || null,
    };
  }

  function previewFromInstance(instance, Comp) {
    const estimate = Comp && typeof Comp.estimateDaySeconds === "function"
      ? Comp.estimateDaySeconds
      : () => 0;
    return {
      source: "compiler",
      familyId: instance.familyId,
      frequency: instance.frequency,
      blueprintId: instance.blueprintId,
      program: instance.program,
      programStructure: instance.programStructure,
      days: (instance.days || []).map((day) => ({
        dayId: day.dayId,
        label: day.label,
        estimateMinutes: Math.ceil(estimate(day) / 60),
        exercises: (day.slots || []).map((slot) => ({
          id: slot.slotId,
          name: slot.exercise?.name,
          libraryId: slot.exercise?.id,
          sets: slot.prescription?.sets,
          min: slot.prescription?.repMin,
          max: slot.prescription?.repMax,
        })),
      })),
      limitations: instance.limitations || [],
      reductions: instance.reductions || [],
      provenance: instance.provenance || null,
      primaryMuscles: [],
    };
  }

  function candidateFromInstance(instance, answers, Comp) {
    const family = (Comp.FAMILIES || []).find((item) => item.id === instance.familyId);
    return {
      id: instance.blueprintId,
      family: instance.familyId,
      familyId: instance.familyId,
      name: family?.name || "",
      namePt: family?.namePt || family?.name || "",
      daysPerWeek: instance.frequency,
      blueprintId: instance.blueprintId,
      split: instance.blueprintId,
      complexity: answers.structuredExperience === "first" ? "foundation" : "standard",
      reentry: ["few", "none"].includes(answers.recentConsistency) ? "weeks_1_2" : "none",
    };
  }

  function compileWithServices({ mode, answers, versions, Compiler, catalogue }) {
    const Comp = compilerApi(Compiler);
    const library = catalogueApi(catalogue, Comp);
    const familyId = resolveFamilyId(answers);
    if (!familyId) return { ok: false, code: "family_unresolved" };
    const mustHave = Array.isArray(answers?.mustHaveExercises) ? answers.mustHaveExercises : [];
    const avoided = new Set((answers?.exerciseConstraints || []).map((item) => item?.exerciseId).filter(Boolean));
    const contradictions = mustHave.filter((exerciseId) => avoided.has(exerciseId));
    if (contradictions.length) {
      return {
        ok: false,
        code: "exercise_preference_conflict",
        conflicts: contradictions.map((exerciseId) => ({ code: "must_have_avoided", exerciseId })),
        issues: [],
      };
    }
    const mapped = answersToCompilerContext(answers, {
      familyId,
      frequency: answers.daysPerWeek,
      splitId: mode === "custom" ? answers.splitPreference : undefined,
    });
    if (!mapped.ok) return mapped;
    const primary = Comp.compile(mapped.value, library);
    if (primary.kind !== "compiled") {
      return {
        ok: false,
        code: primary.code || primary.kind,
        conflicts: primary.conflicts || [],
        issues: primary.issues || [],
      };
    }
    const selectedExerciseIds = new Set((primary.program || []).map((exercise) => exercise.libraryId).filter(Boolean));
    const unavailableMustHaves = mustHave.filter((exerciseId) => !selectedExerciseIds.has(exerciseId));
    if (unavailableMustHaves.length) {
      return {
        ok: false,
        code: "must_have_unavailable",
        conflicts: unavailableMustHaves.map((exerciseId) => ({ code: "must_have_unavailable", exerciseId })),
        issues: [],
      };
    }
    const candidates = [candidateFromInstance(primary, answers, Comp)];
    const selected = { ...candidates[0] };
    const source = {
      mode,
      answers,
      versions: versions || currentVersions(Comp),
      familyId: primary.familyId,
      blueprintId: primary.blueprintId,
      profile: mapped.value.profile,
    };
    const preview = {
      ...previewFromInstance(primary, Comp),
      primaryMuscles: mapped.value.primaryMuscles.slice(),
      deEmphasizedMuscles: mapped.value.deEmphasizedMuscles.slice(),
      ignoredMuscles: mapped.value.ignoredMuscles.slice(),
    };
    return {
      ok: true,
      serviceVersion: String(Comp.VERSIONS.compiler),
      name: selected.name,
      namePt: selected.namePt,
      fingerprint: fingerprint(source),
      candidates: candidates.map((candidate) => ({ ...candidate })),
      selected,
      alternative: null,
      diagnostics: explanationFor(answers, primary.familyId, {
        limitations: primary.limitations,
        reductions: primary.reductions,
      }),
      explanation: explanationFor(answers, primary.familyId),
      preview: JSON.parse(JSON.stringify(preview)),
      instance: primary,
      compilerContext: mapped.value,
      telemetry: {
        goal: answers.desiredResult,
        frequency: String(answers.daysPerWeek),
        family: mapped.value.profile === "foundation" ? "foundation" : (TELEMETRY_FAMILY[primary.familyId] || "legacy"),
      },
    };
  }

  function splitChoices(answers, Compiler, catalogue) {
    const Comp = compilerApi(Compiler);
    const library = catalogueApi(catalogue, Comp);
    const familyId = resolveFamilyId(answers);
    if (!familyId || !Number.isInteger(answers?.daysPerWeek)) {
      return { version: String(Comp.VERSIONS.compiler), choices: [] };
    }
    const mapped = answersToCompilerContext(answers, { familyId, frequency: answers.daysPerWeek });
    if (!mapped.ok) return { version: String(Comp.VERSIONS.compiler), choices: [] };
    const family = (Comp.FAMILIES || []).find((item) => item.id === familyId);
    const choices = Comp.getCompatibleSplitChoices(mapped.value).flatMap((choice) => {
      const instance = Comp.compile({ ...mapped.value, splitId: choice.id }, library);
      if (instance.kind !== "compiled") return [];
      return [{
        id: choice.id,
        familyId: choice.familyId,
        frequency: choice.frequency,
        blueprintId: choice.blueprintId,
        blueprintVersion: choice.blueprintVersion,
        default: choice.default === true,
        name: family?.name || "",
        namePt: family?.namePt || family?.name || "",
        days: (instance.days || []).map((day) => ({
          label: day.label,
          estimateMinutes: Math.ceil(Comp.estimateDaySeconds(day) / 60),
        })),
      }];
    }).slice(0, 2).map((choice, index) => ({ ...choice, default: choice.default || index === 0 }));
    return { version: String(Comp.VERSIONS.compiler), choices };
  }

  function browseCatalogue(context, Compiler, catalogue) {
    const Comp = compilerApi(Compiler);
    const library = catalogueApi(catalogue, Comp);
    const answers = context && typeof context === "object" ? context : {};
    const cards = [];
    for (const family of Comp.FAMILIES) {
      for (const frequency of Comp.FREQUENCIES) {
        const familyAnswers = {
          desiredResult: family.id === "growth" ? "muscle_growth" : family.id === "strength" ? "strength" : "balanced",
          structuredExperience: answers.structuredExperience || "6_to_24m",
          recentConsistency: answers.recentConsistency || "most",
          daysPerWeek: frequency,
          sessionMinutes: answers.sessionMinutes || 60,
          preferredRestSeconds: Object.prototype.hasOwnProperty.call(answers, "preferredRestSeconds")
            ? answers.preferredRestSeconds
            : 120,
          environment: answers.environment || { kind: family.id === "home" ? "limited_home" : "commercial_gym" },
          primaryMuscles: [],
          priorityMovements: [],
          exerciseConstraints: [],
        };
        if (family.id === "home") familyAnswers.environment = { kind: "limited_home" };
        else if (answers.environment?.kind === "limited_home") continue;
        const mapped = answersToCompilerContext(familyAnswers, { familyId: family.id, frequency });
        if (!mapped.ok) continue;
        const compiled = Comp.compile(mapped.value, library);
        if (compiled.kind !== "compiled") continue;
        const minutes = answers.sessionMinutes || 60;
        const mismatch = [];
        if (Number.isInteger(answers.daysPerWeek) && answers.daysPerWeek !== frequency) mismatch.push("frequency");
        if (Number.isInteger(answers.sessionMinutes) && answers.sessionMinutes < 45 && frequency >= 5) mismatch.push("time");
        if (answers.environment?.kind === "limited_home" && family.id !== "home") mismatch.push("equipment");
        cards.push({
          id: compiled.blueprintId,
          family: family.id,
          familyId: family.id,
          version: String(compiled.provenance?.blueprintVersion || 1),
          name: family.name,
          namePt: family.namePt,
          purpose: family.publicGoal,
          daysPerWeek: frequency,
          minutes: [Math.max(30, minutes - 15), Math.min(90, minutes + 15)],
          maturity: ["first", "under_6m", "6_to_24m", "over_24m"],
          environments: family.id === "home"
            ? ["limited_home", "other"]
            : ["commercial_gym", "basic_gym", "full_home"],
          browse: true,
          complete: true,
          executable: true,
          tested: true,
          weeklyStructure: (compiled.days || []).map((day) => day.label),
          progression: "Supported Taurifer progression",
          mismatch: mismatch[0] || null,
          mismatches: mismatch,
          fingerprint: fingerprint({ blueprintId: compiled.blueprintId, versions: currentVersions(Comp) }),
          preview: previewFromInstance(compiled, Comp),
          instance: compiled,
          compilerContext: mapped.value,
          telemetryFamily: `${family.id}_v1`,
        });
      }
    }
    return cards.sort((left, right) => {
      const leftMiss = left.mismatch ? 1 : 0;
      const rightMiss = right.mismatch ? 1 : 0;
      if (leftMiss !== rightMiss) return leftMiss - rightMiss;
      if (left.daysPerWeek !== right.daysPerWeek) return left.daysPerWeek - right.daysPerWeek;
      return left.id.localeCompare(right.id);
    });
  }

  function buildEmptyProgram(answers) {
    const daysPerWeek = answers?.daysPerWeek;
    const name = String(answers?.programName || "").trim();
    if (!name || !Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) {
      return { ok: false, code: "build_setup_incomplete" };
    }
    const days = Array.from({ length: daysPerWeek }, (_, index) => ({
      dayId: `manual_d${index + 1}`,
      label: `Day ${index + 1}`,
      order: index + 1,
    }));
    const programStructure = {
      schemaVersion: 1,
      days,
      provenance: {
        source: "manual_build",
        compilerVersion: null,
        familyId: null,
        blueprintId: null,
      },
      weekPrescriptions: [],
      customizedFrom: null,
    };
    return {
      ok: true,
      fingerprint: fingerprint({ name, daysPerWeek, source: "manual_build" }),
      preview: {
        source: "manual_build",
        familyId: null,
        frequency: daysPerWeek,
        program: [],
        programStructure: JSON.parse(JSON.stringify(programStructure)),
        days: days.map((day) => ({ dayId: day.dayId, label: day.label, exercises: [] })),
        primaryMuscles: [],
      },
      program: [],
      programStructure,
      name,
    };
  }

  function createProductionServices(options) {
    const opts = options && typeof options === "object" ? options : {};
    const Comp = compilerApi(opts.Compiler);
    const library = catalogueApi(opts.catalogue, Comp);
    return Object.freeze({
      version: String(Comp.VERSIONS.compiler),
      currentVersions: () => currentVersions(Comp),
      splitChoices: (answers) => splitChoices(answers, Comp, library),
      compile: ({ mode, answers, versions }) => compileWithServices({
        mode,
        answers,
        versions,
        Compiler: Comp,
        catalogue: library,
      }),
      browseCatalogue: (context) => browseCatalogue(context, Comp, library),
      buildEmptyProgram,
      answersToCompilerContext,
      fingerprint,
      resolveFamilyId,
    });
  }

  const api = Object.freeze({
    FAMILY_BY_RESULT,
    ENV_EQUIPMENT,
    ENV_CAPABILITIES,
    KNOWN_EQUIPMENT,
    KNOWN_CAPABILITIES,
    defaultEnvironment,
    createProductionServices,
    answersToCompilerContext,
    currentVersions: (Compiler) => currentVersions(compilerApi(Compiler)),
    fingerprint,
    splitChoices,
    compileWithServices,
    browseCatalogue,
    buildEmptyProgram,
    resolveFamilyId,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEntryAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
