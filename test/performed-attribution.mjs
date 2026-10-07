#!/usr/bin/env node
import { exerciseAction, finishEarly } from "./fixtures/focus-workout.mjs";
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
import { installSeedProgram } from "./fixtures/seed-program.mjs";

const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";

const results = { passed: 0, failed: 0 };
// Catalog movements the swap and the permanent replacement choose by name.
const LAT = { id: "1a15c6f170d8800d8fc9d2c235673bf6", name: "Overhand grip cable lat pulldown" };
const FLY = { id: "1a05c6f170d880df946bdd6f42f0901c", name: "Horizontal cable fly" };
function assert(cond, name, detail) {
  if (cond) { results.passed++; console.log(`  ✓ ${name}`); }
  else { results.failed++; console.log(`  ✗ ${name}`); if (detail != null) console.log(`    ${detail}`); }
}

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
    // A cleared device has no program; this walk needs one to attribute against.
    await installSeedProgram(page, { key: KEY, waitFor: waitForApp });

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
      { session: "lat-history", date: "2026-08-02", day: slot.day, name: LAT.name,
        exerciseId: "old-lat-slot", set: 1, load: 60, reps: 8, rir: 2, created: "2026-08-02T10:00:00.000Z",
        primary: "Lats", secondary: "Mid/upper back,Biceps", performedName: LAT.name,
        performedLibraryId: LAT.id, performedPrimary: "Lats", performedSecondary: "Mid/upper back,Biceps" },
    ];
    await writeState(page, state);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);

    await page.evaluate(() => document.querySelector('nav button[data-view="log"]')?.click());
    await settle(page);
    await page.evaluate(() => window.__repforgeEnterWorkout?.({}));
    await page.waitForSelector("#workout .exercise", { timeout: 5000 });
    await settle(page, 150);
    const beforeSwap = await page.evaluate((id) => ({
      prev: [...document.querySelectorAll(`.exercise[data-ex="${id}"] .ledgerline__prev`)].map((line) => line.textContent).join(" "),
      name: document.querySelector(`.exercise[data-ex="${id}"] .focus-ex__name`)?.textContent || "",
    }), slot.id);
    assert(beforeSwap.prev.includes("200"), "the slot initially reads the quad movement's own history", JSON.stringify(beforeSwap));

    // Swap it to a lat movement for this session.
    await exerciseAction(page, slot.id, "#exActionSubstBtn");
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    const swapped = await pickExact(page, LAT.name);
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    assert(swapped, "swapped the quad slot to a lat pulldown");
    const swappedUi = await page.evaluate((id) => ({
      prev: [...document.querySelectorAll(`.exercise[data-ex="${id}"] .ledgerline__prev`)].map((line) => line.textContent).join(" "),
      name: document.querySelector(`.exercise[data-ex="${id}"] .focus-ex__name`)?.textContent || "",
      rec: document.querySelector(`.exercise[data-ex="${id}"] .fx-cue`)?.textContent || "",
    }), slot.id);
    // The D card header names the movement and its programme line; the muscle is recorded on the row (checked below).
    assert(swappedUi.name.includes(LAT.name),
      "the swapped card shows the performed movement", JSON.stringify(swappedUi));
    assert(swappedUi.prev.includes("60") && !swappedUi.prev.includes("200"),
      "previous sets and recommendations switch to the performed movement", JSON.stringify(swappedUi));
    assert(swappedUi.rec.trim() && !swappedUi.rec.includes("200"), "the quad load cannot leak into the pulldown recommendation", swappedUi.rec);

    const volumeBefore = await page.evaluate(() => window.__repforgeCompletedVolume?.());

    // Log the first set through the focus shelf's metric fields, then save it.
    const WEIGHT = "2555c6f170d8805cafa6d16d3fdddbaa";
    const REPS = "2555c6f170d88072bbf6d9ad3f16ea86";
    const shelfField = async (input, field) => {
      await input.waitFor({ state: "attached", timeout: 5000 });
      if (await input.getAttribute("aria-hidden") === "true")
        await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="${field}"]`).click();
      await input.waitFor({ state: "visible", timeout: 5000 });
    };
    for (const [metricId, value] of [[WEIGHT, 60], [REPS, 10]]) {
      const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
      await shelfField(input, `metric_${metricId}`);
      await input.fill(String(value));
      await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    }
    const rir = page.locator(`#workout .exercise.is-current .focus-shelf input[data-k="${slot.id}_1_rir"]`);
    await shelfField(rir, "rir");
    await rir.fill("2");
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    await page.locator(`#workout .exercise.is-current [data-save="${slot.id}_1"]`).click();
    await page.waitForFunction((id) => {
      const exercise = window.__repforgeWorkoutDraft.current()?.exercises?.[id];
      return !!exercise?.sets?.[exercise.setOrder[0]]?.completion;
    }, slot.id, { timeout: 15000 });
    // The substitution journey intentionally logs only this slot. Persist that
    // partial session through the user-visible early-finish confirmation rather
    // than treating a normal form submit as a completion shortcut.
    await finishEarly(page);
    await page.waitForSelector("#sessionSummary:not(.hidden)");
    await page.evaluate(() => window.__repforgeSessionSummary.close());
    await page.waitForSelector("#sessionSummary", { state: "hidden" });

    state = await getState(page);
    const row = state.log.find((r) => r.exerciseId === slot.id && +r.load === 60);
    assert(!!row, "the swapped set was saved", JSON.stringify(state.log.slice(-2)));
    assert(
      row && row.exerciseId === slot.id,
      "the structural slot id is unchanged for draft continuity",
      `${row?.exerciseId} vs ${slot.id}`
    );
    assert(
      row && row.performedLibraryId === LAT.id && row.performedName === LAT.name,
      "the row records which movement was actually performed",
      JSON.stringify(row)
    );
    assert(
      row && String(row.performedPrimary).split(",").includes("Lats") && !/quad/i.test(row.performedPrimary),
      "the row records the performed movement's muscles",
      JSON.stringify([row?.performedPrimary, row?.performedSecondary])
    );

    // The point of all of it: the audit credits lats, not quads.
    const attributed = await page.evaluate((rowIn) => window.__repforgeRowMuscles(rowIn), row);
    assert(
      String(attributed.primary).split(",").includes("Lats") && !/quad/i.test(attributed.primary),
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

    const split = await page.evaluate(({ original, lat: latMovement }) => {
      const hack = window.__repforgeCapacity.sessionsFor(original).map((s) => s.top);
      const lat = window.__repforgeCapacity.sessionsFor({ ...original, name: latMovement.name, libraryId: latMovement.id }).map((s) => s.top);
      const dashboard = window.__repforgeStrengthDashboard?.() || [];
      return { hack, lat, names: dashboard.map((r) => r.exercise) };
    }, { original: slot, lat: LAT });
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
    await page.waitForSelector('#programEditor [data-role="editor"]');
    await page.click(`[data-role="replace"][data-id="${slot.id}"]`);
    await page.waitForSelector("#exPickSheet.is-open .pickrow", { timeout: 5000 });
    await pickExact(page, FLY.name);
    await page.waitForSelector("#exPickSheet", { state: "hidden", timeout: 5000 });
    await settle(page);
    await page.click("#programEditToggle");
    await page.waitForFunction(({ key, id, fly }) => {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      return document.querySelector("#programEditorWrap")?.classList.contains("is-hidden") &&
        saved.program?.find((exercise) => exercise.id === id)?.libraryId === fly;
    }, { key: KEY, id: slot.id, fly: FLY.id });
    state = await getState(page);
    const replacement = state.program.find((e) => e.id === slot.id);
    const permanent = await page.evaluate((ex) => ({
      status: window.__repforgeRecommendation(ex).status,
      load: window.__repforgeRecommendation(ex).load,
      names: (window.__repforgeStrengthDashboard?.() || []).map((r) => r.exercise),
    }), replacement);
    assert(replacement?.libraryId === FLY.id, "the permanent replacement keeps the slot but changes movement identity", JSON.stringify(replacement));
    assert(permanent.status !== "recommended" && permanent.load == null,
      "the replacement gets no recommendation from the old slot history", JSON.stringify(permanent));
    assert(permanent.names.includes(slot.name) && permanent.names.includes(LAT.name) && !permanent.names.includes(FLY.name),
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
