import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
import {seedProgramMeta} from './fixtures/seed-program.mjs';
const browser=await launchChromium();
try{
  const page=await browser.newPage();await page.goto(process.env.REPFORGE_URL||'http://localhost:8000/');await waitForAppBoot(page);
  const result=await page.evaluate(async baseline=>{
    const [{createProgramReview},{review},{createGenerationRules},metrics]=await Promise.all([
      import('./src/ui/editors.js'),import('./src/training/authoring.js'),import('./src/training/generation.js'),import('./src/training/metrics.js')]);
    const ctx={compiler:createGenerationRules().compiler,catalog:await(await fetch('./assets/exercise-catalog.json')).json(),metrics:metrics.default};
    const setsEdit={kind:'sets',slotId:'seed-ex-1',count:3},restEdit={kind:'rest',slotId:'seed-ex-1',seconds:120};
    const first=review.applyEdit(baseline,setsEdit,ctx);if(!first.ok)throw Error(JSON.stringify(first));
    const second=review.applyEdit(first.definition,restEdit,{...ctx,ordinal:2});if(!second.ok)throw Error(JSON.stringify(second));
    let state={baseline,definition:second.definition,edits:[setsEdit,restEdit],name:'Literal review',ctx};
    const host=document.createElement('section'),sheet=document.createElement('section');document.body.append(host,sheet);
    sheet.innerHTML='<h2></h2><div></div><footer></footer>';const [title,body,foot]=sheet.children;
    let release,writes=0;const gate=new Promise(resolve=>{release=resolve});
    const announcements=[];
    const ui=createProgramReview({window,motion:null});
    const mounted=ui.mountProgramReview(host,{view:{tab:0,reorder:null},read:()=>state,
      commit:async next=>{if(++writes===1)await gate;state={...state,...next};return{ok:true}},
      esc:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),t:key=>key,
      dayName:day=>day.name,exerciseName:id=>id,muscleName:()=>'',exerciseWord:()=> 'exercises',exerciseCount:n=>String(n),tile:()=>'',
      sheet:()=>({el:sheet,title,body,foot}),openSheet:()=>{},closeSheet:async()=>{},pickExercise:async()=>null,confirm:async()=>false,
      announce:message=>announcements.push(message),reducedMotion:()=>true});
    host.querySelector('[data-review-slot="seed-ex-1"]').click();
    const invalidSets=body.querySelector('[data-review-sets="1"]');invalidSets.dataset.reviewSets='99';invalidSets.click();
    await new Promise(resolve=>window.requestAnimationFrame(resolve));
    const refused={sets:state.definition.days[0].slots[0].prescriptionsByCycle[0].sets.length,
      edits:state.edits.length,message:announcements.at(-1)};
    foot.querySelector('[data-review-done]').click();announcements.length=0;
    host.querySelector('[data-review-undo]').click();host.querySelector('[data-review-undo]').click();
    await Promise.resolve();await Promise.resolve();
    mounted.dispose();host.textContent='Replacement owner';host.setAttribute('aria-busy','replacement-busy');
    release();await gate;await new Promise(resolve=>window.requestAnimationFrame(resolve));
    const output={sets:state.definition.days[0].slots[0].prescriptionsByCycle[0].sets.length,
      edits:state.edits,busy:host.getAttribute('aria-busy'),text:host.textContent,announcements,classic:typeof window.RepForgeProgramReview,writes,refused};
    host.remove();sheet.remove();return output;
  },seedProgramMeta().programDefinition);
  assert.deepEqual(result.refused,{sets:3,edits:2,message:'entry.review.refused'},'a malformed DOM action is refused by real authoring validation without losing the reviewed definition');
  assert.equal(result.sets,3,'the already-issued Undo may settle, but queued Undo cannot erase the remaining set edit after disposal');
  assert.deepEqual(result.edits,[{kind:'sets',slotId:'seed-ex-1',count:3}]);
  assert.equal(result.busy,'replacement-busy','a disposed queue must not clear the replacement owner busy state');
  assert.equal(result.text,'Replacement owner');assert.deepEqual(result.announcements,[]);
  assert.equal(result.classic,'undefined');console.log('PASS native Review disposal blocks queued edits and late presentation side effects');
}finally{await browser.close()}
