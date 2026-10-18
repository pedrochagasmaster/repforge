// Allocation ties and source-metric target rules require deterministic pure proofs.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const Compiler=require('../src/training/generation.js'),Layout=require('../generation-layout.js');
const Adapter=require('../program-entry-adapter.js'),Setup=require('../shared-setup.js');
const catalog=require('../src/training/identity.js').prepareCatalog(require('../assets/exercise-catalog.json'));
const competencies=Object.fromEntries(['pullups10','pullups5','pushups15','inclineBarbell10','overheadPress10','bodyweightDips10','benchPress10'].map(k=>[k,true]));
const reductions=['Chest','Lats','Upper Back','Side Delts','Front Delts','Rear Delts','Biceps','Triceps'];
const muscle=name=>Object.entries(catalog.uuidIndex).find(([,r])=>r.type==='featureMuscleGroup'&&r.name===name)[0];
const request={goal:'hybrid',experience:'advanced',daysPerWeek:3,split:'upper_lower_full',timeCeilingMinutes:20,
 periodization:'static',cycles:7,deloadCycles:[],gymProfile:{equipmentIds:Object.entries(catalog.uuidIndex)
 .filter(([,r])=>r.type==='equipment'&&r.commercialGym===1).map(([id])=>id)},competencyAnswers:competencies,
 emphasisMuscleIds:[],deprioritizedMuscleIds:reductions.map(muscle)};
const expectedDays=[[{"id":"19f5c6f170d88013ae78cc9e6c967813","sets":1},{"id":"1a15c6f170d880e9bd65f120ac4908a0","sets":1},{"id":"1a05c6f170d8802d9233da6c4897b8e7","sets":1},{"id":"1a15c6f170d880bf8710e3cf4209936d","sets":1}],[{"id":"1a25c6f170d8803d8231d083fdd65458","sets":2},{"id":"1a35c6f170d8807aae84e2c6eb136395","sets":2}],[{"id":"1a15c6f170d880518057cd4d484cbecb","sets":3},{"id":"1a15c6f170d880629cb0e70c9f87e027","sets":2},{"id":"1a15c6f170d8804cbd9afa04567bd5f7","sets":2}]];
const pullIds=new Set(['19e5c6f170d88009ba40c03d2f6271df','19e5c6f170d8808fbc7ffe35bc0bf0ca']);
const adjustments={1:[0],2:[0,-1],3:[1,0,-1]};
let cached;
function generated(){
 if(!cached){cached=Compiler.generateProgram(request,catalog);assert.equal(cached.ok,true,JSON.stringify(cached.conflicts));}
 return cached.value;
}
test('option20 chooses source allocation including the lower compound midpoint tie',()=>{
 let serial=0;
 const upper=new Set(['sideDelts','biceps','triceps','chest','rearDelts','lats','upperTraps','upperBack','forearms','neck','frontDelts']);
 const selector={priorities:[],depriorities:[],choose(spec){const region=spec.type==='accessory'
  ?upper.has(spec.muscle)?'upperBody':'lowerBody':['squat','hipHinge'].includes(spec.pattern)?'lowerBody':'upperBody';
  return{id:String(serial++),patterns:spec.pattern?[spec.pattern]:[],region,effectiveRegion:region,
   exerciseType:'core',primaryJointActions:[],exclusionGroupings:[],raw:{}};}};
 const layout=Layout.generate(request,selector);assert.equal(layout.status,'ok');assert.equal(layout.budgetMinutes,18);
 assert.deepEqual(layout.allocations,{upper:{compound:[2,2,0,0],isolation:[2,2,0,0]},lower:{compound:[2,2,0,0],isolation:[1,3,0,0]}});
 const costs=[1,2].map(count=>count*(120+180+30*2+180));
 assert.deepEqual(costs,[540,1080]);assert.deepEqual(costs.map(c=>Math.abs(810-c)),[270,270]);
 const primaries=layout.days.flatMap(d=>d.templates).filter(t=>t.type==='primary'&&t.numSets===1);
 assert.deepEqual(primaries.flatMap(t=>t.exercise.patterns).sort(),['horizontalPush','verticalPush','horizontalPull','verticalPull'].sort());
});
test('option20 source identities, typed targets and production cycle consumer preserve one-set primaries',()=>{
 const before=JSON.stringify(request),definition=generated();assert.equal(JSON.stringify(request),before);
 const canonical=Compiler.canonicalizeRequest(request,catalog);assert.equal(canonical.ok,true);assert.deepEqual(definition.request,canonical.value);
 assert.equal(definition.provenance.generationBudgetMinutes,18);assert.equal(definition.request.timeCeilingMinutes,20);
 assert.equal(Compiler.validateProgramDefinition(definition,catalog).ok,true);
 assert.deepEqual(definition.days.filter(d=>d.kind==='training').map(d=>d.slots.map(s=>({id:s.exerciseId,sets:s.prescriptionsByCycle[0].sets.length}))),expectedDays);
 assert.deepEqual(definition.days.filter(d=>d.kind==='training').map(d=>definition.provenance.estimatedSessionSeconds[d.id]),[1320,1080,1200],
  'source estimates may exceed budget18; no hard time trimming');
 const identities=[];let singlePrimaries=0;
 for(const day of definition.days){identities.push(day.id);for(const slot of day.slots){
  identities.push(slot.id);const raw=catalog.exercises.find(e=>e.id===slot.exerciseId);
  const key=raw.exerciseMetrics.includes('2555c6f170d88072bbf6d9ad3f16ea86')?'reps':raw.exerciseMetrics.includes('25a5c6f170d880baaa2dc8c7b67d4b65')?'repsPerSide':null;
  const accessory=slot.role.endsWith('Accessory'),pull=raw.movementPattern.some(id=>pullIds.has(id));
  const center=accessory?15:pull?8:5,base=accessory?0:pull?1:2;
  if(slot.role.endsWith('PrimaryCompound')&&slot.prescriptionsByCycle[0].sets.length===1)singlePrimaries++;
  assert.equal(slot.prescriptionsByCycle.length,7);
  for(const cycle of slot.prescriptionsByCycle)for(const [i,set]of cycle.sets.entries()){
   identities.push(set.id);assert.deepEqual(set.targets,key?{[key]:{min:center-1,max:center+1}}:{});
   assert.equal(set.rir,key?Math.max(0,base+adjustments[cycle.sets.length][i]):null);assert.equal(set.restSeconds,null);
  }
 }}
 assert.equal(singlePrimaries,4);assert.equal(new Set(identities).size,identities.length);
 for(let cycle=1;cycle<=7;cycle++){
  const delivered=Compiler.prescriptionsForCycle(definition,cycle);
  const original=definition.days.flatMap(day=>day.slots.flatMap(slot=>slot.prescriptionsByCycle[cycle-1].sets.map(set=>({set,slot}))));
  assert.equal(delivered.length,original.length);
  for(const [i,{set,slot}]of original.entries()){
   assert.equal(delivered[i].slotId,slot.id);assert.deepEqual(delivered[i].targets,set.targets);assert.equal(delivered[i].rir,set.rir);
  }
 }
 for(const patch of [{experience:'beginner'},{experience:'intermediate'},{goal:'hypertrophy'},{goal:'strength'},
  {periodization:'linear'},{periodization:'reverse_linear'},{periodization:'undulating'}]){
  const supported={...request,...patch};assert.equal(Compiler.generateProgram(supported,catalog).ok,true,'option20 composes with recovered experience, goal and periodization rules');
  assert.equal(Compiler.availableSplits(supported).includes('upper_lower_full'),true);
 }
 for(const patch of [{cycles:8},{deloadCycles:[7]}]){
  const outside={...request,...patch};assert.equal(Compiler.generateProgram(outside,catalog).ok,false,'seven normal positions remain mandatory');
  assert.equal(Compiler.availableSplits(outside).includes('upper_lower_full'),false);
 }
 const exhausted=Compiler.generateProgram({...request,gymProfile:{equipmentIds:[]}},catalog);
 assert.equal(exhausted.ok,false);assert.equal(exhausted.value,null);
});
test('entry mapping and setup recipe carry option20, canonical request and exact definition',async()=>{
 const definition=generated();
 const mapped=Adapter.programRequestFromAnswers({desiredResult:'balanced',structuredExperience:'over_24m',daysPerWeek:3,
  sessionMinutes:20,environment:{kind:'commercial_gym'},splitPreference:'upper_lower_full',competencyAnswers:competencies,
  deEmphasizedMuscles:['chest','lats','back','side_delts','front_delts','rear_delts','biceps','triceps'],block:{cycles:7,periodization:'static'},deload:false},catalog);
 assert.equal(mapped.ok,true);assert.deepEqual(Compiler.canonicalizeRequest(mapped.value,catalog).value,definition.request);
 assert.deepEqual(Compiler.generateProgram({...request,split:'auto'},catalog).value,definition);
 const options={builtInIds:new Set(catalog.exercises.map(e=>e.id)),catalogSnapshot:catalog,
  validateProgramDefinition:Compiler.validateProgramDefinition,generateProgram:Compiler.generateProgram,generatorVersion:Compiler.GENERATOR_VERSION};
 const proposal={kind:'taurifer-shared-setup',version:2,program:{name:'Source option20',definition,customExercises:[]},
  settings:{jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,unit:'kg',lang:'en',rirMode:'numeric'},language:'en'};
 const encoded=await Setup.encode(proposal,options);assert.equal(encoded.ok,true,JSON.stringify(encoded));
 assert.equal(encoded.form,'recipe');assert(encoded.value.length<=3072);
 const decoded=await Setup.decode(encoded.value,options);assert.equal(decoded.ok,true,JSON.stringify(decoded));assert.deepEqual(decoded.value,proposal);
});

test('shorter-session transition preserves recovered option20 and its predecessor',()=>{
 const Transition=require('../src/training/generation.js').transition;
 const previous=Compiler.generateProgram({...request,timeCeilingMinutes:60},catalog);
 assert.equal(previous.ok,true);const saved=JSON.stringify(previous.value);
 for(const [minutes,budget] of [[20,18],[40,30]]){
  const derived=Transition.deriveSuccessor({programDefinition:previous.value,customExerciseDefinitions:[],catalogSnapshot:catalog,
   change:{kind:'shorter_sessions',sessionMinutes:minutes}});
  assert.equal(derived.ok,true,JSON.stringify(derived));
  assert.equal(derived.value.programDefinition.request.timeCeilingMinutes,minutes);
  assert.equal(derived.value.programDefinition.provenance.generationBudgetMinutes,budget);
  assert.equal(Compiler.validateProgramDefinition(derived.value.programDefinition,catalog).ok,true);
 }
 // A target below the shortest option cannot silently become a longer session.
 for(const minutes of [15,19]){
  const refused=Transition.deriveSuccessor({programDefinition:previous.value,customExerciseDefinitions:[],catalogSnapshot:catalog,
   change:{kind:'shorter_sessions',sessionMinutes:minutes}});
  assert.equal(refused.ok,false);assert.equal(refused.code,'minutes_unsupported');
 }
 assert.equal(JSON.stringify(previous.value),saved);
});
