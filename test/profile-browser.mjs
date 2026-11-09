#!/usr/bin/env node
/**
 * Plan 081 profile and Plan 077 slow-rep answers and "Was the last rep slow?".
 *
 * - Progress and exercise profiles show standing and counts. Today has no gauge.
 * - The slow tap sits under an exercise's last logged set during its rest (owner: the last set only), never on the
 *   shelf: Next exercise stays live. An answer is stored on the set and reaches History; a second tap takes it back;
 *   the Settings switch turns the question off.
 * - isSafeLogRow accepts a boolean lastRepSlow and refuses anything else.
 *
 * Run: node test/profile-browser.mjs   (REPFORGE_URL points at a static server)
 */
import { launchChromium } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { metricLogRow, installGeneratedProgram, definitionSlot, isWeightRepsSlot } from "./fixtures/history-metric-rows.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
}
const phase = (n) => console.log(`\n${n}`);
const program = seedProgram();
const lifts = program.slice(0, 3);
const today = new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const log = [];
for (let w = 0; w < 6; w++) for (const ex of lifts) for (const set of [1, 2, 3]) log.push({ session: `s${w}`, date: day(42 - w * 7), day: ex.day, name: ex.name,
  exerciseId: ex.id, sourceLibraryId: ex.libraryId, set, load: 60, reps: 9 - set, rir: 2, notes: "", created: `${day(42 - w * 7)}T10:00:00.000Z`, primary: "", secondary: "", effortSource: "rir" });
log.push({ session: "s5", date: day(7), day: lifts[1].day, name: lifts[1].name, exerciseId: lifts[1].id, sourceLibraryId: lifts[1].libraryId, set: 4, load: 60, reps: 12, rir: 0,
  notes: "", created: `${day(7)}T10:30:00.000Z`, primary: "", secondary: "", effortSource: "failure", calibration: { v: 1, predictedReps: 10, predictionEdited: false, prefillBasis: "reps_rir" } });

for (let i=0;i<log.length;i++) {
  const row=log[i],ex=program.find(ex=>ex.id===row.exerciseId);
  log[i]=metricLogRow(seedProgramMeta(),ex,{...row,extra:{effortSource:row.effortSource,...(row.calibration?{calibration:row.calibration}:{})}});
}
log[0].effortSource = "prefilled";
log[0].startingLoad = { v: 1, openingKg: 40, basis: "floor", ramps: 1, version: "priors@079.1" };

async function boot(page, { history = log, settings = {} } = {}) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(async ({ program, meta, history, settings }) => {
    window.stopRest?.();
    for (const key of Object.keys(localStorage)) if (key.startsWith("repforge_draft")) localStorage.removeItem(key);
    const k = "repforge_v1", s = JSON.parse(localStorage.getItem(k) || "{}");
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric", slowRepTaps: true, ...settings }; s.program = program; s.programMeta = meta; s.log = history;
    localStorage.setItem(k, JSON.stringify(s));
    const db = await new Promise((res, rej) => { const r = indexedDB.open("repforge", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(s, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { program, meta: seedProgramMeta(), history, settings });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await page.evaluate(() => window.closeFirstRun?.());
}
/** Enter the first day, fill the first exercise's sets through the draft, and log `n` of them through Log set. */
async function logFirstExercise(page, n) {
  await page.evaluate((day) => window.__repforgeEnterWorkout({ day }), program[0].day);
  await page.waitForSelector("#workout .exercise.is-current .focus-shelf .saveset", { timeout: 20000 });
  await page.evaluate(async () => {
    const api = window.__repforgeWorkoutDraft, d = api.current(), exId = d.exerciseOrder[0];
    for (const setId of d.exercises[exId].setOrder) {
      const set = d.exercises[exId].sets[setId];
      if (Array.isArray(set.programmed.metrics) && set.programmed.metrics.length) {
        for (const m of set.programmed.metrics) await api.dispatch("editMetricValue", { exerciseInstanceId: exId, setId, metricId: m.id, value: /rep/i.test(m.semantic) ? "8" : "60" });
      } else {
        await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "load", value: "60" });
        await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "reps", value: "8" });
      }
      await api.dispatch("editSetField", { exerciseInstanceId: exId, setId, field: "rir", value: "1" });
    }
    await api.flush();
  });
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.click());
    await page.waitForFunction(n => { const d=window.__repforgeWorkoutDraft.current(), ex=d.exercises[d.exerciseOrder[0]]; return ex.setOrder.filter(id=>ex.sets[id].completion!=="pending").length===n; }, i+1);
  }
}
const slowLine = (page) => page.evaluate(() => {
  const line = document.querySelector("#workout .exercise.is-current .ledgerslow");
  return line ? { text: [...line.children].map((el) => el.textContent.trim()).join(" "), pills: line.querySelectorAll("[data-slow]").length,
    under: line.previousElementSibling?.dataset.editn ?? null, inShelf: !!line.closest(".focus-shelf") } : null;
});
const firstSets = (page) => page.evaluate(() => {
  const d = window.__repforgeWorkoutDraft.current(), ex = d.exercises[d.exerciseOrder[0]];
  return ex.setOrder.map((id) => ex.sets[id].completion === "pending" ? "pending" : ex.sets[id].completion.lastRepSlow ?? "unanswered");
});

const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
try {
  phase("The profile replaces the gauge, including on a first session");
  await boot(page, { history: [] });
  assert(await page.locator("#todayCalRing, #todayCalRingBar").count() === 0,
    "Today has no calibration ring before history exists");
  await page.click('[data-view="stats"]');
  await page.waitForSelector("#overviewProfile .profile-lift");
  assert(await page.locator("#overviewProfile .profile-lift").count() === program.length,
    "the profile includes every active program slot before history exists");
  assert((await page.locator("#overviewProfile").innerText()).includes("0 of 0"), "empty evidence is a count, not a target");

  await boot(page);
  assert(await page.locator("#todayCalRing, #todayCalRingBar").count() === 0, "Today has no ring after history either");
  await page.evaluate(() => window.scrollTo(0, 400));
  assert(await page.locator("#todayDash .calring").count() === 0, "the collapsed Today bar has no ring");
  await page.click('[data-view="stats"]');
  await page.waitForSelector("#overviewProfile .profile-lift");
  const profile = await page.locator("#overviewProfile").innerText();
  const names = await page.locator("#overviewProfile .profile-lift__name").allTextContents();
  assert(JSON.stringify(names) === JSON.stringify(program.map(ex => ex.name)), "profile rows follow training-day order", names);
  assert(await page.locator("#overviewProfile .profile-lift__standing").count() === program.length,
    "every program lift has its standing or an explicit unavailable reason");
  assert(!/%/.test(profile) && await page.locator("#overviewProfile [role=progressbar], #overviewProfile .calbar").count() === 0,
    "the profile has no percentage or bar", profile);
  assert(profile.includes("35 of 35 pairs") && profile.includes("15 of 15 week pairs") && profile.includes("0 of 0 sets"),
    "agreement, weeks and suggestion hits show agreed and counted, without target denominators", profile);
  const checks = await page.locator("#overviewProfile .calcheck").allTextContents();
  assert(checks.length === 1 && /Seated leg curl/.test(checks[0]) && /Guessed 10 → Did 12/.test(checks[0]),
    "recent test sets retain the guess and result", checks);
  assert(profile.includes("Started at 40 kg, worked at 60 kg."), "opening and first working load come from the same session", profile);
  assert(profile.includes("2 more test sets"), "per-lift test sets say what is still needed", profile);
  assert(profile.includes("Reps left") && profile.includes("53 of 54"), "effort stage and recent chosen effort counts are shown", profile);
  await page.click('[data-view="log"]');
  await page.locator('#todayExList [data-exopen]').first().click();
  await page.waitForSelector("#exDetail .exercise-profile");
  assert(await page.locator("#exDetail .exercise-profile .profile-lift").count() === 1,
    "the exercise page shows only its lift's profile below its recommendation");
  const overlaps = async () => page.evaluate(() => [...document.querySelectorAll("#overviewProfile .profile-signal")].flatMap(row => {
    const [label, value] = row.children, range = document.createRange();
    const boxes = el => { range.selectNodeContents(el); return [...range.getClientRects()]; };
    const hit = boxes(label).some(a => boxes(value).some(b => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5));
    return hit || row.scrollWidth > row.clientWidth + 1 ? [label.textContent] : [];
  }));
  await page.click("#exBack");
  await page.click('[data-view="stats"]');
  const sizes = [];
  for (const [lang, width] of [["pt", 390], ["en", 390], ["pt", 320], ["en", 320]]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(lang => { I18N.setLang(lang); document.documentElement.style.fontSize = "200%"; render(); }, lang);
    const overflow = await page.locator("#overviewProfile").evaluate(el=>el.scrollWidth>el.clientWidth+1);
    sizes.push([`${lang} ${width}`, [...await overlaps(),...(overflow?["profile overflows"]:[])]]);
  }
  assert(sizes.every(([, rows]) => rows.length === 0), "counts wrap without overlap at 200% in PT/EN at 390/320", sizes);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; I18N.setLang("en"); render(); });
  await page.setViewportSize({ width: 390, height: 844 });

  phase("Chosen effort uses only the last ten sessions");
  const windowHistory = Array.from({length:12},(_,i)=>({...log[0],session:`recent-${i}`,date:day(12-i),
    created:`${day(12-i)}T10:00:00.000Z`,effortSource:i<2||i===11?"prefilled":"rir"}));
  await boot(page,{history:windowHistory});
  await page.click('[data-view="stats"]');
  assert((await page.locator("#overviewProfile .profile-effort").innerText()).includes("9 of 10"),
    "prefilled effort and the two older sessions do not inflate chosen effort counts");

  phase("Saved ramp-only sessions still occupy the latest-ten window");
  const rampContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  try {
    const rampPage=await rampContext.newPage();
    await rampPage.goto(BASE,{waitUntil:"domcontentloaded"});
    await rampPage.waitForFunction(()=>window.__repforgeBooted===true);
    const generated=await installGeneratedProgram(rampPage);
    generated.settings.rirMode="effort";
    await rampPage.evaluate(async next=>{
      const result=await window.__repforgeCommitProposedState(next);
      if(!result.committed)throw new Error("word-stage fixture proposal refused");
      await window.__repforgeStorage.flush();
    },generated);
    const target=generated.program.find(ex=>isWeightRepsSlot(definitionSlot(generated.programMeta,ex))&&ex.sets>=3);
    await rampPage.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
    const card="#workout .exercise.is-current";
    await rampPage.locator(`${card} [data-ramp-start]`).click();
    await rampPage.locator(`${card} [data-shelf-field="rir"]`).click();
    await rampPage.locator(`${card} [data-effchip][data-e="easy"]`).click();
    await rampPage.evaluate(()=>window.__repforgeWorkoutDraft.flush());
    await rampPage.locator(`${card} .saveset`).click();
    await rampPage.waitForFunction(()=>{
      const draft=window.__repforgeWorkoutDraft.current(),ex=draft.exercises[draft.session.selectedExerciseId];
      return Object.values(ex.sets).some(set=>set.origin==="ramp"&&set.completion!=="pending");
    });
    await finishEarly(rampPage);
    const warm=await rampPage.evaluate(()=>JSON.parse(localStorage.getItem("repforge_v1")).log[0]);
    assert(warm?.warmup===true&&warm.origin==="ramp"&&!warm.startingLoad,"production early finish saves a ramp-only session");
    async function installHistory(history){
      await rampPage.evaluate(async next=>{
        const result=await window.__repforgeCommitProposedState(next);
        if(!result.committed)throw new Error("profile regression history proposal refused");
        await window.__repforgeStorage.flush();
      },{...generated,log:history});
      await rampPage.reload({waitUntil:"domcontentloaded"});
      await rampPage.waitForFunction(()=>window.__repforgeBooted===true);
      await rampPage.click('nav [data-view="stats"]');
    }
    const rampWindow=Array.from({length:12},(_,i)=>{
      const date=day(12-i),session=`ramp-window-${i}`,created=`${date}T10:00:00.000Z`;
      return i>=10?{...warm,session,date,created}:metricLogRow(generated.programMeta,target,{session,date,created,set:1,load:40,reps:8,
        extra:{effortSource:i<2?"prefilled":"effort"}});
    });
    await installHistory(rampWindow);
    for(const [lang,reading] of [["en","8 of 8"],["pt","8 de 8"]]){
      await rampPage.evaluate(lang=>{I18N.setLang(lang);render();},lang);
      const text=await rampPage.locator("#overviewProfile .profile-effort").innerText();
      assert(text.includes(reading),`${lang}: the last ten saved sessions contain eight chosen working sets, not ten`,text);
    }
    const sources=["effort","rir","reps_left","reps_left_5plus","effort","rir","prefilled","unsure","prefilled",null];
    const ordinary=Array.from({length:12},(_,i)=>sources.map((source,set)=>metricLogRow(generated.programMeta,target,{
      session:`ordinary-${i}`,date:day(12-i),set:set+1,load:40,reps:8,
      extra:{...(source?{effortSource:i<2?"prefilled":source}:{})}
    }))).flat();
    await installHistory(ordinary);
    const text=await rampPage.locator("#overviewProfile .profile-effort").innerText();
    assert(text.includes("60 of 90"),"ordinary sessions keep 60/90; prefilled, unsure and source-less rows do not inflate chosen counts",text);
  } finally {await rampContext.close()}

  phase("Profiles keep their movement's saved evidence during a live swap");
  const swapContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
  try {
    const swapPage=await swapContext.newPage();
    await swapPage.goto(BASE,{waitUntil:"domcontentloaded"});
    await swapPage.waitForFunction(()=>window.__repforgeBooted===true);
    const generated=await installGeneratedProgram(swapPage);
    const target=generated.program.find(ex=>ex.name==="Hack squat");
    if(!target)throw new Error("generated fixture needs Hack squat");
    generated.settings.rirMode="effort";
    generated.profile={weightKg:80};
    generated.log=[metricLogRow(generated.programMeta,target,{session:"opening",date:day(40),set:1,load:40,reps:8,rir:2,
      extra:{effortSource:"effort",startingLoad:{v:1,openingKg:35,basis:"floor",ramps:1,version:"priors@079.1"}}}),
      ...[33,19,5].map((age,i)=>metricLogRow(generated.programMeta,target,{session:`check-${i}`,date:day(age),set:1,load:40,reps:8,rir:0,
        extra:{effortSource:"failure",calibration:{v:1,predictedReps:8,predictionEdited:false,prefillBasis:"reps_rir"}}}))];
    await swapPage.evaluate(async next=>{
      const result=await window.__repforgeCommitProposedState(next);
      if(!result.committed)throw new Error("swap profile fixture refused");
      await window.__repforgeStorage.flush();
    },generated);
    await swapPage.reload({waitUntil:"domcontentloaded"});
    await swapPage.waitForFunction(()=>window.__repforgeBooted===true);
    const profile=swapPage.locator("#overviewProfile .profile-lift").filter({has:swapPage.locator("h4",{hasText:"Hack squat"})}).first();
    async function overview(){
      await swapPage.locator('nav [data-view="stats"]').click();
      return {profile:await profile.innerText(),history:await swapPage.locator("#overviewProfile .profile-signal")
        .filter({has:swapPage.locator("span",{hasText:/^Hack squat$/})}).innerText()};
    }
    async function originalDetail(){
      await swapPage.locator('nav [data-view="program"]').click();
      await swapPage.locator(`#programOverview [data-exopen="${target.id}"]`).click();
      const text=await swapPage.locator("#exDetail .profile-lift").innerText();
      await swapPage.locator("#exBack").click();
      return text;
    }
    const baseline=await overview(),detail=await originalDetail();
    assert(baseline.profile.includes("3 test sets")&&baseline.profile.includes("Started at 35 kg, worked at 40 kg")&&baseline.history.includes("4"),
      "Hack squat baseline has its own three checks, opening load and four history rows",baseline);
    await swapPage.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
    const replacementId=await swapPage.evaluate(()=>window.RepForgeExerciseCatalog.snapshot().exercises.find(ex=>ex.name==="Pendulum squat").id);
    await swapPage.locator("#woOverflowBtn").click();
    await swapPage.locator('[data-workout-action="exercise"]').click();
    await swapPage.locator("#exActionSubstBtn").click();
    await swapPage.locator("#exPickSearch").fill("Pendulum squat");
    await swapPage.locator(`#exPickList [data-pick="${replacementId}"]`).click();
    await swapPage.locator('[data-pick-reason="equipment"]').click();
    await swapPage.waitForFunction(id=>{
      const draft=window.__repforgeWorkoutDraft.current();
      return draft.exercises[draft.session.selectedExerciseId].substitution?.replacement?.libraryId===id;
    },replacementId);
    await swapPage.evaluate(()=>window.__repforgeWorkoutDraft.flush());
    await swapPage.locator('[data-pick-reason="equipment"]').waitFor({state:"hidden"});
    async function replacementProfile(label){
      await swapPage.locator('.wo-head__name[data-exopen]').click();
      const text=await swapPage.locator("#exDetail .profile-lift").innerText();
      assert(text.includes("Pendulum squat")&&text.includes("First time on this lift")&&text.includes("No test sets yet")&&!text.includes("Started at"),
        `${label}: Pendulum has zero checks, no standing history and no borrowed opening load`,text);
      await swapPage.locator("#exBack").click();
    }
    for(const reload of [false,true]){
      if(reload){
        await swapPage.reload({waitUntil:"domcontentloaded"});
        await swapPage.waitForFunction(()=>window.__repforgeBooted===true);
        await swapPage.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
      }
      const label=reload?"reloaded swap":"live swap";
      await replacementProfile(label);
      await swapPage.locator("#leaveWorkout").click();
      const reading=await overview();
      assert(JSON.stringify(reading)===JSON.stringify(baseline),`${label}: Overview retains Hack standing, checks, opening and history`,reading);
      const readingDetail=await originalDetail();
      assert(readingDetail===detail,`${label}: Program detail retains Hack's own profile`,readingDetail);
    }
    await swapPage.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
    await swapPage.locator("#woOverflowBtn").click();
    await swapPage.locator('[data-workout-action="exercise"]').click();
    await swapPage.locator("#exActionRestoreOrigBtn").click();
    await swapPage.evaluate(()=>window.__repforgeWorkoutDraft.flush());
    await swapPage.locator("#leaveWorkout").click();
    for(const reload of [false,true]){
      if(reload){
        await swapPage.reload({waitUntil:"domcontentloaded"});
        await swapPage.waitForFunction(()=>window.__repforgeBooted===true);
        await swapPage.evaluate(id=>window.__repforgeGoToLogExercise(id),target.id);
        await swapPage.locator("#leaveWorkout").click();
      }
      const reading=await overview();
      assert(JSON.stringify(reading)===JSON.stringify(baseline)&&await originalDetail()===detail,
        `${reload?"reloaded restore":"restore"}: Hack's saved profile stays unchanged`,reading);
    }
  } finally {await swapContext.close()}

  phase("Was the last rep slow? Only after an exercise's last set");
  await boot(page);
  await logFirstExercise(page, 1);
  assert(await slowLine(page) === null, "no question after a set that is not the exercise's last");
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf .saveset")?.click());
  await page.waitForSelector("#workout .exercise.is-current .ledgerslow");
  let line = await slowLine(page);
  assert(line?.pills === 2 && line.text === "Last rep slow? Yes No" && line.under === "2" && !line.inShelf,
    "after the last set, the question sits under that set's row, off the shelf", line);
  const next = await page.evaluate(() => { const b = document.querySelector("#workout .exercise.is-current [data-fnext]"); return !!b && !b.disabled; });
  assert(next, "Next exercise stays live under it");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='0']").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slowclear]");
  line = await slowLine(page);
  assert(line?.pills === 0 && line.text === "Last rep slow? No" && JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", false]),
    "an answer is stored on the last set and stays as a word", { line, sets: await firstSets(page) });
  await page.locator("#workout .exercise.is-current .ledgerslow [data-slowclear]").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slow]");
  assert(JSON.stringify(await firstSets(page)) === JSON.stringify(["unanswered", "unanswered"]) && (await slowLine(page))?.pills === 2,
    "a second tap takes the answer back and asks again");
  await page.locator("#workout .exercise.is-current .ledgerslow [data-v='1']").click();
  await page.waitForSelector("#workout .exercise.is-current [data-slowclear]");
  await finishEarly(page);
  const saved = await page.evaluate((name) => JSON.parse(localStorage.getItem("repforge_v1")).log
    .filter((row) => !/^s\d$/.test(String(row.session)) && (row.name === name || row.performedName === name)).map((row) => row.lastRepSlow ?? null), program[0].name);
  assert(JSON.stringify(saved) === JSON.stringify([null, true]), "the answer reaches the last set's History row and no other", saved);

  phase("The switch turns the question off");
  await boot(page, { settings: { slowRepTaps: false } });
  await logFirstExercise(page, 2);
  assert(await slowLine(page) === null, "with the switch off there is no question");

  phase("The app validates the answer");
  const validity = await page.evaluate(() => {
    const base = JSON.parse(JSON.stringify(state));
    const shape = (value) => { const s = JSON.parse(JSON.stringify(base)); s.log[0] = { ...s.log[0], lastRepSlow: value }; return window.__repforgeValidateStateShape(s); };
    return { yes: shape(true), no: shape(false), text: shape("yes"), one: shape(1) };
  });
  assert(validity.yes && validity.no && !validity.text && !validity.one, "isSafeLogRow accepts a boolean lastRepSlow and refuses anything else", validity);
  assert(errors.length === 0, "no page errors", errors);
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
