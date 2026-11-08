/* Declared opening-load priors (Plan 079). Pure: the caller supplies catalog lookup and available loads.
 * These draft constants are pending professional review; they never replace a history or live anchor. */
(function (root) {
  "use strict";
  const PRIORS_VERSION = "priors@079.1";
  // Columns: free barbell, Smith/fixed bar, dumbbell per hand, machine/cable.
  // Within each cell: beginner, intermediate, advanced. Null means no declared prior.
  const PRIORS = {
    Squat: [[.35,.55,.75],[.30,.50,.70],[.10,.15,.20],[.80,1.20,1.60]],
    "Hip Hinge": [[.45,.70,.95],[.40,.60,.80],[.12,.18,.25],[.30,.45,.60]],
    "Horizontal Push": [[.30,.50,.70],[.25,.45,.65],[.10,.17,.25],[.25,.40,.55]],
    "Vertical Push": [[.20,.30,.45],[.18,.28,.40],[.06,.10,.15],[.15,.25,.35]],
    "Horizontal Pull": [[.30,.45,.60],null,[.10,.17,.25],[.25,.40,.55]],
    "Vertical Pull": [null,null,null,[.35,.50,.70]],
    Accessory: [[.10,.15,.20],[.10,.15,.20],[.04,.06,.08],[.10,.15,.25]],
  };
  for (const row of Object.values(PRIORS)) {
    for (const cell of row) if (cell) Object.freeze(cell);
    Object.freeze(row);
  }
  Object.freeze(PRIORS);
  const EXPERIENCE = ["beginner", "intermediate", "advanced"];
  const positive = value => typeof value === "number" && Number.isFinite(value) && value > 0;
  const names = (ids, lookup) => (Array.isArray(ids) ? ids : []).map(id => lookup(id)?.name).filter(name => typeof name === "string");
  function equipmentClass(name) {
    if (/smith|fixed[- ]weight|^EZ bar\b/i.test(name)) return 1;
    if (/^(barbell|axle bar|buffalo bar|cambered (bench press|squat) bar|safety squat bar|swiss bar|(open )?trap bar|marrs bar)\b/i.test(name)) return 0;
    if (/^dumbbells?\b/i.test(name)) return 2;
    if (/machine|cable|pin-loaded|plate-loaded|leg press|hack squat|pec deck/i.test(name)) return 3;
    return null;
  }
  function parameters({ exercise = null, lookup = () => null, equipmentName = null, experience = "beginner", convention, grid = [] } = {}) {
    const equipment = equipmentName ? [equipmentName] : names(exercise?.resistanceEquipmentGroupIds, lookup);
    const classes = equipment.map(equipmentClass);
    const equipmentIndex = classes.length && classes.every(value => value === classes[0]) ? classes[0] : null;
    const patterns = names(exercise?.movementPattern, lookup);
    const experienceIndex = EXPERIENCE.indexOf(experience);
    const fractions = patterns.map(pattern => {
      const row = PRIORS[pattern] || (/accessory|acessory/i.test(pattern) ? PRIORS.Accessory : null);
      return equipmentIndex == null || experienceIndex < 0 ? null : row?.[equipmentIndex]?.[experienceIndex];
    }).filter(positive);
    const fraction = fractions.length ? Math.min(...fractions) : null;
    // The supplied grid starts at this equipment's lightest load. Free bars additionally require 20 kg.
    const floor = equipmentIndex === 0 ? 20 : 0;
    const loads = Array.isArray(grid) ? [...new Set(grid.filter(value => positive(value) && value >= floor))].sort((a, b) => a - b) : [];
    const excluded = convention === "bodyweight" || convention === "assistance" || convention === "configuration_required";
    return { fraction, loads: excluded ? [] : loads };
  }
  function roundedLoad(raw, loads) {
    if (!loads.length) return null;
    let result = loads[0];
    for (const load of loads) {
      if (load > raw) break;
      result = load;
    }
    return result;
  }
  /** Raw catalog references resolve through `lookup(id)`, as in effort-calibration.js.
   * `grid` contains available displayed kilograms, per hand when convention is per_side.
   * No supported prior/bodyweight: use the equipment floor. No legal load: return null. */
  function openingLoad(options = {}) {
    const { fraction, loads } = parameters(options);
    const prior = fraction != null && positive(options.bodyweightKg);
    if (!loads.length) return { loadKg: null, basis: "floor" };
    return { loadKg: roundedLoad(prior ? fraction * options.bodyweightKg : 0, loads), basis: prior ? "prior" : "floor" };
  }
  /** Easy credits three reps left. Round the solved capacity down, but advance at least one available step.
   * Null means no higher available load (or invalid input); the caller must not invent a load. */
  function nextRampLoad({ loadKg, reps, targetRir, grid = [] } = {}) {
    if (!positive(loadKg) || !positive(reps) || typeof targetRir !== "number" || !Number.isFinite(targetRir) || targetRir < 0) return null;
    const loads = Array.isArray(grid) ? [...new Set(grid.filter(value => positive(value) && value > loadKg))].sort((a, b) => a - b) : [];
    const next = loadKg * (1 + (reps + 3) / 30) / (1 + (reps + targetRir) / 30);
    return roundedLoad(next, loads);
  }
  /** `from` and `to` take openingLoad options. Ratios use unrounded fractions, not rounded opening loads.
   * A usable history anchor needs no bodyweight; without both priors, use the destination's plain opening. */
  function ratioLoad({ anchorLoadKg, from = {}, to = {} } = {}) {
    const old = parameters(from), next = parameters(to);
    if (!positive(anchorLoadKg) || old.fraction == null || next.fraction == null || !old.loads.length || !next.loads.length) return openingLoad(to);
    return { loadKg: roundedLoad(anchorLoadKg * next.fraction / old.fraction, next.loads), basis: "ratio" };
  }
  const api = Object.freeze({ PRIORS_VERSION, PRIORS, openingLoad, nextRampLoad, ratioLoad });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeStartingLoads = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
