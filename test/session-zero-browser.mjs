/** Session-zero journeys, composed into the existing finish-boundary PR command. */
import assert from "node:assert/strict";
import { legacyRelease } from "./fixtures/legacy-release.mjs";
import {readFileSync} from "node:fs";
import { launchChromium, waitForAppBoot, waitForAsyncCondition, openShelfField, chooseRepsLeft } from "./browser.mjs";
import { cases as engineFixtures } from "./fixtures/engine-standing.mjs";
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot, metricLogRow } from "./fixtures/history-metric-rows.mjs";
import { openActions, exerciseAction, finishEarly } from "./fixtures/focus-workout.mjs";
import {openInstalledEditor,openExerciseSheet,closeEditorSheet} from "./fixtures/installed-editor.mjs";

const BASE=process.env.REPFORGE_URL||"http://localhost:8000/";
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`  ✓ ${label}`)};
const card="#workout .exercise.is-current";
async function open(browser,{mode="effort",planned=false,bodyweight=80,historySource=null,targetName=null}={}){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"}),page=await context.newPage();
  await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
  const state=await installGeneratedProgram(page,{name:"Opening-load proof"});
  const squats=await page.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises
    .filter(ex=>ex.movementPattern?.some(id=>window.RepForgeExerciseCatalog.getObject(id)?.name==="Squat")).map(ex=>ex.id));
  const target=state.program.find(row=>targetName?row.name===targetName:squats.includes(row.libraryId)&&isWeightRepsSlot(definitionSlot(state.programMeta,row))&&row.sets>=3);
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
  if(historySource){
    const source=await page.evaluate(({name,id})=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>name==="original"?ex.id===id:ex.name===name),{name:historySource,id:target.libraryId});
    assert.ok(source,historySource);
    const current=await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")));
    current.log=[
      metricLogRow(current.programMeta,target,{session:"anchor",date:"2026-11-01",set:1,load:35,reps:8,
        extra:{performedLibraryId:source.id,sourceLibraryId:source.id,performedName:source.name,loadingModel:{bodyweightCoefficient:source.bodyweight??null}}}),
      metricLogRow(current.programMeta,target,{session:"trial",date:"2026-11-02",set:1,load:400,reps:8,
        extra:{performedLibraryId:source.id,sourceLibraryId:source.id,performedName:source.name,loadingModel:{bodyweightCoefficient:source.bodyweight??null},warmup:true,origin:"ramp"}}),
    ];
    for(const row of current.log)row.loadingContext.bodyweightCoefficient=source.bodyweight??null;
    await page.evaluate(async state=>{const result=await window.__repforgeCommitProposedState(state);if(!result.committed)throw new Error(JSON.stringify(result));await window.__repforgeStorage.flush()},current);
  }
  await page.reload();await waitForAppBoot(page,{base:BASE});
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  await page.locator(`${card}[data-ex="${target.id}"]`).waitFor();
  await waitForDraft(page,{exerciseId:target.id});
  return{context,page,target};
}
// Read the acknowledged aggregate, not the optimistic UI or the first poll.
async function waitForDraft(page,expected={}, {drain=true}={}){
  return waitForAsyncCondition(page,async ({expected,drain})=>{
    const api=window.__repforgeWorkoutDraft;
    if(drain)await api.flush();
    const draft=api.current(),stored=api.read(),checkpoint=api.checkpoint();
    if(!draft||stored.status!=="ok"||api.raw()!==stored.raw||checkpoint.status!=="valid"||
      checkpoint.value.kind!=="committed"||checkpoint.value.raw!==stored.raw||
      checkpoint.value.draftId!==draft.draftId||checkpoint.value.revision!==draft.revision)return false;
    if(expected.draftId&&draft.draftId!==expected.draftId||expected.differentDraftId&&draft.draftId===expected.differentDraftId||
      expected.afterRevision!=null&&draft.revision<=expected.afterRevision)return false;
    const ex=draft.exercises[expected.exerciseId||draft.session.selectedExerciseId];
    if(!ex||expected.exerciseId&&draft.session.selectedExerciseId!==expected.exerciseId)return false;
    const sets=ex.setOrder.map(id=>ex.sets[id]);
    if(expected.completedWorking!=null&&sets.filter(set=>set.role==="working"&&set.completion!=="pending").length!==expected.completedWorking||
      expected.completedRamps!=null&&sets.filter(set=>set.origin==="ramp"&&set.completion!=="pending").length!==expected.completedRamps)return false;
    if(Object.hasOwn(expected,"substitutionId")&&(ex.substitution?.replacement?.libraryId||null)!==expected.substitutionId)return false;
    if(expected.openingSetId&&!ex.sets[expected.openingSetId]?.startingLoad)return false;
    if(expected.savedSetId&&(!ex.sets[expected.savedSetId]||ex.sets[expected.savedSetId].completion==="pending"&&
      sets.filter(set=>set.origin==="ramp"&&set.completion!=="pending").length<=expected.previousRamps))return false;
    if(expected.metric&&String(ex.sets[expected.metric.setId]?.edited.metrics[expected.metric.id])!==expected.metric.value)return false;
    if(expected.bodyweightText!=null&&String(draft.session.bodyweight??"")!==expected.bodyweightText)return false;
    return draft;
  },{expected,drain});
}
const exercise=async(page,expected={},options)=>{
  const draft=await waitForDraft(page,expected,options);
  return draft.exercises[expected.exerciseId||draft.session.selectedExerciseId];
};
const orderedSets=ex=>ex.setOrder.map(id=>ex.sets[id]);
const workingSet=ex=>orderedSets(ex).find(set=>set.role==="working"&&set.completion==="pending");
async function storedState(page){
  return waitForAsyncCondition(page,async()=>{
    await window.__repforgeStorage.flush();
    const stored=JSON.parse(localStorage.getItem("repforge_v1"));
    return stored&&JSON.stringify(stored.log)===JSON.stringify(window.__repforgeWorkoutDraft.state().log)?stored:false;
  });
}
async function field(page,semantic,value){
  const ex=await exercise(page),set=workingSet(ex),id=set.programmed.metrics.find(metric=>metric.semantic===semantic).id;
  const input=page.locator(`${card} input[data-metric-id="${id}"]`);
  if(await input.getAttribute("aria-hidden")==="true")await openShelfField(page,`${card} [data-shelf-field="metric_${id}"]`);
  await input.fill(String(value));
  await waitForDraft(page,{exerciseId:ex.exerciseInstanceId,metric:{setId:set.setId,id,value:String(value)}});
}
async function waitForOpening(page,identity=null){
  if(!identity){const draft=await waitForDraft(page),ex=draft.exercises[draft.session.selectedExerciseId];
    identity={draftId:draft.draftId,exerciseId:ex.exerciseInstanceId,openingSetId:workingSet(ex).setId};}
  const draft=await waitForDraft(page,identity);
  return draft.exercises[identity.exerciseId].sets[identity.openingSetId];
}
async function startOpening(page){
  const draft=await waitForDraft(page),ex=draft.exercises[draft.session.selectedExerciseId];
  const identity={draftId:draft.draftId,exerciseId:ex.exerciseInstanceId,openingSetId:workingSet(ex).setId};
  await page.locator(`${card} [data-ramp-start]`).click();
  return waitForOpening(page,identity);
}
async function leaveAfterHeldOpening(page){
  const before=await waitForDraft(page),ex=before.exercises[before.session.selectedExerciseId];
  const identity={draftId:before.draftId,exerciseId:ex.exerciseInstanceId,openingSetId:workingSet(ex).setId};
  await page.evaluate(()=>new Promise(ready=>navigator.locks.request("repforge:draft-write",()=>new Promise(release=>{
    window.__releaseEditOpening=release;ready();}))));
  try{
    await page.locator(`${card} [data-ramp-start]`).click();
    await waitForAsyncCondition(page,async()=>{const locks=await navigator.locks.query();
      return locks.pending.some(lock=>lock.name==="repforge:draft-write");});
    await page.evaluate(()=>{const button=document.querySelector("#leaveWorkout"),handler=button.onclick;
      button.onclick=()=>{window.__openingLeaveStarted=true;
        return Promise.resolve(handler()).then(()=>window.__openingLeaveAcknowledged=true);};});
    await page.locator("#leaveWorkout").click();
    const held=await waitForAsyncCondition(page,async()=>{const locks=await navigator.locks.query();
      return window.__openingLeaveStarted&&locks.pending.some(lock=>lock.name==="repforge:draft-write")
        ?{left:!!window.__openingLeaveAcknowledged,workout:document.body.classList.contains("is-workout")}:false;});
    check(!held.left&&held.workout,"leaving Focus waits for an opening held by the real draft-write lock");
  }finally{await page.evaluate(()=>window.__releaseEditOpening());}
  await waitForOpening(page,identity);
  await waitForAsyncCondition(page,()=>window.__openingLeaveAcknowledged===true);
  return identity.draftId;
}
async function answer(page,value){
  const ex=await exercise(page),set=workingSet(ex),previousRamps=orderedSets(ex).filter(set=>set.origin==="ramp"&&set.completion!=="pending").length;
  if(typeof value==="number")await chooseRepsLeft(page,String(value));
  else {await page.locator(`${card} [data-shelf-field="rir"]`).click();await page.locator(`${card} [data-effchip][data-e="${value}"]`).click();}
  await waitForDraft(page);
  await page.locator(`${card} .saveset`).click();
  await waitForDraft(page,{exerciseId:ex.exerciseInstanceId,savedSetId:set.setId,previousRamps});
}
async function waitWarmups(page,count){
  await waitForDraft(page,{completedRamps:count});
  await page.locator(`${card} .saveset[data-save$="_${count+1}"]`).waitFor();
  await waitForAsyncCondition(page,()=>window.__repforgeRest.state().active);
  check(await page.evaluate(()=>window.__repforgeRest.state().active),"a logged ramp keeps the ordinary rest clock");
  await page.evaluate(()=>window.stopRest());
  await waitForAsyncCondition(page,()=>!window.__repforgeRest.state().active);
  await page.locator(`${card} [data-ramp-start][data-ramp-n="${count+1}"]`).waitFor();
}
async function nextWorking(page,count){
  const ex=await exercise(page,{completedWorking:count}),pending=workingSet(ex);
  if(pending)await waitForAsyncCondition(page,ordinal=>
    document.querySelector("#workout .exercise.is-current .saveset")?.dataset.save?.endsWith(`_${ordinal}`),pending.ordinal);
}
// Compare the public app adapter, not just unchanged engine arithmetic. The
// retained release supplies its own shell and every script at the same origin.
async function nonRampParity(browser){
  const context=await browser.newContext({serviceWorkers:"block"}),page=await context.newPage();
  try{
    await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
    const state=await installGeneratedProgram(page),targets=state.program.filter(row=>isWeightRepsSlot(definitionSlot(state.programMeta,row)));
    const foreignEquipment=JSON.parse(readFileSync(new URL("../plans/067/data/gym.json",import.meta.url),"utf8")).equipment[0].equipmentId;
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
            extra:{...(set.warmup?{warmup:true}:{}),...(source?{effortSource:source}:{}),...(set.equipmentId&&set.equipmentId!=="rack-a"?{equipmentId:foreignEquipment}:{})}}));
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
async function swapOpening(page,name,{rejected=false}={}){
  const before=await waitForDraft(page);
  const id=await page.evaluate(name=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>ex.name===name).id,name);
  await page.locator("#woOverflowBtn").click();await page.locator('[data-workout-action="exercise"]').click();
  await page.locator("#exActionSubstBtn").click();await page.locator("#exPickSearch").fill(name);
  await page.locator(`#exPickList [data-pick="${id}"]`).click();
  if(rejected)await waitForAsyncCondition(page,()=>document.querySelector("#toast")?.textContent.includes("Clear the values you've entered"));
  else await page.locator('[data-pick-reason="equipment"]').click();
  await exercise(page,rejected?{substitutionId:null}:{substitutionId:id,afterRevision:before.revision});
}
async function openingNoops(browser){
  const session=await open(browser),page=session.page;
  await startOpening(page);await field(page,"loadKg",72.5);
  const before=await exercise(page);
  await page.locator("#woOverflowBtn").click();await page.locator('[data-workout-action="exercise"]').click();
  await page.locator("#exActionSubstBtn").click();await page.locator("#exPickSearch").fill("Hack squat");
  await page.locator("#exPickList .pickrow__name").filter({hasText:/^Hack squat$/}).click();
  await page.locator("#exPickSheet").waitFor({state:"hidden"});await waitForDraft(page);
  check(JSON.stringify((await exercise(page)).sets)===JSON.stringify(before.sets),"B2: picking Hack squat itself preserves 72.5 kg and every touched flag");
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check(JSON.stringify((await exercise(page)).sets)===JSON.stringify(before.sets),"B2: the same-movement typed load survives production reload");
  await swapOpening(page,"Barbell bench press",{rejected:true});
  check((await exercise(page)).substitution===null&&JSON.stringify((await exercise(page)).sets)===JSON.stringify(before.sets),
    "B2: a different-lift pick refuses typed pending work and never carries its load");
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check((await exercise(page)).substitution===null&&JSON.stringify((await exercise(page)).sets)===JSON.stringify(before.sets),
    "B2: the rejected movement change preserves the old lift and input after reload");
  await session.context.close();
}
async function openingChanges(browser){
  const session=await open(browser,{historySource:"Pendulum squat"}),page=session.page;
  const pending=async()=>{const ex=await exercise(page);return ex.sets[ex.setOrder.find(id=>ex.sets[id].role==="working"&&ex.sets[id].completion==="pending")];};
  async function offer(load,basis,label){
    await exercise(page);
    await waitForAsyncCondition(page,({load,basis})=>{
      const card=document.querySelector("#workout .exercise.is-current");
      return card?.querySelector("[data-ramp-start]")?.textContent===`Start at ${load} kg`&&
        card.querySelector(".fx-cue__evidence")?.textContent.includes(basis==="ratio"?"exercise you've logged":"bodyweight");
    },{load,basis});
    check(await page.locator(`${card} [data-ramp-start]`).innerText()===`Start at ${load} kg`,`${label}: destination opening is ${load} kg`);
    check((await page.locator(`${card} .fx-cue__evidence`).innerText()).includes(basis==="ratio"?"exercise you've logged":"bodyweight"),`${label}: destination evidence matches its basis`);
    check(!(await pending()).startingLoad,`${label}: the previous accepted opening is invalidated`);
  }
  await startOpening(page);await answer(page,"easy");await waitWarmups(page,1);
  const warmup=orderedSets(await exercise(page)).find(set=>set.origin==="ramp");
  await swapOpening(page,"Barbell bench press");await offer(22.5,"prior","machine squat to free-bar press");
  await page.reload();await waitForAppBoot(page,{base:BASE});await offer(22.5,"prior","reload after changing movement");
  await startOpening(page);
  await swapOpening(page,"Low incline dumbbell press");await offer(7.5,"prior","total load to per-hand load");
  await startOpening(page);await answer(page,"easy");await waitWarmups(page,2);
  check((await waitForOpening(page)).startingLoad.ramps===1,"the new movement counts its own ramp trial");
  await swapOpening(page,"Barbell bench press");await offer(22.5,"prior","per-hand load back to total load");
  await page.locator("#woOverflowBtn").click();await page.locator('[data-workout-action="exercise"]').click();
  await page.locator("#exActionRestoreOrigBtn").click();await exercise(page,{substitutionId:null});
  await offer(35,"ratio","restore recomputes the original movement opening");
  await page.reload();await waitForAppBoot(page,{base:BASE});await offer(35,"ratio","restored movement after reload");
  check(JSON.stringify(orderedSets(await exercise(page)).find(set=>set.setId===warmup.setId))===JSON.stringify(warmup),"the old movement's completed warm-up remains unchanged");
  const oldId=warmup.programmed.sourceLibraryId;
  await startOpening(page);await answer(page,"hard");await nextWorking(page,1);
  const sessionId=(await waitForDraft(page)).draftId;
  await finishEarly(page);
  const rows=(await storedState(page)).log.filter(row=>row.session===sessionId&&row.origin==="ramp");
  check(rows.length===2&&rows[0].performedLibraryId===oldId&&rows[1].performedLibraryId!==oldId,"saved warm-ups retain each movement actually performed");
  await session.context.close();
  const moved=await open(browser,{historySource:"Pendulum squat"}),mp=moved.page;
  await startOpening(mp);
  const oldDraftId=(await waitForDraft(mp)).draftId;
  const nextDay=(await storedState(mp)).program.find(row=>row.name==="Smith machine bench press");
  await mp.evaluate(id=>{window.__openingDayChange=window.__repforgeGoToLogExercise(id)},nextDay.id);
  await waitForAsyncCondition(mp,()=>document.querySelector("#draftDiscardSheet")?.classList.contains("is-open"));
  await mp.locator("#draftDiscardDrop").click();await mp.evaluate(()=>window.__openingDayChange);
  check((await waitForDraft(mp,{differentDraftId:oldDraftId,exerciseId:nextDay.id})).draftId!==oldDraftId,"day change replaces the accepted-opening draft");
  check(await mp.locator(`${card} [data-ramp-start]`).innerText()==="Start at 20 kg"&&orderedSets(await exercise(mp)).every(set=>!set.startingLoad),"a different day's movement uses its own opening");
  await moved.context.close();
  const edited=await open(browser,{historySource:"Pendulum squat"}),ep=edited.page;
  const editedDraftId=await leaveAfterHeldOpening(ep);
  await openInstalledEditor(ep);await openExerciseSheet(ep,edited.target.id);
  await ep.locator('#reviewSheet [data-role="swap-open"]').click();await ep.locator('#reviewSheet [data-role="swap-search"]').click();
  await ep.locator("#exPickSearch").fill("Barbell bench press");
  const bench=await ep.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>ex.name==="Barbell bench press").id);
  await ep.locator(`#exPickList [data-pick="${bench}"]`).click();await closeEditorSheet(ep);
  await waitForAsyncCondition(ep,id=>{
    const editor=document.querySelector('#programEditor [data-role="editor"]');
    const row=editor?.querySelector(`[data-role="exercise-row"][data-id="${id}"]`);
    return editor?.getAttribute("aria-busy")!=="true"&&row?.textContent.includes("Barbell bench press");
  },edited.target.id);
  await ep.locator("#programEditDone").click();
  await waitForAsyncCondition(ep,async()=>{await window.__repforgeWorkoutDraft.flush();return document.querySelector("#programEditorLeave").open;});
  check(await ep.locator("#programEditorLeave").isVisible(),"editing a movement with an accepted opening requires the existing discard confirmation");
  await ep.locator("#programEditorApply").click();
  await waitForAsyncCondition(ep,async()=>{await window.__repforgeWorkoutDraft.flush();return document.querySelector("#programEditorWrap").classList.contains("is-hidden");});
  await ep.evaluate(id=>window.__repforgeGoToLogExercise(id),edited.target.id);
  check((await waitForDraft(ep,{differentDraftId:editedDraftId,exerciseId:edited.target.id})).draftId!==editedDraftId,"replacing a movement in the Program editor discards the old accepted-opening draft");
  check(await ep.locator(`${card} [data-ramp-start]`).innerText()==="Start at 22.5 kg"&&orderedSets(await exercise(ep)).every(set=>!set.startingLoad),"the edited program opens the replacement from its own prior");
  await edited.context.close();
}
async function ratioJourneys(browser){
  // A mid-block new movement uses a real working observation, never the newer 400 kg ramp.
  const added=await open(browser,{historySource:"Pendulum squat"});
  check(await added.page.locator(`${card} [data-ramp-start]`).innerText()==="Start at 35 kg","mid-block new lift carries the same-row/class working anchor");
  check((await added.page.locator(`${card} .fx-cue__evidence`).innerText()).includes("exercise you've logged"),"ratio opening uses the approved explanation");
  const ratioOpening=await startOpening(added.page);
  check(ratioOpening.startingLoad.basis==="ratio","ratio is opening provenance only");
  check(((await storedState(added.page)).log).length===2,"offering and accepting a ratio invents no history row");
  await added.context.close();
  const unrelated=await open(browser,{historySource:"Barbell bench press"});
  check(await unrelated.page.locator(`${card} [data-ramp-start]`).innerText()==="Start at 62.5 kg","an unrelated movement keeps the destination's plain prior");
  check(!(await unrelated.page.locator(`${card} .fx-cue__evidence`).innerText()).includes("exercise you've logged"),"the fallback explains its own prior");
  await unrelated.context.close();
  const swapped=await open(browser,{historySource:"original"});
  const replacement=await swapped.page.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>ex.name==="Pendulum squat").id);
  check(await swapped.page.locator(`${card} [data-ramp-start]`).count()===0,"a movement with its own working history does not borrow another opening");
  await swapped.page.locator("#woOverflowBtn").click();await swapped.page.locator('[data-workout-action="exercise"]').click();
  await swapped.page.locator("#exActionSubstBtn").click();
  await swapped.page.locator("#exPickSearch").fill("Pendulum squat");
  await swapped.page.locator(`#exPickList [data-pick="${replacement}"]`).click();
  await swapped.page.locator('[data-pick-reason="equipment"]').click();
  await exercise(swapped.page,{exerciseId:swapped.target.id,substitutionId:replacement});
  check(await swapped.page.locator(`${card} [data-ramp-start]`).innerText()==="Start at 35 kg","a same-row/class substitution opens at the old working load");
  await startOpening(swapped.page);
  await answer(swapped.page,"easy");await waitWarmups(swapped.page,1);
  await field(swapped.page,"loadKg",30);await answer(swapped.page,"hard");await nextWorking(swapped.page,1);
  const subrec=await swapped.page.evaluate(id=>{const rec=window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));return {...rec,progressionInputs:rec.progressionInputs}},swapped.target.id);
  check(subrec.progressionInputs.currentSession[0].loadingContext.bodyweightCoefficient===.759,"the replacement anchor carries its own loading context");
  check(subrec.targetSets[1].result.historyAnchor.displayLoadKg===30,"replacement's first working set takes over from its ratio and Easy warm-up");
  await swapped.page.reload();await waitForAppBoot(swapped.page,{base:BASE});
  check(orderedSets(await exercise(swapped.page)).some(set=>set.startingLoad?.basis==="ratio"),"substitution opening survives reload in the existing draft shape");
  await swapped.context.close();
  const dumbbells=await open(browser,{targetName:"Dumbbell bench press"}),dp=dumbbells.page;
  await startOpening(dp);
  await field(dp,"loadPerSideKg",20);await field(dp,"repsPerSide",8);await answer(dp,"hard");await nextWorking(dp,1);
  await finishEarly(dp);await dp.reload();await waitForAppBoot(dp,{base:BASE});
  await dp.evaluate(id=>window.__repforgeGoToLogExercise(id),dumbbells.target.id);
  const incline=await dp.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>ex.name==="Low incline dumbbell press").id);
  await dp.locator("#woOverflowBtn").click();await dp.locator('[data-workout-action="exercise"]').click();await dp.locator("#exActionSubstBtn").click();
  await dp.locator("#exPickSearch").fill("Low incline dumbbell press");await dp.locator(`#exPickList [data-pick="${incline}"]`).click();
  await dp.locator('[data-pick-reason="equipment"]').click();
  check(await dp.locator(`${card} [data-ramp-start]`).innerText()==="Start at 20 kg","per-hand substitution carries a per-hand working anchor");
  await startOpening(dp);await answer(dp,"hard");await nextWorking(dp,1);
  const perSide=await dp.evaluate(id=>{const rec=window.__repforgeProgression.recommendation(window.__repforgeProgression.programSlot(id));return {current:rec.progressionInputs.currentSession,target:rec.targetSets[1]}},dumbbells.target.id);
  check(perSide.current[0].loadingContext.externalLoadMultiplier===2,"replacement per-hand working evidence keeps the catalog's bilateral multiplier");
  check(perSide.target.result.historyAnchor?.displayLoadKg===20,"a per-hand replacement's working set becomes the engine anchor");
  await dumbbells.context.close();
}
const browser=await launchChromium();
try{
  if(!process.env.REPFORGE_ZERO_SKIP_PARITY)await nonRampParity(browser);
  if(!process.env.REPFORGE_ZERO_PARITY_ONLY){
  await openingNoops(browser);
  await openingChanges(browser);
  if(!process.env.REPFORGE_ZERO_OPENING_CHANGES_ONLY)await ratioJourneys(browser);
  if(!process.env.REPFORGE_ZERO_RATIOS_ONLY&&!process.env.REPFORGE_ZERO_OPENING_CHANGES_ONLY){
  const swapRestore=await open(browser),sp=swapRestore.page,sid=swapRestore.target.id;
  const originalSwap=await exercise(sp);
  await exerciseAction(sp,sid,"#exActionSubstBtn");
  await sp.locator("#exPickSearch").fill("Pendulum");
  await sp.locator("#exPickList .pickrow__name").filter({hasText:/^Pendulum squat$/i}).click();
  await waitForAsyncCondition(sp,()=>!document.querySelector("#exPickSheet")?.classList.contains("is-open")||document.querySelector("#exPickSheet")?.classList.contains("is-reason-step"));
  if(await sp.locator("#exPickSheet.is-reason-step").count())await sp.locator("#exPickReasonSkip").click();
  await sp.locator("#exPickSheet").waitFor({state:"hidden"});
  await waitForDraft(sp);
  // PR 3 supplies the substituted-lift opening UI. Here the actual production
  // commands establish its already-authorized ramp boundary without importing
  // that packet's ratio policy into PR 2.
  const rampExercise=await exercise(sp);
  await sp.evaluate(async ({id,ex})=>{
    const api=window.__repforgeWorkoutDraft;const set=ex.sets[ex.setOrder.find(setId=>ex.sets[setId].role==="working"&&ex.sets[setId].completion==="pending")];
    const edited={...set.edited,effort:"easy",rir:null,metrics:Object.fromEntries(set.programmed.metrics.map(metric=>
      [metric.id,metric.semantic==="loadKg"?"40":String(set.programmed.minReps)]))};
    const inserted=await api.dispatch("insertSet",{exerciseInstanceId:id,beforeSetId:set.setId,setId:"restore-ramp",
      role:"warmup",origin:"ramp",programmed:set.programmed,edited});
    if(inserted.status!=="applied")throw new Error(`ramp setup failed: ${JSON.stringify(inserted)}`);
    const completed=await api.dispatch("completeSet",{exerciseInstanceId:id,setId:"restore-ramp"});
    if(completed.status!=="applied")throw new Error(`ramp completion failed: ${JSON.stringify(completed)}`);
    await api.flush();
  },{id:sid,ex:rampExercise});
  await sp.reload();await waitForAppBoot(sp,{base:BASE});await sp.evaluate(id=>window.__repforgeGoToLogExercise(id),sid);
  await field(sp,"loadKg",40);await field(sp,"reps",8);await answer(sp,"hard");await nextWorking(sp,1);await sp.evaluate(()=>window.stopRest());
  await sp.reload();await waitForAppBoot(sp,{base:BASE});await sp.evaluate(id=>window.__repforgeGoToLogExercise(id),sid);
  const beforeRestore=await exercise(sp);
  await openActions(sp,sid);await sp.locator("#exActionRestoreOrigBtn").click();
  await exercise(sp,{substitutionId:null});
  let afterRestore=await exercise(sp);
  check(afterRestore.substitution===null,"#730: the visible Restore original action succeeds after a ramp and working set");
  await sp.locator("#exActionsSheet").waitFor({state:"hidden"});
  check(afterRestore.setOrder.length===swapRestore.target.sets+1&&afterRestore.setOrder.every((id,index)=>afterRestore.sets[id].ordinal===index+1),
    "#730: restoration retains the ramp and every authored working set in order");
  check(afterRestore.setOrder.every(id=>beforeRestore.sets[id].completion!=="pending"?
    JSON.stringify(afterRestore.sets[id])===JSON.stringify(beforeRestore.sets[id]):
    JSON.stringify(afterRestore.sets[id].programmed.metricIds)===JSON.stringify(originalSwap.sets[id].programmed.metricIds)),
    "#730: completed replacement work is intact and pending sets use the original composition");
  await sp.reload();await waitForAppBoot(sp,{base:BASE});await sp.evaluate(id=>window.__repforgeGoToLogExercise(id),sid);
  afterRestore=await exercise(sp);
  check(afterRestore.substitution===null&&afterRestore.setOrder.every((id,index)=>afterRestore.sets[id].ordinal===index+1),"#730: restoration survives the production reload path");
  for(let count=2;count<=swapRestore.target.sets;count++){
    await field(sp,"loadKg",40);await field(sp,"reps",8);await answer(sp,"hard");
    await waitForDraft(sp,{exerciseId:sid,completedWorking:count});
    await sp.evaluate(()=>window.stopRest());
  }
  await sp.evaluate(async ids=>{const api=window.__repforgeWorkoutDraft;for(const exerciseInstanceId of ids)await api.dispatch("skipExercise",{exerciseInstanceId});await api.flush();},(await waitForDraft(sp)).exerciseOrder.filter(id=>id!==sid));
  check((await sp.evaluate(()=>window.__repforgeSaveWorkout())).committed===true,"#730: restored pending sets stay reachable through normal completion");
  await swapRestore.context.close();
  const compatibility=await open(browser),cp=compatibility.page;
  await startOpening(cp);await answer(cp,"easy");await waitWarmups(cp,1);
  const retainedDraft=await waitForDraft(cp);
  const retained=await waitForAsyncCondition(cp,async ({draftId,revision})=>{
    const api=window.__repforgeWorkoutDraft;await api.flush();
    const read=api.read(),checkpoint=api.checkpoint();
    return read.status==="ok"&&checkpoint.status==="valid"&&checkpoint.value.kind==="committed"&&
      checkpoint.value.draftId===draftId&&checkpoint.value.revision===revision&&checkpoint.value.raw===read.raw
      ?{raw:read.raw,checkpoint:checkpoint.raw}:false;
  },{draftId:retainedDraft.draftId,revision:retainedDraft.revision});
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
  const old=await waitForAsyncCondition(cp,async retained=>{
    await window.__repforgeWorkoutDraft.flush();
    const api=window.__repforgeWorkoutDraft,recovery=api.recovery(),active=api.current();
    const raw=localStorage.getItem("repforge_draft_v1"),checkpoint=localStorage.getItem("repforge_draft_v1:v2-checkpoint");
    return recovery?.copyValue===retained.raw&&!active&&raw===retained.raw&&checkpoint===retained.checkpoint
      ?{recovery,raw,checkpoint,active}:false;
  },retained);
  check(old.recovery?.copyValue===retained.raw&&!old.active,"the previous release explicitly recovers the entire ramp draft instead of hiding prescribed work");
  check(old.raw===retained.raw&&old.checkpoint===retained.checkpoint&&await cp.locator("#draftRecovery").isVisible(),"previous-release recovery retains exact canonical and acknowledged bytes with a visible recovery surface");
  await cp.unroute("**/*",route);await cp.reload();await waitForAppBoot(cp,{base:BASE});
  await cp.evaluate(id=>window.__repforgeGoToLogExercise(id),compatibility.target.id);
  check((await exercise(cp)).setOrder.length===compatibility.target.sets+1,"the new release resumes all working sets after the old release's recovery");
  for(let count=1;count<=compatibility.target.sets;count++){
    await field(cp,"loadKg",40);await answer(cp,"hard");
    await waitForDraft(cp,{exerciseId:compatibility.target.id,completedWorking:count});
    await cp.evaluate(()=>window.stopRest());
  }
  await cp.evaluate(async ids=>{const api=window.__repforgeWorkoutDraft;for(const exerciseInstanceId of ids)await api.dispatch("skipExercise",{exerciseInstanceId});await api.flush();},(await waitForDraft(cp)).exerciseOrder.filter(id=>id!==compatibility.target.id));
  const completed=await cp.evaluate(()=>window.__repforgeSaveWorkout());
  check(completed.committed===true,"all three working sets remain reachable and normal completion saves after returning to the new release");
  await compatibility.context.close();
  const weight=await open(browser,{bodyweight:null}),wp=weight.page;
  const start=wp.locator(`${card} [data-ramp-start]`);
  check((await start.innerText())==="Start at 2.5 kg","missing bodyweight advertises the floor");
  async function bodyweight(value){
    await wp.locator("#sessionSheetBtn").click();await wp.locator("#sessionBodyweight").fill(value);
    await waitForDraft(wp,{bodyweightText:value});
    await wp.locator("#sessionSheetClose").click();
    await waitForAsyncCondition(wp,()=>!document.body.classList.contains("is-sheet-open"));
  }
  await wp.locator(`${card} [data-ramp-bodyweight]`).click();await wp.locator("#sessionBodyweight").fill("80");
  await waitForDraft(wp,{bodyweightText:"80"});await wp.locator("#sessionSheetClose").click();
  await waitForAsyncCondition(wp,()=>!document.body.classList.contains("is-sheet-open"));
  check((await start.innerText())==="Start at 62.5 kg"&&!(await wp.locator(`${card} .fx-cue__evidence`).innerText()).includes("lightest"),
    "acknowledged bodyweight refreshes both the offered load and its explanation");
  await bodyweight("40");check((await start.innerText())==="Start at 30 kg","decreasing bodyweight refreshes the offer");
  await bodyweight("");check((await start.innerText())==="Start at 2.5 kg","removing bodyweight restores the visible floor");
  for(const [value,label] of [["80","Start at 62.5 kg"],["40","Start at 30 kg"],["","Start at 2.5 kg"]]){
    const before=await start.innerText();
    await wp.evaluate(()=>new Promise(ready=>{navigator.locks.request("repforge:draft-write",()=>new Promise(release=>{window.__releaseOpeningWrite=release;ready();}));}));
    await wp.locator("#sessionSheetBtn").click();await wp.locator("#sessionBodyweight").fill(value);
    await wp.locator("#sessionSheetClose").click();await waitForAsyncCondition(wp,()=>!document.body.classList.contains("is-sheet-open"));
    check((await start.innerText())===before,`a held bodyweight write (${value||"removed"}) has not advertised its new load`);
    await start.click();await wp.evaluate(()=>window.__releaseOpeningWrite());
    await waitForDraft(wp);
    await waitForAsyncCondition(wp,label=>document.querySelector("#workout .exercise.is-current [data-ramp-start]")?.textContent===label,label);
    check(orderedSets(await exercise(wp)).every(set=>!set.startingLoad),`the old offer during a held write (${value||"removed"}) never silently applies the new load`);
  }
  await bodyweight("80");
  let accepted=await startOpening(wp);
  check(accepted.startingLoad.openingKg===62.5,"acceptance applies exactly the newly advertised load");
  await bodyweight("40");await bodyweight("");
  accepted=await waitForOpening(wp);
  check(accepted.startingLoad.openingKg===62.5&&(await start.innerText())==="Start at 62.5 kg","bodyweight edits preserve an already accepted pending opening");
  await field(wp,"loadKg",35);await bodyweight("80");
  check((await start.innerText())==="Start at 35 kg","bodyweight edits preserve a load the lifter typed into the pending set");
  await weight.context.close();
  const anchor=await open(browser);
  await startOpening(anchor.page);
  await answer(anchor.page,"easy");await waitWarmups(anchor.page,1);
  await field(anchor.page,"loadKg",40);await answer(anchor.page,"hard");await nextWorking(anchor.page,1);
  const live=await waitForAsyncCondition(anchor.page,async id=>{await window.__repforgeWorkoutDraft.flush();const api=window.__repforgeProgression;const rec=api.recommendation(api.programSlot(id));return {...rec,progressionInputs:rec.progressionInputs};},anchor.target.id);
  check(live.progressionInputs.currentSession[0].setIndex===0,"live engine indexes the first working set at zero after a ramp");
  check(live.targetSets[1].result.historyAnchor.displayLoadKg===40,"the live anchor is the 40 kg working set, never the Easy trial");
  await finishEarly(anchor.page);await anchor.page.reload();await waitForAppBoot(anchor.page,{base:BASE});
  await anchor.page.evaluate(id=>window.__repforgeGoToLogExercise(id),anchor.target.id);
  const historical=await waitForAsyncCondition(anchor.page,async id=>{await window.__repforgeWorkoutDraft.flush();const api=window.__repforgeProgression;const rec=api.recommendation(api.programSlot(id));return {...rec,progressionInputs:rec.progressionInputs};},anchor.target.id);
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
  const weeks=await waitForAsyncCondition(anchor.page,async id=>{await window.__repforgeWorkoutDraft.flush();const rows=window.__rampWeekInputs.filter(item=>item.exerciseId===id);return rows.length?rows:false;},anchor.target.libraryId);
  check(weeks.some(item=>item.history.length===1)&&weeks.every(item=>item.history.every(session=>session.sets.length===1&&session.sets[0].setIndex===0&&session.sets[0].metricValues.some(value=>value.value===40))),
    "Review's week facts and every observed trend reader receive only the 40 kg first working set");
  await anchor.context.close();
  const warmOnly=await open(browser);
  await startOpening(warmOnly.page);await answer(warmOnly.page,"easy");await waitWarmups(warmOnly.page,1);
  await finishEarly(warmOnly.page);await warmOnly.page.reload();await waitForAppBoot(warmOnly.page,{base:BASE});
  await warmOnly.page.evaluate(id=>window.__repforgeGoToLogExercise(id),warmOnly.target.id);
  check(await warmOnly.page.locator(`${card} [data-ramp-start]`).count()===1,"after reload a warm-up-only session still offers session zero");
  const warmStanding=await waitForAsyncCondition(warmOnly.page,async id=>{await window.__repforgeWorkoutDraft.flush();const api=window.__repforgeProgression;return api.recommendation(api.programSlot(id)).engineResults[0].standing;},warmOnly.target.id);
  check(warmStanding.word==="first"&&warmStanding.evidence.sessions===0,"warm-up-only history supplies no standing evidence");
  await warmOnly.context.close();
  const run=await open(browser),{page,target}=run;
  check(await page.locator(`${card} .fx-cue.is-ramp`).count()===1,"fresh no-load program offers Find your weight");
  const expected=await page.evaluate(id=>{
    const raw=window.RepForgeExerciseCatalog.getExercise(id);
    return window.RepForgeStartingLoads.openingLoad({exercise:raw,lookup:id=>window.RepForgeExerciseCatalog.getObject(id),bodyweightKg:80,
      experience:"beginner",convention:"external",grid:Array.from({length:400},(_,i)=>(i+1)*2.5)}).loadKg;
  },target.libraryId);
  await page.evaluate(()=>new Promise(ready=>{navigator.locks.request("repforge:draft-write",()=>new Promise(release=>{window.__releaseOpeningProof=release;ready();}));}));
  try{
    await page.locator(`${card} [data-ramp-start]`).click();
    const blocked=await exercise(page,{}, {drain:false}),set=workingSet(blocked);
    check(!set.startingLoad,"Start click returns while its draft acknowledgement is blocked");
  }finally{await page.evaluate(()=>window.__releaseOpeningProof());}
  let working=await waitForOpening(page),ex=await exercise(page);
  check(working.startingLoad.openingKg===expected&&working.startingLoad.version==="priors@079.1","Start uses the declared 80 kg beginner opening");
  for(let count=1;count<=3;count++){
    await answer(page,"easy");await waitWarmups(page,count);
    ex=await exercise(page);
    check((await page.locator(`${card} .focus-ex__meta`).innerText()).startsWith(`${target.sets} ×`),"the prescription still names only the programmed working sets");
    check(ex.setOrder.length===target.sets+count&&ex.setOrder.map(id=>ex.sets[id]).filter(set=>set.role==="working").length===target.sets,`Easy ${count} preserves every programmed working set`);
    const warm=ex.setOrder.map(id=>ex.sets[id]).filter(set=>set.origin==="ramp").at(-1);
    working=ex.setOrder.map(id=>ex.sets[id]).find(set=>set.role==="working");
    const load=metric=>Number(metric.edited.metrics[metric.programmed.metrics.find(def=>def.semantic==="loadKg").id]);
    check(load(working)>load(warm),`Easy ${count} increases on the load grid`);
  }
  await page.reload();await waitForAppBoot(page,{base:BASE});
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  ex=await exercise(page);
  check(ex.setOrder.map(id=>ex.sets[id]).filter(set=>set.origin==="ramp").length===3,"three ramp sets survive normal boot and reload");
  await answer(page,"easy");await nextWorking(page,1);
  ex=await exercise(page);working=ex.setOrder.map(id=>ex.sets[id]).find(set=>set.role==="working"&&set.completion!=="pending");
  check(working.startingLoad.ramps===3&&working.completion.effortSource==="effort","a fourth Easy hands off at the three-ramp ceiling with opening provenance");
  await waitForAsyncCondition(page,()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  check(await page.locator(`${card} [data-ramp-start]`).count()===0,"working set ends the ramp and the live engine takes over");
  const saved=await finishEarly(page);check(saved.committed,"ramp session saves through the production finish flow");
  const rows=(await storedState(page)).log;
  check(rows.filter(row=>row.warmup).length===3&&rows.filter(row=>row.startingLoad).length===1,"history contains three warm-ups and exactly one opening record");
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check(((await storedState(page)).log).find(row=>row.startingLoad)?.startingLoad.ramps===3,"durable loader retains the opening record");
  await page.evaluate(()=>window.__repforgeShowSettings());
  await page.locator("#dataBackupRow").click();
  const [download]=await Promise.all([page.waitForEvent("download"),page.locator("#exportJson").click()]);
  const backup=JSON.parse(readFileSync(await download.path(),"utf8"));
  check(backup.log.find(row=>row.startingLoad)?.startingLoad.ramps===3,"backup export includes the opening provenance");
  await page.locator("#dataImportRow").click();
  await page.locator("#importJson").setInputFiles({name:"opening-backup.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(backup))});
  await waitForAsyncCondition(page,()=>document.querySelector("#importChoice")?.open===true);
  await page.locator("#importReplace").click();
  await waitForAsyncCondition(page,()=>document.querySelector("#importChoice")?.open===false);
  await page.evaluate(()=>window.__repforgeStorage.flush());
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check(((await storedState(page)).log).find(row=>row.startingLoad)?.startingLoad.ramps===3,"backup Replace and production reload retain the opening provenance");
  await page.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
  await page.locator(`${card} .fx-cue.is-now`).waitFor();
  check(await page.locator(`${card} .fx-cue.is-ramp`).count()===0,"the lift's own saved history replaces the prior with a target on its next session");
  const afterThree=await waitForAsyncCondition(page,async id=>{await window.__repforgeWorkoutDraft.flush();const api=window.__repforgeProgression;return api.recommendation(api.programSlot(id)).lastLoad;},target.id);
  check(afterThree===rows.find(row=>!row.warmup).load,"after three ramps the next session anchors on its first working row");
  await run.context.close();

  const interrupted=await open(browser);
  await startOpening(interrupted.page);
  await answer(interrupted.page,"easy");await waitWarmups(interrupted.page,1);
  await finishEarly(interrupted.page);
  const partial=(await storedState(interrupted.page)).log;
  check(partial.length===1&&partial[0].warmup&&!partial[0].startingLoad,"finishing during a ramp saves only the performed warm-up");
  await interrupted.context.close();

  const typed=await open(browser,{mode:"numeric"});
  await typed.page.locator(`${card} [data-ramp-skip]`).click();
  await typed.page.locator("#wheelSheet.is-open").waitFor();
  check(await typed.page.locator("#wheelCol").getAttribute("aria-valuenow")!==null,"I know my weight opens the load wheel at the opening");
  await typed.page.keyboard.press("Escape");
  await field(typed.page,"loadKg",35);await field(typed.page,"reps",8);await answer(typed.page,1);await nextWorking(typed.page,1);
  const typedSet=orderedSets(await exercise(typed.page)).find(set=>set.role==="working"&&set.completion!=="pending");
  check(typedSet.startingLoad.basis==="typed"&&typedSet.startingLoad.openingKg===35,"skip records the chosen weight as typed");
  await typed.context.close();

  const hard=await open(browser);
  await startOpening(hard.page);
  await answer(hard.page,"hard");await nextWorking(hard.page,1);
  const hardSet=orderedSets(await exercise(hard.page)).find(set=>set.role==="working"&&set.completion!=="pending");
  check(hardSet.role==="working"&&hardSet.startingLoad.ramps===0&&hardSet.completion.effortSource==="effort","Hard is the first working set at the opening weight");
  await hard.context.close();

  const max=await open(browser,{mode:"numeric"});
  await startOpening(max.page);
  await field(max.page,"loadKg",40);await field(max.page,"reps",1);
  await answer(max.page,0);await nextWorking(max.page,1);
  check(orderedSets(await exercise(max.page)).every(set=>!set.origin),"Max becomes working set one without inserting a ramp");
  await waitForAsyncCondition(max.page,()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  const nextLoad=await waitForAsyncCondition(max.page,async id=>{
    await window.__repforgeWorkoutDraft.flush();const api=window.__repforgeProgression,rec=api.recommendation(api.programSlot(id));
    return rec.targetSets.find(item=>item.prescription.setIndex===2)?.targets.loadKg;
  },max.target.id);
  check(nextLoad<40,`a one-rep Max below the prescribed minimum lowers the next target (${nextLoad})`);
  await max.context.close();

  for(const loads of [true,"later"]){
    const planned=await open(browser,{planned:loads});
    check(await planned.page.locator(`${card} .fx-cue.is-ramp`).count()===0,`authored loads skip the ramp, including a load on a later set (${loads})`);
    await planned.context.close();
  }
  }
  console.log(`Session zero: ${checks} passed, 0 failed`);
  }
}finally{await browser.close()}
