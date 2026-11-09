/** Session-zero journeys, composed into the existing draft-parity PR command. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import { launchChromium, waitForAppBoot, openShelfField, chooseRepsLeft } from "./browser.mjs";
import { installGeneratedProgram, definitionSlot, isWeightRepsSlot } from "./fixtures/history-metric-rows.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE=process.env.REPFORGE_URL||"http://localhost:8000/";
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;console.log(`  ✓ ${label}`)};
const card="#workout .exercise.is-current";
async function open(browser,{mode="effort",planned=false}={}){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
  await page.goto(BASE);await waitForAppBoot(page,{base:BASE});
  const state=await installGeneratedProgram(page,{name:"Opening-load proof"});
  const squats=await page.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises
    .filter(ex=>ex.movementPattern?.some(id=>window.RepForgeExerciseCatalog.getObject(id)?.name==="Squat")).map(ex=>ex.id));
  const target=state.program.find(row=>squats.includes(row.libraryId)&&isWeightRepsSlot(definitionSlot(state.programMeta,row))&&row.sets>=3);
  assert.ok(target,"generated fixture has a weighted squat");
  await page.evaluate(async ({id,mode,planned})=>{
    const state=JSON.parse(localStorage.getItem("repforge_v1"));
    state.profile={weightKg:80};state.programMeta.experience="beginner";
    state.settings.rirMode=mode;delete state.settings.effortScale;
    if(planned){
      const slot=state.programMeta.programDefinition.days.flatMap(day=>day.slots||[]).find(slot=>slot.id===id);
      for(const cycle of slot.prescriptionsByCycle)for(const [index,set] of cycle.sets.entries())if(planned!=="later"||index>0)set.targets.loadKg=40;
    }
    await window.__repforgeCommitProposedState(state);
    await window.__repforgeStorage.flush();
  },{id:target.id,mode,planned});
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
const browser=await launchChromium();
try{
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
}finally{await browser.close()}
