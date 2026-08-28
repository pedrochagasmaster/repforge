(function (root) {
  const KIND = "taurifer-shared-setup";
  const VERSION = 1;
  const MAX_ENCODED_CHARS = 3072;
  const MAX_COMPRESSED_BYTES = 2301;
  const MAX_DECOMPRESSED_BYTES = 65536;
  const COOKIE_NAME = "repforge_setup_v1";
  const COOKIE_MAX_AGE = 604800;
  const CUSTOM_ID_PREFIX = "custom:";
  const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const MAX_STRUCTURE_DEPTH = 100;
  const MAX_STRUCTURE_NODES = 10000;
  const GOAL_VALUES = ["hypertrophy", "strength_hypertrophy", "beginner_consistency"];
  const EXPERIENCE_VALUES = ["beginner", "intermediate", "advanced"];
  const SPLIT_VALUES = ["full_body", "machine_only", "ppl", "upper_lower", "bro"];
  const SESSION_LENGTH_VALUES = ["short", "normal", "long"];
  const EQUIPMENT_VALUES = ["machines", "cables", "dumbbells", "barbells", "bodyweight"];
  const UNIT_VALUES = ["kg", "lb"];
  const LANG_VALUES = ["en", "pt"];
  const RIR_MODE_VALUES = ["numeric", "effort"];
  const GOALS = new Set(GOAL_VALUES);
  const EXPERIENCES = new Set(EXPERIENCE_VALUES);
  const SPLITS = new Set(SPLIT_VALUES);
  const SESSION_LENGTHS = new Set(SESSION_LENGTH_VALUES);
  const EQUIPMENT = new Set(EQUIPMENT_VALUES);
  const UNITS = new Set(UNIT_VALUES);
  const LANGS = new Set(LANG_VALUES);
  const RIR_MODES = new Set(RIR_MODE_VALUES);
  // v2 is released and immutable. New optional fields belong to v3 only.
  const META_OPTIONAL_BITS = 6;
  const EXERCISE_OPTIONAL_BITS = 9;
  const V3_META_OPTIONAL_BITS = 8;
  const V3_EXERCISE_OPTIONAL_BITS = 12;
  const CUSTOM_OPTIONAL_BITS = 4;
  const BASE64URL_RE = /^[A-Za-z0-9_-]*$/;
  const VERSION_PREFIX_RE = /^v(\d+)\.(.*)$/;

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  function setOwn(target, key, value) {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }

  function codePointCount(value) {
    return [...value].length;
  }

  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function isIntInRange(value, min, max) {
    return isFiniteNumber(value) && Number.isInteger(value) && value >= min && value <= max;
  }

  function isNumberInRange(value, min, max) {
    return isFiniteNumber(value) && value >= min && value <= max;
  }

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function schemaFail(issues) {
    return { ok: false, code: "invalid-schema", issues: issues.slice() };
  }

  function resolveHref(url) {
    if (typeof url === "string" && url) return url;
    if (typeof location !== "undefined" && location && location.href) return location.href;
    return "";
  }

  function adapterDocument(adapters) {
    if (adapters && adapters.document) return adapters.document;
    if (typeof document !== "undefined") return document;
    return null;
  }

  function adapterLocation(adapters) {
    if (adapters && adapters.location) return adapters.location;
    if (typeof location !== "undefined") return location;
    return null;
  }

  function hostnameOf(locationLike) {
    if (locationLike && typeof locationLike.hostname === "string" && locationLike.hostname) {
      return locationLike.hostname;
    }
    try {
      const href = typeof locationLike === "string" ? locationLike : locationLike && locationLike.href;
      return href ? new URL(href).hostname : "";
    } catch {
      return "";
    }
  }

  function isLocalhostHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  }

  function collectForbiddenKeys(value, issues, path) {
    const stack = [{ value, depth: 0 }];
    let visited = 0;
    while (stack.length) {
      const current = stack.pop();
      if (++visited > MAX_STRUCTURE_NODES) {
        issues.push(`${path}: structure too large`);
        return;
      }
      if (current.depth > MAX_STRUCTURE_DEPTH) {
        issues.push(`${path}: structure too deep`);
        return;
      }
      if (!Array.isArray(current.value) && !isPlainObject(current.value)) continue;
      for (const key of Object.keys(current.value)) {
        if (FORBIDDEN_KEYS.has(key)) {
          issues.push(`${path}: forbidden key ${key}`);
          continue;
        }
        stack.push({ value: current.value[key], depth: current.depth + 1 });
      }
    }
  }

  function canonicalize(value) {
    if (value === null) return null;
    const type = typeof value;
    if (type === "string" || type === "boolean") return value;
    if (type === "number") {
      if (!Number.isFinite(value)) throw new TypeError("unsupported type");
      return value;
    }
    if (Array.isArray(value)) return value.map(canonicalize);
    if (type === "object") {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) throw new TypeError("unsupported type");
      const out = {};
      for (const key of Object.keys(value).sort()) {
        const child = value[key];
        if (child === undefined) throw new TypeError("unsupported type");
        setOwn(out, key, canonicalize(child));
      }
      return out;
    }
    throw new TypeError("unsupported type");
  }

  function requireString(raw, key, issues, path, { max, min = 0, trim = false, required = true } = {}) {
    if (!hasOwn(raw, key) || raw[key] == null) {
      if (required) issues.push(`${path}.${key}: required`);
      return undefined;
    }
    if (typeof raw[key] !== "string") {
      issues.push(`${path}.${key}: expected string`);
      return undefined;
    }
    const value = trim ? raw[key].trim() : raw[key];
    if (value.length < min || (trim && min > 0 && !value)) {
      issues.push(`${path}.${key}: empty`);
      return undefined;
    }
    if (codePointCount(value) > max) {
      issues.push(`${path}.${key}: too long`);
      return undefined;
    }
    return value;
  }

  function optionalEnum(raw, key, allowed, issues, path) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (raw[key] === null) return null;
    if (typeof raw[key] !== "string" || !allowed.has(raw[key])) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function uniqueTrimmedStrings(raw, key, issues, path, { maxItems, maxItem, required = false, minItems = 0, allowlist = null }) {
    if (!hasOwn(raw, key) || raw[key] == null) {
      if (required) issues.push(`${path}.${key}: required`);
      return undefined;
    }
    if (!Array.isArray(raw[key])) {
      issues.push(`${path}.${key}: expected array`);
      return undefined;
    }
    if (raw[key].length > maxItems) {
      issues.push(`${path}.${key}: too many`);
      return undefined;
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < raw[key].length; i++) {
      const item = raw[key][i];
      if (typeof item !== "string") {
        issues.push(`${path}.${key}[${i}]: expected string`);
        continue;
      }
      const value = item.trim();
      if (!value) {
        issues.push(`${path}.${key}[${i}]: empty`);
        continue;
      }
      if (codePointCount(value) > maxItem) {
        issues.push(`${path}.${key}[${i}]: too long`);
        continue;
      }
      if (allowlist && !allowlist.has(value)) {
        issues.push(`${path}.${key}[${i}]: invalid`);
        continue;
      }
      if (seen.has(value)) {
        issues.push(`${path}.${key}[${i}]: duplicate`);
        continue;
      }
      seen.add(value);
      out.push(value);
    }
    if (out.length < minItems) issues.push(`${path}.${key}: too few`);
    return out;
  }

  function pickMeta(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("program.meta: expected object");
      return null;
    }
    const meta = {};
    const name = requireString(raw, "name", issues, "program.meta", { max: 100, min: 1, trim: true });
    if (name !== undefined) meta.name = name;
    const goal = optionalEnum(raw, "goal", GOALS, issues, "program.meta");
    if (goal !== undefined) meta.goal = goal;
    const experience = optionalEnum(raw, "experience", EXPERIENCES, issues, "program.meta");
    if (experience !== undefined) meta.experience = experience;
    if (!isIntInRange(raw.daysPerWeek, 1, 7)) issues.push("program.meta.daysPerWeek: invalid");
    else meta.daysPerWeek = raw.daysPerWeek;
    const splitType = optionalEnum(raw, "splitType", SPLITS, issues, "program.meta");
    if (splitType !== undefined) meta.splitType = splitType;
    const equipment = uniqueTrimmedStrings(raw, "equipment", issues, "program.meta", {
      maxItems: 5,
      maxItem: 80,
      allowlist: EQUIPMENT,
    });
    if (equipment) meta.equipment = equipment;
    const priorityMuscles = uniqueTrimmedStrings(raw, "priorityMuscles", issues, "program.meta", {
      maxItems: 32,
      maxItem: 80,
    });
    if (priorityMuscles) meta.priorityMuscles = priorityMuscles;
    const sessionLength = optionalEnum(raw, "sessionLength", SESSION_LENGTHS, issues, "program.meta");
    if (sessionLength !== undefined) meta.sessionLength = sessionLength;
    if (!isIntInRange(raw.mesocycleLengthWeeks, 1, 52)) issues.push("program.meta.mesocycleLengthWeeks: invalid");
    else meta.mesocycleLengthWeeks = raw.mesocycleLengthWeeks;
    if (hasOwn(raw, "progressionRelations")) meta.progressionRelations = pickRelations(raw.progressionRelations, issues);
    if (hasOwn(raw, "progressionModifiers")) meta.progressionModifiers = pickModifiers(raw.progressionModifiers, issues);
    return meta;
  }

  function pickOptionalNumber(raw, key, issues, path, min, max) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (!isNumberInRange(raw[key], min, max)) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function pickOptionalInt(raw, key, issues, path, min, max) {
    if (!hasOwn(raw, key) || raw[key] === undefined) return undefined;
    if (!isIntInRange(raw[key], min, max)) {
      issues.push(`${path}.${key}: invalid`);
      return undefined;
    }
    return raw[key];
  }

  function canonicalJsonField(value, path, issues) {
    try {
      return canonicalize(value);
    } catch {
      issues.push(`${path}: invalid JSON value`);
      return undefined;
    }
  }

  function pickModifier(raw, index, issues, path = `program.meta.progressionModifiers[${index}]`) {
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const allowed = new Set(["id", "version", "compatibleStrategies", "weekNumber", "target", "params"]);
    for (const key of Object.keys(raw)) if (!allowed.has(key)) issues.push(`${path}.${key}: unknown key`);
    const modifier = {};
    const id = requireString(raw, "id", issues, path, { max: 120, min: 1, trim: true });
    if (id !== undefined) modifier.id = id;
    if (!isIntInRange(raw.version, 1, Number.MAX_SAFE_INTEGER)) issues.push(`${path}.version: invalid`);
    else modifier.version = raw.version;
    const compatible = uniqueTrimmedStrings(raw, "compatibleStrategies", issues, path, {
      maxItems: 8,
      maxItem: 80,
      required: true,
      minItems: 1,
    });
    if (compatible) modifier.compatibleStrategies = compatible;
    if (hasOwn(raw, "weekNumber")) {
      if (!isIntInRange(raw.weekNumber, 1, 6)) issues.push(`${path}.weekNumber: invalid`);
      else modifier.weekNumber = raw.weekNumber;
    }
    const target = requireString(raw, "target", issues, path, { max: 80, min: 1, trim: true, required: false });
    if (target) modifier.target = target;
    if (!isPlainObject(raw.params)) issues.push(`${path}.params: expected object`);
    else {
      const params = canonicalJsonField(raw.params, `${path}.params`, issues);
      if (params !== undefined) modifier.params = params;
    }
    return modifier;
  }

  function pickProgression(raw, issues, path) {
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const allowed = new Set(["schemaVersion", "strategy", "modifiers"]);
    for (const key of Object.keys(raw)) if (!allowed.has(key)) issues.push(`${path}.${key}: unknown key`);
    if (raw.schemaVersion !== 1) issues.push(`${path}.schemaVersion: unsupported`);
    if (!isPlainObject(raw.strategy)) {
      issues.push(`${path}.strategy: expected object`);
      return null;
    }
    for (const key of Object.keys(raw.strategy)) if (!["id", "version", "params"].includes(key)) issues.push(`${path}.strategy.${key}: unknown key`);
    if (!["range", "rep_goal", "effort_target", "anchor_backoff", "manual"].includes(raw.strategy.id)) issues.push(`${path}.strategy.id: unsupported`);
    if (raw.strategy.version !== 1) issues.push(`${path}.strategy.version: unsupported`);
    if (!isPlainObject(raw.strategy.params)) issues.push(`${path}.strategy.params: expected object`);
    const progression = { schemaVersion: 1, strategy: { id: raw.strategy.id, version: 1, params: {} }, modifiers: [] };
    if (isPlainObject(raw.strategy.params)) {
      const params = canonicalJsonField(raw.strategy.params, `${path}.strategy.params`, issues);
      if (params !== undefined) progression.strategy.params = params;
    }
    if (!Array.isArray(raw.modifiers)) issues.push(`${path}.modifiers: expected array`);
    else {
      const seen = new Set();
      for (let index = 0; index < raw.modifiers.length; index++) {
        const modifier = pickModifier(raw.modifiers[index], index, issues, `${path}.modifiers[${index}]`);
        if (!modifier) continue;
        const identity = `${modifier.id}@${modifier.version}`;
        if (seen.has(identity)) issues.push(`${path}.modifiers[${index}]: duplicate`);
        seen.add(identity);
        progression.modifiers.push(modifier);
      }
    }
    return progression;
  }

  function pickRelation(raw, index, issues, path = `program.meta.progressionRelations[${index}]`) {
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const allowed = new Set(["schemaVersion", "id", "type", "version", "movementId", "members"]);
    for (const key of Object.keys(raw)) if (!allowed.has(key)) issues.push(`${path}.${key}: unknown key`);
    if (raw.schemaVersion !== 1) issues.push(`${path}.schemaVersion: unsupported`);
    const id = requireString(raw, "id", issues, path, { max: 120, min: 1, trim: true });
    if (raw.type !== "paired_exposure") issues.push(`${path}.type: unsupported`);
    if (raw.version !== 1) issues.push(`${path}.version: unsupported`);
    const movementId = requireString(raw, "movementId", issues, path, { max: 200, min: 1, trim: true });
    if (!Array.isArray(raw.members) || raw.members.length !== 2) issues.push(`${path}.members: expected exactly two members`);
    const relation = { schemaVersion: 1, id, type: "paired_exposure", version: 1, movementId, members: [] };
    const roles = new Set(), ids = new Set();
    for (let memberIndex = 0; memberIndex < (Array.isArray(raw.members) ? raw.members.length : 0); memberIndex++) {
      const member = raw.members[memberIndex];
      const memberPath = `${path}.members[${memberIndex}]`;
      if (!isPlainObject(member)) {
        issues.push(`${memberPath}: expected object`);
        continue;
      }
      for (const key of Object.keys(member)) if (!["exerciseId", "role"].includes(key)) issues.push(`${memberPath}.${key}: unknown key`);
      const exerciseId = requireString(member, "exerciseId", issues, memberPath, { max: 200, min: 1, trim: true });
      if (exerciseId && ids.has(exerciseId)) issues.push(`${memberPath}.exerciseId: duplicate`);
      if (exerciseId) ids.add(exerciseId);
      if (member.role !== "heavy" && member.role !== "volume") issues.push(`${memberPath}.role: unsupported`);
      else if (roles.has(member.role)) issues.push(`${memberPath}.role: duplicate`);
      else roles.add(member.role);
      relation.members.push({ exerciseId, role: member.role });
    }
    if (!roles.has("heavy") || !roles.has("volume")) issues.push(`${path}.members: heavy and volume roles required`);
    relation.members.sort((left, right) => left.role === "heavy" ? -1 : right.role === "heavy" ? 1 : 0);
    return relation;
  }

  function pickRelations(raw, issues) {
    if (!Array.isArray(raw)) {
      issues.push("program.meta.progressionRelations: expected array");
      return [];
    }
    const relations = [], relationIds = new Set(), slots = new Set();
    for (let index = 0; index < raw.length; index++) {
      const relation = pickRelation(raw[index], index, issues);
      if (!relation) continue;
      if (relationIds.has(relation.id)) issues.push(`program.meta.progressionRelations[${index}].id: duplicate`);
      relationIds.add(relation.id);
      for (const member of relation.members) {
        if (slots.has(member.exerciseId)) issues.push(`program.meta.progressionRelations[${index}].members: slot belongs to multiple relations`);
        slots.add(member.exerciseId);
      }
      relations.push(relation);
    }
    return relations;
  }

  function pickModifiers(raw, issues) {
    if (!Array.isArray(raw)) {
      issues.push("program.meta.progressionModifiers: expected array");
      return [];
    }
    const modifiers = [], identities = new Set();
    for (let index = 0; index < raw.length; index++) {
      const modifier = pickModifier(raw[index], index, issues);
      if (!modifier) continue;
      const identity = `${modifier.id}@${modifier.version}`;
      if (identities.has(identity)) issues.push(`program.meta.progressionModifiers[${index}]: duplicate`);
      identities.add(identity);
      modifiers.push(modifier);
    }
    return modifiers;
  }

  function pickExercise(raw, index, issues) {
    const path = `program.exercises[${index}]`;
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const exercise = {};
    const id = requireString(raw, "id", issues, path, { max: 200, min: 1, trim: true, required: false });
    if (id) exercise.id = id;
    const movementId = requireString(raw, "movementId", issues, path, { max: 200, min: 1, trim: true, required: false });
    if (movementId) exercise.movementId = movementId;
    const day = requireString(raw, "day", issues, path, { max: 80, min: 1, trim: true });
    if (day !== undefined) exercise.day = day;
    if (!isIntInRange(raw.order, 1, 1000)) issues.push(`${path}.order: invalid`);
    else exercise.order = raw.order;
    const libraryId = requireString(raw, "libraryId", issues, path, { max: 200, min: 1 });
    if (libraryId !== undefined) exercise.libraryId = libraryId;
    if (!isIntInRange(raw.sets, 1, 100)) issues.push(`${path}.sets: invalid`);
    else exercise.sets = raw.sets;
    if (!isIntInRange(raw.min, 1, 1000)) issues.push(`${path}.min: invalid`);
    else exercise.min = raw.min;
    if (!isIntInRange(raw.max, 1, 1000)) issues.push(`${path}.max: invalid`);
    else exercise.max = raw.max;
    if (isIntInRange(raw.min, 1, 1000) && isIntInRange(raw.max, 1, 1000) && raw.max < raw.min) {
      issues.push(`${path}.max: less than min`);
    }
    const displayName = requireString(raw, "displayName", issues, path, { max: 200, trim: true, required: false });
    if (displayName) exercise.displayName = displayName;
    if (!hasOwn(raw, "notes") || raw.notes == null) exercise.notes = "";
    else if (typeof raw.notes !== "string" || codePointCount(raw.notes) > 2000) issues.push(`${path}.notes: invalid`);
    else exercise.notes = raw.notes;
    if (!hasOwn(raw, "alternates") || raw.alternates == null) exercise.alternates = [];
    else {
      const alternates = uniqueTrimmedStrings(raw, "alternates", issues, path, {
        maxItems: 20,
        maxItem: 200,
        minItems: 0,
      });
      if (alternates) exercise.alternates = alternates;
    }
    const progressionType = requireString(raw, "progressionType", issues, path, { max: 80, trim: true, required: false });
    if (progressionType) exercise.progressionType = progressionType;
    const targetRirStart = pickOptionalNumber(raw, "targetRirStart", issues, path, 0, 100);
    if (targetRirStart !== undefined) exercise.targetRirStart = targetRirStart;
    const targetRirEnd = pickOptionalNumber(raw, "targetRirEnd", issues, path, 0, 100);
    if (targetRirEnd !== undefined) exercise.targetRirEnd = targetRirEnd;
    const minSets = pickOptionalInt(raw, "minSets", issues, path, 1, 100);
    if (minSets !== undefined) exercise.minSets = minSets;
    const maxSets = pickOptionalInt(raw, "maxSets", issues, path, 1, 100);
    if (maxSets !== undefined) exercise.maxSets = maxSets;
    if (minSets !== undefined && maxSets !== undefined && maxSets < minSets) {
      issues.push(`${path}.maxSets: less than minSets`);
    }
    const priority = requireString(raw, "priority", issues, path, { max: 80, trim: true, required: false });
    if (priority) exercise.priority = priority;
    if (hasOwn(raw, "progression")) {
      const progression = pickProgression(raw.progression, issues, `${path}.progression`);
      if (progression) exercise.progression = progression;
    }
    return exercise;
  }

  function pickCustom(raw, index, issues) {
    const path = `program.customExercises[${index}]`;
    if (!isPlainObject(raw)) {
      issues.push(`${path}: expected object`);
      return null;
    }
    const custom = {};
    const id = requireString(raw, "id", issues, path, { max: 200, min: 1 });
    if (id !== undefined) {
      if (!id.startsWith(CUSTOM_ID_PREFIX) || id.length <= CUSTOM_ID_PREFIX.length) {
        issues.push(`${path}.id: invalid`);
      } else custom.id = id;
    }
    const name = requireString(raw, "name", issues, path, { max: 200, min: 1, trim: true });
    if (name !== undefined) custom.name = name;
    const namePt = requireString(raw, "namePt", issues, path, { max: 200, trim: true, required: false });
    custom.namePt = namePt || name || "";
    const equipment = uniqueTrimmedStrings(raw, "equipment", issues, path, {
      maxItems: 10,
      maxItem: 80,
      required: true,
      minItems: 1,
    });
    if (equipment) custom.equipment = equipment;
    const primary = requireString(raw, "primary", issues, path, { max: 500, required: false });
    if (primary !== undefined) custom.primary = primary;
    const secondary = requireString(raw, "secondary", issues, path, { max: 500, required: false });
    if (secondary !== undefined) custom.secondary = secondary;
    const notes = requireString(raw, "notes", issues, path, { max: 2000, required: false });
    if (notes !== undefined) custom.notes = notes;
    return custom;
  }

  function pickSettings(raw, issues) {
    if (!isPlainObject(raw)) {
      issues.push("settings: expected object");
      return null;
    }
    const settings = {};
    if (!isNumberInRange(raw.jumpPct, 0, 100)) issues.push("settings.jumpPct: invalid");
    else settings.jumpPct = raw.jumpPct;
    if (!isNumberInRange(raw.minJump, 0.01, 1000)) issues.push("settings.minJump: invalid");
    else settings.minJump = raw.minJump;
    if (!isNumberInRange(raw.rirHigh, 0, 100)) issues.push("settings.rirHigh: invalid");
    else settings.rirHigh = raw.rirHigh;
    if (!isNumberInRange(raw.hardRir, 0, 100)) issues.push("settings.hardRir: invalid");
    else settings.hardRir = raw.hardRir;
    if (!isIntInRange(raw.restSec, 0, 86400)) issues.push("settings.restSec: invalid");
    else settings.restSec = raw.restSec;
    if (!UNITS.has(raw.unit)) issues.push("settings.unit: invalid");
    else settings.unit = raw.unit;
    if (!LANGS.has(raw.lang)) issues.push("settings.lang: invalid");
    else settings.lang = raw.lang;
    if (!RIR_MODES.has(raw.rirMode)) issues.push("settings.rirMode: invalid");
    else settings.rirMode = raw.rirMode;
    return settings;
  }

  function builtInSet(options) {
    const ids = options && options.builtInIds;
    if (ids instanceof Set) return ids;
    if (Array.isArray(ids)) return new Set(ids);
    return new Set();
  }

  function validate(raw, options) {
    const issues = [];
    if (!isPlainObject(raw)) return schemaFail(["$: expected object"]);
    collectForbiddenKeys(raw, issues, "$");
    if (issues.length) return schemaFail(issues);
    if (raw.kind !== KIND) issues.push("kind: invalid");
    if (!hasOwn(raw, "version")) issues.push("version: required");
    else if (!isIntInRange(raw.version, 1, Number.MAX_SAFE_INTEGER) || raw.version !== VERSION) {
      if (isIntInRange(raw.version, 0, Number.MAX_SAFE_INTEGER) && raw.version !== VERSION) {
        return { ok: false, code: "unsupported-version" };
      }
      issues.push("version: invalid");
    }
    if (!isPlainObject(raw.program)) issues.push("program: expected object");
    if (!isPlainObject(raw.settings)) issues.push("settings: expected object");
    if (issues.length) return schemaFail(issues);

    const meta = pickMeta(raw.program.meta, issues);
    if (!Array.isArray(raw.program.exercises) || raw.program.exercises.length < 1) {
      issues.push("program.exercises: required");
    } else if (raw.program.exercises.length > 100) {
      issues.push("program.exercises: too many");
    }
    const exercises = Array.isArray(raw.program.exercises)
      ? raw.program.exercises.map((entry, index) => pickExercise(entry, index, issues)).filter(Boolean)
      : [];
    if (hasOwn(raw.program, "customExercises") && raw.program.customExercises != null && !Array.isArray(raw.program.customExercises)) {
      issues.push("program.customExercises: expected array");
    }
    const customSource = Array.isArray(raw.program.customExercises) ? raw.program.customExercises : [];
    if (customSource.length > 50) issues.push("program.customExercises: too many");
    const customs = customSource.map((entry, index) => pickCustom(entry, index, issues)).filter(Boolean);
    const settings = pickSettings(raw.settings, issues);
    if (issues.length) return schemaFail(issues);

    const allExerciseIds = new Set();
    for (const exercise of exercises) {
      if (exercise.id === undefined) continue;
      if (allExerciseIds.has(exercise.id)) issues.push(`program.exercises: duplicate id ${exercise.id}`);
      allExerciseIds.add(exercise.id);
    }
    if (issues.length) return schemaFail(issues);

    // Slot and movement identities are shared only when a validated relation
    // needs them. Device-local identifiers otherwise remain history/UI data.
    const relationSlots = new Set((meta?.progressionRelations || [])
      .flatMap((relation) => relation.members.map((member) => member.exerciseId)));
    for (const exercise of exercises) {
      if (!relationSlots.has(exercise.id)) {
        delete exercise.id;
        delete exercise.movementId;
      }
    }

    const positions = new Set();
    const exerciseIds = new Set();
    const days = new Set();
    for (const exercise of exercises) {
      days.add(exercise.day);
      const pos = `${exercise.day}\0${exercise.order}`;
      if (positions.has(pos)) issues.push(`program.exercises: duplicate ${exercise.day}#${exercise.order}`);
      positions.add(pos);
      if (exercise.id !== undefined) {
        if (exerciseIds.has(exercise.id)) issues.push(`program.exercises: duplicate id ${exercise.id}`);
        exerciseIds.add(exercise.id);
      }
    }
    if (meta?.progressionRelations) {
      const derivedMovementId = (exercise) => {
        const libraryId = typeof exercise?.libraryId === "string" ? exercise.libraryId : "";
        return libraryId.trim();
      };
      for (const relation of meta.progressionRelations) {
        for (const member of relation.members) {
          if (!exerciseIds.has(member.exerciseId)) issues.push(`program.meta.progressionRelations: unknown slot ${member.exerciseId}`);
          const slot = exercises.find((exercise) => exercise.id === member.exerciseId);
          if (slot) {
            const derived = derivedMovementId(slot);
            if (!derived || derived !== relation.movementId) {
              issues.push(`program.meta.progressionRelations: movement identity mismatch for ${member.exerciseId}`);
            }
            if (slot.movementId !== undefined && slot.movementId !== derived) {
              issues.push(`program.exercises.${member.exerciseId}.movementId: unapproved identity`);
            }
          }
        }
      }
    }
    if (days.size > 7) issues.push("program.exercises: too many days");
    if (meta && meta.daysPerWeek !== days.size) issues.push("program.meta.daysPerWeek: day count mismatch");

    const builtInIds = builtInSet(options);
    const customById = new Map();
    for (const custom of customs) {
      if (customById.has(custom.id)) issues.push(`program.customExercises: duplicate ${custom.id}`);
      if (builtInIds.has(custom.id)) issues.push(`program.customExercises: shadows built-in ${custom.id}`);
      customById.set(custom.id, custom);
    }
    const referencedCustom = new Set();
    for (const exercise of exercises) {
      const id = exercise.libraryId;
      if (typeof id !== "string") continue;
      if (id.startsWith(CUSTOM_ID_PREFIX)) {
        if (!customById.has(id)) issues.push(`program.exercises: missing custom ${id}`);
        else referencedCustom.add(id);
      } else if (!builtInIds.has(id)) {
        issues.push(`program.exercises: unknown libraryId ${id}`);
      }
    }
    if (issues.length) return schemaFail(issues);

    const payload = {
      kind: KIND,
      version: VERSION,
      program: {
        meta,
        exercises,
        customExercises: customs.filter((entry) => referencedCustom.has(entry.id)),
      },
      settings,
    };
    return { ok: true, value: canonicalize(payload) };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunk = 256;
    for (let i = 0; i < bytes.length; i += chunk) {
      const end = Math.min(i + chunk, bytes.length);
      for (let j = i; j < end; j++) binary += String.fromCharCode(bytes[j]);
    }
    return btoa(binary);
  }

  function base64ToBytes(b64) {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  function toBase64Url(bytes) {
    return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(text) {
    if (typeof text !== "string" || !BASE64URL_RE.test(text) || text.length % 4 === 1) return null;
    const padded = text + "=".repeat((4 - (text.length % 4)) % 4);
    const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    try {
      return base64ToBytes(b64);
    } catch {
      return null;
    }
  }

  function concatChunks(chunks, total) {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  }

  async function readBoundedStream(stream, max, tooLargeCode, failCode) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || !value.byteLength) continue;
        total += value.byteLength;
        if (total > max) {
          try { await reader.cancel(); } catch {}
          return { ok: false, code: tooLargeCode };
        }
        chunks.push(new Uint8Array(value));
      }
    } catch {
      return { ok: false, code: failCode };
    }
    return { ok: true, value: concatChunks(chunks, total) };
  }

  async function gzipBytes(bytes) {
    if (typeof CompressionStream !== "function") return { ok: false, code: "compression-unavailable" };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_COMPRESSED_BYTES, "encoded-too-large", "compression-unavailable");
    } catch {
      return { ok: false, code: "compression-unavailable" };
    }
  }

  async function gunzipBytes(bytes) {
    if (typeof DecompressionStream !== "function") return { ok: false, code: "decompression-unavailable" };
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
      return await readBoundedStream(stream, MAX_DECOMPRESSED_BYTES, "decompressed-too-large", "invalid-gzip");
    } catch {
      return { ok: false, code: "invalid-gzip" };
    }
  }

  function decodeUtf8(bytes) {
    try {
      return { ok: true, value: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch (err) {
      if (err && err.name === "TypeError" && /option|fatal/i.test(String(err.message || err))) {
        try {
          return { ok: true, value: new TextDecoder("utf-8").decode(bytes) };
        } catch {
          return { ok: false, code: "invalid-utf8" };
        }
      }
      return { ok: false, code: "invalid-utf8" };
    }
  }

  function bitIsSet(mask, bit) {
    return (mask & (1 << bit)) !== 0;
  }

  function maskPopcount(mask) {
    let count = 0;
    let remaining = mask >>> 0;
    while (remaining) {
      count += remaining & 1;
      remaining >>>= 1;
    }
    return count;
  }

  function acceptMask(mask, bitCount, path, issues) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 0x1ffff) {
      issues.push(`${path}: invalid mask`);
      return null;
    }
    if (mask >>> bitCount !== 0) {
      issues.push(`${path}: unknown mask bits`);
      return null;
    }
    return mask;
  }

  function expectMaskedArity(arr, fixed, mask, path, issues) {
    if (!Array.isArray(arr) || arr.length !== fixed + maskPopcount(mask)) {
      issues.push(`${path}: wrong arity`);
      return false;
    }
    return true;
  }

  function encodeRequiredEnum(value, values) {
    const index = values.indexOf(value);
    return index === -1 ? null : index + 1;
  }

  function decodeRequiredEnum(code, values) {
    if (!Number.isInteger(code) || code < 1 || code > values.length) return null;
    return values[code - 1];
  }

  function decodeNullableEnum(code, values) {
    if (code === 0) return { ok: true, value: null };
    const value = decodeRequiredEnum(code, values);
    if (value == null) return { ok: false };
    return { ok: true, value };
  }

  function pushOptional(mask, values, bit, present, value) {
    if (!present) return mask;
    values.push(value);
    return mask | (1 << bit);
  }

  function takeOptional(arr, offset, mask, bit) {
    if (!bitIsSet(mask, bit)) return { present: false, offset };
    return { present: true, value: arr[offset], offset: offset + 1 };
  }

  function packDistinctDays(exercises) {
    const days = [];
    const seen = new Set();
    for (const exercise of exercises) {
      if (seen.has(exercise.day)) continue;
      seen.add(exercise.day);
      days.push(exercise.day);
    }
    return days;
  }

  function packMeta(meta, includeProgression = false) {
    const values = [];
    let mask = 0;
    if (hasOwn(meta, "goal")) {
      mask = pushOptional(mask, values, 0, true, meta.goal === null ? 0 : encodeRequiredEnum(meta.goal, GOAL_VALUES));
    }
    if (hasOwn(meta, "experience")) {
      mask = pushOptional(mask, values, 1, true, meta.experience === null ? 0 : encodeRequiredEnum(meta.experience, EXPERIENCE_VALUES));
    }
    if (hasOwn(meta, "splitType")) {
      mask = pushOptional(mask, values, 2, true, meta.splitType === null ? 0 : encodeRequiredEnum(meta.splitType, SPLIT_VALUES));
    }
    if (hasOwn(meta, "equipment")) {
      mask = pushOptional(mask, values, 3, true, meta.equipment.map((item) => encodeRequiredEnum(item, EQUIPMENT_VALUES)));
    }
    if (hasOwn(meta, "priorityMuscles")) {
      mask = pushOptional(mask, values, 4, true, meta.priorityMuscles.slice());
    }
    if (hasOwn(meta, "sessionLength")) {
      mask = pushOptional(mask, values, 5, true, meta.sessionLength === null ? 0 : encodeRequiredEnum(meta.sessionLength, SESSION_LENGTH_VALUES));
    }
    if (includeProgression && hasOwn(meta, "progressionRelations")) mask = pushOptional(mask, values, 6, true, meta.progressionRelations);
    if (includeProgression && hasOwn(meta, "progressionModifiers")) mask = pushOptional(mask, values, 7, true, meta.progressionModifiers);
    return [meta.name, meta.mesocycleLengthWeeks, mask, ...values];
  }

  function packSettings(settings) {
    return [
      settings.jumpPct,
      settings.minJump,
      settings.rirHigh,
      settings.hardRir,
      settings.restSec,
      encodeRequiredEnum(settings.unit, UNIT_VALUES),
      encodeRequiredEnum(settings.lang, LANG_VALUES),
      encodeRequiredEnum(settings.rirMode, RIR_MODE_VALUES),
    ];
  }

  function packExercise(exercise, days, customIndex, includeProgression = false) {
    const values = [];
    let mask = 0;
    mask = pushOptional(mask, values, 0, !!(hasOwn(exercise, "displayName") && exercise.displayName), exercise.displayName);
    mask = pushOptional(mask, values, 1, typeof exercise.notes === "string" && exercise.notes !== "", exercise.notes);
    mask = pushOptional(mask, values, 2, Array.isArray(exercise.alternates) && exercise.alternates.length > 0, exercise.alternates);
    mask = pushOptional(mask, values, 3, !!(hasOwn(exercise, "progressionType") && exercise.progressionType), exercise.progressionType);
    mask = pushOptional(mask, values, 4, hasOwn(exercise, "targetRirStart"), exercise.targetRirStart);
    mask = pushOptional(mask, values, 5, hasOwn(exercise, "targetRirEnd"), exercise.targetRirEnd);
    mask = pushOptional(mask, values, 6, hasOwn(exercise, "minSets"), exercise.minSets);
    mask = pushOptional(mask, values, 7, hasOwn(exercise, "maxSets"), exercise.maxSets);
    mask = pushOptional(mask, values, 8, !!(hasOwn(exercise, "priority") && exercise.priority), exercise.priority);
    if (includeProgression) {
      mask = pushOptional(mask, values, 9, !!(hasOwn(exercise, "id") && exercise.id), exercise.id);
      mask = pushOptional(mask, values, 10, hasOwn(exercise, "progression"), exercise.progression);
      mask = pushOptional(mask, values, 11, !!(hasOwn(exercise, "movementId") && exercise.movementId), exercise.movementId);
    }
    const libraryRef = exercise.libraryId.startsWith(CUSTOM_ID_PREFIX)
      ? customIndex.get(exercise.libraryId)
      : exercise.libraryId;
    return [days.indexOf(exercise.day), exercise.order, libraryRef, exercise.sets, exercise.min, exercise.max, mask, ...values];
  }

  function packCustom(custom) {
    const values = [];
    let mask = 0;
    const namePt = hasOwn(custom, "namePt") ? custom.namePt : custom.name;
    mask = pushOptional(mask, values, 0, namePt !== custom.name, namePt);
    mask = pushOptional(mask, values, 1, hasOwn(custom, "primary"), custom.primary);
    mask = pushOptional(mask, values, 2, hasOwn(custom, "secondary"), custom.secondary);
    mask = pushOptional(mask, values, 3, hasOwn(custom, "notes"), custom.notes);
    return [custom.id, custom.name, custom.equipment.slice(), mask, ...values];
  }

  function packV2(payload) {
    const days = packDistinctDays(payload.program.exercises);
    const customs = payload.program.customExercises || [];
    const customIndex = new Map(customs.map((entry, index) => [entry.id, index]));
    return [
      packMeta(payload.program.meta),
      packSettings(payload.settings),
      days,
      payload.program.exercises.map((exercise) => packExercise(exercise, days, customIndex)),
      customs.map(packCustom),
    ];
  }

  function packV3(payload) {
    const days = packDistinctDays(payload.program.exercises);
    const customs = payload.program.customExercises || [];
    const customIndex = new Map(customs.map((entry, index) => [entry.id, index]));
    return [
      packMeta(payload.program.meta, true),
      packSettings(payload.settings),
      days,
      payload.program.exercises.map((exercise) => packExercise(exercise, days, customIndex, true)),
      customs.map(packCustom),
    ];
  }

  function unpackEquipmentCodes(raw, path, issues) {
    if (!Array.isArray(raw)) {
      issues.push(`${path}: expected array`);
      return null;
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < raw.length; i++) {
      const item = decodeRequiredEnum(raw[i], EQUIPMENT_VALUES);
      if (item == null) {
        issues.push(`${path}[${i}]: invalid`);
        return null;
      }
      if (seen.has(item)) {
        issues.push(`${path}[${i}]: duplicate`);
        return null;
      }
      seen.add(item);
      out.push(item);
    }
    return out;
  }

  function unpackMeta(raw, dayCount, issues, includeProgression = false) {
    if (!Array.isArray(raw) || raw.length < 3) {
      issues.push("program.meta: wrong arity");
      return null;
    }
    const mask = acceptMask(raw[2], includeProgression ? V3_META_OPTIONAL_BITS : META_OPTIONAL_BITS, "program.meta", issues);
    if (mask == null || !expectMaskedArity(raw, 3, mask, "program.meta", issues)) return null;
    const meta = {};
    setOwn(meta, "name", raw[0]);
    setOwn(meta, "mesocycleLengthWeeks", raw[1]);
    setOwn(meta, "daysPerWeek", dayCount);
    let offset = 3;
    const goal = takeOptional(raw, offset, mask, 0);
    offset = goal.offset;
    if (goal.present) {
      const decoded = decodeNullableEnum(goal.value, GOAL_VALUES);
      if (!decoded.ok) {
        issues.push("program.meta.goal: invalid");
        return null;
      }
      setOwn(meta, "goal", decoded.value);
    }
    const experience = takeOptional(raw, offset, mask, 1);
    offset = experience.offset;
    if (experience.present) {
      const decoded = decodeNullableEnum(experience.value, EXPERIENCE_VALUES);
      if (!decoded.ok) {
        issues.push("program.meta.experience: invalid");
        return null;
      }
      setOwn(meta, "experience", decoded.value);
    }
    const splitType = takeOptional(raw, offset, mask, 2);
    offset = splitType.offset;
    if (splitType.present) {
      const decoded = decodeNullableEnum(splitType.value, SPLIT_VALUES);
      if (!decoded.ok) {
        issues.push("program.meta.splitType: invalid");
        return null;
      }
      setOwn(meta, "splitType", decoded.value);
    }
    const equipment = takeOptional(raw, offset, mask, 3);
    offset = equipment.offset;
    if (equipment.present) {
      const decoded = unpackEquipmentCodes(equipment.value, "program.meta.equipment", issues);
      if (!decoded) return null;
      setOwn(meta, "equipment", decoded);
    }
    const priorityMuscles = takeOptional(raw, offset, mask, 4);
    offset = priorityMuscles.offset;
    if (priorityMuscles.present) {
      if (!Array.isArray(priorityMuscles.value)) {
        issues.push("program.meta.priorityMuscles: expected array");
        return null;
      }
      setOwn(meta, "priorityMuscles", priorityMuscles.value);
    }
    const sessionLength = takeOptional(raw, offset, mask, 5);
    offset = sessionLength.offset;
    if (sessionLength.present) {
      const decoded = decodeNullableEnum(sessionLength.value, SESSION_LENGTH_VALUES);
      if (!decoded.ok) {
        issues.push("program.meta.sessionLength: invalid");
        return null;
      }
      setOwn(meta, "sessionLength", decoded.value);
    }
    if (includeProgression) {
      const progressionRelations = takeOptional(raw, offset, mask, 6);
      offset = progressionRelations.offset;
      if (progressionRelations.present) setOwn(meta, "progressionRelations", progressionRelations.value);
      const progressionModifiers = takeOptional(raw, offset, mask, 7);
      if (progressionModifiers.present) setOwn(meta, "progressionModifiers", progressionModifiers.value);
    }
    return meta;
  }

  function unpackSettings(raw, issues) {
    if (!Array.isArray(raw) || raw.length !== 8) {
      issues.push("settings: wrong arity");
      return null;
    }
    const settings = {};
    setOwn(settings, "jumpPct", raw[0]);
    setOwn(settings, "minJump", raw[1]);
    setOwn(settings, "rirHigh", raw[2]);
    setOwn(settings, "hardRir", raw[3]);
    setOwn(settings, "restSec", raw[4]);
    const unit = decodeRequiredEnum(raw[5], UNIT_VALUES);
    const lang = decodeRequiredEnum(raw[6], LANG_VALUES);
    const rirMode = decodeRequiredEnum(raw[7], RIR_MODE_VALUES);
    if (unit == null) {
      issues.push("settings.unit: invalid");
      return null;
    }
    if (lang == null) {
      issues.push("settings.lang: invalid");
      return null;
    }
    if (rirMode == null) {
      issues.push("settings.rirMode: invalid");
      return null;
    }
    setOwn(settings, "unit", unit);
    setOwn(settings, "lang", lang);
    setOwn(settings, "rirMode", rirMode);
    return settings;
  }

  function unpackDays(raw, issues) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 7) {
      issues.push("program.days: invalid count");
      return null;
    }
    const days = [];
    const seen = new Set();
    for (let i = 0; i < raw.length; i++) {
      const day = raw[i];
      if (typeof day !== "string") {
        issues.push(`program.days[${i}]: expected string`);
        return null;
      }
      if (seen.has(day)) {
        issues.push(`program.days[${i}]: duplicate`);
        return null;
      }
      seen.add(day);
      days.push(day);
    }
    return days;
  }

  function unpackLibraryRef(raw, customs, path, issues) {
    if (typeof raw === "string") {
      if (raw.startsWith(CUSTOM_ID_PREFIX)) {
        issues.push(`${path}.libraryId: expected custom index`);
        return null;
      }
      return raw;
    }
    if (!Number.isInteger(raw) || raw < 0 || raw >= customs.length) {
      issues.push(`${path}.libraryId: invalid index`);
      return null;
    }
    return { customIndex: raw, id: customs[raw].id };
  }

  function unpackExercise(raw, index, days, customs, referencedDays, referencedCustoms, issues, includeProgression = false) {
    const path = `program.exercises[${index}]`;
    if (!Array.isArray(raw) || raw.length < 7) {
      issues.push(`${path}: wrong arity`);
      return null;
    }
    const mask = acceptMask(raw[6], includeProgression ? V3_EXERCISE_OPTIONAL_BITS : EXERCISE_OPTIONAL_BITS, path, issues);
    if (mask == null || !expectMaskedArity(raw, 7, mask, path, issues)) return null;
    const dayIndex = raw[0];
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= days.length) {
      issues.push(`${path}.day: invalid index`);
      return null;
    }
    referencedDays.add(dayIndex);
    const libraryRef = unpackLibraryRef(raw[2], customs, path, issues);
    if (libraryRef == null) return null;
    const exercise = {};
    setOwn(exercise, "day", days[dayIndex]);
    setOwn(exercise, "order", raw[1]);
    if (typeof libraryRef === "string") setOwn(exercise, "libraryId", libraryRef);
    else {
      referencedCustoms.add(libraryRef.customIndex);
      setOwn(exercise, "libraryId", libraryRef.id);
    }
    setOwn(exercise, "sets", raw[3]);
    setOwn(exercise, "min", raw[4]);
    setOwn(exercise, "max", raw[5]);
    let offset = 7;
    const displayName = takeOptional(raw, offset, mask, 0);
    offset = displayName.offset;
    if (displayName.present) setOwn(exercise, "displayName", displayName.value);
    const notes = takeOptional(raw, offset, mask, 1);
    offset = notes.offset;
    setOwn(exercise, "notes", notes.present ? notes.value : "");
    const alternates = takeOptional(raw, offset, mask, 2);
    offset = alternates.offset;
    setOwn(exercise, "alternates", alternates.present ? alternates.value : []);
    const progressionType = takeOptional(raw, offset, mask, 3);
    offset = progressionType.offset;
    if (progressionType.present) setOwn(exercise, "progressionType", progressionType.value);
    const targetRirStart = takeOptional(raw, offset, mask, 4);
    offset = targetRirStart.offset;
    if (targetRirStart.present) setOwn(exercise, "targetRirStart", targetRirStart.value);
    const targetRirEnd = takeOptional(raw, offset, mask, 5);
    offset = targetRirEnd.offset;
    if (targetRirEnd.present) setOwn(exercise, "targetRirEnd", targetRirEnd.value);
    const minSets = takeOptional(raw, offset, mask, 6);
    offset = minSets.offset;
    if (minSets.present) setOwn(exercise, "minSets", minSets.value);
    const maxSets = takeOptional(raw, offset, mask, 7);
    offset = maxSets.offset;
    if (maxSets.present) setOwn(exercise, "maxSets", maxSets.value);
    const priority = takeOptional(raw, offset, mask, 8);
    offset = priority.offset;
    if (priority.present) setOwn(exercise, "priority", priority.value);
    if (includeProgression) {
      const id = takeOptional(raw, offset, mask, 9);
      offset = id.offset;
      if (id.present) setOwn(exercise, "id", id.value);
      const progression = takeOptional(raw, offset, mask, 10);
      offset = progression.offset;
      if (progression.present) setOwn(exercise, "progression", progression.value);
      const movementId = takeOptional(raw, offset, mask, 11);
      if (movementId.present) setOwn(exercise, "movementId", movementId.value);
    }
    return exercise;
  }

  function unpackCustom(raw, index, issues) {
    const path = `program.customExercises[${index}]`;
    if (!Array.isArray(raw) || raw.length < 4) {
      issues.push(`${path}: wrong arity`);
      return null;
    }
    const mask = acceptMask(raw[3], CUSTOM_OPTIONAL_BITS, path, issues);
    if (mask == null || !expectMaskedArity(raw, 4, mask, path, issues)) return null;
    if (!Array.isArray(raw[2])) {
      issues.push(`${path}.equipment: expected array`);
      return null;
    }
    const custom = {};
    setOwn(custom, "id", raw[0]);
    setOwn(custom, "name", raw[1]);
    setOwn(custom, "equipment", raw[2]);
    let offset = 4;
    const namePt = takeOptional(raw, offset, mask, 0);
    offset = namePt.offset;
    setOwn(custom, "namePt", namePt.present ? namePt.value : raw[1]);
    const primary = takeOptional(raw, offset, mask, 1);
    offset = primary.offset;
    if (primary.present) setOwn(custom, "primary", primary.value);
    const secondary = takeOptional(raw, offset, mask, 2);
    offset = secondary.offset;
    if (secondary.present) setOwn(custom, "secondary", secondary.value);
    const notes = takeOptional(raw, offset, mask, 3);
    if (notes.present) setOwn(custom, "notes", notes.value);
    return custom;
  }

  function expandCompact(parsed, envelopeVersion, includeProgression) {
    try {
      const issues = [];
      const label = `v${envelopeVersion}`;
      if (!Array.isArray(parsed)) return schemaFail([`${label}: expected array`]);
      collectForbiddenKeys(parsed, issues, label);
      if (issues.length) return schemaFail(issues);
      if (parsed.length !== 5) return schemaFail([`${label}: wrong arity`]);
      const days = unpackDays(parsed[2], issues);
      if (!days) return schemaFail(issues);
      if (!Array.isArray(parsed[4])) {
        issues.push("program.customExercises: expected array");
        return schemaFail(issues);
      }
      if (parsed[4].length > 50) {
        issues.push("program.customExercises: too many");
        return schemaFail(issues);
      }
      const customIds = new Set();
      const customs = [];
      for (let i = 0; i < parsed[4].length; i++) {
        const custom = unpackCustom(parsed[4][i], i, issues);
        if (!custom) return schemaFail(issues);
        if (customIds.has(custom.id)) {
          issues.push(`program.customExercises: duplicate ${custom.id}`);
          return schemaFail(issues);
        }
        customIds.add(custom.id);
        customs.push(custom);
      }
      if (!Array.isArray(parsed[3]) || parsed[3].length < 1 || parsed[3].length > 100) {
        issues.push("program.exercises: invalid count");
        return schemaFail(issues);
      }
      const referencedDays = new Set();
      const referencedCustoms = new Set();
      const exercises = [];
      for (let i = 0; i < parsed[3].length; i++) {
        const exercise = unpackExercise(parsed[3][i], i, days, customs, referencedDays, referencedCustoms, issues, includeProgression);
        if (!exercise) return schemaFail(issues);
        exercises.push(exercise);
      }
      for (let i = 0; i < days.length; i++) {
        if (!referencedDays.has(i)) {
          issues.push(`program.days[${i}]: unreferenced`);
          return schemaFail(issues);
        }
      }
      for (let i = 0; i < customs.length; i++) {
        if (!referencedCustoms.has(i)) {
          issues.push(`program.customExercises[${i}]: unreferenced`);
          return schemaFail(issues);
        }
      }
      const meta = unpackMeta(parsed[0], days.length, issues, includeProgression);
      if (!meta) return schemaFail(issues);
      const settings = unpackSettings(parsed[1], issues);
      if (!settings) return schemaFail(issues);
      if (issues.length) return schemaFail(issues);
      const payload = {};
      setOwn(payload, "kind", KIND);
      setOwn(payload, "version", VERSION);
      const program = {};
      setOwn(program, "meta", meta);
      setOwn(program, "exercises", exercises);
      setOwn(program, "customExercises", customs);
      setOwn(payload, "program", program);
      setOwn(payload, "settings", settings);
      return { ok: true, value: payload };
    } catch {
      return schemaFail([`v${envelopeVersion}: invalid tuple`]);
    }
  }

  function expandV2(parsed) { return expandCompact(parsed, 2, false); }
  function expandV3(parsed) { return expandCompact(parsed, 3, true); }

  async function encodeCandidate(prefix, serializable) {
    let jsonText;
    try {
      jsonText = JSON.stringify(serializable);
    } catch {
      return schemaFail(["$: not serializable"]);
    }
    const decompressed = new TextEncoder().encode(jsonText);
    if (decompressed.byteLength > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, code: "decompressed-too-large" };
    }
    const compressed = await gzipBytes(decompressed);
    if (!compressed.ok) return compressed;
    if (compressed.value.byteLength > MAX_COMPRESSED_BYTES) {
      return { ok: false, code: "encoded-too-large" };
    }
    const encoded = `${prefix}${toBase64Url(compressed.value)}`;
    if (encoded.length > MAX_ENCODED_CHARS) return { ok: false, code: "encoded-too-large" };
    return {
      ok: true,
      value: encoded,
      compressedBytes: compressed.value.byteLength,
      decompressedBytes: decompressed.byteLength,
    };
  }

  async function encode(raw, options) {
    const checked = validate(raw, options);
    if (!checked.ok) return checked;
    const v1 = await encodeCandidate("v1.", checked.value);
    const needsV3 = hasOwn(checked.value.program.meta, "progressionRelations") ||
      hasOwn(checked.value.program.meta, "progressionModifiers") ||
      checked.value.program.exercises.some((exercise) => hasOwn(exercise, "id") || hasOwn(exercise, "movementId") || hasOwn(exercise, "progression"));
    const v2 = needsV3 ? { ok: false, code: "incompatible" } : await encodeCandidate("v2.", packV2(checked.value));
    const v3 = await encodeCandidate("v3.", packV3(checked.value));
    const candidates = [v1, v2, v3].filter((candidate) => candidate.ok);
    if (candidates.length) return candidates.reduce((best, candidate) => candidate.value.length < best.value.length ? candidate : best);
    return v1;
  }

  async function decode(encoded, options) {
    if (encoded == null || encoded === "") return { ok: false, code: "missing" };
    if (typeof encoded !== "string") return { ok: false, code: "missing" };
    if (encoded.length > MAX_ENCODED_CHARS) return { ok: false, code: "encoded-too-large" };
    const match = encoded.match(VERSION_PREFIX_RE);
    if (!match) return { ok: false, code: "invalid-base64" };
    const envelopeVersion = Number(match[1]);
    if (envelopeVersion !== 1 && envelopeVersion !== 2 && envelopeVersion !== 3) return { ok: false, code: "unsupported-version" };
    const payload = match[2];
    const compressed = fromBase64Url(payload);
    if (!compressed) return { ok: false, code: "invalid-base64" };
    if (compressed.byteLength > MAX_COMPRESSED_BYTES) return { ok: false, code: "encoded-too-large" };
    const decompressed = await gunzipBytes(compressed);
    if (!decompressed.ok) return decompressed;
    const text = decodeUtf8(decompressed.value);
    if (!text.ok) return text;
    let parsed;
    try {
      parsed = JSON.parse(text.value);
    } catch {
      return { ok: false, code: "invalid-json" };
    }
    let checked;
    if (envelopeVersion === 2 || envelopeVersion === 3) {
      const expanded = envelopeVersion === 2 ? expandV2(parsed) : expandV3(parsed);
      if (!expanded.ok) return expanded;
      checked = validate(expanded.value, options);
    } else {
      checked = validate(parsed, options);
    }
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: checked.value,
      compressedBytes: compressed.byteLength,
      decompressedBytes: decompressed.value.byteLength,
    };
  }

  function readSetupFragment(url) {
    const href = resolveHref(url);
    let parsed;
    try { parsed = new URL(href); } catch { return null; }
    if (!parsed.hash) return null;
    const params = new URLSearchParams(parsed.hash.slice(1));
    if (!params.has("setup")) return null;
    return params.get("setup");
  }

  function removeSetupFragment(url) {
    const href = resolveHref(url);
    const parsed = new URL(href);
    const params = new URLSearchParams(parsed.hash ? parsed.hash.slice(1) : "");
    params.delete("setup");
    const nextHash = params.toString();
    return `${parsed.pathname}${parsed.search}${nextHash ? `#${nextHash}` : ""}`;
  }

  function handoffCookiePath(locationLike) {
    const href = typeof locationLike === "string"
      ? locationLike
      : (locationLike && locationLike.href) || resolveHref();
    return new URL("index.html", href).pathname;
  }

  function cookieSecureSuffix(locationLike) {
    return isLocalhostHost(hostnameOf(locationLike)) ? "" : "; Secure";
  }

  function isSafeHandoffEnvelope(value) {
    if (typeof value !== "string" || !value || value.length > MAX_ENCODED_CHARS) return false;
    const match = value.match(VERSION_PREFIX_RE);
    if (!match) return false;
    const version = Number(match[1]);
    if (version !== 1 && version !== 2 && version !== 3) return false;
    const payload = match[2];
    return payload.length > 0 && BASE64URL_RE.test(payload) && payload.length % 4 !== 1;
  }

  function writeHandoffCookie(value, adapters) {
    const doc = adapterDocument(adapters);
    const loc = adapterLocation(adapters);
    if (!doc || !loc) return false;
    if (!isSafeHandoffEnvelope(value)) return false;
    const path = handoffCookiePath(loc);
    doc.cookie = `${COOKIE_NAME}=${value}; Path=${path}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${cookieSecureSuffix(loc)}`;
    return true;
  }

  function readHandoffCookie(adapters) {
    const doc = adapterDocument(adapters);
    if (!doc || typeof doc.cookie !== "string") return null;
    const parts = doc.cookie.split(";");
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const eq = trimmed.indexOf("=");
      const name = eq === -1 ? trimmed : trimmed.slice(0, eq);
      if (name !== COOKIE_NAME) continue;
      return eq === -1 ? "" : trimmed.slice(eq + 1);
    }
    return null;
  }

  function clearHandoffCookie(adapters) {
    const doc = adapterDocument(adapters);
    const loc = adapterLocation(adapters);
    if (!doc || !loc) return false;
    const path = handoffCookiePath(loc);
    doc.cookie = `${COOKIE_NAME}=; Path=${path}; Max-Age=0; SameSite=Lax${cookieSecureSuffix(loc)}`;
    return true;
  }

  const api = {
    KIND,
    VERSION,
    MAX_ENCODED_CHARS,
    MAX_COMPRESSED_BYTES,
    MAX_DECOMPRESSED_BYTES,
    canonicalize,
    validate,
    encode,
    decode,
    readSetupFragment,
    removeSetupFragment,
    handoffCookiePath,
    readHandoffCookie,
    writeHandoffCookie,
    clearHandoffCookie,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeSharedSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
