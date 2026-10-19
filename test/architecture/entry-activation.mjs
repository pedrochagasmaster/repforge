import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createGenerationRules} from '../../src/training/generation.js';
import {createEntryRules,createEntryAdapter,createInstalledEditorRules} from '../../src/training/authoring.js';
import {createWorkoutRules} from '../../src/training/workout.js';
import {createProgramModel} from '../../src/training/model.js';
import metrics from '../../src/training/metrics.js';
import {progression} from '../../src/training/progress.js';
import {createSnapshotPolicy,draftEffectOutcome} from '../../src/persistence/snapshot.js';
import {createEntryActivation,createEntryGeneration,buildLandingProof} from '../../src/app/entry.js';
import {createCustomDefinitionImport} from '../../src/app/custom-import.js';
const require=createRequire(import.meta.url),source=require('../../exercises.js');
const catalog=JSON.parse(readFileSync(new URL('../../assets/exercise-catalog.json',import.meta.url),'utf8'));
const generation=createGenerationRules();generation.identity.prepareCatalog(catalog);
let ids=0;
const model=createProgramModel({catalog,librarySource:{library:source.EXERCISE_LIBRARY,legacyIds:source.LEGACY_LIBRARY_IDS},nextId:()=>`fixture-${++ids}`,now:'2026-10-18T12:00:00.000Z',calendarDate:'2026-10-18'});
const entry=createEntryRules(catalog),workout=createWorkoutRules(catalog);
const policy=createSnapshotPolicy({entry,workout,model,catalog,metrics,compiler:generation.compiler,transition:generation.transition,progression,
 nextId:()=>`policy-${++ids}`,now:()=> '2026-10-18T12:00:00.000Z',language:{normalizeLang:value=>value==='pt'?'pt':'en',detectLang:()=> 'en'}});
const adapter=createEntryAdapter({compiler:generation.compiler});
const mapped=adapter.programRequestFromAnswers({desiredResult:'muscle_growth',structuredExperience:'6_to_24m',recentConsistency:'most',daysPerWeek:3,sessionMinutes:60,environment:{kind:'commercial_gym'}},catalog);
assert.equal(mapped.ok,true);
const generated=generation.compiler.generateProgram(mapped.value,catalog);assert.equal(generated.ok,true);
const activation=createEntryActivation({model,entry,imports:createCustomDefinitionImport({model,nextId:()=> 'unused-custom-id'}),build:createInstalledEditorRules({model,catalog,nextId:()=> 'unused-editor-id',defaultProgramMeta:policy.defaultProgramMeta,allowCreateDefinition:true}),policy,identity:{programId:()=> 'installed-program',blockId:()=> 'installed-block',now:()=> '2026-10-18T12:00:00.000Z',date:()=> '2026-10-18'},defaultName:()=> 'Untitled program'});
const base={log:[],program:[],settings:{unit:'lb',futureSetting:'preserve'},programMeta:{id:'predecessor',compilerContext:{predecessor:true},progressionIncompatibilities:[{reason:'predecessor-only'}]},customExercises:[],futureSnapshot:{keep:7}};
const result=activation.successor({base,name:'New program',programDefinition:generated.value,route:'recommend',origin:'first-run',destination:'program-edit',expectedSetupDraftRaw:'exact setup bytes'});
assert.equal(result.ok,true);
assert.equal(result.proposal.programMeta.id,'installed-program');assert.equal(result.proposal.programMeta.blockId,'installed-block');
assert.equal(result.proposal.programMeta.daysPerWeek,3);
assert.equal(result.proposal.programMeta.name,'New program');
assert.deepEqual(result.proposal.programMeta.progressionIncompatibilities,[],'an absent metadata source must not inherit its predecessor');
assert.equal(result.proposal.programMeta.compilerContext,undefined);
assert.equal(result.proposal.settings.unit,'lb');assert.equal(result.proposal.settings.futureSetting,'preserve');
assert.deepEqual(result.proposal.futureSnapshot,{keep:7});
assert.deepEqual(result.proposal._storageSetupActivation,{version:1,programId:'installed-program',raw:'exact setup bytes'});
assert.deepEqual(result.proposal._storageFollowUp,{kind:'onboarding-edit',origin:'first-run'});
assert.equal(base.programMeta.id,'predecessor');assert.equal(base.program.length,0);
const actualSlots=result.proposal.program.map(row=>row.slotId),sourceSlots=generated.value.days.flatMap(day=>day.slots).map(slot=>slot.id);
assert.deepEqual(actualSlots,sourceSlots,'every generated slot is installed once in its canonical order');
assert.deepEqual(activation.successor({base,programDefinition:generated.value,route:'custom',origin:'block',destination:'log',expectedProgramId:'different-predecessor'}),{ok:false,code:'duplicate'});
assert.deepEqual(activation.successor({base,programDefinition:null,route:'custom',origin:'first-run',destination:'log'}),{ok:false,code:'program-definition-required'});

// Real custom normalizer -> collision/reuse -> actual proposed row consumer.
const imports=createCustomDefinitionImport({model,nextId:()=> 'collision-id'});
const existing=model.normalizeCustomExercises([{id:'custom:same-id',name:'Old movement',equipment:['dumbbell'],primary:'Chest',secondary:''},{id:'custom:reuse',name:'Élévation',equipment:['dumbbell'],primary:'Side delts',secondary:''}]);
existing[0].futureField={keep:1};
const rows=[{libraryId:'custom:same-id'},{libraryId:'custom:other-id'}];
const imported=imports.merge({existing,exercises:rows,incoming:[{id:'custom:same-id',name:'Different movement',equipment:['dumbbell'],primary:'Chest',secondary:''},{id:'custom:other-id',name:'ELEVATION',equipment:['dumbbell'],primary:'Side delts',secondary:''}]});
assert.equal(imported.added,1);assert.equal(imported.remapped,1);
assert.deepEqual(rows.map(row=>row.libraryId),['custom:collision-id','custom:reuse']);
assert.equal(imported.customExercises.length,3);assert.deepEqual(imported.customExercises[0].futureField,{keep:1});
assert.equal(existing.length,2);assert.equal(existing[0].name,'Old movement');
console.log('Entry activation: actual generated slot identity, literal successor/receipt/follow-up, predecessor refusal, extension preservation and custom collision/reuse passed');

// Actual Entry generation -> reviewed-candidate assembly keeps Basics only in
// the local profile, preserves skipped answers, and guards the live unit when
// a workout draft exists.
const services=adapter.createProductionServices({Compiler:generation.compiler,catalog});
let draft=entry.selectRoute(entry.createState({draftId:'profile-activation',activeProgramRevisionAtStart:0,now:'2026-10-18T12:00:00.000Z',versions:services.currentVersions()}),'recommend');
draft=entry.setAnswers(draft,{desiredResult:'muscle_growth',structuredExperience:'6_to_24m',recentConsistency:'most',daysPerWeek:3,sessionMinutes:60,preferredRestSeconds:null,environment:{kind:'commercial_gym'},basics:{sex:'male',heightCm:180,weightUnit:'lb'}});
const producer=createEntryGeneration({compiler:generation.compiler,adapter,catalog,model,execute:async(request)=>({generated:generation.compiler.generateProgram(request,catalog),cache:true}),candidateName:()=> 'Generated program',onFailure:error=>{throw error}});
const generatedCandidate=await producer.generate(draft);assert.equal(generatedCandidate.ok,true);
draft={...entry.setResult(draft,generatedCandidate.result),step:'result'};
const profileHead={...base,settings:{unit:'kg',futureSetting:'preserve'},profile:{birthDate:'1990-04-12',heightCm:165}};
const candidate=activation.candidate({draft,head:profileHead,name:'Reviewed program',hasWorkoutDraft:false});
assert.equal(candidate.ok,true);
assert.deepEqual(candidate.value.baseProposal.profile,{birthDate:'1990-04-12',heightCm:180,sex:'male'});
assert.equal(candidate.value.baseProposal.settings.unit,'lb');
assert.equal(profileHead.profile.heightCm,165);assert.equal(profileHead.settings.unit,'kg');
assert.equal(candidate.value.baseProposal.programmingContext.recentConsistency,'most');
assert.equal('basics' in candidate.value.baseProposal.programmingContext,false);
assert.equal('profile' in candidate.value.baseProposal.programmingContext,false);
assert.equal('weightUnit' in candidate.value.baseProposal.profile,false);
const protectedUnit=activation.candidate({draft,head:profileHead,name:'Reviewed program',hasWorkoutDraft:true});
assert.equal(protectedUnit.value.baseProposal.settings.unit,'kg');
assert.equal(candidate.value.programDefinition.days.filter(day=>day.kind==='training').length,3);
console.log('Entry reviewed candidate: real generation, local profile replacement/skips, context exclusion and workout unit guard passed');

// A canonical incoming program must keep its authored movement when this
// device already owns the same custom id for a different movement. Re-flatten
// through the actual candidate consumer; the generic merge test cannot prove it.
const clash=model.normalizeCustomExercises([{id:'custom:same-id',name:'Different movement',equipment:['dumbbell'],primary:'Chest',secondary:''},{id:'custom:other-id',name:'ELEVATION',equipment:['dumbbell'],primary:'Side delts',secondary:''}]);
const clashRows=[{id:'clash-slot',day:'A',order:1,name:'Different movement',libraryId:'custom:same-id',sets:2,min:6,max:10,primary:'Chest',secondary:''}];
const clashDefinition=model.manualProgramDefinitionFromRows(clashRows,['A'],clash);
assert.ok(clashDefinition);
const originalSlotId=clashDefinition.days[0].slots[0].id;
const clashDraft={...draft,route:'custom',result:{preview:{program:clashRows,customExercises:clash,programDefinition:clashDefinition}}};
const clashCandidate=activation.candidate({draft:clashDraft,head:{...base,customExercises:existing},name:'Collision',hasWorkoutDraft:false});
assert.equal(clashCandidate.ok,true);
const installedSlot=clashCandidate.value.programDefinition.days[0].slots[0];
assert.equal(installedSlot.exerciseId,'custom:unused-custom-id');
assert.deepEqual(installedSlot.sourceExerciseIds,['custom:unused-custom-id']);
assert.equal(installedSlot.id,originalSlotId,'movement remapping must preserve workout slot identity');
assert.equal(clashCandidate.value.exercises[0].libraryId,'custom:unused-custom-id');
assert.equal(clashCandidate.value.exercises[0].name,'Different movement');
assert.equal(clashCandidate.value.baseProposal.customExercises.find(row=>row.id==='custom:unused-custom-id').name,'Different movement');
assert.equal(clashCandidate.value.baseProposal.customExercises.find(row=>row.id==='custom:same-id').name,'Old movement');
assert.equal(clashDefinition.days[0].slots[0].exerciseId,'custom:same-id','incoming program remains unmodified');
const withAlternate=structuredClone(clashDefinition);withAlternate.days[0].slots[0].alternates=['custom:other-id'];
assert.ok(model.canonicalProgramDefinition(withAlternate,clash),'real producer source is valid before collision remapping');
const alternateCandidate=activation.candidate({draft:{...clashDraft,result:{preview:{...clashDraft.result.preview,programDefinition:withAlternate}}},head:{...base,customExercises:existing},name:'Collision',hasWorkoutDraft:false});
assert.equal(alternateCandidate.ok,true);
assert.deepEqual(alternateCandidate.value.programDefinition.days[0].slots[0].alternates,['custom:reuse']);
console.log('Entry canonical custom collision: primary/source/alternate references agree with actual flattened rows and authored definitions; slot identity retained');

const landing=buildLandingProof({model,catalog,minJump:2.5});
assert.deepEqual(landing.recommendations,{add:{status:'recommended',load:62.5,reps:9},hold:{status:'recommended',load:100,reps:7},reduce:{status:'recommended',load:62.5,reps:10}});
assert.deepEqual(landing.chart,{from:92.5,to:100,sessions:4});
assert.throws(()=>{landing.cases.add.logged[0][0]=999},TypeError);
assert.equal(buildLandingProof({model,catalog,minJump:2.5}).recommendations.add.load,62.5);
console.log('Landing read model: literal three recommendations/four-session figures from actual production engine and protected authored examples passed');

// Pending confirmation is a transaction over one reviewed draft and published
// head. Use shipped Entry, setup CAS and Program replacement owners; the only
// substitute is the durable commit boundary (browser lock/replicas have their
// existing integration owners).
const {createEntryActivationCommands}=await import('../../src/app/entry/activation.js');
const {createProgramReplacementPolicy,createProgramReplacementCommands}=await import('../../src/app/program.js');
const {createSetupDraftStore,SETUP_DRAFT_KEY}=await import('../../src/persistence/setup-draft.js');
async function transactionFixture({installed=false,workoutRaw=null}={}){
 let head=structuredClone(installed?{...result.proposal,programMeta:{...result.proposal.programMeta,id:'old-program',blockId:'old-block'}}:profileHead),live=structuredClone(draft),raw=null,removeFails=false,commits=0,commitOutcome=null,beforeCommit=null;
 delete head._storageSetupActivation;
 const effects=[];
 const store=createSetupDraftStore({rules:entry,storage:{getItem:()=>raw,setItem:(_,value)=>{raw=value},removeItem:()=>{if(removeFails)throw Error('cleanup unavailable');raw=null}},lock:async operation=>operation(),ownerId:'activation-owner',onFailure:()=>{},onSaved:()=>{}});
 const saved=await store.write(live,live);assert.equal(saved.ok,true);
 const replacementPolicy=createProgramReplacementPolicy({model,policy});
 const replacement=createProgramReplacementCommands({read:()=>head,capture:replacementPolicy.capture,allocateBlockId:()=> 'unused-block',now:()=> '2026-10-18T12:00:00.000Z',commit:async(proposal,options)=>{
   if(beforeCommit)await beforeCommit();
   if(options.expectedSetupDraftRaw!==undefined&&options.expectedSetupDraftRaw!==raw)return{setupDraftConflict:true};
   effects.push(options.effect);
   if(commitOutcome&&!commitOutcome.committed)return commitOutcome;
   if(options.effect?.effect?.expectedRaw!==workoutRaw)return{draftConflict:true};
   commits++;head=structuredClone(proposal);head._storageRevision=1;
   if(head._storageSetupActivation)head._storageSetupActivation.revision=1;
   return commitOutcome||{committed:true,settled:true,localOk:true,idbOk:true,revision:1};
 }});
 const commands=createEntryActivationCommands({activation,entry,read:()=>head,readDraft:()=>live,store,replacement,replacementPolicy,policy,
   workout:{readRaw:()=>workoutRaw,hasProgress:()=>workoutRaw!==null,clearEffect:raw=>draftEffectOutcome({required:true,kind:'clear-draft',expectedRaw:raw,precondition:'abort-changed'}),blockStartGuard:()=>null},
   settleReceipt:async()=>({committed:true,settled:true,localOk:true,idbOk:true})});
 return{commands,store,effects,setCommitOutcome:value=>{commitOutcome=value},beforeCommit:callback=>{beforeCommit=callback},setWorkout:value=>{workoutRaw=value},get head(){return head},get raw(){return raw},get commits(){return commits},
   setDraft:value=>{live=value},setHead:value=>{head=value},setRaw:value=>{raw=value},failCleanup:value=>{removeFails=value},
   prepare:()=>commands.prepare({name:'Reviewed transaction',origin:'first-run',destination:'log',versions:services.currentVersions(),pinnedVersionsExecutable:false})};
}
const changedDraft=await transactionFixture(),pending=await changedDraft.prepare();
assert.equal(pending.kind,'prepared');
changedDraft.setDraft({...draft,draftId:'unrelated-candidate'});
const rejected=await changedDraft.commands.commit(pending,{confirmed:true,draftConfirmed:true});
assert.equal(rejected.kind,'stale');assert.equal(changedDraft.commits,0);
assert.notEqual(changedDraft.raw,null,'an unrelated setup record is never consumed');
const changedHead=await transactionFixture(),pendingHead=await changedHead.prepare();
changedHead.setHead({...changedHead.head,_storageRevision:1});
assert.equal((await changedHead.commands.commit(pendingHead,{confirmed:true,draftConfirmed:true})).kind,'stale');
assert.equal(changedHead.commits,0);
console.log('Entry activation transaction refuses draft/head changes while confirmation is pending');

const cancelled=await transactionFixture({installed:true}),cancelTicket=await cancelled.prepare();
assert.equal(cancelTicket.needsReplacementConfirmation,true);
assert.equal((await cancelled.commands.commit(cancelTicket,{confirmed:false})).kind,'cancelled');
assert.equal(cancelled.commits,0);assert.notEqual(cancelled.raw,null);
const newerSetup=await transactionFixture(),setupTicket=await newerSetup.prepare();
newerSetup.beforeCommit(()=>newerSetup.setRaw('newer owner bytes'));
assert.equal((await newerSetup.commands.commit(setupTicket,{confirmed:true})).setupDraftConflict,true);
assert.equal(newerSetup.raw,'newer owner bytes');assert.equal(newerSetup.commits,0);
const failed=await transactionFixture(),failedTicket=await failed.prepare(),failedRaw=failed.raw;
failed.setCommitOutcome({committed:false,settled:false,localOk:false,idbOk:false});
assert.equal((await failed.commands.commit(failedTicket,{confirmed:true})).kind,'failed');
assert.equal(failed.raw,failedRaw);assert.equal(failed.head.programMeta.id,'predecessor');
const unsettled=await transactionFixture(),unsettledTicket=await unsettled.prepare(),unsettledRaw=unsettled.raw;
unsettled.setCommitOutcome({committed:true,settled:false,localOk:true,idbOk:true});
assert.equal((await unsettled.commands.commit(unsettledTicket,{confirmed:true})).kind,'failed');
assert.equal(unsettled.raw,unsettledRaw,'an unsettled commit cannot consume setup');
assert.equal((await unsettled.commands.resume(unsettledTicket)).kind,'committed');
assert.equal(unsettled.commits,1,'receipt settlement does not create another successor');
const retry=await transactionFixture({installed:true}),retryTicket=await retry.prepare();
retry.failCleanup(true);
assert.equal((await retry.commands.commit(retryTicket,{confirmed:true})).kind,'cleanup-pending');
assert.equal(retry.commits,1);assert.equal(retry.head.programMeta.id,'installed-program');
assert.equal(retry.head.programHistory.length,1);assert.equal(retry.head.programHistory[0].id,'old-program');
const receipt=await retry.prepare();assert.equal(receipt.kind,'receipt');
retry.failCleanup(false);
const resumed=await retry.commands.resume(receipt);
assert.equal(resumed.kind,'committed');assert.equal(resumed.alreadyCommitted,true);
assert.equal(retry.raw,null);assert.equal(retry.commits,1);assert.equal(retry.head.programHistory.length,1);
const newer=await transactionFixture(),oldTicket=await newer.prepare();
newer.failCleanup(true);await newer.commands.commit(oldTicket,{confirmed:true});newer.failCleanup(false);
newer.setRaw('newer setup');newer.setDraft({...draft,draftId:'newer draft'});
const preserve=await newer.commands.resume(oldTicket);
assert.equal(preserve.kind,'cleanup-pending');assert.equal(preserve.clearEntryDraft,false);
assert.equal(newer.raw,'newer setup');assert.equal(newer.commits,1);
const workoutChanged=await transactionFixture({workoutRaw:'captured workout'}),workoutTicket=await workoutChanged.prepare();
assert.equal(workoutTicket.needsDraftConfirmation,true);
workoutChanged.setWorkout('newer workout');
const workoutConflict=await workoutChanged.commands.commit(workoutTicket,{confirmed:true,draftConfirmed:true});
assert.equal(workoutConflict.draftConflict,true);assert.equal(workoutChanged.commits,0);
assert.equal(workoutChanged.effects[0].effect.expectedRaw,'captured workout');
assert.equal(workoutChanged.effects[0].effect.precondition,'abort-changed');
console.log('Entry transaction: cancellation, lock-held setup CAS, failed/unsettled commits, receipt retry/archive-once, newer setup and exact workout capture passed');
const mismatched=await transactionFixture(),unrelatedSetup=mismatched.raw;
mismatched.setDraft({...draft,draftId:'different-before-prepare'});
const mismatchedPreparation=await mismatched.prepare();
assert.equal(mismatchedPreparation.setupDraftConflict,true,'an adopted setup handle must belong to the reviewed Entry draft');
assert.equal(mismatched.commits,0);assert.equal(mismatched.raw,unrelatedSetup);
const republished=await transactionFixture(),republishedTicket=await republished.prepare();
republished.setHead({...republished.head,profile:{heightCm:190}});
assert.equal((await republished.commands.commit(republishedTicket,{confirmed:true})).kind,'stale','even same-revision publication is a different acknowledged head');
assert.equal(republished.commits,0);
const repeated=await retry.commands.commit(receipt,{confirmed:true});
assert.equal(repeated.kind,'committed','retry after exact cleanup is already complete remains successful');
assert.equal(retry.commits,1);assert.equal(retry.raw,null);assert.equal(retry.head.programHistory.length,1);
assert.equal(preserve.entryDraftChanged,true,'presentation must not reset a newer Entry flow after old receipt cleanup');

// The mounted Build editor must use the Entry session, never mutate installed
// state, and preserve a later command when an earlier queued write fails.
const {createEntryEditor,createEntrySetup}=await import('../../src/app/entry.js');
assert.equal(typeof createEntryEditor,'function','Entry owns the Build command');
let editorRaw=null,failEditor=false,releaseEditor;
const editorStorage={getItem:()=>editorRaw,setItem:(_key,value)=>{if(failEditor)throw Error('quota');editorRaw=value},removeItem:()=>{editorRaw=null}};
const editorStore=createSetupDraftStore({rules:entry,storage:editorStorage,lock:operation=>operation(),ownerId:'editor-owner',onFailure:()=>{},onSaved:()=>{}});
const setup=createEntrySetup({rules:entry,store:editorStore,nextId:()=> 'build-editor',now:()=> '2026-10-18T12:00:00.000Z',context:()=>({versions:services.currentVersions(),activeProgramRevision:0}),mutationFrozen:()=>false,onUpdate:()=>{},onFailure:()=>{},onDiagnostic:()=>{}});
const buildPreview={source:'build',program:model.flatProgramFromDefinition(generated.value,[]),programDefinition:generated.value,customExercises:[]};
let buildDraft=entry.selectRoute(entry.createState({draftId:'editor-build',activeProgramRevisionAtStart:0,now:'2026-10-18T12:00:00.000Z',versions:services.currentVersions()}),'build');
buildDraft=entry.setAnswers(buildDraft,{programName:'Generated program',daysPerWeek:3});
buildDraft=entry.setResult(buildDraft,{schemaVersion:entry.SCHEMA_VERSION,route:'build',name:'Generated program',fingerprint:'fixture-build',selected:{id:'manual_build',source:'manual_build'},preview:buildPreview});
setup.publish({...buildDraft,step:'editor'});
const editor=createEntryEditor({setup,store:editorStore,entry,model,imports,policy,catalog,nextId:()=> 'editor-slot',read:()=>base,language:()=> 'en',services:()=>services,time:generation.compiler.RULES?.time});
assert.equal(editor.snapshot().programMeta.name,'Generated program');
assert.equal(editor.snapshot().programMeta.onboarded,false);
const invalid=editor.snapshot();delete invalid.programMeta.programDefinition;
assert.equal((await editor.commitForm(invalid)).code,'program_definition_required');
assert.equal(editorRaw,null);
const document=editor.read().document;document.programMeta.name='Build literal';
const edited=await editor.commit({nextDocument:document,intent:{kind:'program_name',before:'Generated program',after:'Build literal'}});
assert.equal(edited.ok,true);assert.equal(edited.setupDraft,true);
assert.equal(setup.read().result.name,'Build literal');
assert.equal(JSON.parse(editorRaw).state.result.name,'Build literal');
assert.equal(base.programMeta.id,'predecessor');assert.equal(base.program.length,0);
const savedRaw=editorRaw;
const editorPending=new Promise(resolve=>{releaseEditor=resolve});
const earlier=editor.snapshot();earlier.programMeta.name='Earlier failed edit';
const firstEdit=editor.commitForm(earlier,{io:{async writeSetupDraft(){await editorPending;throw Error('quota')}}});
const later=editor.snapshot();later.programMeta.name='Later saved edit';
const secondEdit=editor.commitForm(later);
releaseEditor();
assert.equal((await firstEdit).localOk,false);
assert.equal((await secondEdit).localOk,true);
assert.equal(setup.read().result.name,'Later saved edit');
assert.equal(JSON.parse(editorRaw).state.result.name,'Later saved edit');
assert.notEqual(editorRaw,savedRaw);
const foreignRaw=JSON.stringify({...JSON.parse(editorRaw),ownerId:'other-tab',revision:100});editorRaw=foreignRaw;
const conflicting=editor.snapshot();conflicting.programMeta.name='Refused edit';
assert.equal((await editor.commitForm(conflicting)).setupDraftConflict,true);
assert.equal(setup.read().result.name,'Later saved edit');assert.equal(editorRaw,foreignRaw);
console.log('Entry editor: literal Build staging, canonical refusal, installed isolation, queued failure and exact foreign-byte preservation passed');

// A completed failed command must not rewind a replacement Entry flow, even
// when the former flow already has an accepted baseline.
editorStore.adopt({raw:foreignRaw,envelope:JSON.parse(foreignRaw)},setup.read());
let releaseStale;
const staleGate=new Promise(resolve=>{releaseStale=resolve});
const staleProposal=editor.snapshot();staleProposal.programMeta.name='Stale command';
const staleCommand=editor.commitForm(staleProposal,{io:{async writeSetupDraft(){await staleGate;throw Error('quota')}}});
const replacementDraft={...buildDraft,draftId:'replacement-entry',step:'editor'};setup.publish(replacementDraft);
releaseStale();
assert.equal((await staleCommand).localOk,false);
assert.equal(setup.read().draftId,'replacement-entry');
assert.equal(setup.read().result.name,'Generated program');
assert.equal(editorRaw,foreignRaw);

// Custom closure includes alternates that have no flat row, and drops unused
// definitions. Shared proposals stay transient: there is no setup-store write.
const customDefinition=structuredClone(withAlternate);
const unused={id:'custom:unused',name:'Unused movement',equipment:['dumbbell'],primary:'Chest',secondary:''};
setup.publish({...buildDraft,route:'shared',step:'shared_review',result:{name:'Shared custom',preview:{program:clashRows,programDefinition:customDefinition,customExercises:[...clash,unused],sharedSettings:{restSec:60}}}});
const sharedProposal=editor.snapshot();
const sharedResult=await editor.commitForm(sharedProposal);
assert.equal(sharedResult.localOk,true);assert.equal(editorRaw,foreignRaw);
assert.deepEqual(setup.read().result.preview.customExercises.map(value=>value.id),['custom:same-id','custom:other-id']);
assert.equal(setup.read().result.preview.program[0].slotId,originalSlotId);
assert.deepEqual(setup.read().result.preview.programDefinition.days[0].slots[0].alternates,['custom:other-id']);
assert.equal(base.customExercises.length,0);
const untouched=structuredClone(setup.read());
const forged=await editor.commit({nextDocument:editor.read().document,intent:{kind:'metric_target',slotId:'missing-slot',cycleIndex:1,setIndex:0,metricId:'load',semantic:'load',metricIds:[],metricDefinitions:[],before:{},after:{}}});
assert.equal(forged.ok,false);assert.equal(forged.code,'invalid_canonical_editor_intent');
assert.deepEqual(setup.read(),untouched);assert.equal(editorRaw,foreignRaw);
console.log('Entry editor: replacement-flow protection, canonical alternate closure, shared transience and forged intent refusal passed');
// Fixed FNV-1a oracle for the sorted preimage:
// {"name":"Literal","preview":{"customExercises":[{"id":"custom:a","name":"Move"}]},"route":"build"}
const fingerprintPreview={customExercises:[{id:'custom:a',name:'Move',created:'2026-10-18'}]};
assert.equal(editor.fingerprint('build','Literal',fingerprintPreview),'pe-529e17bb');
assert.equal(fingerprintPreview.customExercises[0].created,'2026-10-18');
