import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createProgramModel} from '../src/training/model.js';
import {createWorkoutRules} from '../src/training/workout.js';
import metrics from '../src/training/metrics.js';
import {createWorkoutReadModel} from '../src/app/workout-model.js';
const require=createRequire(import.meta.url),source=require('../exercises.js'),catalog=require('../assets/exercise-catalog.json');
const librarySource={library:source.EXERCISE_LIBRARY,legacyIds:source.LEGACY_LIBRARY_IDS};
const model=createProgramModel({catalog,librarySource,nextId:()=>{throw Error('readonly query allocated identity')},now:'2026-10-18T12:00:00.000Z'});
const owner=createWorkoutReadModel({catalog,librarySource,model});
const ex={id:'slot',name:'My lift',libraryId:'custom:mine',day:'A',sets:2,min:6,max:10};
const snapshot={log:[{id:'old',session:1,date:'2026-10-17',set:1,performedLibraryId:'custom:mine',performedName:'Immutable old label',load:40,reps:8},{id:'foreign',session:2,date:'2026-10-18',exerciseId:'slot',set:1,performedLibraryId:'custom:other',performedName:'My lift',load:99,reps:8}],program:[ex],customExercises:[],programMeta:{},settings:{unit:'kg',minJump:2.5}};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
freeze(snapshot);
const before=JSON.stringify(snapshot),q=owner.capture({snapshot,draft:null,currentCycle:1,profileWeightKg:null});
assert.deepEqual(q.last(ex).map(row=>row.id),['old'],'live slot identity cannot acquire another performed movement');
assert.equal(q.matchLift(ex)(snapshot.log[1]),false);
assert.deepEqual(q.recommendation(ex),{status:'manual',engineStatus:'manual',reason:'canonical_program_definition_required',load:null,targetSets:[]},'a legacy flat row never silently executes retired capacity policy');
assert.deepEqual(q.setSuggestion(ex,1,q.recommendation(ex)),{load:null,reps:null,src:'manual'});
assert.deepEqual(q.canonicalSlotFacts(ex),null);
assert.deepEqual(q.prescriptionFacts(ex),{sets:2,metrics:[]});
const scalar=q.readLogRow({load:'100',reps:'5'});
assert.equal(scalar.tonnage,500);assert.equal(scalar.e1rm,116.66666666666667);
assert.equal(scalar.strengthConvention,'load');assert.equal(scalar.strengthComparable,true);
const metricIds=['25a5c6f170d880baaa2dc8c7b67d4b65','25a5c6f170d880e2990fc88146f7de56'];
const metricDefinitions=metrics.definitionsForIds(metricIds).value;
const side={performedLibraryId:'1a05c6f170d8806b911acf558c5af4f6',metricIds,metricDefinitions,metricValues:metricDefinitions.map(metric=>({metricId:metric.id,value:metric.semantic==='repsPerSide'?8:18,unit:metric.unit})),loadingContext:{externalLoadMultiplier:2}};
const projected=q.readLogRow(side);
assert.equal(projected.load,18);assert.equal(projected.reps,8);assert.equal(projected.tonnage,288);
assert.equal(projected.executionMode,'bilateral');assert.equal(projected.strengthConvention,'per-side:m2');
const unilateral=q.readLogRow({...side,loadingContext:{externalLoadMultiplier:1}});
assert.equal(unilateral.executionMode,'unilateral');assert.equal(unilateral.tonnage,288,'one side at a time doubles performed repetitions, not the held load');
assert.equal(unilateral.strengthConvention,'per-side:m1','strength conventions remain incomparable');
const unknown=q.readLogRow({...side,performedLibraryId:'retired-library-id',loadingContext:{}});
assert.equal(unknown.strengthComparable,false);assert.equal(unknown.tonnage,null,'unknown execution never invents a multiplier');
assert.equal(JSON.stringify(snapshot),before,'queries retain saved identity and raw values');
assert.deepEqual(q.progressionForExercise({...ex,progressionType:'unsupported-future'}),{schemaVersion:1,modifiers:[],strategy:{id:'manual',version:1,params:{unsupportedImport:'unsupported-future'}}});
console.log('PASS literal workout query identity, manual refusal, scalar/per-side projection, preserved conventions and immutable snapshot');

const training=createWorkoutRules(catalog),now='2026-10-18T12:00:00.000Z';
const context={programId:'p',programFingerprint:'fp',durableRevision:0,dayId:'A',dayLabel:'A',scheduleDate:'2026-10-18',unit:'kg',rirMode:'numeric',exercises:[{exerciseInstanceId:'slot',sourceExerciseId:'source',libraryId:'custom:mine',displayName:'My lift',sets:2,setIds:['s1','s2'],minReps:6,maxReps:10,targetRir:2,notes:'',primary:'Chest',secondary:'',sourceFingerprint:'source-fp'}]};
const draft=training.create(context,{draftId:'draft',writer:{installationId:'i',tabId:'t',operationId:'create'},startedAt:now,updatedAt:now,scheduleDate:'2026-10-18',selectedExerciseId:'slot',bodyweight:'',notes:''},{});
assert(!training.isDomainError(draft),JSON.stringify(draft));
const swapped=training.reduce(draft,{type:'substituteExercise',operationId:'swap',expectedRevision:draft.revision,updatedAt:now,writer:{installationId:'i',tabId:'t'},exerciseInstanceId:'slot',replacement:{exerciseInstanceId:'replacement',sourceExerciseId:'legacy-target',movementId:'adhoc:legacy-target',displayName:'Workout query legacy target',primary:'Lats',secondary:''},selectedAt:now});
assert(!training.isDomainError(swapped),JSON.stringify(swapped));
const custom=model.normalizeCustomExercises([{id:'custom:target',name:'Workout query legacy target',primary:'Lats'}]);
const withCustom={...snapshot,customExercises:custom};
freeze(swapped);
const beforeSwap=JSON.stringify(swapped),resumed=owner.capture({snapshot:withCustom,draft:swapped,currentCycle:1,profileWeightKg:null});
assert.equal(resumed.sessionExercise(ex).libraryId,'custom:target','real name-only DraftV2 substitution recovers an unambiguous offered identity');
assert.equal(resumed.sessionExercise(ex).name,'Workout query legacy target');
assert.equal(resumed.sessionExercise(ex).sets,2);
assert.equal(JSON.stringify(swapped),beforeSwap,'resolving an old label never rewrites the DraftV2 aggregate');
const ambiguous=owner.capture({snapshot:{...withCustom,customExercises:[...custom,{...custom[0],id:'custom:other'}]},draft:swapped,currentCycle:1,profileWeightKg:null});
assert.equal(ambiguous.sessionExercise(ex).libraryId,undefined,'ambiguous old names never borrow either offered identity');
assert.equal(ambiguous.sessionExercise(ex).movementId,'adhoc:workout query legacy target');
console.log('PASS real reducer substitution, name-only identity recovery, ambiguity refusal and immutable DraftV2');

// Source classification reads acknowledged canonical edits, never a UI projection.
// Targets are literal policy outputs; this tests the query boundary, not engine math.
function committedFixture({load='18',semantic='loadPerSideKg',unit='kg',complete=true}={}){
  const fixture=structuredClone(draft),set=fixture.exercises.slot.sets.s1;
  set.programmed.metrics=[{...metricDefinitions[0],id:'load',semantic}];
  set.edited.metrics={load};set.edited.load='999';
  set.completion=complete?{completedAt:now}:'pending';
  freeze(fixture);
  return owner.capture({snapshot:{...snapshot,settings:{...snapshot.settings,unit}},draft:fixture,currentCycle:1,profileWeightKg:null})}
const literalRec={status:'hold',metricDefinitions:[{id:'target',semantic:'loadPerSideKg'}],targetSets:[{prescription:{setIndex:2},status:'recommended',result:{targets:{loadPerSideKg:18}}}]};
assert.deepEqual(committedFixture().setSuggestion(ex,2,literalRec),{load:18,reps:null,src:'session-hold',drop:false});
assert.equal(committedFixture({load:'17'}).setSuggestion(ex,2,literalRec).src,'session-up');
assert.equal(committedFixture({load:'19',semantic:'assistanceKg'}).setSuggestion(ex,2,literalRec).src,'session-down');
assert.equal(committedFixture({complete:false}).setSuggestion(ex,2,literalRec).src,'base');
assert.equal(committedFixture({load:'',semantic:'persistentLoadPerSideKg'}).setSuggestion(ex,2,literalRec).src,'base','empty metric must not read stale scalar 999');
assert.equal(committedFixture({load:'18.0001',unit:'lb'}).setSuggestion(ex,2,literalRec).src,'session-hold','both canonical loads display as 39.68 lb');
assert.equal(committedFixture({load:'18.01',unit:'lb'}).setSuggestion(ex,2,literalRec).src,'session-down');
console.log('PASS canonical completed load source, per-side/assistance metrics, pending refusal, stale scalar exclusion and lb rounding');
