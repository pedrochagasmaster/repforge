import assert from 'node:assert/strict';
import {createEditorDocumentRules} from '../src/training/authoring.js';
const rules=createEditorDocumentRules({nextId:()=> 'new-authored-slot'});
const document={program:[{id:'slot-a',day:'Day 1',order:1,name:'Squat',sets:3,min:6,max:8,notes:'keep'}],programMeta:{programStructure:{days:[{dayId:'day-a',label:'Day 1',order:1}]}},customExercises:[]};
const added=rules.addExercise(document,'Day 1',{id:'movement-a',name:'Cable row',sets:2,min:8,max:12});
assert.deepEqual(added,{id:'new-authored-slot',day:'Day 1',order:2,name:'Cable row',sets:2,min:8,max:12,primary:'',secondary:'',notes:'',libraryId:'movement-a',movementId:'library:movement-a'});
assert.equal(rules.setDayLabel(document,'Day 1','Upper'),true);
assert.deepEqual(document.program.map(row=>[row.id,row.day]),[['slot-a','Upper'],['new-authored-slot','Upper']]);
assert.deepEqual(document.programMeta.programStructure.days,[{dayId:'day-a',label:'Upper',nameOverride:'Upper',order:1}]);
assert.equal(rules.appendDay(document),'Day 2');
assert.equal(rules.reorder(document,'new-authored-slot','Day 2',0),true);
assert.deepEqual(document.program.map(row=>[row.id,row.day,row.order]),[['slot-a','Upper',1],['new-authored-slot','Day 2',1]]);
const before=structuredClone(document);
assert.equal(rules.reorder(document,'slot-a','Missing day',0),false);
assert.deepEqual(document,before,'negative control: unknown day cannot consume a live slot');
assert.equal(rules.setDayLabel(document,'Upper','Day 2'),false);
assert.deepEqual(document,before,'negative control: duplicate label does not rewrite the document');
assert.equal(rules.replaceExercise(document,'slot-a',{id:'new-movement',name:'Front squat'}),true);
assert.equal(document.program[0].id,'slot-a');assert.equal(document.program[0].libraryId,'new-movement');
assert.equal(document.program[0].sets,3);assert.equal(document.program[0].min,6);assert.equal(document.program[0].notes,'keep');
rules.removeDayFromDocument(document,'Day 2');rules.removeDayFromDocument(document,'Upper');
assert.deepEqual(document.program,[]);assert.equal(document.programMeta.programStructure,null,'released last-day removal retains its null structure representation');
console.log('PASS native speculative editor identity, day moves, replacement and rejecting negative controls');

const {seedProgram,seedProgramMeta}=await import('./fixtures/seed-program.mjs');
const installed={program:seedProgram(),programMeta:seedProgramMeta(),customExercises:[]};
const rawBefore=JSON.stringify(installed);
const renamed=rules.editExerciseField(installed,{id:'seed-ex-1',field:'name',value:'  Front squat  ',cycleIndex:1});
assert.equal(renamed.document.program[0].id,'seed-ex-1');assert.equal(renamed.document.program[0].name,'Front squat');
assert.equal(renamed.document.program[0].displayName,'Front squat');
assert.equal(JSON.stringify(installed),rawBefore,'field preparation leaves the acknowledged input unchanged');
const enlarged=rules.editExerciseField(installed,{id:'seed-ex-1',field:'sets',value:3,cycleIndex:1});
assert.equal(enlarged.edit.after,3);assert.equal(enlarged.edit.addedSets.length,1);
assert.equal(enlarged.edit.addedSets[0].id,'new-authored-slot');assert.equal(enlarged.edit.addedSets[0].setIndex,3);
assert.equal(enlarged.edit.addedSets[0].status,'manual');assert.equal(enlarged.edit.addedSets[0].rir,null);
assert.deepEqual(enlarged.edit.addedSets[0].targets,{reps:{min:4,max:8}});
assert.equal(enlarged.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle[0].sets.length,3);
assert.deepEqual(rules.editExerciseField(installed,{id:'seed-ex-1',field:'unrecognized-field',value:'corrupt',cycleIndex:1}),{ok:false});
assert.equal(JSON.stringify(installed),rawBefore,'negative control: unknown fields cannot mutate the caller document');
console.log('PASS authored field alias and canonical set growth have literal expected receipts without mutating the input');

// Prescription preparation owns policy and leaves acknowledged documents intact.
const prescriptionDoc=structuredClone(installed);
const prescribedSlot=prescriptionDoc.programMeta.programDefinition.days[0].slots[0];
const picked=()=>prescribedSlot.prescriptionsByCycle[0].sets[0];
picked().status='ready';picked().rir=2;
picked().provenance={source:'generator',policyVersion:'fixture@1',reason:'retained by speculative editing'};
const request={slotId:prescribedSlot.id,cycleIndex:1,setIndex:1,field:'rir',after:0};
const frozenPrescription=structuredClone(prescriptionDoc);
for(const after of [0,6,2.5]){
  const result=rules.editPrescriptionField(prescriptionDoc,{...request,after});
  assert.equal(result.ok,true);
  const slot=result.document.programMeta.programDefinition.days[0].slots[0];
  assert.equal(slot.prescriptionsByCycle[0].sets[0].rir,after);
  assert.equal(slot.prescriptionsByCycle[0].sets[0].status,'ready');
  assert.deepEqual(slot.prescriptionsByCycle[0].sets[0].provenance,{source:'generator',policyVersion:'fixture@1',reason:'retained by speculative editing'});
  assert.deepEqual(slot.prescriptionsByCycle[0].sets.slice(1),prescribedSlot.prescriptionsByCycle[0].sets.slice(1));
  assert.deepEqual(slot.prescriptionsByCycle.slice(1),prescribedSlot.prescriptionsByCycle.slice(1));
  assert.deepEqual(result.document.program.find(row=>(row.slotId||row.id)===slot.id).prescriptionsByCycle,slot.prescriptionsByCycle);
}
for(const after of [-1,6.1,NaN,Infinity,null])assert.equal(rules.editPrescriptionField(prescriptionDoc,{...request,after}).ok,false);
for(const after of [0,86400,null]){
  const result=rules.editPrescriptionField(prescriptionDoc,{...request,field:'restSeconds',after});
  assert.equal(result.ok,true);
  if(result.unchanged)continue;
  const set=result.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle[0].sets[0];
  assert.equal(set.restSeconds,after);assert.equal(set.status,'manual');
  assert.deepEqual(set.provenance,{source:'manual',policyVersion:'manual@1',reason:'retained by speculative editing'});
}
for(const after of [-1,86401,0.5,NaN,Infinity])assert.equal(rules.editPrescriptionField(prescriptionDoc,{...request,field:'restSeconds',after}).ok,false);
for(const patch of [{slotId:'missing'},{cycleIndex:0},{cycleIndex:999},{setIndex:0},{setIndex:999},{field:'targets'}])assert.equal(rules.editPrescriptionField(prescriptionDoc,{...request,...patch}).ok,false);
assert.deepEqual(prescriptionDoc,frozenPrescription);
picked().status='manual';
const cleared=rules.editPrescriptionField(prescriptionDoc,{...request,after:null});
assert.equal(cleared.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle[0].sets[0].rir,null);
console.log('PASS prescription literal bounds, adaptive/manual policy, coordinates, projection and immutable preparation');

// Loading preparation: captured movement identity, literal boundaries and no input mutation.
const loadingDoc=structuredClone(installed);
const loadingSlot=loadingDoc.programMeta.programDefinition.days[0].slots[0];
loadingSlot.metricDefinitions=[{id:'load-fixture',semantic:'loadPerSideKg'}];
loadingDoc.programMeta.loadingConfiguration={byExerciseId:{other:{loadStepKg:7}},defaultLoadStepKg:2.5};
const loadingBefore=structuredClone(loadingDoc);
for(const after of [0.25,100]){
  const result=rules.editLoadStep(loadingDoc,{slotId:loadingSlot.id,after});
  assert.deepEqual(result.edit,{kind:'load_step',exerciseId:loadingSlot.exerciseId,before:null,after});
  assert.deepEqual(result.document.programMeta.loadingConfiguration,{byExerciseId:{other:{loadStepKg:7},[loadingSlot.exerciseId]:{loadStepKg:after}},defaultLoadStepKg:2.5});
  assert.deepEqual(result.document.programMeta.programDefinition,loadingBefore.programMeta.programDefinition);
}
for(const after of [0,-1,100.1,NaN,Infinity,'2'])assert.equal(rules.editLoadStep(loadingDoc,{slotId:loadingSlot.id,after}).ok,false);
assert.deepEqual(rules.editLoadStep(loadingDoc,{slotId:loadingSlot.id,after:null}),{ok:true,unchanged:true});
assert.equal(rules.editLoadStep(loadingDoc,{slotId:'missing',after:1}).ok,false);
for(const semantic of ['loadKg','assistanceKg','loadPerSideKg','persistentLoadPerSideKg']){
  const input=structuredClone(loadingDoc);input.programMeta.programDefinition.days[0].slots[0].metricDefinitions[0].semantic=semantic;
  assert.equal(rules.editLoadStep(input,{slotId:loadingSlot.id,after:1}).ok,true);
}
const noLoad=structuredClone(loadingDoc);noLoad.programMeta.programDefinition.days[0].slots[0].metricDefinitions=[{semantic:'durationSeconds'}];
assert.equal(rules.editLoadStep(noLoad,{slotId:loadingSlot.id,after:1}).ok,false);
const withStep=rules.editLoadStep(loadingDoc,{slotId:loadingSlot.id,after:5}).document;
assert.deepEqual(rules.editLoadStep(withStep,{slotId:loadingSlot.id,after:null}).document.programMeta.loadingConfiguration,{byExerciseId:{other:{loadStepKg:7}},defaultLoadStepKg:2.5});
for(const after of ['bilateral','unilateral']){
  const result=rules.editExecutionMode(loadingDoc,{slotId:loadingSlot.id,after});
  assert.deepEqual(result.edit,{kind:'execution_mode',slotId:loadingSlot.id,before:null,after});
  const expected=structuredClone(loadingBefore);expected.programMeta.programDefinition.days[0].slots[0].executionMode=after;
  assert.deepEqual(result.document,expected,'mode changes only the captured canonical slot, retaining all prescriptions and provenance');
  assert.deepEqual(rules.editExecutionMode(result.document,{slotId:loadingSlot.id,after}),{ok:true,unchanged:true});
}
for(const after of ['',null,'both'])assert.equal(rules.editExecutionMode(loadingDoc,{slotId:loadingSlot.id,after}).ok,false);
assert.equal(rules.editExecutionMode(loadingDoc,{slotId:'missing',after:'bilateral'}).ok,false);
assert.deepEqual(loadingDoc,loadingBefore);
console.log('PASS loading preparation bounds, per-side semantics, defaults, captured identity and immutable receipts');

// Preparation must reject adaptive erasure before mutating an owned document.
// Canonical validation already refused these edits; the public speculative owner
// must not rely on a mounted input guard to enforce the same rule.
const {suggestion}=await import('../src/training/authoring.js');
const adaptiveInput=structuredClone(frozenPrescription);
const adaptiveSlot=adaptiveInput.programMeta.programDefinition.days[0].slots[0];
const adaptiveSet=adaptiveSlot.prescriptionsByCycle[0].sets[0];
const adaptiveBefore=structuredClone(adaptiveInput);
for(const after of [{present:false,value:null},{present:true,value:0},{present:true,value:{min:8,max:7}},{present:true,value:31}]){
  assert.equal(rules.replaceMetricTarget(adaptiveInput,adaptiveSlot.id,1,1,'reps',after),false);
  assert.deepEqual(adaptiveInput,adaptiveBefore,'adaptive target refusal is immutable');
}
for(const after of [null,-1,7,NaN,Infinity,'2']){
  assert.equal(suggestion.setRir(adaptiveInput,adaptiveSlot.id,after),false);
  assert.deepEqual(adaptiveInput,adaptiveBefore,'slot RIR refusal is immutable even for partially adaptive slots');
}
const repMetric=adaptiveSlot.metricDefinitions.find(metric=>metric.semantic==='reps');
const targetRequest={slotId:adaptiveSlot.id,cycleIndex:1,setIndex:1,metricId:repMetric.id,semantic:'reps',after:{present:true,value:{min:5,max:9}}};
const targetPrepared=rules.editMetricTarget(adaptiveInput,targetRequest);
assert.equal(targetPrepared.ok,true);
assert.deepEqual(targetPrepared.edit,{kind:'metric_target',...targetRequest,metricIds:adaptiveSlot.metricIds,metricDefinitions:adaptiveSlot.metricDefinitions,before:{present:true,value:{min:4,max:8}}});
assert.deepEqual(targetPrepared.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle[0].sets[0],{...adaptiveSet,targets:{...adaptiveSet.targets,reps:{min:5,max:9}}});
assert.deepEqual(rules.editMetricTarget(adaptiveInput,{...targetRequest,metricId:'missing'}),{ok:false});
assert.deepEqual(adaptiveInput,adaptiveBefore);
const rirPrepared=rules.editSuggestLoadsRir(adaptiveInput,{slotId:adaptiveSlot.id,after:6});
assert.equal(rirPrepared.ok,true,'speculative maximum stays six; canonical replay retains its narrower maximum');
assert(rirPrepared.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle.every(cycle=>cycle.sets.every(set=>set.rir===6)));
assert.equal(rules.editSuggestLoadsRir(adaptiveInput,{slotId:adaptiveSlot.id,after:null}).ok,false);
const compositionInput=structuredClone(adaptiveInput);
const compositionSlot=compositionInput.programMeta.programDefinition.days[0].slots[0];
compositionSlot.metricOrigin='user_defined';compositionSlot.exerciseId='custom:owned';
compositionInput.customExercises=[{id:'custom:owned',name:'Owned'}];
compositionInput.programMeta.suggestLoadsPending=[compositionSlot.id];
const compositionBefore=structuredClone(compositionInput);
const composed=rules.editMetricComposition(compositionInput,{slotId:compositionSlot.id,metricIds:[],metricDefinitions:[]});
assert.equal(composed.ok,true);
const composedSlot=composed.document.programMeta.programDefinition.days[0].slots[0];
assert.deepEqual(composedSlot.metricIds,[]);assert.equal(composedSlot.metricOrigin,'user_defined');
assert.deepEqual(composedSlot.prescriptionsByCycle[0].sets[0].targets,{});
assert.equal(composedSlot.prescriptionsByCycle[0].sets[0].status,'configuration_required');
assert.deepEqual(composedSlot.prescriptionsByCycle[0].sets[0].provenance,{source:'manual',policyVersion:'manual@1',reason:'retained by speculative editing'});
assert.deepEqual(composed.document.customExercises,[{id:'custom:owned',name:'Owned',metricIds:[],metricDefinitions:[]}]);
assert.deepEqual(composed.document.programMeta.suggestLoadsPending,[compositionSlot.id],'speculation does not consume canonical pending opt-in policy');
assert.deepEqual(compositionInput,compositionBefore);
console.log('PASS metric and slot-RIR preparation owns adaptive refusal, provenance and isolated custom composition');

// Structural receipt preparation owns data writes; UI owns focus and pickers.
const structural=structuredClone(installed),structuralBefore=structuredClone(structural);
const structuralSlot=structural.programMeta.programDefinition.days[0].slots[0];
const renamedProgram=rules.editProgramName(structural,'  My program  ');
assert.deepEqual(renamedProgram.edit,{kind:'program_name',before:structural.programMeta.name||'',after:'My program'});
assert.deepEqual(renamedProgram.document,{...structural,programMeta:{...structural.programMeta,name:'My program'}});
assert.deepEqual(rules.editProgramName(renamedProgram.document,' My program '),{ok:true,unchanged:true});
const removedExercise=rules.editRemoveExercise(structural,structural.program[0].id);
assert.deepEqual(removedExercise.edit,{kind:'exercise_remove',targetId:structural.program[0].id,sourceDay:structural.program[0].day});
assert.equal(removedExercise.document.program.some(row=>row.id===structural.program[0].id),false);
assert.deepEqual(removedExercise.document.program.filter(row=>row.day===structural.program[0].day).map(row=>row.order),[1,2,3,4,5]);
assert.deepEqual(removedExercise.document.programMeta,structural.programMeta,'canonical removal stays in replay');
assert.deepEqual(rules.editRemoveExercise(structural,'missing'),{ok:false});
const customDefinition={id:'custom:replacement',name:'My replacement',metricIds:[],metricDefinitions:[]};
const replacement=rules.editReplaceExercise(structural,{id:structural.program[0].id,entry:customDefinition,customExercise:customDefinition});
assert.equal(replacement.ok,true);assert.deepEqual(replacement.document.customExercises,[customDefinition]);
assert.deepEqual(replacement.edit.customExercise,customDefinition);
assert.equal(replacement.document.program[0].libraryId,'custom:replacement');
assert.equal(replacement.document.program[0].sets,structural.program[0].sets);
assert.deepEqual(rules.editReplaceExercise(structural,{id:structural.program[0].id,entry:customDefinition,customExercise:{...customDefinition,id:'custom:wrong'}}),{ok:false});
assert.deepEqual(rules.editReplaceExercise(structural,{id:'missing',entry:customDefinition,customExercise:customDefinition}),{ok:false});
for(const after of [[structuralSlot.exerciseId],['other','other'],['a','b','c','d','e','f'],[null]]){
  assert.equal(rules.editAlternates(structural,{id:structural.program[0].id,after}).ok,false);
}
const alternated=rules.editAlternates(structural,{id:structural.program[0].id,after:['a','b','c','d','e']});
assert.equal(alternated.ok,true);assert.deepEqual(alternated.edit,{kind:'slot_alternates',targetId:structural.program[0].id,slotId:structuralSlot.id,before:structuralSlot.alternates||[],after:['a','b','c','d','e']});
const staleAlternates=structuredClone(alternated.document),staleBefore=structuredClone(staleAlternates);
assert.equal(rules.applyAlternates(staleAlternates,{...alternated.edit,before:['stale'],after:['new']}),false);
assert.deepEqual(staleAlternates,staleBefore);
const clearedAlternates=rules.editAlternates(alternated.document,{id:structural.program[0].id,after:[]});
assert.equal(Object.hasOwn(clearedAlternates.document.programMeta.programDefinition.days[0].slots[0],'alternates'),false);
assert.deepEqual(structural,structuralBefore,'every accepted and refused preparation leaves input untouched');
console.log('PASS structural preparation identity, custom attachment, order, alternates bounds and stale immutable refusal');

assert.deepEqual(rules.editMetricTarget(targetPrepared.document,targetRequest),{ok:true,unchanged:true});
assert.deepEqual(rules.editMetricComposition(composed.document,{slotId:compositionSlot.id,metricIds:[],metricDefinitions:[]}),{ok:true,unchanged:true});
assert.deepEqual(rules.editAlternates(alternated.document,{id:structural.program[0].id,after:['a','b','c','d','e']}),{ok:true,unchanged:true});
// Non-repetition targets deliberately leave adaptation, while retaining private
// provenance annotations until canonical replay replaces manual provenance.
const nonRep=adaptiveSlot.metricDefinitions.find(metric=>metric.semantic!=='reps');
assert.ok(nonRep);
const ownTarget=rules.editMetricTarget(adaptiveInput,{...targetRequest,metricId:nonRep.id,semantic:nonRep.semantic,after:{present:true,value:12}});
const ownSet=ownTarget.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle[0].sets[0];
assert.equal(ownSet.status,'manual');
assert.deepEqual(ownSet.provenance,{source:'manual',policyVersion:'manual@1',reason:'retained by speculative editing'});
assert.deepEqual(ownSet.targets,{...adaptiveSet.targets,[nonRep.semantic]:12});
assert.deepEqual(ownTarget.document.program[0].prescriptionsByCycle,ownTarget.document.programMeta.programDefinition.days[0].slots[0].prescriptionsByCycle);
const alreadyCustom=structuredClone(structural);alreadyCustom.customExercises=[{...customDefinition,name:'Previously attached'}];
const attached=rules.editReplaceExercise(alreadyCustom,{id:structural.program[0].id,entry:customDefinition,customExercise:customDefinition});
assert.deepEqual(attached.document.customExercises,alreadyCustom.customExercises,'speculation keeps an existing definition; canonical replay checks a conflicting replacement');
assert.deepEqual(adaptiveInput,adaptiveBefore);
