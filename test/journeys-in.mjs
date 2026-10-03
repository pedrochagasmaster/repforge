#!/usr/bin/env node
/**
 * Journeys into the app (Plan 064 R5a): the hand-offs between surfaces on the way
 * in, proved on the production app in a real browser.
 *
 *   1. landing -> entry -> activation -> Today, then the first session ->
 *      summary -> Progress
 *   2. shared link -> gate -> preview -> activation -> Today
 *   3. no-program Today, Program and Settings -> entry hub, and cancel back to
 *      where each one started
 *   4. returning landing -> chooser resume -> activation
 *
 * At every hand-off the same questions are asked of the destination: it is the
 * only active view, the scroll is at the top, focus is on the new surface's
 * heading (or its documented focus target, named at the call), the announcements
 * it made are one and not repeated, the guide that should fire is on screen once
 * (G-62) and the landing is not shown again.
 *
 * Seeded broken hand-offs (the RED proof): REPFORGE_JOURNEYS_FAULT=
 *   focus-lost      the hand-off leaves focus on <body>
 *   guide-not-fired the guide cue that should have fired is not on screen
 *   landing-reshown the landing comes back over the destination
 * each makes the matching assertions fail.
 *
 * Run: node test/journeys-in.mjs   (requires the app served over HTTP)
 */
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { REPRESENTATIVE_PAYLOAD, cloneFixture } from "./fixtures/shared-setup.mjs";
import { APP_INDEX, encodeSharedPayload, waitForFirstRun } from "./shared-setup-flow.mjs";
import { finishEarly } from "./fixtures/focus-workout.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const FAULT = process.env.REPFORGE_JOURNEYS_FAULT || "";
const UIKEY = "repforge_ui_v1";
const SETUP_DRAFT = "repforge_program_setup_draft_v1";
const HANDOFF_COOKIE = "repforge_setup_v1";

const results = { passed: 0, failed: 0 };
const pageErrors = [];
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
const phase = (title) => console.log(`\n${title}`);

/** Records every write to the app's announcer and to any alert, so "announced once" is read, not guessed. */
const RECORDER = `
window.__journeyLive = [];
{
  const live = (node) => {
    const el = node && node.nodeType === 3 ? node.parentElement : node;
    return el && el.closest ? el.closest('#announcementHost, [role="alert"]') : null;
  };
  const start = () => new MutationObserver((mutations) => {
    for (const m of mutations) {
      const host = live(m.target);
      const text = host ? (host.textContent || "").trim() : "";
      if (host && text) window.__journeyLive.push({ id: host.id || host.getAttribute("role") || "live", text });
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
  if (document.documentElement) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}
`;

async function newDevice(browser, { hash = "", viewport = { width: 390, height: 844 } } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: "block" });
  await context.addInitScript(RECORDER);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => { errors.push(String(e.message)); pageErrors.push(String(e.message)); });
  page.on("dialog", (d) => d.accept());
  await page.goto(`${APP_INDEX}${hash}`, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
}

const mark = (page) => page.evaluate(() => { window.__journeyLive.length = 0; window.scrollTo(0, 240); });

/** Everything the hand-off assertions read, taken in one evaluation. */
function readSurface() {
  const shown = (el) => {
    if (!el || el.closest(".hidden,[hidden]")) return false;
    const st = getComputedStyle(el);
    return st.display !== "none" && st.visibility !== "hidden" && el.getClientRects().length > 0;
  };
  const active = document.activeElement;
  const cues = [...document.querySelectorAll("[data-guide-cue]")].map((cue) => cue.dataset.guideCue);
  let guideState = {};
  try { guideState = JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}").guideState || {}; } catch {}
  const describe = (el) => (el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` : "none");
  return {
    views: [...document.querySelectorAll(".view")].filter((v) => v.classList.contains("active")).map((v) => v.id),
    landing: shown(document.querySelector("#firstRun")),
    scrollY: Math.round(window.scrollY),
    focus: describe(active),
    focusText: (active?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48),
    cues,
    guideState: Object.fromEntries(Object.entries(guideState).map(([id, rec]) => [id, rec.status])),
    live: window.__journeyLive.map((entry) => `${entry.id}:${entry.text}`),
    dock: [...document.querySelectorAll("nav button.active")].map((b) => b.dataset.view),
    bodyClass: document.body.className,
  };
}

/**
 * Check a hand-off. `want.focus` is the selector the focused element must match;
 * the others default to the strict reading (landing hidden, scroll at the top, no
 * guide, nothing announced).
 */
async function handoff(page, name, want) {
  const { view, focus, guide = null, landing = false, announced = 0, top = true, bodyOk = false } = want;
  await page.waitForFunction((sel) => !sel || document.activeElement?.matches?.(sel), focus, { timeout: 2500 }).catch(() => {});
  if (want.guide) await page.waitForSelector(`[data-guide-cue="${want.guide}"]`, { timeout: 2500 }).catch(() => {});
  if (FAULT === "focus-lost") await page.evaluate(() => document.activeElement?.blur?.());
  if (FAULT === "guide-not-fired") await page.evaluate(() => document.querySelectorAll("[data-guide-cue]").forEach((c) => c.remove()));
  if (FAULT === "landing-reshown") await page.evaluate(() => window.openFirstRun?.());
  const s = await page.evaluate(readSurface);
  const matches = await page.evaluate((sel) => !sel || !!document.activeElement?.matches?.(sel), focus);
  const only = Array.isArray(view) ? view : [view];
  assert(s.views.length === only.length && only.every((v) => s.views.includes(v)),
    `${name}: ${only.join(" + ")} is the only active view`, JSON.stringify(s.views));
  assert(s.landing === landing, `${name}: the landing is ${landing ? "shown" : "not shown"}`, `landing=${s.landing}`);
  if (top) assert(s.scrollY <= 1, `${name}: the scroll is at the top`, `scrollY=${s.scrollY}`);
  if (focus) assert(matches, `${name}: focus is on ${focus}`, `focus=${s.focus} "${s.focusText}"`);
  if (!bodyOk) assert(s.focus !== "body", `${name}: focus did not fall back to the body`, `focus=${s.focus}`);
  assert(s.cues.length === (guide ? 1 : 0) && (!guide || s.cues[0] === guide),
    `${name}: ${guide ? `the ${guide} guide is on screen once` : "no guide cue is on screen"}`, JSON.stringify(s.cues));
  assert(s.live.length === announced, `${name}: ${announced ? `announced ${announced === 1 ? "once" : `${announced} times`}` : "nothing announced"}`,
    JSON.stringify(s.live));
  assert(new Set(s.live).size === s.live.length, `${name}: no announcement is repeated`, JSON.stringify(s.live));
  return s;
}

async function ui(page) {
  return page.evaluate(() => { try { return JSON.parse(localStorage.getItem("repforge_ui_v1") || "{}"); } catch { return {}; } });
}

const goal = '[data-entry-route="recommend"][data-entry-goal="muscle_growth"]';

/** From the Recommend route's first question to the activation button. */
async function walkRecommend(page) {
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
  await page.waitForSelector("[data-entry-select-candidate], #entryActivate", { timeout: 15000 });
  if (await page.locator("[data-entry-select-candidate]").count()) await page.locator("[data-entry-select-candidate]").first().click();
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
}

async function activate(page) {
  await mark(page);
  await page.click("#entryActivate");
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 15000 });
}

/** Cancel out of the entry hub, discarding the setup draft. */
async function cancelEntry(page) {
  await mark(page);
  await page.click("#onbCancel");
  await page.waitForSelector("#entryCancelDiscard", { timeout: 10000 });
  await page.click("#entryCancelDiscard");
  await page.waitForFunction(() => !document.querySelector("#onboarding")?.classList.contains("active"), undefined, { timeout: 10000 });
}

// A hand-off that breaks the page under the journey (a landing left over the app) stops it: say so, once.
process.on("uncaughtException", (error) => {
  console.log(`  ✗ the journey stopped: ${String(error?.message).split("\n")[0]}`);
  console.log(`\n${results.passed} passed, ${results.failed + 1} failed`);
  process.exit(1);
});

const TODAY_HEADING = "#todayDash .page-title";
const browser = await launchChromium();

// ---------------------------------------------------------------------------
phase("Journey 1: landing -> entry -> activation -> Today");
const first = await newDevice(browser);
{
  const { page } = first;
  const boot = await page.evaluate(readSurface);
  assert(boot.landing && boot.views.join() === "log", "a fresh device boots to the landing, not to Today", JSON.stringify(boot));

  await mark(page);
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  const entered = await handoff(page, "landing -> entry hub", { view: "onboarding", focus: "#entryHeading", guide: "entry" });
  assert(entered.guideState.entry === "shown", "the entry guide is recorded as shown", JSON.stringify(entered.guideState));

  await page.click(goal);
  await page.waitForSelector('[data-entry-pick="structuredExperience"]', { timeout: 10000 });
  const acted = await page.evaluate(readSurface);
  assert(acted.cues.length === 0 && acted.guideState.entry === "completed",
    "choosing the route the guide points at completes it and takes it down (G-62)", JSON.stringify({ cues: acted.cues, state: acted.guideState }));

  await walkRecommend(page);
  await activate(page);
  const today = await handoff(page, "activation -> Today", { view: "log", focus: TODAY_HEADING, announced: 1 });
  assert(today.live.length === 1 && today.live[0].startsWith("announcementHost:"), "activation announces the saved program once", JSON.stringify(today.live));
  const visible = await page.evaluate(() => ({
    noProgram: !document.querySelector("#todayNoProgram").classList.contains("hidden"),
    start: !!document.querySelector("#startWorkout") && !document.querySelector("#startWorkout").classList.contains("hidden"),
    onboarding: document.body.classList.contains("is-onboarding"),
  }));
  assert(!visible.noProgram && visible.start && !visible.onboarding, "Today shows the new program's session", JSON.stringify(visible));
  assert((await ui(page)).entryLandingSeen === true, "the landing is recorded as seen");

  await reload(page);
  const again = await handoff(page, "reload after activation", { view: "log", focus: null, bodyOk: true });
  assert(!again.landing, "a returning device with a program boots to Today");
}

// ---------------------------------------------------------------------------
phase("Journey 5: first session -> summary -> Progress");
{
  const { page } = first;
  await mark(page);
  await page.click("#startWorkout");
  await page.waitForSelector("#workoutShell:not(.hidden)", { timeout: 15000 });
  const focus = await handoff(page, "Today -> Focus", { view: "log", focus: "#woDayTitle", guide: "first-set" });
  const shell = await page.evaluate(() => ({
    shell: !document.querySelector("#workoutShell").classList.contains("hidden"),
    dash: !document.querySelector("#todayDash").classList.contains("hidden"),
    body: document.body.classList.contains("is-focus-wo"),
    draft: !!window.__repforgeWorkoutDraft.current(),
  }));
  assert(shell.shell && !shell.dash && shell.body && shell.draft, "Focus replaces the Today dashboard and a draft is open", JSON.stringify(shell));
  assert(focus.guideState["first-set"] === "shown", "the first-set guide is recorded as shown", JSON.stringify(focus.guideState));

  const exId = await page.evaluate(() => Object.keys(window.__repforgeWorkoutDraft.current().exercises)[0]);
  for (const [field, value] of [["load", "50"], ["reps", "8"], ["rir", "2"]]) {
    await page.locator(`#workout .exercise.is-current [data-k="${exId}_1_${field}"]`).fill(value);
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  }
  await page.locator(`#workout .exercise.is-current [data-save="${exId}_1"]`).click();
  await page.waitForFunction((id) => {
    const set = Object.values(window.__repforgeWorkoutDraft.current()?.exercises?.[id]?.sets || {}).find((s) => s.ordinal === 1);
    return set && set.completion !== "pending";
  }, exId, { timeout: 15000 });
  const logged = await page.evaluate(readSurface);
  assert(logged.guideState["first-set"] === "completed" && !logged.cues.includes("first-set"),
    "logging the first set completes the first-set guide (G-62)", JSON.stringify({ cues: logged.cues, state: logged.guideState }));
  // Logging starts the rest, and its live region speaks two frames later. That
  // announcement belongs to this step: wait for it, so the next window does not
  // inherit it.
  const restSaid = await page.waitForFunction(() => (document.querySelector("#restAnnounce")?.textContent || "").trim(),
    undefined, { timeout: 2500 }).then((handle) => handle.jsonValue()).catch(() => "");
  assert(/2:00/.test(restSaid), "logging the first set announces the rest it starts", JSON.stringify(restSaid));

  await mark(page);
  await finishEarly(page);
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 15000 });
  const summary = await handoff(page, "Focus -> summary", { view: "log", focus: "#sumTitle", top: false, guide: "focus-utilities" });
  const inert = await page.evaluate(() => ({
    main: document.querySelector("main").inert, nav: document.querySelector("nav").inert,
    modal: document.querySelector("#sessionSummary").getAttribute("aria-modal") || document.querySelector("#sessionSummary").tagName,
  }));
  assert(inert.main && inert.nav, "the summary is modal: the app behind it is inert", JSON.stringify(inert));
  void summary;

  await page.click("#sumDone");
  await page.waitForSelector("#sessionSummary", { state: "hidden", timeout: 8000 });
  const done = await handoff(page, "summary -> Today", { view: "log", focus: "#reviewTodaySession" });
  const recap = await page.evaluate(() => ({
    dash: !document.querySelector("#todayDash").classList.contains("hidden"),
    shell: document.querySelector("#workoutShell").classList.contains("hidden"),
    summary: document.querySelector("#sessionSummary").classList.contains("hidden"),
    inert: document.querySelector("main").inert || document.querySelector("nav").inert,
  }));
  assert(recap.dash && recap.shell && recap.summary && !recap.inert, "the finished session returns to an interactive Today", JSON.stringify(recap));
  void done;

  await mark(page);
  await page.click('nav button[data-view="stats"]');
  const progress = await handoff(page, "Today -> Progress", { view: "stats", focus: 'nav button[data-view="stats"]', guide: "progress" });
  assert(progress.dock.join() === "stats", "the dock marks Progress", JSON.stringify(progress.dock));
  await page.click('#statsSeg [data-seg="overview"]');
  const completed = await page.evaluate(readSurface);
  assert(completed.cues.length === 0 && completed.guideState.progress === "completed",
    "using what the Progress guide points at completes it (G-62)", JSON.stringify({ cues: completed.cues, state: completed.guideState }));
  await page.click('nav button[data-view="log"]');
  await mark(page);
  await page.click('nav button[data-view="stats"]');
  await handoff(page, "Progress again", { view: "stats", focus: 'nav button[data-view="stats"]' });

  await reload(page);
  const after = await page.evaluate(readSurface);
  assert(!after.landing, "after the first session a reload boots to the app, not the landing");
}
await first.context.close();

// ---------------------------------------------------------------------------
phase("Journey 2: shared link -> gate -> preview -> activation -> Today");
{
  const probe = await newDevice(browser);
  const encoded = await encodeSharedPayload(probe.page, cloneFixture(REPRESENTATIVE_PAYLOAD));
  await probe.context.close();
  assert(encoded.ok && typeof encoded.value === "string", "a setup link encodes", JSON.stringify(encoded).slice(0, 160));

  const { page, context } = await newDevice(browser, { hash: `#setup=${encoded.value}` });
  await waitForFirstRun(page);
  const gate = await handoff(page, "link -> gate", { view: "log", landing: true, focus: "#firstRun", top: false });
  const kind = await page.evaluate(() => ({ kind: document.querySelector("#firstRun").dataset.entryLanding,
    start: !document.querySelector("#firstRunSharedProgram").classList.contains("hidden") }));
  assert(kind.kind === "shared" && kind.start, "the shared gate offers Start this program", JSON.stringify(kind));
  void gate;

  await mark(page);
  await page.click("#firstRunSharedStart");
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
  await handoff(page, "gate -> preview", { view: "onboarding", focus: "#entryHeading" });

  await activate(page);
  const today = await handoff(page, "preview -> Today", { view: "log", focus: TODAY_HEADING, announced: 1 });
  assert(today.live.length === 1, "activation announces the saved program once", JSON.stringify(today.live));
  const cleared = await page.evaluate((name) => ({ hash: location.hash, cookie: document.cookie.includes(name) }), HANDOFF_COOKIE);
  assert(cleared.hash === "" && !cleared.cookie, "the link's fragment and handoff cookie are gone", JSON.stringify(cleared));
  await reload(page);
  const reloaded = await page.evaluate(readSurface);
  assert(!reloaded.landing && reloaded.views.join() === "log", "a reload boots to Today", JSON.stringify(reloaded));
  await context.close();
}

// ---------------------------------------------------------------------------
phase("Journey 3: no-program surfaces -> entry hub, cancel and return");
{
  const { page, context } = await newDevice(browser);

  // From the landing: cancelling lands on the no-program Today, not on the landing again.
  await mark(page);
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await handoff(page, "landing -> entry hub", { view: "onboarding", focus: "#entryHeading", guide: "entry" });
  await cancelEntry(page);
  await handoff(page, "cancel from the landing's entry", { view: "log", focus: TODAY_HEADING });
  const empty = await page.evaluate(() => ({
    noProgram: !document.querySelector("#todayNoProgram").classList.contains("hidden"),
    session: document.querySelector("#todaySession").classList.contains("hidden") }));
  assert(empty.noProgram && empty.session, "Today says there is no program and offers setup", JSON.stringify(empty));

  // Today's no-program card.
  await mark(page);
  await page.click("#todaySetupProgram");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await handoff(page, "no-program Today -> entry hub", { view: "onboarding", focus: "#entryHeading", guide: "entry" });
  await cancelEntry(page);
  await handoff(page, "cancel returns to Today", { view: "log", focus: "#todaySetupProgram" });

  // Program's no-program card.
  await mark(page);
  await page.click('nav button[data-view="program"]');
  await handoff(page, "dock -> Program", { view: "program", focus: 'nav button[data-view="program"]' });
  const blank = await page.evaluate(() => !document.querySelector("#programNoProgram").classList.contains("hidden"));
  assert(blank, "Program offers the same setup invitation");
  await mark(page);
  await page.click("#programSetupProgram");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await handoff(page, "no-program Program -> entry hub", { view: "onboarding", focus: "#entryHeading", guide: "entry" });
  await cancelEntry(page);
  const back = await handoff(page, "cancel returns to Program", { view: "program", focus: "#programSetupProgram" });
  assert(back.dock.join() === "program", "and the dock still marks Program", JSON.stringify(back.dock));

  // Settings' Create program.
  await mark(page);
  await page.click('nav button[data-view="log"]');
  await page.click("#openSettings");
  await handoff(page, "Today -> Settings", { view: "settings", focus: null, guide: "privacy", bodyOk: true });
  await mark(page);
  await page.click("#createProgram");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await handoff(page, "Settings -> entry hub", { view: "onboarding", focus: "#entryHeading", guide: "entry" });
  await cancelEntry(page);
  await handoff(page, "cancel returns to Settings", { view: "settings", focus: "#createProgram", guide: "privacy" });

  await context.close();
}

// ---------------------------------------------------------------------------
phase("Journey 4: returning landing -> chooser resume -> activation");
{
  const { page, context } = await newDevice(browser);
  await page.click("#firstRunCreate");
  await page.waitForSelector(goal, { timeout: 15000 });
  await page.click(goal);
  await page.waitForFunction((key) => {
    try { return JSON.parse(localStorage.getItem(key) || "{}").state?.route === "recommend"; } catch { return false; }
  }, SETUP_DRAFT, { timeout: 10000 });

  await reload(page);
  await waitForFirstRun(page);
  const landing = await handoff(page, "reload -> returning landing", { view: "log", landing: true, focus: "#firstRun", top: false });
  const lead = await page.evaluate(() => ({ visit: document.querySelector("#firstRun").dataset.entryVisit,
    draft: document.querySelector("#firstRun").dataset.entryDraft, label: document.querySelector("#firstRunCreate").textContent.trim() }));
  assert(lead.visit === "returning" && lead.draft === "recommend", "the landing is the returning one and names the half-done setup", JSON.stringify(lead));
  void landing;

  await mark(page);
  await page.click("#firstRunCreate");
  await page.waitForSelector("#entryResumeContinue", { timeout: 15000 });
  await handoff(page, "returning landing -> resume prompt", { view: "onboarding", focus: "#entryResumeTitle" });

  await mark(page);
  await page.click("#entryResumeContinue");
  await page.waitForSelector('[data-entry-pick="structuredExperience"]', { timeout: 15000 });
  await handoff(page, "resume -> chooser step", { view: "onboarding", focus: "#entryHeading" });

  await walkRecommend(page);
  await activate(page);
  const today = await handoff(page, "resumed setup -> Today", { view: "log", focus: TODAY_HEADING, announced: 1 });
  assert(today.live.length === 1, "activation announces the saved program once", JSON.stringify(today.live));
  const draft = await page.evaluate((key) => localStorage.getItem(key), SETUP_DRAFT);
  assert(draft === null, "the resumed setup draft is gone after activation");
  await reload(page);
  const reloaded = await page.evaluate(readSurface);
  assert(!reloaded.landing && reloaded.views.join() === "log", "a reload boots to Today, not the landing", JSON.stringify(reloaded));
  await context.close();
}

await browser.close();
assert(!pageErrors.length, "no uncaught page errors in any journey", pageErrors.slice(0, 3).join(" | "));
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exit(results.failed ? 1 : 0);
