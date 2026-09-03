#!/usr/bin/env node
/**
 * Screenshots of the exercise-library surfaces, for review and the PR.
 * Writes docs/design/library/*.png.
 * Run: node test/library-shots.mjs   (requires the app served over HTTP)
 */
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "design", "library");
mkdirSync(OUT, { recursive: true });

/* Toasts linger for a few seconds and would sit over whatever is being
   captured, so each shot waits for the live region to go quiet first. */
async function shot(page, name) {
  await page.waitForFunction(() => {
    const el = document.querySelector("#toast");
    return !el || el.classList.contains("hidden") || !el.textContent.trim();
  }, { timeout: 6000 }).catch(() => {});
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}
const settle = (page, ms = 350) => page.waitForTimeout(ms);

async function waitForApp(page) {
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 15000 });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
    window.closeFirstRun?.();
    if (el?.classList.contains("active") && typeof window.closeOnboarding === "function") window.closeOnboarding();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden") && typeof window.closeTour === "function") window.closeTour();
  });
  await page.waitForFunction(() => typeof window.__repforgeExerciseLibrary === "object", { timeout: 15000 });
}

async function openEditor(page) {
  await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
  await settle(page, 200);
  await page.evaluate(() => {
    if (document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"))
      document.querySelector("#programEditToggle")?.click();
  });
  await page.waitForSelector("#programEditor .pex", { timeout: 5000 });
}

async function pickExact(page, name) {
  await page.fill("#exPickSearch", name);
  await settle(page, 200);
  return page.evaluate((n) => {
    const row = [...document.querySelectorAll("#exPickList .pickrow")]
      .find((r) => (r.querySelector(".pickrow__name")?.textContent || "").trim().toLowerCase() === n.toLowerCase());
    if (!row) return false;
    row.click();
    return true;
  }, name);
}

const browser = await launchChromium();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on("dialog", (d) => d.accept());
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await waitForApp(page);
await page.evaluate(async ({ k, d }) => {
  localStorage.removeItem(k);
  localStorage.removeItem(d);
  await new Promise((res) => {
    const req = indexedDB.deleteDatabase("repforge");
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
}, { k: KEY, d: DRAFT });
await page.reload({ waitUntil: "domcontentloaded" });
await waitForApp(page);

// 1 — the program editor: a linked slot states what it follows
await openEditor(page);
await settle(page);
await shot(page, "01-program-editor");

const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const day = state.program[0].day;
const slot = state.program[0];

// 2 — quick add: suggested for this day, with the library one tap on
await page.click(`[data-act="addEx"][data-day="${day}"]`);
await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
await settle(page);
await shot(page, "02-quick-add");

// 3 — the full library: mixed artwork and empty tiles, multi-selection
await page.click("#exPickFull");
await page.waitForSelector("#library.active", { timeout: 5000 });
await settle(page, 500);
await page.evaluate(() => {
  const want = ["Hack squat machine", "Leg press", "Barbell hip thrust"];
  for (const name of want) {
    const row = [...document.querySelectorAll("#libList .librow")]
      .find((r) => (r.querySelector(".librow__name")?.textContent || "").trim() === name);
    row?.querySelector("[data-lib-toggle]")?.click();
  }
});
await settle(page, 400);
await page.evaluate(() => {
  const row = [...document.querySelectorAll("#libList .librow")]
    .find((r) => (r.querySelector(".librow__name")?.textContent || "").trim() === "Hack squat machine");
  row?.scrollIntoView({ block: "center" });
});
await settle(page, 600);
await shot(page, "03-full-library");

// 4 — the definition behind a row
await page.evaluate(() => {
  const row = [...document.querySelectorAll("#libList .librow")]
    .find((r) => (r.querySelector(".librow__name")?.textContent || "").trim() === "Hack squat machine");
  row?.querySelector("[data-lib-preview]")?.click();
});
await page.waitForSelector("#exercisePreview.active", { timeout: 5000 });
await settle(page, 600);
await shot(page, "04-exercise-preview");
await page.click("#previewBack");
await page.waitForSelector("#library.active", { timeout: 5000 });
await settle(page, 300);

// 5 — sets and rep ranges, before the day is written
await page.click("#libPrimary");
await settle(page, 500);
await shot(page, "05-batch-configuration");
await page.click("#libPrimary");
await settle(page, 800);

// 6 — a custom definition
await openEditor(page);
await page.evaluate((d) => window.__repforgeOpenLibrary({ day: d }), day);
await page.waitForSelector("#library.active", { timeout: 5000 });
await page.fill("#libSearch", "Hammer Strength row");
await settle(page, 300);
await page.click("#libCustom");
await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
await page.evaluate(() => {
  [...document.querySelectorAll("#exCustomEquip .pchip")].find((b) => b.textContent.trim() === "Machine")?.click();
  [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Mid/upper back")?.click();
  [...document.querySelectorAll("#exCustomSecondary .pchip")].find((b) => b.textContent.trim() === "Biceps")?.click();
});
await settle(page, 400);
await shot(page, "06-custom-exercise");
await page.click("#exCustomCancel");
await settle(page, 400);
await page.click("#libClose");
await settle(page, 400);

// 7 — importing: reviewed before anything is written
await openEditor(page);
await page.evaluate(() => document.querySelector("#advanced")?.setAttribute("open", ""));
await settle(page, 200);
const imported = JSON.stringify({
  version: 3,
  meta: { name: "Upper / lower" },
  exercises: [
    { day: "Day 1", order: 1, name: "Barbell bench press", sets: 4, min: 4, max: 8 },
    { day: "Day 1", order: 2, name: "Puxada frontal", sets: 3, min: 8, max: 12 },
    { day: "Day 1", order: 3, name: "Lat pulldown neutral grip", sets: 3, min: 8, max: 12 },
    { day: "Day 2", order: 1, name: "RDL", sets: 3, min: 6, max: 10 },
    { day: "Day 2", order: 2, name: "Smith unilateral calf thing", sets: 3, min: 10, max: 15 },
  ],
  customExercises: [],
});
await page.setInputFiles("#importProgram", {
  name: "upper-lower.json", mimeType: "application/json", buffer: Buffer.from(imported),
});
await page.waitForSelector("#importReview.active", { timeout: 5000 });
await settle(page, 500);
await shot(page, "07-import-review");

// 8 — the workout swap, and what it records
await page.click("#importReviewCancel");
await settle(page, 400);
await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
await settle(page, 300);
await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
await page.waitForSelector("#workout .exercise", { timeout: 5000 });
await page.evaluate((id) => {
  const art = document.querySelector(`.exercise[data-ex="${id}"]`);
  if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
  art?.scrollIntoView({ block: "center" });
}, slot.id);
await settle(page);
await page.click(`.subst__pick[data-sub="${slot.id}"]`);
await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
await settle(page, 400);
await shot(page, "08-workout-swap");
await pickExact(page, "Lat pulldown");
await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
await settle(page, 500);
await page.evaluate((id) => document.querySelector(`.exercise[data-ex="${id}"]`)?.scrollIntoView({ block: "center" }), slot.id);
await settle(page);
await shot(page, "09-workout-swapped");

await browser.close();
console.log(`screenshots written to ${OUT}`);
