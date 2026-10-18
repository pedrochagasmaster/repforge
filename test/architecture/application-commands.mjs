// Fault seams justify isolation: queued failures, lock refresh, exact-draft finish
// and a visible-but-unsettled replica cannot be reliably induced by pure engine tests.
import assert from 'node:assert/strict';
import {createEntryImportSession} from '../../src/app/entry.js';
import {createSession} from '../../src/app/session.js';
import {createWorkoutCommands} from '../../src/app/workout.js';
import {createHistoryCommands, sessionFingerprint} from '../../src/app/history.js';
import {createProgramCommands} from '../../src/app/program.js';

const owner=createSession({initialSnapshot:{log:[],program:[]}});
assert.throws(()=>owner.read().log.push({}), TypeError);
const input={log:[{session:'a'}]};owner.publish(input);input.log.length=0;
assert.equal(owner.read().log.length,1);
const order=[];
await Promise.all([owner.run(async()=>{order.push(1);throw Error('expected')}).catch(()=>{}),owner.run(()=>order.push(2))]);
assert.deepEqual(order,[1,2]);

const draft={draftId:'d1',revision:7,program:{programId:'p',blockId:'b',scheduleDate:'2026-10-18',dayLabel:'A'},session:{startedAt:'2026-10-18T10:00:00Z'},exerciseOrder:['e'],exercises:{e:{status:'active',setOrder:['s'],sets:{s:{completion:'complete'}}}}};
let active=draft,raw='exact raw',cleared=0,receipt={committed:true,settled:false};
let captured;
const rules={validateForSave:()=>[],reduce:(value,command)=>({...value,status:'finishing',revision:value.revision+1}),isDomainError:value=>!!value.error,toHistoryRows:()=>[{session:'d1',set:1}]};
const workout=createWorkoutCommands({session:owner,training:rules,drafts:{flush:async()=>{},read:()=>({draft:active,raw,recovery:null}),start:async()=>({status:'ready'}),dispatch:async()=>({status:'applied'}),projection:()=>active,clearIdentity:()=>{cleared++},clearEffect:value=>({raw:value}),canLeave:()=>true},commit:async(proposal,opts)=>{captured={proposal,opts};return receipt},operationId:()=> 'op',now:()=> '2026-10-18T11:00:00Z',writer:id=>({id})});
assert.equal((await workout.finish({expectedDraft:{draftId:'d1',revision:6}})).result.reason,'stale-confirmation');
assert.equal((await workout.finish()).completed,undefined);assert.equal(cleared,0);
assert.equal(captured.opts.effect.raw,'exact raw');assert.deepEqual(captured.opts.reconcileSessionIds,['d1']);
receipt={committed:true,settled:true};assert.equal((await workout.finish()).completed.session,'d1');assert.equal(cleared,1);
active={...draft,exercises:{e:{...draft.exercises.e,sets:{s:{completion:'pending'}}}}};
assert.equal((await workout.finish()).result.issues[0].code,'incomplete-workout');
assert.equal((await workout.finish({completion:'early'})).result.reason,'invalid-finish-kind');

let head={log:[{session:'a',set:1,load:20},{session:'other',set:1,load:30}],program:[]};
const read=()=>head;
let settlementCount=0;
const commit=async(proposal,opts)=>{const checked=await opts.preflight({head});if(checked?.reject)return checked.result;head=checked.proposal;return{committed:true,settled:true}};
const history=createHistoryCommands({read,commit,readRevision:()=>0,settleAlreadyCommitted:async({verify})=>{settlementCount++;return{committed:true,settled:verify(head).ok,head}}});
const original=sessionFingerprint([head.log[0]]);
head.log[0].load=21;
assert.equal((await history.correct({sessionId:'a',rows:[{session:'a',set:1,load:22}],originalFingerprint:original})).code,'history_stale');
const current=sessionFingerprint([head.log[0]]);
assert.equal((await history.correct({sessionId:'a',rows:[{session:'wrong',set:1}],originalFingerprint:current})).code,'history_session_identity');
assert.equal((await history.correct({sessionId:'a',rows:[{session:'a',set:1,load:22}],originalFingerprint:current})).settled,true);
assert.equal(head.log.find(row=>row.session==='other').load,30);
assert.equal((await history.correct({sessionId:'a',rows:[{session:'a',set:1,load:22}],originalFingerprint:current})).settled,true);assert.equal(settlementCount,1);
assert.equal((await history.remove({sessionId:'a',originalFingerprint:current})).code,'history_stale');

let locked={id:'p',block:'b',version:2,log:[{session:'concurrent'}]};
let rebaseCount=0;
const program=createProgramCommands({read:()=>locked,refreshHead:async()=>({head:{...locked,version:1}}),commit:async(proposal,opts)=>{const checked=await opts.preflight({head:locked});return checked?.reject?checked.result:{committed:true,settled:true,proposal:checked.proposal}},authoring:{token:s=>({programId:s.id,blockId:s.block,version:s.version}),tokenEqual:(a,b)=>a.version===b.version,rebaseDocument:({edits},head)=>{rebaseCount++;return{document:{...head,edits}}},confirmOptIn:document=>({ok:true,document}),impact:()=>({active:false,incompatible:false}),snapshotFromDocument:(document,head)=>({...head,document})},drafts:{readRaw:()=>null,clearEffect:()=>null,dayReplacementEffect:()=>null}});
const applied=await program.applyEdits({expectedToken:{programId:'p',blockId:'b',version:1},nextDocument:{title:'edited'},edits:[{kind:'program_name'}]});
assert.equal(applied.ok,true);assert.equal(rebaseCount,1);assert.equal(applied.proposal.log[0].session,'concurrent');
locked.block='new';
assert.equal((await program.applyEdits({expectedToken:{programId:'p',blockId:'b',version:1},nextDocument:{},edits:[]})).staleBlock,true);

// Custom identity cannot be deleted after another tab introduces a reference.
const {createCustomExerciseCommands,createProgramReplacementCommands}=await import('../../src/app/program.js');
let customHead={program:[],programMeta:{},programHistory:[],log:[],customExercises:[{id:'custom:x',name:'X',created:'old',primary:'chest',secondary:''}]};
let customBeforeLock=()=>{};
const customs=createCustomExerciseCommands({read:()=>customHead,commit:async(proposal,opts)=>{customBeforeLock();const checked=await opts.preflight({head:customHead});if(checked.reject)return checked.result;customHead=checked.proposal;return{committed:true,settled:true}},model:{normalizeCustomExercises:rows=>rows,isCustomLibraryId:id=>id.startsWith('custom:'),definitionMovementIds:()=>[]},normalizeMuscleAttribution:value=>({ok:true,value}),now:()=> 'now',newId:()=> 'custom:new',invalidMuscleCommit:()=>({invalid:true})});
const source=structuredClone(customHead.customExercises[0]);
customBeforeLock=()=>{customHead.log=[{performedLibraryId:'custom:x'}]};
assert.equal((await customs.remove('custom:x',{action:'delete',expectedEntry:source})).code,'custom-exercise-became-used');
customBeforeLock=()=>{};
assert.equal((await customs.remove('custom:x')).archived,true);assert.equal(customHead.customExercises[0].archived,true);

let replacementOptions;
const replacement=createProgramReplacementCommands({read:()=>({programMeta:{id:'old'}}),commit:async(proposal,opts)=>{replacementOptions=opts;return{committed:true,settled:true,proposal}},capture:()=>({oldProgramId:'old',oldBlockId:'block-old',oldProgram:[],oldMeta:{id:'old'},storageRevision:3,programFingerprint:'captured'}),allocateBlockId:()=> 'block-new',now:()=> 'now'});
const replacementResult=await replacement.commit({program:[],programMeta:{id:'new'},programHistory:[]});
assert.equal(replacementResult.proposal.programMeta.blockId,'block-new');assert.equal(replacementResult.proposal.programHistory[0].id,'old');assert.equal(replacementOptions.expectedProgramFingerprint,'captured');

// flush must include commands accepted into the app queue but not yet enrolled
// in the lower draft queue (e.g. a rapid edit immediately after Finish returns).
let release,dispatched=false;
const gate=new Promise(resolve=>{release=resolve});
const queueOwner=createSession({initialSnapshot:{log:[]}});
const queuedWorkout=createWorkoutCommands({session:queueOwner,training:rules,drafts:{flush:async()=>{},dispatch:async()=>{dispatched=true}},commit:()=>{},now:()=>'',operationId:()=>'',writer:()=>({})});
queueOwner.run(()=>gate);
const pending=queuedWorkout.dispatch('editSetField',{});
const flushed=queuedWorkout.flush();release();await flushed;
assert.equal(dispatched,true,'flush includes accepted app commands');await pending;


// A rename started with no draft must reject a draft introduced while waiting
// for the durable lock; it has no captured replacement receipt to settle.
let lateDraft=false;
const lateProgram=createProgramCommands({read:()=>({}),refreshHead:async()=>({head:{}}),
  commit:async(proposal,opts)=>{lateDraft=true;const checked=opts.preflight({head:{}});return checked.reject?checked.result:{committed:true,settled:true}},
  authoring:{token:()=>({programId:'p',blockId:'b'}),tokenEqual:()=>true,
    rebaseDocument:()=>{throw Error('unchanged token must not rebase')},confirmOptIn:document=>({ok:true,document}),
    impact:()=>lateDraft?{active:true,incompatible:false,effect:{status:'valid',effect:{precondition:'abort-same-day'}}}:{active:false,incompatible:false},
    snapshotFromDocument:(document,head)=>({...head,document})},
  drafts:{readRaw:()=>null,clearEffect:()=>null,dayReplacementEffect:()=>null}});
assert.equal((await lateProgram.applyEdits({expectedToken:{programId:'p',blockId:'b'},nextDocument:{},edits:[]})).draftConflict,true);

// Whole raw aggregate is frozen in the finish request. A newer checkpoint
// observed by the durable owner rejects it and leaves the session identity live.
let liveRaw='captured',identityCleared=false;
const racedWorkout=createWorkoutCommands({session:createSession({initialSnapshot:{log:[]}}),training:rules,
  drafts:{flush:async()=>{},read:()=>({draft,raw:liveRaw}),clearEffect:raw=>({raw}),clearIdentity:()=>{identityCleared=true}},
  beforeCommit:async()=>{liveRaw='newer-aggregate'},
  commit:async(proposal,opts)=>opts.effect.raw===liveRaw?{committed:true,settled:true}:{committed:false,settled:false,draftConflict:true},
  now:()=> '2026-10-18T11:00:00Z',operationId:()=> 'finish-race',writer:id=>({id})});
assert.equal((await racedWorkout.finish()).result.draftConflict,true);assert.equal(identityCleared,false);

const drainingOwner=createSession({initialSnapshot:{}}),drainOrder=[];
let unlock;
const blocked=new Promise(resolve=>{unlock=resolve});
drainingOwner.run(()=>blocked);
const drained=drainingOwner.idle().then(()=>drainOrder.push('idle'));
drainingOwner.run(()=>drainOrder.push('late-command'));
unlock();await drained;
assert.deepEqual(drainOrder,['late-command','idle'],'idle drains commands accepted while it waits');

let forwardedIo='sentinel';
const fallbackWorkout=createWorkoutCommands({session:createSession({initialSnapshot:{log:[]}}),training:rules,
  drafts:{flush:async()=>{},read:()=>({draft,raw:'raw'}),clearEffect:raw=>({raw}),clearIdentity:()=>{}},
  commit:async(proposal,options,io)=>{forwardedIo=io;return{committed:true,settled:true}},
  now:()=> '2026-10-18T11:00:00Z',operationId:()=> 'finish-default-io',writer:id=>({id})});
await fallbackWorkout.finish({io:null});assert.equal(forwardedIo,undefined,'null adapter uses the root default like the original Finish');
// A retry can queue behind another tab's lock. Cancelling the editor during
// that wait must still be checked by the real lock-held command preflight.
let releaseHistoryLock,historyLockReached,historyReplicaWrites=0;
const historyLock=new Promise(resolve=>{releaseHistoryLock=resolve});
const reachedHistoryLock=new Promise(resolve=>{historyLockReached=resolve});
const cancellationHead={log:[{session:'cancel-queued',set:1,load:20}]};
const cancelledHistory=createHistoryCommands({read:()=>cancellationHead,readRevision:()=>0,
  readDurable:async()=>({ok:true,head:cancellationHead,pendingJournal:false}),settlePending:async()=>({committed:true,settled:true}),
  settleAlreadyCommitted:async()=>({committed:true,settled:true}),
  commit:async(_proposal,options)=>{
    historyLockReached();await historyLock;
    const checked=await options.preflight({head:cancellationHead});
    if(checked?.reject)return checked.result;
    historyReplicaWrites++;return{committed:true,settled:true};
  }});
const cancelQueuedRetry=new AbortController();
const queuedRetry=cancelledHistory.retryCorrection({sessionId:'cancel-queued',rows:[{session:'cancel-queued',set:1,load:22}],
  originalFingerprint:sessionFingerprint(cancellationHead.log),signal:cancelQueuedRetry.signal});
await reachedHistoryLock;cancelQueuedRetry.abort();releaseHistoryLock();
const cancelledRetryResult=await queuedRetry;
assert.equal(cancelledRetryResult.code,'history_cancelled','cancellation is rechecked after waiting for the durable lock');
assert.equal(historyReplicaWrites,0,'cancelled lock-queued retry produces no proposal or replica writes');
console.log('Application command contracts passed');

// Entry's private gap facts cannot be changed around the named validation command.
const entrySession=createEntryImportSession({tabStorage:()=>({getItem:()=>null,setItem:()=>{},removeItem:()=>{}})});
const gapFacts={status:'gaps',envelope:{meta:{name:'private draft'}},exercises:[{day:'A',name:'Curl',order:1}],
  gaps:[{key:'0::sets',rowIndex:0,day:'A',order:1,name:'Curl',field:'sets'}],notImported:[]};
entrySession.setGaps(gapFacts);gapFacts.gaps.length=0;gapFacts.envelope.meta.name='external write';
assert.equal(entrySession.read().gapResult.gaps.length,1,'Entry owns an ingress copy of gap facts');
assert.equal(entrySession.read().gapResult.envelope.meta.name,'private draft');
assert.throws(()=>{entrySession.read().gapResult.gaps.length=0},TypeError,'readonly gap facts cannot bypass validation');
assert.throws(()=>{entrySession.read().gapResult.envelope.meta.name='escape'},TypeError,'nested source facts are readonly too');
const malformedReplacement=createProgramReplacementCommands({read:()=>({programMeta:{id:'old',blockId:17}}),commit:async()=>{throw new Error('invalid identity must not commit')},capture:()=>null,allocateBlockId:()=> 'new',now:()=> 'now'});
assert.equal((await malformedReplacement.commit({program:[],programMeta:{id:'new'}})).code,'invalid-program-block-identity');
