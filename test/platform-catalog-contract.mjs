import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCatalog} from '../src/platform/catalog.js';
import {sha256Text} from '../src/training/identity.js';
const pinned=source=>({catalogSha256:sha256Text(source),fetcher:async()=>({ok:true,text:async()=>source})});
test('native catalog exposes the exact verified immutable release and retries failed requests',async()=> {
  const source=readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8');
  let count=0;
  const reader=createCatalog({...pinned(source),fetcher:async()=>({ok:++count>1,text:async()=>source})});
  const attempt=reader.load();assert.equal(reader.load(),attempt);
  await assert.rejects(attempt,/could not be loaded/);
  assert.throws(()=>reader.snapshot(),/Await/);
  const catalog=await reader.load();
  assert.ok(Object.isFrozen(catalog));assert.ok(Object.isFrozen(catalog.exercises[0]));
  assert.equal(reader.getExercise(catalog.exercises[0].id),catalog.exercises[0]);
  assert.equal(reader.getObject(catalog.exercises[0].id),catalog.uuidIndex[catalog.exercises[0].id]);
  assert.equal(await reader.load(),catalog);
});
test('catalog refuses malformed reader fields even when a supplied integrity pin matches their bytes',async()=> {
  const envelope={generatedAt:'fixture',exercises:[{id:'movement',exerciseMetrics:['metric']}],uuidIndex:{metric:{type:'exerciseMetric'}}};
  const cases=[
    {...envelope,exercises:[null]},
    {...envelope,exercises:[{id:7}]},
    {...envelope,exercises:[{id:'movement',exerciseMetrics:[7]}]},
    {...envelope,uuidIndex:{metric:null}},
    {...envelope,uuidIndex:{equipment:{type:'equipment',pluralOf:true}}},
    {...envelope,uuidIndex:{group:{type:'supportEquipmentGroup',equipment:[null]}}},
  ];
  for(const malformed of cases){const source=JSON.stringify(malformed);const reader=createCatalog(pinned(source));await assert.rejects(reader.load(),/invalid shape/);assert.throws(()=>reader.snapshot(),/Await/);}
});
test('catalog equipment and name readers share one instance and preserve ambiguity rules',async()=> {
  const source=JSON.stringify({generatedAt:'fixture',exercises:[{id:'movement',exerciseMetrics:['metric'],resistanceEquipmentGroupIds:['group'],supportEquipmentGroupIds:[]}],uuidIndex:{metric:{type:'exerciseMetric'},bar:{type:'equipment'},plates:{type:'equipment',pluralOf:'bar'},group:{type:'resistanceEquipmentGroup',equipment:['bar']}}});
  const reader=createCatalog({...pinned(source),librarySource:{library:[{id:'movement',name:'Press',namePt:'Supino',aliases:['Bench']}]}});
  await reader.load();
  assert.deepEqual([...reader.equipmentClosure(['plates'])],['plates','bar']);
  assert.equal(reader.isAvailable('movement',['plates']),true);
  assert.equal(reader.isAvailable('movement',[]),false);
  assert.equal(reader.metricsFor('movement')[0].type,'exerciseMetric');
  assert.equal(reader.resolveName(' supino ').by,'alias');
  assert.equal(reader.search('bench')[0].id,'movement');
});
