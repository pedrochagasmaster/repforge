import assert from 'node:assert/strict';
import {launchChromium,waitForAppBoot} from '../browser.mjs';
const base=process.env.REPFORGE_URL||'http://localhost:8000/';
const browser=await launchChromium();
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(base);await waitForAppBoot(page);
 const file=await page.evaluate(()=>JSON.stringify(window.__repforgeWorkoutDraft.state()));
 await page.evaluate(()=>{
  const original=File.prototype.text;File.prototype.text=async function(){
   if(this.name==='slow.json'){window.__slowReadEntered=true;await new Promise(resolve=>window.__releaseSlow=resolve)}
   return original.call(this);
  };
  const input=document.querySelector('#importJson'),handler=input.onchange;
  input.onchange=function(event){const command=handler.call(this,event);if(this.files[0]?.name==='slow.json')window.__slowCommand=command;return command};
 });
 const backup=JSON.parse(file);
 await page.locator('#importJson').setInputFiles({name:'slow.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,profile:{name:'Stale file'}}))});
 await page.waitForFunction(()=>window.__slowReadEntered===true);
 await page.locator('#importJson').setInputFiles({name:'newest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,profile:{name:'Newest file'}}))});
 await page.waitForFunction(()=>document.querySelector('#importChoice')?.open===true);
 await page.evaluate(async()=>{window.__releaseSlow();await window.__slowCommand});
 await page.locator('#importReplace').click();
 await page.waitForFunction(()=>document.querySelector('#importChoice')?.open===false);
 assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().profile?.name),'Newest file','a late earlier file read cannot replace the latest confirmed backup');
 await page.reload();await waitForAppBoot(page);
 assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().profile?.name),'Newest file');
 await context.close();console.log('Native backup UI: actual delayed File.text cannot displace a newer selection, and confirmed bytes survive reload');
}finally{await browser.close()}
