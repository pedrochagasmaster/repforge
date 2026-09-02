(function (root) {
  "use strict";

  const VERSIONS = Object.freeze({
    schema: 1,
    blueprint: 1,
    compiler: 2,
    catalogue: 1,
    rules: 1,
    context: 2,
    recentConsistency: 1,
    simpleStart: 1,
  });
  const FREQUENCIES = Object.freeze([2, 3, 4, 5, 6]);
  const FAMILY_IDS = Object.freeze(["growth", "balanced", "strength", "home"]);
  // Foundation leans toward the conservative (more-reps-in-reserve) end of an
  // authored RIR range. This is a preference intersected with the authored
  // bounds, never an independent Foundation RIR target: it can only raise the
  // authored floor, never past the authored ceiling, and never widens a range.
  const FOUNDATION_CONSERVATIVE_RIR = 2;
  const STRATEGIES = Object.freeze([
    "range@1", "rep_goal@1", "effort_target@1", "anchor_backoff@1", "manual@1",
  ]);
  const OWN = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
  const token = (value) => String(value || "").trim().toLowerCase()
    .replace(/mid\/upper back|upper back|middle back/g, "back")
    .replace(/front delts?/g, "front_delts")
    .replace(/side delts?/g, "side_delts")
    .replace(/rear delts?/g, "rear_delts")
    .replace(/spinal erectors?/g, "spinal_erectors")
    .replace(/quadriceps/g, "quads")
    .replace(/\b(abs?|obliques?)\b/g, "core")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const words = (value) => String(value || "").split(",").map(token).filter(Boolean);
  const unique = (values) => [...new Set(values)];
  const intersects = (left, right) => left.some((value) => right.includes(value));
  const strategyParts = (value) => {
    const match = /^([a-z_]+)@(\d+)$/.exec(value || "");
    return match ? { id: match[1], version: Number(match[2]) } : null;
  };
  const slot = (template, overrides = {}) => Object.freeze({ template, ...overrides });
  const day = (label, slots) => Object.freeze({ label, slots: Object.freeze(slots) });
  const blueprint = (familyId, frequency, days, relations = []) => Object.freeze({
    id: `${familyId}_${frequency}_v1`, familyId, frequency, version: 1, kind: "authored_sibling",
    days: Object.freeze(days), relations: Object.freeze(relations),
    release: Object.freeze({ browse: true, complete: true, executable: true, tested: true }),
  });

  const FAMILIES = Object.freeze([
    Object.freeze({ id: "growth", version: 1, publicGoal: "build_muscle", name: "Build Muscle", namePt: "Ganhar massa", limitedEquipment: false }),
    Object.freeze({ id: "balanced", version: 1, publicGoal: "muscle_strength", name: "Muscle + Strength", namePt: "Massa + força", limitedEquipment: false }),
    Object.freeze({ id: "strength", version: 1, publicGoal: "strength_priority", name: "Strength Priority", namePt: "Prioridade em força", limitedEquipment: false }),
    Object.freeze({ id: "home", version: 1, publicGoal: null, name: "Train Anywhere", namePt: "Treine em qualquer lugar", limitedEquipment: true }),
  ]);

  const baseContract = Object.freeze({
    requiredCapabilities: Object.freeze([]),
    requiredCharacteristics: Object.freeze({}),
    preferredCharacteristics: Object.freeze({}),
    status: "reducible",
    priorityBehavior: "preserve_coverage",
    warmupClass: "compound",
    restClass: "compound",
    transitionClass: "new_station",
    timeClass: "standard",
    efficientEligible: true,
  });
  const contract = (value) => Object.freeze({ ...baseContract, ...value });
  const SLOT_TEMPLATES = Object.freeze({
    knee_growth: contract({ role: "hypertrophy_compound", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"], status: "protected" }),
    hinge_growth: contract({ role: "hypertrophy_compound", patterns: ["hinge", "leg_curl", "squat"], primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: [], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"], status: "protected" }),
    knee_anchor: contract({ role: "heavy_primary", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], prescriptionClasses: ["heavy_3_6"], strategies: ["anchor_backoff@1"], requiredCharacteristics: { loading: ["known_grid"], primarySuitability: ["high"] }, status: "protected", warmupClass: "primary", restClass: "primary", efficientEligible: false }),
    press_anchor: contract({ role: "heavy_primary", patterns: ["press"], primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], prescriptionClasses: ["heavy_3_6"], strategies: ["anchor_backoff@1"], requiredCharacteristics: { loading: ["known_grid"], primarySuitability: ["high"] }, status: "protected", warmupClass: "primary", restClass: "primary", efficientEligible: false }),
    knee_effort: contract({ role: "heavy_primary", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], prescriptionClasses: ["heavy_3_6"], strategies: ["effort_target@1", "range@1"], requiredCharacteristics: { loading: ["known_grid"], primarySuitability: ["high"] }, status: "protected", warmupClass: "primary", restClass: "primary", efficientEligible: false }),
    press_effort: contract({ role: "heavy_primary", patterns: ["press"], primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], prescriptionClasses: ["heavy_3_6"], strategies: ["effort_target@1", "range@1"], requiredCharacteristics: { loading: ["known_grid"], primarySuitability: ["high"] }, status: "protected", warmupClass: "primary", restClass: "primary", efficientEligible: false }),
    hinge_effort: contract({ role: "heavy_primary", patterns: ["hinge"], primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: [], prescriptionClasses: ["heavy_3_6"], strategies: ["effort_target@1", "range@1"], requiredCharacteristics: { loading: ["known_grid"], primarySuitability: ["high"] }, status: "protected", warmupClass: "primary", restClass: "primary", efficientEligible: false }),
    knee_volume: contract({ role: "volume_counterpart", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["rep_goal@1", "range@1"], status: "protected" }),
    press_volume: contract({ role: "volume_counterpart", patterns: ["press"], primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["rep_goal@1", "range@1"], status: "protected" }),
    hinge_volume: contract({ role: "volume_counterpart", patterns: ["hinge"], primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: [], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["rep_goal@1", "range@1"], status: "protected" }),
    horizontal_press: contract({ role: "hypertrophy_compound", patterns: ["press"], primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    incline_press: contract({ role: "hypertrophy_compound", patterns: ["incline_press", "press"], primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "front_delts"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    vertical_press: contract({ role: "hypertrophy_compound", patterns: ["shoulder_press"], primaryMuscles: ["front_delts"], secondaryMuscles: ["triceps"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    horizontal_pull: contract({ role: "hypertrophy_compound", patterns: ["row"], primaryMuscles: ["back"], secondaryMuscles: ["biceps"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    supported_pull: contract({ role: "hypertrophy_compound", patterns: ["row"], primaryMuscles: ["back"], secondaryMuscles: ["biceps"], prescriptionClasses: ["compound_8_12", "compound_4_8"], strategies: ["range@1"], preferredCharacteristics: { stability: ["high"] } }),
    vertical_pull: contract({ role: "hypertrophy_compound", patterns: ["pulldown"], primaryMuscles: ["lats"], secondaryMuscles: ["biceps"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    pull_mixed: contract({ role: "hypertrophy_compound", patterns: ["row", "pulldown"], primaryMuscles: ["back", "lats"], secondaryMuscles: ["biceps"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    vertical_press_or_pull: contract({ role: "hypertrophy_compound", patterns: ["shoulder_press", "pulldown"], primaryMuscles: ["front_delts", "lats"], secondaryMuscles: ["triceps", "biceps"], prescriptionClasses: ["compound_4_8", "compound_8_12"], strategies: ["range@1"] }),
    unilateral_knee: contract({ role: "hypertrophy_compound", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], prescriptionClasses: ["compound_8_12", "compound_4_8"], strategies: ["range@1"], preferredCharacteristics: { unilateral: [true] } }),
    quad_assistance: contract({ role: "isolation_accessory", patterns: ["leg_extension", "squat"], primaryMuscles: ["quads"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15", "compound_8_12"], strategies: ["range@1", "rep_goal@1"] }),
    hamstring_assistance: contract({ role: "isolation_accessory", patterns: ["leg_curl", "hinge", "squat"], primaryMuscles: ["hamstrings"], secondaryMuscles: ["glutes"], prescriptionClasses: ["isolation_8_15", "compound_8_12"], strategies: ["range@1", "rep_goal@1"] }),
    hip_extension: contract({ role: "hypertrophy_compound", patterns: ["hinge", "squat"], primaryMuscles: ["glutes", "hamstrings"], secondaryMuscles: [], prescriptionClasses: ["compound_8_12", "compound_4_8"], strategies: ["range@1"] }),
    chest: contract({ role: "isolation_accessory", patterns: ["chest_iso", "press", "incline_press"], primaryMuscles: ["chest"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15", "compound_8_12"], strategies: ["rep_goal@1", "range@1"] }),
    back: contract({ role: "isolation_accessory", patterns: ["row", "pulldown", "pull"], primaryMuscles: ["back", "lats"], secondaryMuscles: ["biceps"], prescriptionClasses: ["isolation_8_15", "compound_8_12"], strategies: ["rep_goal@1", "range@1"] }),
    lateral_delt: contract({ role: "isolation_accessory", patterns: ["lateral_raise", "delts"], primaryMuscles: ["side_delts"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    rear_delt: contract({ role: "isolation_accessory", patterns: ["rear_delt", "row"], primaryMuscles: ["rear_delts"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    delt_mixed: contract({ role: "isolation_accessory", patterns: ["lateral_raise", "rear_delt", "delts"], primaryMuscles: ["side_delts", "rear_delts"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    biceps: contract({ role: "isolation_accessory", patterns: ["curl", "arms"], primaryMuscles: ["biceps"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    triceps: contract({ role: "isolation_accessory", patterns: ["triceps", "arms"], primaryMuscles: ["triceps"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    arms: contract({ role: "isolation_accessory", patterns: ["curl", "triceps", "arms"], primaryMuscles: ["biceps", "triceps"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    calf: contract({ role: "isolation_accessory", patterns: ["calves"], primaryMuscles: ["calves"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["rep_goal@1", "range@1"], transitionClass: "same_station" }),
    trunk: contract({ role: "isolation_accessory", patterns: ["abs", "core"], primaryMuscles: ["core"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["range@1"], transitionClass: "same_station" }),
    priority: contract({ role: "isolation_accessory", patterns: ["leg_extension", "leg_curl", "chest_iso", "row", "pulldown", "lateral_raise", "rear_delt", "curl", "triceps", "calves"], primaryMuscles: ["quads", "hamstrings", "chest", "back", "lats", "side_delts", "rear_delts", "biceps", "triceps", "calves"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15", "compound_8_12"], strategies: ["range@1", "rep_goal@1"], status: "optional", priorityBehavior: "priority_only", transitionClass: "same_station" }),
    optional_arms: contract({ role: "isolation_accessory", patterns: ["curl", "triceps", "arms", "calves", "lateral_raise"], primaryMuscles: ["biceps", "triceps", "calves", "side_delts"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["range@1", "rep_goal@1"], status: "optional", transitionClass: "same_station" }),
    home_knee: contract({ role: "hypertrophy_compound", patterns: ["squat"], primaryMuscles: ["quads"], secondaryMuscles: ["glutes", "hamstrings"], prescriptionClasses: ["compound_8_12"], strategies: ["range@1"], status: "protected", warmupClass: "assistance", transitionClass: "home_change", preferredCharacteristics: { stability: ["high", "moderate"] } }),
    home_push: contract({ role: "hypertrophy_compound", patterns: ["press", "incline_press", "triceps"], primaryMuscles: ["chest", "triceps"], secondaryMuscles: ["front_delts"], prescriptionClasses: ["compound_8_12", "isolation_8_15"], strategies: ["range@1"], status: "protected", warmupClass: "assistance", transitionClass: "home_change" }),
    home_posterior: contract({ role: "hypertrophy_compound", patterns: ["hinge", "leg_curl", "squat"], primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: [], prescriptionClasses: ["compound_8_12", "isolation_8_15"], strategies: ["range@1"], status: "protected", warmupClass: "assistance", transitionClass: "home_change" }),
    home_pull: contract({ role: "hypertrophy_compound", patterns: ["row", "pulldown"], primaryMuscles: ["back", "lats"], secondaryMuscles: ["biceps"], prescriptionClasses: ["compound_8_12"], strategies: ["range@1"], status: "conditional", priorityBehavior: "protect_when_capable", warmupClass: "assistance", transitionClass: "home_change" }),
    home_lateral: contract({ role: "isolation_accessory", patterns: ["lateral_raise", "delts"], primaryMuscles: ["side_delts"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["range@1"], status: "conditional", requiredCapabilities: ["external_resistance"], warmupClass: "assistance", transitionClass: "home_change" }),
    home_calf: contract({ role: "isolation_accessory", patterns: ["calves"], primaryMuscles: ["calves"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["range@1"], transitionClass: "home_change" }),
    home_trunk: contract({ role: "isolation_accessory", patterns: ["abs", "core"], primaryMuscles: ["core"], secondaryMuscles: [], prescriptionClasses: ["isolation_8_15"], strategies: ["range@1"], transitionClass: "home_change" }),
    home_coverage: contract({ role: "hypertrophy_compound", patterns: ["squat", "hinge", "press", "row", "pulldown", "abs", "calves"], primaryMuscles: ["quads", "hamstrings", "glutes", "chest", "back", "lats", "core", "calves"], secondaryMuscles: [], prescriptionClasses: ["compound_8_12", "isolation_8_15"], strategies: ["range@1"], status: "reducible", transitionClass: "home_change" }),
  });
  const MUSCLE_IDS = Object.freeze(unique(Object.values(SLOT_TEMPLATES)
    .flatMap((value) => [...value.primaryMuscles, ...value.secondaryMuscles])).sort());
  const MOVEMENT_PATTERN_IDS = Object.freeze(unique(Object.values(SLOT_TEMPLATES)
    .flatMap((value) => value.patterns)).sort());
  const PREFERRED_REST_SECONDS = Object.freeze([60, 90, 120, 180]);
  const MAX_PRIMARY_MUSCLES = 2;
  const MAX_MUSCLE_CONTROLS = 10;
  const MAX_PRIORITY_MOVEMENTS = 2;

  const pair = (id, heavy, volume) => Object.freeze({ id, heavy, volume });
  const BLUEPRINTS = Object.freeze([
    blueprint("growth", 2, [
      day("Knee / horizontal", [slot("knee_growth"), slot("horizontal_press"), slot("horizontal_pull"), slot("hamstring_assistance"), slot("lateral_delt"), slot("optional_arms")]),
      day("Hip / mixed", [slot("hinge_growth"), slot("vertical_pull"), slot("incline_press"), slot("quad_assistance"), slot("delt_mixed"), slot("optional_arms")]),
    ]),
    blueprint("growth", 3, [
      day("Knee / horizontal", [slot("knee_growth"), slot("horizontal_press"), slot("horizontal_pull"), slot("hamstring_assistance"), slot("lateral_delt"), slot("optional_arms")]),
      day("Hip / vertical", [slot("hinge_growth"), slot("vertical_pull"), slot("vertical_press"), slot("quad_assistance"), slot("chest"), slot("calf", { status: "optional" })]),
      day("Mixed", [slot("unilateral_knee"), slot("incline_press"), slot("supported_pull"), slot("hip_extension"), slot("delt_mixed"), slot("optional_arms")]),
    ]),
    blueprint("growth", 4, [
      day("Upper A", [slot("horizontal_press"), slot("horizontal_pull"), slot("vertical_pull"), slot("chest"), slot("lateral_delt"), slot("triceps")]),
      day("Lower A", [slot("knee_growth"), slot("hinge_growth"), slot("unilateral_knee"), slot("hamstring_assistance"), slot("calf")]),
      day("Upper B", [slot("incline_press"), slot("horizontal_pull"), slot("vertical_press"), slot("vertical_pull"), slot("delt_mixed"), slot("biceps")]),
      day("Lower B", [slot("hinge_growth"), slot("knee_growth"), slot("hip_extension"), slot("hamstring_assistance"), slot("calf")]),
    ]),
    blueprint("growth", 5, [
      day("Upper A", [slot("horizontal_press"), slot("vertical_pull"), slot("incline_press"), slot("horizontal_pull"), slot("lateral_delt"), slot("triceps")]),
      day("Lower A", [slot("knee_growth"), slot("hinge_growth"), slot("unilateral_knee"), slot("hamstring_assistance"), slot("calf")]),
      day("Upper B", [slot("horizontal_pull"), slot("vertical_press"), slot("vertical_pull"), slot("chest"), slot("delt_mixed"), slot("biceps")]),
      day("Lower B", [slot("hinge_growth"), slot("knee_growth"), slot("hip_extension"), slot("hamstring_assistance"), slot("calf")]),
      day("Mixed / priority", [slot("chest"), slot("back"), slot("quad_assistance"), slot("hamstring_assistance"), slot("priority"), slot("optional_arms")]),
    ]),
    blueprint("growth", 6, [
      day("Upper horizontal", [slot("horizontal_press", { efficient: true }), slot("horizontal_pull", { efficient: true }), slot("chest", { efficient: true }), slot("lateral_delt", { efficient: true })]),
      day("Lower knee", [slot("knee_growth", { efficient: true }), slot("hamstring_assistance", { efficient: true }), slot("unilateral_knee", { efficient: true }), slot("calf", { efficient: true })]),
      day("Upper vertical", [slot("vertical_pull", { efficient: true }), slot("vertical_press", { efficient: true }), slot("supported_pull", { efficient: true }), slot("arms", { efficient: true })]),
      day("Lower hip", [slot("hinge_growth", { efficient: true }), slot("quad_assistance", { efficient: true }), slot("hip_extension", { efficient: true }), slot("hamstring_assistance", { efficient: true })]),
      day("Upper mixed / priority", [slot("chest", { efficient: true }), slot("back", { efficient: true }), slot("delt_mixed", { efficient: true }), slot("priority", { efficient: true })]),
      day("Lower mixed / priority", [slot("quad_assistance", { efficient: true }), slot("hamstring_assistance", { efficient: true }), slot("unilateral_knee", { efficient: true }), slot("calf", { efficient: true, priorityAlternative: true })]),
    ]),
    blueprint("balanced", 2, [
      day("Knee", [slot("knee_anchor"), slot("horizontal_press"), slot("horizontal_pull"), slot("hamstring_assistance"), slot("optional_arms")]),
      day("Press / hip", [slot("press_anchor"), slot("hinge_growth"), slot("vertical_pull"), slot("knee_volume"), slot("back")]),
    ]),
    blueprint("balanced", 3, [
      day("Knee / press primary", [slot("knee_anchor"), slot("press_anchor"), slot("horizontal_pull"), slot("hamstring_assistance"), slot("lateral_delt")]),
      day("Hip", [slot("hinge_growth"), slot("vertical_pull"), slot("vertical_press"), slot("unilateral_knee"), slot("arms")]),
      day("Volume", [slot("knee_volume"), slot("press_volume"), slot("horizontal_pull"), slot("hip_extension"), slot("back")]),
    ], [pair("balanced_3_knee", [0, 0], [2, 0]), pair("balanced_3_press", [0, 1], [2, 1])]),
    blueprint("balanced", 4, [
      day("Lower primary", [slot("knee_anchor"), slot("hinge_growth"), slot("unilateral_knee"), slot("calf")]),
      day("Upper primary", [slot("press_anchor"), slot("vertical_pull"), slot("horizontal_pull"), slot("triceps")]),
      day("Lower volume", [slot("hinge_growth"), slot("knee_volume"), slot("hamstring_assistance"), slot("hip_extension", { calfAlternative: true })]),
      day("Upper volume", [slot("press_volume"), slot("horizontal_pull"), slot("vertical_press_or_pull"), slot("delt_mixed")]),
    ], [pair("balanced_4_knee", [0, 0], [2, 1]), pair("balanced_4_press", [1, 0], [3, 0])]),
    blueprint("balanced", 5, [
      day("Lower primary", [slot("knee_anchor"), slot("hinge_growth"), slot("unilateral_knee"), slot("calf")]),
      day("Upper primary", [slot("press_anchor"), slot("vertical_pull"), slot("supported_pull"), slot("triceps")]),
      day("Hypertrophy", [slot("hip_extension"), slot("chest"), slot("pull_mixed"), slot("lateral_delt"), slot("rear_delt", { bicepsAlternative: true })]),
      day("Lower volume", [slot("hinge_growth"), slot("knee_volume"), slot("hamstring_assistance"), slot("calf")]),
      day("Upper volume", [slot("press_volume"), slot("vertical_pull"), slot("vertical_press"), slot("supported_pull"), slot("arms")]),
    ], [pair("balanced_5_knee", [0, 0], [3, 1]), pair("balanced_5_press", [1, 0], [4, 0])]),
    blueprint("balanced", 6, [
      day("Knee primary", [slot("knee_anchor"), slot("hamstring_assistance", { efficient: true }), slot("unilateral_knee", { efficient: true }), slot("calf", { efficient: true })]),
      day("Upper primary", [slot("press_anchor"), slot("vertical_pull", { efficient: true }), slot("supported_pull", { efficient: true }), slot("triceps", { efficient: true })]),
      day("Hypertrophy A", [slot("hip_extension", { efficient: true }), slot("chest", { efficient: true }), slot("back", { efficient: true }), slot("lateral_delt", { efficient: true })]),
      day("Lower volume", [slot("hinge_growth", { efficient: true }), slot("knee_volume", { efficient: true }), slot("hamstring_assistance", { efficient: true }), slot("calf", { efficient: true })]),
      day("Upper volume", [slot("press_volume", { efficient: true }), slot("vertical_press_or_pull", { efficient: true }), slot("horizontal_pull", { efficient: true }), slot("biceps", { efficient: true })]),
      day("Hypertrophy B / priority", [slot("quad_assistance", { efficient: true, hamstringAlternative: true }), slot("chest", { efficient: true }), slot("back", { efficient: true }), slot("priority", { efficient: true })]),
    ], [pair("balanced_6_knee", [0, 0], [3, 1]), pair("balanced_6_press", [1, 0], [4, 0])]),
    blueprint("strength", 2, [
      day("Knee focus", [slot("knee_effort"), slot("press_volume"), slot("pull_mixed"), slot("hip_extension"), slot("optional_arms")]),
      day("Press + hinge", [slot("press_effort"), slot("hinge_effort"), slot("knee_volume"), slot("pull_mixed"), slot("optional_arms")]),
    ]),
    blueprint("strength", 3, [
      day("Knee", [slot("knee_effort"), slot("press_volume"), slot("horizontal_pull"), slot("hamstring_assistance"), slot("optional_arms")]),
      day("Press", [slot("press_effort"), slot("hinge_volume"), slot("vertical_pull"), slot("unilateral_knee"), slot("optional_arms")]),
      day("Hinge", [slot("hinge_effort"), slot("knee_volume"), slot("vertical_press"), slot("horizontal_pull"), slot("optional_arms")]),
    ]),
    blueprint("strength", 4, [
      day("Lower heavy", [slot("knee_effort"), slot("hip_extension"), slot("unilateral_knee"), slot("hamstring_assistance", { trunkAlternative: true })]),
      day("Upper heavy", [slot("press_effort"), slot("vertical_pull"), slot("horizontal_pull"), slot("triceps")]),
      day("Lower practice", [slot("hinge_effort"), slot("knee_volume"), slot("hamstring_assistance"), slot("calf", { trunkAlternative: true })]),
      day("Upper practice", [slot("press_volume"), slot("vertical_press"), slot("pull_mixed"), slot("biceps", { rearDeltAlternative: true })]),
    ]),
    blueprint("strength", 5, [
      day("Knee primary", [slot("knee_effort"), slot("hip_extension"), slot("unilateral_knee"), slot("hamstring_assistance", { trunkAlternative: true })]),
      day("Press primary", [slot("press_effort"), slot("vertical_pull"), slot("horizontal_pull"), slot("triceps")]),
      day("Hinge primary", [slot("hinge_effort"), slot("knee_volume"), slot("hamstring_assistance"), slot("calf", { trunkAlternative: true })]),
      day("Upper practice", [slot("press_volume"), slot("vertical_press"), slot("horizontal_pull"), slot("biceps", { rearDeltAlternative: true })]),
      day("Hypertrophy base", [slot("unilateral_knee"), slot("hip_extension"), slot("chest"), slot("back"), slot("lateral_delt"), slot("optional_arms")]),
    ]),
    blueprint("strength", 6, [
      day("Knee primary", [slot("knee_effort"), slot("hip_extension", { efficient: true }), slot("unilateral_knee", { efficient: true }), slot("trunk", { efficient: true })]),
      day("Press primary", [slot("press_effort"), slot("vertical_pull", { efficient: true }), slot("supported_pull", { efficient: true }), slot("triceps", { efficient: true })]),
      day("Hinge primary", [slot("hinge_effort"), slot("quad_assistance", { efficient: true }), slot("hamstring_assistance", { efficient: true }), slot("calf", { efficient: true })]),
      day("Lower practice", [slot("knee_volume", { efficient: true }), slot("hinge_volume", { efficient: true }), slot("unilateral_knee", { efficient: true }), slot("trunk", { efficient: true })]),
      day("Upper practice", [slot("press_volume", { efficient: true }), slot("vertical_press", { efficient: true }), slot("horizontal_pull", { efficient: true }), slot("biceps", { efficient: true })]),
      day("Hypertrophy base", [slot("quad_assistance", { efficient: true, hipAlternative: true }), slot("chest", { efficient: true }), slot("back", { efficient: true }), slot("lateral_delt", { efficient: true }), slot("optional_arms", { efficient: true })]),
    ]),
    blueprint("home", 2, [
      day("Full body A", [slot("home_knee"), slot("home_push"), slot("unilateral_knee"), slot("home_posterior"), slot("home_trunk"), slot("home_pull")]),
      day("Full body B", [slot("unilateral_knee"), slot("home_push"), slot("home_posterior"), slot("home_calf"), slot("home_trunk"), slot("home_pull")]),
    ]),
    blueprint("home", 3, [
      day("Knee / push", [slot("home_knee"), slot("home_push"), slot("unilateral_knee"), slot("home_posterior"), slot("home_trunk")]),
      day("Unilateral / alternate push", [slot("unilateral_knee"), slot("home_push"), slot("home_posterior"), slot("home_pull"), slot("home_lateral")]),
      day("Mixed", [slot("home_knee"), slot("home_push"), slot("home_posterior"), slot("home_pull"), slot("home_calf", { trunkAlternative: true })]),
    ]),
    blueprint("home", 4, [
      day("Knee + push", [slot("home_knee"), slot("home_push"), slot("unilateral_knee"), slot("home_trunk")]),
      day("Hip + pull-capable", [slot("home_posterior"), slot("home_pull"), slot("unilateral_knee"), slot("home_calf")]),
      day("Unilateral + push", [slot("unilateral_knee"), slot("home_push"), slot("home_posterior"), slot("home_trunk")]),
      day("Mixed", [slot("home_coverage"), slot("home_pull"), slot("home_posterior"), slot("home_coverage")]),
    ]),
    blueprint("home", 5, [
      day("Knee + push + trunk", [slot("home_knee"), slot("home_push"), slot("home_trunk")]),
      day("Hip + available pull", [slot("home_posterior"), slot("home_pull")]),
      day("Unilateral + push", [slot("unilateral_knee"), slot("home_push")]),
      day("Posterior + available pull + trunk", [slot("home_posterior"), slot("home_pull"), slot("home_trunk")]),
      day("Mixed coverage", [slot("home_coverage"), slot("home_coverage"), slot("home_coverage")]),
    ]),
    blueprint("home", 6, [
      day("Knee + push + trunk", [slot("home_knee", { efficient: true }), slot("home_push", { efficient: true }), slot("home_trunk", { efficient: true })]),
      day("Hip + pull-capability", [slot("home_posterior", { efficient: true }), slot("home_pull", { efficient: true }), slot("home_coverage", { efficient: true })]),
      day("Unilateral + push", [slot("unilateral_knee", { efficient: true }), slot("home_push", { efficient: true }), slot("home_trunk", { efficient: true })]),
      day("Posterior + pull-capability", [slot("home_posterior", { efficient: true }), slot("home_pull", { efficient: true }), slot("home_coverage", { efficient: true })]),
      day("Knee / hip + trunk", [slot("home_coverage", { efficient: true }), slot("home_posterior", { efficient: true }), slot("home_trunk", { efficient: true })]),
      day("Mixed coverage", [slot("home_coverage", { efficient: true }), slot("home_coverage", { efficient: true }), slot("home_coverage", { efficient: true })]),
    ]),
  ]);
  const BLUEPRINT_BY_ID = new Map(BLUEPRINTS.map((item) => [item.id, item]));

  // A blueprint's day label is a compiler contract. It describes how slots are
  // assembled and remains deliberately stable for persisted programs and
  // fixtures. Human-facing copy has a separate key derived from the stable
  // blueprint day id, so changing language never requires changing a row's
  // grouping label.
  const dayIdFor = (blueprintId, dayIndex) =>
    `${String(blueprintId).replace(/_v1$/, "")}_d${dayIndex + 1}`;
  const DAY_DISPLAY_NAME_KEYS = Object.freeze(Object.fromEntries(
    BLUEPRINTS.flatMap((item) => item.days.map((_, dayIndex) => {
      const dayId = dayIdFor(item.id, dayIndex);
      return [dayId, `program.day.${dayId}`];
    })),
  ));
  const DAY_CONTRACT_LABELS = Object.freeze(Object.fromEntries(
    BLUEPRINTS.flatMap((item) => item.days.map((entry, dayIndex) => [
      dayIdFor(item.id, dayIndex), entry.label,
    ])),
  ));
  const dayDisplayNameKey = (dayId) => DAY_DISPLAY_NAME_KEYS[String(dayId)] || null;
  const isDayDisplayNameKey = (value) => typeof value === "string" &&
    Object.values(DAY_DISPLAY_NAME_KEYS).includes(value);

  function structureDay(entry, index, fallbackLabel) {
    const source = isObject(entry) ? entry : {};
    const dayId = typeof source.dayId === "string" && source.dayId.trim()
      ? source.dayId.trim() : `legacy_d${index + 1}`;
    const label = typeof source.label === "string" && source.label.trim()
      ? source.label : fallbackLabel || `Day ${index + 1}`;
    const displayNameKey = isDayDisplayNameKey(source.displayNameKey)
      ? source.displayNameKey : dayDisplayNameKey(dayId);
    const contractLabel = DAY_CONTRACT_LABELS[dayId];
    const explicitOverride = typeof source.nameOverride === "string" && source.nameOverride.trim()
      ? source.nameOverride : null;
    // Before authored names existed, the editor stored a renamed generated day
    // only in `label`. Compare it with the internal contract label so a user's
    // old custom name remains frozen while untouched generated days gain the
    // new localized key on boot.
    const inferredOverride = !explicitOverride && displayNameKey && contractLabel && label !== contractLabel
      ? label : null;
    return {
      dayId,
      label,
      order: index + 1,
      ...(displayNameKey ? { displayNameKey } : {}),
      ...((explicitOverride || inferredOverride) ? { nameOverride: explicitOverride || inferredOverride } : {}),
    };
  }

  const RULES = Object.freeze({
    prescriptionClasses: Object.freeze({
      heavy_3_6: Object.freeze({ repRanges: [[3, 6]], sets: [2, 3], defaultSets: 3, efficientSets: 2, rir: [2, 3], rest: [120, 240] }),
      compound_4_8: Object.freeze({ repRanges: [[4, 8]], sets: [2, 3], defaultSets: 3, efficientSets: 2, rir: [1, 3], efficientRir: [0, 2], rest: [90, 180] }),
      compound_8_12: Object.freeze({ repRanges: [[8, 12]], sets: [2, 3], defaultSets: 3, efficientSets: 2, rir: [1, 3], efficientRir: [0, 2], rest: [90, 180] }),
      isolation_8_15: Object.freeze({ repRanges: [[8, 15]], sets: [1, 3], defaultSets: 2, efficientSets: 2, rir: [1, 3], efficientRir: [0, 2], rest: [60, 120] }),
    }),
    time: Object.freeze({ workingSetSeconds: 45, warmupSeconds: { primary: 300, compound: 120, assistance: 60 }, transitionSeconds: { new_station: 90, home_change: 45, same_station: 20 }, bufferMinimumSeconds: 300, bufferPercent: 10 }),
    reductionOrder: Object.freeze(["remove_optional", "efficient_two_set", "trim_reducible_assistance", "conflict"]),
    reentry: Object.freeze({ interrupted: { normalFromWeek: 2 }, returning: { normalFromWeek: 3 } }),
  });

  function inferEquipment(entry) {
    const equipment = Array.isArray(entry.equipment) ? entry.equipment.map(token) : [];
    if (equipment.includes("bodyweight")) return "bodyweight";
    if (equipment.includes("dumbbell")) return "dumbbell";
    if (equipment.includes("band")) return "band";
    if (equipment.includes("barbell")) return "barbell";
    if (equipment.includes("cable")) return "cable";
    if (equipment.includes("smith")) return "smith";
    if (equipment.includes("machine")) return "machine";
    return equipment[0] || "unknown";
  }

  function practicalRange(entry, equipment, patterns) {
    if (Array.isArray(entry.practicalRepRange) && entry.practicalRepRange.length === 2) return entry.practicalRepRange.slice();
    if (patterns.some((value) => ["curl", "triceps", "lateral_raise", "rear_delt", "calves", "leg_extension", "leg_curl", "chest_iso", "abs", "core"].includes(value))) return [8, 15];
    if (equipment === "barbell") return [3, 8];
    if (["machine", "smith", "cable"].includes(equipment)) return [4, 12];
    return [8, 15];
  }

  function normalizeCatalogue(raw, context = {}) {
    const increments = isObject(context.loadIncrements) ? context.loadIncrements : {};
    return (Array.isArray(raw) ? raw : []).filter((entry) => isObject(entry) && typeof entry.id === "string").map((entry) => {
      const equipment = inferEquipment(entry);
      const patterns = unique((Array.isArray(entry.patterns) ? entry.patterns : []).map(token));
      const primaryMuscles = words(entry.primary);
      const secondaryMuscles = words(entry.secondary);
      const isolation = patterns.some((value) => ["curl", "triceps", "lateral_raise", "rear_delt", "calves", "leg_extension", "leg_curl", "chest_iso", "abs", "core"].includes(value));
      const knownIncrement = Number(entry.loadIncrement || increments[equipment]);
      const loading = equipment === "bodyweight" ? "bodyweight" : equipment === "band" ? "ordinal" : Number.isFinite(knownIncrement) && knownIncrement > 0 ? "known_grid" : "external_unknown";
      const inferredRequirements = [];
      if (equipment === "bodyweight" && patterns.some((value) => value === "row" || value === "pulldown")) inferredRequirements.push("safe_pull");
      if (["trb_bw", "cd_bw", "trd_bw", "dpu_bw", "ipu_bw", "ilc_bw", "ghr_bw", "hx_bw"].includes(entry.id)) inferredRequirements.push("training_support");
      return Object.freeze({
        id: entry.id,
        name: String(entry.name || entry.id),
        namePt: String(entry.namePt || entry.name || entry.id),
        equipment,
        patterns,
        primaryMuscles,
        secondaryMuscles,
        stability: entry.stability || (["machine", "smith", "cable"].includes(equipment) ? "high" : equipment === "barbell" ? "free" : "moderate"),
        fatigueDemand: entry.fatigueDemand || (equipment === "barbell" && patterns.some((value) => value === "squat" || value === "hinge") ? "higher_systemic" : isolation ? "low_localized" : "moderate"),
        loading,
        loadIncrement: loading === "known_grid" ? knownIncrement : null,
        practicalRepRange: practicalRange(entry, equipment, patterns),
        environmentRequirements: unique([...(Array.isArray(entry.environmentRequirements) ? entry.environmentRequirements.map(token) : []), ...inferredRequirements]),
        primarySuitability: entry.primarySuitability || (!isolation && ["barbell", "machine", "smith"].includes(equipment) ? "high" : "moderate"),
        unilateral: entry.unilateral === true || /one arm|single leg|split squat|lunge/i.test(String(entry.name || "")),
        beginnerFriendly: entry.beginnerFriendly !== false,
        rank: Number.isFinite(entry.rank) ? entry.rank : 50,
        custom: entry.custom === true,
      });
    });
  }

  function validateContext(raw) {
    const issues = [];
    if (!isObject(raw)) return { ok: false, code: "invalid_context", issues: ["context: expected object"] };
    try {
      const serialized = JSON.stringify(raw);
      if (serialized.length > 200000) issues.push("context: structure too large");
    } catch {
      return { ok: false, code: "invalid_context", issues: ["context: unsupported structure"] };
    }
    const legacyKeys = ["schemaVersion", "familyId", "frequency", "sessionMinutes", "equipment", "environment", "loadIncrements", "preferences", "dislikes", "history", "priorityMuscles", "profile", "recentConsistency", "reentryEnabled", "weekNumber"];
    const currentKeys = ["preferredRestSeconds", "primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "priorityMovements", "splitId"];
    const allowed = new Set([...legacyKeys, ...(raw.schemaVersion === 2 ? currentKeys : [])]);
    for (const key of Object.keys(raw)) if (!allowed.has(key)) issues.push(`context.${key}: unknown key`);
    if (![1, 2].includes(raw.schemaVersion)) issues.push("context.schemaVersion: unsupported");
    if (!FAMILY_IDS.includes(raw.familyId)) issues.push("context.familyId: invalid");
    if (!FREQUENCIES.includes(raw.frequency)) issues.push("context.frequency: invalid");
    if (!Number.isFinite(raw.sessionMinutes) || raw.sessionMinutes < 10 || raw.sessionMinutes > 180) issues.push("context.sessionMinutes: invalid");
    for (const key of ["equipment", "preferences", "dislikes", "history", "priorityMuscles"]) if (raw[key] != null && !Array.isArray(raw[key])) issues.push(`context.${key}: expected array`);
    for (const key of ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles", "priorityMovements"]) if (raw[key] != null && !Array.isArray(raw[key])) issues.push(`context.${key}: expected array`);
    if (raw.environment != null && !Array.isArray(raw.environment)) issues.push("context.environment: expected array");
    if (raw.loadIncrements != null && !isObject(raw.loadIncrements)) issues.push("context.loadIncrements: expected object");
    if (raw.profile != null && !["standard", "foundation"].includes(raw.profile)) issues.push("context.profile: invalid");
    if (raw.recentConsistency != null && !["consistent", "interrupted", "returning"].includes(raw.recentConsistency)) issues.push("context.recentConsistency: invalid");
    if (raw.reentryEnabled != null && typeof raw.reentryEnabled !== "boolean") issues.push("context.reentryEnabled: invalid");
    if (raw.weekNumber != null && (!Number.isInteger(raw.weekNumber) || raw.weekNumber < 1 || raw.weekNumber > 52)) issues.push("context.weekNumber: invalid");
    if (raw.schemaVersion === 2) {
      if (raw.priorityMuscles != null) issues.push("context.priorityMuscles: use primaryMuscles in schema 2");
      if (raw.preferredRestSeconds !== null && !PREFERRED_REST_SECONDS.includes(raw.preferredRestSeconds)) issues.push("context.preferredRestSeconds: invalid");
      if (raw.splitId != null && raw.splitId !== `${raw.familyId}_${raw.frequency}_v1`) issues.push("context.splitId: incompatible");
      if ((raw.primaryMuscles || []).length > MAX_PRIMARY_MUSCLES) issues.push("context.primaryMuscles: too many");
      if ((raw.deEmphasizedMuscles || []).length > MAX_MUSCLE_CONTROLS) issues.push("context.deEmphasizedMuscles: too many");
      if ((raw.ignoredMuscles || []).length > MAX_MUSCLE_CONTROLS) issues.push("context.ignoredMuscles: too many");
      if ((raw.priorityMovements || []).length > MAX_PRIORITY_MOVEMENTS) issues.push("context.priorityMovements: too many");
      for (const key of ["primaryMuscles", "deEmphasizedMuscles", "ignoredMuscles"]) {
        for (const value of unique((raw[key] || []).map(token))) if (!MUSCLE_IDS.includes(value)) issues.push(`context.${key}: unknown muscle ${value}`);
      }
      for (const value of unique((raw.priorityMovements || []).map(token))) if (!MOVEMENT_PATTERN_IDS.includes(value)) issues.push(`context.priorityMovements: unknown movement ${value}`);
      const primary = unique((raw.primaryMuscles || []).map(token));
      const deEmphasized = unique((raw.deEmphasizedMuscles || []).map(token));
      const ignored = unique((raw.ignoredMuscles || []).map(token));
      if (intersects(primary, deEmphasized)) issues.push("context.muscles: primary and de-emphasized overlap");
      if (intersects(primary, ignored)) issues.push("context.muscles: primary and ignored overlap");
      if (intersects(deEmphasized, ignored)) issues.push("context.muscles: de-emphasized and ignored overlap");
    }
    if (issues.length) return { ok: false, code: "invalid_context", issues };
    const equipment = unique(["bodyweight", ...(raw.equipment || []).map(token)]);
    const primaryMuscles = unique((raw.schemaVersion === 2 ? raw.primaryMuscles || [] : raw.priorityMuscles || []).map(token));
    return { ok: true, value: {
      schemaVersion: raw.schemaVersion,
      familyId: raw.familyId,
      frequency: raw.frequency,
      sessionMinutes: raw.sessionMinutes,
      preferredRestSeconds: raw.schemaVersion === 2 ? raw.preferredRestSeconds : null,
      equipment,
      environment: unique((raw.environment || []).map(token)),
      loadIncrements: clone(raw.loadIncrements || {}),
      preferences: unique((raw.preferences || []).map(String)),
      dislikes: unique((raw.dislikes || []).map(String)),
      history: (raw.history || []).filter(isObject).map(clone),
      primaryMuscles,
      priorityMuscles: primaryMuscles,
      deEmphasizedMuscles: unique((raw.deEmphasizedMuscles || []).map(token)),
      ignoredMuscles: unique((raw.ignoredMuscles || []).map(token)),
      priorityMovements: unique((raw.priorityMovements || []).map(token)),
      splitId: raw.splitId || null,
      profile: raw.profile || "standard",
      recentConsistency: raw.recentConsistency || "consistent",
      reentryEnabled: raw.reentryEnabled === true,
      weekNumber: raw.weekNumber || 1,
    } };
  }

  function validateBlueprints() {
    const issues = [];
    if (BLUEPRINTS.length !== 20) issues.push("blueprints: expected 20");
    const ids = new Set();
    for (const item of BLUEPRINTS) {
      if (ids.has(item.id)) issues.push(`${item.id}: duplicate`);
      ids.add(item.id);
      if (item.days.length !== item.frequency) issues.push(`${item.id}: frequency mismatch`);
      if (item.kind !== "authored_sibling") issues.push(`${item.id}: not authored sibling`);
      item.days.forEach((entry, dayIndex) => {
        const dayId = dayIdFor(item.id, dayIndex);
        if (!dayDisplayNameKey(dayId)) issues.push(`${dayId}: missing display-name key`);
        entry.slots.forEach((rawSlot, slotIndex) => {
          if (!SLOT_TEMPLATES[rawSlot.template]) issues.push(`${item.id}.d${dayIndex + 1}.s${slotIndex + 1}: unknown template`);
        });
      });
    }
    for (const familyId of FAMILY_IDS) for (const frequency of FREQUENCIES) if (!ids.has(`${familyId}_${frequency}_v1`)) issues.push(`${familyId} ${frequency}: missing`);
    return issues.length ? { ok: false, issues } : { ok: true, count: BLUEPRINTS.length };
  }

  function available(candidate, context) {
    if (!context.equipment.includes(candidate.equipment)) return false;
    return candidate.environmentRequirements.every((requirement) => context.environment.includes(requirement));
  }

  function capabilitySet(context) {
    const capabilities = new Set(context.environment);
    if (context.equipment.some((item) => item !== "bodyweight")) capabilities.add("external_resistance");
    return capabilities;
  }

  function matchesCharacteristics(candidate, required) {
    for (const [key, values] of Object.entries(required || {})) if (!values.includes(candidate[key])) return false;
    return true;
  }

  function prescriptionClassFor(contractValue, candidate) {
    for (const classId of contractValue.prescriptionClasses) {
      const rule = RULES.prescriptionClasses[classId];
      const [min, max] = rule.repRanges[0];
      if (candidate.practicalRepRange[0] <= min && candidate.practicalRepRange[1] >= max) return classId;
    }
    return null;
  }

  function candidateFits(candidate, contractValue, context) {
    if (!available(candidate, context)) return false;
    if (!intersects(candidate.patterns, contractValue.patterns)) return false;
    if (!intersects([...candidate.primaryMuscles, ...candidate.secondaryMuscles], [...contractValue.primaryMuscles, ...contractValue.secondaryMuscles])) return false;
    if (contractValue.priorityBehavior === "priority_only" && !intersects(candidate.primaryMuscles, context.priorityMuscles)) return false;
    if (!contractValue.requiredCapabilities.every((value) => capabilitySet(context).has(value))) return false;
    if (!matchesCharacteristics(candidate, contractValue.requiredCharacteristics)) return false;
    return prescriptionClassFor(contractValue, candidate) !== null;
  }

  function preferenceMatches(candidate, contractValue, context) {
    let count = 0;
    for (const [key, values] of Object.entries(contractValue.preferredCharacteristics || {})) if (values.includes(candidate[key])) count++;
    if (context.priorityMuscles.length && intersects([...candidate.primaryMuscles, ...candidate.secondaryMuscles], context.priorityMuscles)) count++;
    return count;
  }

  function candidateOrder(candidate, contractValue, context) {
    const preferred = context.preferences.includes(candidate.id) ? 1 : 0;
    const movementPreferred = intersects(candidate.patterns, context.priorityMovements) ? 1 : 0;
    const history = context.history.some((entry) => entry.libraryId === candidate.id) ? 1 : 0;
    const preservesPrimaryIntent = intersects(candidate.primaryMuscles, contractValue.primaryMuscles) ? 1 : 0;
    const avoidsDeEmphasis = intersects(candidate.primaryMuscles, context.deEmphasizedMuscles) ? 0 : 1;
    const foundation = context.profile === "foundation" ? Number(candidate.beginnerFriendly) + Number(candidate.stability === "high") : 0;
    const homeEquipment = candidate.equipment === "bodyweight" ? 3 : candidate.equipment === "dumbbell" ? 2 : candidate.equipment === "band" ? 1 : 0;
    return [preferred, movementPreferred, preservesPrimaryIntent, avoidsDeEmphasis, history, preferenceMatches(candidate, contractValue, context), foundation, context.familyId === "home" ? homeEquipment : 0, candidate.primarySuitability === "high" ? 1 : 0, candidate.stability === "high" ? 1 : 0, -candidate.rank, candidate.id];
  }

  function compareRank(left, right, contractValue, context) {
    const a = candidateOrder(left, contractValue, context);
    const b = candidateOrder(right, contractValue, context);
    for (let index = 0; index < a.length - 1; index++) if (a[index] !== b[index]) return b[index] - a[index];
    return String(a.at(-1)).localeCompare(String(b.at(-1)));
  }

  function strategyFor(contractValue, candidate, context) {
    let allowed = contractValue.strategies.slice();
    if (context.profile === "foundation") {
      const retainedRepGoal = contractValue.strongRepGoalReason && allowed.includes("rep_goal@1");
      allowed = retainedRepGoal ? ["rep_goal@1"] : ["range@1"];
    }
    if (candidate.loading !== "known_grid") allowed = allowed.filter((value) => value !== "effort_target@1" && value !== "anchor_backoff@1");
    if (candidate.loading !== "known_grid") allowed = allowed.filter((value) => value !== "rep_goal@1");
    return allowed[0] || (contractValue.strategies.includes("range@1") ? "range@1" : null);
  }

  function buildProgression(strategyKey, rule, candidate, sets, rir = rule.rir) {
    const strategy = strategyParts(strategyKey);
    if (!strategy) return null;
    const [repMin, repMax] = rule.repRanges[0];
    let params = {};
    if (strategy.id === "range") params = { workingSets: sets, repMin, repMax, targetRirMin: rir[0], targetRirMax: rir[1] };
    else if (strategy.id === "rep_goal") params = { workingSets: sets, repGoal: sets * Math.round((repMin + repMax) / 2), repFloor: repMin, repCeiling: repMax, targetRirMin: rir[0], targetRirMax: rir[1], minLoadIncrement: candidate.loadIncrement || 2.5, jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1" };
    else if (strategy.id === "effort_target") params = { workingSets: sets, targetReps: Math.max(3, Math.min(5, repMax)), targetRirMin: 2, targetRirMax: 3, minLoadIncrement: candidate.loadIncrement };
    else if (strategy.id === "anchor_backoff") params = { anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 2, anchorTargetRirMax: 3, backoffSets: Math.max(1, sets - 1), backoffRepMin: 6, backoffRepMax: 8, backoffPercent: 0.8, minLoadIncrement: candidate.loadIncrement, jumpPercent: 2.5 };
    else params = {};
    return { schemaVersion: 1, strategy: { ...strategy, params }, modifiers: [] };
  }

  function resolvePrescription(contractValue, rawSlot, candidate, context) {
    const classId = prescriptionClassFor(contractValue, candidate);
    if (!classId) return null;
    const rule = RULES.prescriptionClasses[classId];
    const efficient = rawSlot.efficient === true;
    let sets = efficient ? rule.efficientSets : rule.defaultSets;
    // The RIR range this slot actually authored (its efficient range when the
    // blueprint marked the slot efficient, otherwise its normal range).
    const authoredRir = efficient && rule.efficientRir ? rule.efficientRir : rule.rir;
    // Foundation prefers the conservative portion of that authored range without
    // inventing a new target, widening the range, or leaving the authored
    // bounds: clamp a conservative floor into [authoredMin, authoredMax].
    const rir = context.profile === "foundation"
      ? [Math.min(Math.max(FOUNDATION_CONSERVATIVE_RIR, authoredRir[0]), authoredRir[1]), authoredRir[1]]
      : authoredRir;
    const strategy = strategyFor(contractValue, candidate, context);
    if (!strategy) return null;
    const restSeconds = context.preferredRestSeconds == null
      ? rule.rest[0]
      : Math.max(rule.rest[0], Math.min(rule.rest[1], context.preferredRestSeconds));
    return {
      classId,
      sets,
      repMin: rule.repRanges[0][0],
      repMax: rule.repRanges[0][1],
      targetRirMin: rir[0],
      targetRirMax: rir[1],
      restSeconds,
      restMinimumSeconds: rule.rest[0],
      progression: buildProgression(strategy, rule, candidate, sets, rir),
      efficient,
    };
  }

  function resolveSlot(rawSlot, contractValue, catalogue, context, ids) {
    const candidates = catalogue.filter((candidate) =>
      !context.dislikes.includes(candidate.id) &&
      !intersects(candidate.primaryMuscles, context.ignoredMuscles) &&
      candidateFits(candidate, contractValue, context)
    ).sort((a, b) => compareRank(a, b, contractValue, context));
    const selected = candidates[0];
    if (!selected) return null;
    const prescription = resolvePrescription(contractValue, rawSlot, selected, context);
    if (!prescription) return null;
    const resolvedStatus = contractValue.priorityBehavior === "protect_when_capable" ? "protected" : rawSlot.status || contractValue.status;
    return {
      slotId: ids.slotId,
      dayId: ids.dayId,
      templateId: rawSlot.template,
      role: contractValue.role,
      status: resolvedStatus,
      priorityBehavior: contractValue.priorityBehavior,
      protected: resolvedStatus === "protected",
      reducible: resolvedStatus !== "protected",
      efficientEligible: contractValue.efficientEligible,
      contract: clone(contractValue),
      exercise: clone(selected),
      prescription,
    };
  }

  function estimateDaySeconds(dayRecord) {
    const time = RULES.time;
    let subtotal = 0;
    dayRecord.slots.forEach((resolved, index) => {
      const sets = resolved.prescription.sets;
      subtotal += sets * time.workingSetSeconds;
      subtotal += Math.max(0, sets - 1) * resolved.prescription.restSeconds;
      subtotal += time.warmupSeconds[resolved.contract.warmupClass] || 0;
      if (index) subtotal += time.transitionSeconds[resolved.contract.transitionClass] || 0;
    });
    return subtotal + Math.max(time.bufferMinimumSeconds, Math.ceil(subtotal * time.bufferPercent / 100));
  }

  function updateProgressionShape(resolved) {
    const prescription = resolved.prescription;
    const strategy = prescription.progression.strategy;
    if (strategy.id === "range") {
      strategy.params.workingSets = prescription.sets;
      strategy.params.targetRirMin = prescription.targetRirMin;
      strategy.params.targetRirMax = prescription.targetRirMax;
    }
    if (strategy.id === "rep_goal") {
      strategy.params.workingSets = prescription.sets;
      strategy.params.repGoal = prescription.sets * Math.round((prescription.repMin + prescription.repMax) / 2);
      strategy.params.targetRirMin = prescription.targetRirMin;
      strategy.params.targetRirMax = prescription.targetRirMax;
    }
    if (strategy.id === "effort_target") strategy.params.workingSets = prescription.sets;
    if (strategy.id === "anchor_backoff") strategy.params.backoffSets = Math.max(1, prescription.sets - 1);
  }

  function fitTime(dayRecord, ceilingSeconds, reductions, context) {
    const estimate = () => estimateDaySeconds(dayRecord);
    const reductionCandidates = (predicate) => dayRecord.slots.filter(predicate).sort((left, right) => {
      const leftDeEmphasized = intersects(left.exercise.primaryMuscles, context.deEmphasizedMuscles) ? 1 : 0;
      const rightDeEmphasized = intersects(right.exercise.primaryMuscles, context.deEmphasizedMuscles) ? 1 : 0;
      if (leftDeEmphasized !== rightDeEmphasized) return rightDeEmphasized - leftDeEmphasized;
      return dayRecord.slots.indexOf(right) - dayRecord.slots.indexOf(left);
    });
    if (estimate() <= ceilingSeconds) return true;
    for (const resolved of reductionCandidates((entry) => entry.status === "optional")) {
      if (estimate() <= ceilingSeconds) break;
      dayRecord.slots.splice(dayRecord.slots.indexOf(resolved), 1);
      reductions.push({ step: "remove_optional", dayId: dayRecord.dayId, slotId: resolved.slotId });
    }
    for (const resolved of reductionCandidates((entry) => entry.efficientEligible && entry.prescription.sets > 2)) {
      if (estimate() <= ceilingSeconds) break;
      resolved.prescription.sets = 2;
      if (RULES.prescriptionClasses[resolved.prescription.classId].efficientRir) {
        resolved.prescription.targetRirMin = 0;
        resolved.prescription.targetRirMax = 2;
      }
      resolved.prescription.efficient = true;
      updateProgressionShape(resolved);
      reductions.push({ step: "efficient_two_set", dayId: dayRecord.dayId, slotId: resolved.slotId });
    }
    for (const resolved of reductionCandidates((entry) => entry.reducible && entry.role !== "heavy_primary" && entry.prescription.sets > 1)) {
      if (estimate() <= ceilingSeconds) break;
      resolved.prescription.sets--;
      updateProgressionShape(resolved);
      reductions.push({ step: "trim_reducible_assistance", dayId: dayRecord.dayId, slotId: resolved.slotId });
    }
    return estimate() <= ceilingSeconds;
  }

  function exposureFor(days) {
    const direct = {};
    const indirect = {};
    for (const dayRecord of days) for (const resolved of dayRecord.slots) {
      for (const muscle of resolved.exercise.primaryMuscles) direct[muscle] = (direct[muscle] || 0) + resolved.prescription.sets;
      for (const muscle of resolved.exercise.secondaryMuscles) indirect[muscle] = (indirect[muscle] || 0) + resolved.prescription.sets;
    }
    return { direct, indirect };
  }

  function relationState(instance, blueprintValue) {
    const byPosition = (position) => instance.days[position[0]]?.slots[position[1]];
    const relations = [];
    for (const authored of blueprintValue.relations) {
      const heavy = byPosition(authored.heavy);
      const volume = byPosition(authored.volume);
      if (!heavy || !volume) continue;
      const heavyStrategy = `${heavy.prescription.progression.strategy.id}@${heavy.prescription.progression.strategy.version}`;
      const volumeStrategy = `${volume.prescription.progression.strategy.id}@${volume.prescription.progression.strategy.version}`;
      const exactMovement = heavy.exercise.id === volume.exercise.id;
      const compatible = exactMovement && heavyStrategy === "anchor_backoff@1" && volumeStrategy === "rep_goal@1";
      relations.push({
        id: authored.id,
        type: "paired_exposure",
        version: 1,
        heavySlotId: heavy.slotId,
        volumeSlotId: volume.slotId,
        state: compatible ? "attached" : "structural_only",
        reason: compatible ? null : exactMovement ? "paired_exposure.incompatible_strategy_pair" : "paired_exposure.movement_identity_mismatch",
        ...(compatible ? { movementId: heavy.exercise.id } : {}),
      });
    }
    return relations;
  }

  function alignAuthoredRelations(days, blueprintValue, context) {
    for (const authored of blueprintValue.relations) {
      const heavy = days[authored.heavy[0]]?.slots[authored.heavy[1]];
      const volume = days[authored.volume[0]]?.slots[authored.volume[1]];
      if (!heavy || !volume || !candidateFits(heavy.exercise, volume.contract, context)) continue;
      const prescription = resolvePrescription(volume.contract, {}, heavy.exercise, context);
      if (!prescription) continue;
      volume.exercise = clone(heavy.exercise);
      volume.prescription = prescription;
    }
  }

  function weekSchedule(days, context) {
    const normal = () => days.map((dayRecord) => ({ dayId: dayRecord.dayId, slots: dayRecord.slots.map((resolved) => ({ slotId: resolved.slotId, sets: resolved.prescription.sets })) }));
    const weeks = Array.from({ length: 6 }, (_, index) => ({ week: index + 1, days: normal(), phase: "normal" }));
    if (!context.reentryEnabled || context.recentConsistency === "consistent") return weeks;
    const reduce = (week, mode) => {
      week.phase = mode;
      for (const dayRecord of week.days) for (const target of dayRecord.slots) {
        const resolved = days.flatMap((entry) => entry.slots).find((entry) => entry.slotId === target.slotId);
        if (!resolved || target.sets < 2) continue;
        if (mode === "interrupted_week_1" && resolved.status === "protected") continue;
        if (mode === "returning_week_2" && (resolved.role === "heavy_primary" || resolved.role === "hypertrophy_compound" || resolved.role === "volume_counterpart")) continue;
        if (resolved.status === "optional" && mode !== "returning_week_2") target.sets = 0;
        else if (resolved.reducible) target.sets = Math.max(1, target.sets - 1);
      }
    };
    if (context.recentConsistency === "interrupted") reduce(weeks[0], "interrupted_week_1");
    if (context.recentConsistency === "returning") {
      reduce(weeks[0], "returning_week_1");
      reduce(weeks[1], "returning_week_2");
    }
    return weeks;
  }

  function projectProgram(instance) {
    const exercises = [];
    for (const dayRecord of instance.days) dayRecord.slots.forEach((resolved, index) => {
      const progression = clone(resolved.prescription.progression);
      const strategy = progression.strategy.id;
      const sets = strategy === "anchor_backoff" ? 1 + progression.strategy.params.backoffSets : resolved.prescription.sets;
      exercises.push({
        id: resolved.slotId,
        slotId: resolved.slotId,
        dayId: dayRecord.dayId,
        day: dayRecord.label,
        order: index + 1,
        name: resolved.exercise.name,
        libraryId: resolved.exercise.id,
        movementId: `library:${resolved.exercise.id}`,
        sets,
        min: resolved.prescription.repMin,
        max: resolved.prescription.repMax,
        primary: resolved.exercise.primaryMuscles.join(","),
        secondary: resolved.exercise.secondaryMuscles.join(","),
        notes: "",
        alternates: [],
        targetRirStart: resolved.prescription.targetRirMax,
        targetRirEnd: resolved.prescription.targetRirMin,
        minSets: RULES.prescriptionClasses[resolved.prescription.classId].sets[0],
        maxSets: RULES.prescriptionClasses[resolved.prescription.classId].sets[1],
        priority: resolved.status,
        loadingMode: resolved.exercise.loading,
        loadIncrement: resolved.exercise.loadIncrement,
        progression,
      });
    });
    return exercises;
  }

  function programStructure(instance) {
    return {
      schemaVersion: 1,
      days: instance.days.map((dayRecord, index) => ({
        dayId: dayRecord.dayId,
        label: dayRecord.label,
        order: index + 1,
        ...(dayDisplayNameKey(dayRecord.dayId) ? { displayNameKey: dayDisplayNameKey(dayRecord.dayId) } : {}),
      })),
      provenance: clone(instance.provenance),
      weekPrescriptions: clone(instance.weeks),
      customizedFrom: instance.customizedFrom || null,
    };
  }

  function projectProgramForWeek(program, structure, weekNumber) {
    const authored = Array.isArray(program) ? clone(program) : [];
    if (!Number.isInteger(weekNumber) || weekNumber < 1 ||
        !isObject(structure) || !Array.isArray(structure.weekPrescriptions)) return authored;
    const week = structure.weekPrescriptions.find((entry) =>
      isObject(entry) && entry.week === weekNumber && Array.isArray(entry.days));
    if (!week) return authored;
    const targets = new Map();
    for (const dayRecord of week.days) {
      if (!isObject(dayRecord) || !Array.isArray(dayRecord.slots)) return authored;
      for (const target of dayRecord.slots) {
        if (!isObject(target) || typeof target.slotId !== "string" ||
            !Number.isInteger(target.sets) || target.sets < 0) return authored;
        targets.set(target.slotId, target.sets);
      }
    }
    return authored.flatMap((exercise) => {
      const slotId = typeof exercise?.slotId === "string" ? exercise.slotId : exercise?.id;
      if (!targets.has(slotId)) return [exercise];
      const sets = targets.get(slotId);
      return sets === 0 ? [] : [{ ...exercise, sets }];
    });
  }

  function compile(rawContext, rawCatalogue) {
    const checked = validateContext(rawContext);
    if (!checked.ok) return { kind: "invalid", ...checked };
    const context = checked.value;
    const blueprintValue = BLUEPRINT_BY_ID.get(`${context.familyId}_${context.frequency}_v1`);
    if (!blueprintValue) return { kind: "invalid", code: "unsupported_blueprint", issues: [] };
    const catalogue = normalizeCatalogue(rawCatalogue, context);
    const days = [];
    const limitations = [];
    const conflicts = [];
    for (let dayIndex = 0; dayIndex < blueprintValue.days.length; dayIndex++) {
      const authoredDay = blueprintValue.days[dayIndex];
      const dayId = dayIdFor(blueprintValue.id, dayIndex);
      const dayRecord = {
        dayId,
        label: authoredDay.label,
        displayNameKey: dayDisplayNameKey(dayId),
        slots: [],
      };
      for (let slotIndex = 0; slotIndex < authoredDay.slots.length; slotIndex++) {
        const rawSlot = authoredDay.slots[slotIndex];
        const base = SLOT_TEMPLATES[rawSlot.template];
        const contractValue = Object.freeze({ ...base, ...Object.fromEntries(Object.entries(rawSlot).filter(([key]) => key !== "template")) });
        if (context.profile === "foundation" && contractValue.status === "optional") continue;
        if (contractValue.priorityBehavior === "priority_only" && !context.priorityMuscles.length) continue;
        const slotId = `${dayId}_s${slotIndex + 1}`;
        const resolved = resolveSlot(rawSlot, contractValue, catalogue, context, { dayId, slotId });
        const directDeEmphasizedOptional = resolved && resolved.status === "optional" &&
          intersects(resolved.exercise.primaryMuscles, context.deEmphasizedMuscles);
        if (directDeEmphasizedOptional) limitations.push({ code: "deemphasized_optional_omitted", dayId, slotId });
        else if (resolved) dayRecord.slots.push(resolved);
        else {
          const ignoredCandidate = catalogue.some((candidate) =>
            !context.dislikes.includes(candidate.id) &&
            intersects(candidate.primaryMuscles, context.ignoredMuscles) &&
            candidateFits(candidate, contractValue, context));
          const resolvedStatus = rawSlot.status || contractValue.status;
          const safelyOmittableIgnored = ignoredCandidate &&
            (resolvedStatus === "optional" || resolvedStatus === "conditional" ||
              (resolvedStatus === "reducible" && contractValue.role === "isolation_accessory"));
          if (safelyOmittableIgnored) limitations.push({ code: "ignored_direct_work_omitted", dayId, slotId });
          else if (ignoredCandidate) conflicts.push({ code: "ignored_muscle_required", dayId, slotId, templateId: rawSlot.template });
          else if (contractValue.status === "optional") limitations.push({ code: "optional_slot_unresolved", dayId, slotId });
          else if (contractValue.status === "conditional") limitations.push({ code: rawSlot.template === "home_pull" ? "home.pull_capability_unavailable" : "conditional_slot_unresolved", dayId, slotId });
          else conflicts.push({ code: "required_slot_unresolved", dayId, slotId, templateId: rawSlot.template });
        }
      }
      days.push(dayRecord);
    }
    if (context.profile !== "foundation") alignAuthoredRelations(days, blueprintValue, context);
    const reductions = [];
    const ceilingSeconds = context.sessionMinutes * 60;
    for (const dayRecord of days) if (!fitTime(dayRecord, ceilingSeconds, reductions, context)) conflicts.push({ code: "time_ceiling_conflict", dayId: dayRecord.dayId, ceilingMinutes: context.sessionMinutes, estimateMinutes: Math.ceil(estimateDaySeconds(dayRecord) / 60) });
    if (conflicts.length) return { kind: "conflict", code: "compiler_conflict", familyId: context.familyId, frequency: context.frequency, conflicts, limitations, reductions };
    const instance = {
      kind: "compiled",
      schemaVersion: 1,
      familyId: context.familyId,
      frequency: context.frequency,
      blueprintId: blueprintValue.id,
      days,
      limitations,
      reductions,
      directIndirectExposure: exposureFor(days),
      provenance: { familyId: context.familyId, blueprintId: blueprintValue.id, blueprintVersion: 1, compilerVersion: VERSIONS.compiler, catalogueVersion: VERSIONS.catalogue, rulesVersion: VERSIONS.rules, contextVersion: VERSIONS.context, profileId: context.profile === "foundation" ? "simple_start@1" : "standard@1", recentConsistencyVersion: VERSIONS.recentConsistency },
      customizedFrom: null,
    };
    instance.relations = context.profile === "foundation" ? [] : relationState(instance, blueprintValue);
    instance.weeks = weekSchedule(days, context);
    instance.program = projectProgram(instance);
    instance.programStructure = programStructure(instance);
    return clone(instance);
  }

  function substitute(instance, slotId, libraryId, rawCatalogue, rawContext) {
    if (!isObject(instance) || instance.kind !== "compiled") return { kind: "invalid", code: "invalid_instance" };
    const checked = validateContext(rawContext);
    if (!checked.ok) return { kind: "invalid", ...checked };
    const context = checked.value;
    const catalogue = normalizeCatalogue(rawCatalogue, context);
    const selected = catalogue.find((entry) => entry.id === libraryId);
    const next = clone(instance);
    const resolved = next.days.flatMap((entry) => entry.slots).find((entry) => entry.slotId === slotId);
    if (!resolved || !selected) return { kind: "conflict", code: "substitution_unknown" };
    if (!candidateFits(selected, resolved.contract, context)) return { kind: "conflict", code: "substitution_incompatible", slotId, libraryId };
    const prescription = resolvePrescription(resolved.contract, {}, selected, context);
    if (!prescription) return { kind: "conflict", code: "substitution_prescription_incompatible", slotId, libraryId };
    resolved.exercise = clone(selected);
    resolved.prescription = prescription;
    const blueprintValue = BLUEPRINT_BY_ID.get(next.blueprintId);
    next.relations = relationState(next, blueprintValue);
    next.directIndirectExposure = exposureFor(next.days);
    next.weeks = weekSchedule(next.days, context);
    next.program = projectProgram(next);
    next.programStructure = programStructure(next);
    return next;
  }

  function customize(instance, slotId, exercise) {
    if (!isObject(instance) || instance.kind !== "compiled" || !isObject(exercise)) return { kind: "invalid", code: "invalid_customization" };
    const next = clone(instance);
    const resolved = next.days.flatMap((entry) => entry.slots).find((entry) => entry.slotId === slotId);
    if (!resolved) return { kind: "invalid", code: "unknown_slot" };
    next.customizedFrom = next.customizedFrom || next.blueprintId;
    resolved.exercise = { id: String(exercise.id || `customized:${slotId}`), name: String(exercise.name || "Customized exercise"), namePt: String(exercise.namePt || exercise.name || "Exercício personalizado"), equipment: "custom", patterns: [], primaryMuscles: words(exercise.primary), secondaryMuscles: words(exercise.secondary), stability: "moderate", fatigueDemand: "moderate", loading: "external_unknown", loadIncrement: null, practicalRepRange: [1, 100], environmentRequirements: [], primarySuitability: "moderate", unilateral: false, beginnerFriendly: true, rank: 50, custom: true };
    resolved.prescription.progression = { schemaVersion: 1, strategy: { id: "manual", version: 1, params: {} }, modifiers: [] };
    next.relations = [];
    next.directIndirectExposure = exposureFor(next.days);
    next.program = projectProgram(next);
    next.programStructure = programStructure(next);
    return next;
  }

  function migrateLegacyStructure(program, current) {
    const exercises = Array.isArray(program) ? clone(program) : [];
    const existing = isObject(current) && current.schemaVersion === 1 && Array.isArray(current.days) ? clone(current) : null;
    const labels = unique(exercises.map((entry) => String(entry.day || "").trim()).filter(Boolean));
    if (!labels.length && existing?.days?.length) {
      return {
        program: exercises,
        structure: {
          schemaVersion: 1,
          days: existing.days.map((entry, index) => structureDay(entry, index)),
          provenance: existing.provenance || { source: "legacy_migration", compilerVersion: null },
          weekPrescriptions: existing.weekPrescriptions || [],
          customizedFrom: existing.customizedFrom || null,
        },
      };
    }
    const used = new Set();
    let days;
    if (existing?.days?.length) {
      // Keep empty structure days when only some days have exercises yet.
      days = existing.days.map((entry, index) => {
        let dayId = entry.dayId || `legacy_d${index + 1}`;
        while (used.has(dayId)) dayId = `${dayId}_${index + 1}`;
        used.add(dayId);
        return structureDay({ ...entry, dayId }, index);
      });
      for (const label of labels) {
        if (days.some((entry) => entry.label === label)) continue;
        const exerciseDayId = exercises.find((entry) => entry.day === label && typeof entry.dayId === "string")?.dayId;
        let dayId = exerciseDayId || `legacy_d${days.length + 1}`;
        while (used.has(dayId)) dayId = `${dayId}_${days.length + 1}`;
        used.add(dayId);
        days.push(structureDay({ dayId, label }, days.length));
      }
    } else {
      days = labels.map((label, index) => {
        const exerciseDayId = exercises.find((entry) => entry.day === label && typeof entry.dayId === "string")?.dayId;
        let dayId = exerciseDayId || `legacy_d${index + 1}`;
        while (used.has(dayId)) dayId = `${dayId}_${index + 1}`;
        used.add(dayId);
        return structureDay({ dayId, label }, index);
      });
    }
    const byLabel = new Map(days.map((entry) => [entry.label, entry.dayId]));
    exercises.forEach((entry, index) => {
      entry.dayId = byLabel.get(entry.day) || days[0]?.dayId || `legacy_d1`;
      entry.slotId = typeof entry.slotId === "string" && entry.slotId ? entry.slotId : typeof entry.id === "string" && entry.id ? entry.id : `${entry.dayId}_legacy_s${index + 1}`;
    });
    return { program: exercises, structure: { schemaVersion: 1, days, provenance: existing?.provenance || { source: "legacy_migration", compilerVersion: null }, weekPrescriptions: existing?.weekPrescriptions || [], customizedFrom: existing?.customizedFrom || null } };
  }

  function getCompatibleSplitChoices(rawContext) {
    const checked = validateContext(rawContext);
    if (!checked.ok) return [];
    const context = checked.value;
    const blueprintValue = BLUEPRINT_BY_ID.get(`${context.familyId}_${context.frequency}_v1`);
    if (!blueprintValue) return [];
    return [{
      id: blueprintValue.id,
      familyId: blueprintValue.familyId,
      frequency: blueprintValue.frequency,
      blueprintId: blueprintValue.id,
      blueprintVersion: blueprintValue.version,
      default: true,
    }];
  }

  const api = Object.freeze({
    VERSIONS,
    FREQUENCIES,
    FAMILY_IDS,
    STRATEGIES,
    FAMILIES,
    SLOT_TEMPLATES,
    BLUEPRINTS,
    DAY_DISPLAY_NAME_KEYS,
    DAY_CONTRACT_LABELS,
    RULES,
    MUSCLE_IDS,
    MOVEMENT_PATTERN_IDS,
    PREFERRED_REST_SECONDS,
    dayDisplayNameKey,
    validateBlueprints,
    validateContext,
    normalizeCatalogue,
    getCompatibleSplitChoices,
    compile,
    substitute,
    customize,
    projectProgram,
    projectProgramForWeek,
    programStructure,
    migrateLegacyStructure,
    estimateDaySeconds,
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeProgramCompiler = api;
})(typeof window !== "undefined" ? window : globalThis);
