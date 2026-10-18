import assert from 'node:assert/strict';
import * as policy from '../src/persistence/snapshot.js';

const base={program:[{id:'slot-a',sets:3}],log:[{session:'session-a',load:40}],settings:{unit:'kg'},_storageRevision:4};
const proposal=structuredClone(base); proposal.program[0].sets=4;
const target=structuredClone(base); target.log.push({session:'session-b',load:50}); target.settings.unit='lb';
const before=JSON.stringify([base,proposal,target]);
const rebased=policy.rebaseStateChange(base,proposal,target);
assert.equal(rebased.program[0].sets,4);
assert.deepEqual(rebased.log,target.log);
assert.equal(rebased.settings.unit,'lb');
assert.equal(JSON.stringify([base,proposal,target]),before,'rebase cannot mutate any actor');
const conflicting=structuredClone(target);conflicting.program[0].sets=6;
assert.equal(policy.rebaseStateChange(base,proposal,conflicting,{preferProposal:false}).program[0].sets,6);
assert.equal(policy.rebaseStateChange(base,proposal,conflicting).program[0].sets,4);
const receipt={version:1,programId:'program-a',raw:'raw-setup'};
const a={...base,_storageSetupActivation:receipt,_storageFollowUp:{pending:true}};
assert.equal(policy.snapshotsEqual(base,a),false,'equal-revision arbitration must see activation receipts');
assert.equal(policy.canonicalPayload(base),policy.canonicalPayload(a),'export omits receipt and sidecars');
assert.equal(policy.storageSnapshotsEqual(base,{...base,_storageRevision:5}),false);
const fingerprint=policy.draftProgramFingerprint(base);
assert.equal(policy.draftProgramFingerprint({...base,program:[{...base.program[0],prescriptionsByCycle:[{cycle:1}]}]}),fingerprint);
assert.notEqual(policy.draftProgramFingerprint({...base,programMeta:{blockId:'next-block'}}),fingerprint);
assert.equal(policy.classifyRecoveryCarrier({schemaVersion:99,records:[],quarantine:[]}).kind,'unknown');
assert.equal(policy.classifyRecoveryCarrier({schemaVersion:1,records:[],quarantine:[]}).kind,'known');
assert.equal(policy.classifyRecoveryCarrier(undefined).kind,'absent');
assert.equal(policy.draftEffectOutcome({kind:'clear-draft',expectedRaw:null,precondition:'abort-same-day'}).status,'invalid');
assert.equal(policy.draftEffectOutcome({kind:'clear-draft',expectedRaw:null,precondition:'abort-same-day',conflictDay:'Day 1'}).status,'valid');
assert.equal(policy.isCoherentV1TransitionOut({schemaVersion:1,transitionId:'t',proposalHash:'h',successorProgramId:'p'}),true);
console.log('persistence snapshot identity, receipts, rebase and refusal contract passed');

// Production validators share the actual muscle/metric/draft domains. An absent
// catalog is explicit and cannot turn a source-metric row into a valid record.
const {default:entry}=await import('../program-entry.js');
const {default:metrics}=await import('../exercise-metrics.js');
const {default:workout}=await import('../workout-draft.js');
const bound=policy.createSnapshotPolicy({entry,metrics,workout,model:{}});
assert.equal(bound.isValidStateShape({program:[],log:[]}),true);
assert.equal(bound.isValidStateShape({program:[{primary:'invented muscle'}],log:[]}),false);
assert.equal(bound.isValidStateShape({program:[],log:[{session:'s',setIndex:-1}]}),false);
assert.equal(bound.isValidStateShape({program:[],log:[],_storageSetupActivation:{version:1,programId:'p',raw:'setup'}}),true);
assert.equal(bound.isValidStateShape({program:[],log:[],_storageSetupActivation:{version:1,programId:'p',raw:''}}),false);
assert.equal(bound.isValidStateShape({program:[],log:[],recoveryTransitions:{schemaVersion:9,records:[],quarantine:[]}}),false);
assert.equal(bound.carrierReadStatus({program:[],log:[],recoveryTransitions:{schemaVersion:9,records:[],quarantine:[]}},'raw'),null);
const invalid=Object.create({program:[],log:[]});
assert.equal(bound.isValidStateShape(invalid),false,'unknown prototypes cannot enter storage');
console.log('production snapshot shape and unknown-carrier refusal contract passed');

const {createProgramModel}=await import('../src/training/model.js');
const {createEntryRules}=await import('../src/training/authoring.js');
const {createWorkoutRules}=await import('../src/training/workout.js');
const {compiler,createTransitionRules}=await import('../src/training/generation.js');
const {progression}=await import('../src/training/progress.js');
const {readFileSync}=await import('node:fs');
const {createRequire}=await import('node:module');
const require=createRequire(import.meta.url);
const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url),'utf8'));
const {seedProgram,seedProgramMeta}=await import('./fixtures/seed-program.mjs');
const instant='2026-10-18T12:00:00.000Z';let sequence=0;
const model=createProgramModel({catalog,librarySource:require('../exercises.js'),now:instant,nextId:()=>`new-${++sequence}`});
const actual=policy.createSnapshotPolicy({catalog,model,entry:createEntryRules(catalog),metrics,
  workout:createWorkoutRules(catalog),compiler,transition:createTransitionRules(),progression,now:()=>instant,nextId:()=>`new-${++sequence}`,
  language:{normalizeLang:value=>['en','pt'].includes(value)?value:null,detectLang:()=> 'en'}});
const saved={program:seedProgram(),programMeta:seedProgramMeta(),log:[],_storageRevision:11,
  settings:{unit:'kg',futureSetting:{retained:true},notify:{futureNotification:true}},
  profile:{futureProfileSchema:99,rawValue:'keep'},customExercises:[],programHistory:[]};
const sourceBefore=JSON.stringify(saved);
assert.equal(actual.isValidStateShape(saved),true,'compiler-produced saved fixture remains valid');
const normalized=actual.normalizeLoaded(saved);
assert.equal(normalized._storageRevision,11);
assert.deepEqual(normalized.profile,saved.profile,'unknown profile is preserved losslessly');
assert.deepEqual(normalized.settings.futureSetting,{retained:true});
assert.equal(normalized.settings.notify.futureNotification,true);
assert.deepEqual(normalized.program.map(row=>row.id),saved.program.map(row=>row.id));
assert.equal(JSON.stringify(saved),sourceBefore,'normalization cannot mutate source replicas');
assert.deepEqual(actual.normalizeLoaded(normalized),normalized,'canonical state reaches a fixed point');
const historical={id:'history-a',program:[{id:'historic-slot',libraryId:'custom:one',name:'Archived name',primary:'Chest',secondary:'',sets:3}],
  meta:{id:'history-a'}};
const historySource={...saved,customExercises:[{id:'custom:one',name:'Current name',primary:'Lats',secondary:'',created:instant}],programHistory:[historical]};
const history=actual.normalizeLoaded(historySource).programHistory[0];
assert.equal(history.program[0].name,'Archived name');assert.equal(history.program[0].primary,'Chest');
assert.equal(history.id,'history-a');
console.log('source-produced state normalization, fixed-point and historical identity contract passed');
const {metricLogRow}=await import('./fixtures/history-metric-rows.mjs');
const row=metricLogRow(saved.programMeta,saved.program[0],{session:'saved-session',date:'2026-10-17',set:1,load:50,reps:8});
assert.equal(actual.isValidStateShape({...saved,log:[row]}),true,'real source-metric log validates against raw exercise catalog');
const changed=structuredClone(row);changed.metricValues[0].metricId='foreign-metric';
assert.equal(actual.isValidStateShape({...saved,log:[changed]}),false,'foreign metric identities refuse without repair');
const withLog=actual.normalizeLoaded({...saved,log:[row]});
assert.deepEqual(withLog.log,[row],'normalization preserves saved metric bytes and session identity');
const migrationSource={program:[{...saved.program[0],name:'Day-specific row',day:'Day 1'},{...saved.program[1],name:'Day-specific row',day:'Day 2'}],customExercises:[],log:[
  {name:'Day-specific row',day:'Day 2',load:'50,5',reps:'8',rir:''},
  {exerciseId:saved.program[0].id,name:'Unrelated swapped movement',day:'Day 1',load:20,reps:8,rir:2},
]};
assert.equal(actual.migrateLogSnapshot(migrationSource),true);
assert.equal(migrationSource.log[0].exerciseId,saved.program[1].id,'exact authored day disambiguates repeated names');
assert.equal(migrationSource.log[0].day,'Day 2');
assert.equal(migrationSource.log[0].load,50.5);
assert.equal(migrationSource.log[0].rirMeasured,false);
assert.equal(migrationSource.log[1].performedLibraryId,undefined,'linked slot alone cannot attribute a different performed name');
assert.equal(migrationSource.log[1].performedMovementId,undefined,'linked slot alone cannot invent movement identity');
const metricSource={program:saved.program,customExercises:[],log:[structuredClone(row)]};
actual.migrateLogSnapshot(metricSource);
assert.equal(metricSource.log[0].session,row.session);
assert.deepEqual(metricSource.log[0].metricValues,row.metricValues,'metric logs never enter legacy numeric repair');

// A supported but malformed semantic record must retain bounded evidence, not
// accidentally invoke a local variable shadowing the injected digest function.
const {createHash}=await import('node:crypto');
const overlayKeys=['schemaVersion','policyVersion','transitionId','blockId','activePeriod','eligibilityEvidence','baseProgramFingerprint','entries','createdAt','confirmedAt','reassessmentDueAt','reassessmentOutcome'];
const recordKeys=['schemaVersion','transitionId','kind','createdAt','status','predecessor','diagnosis','derivation','diff','progressionContract','archiveId','confirmedAt','proposalHash'];
const overlay={...Object.fromEntries(overlayKeys.map(key=>[key,null])),schemaVersion:1,policyVersion:2};
const malformedRecord={...Object.fromEntries(recordKeys.map(key=>[key,null])),schemaVersion:1,
  diff:{days:null,exercises:null,prescriptions:null,recoveryWeek:overlay}};
assert.equal(policy.classifyRecoveryCarrier({schemaVersion:1,records:[malformedRecord],quarantine:[]}).kind,'known');
const recoveryPolicy=policy.createSnapshotPolicy({entry,metrics,workout,model:{},now:()=>instant,
  digest:async raw=>createHash('sha256').update(raw).digest('hex')});
const rawMalformed=JSON.stringify(malformedRecord);
const recoveryInput={program:[],log:[],recoveryTransitions:{schemaVersion:1,records:[malformedRecord],quarantine:[]}};
const recovered=await recoveryPolicy.normalizeRecoveryCarrierSnapshot(recoveryInput,'localStorage');
assert.equal(recovered.kind,'known');
assert.deepEqual(recovered.snapshot.recoveryTransitions.records,[]);
assert.equal(recovered.snapshot.recoveryTransitions.quarantine[0].digest,createHash('sha256').update(rawMalformed).digest('hex'));
assert.equal(recovered.snapshot.recoveryTransitions.quarantine[0].raw,rawMalformed,'exact malformed bytes remain recoverable');
assert.equal(recoveryInput.recoveryTransitions.records.length,1,'quarantine cannot mutate the original replica');
