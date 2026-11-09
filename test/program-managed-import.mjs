#!/usr/bin/env node
/** Browser proof: managed import is an optional transport into existing review. */
import assert from "node:assert/strict";
import {launchChromium,waitForAppBoot} from "./browser.mjs";
const BASE=process.env.REPFORGE_URL||"http://127.0.0.1:8372/";
const source="Push A\nDumbbell bench press 3x8-12\nLat pulldown 3x10";
const reply=JSON.stringify({
  version:3,meta:{name:"Coach plan"},exercises:[
    {day:"Push A",order:1,name:"Dumbbell bench press",sets:3,min:8,max:12},
    {day:"Push A",order:2,name:"Lat pulldown",sets:3,min:10,max:10}
  ],missing:[],notImported:[]
});

const browser=await launchChromium();
try{
  const ctx=await browser.newContext({serviceWorkers:"block",viewport:{width:390,height:844}});
  await ctx.addInitScript(()=>{
    window.turnstile={
      render:(element,options)=>{
        window.__managedTurnstileAction=options.action;
        queueMicrotask(()=>options.callback("synthetic-widget-token"));
        return "fake-widget-id";
      },
      reset:()=>{},
      remove:()=>{}
    };
  });
  const page=await ctx.newPage();
  const sent=[];
  let responseStatus=200;
  await page.route("**/api/program-import/config",route=>route.fulfill({
    status:200,contentType:"application/json",
    body:JSON.stringify({enabled:true,sitekey:"0x4AAAAAAF5mnFwEyHhOD9pl",maxChars:12000})
  }));
  await page.route("**/api/program-import",route=>{
    const raw=route.request().postDataJSON();
    sent.push(raw);
    return route.fulfill({status:responseStatus,contentType:"application/json",
      body:responseStatus===200?JSON.stringify({ok:true,reply}):
        JSON.stringify({ok:false,code:"limit_reached"})});
  });
  await page.goto(BASE,{waitUntil:"domcontentloaded"});
  await waitForAppBoot(page,{base:BASE});
  await page.locator("#firstRunCreate").click();
  await page.locator('[data-entry-hub="import"]').click();
  await page.locator("#onbNext").click();
  await page.locator("#entryFreeformSwitch").click();
  await page.waitForSelector("#entryFreeformIn");
  await page.waitForSelector("#entryManagedPanel:not([hidden])");
  assert.equal(await page.locator("#entryManagedConvert").isDisabled(),true);
  await page.locator("#entryFreeformIn").fill(source);
  await page.waitForFunction(()=>!document.querySelector("#entryManagedConvert")?.disabled);
  assert.equal(await page.evaluate(()=>window.__managedTurnstileAction),"program_import");
  assert.equal(await page.locator("#entryFreeformContinue").textContent(),"Use ChatGPT or Claude instead");
  assert.match(await page.locator("#entryManagedLede").textContent(),/Taurifer reads it here/);
  await page.locator("#entryManagedConvert").click();
  await page.waitForSelector("#importReview.active");
  assert.equal(sent.length,1);
  assert.deepEqual(sent[0],{
    source,locale:"en",token:"synthetic-widget-token"
  });
  assert.equal(await page.locator("[data-imp-row]").count(),2);
  const persisted=await page.evaluate(()=>{
    try{return JSON.parse(localStorage.getItem("repforge_v1")||"{}").program||[]}
    catch{return[]}
  });
  assert.equal(persisted.length,0,"no program activated without explicit review");
  console.log("✓ managed source → Worker response → existing review, with no silent activation");

  // Legacy handoff regression coverage remains in program-freeform-import.mjs.
  console.log("✓ managed API calls contain only source/locale/challenge; key never in browser");
  await ctx.close();
}finally{await browser.close()}
