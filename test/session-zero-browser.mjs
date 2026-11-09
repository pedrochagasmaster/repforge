/** Session-zero journeys, composed into the existing finish-boundary PR command. */
import assert from "node:assert/strict";
import { legacyRelease } from "./fixtures/legacy-release.mjs";
import {readFileSync} from "node:fs";
import { launchChromium, waitForAppBoot, openShelfField, chooseRepsLeft } from "./browser.mjs";
import { cases as engineFixtures } from "./fixtures/engine-standing.mjs";
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from "./fixtures/history-metric-rows.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE=process.env.REPFORGE_URL||"http://localhost:8000/";
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`  ✓ ${label}`)};
const card="#workout .exercise.is-current";
async function open(browser,{mode="effort",planned=false,bodyweight=80}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"}),page=await context.newPage();
  await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
  const state=await installGeneratedProgram(page,{name:"Opening-load proof"});
  const squats=await page.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises
    .filter(ex=>ex.movementPattern?.some(id=>window.RepForgeExerciseCatalog.getObject(id)?.name==="Squat")).map(ex=>ex.id));
  const target=state.program.find(row=>squats.includes(row.libraryId)&&isWeightRepsSlot(definitionSlot(state.programMeta,row))&&row.sets>=3);
  assert.ok(target,"generated fixture has a weighted squat");
  await page.evaluate(async ({id,mode,planned,bodyweight})=>{
    const state=JSON.parse(localStorage.getItem("repforge_v1"));
    state.profile=bodyweight==null?{}:{weightKg:bodyweight};state.programMeta.experience="beginner";
    state.settings.rirMode=mode;delete state.settings.effortScale;
    if(planned){
      const slot=state.programMeta.programDefinition.days.flatMap(day=>day.slots||[]).find(slot=>slot.id===id);
      for(const cycle of slot.prescriptionsByCycle)for(const [index,set] of cycle.sets.entries())if(planned!=="later"||index>0)set.targets.loadKg=40;
    }
    await window.__repforgeCommitProposedState(state);
    await window.__repforgeStorage.flush();
  },{id:target.id,mode,planned,bodyweight});
  await page.reload();await waitForAppBoot(page,{base:BASE});
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  await page.locator(`${card}[data-ex="${target.id}"]`).waitFor();
  return{context,page,target};
}
async function field(page,semantic,value){
  const id=await page.evaluate(semantic=>{
    const draft=window.__repforgeWorkoutDraft.current(),ex=draft.exercises[draft.session.selectedExerciseId];
    return Object.values(ex.sets).find(set=>set.completion==="pending").programmed.metrics.find(metric=>metric.semantic===semantic).id;
  },semantic);
  const input=page.locator(`${card} input[data-metric-id="${id}"]`);
  if(await input.getAttribute("aria-hidden")==="true")await openShelfField(page,`${card} [data-shelf-field="metric_${id}"]`);
  await input.fill(String(value));await page.evaluate(()=>window.__repforgeWorkoutDraft.flush());
}
async function answer(page,value){
  if(typeof value==="number")await chooseRepsLeft(page,String(value));
  else {await page.locator(`${card} [data-shelf-field="rir"]`).click();await page.locator(`${card} [data-effchip][data-e="${value}"]`).click();}
  await page.evaluate(()=>window.__repforgeWorkoutDraft.flush());
  await page.locator(`${card} .saveset`).click();
}
const exercise=page=>page.evaluate(()=>{
  const draft=window.__repforgeWorkoutDraft.current();return draft.exercises[draft.session.selectedExerciseId];
});
async function waitWarmups(page,count){
  await page.waitForFunction(count=>{
    const draft=window.__repforgeWorkoutDraft.current(),ex=draft.exercises[draft.session.selectedExerciseId];
    return Object.values(ex.sets).filter(set=>set.origin==="ramp"&&set.completion!=="pending").length===count;
  },count);
  await page.locator(`${card} .saveset[data-save$="_${count+1}"]`).waitFor();
  check(await page.evaluate(()=>window.__repforgeRest.state().active),"a logged ramp keeps the ordinary rest clock");
  await page.evaluate(()=>window.stopRest());
  await page.waitForFunction(()=>!window.__repforgeRest.state().active);
  await page.locator(`${card} [data-ramp-start][data-ramp-n="${count+1}"]`).waitFor();
}
async function nextWorking(page,count){
  await page.waitForFunction(count=>{
    const draft=window.__repforgeWorkoutDraft.current(),ex=draft.exercises[draft.session.selectedExerciseId];
    return Object.values(ex.sets).filter(set=>set.role==="working"&&set.completion!=="pending").length===count;
  },count);
}
// Compare the public app adapter, not just unchanged engine arithmetic. The
// retained release supplies its own shell and every script at the same origin.
async function nonRampParity(browser){
  const context=await browser.newContext({serviceWorkers:"block"}),page=await context.newPage();
  try{
    await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
    const state=await installGeneratedProgram(page),targets=state.program.filter(row=>isWeightRepsSlot(definitionSlot(state.programMeta,row)));
    const fixtures=engineFixtures.map(({name,input})=>({name:`fixture:${name}`,sessions:input[1]}));
    const generated=[];
    for(const shape of ["ordinary","manual-warmup","missing-first"])for(const load of [20,40,80])generated.push({name:`${shape}:${load}`,sessions:Array.from({length:3},(_,session)=>({sessionId:`s${session}`,date:`2026-11-0${5+session}`,sets:[0,1,2].filter(index=>shape!=="missing-first"||index!==0).map(setIndex=>({setIndex,load:setIndex===0?load:load*.8,reps:7,rir:1,...(shape==="manual-warmup"&&setIndex===0?{warmup:true}:{})}))}))});
    let seed=790728;
    const random=limit=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%limit;};
    for(let trial=0;trial<64;trial++)generated.push({name:`generated:${trial}`,sessions:Array.from({length:random(5)},(_,session)=>({sessionId:`s${session}`,date:`2026-11-0${5+session}`,sets:Array.from({length:1+random(6)},(_,setIndex)=>({setIndex,load:10+random(40)*2.5,reps:1+random(14),rir:random(5),warmup:random(4)===0})).filter(()=>random(4)!==0)}))});
    const datasets=[...fixtures,...generated];
    async function capture(){
      const exact=await page.evaluate(cases=>cases.map(({input})=>window.RepForgeProgression.recommendSets(...input)),engineFixtures);
      const adapted=[];
      for(const dataset of datasets){
        const next=structuredClone(state);next.log=[];
        for(const target of targets)for(const session of dataset.sessions)for(const set of session.sets){
          const values=set.metricValues||[],definitions=definitionSlot(next.programMeta,target).metricDefinitions;
          const value=semantic=>values.find(value=>value.metricId===definitions.find(metric=>metric.semantic===semantic)?.id)?.value;
          const source=set.effortSource;
          next.log.push(metricLogRow(next.programMeta,target,{session:session.sessionId,date:session.date||"2026-11-05",set:set.setIndex+1,
            load:set.load??value("loadKg")??40,reps:set.reps??value("reps")??7,rir:set.rir??null,
            extra:{...(set.warmup?{warmup:true}:{}),...(source?{effortSource:source}:{}),...(set.equipmentId&&set.equipmentId!=="rack-a"?{equipmentId:set.equipmentId}:{})}}));
        }
        await page.evaluate(async ({state,name})=>{
          const result=await window.__repforgeCommitProposedState(state);
          if(result.committed!==true)throw new Error(`${name}: history proposal was rejected`);
          await window.__repforgeStorage.flush();
        },{state:next,name:dataset.name});
        adapted.push(await page.evaluate(ids=>ids.map(id=>{const api=window.__repforgeProgression,rec=api.recommendation(api.programSlot(id));return{rec,inputs:rec.progressionInputs};}),targets.map(target=>target.id)));
      }
      return{exact,adapted};
    }
    const head=await capture(),previous=legacyRelease("542a457ee2439d28522cc164b8323a7a0f7f7574");
    await page.route("**/*",async route=>{
      const url=new URL(route.request().url());if(url.origin!==new URL(BASE).origin)return route.continue();
      const path=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname).slice(1),body=previous.file(path);
      if(!body)return route.fulfill({status:404,body:""});
      const contentType=path.endsWith(".html")?"text/html":path.endsWith(".js")?"text/javascript":path.endsWith(".json")?"application/json":path.endsWith(".css")?"text/css":"application/octet-stream";
      return route.fulfill({body,contentType});
    });
    await page.reload();await waitForAppBoot(page,{base:BASE});
    const base=await capture();
    assert.deepEqual(head.exact,base.exact,"all existing engine fixtures retain complete base results");
    const differences=[];
    for(let i=0;i<datasets.length;i++)for(let j=0;j<targets.length;j++)if(JSON.stringify(head.adapted[i][j])!==JSON.stringify(base.adapted[i][j]))differences.push({case:datasets[i].name,slot:targets[j].id,base:base.adapted[i][j].rec.load,head:head.adapted[i][j].rec.load});
    console.log(`Non-ramp parity: ${engineFixtures.length} exact engine fixtures, ${fixtures.length*targets.length} fixture-adapter comparisons, ${generated.length*targets.length} generated-history comparisons (seed 790728), ${differences.length} differences`);
    assert.deepEqual(differences,[],"ordinary history anchors, targets and eligibility must equal the base release");
  }finally{await context.close()}
}
const browser=await launchChromium();
try{
  if(!process.env.REPFORGE_ZERO_SKIP_PARITY)await nonRampParity(browser);
  if(!process.env.REPFORGE_ZERO_PARITY_ONLY){
  const compatibility=await open(browser),cp=compatibility.page;
  await cp.locator(`${card} [data-ramp-start]`).click();await answer(cp,"easy");await waitWarmups(cp,1);
  const retained=await cp.evaluate(()=>({raw:localStorage.getItem("repforge_draft_v1"),checkpoint:localStorage.getItem("repforge_draft_v1:v2-checkpoint")}));
  // Serve the complete previous release, including its matching shell. A newer
  // script or service worker must not rescue its compatibility decision.
  const previous=legacyRelease("542a457ee2439d28522cc164b8323a7a0f7f7574");
  const route=async request=>{
    const url=new URL(request.request().url());if(url.origin!==new URL(BASE).origin)return request.continue();
    const path=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname).slice(1),bytes=previous.file(path);
    if(!bytes)return request.fulfill({status:404,body:""});
    const type=path.endsWith(".html")?"text/html":path.endsWith(".js")?"text/javascript":path.endsWith(".json")?"application/json":path.endsWith(".css")?"text/css":undefined;
    await request.fulfill({body:bytes,...(type?{contentType:type}:{})});
  };
  await cp.route("**/*",route);await cp.reload();await waitForAppBoot(cp,{base:BASE});
  check(await cp.locator('script[src^="app.js"]').getAttribute("src")===previous.file("index.html").toString().match(/src="(app\.js[^"]+)"/)[1],"compatibility uses the previous release's own shell and script revisions");
  await cp.evaluate(()=>window.__repforgeEnterWorkout({}));
  const old=await cp.evaluate(()=>({recovery:window.__repforgeWorkoutDraft.recovery(),raw:localStorage.getItem("repforge_draft_v1"),
    checkpoint:localStorage.getItem("repforge_draft_v1:v2-checkpoint"),active:window.__repforgeWorkoutDraft.current()}));
  check(old.recovery?.copyValue===retained.raw&&!old.active,"the previous release explicitly recovers the entire ramp draft instead of hiding prescribed work");
  check(old.raw===retained.raw&&old.checkpoint===retained.checkpoint&&await cp.locator("#draftRecovery").isVisible(),"previous-release recovery retains exact canonical and acknowledged bytes with a visible recovery surface");
  await cp.unroute("**/*",route);await cp.reload();await waitForAppBoot(cp,{base:BASE});
  await cp.evaluate(id=>window.__repforgeGoToLogExercise(id),compatibility.target.id);
  check((await exercise(cp)).setOrder.length===compatibility.target.sets+1,"the new release resumes all working sets after the old release's recovery");
  for(let count=1;count<=compatibility.target.sets;count++){
    await field(cp,"loadKg",40);await answer(cp,"hard");
    await cp.waitForFunction(({id,count})=>Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets).filter(set=>set.role==="working"&&set.completion!=="pending").length===count,{id:compatibility.target.id,count});
    await cp.evaluate(()=>window.stopRest());
  }
  await cp.evaluate(async id=>{const api=window.__repforgeWorkoutDraft;for(const exerciseInstanceId of api.current().exerciseOrder)if(exerciseInstanceId!==id)await api.dispatch("skipExercise",{exerciseInstanceId});await api.flush();},compatibility.target.id);
  const completed=await cp.evaluate(()=>window.__repforgeSaveWorkout());
  check(completed.committed===true,"all three working sets remain reachable and normal completion saves after returning to the new release");
  await compatibility.context.close();
  const weight=await open(browser,{bodyweight:null}),wp=weight.page;
  const start=wp.locator(`${card} [data-ramp-start]`);
  check((await start.innerText())==="Start at 2.5 kg","missing bodyweight advertises the floor");
  async function bodyweight(value){
    await wp.locator("#sessionSheetBtn").click();await wp.locator("#sessionBodyweight").fill(value);
    await wp.evaluate(()=>window.__repforgeWorkoutDraft.flush());
    await wp.locator("#sessionSheetClose").click();
    await wp.waitForFunction(()=>!document.body.classList.contains("is-sheet-open"));
  }
  await wp.locator(`${card} [data-ramp-bodyweight]`).click();await wp.locator("#sessionBodyweight").fill("80");
  await wp.evaluate(()=>window.__repforgeWorkoutDraft.flush());await wp.locator("#sessionSheetClose").click();
  await wp.waitForFunction(()=>!document.body.classList.contains("is-sheet-open"));
  check((await start.innerText())==="Start at 62.5 kg"&&!(await wp.locator(`${card} .fx-cue__evidence`).innerText()).includes("lightest"),
    "acknowledged bodyweight refreshes both the offered load and its explanation");
  await bodyweight("40");check((await start.innerText())==="Start at 30 kg","decreasing bodyweight refreshes the offer");
  await bodyweight("");check((await start.innerText())==="Start at 2.5 kg","removing bodyweight restores the visible floor");
  for(const [value,label] of [["80","Start at 62.5 kg"],["40","Start at 30 kg"],["","Start at 2.5 kg"]]){
    const before=await start.innerText();
    await wp.evaluate(()=>new Promise(ready=>{navigator.locks.request("repforge:draft-write",()=>new Promise(release=>{window.__releaseOpeningWrite=release;ready();}));}));
    await wp.locator("#sessionSheetBtn").click();await wp.locator("#sessionBodyweight").fill(value);
    await wp.locator("#sessionSheetClose").click();await wp.waitForFunction(()=>!document.body.classList.contains("is-sheet-open"));
    check((await start.innerText())===before,`a held bodyweight write (${value||"removed"}) has not advertised its new load`);
    await start.click();await wp.evaluate(()=>window.__releaseOpeningWrite());
    await wp.evaluate(()=>window.__repforgeWorkoutDraft.flush());
    await wp.waitForFunction(label=>document.querySelector("#workout .exercise.is-current [data-ramp-start]")?.textContent===label,label);
    check(Object.values((await exercise(wp)).sets).every(set=>!set.startingLoad),`the old offer during a held write (${value||"removed"}) never silently applies the new load`);
  }
  await bodyweight("80");
  await start.click();await wp.evaluate(()=>window.__repforgeWorkoutDraft.flush());
  let accepted=Object.values((await exercise(wp)).sets)[0];
  check(accepted.startingLoad.openingKg===62.5,"acceptance applies exactly the newly advertised load");
  await bodyweight("40");await bodyweight("");
  accepted=Object.values((await exercise(wp)).sets)[0];
  check(accepted.startingLoad.openingKg===62.5&&(await start.innerText())==="Start at 62.5 kg","bodyweight edits preserve an already accepted pending opening");
  await field(wp,"loadKg",35);await bodyweight("80");
  check((await start.innerText())==="Start at 35 kg","bodyweight edits preserve a load the lifter typed into the pending set");
  await weight.context.close();
  const anchor=await open(browser);
  await anchor.page.locator(`${card} [data-ramp-start]`).click();
  await answer(anchor.page,"easy");await waitWarmups(anchor.page,1);
  await field(anchor.page,"loadKg",40);await answer(anchor.page,"hard");await nextWorking(anchor.page,1);
  const live=await anchor.page.evaluate(id=>{const api=window.__repforgeProgression;const rec=api.recommendation(api.programSlot(id));return {...rec,progressionInputs:rec.progressionInputs};},anchor.target.id);
  check(live.progressionInputs.currentSession[0].setIndex===0,"live engine indexes the first working set at zero after a ramp");
  check(live.targetSets[1].result.historyAnchor.displayLoadKg===40,"the live anchor is the 40 kg working set, never the Easy trial");
  await finishEarly(anchor.page);await anchor.page.reload();await waitForAppBoot(anchor.page,{base:BASE});
  await anchor.page.evaluate(id=>window.__repforgeGoToLogExercise(id),anchor.target.id);
  const historical=await anchor.page.evaluate(id=>{const api=window.__repforgeProgression;const rec=api.recommendation(api.programSlot(id));return {...rec,progressionInputs:rec.progressionInputs};},anchor.target.id);
  check(historical.lastLoad===40&&historical.progressionInputs.history[0].sets.length===1&&historical.progressionInputs.history[0].sets[0].setIndex===0,
    "after reload history anchors only on the first 40 kg working set");
  check(historical.engineResults[0].standing.evidence.sessions===1&&historical.engineResults[0].standing.evidence.sets<=1,
    "standing counts the working observation without the ramp warm-up");
  await anchor.page.evaluate(()=>{
    window.__rampWeekInputs=[];const engine=window.RepForgeProgression;
    window.RepForgeProgression={...engine,performanceTrend(prescription,history,...rest){
      window.__rampWeekInputs.push({exerciseId:prescription.exerciseId,history});return engine.performanceTrend(prescription,history,...rest);
    }};
  });
  await anchor.page.locator("#leaveWorkout").click();
  await anchor.page.locator('nav [data-view="stats"]').click();await anchor.page.locator('#statsSeg [data-seg="review"]').click();
  await anchor.page.locator('[data-week-review="current"]').waitFor();
  const weeks=await anchor.page.evaluate(id=>window.__rampWeekInputs.filter(item=>item.exerciseId===id),anchor.target.libraryId);
  check(weeks.some(item=>item.history.length===1)&&weeks.every(item=>item.history.every(session=>session.sets.length===1&&session.sets[0].setIndex===0&&session.sets[0].metricValues.some(value=>value.value===40))),
    "Review's week facts and every observed trend reader receive only the 40 kg first working set");
  await anchor.context.close();
  const warmOnly=await open(browser);
  await warmOnly.page.locator(`${card} [data-ramp-start]`).click();await answer(warmOnly.page,"easy");await waitWarmups(warmOnly.page,1);
  await finishEarly(warmOnly.page);await warmOnly.page.reload();await waitForAppBoot(warmOnly.page,{base:BASE});
  await warmOnly.page.evaluate(id=>window.__repforgeGoToLogExercise(id),warmOnly.target.id);
  check(await warmOnly.page.locator(`${card} [data-ramp-start]`).count()===1,"after reload a warm-up-only session still offers session zero");
  const warmStanding=await warmOnly.page.evaluate(id=>{const api=window.__repforgeProgression;return api.recommendation(api.programSlot(id)).engineResults[0].standing;},warmOnly.target.id);
  check(warmStanding.word==="first"&&warmStanding.evidence.sessions===0,"warm-up-only history supplies no standing evidence");
  await warmOnly.context.close();
  const run=await open(browser),{page,target}=run;
  check(await page.locator(`${card} .fx-cue.is-ramp`).count()===1,"fresh no-load program offers Find your weight");
  const expected=await page.evaluate(id=>{
    const raw=window.RepForgeExerciseCatalog.getExercise(id);
    return window.RepForgeStartingLoads.openingLoad({exercise:raw,lookup:id=>window.RepForgeExerciseCatalog.getObject(id),bodyweightKg:80,
      experience:"beginner",convention:"external",grid:Array.from({length:400},(_,i)=>(i+1)*2.5)}).loadKg;
  },target.libraryId);
  await page.locator(`${card} [data-ramp-start]`).click();
  let ex=await exercise(page),working=Object.values(ex.sets).find(set=>set.role==="working");
  check(working.startingLoad.openingKg===expected&&working.startingLoad.version==="priors@079.1","Start uses the declared 80 kg beginner opening");
  for(let count=1;count<=3;count++){
    await answer(page,"easy");await waitWarmups(page,count);
    ex=await exercise(page);
    check((await page.locator(`${card} .focus-ex__meta`).innerText()).startsWith(`${target.sets} ×`),"the prescription still names only the programmed working sets");
    check(ex.setOrder.length===target.sets+count&&Object.values(ex.sets).filter(set=>set.role==="working").length===target.sets,`Easy ${count} preserves every programmed working set`);
    const warm=ex.setOrder.map(id=>ex.sets[id]).filter(set=>set.origin==="ramp").at(-1);
    working=Object.values(ex.sets).find(set=>set.role==="working");
    const load=metric=>Number(metric.edited.metrics[metric.programmed.metrics.find(def=>def.semantic==="loadKg").id]);
    check(load(working)>load(warm),`Easy ${count} increases on the load grid`);
  }
  await page.reload();await waitForAppBoot(page,{base:BASE});
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  ex=await exercise(page);
  check(Object.values(ex.sets).filter(set=>set.origin==="ramp").length===3,"three ramp sets survive normal boot and reload");
  await answer(page,"easy");await nextWorking(page,1);
  ex=await exercise(page);working=Object.values(ex.sets).find(set=>set.role==="working"&&set.completion!=="pending");
  check(working.startingLoad.ramps===3&&working.completion.effortSource==="effort","a fourth Easy hands off at the three-ramp ceiling with opening provenance");
  await page.waitForFunction(()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  check(await page.locator(`${card} [data-ramp-start]`).count()===0,"working set ends the ramp and the live engine takes over");
  const saved=await finishEarly(page);check(saved.committed,"ramp session saves through the production finish flow");
  const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log);
  check(rows.filter(row=>row.warmup).length===3&&rows.filter(row=>row.startingLoad).length===1,"history contains three warm-ups and exactly one opening record");
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check((await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log)).find(row=>row.startingLoad)?.startingLoad.ramps===3,"durable loader retains the opening record");
  await page.evaluate(()=>window.__repforgeShowSettings());
  await page.locator("#dataBackupRow").click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#exportJson").click()]);
  const backup=JSON.parse(readFileSync(await download.path(),"utf8"));
  check(backup.log.find(row=>row.startingLoad)?.startingLoad.ramps===3,"backup export includes the opening provenance");
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({name:"opening-backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))});
  await page.waitForFunction(()=>document.querySelector("#importChoice")?.open===true);
  await page.locator("#importReplace").click();
  await page.waitForFunction(()=>document.querySelector("#importChoice")?.open===false);
  await page.evaluate(()=>window.__repforgeStorage.flush());
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check((await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log)).find(row=>row.startingLoad)?.startingLoad.ramps===3,"backup Replace and production reload retain the opening provenance");
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  await page.locator(`${card} .fx-cue.is-now`).waitFor();
  check(await page.locator(`${card} .fx-cue.is-ramp`).count()===0,"the lift's own saved history replaces the prior with a target on its next session");
  const afterThree=await page.evaluate(id=>{const api=window.__repforgeProgression;return api.recommendation(api.programSlot(id)).lastLoad;},target.id);
  check(afterThree===rows.find(row=>!row.warmup).load,"after three ramps the next session anchors on its first working row");
  await run.context.close();

  const interrupted=await open(browser);
  await interrupted.page.locator(`${card} [data-ramp-start]`).click();
  await answer(interrupted.page,"easy");await waitWarmups(interrupted.page,1);
  await finishEarly(interrupted.page);
  const partial=await interrupted.page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log);
  check(partial.length===1&&partial[0].warmup&&!partial[0].startingLoad,"finishing during a ramp saves only the performed warm-up");
  await interrupted.context.close();

  const typed=await open(browser,{mode:"numeric"});
  await typed.page.locator(`${card} [data-ramp-skip]`).click();
  await typed.page.locator("#wheelSheet.is-open").waitFor();
  check(await typed.page.locator("#wheelCol").getAttribute("aria-valuenow")!==null,"I know my weight opens the load wheel at the opening");
  await typed.page.keyboard.press("Escape");
  await field(typed.page,"loadKg",35);await field(typed.page,"reps",8);await answer(typed.page,1);await nextWorking(typed.page,1);
  const typedSet=Object.values((await exercise(typed.page)).sets).find(set=>set.completion!=="pending");
  check(typedSet.startingLoad.basis==="typed"&&typedSet.startingLoad.openingKg===35,"skip records the chosen weight as typed");
  await typed.context.close();

  const hard=await open(browser);
  await hard.page.locator(`${card} [data-ramp-start]`).click();
  await answer(hard.page,"hard");await nextWorking(hard.page,1);
  const hardSet=Object.values((await exercise(hard.page)).sets).find(set=>set.completion!=="pending");
  check(hardSet.role==="working"&&hardSet.startingLoad.ramps===0&&hardSet.completion.effortSource==="effort","Hard is the first working set at the opening weight");
  await hard.context.close();

  const max=await open(browser,{mode:"numeric"});
  await max.page.locator(`${card} [data-ramp-start]`).click();
  await field(max.page,"loadKg",40);await field(max.page,"reps",1);
  await answer(max.page,0);await nextWorking(max.page,1);
  check(Object.values((await exercise(max.page)).sets).every(set=>!set.origin),"Max becomes working set one without inserting a ramp");
  await max.page.waitForFunction(()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  const nextLoad=await max.page.evaluate(id=>{
    const api=window.__repforgeProgression,rec=api.recommendation(api.programSlot(id));
    return rec.targetSets.find(item=>item.prescription.setIndex===2)?.targets.loadKg;
  },max.target.id);
  check(nextLoad<40,`a one-rep Max below the prescribed minimum lowers the next target (${nextLoad})`);
  await max.context.close();

  for(const loads of [true,"later"]){
    const planned=await open(browser,{planned:loads});
    check(await planned.page.locator(`${card} .fx-cue.is-ramp`).count()===0,`authored loads skip the ramp, including a load on a later set (${loads})`);
    await planned.context.close();
  }
  console.log(`Session zero: ${checks} passed, 0 failed`);
  }
}finally{await browser.close()}
