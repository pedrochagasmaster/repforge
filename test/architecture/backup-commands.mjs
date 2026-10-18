import assert from 'node:assert/strict';
import {createBackupCommands} from '../../src/app/interchange.js';
const original={program:[],programMeta:{id:'local',blockId:'b1'},settings:{lastExport:'old'},log:[{session:'kept',date:'2026-10-17'}],profile:{unknown:'retain'},programHistory:[{id:'archive',receipt:{literal:17}}],customExercises:[]};
let state=structuredClone(original),draftRaw='captured-draft',calls=[],files=[],receipt={localOk:true,idbOk:true};
const commands=createBackupCommands({read:()=>state,policy:{isValidStateShape:value=>!!value&&typeof value==='object'&&Array.isArray(value.program)&&Array.isArray(value.log),normalizeLoaded:value=>structuredClone(value),migrateLogSnapshot:()=>{}},
 model:{normalizeCustomExercises:()=>[],canonicalProgramDefinition:value=>value,compilerCustomDefinitions:()=>[]},
 drafts:{readRaw:()=>draftRaw,clearEffect:raw=>({kind:'clear-draft',required:true,expectedRaw:raw,precondition:'abort-if-changed'})},
 commit:async(proposal,options,io)=>{calls.push({proposal,options,io});if(receipt.localOk||receipt.idbOk)state=proposal;return{...receipt}},
 files:{shareOrDownload:(...args)=>files.push(args),download:()=>{},readText:file=>file.text()},now:()=> '2026-10-18T15:00:00.000Z',date:()=> '2026-10-18',onExported:()=>{}});
const incoming={...structuredClone(original),programMeta:{id:'incoming',blockId:'source'},log:[{session:'new',date:'2026-10-18'},{session:'new',date:'2026-10-18',set:2}],_storageRevision:900,_storageFollowUp:{once:true}};
await assert.rejects(commands.replace({program:{},log:[]}),/Invalid Taurifer backup/);assert.equal(calls.length,0);
await commands.replace(incoming);
assert.equal(calls[0].options.expectedProgramId,'local');assert.equal(calls[0].options.expectedBlockId,'b1');assert.equal(calls[0].options.replace,true);assert.equal(calls[0].options.effect.expectedRaw,'captured-draft');
assert.equal('_storageRevision' in calls[0].proposal,false);assert.equal('_storageFollowUp' in calls[0].proposal,false);assert.deepEqual(calls[0].proposal.profile,{unknown:'retain'});assert.deepEqual(calls[0].proposal.programHistory,[{id:'archive',receipt:{literal:17}}]);
state=structuredClone(original);calls=[];
const merged=await commands.merge(incoming);assert.equal(merged.added,1);assert.equal(state.log.length,3);assert.deepEqual(state.programMeta,original.programMeta);assert.deepEqual(state.profile,original.profile);
const count=calls.length;assert.equal((await commands.merge(incoming)).added,0);assert.equal(calls.length,count);
receipt={localOk:false,idbOk:true};await commands.exportJson();assert.equal(files.length,1);assert.equal(JSON.parse(files[0][0]).settings.lastExport,'2026-10-18T15:00:00.000Z');assert.equal(files[0][1],'taurifer_backup_2026-10-18.json');assert.equal('workoutDraft' in JSON.parse(files[0][0]),false);
receipt={localOk:false,idbOk:false};await commands.exportJson();assert.equal(files.length,1);
assert.deepEqual(commands.describe(incoming),{inSessions:1,inSets:2,curSessions:2,curSets:3,newSessions:0});
console.log('Native backup commands: captured replacement identity/draft, malformed refusal, exact archive/profile preservation, whole-session merge and either-replica export pass');
