(function (root) {
  "use strict";

  const POLICY = Object.freeze({
    EMPTY_BAR_REPS: 8,
    BARBELL_FIRST_FRACTION: 0.57,
    EXTERNAL_FIRST_FRACTION: 0.60,
    FIRST_PERCENTAGE_REPS: 5,
    FINAL_FRACTION: 0.80,
    FINAL_REPS: 2,
    PLATE_SIZES_KG: Object.freeze([25, 20, 15, 10, 5, 2.5, 1.25]),
    MATCHING_SEQUENCES: 2,
    LEARNING_OBSERVATIONS: 6,
    LEARNING_WINDOW_MS: 90 * 24 * 60 * 60 * 1000,
    MAX_STEPS: 6,
    ALREADY_WARM_WINDOW_MS: 15 * 60 * 1000,
    ALREADY_WARM_STEPS: 1,
    SKIPS_TO_SUPPRESS: 3,
  });
  const OBSERVATION_VERSION = 1;
  const KG_EPSILON = 1e-6;
  // Match the canonical load metric bound in exercise-metrics.js.
  const MAX_LOAD_KG = 1000;

  const hasId = value => typeof value === "string" && value.length > 0;
  const validLoad = value => Number.isFinite(value) && value > 0 && value <= MAX_LOAD_KG;
  const validBar = value => value === null || validLoad(value);
  const list = value => Array.isArray(value) ? value : [];
  const sameLoad = (left, right) => Math.abs(left - right) <= KG_EPSILON;
  const compareIds = (left, right) => left < right ? -1 : Number(left > right);
  const validStep = step => validLoad(step?.loadKg) && Number.isInteger(step.reps) && step.reps > 0;

  function metricKind(semantics) {
    semantics = list(semantics);
    const reps = semantics.filter(id => id === "reps" || id === "repsPerSide");
    if (reps.length !== 1 || semantics.length > 2) return null;
    const load = semantics.find(id => id !== reps[0]);
    if (semantics.length === 1) return "bodyweight";
    if (load === "assistanceKg") return "assistance";
    if (load === "loadKg") return "external";
    if (load === "loadPerSideKg" || load === "persistentLoadPerSideKg") return "per_side";
    return null;
  }

  const smallestPlateKg = POLICY.PLATE_SIZES_KG[POLICY.PLATE_SIZES_KG.length - 1];

  // Repeatable paired plates make every multiple of the smallest pair attainable.
  function plateUnitsPerSide(loadKg, barKg) {
    if (!validLoad(loadKg)) return null;
    const pairKg = 2 * smallestPlateKg;
    const units = Math.round((loadKg - barKg) / pairKg);
    return units >= 0 && sameLoad(loadKg, barKg + units * pairKg) ? units : null;
  }

  function platesFor(loadKg, barKg) {
    if (barKg === null) return null;
    let units = plateUnitsPerSide(loadKg, barKg);
    if (units === null) return null;
    const plates = [];
    for (const size of POLICY.PLATE_SIZES_KG) {
      const sizeUnits = Math.round(size / smallestPlateKg);
      const count = Math.floor(units / sizeUnits);
      plates.push(...Array(count).fill(size));
      units %= sizeUnits;
    }
    return plates;
  }

  function loadGrid(loads) {
    return [...new Set(list(loads).filter(validLoad))].sort((left, right) => left - right);
  }

  function lighterLoads(loads, workLoadKg, barKg) {
    return loads.filter(load => load < workLoadKg - KG_EPSILON && (barKg === null || plateUnitsPerSide(load, barKg) !== null));
  }

  function snapSteps(steps, loads, barKg) {
    const suggestions = [];
    for (const { loadKg, reps, emptyBar } of steps) {
      if (emptyBar && barKg === null) continue;
      const load = emptyBar ? loads.find(candidate => sameLoad(candidate, barKg)) : nearestLoad(loadKg, loads);
      const previous = suggestions[suggestions.length - 1];
      if (load === undefined || (previous && load <= previous.loadKg + KG_EPSILON)) continue;
      suggestions.push({ loadKg: load, reps, platesPerSideKg: platesFor(load, barKg) });
    }
    return suggestions;
  }

  function nearestLoad(target, loads) {
    if (!loads.length || target < loads[0] - KG_EPSILON) return undefined;
    let best = loads[0];
    for (const load of loads) {
      if (Math.abs(load - target) >= Math.abs(best - target) - KG_EPSILON) continue;
      best = load;
    }
    return best;
  }

  function baselineSteps(workLoadKg, barbell, barKg) {
    const firstFraction = barbell ? POLICY.BARBELL_FIRST_FRACTION : POLICY.EXTERNAL_FIRST_FRACTION;
    const steps = [
      { loadKg: workLoadKg * firstFraction, reps: POLICY.FIRST_PERCENTAGE_REPS },
      { loadKg: workLoadKg * POLICY.FINAL_FRACTION, reps: POLICY.FINAL_REPS },
    ];
    if (barKg !== null) steps.unshift({ loadKg: barKg, reps: POLICY.EMPTY_BAR_REPS, emptyBar: true });
    return steps;
  }

  function projectSequence(observation, workLoadKg, loads, barKg) {
    const scale = workLoadKg / observation.workLoadKg;
    const steps = observation.steps.map(({ loadKg, reps }) => ({
      loadKg: loadKg * scale, reps, emptyBar: observation.barKg !== null && sameLoad(loadKg, observation.barKg),
    }));
    return snapSteps(steps, loads, barKg);
  }

  function sameSequence(left, right) {
    return left.length === right.length
      && left.every((step, index) => step.reps === right[index].reps && sameLoad(step.loadKg, right[index].loadKg));
  }

  function increasingBelowWork(steps, workLoadKg) {
    return steps.every((step, index) => step.loadKg < workLoadKg - KG_EPSILON
      && (index === 0 || step.loadKg > steps[index - 1].loadKg + KG_EPSILON));
  }

  function normalizeSequence(observation, workLoadKg, loads, barKg) {
    if (!increasingBelowWork(observation.steps, observation.workLoadKg)) return null;
    const projected = projectSequence(observation, workLoadKg, loads, barKg);
    return projected.length === observation.steps.length ? projected : null;
  }

  function agrees(previous, current, grid) {
    if (previous.steps.length !== current.steps.length) return false;
    const { workLoadKg, barKg } = current;
    const loads = lighterLoads(grid, workLoadKg, barKg);
    const before = normalizeSequence(previous, workLoadKg, loads, barKg);
    const after = normalizeSequence(current, workLoadKg, loads, barKg);
    return !!before && !!after && sameSequence(before, after);
  }

  function sessionEarlierLift({ liftKey, movementId, primaryMuscle, sessionId, now, completedWorkingLifts }) {
    if (!hasId(movementId) || !hasId(primaryMuscle) || !hasId(sessionId) || !Number.isFinite(now)) return null;
    let latest = null;
    for (const lift of list(completedWorkingLifts)) {
      if (!lift || lift.sessionId !== sessionId || lift.primaryMuscle !== primaryMuscle
        || !hasId(lift.movementId) || lift.movementId === movementId || !hasId(lift.liftKey) || lift.liftKey === liftKey
        || !Number.isFinite(lift.completedAt)) continue;
      const elapsedMs = now - lift.completedAt;
      if (elapsedMs < 0 || elapsedMs > POLICY.ALREADY_WARM_WINDOW_MS) continue;
      if (latest && (latest.completedAt > lift.completedAt
        || (latest.completedAt === lift.completedAt && compareIds(latest.liftKey, lift.liftKey) <= 0))) continue;
      latest = { liftKey: lift.liftKey, movementId: lift.movementId, primaryMuscle, sessionId, completedAt: lift.completedAt, elapsedMs };
    }
    return latest;
  }

  function validEarlierLift(lift, observation) {
    return hasId(lift.liftKey) && lift.liftKey !== observation.liftKey && hasId(lift.movementId) && hasId(lift.primaryMuscle)
      && lift.sessionId === observation.sessionId && Number.isFinite(lift.completedAt) && Number.isFinite(lift.elapsedMs)
      && lift.elapsedMs >= 0 && lift.elapsedMs <= POLICY.ALREADY_WARM_WINDOW_MS
      && lift.completedAt + lift.elapsedMs <= observation.savedAt;
  }

  function validActualSteps(steps, workingSetId) {
    if (!Array.isArray(steps) || !steps.length || steps.length > POLICY.MAX_STEPS) return false;
    const ids = new Set([workingSetId]);
    for (const step of steps) {
      if (!validStep(step) || !hasId(step.setId) || ids.has(step.setId)) return false;
      ids.add(step.setId);
    }
    return true;
  }

  function validOutcome(observation) {
    const { decision, warmupSetIds, steps, workingSetId } = observation;
    if (!Array.isArray(warmupSetIds) || !Array.isArray(steps) || warmupSetIds.length !== steps.length) return false;
    if (decision === "skipped") return steps.length === 0;
    return (decision === "completed" || decision === "edited") && validActualSteps(steps, workingSetId)
      && steps.every((step, index) => step.setId === warmupSetIds[index]);
  }

  function observationSignature(observation) {
    const { workingSetId, savedAt, workLoadKg, barKg, earlierLift, decision, steps } = observation;
    return JSON.stringify([workingSetId, savedAt, workLoadKg, barKg, decision,
      earlierLift && [earlierLift.liftKey, earlierLift.completedAt, earlierLift.elapsedMs],
      steps.map(({ setId, loadKg, reps }) => [setId, loadKg, reps])]);
  }

  function savedDecisions(observations, liftKey, resetGeneration, now, sessionId) {
    const bySession = new Map();
    for (const observation of list(observations)) {
      if (!observation || observation.version !== OBSERVATION_VERSION || observation.liftKey !== liftKey
        || observation.resetGeneration !== resetGeneration || !hasId(observation.sessionId) || observation.sessionId === sessionId
        || !hasId(observation.workingSetId) || !validLoad(observation.workLoadKg)
        || !Number.isFinite(observation.savedAt) || (Number.isFinite(now) && observation.savedAt > now)
        || !validBar(observation.barKg)
        || (observation.earlierLift != null && !validEarlierLift(observation.earlierLift, observation))
        || !validOutcome(observation)) continue;
      const existing = bySession.get(observation.sessionId);
      // A retry adds no evidence. Conflicting projections cannot identify the first eligible occurrence.
      if (!existing) bySession.set(observation.sessionId, { observation, signature: observationSignature(observation) });
      else if (existing.signature !== observationSignature(observation)) existing.observation = null;
    }
    return [...bySession.values()].map(entry => entry.observation).filter(Boolean)
      .sort((left, right) => left.savedAt - right.savedAt || compareIds(left.sessionId, right.sessionId));
  }

  const contextKey = earlierLift => earlierLift?.liftKey ?? null;

  function learningWindow(decisions, now, key) {
    if (!Number.isFinite(now)) return [];
    return decisions.filter(observation => contextKey(observation.earlierLift) === key
      && now - observation.savedAt <= POLICY.LEARNING_WINDOW_MS)
      .slice(-POLICY.LEARNING_OBSERVATIONS);
  }

  function sequenceInContext(observation, key) {
    return observation.decision !== "skipped" && (key === null || observation.steps.length === POLICY.ALREADY_WARM_STEPS);
  }

  function establishedSequence(observations, key, grid) {
    let preference = null;
    let run = [];
    for (const observation of observations) {
      if (!sequenceInContext(observation, key)) {
        run = [];
        continue;
      }
      const previous = run[run.length - 1];
      run = previous && agrees(previous, observation, grid) ? [...run, observation] : [observation];
      if (run.length >= POLICY.MATCHING_SEQUENCES) preference = { observation, sessions: run };
    }
    return preference;
  }

  function trailingSkips(decisions) {
    let index = decisions.length;
    while (index > 0 && decisions[index - 1].decision === "skipped") index--;
    return decisions.slice(index);
  }

  /**
   * The adapter supplies the progression-comparable lift key, canonical offered kg grid, and
   * metric/loading facts for the performed lift. equipmentKind is "barbell", "machine" (including
   * cables), or "dumbbell". A Smith lift uses "barbell" with no known bar. Ambiguous equipment
   * takes the unavailable path. Supply barKg only for a supported metric total-load bar.
   * Pass barKg: null for lb, Smith, and unknown or unsupported bars. That uses the offered grid
   * as-is and omits both the empty-bar step and plate hints.
   * completedWorkingLifts contains actual working sets only.
   * Times are epoch milliseconds. Each saved observation is resolved against live history by the
   * adapter: its first working row still exists and `steps` holds the ordered actual {setId, loadKg, reps}.
   * The adapter gives programmed preparation and Find your weight precedence over this policy.
   * For Add one, request a baseline without observations. Seed the first non-empty-bar five-rep
   * step or the first available step. With no suggestions, lowestLighterLoadKg can seed five reps.
   * A null value leaves the load to the existing metric defaults (including bodyweight/assistance).
   */
  function suggestWarmups(input) {
    const {
      liftKey = null, movementId, primaryMuscle, sessionId, now, workLoadKg = null, availableLoadsKg,
      equipmentKind, barKg = null, loadingConvention, metricSemantics, hasMaterialBodyweight = false,
      completedWorkingLifts, observations, resetGeneration = null,
    } = input ?? {};
    const barbell = equipmentKind === "barbell";
    const knownBarKg = barbell && validLoad(barKg) ? barKg : null;
    const kind = metricKind(metricSemantics);
    const earlierLift = sessionEarlierLift({ liftKey, movementId, primaryMuscle, sessionId, now, completedWorkingLifts });
    const evidence = {
      liftKey, workLoadKg: validLoad(workLoadKg) ? workLoadKg : null, barKg: knownBarKg, resetGeneration,
      earlierLift, sessions: [], skipStreak: 0, unavailableReason: null, lowestLighterLoadKg: null,
    };
    const result = (reason, suggestions = [], sessions = []) => ({
      reason, suggestions, manualAllowed: kind !== null,
      evidence: { ...evidence, sessions: sessions.map(({ sessionId, savedAt }) => ({ sessionId, savedAt })) },
    });

    let unavailableReason = null;
    if (kind === null) unavailableReason = "unsupported-metrics";
    else if (loadingConvention === "assistance" || kind === "assistance") unavailableReason = "assistance";
    else if (loadingConvention === "bodyweight" || kind === "bodyweight" || hasMaterialBodyweight) unavailableReason = "bodyweight";
    else if (loadingConvention !== kind) unavailableReason = "unsupported-loading";
    else if (!hasId(liftKey)) unavailableReason = "unknown-lift";
    else if (!validLoad(workLoadKg)) unavailableReason = "unknown-work-load";
    else if (!barbell && equipmentKind !== "machine" && equipmentKind !== "dumbbell") unavailableReason = "unknown-equipment";
    if (unavailableReason) {
      evidence.unavailableReason = unavailableReason;
      return result("none-with-reason");
    }

    const grid = loadGrid(availableLoadsKg);
    const loads = lighterLoads(grid, workLoadKg, knownBarKg);
    evidence.lowestLighterLoadKg = loads[0] ?? null;
    const decisions = savedDecisions(observations, liftKey, resetGeneration, now, sessionId);
    const skips = trailingSkips(decisions);
    evidence.skipStreak = skips.length;
    if (skips.length >= POLICY.SKIPS_TO_SUPPRESS) return result("suppressed", [], skips.slice(-POLICY.SKIPS_TO_SUPPRESS));

    const preferences = [["learned", null]];
    if (earlierLift) preferences.unshift(["already-warm", earlierLift.liftKey]);
    let fallback = null;
    for (const [reason, key] of preferences) {
      const preference = establishedSequence(learningWindow(decisions, now, key), key, grid);
      if (!preference) continue;
      const suggestions = projectSequence(preference.observation, workLoadKg, loads, knownBarKg);
      if (suggestions.length) return result(reason, suggestions, preference.sessions);
      fallback ??= preference;
    }
    const baseline = snapSteps(baselineSteps(workLoadKg, barbell, knownBarKg), loads, knownBarKg);
    if (baseline.length && fallback) return result("baseline-fallback", baseline, fallback.sessions);
    if (baseline.length) return result("baseline", baseline);
    evidence.unavailableReason = "no-lighter-load";
    return result("none-with-reason", [], fallback?.sessions);
  }

  function validPlanSteps(steps) {
    return Array.isArray(steps) && steps.length <= POLICY.MAX_STEPS && Array.from(steps).every(validStep);
  }

  function capturedBasis(suggestion, sessionId, now) {
    const evidence = suggestion?.evidence;
    if (!evidence || !hasId(sessionId) || !Number.isFinite(now)
      || (evidence.unavailableReason && evidence.unavailableReason !== "no-lighter-load")) return null;
    const { liftKey, workLoadKg, barKg, resetGeneration, earlierLift = null } = evidence;
    if (!hasId(liftKey) || !validLoad(workLoadKg) || !validBar(barKg)
      || (resetGeneration !== null && !hasId(resetGeneration))
      || !validPlanSteps(suggestion.suggestions) || !increasingBelowWork(suggestion.suggestions, workLoadKg)
      || (earlierLift !== null && !validEarlierLift(earlierLift, { liftKey, sessionId, savedAt: now }))) return null;
    return { liftKey, workLoadKg, resetGeneration, barKg, earlierLift };
  }

  function hasSavedOccurrence(observations, liftKey, sessionId) {
    return list(observations).some(observation => observation?.liftKey === liftKey && observation.sessionId === sessionId);
  }

  function firstLearnableEdit(current, suggested, observations, availableLoadsKg, resetGeneration) {
    const { earlierLift, liftKey, workLoadKg, barKg, sessionId, savedAt, steps } = current;
    const key = contextKey(earlierLift);
    if (resetGeneration !== current.resetGeneration || !sequenceInContext(current, key)) return null;
    const grid = loadGrid(availableLoadsKg);
    const loads = lighterLoads(grid, workLoadKg, barKg);
    const normalized = normalizeSequence(current, workLoadKg, loads, barKg);
    const original = normalizeSequence({ ...current, steps: suggested }, workLoadKg, loads, barKg);
    if (!normalized || !original || sameSequence(normalized, original)) return null;

    const history = savedDecisions(observations, liftKey, resetGeneration, savedAt, sessionId);
    const latest = learningWindow([...history, current], savedAt, key).at(-2);
    if (latest && sequenceInContext(latest, key) && agrees(latest, current, grid)) return null;
    if (steps.length !== original.length) return { changedIndices: null };
    const changedIndices = normalized.flatMap((step, index) => (
      step.reps !== original[index].reps || !sameLoad(step.loadKg, original[index].loadKg) ? [index] : []
    ));
    return { changedIndices };
  }

  /**
   * Call on the first eligible occurrence with completed work in the saved session.
   * Supply the captured suggestion before edits and final ordered steps. A pending step
   * has no setId. An explicit skip counts only for an offered sequence with no logged steps.
   * Pass the current reset generation separately from the captured generation. Save the returned
   * observation with the session, mapped to natural selectors for the working and warm-up rows.
   */
  function classifyWarmupFinish(input) {
    const { suggestion, steps = [], skipped = false, sessionId, workingSetId, savedAt, resetGeneration = null,
      observations, availableLoadsKg } = input ?? {};
    const none = { observation: null, onceMore: false };
    const basis = capturedBasis(suggestion, sessionId, savedAt);
    if (!basis || !hasId(workingSetId) || hasSavedOccurrence(observations, basis.liftKey, sessionId)) return none;
    if (skipped) {
      if (suggestion.reason === "suppressed" || !suggestion.suggestions.length
        || !validPlanSteps(steps) || steps.some(step => step.setId != null)) return none;
    } else if (!validActualSteps(steps, workingSetId)) return none;

    const decision = skipped ? "skipped" : sameSequence(steps, suggestion.suggestions) ? "completed" : "edited";
    const observation = {
      version: OBSERVATION_VERSION, ...basis, sessionId, workingSetId, savedAt, decision,
      warmupSetIds: skipped ? [] : steps.map(step => step.setId),
    };
    const onceMore = decision === "edited" && !!firstLearnableEdit({ ...observation, steps }, suggestion.suggestions,
      observations, availableLoadsKg, resetGeneration);
    return { observation, onceMore };
  }

  /**
   * Preview after acknowledging a warm-up log. Pass the complete intended sequence, with actual values
   * on logged steps and pending values on the rest. loggedStepIndex is zero-based and points
   * to the just-logged step with a setId. The caller shows a sequence notice at most once
   * for the same change. This preview creates no observation and needs no working row.
   */
  function previewWarmupEdit(input) {
    const { suggestion, steps, loggedStepIndex, sessionId, now, resetGeneration = null,
      observations, availableLoadsKg } = input ?? {};
    const none = { onceMore: false, kind: null, step: null };
    const basis = capturedBasis(suggestion, sessionId, now);
    if (!basis || !Number.isInteger(loggedStepIndex) || loggedStepIndex < 0 || !validPlanSteps(steps)
      || !hasId(steps[loggedStepIndex]?.setId) || hasSavedOccurrence(observations, basis.liftKey, sessionId)) return none;
    const loggedIds = steps.flatMap(step => step.setId == null ? [] : [step.setId]);
    if (!loggedIds.every(hasId) || new Set(loggedIds).size !== loggedIds.length) return none;
    const edit = firstLearnableEdit({ ...basis, steps, sessionId, savedAt: now, decision: "edited" },
      suggestion.suggestions, observations, availableLoadsKg, resetGeneration);
    if (!edit || (edit.changedIndices && !edit.changedIndices.includes(loggedStepIndex))) return none;
    if (edit.changedIndices?.length !== 1) return { onceMore: true, kind: "sequence", step: null };
    const { loadKg, reps } = steps[loggedStepIndex];
    return { onceMore: true, kind: "step", step: { loadKg, reps } };
  }

  const api = Object.freeze({ POLICY, OBSERVATION_VERSION, suggestWarmups, classifyWarmupFinish, previewWarmupEdit });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeWarmupSuggestions = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
