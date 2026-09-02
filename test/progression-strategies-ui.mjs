#!/usr/bin/env node
/**
 * The strategies approved in the Plan 046 numeric gate have to be usable, not
 * merely computable.
 *
 * `test/progression-engine.mjs` proves the arithmetic against the locked
 * fixture. This gate proves the other half: that a program slot carrying a
 * `rep_goal@1`, `effort_target@1`, or `anchor_backoff@1` prescription renders a
 * recommendation, per-set targets, and an explanation in the running app — in
 * both English and Portuguese, without ever leaking an internal strategy id or
 * a raw translation key at the lifter.
 *
 * Run: REPFORGE_URL=http://localhost:8000/ node test/progression-strategies-ui.mjs
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT_KEY = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}

const iso = (daysAgo) => {
  const d = new Date("2026-08-27T12:00:00.000Z");
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const settings = (lang, { unit = "kg", rirMode = "numeric" } = {}) => ({
  jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "",
  unit, lang, rirMode, voiceInputEnabled: false,
  notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
});

const REP_GOAL = {
  schemaVersion: 1,
  strategy: {
    id: "rep_goal",
    version: 1,
    params: {
      workingSets: 3, repGoal: 30, repFloor: 6, repCeiling: 12,
      targetRirMin: 1, targetRirMax: 3,
      minLoadIncrement: 2.5, jumpPercent: 2.5,
      distributionPolicy: "balanced_frontload_v1",
    },
  },
  modifiers: [],
};

const ANCHOR = {
  schemaVersion: 1,
  strategy: {
    id: "anchor_backoff",
    version: 1,
    params: {
      anchorRepMin: 3, anchorRepMax: 5, anchorTargetRirMin: 1, anchorTargetRirMax: 3,
      backoffSets: 3, backoffRepMin: 6, backoffRepMax: 10, backoffPercent: 0.8,
      minLoadIncrement: 2.5, jumpPercent: 2.5,
    },
  },
  modifiers: [],
};

const EFFORT_TARGET = {
  schemaVersion: 1,
  strategy: {
    id: "effort_target",
    version: 1,
    params: {
      workingSets: 2, targetReps: 5, targetRirMin: 2, targetRirMax: 3,
      minLoadIncrement: 2.5,
    },
  },
  modifiers: [],
};

function slot({ sets, min, max, progression }) {
  return [{
    id: "ex0", day: "Day 1", order: 1, name: "Bench press", sets, min, max,
    primary: "Chest", secondary: "Triceps", notes: "", alternates: [], progression,
  }];
}

function log(sessions) {
  const rows = [];
  for (const [daysAgo, sets] of sessions) {
    const date = iso(daysAgo);
    const session = `${date}_Day 1_seed`;
    sets.forEach(([load, reps, rir], i) => {
      rows.push({
        session, date, day: "Day 1", name: "Bench press", exerciseId: "ex0",
        set: i + 1, load, reps, rir, notes: "",
        created: `${date}T12:00:00.00${i}Z`, primary: "Chest", secondary: "Triceps",
      });
    });
  }
  return rows;
}

const three = (load, reps, rir) => [[load, reps, rir], [load, reps, rir], [load, reps, rir]];

async function seed(page, blob) {
  await page.evaluate(async ({ k, d }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  }, { k: KEY, d: DRAFT_KEY });
  await page.evaluate(async ({ k, value }) => {
    localStorage.setItem(k, JSON.stringify(value));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, value: blob });
}

async function capture(page, { lang, program, rows, current, unit = "kg", rirMode = "numeric" }) {
  await seed(page, {
    settings: settings(lang, { unit, rirMode }),
    programMeta: {
      id: "prog-strategy", name: "Strategy fixture", started: iso(90),
      created: "2026-05-01T00:00:00.000Z", updated: "2026-05-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: null, experience: null, daysPerWeek: 1, splitType: "full_body",
      equipment: ["barbell"], priorityMuscles: [], sessionLength: "60", completedAt: null,
    },
    program,
    log: rows,
    programHistory: [],
  });
  await page.reload();
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.closeFirstRun?.());
  return page.evaluate((done) => {
    const P = window.__repforgeProgression;
    const ex = P.programSlot("ex0");
    if (!ex) throw new Error("strategy fixture slot ex0 did not load");
    const rec = P.recommendation(ex);
    const draft = { __done: [], __warm: [], __touched: [] };
    (done || []).forEach(([load, reps, rir], i) => {
      const key = `ex0_${i + 1}`;
      draft.__done.push(key);
      draft[`${key}_load`] = String(load);
      draft[`${key}_reps`] = String(reps);
      draft[`${key}_rir`] = String(rir);
    });
    const suggestions = [];
    for (let n = 1; n <= ex.sets; n++) suggestions.push(P.setSuggestion(ex, n, rec, draft, null));
    return { rec, suggestions, explain: P.explainRecommendation(ex) };
  }, current || []);
}

async function openInstalledEditor(page, id = "ex0") {
  await page.click('nav button[data-view="program"]');
  if (await page.locator("#programEditorWrap").evaluate((el) => el.classList.contains("is-hidden"))) {
    await page.click("#programEditToggle");
  }
  await page.waitForSelector('#programEditor [data-role="editor"]');
  const row = page.locator(`#programEditor [data-role="exercise"][data-id="${id}"]`);
  await row.waitFor();
  if (!(await row.evaluate((element) => element.classList.contains("is-expanded")))) {
    await row.locator('[data-role="toggle-exercise"]').click();
  }
  return row;
}

async function storedSlot(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "{}").program?.find((ex) => ex.id === "ex0"), KEY);
}

async function applyInstalledEditor(page) {
  await page.click("#programEditToggle");
  await page.waitForFunction(() => document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"));
}

async function workoutSurface(page) {
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.waitForSelector('#workout article[data-ex="ex0"] .setrow');
  const list = await page.evaluate(() => {
    const card = document.querySelector('#workout article[data-ex="ex0"]');
    return {
      loads: [...card.querySelectorAll('.setrow input[data-k$="_load"]')].map((input) => input.value),
      reps: [...card.querySelectorAll('.setrow input[data-k$="_reps"]')].map((input) => input.value),
      recommendation: card.querySelector('.recblock__body')?.textContent?.trim() || "",
      effortControls: card.querySelectorAll('.effort[role="radiogroup"]').length,
    };
  });
  await page.locator('#workout article[data-ex="ex0"] [data-why="ex0"]').click();
  await page.waitForSelector('#whySheet.is-open');
  const why = (await page.locator('#whyBody').textContent()).trim();
  await page.click('#whyClose');
  await page.waitForSelector('#whySheet', { state: 'hidden' });
  await page.click('#woOverflowBtn');
  await page.waitForSelector('#woOverflow:not(.hidden)');
  await page.click('#modeFocus');
  await page.waitForSelector('#workout.is-focus article.is-current .curset');
  const focus = await page.evaluate(() => {
    const card = document.querySelector('#workout.is-focus article.is-current');
    return {
      load: card.querySelector('.curset input[data-k$="_load"]')?.value || "",
      reps: card.querySelector('.curset input[data-k$="_reps"]')?.value || "",
      whyName: card.querySelector('[data-why]')?.getAttribute('aria-label') || "",
      effortSpinner: !!card.querySelector('[role="spinbutton"][data-effspin]'),
    };
  });
  return { list, focus, why };
}

/** Nothing the lifter reads may carry an internal identifier or a raw key. */
const LEAKS = [/rep_goal/i, /effort_target/i, /anchor_backoff/i, /@1\b/, /\brange@/i, /^[a-z]+\.[a-z_.]+$/];
function prose(capture) {
  return [capture.rec.label, capture.rec.text, ...capture.explain.flatMap((row) => [row.label, row.text])]
    .filter((value) => typeof value === "string" && value.length);
}
function leaked(capture) {
  return prose(capture).filter((text) => LEAKS.some((pattern) => pattern.test(text)));
}

const browser = await launchChromium();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await waitForAppBoot(page, { base: BASE });

  const repGoalProgram = slot({ sets: 3, min: 6, max: 12, progression: REP_GOAL });
  const effortTargetProgram = slot({ sets: 2, min: 5, max: 5, progression: EFFORT_TARGET });
  const anchorProgram = slot({ sets: 4, min: 3, max: 10, progression: ANCHOR });

  console.log("rep_goal@1");
  const goalMet = await capture(page, { lang: "en", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(goalMet.rec.status === "add", "the earned total advances the load", goalMet.rec.status);
  assert(goalMet.rec.load === 102.5, "the advanced load reaches the lifter", goalMet.rec.load);
  assert(goalMet.rec.label.length > 0 && goalMet.rec.text.includes("30"),
    "the copy names the authored total", goalMet.rec.text);
  assert(goalMet.suggestions.every((s) => s.reps === 10 && s.load === 102.5),
    "every set carries the redistributed target", JSON.stringify(goalMet.suggestions));
  assert(goalMet.explain.length > 0, "the explanation sheet has rows");
  assert(leaked(goalMet).length === 0, "no strategy id or raw key reaches the lifter", leaked(goalMet).join(" | "));
  const goalSurface = await workoutSurface(page);
  assert(goalSurface.list.loads.every((value) => value === "102.5") && goalSurface.list.reps.every((value) => value === "10"),
    "List renders the engine's total-rep load and per-set targets", JSON.stringify(goalSurface.list));
  assert(goalSurface.focus.load === goalSurface.list.loads[0] && goalSurface.focus.reps === goalSurface.list.reps[0],
    "Focus renders the same engine target as List", JSON.stringify(goalSurface.focus));
  assert(goalMet.explain.filter((row) => row.text).every((row) => goalSurface.why.includes(row.text)),
    "Why this weight renders the same engine-backed explanation", goalSurface.why);

  const goalMissed = await capture(page, { lang: "en", program: repGoalProgram, rows: log([[7, three(100, 8, 2)]]) });
  assert(goalMissed.rec.status === "hold", "missing the total holds the load", goalMissed.rec.status);
  assert(goalMissed.rec.text.includes("24") && goalMissed.rec.text.includes("30"),
    "the copy names progress toward the total", goalMissed.rec.text);

  const partial = await capture(page, {
    lang: "en", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]),
    current: [[100, 11, 3], [100, 10, 3]],
  });
  assert(partial.suggestions[2].reps === 9, "the third set asks for the exact remaining reps", partial.suggestions[2].reps);
  assert(partial.suggestions[2].load === 100, "an in-session target holds the session load", partial.suggestions[2].load);
  await capture(page, { lang: "en", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.locator('[data-k="ex0_2_load"]').fill("77.5");
  await page.locator('[data-k="ex0_2_reps"]').fill("7");
  await page.locator('[data-save="ex0_1"]').click();
  await page.waitForSelector('[data-save="ex0_1"][aria-pressed="true"]');
  assert(await page.locator('[data-k="ex0_2_load"]').inputValue() === "77.5" &&
    await page.locator('[data-k="ex0_2_reps"]').inputValue() === "7",
  "logging a completed set preserves a user-touched future set");

  console.log("effort_target@1");
  const effortAdvance = await capture(page, {
    lang: "en", program: effortTargetProgram,
    rows: log([[7, [[100, 5, 4], [100, 5, 4]]]]),
  });
  assert(effortAdvance.rec.status === "add" && effortAdvance.rec.load === 102.5,
    "fixed reps above the effort ceiling advance one load step", JSON.stringify(effortAdvance.rec));
  assert(effortAdvance.suggestions.every((set) => set.load === 102.5 && set.reps === 5),
    "fixed reps and authored effort targets stay fixed after the load change", JSON.stringify(effortAdvance.suggestions));
  assert(leaked(effortAdvance).length === 0, "effort-target copy exposes no internal identifier", leaked(effortAdvance).join(" | "));
  const effortTargetSurface = await workoutSurface(page);
  assert(effortTargetSurface.list.loads.every((value) => value === "102.5") && effortTargetSurface.list.reps.every((value) => value === "5"),
    "List renders the fixed-rep engine target", JSON.stringify(effortTargetSurface.list));
  assert(effortAdvance.explain.filter((row) => row.text).every((row) => effortTargetSurface.why.includes(row.text)),
    "Why this weight renders the effort evidence and authored target", effortTargetSurface.why);

  const noRir = await capture(page, {
    lang: "en", program: effortTargetProgram,
    rows: log([[7, [[100, 5, null], [100, 5, null]]]]),
  });
  assert(noRir.rec.status === "hold" && noRir.rec.load === 100 && noRir.rec.text.includes("no effort entry"),
    "missing RIR holds actionable load without fabricated effort", JSON.stringify(noRir.rec));

  const differentMachineRows = log([[7, [[100, 5, 4], [100, 5, 4]]]]).map((row) => ({
    ...row, performedLibraryId: "pr_sm", performedName: "Smith machine bench press",
  }));
  const exactMachineProgram = structuredClone(effortTargetProgram);
  exactMachineProgram[0].libraryId = "pr_bb";
  const differentMachine = await capture(page, {
    lang: "en", program: exactMachineProgram, rows: differentMachineRows,
  });
  assert(differentMachine.rec.status === "new" && differentMachine.rec.load === null,
    "a different machine identity contributes no effort-target history", JSON.stringify(differentMachine.rec));

  const currentEffort = await capture(page, {
    lang: "en", program: effortTargetProgram, rows: [], current: [[100, 4, 4]],
  });
  assert(currentEffort.suggestions[1].src === "session-down" && currentEffort.suggestions[1].load === 97.5 && currentEffort.suggestions[1].reps === 5,
    "a current rep miss reduces only the next untouched set", JSON.stringify(currentEffort.suggestions));
  await capture(page, {
    lang: "en", program: effortTargetProgram,
    rows: log([[7, [[100, 5, 2], [100, 5, 2]]]]),
  });
  await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
  await page.locator('[data-k="ex0_2_load"]').fill("77.5");
  await page.locator('[data-k="ex0_2_reps"]').fill("7");
  await page.locator('[data-save="ex0_1"]').click();
  await page.waitForSelector('[data-save="ex0_1"][aria-pressed="true"]');
  assert(await page.locator('[data-k="ex0_2_load"]').inputValue() === "77.5" &&
    await page.locator('[data-k="ex0_2_reps"]').inputValue() === "7",
  "effort-target refresh preserves a user-touched future set");

  console.log("anchor_backoff@1");
  const anchorAdvance = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
  });
  assert(anchorAdvance.rec.status === "add", "a top set at the range top advances", anchorAdvance.rec.status);
  assert(anchorAdvance.suggestions[0].load === 102.5, "the anchor set carries the advanced load", anchorAdvance.suggestions[0].load);
  assert(anchorAdvance.suggestions.slice(1).every((s) => s.load === 82.5),
    "the back-off sets carry the derived load", JSON.stringify(anchorAdvance.suggestions.slice(1)));
  assert(anchorAdvance.suggestions[0].load > anchorAdvance.suggestions[1].load,
    "the anchor is always heavier than its back-offs");
  assert(leaked(anchorAdvance).length === 0, "no strategy id or raw key reaches the lifter", leaked(anchorAdvance).join(" | "));
  const anchorSurface = await workoutSurface(page);
  assert(anchorSurface.list.loads[0] === "102.5" && anchorSurface.list.loads.slice(1).every((value) => value === "82.5"),
    "List renders the engine's heavy and lighter targets", JSON.stringify(anchorSurface.list));
  assert(anchorSurface.focus.load === anchorSurface.list.loads[0] && anchorSurface.focus.reps === anchorSurface.list.reps[0],
    "Focus starts from the same heavy target as List", JSON.stringify(anchorSurface.focus));

  const anchorLogged = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
    current: [[100, 5, 2]],
  });
  assert(anchorLogged.suggestions[1].load === 80,
    "today's anchor re-derives the untouched back-offs", anchorLogged.suggestions[1].load);
  assert(anchorLogged.rec.text.length > 0, "the in-session copy explains the lighter sets");

  const anchorFailed = await capture(page, {
    lang: "en", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
    current: [[100, 2, 0]],
  });
  // The header recommendation is the next-session decision; the recalibration
  // is what the still-unlogged sets get, which is where it has to land.
  assert(anchorFailed.suggestions[1].src === "session-down",
    "a failed anchor recalibrates the untouched sets rather than pushing on", anchorFailed.suggestions[1].src);
  assert(anchorFailed.suggestions[1].load < anchorAdvance.suggestions[1].load,
    "the recalibrated back-off is lighter than the advancing one",
    `${anchorFailed.suggestions[1].load} vs ${anchorAdvance.suggestions[1].load}`);
  assert(leaked(anchorFailed).length === 0, "a recalibration says so in plain language", leaked(anchorFailed).join(" | "));

  console.log("Portuguese");
  const ptGoal = await capture(page, { lang: "pt", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(ptGoal.rec.label !== goalMet.rec.label, "the label follows the UI language", ptGoal.rec.label);
  assert(ptGoal.rec.load === 102.5, "the target is language-independent", ptGoal.rec.load);
  assert(leaked(ptGoal).length === 0, "Portuguese copy leaks nothing either", leaked(ptGoal).join(" | "));

  const ptAnchor = await capture(page, {
    lang: "pt", program: anchorProgram,
    rows: log([[7, [[100, 5, 2], [80, 8, 2], [80, 8, 2], [80, 8, 2]]]]),
  });
  assert(ptAnchor.rec.label !== anchorAdvance.rec.label, "the anchor label follows the UI language", ptAnchor.rec.label);
  assert(leaked(ptAnchor).length === 0, "Portuguese anchor copy leaks nothing", leaked(ptAnchor).join(" | "));
  const ptEffortTarget = await capture(page, {
    lang: "pt", program: effortTargetProgram,
    rows: log([[7, [[100, 5, 4], [100, 5, 4]]]]),
  });
  assert(ptEffortTarget.rec.label !== effortAdvance.rec.label && ptEffortTarget.rec.load === effortAdvance.rec.load,
    "effort-target copy follows the UI language without changing the target", JSON.stringify(ptEffortTarget.rec));

  console.log("units and effort mode");
  const lbGoal = await capture(page, { lang: "en", unit: "lb", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(lbGoal.rec.status === goalMet.rec.status && lbGoal.rec.load === goalMet.rec.load &&
    JSON.stringify(lbGoal.suggestions) === JSON.stringify(goalMet.suggestions),
  "kg and lb use the same internal recommendation and actionable grid");
  const lbSurface = await workoutSurface(page);
  assert(lbSurface.list.loads.every((value) => Number(value) > 220) && lbSurface.why.includes("lb"),
    "lb converts display values and explanation units without changing strategy", JSON.stringify(lbSurface));

  const effortGoal = await capture(page, { lang: "en", rirMode: "effort", program: repGoalProgram, rows: log([[7, three(100, 10, 2)]]) });
  assert(effortGoal.rec.status === goalMet.rec.status && effortGoal.rec.load === goalMet.rec.load,
    "effort entry mode does not change the recommendation");
  const effortSurface = await workoutSurface(page);
  assert(effortSurface.list.effortControls === 3 && effortSurface.focus.effortSpinner,
    "new strategy targets remain operable in List and Focus effort controls", JSON.stringify(effortSurface));

  const missingEffort = await capture(page, { lang: "en", rirMode: "effort", program: repGoalProgram, rows: log([[7, three(100, 10, null)]]) });
  const conservativeEffort = await capture(page, { lang: "en", rirMode: "effort", program: repGoalProgram, rows: log([[7, three(100, 10, 1)]]) });
  assert(missingEffort.rec.status === conservativeEffort.rec.status && missingEffort.rec.load === conservativeEffort.rec.load,
    "missing effort stays conservative instead of becoming extra evidence");
  const cappedEffort = await capture(page, { lang: "en", rirMode: "effort", program: repGoalProgram, rows: log([[7, three(100, 10, 99)]]) });
  const trustedCeiling = await capture(page, { lang: "en", rirMode: "effort", program: repGoalProgram, rows: log([[7, three(100, 10, 4)]]) });
  assert(cappedEffort.rec.status === trustedCeiling.rec.status && cappedEffort.rec.load === trustedCeiling.rec.load,
    "untrusted effort is capped at the trusted ceiling");

  console.log("legacy programs are untouched");
  const legacySlot = slot({ sets: 3, min: 6, max: 10, progression: null });
  delete legacySlot[0].progression;
  const legacy = await capture(page, {
    lang: "en", program: legacySlot,
    rows: log([[14, three(60, 10, 1)], [7, three(60, 10, 1)]]),
  });
  assert(legacy.rec.status === "add", "a slot with no prescription still runs range@1", legacy.rec.status);
  assert(legacy.rec.strategy === undefined, "range@1 keeps its released result shape");

  console.log("installed editor prescription preservation");
  await capture(page, { lang: "en", program: repGoalProgram, rows: [] });
  let editorRow = await openInstalledEditor(page);
  const editorShape = await editorRow.evaluate((element) => ({
    summary: element.querySelector('[data-role="exercise-summary"]')?.textContent?.trim(),
    sets: element.querySelector('[data-role="sets-value"]')?.textContent?.trim(),
    min: element.querySelector('[data-field="min"]')?.value,
    max: element.querySelector('[data-field="max"]')?.value,
  }));
  assert(editorShape.summary === "3 × 6–12" && editorShape.sets === "3" && editorShape.min === "6" && editorShape.max === "12",
    "the installed editor renders the authored prescription shape", JSON.stringify(editorShape));
  await page.locator('#programEditor [data-role="program-name"]').fill("Strategy fixture edited");
  await applyInstalledEditor(page);
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name === "Strategy fixture edited", KEY);
  const authored = await storedSlot(page);
  assert(JSON.stringify(authored.progression) === JSON.stringify(REP_GOAL),
    "an ordinary staged edit preserves the authored progression", JSON.stringify(authored.progression));

  await capture(page, { lang: "pt", program: legacySlot, rows: [] });
  editorRow = await openInstalledEditor(page);
  const ptEditor = await page.locator('#programEditor [data-role="editor"]').innerText();
  assert(/Nome do programa/i.test(ptEditor) && /Substituir exercício/i.test(ptEditor) && /Remover exercício/i.test(ptEditor),
    "the installed editor is usable in Portuguese", ptEditor);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const largeText = await editorRow.evaluate((element) => ({
    pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    fields: [...element.querySelectorAll("input, button")].filter((control) => control.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
  }));
  assert(largeText.pageOverflow <= 1 && largeText.fields === 0,
    "the editor keeps controls on-screen at 320px with large text", JSON.stringify(largeText));
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1280, height: 720 });

  console.log("forward compatibility");
  const futureSlot = slot({ sets: 3, min: 6, max: 10, progression: {
    schemaVersion: 9, strategy: { id: "future_strategy", version: 9, params: { authored: true } }, modifiers: [],
  } });
  await capture(page, { lang: "en", program: futureSlot, rows: [] });
  await openInstalledEditor(page);
  const beforeFuture = (await storedSlot(page)).progressionIncompatibility;
  await page.locator('#programEditor [data-role="program-name"]').fill("Keep imported data");
  await applyInstalledEditor(page);
  await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key) || "{}").programMeta?.name === "Keep imported data", KEY);
  const afterFuture = (await storedSlot(page)).progressionIncompatibility;
  assert(JSON.stringify(afterFuture) === JSON.stringify(beforeFuture),
    "ordinary staged edits preserve unsupported future progression provenance");
} finally {
  await browser.close();
}

console.log(`\nprogression strategies UI: ${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
