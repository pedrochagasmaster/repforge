import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// Defaults are repository-relative when this file is installed under test/.
const root=process.env.REPFORGE_REPO_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'program-compiler.js'));
const fixture=JSON.parse(fs.readFileSync(process.env.REPFORGE_SOURCE_FIXTURE||new URL('./fixtures/source-generation-v073.json',import.meta.url),'utf8'));
const catalog=require('./generation-identity.js').prepareCatalog(require('./assets/exercise-catalog.json'));
const sourcePath=process.env.REPFORGE_COMPILER_SOURCE;
function loadCompiler(){
 if(!sourcePath)return require('./program-compiler.js');
 const before=globalThis.RepForgeProgramCompiler;
 try{const module={exports:{}};new Function('module','exports','require',fs.readFileSync(sourcePath,'utf8'))(module,module.exports,require);return module.exports;}
 finally{globalThis.RepForgeProgramCompiler=before;}
}
const Compiler=loadCompiler();
const base={experience:'advanced',periodization:'static',cycles:7,deloadCycles:[],gymProfile:{equipmentIds:Object.entries(catalog.uuidIndex).filter(([,r])=>r.type==='equipment'&&r.commercialGym===1).map(([id])=>id)},competencyAnswers:Object.fromEntries(['pullups10','pullups5','pushups15','inclineBarbell10','overheadPress10','bodyweightDips10','benchPress10'].map(k=>[k,true])),emphasisMuscleIds:[],deprioritizedMuscleIds:fixture.deprioritizedMuscleIds};
const adjustments={1:[0],2:[0,-1],3:[1,0,-1],4:[1,0,0,-1],5:[1,0,0,-1,-1],6:[1,1,0,0,-1,-1]};
const reps='2555c6f170d88072bbf6d9ad3f16ea86',perSide='25a5c6f170d880baaa2dc8c7b67d4b65';
const pullIds=new Set(['19e5c6f170d88009ba40c03d2f6271df','19e5c6f170d8808fbc7ffe35bc0bf0ca']);
function typeOf(slot){return slot.role.endsWith('PrimaryCompound')?'primary':slot.role.endsWith('Accessory')?'accessory':'secondary';}
const cases=process.env.REPFORGE_SOURCE_CASE_LIMIT?fixture.cases.slice(0,Number(process.env.REPFORGE_SOURCE_CASE_LIMIT)):fixture.cases;
let checked=0;
for(const expected of cases){
 const {days,budgetMinutes,...inputs}=expected;const request={...base,...inputs};
 const result=Compiler.generateProgram(request,catalog);assert.equal(result.ok,true,`${inputs.split}/${inputs.goal}/${inputs.timeCeilingMinutes}: ${JSON.stringify(result.conflicts)}`);
 const program=result.value;assert.equal(program.provenance.source,'recovered_generation_rules');assert.equal(program.provenance.generationBudgetMinutes,budgetMinutes);assert.equal(program.cycles,7);assert.deepEqual(program.deloadCycles,[]);
 const training=program.days.filter(d=>d.kind==='training');
 assert.deepEqual(training.map(d=>({name:d.name,slots:d.slots.map(s=>({exerciseId:s.exerciseId,type:typeOf(s),numSets:s.prescriptionsByCycle[0].sets.length}))})),days,'source-model ordered layout and actual candidate identities');
 assert.equal(Compiler.validateProgramDefinition(program,catalog).ok,true);
 for(const day of training) assert.equal(Compiler.estimateDaySeconds(day,1,catalog),program.provenance.estimatedSessionSeconds[day.id],"source cost reaches preview consumers");
 for(const day of training)for(const slot of day.slots){
  const raw=catalog.exercises.find(r=>r.id===slot.exerciseId);const key=raw.exerciseMetrics.includes(reps)?'reps':raw.exerciseMetrics.includes(perSide)?'repsPerSide':null;
  const role=typeOf(slot),pull=raw.movementPattern.some(p=>pullIds.has(p));const table=fixture.doseTables.find(t=>t.goal===(inputs.goal==='hybrid'?'both':inputs.goal)&&t.role===role&&t.pull===pull);
  assert.equal(slot.prescriptionsByCycle.length,7);
  for(const [i,cycle]of slot.prescriptionsByCycle.entries())for(const [j,set]of cycle.sets.entries()){
   assert.equal(cycle.cycleIndex,i+1);assert.deepEqual(set.targets,key?{[key]:{min:table.center-1,max:table.center+1}}:{});
   assert.equal(set.rir,key?Math.max(0,(role==='accessory'?0:pull?1:2)+adjustments[cycle.sets.length][j]):null);assert.equal(set.restSeconds,null);assert.equal(set.provenance.deload,false);
  }
 }
 if(checked===0){
  const day=training[0],slot=day.slots.find(s=>s.prescriptionsByCycle[0].sets[0].rir!==null);
  const value=slot.prescriptionsByCycle[0].sets[0].rir;
  const edited=require('./program-review.js').applyEdit(program,{kind:'rir',slotId:slot.id,setIndex:1,rir:value<6?value+1:value-1},{compiler:Compiler,catalog});
  assert.equal(edited.ok,true);
  assert.equal(Compiler.estimateDaySeconds(edited.definition.days.find(d=>d.id===day.id),1,catalog),program.provenance.estimatedSessionSeconds[day.id],'an RIR edit preserves the source duration model');
 }
 checked++;
}
if(!process.env.REPFORGE_SOURCE_CASE_LIMIT){
 const defaults={2:'full_body',3:'upper_lower_full',4:'upper_lower_upper_lower',5:'push_pull_legs_upper_lower',6:'push_pull_legs_push_pull_legs'};
 for(const [daysPerWeek,split]of Object.entries(defaults)){
  const inputs={...base,goal:'hybrid',timeCeilingMinutes:60,daysPerWeek:Number(daysPerWeek)};
  assert.deepEqual(Compiler.generateProgram({...inputs,split:'auto'},catalog),Compiler.generateProgram({...inputs,split},catalog),'automatic default follows the source split matrix');
 }
 for(const expected of fixture.cases.filter(c=>c.split!=='full_body')){
  const bad={...base,goal:expected.goal,timeCeilingMinutes:expected.timeCeilingMinutes,split:expected.split,daysPerWeek:expected.daysPerWeek===2?3:2};
  assert.equal(Compiler.generateProgram(bad,catalog).ok,false,'incompatible frequency cannot silently change split');
 }
 for(const daysPerWeek of [0,1,7,'3'])assert.equal(Compiler.generateProgram({...base,goal:'hybrid',timeCeilingMinutes:60,split:'auto',daysPerWeek},catalog).ok,false,'invalid frequency cannot enter residual six-day default');
}
console.log(`generation-source-matrix: ${checked} source-derived assembly cases PASS`);
