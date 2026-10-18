/** The shipped boot recovers only after acquiring the actual transfer Web Lock. */
import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const key='repforge_install_transfer_freeze_v1';
const browser=await launchChromium();
async function modulePage(context){const page=await context.newPage();await page.goto(new URL('src/platform/transfer-device.js',base).href);return page}
async function own(page,{malformed=false}={}){
 await page.evaluate(async malformed=>{
  if(malformed){
   localStorage.setItem('repforge_install_transfer_freeze_v1','{broken');
   void navigator.locks.request('install-transfer',async()=>{window.__entered=true;await new Promise(resolve=>window.__release=resolve)});
  }else{
   const {createTransferDevice}=await import('/src/platform/transfer-device.js');
   const device=createTransferDevice({browser:window,nextId:()=> 'crash-proof-owner',now:()=>Date.now()});
   void device.withFrozenLock(async()=>{window.__entered=true;await new Promise(resolve=>window.__release=resolve)});
  }
 },malformed);
 await page.waitForFunction(()=>window.__entered===true);
}
try{
 // Closing the owner realm releases its actual Web Lock but cannot run finally.
 const crashed=await browser.newContext({serviceWorkers:'block'}),owner=await crashed.newPage();
 await owner.goto(base);await waitForAppBoot(owner);
 const initial=await owner.evaluate(async()=>{const next=window.__repforgeWorkoutDraft.state();next.settings.restSec=137;return window.__repforgeCommitProposedState(next)});
 assert.equal(initial.committed,true);const acknowledged=await owner.evaluate(()=>localStorage.getItem('repforge_v1'));
 await own(owner);assert.notEqual(await owner.evaluate(key=>localStorage.getItem(key),key),null);await owner.close();
 const reloader=await modulePage(crashed);
 assert.equal(await reloader.evaluate(()=>navigator.locks.request('install-transfer',{ifAvailable:true},lock=>!!lock)),true);
 assert.notEqual(await reloader.evaluate(key=>localStorage.getItem(key),key),null,'the crash left real orphan bytes');
 await reloader.goto(base);await waitForAppBoot(reloader);
 assert.equal(await reloader.evaluate(key=>localStorage.getItem(key),key),null,'ordinary boot reclaims an orphan only as the actual lock owner');
 assert.equal(await reloader.evaluate(()=>localStorage.getItem('repforge_v1')),acknowledged,'recovery preserves exact acknowledged training bytes');
 const written=await reloader.evaluate(async()=>{const proposal=JSON.parse(JSON.stringify(window.__repforgeWorkoutDraft.state()));proposal.profile={name:'After real owner crash'};return window.__repforgeCommitProposedState(proposal)});
 assert.equal(written.localOk,true);assert.equal(written.idbOk,true);
 await reloader.reload();await waitForAppBoot(reloader);
 assert.equal(await reloader.evaluate(()=>window.__repforgeWorkoutDraft.state().profile.name),'After real owner crash');
 await crashed.close();
 for(const malformed of[false,true]){
  const context=await browser.newContext({serviceWorkers:'block'}),writer=await modulePage(context);
  await own(writer,{malformed});const raw=await writer.evaluate(key=>localStorage.getItem(key),key),reader=await context.newPage();
  await reader.goto(base);
  await reader.waitForFunction(async()=>window.__repforgeBooted===true||(await navigator.locks.query()).pending.some(lock=>lock.name==='install-transfer'));
  assert.equal(await reader.evaluate(()=>window.__repforgeBooted===true),false,'a live real lock owner blocks boot before publication');
  assert.deepEqual(await reader.evaluate(key=>({freeze:localStorage.getItem(key),training:localStorage.getItem('repforge_v1'),identity:localStorage.getItem('repforge_telemetry_identity_v1')}),key),{freeze:raw,training:null,identity:null},'waiting boot neither reclaims a live signal nor mints training/telemetry state');
  await writer.evaluate(()=>window.__release());await waitForAppBoot(reader);
  assert.equal(await reader.evaluate(key=>localStorage.getItem(key),key),null,'normal and malformed signals are reconciled after ownership');
  await context.close();
 }
 console.log('Native transfer crash recovery: orphan reclaim, actual live-writer wait, malformed-signal ownership and durable commit/reload pass');
}finally{await browser.close()}
