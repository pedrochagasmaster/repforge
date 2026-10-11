#!/usr/bin/env node
/**
 * #353: Generate runs off the main thread.
 *
 * The program engine (program-engine.js) runs the compiler in a dedicated
 * worker and, when a worker cannot run, on the main thread with the same code.
 * A setup link and a reload both regenerate a program from its request and
 * seed, so the two paths must agree byte for byte:
 *
 * - every request in the recorded compiler corpus gives the same JSON from the
 *   worker as from the page's own compiler, and both match the digest recorded
 *   from main;
 * - with no Worker constructor, with a worker script that fails to load and
 *   with a worker that cannot read the catalog, the engine falls back to the
 *   main thread and still gives the recorded output;
 * - while the worker runs the heaviest satisfiable request, the page keeps
 *   drawing frames: no frame gap comes near the time the same request blocks
 *   the main thread for.
 *
 * Generation is asynchronous, so the entry flow holds each request until the
 * test releases it: Continue stays on the question until its program lands
 * (and a second tap does not start another), Back during the wait drops it,
 * an answer changed while an earlier change is generating builds on it and
 * the earlier result is discarded, and a conflict leaves the committed
 * program in place with its explanation.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { launchChromium, waitForAppBoot } from "./browser.mjs";
import { corpusCases } from "./fixtures/program-compiler-corpus-cases.mjs";

const require = createRequire(import.meta.url);
const Adapter = require("../program-entry-adapter.js");
const Compiler = require("../program-compiler.js");
const Catalog = require("../assets/exercise-catalog.json");
const fixture = JSON.parse(fs.readFileSync(new URL("./fixtures/program-compiler-corpus.json", import.meta.url), "utf8"));

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const failures = [];
let passed = 0;
function check(condition, message, detail) {
  if (condition) { passed++; console.log(`  ✓ ${message}`); return; }
  failures.push(message);
  console.error(`  ✗ ${message}`);
  if (detail !== undefined) console.error(`    ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 2000)}`);
}

const cases = corpusCases({ Adapter, Catalog });
const sample = cases.filter((_, index) => index % 12 === 0);

async function open(browser, { contextOptions = {}, init } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.stack || error)));
  if (init) await page.addInitScript(init);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForAppBoot(page, { base: BASE });
  return { context, page, errors };
}

// Runs each case through the engine and through the page's compiler, and
// returns, per case, whether the two JSON texts are identical and the
// engine output's digest in the fixture's format.
function runCases(page, list) {
  return page.evaluate(async (items) => {
    const engine = window.__repforgeProgramEngine;
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const hex = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
      .map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const out = [];
    for (const { key, request, seed } of items) {
      const engineText = JSON.stringify(await engine.generate(request, seed));
      const pageText = JSON.stringify(window.RepForgeProgramCompiler.generateProgram(request, catalog, seed));
      const ok = JSON.parse(engineText).ok;
      out.push({ key, same: engineText === pageText, digest: `${ok ? "ok" : "conflict"}:${await hex(engineText)}` });
    }
    return out;
  }, list);
}

function checkDigests(results, label) {
  const mismatched = results.filter((item) => !item.same).map((item) => item.key);
  check(results.length > 0 && !mismatched.length, `${label}: engine and page compiler give identical JSON for ${results.length} requests`, mismatched);
  const drifted = results.filter((item) => fixture.digests[item.key] !== item.digest).map((item) => item.key);
  check(!drifted.length, `${label}: every output matches the digest recorded from main`, drifted);
}

const engineMode = (page) => page.evaluate(async () => {
  const engine = window.__repforgeProgramEngine;
  if (!engine) return { mode: "absent" };
  return { mode: await engine.ready(), stats: engine.stats() };
});

const entry = (page) => page.evaluate(() => window.__repforgeEntryState?.());
const pick = (page, key, value) => page.locator(`[data-entry-pick="${key}"][data-entry-val="${value}"]`).first().click();
const held = (page) => page.evaluate(() => window.__held.length);
const release = (page, index, outcome) => page.evaluate(({ index, outcome }) => window.__release(index, outcome), { index, outcome });
const expectedFor = (state) => {
  const mapped = Adapter.programRequestFromAnswers(state.answers, Catalog);
  return mapped.ok ? Compiler.generateProgram(mapped.value, Catalog, String(state.draftId)).value : null;
};
const sameDefinition = (state, answers) => {
  const expected = expectedFor({ ...state, answers });
  return !!expected && JSON.stringify(state.result?.preview?.programDefinition) === JSON.stringify(expected);
};

async function heldFlow(browser) {
  const { context, page, errors } = await open(browser);
  // Every generation waits here until the test releases it, in any order.
  await page.evaluate(() => {
    const base = window.__repforgeOnboarding.services();
    window.__held = [];
    window.__repforgeProgramEntryServicesOverride = { ...base,
      generateProgram: (args) => new Promise((resolve) => window.__held.push({ args, resolve })) };
    window.__release = (index, outcome) => { const job = window.__held[index]; job.resolve(outcome ?? base.generateProgram(job.args)); };
  });
  await page.click("#firstRunCreate");
  await page.locator('[data-entry-route="recommend"][data-entry-goal="muscle_growth"]').click();
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "background");
  await pick(page, "structuredExperience", "6_to_24m");
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "schedule");
  await pick(page, "daysPerWeek", 4);
  await pick(page, "sessionMinutes", 60);
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "environment");
  await pick(page, "environment", "commercial_gym");
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  await page.click("#entryAbilitiesSkip");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "priorities");

  // Back while the program generates drops it.
  await page.click("#onbNext");
  check(await held(page) === 1 && (await entry(page)).step === "priorities",
    "async flow: Continue keeps the question on screen while its program generates");
  check(await page.locator("#onbNext").getAttribute("aria-busy") === "true", "async flow: Continue reports that it is busy");
  await page.click("#onbBack");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "abilities");
  await release(page, 0);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const left = await entry(page);
  check(left.step === "abilities" && !left.result?.preview, "async flow: a program that lands after Back is dropped", { step: left.step });
  await page.click("#onbNext");
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "priorities");

  // Continue waits for its program; a second tap starts nothing.
  await page.click("#onbNext");
  check(await held(page) === 2, "async flow: Continue generates again after Back");
  await page.click("#onbNext");
  check(await held(page) === 2, "async flow: a second Continue does not start another generation");
  await release(page, 1);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.step === "result");
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ timeout: 15000 });
  const first = await entry(page);
  check(sameDefinition(first, first.answers), "async flow: the result step lands with the program for its answers");
  check(await page.locator("#onbNext").getAttribute("aria-busy") === null, "async flow: Continue is no longer busy");
  check(await held(page) === 2, "async flow: the review's recommendation is the program that just landed, not another generation");
  const committed = await entry(page);

  // The last answer wins and none is lost.
  await page.click('[data-entry-chip="days"]');
  await page.click('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="3"]');
  const beforeDays = await held(page);
  await page.click("#entryChipApply");
  await page.waitForFunction((count) => window.__held.length > count, beforeDays);
  const daysJob = (await held(page)) - 1;
  check((await entry(page)).answers.daysPerWeek === 4, "async flow: a changed answer is not committed before its program");
  check(await page.locator("#entryCandidateReview").getAttribute("aria-busy") === "true", "async flow: the review reports that it is rebuilding");
  await page.click('[data-entry-chip="minutes"]');
  await page.click('#entryEditor [data-entry-pick="sessionMinutes"][data-entry-val="90"]');
  await page.click("#entryChipApply");
  await page.waitForFunction((count) => window.__held.length > count, daysJob + 1);
  const minutesJob = (await held(page)) - 1;
  check(minutesJob === daysJob + 1, "async flow: the second answer starts its own generation, and only that",
    { daysJob, minutesJob, held: await page.evaluate(() => window.__held.map((job) => job.args.request.daysPerWeek)) });
  await release(page, minutesJob);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.answers?.sessionMinutes === 90);
  const latest = await entry(page);
  check(latest.answers.daysPerWeek === 3 && latest.answers.sessionMinutes === 90,
    "async flow: the last change builds on the one it superseded", latest.answers);
  check(sameDefinition(latest, latest.answers), "async flow: the program is the one for both changed answers");
  await release(page, daysJob);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  const after = await entry(page);
  check(JSON.stringify(after.answers) === JSON.stringify(latest.answers) &&
    JSON.stringify(after.result.preview.programDefinition) === JSON.stringify(latest.result.preview.programDefinition),
  "async flow: the superseded program is discarded when it lands");
  check(await page.locator("#entryCandidateReview").getAttribute("aria-busy") === null, "async flow: the review is no longer rebuilding");

  // An adjusted review asks before a rebuild discards it, and the rebuild
  // then starts from the recommendation.
  const firstSlot = latest.result.preview.programDefinition.days.find((day) => day.kind === "training").slots[0];
  await page.locator(`#entryReview [data-review-slot="${firstSlot.id}"]`).click();
  await page.waitForSelector("#reviewSheet.is-open [data-review-sets]", { timeout: 5000 });
  await page.locator('#reviewSheet [data-review-sets="1"]').click();
  await page.locator("#reviewSheet [data-review-done]").click();
  await page.waitForSelector("#reviewSheet", { state: "hidden", timeout: 5000 });
  check(!sameDefinition(await entry(page), latest.answers), "async flow: the review holds an adjustment");
  const beforeGuard = await held(page);
  await page.click('[data-entry-chip="days"]');
  await page.click('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="4"]');
  await page.click("#entryChipApply");
  await page.locator("#reviewConfirmGo").waitFor({ timeout: 10000 });
  check(await held(page) === beforeGuard, "async flow: nothing generates until the lifter confirms discarding the adjustment");
  await page.click("#reviewConfirmGo");
  await page.waitForFunction((count) => window.__held.length > count, beforeGuard);
  await release(page, (await held(page)) - 1);
  await page.waitForFunction(() => window.__repforgeEntryState?.()?.answers?.daysPerWeek === 4);
  const rebuilt = await entry(page);
  check(sameDefinition(rebuilt, rebuilt.answers), "async flow: the confirmed rebuild commits the program for the new answer");
  await page.locator("#entryReview [data-review-slot]").first().waitFor({ timeout: 15000 });
  check(!await page.locator("#entryReview [data-review-mark]").count(), "async flow: the rebuilt review carries no adjustment");

  // A conflict keeps the committed program and explains itself.
  await page.click('[data-entry-chip="days"]');
  await page.click('#entryEditor [data-entry-pick="daysPerWeek"][data-entry-val="5"]');
  const beforeConflict = await held(page);
  await page.click("#entryChipApply");
  await page.waitForFunction((count) => window.__held.length > count, beforeConflict);
  await release(page, (await held(page)) - 1, { ok: false, conflicts: [{ code: "time_ceiling_exceeded" }] });
  await page.locator("#entryEditorError").waitFor({ timeout: 10000 });
  const conflicted = await entry(page);
  check(JSON.stringify(conflicted.answers) === JSON.stringify(rebuilt.answers) &&
    JSON.stringify(conflicted.result.preview.programDefinition) === JSON.stringify(rebuilt.result.preview.programDefinition),
  "async flow: a conflicting change leaves the committed program in place");
  check(committed.answers.daysPerWeek === 4, "async flow: the walk started from four days");
  check(errors.length === 0, "async flow: no page errors", errors);
  await context.close();
}

async function main() {
  console.log("#353 Generate in a worker: equivalence, fallback and responsiveness");
  check(Object.keys(fixture.digests).length === cases.length, "the corpus cases are the fixture's recorded cases");
  const browser = await launchChromium();
  try {
    // Worker: the whole recorded corpus ----------------------------------
    {
      const { context, page, errors } = await open(browser);
      const before = await engineMode(page);
      check(before.mode === "worker", "the engine runs the compiler in a worker", before);
      if (before.mode === "worker") {
        checkDigests(await runCases(page, cases), "worker");
        const after = await page.evaluate(() => window.__repforgeProgramEngine.stats());
        check(after.worker - before.stats.worker === cases.length && after.main === before.stats.main,
          "every corpus request ran in the worker, none on the main thread", { before: before.stats, after });

        // The heaviest satisfiable request: all equipment, two long days.
        const heavy = Adapter.programRequestFromAnswers({ desiredResult: "muscle_growth", structuredExperience: "over_24m",
          daysPerWeek: 2, sessionMinutes: 120, environment: { kind: "commercial_gym" } }, Catalog).value;
        heavy.gymProfile = { equipmentIds: Object.keys(Catalog.uuidIndex).filter((id) => Catalog.uuidIndex[id]?.type === "equipment").sort() };
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
        const timing = await page.evaluate(async (request) => {
          const engine = window.__repforgeProgramEngine;
          const catalog = window.RepForgeExerciseCatalog.snapshot();
          // Main-thread reference: how long the same request blocks this thread.
          const mainStarted = performance.now();
          const reference = window.RepForgeProgramCompiler.generateProgram(request, catalog, "no-jank");
          const blocked = performance.now() - mainStarted;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const gaps = [];
          let running = true, last = performance.now();
          const tick = (now) => { gaps.push(now - last); last = now; if (running) requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
          // Keep the worker busy, request after request, for at least as long
          // as the same work blocks this thread, so the window holds several
          // frames however fast the worker's thread is.
          const started = performance.now();
          let generated = null, runs = 0;
          do { generated = await engine.generate(request, "no-jank"); runs++; }
          while (performance.now() - started < blocked);
          const took = performance.now() - started;
          running = false;
          return { ok: reference.ok && JSON.stringify(generated) === JSON.stringify(reference), blocked, took, runs,
            frames: gaps.length, maxGap: Math.max(0, ...gaps) };
        }, heavy);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        console.log(`    heaviest request at 6x CPU: main thread blocked ${Math.round(timing.blocked)} ms; ` +
          `${timing.runs} worker runs took ${Math.round(timing.took)} ms with ${timing.frames} frames, longest gap ${Math.round(timing.maxGap)} ms`);
        check(timing.ok, "the heaviest request gives the same program in the worker", timing);
        // The comparison below can only tell the two paths apart when the
        // main-thread block spans several frames; the throttle makes sure of it.
        check(timing.blocked > 100, "on the main thread the heaviest request blocks for several frames", timing);
        check(timing.frames >= 3 && timing.maxGap < timing.blocked / 2,
          "the page keeps drawing frames while the worker runs it", timing);
      }
      check(errors.length === 0, "worker run: no page errors", errors);
      await context.close();
    }

    // No Worker constructor ----------------------------------------------
    {
      const { context, page, errors } = await open(browser, { init: () => { delete window.Worker; } });
      const before = await engineMode(page);
      check(before.mode === "main", "without Worker the engine runs on the main thread", before);
      if (before.mode === "main") checkDigests(await runCases(page, sample), "no Worker");
      check(errors.length === 0, "no Worker: no page errors", errors);
      await context.close();
    }

    // The worker script does not load ------------------------------------
    {
      const { context, page, errors } = await open(browser, { contextOptions: { serviceWorkers: "block" } });
      await page.route("**/program-engine.js*", (route) => route.fulfill({ status: 404, body: "gone" }));
      const before = await engineMode(page);
      check(before.mode === "main", "a worker script that fails to load falls back to the main thread", before);
      if (before.mode === "main") checkDigests(await runCases(page, sample), "worker load failure");
      check(errors.length === 0, "worker load failure: no page errors", errors);
      await context.close();
    }

    // The worker cannot read the catalog ---------------------------------
    {
      const { context, page, errors } = await open(browser, { contextOptions: { serviceWorkers: "block" } });
      await context.route("**/assets/exercise-catalog.json*", (route) => route.abort());
      const before = await engineMode(page);
      check(before.mode === "main", "a worker without its catalog falls back to the main thread", before);
      if (before.mode === "main") checkDigests(await runCases(page, sample), "catalog load failure");
      check(errors.length === 0, "catalog load failure: no page errors", errors);
      await context.close();
    }

    await heldFlow(browser);
  } finally {
    await browser.close();
  }
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => { console.error(error); process.exit(1); });
