import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {corpusCases} from './program-compiler-corpus-cases.mjs';
export default async function runProof() {
const require=createRequire(import.meta.url);
const Compiler=require('../../program-compiler.js'), Policy=require('../../engine-policy.js');
const Adapter=require('../../program-entry-adapter.js'), Catalog=require('../../assets/exercise-catalog.json');
require('../../generation-identity.js').prepareCatalog(Catalog);
const expected=require('./programlab-default-results.json');
const cases=corpusCases({Adapter,Catalog});
const defaults=Policy.getDefaultEnginePolicy();
for (const [index, {key,request}] of cases.entries()) {
  const plain=Compiler.generateProgram(request,Catalog);
  assert.equal(createHash('sha256').update(JSON.stringify(plain)).digest('hex'),expected.results[index].sha256,key);
  assert.equal(expected.results[index].key,key);
  assert.equal(JSON.stringify(Compiler.generateProgram(request,Catalog,{enginePolicy:defaults})),JSON.stringify(plain),key);
  const traced=Compiler.generateProgram(request,Catalog,{diagnostics:'allocation-lineage@1'});
  const {diagnostics,...without}=traced;
  assert.equal(JSON.stringify(without),JSON.stringify(plain),key);
  assert.equal(diagnostics.version,'allocation-lineage@1');
}
const request=cases.find(c=>c.key.startsWith('muscle_growth|6_to_24m|4|everything|90')).request;
assert.equal(Compiler.generateProgram(request,Catalog,{enginePolicy:null}).conflicts[0].code,'invalid_engine_policy');
assert.equal(Compiler.generateProgram(request,Catalog,{diagnostics:'unknown@1'}).conflicts[0].code,'invalid_diagnostics');
assert.deepEqual(Compiler.normalizeProgramRequest(request,Catalog),Compiler.canonicalizeRequest(request,Catalog));
const candidate=structuredClone(defaults);
Object.keys(candidate.volume.setsByType).forEach(k=>candidate.volume.setsByType[k]=2);
Object.keys(candidate.prescription.baseRirByClass).forEach(k=>candidate.prescription.baseRirByClass[k]=k==='assistance'?0:1);
const result=Compiler.generateProgram(request,Catalog,{enginePolicy:candidate,diagnostics:'allocation-lineage@1'});
assert.equal(result.ok,true,JSON.stringify(result.conflicts));
assert.equal(result.value.provenance.source,'experimental_policy');
assert.equal(Compiler.validateProgramDefinition(result.value,Catalog).ok,true);
assert.equal(new Set(result.diagnostics.slots.map(slot=>slot.lineage)).size,result.diagnostics.slots.length);
for (const day of result.value.days.filter(day=>day.kind==='training')) for(const slot of day.slots) {
  const sets=slot.prescriptionsByCycle[0].sets;
  assert.equal(sets.length,2);
  assert.deepEqual(sets.map(s=>s.rir),slot.role.endsWith('Accessory')?[0,0]:[1,0]);
}
const deloadRequest={...request,cycles:8,deloadCycles:[8]};
const deload=Compiler.generateProgram(deloadRequest,Catalog,{enginePolicy:candidate});
assert.equal(deload.ok,true);
for(const slot of deload.value.days.flatMap(d=>d.slots)) {
  const sets=slot.prescriptionsByCycle[7].sets;
  assert.equal(sets.length,1,'native floor(0.8*2) retains one');
  assert.equal(sets[0].rir,slot.role.endsWith('Accessory')?3:4,'add native three RIR to normal first-set target');
}
const slower=structuredClone(defaults); slower.timeModel.secondsPerSet=60;
const day=result.value.days.find(d=>d.kind==='training');
assert.ok(Compiler.estimateDaySeconds(day,1,Catalog,{enginePolicy:slower})>Compiler.estimateDaySeconds(day,1,Catalog,{enginePolicy:defaults}));
console.log('180 full-result hashes, explicit defaults, diagnostic noninterference, native two-set dose and deload precedence passed');

}
