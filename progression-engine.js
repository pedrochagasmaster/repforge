(function (root) {
  "use strict";

  const ENGINE_VERSION = 1;
  const STRATEGY_IDS = Object.freeze(["range", "rep_goal", "effort_target", "anchor_backoff", "manual"]);
  const CAPACITY = Object.freeze({
    jumpMargin: 1,
    bigJumpMargin: 3,
    pushGap: 2,
    dropClamp: 0.05,
    baselineSessions: 3,
    temperFloor: 0.3,
    temperDamp: 0.5,
    temperClamp: 0.05,
    temperMinSets: 3,
  });
  const LIMITS = Object.freeze({
    workingSets: Object.freeze([1, 20]),
    reps: Object.freeze([1, 100]),
    repGoal: Object.freeze([1, 200]),
    targetRir: Object.freeze([0, 10]),
    hardRir: Object.freeze([1, 10]),
    minLoadIncrement: Object.freeze([0.000001, 1000]),
    jumpPercent: Object.freeze([0, 100]),
    historySessions: 1000,
    setsPerSession: 100,
  });
  const CANONICAL_LIMITS = Object.freeze({
    depth: 32,
    nodes: 1000,
    keys: 128,
    arrayItems: 128,
    stringLength: 4000,
  });

  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

  function median(values) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function unexpectedKeys(value, allowed) {
    return Object.keys(value).filter((key) => !allowed.has(key));
  }

  function inRange(value, limits) {
    return isFiniteNumber(value) && value >= limits[0] && value <= limits[1];
  }

  function integerInRange(value, limits) {
    return Number.isInteger(value) && inRange(value, limits);
  }

  function e1rm(load, reps) {
    return isFiniteNumber(load) && isFiniteNumber(reps) && load > 0 && reps > 0
      ? load * (1 + reps / 30)
      : 0;
  }

  function capRir(rir, hardRir) {
    const cap = inRange(hardRir, LIMITS.hardRir) ? hardRir : 4;
    const numeric = rir === "" || rir == null ? Number.NaN : Number(rir);
    return Math.min(Number.isFinite(numeric) ? Math.max(numeric, 0) : 1, cap);
  }

  function capReps(reps, rir, hardRir) {
    return Number(reps) + capRir(rir, hardRir);
  }

  function capE1rm(load, reps, rir, hardRir) {
    return e1rm(Number(load), capReps(reps, rir, hardRir));
  }

  function repsAtLoad(capacityE1rm, load) {
    if (!isFiniteNumber(capacityE1rm) || !isFiniteNumber(load) || capacityE1rm <= 0 || load <= 0) return 0;
    return Math.round(30 * (capacityE1rm / load - 1) * 1e6) / 1e6;
  }

  function roundToGrid(value, increment) {
    if (!isFiniteNumber(value) || !inRange(increment, LIMITS.minLoadIncrement)) return null;
    return Math.round(value / increment) * increment;
  }

  function jumpAmount(load, multiplier, settings) {
    if (!isFiniteNumber(load) || load <= 0 || !isFiniteNumber(multiplier) || multiplier <= 0) return null;
    const checked = validateSettings(settings);
    if (!checked.ok) return null;
    return Math.max(load * checked.value.jumpPercent * multiplier / 100, checked.value.minLoadIncrement);
  }

  function validationFailure(issues) {
    return { ok: false, code: "invalid-input", issues };
  }

  function validateSettings(settings) {
    const issues = [];
    if (!isPlainObject(settings)) return validationFailure(["settings: expected object"]);
    for (const key of unexpectedKeys(settings, new Set(["minLoadIncrement", "jumpPercent", "hardRir"]))) {
      issues.push(`settings.${key}: unknown key`);
    }
    if (!inRange(settings.minLoadIncrement, LIMITS.minLoadIncrement)) issues.push("settings.minLoadIncrement: out of range");
    if (!inRange(settings.jumpPercent, LIMITS.jumpPercent)) issues.push("settings.jumpPercent: out of range");
    if (!inRange(settings.hardRir, LIMITS.hardRir)) issues.push("settings.hardRir: out of range");
    if (issues.length) return validationFailure(issues);
    return {
      ok: true,
      value: {
        minLoadIncrement: settings.minLoadIncrement,
        jumpPercent: settings.jumpPercent,
        hardRir: settings.hardRir,
      },
    };
  }

  function validateRangePrescription(prescription) {
    const issues = [];
    if (!isPlainObject(prescription)) return validationFailure(["prescription: expected object"]);
    for (const key of unexpectedKeys(prescription, new Set(["schemaVersion", "strategy", "modifiers"]))) {
      issues.push(`prescription.${key}: unknown key`);
    }
    if (prescription.schemaVersion !== 1) issues.push("prescription.schemaVersion: unsupported");
    if (!Array.isArray(prescription.modifiers) || prescription.modifiers.length) {
      issues.push("prescription.modifiers: Wave 1 requires an empty array");
    }
    const strategy = prescription.strategy;
    if (!isPlainObject(strategy)) {
      issues.push("prescription.strategy: expected object");
      return validationFailure(issues);
    }
    for (const key of unexpectedKeys(strategy, new Set(["id", "version", "params"]))) {
      issues.push(`prescription.strategy.${key}: unknown key`);
    }
    if (strategy.id !== "range") issues.push("prescription.strategy.id: unsupported in Wave 1");
    if (strategy.version !== 1) issues.push("prescription.strategy.version: unsupported");
    const params = strategy.params;
    if (!isPlainObject(params)) {
      issues.push("prescription.strategy.params: expected object");
      return validationFailure(issues);
    }
    const allowedParams = new Set(["workingSets", "repMin", "repMax", "targetRirMin", "targetRirMax"]);
    for (const key of unexpectedKeys(params, allowedParams)) issues.push(`prescription.strategy.params.${key}: unknown key`);
    if (!integerInRange(params.workingSets, LIMITS.workingSets)) issues.push("prescription.strategy.params.workingSets: out of range");
    if (!integerInRange(params.repMin, LIMITS.reps)) issues.push("prescription.strategy.params.repMin: out of range");
    if (!integerInRange(params.repMax, LIMITS.reps)) issues.push("prescription.strategy.params.repMax: out of range");
    if (integerInRange(params.repMin, LIMITS.reps) && integerInRange(params.repMax, LIMITS.reps) && params.repMax < params.repMin) {
      issues.push("prescription.strategy.params.repMax: below repMin");
    }
    const hasRirMin = hasOwn(params, "targetRirMin");
    const hasRirMax = hasOwn(params, "targetRirMax");
    if (hasRirMin !== hasRirMax) issues.push("prescription.strategy.params.targetRir: both bounds required");
    if (hasRirMin && !inRange(params.targetRirMin, LIMITS.targetRir)) issues.push("prescription.strategy.params.targetRirMin: out of range");
    if (hasRirMax && !inRange(params.targetRirMax, LIMITS.targetRir)) issues.push("prescription.strategy.params.targetRirMax: out of range");
    if (hasRirMin && hasRirMax && inRange(params.targetRirMin, LIMITS.targetRir) && inRange(params.targetRirMax, LIMITS.targetRir) && params.targetRirMax < params.targetRirMin) {
      issues.push("prescription.strategy.params.targetRirMax: below targetRirMin");
    }
    if (issues.length) return validationFailure(issues);
    const normalizedParams = {
      workingSets: params.workingSets,
      repMin: params.repMin,
      repMax: params.repMax,
    };
    if (hasRirMin) {
      normalizedParams.targetRirMin = params.targetRirMin;
      normalizedParams.targetRirMax = params.targetRirMax;
    }
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        strategy: { id: "range", version: 1, params: normalizedParams },
        modifiers: [],
      },
    };
  }

  // These validators own only the versioned data boundary. They deliberately
  // do not infer pending strategy parameters or execute pending modifiers.
  function canonicalizeJson(value, path, state = { nodes: 0 }, depth = 0) {
    if (++state.nodes > CANONICAL_LIMITS.nodes) throw new TypeError(`${path}: structure too large`);
    if (depth > CANONICAL_LIMITS.depth) throw new TypeError(`${path}: structure too deep`);
    if (typeof value === "string") {
      if (value.length > CANONICAL_LIMITS.stringLength) throw new TypeError(`${path}: string too long`);
      return value;
    }
    if (value === null || typeof value === "boolean") return value;
    if (isFiniteNumber(value)) return value;
    if (Array.isArray(value)) {
      if (value.length > CANONICAL_LIMITS.arrayItems) throw new TypeError(`${path}: too many items`);
      return value.map((entry, index) => canonicalizeJson(entry, `${path}[${index}]`, state, depth + 1));
    }
    if (isPlainObject(value)) {
      if (Object.keys(value).length > CANONICAL_LIMITS.keys) throw new TypeError(`${path}: too many keys`);
      const result = {};
      for (const key of Object.keys(value).sort()) {
        const child = canonicalizeJson(value[key], `${path}.${key}`, state, depth + 1);
        Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
      }
      return result;
    }
    throw new TypeError(`${path}: expected JSON-safe value`);
  }

  function canonicalizeChecked(value, path) {
    try {
      return { ok: true, value: canonicalizeJson(value, path) };
    } catch (error) {
      return validationFailure([error.message]);
    }
  }

  function validateVersionedEnvelope(value, path, allowedKeys) {
    const issues = [];
    if (!isPlainObject(value)) return validationFailure([`${path}: expected object`]);
    for (const key of unexpectedKeys(value, allowedKeys)) issues.push(`${path}.${key}: unknown key`);
    if (value.schemaVersion !== 1) issues.push(`${path}.schemaVersion: unsupported`);
    return issues.length ? validationFailure(issues) : { ok: true, value };
  }

  function validatePrescription(prescription) {
    const envelope = validateVersionedEnvelope(
      prescription,
      "prescription",
      new Set(["schemaVersion", "strategy", "modifiers"]),
    );
    if (!envelope.ok) return envelope;
    const strategy = prescription.strategy;
    const issues = [];
    if (!isPlainObject(strategy)) return validationFailure(["prescription.strategy: expected object"]);
    for (const key of unexpectedKeys(strategy, new Set(["id", "version", "params"]))) {
      issues.push(`prescription.strategy.${key}: unknown key`);
    }
    if (!STRATEGY_IDS.includes(strategy.id)) issues.push("prescription.strategy.id: unsupported");
    if (strategy.version !== 1) issues.push("prescription.strategy.version: unsupported");
    if (!isPlainObject(strategy.params)) issues.push("prescription.strategy.params: expected object");
    if (issues.length) return validationFailure(issues);

    // A strategy whose parameter bounds are owner-approved is validated
    // against them. The rest are preserved as envelopes without inventing
    // rules they have not been given.
    if (strategy.id === "range") return validateRangePrescription(prescription);
    if (strategy.id === "rep_goal") return validateRepGoalPrescription(prescription);
    if (strategy.id === "effort_target") return validateEffortTargetPrescription(prescription);
    if (strategy.id === "anchor_backoff") return validateAnchorBackoffPrescription(prescription);

    const params = canonicalizeChecked(strategy.params, "prescription.strategy.params");
    if (!params.ok) return params;
    if (!Array.isArray(prescription.modifiers)) return validationFailure(["prescription.modifiers: expected array"]);
    const modifiers = validateModifiers(prescription.modifiers);
    if (!modifiers.ok) return modifiers;
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        strategy: { id: strategy.id, version: 1, params: params.value },
        modifiers: modifiers.value,
      },
    };
  }

  function canonicalizePrescription(prescription) {
    const checked = validatePrescription(prescription);
    if (!checked.ok) throw new TypeError(checked.issues.join("; "));
    return checked.value;
  }

  function normalizePrescription(prescription) {
    return validatePrescription(prescription);
  }

  function validateRelation(relation) {
    if (relation === null) return { ok: true, value: null };
    const envelope = validateVersionedEnvelope(
      relation,
      "relation",
      new Set(["schemaVersion", "id", "type", "version", "movementId", "members", "selfRole", "counterpart"]),
    );
    if (!envelope.ok) return envelope;
    const issues = [];
    const relationId = typeof relation.id === "string" ? relation.id.trim() : "";
    const movementId = typeof relation.movementId === "string" ? relation.movementId.trim() : "";
    if (!relationId) issues.push("relation.id: expected non-empty string");
    if (relation.type !== "paired_exposure") issues.push("relation.type: unsupported");
    if (relation.version !== 1) issues.push("relation.version: unsupported");
    if (!movementId) {
      issues.push("relation.movementId: expected non-empty string");
    }
    if (!Array.isArray(relation.members) || relation.members.length !== 2) {
      issues.push("relation.members: expected exactly two members");
    }
    if (issues.length) return validationFailure(issues);

    const roles = new Set();
    const exerciseIds = new Set();
    const members = [];
    for (let index = 0; index < relation.members.length; index++) {
      const member = relation.members[index];
      const path = `relation.members[${index}]`;
      if (!isPlainObject(member)) {
        issues.push(`${path}: expected object`);
        continue;
      }
      for (const key of unexpectedKeys(member, new Set(["exerciseId", "role"]))) {
        issues.push(`${path}.${key}: unknown key`);
      }
      const exerciseId = typeof member.exerciseId === "string" ? member.exerciseId.trim() : "";
      if (!exerciseId || exerciseIds.has(exerciseId)) {
        issues.push(`${path}.exerciseId: expected distinct non-empty string`);
      } else exerciseIds.add(exerciseId);
      if (member.role !== "heavy" && member.role !== "volume") issues.push(`${path}.role: unsupported`);
      else if (roles.has(member.role)) issues.push(`${path}.role: duplicate`);
      else roles.add(member.role);
      members.push({ exerciseId, role: member.role });
    }
    if (!roles.has("heavy") || !roles.has("volume")) issues.push("relation.members: heavy and volume roles required");
    // selfRole and counterpart are evaluation-time context, not part of the
    // persisted relation: they are validated here but never canonicalized, so
    // storage, backup, and setup links keep the same shape they always had.
    if (hasOwn(relation, "selfRole") && relation.selfRole !== "heavy" && relation.selfRole !== "volume") {
      issues.push("relation.selfRole: unsupported");
    }
    if (hasOwn(relation, "counterpart")) {
      const counterpart = relation.counterpart;
      if (!isPlainObject(counterpart)) issues.push("relation.counterpart: expected object");
      else {
        for (const key of unexpectedKeys(counterpart, new Set(["strategy", "sessionsInWindow", "mostRecentExpectedExposureCompleted", "status"]))) {
          issues.push(`relation.counterpart.${key}: unknown key`);
        }
        if (typeof counterpart.strategy !== "string" || !/^([a-z_]+)@[1-9][0-9]*$/.test(counterpart.strategy)) {
          issues.push("relation.counterpart.strategy: expected strategy version");
        }
        if (!Number.isInteger(counterpart.sessionsInWindow) || counterpart.sessionsInWindow < 0
          || counterpart.sessionsInWindow > PAIRED_WINDOW_SESSIONS) {
          issues.push("relation.counterpart.sessionsInWindow: out of range");
        }
        if (typeof counterpart.mostRecentExpectedExposureCompleted !== "boolean") {
          issues.push("relation.counterpart.mostRecentExpectedExposureCompleted: expected boolean");
        }
        if (hasOwn(counterpart, "status") && !["new", "advance", "hold", "reduce", "recalibrate", "manual"].includes(counterpart.status)) {
          issues.push("relation.counterpart.status: unsupported");
        }
      }
    }
    if (issues.length) return validationFailure(issues);
    members.sort((left, right) => left.role === "heavy" ? -1 : right.role === "heavy" ? 1 : left.exerciseId.localeCompare(right.exerciseId));
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        id: relationId,
        type: "paired_exposure",
        version: 1,
        movementId,
        members,
      },
    };
  }

  function canonicalizeRelation(relation) {
    const checked = validateRelation(relation);
    if (!checked.ok) throw new TypeError(checked.issues.join("; "));
    return checked.value;
  }

  function normalizeRelation(relation) {
    return validateRelation(relation);
  }

  function validateRelations(relations, options = {}) {
    if (!Array.isArray(relations)) return validationFailure(["relations: expected array"]);
    const issues = [];
    const ids = new Set();
    const slots = new Set();
    const value = [];
    for (let index = 0; index < relations.length; index++) {
      const checked = validateRelation(relations[index]);
      if (!checked.ok) {
        issues.push(...checked.issues.map((issue) => `relations[${index}].${issue}`));
        continue;
      }
      if (checked.value === null) {
        issues.push(`relations[${index}]: null relation is not a collection member`);
        continue;
      }
      if (ids.has(checked.value.id)) issues.push(`relations[${index}].id: duplicate`);
      ids.add(checked.value.id);
      for (const member of checked.value.members) {
        if (slots.has(member.exerciseId)) issues.push(`relations[${index}].members: slot belongs to multiple relations`);
        slots.add(member.exerciseId);
      }
      value.push(checked.value);
    }
    if (Array.isArray(options.slots)) {
      const liveSlots = new Map();
      for (const slot of options.slots) {
        if (!isPlainObject(slot) || typeof slot.id !== "string" || !slot.id.trim()) continue;
        liveSlots.set(slot.id.trim(), slot);
      }
      for (const relation of value) {
        for (const member of relation.members) {
          const slot = liveSlots.get(member.exerciseId);
          if (!slot) {
            issues.push(`relation.${relation.id}.members: unknown live slot ${member.exerciseId}`);
            continue;
          }
          const liveMovementId = typeof slot.movementId === "string" ? slot.movementId.trim() : "";
          if (!liveMovementId || liveMovementId !== relation.movementId) {
            issues.push(`relation.${relation.id}.members: movement identity mismatch for ${member.exerciseId}`);
          }
        }
      }
    }
    value.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    return issues.length ? validationFailure(issues) : { ok: true, value };
  }

  function canonicalizeRelations(relations) {
    const checked = validateRelations(relations);
    if (!checked.ok) throw new TypeError(checked.issues.join("; "));
    return checked.value;
  }

  function normalizeRelations(relations) {
    return validateRelations(relations);
  }

  function validateModifier(modifier) {
    if (!isPlainObject(modifier)) return validationFailure(["modifier: expected object"]);
    const issues = [];
    for (const key of unexpectedKeys(modifier, new Set(["schemaVersion", "id", "version", "compatibleStrategies", "weekNumber", "target", "weekValues", "params"]))) {
      issues.push(`modifier.${key}: unknown key`);
    }
    const modifierId = typeof modifier.id === "string" ? modifier.id.trim() : "";
    if (!modifierId) issues.push("modifier.id: expected non-empty string");
    if (!Number.isInteger(modifier.version) || modifier.version < 1) issues.push("modifier.version: expected positive integer");
    const compatibleStrategies = Array.isArray(modifier.compatibleStrategies)
      ? modifier.compatibleStrategies.map((strategy) => typeof strategy === "string" ? strategy.trim() : strategy)
      : [];
    if (!compatibleStrategies.length
      || compatibleStrategies.some((strategy) => typeof strategy !== "string" || !/^([a-z_]+)@[1-9][0-9]*$/.test(strategy))
      || new Set(compatibleStrategies).size !== compatibleStrategies.length) {
      issues.push("modifier.compatibleStrategies: expected non-empty strategy version list");
    }
    if (hasOwn(modifier, "weekNumber") && (!Number.isInteger(modifier.weekNumber) || modifier.weekNumber < 1 || modifier.weekNumber > 6)) {
      issues.push("modifier.weekNumber: out of range");
    }
    // A null target is how a modifier declares that it adjusts no field at
    // all — the shape identity_block@1 needs.
    if (hasOwn(modifier, "target") && modifier.target !== null
      && (typeof modifier.target !== "string" || !modifier.target.trim())) {
      issues.push("modifier.target: expected null or a non-empty string");
    }
    if (hasOwn(modifier, "schemaVersion") && modifier.schemaVersion !== 1) issues.push("modifier.schemaVersion: unsupported");
    if (hasOwn(modifier, "weekValues") && (!Array.isArray(modifier.weekValues) || modifier.weekValues.length !== 6
      || !modifier.weekValues.every((value) => isFiniteNumber(value)))) {
      issues.push("modifier.weekValues: expected six finite week values");
    }
    if (!isPlainObject(modifier.params)) issues.push("modifier.params: expected object");
    if (issues.length) return validationFailure(issues);
    const params = canonicalizeChecked(modifier.params, "modifier.params");
    if (!params.ok) return params;
    const value = {
      id: modifierId,
      version: modifier.version,
      compatibleStrategies: compatibleStrategies.slice().sort(),
    };
    if (hasOwn(modifier, "weekNumber")) value.weekNumber = modifier.weekNumber;
    if (hasOwn(modifier, "target")) value.target = modifier.target;
    if (hasOwn(modifier, "weekValues")) value.weekValues = modifier.weekValues.slice();
    value.params = params.value;
    return { ok: true, value };
  }

  function validateModifiers(modifiers) {
    if (!Array.isArray(modifiers)) return validationFailure(["modifiers: expected array"]);
    const issues = [];
    const identities = new Set();
    const value = [];
    for (let index = 0; index < modifiers.length; index++) {
      const checked = validateModifier(modifiers[index]);
      if (!checked.ok) {
        issues.push(...checked.issues.map((issue) => `modifiers[${index}].${issue}`));
        continue;
      }
      const identity = `${checked.value.id}@${checked.value.version}`;
      if (identities.has(identity)) issues.push(`modifiers[${index}]: duplicate`);
      identities.add(identity);
      value.push(checked.value);
    }
    return issues.length ? validationFailure(issues) : { ok: true, value };
  }

  function canonicalizeModifier(modifier) {
    const checked = validateModifier(modifier);
    if (!checked.ok) throw new TypeError(checked.issues.join("; "));
    return checked.value;
  }

  function normalizeModifier(modifier) {
    return validateModifier(modifier);
  }

  function canonicalizeModifiers(modifiers) {
    const checked = validateModifiers(modifiers);
    if (!checked.ok) throw new TypeError(checked.issues.join("; "));
    return checked.value;
  }

  function normalizeModifiers(modifiers) {
    return validateModifiers(modifiers);
  }

  // `role` is optional and additive. A set without one behaves exactly as it
  // always has, and range@1 ignores it entirely; it exists so anchor_backoff@1
  // can tell a logged back-off apart from a missing anchor.
  const SET_ROLES = Object.freeze(["working", "anchor", "backoff"]);

  function normalizeWorkingSet(set, path) {
    const issues = [];
    if (!isPlainObject(set)) return validationFailure([`${path}: expected object`]);
    for (const key of unexpectedKeys(set, new Set(["load", "reps", "rir", "role"]))) issues.push(`${path}.${key}: unknown key`);
    if (!isFiniteNumber(set.load) || set.load <= 0) issues.push(`${path}.load: expected positive finite number`);
    if (!Number.isInteger(set.reps) || set.reps <= 0 || set.reps > LIMITS.reps[1]) issues.push(`${path}.reps: out of range`);
    const rirIsBlank = set.rir === "" || set.rir == null;
    if (!rirIsBlank && !isFiniteNumber(set.rir)) issues.push(`${path}.rir: expected finite number or blank`);
    if (hasOwn(set, "role") && !SET_ROLES.includes(set.role)) issues.push(`${path}.role: unsupported`);
    if (issues.length) return validationFailure(issues);
    const value = { load: set.load, reps: set.reps, rir: rirIsBlank ? null : set.rir };
    if (hasOwn(set, "role")) value.role = set.role;
    return { ok: true, value };
  }

  function normalizeHistory(history) {
    const issues = [];
    if (!Array.isArray(history)) return validationFailure(["history: expected array"]);
    if (history.length > LIMITS.historySessions) issues.push("history: too many sessions");
    const value = [];
    const sessionIds = new Set();
    for (let index = 0; index < history.length; index++) {
      const session = history[index];
      const path = `history[${index}]`;
      if (!isPlainObject(session)) {
        issues.push(`${path}: expected object`);
        continue;
      }
      for (const key of unexpectedKeys(session, new Set(["sessionId", "date", "sets"]))) issues.push(`${path}.${key}: unknown key`);
      if (typeof session.sessionId !== "string" || !session.sessionId || sessionIds.has(session.sessionId)) {
        issues.push(`${path}.sessionId: expected unique non-empty string`);
      } else sessionIds.add(session.sessionId);
      if (typeof session.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)) issues.push(`${path}.date: expected YYYY-MM-DD`);
      if (!Array.isArray(session.sets) || !session.sets.length || session.sets.length > LIMITS.setsPerSession) {
        issues.push(`${path}.sets: invalid count`);
        continue;
      }
      const sets = [];
      for (let setIndex = 0; setIndex < session.sets.length; setIndex++) {
        const checked = normalizeWorkingSet(session.sets[setIndex], `${path}.sets[${setIndex}]`);
        if (!checked.ok) issues.push(...checked.issues);
        else sets.push(checked.value);
      }
      if (sets.length === session.sets.length) value.push({ sessionId: session.sessionId, date: session.date, sets });
    }
    if (issues.length) return validationFailure(issues);
    return { ok: true, value };
  }

  function normalizeCurrentSession(currentSession) {
    if (!Array.isArray(currentSession)) return validationFailure(["currentSession: expected array"]);
    if (currentSession.length > LIMITS.setsPerSession) return validationFailure(["currentSession: too many sets"]);
    const issues = [];
    const value = [];
    for (let index = 0; index < currentSession.length; index++) {
      const checked = normalizeWorkingSet(currentSession[index], `currentSession[${index}]`);
      if (!checked.ok) issues.push(...checked.issues);
      else value.push(checked.value);
    }
    return issues.length ? validationFailure(issues) : { ok: true, value };
  }

  function summarizeSession(session, hardRir) {
    const sets = session.sets;
    const loads = sets.map((set) => set.load);
    const reps = sets.map((set) => set.reps);
    const rawRirs = sets.map((set) => set.rir == null ? 0 : set.rir);
    const capacities = sets.map((set) => capE1rm(set.load, set.reps, set.rir, hardRir));
    const cappedRirs = sets.map((set) => capRir(set.rir, hardRir));
    return {
      sessionId: session.sessionId,
      date: session.date,
      sets: sets.map((set) => ({ load: set.load, reps: set.reps, rir: set.rir })),
      medianLoad: median(loads),
      minimumReps: Math.min(...reps),
      maximumReps: Math.max(...reps),
      medianReps: median(reps),
      averageRir: average(rawRirs),
      bestE1rm: Math.max(...sets.map((set) => e1rm(set.load, set.reps))),
      bestCapacity: Math.max(...capacities),
      medianCapacity: median(capacities),
      medianCappedRir: median(cappedRirs),
    };
  }

  function summarizeHistory(history, hardRir) {
    const checked = normalizeHistory(history);
    if (!checked.ok) return checked;
    return { ok: true, value: checked.value.map((session) => summarizeSession(session, hardRir)) };
  }

  function typicalRir(summaries) {
    const recent = summaries.slice(-CAPACITY.baselineSessions);
    return recent.length ? median(recent.map((session) => session.medianCappedRir)) : 1;
  }

  function expectedSetDrop(capacities, historicalDrops) {
    const observed = [];
    for (let index = 0; index + 1 < capacities.length; index++) {
      if (capacities[index] > 0) observed.push(Math.max(0, (capacities[index] - capacities[index + 1]) / capacities[index]));
    }
    const fallback = Array.isArray(historicalDrops) && historicalDrops.length ? median(historicalDrops) : 0;
    return clamp(observed.length ? average(observed) : fallback, 0, CAPACITY.dropClamp);
  }

  function isStalled(summaries) {
    if (summaries.length < 3) return false;
    const recent = summaries.slice(-3);
    const load = recent[0].medianLoad;
    const reps = recent[0].maximumReps;
    return recent.every((session) => Math.abs(session.medianLoad - load) < 0.01)
      && recent.every((session) => session.maximumReps <= reps);
  }

  function recoverSignal(summaries, rirCeiling) {
    if (summaries.length < 2) return false;
    const latest = summaries.at(-1);
    const prior = summaries.at(-2);
    if (latest.averageRir > rirCeiling) return false;
    if (latest.medianLoad - prior.medianLoad >= 0.01) return false;
    return latest.maximumReps <= prior.maximumReps && latest.medianReps <= prior.medianReps;
  }

  function blockTrend(summaries, blockStart) {
    if (blockStart == null) return { direction: null, sessionCount: 0 };
    const block = summaries.filter((session) => session.date >= blockStart);
    if (block.length < 3) return { direction: null, sessionCount: block.length };
    const values = block.map((session) => session.bestE1rm);
    if (values.some((value) => value <= 0)) return { direction: null, sessionCount: block.length };
    const xMean = (values.length - 1) / 2;
    const yMean = average(values);
    let covariance = 0;
    let variance = 0;
    values.forEach((value, index) => {
      covariance += (index - xMean) * (value - yMean);
      variance += (index - xMean) ** 2;
    });
    const projectedChange = variance && yMean ? covariance / variance * (values.length - 1) / yMean : 0;
    return {
      direction: projectedChange >= 0.02 ? "rising" : projectedChange <= -0.02 ? "falling" : "flat",
      sessionCount: block.length,
      ratio: 1 + projectedChange,
    };
  }

  function historicalSetDrops(summaries, hardRir) {
    const drops = [];
    for (const session of summaries.slice(-CAPACITY.baselineSessions)) {
      const capacities = session.sets.map((set) => capE1rm(set.load, set.reps, set.rir, hardRir));
      for (let index = 0; index + 1 < capacities.length; index++) {
        if (capacities[index] > 0) drops.push(Math.max(0, (capacities[index] - capacities[index + 1]) / capacities[index]));
      }
    }
    return drops;
  }

  const sameLoad = (left, right) => left != null && right != null && Math.abs(left - right) <= 1e-6;

  function reentryReps(params, capacity, load, recentRir) {
    return clamp(Math.round(repsAtLoad(capacity, load) - (recentRir || 0)), params.repMin, params.repMax);
  }

  function validateContext(context) {
    const issues = [];
    if (!isPlainObject(context)) return validationFailure(["context: expected object"]);
    for (const key of unexpectedKeys(context, new Set(["weekNumber", "blockLength", "blockStart", "freshnessFactor"]))) {
      issues.push(`context.${key}: unknown key`);
    }
    if (!Number.isInteger(context.blockLength) || context.blockLength < 1 || context.blockLength > 52) issues.push("context.blockLength: out of range");
    if (!Number.isInteger(context.weekNumber) || context.weekNumber < 1 || context.weekNumber > context.blockLength) issues.push("context.weekNumber: out of range");
    if (context.blockStart !== null && (typeof context.blockStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(context.blockStart))) {
      issues.push("context.blockStart: expected null or YYYY-MM-DD");
    }
    if (hasOwn(context, "freshnessFactor") && (!isFiniteNumber(context.freshnessFactor)
      || context.freshnessFactor < 1 - CAPACITY.temperClamp || context.freshnessFactor > 1)) {
      issues.push("context.freshnessFactor: out of range");
    }
    if (issues.length) return validationFailure(issues);
    const value = {
      weekNumber: context.weekNumber,
      blockLength: context.blockLength,
      blockStart: context.blockStart,
    };
    if (hasOwn(context, "freshnessFactor")) value.freshnessFactor = context.freshnessFactor;
    return { ok: true, value };
  }

  function baseResult(kind, status, strategy, reasonCodes, target, facts, provenance) {
    return {
      kind,
      engineVersion: ENGINE_VERSION,
      strategy,
      target: { sets: target },
      status,
      reasonCodes,
      facts,
      provenance,
    };
  }

  function invalidResult(strategy, issues) {
    return baseResult(
      "invalid",
      "manual",
      strategy,
      ["engine.invalid_input"],
      [],
      { issues: issues.slice() },
      { evidenceWindow: { sessionCount: 0, currentSetCount: 0 }, modifierVersions: [], relationVersion: null },
    );
  }

  function incompatibleResult(strategy, reason) {
    return baseResult(
      "incompatible",
      "manual",
      strategy,
      [reason],
      [],
      {},
      { evidenceWindow: { sessionCount: 0, currentSetCount: 0 }, modifierVersions: [], relationVersion: null },
    );
  }

  function manualResult(strategy, reason, provenance) {
    return baseResult(
      "manual",
      "manual",
      strategy,
      [reason],
      [],
      {},
      provenance,
    );
  }

  /* ---- rep_goal@1 -------------------------------------------------------
     Owner-approved 2026-08-27 and locked in
     test/fixtures/progression-strategies-v1.json. The strategy owns a total
     working-rep goal across a fixed authored set count. It never changes the
     set count and it never rewrites the authored goal. */

  function validateRepGoalPrescription(prescription) {
    const issues = [];
    if (!isPlainObject(prescription)) return validationFailure(["prescription: expected object"]);
    for (const key of unexpectedKeys(prescription, new Set(["schemaVersion", "strategy", "modifiers"]))) {
      issues.push(`prescription.${key}: unknown key`);
    }
    if (prescription.schemaVersion !== 1) issues.push("prescription.schemaVersion: unsupported");
    if (!Array.isArray(prescription.modifiers) || prescription.modifiers.length) {
      issues.push("prescription.modifiers: Wave 2 requires an empty array");
    }
    const strategy = prescription.strategy;
    if (!isPlainObject(strategy)) return validationFailure(issues.concat(["prescription.strategy: expected object"]));
    const params = strategy.params;
    if (!isPlainObject(params)) return validationFailure(issues.concat(["prescription.strategy.params: expected object"]));
    const allowed = new Set([
      "workingSets", "repGoal", "repFloor", "repCeiling",
      "targetRirMin", "targetRirMax", "minLoadIncrement", "jumpPercent",
      "distributionPolicy", "loadMode",
    ]);
    for (const key of unexpectedKeys(params, allowed)) issues.push(`prescription.strategy.params.${key}: unknown key`);
    if (!integerInRange(params.workingSets, LIMITS.workingSets)) issues.push("params.workingSets: out of range");
    if (!integerInRange(params.repGoal, LIMITS.repGoal)) issues.push("params.repGoal: out of range");
    if (!integerInRange(params.repFloor, LIMITS.reps)) issues.push("params.repFloor: out of range");
    if (!integerInRange(params.repCeiling, LIMITS.reps) || params.repCeiling < params.repFloor) {
      issues.push("params.repCeiling: out of range");
    }
    if (!inRange(params.targetRirMin, LIMITS.targetRir)) issues.push("params.targetRirMin: out of range");
    if (!inRange(params.targetRirMax, LIMITS.targetRir) || params.targetRirMax < params.targetRirMin) {
      issues.push("params.targetRirMax: out of range");
    }
    if (!inRange(params.minLoadIncrement, LIMITS.minLoadIncrement)) issues.push("params.minLoadIncrement: out of range");
    if (!inRange(params.jumpPercent, LIMITS.jumpPercent)) issues.push("params.jumpPercent: out of range");
    if (params.distributionPolicy !== "balanced_frontload_v1") issues.push("params.distributionPolicy: unsupported");
    if (hasOwn(params, "loadMode") && params.loadMode !== "external" && params.loadMode !== "bodyweight") {
      issues.push("params.loadMode: unsupported");
    }
    if (issues.length) return validationFailure(issues);
    const value = {
      workingSets: params.workingSets,
      repGoal: params.repGoal,
      repFloor: params.repFloor,
      repCeiling: params.repCeiling,
      targetRirMin: params.targetRirMin,
      targetRirMax: params.targetRirMax,
      minLoadIncrement: params.minLoadIncrement,
      jumpPercent: params.jumpPercent,
      distributionPolicy: params.distributionPolicy,
    };
    if (hasOwn(params, "loadMode")) value.loadMode = params.loadMode;
    return { ok: true, value: { schemaVersion: 1, strategy: { id: "rep_goal", version: 1, params: value }, modifiers: [] } };
  }

  function validateEffortTargetPrescription(prescription) {
    const issues = [];
    if (!isPlainObject(prescription)) return validationFailure(["prescription: expected object"]);
    for (const key of unexpectedKeys(prescription, new Set(["schemaVersion", "strategy", "modifiers"]))) {
      issues.push(`prescription.${key}: unknown key`);
    }
    if (prescription.schemaVersion !== 1) issues.push("prescription.schemaVersion: unsupported");
    if (!Array.isArray(prescription.modifiers) || prescription.modifiers.length) {
      issues.push("prescription.modifiers: Wave 2 requires an empty array");
    }
    const strategy = prescription.strategy;
    if (!isPlainObject(strategy)) return validationFailure(issues.concat(["prescription.strategy: expected object"]));
    for (const key of unexpectedKeys(strategy, new Set(["id", "version", "params"]))) {
      issues.push(`prescription.strategy.${key}: unknown key`);
    }
    if (strategy.id !== "effort_target") issues.push("prescription.strategy.id: unsupported");
    if (strategy.version !== 1) issues.push("prescription.strategy.version: unsupported");
    const params = strategy.params;
    if (!isPlainObject(params)) return validationFailure(issues.concat(["prescription.strategy.params: expected object"]));
    const allowed = new Set([
      "workingSets", "targetReps", "targetRirMin", "targetRirMax", "minLoadIncrement", "loadMode",
    ]);
    for (const key of unexpectedKeys(params, allowed)) issues.push(`prescription.strategy.params.${key}: unknown key`);
    if (!integerInRange(params.workingSets, LIMITS.workingSets)) issues.push("params.workingSets: out of range");
    if (!integerInRange(params.targetReps, LIMITS.reps)) issues.push("params.targetReps: out of range");
    if (!inRange(params.targetRirMin, LIMITS.targetRir)) issues.push("params.targetRirMin: out of range");
    if (!inRange(params.targetRirMax, LIMITS.targetRir) || params.targetRirMax < params.targetRirMin) {
      issues.push("params.targetRirMax: out of range");
    }
    if (!inRange(params.minLoadIncrement, LIMITS.minLoadIncrement)) issues.push("params.minLoadIncrement: out of range");
    if (hasOwn(params, "loadMode") && params.loadMode !== "external" && params.loadMode !== "bodyweight") {
      issues.push("params.loadMode: unsupported");
    }
    if (issues.length) return validationFailure(issues);
    const value = {
      workingSets: params.workingSets,
      targetReps: params.targetReps,
      targetRirMin: params.targetRirMin,
      targetRirMax: params.targetRirMax,
      minLoadIncrement: params.minLoadIncrement,
    };
    if (hasOwn(params, "loadMode")) value.loadMode = params.loadMode;
    return {
      ok: true,
      value: { schemaVersion: 1, strategy: { id: "effort_target", version: 1, params: value }, modifiers: [] },
    };
  }

  // The authored goal has to be reachable inside the authored per-set window.
  // A prescription that fails this is unsatisfiable rather than malformed, so
  // it gets the strategy's own code instead of engine.invalid_input.
  function repGoalIsSatisfiable(params) {
    return params.workingSets * params.repFloor <= params.repGoal
      && params.repGoal <= params.workingSets * params.repCeiling;
  }

  // balanced_frontload_v1: split evenly, give the remainder to the earlier
  // sets, clamp every set into the authored window. The clamp is what keeps a
  // catch-up set off the ceiling and a small remainder off the floor.
  function balancedFrontload(total, sets, repFloor, repCeiling) {
    const goal = Math.max(0, total);
    const base = Math.floor(goal / sets);
    const remainder = goal % sets;
    return Array.from({ length: sets }, (unused, index) => clamp(base + (index < remainder ? 1 : 0), repFloor, repCeiling));
  }

  function frontloadShare(total, sets) {
    const goal = Math.max(0, total);
    return Math.floor(goal / sets) + (goal % sets > 0 ? 1 : 0);
  }

  // The most one set can be asked for at this load on this evidence.
  function perSetCapacity(params, capacity, load) {
    return clamp(Math.floor(repsAtLoad(capacity, load)), params.repFloor, params.repCeiling);
  }

  function repGoalSets(params, load, distribution) {
    return distribution.map((reps) => ({
      role: "working",
      load,
      reps,
      repMin: params.repFloor,
      repMax: params.repCeiling,
      targetRir: params.targetRirMax,
    }));
  }

  const repGoalJump = (params, load) => Math.max(load * params.jumpPercent / 100, params.minLoadIncrement);

  function evaluateNextRepGoal(params, settings, summaries, provenance) {
    const strategy = { id: "rep_goal", version: 1 };
    if (!summaries.length) {
      const distribution = balancedFrontload(params.repGoal, params.workingSets, params.repFloor, params.repCeiling);
      return baseResult("recommendation", "new", strategy, ["rep_goal.no_history"],
        repGoalSets(params, null, distribution),
        { repGoal: params.repGoal, distribution, targetLoad: null }, provenance);
    }
    // Only the authored working sets are goal evidence. Extra sets stay
    // recorded evidence: they never earn the goal and never redefine the
    // authored set count.
    const latest = summaries.at(-1);
    const authored = latest.sets.slice(0, params.workingSets);
    const performedTotal = authored.reduce((total, set) => total + set.reps, 0);
    const referenceLoad = median(authored.map((set) => set.load));
    const capacity = median(authored.map((set) => capE1rm(set.load, set.reps, set.rir, settings.hardRir)));
    const medianRir = median(authored.map((set) => capRir(set.rir, settings.hardRir)));
    const capacityReps = repsAtLoad(capacity, referenceLoad);
    const goalEarned = latest.sets.length >= params.workingSets && performedTotal >= params.repGoal;
    const facts = {
      repGoal: params.repGoal,
      performedTotal,
      latestLoad: referenceLoad,
      capacityE1rm: capacity,
      capacityReps,
      medianTrustedRir: medianRir,
      goalEarned,
    };

    // targetRirMax describes acceptable room, not a second hurdle, and
    // exceeding the goal never earns a double jump.
    if (goalEarned && medianRir >= params.targetRirMin) {
      const rawLoad = referenceLoad + repGoalJump(params, referenceLoad);
      const load = roundToGrid(rawLoad, settings.minLoadIncrement);
      const reasonCodes = ["rep_goal.goal_met", "rep_goal.advance"];
      if (Math.abs(load - rawLoad) > 1e-9) reasonCodes.push("rep_goal.grid_rounded");
      // The authored goal is never lowered. When capacity cannot carry it at
      // the new load, prescribe the closest bounded feasible total and say the
      // target is rebuilding toward the goal.
      const cap = perSetCapacity(params, capacity, load);
      const feasible = params.workingSets * cap;
      const total = params.repGoal > feasible ? feasible : params.repGoal;
      if (total !== params.repGoal) reasonCodes.push("rep_goal.rebuild_after_advance");
      const distribution = balancedFrontload(total, params.workingSets, params.repFloor, params.repCeiling);
      return baseResult("recommendation", "advance", strategy, reasonCodes,
        repGoalSets(params, load, distribution),
        { ...facts, targetLoad: load, perSetCapacity: cap, prescribedTotal: total, distribution }, provenance);
    }

    const heldLoad = roundToGrid(referenceLoad, settings.minLoadIncrement);
    const distribution = balancedFrontload(params.repGoal, params.workingSets, params.repFloor, params.repCeiling);
    if (goalEarned) {
      return baseResult("recommendation", "hold", strategy, ["rep_goal.goal_met", "rep_goal.effort_too_high"],
        repGoalSets(params, heldLoad, distribution),
        { ...facts, targetLoad: heldLoad, distribution }, provenance);
    }
    // A conservative capacity floor, not a plateau algorithm: missing the
    // total on its own never reduces load.
    if (capacityReps < params.repFloor) {
      const rawLoad = referenceLoad - repGoalJump(params, referenceLoad);
      const load = Math.max(roundToGrid(rawLoad, settings.minLoadIncrement), settings.minLoadIncrement);
      const reasonCodes = ["rep_goal.capacity_below_floor"];
      if (Math.abs(load - rawLoad) > 1e-9) reasonCodes.push("rep_goal.grid_rounded");
      return baseResult("recommendation", "reduce", strategy, reasonCodes,
        repGoalSets(params, load, distribution),
        { ...facts, targetLoad: load, distribution }, provenance);
    }
    return baseResult("recommendation", "hold", strategy, ["rep_goal.progress"],
      repGoalSets(params, heldLoad, distribution),
      { ...facts, targetLoad: heldLoad, distribution }, provenance);
  }

  function evaluateCurrentRepGoal(params, settings, summaries, currentSession, provenance) {
    const strategy = { id: "rep_goal", version: 1 };
    const completed = currentSession.slice(0, params.workingSets);
    const completedReps = completed.reduce((total, set) => total + set.reps, 0);
    const untouched = Math.max(0, params.workingSets - currentSession.length);
    const load = currentSession.at(-1).load;
    const remaining = params.repGoal - completedReps;
    const facts = {
      repGoal: params.repGoal,
      completedReps,
      remainingGoal: remaining,
      untouchedSets: untouched,
      latestLoad: load,
      targetLoad: load,
    };
    if (!untouched) {
      // Every authored set is done, so there is nothing further to prescribe.
      return baseResult("recommendation", "hold", strategy,
        [remaining <= 0 ? "rep_goal.goal_met" : "rep_goal.current_progress"], [], facts, provenance);
    }
    const capacities = currentSession.map((set) => capE1rm(set.load, set.reps, set.rir, settings.hardRir));
    const drop = expectedSetDrop(capacities, historicalSetDrops(summaries, settings.hardRir));
    const predictedCapacity = capacities.at(-1) * (1 - drop);
    const cap = perSetCapacity(params, predictedCapacity, load);
    const share = frontloadShare(remaining, untouched);
    const reps = clamp(Math.min(share, cap), params.repFloor, params.repCeiling);
    const reasonCodes = ["rep_goal.current_progress"];
    if (drop > 0) reasonCodes.push("rep_goal.current_drop");
    // The drop and the authored window shape the distribution. Neither ever
    // changes the authored total.
    if (reps !== share) reasonCodes.push("rep_goal.partial_distribution");
    return baseResult("recommendation", "hold", strategy, reasonCodes,
      repGoalSets(params, load, [reps]),
      {
        ...facts,
        expectedSetDrop: drop,
        capacityE1rm: predictedCapacity,
        capacityReps: repsAtLoad(predictedCapacity, load),
        perSetCapacity: cap,
        exactShare: share,
        targetReps: reps,
      },
      provenance);
  }

  function effortTargetSets(params, load, count = params.workingSets) {
    return Array.from({ length: count }, () => ({
      role: "working",
      load,
      reps: params.targetReps,
      repMin: params.targetReps,
      repMax: params.targetReps,
      targetRir: params.targetRirMax,
      targetRirMin: params.targetRirMin,
      targetRirMax: params.targetRirMax,
    }));
  }

  function effortTargetFacts(params, values = {}) {
    return {
      targetReps: params.targetReps,
      targetRirMin: params.targetRirMin,
      targetRirMax: params.targetRirMax,
      ...values,
    };
  }

  function evaluateNextEffortTarget(params, settings, summaries, provenance) {
    const strategy = { id: "effort_target", version: 1 };
    if (!summaries.length) {
      return baseResult("recommendation", "new", strategy, ["effort_target.no_history"],
        effortTargetSets(params, null),
        effortTargetFacts(params, {
          representativeLoad: null,
          representativeReps: null,
          representativeRir: null,
          rawRecommendedLoad: null,
          targetLoad: null,
          evidenceSetCount: 0,
          evidenceSessionCount: 0,
        }), provenance);
    }

    const increment = settings.minLoadIncrement || params.minLoadIncrement;
    const latestActionable = summaries.at(-1);
    const direct = summaries.slice().reverse().find((session) => session.sets.some((set) => isFiniteNumber(set.rir)));
    if (!direct) {
      const representativeLoad = median(latestActionable.sets.map((set) => set.load));
      const targetLoad = Math.max(roundToGrid(representativeLoad, increment), increment);
      const reasonCodes = ["effort_target.no_rir_evidence"];
      if (!sameLoad(targetLoad, representativeLoad)) reasonCodes.push("effort_target.grid_rounded");
      return baseResult("recommendation", "hold", strategy, reasonCodes,
        effortTargetSets(params, targetLoad),
        effortTargetFacts(params, {
          representativeLoad,
          representativeReps: median(latestActionable.sets.map((set) => set.reps)),
          representativeRir: null,
          rawRecommendedLoad: representativeLoad,
          targetLoad,
          evidenceSetCount: latestActionable.sets.length,
          evidenceSessionCount: summaries.length,
        }), provenance);
    }

    const representativeLoad = median(direct.sets.map((set) => set.load));
    const representativeReps = median(direct.sets.map((set) => set.reps));
    const finiteRirs = direct.sets.filter((set) => isFiniteNumber(set.rir)).map((set) => set.rir);
    const representativeRir = median(finiteRirs);
    const actionableLoad = Math.max(roundToGrid(representativeLoad, increment), increment);
    let status = "hold";
    let reason = "effort_target.on_target";
    let movement = 0;
    if (representativeReps < params.targetReps) {
      status = "reduce";
      reason = "effort_target.rep_miss";
      movement = -increment;
    } else if (representativeRir < params.targetRirMin) {
      status = "reduce";
      reason = "effort_target.too_hard";
      movement = -increment;
    } else if (representativeRir > params.targetRirMax) {
      status = "advance";
      reason = "effort_target.too_easy";
      movement = increment;
    }
    const rawRecommendedLoad = actionableLoad + movement;
    const targetLoad = Math.max(roundToGrid(rawRecommendedLoad, increment), increment);
    const reasonCodes = [reason];
    if (!sameLoad(actionableLoad, representativeLoad) || !sameLoad(targetLoad, rawRecommendedLoad)) {
      reasonCodes.push("effort_target.grid_rounded");
    }
    return baseResult("recommendation", status, strategy, reasonCodes,
      effortTargetSets(params, targetLoad),
      effortTargetFacts(params, {
        representativeLoad,
        representativeReps,
        representativeRir,
        rawRecommendedLoad,
        targetLoad,
        evidenceSetCount: direct.sets.length,
        evidenceSessionCount: summaries.length,
      }), provenance);
  }

  function evaluateCurrentEffortTarget(params, settings, currentSession, provenance) {
    const strategy = { id: "effort_target", version: 1 };
    const untouched = Math.max(0, params.workingSets - currentSession.length);
    const latest = currentSession.at(-1);
    const increment = settings.minLoadIncrement || params.minLoadIncrement;
    const actionableLoad = Math.max(roundToGrid(latest.load, increment), increment);
    let status = "hold";
    let reason = "effort_target.current_hold";
    let movement = 0;
    if (latest.reps < params.targetReps || (isFiniteNumber(latest.rir) && latest.rir < params.targetRirMin)) {
      status = "reduce";
      reason = "effort_target.current_reduce";
      movement = -increment;
    } else if (isFiniteNumber(latest.rir) && latest.reps >= params.targetReps && latest.rir > params.targetRirMax) {
      status = "advance";
      reason = "effort_target.current_advance";
      movement = increment;
    }
    const rawRecommendedLoad = actionableLoad + movement;
    const targetLoad = Math.max(roundToGrid(rawRecommendedLoad, increment), increment);
    const reasonCodes = [reason];
    if (!sameLoad(actionableLoad, latest.load) || !sameLoad(targetLoad, rawRecommendedLoad)) {
      reasonCodes.push("effort_target.grid_rounded");
    }
    return baseResult("recommendation", status, strategy, reasonCodes,
      untouched ? effortTargetSets(params, targetLoad, 1) : [],
      effortTargetFacts(params, {
        representativeLoad: latest.load,
        representativeReps: latest.reps,
        representativeRir: isFiniteNumber(latest.rir) ? latest.rir : null,
        rawRecommendedLoad,
        targetLoad,
        evidenceSetCount: currentSession.length,
        evidenceSessionCount: 0,
        untouchedSets: untouched,
      }), provenance);
  }

  /* ---- anchor_backoff@1 -------------------------------------------------
     Owner-approved 2026-08-27 and deliberately narrow: one anchor working set
     plus authored back-offs, one derivation method, no peaking, no attempt
     selection, no deload. */

  const BACKOFF_PERCENT = Object.freeze([0.7, 0.95]);

  function validateAnchorBackoffPrescription(prescription) {
    const issues = [];
    if (!isPlainObject(prescription)) return validationFailure(["prescription: expected object"]);
    for (const key of unexpectedKeys(prescription, new Set(["schemaVersion", "strategy", "modifiers"]))) {
      issues.push(`prescription.${key}: unknown key`);
    }
    if (prescription.schemaVersion !== 1) issues.push("prescription.schemaVersion: unsupported");
    if (!Array.isArray(prescription.modifiers) || prescription.modifiers.length) {
      issues.push("prescription.modifiers: Wave 2 requires an empty array");
    }
    const strategy = prescription.strategy;
    if (!isPlainObject(strategy)) return validationFailure(issues.concat(["prescription.strategy: expected object"]));
    const params = strategy.params;
    if (!isPlainObject(params)) return validationFailure(issues.concat(["prescription.strategy.params: expected object"]));
    const allowed = new Set([
      "anchorRepMin", "anchorRepMax", "anchorTargetRirMin", "anchorTargetRirMax",
      "backoffSets", "backoffRepMin", "backoffRepMax", "backoffPercent",
      "minLoadIncrement", "jumpPercent", "loadMode",
    ]);
    for (const key of unexpectedKeys(params, allowed)) issues.push(`prescription.strategy.params.${key}: unknown key`);
    if (!integerInRange(params.anchorRepMin, LIMITS.reps)) issues.push("params.anchorRepMin: out of range");
    if (!integerInRange(params.anchorRepMax, LIMITS.reps) || params.anchorRepMax < params.anchorRepMin) {
      issues.push("params.anchorRepMax: out of range");
    }
    if (!inRange(params.anchorTargetRirMin, LIMITS.targetRir)) issues.push("params.anchorTargetRirMin: out of range");
    if (!inRange(params.anchorTargetRirMax, LIMITS.targetRir) || params.anchorTargetRirMax < params.anchorTargetRirMin) {
      issues.push("params.anchorTargetRirMax: out of range");
    }
    if (!integerInRange(params.backoffSets, LIMITS.workingSets)) issues.push("params.backoffSets: out of range");
    if (!integerInRange(params.backoffRepMin, LIMITS.reps)) issues.push("params.backoffRepMin: out of range");
    if (!integerInRange(params.backoffRepMax, LIMITS.reps) || params.backoffRepMax < params.backoffRepMin) {
      issues.push("params.backoffRepMax: out of range");
    }
    // The percentage is authored inside the approved band. It is never
    // inferred from a family, program name, movement, or training goal.
    if (!inRange(params.backoffPercent, BACKOFF_PERCENT)) issues.push("params.backoffPercent: out of range");
    if (!inRange(params.minLoadIncrement, LIMITS.minLoadIncrement)) issues.push("params.minLoadIncrement: out of range");
    if (!inRange(params.jumpPercent, LIMITS.jumpPercent)) issues.push("params.jumpPercent: out of range");
    if (hasOwn(params, "loadMode") && params.loadMode !== "external" && params.loadMode !== "bodyweight") {
      issues.push("params.loadMode: unsupported");
    }
    if (issues.length) return validationFailure(issues);
    const value = {
      anchorRepMin: params.anchorRepMin,
      anchorRepMax: params.anchorRepMax,
      anchorTargetRirMin: params.anchorTargetRirMin,
      anchorTargetRirMax: params.anchorTargetRirMax,
      backoffSets: params.backoffSets,
      backoffRepMin: params.backoffRepMin,
      backoffRepMax: params.backoffRepMax,
      backoffPercent: params.backoffPercent,
      minLoadIncrement: params.minLoadIncrement,
      jumpPercent: params.jumpPercent,
    };
    if (hasOwn(params, "loadMode")) value.loadMode = params.loadMode;
    return { ok: true, value: { schemaVersion: 1, strategy: { id: "anchor_backoff", version: 1, params: value }, modifiers: [] } };
  }

  // percentage_of_anchor_load_v1: the anchor load times the authored
  // percentage, snapped to the actionable grid. There is no effort-derived
  // percentage in v1.
  function derivedBackoff(params, settings, anchorLoad, anchorCapacity) {
    const raw = anchorLoad * params.backoffPercent;
    const load = Math.max(roundToGrid(raw, settings.minLoadIncrement), settings.minLoadIncrement);
    return {
      load,
      reps: clamp(Math.floor(repsAtLoad(anchorCapacity, load)), params.backoffRepMin, params.backoffRepMax),
      snapped: Math.abs(load - raw) > 1e-9,
    };
  }

  function anchorSet(params, load, reps) {
    return { role: "anchor", load, reps, repMin: params.anchorRepMin, repMax: params.anchorRepMax, targetRir: params.anchorTargetRirMax };
  }

  function backoffSet(params, load, reps) {
    return { role: "backoff", load, reps, repMin: params.backoffRepMin, repMax: params.backoffRepMax, targetRir: params.anchorTargetRirMax };
  }

  // Where today's anchor is. With no explicit roles the session's first set is
  // the anchor; with explicit roles and no anchor among them, today's anchor
  // is genuinely absent and -1 says so.
  function currentAnchorIndex(currentSession) {
    const explicit = currentSession.findIndex((set) => set.role === "anchor");
    if (explicit >= 0) return explicit;
    return currentSession.some((set) => set.role != null) ? -1 : 0;
  }

  // The anchor decision from prior evidence: the same narrow range-style rule
  // for advance, hold, and reduce. No double jump and no deload.
  function priorAnchorDecision(params, settings, summaries) {
    const anchor = summaries.at(-1).sets[0];
    const capacity = capE1rm(anchor.load, anchor.reps, anchor.rir, settings.hardRir);
    const capacityReps = repsAtLoad(capacity, anchor.load);
    const rir = capRir(anchor.rir, settings.hardRir);
    const jump = Math.max(anchor.load * params.jumpPercent / 100, params.minLoadIncrement);
    let rawLoad;
    let status;
    let decision;
    if (capacityReps < params.anchorRepMin) {
      rawLoad = anchor.load - jump;
      status = "reduce";
      decision = "anchor_backoff.anchor_below_floor";
    } else if (anchor.reps >= params.anchorRepMax && rir >= params.anchorTargetRirMin) {
      rawLoad = anchor.load + jump;
      status = "advance";
      decision = "anchor_backoff.anchor_advance";
    } else {
      rawLoad = anchor.load;
      status = "hold";
      decision = "anchor_backoff.anchor_hold";
    }
    const load = Math.max(roundToGrid(rawLoad, settings.minLoadIncrement), settings.minLoadIncrement);
    return {
      status,
      decision,
      capacity,
      capacityReps,
      performedLoad: anchor.load,
      load,
      snapped: Math.abs(load - rawLoad) > 1e-9,
      reps: clamp(Math.floor(repsAtLoad(capacity, load)), params.anchorRepMin, params.anchorRepMax),
    };
  }

  function evaluateNextAnchorBackoff(params, settings, summaries, provenance) {
    const strategy = { id: "anchor_backoff", version: 1 };
    if (!summaries.length) {
      return baseResult("recommendation", "new", strategy, ["anchor_backoff.no_history"],
        [anchorSet(params, null, params.anchorRepMin),
          ...Array.from({ length: params.backoffSets }, () => backoffSet(params, null, params.backoffRepMin))],
        { targetLoad: null, backoffPercent: params.backoffPercent }, provenance);
    }
    const decision = priorAnchorDecision(params, settings, summaries);
    const back = derivedBackoff(params, settings, decision.load, decision.capacity);
    const reasonCodes = ["anchor_backoff.prior_anchor", decision.decision, "anchor_backoff.backoff_percent"];
    if (decision.snapped || back.snapped) reasonCodes.push("anchor_backoff.grid_rounded");
    return baseResult("recommendation", decision.status, strategy, reasonCodes,
      [anchorSet(params, decision.load, decision.reps),
        ...Array.from({ length: params.backoffSets }, () => backoffSet(params, back.load, back.reps))],
      {
        anchorLoad: decision.performedLoad,
        capacityE1rm: decision.capacity,
        capacityReps: decision.capacityReps,
        targetLoad: decision.load,
        targetReps: decision.reps,
        backoffPercent: params.backoffPercent,
        backoffLoad: back.load,
        backoffReps: back.reps,
      }, provenance);
  }

  function evaluateCurrentAnchorBackoff(params, settings, summaries, currentSession, provenance) {
    const strategy = { id: "anchor_backoff", version: 1 };
    const index = currentAnchorIndex(currentSession);
    if (index < 0) {
      // Today's anchor is absent. Prior anchor evidence carries the
      // derivation; with none, back-offs are never invented from nothing.
      if (!summaries.length) {
        return baseResult("insufficient_evidence", "manual", strategy, ["anchor_backoff.insufficient_anchor"], [],
          { backoffPercent: params.backoffPercent }, provenance);
      }
      const decision = priorAnchorDecision(params, settings, summaries);
      const back = derivedBackoff(params, settings, decision.load, decision.capacity);
      const untouchedFromPrior = Math.max(0, params.backoffSets - currentSession.filter((set) => set.role === "backoff").length);
      const reasonCodes = ["anchor_backoff.prior_anchor", decision.decision, "anchor_backoff.backoff_percent"];
      if (decision.snapped || back.snapped) reasonCodes.push("anchor_backoff.grid_rounded");
      return baseResult("recommendation", decision.status, strategy, reasonCodes,
        untouchedFromPrior ? [backoffSet(params, back.load, back.reps)] : [],
        {
          capacityE1rm: decision.capacity,
          capacityReps: decision.capacityReps,
          targetLoad: decision.load,
          backoffPercent: params.backoffPercent,
          backoffLoad: back.load,
          backoffReps: back.reps,
          untouchedBackoffs: untouchedFromPrior,
        }, provenance);
    }
    const anchor = currentSession[index];
    const capacity = capE1rm(anchor.load, anchor.reps, anchor.rir, settings.hardRir);
    const capacityReps = repsAtLoad(capacity, anchor.load);
    // A failed anchor is capacity at the performed load under the authored
    // floor. It recalibrates; it never schedules a deload or changes structure.
    const failed = capacityReps < params.anchorRepMin;
    const untouched = Math.max(0, params.backoffSets - (currentSession.length - index - 1));
    const status = failed ? "recalibrate" : "hold";
    const reasonCodes = ["anchor_backoff.current_anchor"];
    if (failed) reasonCodes.push("anchor_backoff.anchor_below_floor");
    const facts = {
      anchorLoad: anchor.load,
      capacityE1rm: capacity,
      capacityReps,
      backoffPercent: params.backoffPercent,
      untouchedBackoffs: untouched,
      targetLoad: anchor.load,
    };
    if (!untouched) {
      // Every authored back-off is done: nothing further to prescribe, and
      // completed sets are never rewritten.
      return baseResult("recommendation", status, strategy, reasonCodes, [], facts, provenance);
    }
    // Only untouched future back-offs are recalculated, and they come from the
    // anchor actually performed today.
    const back = derivedBackoff(params, settings, anchor.load, capacity);
    reasonCodes.push("anchor_backoff.backoff_percent", "anchor_backoff.backoff_recalculated");
    if (back.snapped) reasonCodes.push("anchor_backoff.grid_rounded");
    return baseResult("recommendation", status, strategy, reasonCodes,
      [backoffSet(params, back.load, back.reps)],
      { ...facts, backoffLoad: back.load, backoffReps: back.reps }, provenance);
  }

  /* ---- paired_exposure@1 ------------------------------------------------
     A program-level relation, not a strategy. Owner-approved 2026-08-27 for
     exactly one heavy/volume combination. It never copies a target, a set
     count, or a status from one exposure into the other; it exposes the
     counterpart's evidence and may only make a result more conservative. */

  const PAIRED_PAIRS = Object.freeze([Object.freeze({ heavy: "anchor_backoff@1", volume: "rep_goal@1" })]);
  const PAIRED_WINDOW_SESSIONS = 3;

  function pairedExposureCompatibility(pair) {
    if (!isPlainObject(pair)) return { compatible: false, reasonCodes: ["paired_exposure.incompatible_strategy_pair"] };
    // Roles are not interchangeable: the same two strategies swapped is a
    // different, unapproved pair.
    const allowed = PAIRED_PAIRS.some((entry) => entry.heavy === pair.heavy && entry.volume === pair.volume);
    return allowed
      ? { compatible: true, reasonCodes: [] }
      : { compatible: false, reasonCodes: ["paired_exposure.incompatible_strategy_pair"] };
  }

  function pairedMovementCompatibility(movements) {
    // Matching display text proves nothing; distinct machine identities are
    // never paired.
    const compatible = isPlainObject(movements)
      && typeof movements.heavy === "string" && movements.heavy.trim().length > 0
      && movements.heavy === movements.volume;
    return compatible
      ? { compatible: true, reasonCodes: [] }
      : { compatible: false, reasonCodes: ["paired_exposure.incompatible_movement"] };
  }

  function pairedExposureConfidence(counterpart) {
    if (!isPlainObject(counterpart) || !(counterpart.sessionsInWindow > 0)) {
      return { confidence: "none", reasonCodes: ["paired_exposure.no_counterpart_evidence"] };
    }
    return counterpart.mostRecentExpectedExposureCompleted === true
      ? { confidence: "full", reasonCodes: ["paired_exposure.full_confidence"] }
      : { confidence: "reduced", reasonCodes: ["paired_exposure.reduced_confidence"] };
  }

  // Temper-only. The paired result is never more aggressive than the
  // independent one on any target-changing dimension, and a poor counterpart
  // on its own never reduces load — that still needs the slot's own evidence.
  // A tempered advance becomes a hold at the load the evidence already
  // supported, keeping the reps the strategy had already prescribed.
  function applyPairedExposure(result, options) {
    const agrees = !isPlainObject(options) || options.counterpartAgrees !== false;
    if (agrees || result.status !== "advance") return result;
    const heldLoad = isFiniteNumber(result.facts.latestLoad) ? result.facts.latestLoad : result.facts.targetLoad;
    return {
      ...result,
      status: "hold",
      reasonCodes: [...result.reasonCodes, "paired_exposure.tempered"],
      target: { sets: result.target.sets.map((set) => ({ ...set, load: heldLoad })) },
      facts: { ...result.facts, targetLoad: heldLoad, pairedTempered: true },
    };
  }

  /* ---- block-profile modifiers -----------------------------------------
     Infrastructure only. identity_block@1 is the one approved modifier and it
     changes no target; it exists to prove versioning, ordering, serialization
     and determinism. No step-loading, volume-emphasis, rep-range-emphasis or
     scheduled-deload profile is approved, so every other modifier stays
     incompatible by design. */

  const APPROVED_MODIFIERS = Object.freeze({ "identity_block@1": Object.freeze([1, 1, 1, 1, 1, 1]) });

  function isApprovedModifier(modifier) {
    return isPlainObject(modifier)
      && hasOwn(APPROVED_MODIFIERS, `${modifier.id}@${modifier.version}`)
      && !modifier.target;
  }

  // Application order is the serialized prescription order after validation.
  // Only the identity modifier is approved, so no non-commutative
  // target-changing combination can exist in Wave 2.
  function applyModifiers(result, modifiers) {
    return {
      ...result,
      provenance: {
        ...result.provenance,
        modifierVersions: modifiers.map((modifier) => `${modifier.id}@${modifier.version}`),
      },
    };
  }

  function targetSets(params, load, reps, count) {
    const targetRir = hasOwn(params, "targetRirMax") ? params.targetRirMax : null;
    return Array.from({ length: count }, () => ({
      role: "working",
      load,
      reps,
      repMin: params.repMin,
      repMax: params.repMax,
      targetRir,
    }));
  }

  function evaluateCurrentRange(params, settings, summaries, currentSession, context, provenance) {
    const recentRir = typicalRir(summaries);
    const capacities = currentSession.map((set) => capE1rm(set.load, set.reps, set.rir, settings.hardRir));
    const drop = expectedSetDrop(capacities, historicalSetDrops(summaries, settings.hardRir));
    const latest = currentSession.at(-1);
    const predictedCapacity = capacities.at(-1) * (1 - drop);
    const capacityReps = repsAtLoad(predictedCapacity, latest.load);
    const predictedPerformedReps = capacityReps - recentRir;
    const jump = jumpAmount(latest.load, 1, settings);
    let status;
    let legacyStatus;
    let reason;
    let load;
    let reps;
    if (predictedPerformedReps >= params.repMax + CAPACITY.jumpMargin) {
      status = "advance";
      legacyStatus = "add";
      reason = "range.current_advance";
      load = roundToGrid(latest.load + jump, settings.minLoadIncrement);
      reps = reentryReps(params, predictedCapacity, load, recentRir);
    } else if (predictedPerformedReps < params.repMin) {
      status = "reduce";
      legacyStatus = "reduce";
      reason = "range.current_reduce";
      load = Math.max(roundToGrid(latest.load - jump, settings.minLoadIncrement), settings.minLoadIncrement);
      reps = reentryReps(params, predictedCapacity, load, recentRir);
    } else {
      status = "hold";
      legacyStatus = "hold";
      reason = "range.current_hold";
      load = latest.load;
      reps = clamp(Math.round(predictedPerformedReps), params.repMin, params.repMax);
    }
    const reasonCodes = [reason];
    if (drop > 0 && status === "hold" && reps < latest.reps) reasonCodes.push("range.current_drop");
    if (status === "advance" || status === "reduce") reasonCodes.push("range.reentry");
    return baseResult(
      "recommendation",
      status,
      { id: "range", version: 1 },
      reasonCodes,
      targetSets(params, load, reps, 1),
      {
        legacyStatus,
        capacityE1rm: predictedCapacity,
        capacityReps,
        typicalRir: recentRir,
        expectedSetDrop: drop,
        latestLoad: latest.load,
        targetLoad: load,
        targetReps: reps,
        pushReps: status === "hold",
        stalled: false,
      },
      provenance,
    );
  }

  function evaluateNextRange(params, settings, summaries, context, provenance) {
    if (!summaries.length) {
      return baseResult(
        "recommendation",
        "new",
        { id: "range", version: 1 },
        ["range.no_history"],
        targetSets(params, null, params.repMin, params.workingSets),
        { legacyStatus: "new", targetLoad: null, targetReps: params.repMin, pushReps: true, stalled: false },
        provenance,
      );
    }

    const latest = summaries.at(-1);
    const load = latest.medianLoad;
    const capacityReps = repsAtLoad(latest.medianCapacity, load);
    const atTop = latest.sets.filter((set) => set.reps >= params.repMax).length;
    const allTop = atTop === latest.sets.length;
    const nearTop = latest.sets.length >= 3 && atTop >= latest.sets.length - 1 && latest.minimumReps >= params.repMax - 1;
    const performedTop = allTop || nearTop;
    const stalled = isStalled(summaries);
    let status;
    let legacyStatus;
    let reason;
    let jumpMultiplier = 0;
    let pushReps = false;
    if (capacityReps >= params.repMax + CAPACITY.bigJumpMargin) {
      status = "advance";
      legacyStatus = "add2";
      reason = "range.capacity_top_double";
      jumpMultiplier = 2;
    } else if (performedTop || capacityReps >= params.repMax + CAPACITY.jumpMargin) {
      status = "advance";
      legacyStatus = "add";
      reason = performedTop ? "range.performed_top" : "range.capacity_top";
      jumpMultiplier = 1;
    } else if (capacityReps < params.repMin) {
      status = "reduce";
      legacyStatus = "reduce";
      reason = "range.below_floor";
      jumpMultiplier = 1;
    } else if (stalled) {
      status = "recalibrate";
      legacyStatus = "reduce";
      reason = "range.stalled";
    } else if (recoverSignal(summaries, 0.5)) {
      status = "hold";
      legacyStatus = "hold";
      reason = "range.recovery";
    } else if (capacityReps - latest.medianReps >= CAPACITY.pushGap && capacityReps <= params.repMax) {
      status = "hold";
      legacyStatus = "hold";
      reason = "range.capacity_room";
      pushReps = true;
    } else {
      status = "hold";
      legacyStatus = "hold";
      reason = "range.room_in_range";
      pushReps = true;
    }

    const trend = blockTrend(summaries, context.blockStart);
    const reasonCodes = [reason];
    if (legacyStatus === "add2" && trend.direction === "falling") {
      legacyStatus = "add";
      jumpMultiplier = 1;
      reasonCodes.push("range.block_tempered");
    }

    let targetLoad;
    if (jumpMultiplier && status === "advance") {
      targetLoad = roundToGrid(load + jumpAmount(load, jumpMultiplier, settings), settings.minLoadIncrement);
    } else if (reason === "range.below_floor") {
      targetLoad = Math.max(
        roundToGrid(load - jumpAmount(load, 1, settings), settings.minLoadIncrement),
        settings.minLoadIncrement,
      );
    } else targetLoad = Math.max(roundToGrid(load, settings.minLoadIncrement), settings.minLoadIncrement);

    const changedLoad = !sameLoad(targetLoad, load);
    const usesReentry = legacyStatus === "add" || legacyStatus === "add2" || legacyStatus === "reduce" || changedLoad;
    const recentRir = typicalRir(summaries);
    const previousFirstReps = latest.sets[0]?.reps;
    let targetReps = usesReentry
      ? reentryReps(params, latest.medianCapacity, targetLoad, recentRir)
      : previousFirstReps == null
        ? params.repMin
        : pushReps
          ? clamp(previousFirstReps + 1, params.repMin, params.repMax)
          : clamp(previousFirstReps, params.repMin, params.repMax);
    if (changedLoad && status === "hold") reasonCodes.push("range.grid_rounded");
    if (usesReentry && changedLoad) reasonCodes.push("range.reentry");

    const freshnessFactor = hasOwn(context, "freshnessFactor") ? context.freshnessFactor : 1;
    if (freshnessFactor < 1 && latest.medianCapacity > 0) {
      const temperedCapacity = latest.medianCapacity * freshnessFactor;
      let rawReps = Math.round(repsAtLoad(temperedCapacity, targetLoad) - recentRir);
      if (rawReps < params.repMin) {
        targetLoad = Math.max(
          roundToGrid(targetLoad - jumpAmount(targetLoad, 1, settings), settings.minLoadIncrement),
          settings.minLoadIncrement,
        );
        rawReps = Math.round(repsAtLoad(temperedCapacity, targetLoad) - recentRir);
      }
      targetReps = Math.min(targetReps, clamp(rawReps, params.repMin, params.repMax));
      reasonCodes.push("range.freshness_temper");
    }

    return baseResult(
      "recommendation",
      status,
      { id: "range", version: 1 },
      reasonCodes,
      targetSets(params, targetLoad, targetReps, params.workingSets),
      {
        legacyStatus,
        latestLoad: load,
        latestMedianReps: latest.medianReps,
        capacityE1rm: latest.medianCapacity,
        capacityReps,
        typicalRir: recentRir,
        jumpMultiplier,
        blockTrend: trend,
        targetLoad,
        targetReps,
        pushReps,
        stalled,
        freshnessFactor,
      },
      provenance,
    );
  }

  // One gate for every strategy: a relation is accepted only when it is the
  // approved paired_exposure pair for this slot's role, and a modifier only
  // when it is on the approved list and compatible with this strategy version.
  // Anything else is typed incompatible; nothing silently falls back.
  function pairingGate(input, strategy) {
    const strategyKey = `${strategy.id}@${strategy.version}`;
    if (!Array.isArray(input.modifiers)) return { ok: false, result: incompatibleResult(strategy, "engine.unsupported_modifier") };
    for (const modifier of input.modifiers) {
      const checked = validateModifier(modifier);
      if (!checked.ok || !isApprovedModifier(checked.value)
        || !checked.value.compatibleStrategies.includes(strategyKey)) {
        return { ok: false, result: incompatibleResult(strategy, "engine.unsupported_modifier") };
      }
    }
    if (input.relation === null) return { ok: true, relation: null, modifiers: input.modifiers };
    const checked = validateRelation(input.relation);
    if (!checked.ok) return { ok: false, result: invalidResult(strategy, checked.issues) };
    const relation = input.relation;
    // Without a declared role and counterpart strategy the pair cannot be
    // proven, and an unproven pair never executes.
    if (!relation.selfRole || !isPlainObject(relation.counterpart)) {
      return { ok: false, result: incompatibleResult(strategy, "engine.unsupported_relation") };
    }
    const pair = relation.selfRole === "heavy"
      ? { heavy: strategyKey, volume: relation.counterpart.strategy }
      : { heavy: relation.counterpart.strategy, volume: strategyKey };
    const compatibility = pairedExposureCompatibility(pair);
    if (!compatibility.compatible) {
      return { ok: false, result: incompatibleResult(strategy, "paired_exposure.incompatible_strategy_pair") };
    }
    return { ok: true, relation, modifiers: input.modifiers };
  }

  // The relation is applied after the strategy has decided on its own
  // evidence. It annotates confidence and may only temper.
  function withPairing(result, gate) {
    const paired = gate.relation
      ? (() => {
        const confidence = pairedExposureConfidence(gate.relation.counterpart);
        const status = gate.relation.counterpart.status;
        const tempered = confidence.confidence === "none"
          ? result
          : applyPairedExposure(result, { counterpartAgrees: status !== "reduce" && status !== "recalibrate" });
        return {
          ...tempered,
          reasonCodes: [...tempered.reasonCodes, ...confidence.reasonCodes],
          facts: { ...tempered.facts, pairedConfidence: confidence.confidence },
          provenance: { ...tempered.provenance, relationVersion: 1 },
        };
      })()
      : result;
    return applyModifiers(paired, gate.modifiers);
  }

  function evaluateProgression(input) {
    const unknownStrategy = { id: "unknown", version: 0 };
    if (!isPlainObject(input)) return invalidResult(unknownStrategy, ["input: expected object"]);
    const strategyValue = isPlainObject(input.prescription?.strategy) ? input.prescription.strategy : null;
    const strategy = {
      id: typeof strategyValue?.id === "string" ? strategyValue.id : "unknown",
      version: Number.isInteger(strategyValue?.version) ? strategyValue.version : 0,
    };
    const inputKeys = new Set(["engineVersion", "prescription", "relation", "modifiers", "settings", "history", "currentSession", "context"]);
    const keyIssues = unexpectedKeys(input, inputKeys).map((key) => `input.${key}: unknown key`);
    if (keyIssues.length) return invalidResult(strategy, keyIssues);
    if (input.engineVersion !== ENGINE_VERSION) return invalidResult(strategy, ["engineVersion: unsupported"]);
    if (strategy.id === "manual" && strategy.version === 1) {
      const prescription = validatePrescription(input.prescription);
      const settings = validateSettings(input.settings);
      const history = summarizeHistory(input.history, settings.ok ? settings.value.hardRir : 4);
      const currentSession = normalizeCurrentSession(input.currentSession);
      const context = validateContext(input.context);
      const issues = [];
      for (const checked of [prescription, settings, history, currentSession, context]) {
        if (!checked.ok) issues.push(...checked.issues);
      }
      if (issues.length) return invalidResult(strategy, issues);
      const gate = pairingGate(input, strategy);
      if (!gate.ok) return gate.result;
      const provenance = {
        evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
        modifierVersions: [],
        relationVersion: null,
      };
      const params = prescription.value.strategy.params;
      const reason = Object.prototype.hasOwnProperty.call(params, "unsupportedImport")
        ? "manual.unsupported_import"
        : "manual.authored_target";
      return withPairing(manualResult({ id: "manual", version: 1 }, reason, provenance), gate);
    }
    if (strategy.id === "rep_goal" && strategy.version === 1) {
      const prescription = validateRepGoalPrescription(input.prescription);
      const settings = validateSettings(input.settings);
      const history = summarizeHistory(input.history, settings.ok ? settings.value.hardRir : 4);
      const currentSession = normalizeCurrentSession(input.currentSession);
      const context = validateContext(input.context);
      const issues = [];
      for (const checked of [prescription, settings, history, currentSession, context]) {
        if (!checked.ok) issues.push(...checked.issues);
      }
      if (issues.length) return invalidResult(strategy, issues);
      const gate = pairingGate(input, strategy);
      if (!gate.ok) return gate.result;
      const params = prescription.value.strategy.params;
      // Bodyweight load semantics are not executable; body mass is never
      // treated as hidden external load. manual@1 is the alternative.
      if (params.loadMode === "bodyweight") {
        return incompatibleResult({ id: "rep_goal", version: 1 }, "rep_goal.bodyweight_incompatible");
      }
      if (!repGoalIsSatisfiable(params)) {
        return baseResult("invalid", "manual", { id: "rep_goal", version: 1 },
          ["rep_goal.invalid_distribution"], [],
          { issues: ["params.repGoal: unreachable inside workingSets x [repFloor, repCeiling]"] },
          { evidenceWindow: { sessionCount: 0, currentSetCount: 0 }, modifierVersions: [], relationVersion: null });
      }
      const provenance = {
        evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
        modifierVersions: [],
        relationVersion: null,
      };
      return withPairing(currentSession.value.length
        ? evaluateCurrentRepGoal(params, settings.value, history.value, currentSession.value, provenance)
        : evaluateNextRepGoal(params, settings.value, history.value, provenance), gate);
    }
    if (strategy.id === "effort_target" && strategy.version === 1) {
      const prescription = validateEffortTargetPrescription(input.prescription);
      const settings = validateSettings(input.settings);
      const history = summarizeHistory(input.history, settings.ok ? settings.value.hardRir : 4);
      const currentSession = normalizeCurrentSession(input.currentSession);
      const context = validateContext(input.context);
      const issues = [];
      for (const checked of [prescription, settings, history, currentSession, context]) {
        if (!checked.ok) issues.push(...checked.issues);
      }
      if (issues.length) return invalidResult(strategy, issues);
      const gate = pairingGate(input, strategy);
      if (!gate.ok) return gate.result;
      const params = prescription.value.strategy.params;
      if (params.loadMode === "bodyweight") {
        return incompatibleResult({ id: "effort_target", version: 1 }, "effort_target.bodyweight_incompatible");
      }
      const provenance = {
        evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
        modifierVersions: [],
        relationVersion: null,
      };
      return withPairing(currentSession.value.length
        ? evaluateCurrentEffortTarget(params, settings.value, currentSession.value, provenance)
        : evaluateNextEffortTarget(params, settings.value, history.value, provenance), gate);
    }
    if (strategy.id === "anchor_backoff" && strategy.version === 1) {
      const prescription = validateAnchorBackoffPrescription(input.prescription);
      const settings = validateSettings(input.settings);
      const history = summarizeHistory(input.history, settings.ok ? settings.value.hardRir : 4);
      const currentSession = normalizeCurrentSession(input.currentSession);
      const context = validateContext(input.context);
      const issues = [];
      for (const checked of [prescription, settings, history, currentSession, context]) {
        if (!checked.ok) issues.push(...checked.issues);
      }
      if (issues.length) return invalidResult(strategy, issues);
      const gate = pairingGate(input, strategy);
      if (!gate.ok) return gate.result;
      const params = prescription.value.strategy.params;
      if (params.loadMode === "bodyweight") {
        return incompatibleResult({ id: "anchor_backoff", version: 1 }, "anchor_backoff.bodyweight_incompatible");
      }
      const provenance = {
        evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
        modifierVersions: [],
        relationVersion: null,
      };
      return withPairing(currentSession.value.length
        ? evaluateCurrentAnchorBackoff(params, settings.value, history.value, currentSession.value, provenance)
        : evaluateNextAnchorBackoff(params, settings.value, history.value, provenance), gate);
    }
    if (strategy.id !== "range" || strategy.version !== 1) return incompatibleResult(strategy, "engine.unsupported_strategy");
    const rangeGate = pairingGate(input, strategy);
    if (!rangeGate.ok) return rangeGate.result;

    const prescription = validateRangePrescription(input.prescription);
    const settings = validateSettings(input.settings);
    const history = summarizeHistory(input.history, settings.ok ? settings.value.hardRir : 4);
    const currentSession = normalizeCurrentSession(input.currentSession);
    const context = validateContext(input.context);
    const issues = [];
    for (const checked of [prescription, settings, history, currentSession, context]) {
      if (!checked.ok) issues.push(...checked.issues);
    }
    if (issues.length) return invalidResult(strategy, issues);

    const provenance = {
      evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
      modifierVersions: [],
      relationVersion: null,
    };
    return withPairing(currentSession.value.length
      ? evaluateCurrentRange(
        prescription.value.strategy.params,
        settings.value,
        history.value,
        currentSession.value,
        context.value,
        provenance,
      )
      : evaluateNextRange(
        prescription.value.strategy.params,
        settings.value,
        history.value,
        context.value,
        provenance,
      ), rangeGate);
  }

  const api = Object.freeze({
    ENGINE_VERSION,
    STRATEGY_IDS,
    CAPACITY,
    LIMITS,
    CANONICAL_LIMITS,
    isFiniteNumber,
    clamp,
    median,
    e1rm,
    capRir,
    capReps,
    capE1rm,
    repsAtLoad,
    roundToGrid,
    jumpAmount,
    validateSettings,
    validateRangePrescription,
    validateRepGoalPrescription,
    validateEffortTargetPrescription,
    validateAnchorBackoffPrescription,
    balancedFrontload,
    PAIRED_PAIRS,
    PAIRED_WINDOW_SESSIONS,
    APPROVED_MODIFIERS,
    pairedExposureCompatibility,
    pairedMovementCompatibility,
    pairedExposureConfidence,
    applyPairedExposure,
    isApprovedModifier,
    validatePrescription,
    normalizePrescription,
    canonicalizePrescription,
    validateRelation,
    validateRelations,
    normalizeRelation,
    normalizeRelations,
    canonicalizeRelation,
    canonicalizeRelations,
    validateModifier,
    validateModifiers,
    normalizeModifier,
    normalizeModifiers,
    canonicalizeModifier,
    canonicalizeModifiers,
    normalizeHistory,
    normalizeCurrentSession,
    summarizeSession,
    summarizeHistory,
    typicalRir,
    expectedSetDrop,
    evaluateProgression,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
