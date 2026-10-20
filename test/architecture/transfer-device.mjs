/** Real device records and Web Locks; no app globals or copied protocol. */
import assert from 'node:assert/strict';
import {launchChromium} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({serviceWorkers:'block'}),a=await context.newPage(),b=await context.newPage();
 for(const page of[a,b]){
  await page.goto(new URL('src/platform/transfer-device.js',base).href);
  await page.evaluate(async base=>{
   const {createTransferDevice,TRANSFER_KEYS}=await import(new URL('src/platform/transfer-device.js',base).href);
   let next=0;window.__deviceKeys=TRANSFER_KEYS;
   window.__device=createTransferDevice({browser:window,nextId:()=>`owner-${++next}`,now:()=>Date.parse('2026-10-18T00:00:00.000Z')});
  },base);
 }
 await a.evaluate(()=>{
  localStorage.clear();window.__deviceDone=window.__device.withFrozenLock(async()=>{
   window.__ownerInsideFrozen=window.__device.mutationFrozen();
   window.__nestedTransfer=await window.__device.withFrozenLock(()=>({nested:true}));
   await new Promise(resolve=>window.__releaseDevice=resolve);return{completed:true};
  });
 });
 await a.waitForFunction(()=>typeof window.__releaseDevice==='function');
 assert.equal(await b.evaluate(()=>window.__device.mutationFrozen()),true,'a foreign tab observes the acknowledged transfer freeze');
 assert.deepEqual(await a.evaluate(()=>({own:window.__ownerInsideFrozen,nested:window.__nestedTransfer})),{own:false,nested:{nested:true}},'own freeze allows nested receiver work without requesting the same lock twice');
 const pending=await b.evaluate(()=>{
  window.__secondEntered=false;
  window.__secondLock=window.__device.withFrozenLock(()=>{window.__secondEntered=true;return{second:true}});
  return window.__secondEntered;
 });
 assert.equal(pending,false,'another actual Web Lock owner cannot enter before release');
 await a.evaluate(()=>window.__releaseDevice());
 assert.deepEqual(await a.evaluate(()=>window.__deviceDone),{completed:true});
 assert.deepEqual(await b.evaluate(()=>window.__secondLock),{second:true});
 assert.equal(await b.evaluate(()=>localStorage.getItem(window.__deviceKeys.freeze)),null,'the exact owned freeze record is removed after release');
 const statuses=await a.evaluate(async()=>{
  const device=window.__device,key=window.__deviceKeys;
  localStorage.setItem(key.freeze,'{broken');const malformedSignal=device.mutationFrozen();localStorage.removeItem(key.freeze);
  localStorage.setItem(key.outbound,'{broken');const malformedOutbound=device.mutationFrozen();
  localStorage.setItem(key.outbound,JSON.stringify({phase:'resumedDiverged'}));const diverged=device.mutationFrozen();localStorage.removeItem(key.outbound);
  const inbound=device.inboundStore({preserveCleanupMarker:true});
  await inbound.write({phase:'local-committed'});await inbound.write({phase:'cleanup-pending',remoteState:'deleted'});
  const clearing=inbound.clear(),duringClear=localStorage.getItem(key.inbound)!==null;await clearing;
  return{malformedSignal,malformedOutbound,diverged,duringClear,afterClear:localStorage.getItem(key.inbound)};
 });
 assert.deepEqual(statuses,{malformedSignal:true,malformedOutbound:true,diverged:false,duringClear:true,afterClear:null},'malformed bytes remain protected and acknowledged inbound cleanup preserves its deferred boundary');
 await context.close();console.log('Native transfer device: real cross-tab ownership, reentrancy, protected malformed records and deferred cleanup pass');
}finally{await browser.close()}
