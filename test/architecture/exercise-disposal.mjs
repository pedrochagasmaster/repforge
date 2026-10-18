/** Real native DOM owners stop their own listeners after terminal disposal.
 * The literal counters observe external effects, including retained old nodes.
 */
import assert from 'node:assert/strict';
import {launchChromium} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(new URL('src/ui/progress/exercise.js',base).href);
 const result=await page.evaluate(async()=>{
  const {createExerciseController}=await import('/src/ui/progress/exercise.js');
  const {createExerciseChart}=await import('/src/ui/progress/exercise-chart.js');
  const {createProgressOverview}=await import('/src/ui/progress/overview.js');
  const {createEvidenceViews}=await import('/src/ui/progress/evidence.js');
  const {createReviewController}=await import('/src/ui/progress/review.js');
  document.body.innerHTML='<nav><button data-view="log"></button></nav><section class="view active" id="log"></section><section class="view" id="exercise"><button id="exBack"></button><div id="exDetail"></div></section>';
  const effects={routes:0,why:0,glossary:0,prs:0,settings:0,render:0,queries:0,focus:0};
  const copy={t:key=>key},format={number:String,load:String,displayLoad:x=>x,unit:()=> 'kg',date:String};
  const detail={name:'Literal lift',recommendation:{status:'hold',cue:'Hold',text:'Literal explanation'},topLoad:0,bestE:0,prCount:0,sessions:[],summaries:[],recent:[],slotId:'literal-slot',muscle:'Chest'};
  const queries={open:key=>({key}),detail:()=>{effects.queries++;return detail},projection:()=>({series:new Map(),sessions:[]})};
  const controller=createExerciseController({window,copy,format,queries,motion:null,
   shell:{routePushBegin:()=>{effects.routes++;return()=>{}},routeViewEl:id=>document.getElementById(id),routeHeading:()=>null,focusRoute:()=>effects.focus++},
   onRender:()=>effects.render++,onSettings:()=>effects.settings++,onSeePrs:()=>effects.prs++,onGlossary:()=>effects.glossary++,onWhy:()=>effects.why++});
  controller.open('literal-lift','log');
  document.querySelector('[data-why]').click();document.querySelector('[data-term]').click();
  const live={why:effects.why,glossary:effects.glossary};
  const oldWhy=document.querySelector('[data-why]'),oldTerm=document.querySelector('[data-term]'),oldPrs=document.querySelector('#exSeePrs');
  // Reusable reset and reopen must continue working before terminal disposal.
  controller.reset();controller.open('literal-lift','log');
  const retained=[oldWhy,oldTerm,oldPrs,...document.querySelectorAll('[data-why],[data-term],#exSeePrs')];
  controller.dispose();const atDispose={...effects},html=document.body.innerHTML;
  retained.forEach(button=>button.click());controller.close();controller.open('literal-lift','log');controller.render();controller.redraw();
  const afterDispose={...effects},sameHtml=document.body.innerHTML===html;
  const host=document.querySelector('#exDetail');
  const chart=createExerciseChart({window,copy,format,queries,motion:null,focus:()=>effects.focus++});
  chart.render(host,{key:'literal-lift',name:'Literal lift',identity:{}});
  const oldMetric=host.querySelector('[data-metric="e1rm"]');
  chart.reset();chart.render(host,{key:'literal-lift',name:'Literal lift',identity:{}});
  const currentMetric=host.querySelector('[data-metric="e1rm"]');currentMetric.click();
  const liveMetric=chart.state().metric;
  const retainedScope=host.querySelector('[data-scope="all-history"]');chart.dispose();
  const stateAtDispose=chart.state(),focusAtDispose=effects.focus,chartHtml=host.innerHTML;
  oldMetric.click();currentMetric.click();retainedScope.click();chart.render(host,{key:'literal-lift',name:'Literal lift',identity:{}});
  const chartObservation={stateAfterDispose:chart.state(),focusAfterDispose:effects.focus,chartHtmlUnchanged:host.innerHTML===chartHtml};
  document.body.insertAdjacentHTML('beforeend','<div id="statsIntro"></div><div id="attention"></div><div id="reviewPanel"></div><div id="strengthScopeSeg"><button data-scope="all-history"></button></div><div id="strengthDash"></div>');
  const calls={today:0,lifts:0,repeat:0,propose:0,scope:0};
  const overview=createProgressOverview({document,copy,format,onGoToday:()=>calls.today++,onOpenExercise:()=>calls.lifts++});
  overview.renderIntro(false);const oldGo=document.querySelector('#statsIntroGo');oldGo.click();overview.renderIntro(false);
  overview.renderAttention([{name:'Literal lift',id:'literal',destinationId:'literal',move:'hold',group:'hold',lead:'Literal reason'}]);
  const attention=document.querySelector('[data-action-lift]');attention.click();
  const go=document.querySelector('#statsIntroGo');overview.dispose();const overviewBefore={...calls};
  oldGo.click();go.click();attention.click();overview.renderIntro(false);
  const overviewAfter={...calls};
  const evidence=createEvidenceViews({document,copy,format,presentation:overview,onStrengthScope:()=>calls.scope++,onVolumeScope:()=>{},onPrFilter:()=>{}});
  evidence.renderStrength({scope:'current-block',rows:[]});const scope=document.querySelector('#strengthScopeSeg button');scope.click();evidence.dispose();const scopeBefore=calls.scope;scope.click();
  const review=createReviewController({document,copy,queries:{},commands:{repeat:()=>calls.repeat++,propose:async()=>{calls.propose++;return{ok:false}}},onChange:()=>{},onNotice:()=>{}});
  const model={started:true,checkpoint:{lifecycle:'block-complete',structuralActions:['repeat','reduce-volume'],hasSufficientEvidence:false},life:{isComplete:true},outcomes:[],volume:{plannedWorkingSets:0,completedWorkingSets:0,completedSessions:0,plannedSessions:0,period:{}},periodStart:'2026-10-01',periodEnd:'2026-10-07'};
  review.render(model);const repeat=document.querySelector('[data-review-action="repeat"]');repeat.click();
  review.startVolumeReduction();review.render(model);const propose=document.querySelector('[data-volume-confirm]');
  review.dispose();const reviewBefore={...calls};repeat.click();propose.click();review.startScheduleRepair();review.startRecoveryWeek();await Promise.resolve();
  const reviewAfter={...calls},disposedFlow=review.flow();
  return{overviewBefore,overviewAfter,reviewBefore,reviewAfter,disposedFlow,scopeBefore,scopeAfter:calls.scope,live,atDispose,afterDispose,sameHtml,liveMetric,stateAtDispose,stateAfterDispose:chartObservation.stateAfterDispose,focusAtDispose,focusAfterDispose:chartObservation.focusAfterDispose,chartHtmlUnchanged:chartObservation.chartHtmlUnchanged};
 });
 assert.deepEqual(result.live,{why:1,glossary:1},'live native controls actually call external collaborators');
 assert.deepEqual(result.afterDispose,result.atDispose,'disposed detail cannot navigate, query or invoke retained Why/Glossary/PR handlers');
 assert.equal(result.sameHtml,true,'disposed controller cannot reopen or rerender');
 assert.equal(result.overviewBefore.today,1);assert.equal(result.overviewBefore.lifts,1);
 assert.deepEqual(result.overviewAfter,result.overviewBefore,'disposed Overview retained controls cannot navigate');
 assert.equal(result.scopeBefore,1);assert.equal(result.scopeAfter,1,'disposed Evidence scope cannot invoke parent mutation');
 assert.equal(result.reviewBefore.repeat,1);assert.equal(result.reviewBefore.propose,0);
 assert.deepEqual(result.reviewAfter,result.reviewBefore,'disposed Review cannot issue Repeat or proposal commands');
 assert.equal(result.disposedFlow,null,'disposed Review cannot restart volatile flow');
 assert.equal(result.liveMetric,'e1rm','chart reset is reusable before disposal');
 assert.deepEqual(result.stateAfterDispose,result.stateAtDispose,'disposed retained chart toggles cannot mutate selection');
 assert.equal(result.focusAfterDispose,result.focusAtDispose,'disposed chart cannot focus controls');
 assert.equal(result.chartHtmlUnchanged,true,'disposed chart render is inert');
 console.log('Exercise disposal: actual DOM retained controls inert; reusable reset preserved');
}finally{await browser.close()}
