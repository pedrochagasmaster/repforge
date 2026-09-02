/**
 * Drive the non-onboarding surfaces.
 *
 * Every scenario is self-contained: it starts from the seeded catalog program
 * and navigates to its own subject. The previous tool walked one long-lived
 * page through all 35 screens in order, so a single broken step silently
 * poisoned every frame after it.
 */
import { catalogState, localeState } from "./fixtures.mjs";
import { dismissChrome, sleep } from "./session.mjs";

export function appState(_key, lang) {
  const state = catalogState();
  // The editor reference is intentionally a compact two-exercise day, matching
  // the canonical installed-editor mockup. Other catalog surfaces keep the
  // richer fixture so their progress and volume evidence remains meaningful.
  if (_key === "program/progression-editor") {
    state.program = state.program.filter((exercise) =>
      exercise.day !== "Day 1" || exercise.id === "ex-sq" || exercise.id === "ex-curl");
  }
  return localeState(state, lang);
}

const view = async (page, name) => {
  await page.click(`nav [data-view="${name}"]`);
  await sleep(page, 500);
};

async function enterWorkout(page, options = {}) {
  await page.evaluate((opts) => window.__repforgeEnterWorkout(opts), { focus: false, ...options });
  await sleep(page, 600);
}

async function focusMode(page) {
  await enterWorkout(page, { focus: false });
  await page.click("#woOverflowBtn");
  await sleep(page, 200);
  await page.click("#modeFocus");
  await sleep(page, 500);
}

/** Fill the current focus card and save the set, which starts the rest timer. */
async function logCurrentSet(page) {
  await page.evaluate(() => {
    const card = document.querySelector("#workout .exercise.is-current")
      || document.querySelector("#workout .exercise");
    card?.querySelectorAll("input").forEach((el) => {
      const key = el.dataset.k || "";
      if (key.endsWith("_load")) el.value = "100";
      else if (key.endsWith("_reps")) el.value = "6";
      else if (key.endsWith("_rir")) el.value = "1";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    card?.querySelector(".focus-well .btn--cta, .saveset")?.click();
  });
  await sleep(page, 600);
}

async function saveWholeSession(page) {
  await enterWorkout(page, { focus: true, day: "Day 1" });
  await page.evaluate(() => {
    const set = (suffix, value) => {
      document.querySelectorAll(`#workout [data-k$="${suffix}"]`).forEach((el, index) => {
        el.value = typeof value === "function" ? value(index) : value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    set("_1_load", (i) => String(80 + i * 5));
    set("_1_reps", "6");
    set("_1_rir", "1");
  });
  await page.evaluate(async () => { await window.__repforgeSaveWorkout(); });
  await page.waitForFunction(() => {
    const el = document.querySelector("#sessionSummary");
    return el && !el.hidden && !el.classList.contains("hidden");
  }, undefined, { timeout: 15000 });
  await sleep(page, 900);
}

async function openLibrary(page) {
  await page.evaluate(() => window.__repforgeOpenLibrary({}));
  await sleep(page, 600);
}

async function openProgram(page) {
  await view(page, "program");
}

async function progressSegment(page, segment) {
  await view(page, "stats");
  await page.click(`#statsSeg [data-seg="${segment}"]`);
  await sleep(page, 500);
}

async function openSettings(page, anchor) {
  await page.evaluate(() => window.__repforgeShowSettings());
  await sleep(page, 500);
  if (!anchor) return;
  await page.evaluate((sel) => {
    document.querySelector(sel)?.closest("label, .settings-row, .settings-group")
      ?.scrollIntoView({ block: "center" });
  }, anchor);
  await sleep(page, 250);
}

export const APP_SCENARIOS = {
  "today/ready": async (page) => { await dismissChrome(page); await sleep(page, 300); },
  "today/day-picker": async (page) => {
    await page.click("#chooseAnotherDay");
    await page.waitForSelector("#dayPickSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "today/done": async (page) => {
    await saveWholeSession(page);
    await page.click("#sumDone");
    await sleep(page, 500);
    await page.evaluate(() => {
      document.querySelector('nav [data-view="log"]')?.click();
      if (document.body.classList.contains("is-settings")) document.querySelector("#settingsBack")?.click();
    });
    await sleep(page, 600);
  },

  "workout/list": (page) => enterWorkout(page),
  "workout/focus": focusMode,
  "workout/rest-timer": async (page) => {
    await focusMode(page);
    await logCurrentSet(page);
    await page.waitForFunction(
      () => document.querySelector("#woRest")?.classList.contains("is-running"),
      undefined, { timeout: 20000 }
    );
    await page.click("#woRest");
    await page.waitForSelector("#restSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/exercise-note": async (page) => {
    await focusMode(page);
    await page.locator("#workout [data-exnote-open]").first().click({ timeout: 20000 });
    await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/why-this-weight": async (page) => {
    await enterWorkout(page);
    await page.click("#workout [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "session/summary": saveWholeSession,

  "progress/overview": (page) => view(page, "stats"),
  "progress/exercise-chart": async (page) => {
    await view(page, "stats");
    await page.evaluate(() => {
      const select = document.querySelector("#statExercise");
      if (!select) return;
      const option = [...select.options].find((o) => /Barbell back squat/i.test(o.textContent));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await page.evaluate(() => document.querySelector(".chartcard")?.scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#chart");
      if (!canvas || !canvas.width) return false;
      const box = canvas.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= window.innerHeight;
    }, undefined, { timeout: 20000 });
    await sleep(page, 500);
  },
  "progress/strength": (page) => progressSegment(page, "strength"),
  "progress/volume": (page) => progressSegment(page, "volume"),
  "progress/prs": (page) => progressSegment(page, "prs"),
  "progress/review": (page) => progressSegment(page, "review"),

  "history/list": (page) => view(page, "history"),
  "history/session": async (page) => {
    await view(page, "history");
    // One auto-waiting click, not a scroll followed by a click: the session
    // list re-renders after its first paint, and a separate scroll step gives
    // that re-render a second chance to detach the element mid-operation.
    await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
    await sleep(page, 500);
    await page.locator("#sessions .session__open").first().click({ timeout: 30000 });
    await page.waitForSelector(".session--edit", { timeout: 20000 });
    await sleep(page, 400);
  },

  "library/list": openLibrary,
  "library/exercise-preview": async (page) => {
    await openLibrary(page);
    const preview = page.locator('#libList [data-lib-preview="sq_bb"]');
    if (await preview.count()) await preview.click();
    else await page.locator("#libList [data-lib-preview]").first().click();
    await sleep(page, 600);
  },
  "library/exercise-detail": async (page) => {
    // Workout rows carry per-session generated ids, not the program's fixture
    // ids, so address the first row rather than naming one.
    await enterWorkout(page);
    const row = page.locator("#workout [data-exopen]").first();
    await row.scrollIntoViewIfNeeded({ timeout: 20000 });
    await row.click({ timeout: 20000 });
    await sleep(page, 800);
  },

  "program/overview": openProgram,
  "program/progression-editor": async (page) => {
    await openProgram(page);
    await page.click("#programEditToggle");
    await page.waitForSelector('#programEditor [data-role="editor"]', { timeout: 20000 });
    // The installed editor is the canonical program-editing surface. Keep the
    // historical catalog key so existing links and committed frame paths stay
    // stable while the scenario follows the shared editor.
    const editor = page.locator('#programEditor [data-role="exercise"]').first();
    await editor.scrollIntoViewIfNeeded();
    await sleep(page, 400);
  },
  "program/exercise-picker": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "multi" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await sleep(page, 500);
  },
  "program/custom-exercise": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "single" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.locator("#exPickSheet [data-act='custom'], #exPickSheet button")
      .filter({ hasText: /custom|personalizad/i }).first().click({ timeout: 20000 });
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "program/share-setup": async (page) => {
    await openProgram(page);
    await page.click("#shareProgramSetup");
    await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 10000 });
    await sleep(page, 500);
  },
  "program/text-export": async (page) => {
    await openProgram(page);
    await page.click("#exportProgramText");
    await page.waitForSelector("#programTextSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "settings/main": (page) => openSettings(page),
  "settings/appearance": (page) => openSettings(page, "#theme"),
  "settings/privacy": (page) => openSettings(page, "#telemetryToggle"),

  "install/banner": async (page) => {
    await page.evaluate(() => window.__repforgeUi.showInstallBanner());
    await sleep(page, 500);
    const shown = await page.evaluate(() => {
      const banner = document.querySelector(".installbanner");
      return banner && !banner.classList.contains("hidden");
    });
    if (!shown) throw new Error("install banner did not open");
  },
  "install/ios-sheet": async (page) => {
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
    await sleep(page, 450);
  },
  "install/tour": async (page) => {
    await page.evaluate(() => window.__repforgeUi.startTour("settings"));
    await sleep(page, 600);
    const open = await page.evaluate(() => {
      const tour = document.querySelector("#tour");
      return tour && !tour.classList.contains("hidden");
    });
    if (!open) throw new Error("tour did not open");
  },
};

/** The iOS install sheet only renders under a Safari user agent. */
export const APP_USER_AGENT = {
  "install/banner": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "install/ios-sheet": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
};
