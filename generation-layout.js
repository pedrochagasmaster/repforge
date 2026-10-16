(function (root) {
  "use strict";
  const patterns = ["horizontalPush", "verticalPush", "horizontalPull", "verticalPull", "squat", "hipHinge"];
  const orderPatterns = ["horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "squat", "hipHinge"];
  const defaults = [
    ["sideDelts", "biceps", "triceps", "chest", "rearDelts", "lats", "calves", "hamstrings", "quads", "abs"],
    ["upperTraps", "upperBack", "forearms", "neck", "abductors", "obliques"],
    ["frontDelts", "glutes", "adductors", "lowerBack"],
  ];
  const upperMuscles = new Set(["triceps", "forearms", "sideDelts", "rearDelts", "upperBack", "neck", "lats", "upperTraps", "biceps", "chest", "frontDelts", "serratus"]);
  const allMuscles = new Set([...defaults.flat(), "serratus", "tibs"]);
  const dayRules = [
    { name: "Upper", primary: ["primaryPushCompounds", "primaryPullCompounds", "secondaryHorizontalPush", "upperBodyAccessories"], secondary: ["secondaryVerticalPush", "secondaryHorizontalPull", "secondaryVerticalPull"] },
    { name: "Lower", primary: ["primarySquat", "primaryHinge", "secondarySquat", "lowerBodyAccessories"], secondary: ["secondaryHinge"] },
    { name: "Full", primary: ["secondaryPullCompounds", "secondaryVerticalPush", "secondaryHinge", "allAccessories"], secondary: ["secondaryHorizontalPush"] },
  ];
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
    const rule = rolePatterns[role];
    if (rule) return template.type === rule[0] && rule[1].some(pattern => has(template.exercise, pattern));
    if (template.type !== "accessory") return false;
    if (role === "allAccessories") return true;
    const region = template.exercise.effectiveRegion;
    return role === "upperBodyAccessories" ? region === "upperBody" : role === "lowerBodyAccessories" && (region === "lowerBody" || region === "core");
  }
  function anyFit(roles, template) { return roles.some(role => fits(role, template)); }
  function equal(a, b) { return a.exercise === b.exercise && a.numSets === b.numSets && a.type === b.type && a.accessoryMuscle === b.accessoryMuscle; }
  function cost(templates) {
    return templates.reduce((sum, t) => {
      const region = t.exercise.effectiveRegion;
      if (!["upperBody", "lowerBody", "fullBody", "core"].includes(region)) return sum;
      const isolation = t.type === "accessory" && region !== "core";
      const fixed = isolation ? 90 : 180;
      const between = region === "core" ? 60 : isolation ? 90 : region === "upperBody" ? 120 : 180;
      return sum + 120 + fixed + 30 * t.numSets + between * Math.max(0, t.numSets - 1);
    }, 0);
  }
  function allocations(budgetMinutes) {
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
    function allocationCost(a, between, fixed) { return setsFor(a).reduce((n, s) => n + 120 + fixed + 30 * s + between * Math.max(0, s - 1), 0); }
    function choose(rows, target, between, fixed, first) {
      let best = null; let distance = Infinity;
      for (const a of rows) {
        const d = Math.abs(Math.trunc((target - allocationCost(a, between, fixed)) * 1000));
        if (d < distance || (!first && d === distance)) { best = a; distance = d; }
      }
      return best.slice();
    }
    const result = {};
    for (const [name, between, minimum] of [["upper", 120, 4], ["lower", 180, 2]]) {
      const compound = choose(compounds.filter(a => a[0] * a[1] + a[2] * a[3] >= minimum), budgetMinutes * 45, between, 180, false);
      const isolation = choose(isolations, budgetMinutes * 90 - allocationCost(compound, between, 180), 90, 90, true);
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
  function produce(selector, allocation) {
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
    const [a, b, c] = defaults.map(group => group.filter(m => !p.includes(m)));
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
  function distribute(selected) {
    const days = dayRules.map(() => []);
    for (const type of ["primary", "secondary", "accessory"]) {
      const cursors = new Map(); const occurrences = new Map();
      for (const t of selected.filter(t => t.type === type)) {
        const role = dayRules.flatMap(d => d.primary).find(r => fits(r, t)) || null;
        let candidates = dayRules.map((d, i) => anyFit(d.primary, t) ? i : null).filter(i => i !== null);
        if (!candidates.length) candidates = [0, 1, 2];
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
  function spillover(days) {
    for (let iteration = 0; iteration < 200; iteration++) {
      const durations = days.map(cost); const ordered = [0, 1, 2].sort((a, b) => durations[a] - durations[b]);
      if (Math.round(1.25 * durations[ordered[0]]) >= durations[ordered[2]]) return;
      const candidates = [];
      for (const source of ordered.slice().reverse()) for (const template of days[source].slice().reverse()) {
        const value = cost([template]);
        for (const dest of ordered) {
          const gap = durations[source] - durations[dest];
          if (value > 0 && gap > value) candidates.push({ source, dest, template, improvement: 2 * Math.trunc(value * 1000) * Math.trunc((gap - value) * 1000) });
        }
      }
      const accessories = candidates.filter(x => x.template.type === "accessory");
      const pool = accessories.length ? accessories : candidates;
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
  function optimize(days) {
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
  function finish(templates, priorities) {
    const key = t => { const index = orderPatterns.findIndex(p => has(t.exercise, p)); return index < 0 ? 12 : index + (t.type === "secondary" ? 6 : 0); };
    const primary = templates.filter(t => t.type === "primary").sort((a, b) => key(a) - key(b));
    const secondary = [...group(templates.filter(t => t.type === "secondary"), key)].sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const accessory = [...group(templates.filter(t => t.type === "accessory"), t => t.accessoryMuscle)];
    const priority = accessory.filter(([m]) => priorities.includes(m)).map(x => x[1]);
    const rest = accessory.filter(([m]) => !priorities.includes(m));
    const [a, b, c] = defaults.map(ds => rest.filter(([m]) => ds.includes(m)).map(x => x[1]));
    return [...primary, ...rr(secondary), ...rr([rr(priority), rr(a)]), ...rr(b), ...rr(c)];
  }
  function generate(request, selector) {
    const profile = request && (request.goal === "hybrid" && (
      request.timeCeilingMinutes === 40 && request.periodization === "static"
      || request.timeCeilingMinutes === 60 && ["static", "linear", "reverse_linear", "undulating"].includes(request.periodization))
      || request.goal === "hypertrophy" && request.timeCeilingMinutes === 60 && request.periodization === "static");
    const supported = profile && request.split === "upper_lower_full" && request.daysPerWeek === 3
      && request.experience === "advanced" && request.cycles === 7 && Array.isArray(request.deloadCycles) && request.deloadCycles.length === 0;
    const priorities = selector?.priorities; const depriorities = selector?.depriorities;
    if (!supported || !Array.isArray(priorities) || !Array.isArray(depriorities) || !priorities.every(m => allMuscles.has(m)) || !depriorities.every(m => allMuscles.has(m)) || priorities.some(m => depriorities.includes(m))) return { status: "unsupported", code: "unsupported_generation_domain" };
    const budgetMinutes = request.timeCeilingMinutes === 40 ? 30 : 50;
    const allocation = allocations(budgetMinutes); const { selected, missing } = produce(selector, allocation);
    const days = distribute(selected); spillover(days); optimize(days);
    const ordered = days.map(t => finish(t, priorities));
    const insufficient = missing || ordered.flat().length < selected.length;
    return { status: insufficient ? "insufficient" : "ok", ...(insufficient ? { issues: [{ code: "insufficient_candidates" }] } : {}), days: ordered.map((templates, index) => ({ name: dayRules[index].name, templates })), weeklySlots: [0, null, 1, null, 2, null, null], budgetMinutes, allocations: allocation, estimatedSessionSeconds: ordered.map(cost) };
  }
  const api = Object.freeze({ generate });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RepForgeGenerationLayout = api;
})(typeof window !== "undefined" ? window : globalThis);
