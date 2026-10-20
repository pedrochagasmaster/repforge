import assert from 'node:assert/strict';
import {launchChromium} from './browser.mjs';
const browser=await launchChromium();
try{const page=await browser.newPage();await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');
 const result=await page.evaluate(async()=>{
  const {createInstalledEditorView}=await import('./src/ui/program/installed-editor.js');
  document.body.innerHTML='<section id="programEditor"><p data-role="editor-status">Original</p></section><dialog id="programEditorLeave"><button id="programEditorApply"></button><button id="programEditorDiscard"></button><button id="programEditorKeep"></button></dialog>';
  let acknowledge;const pending=new Promise(resolve=>acknowledge=resolve);let mounts=0,resets=0,accepted=0,changes=0;
  const original={dispose:()=>{},discard:()=>{},isDirty:()=>true,commit:()=>pending,checkSuggestLoads:()=>({ok:true})};
  const replacement={...original,commit:async()=>({committed:true,settled:true})};
  const controller=createInstalledEditorView({window,session:{reset:()=>resets++},mountEditor:()=>++mounts===1?original:replacement,
   shell:{openModal:()=>{},closeModal:()=>{}},t:key=>key,onChanged:()=>changes++,onAccepted:()=>accepted++,onEdit:()=>{},entry:{isOpen:()=>false,cancel:()=>{}}});
  controller.setEditing(true);controller.mount();const operation=controller.apply();controller.disposeEditor();controller.mount();
  document.querySelector('[data-role="editor-status"]').textContent='Replacement owner';
  acknowledge({committed:true,settled:true});await operation;
  const afterLate={editing:controller.editing,hasEditor:controller.hasEditor,accepted,changes,status:document.querySelector('[data-role="editor-status"]').textContent};
  await controller.done();const afterCurrent={editing:controller.editing,hasEditor:controller.hasEditor,accepted,changes};controller.dispose();
  return{afterLate,afterCurrent};
 });
 assert.deepEqual(result.afterLate,{editing:true,hasEditor:true,accepted:0,changes:0,status:'Replacement owner'},'late qualified Apply cannot close or announce through a newly mounted editor');
 assert.deepEqual(result.afterCurrent,{editing:false,hasEditor:false,accepted:1,changes:1},'the current qualified Apply still closes exactly once');
 console.log('PASS installed editor lifetime: stale qualified Apply cannot finish replacement owner');
}finally{await browser.close()}
