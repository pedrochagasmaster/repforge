import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkoutRules} from '../src/training/workout.js';
import {createProgramModel} from '../src/training/model.js';
import {createWorkoutReadModel} from '../src/app/workout-model.js';
import {createWorkoutExerciseCommands} from '../src/app/workout.js';
const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/architecture-baseline-v1.json',import.meta.url),'utf8'));
const rules=createWorkoutRules(catalog),librarySource={library:[]},model=createProgramModel({catalog,librarySource,now:'2026-10-18T10:00:00.000Z',nextId:()=>{throw Error('exercise action allocated query identity');}});
const queries=createWorkoutReadModel({catalog,librarySource,model}),loadId='2555c6f170d8805cafa6d16d3fdddbaa',repsId='2555c6f170d88072bbf6d9ad3f16ea86';
function setup({metric=true,effortMode=true,refuse=false}={}){
  const context=structuredClone(fixture.inputs.context),source=context.exercises[0],exerciseId=source.exerciseInstanceId;
  let draft=rules.create(context,fixture.inputs.selection,{}),sequence=0;assert.equal(rules.isDomainError(draft),false);
  const exercise={id:exerciseId,name:source.displayName,libraryId:source.libraryId,day:'Baseline',sets:1,min:6,max:10};
  const previous={id:'previous-row',session:'previous-session',date:'2026-10-17',set:1,performedLibraryId:source.libraryId,load:42.5,reps:8,
    ...(metric?{metricIds:[loadId,repsId],metricDefinitions:source.metricDefinitions,metricValues:[{metricId:loadId,value:42.5,unit:'kg'},{metricId:repsId,value:8,unit:'reps'}]}:{})};
  const snapshot={program:[exercise],log:[previous],settings:{unit:'lb',minJump:2.5},programMeta:{}},calls=[];
  const workout={dispatch:async(type,payload)=>{
    calls.push([type,structuredClone(payload)]);if(refuse)return{status:'persist-failed'};
    const next=rules.reduce(draft,{type,...payload,operationId:`exercise-${++sequence}`,expectedRevision:draft.revision,updatedAt:'2026-10-18T10:04:00.000Z',writer:{installationId:'exercise-test',tabId:'exercise-test'}});
    if(rules.isDomainError(next))return{status:'domain-error',error:next};draft=next;return{status:'applied',draft};
  }};
  const owner=createWorkoutExerciseCommands({workout,read:()=>({draft,query:queries.capture({snapshot,draft,currentCycle:1,profileWeightKg:null}),program:[exercise],effortMode})});
  return{owner,calls,exerciseId,read:()=>draft,previous};
}
for(const [metric,effortMode,expected]of [
  [true,true,{ordinal:1,metrics:{[loadId]:'42.5',[repsId]:'8'}}],
  [true,false,{ordinal:1,metrics:{[loadId]:'42.5',[repsId]:'8'}}],
  [false,true,{ordinal:1,load:'42.5',reps:'8',effort:'hard'}],
  [false,false,{ordinal:1,load:'42.5',reps:'8',rir:''}],
]){
  const {owner,calls,exerciseId,read,previous}=setup({metric,effortMode}),before=JSON.stringify(previous),draftId=read().draftId;
  const result=await owner.repeatPrevious(exerciseId);assert.equal(result.status,'applied',JSON.stringify(result));
  assert.deepEqual(calls,[['repeatPreviousSetValues',{exerciseInstanceId:exerciseId,values:[expected]}]],'released metric/scalar inclusion policies remain distinct');
  assert.equal(read().draftId,draftId);assert.equal(JSON.stringify(previous),before,'history raw values remain immutable');
  if(metric){const set=read().exercises[exerciseId].sets['baseline-set-1'];assert.equal(set.edited.metrics[loadId],'42.5','lb display never changes canonical repeat kilograms');assert.equal(set.edited.metrics[repsId],'8');}
}
{
  const {owner,exerciseId,read}=setup();
  assert.equal((await owner.toggleWarmup(exerciseId,'baseline-set-1')).status,'applied');assert.equal(read().exercises[exerciseId].sets['baseline-set-1'].role,'warmup');
  await owner.toggleWarmup(exerciseId,'baseline-set-1');assert.equal(read().exercises[exerciseId].sets['baseline-set-1'].role,'working');
  await owner.toggleSkipped(exerciseId);assert.equal(read().exercises[exerciseId].status,'skipped');
  await owner.toggleSkipped(exerciseId);assert.equal(read().exercises[exerciseId].status,'active');
}
{
  const {owner,exerciseId,read,calls}=setup({refuse:true}),before=JSON.stringify(read());
  assert.equal((await owner.repeatPrevious(exerciseId)).status,'persist-failed');assert.equal(calls.length,1);assert.equal(JSON.stringify(read()),before,'refused publication leaves the aggregate byte-identical');
}
console.log('PASS real workout exercise commands: canonical repeat, distinct missing-RIR policies, immutable history/identity, role/skip toggles and refused writes');
