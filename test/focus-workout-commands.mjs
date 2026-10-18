import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkoutRules} from '../src/training/workout.js';

const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/architecture-baseline-v1.json',import.meta.url),'utf8'));
const rules=createWorkoutRules(catalog),context=structuredClone(fixture.inputs.context);
const source=context.exercises[0];source.sets=2;source.setIds=['set-a','set-b'];source.programmedSets=[source.programmedSets[0],structuredClone(source.programmedSets[0])];
let draft=rules.create(context,fixture.inputs.selection,{}),sequence=0;
assert.equal(rules.isDomainError(draft),false);
const exerciseInstanceId=draft.exerciseOrder[0],loadId=draft.exercises[exerciseInstanceId].sets['set-a'].programmed.metrics.find(metric=>metric.semantic==='loadKg').id;
function apply(type,payload){const result=rules.reduce(draft,{type,...payload,operationId:`focus-${++sequence}`,expectedRevision:draft.revision,updatedAt:'2026-10-18T10:04:00.000Z',writer:{installationId:'focus-proof',tabId:'focus-proof',operationId:`focus-${sequence}`}});assert.equal(rules.isDomainError(result),false,JSON.stringify(result));draft=result;return result;}
apply('editMetricValue',{exerciseInstanceId,setId:'set-a',metricId:loadId,value:'42.5'});
const repsId=draft.exercises[exerciseInstanceId].sets['set-a'].programmed.metrics.find(metric=>metric.semantic==='reps').id;
apply('editMetricValue',{exerciseInstanceId,setId:'set-a',metricId:repsId,value:'8'});
apply('editSetField',{exerciseInstanceId,setId:'set-a',field:'rir',value:'2'});
apply('completeSet',{exerciseInstanceId,setId:'set-a',completedAt:'2026-10-18T10:04:00.000Z'});
assert.equal(typeof rules.manualLoadCarry,'function');
const before=JSON.stringify(draft);
assert.equal(rules.manualLoadCarry(draft,exerciseInstanceId,2,{status:'manual',pendingLoad:false}).value,'42.5');
assert.equal(rules.manualLoadCarry(draft,exerciseInstanceId,2,{status:'add',pendingLoad:false}),null);
assert.equal(rules.manualLoadCarry(draft,exerciseInstanceId,2,{status:'manual',pendingLoad:true}),null);
assert.equal(JSON.stringify(draft),before,'prefill policy never writes the aggregate');
apply('markWarmup',{exerciseInstanceId,setId:'set-a'});
assert.equal(rules.manualLoadCarry(draft,exerciseInstanceId,2,{status:'manual',pendingLoad:false}),null,'warmups do not donate carry');
console.log('PASS shared manual carry policy through real DraftV2 producer');

const {createFocusWorkoutCommands,createWorkoutSuggestionCommands}=await import('../src/app/workout.js');
// Recreate a valid active aggregate; commands exercise the real reducer while
// the test controls only persistence acknowledgements and suggestion races.
draft=rules.create(context,fixture.inputs.selection,{});
const workout={dispatch:async(type,payload)=>{const result=rules.reduce(draft,{...(type==='completeSet'?{completedAt:'2026-10-18T10:04:00.000Z'}:{}),type,...payload,operationId:`app-focus-${++sequence}`,expectedRevision:draft.revision,updatedAt:'2026-10-18T10:04:00.000Z',writer:{installationId:'focus-proof',tabId:'focus-proof',operationId:`app-focus-${sequence}`}});if(rules.isDomainError(result))return{status:'domain-error',error:result};draft=result;return{status:'applied',draft};}};
const suggestions=createWorkoutSuggestionCommands({workout,readDraft:()=>draft,readSnapshot:()=>({log:[]}),planUpdates:()=>[],beforeRefresh:async()=>{}});
const focus=createFocusWorkoutCommands({workout,training:rules,readDraft:()=>draft,readUnit:()=> 'lb',suggestions,now:()=> '2026-10-18T10:05:00.000Z'});
const first={exerciseInstanceId,setId:'set-a',ordinal:1},second={exerciseInstanceId,setId:'set-b',ordinal:2};
await focus.editField({target:{...first,field:'metric',metricId:loadId},rawValue:'12.5'});
assert.equal(draft.exercises[exerciseInstanceId].sets['set-a'].edited.metrics[loadId],'5.669904625125443','input uses the canonical shared parser');
await focus.editField({target:{...first,field:'metric',metricId:repsId},rawValue:'8'});
const completed=await focus.toggleSet({target:first,status:'manual',pendingLoad:false,displayedEffort:{field:'rir',value:'2',pending:false}});
assert.equal(completed.status,'applied',JSON.stringify(completed));assert.equal(completed.nowDone,true);
const reopened=await focus.reopenSet({target:first});assert.equal(reopened.status,'applied');
await focus.editField({target:{...first,field:'metric',metricId:loadId},rawValue:'50'});
await focus.cancelEdit({target:first,snapshot:reopened.snapshot});
assert.equal(draft.exercises[exerciseInstanceId].sets['set-a'].edited.metrics[loadId],'5.669904625125443','Cancel restores canonical kilograms, never display pounds');
assert.deepEqual(draft.exercises[exerciseInstanceId].sets['set-a'].completion,{completedAt:'2026-10-18T10:04:00.000Z'},'Cancel preserves workout set completion identity');
await focus.editField({target:{...second,field:'metric',metricId:repsId},rawValue:'9'});
const carried=await focus.toggleSet({target:second,status:'manual',pendingLoad:false,displayedEffort:{field:'rir',value:'1',pending:false}});
assert.equal(carried.status,'applied');assert.equal(draft.exercises[exerciseInstanceId].sets['set-b'].edited.metrics[loadId],'5.669904625125443');
let revision=0,attempts=0;
const staleSuggestions=createWorkoutSuggestionCommands({readDraft:()=>({revision:revision++}),readSnapshot:()=>({log:[]}),planUpdates:()=>[{}],workout:{dispatch:async()=>{attempts++;return{status:'domain-error',error:{code:'stale-suggestion'}}}}});
assert.equal((await staleSuggestions.refresh('e')).status,'refresh-failed');assert.equal(attempts,2,'stale suggestion retries are bounded');
console.log('PASS Focus input completion reopen cancellation and bounded suggestion commands');
