#!/usr/bin/env node
/**
 * A mid-session swap must move the work with it.
 *
 * Swapping a quad slot to a lat movement used to save the slot's muscles and
 * only a performedName string, so the volume audit credited quads for a set of
 * pulldowns. The row now carries a performed snapshot, and every muscle-level
 * reader prefers it. The template slot id still anchors draft fields, while an
 * immutable movement identity keeps recommendations and history from crossing.
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
async function writeState(page, snapshot) {
  await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("repforge", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onsuccess = () => res(req.result);req.onerror = () => rej(req.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");tx.objectStore("kv").put(value, key);
      tx.oncomplete = () => res();tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { key: KEY, value: snapshot });
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

    // Deliberately different histories expose any accidental slot-id join: the
    // quad movement used 200 kg, while pulldowns used 60 kg.
    state.log = [
      { session: "hack-history", date: "2026-08-01", day: slot.day, name: slot.name,
        exerciseId: slot.id, set: 1, load: 200, reps: 6, rir: 2, created: "2026-08-01T10:00:00.000Z",
        primary: slot.primary, secondary: slot.secondary, performedName: slot.name,
        performedMovementId: slot.movementId, performedPrimary: slot.primary, performedSecondary: slot.secondary },
      { session: "lat-history", date: "2026-08-02", day: slot.day, name: "Lat pulldown",
        exerciseId: "old-lat-slot", set: 1, load: 60, reps: 8, rir: 2, created: "2026-08-02T10:00:00.000Z",
        primary: "Lats", secondary: "Mid/upper back,Biceps", performedName: "Lat pulldown",
        performedLibraryId: "pd_mc", performedPrimary: "Lats", performedSecondary: "Mid/upper back,Biceps" },
    ];
    await writeState(page, state);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);

    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await settle(page);
    await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
    await page.waitForSelector("#workout .exercise", { timeout: 5000 });
    await page.evaluate((id) => {
      const art = document.querySelector(`.exercise[data-ex="${id}"]`);
      if (art?.classList.contains("is-collapsed")) document.querySelector(`.ex__caret[data-collapse="${id}"]`)?.click();
    }, slot.id);
    await settle(page, 150);
    const beforeSwap = await page.evaluate((id) => ({
      prev: document.querySelector(`.exercise[data-ex="${id}"] .prev`)?.textContent || "",
      meta: document.querySelector(`.exercise[data-ex="${id}"] .ex__meta`)?.textContent || "",
    }), slot.id);
    assert(beforeSwap.prev.includes("200"), "the slot initially reads the quad movement's own history", JSON.stringify(beforeSwap));

    // Swap it to a lat movement for this session.
    await page.click(`.subst__pick[data-sub="${slot.id}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const swapped = await pickExact(page, "Lat pulldown");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    assert(swapped, "swapped the quad slot to Lat pulldown");
    const swappedUi = await page.evaluate((id) => ({
      prev: document.querySelector(`.exercise[data-ex="${id}"] .prev`)?.textContent || "",
      meta: document.querySelector(`.exercise[data-ex="${id}"] .ex__meta`)?.textContent || "",
      rec: document.querySelector(`.exercise[data-ex="${id}"] .recblock`)?.textContent || "",
    }), slot.id);
    assert(/Lats/i.test(swappedUi.meta) && !/Quads/i.test(swappedUi.meta),
      "the swapped card shows the performed movement's muscle", JSON.stringify(swappedUi));
    assert(swappedUi.prev.includes("60") && !swappedUi.prev.includes("200"),
      "previous sets and recommendations switch to the performed movement", JSON.stringify(swappedUi));
    assert(!swappedUi.rec.includes("200"), "the quad load cannot leak into the pulldown recommendation", swappedUi.rec);

    const volumeBefore = await page.evaluate(() => window.__repforgeCompletedVolume?.());

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
      "the structural slot id is unchanged for draft continuity",
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
      volume && (volume.Lats?.d || 0) > (volumeBefore?.Lats?.d || 0),
      "completed volume adds the set under Lats",
      JSON.stringify(volume)
    );
    assert(
      volume && (volume.Quads?.d || 0) === (volumeBefore?.Quads?.d || 0),
      "completed volume does not add work to the slot's original quads",
      JSON.stringify(volume)
    );

    const split = await page.evaluate((original) => {
      const hack = window.__repforgeCapacity.sessionsFor(original).map((s) => s.top);
      const lat = window.__repforgeCapacity.sessionsFor({ ...original, name: "Lat pulldown", libraryId: "pd_mc" }).map((s) => s.top);
      const dashboard = window.__repforgeStrengthDashboard?.() || [];
      return { hack, lat, names: dashboard.map((r) => r.exercise) };
    }, slot);
    assert(split.hack.includes(200) && !split.hack.includes(60),
      "quad analytics exclude pulldown sets", JSON.stringify(split));
    assert(split.lat.filter((x) => x === 60).length >= 2 && !split.lat.includes(200),
      "pulldown analytics include both pulldown sessions only", JSON.stringify(split));

    // A permanent replacement reuses the structural slot too, but starts a new
    // movement history and leaves the old labels untouched.
    await page.evaluate(() => document.querySelector('nav button[data-view="program"]')?.click());
    await settle(page);
    await page.evaluate(() => {
      if (document.querySelector("#programEditorWrap")?.classList.contains("is-hidden"))
        document.querySelector("#programEditToggle")?.click();
    });
    await page.click(`[data-act="changeEx"][data-id="${slot.id}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await pickExact(page, "Cable fly");
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    state = await getState(page);
    const replacement = state.program.find((e) => e.id === slot.id);
    const permanent = await page.evaluate((ex) => ({
      status: window.__repforgeRecommendation(ex).status,
      names: (window.__repforgeStrengthDashboard?.() || []).map((r) => r.exercise),
    }), replacement);
    assert(replacement?.libraryId === "ci_cb", "the permanent replacement keeps the slot but changes movement identity", JSON.stringify(replacement));
    assert(permanent.status === "new", "the replacement gets no recommendation from the old slot history", JSON.stringify(permanent));
    assert(permanent.names.includes(slot.name) && permanent.names.includes("Lat pulldown") && !permanent.names.includes("Cable fly"),
      "historical analytics retain the movements actually performed", JSON.stringify(permanent.names));

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
