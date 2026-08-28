import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const Engine = require("../progression-engine.js");
const { EXERCISE_LIBRARY } = require("../exercises.js");
const fixture = JSON.parse(readFileSync(new URL("./fixtures/program-families-v1.json", import.meta.url), "utf8"));

const gymContext = (familyId, frequency, extra = {}) => ({
  schemaVersion: 1, familyId, frequency, sessionMinutes: 90,
  equipment: ["barbell", "dumbbell", "machine", "cable", "smith"],
  environment: ["safe_pull", "training_support"],
  loadIncrements: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 5, smith: 2.5 },
  ...extra,
});
const homeContext = (frequency, extra = {}) => ({
  schemaVersion: 1, familyId: "home", frequency, sessionMinutes: 90,
  equipment: [], environment: [], loadIncrements: {}, ...extra,
});
const getBlueprint = (id) => Compiler.BLUEPRINTS.find((entry) => entry.id === id);
const shape = (id) => getBlueprint(id).days.map((entry) => entry.slots.map((slot) => slot.template).join(",")).join("|");
const allSlots = (instance) => instance.days.flatMap((entry) => entry.slots);
const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const EXACT = {
  growth_2_v1: "knee_growth,horizontal_press,horizontal_pull,hamstring_assistance,lateral_delt,optional_arms|hinge_growth,vertical_pull,incline_press,quad_assistance,delt_mixed,optional_arms",
  growth_3_v1: "knee_growth,horizontal_press,horizontal_pull,hamstring_assistance,lateral_delt,optional_arms|hinge_growth,vertical_pull,vertical_press,quad_assistance,chest,calf|unilateral_knee,incline_press,supported_pull,hip_extension,delt_mixed,optional_arms",
  growth_4_v1: "horizontal_press,horizontal_pull,vertical_pull,chest,lateral_delt,triceps|knee_growth,hinge_growth,unilateral_knee,hamstring_assistance,calf|incline_press,horizontal_pull,vertical_press,vertical_pull,delt_mixed,biceps|hinge_growth,knee_growth,hip_extension,hamstring_assistance,calf",
  growth_5_v1: "horizontal_press,vertical_pull,incline_press,horizontal_pull,lateral_delt,triceps|knee_growth,hinge_growth,unilateral_knee,hamstring_assistance,calf|horizontal_pull,vertical_press,vertical_pull,chest,delt_mixed,biceps|hinge_growth,knee_growth,hip_extension,hamstring_assistance,calf|chest,back,quad_assistance,hamstring_assistance,priority,optional_arms",
  growth_6_v1: "horizontal_press,horizontal_pull,chest,lateral_delt|knee_growth,hamstring_assistance,unilateral_knee,calf|vertical_pull,vertical_press,supported_pull,arms|hinge_growth,quad_assistance,hip_extension,hamstring_assistance|chest,back,delt_mixed,priority|quad_assistance,hamstring_assistance,unilateral_knee,calf",
  balanced_2_v1: "knee_anchor,horizontal_press,horizontal_pull,hamstring_assistance,optional_arms|press_anchor,hinge_growth,vertical_pull,knee_volume,back",
  balanced_3_v1: "knee_anchor,press_anchor,horizontal_pull,hamstring_assistance,lateral_delt|hinge_growth,vertical_pull,vertical_press,unilateral_knee,arms|knee_volume,press_volume,horizontal_pull,hip_extension,back",
  balanced_4_v1: "knee_anchor,hinge_growth,unilateral_knee,calf|press_anchor,vertical_pull,horizontal_pull,triceps|hinge_growth,knee_volume,hamstring_assistance,hip_extension|press_volume,horizontal_pull,vertical_press_or_pull,delt_mixed",
  balanced_5_v1: "knee_anchor,hinge_growth,unilateral_knee,calf|press_anchor,vertical_pull,supported_pull,triceps|hip_extension,chest,pull_mixed,lateral_delt,rear_delt|hinge_growth,knee_volume,hamstring_assistance,calf|press_volume,vertical_pull,vertical_press,supported_pull,arms",
  balanced_6_v1: "knee_anchor,hamstring_assistance,unilateral_knee,calf|press_anchor,vertical_pull,supported_pull,triceps|hip_extension,chest,back,lateral_delt|hinge_growth,knee_volume,hamstring_assistance,calf|press_volume,vertical_press_or_pull,horizontal_pull,biceps|quad_assistance,chest,back,priority",
  strength_2_v1: "knee_effort,press_volume,pull_mixed,hip_extension,optional_arms|press_effort,hinge_effort,knee_volume,pull_mixed,optional_arms",
  strength_3_v1: "knee_effort,press_volume,horizontal_pull,hamstring_assistance,optional_arms|press_effort,hinge_volume,vertical_pull,unilateral_knee,optional_arms|hinge_effort,knee_volume,vertical_press,horizontal_pull,optional_arms",
  strength_4_v1: "knee_effort,hip_extension,unilateral_knee,hamstring_assistance|press_effort,vertical_pull,horizontal_pull,triceps|hinge_effort,knee_volume,hamstring_assistance,calf|press_volume,vertical_press,pull_mixed,biceps",
  strength_5_v1: "knee_effort,hip_extension,unilateral_knee,hamstring_assistance|press_effort,vertical_pull,horizontal_pull,triceps|hinge_effort,knee_volume,hamstring_assistance,calf|press_volume,vertical_press,horizontal_pull,biceps|unilateral_knee,hip_extension,chest,back,lateral_delt,optional_arms",
  strength_6_v1: "knee_effort,hip_extension,unilateral_knee,trunk|press_effort,vertical_pull,supported_pull,triceps|hinge_effort,quad_assistance,hamstring_assistance,calf|knee_volume,hinge_volume,unilateral_knee,trunk|press_volume,vertical_press,horizontal_pull,biceps|quad_assistance,chest,back,lateral_delt,optional_arms",
  home_2_v1: "home_knee,home_push,unilateral_knee,home_posterior,home_trunk,home_pull|unilateral_knee,home_push,home_posterior,home_calf,home_trunk,home_pull",
  home_3_v1: "home_knee,home_push,unilateral_knee,home_posterior,home_trunk|unilateral_knee,home_push,home_posterior,home_pull,home_lateral|home_knee,home_push,home_posterior,home_pull,home_calf",
  home_4_v1: "home_knee,home_push,unilateral_knee,home_trunk|home_posterior,home_pull,unilateral_knee,home_calf|unilateral_knee,home_push,home_posterior,home_trunk|home_coverage,home_pull,home_posterior,home_coverage",
  home_5_v1: "home_knee,home_push,home_trunk|home_posterior,home_pull|unilateral_knee,home_push|home_posterior,home_pull,home_trunk|home_coverage,home_coverage,home_coverage",
  home_6_v1: "home_knee,home_push,home_trunk|home_posterior,home_pull,home_coverage|unilateral_knee,home_push,home_trunk|home_posterior,home_pull,home_coverage|home_coverage,home_posterior,home_trunk|home_coverage,home_coverage,home_coverage",
};

assert.deepEqual(Compiler.validateBlueprints(), { ok: true, count: 20 });
assert.equal(Compiler.BLUEPRINTS.length, 20);
assert.deepEqual(Object.keys(EXACT).sort(), Compiler.BLUEPRINTS.map((entry) => entry.id).sort());
for (const [id, expected] of Object.entries(EXACT)) assert.equal(shape(id), expected, `${id} exact authored structure`);
assert(Compiler.BLUEPRINTS.every((entry) => entry.kind === "authored_sibling"));
assert.deepEqual(Compiler.FAMILY_IDS, ["growth", "balanced", "strength", "home"]);
assert.deepEqual(fixture.publicGoals.map((goal) => goal.en), ["Build Muscle", "Muscle + Strength", "Strength Priority"]);
assert.equal(fixture.limitedEquipmentPromise.en, "Train Anywhere");
assert.equal(fixture.families.find((family) => family.id === "home").publicGoal, null);
assert.deepEqual(fixture.engineContract.strategies, ["range@1", "rep_goal@1", "effort_target@1", "anchor_backoff@1", "manual@1"]);
assert(!owns(fixture.rules, "allocation"));
assert.deepEqual(fixture.rules.reductionOrder, ["remove_optional", "efficient_two_set", "trim_reducible_assistance", "conflict"]);

for (const [id, contract] of Object.entries(Compiler.SLOT_TEMPLATES)) {
  assert(Array.isArray(contract.patterns) && contract.patterns.length, `${id} has movement patterns`);
  assert(Array.isArray(contract.primaryMuscles) && contract.primaryMuscles.length, `${id} has primary muscle intent`);
  assert(owns(contract, "requiredCharacteristics"), `${id} separates requirements`);
  assert(owns(contract, "preferredCharacteristics"), `${id} separates preferences`);
  assert(!owns(contract, "fatigueScore"), `${id} has no fake fatigue score`);
  assert(contract.prescriptionClasses.length, `${id} has compatible prescriptions`);
  assert(contract.strategies.every((strategy) => Compiler.STRATEGIES.includes(strategy)), `${id} uses supported strategies`);
}

const compiled = [];
for (const familyId of Compiler.FAMILY_IDS) {
  for (const frequency of Compiler.FREQUENCIES) {
    const context = familyId === "home" ? homeContext(frequency) : gymContext(familyId, frequency);
    const first = Compiler.compile(context, EXERCISE_LIBRARY);
    const second = Compiler.compile(context, EXERCISE_LIBRARY);
    assert.equal(first.kind, "compiled", `${familyId} ${frequency} compiles`);
    assert.deepEqual(second, first, `${familyId} ${frequency} deterministic`);
    assert.equal(first.frequency, frequency, `${familyId} ${frequency} preserves frequency`);
    assert.equal(first.days.length, frequency, `${familyId} ${frequency} day count`);
    assert.equal(new Set(first.days.map((entry) => entry.dayId)).size, frequency, `${familyId} ${frequency} stable day ids`);
    assert.equal(new Set(allSlots(first).map((entry) => entry.slotId)).size, allSlots(first).length, `${familyId} ${frequency} stable slot ids`);
    assert.equal(first.weeks.length, 6);
    assert(first.weeks.every((week) => week.days.map((entry) => entry.dayId).join() === first.days.map((entry) => entry.dayId).join()), `${familyId} ${frequency} has no structural drift`);
    assert(!JSON.stringify(first).toLowerCase().includes("deload"), `${familyId} ${frequency} schedules no deload`);
    assert(owns(first.directIndirectExposure, "direct") && owns(first.directIndirectExposure, "indirect"));
    for (const resolved of allSlots(first)) {
      assert(resolved.prescription.sets >= 1 && resolved.prescription.sets <= 3, `${resolved.slotId} set bound`);
      if (resolved.role === "heavy_primary") {
        assert(resolved.prescription.repMin >= 3 && resolved.prescription.repMax <= 6);
        assert(resolved.prescription.restMinimumSeconds >= 120);
      }
      if (resolved.role === "isolation_accessory") assert(resolved.prescription.repMax <= 15, `${resolved.slotId} isolation ceiling`);
      assert(Engine.validatePrescription(resolved.prescription.progression).ok, `${resolved.slotId} executable progression`);
    }
    compiled.push(first);
  }
}
assert.equal(compiled.length, 20);
assert.deepEqual(fixture.reviewCompilations.map((entry) => entry.blueprintId), Compiler.BLUEPRINTS.map((entry) => entry.id));

const preferred = Compiler.compile(gymContext("growth", 2, { preferences: ["sq_sm"], history: [{ libraryId: "sq_lp" }] }), EXERCISE_LIBRARY);
assert.equal(preferred.days[0].slots[0].exercise.id, "sq_sm", "explicit preference outranks history");
const disliked = Compiler.compile(gymContext("growth", 2, { preferences: ["sq_sm"], dislikes: ["sq_sm"], history: [{ libraryId: "sq_lp" }] }), EXERCISE_LIBRARY);
assert.equal(disliked.days[0].slots[0].exercise.id, "sq_lp", "a dislike excludes the preferred candidate and exact history wins");
assert.notEqual(disliked.days[0].slots[0].exercise.id, "sqk_mc", "machine history never transfers to another machine");

const noFiller90 = Compiler.compile(gymContext("growth", 4, { sessionMinutes: 90 }), EXERCISE_LIBRARY);
const noFiller120 = Compiler.compile(gymContext("growth", 4, { sessionMinutes: 120 }), EXERCISE_LIBRARY);
assert.deepEqual(noFiller120.program, noFiller90.program, "spare time adds no work");
const efficientPath = Compiler.compile(gymContext("growth", 6), EXERCISE_LIBRARY);
assert(allSlots(efficientPath).some((entry) => entry.prescription.sets === 2 && entry.prescription.targetRirMin === 0 && entry.prescription.targetRirMax === 2), "reviewed efficient two-set work may use the authored 0–2 RIR range");
const ordinaryGrowth = Compiler.compile(gymContext("growth", 5), EXERCISE_LIBRARY);
const prioritizedGrowth = Compiler.compile(gymContext("growth", 5, { priorityMuscles: ["Biceps"] }), EXERCISE_LIBRARY);
assert.equal(allSlots(prioritizedGrowth).length, allSlots(ordinaryGrowth).length + 1, "priority uses only an explicitly authored bonus slot");
assert.equal(allSlots(prioritizedGrowth).find((entry) => entry.templateId === "priority").exercise.primaryMuscles.includes("biceps"), true, "priority resolves the requested muscle inside the valid slot contract");
assert.equal(allSlots(Compiler.compile(gymContext("strength", 3, { priorityMuscles: ["Biceps"] }), EXERCISE_LIBRARY)).length,
  allSlots(Compiler.compile(gymContext("strength", 3), EXERCISE_LIBRARY)).length, "priority never invents a slot where the blueprint has none");
let reduced = null;
for (let minutes = 20; minutes <= 75 && !reduced; minutes += 5) {
  const result = Compiler.compile(gymContext("growth", 3, { sessionMinutes: minutes }), EXERCISE_LIBRARY);
  if (result.kind === "compiled" && result.reductions.length >= 2) reduced = result;
}
assert(reduced, "a time-pressure case compiles through reviewed reductions");
for (const dayId of new Set(reduced.reductions.map((entry) => entry.dayId))) {
  const reductionRanks = reduced.reductions.filter((entry) => entry.dayId === dayId).map((entry) => Compiler.RULES.reductionOrder.indexOf(entry.step));
  assert(reductionRanks.every((rank, index) => index === 0 || rank >= reductionRanks[index - 1]), `${dayId} time reductions follow the approved order`);
}
const impossible = Compiler.compile(gymContext("strength", 2, { sessionMinutes: 10 }), EXERCISE_LIBRARY);
assert.equal(impossible.kind, "conflict");
assert.equal(impossible.frequency, 2, "an impossible Strength 2d request does not reduce frequency");
assert(impossible.conflicts.some((entry) => entry.code === "time_ceiling_conflict"));

const homeNoPull = Compiler.compile(homeContext(3), EXERCISE_LIBRARY);
assert.equal(homeNoPull.kind, "compiled");
assert(homeNoPull.limitations.some((entry) => entry.code === "home.pull_capability_unavailable"));
assert(!allSlots(homeNoPull).some((entry) => entry.templateId === "home_pull"), "no-pull Home invents no pulling exercise");
const homePull = Compiler.compile(homeContext(3, { environment: ["safe_pull"] }), EXERCISE_LIBRARY);
assert.equal(homePull.kind, "compiled");
const protectedPulls = allSlots(homePull).filter((entry) => entry.templateId === "home_pull");
assert(protectedPulls.length > 0 && protectedPulls.every((entry) => entry.protected), "credible Home pulling becomes protected");
assert(protectedPulls.every((entry) => entry.exercise.environmentRequirements.includes("safe_pull")));

const bandCandidate = { id: "custom:band-lateral", name: "Band lateral raise", namePt: "Elevação lateral com faixa", equipment: ["band"], primary: "Side delts", secondary: "", patterns: ["lateral_raise"], practicalRepRange: [8, 15], stability: "moderate", beginnerFriendly: true, custom: true };
const homeBands = Compiler.compile(homeContext(3, { equipment: ["band"] }), [...EXERCISE_LIBRARY, bandCandidate]);
assert.equal(allSlots(homeBands).find((entry) => entry.templateId === "home_lateral").exercise.id, bandCandidate.id, "declared bands can resolve band work");
const homeDumbbells = Compiler.compile(homeContext(3, { equipment: ["band", "dumbbell"], loadIncrements: { dumbbell: 2 } }), [...EXERCISE_LIBRARY, bandCandidate]);
assert.equal(allSlots(homeDumbbells).find((entry) => entry.templateId === "home_lateral").exercise.equipment, "dumbbell", "dumbbells outrank bands when both fit");
const noHeavyCapability = Compiler.compile({ ...homeContext(2), familyId: "strength" }, EXERCISE_LIBRARY);
assert.equal(noHeavyCapability.kind, "conflict", "heavy primary work refuses bodyweight-only loading");

const balanced = Compiler.compile(gymContext("balanced", 3), EXERCISE_LIBRARY);
assert(balanced.relations.every((relation) => relation.state === "attached"), "approved exact-identity pairs attach");
const kneeVolume = balanced.days[2].slots[0];
const substituteMachine = EXERCISE_LIBRARY.find((entry) => entry.id === "sq_lp");
const invalidated = Compiler.substitute(balanced, kneeVolume.slotId, substituteMachine.id, EXERCISE_LIBRARY, gymContext("balanced", 3));
assert.equal(invalidated.relations.find((entry) => entry.id === "balanced_3_knee").state, "structural_only", "a different machine invalidates the executable pair");
const originalHeavyMovement = balanced.days[0].slots[0].exercise.id;
const restored = Compiler.substitute(invalidated, kneeVolume.slotId, originalHeavyMovement, EXERCISE_LIBRARY, gymContext("balanced", 3));
assert.equal(restored.relations.find((entry) => entry.id === "balanced_3_knee").state, "attached", "an exact compatible substitution restores the pair");

const growth = Compiler.compile(gymContext("growth", 2), EXERCISE_LIBRARY);
const pressSlot = growth.days[0].slots.find((entry) => entry.templateId === "horizontal_press");
assert.equal(pressSlot.prescription.classId, "compound_4_8");
const highRepPress = { ...EXERCISE_LIBRARY.find((entry) => entry.id === "pr_mc"), id: "custom:high-rep-press", practicalRepRange: [8, 12], custom: true };
const changedPrescription = Compiler.substitute(growth, pressSlot.slotId, highRepPress.id, [...EXERCISE_LIBRARY, highRepPress], gymContext("growth", 2));
assert.equal(changedPrescription.days[0].slots.find((entry) => entry.slotId === pressSlot.slotId).prescription.classId, "compound_8_12", "substitution resolves a compatible new prescription");
const customized = Compiler.customize(growth, pressSlot.slotId, { name: "My unsupported movement", primary: "Chest" });
assert.equal(customized.customizedFrom, "growth_2_v1");
assert.equal(customized.program.find((entry) => entry.slotId === pressSlot.slotId).progression.strategy.id, "manual", "unsupported custom semantics become manual");

const foundation = Compiler.compile(gymContext("strength", 3, { profile: "foundation" }), EXERCISE_LIBRARY);
assert.equal(foundation.kind, "compiled");
assert.equal(foundation.frequency, 3);
assert.equal(foundation.familyId, "strength");
assert.equal(foundation.relations.length, 0);
assert(allSlots(foundation).every((entry) => entry.prescription.progression.strategy.id === "range"));
assert(allSlots(foundation).some((entry) => entry.prescription.sets === 3), "Foundation has no universal two-set cap");
assert(allSlots(foundation).filter((entry) => entry.status !== "protected").some((entry) => entry.prescription.sets === 3), "Foundation does not cap every non-protected slot at two sets");
assert(!owns(Compiler.RULES, "foundationMaxSlotsPerDay"), "Foundation has no universal five-slot cap");
assert(!allSlots(foundation).some((entry) => entry.status === "optional"), "Foundation removes unnecessary optional complexity");

/* Foundation RIR interpretation (owner-approved 2026-08-29):
   Foundation may prefer the conservative end of an already-authored RIR range,
   but must never invent a new target, widen the range, or leave the authored
   bounds. It is conservative initialization inside the prescription, not a
   separate Foundation effort system. */
const authoredRirFor = (classId, efficient) => {
  const rule = Compiler.RULES.prescriptionClasses[classId];
  return efficient && rule.efficientRir ? rule.efficientRir.slice() : rule.rir.slice();
};
const conservativeClamp = ([lo, hi]) => [Math.min(Math.max(2, lo), hi), hi];

// Structural: for every prescription class, in both efficient and normal form,
// the Foundation-preferred range stays inside the authored range and never
// widens it — this also covers a hypothetical fixed (min === max) range.
for (const classId of Object.keys(Compiler.RULES.prescriptionClasses)) {
  for (const efficient of [false, true]) {
    const authored = authoredRirFor(classId, efficient);
    const [flo, fhi] = conservativeClamp(authored);
    assert(flo >= authored[0] && fhi <= authored[1] && flo <= fhi,
      `Foundation RIR for ${classId}${efficient ? " (efficient)" : ""} stays inside the authored range and is not widened`);
    assert(fhi === authored[1], `Foundation never raises the authored RIR ceiling for ${classId}`);
  }
}
// Synthetic fixed / narrow ranges cannot be widened or inverted by the rule.
for (const fixed of [[3, 3], [1, 1], [0, 0], [2, 2], [0, 1]]) {
  const [lo, hi] = conservativeClamp(fixed);
  assert(lo >= fixed[0] && hi <= fixed[1] && lo <= hi,
    `Foundation preference keeps an authored ${fixed[0]}-${fixed[1]} RIR inside its own bounds`);
}

// Behavioural: real Foundation compiles across efficient and non-efficient blueprints.
const foundationCompiles = [
  Compiler.compile(gymContext("strength", 3, { profile: "foundation" }), EXERCISE_LIBRARY),
  Compiler.compile(gymContext("growth", 6, { profile: "foundation" }), EXERCISE_LIBRARY),
  Compiler.compile(gymContext("balanced", 5, { profile: "foundation" }), EXERCISE_LIBRARY),
  Compiler.compile(homeContext(4, { profile: "foundation" }), EXERCISE_LIBRARY),
  Compiler.compile(homeContext(6, { profile: "foundation" }), EXERCISE_LIBRARY),
];
let sawAuthored13 = false;
let sawAuthored23 = false;
let sawAuthored02 = false;
for (const instance of foundationCompiles) {
  assert.equal(instance.kind, "compiled");
  assert.equal(new Set(instance.days.map((d) => d.dayId)).size, instance.frequency,
    "Foundation keeps the requested frequency's day structure");
  for (const resolved of allSlots(instance)) {
    const p = resolved.prescription;
    const authored = authoredRirFor(p.classId, p.efficient);
    const [flo, fhi] = conservativeClamp(authored);
    assert(p.targetRirMin >= authored[0] && p.targetRirMax <= authored[1] && p.targetRirMin <= p.targetRirMax,
      `${resolved.slotId} Foundation RIR [${p.targetRirMin},${p.targetRirMax}] stays inside authored [${authored[0]},${authored[1]}]`);
    assert.deepEqual([p.targetRirMin, p.targetRirMax], [flo, fhi],
      `${resolved.slotId} Foundation RIR is exactly the conservative clamp of the authored range`);
    // The RIR preference must not touch sets, reps, or strategy selection.
    const rule = Compiler.RULES.prescriptionClasses[p.classId];
    assert.equal(p.sets, p.efficient ? rule.efficientSets : rule.defaultSets, `${resolved.slotId} Foundation sets unchanged by the RIR rule`);
    assert.deepEqual([p.repMin, p.repMax], rule.repRanges[0], `${resolved.slotId} Foundation reps unchanged by the RIR rule`);
    assert(["range", "rep_goal"].includes(p.progression.strategy.id), `${resolved.slotId} Foundation keeps a simple strategy`);
    if (authored[0] === 1 && authored[1] === 3) { sawAuthored13 = true; assert(p.targetRirMin >= 1 && p.targetRirMax <= 3 && p.targetRirMin >= 2, "authored 1-3 -> Foundation prefers the 2-3 portion, still inside 1-3"); }
    if (authored[0] === 2 && authored[1] === 3) { sawAuthored23 = true; assert.deepEqual([p.targetRirMin, p.targetRirMax], [2, 3], "authored 2-3 -> Foundation stays 2-3"); }
    if (authored[0] === 0 && authored[1] === 2) { sawAuthored02 = true; assert(p.targetRirMax <= 2 && !(p.targetRirMin === 2 && p.targetRirMax === 3), "authored 0-2 -> Foundation never manufactures 2-3"); }
  }
  const recompiledCtx = instance.familyId === "home"
    ? homeContext(instance.frequency, { profile: "foundation" })
    : gymContext(instance.familyId, instance.frequency, { profile: "foundation" });
  assert.deepEqual(Compiler.compile(recompiledCtx, EXERCISE_LIBRARY).program, instance.program, "Foundation compile stays deterministic with the RIR preference");
}
assert(sawAuthored13 && sawAuthored23 && sawAuthored02, "Foundation RIR coverage exercised authored 1-3, 2-3, and 0-2 ranges");

// The RIR preference is not what forces the simple strategy: the standard
// profile still authors non-range strategies for the same family/frequency,
// and Foundation preserves family and frequency regardless.
const standardStrength3 = Compiler.compile(gymContext("strength", 3), EXERCISE_LIBRARY);
const foundationStrength3 = foundationCompiles[0];
assert(allSlots(standardStrength3).some((entry) => entry.prescription.progression.strategy.id !== "range"), "standard Strength 3d still uses a non-range strategy");
assert(allSlots(foundationStrength3).every((entry) => entry.prescription.progression.strategy.id === "range"), "Foundation simplifies to range@1");
assert.equal(foundationStrength3.familyId, standardStrength3.familyId, "Foundation does not change family");
assert.equal(foundationStrength3.frequency, standardStrength3.frequency, "Foundation does not change frequency");
assert.equal(foundationStrength3.days.length, standardStrength3.days.length, "Foundation does not change the day count");
assert.equal(foundationStrength3.relations.length, 0, "Foundation attaches no paired_exposure@1 in v1");

const interrupted = Compiler.compile(gymContext("growth", 3, { recentConsistency: "interrupted", reentryEnabled: true }), EXERCISE_LIBRARY);
assert(interrupted.weeks[0].days.flatMap((entry) => entry.slots).some((target) => target.sets < allSlots(interrupted).find((entry) => entry.slotId === target.slotId).prescription.sets));
assert(interrupted.weeks.slice(1).every((entry) => entry.phase === "normal"));
const returning = Compiler.compile(gymContext("strength", 3, { recentConsistency: "returning", reentryEnabled: true }), EXERCISE_LIBRARY);
assert.equal(returning.weeks[0].phase, "returning_week_1");
assert.equal(returning.weeks[1].phase, "returning_week_2");
assert(returning.weeks.slice(2).every((entry) => entry.phase === "normal"));
for (const instance of [interrupted, returning]) {
  const progression = JSON.stringify(instance.program.map((entry) => entry.progression));
  assert(instance.weeks.every(() => JSON.stringify(instance.program.map((entry) => entry.progression)) === progression), "re-entry does not change strategies or RIR targets");
}

const legacyProgram = [{ id: "a", day: "Day A", order: 1 }, { id: "b", day: "Day B", order: 1 }];
const migrated = Compiler.migrateLegacyStructure(legacyProgram);
const renamed = Compiler.migrateLegacyStructure([{ ...migrated.program[0], day: "Lower" }, migrated.program[1]], { ...migrated.structure, days: [{ ...migrated.structure.days[0], label: "Lower" }, migrated.structure.days[1]] });
assert.equal(renamed.structure.days[0].dayId, migrated.structure.days[0].dayId, "day rename preserves dayId");
assert.equal(renamed.program[0].slotId, migrated.program[0].slotId, "migration preserves slot identity");
assert.deepEqual(Compiler.migrateLegacyStructure(legacyProgram), migrated, "legacy migration is deterministic");

const cyclic = gymContext("growth", 3);
cyclic.history = [cyclic];
assert.doesNotThrow(() => Compiler.compile(cyclic, EXERCISE_LIBRARY));
assert.equal(Compiler.compile(cyclic, EXERCISE_LIBRARY).kind, "invalid");
assert.equal(Compiler.compile({ ...gymContext("growth", 3), surprise: true }, EXERCISE_LIBRARY).kind, "invalid");
assert.equal(Compiler.compile({ ...gymContext("growth", 3), frequency: 7 }, EXERCISE_LIBRARY).kind, "invalid");

const horizonContext = gymContext("strength", 5);
const horizonBaseline = Compiler.compile(horizonContext, EXERCISE_LIBRARY);
for (let week = 1; week <= 52; week++) assert.deepEqual(Compiler.compile({ ...horizonContext, weekNumber: week }, EXERCISE_LIBRARY).program, horizonBaseline.program, `week ${week} has no structural drift`);

console.log(`PASS program compiler: 20 exact blueprints, ${compiled.reduce((sum, entry) => sum + entry.days.length, 0)} days, deterministic resolution, constraints, substitutions, Foundation, re-entry, and 52-week stability`);
