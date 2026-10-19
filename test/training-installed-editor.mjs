import {Adapter as NativeAdapter} from './fixtures/training-runtime.mjs';
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createGenerationRules } from "../src/training/generation.js";
import { createProgramModel } from "../src/training/model.js";
import { createInstalledEditorRules, suggestion } from "../src/training/authoring.js";
const require=createRequire(import.meta.url),source=require("../exercises.js");
const generation=createGenerationRules();
const catalog=generation.identity.prepareCatalog(require("../assets/exercise-catalog.json"));
const mapped=NativeAdapter.programRequestFromAnswers({desiredResult:"balanced",structuredExperience:"over_24m",daysPerWeek:3,sessionMinutes:60,environment:{kind:"everything"},splitPreference:"upper_lower_full",block:{cycles:7,periodization:"static"},deload:true},catalog);
assert(mapped.ok);
const generated=generation.compiler.generateProgram(mapped.value,catalog);assert(generated.ok);
let id=0;
const model=createProgramModel({catalog,librarySource:{library:source.EXERCISE_LIBRARY,legacyIds:source.LEGACY_LIBRARY_IDS},nextId:()=>`fixture-${++id}`,now:"2026-10-18T12:00:00.000Z"});
const rules=createInstalledEditorRules({model,catalog,nextId:()=>`fixture-${++id}`,defaultProgramMeta:()=>({})});
const definition=generated.value;
const training=definition.days.filter(day=>day.kind==="training");
const head={program:model.flatProgramFromDefinition(definition,[],1),customExercises:[],programMeta:{id:"program",blockId:"block",name:"Example",started:"2026-10-18",mesocycleLengthWeeks:7,programDefinition:definition,programStructure:{days:training.map((day,index)=>({dayId:day.id,label:day.name,order:index+1}))}}};
const before=structuredClone(head);
const day=training[0],slot=day.slots[1];assert(slot);
const edit={kind:"exercise_remove",targetId:slot.id};
const removed=rules.editorRebaseDocument({edits:[edit]},head);assert.equal(removed.conflict,false);
const canonical=removed.document.programMeta.programDefinition.days.find(item=>item.id===day.id);
assert(!canonical.slots.some(item=>item.id===slot.id));
assert.deepEqual(canonical.slots.map(item=>item.order),canonical.slots.map((_,index)=>index+1));
const committed=rules.editorSnapshotFromDocument(removed.document,head);
const rows=committed.program.filter(row=>row.day===day.name);
assert.deepEqual(rows.map(row=>row.order),rows.map((_,index)=>index+1));
assert.deepEqual(head,before,"rebase never mutates the durable input");
assert.equal(rules.editorRebaseDocument({edits:[edit]},committed).conflict,true,"a second tab removing the same slot cannot replay blindly");
const moving=day.slots[0];
const moved=rules.editorRebaseDocument({edits:[{kind:"exercise_move",targetId:moving.id,sourceDay:day.name,sourceIndex:0,targetDay:training[1].name,targetIndex:1}]},head);
assert.equal(moved.conflict,false);
for(const container of moved.document.programMeta.programDefinition.days)
  assert.deepEqual(container.slots.map(item=>item.order),container.slots.map((_,index)=>index+1),"both containers close order gaps");
const stale=rules.editorRebaseDocument({edits:[{kind:"exercise_move",targetId:moving.id,sourceDay:day.name,sourceIndex:2,targetDay:day.name,targetIndex:0}]},head);
assert.equal(stale.conflict,true,"same-day concurrent reordering checks captured source index");
const candidate=rules.editorDocumentFromSnapshot(head);
assert(suggestion.set(candidate,moving.id,false));
assert(candidate.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===moving.id).prescriptionsByCycle.every(cycle=>cycle.sets.every(set=>set.status==="manual")));
assert.equal(suggestion.setRir(candidate,moving.id,2),true);
assert.deepEqual(head,before);
console.log("PASS canonical editor rebase/remove/move, conflict refusal and opt-in document ownership");

// A custom slot with no metric composition is a real supported Build state.
// Configuring it exercises the same native metric validator as canonical import.
const metrics=(await import('../src/training/metrics.js')).default;
const custom=model.normalizeCustomExercises([{id:'custom:timer',name:'My movement',primary:'Lats',metricIds:[],metricDefinitions:[]}]);
const manual=model.manualProgramDefinitionFromRows([{id:'manual-row',slotId:'manual-row',libraryId:custom[0].id,day:'A',sets:2,hasRepTarget:false}],['A'],custom);
assert.ok(manual);
const manualHead={program:model.flatProgramFromDefinition(manual,custom),customExercises:custom,programMeta:{programDefinition:manual}};
const metricIds=['2555c6f170d8805cafa6d16d3fdddbaa','2555c6f170d88072bbf6d9ad3f16ea86'];
const metricDefinitions=metrics.definitionsForIds(metricIds).value;
const configured=rules.editorRebaseDocument({edits:[{kind:'metric_composition',slotId:'manual-row',beforeMetricIds:[],beforeMetricDefinitions:[],metricIds,metricDefinitions}]},manualHead);
assert.equal(configured.conflict,false,'metric configuration uses its native imported metric owner');
const configuredSlot=configured.document.programMeta.programDefinition.days.flatMap(day=>day.slots)[0];
assert.deepEqual(configuredSlot.metricIds,metricIds);
assert.equal(configuredSlot.prescriptionsByCycle[0].sets[0].status,'manual');
assert.deepEqual(manualHead.customExercises[0].metricIds,[],'configuration never mutates the input custom definition');
const firstCycle=configuredSlot.prescriptionsByCycle[0];
const added=rules.editorNewPrescription(configuredSlot.id,1,3,metricIds,metricDefinitions,firstCycle.sets[0].targets,'manual');
const resized=rules.editorRebaseDocument({edits:[{kind:'prescription',field:'sets',targetId:'manual-row',before:2,after:3,beforeSetIds:firstCycle.sets.map(set=>set.id),addedSets:[added],removedSetIds:[]}]},configured.document);
assert.equal(resized.conflict,false,'set-count intent uses the explicit operation default cycle when omitted');
const resizedSlot=resized.document.programMeta.programDefinition.days.flatMap(day=>day.slots)[0];
assert.equal(resizedSlot.prescriptionsByCycle[0].sets.length,3);
assert.equal(resizedSlot.prescriptionsByCycle[0].sets[2].id,added.id);
assert.equal(resizedSlot.prescriptionsByCycle[1].sets.length,2,'other cycles retain their original identities/counts');
console.log('PASS native custom composition and default-cycle set-count replay');

// Installed and Build replay the same field policy against captured coordinates.
for(const owner of [rules,createInstalledEditorRules({model,catalog,nextId:()=>`build-${++id}`,defaultProgramMeta:()=>({}),allowCreateDefinition:true})]){
  const input=structuredClone(head);
  const target=input.programMeta.programDefinition.days.find(day=>day.kind==='training').slots[0];
  const cycle=target.prescriptionsByCycle[1],set=cycle.sets[1];
  set.rir=2;set.restSeconds=90;set.status='ready';
  set.provenance={source:'generator',policyVersion:'fixture@1'};
  cycle.sets[0].targets.reps={min:5,max:9};
  const original=structuredClone(input);
  const intent={kind:'prescription_field',slotId:target.id,cycleIndex:cycle.cycleIndex,setIndex:set.setIndex,field:'rir',before:2,after:0};
  for(const after of [0,6,2.5]){
    const result=owner.editorRebaseDocument({edits:[{...intent,after}]},input);
    assert.equal(result.conflict,false);
    const edited=result.document.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===target.id);
    const expected=structuredClone(target);expected.prescriptionsByCycle[1].sets[1].rir=after;
    assert.deepEqual(edited,expected,'only the selected cycle and set change; adaptive provenance survives');
    const row=result.document.program.find(row=>(row.slotId||row.id)===target.id);
    assert.deepEqual(row.prescriptionsByCycle,edited.prescriptionsByCycle);
    assert.equal(row.sets,cycle.sets.length);assert.equal(row.min,5);assert.equal(row.max,9);
  }
  for(const after of [-1,6.1,NaN,Infinity,null])assert.equal(owner.editorRebaseDocument({edits:[{...intent,after}]},input).conflict,true);
  for(const patch of [{before:4},{slotId:'missing'},{cycleIndex:0},{cycleIndex:999},{setIndex:0},{setIndex:999}])assert.equal(owner.editorRebaseDocument({edits:[{...intent,...patch}]},input).conflict,true);
  for(const after of [0,86400,null]){
    const result=owner.editorRebaseDocument({edits:[{...intent,field:'restSeconds',before:90,after}]},input);
    assert.equal(result.conflict,false);
    const edited=result.document.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===target.id).prescriptionsByCycle[1].sets[1];
    assert.equal(edited.restSeconds,after);assert.equal(edited.status,'manual');
    assert.deepEqual(edited.provenance,{source:'manual',policyVersion:'manual@1'});
  }
  for(const after of [-1,86401,0.5,NaN,Infinity])assert.equal(owner.editorRebaseDocument({edits:[{...intent,field:'restSeconds',before:90,after}]},input).conflict,true);
  assert.deepEqual(input,original,'accepted and refused replays preserve caller input');
  set.status='manual';
  const cleared=owner.editorRebaseDocument({edits:[{...intent,after:null}]},input);
  assert.equal(cleared.conflict,false);
  const clearedSet=cleared.document.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===target.id).prescriptionsByCycle[1].sets[1];
  assert.equal(clearedSet.rir,null);assert.equal(clearedSet.status,'manual');
  set.rir=0;
  assert.equal(owner.editorRebaseDocument({edits:[intent]},input).conflict,false,'already-applied intent is safe to replay');
}
console.log('PASS installed and Build prescription boundaries, stale replay refusal and coordinate isolation');

// Movement-wide step overrides keep their replay contract, independent of slots.
for(const owner of [rules,createInstalledEditorRules({model,catalog,nextId:()=>`build-load-${++id}`,defaultProgramMeta:()=>({}),allowCreateDefinition:true})]){
  const input=structuredClone(head);
  input.programMeta.loadingConfiguration={defaultLoadStepKg:2.5,byExerciseId:{'absent-movement':{loadStepKg:5},other:{loadStepKg:7}}};
  const original=structuredClone(input);
  for(const after of [0.25,100,null]){
    const result=owner.editorRebaseDocument({edits:[{kind:'load_step',exerciseId:'absent-movement',before:99,after}]},input);
    assert.equal(result.conflict,false,'load-step replay has never required a matching before value or present slot');
    assert.deepEqual(result.document.programMeta.loadingConfiguration,{defaultLoadStepKg:2.5,byExerciseId:{...(after===null?{}:{'absent-movement':{loadStepKg:after}}),other:{loadStepKg:7}}});
    assert.deepEqual(result.document.programMeta.programDefinition,input.programMeta.programDefinition);
  }
  for(const after of [0,-1,100.1,NaN,Infinity,'2'])assert.equal(owner.editorRebaseDocument({edits:[{kind:'load_step',exerciseId:'absent-movement',after}]},input).conflict,true);
  assert.equal(owner.editorRebaseDocument({edits:[{kind:'load_step',exerciseId:'',after:2}]},input).conflict,true);
  assert.deepEqual(input,original);

  const sideIds=['25a5c6f170d880baaa2dc8c7b67d4b65','25a5c6f170d880e2990fc88146f7de56'];
  const sideCustom=model.normalizeCustomExercises([{id:'custom:side',name:'Side movement',primary:'Lats',metricIds:sideIds,metricDefinitions:metrics.definitionsForIds(sideIds).value}]);
  const sideDefinition=model.manualProgramDefinitionFromRows([{id:'side-slot',slotId:'side-slot',libraryId:'custom:side',day:'A',sets:2,min:6,max:10}],['A'],sideCustom);
  assert.ok(sideDefinition);
  const sideInput={program:model.flatProgramFromDefinition(sideDefinition,sideCustom),programMeta:{programDefinition:sideDefinition},customExercises:sideCustom};
  const sideBefore=structuredClone(sideInput);
  const sideSlot=sideDefinition.days.flatMap(day=>day.slots)[0];
  assert.equal(owner.editorSuggestLoadsPolicy.executionModeQuestion(sideSlot),true);
  const intent={kind:'execution_mode',slotId:'side-slot',before:null,after:'unilateral'};
  for(const after of ['bilateral','unilateral']){
    const result=owner.editorRebaseDocument({edits:[{...intent,after}]},sideInput);
    assert.equal(result.conflict,false);
    const expected=structuredClone(sideDefinition);expected.days.flatMap(day=>day.slots)[0].executionMode=after;
    assert.deepEqual(result.document.programMeta.programDefinition,expected,'canonical replay preserves every cycle, target and provenance');
    assert.equal(owner.editorRebaseDocument({edits:[{...intent,after}]},result.document).conflict,false,'already applied mode is replayable');
  }
  for(const patch of [{after:'both'},{after:null},{before:'bilateral'},{slotId:'missing'}])assert.equal(owner.editorRebaseDocument({edits:[{...intent,...patch}]},sideInput).conflict,true);
  const noSide=structuredClone(configured.document);
  assert.equal(owner.editorRebaseDocument({edits:[{...intent,slotId:'manual-row'}]},noSide).conflict,true,'ordinary load/reps composition never asks execution mode');
  const catalogFixed=catalog.exercises.find(exercise=>owner.catalogExecutionMode(exercise.id));
  assert.ok(catalogFixed,'fixture contains a catalog-prescribed execution mode');
  const fixedInput=structuredClone(sideInput);
  fixedInput.programMeta.programDefinition.days.flatMap(day=>day.slots)[0].exerciseId=catalogFixed.id;
  assert.equal(owner.editorRebaseDocument({edits:[intent]},fixedInput).conflict,true,'catalog-prescribed laterality cannot be overridden by a mode intent');
  assert.deepEqual(sideInput,sideBefore,'accepted and refused mode replays leave the caller input untouched');
}
console.log('PASS installed and Build loading defaults, movement-wide replay, execution eligibility and stale mode refusal');

// Literal owner-level expectations keep canonical policy distinct from speculation.
for(const owner of [rules,createInstalledEditorRules({model,catalog,nextId:()=>`boundary-${++id}`,defaultProgramMeta:()=>({}),allowCreateDefinition:true})]){
  const input=structuredClone(head),original=structuredClone(input);
  const targetSlot=input.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.prescriptionsByCycle?.[0]?.sets?.[0]?.status==='ready'&&slot.metricDefinitions.some(metric=>metric.semantic==='reps'));
  assert.ok(targetSlot);
  const metric=targetSlot.metricDefinitions.find(metric=>metric.semantic==='reps'),set=targetSlot.prescriptionsByCycle[0].sets[0];
  const intent={kind:'metric_target',slotId:targetSlot.id,cycleIndex:1,setIndex:1,metricId:metric.id,semantic:'reps',metricIds:targetSlot.metricIds,metricDefinitions:targetSlot.metricDefinitions,before:{present:true,value:structuredClone(set.targets.reps)},after:{present:true,value:{min:5,max:9}}};
  const edited=owner.editorRebaseDocument({edits:[intent]},input);assert.equal(edited.conflict,false);
  const editedSet=edited.document.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===targetSlot.id).prescriptionsByCycle[0].sets[0];
  assert.deepEqual(editedSet,{...set,targets:{...set.targets,reps:{min:5,max:9}}},'adaptive range edit retains all other values and provenance');
  assert.equal(owner.editorRebaseDocument({edits:[intent]},edited.document).conflict,false,'already applied target replay remains valid');
  for(const patch of [{after:{present:false,value:null}},{after:{present:true,value:31}},{before:{present:true,value:29}},{metricId:'wrong'},{metricDefinitions:[]}])assert.equal(owner.editorRebaseDocument({edits:[{...intent,...patch}]},input).conflict,true);
  const beforeRir=targetSlot.prescriptionsByCycle.flatMap(cycle=>cycle.sets).map(set=>set.rir??null);
  const rir={kind:'suggest_loads_rir',slotId:targetSlot.id,before:beforeRir,after:4};
  assert.equal(owner.editorRebaseDocument({edits:[rir]},input).conflict,false);
  for(const patch of [{after:null},{after:4.1},{after:6},{before:[99]}])assert.equal(owner.editorRebaseDocument({edits:[{...rir,...patch}]},input).conflict,true,'canonical RIR preserves its maximum four and stale-before guard');
  const other=training.flatMap(day=>day.slots).find(slot=>slot.exerciseId!==targetSlot.exerciseId).exerciseId;
  const alternates={kind:'slot_alternates',slotId:targetSlot.id,before:targetSlot.alternates||[],after:[other]};
  assert.equal(owner.editorRebaseDocument({edits:[alternates]},input).conflict,false);
  for(const patch of [{after:[targetSlot.exerciseId]},{after:[other,other]},{after:['unrecognized-movement']},{before:['stale']}])assert.equal(owner.editorRebaseDocument({edits:[{...alternates,...patch}]},input).conflict,true);
  assert.deepEqual(input,original,'successful and conflicting canonical target/RIR/alternate replay cannot mutate the caller');

  const empty=structuredClone(manualHead);empty.programMeta.suggestLoadsPending=['manual-row'];
  const configureIntent={kind:'metric_composition',slotId:'manual-row',beforeMetricIds:[],beforeMetricDefinitions:[],metricIds,metricDefinitions};
  const configuredResult=owner.editorRebaseDocument({edits:[configureIntent]},empty);assert.equal(configuredResult.conflict,false);
  const configuredAgain=configuredResult.document.programMeta.programDefinition.days.flatMap(day=>day.slots)[0];
  assert.deepEqual(configuredAgain.prescriptionsByCycle[0].sets[0].targets.reps,{min:6,max:10},'canonical-only missing rep range uses Build defaults');
  assert.deepEqual(configuredAgain.prescriptionsByCycle[0].sets[0].provenance,{source:'manual',policyVersion:'manual@1'});
  assert.equal(Object.hasOwn(configuredResult.document.programMeta,'suggestLoadsPending'),false,'canonical composition consumes pending opt-in');
  assert.deepEqual(configuredResult.document.customExercises[0].metricIds,metricIds);
  assert.equal(owner.editorRebaseDocument({edits:[{...configureIntent,beforeMetricIds:['stale']}]},empty).conflict,true);
  const replayed=owner.editorRebaseDocument({edits:[configureIntent]},configuredResult.document);assert.equal(replayed.conflict,false);
  assert.deepEqual(replayed.document.programMeta.programDefinition,configuredResult.document.programMeta.programDefinition);
  assert.deepEqual(empty.programMeta.suggestLoadsPending,['manual-row']);assert.deepEqual(empty.customExercises[0].metricIds,[]);
}
console.log('PASS installed and Build metric/alternate/RIR replay, canonical defaults, pending opt-in and immutable refusals');
const rangeHead=structuredClone(manualHead);rangeHead.program[0].min=8;rangeHead.program[0].max=12;
const rangeResult=rules.editorRebaseDocument({edits:[{kind:'metric_composition',slotId:'manual-row',beforeMetricIds:[],beforeMetricDefinitions:[],metricIds,metricDefinitions}]},rangeHead);
assert.equal(rangeResult.conflict,false);
assert.deepEqual(rangeResult.document.programMeta.programDefinition.days.flatMap(day=>day.slots)[0].prescriptionsByCycle[0].sets[0].targets.reps,{min:8,max:12},'canonical composition prefers the authored row range over its fallback');
const nonRepHead=structuredClone(head);
const nonRepSlot=nonRepHead.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.metricDefinitions.some(metric=>metric.semantic==='loadKg'));
const nonRepSet=nonRepSlot.prescriptionsByCycle[0].sets[0],nonRepMetric=nonRepSlot.metricDefinitions.find(metric=>metric.semantic==='loadKg');
nonRepSet.provenance={...nonRepSet.provenance,reason:'must not survive canonical manual provenance'};
const nonRepOriginal=structuredClone(nonRepHead);
const manualTarget=rules.editorRebaseDocument({edits:[{kind:'metric_target',slotId:nonRepSlot.id,cycleIndex:1,setIndex:1,metricId:nonRepMetric.id,semantic:'loadKg',metricIds:nonRepSlot.metricIds,metricDefinitions:nonRepSlot.metricDefinitions,before:Object.hasOwn(nonRepSet.targets,'loadKg')?{present:true,value:nonRepSet.targets.loadKg}:{present:false,value:null},after:{present:true,value:12}}]},nonRepHead);
assert.equal(manualTarget.conflict,false);
const manuallyEdited=manualTarget.document.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===nonRepSlot.id).prescriptionsByCycle[0].sets[0];
assert.equal(manuallyEdited.status,'manual');assert.deepEqual(manuallyEdited.provenance,{source:'manual',policyVersion:'manual@1'});
assert.equal(manuallyEdited.targets.loadKg,12);assert.deepEqual(nonRepHead,nonRepOriginal);
