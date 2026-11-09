/** Session-zero journeys, composed into the existing draft-parity PR command. */
import assert from "node:assert/strict";
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
  const target=state.program.find(row=>isWeightRepsSlot(definitionSlot(state.programMeta,row))&&row.sets>=3);
  assert.ok(target,"generated fixture has a weighted slot");
  await page.evaluate(({id,mode,planned})=>{
    const state=JSON.parse(localStorage.getItem("repforge_v1"));
    state.profile={weightKg:80};state.programMeta.experience="beginner";
    state.settings.rirMode=mode;delete state.settings.effortScale;
    if(planned){
      const slot=state.programMeta.programDefinition.days.flatMap(day=>day.slots||[]).find(slot=>slot.id===id);
      for(const cycle of slot.prescriptionsByCycle)for(const set of cycle.sets)set.targets.loadKg=40;
    }
    localStorage.setItem("repforge_v1",JSON.stringify(state));
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
  await answer(page,"hard");await nextWorking(page,1);
  ex=await exercise(page);working=Object.values(ex.sets).find(set=>set.role==="working"&&set.completion!=="pending");
  check(working.startingLoad.ramps===3&&working.completion.effortSource==="effort","Hard hands off with opening provenance and word effort");
  await page.waitForFunction(()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  check(await page.locator(`${card} [data-ramp-start]`).count()===0,"working set ends the ramp and the live engine takes over");
  const saved=await finishEarly(page);check(saved.committed,"ramp session saves through the production finish flow");
  const rows=await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log);
  check(rows.filter(row=>row.warmup).length===3&&rows.filter(row=>row.startingLoad).length===1,"history contains three warm-ups and exactly one opening record");
  await page.reload();await waitForAppBoot(page,{base:BASE});
  check((await page.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log)).find(row=>row.startingLoad)?.startingLoad.ramps===3,"durable loader retains the opening record");
  await run.context.close();

  const typed=await open(browser,{mode:"numeric"});
  await typed.page.locator(`${card} [data-ramp-skip]`).click();
  await typed.page.locator("#wheelSheet.is-open").waitFor();
  check(await typed.page.locator("#wheelCol").getAttribute("aria-valuenow")!==null,"I know my weight opens the load wheel at the opening");
  await typed.page.keyboard.press("Escape");
  await field(typed.page,"loadKg",35);await field(typed.page,"reps",8);await answer(typed.page,1);await nextWorking(typed.page,1);
  const typedSet=Object.values((await exercise(typed.page)).sets).find(set=>set.completion!=="pending");
  check(typedSet.startingLoad.basis==="typed"&&typedSet.startingLoad.openingKg===35,"skip records the chosen weight as typed");
  await typed.context.close();

  const max=await open(browser,{mode:"numeric"});
  await max.page.locator(`${card} [data-ramp-start]`).click();
  await answer(max.page,0);await nextWorking(max.page,1);
  check(Object.values((await exercise(max.page)).sets).every(set=>!set.origin),"Max becomes working set one without inserting a ramp");
  await max.page.waitForFunction(()=>document.querySelector("#workout .exercise.is-current .fx-cue.is-now"));
  await max.context.close();

  const planned=await open(browser,{planned:true});
  check(await planned.page.locator(`${card} .fx-cue.is-ramp`).count()===0,"authored loads skip the ramp");
  await planned.context.close();
  console.log(`Session zero: ${checks} passed, 0 failed`);
}finally{await browser.close()}
