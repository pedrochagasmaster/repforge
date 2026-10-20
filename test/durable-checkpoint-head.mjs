import assert from 'node:assert/strict';
import {createDurableStore} from '../src/persistence/durable.js';
import {createWorkoutDraftSession} from '../src/app/workout.js';
import * as policy from '../src/persistence/snapshot.js';
import {createWorkoutRules} from '../src/training/workout.js';
import metrics from '../src/training/metrics.js';
import {createEntryRules} from '../src/training/authoring.js';
const workout=createWorkoutRules(null);
const snapshotPolicy=policy.createSnapshotPolicy({entry:createEntryRules(null),metrics,workout,model:{}});
const original={program:[],log:[],programMeta:{id:'program-before'},settings:{unit:'kg'},_storageRevision:1};
const beforeContext=policy.workoutParseContextForSnapshot(original,'A');
assert.deepEqual(beforeContext,{programId:'program-before',programFingerprint:'program-v1:47:6b594df5cf10e5d901d38e17fb51c965',dayId:'A'});
const structured={...original,program:[{day:'A',name:'Z',order:2,dayId:'row-later'},{day:'A',name:'A',order:1,dayId:'row-first'}],programMeta:{id:'p',programStructure:{days:[{label:'A',dayId:'structure-day'}]},blockId:null}};
assert.equal(policy.workoutParseContextForSnapshot(structured,'A').dayId,'structure-day');
assert.equal(policy.workoutParseContextForSnapshot(structured,'A').blockId,null);
assert.equal(policy.workoutParseContextForSnapshot({...structured,programMeta:{id:'p'}},'A').dayId,'row-first');
assert.equal(policy.workoutParseContextForSnapshot({...structured,programMeta:{...structured.programMeta,programDefinition:{days:[{kind:'training',name:'A',id:'canonical-day'}]}}},'A').dayId,'canonical-day');
const now='2026-10-18T12:00:00.000Z';
const draft=workout.create({...beforeContext,durableRevision:1,dayLabel:'A',scheduleDate:'2026-10-18',unit:'kg',rirMode:'numeric',exercises:[{exerciseInstanceId:'slot',sourceExerciseId:'source',displayName:'Lift',sets:1,setIds:['set'],minReps:6,maxReps:10,targetRir:2,notes:'',primary:'Chest',secondary:'',sourceFingerprint:'source'}]}, {draftId:'protected-draft',writer:{installationId:'i',tabId:'t',operationId:'create'},startedAt:now,updatedAt:now,scheduleDate:'2026-10-18',selectedExerciseId:'slot',bodyweight:'',notes:''},{});
assert.equal(workout.isDomainError(draft),false,JSON.stringify(draft));
const raw=JSON.stringify(draft);
const edited=workout.reduce(draft,{type:'editSetField',exerciseInstanceId:'slot',setId:'set',field:'load',value:'10',operationId:'edit',expectedRevision:draft.revision,updatedAt:now,writer:{installationId:'i',tabId:'t'}});
assert.equal(workout.isDomainError(edited),false);
async function recover({competing=null,invalidHead=false,pending=false,mode='committed'}={}){
 const committed={version:1,kind:'committed',draftId:draft.draftId,revision:draft.revision,operationId:'create',programFingerprint:draft.program.programFingerprint,raw};
 const next={...committed,revision:edited.revision,operationId:'edit',raw:JSON.stringify(edited)};
 const checkpoint=mode==='committed'?committed:mode==='pending-removal'?{...committed,kind:'pending-removal',baseRaw:raw}:mode==='pending-rollback'?{...next,kind:'pending',baseRaw:raw,previous:committed}:{...committed,kind:'pending',baseRaw:null,previous:null};
 const canonicalRaw=mode==='committed'?'unprotected-canonical':mode==='pending-new'?null:raw;
 const checkpointRaw=JSON.stringify(checkpoint);
 const values=new Map([['repforge_v1',JSON.stringify(original)],['repforge_draft_v1',canonicalRaw],['repforge_draft_v1:v2-checkpoint',checkpointRaw]]);
 let idb=structuredClone(original),writes=0;const locks=[];
 const platform={localStorage:{get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem(key,value){writes++;values.set(key,value)},removeItem:key=>values.delete(key)},
 navigator:{locks:{async request(name,callback){locks.push(name);if(name==='repforge:state-write'){if(competing){values.set('repforge_v1',JSON.stringify(competing));idb=structuredClone(competing)}if(invalidHead)values.set('repforge_v1','unreadable');if(pending)values.set('repforge_pending_v1:inflight','{}')}return callback()}}},
 indexedDB:{open(){const request={result:{close(){},transaction(){return{objectStore(){return{get(){const read={};queueMicrotask(()=>{read.result=idb;read.onsuccess?.()});return read}}}}}}};queueMicrotask(()=>request.onsuccess?.());return request}}};
 const store=createDurableStore({snapshotPolicy,workout,platform,session:{getState:()=>original,parseContext:()=>beforeContext,blockStartGuard:()=>null}});
 const outcome=await store.reconcileV2Checkpoint({status:'ok',raw:canonicalRaw},'A');
 return{outcome,values,writes,locks,canonicalRaw,checkpointRaw};
}
const success=await recover();assert.equal(success.outcome.status,'ok');assert.equal(success.values.get('repforge_draft_v1'),raw);assert.deepEqual(success.locks,['repforge:state-write','repforge:draft-write']);
const changed={...original,programMeta:{id:'program-after'},_storageRevision:2};
for(const scenario of [{competing:changed},{competing:{...original,log:[{session:'protected-draft'}],_storageRevision:2}},{invalidHead:true},{pending:true}]){
 const result=await recover(scenario);assert.equal(result.outcome.status,'stale-recovery',JSON.stringify(scenario));
 assert.equal(result.values.get('repforge_draft_v1'),'unprotected-canonical','fail closed without replacing canonical bytes');
 const checkpoint=JSON.parse(result.values.get('repforge_draft_v1:v2-checkpoint'));assert.equal(checkpoint.operationId,'create');
 assert(result.writes<=1,'only optional diagnostic recovery retention may write');
}
console.log('PASS literal day-pin precedence and actual DraftV2 checkpoint recovery under competing program/saved-session, unknown replica and pending journal heads');

// These branches previously bypassed the committed-restoration guard. The
// checkpoint bytes stay unchanged while another tab advances the durable head.
for(const mode of ['pending-new','pending-written','pending-rollback','pending-removal']){
 const positive=await recover({mode});assert.equal(positive.outcome.status,'ok',mode);
 assert.equal(positive.values.get('repforge_draft_v1'),raw,mode);
 assert.equal(JSON.parse(positive.values.get('repforge_draft_v1:v2-checkpoint')).kind,'committed',mode);
 for(const scenario of [{competing:changed},{competing:{...original,log:[{session:'protected-draft'}],_storageRevision:2}},{invalidHead:true},{pending:true}]){
  const blocked=await recover({...scenario,mode});
  assert.equal(blocked.outcome.status,'stale-recovery',`${mode}: ${JSON.stringify(scenario)}`);
  assert.equal(blocked.values.get('repforge_draft_v1'),blocked.canonicalRaw,'promotion must retain exact canonical bytes');
  assert.equal(blocked.values.get('repforge_draft_v1:v2-checkpoint'),blocked.checkpointRaw,'failed promotion must retain exact checkpoint bytes');
  assert(blocked.writes<=1,'only diagnostic recovery retention may write');
 }
}
console.log('PASS literal pending-new/pending-written/previous-rollback/removal-rollback promotion matrix: 4 positive, 16 changed/saved/unreadable/inflight head refusals');

// Recovery retention is a durable-owner capability, also used by the native
// lifecycle when it refuses an unreadable draft. Fault injection here checks
// exact bytes/envelope and observation independently of checkpoint repair.
const recoveryKey='repforge_draft_v1:recovery';
const retained=new Map([['repforge_draft_v1',raw],['repforge_draft_v1:v2-checkpoint','protected checkpoint']]);
const observed=[];
let failRetention=false;
const retentionStore=createDurableStore({snapshotPolicy,workout,
 platform:{localStorage:{getItem:key=>retained.get(key)??null,setItem(key,value){if(failRetention)throw new Error('quota');retained.set(key,value)}}},
 session:{onDraftRecovery:value=>observed.push(value)}});
const damagedRaw=' \n{"unknown":"café 🚧","broken":\t';
retentionStore.retainDraftRecovery(damagedRaw,'malformed-draft');
assert.equal(retained.get(recoveryKey),JSON.stringify({version:1,reason:'malformed-draft',raw:damagedRaw}));
assert.deepEqual(observed,[{raw:damagedRaw,reason:'malformed-draft'}]);
const retainedBeforeFailure=retained.get(recoveryKey);
failRetention=true;
assert.doesNotThrow(()=>retentionStore.retainDraftRecovery('new exact bytes\n','stale-program'));
assert.equal(retained.get(recoveryKey),retainedBeforeFailure,'failed best-effort retention leaves previous sidecar intact');
assert.deepEqual(observed.at(-1),{raw:'new exact bytes\n',reason:'stale-program'},'observer still receives recovery when storage rejects the sidecar');
failRetention=false;
retentionStore.retainDraftRecovery(null,'missing-draft');
assert.equal(retained.get(recoveryKey),'{"version":1,"reason":"missing-draft","raw":null}');
assert.deepEqual(observed.at(-1),{raw:null,reason:'missing-draft'});
assert.equal(retained.get('repforge_draft_v1'),raw,'retention never replaces canonical bytes');
assert.equal(retained.get('repforge_draft_v1:v2-checkpoint'),'protected checkpoint','retention never acknowledges or changes checkpoints');
console.log('PASS actual durable recovery retention: exact raw/envelope, null raw, and observer despite rejected sidecar write');

// Exercise the native refusal path with the real durable read/reconcile/retain
// capabilities, so the proof also covers the consumer's exact reason and bytes.
retained.set('repforge_draft_v1',damagedRaw);
retained.delete('repforge_draft_v1:v2-checkpoint');
const refusedSession=createWorkoutDraftSession({workout,drafts:retentionStore.DraftStore,
 reconcile:retentionStore.reconcileV2Checkpoint,retainRecovery:retentionStore.retainDraftRecovery,
 context:{draftInputs:()=>({})},readContext:()=>({}),now:()=>now,
 operationId:()=> 'refused',writer:id=>({installationId:'i',tabId:'t',operationId:id})});
for(const writeFails of [false,true]){
 failRetention=writeFails;
 const refused=await refusedSession.initialize({label:'A',days:['A']});
 assert.equal(refused.status,'invalid');
 assert.equal(refused.raw,damagedRaw);
 assert.deepEqual(observed.at(-1),{raw:damagedRaw,reason:'invalid-json'});
 assert.equal(refusedSession.read().draft,null,'invalid bytes never publish an acknowledged draft');
 assert.equal(retained.get('repforge_draft_v1'),damagedRaw);
 assert.equal(retained.has('repforge_draft_v1:v2-checkpoint'),false);
}
console.log('PASS native lifecycle refusal uses actual durable retention with and without sidecar-write availability');
