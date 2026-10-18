/** Real app producer → native Progress chart. The oracle uses fixed loads,
 * dates and row identities, never another chart/model implementation. */
import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
import {installSeedProgram} from './fixtures/seed-program.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await waitForAppBoot(page,{base});
 await installSeedProgram(page,{waitFor:page=>waitForAppBoot(page,{base})});
 await page.evaluate(async()=>{
  const state=JSON.parse(localStorage.getItem('repforge_v1')),slot=state.program[0];
  state.programMeta.started='2026-10-01';state.programMeta.blockId='chart-owner-block';
  state.log=[['old','2026-09-20',35,'older-block'],['one','2026-10-02',40,'chart-owner-block'],['two','2026-10-04',45,'chart-owner-block']].map(([session,date,load,blockId])=>({
   session,date,created:date+'T12:00:00.000Z',day:slot.day,name:slot.name,exerciseId:slot.id,
   performedLibraryId:slot.libraryId,blockId,set:1,load,reps:8,rir:1,primary:slot.primary,secondary:slot.secondary,warmup:false}));
  state._storageRevision+=1;localStorage.setItem('repforge_v1',JSON.stringify(state));
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('repforge',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(state,'repforge_v1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 });
 await page.reload();await waitForAppBoot(page,{base});
 await page.locator('nav [data-view="stats"]').click();
 await page.locator('#overviewStrength [data-ovkey]').first().click();
 await page.waitForSelector('#exercise.active .exchart__plot');
 assert.equal(await page.locator('#exDetail .exrow').count(),2,'current block excludes older block');
 assert.match(await page.locator('.exchart__readout').innerText(),/45/,'latest literal load selected');
 await page.locator('#exDetail .exrow[data-pt="0"]').click();
 assert.match(await page.locator('.exchart__readout').innerText(),/40/,'table chooses first literal session');
 assert.equal(await page.locator('#exDetail .exrow[aria-pressed="true"]').getAttribute('data-pt'),'0');
 await page.locator('#exDetail [data-scope="all-history"]').click();
 assert.equal(await page.locator('#exDetail .exrow').count(),3,'all history adds older literal session');
 assert.match(await page.locator('.exchart__readout').innerText(),/45/,'scope changes reset selection to latest');
 assert.equal(await page.locator('#exDetail [data-scope="all-history"]').evaluate(el=>document.activeElement===el),true,'replaced scope control keeps focus');
 await page.locator('#exDetail [data-metric="e1rm"]').click();
 assert.equal(await page.locator('#exDetail [data-metric="e1rm"]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('.exchart__readout').innerText(),/57/,'45 × 8 Epley value is literal 57');
 await page.locator('#exBack').click();await page.waitForSelector('#stats.active');
 assert.deepEqual(errors,[],'actual app has no module-scope leaks');
 await context.close();console.log('PASS real Exercise chart scope/metric/point/focus/Back with fixed history oracle');
}finally{await browser.close()}
