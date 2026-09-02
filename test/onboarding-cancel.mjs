#!/usr/bin/env node
/**
 * Backing out of onboarding.
 *
 * A device that has never finished setup holds no program. Cancel used to drop
 * the lifter onto Today with a bundled three-day split they had never seen,
 * presented in every way as their own training: a named day, a muscle list, a
 * Start workout button, a week strip counting sessions against it. This suite
 * holds the opposite contract — nothing is loaded, Today and Program say so,
 * and the way back into setup is the only thing on offer.
 *
 * Run: node test/onboarding-cancel.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium, waitForAppBoot } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const SETUP_DRAFT = "repforge_setup_draft_v1";

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
const phase = (n) => console.log(`\n${n}`);

async function clearState(page) {
  await page.evaluate(
    async ({ k, d, s }) => {
      [k, d, s].forEach((key) => localStorage.removeItem(key));
      await new Promise((res) => {
        const req = indexedDB.deleteDatabase("repforge");
        req.onsuccess = () => res();
        req.onerror = () => res();
        req.onblocked = () => res();
      });
    },
    { k: KEY, d: DRAFT, s: SETUP_DRAFT }
  );
}

/** What Today currently offers. */
async function todayView(page) {
  return page.evaluate(() => {
    const shown = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.classList.contains("hidden");
    };
    return {
      empty: shown("#todayNoProgram"),
      emptyTitle: document.querySelector("#todayNoProgram .emptystate__title")?.textContent?.trim() || "",
      cta: document.querySelector("#todaySetupProgram")?.textContent?.trim() || "",
      session: shown("#todaySession"),
      sessionName: document.querySelector("#todaySession .today-session__name")?.textContent?.trim() || "",
      start: shown("#startWorkout"),
      chooseDay: shown("#chooseAnotherDay"),
      viewExercises: shown("#viewExercises"),
      week: shown("#todayWeek"),
      upNext: shown("#todayUpNext"),
      dayTabs: document.querySelectorAll("#dayTabs button").length,
      text: (document.querySelector("#log")?.innerText || "").replace(/\s+/g, " ").trim(),
    };
  });
}

/** Drive the Recommend route through activation, as `test/simulation.mjs` does. */
async function completeOnboarding(page) {
  await page.click('[data-entry-route="recommend"]');
  await page.click('[data-entry-pick="desiredResult"][data-entry-val="muscle_growth"]');
  await page.click("#onbNext");
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
  if (await page.locator("[data-entry-select-candidate]").count()) {
    await page.locator("[data-entry-select-candidate]").first().click();
  }
  await page.waitForSelector("#entryActivate", { timeout: 15000 });
  await page.click("#entryActivate");
  await page.waitForFunction(
    () => !document.querySelector("#onboarding")?.classList.contains("active"),
    undefined,
    { timeout: 15000 }
  );
}

/** Cancel out of the entry hub, discarding the setup draft. */
async function cancelOnboarding(page) {
  await page.click("#onbCancel");
  await page.waitForSelector("#entryCancelDiscard", { timeout: 10000 });
  await page.click("#entryCancelDiscard");
  await page.waitForFunction(
    () => !document.querySelector("#onboarding")?.classList.contains("active"),
    undefined,
    { timeout: 10000 }
  );
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await clearState(page);
await page.reload({ waitUntil: "domcontentloaded" });
await waitForAppBoot(page, { base: BASE });

phase("Phase: a device that has never been through setup");
{
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
  assert(
    Array.isArray(stored?.program) && stored.program.length === 0,
    "first run persists no program rows",
    JSON.stringify(stored?.program?.slice(0, 2) || stored?.program)
  );
  assert(
    stored?.programMeta?.onboarded === false,
    "and is not marked onboarded",
    String(stored?.programMeta?.onboarded)
  );
  const gate = await page.evaluate(() => !document.querySelector("#firstRun")?.classList.contains("hidden"));
  assert(gate, "the first-run gate opens over it");
}

phase("Phase: cancelling out of the entry hub");
{
  await page.click("#firstRunCreate");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await cancelOnboarding(page);

  const view = await todayView(page);
  assert(view.empty, "Today shows the no-program state", JSON.stringify(view));
  assert(!!view.emptyTitle && !!view.cta, "with a title and a way back into setup",
    `${view.emptyTitle} / ${view.cta}`);
  assert(!view.start && !view.chooseDay && !view.viewExercises,
    "and offers no session controls", JSON.stringify(view));
  assert(!view.session && !view.week && !view.upNext,
    "no session card, week strip, or Up next", JSON.stringify(view));
  assert(view.dayTabs === 0, "and no training days to log against", String(view.dayTabs));
  assert(
    !/Day 1|Hack squat|Leg curl/i.test(view.text),
    "nothing on the tab names a program the lifter never chose",
    view.text.slice(0, 200)
  );

  const stillEmpty = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null")?.program?.length, KEY);
  assert(stillEmpty === 0, "cancelling writes no program", String(stillEmpty));
}

phase("Phase: the Program tab tells the same story");
{
  await page.evaluate(() => document.querySelector('nav [data-view="program"]')?.click());
  await page.waitForTimeout(400);
  const prog = await page.evaluate(() => {
    const shown = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.classList.contains("hidden");
    };
    return {
      empty: shown("#programNoProgram"),
      overview: shown("#programOverview"),
      editToggle: shown("#programEditToggle"),
      text: (document.querySelector("#program")?.innerText || "").replace(/\s+/g, " ").trim(),
    };
  });
  assert(prog.empty, "Program shows the no-program state", JSON.stringify(prog));
  assert(!prog.overview && !prog.editToggle,
    "not an empty summary with an Edit affordance", JSON.stringify(prog));
  assert(!/Untitled program/i.test(prog.text), "and never names an untitled program", prog.text.slice(0, 160));
  await page.evaluate(() => document.querySelector('nav [data-view="log"]')?.click());
  await page.waitForTimeout(300);
}

phase("Phase: the empty state is a door, not a dead end");
{
  await page.click("#todaySetupProgram");
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  const routes = await page.evaluate(() => document.querySelectorAll("[data-entry-route]").length);
  assert(routes > 0, "the CTA reopens the entry hub with its routes", String(routes));
}

phase("Phase: a reload still has nothing loaded");
{
  await cancelOnboarding(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  await page.evaluate(() => window.closeFirstRun?.());
  await page.waitForTimeout(300);
  const view = await todayView(page);
  assert(view.empty && !view.start, "Today is still empty after a reload", JSON.stringify(view));
}

phase("Phase: finishing setup fills Today back in");
{
  await page.evaluate(() => window.startOnboarding("first-run", { userInitiated: true }));
  await page.waitForSelector("#onboarding.active", { timeout: 15000 });
  await completeOnboarding(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelector('nav [data-view="log"]')?.click();
    if (document.body.classList.contains("is-settings")) document.querySelector("#settingsBack")?.click();
  });
  await page.waitForTimeout(500);
  const view = await todayView(page);
  assert(!view.empty, "the no-program state is gone", JSON.stringify(view));
  assert(view.start && !!view.sessionName, "Today offers the activated program's session", JSON.stringify(view));
  assert(view.dayTabs > 0, "and the program has training days", String(view.dayTabs));

  await page.evaluate(() => document.querySelector('nav [data-view="program"]')?.click());
  await page.waitForTimeout(400);
  const progEmpty = await page.evaluate(
    () => !document.querySelector("#programNoProgram")?.classList.contains("hidden")
  );
  assert(!progEmpty, "and Program shows the program, not the invitation");
}

assert(!errors.length, "no uncaught page errors", errors.slice(0, 3).join(" | "));

await context.close();
await browser.close();

console.log(`\nOnboarding cancel: ${results.passed} passed, ${results.failed} failed`);
if (pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(results.failed > 0 ? 1 : 0);
