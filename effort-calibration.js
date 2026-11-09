/* Pure test-set eligibility, request reasons, frequency ceilings and per-lift calibration.
 * The caller supplies the catalog lookup, the log and the clock. */
(function (root) {
  "use strict";

  const VERSION = "eligibility@077.1";
  /* The big barbell lifts are out (owner, 2026-11-05): the squat, hinge and horizontal-push families done with a free
     barbell. Smith, EZ, fixed-weight and landmine bars stay in, as do dumbbells, machines, cables and bodyweight. */
  const BIG_LIFT_PATTERNS = Object.freeze(["Squat", "Hip Hinge", "Horizontal Push"]);
  const PRESS_PATTERNS = Object.freeze(["Horizontal Push", "Vertical Push"]);
  const FREE_BARBELL = /^(barbell|axle bar|buffalo bar|cambered (bench press|squat) bar|safety squat bar|swiss bar|(open )?trap bar|marrs bar)\b/i;
  /* A custom exercise has no catalog fields to read, so its name is the only clue (Plan 077, OD-11). */
  const CUSTOM_BIG_LIFT = /\b(squat|bench|deadlift)\b|agachamento|supino|levantamento terra/i;
  const PRESS_NAME = /\bpress\b|\bpush[- ]?up\b|\bdips?\b|supino|desenvolvimento|flex(ã|a)o|paralelas/i;

  const LIMITS = Object.freeze({
    minWorkingSets: 2,
    maxRepTarget: 20,
    minGuess: 1,
    maxGuess: 30,
    perWorkout: 1,
    perExerciseDays: 14,
    perWeek: 2,
    fatigueAllowance: 1,
  });

  const names = (ids, lookup) => (Array.isArray(ids) ? ids : []).map((id) => lookup(id)?.name).filter((name) => typeof name === "string");

  /** Whether an exercise may take a max set, and whether it is a press (which adds the press safety line).
   *  `exercise` is the raw catalog entry, or null for a custom exercise (then `customName` decides). A known performed
   *  equipment (`equipmentName`) decides the barbell question on its own; otherwise any free-barbell option does. */
  function eligibility({ exercise = null, lookup = () => null, equipmentName = null, customName = "" } = {}) {
    if (!exercise) {
      const name = String(customName || "");
      return { eligible: !CUSTOM_BIG_LIFT.test(name), press: PRESS_NAME.test(name), version: VERSION };
    }
    const patterns = names(exercise.movementPattern, lookup);
    const press = patterns.some((pattern) => PRESS_PATTERNS.includes(pattern));
    const bigFamily = patterns.some((pattern) => BIG_LIFT_PATTERNS.includes(pattern));
    const barbell = typeof equipmentName === "string" && equipmentName
      ? FREE_BARBELL.test(equipmentName)
      : names(exercise.resistanceEquipmentGroupIds, lookup).some((group) => FREE_BARBELL.test(group));
    return { eligible: !(bigFamily && barbell), press, version: VERSION };
  }

  /** The guess prefilled for the max set: the set before's reps plus its reps left, less one for the extra rest and
   *  set (owner, 2026-11-05). Without a known RIR it is the reps alone. Clamped to what the stepper offers. */
  function prefillGuess(previousReps, previousRir) {
    const reps = Number(previousReps);
    if (!Number.isFinite(reps) || reps < 1) return null;
    const rir = Number(previousRir);
    const known = previousRir != null && previousRir !== "" && Number.isFinite(rir) && rir >= 0;
    const raw = known ? reps + rir - LIMITS.fatigueAllowance : reps;
    return {
      predictedReps: Math.min(LIMITS.maxGuess, Math.max(LIMITS.minGuess, Math.round(raw))),
      prefillBasis: known ? "reps_rir" : "reps",
    };
  }

  const DAY_MS = 86400000;
  const dayNumber = (value) => {
    const time = Date.parse(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isFinite(time) ? Math.floor(time / DAY_MS) : null;
  };
  /* ISO weeks start on Monday; day 0 (1970-01-01) was a Thursday. */
  const weekOf = (day) => Math.floor((day + 3) / 7);

  /** Whether the frequency limits allow a max set today (Plan 077, OD-12). `history` is the log's max-set rows as
   *  `{exerciseKey, date}`, `today` an ISO date, `exerciseKey` the lift's key, `inWorkout` how many this workout has. */
  function frequencyAllows({ history = [], today, exerciseKey, inWorkout = 0 } = {}) {
    if (inWorkout >= LIMITS.perWorkout) return { ok: false, reason: "per_workout" };
    const day = dayNumber(today);
    if (day == null) return { ok: false, reason: "no_date" };
    let week = 0;
    for (const entry of Array.isArray(history) ? history : []) {
      const at = dayNumber(entry?.date);
      if (at == null || at > day) continue;
      if (entry.exerciseKey === exerciseKey && day - at < LIMITS.perExerciseDays) return { ok: false, reason: "per_exercise" };
      if (weekOf(at) === weekOf(day)) week++;
    }
    if (week >= LIMITS.perWeek) return { ok: false, reason: "per_week" };
    return { ok: true, reason: null };
  }

  const RECHECK_DAYS = 60;

  /** A reason to request a check, separately from the safety and frequency ceilings. */
  function shouldOffer({ standing, calibration, lastCheckDays } = {}) {
    if (!standing || standing.unavailable === true) return { ok: false, reason: null };
    if (standing?.word === "learning" || calibration?.state === "uncalibrated" &&
      (calibration.n < ESTIMATOR.minChecks || calibration.reason === "inconsistent"))
      return { ok: true, reason: "learning" };
    if (standing?.word === "solid" && ["calibrated", "over", "under"].includes(calibration?.state) &&
      Number.isFinite(lastCheckDays) && lastCheckDays >= RECHECK_DAYS)
      return { ok: true, reason: "recheck" };
    return { ok: false, reason: null };
  }

  /** How a max set went: the guess, what was done, and the signed error (guess − did; positive means fewer than
   *  guessed). */
  function result(predictedReps, did) {
    const guess = Number(predictedReps), done = Number(did);
    if (did == null || did === "" || !Number.isInteger(guess) || !Number.isFinite(done) || done < 0) return null;
    return { guess, did: done, error: guess - done };
  }

  /* The per-lift estimate (Plan 077, OD-14 to OD-18), versioned apart from eligibility: the engine accepts a shift only
     from this version. */
  const CALIBRATION_VERSION = "calibration@077.1";
  const ESTIMATOR = Object.freeze({
    window: 6, // the last checks that count
    maxAgeDays: 180, // older checks drop out
    gapDays: 42, // a break this long between sessions of the lift starts its estimate again
    prior: 2, // pseudo-checks at 0 that the mean is shrunk towards
    clip: 5, // each error is held to ±5 reps
    minChecks: 3, // nothing changes before this many
    bias: 0.75, // a mean beyond this, in reps, is a tendency
    underSpread: 1.5, // under-estimating only counts when the checks agree this well
    calibratedSpread: 1.25, // "on target" needs this much agreement
    under: -1, // the shift is held within these: one rep up, two down
    over: 2,
  });

  /** The errors (guess − did) that count for a lift today, oldest first. `sessions` are the lift's comparable sessions,
   *  each `{date, checks:[{predictedReps, reps}]}`; a session without a check still marks the lift as trained. A gap of
   *  `gapDays` between consecutive sessions, or since the last one, discards everything before it (OD-16). */
  function checkErrors({ sessions = [], today } = {}) {
    const now = dayNumber(today);
    if (now == null) return [];
    const dated = (Array.isArray(sessions) ? sessions : [])
      .map((session) => ({ day: dayNumber(session?.date), checks: Array.isArray(session?.checks) ? session.checks : [] }))
      .filter((session) => session.day != null && session.day <= now)
      .sort((left, right) => left.day - right.day);
    let from = 0;
    for (let i = 1; i <= dated.length; i++) {
      const next = i < dated.length ? dated[i].day : now;
      if (next - dated[i - 1].day >= ESTIMATOR.gapDays) from = i;
    }
    const errors = [];
    for (const session of dated.slice(from)) {
      if (now - session.day > ESTIMATOR.maxAgeDays) continue;
      for (const check of session.checks) {
        const outcome = result(check?.predictedReps, check?.reps);
        if (outcome) errors.push(outcome.error);
      }
    }
    return errors.slice(-ESTIMATOR.window);
  }

  /** What a lift's checks say: their count, the shrunken mean error (positive: fewer reps than guessed), its spread, the
   *  state, and the shift the engine reads reported RIR with. Under three checks the shift is 0 whatever they say. */
  function estimate(errors) {
    const clipped = (Array.isArray(errors) ? errors : []).filter((value) => Number.isFinite(value))
      .map((value) => Math.max(-ESTIMATOR.clip, Math.min(ESTIMATOR.clip, value)));
    const n = clipped.length;
    const sum = clipped.reduce((total, value) => total + value, 0);
    const bias = n ? sum / (n + ESTIMATOR.prior) : 0;
    const mean = n ? sum / n : 0;
    const spread = n >= 2 ? Math.sqrt(clipped.reduce((total, value) => total + (value - mean) ** 2, 0) / (n - 1)) : null;
    let state = "uncalibrated", reason = n < ESTIMATOR.minChecks ? "few" : "inconsistent";
    if (n >= ESTIMATOR.minChecks) {
      if (bias >= ESTIMATOR.bias) { state = "over"; reason = null; }
      else if (bias <= -ESTIMATOR.bias && spread <= ESTIMATOR.underSpread) { state = "under"; reason = null; }
      else if (Math.abs(bias) < ESTIMATOR.bias && spread <= ESTIMATOR.calibratedSpread) { state = "calibrated"; reason = null; }
    }
    const delta = state === "over" ? Math.min(bias, ESTIMATOR.over) : state === "under" ? Math.max(bias, ESTIMATOR.under) : 0;
    return { version: CALIBRATION_VERSION, n, bias, spread, state, reason, delta };
  }

  const api = Object.freeze({ VERSION, CALIBRATION_VERSION, LIMITS, ESTIMATOR, BIG_LIFT_PATTERNS, PRESS_PATTERNS, eligibility,
    prefillGuess, frequencyAllows, shouldOffer, RECHECK_DAYS, result, checkErrors, estimate });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeEffortCalibration = api;
})(typeof window !== "undefined" ? window : globalThis);
