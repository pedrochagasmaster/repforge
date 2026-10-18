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
  guide.remove();preferences.replaceUi({});writes=0;
  const focus=createFocusDom({window,focus:{beginFrame:()=>0,finishFrame:()=>{}},presentation:{capture:()=>({})},controls:{},geometry:{sizeDeck:()=>{}},effects:{enabled:()=>false,settleBeats:()=>{}},rest:{arrive:()=>{}},motion:{},readFrame:()=>({active:true,context:{list:[],query:{}},cycle:{},dayLabel:'Day',hiddenCount:0}),copy:{t:key=>key},guides:guide,exercise:{},onControlsReplaced:()=>{},onRendered:()=>{}});
  focus.render();focus.render();await Promise.resolve();
  const afterFocusRender={writes,state:preferences.readUi()};
  guide.maybeShow(['first-set','focus-utilities']);
  const afterFocusEntry={writes,state:preferences.readUi()};
  progress.dispose();focus.dispose();guide.remove();
  return{afterProgressRender,afterSelect,afterFocusRender,afterFocusEntry};
 });
 assert.deepEqual(result.afterProgressRender,{writes:0,state:{}},'Progress repaint cannot publish guide transitions');
 assert.equal(result.afterSelect.writes,1);assert.equal(result.afterSelect.state.guideState.progress.status,'shown','explicit segment selection still publishes through actual Guide/preferences');
 assert.deepEqual(result.afterFocusRender,{writes:0,state:{}},'Focus active repaint cannot publish guide transitions');
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
 await app.close();console.log('PASS native render purity and actual route/selection/Focus-entry guide preference effects');
}finally{await browser.close()}
