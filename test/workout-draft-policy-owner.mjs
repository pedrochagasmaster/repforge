import assert from 'node:assert/strict';
import {createWorkoutDraftPolicy} from '../src/app/workout.js';
import {createWorkoutRules} from '../src/training/workout.js';
import * as policy from '../src/persistence/snapshot.js';
const workout=createWorkoutRules(null);
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

let canonical={status:'ok',raw:null},checkpoint={status:'absent',raw:null},entries=[];
const writes=[];
const drafts={readRaw:()=>canonical.raw,readCanonicalStatus:()=>canonical,readV2Checkpoint:()=>checkpoint,pending:()=>({entries}),removeV2(){writes.push('remove')},promote(){writes.push('promote')}};
const owner=createWorkoutDraftPolicy({drafts,workout,writer:id=>({installationId:'i',tabId:'t',operationId:id}),operationId:()=> 'rename-op',now:()=> '2026-10-19T00:00:00.000Z'});
const record={version:1,kind:'committed',draftId:draft.draftId,revision:draft.revision,operationId:'create',programFingerprint:draft.program.programFingerprint,raw};
assert.equal(owner.blockStartGuard(original),null);
checkpoint={status:'valid',value:record};
assert.equal(owner.readLive(original).source,'checkpoint');
assert.equal(owner.blockStartGuard(original).code,'live_draft_blocks_next_block','checkpoint still protects draft when canonical bytes are absent');
const newer=JSON.stringify({...draft,revision:draft.revision+1});
checkpoint={status:'valid',value:{...record,kind:'pending',raw:newer,baseRaw:null,previous:record}};
assert.equal(owner.readLive(original).raw,raw,'before publication acknowledged predecessor is authoritative');
checkpoint={status:'valid',value:{...record,kind:'pending',raw:newer,baseRaw:null,previous:null}};
assert.equal(owner.readLive(original).raw,newer,'first in-flight publication also blocks destructive start');
checkpoint={status:'valid',value:{...record,kind:'pending-removal',baseRaw:raw}};
assert.equal(owner.readLive(original).source,'checkpoint-pending-removal');
checkpoint={status:'valid',value:{...record,kind:'tombstone'}};
assert.equal(owner.blockStartGuard(original),null);
entries=[{value:{programFingerprint:'foreign-context',raw}}];
assert.equal(owner.blockStartGuard(original),null,'unrelated queued context cannot override tombstone');
entries.push({value:{programFingerprint:policy.draftContextFingerprint(original),raw:newer}});
assert.equal(owner.readLive(original).source,'pending');assert.equal(owner.readLive(original).raw,newer);
canonical={status:'read-failed'};
assert.equal(owner.blockStartGuard(original).code,'draft_state_unavailable','unreadable canonical fails closed before queue');
canonical={status:'ok',raw};entries=[];checkpoint={status:'invalid'};
assert.equal(owner.blockStartGuard(original).code,'draft_state_unavailable');
checkpoint={status:'valid',value:{...record,raw:'malformed'}};
assert.equal(owner.blockStartGuard(original).code,'draft_state_unavailable');
assert.deepEqual(writes,[],'read policy never repairs, promotes, removes or publishes a draft');
checkpoint={status:'absent',raw:null};canonical={status:'ok',raw};
const next={...original,program:[{id:'new-slot',day:'B'}]};
const renamed=owner.renameDay('A','B',next);
assert.equal(renamed.status,'valid');assert.equal(renamed.effect.expectedRaw,raw);
const result=workout.parse(renamed.effect.replacementRaw);assert.equal(result.kind,'valid');
assert.equal(result.draft.program.dayLabel,'B');assert.equal(result.draft.revision,draft.revision+1);
assert.equal(result.draft.program.programFingerprint,policy.workoutProgramFingerprint(next));
assert.equal(result.draft.session.updatedAt,'2026-10-19T00:00:00.000Z');assert.equal(result.draft.writer.operationId,'day-rename-rename-op');
assert.equal(JSON.parse(raw).program.dayLabel,'A','captured bytes remain unchanged');
canonical={status:'ok',raw:null};assert.deepEqual(owner.renameDay('A','B',next),{status:'valid',effect:{required:true,kind:'clear-draft',expectedRaw:null,precondition:'abort-same-day',conflictDay:'A'}});
canonical={status:'ok',raw:'{"__day":"A","literal":"kept"}'};
assert.equal(owner.renameDay('A','B').effect.replacementRaw,'{"__day":"B","literal":"kept"}');
assert.equal(owner.preserve('exact bytes').effect.replacementRaw,'exact bytes');
assert.equal(owner.preserve(null).effect.precondition,'abort-changed');
assert.equal(owner.consumedClear(raw).effect.precondition,'match-only');
assert.equal(owner.destructiveClear(raw).effect.precondition,'abort-changed');
console.log('PASS actual Workout draft rules: checkpoint/queued/predecessor protection, fail-closed reads, zero read mutation and exact rename receipts');

// Application lifetime contract, using the real reducer. The controlled CAS
// boundary proves publication/queue decisions, not the durable storage protocol.
const {createWorkoutDraftSession}=await import('../src/app/workout.js');
assert.equal(typeof createWorkoutDraftSession,'function','native draft session owner exists');
let stored=raw,writeResult=null,releaseWrite=null,writeEntered=null;
const entered=()=>new Promise(resolve=>{writeEntered=resolve});
const attempts=[];
const sessionStore={readCanonicalStatus:()=>({status:'ok',raw:stored}),
  async compareAndSwapV2(attempt){attempts.push(structuredClone(attempt));writeEntered?.();writeEntered=null;
    if(releaseWrite===true)await new Promise(resolve=>{releaseWrite=resolve});
    if(writeResult)return writeResult;
    const live=workout.parse(stored);
    if(attempt.expectedDraftId&&(live.kind!=='valid'||live.draft.draftId!==attempt.expectedDraftId||live.draft.revision!==attempt.expectedRevision))return{status:'stale',raw:stored};
    stored=attempt.nextRaw;return{status:'applied',raw:stored,draft:workout.parse(stored).draft};},
  async removeV2(){return{status:'stale'}}};
const publication=[];
const lifecycle=createWorkoutDraftSession({workout,drafts:sessionStore,
  reconcile:async read=>read,context:{draftInputs:()=>({parse:()=>beforeContext,disposable:()=>false,
    migration:()=>{throw Error('unexpected migration')},creation:()=>{throw Error('unexpected creation')}})},readContext:()=>({}),
  now:()=>now,operationId:(()=>{let n=0;return()=>`op-${++n}`})(),writer:id=>({installationId:'i',tabId:'t',operationId:id}),
  onPublish:value=>publication.push(value),retainRecovery:()=>{}});
assert.equal((await lifecycle.initialize({label:'A',days:['A']})).status,'ready');
assert.equal(lifecycle.read().raw,raw);
const waiting=entered();releaseWrite=true;
const first=lifecycle.dispatch('editSetField',{exerciseInstanceId:'slot',setId:'set',field:'load',value:'42'});
await waiting;
assert.equal(lifecycle.read().draft.exercises.slot.sets.set.edited.load,null,'speculation never publishes before CAS acknowledges');
const payload={exerciseInstanceId:'slot',setId:'set',field:'reps',value:'8'};
const second=lifecycle.dispatch('editSetField',payload);payload.value='999';
releaseWrite();releaseWrite=null;
assert.equal((await first).status,'applied');assert.equal((await second).status,'applied');
assert.equal(lifecycle.read().draft.exercises.slot.sets.set.edited.reps,'8','queued intent is captured, not caller mutable');
assert.equal(attempts[1].expectedRevision,attempts[0].expectedRevision+1,'queued command reduces acknowledged predecessor');
const acknowledged=lifecycle.read();writeResult={status:'checkpoint-commit-failed',raw:'speculative bytes',draft};
const failed=await lifecycle.dispatch('editSetField',{exerciseInstanceId:'slot',setId:'set',field:'load',value:'99'});
assert.equal(failed.status,'checkpoint-commit-failed');assert.equal(lifecycle.read().raw,acknowledged.raw);
assert.equal(lifecycle.read().draft.exercises.slot.sets.set.edited.load,'42');
assert.equal((await lifecycle.dispatch('skipExercise',{exerciseInstanceId:'slot'})).status,'recovery-pending');
writeResult=null;assert.equal((await lifecycle.retry(failed.attempt)).status,'applied');
assert.equal(attempts.at(-1).nextRaw,failed.attempt.nextRaw,'retry preserves original speculative bytes and identity');
assert.equal(lifecycle.read().draft.exercises.slot.sets.set.edited.load,'99');
// Cancelling/replacing the lifetime while persistence is outstanding cannot
// resurrect its old acknowledged projection or retarget queued work.
const waitingCancel=entered();releaseWrite=true;
const inFlight=lifecycle.dispatch('skipExercise',{exerciseInstanceId:'slot'});
await waitingCancel;
const queued=lifecycle.dispatch('restoreExercise',{exerciseInstanceId:'slot'});
lifecycle.clear();releaseWrite();releaseWrite=null;
assert.equal((await inFlight).status,'cancelled');assert.equal((await queued).status,'cancelled');
assert.equal(lifecycle.read().draft,null);
console.log('PASS draft session queue: acknowledged publication, captured intent/revision, exact retry, recovery blocking and cancellation');

let finishReconcile,enteredReconcile;
const reconciliationStarted=new Promise(resolve=>{enteredReconcile=resolve});
const exactRaw=' \n'+raw+'\n ';
const bootOwner=createWorkoutDraftSession({workout,drafts:{...sessionStore,readCanonicalStatus:()=>({status:'ok',raw:exactRaw})},
  reconcile:async read=>{enteredReconcile();await new Promise(resolve=>{finishReconcile=resolve});return read;},
  context:{draftInputs:()=>({parse:()=>beforeContext,disposable:()=>false,migration:()=>{},creation:()=>{}})},readContext:()=>({}),
  now:()=>now,operationId:()=> 'boot',writer:id=>({installationId:'i',tabId:'t',operationId:id}),retainRecovery:()=>{}});
const boot=bootOwner.initialize({label:'A',days:['A'],restoreDay:true});
await reconciliationStarted;bootOwner.clear();finishReconcile();
assert.equal((await boot).status,'cancelled','cancel during initialization cannot resurrect acknowledged session');
assert.equal(bootOwner.read().draft,null);
const reload=bootOwner.initialize({label:'A',days:['A'],restoreDay:true});
await new Promise(resolve=>setImmediate(resolve));finishReconcile();
assert.equal((await reload).status,'ready');assert.equal(bootOwner.read().raw,exactRaw,'adoption preserves original checkpoint bytes, not reserialization');

// Capture at the public application command boundary, before its shared queue.
const {createWorkoutCommands}=await import('../src/app/workout.js');
const {createSession}=await import('../src/app/session.js');
const application=createSession({initialSnapshot:{log:[]}});
let releaseApplication;const applicationGate=new Promise(resolve=>{releaseApplication=resolve});
application.run(()=>applicationGate);
let currentDraft={...draft},received=[];
const publicCommands=createWorkoutCommands({session:application,training:workout,drafts:{
  read:()=>({draft:currentDraft,raw}),dispatch:async(type,payload)=>{received.push({type,payload});return{status:'applied'};}}});
const queuedPayload={value:'42'};
const obsolete=publicCommands.dispatch('editSetField',queuedPayload);
queuedPayload.value='999';currentDraft={...draft,draftId:'replacement'};releaseApplication();
assert.equal((await obsolete).status,'stale','outer queue must not retarget the replacement draft');
assert.deepEqual(received,[]);
let releaseCapture;const captureGate=new Promise(resolve=>{releaseCapture=resolve});application.run(()=>captureGate);
const samePayload={value:'12'};const sameLifetime=publicCommands.dispatch('editSetField',samePayload);
samePayload.value='900';releaseCapture();await sameLifetime;
assert.equal(received[0].payload.value,'12','outer queue captures mutable input at invocation');

let removalReceipt={status:'stale'},removedIdentity,removedRaw,legacyRemovals=0;
const removeOwner=createWorkoutDraftSession({workout,drafts:{...sessionStore,
  readCanonicalStatus:()=>({status:'ok',raw:stored}),
  removeV2:async identity=>{removedIdentity=identity;return removalReceipt;},
  removeLegacy:async request=>{removedRaw=request.expectedRaw;return removalReceipt;},
  remove:()=>{legacyRemovals++;return true;}},
  reconcile:async read=>read,context:{draftInputs:()=>({parse:()=>beforeContext,disposable:()=>false,migration:()=>{},creation:()=>{}})},readContext:()=>({}),
  now:()=>now,operationId:()=> 'remove',writer:id=>({installationId:'i',tabId:'t',operationId:id}),retainRecovery:()=>{}});
removeOwner.adopt(draft,raw);
assert.equal((await removeOwner.removeCurrent()).status,'stale');
assert.equal(removeOwner.read().raw,raw,'lost remove CAS retains acknowledged draft');
assert.equal(removedIdentity.expectedDraftId,'protected-draft');assert.equal(removedIdentity.expectedRevision,draft.revision);
removalReceipt={status:'applied'};
assert.equal((await removeOwner.removeCurrent()).status,'applied');assert.equal(removeOwner.read().draft,null);
const legacyBytes=' { "__day": "A", "unknown": "untouched" } ';
assert.equal((await removeOwner.discard({raw:legacyBytes})).status,'applied');assert.equal(removedRaw,legacyBytes);
stored=raw;assert.equal((await removeOwner.removeCurrent()).status,'stale');assert.equal(legacyRemovals,0,'unadopted live V2 cannot be removed through legacy path');
stored='{"__day":"A"}';assert.equal((await removeOwner.removeCurrent()).status,'applied');assert.equal(legacyRemovals,1);
console.log('PASS public command capture and exact current/recovery draft removal');

let releaseReload,enterReload;
const reloadEntered=new Promise(resolve=>{enterReload=resolve});
const changed=structuredClone(draft);changed.draftId='different-draft';stored=JSON.stringify(changed);
const retarget=createWorkoutDraftSession({workout,drafts:sessionStore,
  reconcile:async read=>{enterReload();await new Promise(resolve=>{releaseReload=resolve});return read;},
  context:{draftInputs:()=>({parse:()=>beforeContext,disposable:()=>false,migration:()=>{},creation:()=>{}})},readContext:()=>({}),
  now:()=>now,operationId:()=> 'retarget',writer:id=>({installationId:'i',tabId:'t',operationId:id}),retainRecovery:()=>{}});
retarget.adopt(draft,raw);
const reloading=retarget.initialize({label:'A',days:['A']});await reloadEntered;
const staleIntent=retarget.dispatch('editSetField',{exerciseInstanceId:'slot',setId:'set',field:'load',value:'123'});
releaseReload();assert.equal((await reloading).status,'ready');
assert.equal((await staleIntent).status,'cancelled','initializing another identity ends the old native command lifetime');
assert.equal(retarget.read().draft.draftId,'different-draft');
assert.equal(retarget.read().draft.exercises.slot.sets.set.edited.load,null,'reused set IDs do not authorize an old command');
// Reloading the same identity still allows sequential commands to consume the
// new acknowledged revision rather than invalidating legitimate queued work.
const sameReload=retarget.initialize({label:'A',days:['A']});
await new Promise(resolve=>setImmediate(resolve));
const sameQueued=retarget.dispatch('editSetField',{exerciseInstanceId:'slot',setId:'set',field:'load',value:'124'});
releaseReload();await sameReload;assert.equal((await sameQueued).status,'applied');
assert.equal(retarget.read().draft.exercises.slot.sets.set.edited.load,'124');

let releaseStartFlush;const startFlush=new Promise(resolve=>{releaseStartFlush=resolve});let startOptions;
const startCommands=createWorkoutCommands({session:application,training:workout,drafts:{
  flush:()=>startFlush,start:async(label,options)=>{startOptions=options;return{status:'ready'};}}});
const selectedOptions={contextTouched:{day:true}};
const starting=startCommands.start('A',selectedOptions);selectedOptions.contextTouched.day=false;
releaseStartFlush();await starting;
assert.equal(startOptions.contextTouched.day,true,'Start captures selection input before flushing pending work');

const {createWorkoutSuggestionCommands}=await import('../src/app/workout.js');
let suggestionFault='stale-suggestion-loop',suggestionUpdates=[{}];stored=raw;
const suggestionDraft=createWorkoutDraftSession({workout,drafts:sessionStore,reconcile:async read=>read,
  context:{draftInputs:()=>({parse:()=>beforeContext,disposable:()=>false,migration:()=>{},creation:()=>{}})},readContext:()=>({}),
  now:()=>now,operationId:()=> 'suggestions',writer:id=>({installationId:'i',tabId:'t',operationId:id}),retainRecovery:()=>{},fault:()=>suggestionFault});
suggestionDraft.adopt(draft,raw);
const suggestionOwner=createWorkoutSuggestionCommands({workout:suggestionDraft,draftSession:suggestionDraft,
  readDraft:()=>suggestionDraft.read().draft,readSnapshot:()=>original,planUpdates:()=>suggestionUpdates});
assert.equal((await suggestionOwner.refresh('slot')).status,'refresh-failed');
assert.equal(suggestionDraft.read().recovery?.status,'refresh-failed','native suggestion failure suspends mutation without any UI recovery state');
assert.equal((await suggestionDraft.dispatch('skipExercise',{exerciseInstanceId:'slot'})).status,'recovery-pending');
assert.equal((await suggestionDraft.removeCurrent()).status,'recovery-pending');
suggestionFault=undefined;suggestionUpdates=[];
assert.equal((await suggestionOwner.retry('slot')).status,'unchanged');
assert.equal(suggestionDraft.read().recovery,null,'unchanged retry releases the native suspension');
assert.equal((await suggestionDraft.dispatch('skipExercise',{exerciseInstanceId:'slot'})).status,'applied');

suggestionFault='stale-suggestion-loop';suggestionUpdates=[{}];
assert.equal((await suggestionOwner.refresh('slot')).status,'refresh-failed');
let releaseSuggestionRetry,enterSuggestionRetry;
const suggestionRetryEntered=new Promise(resolve=>{enterSuggestionRetry=resolve});
const delayedSuggestions=createWorkoutSuggestionCommands({workout:suggestionDraft,draftSession:suggestionDraft,
  readDraft:()=>suggestionDraft.read().draft,readSnapshot:()=>original,planUpdates:()=>suggestionUpdates,
  beforeRefresh:async()=>{enterSuggestionRetry();await new Promise(resolve=>{releaseSuggestionRetry=resolve});}});
const oldRetry=delayedSuggestions.retry('slot');await suggestionRetryEntered;
assert.equal((await suggestionDraft.dispatch('skipExercise',{exerciseInstanceId:'slot'})).status,'recovery-pending','active suggestion retry never authorizes unrelated mutation');
assert.equal((await suggestionDraft.removeCurrent()).status,'recovery-pending','active suggestion retry cannot clear suspension through an unrelated write');
assert.equal(suggestionDraft.read().recovery?.status,'refresh-failed');
const replacementDraft={...draft,draftId:'replacement-suggestion-draft'};
suggestionDraft.adopt(replacementDraft,JSON.stringify(replacementDraft));
suggestionDraft.suspendSuggestions('slot',replacementDraft.draftId);
suggestionFault=undefined;suggestionUpdates=[];releaseSuggestionRetry();
assert.equal((await oldRetry).status,'stale','an old delayed retry cannot report success on a replacement session');
assert.equal(suggestionDraft.read().recovery?.status,'refresh-failed');
assert.equal((await suggestionOwner.retry('slot')).status,'unchanged','replacement recovery can acquire its own retry token');
assert.equal(suggestionDraft.read().recovery,null);

let releaseStaleResult,enterStaleResult,staleResultCount=0;
const staleResultEntered=new Promise(resolve=>{enterStaleResult=resolve});
const staleResultSuggestions=createWorkoutSuggestionCommands({draftSession:suggestionDraft,
  workout:{dispatch:async()=>{if(++staleResultCount===2){enterStaleResult();await new Promise(resolve=>{releaseStaleResult=resolve});}return{status:'domain-error',error:{code:'stale-suggestion'}};}},
  readDraft:()=>suggestionDraft.read().draft,readSnapshot:()=>original,planUpdates:()=>[{}]});
const oldFailure=staleResultSuggestions.refresh('slot');await staleResultEntered;
suggestionDraft.adopt(draft,raw);releaseStaleResult();
assert.equal((await oldFailure).status,'stale','late failure must not suspend the replacement draft');
assert.equal(suggestionDraft.read().recovery,null);

stored=suggestionDraft.read().raw;
suggestionDraft.suspendSuggestions('slot',suggestionDraft.read().draft.draftId);
const namedRetryToken=suggestionDraft.beginSuggestionRetry('slot');
const namedRetry=await suggestionDraft.dispatchSuggestionRetry(namedRetryToken,{
  sourceRevision:suggestionDraft.read().draft.revision,updates:[],type:'skipExercise',exerciseInstanceId:'slot'});
assert.equal(namedRetry.status,'applied');
assert.equal(suggestionDraft.read().draft.exercises.slot.status,'active','extra payload fields cannot change the command authorized by a retry capability');
assert.equal(namedRetry.noOp,true);
suggestionDraft.endSuggestionRetry(namedRetryToken,namedRetry.status);
