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

  const api = Object.freeze({
    ENGINE_VERSION,
    STRATEGY_IDS,
    CAPACITY,
    LIMITS,
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
    normalizeHistory,
    normalizeCurrentSession,
    summarizeSession,
    summarizeHistory,
    typicalRir,
    expectedSetDrop,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
