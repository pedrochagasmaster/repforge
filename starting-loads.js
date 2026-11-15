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
  function equipmentClass(equipment, lookup, smithBar) {
    const name = typeof equipment === "string" ? equipment : equipment?.name || "";
    const category = typeof equipment === "object" ? lookup(equipment?.category)?.name : null;
    if (/smith/i.test(name) && /functional trainer/i.test(name)) return smithBar ? 1 : 3;
    if (/smith|fixed[- ]weight|^EZ bar\b/i.test(name) || category === "Fixed Weight Bars") return 1;
    if (/^(barbell|axle bar|buffalo bar|cambered (bench press|squat) bar|safety squat bar|swiss bar|(open )?trap bar|marrs bar)\b/i.test(name)) return 0;
    if (/^(plate-loaded adjustable )?dumbbells?\b/i.test(name)) return 2;
    if (["Cable Machines", "Plate Loaded Machines", "Pin Loaded Machines"].includes(category)) return 3;
    if (/machine|cable|pin-loaded|plate-loaded|leg press|hack squat|pec deck/i.test(name)) return 3;
    return null;
  }
  /* The dumbbells a gym stocks, per hand (owner rule, 2026-11-13): 1 kg steps to 10 kg, then 2 kg steps, to 60 kg.
   * Every dumbbell load the app suggests or offers comes from this ladder: the engine's available loads (so its
   * calibration bounds step along it too), the opening loads, the Focus wheel and the ± steppers. */
  const DUMBBELL_MAX_KG = 60;
  const DUMBBELL_LADDER_KG = Object.freeze([
    ...Array.from({ length: 10 }, (_, i) => i + 1),
    ...Array.from({ length: (DUMBBELL_MAX_KG - 10) / 2 }, (_, i) => 12 + i * 2),
  ]);
  // In pounds (an owner question, not yet decided): 5 lb steps from 5 to 130 lb, held in kg so the engine reads one unit.
  const KG_PER_LB = 0.45359237;
  const DUMBBELL_LADDER_LB_KG = Object.freeze(Array.from({ length: 26 }, (_, i) => Math.round((i + 1) * 5 * KG_PER_LB * 1e6) / 1e6));
  const dumbbellLoadsKg = unit => (unit === "lb" ? DUMBBELL_LADDER_LB_KG : DUMBBELL_LADDER_KG);
  /** Whether a movement is loaded with dumbbells: its chosen equipment, else every equipment it offers. */
  function isDumbbell({ exercise = null, lookup = () => null, equipmentName = null } = {}) {
    return parameters({ exercise, lookup, equipmentName, convention: "external" }).equipmentIndex === 2;
  }
  function parameters({ exercise = null, lookup = () => null, equipmentName = null, experience = "beginner", convention, grid = [] } = {}) {
    const options = (exercise?.resistanceEquipmentGroupIds || []).map(id => lookup(id)).filter(Boolean);
    const equipment = equipmentName ? [options.find(entry => entry.name === equipmentName) || equipmentName] : options;
    // Smith-bar movements also offer a dedicated Smith bar; cable movements offer cable equipment.
    const smithBar = options.some(entry => entry.name === "Smith machine and weight plates");
    const classes = equipment.map(entry => equipmentClass(entry, lookup, smithBar));
    const equipmentIndex = classes.length && classes.every(value => value === classes[0]) ? classes[0] : null;
    const patterns = names(exercise?.movementPattern, lookup);
    const experienceIndex = EXPERIENCE.indexOf(experience);
    // Keep the row that supplies the minimum: a shared secondary pattern is not a transfer basis.
    let fraction = null, priorRow = null;
    for (const pattern of patterns) {
      const key = PRIORS[pattern] ? pattern : /accessory|acessory/i.test(pattern) ? "Accessory" : null;
      const value = equipmentIndex == null || experienceIndex < 0 ? null : PRIORS[key]?.[equipmentIndex]?.[experienceIndex];
      if (positive(value) && (fraction == null || value < fraction || value === fraction && key < priorRow)) {
        fraction = value;
        priorRow = key;
      }
    }
    // The supplied grid starts at this equipment's lightest load. Free bars additionally require 20 kg.
    const floor = equipmentIndex === 0 ? 20 : 0;
    const loads = Array.isArray(grid) ? [...new Set(grid.filter(value => positive(value) && value >= floor))].sort((a, b) => a - b) : [];
    const excluded = convention === "bodyweight" || convention === "assistance" || convention === "configuration_required";
    return { fraction: excluded ? null : fraction, priorRow, equipmentIndex, loads: excluded ? [] : loads };
  }
  function roundedLoad(raw, loads) {
    if (!loads.length) return null;
    let result = loads[0];
    for (const load of loads) {
      if (load - raw > Number.EPSILON * Math.max(1, Math.abs(raw), load) * 4) break;
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
  /** Carry a working anchor only within the same equipment class and the same minimum-prior row.
   * The fractions must agree; a destination floor above the anchor falls back to its plain opening. */
  function ratioLoad({ anchorLoadKg, from = {}, to = {} } = {}) {
    const old = parameters(from), next = parameters(to);
    if (!positive(anchorLoadKg) || old.fraction == null || next.fraction == null ||
        from.convention !== to.convention || old.equipmentIndex !== next.equipmentIndex || old.priorRow !== next.priorRow ||
        old.fraction !== next.fraction || !next.loads.length || next.loads[0] > anchorLoadKg) return openingLoad(to);
    return { loadKg: roundedLoad(anchorLoadKg, next.loads.filter(load => load <= anchorLoadKg)), basis: "ratio" };
  }
  const api = Object.freeze({ PRIORS_VERSION, PRIORS, openingLoad, nextRampLoad, ratioLoad,
    DUMBBELL_LADDER_KG, DUMBBELL_MAX_KG, dumbbellLoadsKg, isDumbbell });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeStartingLoads = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
