import assert from "node:assert/strict";
import {join} from "node:path";
import {mkdirSync,readFileSync} from "node:fs";
import {loadManifest} from "../tools/ui-screens/manifest.mjs";
import {appState, APP_SCENARIOS} from "../tools/ui-screens/screens-app.mjs";
import {openPage, dismissChrome, seed, settle} from "../tools/ui-screens/session.mjs";
import {waitForAppBoot,openShelfField,answerRecommend} from "./browser.mjs";
import {openActions,finishEarly} from "./fixtures/focus-workout.mjs";
import {openInstalledEditor,applyInstalledEditor} from "./fixtures/installed-editor.mjs";
import {metricLogRow} from "./fixtures/history-metric-rows.mjs";

async function holdDraftWrite(page){
  await page.evaluate(()=>{window.proofLockHeld=false;window.proofLock=navigator.locks.request("repforge:draft-write",()=>{window.proofLockHeld=true;return new Promise(resolve=>window.proofRelease=resolve)})});
  await page.waitForFunction(()=>window.proofLockHeld);
}
async function releaseDraftWrite(page){await page.evaluate(async()=>{window.proofRelease();await window.proofLock;await window.__repforgeWorkoutDraft.flush()})}
async function saveCurrentSet(page,id){
  for(const [metric,value] of [["2555c6f170d8805cafa6d16d3fdddbaa",40],["2555c6f170d88072bbf6d9ad3f16ea86",8]]){
    const input=page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metric}"]`);
    if(await input.getAttribute("aria-hidden")==="true")await openShelfField(page,`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metric}"]`);
    await input.fill(String(value));await page.evaluate(()=>window.__repforgeWorkoutDraft.flush());
  }
  await page.locator(`#workout .exercise.is-current [data-save="${id}_1"]`).click();
  await page.waitForFunction(id=>Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets).some(set=>set.completion!=="pending"),id);
}

async function runRoundTwoCases(browser,manifest){
  const failures=[];
  const check=async(name,proof)=>{try{await proof();console.log(`PASS round 2: ${name}`)}catch(error){failures.push(new Error(`${name}: ${error.message}`,{cause:error}))}};
  for(const kind of ["repeat","restored-later-start","future-start"]){
    await check(kind,async()=>{
      const state=appState("progress/review-active","en");
      if(kind==="repeat")state.programMeta.mesocycleStatus="completed";
      else state.programMeta.started=kind==="future-start"?"2026-09-07":"2026-08-31";
      if(kind==="future-start")state.log=state.log.filter(row=>["weekly-2","weekly-second"].includes(row.session)).map(row=>({...row,date:"2026-08-31"}));
      const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
      try{
        await dismissChrome(page);await APP_SCENARIOS["progress/review-active"](page);
        if(kind==="repeat"){
          const block=state.programMeta.blockId;
          await page.locator('[data-review-action="repeat"]').click();
          await page.waitForFunction(block=>window.__repforgeWorkoutDraft.state().programMeta.blockId!==block,block);
          await page.evaluate(()=>window.__repforgeStorage.flush());
          await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
          await APP_SCENARIOS["progress/review-active"](page);
          const retained=await page.evaluate(()=>({log:window.__repforgeWorkoutDraft.state().log,events:window.__repforgeWorkoutDraft.state().sessionEvents}));
          assert.deepEqual(retained.log,state.log,"Repeat retains every session row");
          assert.deepEqual(retained.events,state.sessionEvents,"Repeat retains historical observations");
        }
        if(kind!=="future-start"){
          assert.equal(await page.locator('[data-week-review="last"]').count(),1,"retained sessions establish that last week existed");
          const last=await page.locator('[data-week-review="last"]').innerText();
          assert.match(last,/2 sessions completed\./);
          assert.doesNotMatch(last,/not completed:/);
          for(const event of Object.values(state.sessionEvents).flatMap(record=>[...record.pain,...record.skips]))assert.ok(last.includes(event.name),"retained observations remain visible");
        }else assert.match(await page.locator('[data-week-review="current"]').innerText(),/2 of 3 sessions/);
        await page.locator('nav [data-view="log"]').click();
        if(kind==="future-start")assert.match(await page.locator(".ov-week-line").innerText(),/2 of 3 sessions/);
        else assert.match(await page.locator("#todayWeekCard").innerText(),/2 sessions completed\./,"retained last week also keeps its sessions-only Today card");
      }finally{await context.close()}
    });
  }
  for(const action of ["retry","cancel"]){
    await check(`frozen reason ${action}`,async()=>{
      const state=appState("workout/discomfort-mark","en");state.log=[];delete state.sessionEvents;
      const {page,context}=await openPage(browser,manifest,{flow:"workout",screen:"discomfort-mark",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
      try{
        await dismissChrome(page);await APP_SCENARIOS["workout/focus"](page);
        await page.evaluate(()=>{
          window.reasonEvents=[];localStorage.setItem("repforge_telemetry_enabled_v1","true");
          window.RepForgeTelemetry.boot({adapter:{capture:(name,properties)=>{if(name==="substitution_used")window.reasonEvents.push(properties)},setEnabled(){}},storage:localStorage});
        });
        const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex"),original=state.program.find(ex=>ex.id===id),replacement=state.program.find(ex=>ex.id!==id);
        await openActions(page,id);await page.locator("#exActionSubstBtn").click();
        await page.locator(`#exPickList [data-pick="${replacement.libraryId}"]`).click();
        await page.locator('[data-pick-reason="pain"]').waitFor({state:"visible"});
        await page.evaluate(()=>localStorage.setItem("repforge_install_transfer_freeze_v1",JSON.stringify({version:1,owner:"another-tab",createdAt:new Date().toISOString()})));
        await page.locator('[data-pick-reason="pain"]').click();
        await page.evaluate(()=>window.__repforgeWorkoutDraft.flush());
        assert.equal(await page.locator("#exPickSheet").isVisible(),true,"refused Pain stays open for retry or cancel");
        assert.match(await page.locator(".pick__followup-done").innerText(),/not.*saved|could not be saved/i,"refusal visibly says the answer is unsaved");
        assert.equal(await page.locator('[data-pick-reason="pain"]').isEnabled(),true,"refused reason can be retried");
        assert.deepEqual(await page.evaluate(()=>window.reasonEvents),[],"refusal emits no unsaved reason");
        await page.evaluate(()=>localStorage.removeItem("repforge_install_transfer_freeze_v1"));
        await page.locator(action==="retry"?'[data-pick-reason="pain"]':"#exPickCancel").click();
        await page.locator("#exPickSheet").waitFor({state:"hidden"});
        const exercise=await page.evaluate(id=>window.__repforgeWorkoutDraft.current().exercises[id],id);
        const events=await page.evaluate(()=>window.reasonEvents.map(({source,reason})=>({source,...(reason?{reason}:{})})));
        assert.deepEqual(events,[{source:"library",...(action==="retry"?{reason:"pain"}:{})}],"exactly one event describes the acknowledged swap");
        if(action==="retry"){
          assert.equal(exercise.swapReason,"pain");assert.equal(exercise.discomfort.length,1);
          assert.equal(exercise.discomfort[0].exerciseId,original.libraryId);assert.equal(exercise.discomfort[0].kind,"pain");
          await saveCurrentSet(page,id);await finishEarly(page);
          const pain=await page.evaluate(()=>Object.values(window.__repforgeWorkoutDraft.state().sessionEvents)[0].pain);
          assert.equal(pain.length,1);assert.equal(pain[0].exerciseId,original.libraryId);
          assert.equal(await page.evaluate(()=>window.reasonEvents.length),1,"saving does not emit the swap again");
        }else{assert.equal(exercise.swapReason,undefined);assert.equal(exercise.discomfort,undefined)}
      }finally{await context.close()}
    });
  }
  await check("single skip separators",async()=>{
    const {page,context}=await openPage(browser,manifest,{flow:"workout",screen:"skip-reason",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},appState("workout/skip-reason","en"));
    try{
      await dismissChrome(page);await APP_SCENARIOS["workout/focus"](page);
      const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");await openActions(page,id);
      const bottom=await page.locator("#exActionSkipBtn").evaluate(el=>parseFloat(getComputedStyle(el).borderBottomWidth));
      await page.locator("#exActionSkipBtn").click();await page.locator('[data-skip-reason="time"]').waitFor({state:"visible"});
      const borders=await page.locator("#skipReasonChoices button").evaluateAll(rows=>rows.map(row=>{const s=getComputedStyle(row);return{top:parseFloat(s.borderTopWidth),bottom:parseFloat(s.borderBottomWidth)}}));
      assert.ok(borders.every(row=>row.top===0&&row.bottom===bottom),"skip rows use the same single bottom border as exercise actions");
    }finally{await context.close()}
  });
  if(failures.length)throw new AggregateError(failures,"round 2 regression proofs failed");
}

async function runRoundThreeCases(browser,manifest){
  const failures=[];
  const check=async(name,proof)=>{try{await proof();console.log(`PASS round 3: ${name}`)}catch(error){failures.push(new Error(`${name}: ${error.message}`,{cause:error}))}};
  const capture=locale=>({flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale,text:"normal",motion:"normal"});
  async function verifyHistory(page,state,summary,hasTarget){
    await page.locator('nav [data-view="stats"]').click();await page.locator('#statsSeg [data-seg="review"]').click();
    const last=page.locator('#stats [data-week-review="last"]');
    assert.equal(await last.locator("p").first().innerText(),summary,"historical count uses only an established full-week target");
    const text=await last.innerText();
    if(hasTarget)assert.match(text,/Training days not completed: Day 3\./);
    else assert.doesNotMatch(text,/not completed:|não concluídos:/,"unknown historical targets produce no missed days");
    for(const event of Object.values(state.sessionEvents).flatMap(record=>[...record.pain,...record.skips]))assert.ok(text.includes(event.name),"historical observations remain visible");
    await page.locator('nav [data-view="log"]').click();
    assert.equal(await page.locator("#todayWeekCard p").nth(1).innerText(),summary,"Today card uses exactly the same historical summary");
  }
  await check("activate a new four-day program over retained history",async()=>{
    const state=appState("progress/review-active","en");state.program=[];state.programMeta={onboarded:false};
    const {page,context}=await openPage(browser,manifest,capture("en"),state);
    try{
      await dismissChrome(page);await page.locator("#todaySetupProgram").click();
      await answerRecommend(page,{skipBasics:true,days:4});await page.locator("#entryActivate").click();
      await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.onboarded===true);
      await page.evaluate(()=>window.__repforgeStorage.flush());
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.programDefinition.days.filter(day=>day.kind==="training").length),4);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().log.length),state.log.length);
      await verifyHistory(page,state,"2 sessions completed.",false);
      await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      await verifyHistory(page,state,"2 sessions completed.",false);
    }finally{await context.close()}
  });
  for(const locale of ["en","pt"])for(const done of [1,2]){
    await check(`${locale} historical ${done}-session grammar`,async()=>{
      const state=appState("progress/review-active",locale);state.programMeta.started="2026-08-31";
      state.log=state.log.filter(row=>(done===1?["weekly-2"]:["weekly-2","weekly-second"]).includes(row.session));
      const {page,context}=await openPage(browser,manifest,capture(locale),state);
      try{
        await dismissChrome(page);
        const summary=locale==="pt"?(done===1?"1 sessão concluída.":"2 sessões concluídas."):(done===1?"1 session completed.":"2 sessions completed.");
        await verifyHistory(page,state,summary,false);
      }finally{await context.close()}
    });
  }
  for(const kind of ["mid-week","full-week"]){
    await check(kind,async()=>{
      const state=appState("progress/review-active","en");state.programMeta.started=kind==="mid-week"?"2026-08-26":"2026-08-24";
      const {page,context}=await openPage(browser,manifest,capture("en"),state);
      try{await dismissChrome(page);await verifyHistory(page,state,kind==="mid-week"?"2 sessions completed.":"2 of 3 sessions completed.",kind==="full-week")}
      finally{await context.close()}
    });
  }
  if(failures.length)throw new AggregateError(failures,"round 3 regression proofs failed");
}

async function runRoundFourCases(browser,manifest){
  const failures=[];
  for(const locale of ["en","pt"])for(const kind of ["some","none"]){
    const state=appState("today/week-card",locale),stall=state.program.filter(ex=>ex.day==="Day 1")[1];
    if(kind==="some")state.log=state.log.filter(row=>row.exerciseId!==stall.id||row.date>="2026-08-24");
    else{state.log=state.log.filter(row=>row.session==="weekly-2");delete state.sessionEvents}
    const {page,context}=await openPage(browser,manifest,{flow:"today",screen:"week-card",viewport:"phone-390",theme:"light",locale,text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["today/week-card"](page);
      const card=page.locator("#todayWeekCard"),paragraphs=card.locator("p");
      if(kind==="some")assert.equal(await paragraphs.nth(2).innerText(),locale==="pt"?"Melhoraram: 1. Dor ou desconforto: 1.":"Moved up: 1. Pain or discomfort: 1.","zero stalled count is absent while nonzero facts retain their order");
      else assert.equal(await paragraphs.count(),2,"all-zero facts omit the entire facts paragraph");
      console.log(`PASS round 4: ${locale} ${kind} nonzero facts`);
    }catch(error){failures.push(new Error(`${locale} ${kind}: ${error.message}`,{cause:error}))}
    finally{await context.close()}
  }
  for(const key of ["workout/exercise-actions","workout/warmup-actions","workout/skipped-actions","workout/substituted-actions"]){
    const {page,context}=await openPage(browser,manifest,{flow:"workout",screen:key.split("/")[1],viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},appState(key,"en"));
    try{
      await dismissChrome(page);await APP_SCENARIOS[key](page);
      await page.locator("#exActionsSheet").waitFor({state:"visible"});
      assert.equal(await page.locator("#exActionsSheet").isVisible(),true);
      assert.equal(await page.locator("#exActionsSheet .exactions-sheet__body").evaluate(body=>body.scrollTop),0,"capture resets the exercise-actions body despite the separate skip sheet");
      console.log(`PASS round 4: ${key} capture scenario`);
    }catch(error){failures.push(new Error(`${key}: ${error.message}`,{cause:error}))}
    finally{await context.close()}
  }
  if(failures.length)throw new AggregateError(failures,"round 4 zero-count proofs failed");
}

async function runCatalogWeekCardCases(browser,manifest){
  for(const [key,now,seen] of [["today/ready",undefined,"2026-W36"],["today/ready","2027-01-01T12:00:00Z","2026-W53"],["today/week-card",undefined,undefined]]){
    const [flow,screen]=key.split("/"),capture={flow,screen,viewport:"phone-390",theme:"dark",locale:"en",text:"normal",motion:"normal"};
    const {page,context}=await openPage(browser,manifest,capture,appState(key,"en"),{catalog:true,now});
    try{
      await dismissChrome(page);await APP_SCENARIOS[key](page);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_ui_v1")).weekCardSeen),seen,"catalog seeds only ordinary states as seen for their pinned ISO week");
      assert.equal(await page.locator("#todayWeekCard:not(.hidden)").count(),seen?0:1,"the dedicated card state remains visible");
      await seed(page,appState(key,"en"));await dismissChrome(page);
      assert.equal(await page.locator("#todayWeekCard:not(.hidden)").count(),seen?0:1,"catalog preferences survive scenario reseeding and reload");
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_ui_v1")).theme),"dark","theme updates retain fixture preferences");
      console.log(`PASS catalog week card: ${key} ${now||"default clock"}`);
    }finally{await context.close()}
  }
}

async function runAdaptationCases(browser,manifest){
  const failures=[];
  for(const followups of [2,1]){
    const state=appState("progress/review-proposal","en"),lifts=state.program.filter(row=>row.day==="Day 1").slice(0,2),target=lifts[0];
    const dates=followups===2?["2026-08-20","2026-08-25","2026-08-28"]:["2026-08-20","2026-08-21","2026-08-25"];
    state.log=dates.flatMap((date,index)=>lifts.map(exercise=>metricLogRow(state.programMeta,exercise,{
      session:`fatigue-${index}`,date,created:`${date}T12:00:00.000Z`,day:"Day 1",set:1,load:60,reps:12-index*2,rir:1})));
    state.sessionEvents={};
    for(const day of state.programMeta.programDefinition.days)for(const slot of day.slots)for(const cycle of slot.prescriptionsByCycle)for(const set of cycle.sets){
      set.rir=1;set.status="ready";set.provenance={source:"manual",policyVersion:"manual-adaptive@1"};
    }
    const instant="2026-08-24T12:00:00.000Z";
    state.programMeta.adaptations=[{id:"fatigue-followup",v:1,blockId:state.programMeta.blockId,week:"2026-08-24",pattern:"recurring_fatigue",cause:"recovery",kind:"reduce_sets",
      target:{slotId:target.id,exerciseId:target.libraryId,setsDelta:-1},proposedAt:instant,decision:"accepted",decidedAt:instant,
      appliedEdit:{expectedToken:{revision:1,programId:state.programMeta.id,blockId:state.programMeta.blockId,fingerprint:"before-reduction"},intent:"adaptation_apply"}}];
    const expected=followups===2?"pattern_continued":"pattern_stopped";
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-proposal",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-active"](page);
      await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation.outcome),expected,"fatigue comparisons retain the baseline while only post-approval sessions count");
      await page.evaluate(()=>window.__repforgeStorage.flush());await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      await APP_SCENARIOS["progress/review-active"](page);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation.outcome),expected,"fatigue evaluation survives the production loader");
      assert.match(await page.locator('[data-adaptation-evaluation]').innerText(),followups===2?/the pattern continued/:/no recurring pattern was detected/);
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  {
    const state=appState("progress/review-evaluated","en");state.programMeta.mesocycleStatus="completed";
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-evaluated",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-active"](page);
      const before=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
      await page.locator('[data-review-action="repeat"]').click();
      await page.waitForFunction(block=>window.__repforgeWorkoutDraft.state().programMeta.blockId!==block,before.programMeta.blockId);
      await page.evaluate(()=>window.__repforgeStorage.flush());await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      const after=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
      assert.deepEqual(after.programMeta.adaptations,before.programMeta.adaptations,"Repeat retains the full approval and evaluation record");
      assert.equal(after.programMeta.id,before.programMeta.id);assert.notEqual(after.programMeta.blockId,before.programMeta.blockId);
      assert.deepEqual(after.programMeta.programDefinition,before.programMeta.programDefinition,"Repeat retains the adapted prescription");
      const record=before.programMeta.adaptations[0];
      assert.equal(await page.evaluate(({record,blockId})=>RepForgeProgramTransition.adaptationEligible(window.__repforgeWorkoutDraft.state().programMeta.adaptations,
        {pattern:record.pattern,slotId:record.target.slotId,exerciseId:record.target.exerciseId},blockId,record.week),{record,blockId:after.programMeta.blockId}),true,"retained old-block receipts do not suppress a new block's proposal");
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  {
    const state=appState("progress/review-evaluated","en");
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-evaluated",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-evaluated"](page);
      const evaluation=await page.locator('[data-adaptation-evaluation]').innerText();
      assert.match(evaluation,/removed/i,"the evaluation identifies the accepted change as well as its outcome");
      assert.ok(evaluation.includes(state.sessionEvents["weekly-1"].skips[0].name),"the evaluation keeps the captured name of the removed lift");
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  {
    const state=appState("progress/review-proposal","en");
    state.log=state.log.filter(row=>row.session!=="weekly-stall");
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-proposal",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-proposal"](page);
      assert.equal(await page.locator('[data-adaptation-why]').count(),1,"the existing three-session hard-set stall remains visible when its first exposure precedes the two-week event window");
      await page.evaluate(()=>{
        window.weeklyObservedEvents=[];
        const telemetry=window.RepForgeTelemetry;
        window.RepForgeTelemetry={...telemetry,capture(name,properties){window.weeklyObservedEvents.push(name);return telemetry.capture(name,properties)}};
      });
      await page.locator('[data-adaptation-why]').click();await page.locator("#whySheet").waitFor({state:"visible"});
      assert.deepEqual(await page.evaluate(()=>window.weeklyObservedEvents),[],"the alpha review's Why reader does not claim a Focus telemetry interaction");
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  {
    const state=appState("progress/review-proposal","en");
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-proposal",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-proposal"](page);
      const sibling=await context.newPage();await sibling.goto(page.url(),{waitUntil:"domcontentloaded"});await waitForAppBoot(sibling);
      await openInstalledEditor(sibling);
      await sibling.locator('#programEditor [data-role="program-name-edit"]').click();
      await sibling.locator('#reviewSheet [data-role="rename-input"]').fill("Concurrent edit");
      await sibling.locator('#reviewSheet [data-role="rename-save"]').click();
      await sibling.locator('#reviewSheet').waitFor({state:"hidden"});await applyInstalledEditor(sibling);
      assert.equal(await sibling.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.name),"Concurrent edit","the sibling editor committed its rename before the stale proposal is tapped");
      await page.locator('[data-adaptation-action="accept"]').click();
      await page.locator('[data-adaptation-card] [role="alert"]').waitFor({state:"visible"});
      assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations||[]),[],"a concurrent editor commit refuses the adaptation and its receipt together");
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.name),"Concurrent edit","the other tab's program edit survives");
      await page.locator('#statsSeg [data-seg="review"]').click();
      await page.locator('[data-adaptation-cause="equipment"]').click();
      await page.locator('[data-adaptation-action="accept"]').click();
      await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations?.length===1);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.name),"Concurrent edit","reopening Review proposes against the new editor token");
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  for(const timing of ["after","before"]){
    const state=appState("progress/review-evaluated","en"),record=state.programMeta.adaptations[0];
    delete record.evaluation;
    state.sessionEvents["weekly-second"]={v:1,skips:[structuredClone(state.sessionEvents["weekly-2"].skips[0])],pain:[]};
    if(timing==="before")state.log=state.log.map(row=>["weekly-2","weekly-second"].includes(row.session)
      ?{...row,date:record.week,created:`${record.week}T09:00:00.000Z`}:row);
    const expected=timing==="after"?"pattern_continued":"insufficient";
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-evaluated",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-evaluated"](page);
      await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation.outcome),expected,"evaluation uses post-approval observations of the captured lift, including a removed slot");
      await page.evaluate(()=>window.__repforgeStorage.flush());
      await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation.outcome),expected,"the evaluated receipt survives the actual loader");
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  for(const action of ["accept","decline","later","change"]){
    const state=appState("progress/review-active","en");
    state.programMeta.blockId="weekly-adaptation-block";
    state.log=state.log.map(row=>({...row,blockId:state.programMeta.blockId}));
    const skipped=state.program.filter(exercise=>exercise.day==="Day 1")[2];
    const slot=state.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===skipped.id);
    slot.alternates=[state.program[0].libraryId];
    state.sessionEvents["weekly-1"]={v:1,skips:[{exerciseId:skipped.libraryId,slotId:skipped.id,name:skipped.name,reason:"equipment"}],pain:[]};
    const capture={flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"};
    const {page,context}=await openPage(browser,manifest,capture,state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-active"](page);
      const card=page.locator('[data-adaptation-card]');
      await card.waitFor({state:"visible"});
      const before=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
      await page.locator('[data-adaptation-cause="equipment"]').click();
      assert.equal((await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations||[])).length,0,"view and why choice never write a program change");
      assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().program),before.program,"choosing a cause never edits the active program");
      assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.programDefinition),before.programMeta.programDefinition);
      await page.locator(`[data-adaptation-action="${action}"]`).click();
      if(action==="change"){
        await page.locator('#programEditor').waitFor({state:"visible"});
        await page.locator(`#reviewSheet [data-pe-sheet="exercise"][data-id="${skipped.id}"]`).waitFor({state:"visible"});
        assert.equal((await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations||[])).length,0,"Change only opens the ordinary editor");
      }else{
        await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations?.length===1);
        await page.evaluate(()=>window.__repforgeStorage.flush());
        const saved=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
        const record=saved.programMeta.adaptations[0];
        assert.equal(await page.evaluate(()=>document.activeElement!==document.body&&document.activeElement?.isConnected&&!document.activeElement.closest('[hidden],.hidden')),true,"a completed decision returns focus to the live Review");
        assert.equal(record.decision,{accept:"accepted",decline:"declined",later:"snoozed"}[action]);
        assert.deepEqual(saved.log,before.log,"decisions never alter historical loads");
        if(action==="accept"){
          assert.equal(record.appliedEdit.intent,"adaptation_apply");
          assert.equal(saved.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===skipped.id).exerciseId,slot.alternates[0]);
          assert.ok(saved._storageRevision>before._storageRevision,"editor commit bumps durable token");
        }else assert.deepEqual(saved.program,before.program,"decline and snooze do not edit the program");
        await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
        await APP_SCENARIOS["progress/review-active"](page);
        assert.equal(await page.locator('[data-adaptation-card]').count(),0,"decision survives reload and suppresses this week's second proposal");
        assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations),saved.programMeta.adaptations,"normalization retains the complete receipt");
        if(action==="accept"){
          await page.evaluate(()=>window.__repforgeShowSettings());
          await page.locator("#dataBackupRow").click();
          const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#exportJson").click()]);
          const backup=JSON.parse(readFileSync(await download.path(),"utf8"));
          assert.deepEqual(backup.programMeta.adaptations,saved.programMeta.adaptations,"the actual backup exporter carries the receipt");
          await page.evaluate(()=>window.__repforgeShowSettings());await page.locator("#dataImportRow").click();
          await page.locator("#importJson").setInputFiles({name:"weekly-change.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))});
          await page.locator("#importChoice").waitFor({state:"visible"});await page.locator("#importReplace").click();
          await page.locator("#importChoice").waitFor({state:"hidden"});await page.evaluate(()=>window.__repforgeStorage.flush());
          await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
          assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations),saved.programMeta.adaptations,"the production backup importer and reload preserve the receipt");
          await page.clock.setFixedTime(new Date("2026-09-07T12:00:00Z"));
          await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
          await APP_SCENARIOS["progress/review-active"](page);
          await page.waitForFunction(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation);
          assert.equal(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.adaptations[0].evaluation.outcome),"insufficient","an unobserved following week is not called a success");
          assert.match(await page.locator('[data-adaptation-evaluation]').innerText(),/not enough sessions/);
        }
      }
    }catch(error){failures.push(error)}finally{await context.close()}
  }
  if(failures.length)throw new AggregateError(failures,"weekly adaptation proofs failed");
  console.log("PASS weekly adaptation browser: four actions, explicit approval, editor token, historical loads, durable receipt and reload suppression");
}

async function runImmediatePainCases(browser,manifest){
  const machine="1a25c6f170d88079a926dde776766181",dumbbell="1a25c6f170d880708256e9a8bf6337bf";
  let passed=0;
  for(const kind of ["second-mark","first-mark","other-slot","other-movement","cleared","no-alternates","dismiss-during-write"]){
    const state=appState("workout/discomfort-mark","en"),original=state.program[0];
    const slot=state.programMeta.programDefinition.days.flatMap(day=>day.slots).find(slot=>slot.id===original.id);
    slot.alternates=kind==="no-alternates"?[]:[machine,dumbbell];
    const date="2026-08-28",session="pain-path-prior";
    state.log=[metricLogRow(state.programMeta,original,{session,date,day:original.day,set:1,load:40,reps:8,rir:2,created:`${date}T12:00:00.000Z`})];
    state.sessionEvents={[session]:{v:1,skips:[],pain:kind==="first-mark"||kind==="cleared"?[]:[{
      slotId:kind==="other-slot"?state.program[1].id:original.id,
      exerciseId:kind==="other-movement"?machine:original.libraryId,name:original.name,kind:"pain",swapped:false,
    }]}};
    const {page,context}=await openPage(browser,manifest,{flow:"workout",screen:"discomfort-mark",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["workout/focus"](page);
      const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
      assert.equal(id,original.id);
      const before=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
      await openActions(page,id);
      if(kind==="dismiss-during-write")await holdDraftWrite(page);
      await page.locator("#exActionDiscomfortBtn").click();
      if(kind==="dismiss-during-write"){
        await page.locator("#exActionsClose").click();
        await page.locator("#exActionsSheet").waitFor({state:"hidden"});await releaseDraftWrite(page);
        assert.equal(await page.locator("#exPickSheet").isVisible(),false,"a delayed write cannot reopen a dismissed flow");
      }else if(["second-mark","no-alternates"].includes(kind)){
        await page.locator("#exPickSheet").waitFor({state:"visible"});
        assert.equal(await page.locator("#exActionsSheet").isVisible(),false,"the picker replaces the actions sheet");
        const draft=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.current()));
        assert.equal(draft.exercises[id].discomfort.length,1);
        assert.equal(draft.exercises[id].substitution,undefined,"opening the path does not swap");
        assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state()),before,"opening never writes a program or proposal");
        if(kind==="second-mark"){
          assert.deepEqual((await page.locator("#exPickList [data-pick]").evaluateAll(rows=>rows.slice(0,2).map(row=>row.dataset.pick))),[dumbbell,machine],"different equipment class leads, same-class alternate stays reachable");
        }else assert.ok(await page.locator("#exPickList [data-pick]").count()>0,"no alternates still offers the ordinary library");
        await page.locator("#exPickCancel").click();await page.locator("#exPickSheet").waitFor({state:"hidden"});
        assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.current()),draft,"dismissal keeps the acknowledged mark and changes nothing else");
        await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
        assert.equal(await page.locator("#exPickSheet").isVisible(),false,"reload never repeats the opening");
        assert.equal(await page.evaluate(id=>window.__repforgeWorkoutDraft.current().exercises[id].discomfort.length,id),1);
        if(kind==="second-mark"){
          await APP_SCENARIOS["workout/focus"](page);await openActions(page,id);
          await page.locator("#exActionSubstBtn").click();
          assert.deepEqual((await page.locator("#exPickList [data-pick]").evaluateAll(rows=>rows.slice(0,2).map(row=>row.dataset.pick))),[machine,dumbbell],"ordinary swaps retain authored alternate order");
          await page.locator(`#exPickList [data-pick="${machine}"]`).click();await page.locator("#exPickReasonSkip").click();
          assert.equal(await page.evaluate(id=>window.__repforgeWorkoutDraft.current().exercises[id].substitution.replacement.libraryId,id),machine,"only a pick changes the session movement");
          assert.deepEqual(await page.evaluate(()=>window.__repforgeWorkoutDraft.state().programMeta.programDefinition),before.programMeta.programDefinition,"a session swap never edits the program");
        }
      }else{
        await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="true");
        assert.equal(await page.locator("#exPickSheet").isVisible(),false,`${kind} is not a second marked session on this movement and slot`);
        if(kind==="cleared"){
          await page.locator("#exActionDiscomfortBtn").click();
          await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="false");
          await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
          await APP_SCENARIOS["workout/focus"](page);await openActions(page,id);await page.locator("#exActionDiscomfortBtn").click();
          await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="true");
          assert.equal(await page.locator("#exPickSheet").isVisible(),false,"a cleared mark and re-mark are still one session");
        }
      }
      passed++;console.log(`PASS immediate pain: ${kind}`);
    }finally{await context.close()}
  }
  console.log(`PASS immediate pain: ${passed} browser cases`);
}

export async function runWeekReviewBrowser(browser) {
  const manifest=loadManifest();
  await runImmediatePainCases(browser,manifest);
  await runAdaptationCases(browser,manifest);
  await runCatalogWeekCardCases(browser,manifest);
  await runRoundFourCases(browser,manifest);
  await runRoundThreeCases(browser,manifest);
  await runRoundTwoCases(browser,manifest);
  for(const kind of ["first-week","empty-day","cross-block"]){
    const state=appState("progress/review-active","en");
    if(kind==="first-week"){state.programMeta.started="2026-08-31";state.log=[];delete state.sessionEvents}
    if(kind==="empty-day"){
      const day=state.programMeta.programDefinition.days.find(day=>day.name==="Day 3");day.slots=[];
      state.program=state.program.filter(exercise=>exercise.day!=="Day 3");
    }
    if(kind==="cross-block"){
      state.programMeta.blockId="current-block";state.programMeta.started="2026-08-31";
      state.log=state.log.filter(row=>["weekly-2","weekly-second"].includes(row.session)).map((row,index)=>({...row,date:"2026-08-31",blockId:row.session==="weekly-2"?"previous-block":state.programMeta.blockId}));
    }
    const {page,context}=await openPage(browser,manifest,{flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"},state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["progress/review-active"](page);
      const last=page.locator('[data-week-review="last"]'),current=page.locator('[data-week-review="current"]');
      if(kind==="first-week")assert.equal(await last.count(),0,"B1: no invented pre-activation week");
      else assert.match(await (kind==="cross-block"?current:last).innerText(),/2 of 3 sessions/,`B4: ${kind} uses Today's calendar inventory`);
      assert.doesNotMatch(await current.innerText(),/not completed:/,"unfinished current week says nothing about missed days");
      if(kind!=="first-week"){
        await page.locator('nav [data-view="log"]').click();
        assert.match(await page.locator(".ov-week-line").innerText(),kind==="cross-block"?/2 of 3 sessions/:/0 of 3 sessions/,"Today uses the same calendar count and authored days");
        if(kind==="empty-day")assert.match(await page.locator("#todayWeekCard").innerText(),/2 of 3 sessions/,"last week matches Today card too");
      }
    }finally{await context.close()}
  }
  for (const locale of ["en","pt"]) {
    const capture={flow:"progress",screen:"review-active",viewport:"phone-390",theme:"light",locale,text:"normal",motion:"normal"};
    const opened=await openPage(browser,manifest,capture,appState("progress/review-active",locale));
    const {page,context}=opened;
    try {
      await dismissChrome(page);
      await APP_SCENARIOS["progress/review-active"](page);
      assert.equal(await page.locator('[data-week-review="last"]').count(),1,"active Review states last week's facts");
      const last=await page.locator('[data-week-review="last"]').innerText();
      assert.match(last,locale==="pt"?/2 de 3 sessões/:/2 of 3 sessions/);
      assert.match(last,/Day 3|Dia 3/);
      assert.match(last,locale==="pt"?/Melhoraram:/:/Moved up:/);
      assert.match(last,locale==="pt"?/Sem avanço/:/Stalled/);
      assert.match(last,locale==="pt"?/Desconforto/:/Discomfort/);
      assert.match(last,locale==="pt"?/Tempo/:/Time/);
      assert.equal(await page.locator('[data-week-review="current"]').count(),1);
      assert.equal(await page.locator('[data-review-action]').count(),0,"facts alone offer no structural action in an active block");
      assert.equal(await page.locator('.review__readonly').count(),0);
      if(locale==="pt"&&process.env.REPFORGE_ARTIFACT_DIR)await page.screenshot({path:join(process.env.REPFORGE_ARTIFACT_DIR,"weekly-review.png"),fullPage:true});
      await page.locator('nav [data-view="log"]').click();
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),1,"a nonempty last week offers its card");
      await page.locator('#weekCardReview').click();
      assert.equal(await page.locator('#stats.view.active [data-week-review="last"]').count(),1,"card opens Review");
      await page.locator('nav [data-view="log"]').click();
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0,"Review retires the card too");
      await page.evaluate(()=>window.__repforgeUi.setPref("weekCardSeen",null));
      await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      await page.locator('#weekCardDismiss').click();
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0);
      assert.match(await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_ui_v1")).weekCardSeen),/^\d{4}-W\d{2}$/);
      await page.reload({waitUntil:"domcontentloaded"}); await waitForAppBoot(page);
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0,"dismissal survives reload");
      await page.clock.setFixedTime(new Date("2026-09-07T12:00:00Z"));
      await page.reload({waitUntil:"domcontentloaded"}); await waitForAppBoot(page);
      assert.equal(await page.locator('#todayWeekCard:not(.hidden)').count(),0,"an empty week never gets a card");
    } finally {await context.close();}
  }
  {
    const capture={flow:"workout",screen:"discomfort-mark",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"};
    const {page,context}=await openPage(browser,manifest,capture,appState("workout/discomfort-mark","en"));
    try {
      await dismissChrome(page);await APP_SCENARIOS["workout/focus"](page);
      const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
      const replacement=appState("workout/discomfort-mark","en").program.find(exercise=>exercise.id!==id).libraryId;
      await page.locator("#woOverflowBtn").click();await page.locator('[data-workout-action="exercise"]').click();
      await page.locator("#exActionSubstBtn").click();
      await page.locator(`#exPickList [data-pick="${replacement}"]`).click();
      await page.locator('[data-pick-reason="pain"]').click();
      await page.waitForFunction(id=>window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.swapReason==="pain",id);
      const marked=await page.evaluate(id=>window.__repforgeWorkoutDraft.current().exercises[id],id);
      assert.equal(marked.discomfort[0].kind,"pain");assert.equal(marked.discomfort[0].swapped,true,"picker reason reaches the acknowledged substitution");
      await page.reload({waitUntil:"domcontentloaded"});await waitForAppBoot(page);
      assert.equal(await page.evaluate(id=>window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.swapReason,id),"pain","picker mark survives recovery");
    } finally {await context.close();}
  }
  for(const sequence of ["pain-restore","pain-and-discomfort","replacement-discomfort"]){
    const state=appState("workout/discomfort-mark","en");state.log=[];delete state.sessionEvents;
    const capture={flow:"workout",screen:"discomfort-mark",viewport:"phone-390",theme:"light",locale:"en",text:"normal",motion:"normal"};
    const {page,context}=await openPage(browser,manifest,capture,state);
    try{
      await dismissChrome(page);await APP_SCENARIOS["workout/focus"](page);
      const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
      const original=state.program.find(exercise=>exercise.id===id),replacement=state.program.find(exercise=>exercise.id!==id),skipped=state.program[2];
      await openActions(page,id);await page.locator("#exActionSubstBtn").click();
      const replacementLabel=await page.locator(`#exPickList [data-pick="${replacement.libraryId}"] .pickrow__name`).innerText();
      await page.locator(`#exPickList [data-pick="${replacement.libraryId}"]`).click();
      if(sequence==="pain-and-discomfort"){
        await page.locator('[data-pick-reason="pain"]').waitFor({state:"visible"});
        await holdDraftWrite(page);await page.locator('[data-pick-reason="pain"]').click();
        await page.waitForFunction(()=>[...document.querySelectorAll('[data-pick-reason],#exPickReasonSkip')].every(button=>button.disabled));
        await page.locator("#exPickReasonSkip").evaluate(button=>button.click());
        assert.equal(await page.locator("#exPickSheet").isVisible(),true,"chosen reason cannot be discarded by Skip during a held write");
        await releaseDraftWrite(page);
      }else await page.locator(sequence==="replacement-discomfort"?"#exPickReasonSkip":'[data-pick-reason="pain"]').click();
      await page.locator("#exPickSheet").waitFor({state:"hidden"});
      if(sequence==="pain-restore"){
        await openActions(page,id);await page.locator("#exActionRestoreOrigBtn").click();
        await page.locator("#exActionsSheet").waitFor({state:"hidden"});
      }else{
        await openActions(page,id);await page.locator("#exActionDiscomfortBtn").click();
        await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="true");
        if(sequence==="pain-and-discomfort"){
          await page.locator("#exActionDiscomfortBtn").click();
          await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="false");
          const retained=await page.evaluate(id=>window.__repforgeWorkoutDraft.current().exercises[id].discomfort,id);
          assert.equal(retained.length,1,"clearing the replacement leaves original pain intact");
          assert.equal(retained[0].kind,"pain");
          await page.locator("#exActionDiscomfortBtn").click();
          await page.waitForFunction(()=>document.querySelector("#exActionDiscomfortBtn").getAttribute("aria-pressed")==="true");
        }
        await page.locator("#exActionsClose").click();
      }
      await saveCurrentSet(page,id);
      if(sequence==="replacement-discomfort"){
        await openActions(page,skipped.id);await page.locator("#exActionSkipBtn").click();
        await page.locator("#skipReasonSheet").waitFor({state:"visible"});
        await holdDraftWrite(page);await page.locator('[data-skip-reason="other"]').click();
        await page.locator("#skipReasonClose").click();await page.locator("#skipReasonSheet").waitFor({state:"hidden"});
        await releaseDraftWrite(page);
        assert.equal(await page.evaluate(()=>document.activeElement?.isConnected&&!document.activeElement.closest('[hidden],.hidden')),true,"a dismissed skip write returns focus to a live control");
      }
      const projected=await page.evaluate(()=>{
        const draft=window.__repforgeWorkoutDraft.current();
        const finishing=window.RepForgeWorkoutDraft.reduce(draft,{type:"beginFinish",operationId:"projection-proof",expectedRevision:draft.revision,updatedAt:new Date().toISOString(),writer:{installationId:"proof",tabId:"proof"}});
        return window.RepForgeWorkoutDraft.toHistoryRows(finishing,new Date().toISOString(),{includeSessionEvents:true}).sessionEvents;
      });
      const expectedCount=sequence==="pain-and-discomfort"?2:1;
      assert.equal(projected.pain.length,expectedCount,sequence);
      assert.equal(projected.pain[0].exerciseId,sequence==="replacement-discomfort"?replacement.libraryId:original.libraryId);
      assert.equal(projected.pain[0].swapped,sequence==="pain-and-discomfort");
      const result=await finishEarly(page);assert.ok(result.localOk||result.idbOk);
      let saved=await page.evaluate(()=>structuredClone(window.__repforgeWorkoutDraft.state()));
      assert.deepEqual(Object.values(saved.sessionEvents)[0],projected,"save retains the projected observations");
      await page.locator("#sumDone").click();
      if(sequence==="replacement-discomfort"){
        const removed=new Set([original.id,skipped.id]);
        saved.program=saved.program.filter(exercise=>!removed.has(exercise.id));
        for(const day of saved.programMeta.programDefinition.days)day.slots=day.slots.filter(slot=>!removed.has(slot.id)).map((slot,order)=>({...slot,order:order+1}));
        const orderById=new Map(saved.programMeta.programDefinition.days.flatMap(day=>day.slots.map(slot=>[slot.id,slot.order])));
        saved.program=saved.program.map(exercise=>({...exercise,order:orderById.get(exercise.id)}));
        const valid=await page.evaluate(definition=>window.RepForgeProgramCompiler.validateProgramDefinition(definition,window.RepForgeExerciseCatalog.snapshot(),[]),saved.programMeta.programDefinition);
        assert.equal(valid.ok,true,JSON.stringify(valid.issues));
        await seed(page,saved);
      }
      await page.locator('nav [data-view="stats"]').click();await page.locator('#statsSeg [data-seg="review"]').click();
      const current=await page.locator('[data-week-review="current"]').innerText();
      assert.match(current,new RegExp(sequence==="replacement-discomfort"?replacementLabel:original.name));
      assert.equal(current.includes(sequence==="replacement-discomfort"?`Discomfort reported: ${original.name}`:"not-a-fact"),false);
      if(sequence==="replacement-discomfort"){
        assert.ok(current.includes(`Skipped ${skipped.name}.`),"removed skipped slot retains its historical name");
        assert.ok(!current.includes("Reason: Other")&&!current.includes(skipped.id),"unspecified reason and raw ids stay off screen");
      }else if(sequence==="pain-restore")assert.ok(!current.includes("the exercise was swapped"),"Review does not claim an undone swap");
      else assert.ok(current.includes("the exercise was swapped")&&current.includes(`Discomfort reported: ${replacementLabel}`),"Review preserves both original pain swap and replacement discomfort");
    }finally{await context.close()}
  }
  console.log("PASS weekly review browser: EN/PT facts, active lifecycle, Today navigation, dismissal/reload and empty week");
}
