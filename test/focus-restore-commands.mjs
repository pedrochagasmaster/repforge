import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkoutRules} from '../src/training/workout.js';
import {createFocusWorkoutCommands,createWorkoutSuggestionCommands} from '../src/app/workout.js';
const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8'));
const fixture=JSON.parse(readFileSync(new URL('./fixtures/architecture-baseline-v1.json',import.meta.url),'utf8'));
const rules=createWorkoutRules(catalog),now='2026-10-18T10:04:00.000Z';
function setup(){
  const context=structuredClone(fixture.inputs.context),source=context.exercises[0];
  context.exercises=['restore-a','restore-b','restore-c'].map(id=>({...structuredClone(source),exerciseInstanceId:id,setIds:[`${id}-set`]}));
  let draft=rules.create(context,{...fixture.inputs.selection,selectedExerciseId:'restore-a'},{}),sequence=0;
  assert.equal(rules.isDomainError(draft),false);
  const reduce=(type,payload)=>{
    const next=rules.reduce(draft,{type,...payload,expectedRevision:draft.revision,operationId:`restore-${++sequence}`,updatedAt:now,
      writer:{installationId:'restore-test',tabId:'restore-test',operationId:`restore-${sequence}`}});
    assert.equal(rules.isDomainError(next),false,JSON.stringify(next));draft=next;
    return{status:'applied',draft};
  };
  const create=workout=>createFocusWorkoutCommands({workout,training:rules,readDraft:()=>draft,readUnit:()=> 'kg',now:()=>now,
    suggestions:createWorkoutSuggestionCommands({workout,readDraft:()=>draft,readSnapshot:()=>({log:[]}),planUpdates:()=>[]})});
  return{read:()=>draft,reduce,create};
}
{
  const {read,reduce,create}=setup();
  reduce('skipExercise',{exerciseInstanceId:'restore-a'});reduce('skipExercise',{exerciseInstanceId:'restore-c'});
  const before=structuredClone(read()),calls=[];
  const owner=create({dispatch:async(type,payload)=>{calls.push([type,payload.exerciseInstanceId]);return reduce(type,payload);}});
  assert.equal(await owner.restoreExercises(),true);
  assert.deepEqual(calls,[['restoreExercise','restore-a'],['restoreExercise','restore-c']]);
  assert.deepEqual(read().exerciseOrder,['restore-a','restore-b','restore-c']);
  assert.deepEqual(read().exerciseOrder.map(id=>read().exercises[id].status),['active','active','active']);
  assert.equal(read().revision,before.revision+2);assert.equal(read().draftId,before.draftId);
  assert.deepEqual(read().session,before.session,'restoration preserves existing session selection and identity');
  assert.deepEqual(read().exercises['restore-a'].sets,before.exercises['restore-a'].sets,'restore never reconstructs workout sets');
  calls.length=0;assert.equal(await owner.restoreExercises(),true);assert.deepEqual(calls,[],'already-visible membership produces no writes');
}
{
  const {read,reduce,create}=setup();for(const id of ['restore-a','restore-b','restore-c'])reduce('skipExercise',{exerciseInstanceId:id});
  const calls=[];
  const owner=create({dispatch:async(type,payload)=>{calls.push(payload.exerciseInstanceId);return calls.length===2?{status:'persist-failed'}:reduce(type,payload);}});
  assert.equal(await owner.restoreExercises(),false);
  assert.deepEqual(calls,['restore-a','restore-b'],'an acknowledgement failure prevents later commands');
  assert.deepEqual(read().exerciseOrder.map(id=>read().exercises[id].status),['active','skipped','skipped']);
}
console.log('PASS Focus restore command: actual canonical reducer, captured membership/order, identity preservation, refusal stops later writes');
