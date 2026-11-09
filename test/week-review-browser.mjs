import assert from "node:assert/strict";
import {join} from "node:path";
import {mkdirSync} from "node:fs";
import {loadManifest} from "../tools/ui-screens/manifest.mjs";
import {appState, APP_SCENARIOS} from "../tools/ui-screens/screens-app.mjs";
import {openPage, dismissChrome, seed, settle} from "../tools/ui-screens/session.mjs";
import {waitForAppBoot,openShelfField,answerRecommend} from "./browser.mjs";
import {openActions,finishEarly} from "./fixtures/focus-workout.mjs";

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

export async function runWeekReviewBrowser(browser) {
  const manifest=loadManifest();
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
