import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.REPFORGE_REPO_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Load the actual public native graph from the selected checkout; an override
// names a native module entry, never source text re-evaluated in a fake realm.
const Compiler=await import(pathToFileURL(process.env.REPFORGE_COMPILER_SOURCE||path.join(root,'src/training/generation.js')));
const identity=await import(pathToFileURL(path.join(root,'src/training/identity.js')));
const fixture=JSON.parse(fs.readFileSync(process.env.REPFORGE_SOURCE_FIXTURE||new URL('./fixtures/source-generation-v073.json',import.meta.url),'utf8'));
const catalog=identity.prepareCatalog(JSON.parse(fs.readFileSync(path.join(root,'assets/exercise-catalog.json'),'utf8')));
const metricCases=[['2555c6f170d88072bbf6d9ad3f16ea86','reps'],['25a5c6f170d880baaa2dc8c7b67d4b65','repsPerSide'],['2555c6f170d88063941ef7c8956d760c',null]];
const catalogs=new Map(metricCases.map(([metric])=>[metric,identity.prepareCatalog({...catalog,exercises:catalog.exercises.map(raw=>({...raw,exerciseMetrics:[metric],laterality:[]}))})]));
const request={goal:'hybrid',experience:'advanced',daysPerWeek:3,split:'full_body',timeCeilingMinutes:60,periodization:'static',cycles:8,deloadCycles:[8],gymProfile:{equipmentIds:Object.entries(catalog.uuidIndex).filter(([,r])=>r.type==='equipment'&&r.commercialGym===1).map(([id])=>id)},competencyAnswers:Object.fromEntries(['pullups10','pullups5','pushups15','inclineBarbell10','overheadPress10','bodyweightDips10','benchPress10'].map(k=>[k,true])),emphasisMuscleIds:[],deprioritizedMuscleIds:fixture.deprioritizedMuscleIds,executionContexts:Object.fromEntries(catalog.exercises.map(raw=>[raw.id,'bilateral']))};
// The production policy's explicit set-count override reaches every dose vector
// through real allocation, candidate selection and compiler validation.
const adjustments={1:[0],2:[0,-1],3:[1,0,-1],4:[1,0,0,-1],5:[1,0,0,-1,-1],6:[1,1,0,0,-1,-1]};
const prefixCounts=[0,1,1,2,3,4,4];
const cases=[];
for(let n=1;n<=6;n++)for(const metric of metricCases)for(const position of [1,8])cases.push({n,metric,position,goal:'hybrid',mode:'linear'});
for(const goal of ['hybrid','hypertrophy','strength'])for(const mode of Object.keys(fixture.schedules))for(const position of [1,8])cases.push({goal,mode,position,n:3,metric:metricCases[0]});
const covered=new Set();
const pullIds=new Set(['19e5c6f170d88009ba40c03d2f6271df','19e5c6f170d8808fbc7ffe35bc0bf0ca']);
const limit=process.env.REPFORGE_SOURCE_CASE_LIMIT?Number(process.env.REPFORGE_SOURCE_CASE_LIMIT):cases.length;
let checked=0;
for(const {goal,mode,position,n,metric}of cases.slice(0,limit)){
 const altered=catalogs.get(metric[0]);
 const policy=structuredClone(Compiler.getDefaultEnginePolicy());
 policy.volume.setsByType={primary:n,secondary:n,accessory:n};
 const result=Compiler.generateProgram({...request,goal,periodization:mode,deloadCycles:[position]},altered,{enginePolicy:policy});assert.equal(result.ok,true,JSON.stringify(result.conflicts));const program=result.value;
 assert.equal(program.cycles,8);assert.deepEqual(program.deloadCycles,[position]);assert.equal(Compiler.validateProgramDefinition(program,altered).ok,true);
 for(const day of program.days)for(const slot of day.slots){
  const type=slot.role.endsWith('PrimaryCompound')?'primary':slot.role.endsWith('Accessory')?'accessory':'secondary';
  const raw=altered.exercises.find(raw=>raw.id===slot.exerciseId);
  const pull=raw.movementPattern.some(id=>pullIds.has(id));
  covered.add(`${goal}/${mode}/${type}/${pull}/${position}`);
  const row=fixture.doseTables.find(t=>t.goal===(goal==='hybrid'?'both':goal)&&t.role===type&&t.pull===pull);const schedule=fixture.schedules[mode];const centers=schedule?schedule.map(i=>row.cycle_table[i]):Array(7).fill(row.center);const key=metric[1];
  assert.deepEqual(slot.prescriptionsByCycle.map(c=>c.cycleIndex),[1,2,3,4,5,6,7,8]);const ordinary=slot.prescriptionsByCycle.filter(c=>c.cycleIndex!==position),deload=slot.prescriptionsByCycle[position-1];
  assert.equal(ordinary.length,7);assert.equal(deload.sets.length,prefixCounts[n]);
  for(const [i,cycle]of ordinary.entries()){
   assert.equal(cycle.sets.length,n);
   for(const [j,set]of cycle.sets.entries()){
    assert.deepEqual(set.targets,key?{[key]:{min:centers[i]-1,max:centers[i]+1}}:{});assert.equal(set.rir,key?Math.max(0,(type==='accessory'?0:pull?1:2)+adjustments[n][j]):null);assert.equal(set.provenance.deload,false);assert.equal(set.restSeconds,null);
   }
  }
  const endpoint=ordinary[position===1?0:6];
  for(const [j,set]of deload.sets.entries()){
   const original=endpoint.sets[j];const expectedRange=key?{min:Math.floor(.8*original.targets[key].min+.5),max:Math.floor(.8*original.targets[key].max+.5)}:null;
   assert.deepEqual(set.targets,key?{[key]:expectedRange}:{});assert.equal(set.rir,key?original.rir+3:original.rir,'transform original prefix RIR without re-vectorizing');assert.equal(set.restSeconds,null);assert.equal(set.provenance.deload,true);assert.equal(set.setIndex,j+1);assert.equal(set.cycleIndex,position);
  }
  assert.equal(new Set(slot.prescriptionsByCycle.flatMap(c=>c.sets.map(s=>s.id))).size,7*n+prefixCounts[n]);
 }
 checked++;
}
if(!process.env.REPFORGE_SOURCE_CASE_LIMIT){
 for(const goal of ['hybrid','hypertrophy','strength'])for(const mode of Object.keys(fixture.schedules))for(const type of ['primary','secondary'])for(const pull of [false,true])for(const position of [1,8])
  assert(covered.has(`${goal}/${mode}/${type}/${pull}/${position}`),`actual programs must exercise ${goal}/${mode}/${type}/${pull}/${position}`);
}
console.log(`generation-source-dose-boundaries: ${checked} actual native programs, all set-count/metric and role/schedule boundaries PASS`);
