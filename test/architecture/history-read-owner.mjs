/** Actual captured History owner with literal scope, naming and cache oracles. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHistoryReadModels} from '../../src/app/history-read-models.js';
import {createWorkoutReadModel} from '../../src/app/workout-model.js';
import {createProgramModel} from '../../src/training/model.js';
import {createExerciseLabels} from '../../src/ui/exercise-labels.js';
const catalog=JSON.parse(readFileSync(new URL('../../assets/exercise-catalog.json',import.meta.url)));
const model=createProgramModel({catalog,nextId:()=>{throw Error('History must not allocate identity')},now:()=>{throw Error('History must not read clock')},calendarDate:()=>{throw Error('History must receive today')}});
const workout=createWorkoutReadModel({catalog,librarySource:{library:[]},model});
const labels=createExerciseLabels({builtIns:new Map(),readCustom:()=>{throw Error('live custom lookup')},language:()=>{throw Error('live locale lookup')}});
const base={exerciseId:'reused-slot',performedLibraryId:'custom:press',performedName:'Source press',name:'Source press',day:'Day 1',set:1,reps:8,rir:2,primary:'Chest',secondary:'',warmup:false};
const log=[{...base,session:'older',date:'2026-10-01',load:40},{...base,session:'current',date:'2026-10-03',load:45},
 {...base,session:17,date:'2026-09-30',load:200,performedLibraryId:'custom:other',performedName:'Different movement'}];
const initial={program:[{id:'reused-slot',day:'Day 1',name:'Coach renamed press',libraryId:'custom:press',sets:2,min:6,max:10,primary:'Chest',secondary:''}],
 programMeta:{id:'current-program',name:'Current block',started:'2026-10-01',mesocycleLengthWeeks:6},settings:{unit:'kg'},log,
 customExercises:[{id:'custom:press',name:'Source press',namePt:'Pressão',primary:'Chest',secondary:''}],
 programHistory:[{meta:{name:'Archived block',started:'2026-08-01'},completedAt:'2026-09-01T12:00:00.000Z',program:[{day:'Prior A'},{day:'Prior B'}]}],_storageRevision:11};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
freeze(initial);let facts={snapshot:initial,locale:'en-US',language:'en',today:'2026-10-04',weekdayLetters:['M','T','W','T','F','S','S'],dayMeta:initial.programMeta};
const owner=createHistoryReadModels({model,workout,labels,read:()=>facts,copy:{t:key=>key,dayLabel:(day,meta)=>`${meta?.name}:${day}`}});
owner.diagnostics.reset();const before=JSON.stringify(initial),index=owner.index(log);
assert.throws(()=>{owner.row(log[0]).reading.load=999},TypeError,'cached readings cannot be mutated by a query consumer');
assert.strictEqual(owner.index(log),index,'unchanged published capture reuses index');
assert.strictEqual(owner.row(log[0]),owner.row(log[0]),'row facts belong to this immutable capture');
assert.equal(owner.diagnostics.builds,1);assert.equal(owner.diagnostics.sourceRowVisits,3);
assert.deepEqual(index.sessions.map(session=>session.session),['current','older',17],'numeric saved identities remain numeric');
assert.equal(owner.search(index,'coach renamed').length,2,'search aliases follow movement identity');
assert.equal(owner.search(index,'different movement').length,1);
assert.equal(index.rowFacts.get(log[0]).storedName,'Source press','performed name is never replaced by current slot alias');
assert.equal(owner.outcome([log[1]]).status,'improved','45×8 improves over same-movement40×8, not reused-slot200×8');
assert.equal(owner.context().block.planned,1);assert.equal(owner.context().block.archived[0].planned,2);
assert.equal(owner.context().revision,11);assert.equal(owner.context().dayLabels['Day 1'],'Current block:Day 1');
facts={...facts,language:'pt',locale:'pt-BR'};
const portuguese=owner.index(log);assert.notStrictEqual(portuguese,index,'locale changes invalidate index and row facts');
assert.equal(owner.row(log[0]).name,'Pressão');assert.equal(owner.row(log[0]).storedName,'Source press');
const next={...initial,program:initial.program.map(row=>({...row,name:'Second alias'})),programMeta:{...initial.programMeta,name:'Next block'},_storageRevision:12};freeze(next);
facts={...facts,snapshot:next,dayMeta:next.programMeta};const renamed=owner.index(log);
assert.notStrictEqual(renamed,portuguese,'same log with changed program invalidates aliases');
assert.equal(owner.search(renamed,'second alias').length,2);assert.equal(owner.search(renamed,'coach renamed').length,0);
assert.equal(owner.context().revision,12);assert.equal(owner.context().dayLabels['Day 1'],'Next block:Day 1');
const side={...base,session:'unknown-side',load:45,metricType:'source_metrics@1',metricIds:['25a5c6f170d880e2990fc88146f7de56','2555c6f170d88072bbf6d9ad3f16ea86'],
 metricDefinitions:[{id:'25a5c6f170d880e2990fc88146f7de56',semantic:'loadPerSideKg',unit:'kg',sourceName:'Weight per side'},{id:'2555c6f170d88072bbf6d9ad3f16ea86',semantic:'reps',unit:'reps',sourceName:'Reps'}],
 metricValues:[{metricId:'25a5c6f170d880e2990fc88146f7de56',value:45,unit:'kg'},{metricId:'2555c6f170d88072bbf6d9ad3f16ea86',value:8,unit:'reps'}],loadingContext:{externalLoadMultiplier:null}};
assert.equal(owner.outcome([side]).status,'not_comparable','unknown per-side multiplier cannot become scalar comparison');
assert.equal(JSON.stringify(initial),before,'cache/index/outcome cannot mutate acknowledged bytes');
console.log('PASS captured History queries: cache reuse/invalidation, immutable names, movement scope, numeric identity, block facts and per-side refusal');
