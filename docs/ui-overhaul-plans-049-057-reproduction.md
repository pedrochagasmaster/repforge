# PR 280 post-058 production reproduction record

These are manual audit probes, not permanent application regression suites.
Run from the audited worktree after installing pinned `test/` dependencies.
They use synthetic storage, isolated Chromium contexts and fresh loopback ports.
The scripts assert the defects still observed and the A05 closure; a repaired
product should invalidate the corresponding defect assertion.

Extract each JavaScript fence in order to `/tmp/pr280-repro-1.mjs` and
`/tmp/pr280-repro-2.mjs`. Run one at a time on a clean head:

```sh
node tools/record-verification.mjs --output /tmp/pr280-a01-proof.json -- node /tmp/pr280-repro-1.mjs
node tools/record-verification.mjs --output /tmp/pr280-live-proof.json -- node /tmp/pr280-repro-2.mjs
```

The first script adds a storage-write scheduling barrier and uses the real
DraftV2 dispatcher, durable journal, cross-tab lock, promotion and boot. The
second uses the repository's preview owner and actual catalog session helper.
Its data-control edit changes only `rirMeasured`, explicitly outside the user
journey, to distinguish provenance failure from insufficient numeric evidence.
No assertion certifies physical devices or the full catalog.

## A01

```javascript
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const {launchChromium}=await import(root+'/test/browser.mjs');
const {installSeedProgram}=await import(root+'/test/fixtures/seed-program.mjs');
let releaseBarrier, notifyBarrier;
const barrier=new Promise(r=>notifyBarrier=r);
const server=http.createServer(async(req,res)=>{if(req.url==='/pause'){releaseBarrier=()=>res.end('ok');notifyBarrier();return}try{const p=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(await fs.readFile(p))}catch{res.statusCode=404;res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url=`http://127.0.0.1:${server.address().port}/`;
const browser=await launchChromium();
try{
const ctx=await browser.newContext({serviceWorkers:'block'});
const a=await ctx.newPage(); await a.goto(url);await a.waitForFunction(()=>window.__repforgeBooted);
await installSeedProgram(a,{waitFor:async()=>a.waitForFunction(()=>window.__repforgeBooted)});
await a.evaluate(()=>window.__repforgeEnterWorkout({})); await a.evaluate(()=>window.__repforgeWorkoutDraft.flush());
const b=await ctx.newPage();await b.goto(url);await b.waitForFunction(()=>window.__repforgeBooted);await b.evaluate(()=>window.__repforgeEnterWorkout({}));
await a.evaluate(()=>window.__repforgeStorage.flush());await b.evaluate(()=>window.__repforgeStorage.flush());
await a.evaluate(()=>{window.held=false;window.lockPromise=navigator.locks.request('repforge:state-write',()=>new Promise(r=>{window.releaseLock=r;window.held=true}));});await a.waitForFunction(()=>window.held);
await a.evaluate(()=>{const h=window.__repforgeWorkoutDraft;const s=h.state();s.settings.restSec=123;window.stateCommit=h.commitEffect(s,h.effect.preserve());});
await a.waitForFunction(()=>Object.keys(localStorage).some(k=>k.startsWith('repforge_pending_v1:')));
console.log('journal present');
await a.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('repforge_draft_v1:pending:')&&!window.paused){window.paused=true;const xhr=new XMLHttpRequest();xhr.open('GET','/pause',false);xhr.send()}return original.call(this,k,v)}});
const command=({field,value})=>{const h=window.__repforgeWorkoutDraft;const d=h.current();return h.dispatch('editSetField',{...h.target(`${d.session.selectedExerciseId}_1_load`),field,value})};
const first=a.evaluate(command,{field:'load',value:'80'});
await Promise.race([barrier,new Promise((_,r)=>setTimeout(()=>r(Error('barrier timeout')),10000))]);
console.log('first paused after CAS before sidecar write');
const second=await b.evaluate(command,{field:'reps',value:'12'});console.log('second',second.status);
releaseBarrier();const result=await first;console.log('first',result.status);assert.equal(second.status,'applied');assert.equal(result.status,'applied');
console.log('sidecars',await b.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('repforge_draft_v1:pending:')).map(k=>{const d=JSON.parse(JSON.parse(localStorage.getItem(k)).raw);const e=d.exercises[d.session.selectedExerciseId];return{revision:d.revision,load:e.sets[e.setOrder[0]].edited.load,reps:e.sets[e.setOrder[0]].edited.reps}})));
await a.evaluate(()=>window.releaseLock());await a.evaluate(()=>window.stateCommit);
console.log('canonical',await a.evaluate(()=>{const d=JSON.parse(localStorage.getItem('repforge_draft_v1'));const e=d.exercises[d.session.selectedExerciseId];return{revision:d.revision,load:e.sets[e.setOrder[0]].edited.load,reps:e.sets[e.setOrder[0]].edited.reps}}));
await a.reload();await a.waitForFunction(()=>window.__repforgeBooted);console.log('reload',await a.evaluate(()=>{const d=JSON.parse(localStorage.getItem('repforge_draft_v1'));const e=d.exercises[d.session.selectedExerciseId];return{revision:d.revision,load:e.sets[e.setOrder[0]].edited.load,reps:e.sets[e.setOrder[0]].edited.reps}}));
const settled=await a.evaluate(()=>({draft:JSON.parse(localStorage.getItem('repforge_draft_v1')),checkpoint:JSON.parse(localStorage.getItem('repforge_draft_v1:v2-checkpoint')),sidecars:Object.keys(localStorage).filter(k=>k.startsWith('repforge_draft_v1:pending:'))}));const ex=settled.draft.exercises[settled.draft.session.selectedExerciseId];const edits=ex.sets[ex.setOrder[0]].edited;assert.equal(settled.draft.revision,1);assert.ok(edits.load!=='80'||edits.reps!=='12');assert.equal(settled.checkpoint.raw,JSON.stringify(settled.draft));assert.equal(settled.sidecars.length,0);console.log('A01 checkpoint and canonical agree; competing sidecars cleared; acknowledged edit lost');
}finally{releaseBarrier?.();await browser.close();server.close()}
```

## A02–A05 and N01–N02

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const root=process.cwd();
const {maybeStartLocalPreview}=await import(root+'/tools/local-preview.mjs');
const {launchChromium}=await import(root+'/test/browser.mjs');
const {seedProgram,seedProgramMeta}=await import(root+'/test/fixtures/seed-program.mjs');
const session=await import(root+'/tools/ui-screens/session.mjs');
const preview=await maybeStartLocalPreview([{lane:'workout'}],{cwd:root});
const url=preview.env.REPFORGE_URL;session.setCaptureBase(url);
const browser=await launchChromium();
const boot=p=>p.waitForFunction(()=>window.__repforgeBooted);
async function persisted(p,mutate){await p.evaluate(()=>window.__repforgeStorage.flush());const state=await p.evaluate(()=>JSON.parse(localStorage.getItem('repforge_v1')));mutate(state);await session.seed(p,state);return state;}
const evidence=p=>p.evaluate(()=>({records:window.__repforgeProgressEvidence.records().filter(x=>x.evidenceCount),volume:window.__repforgeProgressEvidence.volume('this-week'),block:window.__repforgeProgressEvidence.volume('block-to-date'),recommendation:window.__repforgeRecommendation(window.__repforgeWorkoutDraft.state().program[0])}));
try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/New_York',reducedMotion:'reduce',serviceWorkers:'block'});
 await ctx.addInitScript(()=>{const D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-03-09T16:00:00Z']))}static now(){return new D('2026-03-09T16:00:00Z').getTime()}}});
 const p=await ctx.newPage();await p.goto(url);await boot(p);
 const state=await persisted(p,s=>{s.program=seedProgram();s.programMeta=seedProgramMeta({started:'2026-03-02'});s.log=[{session:'s1',date:'2026-03-02',day:'Day 1',exerciseId:s.program[0].id,name:s.program[0].name,primary:s.program[0].primary,load:50,reps:8,rir:null,set:1,work:true},{session:'s2',date:'2026-03-09',day:'Day 1',exerciseId:s.program[0].id,name:s.program[0].name,primary:s.program[0].primary,load:50,reps:9,rir:2,set:1,work:true}];});
 let before=await evidence(p);console.log('A03 DST',JSON.stringify(before.volume));console.log('A03 block denominator',JSON.stringify(before.block));
 assert.equal(before.volume.period.weekNumber,1);assert.equal(before.volume.end,'2026-03-08');assert.equal(before.volume.completedRows.some(r=>r.session==='s2'),false);assert.equal(before.block.period.elapsedNumberedWeeks,1);
 await p.locator('nav button[data-view="history"]').click();await p.evaluate(()=>window.__repforgeHistory.startReading('s1'));await p.locator('[data-history-edit]').click();await p.locator('[data-ek="rir|0"]').fill('2');await p.locator('[data-edsave]').click();await p.waitForSelector('[data-reading="s1"]');await p.evaluate(()=>window.__repforgeStorage.flush());
 const replicas=await p.evaluate(async()=>{const local=JSON.parse(localStorage.getItem('repforge_v1')).log.find(r=>r.session==='s1');const db=await new Promise(r=>{const q=indexedDB.open('repforge',1);q.onsuccess=()=>r(q.result)});const idb=await new Promise(r=>{const q=db.transaction('kv').objectStore('kv').get('repforge_v1');q.onsuccess=()=>r(q.result.log.find(r=>r.session==='s1'))});db.close();return{local,idb};});
 assert.deepEqual(replicas.local,replicas.idb);assert.equal(replicas.local.rir,2);assert.equal(replicas.local.rirMeasured,false);
 await p.reload();await boot(p);let corrected=await evidence(p);assert.equal(corrected.records[0].reason,'missing-effort');console.log('A02 saved replicas',JSON.stringify(replicas));console.log('A02 reloaded evidence',JSON.stringify(corrected));
 await persisted(p,s=>s.log.find(r=>r.session==='s1').rirMeasured=true);let control=await evidence(p);assert.equal(control.records[0].evidenceState,'sufficient');assert.equal(control.records[0].outcome,'improved');console.log('A02 flag-only control',JSON.stringify(control));
 // Isolate no-history UI so recommendation text cannot supply accidental RIR.
 await persisted(p,s=>{s.log=[];s.programMeta.started=null;s.settings.lang='pt';s.program[0].progression={schemaVersion:1,strategy:{id:'effort_target',version:1,params:{workingSets:2,targetReps:5,targetRirMin:2,targetRirMax:3,minLoadIncrement:2.5}},modifiers:[]};});
 const prescription=await p.evaluate(()=>window.__repforgeWorkoutDraft.state().program[0].progression);assert.equal(prescription.strategy.params.targetRirMax,3);console.log('N02 production prescription',JSON.stringify(prescription));
 await p.locator('#previewSession').click();let text=await p.locator('#previewSessionList .preview__row').first().innerText();assert.doesNotMatch(text,/RIR|3 RIR|RIR 3/);assert.equal(await p.evaluate(()=>localStorage.getItem('repforge_draft_v1')),null);console.log('N02 live preview with programmed effort_target RIR 2-3',JSON.stringify(text));await p.locator('#previewSessionClose').click();
 await p.evaluate(()=>window.__repforgeEnterWorkout({}));await p.evaluate(()=>window.__repforgeWorkoutDraft.flush());await p.evaluate(()=>{const d=window.__repforgeWorkoutDraft.current();window.__repforgeExActions.open(d.session.selectedExerciseId)});
 let meta=await p.locator('#exActionsSub').innerText();assert.match(meta,/2 sets/);console.log('N01 PT',meta);
 let toggle=p.locator('[data-warm-toggle-set]').first();const sid=await toggle.getAttribute('data-warm-toggle-set');await toggle.focus();await p.keyboard.press('Enter');await p.waitForFunction(sid=>document.querySelector(`[data-warm-toggle-set="${sid}"]`)?.textContent.includes('trabalho'),sid);
 let focus=await p.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,sheetVisible:!!document.querySelector('#exActionsSheet.is-open')}));assert.equal(focus.tag,'BODY');await p.keyboard.press('Tab');let next=await p.evaluate(()=>document.activeElement.id);assert.equal(next,'exActionSubstBtn');console.log('A04 warmup',JSON.stringify({focus,next}));
 await toggle.focus();await p.keyboard.press('Enter');await p.waitForFunction(sid=>document.querySelector(`[data-warm-toggle-set="${sid}"]`)?.textContent.includes('aquecimento'),sid);assert.equal(await p.evaluate(()=>document.activeElement.tagName),'BODY');console.log('A04 working toggle loses focus too');await ctx.close();
 const manifest=JSON.parse(await fs.readFile(root+'/docs/ui-screens/manifest.json','utf8'));
 const scaleState={...state,settings:{...state.settings,lang:'en'}};
 for(const locale of ['en','pt']){
  const measurements=[];
  for(const textScale of ['normal','text200']){
   const scaleKey=Object.keys(manifest.textScales).find(k=>manifest.textScales[k].rootFontScale===(textScale==='normal'?1:2));
   const localeKey=Object.keys(manifest.locales).find(k=>manifest.locales[k].browserLocale===(locale==='en'?'en-US':'pt-BR'));
   const opened=await session.openPage(browser,manifest,{viewport:'phone-390',theme:'light',locale:localeKey,text:scaleKey,motion:'reduced'},{...scaleState,settings:{...scaleState.settings,lang:locale}});
   await opened.page.locator('nav button[data-view="history"]').click();await opened.page.evaluate(()=>window.__repforgeHistory.startReading('s1'));
   const selectors=['.history-read__row','.history-read__name','.history-read__head','.session__day','[data-history-edit]','[data-del]'];
   const measure=async()=>opened.page.evaluate(selectors=>Object.fromEntries(['html',...selectors].map(s=>{const e=document.querySelector(s);if(!e)throw Error('missing '+s);return[s,parseFloat(getComputedStyle(e).fontSize)]})),selectors);
   const sizes=await measure();measurements.push(sizes);console.log('A05 catalog',locale,textScale,JSON.stringify(sizes));
   await opened.page.reload();await boot(opened.page);assert.equal(await opened.page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)),textScale==='normal'?16:32);
   if(textScale!=='normal'){
    await opened.page.addStyleTag({content:'html { font-size:32px !important }'});await opened.page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));await opened.page.locator('nav button[data-view="history"]').click();await opened.page.evaluate(()=>window.__repforgeHistory.startReading('s1'));const external=await measure();assert.deepEqual(external,sizes);console.log('A05 external computed 32px',locale,JSON.stringify(external));
   }
   await opened.context.close();
  }
  for(const s of Object.keys(measurements[0]))assert.equal(measurements[1][s],2*measurements[0][s],locale+' '+s);
 }
 console.log('All seven disposition assertions passed');
} finally {await browser.close();preview.cleanup();}
```
