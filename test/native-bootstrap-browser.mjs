import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from './browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/',browser=await launchChromium();
try{
 const refused=await browser.newContext(),blocked=await refused.newPage(),writerRequests=[];
 await refused.addInitScript(()=>{
  localStorage.setItem('repforge_v1','{"opaque":"literal-unmigrated-user-bytes"}');
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{register:async()=>({update:async()=>{}}),controller:{postMessage(_message,ports){ports[0].postMessage({type:'taurifer-release',id:'literal-other-release'})}}});
 });
 blocked.on('request',request=>{if(/\/(?:app\.js|src\/(?:app|training|persistence|ui)\/|vendor\/)/.test(new URL(request.url()).pathname))writerRequests.push(request.url())});
 await blocked.goto(base);await blocked.waitForSelector('#releaseRecovery');
 assert.deepEqual(writerRequests,[],'mismatched controller must not load optional vendors or any writer dependency');
 assert.deepEqual(await blocked.evaluate(()=>({raw:localStorage.getItem('repforge_v1'),storage:typeof window.__repforgeStorage,boot:window.__repforgeBooted===true,state:window.__repforgeReleaseState})),{raw:'{"opaque":"literal-unmigrated-user-bytes"}',storage:'undefined',boot:false,state:'update-required'});
 await refused.close();
 const installed=await browser.newContext(),page=await installed.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await installed.addInitScript(()=>{Object.defineProperty(window,'RepForgeMotion',{configurable:true,get(){throw Error('Retired Motion owner read')},set(){throw Error('Retired Motion owner publication')}})});
 await page.goto(base);await waitForAppBoot(page);await page.evaluate(()=>window.__repforgeStorage.flush());
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});
 const raw=await page.evaluate(()=>localStorage.getItem('repforge_v1'));
 await installed.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__repforgeBooted===true,undefined,{timeout:20000});
 assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),raw,'offline native reload preserves the acknowledged user snapshot');
 assert.equal(await page.evaluate(()=>window.__repforgeReleaseState),'started');assert.deepEqual(errors,[]);
 await installed.close();console.log('PASS native bootstrap: controller mismatch blocks the entire writer/vendor graph; exact assembled release starts and reloads offline without legacy Motion authority');
}finally{await browser.close()}
