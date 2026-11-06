/* Effort calibration (Plan 077): which exercises can take a max set, when one is offered, what the lifter's guess is
 * prefilled with, and how a guess compares with what they did. Pure: the caller supplies the catalog lookup, the
 * log and the clock. Nothing here reaches the engine yet (Plan 077 PR 5). */
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
  function frequencyAllows({ history = [], today, exerciseKey, inWorkout = 0, gaugeFull = false } = {}) {
    if (inWorkout >= LIMITS.perWorkout) return { ok: false, reason: "per_workout" };
    const day = dayNumber(today);
    if (day == null) return { ok: false, reason: "no_date" };
    let week = 0;
    for (const entry of Array.isArray(history) ? history : []) {
      const at = dayNumber(entry?.date);
      if (at == null || at > day) continue;
      // At a gauge of 100 % (OD-20) checks keep coming, at most once a month across every exercise.
      if (gaugeFull && day - at < 30) return { ok: false, reason: "monthly" };
      if (entry.exerciseKey === exerciseKey && day - at < LIMITS.perExerciseDays) return { ok: false, reason: "per_exercise" };
      if (weekOf(at) === weekOf(day)) week++;
    }
    if (week >= LIMITS.perWeek) return { ok: false, reason: "per_week" };
    return { ok: true, reason: null };
  }

  /** How a max set went: the guess, what was done, and the signed error (guess − did; positive means fewer than
   *  guessed). */
  function result(predictedReps, did) {
    const guess = Number(predictedReps), done = Number(did);
    if (did == null || did === "" || !Number.isInteger(guess) || !Number.isFinite(done) || done < 0) return null;
    return { guess, did: done, error: guess - done };
  }

  const api = Object.freeze({ VERSION, LIMITS, BIG_LIFT_PATTERNS, PRESS_PATTERNS, eligibility, prefillGuess, frequencyAllows, result });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RepForgeEffortCalibration = api;
})(typeof window !== "undefined" ? window : globalThis);
