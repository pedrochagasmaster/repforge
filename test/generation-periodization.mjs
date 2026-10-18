import {Adapter as NativeAdapter} from './fixtures/training-runtime.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Compiler = require('../src/training/generation.js');
const Adapter = NativeAdapter;
const catalog = require('../src/training/identity.js').prepareCatalog(require('../assets/exercise-catalog.json'));
const request = {goal:'hybrid',experience:'advanced',daysPerWeek:3,split:'upper_lower_full',timeCeilingMinutes:60,periodization:'static',cycles:7,deloadCycles:[],gymProfile:{equipmentIds:Object.entries(catalog.uuidIndex).filter(([,r])=>r.type==='equipment'&&r.commercialGym===1).map(([id])=>id)},competencyAnswers:Object.fromEntries(['pullups10','pullups5','pushups15','inclineBarbell10','overheadPress10','bodyweightDips10','benchPress10'].map(k=>[k,true])),emphasisMuscleIds:[],deprioritizedMuscleIds:[]};
// Independent source schedules, not calculated by the compiler under test.
const centers = {
 linear:{primary:[[8,8,6,5,5,3,3],[12,12,10,9,8,6,6]],secondary:[[15,15,13,11,10,8,8],[15,15,13,11,10,8,8]],accessory:[[20,20,17,15,13,10,10],[20,20,17,15,13,10,10]]},
 reverse_linear:{primary:[[3,3,5,5,6,8,8],[6,6,8,9,10,12,12]],secondary:[[8,8,10,11,13,15,15],[8,8,10,11,13,15,15]],accessory:[[10,10,13,15,17,20,20],[10,10,13,15,17,20,20]]},
 undulating:{primary:[[8,5,3,8,5,6,3],[12,9,6,12,8,10,6]],secondary:[[15,11,8,15,10,13,8],[15,11,8,15,10,13,8]],accessory:[[20,15,10,20,13,17,10],[20,15,10,20,13,17,10]]},
};
const pullIds=new Set(['19e5c6f170d88009ba40c03d2f6271df','19e5c6f170d8808fbc7ffe35bc0bf0ca']);
const adjustments={1:[0],2:[0,-1],3:[1,0,-1],4:[1,0,0,-1],5:[1,0,0,-1,-1],6:[1,1,0,0,-1,-1]};
const assembly=d=>d.days.map(day=>({kind:day.kind,name:day.name,slots:day.slots.map(s=>[s.exerciseId,s.role,s.prescriptionsByCycle.map(c=>c.sets.length)])}));
const baseline=Compiler.generateProgram(request,catalog);assert.equal(baseline.ok,true);
for(const mode of Object.keys(centers)) {
 const next={...request,periodization:mode};const result=Compiler.generateProgram(next,catalog);
 assert.equal(result.ok,true,`${mode}: recovered seven-cycle source domain must generate: ${JSON.stringify(result.conflicts)}`);
 assert.deepEqual(assembly(result.value),assembly(baseline.value),'periodization preserves real-catalog assembly by position, independent of request-derived IDs');
 assert.deepEqual(Compiler.generateProgram({...next,split:'auto'},catalog),result,'automatic split uses the same recovered mode');
 assert(Compiler.availableSplits(next).includes('upper_lower_full'));
 for(const day of result.value.days)for(const slot of day.slots){
  const role=slot.role.endsWith('Accessory')?'accessory':slot.role.endsWith('PrimaryCompound')?'primary':'secondary';
  const raw=catalog.exercises.find(exercise=>exercise.id===slot.exerciseId);
  const key=raw.exerciseMetrics.includes('2555c6f170d88072bbf6d9ad3f16ea86')?'reps':raw.exerciseMetrics.includes('25a5c6f170d880baaa2dc8c7b67d4b65')?'repsPerSide':null;
  const pull=Number(raw.movementPattern.some(id=>pullIds.has(id)));
  for(const [i,cycle] of slot.prescriptionsByCycle.entries())for(const set of cycle.sets){
   assert.deepEqual(set.targets,key?{[key]:{min:centers[mode][role][pull][i]-1,max:centers[mode][role][pull][i]+1}}:{});
   assert.equal(set.rir,key?Math.max(0,(role==='accessory'?0:pull?1:2)+adjustments[cycle.sets.length][set.setIndex-1]):null);
   assert.equal(set.provenance.periodization,mode);assert.equal(set.restSeconds,null);
  }
  assert.equal(new Set(slot.prescriptionsByCycle.flatMap(c=>c.sets.map(s=>s.id))).size,slot.prescriptionsByCycle.reduce((n,c)=>n+c.sets.length,0),'equal-target repeated positions retain distinct set identities');
 }
 const answers={desiredResult:'balanced',structuredExperience:'over_24m',daysPerWeek:3,sessionMinutes:60,environment:{kind:'commercial_gym'},splitPreference:'upper_lower_full',block:{cycles:7,periodization:mode},deload:false};
 const mapped=Adapter.programRequestFromAnswers(answers,catalog);assert.equal(mapped.ok,true);assert.equal(mapped.value.split,'upper_lower_full');assert.equal(mapped.value.periodization,mode);
 for(const goal of ['hybrid','hypertrophy','strength'])for(const timeCeilingMinutes of [20,40,60,90,120,150])for(const experience of ['beginner','intermediate','advanced']){
  assert(Compiler.availableSplits({...next,goal,timeCeilingMinutes,experience}).includes('upper_lower_full'),'recovered independent dimensions compose across all supported goals, times and experiences');
 }
 for(const change of [{cycles:8},{deloadCycles:[7]},{daysPerWeek:2},{daysPerWeek:1}]){
  assert.equal(Compiler.generateProgram({...next,...change},catalog).ok,false,'invalid normal-cycle count or incompatible frequency is refused');
  assert.equal(Compiler.availableSplits({...next,...change}).includes('upper_lower_full'),false);
 }
}
console.log('generation-periodization: three real-catalog modes, adapter, source schedules and expanded domain boundaries PASS');
