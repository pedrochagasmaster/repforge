import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
import {backupFile,parseBackupFile,isLegacyBackup} from '../src/interchange/backup.js';
import {exportBackup} from '../src/app/interchange.js';
import {programFile,parseProgramImport,boundedImportJson} from '../src/interchange/program-file.js';
import {csvFile} from '../src/interchange/csv.js';
import * as grammar from '../src/interchange/unsupported-grammar.js';
import {exportableState} from '../src/persistence/snapshot.js';
import {createSetupLinkCodec} from '../src/interchange/setup-link.js';
import {createTransferContract} from '../src/interchange/transfer-contract.js';
import {createInstallTransfer} from '../src/platform/install-transfer.js';
const require=createRequire(import.meta.url);
const metrics=require('../exercise-metrics.js'),identity=require('../generation-identity.js'),compiler=require('../program-compiler.js'),entry=require('../program-entry.js'),workout=require('../workout-draft.js');
const catalog=require('../assets/exercise-catalog.json');identity.prepareCatalog(catalog);
globalThis.RepForgeExerciseCatalog={snapshot:()=>catalog};
const oldSetup=require('../shared-setup.js'),oldContract=require('../install-transfer-contract.js'),oldTransfer=require('../install-transfer.js');
const capabilities={TextEncoder,TextDecoder,CompressionStream,DecompressionStream,Blob,atob,btoa,crypto:webcrypto,now:()=> '2026-10-18T11:00:00.000Z'};
const setupGlobalBefore=globalThis.RepForgeSharedSetup;
const setup=createSetupLinkCodec({metrics,identity,capabilities});
const contract=createTransferContract({compiler,entry,metrics,workout,catalog,crypto:webcrypto,TextEncoder,TextDecoder});
const transfer=createInstallTransfer(capabilities);
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/architecture-baseline-v1.json',import.meta.url)));
const payload={kind:'taurifer-shared-setup',version:2,program:{name:'Exact baseline',definition:baseline.expected.generation.value},settings:{jumpPct:2.5,minJump:2.5,rirHigh:2,hardRir:4,restSec:120,unit:'kg',lang:'en',rirMode:'numeric'},language:'en'};
const opts={builtInIds:new Set(catalog.exercises.map(e=>e.id)),catalogSnapshot:catalog,validateProgramDefinition:compiler.validateProgramDefinition,generateProgram:compiler.generateProgram,generatorVersion:compiler.GENERATOR_VERSION};
for(const value of [payload,{...payload,profile:{sex:'female'}},{...payload,version:1},null])assert.deepEqual(setup.validate(value,opts),oldSetup.validate(value,opts));
const encoded=await oldSetup.encode(payload,opts);assert.equal(encoded.ok,true);
assert.deepEqual(await setup.encode(payload,opts),encoded,'exact gzip/v4 transport bytes');
assert.deepEqual(await setup.decode(encoded.value,opts),await oldSetup.decode(encoded.value,opts));
for(const value of ['v1.abc','v2.abc','v3.abc','v4.!','v4.'])assert.deepEqual(await setup.decode(value,opts),await oldSetup.decode(value,opts));
for(const url of ['https://taurifer.com/index.html#setup=abc&other=yes','https://taurifer.com/#other=yes']){assert.equal(setup.removeSetupFragment(url),oldSetup.removeSetupFragment(url));assert.equal(setup.fragmentFromLocation(url),oldSetup.fragmentFromLocation(url));}
const fixture=require('./fixtures/install-transfer-clone-v1.json');
for(const value of [fixture,{...fixture,schemaVersion:2},{...fixture,unknown:true},null])assert.deepEqual(contract.validateEnvelope(value),oldContract.validateEnvelope(value));
for(const raw of ['{}','{bad','{"__proto__":{"a":1}}'])assert.deepEqual(contract.parseBoundedJson(raw),oldContract.parseBoundedJson(raw));
for(const value of [fixture,{b:2,a:[1,{x:'✓'}]}])assert.equal(contract.canonicalJson(value),oldContract.canonicalJson(value));
const cloneProducer=value=>({logicalCloneSection:()=>structuredClone(value)});
const currentDraft=baseline.expected.draft,rawDraft=JSON.stringify(currentDraft);
const sections={durableState:cloneProducer({...fixture.durableState,profile:{sex:'female',futureAnswer:'retain-me'}}),
  workoutDraft:{flush:async()=>{},current:()=>currentDraft,checkpoint:()=>({status:'valid',value:{kind:'committed',raw:rawDraft}}),read:()=>({status:'ok',raw:rawDraft}),logicalCloneSection:workout.logicalCloneSection},
  programEntryDraft:null,uiPreferences:cloneProducer({...fixture.uiPreferences,theme:'dark',importSourceMode:'freeform',repforge_freeform_session_v1:'private'}),
  analytics:cloneProducer(fixture.analytics),telemetryIdentity:cloneProducer(fixture.telemetryIdentity)};
const captured=await transfer.captureLogicalSnapshot(sections);
assert.equal(captured.ok,true);assert.deepEqual(captured,await oldTransfer.captureLogicalSnapshot(sections));
assert.equal(captured.value.durableState.profile.futureAnswer,'retain-me');
assert.equal(captured.value.uiPreferences.theme,'dark');
assert.equal(Object.hasOwn(captured.value.uiPreferences,'repforge_freeform_session_v1'),false);
assert.equal(captured.value.workoutDraft.draftId,currentDraft.draftId);
const source={context:'browser',logicalInstallationId:'baseline-install',sourceRevision:42};
const built=await transfer.buildEnvelope({sections,source,contract,crypto:webcrypto,createdAt:capabilities.now()});
assert.equal(built.ok,true,JSON.stringify(built));
assert.deepEqual(built,await oldTransfer.buildEnvelope({sections,source,contract:oldContract,crypto:webcrypto,createdAt:capabilities.now()}));
for(const action of ['create','claim','other'])for(const context of ['browser','standalone'])assert.deepEqual(transfer.contextEligibility({action,context,hasMeaningfulData:true}),oldTransfer.contextEligibility({action,context,hasMeaningfulData:true}));
assert.equal(globalThis.RepForgeSharedSetup,setupGlobalBefore,'native construction does not publish a module global');
console.log('PASS native interchange parity: setup bytes/refusal, strict envelope/parser, clone sections, explicit source/timestamps and context eligibility');

// Distinct public serializers. Inclusion checks name meaningful data, not size.
const durable={...structuredClone(fixture.durableState),profile:{sex:'female',futureAnswer:'retain-me'},_storageRevision:99,_storageFollowUp:{pending:true}};
const backup=backupFile(exportableState(durable),'2026-10-18');
const backupValue=JSON.parse(backup.text);
assert.deepEqual(backupValue.profile,durable.profile);
assert.deepEqual(backupValue.log,durable.log);
assert.deepEqual(backupValue.programMeta,durable.programMeta);
assert.equal(Object.hasOwn(backupValue,'_storageRevision'),false);
assert.equal(Object.hasOwn(backupValue,'_storageFollowUp'),false);
assert.equal(backup.name,'taurifer_backup_2026-10-18.json');
assert.equal(isLegacyBackup({program:[]},{}),false);
assert.equal(isLegacyBackup({program:[{name:'Legacy'}]},{}),true);
assert.equal(boundedImportJson('null'),null);
assert.equal(boundedImportJson('{}',{maxBytes:1}),null);
assert.equal(boundedImportJson('[1,2]',{maxNodes:2}),null);
assert.deepEqual(boundedImportJson('{"keepUnknown":{"future":true}}'),{keepUnknown:{future:true}});
assert.equal(parseBackupFile('{bad',value=>!!value),null);
const definition=structuredClone(baseline.expected.generation.value);
definition.days.find(day=>day.slots.length).slots[0].alternates=['custom:alternate'];
const program=programFile({definition,name:'  Exact Program! ',customExercises:[{id:'custom:unused',private:'never'},{id:'custom:alternate',name:'Alternate'}],date:'2026-10-18'});
const programValue=JSON.parse(program.text);
assert.equal(program.name,'taurifer_program_exact-program_2026-10-18.json');
assert.deepEqual(Object.keys(programValue),['kind','version','name','definition','customExercises']);
assert.deepEqual(programValue.customExercises,[{id:'custom:alternate',name:'Alternate'}]);
assert.equal(programFile({definition:null}),null);
assert.deepEqual(parseProgramImport([{day:'A'}]),{exercises:[{day:'A'}],meta:null,customExercises:[]});
assert.deepEqual(parseProgramImport({program:[{day:'A'}],programMeta:{name:'Old'},customExercises:[]}),{exercises:[{day:'A'}],meta:{name:'Old'},customExercises:[]});
for(const key of ['history','settings','profile','programMeta'])assert.equal(Object.hasOwn(programValue,key),false);
const oldGrammar=require('../unsupported-workout-grammar.js');
for(const value of [null,[],['cardio','deload','unknown','cardio'],['tempo','warmups']])assert.deepEqual(grammar.normalize(value),oldGrammar.normalize(value));
// The empty export establishes the exact CSV header without replacing metric parsing.
const csv=csvFile({state:{settings:{hardRir:4},log:[]},date:'2026-10-18'});
assert.equal(csv.text,'session,date,day,name,performed_name,exercise_id,set,load,reps,load_per_side,reps_per_side,rir,e1rm,tonnage,primary,secondary,is_hard_set,is_warmup,bodyweight,notes,exercise_note,created');
assert.equal(csv.name,'taurifer_log_2026-10-18.csv');
for(const receipt of [{localOk:false,idbOk:false},{localOk:false,idbOk:true},{localOk:true,idbOk:false}]){
  const events=[];let acknowledged=structuredClone(durable);
  const outcome=await exportBackup({read:()=>acknowledged,commit:async proposal=>{events.push('commit');assert.equal(proposal.settings.lastExport,'2026-10-18T11:00:00.000Z');if(receipt.localOk||receipt.idbOk)acknowledged=proposal;return receipt;},now:capabilities.now,date:()=> '2026-10-18',shareOrDownload:(text,name,type)=>{events.push('share');assert.equal(JSON.parse(text).settings.lastExport,'2026-10-18T11:00:00.000Z');assert.equal(type,'application/json');assert.equal(name,'taurifer_backup_2026-10-18.json');},onExported:()=>events.push('render')});
  assert.equal(outcome,receipt);
  assert.deepEqual(events,receipt.localOk||receipt.idbOk?['commit','share','render']:['commit']);
}
console.log('PASS separate backup/program/CSV policies, referenced-alternate closure, parser bounds, legacy shape recognition and acknowledgement-before-export');
// CSV owns serialization of an already-interpreted row; these explicit reader
// results are inputs, not a substitute source-metric parser. Production reader
// parity/reload remains the History/metric browser owner's acceptance boundary.
const csvRow={session:'session-1',date:'2026-10-18',day:'A',name:'Press, "strict"',performedName:'Press',exerciseId:'slot-1',set:1,rir:2,notes:'line 1\nline 2',created:'2026-10-18T11:00:00.000Z'};
const interpreted={load:42.5,reps:8,totalLoad:42.5,totalReps:8,loadPerSide:null,repsPerSide:null,strengthComparable:true,e1rm:53.8333333333,tonnage:340};
const quotedCsv=csvFile({state:{settings:{hardRir:4},log:[csvRow]},date:'2026-10-18',readLogRow:()=>interpreted,exerciseLabel:row=>row.name,rowMuscles:()=>({primary:'Chest',secondary:'Triceps'}),e1rm:()=>{throw Error('flat fallback must not replace comparable production reader');}});
assert.equal(quotedCsv.text.split('\n').slice(1).join('\n'),'"session-1","2026-10-18","A","Press, ""strict""","Press","slot-1","1","42.5","8","","","2","53.83","340","Chest","Triceps","1","0","","line 1\nline 2","","2026-10-18T11:00:00.000Z"');
