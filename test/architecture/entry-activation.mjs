import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createGenerationRules} from '../../src/training/generation.js';
import {createEntryRules,createEntryAdapter,createInstalledEditorRules} from '../../src/training/authoring.js';
import {createWorkoutRules} from '../../src/training/workout.js';
import {createProgramModel} from '../../src/training/model.js';
import metrics from '../../src/training/metrics.js';
import {progression} from '../../src/training/progress.js';
import {createSnapshotPolicy} from '../../src/persistence/snapshot.js';
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
