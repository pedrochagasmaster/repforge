(function (root) {
  "use strict";

  const ENGINE_VERSION = "067.1";
  const FORMULA_VERSION = "rir-adjusted-epley@067.1";
  const METRIC_DOMAIN = root?.RepForgeExerciseMetrics ||
    (typeof require === "function" ? require("./exercise-metrics.js") : null);
  if (!METRIC_DOMAIN) throw new Error("RepForgeExerciseMetrics unavailable");

  const DEFINITIONS_BY_ID = new Map(METRIC_DOMAIN.DEFINITIONS.map((entry) => [entry.id, entry]));
  const SUPPORTED_SEMANTICS = Object.freeze({
    external: ["loadKg", "reps"],
    assistance: ["reps", "assistanceKg"],
    bodyweight: ["reps"],
    per_side: ["repsPerSide", "loadPerSideKg"],
    persistent_per_side: ["persistentLoadPerSideKg", "repsPerSide"],
  });
  const LOADING_CONVENTIONS = new Set(["external", "assistance", "bodyweight", "per_side"]);
  const DEFAULT_SETTINGS = Object.freeze({ expandRepRange: true, weightMatch: false });
  const REASONS = Object.freeze({
    available_loads_required: "Set the available loads for this equipment before requesting an automatic load.",
    bodyweight_required: "Record the current bodyweight before using bodyweight contribution.",
    configuration_required: "Complete the loading configuration before requesting an automatic recommendation.",
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
    const kind = Object.keys(SUPPORTED_SEMANTICS).find((key) => same(SUPPORTED_SEMANTICS[key], semantics)) || null;
    if (!kind) return { ok: true, supported: false, kind: null, semantics, reasons: ["no_supported_capacity"] };
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
    if (!finite(value.rir) || value.rir < 0 || value.rir > 4) {
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
    return { ok: true, supported: true, kind, semantics, repSemantic, range, coefficient, reasons: [] };
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

  function transformActualLoad(values, shape, convention, capturedContext) {
    if (!isPlainObject(capturedContext)) {
      if (shape.coefficient > 0) return { ok: false, reason: "historical_bodyweight_required" };
      return { ok: false, reason: "loading_convention_mismatch" };
    }
    if (capturedContext.loadingConvention !== convention) {
      return { ok: false, reason: "loading_convention_mismatch" };
    }
    if (capturedContext.bodyweightCoefficient !== shape.coefficient) {
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

  function parsePerformedSet(value, shape, prescription, config) {
    if (!isPlainObject(value) || value.completed !== true || value.exerciseId !== prescription.exerciseId
      || !Number.isInteger(value.setIndex) || value.setIndex < 0 || !finite(value.rir) || value.rir < 0) return null;
    if (!Array.isArray(value.metricIds) || !same(value.metricIds, prescription.metricIds)) return null;
    if (value.equipmentId !== config.context.equipmentId || value.loadingConvention !== config.convention) return null;
    const values = metricValuesBySemantic(value, shape);
    if (!values) return null;
    const capturedContext = isPlainObject(value.loadingContext) ? value.loadingContext : null;
    if (capturedContext) {
      const capturedMultiplier = capturedContext.externalLoadMultiplier;
      if (capturedMultiplier !== config.multiplier) return { ok: false, reason: "loading_convention_mismatch" };
      if (shape.coefficient > 0
        && capturedContext.bodyweightContributionEnabled !== config.bodyweightContributionEnabled) {
        return { ok: false, reason: "loading_convention_mismatch" };
      }
    }
    const transformed = transformActualLoad(values, shape, config.convention, capturedContext);
    if (!transformed.ok) return transformed;
    const capacityKg = transformed.effectiveLoadKg * (1 + (transformed.reps + value.rir) / 30);
    return {
      ...transformed,
      capacityKg,
      sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
      equipmentId: value.equipmentId ?? null,
      loadingConvention: value.loadingConvention,
      setIndex: value.setIndex,
      rir: value.rir,
    };
  }

  function parseSession(session, shape, prescription, config) {
    if (!isPlainObject(session) || session.completed !== true || !Array.isArray(session.sets)) return { sessionId: null, sets: [], reasons: [] };
    const sessionId = typeof session.sessionId === "string" ? session.sessionId : null;
    const sets = [];
    const reasons = new Set();
    for (const value of session.sets) {
      if (!isPlainObject(value) || value.exerciseId !== prescription.exerciseId) continue;
      const parsed = parsePerformedSet(value, shape, prescription, config);
      if (parsed?.ok === false) reasons.add(parsed.reason);
      else if (parsed) sets.push({ ...parsed, sessionId });
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
        if (!previous || !next || previous.capacityKg <= 0) continue;
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

  function currentSessionAnchor(currentRows, shape, prescription, config) {
    const eligible = [];
    const reasons = new Set();
    const targetSetIndex = prescription.setIndex - 1;
    for (const value of Array.isArray(currentRows) ? currentRows : []) {
      if (!isPlainObject(value) || value.exerciseId !== prescription.exerciseId
        || value.completed !== true || !Number.isInteger(value.setIndex) || value.setIndex >= targetSetIndex) continue;
      const parsed = parsePerformedSet(value, shape, prescription, config);
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

  function candidatesForRange(range, shape, config, projectedCapacityKg, targetRir, settings, anchor) {
    const midpoint = (range.min + range.max) / 2;
    const candidates = [];
    const loads = config.displayLoadSemantic ? config.loads : [null];
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

    const parsedHistory = (Array.isArray(history) ? history : [])
      .map((session) => parseSession(session, shape, prescription, config));
    const live = currentSessionAnchor(currentSession, shape, prescription, config);
    const anchor = live.anchor || makeHistoryAnchor(parsedHistory);
    if (!anchor) {
      const reasons = new Set(["no_comparable_history", ...parsedHistory.flatMap((session) => session.reasons), ...live.reasons]);
      return makeRecommendation(prescription,
        reasons.has("historical_bodyweight_required") || reasons.has("per_side_convention_required")
          ? "configuration_required" : "manual",
        [...reasons], { shape });
    }
    const fatigue = fatigueFrom(parsedHistory);
    const projectedCapacityKg = live.anchor
      ? live.anchor.capacityKg * (1 - fatigueDropAfter(fatigue, live.anchor.setIndex))
      : futureCapacity(anchor.capacityKg, prescription.setIndex, fatigue);
    const displayLoadSemantic = config.displayLoadSemantic;
    let selected = null;
    let searchedRange = { ...shape.range };
    let candidates = candidatesForRange(searchedRange, shape, config, projectedCapacityKg,
      prescription.rir, options, anchor);
    if (candidates.length) selected = candidates[0];
    if (!selected && options.expandRepRange) {
      for (let pass = 0; pass < 4 && !selected; pass += 1) {
        searchedRange = {
          min: Math.max(3, searchedRange.min - 1),
          max: Math.min(30, searchedRange.max + 1),
        };
        candidates = candidatesForRange(searchedRange, shape, config, projectedCapacityKg,
          prescription.rir, options, anchor);
        if (candidates.length) selected = candidates[0];
        if (searchedRange.min === 3 && searchedRange.max === 30) break;
      }
    }
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
    });
  }

  function recommendSets(prescriptions, history = [], currentSession = [], loadingContext = {}, settings = {}) {
    if (!Array.isArray(prescriptions)) return [];
    const boundedHistory = Array.isArray(history) ? history.slice(-1000) : [];
    const boundedSession = Array.isArray(currentSession) ? currentSession.slice(-100) : [];
    return prescriptions.map((prescription) => recommendOne(
      prescription, boundedHistory, boundedSession, loadingContext, settings,
    ));
  }

  const api = Object.freeze({ ENGINE_VERSION, FORMULA_VERSION, recommendSets });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeProgression = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
