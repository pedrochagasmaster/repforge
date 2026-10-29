(function (root) {
  "use strict";
  const POLICY = root?.RepForgeEnginePolicy || (typeof require === "function" ? require("./engine-policy.js") : null);
  const DEFAULT_POLICY = POLICY.getDefaultEnginePolicy();
  const patterns = ["horizontalPush", "verticalPush", "horizontalPull", "verticalPull", "squat", "hipHinge"];
  const orderPatterns = ["horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "squat", "hipHinge"];
  const defaults = [
    ["sideDelts", "biceps", "triceps", "chest", "rearDelts", "lats", "calves", "hamstrings", "quads", "abs"],
    ["upperTraps", "upperBack", "forearms", "neck", "abductors", "obliques"],
    ["frontDelts", "glutes", "adductors", "lowerBack"],
  ];
  const strengthDefaults = [
    ["sideDelts", "biceps", "triceps", "chest", "rearDelts", "lats", "calves", "hamstrings", "quads"],
    ["upperTraps", "upperBack", "forearms", "neck", "abs", "glutes", "abductors", "obliques"],
    ["frontDelts", "adductors", "lowerBack"],
  ];
  const upperMuscles = new Set(["triceps", "forearms", "sideDelts", "rearDelts", "upperBack", "neck", "lats", "upperTraps", "biceps", "chest", "frontDelts", "serratus"]);
  const allMuscles = new Set([...defaults.flat(), "serratus", "tibs"]);
  const SPLITS = Object.freeze([
    { id: "full_body", daysPerWeek: [2, 3, 4, 5, 6], variants: {
      2: { upperFraction: 0.65, days: [
        {"name": "Workout A", "primary": ["primaryHorizontalPush", "primaryHorizontalPull", "primarySquat"], "secondary": [], "extra": []},
        {"name": "Workout B", "primary": ["primaryVerticalPush", "primaryVerticalPull", "primaryHinge"], "secondary": [], "extra": []},
      ] },
      3: { upperFraction: 0.65, days: [
        {"name": "Workout A", "primary": ["primaryHorizontalPush", "primaryVerticalPull", "secondarySquat", "secondaryVerticalPush", "upperBodyAccessories", "lowerBodyAccessories"], "secondary": ["secondaryHorizontalPush", "secondaryVerticalPull"], "extra": []},
        {"name": "Workout B", "primary": ["primaryVerticalPush", "primarySquat", "secondaryHinge", "secondaryHorizontalPull", "upperBodyAccessories", "lowerBodyAccessories"], "secondary": ["secondaryVerticalPush", "secondarySquat"], "extra": []},
        {"name": "Workout C", "primary": ["primaryHorizontalPull", "primaryHinge", "secondaryHorizontalPush", "secondaryVerticalPull", "upperBodyAccessories", "lowerBodyAccessories"], "secondary": ["secondaryHorizontalPull", "secondaryHinge"], "extra": []},
      ] },
      4: { upperFraction: 0.65, days: [
        {"name": "Workout A", "primary": ["primaryHorizontalPush", "primarySquat", "secondaryHorizontalPull", "allAccessories"], "secondary": ["secondaryHorizontalPush", "secondarySquat"], "extra": []},
        {"name": "Workout B", "primary": ["primaryVerticalPush", "primaryHinge", "secondaryVerticalPull", "allAccessories"], "secondary": ["secondaryVerticalPush", "secondaryHinge"], "extra": []},
        {"name": "Workout C", "primary": ["primaryHorizontalPull", "secondarySquat", "secondaryHorizontalPush", "allAccessories"], "secondary": ["secondaryHorizontalPull"], "extra": []},
        {"name": "Workout D", "primary": ["primaryVerticalPull", "secondaryHinge", "secondaryVerticalPush", "allAccessories"], "secondary": ["secondaryVerticalPull"], "extra": []},
      ] },
      5: { upperFraction: 0.65, days: [
        {"name": "Workout A", "primary": ["primaryHorizontalPush", "secondaryHinge", "allAccessories"], "secondary": ["secondaryHorizontalPush"], "extra": []},
        {"name": "Workout B", "primary": ["primaryHorizontalPull", "secondaryVerticalPush", "secondarySquat", "allAccessories"], "secondary": ["secondaryHorizontalPull"], "extra": []},
        {"name": "Workout C", "primary": ["primaryVerticalPush", "primaryHinge", "secondaryHorizontalPull", "allAccessories"], "secondary": ["secondaryVerticalPush", "secondaryHinge"], "extra": []},
        {"name": "Workout D", "primary": ["primaryVerticalPull", "secondaryHorizontalPush", "allAccessories"], "secondary": ["secondaryVerticalPull"], "extra": []},
        {"name": "Workout E", "primary": ["primarySquat", "secondaryVerticalPull", "allAccessories"], "secondary": ["secondarySquat"], "extra": []},
      ] },
      6: { upperFraction: 0.65, days: [
        {"name": "Workout A", "primary": ["primarySquat", "primaryHorizontalPull"], "secondary": ["secondarySquat", "secondaryHorizontalPull"], "extra": []},
        {"name": "Workout B", "primary": ["primaryHorizontalPush", "primaryVerticalPull"], "secondary": ["secondaryHorizontalPush", "secondaryVerticalPull"], "extra": []},
        {"name": "Workout C", "primary": ["primaryHinge", "secondaryHorizontalPull"], "secondary": ["secondaryHinge"], "extra": []},
        {"name": "Workout D", "primary": ["primaryVerticalPush", "secondarySquat"], "secondary": ["secondaryVerticalPush"], "extra": []},
        {"name": "Workout E", "primary": ["secondaryHorizontalPush", "secondaryHinge"], "secondary": [], "extra": []},
        {"name": "Workout F", "primary": ["secondaryVerticalPush", "secondaryVerticalPull"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "upper_lower", daysPerWeek: [2], variants: {
      2: { upperFraction: 0.5, days: [
        {"name": "Upper", "primary": ["primaryUpperBodyCompounds", "secondaryUpperBodyCompounds", "upperBodyAccessories"], "secondary": [], "extra": []},
        {"name": "Lower", "primary": ["primaryLowerBodyCompounds", "secondaryLowerBodyCompounds", "lowerBodyAccessories"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "push_pull", daysPerWeek: [2], variants: {
      2: { upperFraction: 0.65, days: [
        {"name": "Push", "primary": ["pushCompounds", "squatCompounds", "pushAccessories", "squatAccessories"], "secondary": [], "extra": []},
        {"name": "Pull", "primary": ["pullCompounds", "hingeCompounds", "pullAccessories", "hingeAccessories"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "upper_lower_full", daysPerWeek: [3], variants: {
      3: { upperFraction: 0.5, days: [
        {"name": "Upper", "primary": ["primaryPushCompounds", "primaryPullCompounds", "secondaryHorizontalPush", "upperBodyAccessories"], "secondary": ["secondaryVerticalPush", "secondaryHorizontalPull", "secondaryVerticalPull"], "extra": []},
        {"name": "Lower", "primary": ["primarySquat", "primaryHinge", "secondarySquat", "lowerBodyAccessories"], "secondary": ["secondaryHinge"], "extra": []},
        {"name": "Full", "primary": ["secondaryPullCompounds", "secondaryVerticalPush", "secondaryHinge", "allAccessories"], "secondary": ["secondaryHorizontalPush"], "extra": []},
      ] },
    } },
    { id: "push_pull_legs", daysPerWeek: [3], variants: {
      3: { upperFraction: 0.65, days: [
        {"name": "Push", "primary": ["primaryPushCompounds", "secondaryPushCompounds", "pushAccessories"], "secondary": [], "extra": []},
        {"name": "Pull", "primary": ["primaryPullCompounds", "secondaryPullCompounds", "pullAccessories"], "secondary": [], "extra": []},
        {"name": "Legs", "primary": ["squatCompounds", "hingeCompounds", "lowerBodyAccessories"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "upper_lower_upper_lower", daysPerWeek: [4], variants: {
      4: { upperFraction: 0.5, days: [
        {"name": "Upper A", "primary": ["primaryHorizontalPush", "primaryHorizontalPull", "secondaryVerticalPush", "secondaryVerticalPull", "upperBodyAccessories"], "secondary": ["secondaryHorizontalPush", "secondaryHorizontalPull"], "extra": ["primaryVerticalPush", "primaryVerticalPull", "secondaryHorizontalPush", "secondaryHorizontalPull", "upperBodyAccessories"]},
        {"name": "Lower A", "primary": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"], "secondary": ["secondarySquat"], "extra": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"]},
        {"name": "Upper B", "primary": ["primaryVerticalPush", "primaryVerticalPull", "secondaryHorizontalPush", "secondaryHorizontalPull", "upperBodyAccessories"], "secondary": ["secondaryVerticalPush", "secondaryVerticalPull"], "extra": ["primaryHorizontalPush", "primaryHorizontalPull", "secondaryVerticalPush", "secondaryVerticalPull", "upperBodyAccessories"]},
        {"name": "Lower B", "primary": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"], "secondary": ["secondaryHinge"], "extra": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"]},
      ] },
    } },
    { id: "push_pull_hinge_squat", daysPerWeek: [4], variants: {
      4: { upperFraction: 0.5, days: [
        {"name": "Push", "primary": ["pushCompounds", "pushAccessories"], "secondary": [], "extra": ["pullCompounds", "pullAccessories"]},
        {"name": "Hinge", "primary": ["hingeCompounds", "hingeAccessories"], "secondary": [], "extra": ["squatCompounds", "squatAccessories"]},
        {"name": "Pull", "primary": ["pullCompounds", "pullAccessories"], "secondary": [], "extra": ["pushCompounds", "pushAccessories"]},
        {"name": "Squat", "primary": ["squatCompounds", "squatAccessories"], "secondary": [], "extra": ["hingeCompounds", "hingeAccessories"]},
      ] },
    } },
    { id: "push_pull_legs_accessories", daysPerWeek: [4], variants: {
      4: { upperFraction: 0.65, days: [
        {"name": "Push", "primary": ["pushCompounds"], "secondary": [], "extra": ["pushCompounds", "pushAccessories"]},
        {"name": "Pull", "primary": ["pullCompounds"], "secondary": [], "extra": ["pullCompounds", "pullAccessories"]},
        {"name": "Legs", "primary": ["squatCompounds", "hingeCompounds"], "secondary": [], "extra": ["allLower"]},
        {"name": "Accessories", "primary": ["allAccessories"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "upper_lower_upper_lower_upper", daysPerWeek: [5], variants: {
      5: { upperFraction: 0.6, days: [
        {"name": "Upper A", "primary": ["primaryHorizontalPush", "primaryHorizontalPull", "secondaryVerticalPull", "upperBodyAccessories"], "secondary": ["secondaryHorizontalPush", "secondaryHorizontalPull"], "extra": ["primaryVerticalPush", "primaryVerticalPull", "secondaryHorizontalPush", "secondaryHorizontalPull", "secondaryVerticalPush", "upperBodyAccessories"]},
        {"name": "Lower A", "primary": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"], "secondary": ["secondarySquat"], "extra": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"]},
        {"name": "Upper B", "primary": ["primaryVerticalPush", "primaryVerticalPull", "secondaryHorizontalPush", "upperBodyAccessories"], "secondary": ["secondaryVerticalPush", "secondaryVerticalPull"], "extra": ["primaryHorizontalPush", "primaryHorizontalPull", "secondaryHorizontalPull", "secondaryVerticalPush", "secondaryVerticalPull", "upperBodyAccessories"]},
        {"name": "Lower B", "primary": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"], "secondary": ["secondaryHinge"], "extra": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"]},
        {"name": "Upper C", "primary": ["secondaryHorizontalPull", "secondaryVerticalPush", "upperBodyAccessories"], "secondary": [], "extra": ["primaryHorizontalPush", "primaryHorizontalPull", "primaryVerticalPush", "primaryVerticalPull", "secondaryHorizontalPush", "secondaryVerticalPull", "upperBodyAccessories"]},
      ] },
    } },
    { id: "push_pull_hinge_squat_accessories", daysPerWeek: [5], variants: {
      5: { upperFraction: 0.5, days: [
        {"name": "Push", "primary": ["pushCompounds"], "secondary": [], "extra": ["pushAccessories"]},
        {"name": "Hinge", "primary": ["hingeCompounds"], "secondary": [], "extra": ["hingeAccessories"]},
        {"name": "Pull", "primary": ["pullCompounds"], "secondary": [], "extra": ["pullAccessories"]},
        {"name": "Squat", "primary": ["squatCompounds"], "secondary": [], "extra": ["squatAccessories"]},
        {"name": "Accessories", "primary": ["allAccessories"], "secondary": [], "extra": []},
      ] },
    } },
    { id: "push_pull_legs_upper_lower", daysPerWeek: [5], variants: {
      5: { upperFraction: 0.6, days: [
        {"name": "Push", "primary": ["primaryHorizontalPush", "primaryVerticalPush", "secondaryHorizontalPush", "pushAccessories"], "secondary": ["secondaryVerticalPush"], "extra": ["pushCompounds", "pushAccessories"]},
        {"name": "Pull", "primary": ["primaryHorizontalPull", "primaryVerticalPull", "secondaryVerticalPull", "pullAccessories"], "secondary": ["secondaryHorizontalPull"], "extra": ["pullCompounds", "pullAccessories"]},
        {"name": "Legs", "primary": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"], "secondary": ["secondarySquat"], "extra": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"]},
        {"name": "Upper", "primary": ["secondaryVerticalPush", "secondaryHorizontalPull", "upperBodyAccessories"], "secondary": ["secondaryHorizontalPush", "secondaryVerticalPull"], "extra": ["primaryHorizontalPush", "primaryVerticalPush", "secondaryHorizontalPush", "pushAccessories", "primaryHorizontalPull", "primaryVerticalPull", "secondaryVerticalPull", "pullAccessories"]},
        {"name": "Lower", "primary": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"], "secondary": ["secondaryHinge"], "extra": ["secondaryVerticalPush", "secondaryHorizontalPull", "upperBodyAccessories"]},
      ] },
    } },
    { id: "push_pull_hinge_squat_upper_lower", daysPerWeek: [6], variants: {
      6: { upperFraction: 0.5, days: [
        {"name": "Push", "primary": ["primaryHorizontalPush", "primaryVerticalPush"], "secondary": ["secondaryHorizontalPush", "secondaryVerticalPush"], "extra": ["pushCompounds", "pushAccessories"]},
        {"name": "Squat", "primary": ["primarySquat"], "secondary": [], "extra": ["squatCompounds", "squatAccessories"]},
        {"name": "Pull", "primary": ["primaryHorizontalPull", "primaryVerticalPull"], "secondary": ["secondaryHorizontalPull", "secondaryVerticalPull"], "extra": ["pullCompounds", "pullAccessories"]},
        {"name": "Hinge", "primary": ["primaryHinge"], "secondary": [], "extra": ["hingeCompounds", "hingeAccessories"]},
        {"name": "Upper", "primary": ["secondaryPullCompounds", "secondaryPushCompounds", "upperBodyAccessories"], "secondary": [], "extra": ["primaryHorizontalPush", "primaryVerticalPush", "primaryHorizontalPull", "primaryVerticalPull"]},
        {"name": "Lower", "primary": ["secondarySquat", "secondaryHinge", "lowerBodyAccessories"], "secondary": [], "extra": ["primarySquat", "primaryHinge"]},
      ] },
    } },
    { id: "push_pull_legs_push_pull_legs", daysPerWeek: [6], variants: {
      6: { upperFraction: 0.65, days: [
        {"name": "Push A", "primary": ["primaryHorizontalPush", "secondaryVerticalPush", "pushAccessories"], "secondary": ["secondaryHorizontalPush"], "extra": ["primaryVerticalPush", "secondaryHorizontalPush"]},
        {"name": "Pull A", "primary": ["primaryHorizontalPull", "secondaryVerticalPull", "pullAccessories"], "secondary": ["secondaryHorizontalPull"], "extra": ["primaryVerticalPull", "secondaryHorizontalPull"]},
        {"name": "Legs A", "primary": ["primarySquat", "secondaryHinge", "lowerBodyAccessories"], "secondary": ["secondarySquat"], "extra": ["primaryHinge", "secondarySquat"]},
        {"name": "Push B", "primary": ["primaryVerticalPush", "secondaryHorizontalPush", "pushAccessories"], "secondary": ["secondaryVerticalPush"], "extra": ["primaryHorizontalPush", "secondaryVerticalPush"]},
        {"name": "Pull B", "primary": ["primaryVerticalPull", "secondaryHorizontalPull", "pullAccessories"], "secondary": ["secondaryVerticalPull"], "extra": ["primaryHorizontalPull", "secondaryVerticalPull"]},
        {"name": "Legs B", "primary": ["primaryHinge", "secondarySquat", "lowerBodyAccessories"], "secondary": ["secondaryHinge"], "extra": ["primarySquat", "secondaryHinge"]},
      ] },
    } },
  ].map((split) => {
    Object.freeze(split.daysPerWeek);
    for (const variant of Object.values(split.variants)) {
      for (const day of variant.days) {
        for (const roles of [day.primary, day.secondary, day.extra]) Object.freeze(roles);
        Object.freeze(day);
      }
      Object.freeze(variant.days); Object.freeze(variant);
    }
    Object.freeze(split.variants);
    return Object.freeze(split);
  }));
  const budgets = DEFAULT_POLICY.allocation.budgetMinutesByCeiling;
  const calendar = Object.freeze({ 2: [0, 3], 3: [0, 2, 4], 4: [0, 2, 4, 6], 5: [0, 1, 2, 4, 6], 6: [0, 1, 2, 4, 5, 6] });
  const rolePatterns = {
    primaryPushCompounds: ["primary", ["horizontalPush", "verticalPush"]], primaryPullCompounds: ["primary", ["horizontalPull", "verticalPull"]],
    secondaryPullCompounds: ["secondary", ["horizontalPull", "verticalPull"]],
  };
  for (const type of ["primary", "secondary"]) {
    for (const pattern of orderPatterns) {
      const suffix = pattern === "hipHinge" ? "Hinge" : pattern[0].toUpperCase() + pattern.slice(1);
      rolePatterns[type + suffix] = [type, [pattern]];
    }
  }
  function has(exercise, pattern) {
    return exercise.patterns.includes(pattern) || (pattern === "hipHinge" && exercise.patterns.includes("hinge"));
  }
  function fits(role, template) {
    const exercise = template.exercise;
    const region = exercise.effectiveRegion;
    if (role === "allExercises") return true;
    if (role === "allUpper") return region === "upperBody";
    if (role === "allLower") return region === "lowerBody" || region === "core";
    const regional = { primaryUpperBodyCompounds: ["primary", "upperBody"], secondaryUpperBodyCompounds: ["secondary", "upperBody"], primaryLowerBodyCompounds: ["primary", "lowerBody"], secondaryLowerBodyCompounds: ["secondary", "lowerBody"] }[role];
    if (regional) return template.type === regional[0] && region === regional[1];
    const compound = { pushCompounds: ["horizontalPush", "verticalPush"], pullCompounds: ["horizontalPull", "verticalPull"], squatCompounds: ["squat"], hingeCompounds: ["hipHinge"] }[role];
    if (compound) return ["primary", "secondary"].includes(template.type) && compound.some(pattern => has(exercise, pattern));
    const rule = rolePatterns[role] || (role === "secondaryPushCompounds" ? ["secondary", ["horizontalPush", "verticalPush"]] : null);
    if (rule) return template.type === rule[0] && rule[1].some(pattern => has(exercise, pattern));
    if (template.type !== "accessory") return false;
    if (role === "allAccessories") return true;
    if (role === "upperBodyAccessories") return region === "upperBody";
    if (role === "lowerBodyAccessories") return region === "lowerBody" || region === "core";
    if (role === "pushAccessories") return ["horizontalPush", "verticalPush", "tricepsAccessory", "lateralDeltAccessory", "chestAccessory", "frontDeltAccessory", "serratusAccessory"].some(pattern => has(exercise, pattern));
    if (role === "pullAccessories") return ["horizontalPull", "verticalPull", "rearDeltAccessory", "upperBackAccessory", "latAccessory", "upperTrapAccessory", "bicepsAccessory", "posteriorForearmAccessory", "anteriorForearmAccessory"].some(pattern => has(exercise, pattern));
    const muscles = role === "squatAccessories" ? ["quads", "adductors", "glutes"] : role === "hingeAccessories" ? ["hamstrings", "lowerBack", "glutes"] : [];
    return exercise.patternMuscles.some(muscle => muscles.includes(muscle));
  }
  function anyFit(roles, template) { return roles.some(role => fits(role, template)); }
  function equal(a, b) { return a.exercise === b.exercise && a.numSets === b.numSets && a.type === b.type && a.accessoryMuscle === b.accessoryMuscle; }
  function cost(templates, policy = DEFAULT_POLICY) {
    const model = policy.timeModel;
    return templates.reduce((sum, t) => {
      const region = t.exercise.effectiveRegion;
      if (!["upperBody", "lowerBody", "fullBody", "core"].includes(region)) return sum;
      const isolation = t.type === "accessory" && region !== "core";
      const fixed = isolation ? model.isolationFixedSeconds : model.compoundFixedSeconds;
      const between = region === "core" ? model.coreRestSeconds : isolation ? model.isolationRestSeconds : region === "upperBody" ? model.upperRestSeconds : model.lowerRestSeconds;
      const rest = policy.prescription.restSeconds[t.type === "accessory" ? "accessory" : "compound"];
      return sum + model.perExerciseOverheadSeconds + fixed + model.secondsPerSet * t.numSets + (rest === null ? between : rest) * Math.max(0, t.numSets - 1);
    }, 0);
  }
  // Explicit rest edits are a Taurifer override on the recovered default cost.
  // Generation itself passes no overrides and continues to use cost().
  function estimateTemplatesSeconds(templates, policy = DEFAULT_POLICY) {
    const model = policy.timeModel;
    return cost(templates, policy) + templates.reduce((total, template) => {
      const region = template.exercise.effectiveRegion;
      if (!["upperBody", "lowerBody", "fullBody", "core"].includes(region)) return total;
      const isolation = template.type === "accessory" && region !== "core";
      const between = region === "core" ? model.coreRestSeconds : isolation ? model.isolationRestSeconds : region === "upperBody" ? model.upperRestSeconds : model.lowerRestSeconds;
      return total + (template.restSecondsBySet || []).slice(0, Math.max(0, template.numSets - 1))
        .reduce((delta, seconds) => delta + (Number.isFinite(seconds) ? seconds - (policy.prescription.restSeconds[template.type === "accessory" ? "accessory" : "compound"] ?? between) : 0), 0);
    }, 0);
  }
  function allocations(budgetMinutes, goal, dayCount, upperFraction, policy) {
    const model = policy.timeModel;
    const compounds = [];
    for (let count = 1; count <= 4; count++) for (let sets = 2; sets <= (count === 1 ? 2 : 3); sets++) compounds.push([count, sets, 0, 0]);
    for (let count = 1; count <= 4; count++) for (const sets of [2, 3]) compounds.push([4, 3, count, sets]);
    compounds.push([4, 4, 4, 4], [4, 4, 5, 3], [4, 4, 5, 4]);
    for (const count of [6, 7, 8]) compounds.push([4, 4, count, 4]);
    compounds.push([4, 5, 8, 4], [4, 5, 8, 5]);
    for (let count = 9; count <= 16; count++) compounds.push([4, 5, count, 5]);
    const isolations = [];
    for (let count = 1; count <= 42; count++) {
      for (let sets = count <= 20 ? 2 : count <= 30 ? 3 : 4; sets <= (count < 20 ? 3 : count < 30 ? 4 : 5); sets++) isolations.push([count, sets, 0, 0]);
    }
    function setsFor(a) { return [...Array(a[0]).fill(a[1]), ...Array(a[2]).fill(a[3])]; }
    function allocationCost(a, between, fixed) { return setsFor(a).reduce((n, s) => n + model.perExerciseOverheadSeconds + fixed + model.secondsPerSet * s + between * Math.max(0, s - 1), 0); }
    function choose(rows, target, between, fixed, first) {
      let best = null; let distance = Infinity;
      for (const a of rows) {
        const d = Math.abs(Math.trunc((target - allocationCost(a, between, fixed) * 1000000) / 1000));
        if (d < distance || (!first && d === distance)) { best = a; distance = d; }
      }
      return best.slice();
    }
    const result = {};
    for (const [name, between, minimum] of [["upper", policy.prescription.restSeconds.compound ?? model.upperRestSeconds, 4], ["lower", policy.prescription.restSeconds.compound ?? model.lowerRestSeconds, 2]]) {
      const partition = Math.round(budgetMinutes * 60000000 * dayCount * (name === "upper" ? upperFraction : 1 - upperFraction));
      const compoundTarget = Math.round(partition * (goal === "strength" ? policy.allocation.compoundFraction.strength : policy.allocation.compoundFraction.other));
      const compound = choose(compounds.filter(a => a[0] * a[1] + a[2] * a[3] >= minimum), compoundTarget, between, model.compoundFixedSeconds, false);
      const isolation = choose(isolations, partition - allocationCost(compound, between, model.compoundFixedSeconds) * 1000000, policy.prescription.restSeconds.accessory ?? model.isolationRestSeconds, model.isolationFixedSeconds, true);
      result[name] = { compound, isolation };
    }
    return result;
  }
  function bisect(total) { const first = Math.round(total / 2); return [first, total - first]; }
  function splitSets(total) {
    if (total === 4) return [2, 2];
    const factor = 1.884 * Math.pow(total, -0.673);
    const first = factor > 1 ? total : Math.min(5, Math.round(total * factor));
    const remaining = total - first;
    const count = remaining === 0 ? 0 : remaining <= 3 ? 1 : remaining <= 8 ? 2 : remaining <= 15 ? 3 : remaining <= 19 ? 4 : remaining <= 23 ? 5 : remaining <= 29 ? 6 : remaining <= 35 ? 7 : remaining <= 41 ? 8 : 9;
    const low = count ? Math.floor(remaining / count) : 0;
    const highCount = count ? remaining % count : 0;
    return [first, ...Array(count - highCount).fill(low), ...Array(highCount).fill(low + 1)];
  }
  function produce(selector, allocation, goal) {
    const selected = []; let missing = false;
    const choose = (spec, numSets) => {
      const exercise = selector.choose(spec, selected);
      if (exercise === null) return false;
      selected.push({ exercise, numSets, type: spec.type, accessoryMuscle: spec.muscle || null });
      return true;
    };
    const total = a => a[0] * a[1] + a[2] * a[3];
    const upper = bisect(total(allocation.upper.compound)).flatMap(bisect);
    const lower = bisect(total(allocation.lower.compound));
    [...upper, ...lower].forEach((sets, index) => {
      splitSets(sets).forEach((numSets, occurrence) => {
        if (!choose({ type: occurrence === 0 ? "primary" : "secondary", pattern: patterns[index], isFirstOfType: occurrence <= 1 }, numSets)) missing = true;
      });
    });
    const p = selector.priorities; const depriority = new Set(selector.depriorities);
    const [a, b, c] = (goal === "strength" ? strengthDefaults : defaults).map(group => group.filter(m => !p.includes(m)));
    for (const [category, spec] of [["upper", allocation.upper.isolation], ["lower", allocation.lower.isolation]]) {
      const requested = [...Array(spec[0]).fill(spec[1]), ...Array(spec[2]).fill(spec[3])];
      let emitted = 0; let first = true;
      while (emitted < requested.length) {
        const groups = first ? [p, p, a, p, b, p, a, c, p, b] : [p, a, b];
        first = false; let progressed = false;
        for (const muscle of groups.flat()) {
          if (depriority.has(muscle) || (upperMuscles.has(muscle) ? "upper" : "lower") !== category) continue;
          if (choose({ type: "accessory", muscle }, requested[emitted])) { emitted++; progressed = true; }
          if (emitted === requested.length) break;
        }
        if (!progressed) break;
      }
      if (emitted < requested.length) missing = true;
    }
    return { selected, missing };
  }
  function distribute(selected, dayRules) {
    const days = dayRules.map(() => []);
    for (const type of ["primary", "secondary", "accessory"]) {
      const cursors = new Map(); const occurrences = new Map();
      for (const t of selected.filter(t => t.type === type)) {
        const role = dayRules.flatMap(d => d.primary).find(r => fits(r, t)) || null;
        let candidates = dayRules.map((d, i) => anyFit(d.primary, t) ? i : null).filter(i => i !== null);
        if (!candidates.length) candidates = dayRules.map((_, index) => index);
        const cursor = cursors.get(role) || 0;
        let offset = 0; let minimum = Infinity;
        for (let i = 0; i < candidates.length; i++) {
          const count = t.accessoryMuscle === null ? 0 : days[candidates[(cursor + i) % candidates.length]].filter(x => x.accessoryMuscle === t.accessoryMuscle).length;
          if (count < minimum) { minimum = count; offset = i; }
        }
        let day = candidates[(cursor + offset) % candidates.length];
        const pattern = type === "secondary" ? patterns.find(p => has(t.exercise, p)) : null;
        const occurrence = pattern ? (occurrences.get(pattern) || 0) + 1 : null;
        if (occurrence > 1 && occurrence % 2 === 1) {
          const preferred = dayRules.findIndex(d => anyFit(d.secondary, t));
          if (preferred >= 0) day = preferred;
        }
        if (!days[day].some(x => equal(x, t))) {
          days[day].push(t); cursors.set(role, cursor + offset + 1);
          if (pattern) occurrences.set(pattern, occurrence);
        }
      }
    }
    return days;
  }
  function spillover(days, dayRules, policy) {
    for (let iteration = 0; iteration < 200; iteration++) {
      const durations = days.map(templates => cost(templates, policy)); const ordered = days.map((_, index) => index).sort((a, b) => durations[a] - durations[b]);
      if (Math.round(1.25 * durations[ordered[0]]) >= durations[ordered[ordered.length - 1]]) return;
      const candidates = [];
      for (const source of ordered.slice().reverse()) for (const template of days[source].slice().reverse()) {
        const value = cost([template], policy);
        for (const dest of ordered) {
          const gap = durations[source] - durations[dest];
          if (value > 0 && gap > value) candidates.push({ source, dest, template, preferred: anyFit(dayRules[dest].extra, template), improvement: 2 * Math.trunc(value * 1000) * Math.trunc((gap - value) * 1000) });
        }
      }
      const accessories = candidates.filter(x => x.template.type === "accessory");
      const typed = accessories.length ? accessories : candidates;
      const preferred = typed.filter(candidate => candidate.preferred);
      const pool = preferred.length ? preferred : typed;
      if (!pool.length) return;
      let best = pool[0];
      for (const candidate of pool) if (candidate.improvement > best.improvement) best = candidate;
      const index = days[best.source].findIndex(t => equal(t, best.template));
      days[best.source].splice(index, 1); days[best.dest].push(best.template);
    }
  }
  function variant(t) {
    const e = t.exercise; const joints = e.primaryJointActions;
    if (t.accessoryMuscle === "hamstrings") return has(e, "hamstringAccessory") && joints.includes("kneeFlexion") ? true : has(e, "hamstringAccessory") && joints.includes("hipExtension") ? false : null;
    if (t.accessoryMuscle === "quads") return has(e, "quadAccessory") && joints.includes("kneeExtension") ? true : has(e, "lungeOrSplitSquatOrStepUpOrSingleLegSquat") ? false : null;
    if (t.accessoryMuscle === "lats") return has(e, "latAccessory") && e.exerciseType === "singleJoint" ? true : has(e, "latAccessory") && e.exerciseType === "multiJoint" ? false : null;
    return null;
  }
  function score(templates) {
    const xs = templates.filter(t => t.type === "accessory"); let overlaps = 0; let repeats = 0;
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
      const a = xs[i]; const b = xs[j];
      if (a.exercise.exclusionGroupings.some(g => b.exercise.exclusionGroupings.includes(g))) overlaps++;
      const classification = variant(a);
      if (a.accessoryMuscle === b.accessoryMuscle && classification !== null && classification === variant(b)) repeats++;
    }
    return [overlaps, repeats];
  }
  function optimize(days, dayRules) {
    for (let iteration = 0; iteration < 100; iteration++) {
      const old = days.map(score); let best = null;
      for (let i = 0; i < days.length; i++) for (let j = i + 1; j < days.length; j++) {
        for (let k = 0; k < days[i].length; k++) for (let l = 0; l < days[j].length; l++) {
          const a = days[i][k]; const b = days[j][l];
          if (a.type !== "accessory" || b.type !== "accessory" || a.accessoryMuscle === null || a.accessoryMuscle !== b.accessoryMuscle || a.numSets !== b.numSets || a.exercise.effectiveRegion !== b.exercise.effectiveRegion) continue;
          if (!anyFit(dayRules[i].primary, b) || !anyFit(dayRules[j].primary, a)) continue;
          const one = days[i].slice(); const two = days[j].slice(); one[k] = b; two[l] = a;
          const s1 = score(one); const s2 = score(two);
          const o = old[i][0] + old[j][0] - s1[0] - s2[0]; const r = old[i][1] + old[j][1] - s1[1] - s2[1];
          if (!(o > 0 || (o === 0 && r > 0))) continue;
          if (!best || o > best.o || (o === best.o && r > best.r)) best = { i, j, k, l, o, r };
        }
      }
      if (!best) return;
      const { i, j, k, l } = best; [days[i][k], days[j][l]] = [days[j][l], days[i][k]];
    }
  }
  function group(templates, key) {
    const groups = new Map();
    for (const t of templates) { const k = key(t); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
    return groups;
  }
  function rr(groups) {
    const output = []; const maximum = Math.max(0, ...groups.map(g => g.length));
    for (let index = 0; index < maximum; index++) for (const g of groups) if (index < g.length) output.push(g[index]);
    return output;
  }
  function finish(templates, priorities, defaultGroups) {
    const key = t => { const index = orderPatterns.findIndex(p => has(t.exercise, p)); return index < 0 ? 12 : index + (t.type === "secondary" ? 6 : 0); };
    const primary = templates.filter(t => t.type === "primary").sort((a, b) => key(a) - key(b));
    const secondary = [...group(templates.filter(t => t.type === "secondary"), key)].sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const accessory = [...group(templates.filter(t => t.type === "accessory"), t => t.accessoryMuscle)];
    const priority = accessory.filter(([m]) => priorities.includes(m)).map(x => x[1]);
    const rest = accessory.filter(([m]) => !priorities.includes(m));
    const [a, b, c] = defaultGroups.map(ds => rest.filter(([m]) => ds.includes(m)).map(x => x[1]));
    return [...primary, ...rr(secondary), ...rr([rr(priority), rr(a)]), ...rr(b), ...rr(c)];
  }
  function supportsRequest(request) {
    if (!request || !SPLITS.some(split => split.id === request.split && split.daysPerWeek.includes(request.daysPerWeek))
      || !["hybrid", "hypertrophy", "strength"].includes(request.goal)
      || !["beginner", "intermediate", "advanced"].includes(request.experience)
      || !Number.isInteger(request.timeCeilingMinutes) || !Object.hasOwn(budgets, request.timeCeilingMinutes)
      || !["static", "linear", "reverse_linear", "undulating"].includes(request.periodization)
      || !Array.isArray(request.deloadCycles)) return false;
    // Plan 076: four to ten regular weeks and at most one lighter week, first or last.
    const deload = request.deloadCycles, regular = request.cycles - deload.length;
    return Number.isInteger(request.cycles) && regular >= 4 && regular <= 10
      && (deload.length === 0 || deload.length === 1 && (deload[0] === 1 || deload[0] === request.cycles));
  }
  function generate(request, selector, { enginePolicy = DEFAULT_POLICY, diagnostics } = {}) {
    const supported = supportsRequest(request);
    const priorities = selector?.priorities; const depriorities = selector?.depriorities;
    if (!supported || !Array.isArray(priorities) || !Array.isArray(depriorities) || !priorities.every(m => allMuscles.has(m)) || !depriorities.every(m => allMuscles.has(m)) || priorities.some(m => depriorities.includes(m))) return { status: "unsupported", code: "unsupported_generation_domain" };
    const budgetMinutes = enginePolicy.allocation.budgetMinutesByCeiling[request.timeCeilingMinutes];
    const variant = SPLITS.find(split => split.id === request.split).variants[request.daysPerWeek];
    const dayRules = variant.days;
    const allocation = allocations(budgetMinutes, request.goal, request.daysPerWeek, variant.upperFraction, enginePolicy); const { selected, missing } = produce(selector, allocation, request.goal);
    const occurrences = new Map();
    const records = diagnostics ? selected.map(template => {
      const identity = `${template.type}:${template.accessoryMuscle || patterns.find(pattern => has(template.exercise, pattern)) || "other"}`;
      const occurrence = (occurrences.get(identity) || 0) + 1; occurrences.set(identity, occurrence);
      return { template, lineage: `template:${identity}:${occurrence}`, baseSetCount: template.numSets };
    }) : null;
    for (const template of selected) {
      const override = enginePolicy.volume.setsByType[template.type];
      template.numSets = Math.max(1, (override || template.numSets) - (request.experience === "beginner" ? enginePolicy.volume.beginnerSetReduction : 0));
    }
    const days = distribute(selected, dayRules);
    if (records) for (const record of records) record.initialDayIndex = days.findIndex(day => day.includes(record.template));
    spillover(days, dayRules, enginePolicy); optimize(days, dayRules);
    const ordered = days.map(t => finish(t, priorities, request.goal === "strength" ? strengthDefaults : defaults));
    const insufficient = missing || ordered.flat().length < selected.length;
    return { status: insufficient ? "insufficient" : "ok", ...(insufficient ? { issues: [{ code: "insufficient_candidates" }] } : {}), days: ordered.map((templates, index) => ({ name: dayRules[index].name, templates })), weeklySlots: Array.from({ length: 7 }, (_, index) => { const day = calendar[request.daysPerWeek].indexOf(index); return day < 0 ? null : day; }), budgetMinutes, allocations: allocation, estimatedSessionSeconds: ordered.map(templates => cost(templates, enginePolicy)), ...(records ? { diagnosticRecords: records } : {}) };
  }
  const api = Object.freeze({ generate, SPLITS, supportsRequest, estimateTemplatesSeconds });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RepForgeGenerationLayout = api;
})(typeof window !== "undefined" ? window : globalThis);
