import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage();
 await page.goto(new URL('src/ui/settings/guides.js',base).href);
 const result=await page.evaluate(async()=>{
  const [{createGuidesView},{default:registry},{createPreferences},{createProgressController},{createFocusDom}]=await Promise.all([
   import('/src/ui/settings/guides.js'),import('/src/ui/settings/guide-registry.js'),import('/src/persistence/preferences.js'),import('/src/ui/progress/controller.js'),import('/src/ui/focus/dom.js')]);
  document.body.innerHTML='<section id="stats" class="active"><div id="statsSeg"><button data-seg="overview" aria-controls="segOverview">Overview</button><button data-seg="review" aria-controls="segReview">Review</button></div></section><section id="workout"></section><button id="woOverflowBtn">More</button>';
  let writes=0;localStorage.clear();
  const preferences=createPreferences({local:{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{writes++;localStorage.setItem(key,value)},removeItem:key=>localStorage.removeItem(key)},tab:sessionStorage});
  const guide=createGuidesView({window,registry,preferences:{read:preferences.readUi,reload:preferences.reloadUi,replace:preferences.replaceUi},t:key=>key,landingOpen:()=>false,onGeometryChanged:()=>{},report:()=>{}});
  const progress=createProgressController({document,copy:{t:key=>key},format:{},motion:null,queries:{overview:()=>({hasLog:false,week:{},attention:[],strength:[]}),review:()=>({started:false})},review:{render:()=>{},dispose:()=>{}},onOpenExercise:()=>{},onGoToday:()=>{},onReviewViewed:()=>{},onSelected:segment=>guide.maybeShow([segment==='review'?'block-transition':'progress'])});
  progress.mount();progress.render();progress.render();await Promise.resolve();
  const afterProgressRender={writes,state:preferences.readUi()};
  progress.selectSegment('overview');const afterSelect={writes,state:preferences.readUi()};
  const staleDismiss=document.querySelector('[data-guide-dismiss]');
  guide.remove();guide.show('block-transition');const beforeRetained=writes;
  staleDismiss.click();
  const retainedGuide={writes:writes-beforeRetained,status:preferences.readUi().guideState['block-transition'].status};
  guide.remove();preferences.replaceUi({});writes=0;
  const focus=createFocusDom({window,focus:{beginFrame:()=>0,finishFrame:()=>{}},presentation:{capture:()=>({})},controls:{},geometry:{sizeDeck:()=>{}},effects:{enabled:()=>false,settleBeats:()=>{}},rest:{arrive:()=>{}},motion:{},readFrame:()=>({active:true,context:{list:[],query:{}},cycle:{},dayLabel:'Day',hiddenCount:0}),copy:{t:key=>key},guides:guide,exercise:{},onControlsReplaced:()=>{},onRendered:()=>{}});
  focus.render();focus.render();await Promise.resolve();
  const afterFocusRender={writes,state:preferences.readUi()};
  guide.maybeShow(['first-set','focus-utilities']);
  const afterFocusEntry={writes,state:preferences.readUi()};
  progress.dispose();focus.dispose();guide.remove();
  return{afterProgressRender,afterSelect,afterFocusRender,afterFocusEntry,retainedGuide};
 });
 assert.deepEqual(result.afterProgressRender,{writes:0,state:{}},'Progress repaint cannot publish guide transitions');
 assert.equal(result.afterSelect.writes,1);assert.equal(result.afterSelect.state.guideState.progress.status,'shown','explicit segment selection still publishes through actual Guide/preferences');
 assert.deepEqual(result.afterFocusRender,{writes:0,state:{}},'Focus active repaint cannot publish guide transitions');
 assert.deepEqual(result.retainedGuide,{writes:0,status:'shown'},'retired cue controls cannot dismiss a newer guide');
 assert.equal(result.afterFocusEntry.writes,1);assert.equal(result.afterFocusEntry.state.guideState['focus-utilities'].status,'shown');
 await context.close();
 const app=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),live=await app.newPage();
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/install-transfer-clone-v1.json',import.meta.url),'utf8'));
 await live.addInitScript(snapshot=>{localStorage.setItem('repforge_v1',JSON.stringify(snapshot));localStorage.setItem('repforge_telemetry_enabled_v1','false')},fixture.durableState);
 await live.goto(base);await waitForAppBoot(live,{base});
 await live.locator('nav button[data-view="stats"]').click();await live.waitForSelector('[data-guide-cue="progress"]');
 assert.equal(await live.evaluate(()=>window.__repforgeUi.guideState().progress.status),'shown');
 await live.locator('[data-guide-dismiss]').click();await live.locator('#statsSeg [data-seg="review"]').click();await live.waitForSelector('[data-guide-cue="block-transition"]');
 await live.locator('[data-guide-dismiss]').click();await live.locator('nav button[data-view="log"]').click();
 assert.equal(await live.evaluate(()=>window.__repforgeEnterWorkout()),true);await live.waitForSelector('[data-guide-cue="first-set"]');
 assert.equal(await live.evaluate(()=>window.__repforgeUi.guideState()['first-set'].status),'shown','acknowledged actual Focus entry still offers first set guide');
 await live.evaluate(async()=>{
  for(const input of document.querySelectorAll('#workout .exercise.is-current .focus-shelf .shelf__input')){
    input.value=input.dataset.k.endsWith('_rir')?'2':input.dataset.k.includes('load')?'40':'6';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    await window.__repforgeWorkoutDraft.flush();
  }
 });
 await live.locator('#workout .exercise.is-current .focus-shelf .saveset').click();
 await live.waitForSelector('[data-guide-cue="focus-utilities"]',{timeout:5000});
 assert.equal(await live.evaluate(()=>{const draft=window.__repforgeWorkoutDraft.current();return Object.values(draft.exercises).some(ex=>Object.values(ex.sets).some(set=>typeof set.completion==='object'&&typeof set.completion.completedAt==='string'))}),true,'utilities guide follows a real acknowledged set, not a repaint');
 await app.close();
 // Exercise the actual Entry composition, including a failed preference write:
 // a repaint must not retry the shown transition after storage recovers.
 const entryContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),entry=await entryContext.newPage();
 await entry.goto(base);await waitForAppBoot(entry,{base});
 await entry.evaluate(()=>{
  const setItem=Storage.prototype.setItem;
  window.entryGuideWrites=0;window.failEntryGuideWrite=true;
  Storage.prototype.setItem=function(key,value){
   if(key==='repforge_ui_v1'&&JSON.parse(value).guideState?.entry?.status==='shown'){
    window.entryGuideWrites++;
    if(window.failEntryGuideWrite)throw new DOMException('Entry preference fault','QuotaExceededError');
   }
   return setItem.call(this,key,value);
  };
 });
 await entry.locator('#firstRunImport').click();
 assert.equal(await entry.locator('[data-guide-cue="entry"]').count(),0,'landing import supersedes the queued chooser attempt');
 assert.equal(await entry.evaluate(()=>window.entryGuideWrites),0);
 await entry.locator('#onbBack').click();await entry.waitForSelector('[data-guide-cue="entry"]');
 assert.equal(await entry.evaluate(()=>window.entryGuideWrites),1,'actual chooser navigation attempts the eligible guide once');
 const entryRepaint=await entry.evaluate(async()=>{
  window.failEntryGuideWrite=false;window.entryGuideWrites=0;
  const cue=document.querySelector('[data-guide-cue="entry"]'),before=localStorage.getItem('repforge_ui_v1');
  window.__repforgeOnboarding.render();window.__repforgeOnboarding.render();await Promise.resolve();
  return{writes:window.entryGuideWrites,unchanged:before===localStorage.getItem('repforge_ui_v1'),sameCue:cue===document.querySelector('[data-guide-cue="entry"]')};
 });
 assert.deepEqual(entryRepaint,{writes:0,unchanged:true,sameCue:true},'Entry repaint preserves its inline cue without retrying a preference transition');
 await entry.locator('[data-entry-hub="import"]').click();await entry.locator('#onbNext').click();
 await entry.locator('#onbBack').click();await entry.waitForSelector('[data-guide-cue="entry"]');
 assert.equal(await entry.evaluate(()=>window.__repforgeUi.guideState().entry.status),'shown','actual Back navigation retries eligibility through the guide/preferences owners');
 assert.equal(await entry.evaluate(()=>window.__repforgeUi.guideState().entry.version),2);
 await entry.locator('#onbCancel').click();await entry.locator('#entryCancelKeep').click();
 await entry.evaluate(()=>window.startOnboarding('settings'));
 await entry.waitForSelector('#entryResumeContinue');
 assert.equal(await entry.locator('[data-guide-cue="entry"]').count(),0,'resume decision does not offer the otherwise eligible chooser guide');
 await entry.locator('#entryResumeContinue').click();await entry.waitForSelector('[data-guide-cue="entry"]');
 await entry.locator('[data-guide-dismiss]').click();
 await entry.evaluate(async()=>{window.__repforgeOnboarding.render();await Promise.resolve()});
 assert.equal(await entry.locator('[data-guide-cue="entry"]').count(),0,'dismissed Entry guide stays dismissed on repaint');
 await entryContext.close();console.log('PASS native render purity and actual Entry/route/selection/Focus-entry/acknowledged-set guide preference effects');

}finally{await browser.close()}
