import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInstalledEditor} from '../src/app/installed-editor.js';
import {createProgramModel} from '../src/training/model.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/seed-program-v067.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../assets/exercise-catalog.json',import.meta.url)));
const clone=value=>structuredClone(value);
let snapshot={...clone(fixture),log:[],customExercises:[],_storageRevision:1};
let acknowledge;const pending=new Promise(resolve=>acknowledge=resolve);let settled=0;
const model=createProgramModel({catalog,librarySource:{library:[]},nextId:()=> 'new-editor-id',now:()=> '2026-10-18T10:00:00.000Z',language:()=> 'en',defaultExerciseName:()=> 'Exercise'});
const editor=createInstalledEditor({read:()=>snapshot,refreshHead:async()=>({head:snapshot}),model,catalog,nextId:()=> 'new-editor-id',defaultMeta:()=>({}),now:()=> '2026-10-18T10:00:00.000Z',readRecovery:()=>null,muscles:{validate:()=>true,invalid:()=>({invalid:true})},readActiveDraft:()=>null,
 drafts:{readRaw:()=>null,hasProgress:()=>false,parse:()=>({kind:'absent'}),clear:()=>null,rename:()=>null,removedSetsHaveProgress:()=>false},
 commit:async(proposal,options)=>{const check=await options.preflight({head:snapshot,proposal});if(check?.reject)return check.result;await pending;snapshot=check?.proposal||proposal;return{committed:true,settled:true,localOk:true,idbOk:true}},onSettled:()=>settled++});
async function stage(name){const baseline=editor.read(),next=clone(baseline.document);next.programMeta.name=name;const result=await editor.commit({expectedToken:baseline.token,nextDocument:next,intent:{kind:'program_name',before:baseline.document.programMeta.name,after:name}});assert.equal(result.staged,true);return{...baseline,document:next}}
const first=await stage('First owner');
assert.equal(snapshot.programMeta.name,'Seed program','speculative staging does not publish durable program metadata');
assert.equal(editor.readSession().edits.length,1);
const work=editor.commit({expectedToken:first.token,nextDocument:first.document,intent:{kind:'apply'}});
await new Promise(resolve=>setImmediate(resolve));
editor.reset();await stage('Replacement edit');
acknowledge();await work;
assert.equal(snapshot.programMeta.name,'First owner','the already-issued qualified command may finish');
assert.equal(editor.readSession()?.document.programMeta.name,'Replacement edit','settlement of a prior editor cannot discard the new private edit session');
assert.equal(settled,1);
console.log('PASS native installed session: immutable staging and prior settlement preserve replacement private intents');
