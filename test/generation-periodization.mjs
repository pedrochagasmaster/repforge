import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Compiler = require('../program-compiler.js');
const Adapter = require('../program-entry-adapter.js');
const catalog = require('../generation-identity.js').prepareCatalog(require('../assets/exercise-catalog.json'));
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
 for(const change of [{timeCeilingMinutes:40},{goal:'hypertrophy'},{goal:'strength'},{experience:'intermediate'},{cycles:8},{deloadCycles:[7]}]){
  assert.equal(Compiler.generateProgram({...next,...change},catalog).ok,false,'periodized expansion cannot free another input dimension');
  assert.equal(Compiler.availableSplits({...next,...change}).includes('upper_lower_full'),false);
 }
}
// The real 60-minute assembly cannot supply every 1..6 set-count/role/metric
// combination. Inject only the public layout seam; execute the actual compiler
// boundary and target producer with real catalog rows and source metric UUIDs.
const source=fs.readFileSync(new URL('../program-compiler.js',import.meta.url),'utf8');
function controlledCompiler(templates){
 const previousLayout=globalThis.RepForgeGenerationLayout,previousCompiler=globalThis.RepForgeProgramCompiler;
 try{
  globalThis.RepForgeGenerationLayout={generate:()=>({status:'ok',days:['Upper','Lower','Full'].map((name,index)=>({name,templates:[templates[index]]})),weeklySlots:[0,null,1,null,2,null,null],budgetMinutes:50,estimatedSessionSeconds:[60,60,60]})};
  const module={exports:{}};new Function('module','exports','require',source)(module,module.exports,createRequire(new URL('../program-compiler.js',import.meta.url)));return module.exports;
 }finally{globalThis.RepForgeGenerationLayout=previousLayout;globalThis.RepForgeProgramCompiler=previousCompiler;}
}
const realIds=baseline.value.days.flatMap(day=>day.slots).slice(0,3).map(s=>s.exerciseId);
const metricCases=[['2555c6f170d88072bbf6d9ad3f16ea86','reps'],['25a5c6f170d880baaa2dc8c7b67d4b65','repsPerSide'],['2555c6f170d88063941ef7c8956d760c',null]];
const controlledCatalogs=new Map(metricCases.map(([metric])=>{
 const exercises=realIds.map(id=>({...catalog.exercises.find(r=>r.id===id),exerciseMetrics:[metric],laterality:[]}));
 return [metric,require('../generation-identity.js').prepareCatalog({...catalog,exercises})];
}));
let boundaryCases=0;
for(const mode of Object.keys(centers))for(const role of ['primary','secondary','accessory'])for(const pull of [0,1])for(let n=1;n<=6;n++)for(const [metric,key] of metricCases){
 const altered=controlledCatalogs.get(metric);
 const templates=altered.exercises.map(raw=>({exercise:{id:raw.id,raw,patterns:pull?['horizontalPull']:['horizontalPush']},type:role,numSets:n,accessoryMuscle:role==='accessory'?'chest':null}));
 const compiler=controlledCompiler(templates);const r=compiler.generateProgram({...request,periodization:mode,executionContexts:Object.fromEntries(realIds.map(id=>[id,'bilateral']))},altered);assert.equal(r.ok,true,JSON.stringify(r.conflicts));
 const slot=r.value.days[0].slots[0];const base=role==='accessory'?0:pull?1:2;
 for(const [i,cycle] of slot.prescriptionsByCycle.entries()){
  assert.equal(cycle.sets.length,n);
  for(const [j,set] of cycle.sets.entries()){
   assert.deepEqual(set.targets,key?{[key]:{min:centers[mode][role][pull][i]-1,max:centers[mode][role][pull][i]+1}}:{});
   assert.equal(set.rir,key?Math.max(0,base+adjustments[n][j]):null);assert.equal(set.restSeconds,null);
  }
 }
 boundaryCases++;
}
console.log(`generation-periodization: three real-catalog modes, split/adapter gates, repeated identities, ${boundaryCases} controlled dose boundaries PASS`);
