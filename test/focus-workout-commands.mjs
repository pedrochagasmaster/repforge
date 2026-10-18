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
