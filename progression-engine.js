(function (root) {
  "use strict";

  const ENGINE_VERSION = 1;
  const STRATEGY_IDS = Object.freeze(["range", "rep_goal", "anchor_backoff", "manual"]);
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

    // Range is the only strategy whose parameter bounds are approved. The
    // other strategy envelopes are preserved without inventing their rules.
    if (strategy.id === "range") return validateRangePrescription(prescription);

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
      new Set(["schemaVersion", "id", "type", "version", "movementId", "members"]),
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
    for (const key of unexpectedKeys(modifier, new Set(["id", "version", "compatibleStrategies", "weekNumber", "target", "params"]))) {
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
    if (hasOwn(modifier, "target") && (typeof modifier.target !== "string" || !modifier.target.trim())) {
      issues.push("modifier.target: expected non-empty string");
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

  function normalizeWorkingSet(set, path) {
    const issues = [];
    if (!isPlainObject(set)) return validationFailure([`${path}: expected object`]);
    for (const key of unexpectedKeys(set, new Set(["load", "reps", "rir"]))) issues.push(`${path}.${key}: unknown key`);
    if (!isFiniteNumber(set.load) || set.load <= 0) issues.push(`${path}.load: expected positive finite number`);
    if (!Number.isInteger(set.reps) || set.reps <= 0 || set.reps > LIMITS.reps[1]) issues.push(`${path}.reps: out of range`);
    const rirIsBlank = set.rir === "" || set.rir == null;
    if (!rirIsBlank && !isFiniteNumber(set.rir)) issues.push(`${path}.rir: expected finite number or blank`);
    if (issues.length) return validationFailure(issues);
    return { ok: true, value: { load: set.load, reps: set.reps, rir: rirIsBlank ? null : set.rir } };
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
      if (input.relation !== null) return incompatibleResult(strategy, "engine.unsupported_relation");
      if (!Array.isArray(input.modifiers) || input.modifiers.length) return incompatibleResult(strategy, "engine.unsupported_modifier");
      const provenance = {
        evidenceWindow: { sessionCount: history.value.length, currentSetCount: currentSession.value.length },
        modifierVersions: [],
        relationVersion: null,
      };
      const params = prescription.value.strategy.params;
      const reason = Object.prototype.hasOwnProperty.call(params, "unsupportedImport")
        ? "manual.unsupported_import"
        : "manual.authored_target";
      return manualResult({ id: "manual", version: 1 }, reason, provenance);
    }
    if (strategy.id !== "range" || strategy.version !== 1) return incompatibleResult(strategy, "engine.unsupported_strategy");
    if (input.relation !== null) return incompatibleResult(strategy, "engine.unsupported_relation");
    if (!Array.isArray(input.modifiers) || input.modifiers.length) return incompatibleResult(strategy, "engine.unsupported_modifier");

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
    return currentSession.value.length
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
      );
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
