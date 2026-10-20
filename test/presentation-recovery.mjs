import assert from 'node:assert/strict';
import test from 'node:test';
import {createWorkoutRules} from '../src/training/workout.js';
import {createEntryRules} from '../src/training/authoring.js';
import {initializationRecoveryKind} from '../src/ui/workout/recovery.js';
import {entryResumeCopy} from '../src/ui/entry/view.js';
import {createI18n} from '../src/platform/i18n.js';
import {STRINGS} from '../i18n.js';
const workout=createWorkoutRules(null),now='2026-10-18T12:00:00.000Z';
const draft=workout.create({programId:'program',programFingerprint:'fingerprint',dayId:'day',blockId:'block',durableRevision:1,dayLabel:'A',scheduleDate:'2026-10-18',unit:'kg',rirMode:'numeric',exercises:[{exerciseInstanceId:'slot',sourceExerciseId:'source',displayName:'Lift',sets:1,setIds:['set'],minReps:6,maxReps:10,targetRir:2,notes:'',primary:'Chest',secondary:'',sourceFingerprint:'source'}]}, {draftId:'protected-draft',writer:{installationId:'i',tabId:'t',operationId:'create'},startedAt:now,updatedAt:now,scheduleDate:'2026-10-18',selectedExerciseId:'slot',bodyweight:'',notes:''},{});
assert.equal(workout.isDomainError(draft),false);
const raw='  '+JSON.stringify(draft)+'\n',parsed=workout.parse(raw);
assert.equal(parsed.kind,'valid');
test('contextual program recovery uses actual parsed candidate and preserves original bytes',()=>{
  for(const reason of ['programId','programFingerprint','dayId','blockId']){
    const error=workout.parse(raw,{[reason]:'changed'});
    assert.equal(error.kind,'stale');assert.equal(error.reason,reason);
    const result={status:'stale-recovery',error,raw};
    assert.equal(initializationRecoveryKind(result,parsed),'program',reason);
    assert.equal(result.raw,raw);assert.equal(result.error,error);
  }
});
test('unclassified refusals and mismatched candidates never gain program discard',()=>{
  for(const result of [{status:'stale-recovery',raw},{status:'checkpoint-conflict',raw},
    {status:'stale-recovery',raw,error:workout.parse(raw,{durableRevision:2})},
    {status:'stale-recovery',raw,error:{kind:'invalid',code:'invalid-schema'}}]){
    assert.notEqual(initializationRecoveryKind(result,parsed),'program');
  }
  const error=workout.parse(raw,{programFingerprint:'changed'});
  for(const candidate of [{...draft,draftId:'other'},{...draft,revision:1},
    {...draft,program:{...draft.program,dayId:'other'}},
    {...draft,program:{...draft.program,programFingerprint:'other'}}]){
    assert.notEqual(initializationRecoveryKind({status:'stale-recovery',raw,error:{...error,draft:candidate}},parsed),'program');
  }
  assert.notEqual(initializationRecoveryKind({status:'stale-recovery',raw,error},workout.parse('{broken')),'program');
  assert.equal(initializationRecoveryKind({status:'stale'},parsed),'program');
  assert.equal(initializationRecoveryKind({status:'migration-error',error:{code:'unmapped-legacy-metric'}},workout.parse('{}')),'program');
});
test('fresh hub does not request unused resume copy; actual resume steps translate in both languages',()=>{
  const steps=['entry','activation_conflict',...new Set(Object.values(createEntryRules(null).ROUTE_STEPS).flat())];
  for(const lang of ['en','pt']){
    const i18n=createI18n({strings:STRINGS,document:null,navigator:null});i18n.setLang(lang);
    const copy=entryResumeCopy({step:'entry'},null,i18n.t,()=>{throw Error('unused route copy')});
    assert.equal(copy.stepLabel,'');assert.deepEqual(i18n.consumeMissingRequests(),[]);
    for(const step of steps){
      const resumed=entryResumeCopy({step,route:'build',updatedAt:now},'resume',i18n.t,()=> 'Build route');
      assert.ok(resumed.stepLabel);assert.equal(resumed.routeLabel,'Build route');assert.equal(resumed.updatedAt,now);
      if(step==='entry')assert.equal(resumed.stepLabel,STRINGS[lang]['entry.hub.title']);
      assert.deepEqual(i18n.consumeMissingRequests(),[],`${lang}/${step}`);
    }
  }
});
