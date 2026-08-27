(function (root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CONTEXT_SCHEMA_VERSION = 1;
  const MAX_CONTEXT_BYTES = 16384;
  const MAX_DRAFT_BYTES = 65536;
  const MAX_STRUCTURE_DEPTH = 12;
  const MAX_STRUCTURE_NODES = 2048;
  const MAX_TOKEN_LENGTH = 96;
  const MAX_PROGRAM_NAME_LENGTH = 80;
  const MAX_LIST_LENGTH = 32;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const DESIRED_RESULTS = new Set(["muscle_growth", "balanced", "strength"]);
  const STRUCTURED_EXPERIENCE = new Set(["first", "under_6m", "6_to_24m", "over_24m"]);
  const RECENT_CONSISTENCY = new Set(["most", "about_half", "few", "none"]);
  const SESSION_MINUTES = new Set([30, 45, 60, 75, 90]);
  const PREFERRED_REST_SECONDS = new Set([null, 60, 90, 120, 180]);
  const ENVIRONMENTS = new Set([
    "commercial_gym",
    "basic_gym",
    "limited_home",
    "full_home",
    "other",
  ]);
  const CONSTRAINT_REASONS = new Set(["dislike", "pain", "equipment", "other"]);
  const VERSION_KEYS = Object.freeze([
    "compiler",
    "family",
    "blueprint",
    "catalogue",
    "allocation",
    "timeModel",
    "contextSchema",
    "progression",
  ]);
  const ROUTES = Object.freeze(["recommend", "custom", "browse", "build", "import", "shared"]);
  const ROUTE_SET = new Set(ROUTES);
  const ROUTE_STEPS = Object.freeze({
    recommend: Object.freeze([
      "desired_result",
      "background",
      "schedule",
      "environment",
      "priorities",
      "result",
      "preview",
    ]),
    custom: Object.freeze([
      "desired_result",
      "background",
      "schedule",
      "environment",
      "priorities",
      "custom_shape",
      "result",
      "preview",
    ]),
    browse: Object.freeze(["schedule", "environment", "catalogue", "preview"]),
    build: Object.freeze(["build_setup", "editor"]),
    import: Object.freeze(["import_source", "preview"]),
    shared: Object.freeze(["shared_review", "preview"]),
  });
  const SHARED_GENERATOR_KEYS = Object.freeze([
    "desiredResult",
    "structuredExperience",
    "recentConsistency",
    "daysPerWeek",
    "sessionMinutes",
    "preferredRestSeconds",
    "environment",
    "primaryMuscles",
    "priorityMovements",
    "exerciseConstraints",
  ]);
  const BROWSE_CONTEXT_KEYS = Object.freeze([
    "structuredExperience",
    "daysPerWeek",
    "sessionMinutes",
    "environment",
  ]);
  const CUSTOM_KEYS = Object.freeze([
    "splitPreference",
    "deEmphasizedMuscles",
    "ignoredMuscles",
    "mustHaveExercises",
  ]);

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!isPlainObject(value)) return value;
    const copy = {};
    for (const key of Object.keys(value)) copy[key] = clone(value[key]);
    return copy;
  }

  function utf8Bytes(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      if (code < 0x80) bytes++;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          index++;
        } else bytes += 3;
      } else bytes += 3;
    }
    return bytes;
  }

  function inspectJson(value, maxBytes) {
    const seen = new WeakSet();
    let nodes = 0;
    const issues = [];

    function visit(current, depth, path) {
      if (issues.length) return;
      nodes++;
      if (nodes > MAX_STRUCTURE_NODES) {
        issues.push("too_many_nodes");
        return;
      }
      if (depth > MAX_STRUCTURE_DEPTH) {
        issues.push("too_deep");
        return;
      }
      if (current === null || typeof current === "string" || typeof current === "boolean") return;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) issues.push(`${path}:non_finite_number`);
        return;
      }
      if (typeof current !== "object") {
        issues.push(`${path}:non_json_value`);
        return;
      }
      if (seen.has(current)) {
        issues.push(`${path}:cycle`);
        return;
      }
      seen.add(current);
      if (!Array.isArray(current) && !isPlainObject(current)) {
        issues.push(`${path}:not_plain_object`);
        return;
      }
      for (const key of Object.keys(current)) {
        if (FORBIDDEN_KEYS.has(key)) {
          issues.push(`${path}.${key}:forbidden_key`);
          return;
        }
        visit(current[key], depth + 1, `${path}.${key}`);
      }
    }

    visit(value, 0, "$");
    if (issues.length) return issues;
    let encoded;
    try {
      encoded = JSON.stringify(value);
    } catch {
      return ["not_serializable"];
    }
    if (encoded === undefined) return ["not_serializable"];
    if (utf8Bytes(encoded) > maxBytes) return ["too_large"];
    return [];
  }

  function parseBounded(value, maxBytes) {
    if (typeof value !== "string") return { ok: true, value };
    if (utf8Bytes(value) > maxBytes) return { ok: false, issues: ["too_large"] };
    try {
      return { ok: true, value: JSON.parse(value) };
    } catch {
      return { ok: false, issues: ["invalid_json"] };
    }
  }

  function schemaResult(kind, issues, value) {
    if (issues.length) return { ok: false, code: `invalid-${kind}`, issues };
    return { ok: true, value };
  }

  function rejectUnknownKeys(value, allowed, path, issues) {
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) issues.push(`${path}.${key}:unknown_key`);
    }
  }

  function validToken(value) {
    return typeof value === "string" && value.length > 0 && value.length <= MAX_TOKEN_LENGTH &&
      /^[a-z0-9][a-z0-9_.:-]*$/.test(value);
  }

  function normalizeTokenList(value, path, issues, maxLength) {
    if (!Array.isArray(value) || value.length > maxLength) {
      issues.push(`${path}:invalid_list`);
      return [];
    }
    const output = [];
    const seen = new Set();
    for (const token of value) {
      if (!validToken(token)) {
        issues.push(`${path}:invalid_token`);
        continue;
      }
      if (seen.has(token)) {
        issues.push(`${path}:duplicate`);
        continue;
      }
      seen.add(token);
      output.push(token);
    }
    return output;
  }

  function normalizeEnvironment(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:required`);
      return {};
    }
    rejectUnknownKeys(value, new Set(["kind", "capabilities"]), path, issues);
    if (!ENVIRONMENTS.has(value.kind)) issues.push(`${path}.kind:invalid`);
    const output = { kind: value.kind };
    if (hasOwn(value, "capabilities")) {
      output.capabilities = normalizeTokenList(value.capabilities, `${path}.capabilities`, issues, MAX_LIST_LENGTH);
    }
    return output;
  }

  function normalizeConstraints(value, path, issues) {
    if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) {
      issues.push(`${path}:invalid_list`);
      return [];
    }
    const output = [];
    const seen = new Set();
    for (const item of value) {
      if (!isPlainObject(item)) {
        issues.push(`${path}:invalid_item`);
        continue;
      }
      rejectUnknownKeys(item, new Set(["exerciseId", "reason"]), path, issues);
      if (!validToken(item.exerciseId) || !CONSTRAINT_REASONS.has(item.reason)) {
        issues.push(`${path}:invalid_item`);
        continue;
      }
      if (seen.has(item.exerciseId)) {
        issues.push(`${path}:duplicate_exercise`);
        continue;
      }
      seen.add(item.exerciseId);
      output.push({ exerciseId: item.exerciseId, reason: item.reason });
    }
    return output;
  }

  function validIsoTimestamp(value) {
    return typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
      !Number.isNaN(Date.parse(value));
  }

  function normalizeProgrammingContext(input) {
    const parsed = parseBounded(input, MAX_CONTEXT_BYTES);
    if (!parsed.ok) return schemaResult("programming-context", parsed.issues);
    const raw = parsed.value;
    const structural = inspectJson(raw, MAX_CONTEXT_BYTES);
    if (structural.length) return schemaResult("programming-context", structural);
    if (!isPlainObject(raw)) return schemaResult("programming-context", ["root:not_object"]);
    const issues = [];
    const allowed = new Set([
      "schemaVersion",
      "desiredResult",
      "structuredExperience",
      "recentConsistency",
      "availability",
      "environment",
      "primaryMuscles",
      "deEmphasizedMuscles",
      "ignoredMuscles",
      "priorityMovements",
      "exerciseConstraints",
      "reviewedAt",
    ]);
    rejectUnknownKeys(raw, allowed, "$", issues);
    if (raw.schemaVersion !== CONTEXT_SCHEMA_VERSION) issues.push("$.schemaVersion:unsupported");
    if (!DESIRED_RESULTS.has(raw.desiredResult)) issues.push("$.desiredResult:invalid");
    if (!STRUCTURED_EXPERIENCE.has(raw.structuredExperience)) issues.push("$.structuredExperience:invalid");
    if (!RECENT_CONSISTENCY.has(raw.recentConsistency)) issues.push("$.recentConsistency:invalid");
    if (!isPlainObject(raw.availability)) issues.push("$.availability:required");
    const availability = isPlainObject(raw.availability) ? raw.availability : {};
    rejectUnknownKeys(availability, new Set(["daysPerWeek", "sessionMinutes", "preferredRestSeconds"]), "$.availability", issues);
    if (!Number.isInteger(availability.daysPerWeek) || availability.daysPerWeek < 2 || availability.daysPerWeek > 6) {
      issues.push("$.availability.daysPerWeek:invalid");
    }
    if (!SESSION_MINUTES.has(availability.sessionMinutes)) issues.push("$.availability.sessionMinutes:invalid");
    if (!PREFERRED_REST_SECONDS.has(availability.preferredRestSeconds)) {
      issues.push("$.availability.preferredRestSeconds:invalid");
    }
    const output = {
      schemaVersion: CONTEXT_SCHEMA_VERSION,
      desiredResult: raw.desiredResult,
      structuredExperience: raw.structuredExperience,
      recentConsistency: raw.recentConsistency,
      availability: {
        daysPerWeek: availability.daysPerWeek,
        sessionMinutes: availability.sessionMinutes,
        preferredRestSeconds: availability.preferredRestSeconds,
      },
      environment: normalizeEnvironment(raw.environment, "$.environment", issues),
      primaryMuscles: normalizeTokenList(raw.primaryMuscles, "$.primaryMuscles", issues, 2),
      deEmphasizedMuscles: normalizeTokenList(raw.deEmphasizedMuscles, "$.deEmphasizedMuscles", issues, MAX_LIST_LENGTH),
      ignoredMuscles: normalizeTokenList(raw.ignoredMuscles, "$.ignoredMuscles", issues, MAX_LIST_LENGTH),
      priorityMovements: normalizeTokenList(raw.priorityMovements, "$.priorityMovements", issues, 2),
      exerciseConstraints: normalizeConstraints(raw.exerciseConstraints, "$.exerciseConstraints", issues),
      reviewedAt: raw.reviewedAt,
    };
    if (!validIsoTimestamp(raw.reviewedAt)) issues.push("$.reviewedAt:invalid");
    return schemaResult("programming-context", issues, output);
  }

  function normalizeAnswers(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("$.answers:not_object");
      return {};
    }
    const allowed = new Set([
      ...SHARED_GENERATOR_KEYS,
      ...CUSTOM_KEYS,
      "catalogueSelection",
      "programName",
      "importReady",
      "sharedReady",
    ]);
    rejectUnknownKeys(raw, allowed, "$.answers", issues);
    const output = {};
    if (hasOwn(raw, "desiredResult")) {
      if (!DESIRED_RESULTS.has(raw.desiredResult)) issues.push("$.answers.desiredResult:invalid");
      else output.desiredResult = raw.desiredResult;
    }
    if (hasOwn(raw, "structuredExperience")) {
      if (!STRUCTURED_EXPERIENCE.has(raw.structuredExperience)) issues.push("$.answers.structuredExperience:invalid");
      else output.structuredExperience = raw.structuredExperience;
    }
    if (hasOwn(raw, "recentConsistency")) {
      if (!RECENT_CONSISTENCY.has(raw.recentConsistency)) issues.push("$.answers.recentConsistency:invalid");
      else output.recentConsistency = raw.recentConsistency;
    }
    if (hasOwn(raw, "daysPerWeek")) {
      if (!Number.isInteger(raw.daysPerWeek) || raw.daysPerWeek < 2 || raw.daysPerWeek > 6) issues.push("$.answers.daysPerWeek:invalid");
      else output.daysPerWeek = raw.daysPerWeek;
    }
    if (hasOwn(raw, "sessionMinutes")) {
      if (!SESSION_MINUTES.has(raw.sessionMinutes)) issues.push("$.answers.sessionMinutes:invalid");
      else output.sessionMinutes = raw.sessionMinutes;
    }
    if (hasOwn(raw, "preferredRestSeconds")) {
      if (!PREFERRED_REST_SECONDS.has(raw.preferredRestSeconds)) issues.push("$.answers.preferredRestSeconds:invalid");
      else output.preferredRestSeconds = raw.preferredRestSeconds;
    }
    if (hasOwn(raw, "environment")) output.environment = normalizeEnvironment(raw.environment, "$.answers.environment", issues);
    const listFields = {
      primaryMuscles: 2,
      priorityMovements: 2,
      deEmphasizedMuscles: MAX_LIST_LENGTH,
      ignoredMuscles: MAX_LIST_LENGTH,
      mustHaveExercises: MAX_LIST_LENGTH,
    };
    for (const [key, maximum] of Object.entries(listFields)) {
      if (hasOwn(raw, key)) output[key] = normalizeTokenList(raw[key], `$.answers.${key}`, issues, maximum);
    }
    if (hasOwn(raw, "exerciseConstraints")) {
      output.exerciseConstraints = normalizeConstraints(raw.exerciseConstraints, "$.answers.exerciseConstraints", issues);
    }
    for (const key of ["splitPreference", "catalogueSelection"]) {
      if (!hasOwn(raw, key)) continue;
      if (!validToken(raw[key])) issues.push(`$.answers.${key}:invalid`);
      else output[key] = raw[key];
    }
    if (hasOwn(raw, "programName")) {
      if (typeof raw.programName !== "string" || !raw.programName.trim() || [...raw.programName].length > MAX_PROGRAM_NAME_LENGTH) {
        issues.push("$.answers.programName:invalid");
      } else output.programName = raw.programName.trim();
    }
    for (const key of ["importReady", "sharedReady"]) {
      if (!hasOwn(raw, key)) continue;
      if (typeof raw[key] !== "boolean") issues.push(`$.answers.${key}:invalid`);
      else output[key] = raw[key];
    }
    return output;
  }

  function normalizeVersions(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("$.versions:not_object");
      return {};
    }
    rejectUnknownKeys(raw, new Set(VERSION_KEYS), "$.versions", issues);
    const output = {};
    for (const key of VERSION_KEYS) {
      if (!validToken(raw[key])) issues.push(`$.versions.${key}:invalid`);
      else output[key] = raw[key];
    }
    return output;
  }

  function normalizeSetupDraft(input) {
    const parsed = parseBounded(input, MAX_DRAFT_BYTES);
    if (!parsed.ok) return schemaResult("setup-draft", parsed.issues);
    const raw = parsed.value;
    const structural = inspectJson(raw, MAX_DRAFT_BYTES);
    if (structural.length) return schemaResult("setup-draft", structural);
    if (!isPlainObject(raw)) return schemaResult("setup-draft", ["root:not_object"]);
    const issues = [];
    const allowed = new Set([
      "schemaVersion",
      "draftId",
      "route",
      "step",
      "answers",
      "legacyHints",
      "result",
      "versions",
      "activeProgramRevisionAtStart",
      "createdAt",
      "updatedAt",
    ]);
    rejectUnknownKeys(raw, allowed, "$", issues);
    if (raw.schemaVersion !== SCHEMA_VERSION) issues.push("$.schemaVersion:unsupported");
    if (typeof raw.draftId !== "string" || raw.draftId.length < 1 || raw.draftId.length > 64) issues.push("$.draftId:invalid");
    if (raw.route !== null && !ROUTE_SET.has(raw.route)) issues.push("$.route:invalid");
    if (raw.route === null && raw.step !== "entry") issues.push("$.step:invalid_for_route");
    if (ROUTE_SET.has(raw.route) && raw.step !== "entry" && raw.step !== "activation_conflict" &&
      !ROUTE_STEPS[raw.route].includes(raw.step)) {
      issues.push("$.step:invalid_for_route");
    }
    const answers = normalizeAnswers(raw.answers, issues);
    if (!isPlainObject(raw.legacyHints)) issues.push("$.legacyHints:not_object");
    if (raw.result !== null && !isPlainObject(raw.result)) issues.push("$.result:not_object");
    const versions = normalizeVersions(raw.versions, issues);
    if (!Number.isInteger(raw.activeProgramRevisionAtStart) || raw.activeProgramRevisionAtStart < 0) {
      issues.push("$.activeProgramRevisionAtStart:invalid");
    }
    if (!validIsoTimestamp(raw.createdAt)) issues.push("$.createdAt:invalid");
    if (!validIsoTimestamp(raw.updatedAt)) issues.push("$.updatedAt:invalid");
    const output = {
      schemaVersion: SCHEMA_VERSION,
      draftId: raw.draftId,
      route: raw.route,
      step: raw.step,
      answers,
      legacyHints: isPlainObject(raw.legacyHints) ? clone(raw.legacyHints) : {},
      result: raw.result === null ? null : clone(raw.result),
      versions,
      activeProgramRevisionAtStart: raw.activeProgramRevisionAtStart,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return schemaResult("setup-draft", issues, output);
  }

  function migrateLegacyAnswers(input, options) {
    const parsed = parseBounded(input, MAX_CONTEXT_BYTES);
    if (!parsed.ok) return schemaResult("legacy-answers", parsed.issues);
    const raw = parsed.value;
    const structural = inspectJson(raw, MAX_CONTEXT_BYTES);
    if (structural.length) return schemaResult("legacy-answers", structural);
    if (!isPlainObject(raw)) return schemaResult("legacy-answers", ["root:not_object"]);
    const config = isPlainObject(options) ? options : {};
    const route = config.route;
    const compatibleSplits = Array.isArray(config.compatibleSplits) && config.compatibleSplits.length <= 2
      ? config.compatibleSplits.filter(validToken)
      : [];
    const answers = {};
    const legacyHints = {};
    const reviewRequired = [];

    function hint(key, value) {
      if (value === undefined) return;
      legacyHints[key] = clone(value);
    }

    if (hasOwn(raw, "goal")) {
      hint("goal", raw.goal);
      if (raw.goal === "hypertrophy") answers.desiredResult = "muscle_growth";
      else if (raw.goal === "strength_hypertrophy" || raw.goal === "strength") answers.desiredResult = "balanced";
      reviewRequired.push("desired_result");
    }

    if (hasOwn(raw, "experience")) {
      hint("experience", raw.experience);
      reviewRequired.push("structured_experience");
    }

    if (hasOwn(raw, "daysPerWeek")) {
      hint("daysPerWeek", raw.daysPerWeek);
      if (Number.isInteger(raw.daysPerWeek) && raw.daysPerWeek >= 2 && raw.daysPerWeek <= 6) {
        answers.daysPerWeek = raw.daysPerWeek;
      }
      reviewRequired.push("schedule");
    }

    if (hasOwn(raw, "sessionLength")) {
      hint("sessionLength", raw.sessionLength);
      reviewRequired.push("session_minutes");
    }

    if (hasOwn(raw, "equipment")) {
      hint("equipment", raw.equipment);
      if (typeof raw.equipment === "string" && ENVIRONMENTS.has(raw.equipment)) {
        answers.environment = { kind: raw.equipment };
      }
      reviewRequired.push("environment");
    }

    if (hasOwn(raw, "splitType")) {
      hint("splitType", raw.splitType);
      if (route === "custom" && compatibleSplits.includes(raw.splitType)) {
        answers.splitPreference = raw.splitType;
      }
      if (route === "custom") reviewRequired.push("custom_shape");
    }

    if (hasOwn(raw, "priorityMuscles")) {
      hint("priorityMuscles", raw.priorityMuscles);
      if (Array.isArray(raw.priorityMuscles) && raw.priorityMuscles.length <= 2 && raw.priorityMuscles.every(validToken)) {
        answers.primaryMuscles = normalizeTokenList(raw.priorityMuscles, "$.priorityMuscles", [], 2);
      }
      reviewRequired.push("priorities");
    }

    return {
      ok: true,
      value: {
        answers,
        legacyHints,
        reviewRequired: [...new Set(reviewRequired)],
      },
    };
  }

  function copyKeys(source, keys) {
    const result = {};
    if (!isPlainObject(source)) return result;
    for (const key of keys) {
      if (hasOwn(source, key)) result[key] = clone(source[key]);
    }
    return result;
  }

  function compatibleAnswers(answers, fromRoute, toRoute) {
    if (toRoute === "recommend" || toRoute === "custom") {
      const kept = copyKeys(answers, SHARED_GENERATOR_KEYS);
      if (toRoute === "custom" && fromRoute === "custom") {
        Object.assign(kept, copyKeys(answers, CUSTOM_KEYS));
      }
      return kept;
    }
    if (toRoute === "browse") return copyKeys(answers, BROWSE_CONTEXT_KEYS);
    return {};
  }

  function createState(options) {
    const input = isPlainObject(options) ? options : {};
    return {
      schemaVersion: SCHEMA_VERSION,
      draftId: typeof input.draftId === "string" ? input.draftId : "",
      route: null,
      step: "entry",
      answers: {},
      legacyHints: {},
      result: null,
      versions: isPlainObject(input.versions) ? clone(input.versions) : {},
      activeProgramRevisionAtStart: Number.isInteger(input.activeProgramRevisionAtStart)
        ? input.activeProgramRevisionAtStart
        : 0,
      createdAt: typeof input.now === "string" ? input.now : "",
      updatedAt: typeof input.now === "string" ? input.now : "",
    };
  }

  function assertState(state) {
    if (!isPlainObject(state)) throw new TypeError("Program-entry state must be an object");
    if (state.route !== null && !ROUTE_SET.has(state.route)) throw new TypeError("Unknown program-entry route");
    if (state.route === null && state.step !== "entry") throw new TypeError("Entry state cannot name a route step");
    if (state.route !== null && state.step !== "entry" && state.step !== "activation_conflict" &&
      !ROUTE_STEPS[state.route].includes(state.step)) {
      throw new TypeError("Step does not belong to route");
    }
  }

  function selectRoute(state, route) {
    assertState(state);
    if (!ROUTE_SET.has(route)) throw new TypeError("Unknown program-entry route");
    return {
      ...clone(state),
      route,
      step: ROUTE_STEPS[route][0],
      answers: compatibleAnswers(state.answers, state.route, route),
      result: null,
    };
  }

  function setAnswers(state, patch) {
    assertState(state);
    if (!isPlainObject(patch)) throw new TypeError("Answer patch must be an object");
    const structural = inspectJson(patch, MAX_CONTEXT_BYTES);
    if (structural.length) throw new TypeError(`Invalid answer patch: ${structural.join(",")}`);
    const issues = [];
    const normalized = normalizeAnswers(patch, issues);
    if (issues.length) throw new TypeError(`Invalid answer patch: ${issues.join(",")}`);
    return {
      ...clone(state),
      answers: { ...clone(state.answers), ...normalized },
      result: null,
    };
  }

  function setResult(state, result) {
    assertState(state);
    if (result === null || result === undefined) throw new TypeError("Result is required");
    const structural = inspectJson(result, MAX_DRAFT_BYTES);
    if (structural.length || !isPlainObject(result)) throw new TypeError("Invalid program-entry result");
    return { ...clone(state), result: clone(result) };
  }

  function validationIssues(state) {
    assertState(state);
    const answers = state.answers || {};
    switch (state.step) {
      case "entry": return state.route ? [] : ["route_required"];
      case "desired_result": return answers.desiredResult ? [] : ["desired_result_required"];
      case "background": {
        const issues = [];
        if (!answers.structuredExperience) issues.push("structured_experience_required");
        if (!answers.recentConsistency) issues.push("recent_consistency_required");
        return issues;
      }
      case "schedule": {
        const issues = [];
        if (!answers.daysPerWeek) issues.push("days_per_week_required");
        if (!answers.sessionMinutes) issues.push("session_minutes_required");
        if (state.route !== "browse" && !hasOwn(answers, "preferredRestSeconds")) {
          issues.push("preferred_rest_required");
        }
        return issues;
      }
      case "environment": return answers.environment ? [] : ["environment_required"];
      case "priorities": return [];
      case "custom_shape": return answers.splitPreference ? [] : ["split_preference_required"];
      case "catalogue": {
        const issues = [];
        if (!answers.catalogueSelection) issues.push("catalogue_selection_required");
        if (!state.result) issues.push("catalogue_preview_required");
        return issues;
      }
      case "build_setup": {
        const issues = [];
        if (!answers.programName) issues.push("program_name_required");
        if (!answers.daysPerWeek) issues.push("days_per_week_required");
        return issues;
      }
      case "import_source": {
        const issues = [];
        if (!answers.importReady) issues.push("import_source_required");
        if (!state.result) issues.push("import_preview_required");
        return issues;
      }
      case "shared_review": {
        const issues = [];
        if (!answers.sharedReady) issues.push("shared_review_required");
        if (!state.result) issues.push("shared_preview_required");
        return issues;
      }
      case "result": return state.result ? [] : ["result_required"];
      case "preview": return state.result ? [] : ["preview_required"];
      case "editor": return [];
      default: throw new TypeError("Unknown program-entry step");
    }
  }

  function advance(state) {
    assertState(state);
    const issues = validationIssues(state);
    if (issues.length) return { ok: false, state: clone(state), issues };
    if (state.step === "entry") return { ok: true, state: clone(state), issues: [] };
    const steps = ROUTE_STEPS[state.route];
    const index = steps.indexOf(state.step);
    const nextStep = steps[Math.min(index + 1, steps.length - 1)];
    return { ok: true, state: { ...clone(state), step: nextStep }, issues: [] };
  }

  function back(state) {
    assertState(state);
    if (state.step === "entry") return clone(state);
    if (state.step === "activation_conflict") return { ...clone(state), step: "preview" };
    const steps = ROUTE_STEPS[state.route];
    const index = steps.indexOf(state.step);
    if (index === 0) return { ...clone(state), step: "entry" };
    return { ...clone(state), step: steps[index - 1] };
  }

  function changedVersions(saved, current) {
    if (!isPlainObject(saved) || !isPlainObject(current)) return VERSION_KEYS.slice();
    return VERSION_KEYS.filter((key) => saved[key] !== current[key]);
  }

  function resumeSetupDraft(input, options) {
    const normalized = normalizeSetupDraft(input);
    if (!normalized.ok) return normalized;
    const config = isPlainObject(options) ? options : {};
    const state = normalized.value;
    const versionChanges = changedVersions(state.versions, config.currentVersions || state.versions);
    const liveRevision = config.liveActiveProgramRevision;
    const activeRevisionChanged = Number.isInteger(liveRevision) &&
      liveRevision !== state.activeProgramRevisionAtStart;
    let status = "resumable";
    if (activeRevisionChanged) status = "activation_conflict";
    else if (versionChanges.length) status = "rules_changed";
    return {
      ok: true,
      value: {
        state,
        status,
        versionChanges,
        activeRevisionChanged,
        savedPreviewPreserved: state.result !== null,
        pinnedPreviewExecutable: state.result !== null && config.pinnedVersionsExecutable === true,
      },
    };
  }

  function updateTimestamp(state, now) {
    assertState(state);
    if (!validIsoTimestamp(now)) throw new TypeError("Invalid update timestamp");
    if (validIsoTimestamp(state.updatedAt) && Date.parse(now) < Date.parse(state.updatedAt)) {
      throw new RangeError("Update timestamp cannot move backwards");
    }
    return { ...clone(state), updatedAt: now };
  }

  function startOver(options) {
    return {
      state: createState(options),
      effects: Object.freeze({ deleteSetupDraft: true }),
    };
  }

  function activationReadiness(state, options) {
    assertState(state);
    const config = isPlainObject(options) ? options : {};
    if (!Number.isInteger(config.liveActiveProgramRevision) || config.liveActiveProgramRevision < 0) {
      return { ok: false, code: "live_revision_required" };
    }
    if (config.liveActiveProgramRevision !== state.activeProgramRevisionAtStart) {
      return { ok: false, code: "active_program_changed", state: { ...clone(state), step: "activation_conflict" } };
    }
    if (state.step !== "preview" || state.result === null) return { ok: false, code: "preview_not_ready" };
    const versionChanges = changedVersions(state.versions, config.currentVersions || state.versions);
    if (versionChanges.length && config.pinnedVersionsExecutable !== true) {
      return { ok: false, code: "rules_changed_rebuild_required", versionChanges };
    }
    return {
      ok: true,
      pinned: versionChanges.length > 0,
      versionChanges,
      activeProgramRevisionAtStart: state.activeProgramRevisionAtStart,
    };
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    CONTEXT_SCHEMA_VERSION,
    MAX_CONTEXT_BYTES,
    MAX_DRAFT_BYTES,
    ROUTES,
    ROUTE_STEPS,
    createState,
    selectRoute,
    setAnswers,
    setResult,
    normalizeProgrammingContext,
    normalizeSetupDraft,
    migrateLegacyAnswers,
    validationIssues,
    advance,
    back,
    resumeSetupDraft,
    updateTimestamp,
    startOver,
    activationReadiness,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEntry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
