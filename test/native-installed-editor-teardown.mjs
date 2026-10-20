import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
const browser=await launchChromium();
try{
 const page=await browser.newPage();await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');await waitForAppBoot(page);
 const result=await page.evaluate(async()=>{
  const [{createInstalledEditorView},{createShell}]=await Promise.all([import('./src/ui/program/installed-editor.js'),import('./src/ui/shell.js')]);
  window.closeFirstRun?.();window.closeTour?.();
  const shell=createShell({window,motion:null,isBooted:()=>true});shell.mount();
  const dialog=document.querySelector('#programEditorLeave');
  const controller=createInstalledEditorView({window,session:{reset:()=>{}},mountEditor:()=>({dispose:()=>{},discard:()=>{},isDirty:()=>true,commit:async()=>({}),checkSuggestLoads:()=>({ok:true})}),
   shell,t:key=>key,onChanged:()=>{},onAccepted:()=>{},onEdit:()=>{},entry:{isOpen:()=>false,cancel:()=>{}}});
  const before={...history.state,teardownLiteral:'prior-entry'};history.replaceState(before,'',location.href);
  controller.setEditing(true);controller.mount();controller.arm();controller.openLeave();
  const opened={active:shell.activeModal?.el===dialog,open:dialog.open,sentinel:history.state?.tauriferProgramEditor?.active};
  const popped=new Promise(resolve=>window.addEventListener('popstate',()=>resolve(history.state),{once:true}));
  controller.dispose();const restored=await popped;
  // Real shell transition cleanup owns dialog, inert and focus lifetime.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return{opened,restored,active:!!shell.activeModal,dialogOpen:dialog.open,editing:controller.editing,hasEditor:controller.hasEditor};
 });
 assert.deepEqual(result.opened,{active:true,open:true,sentinel:true},'actual shell and history really owned the open leave surface');
 assert.equal(result.restored.teardownLiteral,'prior-entry');assert.equal(result.restored.tauriferProgramEditor,undefined,'teardown releases the one owned sentinel');
 assert.equal(result.active,false);assert.equal(result.dialogOpen,false);assert.equal(result.editing,false);assert.equal(result.hasEditor,false);
 console.log('PASS installed editor teardown closes actual shell modal and releases owned Back sentinel');
}finally{await browser.close()}
