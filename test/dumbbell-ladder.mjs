#!/usr/bin/env node
/**
 * The dumbbell ladder (owner rule, 2026-11-13): the dumbbells a gym stocks, per hand, are 1 kg steps to 10 kg, then
 * 2 kg steps, to 60 kg. On a dumbbell lift in Focus:
 *  - the engine is handed the ladder as its available loads, and its suggestion is a rung of it;
 *  - the wheel offers the ladder;
 *  - the ± steppers move a rung at a time across the 10 kg boundary (9 → 10 → 12 and back) and say how far;
 *  - a lift that is not a dumbbell keeps its own step on the wheel and the steppers.
 * The engine arithmetic over the ladder is proved in test/starting-loads.mjs.
 *
 * Run: node test/dumbbell-ladder.mjs   (requires the app served over HTTP; REPFORGE_URL)
 */
import { chromium } from "playwright";
import { loadManifest } from "../tools/ui-screens/manifest.mjs";
import { APP_SCENARIOS, appState } from "../tools/ui-screens/screens-app.mjs";
import { dismissChrome, openPage, settle } from "../tools/ui-screens/session.mjs";

const results = { passed: 0, failed: 0 };
function check(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}${detail === undefined ? "" : `\n      ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`); }
}
const LADDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  42, 44, 46, 48, 50, 52, 54, 56, 58, 60];
const PER_SIDE_LOAD = "25a5c6f170d880e2990fc88146f7de56";
const CURRENT = "#workout .exercise.is-current";
const manifest = loadManifest();

/** The current exercise's load field, its pads and what the engine was given for it. */
const focusLoad = (page, metricId) => page.evaluate((id) => {
  const ex = document.querySelector("#workout .exercise.is-current");
  const slot = window.__repforgeProgression.programSlot(ex.dataset.ex);
  const rec = window.__repforgeProgression.recommendation(slot);
  const target = rec.targetSets?.find((item) => item.prescription?.setIndex === 1)?.result;
  return {
    status: rec.engineStatus, available: target?.loadingAssumptions?.availableLoadsKg || null,
    target: target?.targets?.loadPerSideKg ?? target?.targets?.loadKg ?? null,
    value: Number(ex.querySelector(`input[data-metric-id="${id}"]`)?.value),
    pads: [...ex.querySelectorAll(".shelf__pad")].map((pad) => pad.textContent.trim()),
  };
}, metricId);
async function setLoad(page, metricId, value) {
  await page.evaluate(async ([id, v]) => {
    const input = document.querySelector(`#workout .exercise.is-current input[data-metric-id="${id}"]`);
    input.value = String(v);
    await input.oninput?.();
    await window.__repforgeWorkoutDraft.flush();
  }, [metricId, value]);
}
/** The first tap on the shelf can raise the first-set guide; it is dismissed so the tap lands where it is aimed. */
async function clearGuide(page) {
  if (await page.locator("dialog#guideDialog[open]").count()) {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog#guideDialog[open]"), undefined, { timeout: 5000 });
  }
}
async function tap(page, selector) {
  await clearGuide(page);
  await page.locator(selector).click();
  await clearGuide(page);
}
async function pad(page, metricId, dir) {
  await tap(page, `${CURRENT} .focus-shelf .shelf__pad >> nth=${dir > 0 ? 1 : 0}`);
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  return (await focusLoad(page, metricId)).value;
}
async function wheelValues(page, metricId) {
  const field = `${CURRENT} .focus-shelf [data-shelf-field="metric_${metricId}"]`;
  await tap(page, field);
  if (!(await page.locator("#wheelSheet.is-open").count())) await tap(page, field);
  await page.waitForSelector("#wheelSheet.is-open", { timeout: 5000 });
  const values = await page.evaluate(() => [...document.querySelectorAll("#wheelCol .wheel__item")].map((item) => Number(item.dataset.wheelV)));
  await page.keyboard.press("Escape");
  await page.waitForSelector("#wheelSheet", { state: "hidden" });
  return values;
}

const browser = await chromium.launch();
try {
  console.log("\nA dumbbell lift in Focus");
  const capture = { flow: "workout", screen: "focus-per-side", viewport: "phone-390", theme: "light", locale: "en", text: "normal", motion: "reduced" };
  const { context, page } = await openPage(browser, manifest, capture, appState("workout/focus-per-side", "en"));
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await dismissChrome(page);
    await APP_SCENARIOS["workout/focus-per-side"](page);
    await settle(page);
    const isDumbbell = await page.evaluate(() => {
      const ex = document.querySelector("#workout .exercise.is-current");
      const slot = window.__repforgeProgression.programSlot(ex.dataset.ex);
      return window.RepForgeStartingLoads.isDumbbell({ exercise: window.RepForgeExerciseCatalog.getExercise(slot.exerciseId) ?? null,
        lookup: (id) => window.RepForgeExerciseCatalog.getObject(id) ?? null });
    });
    let s = await focusLoad(page, PER_SIDE_LOAD);
    check(JSON.stringify(s.available) === JSON.stringify(LADDER), "the engine is handed the dumbbell ladder as its available loads", { isDumbbell, available: s.available });
    check(s.status === "recommended" && LADDER.includes(s.target) && s.value === s.target, "its suggestion is a rung of the ladder, and the field shows it", s);

    // Why says how the ladder moves: two step sizes and where they change, not the smallest gap alone.
    await page.evaluate(() => document.querySelector("#workout .exercise.is-current [data-why]").click());
    await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
    const why = await page.evaluate(() => document.querySelector("#whySheet").textContent);
    check(/Loads move in 1 kg steps up to 10 kg, then 2 kg steps\./.test(why), "Why says the ladder's steps: 1 kg to 10 kg, then 2 kg", why.slice(why.indexOf("How it loads"), why.indexOf("How it loads") + 120));
    await page.keyboard.press("Escape");
    await page.waitForSelector("#whySheet", { state: "hidden" });

    const wheel = await wheelValues(page, PER_SIDE_LOAD);
    check(JSON.stringify(wheel.filter((v) => v > 0)) === JSON.stringify(LADDER), "the wheel offers the ladder", wheel);

    await setLoad(page, PER_SIDE_LOAD, 9);
    s = await focusLoad(page, PER_SIDE_LOAD);
    check(/\+ ?1 kg/.test(s.pads[1]) && /− ?1 kg/.test(s.pads[0]), "at 9 kg the steppers read ±1 kg", s.pads);
    const up1 = await pad(page, PER_SIDE_LOAD, 1);
    s = await focusLoad(page, PER_SIDE_LOAD);
    check(up1 === 10 && /\+ ?2 kg/.test(s.pads[1]) && /− ?1 kg/.test(s.pads[0]), "+ goes 9 → 10; at 10 the steppers read +2 kg and −1 kg", { up1, pads: s.pads });
    const up2 = await pad(page, PER_SIDE_LOAD, 1);
    check(up2 === 12, "+ goes 10 → 12, never 11 or 12.5", up2);
    const down = await pad(page, PER_SIDE_LOAD, -1);
    check(down === 10, "− goes 12 → 10", down);
    await setLoad(page, PER_SIDE_LOAD, 13);
    const snapUp = await pad(page, PER_SIDE_LOAD, 1);
    await setLoad(page, PER_SIDE_LOAD, 13);
    const snapDown = await pad(page, PER_SIDE_LOAD, -1);
    check(snapUp === 14 && snapDown === 12, "a typed load between rungs steps to the next rung either way", { snapUp, snapDown });
    await setLoad(page, PER_SIDE_LOAD, 60);
    const top = await page.evaluate(() => [...document.querySelectorAll("#workout .exercise.is-current .focus-shelf .shelf__pad")].map((b) => ({ text: b.textContent.trim(), off: b.disabled })));
    check(top[1].off && !top[0].off && /− ?2 kg/.test(top[0].text), "at the top rung + rests and − reads −2 kg", top);

    console.log("\nA lift that is not a dumbbell keeps its own step");
    const other = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      const loads = window.RepForgeStartingLoads, catalog = window.RepForgeExerciseCatalog;
      const row = (state.program || []).find((entry) => {
        const exercise = catalog.getExercise(entry.libraryId);
        return exercise && /smith machine bench press/i.test(exercise.name) && !loads.isDumbbell({ exercise, lookup: (id) => catalog.getObject(id) ?? null });
      });
      return row ? { id: row.id } : null;
    });
    check(!!other, "the program has a lift that is not a dumbbell", other);
    if (other) {
      await page.evaluate((id) => window.__repforgeGoToLogExercise(id), other.id);
      await page.waitForFunction((id) => document.querySelector("#workout .exercise.is-current")?.dataset.ex === id, other.id, { timeout: 15000 });
      other.metric = await page.evaluate(() => document.querySelector("#workout .exercise.is-current .focus-shelf [data-shelf-field^='metric_']")
        ?.dataset.shelfField.slice(7));
      s = await focusLoad(page, other.metric);
      // A lift with no history yet has no engine assumptions to read; when it has them they keep the step too.
      check(/\+ ?2\.5 kg/.test(s.pads[1]) && /− ?2\.5 kg/.test(s.pads[0]) && (!s.available || s.available.every((kg, i, all) => i === 0 || Math.abs(kg - all[i - 1] - 2.5) < 1e-9)),
        "its steppers (and any engine assumptions) keep the 2.5 kg step", { pads: s.pads, head: s.available?.slice(0, 6) });
      const values = await wheelValues(page, other.metric);
      check(Math.abs(values[1] - values[0] - 2.5) < 1e-9 && values[0] === 0, "its wheel still steps by 2.5 kg from zero", values.slice(0, 6));
    }
    check(!errors.length, "no page errors", errors);
  } finally { await context.close(); }
} finally {
  await browser.close();
}
console.log(`\n${results.passed} passed, ${results.failed} failed`);
process.exitCode = results.failed ? 1 : 0;
