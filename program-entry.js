(function (root) {
  "use strict";

  const SCHEMA_VERSION = 1;
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
      versions: {},
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
    if (state.route !== null && state.step !== "entry" && !ROUTE_STEPS[state.route].includes(state.step)) {
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
    return {
      ...clone(state),
      answers: { ...clone(state.answers), ...clone(patch) },
      result: null,
    };
  }

  function setResult(state, result) {
    assertState(state);
    if (result === null || result === undefined) throw new TypeError("Result is required");
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
      case "catalogue": return answers.catalogueSelection ? [] : ["catalogue_selection_required"];
      case "build_setup": {
        const issues = [];
        if (!answers.programName) issues.push("program_name_required");
        if (!answers.daysPerWeek) issues.push("days_per_week_required");
        return issues;
      }
      case "import_source": return answers.importReady ? [] : ["import_source_required"];
      case "shared_review": return answers.sharedReady ? [] : ["shared_review_required"];
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
    const steps = ROUTE_STEPS[state.route];
    const index = steps.indexOf(state.step);
    if (index === 0) return { ...clone(state), step: "entry" };
    return { ...clone(state), step: steps[index - 1] };
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    ROUTES,
    ROUTE_STEPS,
    createState,
    selectRoute,
    setAnswers,
    setResult,
    validationIssues,
    advance,
    back,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgramEntry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
