#!/usr/bin/env node
/**
 * Capture the committed UI screen catalog under docs/ui-screens/.
 *
 * Designers and agents use those PNGs as the visual source of truth for every
 * primary surface in both Appearance themes. Re-run this whenever a UI change
 * lands so the folder stays current:
 *
 *   python3 -m http.server 8000
 *   (cd test && npm ci && npx playwright install chromium --with-deps)  # once
 *   node tools/capture-ui-screens.mjs
 *
 * Requires the pinned test Chromium under test/ and a static server on
 * REPFORGE_URL (default http://localhost:8000/). Appearance must be present —
 * dark captures call window.__repforgeUi.setTheme.
 */
import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChromium } from "../test/browser.mjs";
import { MINIMAL_PAYLOAD, BUILT_IN_IDS } from "../test/fixtures/shared-setup.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "ui-screens");
const BASE = process.env.REPFORGE_URL || "http://localhost:8000/";
const KEY = "repforge_v1";
const DRAFT = "repforge_draft_v1";
const UIKEY = "repforge_ui_v1";
const VIEWPORT = { width: 390, height: 844 };
const THEMES = ["light", "dark"];

const LABELS = {
  "01-today": "Today — ready to start",
  "02-today-day-picker": "Today — choose another day sheet",
  "03-workout-list": "Workout — list mode",
  "04-workout-focus": "Workout — focus mode",
  "05-rest-timer": "Rest timer sheet",
  "06-exercise-note": "Exercise note sheet",
  "07-exercise-detail": "Exercise detail (illustrated)",
  "08-progress-overview": "Progress — overview",
  "09-progress-exercise-chart": "Progress — exercise strength chart",
  "10-progress-strength": "Progress — Strength",
  "11-progress-volume": "Progress — Volume",
  "12-progress-prs": "Progress — PRs",
  "13-progress-review": "Progress — Review",
  "14-history": "History",
  "15-history-session": "History — expanded session",
  "16-library": "Exercise library",
  "17-exercise-preview": "Exercise preview (illustrated)",
  "18-program": "Program",
  "19-share-setup": "Share setup link sheet",
  "20-program-text": "Program text export sheet",
  "21-settings": "Settings",
  "22-settings-appearance": "Settings — Appearance row",
  "34-settings-privacy": "Settings — privacy and analytics",
  "23-exercise-picker": "Exercise picker sheet",
  "24-custom-exercise": "Custom exercise sheet",
  "25-session-summary": "Session summary",
  "26-today-done": "Today — session complete",
  "27-tour": "Feature tour",
  "28-first-run": "First-run gate",
  "29-onboarding": "Create-program onboarding",
  "30-shared-setup-gate": "Shared setup confirmation gate",
  "31-install-banner": "Install banner",
  "32-ios-install-sheet": "iOS install instruction sheet",
  "33-why-this-weight": "Why this weight sheet",
  "35-program-progression-editor": "Program — progression editor",
};

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function catalogState() {
  const program = [
    { id: "ex-sq", day: "Day 1", order: 1, name: "Barbell back squat", sets: 3, min: 4, max: 8, primary: "Quads", secondary: "Glutes,Hamstrings", notes: "", alternates: [], libraryId: "sq_bb",
      progression: { schemaVersion: 1, strategy: { id: "rep_goal", version: 1, params: {
        workingSets: 3, repGoal: 18, repFloor: 4, repCeiling: 8,
        targetRirMin: 1, targetRirMax: 3, minLoadIncrement: 2.5,
        jumpPercent: 2.5, distributionPolicy: "balanced_frontload_v1",
      } }, modifiers: [] } },
    { id: "ex-curl", day: "Day 1", order: 2, name: "Seated leg curl", sets: 2, min: 6, max: 10, primary: "Hamstrings", secondary: "", notes: "", alternates: [] },
    { id: "ex-bench", day: "Day 1", order: 3, name: "Barbell bench press", sets: 3, min: 4, max: 8, primary: "Chest", secondary: "Triceps,Front delts", notes: "Pause on the chest.", alternates: [], libraryId: "pr_bb" },
    { id: "ex-row", day: "Day 1", order: 4, name: "Chest-supported row", sets: 2, min: 6, max: 10, primary: "Mid/upper back", secondary: "Lats,Rear delts,Biceps", notes: "", alternates: [] },
    { id: "ex-lat", day: "Day 1", order: 5, name: "Machine lateral raise", sets: 2, min: 8, max: 12, primary: "Side delts", secondary: "", notes: "", alternates: [] },
    { id: "ex-pd", day: "Day 2", order: 1, name: "Assisted pull-up", sets: 3, min: 4, max: 8, primary: "Lats", secondary: "Biceps,Forearms", notes: "", alternates: [], libraryId: "pd_bw" },
    { id: "ex-rdl", day: "Day 2", order: 2, name: "Barbell deadlift", sets: 2, min: 3, max: 6, primary: "Hamstrings,Glutes", secondary: "Spinal erectors", notes: "", alternates: [], libraryId: "dl_bb" },
    { id: "ex-ohp", day: "Day 2", order: 3, name: "Machine shoulder press", sets: 2, min: 6, max: 10, primary: "Front delts", secondary: "Side delts,Triceps", notes: "", alternates: [] },
    { id: "ex-curl2", day: "Day 2", order: 4, name: "Barbell curl", sets: 2, min: 8, max: 12, primary: "Biceps", secondary: "Forearms", notes: "", alternates: [], libraryId: "cu_bb" },
    { id: "ex-ext", day: "Day 3", order: 1, name: "Leg extension", sets: 2, min: 8, max: 12, primary: "Quads", secondary: "", notes: "", alternates: [] },
    { id: "ex-fly", day: "Day 3", order: 2, name: "Pec deck", sets: 2, min: 8, max: 12, primary: "Chest", secondary: "", notes: "", alternates: [] },
    { id: "ex-press", day: "Day 3", order: 3, name: "Cable pressdown", sets: 2, min: 8, max: 12, primary: "Triceps", secondary: "", notes: "", alternates: [] },
  ];
  const log = [];
  const pushSession = (day, date, loads) => {
    const session = `${date}_${day}_catalog`;
    program.filter((e) => e.day === day).forEach((ex, i) => {
      const load = loads[i] ?? 60;
      for (let set = 1; set <= Math.min(ex.sets, 2); set++) {
        log.push({
          session, date, day, name: ex.name, exerciseId: ex.id, set,
          load, reps: ex.min + 2, rir: 1, notes: "", created: `${date}T12:00:00.000Z`,
          primary: ex.primary, secondary: ex.secondary,
          performedLibraryId: ex.libraryId || undefined,
        });
      }
    });
  };
  pushSession("Day 1", isoDaysAgo(10), [100, 45, 70, 55, 12]);
  pushSession("Day 2", isoDaysAgo(8), [40, 120, 40, 30]);
  pushSession("Day 3", isoDaysAgo(6), [50, 40, 35]);
  pushSession("Day 1", isoDaysAgo(3), [105, 47.5, 72.5, 57.5, 12.5]);
  pushSession("Day 2", isoDaysAgo(1), [42.5, 125, 42.5, 32.5]);

  return {
    settings: {
      jumpPct: 2.5, minJump: 2.5, rirHigh: 2, hardRir: 4, restSec: 120, lastExport: "",
      unit: "kg", lang: "en", rirMode: "numeric", voiceInputEnabled: false,
      notify: { enabled: false, timer: true, session: true, unfinished: true, missed: true },
    },
    programMeta: {
      id: "catalog-program", name: "Designer catalog", started: isoDaysAgo(21),
      created: "2026-07-01T00:00:00.000Z", updated: "2026-08-01T00:00:00.000Z",
      onboarded: true, mesocycleStatus: "active", mesocycleLengthWeeks: 6,
      goal: "hypertrophy", experience: "intermediate", daysPerWeek: 3,
      splitType: "full_body", equipment: ["barbell", "machines", "cables"],
      priorityMuscles: ["Quads", "Chest"], sessionLength: "60", completedAt: null,
    },
    program, log, programHistory: [], customExercises: [], _storageRevision: 40,
  };
}

function emptyFirstRunState() {
  return {
    settings: catalogState().settings,
    programMeta: {
      id: "", name: "", started: null, created: null, updated: null, onboarded: false,
      mesocycleStatus: "active", mesocycleLengthWeeks: 6, goal: null, experience: null,
      daysPerWeek: null, splitType: null, equipment: [], priorityMuscles: [],
      sessionLength: null, completedAt: null,
    },
    program: [], log: [], programHistory: [], customExercises: [], _storageRevision: 0,
  };
}

const sleep = (page, ms = 350) => page.waitForTimeout(ms);

async function waitForApp(page) {
  await page.waitForFunction(
    () => typeof window.__repforgeStorage?.flush === "function" && typeof window.__repforgeUi?.setTheme === "function",
    { timeout: 20000 }
  );
}

async function clearAndSeed(page, state) {
  await page.evaluate(async ({ k, d, ui, blob }) => {
    localStorage.removeItem(k);
    localStorage.removeItem(d);
    localStorage.removeItem(ui);
    await new Promise((res) => {
      const req = indexedDB.deleteDatabase("repforge");
      req.onsuccess = () => res();
      req.onerror = () => res();
      req.onblocked = () => res();
    });
    localStorage.setItem(k, JSON.stringify(blob));
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("repforge", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(blob, k);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { k: KEY, d: DRAFT, ui: UIKEY, blob: state });
}

async function dismissChrome(page) {
  await page.evaluate(() => {
    window.closeFirstRun?.();
    const onb = document.querySelector("#onboarding");
    if (onb?.classList.contains("active")) window.closeOnboarding?.();
    const tour = document.querySelector("#tour");
    if (tour && !tour.classList.contains("hidden")) window.closeTour?.();
    document.querySelector(".installbanner")?.classList.add("hidden");
  });
}

/**
 * A catalog frame has to show a surface at rest. Entrances that are still
 * running paint half-opacity controls over the copy behind them, which a
 * designer reads as a colour decision rather than as a frame taken early — the
 * session summary staggers seventeen blocks and is the worst of them. Looping
 * animations (the rest bar's breathing ring) never finish and are left alone.
 */
async function settle(page) {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) continue;
      try { animation.finish(); } catch {}
    }
  });
}

async function shot(page, theme, name) {
  mkdirSync(join(OUT, theme), { recursive: true });
  await settle(page);
  await page.screenshot({ path: join(OUT, theme, `${name}.png`), fullPage: false });
  console.log(`  ✓ ${theme}/${name}.png`);
}

async function applyTheme(page, theme) {
  await page.evaluate((t) => window.__repforgeUi.setTheme(t), theme);
  await sleep(page, 200);
}

async function closeSheets(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => {
    for (const id of [
      "dayPickCancel", "exNoteCancel", "restSheetClose", "shareSetupClose",
      "programTextClose", "exPickCancel", "exCustomCancel", "sumDone", "whyClose",
    ]) document.querySelector("#" + id)?.click();
    window.closeTour?.();
  });
  await sleep(page, 250);
}

async function openSeeded(browser, state, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await clearAndSeed(page, state);
  await page.evaluate(({ ui, theme: t }) => {
    localStorage.setItem(ui, JSON.stringify({ theme: t }));
  }, { ui: UIKEY, theme });
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await applyTheme(page, theme);
  await dismissChrome(page);
  await sleep(page, 400);
  return { context, page };
}

async function visible(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    if (el.hidden) return false;
    if (el.classList.contains("hidden")) return false;
    return true;
  }, sel);
}

async function captureMain(browser, theme) {
  const { context, page } = await openSeeded(browser, catalogState(), theme);
  const tryShot = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`  ✗ ${theme}/${name}: ${err.message.split("\n")[0]}`);
      await closeSheets(page);
    }
  };
  try {
    await shot(page, theme, "01-today");

    await tryShot("02-today-day-picker", async () => {
      await page.click("#chooseAnotherDay");
      await page.waitForSelector("#dayPickSheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "02-today-day-picker");
      await page.click("#dayPickCancel");
      await sleep(page, 350);
    });

    await page.evaluate(() => window.__repforgeEnterWorkout({ focus: false }));
    await sleep(page, 500);
    await shot(page, theme, "03-workout-list");

    await tryShot("33-why-this-weight", async () => {
      // The recommendation's arithmetic, opened from a Log card. The sheet is
      // parked off-screen until is-open lands, so wait for the class too.
      await page.click("#workout [data-why]");
      await page.waitForSelector("#whySheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "33-why-this-weight");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#whySheet")?.hidden === true, null, { timeout: 5000 });
      await sleep(page, 200);
    });

    await tryShot("04-workout-focus", async () => {
      await page.click("#woOverflowBtn");
      await sleep(page, 200);
      await page.click("#modeFocus");
      await sleep(page, 500);
      await shot(page, theme, "04-workout-focus");
    });

    await tryShot("06-exercise-note", async () => {
      // Note sheet is opened from the focus-mode note chip.
      const focusOn = await page.evaluate(() => document.querySelector("#modeFocus")?.classList.contains("active") || !!document.querySelector("#workout .focus-well"));
      if (!focusOn) {
        await page.click("#woOverflowBtn");
        await sleep(page, 200);
        await page.click("#modeFocus");
        await sleep(page, 400);
      }
      await page.locator("#workout [data-exnote-open]").first().click({ timeout: 5000 });
      await page.waitForSelector("#exNoteSheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "06-exercise-note");
      await page.click("#exNoteCancel");
      await sleep(page, 300);
    });

    await tryShot("05-rest-timer", async () => {
      const focusOn = await page.evaluate(() => !!document.querySelector("#workout .focus-well"));
      if (!focusOn) {
        await page.click("#woOverflowBtn");
        await sleep(page, 200);
        await page.click("#modeFocus");
        await sleep(page, 400);
      }
      await page.evaluate(() => {
        const card = document.querySelector("#workout .exercise.is-current") || document.querySelector("#workout .exercise");
        card?.querySelectorAll("input").forEach((el) => {
          const k = el.dataset.k || "";
          if (k.endsWith("_load")) el.value = "100";
          else if (k.endsWith("_reps")) el.value = "6";
          else if (k.endsWith("_rir")) el.value = "1";
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
        card?.querySelector(".focus-well .btn--cta, .saveset")?.click();
      });
      await sleep(page, 600);
      await page.waitForFunction(() => document.querySelector("#woRest")?.classList.contains("is-running"), { timeout: 5000 });
      await page.click("#woRest");
      await page.waitForSelector("#restSheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "05-rest-timer");
      // The timer outlives the sheet on purpose, and its floating bar is drawn
      // over whatever comes next. End it from the sheet that started it, or
      // every later frame carries a countdown from a set the catalog stopped
      // showing screens ago.
      await page.click("#restStop");
      // The bar is hidden by class, so wait on the class rather than on
      // visibility: a hidden element is never "visible" for waitForSelector.
      await page.waitForFunction(
        () => document.querySelector("#restBar")?.classList.contains("hidden") === true,
        { timeout: 5000 }
      );
      await page.evaluate(() => {
        if (!document.querySelector("#restSheet")?.classList.contains("hidden")) {
          document.querySelector("#restSheetClose")?.click();
        }
      });
      await sleep(page, 350);
    });

    await tryShot("06-list-mode", async () => {
      await page.click("#woOverflowBtn");
      await sleep(page, 200);
      await page.click("#modeFull");
      await sleep(page, 300);
    });

    await tryShot("07-exercise-detail", async () => {
      await page.locator('#workout [data-exopen="ex-sq"]').click({ timeout: 5000 });
      await sleep(page, 600);
      await shot(page, theme, "07-exercise-detail");
      await page.click("#exBack");
      await sleep(page, 400);
    });

    await page.evaluate(() => {
      if (!document.querySelector("#workoutShell")?.classList.contains("hidden")) {
        document.querySelector("#leaveWorkout")?.click();
      }
    });
    await sleep(page, 300);

    await page.click('nav [data-view="stats"]');
    await sleep(page, 500);
    await shot(page, theme, "08-progress-overview");

    await tryShot("09-progress-exercise-chart", async () => {
      await page.evaluate(() => {
        const sel = document.querySelector("#statExercise");
        if (!sel) return;
        const opt = [...sel.options].find((o) => /Barbell back squat/i.test(o.textContent));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      // The card sits below the fold of the overview this catalog already has a
      // frame for. Picking a lift without scrolling to its chart photographed
      // screen 08 twice, so bring the card into view and wait for the canvas to
      // carry pixels before the shutter.
      await page.evaluate(() => document.querySelector(".chartcard")?.scrollIntoView({ block: "center" }));
      await page.waitForFunction(() => {
        const c = document.querySelector("#chart");
        if (!c || !c.width) return false;
        const box = c.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= window.innerHeight;
      }, { timeout: 5000 });
      await sleep(page, 500);
      await shot(page, theme, "09-progress-exercise-chart");
      await page.evaluate(() => window.scrollTo({ top: 0 }));
      await sleep(page, 300);
    });

    for (const [seg, name] of [
      ["strength", "10-progress-strength"],
      ["volume", "11-progress-volume"],
      ["prs", "12-progress-prs"],
      ["review", "13-progress-review"],
    ]) {
      await tryShot(name, async () => {
        await page.click(`#statsSeg [data-seg="${seg}"]`);
        await sleep(page, 400);
        await shot(page, theme, name);
      });
    }

    await page.click('nav [data-view="history"]');
    await sleep(page, 500);
    await shot(page, theme, "14-history");

    await tryShot("15-history-session", async () => {
      await page.locator("#sessions .session__open").first().click({ timeout: 5000 });
      await page.waitForSelector(".session--edit", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "15-history-session");
      await page.evaluate(() => document.querySelector("[data-edcancel]")?.click());
      await sleep(page, 300);
    });

    await tryShot("16-library", async () => {
      await page.evaluate(() => window.__repforgeOpenLibrary({}));
      await sleep(page, 600);
      await shot(page, theme, "16-library");
    });

    await tryShot("17-exercise-preview", async () => {
      if (!(await page.evaluate(() => document.body.classList.contains("is-library")))) {
        await page.evaluate(() => window.__repforgeOpenLibrary({}));
        await sleep(page, 500);
      }
      const preview = page.locator('#libList [data-lib-preview="sq_bb"]');
      if (await preview.count()) await preview.click();
      else {
        await page.evaluate(() => {
          const q = document.querySelector("#libSearch, #library input");
          if (q) {
            q.value = "Barbell back squat";
            q.dispatchEvent(new Event("input", { bubbles: true }));
          }
        });
        await sleep(page, 300);
        await page.locator("#libList [data-lib-preview]").first().click();
      }
      await sleep(page, 500);
      await shot(page, theme, "17-exercise-preview");
      await page.click("#previewBack");
      await sleep(page, 300);
    });

    // Leave the library shell so the dock is visible again.
    await page.evaluate(() => {
      if (document.body.classList.contains("is-preview")) document.querySelector("#previewBack")?.click();
    });
    await sleep(page, 200);
    await page.evaluate(() => {
      if (document.body.classList.contains("is-library")) document.querySelector("#libBack")?.click();
    });
    await sleep(page, 400);

    await page.click('nav [data-view="program"]');
    await sleep(page, 500);
    await shot(page, theme, "18-program");

    await tryShot("35-program-progression-editor", async () => {
      await page.click("#programEditToggle");
      const editor = page.locator('[data-progression-editor="ex-sq"]');
      await editor.locator("summary").click();
      await editor.scrollIntoViewIfNeeded();
      await sleep(page, 400);
      await shot(page, theme, "35-program-progression-editor");
      await page.click("#programEditToggle");
      await sleep(page, 300);
    });

    await tryShot("19-share-setup", async () => {
      await page.click("#shareProgramSetup");
      await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 8000 });
      await sleep(page, 500);
      await shot(page, theme, "19-share-setup");
      await page.click("#shareSetupClose");
      await sleep(page, 300);
    });

    await tryShot("20-program-text", async () => {
      await page.click("#exportProgramText");
      await page.waitForSelector("#programTextSheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "20-program-text");
      await page.click("#programTextClose");
      await sleep(page, 300);
    });

    await tryShot("21-settings", async () => {
      await page.evaluate(() => window.__repforgeShowSettings());
      await sleep(page, 500);
      await shot(page, theme, "21-settings");
      await page.evaluate(() => document.querySelector("#theme")?.closest("label, .settings-row")?.scrollIntoView({ block: "center" }));
      await sleep(page, 200);
      await shot(page, theme, "22-settings-appearance");
      await page.evaluate(() => document.querySelector("#telemetryToggle")?.closest(".settings-group")?.scrollIntoView({ block: "center" }));
      await sleep(page, 200);
      await shot(page, theme, "34-settings-privacy");
      await page.click("#settingsBack");
      await sleep(page, 300);
    });

    await tryShot("23-exercise-picker", async () => {
      await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "multi" }));
      await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
      await sleep(page, 500);
      await shot(page, theme, "23-exercise-picker");
    });

    await tryShot("24-custom-exercise", async () => {
      if (!(await visible(page, "#exPickSheet.is-open"))) {
        await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "single" }));
        await page.waitForSelector("#exPickSheet.is-open", { timeout: 5000 });
      }
      await page.getByRole("button", { name: /Create custom exercise/i }).click({ timeout: 5000 });
      await page.waitForSelector("#exCustomSheet.is-open", { timeout: 5000 });
      await sleep(page, 400);
      await shot(page, theme, "24-custom-exercise");
      await page.click("#exCustomCancel");
      await sleep(page, 300);
    });
    await closeSheets(page);

    await tryShot("25-session-summary", async () => {
      await page.evaluate(() => window.__repforgeEnterWorkout({ focus: true, day: "Day 1" }));
      await sleep(page, 500);
      await page.evaluate(() => {
        document.querySelectorAll('#workout [data-k$="_1_load"]').forEach((el, i) => {
          el.value = String(80 + i * 5);
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
        document.querySelectorAll('#workout [data-k$="_1_reps"]').forEach((el) => {
          el.value = "6";
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
        document.querySelectorAll('#workout [data-k$="_1_rir"]').forEach((el) => {
          el.value = "1";
          el.dispatchEvent(new Event("input", { bubbles: true }));
        });
      });
      await page.evaluate(async () => { await window.__repforgeSaveWorkout(); });
      await page.waitForFunction(() => {
        const el = document.querySelector("#sessionSummary");
        return el && !el.hidden && !el.classList.contains("hidden");
      }, { timeout: 10000 });
      await sleep(page, 900);
      await shot(page, theme, "25-session-summary");
      await page.click("#sumDone");
      await sleep(page, 500);
    });

    await tryShot("26-today-done", async () => {
      await page.evaluate(() => {
        document.querySelector('nav [data-view="log"]')?.click();
        // Settings / workout shells hide the dock; force Today if needed.
        if (document.body.classList.contains("is-settings")) document.querySelector("#settingsBack")?.click();
      });
      await sleep(page, 500);
      await shot(page, theme, "26-today-done");
    });

    await tryShot("27-tour", async () => {
      await page.evaluate(() => window.__repforgeUi.startTour("settings"));
      await sleep(page, 500);
      const open = await page.evaluate(() => {
        const t = document.querySelector("#tour");
        return t && !t.classList.contains("hidden");
      });
      if (!open) throw new Error("tour did not open");
      await shot(page, theme, "27-tour");
      await page.evaluate(() => window.closeTour?.());
    });
  } finally {
    await context.close();
  }
}

async function captureFirstRun(browser, theme) {
  const { context, page } = await openSeeded(browser, emptyFirstRunState(), theme);
  try {
    await page.evaluate(() => window.openFirstRun());
    await sleep(page, 500);
    await shot(page, theme, "28-first-run");

    await page.click("#firstRunCreate");
    await sleep(page, 700);
    if (await page.evaluate(() => document.querySelector("#onboarding")?.classList.contains("active"))) {
      await shot(page, theme, "29-onboarding");
    }
  } finally {
    await context.close();
  }
}

async function captureSharedSetup(browser, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearAndSeed(page, emptyFirstRunState());
    await page.evaluate(({ ui, theme: t }) => {
      localStorage.setItem(ui, JSON.stringify({ theme: t }));
    }, { ui: UIKEY, theme });

    const fragment = await page.evaluate(async ({ payload, ids }) => {
      const encoded = await window.RepForgeSharedSetup.encode(payload, { builtInIds: ids });
      if (!encoded?.ok) throw new Error("encode failed: " + (encoded?.code || "unknown"));
      return encoded.value;
    }, { payload: MINIMAL_PAYLOAD, ids: [...BUILT_IN_IDS] });

    await page.goto(`${BASE.replace(/\/?$/, "/")}index.html#setup=${fragment}`, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await applyTheme(page, theme);
    await sleep(page, 800);
    await shot(page, theme, "30-shared-setup-gate");
  } finally {
    await context.close();
  }
}

async function captureInstall(browser, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: theme === "dark" ? "dark" : "light",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await clearAndSeed(page, catalogState());
    await page.evaluate(({ ui, theme: t }) => {
      localStorage.setItem(ui, JSON.stringify({ theme: t }));
    }, { ui: UIKEY, theme });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForApp(page);
    await applyTheme(page, theme);
    await dismissChrome(page);

    await page.evaluate(() => window.__repforgeUi.showInstallBanner());
    await sleep(page, 400);
    if (await page.evaluate(() => {
      const b = document.querySelector(".installbanner");
      return b && !b.classList.contains("hidden");
    })) {
      await shot(page, theme, "31-install-banner");
    }

    await page.evaluate(() => {
      const sheet = document.querySelector("#iosInstallSheet");
      const scrim = document.querySelector("#iosInstallScrim");
      if (!sheet) return;
      sheet.hidden = false;
      sheet.classList.remove("hidden");
      sheet.classList.add("is-open");
      scrim?.classList.remove("hidden");
      scrim?.classList.add("is-open");
      document.body.classList.add("is-sheet-open");
    });
    await sleep(page, 400);
    await shot(page, theme, "32-ios-install-sheet");
  } finally {
    await context.close();
  }
}

function writeReadme(captured) {
  const lines = [
    "# UI screen catalog",
    "",
    "Exhaustive phone-frame captures of Taurifer's primary surfaces in both Appearance themes.",
    "This folder is the visual reference for UI and Brand Designers.",
    "",
    "**Agents: keep this folder in sync.** Whenever a change alters a user-visible surface",
    "(`index.html`, `styles.css`, `app.js`, `i18n-*.json` copy that appears on screen, sheets,",
    "first-run, or install UI), regenerate both theme folders before merging. Do not ship a UI",
    "change that leaves these PNGs showing an older layout, palette, or label. See `AGENTS.md`.",
    "",
    "## Layout",
    "",
    "```text",
    "docs/ui-screens/",
    "  README.md     ← this file",
    "  light/        ← cream paper theme",
    "  dark/         ← warm charcoal theme",
    "```",
    "",
    "Filenames are identical across `light/` and `dark/` so a designer can compare a pair by name.",
    "Each PNG is a 390×844 logical viewport at 2× device scale, English, kilogram units, against a",
    "seeded three-day program with enough history for Progress and History to look lived-in.",
    "",
    "## Screens",
    "",
    "| File | Surface |",
    "| --- | --- |",
  ];
  for (const [file, label] of Object.entries(LABELS)) {
    if (captured.has(file)) lines.push(`| \`${file}.png\` | ${label} |`);
  }
  const missing = Object.keys(LABELS).filter((f) => !captured.has(f));
  if (missing.length) {
    lines.push("", "### Missing from this capture", "");
    for (const f of missing) lines.push(`- \`${f}.png\` — ${LABELS[f]}`);
  }
  lines.push(
    "",
    "## Regeneration",
    "",
    "Serve the repo root, then rewrite both theme folders:",
    "",
    "```bash",
    "python3 -m http.server 8000",
    "node tools/capture-ui-screens.mjs",
    "```",
    "",
    "The script is the only supported way to refresh these images. Do not hand-edit the PNGs,",
    "and do not capture against an unseeded or partial install — designers need a stable,",
    "comparable pair. Appearance (System/Light/Dark) must be present in the running app.",
    "",
    `Captured ${new Date().toISOString().slice(0, 10)} · ${captured.size} screens × 2 themes.`,
    ""
  );
  writeFileSync(join(OUT, "README.md"), lines.join("\n"));
}

const browser = await launchChromium();
try {
  rmSync(join(OUT, "light"), { recursive: true, force: true });
  rmSync(join(OUT, "dark"), { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  for (const theme of THEMES) {
    console.log(`\n=== ${theme} ===`);
    try { await captureMain(browser, theme); }
    catch (err) { console.warn(`main (${theme}): ${err.message.split("\n")[0]}`); }
    try { await captureFirstRun(browser, theme); }
    catch (err) { console.warn(`first-run (${theme}): ${err.message.split("\n")[0]}`); }
    try { await captureSharedSetup(browser, theme); }
    catch (err) { console.warn(`shared-setup (${theme}): ${err.message.split("\n")[0]}`); }
    try { await captureInstall(browser, theme); }
    catch (err) { console.warn(`install (${theme}): ${err.message.split("\n")[0]}`); }
  }

  const captured = new Set();
  for (const theme of THEMES) {
    for (const f of readdirSync(join(OUT, theme))) {
      if (f.endsWith(".png")) captured.add(f.replace(/\.png$/, ""));
    }
  }
  writeReadme(captured);
  console.log(`\nCatalog ready: ${captured.size} screens × ${THEMES.length} themes → ${OUT}`);
  if (captured.size < Object.keys(LABELS).length) {
    const missing = Object.keys(LABELS).filter((f) => !captured.has(f));
    console.warn("Missing:", missing.join(", "));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
