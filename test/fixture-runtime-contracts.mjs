import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeFixture} from '../tools/fixture-output.mjs';
import {createFixtureRuntime} from '../tools/app-runtime-harness.mjs';

const ambientNames=['window','document','localStorage','sessionStorage','location','indexedDB','navigator'];
const ambient=new Map(ambientNames.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
const api=await createFixtureRuntime();
for(const name of ambientNames)assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis,name),ambient.get(name),`fixture runtime does not install ambient ${name}`);
const fixture=JSON.parse(readFileSync(new URL('./fixtures/seed-program-v067.json',import.meta.url),'utf8'));
const candidate=api.normalizeLoaded({...fixture,settings:{},log:[],customExercises:[],programHistory:[]});
assert.equal(await api.storageIO.writeLocal(candidate),true);
await api.storageIO.writeIdb(candidate);
const local=api.readLocalStatus(),idb=await api.readIdbStatus();
assert.equal(local.status,'valid');assert.equal(idb.status,'valid');
const selected=api.chooseSnapshot(local,idb);
assert.equal(selected.kind,'chosen');
assert.deepEqual(api.normalizeLoaded(selected.snapshot),candidate,'real snapshot policy and both production replica readers agree');
const second=await createFixtureRuntime();
assert.equal(second.readLocalStatus().status,'absent','factory instances do not share local memory');
assert.equal((await second.readIdbStatus()).status,'absent','factory instances do not share IDB memory');
const directory=mkdtempSync(join(tmpdir(),'taurifer-fixture-output-'));
try{
  const path=join(directory,'fixture.json');writeFileSync(path,'saved bytes');
  assert.equal(writeFixture(path,'saved bytes',{check:true}),'verified');
  assert.throws(()=>writeFixture(path,'drifted bytes',{check:true}),/Fixture bytes differ/);
  assert.equal(readFileSync(path,'utf8'),'saved bytes','failed check leaves archived bytes unchanged');
}finally{rmSync(directory,{recursive:true,force:true});}
console.log('PASS isolated public fixture runtime, replica round trip and no-write archive check');
