(function (root) {
  "use strict";

  const GENERATOR_VERSION = "067.1";
  const PROGRAM_SCHEMA_VERSION = 2;
  const SUPPORTED_PROGRAM_SCHEMA_VERSIONS = Object.freeze([1, 2]);
  const ROLES = Object.freeze([
    "hypertrophyPrimaryCompound", "hypertrophySecondaryCompound", "hypertrophyAccessory",
    "strengthPrimaryCompound", "strengthSecondaryCompound", "strengthAccessory", "manual",
  ]);
  const SPLITS = Object.freeze({
    full_body: Object.freeze({ days: ["Full Body A", "Full Body B", "Full Body C"], compatibleDays: [2, 3] }),
    upper_lower: Object.freeze({ days: ["Upper A", "Lower A", "Upper B", "Lower B"], compatibleDays: [4] }),
    push_pull_legs_upper_lower: Object.freeze({ days: ["Push", "Pull", "Legs", "Upper", "Lower"], compatibleDays: [5] }),
    push_pull_legs: Object.freeze({ days: ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"], compatibleDays: [6] }),
  });
  const TIME_CEILINGS = Object.freeze([20, 40, 60, 90, 120, 150]);
  const PERIODIZATIONS = Object.freeze(["static", "linear", "reverse_linear", "undulating"]);
  const GOALS = Object.freeze(["hypertrophy", "strength", "hybrid"]);
  const EXPERIENCES = Object.freeze(["beginner", "intermediate", "advanced"]);
  const COMPETENCY_KEYS = Object.freeze([
    "pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10",
  ]);
  const TARGET_KEYS = new Set([
    "loadKg", "loadPerSideKg", "persistentLoadPerSideKg", "assistanceKg", "reps", "repsPerSide",
    "durationSeconds", "durationPerSideSeconds", "distanceShortMeters", "distanceLongMeters", "distanceShortPerSideMeters",
  ]);
  const METRIC_DOMAIN = root?.RepForgeExerciseMetrics ||
    (typeof require === "function" ? require("./exercise-metrics.js") : null);
  if (!METRIC_DOMAIN) throw new Error("RepForgeExerciseMetrics unavailable");
  const METRIC_SEMANTICS = Object.freeze(Object.fromEntries(
    METRIC_DOMAIN.DEFINITIONS.map(({ sourceName, semantic, unit }) => [sourceName, Object.freeze({ semantic, unit })]),
  ));
  const METRIC_NAME_BY_SEMANTIC = Object.freeze(Object.fromEntries(
    Object.entries(METRIC_SEMANTICS).map(([name, definition]) => [definition.semantic, name]),
  ));
  const METRIC_SOURCE_IDS = Object.freeze(Object.fromEntries(
    METRIC_DOMAIN.DEFINITIONS.map(({ id, semantic }) => [semantic, id]),
  ));
  const PRECONDITION_COMPETENCIES = Object.freeze({
    "Barbell bench press preconditions": "benchPress10",
    "Barbell overhead press preconditions": "overheadPress10",
    "45° incline barbell press preconditions": "inclineBarbell10",
    "Bodyweight dip preconditions": "bodyweightDips10",
    "Bodyweight vertical pulls preconditions": "pullups5",
    "Intermediate push-up preconditions": "pushups15",
  });
  const ONTOLOGY_NAMES = Object.freeze({
    compound: "Multi-joint (compound)",
    isolation: "Single joint (isolation)",
    core: "Core",
    lateral: "Lateral Delt Accessory",
    triceps: "Triceps Accessory",
    rearDelt: "Rear Delt Accessory",
    lat: "Lat Accessory",
    squat: "Squat",
    hipHinge: "Hip Hinge",
    calf: "Calf Accessory",
    quad: "Quad Accessory",
    hipAbductor: "Hip Abductor Accessory",
    verticalPush: "Vertical Push",
    horizontalPush: "Horizontal Push",
    verticalPull: "Vertical Pull",
    horizontalPull: "Horizontal Pull",
    biceps: "Biceps Accessory",
    chest: "Chest Accessory",
    hamstring: "Hamstring Accessory",
    abs: "Ab Accessory",
    obliques: "Oblique Acessory",
    chestMuscle: "Chest",
    backMuscle: "Upper Back",
    latsMuscle: "Lats",
    sideDelts: "Side Delts",
    tricepsMuscle: "Triceps",
    rearDelts: "Rear Delts",
    frontDelts: "Front Delts",
    glutes: "Glutes",
    hamstrings: "Hamstrings",
    quads: "Quads",
    calves: "Calves",
    abductors: "Abductors",
    bicepsMuscle: "Biceps",
    absMuscle: "Abs",
    obliquesMuscle: "Obliques",
    unilateral: "Unilateral",
  });

  const STANDARD_JOBS = Object.freeze([
    job("upper_a_horizontal_push", "Upper A", "horizontal_push", "compound", ["horizontalPush"], ["chestMuscle"], "upper", "first_push_lower", 2),
    job("upper_a_horizontal_pull", "Upper A", "horizontal_pull", "compound", ["horizontalPull"], ["latsMuscle", "backMuscle"], "upper", "first_pull", 2),
    job("upper_a_lateral_delts", "Upper A", "lateral_delts", "isolation", ["lateral"], ["sideDelts"], "upper", "assistance", 3),
    job("upper_a_triceps", "Upper A", "triceps", "isolation", ["triceps"], ["tricepsMuscle"], "upper", "assistance", 3),
    job("upper_a_rear_delts", "Upper A", "rear_delts", "isolation", ["rearDelt"], ["rearDelts"], "upper", "assistance", 3),
    job("upper_a_lat_isolation", "Upper A", "lat_isolation", "isolation", ["lat"], ["latsMuscle"], "upper", "assistance", 3),
    job("lower_a_squat", "Lower A", "squat", "compound", ["squat"], ["quads", "glutes"], "lower", "first_push_lower", 3),
    job("lower_a_secondary_hip_extension", "Lower A", "secondary_hip_extension", "compound", ["hipHinge"], ["glutes", "hamstrings"], "lower", "secondary_push_lower", 3),
    job("lower_a_calves", "Lower A", "calves", "isolation", ["calf"], ["calves"], "lower", "assistance", 3),
    job("lower_a_quadriceps_isolation", "Lower A", "quadriceps_isolation", "isolation", ["quad"], ["quads"], "lower", "assistance", 3),
    job("lower_a_hip_abduction", "Lower A", "hip_abduction", "isolation", ["hipAbductor"], ["abductors"], "lower", "assistance", 3),
    job("upper_b_incline_or_overhead_push", "Upper B", "incline_or_overhead_push", "compound", ["verticalPush", "horizontalPush"], ["frontDelts", "chestMuscle"], "upper", "first_push_lower", 3),
    job("upper_b_vertical_pull", "Upper B", "vertical_pull", "compound", ["verticalPull"], ["latsMuscle"], "upper", "first_pull", 3),
    job("upper_b_additional_horizontal_push", "Upper B", "additional_horizontal_push", "compound", ["horizontalPush"], ["chestMuscle"], "upper", "secondary_push_lower", 2),
    job("upper_b_additional_horizontal_pull", "Upper B", "additional_horizontal_pull", "compound", ["horizontalPull"], ["latsMuscle", "backMuscle"], "upper", "secondary_pull", 2),
    job("upper_b_biceps", "Upper B", "biceps", "isolation", ["biceps"], ["bicepsMuscle"], "upper", "assistance", 3),
    job("upper_b_chest_isolation", "Upper B", "chest_isolation", "isolation", ["chest"], ["chestMuscle"], "upper", "assistance", 3),
    job("lower_b_hip_hinge", "Lower B", "hip_hinge", "compound", ["hipHinge"], ["hamstrings", "glutes"], "lower", "first_push_lower", 3),
    job("lower_b_secondary_squat", "Lower B", "secondary_squat", "compound", ["squat"], ["quads"], "lower", "secondary_push_lower", 3),
    job("lower_b_knee_flexion", "Lower B", "knee_flexion", "isolation", ["hamstring"], ["hamstrings"], "lower", "assistance", 3),
    job("lower_b_abs", "Lower B", "abs", "core", ["abs"], ["absMuscle"], "trunk", "assistance", 3),
    job("lower_b_obliques", "Lower B", "obliques", "core", ["obliques"], ["obliquesMuscle"], "trunk", "assistance", 3),
  ]);
  const COMPACT_PURPOSES = new Set([
    "upper_a_horizontal_push", "upper_a_horizontal_pull", "upper_a_lateral_delts", "upper_a_triceps",
    "lower_a_squat", "lower_a_calves", "lower_a_quadriceps_isolation",
    "upper_b_incline_or_overhead_push", "upper_b_vertical_pull", "upper_b_biceps", "upper_b_chest_isolation", "upper_b_rear_delts",
    "lower_b_hip_hinge", "lower_b_knee_flexion", "lower_b_abs",
  ]);
  const COMPACT_SET_COUNTS = Object.freeze({
    upper_a_horizontal_push: 3, upper_a_horizontal_pull: 2, upper_a_lateral_delts: 2, upper_a_triceps: 2,
    lower_a_squat: 3, lower_a_calves: 3, lower_a_quadriceps_isolation: 3,
    upper_b_incline_or_overhead_push: 2, upper_b_vertical_pull: 2, upper_b_biceps: 2,
    upper_b_chest_isolation: 2, upper_b_rear_delts: 2,
    lower_b_hip_hinge: 3, lower_b_knee_flexion: 3, lower_b_abs: 3,
  });
  const STANDARD_SET_COUNTS = Object.freeze({
    upper_a_horizontal_push: 2, upper_a_horizontal_pull: 2, upper_a_lateral_delts: 3,
    upper_a_triceps: 3, upper_a_rear_delts: 3, upper_a_lat_isolation: 3,
    lower_a_squat: 3, lower_a_secondary_hip_extension: 3, lower_a_calves: 3,
    lower_a_quadriceps_isolation: 3, lower_a_hip_abduction: 3,
    upper_b_incline_or_overhead_push: 3, upper_b_vertical_pull: 3,
    upper_b_additional_horizontal_push: 2, upper_b_additional_horizontal_pull: 2,
    upper_b_biceps: 3, upper_b_chest_isolation: 3,
    lower_b_hip_hinge: 3, lower_b_secondary_squat: 3, lower_b_knee_flexion: 3,
    lower_b_abs: 3, lower_b_obliques: 3,
  });

  const ontologyByCatalog = new WeakMap();
  const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const unique = (values) => [...new Set(values)];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const sorted = (values) => [...values].sort();

  function job(purposeId, day, musclePurposeKey, typeKey, patternKeys, muscleKeys, region, repClass, sets) {
    return Object.freeze({
      purposeId, day, musclePurposeKey, typeKey, patternKeys: Object.freeze(patternKeys),
      muscleKeys: Object.freeze(muscleKeys), region, repClass, sets,
      order: -1,
    });
  }

  function finalizedJobs(compact) {
    const chosen = STANDARD_JOBS.filter((entry) => !compact || COMPACT_PURPOSES.has(entry.purposeId));
    const jobs = chosen.map((entry, index) => ({
      ...entry,
      order: index,
      sets: compact ? COMPACT_SET_COUNTS[entry.purposeId] : STANDARD_SET_COUNTS[entry.purposeId],
    }));
    if (compact) {
      const rear = STANDARD_JOBS.find((entry) => entry.purposeId === "upper_a_rear_delts");
      jobs.push({ ...rear, purposeId: "upper_b_rear_delts", day: "Upper B", order: jobs.length, sets: COMPACT_SET_COUNTS.upper_b_rear_delts });
    }
    return jobs;
  }

  function validCatalog(catalog) {
    return isPlainObject(catalog) && Array.isArray(catalog.exercises) && isPlainObject(catalog.uuidIndex);
  }

  function catalogObject(catalog, id) {
    return typeof id === "string" && owns(catalog.uuidIndex, id) ? catalog.uuidIndex[id] : null;
  }

  function ontology(catalog) {
    if (ontologyByCatalog.has(catalog)) return ontologyByCatalog.get(catalog);
    const values = new Map();
    for (const [id, entry] of Object.entries(catalog.uuidIndex)) {
      if (!isPlainObject(entry) || typeof entry.type !== "string") continue;
      const key = `${entry.type}\u0000${String(entry.name)}`;
      if (!values.has(key)) values.set(key, []);
      values.get(key).push(id);
    }
    const resolved = Object.freeze({
      lookup(type, name) {
        const matches = values.get(`${type}\u0000${String(name)}`) || [];
        return matches.length === 1 ? matches[0] : null;
      },
      resolve(type, name) {
        const matches = values.get(`${type}\u0000${String(name)}`) || [];
        return matches.length === 1 ? matches[0] : null;
      },
      matches(type, name) { return [...(values.get(`${type}\u0000${String(name)}`) || [])]; },
    });
    ontologyByCatalog.set(catalog, resolved);
    return resolved;
  }

  function resolveJobPolicy(jobValue, catalog) {
    if (Array.isArray(jobValue.patternIds) && Array.isArray(jobValue.muscleIds)
      && typeof jobValue.exerciseTypeId === "string") {
      const issues = [];
      jobValue.patternIds.forEach((id) => { if (catalogObject(catalog, id)?.type !== "movementPattern") issues.push(`movementPattern ${id} is absent or invalid`); });
      jobValue.muscleIds.forEach((id) => { if (catalogObject(catalog, id)?.type !== "featureMuscleGroup") issues.push(`featureMuscleGroup ${id} is absent or invalid`); });
      if (catalogObject(catalog, jobValue.exerciseTypeId)?.type !== "exerciseType") issues.push(`exerciseType ${jobValue.exerciseTypeId} is absent or invalid`);
      return { ...jobValue, patternIds: [...jobValue.patternIds], muscleIds: [...jobValue.muscleIds], issues };
    }
    const index = ontology(catalog);
    const patternNames = jobValue.patternKeys.map((key) => ONTOLOGY_NAMES[key]);
    const muscleNames = jobValue.muscleKeys.map((key) => ONTOLOGY_NAMES[key]);
    const patternIds = patternNames.map((name) => index.resolve("movementPattern", name));
    const muscleIds = muscleNames.map((name) => index.resolve("featureMuscleGroup", name));
    const typeName = ONTOLOGY_NAMES[jobValue.typeKey];
    const exerciseTypeId = index.resolve("exerciseType", typeName);
    const issues = [];
    patternNames.forEach((name, position) => { if (!patternIds[position]) issues.push(`movementPattern ${name} is absent or ambiguous`); });
    muscleNames.forEach((name, position) => { if (!muscleIds[position]) issues.push(`featureMuscleGroup ${name} is absent or ambiguous`); });
    if (!exerciseTypeId) issues.push(`exerciseType ${typeName} is absent or ambiguous`);
    return { ...jobValue, patternIds, muscleIds, exerciseTypeId, issues };
  }

  function validateRequest(rawRequest, catalog) {
    const issues = [];
    if (!isPlainObject(rawRequest)) return { ok: false, issues: [{ field: "request", code: "invalid_request", message: "Expected a request object." }] };
    const request = clone(rawRequest);
    if (!GOALS.includes(request.goal)) issues.push(fieldIssue("goal", "unsupported_goal", "Choose hypertrophy, strength, or hybrid."));
    if (!EXPERIENCES.includes(request.experience)) issues.push(fieldIssue("experience", "unsupported_experience", "Choose beginner, intermediate, or advanced."));
    if (!Number.isInteger(request.daysPerWeek) || request.daysPerWeek < 2 || request.daysPerWeek > 6) {
      issues.push(fieldIssue("daysPerWeek", "unsupported_frequency", "Training frequency must be between two and six days."));
    }
    if (!TIME_CEILINGS.includes(request.timeCeilingMinutes)) {
      issues.push(fieldIssue("timeCeilingMinutes", "unsupported_time_ceiling", "Choose 20, 40, 60, 90, 120, or 150 minutes."));
    }
    if (!isPlainObject(request.gymProfile) || !Array.isArray(request.gymProfile.equipmentIds)) {
      issues.push(fieldIssue("gymProfile.equipmentIds", "equipment_required", "Choose the equipment available in this gym."));
    }
    if (isPlainObject(request.gymProfile) && Array.isArray(request.gymProfile.equipmentIds)) {
      const unknown = request.gymProfile.equipmentIds.filter((id) => catalogObject(catalog, id)?.type !== "equipment");
      if (unknown.length) issues.push(fieldIssue("gymProfile.equipmentIds", "unknown_equipment", "The equipment profile contains an unknown equipment ID."));
      request.gymProfile.equipmentIds = unique(request.gymProfile.equipmentIds);
    }
    request.split = request.split || "auto";
    if (request.split !== "auto" && !owns(SPLITS, request.split)) issues.push(fieldIssue("split", "unsupported_split", "Choose an authored split."));
    if (Number.isInteger(request.daysPerWeek) && owns(SPLITS, request.split)
      && !SPLITS[request.split].compatibleDays.includes(request.daysPerWeek)) {
      issues.push(fieldIssue("split", "split_frequency_mismatch", "This split is only available at its authored training frequency."));
    }
    if (request.split === "auto" && Number.isInteger(request.daysPerWeek)) request.split = automaticSplit(request.daysPerWeek);
    request.periodization = request.periodization || "static";
    if (!PERIODIZATIONS.includes(request.periodization)) issues.push(fieldIssue("periodization", "unsupported_periodization", "Choose static, linear, reverse linear, or undulating."));
    request.cycles = request.cycles === undefined ? 7 : request.cycles;
    if (!Number.isInteger(request.cycles) || request.cycles < 1 || request.cycles > 12) {
      issues.push(fieldIssue("cycles", "unsupported_cycle_count", "Cycle count must be between one and twelve."));
    }
    request.deloadCycles = request.deloadCycles === undefined ? [] : request.deloadCycles;
    if (!Array.isArray(request.deloadCycles) || request.deloadCycles.some((cycle) =>
      !Number.isInteger(cycle) || cycle < 1 || cycle > request.cycles) || new Set(request.deloadCycles).size !== request.deloadCycles.length) {
      issues.push(fieldIssue("deloadCycles", "invalid_deload_cycles", "Deload cycles must be unique cycle numbers inside this program."));
    }
    for (const field of ["emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds", "preferredExerciseIds"]) {
      if (request[field] === undefined) request[field] = [];
      if (!Array.isArray(request[field]) || request[field].some((id) => typeof id !== "string" || !id)) {
        issues.push(fieldIssue(field, "invalid_id_list", "Expected a list of catalog IDs."));
        continue;
      }
      request[field] = unique(request[field]);
      if (["emphasisMuscleIds", "deprioritizedMuscleIds", "excludedMuscleIds"].includes(field) && request[field].length > 5) {
        issues.push(fieldIssue(field, "too_many_muscle_groups", "Choose no more than five muscle groups."));
      }
      const expected = field.includes("Muscle") ? "featureMuscleGroup" : "exercise";
      if (request[field].some((id) => catalogObject(catalog, id)?.type !== expected)) {
        issues.push(fieldIssue(field, "unknown_catalog_id", `Each ID must name a ${expected} record.`));
      }
    }
    request.competencyAnswers = isPlainObject(request.competencyAnswers) ? request.competencyAnswers : {};
    for (const key of COMPETENCY_KEYS) {
      if (request.competencyAnswers[key] === undefined) request.competencyAnswers[key] = null;
      if (![true, false, null].includes(request.competencyAnswers[key])) {
        issues.push(fieldIssue(`competencyAnswers.${key}`, "invalid_competency_answer", "Answer yes, no, or leave this movement ability unconfirmed."));
      }
    }
    request.movementConfirmations = isPlainObject(request.movementConfirmations) ? request.movementConfirmations : {};
    for (const [exerciseId, ids] of Object.entries(request.movementConfirmations)) {
      if (catalogObject(catalog, exerciseId)?.type !== "exercise" || !Array.isArray(ids)
        || ids.some((id) => catalogObject(catalog, id)?.type !== "preconditions")) {
        issues.push(fieldIssue(`movementConfirmations.${exerciseId}`, "invalid_movement_confirmation", "Confirmations must name prerequisites for a current catalog exercise."));
      }
    }
    request.executionContexts = isPlainObject(request.executionContexts) ? request.executionContexts : {};
    for (const [exerciseId, mode] of Object.entries(request.executionContexts)) {
      const exercise = catalog.exercises.find((entry) => entry.id === exerciseId);
      if (catalogObject(catalog, exerciseId)?.type !== "exercise" || !["bilateral", "unilateral"].includes(mode)) {
        issues.push(fieldIssue(`executionContexts.${exerciseId}`, "invalid_execution_context", "Choose bilateral or unilateral execution for a current catalog exercise."));
        continue;
      }
      const names = unique((exercise?.laterality || []).map((id) => catalogObject(catalog, id)?.name).filter(Boolean));
      const onlyUnilateral = names.includes("Unilateral") && !names.includes("Bilateral");
      const onlyBilateral = names.includes("Bilateral") && !names.includes("Unilateral");
      if ((onlyUnilateral && mode !== "unilateral") || (onlyBilateral && mode !== "bilateral")) {
        issues.push(fieldIssue(`executionContexts.${exerciseId}`, "conflicting_execution_context", "Execution mode cannot contradict a movement’s sole catalog laterality."));
      }
    }
    if (!request.gymProfile) request.gymProfile = { equipmentIds: [] };
    return issues.length ? { ok: false, issues } : { ok: true, value: request };
  }

  function automaticSplit(days) {
    if (days === 2 || days === 3) return "full_body";
    if (days === 4) return "upper_lower";
    if (days === 5) return "push_pull_legs_upper_lower";
    return "push_pull_legs";
  }

  function fieldIssue(field, code, message) { return { field, code, message }; }

  function equipmentClosure(ids, catalog) {
    const closed = new Set();
    for (const id of ids) {
      let current = id;
      const chain = new Set();
      while (typeof current === "string" && !chain.has(current)) {
        chain.add(current);
        const equipment = catalogObject(catalog, current);
        if (!equipment || equipment.type !== "equipment") break;
        closed.add(current);
        current = equipment.pluralOf;
      }
    }
    return closed;
  }

  function equipmentContexts(exercise, context, catalog) {
    const profile = context.gymProfile || context;
    const availableIds = Array.isArray(profile.equipmentIds) ? profile.equipmentIds : [];
    const available = equipmentClosure(availableIds, catalog);
    const groups = (ids, expectedType) => {
      if (!Array.isArray(ids) || ids.length === 0) return [{ groupId: null, equipmentIds: [] }];
      const satisfied = [];
      for (const groupId of ids) {
        const group = catalogObject(catalog, groupId);
        if (group?.type === "equipment") {
          if (available.has(groupId)) satisfied.push({ groupId: null, equipmentIds: [groupId] });
          continue;
        }
        if (!group || group.type !== expectedType || !Array.isArray(group.equipment)) continue;
        const required = unique(group.equipment);
        if (required.every((id) => available.has(id))) {
          satisfied.push({ groupId, equipmentIds: sorted(required) });
        }
      }
      return satisfied;
    };
    const resistance = groups(exercise.resistanceEquipmentGroupIds, "resistanceEquipmentGroup");
    const support = groups(exercise.supportEquipmentGroupIds, "supportEquipmentGroup");
    if (!resistance.length || !support.length) return [];
    return resistance.flatMap((resistanceGroup) => support.map((supportGroup) => ({
      resistanceGroupId: resistanceGroup.groupId,
      supportGroupId: supportGroup.groupId,
      equipmentIds: sorted(unique([...resistanceGroup.equipmentIds, ...supportGroup.equipmentIds])),
    })));
  }

  function prerequisitesSatisfied(exercise, context, catalog) {
    const ids = Array.isArray(exercise.preconditions) ? exercise.preconditions : [];
    if (!ids.length) return { ok: true, confirmations: [] };
    const confirmations = context.movementConfirmations?.[exercise.id];
    const confirmed = new Set(Array.isArray(confirmations) ? confirmations : []);
    const failures = [];
    for (const id of ids) {
      const item = catalogObject(catalog, id);
      if (!item || item.type !== "preconditions") {
        failures.push({ prerequisiteId: id, reason: "unknown_prerequisite" });
        continue;
      }
      const competency = PRECONDITION_COMPETENCIES[item.name];
      if (competency) {
        if (context.competencyAnswers?.[competency] === true) continue;
        if (context.competencyAnswers?.[competency] === false) {
          failures.push({ prerequisiteId: id, competency, reason: "competency_answer_no" });
          continue;
        }
      }
      if (confirmed.has(id)) continue;
      failures.push({ prerequisiteId: id, competency: competency || null, reason: "movement_confirmation_required" });
    }
    return failures.length ? { ok: false, failures } : { ok: true, confirmations: ids };
  }

  function metricDefinitionsFor(exercise, catalog) {
    const ids = Array.isArray(exercise.exerciseMetrics) ? exercise.exerciseMetrics : [];
    const canonical = METRIC_DOMAIN.definitionsForIds(ids);
    const raw = METRIC_DOMAIN.validateRawIds(ids, catalog.uuidIndex, { allowEmpty: true });
    return canonical.ok && raw.ok ? canonical.value : ids.map(() => null);
  }

  function repsSemantic(definitions) {
    if (definitions.some((entry) => entry?.semantic === "reps")) return "reps";
    if (definitions.some((entry) => entry?.semantic === "repsPerSide")) return "repsPerSide";
    return null;
  }

  function executionMode(exercise, context, catalog) {
    const explicit = context.executionContexts?.[exercise.id];
    const names = unique((Array.isArray(exercise.laterality) ? exercise.laterality : [])
      .map((id) => catalogObject(catalog, id)?.name).filter((name) => typeof name === "string"));
    const unilateral = names.includes("Unilateral");
    const bilateral = names.includes("Bilateral");
    if (unilateral && bilateral) return ["bilateral", "unilateral"].includes(explicit) ? explicit : null;
    if (unilateral) return "unilateral";
    if (bilateral) return "bilateral";
    return ["bilateral", "unilateral"].includes(explicit) ? explicit : null;
  }

  function roleFor(jobValue, goal) {
    const useStrength = goal === "strength" || (goal === "hybrid" && jobValue.repClass !== "assistance");
    if (jobValue.repClass === "assistance") return goal === "strength" ? "strengthAccessory" : "hypertrophyAccessory";
    const level = jobValue.repClass === "first_push_lower" || jobValue.repClass === "first_pull"
      ? "PrimaryCompound" : "SecondaryCompound";
    return `${useStrength ? "strength" : "hypertrophy"}${level}`;
  }

  function roleTier(exercise, role) {
    const fields = {
      hypertrophyPrimaryCompound: "hypertrophyPrimaryCompoundRecommendationLevel",
      hypertrophySecondaryCompound: "hypertrophySecondaryCompoundRecommendationLevel",
      hypertrophyAccessory: "hypertrophyAccessoryRecommendationLevel",
      strengthPrimaryCompound: "strengthPrimaryCompoundRecommendationLevel",
      strengthSecondaryCompound: "strengthSecondaryCompoundRecommendationLevel",
      strengthAccessory: "strengthAccessoryRecommendationLevel",
    };
    const value = exercise[fields[role]];
    return finite(value) ? value : null;
  }

  function matchesPurpose(exercise, resolvedJob) {
    if (!Array.isArray(exercise.movementPattern) || !exercise.movementPattern.some((id) => resolvedJob.patternIds.includes(id))) return false;
    if (!Array.isArray(exercise.primaryFeatureMuscle)
      || !exercise.primaryFeatureMuscle.some((id) => resolvedJob.muscleIds.includes(id))) return false;
    if (exercise.exerciseType !== resolvedJob.exerciseTypeId) return false;
    return true;
  }

  function excludedByMuscle(exercise, excludedMuscleIds) {
    const trained = unique([
      ...(Array.isArray(exercise.primaryFeatureMuscle) ? exercise.primaryFeatureMuscle : []),
      ...(Array.isArray(exercise.secondaryFeatureMuscle) ? exercise.secondaryFeatureMuscle : []),
    ]);
    return trained.some((id) => excludedMuscleIds.includes(id));
  }

  function candidateFailure(exercise, resolvedJob, role, context, catalog, excludedIds, usedIds, usedGroups) {
    if (!matchesPurpose(exercise, resolvedJob)) return "purpose_mismatch";
    const tier = roleTier(exercise, role);
    if (tier === null) return "role_tier_unavailable";
    if ((context.excludedExerciseIds || []).includes(exercise.id) || excludedIds.has(exercise.id)) return "exercise_excluded";
    if (excludedByMuscle(exercise, context.excludedMuscleIds || [])) return "muscle_excluded";
    const metricIds = Array.isArray(exercise.exerciseMetrics) ? exercise.exerciseMetrics : [];
    const metricDefinitions = metricDefinitionsFor(exercise, catalog);
    if (!metricIds.length || metricDefinitions.some((definition) => !definition) || !repsSemantic(metricDefinitions)) return "metric_not_automatically_prescribable";
    if (repsSemantic(metricDefinitions) === "repsPerSide" && !executionMode(exercise, context, catalog)) return "execution_context_required";
    const prerequisites = prerequisitesSatisfied(exercise, context, catalog);
    if (!prerequisites.ok) return "prerequisite_confirmation_required";
    if (!equipmentContexts(exercise, context, catalog).length) return "equipment_unavailable";
    if (usedIds.has(exercise.id)) return "exercise_repeated";
    const groupings = Array.isArray(exercise.exclusionGroupings) ? exercise.exclusionGroupings : [];
    if (groupings.some((id) => usedGroups.has(id))) return "exclusion_group_collision";
    return null;
  }

  function seedRank(seed, purposeId, exerciseId) {
    let hash = 2166136261;
    const input = `${String(seed)}\u0000${purposeId}\u0000${exerciseId}`;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function candidatesForJob(jobValue, role, context, catalog, options = {}) {
    const resolvedJob = resolveJobPolicy(jobValue, catalog);
    if (resolvedJob.issues.length) return { candidates: [], policyIssues: resolvedJob.issues };
    const excludedIds = options.excludedIds || new Set();
    const usedIds = options.usedIds || new Set();
    const usedGroups = options.usedGroups || new Set();
    const rejected = {};
    const candidates = [];
    for (const exercise of catalog.exercises) {
      const failure = candidateFailure(exercise, resolvedJob, role, context, catalog, excludedIds, usedIds, usedGroups);
      if (failure) {
        rejected[failure] = (rejected[failure] || 0) + 1;
        continue;
      }
      candidates.push({
        exerciseId: exercise.id,
        roleTier: roleTier(exercise, role),
        eligibleEquipmentContexts: equipmentContexts(exercise, context, catalog),
        reasons: ["purpose_match", "required_role_tier", "hard_constraints_passed"],
        _preferred: (context.preferredExerciseIds || []).includes(exercise.id),
        _seedRank: seedRank(options.seed || "", jobValue.purposeId, exercise.id),
        _exercise: exercise,
        _job: resolvedJob,
      });
    }
    candidates.sort((left, right) => left.roleTier - right.roleTier
      || Number(right._preferred) - Number(left._preferred)
      || left._seedRank - right._seedRank
      || left.exerciseId.localeCompare(right.exerciseId));
    return { candidates, rejected, policyIssues: [] };
  }

  function prepareJobs(request, catalog) {
    const compact = request.timeCeilingMinutes <= 40;
    const all = finalizedJobs(compact);
    if (request.daysPerWeek === 4) return all;
    return distributeJobs(all, request.daysPerWeek, request.split);
  }

  function dayKinds(daysPerWeek, split) {
    if (split === "full_body") return Array.from({ length: daysPerWeek }, (_, index) => ({ name: `Full Body ${String.fromCharCode(65 + index)}`, group: "all" }));
    if (split === "upper_lower") return [
      { name: "Upper A", group: "upper" }, { name: "Lower A", group: "lower" },
      { name: "Upper B", group: "upper" }, { name: "Lower B", group: "lower" },
    ];
    if (split === "push_pull_legs_upper_lower") return [
      { name: "Push", group: "push" }, { name: "Pull", group: "pull" }, { name: "Legs", group: "legs" },
      { name: "Upper", group: "upper" }, { name: "Lower", group: "lower" },
    ];
    return [
      { name: "Push A", group: "push" }, { name: "Pull A", group: "pull" }, { name: "Legs A", group: "legs" },
      { name: "Push B", group: "push" }, { name: "Pull B", group: "pull" }, { name: "Legs B", group: "legs" },
    ];
  }

  function compatibleDay(jobValue, day) {
    if (day.group === "all") return true;
    if (jobValue.region === "trunk") return true;
    if (jobValue.region === "lower") return day.group === "legs" || day.group === "lower";
    const patterns = jobValue.patternKeys;
    if (day.group === "upper") return jobValue.region === "upper";
    if (day.group === "push") return jobValue.region === "upper"
      && !patterns.includes("horizontalPull") && !patterns.includes("verticalPull")
      && !patterns.includes("biceps");
    if (day.group === "pull") return jobValue.region === "upper"
      && (patterns.includes("horizontalPull") || patterns.includes("verticalPull")
        || patterns.includes("rearDelt") || patterns.includes("lat") || patterns.includes("biceps"));
    return false;
  }

  function distributeJobs(jobs, daysPerWeek, split) {
    const days = dayKinds(daysPerWeek, split).map((day, index) => ({ ...day, index, assignedSets: 0 }));
    return jobs.map((entry) => {
      const eligible = days.filter((day) => compatibleDay(entry, day));
      const destinations = eligible.length ? eligible : days;
      destinations.sort((left, right) => left.assignedSets - right.assignedSets || left.index - right.index);
      const destination = destinations[0];
      destination.assignedSets += entry.sets;
      return { ...entry, day: destination.name, dayIndex: destination.index, movable: true };
    });
  }

  function scheduledTrainingIndexes(frequency) {
    const maps = {
      2: [0, 3],
      3: [0, 2, 4],
      4: [0, 2, 4, 6],
      5: [0, 1, 2, 4, 6],
      6: [0, 1, 2, 4, 5, 6],
    };
    return maps[frequency];
  }

  function rawDays(jobs, request, seed) {
    const schedule = Array.from({ length: 7 }, (_, index) => ({
      id: `day-${stableId(seed, `week-day-${index + 1}`)}`,
      name: "Rest",
      kind: "rest",
      order: index + 1,
      slots: [],
      _group: "rest",
    }));
    const authored = dayKinds(request.daysPerWeek, request.split);
    const trainingIndexes = scheduledTrainingIndexes(request.daysPerWeek);
    const idForName = new Map();
    authored.forEach((entry, index) => {
      const scheduleIndex = trainingIndexes[index];
      const day = schedule[scheduleIndex];
      day.name = entry.name;
      day.kind = "training";
      day._group = entry.group;
      idForName.set(entry.name, day.id);
    });
    return { days: schedule, idForName };
  }

  // Generated day names stay English in the definition, so fingerprints,
  // setup-link recipes and backups do not change with the app language. The
  // display layer asks for a translation key, which exists only while the day
  // still carries the exact name the generator gave that week position; a
  // renamed, swapped or added day is the lifter's own text.
  function generatedDayNameKey(definition, dayId) {
    const request = definition?.request;
    if (!request || !owns(SPLITS, request.split) || !Array.isArray(definition.days)) return null;
    const trainingIndexes = scheduledTrainingIndexes(request.daysPerWeek);
    if (!trainingIndexes || !SPLITS[request.split].compatibleDays.includes(request.daysPerWeek)) return null;
    const position = definition.days.findIndex((day) => day?.id === dayId);
    const authoredIndex = trainingIndexes.indexOf(position);
    if (authoredIndex < 0 || definition.days[position].kind !== "training") return null;
    const authored = dayKinds(request.daysPerWeek, request.split)[authoredIndex];
    if (!authored || definition.days[position].name !== authored.name) return null;
    return `program.split_day.${authored.name.toLowerCase().replace(/\s+/g, "_")}`;
  }

  function stableId(seed, value) {
    return seedRank(seed, "id", value).toString(36).padStart(7, "0");
  }

  function roleForJob(jobValue, goal) { return roleFor(jobValue, goal); }

  function candidateIsBetterThanCollision(candidate, usedIds, usedGroups) {
    const ex = candidate._exercise;
    if (usedIds.has(ex.id)) return false;
    return !(Array.isArray(ex.exclusionGroupings) && ex.exclusionGroupings.some((id) => usedGroups.has(id)));
  }

  function selectAllJobs(jobs, request, catalog, seed) {
    const assignments = new Array(jobs.length);
    const usedIds = new Set();
    const usedGroups = new Set();
    const conflicts = [];
    let visited = 0;
    const MAX_SEARCH_NODES = 50000;
    function visit(position) {
      if (position >= jobs.length) return true;
      if (++visited > MAX_SEARCH_NODES) return false;
      const entry = jobs[position];
      const role = roleForJob(entry, request.goal);
      const pool = candidatesForJob(entry, role, request, catalog, { seed, usedIds, usedGroups });
      if (pool.policyIssues.length) {
        conflicts.push({ code: "policy_identity_unresolved", purposeId: entry.purposeId, issues: pool.policyIssues });
        return false;
      }
      if (!pool.candidates.length) {
        conflicts.push({
          code: "no_eligible_exercise", purposeId: entry.purposeId, role,
          reasons: pool.rejected,
          message: `No eligible catalog exercise can fill ${entry.purposeId} under the current constraints.`,
        });
        return false;
      }
      for (const candidate of pool.candidates) {
        if (!candidateIsBetterThanCollision(candidate, usedIds, usedGroups)) continue;
        const exercise = candidate._exercise;
        assignments[position] = { job: entry, role, candidate };
        usedIds.add(exercise.id);
        const groupings = Array.isArray(exercise.exclusionGroupings) ? exercise.exclusionGroupings : [];
        groupings.forEach((id) => usedGroups.add(id));
        if (visit(position + 1)) return true;
        groupings.forEach((id) => usedGroups.delete(id));
        usedIds.delete(exercise.id);
        assignments[position] = null;
        if (visited > MAX_SEARCH_NODES) break;
      }
      return false;
    }
    const ok = visit(0);
    if (!ok && !conflicts.length) conflicts.push({
      code: "no_complete_program", message: "The hard constraints leave no complete program without repeated or conflicting movements.",
    });
    if (!ok) return { ok: false, conflicts: uniqueConflicts(conflicts) };
    return { ok: true, assignments };
  }

  function uniqueConflicts(conflicts) {
    const seen = new Set();
    return conflicts.filter((item) => {
      const key = `${item.code}|${item.purposeId || ""}|${JSON.stringify(item.reasons || {})}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function trainingDayLabel(day) { return day.name; }

  function createInternalSlot(assignment, day, ordinal, request, seed, catalog) {
    const { job: entry, role, candidate } = assignment;
    const ex = candidate._exercise;
    const resolved = candidate._job;
    const metrics = metricDefinitionsFor(ex, catalog);
    const repsKey = repsSemantic(metrics);
    const slotId = `slot-${stableId(seed, `${entry.purposeId}|${ordinal}`)}`;
    return {
      id: slotId,
      purposeId: entry.purposeId,
      exerciseId: ex.id,
      sourceExerciseIds: [ex.id],
      role,
      musclePurposeIds: [...resolved.muscleIds],
      movementPatternIds: [...resolved.patternIds],
      exerciseTypeId: resolved.exerciseTypeId,
      metricIds: [...ex.exerciseMetrics],
      metricDefinitions: metrics.map((item) => ({ ...item })),
      metricOrigin: "source_catalog",
      lateralityIds: Array.isArray(ex.laterality) ? [...ex.laterality] : [],
      executionMode: executionMode(ex, request, catalog),
      loadingModel: {
        bodyweightCoefficient: finite(ex.bodyweight) ? ex.bodyweight : null,
        assistanceDirection: "subtract",
      },
      prescriptionsByCycle: [],
      _dayId: day.id,
      _dayName: day.name,
      _dayGroup: day._group,
      _repClass: entry.repClass,
      _baseSetCount: entry.sets,
      _setCount: request.experience === "beginner" ? Math.max(1, entry.sets - 1) : entry.sets,
      _bonusSets: 0,
      _isEmphasisSlot: false,
      _order: entry.order,
      _dayMovable: entry.movable === true,
      _repsKey: repsKey,
      _executionMode: executionMode(ex, request, catalog),
      _lateralityId: ex.laterality?.[0] || null,
      _exercise: ex,
      _sourceEvidence: entry.purposeId.startsWith("emphasis_") ? "approximation" : "observed_job_policy",
      _timeCeilingSeconds: request.timeCeilingMinutes * 60,
    };
  }

  function stableRepRange(jobValue, goal) {
    if (goal === "strength") {
      return {
        first_push_lower: [3, 5], first_pull: [5, 7],
        secondary_push_lower: [5, 7], secondary_pull: [7, 9], assistance: [8, 12],
      }[jobValue.repClass];
    }
    return {
      first_push_lower: [7, 9], first_pull: [9, 11],
      secondary_push_lower: [9, 11], secondary_pull: [11, 13], assistance: [14, 16],
    }[jobValue.repClass];
  }

  function finalRir(jobValue) {
    return jobValue.repClass === "assistance" || jobValue.repClass === "first_pull" || jobValue.repClass === "secondary_pull" ? 0 : 1;
  }

  function roundHalvesAwayFromZero(value) {
    return value < 0 ? -Math.floor(Math.abs(value) + 0.5) : Math.floor(value + 0.5);
  }

  function cycleRepOffset(periodization, cycleNumber, cycles) {
    if (cycles <= 1 || periodization === "static") return 0;
    if (periodization === "undulating") return cycleNumber % 2 === 1 ? 2 : -2;
    const linear = roundHalvesAwayFromZero(2 + (cycleNumber - 1) * (-4 / (cycles - 1)));
    return periodization === "reverse_linear" ? -linear : linear;
  }

  function buildSetPrescription(slot, request, cycleNumber, setIndex, catalog) {
    const exercise = slot._exercise;
    const isStrengthDose = request.goal === "strength" || (request.goal === "hybrid" && slot._repClass !== "assistance");
    const doseGoal = isStrengthDose ? "strength" : "hypertrophy";
    const jobValue = { repClass: slot._repClass };
    const range = stableRepRange(jobValue, doseGoal);
    const offset = cycleRepOffset(request.periodization, cycleNumber, request.cycles);
    let repMin = Math.max(3, Math.min(30, range[0] + offset));
    let repMax = Math.max(3, Math.min(30, range[1] + offset));
    if (repMin > repMax) [repMin, repMax] = [repMax, repMin];
    const setCount = slot._setCount;
    const extraFailureSet = slot._repClass === "assistance" ? 1 : 0;
    let rir = Math.max(0, setCount - (setIndex + 1) + finalRir(jobValue) - extraFailureSet);
    if (request.experience === "beginner") rir = Math.min(4, rir + 1);
    const isDeload = request.deloadCycles.includes(cycleNumber);
    if (isDeload) rir = Math.min(4, rir + 2);
    const actualSetCount = isDeload ? Math.ceil(setCount / 2) : setCount;
    if (setIndex >= actualSetCount) return null;
    const repsKey = slot._repsKey;
    const targets = repsKey ? { [repsKey]: { min: repMin, max: repMax } } : {};
    const status = repsKey ? "ready" : "manual";
    const id = `set-${stableId(request.seed || "", `${slot.id}|${cycleNumber}|${setIndex + 1}`)}`;
    return {
      id,
      cycleIndex: cycleNumber,
      setIndex: setIndex + 1,
      metricType: "source_metrics@1",
      targets,
      rir,
      restSeconds: slot.role.endsWith("Accessory") ? 90 : 120,
      status,
      provenance: {
        source: slot._sourceEvidence,
        policyVersion: GENERATOR_VERSION,
        periodization: request.periodization,
        deload: isDeload,
        approximation: request.experience === "beginner" || request.goal !== "hypertrophy" || slot._isEmphasisSlot,
      },
    };
  }

  function populatePrescriptions(slot, request, catalog) {
    slot.prescriptionsByCycle = [];
    for (let cycleNumber = 1; cycleNumber <= request.cycles; cycleNumber += 1) {
      const targetCount = request.deloadCycles.includes(cycleNumber) ? Math.ceil(slot._setCount / 2) : slot._setCount;
      const sets = [];
      for (let setIndex = 0; setIndex < targetCount; setIndex += 1) {
        sets.push(buildSetPrescription(slot, request, cycleNumber, setIndex, catalog));
      }
      slot.prescriptionsByCycle.push({ cycleIndex: cycleNumber, sets });
    }
  }

  function generateProgram(rawRequest, catalogSnapshot, seed) {
    if (!validCatalog(catalogSnapshot)) return failure([{ field: "catalog", code: "invalid_catalog", message: "A raw catalog snapshot is required." }]);
    const normalized = validateRequest(rawRequest, catalogSnapshot);
    if (!normalized.ok) return failure(normalized.issues);
    if (typeof seed !== "string" && typeof seed !== "number") {
      return failure([fieldIssue("seed", "invalid_seed", "Provide a stable string or numeric seed." )]);
    }
    const seedValue = String(seed);
    const request = { ...normalized.value, seed: seedValue };
    const jobs = prepareJobs(request, catalogSnapshot);
    const selected = selectAllJobs(jobs, request, catalogSnapshot, seedValue);
    if (!selected.ok) return failure(selected.conflicts);
    const { days, idForName } = rawDays(jobs, request, seedValue);
    const slotsByName = new Map();
    selected.assignments.forEach((assignment, index) => {
      const day = days.find((entry) => entry.id === idForName.get(assignment.job.day));
      if (!day) return;
      const slot = createInternalSlot(assignment, day, index + 1, request, seedValue, catalogSnapshot);
      day.slots.push(slot);
      if (!slotsByName.has(day.name)) slotsByName.set(day.name, []);
      slotsByName.get(day.name).push(slot);
    });
    const focus = applyEmphasis(request, days, jobs, catalogSnapshot, seedValue);
    if (focus.conflicts.length) return failure(focus.conflicts);
    const fit = fitProgramTime(days, request, jobs, catalogSnapshot);
    if (!fit.ok) return failure(fit.conflicts);
    for (const day of days) {
      day.slots = day.slots.filter((slot) => slot._setCount > 0);
      for (const slot of day.slots) populatePrescriptions(slot, request, catalogSnapshot);
      day.slots.forEach((slot, index) => {
        slot.order = index + 1;
        delete slot._dayId;
        delete slot._dayName;
        delete slot._dayGroup;
        delete slot._baseSetCount;
        delete slot._setCount;
        delete slot._bonusSets;
        delete slot._isEmphasisSlot;
        delete slot._order;
        delete slot._dayMovable;
        delete slot._repsKey;
        delete slot._lateralityId;
        delete slot._executionMode;
        delete slot._exercise;
        delete slot._repClass;
        delete slot._timeCeilingSeconds;
        delete slot._sourceEvidence;
      });
      delete day._group;
    }
    const output = {
      schemaVersion: PROGRAM_SCHEMA_VERSION,
      generatorVersion: GENERATOR_VERSION,
      seed: seedValue,
      request: clone(request),
      days,
      cycles: request.cycles,
      deloadCycles: [...request.deloadCycles],
      provenance: {
        source: "raw_catalog_and_reviewed_policy",
        policyVersion: GENERATOR_VERSION,
        goal: request.goal,
        split: request.split,
        selection: "role-tier_then_explicit-preference_then-seeded-canonical-id",
        approximations: unique([
          request.daysPerWeek !== 4 ? "redistributed-day-jobs" : null,
          request.experience === "beginner" ? "beginner-dose-adjustment" : null,
          request.goal !== "hypertrophy" ? "goal-specific-rep-ranges" : null,
          request.periodization !== "static" ? "cycle-rep-offsets" : null,
          request.deloadCycles.length ? "requested-deload-cycles" : null,
          request.emphasisMuscleIds.length || request.deprioritizedMuscleIds.length ? "focus-allocation" : null,
          fit.removedPurposes.length ? "time-fit-assistance-removal" : null,
        ].filter(Boolean)),
        estimatedSessionSeconds: fit.estimates,
        focusNotApplied: focus.notApplied,
      },
    };
    const checked = validateProgramDefinition(output, catalogSnapshot);
    if (!checked.ok) return failure([{ code: "generated_program_invalid", field: "program", issues: checked.issues }]);
    return { ok: true, value: output, conflicts: [], explanations: buildExplanations(output, fit, focus) };
  }

  function applyEmphasis(request, days, jobs, catalog, seed) {
    const conflicts = [];
    const notApplied = [];
    const featureMap = new Map();
    const candidates = finalizedJobs(false).filter((entry) => entry.repClass === "assistance");
    for (const entry of candidates) {
      const resolved = resolveJobPolicy(entry, catalog);
      if (resolved.issues.length) continue;
      for (const id of resolved.muscleIds) {
        if (!featureMap.has(id)) featureMap.set(id, entry);
      }
    }
    const findAccessory = (muscleId) => days.flatMap((day) => day.slots)
      .filter((slot) => slot.role.endsWith("Accessory") && slot.musclePurposeIds.includes(muscleId))
      .sort((a, b) => b._order - a._order)[0];
    const findDonor = (muscleIds) => {
      const requested = muscleIds;
      const all = days.flatMap((day) => day.slots).filter((slot) => slot.role.endsWith("Accessory") && slot._setCount > 1);
      const byPriority = all.sort((a, b) => {
        const deprioritizedA = a.musclePurposeIds.some((id) => requested.includes(id)) ? 0 : 1;
        const deprioritizedB = b.musclePurposeIds.some((id) => requested.includes(id)) ? 0 : 1;
        return deprioritizedA - deprioritizedB || b._order - a._order;
      });
      return byPriority[0] || null;
    };
    for (const muscleId of request.emphasisMuscleIds) {
      const existing = findAccessory(muscleId);
      const donor = findDonor(request.deprioritizedMuscleIds);
      if (existing) {
        if (existing._setCount < 3) {
          if (donor && donor !== existing) donor._setCount -= 1;
          existing._setCount += 1;
          existing._bonusSets += 1;
          existing._isEmphasisSlot = true;
        } else notApplied.push({ muscleId, reason: "assistance_set_cap" });
        continue;
      }
      const base = featureMap.get(muscleId);
      if (!base) { notApplied.push({ muscleId, reason: "no_reviewed_assistance_purpose" }); continue; }
      const original = STANDARD_JOBS.find((entry) => entry.purposeId === base.purposeId);
      const occurrence = days.flatMap((day) => day.slots).length + 1;
      const slotId = `slot-${stableId(seed, `emphasis|${muscleId}|${occurrence}`)}`;
      const role = request.goal === "strength" ? "strengthAccessory" : "hypertrophyAccessory";
      const jobForSlot = { ...original, purposeId: `emphasis_${muscleId}`, order: 100 + occurrence, sets: 1 };
      const pool = candidatesForJob(jobForSlot, role, request, catalog, {
        seed, usedIds: new Set(days.flatMap((day) => day.slots.map((slot) => slot.exerciseId))),
        usedGroups: new Set(days.flatMap((day) => day.slots.flatMap((slot) => slot._exercise.exclusionGroupings || []))),
      });
      if (!pool.candidates.length) { notApplied.push({ muscleId, reason: "no_eligible_exercise" }); continue; }
      const compatible = days.filter((day) => day.kind === "training" && compatibleDay(jobForSlot, { group: day._group }));
      const targetDay = (compatible.length ? compatible : days.filter((day) => day.kind === "training"))
        .sort((left, right) => estimateDaySeconds(left) - estimateDaySeconds(right) || left.order - right.order)[0];
      const slot = createInternalSlot({ job: jobForSlot, role, candidate: pool.candidates[0] }, targetDay, occurrence, request, seed, catalog);
      slot.id = slotId;
      slot._setCount = 1;
      slot._baseSetCount = 0;
      slot._bonusSets = 1;
      slot._isEmphasisSlot = true;
      targetDay.slots.push(slot);
    }
    return { conflicts, notApplied };
  }

  function fitProgramTime(days, request, jobs) {
    const ceiling = request.timeCeilingMinutes * 60;
    const removedPurposes = [];
    if (days.some((day) => day.kind === "training" && day.slots.some((slot) => slot._dayMovable))) {
      moveOptionalSlots(days, ceiling);
    }
    const over = () => days.filter((day) => day.kind === "training" && estimateDaySeconds(day) > ceiling);
    for (const day of over()) {
      for (const slot of day.slots) {
        if (slot._bonusSets > 0) {
          slot._setCount = Math.max(0, slot._setCount - slot._bonusSets);
          slot._bonusSets = 0;
        }
      }
    }
    for (const stage of [2, 1]) {
      for (const day of over()) {
        const accessories = [...day.slots].filter((slot) => slot.role.endsWith("Accessory") && slot._setCount > stage)
          .sort((left, right) => right._order - left._order);
        for (const slot of accessories) slot._setCount = stage;
      }
    }
    for (const day of over()) {
      const optional = [...day.slots].filter((slot) => slot.role.endsWith("Accessory"))
        .sort((left, right) => right._order - left._order);
      for (const slot of optional) {
        if (estimateDaySeconds(day) <= ceiling) break;
        slot._setCount = 0;
        removedPurposes.push(slot.purposeId);
      }
    }
    const conflicts = over().map((day) => ({
      code: "time_ceiling_exceeded",
      dayId: day.id,
      dayName: day.name,
      estimatedSeconds: estimateDaySeconds(day),
      ceilingSeconds: ceiling,
      protectedPurposeIds: day.slots.filter((slot) => slot._setCount > 0 && !slot.role.endsWith("Accessory")).map((slot) => slot.purposeId),
      message: `${day.name} still exceeds the selected time ceiling after optional assistance is moved or removed.`,
    }));
    return {
      ok: conflicts.length === 0,
      conflicts,
      removedPurposes,
      estimates: Object.fromEntries(days.filter((day) => day.kind === "training").map((day) => [day.name, estimateDaySeconds(day)])),
    };
  }

  function moveOptionalSlots(days, ceiling) {
    for (const day of [...days].filter((entry) => entry.kind === "training" && estimateDaySeconds(entry) > ceiling)) {
      const candidates = [...day.slots].filter((slot) => slot.role.endsWith("Accessory") && slot._dayMovable)
        .sort((left, right) => right._order - left._order);
      for (const slot of candidates) {
        const destinations = days.filter((entry) => entry !== day && entry.kind === "training"
          && compatibleDay({ region: slot._dayGroup === "lower" ? "lower" : "upper", patternKeys: [] }, { group: entry._group })
          && estimateDaySeconds(entry) + estimateSlotSeconds(slot) <= ceiling)
          .sort((left, right) => estimateDaySeconds(left) - estimateDaySeconds(right) || left.order - right.order);
        if (!destinations.length) continue;
        const target = destinations[0];
        day.slots = day.slots.filter((entry) => entry !== slot);
        slot._dayId = target.id;
        slot._dayName = target.name;
        target.slots.push(slot);
        if (estimateDaySeconds(day) <= ceiling) break;
      }
    }
  }

  function estimateSlotSeconds(slot, cycleIndex) {
    const cycle = cycleIndex === undefined ? slot.prescriptionsByCycle?.[0]
      : slot.prescriptionsByCycle?.find((cycle) => cycle.cycleIndex === cycleIndex);
    const sets = Number.isInteger(slot._setCount) ? slot._setCount : (Array.isArray(cycle?.sets) ? cycle.sets.length : 0);
    if (!sets) return 0;
    const repetitionMetric = slot.metricDefinitions?.find((entry) => entry.semantic === "reps" || entry.semantic === "repsPerSide");
    const target = cycle?.sets?.[0]?.targets?.[repetitionMetric?.semantic];
    const [fallbackMin, fallbackMax] = stableRepRange({
      repClass: slot._repClass || (slot.role?.endsWith("Accessory") ? "assistance" : "first_push_lower"),
    }, slot.role?.startsWith("strength") ? "strength" : "hypertrophy") || [8, 12];
    const repMin = finite(target?.min) ? target.min : fallbackMin;
    const repMax = finite(target?.max) ? target.max : fallbackMax;
    const reps = (repMin + repMax) / 2;
    const mode = slot._executionMode ?? slot.executionMode;
    const sides = repetitionMetric?.semantic === "repsPerSide" && mode === "unilateral" ? 2 : 1;
    const workSeconds = sets * reps * 4 * sides;
    const rest = cycle?.sets?.[0]?.restSeconds;
    const restSeconds = Math.max(0, sets - 1) * (finite(rest) ? rest : (slot.role?.endsWith("Accessory") ? 90 : 120));
    return 60 + workSeconds + restSeconds;
  }

  // Without a cycle the estimate is the first cycle's, which is what the
  // generator fits; a cycle index estimates that week's prescriptions.
  function estimateDaySeconds(day, cycleIndex) {
    if (day.kind !== "training") return 0;
    if (!day.slots.length) return 180;
    return 180 + day.slots.reduce((sum, slot) => sum + estimateSlotSeconds(slot, cycleIndex), 0);
  }

  function buildExplanations(program, fit, focus) {
    const explanations = [
      "Exercises were selected from the raw catalog by hard eligibility, then the lowest available role tier, explicit preference, and the supplied seed.",
      "Rep ranges and set counts follow the Plan 067 observed four-day anchors or documented approximation policy; no initial load is fabricated.",
    ];
    if (fit.removedPurposes.length) explanations.push(`Time fit removed optional assistance jobs: ${unique(fit.removedPurposes).join(", ")}.`);
    if (focus.notApplied.length) explanations.push(`${focus.notApplied.length} emphasis request(s) could not be applied under the reviewed assistance policies.`);
    return explanations;
  }

  function failure(conflicts) { return { ok: false, value: null, conflicts, explanations: [] }; }

  function findSubstitutions(program, slotId, context, catalog) {
    if (!validCatalog(catalog) || !isPlainObject(program) || !Array.isArray(program.days)) return [];
    let selectedSlot = null;
    for (const day of program.days) {
      if (!Array.isArray(day.slots)) continue;
      selectedSlot = day.slots.find((slot) => slot.id === slotId) || selectedSlot;
    }
    if (!selectedSlot || !selectedSlot.purposeId || selectedSlot.role === "manual") return [];
    const normalizedContext = { ...(isPlainObject(program.request) ? program.request : {}), ...(isPlainObject(context) ? context : {}) };
    const excludedIds = new Set();
    const usedIds = new Set();
    const usedGroups = new Set();
    for (const day of program.days) for (const slot of day.slots || []) {
      if (slot.id === slotId) continue;
      usedIds.add(slot.exerciseId);
      const exercise = catalog.exercises.find((entry) => entry.id === slot.exerciseId);
      for (const id of exercise?.exclusionGroupings || []) usedGroups.add(id);
    }
    excludedIds.add(selectedSlot.exerciseId);
    if (!Array.isArray(selectedSlot.movementPatternIds) || !Array.isArray(selectedSlot.musclePurposeIds)
      || typeof selectedSlot.exerciseTypeId !== "string") return [];
    const selectedExercise = catalog.exercises.find((entry) => entry.id === selectedSlot.exerciseId);
    const executionContexts = normalizedContext.executionContexts || {};
    const pool = candidatesForJob({
      purposeId: selectedSlot.purposeId,
      patternIds: selectedSlot.movementPatternIds,
      muscleIds: selectedSlot.musclePurposeIds,
      exerciseTypeId: selectedSlot.exerciseTypeId,
      repClass: selectedSlot.role.endsWith("Accessory") ? "assistance" : selectedSlot.role.startsWith("strength") ? "first_push_lower" : "first_push_lower",
    }, selectedSlot.role, normalizedContext, catalog, { excludedIds, usedIds, usedGroups, seed: program.seed || "" });
    return pool.candidates.map((candidate) => ({
      exerciseId: candidate.exerciseId,
      roleTier: candidate.roleTier,
      eligibleEquipmentContexts: candidate.eligibleEquipmentContexts,
      metricIds: [...candidate._exercise.exerciseMetrics],
      metricDefinitions: metricDefinitionsFor(candidate._exercise, catalog),
      bodyweightCoefficient: finite(candidate._exercise.bodyweight) ? candidate._exercise.bodyweight : null,
      executionMode: executionMode(candidate._exercise, normalizedContext, catalog),
      reasons: candidate.reasons,
    }));
  }

  function prescriptionsForCycle(program, cycleNumber) {
    if (!isPlainObject(program) || !Array.isArray(program.days) || !Number.isInteger(cycleNumber)) return [];
    const results = [];
    for (const day of program.days) {
      if (day.kind !== "training") continue;
      for (const slot of day.slots || []) {
        const cycle = (slot.prescriptionsByCycle || []).find((entry) => entry.cycleIndex === cycleNumber);
        if (!cycle) continue;
        for (const set of cycle.sets || []) results.push({
          ...clone(set), metricIds: [...slot.metricIds], metricDefinitions: slot.metricDefinitions.map((entry) => ({ ...entry })),
          slotId: slot.id, purposeId: slot.purposeId, exerciseId: slot.exerciseId,
          role: slot.role, loadingModel: clone(slot.loadingModel), dayId: day.id, dayName: day.name,
        });
      }
    }
    return results;
  }

  const PROGRAM_KEYS = new Set(["schemaVersion", "generatorVersion", "seed", "request", "days", "cycles", "deloadCycles", "provenance"]);
  const DAY_KEYS = new Set(["id", "name", "kind", "order", "slots"]);
  const SLOT_KEYS = new Set(["id", "purposeId", "exerciseId", "sourceExerciseIds", "role", "musclePurposeIds", "movementPatternIds",
    "exerciseTypeId", "metricIds", "metricDefinitions", "metricOrigin", "loadingModel", "prescriptionsByCycle", "order",
    "displayName", "setupNotes", "manualAttribution", "lateralityIds", "executionMode", "alternates"]);
  // A slot's alternates are the movements the lifter has chosen to swap to,
  // offered first by the mid-workout swap picker, in their authored order.
  // The field is additive: a definition without it is unchanged, so it does
  // not bump PROGRAM_SCHEMA_VERSION (see docs/adr/0019-slot-alternates.md).
  const MAX_SLOT_ALTERNATES = 5;
  const CYCLE_KEYS = new Set(["cycleIndex", "sets"]);
  const SET_KEYS = new Set(["id", "cycleIndex", "setIndex", "metricType", "metricIds", "metricDefinitions", "targets", "rir", "restSeconds", "status", "provenance"]);
  const REQUEST_KEYS = new Set(["goal", "experience", "daysPerWeek", "timeCeilingMinutes", "gymProfile", "competencyAnswers",
    "movementConfirmations", "emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds",
    "preferredExerciseIds", "split", "periodization", "cycles", "deloadCycles", "seed", "executionContexts"]);
  const ROOT_PROVENANCE_KEYS = new Set(["source", "policyVersion", "goal", "split", "selection", "approximations", "estimatedSessionSeconds", "focusNotApplied"]);
  const SET_PROVENANCE_KEYS = new Set(["source", "policyVersion", "periodization", "deload", "approximation"]);
  const CUSTOM_EXERCISE_KEYS = new Set([
    "id", "name", "namePt", "equipment", "primary", "secondary", "notes", "metricIds", "metricDefinitions",
  ]);
  const FORBIDDEN_PERFORMED_KEYS = new Set(["actual", "actuals", "performed", "performedAt", "performedValues", "metricValues", "completed", "completedAt"]);
  const LEGACY_MUSCLE_TOKENS = new Set(["Chest", "Lats", "Mid/upper back", "Traps", "Neck", "Front delts", "Side delts", "Rear delts", "Serratus",
    "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Adductors", "Abductors", "Calves", "Tibs", "Hip flexors",
    "Spinal erectors", "Abs", "Obliques"]);

  function checkKeys(value, allowed, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}: expected an object`); return false; }
    for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`${path}.${key}: unsupported field`);
    return true;
  }

  function inspectCustomExerciseDefinitions(definitions, catalog) {
    const issues = [];
    const byId = new Map();
    if (!Array.isArray(definitions)) return { ok: false, issues: ["customExerciseDefinitions: expected an array"], byId };
    definitions.forEach((custom, index) => {
      const path = `customExerciseDefinitions[${index}]`;
      if (!checkKeys(custom, CUSTOM_EXERCISE_KEYS, path, issues)) return;
      if (typeof custom.id !== "string" || !custom.id.startsWith("custom:")
        || custom.id.length <= "custom:".length || custom.id.length > 128) {
        issues.push(`${path}.id: invalid custom identity`);
      } else {
        if (byId.has(custom.id) || (catalog && catalogObject(catalog, custom.id))) issues.push(`${path}.id: repeated or shadows catalog ID`);
        byId.set(custom.id, custom);
      }
      if (typeof custom.name !== "string" || !custom.name.trim() || custom.name.length > 200) issues.push(`${path}.name: expected a bounded name`);
      if (owns(custom, "namePt") && (typeof custom.namePt !== "string" || !custom.namePt.trim() || custom.namePt.length > 200)) {
        issues.push(`${path}.namePt: invalid Portuguese name`);
      }
      if (owns(custom, "equipment") && (!Array.isArray(custom.equipment) || custom.equipment.length > 64
        || custom.equipment.some((value) => typeof value !== "string" || !value.trim() || value.length > 100))) {
        issues.push(`${path}.equipment: invalid equipment tags`);
      }
      for (const field of ["primary", "secondary"]) if (owns(custom, field)) {
        const value = custom[field];
        if (typeof value !== "string" || value.length > 500 || (value.trim() !== ""
          && value.split(",").some((token) => !LEGACY_MUSCLE_TOKENS.has(token.trim())))) {
          issues.push(`${path}.${field}: invalid muscle attribution`);
        }
      }
      if (owns(custom, "notes") && (typeof custom.notes !== "string" || custom.notes.length > 2000)) {
        issues.push(`${path}.notes: invalid setup notes`);
      }
      if (!Array.isArray(custom.metricIds) || !Array.isArray(custom.metricDefinitions)) {
        issues.push(`${path}.metricIds and metricDefinitions: required ordered arrays`);
      } else {
        const metrics = METRIC_DOMAIN.validateDefinitions(custom.metricIds, custom.metricDefinitions, { allowEmpty: true });
        if (!metrics.ok) issues.push(...metrics.issues.map((issue) => `${path}.${issue}`));
      }
      rejectPerformedFields(custom, path, issues);
    });
    return { ok: issues.length === 0, issues, byId };
  }

  function validateCustomExerciseDefinitions(definitions, catalogSnapshot) {
    const catalog = validCatalog(catalogSnapshot) ? catalogSnapshot : null;
    const checked = inspectCustomExerciseDefinitions(definitions, catalog);
    return { ok: checked.ok, issues: checked.issues };
  }

  function rejectPerformedFields(value, path, issues, seen = new Set()) {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_PERFORMED_KEYS.has(key)) issues.push(`${path}.${key}: performed values do not belong in a program definition`);
      rejectPerformedFields(child, `${path}.${key}`, issues, seen);
    }
  }

  function validateRequestSnapshot(request, catalog, issues) {
    if (!checkKeys(request, REQUEST_KEYS, "program.request", issues)) return;
    if (request.goal !== undefined && !GOALS.includes(request.goal)) issues.push("program.request.goal: unsupported");
    if (request.experience !== undefined && !EXPERIENCES.includes(request.experience)) issues.push("program.request.experience: unsupported");
    if (request.daysPerWeek !== undefined && (!Number.isInteger(request.daysPerWeek) || request.daysPerWeek < 2 || request.daysPerWeek > 6)) issues.push("program.request.daysPerWeek: unsupported");
    if (request.timeCeilingMinutes !== undefined && !TIME_CEILINGS.includes(request.timeCeilingMinutes)) issues.push("program.request.timeCeilingMinutes: unsupported");
    if (request.split !== undefined && request.split !== "auto" && !owns(SPLITS, request.split)) issues.push("program.request.split: unsupported");
    if (request.periodization !== undefined && !PERIODIZATIONS.includes(request.periodization)) issues.push("program.request.periodization: unsupported");
    if (request.cycles !== undefined && (!Number.isInteger(request.cycles) || request.cycles < 1 || request.cycles > 12)) issues.push("program.request.cycles: unsupported");
    if (request.seed !== undefined && typeof request.seed !== "string") issues.push("program.request.seed: expected a string");
    if (request.gymProfile !== undefined && checkKeys(request.gymProfile, new Set(["equipmentIds", "equipmentLoadsKg"]), "program.request.gymProfile", issues)) {
      if (!Array.isArray(request.gymProfile.equipmentIds)
        || request.gymProfile.equipmentIds.some((id) => typeof id !== "string" || (catalog && catalogObject(catalog, id)?.type !== "equipment"))) {
        issues.push("program.request.gymProfile.equipmentIds: invalid catalog IDs");
      }
      if (request.gymProfile.equipmentLoadsKg !== undefined) {
        if (!isPlainObject(request.gymProfile.equipmentLoadsKg)) issues.push("program.request.gymProfile.equipmentLoadsKg: expected a record");
        else for (const [id, loads] of Object.entries(request.gymProfile.equipmentLoadsKg)) {
          if ((catalog && catalogObject(catalog, id)?.type !== "equipment") || !Array.isArray(loads)
            || loads.some((load) => !finite(load) || load < 0)) issues.push(`program.request.gymProfile.equipmentLoadsKg.${id}: invalid load grid`);
        }
      }
    }
    for (const field of ["emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds", "preferredExerciseIds"]) {
      if (request[field] === undefined) continue;
      const expected = field.includes("Muscle") ? "featureMuscleGroup" : "exercise";
      if (!Array.isArray(request[field]) || request[field].some((id) => typeof id !== "string"
        || (catalog && catalogObject(catalog, id)?.type !== expected))) issues.push(`program.request.${field}: invalid catalog IDs`);
    }
    if (request.competencyAnswers !== undefined) {
      if (checkKeys(request.competencyAnswers, new Set(COMPETENCY_KEYS), "program.request.competencyAnswers", issues)) {
        for (const [key, answer] of Object.entries(request.competencyAnswers)) if (![true, false, null].includes(answer)) issues.push(`program.request.competencyAnswers.${key}: invalid answer`);
      }
    }
    if (request.movementConfirmations !== undefined) {
      if (!isPlainObject(request.movementConfirmations)) issues.push("program.request.movementConfirmations: expected a record");
      else for (const [exerciseId, ids] of Object.entries(request.movementConfirmations)) {
        if ((catalog && catalogObject(catalog, exerciseId)?.type !== "exercise") || !Array.isArray(ids)
          || ids.some((id) => catalog && catalogObject(catalog, id)?.type !== "preconditions")) issues.push(`program.request.movementConfirmations.${exerciseId}: invalid prerequisite IDs`);
      }
    }
    if (request.executionContexts !== undefined) {
      if (!isPlainObject(request.executionContexts)) issues.push("program.request.executionContexts: expected a record");
      else for (const [id, mode] of Object.entries(request.executionContexts)) {
        if (!catalog || catalogObject(catalog, id)?.type !== "exercise" || !["bilateral", "unilateral"].includes(mode)) issues.push(`program.request.executionContexts.${id}: invalid execution mode`);
      }
    }
    if (request.deloadCycles !== undefined && (!Array.isArray(request.deloadCycles)
      || request.deloadCycles.some((cycle) => !Number.isInteger(cycle) || cycle < 1 || cycle > (request.cycles || 12)))) issues.push("program.request.deloadCycles: invalid cycles");
  }

  function validateProgramDefinition(program, catalogSnapshot, customExerciseDefinitions = []) {
    const issues = [];
    if (!checkKeys(program, PROGRAM_KEYS, "program", issues)) return { ok: false, issues };
    if (!SUPPORTED_PROGRAM_SCHEMA_VERSIONS.includes(program.schemaVersion)) issues.push("program.schemaVersion: unsupported");
    if (typeof program.generatorVersion !== "string" || !program.generatorVersion) issues.push("program.generatorVersion: expected a version");
    if (typeof program.seed !== "string") issues.push("program.seed: expected a string");
    validateRequestSnapshot(program.request, validCatalog(catalogSnapshot) ? catalogSnapshot : null, issues);
    if (!Number.isInteger(program.cycles) || program.cycles < 1 || program.cycles > 12) issues.push("program.cycles: unsupported");
    if (!Array.isArray(program.deloadCycles) || program.deloadCycles.some((value) => !Number.isInteger(value) || value < 1 || value > program.cycles)
      || new Set(Array.isArray(program.deloadCycles) ? program.deloadCycles : []).size !== (Array.isArray(program.deloadCycles) ? program.deloadCycles.length : 0)) issues.push("program.deloadCycles: invalid cycles");
    if (!Array.isArray(program.days) || program.days.length !== 7) issues.push("program.days: expected an ordered seven-day week");
    if (!checkKeys(program.provenance, ROOT_PROVENANCE_KEYS, "program.provenance", issues)) return { ok: false, issues };
    for (const key of ["source", "policyVersion"]) if (typeof program.provenance[key] !== "string" || !program.provenance[key]) issues.push(`program.provenance.${key}: required`);
    if (program.provenance.goal !== undefined && !GOALS.includes(program.provenance.goal)) issues.push("program.provenance.goal: unsupported");
    if (program.provenance.split !== undefined && program.provenance.split !== "auto" && !owns(SPLITS, program.provenance.split)) issues.push("program.provenance.split: unsupported");
    if (program.provenance.selection !== undefined && typeof program.provenance.selection !== "string") issues.push("program.provenance.selection: expected a string");
    if (program.provenance.approximations !== undefined && (!Array.isArray(program.provenance.approximations) || program.provenance.approximations.some((entry) => typeof entry !== "string"))) issues.push("program.provenance.approximations: invalid list");
    if (program.provenance.estimatedSessionSeconds !== undefined && (!isPlainObject(program.provenance.estimatedSessionSeconds)
      || Object.values(program.provenance.estimatedSessionSeconds).some((seconds) => !finite(seconds) || seconds < 0))) issues.push("program.provenance.estimatedSessionSeconds: invalid estimates");
    if (program.provenance.focusNotApplied !== undefined && (!Array.isArray(program.provenance.focusNotApplied)
      || program.provenance.focusNotApplied.some((entry) => !isPlainObject(entry) || typeof entry.muscleId !== "string" || typeof entry.reason !== "string"))) issues.push("program.provenance.focusNotApplied: invalid entries");
    if (catalogSnapshot && !validCatalog(catalogSnapshot)) issues.push("catalog: invalid raw snapshot");
    const catalog = validCatalog(catalogSnapshot) ? catalogSnapshot : null;
    const checkedCustomDefinitions = inspectCustomExerciseDefinitions(customExerciseDefinitions, catalog);
    issues.push(...checkedCustomDefinitions.issues);
    const customById = checkedCustomDefinitions.byId;
    const dayIds = new Set();
    const slotIds = new Set();
    const prescriptionIds = new Set();
    const generatedExerciseIds = new Set();
    if (Array.isArray(program.days)) program.days.forEach((day, dayIndex) => {
      const dayPath = `program.days[${dayIndex}]`;
      if (!checkKeys(day, DAY_KEYS, dayPath, issues)) return;
      if (typeof day.id !== "string" || !day.id || dayIds.has(day.id)) issues.push(`${dayPath}.id: missing or repeated`);
      dayIds.add(day.id);
      if (typeof day.name !== "string" || !day.name) issues.push(`${dayPath}.name: expected a name`);
      if (!["training", "rest"].includes(day.kind)) issues.push(`${dayPath}.kind: expected training or rest`);
      if (day.order !== dayIndex + 1) issues.push(`${dayPath}.order: must follow week order`);
      if (!Array.isArray(day.slots)) { issues.push(`${dayPath}.slots: expected an array`); return; }
      if (day.kind === "rest" && day.slots.length) issues.push(`${dayPath}.slots: rest days cannot contain slots`);
      day.slots.forEach((slot, slotIndex) => {
        const slotPath = `${dayPath}.slots[${slotIndex}]`;
        if (!checkKeys(slot, SLOT_KEYS, slotPath, issues)) return;
        if (typeof slot.id !== "string" || !slot.id || slotIds.has(slot.id)) issues.push(`${slotPath}.id: missing or repeated`);
        slotIds.add(slot.id);
        if (slot.order !== slotIndex + 1) issues.push(`${slotPath}.order: must follow day slot order`);
        if (typeof slot.purposeId !== "string" || !slot.purposeId) issues.push(`${slotPath}.purposeId: required`);
        if (typeof slot.exerciseId !== "string" || !slot.exerciseId) issues.push(`${slotPath}.exerciseId: required`);
        else if (slot.role !== "manual") {
          if (generatedExerciseIds.has(slot.exerciseId)) issues.push(`${slotPath}.exerciseId: generated exercise repeated`);
          generatedExerciseIds.add(slot.exerciseId);
        }
        if (!ROLES.includes(slot.role)) issues.push(`${slotPath}.role: unsupported`);
        if (!Array.isArray(slot.sourceExerciseIds) || !slot.sourceExerciseIds.includes(slot.exerciseId)
          || slot.sourceExerciseIds.some((id) => typeof id !== "string")) issues.push(`${slotPath}.sourceExerciseIds: must include selected exercise`);
        for (const field of ["musclePurposeIds", "movementPatternIds", "metricIds", "metricDefinitions"]) if (!Array.isArray(slot[field])) issues.push(`${slotPath}.${field}: expected an array`);
        if (catalog && Array.isArray(slot.musclePurposeIds) && slot.musclePurposeIds.some((id) => catalogObject(catalog, id)?.type !== "featureMuscleGroup")) issues.push(`${slotPath}.musclePurposeIds: invalid feature muscle IDs`);
        if (catalog && Array.isArray(slot.movementPatternIds) && slot.movementPatternIds.some((id) => catalogObject(catalog, id)?.type !== "movementPattern")) issues.push(`${slotPath}.movementPatternIds: invalid movement pattern IDs`);
        if (catalog && slot.exerciseTypeId !== undefined && catalogObject(catalog, slot.exerciseTypeId)?.type !== "exerciseType") issues.push(`${slotPath}.exerciseTypeId: invalid exercise type ID`);
        if (slot.displayName !== undefined && (typeof slot.displayName !== "string" || slot.displayName.length > 200)) issues.push(`${slotPath}.displayName: invalid text`);
        if (slot.setupNotes !== undefined && (typeof slot.setupNotes !== "string" || slot.setupNotes.length > 2000)) issues.push(`${slotPath}.setupNotes: invalid text`);
        if (slot.manualAttribution !== undefined) {
          if (slot.role !== "manual" || !checkKeys(slot.manualAttribution, new Set(["primary", "secondary"]), `${slotPath}.manualAttribution`, issues)) issues.push(`${slotPath}.manualAttribution: manual slots only`);
          else for (const [field, text] of Object.entries(slot.manualAttribution)) {
            if (typeof text !== "string" || text.length > 500 || text.split(",").some((token) => !LEGACY_MUSCLE_TOKENS.has(token.trim()))) issues.push(`${slotPath}.manualAttribution.${field}: invalid muscle label`);
          }
        }
        if (slot.lateralityIds !== undefined && (!Array.isArray(slot.lateralityIds) || slot.lateralityIds.some((id) => catalog && catalogObject(catalog, id)?.type !== "laterality"))) issues.push(`${slotPath}.lateralityIds: invalid`);
        if (slot.executionMode !== undefined && slot.executionMode !== null && !["bilateral", "unilateral"].includes(slot.executionMode)) issues.push(`${slotPath}.executionMode: invalid`);
        if (!["source_catalog", "user_defined"].includes(slot.metricOrigin)) issues.push(`${slotPath}.metricOrigin: unsupported`);
        if (Array.isArray(slot.metricIds) && Array.isArray(slot.metricDefinitions)) {
          const checked = METRIC_DOMAIN.validateDefinitions(slot.metricIds, slot.metricDefinitions, { allowEmpty: true });
          if (!checked.ok) issues.push(...checked.issues.map((issue) => `${slotPath}.${issue}`));
        }
        if (!checkKeys(slot.loadingModel, new Set(["bodyweightCoefficient", "assistanceDirection"]), `${slotPath}.loadingModel`, issues)) {
          // Keep collecting the independent cycle errors.
        } else {
          if (slot.loadingModel.bodyweightCoefficient !== null &&
              (!finite(slot.loadingModel.bodyweightCoefficient) || slot.loadingModel.bodyweightCoefficient < 0 ||
                slot.loadingModel.bodyweightCoefficient > 1)) {
            issues.push(`${slotPath}.loadingModel.bodyweightCoefficient: invalid`);
          }
          if (slot.loadingModel.assistanceDirection !== undefined && !["subtract", null].includes(slot.loadingModel.assistanceDirection)) issues.push(`${slotPath}.loadingModel.assistanceDirection: unsupported`);
        }
        if (slot.alternates !== undefined) {
          if (!Array.isArray(slot.alternates)) issues.push(`${slotPath}.alternates: expected an array`);
          else {
            if (slot.alternates.length > MAX_SLOT_ALTERNATES) issues.push(`${slotPath}.alternates: at most ${MAX_SLOT_ALTERNATES} alternates`);
            const seenAlternates = new Set();
            slot.alternates.forEach((id, alternateIndex) => {
              const alternatePath = `${slotPath}.alternates[${alternateIndex}]`;
              if (typeof id !== "string" || !id) { issues.push(`${alternatePath}: expected an exercise ID`); return; }
              if (seenAlternates.has(id)) issues.push(`${alternatePath}: repeated alternate`);
              seenAlternates.add(id);
              if (id === slot.exerciseId) issues.push(`${alternatePath}: the slot's own exercise is not an alternate`);
              if (catalog && !customById.has(id) && !catalog.exercises.some((entry) => entry.id === id)) issues.push(`${alternatePath}: unknown catalog or custom exercise`);
            });
          }
        }
        let exercise = null;
        const custom = customById.get(slot.exerciseId);
        if (custom) {
          if (slot.metricOrigin !== "user_defined") issues.push(`${slotPath}.metricOrigin: custom exercises require user-defined metrics`);
          if (JSON.stringify(slot.metricIds) !== JSON.stringify(custom.metricIds)) issues.push(`${slotPath}.metricIds: differs from custom definition`);
          if (JSON.stringify(slot.metricDefinitions) !== JSON.stringify(custom.metricDefinitions)) issues.push(`${slotPath}.metricDefinitions: differs from custom definition`);
        }
        if (catalog) {
          exercise = catalog.exercises.find((entry) => entry.id === slot.exerciseId) || null;
          if (!exercise && !custom) issues.push(`${slotPath}.exerciseId: unknown catalog or custom exercise`);
          if (exercise) {
            const sourceMetrics = Array.isArray(exercise.exerciseMetrics) ? exercise.exerciseMetrics : [];
            if (sourceMetrics.length > 0) {
              if (slot.metricOrigin !== "source_catalog" || JSON.stringify(slot.metricIds) !== JSON.stringify(sourceMetrics)) issues.push(`${slotPath}.metricIds: must match source catalog composition`);
              const rawMetrics = METRIC_DOMAIN.validateRawIds(slot.metricIds, catalog.uuidIndex);
              if (!rawMetrics.ok) issues.push(...rawMetrics.issues.map((issue) => `${slotPath}.${issue}`));
            } else if (slot.metricOrigin === "user_defined") {
              if (slot.role !== "manual") issues.push(`${slotPath}.metricOrigin: manual role required for metricless source selection`);
            } else if (slot.metricIds?.length) issues.push(`${slotPath}.metricIds: metricless source must be configured explicitly`);
            const sourceCoefficient = finite(exercise.bodyweight) ? exercise.bodyweight : null;
            if (slot.loadingModel?.bodyweightCoefficient !== sourceCoefficient) issues.push(`${slotPath}.loadingModel.bodyweightCoefficient: differs from source catalog`);
          }
        }
        if (slot.metricOrigin === "user_defined" && slot.role !== "manual") issues.push(`${slotPath}.metricOrigin: manual role required`);
        if (!Array.isArray(slot.prescriptionsByCycle) || slot.prescriptionsByCycle.length !== program.cycles) {
          issues.push(`${slotPath}.prescriptionsByCycle: expected one list per cycle`);
          return;
        }
        for (const [cycleIndex, cycle] of slot.prescriptionsByCycle.entries()) {
          const cyclePath = `${slotPath}.prescriptionsByCycle[${cycleIndex}]`;
          if (!checkKeys(cycle, CYCLE_KEYS, cyclePath, issues)) continue;
          if (cycle.cycleIndex !== cycleIndex + 1 || !Array.isArray(cycle.sets)) issues.push(`${cyclePath}: malformed or unordered cycle`);
          if (!Array.isArray(cycle.sets)) continue;
          for (const [setIndex, set] of cycle.sets.entries()) {
            const setPath = `${cyclePath}.sets[${setIndex}]`;
            if (!checkKeys(set, SET_KEYS, setPath, issues)) continue;
            if (typeof set.id !== "string" || !set.id || prescriptionIds.has(set.id)) issues.push(`${setPath}.id: missing or repeated`);
            prescriptionIds.add(set.id);
            if (set.cycleIndex !== cycle.cycleIndex || set.setIndex !== setIndex + 1) issues.push(`${setPath}: cycle/set order mismatch`);
            if (set.metricType !== "source_metrics@1") issues.push(`${setPath}.metricType: unsupported`);
            // Schema v2 (PROGRAM_SCHEMA_VERSION) derives a set's metric composition from
            // its slot and stores neither field. Schema v1 carried both, always identical
            // to the slot's; accept that shape too but reject anything that differs.
            if (set.metricIds !== undefined || set.metricDefinitions !== undefined) {
              if (!Array.isArray(set.metricIds) || JSON.stringify(set.metricIds) !== JSON.stringify(slot.metricIds)) issues.push(`${setPath}.metricIds: differs from slot composition`);
              if (!Array.isArray(set.metricDefinitions) || JSON.stringify(set.metricDefinitions) !== JSON.stringify(slot.metricDefinitions)) issues.push(`${setPath}.metricDefinitions: differs from slot definitions`);
            }
            const targets = METRIC_DOMAIN.validateTargets(slot.metricIds || [], set.targets);
            if (!targets.ok) issues.push(...targets.issues.map((issue) => `${setPath}.${issue}`));
            if (set.rir !== null && (!finite(set.rir) || set.rir < 0 || set.rir > 4)) issues.push(`${setPath}.rir: outside 0–4`);
            if (set.restSeconds !== null && (!Number.isSafeInteger(set.restSeconds) || set.restSeconds < 0 || set.restSeconds > 86400)) issues.push(`${setPath}.restSeconds: invalid`);
            if (!["ready", "manual", "configuration_required"].includes(set.status)) issues.push(`${setPath}.status: unsupported`);
            if (!slot.metricIds?.length && set.status !== "configuration_required") issues.push(`${setPath}.status: explicit metric configuration required`);
            if (slot.metricOrigin === "user_defined" && slot.metricIds?.length && set.status !== "manual") issues.push(`${setPath}.status: user-defined metrics require a manual prescription`);
            if (!checkKeys(set.provenance, SET_PROVENANCE_KEYS, `${setPath}.provenance`, issues)) continue;
            if (typeof set.provenance.source !== "string" || !set.provenance.source || typeof set.provenance.policyVersion !== "string" || !set.provenance.policyVersion) issues.push(`${setPath}.provenance: source and policyVersion required`);
            if (set.provenance.periodization !== undefined && !PERIODIZATIONS.includes(set.provenance.periodization)) issues.push(`${setPath}.provenance.periodization: unsupported`);
            if (set.provenance.deload !== undefined && typeof set.provenance.deload !== "boolean") issues.push(`${setPath}.provenance.deload: expected boolean`);
            if (set.provenance.approximation !== undefined && typeof set.provenance.approximation !== "boolean") issues.push(`${setPath}.provenance.approximation: expected boolean`);
          }
        }
      });
    });
    rejectPerformedFields(program, "program", issues);
    return { ok: issues.length === 0, issues };
  }

  // The single normalizer for a ProgramDefinition already proven valid (schema
  // v1 or v2) by validateProgramDefinition: always returns the deduped v2 shape,
  // dropping a set's metricIds/metricDefinitions (schema v1 carried them,
  // identical to the slot's; validation already refused a set that disagreed).
  // Callers that need the current schema from any accepted input call this
  // after a successful validateProgramDefinition rather than re-deriving it.
  function canonicalizeProgramDefinition(program) {
    const next = clone(program);
    next.schemaVersion = PROGRAM_SCHEMA_VERSION;
    for (const day of next.days || []) {
      for (const slot of day.slots || []) {
        if (Array.isArray(slot.alternates) && !slot.alternates.length) delete slot.alternates;
        for (const cycle of slot.prescriptionsByCycle || []) {
          for (const set of cycle.sets || []) {
            delete set.metricIds;
            delete set.metricDefinitions;
          }
        }
      }
    }
    return next;
  }

  function validTarget(target) {
    if (finite(target)) return target >= 0;
    if (!isPlainObject(target) || !finite(target.min) || !finite(target.max)) return false;
    return target.min >= 0 && target.max >= target.min;
  }

  function purposePolicyForMuscle(muscleId, catalog) {
    for (const jobValue of STANDARD_JOBS.filter((entry) => entry.repClass === "assistance")) {
      const resolved = resolveJobPolicy(jobValue, catalog);
      if (!resolved.issues.length && resolved.muscleIds.includes(muscleId)) return resolved;
    }
    return null;
  }

  function apiMetricDefinition(name) {
    const entry = METRIC_SEMANTICS[name];
    return entry ? { semantic: entry.semantic, unit: entry.unit } : null;
  }

  const api = Object.freeze({
    GENERATOR_VERSION,
    PROGRAM_SCHEMA_VERSION,
    MAX_SLOT_ALTERNATES,
    ROLES,
    SPLITS,
    GOALS,
    EXPERIENCES,
    TIME_CEILINGS,
    PERIODIZATIONS,
    METRIC_SEMANTICS,
    METRIC_SOURCE_IDS,
    generateProgram,
    generatedDayNameKey,
    findSubstitutions,
    validateProgramDefinition,
    canonicalizeProgramDefinition,
    validateCustomExerciseDefinitions,
    prescriptionsForCycle,
    estimateDaySeconds,
    metricDefinitionForName: apiMetricDefinition,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeProgramCompiler = api;
})(typeof window !== "undefined" ? window : globalThis);
