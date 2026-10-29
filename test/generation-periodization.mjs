import assert from 'node:assert/strict';
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
 for(const goal of ['hybrid','hypertrophy','strength'])for(const timeCeilingMinutes of [20,40,60,90,120,150])for(const experience of ['beginner','intermediate','advanced']){
  assert(Compiler.availableSplits({...next,goal,timeCeilingMinutes,experience}).includes('upper_lower_full'),'recovered independent dimensions compose across all supported goals, times and experiences');
 }
 // Plan 076: four to ten regular weeks and at most one first or last lighter week.
 for(const change of [{cycles:3},{cycles:11},{cycles:12,deloadCycles:[12]},{deloadCycles:[4]},{daysPerWeek:2},{daysPerWeek:1}]){
  assert.equal(Compiler.generateProgram({...next,...change},catalog).ok,false,'invalid normal-cycle count or incompatible frequency is refused');
  assert.equal(Compiler.availableSplits({...next,...change}).includes('upper_lower_full'),false);
 }
}

// ---- Plan 076: variable block length --------------------------------------
const Policy = require('../engine-policy.js');
{
 // OD-2: seven weeks read the table unchanged; linear and reverse linear keep both endpoints at every length; undulating repeats.
 assert.deepEqual(Array.from({length:7},(_,w)=>Policy.periodizationPosition('linear',w+1,7)),[0,1,2,3,4,5,6]);
 assert.deepEqual(Array.from({length:4},(_,w)=>Policy.periodizationPosition('linear',w+1,4)),[0,2,4,6]);
 assert.deepEqual(Array.from({length:10},(_,w)=>Policy.periodizationPosition('reverse_linear',w+1,10)),[0,1,1,2,3,3,4,5,5,6]);
 assert.deepEqual(Array.from({length:10},(_,w)=>Policy.periodizationPosition('undulating',w+1,10)),[0,1,2,3,4,5,6,0,1,2]);
 assert.throws(()=>Policy.periodizationPosition('linear',0,7),RangeError);
}
const { baselineCases, digestOf } = await import('../tools/record-generator-baseline.mjs');
{
 // The bump guard: 073.5 stamped as 073.4 reproduces every recorded 073.4 result exactly, refusals included.
 const recorded = JSON.parse(require('node:fs').readFileSync(new URL('./fixtures/generator-073-4-digests.json', import.meta.url), 'utf8'));
 assert.equal(recorded.generatorVersion, '073.4');
 assert.ok(Compiler.BASELINE_VERSIONS.includes('073.4') && Compiler.GENERATOR_VERSION === '073.5');
 const cases = baselineCases();
 assert.equal(cases.length, Object.keys(recorded.digests).length);
 for (const { key, request: caseRequest } of cases)
  assert.equal(digestOf(Compiler.generateProgram(caseRequest, catalog, { asVersion: '073.4' })), recorded.digests[key], `${key}: identical to 073.4`);
 // Unstamped, the same seven weeks differ only in version stamps and the IDs derived from them.
 const { request: sample } = cases.find(item => item.key.startsWith('block|linear|deload'));
 const strip = value => JSON.parse(JSON.stringify(value).replace(/"(day|slot|set)-[0-9a-f.]+"/g, '"$1-*"').replace(/"073\.[45]"/g, '"073.x"'));
 const old = Compiler.generateProgram(sample, catalog, { asVersion: '073.4' }).value, now = Compiler.generateProgram(sample, catalog).value;
 assert.equal(now.generatorVersion, '073.5'); assert.notEqual(JSON.stringify(old), JSON.stringify(now));
 assert.deepEqual(strip(now), strip(old), 'seven weeks are structurally unchanged by the bump');
 // asVersion is a closed list, and an earlier version keeps its own domain and refusal.
 assert.equal(Compiler.generateProgram(sample, catalog, { asVersion: '072.1' }).conflicts[0].code, 'unsupported_generator_version');
 const fiveWeeks = { ...sample, cycles: 5, deloadCycles: [] };
 const legacy = Compiler.generateProgram(fiveWeeks, catalog, { asVersion: '073.4' });
 assert.equal(legacy.ok, false); assert.match(legacy.conflicts[0].message, /seven normal cycles/);
}
{
 // OD-1/OD-3: four to ten regular weeks with one optional first or last lighter week.
 const base = {...request, periodization:'linear'};
 for (const [cycles, deloadCycles] of [[4,[]],[6,[6]],[10,[]],[11,[1]],[11,[11]]]) {
  const built = Compiler.generateProgram({...base, cycles, deloadCycles}, catalog);
  assert.equal(built.ok, true, `${cycles} cycles with deload ${deloadCycles}`);
  assert.equal(built.value.cycles, cycles); assert.deepEqual(built.value.deloadCycles, deloadCycles);
  const slot = built.value.days.find(d=>d.kind==='training').slots[0];
  assert.equal(slot.prescriptionsByCycle.length, cycles);
  const regular = slot.prescriptionsByCycle.filter(c=>!deloadCycles.includes(c.cycleIndex)).map(c=>c.sets[0].targets);
  const seven = Compiler.generateProgram({...base, cycles:7, deloadCycles:[]}, catalog).value.days.find(d=>d.kind==='training').slots[0]
   .prescriptionsByCycle.map(c=>c.sets[0].targets);
  assert.deepEqual([regular[0], regular.at(-1)], [seven[0], seven[6]], `${cycles - deloadCycles.length} regular weeks keep the curve's endpoints`);
  assert.ok(Compiler.validateProgramDefinition(built.value, catalog).ok);
 }
 const undulating = Compiler.generateProgram({...request, periodization:'undulating', cycles:10, deloadCycles:[]}, catalog).value
  .days.find(d=>d.kind==='training').slots[0].prescriptionsByCycle.map(c=>JSON.stringify(c.sets[0].targets));
 assert.deepEqual(undulating.slice(7), undulating.slice(0, 3), 'undulating repeats its seven-step sequence');
}
{
 // A program reviewed under 073.4 keeps its recovered duration estimate after the bump.
 const reviewed = structuredClone(Compiler.generateProgram(request, catalog, { asVersion: '073.4' }).value);
 const day = reviewed.days.find(d=>d.kind==='training');
 const mark = version => { const copy = structuredClone(day);
  for (const slot of copy.slots) for (const cycle of slot.prescriptionsByCycle) for (const set of cycle.sets) set.provenance = { source:'lifter_review', policyVersion:version };
  return copy; };
 assert.equal(Compiler.estimateDaySeconds(mark('073.4'), 1, catalog), Compiler.estimateDaySeconds(mark('073.5'), 1, catalog),
  'a 073.4 review keeps the recovered time model');
 assert.notEqual(Compiler.estimateDaySeconds(mark('070.1'), 1, catalog), undefined);
}
console.log('generation-periodization: three real-catalog modes, adapter, source schedules, expanded domain boundaries and Plan 076 block lengths PASS');
