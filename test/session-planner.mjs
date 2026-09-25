#!/usr/bin/env node
// Deterministic Free one-off generation and planned-session adaptation
// (one-off spec §7.3, §8.2, §8.4–§8.6, §9, §17.1). Pure Node.
import { createRequire } from "node:module";
import fc from "fast-check";

const require = createRequire(import.meta.url);
const Planner = require("../session-planner.js");
const Compiler = require("../program-compiler.js");
const Intent = require("../session-intent.js");
const { EXERCISE_LIBRARY, LEGACY_LIBRARY_IDS } = require("../exercises.js");
const { MUSCLE_TOKENS } = require("../program-entry.js");

const results = { passed: 0, failed: 0 };
function assert(condition, name, detail = "") {
  if (condition) {
    results.passed++;
    console.log(`  ✓ ${name}`);
    return;
  }
  results.failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}
function property(name, arbitrary, predicate, numRuns = 150) {
  const outcome = fc.check(fc.property(arbitrary, predicate), { numRuns, seed: 57057 });
  assert(!outcome.failed, `property: ${name}`, outcome.failed ? `counterexample ${JSON.stringify(outcome.counterexample)}` : "");
}
const json = (value) => JSON.stringify(value);
function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

const CUSTOM = [
  { id: "custom:sled", name: "Sled push", primary: "Quads", secondary: "Glutes", equipment: [], created: "2026-01-01" },
  { id: "custom:landmine", name: "Landmine press", primary: "Front delts", secondary: "Chest,Triceps",
    equipment: ["barbell"], patterns: ["shoulder_press"], created: "2026-01-02" },
];
const catalogue = Planner.normalizeCatalogue(EXERCISE_LIBRARY, CUSTOM);
const libraryById = new Map(EXERCISE_LIBRARY.map((entry) => [entry.id, entry]));
const CODES = Intent.EQUIPMENT_CODES;
const CLASSICS = Object.keys(Planner.CLASSIC_BLUEPRINTS);
const fullGym = [...CODES];

console.log("equipment vocabulary");
{
  assert(json(Planner.programEquipmentCodes(["machines", "dumbbells", "bodyweight"]).equipment) === json(["dumbbell", "machine", "bodyweight"]),
    "plural program equipment maps explicitly to catalogue codes");
  const partial = Planner.programEquipmentCodes(["cables", "kettlebells"]);
  assert(partial.known && json(partial.equipment) === json(["cable"]) && json(partial.unmapped) === json(["kettlebells"]),
    "an unmapped program value is reported, never guessed");
  const same = Planner.expandEquipmentShortcut("same_as_program", { programEquipment: ["barbells", "cables"] });
  assert(same.ok && same.editable && json(same.equipment) === json(["barbell", "cable"]), "Same as my program expands to an editable exact inventory");
  assert(!Planner.expandEquipmentShortcut("same_as_program", { programEquipment: [] }).ok,
    "Same as my program without program equipment is an explicit failure");
  const hotel = Planner.expandEquipmentShortcut("hotel_basic");
  assert(hotel.ok && hotel.equipment.every((code) => CODES.includes(code)) && !hotel.equipment.includes("barbell"),
    "Hotel/basic gym is only a starting checklist of catalogue codes");
  assert(Planner.expandEquipmentShortcut("customize").equipment.length === 0, "Customize starts empty and must be filled");
  assert(!Planner.expandEquipmentShortcut("my-hotel").ok, "there are no named or saved equipment profiles");
  for (const shortcut of Object.keys(Planner.EQUIPMENT_SHORTCUTS)) {
    assert(Planner.EQUIPMENT_SHORTCUTS[shortcut].every((code) => CODES.includes(code)), `shortcut ${shortcut} uses only catalogue codes`);
  }
  const libraryCodes = new Set(EXERCISE_LIBRARY.flatMap((entry) => entry.equipment));
  assert([...libraryCodes].every((code) => CODES.includes(code)) && CODES.every((code) => libraryCodes.has(code)),
    "the canonical code list is exactly the exercise library's equipment vocabulary");
}

console.log("constraint normalization");
{
  const ok = Planner.normalizeConstraints({ minutes: 45, equipment: ["cable", "dumbbell"], minimizeEquipmentChanges: true });
  assert(ok.ok && json(ok.constraints) === json({ minutes: 45, equipment: ["dumbbell", "cable"], minimizeEquipmentChanges: true }),
    "valid constraints normalize to canonical order");
  const bad = [
    { minutes: 50, equipment: ["cable"] },
    { minutes: 45, equipment: [] },
    { minutes: 45, equipment: ["dumbbells"] },
    { minutes: 45, equipment: "cable" },
    { minutes: "45", equipment: ["cable"] },
    { minutes: 45, equipment: ["cable"], minimizeEquipmentChanges: 1 },
    { minutes: 45, equipment: ["cable"], gymName: "Hotel Rio" },
  ];
  for (const value of bad) assert(!Planner.normalizeConstraints(value).ok, `rejects malformed constraints ${json(value)}`);
  assert(!Planner.normalizeConstraints(null).ok, "rejects missing constraints object");
  assert(!Planner.planClassic({ catalogue, classic: "push", constraints: { minutes: 45 }, restSeconds: 120 }).ok,
    "generation requires an explicit equipment selection");
  const empty = Planner.planClassic({ catalogue, classic: "push", constraints: { minutes: 45, equipment: [] }, restSeconds: 120 });
  assert(!empty.ok && empty.code === "invalid-constraints", "an empty equipment selection is a constraint failure, never 'ignore equipment'");
}

console.log("classic sessions");
{
  for (const classic of CLASSICS) {
    const blueprint = Planner.CLASSIC_BLUEPRINTS[classic];
    const result = Planner.planClassic({ catalogue, classic, constraints: { minutes: 90, equipment: fullGym }, restSeconds: 120 });
    const plan = result.plan;
    const purposes = new Set(plan?.exercises.map((exercise) => exercise.purpose));
    assert(result.ok && blueprint.slots.filter((item) => item.required).every((item) => purposes.has(item.id)),
      `${classic}: a full gym with time preserves every required slot`, json(result));
    assert(plan.context.sessionKind === "one_off" && plan.context.oneOffIntent === "classic" &&
      plan.context.generation.blueprintId === blueprint.id && plan.context.generation.blueprintVersion === blueprint.version &&
      plan.context.generation.catalogVersion === catalogue.version, `${classic}: the plan records blueprint, engine and catalogue versions`);
    assert(!plan.effect.countsAsProgramDay && !plan.effect.progressionEligible, `${classic}: the plan states it is not a program day`);
  }
  const tight = Planner.planClassic({ catalogue, classic: "full_body", constraints: { minutes: 20, equipment: fullGym }, restSeconds: 120 });
  assert(!tight.ok && tight.code === "time-infeasible" && tight.minimumMinutes > 20 && tight.suggestion,
    "a 20-minute Full body explains the limit instead of creating token sets");
  const noSquat = Planner.planClassic({ catalogue, classic: "lower", constraints: { minutes: 60, equipment: ["cable"] }, restSeconds: 120 });
  assert(!noSquat.ok && noSquat.code === "equipment-unsupported-focus" && noSquat.purposes.includes("knee"),
    "an unsupported focus names the purpose and keeps the equipment filter");
  assert(!Planner.planClassic({ catalogue, classic: "bro_split", constraints: { minutes: 45, equipment: fullGym } }).ok,
    "an unknown blueprint is rejected");
  const named = Planner.planClassic({ catalogue, classic: "push", name: "Empurrar", constraints: { minutes: 45, equipment: fullGym }, restSeconds: 120 });
  assert(named.ok && named.plan.context.name === "Empurrar", "the caller-localized name is the saved label");
}

console.log("familiarity, novelty and minimize equipment changes");
{
  const program = [{ id: "p1", day: "Upper A", libraryId: "ip_cb", name: "Cable incline press" }];
  const withProgram = Planner.planClassic({ catalogue, classic: "push", program,
    constraints: { minutes: 60, equipment: fullGym }, restSeconds: 120 });
  assert(withProgram.plan.exercises[0].libraryId === "ip_cb" && withProgram.plan.exercises[0].isNew === false,
    "active-program movements are preferred and not labeled new");
  const history = [{ session: "h1", date: "2026-09-01", performedLibraryId: "sp_db", load: 20, reps: 10 },
    { session: "h2", date: "2026-09-08", performedLibraryId: "sp_db", load: 20, reps: 10,
      sessionKind: "one_off", oneOffIntent: "manual", programCompletionEligible: false, progressionEligible: false }];
  const withHistory = Planner.planClassic({ catalogue, classic: "push", history,
    constraints: { minutes: 60, equipment: fullGym }, restSeconds: 120 });
  assert(withHistory.plan.exercises.some((exercise) => exercise.libraryId === "sp_db" && !exercise.isNew),
    "movements from logged history (one-offs included) count as familiar");
  const cold = Planner.planClassic({ catalogue, classic: "push", constraints: { minutes: 60, equipment: fullGym }, restSeconds: 120 });
  assert(cold.plan.exercises.every((exercise) => exercise.isNew), "with no program or history every generated movement is labeled new");
  const spread = Planner.planClassic({ catalogue, classic: "upper", constraints: { minutes: 90, equipment: ["barbell", "dumbbell", "cable", "machine"] }, restSeconds: 90 });
  const compact = Planner.planClassic({ catalogue, classic: "upper", constraints: { minutes: 90, equipment: ["barbell", "dumbbell", "cable", "machine"], minimizeEquipmentChanges: true }, restSeconds: 90 });
  assert(new Set(compact.plan.exercises.map((exercise) => exercise.station)).size <= new Set(spread.plan.exercises.map((exercise) => exercise.station)).size,
    "Minimize equipment changes does not add stations");
  assert(compact.plan.context.constraints.minimizeEquipmentChanges === true, "the minimize choice is recorded on the plan context");
}

console.log("generation properties (spec §17.1)");
{
  const subsetArb = fc.subarray(CODES, { minLength: 1 });
  const requestArb = fc.record({
    classic: fc.constantFrom(...CLASSICS),
    minutes: fc.constantFrom(...Intent.TIME_BUDGETS),
    equipment: subsetArb,
    minimize: fc.boolean(),
    rest: fc.constantFrom(60, 90, 120, 180),
  });
  const run = (request, extra = {}) => Planner.planClassic({ catalogue: Planner.normalizeCatalogue(EXERCISE_LIBRARY, CUSTOM), classic: request.classic,
    constraints: { minutes: request.minutes, equipment: request.equipment, minimizeEquipmentChanges: request.minimize },
    restSeconds: request.rest, ...extra });
  property("identical inputs and versions produce the identical ordered plan", requestArb,
    (request) => json(run(request)) === json(run(request)));
  property("every generated exercise matches at least one selected equipment code", requestArb, (request) => {
    const result = run(request);
    return !result.ok || result.plan.exercises.every((exercise) =>
      catalogue.get(exercise.libraryId).equipment.some((code) => request.equipment.includes(code)) && request.equipment.includes(exercise.station));
  });
  property("no duplicate instance id or movement identity", requestArb, (request) => {
    const result = run(request);
    if (!result.ok) return true;
    const ids = result.plan.exercises.map((exercise) => exercise.exerciseInstanceId);
    const movements = result.plan.exercises.map((exercise) => exercise.libraryId);
    return new Set(ids).size === ids.length && new Set(movements).size === movements.length &&
      Object.keys(result.plan.context.exercises).length === ids.length;
  });
  property("required blueprint purposes are preserved or generation fails explicitly", requestArb, (request) => {
    const result = run(request);
    const required = Planner.CLASSIC_BLUEPRINTS[request.classic].slots.filter((item) => item.required).map((item) => item.id);
    if (!result.ok) return ["time-infeasible", "equipment-unsupported-focus"].includes(result.code);
    const purposes = new Set(result.plan.exercises.map((exercise) => exercise.purpose));
    return required.every((id) => purposes.has(id));
  });
  property("an accepted plan's estimate never exceeds the selected budget", requestArb, (request) => {
    const result = run(request);
    return !result.ok || request.minutes === 90 || result.plan.estimate.highMinutes <= request.minutes;
  });
  property("time pressure removes optional work before reducing required work, never below two sets", requestArb, (request) => {
    const result = run(request);
    if (!result.ok) return true;
    const blueprint = Planner.CLASSIC_BLUEPRINTS[request.classic];
    const optionalIds = new Set(blueprint.slots.filter((item) => !item.required).map((item) => item.id));
    const optionalIncluded = result.plan.exercises.some((exercise) => optionalIds.has(exercise.purpose));
    return (!optionalIncluded || result.plan.reducedSets.length === 0) && result.plan.exercises.every((exercise) => exercise.sets >= 2);
  });
  property("more time never removes a purpose that fit in less time", requestArb, (request) => {
    const index = Intent.TIME_BUDGETS.indexOf(request.minutes);
    if (index === Intent.TIME_BUDGETS.length - 1) return true;
    const small = run(request), large = run({ ...request, minutes: Intent.TIME_BUDGETS[index + 1] });
    if (!small.ok) return true;
    if (!large.ok) return false;
    const required = new Set(Planner.CLASSIC_BLUEPRINTS[request.classic].slots.filter((item) => item.required).map((item) => item.id));
    const largePurposes = new Set(large.plan.exercises.map((exercise) => exercise.purpose));
    return [...required].every((id) => largePurposes.has(id)) &&
      large.plan.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) >= small.plan.exercises.filter((exercise) => required.has(exercise.purpose)).reduce((sum, exercise) => sum + exercise.sets, 0);
  });
  property("Minimize equipment changes never introduces incompatible equipment", requestArb, (request) => {
    const result = run({ ...request, minimize: true });
    return !result.ok || result.plan.exercises.every((exercise) => request.equipment.includes(exercise.station));
  });
  property("the active program snapshot is never written by generation", requestArb, (request) => {
    const program = deepFreeze([{ id: "p1", day: "A", libraryId: "sq_bb", name: "Barbell back squat", sets: 3, min: 5, max: 8 }]);
    const before = json(program);
    const result = run(request, { program, history: deepFreeze([]) });
    return json(program) === before && (result.ok || typeof result.code === "string");
  });
}

console.log("muscle-focus sessions");
{
  const result = Planner.planMuscleFocus({ catalogue, primaryMuscles: ["Chest"], secondaryMuscles: ["Triceps"],
    constraints: { minutes: 60, equipment: fullGym }, restSeconds: 120 });
  assert(result.ok, "one primary and one secondary focus generate");
  const chest = result.plan.exercises.filter((exercise) => exercise.primary.split(",").includes("Chest"));
  const triceps = result.plan.exercises.filter((exercise) => exercise.primary.split(",").includes("Triceps"));
  assert(chest.length >= 2 && triceps.length >= 1 && chest.length > triceps.length,
    "primary focus receives the larger allocation");
  assert(result.plan.exercises.every((exercise) => exercise.primary.split(",").some((token) => ["Chest", "Triceps"].includes(token))),
    "exercises come from canonical catalogue muscle attribution");
  assert(new Set(result.plan.exercises.map((exercise) => exercise.libraryId)).size === result.plan.exercises.length,
    "the same movement identity is never repeated");
  const chestPatterns = chest.slice(0, 2).map((exercise) => libraryById.get(exercise.libraryId).patterns.join("+"));
  assert(chestPatterns[0] !== chestPatterns[1], "a second primary exercise prefers a different movement pattern");
  const tooMuch = Planner.planMuscleFocus({ catalogue, primaryMuscles: ["Quads"], secondaryMuscles: ["Chest", "Lats"],
    constraints: { minutes: 20, equipment: fullGym }, restSeconds: 180 });
  assert(!tooMuch.ok && tooMuch.code === "time-infeasible" && tooMuch.suggestion === "remove-secondary",
    "when time cannot serve every focus the athlete is asked to remove a secondary focus");
  for (const [label, primary, secondary] of [["no primary", [], []], ["two primaries", ["Chest", "Lats"], []],
    ["three secondaries", ["Chest"], ["Triceps", "Biceps", "Abs"]], ["invented token", ["Pecs"], []],
    ["repeated token", ["Chest"], ["Chest"]], ["group name instead of token", ["arms"], []]]) {
    const invalid = Planner.planMuscleFocus({ catalogue, primaryMuscles: primary, secondaryMuscles: secondary,
      constraints: { minutes: 45, equipment: fullGym } });
    assert(!invalid.ok && invalid.code === "invalid-focus", `rejects ${label}`);
  }
  const bodyweightOnly = Planner.planMuscleFocus({ catalogue, primaryMuscles: ["Adductors"], constraints: { minutes: 45, equipment: ["bodyweight"] } });
  assert(!bodyweightOnly.ok && bodyweightOnly.code === "equipment-unsupported-focus", "an equipment-impossible focus fails explicitly");
  property("every canonical muscle either generates within equipment or fails explicitly",
    fc.record({ muscle: fc.constantFrom(...MUSCLE_TOKENS), equipment: fc.subarray(CODES, { minLength: 1 }), minutes: fc.constantFrom(...Intent.TIME_BUDGETS) }),
    ({ muscle, equipment, minutes }) => {
      const plan = Planner.planMuscleFocus({ catalogue, primaryMuscles: [muscle], constraints: { minutes, equipment }, restSeconds: 120 });
      if (!plan.ok) return ["time-infeasible", "equipment-unsupported-focus"].includes(plan.code);
      return plan.plan.exercises[0] && plan.plan.exercises.some((exercise) => exercise.primary.split(",").includes(muscle)) &&
        plan.plan.exercises.every((exercise) => catalogue.get(exercise.libraryId).equipment.some((code) => equipment.includes(code)));
    });
}

console.log("manual sessions");
{
  const result = Planner.planManual({ catalogue, name: "With Ana",
    exercises: [{ exerciseId: "custom:landmine", sets: 4, minReps: 6, maxReps: 8 }, { exerciseId: "cu_db", sets: 3, minReps: 10, maxReps: 12 }],
    restSeconds: 90 });
  assert(result.ok && result.plan.exercises.map((exercise) => exercise.libraryId).join(",") === "custom:landmine,cu_db",
    "the athlete authors exact order, including custom exercises");
  assert(result.plan.exercises[0].sets === 4 && result.plan.exercises[0].minReps === 6 && result.plan.exercises[0].maxReps === 8,
    "authored sets and target ranges are preserved");
  assert(result.plan.context.constraints === null && result.plan.context.oneOffIntent === "manual" && result.plan.context.name === "With Ana",
    "a manual one-off without constraints records none");
  const legacyAlias = Object.keys(LEGACY_LIBRARY_IDS)[0];
  const alias = Planner.planManual({ catalogue, exercises: [{ exerciseId: legacyAlias, sets: 3, minReps: 8, maxReps: 12 }] });
  assert(!alias.ok && alias.code === "unknown-exercise", "manual identity is exact: legacy aliases and fuzzy names are not accepted");
  assert(Planner.planManual({ catalogue, exercises: [] }).code === "empty-session", "a manual plan must contain work before it can start");
  assert(Planner.planManual({ catalogue, exercises: [{ exerciseId: "cu_db", sets: 3, minReps: 8, maxReps: 12 },
    { exerciseId: "cu_db", sets: 2, minReps: 8, maxReps: 12 }] }).code === "duplicate-movement", "a movement appears once per session");
  assert(Planner.planManual({ catalogue, exercises: [{ exerciseId: "cu_db", sets: 0, minReps: 8, maxReps: 12 }] }).code === "invalid-manual-prescription",
    "zero working sets are rejected");
  assert(Planner.planManual({ catalogue, exercises: [{ exerciseId: "cu_db", sets: 3, minReps: 12, maxReps: 8 }] }).code === "invalid-manual-prescription",
    "an inverted rep range is rejected");
  const mismatch = Planner.planManual({ catalogue, constraints: { minutes: 20, equipment: ["dumbbell"] }, restSeconds: 120,
    exercises: [{ exerciseId: "sq_bb", sets: 5, minReps: 5, maxReps: 5 }, { exerciseId: "custom:sled", sets: 3, minReps: 10, maxReps: 10 },
      { exerciseId: "cu_db", sets: 3, minReps: 10, maxReps: 12 }] });
  const codes = mismatch.plan?.warnings.map((warning) => warning.code) || [];
  assert(mismatch.ok && codes.includes("equipment-mismatch") && codes.includes("equipment-unverified") && codes.includes("time-over-budget"),
    "time and equipment mismatches are shown before start but never block a deliberate manual choice");
}

// A compiled-style program day (priority declared) and a legacy/custom day.
const upperA = deepFreeze([
  { id: "ua-bench", day: "Upper A", order: 1, name: "Barbell bench press", libraryId: "pr_bb", movementId: "library:pr_bb", sets: 4, min: 5, max: 8, primary: "Chest", secondary: "Triceps,Front delts", priority: "protected", minSets: 2 },
  { id: "ua-row", day: "Upper A", order: 2, name: "Barbell row", libraryId: "rw_bb", movementId: "library:rw_bb", sets: 4, min: 6, max: 10, primary: "Mid/upper back", secondary: "Biceps", priority: "protected", minSets: 2 },
  { id: "ua-fly", day: "Upper A", order: 3, name: "Cable fly", libraryId: "ci_cb", movementId: "library:ci_cb", sets: 3, min: 10, max: 15, primary: "Chest", secondary: "", priority: "optional", minSets: 2 },
  { id: "ua-lat", day: "Upper A", order: 4, name: "Dumbbell lateral raise", libraryId: "lr_db", movementId: "library:lr_db", sets: 3, min: 12, max: 20, primary: "Side delts", secondary: "", priority: "reducible", minSets: 2 },
  { id: "ua-curl", day: "Upper A", order: 5, name: "Dumbbell curl", libraryId: "cu_db", movementId: "library:cu_db", sets: 3, min: 10, max: 15, primary: "Biceps", secondary: "Forearms", priority: "optional", minSets: 2 },
]);
const plannedDay = deepFreeze({ programId: "program-a", programFingerprint: "fp-a", dayId: "day-upper-a", dayLabel: "Upper A", exercises: upperA });

console.log("planned-session adaptation (Free, user-directed)");
{
  for (const row of upperA) assert(libraryById.has(row.libraryId), `fixture movement ${row.libraryId} exists in the library`);
  const before = json(plannedDay);
  const timeOnly = Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 30 }, restSeconds: 120 });
  assert(timeOnly.ok && timeOnly.plan.context.sessionKind === "planned_adapted" && timeOnly.plan.effect.countsAsProgramDay,
    "a time-only adaptation that preserves primary purposes counts as the planned session", json(timeOnly));
  const kept = timeOnly.plan.exercises.map((exercise) => exercise.exerciseInstanceId);
  assert(kept.includes("ua-bench") && kept.includes("ua-row"), "primary-purpose work is preserved");
  assert(kept.join(",") === upperA.map((row) => row.id).filter((id) => kept.includes(id)).join(","), "the program day's order is retained");
  const omitted = timeOnly.plan.omitted.map((item) => item.purpose);
  assert(omitted.includes("ua-curl") || omitted.includes("ua-fly"), "optional isolation work is removed first under time pressure");
  assert(timeOnly.plan.exercises.every((exercise) => exercise.exerciseInstanceId.startsWith("ua-")),
    "adapted work keeps the program exercise instance identity");
  assert(json(timeOnly.plan.context.source) === json({ programId: "program-a", programFingerprint: "fp-a", dayId: "day-upper-a", dayLabel: "Upper A" }),
    "the adapted plan names its exact program day");
  assert(json(plannedDay) === before, "adaptation never writes the program snapshot");
  const removedBeforeReduced = timeOnly.plan.reducedSets.length === 0 ||
    upperA.filter((row) => row.priority !== "protected").every((row) => !kept.includes(row.id));
  assert(removedBeforeReduced, "working sets are reduced only after lower-priority exercises are removed");

  const ample = Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 90 }, restSeconds: 120 });
  assert(ample.ok && ample.plan.exercises.length === upperA.length && ample.plan.reducedSets.length === 0,
    "more time is a ceiling, not a quota: nothing is added or removed");

  const dumbbells = Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 90, equipment: ["dumbbell", "bodyweight"] }, restSeconds: 120 });
  assert(dumbbells.ok, "a dumbbell-only adaptation substitutes compatible movements", json(dumbbells));
  const bench = dumbbells.plan.exercises.find((exercise) => exercise.exerciseInstanceId === "ua-bench");
  assert(bench.origin === "substitute" && bench.libraryId === "pr_bb" && bench.replacement &&
    libraryById.get(bench.replacement.libraryId).equipment.some((code) => ["dumbbell", "bodyweight"].includes(code)),
  "a substitution keeps the prescribed identity and carries a compatible performed identity");
  assert(libraryById.get(bench.replacement.libraryId).patterns.some((value) => libraryById.get("pr_bb").patterns.includes(value)) &&
    libraryById.get(bench.replacement.libraryId).primary.split(",").includes("Chest"),
  "a substitute serves the same movement pattern and primary muscle");
  assert(dumbbells.plan.context.exercises["ua-bench"].origin === "substitute" && dumbbells.plan.context.exercises["ua-curl"].origin === "program",
    "the context records which work is exact and which is a session-only substitution");

  const lowerDay = deepFreeze({ programId: "program-a", programFingerprint: "fp-a", dayId: "day-lower-a", dayLabel: "Lower A", exercises: [
    { id: "la-squat", day: "Lower A", name: "Barbell back squat", libraryId: "sq_bb", sets: 3, min: 5, max: 8, primary: "Quads", secondary: "Glutes", priority: "protected" },
    { id: "la-pull", day: "Lower A", name: "Cable pull-through", libraryId: "dld_cb", sets: 3, min: 8, max: 12, primary: "Hamstrings,Glutes", secondary: "", priority: "optional" },
  ] });
  const lost = Planner.adaptPlannedSession({ catalogue, plannedDay: lowerDay, constraints: { minutes: 45, equipment: ["cable"] }, restSeconds: 120 });
  assert(!lost.ok && lost.code === "purpose-not-preserved" && lost.lostPurposes.length > 0,
    "an adaptation that loses a primary purpose is never a planned completion", json(lost));
  assert(lost.lostPurposes.join(",") === "la-squat", "the lost purpose is named");
  assert(!!lost.oneOffAlternative && (lost.oneOffAlternative.context.sessionKind === "one_off" &&
    !lost.oneOffAlternative.effect.countsAsProgramDay &&
    lost.oneOffAlternative.exercises.every((exercise) => exercise.exerciseInstanceId.startsWith("oneoff:"))),
  "the proposed result is offered only as an honest one-off with its own instance identities");

  const cramped = Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 20 }, restSeconds: 180 });
  assert(!cramped.ok && cramped.code === "time-infeasible" && cramped.minimumMinutes > 20,
    "rest is never shortened to fit: an impossible budget fails with the minimum");
  assert(Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: {} }).code === "nothing-to-adapt",
    "an adaptation needs a time or equipment constraint");
  assert(Planner.adaptPlannedSession({ catalogue, plannedDay: { ...plannedDay, dayId: "" }, constraints: { minutes: 30 } }).code === "invalid-planned-day",
    "a malformed source day reference is rejected");
  assert(Planner.adaptPlannedSession({ catalogue, plannedDay: { ...plannedDay, exercises: [...upperA, upperA[0]] }, constraints: { minutes: 30 } }).code === "invalid-planned-day",
    "duplicate program exercise ids are rejected");

  const legacyDay = deepFreeze({ programId: "legacy", programFingerprint: "fp-l", dayId: "day-1", dayLabel: "Day 1", exercises: [
    { id: "l1", day: "Day 1", name: "Leg extension", libraryId: "le_mc", sets: 3, min: 10, max: 15 },
    { id: "l2", day: "Day 1", name: "Sled push", libraryId: "custom:sled", sets: 3, min: 10, max: 10 },
  ] });
  const primary = Planner.primaryPurposes(legacyDay.exercises);
  assert(primary === null, "manual days without declared priority have no invented primary purpose");
  const legacyAdapted = Planner.adaptPlannedSession({ catalogue, plannedDay: legacyDay, constraints: { minutes: 45, equipment: ["machine"] }, restSeconds: 90 });
  assert(!legacyAdapted.ok && legacyAdapted.code === "primary-purpose-undeclared",
    "manual adaptation cannot claim planned completion without a ratified priority rule");
}

console.log("compiler-produced planned days");
for (const familyId of Compiler.FAMILY_IDS) for (const frequency of Compiler.FREQUENCIES) {
  const home = familyId === "home";
  const compiled = Compiler.compile({ schemaVersion: 1, familyId, frequency, sessionMinutes: 90,
    equipment: home ? [] : ["barbell", "dumbbell", "machine", "cable", "smith"],
    environment: home ? [] : ["safe_pull", "training_support"],
    loadIncrements: home ? {} : { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  }, EXERCISE_LIBRARY);
  assert(compiled.kind === "compiled", `${familyId}/${frequency}: compiler produced a program`);
  if (compiled.kind !== "compiled") continue;
  for (const day of compiled.days) {
    const rows = compiled.program.filter((row) => row.dayId === day.dayId);
    const protectedIds = rows.filter((row) => row.priority === "protected").map((row) => row.id);
    const source = { programId: "compiler-program", programFingerprint: "compiler-fingerprint",
      dayId: day.dayId, dayLabel: day.label, exercises: rows };
    const adapted = Planner.adaptPlannedSession({ catalogue, plannedDay: source,
      constraints: { minutes: 90 }, restSeconds: 120 });
    if (!protectedIds.length) {
      assert(!adapted.ok && adapted.code === "primary-purpose-undeclared",
        `${familyId}/${frequency}/${day.dayId}: compiler day without protected slots cannot claim planned completion`);
      continue;
    }
    assert(adapted.ok && protectedIds.every((id) => adapted.plan.context.adaptation.preservedPurposes.includes(id) &&
      adapted.plan.exercises.some((exercise) => exercise.exerciseInstanceId === id)),
    `${familyId}/${frequency}/${day.dayId}: every compiler protected slot survives adaptation`, json(adapted));
    const withoutProtected = { ...source, exercises: rows.filter((row) => row.priority !== "protected") };
    if (protectedIds.length && withoutProtected.exercises.length) {
      const missing = Planner.adaptPlannedSession({ catalogue, plannedDay: withoutProtected,
        constraints: { minutes: 90 }, restSeconds: 120 });
      assert(!missing.ok || !missing.plan.context.adaptation.preservedPurposes.some((id) => protectedIds.includes(id)),
        `${familyId}/${frequency}/${day.dayId}: removed protected input cannot claim the lost slot`);
    }
  }
}

console.log("owner adapters");
{
  const plan = Planner.planClassic({ catalogue, classic: "pull", constraints: { minutes: 45, equipment: fullGym }, restSeconds: 120 }).plan;
  const base = { programId: "program-a", programFingerprint: "fp-a", durableRevision: 4, scheduleDate: "2026-09-24", unit: "kg", rirMode: "numeric" };
  const built = Planner.oneOffDraftContext(plan, base);
  assert(built.ok && built.programContext.dayId === "one-off:classic" && built.programContext.dayLabel === plan.context.name &&
    !Object.hasOwn(built.programContext, "blockId"), "a one-off draft input never impersonates a program day or block");
  assert(built.programContext.exercises.every((exercise) => exercise.progressionStrategy === null),
    "one-off exercises declare no program progression strategy");
  assert(Planner.oneOffDraftContext(Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 30 }, restSeconds: 120 }).plan, base).code === "not-a-one-off-plan",
    "an adapted plan cannot be started as a one-off by accident");
  const adapted = Planner.adaptPlannedSession({ catalogue, plannedDay, constraints: { minutes: 30 }, restSeconds: 120 }).plan;
  const mismatch = Planner.adaptedDraftContext({ programId: "program-a", programFingerprint: "fp-b", dayId: "day-upper-a", dayLabel: "Upper A", exercises: [] }, adapted);
  assert(!mismatch.ok && mismatch.code === "planned-context-mismatch", "a changed program fingerprint rejects a stale adaptation at start");
}

console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
