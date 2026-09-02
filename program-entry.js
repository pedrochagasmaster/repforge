(function (root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CONTEXT_SCHEMA_VERSION = 1;
  const MAX_CONTEXT_BYTES = 16384;
  const MAX_DRAFT_BYTES = 65536;
  const MAX_DRAFT_ENVELOPE_BYTES = MAX_DRAFT_BYTES + 1024;
  const MAX_STRUCTURE_DEPTH = 12;
  const MAX_STRUCTURE_NODES = 2048;
  const MAX_TOKEN_LENGTH = 96;
  const MAX_PROGRAM_NAME_LENGTH = 80;
  const MAX_LIST_LENGTH = 32;
  const MAX_MUSCLE_CONTROLS = 10;
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  // These closed entry-domain vocabularies belong to the pure contract. The
  // production adapter consumes them; keeping ownership here preserves the
  // dependency-free direction of this module.
  const KNOWN_EQUIPMENT = Object.freeze(["barbell", "dumbbell", "machine", "cable", "smith", "bodyweight", "band"]);
  const KNOWN_CAPABILITIES = Object.freeze(["safe_pull", "training_support"]);
  const ENTRY_MUSCLES = Object.freeze(["chest", "back", "quads", "hamstrings", "glutes", "side_delts", "biceps", "triceps", "calves", "lats"]);
  const ENTRY_MOVEMENTS = Object.freeze(["squat", "hinge", "press", "row", "pulldown"]);
  const KNOWN_EQUIPMENT_SET = new Set(KNOWN_EQUIPMENT);
  const KNOWN_CAPABILITIES_SET = new Set(KNOWN_CAPABILITIES);
  const ENTRY_MUSCLES_SET = new Set(ENTRY_MUSCLES);
  const ENTRY_MOVEMENTS_SET = new Set(ENTRY_MOVEMENTS);
  const DESIRED_RESULTS = new Set(["muscle_growth", "balanced", "strength"]);
  const STRUCTURED_EXPERIENCE = new Set(["first", "under_6m", "6_to_24m", "over_24m"]);
  const RECENT_CONSISTENCY = new Set(["most", "about_half", "few", "none"]);
  const SESSION_MINUTES = new Set([30, 45, 60, 75, 90]);
  const PREFERRED_REST_SECONDS = new Set([null, 60, 90, 120, 180]);
  const ENTRY_ENVIRONMENTS = Object.freeze(["commercial_gym", "basic_gym", "limited_home", "full_home", "other"]);
  const ENVIRONMENTS = new Set(ENTRY_ENVIRONMENTS);
  const CONSTRAINT_REASONS = Object.freeze(["dislike", "pain", "equipment", "other"]);
  const VERSION_KEYS = Object.freeze([
    "compiler",
    "family",
    "blueprint",
    "catalogue",
    "rules",
    "context",
    "progression",
    "recentConsistency",
    "simpleStart",
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
      "exercise_preferences",
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
  // Reusable context is deliberately narrower than the answer schema. These
  // are the fields each route actually renders and asks the user to review;
  // anything else must not influence a route's compiler input implicitly.
  const ROUTE_PREFILL_KEYS = Object.freeze({
    recommend: Object.freeze([...SHARED_GENERATOR_KEYS]),
    custom: Object.freeze([...SHARED_GENERATOR_KEYS, "deEmphasizedMuscles", "ignoredMuscles"]),
    browse: Object.freeze([...BROWSE_CONTEXT_KEYS]),
    build: Object.freeze([]),
    import: Object.freeze([]),
    shared: Object.freeze([]),
  });

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

  function normalizeVocabularyList(value, path, issues, maxLength, vocabularySet, label) {
    const tokens = normalizeTokenList(value, path, issues, maxLength);
    return tokens.filter((token) => {
      if (!vocabularySet.has(token)) {
        issues.push(`${path}:unknown_${label}`);
        return false;
      }
      return true;
    });
  }

  function normalizeMuscleList(value, path, issues, maxLength) {
    return normalizeVocabularyList(value, path, issues, maxLength, ENTRY_MUSCLES_SET, "muscle");
  }

  function normalizeMovementList(value, path, issues, maxLength) {
    return normalizeVocabularyList(value, path, issues, maxLength, ENTRY_MOVEMENTS_SET, "movement");
  }

  function normalizeStrategyList(value, path, issues, maxLength) {
    if (!Array.isArray(value) || value.length > maxLength) { issues.push(`${path}:invalid_list`); return []; }
    const output = [];
    const seen = new Set();
    for (const token of value) {
      if (typeof token !== "string" || token.length < 1 || token.length > MAX_TOKEN_LENGTH || !/^[a-z0-9][a-z0-9_.:@-]*$/.test(token)) {
        issues.push(`${path}:invalid_token`); continue;
      }
      if (seen.has(token)) { issues.push(`${path}:duplicate`); continue; }
      seen.add(token); output.push(token);
    }
    return output;
  }

  function normalizeEnvironment(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:required`);
      return {};
    }
    rejectUnknownKeys(value, new Set(["kind", "capabilities", "equipment"]), path, issues);
    if (!ENVIRONMENTS.has(value.kind)) issues.push(`${path}.kind:invalid`);
    const output = { kind: value.kind };
    if (hasOwn(value, "capabilities")) {
      const caps = normalizeTokenList(value.capabilities, `${path}.capabilities`, issues, MAX_LIST_LENGTH);
      output.capabilities = caps.filter((token) => {
        if (!KNOWN_CAPABILITIES_SET.has(token)) {
          issues.push(`${path}.capabilities:unknown_capability`);
          return false;
        }
        return true;
      });
    }
    if (hasOwn(value, "equipment")) {
      const equipment = normalizeTokenList(value.equipment, `${path}.equipment`, issues, MAX_LIST_LENGTH);
      output.equipment = equipment.filter((token) => {
        if (!KNOWN_EQUIPMENT_SET.has(token)) {
          issues.push(`${path}.equipment:unknown_equipment`);
          return false;
        }
        return true;
      });
    }
    return output;
  }

  function musclePartitionIssues(answers, pathPrefix) {
    const issues = [];
    const primary = answers.primaryMuscles || [];
    const deemphasized = answers.deEmphasizedMuscles || [];
    const ignored = answers.ignoredMuscles || [];
    const movements = answers.priorityMovements || [];
    if (primary.length > 2) issues.push(`${pathPrefix}.primaryMuscles:too_many`);
    if (movements.length > 2) issues.push(`${pathPrefix}.priorityMovements:too_many`);
    if (deemphasized.length > MAX_MUSCLE_CONTROLS) issues.push(`${pathPrefix}.deEmphasizedMuscles:too_many`);
    if (ignored.length > MAX_MUSCLE_CONTROLS) issues.push(`${pathPrefix}.ignoredMuscles:too_many`);
    const primarySet = new Set(primary);
    const deemphSet = new Set(deemphasized);
    const ignoredSet = new Set(ignored);
    for (const muscle of primarySet) {
      if (deemphSet.has(muscle)) issues.push(`${pathPrefix}.muscles:primary_deemphasized_overlap`);
      if (ignoredSet.has(muscle)) issues.push(`${pathPrefix}.muscles:primary_ignored_overlap`);
    }
    for (const muscle of deemphSet) {
      if (ignoredSet.has(muscle)) issues.push(`${pathPrefix}.muscles:deemphasized_ignored_overlap`);
    }
    return issues;
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
      if (!validToken(item.exerciseId) || !CONSTRAINT_REASONS.includes(item.reason)) {
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
      primaryMuscles: normalizeMuscleList(raw.primaryMuscles, "$.primaryMuscles", issues, 2),
      deEmphasizedMuscles: normalizeMuscleList(raw.deEmphasizedMuscles, "$.deEmphasizedMuscles", issues, MAX_MUSCLE_CONTROLS),
      ignoredMuscles: normalizeMuscleList(raw.ignoredMuscles, "$.ignoredMuscles", issues, MAX_MUSCLE_CONTROLS),
      // Programming contexts also accept the compiler's historical movement
      // pattern ids (for example bench_press); the entry answer surface is
      // closed separately below to the pure contract vocabulary.
      priorityMovements: normalizeTokenList(raw.priorityMovements, "$.priorityMovements", issues, 2),
      exerciseConstraints: normalizeConstraints(raw.exerciseConstraints, "$.exerciseConstraints", issues),
      reviewedAt: raw.reviewedAt,
    };
    if (!validIsoTimestamp(raw.reviewedAt)) issues.push("$.reviewedAt:invalid");
    issues.push(...musclePartitionIssues(output, "$"));
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
      deEmphasizedMuscles: MAX_MUSCLE_CONTROLS,
      ignoredMuscles: MAX_MUSCLE_CONTROLS,
      mustHaveExercises: MAX_LIST_LENGTH,
    };
    for (const [key, maximum] of Object.entries(listFields)) {
      if (hasOwn(raw, key)) {
        const vocabularySet = ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles"].includes(key)
          ? ENTRY_MUSCLES_SET : key === "priorityMovements" ? ENTRY_MOVEMENTS_SET : null;
        output[key] = vocabularySet
          ? normalizeVocabularyList(raw[key], `$.answers.${key}`, issues, maximum, vocabularySet,
            key === "priorityMovements" ? "movement" : "muscle")
          : normalizeTokenList(raw[key], `$.answers.${key}`, issues, maximum);
      }
    }
    if (hasOwn(raw, "exerciseConstraints")) {
      output.exerciseConstraints = normalizeConstraints(raw.exerciseConstraints, "$.answers.exerciseConstraints", issues);
    }
    const mustHave = new Set(output.mustHaveExercises || []);
    for (const constraint of output.exerciseConstraints || []) {
      if (mustHave.has(constraint.exerciseId)) issues.push(`$.answers:must_have_avoided:${constraint.exerciseId}`);
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
      // The two policy pins were added after the original draft shape. Keep
      // old, unfinished drafts readable, while any current draft carries and
      // compares both independent policy versions.
      if (!hasOwn(raw, key) && (key === "recentConsistency" || key === "simpleStart")) continue;
      if (!validToken(raw[key])) issues.push(`$.versions.${key}:invalid`);
      else output[key] = raw[key];
    }
    return output;
  }

  const RESULT_KEYS = new Set([
    "schemaVersion", "route", "fingerprint", "answersFingerprint", "name", "namePt", "source", "id",
    "selected", "candidates", "alternative", "diagnostics", "explanation", "preview",
    "telemetry", "serviceVersion",
  ]);
  const RESULT_ROUTE_KEYS = Object.freeze({
    recommend: new Set(["selected", "candidates", "alternative", "diagnostics", "explanation", "telemetry", "serviceVersion"]),
    custom: new Set(["selected", "candidates", "alternative", "diagnostics", "explanation", "telemetry", "serviceVersion"]),
    browse: new Set(["selected", "telemetry"]),
    build: new Set(["selected"]),
    import: new Set(["selected"]),
    shared: new Set(["selected", "telemetry"]),
  });
  const RESULT_COMMON_KEYS = new Set([
    "schemaVersion", "route", "fingerprint", "answersFingerprint", "name", "namePt", "source", "id", "preview",
  ]);

  // Result values are persisted drafts, not an escape hatch for arbitrary
  // compiler objects. These are the fields emitted by the production adapter
  // and by the legacy import/editor paths. Keep the schema deliberately
  // additive so old drafts remain readable while unknown/tampered fields are
  // rejected at the persistence boundary.
  const SELECTED_KEYS = new Set([
    "id", "family", "familyId", "name", "namePt", "daysPerWeek", "blueprintId", "split",
    "complexity", "reentry", "source",
  ]);
  const PREVIEW_KEYS = Object.freeze({
    recommend: new Set(["source", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionIncompatibilities", "days", "limitations", "reductions", "provenance", "primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "customExercises"]),
    custom: new Set(["source", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionIncompatibilities", "days", "limitations", "reductions", "provenance", "primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "customExercises"]),
    browse: new Set(["source", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionIncompatibilities", "days", "limitations", "reductions", "provenance", "primaryMuscles"]),
    build: new Set(["source", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionIncompatibilities", "days", "primaryMuscles", "customExercises"]),
    import: new Set(["source", "format", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionModifiers", "progressionIncompatibilities", "days", "customExercises", "primaryMuscles"]),
    shared: new Set(["source", "family", "familyId", "frequency", "blueprintId", "program", "programStructure", "progressionRelations", "progressionIncompatibilities", "days", "customExercises", "primaryMuscles", "sharedMeta", "sharedSettings", "sharedImport"]),
  });
  const PROGRAM_ROW_KEYS = new Set(["id", "slotId", "dayId", "day", "order", "name", "displayName", "libraryId", "movementId", "sets", "min", "max", "primary", "secondary", "notes", "alternates", "targetRirStart", "targetRirEnd", "minSets", "maxSets", "priority", "loadingMode", "loadIncrement", "progression", "progressionIncompatibility", "rest", "rir", "tempo", "progressionType"]);
  const DAY_KEYS = new Set(["id", "dayId", "label", "order", "estimateMinutes", "exercises", "displayNameKey", "nameOverride"]);
  const STRUCTURE_KEYS = new Set(["schemaVersion", "days", "provenance", "weekPrescriptions", "customizedFrom"]);
  // Display names are keyed by the compiler's stable blueprint-day identity.
  // Keep this boundary closed so a compiler label cannot quietly become a new
  // translation key. A future key may pass this syntactic boundary and fall
  // back to its stored contract label until its catalog copy is available.
  const DAY_DISPLAY_NAME_KEY_RE = /^program\.day\.[a-z0-9][a-z0-9_]*_d[1-9][0-9]*$/;
  const PROVENANCE_KEYS = new Set(["source", "familyId", "blueprintId", "blueprintVersion", "compilerVersion", "catalogueVersion", "rulesVersion", "contextVersion", "profileId", "recentConsistencyVersion"]);
  const INCOMPATIBILITY_KEYS = new Set(["kind", "value", "version", "source", "reason"]);
  const PROGRESSION_KEYS = new Set(["schemaVersion", "strategy", "modifiers"]);
  const STRATEGY_KEYS = new Set(["id", "version", "params"]);
  // Executable modifiers are deliberately closed. Forward-compatible data is
  // carried by the opaque progressionIncompatibility.value envelope instead.
  const MODIFIER_KEYS = new Set(["id", "version", "compatibleStrategies", "weekNumber", "target", "params"]);
  const RELATION_KEYS = new Set(["schemaVersion", "id", "type", "version", "movementId", "members"]);
  const MEMBER_KEYS = new Set(["exerciseId", "role"]);
  const CUSTOM_EXERCISE_KEYS = new Set(["id", "name", "namePt", "equipment", "primary", "secondary", "notes", "archived", "patterns", "beginnerFriendly", "custom", "created"]);
  const SHARED_SETTINGS_KEYS = new Set(["jumpPct", "minJump", "rirHigh", "hardRir", "restSec", "unit", "lang", "rirMode"]);
  const SHARED_META_KEYS = new Set(["name", "goal", "experience", "daysPerWeek", "splitType", "equipment", "priorityMuscles", "sessionLength", "mesocycleLengthWeeks"]);

  function optionalString(value, path, issues, maxLength = MAX_PROGRAM_NAME_LENGTH) {
    if (value !== undefined && value !== null && (typeof value !== "string" || value.length > maxLength)) {
      issues.push(`${path}:invalid`);
    }
  }

  function validateDayMetadata(value, path, issues) {
    if (hasOwn(value, "displayNameKey") &&
      (typeof value.displayNameKey !== "string" || !DAY_DISPLAY_NAME_KEY_RE.test(value.displayNameKey))) {
      issues.push(`${path}.displayNameKey:invalid`);
    }
    if (hasOwn(value, "nameOverride")) optionalString(value.nameOverride, `${path}.nameOverride`, issues, 200);
  }

  function validateSelected(value, path, issues) {
    if (!isPlainObject(value)) {
      issues.push(`${path}:not_object`);
      return;
    }
    rejectUnknownKeys(value, SELECTED_KEYS, path, issues);
    if (!validToken(value.id)) issues.push(`${path}.id:invalid`);
    for (const key of ["family", "familyId", "blueprintId", "split", "complexity", "reentry", "source"]) {
      if (hasOwn(value, key) && !validToken(value[key])) issues.push(`${path}.${key}:invalid`);
    }
    for (const key of ["name", "namePt"]) if (hasOwn(value, key)) optionalString(value[key], `${path}.${key}`, issues);
    if (hasOwn(value, "daysPerWeek") && (!Number.isInteger(value.daysPerWeek) || value.daysPerWeek < 2 || value.daysPerWeek > 6)) {
      issues.push(`${path}.daysPerWeek:invalid`);
    }
  }

  function validateProgression(value, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}:not_object`); return; }
    rejectUnknownKeys(value, PROGRESSION_KEYS, path, issues);
    if (value.schemaVersion !== undefined && value.schemaVersion !== 1) issues.push(`${path}.schemaVersion:unsupported`);
    if (!isPlainObject(value.strategy)) issues.push(`${path}.strategy:required`);
    else {
      rejectUnknownKeys(value.strategy, STRATEGY_KEYS, `${path}.strategy`, issues);
      if (!validToken(value.strategy.id)) issues.push(`${path}.strategy.id:invalid`);
      if (!Number.isInteger(value.strategy.version) || value.strategy.version < 1) issues.push(`${path}.strategy.version:invalid`);
      if (!isPlainObject(value.strategy.params)) issues.push(`${path}.strategy.params:invalid`);
      else if (inspectJson(value.strategy.params, MAX_CONTEXT_BYTES).length) issues.push(`${path}.strategy.params:invalid`);
    }
    if (!Array.isArray(value.modifiers)) issues.push(`${path}.modifiers:required`);
    else if (value.modifiers.length > MAX_LIST_LENGTH) issues.push(`${path}.modifiers:too_many`);
    else value.modifiers.forEach((modifier, index) => {
      const modifierPath = `${path}.modifiers[${index}]`;
      if (!isPlainObject(modifier)) { issues.push(`${modifierPath}:not_object`); return; }
      rejectUnknownKeys(modifier, MODIFIER_KEYS, modifierPath, issues);
      if (!validToken(modifier.id)) issues.push(`${modifierPath}.id:invalid`);
      if (modifier.version !== undefined && (!Number.isInteger(modifier.version) || modifier.version < 1)) issues.push(`${modifierPath}.version:invalid`);
      if (modifier.compatibleStrategies !== undefined) normalizeStrategyList(modifier.compatibleStrategies, `${modifierPath}.compatibleStrategies`, issues, MAX_LIST_LENGTH);
      if (modifier.weekNumber !== undefined && (!Number.isInteger(modifier.weekNumber) || modifier.weekNumber < 1)) issues.push(`${modifierPath}.weekNumber:invalid`);
      if (modifier.target !== undefined && !validToken(modifier.target)) issues.push(`${modifierPath}.target:invalid`);
      if (modifier.params !== undefined && !isPlainObject(modifier.params)) issues.push(`${modifierPath}.params:invalid`);
    });
  }

  function validateStructure(value, path, issues) {
    if (value === null) return;
    if (!isPlainObject(value)) { issues.push(`${path}:not_object`); return; }
    rejectUnknownKeys(value, STRUCTURE_KEYS, path, issues);
    if (value.schemaVersion !== undefined && value.schemaVersion !== 1) issues.push(`${path}.schemaVersion:unsupported`);
    if (!Array.isArray(value.days)) issues.push(`${path}.days:required`);
    else value.days.forEach((day, index) => {
      const dayPath = `${path}.days[${index}]`;
      if (!isPlainObject(day)) { issues.push(`${dayPath}:not_object`); return; }
      rejectUnknownKeys(day, new Set(["dayId", "label", "order", "displayNameKey", "nameOverride"]), dayPath, issues);
      if (!validToken(day.dayId)) issues.push(`${dayPath}.dayId:invalid`);
      if (typeof day.label !== "string") issues.push(`${dayPath}.label:invalid`);
      if (!Number.isInteger(day.order)) issues.push(`${dayPath}.order:invalid`);
      validateDayMetadata(day, dayPath, issues);
    });
    if (value.provenance !== undefined) {
      if (!isPlainObject(value.provenance)) issues.push(`${path}.provenance:invalid`);
      else rejectUnknownKeys(value.provenance, PROVENANCE_KEYS, `${path}.provenance`, issues);
    }
    if (value.weekPrescriptions !== undefined) {
      if (!Array.isArray(value.weekPrescriptions)) issues.push(`${path}.weekPrescriptions:invalid`);
      else value.weekPrescriptions.forEach((prescription, index) => {
        const prescriptionPath = `${path}.weekPrescriptions[${index}]`;
        if (!isPlainObject(prescription)) { issues.push(`${prescriptionPath}:not_object`); return; }
        rejectUnknownKeys(prescription, new Set(["week", "days", "phase"]), prescriptionPath, issues);
        if (prescription.week !== undefined && (!Number.isInteger(prescription.week) || prescription.week < 1)) issues.push(`${prescriptionPath}.week:invalid`);
        if (prescription.phase !== undefined && !validToken(prescription.phase)) issues.push(`${prescriptionPath}.phase:invalid`);
        if (prescription.days !== undefined) {
          if (!Array.isArray(prescription.days)) issues.push(`${prescriptionPath}.days:invalid`);
          else prescription.days.forEach((day, dayIndex) => {
            const dayPath = `${prescriptionPath}.days[${dayIndex}]`;
            if (!isPlainObject(day)) { issues.push(`${dayPath}:not_object`); return; }
            rejectUnknownKeys(day, new Set(["dayId", "slots"]), dayPath, issues);
            if (!validToken(day.dayId)) issues.push(`${dayPath}.dayId:invalid`);
            if (!Array.isArray(day.slots)) issues.push(`${dayPath}.slots:invalid`);
            else day.slots.forEach((slot, slotIndex) => {
              const slotPath = `${dayPath}.slots[${slotIndex}]`;
              if (!isPlainObject(slot)) { issues.push(`${slotPath}:not_object`); return; }
              rejectUnknownKeys(slot, new Set(["slotId", "sets"]), slotPath, issues);
              if (!validToken(slot.slotId) || !Number.isInteger(slot.sets)) issues.push(`${slotPath}:invalid`);
            });
          });
        }
      });
    }
  }

  function validateCustomExercises(value, path, issues) {
    if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) { issues.push(`${path}:invalid`); return; }
    value.forEach((item, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isPlainObject(item)) { issues.push(`${itemPath}:not_object`); return; }
      rejectUnknownKeys(item, CUSTOM_EXERCISE_KEYS, itemPath, issues);
      if (!validToken(item.id)) issues.push(`${itemPath}.id:invalid`);
      for (const key of ["name", "namePt", "primary", "secondary", "notes"]) if (item[key] !== undefined) optionalString(item[key], `${itemPath}.${key}`, issues, key === "notes" ? MAX_DRAFT_BYTES : 256);
      if (item.equipment !== undefined) normalizeTokenList(item.equipment, `${itemPath}.equipment`, issues, MAX_LIST_LENGTH);
      if (item.archived !== undefined && typeof item.archived !== "boolean") issues.push(`${itemPath}.archived:invalid`);
      if (item.beginnerFriendly !== undefined && typeof item.beginnerFriendly !== "boolean") issues.push(`${itemPath}.beginnerFriendly:invalid`);
      if (item.custom !== undefined && typeof item.custom !== "boolean") issues.push(`${itemPath}.custom:invalid`);
      if (item.created !== undefined) optionalString(item.created, `${itemPath}.created`, issues, 64);
      if (item.patterns !== undefined && !Array.isArray(item.patterns)) issues.push(`${itemPath}.patterns:invalid`);
    });
  }

  function validateRelations(value, path, issues) {
    if (!Array.isArray(value) || value.length > MAX_LIST_LENGTH) { issues.push(`${path}:invalid`); return; }
    value.forEach((relation, index) => {
      const relationPath = `${path}[${index}]`;
      if (!isPlainObject(relation)) { issues.push(`${relationPath}:not_object`); return; }
      rejectUnknownKeys(relation, RELATION_KEYS, relationPath, issues);
      for (const key of ["id", "type", "movementId"]) if (relation[key] !== undefined && !validToken(relation[key])) issues.push(`${relationPath}.${key}:invalid`);
      if (!Array.isArray(relation.members)) issues.push(`${relationPath}.members:required`);
      else relation.members.forEach((member, memberIndex) => {
        const memberPath = `${relationPath}.members[${memberIndex}]`;
        if (!isPlainObject(member)) { issues.push(`${memberPath}:not_object`); return; }
        rejectUnknownKeys(member, MEMBER_KEYS, memberPath, issues);
        if (!validToken(member.exerciseId) || !validToken(member.role)) issues.push(`${memberPath}:invalid`);
      });
    });
  }

  function validateProgressionIncompatibility(value, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}:invalid`); return; }
    rejectUnknownKeys(value, INCOMPATIBILITY_KEYS, path, issues);
    if (value.kind !== undefined && !validToken(value.kind)) issues.push(`${path}.kind:invalid`);
    if (value.version !== undefined && !validToken(String(value.version))) issues.push(`${path}.version:invalid`);
    if (value.source !== undefined && !validToken(value.source)) issues.push(`${path}.source:invalid`);
    if (value.reason !== undefined) optionalString(value.reason, `${path}.reason`, issues, 512);
    if (value.value !== undefined &&
      ((!isPlainObject(value.value) && !Array.isArray(value.value)) || inspectJson(value.value, MAX_CONTEXT_BYTES).length)) {
      issues.push(`${path}.value:invalid`);
    }
  }

  function validateFacts(value, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}:not_object`); return; }
    rejectUnknownKeys(value, new Set(["desiredResult", "structuredExperience", "recentConsistency", "daysPerWeek", "sessionMinutes", "mainConstraint", "familyId", "diagnostics"]), path, issues);
    for (const key of ["desiredResult", "structuredExperience", "recentConsistency", "mainConstraint", "familyId"]) if (value[key] !== undefined && value[key] !== null && !validToken(value[key])) issues.push(`${path}.${key}:invalid`);
    for (const key of ["daysPerWeek", "sessionMinutes"]) if (value[key] !== undefined && value[key] !== null && !Number.isInteger(value[key])) issues.push(`${path}.${key}:invalid`);
    if (value.diagnostics !== undefined && value.diagnostics !== null) {
      if (!isPlainObject(value.diagnostics)) issues.push(`${path}.diagnostics:invalid`);
      else {
        rejectUnknownKeys(value.diagnostics, new Set(["limitations", "reductions"]), `${path}.diagnostics`, issues);
        for (const key of ["limitations", "reductions"]) if (value.diagnostics[key] !== undefined && !Array.isArray(value.diagnostics[key])) issues.push(`${path}.diagnostics.${key}:invalid`);
      }
    }
  }

  function validateProgramRow(value, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}:not_object`); return; }
    rejectUnknownKeys(value, PROGRAM_ROW_KEYS, path, issues);
    for (const key of ["id", "slotId", "dayId", "libraryId", "movementId", "priority", "loadingMode", "progressionType"]) {
      if (hasOwn(value, key)) optionalString(value[key], `${path}.${key}`, issues, MAX_TOKEN_LENGTH);
    }
    for (const key of ["day", "primary", "secondary", "rest", "rir", "tempo"]) {
      if (hasOwn(value, key)) optionalString(value[key], `${path}.${key}`, issues, 512);
    }
    for (const key of ["name", "displayName"]) if (hasOwn(value, key)) optionalString(value[key], `${path}.${key}`, issues, 256);
    if (hasOwn(value, "notes")) optionalString(value.notes, `${path}.notes`, issues, MAX_DRAFT_BYTES);
    for (const key of ["order", "sets", "min", "max", "targetRirStart", "targetRirEnd", "minSets", "maxSets", "loadIncrement"]) {
      if (hasOwn(value, key) && (typeof value[key] !== "number" || !Number.isFinite(value[key]))) issues.push(`${path}.${key}:invalid`);
    }
    if (hasOwn(value, "alternates") && !Array.isArray(value.alternates)) issues.push(`${path}.alternates:invalid`);
    if (hasOwn(value, "progression")) validateProgression(value.progression, `${path}.progression`, issues);
    if (hasOwn(value, "progressionIncompatibility")) validateProgressionIncompatibility(value.progressionIncompatibility, `${path}.progressionIncompatibility`, issues);
  }

  function validatePreview(value, route, path, issues) {
    if (!isPlainObject(value)) { issues.push(`${path}:not_object`); return; }
    rejectUnknownKeys(value, PREVIEW_KEYS[route] || PREVIEW_KEYS.recommend, path, issues);
    for (const key of ["source", "family", "familyId", "blueprintId", "format"]) if (hasOwn(value, key)) optionalString(value[key], `${path}.${key}`, issues);
    if (hasOwn(value, "frequency") && (!Number.isInteger(value.frequency) || value.frequency < 1 || value.frequency > 7)) issues.push(`${path}.frequency:invalid`);
    if (hasOwn(value, "program")) {
      if (!Array.isArray(value.program) || value.program.length > MAX_LIST_LENGTH * 16) issues.push(`${path}.program:invalid`);
      else value.program.forEach((row, index) => validateProgramRow(row, `${path}.program[${index}]`, issues));
    }
    if (hasOwn(value, "days")) {
      if (!Array.isArray(value.days) || value.days.length > 7) issues.push(`${path}.days:invalid`);
      else value.days.forEach((day, index) => {
        const dayPath = `${path}.days[${index}]`;
        if (!isPlainObject(day)) { issues.push(`${dayPath}:not_object`); return; }
        rejectUnknownKeys(day, DAY_KEYS, dayPath, issues);
        for (const key of ["id", "dayId", "label"]) if (hasOwn(day, key)) optionalString(day[key], `${dayPath}.${key}`, issues);
        validateDayMetadata(day, dayPath, issues);
        if (hasOwn(day, "order") && !Number.isInteger(day.order)) issues.push(`${dayPath}.order:invalid`);
        if (hasOwn(day, "estimateMinutes") && (!Number.isInteger(day.estimateMinutes) || day.estimateMinutes < 0)) issues.push(`${dayPath}.estimateMinutes:invalid`);
        if (hasOwn(day, "exercises")) {
          if (!Array.isArray(day.exercises)) issues.push(`${dayPath}.exercises:invalid`);
          else day.exercises.forEach((row, rowIndex) => validateProgramRow(row, `${dayPath}.exercises[${rowIndex}]`, issues));
        }
      });
    }
    for (const key of ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles"]) {
      if (hasOwn(value, key)) normalizeMuscleList(value[key], `${path}.${key}`, issues, MAX_MUSCLE_CONTROLS);
    }
    for (const key of ["limitations", "reductions"]) if (hasOwn(value, key) && !Array.isArray(value[key])) issues.push(`${path}.${key}:invalid`);
    if (hasOwn(value, "customExercises")) validateCustomExercises(value.customExercises, `${path}.customExercises`, issues);
    if (hasOwn(value, "progressionRelations")) validateRelations(value.progressionRelations, `${path}.progressionRelations`, issues);
    if (hasOwn(value, "progressionModifiers")) {
      if (!Array.isArray(value.progressionModifiers) || value.progressionModifiers.length > MAX_LIST_LENGTH) issues.push(`${path}.progressionModifiers:invalid`);
      else value.progressionModifiers.forEach((modifier, index) => validateProgression({ schemaVersion: 1, strategy: { id: "preview", version: 1, params: {} }, modifiers: [modifier] }, `${path}.progressionModifiers[${index}]`, issues));
    }
    if (hasOwn(value, "progressionIncompatibilities")) {
      if (!Array.isArray(value.progressionIncompatibilities) || value.progressionIncompatibilities.length > MAX_LIST_LENGTH) issues.push(`${path}.progressionIncompatibilities:invalid`);
      else value.progressionIncompatibilities.forEach((item, index) => validateProgressionIncompatibility(item, `${path}.progressionIncompatibilities[${index}]`, issues));
    }
    if (hasOwn(value, "programStructure")) {
      validateStructure(value.programStructure, `${path}.programStructure`, issues);
    }
    if (hasOwn(value, "provenance")) {
      if (!isPlainObject(value.provenance)) issues.push(`${path}.provenance:invalid`);
      else rejectUnknownKeys(value.provenance, PROVENANCE_KEYS, `${path}.provenance`, issues);
    }
    if (hasOwn(value, "sharedMeta")) {
      if (!isPlainObject(value.sharedMeta)) issues.push(`${path}.sharedMeta:invalid`);
      else {
        rejectUnknownKeys(value.sharedMeta, SHARED_META_KEYS, `${path}.sharedMeta`, issues);
        if (value.sharedMeta.name !== undefined) optionalString(value.sharedMeta.name, `${path}.sharedMeta.name`, issues, 100);
        if (value.sharedMeta.daysPerWeek !== undefined && (!Number.isInteger(value.sharedMeta.daysPerWeek) || value.sharedMeta.daysPerWeek < 1 || value.sharedMeta.daysPerWeek > 7)) issues.push(`${path}.sharedMeta.daysPerWeek:invalid`);
        if (value.sharedMeta.equipment !== undefined) normalizeTokenList(value.sharedMeta.equipment, `${path}.sharedMeta.equipment`, issues, MAX_LIST_LENGTH);
        if (value.sharedMeta.priorityMuscles !== undefined && !Array.isArray(value.sharedMeta.priorityMuscles)) issues.push(`${path}.sharedMeta.priorityMuscles:invalid`);
      }
    }
    if (hasOwn(value, "sharedSettings")) {
      if (!isPlainObject(value.sharedSettings)) issues.push(`${path}.sharedSettings:invalid`);
      else {
        rejectUnknownKeys(value.sharedSettings, SHARED_SETTINGS_KEYS, `${path}.sharedSettings`, issues);
        if (value.sharedSettings.lang !== undefined && !["en", "pt"].includes(value.sharedSettings.lang)) issues.push(`${path}.sharedSettings.lang:invalid`);
        if (value.sharedSettings.unit !== undefined && !["kg", "lb"].includes(value.sharedSettings.unit)) issues.push(`${path}.sharedSettings.unit:invalid`);
        if (value.sharedSettings.rirMode !== undefined && !["numeric", "effort"].includes(value.sharedSettings.rirMode)) issues.push(`${path}.sharedSettings.rirMode:invalid`);
        for (const key of ["jumpPct", "minJump", "rirHigh", "hardRir", "restSec"]) if (value.sharedSettings[key] !== undefined && (typeof value.sharedSettings[key] !== "number" || !Number.isFinite(value.sharedSettings[key]))) issues.push(`${path}.sharedSettings.${key}:invalid`);
      }
    }
    if (hasOwn(value, "sharedImport")) {
      if (value.sharedImport !== null && !isPlainObject(value.sharedImport)) issues.push(`${path}.sharedImport:invalid`);
      else if (isPlainObject(value.sharedImport)) {
        rejectUnknownKeys(value.sharedImport, new Set(["definitions", "remap"]), `${path}.sharedImport`, issues);
        if (value.sharedImport.definitions !== undefined) validateCustomExercises(value.sharedImport.definitions, `${path}.sharedImport.definitions`, issues);
        if (value.sharedImport.remap !== undefined) {
          const remapPath = `${path}.sharedImport.remap`;
          if (!isPlainObject(value.sharedImport.remap) || Object.keys(value.sharedImport.remap).length > MAX_LIST_LENGTH) issues.push(`${remapPath}:invalid`);
          else for (const [from, to] of Object.entries(value.sharedImport.remap)) {
            if (!validToken(from) || !validToken(to)) issues.push(`${remapPath}:invalid_token`);
          }
        }
      }
    }
  }

  function answerFingerprint(answers) {
    const text = stableStringify(answers || {});
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `ans-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function stableStringify(value) {
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function normalizeResult(raw, route, answers, issues, persisted) {
    if (!isPlainObject(raw)) {
      issues.push("$.result:not_object");
      return null;
    }
    // Result envelopes predate the route/schema binding. They are safe to
    // migrate only when all new binding fields are absent; the saved preview
    // remains intact and receives a binding to the normalized answer set.
    const legacy = persisted && !hasOwn(raw, "schemaVersion") && !hasOwn(raw, "route") && !hasOwn(raw, "answersFingerprint");
    const candidate = legacy
      ? { ...clone(raw), schemaVersion: SCHEMA_VERSION, route, answersFingerprint: answerFingerprint(answers) }
      : raw;
    if (persisted) {
      const routeKeys = RESULT_ROUTE_KEYS[route] || new Set();
      for (const key of Object.keys(candidate)) {
        if (!RESULT_KEYS.has(key)) issues.push(`$.result.${key}:unknown_key`);
        else if (!RESULT_COMMON_KEYS.has(key) && !routeKeys.has(key)) issues.push(`$.result.${key}:not_allowed_for_route`);
      }
      if (candidate.schemaVersion !== SCHEMA_VERSION) issues.push("$.result.schemaVersion:unsupported");
      if (candidate.route !== route) issues.push("$.result.route:mismatch");
      if (!validToken(candidate.fingerprint)) issues.push("$.result.fingerprint:invalid");
      if (candidate.answersFingerprint !== answerFingerprint(answers)) issues.push("$.result.answersFingerprint:mismatch");
      if (!isPlainObject(candidate.preview)) issues.push("$.result.preview:required");
      else validatePreview(candidate.preview, route, "$.result.preview", issues);
      if (hasOwn(candidate, "selected")) validateSelected(candidate.selected, "$.result.selected", issues);
      if (hasOwn(candidate, "alternative") && candidate.alternative !== null) {
        validateSelected(candidate.alternative, "$.result.alternative", issues);
      }
      if (hasOwn(candidate, "candidates")) {
        if (!Array.isArray(candidate.candidates) || candidate.candidates.length > MAX_LIST_LENGTH) {
          issues.push("$.result.candidates:invalid");
        } else candidate.candidates.forEach((item, index) => validateSelected(item, `$.result.candidates[${index}]`, issues));
      }
      for (const key of ["name", "namePt", "source", "id", "serviceVersion"]) {
        if (hasOwn(candidate, key) && (key === "name" || key === "namePt")) optionalString(candidate[key], `$.result.${key}`, issues);
        else if (hasOwn(candidate, key) && !validToken(candidate[key])) issues.push(`$.result.${key}:invalid`);
      }
      if (hasOwn(candidate, "telemetry")) {
        if (!isPlainObject(candidate.telemetry)) issues.push("$.result.telemetry:not_object");
        else {
          rejectUnknownKeys(candidate.telemetry, new Set(["goal", "frequency", "family", "completed"]), "$.result.telemetry", issues);
          if (hasOwn(candidate.telemetry, "goal") && !validToken(candidate.telemetry.goal)) issues.push("$.result.telemetry.goal:invalid");
          if (hasOwn(candidate.telemetry, "frequency") && !validToken(String(candidate.telemetry.frequency))) issues.push("$.result.telemetry.frequency:invalid");
          if (hasOwn(candidate.telemetry, "family") && !validToken(candidate.telemetry.family)) issues.push("$.result.telemetry.family:invalid");
          if (hasOwn(candidate.telemetry, "completed") && typeof candidate.telemetry.completed !== "boolean") issues.push("$.result.telemetry.completed:invalid");
        }
      }
      if (hasOwn(candidate, "diagnostics")) validateFacts(candidate.diagnostics, "$.result.diagnostics", issues);
      if (hasOwn(candidate, "explanation")) validateFacts(candidate.explanation, "$.result.explanation", issues);
      for (const key of RESULT_ROUTE_KEYS[route] || []) {
        // Recommendation/custom previews historically carried their selected
        // candidate only after the user made a choice. Keep those resumable
        // drafts readable, while every persisted activation route remains
        // closed over an explicit selected entry.
        if (key === "selected" && route !== "recommend" && route !== "custom" && !isPlainObject(candidate.selected)) {
          issues.push("$.result.selected:required");
        }
      }
    }
    return clone(candidate);
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
    issues.push(...musclePartitionIssues(answers, "$.answers"));
    if (!isPlainObject(raw.legacyHints)) issues.push("$.legacyHints:not_object");
    const result = raw.result === null ? null : normalizeResult(raw.result, raw.route, answers, issues, true);
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
      result,
      versions,
      activeProgramRevisionAtStart: raw.activeProgramRevisionAtStart,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
    return schemaResult("setup-draft", issues, output);
  }

  function normalizeSetupDraftEnvelope(input) {
    const parsed = parseBounded(input, MAX_DRAFT_ENVELOPE_BYTES);
    if (!parsed.ok) return schemaResult("setup-draft-envelope", parsed.issues);
    const raw = parsed.value;
    const structural = inspectJson(raw, MAX_DRAFT_ENVELOPE_BYTES);
    if (structural.length) return schemaResult("setup-draft-envelope", structural);
    if (!isPlainObject(raw)) return schemaResult("setup-draft-envelope", ["root:not_object"]);
    const isEnvelope = hasOwn(raw, "state") || hasOwn(raw, "revision") || hasOwn(raw, "ownerId");
    if (!isEnvelope) {
      const legacy = normalizeSetupDraft(raw);
      if (!legacy.ok) return schemaResult("setup-draft-envelope", legacy.issues);
      return {
        ok: true,
        value: {
          envelope: {
            schemaVersion: SCHEMA_VERSION,
            draftId: legacy.value.draftId,
            revision: 0,
            ownerId: null,
            state: legacy.value,
          },
          migrated: true,
        },
      };
    }
    const issues = [];
    rejectUnknownKeys(raw, new Set(["schemaVersion", "draftId", "revision", "ownerId", "state"]), "$", issues);
    if (raw.schemaVersion !== SCHEMA_VERSION) issues.push("$.schemaVersion:unsupported");
    if (typeof raw.draftId !== "string" || raw.draftId.length < 1 || raw.draftId.length > 64) {
      issues.push("$.draftId:invalid");
    }
    if (!Number.isInteger(raw.revision) || raw.revision < 0) issues.push("$.revision:invalid");
    if (raw.ownerId !== null && !validToken(raw.ownerId)) issues.push("$.ownerId:invalid");
    const state = normalizeSetupDraft(raw.state);
    if (!state.ok) issues.push(...state.issues.map((issue) => `$.state:${issue}`));
    else if (state.value.draftId !== raw.draftId) issues.push("$.draftId:state_mismatch");
    return schemaResult("setup-draft-envelope", issues, {
      envelope: {
        schemaVersion: SCHEMA_VERSION,
        draftId: raw.draftId,
        revision: raw.revision,
        ownerId: raw.ownerId,
        state: state.ok ? state.value : null,
      },
      migrated: false,
    });
  }

  function advanceSetupDraftEnvelope(observed, nextState, ownerId) {
    const current = normalizeSetupDraftEnvelope(observed);
    if (!current.ok || current.value.migrated) throw new TypeError("Observed setup draft envelope is invalid");
    const normalized = normalizeSetupDraft(nextState);
    if (!normalized.ok) throw new TypeError("Next setup draft state is invalid");
    if (!validToken(ownerId)) throw new TypeError("Setup draft owner is invalid");
    if (normalized.value.draftId !== current.value.envelope.draftId) {
      throw new TypeError("Setup draft identity cannot change during an update");
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      draftId: normalized.value.draftId,
      revision: current.value.envelope.revision + 1,
      ownerId,
      state: normalized.value,
    };
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
        answers.primaryMuscles = normalizeMuscleList(raw.priorityMuscles, "$.priorityMuscles", [], 2);
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

  function programmingContextAnswers(input) {
    const normalized = normalizeProgrammingContext(input);
    if (!normalized.ok) return {};
    const value = normalized.value;
    return {
      desiredResult: value.desiredResult,
      structuredExperience: value.structuredExperience,
      recentConsistency: value.recentConsistency,
      daysPerWeek: value.availability.daysPerWeek,
      sessionMinutes: value.availability.sessionMinutes,
      preferredRestSeconds: value.availability.preferredRestSeconds,
      environment: value.environment,
      primaryMuscles: value.primaryMuscles,
      deEmphasizedMuscles: value.deEmphasizedMuscles,
      ignoredMuscles: value.ignoredMuscles,
      priorityMovements: value.priorityMovements,
      exerciseConstraints: value.exerciseConstraints,
    };
  }

  function reusableContextAnswers(input, route) {
    if (!ROUTE_SET.has(route)) return {};
    return copyKeys(programmingContextAnswers(input), ROUTE_PREFILL_KEYS[route]);
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

  function selectRoute(state, route, options) {
    assertState(state);
    if (!ROUTE_SET.has(route)) throw new TypeError("Unknown program-entry route");
    const config = isPlainObject(options) ? options : {};
    const carried = route === "browse" && state.route === "browse"
      ? copyKeys(state.answers, [...BROWSE_CONTEXT_KEYS, "catalogueSelection"])
      : compatibleAnswers(state.answers, state.route, route);
    const answers = {
      ...reusableContextAnswers(config.reusableContext, route),
      ...carried,
    };
    return {
      ...clone(state),
      route,
      step: ROUTE_STEPS[route][0],
      answers,
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
    const merged = { ...clone(state.answers), ...normalized };
    const partition = musclePartitionIssues(merged, "$.answers");
    if (partition.length) throw new TypeError(`Invalid answer patch: ${partition.join(",")}`);
    return {
      ...clone(state),
      answers: merged,
      result: null,
    };
  }

  function setResult(state, result) {
    assertState(state);
    if (result === null || result === undefined) throw new TypeError("Result is required");
    const structural = inspectJson(result, MAX_DRAFT_BYTES);
    if (structural.length || !isPlainObject(result)) throw new TypeError("Invalid program-entry result");
    const next = clone(result);
    // Stamp the binding at the pure state boundary. Callers cannot persist a
    // preview produced for a different answer set, and old callers that only
    // supplied a fingerprint remain usable until they are persisted.
    next.schemaVersion = SCHEMA_VERSION;
    next.route = state.route;
    next.answersFingerprint = answerFingerprint(state.answers);
    return { ...clone(state), result: next };
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
      case "priorities": return musclePartitionIssues(answers, "$.answers");
      case "exercise_preferences": return [];
      case "custom_shape": {
        const issues = answers.splitPreference ? [] : ["split_preference_required"];
        issues.push(...musclePartitionIssues(answers, "$.answers"));
        return issues;
      }
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
    // Drafts written before the two policy pins existed have no value to
    // compare. Treat their released baseline as version 1 during migration;
    // a real later pin still reports its own independent drift.
    const legacyDefaults = { recentConsistency: "1", simpleStart: "1" };
    return VERSION_KEYS.filter((key) =>
      (saved[key] ?? legacyDefaults[key]) !== (current[key] ?? legacyDefaults[key]));
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

  function candidateActivationIssues(state) {
    assertState(state);
    const preview = state.result?.preview;
    const program = Array.isArray(preview?.program) ? preview.program : [];
    const issues = [];
    if (Array.isArray(preview?.progressionIncompatibilities) && preview.progressionIncompatibilities.length) {
      issues.push("progression_incompatible:program");
    }
    if (!program.length) issues.push("program_exercises_required");
    for (const exercise of program) {
      if (!exercise || typeof exercise !== "object" || !String(exercise.name || "").trim() ||
        !Number.isInteger(exercise.sets) || exercise.sets < 1 ||
        !Number.isInteger(exercise.min) || exercise.min < 1 ||
        !Number.isInteger(exercise.max) || exercise.max < exercise.min) {
        issues.push(`exercise_invalid:${String(exercise?.id || "unknown")}`);
      }
      if (exercise?.progressionIncompatibility) {
        issues.push(`progression_incompatible:${String(exercise?.id || "unknown")}`);
      }
    }
    if (state.route !== "build") return issues;
    const structureDays = Array.isArray(preview?.programStructure?.days)
      ? preview.programStructure.days
      : [];
    if (!structureDays.length) return ["program_days_required"];
    for (const day of structureDays) {
      const dayId = String(day?.dayId || "");
      const label = String(day?.label || dayId);
      const rows = program.filter((exercise) => exercise?.day === label || exercise?.day === dayId);
      if (!rows.length) issues.push(`day_empty:${dayId || label}`);
    }
    return issues;
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
    if ((state.step !== "preview" && state.step !== "editor") || state.result === null) {
      return { ok: false, code: "preview_not_ready" };
    }
    const candidateIssues = candidateActivationIssues(state);
    if (candidateIssues.length) return { ok: false, code: "candidate_incomplete", issues: candidateIssues };
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
    MAX_DRAFT_ENVELOPE_BYTES,
    MAX_MUSCLE_CONTROLS,
    KNOWN_EQUIPMENT,
    KNOWN_CAPABILITIES,
    ENTRY_MUSCLES,
    ENTRY_MOVEMENTS,
    ENTRY_ENVIRONMENTS,
    CONSTRAINT_REASONS,
    ROUTES,
    ROUTE_STEPS,
    ROUTE_PREFILL_KEYS,
    createState,
    selectRoute,
    setAnswers,
    setResult,
    normalizeProgrammingContext,
    reusableContextAnswers,
    normalizeSetupDraft,
    normalizeSetupDraftEnvelope,
    advanceSetupDraftEnvelope,
    migrateLegacyAnswers,
    validationIssues,
    advance,
    back,
    resumeSetupDraft,
    updateTimestamp,
    startOver,
    candidateActivationIssues,
    activationReadiness,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEntry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
