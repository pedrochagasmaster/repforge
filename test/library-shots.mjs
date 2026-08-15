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
  await page.waitForSelector("#dayTabs button", { timeout: 15000, state: "attached" });
  await page.evaluate(() => {
    const el = document.querySelector("#onboarding");
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

// 1 — the program editor, with a swap control per slot and the alternates row
await openEditor(page);
await settle(page);
await shot(page, "01-program-editor");

const state = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const day = state.program[0].day;
const slot = state.program[0];

// 2 — the picker, opened by + Add exercise
await page.click(`[data-act="addEx"][data-day="${day}"]`);
await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
await settle(page);
await shot(page, "02-picker");

// 3 — search, ranked so the staple leads its own results
await page.fill("#exPickSearch", "row");
await settle(page);
await shot(page, "03-picker-search");

// 4 — a muscle filter narrowing the library
await page.fill("#exPickSearch", "");
await page.evaluate(() =>
  [...document.querySelectorAll("#exPickFilters .pchip")].find((b) => b.textContent.trim() === "Legs")?.click());
await settle(page);
await shot(page, "04-picker-filter");

// 5 — creating what the library does not have, named from the search
await page.evaluate(() =>
  [...document.querySelectorAll("#exPickFilters .pchip")].find((b) => b.textContent.trim() === "All")?.click());
await page.fill("#exPickSearch", "Belt squat");
await settle(page, 250);
await shot(page, "05-picker-no-match");
await page.click("#exPickCustom");
await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
await page.evaluate(() => {
  [...document.querySelectorAll("#exCustomPrimary .pchip")].find((b) => b.textContent.trim() === "Quads")?.click();
  [...document.querySelectorAll("#exCustomSecondary .pchip")].find((b) => b.textContent.trim() === "Glutes")?.click();
});
await settle(page);
await shot(page, "06-custom-exercise");
await page.click("#exCustomSave");
await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 5000 });
await settle(page, 400);

// 7 — alternates, picked rather than typed, with what is already set preselected
await openEditor(page);
await page.click(`[data-act="pickAlternates"][data-id="${slot.id}"]`);
await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
await settle(page);
await shot(page, "07-alternates");
await page.click("#exPickCancel");
await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });

// 8 — the mid-session swap, from the Log tab
await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
await settle(page, 250);
await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
await page.waitForSelector("#workout .exercise", { timeout: 5000 });
await page.evaluate((id) => {
  const art = document.querySelector(`.exercise[data-ex="${id}"]`);
  if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
  art?.scrollIntoView({ block: "center" });
}, slot.id);
await settle(page);
await shot(page, "08-workout-swap-control");
await page.click(`.subst__pick[data-sub="${slot.id}"]`);
await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
await settle(page);
await shot(page, "09-workout-swap");
await pickExact(page, "Leg press");
await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
await settle(page, 400);
await page.evaluate((id) => document.querySelector(`.exercise[data-ex="${id}"]`)?.scrollIntoView({ block: "center" }), slot.id);
await settle(page);
await shot(page, "10-workout-swapped");

// 11 — importing a split: names the library knows get linked, the rest kept
await page.evaluate(() => window.__repforgeLeaveWorkout?.());
await settle(page, 250);
await openEditor(page);
await page.evaluate(() => document.querySelector("#advanced")?.setAttribute("open", ""));
await settle(page, 200);
const imported = JSON.stringify([
  { day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 5, max: 8 },
  { day: "Day 1", order: 2, name: "Lat pulldown", sets: 3, min: 8, max: 12 },
  { day: "Day 1", order: 3, name: "Supino com barra", sets: 3, min: 6, max: 10 },
  { day: "Day 2", order: 1, name: "Reverse Zercher goblet thing", sets: 3, min: 8, max: 12 },
  { day: "Day 2", order: 2, name: "Seated row machine", sets: 3, min: 8, max: 12 },
]);
await page.setInputFiles("#importProgram", {
  name: "my-split.json", mimeType: "application/json", buffer: Buffer.from(imported),
});
await settle(page, 600);
// Captured without waiting the toast out: the match count is the point.
await page.screenshot({ path: join(OUT, "11-import-linked.png") });

// A row the library could not match keeps what was imported and shows an
// accented swap control — the invitation to link it by hand.
await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#programEditor .pex")];
  const unlinked = rows.find((r) => r.querySelector(".pex__swap.is-unlinked"));
  (unlinked || rows[0])?.scrollIntoView({ block: "center" });
});
await settle(page, 400);
await shot(page, "12-import-unmatched");

const linked = await page.evaluate((k) =>
  JSON.parse(localStorage.getItem(k)).program.map((e) => [e.name, e.libraryId || null, e.primary]), KEY);
console.log("imported program:", JSON.stringify(linked, null, 1));
await browser.close();
console.log(`screenshots written to ${OUT}`);
