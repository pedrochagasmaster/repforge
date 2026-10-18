import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await waitForAppBoot(page,{base});
 const search=await page.evaluate(()=>{
  const owner=window.__repforgeHistory;owner.render();owner.render();
  document.querySelector('#historySearchBtn').click();
  const opened=owner.isSearchOpen(),input=document.querySelector('#historySearch');
  input.value='literal search';input.dispatchEvent(new Event('input',{bubbles:true}));
  const query=owner.query();document.querySelector('#historySearchClear').click();
  return{opened,query,cleared:owner.query(),closed:!owner.isSearchOpen()};
 });assert.deepEqual(search,{opened:true,query:'literal search',cleared:'',closed:true},'rerender owns exactly one active Search listener');
 const afterDispose=await page.evaluate(async()=>{
  const owner=window.__repforgeHistory,button=document.querySelector('#historyCalBtn');owner.render();owner.render();
  const raw=localStorage.getItem('repforge_v1');owner.dispose();button.click();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const deleted=await owner.deleteSession('must-not-delete',{originalFingerprint:'captured-original'});
  const retained=document.createElement('article');retained.className='session--edit';retained.dataset.editing='disposed-edit';document.body.append(retained);
  const saved=await owner.saveSessionEdit('disposed-edit');retained.remove();
  owner.setSearchOpen(true);owner.setQuery('disposed query');owner.startReading('disposed-session');
  return{calendar:document.querySelector('#historyCalSheet').classList.contains('is-open'),expanded:button.getAttribute('aria-expanded'),query:owner.query(),deleted:deleted.code,saved:saved.code,rawPreserved:localStorage.getItem('repforge_v1')===raw};
 });
 assert.deepEqual(afterDispose,{calendar:false,expanded:'false',query:'',deleted:'history_cancelled',saved:'history_cancelled',rawPreserved:true});
 await page.reload();await waitForAppBoot(page,{base});
 const duringOpen=await page.evaluate(async()=>{
  const owner=window.__repforgeHistory;owner.render();document.querySelector('#historyCalBtn').click();owner.dispose();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return{sheet:document.querySelector('#historyCalSheet').classList.contains('is-open'),scrim:document.querySelector('#historyCalScrim').classList.contains('is-open')};
 });
 assert.deepEqual(duringOpen,{sheet:false,scrim:false},'disposed calendar RAF cannot reopen closed presentation');assert.deepEqual(errors,[]);
 await context.close();console.log('PASS actual mounted History disposal: retained controls inert, commands refused, exact storage retained and calendar RAF canceled');
}finally{await browser.close()}
