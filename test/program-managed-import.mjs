#!/usr/bin/env node
/** Browser proof: managed import is an optional transport into the existing review.
 *  Every scenario runs against a mocked Worker and a fake Turnstile; no network. */
import assert from "node:assert/strict";
import {launchChromium,waitForAppBoot,waitForAsyncCondition} from "./browser.mjs";
const BASE=process.env.REPFORGE_URL||"http://localhost:8000/";
const SITEKEY="0x4AAAAAAF5mnFwEyHhOD9pl";
const source="Push A\nDumbbell bench press 3x8-12\nLat pulldown 3x10";
const programReply=()=>JSON.stringify({
  version:3,meta:{name:"Coach plan"},exercises:[
    {day:"Push A",order:1,name:"Dumbbell bench press",sets:3,min:8,max:12},
    {day:"Push A",order:2,name:"Lat pulldown",sets:3,min:10,max:10}
  ],missing:[],notImported:[]
});
const twoDayGapReply=JSON.stringify({
  version:3,meta:{name:"Coach plan"},exercises:[
    {day:"TREINO A – Peito (segunda)",order:1,name:"Supino reto",sets:4,min:6,max:8},
    {day:"TREINO A – Peito (segunda)",order:2,name:"Mergulho no banco",sets:3},
    {day:"TREINO A – Peito (segunda)",order:3,name:"Elevação lateral",min:12,max:15},
    {day:"TREINO B – Costas (terça)",order:1,name:"Barra fixa",sets:4}
  ],missing:[
    {day:"TREINO A – Peito (segunda)",order:2,field:"reps"},
    {day:"TREINO A – Peito (segunda)",order:3,field:"sets"},
    {day:"TREINO B – Costas (terça)",order:1,field:"reps"}
  ],notImported:[]
});
/* Names from the owner's sample that the matcher only suggests ("Likely"), on main and with the
   PT alias work in #744; the test still reads the statuses the screen shows. */
const vagueReply=JSON.stringify({
  version:3,meta:{name:"Coach plan"},exercises:[
    {day:"Day 1",order:1,name:"Supino reto c/ barra",sets:4,min:6,max:8},
    {day:"Day 1",order:2,name:"Abdominal prancha",sets:3,min:10,max:12},
    {day:"Day 1",order:3,name:"Farmer walk",sets:3,min:10,max:12},
    {day:"Day 1",order:4,name:"Zorblex machine wiggle",sets:3,min:10,max:12}
  ],missing:[],notImported:[]
});
const gapReply=JSON.stringify({
  version:3,meta:{name:"Coach plan"},exercises:[
    {day:"Push A",order:1,name:"Dumbbell bench press",sets:3,min:8,max:12},
    {day:"Push A",order:2,name:"Lat pulldown",sets:3}
  ],missing:[{day:"Push A",order:2,field:"reps"}],notImported:[]
});
const EN={
  continue:"Continue",
  external:"Use ChatGPT or Claude instead",
  providerFailed:"The import service could not read your program. No changes were saved.",
  rateLimited:"The import limit was reached. Try again later, or use your own assistant.",
  failed:"Could not import this program right now. Try again or use your assistant."
};

/** A Worker reply the test releases when it chooses. */
function deferred(){
  let resolve;const promise=new Promise(r=>{resolve=r});
  return {promise,resolve};
}
/** Node-side state (requests the route saw) settles on route events, not on time. */
function observed(){
  const items=[],waiters=[];
  return {items,push(item){items.push(item);waiters.splice(0).forEach(w=>w())},
    async count(n){while(items.length<n)await new Promise(r=>waiters.push(r))}};
}

const browser=await launchChromium();
let passed=0;const failures=[];
async function scenario(name,{config={enabled:true,sitekey:SITEKEY,maxChars:12000},configRaw=null,mockConfig=true,serviceWorkers="block",stubTurnstile=true,worker},body){
  const ctx=await browser.newContext({serviceWorkers,viewport:{width:390,height:844}});
  if(stubTurnstile)await ctx.addInitScript(()=>{
    /* Fake Turnstile: numbered tokens, and callbacks a test can fire to expire
       the token or fail the challenge. */
    let issued=0;
    window.__ts={renders:0,resets:0,options:null,issue(){
      window.__ts.options?.callback("synthetic-token-"+(++issued));
    }};
    window.turnstile={
      render:(element,options)=>{
        window.__ts.renders++;window.__ts.options=options;
        queueMicrotask(()=>window.__ts.issue());
        return "fake-widget-id";
      },
      reset:()=>{window.__ts.resets++;queueMicrotask(()=>window.__ts.issue())},
      remove:()=>{window.__ts.options=null}
    };
  });
  const page=await ctx.newPage();
  const sent=observed(),failed=observed(),consoleErrors=[];
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text())});
  page.on("requestfailed",request=>{
    if(new URL(request.url()).pathname==="/api/program-import")failed.push(request.failure()?.errorText||"failed");
  });
  if(mockConfig)await page.route("**/api/program-import/config",route=>route.fulfill(configRaw||{
    status:200,contentType:"application/json",body:JSON.stringify(config)
  }));
  await page.route("**/api/program-import",async route=>{
    sent.push(route.request().postDataJSON());
    const reply=await worker(sent.items.length);
    if(reply==="abort")return route.abort("failed").catch(()=>{});
    return route.fulfill({status:reply.status||200,contentType:"application/json",
      body:JSON.stringify(reply.body)}).catch(()=>{});
  });
  try{
    await page.goto(BASE,{waitUntil:"domcontentloaded"});
    await waitForAppBoot(page,{base:BASE});
    await body({page,ctx,sent,failed,consoleErrors});
    passed++;
    console.log("✓ "+name);
  }catch(error){
    failures.push(name);
    console.error("✗ "+name+"\n  "+String(error?.stack||error).split("\n").slice(0,4).join("\n  "));
  }finally{await ctx.close()}
}

async function openFreeform(page){
  await page.locator("#firstRunCreate").click();
  await page.locator('[data-entry-hub="import"]').click();
  await page.locator("#onbNext").click();
  await page.locator("#entryFreeformSwitch").click();
  await page.waitForSelector("#entryFreeformIn");
}
async function readyToImport(page,text=source){
  await openFreeform(page);
  await page.waitForSelector("#entryManagedPanel:not([hidden])");
  await page.locator("#entryFreeformIn").fill(text);
  await page.waitForSelector("#entryManagedConvert:not([disabled])");
}
const settledWithStatus=page=>waitForAsyncCondition(page,()=>
  !document.querySelector("#entryManagedStatus")?.hidden&&
  document.querySelector("#entryManagedConvert")?.getAttribute("aria-busy")==="false");
const savedProgram=page=>page.evaluate(()=>{
  try{return JSON.parse(localStorage.getItem("repforge_v1")||"{}").program||[]}catch{return[]}
});
const statusText=page=>page.evaluate(()=>{
  const el=document.querySelector("#entryManagedStatus");
  return el&&!el.hidden?el.textContent:"";
});
async function stillOnSource(page,text){
  assert.equal(await page.locator("#entryFreeformIn").inputValue(),text,"the pasted source is kept");
  assert.equal(await page.locator("#importReview.active").count(),0,"no review opened");
  assert.equal((await savedProgram(page)).length,0,"nothing was activated");
}

try{
  await scenario("complete reply → existing review, with only source/locale/token sent and no activation",{
    worker:()=>({body:{ok:true,reply:programReply()}})
  },async({page,sent})=>{
    await openFreeform(page);
    await page.waitForSelector("#entryManagedPanel:not([hidden])");
    assert.equal(await page.locator("#entryManagedConvert").isDisabled(),true,"no source, no import");
    await page.locator("#entryFreeformIn").fill(source);
    await page.waitForSelector("#entryManagedConvert:not([disabled])");
    assert.equal(await page.evaluate(()=>window.__ts.options.action),"program_import");
    assert.equal(await page.locator("#entryFreeformContinue").textContent(),EN.external);
    // The class swap may start a background transition; read the settled style.
    await waitForAsyncCondition(page,()=>["#entryFreeformContinue","#entryFreeformFile"]
      .every(id=>document.querySelector(id)?.getAnimations().length===0));
    const look=await page.evaluate(()=>Object.fromEntries(["#entryFreeformContinue","#entryFreeformFile"].map(id=>{
      const style=getComputedStyle(document.querySelector(id));
      return [id,{bg:style.backgroundColor,ink:style.color,border:style.borderTopColor,radius:style.borderTopLeftRadius}];
    })));
    assert.deepEqual(look["#entryFreeformContinue"],look["#entryFreeformFile"],
      "the hand-off has the same quiet treatment as the file switch");
    assert.equal(await page.locator("#entryFreeformPrivacy").isHidden(),true,"the tab-only note gives way to the managed note");
    assert.equal(await page.locator(".entry__managed-disclosure").count(),1);
    assert.match(await page.locator("#entryManagedLede").textContent(),/Taurifer converts it/);
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#importReview.active");
    assert.deepEqual(sent.items,[{source,locale:"en",token:"synthetic-token-1"}]);
    assert.match(await page.locator("#importFile").textContent(),/^Converted by Taurifer\b/,
      "the review names Taurifer, not a pasted assistant reply, as the source");
    assert.equal(await page.locator("[data-imp-row]").count(),2);
    assert.equal((await savedProgram(page)).length,0,"no program activated without explicit review");
  });

  await scenario("under an active service worker, the real Turnstile script loads and Import becomes available",{
    serviceWorkers:"allow",stubTurnstile:false,worker:()=>({body:{ok:true,reply:programReply()}})
  },async({page,ctx,sent})=>{
    // The app loads Turnstile from its real URL. This stands in for it, so the request path is the production one:
    // a classic cross-origin script, from a page the release worker controls (the #707 production failure).
    let scriptRequests=0;
    await ctx.route("https://challenges.cloudflare.com/turnstile/v0/api.js*",route=>{
      scriptRequests++;
      return route.fulfill({status:200,contentType:"text/javascript",body:`window.turnstile={
        render(element,options){queueMicrotask(()=>options.callback("sw-token"));return "sw-widget"},
        reset(){},remove(){}};`});
    });
    await waitForAsyncCondition(page,()=>!!navigator.serviceWorker.controller);
    await readyToImport(page);
    assert.equal(scriptRequests,1,"the page fetched the Turnstile script itself");
    assert.equal(await statusText(page),"","no challenge error");
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#importReview.active");
    assert.equal(sent.items[0].token,"sw-token");
  });

  await scenario("reply with a gap → the existing missing-value step, then review",{
    worker:()=>({body:{ok:true,reply:gapReply}})
  },async({page})=>{
    await readyToImport(page);
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#entryFreeformSubmitGaps");
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll("[data-gap-key]")].map(i=>i.dataset.gapKey)),["1::reps"]);
    await page.fill('[data-gap-key="1::reps"]',"10-12");
    await page.click("#entryFreeformSubmitGaps");
    await page.waitForSelector("#importReview.active");
    assert.equal(await page.locator("[data-imp-row]").count(),2);
    assert.equal((await savedProgram(page)).length,0);
  });

  await scenario("gaps are grouped under one heading per day, and the lede says Taurifer converted it",{
    worker:()=>({body:{ok:true,reply:twoDayGapReply}})
  },async({page})=>{
    await readyToImport(page);
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#entryFreeformSubmitGaps");
    const groups=await page.evaluate(()=>[...document.querySelectorAll(".entry__gap-day")].map(group=>({
      day:group.querySelector("legend")?.textContent,
      labels:[...group.querySelectorAll(".entry__field > span")].map(span=>span.textContent),
      keys:[...group.querySelectorAll("[data-gap-key]")].map(input=>input.dataset.gapKey)
    })));
    assert.deepEqual(groups,[
      {day:"TREINO A – Peito (segunda)",labels:["Mergulho no banco reps (e.g. 8-12 or 10)","Elevação lateral sets"],keys:["1::reps","2::sets"]},
      {day:"TREINO B – Costas (terça)",labels:["Barra fixa reps (e.g. 8-12 or 10)"],keys:["3::reps"]}
    ],"one day heading each; labels name only the exercise");
    assert.match(await page.locator("#onbBody .onb__explain").first().textContent(),/^Taurifer converted the program/);
  });

  await scenario("Use all suggestions accepts every Likely top match in one tap; rows stay changeable",{
    worker:()=>({body:{ok:true,reply:vagueReply}})
  },async({page})=>{
    await readyToImport(page);
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#importReview.active");
    const before=await page.evaluate(()=>[...document.querySelectorAll("[data-imp-row]")].map(row=>({
      key:row.dataset.impRow,open:row.classList.contains("is-open"),
      badge:row.querySelector(".impbadge")?.textContent,
      top:row.querySelector('[data-imp-act="pick"][data-imp-idx="0"]')?.textContent.replace(/^Use /,"")||null
    })));
    const likely=before.filter(row=>row.open&&row.badge==="Likely"&&row.top);
    const otherOpen=before.filter(row=>row.open&&!likely.includes(row));
    assert.ok(likely.length>=2,"the fixture opens at least two Likely rows: "+JSON.stringify(before));
    assert.ok(otherOpen.length>=1,"and at least one row that is not Likely: "+JSON.stringify(before));
    const useAll=page.locator("#importUseAll");
    assert.equal(await useAll.isVisible(),true);
    assert.equal(await useAll.textContent(),`Use all suggestions (${likely.length})`);
    await useAll.click();
    await waitForAsyncCondition(page,()=>document.querySelector("#importUseAll")?.hidden!==false);
    const after=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll("[data-imp-row]")].map(row=>[row.dataset.impRow,{
      open:row.classList.contains("is-open"),name:row.querySelector(".improw__name")?.textContent,
      badge:row.querySelector(".impbadge")?.textContent,
      change:!!row.querySelector('[data-imp-act="expand"]')
    }])));
    for(const row of likely)
      assert.deepEqual(after[row.key],{open:false,name:row.top,badge:"Confirmed",change:true},"Likely row takes its top match: "+row.key);
    for(const row of otherOpen)assert.equal(after[row.key].open,true,"a row that was not Likely stays open: "+row.key);
    assert.equal((await savedProgram(page)).length,0,"accepting suggestions activates nothing");
    // A settled row still reopens to its alternatives.
    await page.locator(`[data-imp-row="${likely[0].key}"] [data-imp-act="expand"]`).click();
    await page.waitForSelector(`[data-imp-row="${likely[0].key}"] [data-imp-act="pick"]`);
  });

  for(const [label,reply] of [
    ["prose instead of JSON","I could not find a program in that message."],
    ["JSON without exercises",JSON.stringify({version:3,meta:{name:"x"},exercises:[],missing:[],notImported:[]})]
  ]){
    await scenario(`malformed reply (${label}) → stays on the source with an error and the manual path`,{
      worker:()=>({body:{ok:true,reply}})
    },async({page})=>{
      await readyToImport(page);
      await page.locator("#entryManagedConvert").click();
      await settledWithStatus(page);
      assert.equal(await statusText(page),EN.providerFailed);
      assert.equal(await page.locator("#entryManagedStatus").getAttribute("role"),"alert");
      await stillOnSource(page,source);
      assert.equal(await page.locator("#entryFreeformContinue").isDisabled(),false,"manual handoff stays available");
      await page.waitForSelector("#entryManagedConvert:not([disabled])");
    });
  }

  await scenario("Turnstile expiry disables Import until a fresh token arrives",{
    worker:()=>({body:{ok:true,reply:programReply()}})
  },async({page,sent})=>{
    await readyToImport(page);
    await page.evaluate(()=>window.__ts.options["expired-callback"]());
    await page.waitForSelector("#entryManagedConvert[disabled]");
    await page.evaluate(()=>window.__ts.issue());
    await page.waitForSelector("#entryManagedConvert:not([disabled])");
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#importReview.active");
    assert.equal(sent.items[0].token,"synthetic-token-2","the expired token is never sent");
  });

  await scenario("a failed challenge shows an error and keeps Import disabled",{
    worker:()=>{throw Error("no request expected")}
  },async({page,sent})=>{
    await readyToImport(page);
    await page.evaluate(()=>window.__ts.options["error-callback"]());
    await page.waitForSelector("#entryManagedConvert[disabled]");
    assert.match(await statusText(page),/Verification did not finish/);
    assert.equal(sent.items.length,0);
  });

  for(const [label,opts] of [
    ["config says disabled",{config:{enabled:false,sitekey:null,maxChars:12000}}],
    ["config route serves the app shell",{configRaw:{status:200,contentType:"text/html",body:"<!doctype html><title>Taurifer</title>"}}],
    ["config route fails",{configRaw:{status:503,contentType:"application/json",body:'{"ok":false}'}}]
  ]){
    await scenario(`disabled service (${label}) → only the manual handoff, unchanged`,{
      ...opts,worker:()=>{throw Error("no request expected")}
    },async({page,sent})=>{
      await openFreeform(page);
      await page.locator("#entryFreeformIn").fill(source);
      await waitForAsyncCondition(page,()=>!document.querySelector("#entryFreeformContinue")?.disabled);
      assert.equal(await page.locator("#entryManagedPanel").isHidden(),true);
      assert.equal(await page.locator("#entryFreeformContinue").textContent(),EN.continue);
      assert.equal(await page.locator("#entryFreeformPrivacy").isVisible(),true,"the tab-only note stays when nothing is sent");
      assert.match(await page.locator("#entryFreeformContinue").getAttribute("class"),/btn--cta/);
      assert.equal(await page.evaluate(()=>window.__ts.renders),0,"no challenge loads when the service is off");
      await page.locator("#entryFreeformContinue").click();
      await page.waitForSelector("#entryFreeformCopy");
      assert.equal(sent.items.length,0);
    });
  }

  await scenario("no Worker deployed → the app's own disabled default, no failed request",{
    mockConfig:false,worker:()=>{throw Error("no request expected")}
  },async({page,sent,consoleErrors})=>{
    const probe=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/program-import/config");
    await openFreeform(page);
    const response=await probe;
    assert.equal(response.status(),200,"the app ships a disabled default for the probe");
    assert.deepEqual(await response.json(),{enabled:false,sitekey:null,maxChars:12000});
    await page.locator("#entryFreeformIn").fill(source);
    await page.waitForSelector("#entryFreeformContinue:not([disabled])");
    assert.equal(await page.locator("#entryFreeformContinue").textContent(),EN.continue);
    assert.equal(await page.locator("#entryManagedPanel").isHidden(),true);
    assert.deepEqual(consoleErrors,[],"probing for the service logs no error");
    assert.equal(sent.items.length,0);
  });

  await scenario("rate limit → message, source kept, manual handoff still works",{
    worker:()=>({status:429,body:{ok:false,code:"limit_reached",retryAfter:120}})
  },async({page})=>{
    await readyToImport(page);
    await page.locator("#entryManagedConvert").click();
    await settledWithStatus(page);
    assert.equal(await statusText(page),EN.rateLimited);
    await stillOnSource(page,source);
    await page.locator("#entryFreeformContinue").click();
    await page.waitForSelector("#entryFreeformCopy");
  });

  {
    const gate=deferred();
    await scenario("Back during a request cancels it; the late reply never opens review",{
      worker:async()=>{await gate.promise;return {body:{ok:true,reply:programReply()}}}
    },async({page,sent,failed})=>{
      await readyToImport(page);
      await page.locator("#entryManagedConvert").click();
      await sent.count(1);
      await page.waitForSelector('#entryManagedConvert[aria-busy="true"]');
      await page.locator("#onbBack").click();
      await page.waitForSelector("#entryFreeformIn",{state:"detached"});
      await failed.count(1);
      gate.resolve();
      assert.equal(await page.locator("#importReview.active").count(),0);
      assert.equal((await savedProgram(page)).length,0);
    });
  }

  {
    const gate=deferred();
    await scenario("choosing the manual handoff during a request cancels it",{
      worker:async()=>{await gate.promise;return {body:{ok:true,reply:programReply()}}}
    },async({page,sent,failed})=>{
      await readyToImport(page);
      await page.locator("#entryManagedConvert").click();
      await sent.count(1);
      await page.locator("#entryFreeformContinue").click();
      await page.waitForSelector("#entryFreeformCopy");
      await failed.count(1);
      gate.resolve();
      assert.equal(await page.locator("#importReview.active").count(),0);
      assert.equal(await page.locator("#entryFreeformCopy").count(),1,"the handoff stage stays put");
    });
  }

  {
    const gate=deferred();
    await scenario("editing the source during a request discards the stale reply",{
      worker:async()=>{await gate.promise;return {body:{ok:true,reply:programReply()}}}
    },async({page,sent})=>{
      await readyToImport(page);
      await page.locator("#entryManagedConvert").click();
      await sent.count(1);
      const edited=source+"\nCable row 3x12";
      await page.locator("#entryFreeformIn").fill(edited);
      gate.resolve();
      await page.waitForSelector('#entryManagedConvert[aria-busy="false"]');
      await stillOnSource(page,edited);
      assert.equal(await statusText(page),"","a discarded reply is not an error");
      await page.waitForSelector("#entryManagedConvert:not([disabled])");
    });
  }

  {
    const gate=deferred();
    await scenario("backgrounding during a request → the reply still lands in review",{
      worker:async()=>{await gate.promise;return {body:{ok:true,reply:programReply()}}}
    },async({page,sent})=>{
      await readyToImport(page);
      await page.locator("#entryManagedConvert").click();
      await sent.count(1);
      const setVisibility=state=>page.evaluate(value=>{
        Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>value});
        Object.defineProperty(document,"hidden",{configurable:true,get:()=>value==="hidden"});
        document.dispatchEvent(new Event("visibilitychange"));
      },state);
      await setVisibility("hidden");
      gate.resolve();
      await page.waitForSelector("#importReview.active");
      await setVisibility("visible");
      assert.equal(await page.locator("[data-imp-row]").count(),2);
    });
  }

  await scenario("the OS drops the request while backgrounded → error, source kept, retry with a fresh token",{
    worker:n=>n===1?"abort":{body:{ok:true,reply:programReply()}}
  },async({page,sent})=>{
    await readyToImport(page);
    await page.locator("#entryManagedConvert").click();
    await settledWithStatus(page);
    assert.equal(await statusText(page),EN.failed);
    await stillOnSource(page,source);
    await page.waitForSelector("#entryManagedConvert:not([disabled])");
    await page.locator("#entryManagedConvert").click();
    await page.waitForSelector("#importReview.active");
    assert.notEqual(sent.items[1].token,sent.items[0].token,"a retry uses a fresh challenge token");
  });

  console.log(`program-managed-import: ${passed} passed, ${failures.length} failed`);
  if(failures.length)process.exitCode=1;
}finally{await browser.close()}
