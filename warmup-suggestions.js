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

  const hasId = value => typeof value === "string" && value.length > 0;
  const positive = value => Number.isFinite(value) && value > 0;
  const sameLoad = (left, right) => Math.abs(left - right) <= KG_EPSILON;
  const compareIds = (left, right) => left < right ? -1 : Number(left > right);
  const validStep = step => positive(step?.loadKg) && Number.isInteger(step.reps) && step.reps > 0;

  function metricKind(semantics) {
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
      while (units >= sizeUnits) {
        plates.push(size);
        units -= sizeUnits;
      }
    }
    return plates;
  }

  function loadGrid(loads) {
    return [...new Set(loads.filter(positive))].sort((left, right) => left - right);
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

  function agrees(previous, current, grid) {
    if (previous.steps.length !== current.steps.length) return false;
    const loads = lighterLoads(grid, current.workLoadKg, current.barKg);
    return sameSequence(projectSequence(previous, current.workLoadKg, loads, current.barKg), current.steps);
  }

  function sessionEarlierLift({ liftKey, movementId, primaryMuscle, sessionId, now, completedWorkingLifts }) {
    if (!hasId(movementId) || !hasId(primaryMuscle) || !hasId(sessionId) || !Number.isFinite(now)) return null;
    let latest = null;
    for (const lift of completedWorkingLifts) {
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
    return hasId(lift.liftKey) && lift.liftKey !== observation.liftKey
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
    for (const observation of observations) {
      if (!observation || observation.version !== OBSERVATION_VERSION || observation.liftKey !== liftKey
        || observation.resetGeneration !== resetGeneration || !hasId(observation.sessionId) || observation.sessionId === sessionId
        || !hasId(observation.workingSetId) || !positive(observation.workLoadKg)
        || !Number.isFinite(observation.savedAt) || observation.savedAt > now
        || (observation.barKg !== null && !positive(observation.barKg))
        || (observation.earlierLift && !validEarlierLift(observation.earlierLift, observation))
        || !validOutcome(observation)) continue;
      const existing = bySession.get(observation.sessionId);
      // A retry adds no evidence. Conflicting projections cannot identify the first eligible occurrence.
      if (!existing) bySession.set(observation.sessionId, { observation, signature: observationSignature(observation) });
      else if (existing.signature !== observationSignature(observation)) existing.observation = null;
    }
    return [...bySession.values()].map(entry => entry.observation).filter(Boolean)
      .sort((left, right) => left.savedAt - right.savedAt || compareIds(left.sessionId, right.sessionId));
  }

  function learningWindow(decisions, now) {
    return decisions.filter(observation => now - observation.savedAt <= POLICY.LEARNING_WINDOW_MS)
      .slice(-POLICY.LEARNING_OBSERVATIONS);
  }

  const contextKey = earlierLift => earlierLift?.liftKey ?? null;

  function sequenceInContext(observation, key) {
    return observation.decision !== "skipped" && (key === null || observation.steps.length === POLICY.ALREADY_WARM_STEPS);
  }

  function establishedSequence(observations, key, grid) {
    let preference = null;
    let run = [];
    for (const observation of observations) {
      if (contextKey(observation.earlierLift) !== key) continue;
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
   * metric/loading facts for the performed lift. Pass barKg only for known total-bar loading with
   * the supported plate assumptions. completedWorkingLifts contains actual working sets only.
   * Times are epoch milliseconds. Each saved observation is resolved against live history by the
   * adapter: its first working row still exists and `steps` holds the ordered actual {setId, loadKg, reps}.
   * The adapter gives programmed preparation and Find your weight precedence over this policy.
   */
  function suggestWarmups({
    liftKey = null, movementId, primaryMuscle, sessionId, now, workLoadKg = null, availableLoadsKg = [],
    equipmentKind, barKg = null, loadingConvention, metricSemantics = [], hasMaterialBodyweight = false,
    completedWorkingLifts = [], observations = [], resetGeneration = null,
  }) {
    const barbell = equipmentKind === "barbell";
    const knownBarKg = barbell && positive(barKg) ? barKg : null;
    const kind = metricKind(metricSemantics);
    const earlierLift = sessionEarlierLift({ liftKey, movementId, primaryMuscle, sessionId, now, completedWorkingLifts });
    const evidence = {
      liftKey, workLoadKg: positive(workLoadKg) ? workLoadKg : null, barKg: knownBarKg, resetGeneration,
      earlierLift, sessions: [], skipStreak: 0, unavailableReason: null,
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
    else if (!positive(workLoadKg)) unavailableReason = "unknown-work-load";
    else if (!barbell && equipmentKind !== "machine" && equipmentKind !== "dumbbell") unavailableReason = "unknown-equipment";
    if (unavailableReason) {
      evidence.unavailableReason = unavailableReason;
      return result("none-with-reason");
    }

    const grid = loadGrid(availableLoadsKg);
    const loads = lighterLoads(grid, workLoadKg, knownBarKg);
    const decisions = Number.isFinite(now) ? savedDecisions(observations, liftKey, resetGeneration, now, sessionId) : [];
    const skips = trailingSkips(decisions);
    evidence.skipStreak = skips.length;
    if (skips.length >= POLICY.SKIPS_TO_SUPPRESS) return result("suppressed", [], skips.slice(-POLICY.SKIPS_TO_SUPPRESS));

    const recent = learningWindow(decisions, now);
    const established = (reason, key) => {
      const preference = establishedSequence(recent, key, grid);
      if (!preference) return null;
      const suggestions = projectSequence(preference.observation, workLoadKg, loads, knownBarKg);
      return suggestions.length ? result(reason, suggestions, preference.sessions) : null;
    };
    const short = earlierLift && established("already-warm", earlierLift.liftKey);
    if (short) return short;
    const ordinary = established("learned", null);
    if (ordinary) return ordinary;
    const baseline = snapSteps(baselineSteps(workLoadKg, barbell, knownBarKg), loads, knownBarKg);
    if (baseline.length) return result("baseline", baseline);
    evidence.unavailableReason = "no-lighter-load";
    return result("none-with-reason");
  }

  /**
   * Call on the first eligible occurrence with completed work in the saved session.
   * `suggestion` is the captured result before edits. `steps` is the final ordered plan, with
   * actual values and a setId for each logged step. A pending step has no setId. `skipped`
   * marks an explicit skip. Pass the current reset generation for the notice, separately from
   * the captured generation on the observation. Append the observation with the working row.
   */
  function classifyWarmupFinish({
    suggestion, steps = [], skipped = false, sessionId, workingSetId, savedAt, resetGeneration = null,
    observations = [], availableLoadsKg = [],
  }) {
    const none = { observation: null, onceMore: false };
    const evidence = suggestion?.evidence;
    if (!hasId(sessionId) || !hasId(workingSetId) || !Number.isFinite(savedAt) || !evidence
      || (evidence.unavailableReason && evidence.unavailableReason !== "no-lighter-load")) return none;
    if (observations.some(observation => observation?.liftKey === evidence.liftKey && observation.sessionId === sessionId)) return none;
    const { liftKey, workLoadKg, barKg, earlierLift } = evidence;
    if (earlierLift && !validEarlierLift(earlierLift, { liftKey, sessionId, savedAt })) return none;
    if (skipped) {
      if (evidence.unavailableReason || !Array.isArray(steps) || steps.length > POLICY.MAX_STEPS
        || steps.some(step => !step || step.setId != null)) return none;
    } else if (!validActualSteps(steps, workingSetId)) return none;

    const decision = skipped ? "skipped" : sameSequence(steps, suggestion.suggestions) ? "completed" : "edited";
    const observation = {
      version: OBSERVATION_VERSION, liftKey, workLoadKg, resetGeneration: evidence.resetGeneration, barKg, earlierLift,
      sessionId, workingSetId, savedAt, decision, warmupSetIds: skipped ? [] : steps.map(step => step.setId),
    };
    const result = { observation, onceMore: false };
    if (decision !== "edited" || resetGeneration !== observation.resetGeneration) return result;
    const key = contextKey(earlierLift);
    const current = { ...observation, steps };
    if (!sequenceInContext(current, key)) return result;

    const grid = loadGrid(availableLoadsKg);
    const loads = lighterLoads(grid, workLoadKg, barKg);
    const normalized = projectSequence(current, workLoadKg, loads, barKg);
    if (!sameSequence(normalized, steps) || sameSequence(normalized, suggestion.suggestions)) return result;
    const history = savedDecisions(observations, liftKey, resetGeneration, savedAt, sessionId);
    const latest = learningWindow([...history, current], savedAt).slice(0, -1)
      .findLast(previous => contextKey(previous.earlierLift) === key);
    result.onceMore = !latest || !sequenceInContext(latest, key) || !agrees(latest, current, grid);
    return result;
  }

  const api = Object.freeze({ POLICY, OBSERVATION_VERSION, suggestWarmups, classifyWarmupFinish });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RepForgeWarmupSuggestions = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
