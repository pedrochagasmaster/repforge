import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFixtureRuntime} from '../tools/app-runtime-harness.mjs';
import {createProgramModel} from '../src/training/model.js';
import {createInstalledEditorRules} from '../src/training/authoring.js';
import {createWorkoutReadModel} from '../src/app/workout-model.js';
import {createWorkoutContext} from '../src/app/workout-context.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/architecture-baseline-v1.json',import.meta.url),'utf8'));
const corpus=JSON.parse(readFileSync(new URL('./fixtures/architecture-corpus-v1.json',import.meta.url),'utf8'));
const {catalogSnapshot:catalog,WorkoutDraft,Compiler}=await createFixtureRuntime();
const nextId=()=>{throw Error('readonly context allocated identity');},now='2026-10-18T10:00:00.000Z';
const model=createProgramModel({catalog,librarySource:{library:[]},nextId,now,calendarDate:'2026-10-18'});
const editorRules=createInstalledEditorRules({model,catalog,nextId,defaultProgramMeta:()=>({})});
const queries=createWorkoutReadModel({catalog,librarySource:{library:[]},model}),contexts=createWorkoutContext({model,catalog,editorRules});
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function capture(definition,label,currentCycle=1,blockId='context-block'){
  const snapshot=freeze({program:model.flatProgramFromDefinition(definition,[],1),programMeta:{id:'context-program',blockId,programDefinition:definition},log:[],settings:{unit:'lb',rirMode:'effort',minJump:2.5},futureUnknown:{keep:'byte-identical'}});
  const before=JSON.stringify(snapshot),query=queries.capture({snapshot,draft:null,currentCycle,profileWeightKg:null});
  const context=contexts.program({snapshot,query,label,currentCycle,calendarDate:'2026-10-18'});
  assert.equal(JSON.stringify(snapshot),before,'context preparation cannot mutate an acknowledged snapshot or unknown fields');
  return context;
}
{
  // Expectations belong to the immutable pre-cutover generated definition.
  const definition=structuredClone(fixture.expected.generation.value),day=definition.days.find(item=>item.kind==='training');
  const expected=day.slots[0],prescription=expected.prescriptionsByCycle.find(item=>item.cycleIndex===1);
  day.name='Renamed day';const context=capture(definition,'Renamed day');
  assert.deepEqual([context.programId,context.dayId,context.dayLabel,context.scheduleDate,context.unit,context.rirMode,context.blockId],['context-program',day.id,'Renamed day','2026-10-18','lb','effort','context-block']);
  assert.equal(context.exercises[0].exerciseInstanceId,expected.id);assert.equal(context.exercises[0].sourceExerciseId,expected.id);
  assert.equal(context.exercises[0].libraryId,expected.exerciseId);assert.deepEqual(context.exercises[0].metricDefinitions,expected.metricDefinitions);
  assert.deepEqual(context.exercises[0].programmedSets.map(set=>set.targets),prescription.sets.map(set=>set.targets),'complete authored cycle targets retain source meaning');
  assert.deepEqual(context.exercises[0].setIds,Array.from({length:prescription.sets.length},(_,index)=>`set-${index+1}`));
  const draft=WorkoutDraft.create(context,{...fixture.inputs.selection,draftId:'context-created',selectedExerciseId:expected.id},{});
  assert.equal(WorkoutDraft.isDomainError(draft),false,JSON.stringify(draft));assert.equal(draft.program.dayId,day.id);
  const invalid=capture(definition,'Renamed day',1,null),refusal=WorkoutDraft.create(invalid,{...fixture.inputs.selection,selectedExerciseId:expected.id},{});
  assert.equal(Object.hasOwn(invalid,'blockId'),true);assert.equal(invalid.blockId,null);
  assert.deepEqual(refusal,{kind:'domain-error',code:'invalid-created-draft',issues:['program.blockId']},'explicit malformed identity is refused, never silently dropped');
}
{
  const source=corpus.drafts.find(item=>item.key==='repless-duration').context.exercises[0];
  const definition=structuredClone(fixture.expected.generation.value),day=definition.days.find(item=>item.kind==='training'),slot=day.slots[0],ids=source.metricDefinitions.map(metric=>metric.id);
  for(const other of definition.days)if(other!==day){other.kind='rest';other.slots=[];}
  const template=slot.prescriptionsByCycle[0].sets[0];day.name='Timed';day.slots=[{...slot,exerciseId:source.sourceExerciseId,sourceExerciseIds:[source.sourceExerciseId],alternates:[],metricIds:ids,metricDefinitions:source.metricDefinitions,
    loadingModel:source.loadingModel,prescriptionsByCycle:Array.from({length:definition.cycles},(_,index)=>({cycleIndex:index+1,sets:[{...template,id:'timed-prescription-'+index,cycleIndex:index+1,setIndex:1,metricType:'source_metrics@1',metricIds:ids,metricDefinitions:source.metricDefinitions,targets:{durationSeconds:75},rir:null,restSeconds:0}]}))}];
  const valid=Compiler.validateProgramDefinition(definition,catalog);assert.equal(valid.ok,true,JSON.stringify(valid));
  const context=capture(definition,'Timed'),exercise=context.exercises[0],set=exercise.programmedSets[0];
  assert.equal(Object.hasOwn(model.flatProgramFromDefinition(definition,[],1)[0],'min'),false);
  assert.equal(exercise.minReps,undefined);assert.equal(exercise.maxReps,undefined);assert.equal(set.suggestedReps,null);
  assert.deepEqual(set.targets,{durationSeconds:75});assert.deepEqual(set.metricDefinitions,source.metricDefinitions);assert.equal(set.restSeconds,0);assert.equal(set.suggestedEffort,null);
  const draft=WorkoutDraft.create(context,{...fixture.inputs.selection,draftId:'context-timed',selectedExerciseId:exercise.exerciseInstanceId},{});
  assert.equal(WorkoutDraft.isDomainError(draft),false,JSON.stringify(draft));
  const stored=draft.exercises[exercise.exerciseInstanceId].sets['set-1'];assert.deepEqual(stored.programmed.targets,{durationSeconds:75});
}
console.log('PASS real workout context: immutable source cycle targets, renamed-day identity, unknown preservation, exact loading units and valid repless DraftV2');

assert.equal(typeof contexts.draftInputs,'function','concrete context owns draft input policy');
const inputDefinition=structuredClone(fixture.expected.generation.value),inputDay=inputDefinition.days.find(day=>day.kind==='training');
const inputRows=model.flatProgramFromDefinition(inputDefinition,[],1);
const inputSnapshot={program:inputRows,programMeta:{id:'seed-program',programDefinition:inputDefinition},log:[],settings:{unit:'lb',rirMode:'effort'}};
const inputQuery=queries.capture({snapshot:inputSnapshot,draft:null,currentCycle:1,profileWeightKg:null});
const movementLibrary=[{id:'one',name:'Duplicate',namePt:'Duplicado',primary:'Chest'}, {id:'two',name:'Duplicate',primary:'Back'}];
inputSnapshot.customExercises=[{id:'custom:archived',name:'Archived',archived:true,primary:'Legs'}];
const inputs=contexts.draftInputs({snapshot:inputSnapshot,query:inputQuery,rows:inputRows,currentCycle:1,calendarDate:'2026-10-18',library:movementLibrary,language:'pt'});
const identity={now:'2026-10-18T10:00:00.000Z',draftId:'new-seed',writer:{installationId:'i',tabId:'t',operationId:'seed'}};
const seeds=inputs.creation(inputDay.name,{contextTouched:{day:true}},identity);
assert.equal(seeds.sessionSelection.draftId,'new-seed');assert.equal(seeds.sessionSelection.contextTouched.day,true);
assert.equal(seeds.sessionSelection.selectedExerciseId,seeds.programContext.exercises[0].exerciseInstanceId);
const untouched=WorkoutDraft.create(seeds.programContext,{...seeds.sessionSelection,contextTouched:{day:false,date:false,sessionNotes:false,bodyweight:false}},seeds.previousSessionFacts);
assert.equal(WorkoutDraft.isDomainError(untouched),false,JSON.stringify(untouched));
assert.equal(inputs.disposable(untouched),true);
const reordered=structuredClone(untouched);reordered.exercises[reordered.exerciseOrder[0]].programmed.order=99;
assert.equal(inputs.disposable(reordered),false);
const dated=structuredClone(untouched);dated.program.scheduleDate='2026-10-17';assert.equal(inputs.disposable(dated),false);
const noted=structuredClone(untouched);noted.exercises[noted.exerciseOrder[0]].setupNotes='typed';assert.equal(inputs.disposable(noted),false);
const legacy={__day:inputDay.name,__bodyweight:'220.46226218',slot_load:'22.046226218',slot_reps:'8',slot_rir:'2',slot_effort:'Hard',__substituted:{a:'Duplicate',b:'Old custom'},__substitutedRef:{b:'custom:archived'}};
const migration=inputs.migration(legacy,inputDay.name,identity);
assert.deepEqual(migration.valueResolutions,{__bodyweight:'100',slot_load:'10',slot_reps:'8',slot_rir:'2',slot_effort:'Hard'});
assert.equal(migration.substitutionResolutions.a.replacement.movementId,'adhoc:duplicate','ambiguous legacy name cannot select a catalog identity');
assert.equal(migration.substitutionResolutions.b.replacement.libraryId,'custom:archived','explicit archived reference remains resolvable');
assert.equal(migration.substitutionResolutions.b.replacement.displayName,'Old custom');
assert.equal(inputs.migration({...legacy,__bodyweight:'  invalid  '},inputDay.name,identity).valueResolutions.__bodyweight,'  invalid  ');
inputSnapshot.settings.unit='kg';movementLibrary[0].name='changed';
assert.equal(inputs.migration(legacy,inputDay.name,identity).valueResolutions.slot_load,'10','captured input facts survive later mutation');
console.log('PASS concrete draft seeds, untouched classification, exact legacy values and unambiguous substitution identity');
