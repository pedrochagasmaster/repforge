/** @typedef {import("./compiler-contracts.js").MetricDefinition} MetricDefinition */
/** @typedef {import("./compiler-contracts.js").SourceExercise} SourceExercise */
/** @typedef {import("./compiler-contracts.js").SourceCatalog} SourceCatalog */
/** @typedef {import("./compiler-contracts.js").CanonicalRequest} CanonicalRequest */
/** @typedef {import("./compiler-contracts.js").SelectionContext} SelectionContext */
/** @typedef {import("./compiler-contracts.js").Job} Job */
/** @typedef {import("./compiler-contracts.js").EquipmentGroup} EquipmentGroup */
/** @typedef {import("./compiler-contracts.js").EquipmentContext} EquipmentContext */
/** @typedef {import("./compiler-contracts.js").RankedIdentity} RankedIdentity */
/** @typedef {import("./compiler-contracts.js").JobCandidate} JobCandidate */
/** @typedef {import("./compiler-contracts.js").JobPool} JobPool */
/** @typedef {import("./compiler-contracts.js").CandidateOptions} CandidateOptions */
/** @typedef {import("./compiler-contracts.js").RepRange} RepRange */
/** @typedef {import("./compiler-contracts.js").ProgramSet} ProgramSet */
/** @typedef {import("./compiler-contracts.js").ProgramSlot} ProgramSlot */
/** @typedef {import("./compiler-contracts.js").ProgramDay} ProgramDay */
/** @typedef {import("./compiler-contracts.js").ProgramDefinition} ProgramDefinition */
/** @typedef {import("./compiler-contracts.js").Conflict} Conflict */
/** @typedef {import("./compiler-contracts.js").FieldIssue} FieldIssue */
/** @typedef {import("./compiler-contracts.js").RequestResult} RequestResult */
/** @typedef {import("./compiler-contracts.js").GenerationDiagnostics} GenerationDiagnostics */
/** @typedef {import("./compiler-contracts.js").GenerationOptions} GenerationOptions */
/** @typedef {import("./compiler-contracts.js").GenerationNamespace} GenerationNamespace */
/** @typedef {import("./compiler-contracts.js").GenerationResult} GenerationResult */
/** @typedef {import("./policy-contracts.js").EnginePolicy} EnginePolicy */
/** @typedef {import("./layout-contracts.js").LayoutTemplate} LayoutTemplate */
import { createEnginePolicy } from "./policy.js";
import PureIdentity from "../../identity.js";
import CANDIDATES from "./candidates.js";
import LAYOUT from "./layout.js";
import METRIC_DOMAIN from "../../metrics.js";

const GENERATOR_VERSION = "073.4";
const PROGRAM_SCHEMA_VERSION = 2;
const SUPPORTED_PROGRAM_SCHEMA_VERSIONS = Object.freeze([1, 2]);
const ROLES = Object.freeze([
  "hypertrophyPrimaryCompound", "hypertrophySecondaryCompound", "hypertrophyAccessory",
  "strengthPrimaryCompound", "strengthSecondaryCompound", "strengthAccessory", "manual",
]);
const SPLITS = Object.freeze(Object.fromEntries(LAYOUT.SPLITS.map((split) => [split.id, Object.freeze({
  compatibleDays: Object.freeze([...split.daysPerWeek]),
  variants: split.variants,
})])));
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
/** @type {Readonly<Record<string,string>>} */
const PRECONDITION_COMPETENCIES = Object.freeze({
  "Barbell bench press preconditions": "benchPress10",
  "Barbell overhead press preconditions": "overheadPress10",
  "45° incline barbell press preconditions": "inclineBarbell10",
  "Bodyweight dip preconditions": "bodyweightDips10",
  "Bodyweight vertical pulls preconditions": "pullups5",
  // #340 (Plan 072 OD-11): "10 strict pull-ups" answers the weighted variants.
  "Weighted vertical pulls preconditions": "pullups10",
  "Intermediate push-up preconditions": "pushups15",
});
const MAX_SLOT_ALTERNATES = 5;

export function createCompiler(IDENTITY=PureIdentity, POLICY=createEnginePolicy()) {
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
/** @param {unknown} value @returns {value is number} */
const finite = (value) => typeof value === "number" && Number.isFinite(value);
/** @template T @param {T[]} values @returns {T[]} */
const unique = (values) => [...new Set(values)];
/** @template T @param {T} value @returns {T} */
const clone = (value) => JSON.parse(JSON.stringify(value));
/** @param {unknown} object @param {string} key */
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
/** @template T @param {T[]} values @returns {T[]} */
const sorted = (values) => [...values].sort();

/** @param {unknown} catalog @returns {catalog is SourceCatalog} */
function validCatalog(catalog) {
  return isPlainObject(catalog) && Array.isArray(catalog.exercises) && isPlainObject(catalog.uuidIndex);
}

/** @param {SourceCatalog} catalog @param {unknown} id */
function catalogObject(catalog, id) {
  return typeof id === "string" && owns(catalog.uuidIndex, id) ? catalog.uuidIndex[id] : null;
}

/** @param {Job} jobValue @param {SourceCatalog} catalog */
function resolveJobPolicy(jobValue, catalog) {
  if (Array.isArray(jobValue.patternIds) && Array.isArray(jobValue.muscleIds)
    && typeof jobValue.exerciseTypeId === "string") {
    /** @type {string[]} */
  const issues = [];
    jobValue.patternIds.forEach((id) => { if (catalogObject(catalog, id)?.type !== "movementPattern") issues.push(`movementPattern ${id} is absent or invalid`); });
    jobValue.muscleIds.forEach((id) => { if (catalogObject(catalog, id)?.type !== "featureMuscleGroup") issues.push(`featureMuscleGroup ${id} is absent or invalid`); });
    if (catalogObject(catalog, jobValue.exerciseTypeId)?.type !== "exerciseType") issues.push(`exerciseType ${jobValue.exerciseTypeId} is absent or invalid`);
    return { ...jobValue, patternIds: [...jobValue.patternIds], muscleIds: [...jobValue.muscleIds], issues };
  }
  return { ...jobValue, issues: ["The slot does not carry current catalog identities."] };
}

/** @param {unknown} rawRequest @param {SourceCatalog} catalog @returns {RequestResult} */
function validateRequest(rawRequest, catalog) {
  /** @type {FieldIssue[]} */
  const issues = [];
  if (!isPlainObject(rawRequest)) return { ok: false, issues: [{ field: "request", code: "invalid_request", message: "Expected a request object." }] };
  for (const key of Object.keys(rawRequest)) {
    if (!REQUEST_KEYS.has(key) || key === "seed") issues.push(fieldIssue(key, "unknown_request_field", "This generation input is not supported."));
  }
  /** @type {Record<string,unknown>} */
  let request;
  try { request = JSON.parse(IDENTITY.canonicalJSON(rawRequest)); }
  catch { return { ok: false, issues: [fieldIssue("request", "invalid_request", "Expected plain JSON generation inputs.")] }; }
  if (!(/** @type {readonly unknown[]} */(GOALS)).includes(request.goal)) issues.push(fieldIssue("goal", "unsupported_goal", "Choose hypertrophy, strength, or hybrid."));
  if (!(/** @type {readonly unknown[]} */(EXPERIENCES)).includes(request.experience)) issues.push(fieldIssue("experience", "unsupported_experience", "Choose beginner, intermediate, or advanced."));
  if (typeof request.daysPerWeek!=="number"||!Number.isInteger(request.daysPerWeek) || request.daysPerWeek < 2 || request.daysPerWeek > 6) {
    issues.push(fieldIssue("daysPerWeek", "unsupported_frequency", "Training frequency must be between two and six days."));
  }
  if (!(/** @type {readonly unknown[]} */(TIME_CEILINGS)).includes(request.timeCeilingMinutes)) {
    issues.push(fieldIssue("timeCeilingMinutes", "unsupported_time_ceiling", "Choose 20, 40, 60, 90, 120, or 150 minutes."));
  }
  if (!isPlainObject(request.gymProfile) || !Array.isArray(request.gymProfile.equipmentIds)) {
    issues.push(fieldIssue("gymProfile.equipmentIds", "equipment_required", "Choose the equipment available in this gym."));
  }
  if (isPlainObject(request.gymProfile) && Array.isArray(request.gymProfile.equipmentIds)) {
    for (const key of Object.keys(request.gymProfile)) {
      if (!["equipmentIds", "equipmentLoadsKg"].includes(key)) issues.push(fieldIssue(`gymProfile.${key}`, "unknown_request_field", "This gym input is not supported."));
    }
    const unknown = request.gymProfile.equipmentIds.filter((id) => catalogObject(catalog, id)?.type !== "equipment");
    if (unknown.length) issues.push(fieldIssue("gymProfile.equipmentIds", "unknown_equipment", "The equipment profile contains an unknown equipment ID."));
    request.gymProfile.equipmentIds = sorted(unique(request.gymProfile.equipmentIds));
    const loads = request.gymProfile.equipmentLoadsKg;
    if (loads !== undefined) {
      if (!isPlainObject(loads) || Object.entries(loads).some(([id, grid]) => catalogObject(catalog, id)?.type !== "equipment"
        || !Array.isArray(grid) || grid.some((load) => !finite(load) || load < 0))) {
        issues.push(fieldIssue("gymProfile.equipmentLoadsKg", "invalid_request", "Expected catalog equipment IDs and nonnegative load grids."));
      } else if (!Object.keys(loads).length) delete request.gymProfile.equipmentLoadsKg;
    }
  }
  request.split = request.split ?? "auto";
  if (request.split !== "auto" && !owns(SPLITS, String(request.split))) issues.push(fieldIssue("split", "unsupported_split", "Choose an authored split."));
  if (typeof request.daysPerWeek==="number"&&Number.isInteger(request.daysPerWeek) && owns(SPLITS, String(request.split))
    && !SPLITS[String(request.split)].compatibleDays.includes(request.daysPerWeek)) {
    issues.push(fieldIssue("split", "split_frequency_mismatch", "This split is only available at its authored training frequency."));
  }
  request.periodization = request.periodization ?? "static";
  if (!(/** @type {readonly unknown[]} */(PERIODIZATIONS)).includes(request.periodization)) issues.push(fieldIssue("periodization", "unsupported_periodization", "Choose static, linear, reverse linear, or undulating."));
  request.cycles = request.cycles === undefined ? 7 : request.cycles;
  if (typeof request.cycles!=="number"||!Number.isInteger(request.cycles) || request.cycles < 1 || request.cycles > 12) {
    issues.push(fieldIssue("cycles", "unsupported_cycle_count", "Cycle count must be between one and twelve."));
  }
  request.deloadCycles = request.deloadCycles === undefined ? [] : request.deloadCycles;
  if (!Array.isArray(request.deloadCycles) || request.deloadCycles.some((cycle) =>
    !Number.isInteger(cycle) || cycle < 1 || cycle > Number(request.cycles)) || new Set(request.deloadCycles).size !== request.deloadCycles.length) {
    issues.push(fieldIssue("deloadCycles", "invalid_deload_cycles", "Deload cycles must be unique cycle numbers inside this program."));
  }
  for (const field of ["emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds", "preferredExerciseIds"]) {
    if (request[field] === undefined) request[field] = [];
    if (!Array.isArray(request[field]) || request[field].some((id) => typeof id !== "string" || !id)) {
      issues.push(fieldIssue(field, "invalid_id_list", "Expected a list of catalog IDs."));
      continue;
    }
    request[field] = sorted(unique(request[field]));
    const expected = field.includes("Muscle") ? "featureMuscleGroup" : "exercise";
    const ids=request[field];
    if (Array.isArray(ids)&&ids.some((id) => catalogObject(catalog, id)?.type !== expected)) {
      issues.push(fieldIssue(field, "unknown_catalog_id", `Each ID must name a ${expected} record.`));
    }
  }
  if (request.competencyAnswers !== undefined && !isPlainObject(request.competencyAnswers)) issues.push(fieldIssue("competencyAnswers", "invalid_competency_answers", "Expected explicit movement ability answers."));
  request.competencyAnswers = isPlainObject(request.competencyAnswers) ? request.competencyAnswers : {};
  const competencyAnswers=/** @type {Record<string,unknown>} */(request.competencyAnswers);
  for (const key of Object.keys(competencyAnswers)) {
    if (!COMPETENCY_KEYS.includes(key)) issues.push(fieldIssue(`competencyAnswers.${key}`, "unknown_request_field", "This movement ability is not supported."));
  }
  for (const key of COMPETENCY_KEYS) {
    if (competencyAnswers[key] === undefined) competencyAnswers[key] = null;
    if (!(competencyAnswers[key]===true||competencyAnswers[key]===false||competencyAnswers[key]===null)) {
      issues.push(fieldIssue(`competencyAnswers.${key}`, "invalid_competency_answer", "Answer yes, no, or leave this movement ability unconfirmed."));
    }
  }
  if (request.movementConfirmations !== undefined && !isPlainObject(request.movementConfirmations)) issues.push(fieldIssue("movementConfirmations", "invalid_movement_confirmations", "Expected movement confirmations."));
  request.movementConfirmations = isPlainObject(request.movementConfirmations) ? request.movementConfirmations : {};
  const movementConfirmations=/** @type {Record<string,unknown>} */(request.movementConfirmations);
  for (const [exerciseId, ids] of Object.entries(movementConfirmations)) {
    if (catalogObject(catalog, exerciseId)?.type !== "exercise" || !Array.isArray(ids)
      || ids.some((id) => catalogObject(catalog, id)?.type !== "preconditions")) {
      issues.push(fieldIssue(`movementConfirmations.${exerciseId}`, "invalid_movement_confirmation", "Confirmations must name prerequisites for a current catalog exercise."));
    } else movementConfirmations[exerciseId] = sorted(unique(ids));
  }
  if (request.executionContexts !== undefined && !isPlainObject(request.executionContexts)) issues.push(fieldIssue("executionContexts", "invalid_execution_context", "Expected execution contexts."));
  request.executionContexts = isPlainObject(request.executionContexts) ? request.executionContexts : {};
  for (const [exerciseId, mode] of Object.entries(/** @type {Record<string,unknown>} */(request.executionContexts))) {
    const exercise = catalog.exercises.find((entry) => entry.id === exerciseId);
    if (catalogObject(catalog, exerciseId)?.type !== "exercise" || !(mode==="bilateral"||mode==="unilateral")) {
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
  if (Array.isArray(request.emphasisMuscleIds) && Array.isArray(request.deprioritizedMuscleIds) && request.emphasisMuscleIds.some((id) => (/** @type {unknown[]} */(request.deprioritizedMuscleIds)).includes(id))) issues.push(fieldIssue("emphasisMuscleIds", "contradictory_muscle_priorities", "A muscle cannot be both prioritized and deprioritized."));
  if (Array.isArray(request.deloadCycles)) request.deloadCycles.sort((a, b) => a - b);
  if (request.split === "auto" && typeof request.daysPerWeek==="number"&&Number.isInteger(request.daysPerWeek)) request.split = automaticSplit(request.daysPerWeek);
  return issues.length ? { ok: false, issues } : { ok: true, value: /** @type {CanonicalRequest} */(JSON.parse(IDENTITY.canonicalJSON(request))) };
}

/** @param {CanonicalRequest} request */
function recoveredGenerationDomain(request) {
  return LAYOUT.supportsRequest(request);
}

/** @param {Partial<CanonicalRequest>} request */
function availableSplits(request) {
  return Object.keys(SPLITS).filter((id) => LAYOUT.supportsRequest(/** @type {import("./layout-contracts.js").LayoutRequest} */({ ...request, split: id,
    periodization: request.periodization ?? "static", cycles: request.cycles ?? 7, deloadCycles: request.deloadCycles || [] })));
}

/** @param {unknown} request @param {unknown} catalog @returns {RequestResult} */
function canonicalizeRequest(request, catalog) {
  if (!validCatalog(catalog)) return { ok: false, issues: [fieldIssue("catalog", "invalid_catalog", "A raw catalog snapshot is required.")] };
  return validateRequest(request, catalog);
}

/** @param {unknown} request @param {SourceCatalog} catalog */
function generationIdentity(request, catalog) {
  const normalized = canonicalizeRequest(request, catalog);
  if (!normalized.ok) throw new TypeError("Cannot identify invalid generation inputs");
  return IDENTITY.generationIdentity(normalized.value, catalog, GENERATOR_VERSION);
}

/** @param {number} days */
function automaticSplit(days) {
  return /** @type {Record<number,string>} */({ 2: "full_body", 3: "upper_lower_full", 4: "upper_lower_upper_lower",
    5: "push_pull_legs_upper_lower", 6: "push_pull_legs_push_pull_legs" })[days];
}

/** @param {string} field @param {string} code @param {string} message @returns {FieldIssue} */
function fieldIssue(field, code, message) { return { field, code, message }; }

/** @param {string[]} ids @param {SourceCatalog} catalog */
function equipmentClosure(ids, catalog) {
  const closed = new Set();
  for (const id of ids) {
    /** @type {string|undefined} */
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

/** @param {SourceExercise} exercise @param {SelectionContext} context @param {SourceCatalog} catalog @returns {EquipmentContext[]} */
function equipmentContexts(exercise, context, catalog) {
  const profile = context.gymProfile || context;
  const availableIds = Array.isArray(profile.equipmentIds) ? profile.equipmentIds : [];
  const available = equipmentClosure(availableIds, catalog);
  /** @param {string[]|undefined} ids @param {string} expectedType @returns {EquipmentGroup[]} */
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

/** @param {SourceExercise} exercise @param {SelectionContext} context @param {SourceCatalog} catalog */
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

/** @param {SourceExercise} exercise @param {SourceCatalog} catalog */
function metricDefinitionsFor(exercise, catalog) {
  const ids = Array.isArray(exercise.exerciseMetrics) ? exercise.exerciseMetrics : [];
  const canonical = METRIC_DOMAIN.definitionsForIds(ids);
  const raw = METRIC_DOMAIN.validateRawIds(ids, catalog.uuidIndex, { allowEmpty: true });
  return canonical.ok && raw.ok ? canonical.value : ids.map(() => null);
}

/** @param {(MetricDefinition|null)[]} definitions */
function repsSemantic(definitions) {
  if (definitions.some((entry) => entry?.semantic === "reps")) return "reps";
  if (definitions.some((entry) => entry?.semantic === "repsPerSide")) return "repsPerSide";
  return null;
}

/** @param {SourceExercise} exercise @param {SelectionContext} context @param {SourceCatalog} catalog */
function executionMode(exercise, context, catalog) {
  const explicit = context.executionContexts?.[exercise.id];
  const names = unique((Array.isArray(exercise.laterality) ? exercise.laterality : [])
    .map((id) => catalogObject(catalog, id)?.name).filter((name) => typeof name === "string"));
  const unilateral = names.includes("Unilateral");
  const bilateral = names.includes("Bilateral");
  if (unilateral && bilateral) return ["bilateral", "unilateral"].includes(explicit||"") ? explicit : null;
  if (unilateral) return "unilateral";
  if (bilateral) return "bilateral";
  return ["bilateral", "unilateral"].includes(explicit||"") ? explicit : null;
}

/** @param {SourceExercise} exercise @param {string} role */
function roleTier(exercise, role) {
  /** @type {Record<string,import("./candidate-contracts.js").TierField>} */
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

/** @param {SourceExercise} exercise @param {Job} resolvedJob */
function matchesPurpose(exercise, resolvedJob) {
  if (!Array.isArray(exercise.movementPattern) || !exercise.movementPattern.some((id) => resolvedJob.patternIds.includes(id))) return false;
  if (!Array.isArray(exercise.primaryFeatureMuscle)
    || !exercise.primaryFeatureMuscle.some((id) => resolvedJob.muscleIds.includes(id))) return false;
  if (exercise.exerciseType !== resolvedJob.exerciseTypeId) return false;
  return true;
}

/** @param {SourceExercise} exercise @param {string[]} excludedMuscleIds */
function excludedByMuscle(exercise, excludedMuscleIds) {
  const trained = unique([
    ...(Array.isArray(exercise.primaryFeatureMuscle) ? exercise.primaryFeatureMuscle : []),
    ...(Array.isArray(exercise.secondaryFeatureMuscle) ? exercise.secondaryFeatureMuscle : []),
  ]);
  return trained.some((id) => excludedMuscleIds.includes(id));
}

/** @param {SourceExercise} exercise @param {Job} resolvedJob @param {string} role @param {SelectionContext} context @param {SourceCatalog} catalog @param {Set<string>} excludedIds @param {Set<string>} usedIds @param {Set<string>} usedGroups */
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

// A job's pool before the search: every exercise's state-independent
// verdict in catalog order, and the eligible candidates in selection order.
// Only the repeat and exclusion-group checks depend on what the search has
// already chosen, and they run last, so filtering this pool by the search
// state gives the same candidates, order and rejection counts as a fresh scan.
/** @param {Job} jobValue @param {string} role @param {SelectionContext} context @param {SourceCatalog} catalog @param {CandidateOptions} [options] @returns {JobPool} */
function jobCandidatePool(jobValue, role, context, catalog, options = {}) {
  const resolvedJob = resolveJobPolicy(jobValue, catalog);
  if (resolvedJob.issues.length) return { verdicts: [], candidates: [], policyIssues: resolvedJob.issues };
  const excludedIds = options.excludedIds || new Set();
  const nothingUsed = new Set();
  const verdicts = [];
  const candidates = [];
  for (const exercise of catalog.exercises) {
    const failure = candidateFailure(exercise, resolvedJob, role, context, catalog, excludedIds, nothingUsed, nothingUsed);
    verdicts.push({ exercise, failure });
    if (failure) continue;
    candidates.push({
      exerciseId: exercise.id,
      roleTier: roleTier(exercise, role),
      eligibleEquipmentContexts: equipmentContexts(exercise, context, catalog),
      reasons: ["purpose_match", "required_role_tier", "hard_constraints_passed"],
      _preferred: (context.preferredExerciseIds || []).includes(exercise.id),
      _exercise: exercise,
      _job: resolvedJob,
    });
  }
  candidates.sort(compareCandidates);
  return { verdicts, candidates, policyIssues: [] };
}

/** @param {RankedIdentity} left @param {RankedIdentity} right */
function compareCandidates(left, right) {
  return Number(left.roleTier) - Number(right.roleTier)
    || Number(right._preferred) - Number(left._preferred)
    || (left.exerciseId < right.exerciseId ? -1 : left.exerciseId > right.exerciseId ? 1 : 0);
}

/** @param {SourceExercise} exercise @param {Set<string>} usedIds @param {Set<string>} usedGroups */
function usedFailure(exercise, usedIds, usedGroups) {
  if (usedIds.has(exercise.id)) return "exercise_repeated";
  const groupings = Array.isArray(exercise.exclusionGroupings) ? exercise.exclusionGroupings : [];
  return groupings.some((id) => usedGroups.has(id)) ? "exclusion_group_collision" : null;
}

/** @param {JobPool} pool @param {Set<string>} usedIds @param {Set<string>} usedGroups */
function availableCandidates(pool, usedIds, usedGroups) {
  if (pool.policyIssues.length) return { candidates: [], policyIssues: pool.policyIssues };
  const candidates = pool.candidates.filter((candidate) => !usedFailure(candidate._exercise, usedIds, usedGroups));
  /** @type {Record<string,number>} */
  const rejected = {};
  if (!candidates.length) {
    for (const { exercise, failure } of pool.verdicts) {
      const reason = failure || usedFailure(exercise, usedIds, usedGroups);
      if (reason) rejected[reason] = (rejected[reason] || 0) + 1;
    }
  }
  return { candidates, rejected, policyIssues: [] };
}

/** @param {Job} jobValue @param {string} role @param {SelectionContext} context @param {SourceCatalog} catalog @param {CandidateOptions} [options] */
function candidatesForJob(jobValue, role, context, catalog, options = {}) {
  const pool = jobCandidatePool(jobValue, role, context, catalog, options);
  return availableCandidates(pool, options.usedIds || new Set(), options.usedGroups || new Set());
}

/** @param {number} frequency */
function scheduledTrainingIndexes(frequency) {
  /** @type {Record<number,number[]>} */
  const maps = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 2, 4, 6],
    5: [0, 1, 2, 4, 6],
    6: [0, 1, 2, 4, 5, 6],
  };
  return maps[frequency];
}

// Generated day names stay English in the definition, so fingerprints,
// setup-link recipes and backups do not change with the app language. The
// display layer asks for a translation key, which exists only while the day
// still carries the exact name the generator gave that week position; a
// renamed, swapped or added day is the lifter's own text.
/** @param {ProgramDefinition|null|undefined} definition @param {string} dayId */
function generatedDayNameKey(definition, dayId) {
  const request = definition?.request;
  if (!definition||!isPlainObject(request) || typeof request.split!=="string"||typeof request.daysPerWeek!=="number"||!owns(SPLITS, request.split) || !Array.isArray(definition.days)) return null;
  const trainingIndexes = scheduledTrainingIndexes(request.daysPerWeek);
  if (!trainingIndexes || !SPLITS[String(request.split)].compatibleDays.includes(request.daysPerWeek)) return null;
  const position = definition.days.findIndex((day) => day?.id === dayId);
  const authoredIndex = trainingIndexes.indexOf(position);
  if (authoredIndex < 0 || definition.days[position].kind !== "training") return null;
  const authored = SPLITS[String(request.split)].variants[request.daysPerWeek]?.days[authoredIndex];
  const name = authored?.name === "Full" ? "Full Body" : authored?.name;
  if (!name || definition.days[position].name !== name) return null;
  return `program.split_day.${name.toLowerCase().replace(/\s+/g, "_")}`;
}

/** @param {GenerationNamespace|string} seed @param {string} value */
function stableId(seed, value) {
  return typeof seed!=="string"&&typeof seed.allocate === "function" ? seed.allocate(value) : IDENTITY.digestCanonical([String(seed), value]);
}

/** @param {unknown} rawRequest @param {unknown} catalogSnapshot @param {GenerationOptions} [options] */
function generateProgram(rawRequest, catalogSnapshot, options = {}) {
  const diagnosticVersion = options?.diagnostics;
  /** @type {GenerationDiagnostics|null} */
  const diagnostics = diagnosticVersion === "allocation-lineage@1" ? {
    kind: "taurifer-generation-diagnostics", schemaVersion: 1, version: diagnosticVersion,
    terminalStage: "validation", slots: [],
  } : null;
  /** @template T @param {T} result */
  const finish = result => diagnostics ? { ...result, diagnostics } : result;
  if (diagnosticVersion !== undefined && !diagnostics) return failure([fieldIssue("diagnostics", "invalid_diagnostics", "Choose allocation-lineage@1 or omit diagnostics.")]);
  const policy = POLICY.normalizeEnginePolicy(options?.enginePolicy);
  if (!policy.ok) return finish(failure([{ field: "enginePolicy", code: "invalid_engine_policy", issues: policy.issues }]));
  if (!validCatalog(catalogSnapshot)) return finish(failure([{ field: "catalog", code: "invalid_catalog", message: "A raw catalog snapshot is required." }]));
  const normalized = validateRequest(rawRequest, catalogSnapshot);
  if (!normalized.ok) return finish(failure(normalized.issues));
  const namespace = generationIdentity(normalized.value, catalogSnapshot);
  const seedValue = { namespace, allocate: IDENTITY.createIdAllocator(namespace) };
  return finish(generateRecovered(normalized.value, catalogSnapshot, seedValue, policy, diagnostics));
}

/** @param {LayoutTemplate} template */
function recoveredRepClass(template) {
  if (template.type === "accessory") return "assistance";
  const isPull = template.exercise.patterns.some(pattern => ["horizontalPull", "verticalPull"].includes(pattern));
  return template.type === "primary" ? (isPull ? "first_pull" : "first_push_lower")
    : isPull ? "secondary_pull" : "secondary_push_lower";
}

/** @param {CanonicalRequest} request @param {string} repClass @param {EnginePolicy} policy @returns {number[]} */
function recoveredDoseCenters(request, repClass, policy) {
  const centers = policy.prescription.periodizedRepCenters[request.goal][repClass];
  const indices = policy.periodization.indices[request.periodization];
  return indices ? indices.map(index => centers[index])
    : Array(7).fill(policy.prescription.staticRepCenters[request.goal][repClass]);
}

/** @param {number} count @param {EnginePolicy} policy */
function retainedDeloadSetCount(count, policy) {
  return Math.max(1, Math.floor(policy.deload.setRetention * count));
}

/** @param {CanonicalRequest} request @param {LayoutTemplate} template @param {string|null} repsKey @param {GenerationNamespace} namespace @param {string} path @param {EnginePolicy} policy @param {boolean} isDefault */
function recoveredPrescriptions(request, template, repsKey, namespace, path, policy, isDefault) {
  const repClass = recoveredRepClass(template);
  const centers = recoveredDoseCenters(request, repClass, policy);
  const adjustments = policy.prescription.rirAdjustmentsBySetCount;
  const baseRir = policy.prescription.baseRirByClass[repClass];
  const normal = centers.map((center) => Array.from({ length: template.numSets }, (_, index) => ({
    targets: repsKey ? { [repsKey]: { min: center - 1, max: center + 1 } } : {},
    rir: repsKey ? Math.max(0, baseRir + adjustments[template.numSets][index]) + (request.experience === "beginner" ? policy.prescription.beginnerRirBonus : 0) : null,
    restSeconds: policy.prescription.restSeconds[template.type === "accessory" ? "accessory" : "compound"], status: repsKey ? "ready" : "manual",
  })));
  let normalIndex = 0;
  return Array.from({ length: request.cycles }, (_, index) => {
    const cycleIndex = index + 1;
    const deload = request.deloadCycles.includes(cycleIndex);
    const endpoint = cycleIndex === 1 ? normal[0] : normal[normal.length - 1];
    const source = deload ? endpoint.slice(0, retainedDeloadSetCount(endpoint.length, policy)) : normal[normalIndex++];
    return { cycleIndex, sets: source.map((set, setIndex) => ({
      ...set,
      id: `set-${stableId(namespace, `${path}/cycle/${cycleIndex}/set/${setIndex + 1}`)}`,
      cycleIndex, setIndex: setIndex + 1, metricType: "source_metrics@1",
      targets: deload && repsKey ? { [repsKey]: /** @type {RepRange} */(Object.fromEntries(Object.entries(set.targets[repsKey]).map(([bound, value]) => [bound, value === null ? null : Math.round(policy.deload.repRetention * value)]))) } : clone(set.targets),
      rir: deload && repsKey ? (set.rir ?? 0) + policy.deload.rirBonus : set.rir,
      provenance: { source: isDefault ? (request.periodization === "static" ? "recovered_static_rules" : "recovered_periodized_rules") : "experimental_policy", policyVersion: isDefault ? GENERATOR_VERSION : "engine-policy@1", periodization: request.periodization, deload, approximation: false },
    })) };
  });
}

/** @param {CanonicalRequest} request @param {SourceCatalog} catalog @param {GenerationNamespace} namespace @param {{ok:true,value:EnginePolicy,isDefault:boolean}} policyResult @param {GenerationDiagnostics|null} diagnostics @returns {GenerationResult} */
function generateRecovered(request, catalog, namespace, policyResult, diagnostics) {
  const policy = policyResult.value;
  if (diagnostics) diagnostics.terminalStage = "selection";
  if (!recoveredGenerationDomain(request)) return failure([fieldIssue("split", "unsupported_generation_domain", "Choose a supported split, seven normal cycles, and at most one first or last deload.")]);
  /** @param {SourceExercise} exercise */
  const hardAllowed = (exercise) => {
    if (request.excludedExerciseIds.includes(exercise.id) || excludedByMuscle(exercise, request.excludedMuscleIds)) return false;
    if (!prerequisitesSatisfied(exercise, request, catalog).ok) return false;
    const metrics = metricDefinitionsFor(exercise, catalog);
    if (!metrics.length || metrics.some((metric) => !metric)) return false;
    return repsSemantic(metrics) !== "repsPerSide" || executionMode(exercise, request, catalog) !== null;
  };
  let selector;
  try { selector = CANDIDATES.create(catalog, request, hardAllowed); }
  catch (error) {
    if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
    return failure([fieldIssue("request", "unsupported_generation_domain", error.message)]);
  }
  const layout = LAYOUT.generate(request, selector, { enginePolicy: policy, diagnostics: !!diagnostics });
  if (diagnostics) diagnostics.allocation = {
    requestedMinutes: request.timeCeilingMinutes, budgetMinutes: "budgetMinutes" in layout?layout.budgetMinutes:null,
    selected: "allocations" in layout ? clone(layout.allocations) : null, estimatedSecondsByDay: {},
  };
  if(layout.status==="unsupported")return failure([fieldIssue("request",layout.code,"The selected equipment and movement confirmations cannot fill this program.")]);
  if (layout.status !== "ok" || layout.days.some((day) => !day.templates.length)) {
    return failure(layout.issues || [fieldIssue("request", layout.code || "insufficient_candidates", "The selected equipment and movement confirmations cannot fill this program.")]);
  }
  /** @type {Record<string,number>} */
  const estimatedSessionSeconds = {};
  const days = layout.weeklySlots.map((trainingIndex, weekIndex) => {
    const dayId = `day-${stableId(namespace, `week/${weekIndex}`)}`;
    if (trainingIndex === null) return { id: dayId, name: "Rest", kind: "rest", order: weekIndex + 1, slots: [] };
    const source = layout.days[trainingIndex];
    const name = source.name === "Full" ? "Full Body" : source.name;
    estimatedSessionSeconds[dayId] = layout.estimatedSessionSeconds[trainingIndex];
    const slots = source.templates.map((template, slotIndex) => {
      const exercise = /** @type {SourceExercise} */(template.exercise.raw);
      const metrics = /** @type {MetricDefinition[]} */(metricDefinitionsFor(exercise, catalog));
      const repsKey = repsSemantic(metrics);
      const accessory = template.type === "accessory";
      const primary = template.type === "primary";
      const strength = request.goal === "strength";
      const role = primary ? (request.goal === "hypertrophy" ? "hypertrophyPrimaryCompound" : "strengthPrimaryCompound")
        : accessory ? (strength ? "strengthAccessory" : "hypertrophyAccessory")
        : strength ? "strengthSecondaryCompound" : "hypertrophySecondaryCompound";
      const path = `day/${trainingIndex}/slot/${slotIndex}`;
      const muscleId = accessory ? selector.muscleId(template.accessoryMuscle||"") : null;
      const slot = {
        id: `slot-${stableId(namespace, `${path}/exercise/${exercise.id}`)}`,
        purposeId: `generated_${template.type}_${accessory ? template.accessoryMuscle : trainingIndex}_${slotIndex}`,
        exerciseId: exercise.id, sourceExerciseIds: [exercise.id], role,
        musclePurposeIds: muscleId ? [muscleId] : [...(exercise.primaryFeatureMuscle || [])],
        movementPatternIds: [...(exercise.movementPattern || [])],
        exerciseTypeId: exercise.exerciseType,
        metricIds: [...(exercise.exerciseMetrics||[])], metricDefinitions: metrics.map((metric) => ({ ...metric })),
        metricOrigin: "source_catalog", lateralityIds: [...(exercise.laterality || [])],
        executionMode: executionMode(exercise, request, catalog),
        loadingModel: { bodyweightCoefficient: finite(exercise.bodyweight) ? exercise.bodyweight : null, assistanceDirection: "subtract" },
        order: slotIndex + 1,
        prescriptionsByCycle: recoveredPrescriptions(request, template, repsKey, namespace, path, policy, policyResult.isDefault),
      };
      if (diagnostics) {
        const record = layout.diagnosticRecords?.find(record => record.template === template);
        if(!record)throw new TypeError("Missing allocation diagnostic record");
        const initialWeekIndex = layout.weeklySlots.indexOf(record.initialDayIndex??-1);
        diagnostics.slots.push({ lineage: record.lineage, origin: "recovered_template",
          purposeId: slot.purposeId, slotId: slot.id, exerciseId: slot.exerciseId, repClass: recoveredRepClass(template),
          initialWeekIndex,
          finalDayId: dayId, baseSetCount: record.baseSetCount,
          afterExperienceSetCount: template.numSets, finalSetCount: template.numSets, retained: true });
      }
      return slot;
    });
    return { id: dayId, name, kind: "training", order: weekIndex + 1, slots };
  });
  /** @type {ProgramDefinition} */
  const output = {
    schemaVersion: PROGRAM_SCHEMA_VERSION, generatorVersion: GENERATOR_VERSION, request: clone(request), days,
    cycles: request.cycles, deloadCycles: [...request.deloadCycles],
    provenance: {
      source: policyResult.isDefault ? "recovered_generation_rules" : "experimental_policy", policyVersion: policyResult.isDefault ? GENERATOR_VERSION : "engine-policy@1", goal: request.goal, split: request.split,
      selection: "recovered-pool_then-explicit-preference_then-ascii-id", approximations: policyResult.isDefault ? [] : ["experimental-engine-policy"],
      generationBudgetMinutes: layout.budgetMinutes, estimatedSessionSeconds, focusNotApplied: [],
    },
  };
  if (diagnostics) diagnostics.slots = diagnostics.slots.map(({ initialWeekIndex, ...record }) => ({
    ...record, initialDayId: initialWeekIndex===undefined||initialWeekIndex < 0 ? null : days[initialWeekIndex].id,
  }));
  if (diagnostics) { diagnostics.terminalStage = "definition_validation"; if(diagnostics.allocation)diagnostics.allocation.estimatedSecondsByDay = clone(estimatedSessionSeconds); }
  const checked = validateProgramDefinition(output, catalog);
  if (!checked.ok) return failure([{ code: "generated_program_invalid", field: "program", issues: checked.issues }]);
  if (diagnostics) diagnostics.terminalStage = "complete";
  return { ok: true, value: output, conflicts: [], explanations: [{ code: policyResult.isDefault ? "recovered_initial_rules" : "experimental_engine_policy", generationBudgetMinutes: layout.budgetMinutes }], confirmationOffers: confirmationOffers(output, request, catalog) };
}

/** @param {ProgramSlot} slot @param {number|undefined} cycleIndex */
function estimateSlotSeconds(slot, cycleIndex) {
  const cycle = cycleIndex === undefined ? slot.prescriptionsByCycle?.[0]
    : slot.prescriptionsByCycle?.find((cycle) => cycle.cycleIndex === cycleIndex);
  const sets = Number.isInteger(slot._setCount) ? slot._setCount : (Array.isArray(cycle?.sets) ? cycle.sets.length : 0);
  if (!sets) return 0;
  const repetitionMetric = slot.metricDefinitions?.find((entry) => entry.semantic === "reps" || entry.semantic === "repsPerSide");
  const target = cycle?.sets?.[0]?.targets?.[repetitionMetric?.semantic||""];
  const repMin = isPlainObject(target)&&finite(target.min) ? target.min : 8;
  const repMax = isPlainObject(target)&&finite(target.max) ? target.max : 12;
  const reps = (repMin + repMax) / 2;
  const mode = slot._executionMode ?? slot.executionMode;
  const sides = repetitionMetric?.semantic === "repsPerSide" && mode === "unilateral" ? 2 : 1;
  const workSeconds = sets * reps * 4 * sides;
  const rest = cycle?.sets?.[0]?.restSeconds;
  const restSeconds = Math.max(0, sets - 1) * (finite(rest) ? rest : (slot.role?.endsWith("Accessory") ? 90 : 120));
  return 60 + workSeconds + restSeconds;
}

// Without a cycle the estimate is the first cycle's, which is what the
// preview displays; a cycle index estimates that week's prescriptions.
/** @param {ProgramDay} day @param {number|undefined} cycleIndex @param {unknown} catalogSnapshot @param {{enginePolicy?:unknown}} [options] */
function estimateDaySeconds(day, cycleIndex, catalogSnapshot, options = {}) {
  const normalizedPolicy = POLICY.normalizeEnginePolicy(options.enginePolicy);
  if (!normalizedPolicy.ok) throw new TypeError("Invalid engine policy for duration estimate");
  const policy = normalizedPolicy.value;
  if (day.kind !== "training") return 0;
  if (validCatalog(catalogSnapshot) && day.slots.length && day.slots.every((slot) => {
    const cycle = cycleIndex === undefined ? slot.prescriptionsByCycle?.[0]
      : slot.prescriptionsByCycle?.find((entry) => entry.cycleIndex === cycleIndex);
    return cycle?.sets?.length && cycle.sets.every((set) => set.provenance?.source === "recovered_static_rules"
      || set.provenance?.source === "recovered_periodized_rules"
      || set.provenance?.source === "experimental_policy"
      || set.provenance?.source === "lifter_review" && set.provenance.policyVersion === GENERATOR_VERSION);
  })) {
    const templates = day.slots.map((slot) => {
      const raw = catalogSnapshot.exercises.find((exercise) => exercise.id === slot.exerciseId);
      const cycle = cycleIndex === undefined ? slot.prescriptionsByCycle[0]
        : slot.prescriptionsByCycle.find((entry) => entry.cycleIndex === cycleIndex);
      return raw ? { exercise: CANDIDATES.describeExercise(raw), numSets: cycle?.sets.length||0,
        restSecondsBySet: cycle?.sets.map((set) => set.restSeconds),
        type: slot.role.endsWith("Accessory") ? "accessory" : slot.role.endsWith("PrimaryCompound") ? "primary" : "secondary" } : null;
    });
    if (templates.every(template=>template!==null)) return LAYOUT.estimateTemplatesSeconds(templates, policy);
  }
  if (!day.slots.length) return 180;
  return 180 + day.slots.reduce((sum, slot) => sum + estimateSlotSeconds(slot, cycleIndex), 0);
}

// Offers are provisional until the adapter regenerates the canonical request
// and verifies the movement at its exact position. No confirmation is applied
// to the displayed definition while constructing this report.
/** @param {ProgramDefinition} program @param {CanonicalRequest} request @param {SourceCatalog} catalog */
function confirmationOffers(program, request, catalog) {
  const offers = [];
  const slots = program.days.flatMap((day) => day.slots.map((slot) => ({ day, slot })));
  for (const { day, slot } of slots) {
    const current = catalog.exercises.find((exercise) => exercise.id === slot.exerciseId);
    if(!current)continue;
    const currentCandidate = { exerciseId: current.id, roleTier: roleTier(current, slot.role),
      _preferred: request.preferredExerciseIds.includes(current.id) };
    const purpose = { patternIds: slot.movementPatternIds, muscleIds: slot.musclePurposeIds, exerciseTypeId: slot.exerciseTypeId||"" };
    const usedIds = new Set(slots.filter((entry) => entry.slot !== slot).map((entry) => entry.slot.exerciseId));
    const usedGroups = new Set(catalog.exercises.filter((exercise) => usedIds.has(exercise.id)).flatMap((exercise) => exercise.exclusionGroupings || []));
    let best = null;
    for (const exercise of catalog.exercises) {
      const prerequisites = prerequisitesSatisfied(exercise, request, catalog);
      if (prerequisites.ok || !prerequisites.failures||prerequisites.failures.some((item) => item.reason !== "movement_confirmation_required")) continue;
      const candidate = { exerciseId: exercise.id, roleTier: roleTier(exercise, slot.role),
        _preferred: request.preferredExerciseIds.includes(exercise.id) };
      if (candidate.roleTier === null || compareCandidates(candidate, currentCandidate) >= 0
        || best && compareCandidates(candidate, best.candidate) >= 0) continue;
      const prerequisiteIds = prerequisites.failures.map((item) => item.prerequisiteId).sort();
      const confirmed = { ...request, movementConfirmations: { ...request.movementConfirmations,
        [exercise.id]: unique([...(request.movementConfirmations[exercise.id] || []), ...prerequisiteIds]) } };
      if (candidateFailure(exercise, purpose, slot.role, confirmed, catalog, new Set(), usedIds, usedGroups)) continue;
      best = { candidate, prerequisiteIds };
    }
    if (best) offers.push({ dayId: day.id, slotId: slot.id, currentExerciseId: slot.exerciseId,
      offeredExerciseId: best.candidate.exerciseId, prerequisiteIds: best.prerequisiteIds });
  }
  return offers;
}

/** @param {Conflict[]} conflicts @returns {Extract<GenerationResult,{ok:false}>} */
function failure(conflicts) { return { ok: false, value: null, conflicts, explanations: [] }; }

/** @param {ProgramDefinition} program @param {string} slotId @param {SelectionContext} context @param {SourceCatalog} catalog */
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
  const selectedExercise = catalog.exercises.find((exercise) => exercise.id === selectedSlot.exerciseId);
  const purposeMuscles = selectedSlot.role.endsWith("Accessory") ? selectedSlot.musclePurposeIds
    : selectedExercise?.primaryFeatureMuscle || selectedSlot.musclePurposeIds;
  const pool = candidatesForJob({
    purposeId: selectedSlot.purposeId,
    patternIds: selectedSlot.movementPatternIds,
    muscleIds: purposeMuscles,
    exerciseTypeId: selectedSlot.exerciseTypeId,
  }, selectedSlot.role, normalizedContext, catalog, { excludedIds, usedIds, usedGroups });
  let sourceSelector;
  try { sourceSelector = CANDIDATES.create(catalog, /** @type {CanonicalRequest} */(normalizedContext), (exercise) =>
    prerequisitesSatisfied(exercise, normalizedContext, catalog).ok); }
  catch { return []; }
  const sourceType = selectedSlot.role.endsWith("PrimaryCompound") ? "primary"
    : selectedSlot.role.endsWith("Accessory") ? "accessory" : "secondary";
  return pool.candidates.filter((candidate) => sourceSelector.eligibleForRole(candidate.exerciseId, sourceType)).map((candidate) => ({
    exerciseId: candidate.exerciseId,
    roleTier: candidate.roleTier,
    eligibleEquipmentContexts: candidate.eligibleEquipmentContexts,
    metricIds: [...(candidate._exercise.exerciseMetrics||[])],
    metricDefinitions: metricDefinitionsFor(candidate._exercise, catalog),
    bodyweightCoefficient: finite(candidate._exercise.bodyweight) ? candidate._exercise.bodyweight : null,
    executionMode: executionMode(candidate._exercise, normalizedContext, catalog),
    reasons: candidate.reasons,
  }));
}

/** @param {ProgramDefinition} program @param {number} cycleNumber */
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
const CYCLE_KEYS = new Set(["cycleIndex", "sets"]);
const SET_KEYS = new Set(["id", "cycleIndex", "setIndex", "metricType", "metricIds", "metricDefinitions", "targets", "rir", "restSeconds", "status", "provenance"]);
const REQUEST_KEYS = new Set(["goal", "experience", "daysPerWeek", "timeCeilingMinutes", "gymProfile", "competencyAnswers",
  "movementConfirmations", "emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds",
  "preferredExerciseIds", "split", "periodization", "cycles", "deloadCycles", "seed", "executionContexts"]);
const ROOT_PROVENANCE_KEYS = new Set(["source", "policyVersion", "goal", "split", "selection", "approximations", "estimatedSessionSeconds", "focusNotApplied", "generationBudgetMinutes"]);
const SET_PROVENANCE_KEYS = new Set(["source", "policyVersion", "periodization", "deload", "approximation"]);
const CUSTOM_EXERCISE_KEYS = new Set([
  "id", "name", "namePt", "equipment", "primary", "secondary", "notes", "metricIds", "metricDefinitions",
]);
const FORBIDDEN_PERFORMED_KEYS = new Set(["actual", "actuals", "performed", "performedAt", "performedValues", "metricValues", "completed", "completedAt"]);
const LEGACY_MUSCLE_TOKENS = new Set(["Chest", "Lats", "Mid/upper back", "Traps", "Neck", "Front delts", "Side delts", "Rear delts", "Serratus",
  "Biceps", "Triceps", "Forearms", "Quads", "Hamstrings", "Glutes", "Adductors", "Abductors", "Calves", "Tibs", "Hip flexors",
  "Spinal erectors", "Abs", "Obliques"]);

/** @param {unknown} value @param {ReadonlySet<string>} allowed @param {string} path @param {string[]} issues @returns {value is Record<string,unknown>} */
function checkKeys(value, allowed, path, issues) {
  if (!isPlainObject(value)) { issues.push(`${path}: expected an object`); return false; }
  for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`${path}.${key}: unsupported field`);
  return true;
}

/** @param {unknown} definitions @param {SourceCatalog|null} catalog */
function inspectCustomExerciseDefinitions(definitions, catalog) {
  /** @type {string[]} */
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

/** @param {unknown} definitions @param {unknown} catalogSnapshot */
function validateCustomExerciseDefinitions(definitions, catalogSnapshot) {
  const catalog = validCatalog(catalogSnapshot) ? catalogSnapshot : null;
  const checked = inspectCustomExerciseDefinitions(definitions, catalog);
  return { ok: checked.ok, issues: checked.issues };
}

/** @param {unknown} value @param {string} path @param {string[]} issues @param {Set<object>} [seen] */
function rejectPerformedFields(value, path, issues, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PERFORMED_KEYS.has(key)) issues.push(`${path}.${key}: performed values do not belong in a program definition`);
    rejectPerformedFields(child, `${path}.${key}`, issues, seen);
  }
}

/** @param {unknown} request @param {SourceCatalog|null} catalog @param {string[]} issues @param {boolean} [structureOnly] */
function validateRequestSnapshot(request, catalog, issues, structureOnly = false) {
  if (!checkKeys(request, REQUEST_KEYS, "program.request", issues)) return;
  if (request.goal !== undefined && !(/** @type {readonly unknown[]} */(GOALS)).includes(request.goal)) issues.push("program.request.goal: unsupported");
  if (request.experience !== undefined && !(/** @type {readonly unknown[]} */(EXPERIENCES)).includes(request.experience)) issues.push("program.request.experience: unsupported");
  if (request.daysPerWeek !== undefined && (typeof request.daysPerWeek!=="number"||!Number.isInteger(request.daysPerWeek) || request.daysPerWeek < 2 || request.daysPerWeek > 6)) issues.push("program.request.daysPerWeek: unsupported");
  if (request.timeCeilingMinutes !== undefined && !(/** @type {readonly unknown[]} */(TIME_CEILINGS)).includes(request.timeCeilingMinutes)) issues.push("program.request.timeCeilingMinutes: unsupported");
  if (request.split !== undefined && (structureOnly ? !structuralId(request.split) : request.split !== "auto" && !owns(SPLITS, String(request.split)))) issues.push("program.request.split: unsupported");
  if (request.periodization !== undefined && !(/** @type {readonly unknown[]} */(PERIODIZATIONS)).includes(request.periodization)) issues.push("program.request.periodization: unsupported");
  if (request.cycles !== undefined && (typeof request.cycles!=="number"||!Number.isInteger(request.cycles) || request.cycles < 1 || request.cycles > 12)) issues.push("program.request.cycles: unsupported");
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
      for (const [key, answer] of Object.entries(request.competencyAnswers)) if (!(answer===true||answer===false||answer===null)) issues.push(`program.request.competencyAnswers.${key}: invalid answer`);
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
    else for (const [id, mode] of Object.entries(/** @type {Record<string,unknown>} */(request.executionContexts))) {
      if ((catalog ? catalogObject(catalog, id)?.type !== "exercise" : !structureOnly) || !(mode==="bilateral"||mode==="unilateral")) issues.push(`program.request.executionContexts.${id}: invalid execution mode`);
    }
  }
  if (structureOnly) {
    for (const field of ["emphasisMuscleIds", "deprioritizedMuscleIds", "excludedExerciseIds", "excludedMuscleIds", "preferredExerciseIds"]) {
      if (Array.isArray(request[field]) && request[field].some(id => !structuralId(id))) issues.push(`program.request.${field}: expected nonempty identity strings`);
    }
    if (isPlainObject(request.gymProfile)&&Array.isArray(request.gymProfile.equipmentIds) && request.gymProfile.equipmentIds.some(id => !structuralId(id))) issues.push("program.request.gymProfile.equipmentIds: expected nonempty identity strings");
    for (const field of ["movementConfirmations", "executionContexts"]) if (isPlainObject(request[field])) {
      for (const [id, value] of Object.entries(request[field])) {
        if (!structuralId(id) || field === "movementConfirmations" && Array.isArray(value) && value.some(id => !structuralId(id))) issues.push(`program.request.${field}.${id}: invalid identity`);
      }
    }
    if (isPlainObject(request.gymProfile)&&isPlainObject(request.gymProfile.equipmentLoadsKg) && Object.keys(request.gymProfile.equipmentLoadsKg).some(id => !structuralId(id))) issues.push("program.request.gymProfile.equipmentLoadsKg: invalid identity");
  }
  if (request.deloadCycles !== undefined && (!Array.isArray(request.deloadCycles)
    || request.deloadCycles.some((cycle) => !Number.isInteger(cycle) || cycle < 1 || cycle > (request.cycles || 12)))) issues.push("program.request.deloadCycles: invalid cycles");
}

/** @param {unknown} value @returns {value is string} */
const structuralId = value => typeof value === "string" && value.trim().length > 0;

/** @param {unknown} program @param {unknown} catalogSnapshot @param {unknown} [customExerciseDefinitions] */
function validateProgramDefinition(program, catalogSnapshot, customExerciseDefinitions = []) {
  return inspectProgramDefinition(program, catalogSnapshot, customExerciseDefinitions, false);
}

// Archive readability is a supported-schema claim, never current eligibility,
// catalog membership, source authenticity, replay or duration-model approval.
/** @param {unknown} program @param {unknown} [customExerciseDefinitions] */
function validateProgramDefinitionStructure(program, customExerciseDefinitions = []) {
  try {
    const data = JSON.parse(IDENTITY.canonicalJSON({ program, customExerciseDefinitions }), (key, value) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) throw new TypeError("Unsafe data key");
      return value;
    });
    return inspectProgramDefinition(data.program, null, data.customExerciseDefinitions, true);
  } catch {
    return { ok: false, issues: ["program: expected a supported plain JSON program definition"] };
  }
}

/** @param {unknown} program @param {unknown} catalogSnapshot @param {unknown} customExerciseDefinitions @param {boolean} structureOnly */
function inspectProgramDefinition(program, catalogSnapshot, customExerciseDefinitions, structureOnly) {
  /** @type {string[]} */
  const issues = [];
  if (!checkKeys(program, PROGRAM_KEYS, "program", issues)) return { ok: false, issues };
  if (!(/** @type {readonly unknown[]} */(SUPPORTED_PROGRAM_SCHEMA_VERSIONS)).includes(program.schemaVersion)) issues.push("program.schemaVersion: unsupported");
  if (typeof program.generatorVersion !== "string" || !program.generatorVersion) issues.push("program.generatorVersion: expected a version");
  if (program.seed !== undefined && typeof program.seed !== "string") issues.push("program.seed: expected a string");
  validateRequestSnapshot(program.request, validCatalog(catalogSnapshot) ? catalogSnapshot : null, issues, structureOnly);
  if (typeof program.cycles!=="number"||!Number.isInteger(program.cycles) || program.cycles < 1 || program.cycles > 12) issues.push("program.cycles: unsupported");
  if (!Array.isArray(program.deloadCycles) || program.deloadCycles.some((value) => !Number.isInteger(value) || value < 1 || value > Number(program.cycles))
    || new Set(Array.isArray(program.deloadCycles) ? program.deloadCycles : []).size !== (Array.isArray(program.deloadCycles) ? program.deloadCycles.length : 0)) issues.push("program.deloadCycles: invalid cycles");
  if (!Array.isArray(program.days) || program.days.length !== 7) issues.push("program.days: expected an ordered seven-day week");
  if (!checkKeys(program.provenance, ROOT_PROVENANCE_KEYS, "program.provenance", issues)) return { ok: false, issues };
  for (const key of ["source", "policyVersion"]) if (typeof program.provenance[key] !== "string" || !program.provenance[key]) issues.push(`program.provenance.${key}: required`);
  if (program.provenance.goal !== undefined && !(/** @type {readonly unknown[]} */(GOALS)).includes(program.provenance.goal)) issues.push("program.provenance.goal: unsupported");
  if (program.provenance.split !== undefined && (structureOnly ? !structuralId(program.provenance.split) : program.provenance.split !== "auto" && !owns(SPLITS, String(program.provenance.split)))) issues.push("program.provenance.split: unsupported");
  if (program.provenance.generationBudgetMinutes !== undefined && (!finite(program.provenance.generationBudgetMinutes) || program.provenance.generationBudgetMinutes <= 0)) issues.push("program.provenance.generationBudgetMinutes: expected a positive number");
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
    if (!(day.kind==="training"||day.kind==="rest")) issues.push(`${dayPath}.kind: expected training or rest`);
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
      if (!(/** @type {readonly unknown[]} */(ROLES)).includes(slot.role)) issues.push(`${slotPath}.role: unsupported`);
      if (!Array.isArray(slot.sourceExerciseIds) || !slot.sourceExerciseIds.includes(slot.exerciseId)
        || slot.sourceExerciseIds.some((id) => typeof id !== "string")) issues.push(`${slotPath}.sourceExerciseIds: must include selected exercise`);
      for (const field of ["musclePurposeIds", "movementPatternIds", "metricIds", "metricDefinitions"]) if (!Array.isArray(slot[field])) issues.push(`${slotPath}.${field}: expected an array`);
      if (structureOnly) {
        for (const field of ["sourceExerciseIds", "musclePurposeIds", "movementPatternIds", "lateralityIds"]) {
          if (Array.isArray(slot[field]) && slot[field].some(id => !structuralId(id))) issues.push(`${slotPath}.${field}: expected nonempty identity strings`);
        }
        if (slot.exerciseTypeId !== undefined && !structuralId(slot.exerciseTypeId)) issues.push(`${slotPath}.exerciseTypeId: expected a nonempty identity string`);
      }
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
      if (slot.executionMode !== undefined && slot.executionMode !== null && !(slot.executionMode==="bilateral"||slot.executionMode==="unilateral")) issues.push(`${slotPath}.executionMode: invalid`);
      if (!(slot.metricOrigin==="source_catalog"||slot.metricOrigin==="user_defined")) issues.push(`${slotPath}.metricOrigin: unsupported`);
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
        if (slot.loadingModel.assistanceDirection !== undefined && !(slot.loadingModel.assistanceDirection==="subtract"||slot.loadingModel.assistanceDirection===null)) issues.push(`${slotPath}.loadingModel.assistanceDirection: unsupported`);
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
          } else if ((Array.isArray(slot.metricIds)?slot.metricIds.length:0)) issues.push(`${slotPath}.metricIds: metricless source must be configured explicitly`);
          const sourceCoefficient = finite(exercise.bodyweight) ? exercise.bodyweight : null;
          if ((isPlainObject(slot.loadingModel)?slot.loadingModel.bodyweightCoefficient:undefined) !== sourceCoefficient) issues.push(`${slotPath}.loadingModel.bodyweightCoefficient: differs from source catalog`);
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
          if (set.rir !== null && (!finite(set.rir) || set.rir < 0 || set.rir > 6)) issues.push(`${setPath}.rir: outside 0–6`);
          if (set.restSeconds !== null && (typeof set.restSeconds!=="number"||!Number.isSafeInteger(set.restSeconds) || set.restSeconds < 0 || set.restSeconds > 86400)) issues.push(`${setPath}.restSeconds: invalid`);
          if (!(set.status==="ready"||set.status==="manual"||set.status==="configuration_required")) issues.push(`${setPath}.status: unsupported`);
          if (!(Array.isArray(slot.metricIds)?slot.metricIds.length:0) && set.status !== "configuration_required") issues.push(`${setPath}.status: explicit metric configuration required`);
          if (slot.metricOrigin === "user_defined" && (Array.isArray(slot.metricIds)?slot.metricIds.length:0) && set.status !== "manual") issues.push(`${setPath}.status: user-defined metrics require a manual prescription`);
          if (!checkKeys(set.provenance, SET_PROVENANCE_KEYS, `${setPath}.provenance`, issues)) continue;
          if (typeof set.provenance.source !== "string" || !set.provenance.source || typeof set.provenance.policyVersion !== "string" || !set.provenance.policyVersion) issues.push(`${setPath}.provenance: source and policyVersion required`);
          if (set.provenance.periodization !== undefined && !(/** @type {readonly unknown[]} */(PERIODIZATIONS)).includes(set.provenance.periodization)) issues.push(`${setPath}.provenance.periodization: unsupported`);
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
/** @param {ProgramDefinition} program */
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

/** @param {unknown} target */
function validTarget(target) {
  if (finite(target)) return target >= 0;
  if (!isPlainObject(target) || !finite(target.min) || !finite(target.max)) return false;
  return target.min >= 0 && target.max >= target.min;
}

/** @param {string} name */
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
  PRECONDITION_COMPETENCIES,
  METRIC_SEMANTICS,
  METRIC_SOURCE_IDS,
  normalizeEnginePolicy: POLICY.normalizeEnginePolicy,
  getDefaultEnginePolicy: POLICY.getDefaultEnginePolicy,
  getEnginePolicyMetadata: POLICY.getEnginePolicyMetadata,
  generateProgram,
  canonicalizeRequest,
  generationIdentity,
  availableSplits,
  generatedDayNameKey,
  findSubstitutions,
  validateProgramDefinition,
  validateProgramDefinitionStructure,
  canonicalizeProgramDefinition,
  validateCustomExerciseDefinitions,
  prescriptionsForCycle,
  estimateDaySeconds,
  metricDefinitionForName: apiMetricDefinition,
});


return api;
}

export {GENERATOR_VERSION,PROGRAM_SCHEMA_VERSION,MAX_SLOT_ALTERNATES,ROLES,SPLITS,GOALS,EXPERIENCES,TIME_CEILINGS,PERIODIZATIONS,PRECONDITION_COMPETENCIES,METRIC_SEMANTICS,METRIC_SOURCE_IDS};
