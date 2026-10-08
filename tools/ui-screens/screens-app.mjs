/**
 * Drive the non-onboarding surfaces.
 *
 * Every scenario is self-contained: it starts from the seeded catalog program
 * and navigates to its own subject. The previous tool walked one long-lived
 * page through all 35 screens in order, so a single broken step silently
 * poisoned every frame after it.
 */
import { catalogState, directionDState, emptyEntryState, localeState } from "./fixtures.mjs";
import { CAPTURE_NOW, dismissChrome, LOG_DRAFT, seed, sleep } from "./session.mjs";
import { definitionSlot, installGeneratedProgram, isWeightRepsSlot, metricLogRow } from "../../test/fixtures/history-metric-rows.mjs";
import { DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID } from "./direction-d-canonical-fixture.generated.mjs";

export function stabilizeShareUrlForCapture(value) {
  const url = new URL(String(value));
  if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname)) {
    url.protocol = "http:";
    url.host = "localhost:8765";
  }
  return url.href;
}

async function stabilizeShareLink(page) {
  await page.waitForFunction(() => {
    const link = document.querySelector("#shareSetupLink");
    return ("value" in (link || {}) ? link.value : link?.textContent || "").startsWith("http");
  }, undefined, { timeout: 20000 });
  const link = page.locator("#shareSetupLink");
  const value = await link.evaluate(node => "value" in node ? node.value : node.textContent);
  const stable = stabilizeShareUrlForCapture(value);
  await link.evaluate((node, next) => {
    if ("value" in node) node.value = next;
    else node.textContent = next;
  }, stable);
}

function isoDaysAgo(n) {
  const date = new Date(Date.parse(CAPTURE_NOW));
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
}

async function assertGlossaryViewport(page, label) {
  const bounds = await page.locator("#glossary").evaluate(node => {
    const rect = node.getBoundingClientRect();
    const close = node.querySelector(".glossary__close").getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      closeLeft: close.left, closeRight: close.right, closeTop: close.top, closeBottom: close.bottom,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
    };
  });
  if (bounds.left < 0 || bounds.right > bounds.viewportWidth || bounds.top < 0 || bounds.bottom > bounds.viewportHeight
    || bounds.closeLeft < 0 || bounds.closeRight > bounds.viewportWidth
    || bounds.closeTop < 0 || bounds.closeBottom > bounds.viewportHeight) {
    throw new Error(`${label} glossary or close control escapes the viewport: ${JSON.stringify(bounds)}`);
  }
}

async function withExternalTextScale(page, verify) {
  const inlineFontSize = await page.evaluate(() => {
    const root = document.documentElement;
    const value = root.style.fontSize;
    root.style.removeProperty("font-size");
    const style = document.createElement("style");
    style.id = "plan058-external-text-scale-proof";
    style.textContent = "html { font-size: 32px !important; }";
    document.head.append(style);
    return value;
  });
  try {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const rootScale = await page.evaluate(() => ({
      fontSize: getComputedStyle(document.documentElement).fontSize,
      inlineFontSize: document.documentElement.style.fontSize,
    }));
    if (rootScale.fontSize !== "32px" || rootScale.inlineFontSize !== "") {
      throw new Error(`External text-scale fixture did not produce a 32px root without inline sizing: ${JSON.stringify(rootScale)}`);
    }
    await verify();
  } finally {
    await page.evaluate((fontSize) => {
      document.getElementById("plan058-external-text-scale-proof")?.remove();
      if (fontSize) document.documentElement.style.fontSize = fontSize;
    }, inlineFontSize);
    await page.evaluate(() => new Promise(requestAnimationFrame));
  }
}

async function assertDockFitsExternalTextScale(page) {
  await withExternalTextScale(page, async () => {
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const nav = document.querySelector("nav");
      if (!nav) return { error: "the production dock is missing" };
      const navRect = nav.getBoundingClientRect();
      const labels = [...nav.querySelectorAll(":scope > button")].map((button) => {
        const label = button.querySelector("[data-i18n]");
        const buttonRect = button.getBoundingClientRect();
        const labelRect = label?.getBoundingClientRect();
        const range = document.createRange();
        if (label) range.selectNodeContents(label);
        const textRects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
        return {
          view: button.dataset.view,
          text: label?.textContent.trim() || "",
          visible: buttonRect.width > 0 && buttonRect.height > 0 && getComputedStyle(button).display !== "none",
          fits: !!label && label.scrollWidth <= label.clientWidth + 1
            && textRects.length > 0 && textRects.every((rect) => rect.left >= labelRect.left - 1
              && rect.right <= labelRect.right + 1 && rect.top >= buttonRect.top - 1 && rect.bottom <= buttonRect.bottom + 1),
          rect: { left: buttonRect.left, right: buttonRect.right, top: buttonRect.top, bottom: buttonRect.bottom },
        };
      });
      const columns = getComputedStyle(nav).gridTemplateColumns.trim().split(/\s+/).length;
      const overlap = labels.some((label, index) => labels.slice(index + 1).some((other) =>
        label.rect.left < other.rect.right - 1 && other.rect.left < label.rect.right - 1
        && label.rect.top < other.rect.bottom - 1 && other.rect.top < label.rect.bottom - 1));
      const lang = root.lang.toLowerCase();
      const expectedLabels = lang.startsWith("pt")
        ? ["Hoje", "Progresso", "Histórico", "Treino"]
        : ["Today", "Progress", "History", "Program"];
      return {
        rootFontSize: getComputedStyle(root).fontSize,
        rootInlineFontSize: root.style.fontSize,
        columns,
        expectedLabels,
        labels,
        overlap,
        dockInViewport: navRect.left >= 0 && navRect.right <= root.clientWidth
          && navRect.top >= 0 && navRect.bottom <= root.clientHeight,
      };
    });
    if (layout.error || layout.rootFontSize !== "32px" || layout.rootInlineFontSize !== ""
      || layout.columns !== 2 || layout.labels.length !== 4
      || layout.labels.some((label, index) => !label.visible || !label.fits || label.text !== layout.expectedLabels[index])
      || layout.overlap || !layout.dockInViewport) {
      throw new Error(`The production dock does not reflow for an external 32px root font: ${JSON.stringify(layout)}`);
    }
  });
}

async function assertTodayExerciseFitsExternalTextScale(page) {
  await withExternalTextScale(page, async () => {
    await page.evaluate(() => {
      const row = document.querySelector(".rxrow");
      const dock = document.querySelector("nav");
      if (!row || !dock) throw new Error("Today external-scale proof is missing the exercise row or dock");
      const rowBottom = row.getBoundingClientRect().bottom;
      const dockTop = dock.getBoundingClientRect().top;
      window.scrollTo({ top: window.scrollY + Math.max(0, Math.ceil(rowBottom - dockTop + 8)), behavior: "instant" });
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const clearance = await page.evaluate(() => {
      const root = document.documentElement;
      const row = document.querySelector(".rxrow");
      const name = row?.querySelector(".rxrow__name");
      const value = row?.querySelector(".rxrow__target");
      const dock = document.querySelector("nav");
      if (!row || !name || !value || !dock) return { error: "Today row, value, or dock is missing" };
      const style = getComputedStyle(name);
      const nameRect = name.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(name);
      const textRects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      const rowRect = row.getBoundingClientRect();
      const valueRect = value.getBoundingClientRect();
      const dockRect = dock.getBoundingClientRect();
      return {
        rootFontSize: getComputedStyle(root).fontSize,
        rootInlineFontSize: root.style.fontSize,
        name: name.textContent.trim(),
        whiteSpace: style.whiteSpace,
        textOverflow: style.textOverflow,
        nameFits: name.scrollWidth <= name.clientWidth + 1 && textRects.length > 0
          && textRects.every((rect) => rect.left >= nameRect.left - 1 && rect.right <= nameRect.right + 1
            && rect.top >= nameRect.top - 1 && rect.bottom <= nameRect.bottom + 1),
        rowTop: rowRect.top,
        rowBottom: rowRect.bottom,
        valueBottom: valueRect.bottom,
        dockTop: dockRect.top,
      };
    });
    if (clearance.error || clearance.rootFontSize !== "32px" || clearance.rootInlineFontSize !== ""
      || !clearance.name || clearance.whiteSpace !== "normal" || clearance.textOverflow === "ellipsis"
      || !clearance.nameFits || clearance.rowTop < 0 || clearance.rowBottom > clearance.dockTop - 8
      || clearance.valueBottom > clearance.dockTop - 8) {
      throw new Error(`The Today exercise row does not reflow for an external 32px root font: ${JSON.stringify(clearance)}`);
    }
  });
}

async function assertLibraryTabsFitExternalTextScale(page) {
  await withExternalTextScale(page, async () => {
    const layout = await page.evaluate(() => {
      const bar = document.querySelector("#library #libTabs");
      const header = document.querySelector("#library .exview-head");
      if (!bar || !header) return { error: "the production library tabs or header are missing" };
      const barRect = bar.getBoundingClientRect();
      const headerItems = ["#libBack", "#libTitle", "#libClose"].map((selector) => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        const range = document.createRange();
        if (element) range.selectNodeContents(element);
        const textRects = [...range.getClientRects()].filter((item) => item.width > 0 && item.height > 0);
        return {
          selector,
          visible: !!element && rect.width > 0 && rect.height > 0,
          fits: !!element && element.scrollWidth <= element.clientWidth + 1 && textRects.length > 0
            && textRects.every((item) => item.left >= rect.left - 1 && item.right <= rect.right + 1
              && item.top >= rect.top - 1 && item.bottom <= rect.bottom + 1),
          rect: rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
        };
      });
      const headerOverlap = headerItems.some((item, index) => headerItems.slice(index + 1).some((other) =>
        item.rect && other.rect && item.rect.left < other.rect.right - 1 && item.rect.right > other.rect.left + 1
        && item.rect.top < other.rect.bottom - 1 && item.rect.bottom > other.rect.top + 1));
      const tabs = [...bar.querySelectorAll(".picktab")].map((tab) => {
        const rect = tab.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(tab);
        const textRects = [...range.getClientRects()].filter((item) => item.width > 0 && item.height > 0);
        return {
          text: tab.textContent.trim(),
          rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
          fits: tab.scrollWidth <= tab.clientWidth + 1 && textRects.length > 0
            && textRects.every((item) => item.left >= rect.left - 1 && item.right <= rect.right + 1
              && item.top >= rect.top - 1 && item.bottom <= rect.bottom + 1),
        };
      });
      const rows = [...new Set(tabs.map((tab) => Math.round(tab.rect.top)))];
      const overlap = tabs.some((tab, index) => tabs.slice(index + 1).some((other) =>
        tab.rect.left < other.rect.right - 1 && other.rect.left < tab.rect.right - 1
        && tab.rect.top < other.rect.bottom - 1 && other.rect.top < tab.rect.bottom - 1));
      return {
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
        rootInlineFontSize: document.documentElement.style.fontSize,
        headerDisplay: getComputedStyle(header).display,
        headerItems,
        headerOverlap,
        flexWrap: getComputedStyle(bar).flexWrap,
        barInViewport: barRect.left >= 0 && barRect.right <= document.documentElement.clientWidth,
        tabs,
        rows,
        overlap,
      };
    });
    if (layout.error || layout.rootFontSize !== "32px" || layout.rootInlineFontSize !== ""
      || layout.headerDisplay !== "grid" || layout.headerItems.some((item) => !item.visible || !item.fits)
      || layout.headerOverlap
      || layout.flexWrap !== "wrap" || layout.tabs.length !== 3 || layout.rows.length < 2
      || layout.tabs.some((tab) => !tab.fits) || layout.overlap || !layout.barInViewport) {
      throw new Error(`The library tabs do not reflow for an external 32px root font: ${JSON.stringify(layout)}`);
    }
  });
}

/** Catalog states built on the Direction D fixture; each R3 sub-slice adds its own. */
const D_FIXTURE_STATES = new Set([
  "workout/focus", "workout/focus-glossary", "workout/correction", // R3c
  "workout/session", "workout/early-finish", "workout/exercise-note", "workout/warmup-actions", // R3d
  "workout/reorder", "workout/skipped-actions", "workout/substituted-actions", // R3d
  "workout/exercise-actions", // R3x: the redrawn sheet, on the lifter the drawing shows
  "history/list", "history/session", "history/edit-dirty", "history/edit-invalid", // R3j, R3j2
  "program/overview", // R3k
  "today/done", // R3x: the finished day, on the lifter whose Monday session is in the log
  "today/draft-resume", // R3b2: the unfinished-session band, on the same lifter as Today
  "progress/overview", "progress/overview-baseline", "progress/overview-action", "progress/exercise-chart", // R3i
  "progress/strength", "progress/strength-current-block", "progress/strength-all-history", // R3i
  "progress/strength-comparison", "progress/strength-sparse", // R3i
]);
/**
 * Direction D states that show the lifter before the day's session is saved.
 * The review page's "today" session is part of the fixture log (the summary
 * states draw it), so Today's states read the log as it stood that morning.
 */
const DIRECTION_D_BEFORE_SESSION = new Set([
  "today/ready", "today/day-picker", "today/rest-bar", "today/draft-resume",
  "workout/why-this-weight", "workout/why-in-session", "workout/why-manual",
  "workout/rest-running", "workout/rest-done",
]);
function directionDBeforeSession() {
  const state = directionDState();
  const today = CAPTURE_NOW.slice(0, 10);
  state.log = state.log.filter((row) => String(row.date) < today);
  return state;
}

/**
 * The Direction D summary states each show one session of the fixture lifter. The log is cut at that
 * session's date, so the summary reads the evidence the lifter had when it was saved, and the scenario
 * opens the summary through the same build/open seam the finish path uses.
 */
export const DIRECTION_D_SUMMARY_SESSION = Object.freeze({
  "session/summary": "dd-2026-08-31-day1",
  "session/summary-maintained": "dd-2026-08-26-day2",
  "session/summary-declined": "dd-2026-08-28-day3",
  "session/summary-first": "dd-2026-08-12-day2-mixed",
});
function directionDThroughSession(sessionId) {
  const state = directionDState();
  const date = state.log.find((row) => row.session === sessionId)?.date;
  if (!date) throw new Error(`The Direction D fixture has no session ${sessionId}`);
  state.log = state.log.filter((row) => String(row.date) <= date);
  return state;
}

/**
 * States the review page draws on an earlier day of the same block (OG-6 round
 * 2): the lifter has fewer sessions then, so Progress shows its baseline,
 * snapshot and comparison shapes. The drawing's days shift by -21 like the
 * rest of the fixture: end of week 1 (Sun 16 Aug), the Monday after it (17
 * Aug, week 2) and Wednesday 19 Aug. `APP_CLOCK` is the capture clock for the
 * state; `APP_ASOF` is the last day of the log the lifter has by then.
 */
export const APP_CLOCK = {
  "progress/overview-baseline": "2026-08-17T12:00:00.000Z",
  "progress/strength-comparison": "2026-08-19T12:00:00.000Z",
  "progress/strength-sparse": "2026-08-16T12:00:00.000Z",
};
const APP_ASOF = {
  "progress/overview-baseline": "2026-08-16",
  "progress/strength-comparison": "2026-08-19",
  "progress/strength-sparse": "2026-08-16",
};

export function appState(key, lang) {
  if (key === "today/no-program" || key === "program/no-program") {
    return emptyEntryState(lang);
  }
  if (DIRECTION_D_BEFORE_SESSION.has(key)) return localeState(directionDBeforeSession(), lang);
  if (DIRECTION_D_SUMMARY_SESSION[key]) return localeState(directionDThroughSession(DIRECTION_D_SUMMARY_SESSION[key]), lang);
  if (key.startsWith("progress/sibling-") || key === "progress/volume-reduction-preview" ||
      ["progress/recovery-ineligible","progress/recovery-questions","progress/recovery-preview","progress/recovery-active","progress/recovery-reassessment"].includes(key)) {
    return emptyEntryState(lang);
  }
  // Direction D owns these states (spec section 11): they render the one lifter
  // the review page draws. Every other state keeps catalogState().
  if (D_FIXTURE_STATES.has(key)) {
    const drawn = localeState(directionDState(), lang);
    if (APP_ASOF[key]) drawn.log = drawn.log.filter((row) => row.date <= APP_ASOF[key]);
    return drawn;
  }
  // catalogState()'s program rows already carry distinct real catalog
  // movements (tools/build-seed-program-fixture.mjs), so program/share-*
  // no longer needs to fabricate varied libraryIds onto a flat-row fixture.
  const state = catalogState();
  if (key === "progress/overview-baseline" || key === "progress/review-insufficient") {
    const seen = new Set();
    state.log = state.log.filter((row) => {
      const id = row.exerciseId || row.name;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }
  if ((key.startsWith("progress/review-") && key !== "progress/review-active") || key.startsWith("progress/schedule-") ||
      key.startsWith("progress/sibling-") || key.startsWith("progress/guided-") ||
      key.startsWith("progress/volume-reduction") || key.startsWith("progress/recovery-")) {
    state.programMeta.mesocycleStatus = "completed";
  }
  // The editor reference is intentionally a compact two-exercise day, matching
  // the canonical installed-editor mockup. Other catalog surfaces keep the
  // richer fixture so their progress and volume evidence remains meaningful.
  // The editor reads the canonical ProgramDefinition, not the flat `program`
  // projection, so both have to be narrowed together to the same two slots.
  if (key === "program/progression-editor") {
    const kept = new Set(["seed-ex-1", "seed-ex-2"]);
    state.program = state.program.filter((exercise) => exercise.day !== "Day 1" || kept.has(exercise.id));
    for (const day of state.programMeta.programDefinition.days) {
      if (day.name === "Day 1") day.slots = day.slots.filter((slot) => kept.has(slot.id));
    }
  }
  return localeState(state, lang);
}

const view = async (page, name) => {
  await page.click(`nav [data-view="${name}"]`);
  await sleep(page, 500);
};

async function reloadWithUnavailableExerciseCatalog(page) {
  await page.route("**/assets/exercise-catalog.json*", route => route.abort("failed"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#exerciseCatalogRecovery[open]", { timeout: 20000 });
  await page.waitForFunction(() => window.__repforgeBooted !== true);
}

async function enterWorkout(page, options = {}) {
  await page.evaluate((opts) => window.__repforgeEnterWorkout(opts), options);
  await sleep(page, 600);
}

async function focusMode(page) { await enterWorkout(page); }

async function openTransferState(page, state) {
  await page.evaluate((name) => window.__repforgeUi.openInstallTransferState(name), state);
  await page.waitForSelector(`#iosInstallSheet[data-transfer-state="${state}"].is-open`, { timeout: 10000 });
  await sleep(page, 300);
}

/** Fill the current focus card and save the set, which starts the rest timer. */
async function logCurrentSet(page, values = { load: "100", reps: "6", rir: "1" }) {
  await page.evaluate((values) => {
    const card = document.querySelector("#workout .exercise.is-current")
      || document.querySelector("#workout .exercise");
    card?.querySelectorAll("input").forEach((el) => {
      const key = el.dataset.k || "";
      if (key.endsWith("_load")) el.value = values.load;
      else if (key.endsWith("_reps")) el.value = values.reps;
      else if (key.endsWith("_rir")) el.value = values.rir;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    card?.querySelector(".saveset")?.click();
  }, values);
  await sleep(page, 600);
}

/** Open the session summary for a session already in the log, through the seam the finish path uses. */
async function openFixtureSummary(page, sessionId) {
  await page.evaluate((id) => {
    const log = JSON.parse(localStorage.getItem("repforge_v1")).log;
    const rows = log.filter((row) => row.session === id);
    const prevLog = log.filter((row) => row.session !== id);
    const summary = window.__repforgeSessionSummary.build({ rows, prevLog, session: id, date: rows[0].date, day: rows[0].day, startedAt: 0 });
    window.__repforgeSessionSummary.open(summary);
  }, sessionId);
  await page.waitForSelector("#sessionSummary:not(.hidden)", { timeout: 20000 });
  await sleep(page, 900);
}

async function saveWholeSession(page) {
  await enterWorkout(page, { day: "Day 1" });
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
  // The fixture fills one set per exercise, so the normal finish boundary
  // correctly rejects it as incomplete. Use the same visible confirmation
  // path a lifter must use for an intentional partial session.
  await page.click("#sessionSheetBtn");
  await page.waitForSelector("#sessionSheet.is-open", { timeout: 15000 });
  await page.click("#sessionEarlyFinish");
  await page.click("#sessionEarlyConfirm");
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

async function openHistoryEditor(page) {
  await view(page, "history");
  await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
  await page.locator("#sessions .session__open").first().click();
  await page.waitForSelector(".session--read", { timeout: 20000 });
  await page.locator("[data-history-edit]").click();
  await page.waitForSelector(".session--edit", { timeout: 20000 });
}

async function openShare(page) {
  await openProgram(page);
  await page.click("#shareProgramSetup");
  await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 20000 });
}

async function progressSegment(page, segment) {
  await view(page, "stats");
  await page.click(`#statsSeg [data-seg="${segment}"]`);
  await sleep(page, 500);
}

async function completeCompiledProgram(page, { days = 4, minutes = 90 } = {}) {
  await page.waitForFunction(() => !!window.RepForgeExerciseCatalog?.snapshot?.() &&
    typeof window.__repforgeFinalizeProgramSetup === "function", undefined, { timeout: 15000 });
  await page.evaluate(async ({ days, minutes }) => {
    // Plan 067: the legacy services.compile()/programStructure/compilerContext path is
    // retired. A canonical ProgramDefinition now comes from the same generator the
    // Recommend route itself drives, finalized the same way `__repforgeFinalizeProgramSetup` expects.
    const catalog = window.RepForgeExerciseCatalog.snapshot();
    const request = window.RepForgeProgramEntryAdapter.programRequestFromAnswers({
      desiredResult: "balanced", structuredExperience: "6_to_24m", daysPerWeek: days, sessionMinutes: minutes,
      environment: { kind: "commercial_gym" },
    }, catalog).value;
    const generated = window.RepForgeProgramCompiler.generateProgram(request, catalog, "catalog-transition");
    if (!generated.ok) throw new Error(`catalog compiler failed: ${JSON.stringify(generated.conflicts || generated)}`);
    const finalized = await window.__repforgeFinalizeProgramSetup({
      programDefinition: generated.value, name: "Catalog transition program",
      answers: {}, destination: "log", origin: "first-run",
      draftConfirmed: true, telemetryRoute: "recommend",
      entrySource: { route: "recommend", fingerprint: "catalog-transition" },
    });
    if (!(finalized?.localOk || finalized?.idbOk)) throw new Error("catalog finalize failed");
    const state = JSON.parse(localStorage.getItem("repforge_v1"));
    state.programMeta.mesocycleStatus = "completed";
    // The production shell keeps the detailed Progress panels out of the
    // first-run empty state. Give transition frames one real session so they
    // exercise the completed-block Review surface without pretending that the
    // empty-device shell has evidence. Recovery scenarios replace this with
    // their own dated rows below.
    state.log = state.program.slice(0, 2).map((exercise, index) => ({
      session: "catalog-transition-session", date: state.programMeta.started,
      day: exercise.day, name: exercise.name, exerciseId: exercise.id, set: 1,
      load: 60 + index * 5, reps: 8, rir: 2, work: true,
      blockId: state.programMeta.blockId || undefined,
      created: state.programMeta.started + "T12:00:00.000Z",
      primary: exercise.primary, secondary: exercise.secondary,
      performedLibraryId: exercise.libraryId || undefined,
    }));
    const committed = await window.__repforgeCommitProposedState(state);
    if (!(committed?.localOk || committed?.idbOk)) throw new Error("catalog completion failed");
    await window.__repforgeStorage.flush();
  }, { days, minutes });
  // The direct commit seam updates durable state and the in-memory owner,
  // but the capture is proving the post-boot surface. Reload so the
  // transition frames cannot depend on which view happened to be active
  // while the fixture was assembled.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__repforgeBooted === true, undefined, { timeout: 20000 });
  await sleep(page, 300);
}

async function openCompletedReview(page) {
  await progressSegment(page, "review");
}

async function openScheduleDiagnosis(page) {
  await openCompletedReview(page);
  await page.click('[data-review-action="schedule-repair"]');
  await sleep(page, 300);
}

async function openSiblingPreview(page, kind) {
  await completeCompiledProgram(page);
  await openScheduleDiagnosis(page);
  if (kind === "sessions_too_long") await page.click('[data-diag="sessions_too_long"]');
  await page.fill("[data-diag-target]", kind === "sessions_too_long" ? "60" : "3");
  await page.click("[data-diag-continue]");
  await page.waitForSelector("[data-preview-confirm]", { timeout: 20000 });
  await sleep(page, 400);
}

async function openRecoveryPreview(page) {
  await completeCompiledProgram(page);
  await page.evaluate(async () => {
    const state = JSON.parse(localStorage.getItem("repforge_v1"));
    const start = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    state.programMeta.started = start;
    state.programMeta.mesocycleStatus = "completed";
    state.log = [];
    const blockId = state.programMeta.blockId || undefined;
    for (const [index, exercise] of state.program.entries()) for (const [offset, load] of [[7, 50 + index], [1, 50 + index]]) {
      const date = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
      state.log.push({ session: `recovery-${offset}-${index}`, date, day: exercise.day, name: exercise.name,
        exerciseId: exercise.id, set: 1, load, reps: 8, rir: 2, work: true,
        blockId,
        primary: exercise.primary, secondary: exercise.secondary,
        performedLibraryId: exercise.libraryId || undefined,
        created: `${date}T12:00:00.000Z` });
    }
    // The completed-program seed contributes one ordinary exposure. Add a
    // current, lower-rep exposure so the real paired-session comparison
    // produces maintained/declined pattern evidence for the recovery gate.
    const currentDate = new Date(Date.now()).toISOString().slice(0, 10);
    for (const [index, exercise] of state.program.entries()) {
      state.log.push({
        session: "recovery-current-" + index, date: currentDate, day: exercise.day,
        name: exercise.name, exerciseId: exercise.id, set: 1, load: 40,
        reps: 6, rir: 2, work: true, primary: exercise.primary,
        blockId,
        secondary: exercise.secondary, performedLibraryId: exercise.libraryId || undefined,
        created: currentDate + "T13:00:00.000Z",
      });
    }
    const committed = await window.__repforgeCommitProposedState(state);
    if (!(committed?.localOk || committed?.idbOk)) throw new Error("catalog evidence commit failed");
    await window.__repforgeStorage.flush();
  });
  await openCompletedReview(page);
  await page.click('[data-review-action="recovery-week"]');
}

async function recoveryPreview(page) {
  await openRecoveryPreview(page);
  await page.click('[data-recovery-answer="Yes"]');
  await page.waitForSelector("[data-preview-confirm]", { timeout: 20000 });
}

async function confirmRecovery(page) {
  await recoveryPreview(page);
  await page.click("[data-preview-confirm]");
  await page.waitForSelector(".review__staged", { timeout: 20000 });
  // The commit toast is written through two animation frames so repeated
  // captures do not announce the same message without a DOM change. Wait for
  // that final text before closing the staged flow; otherwise a busy runner
  // can photograph the toast shell and an intermediate review layout.
  const waitForRecoveryToast = () => page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return toast && !toast.classList.contains("hidden") && toast.textContent.trim();
  }, undefined, { timeout: 5000 });
  await waitForRecoveryToast();
  await page.click("[data-flow-cancel]");
  await waitForRecoveryToast();
  await page.waitForFunction(() => {
    const toast = document.querySelector("#toast");
    return !toast || toast.classList.contains("hidden");
  }, undefined, { timeout: 5000 });
  await sleep(page, 400);
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

async function resetSheetScroll(page, selector) {
  await page.locator(selector).evaluate((element) => { element.scrollTop = 0; });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function createInUseCustomExercise(page) {
  const result = await page.evaluate(async () => {
    const created = await window.__repforgeSaveCustomExercise({
      name: "Paused cable row",
      equipment: ["machine"],
      primary: "Mid/upper back",
      secondary: "Biceps",
      notes: "Seat 4, handles at chest height",
    });
    if (created?.result?.committed !== true || created?.result?.settled !== true || !created.entry?.id)
      throw new Error("The archive evidence custom definition did not settle");
    const proposal = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
    const row = proposal.program?.[0];
    if (!row) throw new Error("The archive evidence fixture has no program row");
    proposal.log = Array.isArray(proposal.log) ? proposal.log : [];
    proposal.log.push({
      session: "ui-screen-custom-archive-history",
      date: "2026-01-03",
      day: row.day,
      exerciseId: "ui-screen-custom-archive-slot",
      name: created.entry.name,
      performedName: created.entry.name,
      performedMovementId: `library:${created.entry.id}`,
      set: 1,
      load: 10,
      reps: 8,
      rir: 2,
      created: "2026-01-03T12:00:00.000Z",
    });
    const linked = await window.__repforgeCommitProposedState(proposal);
    if (linked?.committed !== true || linked?.settled !== true)
      throw new Error("The archive evidence log identity did not settle");
    return created.entry.id;
  });
  await page.evaluate(id => window.__repforgeEditCustom(id), result);
  await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
  return result;
}

/**
 * Set 1 of the squat logged at 102.5 x 8 with RIR 1, which starts the rest. The catalog pins `Date`, so the
 * clock stands where the rest started: 2:00 of 2:00 until the scenario moves it through the rest controls.
 */
async function startInlineRest(page) {
  await enterWorkout(page);
  await logCurrentSet(page, { load: "102.5", reps: "8", rir: "1" });
  await page.waitForSelector("#workout .exercise.is-current .fx-slot[data-rest='running']", { timeout: 20000 });
}

/** The sheet's blocks are the spec 4.3 contract: each carries the lead it opens with. */
async function expectWhyLeads(page, leads) {
  const found = await page.$$eval("#whyBody .whysheet__block", (nodes) => nodes.map((node) => node.dataset.lead));
  for (const lead of leads) {
    if (!found.includes(lead)) throw new Error(`The Why sheet should lead with "${lead}"; it has ${JSON.stringify(found)}`);
  }
}

// Weight+Reps metric ids (plan067-engine-replacement brief), reused by the
// adaptive Why fixture below.
const ADAPTIVE_WEIGHT_METRIC_ID = "2555c6f170d8805cafa6d16d3fdddbaa";
const ADAPTIVE_REPS_METRIC_ID = "2555c6f170d88072bbf6d9ad3f16ea86";

async function fillAdaptiveShelf(page, metricId, value) {
  const input = page.locator(`#workout .exercise.is-current .focus-shelf input[data-metric-id="${metricId}"]`);
  await input.waitFor({ state: "attached", timeout: 10000 });
  if (await input.getAttribute("aria-hidden") === "true") {
    await page.locator(`#workout .exercise.is-current .focus-shelf [data-shelf-field="metric_${metricId}"]`).click();
  }
  await input.fill(String(value));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
}

/** Log one set of the current exercise through the real metric shelf (test/why-sheet.mjs's pattern). */
async function logAdaptiveSet(page, slotId, ordinal, { load, reps, rir }) {
  await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, load);
  await fillAdaptiveShelf(page, ADAPTIVE_REPS_METRIC_ID, reps);
  const rirInput = page.locator(`#workout .exercise.is-current input[data-k="${slotId}_${ordinal}_rir"]`);
  if (await rirInput.getAttribute("aria-hidden") === "true") {
    await page.locator('#workout .exercise.is-current .focus-shelf [data-shelf-field="rir"]').click();
  }
  await rirInput.fill(String(rir));
  await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
  await page.locator(`#workout .exercise.is-current [data-save="${slotId}_${ordinal}"]`).click();
  await sleep(page, 500);
  const skip = page.locator('#workout .exercise.is-current .focus-shelf [data-rest-act="skip"]');
  if (await skip.count() && await skip.isVisible().catch(() => false)) await skip.click();
}

/**
 * A real generated program (muscle growth, 4 days, commercial gym) with one
 * prior logged session on its first day's first Weight+Reps slot, so the
 * adaptive engine has comparable history to recommend from. Plan 067 retired
 * the old range-engine Why leads ("top"/"load"/"reps"/"set1"/"set2"); on a
 * generated program the sheet is built by engineWhyModel/engineWhyRows and
 * always leads with "engine-anchor", "engine-target" and "engine-assumptions".
 */
async function adaptiveWhyFixture(page) {
  const state = await installGeneratedProgram(page, { name: "Why sheet proof", seed: "why-sheet-ui" });
  const day = state.program[0]?.day;
  const row = state.program.find((candidate) => candidate.day === day && isWeightRepsSlot(definitionSlot(state.programMeta, candidate)));
  if (!row) throw new Error("adaptive Why fixture: no Weight+Reps slot on the generated program's first day");
  const past = new Date(Date.parse(CAPTURE_NOW));
  past.setUTCDate(past.getUTCDate() - 7);
  const pastDate = past.toISOString().slice(0, 10);
  state.log = [
    metricLogRow(state.programMeta, row, { session: "why-history", date: pastDate, set: 1, load: 40, reps: 8, rir: 2 }),
    metricLogRow(state.programMeta, row, { session: "why-history", date: pastDate, set: 2, load: 40, reps: 7, rir: 1 }),
  ];
  // A plain localStorage overwrite leaves IndexedDB on the finalize's own
  // revision, and recovery against the mismatched replica hangs boot; seed()
  // (the fixture harness's own reset) writes both replicas and reloads.
  await seed(page, state);
  await page.evaluate((d) => window.__repforgeEnterWorkout({ day: d }), day);
  await page.waitForSelector("#workout.is-focus .exercise.is-current", { timeout: 15000 });
  return row;
}

/** The Why sheet for one lift of the Direction D mixed day, opened from its Focus card. */
function whyOnMixedDay(exerciseId, leads) {
  return async (page) => {
    await enterWorkout(page, { day: "Day 2 · mixed" });
    await page.evaluate((id) => window.__repforgeGoToLogExercise(id), exerciseId);
    await sleep(page, 500);
    await page.click(`#workout .exercise.is-current[data-ex="${exerciseId}"] [data-why]`);
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    await expectWhyLeads(page, leads);
  };
}

export const APP_SCENARIOS = {
  "catalog-recovery/unavailable": reloadWithUnavailableExerciseCatalog,
  "catalog-recovery/retry-failed": async page => {
    await reloadWithUnavailableExerciseCatalog(page);
    await page.click("#retryExerciseCatalog");
    await page.waitForFunction(() => !!document.querySelector("#exerciseCatalogRecoveryStatus")?.textContent.trim(), undefined, { timeout: 10000 });
    const state = await page.evaluate(() => ({
      open: document.querySelector("#exerciseCatalogRecovery")?.open === true,
      retryEnabled: document.querySelector("#retryExerciseCatalog")?.disabled === false,
      booted: window.__repforgeBooted === true,
    }));
    if (!state.open || !state.retryEnabled || state.booted) throw new Error(`Failed retry lost its recovery path: ${JSON.stringify(state)}`);
  },
  "today/no-program": async (page) => { await dismissChrome(page); await sleep(page, 300); },
  "today/ready": async (page) => {
    await dismissChrome(page);
    const rows = page.locator("#todayExList .rxrow");
    await rows.first().waitFor({ state: "visible", timeout: 20000 });
    if ((await rows.count()) < 5) throw new Error("Today shows every exercise of the day, not a preview of three");
    await sleep(page, 300);
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      await page.evaluate(() => {
        const row = document.querySelector(".rxrow");
        const dock = document.querySelector("nav");
        if (!row || !dock) throw new Error("Today 200% exercise row or dock is missing");
        const rowBottom = row.getBoundingClientRect().bottom;
        const dockTop = dock.getBoundingClientRect().top;
        window.scrollTo({ top: window.scrollY + Math.max(0, Math.ceil(rowBottom - dockTop + 8)), behavior: "instant" });
      });
      const clearance = await page.evaluate(() => {
        const row = document.querySelector(".rxrow");
        const name = row?.querySelector(".rxrow__name");
        const value = row?.querySelector(".rxrow__target");
        const dock = document.querySelector("nav");
        if (!row || !name || !value || !dock) return { error: "Today row, value, or dock is missing" };
        const nameStyle = getComputedStyle(name);
        const rowRect = row.getBoundingClientRect();
        const valueRect = value.getBoundingClientRect();
        const dockRect = dock.getBoundingClientRect();
        return {
          fontSize: nameStyle.fontSize,
          whiteSpace: nameStyle.whiteSpace,
          textOverflow: nameStyle.textOverflow,
          nameFits: name.scrollWidth <= name.clientWidth,
          rowTop: rowRect.top,
          rowBottom: rowRect.bottom,
          valueBottom: valueRect.bottom,
          dockTop: dockRect.top,
        };
      });
      if (clearance.error || clearance.fontSize !== "32px" || clearance.whiteSpace !== "normal"
        || clearance.textOverflow === "ellipsis" || !clearance.nameFits || clearance.rowTop < 0
        || clearance.rowBottom > clearance.dockTop - 8 || clearance.valueBottom > clearance.dockTop - 8) {
        throw new Error(`200% Today exercise row does not fit above the floating dock: ${JSON.stringify(clearance)}`);
      }
      await assertDockFitsExternalTextScale(page);
      await assertTodayExerciseFitsExternalTextScale(page);
    }
  },
  "today/day-picker": async (page) => {
    await page.click("#chooseAnotherDay");
    await page.waitForSelector("#dayPickSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      await withExternalTextScale(page, async () => {
        const layout = await page.evaluate(() => {
          const textFits = (node) => {
            const box = node.getBoundingClientRect(), range = document.createRange();
            range.selectNodeContents(node);
            return [...range.getClientRects()].filter((rect) => rect.width && rect.height).every((rect) =>
              rect.left >= box.left - 1 && rect.right <= box.right + 1
                && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
          };
          const clippedLabels = [...document.querySelectorAll("#dayPickList .daypick__title, #dayPickList .daypick__sub")]
            .filter((label) => {
              const style = getComputedStyle(label);
              return style.whiteSpace !== "normal" || style.textOverflow === "ellipsis"
                || label.scrollWidth > label.clientWidth + 1
                || !textFits(label);
            }).map((label) => ({ selector: label.className, text: label.textContent.trim() }));
          const actions = ["#dayPickConfirm", "#dayPickCancel"].map((selector) => {
            const button = document.querySelector(selector);
            if (!button) return { selector, visible: false, labelFits: false, inViewport: false };
            const box = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return { selector, visible: style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0,
              labelFits: textFits(button), inViewport: box.top >= -1 && box.bottom <= innerHeight + 1 };
          });
          const list = document.querySelector("#dayPickList");
          const rows = [...(list?.querySelectorAll(".daypick__row") || [])];
          let lastChoiceReachable = false;
          if (list && rows.length && ["auto", "scroll", "overlay"].includes(getComputedStyle(list).overflowY)) {
            const originalTop = list.scrollTop;
            list.scrollTop = list.scrollHeight;
            const listBox = list.getBoundingClientRect(), lastBox = rows.at(-1).getBoundingClientRect();
            lastChoiceReachable = list.scrollHeight > list.clientHeight
              && lastBox.top >= listBox.top - 1 && lastBox.bottom <= listBox.bottom + 1;
            list.scrollTop = originalTop;
          }
          return { clippedLabels, actions, lastChoiceReachable };
        });
        if (layout.clippedLabels.length || layout.actions.some((action) => !action.visible || !action.labelFits || !action.inViewport)
          || !layout.lastChoiceReachable) {
          throw new Error(`200% day-picker labels/actions do not fit and remain reachable: ${JSON.stringify(layout)}`);
        }
      });
    }
  },
  "today/done": async (page) => {
    // The Direction D lifter's Monday session is already in the log (the drawing's finished day): Today recaps it.
    await dismissChrome(page);
    await page.locator("#todayDash .today-done__lifts .sum-grp").first().waitFor({ state: "visible", timeout: 20000 });
    await sleep(page, 300);
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      const clearance = await page.evaluate(() => {
        const dock = document.querySelector("nav");
        const label = document.querySelector("#todaySessionLabel");
        const review = document.querySelector("#reviewTodaySession");
        const another = document.querySelector("#logAnotherSession");
        if (!dock || !label || !review || !another) return { error: "Today recap heading, actions, or dock are missing" };
        // The finished day lists every lift's outcome and target, so at 200% the actions sit far below the heading:
        // scroll to where they end and check that they, not the heading, clear the floating dock.
        const dockTop = dock.getBoundingClientRect().top;
        window.scrollBy({ top: Math.max(0, another.getBoundingClientRect().bottom - (dockTop - 16)), behavior: "instant" });
        const dockRect = dock.getBoundingClientRect();
        const lifts = [...document.querySelectorAll("#todayDash .today-done__lifts .sum-grp")];
        const clippedLifts = lifts.filter((group) => [...group.querySelectorAll("*")].some((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible")).length;
        const reviewRect = review.getBoundingClientRect();
        const anotherRect = another.getBoundingClientRect();
        const labelFits = (button) => {
          const range = document.createRange();
          range.selectNodeContents(button);
          return [...range.getClientRects()].filter((rect) => rect.width && rect.height).every((rect) =>
            rect.left >= button.getBoundingClientRect().left - 1
            && rect.right <= button.getBoundingClientRect().right + 1
            && rect.top >= button.getBoundingClientRect().top - 1
            && rect.bottom <= button.getBoundingClientRect().bottom + 1);
        };
        return {
          reviewTop: reviewRect.top,
          clippedLifts,
          lifts: lifts.length,
          dockTop: dockRect.top,
          reviewBottom: reviewRect.bottom,
          anotherBottom: anotherRect.bottom,
          reviewLabelFits: labelFits(review),
          anotherLabelFits: labelFits(another),
        };
      });
      if (clearance.error || clearance.reviewTop < 0 || clearance.lifts < 1 || clearance.clippedLifts > 0 || clearance.reviewBottom > clearance.dockTop - 8
        || clearance.anotherBottom > clearance.dockTop - 8
        || !clearance.reviewLabelFits || !clearance.anotherLabelFits) {
        throw new Error(`200% Today recap actions do not clear the floating dock: ${JSON.stringify(clearance)}`);
      }
    }
  },

  "workout/focus": focusMode,
  "workout/focus-glossary": async (page) => {
    await focusMode(page);
    const term = page.locator("#workout [data-term]").first();
    await term.waitFor({ state: "visible", timeout: 20000 });
    await term.click();
    await page.waitForSelector("#glossary:not(.hidden)", { timeout: 10000 });
    await assertGlossaryViewport(page, "Focus");
    await sleep(page, 400);
  },
  "workout/session": async page => { await focusMode(page); await page.click("#sessionSheetBtn"); await resetSheetScroll(page, ".session-sheet__body"); },
  "workout/early-finish": async page => { await focusMode(page); await logCurrentSet(page); await page.click("#sessionSheetBtn"); await page.click("#sessionEarlyFinish"); await resetSheetScroll(page, ".session-sheet__body"); await resetSheetScroll(page, "#sessionEarlySection"); },
  "workout/exercise-actions": async page => { await focusMode(page); await page.locator("#woOverflowBtn").click(); await resetSheetScroll(page, ".exactions-sheet__body"); },
  "workout/skipped-actions": async page => {
    await focusMode(page);
    const id=await page.locator("#workout .exercise.is-current").getAttribute("data-ex");
    await page.locator("#woOverflowBtn").click();
    await page.locator("#exActionSkipBtn").click();
    await page.locator("#exActionsSheet").waitFor({state:"hidden"});
    await page.locator("#sessionSheetBtn").click();
    await page.locator(`[data-session-map-jump="${id}"]`).click();
    await page.locator("#exActionsSheet.is-open").waitFor();
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/substituted-actions": async page => {
    await focusMode(page);
    await page.locator("#woOverflowBtn").click();
    await page.locator("#exActionSubstBtn").click();
    await page.locator("#exPickList .pickrow").first().click();
    await page.locator("#exPickSheet").waitFor({state:"hidden"});
    await page.locator("#woOverflowBtn").click();
    await resetSheetScroll(page, ".exactions-sheet__body");
  },
  "workout/warmup-actions": async page => { await focusMode(page); await page.locator("#woOverflowBtn").click(); await page.locator("#exActionsWarmupList [data-warm-toggle-set]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); await resetSheetScroll(page, ".exactions-sheet__body"); },
  "workout/reorder": async page => {
    await focusMode(page);
    await page.click("#sessionSheetBtn");
    const before = await page.evaluate(() => {
      const draft = window.__repforgeWorkoutDraft.current();
      const button = document.querySelector("[data-session-reorder-down]");
      const exerciseId = button?.dataset.sessionReorderDown;
      return {
        exerciseId,
        beforeRevision: draft?.revision ?? -1,
        expectedIndex: exerciseId ? (draft?.exerciseOrder || []).indexOf(exerciseId) + 1 : -1,
      };
    });
    await page.locator("[data-session-reorder-down]").first().click();
    await page.waitForFunction(({ exerciseId, beforeRevision, expectedIndex }) => {
      const draft = window.__repforgeWorkoutDraft?.current?.();
      const active = document.activeElement;
      const isMovingExercise = active?.dataset?.sessionReorderUp === exerciseId
        || active?.dataset?.sessionReorderDown === exerciseId;
      return exerciseId && draft?.revision > beforeRevision
        && draft.exerciseOrder?.[expectedIndex] === exerciseId
        && isMovingExercise && !active.disabled;
    }, before, { timeout: 15000 });
    await page.evaluate(() => window.__repforgeWorkoutDraft.flush());
    // Prove the production announcement was emitted, then let its ordinary
    // lifetime finish before the frame is captured. Otherwise the transient
    // toast races the catalog settle pass and makes the same screen alternate
    // between a toast-covered and uncovered frame.
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return toast && !toast.classList.contains("hidden") && toast.textContent.trim();
    }, undefined, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#toast")?.classList.contains("hidden"), undefined, { timeout: 15000 });
    await resetSheetScroll(page, ".session-sheet__body");
  },
  "workout/correction": async page => { await focusMode(page); await logCurrentSet(page); await page.locator("#workout .exercise.is-current [data-editn]").first().click(); await page.evaluate(() => window.__repforgeWorkoutDraft.flush()); },
  "today/draft-resume": async page => { await focusMode(page); await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "80"); await page.click("#leaveWorkout"); },

  "workout/stale-draft": async (page) => {
    await enterWorkout(page);
    await page.evaluate(async () => {
      const hook = window.__repforgeWorkoutDraft;
      const draft = hook.current();
      const exerciseInstanceId = draft.session.selectedExerciseId;
      const setId = draft.exercises[exerciseInstanceId].setOrder[0];
      const operationId = "catalog-stale-winner";
      const next = window.RepForgeWorkoutDraft.reduce(draft, {
        type: "editSetField", exerciseInstanceId, setId, field: "load", value: "75",
        operationId, expectedRevision: draft.revision,
        updatedAt: new Date(Date.parse(draft.session.updatedAt) + 1000).toISOString(),
        writer: { ...draft.writer, operationId },
      });
      await hook.cas({
        expectedDraftId: draft.draftId,
        expectedRevision: draft.revision,
        operationId,
        nextRaw: JSON.stringify(window.RepForgeWorkoutDraft.serialize(next)),
      });
    });
    await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "stale");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  "workout/persist-retry": async (page) => {
    await enterWorkout(page);
    await page.evaluate(() => { window.__repforgeDraftFault = "before-canonical-write"; });
    await fillAdaptiveShelf(page, ADAPTIVE_WEIGHT_METRIC_ID, "82.5");
    await page.waitForFunction(() => window.__repforgeWorkoutDraft.recovery()?.kind === "persist");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  "workout/invalid-draft": async (page) => {
    await page.evaluate((draftKey) => localStorage.setItem(draftKey, '{"schemaVersion":2,"truncated":'), LOG_DRAFT);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__repforgeWorkoutDraft?.recovery()?.kind === "invalid");
    await page.waitForFunction(() => {
      const box = document.querySelector("#draftRecovery")?.getBoundingClientRect();
      return box && box.top >= 0 && box.bottom <= innerHeight;
    });
    await sleep(page, 400);
  },
  // One -30s moves the pinned clock to 1:30 of 2:00: the pad's own action, taken from the pad. At large text four pads
  // no longer fit a row, the field pads stay, and the same nudge is the presets sheet's.
  "workout/rest-running": async (page) => {
    await startInlineRest(page);
    const pad = page.locator("#workout .exercise.is-current .restpad[data-rest-act='minus']");
    if (await pad.count()) await pad.click();
    else await page.evaluate(() => window.nudgeRest(-30));
    await page.waitForFunction(() => document.querySelector("#workout .exercise.is-current [data-rest-clock]")?.textContent === "1:30");
    await sleep(page, 400);
  },
  // The bell, fifteen seconds ago: the same seam the accessibility suite uses to run the clock out.
  "workout/rest-done": async (page) => {
    await startInlineRest(page);
    await page.evaluate(() => {
      window.__repforgeRest.expire(15);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForSelector("#workout .exercise.is-current .fx-slot[data-rest='done']", { timeout: 20000 });
    await page.waitForSelector("#workout .exercise.is-current .shelf__pads[data-pads='field']", { timeout: 20000 });
    await sleep(page, 400);
  },
  "today/rest-bar": async (page) => {
    await focusMode(page);
    await logCurrentSet(page);
    await page.click("#leaveWorkout");
    await page.waitForFunction(() => {
      const timer = document.querySelector("#woRest");
      const bar = document.querySelector("#restBar");
      const rect = bar?.getBoundingClientRect();
      return !document.body.classList.contains("is-focus-wo") && timer?.classList.contains("is-running")
        && rect?.width > 1 && rect?.height > 1
        && getComputedStyle(bar).display !== "none" && !document.querySelector("#restSheet.is-open");
    }, undefined, { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/exercise-note": async (page) => {
    await focusMode(page);
    // The header's ⋯ opens the exercise actions; the note is one of them.
    await page.locator("#woOverflowBtn").click({ timeout: 20000 });
    await page.locator("#exActionNotesBtn").click({ timeout: 20000 });
    await page.waitForSelector("#exNoteSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },
  "workout/why-this-weight": async (page) => {
    await adaptiveWhyFixture(page);
    await page.click("#workout [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    await expectWhyLeads(page, ["engine-anchor", "engine-target", "engine-assumptions"]);
  },
  "workout/why-in-session": async (page) => {
    const row = await adaptiveWhyFixture(page);
    await logAdaptiveSet(page, row.slotId || row.id, 1, { load: 45, reps: 8, rir: 2 });
    await page.click("#workout .exercise.is-current [data-why]");
    await page.waitForSelector("#whySheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
    await expectWhyLeads(page, ["engine-anchor", "engine-target", "engine-assumptions"]);
  },
  "workout/why-manual": whyOnMixedDay("ex-cp", ["manual"]),

  "session/summary": async (page) => {
    await openFixtureSummary(page, DIRECTION_D_SUMMARY_SESSION["session/summary"]);
    await page.waitForSelector('.sum-outcome[data-outcome="improved"]', { timeout: 20000 });
  },
  "session/summary-maintained": async (page) => {
    await openFixtureSummary(page, DIRECTION_D_SUMMARY_SESSION["session/summary-maintained"]);
    await page.waitForSelector('.sum-outcome[data-outcome="maintained"]', { timeout: 20000 });
  },
  "session/summary-declined": async (page) => {
    await openFixtureSummary(page, DIRECTION_D_SUMMARY_SESSION["session/summary-declined"]);
    await page.waitForSelector('.sum-outcome[data-outcome="declined"]', { timeout: 20000 });
  },
  "session/summary-first": async (page) => {
    await openFixtureSummary(page, DIRECTION_D_SUMMARY_SESSION["session/summary-first"]);
    await page.waitForSelector(".sum-baseline", { timeout: 20000 });
  },

  "progress/overview": (page) => view(page, "stats"),
  "progress/overview-baseline": (page) => view(page, "stats"),
  "progress/overview-action": (page) => view(page, "stats"),
  "progress/exercise-chart": async (page) => {
    await view(page, "stats");
    const evkey = `library:${DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID.sq_bb}`;
    await page.evaluate((key) => window.openExerciseView(key, "stats"), evkey);
    await page.waitForSelector("#exercise.view.active .exchart__plot", { timeout: 20000 });
    await sleep(page, 500);
  },
  "progress/strength": (page) => progressSegment(page, "strength"),
  "progress/strength-current-block": (page) => progressSegment(page, "strength"),
  "progress/strength-all-history": async (page) => { await progressSegment(page, "strength"); await page.click('#strengthScopeSeg [data-scope="all-history"]'); },
  "progress/strength-comparison": async (page) => { await progressSegment(page, "strength"); const row = page.locator(`#strengthDash [data-evkey="library:${DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID.sq_bb}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); },
  "progress/strength-sparse": async (page) => { await progressSegment(page, "strength"); const row = page.locator(`#strengthDash [data-evkey="library:${DIRECTION_D_CANONICAL_ID_BY_LEGACY_ID.sqk_mc}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); },
  "progress/volume": (page) => progressSegment(page, "volume"),
  "progress/volume-block": async (page) => { await progressSegment(page, "volume"); await page.click('#volumeScopeSeg [data-vscope="block-to-date"]'); },
  "progress/volume-drill-in": async (page) => { await progressSegment(page, "volume"); await page.locator("#volumeDash [data-volume-muscle]").first().click(); },
  "progress/prs": (page) => progressSegment(page, "prs"),
  "progress/prs-drill-in": async (page) => { await progressSegment(page, "prs"); await page.locator("#prTimeline .prtl__row").first().click(); },
  "progress/review": (page) => progressSegment(page, "review"),
  "progress/review-active": (page) => progressSegment(page, "review"),
  "progress/review-complete": openCompletedReview,
  "progress/review-insufficient": openCompletedReview,
  "progress/schedule-diagnosis": openScheduleDiagnosis,
  "progress/sibling-lower-frequency": (page) => openSiblingPreview(page, "fewer_days"),
  "progress/sibling-shorter-session": (page) => openSiblingPreview(page, "sessions_too_long"),
  "progress/guided-repair": async (page) => { await openCompletedReview(page);await page.click('[data-review-action="guided-edit"]');await page.fill("[data-diag-target]","3");await page.click("[data-diag-continue]");await page.waitForSelector(".review__staged",{timeout:20000});
    // The progress guide is dismissed here. The rendered-role audit reads the dock's ground from the page's top-left
    // quadrant, and with the guide above it, this short page would put the primary action there.
    await page.click("[data-guide-dismiss]"); },
  "progress/volume-reduction-preview": async (page) => { await completeCompiledProgram(page);await openCompletedReview(page);await page.click('[data-review-action="reduce-volume"]');await page.click("[data-volume-confirm]");await page.waitForSelector("[data-preview-confirm]",{timeout:20000}); },
  "progress/recovery-ineligible": async (page) => { await openRecoveryPreview(page);await page.click('[data-recovery-answer="Not sure"]'); },
  "progress/recovery-questions": openRecoveryPreview,
  "progress/recovery-preview": recoveryPreview,
  "progress/recovery-active": confirmRecovery,
  "progress/recovery-reassessment": async (page) => { await confirmRecovery(page);await page.evaluate(async()=>{const state=window.__repforgeWorkoutDraft.state();const date=new Date(`${state.programMeta.started}T12:00:00`);date.setDate(date.getDate()-8);state.programMeta.started=date.toISOString().slice(0,10);await window.__repforgeCommitProposedState(state);await window.__repforgeStorage.flush();});await page.reload({waitUntil:"domcontentloaded"});await page.waitForFunction(()=>window.__repforgeBooted===true,undefined,{timeout:20000});await progressSegment(page,"review"); },

  "history/list": (page) => view(page, "history"),
  "history/session": async (page) => {
    await view(page, "history");
    // One auto-waiting click, not a scroll followed by a click: the session
    // list re-renders after its first paint, and a separate scroll step gives
    // that re-render a second chance to detach the element mid-operation.
    await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
    await sleep(page, 500);
    await page.locator("#sessions .session__open").first().click({ timeout: 30000 });
    await page.waitForSelector(".session--read", { timeout: 20000 });
    await page.waitForSelector("[data-history-edit]", { timeout: 20000 });
    // The session page rides in on a push (N4); the frame is its resting state, and the scroll below
    // belongs to the page, not to the layer it is riding in.
    await page.waitForFunction(() => !document.body.classList.contains("is-pushing"), undefined, { timeout: 5000 });
    // The read actions are the destructive boundary at large text. Capture the
    // scroll-end state so the fixed navigation cannot hide Edit or Delete in
    // the PT+200 matrix.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(page, 400);
  },
  "history/edit-dirty": async (page) => {
    await openHistoryEditor(page);
    // The drawing: the first set's load changed to 105 and a later set removed (struck through,
    // with Undo). The load is filled last so the changed field keeps the ink ring. Every logged
    // row is a source-metric row now, so the weight field is addressed by its metric id, not by
    // the retired flat "load|" key.
    await page.locator('.session--edit [data-edrm="2"]').click();
    await page.locator(`.session--edit input[data-ek$="|${ADAPTIVE_WEIGHT_METRIC_ID}"]`).first().fill("105");
    await sleep(page, 500);
  },
  "history/edit-invalid": async (page) => {
    await openHistoryEditor(page);
    await page.locator(`.session--edit input[data-ek$="|${ADAPTIVE_WEIGHT_METRIC_ID}"]`).first().fill("x");
    await page.locator("[data-edsave]").click();
    await page.waitForSelector('.session--edit input[aria-invalid="true"]', { timeout: 20000 });
    // The reason stays under the row until the value is fixed, so the frame needs no toast timing.
    await page.waitForSelector(".session--edit [data-histedit-error]", { timeout: 10000 });
    await sleep(page, 400);
  },
  "history/delete-confirm": async (page) => {
    await view(page, "history");
    await page.waitForSelector("#sessions .session__open", { timeout: 20000 });
    await page.locator("#sessions .session__open").first().click();
    await page.waitForSelector(".session--read", { timeout: 20000 });
    await page.locator("[data-del]").click();
    await page.waitForSelector("[data-history-delete-confirm]", { timeout: 20000 });
    await sleep(page, 400);
  },
  "history/conflict": async (page) => {
    await openHistoryEditor(page);
    await page.locator(`.session--edit input[data-ek$="|${ADAPTIVE_WEIGHT_METRIC_ID}"]`).first().fill("175");
    await page.evaluate(async () => {
      const next = structuredClone(JSON.parse(localStorage.getItem("repforge_v1") || "{}"));
      const session = document.querySelector(".session--edit")?.dataset.editing;
      const target = next.log?.find((row) => row.session === session);
      if (!target) throw new Error("history conflict fixture has no log row");
      // Another tab's edit to a metric-schema row moves its weight metric and
      // its load projection together; a row whose two disagree is refused as damaged.
      target.load = Number(target.load) + 7.5;
      const weight = (target.metricValues || []).find((entry) => entry.metricId === "2555c6f170d8805cafa6d16d3fdddbaa");
      if (weight) weight.value = Number(weight.value) + 7.5;
      const result = await window.__repforgeCommitProposedState(next);
      if (!(result?.committed === true && result?.settled === true)) throw new Error("history conflict commit failed");
      await window.__repforgeStorage.flush();
    });
    await page.locator("[data-edsave]").click();
    await page.waitForSelector('[data-history-operation="conflict"]', { timeout: 20000 });
    await sleep(page, 400);
  },

  "library/list": async (page) => {
    await openLibrary(page);
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      await assertLibraryTabsFitExternalTextScale(page);
    }
  },
  "library/list-selected": async (page) => {
    await openLibrary(page);
    const choice = page.locator("#libList [data-lib-toggle]").first();
    await choice.waitFor({ state: "visible", timeout: 20000 });
    await choice.click();
    if (await page.evaluate(() => document.documentElement.style.fontSize === "200%")) {
      await assertLibraryTabsFitExternalTextScale(page);
    }
    await page.waitForFunction(() => {
      const bar = document.querySelector("#libBar");
      const rect = bar?.getBoundingClientRect();
      return rect?.width > 1 && rect?.height > 1 && getComputedStyle(bar).display !== "none";
    }, undefined, { timeout: 10000 });
    const header = await page.evaluate(() => {
      const selectors = ["#libBack", "#libTitle", "#libClose"];
      const items = selectors.map(selector => {
        const element = document.querySelector(selector);
        const rect = element?.getBoundingClientRect();
        return { selector, left: rect?.left, top: rect?.top, right: rect?.right, bottom: rect?.bottom };
      });
      const overlaps = [];
      for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i], b = items[j];
        if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) {
          overlaps.push([a.selector, b.selector]);
        }
      }
      const viewport = document.documentElement.clientWidth;
      const outside = items.filter(item => item.left < 0 || item.right > viewport).map(item => item.selector);
      return { items, overlaps, outside };
    });
    if (header.overlaps.length || header.outside.length) {
      throw new Error(`Selected library header overlaps or escapes the viewport: ${JSON.stringify(header)}`);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(page, 100);
    const clearance = await page.evaluate(() => {
      const end = document.querySelector("#libCustom").getBoundingClientRect();
      const bar = document.querySelector("#libBar").getBoundingClientRect();
      return { contentBottom: end.bottom, actionTop: bar.top, gap: bar.top - end.bottom };
    });
    if (clearance.gap < 8) {
      throw new Error(`Selected library content is hidden behind its persistent action: ${JSON.stringify(clearance)}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(page, 400);
  },
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
  "library/exercise-detail-glossary": async (page) => {
    await enterWorkout(page);
    const row = page.locator("#workout [data-exopen]").first();
    await row.scrollIntoViewIfNeeded({ timeout: 20000 });
    await row.click({ timeout: 20000 });
    await page.waitForSelector("#exDetail:not(.hidden)", { timeout: 20000 });
    const term = page.locator("#exDetail [data-term]").first();
    await term.waitFor({ state: "visible", timeout: 20000 });
    await term.click();
    await page.waitForSelector("#glossary:not(.hidden)", { timeout: 10000 });
    await assertGlossaryViewport(page, "Exercise detail");
    await sleep(page, 400);
  },

  "program/no-program": async (page) => { await dismissChrome(page); await openProgram(page); },
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
  "program/custom-exercise-saving": async (page) => {
    await page.evaluate(() => window.__repforgeOpenPicker({ title: "Add exercise", mode: "single" }));
    await page.waitForSelector("#exPickSheet.is-open", { timeout: 20000 });
    await page.locator("#exPickSheet [data-act='custom'], #exPickSheet button")
      .filter({ hasText: /custom|personalizad/i }).first().click({ timeout: 20000 });
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.locator("#exCustomName").fill("Paused cable row");
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      io.writeIdb = () => new Promise(() => {});
    });
    await page.locator("#exCustomSave").click();
    await page.waitForFunction(() => {
      const sheet = document.querySelector("#exCustomSheet");
      return sheet?.getAttribute("aria-busy") === "true" &&
        document.querySelector("#exCustomSave")?.disabled;
    });
    await page.locator("#exCustomSheet .custom__form").evaluate(form => { form.scrollTop = 0; });
    await sleep(page, 350);
  },
  "program/custom-exercise-deleting": async (page) => {
    await page.evaluate(() => window.__repforgeOpenLibrary({}));
    await page.waitForSelector("#library.active", { timeout: 20000 });
    await page.locator("#libCustom").click();
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.locator("#exCustomName").fill("Paused cable row");
    await page.locator('#exCustomEquip .pchip[aria-pressed="false"]').first().click();
    await page.locator('#exCustomPrimary .pchip[aria-pressed="false"]').first().click();
    await page.locator("#exCustomSave").click();
    await page.waitForSelector("#exCustomSheet", { state: "hidden", timeout: 20000 });
    const customId = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("repforge_v1") || "{}");
      return state.customExercises?.find(entry => entry.name === "Paused cable row")?.id || null;
    });
    if (!customId) throw new Error("The custom deletion fixture was not created through the UI");
    await page.evaluate(id => window.__repforgeEditCustom(id), customId);
    await page.waitForSelector("#exCustomSheet.is-open", { timeout: 20000 });
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const writeIdb = io.writeIdb;
      io.writeIdb = snapshot => new Promise(resolve => {
        window.__releaseCustomDeleteWrite = () => resolve(writeIdb.call(io, snapshot));
      });
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.getAttribute("aria-busy") === "true" &&
      document.querySelector("#exCustomDelete")?.dataset.i18n === "custom.deleting");
    await sleep(page, 350);
  },
  "program/custom-exercise-archiving": async (page) => {
    await createInUseCustomExercise(page);
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      io.writeIdb = () => new Promise(() => {});
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => document.querySelector("#exCustomSheet")?.getAttribute("aria-busy") === "true" &&
      document.querySelector("#exCustomDelete")?.dataset.i18n === "custom.archiving");
    await sleep(page, 350);
  },
  "program/custom-exercise-recovery": async (page) => {
    await createInUseCustomExercise(page);
    await page.evaluate(() => {
      const io = window.RepForgeDurableState.storageIO;
      const writeIdb = io.writeIdb;
      let calls = 0;
      io.writeIdb = snapshot => ++calls <= 2
        ? Promise.resolve(false)
        : writeIdb.call(io, snapshot);
    });
    await page.locator("#exCustomDelete").click();
    await page.waitForFunction(() => {
      const recovery = document.querySelector("#exCustomRecovery");
      return recovery?.hidden === false &&
        document.querySelector("#exCustomRecoveryRetry")?.hidden === false &&
        document.querySelector("#exCustomRecoveryStatus")?.textContent?.trim();
    }, undefined, { timeout: 20000 });
    await page.waitForFunction(() => {
      const toast = document.querySelector("#toast");
      return !toast || toast.classList.contains("hidden");
    }, undefined, { timeout: 10000 });
    await resetSheetScroll(page, "#exCustomSheet .custom__form");
    await sleep(page, 350);
  },
  "program/share-setup": async (page) => {
    await openProgram(page);
    await page.click("#shareProgramSetup");
    await page.waitForSelector("#shareSetupSheet.is-open", { timeout: 10000 });
    await stabilizeShareLink(page);
    await sleep(page, 500);
  },
  "program/share-ready": async (page) => {
    await page.evaluate(() => Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {},
    }));
    await openShare(page);
    await page.waitForSelector("#shareSetupShare:not(.hidden):not(:disabled)", { timeout: 20000 });
    await stabilizeShareLink(page);
    await sleep(page, 400);
  },
  "program/text-export": async (page) => {
    await openProgram(page);
    await page.click("#exportProgramText");
    await page.waitForSelector("#programTextSheet.is-open", { timeout: 20000 });
    await sleep(page, 400);
  },

  "settings/main": (page) => openSettings(page),
  "settings/appearance": (page) => openSettings(page, "#theme"),
  "settings/guides": async (page) => {
    await openSettings(page, "#guideReplayToggle");
    await page.click("#guideReplayToggle");
    await page.waitForSelector("#guideReplayPanel.is-open");
    await sleep(page, 300);
  },
  "settings/guides-replay": async (page) => {
    await openSettings(page);
    await page.click("#guideReplayToggle");
    await page.waitForSelector("#guideReplayPanel.is-open", { timeout: 20000 });
    await page.locator('#guideReplayList [data-guide-replay="privacy"]').click();
    const cue = page.locator('.guide-cue[data-guide-cue="privacy"]');
    await cue.waitFor({ state: "visible", timeout: 20000 });
    // The replay focuses its dismiss button without scrolling, but the click
    // that opened the panel is allowed to auto-scroll. Establish the frame's
    // subject explicitly so a different preceding scroll position cannot
    // produce a different catalog image.
    await cue.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    });
    await page.waitForFunction(() => {
      const element = document.querySelector('.guide-cue[data-guide-cue="privacy"]');
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2) <= 1;
    });
    await sleep(page, 400);
  },
  "settings/privacy": (page) => openSettings(page, "#telemetryToggle"),
  "settings/privacy-disclosure": async (page) => {
    await openSettings(page, "#privacyDetails");
    await page.click("#privacyDetails");
    await page.waitForSelector("#privacySheet.is-open", { timeout: 10000 });
    await sleep(page, 300);
  },

  "install/banner": async (page) => {
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt");
      event.prompt = () => {};
      event.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(event);
      window.__repforgeUi.showInstallBanner(false);
    });
    await sleep(page, 500);
    const shown = await page.evaluate(() => {
      const banner = document.querySelector(".installbanner");
      return banner && !banner.classList.contains("hidden");
    });
    if (!shown) throw new Error("install banner did not open");
  },
  "install/ios-sheet": async (page) => {
    await openTransferState(page, "manual");
  },
  "install/transfer-eligible": (page) => openTransferState(page, "eligible"),
  "install/transfer-creating": (page) => openTransferState(page, "creating"),
  "install/transfer-ready": (page) => openTransferState(page, "ready"),
  "install/transfer-retryable": (page) => openTransferState(page, "retryable"),
  "install/transfer-claiming": (page) => openTransferState(page, "claiming"),
  "install/transfer-importing": (page) => openTransferState(page, "importing"),
  "install/transfer-success": (page) => openTransferState(page, "success"),
  "install/transfer-cleanup": (page) => openTransferState(page, "cleanup"),
  "install/transfer-terminal": (page) => openTransferState(page, "terminal"),
  "install/transfer-destination": (page) => openTransferState(page, "destination"),
  "install/transfer-interrupted": (page) => openTransferState(page, "interrupted"),
  "install/transfer-unknown": (page) => openTransferState(page, "unknown"),
  "install/transfer-claimed-expired": (page) => openTransferState(page, "claimed-expired"),
};

/** Transfer surfaces only render under a Safari user agent. The promotion
 * banner stays on Chromium so its catalog state exercises the native install
 * capability and earned-value milestone. */
const IOS_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
export const APP_USER_AGENT = Object.fromEntries([
  "ios-sheet", "transfer-eligible", "transfer-creating", "transfer-ready", "transfer-retryable",
  "transfer-claiming", "transfer-importing", "transfer-success", "transfer-cleanup", "transfer-terminal",
  "transfer-destination", "transfer-interrupted", "transfer-unknown", "transfer-claimed-expired",
].map((id) => [`install/${id}`, IOS_SAFARI]));
