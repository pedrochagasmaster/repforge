import assert from 'node:assert/strict';
import {launchChromium} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const page=await browser.newPage();await page.goto(new URL('src/ui/library/controller.js',base).href);
 const result=await page.evaluate(async()=>{
  const {createLibraryController}=await import('/src/ui/library/controller.js');
  const {createProgramModel}=await import('/src/training/model.js');
  const model=createProgramModel({catalog:{exercises:[],uuidIndex:{}},now:'2026-10-18T00:00:00.000Z'});
  document.body.innerHTML='<section id="exPickSheet"><input id="exPickSearch"><div id="exPickList"></div></section>';
  const effects={opens:0,closes:0,picks:0,focus:0,notices:0},entry={id:'literal-movement',name:'Literal movement',primary:'Chest',secondary:'',equipment:['barbell']};
  const make=(ownerShell)=>createLibraryController({window,queries:{snapshot:()=>({program:[],log:[]}),day:()=> 'Day 1',libraryEntries:()=>[entry],libraryEntry:()=>entry,pickableExercises:()=>[entry],customExercises:()=>[],programEditorProgram:()=>({forDay:()=>[]})},commands:{custom:{inUse:()=>false},program:{}},model,rules:{muscleTokens:[],equipment:[],customIdPrefix:'custom:',normalizeMuscleAttribution:()=>({ok:true,tokens:[]})},copy:{t:key=>key,tOne:key=>key},format:{libraryName:row=>row?.name||'',muscleLabel:String,dayLabel:String,countText:String},shell:ownerShell||{activeModal:()=>null,openModal:()=>effects.opens++,closeModal:async()=>{effects.closes++;return true},canTakeFocus:()=>false,reducedMotion:()=>true,currentViewId:()=> 'log',resolveReturnFocus:()=>null,routeHeading:()=>null},editor:{setupOpen:()=>false,focusEntryEditorStatus:()=>effects.focus++},onChanged:()=>{},onNotice:()=>effects.notices++,onCustomCreated:()=>{}});
  const ui=make();let release;const pending=new Promise(resolve=>release=resolve);
  ui.openExercisePicker({onPick:async()=>{effects.picks++;await pending}});
  const pick=ui.choosePicked(entry.id),live={...effects};ui.dispose();release();await pick;
  ui.openExercisePicker();ui.openCustomExerciseSheet();await ui.closeExercisePicker();await ui.choosePicked(entry.id);
  const after={...effects},selection=ui.pickerSelection();
  const editor=make(),choice=editor.chooseForEditor({mode:'replace',exclude:[]});editor.dispose();
  const cancelled=await Promise.race([choice,new Promise(resolve=>setTimeout(()=>resolve('unsettled'),100))]);
  const refused=await Promise.race([ui.chooseForEditor({mode:'replace',exclude:[]}),new Promise(resolve=>setTimeout(()=>resolve('unsettled'),100))]);
  document.body.innerHTML='<main id="outside">Outside</main><section id="exPickSheet" hidden><input id="exPickSearch"><div id="exPickList"></div></section>';
  const {createShell}=await import('/src/ui/shell.js'),shell=createShell({window});shell.mount();
  const mounted=make({...shell,activeModal:()=>shell.activeModal,currentViewId:()=> 'log',reducedMotion:()=>true});
  mounted.openExercisePicker();const modalLive=!!shell.activeModal&&document.querySelector('#outside').inert;
  mounted.dispose();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const modalClosed=shell.activeModal===null&&!document.querySelector('#outside').inert; shell.dispose();
  return{live,after,selection,cancelled,refused,modalLive,modalClosed};
 });
 assert.equal(result.live.opens,1);assert.equal(result.live.picks,1,'real picker selection began before disposal');
 assert.deepEqual(result.after,result.live,'disposed picker cannot reopen or run late modal/focus effects');
 assert.equal(result.selection,null,'terminal disposal cannot recreate picker state');
 assert.equal(result.cancelled,null,'pending editor choice resolves cancelled at disposal');
 assert.equal(result.refused,null,'disposed owner refuses new editor choices');
 assert.equal(result.modalLive,true,'actual Shell took modal inert ownership');assert.equal(result.modalClosed,true,'Library disposal releases its real Shell modal and body inertness');
 console.log('PASS native Library terminal owner: reopen refusal, pending selection and editor choice cancellation');
}finally{await browser.close()}
