import assert from 'node:assert/strict';
import {launchChromium} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const page=await browser.newPage();await page.goto(new URL('src/ui/program/controller.js',base).href);
 const result=await page.evaluate(async()=>{
  const {createProgramController}=await import('/src/ui/program/controller.js');
  document.body.innerHTML='<nav></nav><section id="program"><div id="programNoProgram"><button id="programSetupProgram">Set up</button></div><button id="addDay">Add day</button></section>';
  const effects={setup:0,commands:0,render:0,notices:0,day:0,reads:0,prefs:0};let release;
  const pending=new Promise(resolve=>release=resolve);
  const ui=createProgramController({window,queries:{hasProgramContent:()=>{effects.reads++;return false},snapshot:()=>({programMeta:{}})},commands:{form:{addDay:()=>{effects.commands++;return pending}}},library:{},editor:{setupOpen:()=>false},preferences:{read:()=>({}),set:()=>effects.prefs++},copy:{t:key=>key},format:{},onChanged:()=>effects.render++,onNotice:()=>effects.notices++,onDayChanged:()=>effects.day++,onSetupRequested:()=>effects.setup++,actions:{}});
  ui.renderProgram();ui.bind();const setup=document.querySelector('#programSetupProgram'),oldSetup=setup.onclick;
  setup.click();ui.renderProgram();
  const add=document.querySelector('#addDay'),oldAdd=add.onclick;
  const completion=oldAdd();const live={...effects};ui.dispose();
  release({localOk:true,day:'Day 2'});await completion;
  setup.click();oldSetup();await oldAdd();ui.renderProgram();ui.bind();ui.setDayCollapsed('Day 1',true);
  return{live,after:{...effects},cleared:setup.onclick===null&&add.onclick===null};
 });
 assert.equal(result.live.setup,1);assert.equal(result.live.commands,1,'real mounted command began before disposal');
 assert.deepEqual(result.after,result.live,'retired callbacks, pending acknowledgements and public render/bind stay inert after terminal disposal');
 assert.equal(result.cleared,true,'current no-program and Add day handlers detach');
 console.log('PASS native Program terminal owner: retained controls, pending command settlement, render and bind');
}finally{await browser.close()}
