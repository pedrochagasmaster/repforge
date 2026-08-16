#!/usr/bin/env node
/**
 * A mid-session swap must move the work with it.
 *
 * Swapping a quad slot to a lat movement used to save the slot's muscles and
 * only a performedName string, so the volume audit credited quads for a set of
 * pulldowns. The row now carries a performed snapshot, and every muscle-level
 * reader prefers it — while the template slot id stays put so history,
 * recommendations and the draft keep working.
 *
 * Run: node test/performed-attribution.mjs   (requires the app served over HTTP)
 */
import { pathToFileURL } from "url";
import { launchChromium } from "./browser.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}

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

const getState = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "{}"), KEY);
const settle = (page, ms = 300) => page.waitForTimeout(ms);

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

async function main() {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  try {
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

    // A quad slot: the seed program's first Day 1 exercise.
    let state = await getState(page);
    const slot = state.program.filter((e) => e.day === state.program[0].day).sort((a, b) => a.order - b.order)[0];
    assert(/quad/i.test(slot.primary), "starting slot is a quad movement", `${slot.name} → ${slot.primary}`);

    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await settle(page);
    await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
    await page.waitForSelector("#workout .exercise", { timeout: 5000 });
    await page.evaluate((id) => {
      const art = document.querySelector(`.exercise[data-ex="${id}"]`);
      if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
    }, slot.id);
    await settle(page, 150);

    // Swap it to a lat movement for this session.
    await page.click(`.subst__pick[data-sub="${slot.id}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const swapped = await pickExact(page, "Lat pulldown");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    assert(swapped, "swapped the quad slot to Lat pulldown");

    await page.evaluate((id) => {
      const set = (k, v) => {
        const el = document.querySelector(`[data-k="${id}_1_${k}"]`);
        if (el) { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); }
      };
      set("load", 60); set("reps", 10); set("rir", 2);
    }, slot.id);
    await settle(page, 150);
    await page.evaluate(() => document.querySelector("#logForm")?.requestSubmit());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector("#sessionSummary .sumsheet__done, #sessionSummary button")?.click());
    await settle(page, 400);

    state = await getState(page);
    const row = state.log.find((r) => r.exerciseId === slot.id && +r.load === 60);
    assert(!!row, "the swapped set was saved", JSON.stringify(state.log.slice(-2)));
    assert(
      row && row.exerciseId === slot.id,
      "the template slot id is unchanged, so history stays attached",
      `${row?.exerciseId} vs ${slot.id}`
    );
    assert(
      row && row.performedLibraryId === "pd_mc" && row.performedName === "Lat pulldown",
      "the row records which movement was actually performed",
      JSON.stringify(row)
    );
    assert(
      row && row.performedPrimary === "Lats" && !/quad/i.test(row.performedPrimary),
      "the row records the performed movement's muscles",
      JSON.stringify([row?.performedPrimary, row?.performedSecondary])
    );

    // The point of all of it: the audit credits lats, not quads.
    const attributed = await page.evaluate((rowIn) => window.__repforgeRowMuscles(rowIn), row);
    assert(
      attributed.primary === "Lats",
      "muscle attribution follows the performed movement",
      JSON.stringify(attributed)
    );

    const volume = await page.evaluate(() => {
      const m = window.__repforgeCompletedVolume?.();
      return m ? Object.fromEntries(Object.entries(m)) : null;
    });
    assert(
      volume && (volume.Lats?.d || 0) > 0,
      "completed volume counts the set under Lats",
      JSON.stringify(volume)
    );
    assert(
      volume && !(volume.Quads?.d > 0),
      "completed volume does not credit the slot's original quads",
      JSON.stringify(volume)
    );

    // A row written before the snapshot existed keeps reading its template.
    const legacy = await page.evaluate(() =>
      window.__repforgeRowMuscles({ name: "Old row", primary: "Quads", secondary: "Glutes" }));
    assert(
      legacy.primary === "Quads",
      "rows without a performed snapshot still use their template muscles",
      JSON.stringify(legacy)
    );
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nperformed attribution: ${results.passed} passed, ${results.failed} failed`);
  if (results.failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
