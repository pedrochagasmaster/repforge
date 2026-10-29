import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Compiler = require("../program-compiler.js");
const catalog = JSON.parse(fs.readFileSync(new URL("../assets/exercise-catalog.json", import.meta.url)));

// The oracle reads raw metric UUIDs, never target presence from generated output.
const REPS_ID='2555c6f170d88072bbf6d9ad3f16ea86';
const REPS_PER_SIDE_ID='25a5c6f170d880baaa2dc8c7b67d4b65';
const sourceRepsKey=raw=>raw.exerciseMetrics.includes(REPS_ID)?'reps':raw.exerciseMetrics.includes(REPS_PER_SIDE_ID)?'repsPerSide':null;
function assertSourceDose(raw,set,center,rir){
 const key=sourceRepsKey(raw);
 assert.deepEqual(set.targets,key?{[key]:{min:center-1,max:center+1}}:{},'required source metric key and exact range');
 assert.equal(set.rir,key?rir:null,'RIR follows source metric presence, not generated target presence');
}
// Deliberately falsify the independent source-dose oracle.
for(const key of ['reps','repsPerSide']){
 const raw={exerciseMetrics:[key==='reps'?REPS_ID:REPS_PER_SIDE_ID]};
 assertSourceDose(raw,{targets:{[key]:{min:4,max:6}},rir:2},5,2);
 assert.throws(()=>assertSourceDose(raw,{targets:{},rir:null},5,2));
 assert.throws(()=>assertSourceDose(raw,{targets:{[key==='reps'?'repsPerSide':'reps']:{min:4,max:6}},rir:2},5,2));
 assert.throws(()=>assertSourceDose(raw,{targets:{[key]:{min:4,max:6}},rir:1},5,2));
}
assertSourceDose({exerciseMetrics:[]},{targets:{},rir:null},5,2);
assert.throws(()=>assertSourceDose({exerciseMetrics:[]},{targets:{reps:{min:4,max:6}},rir:2},5,2));
console.log('PASS source-dose oracle controls: omitted targets, wrong key, wrong RIR, invented reps rejected');

const muscle = name => Object.entries(catalog.uuidIndex).find(([, row]) => row.type === "featureMuscleGroup" && row.name === name)?.[0];
const depriority = ["Chest", "Lats", "Upper Back", "Side Delts", "Front Delts", "Rear Delts", "Biceps", "Triceps"].map(muscle);
assert(depriority.every(Boolean), "fixture identities exist in the pinned catalogue");
const request = {
  goal: "hybrid", experience: "advanced", daysPerWeek: 3, split: "upper_lower_full",
  timeCeilingMinutes: 60, periodization: "static", cycles: 7, deloadCycles: [],
  gymProfile: { equipmentIds: Object.entries(catalog.uuidIndex).filter(([, row]) => row.type === "equipment" && row.commercialGym === 1).map(([id]) => id) },
  competencyAnswers: Object.fromEntries(["pullups10", "pullups5", "pushups15", "inclineBarbell10", "overheadPress10", "bodyweightDips10", "benchPress10"].map(key => [key, true])),
  emphasisMuscleIds: [], deprioritizedMuscleIds: depriority,
};
assert.equal(typeof Compiler.canonicalizeRequest, "function", "compiler owns the canonical request boundary");
const normalized = Compiler.canonicalizeRequest(request, catalog);
assert.equal(normalized.ok, true, JSON.stringify(normalized));
assert.equal(normalized.value.deprioritizedMuscleIds.length, 8);
for (const field of ["split", "periodization"]) for (const value of ["", false, 0, []]) {
 assert.equal(Compiler.canonicalizeRequest({...request,[field]:value},catalog).ok,false,"explicit unknown enum values must not become defaults");
}
for (const loads of [null, [], 0, { unknown: [1] }, { unknown: "wrong" }]) {
  assert.equal(Compiler.canonicalizeRequest({ ...request, gymProfile: { ...request.gymProfile, equipmentLoadsKg: loads } }, catalog).ok, false, "invalid equipment grids are refused at the canonical boundary");
}
assert.deepEqual(Compiler.canonicalizeRequest({ ...request, gymProfile: { ...request.gymProfile, equipmentLoadsKg: {} } }, catalog), normalized, "an explicit empty equipment configuration equals the initial default");
const before = JSON.stringify(request);
const first = Compiler.generateProgram(request, catalog);
assert.equal(first.ok, true, JSON.stringify(first.conflicts));
assert.equal(JSON.stringify(request), before, "generation does not mutate inputs");
assert.equal(Compiler.validateProgramDefinition(first.value, catalog).ok, true);
assert.equal(first.value.generatorVersion, Compiler.GENERATOR_VERSION);
assert.equal(Object.hasOwn(first.value, "seed"), false, "current definitions have no variable-seed field");
assert.equal(Object.hasOwn(first.value.request, "seed"), false);
assert.deepEqual(first.value.days.map(day => day.kind), ["training", "rest", "training", "rest", "training", "rest", "rest"]);
assert.deepEqual(first.value.days.filter(day => day.kind === "training").map(day => day.name), ["Upper", "Lower", "Full Body"]);
assert.equal(first.value.provenance.generationBudgetMinutes, 50);
assert.equal(first.value.request.deprioritizedMuscleIds.length, 8);
const pull = new Set(Object.entries(catalog.uuidIndex).filter(([, row]) => row.type === "movementPattern" && ["Horizontal Pull", "Vertical Pull"].includes(row.name)).map(([id]) => id));
const adjustments = { 1: [0], 2: [0, -1], 3: [1, 0, -1], 4: [1, 0, 0, -1], 5: [1, 0, 0, -1, -1], 6: [1, 1, 0, 0, -1, -1] };
const ids = [];
for (const day of first.value.days) {
  ids.push(day.id);
  if (day.kind !== "training") continue;
  assert(day.slots.length > 0);
  for (const slot of day.slots) {
    ids.push(slot.id);
    const raw = catalog.exercises.find(row => row.id === slot.exerciseId);
    assert(raw && !request.excludedExerciseIds?.includes(raw.id));
    const accessory = slot.role.endsWith("Accessory");
    const primary = slot.role.endsWith("PrimaryCompound");
    const isPull = raw.movementPattern.some(id => pull.has(id));
    const center = accessory ? 15 : primary ? (isPull ? 8 : 5) : (isPull ? 12 : 10);
    const base = accessory ? 0 : isPull ? 1 : 2;
    assert.equal(slot.prescriptionsByCycle.length, 7);
    for (const cycle of slot.prescriptionsByCycle) {
      const sets = cycle.sets;
      assert(adjustments[sets.length], "source set-count domain");
      for (const [index, set] of sets.entries()) {
        ids.push(set.id);
        const range = set.targets.reps ?? set.targets.repsPerSide;
        if (range) assert.deepEqual(range, { min: center - 1, max: center + 1 });
        assert.equal(set.rir, range ? Math.max(0, base + adjustments[sets.length][index]) : null);
        assert.equal(set.restSeconds, null, "Static producer does not prescribe a rest override");
      }
      assert.deepEqual(sets.map(({ id, cycleIndex, ...set }) => set), slot.prescriptionsByCycle[0].sets.map(({ id, cycleIndex, ...set }) => set));
    }
  }
}
assert.equal(new Set(ids).size, ids.length, "all generated semantic paths have unique identities");
const permuted = structuredClone(request);
permuted.gymProfile.equipmentIds.reverse();
permuted.deprioritizedMuscleIds.reverse();
const originalRandom = Math.random, originalNow = Date.now;
try {
  Math.random = () => { throw new Error("hidden random input"); };
  Date.now = () => { throw new Error("hidden time input"); };
  assert.deepEqual(Compiler.generateProgram(permuted, catalog).value, first.value);
} finally { Math.random = originalRandom; Date.now = originalNow; }
const reorderedCatalog = { ...catalog, generatedAt: "irrelevant", exercises: [...catalog.exercises].reverse(), uuidIndex: Object.fromEntries(Object.entries(catalog.uuidIndex).reverse()) };
assert.deepEqual(Compiler.generateProgram(request, reorderedCatalog).value, first.value);
for (const bad of [
  { ...request, emphasisMuscleIds: {} },
  { ...request, deprioritizedMuscleIds: {} },
  { ...request, unknownInput: true },
  { ...request, deprioritizedMuscleIds: [...depriority, "unknown-uuid"] },
  { ...request, emphasisMuscleIds: [depriority[0]] },
  { ...request, gymProfile: { ...request.gymProfile, unknown: 1 } },
]) assert.equal(Compiler.generateProgram(bad, catalog).ok, false, "invalid input cannot be silently discarded");
for (const invalidBudget of [-1, "50", null]) {
  const invalidDefinition = structuredClone(first.value);
  invalidDefinition.provenance.generationBudgetMinutes = invalidBudget;
  assert.equal(Compiler.validateProgramDefinition(invalidDefinition, catalog).ok, false, "invalid generation budgets are refused at the definition boundary");
}
// Plan 076: eleven regular weeks are outside the four-to-ten domain.
const outside = Compiler.generateProgram({ ...request, cycles: 11 }, catalog);
assert.equal(outside.ok, false, "eleven regular weeks are outside the four-to-ten domain");
assert.equal(outside.value, null);
// Preserve this exact pure8D fixture and change only its explicit goal.
// These expected primary UUIDs come from independently reviewed source-model
// canonical-pure8D choices, not a new snapshot of the public compiler.
const hRequest={...request,goal:'hypertrophy'};
const hBefore=JSON.stringify(hRequest);
const hGenerated=Compiler.generateProgram(hRequest,catalog);
assert.equal(hGenerated.ok,true,'hypertrophy60 must compile through recovered rules: '+JSON.stringify(hGenerated.conflicts));
assert.equal(JSON.stringify(hRequest),hBefore);
const hDefinition=hGenerated.value;
assert.equal(hDefinition.request.goal,'hypertrophy');
assert.equal(hDefinition.request.timeCeilingMinutes,60);
assert.equal(hDefinition.provenance.generationBudgetMinutes,50);
assert.equal(hDefinition.provenance.source,'recovered_generation_rules');
assert.equal(hDefinition.request.split,'upper_lower_full');assert.equal(hDefinition.cycles,7);
assert.deepEqual(hDefinition.deloadCycles,[]);
assert.equal(Compiler.validateProgramDefinition(hDefinition,catalog).ok,true);
const hSlots=hDefinition.days.flatMap(day=>day.slots);
const hPrimary=hSlots.filter(slot=>slot.role.endsWith('PrimaryCompound'));
const hExpectedPrimary=['19f5c6f170d88013ae78cc9e6c967813','1a05c6f170d8802ba26bf25efbec5e68',
 '1a15c6f170d8802facb6eb0a316ae895','1a15c6f170d8800d8fc9d2c235673bf6',
 '1a25c6f170d88008a9adde9f71881c36','1a35c6f170d880bebc64f4dce0d5f5f1'];
assert.deepEqual(hPrimary.map(slot=>slot.exerciseId).sort(),hExpectedPrimary.slice().sort(),
 'hypertrophy primary selection follows its independently recovered classification/tier pools');
assert.notDeepEqual(hPrimary.map(slot=>slot.exerciseId).sort(),first.value.days.flatMap(day=>day.slots)
 .filter(slot=>slot.role.endsWith('PrimaryCompound')).map(slot=>slot.exerciseId).sort(),
 'changing only both primary doses cannot satisfy hypertrophy selection');
const hPrimaryDescriptor='2dc5c6f170d88157bb0bd7609d767bc6';
const hIds=[];
for(const day of hDefinition.days){hIds.push(day.id);for(const slot of day.slots){
 hIds.push(slot.id);
 const raw=catalog.exercises.find(exercise=>exercise.id===slot.exerciseId);assert(raw);
 const accessory=slot.role.endsWith('Accessory'),primary=slot.role.endsWith('PrimaryCompound');
 const isPull=raw.movementPattern.some(id=>pull.has(id));
 if(primary){
  assert.equal(slot.role,'hypertrophyPrimaryCompound');
  assert(raw.exerciseClassificationHypertrophy.includes(hPrimaryDescriptor));
  assert.notEqual(raw.hypertrophyPrimaryCompoundRecommendationLevel,null);
 }
 const center=accessory?15:primary?(isPull?10:8):(isPull?12:10);
 const base=accessory?0:isPull?1:2;
 assert.equal(slot.prescriptionsByCycle.length,7);
 for(const cycle of slot.prescriptionsByCycle){
  assert(adjustments[cycle.sets.length]);
  for(const [index,set] of cycle.sets.entries()){
   hIds.push(set.id);assertSourceDose(raw,set,center,Math.max(0,base+adjustments[cycle.sets.length][index]));
   assert.equal(set.restSeconds,null);
  }
  assert.deepEqual(cycle.sets.map(({id,cycleIndex,...set})=>set),slot.prescriptionsByCycle[0].sets.map(({id,cycleIndex,...set})=>set));
 }
}}
assert.equal(new Set(hIds).size,hIds.length);
const hPermuted=structuredClone(hRequest);hPermuted.gymProfile.equipmentIds.reverse();hPermuted.deprioritizedMuscleIds.reverse();
assert.deepEqual(Compiler.generateProgram(hPermuted,catalog).value,hDefinition);
assert.notEqual(Compiler.generationIdentity(hRequest,catalog),Compiler.generationIdentity(request,catalog));
// Other goal/duration combinations are covered by the source dimension proof.

const hExhausted=Compiler.generateProgram({...hRequest,excludedExerciseIds:catalog.exercises.map(exercise=>exercise.id)},catalog);
assert.equal(hExhausted.ok,false);assert.equal(hExhausted.value,null);assert(hExhausted.conflicts.length>0);
// Change only duration in this existing source-catalogue fixture. Keep its
// eight muscle UUIDs, equipment and confirmations distinct from browser fixtures.
const request40 = { ...request, timeCeilingMinutes: 40 };
const unchanged40 = JSON.stringify(request40);
const generated40 = Compiler.generateProgram(request40, catalog);
assert.equal(generated40.ok, true, 'option40 must compile with recovered budget30: '+JSON.stringify(generated40.conflicts));
assert.equal(JSON.stringify(request40), unchanged40);
assert.equal(generated40.value.request.timeCeilingMinutes, 40);
assert.equal(generated40.value.provenance.generationBudgetMinutes, 30);
assert.equal(generated40.value.provenance.source, 'recovered_generation_rules');
assert.equal(generated40.value.request.split, 'upper_lower_full');
assert.equal(generated40.value.cycles, 7);
assert.deepEqual(generated40.value.deloadCycles, []);
assert.equal(Compiler.validateProgramDefinition(generated40.value, catalog).ok, true);
assert.notEqual(Compiler.generationIdentity(request40,catalog),Compiler.generationIdentity(request,catalog),'option participates in canonical identity');
const permuted40=structuredClone(request40);
permuted40.gymProfile.equipmentIds.reverse();permuted40.deprioritizedMuscleIds.reverse();
assert.deepEqual(Compiler.generateProgram(permuted40,catalog).value,generated40.value);
const ids40=[];let oneSetPrimaries40=0;
for(const day of generated40.value.days){
 ids40.push(day.id);
 for(const slot of day.slots){
  ids40.push(slot.id);
  assert.equal(slot.prescriptionsByCycle.length,7);
  const raw=catalog.exercises.find(exercise=>exercise.id===slot.exerciseId);
  assert(raw,'selected UUID still belongs to the source catalogue');
  const accessory=slot.role.endsWith('Accessory'),primary=slot.role.endsWith('PrimaryCompound');
  const isPull=raw.movementPattern.some(id=>pull.has(id));
  const center=accessory?15:primary?(isPull?8:5):(isPull?12:10);
  const base=accessory?0:isPull?1:2;
  const count=slot.prescriptionsByCycle[0].sets.length;
  if(primary&&count===1)oneSetPrimaries40++;
  for(const cycle of slot.prescriptionsByCycle){
   assert.equal(cycle.sets.length,count,'Static retains its authored count across seven cycles');
   assert(adjustments[count]);
   for(const [index,set] of cycle.sets.entries()){
    ids40.push(set.id);
    assertSourceDose(raw,set,center,Math.max(0,base+adjustments[count][index]));
    assert.equal(set.restSeconds,null);
    if(count===1)assert.equal(set.rir,sourceRepsKey(raw)?base:null,'one-set adjustment[0] is zero');
   }
   assert.deepEqual(cycle.sets.map(({id,cycleIndex,...set})=>set),slot.prescriptionsByCycle[0].sets.map(({id,cycleIndex,...set})=>set));
  }
 }
}
const oneSetCoverage40=[];
for(const [patternId,expectedPull,expectedCenter,expectedRir] of [
 ['19e5c6f170d8805a8a1cf72d5e7a401f',false,5,2],
 ['19e5c6f170d8808fbc7ffe35bc0bf0ca',true,8,1]]){
 const matching=generated40.value.days.flatMap(day=>day.slots).filter(slot=>slot.role.endsWith('PrimaryCompound')&&
  slot.prescriptionsByCycle[0].sets.length===1&&catalog.exercises.find(raw=>raw.id===slot.exerciseId).movementPattern.includes(patternId));
 assert(matching.length>0,'pinned option40 fixture must reach each vertical one-set primary source branch');
 for(const slot of matching){
  const raw=catalog.exercises.find(raw=>raw.id===slot.exerciseId);
  assert.equal(raw.movementPattern.some(id=>pull.has(id)),expectedPull,'source pattern membership determines the one-set baseline');
  assert(sourceRepsKey(raw),'named one-set branch must actually exercise a reps-bearing target');
  for(const cycle of slot.prescriptionsByCycle){assert.equal(cycle.sets.length,1);assertSourceDose(raw,cycle.sets[0],expectedCenter,expectedRir);}
  oneSetCoverage40.push({patternId,exerciseId:slot.exerciseId,expectedPull,expectedCenter,expectedRir});
 }
}
console.log('ONE_SET_40_SOURCE_COVERAGE',JSON.stringify(oneSetCoverage40));
assert.equal(new Set(ids40).size,ids40.length);
const exhausted40=Compiler.generateProgram({...request40,excludedExerciseIds:catalog.exercises.map(exercise=>exercise.id)},catalog);
assert.equal(exhausted40.ok,false);assert.equal(exhausted40.value,null,'catalogue exhaustion returns no partial program');
assert(exhausted40.conflicts.length>0);
// Transition protocol proofs exercise current recovered-domain changes
// without needing to complete a block in the browser for every configuration.
const Transition = require("../program-transition.js");
const reviewed = structuredClone(first.value);
reviewed.days.find(day => day.kind === "training").slots[0].prescriptionsByCycle[0].sets[0].rir = 3;
const savedReviewed = JSON.stringify(reviewed);
for (const change of [{ kind: "fewer_days", daysPerWeek: 2 }]) {
  const derived = Transition.deriveSuccessor({ programDefinition: reviewed,
    customExerciseDefinitions: [], catalogSnapshot: catalog, change });
  assert.equal(derived.ok, true, `${change.kind} uses the recovered two-day split`);
  assert.equal(derived.value.programDefinition.provenance.source, "recovered_generation_rules");
  assert.equal(derived.value.programDefinition.request.split, "full_body");
  assert.equal(JSON.stringify(reviewed), savedReviewed, "derivation preserves the exact reviewed predecessor");
}
for(const [minutes,budget] of [[20,18],[40,30]]) {
 const shorter=Transition.deriveSuccessor({programDefinition:reviewed,customExerciseDefinitions:[],catalogSnapshot:catalog,
  change:{kind:'shorter_sessions',sessionMinutes:minutes}});
 assert.equal(shorter.ok,true,`supported shorter${minutes} keeps the recovered policy`);
 assert.equal(shorter.value.programDefinition.provenance.source,'recovered_generation_rules');
 assert.equal(shorter.value.programDefinition.request.timeCeilingMinutes,minutes);
 assert.equal(shorter.value.programDefinition.provenance.generationBudgetMinutes,budget);
 assert.equal(Compiler.validateProgramDefinition(shorter.value.programDefinition,catalog).ok,true);
}
assert.equal(JSON.stringify(reviewed),savedReviewed,'successful derivation also preserves its reviewed predecessor');
console.log("program-generation-parity: canonical inputs, recovered Static targets, seven cycles, identity and strict failures pass");

// Exact identities are source-model fixtures, not compiler output snapshots or global counts.
const strengthSourceFixtures=[{"fixture":"canonical-pure8D","days":[["19f5c6f170d88013ae78cc9e6c967813","1a15c6f170d880e9bd65f120ac4908a0","1a05c6f170d8802d9233da6c4897b8e7","1a15c6f170d880bf8710e3cf4209936d","1a15c6f170d8804cbd9afa04567bd5f7"],["1a25c6f170d8803d8231d083fdd65458","1a35c6f170d8807aae84e2c6eb136395","2175c6f170d88016a63deff6b692c180","1a15c6f170d880518057cd4d484cbecb","1a25c6f170d880c59f17ce7802758fc3"],["1a35c6f170d880bebc64f4dce0d5f5f1","1a35c6f170d8800bab2dca0110e26c4a","1a15c6f170d880629cb0e70c9f87e027","1a15c6f170d8800abba4d3ef66a48aa6","1a45c6f170d8808bb970dd2156495ae2"]]},{"fixture":"no-P-D","days":[["19f5c6f170d88013ae78cc9e6c967813","1a15c6f170d8800abe49f4321d63a1ef","1a05c6f170d8802d9233da6c4897b8e7","1a15c6f170d88037945ece29e66bdf4d","1a05c6f170d880e28b6bfbd0e217fcbc"],["1a25c6f170d8803d8231d083fdd65458","1a35c6f170d8807aae84e2c6eb136395","2175c6f170d88016a63deff6b692c180","1a15c6f170d880518057cd4d484cbecb","1a25c6f170d880c59f17ce7802758fc3"],["1a35c6f170d880bebc64f4dce0d5f5f1","1a15c6f170d88015841af06a4533b9b3","1a05c6f170d8801f98afff449f6a3b05","1a35c6f170d8800bab2dca0110e26c4a","1a15c6f170d88003bf5cd77bef6a5034"]]},{"fixture":"priority-hamstrings-pure8D","days":[["19f5c6f170d88013ae78cc9e6c967813","1a15c6f170d880e9bd65f120ac4908a0","1a05c6f170d8802d9233da6c4897b8e7","1a15c6f170d880bf8710e3cf4209936d","1a15c6f170d8804cbd9afa04567bd5f7"],["1a25c6f170d8803d8231d083fdd65458","1a35c6f170d880489b7be1d31faff56b","2175c6f170d88016a63deff6b692c180","1a35c6f170d8800bab2dca0110e26c4a","1a15c6f170d880518057cd4d484cbecb"],["1a35c6f170d880d697d3f111b6bd16f5","1a35c6f170d88029bc9ff9ded538758c","1a15c6f170d880629cb0e70c9f87e027","1a15c6f170d8800abba4d3ef66a48aa6","1a45c6f170d8808bb970dd2156495ae2"]]}];
for(const fixture of strengthSourceFixtures){
 const sourceRequest={...request,goal:'strength',...(fixture.fixture==='no-P-D'?{deprioritizedMuscleIds:[]}:{}),
  ...(fixture.fixture==='priority-hamstrings-pure8D'?{emphasisMuscleIds:[muscle('Hamstrings')]}:{})};
 const generated=Compiler.generateProgram(sourceRequest,catalog);assert.equal(generated.ok,true,JSON.stringify(generated.conflicts));
 assert.deepEqual(generated.value.days.filter(day=>day.kind==='training').map(day=>day.slots.map(slot=>slot.exerciseId)),fixture.days,fixture.fixture);
 assert.equal(generated.value.provenance.generationBudgetMinutes,50);
 assert.equal(Compiler.validateProgramDefinition(generated.value,catalog).ok,true);
 assert.deepEqual(Compiler.generateProgram({...sourceRequest,split:'auto'},catalog).value,generated.value);
 assert(Compiler.availableSplits(sourceRequest).includes('upper_lower_full'));
 const identities=[];
 for(const day of generated.value.days){identities.push(day.id);for(const slot of day.slots){
  identities.push(slot.id);const raw=catalog.exercises.find(ex=>ex.id===slot.exerciseId);
  const accessory=slot.role.endsWith('Accessory'),primary=slot.role.endsWith('PrimaryCompound');
  assert.equal(slot.role,accessory?'strengthAccessory':primary?'strengthPrimaryCompound':'strengthSecondaryCompound');
  const pullMovement=raw.movementPattern.some(id=>pull.has(id));
  const center=accessory?10:primary?(pullMovement?8:5):(pullMovement?10:8),base=accessory?0:pullMovement?1:2;
  const descriptor=accessory?'2dc5c6f170d881faa946ee13702e7ea7':primary?'2dc5c6f170d88157bb0bd7609d767bc6':'2dc5c6f170d8814c8fcaf2e322abde4d';
  assert(raw.exerciseClassificationStrength.includes(descriptor));
  const tier=accessory?'strengthAccessoryRecommendationLevel':primary?'strengthPrimaryCompoundRecommendationLevel':'strengthSecondaryCompoundRecommendationLevel';
  assert.notEqual(raw[tier],null);
  assert.equal(slot.prescriptionsByCycle.length,7);
  for(const cycle of slot.prescriptionsByCycle)for(const [index,set]of cycle.sets.entries()){
   identities.push(set.id);assertSourceDose(raw,set,center,Math.max(0,base+adjustments[cycle.sets.length][index]));assert.equal(set.restSeconds,null);
  }
 }}
 assert.equal(new Set(identities).size,identities.length);
 for(const change of [{timeCeilingMinutes:30},{experience:'none'},{cycles:3},{cycles:11},{deloadCycles:[4]}]){
  const outside={...sourceRequest,...change};const denied=Compiler.generateProgram(outside,catalog);assert.equal(denied.ok,false);assert.equal(denied.value,null);
  assert.equal(Compiler.availableSplits(outside).includes('upper_lower_full'),false);
 }
 const exhausted=Compiler.generateProgram({...sourceRequest,excludedExerciseIds:catalog.exercises.map(ex=>ex.id)},catalog);
 assert.equal(exhausted.ok,false);assert.equal(exhausted.value,null);
}
console.log('strength60: source-model selections, source-typed Static targets, identities and invalid-domain refusals PASS');

// Controlled direct-generator experience slice, not source UI listener policy.
function experienceSemantics(definition){
 const days=definition.days.map(({id:dayId,slots,...day})=>({...day,
  slots:slots.map(({id:slotId,prescriptionsByCycle,...slot})=>({...slot,
   prescriptionsByCycle:prescriptionsByCycle.map(({sets,...cycle})=>({...cycle,
    sets:sets.map(({id:setId,...set})=>set)}))}))}));
 return {days,cycles:definition.cycles,deloadCycles:definition.deloadCycles,
  estimates:definition.days.map(day=>definition.provenance.estimatedSessionSeconds[day.id]??null)};
}
// Only generated day/slot/set IDs are excluded. Metric UUIDs remain semantic.
const metricIdentityControl=structuredClone(first.value);
const metricIdentitySlot=metricIdentityControl.days.flatMap(day=>day.slots).find(slot=>slot.metricDefinitions.length);
assert(metricIdentitySlot,'fixture reaches source metric identities');
metricIdentitySlot.metricDefinitions[0].id='different-semantic-metric';
assert.notDeepEqual(experienceSemantics(metricIdentityControl),experienceSemantics(first.value));
const experienceIdentities=new Set([Compiler.generationIdentity(request,catalog)]);
for(const experience of ['beginner','intermediate']){
 const input={...request,experience};const original=JSON.stringify(input);
 const canonical=Compiler.canonicalizeRequest(input,catalog);
 assert.equal(canonical.ok,true);assert.equal(canonical.value.experience,experience);
 const identity=Compiler.generationIdentity(input,catalog);assert(!experienceIdentities.has(identity));experienceIdentities.add(identity);
 const compiled=Compiler.generateProgram(input,catalog);
 assert.equal(compiled.ok,true,'controlled hybrid60Static experience must compile: '+experience);
 assert.equal(JSON.stringify(input),original,'caller experience request is unchanged');
 assert.equal(compiled.value.request.experience,experience);
 assert.deepEqual(compiled.value.request,canonical.value,'recipe request retains every canonical field');
 assert.equal(Compiler.validateProgramDefinition(compiled.value,catalog).ok,true);
 assert.deepEqual(experienceSemantics(compiled.value),experienceSemantics(first.value),'experience changes metadata/namespace, not controlled assembly or seven target values');
 assert.notEqual(compiled.value.days[0].id,first.value.days[0].id,'experience participates in generation identity');
 for(const patch of [{timeCeilingMinutes:30},{daysPerWeek:4},{cycles:3},{cycles:11},{deloadCycles:[4]}]){
  const denied=Compiler.generateProgram({...input,...patch},catalog);assert.equal(denied.ok,false);assert.equal(denied.value,null);
 }
 const noEquipment={...input,gymProfile:{equipmentIds:[]}};
 const baselineNoEquipment=Compiler.generateProgram({...noEquipment,experience:'advanced'},catalog);
 const limited=Compiler.generateProgram(noEquipment,catalog);
 assert.equal(limited.ok,false);assert.equal(limited.value,null);assert.deepEqual(limited.conflicts,baselineNoEquipment.conflicts);
 const noCapability={...input,competencyAnswers:Object.fromEntries(Object.keys(input.competencyAnswers).map(key=>[key,false]))};
 const capability=Compiler.generateProgram(noCapability,catalog),advancedCapability=Compiler.generateProgram({...noCapability,experience:'advanced'},catalog);
 assert.equal(capability.ok,advancedCapability.ok);
 if(capability.ok)assert.deepEqual(experienceSemantics(capability.value),experienceSemantics(advancedCapability.value));
 else {assert.equal(capability.value,null);assert.deepEqual(capability.conflicts,advancedCapability.conflicts);}
}
assert.equal(Compiler.generateProgram({...request,experience:'none'},catalog).ok,false,'source None is not Taurifer beginner');
console.log('PASS controlled beginner/intermediate semantic assembly, identities, exact request and invalid-domain refusal');
