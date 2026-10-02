#!/usr/bin/env node
/**
 * RF-10: a library exercise whose stored name is still the library's English name
 * reads as the library's Portuguese name, at display only.
 *
 * Owner decision (#295): "Localize at display. In PT, a library exercise whose
 * stored name still equals the library's English name is shown with the library's
 * PT name. Stored data, setup links and exercises the lifter renamed are unchanged."
 *
 * The rule is one helper in app.js (`exerciseDisplayName`). It applies when the
 * item resolves to a library entry through the id the app already keeps (the
 * slot's `libraryId`, a log row's `performedLibraryId`), the app is in Portuguese,
 * the entry has a Portuguese name and the stored name is exactly the English one.
 * Renamed exercises, custom exercises, unlinked exercises (never matched by name)
 * and English all keep the stored text. Nothing it touches is ever written.
 *
 * Production-backed in the browser: the fixture is a real program with English
 * stored names and a log written in English. The suite walks every surface that
 * renders a stored exercise name and reads what the lifter reads.
 *
 * Run: node test/exercise-display-name.mjs
 * Requires a static server on REPFORGE_URL (default http://localhost:8000/).
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const NOW = "2026-08-31T12:00:00.000Z";

const results = { passed: 0, failed: 0 };
/** The setup-link phase repeats the walk to prove the link survives it; only its failures need printing. */
let quiet = false;
function assert(cond, name, detail) {
  if (cond) {
    results.passed++;
    if (!quiet) console.log(`  ✓ ${name}`);
  } else {
    results.failed++;
    console.log(`  ✗ ${name}`);
    if (detail != null) console.log(`    ${detail}`);
  }
}
const phase = (n) => console.log(`\n${n}`);

/** Library movements with their stored (English) and displayed (Portuguese) names. */
const LIB = {
  sq: { id: "sq_bb", en: "Barbell back squat", pt: "Agachamento livre com barra" },
  pr: { id: "pr_bb", en: "Barbell bench press", pt: "Supino com barra" },
  pd: { id: "pd_bw", en: "Assisted pull-up", pt: "Barra fixa assistida" },
  dl: { id: "dl_bb", en: "Barbell deadlift", pt: "Levantamento terra com barra" },
  le: { id: "le_mc", en: "Leg extension", pt: "Cadeira extensora" },
  lr: { id: "lr_db", en: "Dumbbell lateral raise", pt: "Elevação lateral com halteres" },
};
const LINKED = Object.keys(LIB);
/** The lifter renamed this one: its stored name is an alias, never the library's. */
const RENAMED = { id: "cu_bb", stored: "Rosca do Joao", libraryEn: "Barbell curl", libraryPt: "Rosca com barra" };
/** A custom exercise. Its Portuguese name differs, to prove the rule leaves it alone. */
const CUSTOM = { id: "custom:sled-push", stored: "Sled push", pt: "Empurrar treno" };
/** Unlinked: no library id, so nothing resolves it, even though the library has a movement of this very name. */
const UNLINKED = { stored: "Seated leg curl", libraryPt: "Cadeira flexora" };

const SLOTS = [
  ["sq", LIB.sq.en, LIB.sq.id, "Quads", "Glutes"],
  ["pr", LIB.pr.en, LIB.pr.id, "Chest", "Triceps"],
  ["lc", UNLINKED.stored, null, "Hamstrings", ""],
  ["pd", LIB.pd.en, LIB.pd.id, "Lats", "Biceps"],
  ["dl", LIB.dl.en, LIB.dl.id, "Hamstrings", "Glutes"],
  ["cu", RENAMED.stored, RENAMED.id, "Biceps", ""],
  ["sl", CUSTOM.stored, CUSTOM.id, "Quads", ""],
  ["le", LIB.le.en, LIB.le.id, "Quads", ""],
  ["lr", LIB.lr.en, LIB.lr.id, "Side delts", ""],
];

function isoDaysAgo(n) {
  const d = new Date(Date.parse(NOW));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** The unlinked exercise cannot be shared (a link names movements by identity), so the setup-link phase leaves it out. */
let withUnlinked = true;

function program() {
  return SLOTS.filter(([id]) => withUnlinked || id !== "lc").map(([id, name, libraryId, primary, secondary], i) => ({
    id, day: "Day 1", order: i + 1, name, sets: 2, min: 6, max: 10, primary, secondary, notes: "", alternates: [],
    ...(libraryId ? { libraryId } : {}),
    ...(id === "cu" ? { displayName: RENAMED.stored } : {}),
  }));
}

/** Four past sessions of the one day, written the way an English install wrote them. */
function logRows() {
  const rows = [];
  [14, 10, 7, 3].forEach((ago, si) => {
    const date = isoDaysAgo(ago), session = `${date}_Day 1_seed${si}`;
    for (const slot of program()) {
      for (let set = 1; set <= 2; set++) {
        rows.push({
          session, date, day: "Day 1", name: slot.name, exerciseId: slot.id, set,
          load: 40 + si * 5 + slot.order * 5, reps: 8, rir: 2, notes: "", created: `${date}T12:00:00.000Z`,
          primary: slot.primary, secondary: slot.secondary, performedName: slot.name,
          ...(slot.libraryId ? { performedLibraryId: slot.libraryId } : {}),
        });
      }
    }
  });
  return rows;
}

function fixture(lang) {
  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 0, lastExport: "", unit: "kg", lang,
      rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "prog-display-names", name: "Display names", started: isoDaysAgo(21),
      created: "2026-07-01T00:00:00.000Z", updated: "2026-07-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: null, experience: null,
      daysPerWeek: 3, splitType: "full_body", equipment: ["barbell"], priorityMuscles: [],
      sessionLength: "60", completedAt: null,
    },
    program: program(),
    log: logRows(),
    programHistory: [],
    customExercises: [{
      id: CUSTOM.id, name: CUSTOM.stored, namePt: CUSTOM.pt, archived: false, equipment: ["machine"],
      primary: "Quads", secondary: "", notes: "", created: "2026-07-01T00:00:00.000Z",
    }],
  };
}

async function seedState(page, blob) {
  await page.evaluate(async ({ key, draft, value }) => {
    localStorage.removeItem(draft);
    await new Promise((done) => {
      const request = indexedDB.deleteDatabase("repforge");
      request.onsuccess = request.onerror = request.onblocked = () => done();
    });
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, { key: KEY, draft: DRAFT, value: blob });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

async function openApp(browser, lang, { seeded = true } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, locale: lang === "pt" ? "pt-BR" : "en-US",
    serviceWorkers: "block", timezoneId: "UTC",
  });
  await context.addInitScript((fixedNow) => {
    const RealDate = Date, fixed = RealDate.parse(fixedNow);
    class PinnedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [fixed])); }
      static now() { return fixed; }
    }
    globalThis.Date = PinnedDate;
  }, NOW);
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  if (seeded) {
    await seedState(page, fixture(lang));
    await page.evaluate(() => {
      window.closeFirstRun?.();
      if (document.querySelector("#onboarding")?.classList.contains("active")) window.closeOnboarding?.();
      if (document.querySelector("#tour") && !document.querySelector("#tour").classList.contains("hidden")) window.closeTour?.();
    });
  }
  return { context, page, pageErrors };
}

const texts = (page, selector) => page.$$eval(selector, (nodes) => nodes.map((node) => node.textContent.replace(/\s+/g, " ").trim()));
const attrs = (page, selector, name) => page.$$eval(selector, (nodes, attr) => nodes.map((node) => node.getAttribute(attr) || ""), name);
const joined = async (page, selector) => (await texts(page, selector)).join(" | ");
const bodyText = (page) => page.evaluate(() => document.body.innerText);

/** Everything durable the app holds for the program and the log, as the exact stored bytes. */
async function durableBytes(page) {
  await page.evaluate(() => window.__repforgeStorage.flush());
  return page.evaluate(async (key) => {
    const local = localStorage.getItem(key);
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("repforge", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("kv");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const idb = await new Promise((resolve) => {
      const request = db.transaction("kv", "readonly").objectStore("kv").get(key);
      request.onsuccess = () => resolve(JSON.stringify(request.result ?? null));
      request.onerror = () => resolve(null);
    });
    db.close();
    return { local, idb };
  }, KEY);
}

const goto = async (page, view) => {
  await page.locator(`nav button[data-view="${view}"]`).click();
  await page.waitForSelector(`#${view}.view.active`);
};

/**
 * One surface: every name in `shown` reads as given, and none of the names it
 * replaced is left on the surface.
 */
function expectNames(label, text, { shown = [], gone = [] } = {}) {
  const missing = shown.filter((name) => !text.includes(name));
  assert(missing.length === 0, `${label}: reads ${shown.length ? shown.join(", ") : "nothing in particular"}`,
    missing.length ? `missing ${JSON.stringify(missing)} in ${JSON.stringify(text.slice(0, 700))}` : null);
  const stale = gone.filter((name) => text.includes(name));
  assert(stale.length === 0, `${label}: none of the replaced names is left`,
    stale.length ? `still shows ${JSON.stringify(stale)} in ${JSON.stringify(text.slice(0, 700))}` : null);
}

/** What a Portuguese surface of the whole fixture must show: PT names for the library movements, the rest as stored. */
const ptShown = (ids = LINKED) => ids.map((id) => LIB[id].pt);
const ptGone = (ids = LINKED) => ids.map((id) => LIB[id].en);
/** The names that must never be touched, wherever they appear. */
const kept = () => [RENAMED.stored, ...(withUnlinked ? [UNLINKED.stored] : [])];
const never = () => [RENAMED.libraryPt, RENAMED.libraryEn, ...(withUnlinked ? [UNLINKED.libraryPt] : [])];

/** Wrap the telemetry boundary with a recording adapter: every event the app emits lands here. */
async function recordTelemetry(page) {
  await page.evaluate(() => {
    window.__rf10Events = [];
    window.RepForgeTelemetry.boot({
      adapter: { capture: (event, props) => window.__rf10Events.push({ event, props: { ...props } }), setEnabled() {} },
    });
  });
}

async function shareLink(page) {
  await goto(page, "program");
  await page.locator("#shareProgramSetup").click();
  await page.waitForSelector("#shareSetupSheet:not(.hidden)");
  await page.waitForFunction(() => /#setup|setup=/.test(document.querySelector("#shareSetupLink")?.textContent || ""), undefined, { timeout: 15000 });
  const link = await page.locator("#shareSetupLink").textContent();
  await page.locator("#shareSetupClose").click();
  await page.waitForFunction(() => document.querySelector("#shareSetupSheet")?.hidden === true);
  return link;
}

async function visitToday(page, { pt, label }) {
  await goto(page, "log");
  await page.waitForSelector("#todayExList .rxrow");
  const rows = await joined(page, "#todayExList .rxrow__name");
  const aria = (await attrs(page, "#todayExList .rxrow", "aria-label")).join(" | ");
  const shown = pt ? [...ptShown(), ...kept()] : [...LINKED.map((id) => LIB[id].en), ...kept()];
  expectNames(`${label} Today rows`, rows, { shown, gone: pt ? [...ptGone(), ...never()] : [] });
  expectNames(`${label} Today row aria-labels`, aria, { shown: pt ? ptShown() : LINKED.map((id) => LIB[id].en), gone: pt ? ptGone() : [] });
}

async function visitExercisePage(page, { pt, label }) {
  await goto(page, "log");
  await page.locator('#todayExList .rxrow[data-exopen="sq"]').click();
  await page.waitForSelector("#exercise.view.active #exDetail .exdet__name");
  const title = await joined(page, "#exDetail .exdet__name");
  const aria = (await attrs(page, "#exDetail [aria-label], #exDetail img", "aria-label")).concat(await attrs(page, "#exDetail img", "alt")).join(" | ");
  expectNames(`${label} exercise page title`, title, { shown: [pt ? LIB.sq.pt : LIB.sq.en], gone: pt ? [LIB.sq.en] : [] });
  expectNames(`${label} exercise page chart, art and Why labels`, aria, { shown: [pt ? LIB.sq.pt : LIB.sq.en], gone: pt ? [LIB.sq.en] : [] });
  await page.locator("#exBack").click();
  await page.waitForSelector("#log.view.active");
}

async function visitFocus(page, { pt, label }) {
  await page.evaluate(() => window.__repforgeEnterWorkout({}));
  await page.waitForSelector("#workoutShell:not(.hidden)");
  await page.waitForSelector("#workout .exercise.is-current");
  const en = (id) => LIB[id].en, name = (id) => (pt ? LIB[id].pt : LIB[id].en);
  const title = await joined(page, "#workout .exercise.is-current .focus-ex__name");
  expectNames(`${label} Focus card name`, title, { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  const next = await joined(page, "#workout .exercise.is-current .fx-next");
  expectNames(`${label} Focus next-exercise row`, next, { shown: [name("pr")], gone: pt ? [en("pr")] : [] });
  const aria = (await attrs(page, "#workout .exercise.is-current [aria-label]", "aria-label")).join(" | ");
  expectNames(`${label} Focus card labels (open, Why, region)`, aria, { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  const peeks = await joined(page, "#workout .deck__slot .focus-ex__name");
  expectNames(`${label} Focus neighbours`, peeks, { shown: [name("sq"), name("pr")], gone: pt ? [en("pr")] : [] });

  // Session sheet: the map of every exercise, the reorder labels.
  await page.locator("#sessionSheetBtn").click();
  await page.waitForSelector("#sessionSheet:not(.hidden) .session-map__name");
  const map = await joined(page, "#sessionMap .session-map__name");
  expectNames(`${label} session map`, map, {
    shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept()], gone: pt ? [...ptGone(), ...never()] : [],
  });
  const reorder = (await attrs(page, "#sessionMap [aria-label]", "aria-label")).join(" | ");
  expectNames(`${label} session map reorder labels`, reorder, { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  await page.locator("#sessionSheetClose").click();
  await page.locator("#sessionSheet").waitFor({ state: "hidden" });

  // Exercise actions, its note sheet and the swap picker.
  await page.locator("#woOverflowBtn").click();
  await page.waitForSelector("#exActionsSheet:not(.hidden)");
  expectNames(`${label} exercise actions title`, await joined(page, "#exActionsName"), { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  await page.locator("#exActionNotesBtn").click();
  await page.waitForSelector("#exNoteSheet:not(.hidden)");
  expectNames(`${label} exercise note sheet`, await joined(page, "#exNoteFor"), { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  await page.keyboard.press("Escape");
  await page.locator("#exNoteSheet").waitFor({ state: "hidden" });
  if (!(await page.locator("#exActionsSheet").isVisible())) await page.locator("#woOverflowBtn").click();
  await page.locator("#exActionSubstBtn").click();
  await page.waitForSelector("#exPickSheet:not(.hidden)");
  expectNames(`${label} swap picker subtitle`, await joined(page, "#exPickFor"), { shown: [name("sq")], gone: pt ? [en("sq")] : [] });
  await page.locator("#exPickCancel").click();
  await page.locator("#exPickSheet").waitFor({ state: "hidden" });
  if (await page.locator("#exActionsSheet").isVisible()) await page.locator("#exActionsClose").click();
  await page.locator("#exActionsSheet").waitFor({ state: "hidden" });
}

async function logSet(page, exId, n, load, reps, rir) {
  const card = `#workout .exercise.is-current`;
  for (const [field, value] of [["load", load], ["reps", reps], ["rir", rir]]) {
    await page.locator(`${card} [data-k="${exId}_${n}_${field}"]`).fill(String(value));
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  await page.locator(`${card} [data-save="${exId}_${n}"]`).click();
  await page.waitForFunction(({ exId, n }) => {
    const exercise = window.__repforgeWorkoutDraft?.current?.()?.exercises?.[exId];
    return Object.values(exercise?.sets || {}).find((set) => set.ordinal === n)?.completion !== "pending";
  }, { exId, n }, { timeout: 15000 });
}

async function finishAndReadSummary(page, { pt, label }) {
  await logSet(page, "sq", 1, 80, 8, 2);
  await finishEarly(page);
  await page.waitForSelector("#sessionSummary:not(.hidden) .sum-grp__n", { timeout: 8000 });
  const summary = await joined(page, "#sessionSummary .sum-grp__n");
  expectNames(`${label} session summary`, summary, { shown: [pt ? LIB.sq.pt : LIB.sq.en], gone: pt ? [LIB.sq.en] : [] });
  await page.keyboard.press("Escape");
  await page.locator("#sessionSummary").waitFor({ state: "hidden" }).catch(() => {});
  await goto(page, "log").catch(() => {});
  const done = await page.$$eval(".today-done__lifts .sum-grp__n", (nodes) => nodes.map((n) => n.textContent.trim()).join(" | ")).catch(() => "");
  if (done) expectNames(`${label} Today after the session`, done, { shown: [pt ? LIB.sq.pt : LIB.sq.en], gone: pt ? [LIB.sq.en] : [] });
}

async function visitHistory(page, { pt, label }) {
  await goto(page, "history");
  await page.locator("#sessions .session__open").first().click();
  await page.waitForSelector("#history .histlift__name");
  const names = await joined(page, "#history .histlift__name");
  expectNames(`${label} History session page`, names, {
    shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept(), CUSTOM.stored],
    gone: pt ? [...ptGone(), ...never(), CUSTOM.pt] : [],
  });
  await page.locator("[data-history-edit]").click();
  await page.waitForSelector("#history .histedit .edgroup__name");
  const editor = await joined(page, "#history .histedit .edgroup__name");
  const editorAria = (await attrs(page, "#history .histedit .edrow__in", "aria-label")).join(" | ");
  expectNames(`${label} History editor headings`, editor, { shown: pt ? ptShown() : LINKED.map((id) => LIB[id].en), gone: pt ? ptGone() : [] });
  expectNames(`${label} History editor field labels`, editorAria, { shown: [pt ? LIB.sq.pt : LIB.sq.en], gone: pt ? [LIB.sq.en] : [] });
  await page.locator("[data-edcancel]").click();
  await page.waitForSelector("#history .histlift__name");
  await page.locator("[data-history-back]").click();
  await page.waitForSelector("#sessions .session__open");
  const table = await page.$$eval("#historyTable td", (cells) => cells.map((c) => c.textContent.trim()).join(" | "));
  expectNames(`${label} History table`, table, { shown: pt ? ptShown() : LINKED.map((id) => LIB[id].en), gone: pt ? ptGone() : [] });

  // Search finds a session by either name.
  await page.locator("#historySearchBtn").click();
  for (const query of [LIB.pr.en.toLowerCase(), LIB.pr.pt.toLowerCase()]) {
    await page.locator("#historySearch").fill(query);
    const hits = await page.locator("#sessions .session__open").count();
    const expected = pt || query === LIB.pr.en.toLowerCase();
    assert(expected ? hits > 0 : hits === 0, `${label} History search for "${query}" ${expected ? "finds" : "does not find"} the sessions`, `hits=${hits}`);
  }
  await page.locator("#historySearch").fill("");
  await page.locator("#historySearchClear").click().catch(() => {});
}

async function visitProgress(page, { pt, label }) {
  const name = (id) => (pt ? LIB[id].pt : LIB[id].en);
  await goto(page, "stats");
  await page.waitForSelector("#overviewStrength .strrow__name");
  const overview = await joined(page, "#overviewStrength .strrow__name");
  expectNames(`${label} Progress overview strength`, overview, {
    shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept(), CUSTOM.stored],
    gone: pt ? [...ptGone(), ...never(), CUSTOM.pt] : [],
  });
  await page.locator('#statsSeg [data-seg="strength"]').click();
  await page.waitForSelector("#strengthDash .evrow__name");
  const strength = await joined(page, "#strengthDash .evrow__name");
  expectNames(`${label} Progress Strength list`, strength, {
    shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept(), CUSTOM.stored],
    gone: pt ? [...ptGone(), ...never(), CUSTOM.pt] : [],
  });
  await page.locator('#statsSeg [data-seg="prs"]').click();
  await page.waitForSelector("#prTimeline .prtl__ex");
  const prs = await joined(page, "#prTimeline .prtl__ex");
  expectNames(`${label} Progress records`, prs, { shown: [name("sq"), name("pr")], gone: pt ? [LIB.sq.en, LIB.pr.en] : [] });
  await page.locator('#statsSeg [data-seg="review"]').click();
  await page.waitForTimeout(300);
  const review = await joined(page, ".review__outcomes");
  expectNames(`${label} Progress block review outcomes`, review, { shown: [name("sq")], gone: pt ? [LIB.sq.en] : [] });
  await page.locator('#statsSeg [data-seg="overview"]').click();
  await page.locator('#overviewStrength button[data-ovkey="library:sq_bb"]').click();
  await page.waitForSelector("#exercise.view.active .exchart__title");
  const chartTitle = await joined(page, "#exDetail .exchart__title");
  const chartAria = (await attrs(page, "#exDetail .exchart__plot", "aria-label")).join(" | ");
  expectNames(`${label} Progress exercise chart title`, chartTitle, { shown: [name("sq")], gone: pt ? [LIB.sq.en] : [] });
  expectNames(`${label} Progress exercise chart label`, chartAria, { shown: [name("sq")], gone: pt ? [LIB.sq.en] : [] });
  await page.locator("#exBack").click();
  await page.waitForSelector("#stats.view.active");
}

async function visitProgram(page, { pt, label }) {
  const name = (id) => (pt ? LIB[id].pt : LIB[id].en);
  await goto(page, "program");
  await page.waitForSelector("#programOverview .rxrow__name");
  const overview = await joined(page, "#programOverview .rxrow__name");
  expectNames(`${label} Program overview`, overview, { shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept()], gone: pt ? [...ptGone(), ...never()] : [] });
  await page.locator("#exportProgramText").click();
  await page.waitForSelector("#programTextSheet:not(.hidden)");
  const text = await page.locator("#programTextOut").textContent();
  expectNames(`${label} program text export`, text, { shown: [...(pt ? ptShown() : LINKED.map((id) => LIB[id].en)), ...kept()], gone: pt ? [...ptGone(), ...never()] : [] });
  await page.locator("#programTextClose").click();
  await page.locator("#programTextSheet").waitFor({ state: "hidden" });

  // The editor: its name field keeps the stored text; its read-only labels follow the language.
  await page.locator("#programEditToggle").click();
  await page.waitForSelector("#programEditor .program-editor__exercise-toggle", { state: "attached" });
  const fields = await page.$$eval("#programEditor [data-field='name']", (nodes) => nodes.map((n) => n.value));
  assert(LINKED.every((id) => fields.some((value) => value === LIB[id].en || value === LIB[id].pt)) && fields.includes(RENAMED.stored),
    `${label} program editor name fields keep the stored text`, JSON.stringify(fields));
  const toggles = (await attrs(page, "#programEditor .program-editor__exercise-toggle", "aria-label")).join(" | ");
  expectNames(`${label} program editor expanders`, toggles, { shown: [name("sq")], gone: pt ? [LIB.sq.en] : [] });
  await page.locator("#programEditor .program-editor__exercise-toggle").first().click();
  await page.locator("#programEditor [data-role='replace']").first().click();
  await page.waitForSelector("#exPickSheet:not(.hidden)");
  expectNames(`${label} program editor replace picker`, await joined(page, "#exPickFor"), { shown: [name("sq")], gone: pt ? [LIB.sq.en] : [] });
  await page.locator("#exPickCancel").click();
  await page.locator("#exPickSheet").waitFor({ state: "hidden" });
  const leave = page.locator("#programEditToggle");
  await leave.click();
  await page.waitForTimeout(300);
  await page.locator("#programEditorDiscard").click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(200);
}

/**
 * The staged candidate's preview: each exercise reads the library's Portuguese name when it carries a
 * library id and its stored name is the English one; the staged data itself is not touched.
 */
async function checkPreviewReadsPortuguese(page, label, { expectLinked = 1 } = {}) {
  await page.waitForSelector("#entryActivate", { timeout: 20000 });
  const before = await page.evaluate(() => JSON.stringify(window.__repforgeEntryState().result?.preview ?? null));
  await page.evaluate(() => document.querySelectorAll("#onbBody details.onb__day").forEach((d) => { d.open = true; }));
  const staged = await page.evaluate(() => (window.__repforgeEntryState().result?.preview?.days || []).flatMap((day) =>
    (day.exercises || []).map((ex) => {
      const entry = ex.libraryId ? libraryEntry(ex.libraryId) : null;
      const english = !!entry && !entry.custom && ex.name === entry.name;
      return { stored: ex.name, expected: english && entry.namePt ? entry.namePt : ex.name, english };
    })));
  const shown = await texts(page, "#onbBody .onb__ex b");
  const linked = staged.filter((ex) => ex.english);
  if (expectLinked > 0) assert(linked.length >= expectLinked, `${label}: the staged preview holds English library names`, `${linked.length} of ${staged.length}`);
  assert(shown.length === staged.length && staged.every((ex, i) => shown[i] === ex.expected),
    `${label}: every exercise reads the library's Portuguese name`,
    JSON.stringify({ shown: shown.slice(0, 4), expected: staged.slice(0, 4).map((e) => e.expected) }));
  assert(linked.every((ex) => !shown.includes(ex.stored) || ex.stored === ex.expected), `${label}: no English library name is left on the preview`);
  const after = await page.evaluate(() => JSON.stringify(window.__repforgeEntryState().result?.preview ?? null));
  assert(before === after, `${label}: reading the preview leaves the staged data byte-identical`);
}

async function walkRecommend(page) {
  await page.click("#firstRunCreate");
  await page.click('[data-entry-route="recommend"][data-entry-goal="balanced"]');
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="120"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  await page.click("#onbNext");
}

async function walkCustom(page) {
  await page.click("#firstRunCreate");
  await page.click('[data-entry-route="custom"]');
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="balanced"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="structuredExperience"][data-entry-val="6_to_24m"]');
  await page.click('[data-entry-pick="recentConsistency"][data-entry-val="most"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click('[data-entry-pick="preferredRestSeconds"][data-entry-val="auto"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  // The remaining custom questions are optional: take the default answer to each until the review opens.
  for (let step = 0; step < 8 && !(await page.locator("#entryActivate").count()); step++) {
    await page.click("#onbNext");
    await page.waitForTimeout(250);
  }
}

async function walkBrowse(page) {
  await page.click("#firstRunCreate");
  await page.click('[data-entry-route="browse"]');
  await page.click('[data-entry-pick="daysPerWeek"][data-entry-val="4"]');
  await page.click('[data-entry-pick="sessionMinutes"][data-entry-val="60"]');
  await page.click("#onbNext");
  await page.click('[data-entry-pick="environment"][data-entry-val="commercial_gym"]');
  await page.click("#onbNext");
  await page.waitForSelector('[data-entry-catalogue="growth_4_v1"]', { timeout: 15000 });
  await page.click('[data-entry-catalogue="growth_4_v1"]');
}

async function walkImport(page) {
  await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 10000 });
  await page.setInputFiles("#importProgram", {
    name: "english-program.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([
      { id: "i1", day: "Day 1", name: LIB.pr.en, sets: 3, repLow: 6, repHigh: 10, muscles: ["Chest"] },
      { id: "i2", day: "Day 1", name: LIB.sq.en, sets: 3, repLow: 5, repHigh: 8, muscles: ["Quads"] },
    ])),
  });
  await page.waitForSelector("#importReview.active", { timeout: 10000 });
}

async function run() {
  const browser = await launchChromium();
  try {
    phase("Portuguese: stored English names, English log. The lifter reads the library's Portuguese names");
    {
      const { context, page, pageErrors } = await openApp(browser, "pt");
      await recordTelemetry(page);
      assert(await page.evaluate(() => state.settings.lang) === "pt", "the app runs in Portuguese");
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
      assert(stored.log.every((row) => row.performedName === row.name && (!row.performedLibraryId || LINKED.map((id) => LIB[id].en).concat([RENAMED.stored, CUSTOM.stored]).includes(row.name))),
        "the stored log holds English names (and the lifter's own)");
      await page.waitForTimeout(500);
      const before = await durableBytes(page);

      await visitToday(page, { pt: true, label: "PT" });
      await visitExercisePage(page, { pt: true, label: "PT" });
      await visitProgram(page, { pt: true, label: "PT" });
      await visitHistory(page, { pt: true, label: "PT" });
      await visitProgress(page, { pt: true, label: "PT" });
      await goto(page, "log");
      await visitFocus(page, { pt: true, label: "PT" });

      const after = await durableBytes(page);
      assert(before.local === after.local && before.idb === after.idb,
        "the stored program and log are byte-identical before and after visiting every surface");
      const storedNow = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
      const keptStored = storedNow.log.filter((row) => row.performedLibraryId === "sq_bb").every((row) => row.name === LIB.sq.en && row.performedName === LIB.sq.en);
      assert(keptStored, "no log row was rewritten into Portuguese");
      assert(storedNow.program.find((e) => e.id === "cu").name === RENAMED.stored, "the renamed exercise keeps its stored name");

      await finishAndReadSummary(page, { pt: true, label: "PT" });
      const finalBytes = await durableBytes(page);
      const finalState = JSON.parse(finalBytes.local);
      const seeded = fixture("pt").log;
      assert(seeded.every((row, i) => JSON.stringify(finalState.log[i]) === JSON.stringify(finalState.log.find((r) => r.session === row.session && r.exerciseId === row.exerciseId && r.set === row.set))),
        "the seeded log rows are still in the log, unchanged, after a new session");
      const newRows = finalState.log.filter((row) => !seeded.some((s) => s.session === row.session));
      assert(newRows.length > 0 && newRows.every((row) => {
        const slot = finalState.program.find((e) => e.id === row.exerciseId);
        return slot && row.name === slot.name && row.performedName === slot.name;
      }), "the session just logged stores the slot's own stored name: display never writes a name of its own");

      const events = await page.evaluate(() => window.__rf10Events);
      const everyPt = [...Object.values(LIB).map((m) => m.pt), RENAMED.libraryPt, UNLINKED.libraryPt, CUSTOM.pt];
      assert(events.length > 0, "telemetry was observed while the surfaces were visited", `events=${events.length}`);
      const leaked = events.filter((entry) => everyPt.some((name) => JSON.stringify(entry).includes(name)));
      assert(leaked.length === 0, "no telemetry property carries a Portuguese exercise name", JSON.stringify(leaked.slice(0, 2)));
      assert(pageErrors.length === 0, "the Portuguese walk raised no page errors", pageErrors.join("; "));
      await context.close();
    }

    phase("Portuguese: a stored name that is still the English one, held in memory");
    {
      const { context, page } = await openApp(browser, "pt");
      // The app re-derives a linked slot's name from the library whenever state is normalised, so a
      // Portuguese session normally already holds Portuguese text. Hold the English text in memory (no
      // write) so the display rule itself is what the program surfaces are showing.
      await page.evaluate((libs) => {
        for (const ex of [...state.program, ...prog.exercises]) {
          const lib = Object.values(libs).find((m) => m.id === ex.libraryId);
          if (lib && ex.id !== "cu") ex.name = lib.en;
        }
        render();
      }, LIB);
      const held = await page.evaluate(() => state.program.filter((e) => e.libraryId === "sq_bb").map((e) => e.name));
      assert(held[0] === LIB.sq.en, "the program holds the English stored name", JSON.stringify(held));
      await page.waitForTimeout(300);
      await visitToday(page, { pt: true, label: "PT (English stored)" });
      await visitProgram(page, { pt: true, label: "PT (English stored)" });
      await goto(page, "log");
      await visitFocus(page, { pt: true, label: "PT (English stored)" });
      await context.close();
    }

    phase("English: the stored names are what the lifter reads");
    {
      const { context, page, pageErrors } = await openApp(browser, "en");
      await page.waitForTimeout(500);
      const before = await durableBytes(page);
      await visitToday(page, { pt: false, label: "EN" });
      await visitExercisePage(page, { pt: false, label: "EN" });
      await visitProgram(page, { pt: false, label: "EN" });
      await visitHistory(page, { pt: false, label: "EN" });
      await visitProgress(page, { pt: false, label: "EN" });
      await goto(page, "log");
      await visitFocus(page, { pt: false, label: "EN" });
      const after = await durableBytes(page);
      assert(before.local === after.local && before.idb === after.idb, "EN: the stored program and log are byte-identical after visiting every surface");
      const helper = await page.evaluate((libs) => typeof exerciseDisplayName === "function" &&
        Object.values(libs).every((m) => exerciseDisplayName({ name: m.en, libraryId: m.id }) === m.en), LIB);
      assert(helper, "EN: the display helper returns the stored English name for every library movement");
      assert(pageErrors.length === 0, "the English walk raised no page errors", pageErrors.join("; "));
      await context.close();
    }

    phase("The setup link is the same before and after the lifter visits every surface");
    {
      withUnlinked = false;
      quiet = true;
      for (const lang of ["pt", "en"]) {
        const { context, page } = await openApp(browser, lang);
        await page.waitForTimeout(500);
        const linkBefore = await shareLink(page);
        const before = await durableBytes(page);
        await visitToday(page, { pt: lang === "pt", label: `${lang.toUpperCase()} (link)` });
        await visitProgram(page, { pt: lang === "pt", label: `${lang.toUpperCase()} (link)` });
        await visitHistory(page, { pt: lang === "pt", label: `${lang.toUpperCase()} (link)` });
        await visitProgress(page, { pt: lang === "pt", label: `${lang.toUpperCase()} (link)` });
        const linkAfter = await shareLink(page);
        quiet = false;
        assert(linkBefore.length > 60 && linkBefore === linkAfter, `${lang.toUpperCase()}: the setup link encodes the same before and after the walk`, `${linkBefore.length} vs ${linkAfter.length}`);
        const after = await durableBytes(page);
        assert(before.local === after.local && before.idb === after.idb, `${lang.toUpperCase()}: the stored bytes are unchanged by the walk and the link`);
        const decoded = await page.evaluate((link) => decodeURIComponent(link), linkBefore);
        assert(!Object.values(LIB).some((m) => decoded.includes(m.pt)), `${lang.toUpperCase()}: the link carries no Portuguese library name`);
        quiet = true;
        await context.close();
      }
      withUnlinked = true;
      quiet = false;
    }

    phase("The display rule itself");
    {
      const { context, page } = await openApp(browser, "pt");
      const probed = await page.evaluate(({ libs, renamed, custom }) => {
        const m = libs.sq;
        if (typeof exerciseDisplayName !== "function") return null;
        return {
          linked: exerciseDisplayName({ name: m.en, libraryId: m.id }),
          row: exerciseDisplayName({ name: m.en, performedName: m.en, performedLibraryId: m.id, session: "s", set: 1 }),
          draft: exerciseDisplayName({ displayName: m.en, libraryId: m.id }),
          renamed: exerciseDisplayName({ name: renamed.stored, libraryId: renamed.id }),
          custom: exerciseDisplayName({ name: custom.stored, libraryId: custom.id }),
          unlinked: exerciseDisplayName({ name: m.en }),
          byNameOnly: exerciseDisplayName({ name: m.en, libraryId: undefined }),
          portugueseAlready: exerciseDisplayName({ name: m.pt, libraryId: m.id }),
          wrongId: exerciseDisplayName({ name: m.en, libraryId: libs.pr.id }),
          unknownId: exerciseDisplayName({ name: m.en, libraryId: "no_such_id" }),
          nothing: exerciseDisplayName(null),
        };
      }, { libs: LIB, renamed: RENAMED, custom: CUSTOM });
      const probe = probed ?? {};
      assert(probed !== null, "the display helper exists");
      assert(probe.linked === LIB.sq.pt, "PT: a slot at its English name reads Portuguese", probe.linked);
      assert(probe.row === LIB.sq.pt, "PT: a log row performed under the English name reads Portuguese", probe.row);
      assert(probe.draft === LIB.sq.pt, "PT: a draft exercise snapshot at the English name reads Portuguese", probe.draft);
      assert(probe.renamed === RENAMED.stored, "PT: a renamed exercise keeps its name", probe.renamed);
      assert(probe.custom === CUSTOM.stored, "PT: a custom exercise keeps its name", probe.custom);
      assert(probe.unlinked === LIB.sq.en && probe.byNameOnly === LIB.sq.en, "PT: an unlinked exercise is never matched by name", `${probe.unlinked}`);
      assert(probe.portugueseAlready === LIB.sq.pt, "PT: a name that is already Portuguese is left alone");
      assert(probe.wrongId === LIB.sq.en, "PT: the name must be the English name of the entry the id resolves to", probe.wrongId);
      assert(probe.unknownId === LIB.sq.en, "PT: an id with no library entry keeps the stored name");
      assert(probe.nothing === "", "PT: nothing in, nothing out", String(probe.nothing));
      await context.close();
    }

    phase("Portuguese: the entry previews read the library's Portuguese names, and the staged data stays English");
    for (const [route, walk] of [["recommend", walkRecommend], ["custom", walkCustom], ["browse", walkBrowse]]) {
      const { context, page } = await openApp(browser, "pt", { seeded: false });
      await walk(page);
      await checkPreviewReadsPortuguese(page, `PT ${route} preview`);
      await context.close();
    }
    {
      const { context, page } = await openApp(browser, "pt", { seeded: false });
      await walkImport(page);
      const targets = await texts(page, "#importReview .improw__name");
      const sources = await texts(page, "#importReview .improw__from");
      assert(targets.join("|") === `${LIB.pr.pt}|${LIB.sq.pt}`, "PT import review: each matched library movement reads Portuguese", targets.join(" | "));
      assert(sources.join("|") === `${LIB.pr.en}|${LIB.sq.en}`, "PT import review: the file's own text is shown as it was written", sources.join(" | "));
      await page.click("#importCommit");
      await checkPreviewReadsPortuguese(page, "PT import preview", { expectLinked: 0 });
      await context.close();
    }
    {
      // A link made in a Portuguese session opens a Portuguese shared preview.
      withUnlinked = false;
      const maker = await openApp(browser, "pt");
      const link = await shareLink(maker.page);
      await maker.context.close();
      withUnlinked = true;
      const { context, page } = await openApp(browser, "pt", { seeded: false });
      const hash = new URL(link).hash;
      await page.goto(`${BASE}${hash}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#firstRun:not(.hidden)", { timeout: 15000 });
      await page.waitForSelector("#firstRunSharedStart", { state: "visible", timeout: 15000 });
      await page.click("#firstRunSharedStart");
      await checkPreviewReadsPortuguese(page, "PT shared-link preview", { expectLinked: 0 });
      const names = await texts(page, "#onbBody .onb__ex b");
      assert(names.includes(LIB.sq.pt) && names.includes(RENAMED.stored) && !names.includes(LIB.sq.en) && !names.includes(RENAMED.libraryPt),
        "PT shared-link preview: library movements read Portuguese, the renamed one keeps the lifter's name", names.join(" | "));
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

await run();
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
