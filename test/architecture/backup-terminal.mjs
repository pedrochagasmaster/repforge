import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(base);await waitForAppBoot(page);
 const original=await page.evaluate(()=>window.__repforgeWorkoutDraft.state());
 await page.evaluate(()=>{
  const input=document.querySelector('#importJson'),handler=input.onchange;
  input.onchange=function(event){return window.__backupRead=handler.call(this,event)};
 });
 const select=async name=>{
  await page.locator('#importJson').setInputFiles({name:`${name}.json`,mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...original,profile:{name}}))});
  await page.evaluate(()=>window.__backupRead);
 };
 await select('Cancelled');
 const before=await page.evaluate(()=>{window.__cancelledReplace=document.querySelector('#importReplace').onclick;window.__cancelledMerge=document.querySelector('#importMerge').onclick;return localStorage.getItem('repforge_v1')});
 await page.locator('#importCancel').click();await page.waitForFunction(()=>!document.querySelector('#importChoice').open);
 await page.evaluate(async()=>{await window.__cancelledReplace();await window.__cancelledMerge()});
 assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),before,'retained cancelled callbacks cannot issue either durable command');
 assert.equal(await page.evaluate(()=>document.querySelector('#importReplace').onclick),null,'only the owned handler is cleared at terminal close');
 await select('First choice');await select('Second choice');await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#importChoice').open);
 assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),before,'the current choice owns Escape even when the same dialog is reused');
 await page.evaluate(()=>{
  const text=File.prototype.text;File.prototype.text=async function(){window.__pendingRead=true;await new Promise(resolve=>window.__releasePending=resolve);return text.call(this)};
 });
 await page.locator('#importJson').setInputFiles({name:'pending.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...original,profile:{name:'Disposed pending file'}}))});
 await page.waitForFunction(()=>window.__pendingRead===true);
 await page.evaluate(async()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.__releasePending();await window.__backupRead});
 assert.equal(await page.evaluate(()=>document.querySelector('#importChoice').open),false,'actual page lifecycle teardown prevents a late file from reopening confirmation');
 assert.equal(await page.evaluate(()=>localStorage.getItem('repforge_v1')),before);
 await select('Remounted choice');await page.locator('#importReplace').click();await page.waitForFunction(()=>!document.querySelector('#importChoice').open);
 assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().profile.name),'Remounted choice','the view can be used again after terminal teardown');
 await context.close();console.log('Native backup terminal ownership: cancelled callbacks, latest Escape, pagehide pending read and remount pass');
}finally{await browser.close()}
