#!/usr/bin/env node
/**
 * Plan 077 PR 3, the max set, through the real Focus screen.
 *
 *   - During the rest before an exercise's last set, a prompt offers a test set; "Make a guess" opens the guess sheet,
 *     prefilled with the set before's reps + reps left − 1, with the failure rule and safety lines.
 *   - "Use as my last set" makes the last set a max set: the effort field reads Failure and the row carries the guess.
 *   - Logging it saves a normal 0-RIR set with effortSource "failure" and the guess as `calibration`, in both
 *     replicas, and the row compares the guess with the reps.
 *   - The prompt respects its limits: once a workout, the Settings switch, and "Not now".
 *
 * Run: node test/max-set-browser.mjs   (REPFORGE_URL points at a static server)
 */
import { chooseRepsLeft, launchChromium, openShelfField } from "./browser.mjs";
import { seedProgram, seedProgramMeta } from "./fixtures/seed-program.mjs";
import { finishEarly, openActions, selectExercise } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail !== undefined) console.log(`    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

async function persist(page, src) {
  await page.evaluate(
    async ({ k, src }) => {
      const blob = JSON.parse(localStorage.getItem(k) || "{}");
      // eslint-disable-next-line no-new-func
      new Function("s", "w", src)(blob, window);
      localStorage.setItem(k, JSON.stringify(blob));
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("repforge", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("kv", "readwrite");
        tx.objectStore("kv").put(blob, k);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { k: KEY, src }
  );
}

async function settle(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active")) window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && window.closeTour) window.closeTour();
  });
}

const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
const SHELF = "#workout .exercise.is-current .focus-shelf";
const FIELD_IDS = { load: `metric_${WEIGHT}`, reps: `metric_${REPS}` };
const field = (id) => `${SHELF} [data-shelf-field="${FIELD_IDS[id] || id}"]`;
const inputFor = (id, n) => `${SHELF} .shelf__input[data-k$="_${n}_${FIELD_IDS[id] || id}"]`;

async function typeField(page, id, n, value) {
  if (id === "rir") {
    await chooseRepsLeft(page, String(value));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    return;
  }
  const input = page.locator(inputFor(id, n));
  for (let tap = 0; tap < 2 && await input.getAttribute("aria-hidden") === "true"; tap++) await openShelfField(page, field(id));
  await input.fill(value);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

async function readReplicas(page) {
  return page.evaluate(async (k) => {
    const local = JSON.parse(localStorage.getItem(k) || "null");
    const db = await new Promise((res, rej) => { const r = indexedDB.open("repforge", 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const idb = await new Promise((res, rej) => { const tx = db.transaction("kv"); const g = tx.objectStore("kv").get(k); g.onsuccess = () => res(g.result); g.onerror = () => rej(g.error); });
    db.close();
    return { local, idb };
  }, KEY);
}

const TIP = `${SHELF} .resttip`;
const draftNow = (page) => page.evaluate(() => window.__repforgeWorkoutDraft.current());

async function logSet(page, exId, n, { load = "50", reps = "10", rir = "2" } = {}) {
  await typeField(page, "load", n, load);
  await typeField(page, "reps", n, reps);
  if (rir != null) await typeField(page, "rir", n, rir);
  await page.locator(`${SHELF} .saveset`).click();
  await page.waitForFunction(({ id, n }) => {
    const ex = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
    return ex && Object.values(ex.sets).find((set) => set.ordinal === n)?.completion !== "pending";
  }, { id: exId, n }, { timeout: 10000 });
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("dialog", (d) => d.accept());
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate((d) => {
    for (const key of Object.keys(localStorage)) if (key === d || key.startsWith(`${d}:`)) localStorage.removeItem(key);
  }, DRAFT);
  await persist(page, `
    s.settings = { ...(s.settings || {}), lang: "en", rirMode: "numeric", restSec: 120 };
    s.program = ${JSON.stringify(seedProgram())};
    s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = [];`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); window.__repforgeFocus.to(0); });
  await page.waitForSelector(`${SHELF}`, { state: "attached", timeout: 5000 });
  const exId = await page.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId);
  const total = await page.evaluate((id) => Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets)
    .filter((set) => set.role === "working").length, exId);
  assert(total >= 2, "the first lift has at least two working sets", total);

  phase("No prompt before the last set");
  await logSet(page, exId, 1);
  if (total > 2) {
    assert(await page.locator(TIP).count() === 0, "the set before the last one gets no prompt");
    for (let n = 2; n < total; n++) await logSet(page, exId, n);
  }

  phase("During the rest before the last set: the prompt, then the guess");
  await page.waitForSelector(`${TIP}`, { state: "visible", timeout: 5000 });
  const tipText = await page.locator(TIP).innerText();
  assert(/still learning this lift/i.test(tipText), "the invite explains why the check is requested", tipText);
  assert(/test set/i.test(tipText) && /50 kg/.test(tipText), "the prompt names the test set and the load", tipText);
  phase("A real discomfort mark suppresses the offer until cleared");
  await openActions(page, exId);
  await page.locator("#exActionDiscomfortBtn").click();
  await page.waitForFunction(() => document.querySelector("#exActionDiscomfortBtn")?.getAttribute("aria-pressed") === "true");
  const marked = await draftNow(page);
  assert(marked.exercises[exId].discomfort?.some(item => item.kind === "discomfort"),
    "the real control records discomfort on the active lift");
  await page.locator("#exActionsClose").click();
  await page.locator("#exActionsSheet").waitFor({state:"hidden"});
  assert(await page.locator(`${TIP}[data-tip="max-set"]`).count() === 0,
    "the real mark removes today's test-set offer on that lift");
  await openActions(page, exId);
  await page.locator("#exActionDiscomfortBtn").click();
  await page.waitForFunction(() => document.querySelector("#exActionDiscomfortBtn")?.getAttribute("aria-pressed") === "false");
  const cleared = await draftNow(page);
  assert(!cleared.exercises[exId].discomfort?.length, "the real control clears the mark");
  await page.locator("#exActionsClose").click();
  await page.locator("#exActionsSheet").waitFor({state:"hidden"});
  await page.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  assert(await page.locator(`${TIP}[data-tip="max-set"]`).isVisible(),
    "clearing the mark restores the otherwise eligible test-set offer");
  phase("Estimator request and every safety ceiling");
  const gates = await page.evaluate((id) => {
    const originalDraft = activeWorkoutDraft, originalLog = state.log, originalSettings = state.settings, originalMeta = state.programMeta;
    const engine = window.RepForgeProgression;
    const draft = JSON.parse(JSON.stringify(originalDraft));
    const ex = sessionExercise(prog.find(id)), de = draft.exercises[id];
    const working = de.setOrder.map(key => de.sets[key]).filter(set => set.role === "working");
    const final = working.at(-1), before = working.at(-2), date = draft.program.scheduleDate;
    const key = maxSetDraftKey(de, final);
    const ago = days => new Date(Date.parse(date + "T00:00:00Z") - days * 864e5).toISOString().slice(0, 10);
    let word = "learning", sets = 2;
    window.RepForgeProgression = { ...engine, recommendSets: (...args) => engine.recommendSets(...args).map(result => ({
      ...result, standing: {version:"standing@078.1",word,reasons:[],evidence:{sets}} })) };
    const offer = () => maxSetOffer(ex, final.ordinal);
    const outcomes = {};
    try {
      activeWorkoutDraft = draft;
      outcomes.learning = !!offer();
      const status = draft.session.status; draft.session.status = "completed"; outcomes.activeSession = !offer(); draft.session.status = status;
      final.completion = JSON.parse(JSON.stringify(before.completion)); outcomes.pendingLast = !offer(); final.completion = "pending";
      const edited = JSON.parse(JSON.stringify(before.edited));
      for (const metric of before.programmed.metrics || []) if (metric.semantic === "reps") before.edited.metrics[metric.id] = "0";
      before.edited.reps = "0"; outcomes.validGuess = !offer(); before.edited = edited;
      const order = [...de.setOrder]; de.setOrder = [final.setId]; outcomes.minSets = !offer(); de.setOrder = order;
      outcomes.highReps = !maxSetOffer({...ex,max:21,hasRepTarget:true}, final.ordinal);
      const libraryId = final.programmed.sourceLibraryId;
      final.programmed.sourceLibraryId = window.RepForgeExerciseCatalog.snapshot().exercises.find(item => item.name === "Barbell back squat").id;
      outcomes.ineligible = !offer(); final.programmed.sourceLibraryId = libraryId;
      state.programMeta = {...originalMeta,started:date,programDefinition:{...originalMeta.programDefinition,deloadCycles:[1]}};
      outcomes.deload = !offer(); state.programMeta = originalMeta;
      const completion = before.completion; before.completion = "pending"; outcomes.pending = !offer(); before.completion = completion;
      maxSetDeclined.add(`${draft.draftId}:${id}`); outcomes.declined = !offer(); maxSetDeclined.delete(`${draft.draftId}:${id}`);
      outcomes.notLast = !maxSetOffer(ex, before.ordinal);
      state.settings = {...originalSettings, maxSetPrompts:false}; outcomes.off = !offer(); state.settings = originalSettings;
      const oldEffort = before.edited.effort, oldRir = before.edited.rir;
      before.edited.effort = "max"; before.edited.rir = "0"; outcomes.afterMax = !offer();
      before.edited.effort = oldEffort; before.edited.rir = oldRir;
      final.calibration = {v:1,predictedReps:10,predictionEdited:false,prefillBasis:"reps"}; outcomes.workout = !offer(); delete final.calibration;
      const row = {calibration:{v:1,predictedReps:10,predictionEdited:false,prefillBasis:"reps"},effortSource:"failure",sourceLibraryId:key};
      state.log = [...originalLog,{...row,date:ago(13)}]; outcomes.key13 = !offer();
      state.log = [...originalLog,{...row,date:ago(14)}]; outcomes.key14 = !!offer();
      state.log = [...originalLog,{...row,sourceLibraryId:"other1",date},{...row,sourceLibraryId:"other2",date}]; outcomes.week = !offer();
      state.log = originalLog;
      for (const kind of ["pain","discomfort"]) {
        // Plan 082 owns this draft record and the commands that create it. Read its exact observation shape.
        de.discomfort = [{exerciseId:key,name:de.displayName,kind,swapped:true,replacementId:"other"}];
        outcomes[kind] = !offer();
      }
      de.discomfort = [{exerciseId:"unrelated",name:"Other lift",kind:"pain",swapped:false}];
      outcomes.otherPain = !!offer(); delete de.discomfort;
      // A solid calibrated lift reads its last check from the saved rows, independently of the global gauge.
      const actualRecommendation = recommendation;
      recommendation = current => {
        const rec = actualRecommendation(current);
        return {...rec, calibration:{state:"calibrated",n:3}, standing:{word,evidence:{sets}}};
      };
      try {
        word = "solid";
        state.log = [...originalLog,{...row,date:ago(59)}]; outcomes.day59 = !offer();
        state.log = [...originalLog,{...row,date:ago(60)}]; outcomes.day60 = offer()?.reason === "recheck";
        state.log = originalLog; word = "learning";
        const secondId = draft.exerciseOrder.find(otherId => otherId !== id && prog.find(otherId));
        const second = draft.exercises[secondId], secondEx = sessionExercise(prog.find(secondId));
        const secondWorking = second.setOrder.map(key => second.sets[key]).filter(set => set.role === "working");
        for (const set of secondWorking.slice(0,-1)) {
          set.completion = JSON.parse(JSON.stringify(before.completion));
          set.edited.rir = "2"; set.edited.effort = "hard";
          for (const metric of set.programmed.metrics || []) set.edited.metrics[metric.id] = metric.semantic === "reps" ? "10" : "50";
        }
        recommendation = current => ({...actualRecommendation(current),calibration:{state:"uncalibrated",n:0},
          standing:{word:"learning",evidence:{sets:current.id===id?10:1}}});
        outcomes.lessEvidence = !offer() && !!maxSetOffer(secondEx,secondWorking.at(-1).ordinal);
        recommendation = current => ({...actualRecommendation(current),calibration:{state:"uncalibrated",n:0},
          standing:{word:"learning",evidence:{sets:1}}});
        outcomes.tieOrder = !!offer() && !maxSetOffer(secondEx,secondWorking.at(-1).ordinal);
      } finally { recommendation = actualRecommendation; }
      return outcomes;
    } finally { activeWorkoutDraft = originalDraft; state.log = originalLog; state.settings = originalSettings; state.programMeta = originalMeta; window.RepForgeProgression = engine; }
  }, exId);
  for (const [gate, passed] of Object.entries(gates)) assert(passed, `request gate: ${gate}`, gates);
  await page.locator(`${TIP} [data-maxset-guess]`).click();
  await page.waitForSelector("#maxSetSheet.is-open", { timeout: 5000 });
  const sheet = await page.evaluate(() => ({
    title: document.querySelector("#maxSetTitle").textContent, from: document.querySelector("#maxSetFrom").textContent,
    count: document.querySelector("#maxSetCount").textContent, rule: document.querySelector(".maxset__rule").textContent,
    safety: document.querySelector(".maxset__safety").textContent,
  }));
  assert(sheet.count === "11" && /50 kg/.test(sheet.title) && /10 reps with 2 left/.test(sheet.from),
    "the guess is prefilled with reps + reps left − 1 at the set before's load", sheet);
  assert(/good form/.test(sheet.rule) && /hurts/.test(sheet.safety), "the failure rule and the safety line are read before the set", sheet);
  await page.locator("#maxSetMore").click();
  await page.locator("#maxSetStart").click();
  await page.waitForFunction(() => !document.querySelector("#maxSetSheet.is-open"), undefined, { timeout: 5000 });
  const started = await page.evaluate(({ id, n }) => Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets)
    .find((set) => set.ordinal === n).calibration, { id: exId, n: total });
  assert(JSON.stringify(started) === JSON.stringify({ v: 1, predictedReps: 12, predictionEdited: true, prefillBasis: "reps_rir" }),
    "Use as my last set holds the edited guess on the last set", started);
  const shelfEffort = await page.locator(`${SHELF} [data-shelf-field="rir"]`).innerText();
  assert(/Failure/.test(shelfEffort), "the effort field reads Failure", shelfEffort);
  const tag = await page.locator(`#workout .exercise.is-current .ledgerline__tag`).innerText();
  assert(/guess 12/i.test(tag), "the pending row carries the guess", tag);

  phase("Logging it: a normal 0-RIR set with the guess beside it");
  await logSet(page, exId, total, { reps: "14", rir: null });
  const done = await page.evaluate(({ id, n }) => {
    const set = Object.values(window.__repforgeWorkoutDraft.current().exercises[id].sets).find((item) => item.ordinal === n);
    return { rir: set.edited.rir, source: set.completion.effortSource, calibration: set.calibration?.predictedReps };
  }, { id: exId, n: total });
  assert(done.rir === "0" && done.source === "failure" && done.calibration === 12, "the max set logs 0 reps left as failure", done);
  await page.evaluate(() => document.querySelector("#workout .exercise.is-current [data-ledgermore][aria-expanded='false']:not([hidden])")?.click());
  const result = await page.locator(`#workout .exercise.is-current .ledgerline__result`).innerText();
  assert(/12/.test(result) && /14/.test(result) && /2 more than you guessed/.test(result) && /Nothing changes yet: after 2 more test sets/.test(result),
    "the row compares the guess with the reps", result);

  phase("Once a workout, and the Settings switch");
  const offers = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current();
    return focusList().map((ex) => maxSetOffer(sessionExercise(ex), Object.values(draft.exercises[ex.id]?.sets || {}).filter((set) => set.role === "working").length)).filter(Boolean).length;
  });
  assert(offers === 0, "no other lift is offered one in the same workout", offers);

  phase("History keeps the guess, in both replicas");
  await finishEarly(page);
  const saved = await readReplicas(page);
  const maxRow = (replica) => replica.log.find((row) => row.exerciseId === exId && row.set === total);
  assert(JSON.stringify(maxRow(saved.local)?.calibration) === JSON.stringify(started) && maxRow(saved.local)?.rir === 0 &&
    maxRow(saved.local)?.effortSource === "failure" && JSON.stringify(maxRow(saved.local)) === JSON.stringify(maxRow(saved.idb)),
    "the saved row is a 0-RIR failure set with its calibration, identically in localStorage and IndexedDB", maxRow(saved.local));
  const validity = await page.evaluate(() => {
    const base = JSON.parse(JSON.stringify(state)), at = base.log.findIndex((row) => row.calibration);
    const withGuess = (value) => { const s = JSON.parse(JSON.stringify(base)); s.log[at] = { ...s.log[at], calibration: value }; return window.__repforgeValidateStateShape(s); };
    return { good: withGuess({ v: 1, predictedReps: 9, predictionEdited: false, prefillBasis: "reps" }),
      bad: withGuess({ v: 1, predictedReps: "9", predictionEdited: false, prefillBasis: "reps" }), extra: withGuess({ v: 1, predictedReps: 9, predictionEdited: false, prefillBasis: "reps", x: 1 }) };
  });
  assert(validity.good && !validity.bad && !validity.extra, "isSafeLogRow accepts a well-formed calibration and refuses others", validity);

  phase("The next workout: the 14-day limit, then the switch");
  await page.evaluate(async () => { await window.__repforgeEnterWorkout({}); window.__repforgeFocus.to(0); });
  await page.waitForSelector(`${SHELF}`, { state: "attached", timeout: 5000 });
  const again = await page.evaluate(() => {
    const draft = window.__repforgeWorkoutDraft.current(), ex = focusList()[0];
    return draft.exercises[ex.id] ? maxSetDraftKey(draft.exercises[ex.id], Object.values(draft.exercises[ex.id].sets)[0]) : null;
  });
  const history = await page.evaluate(() => state.log.filter((row) => row.calibration).map((row) => maxSetRowKey(row)));
  assert(history.length === 1 && history[0] === again, "a History row and a draft set of the same lift share one key", { history, again });
  await page.evaluate(() => { state.settings.maxSetPrompts = false; });
  const off = await page.evaluate(() => focusList().map((ex) => maxSetOffer(sessionExercise(ex),
    Object.values(window.__repforgeWorkoutDraft.current().exercises[ex.id]?.sets || {}).filter((set) => set.role === "working").length)).filter(Boolean).length);
  assert(off === 0, "with the prompts switched off, nothing is offered", off);
  phase("Three checks: the lift's suggestions start allowing for them (Plan 077 PR 5)");
  // Two earlier sessions of the same lift, each with a max set guessed 12 and done 14, ten and twenty days ago.
  await persist(page, `
    const today = s.log.find((row) => row.calibration).date;
    const shift = (days) => new Date(Date.parse(today + "T00:00:00Z") - days * 864e5).toISOString().slice(0, 10);
    const first = s.log.filter((row) => row.session === s.log.find((r) => r.calibration).session);
    for (const days of [10, 20]) for (const row of first)
      s.log.push({ ...JSON.parse(JSON.stringify(row)), session: row.session + "-" + days, date: shift(days), created: row.created - days * 864e5 });`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
  const cal = await page.evaluate((id) => {
    // The seed program's sets carry no target RIR, so the engine leaves them manual; what matters here is what the app
    // hands it. (The engine's own reading of the shift is proved in test/progression-engine-plan067.mjs.)
    const engine = window.RepForgeProgression, given = [];
    window.RepForgeProgression = { ...engine, recommendSets: (...args) => { given.push(args[4]); return engine.recommendSets(...args); } };
    try {
      const ex = sessionExercise(prog.find(id)), rec = recommendation(ex);
      return { n: rec.calibration.n, state: rec.calibration.state, delta: rec.calibration.delta, moved: rec.calibration.moved,
        given: given.at(-1)?.calibration ?? null, why: whySheetModel(ex).blocks.some((block) => block.leadKey === "engine-calibration") };
    } finally { window.RepForgeProgression = engine; }
  }, exId);
  assert(cal.n === 3 && cal.state === "under" && Math.abs(cal.delta + 1) < 1e-9, "three checks of −2 read as under-estimating, shift −1", cal);
  assert(cal.given?.version === "calibration@077.1" && cal.given?.delta === -1 && cal.given?.n === 3 && cal.given?.state === "under" && Number.isFinite(cal.given?.spread), "the engine is given the lift's shift", cal);
  const line = await page.evaluate((id) => {
    // Today's max set on top of the three in the log: its result line says suggestions now allow for it.
    const ex = sessionExercise(prog.find(id)), de = window.__repforgeWorkoutDraft.current().exercises[id];
    const set = JSON.parse(JSON.stringify(de.sets[de.setOrder.at(-1)]));
    const reps = set.programmed.metrics.find((metric) => metric.semantic === "reps");
    set.completion = { completedAt: new Date().toISOString(), effortSource: "failure" };
    set.calibration = { v: 1, predictedReps: 12, predictionEdited: false, prefillBasis: "reps_rir" };
    set.edited.metrics[reps.id] = "14";
    const box = document.createElement("div"); box.innerHTML = maxSetResultHtml(set, recommendation(ex));
    return box.textContent;
  }, exId);
  assert(/2 more than you guessed\. Suggestions on this exercise now allow for this\./.test(line), "from the third check the result line says suggestions now allow for it", line);
  assert(cal.why === cal.moved, "the Why sheet names the tendency exactly when the shift moved the suggestion", cal);

  phase("Saved pain protects the movement for the whole day");
  const safetyContext = await browser.newContext({viewport:{width:390,height:844},locale:"en-US",timezoneId:"America/Sao_Paulo"});
  const safety = await safetyContext.newPage();
  safety.on("pageerror", error => errors.push(String(error)));
  safety.on("dialog", dialog => dialog.accept());
  await safety.clock.setFixedTime(new Date("2026-11-09T12:00:00Z"));
  await safety.goto(BASE,{waitUntil:"domcontentloaded"}); await settle(safety);
  await persist(safety, `
    s.settings = {...s.settings,lang:"en",rirMode:"numeric",restSec:120};
    s.program = ${JSON.stringify(seedProgram())}; s.programMeta = ${JSON.stringify(seedProgramMeta())};
    s.log = []; delete s.sessionEvents;`);
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety);
  const enterFirstDay = async () => {
    await safety.evaluate(async () => { await window.__repforgeEnterWorkout({day:"Day 1"}); window.__repforgeFocus.to(0); });
    await safety.locator(SHELF).waitFor({state:"visible"});
  };
  const finishSafety = async () => {
    await finishEarly(safety);
    await safety.locator("#sumDone").click();
    await safety.locator("#sessionSummary").waitFor({state:"hidden"});
  };
  await enterFirstDay();
  const safetyId = await safety.evaluate(() => window.__repforgeWorkoutDraft.current().session.selectedExerciseId);
  const movementId = seedProgram().find(row => row.id === safetyId).libraryId;
  await logSet(safety,safetyId,1);
  await safety.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  await openActions(safety,safetyId);
  await safety.locator("#exActionSkipBtn").click();
  await safety.locator('[data-skip-reason="pain"]').click();
  await safety.locator("#skipReasonSheet").waitFor({state:"hidden"});
  await safety.evaluate(async id => {
    await WorkoutSession.dispatch("restoreExercise",{exerciseInstanceId:id}); renderWorkout(); window.__repforgeFocus.to(0);
  },safetyId);
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).count() === 0,"restoring a pain-skipped movement keeps the live protection");
  await finishSafety();
  const painful = await readReplicas(safety);
  const painSession = painful.local.log.find(row => row.exerciseId === safetyId).session;
  assert(painful.local.sessionEvents[painSession].pain.some(item => item.exerciseId === movementId && item.kind === "pain") &&
    JSON.stringify(painful.local.sessionEvents) === JSON.stringify(painful.idb.sessionEvents),
    "the real finish saves movement-specific pain in both replicas");
  await enterFirstDay(); await logSet(safety,safetyId,1);
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).count() === 0,"saved same-day pain blocks a new workout's offer");
  await selectExercise(safety,"seed-ex-2"); await logSet(safety,"seed-ex-2",1);
  await safety.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).isVisible(),"another movement remains eligible despite today's saved pain");
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety); await enterFirstDay();
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).count() === 0,"saved same-day pain stays protective after reload");
  await finishSafety();
  await safety.clock.setFixedTime(new Date("2026-11-10T12:00:00Z"));
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety);
  await enterFirstDay(); await logSet(safety,safetyId,1);
  await safety.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).isVisible(),"yesterday's saved pain alone permits today's opportunity");
  for (const pressed of ["true","false"]) {
    await openActions(safety,safetyId); await safety.locator("#exActionDiscomfortBtn").click();
    await safety.waitForFunction(value => document.querySelector("#exActionDiscomfortBtn")?.getAttribute("aria-pressed") === value,pressed);
    await safety.locator("#exActionsClose").click(); await safety.locator("#exActionsSheet").waitFor({state:"hidden"});
  }
  const sessionsBeforeClear = new Set(Object.keys((await readReplicas(safety)).local.sessionEvents));
  await finishSafety();
  const clearSaved = (await readReplicas(safety)).local;
  const clearedSession = Object.keys(clearSaved.sessionEvents).find(id => !sessionsBeforeClear.has(id));
  assert(clearSaved.sessionEvents[clearedSession].pain.length === 0,"a mark cleared before finishing saves no pain observation");
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety);
  await enterFirstDay(); await logSet(safety,safetyId,1);
  await safety.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).isVisible(),"a saved cleared mark does not block a later same-day workout after reload");
  phase("Pain reported after local midnight survives the session's earlier workout date");
  await finishSafety();
  await safety.clock.setFixedTime(new Date("2026-11-11T02:58:00Z"));
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety);
  await enterFirstDay(); await logSet(safety,safetyId,1);
  await safety.locator(`${TIP}[data-tip="max-set"]`).waitFor({state:"visible"});
  await safety.clock.setFixedTime(new Date("2026-11-11T03:02:00Z"));
  await openActions(safety,safetyId); await safety.locator("#exActionDiscomfortBtn").click();
  await safety.waitForFunction(() => document.querySelector("#exActionDiscomfortBtn")?.getAttribute("aria-pressed") === "true");
  await safety.locator("#exActionsClose").click(); await safety.locator("#exActionsSheet").waitFor({state:"hidden"});
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).count() === 0,"a real after-midnight mark blocks the live offer");
  const spanningSessionIds = new Set(Object.keys((await readReplicas(safety)).local.sessionEvents));
  await finishSafety();
  const spanning = (await readReplicas(safety)).local;
  const spanningId = Object.keys(spanning.sessionEvents).find(id => !spanningSessionIds.has(id));
  const spanningRow = spanning.log.find(row => row.session === spanningId);
  assert(spanningRow.date === "2026-11-10" && spanningRow.created === "2026-11-11T03:02:00.000Z" &&
    spanning.sessionTiming[spanningId].completedAt === spanningRow.created &&
    spanning.sessionEvents[spanningId].pain.some(item => item.exerciseId === movementId && item.kind === "discomfort"),
    "the real finish retains yesterday's workout date and today's local completion with the discomfort observation");
  await safety.reload({waitUntil:"domcontentloaded"}); await settle(safety);
  await enterFirstDay(); await logSet(safety,safetyId,1);
  assert(await safety.evaluate(() => today()) === "2026-11-11","the restarted workout is on the next local day in Sao Paulo");
  assert(await safety.locator(`${TIP}[data-tip="max-set"]`).count() === 0,
    "after-midnight saved discomfort blocks the same movement after finish, reload and restart");
  const calendarCases = await safety.evaluate(({session,id}) => {
    const original = {log:state.log,events:state.sessionEvents,timing:state.sessionTiming};
    const rows = state.log.filter(row => row.session === session), events = {[session]:state.sessionEvents[session]};
    const ex = sessionExercise(prog.find(id)), de = activeWorkoutDraft.exercises[id];
    const n = de.setOrder.map(key => de.sets[key]).filter(set => set.role === "working").at(-1).ordinal;
    const previous = "2026-11-11T02:58:00.000Z", current = "2026-11-11T03:02:00.000Z";
    const scenarios = [
      {name:"row completion protects today without sessionTiming",date:"2026-11-10",created:current,allowed:false},
      {name:"sessionTiming protects today when row completion is yesterday",date:"2026-11-10",created:previous,
        timing:{startedAt:"2026-11-11T03:00:00.000Z",completedAt:current,durationSeconds:120},allowed:false},
      {name:"workout date protects today despite an earlier completion",date:"2026-11-11",created:previous,allowed:false},
      {name:"a UTC-today completion confined to local yesterday permits today",date:"2026-11-10",created:previous,allowed:true},
      {name:"a readable old workout date suffices without completion evidence",date:"2026-11-10",created:null,allowed:true},
      {name:"a readable old completion suffices without a workout date",date:null,created:previous,allowed:true},
      {name:"unreadable workout and completion dates refuse the offer",date:null,created:null,allowed:false},
    ];
    try {
      state.sessionEvents = events;
      return scenarios.map(scenario => {
        state.log = rows.map(row => ({...row,date:scenario.date,created:scenario.created}));
        state.sessionTiming = scenario.timing ? {[session]:scenario.timing} : {};
        return {name:scenario.name,passed:!!maxSetOffer(ex,n) === scenario.allowed};
      });
    } finally {state.log=original.log;state.sessionEvents=original.events;state.sessionTiming=original.timing;}
  }, {session:spanningId,id:safetyId});
  for (const scenario of calendarCases) assert(scenario.passed,scenario.name);
  await safety.evaluate(() => window.__repforgeStorage.flush());
  await persist(safety, `s.sessionEvents[${JSON.stringify(painSession)}].pain = {unreadable:true};`);
  await safety.reload({waitUntil:"domcontentloaded"});
  await safety.locator("#storageRecovery").waitFor({state:"visible"});
  const unreadable = await safety.evaluate(() => ({active:!!activeWorkoutDraft,tips:document.querySelectorAll('[data-tip="max-set"]').length}));
  assert(!unreadable.active && unreadable.tips === 0,"unreadable saved pain evidence enters production recovery without an offer",unreadable);
  await safetyContext.close();

  assert(errors.length === 0, "no page errors", errors.join(" | "));
} finally {
  await browser.close();
}
console.log(`\nMax set: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
