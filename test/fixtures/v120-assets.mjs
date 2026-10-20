/** Only the historical worker's missing URLs. Exact source bytes from
 * e7b6d162983a4dd2549eb58c32bf6a344936ccf7, the immutable v120 worker release.
 * These files never enter production assembly or the native runtime graph. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const assets=new Map([
 ['/schedule.js','2340967010be27350ca16751121c668f54d112d08ea73c28783f0be0fce9b03c'],
 ['/shared-setup.js','02ddae0059941d94b797b0c3ff57736044c498a8f19ac90e1e30f2cdbcd2fea0'],
].map(([path,hash])=>{
 const body=readFileSync(new URL(`v120${path}`,import.meta.url));
 assert.equal(createHash('sha256').update(body).digest('hex'),hash,`v120 source provenance: ${path}`);
 return [path,body];
}));
export function serveReleasedV120Asset(path,response){
 const body=assets.get(path);if(!body)return false;
 response.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});
 response.end(body);return true;
}

/** Assert the shipped release's natural-update contract. The historical page
 * stays controlled until it leaves; the replacement owns the next navigation. */
export async function activateReplacementAfterClientLeaves(page,{cache,replaced}){
 const {waitForAsyncCondition}=await import('../browser.mjs');
 const replacement=page.context().waitForEvent('serviceworker');
 await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()});
 const worker=await replacement;
 await waitForAsyncCondition(page,async()=>{
  const registration=await navigator.serviceWorker.getRegistration();
  return registration?.waiting?.state==='installed';
 },undefined,{timeout:20000});
 assert.equal(await page.evaluate(async old=>{
  const registration=await navigator.serviceWorker.getRegistration();
  return navigator.serviceWorker.controller===registration.active&&await caches.has(old);
 },replaced),true,'open historical client keeps its controller and cache while update waits');
 await page.goto('about:blank');
 await waitForAsyncCondition(worker,async({cache,replaced})=>{
  const registration=self.registration,names=await caches.keys();
  return registration.active?.state==='activated'&&!registration.waiting&&!registration.installing&&names.includes(cache)&&!names.includes(replaced);
 },{cache,replaced},{timeout:20000});
}
