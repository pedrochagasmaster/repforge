(function (root) {
  "use strict";

  const ENGINE_VERSION = "078.1";
  const STANDING_VERSION = "standing@078.1";
  // Reps in reserve are reliable near failure and guesses far from it, so a performed set earns capacity for at most
  // this many (owner, 2026-11-05; Plan 077 OD-23b). Targets keep their own 0–6 bound.
  const RIR_CREDIT_CAP = 5;
  // Effort calibration (Plan 077, OD-18): the caller's per-lift shift, read as `rir − delta` on reported sets. Only this
  // version is understood; any other, or a delta outside [−1, 2], leaves the engine as it was (delta 0).
  const CALIBRATION_VERSION = "calibration@077.1";
  const CALIBRATION_DELTA = Object.freeze({ min: -1, max: 2 });
  // A shifted suggestion stays within one available-load step above, and two below, the unshifted one.
  const CALIBRATION_STEPS = Object.freeze({ up: 1, down: 2 });
  const FORMULA_VERSION = "rir-adjusted-epley@067.1";
  /** The share of the body a lift must move before bodyweight counts toward its load (owner rule, 2026-11-05). */
  const BODYWEIGHT_MATERIAL_THRESHOLD = 0.3;
  const METRIC_DOMAIN = root?.RepForgeExerciseMetrics ||
    (typeof require === "function" ? require("./exercise-metrics.js") : null);
  if (!METRIC_DOMAIN) throw new Error("RepForgeExerciseMetrics unavailable");

  const DEFINITIONS_BY_ID = new Map(METRIC_DOMAIN.DEFINITIONS.map((entry) => [entry.id, entry]));
  const SUPPORTED_SEMANTICS = Object.freeze({
    external: ["loadKg", "reps"],
    external_reps_per_side: ["loadKg", "repsPerSide"],
    assistance: ["reps", "assistanceKg"],
    bodyweight: ["reps"],
    bodyweight_reps_per_side: ["repsPerSide"],
    per_side: ["repsPerSide", "loadPerSideKg"],
    per_side_reps: ["reps", "loadPerSideKg"],
    persistent_per_side: ["persistentLoadPerSideKg", "repsPerSide"],
  });
  const CANONICAL_KIND_BY_COMPOSITION = Object.freeze({
    external_reps_per_side: "external",
    bodyweight_reps_per_side: "bodyweight",
    per_side_reps: "per_side",
  });
  const LOADING_CONVENTIONS = new Set(["external", "assistance", "bodyweight", "per_side"]);
  const DEFAULT_SETTINGS = Object.freeze({ expandRepRange: true, weightMatch: false, calibrationDelta: 0 });
  const REASONS = Object.freeze({
    available_loads_required: "Set the available loads for this equipment before requesting an automatic load.",
    bodyweight_required: "Record the current bodyweight before using bodyweight contribution.",
    configuration_required: "Complete the loading configuration before requesting an automatic recommendation.",
    execution_context_required: "Set whether both sides move together or one side moves at a time before requesting automatic progression.",
    historical_bodyweight_required: "This movement needs the bodyweight captured with the performed set; current bodyweight cannot replace it.",
    invalid_prescription: "The prescription or its source metric definitions are invalid.",
    loading_context_required: "Choose the equipment and loading convention for this exercise.",
    loading_convention_mismatch: "The selected loading convention does not match this exercise's source metrics.",
    loading_convention_required: "A comparable loading convention is not recorded.",
    no_candidate_in_range: "No available load and repetition pair meets the target RIR range.",
    no_comparable_history: "Complete a comparable set with a recorded RIR before using automatic progression.",
    no_candidate_after_expansion: "No available load and repetition pair meets the expanded range and target RIR.",
    no_repetition_target: "This metric combination has no supported repetition target for adaptive load progression.",
    no_supported_capacity: "This source metric combination remains manually prescribed.",
    per_side_convention_required: "Set an explicit per-side load multiplier before estimating total load.",
    current_session_anchor: "The recommendation uses the latest completed comparable set in this session.",
    history_anchor: "The recommendation uses median first-set capacity from up to three comparable sessions.",
    rep_range_expanded: "The search expanded the repetition range by one at each boundary per pass, up to four passes.",
    rir_target_required: "Set a target RIR from zero through four before requesting an automatic recommendation.",
    target_range_required: "Set a valid repetition target range before requesting an automatic recommendation.",
  });

  const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

  function median(values) {
    if (!values.length) return 0;
    const ordered = [...values].sort((left, right) => left - right);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  }

  function prescriptionShape(value) {
    if (!isPlainObject(value)) return { ok: false, reasons: ["invalid_prescription"] };
    if (typeof value.id !== "string" || typeof value.slotId !== "string" || typeof value.exerciseId !== "string"
      || !Number.isInteger(value.setIndex) || value.setIndex < 1
      || value.metricType !== "source_metrics@1") return { ok: false, reasons: ["invalid_prescription"] };
    const definitions = METRIC_DOMAIN.validateDefinitions(value.metricIds, value.metricDefinitions, { allowEmpty: true });
    if (!definitions.ok) return { ok: false, reasons: ["invalid_prescription"] };
    const semantics = (value.metricDefinitions || []).map((entry) => entry.semantic);
    const composition = Object.keys(SUPPORTED_SEMANTICS).find((key) => same(SUPPORTED_SEMANTICS[key], semantics)) || null;
    if (!composition) return { ok: true, supported: false, kind: null, semantics, reasons: ["no_supported_capacity"] };
    const kind = CANONICAL_KIND_BY_COMPOSITION[composition] || composition;
    const requiresExecutionMode = semantics.includes("repsPerSide")
      || semantics.includes("loadPerSideKg") || semantics.includes("persistentLoadPerSideKg");
    const repSemantic = semantics.includes("reps") ? "reps" : semantics.includes("repsPerSide") ? "repsPerSide" : null;
    if (!repSemantic) return { ok: true, supported: false, kind, semantics, reasons: ["no_repetition_target"] };
    const targets = METRIC_DOMAIN.validateTargets(value.metricIds, value.targets);
    if (!targets.ok || !isPlainObject(value.targets) || !hasOwn(value.targets, repSemantic)) {
      return { ok: true, supported: false, kind, semantics, repSemantic, reasons: ["target_range_required"] };
    }
    const target = value.targets[repSemantic];
    const range = finite(target) ? { min: target, max: target }
      : isPlainObject(target) ? { min: target.min, max: target.max } : null;
    if (!range || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max)
      || range.min < 1 || range.max < range.min || range.max > 30) {
      return { ok: true, supported: false, kind, semantics, repSemantic, reasons: ["target_range_required"] };
    }
    if (!finite(value.rir) || value.rir < 0 || value.rir > 6) {
      return { ok: true, supported: false, kind, semantics, repSemantic, range, reasons: ["rir_target_required"] };
    }
    const coefficient = value.loadingModel?.bodyweightCoefficient;
    if (!finite(coefficient) || coefficient < 0 || coefficient > 1) {
      return { ok: true, supported: false, kind, semantics, repSemantic, range, reasons: ["configuration_required"] };
    }
    if (value.status === "configuration_required") {
      return { ok: true, supported: false, kind, semantics, repSemantic, range, reasons: ["configuration_required"] };
    }
    if (value.status === "manual") {
      return { ok: true, supported: false, kind, semantics, repSemantic, range, reasons: ["no_supported_capacity"] };
    }
    if (value.status !== "ready") return { ok: false, reasons: ["invalid_prescription"] };
    return { ok: true, supported: true, composition, kind, semantics, repSemantic, requiresExecutionMode,
      range, coefficient: effectiveBodyweightCoefficient(coefficient, kind), catalogCoefficient: coefficient, reasons: [] };
  }

  function normalizeSettings(value) {
    if (value === undefined) return { ok: true, value: DEFAULT_SETTINGS };
    if (!isPlainObject(value)) return { ok: false, reasons: ["invalid_prescription"] };
    const result = { ...DEFAULT_SETTINGS };
    for (const key of ["expandRepRange", "weightMatch"]) {
      if (hasOwn(value, key)) {
        if (typeof value[key] !== "boolean") return { ok: false, reasons: ["invalid_prescription"] };
        result[key] = value[key];
      }
    }
    const calibration = value.calibration;
    if (isPlainObject(calibration) && calibration.version === CALIBRATION_VERSION && finite(calibration.delta)
      && calibration.delta >= CALIBRATION_DELTA.min && calibration.delta <= CALIBRATION_DELTA.max) {
      result.calibrationDelta = calibration.delta;
    }
    return { ok: true, value: result };
  }

  function currentConfiguration(prescription, shape, loadingContext) {
    const bySlotId = isPlainObject(loadingContext?.bySlotId) ? loadingContext.bySlotId : null;
    const context = bySlotId && isPlainObject(bySlotId[prescription.slotId]) ? bySlotId[prescription.slotId] : null;
    if (!context) return { ok: false, status: "configuration_required", reasons: ["loading_context_required"] };
    const convention = context.loadingConvention;
    if (!LOADING_CONVENTIONS.has(convention)) {
      return { ok: false, status: "configuration_required", reasons: ["loading_convention_required"] };
    }
    const executionMode = context.executionMode;
    if (shape.requiresExecutionMode && executionMode !== "bilateral" && executionMode !== "unilateral") {
      return { ok: false, status: "configuration_required", reasons: ["execution_context_required"] };
    }
    if (shape.kind === "persistent_per_side" && convention !== "per_side") {
      return { ok: false, status: "configuration_required", reasons: ["loading_convention_mismatch"] };
    }
    if (shape.kind !== "persistent_per_side" && convention !== shape.kind) {
      return { ok: false, status: "configuration_required", reasons: ["loading_convention_mismatch"] };
    }
    if (shape.coefficient > 0) {
      if (typeof context.bodyweightContributionEnabled !== "boolean") {
        return { ok: false, status: "configuration_required", reasons: ["configuration_required"] };
      }
      if (context.bodyweightContributionEnabled && (!finite(context.bodyweightKg) || context.bodyweightKg <= 0)) {
        return { ok: false, status: "configuration_required", reasons: ["bodyweight_required"] };
      }
    }
    let multiplier;
    if (shape.kind === "per_side" || shape.kind === "persistent_per_side") {
      if (!finite(context.externalLoadMultiplier) || context.externalLoadMultiplier <= 0 || context.externalLoadMultiplier > 10) {
        return { ok: false, status: "configuration_required", reasons: ["per_side_convention_required"] };
      }
      multiplier = context.externalLoadMultiplier;
    } else if (shape.kind === "bodyweight") {
      if (context.externalLoadMultiplier !== 0) {
        return { ok: false, status: "configuration_required", reasons: ["configuration_required"] };
      }
      multiplier = 0;
    } else if (context.externalLoadMultiplier === 1) {
      multiplier = 1;
    } else {
      return { ok: false, status: "configuration_required", reasons: ["configuration_required"] };
    }
    if (shape.requiresExecutionMode) {
      const expectedMultiplier = shape.kind === "persistent_per_side" ? 2
        : shape.kind === "per_side" ? (executionMode === "bilateral" ? 2 : 1)
          : shape.kind === "bodyweight" ? 0 : 1;
      if (multiplier !== expectedMultiplier) {
        return { ok: false, status: "configuration_required", reasons: ["loading_convention_mismatch"] };
      }
    }
    const displayLoadSemantic = shape.kind === "external" ? "loadKg"
      : shape.kind === "assistance" ? "assistanceKg"
        : shape.kind === "per_side" ? "loadPerSideKg"
          : shape.kind === "persistent_per_side" ? "persistentLoadPerSideKg" : null;
    let loads = [];
    if (displayLoadSemantic) {
      if (!Array.isArray(context.availableLoadsKg) || context.availableLoadsKg.length === 0
        || context.availableLoadsKg.some((load) => !finite(load) || load < 0 || load > 1000)
        || new Set(context.availableLoadsKg).size !== context.availableLoadsKg.length) {
        return { ok: false, status: "configuration_required", reasons: ["available_loads_required"] };
      }
      loads = [...context.availableLoadsKg].sort((left, right) => left - right);
    } else if (context.availableLoadsKg !== undefined && (!Array.isArray(context.availableLoadsKg)
      || context.availableLoadsKg.some((load) => !finite(load) || load < 0 || load > 1000))) {
      return { ok: false, status: "configuration_required", reasons: ["configuration_required"] };
    }
    return {
      ok: true,
      context,
      convention,
      multiplier,
      displayLoadSemantic,
      loads,
      bodyweightContributionEnabled: shape.coefficient > 0 ? context.bodyweightContributionEnabled : false,
      bodyweightKg: shape.coefficient > 0 && context.bodyweightContributionEnabled ? context.bodyweightKg : null,
      bodyweightContributionKg: shape.coefficient > 0 && context.bodyweightContributionEnabled
        ? shape.coefficient * context.bodyweightKg : 0,
    };
  }

  function metricValuesBySemantic(value, shape) {
    if (!Array.isArray(value.metricIds)) return null;
    const checked = METRIC_DOMAIN.validateMetricValues(value.metricIds, value.metricValues);
    if (!checked.ok || !Array.isArray(value.metricValues)) return null;
    const values = {};
    for (const entry of value.metricValues) {
      const definition = DEFINITIONS_BY_ID.get(entry.metricId);
      if (!definition) return null;
      values[definition.semantic] = entry.value;
    }
    return values;
  }

  /** Bodyweight counts toward a lift's load only where it is a material share of it (owner rule, 2026-11-05): from
   *  BODYWEIGHT_MATERIAL_THRESHOLD of the body up (pull-ups, dips, push-ups, squats, lunges, calf raises…). Below it a
   *  loaded lift's effective coefficient is 0: no bodyweight contribution, no bodyweight dependency, no mismatch. A
   *  reps-only bodyweight movement has no external load, so its coefficient is its whole load and is kept. Stored
   *  coefficients stay as the catalog gives them; this reads them. */
  function effectiveBodyweightCoefficient(coefficient, kind = "external") {
    if (!finite(coefficient)) return coefficient;
    if (kind === "bodyweight") return coefficient;
    return coefficient >= BODYWEIGHT_MATERIAL_THRESHOLD ? coefficient : 0;
  }

  function transformActualLoad(values, shape, convention, capturedContext) {
    if (!isPlainObject(capturedContext)) {
      if (shape.coefficient > 0) return { ok: false, reason: "historical_bodyweight_required" };
      return { ok: false, reason: "loading_convention_mismatch" };
    }
    if (capturedContext.loadingConvention !== convention) {
      return { ok: false, reason: "loading_convention_mismatch" };
    }
    // Compared as the engine reads them, so a set recorded under a coefficient now below the threshold anchors normally.
    if (effectiveBodyweightCoefficient(capturedContext.bodyweightCoefficient, shape.kind) !== shape.coefficient) {
      return { ok: false, reason: "loading_convention_mismatch" };
    }
    let bodyweightContributionKg = 0;
    if (shape.coefficient > 0) {
      if (typeof capturedContext.bodyweightContributionEnabled !== "boolean") {
        return { ok: false, reason: "historical_bodyweight_required" };
      }
      if (capturedContext.bodyweightContributionEnabled) {
        if (!finite(capturedContext.bodyweightKg) || capturedContext.bodyweightKg <= 0) {
          return { ok: false, reason: "historical_bodyweight_required" };
        }
        bodyweightContributionKg = shape.coefficient * capturedContext.bodyweightKg;
      }
    }
    let multiplier;
    if (shape.kind === "per_side" || shape.kind === "persistent_per_side") {
      if (!finite(capturedContext.externalLoadMultiplier) || capturedContext.externalLoadMultiplier <= 0
        || capturedContext.externalLoadMultiplier > 10) return { ok: false, reason: "per_side_convention_required" };
      multiplier = capturedContext.externalLoadMultiplier;
    } else if (shape.kind === "bodyweight") {
      if (capturedContext.externalLoadMultiplier !== 0) {
        return { ok: false, reason: "loading_convention_mismatch" };
      }
      multiplier = 0;
    } else if (capturedContext.externalLoadMultiplier !== 1) {
      return { ok: false, reason: "loading_convention_mismatch" };
    } else {
      multiplier = 1;
    }
    const expectedConventionMultiplier = shape.kind === "per_side" || shape.kind === "persistent_per_side"
      ? multiplier : shape.kind === "bodyweight" ? 0 : multiplier;
    const displaySemantic = shape.kind === "external" ? "loadKg"
      : shape.kind === "assistance" ? "assistanceKg"
        : shape.kind === "per_side" ? "loadPerSideKg"
          : shape.kind === "persistent_per_side" ? "persistentLoadPerSideKg" : null;
    const displayLoadKg = displaySemantic ? values[displaySemantic] : null;
    if (displaySemantic && !finite(displayLoadKg)) return { ok: false, reason: "loading_convention_mismatch" };
    const externalLoadKg = displayLoadKg == null ? 0 : displayLoadKg * expectedConventionMultiplier;
    const effectiveLoadKg = shape.kind === "assistance"
      ? bodyweightContributionKg - externalLoadKg
      : bodyweightContributionKg + externalLoadKg;
    if (!finite(effectiveLoadKg) || effectiveLoadKg <= 0) return { ok: false, reason: "loading_convention_mismatch" };
    const repsSemantic = shape.semantics.includes("reps") ? "reps" : "repsPerSide";
    const reps = values[repsSemantic];
    if (!Number.isSafeInteger(reps) || reps <= 0) return { ok: false, reason: "no_supported_capacity" };
    return {
      ok: true,
      effectiveLoadKg,
      displayLoadKg,
      bodyweightContributionKg,
      multiplier,
      reps,
    };
  }

  function parsePerformedSet(value, shape, prescription, config, delta = 0) {
    if (!isPlainObject(value) || value.completed !== true || value.exerciseId !== prescription.exerciseId
      || !Number.isInteger(value.setIndex) || value.setIndex < 0 || !finite(value.rir) || value.rir < 0) return null;
    if (!Array.isArray(value.metricIds) || !same(value.metricIds, prescription.metricIds)) return null;
    if (value.equipmentId !== config.context.equipmentId || value.loadingConvention !== config.convention) return null;
    const values = metricValuesBySemantic(value, shape);
    if (!values) return null;
    const capturedContext = isPlainObject(value.loadingContext) ? value.loadingContext : null;
    let normalizedCapturedContext = capturedContext;
    if ((shape.kind === "per_side" || shape.kind === "persistent_per_side")
      && capturedContext?.externalLoadMultiplier === null) {
      normalizedCapturedContext = { ...capturedContext, externalLoadMultiplier: config.multiplier };
    }
    // Contribution unknown (owner decision 2026-11-04): a set recorded with no bodyweight (bodyweightKg null, contribution
    // not on) does not say what its bodyweight was, so it is not a different loading setup. The current configuration
    // stands for it: its contribution and the bodyweight it resolves (session, last logged, setup). A set that recorded a
    // bodyweight keeps its own. Unknown sets therefore follow a later change to the resolved bodyweight.
    if (normalizedCapturedContext && shape.coefficient > 0 && normalizedCapturedContext.bodyweightKg == null
      && normalizedCapturedContext.bodyweightContributionEnabled !== true) {
      normalizedCapturedContext = { ...normalizedCapturedContext,
        bodyweightContributionEnabled: config.bodyweightContributionEnabled, bodyweightKg: config.bodyweightKg };
    }
    if (normalizedCapturedContext) {
      const capturedMultiplier = normalizedCapturedContext.externalLoadMultiplier;
      if (capturedMultiplier !== config.multiplier) return { ok: false, reason: "loading_convention_mismatch" };
      if (shape.coefficient > 0
        && normalizedCapturedContext.bodyweightContributionEnabled !== config.bodyweightContributionEnabled) {
        return { ok: false, reason: "loading_convention_mismatch" };
      }
    }
    const transformed = transformActualLoad(values, shape, config.convention, normalizedCapturedContext);
    if (!transformed.ok) return transformed;
    // A max set's 0 is measured, not reported, so the calibration shift never moves it (Plan 077, OD-18).
    const failure = value.effortSource === "failure";
    const rir = failure || !delta ? value.rir : Math.max(0, value.rir - delta);
    const capacityKg = transformed.effectiveLoadKg * (1 + (transformed.reps + Math.min(rir, RIR_CREDIT_CAP)) / 30);
    return {
      failure,
      effortSource: value.effortSource,
      warmup: value.warmup,
      date: value.date,
      ...transformed,
      capacityKg,
      sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
      equipmentId: value.equipmentId ?? null,
      loadingConvention: value.loadingConvention,
      setIndex: value.setIndex,
      rir: value.rir,
    };
  }

  function parseSession(session, shape, prescription, config, delta = 0) {
    if (!isPlainObject(session) || session.completed !== true || !Array.isArray(session.sets)) return { sessionId: null, sets: [], reasons: [] };
    const sessionId = typeof session.sessionId === "string" ? session.sessionId : null;
    const sets = [];
    const reasons = new Set();
    for (const value of session.sets) {
      if (!isPlainObject(value) || value.exerciseId !== prescription.exerciseId) continue;
      const parsed = parsePerformedSet(value, shape, prescription, config, delta);
      if (parsed?.ok === false) reasons.add(parsed.reason);
      else if (parsed) sets.push({ ...parsed, sessionId, date: parsed.date ?? session.date });
    }
    return { sessionId, sets: sets.sort((left, right) => left.setIndex - right.setIndex), reasons: [...reasons] };
  }

  function sessionFirstSet(session) {
    return session.sets.find((entry) => entry.setIndex === 0) || null;
  }

  function fatigueFrom(sessions) {
    const sample = sessions.filter((session) => sessionFirstSet(session)).slice(-3);
    const lastSetIndex = Math.max(-1, ...sample.flatMap((session) => session.sets.map((set) => set.setIndex)));
    const adjacentDrops = [];
    for (let fromSetIndex = 0; fromSetIndex < lastSetIndex; fromSetIndex += 1) {
      const drops = [];
      for (const session of sample) {
        const previous = session.sets.find((set) => set.setIndex === fromSetIndex);
        const next = session.sets.find((set) => set.setIndex === fromSetIndex + 1);
        // The drop into a max set mixes the lifter's reporting error with fatigue, so it is not fatigue (Plan 077, OD-19).
        if (!previous || !next || previous.capacityKg <= 0 || previous.failure || next.failure) continue;
        drops.push((previous.capacityKg - next.capacityKg) / previous.capacityKg);
      }
      adjacentDrops.push({
        fromSetIndex,
        toSetIndex: fromSetIndex + 1,
        drop: Math.round(clamp(median(drops), 0, 0.15) * 1e12) / 1e12,
      });
    }
    return {
      adjacentDrops,
      sampleSessionIds: sample.map((session) => session.sessionId),
    };
  }

  function fatigueDropAfter(fatigue, fromSetIndex) {
    return fatigue.adjacentDrops.find((entry) => entry.fromSetIndex === fromSetIndex)?.drop ?? 0;
  }

  function futureCapacity(capacityKg, prescriptionSetIndex, fatigue) {
    let projected = capacityKg;
    for (let fromSetIndex = 0; fromSetIndex < prescriptionSetIndex - 1; fromSetIndex += 1) {
      projected *= 1 - fatigueDropAfter(fatigue, fromSetIndex);
    }
    return projected;
  }

  function makeHistoryAnchor(sessions) {
    const withFirst = sessions.map((session) => ({ session, first: sessionFirstSet(session) }))
      .filter((entry) => entry.first);
    const latest = withFirst.slice(-3);
    if (!latest.length) return null;
    const mostRecent = latest.at(-1);
    return {
      source: "history",
      sessionId: mostRecent.session.sessionId,
      sessionIds: latest.map((entry) => entry.session.sessionId),
      setIndex: 0,
      effectiveLoadKg: median(latest.map((entry) => entry.first.effectiveLoadKg)),
      capacityKg: median(latest.map((entry) => entry.first.capacityKg)),
      displayLoadKg: mostRecent.first.displayLoadKg,
      loadingConvention: mostRecent.first.loadingConvention,
      equipmentId: mostRecent.first.equipmentId,
    };
  }

  function currentSessionAnchor(currentRows, shape, prescription, config, delta = 0) {
    const eligible = [];
    const reasons = new Set();
    const targetSetIndex = prescription.setIndex - 1;
    for (const value of Array.isArray(currentRows) ? currentRows : []) {
      if (!isPlainObject(value) || value.exerciseId !== prescription.exerciseId
        || value.completed !== true || !Number.isInteger(value.setIndex) || value.setIndex >= targetSetIndex) continue;
      const parsed = parsePerformedSet(value, shape, prescription, config, delta);
      if (parsed?.ok === false) reasons.add(parsed.reason);
      else if (parsed) eligible.push(parsed);
    }
    eligible.sort((left, right) => left.setIndex - right.setIndex);
    const latest = eligible.at(-1);
    return latest ? {
      anchor: {
        source: "current_session",
        sessionId: latest.sessionId,
        sessionIds: [],
        setIndex: latest.setIndex,
        effectiveLoadKg: latest.effectiveLoadKg,
        capacityKg: latest.capacityKg,
        displayLoadKg: latest.displayLoadKg,
        loadingConvention: latest.loadingConvention,
        equipmentId: latest.equipmentId,
      },
      reasons: [...reasons],
    } : { anchor: null, reasons: [...reasons] };
  }

  function toEffectiveLoad(displayLoadKg, shape, config) {
    const external = displayLoadKg == null ? 0 : displayLoadKg * config.multiplier;
    const effectiveLoadKg = shape.kind === "assistance"
      ? config.bodyweightContributionKg - external
      : config.bodyweightContributionKg + external;
    return finite(effectiveLoadKg) && effectiveLoadKg > 0 ? effectiveLoadKg : null;
  }

  function compareCandidates(left, right, midpoint, targetRir, anchor, weightMatch) {
    if (weightMatch && finite(anchor?.displayLoadKg)) {
      const leftMatches = Math.abs(left.displayLoadKg - anchor.displayLoadKg) < 1e-9;
      const rightMatches = Math.abs(right.displayLoadKg - anchor.displayLoadKg) < 1e-9;
      if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
    }
    const leftDistance = Math.abs(left.reps - midpoint);
    const rightDistance = Math.abs(right.reps - midpoint);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    const leftRirDistance = Math.abs(left.predictedRir - targetRir);
    const rightRirDistance = Math.abs(right.predictedRir - targetRir);
    if (leftRirDistance !== rightRirDistance) return leftRirDistance - rightRirDistance;
    const leftLoadChange = finite(anchor?.displayLoadKg) ? Math.abs(left.displayLoadKg - anchor.displayLoadKg) : 0;
    const rightLoadChange = finite(anchor?.displayLoadKg) ? Math.abs(right.displayLoadKg - anchor.displayLoadKg) : 0;
    if (leftLoadChange !== rightLoadChange) return leftLoadChange - rightLoadChange;
    const leftLoad = left.displayLoadKg ?? 0;
    const rightLoad = right.displayLoadKg ?? 0;
    return leftLoad - rightLoad || left.reps - right.reps;
  }

  function candidatesForRange(range, shape, config, projectedCapacityKg, targetRir, settings, anchor, bound = null) {
    const midpoint = (range.min + range.max) / 2;
    const candidates = [];
    const loads = (config.displayLoadSemantic ? config.loads : [null])
      .filter((load) => !bound || (load != null && load >= bound.min - 1e-9 && load <= bound.max + 1e-9));
    for (const displayLoadKg of loads) {
      const effectiveLoadKg = toEffectiveLoad(displayLoadKg, shape, config);
      if (effectiveLoadKg == null) continue;
      for (let reps = range.min; reps <= range.max; reps += 1) {
        const predictedRir = 30 * (projectedCapacityKg / effectiveLoadKg - 1) - reps;
        if (!finite(predictedRir) || predictedRir < targetRir - 1e-9 || predictedRir > targetRir + 1 + 1e-9) continue;
        candidates.push({ displayLoadKg, effectiveLoadKg, reps, predictedRir });
      }
    }
    return candidates.sort((left, right) => compareCandidates(left, right, midpoint, targetRir, anchor, settings.weightMatch));
  }

  function targetFields(shape, repSemantic, reps, rir, displayLoadKg) {
    const targets = { [repSemantic]: reps, rir };
    if (shape.kind === "external" && displayLoadKg != null) targets.loadKg = displayLoadKg;
    else if (shape.kind === "assistance" && displayLoadKg != null) targets.assistanceKg = displayLoadKg;
    else if (shape.kind === "per_side" && displayLoadKg != null) targets.loadPerSideKg = displayLoadKg;
    else if (shape.kind === "persistent_per_side" && displayLoadKg != null) targets.persistentLoadPerSideKg = displayLoadKg;
    return targets;
  }

  function makeRecommendation(prescription, status, reasonCodes, overrides = {}) {
    const shape = overrides.shape;
    const { shape: ignoredShape, ...publicOverrides } = overrides;
    const repSemantic = shape?.repSemantic || (prescription?.metricDefinitions || []).find((entry) =>
      entry?.semantic === "reps" || entry?.semantic === "repsPerSide")?.semantic || "reps";
    const targetValue = prescription?.targets?.[repSemantic];
    const range = finite(targetValue) ? { min: targetValue, max: targetValue }
      : isPlainObject(targetValue) && finite(targetValue.min) && finite(targetValue.max)
        ? { min: targetValue.min, max: targetValue.max } : null;
    const midpointReps = range ? Math.round((range.min + range.max) / 2) : undefined;
    const targets = midpointReps === undefined ? {} : { [repSemantic]: midpointReps };
    if (finite(prescription?.rir)) targets.rir = prescription.rir;
    const codes = [...new Set(reasonCodes)];
    return {
      prescriptionId: typeof prescription?.id === "string" ? prescription.id : null,
      slotId: typeof prescription?.slotId === "string" ? prescription.slotId : null,
      exerciseId: typeof prescription?.exerciseId === "string" ? prescription.exerciseId : null,
      setIndex: Number.isInteger(prescription?.setIndex) ? prescription.setIndex : null,
      status,
      targets,
      reasonCodes: codes,
      reasons: codes.map((code) => REASONS[code] || "Automatic progression is unavailable for this set."),
      formulaVersion: FORMULA_VERSION,
      historyAnchor: null,
      fatigue: { adjacentDrops: [], sampleSessionIds: [], projectedCapacityKg: null },
      loadingAssumptions: null,
      ...publicOverrides,
    };
  }

  function recommendOne(prescription, history, currentSession, loadingContext, settings) {
    const shape = prescriptionShape(prescription);
    if (!shape.ok) return makeRecommendation(prescription, "invalid", shape.reasons, { shape });
    if (!shape.supported) {
      const status = shape.reasons.includes("configuration_required") ? "configuration_required" : "manual";
      return makeRecommendation(prescription, status, shape.reasons, { shape });
    }
    const config = currentConfiguration(prescription, shape, loadingContext);
    if (!config.ok) return makeRecommendation(prescription, config.status, config.reasons, { shape });
    const settingsResult = normalizeSettings(settings);
    if (!settingsResult.ok) return makeRecommendation(prescription, "invalid", settingsResult.reasons, { shape });
    const options = settingsResult.value;

    // One solve per reading of the lifter's reported RIR: as logged (delta 0), and shifted by their calibration within
    // the load bound of the unshifted suggestion (Plan 077, OD-18).
    const solve = (delta, bound) => {
      const parsedHistory = (Array.isArray(history) ? history : [])
        .map((session) => parseSession(session, shape, prescription, config, delta));
      const live = currentSessionAnchor(currentSession, shape, prescription, config, delta);
      const anchor = live.anchor || makeHistoryAnchor(parsedHistory);
      if (!anchor) return { parsedHistory, live, anchor: null };
      const fatigue = fatigueFrom(parsedHistory);
      const projectedCapacityKg = live.anchor
        ? live.anchor.capacityKg * (1 - fatigueDropAfter(fatigue, live.anchor.setIndex))
        : futureCapacity(anchor.capacityKg, prescription.setIndex, fatigue);
      let selected = null;
      let searchedRange = { ...shape.range };
      let candidates = candidatesForRange(searchedRange, shape, config, projectedCapacityKg,
        prescription.rir, options, anchor, bound);
      if (candidates.length) selected = candidates[0];
      if (!selected && options.expandRepRange) {
        for (let pass = 0; pass < 4 && !selected; pass += 1) {
          searchedRange = {
            min: Math.max(3, searchedRange.min - 1),
            max: Math.min(30, searchedRange.max + 1),
          };
          candidates = candidatesForRange(searchedRange, shape, config, projectedCapacityKg,
            prescription.rir, options, anchor, bound);
          if (candidates.length) selected = candidates[0];
          if (searchedRange.min === 3 && searchedRange.max === 30) break;
        }
      }
      return { parsedHistory, live, anchor, fatigue, projectedCapacityKg, selected, searchedRange };
    };
    const baseline = solve(0, null);
    let run = baseline;
    const delta = options.calibrationDelta;
    if (delta && baseline.selected) {
      const at = baseline.selected.displayLoadKg == null ? -1 : config.loads.indexOf(baseline.selected.displayLoadKg);
      const bound = at < 0 ? null : {
        min: config.loads[Math.max(0, at - CALIBRATION_STEPS.down)],
        max: config.loads[Math.min(config.loads.length - 1, at + CALIBRATION_STEPS.up)],
      };
      const shifted = solve(delta, bound);
      // A shift that finds nothing inside the bound leaves the unshifted suggestion: calibration never removes one.
      if (shifted.selected) run = shifted;
    }
    const { parsedHistory, live, anchor, fatigue, projectedCapacityKg, selected, searchedRange } = run;
    if (!anchor) {
      const reasons = new Set(["no_comparable_history", ...parsedHistory.flatMap((session) => session.reasons), ...live.reasons]);
      return makeRecommendation(prescription,
        reasons.has("historical_bodyweight_required") || reasons.has("per_side_convention_required")
          ? "configuration_required" : "manual",
        [...reasons], { shape });
    }
    const displayLoadSemantic = config.displayLoadSemantic;
    if (!selected) {
      const expanded = !same(searchedRange, shape.range);
      return makeRecommendation(prescription, "manual",
        [expanded ? "no_candidate_after_expansion" : "no_candidate_in_range"], {
          shape,
          historyAnchor: anchor,
          fatigue: { ...fatigue, projectedCapacityKg },
          loadingAssumptions: {
            equipmentId: config.context.equipmentId ?? null,
            loadingConvention: config.convention,
            availableLoadsKg: [...config.loads],
            bodyweightContributionEnabled: config.bodyweightContributionEnabled,
            bodyweightKg: config.bodyweightKg,
            bodyweightContributionKg: config.bodyweightContributionKg,
            externalLoadMultiplier: config.multiplier,
            assistanceDirection: shape.kind === "assistance" ? "subtract" : null,
          },
          expandedRepRange: expanded ? searchedRange : undefined,
        });
    }
    const values = targetFields(shape, shape.repSemantic, selected.reps, prescription.rir, selected.displayLoadKg);
    const expanded = !same(searchedRange, shape.range);
    const reasonCodes = [
      anchor.source === "current_session" ? "current_session_anchor" : "history_anchor",
      ...(expanded ? ["rep_range_expanded"] : []),
    ];
    return makeRecommendation(prescription, "recommended", reasonCodes, {
      shape,
      targets: values,
      historyAnchor: anchor,
      fatigue: { ...fatigue, projectedCapacityKg },
      loadingAssumptions: {
        equipmentId: config.context.equipmentId ?? null,
        loadingConvention: config.convention,
        availableLoadsKg: [...config.loads],
        bodyweightContributionEnabled: config.bodyweightContributionEnabled,
        bodyweightKg: config.bodyweightKg,
        bodyweightContributionKg: config.bodyweightContributionKg,
        externalLoadMultiplier: config.multiplier,
        assistanceDirection: shape.kind === "assistance" ? "subtract" : null,
      },
      targetEffectiveLoadKg: selected.effectiveLoadKg,
      predictedRir: selected.predictedRir,
      repRange: searchedRange,
      displayLoadSemantic,
      calibration: {
        version: CALIBRATION_VERSION,
        delta: run === baseline ? 0 : delta,
        // Whether the shift moved what the lifter is asked to do (the Why line says so only then).
        moved: run !== baseline && (selected.displayLoadKg !== baseline.selected.displayLoadKg || selected.reps !== baseline.selected.reps),
        baseline: run === baseline ? null : { displayLoadKg: baseline.selected.displayLoadKg, reps: baseline.selected.reps },
      },
    });
  }

  /** Did this lift's performance drop (owner rule, 2026-11-06)? A lighter suggestion is not evidence of fatigue: the
   *  engine also lowers a load to fit the rep range or the effort target. A drop is read only from what was performed,
   *  on the first working set the anchor reads: at least two comparable earlier sessions, and the latest one did fewer
   *  reps or less load than the one before it at the same or a harder effort, so its capacity is lower. */
  function performanceTrend(prescription, history = [], loadingContext = {}) {
    const result = (status, comparableSessions) => ({ status, comparableSessions, dropped: status === "dropped" });
    const shape = prescriptionShape(prescription);
    if (!shape.ok || !shape.supported) return result("insufficient_history", 0);
    const config = currentConfiguration(prescription, shape, loadingContext);
    if (!config.ok) return result("insufficient_history", 0);
    const firsts = (Array.isArray(history) ? history.slice(-1000) : [])
      .map((session) => sessionFirstSet(parseSession(session, shape, prescription, config)))
      .filter(Boolean);
    if (firsts.length < 2) return result("insufficient_history", firsts.length);
    const [previous, latest] = firsts.slice(-2);
    const dropped = latest.rir <= previous.rir
      && latest.effectiveLoadKg <= previous.effectiveLoadKg + 1e-9 && latest.reps <= previous.reps
      && latest.capacityKg < previous.capacityKg - 1e-9;
    return result(dropped ? "dropped" : "steady", firsts.length);
  }

  const emptyStandingEvidence = () => ({ sets: 0, sessions: 0, pairs: 0, agreement: null, gapDays: null,
    checks: 0, spread: null, state: "uncalibrated" });

  /** Standing reads the same comparable rows as selection, without changing the anchor or the solve.
   *  `settings.now` is an ISO date for historical replay; one local calendar day is shared by a batch by default. */
  function standingFor(result, prescription, history, loadingContext, settings, now) {
    // The gauge loads later in the page shell; resolve its pure helpers when a recommendation is requested.
    const quality = root?.RepForgeCalibrationGauge ||
      (typeof require === "function" ? require("./calibration-gauge.js") : null);
    const calibration = isPlainObject(settings?.calibration)
      && settings.calibration.version === CALIBRATION_VERSION ? settings.calibration : null;
    const evidence = { ...emptyStandingEvidence(),
      checks: Number.isInteger(calibration?.n) && calibration.n >= 0 ? calibration.n : 0,
      spread: finite(calibration?.spread) && calibration.spread >= 0 ? calibration.spread : null,
      state: ["uncalibrated", "calibrated", "over", "under"].includes(calibration?.state)
        ? calibration.state : "uncalibrated" };
    const standing = (word, reasons) => ({ version: STANDING_VERSION, word, reasons, evidence });
    if (!result.historyAnchor || result.status === "configuration_required") return standing("first", ["no_history"]);
    const shape = prescriptionShape(prescription);
    const config = currentConfiguration(prescription, shape, loadingContext);
    const observations = [];
    let hasHistoryAnchor = false;
    const day = (date) => Math.floor(Date.parse(date) / 86400000);
    let latestComparableDay = null;
    for (const session of history) {
      if (!isPlainObject(session) || session.completed !== true || !Array.isArray(session.sets)) continue;
      for (const value of session.sets) {
        if (!isPlainObject(value) || value.exerciseId !== prescription.exerciseId
          || !Number.isInteger(value.setIndex) || value.setIndex < 0) continue;
        const set = parsePerformedSet(value, shape, prescription, config);
        const comparable = set && set.ok !== false;
        if (comparable && set.setIndex === 0) hasHistoryAnchor = true;
        const date = value.date ?? session.date;
        const at = comparable ? day(date) : NaN;
        if (finite(at)) latestComparableDay = latestComparableDay == null ? at : Math.max(latestComparableDay, at);
        observations.push({ key: prescription.exerciseId, session: session.sessionId, set: value.setIndex, date,
          load: comparable ? set.effectiveLoadKg : null, reps: comparable ? set.reps : null, rir: value.rir,
          q: comparable && quality.decay(date, now) > 0 ? quality.rowQuality(set) : 0 });
      }
    }
    const dated = observations.filter((obs) => obs.q > 0);
    if (!hasHistoryAnchor && result.historyAnchor.source === "current_session") return standing("first", ["live_only"]);
    evidence.sets = dated.reduce((sum, obs) => sum + obs.q * quality.decay(obs.date, now), 0);
    evidence.sessions = new Set(dated.map((obs) => obs.session)).size;
    // Keep uncountable rows in the sequence so a missing effort cannot join two otherwise separated sets.
    const pairs = quality.pairsFrom(observations, (load, reps, rir) => load * (1 + (reps + rir) / 30))
      .filter((pair) => quality.decay(pair.date, now) > 0);
    evidence.pairs = pairs.length;
    let pairWeight = 0, agreedWeight = 0;
    for (const pair of pairs) {
      const weight = pair.q * quality.decay(pair.date, now);
      pairWeight += weight;
      if (pair.agree) agreedWeight += weight;
    }
    evidence.agreement = pairWeight > 0 ? agreedWeight / pairWeight : null;
    if (latestComparableDay != null && finite(day(now))) evidence.gapDays = Math.max(0, day(now) - latestComparableDay);
    const reasons = [];
    if (evidence.sets < 6) reasons.push("few_sets");
    if (evidence.sessions < 2) reasons.push("few_sessions");
    if (evidence.pairs >= 4 && evidence.agreement < 0.6) reasons.push("disagreement");
    if (evidence.state === "uncalibrated" && calibration?.reason === "inconsistent") reasons.push("inconsistent_checks");
    if (evidence.gapDays >= 42) reasons.push("break");
    return standing(reasons.length ? "learning" : "solid", reasons);
  }

  function recommendSets(prescriptions, history = [], currentSession = [], loadingContext = {}, settings = {}) {
    if (!Array.isArray(prescriptions)) return [];
    const boundedHistory = Array.isArray(history) ? history.slice(-1000) : [];
    const boundedSession = Array.isArray(currentSession) ? currentSession.slice(-100) : [];
    const date = new Date();
    const now = settings?.now ?? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    // A batch repeats a slot's prescription for each working set. Standing scans the same history for all of them.
    // Keep this reuse inside the call, so edited history, a different day or calibration can never leave stale evidence.
    const standings = new Map();
    return prescriptions.map((prescription) => {
      const result = recommendOne(prescription, boundedHistory, boundedSession, loadingContext, settings);
      let standing;
      try {
        const key = result.historyAnchor ? JSON.stringify({ ...prescription, id: null, setIndex: null,
          standingSource: result.historyAnchor.source, standingConfigurationRequired: result.status === "configuration_required" }) : null;
        standing = key == null ? null : standings.get(key);
        if (!standing) {
          standing = standingFor(result, prescription, boundedHistory, loadingContext, settings, now);
          if (key != null) standings.set(key, standing);
        }
        standing = { ...standing, reasons: [...standing.reasons], evidence: { ...standing.evidence } };
      }
      catch {
        // Standing is supporting evidence. Its failure cannot take an already selected target away.
        standing = { unavailable: true, version: STANDING_VERSION, word: result.historyAnchor ? "learning" : "first",
          reasons: result.historyAnchor ? ["few_sets", "few_sessions"] : ["no_history"], evidence: emptyStandingEvidence() };
      }
      return { ...result, standing };
    });
  }

  const api = Object.freeze({ ENGINE_VERSION, STANDING_VERSION, RIR_CREDIT_CAP, CALIBRATION_VERSION, CALIBRATION_DELTA, CALIBRATION_STEPS, FORMULA_VERSION, SUPPORTED_SEMANTICS, BODYWEIGHT_MATERIAL_THRESHOLD,
    effectiveBodyweightCoefficient, performanceTrend, recommendSets });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
