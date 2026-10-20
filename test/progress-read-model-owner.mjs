/** Application joins must honor the training-selected pair and convention.
 * Fixed authored inputs and literal outcomes are independent of the join code. */
import assert from 'node:assert/strict';
import {buildStrengthEvidenceRecords,buildStrengthProjection} from '../src/app/progress-read-models.js';
const key='library:fixed',scope='current-block';
const rows=[['older','2026-09-20',35,'old',44.333333333333336],['first','2026-10-02',45,'current',60],['second','2026-10-04',45,'current',57]].map(([session,date,load,blockId,e1rm])=>({
 exerciseId:key,session,sessionKey:session+'\u0000'+blockId,date,blockId,name:'Fixed lift',day:'Day 1',
 load,reps:session==='first'?10:8,rir:1,work:true,strengthComparable:true,strengthConvention:'load',tonnage:load*(session==='first'?10:8),e1rm,
}));
const facts={scope,meta:{started:'2026-10-01',mesocycleLengthWeeks:6,blockId:'current'},program:[{key,name:'Fixed lift',signal:'Hold'}],rows,recordKeys:[key]};
const records=buildStrengthEvidenceRecords(facts);
assert.deepEqual(records.map(({exerciseId,evidenceState,evidenceCount,outcome})=>({exerciseId,evidenceState,evidenceCount,outcome})),[{exerciseId:key,evidenceState:'sufficient',evidenceCount:2,outcome:'declined'}]);
const projection=buildStrengthProjection({...facts,records,prEvents:[{liftKey:key,session:'older',date:'2026-09-20',blockId:'old'},{liftKey:key,session:'second',date:'2026-10-04',blockId:'current'}]});
assert.deepEqual(projection.sessions.map(({session,top,volume})=>({session,top,volume})),[{session:'first',top:45,volume:450},{session:'second',top:45,volume:360}]);
assert.deepEqual(projection.dashboard.map(({latestLoad,latestReps,best,prs})=>({latestLoad,latestReps,best,prs})),[{latestLoad:45,latestReps:8,best:60,prs:1}]);
const missingEffort=buildStrengthEvidenceRecords({...facts,rows:rows.map(row=>row.session==='second'?{...row,rir:null}:row)});
assert.equal(missingEffort[0].evidenceState,'insufficient');assert.equal(missingEffort[0].reason,'missing-effort');assert.equal(missingEffort[0].outcome,undefined);
assert.equal(rows[0].session,'older');assert.equal(rows[2].load,45,'source facts unchanged');
console.log('PASS native Progress join: fixed selected pair, scoped PR/session projection, missing-effort refusal');

// Capture is the production query boundary, not a test projection of app.js.
const {createProgressQueries}=await import('../src/app/progress-read-models.js');
const {createProgramModel}=await import('../src/training/model.js');
const {createWorkoutReadModel}=await import('../src/app/workout-model.js');
const {createExerciseLabels}=await import('../src/ui/exercise-labels.js');
const {createRequire}=await import('node:module');
const catalog=createRequire(import.meta.url)('../assets/exercise-catalog.json');
const model=createProgramModel({catalog,nextId:()=>{throw Error('query allocated identity')},now:'2026-10-10T12:00:00Z'});
const library=[{id:'custom:press',name:'Press',namePt:'Supino',media:'press.webp',mediaBg:'#ffffff'}];
const slot={id:'slot',day:'Day 1',order:1,name:'Press',libraryId:'custom:press',sets:1,min:8,max:10,primary:'Chest'};
const saved=(session,date,reps,extra={})=>({session,date,day:'Day 1',set:1,name:'Press',performedName:'Press',performedLibraryId:'custom:press',exerciseId:'slot',load:40,reps,rir:1,blockId:'current',...extra});
const original={program:[slot],customExercises:library,settings:{unit:'kg',hardRir:4,rirHigh:2,minJump:2.5},programMeta:{id:'program',blockId:'current',started:'2026-10-01',mesocycleLengthWeeks:6},log:[saved('first','2026-10-02',8),saved('second','2026-10-04',10),saved('warmup','2026-10-05',2,{warmup:true,load:90}),saved('other','2026-10-06',20,{performedLibraryId:'custom:other',load:99})]};
let head=original,language='pt';
const queries=createProgressQueries({model,workout:createWorkoutReadModel({catalog,librarySource:{library:[]},model}),labels:createExerciseLabels({builtIns:new Map(),readCustom:()=>head.customExercises,language:()=>language}),library:[],read:()=>({snapshot:head,language,today:'2026-10-10',currentCycle:1,profileWeightKg:null,draft:null,recoveryRecord:null,recoveryBlockId:null})});
const frame=queries.capture();
head={...original,program:[],customExercises:[{...library[0],namePt:'Renamed'}],log:[]};language='en';
const capturedFacts=frame.readFacts();
assert.equal(capturedFacts.snapshot,original,'capture retains acknowledged identity');
assert.equal(capturedFacts.program[0].displayName,'Supino');
assert.equal(capturedFacts.log[0].displayName,'Supino');
const input=frame.projectionInputs('current-block');
assert.deepEqual(input.rows.map(row=>row.session),['first','second','other'],'warmups excluded before projection');
assert.deepEqual(input.recordKeys,['name:press','name:press','name:press'],'preserve historical transformed-row key omission');
assert.equal(input.rows[0].exerciseId,'library:custom:press');
assert.equal(input.rows[0].e1rm,50.666666666666664);
assert.deepEqual(frame.projection('current-block').sessions.filter(row=>row.liftKey==='library:custom:press').map(row=>[row.session,row.top,row.volume]),[['first',40,320],['second',40,400]]);
const detail=frame.detail('library:custom:press');
assert.equal(detail.name,'Supino');assert.equal(detail.template.id,'slot');
assert.equal(detail.artEntry.media,'press.webp');
assert.deepEqual(detail.stats.sessions.map(row=>row.session),['first','second','warmup']);
assert.equal(detail.stats.topLoad,40,'warmup excluded from maxima');
assert.deepEqual(detail.stats.recent.map(row=>row.comparison?.status),['not_comparable','improved','new']);
assert.deepEqual(detail.stats.summaries.map(row=>[row.session,row.volume]),[['first',320],['second',400]]);
assert.equal(detail.stats.prCount,4);
assert.equal(queries.capture().readFacts().log.length,0,'next operation sees new head');
assert.equal(original.log[0].e1rm,undefined,'query never annotates durable rows');
console.log('PASS captured Progress query: fixed identities, scope, detail comparisons, PRs, locale and head isolation');

// Reusing a slot for a different movement cannot lend its prescription/art to history.
head={...original,program:[{...slot,libraryId:'custom:replacement',name:'Replacement'}]};
const historic=queries.capture().detail('library:custom:press');
assert.equal(historic.template,null);assert.equal(historic.recommendation,null);assert.equal(historic.name,'Press');
assert.equal(historic.artEntry.media,'press.webp');assert.equal(historic.stats.topLoad,40);
assert.deepEqual(historic.stats.recent.map(row=>row.comparison.status),['not_comparable','improved','new']);
assert.equal(frame.detail('library:custom:missing').artEntry,null);
assert.equal(detail.recommendation.status,'manual','legacy scalar slot keeps native refusal');
assert.equal(detail.recommendation.reason,'canonical_program_definition_required');
assert.equal(detail.stats.loadPr.kind,'load');assert.equal(detail.stats.e1Pr.session,'second');
