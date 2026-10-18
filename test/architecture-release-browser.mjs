/** Actual native browser/SW protocol fixture; source application journeys remain owning suites. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {assembleRelease} from '../scripts/release-assembly.mjs';
import {launchChromium,waitForAsyncCondition} from './browser.mjs';
const dir=mkdtempSync(join(tmpdir(),'taurifer-native-browser-'));
mkdirSync(join(dir,'src/release'),{recursive:true});
writeFileSync(join(dir,'src/release/gate.js'),readFileSync(new URL('../src/release/gate.js',import.meta.url)));
writeFileSync(join(dir,'src/leaf.js'),'export const n = 7;');
writeFileSync(join(dir,'src/main.js'),`import {startRelease} from './release/gate.js';
const id=document.querySelector('[name=taurifer-release]').content;
const result=await startRelease({controller:navigator.serviceWorker?.controller,releaseId:id,load:async()=>{
  const {n}=await import('./leaf.js');
  window.answer=n; localStorage.setItem('writes',String(Number(localStorage.getItem('writes')||0)+1));
}});
window.result=result;
if(!location.search.includes('noSW')) navigator.serviceWorker.register('./sw.js').catch(()=>{});`);
writeFileSync(join(dir,'styles.css'),'body{background-image:url("assets/pixel.svg");color:rgb(1,2,3)}');
mkdirSync(join(dir,'assets'));
writeFileSync(join(dir,'assets/pixel.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
writeFileSync(join(dir,'manifest.webmanifest'),JSON.stringify({name:'fixture',start_url:'./index.html',scope:'./'}));
writeFileSync(join(dir,'index.html'),'<head><meta name="taurifer-release" content="source"><link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="styles.css"></head><script type="module" src="src/main.js"></script>');
const release=assembleRelease(dir);
let historical=false, blockAsset=false, blockedRequests=0;
const oldWorker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith((async()=>{const c=await caches.open('repforge-v999');try{const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r;}catch{return await c.match(e.request)||new Response('offline',{status:503});}})());});`;
const server=createServer((req,res)=>{
  const rawPath=new URL(req.url,'http://fixture').pathname;
  // Match the production host's canonical index.html-to-directory redirect.
  if(rawPath.endsWith('/index.html')){res.writeHead(302,{location:rawPath.slice(0,-10)});res.end();return;}
  const path=rawPath.replace(/^\/scoped\//,'/');
  if(path==='/probe'){res.setHeader('content-type','text/html');res.end('<title>probe</title>');return;}
  if(path==='/sw.js'&&historical){res.setHeader('content-type','text/javascript');res.setHeader('cache-control','no-store');res.end(oldWorker);return;}
  const file=join(dir,path.endsWith('/')?path+'index.html':path);
  if(blockAsset&&path.endsWith('/src/leaf.js')) blockedRequests++;
  if(!existsSync(file)||blockAsset&&path.endsWith('/src/leaf.js')){res.writeHead(503);res.end('unavailable');return;}
  res.setHeader('content-type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[extname(file)]||'application/json');
  res.setHeader('cache-control','no-store');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await launchChromium();
try {
  for(const scope of ['/','/scoped/']) {
    const context=await browser.newContext();
    let page=await context.newPage();
    await page.goto(origin+scope+'?noSW');
    await page.waitForFunction(()=>window.result==='started');
    assert.equal(await page.evaluate(()=>window.answer),7,'uncontrolled/noSW graph starts');
    assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).color),'rgb(1, 2, 3)');
    assert.equal(await page.locator('link[rel=manifest]').getAttribute('href'),'manifest.webmanifest');
    // A historical controlling worker has no handshake. New HTML may arrive,
    // but its writer graph must stay unloaded, including on gated offline restart.
    historical=true;
    await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    historical=false;blockAsset=true;blockedRequests=0;
    await page.evaluate(async()=>{await caches.open('unrelated-cache');});
    const writes=await page.evaluate(()=>localStorage.getItem('writes'));
    await page.goto(origin+scope);
    await page.waitForFunction(()=>window.result==='update-required');
    assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),writes);
    // Installation of the new required graph fails; old worker has cached the
    // new gated HTML and script. Offline restart must remain read-only.
    const deadline=Date.now()+15000;
    while(!blockedRequests&&Date.now()<deadline) await new Promise(resolve=>setTimeout(resolve,50));
    assert.ok(blockedRequests,'required asset failure was actually exercised');
    await context.setOffline(true);await page.reload();
    await page.waitForFunction(()=>window.result==='update-required');
    assert.equal(await page.evaluate(()=>localStorage.getItem('writes')),writes);
    await context.setOffline(false);blockAsset=false;
    await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await waitForAsyncCondition(page,async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
    // The installed worker waits while historical clients remain open.
    assert.equal(await page.evaluate(()=>window.answer),undefined);
    let nextWorker;
    for(const worker of context.serviceWorkers()) {
      if(await worker.evaluate(()=>typeof RELEASE!=='undefined').catch(()=>false)) nextWorker=worker;
    }
    assert.ok(nextWorker,'new release worker installed');
    await page.close();
    await waitForAsyncCondition(nextWorker,()=>!self.registration.waiting && self.registration.active?.state==='activated');
    // Probe does not register/load the app; wait for natural activation then
    // navigate offline to the installed rewritten shell and complete native graph.
    page=await context.newPage();await page.goto(origin+scope+'probe');
    await waitForAsyncCondition(page,async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&!r.waiting;});
    await context.setOffline(true);
    await page.goto(origin+scope);
    await page.waitForFunction(()=>window.result==='started');
    assert.equal(await page.evaluate(()=>window.answer),7,'installed offline graph and relative imports start');
    assert.equal(await page.evaluate(()=>document.querySelector('[name=taurifer-release]').content),release.id);
    const cacheNames=await page.evaluate(()=>caches.keys());
    assert.ok(cacheNames.includes('unrelated-cache'));
    assert.ok(!cacheNames.includes('repforge-v999'),'natural activation retires prior cache only after clients closed');
    await context.close();
  }
  console.log('Native release browser protocol passed: root/scoped noSW, old-controller gate, blocked required install, offline gated restart, waiting, natural activation/cache retirement, offline shell/import/CSS');
} finally {await browser.close();server.close();rmSync(dir,{recursive:true,force:true});}
